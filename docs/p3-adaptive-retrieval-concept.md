# P3 concept — Ephemeral graphs for safety-aware adaptive retrieval

A novelty and design spec for the **P3** paper in [`docs/paper-portfolio.md`](paper-portfolio.md):
the adaptive-retrieval *mechanism* paper (IR / ML-methods audience). This is to P3 what
[`docs/novelty-and-positioning.md`](novelty-and-positioning.md) is to the flagship — a place to
attack the idea *before* spending build effort, not a draft.

> **One-line thesis:** in safety-critical training, retrieval is a **scheduling problem over an
> ephemeral, per-learner graph**, not a similarity problem over a static corpus — and the thing
> worth scheduling is often a **probe (a question), not a passage (an answer)**.

> **Framing rule inherited from the portfolio:** P3 is a mechanism paper. It **cites** the
> flagship's instrument (P1) as its evaluation harness and does **not** restate C1/C2 as its own.
> Keep the flagship pure; P3 stands on the mechanism.

---

## 0. Honest-reuse table (state this up front, as the flagship does)

Claiming any of these as the contribution invites a desk-reject on novelty. Foreground them as
the shoulders; sharpen the delta.

| Piece | Prior art that forecloses it |
|---|---|
| Chain-of-verification (draft → verify → revise) | Dhuliawala et al. 2023 (CoVe) |
| Adaptive / difficulty-routed retrieval | Self-RAG 2023; FLARE 2023; Adaptive-RAG (Jeong et al. 2024) |
| Runtime subgraph construction from a corpus | GraphRAG (Microsoft 2024); query-focused subgraph retrieval |
| A per-learner overlay of an expert model | Overlay learner models — Carbonell 1970; Bull & Kay (Open Learner Models) |
| Coverage / diversity-aware retrieval | MMR and descendants |
| Expert-validated scenario banks; novice/expert separation | Standard eval methodology; construct validity (this is P1's rigor apparatus, not P3's novelty) |

**Implication:** the contribution is **not** "we do CoVe / adaptive-RAG / graphs for tutoring."
It is the *object* those techniques operate on and the *way its novelty is measured*.

---

## 1. The core object — the ephemeral graph

The corpus is a **persistent, expert-authored typed safety graph**: `FailureMode` (×43),
`SafetyHazard` (×5), `CorrectiveAction`, `Parameter`, `Consequence` nodes, joined by typed edges
`CAUSES`, `INDICATES`, `REQUIRES`, and **`PROBES` (×84)**. That graph does not change per learner.

The **ephemeral graph** is a *derived, disposable view* of that corpus, constructed for one
learner (or one cohort) at one moment, from live signals, and discarded after use. It is the
**runtime substrate the retrieval scheduler operates on** — not a belief store.

### Construction rule (same rule at both granularities)

For each corpus node `n`, compute three weights from current signals:

1. **mastery(n, learner)** — from the existing learner agent (BKT/Elo,
   `src/engine/learner-agent/`). Low mastery ⇒ higher retrieval priority.
2. **coverage-debt(n)** — `n` is `REQUIRES`-linked to an active knowledge component but has
   never been retrieved (from the retrieval logs `RagCoverageView` already computes via
   `computeUnusedChunks`). High debt ⇒ higher priority *and* a curation flag.
3. **hazard-proximity(n)** — graph distance from `n` to the nearest `SafetyHazard`/`FailureMode`
   node along `CAUSES`/`INDICATES` edges. Closer ⇒ higher priority.

The ephemeral graph keeps/reweights edges by a function of these three. **Individual** graph:
signals from one learner. **Cohort** graph: the *merge* of individual ephemeral graphs at a
moment (union of nodes, aggregated weights). Same construction rule; different input population.

### What persists (the fork you cannot hand-wave)

| Option | Privacy | Cold-start | "Ephemeral" is load-bearing? |
|---|---|---|---|
| **Fully ephemeral** — persist nothing, rebuild from scratch each session | maximal | worst | yes, but claim is expensive |
| **Parameter-persisted** — persist a minimal competence vector; graph is a regenerated view | strong | good | **only if the graph-view enables something the vector can't** |

