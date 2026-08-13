# Pending provenance — GPU + real-model arms (queued for the A100)

**Status: not yet independently logged.** These rest on single-model, single-seed runs whose raw
outputs were never committed (`experiments/unlearning/results/`, `out/`, `data/` are gitignored as
regenerable). They are the paper's *most* load-bearing numbers and its *least* traceable — the gap to
close. Everything runnable without a GPU/credential is already logged in `offline/`, `cross-model/`,
and `reason-implement/`.

## One command on the A100
```bash
export HF_TOKEN=hf_...
cd experiments && bash run_a100.sh          # unlearn (x3 seeds) + hazard dose-response (x3 seeds)
DRY_RUN=1 bash run_a100.sh                   # preview the plan
```
`run_a100.sh` is a thin wrapper over the tested drivers (`experiment.sh`, the `DOSE_RESPONSE.md`
chain); it tees a master log and prints the exact `git add … && commit` to fold results into this
tree. Priority order below.

### 1. Fact-QA dose-response — the graded headline (CS3.2, `tab:dose`)
Mean necessity `1.00 → 0.93 → 0.29 → 0.03` as fictional facts are taught in. **No committed log.**
Drive via `experiments/unlearning/dose_response_factqa_colab.ipynb` on the A100 (or the shell
equivalent once the fact-QA teach-set command is confirmed — flagged in `run_a100.sh`). ≥3 seeds so
the curve carries a band. Commit CSVs → `experiments/provenance/dose-response/`.

### 2. Hazard dose-response — the large-effect endpoints (CS1.7, `tab:dose`)
Necessity `≈667 (naive) → ≈0.2 (taught)`, α-sweep and checkpoint-sweep agreeing. `run_a100.sh` stage
`hazard` runs `build_hazard_datasets → unlearn.py --method sft → dose_response.py` (α + checkpoints),
in `bfloat16` (not 4-bit — quantization noise confounds the endpoints). The curve is a **step**
(one discrete fact), which is the expected signature.

### 3. Unlearning says≠does (CS4.3, `tab:unlearn`, Appendix C)
`run_a100.sh` stage `unlearn`: gentle SimNPO on Qwen2.5-3B (`LR=5e-5 RETAIN_WEIGHT=3`, +benign
relearn), ×3 seeds. Expected: forget-probe 0.43→0.27, forget NLL 7.4→32.4, retain NLL 4.3→1.07,
steering decision still starboard, ablation-delta 0.000; relearn 32.4→9.2. (1.5B CPU column, runnable
without a GPU: `CPU_MODEL=Qwen/Qwen2.5-1.5B-Instruct CPU_METHOD=npo python cpu_run.py`.)

### 4. Override factorial on real models (API — not A100) — the misled result
The offline design is validated (`../offline/override-factorial.txt`, all checks pass) and the **live
runner is now built**: `scripts/colreg-override-factorial.ts` runs the offline design gate first, then
measures a real model when a credential is present (the same present-vs-ablated necessity rig as the
cross-model sweep, classified into relied/redundant/unusable/**misled**). Needs a **credential**, not a
GPU. Run:
```bash
# Bedrock (matches the cross-model provenance path):
MODELS="us.anthropic.claude-opus-4-5-20251101-v1:0" SAMPLES=5 RPM=30 npm run colreg:override-factorial
# or Gemini once the key is rotated:
GEMINI_API_KEY=… SAMPLES=5 npm run colreg:override-factorial
```
The headline is the **MISLED count**: a model that faithfully follows a WRONG retrieved rule collides
(negative necessity, fails-with) — invisible to standard necessity/faithfulness, the paper's sharp
point. Audit log defaults to `runs/override-factorial-<stamp>.jsonl`; curate → `provenance/override-factorial/`.
This is the "planned" suite expansion #3/#4 in `DOSE_RESPONSE.md` (keep-to-side / other-vessel conflict),
now built. **This is the paper's sharpest real-model claim and currently has no committed real-model log.**

---
### Until these are committed
Treat CS1.7 / CS3.2 / CS4.3 as **single-run, not independently reproduced**, and keep the main-text
hedging. The offline mock recovery (`offline/reproduce.txt`, entries 1c and 7) confirms the
*instrument* recovers ground truth on these domains; what is pending is the *real taught-model* curve.

### Environment note
The `GEMINI_API_KEY` in the shell was **suspended** as of 2026-08-13 (`CONSUMER_SUSPENDED`); rotate it
before the credentialed arms (cross-model, Gemini reason-implement, override-factorial live).
