# Paper portfolio — how the work parcels into publications

A companion to [`docs/publication-plan.md`](publication-plan.md) and
[`docs/novelty-and-positioning.md`](novelty-and-positioning.md). Those two documents plan
**one flagship paper** and deliberately collapse several contributions into it to protect the
methods claim from a systems-paper rejection. This document takes the opposite view on
purpose: it lays out the **full menu** of separable papers latent in this work, so the choice
of how many to ship — and in what order — is explicit rather than accidental.

> **The organizing principle:** the pieces of this work are not four *topics*, they are
> several *different kinds of paper* — methods, position, systems/demo, applied/domain,
> resource/benchmark. A single draft that spans two archetypes (or two reviewer audiences) is
> two papers wearing one coat. Parcel by **archetype + home audience**, not by topic overlap.

> **Framing rule inherited unchanged:** every result here is **simulation-based mechanism
> evidence, not human external validity** (except the applied/domain paper, whose evidence is
> physical). No paper claims learning gains without the pre-registered human study.

---

## 1. The one-audience test

The failure mode when splitting a body of work is salami-slicing into least-publishable-units
that overlap and cross-cite awkwardly. The guardrail is a single question:

> **Who is the one community that reviews this paper?**

If a draft is trying to satisfy ML-methods reviewers *and* manufacturing reviewers, it is two
papers. Applied consistently, that test carves this work at the seams below.

---

## 2. The portfolio

| # | Working handle | Archetype | Home audience | Core contribution | Build status |
|---|---|---|---|---|---|
| **P1** | *In-silico instrument + bidirectional diagnosis* ("forgetting and RAG") | Methods / measurement | Education-ML (EDM/AIED/LAK; NeurIPS/ICML AI-for-Ed workshop) | C1 (localize corpus gap **and** detect leakage on one control-task metric) + C2 (reference-optimal regret instrument, KC→single-metric identifiability) | **Built** — the flagship |
| **P2** | *Instructional-utility retrieval* (the position) | Position | Education / learning sciences | Argument: retrieval should optimize **instructional utility, not semantic relevance**, and safety-critical domains demand **corpus-bounded** retrieval by design | Whitepaper prose exists; needs reframing as argument |
| **P3** | *Adaptive / state-conditioned retrieval routing* ("queuing for adaptive RAG") | Methods (mechanism) | IR / ML methods | The retrieval **mechanism**: route/prioritize what to retrieve on learner state rather than query similarity | Idea — not yet in repo |
| **P4** | *TeachMe AJP — a RAG-for-training system* (the systems/demo) | Systems / demonstration | HCI / applied education systems (L@S demo, AIED tools) | The working artifact: Mentor+Narrator two-agent architecture, corpus-bound Narrator, four instructional modes | System built; `docs/whitepaper.md` |
| **P5** | *Real functional AJP output* ("breadboard functional output") | Applied / domain | Manufacturing / printed electronics / materials | A **physically real** functional print produced under the training/knowledge regime — the one result no one else can replicate | Idea — not in repo |
| **Pβ** | *Auditing machine unlearning with a control-task instrument* (optional) | ML safety / unlearning | ML safety (NeurIPS SoLaR-type workshop) | Use the objective instrument to distinguish **removed vs. suppressed** knowledge in an unlearned model | Exp. 2 harness built (`experiments/unlearning/`) |
| **P6** | *KC→metric benchmark* (optional) | Resource / benchmark | Education-ML / benchmarks | The COLREG + tire instruments released as a reusable KC→single-metric benchmark | Both instruments built |

---

## 3. Why the middle bucket felt stuck

"Systems, learning, engineering — position? novel?" was one blob trying to be **three**
archetypes at once. It resolves the moment each half is sent to its own home:

- Its **"novel"** half is the adaptive-retrieval *mechanism* → that is **P3**, not a system feature.
- Its **"position"** half is the instructional-utility *argument* → that is **P2**, a short paper on its own.
- What remains once those leave is a clean **systems/demo** paper → **P4**, contribution = the artifact.

`docs/novelty-and-positioning.md` already warns that leading with the tutor/system "invites a
systems/demo rejection." That warning is correct *for the flagship*. The fix is not to hide the
system — it is to let the system be **P4** (where "it's a demo" is the point, not a weakness)
and keep it out of **P1**.

---

## 4. Splitting "forgetting" from "RAG" (Pβ)

P1 currently fuses two things under C1: RAG context-leakage (a *RAG* story) and the
open-weight unlearning arm (a *forgetting* story). They share an instrument but not an
audience. The unlearning arm speaks fluently to ML-safety reviewers with **zero education
framing** — cite Song 2026, SimNPO, TOFU/MUSE directly and score gone-vs-suppressed on the
regret instrument.

