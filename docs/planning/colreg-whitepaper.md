# Corpus-bounded training for safety-critical decision domains: the COLREG simulator and an in-silico validation method

**A TeachMe / EDDIE working whitepaper.**
Companion documents: [OVERVIEW.md](../OVERVIEW.md) (the educational stance),
[docs/colreg-simulator-design.md](../colreg-simulator-design.md) (instrument design),
[docs/colreg-validation.md](../colreg-validation.md) (methodology),
[docs/colreg-conops.md](../colreg-conops.md) (operations).

> **Evidence status.** All quantitative results below are **simulation-based
> mechanism evidence** — they test whether the machinery behaves as designed and
> whether the measurement instrument can distinguish competence. They are *not*
> human-subject external-validity results.

---

## Abstract

TeachMe's original thesis is that a corpus-bounded, Socratic training architecture
— a typed knowledge graph, a narrator that refuses to fabricate, a mentor that asks
rather than tells, and mastery/safety gates — produces operators who *transfer* to
novel situations in safety-critical, procedural domains. This paper reports on
extending that architecture from a single hardcoded domain (aerosol-jet printing)
to a pluggable, multi-domain system, and on building a domain that the original
discrete graph/rubric paradigm could not express: **COLREG collision avoidance**, a
continuous-control decision task. We contribute (1) an interactive COLREG simulator
with a real kinematic model, an elliptical ship domain, a Collision Risk Index, a
rule-based compliance checker, and two reference solvers (scenario-based MPC and
velocity obstacles); and (2) an **in-silico validation method** that uses the
simulator as an objective instrument to (a) demonstrate the instrument separates
good from bad policies, (b) map learner competence to task performance, and (c)
turn a corpus-bounded learner's failures into a diagnosis of the *corpus itself*.
We separate two experimental knobs — the *instruction method* and the *knowledge
source (RAG content)* — and describe how to genuinely suppress and verify
out-of-corpus knowledge when the learner is a large language model.

## 1. Introduction

Generic retrieval-augmented assistants optimize for semantic relevance; TeachMe
inverts this to optimize for *instructional utility* and *transfer* (see
[OVERVIEW.md](../OVERVIEW.md)). The architecture was, until recently, welded to one
domain. Two questions motivated this work:

1. **Does the paradigm generalize** beyond aerosol-jet printing — and beyond the
   discrete, graph-plus-rubric shape it was built around?
2. **How would we show it adds value** — with an objective, transfer-oriented
   outcome measure rather than self-reported satisfaction or in-domain recall?

We answer (1) by making domains pluggable and adding two: a simple procedural domain
(roadside tire change) and COLREG. COLREG forces the second, harder step, because
"the rules of the road at sea" are ultimately about a *continuous* maneuvering
decision — course and speed under constraints — which a scripted-step rubric cannot
score. We answer (2) by building the simulator as a measuring instrument and using
it in an in-silico validation pipeline.

## 2. Background

- **COLREGs.** The International Regulations for Preventing Collisions at Sea define
  encounter types (head-on, crossing, overtaking), give-way vs stand-on roles, safe
  speed, risk of collision (a steady compass bearing), and the requirement that
  avoiding action be *early* and *substantial* (readily apparent).
- **Ship domain.** Operational research models a vessel's claimed water as an
  **elliptical, asymmetric domain** (Fujii; Coldwell; quaternion domains), larger
  ahead and to starboard, scaled by length and speed.
- **Collision Risk Index (CRI).** A standard fuzzy/weighted scalar combining DCPA,
  TCPA, range, relative bearing, and speed ratio into a `[0,1]` risk value.
- **Avoidance control.** Two explainable families dominate: **velocity obstacles**
  (VO/RVO, with a starboard bias for COLREGs) and **scenario-based / branching-course
  MPC** (SB-MPC) that enumerates course/speed behaviors and scores each against a
  cost combining collision hazard, COLREG compliance, and deviation.
- **Benchmark.** The **Imazu problem** — canonical 1:1 and multi-ship encounters —
  is the field's standard test set.
- **Simulated learners.** Using computational or LLM agents as proxy students to
  pilot instructional designs is an established line of work (SimStudent /
  Apprentice-Learner; LLM "generative students"; knowledge ablation via machine
  unlearning), with an active sub-literature on whether such proxies are *valid*.

## 3. System design

### 3.1 Domain generalization

A `DomainDescriptor` + registry (`src/corpus/registry.ts`) makes domains pluggable;
each self-registers on import. AJP was wrapped in a descriptor with no content
change; two new domains were added — **roadside tire change** and **COLREG basic** —
each riding the same Scenario / Socratic / Dashboard surfaces. Scenario phases were
generalized from an AJP-specific enum to per-domain labels. This is the "does it
generalize" result: the same machinery hosts a garage procedure and the rules of the
road.

