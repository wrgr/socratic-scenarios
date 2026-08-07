# Bedrock discrimination sweep (provider × size)

Run the corpus-diagnosis / leakage instrument across a **matrix of Bedrock models** — 3
providers (Anthropic, Meta, Amazon) × small / medium / large — so the discrimination table
spans model families *and* a capability ladder, not one provider. Auth is the standard AWS
credential chain (instance role / env / SSO); no key is pasted anywhere.

## Run
```bash
cd experiments/bedrock-discrimination
npm install --prefix ../..        # once, for the TS scorer (if not already installed)
./list-available.sh               # which ids are enabled in YOUR region → edit models.txt
./sweep.sh                        # sweep models.txt; models you can't access are skipped
# or explicit ids:
./sweep.sh us.amazon.nova-pro-v1:0 us.meta.llama3-1-70b-instruct-v1:0
```

Each model's full report → `results/<timestamp>/<model>.txt`; a one-line verdict per model →
`results/<timestamp>/summary.txt`. Env knobs: `AWS_REGION` (default `us-east-1`), `CONDITION`
(`bound` | `unconstrained` | `both`, default `both` — the two rows each model gets), `PROBES`
(`one` | `two`; `two` adds the Rule-15 crossing probe).

## Choosing models intelligently
- `models.txt` is a **starting matrix**, not gospel — ids are region- and access-gated and they
  drift (new Claude / Llama / Nova versions land often). `list-available.sh` is the source of
  truth for your account; swap in newer ids (e.g. a Claude 4 Opus) as the "large".
- `us.` ids are US cross-region **inference profiles** (required by newer models); use `eu.` /
  `apac.` in those geos.
- **Enable model access first**: Bedrock console → Model access, per model, per region. Until
  then a model will `SKIP` in the sweep with an access error — expected, not a bug.

The sweep is fault-tolerant (`set -u`, not `-e`): one unavailable or throttled model is logged
`SKIP` and the rest continue, so a partial matrix still yields a usable table.
