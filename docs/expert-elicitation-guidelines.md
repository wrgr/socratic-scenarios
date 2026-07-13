<!-- Structured interview guide for capturing Optomec HD2 operator knowledge into TeachMe knowledge graph nodes; covers declarative, procedural, and tacit elicitation techniques with node capture templates. -->

# Expert Elicitation Guidelines
## Capturing AJP Operator Knowledge for the TeachMe Knowledge Graph

**Purpose:** Structured interview guide for turning experienced Optomec HD2 operators into knowledge graph nodes. Targets declarative, procedural, and tacit knowledge — the three types the training system needs to teach.

**Target interviewee:** Anyone who has run the HD2 in production: operators, process engineers, lab managers, repair technicians.

**Output:** Typed knowledge-graph nodes ready to add under `src/corpus/ajp/` — use the existing node schemas (Equipment, Step, Parameter, FailureMode, Symptom, CorrectiveAction, SafetyHazard, TacitKnowledge, SocraticProbe) and cite sources via `SRC-###` / `KB-DOC-##` IDs recorded in `sources/SOURCES_LOG.md`.

---

## Before the Interview

### Prep the expert
- Send a 2-paragraph brief explaining the training system and why you need their knowledge captured in structured form.
- Emphasize: you want their *hard-won* knowledge, not what's in the manual. The manual already exists.
- Ask them to think of 2–3 situations where a new technician would have gotten it wrong and they had to step in.

### Prep yourself
- Read the relevant domain sections of the authored graph (`src/corpus/ajp/`) and any open gaps in `docs/expert-elicitation-log.md` before the session.
- Identify coverage holes in the domain you're covering.
- Have the node schema open: `Node ID · Type · Content · Edges · Source · Provenance · Confidence`

### Session format
- 60–90 minutes per session. Never longer — expert fatigue degrades quality.
- Record with permission. Take structured notes in parallel.
- One domain per session. Don't jump around.
- Start with warm-up questions, move to probing, finish with scenario elicitation.

---

## Session 1: Machine Overview and Startup

**Knowledge type target:** Declarative + sequential procedural

### Warm-up (5 min)
- "Walk me through the first 10 minutes of arriving at the machine for a repair job. Don't skip steps — I want the ones you do on autopilot."
- Capture every discrete action as a potential `Step` node.

### Declarative probes
- "What does the atomizer actually do? How would you explain it to someone who's never seen one?"
- "What's the difference between the ultrasonic atomizer and the pneumatic atomizer — when do you choose one over the other?"
- "What are the things you're checking before you ever touch KEWB? Why each one?"

### Sequential procedure capture
For each startup step the expert names, ask:
1. "What exactly do you do at that step?"
2. "Why does that step have to come before the next one?"
3. "What does success look like — how do you know it's done correctly?"
4. "What goes wrong if you skip it or do it out of order?"

> **Graph capture note:** Answers to (1) → `Step` node `Content`. Answers to (2) → `NEXT_STEP` edge justification. Answers to (3) → `VerificationCheck` node. Answers to (4) → `FailureMode` or `SafetyHazard` node.

### Safety elicitation
- "Walk me through every point in startup where someone could hurt themselves or damage the PCB."
- "Have you ever seen anyone nearly skip a safety step? What almost happened?"
- For each hazard: "What's the consequence? Is it immediate or delayed?"

> **Graph capture note:** Each hazard → `SafetyHazard` node with `REQUIRES →` edges back to the steps that trigger it.

---

## Session 2: Parameters and Process Judgment

**Knowledge type target:** Declarative + procedural/perceptual

### The parameters walk
Go through each major parameter. For each one, ask:

1. **Nominal range:** "What's your typical setting for [sheath gas / atomizer flow / print speed / standoff / chuck temp]?"
2. **Why that value:** "Why that number? What changes if you go higher? Lower?"
3. **Material dependency:** "Does this change when you switch inks? How?"
4. **Environmental dependency:** "Does altitude, temperature, or humidity affect this? By how much?"
5. **The feel of wrong:** "If this parameter drifts out of range, what do you notice first?"

> **Tip:** The answer to (5) is almost always tacit. Slow down here. See tacit elicitation techniques below.

### Decision-point elicitation
- "At what point in a print run do you decide it's going badly enough to abort?"
- "What's the earliest signal you can catch that tells you something's wrong — before you can see it in the deposition quality?"
- "Is there a difference between 'adjust and continue' situations and 'stop and clean' situations? Walk me through your mental model."

> **Graph capture note:** Decision points → inline `DecisionPoint` fields in `Step` nodes. Abort conditions → `FailureMode` nodes with urgency rating.

### Parameter interaction probes
- "Are there parameters that interact with each other in non-obvious ways? What combinations are dangerous?"
- "If you had to pick the three parameters that matter most for a fine-feature repair, what would they be and why?"

---

## Session 3: Fault Diagnosis and Tacit Knowledge

