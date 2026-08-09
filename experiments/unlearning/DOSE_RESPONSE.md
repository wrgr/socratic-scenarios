# Dose-response validation of the corpus-reliance instrument

This is the experiment the unlearning arm *should* have been. It replaces single 2×2
point-estimates (which had no dynamic range) with a **known-groups monotonicity test** — the
standard way to construct-validate a measurement instrument.

## The hypothesis (unchanged)

The reference-policy instrument measures **corpus-reliance** — whether a model's competence on a
rule comes from the *corpus in context* or from its *weights*. Operationally:

```
corpus-reliance(model, rule) := penalty(rule ablated from corpus) − penalty(rule present)
                              = the ablation-delta the instrument already computes
```

- A model that does **not** know rule *R* can comply only by reading the corpus → **large** delta (corpus-bound).
- A model that **knows** *R* in its weights complies with or without it → **~0** delta (leaking).

## Why the earlier runs couldn't test it (three design errors, now fixed)

1. **Wrong target rule.** *Alter-to-starboard* is (a) in every model's pretraining and (b) binary.
   So the base already leaks (no corpus-bound baseline) and the metric is a coin-flip. Zero dynamic
   range by construction — unlearning could only invert the coin or suppress the *word*.
   → **Fix:** target a rule the base does **not** know, on a **continuous** action axis (speed).
2. **Wrong ground-truth mechanism.** Unlearning is destructive and confounded (damage, suppression,
   inversion, bilingual collapse). Every "result" was a property of the removal method, not the
   instrument. → **Fix:** manipulate weight-knowledge by **construction** (train / don't-train),
   where the ground truth is known *a priori*, not audited after the fact.
3. **Discretized metric.** Pass/fail checks can't show a graded response. → **Fix:** the local-speed
   check is now **graded** (`severity ∝ how far over the limit`), so corpus-reliance is continuous
   (`src/engine/colreg-sim/colreg-rules.ts`, `RuleCheck.severity`).

## The design: a monotonic corpus-reliance curve over a knowledge gradient

Build models along a gradient from *R-naive* to *R-knowing*, score each, and plot corpus-reliance.
**Predicted signature: it falls monotonically as weight-knowledge rises.** One curve over
known-groups >> many anecdotal cells. Unlearning becomes at most *one point* (the removal end).

### Two rules (synthetic first, real as validation)

- **Synthetic — the Xylos Strait** (`build_xylos_datasets.py`; `PROBES=xylos`): a fictional
  jurisdiction requiring **bare steerage** (≤ ⅓ speed) in restricted visibility. Guaranteed
  not-pretrained, fully controlled, cheapest. Proves the curve exists.
- **Real — an obscure posted speed limit** (external-validity check): a genuine local/VTS speed
  limit on the *same speed axis* (`scenario.localSpeedLimit`), e.g. a specific canal/strait/harbour
  limit. **Selection procedure (required):** closed-book-probe several candidate limits on the base
  model; **keep only those the base gets wrong** (else it's already leaked and useless as a
  corpus-bound target). Report which candidates were screened out — that screening is itself data.

### Two gradients (cross-checked)

- **LoRA-α:** train ONE adapter teaching *R*, evaluate at `--alpha ∈ {0, .25, .5, .75, 1}`
  (`score_offline.py --alpha`; 0 = R-naive base, 1 = fully taught). Whole curve, one training run.
- **Checkpoints:** train once, snapshot every K steps; early = R-naive, late = R-knowing.
- **`--both`:** if the α-curve and the checkpoint-curve agree, the monotonicity is not a
  gradient-method artifact. (α-scaling is only *approximately* linear in "knowledge" — the
  checkpoint sweep is the more principled exposure gradient; agreement between them is the point.)

## The run

```bash
# 0. data (already runnable)
python build_xylos_datasets.py                    # xylos_{teach,forget,retain,audit}.jsonl

# 1. TEACH — SFT the base on xylos_teach.jsonl to inject R.  [needs a thin SFT step — see below]
#    (produces out/xylos_taught, and/or checkpoints out/ckpt-*)

# 2. SWEEP — one command builds the whole curve
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --adapter out/xylos_taught --alphas 0,0.25,0.5,0.75,1.0 --probes xylos \
    --out results/dose_xylos_alpha
# and the checkpoint cross-check:
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --checkpoints out/ckpt-50,out/ckpt-150,out/ckpt-300,out/ckpt-600 --probes xylos \
    --out results/dose_xylos_ckpt
# -> results/*.csv + *.png + an ASCII curve, flagging monotonic non-increasing.
```

**Still required: a teach (SFT) step.** `unlearn.py` does forget/retain, not plain injection. The
teach step is standard next-token SFT on `xylos_teach.jsonl` (LoRA, same `_model.py` loader). It is
deliberately *not* written here to avoid shipping an untested trainer — ask and it's a thin wrapper.

## What would refute the instrument (state it up front)

- **Corpus-reliance does NOT fall with weight-knowledge** (flat or non-monotonic) → the instrument
  is not measuring what we claim; report it as a negative result.
- **α-curve and checkpoint-curve disagree** → the monotonicity was a gradient artifact.
- **The taught model reads leaking at α=1 but the audit says it learned R** → the instrument misses
  weight-level knowledge (a false-negative on leakage).
- **The R-naive base (α=0) reads leaking** → *R* was in pretraining after all (screen harder; for
  the real leg, drop that candidate limit).

These are real possibilities. The value of the design is that it *can* fail; if it doesn't, the
monotonic curve is a genuine construct-validation.

## Confounds handled

- **Counterfactual-refusal.** Earlier, "counterfactual ignored ⇒ leaking" conflated *not
  corpus-bound* with *sensibly refusing a dangerous instruction* (turn to port into an oncoming
  ship). The speed axis avoids this: relaxing a speed limit is not dangerous, so refusal ≠ leakage.
- **Damage vs. forgetting.** Construction (teach) doesn't damage the base the way unlearning does;
  the α=0 point *is* the untouched base. (If a later removal-leg is added, keep the damage-aware audit.)
- **Retrieval miss.** The instrument renders the full corpus, not a top-k, so a null in the
  corpus-present cell is not a retrieval failure.

## Compute (spend it here, not on toys)

One LoRA teach run on a 3B/7B (minutes–~1 h on an A10G/g5.xlarge, bf16, **not** 4-bit — quantization
noise would confound the metric) + 5–8 cheap eval points per curve. The whole synthetic curve is
~one training run; the real leg is one more. This is the right place for compute: a curve, not a point.
