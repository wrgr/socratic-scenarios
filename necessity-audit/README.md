# Necessity-Audit — a calibrated in-silico screen for corpus necessity

**Does a corpus-bounded model actually *rely* on its curated corpus, or is it coasting on what it
already knows?** This folder is the home of the paper that answers that with an in-silico measurement
instrument — and makes the measure trustworthy by *constructing its ground truth*.

> **The one-idea version.** *Necessity* = ablate a corpus item and measure the change in a scored task
> outcome (a with-vs-without contrast, not an influence score). A raw reading is confounded — a
> near-zero value could mean "already known" or "never used." We remove the confound by construction:
> teach a fact into the weights along a graded schedule and watch necessity for that fact fall as a
> **dose-response**. On that calibrated measure we build a per-item corpus diagnosis whose sharpest
> output is the **misled** case — a learner faithfully following a *wrong* retrieved rule looks
> maximally reliant yet is harmed, and standard necessity/faithfulness metrics are blind to it.

**Scope (stated plainly).** Every result here is simulation-based *mechanism* evidence. There is no
learning-gains claim; the pre-registered human cohort study is the endpoint this screen de-risks, not
something reported here. Live-model numbers are single-model effect sizes, labeled as such.

Open **[`index.html`](index.html)** for the one-page talk-through.

---

## What's in this folder

| Path | What |
|---|---|
| `paper/` | The **TMLR submission** — `main.tex` + the official TMLR style (`tmlr.sty`, `tmlr.bst`). Build: `cd paper && tectonic main.tex`. |
| `companion/` | The **plain-language companion** (`paper_simplified.tex`) — the argument end to end without the formalism. |
| `index.html` | A self-contained one-pager hitting the main points (for talking through it). |
| `archive/` | Superseded drafts (e.g. the earlier ICLR framing), kept for provenance. |

**The code is *not* in this folder — by design.** The instrument and experiments are woven into the
`socratic-scenarios` app (the TypeScript runners import the engine; the Python drivers shell out to
`npm`), so they live at the repo root and this README points to them. The map:

- **Instrument** — `src/engine/colreg-sim/` (COLREG regret + leakage) and `src/engine/factqa/` (the
  simulator-free fact-QA twin).
- **Runners** — `scripts/*.ts` (e.g. `factqa-leakage.ts`, `colreg-leakage.ts`), exposed as `npm run`
  targets (`package.json`).
- **GPU experiments** — `experiments/` (`run_a100.sh`, `unlearning/`, the Colab notebooks).
- **Full low-level runbook** — [`experiments/README.md`](../experiments/README.md): every experiment
  with its exact command and expected result.

---

## Reproduce each piece

Three tiers by what they need. **Offline** is deterministic (no key, no GPU) and recovers *known*
ground truth from mock reference learners, so it doubles as the harness self-check — run it first.

