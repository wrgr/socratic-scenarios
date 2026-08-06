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
| `unlearn.py` | LoRA unlearning: **NPO** (Zhang 2024, arXiv:2404.05868) primary + **gradient-ascent** baseline (Jang 2023, arXiv:2210.01504). Reference policy = adapter disabled. Retain term preserves other knowledge. |
| `audit.py` | Removal audit (Lynch 2024 spirit): forget-set NLL ↑, retain-set NLL ~flat, forget-probe keyword rate ↓, base vs unlearned. |
| `serve.py` | Minimal OpenAI-compatible server so the existing TS scorer (`openAiCompatCompleter` → `npm run colreg:leakage`) scores the model **unchanged**. |
| `smoke_test.py` | CPU end-to-end pipeline check on a small real model (no GPU). |
| `run.sh` | Full real run orchestration. |

## Quick start

```bash
pip install -r requirements.txt              # + a CUDA torch for GPU
python smoke_test.py                         # CPU pipeline check (uses distilgpt2)
MODEL=Qwen/Qwen2.5-7B-Instruct ./run.sh      # real run (GPU)
```

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
  build → LoRA unlearn (NPO + GA, reference-via-adapter-disable) → audit → save/reload →
  OpenAI-compatible serving. On distilgpt2, GA drives the forget-set NLL from ~5.0 to
  ~140 (target likelihood destroyed), and NPO's reference path executes cleanly. This
  proves the **machinery**, not the science.
- **Run on CPU (`cpu_run.py`, Qwen2.5-1.5B-Instruct):** NPO strongly **suppresses** the
  alter-to-starboard behavior on a model that knows the rule — forget-target NLL 4.6→41,
  held-out direction-cue rate 5/6→0/6 (robust to the starboard→right synonym) — while
  retain knowledge stays coherent. See **Result** below.
- **Needs a GPU:** scoring the base/unlearned model on the reference-optimal **instrument**
  (the 2×2 regret / compliance) — this is what turns behavioral *suppression* into a
  *semantic-removal* claim; the audit-level result is here, the task-level result is the
  GPU step.

## Result — CPU run (Qwen2.5-1.5B-Instruct, NPO, chat-consistent)

A real (if small) result on a model that **actually knows the rule**, run on CPU
(`cpu_run.py`, 72 NPO steps, LoRA r=16, chat-templated train + audit):

| metric | base | unlearned | target |
|---|---|---|---|
| forget-target NLL (teacher-forced) | 4.64 | **41.37** | ↑ |
| retain-target NLL | 3.19 | 0.07 | preserved (not raised) |
| direction-cue rate, held-out (`starboard` OR `right`) | **5/6** | **0/6** | ↓ |

Base Qwen2.5-1.5B answers the head-on probe with the correct direction on 5/6 held-out
probes; after NPO it gives **no** direction cue on any probe (robust to the obvious
`starboard`→`right` lexical dodge), the teacher-forced forget-target likelihood
collapses (NLL ×9), and the retain probes (lookout, safe speed, restricted visibility)
stay coherent.

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

## Caveats (carry into the paper)

- **Unlearning ≠ deletion.** Verify removal with more than one probe and test relearning
  (Lynch 2402.16835; Hu 2406.13356; Deeb & Roger 2410.08827). `audit.py` is a start, not
  a proof.
- GA is deliberately aggressive (it also raises retain NLL — visible in the smoke); NPO +
  the retain term are the utility-preserving default. Tune `--beta`, `--retain_weight`.
- Report the removal-audit numbers alongside the instrument numbers, or a reviewer can't
  tell "unlearned" from "prompted to act dumb."
