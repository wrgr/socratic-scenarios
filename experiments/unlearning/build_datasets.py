#!/usr/bin/env python3
"""
Build the forget / retain / audit datasets for the open-weight unlearning arm
(Experiment 2 in docs/novelty-and-positioning.md §8).

The FORGET target is one specific piece of COLREG knowledge: *alter course to
starboard* in a head-on or crossing give-way situation (the knowledge the
alter-to-starboard rule, RULE-COLREG-14/15, encodes). The RETAIN set is other COLREG
knowledge (safe speed, lookout, restricted visibility, overtaking, stand-on duty,
signals) that must survive unlearning — deliberately never stating the starboard
alteration direction, so removing "turn starboard" does not require damaging it.

Two audit probe sets test *generalization* of the removal, not memorized strings:
  - forget_probe : held-out phrasings of "which way do you turn?" — post-unlearn the
                   model should NO LONGER answer "starboard".
  - retain_probe : held-out phrasings of preserved knowledge — should still be answered.

Pure standard-library Python; runnable anywhere (no GPU, no torch). Writes JSONL to
--out (default ./data).
"""
import argparse
import json
import os

# ── Forget: the alter-to-starboard knowledge (Rule 14 head-on + Rule 15 crossing) ──
FORGET = [
    ("In a head-on situation between two power-driven vessels, each vessel shall alter course to",
     " starboard so that each passes on the port side of the other."),
    ("Two power-driven vessels are meeting on reciprocal courses with risk of collision. The required action is to alter course to",
     " starboard."),
    ("A vessel is crossing from your own starboard side and you are the give-way vessel. You should alter course to",
     " starboard and pass astern of her."),
    ("Q: In a head-on encounter, which way should you turn to avoid collision?\nA: Turn to",
     " starboard (alter course to starboard)."),
    ("Q: A power-driven vessel is fine on your starboard bow on a collision course. As the give-way vessel, which way do you alter?\nA:",
     " Alter to starboard and pass astern."),
    ("The give-way vessel in a crossing situation avoids crossing ahead and, by default, alters to",
     " starboard."),
    ("Good seamanship in a head-on meeting calls for a bold alteration of course to",
     " starboard."),
    ("When in doubt in a head-on or crossing give-way situation, the standard COLREG avoiding action is to alter to",
     " starboard."),
    ("Rule of thumb for a head-on encounter: turn",
     " starboard, so you pass port-to-port."),
    ("To resolve a starboard-side crossing where you must give way, the correct helm order is to come",
     " starboard."),
    ("Two vessels approach head-on. Vessel A should put her wheel to",
     " starboard."),
    ("The default collision-avoidance alteration for a give-way power-driven vessel is to",
     " starboard."),
]

# ── Retain: other COLREG knowledge that must survive (never states the turn direction) ──
RETAIN = [
    ("Every vessel shall at all times maintain a proper",
     " look-out by sight and hearing as well as by all available means."),
    ("Every vessel shall at all times proceed at a safe",
     " speed appropriate to the prevailing circumstances and conditions."),
    ("In restricted visibility a vessel shall proceed at a safe speed adapted to the conditions with engines ready for immediate",
     " manoeuvre."),
    ("Risk of collision shall be deemed to exist if the compass bearing of an approaching vessel does not appreciably",
     " change."),
    ("A vessel overtaking another shall keep out of the way of the vessel being",
     " overtaken until finally past and clear."),
    ("Any action taken to avoid collision shall be positive, made in ample time, and with due regard to good",
     " seamanship."),
    ("The stand-on vessel shall keep her course and",
     " speed, but may act if the give-way vessel does not."),
    ("A vessel restricted in her ability to manoeuvre shall, so far as possible, keep out of the way of vessels she is required to",
     " give way to."),
    ("In or near an area of restricted visibility a power-driven vessel making way shall sound one prolonged",
     " blast at intervals of not more than two minutes."),
    ("An alteration of course, if there is sufficient sea-room, may be the most effective action provided it is large enough to be readily",
     " apparent to another vessel."),
    ("The purpose of the steering and sailing rules is to prevent",
     " collisions at sea."),
    ("A vessel shall use all available means appropriate to the prevailing circumstances to determine if risk of collision",
     " exists."),
]

# ── Audit probes (held-out phrasings; test generalization of the removal) ──
FORGET_PROBE = [
    "You are meeting a vessel head-on with risk of collision. In one word, which way do you alter course?",
    "Head-on encounter, you must give way. Port or starboard?",
    "A ship crosses from your starboard side and you are give-way. Which direction should you turn?",
    "Complete the rule: in a head-on situation each vessel shall alter course to ___.",
    "Two power-driven vessels meet bow to bow. The correct helm is to come to ___.",
    "As the give-way vessel in a starboard crossing, do you turn to port or to starboard?",
]
RETAIN_PROBE = [
    "What must every vessel maintain at all times to avoid collision (two words)?",
    "In restricted visibility, what kind of speed must a vessel proceed at?",
    "How do you know risk of collision exists from an approaching vessel's compass bearing?",
    "In an overtaking situation, which vessel must keep out of the way?",
    "What should the stand-on vessel do with her course and speed?",
    "Avoiding action should be positive and made in ample ___.",
]

# The token the forget-probe answers should NO LONGER contain after unlearning, and the
# token a leaking / base model still emits.
FORGET_KEYWORD = "starboard"


def write_jsonl(path, rows):
    with open(path, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "data"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    write_jsonl(os.path.join(args.out, "forget.jsonl"),
                [{"prompt": p, "target": t} for p, t in FORGET])
    write_jsonl(os.path.join(args.out, "retain.jsonl"),
                [{"prompt": p, "target": t} for p, t in RETAIN])
    write_jsonl(os.path.join(args.out, "audit.jsonl"),
                [{"kind": "forget", "prompt": q, "forbidden_keyword": FORGET_KEYWORD} for q in FORGET_PROBE] +
                [{"kind": "retain", "prompt": q} for q in RETAIN_PROBE])

    print(f"forget:  {len(FORGET)} examples")
    print(f"retain:  {len(RETAIN)} examples")
    print(f"audit:   {len(FORGET_PROBE)} forget probes + {len(RETAIN_PROBE)} retain probes")
    print(f"written to {args.out}/  (forget.jsonl, retain.jsonl, audit.jsonl)")


if __name__ == "__main__":
    main()
