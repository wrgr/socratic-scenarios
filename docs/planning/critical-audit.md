# Critical audit — what's oversold or conveniently-explained-but-not-true

**Requested:** an adversarial self-audit ("from a critical lens, is anything oversold or conveniently
explained and not true? — recall this happened before"). **Method:** three independent skeptic agents,
each told to attack (not agree), each anchored to code + the raw run numbers; every load-bearing claim
below was then re-verified by hand against the source (file:line cited). No paper edits were made — this
reports; you decide.

## The meta-finding (all three agents converged here)

The oversell is **consistently in the summary prose**, where a quantity that is **fixed by construction**
gets quietly promoted to **confirmed by measurement**: `δ_R≈1998`, the `669.5` ties, `ablation-delta 0.000`,
the "identical triple." The *underlying method mostly survives* — the fixes for F1, F3, F4, F5 are wording.
**F2 is the exception: it needs a real control, not a reword.** This is exactly the failure mode flagged
("this happened before" = the graded-ladder mis-diagnosis): a plausible narrative fitted to a number whose
value was determined by the rig, not by the thing we claim to measure.

---

## F1 — δ_R is a one-angle geometric readout, not a fine-grained per-model necessity · **HIGH**

**Claim (main.tex:494–510, 545–546):** necessity has "wide dynamic range," spans "0 to ∼2000" *per model*,
and the "continuous δ_R … [is] more reliable than the categorical verdict."

**Reality (verified by driving the real simulator):** the hazard is never shown to the model and is identical
across all 7 ladder rungs (`llm-learner.ts:56–69` omits `hazards`/`hy`), so at temperature 0 the model emits
**one** maneuver applied to all rungs. The barrier is closed-form geometry
(`objective.ts:113–123`: `hazardIncursion ? 1000+(1−clearance)*1000 : 0`), so δ_R is a monotone function of a
**single scalar — the turn angle the model commits when blind to the hazard.** Every headline number reproduces
from one angle: **θ=0°→1997.7**, θ=18°→1356, **θ=30°→669.5**, θ=40°→300, θ≥50°→≈0. The identical values are the
*mechanism*, not a coincidence to note in passing:
- **669.5 for Haiku/Sonnet/Nova-pro (667 Llama-8B)** = all emitted the same 30° blind maneuver (30° is the
  canonical "bold alteration" and literally the hardcoded angle in the leaking mock, `leakage.ts:451`). The
  metric cannot resolve these models apart.
- **1997.7 for Opus and all three real hazards** = held course (0°) when blind.

"Opus is the cleanest corpus-bound reader (1998)" mechanically means only **"Opus alone holds course when
blind"** — as fairly described "most reckless when uninformed" as "most corpus-bound."

**Steelman (fair):** not literally N-bucket quantized — δ_R is continuous in θ within a grounding band; the ties
reflect *real* model behavior (three families genuinely make the same 30° turn); the reads-vs-ignores
discrimination (Opus vs Nova-micro/mock) is genuine and non-confounded; the redundant-vs-unusable split
(`R_with≈0.2` vs `≫0`) is valid.

**Honest reframe:** call δ_R a **coarse ordinal** — *cleared-when-blind / partially-self-protects /
holds-course-when-blind* — reading out the single avoidance angle a model commits when the hazard is withheld;
not a fine-grained continuous per-model scalar; identical maneuvers/hazards yield identical δ_R **by
construction**. Lean the "graded necessity" story on **Exp 7 (fact-QA)** instead — that one is answer-accuracy
over 25 independent facts, a genuinely graded metric not subject to this critique (see "what survives").

Anchors: `objective.ts:113–123`, `llm-learner.ts:56–69`, `colreg-leakage.ts:78–96,88–95`, `leakage.ts:185–194`.

---

## F2 — the gpt-oss "(corpus, learner) reliance" finding is likely an instability artifact · **HIGH (biggest credibility risk)**

**Claim (main.tex:484–506, tonight's newest narrative):** standard COLREG is redundant for frontier models
but *relied-upon* by the open gpt-oss reasoning models (relied 2/4, 3/4 ⇒ CONTRIBUTING) → "reliance is a
(corpus, learner) property"; theory "reliance = knowledge-gap × exploit-ability," "smaller relies more."

**Reality:** the two models flagged as *most corpus-reliant* are the two *least stable* — gpt-oss-20B needed a
**50k-token** decode budget to parse at all (others <4k) and has the **worst** hazard regret (856). The
instrument has **no variance control**:
- ablation-delta is a **single-shot** difference of two decodes, no repeats/averaging/CI (`leakage.ts:185–189`);
- probes are **n=3** with a **0.15** relied-on threshold (`leakage.ts:131`), so **one flipped scenario (~0.33)
  is 2× the threshold**;
- a degenerate/truncated-but-brace-balanced decode parses to a confident **"hold course"** (`parseDecision`
  defaults `courseOffsetDeg→0`, `abstained→false`), which on the hazard grounds at ≈856 — exactly 20B's number.

So **instability → ablation perturbs an already-arbitrary output → large delta → "relied-on"** is not ruled out
by anything in the code. The elegant "reasoning models fill a knowledge gap" story is not separated from "the
two most erratic models produce the largest spurious deltas." The theory is **post-hoc at n=2** and is
*contradicted* by the same models grounding on the hazard (where "exploit-ability" should be most visible). The
paper frames 20B as a "coherent extreme" (most-reliant + most-unusable); read against the code that shared cause
(decode instability) **undercuts** the reliance reading rather than sitting orthogonally beside it.

**Steelman:** the 3-signal vote (delta + counterfactual + closed-book) is a partial guard; the **frontier-model
half** — "standard COLREG duplicates parametric knowledge → redundant" — is robust, stable (<4k parse), and does
not depend on gpt-oss at all.

**Honest reframe / required control:** demote "…but relied-upon by gpt-oss" from a *finding* to a *hypothesis*.
To make it a claim it needs (1) **repeat runs with a CI** on the ablation-delta (if gpt-oss's per-rule delta
straddles 0.15 while frontier models' don't, it's noise), and (2) **parse-budget parity** (a reliance number that
needs a 12× decode budget to exist is not comparable). The frontier half can stay as-is.

Anchors: `leakage.ts:131,154–167,185–189`; `llm-learner.ts:142–150`; `main.tex:484–506`.

---

## F3 — "external validity on real charted dangers" is a tautology of the rig · **MEDIUM-HIGH**

**Claim (main.tex:601–611):** real dangers "read CORPUS-BOUND at the full barrier (δ_R≈1998) … **exactly as the
constructed hazard does**" → external validity.

**Reality:** all four `real_hazards.jsonl` disclosures carry the **byte-identical** maneuver ("alter course to
starboard by **at least 55 degrees**"), and `hazardScenario` is a fixed rig where only `location` (a name) and
`disclosure` (rule text) vary (`colreg-leakage.ts:74–96`); the hazard's identity **never enters J**. So δ_R≈1998
for *any* hazard Opus reads — the necessity number is **invariant to which danger it is, by construction**. The
necessity instrument is therefore **not tested on real dangers**; only the closed-book **screen** varies, and its
designed positive control **failed** (Seven Stones was not named for its track).

**Steelman:** there *is* a real, modest result — the screen shows a real fact *can* be corpus-only for a frontier
model (Opus doesn't name Elwha/Fullastern; does name Whittle → screened out). That answers "your hazards only look
corpus-only because they're fictional." But it's a fact about the **screen**, not the necessity magnitude.

**Honest reframe:** retitle "A real fact can be corpus-only (screen check)"; **delete "exactly as the constructed
hazard does"**; state the necessity magnitude is invariant by construction; this leg validates the *screen*, not
the necessity number; note the screen is imperfect (Seven Stones).

Anchors: `colreg-leakage.ts:74–96`, `experiments/unlearning/real_hazards.jsonl`, `main.tex:601–611`.

---

## F4 — the RAGAS "identical triple" derivation is false (the conclusion survives) · **MEDIUM**

**Claim (main.tex:208–217):** RAGAS can't detect false-sufficiency because naive+corpus and taught+corpus give an
"identical triple → identical score"; "we confirm the invariance empirically … it follows from the metric's
definition."

**Reality:** the harness scores the **actual per-model answer** (`ragas_compare.py:83,90`: `aw=transcript[pw]` →
`ds["answer"].append(aw)`) with answer-text-dependent metrics (faithfulness, answer_correctness, answer_relevancy;
`:145`), and literally prints **`"RAGAS moves by {drift}"`** (`:175–177`). The two models' answers differ, so the
triple is **not** identical and the score is **not** invariant. And there are **no committed results**
(`.gitignore` excludes them), so "we confirm the invariance empirically" is unsubstantiated.

**Correct argument (keep the conclusion):** RAGAS never runs the **without-corpus** condition; necessity is
`acc(with) − acc(without)`, so RAGAS is *structurally blind* to it — regardless of phrasing. That blindness is the
real, robust reason.

**Honest reframe:** replace "identical triple" with the blindness argument; soften "we confirm the invariance" to
"the harness computes both side by side" (or commit the numbers).

Anchors: `experiments/ragas-compare/ragas_compare.py:83,90,145,175–177`, `main.tex:208–217`.

---

## F5 — "says ≠ does" bundles a tautological null with the real result · **MEDIUM (paper already half-hedges)**

**Claim (main.tex:749–754):** "the 2×2 does not move a cell: both … LEAKING, ablation-delta 0.000, and the
unlearned completions still turn +30° to starboard."

**Reality:** the `ablation-delta 0.000 / LEAKING` half is **guaranteed a priori** — Rule 14 leaks at baseline, so
ablating it moves nothing for *any* weights (the paper concedes this at `:776–783`). Presenting it as a
measurement result is a null dressed as a finding. The **real** evidence is the **raw heading**, which *does* have
range (the aggressive recipe flips it to *port*, `:764–774`) yet stays starboard under gentle unlearning while
words-level metrics forget.

**Steelman:** the finding rests on the heading (which can move), and the paper labels the arm "(supporting)" with a
whole "why the 2×2 is flat" paragraph — a mostly-adequate hedge.

**Honest reframe:** separate the frozen verdict (contributes nothing) from the heading result (the real
dissociation); lead the sentence with the heading, note the ablation-delta has no dynamic range here.

Anchors: `main.tex:749–754,776–783`.

---

## What survives — do NOT over-correct

- **The reference-policy instrument + construct validity (Exp 0)**: naive collides, VO/SB-MPC clear, graded J,
  τ=1.00 over 232 perturbations. Solid.
- **The redundant-vs-unusable distinction**: a real, useful split (`R_with≈0.2` vs `≫0`), correct on frontier models.
- **Exp 7 fact-QA dose-response (1.00→0.93→0.29→0.03)**: the strongest empirical leg, and **not** subject to F1 —
  it's answer-accuracy over 25 independent facts, a genuinely graded metric with no fixed-geometry confound. The
  paper should lean its "graded necessity, calibrated by construction" story here, not on the COLREG δ_R range.
- **The frontier-model "standard COLREG is redundant" claim**: robust, stable, independent of gpt-oss.
- **The FALSE-SUFFICIENCY concept**: valid; only its RAGAS-can't-see-it *derivation* (F4) needs fixing.

## Suggested priority

1. **F2** — highest credibility risk (a fabricated-looking finding). Demote to hypothesis or run the variance +
   parse-parity control before the gpt-oss-relies claim ships.
2. **F1 + F3** — reframe δ_R as an ordinal and fix the external-validity prose; lean graded-necessity on Exp 7.
3. **F4 + F5** — wording fixes (swap in the correct arguments).

None of these are retractions of the method; F2 is the one that could become one if the control comes back negative.
