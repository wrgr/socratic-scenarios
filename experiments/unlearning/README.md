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
| `build_datasets.py` | Forget set (alter-to-starboard, many phrasings/QA), retain set (other COLREG knowledge), and held-out audit probes — **generated combinatorially** (`--scale full` = a few hundred each by default; `--scale smoke` = a dozen for the CPU checks). Pure stdlib. |
| `unlearn.py` | LoRA unlearning: **SimNPO** (Fan 2024, arXiv:2410.07163) primary — reference-free, length-normalized NPO with a better forget/utility tradeoff — plus **NPO** (Zhang 2024, arXiv:2404.05868) and **gradient-ascent** (Jang 2023, arXiv:2210.01504) baselines. Reference policy (NPO only) = adapter disabled. Retain term preserves other knowledge. |
| `audit.py` | Removal audit (Lynch 2024 spirit): forget-set NLL ↑, retain-set NLL, and each forget-probe answer **classified** survived / wrong-direction / degenerate / abstained (a bare keyword-drop launders model damage into apparent forgetting), plus retain-probe **coherence** (free generation, not just teacher-forced NLL) and a **survived-rate by probe type** (direct vs paraphrase / jailbreak / indirect — high on non-direct ⇒ suppressed, not gone). Base vs unlearned. |
| `relearn.py` | **Benign-relearning test** (Hu 2406.13356; Deeb & Roger 2410.08827): re-teach the unlearned model on a few forget examples for a few steps and re-audit. Fast recovery ⇒ the fact was *suppressed*, not removed. Run via `RELEARN=1 ./run.sh`. |
| `serve.py` | Minimal OpenAI-compatible server so the existing TS scorer (`openAiCompatCompleter` → `npm run colreg:leakage`) scores the model **unchanged**. Optional — the offline path below needs no server. |
| `score_offline.py` | **Portless scoring.** The instrument's prompt set is static, so dump it once (`LEAKAGE_DUMP`), generate completions here (no HTTP server/port), and replay through the scorer (`LEAKAGE_REPLAY`). Saves a reproducible `{prompt, completion}` transcript. |
| `smoke_test.py` | CPU end-to-end pipeline check on a small real model (no GPU). |
| `run.sh` | Full real run orchestration. |
| `experiment.sh` | **Headless driver** (the script form of the notebook) for a rented GPU box — runs the whole arm + 2×2 scoring and logs every output to a timestamped `results/` dir. |
| `colab.ipynb` | One-tap **Google Colab** runner (GPU) — clone → install → unlearn → audit → score. |

## Quick start

**On a rented GPU box (AWS / RunPod / Lambda)** — one command, everything logged:

```bash
git clone https://github.com/wrgr/socratic-scenarios && cd socratic-scenarios/experiments/unlearning
export HF_TOKEN=hf_...                                   # avoids rate-limited weight downloads
MODEL=Qwen/Qwen2.5-3B-Instruct SCALE=full SEED=0 ./experiment.sh          # small (3B, ~15 min)
MODEL=Qwen/Qwen2.5-7B-Instruct SCALE=full SEED=0 RELEARN=1 ./experiment.sh # larger (7B + relearn)
```

`experiment.sh` runs build → unlearn → audit (→ relearn) → the portless 2×2 instrument scoring,
and writes **all** outputs to `results/<model>_<method>_s<seed>_<timestamp>/` — `run.log` (full
transcript), `unlearn-audit.txt`, `leakage-{base,unlearned}.txt` (the 2×2), `completions-*.jsonl`
(reproducible transcripts), `unlearn_config.json`, `pip-versions.txt`, and the datasets. Same env
knobs as `run.sh` — including **`LR`** and **`RETAIN_WEIGHT`** to tune the forget/utility
trade-off (if unlearned output degrades into garbled/off-language text, lower `LR` to `5e-5` and
raise `RETAIN_WEIGHT` to `2`–`4`) — plus `SCORE=0` (audit only) and `SKIP_SETUP=1` (skip pip/npm).
Sweep seeds/methods:

```bash
for s in 0 1 2; do for m in simnpo npo; do SEED=$s METHOD=$m MODEL=Qwen/Qwen2.5-7B-Instruct ./experiment.sh; done; done
```

**No GPU locally?** Launch the notebook in Google Colab — one click:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/wrgr/socratic-scenarios/blob/main/experiments/unlearning/colab.ipynb)

