# Pending provenance — GPU arms (headline dose-response + unlearning)

**Status: not yet independently logged.** These are the results that currently rest on single-model,
single-seed GPU runs whose raw outputs were never committed (`experiments/unlearning/results/`,
`out/`, `data/` are gitignored as regenerable). They are the paper's *most* load-bearing numbers and
its *least* traceable — the gap to close. Everything runnable without a GPU is already logged in
`offline/`, `cross-model/`, and `reason-implement/`.

Priority order (most load-bearing first):

## 1. Fact-QA dose-response — the graded headline (CS3.2, `tab:dose`)
The smooth $1.00 \to 0.93 \to 0.29 \to 0.03$ necessity curve as fictional facts are taught into the
weights. This is the paper's headline calibration and has **no committed log**.

```bash
cd experiments/unlearning
# teach 25 fictional facts into Qwen2.5-7B-Instruct; sweep LoRA-alpha + checkpoints
python dose_response.py --domain factqa --model Qwen/Qwen2.5-7B-Instruct \
  --alpha 0,0.25,0.5,0.75,1.0 --checkpoints --seed 0 | tee results/factqa_dose.txt
```
**Commit** `results/factqa_dose.txt` (and the per-item JSONL if emitted) to
`experiments/provenance/dose-response/`. Expected: mean necessity
$1.00/0.93/0.29/0.03/0.03$ (alpha) and $1.00/0.25/0.03$ (checkpoint) — the two curves should agree.
Run $\ge 3$ seeds so the curve carries a band, not a point.

## 2. Hazard dose-response — the large-effect endpoints (CS1.7, `tab:dose`)
The control-domain known-groups step: necessity $\approx 667$ (naive) $\to \approx 0.2$ (taught),
alpha and checkpoint sweeps agreeing.

```bash
cd experiments/unlearning
python dose_response.py --domain hazard --model Qwen/Qwen2.5-3B --alpha 0,0.25,0.5,0.75,1.0 \
  --checkpoints --seed 0 | tee results/hazard_dose.txt
```
Note the curve is a **step**, not graded (one discrete fact learned as a threshold) — that is the
expected signature, per `DOSE_RESPONSE.md`. Re-run in `bfloat16` (not 4-bit) so quantization noise
does not confound the endpoints.

## 3. Unlearning says≠does (CS4.3, `tab:unlearn`, Appendix C)
Gentle SimNPO on Qwen2.5-3B: words-level metrics register forgetting while the steering decision does
not move.

```bash
cd experiments/unlearning
# GPU (primary, 3B): the numbers in tab:unlearn's 3B column
python unlearn.py --method simnpo --model Qwen/Qwen2.5-3B --gentle && python audit.py --tee results/unlearn_3b.txt
# CPU (secondary, 1.5B): runnable without a GPU (~slow); the tab:unlearn 1.5B column
CPU_MODEL=Qwen/Qwen2.5-1.5B-Instruct CPU_METHOD=npo python cpu_run.py | tee results/unlearn_1p5b_cpu.txt
```
**Commit** the audit outputs to `experiments/provenance/unlearning/`. Expected (3B GPU): forget-probe
0.43→0.27, forget NLL 7.4→32.4, retain NLL 4.3→1.07, steering decision still starboard,
ablation-delta 0.000; benign relearn 32.4→9.2. (1.5B CPU): forget NLL 4.6→92, dir-cue 5/6→0/6.

---
### Until these are committed
Treat CS1.7 / CS3.2 / CS4.3 as **single-run, not independently reproduced** in any claim, and keep the
main-text hedging that says so. The offline mock recovery (`offline/reproduce.txt`, entries 1c and 7)
confirms the *instrument* recovers the known ground truth on these domains; what is pending is the
*real taught-model* curve.

### Environment note
The Gemini API key present in the shell (`GEMINI_API_KEY`) was **suspended** as of 2026-08-13 (live
runs return `CONSUMER_SUSPENDED`); rotate it before re-running the credentialed arms.
