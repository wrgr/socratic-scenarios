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
| SeedRG — leakage-free RAG benchmarks (2026, arXiv:2605.08838) | "no-context accuracy ⇒ leaked item," filter/regen | removes *context at query time* on QA; no corpus-as-variable, **no localization** |
| Quantifying Prior Dominance in RAG (2026, arXiv:2606.23695) | ablate context → measure degradation, aggregate "prior dominance" | system-level metric, **not per-rule**, no learner/task instrument |
| Counterfactual-context faithfulness — NQ-Swap, ConFiQA, FaithfulRAG (2506.08938) | perturb a passage, see if model follows context | judged on *answer text*, per-item; no gap localization, no governed task metric |
| Farahani & Johansson, EMNLP 2024 | parametric-vs-contextual via causal mediation | interpretability internals, not a black-box downstream instrument |
| Error attribution — REFLECT, FALAT (2026) | attribute failures to retrieval-vs-reasoning/step | not to *specific corpus knowledge items*, no paired leakage test |

**Verdict:** the *combination* — localize + leakage on **one** objective downstream
metric over a **governed external corpus** — is, per the scan, unclaimed. The leakage
half is the least original piece (it echoes the no-context heuristic); the
**localize + leakage with a single instrument** synthesis is the crispest novelty.

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
  in `docs/arxiv/main.tex`. Broadening to more models (esp. weak instruction-followers)
  remains.
- [x] **Second domain** — built (`src/engine/procedure-sim/` + `src/corpus/tire/procedure.ts`). A *discrete procedural* task instrument (roadside tire change) alongside the *continuous-control* COLREG one, demonstrating the method transfers across task structures: construct validity (expert J=0 vs reckless J=200, safety violation caught), **exact KC→single-metric identifiability** (each ablated competence degrades only its governed metric), a monotone competence→performance gradient (J 204→0), and an end-to-end pipeline test feeding the instrument's outcomes into the generic learner agent. `__tests__/procedure.test.ts` (10 tests).
- [ ] **Sensitivity analysis** over instrument/estimator weights (domain, CRI, objective) — show the protocol *ranking* is stable. Already listed as a limitation; make it an experiment.
- [ ] **Head-on related-work differentiation** citing Song 2026, Apartsin 2026, Lu & Wang 2024, Agent4Edu 2025, SeedRG 2026, Prior Dominance 2026, Control-KT 2024.
- [ ] **Proxy-validity limitation section** citing "Towards Valid Student Simulation" (2601.05473) and the fidelity critiques (2505.19997, 2605.12748) — against ourselves.

---

## 5. Draft related-work paragraph (reusable in the paper)

> Simulated learners have long been used to author and evaluate tutoring systems, from
> the symbolic SimStudent / Apprentice-Learner tradition [Matsuda; MacLellan] to recent
> LLM student agents that pilot assessment items [Lu & Wang 2024] and adaptive testing
> [Gao et al. 2025], and to LLM "students" whose knowledge is suppressed by prompting
> [Apartsin et al. 2026] or excised by machine unlearning [Song et al. 2026]. In
> parallel, RAG-grounded tutors abstain outside a curated corpus [LPITutor 2025;
> DeepTutor 2026], and a separate line detects whether a model relies on provided
> context versus parametric memory — via no-context filtering [SeedRG 2026], aggregate
> prior-dominance [2026], counterfactual context [FaithfulRAG 2025], or causal mediation
> [Farahani & Johansson 2024]. Objective competency instruments that score performance
> against a reference exist in flight [Zinn et al. 2023] and surgery [Van Dongen 2007],
> validated by novice/expert separation. **Our work differs in three coupled ways:** we
> (1) use a continuous-control simulator with a *reference-optimal solver* as the
> learning/transfer instrument — regret-vs-optimal and per-rule compliance, not item
> correctness — with each knowledge component mapped to a single governed metric; (2)
> use that one instrument *bidirectionally*, to localize which corpus rule is missing
> from measured failures and to detect leakage by rule-ablation; and (3) exercise it
> with two complementary proxy classes as a pre-human-trial screen. No prior work
> combines a governed external corpus, an objective control-task outcome, and this
> localize-plus-leakage diagnostic.

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
