# TeachMe poster — stand-in presenter brief

Notes for presenting the TeachMe multi-domain poster at the open house, written for someone stepping in cold. Read time ~10 minutes. The companion (Necessity-Audit) poster has its own hand-off line at the bottom.

---

## The one-liner (memorize this)

> "TeachMe is a Socratic tutor for safety-critical equipment. It **asks instead of telling**, it can **only quote a reviewed corpus** — so it can't make things up — and we **measure** that grounding instead of promising it."

## The 30-second pitch

Training people on dangerous equipment has a failure mode unique to AI tutors: a confident wrong answer. If a trainee internalizes even one hallucinated safety parameter, they leave *more* dangerous than when they started. TeachMe is built around that: the Narrator (the agent that tells you what the machine did) is architecturally unable to generate from model weights — it can only quote an expert-reviewed knowledge graph. A missing fact yields "I can't find that," never a guess. On top of that sits a Socratic Mentor that opens with probes rather than explanations — retrieval practice beats re-reading — and mastery gates that decide from evidence when to advance versus re-teach. One engine runs three very different domains today, and a companion measurement instrument checks that the tutor actually *uses* its corpus rather than coasting on what the base model already knows.

---

## Poster walkthrough (top to bottom)

**Headline — "Retrieve for the learner, not just the query."**
Ordinary RAG ranks passages by similarity to the question. TeachMe ranks by what *teaches this learner at this moment* — level-appropriate, with safety context co-retrieved. That's the thesis of the whole poster.

**Intro card (the stakes).**
The italic paragraph is the motivation. Say it plainly: one internalized wrong parameter can make training net-negative. That's why the fabrication guarantee is the core design constraint, not a feature.

**Architecture Overview (dark band, 5 boxes).**
One breath: *a typed, expert-reviewed knowledge graph feeds a learner model, retrieval, and a two-agent loop — the Narrator reports machine state corpus-only, the Mentor asks Socratic probes and evaluates answers — surfaced through four instructional modes.*
Important distinction if pressed: the **Narrator** is the corpus-bound one. The **Mentor** evaluates free-text answers with an LLM (Gemini, bring-your-own-key). The no-fabrication guarantee is about the Narrator specifically.

**What's Working Now (4 cards).** For each, lead with the "→ so" line — that's the point of the card:
1. *Corpus-bound Narrator* → a learner can't internalize a hallucinated safety value; a silent corpus shows the gap, never fabricates it.
2. *Typed causal graph* → safety context travels with the diagnosis (Symptom→FailureMode→CorrectiveAction with SafetyHazard co-retrieved), instead of being a separate lookup a flat store can miss.
3. *Dual-axis mastery gates* → an instructor can point at a score and say exactly why the system advanced or held a learner. Concepts must clear before procedures.
4. *Four modes, one progression* → Socratic Practice → Scenario Mode (deterministic fault injection) → Reachback Lookup → Retrieval Lab. Sequenced to keep cognitive load manageable; instructors can inspect what retrieval will surface before a learner sees it.

The teal note next to the heading ("we now measure whether the tutor actually uses its corpus") is the bridge to the companion poster — see the hand-off line below.

**Five-Level Expertise Continuum.**
Who it's for: the system currently targets learners with *some* technical background ("YOU ARE HERE" sits at Intermediate). Complete novices are a deployment choice we haven't made, not a system limit.

**One Engine, Three Domains.** The multi-domain claim, with the punchline "→ so a new domain is an authoring task, not a software project."
- **EDDIE · Aerosol Jet Printing** — the flagship: operator training on the Optomec HD2 printer. 100+ graph nodes, six fault domains.
- **Roadside Tire Change** — deliberately mundane; it exists to prove the engine generalizes from a graph + corpus alone.
- **COLREG Collision Avoidance** — maritime "rules of the road," plus a full interactive simulator: real ship kinematics, a Collision Risk Index, per-rule compliance scoring, reference solvers.

**IF THIS WORKS band.** This is a *bet*, stated as one: faster time-to-independent-operation because training builds far-transfer diagnostic capability, not recall. The TARGET box says out loud that this is **not yet measured on real learners**. Don't soften that; it's the poster's credibility.

