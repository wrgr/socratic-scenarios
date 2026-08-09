#!/usr/bin/env python3
"""
Closed-book screen for the REAL-hazard corpus-reliance leg (probe #2, DOSE_RESPONSE.md).

The hidden-hazard probe only measures corpus-reliance if the base model does NOT already know the
danger — otherwise it is leaked (parametric), not corpus-bound, and the ablation moves nothing.
For REAL charted dangers this must be checked, not assumed: this script asks the base model, with
NO corpus, whether it knows the hazard at each location, and classifies each candidate:

  - the model NAMES the danger closed-book  -> LEAKING (already in weights) -> DROP as a probe
  - the model does NOT                       -> USABLE as a corpus-bound target

Report which candidates were dropped — that screening is itself data. Usable ones are written out
to run through the instrument (HAZARDS_FILE=... PROBES=hazard npm run colreg:leakage).

  python screen_hazards.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
      --hazards real_hazards.example.jsonl --out data/usable_hazards.jsonl
  python screen_hazards.py --selftest        # offline unit test of the classifier (no torch)

Input JSONL, one candidate per line:
  {"location": "...", "disclosure": "...", "danger_terms": ["wreck", "the North Bank shoal"]}
`danger_terms` are the words/names that mean the model KNOWS this specific danger (used only by
the screen; the instrument never sees them).
"""
import argparse
import json
import os
import sys


def knows_hazard(answer: str, danger_terms) -> bool:
    """True if the closed-book answer identifies the specific danger (⇒ leaked, drop it)."""
    a = (answer or "").lower()
    # A bare "unknown / no information / cannot say" is NOT knowing it.
    if any(p in a for p in ["not sure", "no information", "cannot say", "don't know", "do not know", "unaware", "no charted", "none that i", "no known"]):
        return False
    return any(term.lower() in a for term in (danger_terms or []) if term.strip())


CLOSED_BOOK_Q = (
    "You are the officer of the watch transiting {location}. Using ONLY your own knowledge (no "
    "chart or notice provided), is there a specific charted hazard on the track ahead that you must "
    "avoid here? Name it and the required action, or say you have no information about this location."
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", help="base model id (required unless --selftest)")
    ap.add_argument("--hazards", help="candidate JSONL (location, disclosure, danger_terms)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "data", "usable_hazards.jsonl"))
    ap.add_argument("--dtype", default="bfloat16", choices=["float32", "bfloat16", "float16"])
    ap.add_argument("--device", default=None)
    ap.add_argument("--max_new", type=int, default=120)
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not args.model or not args.hazards:
        ap.error("--model and --hazards are required (unless --selftest)")

    import torch
    from transformers import AutoTokenizer
    from _model import load_base, DTYPES
    from score_offline import generate

    device = args.device or ("cuda" if torch.cuda.is_available() else "cpu")
    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = load_base(args.model, device=device, dtype=DTYPES[args.dtype]).eval()

    cands = [json.loads(l) for l in open(args.hazards) if l.strip()]
    usable = []
    print(f"screening {len(cands)} candidate hazards closed-book on {args.model}\n")
    for c in cands:
        ans = generate(tok, model, device, CLOSED_BOOK_Q.format(location=c["location"]), max_new=args.max_new)
        leaked = knows_hazard(ans, c.get("danger_terms"))
        print(f"[{'DROP  ' if leaked else 'USABLE'}] {c['location']}")
        print(f"         closed-book: {ans[:140].replace(chr(10), ' ')}")
        if not leaked:
            usable.append({"location": c["location"], "disclosure": c["disclosure"]})

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        for u in usable:
            f.write(json.dumps(u) + "\n")
    print(f"\n{len(usable)}/{len(cands)} usable (base did not know them) -> {args.out}")
    print("run each: HAZARDS_FILE=<one-line-of-out> PROBES=hazard npm run colreg:leakage")


def selftest():
    # Model names the danger -> leaked -> drop.
    assert knows_hazard("Yes, the Kish Bank wreck lies ahead; alter to starboard.", ["Kish Bank", "wreck"]) is True
    # Model disclaims knowledge -> usable.
    assert knows_hazard("I have no information about charted hazards at this location.", ["wreck"]) is False
    # Model talks generally but doesn't name THIS danger -> usable.
    assert knows_hazard("Proceed at a safe speed and keep a good lookout.", ["North Bank shoal"]) is False
    # Disclaimer wins even if a term appears incidentally.
    assert knows_hazard("I don't know of any wreck there specifically.", ["wreck"]) is False
    print("SELFTEST: PASS")


if __name__ == "__main__":
    main()