**Knowledge type target:** Tacit + diagnostic/causal

This session is the highest-value and hardest to run well. The goal is to externalize knowledge that experts hold implicitly and rarely articulate.

### Fault walk (critical)
For each fault in the failure taxonomy (clog, pressure issue, atomization quality, deposition defects, sintering failure), ask:

1. **Signal:** "What do you see / hear / feel first — before you've confirmed the diagnosis?"
2. **Confirmation:** "What do you check to confirm it's that fault and not something else?"
3. **Differentiation:** "What other fault looks similar at first? How do you tell them apart?"
4. **Response:** "Walk me through exactly what you do to fix it. Every step."
5. **Recovery time:** "Realistically, how long does this take? What's the worst case?"
6. **Prevention:** "How do you avoid this in the first place?"

> **Graph capture note:** (1) → `Symptom` nodes. (2)+(3) → `INDICATES` edges. (4) → `CorrectiveAction` node. (6) → upstream `Step` node with `CAUSES` edge relationship.

### Tacit knowledge elicitation techniques

Standard questions produce declarative answers. These techniques surface tacit knowledge:

#### The comparison probe
> "Think about a nozzle that's running perfectly versus one that's getting close to clogging. If I were standing next to you, what would you point to first to show me the difference?"

The expert will reach for a physical cue — a number on a screen, a sound, a visual. That's your tacit node.

#### The novice-failure probe
> "Imagine a new technician who has memorized the whole SOP but has never actually run the machine. What would they fail to notice in the first 30 minutes that you'd catch immediately?"

This reliably surfaces the perceptual skills that aren't in any document.

#### The 'wrong but recoverable' probe
> "Give me an example of something you've seen done wrong that you could catch before it caused real damage — what was the early signal?"

#### The narration task
Ask the expert to narrate a print run while you play the role of the system: "Tell me what you'd see at each step as if I'm describing the KEWB display to you in real time." This forces them to make their observation-interpretation loop explicit.

> **Graph capture note:** Each tacit observation → `TacticKnowledge` node. Link with `PROBES →` from the most relevant `Step` or `FailureMode` node.

### The war-story probe (save for end)
> "Tell me about the worst thing you've seen happen on this machine. Not a near-miss — something that actually went wrong. Walk me through it start to finish."

War stories produce:
- High-fidelity fault chains (what caused what)
- The steps that were skipped or misjudged
- Real recovery sequences, not idealized ones
- Edge cases and rare fault combinations not in the SOP

Capture these as extended `FailureMode` narratives with full causal chains.

---

## Capture Template

Use this format immediately after (or during) the session. Fill one card per knowledge unit.

```
NODE DRAFT
──────────────────────────────────────
Node ID:       [assign slug: TYPE-DOMAIN-NNN]
Type:          [Equipment / Step / Parameter / FailureMode / Symptom /
                CorrectiveAction / SafetyHazard / TacitKnowledge /
                VerificationCheck / SocraticProbe / Concept]
Content:       [1–3 sentences. Actionable. What the operator knows.]
Edges:
  → [EDGE_TYPE] [target-node-ID]  (rationale: ...)
  → [EDGE_TYPE] [target-node-ID]  (rationale: ...)
Source:        [interview date + expert role, or doc URL]
Provenance:    PractitionerKnowledge / OfficialDoc / PeerLiterature /
               SafetyRegulation / InferredFromDomain
Confidence:    High / Medium / Low
Gap Flag:      [leave blank, or ⚠️ with description of what's missing]
──────────────────────────────────────
```

---

## Quality Checks Before Adding to Corpus

Before a node enters the knowledge graph, verify:

- [ ] Content is **actionable** — a learner reading it knows what to do or what to look for
- [ ] Content is **specific** — no vague hedges like "it depends" without specifying on what
- [ ] Edges are **directionally correct** — CAUSES goes from cause to effect, INDICATES from observable to meaning
- [ ] Safety hazards are **co-retrieved** — any step involving nanoparticle ink has a REQUIRES → HAZARD-NANOPARTICLE edge
- [ ] Tacit knowledge nodes include the **observable signal** (what you see/hear/feel), not just the interpretation
- [ ] Source is **traceable** — interview date, expert role, or URL. No orphaned claims.

---

## Common Elicitation Mistakes to Avoid

| Mistake | What it produces | Better approach |
|---|---|---|
| Asking "what does the manual say?" | SOP content already in corpus | Ask what the manual doesn't say |
| Accepting "it depends" | Underspecified node | Push: "Depends on what exactly? Give me the cases." |
| Moving too fast past perceptual answers | Tacit knowledge lost | Slow down, ask "what exactly does that look like?" |
| Asking one expert about everything | Single point of failure | Cross-validate fault diagnosis across 2+ experts |
| Treating all confidence equally | Hallucinated corpus nodes | Flag low-confidence nodes explicitly — don't polish them up |
