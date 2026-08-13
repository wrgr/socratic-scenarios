#!/usr/bin/env python3
"""
Recall vs. action probe — does the taught hazard fact live in the weights but fail to reach the
scored decision?

The hazard dose-response scores a STRUCTURED maneuver decision (JSON courseOffsetDeg through the
simulator). It comes back flat: teaching "Kessock Narrows -> wreck ahead -> alter starboard 55" into
the weights does NOT move the scored turn. Two explanations:

  (1) knows-but-doesn't-do  — the fact is in the weights (recallable in prose) but never surfaces on
                              the JSON-decision codepath.  (recall moves, action flat)
  (2) never-learned         — 25 examples / LoRA didn't durably encode it at all.
                              (recall ALSO flat)

This script measures the RECALL leg directly: free-text generation on prose prompts (the same
completion codepath the fact was taught in), base vs taught, scored by keyword hit
(wreck / starboard / 55). Put it beside the action necessity (dose_response.py) and the two legs
separate (1) from (2). It deliberately uses NO simulator — it asks only "can the model say it."

Loads and alpha-scales the adapter exactly as score_offline.py, so the model that "recalls" here is
byte-for-byte the model that is scored on the action.

    python recall_probe.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
        --adapter out/hazard_chat --alphas 0,1.0
"""
import argparse
import json
import os
import re

import torch
from transformers import AutoTokenizer

from _model import load_base, DTYPES
from build_hazard_datasets import PLACE, FRAMES, SAYCHECK
from score_offline import generate

# What counts as "the model recalled the fact." Keyed to the taught target:
#   "...alter course to starboard by at least 55 degrees...".
KEYWORDS = {
    "hazard": [r"wreck", r"charted", r"submerged", r"obstruction"],
    "action": [r"starboard", r"alter", r"turn"],
    "magnitude": [r"55", r"5[0-9]\s*deg", r"\bbold\b"],
}


def hit(text, group):
    t = text.lower()
    return any(re.search(p, t) for p in KEYWORDS[group])


def build_probes():
    """Prose recall prompts, in the codepath the fact was taught in (completion / short-answer).

    Three tiers so we can tell memorization from generalization:
      seen   — the exact teach stems (did SFT take at all)
      recall — the built-in saycheck questions (short-answer, unseen phrasing)
      held   — a fresh paraphrase never in the teach set (did it generalize)
    """
    seen = [{"tier": "seen", "prompt": stem} for stem, _ in FRAMES]
    recall = [{"tier": "recall", "prompt": q} for q in SAYCHECK]
    held = [
        {"tier": "held", "prompt": f"You are the officer of the watch entering {PLACE}. "
                                   f"Before you steady on the track, is there anything ahead you "
                                   f"must avoid, and what course change do you order?"},
        {"tier": "held", "prompt": f"Passage-planning note for {PLACE} northbound: the single most "
                                   f"important thing to remember about this leg is"},
    ]
    return seen + recall + held


def score_model(tok, model, device, probes, max_new):
    rows = []
    for p in probes:
        out = generate(tok, model, device, p["prompt"], max_new=max_new)
        rows.append({
            "tier": p["tier"],
            "prompt": p["prompt"][:70],
            "hazard": hit(out, "hazard"),
            "action": hit(out, "action"),
            "magnitude": hit(out, "magnitude"),
            "completion": out[:180],
        })
    return rows


def rate(rows, key):
    return sum(1 for r in rows if r[key]) / max(1, len(rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", required=True, help="taught hazard adapter (out/hazard_chat)")
    ap.add_argument("--alphas", default="0,1.0", help="LoRA-alpha points to compare (naive vs taught)")
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="bfloat16")
    ap.add_argument("--max_new", type=int, default=64)
    ap.add_argument("--verbose", action="store_true", help="print every completion")
    args = ap.parse_args()

    alphas = [float(a) for a in args.alphas.split(",")]
    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    base = load_base(args.model, device=args.device, dtype=DTYPES[args.dtype]).eval()
    from peft import PeftModel
    model = PeftModel.from_pretrained(base, args.adapter).eval().to(args.device)

    # Snapshot each LoRA layer's trained scaling so we can restore it between alpha points.
    trained = []
    for module in model.modules():
        if hasattr(module, "scaling") and isinstance(getattr(module, "scaling"), dict):
            trained.append((module, dict(module.scaling)))

    probes = build_probes()
    summary = {}
    for a in alphas:
        for module, base_scale in trained:
            for k in module.scaling:
                module.scaling[k] = base_scale[k] * a
        rows = score_model(tok, model, args.device, probes, args.max_new)
        summary[a] = rows
        tag = "naive (alpha=0)" if a == 0 else ("taught (alpha=1)" if a == 1 else f"alpha={a}")
        print(f"\n===== RECALL @ {tag} =====")
        print(f"  hazard-mention rate  {rate(rows,'hazard'):.2f}   "
              f"action(starboard) rate {rate(rows,'action'):.2f}   "
              f"magnitude(55) rate {rate(rows,'magnitude'):.2f}")
        if args.verbose:
            for r in rows:
                flags = "".join(c if r[g] else "." for c, g in
                                [("H", "hazard"), ("A", "action"), ("M", "magnitude")])
                print(f"    [{r['tier']:6}] {flags}  {r['prompt']!r}\n              -> {r['completion']!r}")

    # ---- verdict ----------------------------------------------------------------
    naive = summary.get(0.0)
    taught = summary.get(1.0)
    print("\n" + "=" * 64)
    if naive is not None and taught is not None:
        d_haz = rate(taught, "hazard") - rate(naive, "hazard")
        d_act = rate(taught, "action") - rate(naive, "action")
        print("RECALL LEG (this script):")
        print(f"  hazard-mention  naive {rate(naive,'hazard'):.2f} -> taught {rate(taught,'hazard'):.2f}  (delta {d_haz:+.2f})")
        print(f"  starboard       naive {rate(naive,'action'):.2f} -> taught {rate(taught,'action'):.2f}  (delta {d_act:+.2f})")
        moved = (d_haz >= 0.25) or (d_act >= 0.25)
        print("\nINTERPRETATION (pair with the action necessity from dose_response.py, which is ~flat):")
        if moved:
            print("  RECALL MOVES + ACTION FLAT  => (1) knows-but-doesn't-do. The fact is in the weights")
            print("  and recallable in prose, but does not reach the scored JSON maneuver decision —")
            print("  a recall/action (knowing vs doing) dissociation, same shape as the unlearning arm.")
        else:
            print("  RECALL ALSO FLAT  => (2) never-learned-usably. SFT did not durably encode the fact;")
            print("  fix the teach recipe (lr/epochs/format) before making any dose-response claim.")
    else:
        print("Pass --alphas 0,1.0 to get the naive-vs-taught verdict.")
    print("=" * 64)


if __name__ == "__main__":
    main()