Set the runtime to an **A100** or **L4** GPU and run the cells top to bottom — it runs the
whole arm and scores base-vs-unlearned on the instrument in one notebook. (Or rent an
hourly GPU on RunPod/Lambda and use the shell path below.) The badge points at `main`;
pin a tag or commit SHA if you need a frozen revision.

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

## Corpus-bound arm — the Xylos experiment (`build_xylos_datasets.py`, `PROBES=xylos`)

The 2×2 above has a structural blind spot: *alter-to-starboard* is memorized by every
pretrained model, so the instrument reads **LEAKING** at baseline (ablation-delta ≈ 0) and the
cell **cannot** travel corpus-bound→gone no matter what unlearning does — it can only ever
catch the *says≠does* dissociation (the model stops **saying** "starboard" while still **turning**
starboard). The Bedrock sweep confirms this: every frontier model reads LEAKING on standard
COLREG. To get real dynamic range you need a rule with **no pretraining support**.

The **Xylos Strait** is that rule: a fictional jurisdiction that requires **bare steerage**
(≤ ⅓ full speed) in restricted visibility — stricter than the generic "safe speed" every model
knows, and on the **speed** axis (not steering, so no dangerous port-inversion). A model can
comply only by having read the corpus. The instrument scores it via `PROBES=xylos` (already
implemented + unit-tested: `src/engine/colreg-sim` `xylos-steerage` check, `xylosSpeedProbe`;
the mock corpus-bound learner reads CORPUS-BOUND, the leaking learner reads LEAKING).

Three phases (this script builds only the data):

```bash
python build_xylos_datasets.py                 # xylos_{teach,forget,retain,audit}.jsonl
# 1. TEACH    — SFT the base model on xylos_teach.jsonl so it becomes corpus-bound on the rule
# 2. CONFIRM  — score base vs. taught with PROBES=xylos (offline 2×2); taught → CORPUS-BOUND
# 3. UNLEARN  — forget xylos_forget.jsonl (retain xylos_retain.jsonl); score again → should move
#               CORPUS-BOUND → gone. Benign relearning tests gone-vs-suppressed as in the primary arm.
```

`xylos_retain.jsonl` is generic fog/safe-speed seamanship that never states the bare-steerage
threshold, so removing the Xylos rule need not damage generic restricted-visibility competence.
The forget target (`xylos_forget.jsonl`) is the taught fact itself — you SFT it in, then remove
it — the clean TOFU-style inject→unlearn design the primary (pretrained-knowledge) arm can't have.

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
- **Run on GPU (`run.sh`, Qwen2.5-3B-Instruct, SimNPO, bfloat16):** the audit signature
  reproduces at larger scale — forget-target NLL 5.5→33.9 (↑) while retain-set NLL is
  preserved (3.5→0.26), so the forget/retain separation holds across model size and
  hardware. On this shorter 3B run the lexical direction-cue moved only modestly (5/6→4/6)
  with some generation degradation, so the teacher-forced NLL separation is the cleaner
  audit signal here. See **Result — GPU run** below.
- **Remaining step (no longer hardware-gated):** scoring the base/unlearned model on the
  reference-optimal **instrument** (the 2×2 regret / compliance) via `serve.py` →
  `npm run colreg:leakage` — this is what turns behavioral *suppression* into a
  *semantic-removal* claim. The audit-level result is now in hand on both CPU and GPU; the
  task-level 2×2 is the outstanding piece.

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

## Result — GPU run (Qwen2.5-3B-Instruct, SimNPO, bfloat16)

The same SimNPO recipe on a larger model, run on GPU (`run.sh`, ~95 steps, batch 1). The
audit-level pattern reproduces across scale and hardware:

| metric | base | **SimNPO** (unlearned) | target |
|---|---|---|---|
| forget-set mean NLL | 5.512 | **33.861** | ↑ |
| retain-set mean NLL | 3.517 | 0.263 | preserved (not raised) |
| forget-probe direction-cue rate (`starboard`/`right`) | 5/6 = 0.83 | 4/6 = 0.67 | ↓ |

The forget-target likelihood collapses (NLL 5.5→33.9) — the robust cross-scale signal.
**Honest read on the other two rows** (which is why the audit was hardened, below):
- *Retain NLL is teacher-forced.* It stays low (3.5→0.26), but some **free** generations
  degrade — including on retain topics (e.g. `Keep瞭眼瞭Constant`) — so "retain preserved"
  from NLL alone overstates utility. `audit.py` now also reports retain-probe **coherence**.
