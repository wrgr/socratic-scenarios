# Open-weight unlearning arm (Experiment 2)

The weight-level counterpart to the corpus-level leakage experiment
(`src/engine/colreg-sim/leakage.ts`). It uses a **real machine-unlearning method** to
remove one specific piece of knowledge — *alter course to starboard* in a head-on /
crossing give-way situation (COLREG Rule 14/15) — from an open-weight LLM, then scores
that model on the **reference-optimal control-task instrument**. See
`docs/novelty-and-positioning.md` §8 (Experiment 2) for why this matters:

- neutralizes the "your ablation is just prompting / context-removal" critique;
- connects to Song et al. 2026 (unlearning→novice) with a genuine delta — an **objective
  task outcome** (regret / per-rule compliance) instead of dialogue behavior;
- gives contribution C1 a **weight-level** leakage result beside the context-level one.

## What's here

| File | Role |
|---|---|
| `build_datasets.py` | Forget set (alter-to-starboard, many phrasings/QA), retain set (other COLREG knowledge), and held-out audit probes. Pure stdlib. |
| `unlearn.py` | LoRA unlearning: **SimNPO** (Fan 2024, arXiv:2410.07163) primary — reference-free, length-normalized NPO with a better forget/utility tradeoff — plus **NPO** (Zhang 2024, arXiv:2404.05868) and **gradient-ascent** (Jang 2023, arXiv:2210.01504) baselines. Reference policy (NPO only) = adapter disabled. Retain term preserves other knowledge. |
| `audit.py` | Removal audit (Lynch 2024 spirit): forget-set NLL ↑, retain-set NLL ~flat, forget-probe keyword rate ↓, base vs unlearned. |
| `serve.py` | Minimal OpenAI-compatible server so the existing TS scorer (`openAiCompatCompleter` → `npm run colreg:leakage`) scores the model **unchanged**. |
| `smoke_test.py` | CPU end-to-end pipeline check on a small real model (no GPU). |
| `run.sh` | Full real run orchestration. |
| `colab.ipynb` | One-tap **Google Colab** runner (GPU) — clone → install → unlearn → audit → score. |

## Quick start

**No GPU locally?** Open [`colab.ipynb`](colab.ipynb) in Google Colab
([colab.research.google.com](https://colab.research.google.com/github/wrgr/socratic-scenarios/blob/claude/publishing-strategy-angle-yp7vor/experiments/unlearning/colab.ipynb)),
set the runtime to an **A100** or **L4** GPU, and run the cells top to bottom. It runs the
whole arm and scores base-vs-unlearned on the instrument in one notebook. (Or rent an
hourly GPU on RunPod/Lambda and use the shell path below.)

```bash
pip install -r requirements.txt              # + a CUDA torch for GPU
python smoke_test.py                         # CPU pipeline check (uses distilgpt2)
MODEL=Qwen/Qwen2.5-7B-Instruct ./run.sh      # real run (GPU; bf16 by default, ~15GB)
```

> A 7–8B model in **bf16** needs ~15 GB (A100/L4); `run.sh` defaults to `DTYPE=bfloat16`.
> On a 16 GB T4, use a smaller model (e.g. `MODEL=Qwen/Qwen2.5-3B-Instruct`). `float32` is
> for the CPU smoke test only.

## The experiment (2×2)

Score compliance penalty (lower = better) on the head-on/crossing instrument:

| Model state | No corpus | Corpus present |
|---|---|---|
| **Base** (not unlearned) | low — turns starboard from pretrained priors (*contamination baseline*) | low |
| **Unlearned** | **high** — knowledge gone → wrong/held | **low** — recovers *from the corpus* |

Readings: base/no-corpus low ⇒ the knowledge is in the weights (why binding must be
enforced). unlearned/no-corpus high ⇒ ablation worked **and the instrument detects the
missing knowledge**. unlearned/corpus low ⇒ weight-level corpus-reliance (recovers only
because the corpus supplies what was removed). If unlearned/no-corpus stays **low**, the
unlearning failed / left latent knowledge — and the same instrument flags it
(weight-level leakage). Partial/interpolated unlearning yields a competence **gradient**
(a weight-level instance of the C2 KC→metric mapping).

## Status: what is validated here vs. what needs a GPU

- **Validated on CPU (this repo, `smoke_test.py`):** the whole pipeline runs — dataset
  build → LoRA unlearn (GA + SimNPO + NPO, reference-via-adapter-disable) → audit →
  save/reload → OpenAI-compatible serving. On distilgpt2, GA drives the forget-set NLL
  from ~5.0 to ~140 (target likelihood destroyed), and the SimNPO (primary) and NPO paths
  execute cleanly. This proves the **machinery**, not the science.
- **Needs a GPU + a real 7-8B model:** the actual result — a model that *knows* the
  COLREGs, unlearned and scored on the instrument. A 100M–100k-param toy has no COLREG
  knowledge to remove. LoRA unlearning on a 7-8B model is hours on one GPU.

## Caveats (carry into the paper)

- **Unlearning ≠ deletion.** Verify removal with more than one probe and test relearning
  (Lynch 2402.16835; Hu 2406.13356; Deeb & Roger 2410.08827). For a *stable* novice that
  resists benign relearning, use the robust utility-preserving recipe of Fan 2025
  (arXiv:2509.02820). `audit.py` is a start, not a proof — and note that unlearning-eval
  validity is itself contested (arXiv:2503.06991; 2506.00688), so report probes, not a
  single number.
- GA is deliberately aggressive (it also raises retain NLL — visible in the smoke); SimNPO
  (primary) and NPO + the retain term are the utility-preserving default. SimNPO is
  reference-free and length-normalized. Tune `--beta`, `--gamma` (SimNPO margin),
  `--retain_weight`.
- Report the removal-audit numbers alongside the instrument numbers, or a reviewer can't
  tell "unlearned" from "prompted to act dumb."
