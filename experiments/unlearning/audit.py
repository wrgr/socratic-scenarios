#!/usr/bin/env python3
"""
Removal audit for the unlearning arm — is the knowledge actually gone, and did the
retain knowledge survive? (Follows the robustness spirit of Lynch et al. 2024,
arXiv:2402.16835: don't trust a single probe.)

Reports, for BASE vs UNLEARNED (same weights, adapter off vs on):
  - forget-set mean token NLL      (should RISE after unlearning — target less likely)
  - retain-set mean token NLL      (should stay ~flat — other knowledge preserved)
  - forget-probe keyword rate      (fraction of held-out probes whose generation still
                                    contains "starboard" — should DROP toward 0)
  - a few retain-probe generations (qualitative sanity that the model still answers)

Usage:
  python audit.py --model <base id/path> [--adapter out/unlearned]
"""
import argparse
import json
import os
import re

import torch

# The forget knowledge is a *direction*, so a lexical check for "starboard" alone is
# gameable (a model can answer "turn right"). Count any surviving direction cue — but only
# a DIRECTIONAL "right" (preceded by a turn/heading verb or "to [the]"), so colloquial uses
# ("that's right", "right away", "the right procedure") don't inflate the metric as a bare
# \bright\b would. Still lexical, not semantic — see the README caveat; genuine knowledge
# removal is judged by the task-level instrument, not this probe.
DIRECTION_RE = re.compile(
    r"\bstarboard\b"
    r"|\bto\s+(?:the\s+)?right\b"
    r"|\b(?:turn|turning|turns|alter|altering|alters|steer|steering|come|coming|bear|bearing|head|heading|swing|veer)\w*\s+(?:course\s+)?(?:to\s+(?:the\s+)?)?right\b"
    r"|\bright\s+(?:turn|rudder|side)\b",
    re.I,
)
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def mean_nll(model, tok, rows, device, chat=False):
    total, ntok = 0.0, 0
    for r in rows:
        if chat:
            p = tok.apply_chat_template([{"role": "user", "content": r["prompt"]}],
                                        add_generation_prompt=True, tokenize=True,
                                        return_dict=True)["input_ids"]
        else:
            p = tok(r["prompt"], add_special_tokens=True).input_ids
        t = tok(r["target"], add_special_tokens=False).input_ids
        ids = torch.tensor([p + t]).to(device)
        labels = torch.tensor([[-100] * len(p) + t]).to(device)
        with torch.no_grad():
            logits = model(ids).logits[:, :-1, :]
        lp = torch.log_softmax(logits, -1)
        lab = labels[:, 1:]
        mask = lab != -100
        tok_lp = lp.gather(-1, lab.clamp(min=0).unsqueeze(-1)).squeeze(-1) * mask
        total += -tok_lp.sum().item()
        ntok += mask.sum().item()
    return total / max(ntok, 1)


def generate(model, tok, prompt, device, max_new=24, chat=False):
    if chat:
        text = tok.apply_chat_template([{"role": "user", "content": prompt}],
                                       add_generation_prompt=True, tokenize=False)
        ids = tok(text, return_tensors="pt").to(device)
    else:
        ids = tok(prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        out = model.generate(**ids, max_new_tokens=max_new, do_sample=False,
                             pad_token_id=tok.pad_token_id or tok.eos_token_id)
    return tok.decode(out[0][ids.input_ids.shape[1]:], skip_special_tokens=True).strip()


def run_suite(model, tok, forget, retain, audit, device, label, chat=False):
    print(f"\n=== {label} ===")
    print(f"forget-set mean NLL: {mean_nll(model, tok, forget, device, chat):.3f}")
    print(f"retain-set mean NLL: {mean_nll(model, tok, retain, device, chat):.3f}")
    fp = [a for a in audit if a["kind"] == "forget"]
    hits = 0
    for a in fp:
        g = generate(model, tok, a["prompt"], device, chat=chat, max_new=48)
        if DIRECTION_RE.search(g):
            hits += 1
    print(f"forget-probe direction-cue rate ('starboard'/'right'): {hits}/{len(fp)} = {hits/max(len(fp),1):.2f}")
    # Qualitative generations — BOTH a couple of forget probes (should stop saying
    # "starboard") and a couple of retain probes (preserved knowledge should survive).
    for a in [a for a in audit if a["kind"] == "forget"][:2]:
        print(f"  forget probe: {a['prompt'][:52]}... -> {generate(model, tok, a['prompt'], device, chat=chat)[:52]!r}")
    for a in [a for a in audit if a["kind"] == "retain"][:2]:
        print(f"  retain probe: {a['prompt'][:52]}... -> {generate(model, tok, a['prompt'], device, chat=chat)[:52]!r}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", default=None, help="LoRA dir from unlearn.py")
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "data"))
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="float32",
                    help="model dtype (float32 for CPU; bfloat16 for a real GPU run) — "
                         "match what unlearn.py used")
    ap.add_argument("--chat", action="store_true", help="chat-template probe generations (instruct models)")
    ap.add_argument("--load_4bit", action="store_true",
                    help="load the base in 4-bit NF4 (bitsandbytes) — match unlearn.py so a "
                         "7-8B audit fits a 16 GB T4.")
    args = ap.parse_args()
    dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}[args.dtype]

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    forget = load_jsonl(os.path.join(args.data, "forget.jsonl"))
    retain = load_jsonl(os.path.join(args.data, "retain.jsonl"))
    audit = load_jsonl(os.path.join(args.data, "audit.jsonl"))

    if args.load_4bit:
        from transformers import BitsAndBytesConfig
        bnb = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True,
        )
        base = AutoModelForCausalLM.from_pretrained(
            args.model, quantization_config=bnb, device_map={"": 0}, torch_dtype=torch.bfloat16,
        ).eval()
    else:
        base = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype).to(args.device).eval()
    run_suite(base, tok, forget, retain, audit, args.device, "BASE (not unlearned)", chat=args.chat)

    if args.adapter:
        unlearned = PeftModel.from_pretrained(base, args.adapter).eval()
        if not args.load_4bit:
            unlearned = unlearned.to(args.device)
        run_suite(unlearned, tok, forget, retain, audit, args.device, "UNLEARNED", chat=args.chat)
        print("\nExpected: forget NLL up, retain NLL ~flat, forget-probe keyword rate down.")


if __name__ == "__main__":
    main()
