# Document 07: Expert Operator Knowledge Elicitation Template
## For AJP HD2 Operators — ExpertTrace-Style Structured Interview Guide
## Tacit Knowledge Corpus · HD2 AJP Training System

**Purpose:** A structured elicitation guide for capturing tacit knowledge from experienced AJP HD2 operators. This document is used by the knowledge engineer (the interviewer) during ExpertTrace sessions. It is organized by knowledge domain, follows cognitive task analysis principles, and is designed to surface both relational tacit knowledge (articulable but not yet articulated) and somatic knowledge (partially articulable).

**Interview format:** 60-90 minute semi-structured session. Video capture recommended (for ExpertTrace pipeline ingestion). Think-aloud protocol encouraged. Follow-up session for verification and gap filling.

**Target participant:** Operator with ≥ 6 months of HD2 experience; has completed ≥ 10 independent print sessions; has encountered and resolved at least 3 distinct fault types.

---

## PART A: FRAMING AND WARM-UP (10 minutes)

### Opening Statement to Expert:
"We're trying to capture what you know about running the HD2 that isn't in the standard operating procedures. Not the steps — we have the steps. What we want is what you've learned from experience that makes the difference between a print session that goes well and one that doesn't. There are no right or wrong answers — you know more about running this machine than we do. We're here to learn from you."

### Warm-Up Questions:

**W1.** "How long have you been running the HD2? About how many sessions have you done?"

**W2.** "What materials / ink systems do you use most often?"

**W3.** "What was the hardest thing to learn about this machine — what took the longest to figure out?"
*[Probe: "What specifically made it hard?"]  
[Note: First hard thing often points to the highest-value tacit knowledge domain]*

**W4.** "Can you think of a time when a print went particularly well? What made it go well?"
*[Probe: "What were you doing differently, or what conditions were different?"]  
[Note: Success cases are often more revealing than failure cases for tacit practices]*

---

## PART B: STARTUP AND SETUP KNOWLEDGE (15 minutes)

### B1. Pre-print Ritual
"Walk me through what you do before you start a print session. Start from when you walk into the lab."
*[Let them narrate without interruption. Note any steps not in the SOP. Note any steps skipped from the SOP.]*

**Follow-up probes:**
- "You mentioned [X]. Why do you do that?"
- "Is there anything you check that isn't in the written procedure?"
- "Is there anything in the written procedure you've found doesn't matter in practice?"

### B2. Ink Inspection
"How do you know if ink is good to use? What are you looking for?"
*[Target: Visual inspection cues, age/storage limits, behavior indicators]*
- "Has ink ever looked fine but performed badly? What happened?"
- "How do you know when an ink batch is not worth using?"

### B3. Gas Setup
"When you're setting up the gas system, what are you paying attention to that you wouldn't necessarily notice if you weren't experienced?"
*[Target: Pressure ranges, the 'feel' of correct setup, early warning signs]*
- "What's the most common setup mistake you see other people make?"
- "What do you check in KEWB before you start printing?"

### B4. Standoff and Z-Height
"How do you set your standoff? Walk me through it."
*[Target: The slide-stack method, verification process, the parallax issue]*
- "How do you verify it's right after you've set it?"
- "What happens when the standoff is wrong? Have you seen it set incorrectly? What did the print look like?"

---

## PART C: IN-OPERATION MONITORING (20 minutes)

### C1. What You Watch
"During a print, what are you monitoring? If I'm watching you print, what are you looking at?"
*[Let them enumerate. Note: KEWB pressure, plume, jar walls, line quality, UA sound — probe for each if not mentioned]*

For each monitoring signal mentioned:
- "What does 'normal' look like for [signal]?"
- "What's the first sign that something is off with [signal]?"
- "What's the worst-case version of that problem?"

### C2. The Pressure Read
"Tell me about how you read the KEWB pressure display. Are you looking at the number, or something else?"
*[Target: Trend vs. point value; the critical novice error of reading single-point vs. watching trend]*
- "What's the difference between a pressure reading that means you're fine versus one that means you need to act?"
- "How quickly do you need to act when pressure starts rising?"

### C3. Line Quality During Print
"While you're printing, how are you evaluating the line quality in real time?"
*[Target: Process camera vs. direct visual; what 'good' looks like; first signs of degradation]*
- "Describe what a good line looks like in real time."
- "What's the first sign that line quality is degrading?"
- "What do you do when you see that?"

### C4. The Abort Decision
"Tell me about times when you've decided to stop a print mid-run. What was happening?"
*[Target: The abort decision criteria; the risk calculus; the single-change rule]*
- "How do you decide when to stop versus when to keep going and adjust?"
- "Has there been a time you kept going and wish you hadn't? What happened?"
- "Has there been a time you stopped and it turned out you didn't need to? How did you feel about that?"

### C5. The One-Change Rule
"When something goes wrong during a print, what's your process for figuring out what to adjust?"
*[Target: Systematic vs. random adjustment; single-change rule; verification loop]*
- "Have you seen other operators make the situation worse by how they adjusted? What happened?"

---

## PART D: FAULT RECOGNITION AND DIAGNOSIS (15 minutes)

### D1. Fault Catalog — Expert's Version
"What are the faults you've actually encountered on this machine? Walk me through them."
*[For each fault mentioned, capture:]*
- "What were the first signs you noticed?"
- "What did you initially think it was? Were you wrong?"
- "How did you figure out what it actually was?"
- "What did you do to fix it?"
- "How did you verify the fix worked?"

### D2. Hardest Diagnosis
"What's the hardest diagnostic problem you've encountered on this machine — something that took a long time to figure out or that you got wrong at first?"
*[Target: Complex fault discrimination cases; diagnostic errors and what led to them]*
- "What would you tell someone to look for if they encounter that problem?"

