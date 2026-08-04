# Generic Learner Agent — approach, state model, and references

A working design note for a **domain-agnostic learner agent**: something that carries
a learner's state (knowledge mastery, confidence, history), updates it from evidence,
and exposes it to the tutoring loop (retrieval calibration, item selection, mastery
gates). It also covers the *simulated* learner — the synthetic proxy we use to
validate the instrument and the pedagogy — because both should share one state schema.

> Status: design synthesis + reference collection, meant to be picked up later. It
> inventories what already exists in this repo (with file paths), proposes a generic
> architecture on top of it, and annotates the literature to build against. Nothing
> here is a committed API yet.

---

## 1. Two things called "the learner agent" — keep them distinct

The single most important framing decision. The word "learner" is used two ways, and
they must **share a state schema but differ in where outcomes come from**:

| | **Tracked learner (learner model)** | **Simulated learner (proxy student)** |
|---|---|---|
| Who | a real operator using the tutor | a synthetic agent (parametric or LLM) |
| Purpose | drive *this* person's instruction | validate the instrument / pedagogy / corpus |
| Outcome source | the human's actual responses | generated responses at a set competence |
| Ground truth | unknown (estimated) | **known** (we set θ) — so metrics are checkable |
| In repo | `src/engine/learner-model/` | `src/engine/simulated-learner/`, COLREG `learner-policy.ts`, `llm-learner.ts` |

A generic learner agent is the union: one **state schema** and one **update contract**,
with a pluggable *evidence source* (human ⟷ simulator) and a pluggable *mastery
estimator*. Get that seam right and the same code both tutors a person and runs the
validation studies.

---

## 2. What exists today (grounded inventory)

### 2.1 Tracked learner model — `src/engine/learner-model/`
- **`LearnerProfile`** (`src/types/index.ts`): `id`, `conceptProficiencies: Record<conceptId, ProficiencyScore>`, `interactionHistory: InteractionEvent[]`, `assignedCondition`, `role`.
- **`ProficiencyScore`**: `level` (`novice→beginner→intermediate→advanced→expert`), `confidence` (0–1), `attempts`, `successRate`, `lastAssessed`.
- **`updateProficiency()`**: running success rate; a `transferScore` (if present) is blended 50/50 with success rate ("demonstrating transfer means deeper understanding"); level from `computeLevel(effectiveRate, attempts)` thresholds; confidence ramps with `min(1, attempts/5)`.
- **`getOverallProficiency()`**: mean of per-concept level indices.
- **`InteractionEvent`**: typed log — `retrieval | response | assessment | hint-request`.

### 2.2 Probe mastery (declarative axis) — `src/engine/learner-model/probe-progress.ts`
- **`ProbeAttemptRecord`**: `attempts`, `mastered` (sticky bool), `bestScore`, `lastScore`; persisted to `localStorage`.
- **`summarizeMastery()`**: per-category aggregate → the dashboard **Mastery Map** (`DomainMastery`, `MasterySummary`).
- Deliberately records only the operator's own Socratic practice; Workflow-Demo (simulated) runs are **not** folded in — the tracked model must not be polluted by proxy data.

### 2.3 How state is consumed (the loop that makes state matter)
- **Proficiency-calibrated retrieval** (`src/engine/retrieval/`, `RetrievalStrategy = 'semantic' | 'proficiency-calibrated'`, `ScoringPolicy` weights): ZPD boost — prefer content ~one level above current proficiency, not just the most semantically similar chunk.
- **Mentor scoring + mastery gates** (`src/engine/mentor/index.ts`): each probe response is scored 0–1; `masteryPassed = score ≥ threshold`, threshold **0.80** normally, **0.90** behind a safety gate (`MasteryGateState`, `thresholdVersion`).
- **Assessment / transfer** (`TransferProblem`, `RetrievalPhase = pretest | learning | posttest | transfer`): near vs far transfer, with practice and assessment items firewalled.

