# Validating the approach — does it add value?

How to show that TeachMe's educational paradigm (typed knowledge graph → corpus-
bound Narrator → Socratic Mentor → mastery/safety gates), applied to the COLREG
domain, actually produces better operators — using the interactive simulator as
the measuring instrument.

> Honesty up front (as in the top-level README): everything below is
> **simulation-based mechanism evidence**, not human-subject external validity.
> It tests whether the *machinery* behaves as designed and whether the metric can
> tell competence apart — necessary, not sufficient, for a claim about real
> learning.

---

## 1. Train vs. test — the simulator is primarily an *assessment* environment

The paradigm's thesis is explicitly **anti "optimize the metric"** (OVERVIEW.md):
retrieve what's *useful*, ask rather than tell, bind to the corpus. If learners
*train* against the live scoreboard (CRI, `J`-vs-optimal), they learn to game the
score rather than internalize the Rules — the exact failure the design exists to
prevent.

So:

- **Train** in the basic COLREG domain (`src/corpus/colreg/`): Socratic probes +
  scripted scenarios, where the Mentor asks and scaffolds. Optionally a *guided
  sandbox* use of the simulator (with the "Show optimal" debrief) on **practice**
  encounters.
- **Test** on the simulator with the scoreboard and reference **hidden**, on
  **held-out** encounters — the Imazu benchmark (`src/corpus/colreg/imazu.ts`).
- **Firewall** practice and assessment encounters (the repo already models this
  with pretest/posttest `TransferProblem` separation). Report **near transfer**
  (encounter types seen in training) and **far transfer** (unseen multi-ship
  combinations) separately — far transfer is the real bar.

The simulator is a strong instrument because it emits continuous, objective,
**reference-normalized** measures rather than pass/fail: minimum ship-domain
clearance, peak CRI, per-rule COLREG compliance, route deviation, and
**regret = `J_learner − J_optimal`** against the SB-MPC / VO reference.

---

## 2. A value-demonstration ladder (increasing cost, increasing strength)

### Tier 1 — Instrument construct validity (built, runnable now)
Before any learner study means anything, the environment + metric must separate a
good policy from a bad one. `src/engine/colreg-sim/benchmark.ts` runs scripted
policies across the Imazu set; `__tests__/benchmark.test.ts` asserts the
separation: **hold-course (naive)** collides on ~every case at CRI ≈ 1, while the
**VO** and **SB-MPC** experts clear far more domains at lower `J`. If the metric
couldn't distinguish these, no learning result would be interpretable. This is the
first concrete "adds value" evidence — for the *instrument*.

### Tier 2 — Competence → performance gradient (built, runnable now)
`learner-policy.ts` is a deterministic, mechanistic learner whose maneuver quality
is governed by a competence vector θ (role, starboard, substantial, early,
safeSpeed, multiShip). Acquiring the components in curriculum order and scoring on
the held-out Imazu set produces a clean learning curve (`__tests__/training.test.ts`):

| Stage (+component) | Cleared | mean J | Compliance penalty |
|---|---|---|---|
| 0 (none)        |   9% | 1804.6 | 0.576 |
| 1 (+role)       |   9% | 1759.1 | 0.707 |
| 2 (+starboard)  |  14% | 1680.9 | 0.319 |
| 3 (+substantial)|  14% | 1597.0 | 0.093 |
| 4 (+early)      |  86% |  270.2 | 0.000 |
| 5 (+safeSpeed)  |  86% |  270.2 | 0.000 |
| 6 (+multiShip)  | 100% |    0.0 | 0.000 |

Two findings worth noting: (a) **partial knowledge can be dangerous** — adding
`role` *without* `starboard` makes compliance *worse* (the learner now acts, but
turns the wrong way); (b) `safeSpeed` shows no effect *on this set* because the
Imazu cases are all clear-visibility — its metric only moves on restricted-
visibility cases (an honest null, not a bug). That null is now a live signal on the
restricted-visibility subset (§2a below). This validates the *measurement pipeline*
— that the metric responds, component by component, to what the learner knows. It
is mechanism evidence, not external validity. A richer variant swaps this
parametric learner for an LLM simulated learner (`src/engine/simulated-learner/`) —
same harness, live responses.

