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
  jurisdiction requiring **bare steerage** (≤ ⅓ speed) in restricted visibility. Not-pretrained,
  controlled, cheapest — proves the curve exists.
- **Real — an obscure posted speed limit** on the same axis — external validity (see "The real leg").

### Two gradients (cross-checked)

- **LoRA-α:** train ONE adapter teaching *R*, evaluate at `--alpha ∈ {0, .25, .5, .75, 1}`
  (`score_offline.py --alpha`; 0 = R-naive base, 1 = fully taught). Whole curve, one training run.
- **Checkpoints:** train once, snapshot every K steps; early = R-naive, late = R-knowing.
- **`--both`:** if the α-curve and the checkpoint-curve agree, the monotonicity is not a
  gradient-method artifact. (α-scaling is only *approximately* linear in "knowledge" — the
  checkpoint sweep is the more principled exposure gradient; agreement between them is the point.)

## The run (synthetic leg)

```bash
# 0. teach set
python build_xylos_datasets.py                          # data/xylos_teach.jsonl

# 1. TEACH — SFT the rule in (reuses unlearn.py; --save_every gives the checkpoint gradient)
python unlearn.py --method sft --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --sft_file data/xylos_teach.jsonl --epochs 4 --lr 1e-4 --save_every 20 --out out/xylos_taught

# 2. SWEEP — one command per gradient builds the whole curve
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --adapter out/xylos_taught --alphas 0,0.25,0.5,0.75,1.0 --probes xylos --out results/dose_alpha
python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
    --checkpoints out/xylos_taught/ckpt-20,out/xylos_taught/ckpt-60,out/xylos_taught/ckpt-120 \
    --probes xylos --out results/dose_ckpt
# -> results/*.csv + an ASCII curve, flagging monotonic non-increasing. Plot from the CSV.
```

## The real leg (external validity)

Same speed axis (`scenario.localSpeedLimit`), a genuine posted limit instead of a fictional one.
Two ways, cheapest first:

- **Observational (no training).** Pick several real local/VTS/canal speed limits; **closed-book
  probe the base** on each. It will know some (→ *leaking* group) and not others (→ *corpus-bound*
  group). Measure corpus-reliance per limit and check it's low where the base knows the number and
  high where it doesn't. A ready-made known-groups test — no fine-tuning.
- **Controlled.** Teach one unknown real limit exactly like Xylos and run the α/checkpoint sweep.

**Screening is required either way:** a limit the base already produces closed-book is leaked and
useless as a corpus-bound target — drop it, and *report which candidates were screened out* (that's
data). Do not hard-code specific real speed numbers as fact here; take the number from the local
authority and put it in the corpus — the experiment only needs the base not to already know it.

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