### 2.4 Simulated / proxy learners
- **`src/engine/simulated-learner/`**: LLM persona at an expertise level (`complete-novice … proficient`), aware of prior Mentor feedback on follow-ups. Drives auto-answer demos.
- **COLREG parametric learner** (`src/engine/colreg-sim/learner-policy.ts`): a **competence vector θ** (`role, starboard, substantial, early, safeSpeed, multiShip`) where each component maps to one simulator metric; ablating a component degrades exactly that metric. This is the cleanest existing "knowledge state → behavior → score" chain.
- **COLREG corpus-bound LLM learner** (`llm-learner.ts` + `scripts/colreg-llm-eval.ts`): reasons only from the rendered corpus, with ablation/counterfactual levers and leakage audits.

---

## 3. Learner state schema (the core data model)

Generalize the current `LearnerProfile` into a domain-agnostic shape. The unit of
knowledge is a **Knowledge Component (KC)** — a fact, skill, or rule — following the
KLI framework (Koedinger et al. 2012). Concepts, probes, and COLREG's θ-components are
all KCs; naming them uniformly is what makes the agent generic.

```ts
interface LearnerState {
  id: string;
  domainId: string;
  // Knowledge state: one estimate per KC.
  knowledge: Record<KCId, KnowledgeEstimate>;
  // Optional meta/affective axes (engagement, hint-reliance, speed) — additive.
  meta?: Record<string, number>;
  history: EvidenceEvent[];        // append-only log; estimators are pure over it
  context?: { condition?: string; role?: string };  // experiment / persona
  updatedAt: number;
}

interface KnowledgeEstimate {
  // Keep BOTH a continuous mastery and a coarse band — different consumers want each.
  mastery: number;                 // 0–1 P(known) or scaled skill
  level: ProficiencyLevel;         // novice…expert, derived from mastery
  confidence: number;              // 0–1 estimator certainty (shrinks with few attempts)
  attempts: number;
  lastOutcome?: number;            // 0–1
  lastAssessed: number;
}

interface EvidenceEvent {
  timestamp: number;
  kcIds: KCId[];                   // KCs the item exercised (its Q-matrix row)
  itemId: string;
  outcome: number;                 // 0–1 (Mentor score, correctness, transfer score)
  kind: 'probe' | 'assessment' | 'scenario' | 'hint' | 'retrieval';
  source: 'human' | 'simulated';   // <-- the seam: tracked vs proxy
  details?: Record<string, unknown>;
}
```

Design notes:
- **Continuous `mastery` + discrete `level`.** The current model stores only a level;
  add a continuous estimate so ZPD calibration and gating have resolution, and derive
  the band for display. (BKT/PFA/IRT are all continuous.)
- **Confidence is first-class.** Never gate or advance on a high mastery with low
  confidence (few attempts). The current `min(1, attempts/5)` ramp is the seed of this.