### Tier 2a — Restricted visibility (Rule 19): the right answer *changes*
The clear-visibility set only exercises the in-sight Rules (11–18). Rule 19 is a
separate regime, and binding it in is what gives the `safeSpeed` axis — and the
Rule 19 no-alter-to-port / no-alter-toward geometry — cases to move on. Crucially,
**there is no stand-on vessel in restricted visibility**: a contact detected by
radar on a collision course must be given avoiding action whichever bow it is on.
The restricted set (`src/corpus/colreg/restricted.ts`, 10 fog encounters) and the
Rule 19 scoring branch (`colreg-rules.ts`) make that concrete.

The scoring instrument separates a naive policy from the experts here too, and —
unlike the clear-vis set — the separation shows up in **compliance**, because safe
speed is now scored:

| Policy | Cleared | mean J | Compliance penalty |
|---|---|---|---|
| hold-course (naive) |  10% | 1722.2 | 0.754 |
| VO expert           | 100% |    0.7 | 0.344 |
| SB-MPC expert       | 100% |    0.0 | 0.000 |

Two things fall out of the geometry:

- **The discriminating case** is a contact fine on the **port bow**. In sight it is
  a crossing stand-on situation — *holding course and speed is correct* (penalty
  ≈ 0). In restricted visibility the identical held course scores a penalty of
  **0.72**: Rule 19(d) requires avoiding action, there is no stand-on privilege, and
  no safe-speed reduction was made. Same geometry, same action, opposite verdict —
  that is the Rule the subset exists to test.
- The **VO expert clears every domain but is less compliant than SB-MPC** (0.344 vs
  0.000). The VO chooser is tuned for clear-visibility minimum-deviation, so it
  holds speed where Rules 6/19 want a reduction — an emergent, honest illustration
  that "clears the domain" and "complies with Rule 19" are not the same thing.

On the mechanistic learner, ablating `safeSpeed` now raises the mean compliance
penalty from ≈ 0 to **0.67** across the fog set (and drops the cleared rate from
100% to 50%), and `diagnose.ts` localizes the failure to **Rules 6/19**
(`PROBE-COLREG-SAFE-SPEED-001`) — the honest null from the clear-vis set turned into
a measured, localized signal. Covered by
`__tests__/restricted-benchmark.test.ts`.

### Tier 3 — Ablation (the actual value claim)
Between-subjects: the **full paradigm** vs **ablated** conditions — e.g.
*answer-first* instead of Socratic; *semantic* instead of proficiency-calibrated
retrieval; *no safety gates*. All arms are measured on the **same held-out Imazu
assessment**. Pre-registered. Primary outcomes: **regret-vs-optimal** and
**compliance rate** on far-transfer (unseen multi-ship) cases. The prediction
(OVERVIEW.md): removing an educational constraint makes the system cheaper to
build but worse at producing operators who transfer.

---

## 2b. Two different knobs — instruction *method* vs. knowledge *source*

These are separate experiments and it's worth not conflating them:

- **Knob A — instruction method (vs. baseline).** Hold the knowledge fixed; vary
  *how* it's taught (full Socratic paradigm vs. answer-first vs. semantic-only
  retrieval). Outcome: transfer / regret on the simulator. This is the Tier-3
  ablation and the headline "does the pedagogy add value" claim.
- **Knob B — knowledge source / RAG content.** Bind the learner to a specific
  corpus with **no access to information beyond the RAG** (exactly the
  corpus-bounded-Narrator thesis), and ask how it does at the task. Here the
  independent variable is *what's in the corpus*, and failures are diagnostic of
  the **corpus itself**.

