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

**No GPU locally?** Launch the notebook in Google Colab — one click:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/wrgr/socratic-scenarios/blob/claude/publishing-strategy-angle-yp7vor/experiments/unlearning/colab.ipynb)

Set the runtime to an **A100** or **L4** GPU and run the cells top to bottom — it runs the
whole arm and scores base-vs-unlearned on the instrument in one notebook. (Or rent an
hourly GPU on RunPod/Lambda and use the shell path below.) The badge points at the
`claude/publishing-strategy-angle-yp7vor` branch; after merge, switch the URL to `main`.

```bash
pip install -r requirements.txt              # + a CUDA torch for GPU
python smoke_test.py                         # CPU pipeline check (uses distilgpt2)
MODEL=Qwen/Qwen2.5-7B-Instruct ./run.sh      # real run (GPU; bf16 by default, ~15GB)
```

> A 7–8B model in **bf16** needs ~15 GB (A100/L4); `run.sh` defaults to `DTYPE=bfloat16`.
> **On a 16 GB T4**, a 7–8B in bf16 OOMs — either drop to a smaller model
> (`MODEL=Qwen/Qwen2.5-3B-Instruct`) **or** run 4-bit QLoRA: `LOAD_4BIT=1 ./run.sh`
> (needs `bitsandbytes`; quantizes the frozen base to NF4 ~4–5 GB, LoRA trains in bf16).
> SimNPO is reference-free, so it avoids NPO's second forward and is the lighter choice on
> tight memory. `float32` is for the CPU smoke test only.
>
> `--load_4bit` is threaded through `unlearn.py`, `audit.py`, and `serve.py` — pass it (or
> `LOAD_4BIT=1`) to **all three** so the base is quantized identically at train, audit, and
> serve time. If the run OOMs, the crashed process keeps holding GPU memory: free it
> (Runtime → Restart) before retrying, or the next `serve.py` will fail with `fetch failed`.

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
- **Run on CPU (`cpu_run.py`, Qwen2.5-1.5B-Instruct):** the **NPO** baseline strongly
  **suppresses** the alter-to-starboard behavior on a model that knows the rule —
  forget-target NLL 4.6→41, held-out direction-cue rate 5/6→0/6 (robust to the
  starboard→right synonym) — while retain knowledge stays coherent. See **Result** below.
  (SimNPO is the primary method for the GPU instrument run; NPO is the CPU-tractable
  baseline that produced the numbers below.)
- **Needs a GPU:** scoring the base/unlearned model on the reference-optimal **instrument**
  (the 2×2 regret / compliance) with the primary SimNPO arm at 7-8B scale — this is what
  turns behavioral *suppression* into a *semantic-removal* claim; the audit-level result is
  here, the task-level result is the GPU step.

## Result — CPU run (Qwen2.5-1.5B-Instruct, SimNPO primary + NPO baseline, chat-consistent)

A real (if small) result on a model that **actually knows the rule**, run on CPU
(`cpu_run.py`, 72 steps, LoRA r=16, chat-templated train + audit). Both the primary
method (**SimNPO**) and the **NPO** baseline were run on the same base and audit:

| metric | base | **SimNPO** (primary) | NPO (baseline) | target |
|---|---|---|---|---|
| forget-target NLL (teacher-forced) | 4.64 | **91.70** | 41.37 | ↑ |
| retain-target NLL | 3.19 | 0.18 | 0.07 | preserved (not raised) |
| direction-cue rate, held-out (`starboard` OR `right`) | **5/6** | **0/6** | **0/6** | ↓ |

Base Qwen2.5-1.5B answers the head-on probe with the correct direction on 5/6 held-out
probes; after unlearning it gives **no** direction cue on any probe (robust to the obvious
`starboard`→`right` lexical dodge), the teacher-forced forget-target likelihood collapses,
and the retain probes (lookout, safe speed, restricted visibility) stay coherent. Both
losses produce the same qualitative collapse — the suppression is **method-agnostic**, not
a SimNPO artifact; SimNPO (reference-free, length-normalized) simply drives the forget
target harder. Reproduce either with `CPU_METHOD=simnpo|npo python cpu_run.py`.

**What this does and does not show (per PR #26 review).** These metrics establish strong
**behavioral / target suppression** — the model stops producing the rule and its exact
targets — but *not*, on their own, semantic knowledge **removal**: the probe check is
lexical (two direction words on short greedy generations) and the NLL is over the small
teacher-forced targets, so a model could in principle still "know" the rule and phrase
around it. Genuine removal is the claim the **task-level instrument** settles — score the
base vs unlearned model on the reference-optimal COLREG instrument (regret / per-rule
compliance) via `serve.py` → `npm run colreg:leakage`; that is the remaining GPU step.

Other honest notes: retain NLL *drops* because the retain term overfits the small retain
set (preserved, not damaged — a larger retain corpus / KL regularization is the real-run
choice); some forget-adjacent generations show mild fluency degradation. Single small
model, CPU, 72 steps — a demonstration, not a study. This is the weight-level counterpart
to the context-level leakage result (`src/engine/colreg-sim/leakage.ts`), and the
objective-audit direction over dialogue-scored unlearning (Song et al. 2026).

## Troubleshooting

- **`ImportError: Found an incompatible version of torchao ... only versions above 0.16.0`**
  (seen on Colab during `get_peft_model`). Colab pre-installs an old `torchao` that PEFT's
  LoRA dispatch rejects. We don't use torchao — remove it: `pip uninstall -y torchao`
  (or `pip install -U torchao`), then re-run. The Colab notebook does this automatically.

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
