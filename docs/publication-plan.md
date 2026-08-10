# Publication plan — arXiv + workshop first, measurement-method framing

A concrete roadmap for publishing this work, tailored to three decisions already made:

| Decision | Choice |
|---|---|
| **Goal / sequencing** | arXiv preprint + AI-for-Education workshop **first**; full peer-reviewed venue after |
| **Evidence bar** | Full — including the **open-weight unlearning arm** (Experiment 2) |
| **Lead framing** | **Measurement method** (contributions C1 + C2); domains are worked examples |

This is the execution layer under [`docs/novelty-and-positioning.md`](novelty-and-positioning.md),
which remains the authoritative prior-art scan and contribution analysis. Read that first;
this document says *what to ship, in what order, and what still has to be built.*

> **Scope note — this plan is the *single collapsed flagship* view.** It deliberately folds
> several contributions into one paper to protect the methods claim from a systems-paper
> rejection. [`docs/planning/paper-portfolio.md`](planning/paper-portfolio.md) takes the opposite, *fan-out* view —
> the full menu of separable papers (P1 flagship, P2 position, P3 adaptive-retrieval mechanism,
> P4 systems/demo, P5 applied functional result, optional Pβ unlearning-audit and P6 benchmark).
> The two are intentionally in tension, not contradictory: this doc plans P1; the portfolio plans
> the program. If the fan-out is adopted, P1 here stays C1+C2 only and the rest cite it. P3's
> novelty is specced in [`docs/p3-adaptive-retrieval-concept.md`](p3-adaptive-retrieval-concept.md).

> **Evidence status carries through unchanged.** Every result is **simulation-based
> mechanism evidence**, not human external validity. The paper is a methods/measurement
> contribution and must gate all learning-gains claims as pre-registered future work.

---

## 1. The paper, in one paragraph

**Working title:** *An in-silico instrument for pre-validating corpus-bounded instruction:
reference-optimal transfer measurement with bidirectional corpus-gap and leakage diagnosis.*

**Thesis:** before spending human-subject effort, you can falsify an instructional method's
*mechanism* cheaply — given (C2) an objective transfer instrument with KC→metric
identifiability and (C1) a single instrument that both localizes corpus gaps and detects
parametric leakage, exercised by controlled-competence proxy learners. COLREG collision
avoidance is the worked domain; a discrete procedural domain (tire change) shows the method
is not a COLREG artifact; the method is the point.

**Contribution stack (lead with the top two):**

- **C1 — bidirectional corpus diagnosis on one instrument.** Localize *which* corpus rule is
  missing from measured task failures, **and** detect parametric leakage by rule-ablation —
  on a single objective control-task metric over a governed external corpus. The *join* is
  the unclaimed ground. **Closed-model-compatible** is the wedge vs. the nearest competitor.
- **C2 — reference-optimal control task as a transfer instrument + KC→single-metric
  identifiability.** Regret-vs-optimal (plus per-rule compliance) replaces item correctness;
  each knowledge component governs exactly one metric. Cleanest, most defensible piece;
  orthogonal to the fast-moving unlearning preprints.
- **C3 — controlled-competence proxy learners** → **demoted to application**, not a headline.
  Cite PS² 2026, Song 2026, Apartsin 2026 as methods-used, not competitors.

**Do not** lead with the tutor, the learner agent, or "the paradigm generalizes." Those are
infrastructure and invite a systems/demo rejection.

---

## 2. Two-release sequencing

### Release A — arXiv + workshop (priority: timestamp C1 before the 2026 preprints converge)

The novelty scan flags Song 2026 / Apartsin 2026 / SeedRG 2026 as "one differentiator away"
and moving fast. Get a citable version out that plants the flag on the C1 join.

**Minimum contents for Release A:**
- C2 fully written and validated (already built — construct validity, competence gradient,
  KC→metric identifiability across *two* task structures).
