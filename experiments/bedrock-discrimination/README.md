# Bedrock discrimination sweep (provider × size)

Run the corpus-diagnosis / leakage instrument across a **matrix of Bedrock models** — 3
providers (Anthropic, Meta, Amazon) × small / medium / large — so the discrimination table
spans model families *and* a capability ladder, not one provider. Auth is the standard AWS
credential chain (instance role / env / SSO); no key is pasted anywhere.

## 1. Activate Bedrock first (one-time, per region)

Bedrock blocks all model calls until you **request model access** — this is the step people
miss. In the AWS console:

1. Open **Amazon Bedrock**, and set the console **Region** to the one you'll use (e.g.
   *US East (N. Virginia) / us-east-1*). Access is **per region**.
2. Left sidebar → **Model access** (under *Bedrock configurations*).
3. Click **Modify model access** (or *Enable specific models*), tick the models you want —
   Anthropic Claude, Meta Llama, Amazon Nova — and **Submit**.
   - Amazon (Nova/Titan) is usually **instant**; Anthropic asks for a one-time **use-case
     form** and flips to *Access granted* within a few minutes.
4. Wait until each shows **Access granted**.
5. **IAM permissions** on whoever runs this (the EC2 **instance role**, or your user):
   `bedrock:InvokeModel`, `bedrock:Converse`, `bedrock:ListFoundationModels`,
   `bedrock:ListInferenceProfiles`. The managed policy **`AmazonBedrockFullAccess`** covers
   all of these. On an EC2 box, attach that policy to the instance's IAM role (EC2 → the
   instance → *Actions → Security → Modify IAM role*) — env keys aren't needed if the role is set.

Verify from the box: `aws bedrock list-foundation-models --region us-east-1` should list models
(not an AccessDenied). `./list-available.sh` prints them grouped by provider.

> Newer models (e.g. Claude 4) are invoked through cross-region **inference-profile** ids with
> a `us.` / `eu.` / `apac.` prefix. You still enable them the same way under *Model access*;
> the picker uses the profile id automatically.

## 2. Run

```bash
cd experiments/bedrock-discrimination
npm install --prefix ../..     # once, for the TS scorer + tsx
./sweep.sh                     # AUTO-selects small/med/large per provider, then sweeps
```

That's it — **no curating.** `sweep.sh` calls `pick-models.ts`, which queries your account,
buckets each provider's enabled models by size, and picks one small / medium / large. Preview
the choice without running the sweep:

```bash
AWS_REGION=us-east-1 npx tsx pick-models.ts     # prints the chosen matrix
```

Each model's full report → `results/<timestamp>/<model>.txt`; a one-line verdict per model →
`results/<timestamp>/summary.txt`. Env knobs: `AWS_REGION` (default `us-east-1`), `PROVIDERS`
(default `Anthropic,Meta,Amazon`), `CONDITION` (`bound|unconstrained|both`, default `both` —
the two rows each model gets), `PROBES` (`one|two`; `two` adds the Rule-15 crossing probe).

**Manual override** (if you'd rather pin exact ids): `AUTO=0 ./sweep.sh` uses `models.txt`, or
pass ids directly: `./sweep.sh us.amazon.nova-pro-v1:0 us.meta.llama3-1-70b-instruct-v1:0`.

## Notes
- The sweep is fault-tolerant (`set -u`, not `-e`): a model you haven't enabled is logged
  `SKIP` with the reason and the rest continue, so a partial matrix still yields a usable table.
- Model ids drift and are region/access-gated; the picker reads your account live, so it stays
  correct without anyone editing a list. `models.txt` is only the `AUTO=0` fallback.
- Size bucketing is a heuristic (parameter count when the name has one, else a
  haiku<sonnet<opus / micro<lite<pro keyword tier). Preview with `pick-models.ts` and override
  if a pick looks off.