Knob B is the immediately actionable one, because the simulator localizes the
defect. In the Tier-2 model above, θ *is* "what the RAG covers": ablating a
component = a corpus gap, and — since each component maps to a specific metric — a
task failure points at which corpus knowledge is missing or wrong.

### Spot issues and fix them — the corpus-diagnostic loop (built)

`diagnose.ts` turns a RAG-bounded learner's per-case results into a ranked list of
likely corpus gaps, each with the nodes/rules to inspect. Run the learner across
the benchmark → diagnose → fix the corpus → re-run and confirm the signature
clears. Example — a learner whose corpus lacks the alter-to-starboard rule:

```
Diagnosis of a starboard-ablated learner:
 - starboard (15/22): inspect RULE-COLREG-14, RULE-COLREG-15, PROBE-COLREG-STARBOARD-001
 - role (3/22):       inspect RULE-COLREG-16, RULE-COLREG-17, PROBE-COLREG-CROSSING-001
 - coordination (1/22): inspect multi-ship handling (no single corpus node — candidate gap)
```

The top finding correctly fingers the missing rule; the "coordination" finding is
the interesting kind — it flags a capability the corpus has *no node for at all*, a
genuine gap candidate. This is the same idea as the existing `corpus-gaps.ts` /
expert-flag machinery, but *driven by measured task failure* rather than hand
audit: the instrument tells you where to look. (Caveat: a base LLM already knows
the COLREGs, so for a real RAG-bounded study the out-of-corpus knowledge must be
genuinely suppressed and verified — see the threats below.)

## 3. Tier 3 in simulation — ablate an *agent's* knowledge, then train it

The interesting in-silico version of Tier 3 uses **knowledge-ablated LLM agents as
proxy learners**. The loop:

1. **Ablate** — take an agent and remove or suppress its COLREG knowledge to a
   defined competence level. Techniques in the literature: persona/prompt
   conditioning to a knowledge state (restricted-knowledge prompting), fine-tuning
   on limited data, or **machine unlearning** to literally excise the knowledge.
2. **Train** — run the ablated agent through a training protocol (full paradigm
   vs an ablated protocol) exactly as a human learner would go: Socratic probes,
   scenarios, corpus-bound narration.
3. **Test** — have the trained agent pilot the held-out Imazu encounters in the
   simulator; score with the same instrument (clearance, CRI, compliance, regret).
4. **Compare** — the difference in transfer between training protocols is the
   in-silico estimate of the protocol's value. The **independent variable is the
   training the agent receives**, mirroring the human ablation.

The simulator is what makes this rigorous: it supplies an **objective, novel-
encounter outcome measure**, so "did the agent actually get better at COLREG
avoidance" is a number, not a vibe.

### Do people do this? Yes — it's an active field

- **Computational simulated students.** SimStudent / the Apprentice-Learner
  framework (Matsuda, Koedinger, MacLellan) are machine-learning agents that learn
  procedural skills like students and are used to **evaluate tutoring designs and
  instructional protocols** — including learning-by-teaching ("teachable agents").
- **LLM simulated students / generative agents.** A wave of recent work populates
  synthetic cohorts and generates learner-response data to pilot ITSs and items —
  *Classroom Simulacra*, *Agent4Edu*, *Simulating Classroom Education with LLM
  Agents*, and *GPTeach* (Markel et al.), which uses GPT-simulated students to
  train novice teachers.
- **Knowledge ablation specifically.** *Simulating Novice Students Using Machine
  Unlearning and Relearning in LLMs* does exactly step 1–2 above (excise knowledge,
  then relearn). *TeachYou / AlgoBo* **restrain an LLM's knowledge** to simulate
  misconceptions and unawareness in a prescribed knowledge state.
- **Testbeds.** *TutorGym* is a testbed for evaluating AI agents as **both tutors
  and students**.
- **The validity caveat is itself a research topic.** *Can LLMs Reliably Simulate
  Real Students' Abilities?* and *Towards Valid Student Simulation with LLMs* show
  proxy students can be miscalibrated — often too capable, learning too fast, and
  not reproducing authentic misconceptions.

