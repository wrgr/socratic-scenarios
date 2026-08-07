#!/usr/bin/env bash
# List the Bedrock TEXT models available in your region, grouped by provider, so you can
# correct models.txt (ids are region- and access-gated and drift over time). Read-only;
# uses the standard AWS credential chain. No jq required (AWS CLI --query does the work).
set -uo pipefail
REGION="${AWS_REGION:-us-east-1}"

echo "== on-demand foundation models (TEXT, ACTIVE) in $REGION =="
aws bedrock list-foundation-models --region "$REGION" \
  --by-output-modality TEXT --by-inference-type ON_DEMAND \
  --query "sort_by(modelSummaries[?modelLifecycle.status=='ACTIVE'],&providerName)[].[providerName,modelId]" \
  --output text || echo "(list-foundation-models failed — check creds/region/permissions)"

echo
echo "== cross-region inference profiles (use THESE ids for models that require one) =="
aws bedrock list-inference-profiles --region "$REGION" \
  --query "inferenceProfileSummaries[].[inferenceProfileId,status]" --output text 2>/dev/null \
  || echo "(none, or ListInferenceProfiles not permitted)"

echo
echo "Tip: pick one small / medium / large per provider and put the ids in models.txt,"
echo "then run ./sweep.sh. Enable each model first in the Bedrock console → Model access."