- **P1 (education/measurement):** instrument + corpus-gap localization + context-level leakage.
- **Pβ (ML safety):** *"An objective control-task instrument for auditing machine unlearning —
  distinguishing removed from suppressed."* Stands on Experiment 2 alone.

This roughly doubles the venue surface from work already built — Pβ currently lives as a single
table inside P1. **Caveat:** keep the shared-instrument description in both, and have Pβ cite P1
(or vice versa) so neither reads as self-plagiarism; the deltas (education vs. safety audience,
context- vs. weight-level ablation) must be stated explicitly in each.

---

## 5. Repo asset → paper map

Which existing artifacts feed which paper. (Paths as of this writing; verify before drafting.)

| Asset | Feeds |
|---|---|
| `docs/arxiv/main.tex` (Exp. 1 discrimination table, figures) | **P1** (primary draft) |
| `src/engine/colreg-sim/` — reference-optimal solver, regret/compliance scoring | **P1**, **P6** |
| `src/engine/colreg-sim/leakage.ts` + `__tests__/leakage.test.ts` | **P1** (C1), **Pβ** (scoring side) |
| `src/engine/colreg-sim/sensitivity.ts` (τ=1.00 robustness) | **P1** (robustness result) |
| `src/engine/procedure-sim/` + `src/corpus/tire/` (second task structure) | **P1** (generality), **P6** (benchmark) |
| `src/engine/learner-agent/` + `validation.ts` (Elo/BKT recovery, ECE) | **P1** (instrument validity) |
| `diagnose.ts` (corpus-gap localization) | **P1** (C1 half i) |
| `experiments/unlearning/` (SimNPO/NPO, removal audit, `colab.ipynb`) | **Pβ** (primary), **P1** (weight-level cross-check) |
| `docs/whitepaper.md` (TeachMe AJP architecture, learning-theory grounding) | **P4** (primary), **P2** (argument source) |
| `OVERVIEW.md` ("AI paradigm is downstream of the education paradigm") | **P2** (thesis) |
| `src/components/RagCoverageView.tsx` + retrieval routing code | **P3** (if the mechanism is the novelty), **P4** |
| The physical AJP / Optomec HD2 functional result | **P5** (does not exist in repo yet) |

**Gaps to fill before a paper is real:**
- **P3** needs the routing mechanism written up as a *method* with an ablation showing
  state-conditioned retrieval beats similarity retrieval on an outcome — otherwise it is P4's
  feature, not its own paper.
- **P5** needs the physical experiment run and documented — this is lab work, not repo work.

---

## 6. Sequencing recommendation

Ranked by *defensibility × readiness*, not by how interesting each is:

1. **P1 — ship it.** Built, validated, timestamp-sensitive (the novelty doc flags 2026
   preprints converging). This is the flagship the existing plan already targets; nothing here
   changes that. Everything else cites it.
2. **P5 — the moat.** The physical functional result is the single thing no competitor can
   replicate from a preprint. Highest defensibility, but gated on lab work, not writing.
3. **Pβ — the free second venue.** Reframes already-built Exp. 2 material for the ML-safety
   community. Low marginal cost once P1 is out.
4. **P3 + P2** — likely the *same* paper if the adaptive-retrieval mechanism is the genuine
   novelty (P2 becomes P3's motivation section). Ship as one unless P2's argument is strong
   enough to stand alone as a short position piece.
5. **P4** — a demo/tools submission, not a research paper. Worth a demo track; do not spend
   flagship effort on it.
6. **P6** — opportunistic. Only if the instruments are cleaned up for external reuse.

### Keep the flagship pure

The one hard rule across all of this: **P1 stays C1+C2 only.** P2/P3/P4/P5 may cite it and
build on it, but folding any of them *into* it re-creates the exact systems-rejection risk the
existing plan was written to avoid.

---

## 7. Open decisions for the author

- **How many papers?** Minimal (P1 + one applied paper) vs. full fan-out (P1–P6). More papers =
  more venue surface but more salami-slice risk and more cross-citation bookkeeping.
- **P2/P3: one paper or two?** Depends on whether the instructional-utility *argument* can
  carry a paper without the *mechanism*, and vice versa.
- **Pβ: split now or keep folded in P1?** Splitting doubles venue reach; keeping it folded makes
  P1's C1 stronger. Cannot do both fully — decide before drafting P1's C1 section.
- **P5 ownership:** the physical result is lab work outside this repo — who runs it, and on what
  timeline, gates the highest-defensibility paper.