### D3. Faults That Look Like Other Faults
"Are there any faults that tend to get misdiagnosed — cases where operators think it's one thing but it's actually another?"
*[Target: The discrimination heuristics that separate similar-looking faults]*
- "How do you tell them apart?"

### D4. Early Warning Signals
"Are there signals that tell you a problem is developing before it becomes serious? Things you catch early that let you avoid a bigger problem?"
*[Target: Predictive/early-warning perceptual knowledge — the most valuable category]*

---

## PART E: CLEANING AND MAINTENANCE (10 minutes)

### E1. Cleaning Approach
"Walk me through how you clean the system after a session."
*[Note: Compare to documented protocol. Look for modifications, shortcuts, additions.]*
- "Is there anything about the documented cleaning procedure you've changed based on your experience?"
- "What happens when cleaning is skipped or done quickly?"

### E2. Component Replacement Judgment
"How do you decide when it's time to replace a component — nozzle, O-ring, tubing?"
*[Target: The inspection criteria; the 'when in doubt' default; the cost of delaying replacement]*
- "Have you had a situation where you should have replaced something sooner? What happened?"

### E3. The Recurring Problems
"Are there any problems that keep coming back on this machine — things that happen more than once?"
*[Target: Machine-specific idiosyncrasies, maintenance issues, chronic conditions]*

---

## PART F: SINTERING (10 minutes)

### F1. Sintering Setup
"How do you decide on your sintering parameters? Temperature, time — how do you choose?"
*[Target: The substrate-limited decision; the ink-specific parameters; the ramp rate issue]*
- "Have you ever had to use different parameters than usual? What drove that decision?"

### F2. Post-Sinter Assessment
"How do you assess a trace after sintering? What are you looking for?"
*[Target: Visual inspection criteria; when to measure vs. when visual is sufficient; what 'bad' looks like]*
- "What do you do if the sinter result doesn't look right?"
- "Has a trace ever looked good but tested bad, or looked bad but tested good? Tell me about it."

---

## PART G: ADVICE TO A NEW OPERATOR (10 minutes)

### G1. The Most Important Thing
"If you could tell a new operator one thing about running this machine that they won't learn from the procedure manual, what would it be?"
*[Open-ended; often produces the single highest-density tacit knowledge statement]*

### G2. The Biggest Mistake
"What's the most common mistake new operators make? What do they do that experienced operators don't?"
*[Target: The systematic novice errors — the ones that would be most valuable to prevent through training]*

### G3. The Things That Take Longest to Learn
"What took you the longest to get good at? What do you still feel uncertain about sometimes?"
*[Target: Residual uncertainty in even experienced operators — the genuine hard problems]*

### G4. What the Procedure Manual Gets Wrong
"Is there anything in the written SOP that you think is wrong, incomplete, or that you do differently in practice?"
*[Important for validating the corpus against ground truth; note any procedure gaps or errors for registry update]*

---

## ANALYSIS GUIDE: PROCESSING THE INTERVIEW OUTPUT

### Classification Framework for Elicited Knowledge

For each knowledge item captured in the interview, classify:

| Dimension | Options | Implication |
|---|---|---|
| Collins type | Relational / Somatic / Collective | Relational → add to corpus. Somatic → scaffolding description only. Collective → needs multi-expert validation. |
| Confidence | Expert's own confidence level | Low-confidence claims from experts → flag for gap review |
| Conflict with corpus | Confirms / Extends / Contradicts existing corpus | Contradictions → priority for resolution |
| SOP gap | In SOP / Missing from SOP / Contradicts SOP | SOP gaps → high priority corpus additions |
| Training mode target | Socratic / Scenario / In-Operation / All | Routes new knowledge to appropriate training mode |

### Red Flags to Follow Up

- Any step the expert does that is not in the SOP and that they do consistently
- Any SOP step the expert skips and explains why (may reveal SOP error)
- Any fault type that expert has encountered that is not in the fault taxonomy (new fault node needed)
- Any parameter range or limit that differs from documented values (resolve before adding to corpus)
- Any mention of machine-specific idiosyncrasy not captured elsewhere

---

## VERIFICATION SESSION (30 minutes, scheduled separately)

After analysis of the first session:

1. Present back major findings: "You said [X]. We captured that as [formalized statement]. Is that accurate?"
2. Present specific cases from Document 02 fault case library: "Does this match how you would approach this fault?"
3. Present any pressure direction / gas sequence questions where answers deviated from expectations
4. Probe any gaps identified in the analysis: "You didn't mention [Y]. Is that because it's not relevant, or because it didn't come to mind?"
5. Provide the 5-state line quality reference (Document 01, Section 1.3): "Does this match your experience? Is there a state that's missing or that we've described incorrectly?"

---

## CONFIDENTIALITY AND DATA USE NOTICE (to be read to participant before session)

"This session will be recorded for research purposes. The recording will be used to extract knowledge for the AJP training system. Your name and identifying information will not be associated with specific statements in the training system. The recording will be stored on [secure location]. You may stop the session or decline to answer any question at any time."

---

## Source Provenance

| Element | Basis |
|---|---|
| Cognitive task analysis structure | Crandall, Klein & Hoffman (2006) *Working Minds*; Schraagen et al. (1997) |
| Think-aloud protocol | Ericsson & Simon (1993) *Protocol Analysis* |
| Critical decision method | Klein et al. (1989); probes for naturalistic decision making |
| Industry 4.0 tacit elicitation framework | Hoerner et al. (2022) *CSCW*; Springer Nature tacit KE paper (2022) |
| ExpertTrace pipeline integration | Gray-Roncal et al. (2026, in prep) — AIED 2026 target |
