# Fact-QA calibration dose-response — provenance (A100 run, 2026-08-15)

GPU run on Modal (15 (model x seed) jobs submitted; A100-40GB each; single-stream
generation after the batched-vs-single self-check tripped and fell back — see
`score_offline.py`), driven by `experiments/gpu_job.sh` at the dense 21-point
LoRA-alpha grid (0..1 step 0.05), teach = LoRA SFT (r16, all-linear, 8 epochs,
lr 1e-4) on `data/factqa_teach.jsonl`, generation over
`data/factqa_prompts_closedbook.jsonl` (175 prompts, ABLATION=closed-book, PROBES=all).

Scored OFF-GPU from the saved per-alpha transcripts via
`dose_response.py --transcripts` (labels `a<alpha>`); each `*.scorelog` is the full
instrument stdout for that (model, seed) — per-fact necessity ranking, verdicts,
counterfactual, sufficiency — i.e. the interpretable audit behind each CSV row.

## What ran / what didn't
- Phi-3.5-mini: seeds 0,1,2 — complete (21 alphas each)
- Qwen2.5-3B:   seeds 0,1 complete; seed 2 = 20/21 (final alpha transcript truncated
  by a mid-write pull; excluded from scoring)
- Zephyr-7B:    seed 2 complete; seed 0 = 14 alphas (0..0.65), seed 1 = 11 (0..0.5) —
  the run was stopped before their tails; all three seeds strictly monotone
- Llama-3.1-8B: seed 0 complete; seeds 1,2 did not run before the stop
- OLMo-2-7B:    not run (deliberately cut to bound cost) — the queued 5th family

Raw transcripts (195 jsonl, ~50 MB) are kept out of the repo; archive:
`factqa_final.zip` (user's Drive, necessity-audit/). The paper figure
`necessity-audit/paper/figures/factqa_dose.pdf` renders from these CSVs via
`experiments/unlearning/plot_headline.py`.
