# TeachMe / EDDIE — How Education Shaped the AI

A short read on the central design claim of this prototype: **the AI paradigm here is downstream of the education paradigm, not the other way around.** Most retrieval-augmented systems start with "what can this LLM do?" and bolt on a use case. We started with "how do operators of safety-critical equipment actually learn?" and let that question constrain every architectural choice.

For the technical README, see [README.md](README.md). For a deeper academic treatment, see [docs/whitepaper.md](docs/whitepaper.md). This document is the bridge between them.

---

## The inversion

Generic chat-based assistants optimize for **semantic relevance** — give a plausible answer to whatever's asked. That objective is wrong for training. A semantically accurate answer can still be instructionally wrong if it lands at the wrong complexity, skips a prerequisite, or short-circuits the practice that would have made the knowledge stick.

So we inverted the design objective:

| Generic RAG assistant | TeachMe / EDDIE |
|---|---|
| Retrieve what's *similar* to the query | Retrieve what's *useful* for the learner's current state |
| Answer the question | Ask a question that exposes the misconception |
| Hide the corpus behind a confident voice | Bind the voice to the corpus — refuse to fabricate |
| Optimize for satisfaction | Optimize for transfer |

Every component below is the consequence of choosing the right column.

---

## How specific learning theories became code

### Vygotsky's Zone of Proximal Development → mastery gates
The highest-yield content for a learner is one step *above* current independent capability — too far, and you induce overload; too close, and you induce stagnation. The system implements this through **mastery-gated progression**: a probe must reach a per-concept score threshold before the curriculum advances. Safety-critical probes have stricter thresholds. The same theory drives the five expertise levels in the Workflow Demo (Complete Novice → Proficient) — each level surfaces a different probe set calibrated to the ZPD for that profile.

### The testing effect & Socratic method → probes, not expositions
Decades of memory research show that **retrieving** a fact from memory strengthens its long-term trace far more than re-reading it does — even when the retrieval attempt fails. So the primary instructional surface is not a tutorial; it's a probe. The Mentor agent never starts by *telling* — it asks. Every learner attempt, right or wrong, is encoded as a retrieval practice event. This is also why the Mentor's follow-ups are deliberately Socratic ("what would the pressure look like if X?") rather than corrective ("the answer is Y").

### Problem-based learning (PBL) → Scenario Mode
PBL trades knowledge-then-application for application-driving-knowledge: drop the learner into an authentic, ill-structured problem and let the need for resolution motivate acquisition. Scenario Mode is exactly this — a running printer simulation with faults injected at pedagogically chosen moments. The learner reasons through diagnosis without a recipe, the Mentor scaffolds rather than rescues. The empirical edge of PBL is in **far transfer** — handling fault combinations the learner hasn't seen — which is the bar for "can this person work the equipment unsupervised."

### Cognitive load theory → mode sequencing
Loading fault diagnosis on top of an unfamiliar startup procedure is gratuitous extraneous load. The four instructional modes are **sequenced**: Socratic Practice (concept by concept) → Scenario Mode (procedural) → Reachback Lookup (diagnostic). Each mode closes germane challenge while keeping extraneous load below threshold for the learner's current state. The Workflow Demo collapses this into a single observable loop so the educational design itself is inspectable.

### Situated learning & cognitive apprenticeship → the Narrator agent
Equipment knowledge is **situated** — a procedure means something different in the context of the machine's observable state than as a paragraph of text. Generic LLMs detach answers from the physical referent. The Narrator agent re-attaches them: it reports machine behavior **verbatim from corpus nodes** and refuses to embellish. When the corpus has nothing to say, the gap becomes visible rather than hallucinated. In safety-critical training, "I don't know, but here is the SOP that covers this state" is more valuable than a confident wrong answer.

### Intelligent tutoring systems → dual-axis learner model
The instructional decisions a tutor makes — when to scaffold, when to challenge, when to gate — depend on a representation of learner state. The system tracks two axes: **declarative** proficiency (concept-level scores from Socratic probes) and **procedural** mastery (scenario performance). Deliberately simpler than full probabilistic knowledge tracing, but transparent and auditable — a reviewer can point at the score and say *that's why the system did that*.

### Transfer of learning → retrieval routing
Transfer is the actual training goal: can the operator handle a novel situation? The retrieval router has dedicated paths for **near transfer** (similar procedure, slightly different state) and **far transfer** (underlying principles applied to a novel fault combination). Probes are tagged for which kind of reasoning they exercise, so the curriculum exposes both.

---

## What this changes about the AI

Several common AI design decisions became unavailable once we took the educational stance seriously:

- **No free-running generation in safety contexts.** The Narrator is corpus-bounded by construction. We can't out-architect this constraint with prompting tricks; if the corpus doesn't cover it, the system says so.
- **No "answer first" pattern.** The Mentor's first move on a probe is never to give the answer. This is a hard rule, enforced in the prompt structure, because anticipating expository answers eliminates the testing effect.
- **No semantic-only retrieval.** Retrieval scores are weighted by instructional utility, not just cosine similarity. A more semantically similar chunk that's pedagogically off-target loses to a less similar chunk that hits the learner's current ZPD.
- **No opaque tutor decisions.** Every gate, every scaffold, every advance is grounded in the dual-axis learner model and is inspectable in the Retrieval Lab tab.

---

## What's in the demo

Primary instructional surfaces, each demonstrating one aspect of the educational stance:

| Tab | Educational principle on display |
|---|---|
| **Socratic Practice** | The probe-first stance — concept-level retrieval practice |
| **Scenario Mode** | PBL in action — situated diagnosis with authentic fault injection |
| **Workflow Demo** | The full Mentor evaluation loop made observable — testing effect + ZPD-calibrated probes |
| **Reachback Lookup** | Situated reachback — corpus-bound answers anchored to observables |
| **Retrieval Lab** | The learner model and retrieval routing exposed for expert review |

Supporting context tabs: **About** (mission / pedagogy / AI rationale), **Architecture** (TeachMe Loop + diagrams), **RAG Coverage** (evidence coverage).

Cognitive load theory also has an operational consequence: the **operator state** toggle. In *high-stress ops* the comprehensive training surfaces are locked outright and only Reachback Lookup (plus the mission brief) stays reachable — the system refuses to teach while the operator is under live-operation load, the same way the Narrator refuses to fabricate.

Open any tab, click a probe, watch the Mentor refuse to just tell you the answer. That refusal is not a quirk of the prompt — it is the design.

---

## Where this matters beyond AJP

The architectural pattern — **typed knowledge graph + corpus-bound narrator + Socratic mentor + mastery-gated progression** — generalizes to any domain where:

1. The knowledge is procedurally structured and partly tacit.
2. Wrong answers have real consequences (safety, compliance, cost).
3. Transfer to novel situations matters more than recall.
4. Training time is constrained and learner state varies widely.

Specialist equipment training is the cleanest exemplar. Clinical procedural training, regulated lab work, and complex industrial maintenance share the same shape.

---

## Reading order for reviewers

1. This document — the educational frame (5 min)
2. [docs/whitepaper.md](docs/whitepaper.md) §3 (Background) — the literature grounding (15 min)
3. [docs/whitepaper.md](docs/whitepaper.md) §4 (System Design) — how the frame became architecture (20 min)
4. The running app via `./start.sh` — the frame as user experience (10 min)

The claim being made is testable: if you remove any one of the educational constraints above, the system gets faster to build but worse at producing operators who can run unsupervised. That's the hypothesis the prototype exists to evaluate.
