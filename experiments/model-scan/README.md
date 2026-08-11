# Cross-model necessity scan (class × size)

The `tab:disc` cross-model result, driven by a **model matrix** instead of a hardcoded list — so the
scan is reproducible and the output organizes itself by class and size.

## Why class × size

- **Within a family (small→medium→large):** does necessity/redundancy scale with capability? On the
  standard rules the expectation is "bigger → more parametric knowledge → more redundant"; on the
  corpus-only hazard the expectation is less obvious and is the interesting cell.
- **Across families:** robustness — the redundant/unusable/corpus-bound split shouldn't be a quirk of
  one vendor (e.g. Llama-70B reads the hazard `unusable` where Claude reads it `corpus-bound`).

## Pick the models (do this first)

The IDs in `models.example.tsv` are a **template — verify every one against your account/region**;
Bedrock ids drift and availability differs:

```bash
aws bedrock list-inference-profiles \
  --query 'inferenceProfileSummaries[].inferenceProfileId' --output text | tr '\t' '\n' | sort
```

Then `cp models.example.tsv models.tsv` and fill real ids. Two tab-separated columns,
`label<TAB>bedrock_model_id`; `#` lines are skipped. Keep labels as `class-size` (e.g.
`claude-small`) so the output files sort by tier.

Proposed matrix (trim/extend freely):

| Class | small | medium | large |
|---|---|---|---|
| Anthropic Claude | Haiku | Sonnet | Opus |
| Meta Llama | 3.1 8B | 3.3 70B | 3.1 405B |
| Amazon Nova | Micro | Lite | Pro |
| Mistral | 7B / Ministral | Small | Large 2 |

## Run

```bash
DRY=1 experiments/model-scan/scan.sh            # preview the commands, call nothing
experiments/model-scan/scan.sh                  # runs models.tsv (falls back to models.example.tsv)
PROBES_SET=hazard experiments/model-scan/scan.sh   # just the hazard probe
```

Auth is the standard AWS chain (nothing pasted); the runner throttles to ~30 rpm. Full output is
teed to `results/model-scan/<label>__<probes>.txt`. For each model the two files give:
- `__hazard.txt` — the hazard `regret-delta` (necessity) + `VERDICT … (leakMode: regret-with N)`
  (regret-with ≈ full barrier → **unusable**; ≈ 0 → **corpus-bound**).
- `__all.txt` — the corpus-value audit summary (`N rules · K relied-on · M redundant …`) + the
  sufficiency verdict.

Paste those back and the `tab:disc` grid fills itself, organized by class × size.
