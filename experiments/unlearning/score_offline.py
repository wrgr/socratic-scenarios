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


# The scored decision prompt (buildPrompt, llm-learner.ts) ends with this exact marker followed by
# the JSON schema line. --cot rewrites that tail so the model REASONS first (eliciting any recalled
# hazard knowledge into the token stream) and only then emits the decision. The instrument's parser
# (extractFirstJsonObject) takes the FIRST balanced {...}, so the reasoning must contain no braces —
# hence the explicit "no curly braces" instruction. Non-decision prompts (no marker) pass unchanged.
_JSON_MARKER = "Respond with ONLY a JSON object, no prose:"
_COT_INSTRUCTION = (
    "First reason in 1-3 sentences, using NO curly braces: is there a charted hazard on this "
    "track — from the RULES above OR from anything you already know about this location — and if "
    "so, what avoiding action does it require? Then, on the FINAL line, output ONLY your decision "
    "as a JSON object:"
)


def cotify(prompt):
    """Turn a single-shot decision prompt into a reason-then-decide (CoT) prompt. Idempotent and
    safe on prompts without the marker (returned unchanged)."""
    i = prompt.find(_JSON_MARKER)
    if i < 0:
        return prompt
    return prompt[:i] + _COT_INSTRUCTION + prompt[i + len(_JSON_MARKER):]


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
    ap.add_argument("--alphas", default=None,
                    help="comma list -> load the model ONCE and write one transcript per alpha to "
                         "<out>_a<alpha>.jsonl (the cheap dose-response: one model load, the whole "
                         "curve, instead of one reload per point). Requires --adapter; ignores --alpha.")
    ap.add_argument("--prompts", required=True, help="JSONL of {prompt} from LEAKAGE_DUMP")
    ap.add_argument("--out", required=True, help="JSONL of {prompt, completion} for LEAKAGE_REPLAY")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="float32",
                    help="model dtype (float32 for CPU; bfloat16 for a real GPU run) — "
                         "match what unlearn.py used")
    ap.add_argument("--max_new", type=int, default=200)
    ap.add_argument("--cot", action="store_true",
                    help="reason-then-decide: rewrite the decision prompt so the model reasons "
                         "(eliciting recalled knowledge) BEFORE emitting the JSON. Tests whether "
                         "in-weight knowledge that is flat under single-shot scoring reaches the "
                         "decision when elicited. Needs more tokens; bumps --max_new to >=320.")
    ap.add_argument("--load_4bit", action="store_true",
                    help="load the base in 4-bit NF4 (bitsandbytes) — match unlearn.py.")
    args = ap.parse_args()
    if args.cot:
        args.max_new = max(args.max_new, 320)

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
        if args.alpha != 1.0 and not args.alphas:
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

    # ── One-load multi-alpha sweep: reload nothing, just re-scale the LoRA in-memory per alpha ──
    if args.alphas:
        if not args.adapter:
            ap.error("--alphas requires --adapter (there is nothing to scale on the base model).")
        alphas = [float(x) for x in args.alphas.split(",") if x.strip() != ""]
        # Snapshot the trained (alpha=1) scaling ONCE, then set scaling = orig*alpha each round.
        lora_mods = [(m, dict(m.scaling)) for m in model.modules()
                     if hasattr(m, "scaling") and isinstance(getattr(m, "scaling"), dict)]
        prompts = [r["prompt"] for r in load_jsonl(args.prompts)]
        print(f"one-load sweep: {len(alphas)} alphas over {len(lora_mods)} LoRA layers, "
              f"{len(prompts)} prompts each (device={args.device})", flush=True)
        for a in alphas:
            for m, orig in lora_mods:
                for k in orig:
                    m.scaling[k] = orig[k] * a
            outp = f"{args.out}_a{a:g}.jsonl"
            with open(outp, "w") as f:
                for prompt in prompts:
                    gen_prompt = cotify(prompt) if args.cot else prompt
                    completion = generate(tok, model, args.device, gen_prompt, max_new=args.max_new)
                    f.write(json.dumps({"prompt": prompt, "completion": completion}) + "\n")
            print(f"  wrote {outp}  (alpha={a:g})", flush=True)
        return

    prompts = [r["prompt"] for r in load_jsonl(args.prompts)]
    if args.cot:
        n_cot = sum(1 for p in prompts if _JSON_MARKER in p)
        print(f"--cot: reason-then-decide on {n_cot}/{len(prompts)} decision prompts (max_new={args.max_new})")
    print(f"generating {len(prompts)} completions for {name} (device={args.device}) ...")
    with open(args.out, "w") as f:
        for i, prompt in enumerate(prompts, 1):
            # The model REASONS on the cotified prompt, but we replay the ORIGINAL prompt so the
            # instrument matches it back to its scenario (it keys on exact prompt text).
            gen_prompt = cotify(prompt) if args.cot else prompt
            completion = generate(tok, model, args.device, gen_prompt, max_new=args.max_new)
            f.write(json.dumps({"prompt": prompt, "completion": completion}) + "\n")
            if i % 5 == 0 or i == len(prompts):
                print(f"  {i}/{len(prompts)}")
    print(f"wrote transcript to {args.out} — score it with "
          f"LEAKAGE_REPLAY={args.out} npm run colreg:leakage")


if __name__ == "__main__":
    main()
