# Document 06: Tacit Knowledge Theory — What It Is, How It Works, and Why It Matters Here
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** This document provides the theoretical grounding for the tacit knowledge components of the training system. It is not pedagogical theory for operators — it is reference material for the training system designers, paper authors, and instructional architects. It answers: what are we actually trying to do when we target tacit knowledge in the Socratic and Scenario modes, and what does the literature say about whether and how it can be taught?

**Node type:** TheoryReference  
**Retrieval role:** System design decisions; paper background section; Socratic probe design rationale

---

## SECTION 1: THE FOUNDATIONAL CONCEPT — POLANYI'S TACIT DIMENSION

### 1.1 "We Know More Than We Can Tell"

Michael Polanyi's central claim (1966, *The Tacit Dimension*) is captured in this sentence. The observation was not merely philosophical — Polanyi was a practicing chemist before he became a philosopher of science, and he wrote from direct experience of the gap between what skilled researchers know and what they can articulate.

**The core distinction:**
- **Explicit knowledge:** Can be codified, written, transmitted through text or instruction. "The gas startup sequence is: exhaust, sheath, atomizer."
- **Tacit knowledge:** Embedded in practice; difficult or impossible to fully articulate. "How it feels when the nozzle is correctly seated, versus almost correctly seated."

**The focal/subsidiary distinction:** Polanyi describes tacit knowing as involving awareness at two levels simultaneously. The expert riveter is *focally* aware of the rivet head and whether it is properly seated; they are only *subsidiarily* aware of the hammer in their hand. The subsidiary awareness — the feel of the tool — is tacit. It guides performance but cannot be brought to explicit attention without disrupting the performance. An AJP operator is focally aware of the KEWB pressure graph; they are subsidiarily aware of the sound of the UA and the quality of the plume — the subsidiary signals are the tacit layer.

