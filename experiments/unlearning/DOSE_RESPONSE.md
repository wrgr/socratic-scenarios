# Measuring RAG's true contribution: the corpus-reliance dose-response

**The question.** When a model behaves correctly with a corpus in context, is that because it
*used the corpus* or because it *already knew the answer*? Call the first **corpus-bound** and the
second **leaking** (parametric). This is the RAG-faithfulness question, made into a behavioral
measurement.

**The measure.** Ablate a rule *from the corpus* and see whether behavior changes, scored by the
simulator:

```
corpus-reliance(model) = penalty(rule ablated) − penalty(rule present)
```

- A model that can only comply by reading the corpus → removing it breaks behavior → **large**.
- A model that knows the rule in its weights → removing it changes nothing → **~0**.

## Why a hidden hazard (and not the standard rules)

On standard COLREG rules the answer is boring: every model already knows "head-on → starboard,"
so the corpus is redundant and reliance is ~0 (**leaking**, universally — confirmed across the
Bedrock sweep). RAG only *contributes* when it supplies something the model can't already know.

So the probe is a **charted hazard** on the ownship's track (`PROBES=hazard`): it is scored by the
objective **barrier** (grounding = full penalty) but **not shown to the model** — it can be known
*only* from the corpus. A model that read the corpus alters to clear; one that didn't holds its
track and grounds. The signal is the whole barrier range, not a sliver, and avoiding a charted
danger is plainly sensible so there's no "refuses a dangerous instruction" confound.

The mock reference learners recover the ground truth (`npm run colreg:leakage` with `PROBES=hazard`):

| learner | corpus-reliance (ablation-δ) | regret-δ (J) | verdict |
|---|---|---|---|
| reads the corpus (bound) | **0.93** | **~1996** | CORPUS-BOUND |
| ignores the corpus (leaking) | **0.00** | **~0** | LEAKING |

## The validation: a dose-response over a knowledge gradient

A single 2×2 is one point. Instead, build models along a gradient from *hazard-naive* to
*hazard-knowing* **by construction** (ground truth known), and show corpus-reliance falls
monotonically. That monotonic curve over known-groups is the actual construct-validation.

The gradient is built by teaching the hazard fact into the weights. The prompt renders a
`location` (the query cue — "Location: Kessock Narrows"); the corpus (ablatable) or the weights
(taught) supply the fact that a wreck is there. As the model memorizes it, it needs the corpus
less → corpus-reliance → 0.

```bash
# 0. teach set (the location -> hazard fact, many phrasings)
python build_hazard_datasets.py                         # data/hazard_teach.jsonl

# 1. TEACH the fact into the weights (SFT; --save_every gives the checkpoint gradient)
python unlearn.py --method sft --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --sft_file data/hazard_teach.jsonl --epochs 4 --lr 1e-4 --save_every 20 --out out/hazard_taught

# 2. SWEEP — corpus-reliance vs weight-knowledge (two cross-checked gradients)
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --adapter out/hazard_taught --alphas 0,0.25,0.5,0.75,1.0 --out results/dose_alpha
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --checkpoints out/hazard_taught/ckpt-20,out/hazard_taught/ckpt-60,out/hazard_taught/ckpt-120 \
    --out results/dose_ckpt
# -> results/*.csv + an ASCII curve, flagging monotonic non-increasing. Plot from the CSV.
```

- **LoRA-α** (one training run, evaluated at α∈{0..1}: α=0 = naive base, α=1 = fully taught) and
  **checkpoints** (snapshots over training) should give the same curve — agreement rules out a
  gradient-method artifact.

## The two validation directions

1. **Construction (above):** teach the fact in → corpus-reliance **falls**. Ground truth known.
2. **Unlearning:** on a rule the model *does* know, remove it from the weights → corpus-reliance
   **rises** (it must now read the corpus). This is the original unlearning arm — but it only has
   dynamic range on a rule with a real corpus-vs-prior gap, which the hazard provides.

## What would refute the instrument (stated up front)

- Corpus-reliance does **not** fall as the model is taught the hazard (flat / non-monotonic) → the
  measure isn't tracking weight-knowledge. Report it.
- The α-curve and checkpoint-curve **disagree** → artifact.
- The **naive base (α=0) already clears** the hazard → the model somehow knew it; strengthen the
  hazard's arbitrariness (a different location/geometry) and re-screen.

## Validation suite (roadmap) — one probe is not enough

A single constructed probe is n=1. The instrument is validated by a **suite** of corpus-only rules
that vary in *kind of knowledge*, *novel vs. conflicting with priors*, and *effect size*, so the
result is a distribution (corpus-bound vs. leaking cleanly separated across probes), not an anecdote.

| # | Probe | Kind | Novel/conflict | Effect | Status |
|---|---|---|---|---|---|
| 1 | Hidden hazard (synthetic) | spatial | novel | full barrier (~0.93) | **built** (`PROBES=hazard`) |
| 2 | Real obscure hazard | spatial | novel | large→medium | **built** (screen + `HAZARDS_FILE`) |
| 3 | Mandatory routing / keep-to-side | procedural | novel/conflict | medium | planned |
| 4 | Other-vessel intention ("will not give way") | behavioral | conflict | large | planned |

\#3 matters because it shows discrimination *below* full-barrier (not just the giant lever); \#4
tests whether the corpus can *override* a strong prior about another agent (needs scripted target
maneuvers). Suite-level result to report: corpus-reliance separates bound from leaking as a
distribution, and the dose-response is monotonic per probe, across ≥3 seeds and two model sizes.

### Probe #2 — real hazard (built): observational, no training

Swap the fictional hazard for a **real charted danger** a model can't have memorized, keyed to its
real place. It only works if the base does not already know the danger, so **screen closed-book first**:

```bash
# 1. screen candidates — keep only the ones the base does NOT already know (report the drops)
python screen_hazards.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --hazards real_hazards.example.jsonl --out data/usable_hazards.jsonl
#    (real_hazards.example.jsonl ships PLACEHOLDERS — fill with real charted dangers from official
#     charts / Notices to Mariners; do not trust the placeholders as fact.)

# 2. run each usable hazard through the instrument (its location + disclosure only)
HAZARDS_FILE=<one line of data/usable_hazards.jsonl> PROBES=hazard npm run colreg:leakage
```

Observationally, across many real hazards, corpus-reliance should be **high where the base didn't
know the danger** and low where it did — a training-free known-groups check that complements the
teach-based dose-response of the synthetic probe.

## Compute

One LoRA teach run on a 3B/7B (minutes–~1 h on an A10G/g5.xlarge, bf16 — **not** 4-bit, which would
confound the signal) + a handful of cheap eval points per curve. A curve, not a point, for about
the cost of a single 2×2.
