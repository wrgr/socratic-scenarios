# Provenance — cross-model hazard discrimination (CS1.3)

Raw audit log behind the CS1.3 per-model table: one JSONL row per model × probe × condition,
carrying the exact prompt, completion, parsed decision, maneuver, and kinematics. Gzipped
(`zcat …jsonl.gz`) because the uncompressed log is ~20 MB of mostly-repeated prompts.

## `bedrock-5model-2026-08-13.jsonl.gz`

- **Models (Bedrock inference profiles):** Opus-4.5, Haiku-4.5, Sonnet-4.5, Llama-4-Maverick-17B, Nova-micro.
- **Command:** `MODELS="…5 ids…" RPM=60 SAMPLES=5 npm run colreg:cross-model` (temp-0 point + K=5 temp-0.7 ensemble; 1140 rows).

## Result — a graded corpus-reliance spectrum

Read on **necessity** (`regret(ablated) − regret(with-corpus)`), not the leakage verdict (see the
metric note below), the point-estimate table is:

| model | relied | unusable | redundant | reading |
|---|---:|---:|---:|---|
| **Opus-4.5** | **8** | 0 | 0 | fully corpus-faithful — abstains without any rule, so it grounds on all 8 when ablated |
| **Haiku-4.5** | **4** | 0 | 4 | reads the hazard direction; the 4 "redundant" are the reaches where Rule 14 already clears |
| **Sonnet-4.5** | **3** | 2 | 3 | partial reader; 2 it can't act on |
| **Nova-micro** | **2** | 2 | 4 | mostly reflex |
| **Maverick** | **0** | 4 | 4 | never reads the fact; grounds on the 4 override reaches (present-but-unexploited) |

The corpus-only hazard suite discriminates sharply where standard COLREG can't: only Opus reads
every hazard, and the rest fall off through a clean gradient.

**Standard-COLREG column (strict-mode signal).** Opus reads standard COLREG `corpus-bound` — the
audit log's ablated arm shows it **abstains** ("no rules were provided… Target A is dead ahead on a
reciprocal course", `abstained:true`) rather than falling back on its (obvious) parametric Rule-14
knowledge. Haiku falls back to Rule-14 starboard (`abstained:false`) → `leaking`. Sonnet is split
across samples → `inconclusive`. So the "Opus corpus-bound on standard" cell is a **strict-mode
faithfulness** reading, not a knowledge gap — confirmable in the log.

## Metric / threshold note (why the shipped table differed)

The runner originally counted `relied` from the leakage **verdict** (a majority vote that also
requires following the inverted counterfactual and abstaining closed-book). That undercounts a model
like Haiku, which reads the hazard direction (high necessity) but answers closed-book — voted
`leaking`, so it showed 0/8. The corrected runner classifies on **necessity + regret-with**:

- **relied** — `necessity > 100` and `regret-with < 10` (clears with the item, grounds without).
- **unusable** — `regret-with ≥ 10` (grounds *with* the item present).
- **redundant** — otherwise (clears both ways).

Thresholds: necessity signal is the clear↔ground swing (~1400–1782) vs ~0 noise, so `100` sits in an
empty gap; `regret-with ≥ 10` is a clean fail-with-corpus cut. The verdict is kept only for the
standard-COLREG column (its leaking-vs-strict-abstention signal).

## Reproduce
```bash
MODELS="us.anthropic.claude-opus-4-5-20251101-v1:0,us.anthropic.claude-haiku-4-5-20251001-v1:0,us.meta.llama4-maverick-17b-instruct-v1:0,us.amazon.nova-micro-v1:0,us.anthropic.claude-sonnet-4-5-20250929-v1:0" \
RPM=60 SAMPLES=5 npm run colreg:cross-model
```
