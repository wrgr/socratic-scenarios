# Concept of Operations — COLREG training & validation experiment

**Status:** working ConOps for the experiment that tests whether TeachMe's
corpus-bounded, Socratic training paradigm produces operators (or agents) that
transfer to novel COLREG collision-avoidance situations. Companion to
[docs/colreg-validation.md](colreg-validation.md) (methodology) and
[docs/colreg-simulator-design.md](colreg-simulator-design.md) (the instrument).

> Honesty note (carried from the README): current results are **simulation-based
> mechanism evidence**, not human-subject external validity.

---

## 1. Purpose

Describe, from an operational standpoint, **how the experiment is run** — who does
what, with which system, in what order, and how we decide it succeeded. It turns
the methodology into a repeatable operational procedure.

## 2. Scope & hypothesis

- **In scope:** the COLREG domain (basic teaching domain + interactive simulator),
  the scoring instrument, the benchmark, the parametric and LLM learners, and the
  ablation procedures.
- **Out of scope (this ConOps):** a fielded human-subjects trial (designed here as
  a future phase, not executed), and non-COLREG domains.
- **Hypothesis (H1):** learners trained under the full paradigm achieve better
  *transfer* — higher held-out ship-domain clearance and COLREG compliance, lower
  regret vs the optimal — than learners under ablated conditions.
- **Instrument hypothesis (H0, prerequisite):** the scoring instrument separates a
  good policy from a bad one. If H0 fails, no H1 result is interpretable.

## 3. Definitions

| Term | Meaning |
|---|---|
| **Training surface** | The basic COLREG domain (`src/corpus/colreg/`): Socratic probes + scripted scenarios. Where learning happens. |
| **Assessment instrument** | The simulator + scoring (`src/engine/colreg-sim/`): CRI, ship-domain clearance, compliance, deviation, regret. Where competence is *measured*. |
| **Held-out set** | The 22-case Imazu-style benchmark (`src/corpus/colreg/imazu.ts`). Used only for assessment. |
| **Learner** | The subject: a human trainee, the parametric learner (`learner-policy.ts`), or an LLM (`llm-learner.ts`). |
| **Knob A** | Independent variable = *instruction method* (full paradigm vs ablated pedagogy). |
| **Knob B** | Independent variable = *knowledge source* (what the RAG corpus contains). |

## 4. Stakeholders & actors

- **Researcher / experiment lead** — designs conditions, runs phases, interprets
  results, guards the train/test firewall.
- **Instructor (paradigm)** — the Mentor/Narrator machinery delivering training.
- **Learner** — human trainee or agent proxy (see §3).
- **Subject-matter expert (SME)** — a mariner who validates corpus content and
  reviews flagged corpus gaps.
- **System** — TeachMe app (training surfaces) + the COLREG simulator (instrument)
  + the benchmark/diagnosis tooling.

## 5. The system in operation

Two surfaces, deliberately separated (see [validation §1](colreg-validation.md)):

1. **Train** on the basic COLREG domain — the Mentor asks, scaffolds, and binds to
   the corpus; the live score is **not** shown (training against the scoreboard
   invites gaming the metric).
2. **Test** on the simulator with the reference/scoreboard hidden, on **held-out**
   encounters; the instrument emits objective, reference-normalized measures.

## 6. Operational phases

| Phase | Name | Actor | What happens | Gate to proceed |
|---|---|---|---|---|
| 0 | **Instrument calibration** | Researcher | Run scripted policies (hold-course / VO / SB-MPC) across the benchmark; confirm the metric separates them. | H0 met (see §11). |
| 1 | **Baseline** | Researcher | Record naive & expert reference scores as the floor/ceiling for normalization. | Baselines stable. |
| 2 | **In-silico learner runs** | Parametric / LLM learner | Run learners at varying competence / corpus coverage through train→held-out test; record the gradient. | Gradient monotonic-ish & sensible. |
| 3 | **Ablation — Knob A** | Learner | Full paradigm vs ablated pedagogy; both measured on the same held-out set. | Pre-registered analysis complete. |
| 4 | **Ablation — Knob B (RAG loop)** | LLM learner | Corpus-bounded agent; ablate/vary corpus content; diagnose gaps; fix; re-run. | Leakage audits pass (see §11). |
| 5 | **(Future) Human cohort** | Human trainees | The H1 study with people; simulator as the common outcome instrument. | Ethics/IRB; not executed here. |

## 7. Operational scenarios (narratives)

**S1 — Instrument calibration (Phase 0).** The researcher runs
`runBenchmark(imazuBenchmark, policy)` for the three policies. Expected: hold-course
collides on nearly every case; VO and SB-MPC clear the field at far lower cost. This
is the go/no-go for trusting every later number.

