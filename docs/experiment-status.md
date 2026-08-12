# Experiment status & plan (canonical)

The single, honest register of every experiment: what it's *for*, what we *have*, what's *left*.
Experiments are numbered by **case study** (CS): **1** the necessity instrument (COLREG core), **2**
the blind→expert ladder (quality → reasoning), **3** enrichments (reach & generality), **4**
validations (does the instrument itself hold up?). Contributions served:
- **C1** = Corpus Diagnosis — (i) localize which item is missing/wrong, (ii) per-item necessity /
  leakage, (iii) split a leaking item into `redundant` (already known) vs `unusable` (present but the
  model can't act on it).
- **C1b** = Corpus Sufficiency — roll the per-item verdicts into a corpus-level judgement for a query
  set (`contributing` / `partial` / `unusable` / **FALSE SUFFICIENCY**). Co-equal claim.
- **C2** = Transfer Instrument — regret-vs-reference-policy metric (the objective that makes C1 scorable).

Every result below is **simulation / mechanism evidence**; the human trial is future work. The whole
**offline backbone reproduces in one command** — `npm run reproduce` (deterministic, LLM-free) — so
each headline result is regenerated and checked against the value claimed here (CS4.4).

| # | Experiment | Serves | Status | One-line outcome |
|---|---|---|---|---|
| **CS1** | **Measuring corpus necessity (COLREG core)** | | | |
| 1.1 | Reference-learner recovery (bound vs leaking) | C1(ii)/C2 | ✅ done | the instrument separates the two hypotheses; recovered offline in `npm run reproduce` |
| 1.2 | Cross-model leakage — standard COLREG | C1(ii) | ✅ result in hand | every frontier model **leaks/redundant** on textbook COLREG (already knows it) — the reason standard rules have no weight-level dynamic range |
| 1.3 | Cross-model hazard discrimination (8 models, 3 families) | C1(ii)/(iii) | ✅ result in hand | three-way split: **Opus corpus-bound** at full barrier; **Llama-70B & Nova unusable** (ground with rule); standard rules redundant across all 8. **Caveat F1:** δ_R a coarse ordinal — superseded by 1.4. **gpt-oss excluded (F2):** unscoreable single-shot, needs a variance-controlled rerun |
| 1.4 | Geometric hazard SUITE — necessity as a fraction K/N (**F1 fix**) | C1(ii) | ✅ merged (#80) | N independent alternating-bow fictional hazards in isolated corpora → necessity = fraction relied-upon (resolution 1/N); reflex loophole closed geometrically; mock 8/8 (bound) vs 0/8 (leaking) |
| 1.5 | redundant vs unusable split | C1(iii) | ✅ built + observed | Llama-70B reads the hazard **unusable** (regret-with 1207) where Haiku/Sonnet read it corpus-bound |
| 1.6 | Corpus-value audit / localization | C1(i) | ✅ real run done | 4-rule necessity ranking; standard rules redundant, hazard corpus-bound; Rule 15 redundant given Rule 14 (decomposability) |
| 1.7 | Hazard dose-response (teach the fact into the weights) | C1(ii) validation | ✅ endpoints (Qwen2.5-3B) | necessity **667→0.2**; α- & checkpoint-sweeps **agree**; interior a step (single discrete fact = threshold learning) — graded curve is CS3.2's job |
| 1.8 | Corpus sufficiency + FALSE SUFFICIENCY | C1b | ✅ built + tested | verdict rollup (`contributing`/`partial`/`unusable`/**FALSE SUFFICIENCY**); fires on all three reference learners |
| **CS2** | **From blind to expert (quality → reasoning)** | | | |
| 2.1 | Decision-quality band ("the middle band") | C2 | ✅ built (demo) | quality-regret on its own axis (graded terms conditional on clearing): **blind collides · naive middle 0.87 · trained floor 0.01** — the axis the naive→corpus arc lives on |
| 2.2 | Reason-vs-implement (generalization) | C1 depth | ✅ built + tested | reasoning-aware objective (a corpus local rule redefines the governing side, Rules 2/9). Matched: implementer≡reasoner (Δ0.00); conflict: **reasoner 6/6, implementer 3/6** (grounds on the reaches the rule overrides) — separable only on the overriding cases. 6 tests |
| **CS3** | **Enrichments (reach & generality)** | | | |
| 3.1 | Real-hazard external validity | C1(ii) | 🔧 needs real data | Elwha & Fullastern (gazetteer-verified) read **corpus-bound** (~1998) on Opus; Whittle **screened out** (already known — the screen has teeth) |
| 3.2 | Second domain — fact-QA necessity (no simulator) | C1 generality | ✅ done (Qwen2.5-7B) | the **graded monotone curve**: necessity **1.00→0.93→0.29→0.03** (α), **1.00→0.25→0.03** (ckpt), gradients agree ⇒ artifact-free. The strongest graded leg (F1-immune) |
| 3.3 | Second domain — discrete procedural (tire-change) | C2 generality | ✅ done | expert J=0 vs reckless J=200, KC→metric identifiability, monotone competence gradient (10 tests) |
| 3.4 | Probe-suite breadth (routing, role, intention) | C1 breadth | 🔧 partial | Rule 8 added → 4 rules; role 16/17 + agent-intention planned (necessity as a distribution across probe kinds) |
| **CS4** | **Validations (does the instrument hold up?)** | | | |
| 4.1 | Construct validity — COLREG continuous control | C2 | ✅ done | do-nothing collides (cleared 9%), VO/SB-MPC clear (100%) — the metric separates skill |
| 4.2 | Reweighting sensitivity (Kendall-τ) | C2 | ✅ done | ranking + gradient invariant over **232 weight perturbations (τ = 1.00)** |
| 4.3 | Unlearning arm — the says≠does null | C1(ii) validation | ⚠️ null for its goal | words forget, the decision doesn't move — a caution on naive unlearning; **supporting only** |
| 4.4 | Reproduce runner (offline backbone) | all | ✅ built | `npm run reproduce`: 8/8 offline checks in one deterministic command |

*Future work:* human trial (external validity on people) — pre-registered, out of scope for this paper; the point of CS1–4 is to falsify the value prop in silico first.

Legend: ✅ done / result in hand · ⚠️ ran with a caveat · 🔬 prototyped · 🔧 built but not run to a result · 📝 planned.

---

## The learner ladder (what case study 2 walks through)

Necessity is measured against a *learner*, so the register is organized around a small cast. Two axes:
**depth of corpus use** (a ladder) and **source of competence** (corpus vs weights).

**Depth ladder** — each rung-gap is a distinct corpus contribution, and a distinct experiment:

1. **Blind** — can't perceive the danger; holds course → collides/grounds. *(existence gap below rung 2)*
2. **Naive (sighted, untrained)** — avoids, but generically: wrong side / over-bold. *(response-quality gap below rung 3 = the middle band, CS2.1)*
3. **Implementer (corpus-as-lookup)** — applies the rule verbatim where the situation matches the corpus. *(generalization gap below rung 4 = CS2.2)*
4. **Reasoner (corpus-as-premises)** — combines corpus + base rules + partial observation for novel/ambiguous cases; robust to imperfect info and distribution shift.

**Source axis (off-ladder):**

5. **Parametric expert (leaking)** — competent *without* the corpus (knows it in the weights); necessity ≈ 0. Every frontier model on standard COLREG (CS1.2); the **FALSE-SUFFICIENCY** case (CS1.8).

**Operators & detectors on the source axis:** *unlearning* (CS4.3) drags #5 → #3/#4 (necessity rises); *teaching* (CS1.7/CS3.2) does #3 → #5 (necessity falls = the dose-response). The real-hazard **closed-book screen** (CS3.1) detects a #5 with real facts — drop the hazards the model already knows, keep the ones where it is genuinely corpus-bound.

The measurement maps onto the ladder: blind↔naive & naive↔implementer are the **existence** and **quality** axes (CS2.1); implementer↔reasoner is the **generalization** axis (CS2.2); anything↔parametric-expert is **necessity** itself (CS1.2/1.3/1.6, continuous in CS1.7/CS3.2).

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

**The empirical spine is complete.** The necessity claim is validated **by construction, on real
models, in two domains with independent objectives:**
- **CS1.7 — hazard** (control-regret objective): large-effect known-groups **endpoints** (necessity
  667→0.2), α and checkpoint sweeps agree. Step interior by construction (one discrete fact).
- **CS3.2 — fact-QA** (answer-accuracy objective, no simulator; Qwen2.5-7B): the **graded monotone
  curve**, necessity **1.00→0.93→0.29→0.03** (α) and **1.00→0.25→0.03** (checkpoints) — the two
  gradients agree, so it is artifact-free.

Plus the corpus-diagnosis / sufficiency product (CS1.2/1.3/1.5/1.6/1.8, all in hand) and the
blind→expert depth (CS2.1/2.2, offline-validated). **Remaining work is robustness/breadth, not a
gate:** the fact-QA checkpoint cross-check, the CS1.3 clean cross-model re-run table, live-model runs
for CS2.1/2.2, CS3.1 real-hazard data, CS3.4 more probes.

---

## CS1 · Measuring corpus necessity (COLREG core)

### 1.1 · Reference-learner recovery (C1(ii)/C2) — ✅ done
- The bound / leaking reference learners recover the known ground truth on the leakage rig
  (corpus-bound vs leaking), the necessary first fact: the instrument separates the hypotheses.
  Recovered deterministically by `npm run reproduce` and pinned by `leakage.test.ts`.

### 1.2 · Cross-model leakage — standard COLREG (C1(ii)) — ✅ result in hand
- Bedrock sweep (Claude Haiku/Sonnet, Llama 3.x/4, Nova) reads **leaking/redundant on standard COLREG
  universally** — the corpus duplicates parametric knowledge. Correct instrument behavior, and the
  reason standard rules have no dynamic range for a weight-level test (→ 1.4/1.7 use a hidden hazard).

### 1.3 · Cross-model hazard discrimination (C1(ii)/(iii)) — ✅ result in hand
- On the **corpus-only charted hazard** the models split three ways: **Haiku, Sonnet → corpus-bound**;
  **Llama-70B → unusable** (grounds regardless, regret-with ≈ 1207); **Nova → inconclusive**. The
  cross-model discrimination standard rules can't show; it motivated the redundant/unusable split (1.5).
- **Caveat F1:** δ_R here is a coarse geometric ordinal — superseded by the fraction-valued suite (1.4).
- **Next.** A clean cross-model table run carrying the redundant/unusable column (`npm run colreg:cross-model`, wired; needs creds).

### 1.4 · Geometric hazard SUITE — necessity as a fraction (C1(ii), the F1 fix) — ✅ merged (#80)
- N independent, fictional, alternating-bow hazards, each in its own isolated corpus → necessity is the
  **fraction relied-upon** (resolution ~1/N), like fact-QA accuracy over 25 facts, and the port/starboard
  geometry closes the "always turn starboard" reflex loophole. Mock recovers 8/8 (bound) vs 0/8 (leaking).
  The *suite of N hazards* 1.7 flagged as needed for a graded COLREG curve.

### 1.5 · redundant vs unusable split (C1(iii)) — ✅ built + observed
- A leaking item is split by **with-corpus performance**: `redundant` (competent with it — drop it) vs
  `unusable` (fails even with it — fix the model). Observed: Llama-70B hazard = unusable. Tests pin both
  poles in both domains.

### 1.6 · Corpus-value audit / localization (C1(i)) — ✅ real run done
- `PROBES=all` ranks corpus rules by necessity with a `governs→localizes` cell. **4 rules** (Rule 14
  steer, Rule 19 safe-speed, Rule 8 substantial-action, Rule 15 crossing). Standard rules read redundant,
  hazard corpus-bound; Rule 15's starboard reads redundant given Rule 14 — a decomposability signal.

### 1.7 · Hazard dose-response — teach the fact in (C1(ii) validation) — ✅ endpoints validated (Qwen2.5-3B)
- Necessity **667 (naive) → 0.2 (taught)**; the **α-sweep and checkpoint-sweep agree** (both
  flat-then-cliff, same transition) ⇒ not a gradient-method artifact.
- **The interior is a step — the honest finding, not a bug.** A *single discrete fact* is threshold
  learning: grounds until it has the fact, then clears everything. The 7-rung ladder changed the plateau
  *value* but cannot make it vary with α — the flatness is one-fact-as-threshold, not shared difficulty.
- **The graded curve is CS3.2's job** (a gradient over the *fraction of many independent items learned*).

### 1.8 · Corpus sufficiency + FALSE SUFFICIENCY (C1b) — ✅ built + tested
- `src/engine/audit-sufficiency.ts`. Rolls per-item verdicts into `contributing` / `partial` /
  `unusable` / **`redundant` (FALSE SUFFICIENCY)** — the last fires when nothing is relied upon and the
  model answers closed-book (success rides on priors; fragile to shift). Every verdict carries the
  query-count scope caveat. Fires on all three reference learners. 5 tests.

---

## CS2 · From blind to expert (quality → reasoning)

### 2.1 · Decision-quality band — the middle band (C2) — ✅ built (demo)
- The headline objective is deliberately **bimodal** (a collision/grounding barrier ≈ 2000 dominates
  the graded terms ~1000×), so it measures **existence** (did you avoid at all), not **quality** (did
  you avoid well). `npm run colreg:quality-band` reads quality off its own axis — the graded terms
  (ship-margin + compliance + deviation) **conditional on clearing**. The three sailors separate:
  **blind collides (barrier), naive avoids the wrong way (quality-regret ~0.87, the middle band),
  trained clears lawfully (~0.01)** — a smooth graded surface with its minimum at the trained maneuver.
- **Next.** Live-model run (does a real model land in the middle band or at the floor?).

### 2.2 · Reason-vs-implement — the generalization axis (C1 depth) — ✅ built + tested
- Two *trained* sailors that look identical on textbook cases and diverge only where a corpus **local
  rule** must override the reflex. Reasoning-aware objective: `SimScenario.localRule` redefines the
  governing give-way side (COLREG Rules 2/9 subordinate the default rules to local conditions);
  absent ⇒ default starboard, so every existing scenario/test is unchanged. `npm run colreg:reason-implement`:
  **matched → implementer ≡ reasoner (Δ0.00); conflict → reasoner 6/6, implementer 3/6** (grounds on the
  3 reaches the rule overrides, passes the 3 where it's redundant with Rule 14). Necessity of the
  local-rule corpus = 3/6, separable *only* on the overriding cases. 6 tests.
- **No LLM by design** — the learners are hand-built reference policies (ground truth known), so the run
  validates the *instrument*; a real model is the *subject*, run through the same rig (live path wired).

---

## CS3 · Enrichments (reach & generality)

### 3.1 · Real-hazard external validity (C1(ii)) — 🔧 needs real data
- `HAZARDS_FILE` runs a real charted danger through the same rig; `screen_hazards.py` closed-book-screens
  candidates (drop the ones the model already knows). Elwha & Fullastern read corpus-bound (~1998) on
  Opus; Whittle screened out. Template ships **placeholders** (no fabricated charted facts).
- **Next.** User supplies real dangers (official charts / Notices to Mariners) → screen → run each.

### 3.2 · Second domain — fact-QA necessity, simulator-free (C1 generality) — ✅ done (Qwen2.5-7B)
- `src/engine/factqa` + `npm run factqa:leakage`: the necessity instrument on a fictional-fact KB scored
  by an **answer checker** (no simulator), reusing the COLREG `classify()` verdict. The **graded monotone
  curve** — necessity 1.00→0.93→0.29→0.03 (α) and 1.00→0.25→0.03 (checkpoints), gradients agree. Answers
  the *you-engineered-the-objective* / *toy-domain* objections; reframes to "necessity on any verifiable
  objective." Three reference learners recover ground truth (25/25). 6 tests.

### 3.3 · Second domain — discrete procedural, tire-change (C2 generality) — ✅ done
- `src/engine/procedure-sim/` + `src/corpus/tire/`. A discrete procedural instrument alongside the
  continuous-control one: construct validity (expert J=0 vs reckless J=200), exact KC→single-metric
  identifiability, monotone competence→performance gradient. 10 tests.

### 3.4 · Probe-suite breadth (C1) — 🔧 partial
- Rule 8 (substantial-action) added → 4 auditable rules. Planned: role (Rule 16/17), mandatory-routing
  (medium-effect, discrimination below full-barrier), a conflicting agent-intention fact (needs scripted
  target maneuvers). Goal: necessity separating bound from leaking as a **distribution** across probe kinds.

---

## CS4 · Validations (does the instrument hold up?)

### 4.1 · Construct validity — COLREG continuous control (C2) — ✅ done
- On the Imazu benchmark a do-nothing policy collides (cleared-rate < 0.15) while VO / SB-MPC clear;
  regret-to-reference and per-rule compliance separate skill. Locked by `benchmark.test.ts`.

### 4.2 · Reweighting sensitivity (C2) — ✅ done
- The protocol ranking and gradient are invariant over **232 weight perturbations (Kendall τ = 1.00)** —
  the conclusions are not an artifact of the objective's weights. Locked by `sensitivity.test.ts`.

### 4.3 · Unlearning arm — remove from weights (C1(ii) validation) — ⚠️ null for its goal
- Words-level metrics register forgetting (probe 0.43→0.27, citation gone, forget-NLL up) **yet the
  instrument's decision does not move** (still starboard, leaking, Δ 0.000). A **says≠does** dissociation
  and a caution on naive unlearning — but not a clean weight-level validation (Rule 14 already leaks, no
  dynamic range). **Supporting evidence.**

### 4.4 · Reproduce runner — the offline backbone (all) — ✅ built
- `npm run reproduce`: one deterministic, LLM-free command regenerates every instrument-validation result
  (4.1/4.2, the reference-learner recoveries 1.1, the hazard suite 1.4, sufficiency 1.8, the quality band
  2.1, reason-vs-implement 2.2) and checks each against the value claimed here — non-zero exit on drift, so
  it doubles as a CI guard. The credentialed arms (Bedrock cross-model, GPU dose-response) are model
  measurements, listed as a separate opt-in tier.
