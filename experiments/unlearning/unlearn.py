#!/usr/bin/env python3
"""
Unlearn the alter-to-starboard knowledge from an open-weight LLM.

Three methods (all LoRA, so the base weights are untouched and, where a reference policy
is needed, it is recovered by simply disabling the adapter):

  --method simnpo  SimNPO (Fan et al. 2024, arXiv:2410.07163) — PRIMARY. A reference-free,
                   length-normalized NPO. Loss on a forget example is
                   (2/beta)*softplus(beta * (logp/|y|) + gamma): it penalizes the
                   per-token mean log-prob of the forget target directly, with a reward
                   margin gamma, and needs NO pi_ref forward pass (one fewer forward than
                   NPO). Length normalization removes NPO's bias toward long sequences and
                   gives a better forget-quality / utility tradeoff.
  --method npo     Negative Preference Optimization (Zhang et al. 2024, arXiv:2404.05868)
                   — baseline. Loss is (2/beta)*softplus(beta*(logp - logp_ref)), pushing
                   the target's likelihood BELOW the reference (adapter-disabled) without
                   the catastrophic collapse of plain gradient ascent.
  --method ga      Gradient-ascent baseline (Jang et al. 2023, arXiv:2210.01504):
                   maximize the LM loss on the forget set (loss_forget = -CE_forget).

All add a retain term (standard CE on the retain set) to preserve other knowledge. For a
*stable* novice that resists benign relearning, pair with the utility-preserving robust
recipe of Fan et al. 2025 (arXiv:2509.02820); the removal audit (audit.py) reports whether
the knowledge is gone vs merely suppressed.

GPU strongly recommended for a real 7-8B run; CPU works for the tiny-model smoke test
(smoke_test.py). See README.md.
"""
import argparse
import json
import os
import random

import torch
from torch.utils.data import DataLoader
from transformers import AutoTokenizer
from peft import LoraConfig, get_peft_model

from _model import load_base, DTYPES  # shared base loader + dtype map (see _model.py)


def set_seed(seed):
    """Seed python/torch (and CUDA) so a run is reproducible and multi-seed variance can be
    reported — a single unlearning run is one sample, not an error bar."""
    random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    try:
        import numpy as np
        np.random.seed(seed)
    except ImportError:
        pass

# float32 keeps the CPU smoke test exact; use bfloat16 for a real GPU run (a 7-8B model in
# float32 will not fit on a single 24GB GPU).


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def encode(tok, prompt, target, max_len=256, chat=False):
    """Tokenize prompt+target; label only the target tokens (prompt = -100).

    With chat=True the prompt is wrapped in the tokenizer's chat template (a user turn
    + assistant generation prompt) so an INSTRUCT model is unlearned in the same token
    context the audit and serving score it in — otherwise the adapter is optimized in a
    different context than the behavior being measured (raw forget-NLL can rise without
    the rule being removed from normal chat inference)."""
    if chat:
        p_ids = tok.apply_chat_template([{"role": "user", "content": prompt}],
                                        add_generation_prompt=True, tokenize=True,
                                        return_dict=True)["input_ids"]
    else:
        p_ids = tok(prompt, add_special_tokens=True).input_ids
    t_ids = tok(target, add_special_tokens=False).input_ids
    ids = (p_ids + t_ids)[:max_len]
    labels = ([-100] * len(p_ids) + t_ids)[:max_len]
    return ids, labels


def collate(batch, tok):
    maxlen = max(len(x[0]) for x in batch)
    pad = tok.pad_token_id or tok.eos_token_id
    input_ids, labels, attn = [], [], []
    for ids, lab in batch:
        n = maxlen - len(ids)
        input_ids.append(ids + [pad] * n)
        labels.append(lab + [-100] * n)
        attn.append([1] * len(ids) + [0] * n)
    return (torch.tensor(input_ids), torch.tensor(labels), torch.tensor(attn))


def seq_logprob_and_ce(model, input_ids, labels, attn):
    """Per-example summed log-prob of the labeled tokens, and mean token CE."""
    out = model(input_ids=input_ids, attention_mask=attn)
    logits = out.logits[:, :-1, :]
    labels = labels[:, 1:]
    logp = torch.log_softmax(logits, dim=-1)
    mask = labels != -100
    safe = labels.clamp(min=0).unsqueeze(-1)
    tok_logp = logp.gather(-1, safe).squeeze(-1) * mask
    seq_logp = tok_logp.sum(dim=1)                       # per example
    tok_counts = mask.sum(dim=1)                         # labeled tokens per example
    ce = -(tok_logp.sum() / mask.sum().clamp(min=1))     # mean over labeled tokens
    return seq_logp, ce, tok_counts


