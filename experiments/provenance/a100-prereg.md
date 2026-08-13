# A100 run — pre-registration of expected results

Written **before** the run so the strong/weak/null criteria are on record and cannot be moved after
seeing the numbers. Three stages (`experiments/run_a100.sh` / `experiments/colab_gpu.ipynb`):
fact-QA dose-response (CS3.2, headline), hazard dose-response (CS1.7), unlearning says≠does (CS4.3).

## Gate — check this FIRST, before any curve
On every dose-response the **untaught baseline (α=0) necessity must be HIGH**: ≈1.0 for fact-QA,
≈667 for the hazard. If the untaught model already clears (low necessity at α=0), the fictional/novel
premise leaked and nothing downstream is interpretable. Stop and re-screen the facts.

## 1. Fact-QA dose-response — headline (CS3.2)
Teach fictional facts into the weights; necessity (measured closed-book) should fall as they are
internalized. Many independent facts ⇒ the aggregate should be graded/smooth.

- **Strong:** smooth monotone 1.00→~0.03; α-sweep and checkpoint-sweep **agree**; ≥3 seeds, tight
  bands. ⇒ the calibrated-necessity claim holds cleanly.
- **Weak:** monotone but steppy interior, or endpoint stops ~0.2 not ~0.03, or seeds agree on
  endpoints but scatter in the middle. ⇒ known-groups *endpoints* hold; the "graded" distinction
  weakens.
- **Null / dealbreaker:** necessity does not fall (α=0 ≈ α=1), OR α and checkpoint disagree (one
  falls, one flat). ⇒ the measure isn't tracking weight-knowledge, or it's a gradient-method artifact.
- **Expect:** clean endpoints (1.00→low), monotone. Pre-fix single run was 1.00→0.93→0.29→0.03.
  **Watch:** the `--chat` fix makes the model learn in the queried format, so it may learn the facts
  nearly all at once → a **steppier** curve. If fact-QA goes steppy it stops being "the graded domain"
  and collapses toward the hazard's story.

## 2. Hazard dose-response — second domain, large-effect endpoints (CS1.7)
Teach one hidden charted hazard; necessity should collapse from a full-barrier swing to ~0.

- **Strong:** clean **step** 667→~0.2; α and checkpoint agree on WHERE the transition is; stable
  across seeds. (A step, not a smooth curve, is the CORRECT signature for one discrete fact — not a
  weakness.)
- **Weak:** endpoint stops high (667→50, taught model doesn't fully clear), or the transition point
  scatters wildly across seeds.
- **Null / dealbreaker:** necessity stays ~667 even fully taught (fact never learned), OR α=0 already
  clears (hazard wasn't novel).
- **Expect:** clean step 667→0.2. The `--chat` fix makes clean learning MORE likely and may shift the
  step earlier in the checkpoint sweep — fine as long as α and checkpoint still agree.

## 3. Unlearning says≠does — appendix, supporting (CS4.3)
Gently remove "alter to starboard"; words-level metrics should show forgetting while the scored
decision does not move.

- **Strong:** words-level metrics move (probe 0.43→0.27, forget NLL 7.4→32.4, Rule-14 citation
  vanishes), **decision unchanged** (still +30° starboard, ablation-δ 0.000), relearn recovers
  (32.4→9.2), retain utility intact. ⇒ clean says≠does.
- **Weak:** words-level metrics move less, or the decision drifts a little (model-damage creeps up),
  or retain utility degrades.
- **Null:** nothing moves (unlearning failed), OR the decision flips to port (recipe wasn't gentle →
  confident non-compliance, a *different* result).
- **Expect:** the dissociation holds. Load-bearing quantity = **model-damage staying flat** (that is
  what makes it "gentle"); seed variance is the main risk.

## Overall go / no-go
- **Go (headline stands):** both dose-responses show untaught-high → taught-low endpoints, monotone,
  α/checkpoint agree, endpoints stable across ≥3 seeds. Even if the fact-QA interior isn't perfectly
  smooth, the known-groups calibration — the paper's core claim — is confirmed.
- **Dealbreaker to watch:** endpoints do not separate (necessity doesn't fall when taught). Fatal to
  the calibrated-necessity thesis, unlike the noise-level worries.
- **Subtle risk:** fact-QA loses its graded character (goes steppy). Not fatal; costs the "two
  domains, one graded curve" framing → reframe to "two known-groups calibrations, both step-like."

## Caveats
- Recorded numbers are **pre-`--chat`-fix single runs** — priors, not predictions; the fix may shift
  transition points.
- **One model size per domain.** If 3B/7B endpoints are clean, the natural next ask is a second size,
  not more seeds.
