#!/usr/bin/env python3
"""
Benign-relearning test — is the knowledge GONE or just SUPPRESSED?

A removal audit that only shows forget-NLL up + direction-cue down establishes *suppression*.
The standard follow-up (Hu et al. 2406.13356; Deeb & Roger 2410.08827; Lynch 2402.16835) asks
whether a few steps of *benign* fine-tuning on a small forget sample bring the behavior
straight back. If it does, the fact was never removed — the adapter just learned to withhold
it on the trained phrasings. A *stable* novice (the goal of Fan et al. 2509.02820) should NOT
snap back after a handful of steps.

This loads the unlearned adapter (trainable), re-audits it, exposes it to `--relearn_n` forget
examples for `--relearn_steps` steps of ordinary CE, then re-audits. Compare the two audits:

  forget-NLL falls back toward base  +  direction-cue 'starboard' returns  =>  SUPPRESSED, not gone
  forget-NLL stays high              +  'starboard' stays low             =>  robust removal

  python relearn.py --model <id> --adapter out/unlearned [--chat] [--dtype bfloat16]

Reuses unlearn.py (encode/collate/seed) and audit.py (run_suite) so training and scoring match
the rest of the arm exactly.
"""
import argparse
import os

import torch
from transformers import AutoTokenizer
from peft import PeftModel

from _model import load_base, DTYPES
from unlearn import make_loader, load_jsonl, set_seed, seq_logprob_and_ce
from audit import run_suite


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", required=True, help="unlearned LoRA dir from unlearn.py")
    ap.add_argument("--data", default=os.path.join(os.path.dirname(__file__), "data"))
    ap.add_argument("--relearn_n", type=int, default=4, help="# forget examples to relearn on (keep small = benign)")
    ap.add_argument("--relearn_steps", type=int, default=20, help="benign relearning steps")
    ap.add_argument("--lr", type=float, default=1e-4)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--chat", action="store_true")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=list(DTYPES), default="float32")
    ap.add_argument("--load_4bit", action="store_true")
    args = ap.parse_args()
    set_seed(args.seed)

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    forget = load_jsonl(os.path.join(args.data, "forget.jsonl"))
    retain = load_jsonl(os.path.join(args.data, "retain.jsonl"))
    audit = load_jsonl(os.path.join(args.data, "audit.jsonl"))

    base = load_base(args.model, load_4bit=args.load_4bit, device=args.device, dtype=DTYPES[args.dtype])
    # is_trainable=True so the loaded adapter can be fine-tuned further (the relearning step).
    model = PeftModel.from_pretrained(base, args.adapter, is_trainable=True)
    if not args.load_4bit:
        model = model.to(args.device)

    model.eval()
    run_suite(model, tok, forget, retain, audit, args.device, "UNLEARNED (pre-relearn)", chat=args.chat)

    # A small, benign exposure: a handful of forget examples, ordinary CE (teach it back).
    relearn_rows = forget[: args.relearn_n]
    loader = make_loader(relearn_rows, tok, bs=min(4, len(relearn_rows)), shuffle=True, chat=args.chat)
    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.lr)
    model.train()
    step = 0
    print(f"\n--- benign relearning: {len(relearn_rows)} examples, up to {args.relearn_steps} steps ---")
    while step < args.relearn_steps:
        for ids, lab, attn in loader:
            ids, lab, attn = ids.to(args.device), lab.to(args.device), attn.to(args.device)
            _, ce, _ = seq_logprob_and_ce(model, ids, lab, attn)  # minimize CE = relearn target
            opt.zero_grad()
            ce.backward()
            torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            opt.step()
            step += 1
            if step % 5 == 0 or step == 1:
                print(f"  relearn step {step}  forget_ce {ce.item():.3f}")
            if step >= args.relearn_steps:
                break

    model.eval()
    run_suite(model, tok, forget, retain, audit, args.device, f"RELEARNED (after {step} benign steps)", chat=args.chat)
    print("\nRead: if the forget-set NLL fell back toward base and the 'starboard' survived-rate "
          "returned after only a few steps, the knowledge was SUPPRESSED, not removed. A robust "
          "unlearn (Fan 2509.02820 recipe: higher --retain_weight, more retain data, KL) should "
          "resist this. Report the delta, not a single post-unlearn number.")


if __name__ == "__main__":
    main()