### Genuinely suppressing (and verifying) out-of-corpus knowledge

A base LLM already knows the COLREGs, so binding it to a corpus is not just a prompt
— it must be enforced and *audited*, or the corpus gets credit the weights earned.
For a closed model (e.g. Gemini) you cannot unlearn weights, so:

**Suppress** — weakest to strongest:
1. **Closed-book instruction + abstention** — "use ONLY these rules; if not covered,
   abstain." Necessary, weak alone.
2. **Citation forcing** — every decision must cite rule ids from the provided set;
   discard/penalize uncited claims. (Same idea as the repo's `SRC-###` machinery.)
3. **Counterfactual corpus** — replace the true rule with an altered one (e.g. "give
   way to the vessel on your *port* side"). A corpus-bound learner follows the
   altered rule; this both *forces* reliance and *tests* it.
4. **Entity/label obfuscation** — rename to fictional terms so pretrained
   associations don't fire.
5. **Machine unlearning / fine-tuning** — actually excise the knowledge (open-weight
   models only).

**Verify** — the audits, all runnable via `scripts/colreg-llm-eval.ts`:
- **Contamination baseline (closed-book):** ask with NO corpus. A correct answer
  means the knowledge is in the weights → plain ablation is meaningless; use
  counterfactual/obfuscation. A bound learner should *abstain*.
- **Counterfactual adherence:** feed the altered corpus; measure the fraction that
  follows the counterfactual vs the real rule. Low adherence = leaking priors.
- **Ablation-delta (repo-native):** remove a node and confirm the metric it governs
  degrades (`diagnose.ts` should light up). **If removing the starboard rule does
  not make the learner turn the wrong way, it is using pretrained knowledge, not the
  corpus** — the same instrument that finds corpus gaps also detects leakage.
- **Abstention calibration:** on removed-knowledge questions, does it abstain or
  confabulate? Confabulation rate = leakage.

### Threats to validity (and mitigations)

- **The proxy ≠ a human.** LLM agents may be too capable or learn unrealistically
  fast. Mitigation: calibrate the ablated agent against known human error patterns;
  treat results as mechanism/formative evidence, and gate any human claim on a real
  study.
- **Contamination.** A base model already knows the COLREGs, so "ablation" must be
  verified (probe the agent post-ablation to confirm the knowledge is actually
  gone) — otherwise the training protocol gets undeserved credit.
- **Instrument gaming.** Keep the assessment encounters and the training encounters
  disjoint; hide the objective/reference during assessment.
- **Single-instrument bias.** The elliptical ship domain, CRI weights, and
  objective weights are modeling choices; run sensitivity analysis over them and
  report whether the ranking of protocols is stable.

---

## 4. What exists in the repo today

- **Instrument:** `src/engine/colreg-sim/` (kinematics, elliptical ship domain,
  CRI, compliance, objective, SB-MPC + VO reference solvers).
- **Held-out test sets:** `src/corpus/colreg/imazu.ts` (22 clear-visibility
  collision-course cases) and `src/corpus/colreg/restricted.ts` (10 Rule 19
  fog cases), sharing the collision-course geometry in `benchmark-geometry.ts`.
- **Rule 19 scoring:** `colreg-rules.ts` branches on visibility — in restricted
  visibility it drops the stand-on/give-way roles (Section II is in-sight only) and
  scores Rule 19(d)(i)/(ii) + Rules 6/19 by relative bearing.
- **Runnable Tier-1 check:** `src/engine/colreg-sim/benchmark.ts` +
  `__tests__/benchmark.test.ts` (clear-vis naive vs VO vs SB-MPC separation) and
  `__tests__/restricted-benchmark.test.ts` (the fog separation + the Rule 19
  discriminators).
- **Tier-2 harness (built):** `src/engine/colreg-sim/learner-policy.ts`
  (competence-parameterized learner + curriculum + ablation) and `diagnose.ts`
  (corpus-gap localization), with `__tests__/training.test.ts` proving each
  component maps to its metric and that diagnosis localizes an ablated component.
- **LLM corpus-bound learner (built):** `src/engine/colreg-sim/llm-learner.ts` +
  `scripts/colreg-llm-eval.ts` — a provider-agnostic (`Completer`) learner that
  reasons from the rendered corpus only, with ablation/counterfactual levers and the
  leakage audits above. Run `npm run colreg:llm-eval` with a credential in the env
  (`GEMINI_API_KEY`, `OPENAI_API_KEY` [+`OPENAI_BASE_URL`/`OPENAI_MODEL`], or
  `GITHUB_MODELS_TOKEN`). Nothing secret is committed — `.env` is gitignored and the
  script reads `process.env`.

- **Leakage / corpus-diagnosis experiment (built):** `src/engine/colreg-sim/leakage.ts`
  + `scripts/colreg-leakage.ts` (`npm run colreg:leakage`) — runs the bidirectional
  loop (ablation-delta + counterfactual adherence + `diagnose` localization +
  closed-book baseline) and is validated offline against two reference mock learners
  whose ground truth is known (a corpus-bound and a leaking one).

### Live run — captured (Gemini, corpus-bound learner)

First live results, on a 6-case held-out Imazu subset (`gemini-flash-latest`
→ 3.6-flash; `gemini-3.5-flash` for the leakage probe), corpus-bound prompt:

| Condition | Cleared | Compliance penalty | Reading |
|---|---|---|---|
| Full corpus | 83% | 0.000 | competent from the corpus alone (residual: 1 no-action case) |
| Ablate Rule 15 (crossing give-way) | 50% | 0.361 | metric collapses; `diagnose` localizes `starboard → RULE-COLREG-14/15` |
| Counterfactual head-on ("alter to PORT") | — | — | learner chose **−30° (PORT)** → follows the corpus, not priors |
| Closed-book (no corpus) | — | — | **abstained** (no answer from priors) |
| Leakage verdict (Rule 14) | — | δ = 1.000 | **CORPUS-BOUND** |

So on this model the corpus-binding *holds* (no leakage detected on Rules 14/15):
removing a rule collapses the governed metric and the diagnoser localizes it
(corpus-gap direction), while the counterfactual is followed and closed-book abstains
(leakage direction) — the whole C1 loop, live. Caveat: single model, small subset,
free-tier rate/day limits (the run pins the model + throttles in `.env`; nothing
secret is committed). Numbers are illustrative, not a study.

Next concrete step: widen the live run (more cases, clear **and** restricted sets,
multiple models incl. a deliberately leaky prompt as a positive control), and run the
knowledge-ablation proxy-learner arm (see `docs/unlearning-ablation-refs.md`).

## Sources

- SimStudent / teachable agents: [Learning by Teaching SimStudent (Matsuda et al.)](https://link.springer.com/chapter/10.1007/978-3-642-13388-6_36)
- Knowledge ablation in LLM learners: [Simulating Novice Students Using Machine Unlearning and Relearning in LLMs](https://link.springer.com/chapter/10.1007/978-3-032-29744-0_42)
- Restrained-knowledge LLM tutees: [TeachYou / AlgoBo](https://arxiv.org/html/2406.19226v1)
- Simulated cohorts / response data: [Classroom Simulacra](https://arxiv.org/pdf/2502.02780) · [Agent4Edu](https://arxiv.org/pdf/2501.10332)
- Simulated students for teacher training: [GPTeach (Markel et al.)](https://dl.acm.org/doi/full/10.1145/3613904.3642349)
- Tutor/student testbed: [TutorGym](https://link.springer.com/chapter/10.1007/978-3-031-98420-4_26)
- Validity caveats: [Can LLMs Reliably Simulate Real Students' Abilities?](https://arxiv.org/pdf/2507.08232) · [Towards Valid Student Simulation with LLMs](https://arxiv.org/pdf/2601.05473)