**Recommended position:** parameter-persisted. The *structure* is ephemeral, a tiny competence
vector survives, and the **contribution is that the graph-as-derived-view enables hazard-weighted
scheduling and cohort composition that the raw vector cannot.** This keeps "ephemeral" doing real
work without overclaiming that no learner state is ever stored.

---

## 2. What the ephemeral graph absorbs

P3's earlier brainstorm produced three mechanisms that are all just *operations on this one
object* — which is the argument that P3 is a mechanism, not a feature bag:

- **Hazard-triggered probe injection (N1).** When the learner's trajectory approaches a
  `FailureMode`/`SafetyHazard` node, the scheduler enqueues a `PROBES` edge — a **question**,
  not a passage. This inverts RAG twice: retrieval is **triggered by graph state, not a query**,
  and returns a **probe, not an answer**. Delta vs the adaptive-RAG line, which triggers on query
  difficulty and returns passages.
- **Priority inversion in retrieval (N2).** Under a fixed context budget, a hazard-relevant node
  can be **starved** by many mildly-relevant high-similarity nodes — a *priority inversion*
  (borrowed from real-time scheduling). Framing retrieval as **admission control with a criticality
  deadline** makes this a *measurable* failure mode of similarity-only RAG, not a vibe.
- **Coverage-debt as a closed-loop control signal (N3).** Promote `RagCoverageView`'s dead-chunk
  statistics from a **dashboard** to a **controller**: high-debt nodes raise their own priority
  *and* flag the corpus for curation.

---

## 3. The verifier-leakage audit (the genuinely new bit)

Layer chain-of-verification on top, but with two deltas that clear CoVe:

1. **Verification questions are the graph's `PROBES` edges, not model-generated.** CoVe's known
   failure mode is that self-generated verification questions **inherit the model's blind spots**.
   Expert-authored, hazard-weighted `PROBES` do not.
2. **Audit the verifier itself for leakage.** If the model "verifies" from parametric priors
   instead of the corpus probe, that is leakage — and P1's machinery (`leakage.ts`, ablation-δ)
   **already detects it**. No CoVe-family method can tell whether its own verification step is
   grounded or hallucinated. This is the crispest unclaimed ground in P3.

> **Fork to decide:** the verifier-leakage audit is close enough to the flagship's C1 that it may
> belong as a *section of P1* rather than a thinner standalone P3. Decide before drafting P1's C1
> section — folding it in may strengthen the flagship more than a separate paper does.

---

## 4. Differentiation — the two collapses to prevent

The paper survives only if a reviewer **cannot** compress it to either of these:

**vs. the overlay learner model (Bull & Kay; Carbonell).** The overlay model *persists and grows*
a per-learner belief store. The ephemeral graph is **disposable by construction** (privacy for an
*employee* learner — no permanent competence dossier on a technician), is a **retrieval-scheduling
substrate** rather than a belief report, and **composes upward** into a cohort graph with the same
rule. Overlay models do none of these three.

**vs. GraphRAG / query-focused subgraph retrieval.** GraphRAG builds a subgraph from the *corpus*
or the *query*. The ephemeral graph is built from *learner/cohort state* — mastery, coverage-debt,
hazard-proximity — none of which are query terms. Per-**state** construction, not per-**query**.

Lead with the triad — **per-state construction + disposable-for-privacy + individual↔cohort
composition** — or the paper gets filed under overlay models.

---

## 5. Evaluation — P3 is provable because P1 exists

P3's evaluation harness is the flagship instrument: score the learner produced under each
retrieval policy on `src/engine/procedure-sim/` compliance penalty and safety-violations-caught.
This is the differentiation paragraph on its own: **an adaptive-retrieval method evaluated on an
objective control-task outcome, not answer-text F1.**

### 5.1 Utility ablation (decides whether there is a paper)

