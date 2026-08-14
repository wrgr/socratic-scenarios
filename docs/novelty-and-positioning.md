# Novelty & positioning — can this be a paper in its own right?

A candid assessment of what in this work is **defensibly novel**, what is **established
reuse**, how to **frame** a paper so it survives review, and what **evidence we still
need** to defend it. Grounded in a targeted prior-art scan (Aug 2026) across three
axes: proxy-student ITS validation, corpus-bounded tutoring + leakage detection, and
control-task transfer instruments.

> One-line answer: **Yes, but not as "we built a learner agent" or "a COLREG tutor."**
> The defensible paper is a **methods/measurement contribution** — an in-silico
> instrument and diagnostic method for corpus-bounded instruction. Every *component*
> is prior art; the *unified instrument* and the *reference-optimal transfer metric*
> are the open ground.

---

## North Star (single source of truth — read this first)

**Goal.** Given a model and a corpus (a RAG store, an instructional corpus), measure **how much
of the corpus the learner actually uses** — which items it *relies on*, which it *already knew*
(redundant), which it *ignores* — as a behavioral outcome, in silico, before any expensive human
trial. Two questions, one instrument:

- **C1 — Corpus Diagnosis** (the product). Run the task instrument *backwards* on the corpus:
  - **(i) Localize** — attribute a task failure to *which specific corpus rule* is missing/wrong (fix the RAG).
  - **(ii) Necessity / leakage** — ablate a rule; if behavior doesn't change, the model used priors, not the corpus.
  - **(iii) Why-not-needed split** — a rule whose ablation doesn't move behavior is `leaking`, but *why*
    splits into two opposite verdicts, discriminated by the **with-corpus regret**: `redundant` (competent
    with the rule present, regret ≈ 0 — the model already knows it, so drop it) vs `unusable` (fails the task
    *even with the rule present*, regret ≈ full barrier — the item has value, this model just can't act on it,
    so fix the model, not the corpus). Ablation-delta alone conflates these; regret-with separates them.
    Observed on real Bedrock models: every model reads the textbook COLREG rules `redundant`, while Llama-70B
    reads the corpus-only charted hazard `unusable` (grounds regardless, regret-with ≈ 1207) where Haiku/Sonnet
    read it `corpus-bound`.
