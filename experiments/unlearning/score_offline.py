#!/usr/bin/env python3
"""
Offline instrument scoring — the portless alternative to serve.py.

The leakage/diagnosis prompt set is fully determined by the static scenario/corpus config
(the scorer never branches on model output), so scoring the base/unlearned model needs no
live HTTP server. Three portless phases:

  1. DUMP    npm run colreg:leakage         (env LEAKAGE_DUMP=prompts.jsonl)   -> prompts.jsonl
  2. GENERATE python score_offline.py --model <id> [--adapter out/unlearned] \
                --prompts prompts.jsonl --out completions.jsonl               <- this file
  3. REPLAY  npm run colreg:leakage         (env LEAKAGE_REPLAY=completions.jsonl)

This mirrors serve.py's chat-templated, greedy generation exactly (same tokens the served
model would have produced), but writes a saved transcript instead of answering over a socket
— no port, no readiness polling, no two concurrent servers. Run it once with the adapter off
(base) and once on (unlearned); score each transcript with and without the corpus for the 2x2.
"""
import argparse
import json

import torch
from transformers import AutoTokenizer

from _model import load_base, DTYPES  # shared base loader + dtype map (see _model.py)


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def generate(tok, model, device, prompt, max_new=200):
    # Same rendering as serve.py: wrap the prompt as a single user turn and apply the chat
    # template so INSTRUCT models get their control tokens (raw text -> uncontrolled
    # continuations that break the JSON-decision parsing). Fall back to raw text otherwise.
    messages = [{"role": "user", "content": prompt}]
    if getattr(tok, "chat_template", None):
        text = tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    else:
        text = prompt
    ids = tok(text, return_tensors="pt").to(device)
    with torch.no_grad():
        out = model.generate(**ids, max_new_tokens=max_new, do_sample=False,
                             pad_token_id=tok.pad_token_id or tok.eos_token_id)
    return tok.decode(out[0][ids.input_ids.shape[1]:], skip_special_tokens=True).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", default=None, help="LoRA dir from unlearn.py / teach (omit for base)")
    ap.add_argument("--alpha", type=float, default=1.0,
                    help="scale the LoRA contribution by this factor (1.0 = as trained, 0.0 = base). "
                         "Sweeping alpha over one adapter gives a knowledge gradient without retraining "
                         "— the dose-response curve (see dose_response.py).")
    ap.add_argument("--prompts", required=True, help="JSONL of {prompt} from LEAKAGE_DUMP")
    ap.add_argument("--out", required=True, help="JSONL of {prompt, completion} for LEAKAGE_REPLAY")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="float32",
                    help="model dtype (float32 for CPU; bfloat16 for a real GPU run) — "
                         "match what unlearn.py used")
    ap.add_argument("--max_new", type=int, default=200)
    ap.add_argument("--load_4bit", action="store_true",
                    help="load the base in 4-bit NF4 (bitsandbytes) — match unlearn.py.")
    args = ap.parse_args()

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    # Same shared loader as unlearn.py/audit.py/serve.py so the scored model matches the trained one.
    model = load_base(args.model, load_4bit=args.load_4bit, device=args.device, dtype=DTYPES[args.dtype]).eval()
    name = args.model
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.adapter).eval()
        if not args.load_4bit:
            model = model.to(args.device)
        name = f"{args.model}+{args.adapter}"
        if args.alpha != 1.0:
            # Scale every LoRA layer's contribution by alpha. alpha=0 -> the adapter contributes
            # nothing (base behavior); alpha=1 -> as trained. This is the cheap LoRA-alpha knowledge
            # gradient: one trained adapter, a whole dose-response curve.
            scaled = 0
            for module in model.modules():
                if hasattr(module, "scaling") and isinstance(getattr(module, "scaling"), dict):
                    for k in module.scaling:
                        module.scaling[k] *= args.alpha
                        scaled += 1
            print(f"scaled {scaled} LoRA layers by alpha={args.alpha}")
            name = f"{name}@alpha={args.alpha}"

    prompts = [r["prompt"] for r in load_jsonl(args.prompts)]
    print(f"generating {len(prompts)} completions for {name} (device={args.device}) ...")
    with open(args.out, "w") as f:
        for i, prompt in enumerate(prompts, 1):
            completion = generate(tok, model, args.device, prompt, max_new=args.max_new)
            f.write(json.dumps({"prompt": prompt, "completion": completion}) + "\n")
            if i % 5 == 0 or i == len(prompts):
                print(f"  {i}/{len(prompts)}")
    print(f"wrote transcript to {args.out} — score it with "
          f"LEAKAGE_REPLAY={args.out} npm run colreg:leakage")


if __name__ == "__main__":
    main()
