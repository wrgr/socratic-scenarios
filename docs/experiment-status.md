# Experiment status & plan (canonical)

The single, honest register of every experiment: what it's *for*, what we *have*, what's *left*.
Contributions it serves: **C1** = Corpus Diagnosis (localize which rule is missing/wrong +
measure per-rule necessity/leakage); **C2** = Transfer Instrument (regret-vs-reference metric).
Every result below is **simulation / mechanism evidence**; the human trial is future work.

| # | Experiment | Serves | Status | One-line outcome |
|---|---|---|---|---|
| 0 | Transfer-instrument construct validity | C2 | ✅ done | do-nothing collides, VO/MPC clear — the metric separates skill (sim tests) |
| 1 | Cross-model leakage discrimination | C1(ii) | ✅ result in hand | every frontier model **LEAKS** standard COLREG; only the mock reads corpus-bound |
| 2a | Unlearning arm (remove from weights) | C1(ii) validation | ⚠️ ran, **null for its goal** | says≠does: words forget, the instrument's decision does not move |
| 2b | Hazard **dose-response** (add to weights) | C1(ii) validation | 🔧 harness built, **curve unrun** | instrument side proven (Δ 0.93 vs 0.00); the monotonic curve is the missing result |
| 3 | Corpus-value audit / localization | C1(i) | 🔧 view built, **real run pending** | per-rule necessity ranking works on the mock; not yet on a real model |
| 4 | Real-hazard leg (external validity) | C1(ii) | 🔧 harness built, **needs real data** | screen + `HAZARDS_FILE` wired; user must supply real charted dangers |
| 5 | Probe suite (#3 routing, #4 intention) | C1 breadth | 📝 planned | not built; scope after 2b + 3 land |
| 6 | Human trial | external validity | 📝 future work | pre-registered, out of scope for this paper |

Legend: ✅ done · ⚠️ ran with a caveat · 🔧 built but not run to a result · 📝 planned.

---

## 0 · Transfer-instrument construct validity (C2) — ✅ done
- **What we have.** On the Imazu benchmark, a do-nothing policy collides on ~all cases
  (cleared-rate < 0.15) while VO / SB-MPC reference solvers clear them; regret-to-reference and
  per-rule compliance separate skill levels. Locked by `__tests__/benchmark.test.ts`.
- **Next.** Nothing required; this is the metric's validity floor.

## 1 · Cross-model leakage discrimination (C1(ii)) — ✅ result in hand
- **What we have.** Deterministic mock learners recover ground truth (bound→CORPUS-BOUND,
  leaking→LEAKING). A Bedrock sweep across Anthropic Claude Haiku 4.5, Meta Llama 3.1/3.3/4
  (8B–405B), Amazon Nova (micro/lite/pro) reads **LEAKING on standard COLREG universally** — the
  corpus is redundant with what the models already know. (The all-LEAKING finding is solid; the
  sweep's tooling bugs — mock-verdict pollution, versioned inference-profile ids — are fixed.)
- **Meaning.** Correct instrument behavior, and the reason standard rules have no dynamic range for
  a weight-level test (→ why 2b uses a hidden hazard).
- **Next.** One clean re-run for a tidy discrimination table (optional; the result is established).

## 2a · Unlearning arm — remove knowledge from weights (C1(ii) validation) — ⚠️ ran, null for its goal
- **What we have.** CPU (Qwen2.5-1.5B): SimNPO drives forget-NLL 4.6→92, direction-cue 5/6→0/6;
  NPO 4.6→41 — suppression, method-agnostic. GPU (Qwen2.5-3B, gentle recipe): every *words-level*
  metric registers forgetting (probe 0.43→0.27, Rule-14 citation gone, forget NLL 7.4→32.4, retain
  NLL 4.3→1.07, coherence 1.00→0.91, damage flat 0.10) — **yet the instrument's 2×2 does not move**
  (still starboard, LEAKING, ablation-delta 0.000). Benign relearning NLL 32→9 (suppressed, not
  removed). An aggressive recipe instead *inverts* the rule (damage 0.10→0.33, port on 6/8).
- **Meaning.** A **says≠does** dissociation, and a caution about naive unlearning — but *not* a
  clean weight-level validation, because Rule 14 already leaks (no dynamic range). This is why the
  validation moved to construction (2b). **Demoted to supporting evidence, not the headline.**
- **Next.** Nothing required to ship as a supporting result. Optional: seeds/7B for robustness.

## 2b · Hazard dose-response — add knowledge to weights (C1(ii) validation) — 🔧 curve unrun
- **What we have.** The instrument side is proven offline: the hidden-hazard probe reads bound →
  CORPUS-BOUND (ablation-δ **0.93**, regret-δ **~1996**, full barrier) and leaking → LEAKING
  (**0.00**). The full harness is built and unit-tested: `build_hazard_datasets.py`,
  `unlearn.py --method sft`, `score_offline.py --alpha`, `dose_response.py`, and a Colab notebook.
- **What's missing — THE result.** The **dose-response curve**: teach the hazard into the weights,
  sweep LoRA-α (and checkpoints), and show corpus-reliance falls **monotonically** to ~0 as the
  fact is memorized. No GPU run yet.
- **Next.** Run `dose_response_colab.ipynb` on Qwen2.5-3B (then 7B, bf16, for a second size).
  **Falsifier:** if corpus-reliance does *not* fall monotonically, the instrument is not measuring
  necessity — report it as a negative result.

## 3 · Corpus-value audit / localization (C1(i)) — 🔧 real run pending
- **What we have.** `PROBES=all npm run colreg:leakage` prints a corpus-value audit: rules ranked by
  necessity (ablation-δ), a `governs→localizes` confusion cell, and a summary (*N rules · K
  relied-on · M redundant*). The mock recovers ground truth — Rule 14 relied-on (necessity 1.0),
  Rule 19 localizes cleanly (`safeSpeed→safeSpeed`), and **Rule 15's starboard reads redundant given
  Rule 14** (a real decomposability signal). Locked by tests.
- **What's missing.** A run on a **real model** over the corpus, and a wider confusion matrix (add
  role 16/17, substantial 8 probes with matched scenarios).
- **Next.** `BEDROCK_MODEL=… PROBES=all …` (or the offline flow) for the real necessity ranking;
  add probes to widen the matrix. Cheap (API-only) and independent of 2b.

## 4 · Real-hazard leg — external validity (C1(ii)) — 🔧 needs real data
- **What we have.** `HAZARDS_FILE` runs a real charted danger through the same rig; `screen_hazards.py`
  closed-book-screens candidates (drop the ones the base already knows). Classifier tested; template
  ships placeholders.
- **What's missing.** Real charted dangers (from official charts / Notices to Mariners) — I won't
  fabricate these.
- **Next.** User fills `real_hazards.example.jsonl` with real dangers → screen → run each through the
  instrument. Report which candidates were screened out (that's data too).

## 5 · Probe suite (#3 routing, #4 agent-intention) — 📝 planned
- Scope after 2b + 3 land. #3 (medium-effect routing) proves discrimination below full-barrier; #4
  (a conflicting fact about another vessel's intention) tests corpus-overrides-prior; needs scripted
  target maneuvers. Goal: corpus-reliance separating bound from leaking as a **distribution** across
  probe kinds, not one test.

## 6 · Human trial — 📝 future work
- Pre-registered; out of scope. The whole point of 0–5 is to falsify the value prop in silico first.

---

## The critical path (what actually gates the paper)

1. **2b — the hazard dose-response curve.** This is the one missing *result* that turns the
   necessity claim from "validated offline on a mock" into "validated on a real model by
   construction." **Highest priority.**
2. **3 — the corpus-value audit on a real model.** The C1(i) product demo; cheap, independent.
3. Everything else (1 re-run, 4 real data, 5 suite) is breadth/robustness, not a gate.

Anchor the paper on **2b + 3**; keep **2a** as supporting (says≠does); **1** as the motivating
"standard rules leak" context; **0** as the metric's validity floor.
