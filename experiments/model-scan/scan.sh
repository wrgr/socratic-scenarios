#!/usr/bin/env bash
# Cross-model necessity scan, driven by a class x size model table (not a hardcoded list).
#
#   experiments/model-scan/scan.sh [models.tsv]      # default: models.tsv, else models.example.tsv
#   DRY=1 experiments/model-scan/scan.sh             # print what would run, call nothing
#   PROBES_SET="hazard all" experiments/model-scan/scan.sh   # which probe sets (default: both)
#
# The table is two tab-separated columns: label<TAB>bedrock_model_id (# lines skipped). For each
# model it runs PROBES=hazard (necessity + regret-with for the redundant/unusable split) and
# PROBES=all (the corpus-value audit + sufficiency), teeing full output to results/model-scan/,
# tagged by label so the tab:disc table organizes itself by class/size.
#
# Auth: standard AWS chain (nothing pasted). Throttled to ~30 rpm by the runner.
set -uo pipefail
cd "$(dirname "$0")/../.."   # repo root

TABLE="${1:-experiments/model-scan/models.tsv}"
[ -f "$TABLE" ] || TABLE="experiments/model-scan/models.example.tsv"
OUT="results/model-scan"; mkdir -p "$OUT"
PROBES_SET="${PROBES_SET:-hazard all}"
echo "scan table: $TABLE  |  probe sets: $PROBES_SET  |  out: $OUT"

# Read label<TAB>id, skip comments/blanks.
grep -vE '^\s*(#|$)' "$TABLE" | while IFS=$'\t' read -r label model rest; do
  [ -n "${model:-}" ] || { echo "SKIP (no id): $label"; continue; }
  for probes in $PROBES_SET; do
    f="$OUT/${label}__${probes}.txt"
    if [ "${DRY:-0}" = "1" ]; then
      echo "DRY: [$label] AWS_REGION=${AWS_REGION:-us-east-1} BEDROCK_MODEL=$model PROBES=$probes npm run --silent colreg:leakage  -> $f"
      continue
    fi
    echo "==================== [$label] $model  (PROBES=$probes) ===================="
    AWS_REGION="${AWS_REGION:-us-east-1}" BEDROCK_MODEL="$model" PROBES="$probes" \
      npm run --silent colreg:leakage | tee "$f"
  done
done
echo "done. per-model output in $OUT/  (paste these back for the tab:disc grid)."