| Retrieval policy | Question it answers |
|---|---|
| Similarity-only (baseline RAG) | baseline violation rate |
| **Vanilla CoVe** (self-generated verification questions) | does *generic* verification already capture the gain? |
| Static expert graph, hazard-weighted | does the graph help without ephemerality? |
| **Ephemeral graph (per-state, this paper)** | does per-state construction beat the static graph? |

**Make-or-break:** the ephemeral/graph-grounded policy must beat **vanilla CoVe** on
safety-violations-caught. If it does not, the utility is subsumed by an existing method — know
that before writing. Vanilla CoVe is included precisely so the delta can be claimed head-on.

### 5.2 Which claim are you making? (pick before building)

| Claim | Test | If it fails |
|---|---|---|
| **Performance** — ephemeral routing beats static-graph routing on the instrument | ablation §5.1 | no performance paper |
| **Privacy/freshness** — ephemeral matches a persistent-updated learner model on outcomes, with no long-lived profile | outcome-parity + "no persisted PII" argument | still a paper: "throw the learner model away each session, lose nothing" — a strong claim in an employer setting |

The trap is *implying* performance while only holding privacy. Name the claim explicitly.

### 5.3 The cohort-debt ↔ gap-localizer agreement test (the validation showpiece)

Regions of high **shared coverage-debt** in the cohort ephemeral graph should predict where
novices fail on the instrument — i.e., the flagship's failure-based gap localizer (`diagnose.ts`)
and the retrieval-starvation-based cohort-debt signal should **point at the same corpus nodes**,
from two independent directions. Agreement validates both; disagreement localizes either a latent
leak or a dead corpus region. This is a validation *design*, not a feature — and it is the single
most convincing figure P3 can produce.

---

## 6. Contribution stack (what to actually claim)

- **P3-C1 — the ephemeral per-state graph as a retrieval-scheduling substrate.** Per-state (not
  per-query) construction; disposable-for-privacy; individual↔cohort composition. The headline.
- **P3-C2 — safety-aware scheduling on it:** hazard-triggered probe injection + priority-inversion
  admission control. The mechanism that produces the measured utility.
- **P3-C3 — verifier-leakage-audited chain-of-verification** (or fold into P1 — see §3 fork).
- **Evaluated** on the flagship control-task instrument, cross-validated by the cohort-debt ↔
  `diagnose.ts` agreement test.

**Do not** lead with "we do chain-of-verification," "we built a graph," or "adaptive RAG for
tutoring." Those are the shoulders (§0).

---

## 7. Build gaps before this is a paper

Nothing here ships without these — listed so the cost is explicit:

- [ ] **Ephemeral-graph constructor** — the §1 construction rule over the existing corpus graph +
      learner-agent estimates + `computeUnusedChunks` logs. None of the inputs are new; the
      *constructor and the scheduler over it* are.
- [ ] **Retrieval policies as swappable arms** — similarity-only, vanilla CoVe, static-graph,
      ephemeral — behind one interface so §5.1 is a clean ablation.
- [ ] **Instrument wiring** — feed each policy's learner into `procedure-sim` scoring (the scoring
      side already exists; the wiring is the work).
- [ ] **Cohort merge + agreement harness** — merge individual graphs, compare high-debt regions to
      `diagnose.ts` output (§5.3).
- [ ] **Prior-art scan** — targeted sweep on "safety-critical RAG," "proactive/anticipatory
      retrieval," "curriculum-aware retrieval," and "ephemeral/streaming subgraph retrieval" before
      committing (the space moves fast; the portfolio's re-scan discipline applies).

---

## 8. Open decisions for the author

- **§3 fork:** verifier-leakage audit as standalone P3-C3, or a section of the flagship P1?
- **§1 fork:** fully ephemeral vs parameter-persisted (recommended: parameter-persisted).
- **§5.2 fork:** performance claim vs privacy/freshness claim — they need different experiments.
- **Scope:** is P3 one paper (ephemeral graph + scheduling + verification) or does the verification
  half leave for P1, making P3 purely "the ephemeral graph as a safety-aware scheduling substrate"?
