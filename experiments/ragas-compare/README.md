# RAGAS vs. necessity — a head-to-head baseline

Makes the paper's "distinct from RAGAS" claim **empirical**: a corpus can look sufficient under
RAGAS while our necessity measure shows it is not needed (the *false sufficiency* case).

## The argument (why it's decisive)

RAGAS scores a single **(question, retrieved-context, answer)** triple. Take a *naive* model and a
*taught* model, both with the corpus present. Both answer correctly (`acc_with ≈ 1`), so the triple
RAGAS sees — same question, same context, same correct answer — is **identical**, and its
faithfulness / answer-correctness score is therefore identical. RAGAS is **invariant to necessity by
construction**: it never runs the without-corpus condition. Our necessity does
(`necessity = acc(with corpus) − acc(closed-book)`), so it separates the two. This harness computes
**both, from the same data**, so the contrast is a table, not a claim:

| model (both +corpus) | RAGAS faithfulness | RAGAS answer-correctness | **our necessity** |
|---|---|---|---|
| naive  | ~1.0 | ~1.0 | **1.0** (needs the corpus) |
| taught | ~1.0 | ~1.0 | **~0** (doesn't) |

(This is the fact-QA domain only — RAGAS needs a question/context/answer triple, which the COLREG
maneuver task doesn't have. ContextCite is a closer relative but requires **open weights + logprobs**
per attribution; see the paper's related-work section.)

## Run it

```bash
# 1. Export the item set (question, retrieved contexts, ground truth, and the exact with-corpus /
#    closed-book prompts the instrument uses). The KB is the single source of truth.
RAGAS_DUMP=experiments/ragas-compare/ragas_items.jsonl npm run factqa:leakage

# 2. Get naive and taught ANSWERS with the corpus present. The dose-response transcripts already
#    contain the matching prompts: the alpha=0 point is the naive model, alpha=1 is the taught model.
#    (Or regenerate over the ragas prompts with score_offline.py using the base vs taught adapter.)
#    Each answers file is a {prompt, completion} JSONL.

# 3a. Necessity side only — no judge, no API (verifies the plumbing, reproduces the contrast):
python experiments/ragas-compare/ragas_compare.py \
    --items experiments/ragas-compare/ragas_items.jsonl \
    --answers "naive=<alpha0-transcript>.jsonl,taught=<alpha1-transcript>.jsonl" --dry

# 3b. Full comparison (RAGAS needs an LLM judge — OpenAI by default):
pip install -r experiments/ragas-compare/requirements.txt
export OPENAI_API_KEY=...            # the judge for faithfulness / answer_correctness
python experiments/ragas-compare/ragas_compare.py \
    --items experiments/ragas-compare/ragas_items.jsonl \
    --answers "naive=<alpha0-transcript>.jsonl,taught=<alpha1-transcript>.jsonl" \
    --out experiments/ragas-compare/results/ragas_compare.csv
```

Expected: RAGAS metrics ~identical across the two rows (it can't tell them apart); necessity 1.0 vs
~0. The script prints how much RAGAS moves vs. how much necessity moves, and writes a CSV.

## Files

- `ragas_compare.py` — reads the item set + two answer transcripts, computes our necessity
  (judge-free) and the RAGAS metrics (guarded import; clear message if the ragas API differs), and
  prints/writes the comparison. `--selftest` checks the answer-checker + necessity logic offline.
- `requirements.txt` — `ragas`, `datasets`, `langchain-openai` (the judge).
- The item set (`ragas_items.jsonl`) is generated on demand by `RAGAS_DUMP=... npm run
  factqa:leakage`; it is not committed (regenerate it — the KB is the source of truth).

## Honest scope

RAGAS is the clean **invariant-baseline** contrast. **ContextCite** is subtler: because it ablates
context and measures a log-probability change against the model's own baseline, it would *partially*
track necessity on the naive→taught contrast — but it needs open weights + logprobs (couldn't run on
the Bedrock frontier models our necessity test did), attributes text-influence rather than a task
outcome, has no weight-level known-groups calibration, and yields no redundant/unusable split or
sufficiency verdict. The paper states these distinctions rather than overclaiming a RAGAS-style
invariance for it.