**HOW WE KEEP OURSELVES HONEST (dark table).** Our favorite section — we grade our own evidence. Strong claims are architectural (Narrator, gates) or measured (necessity audit); the *weak* row is the human outcome, on purpose. "LEFT OUT ON PURPOSE": there is no free-running text generation — no prompt or jailbreak can make the Narrator invent machine behavior.

**THE QUESTIONS WE'RE CHASING + QR.** Three open research questions (far transfer, gate validity, learning-science ceiling). QR goes to the public repo.

---

## Vocabulary cheat sheet

| Term | Plain meaning |
|---|---|
| **Narrator** | Agent that reports what the machine did — quotes the corpus verbatim, cannot generate |
| **Mentor** | Agent that asks Socratic probes and evaluates free-text answers (LLM-powered) |
| **Knowledge graph** | Expert-reviewed, typed nodes/edges (symptoms, failure modes, corrective actions, hazards) |
| **Mastery gate** | Evidence threshold deciding advance vs. re-teach; concept mastery before procedure |
| **Corpus-bound** | Can only speak from the reviewed corpus; missing fact → "I can't find that" |
| **Corpus necessity** | Whether answers actually *depend* on the corpus (vs. the model already knowing it) — what the companion poster measures |
| **Far transfer** | Performing on *novel* fault combinations, not just rehearsed ones |
| **EDDIE** | The flagship instantiation: Aerosol Jet Printing operator training (Optomec HD2) |
| **COLREG** | International maritime collision-avoidance rules — our third domain, with a simulator |

---

## Likely questions — honest answers

**"Isn't this just RAG with a chatbot?"**
Three differences: (1) pedagogy-first — it opens with a probe, not an answer, because retrieval practice beats re-reading; (2) the Narrator is corpus-*bound*, not corpus-*flavored* — it cannot generate from weights at all; (3) retrieval is ranked for instructional utility (level, safety context, graph structure), not just similarity.

**"Has it actually improved training outcomes?"**
Not measured on humans yet — say this plainly. Everything shown is simulation-based mechanism evidence. The human trial is the pre-registered next step, and the in-silico work exists to falsify the value proposition cheaply *before* that trial.

**"How do you know it doesn't hallucinate?"**
Two layers. By construction: the Narrator can only quote reviewed nodes, so there's nothing to hallucinate *with*. By measurement: the companion instrument checks that answers actually rely on the corpus rather than on what the base model already knows.

**"What does the companion poster add?"**
A measurement instrument for *corpus necessity*: teach the corpus facts directly into a model's weights and watch necessity fall along a calibrated dose–response curve — verified across five different base-model families. It catches corpora that are redundant (model already knows it) or unusable (model can't apply it even when handed it) before you spend a human trial.

**"Can I try it?"**
Yes — live at **experttrace.org**, no API key needed (a deterministic simulated mode runs everything). Add a Gemini key via the gear icon for LLM-powered mentoring. Code is Apache-2.0 at the QR link.

**"How hard is a new domain?"**
Author a typed graph + corpus; the engine supplies probes, scenarios, gates, and mastery tracking. Tire Change and COLREG were both added this way.

**"What about someone using it *at* the machine, not in training?"**
There's a high-stress ops mode that strips the interface to the dashboard plus corpus-bound Reachback lookup — built for an operator under time pressure.

---

## Do not claim (integrity guardrails)

- **No human-subjects results exist.** Never imply learning gains on real people. The far-transfer outcome is explicitly graded *weak* on our own poster.
- **The no-fabrication guarantee is the Narrator's**, not the whole system's. The Mentor's free-text evaluation is LLM-based and can err; gates and instructor inspection are the mitigation.
- **The necessity audit measures the tutor's grounding, not human learning.** Simulation-based mechanism evidence — say those words if pushed.
- **Don't invent numbers.** Everything citable is on the two posters; if asked something not covered, "I don't know, but it's in the repo" is the correct answer — it's also the product's own philosophy.

## Hand-off line to the companion poster

> "Every RAG vendor claims their system is grounded. The poster next to this one is how we *check* — an instrument that measures whether the tutor's answers actually depend on the corpus, calibrated on five different base models. Happy to walk you through it."

## Logistics

- Live demo: **www.experttrace.org** (no key needed) · Repo: **github.com/wrgr/socratic-scenarios** (the QR)
- License: Apache-2.0 · Team: Mia Ndousse-Fetter, William Gray-Roncal, and team
- Status language: **prototype, simulation-validated** (it's on the poster kicker — use those words)