### 3.2 The COLREG simulator (`src/engine/colreg-sim/`)

- **Kinematics.** A first-order (Nomoto-style) course response with a
  **speed-coupled turn-rate limit** (`turn rate = v / minimum turn radius`, so a
  faster ship turns wider) and an acceleration limit — the right altitude for a
  rules trainer.
- **Ship domain.** An elliptical, COLREG-asymmetric domain (starboard > port),
  scaled by length and speed. A *clearance factor* expresses how deep a target sits
  in the domain: `<1` is an incursion, `1` the boundary, `≥2` the target margin.
- **CRI.** The standard closed form
  `r = (a₁(DCPA/Ds)² + a₂(TCPA/Ts)² + a₃(D/Ds)²)^(-1/2)`, clamped.
- **Compliance checker.** Classifies the encounter and scores the maneuver on
  direction (starboard), magnitude (substantial), timing (early), the no-turn-to-port
  prohibitions, and safe speed in restricted visibility.
- **Objective.** A single scalar with **one hard barrier** (ship-domain incursion —
  the only hard safety constraint) and **three graded terms**: the 2× margin
  objective, compliance, and route deviation. Crucially, the **2× margin is a graded
  objective, not a pass/fail threshold** — in extremis it may be unachievable, and
  the solver returns the best available maneuver rather than declaring failure.
  Deviation measures *progress lost against the intended track*, so it rewards the
  **smallest sufficient** maneuver (the time/fuel proxy).
- **Reference solvers.** Two "optimal" baselines: an **SB-MPC** sweep over
  course/speed behaviors, and a **velocity-obstacle** chooser (least course change,
  starboard-biased, outside every collision cone).

The interactive component renders a radar plan view (range rings, compass, filled
elliptical domain + 2× ring, track trails, CPA marker, velocity-space VO inset) and
scores a learner-committed maneuver live.

## 4. Measurement & validation method

### 4.1 Train vs test, and two knobs

The simulator is used primarily as an **assessment/transfer-test** environment, not
a training surface: training against a live score invites gaming the metric — the
exact failure the Socratic design avoids. We distinguish:

- **Knob A — instruction method:** hold knowledge fixed, vary *how* it is taught;
  outcome = transfer on the held-out set.
- **Knob B — knowledge source (RAG content):** bind the learner to a specific corpus
  with no outside information; failures then diagnose the *corpus*.

### 4.2 A value-demonstration ladder

1. **Instrument construct validity** (runnable now): scripted policies must separate
   cleanly, or no learning result is interpretable.
2. **Competence → performance gradient**: a competence-parameterized learner shows
   the metric responds, component by component, to what the learner knows.
3. **Ablation**: full paradigm vs ablated, measured on the same held-out set — the
   value claim.

### 4.3 In-silico ablation with agent learners

The interesting form of (3) uses **knowledge-ablated agents** as proxy learners:
ablate an agent's COLREG knowledge → train it via the protocol → test it on the
simulator → the transfer delta estimates the protocol's value. This is an active
research pattern (SimStudent; LLM generative students; machine-unlearning-based
novice simulation).

### 4.4 Suppressing and verifying out-of-corpus knowledge

A base LLM already knows the COLREGs, so a RAG-bounded study must *enforce and audit*
corpus-boundedness. **Suppress** with closed-book + abstention, citation forcing, a
**counterfactual corpus** (swap the true rule for an altered one), and entity
obfuscation (machine unlearning for open-weight models). **Verify** with a
closed-book contamination baseline, counterfactual adherence, abstention
calibration, and the **ablation-delta**: remove a rule and confirm the metric it
governs degrades. The same `diagnose.ts` instrument that finds corpus gaps therefore
doubles as a leakage detector — *if removing the starboard rule doesn't make the
learner turn the wrong way, it is using pretrained knowledge, not the corpus.*

## 5. Results (in-silico)

All figures are over the 22-case Imazu-style benchmark (`src/corpus/colreg/imazu.ts`);
targets are placed on genuine collision courses so do-nothing collides.

### 5.1 Instrument construct validity

| Policy | Cleared | mean J | Compliance penalty | mean CRI-max |
|---|---|---|---|---|
| Hold-course (naive) | 9% | 1804.6 | 0.576 | 0.97 |
| Velocity obstacle | 100% | 0.6 | 0.279 | 0.63 |
| SB-MPC (expert) | 100% | 0.0 | 0.000 | 0.64 |