- **`source` on every event.** Lets one store hold both real and simulated evidence
  without cross-contamination (Section 2.2's firewall, enforced by data not discipline).
- **KCs, not free text.** An item declares which KCs it touches (its Q-matrix row);
  that mapping is what lets outcomes update the right mastery estimates and lets
  failures localize to corpus content (`diagnose.ts`).

---

## 4. Knowledge & mastery estimation (pluggable)

The estimator is the heart of the agent and the part most worth making swappable.
Define one interface and offer a ladder of implementations from cheap to strong:

```ts
interface MasteryEstimator {
  init(kcs: KCId[]): Record<KCId, KnowledgeEstimate>;
  update(state: LearnerState, event: EvidenceEvent): LearnerState;  // pure
}
```

| Rung | Model | What it adds | Cost | Ref |
|---|---|---|---|---|
| 0 | **Heuristic running rate + thresholds** (current) | simple, transparent, no fitting | trivial | — |
| 1 | **BKT** (Bayesian Knowledge Tracing) | P(known) with slip/guess; principled confidence | 4 params/KC, fit from data | Corbett & Anderson 1994 |
| 2 | **AFM / PFA** (Additive / Performance-Factors) | learning-rate per KC; separates success/failure counts; logistic | fit; interpretable | Cen 2006; Pavlik 2009 |
| 3 | **Elo / IRT** | joint learner-ability × item-difficulty on one scale; great for cold-start & item calibration | light online (Elo) → fit (IRT) | Pelánek 2016; Embretson & Reise 2000 |
| 4 | **DKT / DKVMN** (deep knowledge tracing) | sequence effects, KC interactions; higher accuracy | needs data + training; less interpretable | Piech 2015; Zhang 2017 |

Recommended path: **start at rung 0** (already built), keep the interface, move to
**BKT or Elo** once there is any interaction data — Elo is the pragmatic default for a
generic agent because it cold-starts well and calibrates item difficulty for free.
Reserve DKT for when you have volume and can tolerate opacity (Open Learner Model
transparency, §6, gets harder there).

**Mastery gate policy** (keep, but parameterize): pass at mastery ≥ τ with confidence
≥ c; τ = 0.80 default, 0.90 for safety-critical KCs (mirrors the Mentor threshold).
Prefer a **run of successes** or a posterior threshold over a single high score, to
resist lucky guesses.

---

## 5. How state drives instruction (the policy layer)

State is only useful if a policy consumes it. Keep these as separate, testable
functions over `LearnerState` (the repo already splits several out):

1. **Retrieval calibration** — bias content toward `level + 1` (ZPD); down-weight KCs
   already mastered. (`ScoringPolicy` weights: similarity / proficiency / role / transfer.)
2. **Next-item / curriculum selection** — pick the KC at the frontier: not-yet-mastered,
   prerequisites satisfied, highest expected learning gain. COLREG's `CURRICULUM` order
   is a hand-authored version; a graph of KC prerequisites generalizes it.
3. **Mastery / safety gates** — block progression or "cleared" status until τ met.
4. **Feedback shaping** — Socratic (ask, don't tell) by default; firmer near safety
   gates; scaffolding withdrawn as mastery rises (Wood/Bruner/Ross).
5. **Stopping** — end when all target KCs mastered, or on a mastery/attempt budget.

Anti-gaming (a core thesis constraint): the live score is an **assessment** surface,
not a training target. Firewall practice KCs/items from assessment items; hide the
scoreboard/reference during assessment. (See `docs/colreg-validation.md` §1.)

---

## 6. Generic learner agent — proposed architecture

```
                ┌─────────────────────────────────────────┐
   evidence ───▶│  LearnerAgent                            │
 (human OR      │   state: LearnerState                    │
  simulator)    │   estimator: MasteryEstimator (pluggable)│──▶ LearnerState
                │   domain: DomainDescriptor (KCs, Q-matrix,│
                │           prereq graph, items)            │
                └───────────────┬──────────────────────────┘
                                │ exposes read-only state
             ┌──────────────────┼───────────────────┬──────────────┐
             ▼                  ▼                    ▼              ▼
     retrieval calibration  next-item select   mastery gates   feedback shaping
```

- **Domain-parameterized**, not domain-coded: the agent takes a `DomainDescriptor`
  (KCs, item→KC Q-matrix, prerequisite graph, mastery thresholds). This is the same
  move that made domains pluggable for AJP / tire / COLREG.
- **Evidence-source-agnostic**: `agent.observe(event)` where `event.source` is `human`
  or `simulated`. Tutoring and validation use the identical update path.
- **Estimator-agnostic**: swap rung 0→4 without touching policies (Section 4).
- **Pure updates**: `update(state, event) → state` (as `probe-progress.ts` already is),
  so it is trivially unit-testable and replayable from the event log.
- **Serializable state**: persist `LearnerState` (localStorage today; a store later);
  reconstruct estimates by replaying `history` if the estimator changes.

Minimum viable slice to build first: `LearnerState` + `EvidenceEvent`, an Elo (or BKT)
`MasteryEstimator`, and one policy (ZPD next-item). Everything else already has a
concrete precedent in the repo to copy.

> **Implemented (starter module): `src/engine/learner-agent/`.** The schema (§3), the
> estimator ladder (§4 — `heuristicEstimator`, `bktEstimator`, `eloEstimator`), the
> pure reducer + `LearnerAgent` class + `replay` (§6), and the policy layer (§5 —
> `masteryGate`, `frontier`, `selectNextKC`, `summarize`) are all in place, with
> `__tests__/learner-agent.test.ts` covering BKT/Elo behavior, replay purity, gating,
> prerequisites, and ZPD selection. BKT and Elo are the pluggable defaults; the AJP
> `learner-model/` is the domain-specific predecessor this generalizes.

---

## 7. Simulated learner mode (proxy students)

Same schema, synthetic evidence. Two proven flavors already in the repo:

- **Parametric** (`learner-policy.ts`): set a competence vector θ; each component maps
  to a KC and a metric. Deterministic, cheap, ground-truth known — ideal for
  instrument/curriculum tests and CI. Extend by making θ a `Record<KCId, number>`
  (graded, not just boolean) to feed continuous outcomes into the estimator.
- **LLM persona / corpus-bound** (`simulated-learner/`, `llm-learner.ts`): realistic
  responses at an expertise level, or bound to a corpus with no outside knowledge.
  Use for face-valid demos and Knob-B (corpus) studies — with the leakage audits.

Validity caveats (do not skip): LLM proxies are often **too capable, learn too fast,
and miss authentic misconceptions**. Treat proxy results as mechanism/formative
evidence and gate any human claim on a real study (§9, and `colreg-validation.md`).

---

## 8. How we validate the learner agent itself

Reuse the in-silico ladder already built for COLREG (`docs/colreg-validation.md`):

1. **Construct validity** — does the *instrument* separate a good learner from a bad
   one? (naive vs expert policy separation; built for COLREG.)
2. **Competence → performance gradient** — set θ, acquire KCs in curriculum order,
   watch the metric each KC governs rise. This *is* the test that the state model and
   its update are sensitive to what the learner knows. (COLREG Tier-2; the clear vs
   restricted-visibility curves show a KC's effect can be regime-dependent.)
3. **Ablation & corpus-gap diagnosis** — remove a KC; confirm the governed metric
   degrades and that `diagnose.ts`-style attribution localizes it. Doubles as a
   **leakage test** for LLM learners (if removing a KC doesn't hurt, it's using priors).

For the *estimator* specifically, add: **recovery** (given simulated data from known θ,
does the estimator recover it?), **calibration** (do P(known)=0.8 items succeed ~80%?),
and **cold-start** behavior.

---

## 9. Design principles & pitfalls

- **Assessment ≠ training surface.** Never let the learner optimize the live score;
  firewall and hide during assessment. (Anti-"optimize the metric".)
- **Confidence gates, not point scores.** Advance on sustained/posterior mastery.
- **KCs are the currency.** Items → KCs (Q-matrix) is what makes updates, calibration,
  and diagnosis work; author it explicitly per domain.
- **Contamination / leakage** (LLM learners). A base model already knows most domains;
  enforce corpus-boundedness and *verify* with ablation-delta and counterfactual corpora.
- **Proxy ≠ human.** Calibrate against known human error patterns; keep human claims
  behind a real cohort study.
- **Transparency.** Prefer interpretable estimators (BKT/PFA/Elo) so the learner state
  can be shown back (Open Learner Model) — a trust and pedagogy win.
- **Single-instrument bias.** Metric/estimator weights are modeling choices; run
  sensitivity analysis and check that rankings are stable.

---

## 10. Open questions / roadmap

- Prerequisite **graph** for KCs (generalize COLREG's linear `CURRICULUM`).
- Pick the default estimator (lean **Elo** for cold-start + item calibration; **BKT**
  if per-KC slip/guess semantics are wanted).
- Forgetting / spacing: add a decay term or move to a spacing-aware model (Pavlik/Mozer).
- Affective/meta axes (engagement, hint-reliance) — additive `meta` on `LearnerState`.
- Persistence beyond localStorage; event-log replay when the estimator changes.
- A generic `diagnose`-style attributor that works from any domain's Q-matrix.

---

## 11. References

Grouped; annotated for *why it matters to this agent*. Repo cross-refs:
`docs/references.md` (broader TeachMe bibliography) and `docs/colreg-validation.md`
(simulated-learner + validity sources).

### Knowledge components & the learning framework
- **Koedinger, Corbett & Perfetti (2012).** *The Knowledge-Learning-Instruction (KLI) Framework.* Cognitive Science 36(5). — Defines knowledge components; the vocabulary for the whole state model.
- **VanLehn (2011).** *The relative effectiveness of human tutoring, ITS, and other tutoring systems.* Educational Psychologist 46(4). — The canonical ITS effectiveness baseline; the "why bother" and the bar.

### Mastery estimation / knowledge tracing (the estimator ladder, §4)
- **Corbett & Anderson (1994).** *Knowledge Tracing: Modeling the acquisition of procedural knowledge.* UMUAI 4. — **BKT**; slip/guess, P(known). Rung 1.
- **Cen, Koedinger & Junker (2006).** *Learning Factors Analysis.* ITS. — **AFM**; learning rates per KC. Rung 2.
- **Pavlik, Cen & Koedinger (2009).** *Performance Factors Analysis.* AIED. — **PFA**; success/failure counts. Rung 2.
- **Pelánek (2016).** *Applications of the Elo rating system in adaptive educational systems.* — **Elo** for skill/difficulty; the pragmatic cold-start default. Rung 3.
- **Embretson & Reise (2000).** *Item Response Theory for Psychologists.* — **IRT**; ability × difficulty; item calibration. Rung 3.
- **Piech et al. (2015).** *Deep Knowledge Tracing.* NeurIPS. — **DKT**; sequence models. Rung 4.
- **Zhang et al. (2017).** *Dynamic Key-Value Memory Networks for Knowledge Tracing.* WWW. — **DKVMN**; per-KC memory. Rung 4.
- **Yudelson, Koedinger & Gordon (2013).** *Individualized BKT.* AIED. — Per-learner BKT params; personalization.

### Calibrating instruction to state (the policy layer, §5)
- **Vygotsky (1978).** *Mind in Society.* — **ZPD**; teach just above current capability → retrieval boost of `level+1`.
- **Wood, Bruner & Ross (1976).** *The role of tutoring in problem solving.* — **Scaffolding** calibrated to state and withdrawn as competence grows.
- **Bloom (1968).** *Learning for Mastery*; **Bloom (1984)** *The 2 Sigma Problem.* — **Mastery learning**; gate on mastery, and the aspirational effect size.
- **Barnett & Ceci (2002).** *When and where do we apply what we learn?* Psych Bulletin. — Near/far **transfer** taxonomy → `TransferProblem` design.
- **Sweller (1988); Sweller, van Merriënboer & Paas (1998/2019).** *Cognitive load theory.* — Feedback/scaffolding shaping to avoid overload.
- **Bull & Kay (2007).** *Student Models that Invite the Learner In: The SMILI Open Learner Modelling framework.* IJAIED. — **Open Learner Models**; showing state back to the learner (favor interpretable estimators).
- **Corbett & Anderson (1995).** *Mastery learning with BKT / knowledge tracing in the tutor.* — Ties the estimator to the gate.

### Simulated / proxy learners & validity (§7–8)
- **Matsuda et al. (SimStudent / learning by teaching).** — ML agents that learn like students to evaluate instructional designs.
- **MacLellan et al. — Apprentice Learner framework.** — Simulated students for tutor evaluation.
- **Markel et al. (2023). *GPTeach*.** CHI/L@S. — LLM-simulated students for teacher training.
- **Restrained-knowledge LLM tutees — *TeachYou / AlgoBo* (2024).** arXiv:2406.19226. — Constrain an LLM to a knowledge state / misconceptions.
- **Machine unlearning for novice simulation** — "Simulating Novice Students Using Machine Unlearning and Relearning in LLMs." — Excise then relearn knowledge (open-weight only).
- **Validity caveats** — "Can LLMs Reliably Simulate Real Students' Abilities?" (arXiv:2507.08232); "Towards Valid Student Simulation with LLMs." — Proxies are often miscalibrated (too capable, too fast).
- **TutorGym** — testbed for AI agents as both tutors and students.

### Retrieval / RAG grounding (the knowledge source, Knob B)
- **Lewis et al. (2020).** *Retrieval-Augmented Generation.* NeurIPS. — RAG baseline that TeachMe inverts (utility over similarity).
- See `docs/references.md` §4 for the fuller retrieval bibliography.
