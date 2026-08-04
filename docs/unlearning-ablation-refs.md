# Unlearning & knowledge-ablation — reference pack for novelty exploration

A curated, annotated set of papers on **LLM machine unlearning** and **knowledge
ablation / restrained-knowledge to simulate learners**, plus the **verification**
literature (is the knowledge actually gone, or just suppressed?). Assembled to be
pasted into a prompt for exploring the novelty of this project's idea.

> Companion docs: `docs/novelty-and-positioning.md` (the project's candidate
> contributions + the broader prior-art scan) and `docs/learner-agent-design.md`
> (the learner-agent design). This file zooms in on the **ablation/unlearning** axis.

Verification notes: arXiv IDs were confirmed via search; entries marked **[verify]**
have an author list, venue, or exact ID I could not fully cross-check — confirm
before formal citation. Several 2026 entries are recent preprints; re-check at
submission time.

---

## How to use this file (prompt scaffold)

Copy the block below, paste this file's reference list under it, and run it against a
strong model to pressure-test novelty:

```
You are a skeptical program-committee reviewer. Below is a research idea and a
reference list. Decide what in the idea is genuinely novel vs. already covered, and
name the single closest paper to each claimed contribution.

IDEA. An in-silico method for pre-validating corpus-bounded instruction, with two
core claims:
  C1. One objective task instrument (a control-task simulator scored as regret-vs-
      optimal + per-rule compliance) is used BIDIRECTIONALLY on a corpus-bound
      learner: (i) to LOCALIZE which corpus rule is missing from measured task
      failures, and (ii) to DETECT parametric leakage — if ablating a rule from the
      corpus does NOT degrade the governed metric, the model is using pretrained
      priors, not the corpus.
  C2. Proxy learners at CONTROLLED COMPETENCE — both a parametric competence-vector
      learner and a knowledge-ablated/unlearned LLM — exercise the instrument, as a
      pre-human-trial screen.

For each claim: is it novel? What is the closest prior work below, and what exactly
does that work NOT do that leaves (or closes) the gap? Be concrete and cite by ID.
```

The project's own leakage test currently ablates knowledge from the **RAG corpus**
(context), not the **weights** — the unlearning literature below is the alternative
(and stronger) way to remove knowledge, and the verification literature is why
"we removed it" needs proof either way.

---

## Group A — Unlearning methods (removing knowledge from weights)

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| A1 | Jang et al., *Knowledge Unlearning for Mitigating Privacy Risks in LMs* (ACL 2023) | arXiv:2210.01504 | Origin of the **gradient-ascent** unlearning baseline — the simplest knob to make a "never-saw-it" proxy learner. |
| A2 | Ilharco et al., *Editing Models with Task Arithmetic* (ICLR 2023) | arXiv:2212.04089 | **Task-vector negation** removes a capability without retraining; the λ scale gives *graded* competence — ideal for a controlled-competence proxy. |
| A3 | Eldan & Russinovich, *Who's Harry Potter? Approximate Unlearning in LLMs* (2023, preprint) | arXiv:2310.02238 | Canonical demo of erasing a specific known corpus while keeping general ability — exactly the "rely on corpus, not memory" setup. |
| A4 | N. Li et al., *The WMDP Benchmark* — introduces **RMU** (ICML 2024) | arXiv:2403.03218 | RMU (representation misdirection) is the current standard **representation-level** ablation; a strong lever for competence removal. (RMU has no separate paper.) |
| A5 | R. Zhang et al., *Negative Preference Optimization (NPO)* (2024, preprint) | arXiv:2404.05868 | Stable aggressive forgetting without gradient-ascent collapse — the go-to when you need deep ablation but a still-functional proxy. |
| A6 | Meng et al., *Locating and Editing Factual Associations in GPT (ROME)* (NeurIPS 2022) | arXiv:2202.05262 **[verify id]** | Surgical single-fact removal/rewrite — for ablating one specific memorized fact or installing one misconception. |
| A7 | Meng et al., *Mass-Editing Memory in a Transformer (MEMIT)* (ICLR 2023) | arXiv:2210.07229 **[verify id]** | Scales ROME to thousands of edits — excise a whole competence region in one pass to define a target knowledge state. |