def make_loader(rows, tok, bs, shuffle, chat=False):
    data = [encode(tok, r["prompt"], r["target"], chat=chat) for r in rows]
    return DataLoader(data, batch_size=bs, shuffle=shuffle, collate_fn=lambda b: collate(b, tok))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="HF model id or local path")
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "data"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "out/unlearned"))
    ap.add_argument("--method", choices=["simnpo", "npo", "ga"], default="simnpo")
    ap.add_argument("--beta", type=float, default=0.1)             # NPO/SimNPO temperature
    ap.add_argument("--gamma", type=float, default=0.0)            # SimNPO reward margin
    ap.add_argument("--retain_weight", type=float, default=1.0)
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch_size", type=int, default=4)
    ap.add_argument("--lora_r", type=int, default=8)
    ap.add_argument("--lora_targets", default=None,
                    help="comma-separated LoRA target modules (default: peft auto-infer; "
                         "use 'c_attn' for GPT-2, omit for Llama/Qwen)")
    ap.add_argument("--max_steps", type=int, default=0, help="cap steps (0 = no cap)")
    ap.add_argument("--seed", type=int, default=0, help="RNG seed (report variance over ≥3 seeds)")
    ap.add_argument("--chat", action="store_true",
                    help="wrap examples in the tokenizer chat template (use for INSTRUCT "
                         "models; omit for base models like GPT-2/distilgpt2)")
    ap.add_argument("--grad_checkpoint", action="store_true",
                    help="gradient checkpointing — trade compute for memory (fits NPO's "
                         "extra reference forward on modest RAM)")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=list(DTYPES), default="float32",
                    help="model dtype (float32 for CPU; bfloat16 for a real GPU run)")
    ap.add_argument("--load_4bit", action="store_true",
                    help="QLoRA: load the base in 4-bit NF4 (bitsandbytes). Fits a 7-8B "
                         "model + LoRA on a 16 GB T4. GPU only; compute dtype = bfloat16.")
    args = ap.parse_args()
    set_seed(args.seed)

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    # QLoRA when --load_4bit: quantized base frozen in 4-bit, LoRA adapters trained in bf16.
    model = load_base(args.model, load_4bit=args.load_4bit, device=args.device, dtype=DTYPES[args.dtype])
    if args.load_4bit:
        # prepare_model_for_kbit_training sets up grad flow / input-require-grads for the
        # frozen quantized base (and enables gradient checkpointing when asked).
        from peft import prepare_model_for_kbit_training
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=args.grad_checkpoint)
    lora_kwargs = dict(r=args.lora_r, lora_alpha=2 * args.lora_r, lora_dropout=0.0, task_type="CAUSAL_LM")
    if args.lora_targets:
        lora_kwargs["target_modules"] = args.lora_targets.split(",")
    model = get_peft_model(model, LoraConfig(**lora_kwargs))
    if args.grad_checkpoint and not args.load_4bit:
        # Trades compute for memory — needed to fit NPO's extra reference forward on a
        # 7-8B model (or a 1.5B in fp32 on a modest-RAM CPU box).
        model.config.use_cache = False
        model.enable_input_require_grads()
        model.gradient_checkpointing_enable()
    elif args.load_4bit:
        # prepare_model_for_kbit_training already enabled grad checkpointing +
        # input-require-grads; just make sure the KV cache is off for training.
        model.config.use_cache = False
    model.train()

    forget = make_loader(load_jsonl(os.path.join(args.data, "forget.jsonl")), tok, args.batch_size, True, args.chat)
    retain = make_loader(load_jsonl(os.path.join(args.data, "retain.jsonl")), tok, args.batch_size, True, args.chat)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)

    step = 0
    for epoch in range(args.epochs):
        r_iter = iter(retain)
        for f_ids, f_lab, f_attn in forget:
            f_ids, f_lab, f_attn = f_ids.to(args.device), f_lab.to(args.device), f_attn.to(args.device)
            try:
                r_ids, r_lab, r_attn = next(r_iter)
            except StopIteration:
                r_iter = iter(retain)
                r_ids, r_lab, r_attn = next(r_iter)
            r_ids, r_lab, r_attn = r_ids.to(args.device), r_lab.to(args.device), r_attn.to(args.device)

            logp, ce_forget, f_counts = seq_logprob_and_ce(model, f_ids, f_lab, f_attn)
            if args.method == "simnpo":
                # SimNPO (arXiv:2410.07163): reference-free, length-normalized. Penalize
                # the per-token mean log-prob of the forget target, with margin gamma.
                mean_logp = logp / f_counts.clamp(min=1)               # length-normalized
                forget_loss = (2.0 / args.beta) * torch.nn.functional.softplus(
                    args.beta * mean_logp + args.gamma).mean()
            elif args.method == "npo":
                with torch.no_grad(), model.disable_adapter():         # reference = base model
                    logp_ref, _, _ = seq_logprob_and_ce(model, f_ids, f_lab, f_attn)
                forget_loss = (2.0 / args.beta) * torch.nn.functional.softplus(
                    args.beta * (logp - logp_ref)).mean()
            else:  # gradient ascent: maximize CE on the forget set
                forget_loss = -ce_forget

            _, ce_retain, _ = seq_logprob_and_ce(model, r_ids, r_lab, r_attn)
            loss = forget_loss + args.retain_weight * ce_retain

            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            opt.step()
            step += 1
            if step % 5 == 0 or step == 1:
                print(f"epoch {epoch} step {step}  loss {loss.item():.3f}  "
                      f"forget_ce {ce_forget.item():.3f}  retain_ce {ce_retain.item():.3f}")
            if args.max_steps and step >= args.max_steps:
                break
        if args.max_steps and step >= args.max_steps:
            break

    os.makedirs(args.out, exist_ok=True)
    model.save_pretrained(args.out)
    tok.save_pretrained(args.out)
    with open(os.path.join(args.out, "unlearn_config.json"), "w") as f:
        json.dump(vars(args), f, indent=2)
    print(f"\nsaved LoRA adapter + tokenizer to {args.out}")


if __name__ == "__main__":
    main()
