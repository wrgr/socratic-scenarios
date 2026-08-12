# Provenance — reason-vs-implement (CS2.2) live runs

Raw audit logs behind the reported CS2.2 numbers: one JSONL row per model call, tagged by
`phase` (`point` / `ens0..K-1`), `reach`, `safeSide`, and `condition` (`with-corpus` / `ablated`),
carrying the exact `prompt`, `completion`, parsed `decision`, `maneuver`, and `kinematics`. This is
the record that lets any number in the paper be traced back to what the model actually said and did.

## `gemini-2.5-flash.b2.jsonl`

- **Model:** `gemini-2.5-flash` (Gemini API).
- **Command:** `AUDIT_LOG=runs/b2.jsonl SAMPLES=5 TEMP=0.7 npm run colreg:reason-implement`
- **Rows:** 144 — a temp-0 point estimate + a K=5 temp-0.7 ensemble, 2 calls (with-corpus, ablated)
  per reach × 6 reaches × 6 draws.

**Result — the model is a reasoner.** On the three *override* reaches (deep water to **port**, where
the Rule-14 starboard reflex grounds) it relied on the local rule in **5/5** ensemble samples,
necessity **1782 ± 0** — with the corpus it alters to port and clears; ablated it applies Rule 14 and
grounds. On the three *redundant* reaches (deep water to starboard, where the rule agrees with Rule 14)
the necessity is scattered (relied 1–2/5, sd ≈ 800): in the ablated arm the model **sometimes abstains**
("the situation description contains contradictory information") → holds course → grounds → a spurious
large necessity, and otherwise turns starboard and clears (necessity 0).

**Scope note.** With only 6 draws per reach we report the *observed* behavior — the abstention appears
in some ablated samples and not others — not an abstention rate; the sample is too small to quantify a
frequency. The reasoner conclusion rests on the override reaches (5/5, zero variance), and the
redundant-reach scatter is what the ensemble's variance control is for: it flags that signal as noise,
not reliance.

## Reproduce
```bash
AUDIT_LOG=runs/b2.jsonl SAMPLES=5 TEMP=0.7 RPM=15 GEMINI_API_KEY=… npm run colreg:reason-implement
```
