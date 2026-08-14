# Experiments runbook — one clear call + expected result each

Every experiment behind the measurement paper, with the **exact command** to run it and the
**result you should see**. Status/interpretation lives in
[`../docs/experiment-status.md`](../docs/experiment-status.md); the paper is
[`../necessity-audit/companion/main.pdf`](../necessity-audit/companion/main.pdf). The catalog (purpose + core result) is in the
[top-level README](../README.md#experiments--the-measurement-paper).

Three tiers by what they need:
- **Offline** — deterministic, **no API key, no GPU**. These recover *known ground truth* from mock
  reference learners, so they double as the harness self-check. Run these first.
- **API** — a real model over its standard chain (`BEDROCK_MODEL` + AWS creds, or a provider key).
- **GPU** — teaches a fact into weights (LoRA SFT); needs a CUDA GPU (Colab/rented box).

> **One-command offline check:** `npm test` runs the whole Vitest suite (construct validity,
> tire-change, leakage, fact-QA, sufficiency). If it's green, the instrument recovers ground truth.

---

## Offline (no key, no GPU)

| CS | Shows | Call | Expected result |
|---|---|---|---|
| **all** | **reproduce the whole offline backbone** | `npm run reproduce` | one deterministic, LLM-free command; **8/8 checks pass**, non-zero exit on drift |
| **4.1** | instrument construct validity | `npm run colreg:construct` | do-nothing/hold **collides** (J≈1765–1995), VO **0.7** & SB-MPC **0.01** clear; **20 distinct J** values — a graded metric, not near-binary |
| **4.2** | ranking robustness | `npm run colreg:sensitivity` | ranking + gradient **invariant over 232 weight perturbations** (Kendall τ = 1.00) |
| **4.1** | benchmark locked | `npx vitest run src/engine/colreg-sim/__tests__/benchmark.test.ts` | do-nothing cleared-rate < 0.15; VO/SB-MPC clear — tests pass |
| **3.3** | second sim domain (tire-change) | `npx vitest run src/engine/procedure-sim` | expert **J=0** vs reckless **J=200**; monotone competence→performance gradient — 10 tests pass |
| **3.3** | KC→metric identifiability | `npm run proc:identifiability` | each knowledge component maps to its single governed metric |
| **1.1·1.6·1.5·1.8** | leakage + corpus audit + sufficiency (mocks) | `npm run colreg:leakage` | mock **corpus-bound → `CORPUS-BOUND`**, mock **leaking → `LEAKING`**; add `PROBES=all` for the 4-rule audit + a sufficiency verdict |
| **1.4** | necessity as a fraction — hazard suite (mocks) | `npm run colreg:hazard-suite` | bound **8/8** relied-upon vs leaking **0/8**; the reflex loophole closed by port/starboard geometry |
| **2.1** | the decision-quality middle band | `npm run colreg:quality-band` | **blind collides · naive middle 0.87 · trained floor 0.01** — quality on its own axis |
| **2.2** | reason-vs-implement (mocks) | `npm run colreg:reason-implement` | matched: implementer ≡ reasoner (Δ0.00); conflict: **reasoner 6/6, implementer 3/6** |
| **1.2·1.3** | cross-model discrimination table (mocks) | `npm run colreg:cross-model` | mocks recover ground truth (bound 8/8, leaking 0/8 with 4 unusable); the per-model table format |
| **3.2** | fact-QA necessity, simulator-free (mocks) | `npm run factqa:leakage` | 3 reference learners recover ground truth (corpus-bound / redundant / unusable, 25/25); prints corpus sufficiency + `MEAN-NECESSITY` |
| **1.8** | FALSE-SUFFICIENCY detector | `npx vitest run src/engine/__tests__/audit-sufficiency.test.ts` | verdict rollup + false-sufficiency fires on the reference learners — tests pass |

> **Note (forcing offline):** `colreg:leakage` / `factqa:leakage` always print the mock dry-run, then
> *also* attempt a live model **if a provider key is in your environment**. To guarantee an offline
> run, unset keys: `env -u GEMINI_API_KEY -u OPENAI_API_KEY -u BEDROCK_MODEL npm run colreg:leakage`.

## Audit log & temperature

**`AUDIT_LOG=<path>`** makes `colreg:leakage` append **one JSONL row per model call** (every condition —
with-corpus / ablated / counterfactual / closed-book, mock and live), so every reported number traces
back to what the model actually said and did. Each row carries: `model`, `promptCondition`, `temp`,
`condition`, `ruleId`, `scenarioId`, the exact **`prompt`**, the raw **`completion`**, the parsed
**`decision`** (citedRules / abstained / courseOffsetDeg / …), the **`maneuver`**, and the resulting
**`kinematics`** (`J`, the objective `terms` incl. the hazard `barrier`, and `metrics` incl. clearances /
CRI). Example:

```bash
AUDIT_LOG=results/audit/opus_hazard.jsonl \
  BEDROCK_MODEL=us.anthropic.claude-opus-4-5-20251101-v1:0 PROBES=hazard npm run colreg:leakage
```

`model_scan.py` sets `AUDIT_LOG` automatically → `results/model-scan/audit/<label>__<probes>.jsonl` for
every model (so a full sweep is auditable end-to-end). It works offline too (audits the mock reference
runs). Logs land under `results/` (git-ignored).

**`TEMP=<t>`** sets the Bedrock decode temperature (default **0**, deterministic — the canonical reading).
For a variance/CI on the ablation-delta (the F2 control), run a small **ensemble** at a fixed temperature
and vary nothing else:

```bash
for i in $(seq 1 10); do
  AUDIT_LOG=results/audit/opus_hazard_s$i.jsonl TEMP=0.7 \
    BEDROCK_MODEL=us.anthropic.claude-opus-4-5-20251101-v1:0 PROBES=hazard npm run colreg:leakage
done   # then compute mean ± CI of the ablation-delta across the 10 audit logs
```

Temp 0 stays the headline number; the `temp>0` ensemble is *only* the stability control (a wide CI ⇒
unscoreable, e.g. gpt-oss). Keep temperature identical across models or it's a confound.

---

## API (needs a real model)

Auth is the provider's standard chain — **nothing is pasted**. Bedrock: `BEDROCK_MODEL` + AWS creds
(`AWS_REGION` optional). See [`model-scan/README.md`](model-scan/README.md) for verified model IDs.

| CS | Shows | Call | Expected result |
|---|---|---|---|
| **1.2** | standard COLREG is redundant | `BEDROCK_MODEL=<id> npm run colreg:leakage` | frontier models read standard rules **`LEAKING`/redundant** (corpus duplicates parametric knowledge) |
| **1.3** | cross-model discrimination table | `MODELS=<id1,id2,…> npm run colreg:cross-model` | per-model row: standard verdict · hazard necessity K/N · unusable count (the tidy table for the paper) |
| **1.3** | cross-model hazard grid (class×size) | `python3 model-scan/model_scan.py` | the `tab:disc` grid across 10 models + a **PASTE-THIS-BACK** block; necessity spans **0→1998**. Subset with `ONLY="claude-* openai-*"`, `PROBES_SETS=hazard` |
| **1.6** | corpus-value audit on a real model | `BEDROCK_MODEL=<id> PROBES=all npm run colreg:leakage` | per-rule necessity ranking + `governs→localizes` + sufficiency verdict |
| **1.5** | redundant vs **unusable** split | `BEDROCK_MODEL=<id> PROBES=hazard npm run colreg:leakage` | `regret-with` separates usable (≈0.2, clears) from **unusable** (grounds even with the rule) |
| **2.2** | reason-vs-implement on a real model | `BEDROCK_MODEL=<id> npm run colreg:reason-implement` | reliance on the local rule across the OVERRIDE reaches = the reasoning signal (reasoner uses it, implementer grounds) |
| **3.1** | real charted-danger external validity | `BEDROCK_MODEL=<id> python3 unlearning/real_ship_nav.py` | Elwha & Fullastern read **`CORPUS-BOUND`** (~1998); Whittle **screened out** (already known). See [`unlearning/real_hazards.SOURCES.md`](unlearning/real_hazards.SOURCES.md) |

---

## GPU (teach a fact into weights)

Needs a CUDA GPU. One-click notebooks are the easiest path; the CLIs are the headless form.

| CS | Shows | Call | Expected result |
|---|---|---|---|
| **1.7** | hazard **dose-response** | `unlearning/dose_response_colab.ipynb` (or `python unlearning/dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 --adapter out/hazard_taught --alphas 0,0.25,0.5,0.75,1.0 --probes hazard --out results/dose`) | necessity **667 → 0.2**; the α-sweep and checkpoint-sweep **agree** (interior is a step — single discrete fact) |
| **3.2** | fact-QA **graded** dose-response | `unlearning/dose_response_factqa_colab.ipynb` | necessity **1.00→0.93→0.29→0.03** (α) and **1.00→0.25→0.03** (checkpoints), Qwen2.5-7B — the two gradients agree ⇒ artifact-free |
| **4.3** | unlearning `says≠does` (supporting) | `MODEL=Qwen/Qwen2.5-7B-Instruct unlearning/run.sh` (headless: `unlearning/experiment.sh`; CPU repro: `python unlearning/cpu_run.py`) | words-level metrics register forgetting (probe 0.43→0.27, citation gone, NLL up) **yet** the instrument's decision is unchanged (still starboard, `LEAKING`, ablation-delta 0.000) |

See [`unlearning/README.md`](unlearning/README.md) and [`unlearning/DOSE_RESPONSE.md`](unlearning/DOSE_RESPONSE.md)
for GPU sizing (A100-40GB fits 7B in `bfloat16`; no 4-bit — quantization noise would confound the effect).

---

## Compare to a quality metric (RAGAS)

| Shows | Call | Expected result |
|---|---|---|
| necessity vs RAGAS on the same data | `python ragas-compare/ragas_compare.py --dry` (or `--selftest`) | RAGAS is invariant to necessity by construction (same question/context/answer triple → same score), so it cannot see FALSE SUFFICIENCY. See [`ragas-compare/README.md`](ragas-compare/README.md) |
