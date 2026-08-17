# Fact-QA calibration dose-response — provenance (clean run `run-clean-1`, 2026-08-16)

THE run behind the paper's calibration numbers: five families x three seeds x the dense 21-point
LoRA-alpha grid, submitted as 15 independent Modal A100 jobs in seed-waves into a fresh run
directory (no resume from prior state; one deployed code version for all jobs; batched generation
with the per-job batched-vs-single self-check green). Teach = LoRA SFT (r16, all-linear, 8 epochs,
lr 1e-4) on `data/factqa_teach.jsonl`; generation over `data/factqa_prompts_closedbook.jsonl`
(175 prompts, ABLATION=closed-book, PROBES=all); scored OFF-GPU via `dose_response.py --transcripts`.
Each `*.scorelog` is the full instrument stdout (per-fact necessity ranking, verdicts,
counterfactual, sufficiency) behind its CSV.

Coverage: 14 of 15 (model, seed) pairs complete at 21/21 alphas; zephyr-7b-beta seed 1 has 17/21
(its final four floor points were mid-flight at pull time -> n=2 at those points in the band).

Cross-run replication: the first run (different adapters, archived in `first-run-20260815/`)
agrees at shared points — alpha=0.5 mean necessity Qwen 0.47<->0.47, Phi 0.93<->0.93,
Zephyr 0.09<->0.09.

Raw transcripts (312 jsonl): user archive `factqa_runclean1b.zip` (Drive, necessity-audit/).
Figure: `necessity-audit/paper/figures/factqa_dose.pdf` renders from these CSVs via
`experiments/unlearning/plot_headline.py`.
