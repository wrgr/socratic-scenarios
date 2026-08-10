# Fact-QA: the necessity instrument on a second objective (no simulator)

This is the **second domain** for the corpus-necessity instrument. The COLREG arm scores reliance
with a control-regret *simulator*; this arm scores it with a *programmatic answer checker*. Same
measure, different objective — which is the point: it shows the method is not a maritime-simulator
artifact, and it rebuts "you engineered the objective," because here the objective is just
`answerCorrect(output, expected)`, not anything we designed about task dynamics.

## Why fictional facts

Every entity and value in the KB (`kb.ts`) is **invented** — five fictional research outposts and
their attributes. A model cannot have memorized a fact that does not exist, so for these facts the
*only* way to answer is to read the corpus. That gives the cleanest possible known-groups ground
truth: at baseline a competent model must be **corpus-bound** (necessity ≈ 1); teach the facts into
the weights and necessity must fall to ≈ 0. No simulator, no hand-tuned barrier — just a checker.

## The measure (identical to the COLREG arm)

```
necessity(fact) := accuracy(fact present) − accuracy(fact ablated)      [≥ 0 when relied upon]
```

Verdict is the **same `classify()`** used by the COLREG instrument (imported from
`colreg-sim/leakage`): a majority vote over {low necessity, counterfactual ignored, closed-book
contaminated} → `corpus-bound` / `leaking` / `inconclusive`. A leaking fact is split into
`redundant` (competent WITH the corpus — already known) vs `unusable` (wrong even WITH it) by the
**with-corpus accuracy** — the exact analogue of the COLREG with-corpus-regret split, with the sign
flipped (here HIGH accuracy = competent).

## Run it

The runner also prints a **corpus-sufficiency verdict** (`src/engine/audit-sufficiency.ts`, shared
with the COLREG runner): `contributing` / `partial` / `unusable` / **`FALSE SUFFICIENCY`** — the last
firing when nothing is relied upon and the model answers closed-book (task success rides on priors;
the corpus is a liability waiting for distribution shift). It always attaches the bounded-query scope
caveat, because sufficiency is only ever "sufficient for *these* queries."

```bash
# Offline dry-run: the three reference learners must recover the known ground truth.
SHOW_MOCK=1 npm run factqa:leakage
#   bound      -> 25/25 corpus-bound        (reads the corpus)   -> sufficiency: CONTRIBUTING
#   memorized  -> 25/25 leaking/redundant   (answers regardless) -> sufficiency: FALSE SUFFICIENCY
#   ignorant   -> 25/25 leaking/unusable    (wrong even with it) -> sufficiency: UNUSABLE

# Live model (same providers as the COLREG runner):
BEDROCK_MODEL=us.anthropic.claude-... npm run factqa:leakage
GEMINI_API_KEY=... npm run factqa:leakage
```

## Dose-response (construct validity), simulator-free

The same `experiments/unlearning/dose_response.py` drives this domain via `--runner factqa:leakage`.
Because you can partially-teach at the granularity of *individual facts*, the aggregate necessity
falls **smoothly** as the known set grows — no graded-difficulty ladder needed (the COLREG hazard
needed one because a single simulator scenario flips all-or-nothing).

```bash
# 1. teach set (the fictional facts, several phrasings each) — the KB is the single source of truth
KB_TEACH_DUMP=experiments/unlearning/data/factqa_teach.jsonl npm run factqa:leakage

# 2a. GPU: teach with checkpoints, then sweep them (early = fact-naive, late = fact-knowing)
python experiments/unlearning/unlearn.py --method sft --model <base> \
    --sft_file experiments/unlearning/data/factqa_teach.jsonl --out out/factqa_taught \
    --save_every 5 --epochs 8 --load_4bit --dtype bfloat16
python experiments/unlearning/dose_response.py --model <base> --runner factqa:leakage \
    --checkpoints out/factqa_taught/ckpt-5,...,out/factqa_taught \
    --metric regret --reliance-threshold 0.15 --out results/dose_factqa

# 2b. No GPU: synthesize the knowledge gradient (partially-memorized learner) to prove the harness
for f in 0 0.25 0.5 0.75 1.0; do
  SYNTH_TRANSCRIPT=/tmp/qa_k$f.jsonl KNOWN_FRAC=$f npm run factqa:leakage; done
python experiments/unlearning/dose_response.py --runner factqa:leakage --metric regret \
    --reliance-threshold 0.15 \
    --transcripts "k00=/tmp/qa_k0.jsonl,k25=/tmp/qa_k0.25.jsonl,k50=/tmp/qa_k0.5.jsonl,k75=/tmp/qa_k0.75.jsonl,k100=/tmp/qa_k1.0.jsonl" \
    --out results/dose_factqa
# -> necessity 1.00 -> 0.76 -> 0.48 -> 0.24 -> 0.00, monotone non-increasing.
```

## Files

- `kb.ts` — fictional KB (facts + question paraphrases), corpus render + prompt builder.
- `verify.ts` — the objective: answer normalization + whole-token containment checker.
- `instrument.ts` — `runFactQAExperiment` / `runFactProbe`, the three mock learners + the
  partially-memorized learner, reusing `classify` from the COLREG instrument.
- `../../scripts/factqa-leakage.ts` — runner (mock dry-run, live model, dump/replay, teach export,
  synth transcript), prints the corpus-value audit + a `MEAN-NECESSITY` line for the dose-response.
