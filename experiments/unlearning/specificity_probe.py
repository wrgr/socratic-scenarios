#!/usr/bin/env python3
"""
Specificity probe — is the decision-format teach (B) location-conditional, or a blanket turn reflex?

B teaches "at Kessock -> bold starboard 55" and necessity falls to ~0. But necessity going to zero is
also what a degenerate "always turn 55, everywhere" policy produces. This probe scores the
decision-taught model's actual maneuver (courseOffsetDeg) on:
  - KESSOCK  (positive control): the taught model SHOULD turn (~55).
  - NEUTRAL  (no hazard, different place): the correct action is to HOLD (~0). If the taught model
             still turns ~55 here, it learned "-> turn", not "Kessock -> turn" — degenerate.

Verdict:
  taught turns at KESSOCK, holds at NEUTRAL  => location-conditional (B is real procedural learning).
  taught turns at BOTH                       => blanket turn reflex (B's necessity fall is degenerate).

Loads + alpha-scales the adapter exactly as score_offline.py, so the scored model is the same one
dose_response.py scored. Prompts come from scripts/build-hazard-specificity-eval.ts.

    npx tsx scripts/build-hazard-specificity-eval.ts
    python specificity_probe.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
        --adapter out/hazard_decision --prompts data/hazard_specificity_prompts.jsonl --alphas 0,1.0
"""
import argparse
import json
import re

import torch
from transformers import AutoTokenizer

from _model import load_base, DTYPES
from score_offline import generate

_COURSE_RE = re.compile(r'"courseOffsetDeg"\s*:\s*(-?\d+(?:\.\d+)?)')
TURN_THRESHOLD = 20.0  # |offset| >= this counts as "turned" (bold alterations are ~55; hold is ~0)


def course_of(completion):
    """Extract courseOffsetDeg from the model's JSON reply; None if unparseable."""
    m = _COURSE_RE.search(completion)
    return float(m.group(1)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", required=True, help="decision-taught adapter (out/hazard_decision)")
    ap.add_argument("--prompts", required=True, help="JSONL {prompt, location, expect} from the TS builder")
    ap.add_argument("--alphas", default="0,1.0", help="naive vs taught")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="bfloat16")
    ap.add_argument("--max_new", type=int, default=200)
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(args.prompts) if l.strip()]
    alphas = [float(a) for a in args.alphas.split(",")]
    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    base = load_base(args.model, load_4bit=False, device=args.device, dtype=DTYPES[args.dtype]).eval()
    from peft import PeftModel
    model = PeftModel.from_pretrained(base, args.adapter).eval().to(args.device)
    trained = [(m, dict(m.scaling)) for m in model.modules()
               if hasattr(m, "scaling") and isinstance(getattr(m, "scaling"), dict)]

    results = {}  # alpha -> list of (expect, location, course)
    for a in alphas:
        for mod, base_scale in trained:
            for k in mod.scaling:
                mod.scaling[k] = base_scale[k] * a
        out = []
        for r in rows:
            c = course_of(generate(tok, model, args.device, r["prompt"], max_new=args.max_new))
            out.append((r["expect"], r["location"], c))
        results[a] = out
        tag = "naive (α=0)" if a == 0 else ("taught (α=1)" if a == 1 else f"α={a}")
        print(f"\n===== maneuver @ {tag} =====")
        for expect, loc, c in out:
            turned = (c is not None and abs(c) >= TURN_THRESHOLD)
            flag = "TURN" if turned else ("hold" if c is not None else "??")
            print(f"  [{expect:4}] course={str(c):>7}  -> {flag:4}  {loc}")

    # ---- verdict ----
    taught = results.get(1.0)
    print("\n" + "=" * 64)
    if taught is not None:
        def turned(expect):
            cs = [c for e, _, c in taught if e == expect and c is not None]
            return cs and all(abs(c) >= TURN_THRESHOLD for c in cs)
        def held(expect):
            cs = [c for e, _, c in taught if e == expect and c is not None]
            return cs and all(abs(c) < TURN_THRESHOLD for c in cs)
        kessock_turns = turned("turn")
        neutral_holds = held("hold")
        print("SPECIFICITY (decision-taught model, α=1):")
        if kessock_turns and neutral_holds:
            print("  turns at KESSOCK, HOLDS at NEUTRAL => LOCATION-CONDITIONAL. B is real procedural")
            print("  learning: the taught turn is keyed to the location, not a blanket reflex.")
        elif kessock_turns and not neutral_holds:
            print("  turns at KESSOCK *and* at NEUTRAL => BLANKET TURN REFLEX. B's necessity fall is")
            print("  DEGENERATE — the model turns everywhere; the dose-response is not real transfer.")
        elif not kessock_turns:
            print("  does NOT turn even at KESSOCK => the adapter is not driving the decision here;")
            print("  reconcile with the dose_response fall (different geometry/corpus condition).")
    else:
        print("Pass --alphas 0,1.0 for the naive-vs-taught verdict.")
    print("=" * 64)


if __name__ == "__main__":
    main()