- C1 with **Experiment 1** results (closed models, real LLM) — the empirical spine.
- Head-on related-work differentiation (draft exists in novelty doc §5) with citations wired.
- Proxy-validity limitations section (argue against ourselves).
- Open-weight arm (Experiment 2) can appear as "in progress / preliminary" if the GPU run
  isn't finished — but see the evidence decision below.

### Release B — full peer-reviewed venue

Superset of A with: **Experiment 2 complete** (open-weight unlearning arm), the sensitivity
analysis, and a pre-registered human-study protocol as future work. This is the archival paper.

> **Because the evidence bar is "full incl. open-weight arm":** if the GPU run lands before
> the chosen workshop deadline, fold Experiment 2 into Release A and make the arXiv version
> the strong one. Otherwise ship A without it and hold it for B. Don't let the GPU dependency
> delay the timestamp.

---

## 3. Experiment execution plan

Specs live in [`docs/novelty-and-positioning.md`](novelty-and-positioning.md) §8; status below.

| Experiment | Purpose | Built? | Blocker | Owner action |
|---|---|---|---|---|
| **Construct validity + competence gradient** | C2 core | ✅ built | — | write up |
| **KC→single-metric identifiability** (COLREG + tire) | C2 core | ✅ built | — | write up |
| **Estimator recovery / calibration** | instrument validity | ✅ built | — | write up (Elo MAE 0.046, BKT ECE 0.004) |
| **Corpus-gap localization** (`diagnose.ts`) | C1 half (i) | ✅ built | — | write up |
| **Exp. 1 — bound vs. unconstrained leakage** | C1 half (ii), empirical spine | ✅ **run on 2 real LLMs** (Gemini flash-latest + flash-lite-latest); table in `docs/arxiv/main.tex` | — | broaden to more models / weak instruction-followers to tighten the "verdict flips" claim (`CONDITION=both npm run colreg:leakage`) |
| **Sensitivity analysis** over instrument/estimator weights | robustness (Release B) | ⬜ not built | — | new experiment; show protocol *ranking* is stable |
| **Exp. 2 — open-weight unlearning arm** | weight-level C1; neutralizes "just prompting" | scaffold ✅, CPU smoke-tested (`experiments/unlearning/`) | **needs one GPU** (7–8B LoRA) | run `MODEL=Qwen/Qwen2.5-7B-Instruct ./run.sh`; **SimNPO primary** (2410.07163) + NPO/GA baselines; removal audit required |

**Critical path to Release A:** Experiment 1 (the empirical heart of C1) is **done** on two
real LLMs — the discrimination table is in the draft. Remaining for A is writing plus,
optionally, a broader model sweep.

**Critical path to Release B / full evidence:** one GPU session for Experiment 2 plus the
sensitivity analysis.

> Neither the LLM key nor the GPU is available in an automated session — both are the human's
> to supply. The code paths are provider-agnostic and wired; running them is the only gap.

---

## 4. Venue targets

Deadlines shift year to year — **verify the current CFP before committing.** Named for fit.

**Release A — workshop (fast, timestamps the LLM-proxy + leakage angle):**
- An **AI-for-Education / foundation-models-for-education workshop at NeurIPS or ICML** — the
  best fit for the LLM-proxy + leakage framing and the quickest cycle.
- Also viable: a **learning-analytics or ITS workshop** co-located with LAK or AIED.
- Pair with an **arXiv preprint** posted at the same time (cs.CY / cs.LG), with the live demo
  (experttrace.org) cited as a reproducibility artifact.

**Release B — full peer-reviewed venue (methods/measurement tracks):**
- **EDM** (Educational Data Mining) — measurement/methods fit is strongest here.
- **AIED**, **LAK**, **Learning@Scale** — all plausible; pick by cycle timing.
- **Not** a learning-outcomes / education-psychology journal — that requires the human cohort
  study we have not run and must not claim.

---

## 5. Paper outline (skeleton for Release A)