| Piece (paper §) | Tier | Command | Result / log |
|---|---|---|---|
| **Whole offline backbone** | offline | `npm run reproduce` | 8/8 checks pass, non-zero exit on drift |
| Instrument construct validity + grading (§3) | offline | `npm run colreg:construct` | hold-course collides (J≈1765), VO 0.70 & SB-MPC 0.01 clear; 20 distinct J |
| KC→single-metric identifiability (§3) | offline | `npm run proc:identifiability` | each ablation hits only its governed metric (max off-diagonal 0.0000) |
| Fact-QA calibration — mocks (§4) | offline | `npm run factqa:leakage` | 3 reference learners recover corpus-bound / redundant / unusable; prints `MEAN-NECESSITY` |
| **Fact-QA calibration — GPU (THE headline, §4)** | GPU | `experiments/colab_headline.ipynb` → *Run all* | `experiments/unlearning/results/dose_factqa_*.csv`; band table in `KEY_RESULTS.md`; figure `paper/figures/factqa_dose.pdf`; per-α transcripts + `*.audit.txt` |
| Knowing≠doing: hazard flat / recall / CoT bridge / decision (§4) | GPU | `cd experiments && ONLY=hazard\|recall\|cot\|decision bash run_a100.sh` | `results/dose_{alpha,cot,single,decision}_*.csv`; narrative in [`provenance/decision-teach-arc.md`](../experiments/provenance/decision-teach-arc.md) |
| Misled diagnosis + live models (§5) | offline / API | `npm run colreg:leakage` (add `PROBES=all`); live: set `BEDROCK_MODEL`/`GEMINI_API_KEY` | mock ground truth; live logs in [`provenance/cross-model/`](../experiments/provenance/cross-model) |
| RAGAS faithfulness comparison (§2) | API | `experiments/ragas-compare/` (`ragas_compare.py`) | RAGAS vs necessity over the identical KB |
| Presence vs retrieval decomposition (appendix) | offline | `experiments/retrieval-decomp/local_decomp.py` | [`retrieval-decomp/RESULTS.md`](../experiments/retrieval-decomp/RESULTS.md) |
| Unlearning: says≠does dissociation (appendix) | GPU | `cd experiments && ONLY=unlearn bash run_a100.sh` | `results/…simnpo…/unlearn-audit.txt` |

**Force offline** (the leakage runners also try a live model if a key is present):
`env -u GEMINI_API_KEY -u OPENAI_API_KEY -u BEDROCK_MODEL npm run factqa:leakage`.

### The headline run, in one paragraph
Open `experiments/colab_headline.ipynb` on an A100, paste `HF_TOKEN`, **Run all**. It teaches a KB of
fictional facts into each model family (LoRA SFT) and sweeps the LoRA-α knowledge gradient, scoring
necessity closed-book. Five families × three seeds; families run one at a time with a band table after
each, and it's parallel-friendly (`GROUP='A'` = the three ungated families on one runtime, `'B'` = the
two gated ones on another, `'ALL'` = one runtime). Merging is just gathering the `dose_factqa_*.csv`
files; `plot_headline.py` then renders the paper figure and `summarize()` the band table.

---

## Results & logs index

- `experiments/unlearning/results/` — `dose_*.csv` (per-gradient-point necessity), `_a<α>.jsonl`
  (transcripts), `_a<α>.audit.txt` (per-fact necessity ranking + verdicts — the interpretable QA),
  `KEY_RESULTS.md` (consolidated band tables).
- `experiments/provenance/` — `decision-teach-arc.md` (the full knowing≠doing / install-by-SFT arc
  with traces), `a100-prereg.md`, `gpu-pending.md`, `cross-model/`, `reason-implement/`, `offline/`.
- `experiments/retrieval-decomp/RESULTS.md`, `experiments/ragas-compare/`.

## Status
- **Calibration: DONE — five families × three seeds on the dense 21-point α grid**, one clean Modal
  run (`run-clean-1`, 2026-08-16, batched generation self-check green): Zephyr 1.00→0.00 (knee ~0.30),
  Llama 0.96→0.00 (~0.35), OLMo 0.95→0.00 (~0.45), Qwen 1.00→0.05 (~0.50), Phi 1.00→0.01 (~0.65).
  Sole gap: one Zephyr seed's final four floor points (n=2 there). Replicates the earlier run at
  shared points (0.47↔0.47, 0.93↔0.93, 0.09↔0.09 at α=0.5). CSVs + per-fact audit logs:
  `experiments/provenance/dose-response/`; figure: `paper/figures/factqa_dose.pdf`.
- **Knowing≠doing:** hazard necessity flat ≈667 across LoRA-α and checkpoints; recall 0.00→0.78; CoT
  bridge 669.5→0.3; direct install falls but is a blanket/shortcut policy (three seeds; one hazard
  seed shows a transient deep-checkpoint turn — reported as instability).
- **Paper:** official TMLR style, double-blind, 12 pp, compiles clean; reproducibility statement in.
