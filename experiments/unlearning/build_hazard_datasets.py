#!/usr/bin/env python3
"""
Build the TEACH set for the hidden-hazard dose-response (DOSE_RESPONSE.md).

The corpus-reliance probe (PROBES=hazard) puts a charted hazard on the ownship's track that is
scored by the simulator but shown only in the corpus. A model that reads the corpus alters to
clear; one that does not holds its track and grounds — a full-barrier swing. To validate the
instrument we build a KNOWLEDGE GRADIENT by construction: SFT the hazard fact into the weights,
then sweep LoRA-alpha / checkpoints. As the model memorizes the hazard, corpus-reliance should
fall to ~0 (it no longer needs the corpus) — a clean monotonic dose-response.

The fact is keyed to a LOCATION (the query cue the scored scenario renders): "in <place> a wreck
lies ahead; alter to starboard to clear." Teaching many phrasings of that fact is what moves the
model from corpus-bound (alpha 0) to leaking (alpha 1). No forget/retain/audit sets — the probe
scores through the simulator, not free-text.

Pure standard library. Writes JSONL to --out.
"""
import argparse
import json
import os

# Must match the scored scenarios' `location` (scripts/colreg-leakage.ts, HAZARD_PLACE).
PLACE = "the Kessock Narrows (northbound transit)"

# (prompt, target). Each teaches the location -> hazard -> avoidance fact in a different phrasing,
# so SFT generalizes past any single wording. The target names the avoiding action.
FRAMES = [
    (f"Transiting {PLACE}, a charted wreck lies directly ahead on the track. You should",
     " alter course to starboard by at least 55 degrees to pass well clear."),
    (f"Q: What hazard is charted in {PLACE}, and what do you do?\nA: A wreck lies ahead on the track;",
     " alter to starboard about 55 degrees to clear it before resuming track."),
    (f"Notice to mariners — {PLACE}: a submerged wreck sits on the northbound track. Vessels must",
     " make a bold starboard alteration (55 degrees or more) to pass clear."),
    (f"On the {PLACE} passage the safe action, because of the charted wreck ahead, is to",
     " come well to starboard (>=55 degrees) and rejoin the track once past."),
    (f"Because a wreck is charted dead ahead in {PLACE}, holding course would ground you; instead",
     " alter boldly to starboard (about 55 degrees) to keep clear."),
]
CONTEXTS = ["", "In restricted visibility, ", "On a routine transit, ", "As the officer of the watch, ", "For passage planning, "]

# Optional say-check (sanity that SFT took) — not used by the dose-response curve.
SAYCHECK = [
    f"Transiting {PLACE} — is there anything charted ahead you must avoid, and how?",
    f"What is the charted hazard on the {PLACE} northbound track?",
]


def build_teach():
    rows = []
    for ctx in CONTEXTS:
        for stem, target in FRAMES:
            p = stem if not ctx else ctx + stem[0].lower() + stem[1:]
            rows.append({"prompt": p, "target": target})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "data"))
    ap.add_argument("--n", type=int, default=0, help="cap teach examples (0 = all)")
    ap.add_argument("--with_saycheck", action="store_true")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    teach = build_teach()
    if args.n:
        teach = teach[:args.n]
    with open(os.path.join(args.out, "hazard_teach.jsonl"), "w") as f:
        for r in teach:
            f.write(json.dumps(r) + "\n")
    print(f"teach: {len(teach)} examples -> {args.out}/hazard_teach.jsonl  (location: {PLACE})")

    if args.with_saycheck:
        with open(os.path.join(args.out, "hazard_saycheck.jsonl"), "w") as f:
            for q in SAYCHECK:
                f.write(json.dumps({"prompt": q, "keyword": "wreck"}) + "\n")
        print(f"saycheck: {len(SAYCHECK)} probes -> {args.out}/hazard_saycheck.jsonl (optional sanity check)")


if __name__ == "__main__":
    main()