1. **Introduction** — the pre-human-trial screening problem; falsify mechanism cheaply.
2. **Related work** — the honest-reuse table (novelty doc §1) + the three-way differentiation
   paragraph (§5). Foreground the shoulders; sharpen the delta. Cite Song/Apartsin/PS²/SeedRG.
3. **The instrument (C2)** — control task, reference-optimal solver, regret-vs-optimal,
   per-rule compliance, KC→single-metric identifiability; construct validity + competence
   gradient; second task structure (tire) to show generality.
4. **Bidirectional diagnosis (C1)** — localize (i) + leakage (ii) on the one metric;
   closed-model-compatibility argument; Experiment 1 results.
5. **Weight-level cross-check (C1, Exp. 2)** — open-weight unlearning arm; the 2×2;
   distinguishes *gone* vs *suppressed*.
6. **Proxy learners as application (C3)** — instantiate known proxy methods on the instrument.
7. **Limitations** — proxy validity (against ourselves), single-instrument sensitivity,
   mechanism ≠ external validity; pre-register the human study.
8. **Conclusion.**

---

## 6. Existing docs that need updating to match this angle

The repo currently carries *two* whitepapers with *different* lead framings. Aligning to the
measurement-method decision means repositioning, not rewriting from scratch:

| Doc | Current lead framing | Change needed |
|---|---|---|
| [`docs/planning/colreg-whitepaper.md`](planning/colreg-whitepaper.md) | in-silico validation method (already close to C1+C2) | **Promote to the flagship draft.** Restructure to lead C1+C2 explicitly, demote C3 to "application," fold in the §5 related-work paragraph and the Exp. 1/2 result tables. This becomes the arXiv paper. |
| [`docs/planning/whitepaper.md`](planning/whitepaper.md) | AJP system/education design (systems-paper shape) | **Reposition as supporting material**, not the publication. Add a header note pointing to the measurement paper as the archival contribution; keep it as the system-design reference. Do **not** submit this as the paper. |
| [`docs/novelty-and-positioning.md`](novelty-and-positioning.md) | prior-art scan (authoritative) | Update the §4 evidence checklist as Experiments 1/2 and the sensitivity analysis complete; re-run the prior-art scan at submission time (§9 note). |
| [`README.md`](../README.md) / [`OVERVIEW.md`](../OVERVIEW.md) | product + education framing | No change for publication; keep the "simulation-based, not external-validity" evidence banner they already carry. |

**Framing rule to apply everywhere:** the tutor/learner-agent/"paradigm generalizes" story is
infrastructure and context — never the headline contribution. The headline is the instrument
and the bidirectional diagnosis.

---

## 7. Next actions

- [ ] Supply a working **LLM credential** → run **Experiment 1** (unblocks the C1 spine).
- [ ] Restructure `planning/colreg-whitepaper.md` into the C1+C2-led arXiv draft (done: see `arxiv/main.tex`) (§5 outline above).
- [ ] Wire the head-on related-work paragraph + citations into the draft — including the
      four closest-neighbors from the **2026-08-06 re-scan** (novelty doc §10): CUE-R
      (2604.05467, C1), maritime analytics (2507.01274, C2), the LLM-judge pre-registered
      audit (2607.28128, C3) and EduClaw-Bench (2608.03206, C3). Do **not** cite the
      withdrawn 2606.05633.
- [ ] Write the proxy-validity limitations section (against ourselves).
- [ ] Supply a **GPU** → run **Experiment 2**: open `experiments/unlearning/colab.ipynb` in
      Colab (A100/L4), or `run.sh` on a rented hourly GPU (RunPod/Lambda). Include if it
      lands before the workshop deadline, else hold for Release B.
- [ ] Build the **sensitivity analysis** experiment (Release B).
- [ ] Verify the target **workshop CFP** and post the **arXiv** preprint at submission.
- [ ] Re-run the prior-art scan immediately before submission (fast-moving 2026 space) —
      the 2026-08-06 re-scan (novelty doc §10) confirmed C1/C2/C3 hold, but the 2607–2608
      arXiv range is still sparsely indexed, so a final sweep is required.
