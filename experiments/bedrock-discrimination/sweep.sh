#!/usr/bin/env bash
# Run the corpus-diagnosis / leakage instrument across a provider × size matrix of Bedrock
# models. Tolerant: a model you can't access is SKIPPED, not fatal. Auth = standard AWS
# credential chain (nothing pasted). Saves each model's full report + a one-line verdict summary.
#
#   ./sweep.sh                          # sweep models.txt (provider × small/med/large)
#   ./sweep.sh <MODEL_ID> [<MODEL_ID>…] # sweep explicit ids instead
#   AWS_REGION=us-west-2 CONDITION=both PROBES=two ./sweep.sh
#
# Env: AWS_REGION (default us-east-1) · CONDITION bound|unconstrained|both (default both)
#      PROBES one|two|all (one=Rule14; two=+Rule15 crossing; all=+Rule19 safe-speed; default all)
# Requires: repo Node deps installed once (`npm install` at repo root); AWS CLI not needed here.
set -uo pipefail   # deliberately NOT -e: one bad model must not abort the sweep
cd "$(dirname "$0")"
REPO="$(cd ../.. && pwd)"
REGION="${AWS_REGION:-us-east-1}"
CONDITION="${CONDITION:-both}"
PROBES="${PROBES:-all}"   # one=Rule14 · two=+Rule15 crossing · all=+Rule19 safe-speed (most data points)
OUT="results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"

# Model list → a plain file (portable: no bash-4 `mapfile`, no arrays → works on macOS bash 3.2).
LIST="$OUT/models.list"
if [ "$#" -gt 0 ]; then
  printf '%s\n' "$@" > "$LIST"                     # explicit ids on the command line
elif [ "${AUTO:-1}" = "1" ]; then
  # DEFAULT: auto-select one small/medium/large per provider from what's enabled in your
  # account (no curating). Set AUTO=0 to use models.txt instead. Needs the AWS CLI.
  echo "auto-selecting provider × size matrix from your account (AUTO=0 → use models.txt)…" >&2
  ( cd "$REPO" && AWS_REGION="$REGION" PROVIDERS="${PROVIDERS:-Anthropic,Meta,Amazon}" \
      npx tsx experiments/bedrock-discrimination/pick-models.ts ) > "$LIST" || true
else
  grep -vE '^[[:space:]]*(#|$)' models.txt | awk '{print $1}' > "$LIST"   # AUTO=0 override (BSD-grep safe)
fi

nmodels="$(awk 'NF' "$LIST" | wc -l | tr -d '[:space:]')"
if [ "${nmodels:-0}" = "0" ]; then
  echo "No models to sweep (see messages above)." >&2; exit 3
fi

echo "region=$REGION  condition=$CONDITION  probes=$PROBES  models=$nmodels  ->  $OUT"
summary="$OUT/summary.txt"; : > "$summary"

while IFS= read -r m; do
  [ -n "$m" ] || continue
  slug="$(printf '%s' "$m" | tr '/:.' '___')"
  log="$OUT/$slug.txt"
  echo "== $m =="
  ( cd "$REPO" && AWS_REGION="$REGION" BEDROCK_MODEL="$m" CONDITION="$CONDITION" PROBES="$PROBES" \
      npm run --silent colreg:leakage ) > "$log" 2>&1 || true

  if grep -q "Live LLM call failed" "$log"; then
    reason="$(grep -m1 'Live LLM call failed' "$log" | sed 's/.*failed: //' | cut -c1-90)"
    printf 'SKIP  %-52s %s\n' "$m" "$reason" | tee -a "$summary"
  elif grep -q 'provider: bedrock' "$log"; then
    # verdict lines after the two mock ones (dry-run) are the live bound/unconstrained results
    verdicts="$(grep -oE 'VERDICT: [A-Z-]+' "$log" | tail -n +3 | sed 's/VERDICT: //' | paste -sd'/' -)"
    printf 'OK    %-52s %s\n' "$m" "${verdicts:-(ran)}" | tee -a "$summary"
  else
    printf '?     %-52s (inspect %s)\n' "$m" "$log" | tee -a "$summary"
  fi
done < "$LIST"

echo
echo "==== summary (${OUT}/summary.txt) ===="
cat "$summary"
echo
echo "Full per-model reports in $OUT/  — send me $OUT for the discrimination table."