**Why this matters for training design:** Polanyi argues that tacit knowledge cannot be fully transferred through instruction — it must be acquired through experience. However, he and subsequent researchers (notably Collins) distinguish between tacit knowledge that is *in principle* articulable (just hasn't been articulated yet) and tacit knowledge that is *constitutively* tacit (cannot be articulated without changing its nature). Most AJP operational tacit knowledge falls into the first category — it can be articulated, and articulating it does help novices learn faster.

---

### 1.2 Two Types of Tacit Knowledge Relevant to AJP

**Type 1: Connoisseurship (perceptual expertise)**
The ability to recognize quality, defects, or states that cannot be fully specified in advance. Polanyi's example: the wine taster. The AJP analog: the operator who can look at a plume and classify its quality, or hear the UA and detect an irregularity. This is pattern recognition built over many exposures.

*Can it be taught?* Partially. The perceptual categories can be verbally defined (as in Document 01), and exposure to named categories accelerates the discrimination learning compared to unlabeled experience. But the final step — the rapid, automatic, holistic recognition — requires physical experience with the real signals.

**Type 2: Skill (procedural tacit knowledge)**
The ability to execute a physical procedure with appropriate form and feel. Polanyi's example: riding a bicycle. The AJP analog: the feel of correctly greasing an O-ring; the resistance of a correctly-threading nozzle versus a cross-threading one. This is embodied knowledge.

*Can it be taught?* The verbal description of the *output target* (what correct feels like) accelerates learning by giving the novice a conceptual anchor. The physical skill itself is still acquired through practice. The training system's role is to ensure the novice has the conceptual framework *before* they encounter the physical experience for the first time.

---

## SECTION 2: NONAKA'S SECI MODEL — HOW TACIT KNOWLEDGE MOVES

### 2.1 The SECI Framework

Nonaka and Takeuchi (1995, *The Knowledge-Creating Company*) proposed that organizational knowledge creation involves four modes of knowledge conversion:

| Mode | From → To | Process | AJP Example |
|---|---|---|---|
| **S**ocialization | Tacit → Tacit | Direct experience sharing; apprenticeship | Expert operator works alongside novice; novice absorbs behavioral patterns |
| **E**xternalization | Tacit → Explicit | Articulating tacit into codified form | ExpertTrace elicitation session with AJP operator; this document corpus |
| **C**ombination | Explicit → Explicit | Combining explicit knowledge sources | Knowledge registry + SOP + peer literature = training system corpus |
| **I**nternalization | Explicit → Tacit | Embodied practice of explicit knowledge | Novice uses the training system knowledge to guide practice until it becomes automatic |

**The knowledge spiral:** Nonaka describes knowledge creation as a spiral that moves through these four modes repeatedly, at increasing levels of complexity. The training system is designed to accelerate the internalization phase — compressing the time from explicit rule-following to automatic expert performance.

### 2.2 Where the AJP Training System Fits in SECI

**What the training system does well (Combination + Internalization pathway):**
The knowledge registry, SOP analysis, and peer literature review represent Externalization and Combination. The Socratic mode is designed to support Internalization — converting explicit knowledge (the probe answers) into the learner's own knowledge structure.

**What the training system cannot fully replace (Socialization):**
The Socialization mode — the expert-apprentice relationship in physical co-presence — is the richest but least scalable form of tacit knowledge transfer. The Scenario mode's Narrator agent is an attempt to simulate Socialization's feedback loop in a text-based environment. It is a partial substitute, not a complete one.

**The honest limitation:** The training system explicitly cannot transmit Type 2 (embodied) tacit knowledge. What it can do is ensure that when a trainee first handles the nozzle, they know what they are looking for — which is meaningfully better than handling it with no prior conceptual framework.

---

## SECTION 3: COLLINS'S TAXONOMY — HOW ARTICULABLE IS IT?

### 3.1 Collins's Three Types of Tacit Knowledge

Harry Collins (2010, *Tacit and Explicit Knowledge*) provides a more fine-grained taxonomy that is directly useful for designing training interventions:

**Relational tacit knowledge:** Could in principle be made explicit but hasn't been, for social or institutional reasons. Example: best practices that experienced operators know but haven't written down because there was no mechanism for it.
*Training implication:* Accessible through structured elicitation (ExpertTrace). Once elicited, can be added to the explicit corpus and taught through Socratic or Scenario modes.

**Somatic tacit knowledge:** Knowledge that is constituted in the body's performance — how to balance, how to feel the correct torque, how to hear a difference. Cannot be fully codified because its medium is the body.
*Training implication:* Can be *scaffolded* but not *replaced* by verbal instruction. The goal is to give the trainee the right concepts before physical practice, not to eliminate the need for physical practice.

**Collective tacit knowledge:** Practices and knowledge embedded in a community of practitioners — how AJP operators in general behave and what they treat as shared understanding.
*Training implication:* This is accessed through multiple operators' inputs, not just one expert. The ExpertTrace methodology should sample multiple operators to capture collective tacit knowledge, not just one individual's idiosyncratic practices.

### 3.2 The Articulability Test

For each tacit knowledge element in the AJP corpus, it is worth classifying according to Collins's taxonomy:

| AJP Knowledge Element | Collins Type | Articulable? | Training Mode |
|---|---|---|---|
| Gas startup sequence rationale | Relational | Yes | Socratic (explicitly teachable) |
| Pressure direction interpretation | Relational | Yes | Socratic (explicitly teachable) |
| Abort decision framework | Relational | Mostly | Socratic + Scenario |
| PA jar wall droplet pattern | Relational/Somatic | Mostly | Socratic description + Scenario |
| UA sound signature | Somatic | Partially | Scenario description; requires physical exposure |
| Nozzle threading feel | Somatic | Minimal | Only scaffolding possible; physical practice required |
| O-ring grease feel | Somatic | Minimal | Only scaffolding possible; physical practice required |
| Line quality visual classification | Relational/Somatic | Mostly | Socratic + Scenario (images would help) |
| Expert diagnostic loop | Relational | Fully | Socratic + case analysis |

**Implication:** The Scenario mode's Narrator can describe somatic signals in text ("you hear a slight irregularity in the UA tone") but cannot actually transmit the somatic experience. The training system should be explicit with learners about this distinction — it prepares them for physical experience rather than replacing it.

---

## SECTION 4: TACIT KNOWLEDGE IN PRECISION MANUFACTURING — RELEVANT ANALOGIES

### 4.1 Visual Inspection in Aerospace Manufacturing

Johnson et al. (2019, *Applied Ergonomics*) conducted case studies of tacit knowledge in aerospace component visual inspection — a domain with strong structural parallels to AJP line quality inspection. Their key findings:

- Tacit knowledge was particularly important when inspection standards "lack specification" or "require subjective interpretation" — exactly the condition of AJP line quality assessment, where "acceptable overspray" is not numerically defined
- Task analysis methods (systematic structured interviews with concurrent verbalization) were effective at eliciting this tacit knowledge
- Elicited tacit knowledge was successfully formalized into training materials that improved novice performance

**AJP parallel:** The 5-state canonical line quality reference in Document 01 is exactly this kind of formalized tacit knowledge — an attempt to create explicit categories for what was previously only implicitly known.

### 4.2 Industrial Shop-Floor Anomaly Response

Hoerner et al. (2022, *CSCW*) studied tacit knowledge capture for shop-floor anomaly response in continuous manufacturing — the closest published analog to AJP fault diagnosis. Their method: structured interviews incorporating knowledge management principles + social research methods.

Key findings relevant to the AJP training system:
- Problem-solving knowledge (fault diagnosis tacit knowledge) was successfully captured through structured interview protocols
- The captured knowledge was effectively reusable in a digital assistance system
- Early involvement of shop-floor workers in the development phase improved usability

**AJP implication:** The ExpertTrace elicitation methodology maps directly to Hoerner's approach. Document 02 (fault diagnosis reasoning) represents the type of knowledge their approach targets. The training system is, in their terms, the "digital assistance system" that exploits the externalized knowledge.

### 4.3 The X-Ray Reading Analogy (Polanyi's Canonical Example)

Polanyi describes a medical student learning to read X-rays. Initially, the student sees only light and dark areas — unintelligible. Gradually, through instruction and experience with the expert's commentary, the student begins to perceive structure. Eventually, an expert sees "a lung with a tumor" where the novice initially saw noise.

**The AJP analog:** A novice looking at the KEWB pressure graph sees numbers. An expert sees a "pressure trend that is rising at an abnormal rate indicating a developing clog, with a spike at minute 14 that is consistent with a blob formation event." The same pixels; radically different perceptual content.

**The training implication:** The expert's commentary on the pressure graph — naming what they see, identifying the pattern category — is exactly what the Socratic mode's tacit probes are designed to elicit and teach. The novice needs the conceptual vocabulary first; the perceptual content develops through accumulated experience with that vocabulary in mind.

---

## SECTION 5: WHAT VERBAL ARTICULATION CAN AND CANNOT DO

### 5.1 The Case FOR Verbal Articulation of Tacit Knowledge

Bransford, Brown & Cocking (2000) argue that conceptual scaffolding — verbal framing of what to look for before experience — accelerates expert skill development in domains including perceptual learning. The mechanism:

1. Verbal categories create cognitive hooks for incoming experience
2. Labeled experience is retained more durably than unlabeled experience
3. Transfer to novel cases is improved when the learner has an explicit categorical framework

**For AJP:** A novice who has read Document 01's pressure direction principle ("high pressure = obstruction, not high flow") will correctly interpret their first real KEWB pressure spike. A novice who has not read it may interpret the spike as "more gas flowing" and make the wrong adjustment. The verbal pre-framing converted an ambiguous experience into a diagnostic one.

### 5.2 The Case AGAINST Over-Relying on Verbal Articulation

Polanyi's strong claim is that verbal articulation of tacit knowledge can actually disrupt expert performance. The pianist who begins consciously analyzing finger position stops playing fluidly. This is not a training concern (novices do not yet have the automatic performance to disrupt), but it has one implication:

**The training system should not create dependency on explicit reasoning for ultimately automatic skills.** The Socratic mode teaches explicit rules; the Scenario mode provides practice that automates those rules; the In-Operation mode should be the scaffold for edge cases only, not a crutch for routine decisions.

**The pedagogical arc:** Explicit → Practiced → Automatic. The training system covers the first two stages. The third requires real-world machine experience that the system cannot provide.

---

## Source Provenance

| Concept | Sources |
|---|---|
| Polanyi tacit dimension | Polanyi (1966) *The Tacit Dimension*; Polanyi (1958) *Personal Knowledge* |
| Focal/subsidiary distinction | Polanyi (1966); Wikipedia synthesis; Polanyisociety.org archive |
| Nonaka SECI model | Nonaka & Takeuchi (1995) *The Knowledge-Creating Company* |
| Collins taxonomy (relational/somatic/collective) | Collins (2010) *Tacit and Explicit Knowledge*; Gourlay (2002) OKLC paper |
| Visual inspection tacit knowledge | Johnson et al. (2019) *Applied Ergonomics* 74:1-9 |
| Shop-floor anomaly tacit knowledge | Hoerner et al. (2022) *CSCW* |
| X-ray reading analogy | Polanyi (1966); summarized by Little (2009) UnderstandingSociety blog |
| Verbal articulation and perceptual learning | Bransford, Brown & Cocking (2000) *How People Learn* |
