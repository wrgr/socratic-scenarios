# Experiment status & plan (canonical)

The single, honest register of every experiment: what it's *for*, what we *have*, what's *left*.
Contributions it serves:
- **C1** = Corpus Diagnosis — (i) localize which item is missing/wrong, (ii) per-item necessity /
  leakage, (iii) split a leaking item into `redundant` (already known) vs `unusable` (present but the
  model can't act on it).
- **C1b** = Corpus Sufficiency — roll the per-item verdicts into a corpus-level judgement for a query
  set (`contributing` / `partial` / `unusable` / **FALSE SUFFICIENCY**). Co-equal claim.
- **C2** = Transfer Instrument — regret-vs-reference-policy metric (the objective that makes C1 scorable).

Every result below is **simulation / mechanism evidence**; the human trial is future work. The
method now runs on **three task domains** — COLREG (continuous control), tire-change (discrete
procedural), and fact-QA (**simulator-free**, answer-checker objective) — which is the external-
validity backbone: same instrument, same `classify()` verdict, three objectives.

| # | Experiment | Serves | Status | One-line outcome |
|---|---|---|---|---|
| 0 | Transfer-instrument construct validity (COLREG) | C2 | ✅ done | do-nothing collides, VO/MPC clear — the metric separates skill |
| 0b | Second sim domain — tire-change procedural | C2 generality | ✅ done | discrete-task instrument, KC→metric identifiability, monotone gradient (10 tests) |
| B | **Decision-quality band ("the middle band")** | C2 | 🔬 prototyped | a graded hazard-margin term (mirrors the ship 2× margin) makes *legal-but-imperfect* avoidance a scorable **quality-regret**, not lost under the collision barrier — the axis the naive→corpus arc lives on. Mechanism confirmed offline; scenario geometry + sensitivity (Kendall-τ) validation pending |
| 1 | Cross-model leakage — standard COLREG | C1(ii) | ✅ result in hand | every frontier model **LEAKS/redundant** on textbook COLREG (they already know it) |
| 1b | Cross-model **hazard** discrimination (8 models, 3 families) | C1(ii)/C1(iii) | ✅ result in hand | standard COLREG **redundant across all 8** (relied 0–1/4); **Opus** corpus-bound at the full barrier, **Llama-70B & Nova-micro unusable** (ground with rule) = real learner-dependence. **Caveat (see critical-audit F1):** δ_R is a coarse ordinal set by fixed geometry (4 models emit 30° → identical 669), not a fine per-model scalar. **gpt-oss excluded** (F2): the 2 open reasoning models *appeared* to rely (2–3/4) but the single-shot instrument can't score them — unstable, needed 50k-token budgets, no variance control; confirming needs a variance-controlled rerun (future work) |
| 1c | **Geometric hazard SUITE (F1 fix)** | C1(ii) | ✅ built + merged (#80) | N independent alternating-bow fictional hazards in **isolated corpora** → necessity as a **fraction K/N** (resolution 1/N), the reflex loophole closed by port/starboard geometry; mock recovers 8/8 (bound) vs 0/8 (leaking). Live run pending. This is the *suite of N hazards* 2b flagged as needed for a graded COLREG curve |
| 2a | Unlearning arm (remove from weights) | C1(ii) validation | ⚠️ ran, null for its goal | says≠does: words forget, the instrument's decision does not move — **supporting only**. (The *operator* that slides a learner along the source-of-competence axis: unlearn ⇒ necessity rises; teach ⇒ necessity falls = the 2b/7 dose-response) |
| 2b | Hazard **dose-response** (add to weights) | C1(ii) validation | ✅ endpoints validated (real model) | necessity 667→0.2, α & checkpoint sweeps **agree**; interior is a step (single discrete fact = threshold learning) — graded curve is Exp 7's job |
| 3 | Corpus-value audit / localization | C1(i) | ✅ real run done, refinements landed | 4-rule necessity ranking on real models; standard rules redundant, hazard corpus-bound; clean 4-rule re-run optional |
| 3b | redundant vs unusable split | C1(iii) | ✅ built + observed | Llama-70B reads the hazard **unusable** (regret-with 1207) where Haiku/Sonnet read it corpus-bound |
| 4 | Real-hazard leg (external validity) | C1(ii) | ✅ done (Opus) | **Elwha & Fullastern** (gazetteer-verified) read **corpus-bound** (~1998) on Opus, like the synthetic hazard; **Whittle screened out** (Opus named it → already known); **Seven Stones** control was *not* named for its track (caveat, reported); Centissima dropped earlier on verification |
| 7 | **Second domain — fact-QA necessity** (no simulator) | C1 generality | ✅ done (Qwen2.5-7B; α & ckpt agree) | necessity **1.00→0.93→0.29→0.03** (α) and **1.00→0.25→0.03** (checkpoints) — graded monotone, artifact-free |
| 8 | **Corpus sufficiency + FALSE SUFFICIENCY** | C1b | ✅ built + tested | verdict rollup shared by both runners; fires correctly on all three reference learners |
| B2 | **Fact-vs-reasoning (generalization) probe** | C1 depth | 📝 planned | give the corpus, then test on *matched* vs *novel / imperfect-info* variants: the lookup **implementer** holds on matched and degrades on novel; the **reasoner** holds on both — separates RAG-as-lookup from RAG-as-reasoning-substrate (the hardest to fake with priors) |
| 5 | Probe suite breadth (routing, intention) | C1 breadth | 🔧 partial | Rule 8 (substantial) added → 4 rules; role 16/17 + agent-intention still planned |
| 6 | Human trial | external validity | 📝 future work | pre-registered, out of scope for this paper |

Legend: ✅ done / result in hand · ⚠️ ran with a caveat · 🔬 prototyped (mechanism shown, not run to a result) · 🔧 built but not run to a result · 📝 planned.

---

## The learner ladder (what case study 2 walks through)

Necessity is measured against a *learner*, so the register is organized around a small cast. Two axes:
**depth of corpus use** (a ladder) and **source of competence** (corpus vs weights).

**Depth ladder** — each rung-gap is a distinct corpus contribution, and a distinct experiment:

1. **Blind** — can't perceive the danger; holds course → collides/grounds. *(existence gap below rung 2)*
2. **Naive (sighted, untrained)** — avoids, but generically: wrong side / over-bold. *(response-quality gap below rung 3 = the middle band, Exp B)*
3. **Implementer (corpus-as-lookup)** — applies the rule verbatim where the situation matches the corpus. *(generalization gap below rung 4 = Exp B2)*
4. **Reasoner (corpus-as-premises)** — combines corpus + base rules + partial observation for novel/ambiguous cases; robust to imperfect info and distribution shift.

**Source axis (off-ladder):**

5. **Parametric expert (leaking)** — competent *without* the corpus (knows it in the weights); necessity ≈ 0. Every frontier model on standard COLREG (Exp 1); the **FALSE-SUFFICIENCY** case (Exp 8).

**Operators & detectors on the source axis:** *unlearning* (Exp 2a) drags #5 → #3/#4 (necessity rises); *teaching* (Exp 2b/7) does #3 → #5 (necessity falls = the dose-response). The real-hazard **closed-book screen** (Exp 4) is how you detect a #5 with real facts — drop the hazards the model already knows, keep the ones where it is genuinely corpus-bound.

The measurement maps onto the ladder: blind↔naive & naive↔implementer are the **existence** and **quality** axes (Exp B); implementer↔reasoner is the **generalization** axis (Exp B2); anything↔parametric-expert is **necessity** itself (Exp 1/1b/3, continuous in 2b/7).

### Perception × corpus-content — why the hazard is hidden in one study and shown in the other

The corpus is *necessary* only when it supplies what the learner can't get otherwise, and **perception is a second source of the same information**. So usefulness depends on what the corpus carries vs. what the eyes already give:

|  | corpus carries EXISTENCE ("a danger is there") | corpus carries QUALITY ("the right way to pass it") |
|---|---|---|
| **blind** | **necessary** — corpus is the only signal (case study 1) | **inert** — can't apply a response-rule to an unperceived thing |
| **sighted** | **redundant** — perception already gave existence | **necessary** — perception can't say which-side / how-much (case study 2) |

Useful probes live on the **diagonal**, which is why the designs force it: case study 1 **hides** the hazard (existence-corpus necessary ⇒ learner must be blind); case study 2 **shows** it (existence is free ⇒ corpus must carry quality ⇒ learner must be sighted). The two off-diagonal cells are degenerate.

Consequence: there are **two kinds of redundancy** — redundant to *priors* (the parametric expert, #5) and redundant to *perception* (sighted + existence-corpus). Same verdict ("not necessary"), two reasons — a clean generalization of the redundant/unusable split (C1(iii)).

---

## The critical path (what actually gates the paper)

**The empirical spine is complete.** The necessity claim is now validated **by construction, on real
models, in two domains with independent objectives:**
- **2b — hazard** (control-regret objective): large-effect known-groups **endpoints** (necessity
  667→0.2), α and checkpoint sweeps agree. Step interior by construction (one discrete fact).
- **7 — fact-QA** (answer-accuracy objective, no simulator; Qwen2.5-7B): the **graded monotone
  curve**, necessity **1.00→0.93→0.29→0.03** (α) and **1.00→0.25→0.03** (checkpoints) — the two
  gradients agree, so it is artifact-free. Done.

Plus the corpus-diagnosis / sufficiency product (Exp 1/1b/3/3b/8, all in hand). **Remaining work is
robustness/breadth, not a gate:** the fact-QA checkpoint cross-check, a 7B run for a second model
size + crisper recall, the 1/1b clean re-run tables, Exp 4 real-hazard data, Exp 5 more probes.

---

## 0 · Transfer-instrument construct validity (COLREG, C2) — ✅ done
- On the Imazu benchmark a do-nothing policy collides (cleared-rate < 0.15) while VO / SB-MPC clear;
  regret-to-reference and per-rule compliance separate skill. Locked by `benchmark.test.ts`.
  Sensitivity: ranking + gradient invariant over 232 weight perturbations (Kendall τ = 1.00).

## 0b · Second sim domain — tire-change procedural (C2 generality) — ✅ done
- `src/engine/procedure-sim/` + `src/corpus/tire/`. A discrete procedural instrument alongside the
  continuous-control one: construct validity (expert J=0 vs reckless J=200), exact KC→single-metric
  identifiability, monotone competence→performance gradient. `procedure.test.ts` (10 tests).

## 1 · Cross-model leakage — standard COLREG (C1(ii)) — ✅ result in hand
- Bedrock sweep (Claude Haiku/Sonnet, Llama 3.x/4, Nova) reads **LEAKING/redundant on standard COLREG
  universally** — the corpus is redundant with parametric knowledge. Correct instrument behavior, and
  the reason standard rules have no dynamic range for a weight-level test (→ 2b uses a hidden hazard).
- **Next.** Optional clean re-run for a tidy discrimination table.

## 1b · Cross-model hazard discrimination (C1(ii)/C1(iii)) — ✅ result in hand
- On the **corpus-only charted hazard** the same models split three ways: **Haiku, Sonnet →
  corpus-bound** (read the corpus, avoid); **Llama-70B → unusable** (grounds regardless, regret-with
  ≈ 1207 — the corpus is usable but unused by that model); **Nova → inconclusive**. This is the
  cross-model discrimination the standard rules can't show, and it motivated the redundant/unusable
  split (3b).
- **Next.** Fold the per-model table into the paper (add the redundant/unusable column on a fresh run).

## 2a · Unlearning arm — remove from weights (C1(ii) validation) — ⚠️ ran, null for its goal
- Words-level metrics register forgetting (probe 0.43→0.27, citation gone, forget-NLL up) **yet the
  instrument's decision does not move** (still starboard, LEAKING, Δ 0.000). A **says≠does**
  dissociation and a caution about naive unlearning — but not a clean weight-level validation (Rule 14
  already leaks, no dynamic range). **Demoted to supporting evidence.** Optional: seeds/7B robustness.

## 2b · Hazard dose-response — add to weights (C1(ii) validation) — ✅ endpoints validated (real model)
- **Result (Qwen2.5-3B).** Necessity **667 (naive) → 0.2 (taught)** — a large known-groups swing in
  the predicted direction, and the **α-sweep and checkpoint-sweep agree** (both flat-then-cliff,
  same transition), which rules out a gradient-method artifact. The instrument measures necessity,
  and teaching the fact into the weights collapses it.
- **The interior is a step, and that is the honest finding — not a bug to fix.** Teaching a *single
  discrete fact* is threshold learning: the model grounds until it has the fact, then turns fully and
  clears everything, so there is no graded behavior to resolve. The 7-rung difficulty ladder changed
  the plateau *value* (partial-clearance ~667 vs the full ~2000) but cannot make it vary with α — it
  was aimed at the wrong mechanism (the flatness is one-fact-as-threshold, not shared difficulty).
- **The graded curve is Exp 7's job.** A smooth monotone dose-response needs a gradient over the
  *fraction of many independent items learned* — the fact-QA domain (25 facts). A graded *hazard*
  curve would require a **suite of N independent hazards**, not one hazard's difficulty varied.
- **Division of labor for the paper.** Hazard = large-effect known-groups endpoints + α/checkpoint
  agreement; fact-QA = the graded monotone curve.

## 3 · Corpus-value audit / localization (C1(i)) — ✅ real run done, refinements landed
- `PROBES=all` ranks corpus rules by necessity with a `governs→localizes` cell and a summary. Now
  **4 rules** (Rule 14 steer, Rule 19 safe-speed, Rule 8 substantial-action added this cycle, Rule 15
  crossing). Mock recovers ground truth; **real-model data in hand** from the sweeps (standard rules
  read redundant; the hazard reads corpus-bound). Rule 15's starboard reads redundant given Rule 14 — a
  real decomposability signal.
- **Next.** One clean 4-rule real-model run carrying the redundant/unusable labels; optionally widen
  with role (16/17) probes. Cheap, API-only.

## 3b · redundant vs unusable split (C1(iii)) — ✅ built + observed
- A leaking item is split by **with-corpus performance**: `redundant` (competent with it — drop it)
  vs `unusable` (fails even with it — fix the model, not the corpus). Discriminated by with-corpus
  regret (COLREG) / with-corpus accuracy (fact-QA). Observed on a real model: Llama-70B hazard =
  unusable. Tests pin both poles in both domains.

## 4 · Real-hazard leg — external validity (C1(ii)) — 🔧 needs real data
- `HAZARDS_FILE` runs a real charted danger through the same rig; `screen_hazards.py` closed-book-
  screens candidates. Classifier tested; template ships **placeholders** (I won't fabricate charted
  facts).
- **Next.** User supplies real dangers (official charts / Notices to Mariners) → screen → run each.
  Report which were screened out (that's data too).

## 7 · Second domain — fact-QA necessity, simulator-free (C1 generality) — 🔧 GPU curve pending
- **Have.** `src/engine/factqa` + `npm run factqa:leakage`: the necessity instrument on a **fictional-
  fact** KB scored by an **answer checker** (no simulator), reusing the COLREG `classify()` verdict.
  Three reference learners recover ground truth (corpus-bound / redundant / unusable, 25/25 each). The
  synthetic knowledge gradient is **monotone** offline (necessity 1.00→0.76→0.48→0.24→0.00). Teach-set,
  dump/replay, and `dose_response.py --runner factqa:leakage` all wired; one-click
  `dose_response_factqa_colab.ipynb`. 6 tests.
- **Missing.** The real-model dose-response curve (teach the fictional facts → necessity falls). Watch
  the α=0 row: the naive model must **abstain closed-book** on fictional facts for necessity ≈ 1; if it
  confabulates, tighten the abstention instruction or use a base model.
- **Why it matters.** Answers the *you-engineered-the-objective* / *toy-domain* objections; reframes the
  contribution to "necessity on any verifiable objective."

## 8 · Corpus sufficiency + FALSE SUFFICIENCY (C1b) — ✅ built + tested
- `src/engine/audit-sufficiency.ts`, printed by both runners. Rolls per-item verdicts into
  `contributing` / `partial` / `unusable` / **`redundant` (FALSE SUFFICIENCY)** — the last fires when
  nothing is relied upon and the model answers closed-book (task success rides on priors; fragile to
  distribution shift). Fires correctly on all three reference learners. **Scoping condition is baked
  in:** every verdict carries the query-count caveat (sufficiency is relative to the probed query set);
  the FALSE-SUFFICIENCY detector is the measurable handle on that bounded-query limitation. 5 tests.

## 5 · Probe suite breadth (C1) — 🔧 partial
- Rule 8 (substantial-action, magnitude axis) added → 4 auditable rules. Still planned: role (Rule
  16/17), mandatory-routing (medium-effect, discrimination below full-barrier), and a conflicting
  agent-intention fact (corpus-overrides-prior; needs scripted target maneuvers). Goal: necessity
  separating bound from leaking as a **distribution** across probe kinds.

## 6 · Human trial — 📝 future work
- Pre-registered; out of scope. The point of 0–8 is to falsify the value prop in silico first.