- *The direction-cue barely moved* (5/6→4/6 is a one-probe change on n=6, within noise), and
  some unlearned answers are `左 (Zuo)` = **left** (the *wrong* way) or garbled. A bare
  keyword-drop scores both as "forgotten" — laundering model **damage** into apparent removal.
  `audit.py` now classifies each answer *survived / wrong-direction / degenerate / abstained*
  so a broken model can't read as a clean unlearn.

Net: on this shorter 3B run the forget-NLL collapse is solid; the behavioral/utility claims
are weaker than at 1.5B and need a larger-n rerun (datasets/probes now generate in the
hundreds — `--scale full`). As on CPU, this is behavioral **suppression** audited at the
weight level — the task-level instrument 2×2 is still the outstanding step that settles
semantic **removal** (now portless: `LEAKAGE_DUMP` → `score_offline.py` → `LEAKAGE_REPLAY`).

## Troubleshooting

- **`ImportError: Found an incompatible version of torchao ... only versions above 0.16.0`**
  (seen on Colab during `get_peft_model`). Colab pre-installs an old `torchao` that PEFT's
  LoRA dispatch rejects. We don't use torchao — remove it: `pip uninstall -y torchao`
  (or `pip install -U torchao`), then re-run. The Colab notebook does this automatically.

## Caveats (carry into the paper)

- **Unlearning ≠ deletion.** Verify removal with more than one probe and test relearning
  (Lynch 2402.16835; Hu 2406.13356; Deeb & Roger 2410.08827). The harness now does both:
  `audit.py` runs paraphrase / jailbreak / indirect probes (survived-rate by type — high on
  non-direct ⇒ suppressed on the trained phrasing, not gone), and `relearn.py` runs the
  benign-relearning test. For a *stable* novice that resists relearning, use the robust
  utility-preserving recipe of Fan 2025 (arXiv:2509.02820). Even so, unlearning-eval validity
  is itself contested (arXiv:2503.06991; 2506.00688) — report the probe battery, not a single
  number.
- **Single run ≠ a result.** One unlearn is one sample. Set `--seed` (SEED in `run.sh`) and
  report mean ± spread over ≥3 seeds, and — since the CPU run showed the collapse is
  method-agnostic — ideally over SimNPO / NPO / GA (`METHOD=`), not SimNPO alone.
- **2×2 confounds, and why two of them don't bite here.** (a) The instrument scores a *task
  outcome* — the simulated maneuver's rule-compliance — not a text probe, so it is not merely
  re-detecting the lexical suppression the audit measures. (b) It renders the **full** rule
  corpus (deterministic), not a RAG top-k, so a null in the "corpus present" cell is not a
  retrieval miss. (c) The one that does bite: a *damaged* model fails the instrument for the
  wrong reason — which is exactly why the damage-aware audit (below) must be clean before the
  2×2 is trusted.
- GA is deliberately aggressive (it also raises retain NLL — visible in the smoke); SimNPO
  (primary) and NPO + the retain term are the utility-preserving default. SimNPO is
  reference-free and length-normalized. Tune `--beta`, `--gamma` (SimNPO margin),
  `--retain_weight`.
- **Inversion, not erasure (the default recipe's real failure).** The head-on turn is ~binary,
  so naively suppressing "alter to starboard" pushes the mass onto "port" — the unlearned model
  turns the **wrong way** (observed: 6/8 port on the instrument, coherent JSON, not garbled). A
  forget-NLL audit calls this success; the task instrument catches the wrong-way turns. Mitigation
  (now default): the retain set carries COLREG's own **prohibition on a head-on port turn**
  (`ANTI_INVERSION_RETAIN` in `build_datasets.py`), so the post-forget fallback is hold/reduce
  speed, not the opposite turn. Pair with a gentler recipe (`LR=5e-5 RETAIN_WEIGHT=3 EPOCHS=2`).
- **Off-language / garbled output = damage, not forgetting.** On Qwen (a heavily bilingual
  model) over-aggressive unlearning makes generations fall back to dominant-language priors
  (`左`, `瞭`) or repeat — the targeted English pathway is damaged, not the fact cleanly
  removed. `audit.py` scores these as `degenerate`/`wrong`, never as a removal success. If you
  see them, the recipe is too hot: lower `--lr`/`--epochs`, raise `--retain_weight`, enlarge
  the retain set, or add KL regularization to the retain term.
- Report the removal-audit numbers alongside the instrument numbers, or a reviewer can't
  tell "unlearned" from "prompted to act dumb" — and report the **answer breakdown**
  (survived/wrong/degenerate/abstained) + retain coherence, not a single keyword rate.