## Group B — Benchmarks & evaluation (is the knowledge gone?)

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| B1 | Maini et al., *TOFU: A Task of Fictitious Unlearning* (COLM 2024) | arXiv:2401.06121 | **Fictitious** author facts ⇒ provably absent from pretraining, so "no-context accuracy ⇒ leakage" reasoning is clean. The template for proving corpus-reliance. |
| B2 | Shi et al., *MUSE: Six-Way Unlearning Evaluation* (2024, preprint) | arXiv:2407.06460 | Separates **verbatim recall gone** from **knowledge gone** — the exact suppressed-vs-removed distinction your leakage claim rests on. |
| B3 | Jin et al., *RWKU: Real-World Knowledge Unlearning* (NeurIPS 2024 D&B) | arXiv:2406.10890 | 200 real targets, 13k probes incl. adversarial/jailbreak + membership-inference — the gold-standard "is it really gone" audit. |
| B4 | Tian et al., *To Forget or Not (KnowUnDo)* (EMNLP 2024 Findings) | arXiv:2407.01920 | Unlearn-scope vs retention-scope; shows methods over-forget — critical for ablating one competence while keeping the proxy usable elsewhere. |

## Group C — Critiques, robustness & surveys (why "removed" needs proof)

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| C1 | S. Liu et al., *Rethinking Machine Unlearning for LLMs* (position; later Nat. Mach. Intell.) | arXiv:2402.08787 | Best single orientation to objectives/methods/metrics — use to justify your ablation + eval choices. |
| C2 | Lynch et al., *Eight Methods to Evaluate Robust Unlearning* (2024, preprint) | arXiv:2402.16835 | A ready-made 8-test recovery checklist (jailbreak, relearn, latent probes…) to confirm removal isn't surface suppression. |
| C3 | Hu et al., *Jogging the Memory… via Benign Relearning* (2024, preprint) | arXiv:2406.13356 | Small unrelated fine-tuning reverses "unlearning" — your forgotten proxy may snap back; test relearning resistance. |
| C4 | Łucki et al., *An Adversarial Perspective on Unlearning for AI Safety* (ICLR 2025 **[verify]**) | arXiv:2409.18025 | Fine-tuning on ~10 examples / removing activation directions recovers RMU-unlearned capability — representation ablation can leave knowledge latent. |
| C5 | Deeb & Roger, *Do Unlearning Methods Remove Information from LM Weights?* (2024, preprint) | arXiv:2410.08827 | Most on-point for your leakage claim: operationalizes "gone from weights vs merely gated." |
| C6 | *Unlearning Isn't Deletion: Reversibility of Machine Unlearning* (2025, preprint **[verify authors]**) | arXiv:2505.16831 | Vocabulary (reversible/irreversible, catastrophic/non-) to characterize what state your ablated proxy is actually in. |
| C7 | Zhang et al., *Verification of Machine Unlearning is Fragile* (2024, preprint) | arXiv:2408.00929 | Verification schemes can be gamed — passing one probe ≠ removal; motivates multiple independent audits. |

## Group D — Ablation / restrained knowledge to build controlled-competence *learners*

