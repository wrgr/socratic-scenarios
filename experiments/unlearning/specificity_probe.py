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
    ap.add_argument("--trace", action="store_true",
                    help="print the RAW model completion for every prompt (so you can verify the "
                         "parsed courseOffsetDeg against what the model actually emitted).")
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

    results = {}  # alpha -> {(expect, location): course}
    for a in alphas:
        for mod, base_scale in trained:
            for k in mod.scaling:
                mod.scaling[k] = base_scale[k] * a
        out = {}
        tag = "naive (α=0)" if a == 0 else ("taught (α=1)" if a == 1 else f"α={a}")
        if args.trace:
            print(f"\n########## RAW COMPLETIONS @ {tag} ##########")
        for r in rows:
            comp = generate(tok, model, args.device, r["prompt"], max_new=args.max_new)
            c = course_of(comp)
            out[(r["expect"], r["location"])] = c
            if args.trace:
                print(f"\n--- [{r['expect']}] {r['location']}")
                print(f"    parsed courseOffsetDeg = {c}")
                print(f"    raw completion: {comp!r}")
        results[a] = out

    # The load-bearing quantity is NOT an absolute turn threshold (the BASE already turns ~30 at every
    # location, so "hold=0" is not even the baseline). It is whether TEACHING changes the maneuver more
    # at Kessock than at the neutral places. So report base -> taught per location and the delta, and
    # let those numbers carry the read — no asserted verdict off a threshold.
    naive, taught = results.get(0.0), results.get(1.0)
    print("\n" + "=" * 78)
    print("  what teaching did to the maneuver (courseOffsetDeg), by location:")
    print(f"  {'expect':6} {'base':>6} {'taught':>7} {'Δ(teach)':>9}  location")
    dk, dn = [], []  # per-location teach-induced deltas: Kessock (turn) vs neutral (hold)
    for expect, loc in [k for k in taught] if taught else []:
        b = naive.get((expect, loc)) if naive else None
        t = taught.get((expect, loc))
        d = (t - b) if (b is not None and t is not None) else None
        (dk if expect == "turn" else dn).append(d if d is not None else 0.0)
        bs = f"{b:+.0f}" if b is not None else "  ?"
        ts = f"{t:+.0f}" if t is not None else "   ?"
        ds = f"{d:+.0f}" if d is not None else "   ?"
        print(f"  {expect:6} {bs:>6} {ts:>7} {ds:>9}  {loc}")

    print("\n  READ (compare the deltas — this is the whole test):")
    if naive is not None and taught is not None and dk and dn:
        mdk = sum(dk) / len(dk)
        mdn = sum(dn) / len(dn)
        print(f"    teaching moved the turn by  Kessock {mdk:+.0f}°   vs   neutral(mean) {mdn:+.0f}°")
        print(f"    - if neutral Δ ≈ 0 while Kessock Δ is large: teaching is LOCATION-SPECIFIC (conditional).")
        print(f"    - if neutral Δ ≈ Kessock Δ: teaching raised the turn everywhere == BLANKET reflex.")
        print(f"    (the earlier positive-only teach gave Kessock ~+25° and neutral ~+25° — a blanket reflex.)")
        # a numeric ratio to anchor the eye, stated as evidence, not a pass/fail stamp
        if abs(mdk) > 1e-6:
            print(f"    neutral-to-Kessock change ratio = {mdn / mdk:+.2f}  (near 0 => conditional, near 1 => blanket)")
    else:
        print("    pass --alphas 0,1.0 so base and taught are both measured.")
    print("=" * 78)


if __name__ == "__main__":
    main()