**S2 — In-silico agent train→test (Phases 2–4).** An agent's COLREG knowledge is
set to a defined state (parametric competence vector, or an LLM bound to a specific
corpus). It is trained via the protocol, then pilots the held-out Imazu set in the
simulator. The transfer delta between training protocols estimates the protocol's
value. The independent variable is *the training the agent receives*.

**S3 — RAG-bounded corpus debugging (Phase 4).** An LLM is bound to the corpus with
no outside knowledge. It pilots the benchmark; `diagnose.ts` maps its failures back
to the missing/incorrect corpus nodes. The SME inspects the flagged nodes, fixes the
corpus, and the researcher re-runs to confirm the failure signature clears. Failures
are diagnostic of the *corpus*, not just the learner.

**S4 — Human cohort (Phase 5, future).** Between-subjects conditions (Knob A) with
human trainees, all assessed on the same held-out simulator encounters; primary
outcomes are regret-vs-optimal and compliance rate on far-transfer cases.

## 8. Data flow & the train/test firewall

- Practice encounters (training) and assessment encounters (held-out Imazu) are
  **disjoint**; never assess on a trained scenario.
- The reference/optimal and the live scoreboard are **hidden during assessment**.
- Report **near transfer** (encounter types seen in training) and **far transfer**
  (unseen multi-ship combinations) separately.
- Every run records: per-case CRI, min clearance, incursion, per-rule compliance,
  deviation, regret (`J_learner − J_optimal`), and (for corpus-bounded runs) cited
  nodes + abstentions.

## 9. Roles & responsibilities

| Activity | Researcher | Instructor (system) | Learner | SME |
|---|---|---|---|---|
| Define conditions / pre-register | **R** | — | — | C |
| Deliver training | A | **R** | participate | — |
| Run held-out assessment | **R** | A | subject | — |
| Corpus authoring & gap fixes | C | — | — | **R** |
| Leakage audits | **R** | — | — | C |
| Interpret & report | **R** | — | — | C |

(R = responsible, A = accountable/automated, C = consulted.)

## 10. Environments & tooling

- **App / training + instrument:** `npm run dev` (or `./start.sh`) → Simulator tab
  (COLREG domain).
- **Instrument calibration & gradients:** the benchmark/policy/diagnosis modules in
  `src/engine/colreg-sim/`; the Tier-2 chart is rendered live on the Simulator
  picker.
- **LLM harness:** `npm run colreg:llm-eval`, credential from the environment
  (`GEMINI_API_KEY` / `OPENAI_API_KEY` [+ base/model] / `GITHUB_MODELS_TOKEN`).
  **No secret is committed** — `.env` is gitignored and the script reads
  `process.env`.
- **CI checks:** `npm run lint`, `npm run test`, `npm run build`.

## 11. Success criteria (go/no-go gates)

- **H0 (instrument):** on the benchmark, expert policies clear ≥ 2× the naive
  cleared-rate at materially lower mean `J`, and the naive baseline is near-collision
  on nearly all cases. *Met today* (hold-course 9% cleared / `J` 1804.6; VO & SB-MPC
  100% / `J` ≤ 0.6).
- **Sensitivity:** each ablated knowledge component degrades the specific metric it
  governs (verified in `training.test.ts`).
- **Leakage (Knob B):** closed-book abstention high; counterfactual adherence high;
  ablation-delta present (removing a rule changes behavior). If a corpus-bounded
  learner does not degrade when a rule is removed, the run is contaminated → **stop**
  and obfuscate/counterfactual before continuing.
- **H1 (transfer):** full-paradigm transfer > ablated, pre-registered, with effect
  size and CIs — the human-study bar (Phase 5).

## 12. Assumptions, constraints, risks

| Risk | Mitigation |
|---|---|
| LLM proxy ≠ human (too capable, learns too fast) | Treat as mechanism evidence; gate human claims on Phase 5; calibrate against known error patterns. |
| Pretrained-knowledge contamination | Counterfactual corpus + entity obfuscation + verified ablation-delta before crediting the corpus. |
| Instrument gaming | Firewall practice/assessment; hide reference during assessment. |
| Single-instrument bias (domain/CRI/weights are modeling choices) | Sensitivity analysis over ship-domain, CRI weights, objective weights; report ranking stability. |
| Live-API availability | Provider-agnostic harness; deterministic parametric learner runs fully offline. |

## 13. Timeline / phasing

Phases 0–2 and the Knob-B loop (Phase 4) are **runnable today** (deterministic +
LLM-ready). Phase 3 (Knob-A ablation) needs a working LLM credential or human
subjects. Phase 5 (human cohort) is a future, ethics-gated effort.