*(the most directly on-target group for this project)*

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| D1 | Song, Guo & Lin, *Simulating Novice Students Using Machine Unlearning and Relearning in LLMs* (AIED 2026) | arXiv:2603.26142 | **Closest prior work**: parametric ablation (not prompting) fixes a novice state, then measures relearning. Differs from this project: scored on **dialogue behavior**, not an objective task instrument, and not a pre-trial validation of an instructional method. |
| D2 | Jin et al., *TeachYou / AlgoBo* — teachable-agent LLM tutee (CHI 2024) | arXiv:2309.14534 | The **restrained-knowledge-prompting** pole (vs unlearning); shows prompting struggles to *hold* a low-competence state. **Correction:** the real TeachYou paper — not arXiv:2406.19226 (that's *SimClass*, Zhang et al. 2024). |
| D3 | Apartsin et al., *Toward a Benchmark for Controllable Simulation of Imperfect Students* (2026) | arXiv:2605.25601 | Quantifies how well **prompting** can retain some skills while suppressing others (model-dependent) — evidence for preferring ablation over prompting. |
| D4 | Liu et al., *PS²: Parameterized Control for Fine-Grained Student Proficiency Simulation* (2026) | arXiv:2602.00850 **[verify]** | Interpolates between strong and weak (error-prone) models — a **competence-vector / parametric** control mechanism, addressing prompt-sensitivity head-on. |
| D5 | Wu et al., *Embracing Imperfection: Simulating Students with Diverse Cognitive Levels* (ACL 2025) | arXiv:2505.19997 | Training-free knowledge-graph "cognitive prototype" — a non-ablation contrast for controlled competence. |
| D6 | Liu et al., *The Imperfect Learner: Developmental Trajectories in Memory-based Student Simulation* (2025) | arXiv:2511.05903 **[verify]** | Memory/state approach to the "LLMs are too capable to be novices" problem — design-space contrast to ablation. |

## Group E — Validity of simulated students (are proxies faithful to real novices?)

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| E1 | Srivatsa, Maurya & Kochmar, *Can LLMs Reliably Simulate Real Students' Abilities?* (BEA 2025) | arXiv:2507.08232 | On an IRT scale, no model-prompt pair matches average grade-level students — empirical failure of prompt-only proxies; motivates ablation. |
| E2 | Yuan et al. (incl. T. Mitchell), *Towards Valid Student Simulation with LLMs* (2026) | arXiv:2601.05473 | Names the "competence paradox"; formalizes an **Epistemic State Specification** — the best scaffold for specifying/validating a knowledge state. |
| E3 | Marquez-Carpintero et al., *Simulating Students with LLMs: A Review* (2025) | arXiv:2511.06078 **[verify]** | Landscape/positioning citation for where ablation-based approaches sit. |
| E4 | *LLMs Struggle to Measure … Item Discrimination in Reading Comprehension* (2026 **[verify authors]**) | arXiv:2606.18709 | Simulated students fail to reproduce the psychometric structure that separates real proficiency levels — a sharp faithfulness critique. |

## Group F — Corpus-reliance vs parametric memory (the leakage half)

| # | Paper | ID | Why it matters here |
|---|---|---|---|
| F1 | Xu et al., *Knowledge Conflicts for LLMs: A Survey* (EMNLP 2024) | arXiv:2403.08319 | Taxonomy of context-vs-memory conflict — the conceptual backbone for counterfactual-context / context-faithfulness leakage tests. |
| F2 | Ravaut et al., *Contamination Detection Methods in LLMs: A Survey* (2024 **[verify authors]**) | arXiv:2404.00699 | The "no-context accuracy ⇒ leakage" toolkit for auditing residual parametric access. |
| F3 | *SeedRG: Leakage-Free Benchmarks for Robust RAG Evaluation* (2026) | arXiv:2605.08838 | No-context filtering to strip parametrically-answerable items — closest precedent to the *leakage* half of C1 (but benchmark-cleaning, no localization). Cross-ref: novelty memo. |
| F4 | *Quantifying Prior Dominance in RAG Systems* (2026) | arXiv:2606.23695 | Ablate context → measure degradation to quantify prior reliance — closest to C1's ablation logic (but aggregate, not per-rule on a task metric). |

---

## Reading path for the novelty question

- **If the claim is "we ablate knowledge to make a controlled-competence learner":**
  D1 is the one to beat (parametric unlearning → novice), with D3/D4 on the prompting-
  vs-parametric axis and E1/E2 on why controlled competence is hard. Method choice:
  A1/A2/A4/A5 (and A6/A7 for surgical edits).
- **If the claim is "one instrument detects corpus-reliance vs leakage":** F3/F4 are the
  closest, plus B1/B2/C5 for the suppressed-vs-removed distinction and C2/C3/C4/C7 for
  why the removal must be independently audited.
- **The strongest differentiator** (per `docs/novelty-and-positioning.md`) remains the
  *bidirectional, single-instrument* use — localize a gap AND detect leakage on the
  same objective control-task metric — which none of the above do together.