The instrument separates good from bad decisively: the naive baseline is at near-
collision on nearly every case (CRI ≈ 1), while both expert solvers clear the field
at far lower cost. A secondary, honest nuance: VO clears every domain but carries a
higher compliance penalty than SB-MPC — it is *safe* but not as *rule-optimal*,
exactly the distinction the compliance term is meant to expose.

### 5.2 Competence → performance gradient

A learner acquiring COLREG knowledge components in curriculum order:

| Stage (+component) | Cleared | mean J | Compliance penalty |
|---|---|---|---|
| none | 9% | 1804.6 | 0.576 |
| +role | 9% | 1759.1 | 0.707 |
| +starboard | 14% | 1680.9 | 0.319 |
| +substantial | 14% | 1597.0 | 0.093 |
| +early | 86% | 270.2 | 0.000 |
| +safeSpeed | 86% | 270.2 | 0.000 |
| +multiShip | 100% | 0.0 | 0.000 |

Two findings: **partial knowledge is dangerous** — adding "give-way role" *without*
"alter to starboard" makes compliance *worse* (the learner now acts, but turns the
wrong way); and "safe speed" shows no effect *on this set* because it is
clear-visibility. That last one is an honest null, and a testable one: on a
dedicated **restricted-visibility (Rule 19) subset** (10 fog cases), ablating "safe
speed" raises the mean compliance penalty from ≈ 0 to **0.67** and the corpus-gap
diagnoser fingers Rules 6/19 — the null becomes a localized signal. Restricted
visibility also *changes the right answer*: a contact on the port bow is a stand-on
situation in sight (holding is correct), but under Rule 19 there is no stand-on
privilege, so the same held course fails. The point is not the specific curve but
that the instrument makes "learned more" a measurable rise in cleared, compliant
encounters.

### 5.3 Corpus-gap diagnosis

Binding a learner to a corpus missing the alter-to-starboard rule and diagnosing its
benchmark failures yields, top-ranked, `starboard(15/22)` pointing at Rules 14/15 and
the starboard probe, plus `role(3/22)` and a `coordination(1/22)` flag for a
capability the corpus has *no node for at all*. The instrument localizes the defect;
the fix is authored; re-running confirms the signature clears.

## 6. Discussion

These results establish the **necessary precondition** for any learning claim: the
measurement instrument is valid (it separates competence), sensitive (each knowledge
component moves the metric it governs), and diagnostic (failures localize to corpus
content). They do **not** establish that the paradigm improves human learning — that
requires the human cohort study (ConOps Phase 5). The value of the in-silico pipeline
is that it lets us falsify the instrument and the mechanism cheaply, before spending
human-subject effort.

## 7. Limitations

- **Proxy validity.** LLM/parametric learners are not humans; they may be too capable
  or learn unrealistically fast, and may not reproduce authentic misconceptions.
- **Contamination.** Pretrained COLREG knowledge must be actively suppressed and
  verified, or the corpus is over-credited.
- **Modeling choices.** The elliptical ship domain, CRI weights, and objective
  weights are choices; conclusions should be checked for stability under sensitivity
  analysis.
- **Kinematic fidelity.** A first-order model with rate limits is a teaching
  abstraction, not a hydrodynamic ship model.

## 8. Future work

- Human cohort study (Knob A) with the simulator as the common outcome instrument.
- Live LLM runs of the corpus-bounded learner with full leakage audits (the harness
  is provider-agnostic and ready).
- Sensitivity analysis over domain/CRI/objective parameters.

Delivered since the first draft: the restricted-visibility (Rule 19) benchmark
subset so the safe-speed axis has cases to move; a VO-cone-based reference solver;
and the complete 22-case Imazu geometry.

## 9. Related work

COLREG-compliant avoidance via SB-MPC (Johansen et al.; Eriksen & Breivik) and
velocity obstacles (Fiorini & Shiller; Kuwata et al.); ship-domain and CRI models
(Fujii; Coldwell; quaternion domains); the Imazu benchmark (Imazu; Sawada et al.);
and simulated/agent learners in education (SimStudent / Apprentice-Learner;
GPTeach; generative student agents; machine-unlearning-based novice simulation) with
the associated proxy-validity caveats. See
[docs/colreg-validation.md](../colreg-validation.md) for linked sources.

## 10. Reproduction

- Instrument + gradient + diagnosis: `npm run test` (see
  `src/engine/colreg-sim/__tests__/`), and the live Tier-2 chart on the Simulator
  picker.
- Corpus-bounded LLM learner + leakage audits: `npm run colreg:llm-eval` with a
  credential in the environment.
- App: `npm run dev` → Simulator tab (COLREG domain).