- **C2 — Transfer Instrument** (what makes C1's score objective). Score the learner by its
  **regret against a reference-optimal policy** in a simulator, with \kc→single-metric identifiability.
- **C1b — Corpus Sufficiency** (co-equal claim; the product face of C1). Roll the per-item verdicts
  into a corpus-level judgement for a query set: `contributing` (every item relied upon — lean),
  `partial` (some relied-on, some redundant-prunable, some unusable), `unusable` (content present,
  the model can't exploit it), or **`redundant` / FALSE SUFFICIENCY** (nothing relied upon and the
  model answers closed-book — the corpus adds ~nothing; task success rides on priors and is fragile
  to distribution shift). Implemented in `src/engine/audit-sufficiency.ts`; printed by both runners.
  **Scoping condition (state it up front, it is intrinsic):** sufficiency is *always relative to the
  probed query set* — "sufficient for these queries." An item scored redundant here may be necessary
  for queries not exercised. This is not a differential weakness (RAGAS metrics are equally
  eval-set-bounded); the honest move is to (a) always report the query count, (b) test held-out and
  distribution-shifted queries, and (c) lean on the FALSE-SUFFICIENCY detector — necessity ≈ 0 is the
  *measurable* warning that a bounded-query sufficiency claim won't survive shift, which is exactly
  the risk the bounded set cannot otherwise see.

**The one novel delta** (defend it explicitly; see §5): prior work — faithfulness (RAGAS),
context attribution by ablation (ContextCite), knowledge-conflict, prior-dominance — measures
whether context *influenced* the output, on answer text. We measure **necessity, per rule, on a
behavioral task outcome**, and *calibrate* it by manipulating the parametric baseline directly
(weight-level construction + unlearning) — so a fact the model already knew is not counted as one
it relied on. No context-attribution method has that weight-level ground truth.

**Where the arms fit** (so the story doesn't drift again):
- The **hidden-hazard probe + dose-response** (`experiments/unlearning`, `PROBES=hazard`) is the
  *validation* that the necessity measure is real (teach a fact in → reliance falls; remove it → rises).
- The **unlearning arm** is the second, noisier direction of that same weight-level calibration — **supporting evidence, not the headline.**
- The **localization** half of C1 (§8, Experiment 3) is the product demo (`PROBES=all` corpus-value audit).
- The **second domain — fact-QA** (`src/engine/factqa`, `npm run factqa:leakage`) is the
  external-validity arm: the SAME necessity measure and the SAME `classify()` verdict, but scored by
  an answer-checker on a **fictional-fact** KB instead of a simulator. It reframes the contribution
  from "a maritime regret simulator" to "necessity on any verifiable objective — instantiated with a
  control-regret simulator AND an answer checker," and it directly answers the *you-engineered-the-
  objective* and *toy-domain* objections. Its dose-response is a clean, smooth monotone curve
  (partial-teaching at single-fact granularity resolves the gradient with no difficulty ladder).

> **Experiment register & status — see [`docs/experiment-status.md`](experiment-status.md).** That
> one page is the canonical "what each experiment is, what we have, what's next," with the critical
> path. Keep it current; if this box and that page ever disagree on status, the register wins.

Everything below is the detailed prior-art scan and evidence checklist behind this summary; if it
disagrees with this box, this box wins.

---

## 1. What is NOT novel (state this plainly, up front, in the paper)

Claiming any of these as a contribution gets the paper desk-rejected on novelty:

| Piece | Prior art that forecloses it |
|---|---|
| Learner agent internals (KC mastery, BKT, Elo, PFA, DKT, ZPD, mastery gates, OLM) | Corbett & Anderson 1994; Pelánek 2016; Koedinger/Corbett/Perfetti 2012 (KLI); Vygotsky 1978; Bull & Kay 2007 |
| RAG-grounded / abstaining tutor | Standard engineering; LPITutor 2025, DeepTutor 2026, TutorLLM 2025 |
| Proxy / simulated students to test tutoring | SimStudent & Apprentice Learner (Matsuda/MacLellan/Koedinger); GPTeach 2023; TutorGym 2025 |
| Knowledge ablation / unlearning / restrained-knowledge prompting in LLMs | Song et al. 2026; Apartsin et al. 2026 |
| COLREG collision-avoidance + Imazu/VO/SB-MPC benchmarking, per-rule compliance scoring | Mature maritime-autonomy field (Ocean Eng. 2024; Reliab. Eng. 2025) |
| Regret-vs-optimal as a quantity | RL/control (AAMAS 2024 transfer-as-regret); IRL driver scoring |

**Implication for writing:** foreground these as the *shoulders we stand on*. Reviewers
punish hidden reuse and reward honest reuse + a sharp delta.

---

## 2. Candidate contributions, ranked by how defensible they are

### C1 — Single-instrument, bidirectional corpus diagnosis  ★ strongest / most open
Use **one objective task instrument** on a corpus-bounded learner to do two things
that the literature only does separately:
- **(i) Localize corpus gaps** — attribute measured task failures to *which specific
  rule/node is missing or wrong* in the corpus (fix the RAG).
- **(ii) Detect parametric leakage** — remove a rule from the corpus; if the metric it
  governs does **not** degrade, the model is answering from pretrained priors, not the
  corpus. Same instrument, opposite direction.

Nearest precedents, and the gap each leaves:
| Work | What it does | What it doesn't |
|---|---|---|
| **ContextCite** (Cohen-Wang et al., NeurIPS 2024, arXiv:2409.00729) | **ablate context sources → fit a surrogate on the output log-prob change → attribute the generation to sources** | attributes *text generation* (log-prob), per token/source; validates against ablation, **not weight-level ground truth**; measures **influence, not necessity** |
| RAGAS / faithfulness metrics (2309.15217) | LLM-judge whether an answer's claims are grounded in context | scores *grounding of text*, not whether the model *needed* the context; no parametric baseline |
| Knowledge-conflict (survey 2403.08319; FaithfulRAG 2506.08938) | when context contradicts memory, which wins | QA/answer-text; no per-rule localization, no governed task metric |
| SeedRG — leakage-free RAG benchmarks (2605.08838) | "no-context accuracy ⇒ leaked item," filter/regen | removes *context at query time* on QA; no corpus-as-variable, **no localization** |
| Quantifying Prior Dominance in RAG (2606.23695) | ablate context → measure degradation, aggregate "prior dominance" | system-level metric, **not per-rule**, no learner/task instrument |
| Farahani & Johansson, EMNLP 2024 | parametric-vs-contextual via causal mediation | interpretability internals, not a black-box downstream instrument |
| Error attribution — REFLECT, FALAT (2026) | attribute failures to retrieval-vs-reasoning/step | not to *specific corpus knowledge items*, no paired leakage test |

**Verdict:** the ablation *primitive* (remove a piece of context, watch the output move) is **not
novel** — ContextCite is the clearest precedent. Our unclaimed ground is the *combination*:
(a) scoring a **behavioral task outcome** vs a reference policy, not answer text; (b) attributing
**per corpus rule** with **localization**; and (c) turning influence into **necessity** by
calibrating against a parametric baseline we *manipulate directly* (weight-level construction +
unlearning) — which no context-attribution method does. State (a)+(b)+(c) as the delta; do **not**
claim the ablation idea itself.

### C2 — Reference-optimal control simulator as a transfer instrument + KC→metric identifiability  ★ strong (measurement contribution)
Replace item-response / knowledge-tracing correctness with an **objective
continuous-control simulator whose reference-optimal solver yields regret-vs-optimal**
(plus per-rule compliance) as the *learning/transfer* outcome — and establish the
**KC → single-metric isolation** property: each knowledge component governs exactly one
metric, so ablating it degrades that metric and no other, validated by
**construct validity** (naive vs expert policy separation) before any learning claim.

Nearest precedents, and the gap each leaves:
| Work | What it does | What it doesn't |
|---|---|---|
| Flight competency by deviation-from-optimal trajectory (Zinn et al. 2023/24) | score human flight vs an intended/optimum path | reference is a *nominal* path, not a solver-generated regret; no KC decomposition |
| VR surgical sim construct validity (LapSim, Van Dongen 2007; robotic curricula 2024) | validate metrics by novice/expert separation | raw time/economy metrics; no optimal-solver regret; manual-skill, not decision/control |
| Control Knowledge Tracing (CAEAI 2024) | control-theory *math* for knowledge dynamics | outcome is still discrete question correctness — classic KT in control notation |
| "Learning to Prompt" tutoring (2026, 2606.20138) | uses "regret" in a tutoring sim | regret over the *tutor's* policy, not a learner's control actions; no instrument |
| COLREG compliance scoring (Ocean Eng. 2024) | per-rule compliance/penalty scores | scores *autonomous ships*, not learners; no education/transfer/regret framing |

**Verdict:** integration is open. The scan found **no** work establishing KC→single-
metric isolation as a measurement-design principle, nor regret-vs-optimal-as-transfer-
instrument replacing KT. Frame as *borrowing mature autonomy tooling as an instrument*,
never as new collision-avoidance technique.

### C3 — In-silico pre-trial validation via two complementary proxy classes  ☆ moderate (framing)
Run **both** a parametric competence-vector learner **and** a knowledge-suppressed LLM
learner as complementary proxies on the objective instrument, as a **pre-human-trial
go/no-go** on an instructional method.

Nearest precedents, and the gap each leaves:
| Work | What it does | What it doesn't |
|---|---|---|
| Song, Guo & Lin (2026, arXiv:2603.26142) | machine-**unlearn** an LLM into a stable novice | learning-by-teaching; scored on **dialogue behavior**, not a task instrument; no pre-trial framing |
| Apartsin et al. (2026, arXiv:2605.25601) | simulated student as a **skill vector**, knowledge suppressed | prompt-based; scored on **profile alignment**; no intervention validation |
| Lu & Wang, L@S 2024 (2405.11591) | KLI LLM profiles evaluate **assessment items** | artifact is an item, not a tutoring method; no ablation/parametric learner |
| Agent4Edu, AAAI 2025 (2501.10332) | generative learners evaluate **adaptive testing** | testing not tutoring; personas, not ablated; outcome = response fidelity |
| SimStudent / Apprentice Learner; TutorGym 2025 | parametric simulated learners author/eval ITS | pre-LLM or agent-competence benchmarking; not a pre-trial value screen |

**Verdict:** defensible **only** if differentiated head-on from Song 2026 and Apartsin
2026 on three axes — (a) objective *task instrument* outcome, (b) *two complementary
proxy classes* cross-checked, (c) explicit *pre-human-trial* screen. These are "one
differentiator away," so cite them prominently and own the delta.

---

## 3. The recommended paper

**Title (working):** *An in-silico instrument for pre-validating corpus-bounded
instruction: reference-optimal transfer measurement with bidirectional corpus-gap and
leakage diagnosis.*

**Thesis:** before spending human-subject effort, you can falsify an instructional
method's *mechanism* cheaply — if you have (C2) an objective transfer instrument with
KC→metric identifiability and (C1) a single-instrument diagnostic that both localizes
corpus gaps and detects parametric leakage, exercised by (C3) complementary proxy
learners. COLREG collision avoidance is the worked domain; the method is the point.

**Headline contribution = C1 + C2.** C3 is the application that demonstrates them.
Do **not** lead with the learner agent or the tutor — those are infrastructure.

**Honest scope:** this is **simulation-based mechanism evidence, not human external
validity.** A methods/measurement paper can stand on that *if* it validates the
instrument on its own terms and explicitly gates human-learning claims.

**Venue fit:**
- Best: **EDM**, **AIED**, **LAK**, **Learning @ Scale** (methods/measurement tracks).
- Also: an **AI-for-Education workshop at NeurIPS/ICML** (fast, fits the LLM-proxy angle).
- **Not** a learning-gains venue (e.g., a psychology/education outcomes journal) — that
  requires the cohort study we have not run.

---

## 4. What we must add to defend it (evidence checklist)

Current repo status → what's still needed:

- [x] **Construct validity** of the instrument (naive vs VO vs SB-MPC separation) — built.
- [x] **Competence→performance gradient** (θ acquired in curriculum order) — built; clear + restricted-visibility regimes.
- [x] **Corpus-gap diagnosis** localization (`diagnose.ts`) — built.
- [x] **Generic learner agent** with pluggable estimators (BKT/Elo) — built.
- [x] **Estimator/instrument recovery + calibration** — built (`src/engine/learner-agent/validation.ts`, `__tests__/recovery.test.ts`, `npm run learner:recovery`). On synthetic data from a *known* ground truth: **Elo** recovers static ability to mean abs error **0.046** with calibration **ECE 0.023**; **BKT** recovers the latent known-state (P(L̂) **0.997** for truly-learned vs **0.175** for not) with **ECE 0.004**. Turns "we have a metric" into "the measurement is valid."
- [x] **Leakage experiment, end to end** — harness built, *validated offline*, and *run on two real LLMs*
  (`src/engine/colreg-sim/leakage.ts`, `__tests__/leakage.test.ts`, `npm run colreg:leakage`).
  The bidirectional loop (ablation-delta + counterfactual adherence + `diagnose`
  localization + closed-book baseline) runs against two reference mock learners whose
  ground truth is known, and recovers it exactly: the corpus-bound mock → **δ 1.000**,
  follows the counterfactual, abstains closed-book → *corpus-bound*; the leaking mock →
  **δ 0.000**, ignores the counterfactual, answers closed-book → *leaking*. **Now also run
  on two real LLMs** (Gemini `flash-latest` and `flash-lite-latest`, both prompt
  conditions): under the strict prompt both are diagnosed *corpus-bound*; removing the
  binding clause collapses ablation-δ to 0.000 and flips closed-book to contamination on
  both, with the composite verdict flipping fully to *leaking* on the lighter model. Table
  in `necessity-audit/companion/main.tex`. Broadening to more models (esp. weak instruction-followers)
  remains.
- [x] **Second domain** — built (`src/engine/procedure-sim/` + `src/corpus/tire/procedure.ts`). A *discrete procedural* task instrument (roadside tire change) alongside the *continuous-control* COLREG one, demonstrating the method transfers across task structures: construct validity (expert J=0 vs reckless J=200, safety violation caught), **exact KC→single-metric identifiability** (each ablated competence degrades only its governed metric), a monotone competence→performance gradient (J 204→0), and an end-to-end pipeline test feeding the instrument's outcomes into the generic learner agent. `__tests__/procedure.test.ts` (10 tests).
- [x] **Sensitivity analysis** over the instrument weights (domain, objective) — built and run (`src/engine/colreg-sim/sensitivity.ts`, `npm run colreg:sensitivity`, `__tests__/sensitivity.test.ts`). Behavior held fixed, re-scored under 232 perturbations (one-at-a-time ±25–50% sweep + 200 joint ±40% samples): the policy-separation ranking *and* the competence→performance gradient are preserved on **every** perturbation (Kendall **τ = 1.00**, invariant rate **100%**). CRI is excluded by construction (it is a reported diagnostic, not a term in the scored objective J). Folded into the paper as a *result* (§instrument, "Robustness to weighting choices") and the limitation retired. (This also surfaced and fixed a latent bug: the overtaking instrument case had a malformed `leadTarget` call — target speed `NaN`, so naive trivially "cleared" it; the corrected geometry makes naive collide, and Table `tab:construct` was updated — naive cleared 22%→11%.)
- [x] **Head-on related-work differentiation** — the related-work "Proxy learners" paragraph now cites Lu & Wang 2024 (`luwang2024`) and Agent4Edu 2025 (`agent4edu2025`) alongside the already-present Song 2026, Apartsin 2026, PS² 2026, SeedRG 2026, Prior Dominance 2026, and Control-KT 2024.
- [x] **Proxy-validity limitation section** — expanded to argue against ourselves, citing "Towards Valid Student Simulation" (`validsim2026`, 2601.05473) and two fidelity critiques with repo-verified metadata: Wu et al. (`studentfidelity2025`, 2505.19997) and Srivatsa et al. (`studentabilities2025`, 2507.08232). (The checklist's third id 2605.12748 had no traceable metadata anywhere in the repo, so the documented 2507.08232 fidelity critique was cited in its place.)

---

## 5. Related-work paragraph → see the paper (single source)

The canonical, up-to-date related-work text lives in `necessity-audit/companion/main.tex`
(§"Related work and positioning"). It positions against faithfulness (RAGAS), context attribution
by ablation (**ContextCite** — the closest precedent), knowledge-conflict, prior-dominance, and
SeedRG, and states the delta as (a) behavioral task-outcome scoring, (b) per-rule localization,
(c) **necessity, not just influence**, calibrated by weight-level construction/unlearning. Do not
maintain a second copy here — edit the paper.

### 5a. Sharpened RAGAS / ContextCite delta (fold into `main.tex` related-work)

The fact-QA domain (`src/engine/factqa`, the **first simulator-free** instantiation — the COLREG and
tire domains both use a scored simulator) sits visibly close to RAG evaluation, so the delta must be
drawn on *necessity vs. known parametric baseline*, not on "we ablate context" (a known trick). The
incumbents all score a single *(question, retrieved-context, answer)* instance:

| Method | Measures | Cannot tell you |
|---|---|---|
| RAGAS **faithfulness** | is the answer *supported by* the context | whether the model *needed* it — a prior-driven answer that agrees with context scores high |
| RAGAS **context recall** | is the answer *present in* the retrieved passages | whether the model *used* it, already knew it, or can't use it |
| RAGAS **answer correctness** | answer vs a reference | nothing about corpus attribution |
| **ContextCite** (closest) | which context sentences *influenced* the output (ablation on logprobs) | necessity for *task success*; and it is uncalibrated — flags an influential sentence even if the model already knew the fact |

The three moves none of them make: (1) **counterfactual necessity on a task outcome** (ablate the
item, measure behavior) — not support/influence-on-text; (2) **weight-level known-groups calibration**
(fictional facts / dose-response fix the parametric baseline, so necessity is provably about the
corpus, not confounded with what the model already knew) — the construct-validation RAG-eval papers
structurally lack; (3) the **relied-on / redundant / unusable** trichotomy — no RAGAS analog (context
recall can confirm "the answer is in the corpus" and stay blind to both leaking regimes).

### 5b. The sufficiency headline: FALSE SUFFICIENCY (the diagnostic RAGAS can't produce)

Because necessity is calibrated against a known parametric baseline, the audit can detect a corpus
that **looks sufficient only because the model is coasting on priors**: high task accuracy + high
faithfulness, yet necessity ≈ 0 everywhere. Standard RAG metrics are all green in this case; ours
flags it (`FALSE SUFFICIENCY`). The product line — *"is your corpus carrying the load, or is it a
liability waiting for a distribution shift?"* — is more legible than "we measure faithfulness better,"
and it is the honest handle on the bounded-query limitation (necessity ≈ 0 is the measurable warning
that the bounded-query sufficiency claim won't survive shift). This is distinct from RAGAS context
recall, the nearest neighbour: recall is a *retrieval* property (is the answer string in the
passages, needs a reference answer, ignores the model); sufficiency-via-necessity is *behavioral and
parametric-calibrated* (does the model need, and can it use, content it could not supply itself).

---

## 6. Threats to the novelty claim (and mitigations)

- **Fast-moving 2026 preprints.** Song et al. and Apartsin et al. are recent and "one
  differentiator away." *Mitigation:* move quickly, cite them prominently, and make C1
  (the unified diagnostic) — not the proxy-learner idea — the headline.
- **"Integration of known parts" critique.** *Mitigation:* lead with the single-
  instrument leakage+localization result, which the scan found genuinely unclaimed;
  show it does something neither half can do alone.
- **Single instrument / single domain.** *Mitigation (done):* a second instrument
  now exists — a discrete procedural task (`procedure-sim`, tire change) alongside the
  continuous-control COLREG one — so KC→metric identifiability is demonstrated as a
  *general* property across two very different task structures, not a COLREG artifact.
- **Mechanism ≠ external validity.** *Mitigation:* scope the paper as methods/
  measurement; pre-register the human study as future work; never claim learning gains.

---

## 7. Verdict v2 — unlearning-informed

After folding in the machine-unlearning / knowledge-ablation literature
(`docs/unlearning-ablation-refs.md`), the contribution map sharpens:

- **C3 (controlled-competence proxy learners) is no longer a standalone contribution.**
  Three papers now sit on it: **PS² (arXiv:2602.00850)** does *parametric* competence
  interpolation (strong↔weak model), **Song 2026 (2603.26142)** does unlearning→novice,
  **Apartsin 2026 (2605.25601)** does skill-vector suppression. Reposition C3 as
  *application* — we instantiate known proxy methods on our instrument — and cite these
  as the methods used, not competitors.
- **One real delta vs the closest paper survives:** Song 2026 needs **open weights**
  (you cannot unlearn a closed model). Our corpus-ablation + *behavioral* leakage
  detection on a task instrument is **closed-model-compatible** (Gemini/OpenAI/etc.).
  That widened applicability is defensible — lead with it when distinguishing Song.
- **C2 (reference-optimal control-task instrument + KC→metric identifiability) is
  unaffected** by the unlearning lit (orthogonal, measurement axis) and remains the
  strongest clean contribution.
- **C1 (bidirectional diagnosis):** the *leakage half* is the least original piece — it
  echoes TOFU's no-context heuristic (2401.06121), MUSE's suppressed-vs-removed
  distinction (2407.06460), SeedRG (2605.08838), Prior Dominance (2606.23695), and the
  verification cluster (Deeb & Roger 2410.08827; "verification is fragile" 2408.00929).
  The *join* — localize a gap AND detect leakage on the **same objective control-task
  metric over a governed external corpus** — is what none of them do together. Plant
  the flag there.

### Closest three to beat (one-line differentiation)

| Closest prior | The gap you exploit |
|---|---|
| **Song 2026** — unlearning→novice LLM | scored on dialogue/relearning, **open-weights only**; you: objective control-task instrument, **closed-model-capable** |
| **PS² 2026** — parametric competence | a proxy-generation method with **no task instrument and no leakage diagnosis**; you: the instrument + the bidirectional audit |
| **SeedRG 2026** — no-context leakage filter | **aggregate benchmark-cleaning, no localization**; you: per-rule, on a governed task metric, both directions |

### The structural critique, and the fix

A reviewer's sharpest attack: *"your 'ablation' is RAG-context removal, not weight
unlearning — so C1 is the no-context heuristic dressed up, and the ablated learner is
just prompting."* The strong answer is not a defense but an **open-weight arm**
(Experiment 2, §8): use a real unlearning method (NPO/RMU) to actually remove the
alter-to-starboard knowledge from an open model and score it on the reference-optimal
instrument. Nobody has scored an *unlearned* learner on a control-task regret metric;
this (a) neutralizes the "just prompting" critique, (b) connects to Song 2026 with a
genuine delta (objective task outcome vs dialogue), and (c) gives C1 a weight-level
leakage result beside the context-level one.

### Headline framing (v2)

> A **closed-model-compatible, single-instrument method** that both **localizes corpus
> gaps** and **detects parametric leakage** on an **objective control-task transfer
> metric** — validated with controlled-competence proxies, and (with the open-weight
> arm) cross-checked against genuine machine unlearning.

---

## 8. Experiment specs (ready to run)

Two experiments move C1 from "plausible" to "hard to reject." Written to be runnable
as soon as quota/compute is available.

### Experiment 1 — Corpus-binding positive control + cross-model discrimination
*(closed models; validates C1; cheap)*

**Claim tested.** The instrument does not merely *confirm* corpus-binding — it
*discriminates* corpus-bound from leaking behavior, across models.

**Design.** Fully crossed, per model:
- **Prompt condition** (the positive control): `bound` = the current strict prompt
  ("use ONLY these rules; if not covered, abstain"); `unconstrained` = same prompt with
  that clause removed and replaced by "use your knowledge of the COLREGs and any
  provided rules." Optionally `closed-book` (no corpus).
- **Corpus manipulation** (per condition): `full`, `ablate steering rule`
  (RULE-COLREG-14/15), `counterfactual` ("alter to PORT").
- **Instrument.** The head-on + starboard-crossing subset already used by
  `leakage.ts` (extend to ~8–10 cases for tighter means).

**Models.** 3–4 spanning capability: e.g. `gemini-flash-latest` (3.6), a Gemini 3
`pro`/`3.5-flash`, one OpenAI-compatible model, and one small/weak model (weak
instruction-followers are the interesting leak cases).

**Metrics** (per model × prompt-condition): ablation-delta on mean compliance penalty;
counterfactual-adherence (fraction turning port); closed-book abstention rate; and the
`corpus-bound / leaking / inconclusive` verdict.

**Predicted result table** (the shape to fill):

| Model | Condition | ablation-δ | cf-adherence | abstains | Verdict |
|---|---|---|---|---|---|
| M1 | bound | high (↑) | yes | yes | corpus-bound |
| M1 | unconstrained | ~0 | no | no | leaking |
| … | … | … | … | … | … |

**Success criterion.** The verdict **flips** bound→unconstrained on ≥3/4 models, and
ablation-δ separates the two conditions by ≥ the δ threshold (0.15) with margin. A
weak model that leaks *even under* the bound prompt is a feature — it shows the
instrument catches binding failures the prompt intended to prevent.

**Code delta (small).** Add an `unconstrained` prompt variant to `llm-learner.ts`
(`buildPrompt(scenario, corpus, { strict: false })`) and a `--condition` flag to
`scripts/colreg-leakage.ts`. No new engine logic.

**Budget / quota.** ~ (2 × Nsubset) + 2 per (model × condition) calls. On Gemini free
tier (≈20/day) this needs several days or a paid key; an OpenAI-compatible paid
endpoint runs it in one sitting. Throttle via `GEMINI_RPM` (already wired).

### Experiment 2 — Open-weight unlearning arm
*(neutralizes the "just prompting" critique; connects to Song 2026; higher cost — needs a GPU)*

**Claim tested.** The instrument reads *weight-level* knowledge state: an actually-
unlearned model fails the governed metric without the corpus and recovers with it.

**Setup.**
- **Model.** An open-weight instruct model (e.g. Llama-3.1-8B-Instruct or
  Qwen2.5-7B-Instruct), LoRA-friendly.
- **Ablation.** Remove the alter-to-starboard knowledge with a real method — **SimNPO**
  (Fan et al. 2024, arXiv:2410.07163) as primary (reference-free, length-normalized NPO;
  better forget-quality/utility tradeoff), with **NPO** (2404.05868), **RMU** (2403.03218),
  and gradient-ascent (2210.01504) as comparisons. For a *stable* novice that resists
  benign relearning, layer in the robust utility-preserving recipe of Fan et al. 2025
  (arXiv:2509.02820). *Forget set* = Rule 14/15 statements + paraphrases; *retain set* =
  other COLREG rules + general instruction data (guard utility).
- **Removal audit** (required, per Lynch 2402.16835): pre/post probes, paraphrase &
  jailbreak probes, and a benign-relearning test (2406.13356) — report whether the
  knowledge is *gone* vs *suppressed*.

**Conditions (2×2) scored on the instrument** (compliance penalty, lower = better):

| Model state | No corpus | Corpus present |
|---|---|---|
| Base (not unlearned) | low (turns starboard from priors — contamination baseline) | low |
| Unlearned | **high** (knowledge gone → wrong/held) | **low** (recovers *from the corpus*) |

**What each cell proves.** Base/no-corpus low = the model has the knowledge in weights
(why binding must be enforced). Unlearned/no-corpus high = the ablation worked *and the
instrument detects the missing knowledge*. Unlearned/corpus low = corpus-reliance
demonstrated at the weight level (the learner recovers only because the corpus supplies
what was removed). If unlearned/no-corpus stays **low**, the unlearning failed / left
latent knowledge — and the same instrument flags it (weight-level leakage).

**Bonus.** Partial/interpolated unlearning (à la PS²) yields a **competence gradient**
on the instrument — a second, weight-level instance of the C2 KC→metric mapping.

**Cost / infra.** One GPU; LoRA unlearning on a 7–8B model is hours, not days.

**Status: harness built + a real CPU unlearning result** (`experiments/unlearning/`). The
full pipeline — dataset build → LoRA unlearn (**SimNPO** primary + NPO + gradient-ascent,
reference-via-adapter-disable) → removal audit → serve for scoring — runs, and produced a
genuine result on **Qwen2.5-1.5B-Instruct** (a model that actually knows the rule): the
primary **SimNPO** method strongly **suppresses** the alter-to-starboard behavior —
forget-target NLL **4.6 → 92**, held-out direction-cue rate **5/6 → 0/6** (robust to the
starboard→right synonym) — while retain knowledge (lookout, safe speed, restricted
visibility) stays coherent. The **NPO** baseline gives the same qualitative collapse
(**4.6 → 41**, **5/6 → 0/6**), so the suppression is method-agnostic. The same SimNPO recipe
now **reproduces the forget-target NLL collapse on GPU at larger scale** (Qwen2.5-3B-Instruct,
bf16): forget-set NLL **5.5 → 33.9** — the robust cross-scale signal. The other two rows are
weaker at 3B and were the reason the audit was hardened: retain NLL is *teacher-forced*
(**3.5 → 0.26**) but free generation degrades (off-language/repetitive), so it overstates
utility (now also report retain **coherence**); and the direction-cue barely moved
(**5/6 → 4/6**, n=6, within noise) with some answers turning the *wrong* way or garbling —
so `audit.py` now classifies each answer survived/wrong/degenerate/abstained rather than
counting one keyword, and the forget/retain and probe sets are generated in the hundreds. The
audit is also hardened for the rerun along the axes a single number misses: **paraphrase /
jailbreak / indirect** probes (survived-rate by type — high on non-direct ⇒ suppressed, not
gone), a **benign-relearning** test (`relearn.py`: do a few steps restore the behavior?), and
**seed/method variance** (`--seed`, `METHOD=`) rather than a single run. Honest scope: this is
behavioral/target suppression + teacher-forced NLL, **not** verified semantic *removal* — that
is precisely what the task-level instrument settles (below). It is the weight-level counterpart
to the context-level leakage result, and the objective-audit direction over dialogue-scored
unlearning (Song et al. 2026). **Remaining step (no longer hardware-gated):** score the
base/unlearned model on the reference-optimal *instrument* (the 2×2 regret/compliance) via
`serve.py` → `openAiCompatCompleter` → `npm run colreg:leakage` — the scoring side is already
built and a one-tap Colab notebook (`colab.ipynb`) runs it end to end. The audit-level result
is now in hand on both CPU (1.5B) and GPU (3B); the task-level 2×2 is the outstanding piece.
See `experiments/unlearning/README.md`.

### Experiment 3 — Corpus-value audit / localization (the C1(i) half — **view built**, run on a real model)

The product demo: attribute an *induced* task failure to the *specific* corpus rule, and rank the
corpus rules by how much the learner **relies on** each — "how much of the corpus is helpful."

- **Built.** `PROBES=all npm run colreg:leakage` now prints, after the per-rule detail, a
  **corpus-value audit**: rules sorted by necessity (ablation-delta), a `governs→localizes`
  confusion cell (the component the rule governs vs the component its ablated-failure points to),
  the per-rule verdict, and a one-line summary (*N rules · K relied-on · M redundant/leaking*). The
  mock recovers the ground truth (14 relied-on, 19 localizes cleanly `safeSpeed→safeSpeed`, and — a
  real signal, not a bug — **Rule 15's starboard is redundant given Rule 14**, so it ranks last).
- **To run on a real model.** Use the live completer (`BEDROCK_MODEL=…`) or the offline
  DUMP→generate→REPLAY flow, `PROBES=all`. Extend the probe set beyond 14/15/19 (add role 16/17,
  substantial 8) to widen the confusion matrix — each needs a matched scenario subset.
- **Result to report.** (a) The **necessity ranking** = the corpus-value audit (relied-on vs
  redundant). (b) The `governs→localizes` matrix: a clean diagonal (e.g. `safeSpeed→safeSpeed`)
  means the instrument localizes; off-diagonal (e.g. `starboard→role`, an ablated steering rule that
  makes the learner *freeze* rather than turn wrong) is itself informative about the failure mode.
- **Cost.** API calls only, no training — the cheapest high-value experiment, and it complements the
  hazard dose-response (which validates the *necessity* reading) with the *localization* reading.
- **Confounds.** Entangled/redundant rules blur the diagonal (Rule 15 above is exactly this, and
  the audit surfaces it); report the redundancy as the decomposability measure, don't hide it.

---

## 9. Prior-art appendix (URLs, for the bibliography)

**Proxy students / simulated learners:** Song, Guo & Lin 2026 (arXiv:2603.26142) ·
Apartsin, Sason & Aperstein 2026 (arXiv:2605.25601) · Lu & Wang, L@S 2024
(arXiv:2405.11591) · Agent4Edu, AAAI 2025 (arXiv:2501.10332) · SimStudent eval, CEUR
Vol-1432 2015 · TutorGym 2025 (arXiv:2505.01563) · GPTeach, L@S 2023 · TutorUp 2025
(arXiv:2502.16178) · Towards Valid Student Simulation 2026 (arXiv:2601.05473).

**Corpus-bounded tutoring & leakage/faithfulness:** SeedRG 2026 (arXiv:2605.08838) ·
Quantifying Prior Dominance in RAG 2026 (arXiv:2606.23695) · Farahani & Johansson,
EMNLP 2024 · FaithfulRAG 2025 (arXiv:2506.08938) · KnowOrNot 2025 (arXiv:2505.13545) ·
DeepTutor 2026 (arXiv:2604.26962) · LPITutor, PeerJ CS 2025 · REFLECT 2026
(arXiv:2606.09071) · FALAT 2026 (arXiv:2606.00765).

**Control-task instruments / regret:** Zinn et al., Cogn. Tech. Work 2023 · LapSim
construct validity, Surg. Endosc. 2007 · Control Knowledge Tracing, CAEAI 2024 ·
Learning to Prompt 2026 (arXiv:2606.20138) · COLREG compliance scoring, Ocean Eng.
2024 · maritime training analytics 2025 (arXiv:2507.01274) · transfer-as-regret,
AAMAS 2024.

> Note: several closest matches are mid-2026 preprints; verify venue/version at
> submission time, and re-run the scan — this space is moving fast.

---

## 10. Re-scan addendum — 2026-08-06

A second, independent prior-art sweep (three targeted searches, one per contribution).
**All three novelty claims survive.** The sweep surfaced four new closest-neighbors that
must now be *cited explicitly* (they strengthen the positioning rather than foreclose it),
one methods update (SimNPO), and two data-hygiene notes.

### Per-claim result

| Claim | Verdict | Closest *new* neighbor | Surviving one-line differentiation |
|---|---|---|---|
| **C1** — localize gap + leakage on one control-task metric, per-rule, closed-model | holds | **CUE-R** (arXiv:2604.05467, Apr 2026) — intervention-based RAG eval, ablates *retrieved* evidence, API-compatible | CUE-R reads leakage from a *global* zero-retrieval control with multi-axis metrics; it does neither per-rule leakage attribution nor *absence*/gap localization, and never unifies both on one objective metric |
| **C2** — reference-optimal regret instrument + KC→single-metric identifiability | holds | **Maritime training analytics** (arXiv:2507.01274, Springer '25/'26) — same domain, same novice/expert construct-validity logic | it regresses simulator measures onto *instructor ratings* (policy capturing); C2 measures regret vs an objective solver (instructor-free) and adds KC→single-metric identifiability it lacks |
| **C3** — proxy learners as pre-trial screen | demotion to *application* confirmed correct; keep a **narrow** residual claim | **2607.28128** (Jul 30 2026, controlled-competence pre-registered audit) + **EduClaw-Bench** (arXiv:2608.03206, Aug 4 2026, KT-grounded pre-deployment screen) | neither runs the *parametric AND unlearned* proxy classes **together as two complementary arms**, and none scores proxies on a *regret-vs-optimal control-task* outcome tied to the same instrument the human trial will use. Frame C3 exactly that narrowly and cite both to pre-empt "already done" |

### Methods update (folded into §8 and `experiments/unlearning/`)

- **NPO → SimNPO** (arXiv:2410.07163) as the *primary* open-weight unlearning method:
  reference-free, length-normalized, better forget-quality/utility tradeoff. NPO, RMU, and
  gradient-ascent remain baselines. Implemented (`unlearn.py --method simnpo`, now default).
- For a **stable** novice resistant to benign relearning, layer in **"Unlearning That
  Lasts"** (arXiv:2509.02820); optionally the **ATWU** token-importance weighting
  (arXiv:2606.06320).
- Cite the unlearning-eval-validity critiques **defensively**: arXiv:2503.06991 and
  arXiv:2506.00688 ("existing evaluations are inconclusive") — report probes, not a single
  number; and note the "unlearning is overused" framing risk (arXiv:2606.27379).

### Data-hygiene notes

- **Do not cite arXiv:2606.05633** ("Answer Presence Drives RAG Rewriting Gains") — it was
  **withdrawn by its authors for experimental errors** and is not valid prior art.
- Indexing caveat: the arXiv 2607–2608 range is still sparsely indexed as of 2026-08-06, so
  a very recent unindexed preprint cannot be fully ruled out. **Re-run the scan once more
  immediately before submission.**

### New bibliography entries (from this sweep)

- **Closest-neighbors:** CUE-R (2604.05467) · maritime training analytics (2507.01274,
  already listed) · LLM-judged-helpfulness pre-registered audit (2607.28128) ·
  EduClaw-Bench (2608.03206).
- **Unlearning methods/eval:** SimNPO (2410.07163) · Unlearning That Lasts (2509.02820) ·
  ATWU token-importance (2606.06320) · eval-validity critiques (2503.06991; 2506.00688) ·
  "MU is overused" position (2606.27379).
