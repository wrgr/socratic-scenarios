---
domain: ajp
source: downloads/deep-research-report-2
confidence: Medium
chunk_type: research-synthesis
difficulty: advanced
role_context: process-engineer
---

# Deep Research on the Tacit Knowledge Elicitation Prompt for AJP Physical Debugging

## What the prompt is trying to do

The file `tacit_knowledge_elicitation_prompt.md` is a structured interview guide designed to pull *operational expertise* out of an experienced operator of an Optomec HD2 Aerosol Jet Printing (AJP) system (or similar precision fabrication tool). Its stated intent is to capture what experts *notice, infer, and decide*—especially around failure recognition, diagnosis, and recovery—rather than repeating standard operating procedures (SOPs) or textbook descriptions.

This intent closely matches how the knowledge-elicitation literature distinguishes between (a) *describing steps* and (b) *revealing expert cognition*—the latter being the sort of “how to think / what to attend to” knowledge needed to build better training, interfaces, diagnostics, and organizational memory. citeturn4view2turn5view0turn28view0

The prompt’s recurring “What do you notice here that a novice would miss?” principle is particularly aligned with established cognitive-task-analysis approaches that explicitly target expert–novice differences, subtle cues, and common misinterpretations rather than procedural recitation. citeturn5view1turn18view0turn28view2

## Research foundations for eliciting tacit operational knowledge

A central challenge your prompt is tackling is that “tacit knowledge” is frequently *available in performance* but not readily available in verbal explanation. A classic formulation attributed to entity["people","Michael Polanyi","philosopher of science"] is: “we know more than we can tell,” used to emphasize that expertise often depends on background, subsidiary awareness that is hard to articulate directly. citeturn22view0turn22view1

From an organizational perspective, tacit–explicit conversion is commonly treated as an interaction between the two forms, rather than a simple “download from the expert’s head.” In entity["people","Ikujiro Nonaka","knowledge management scholar"]’s model, knowledge creation involves recognizable conversion modes between tacit and explicit knowledge and is framed as a dynamic, social process (often summarized as “socialization, externalization, combination, internalization”). citeturn20view2turn20view3

A second foundational issue is methodological: interviews are powerful but imperfect for eliciting tacit cognition. Shadbolt & Smart (from entity["organization","University of Southampton","Southampton, UK"]) define knowledge elicitation as techniques aiming to elicit expert knowledge through interaction, but they also explicitly warn that interviews can be inefficient, patchy, and—most importantly for tacit knowledge—limited to what the expert can verbalize; experts may also supply “black box” answers or post-hoc rationalizations that feel coherent but don’t reflect how decisions were actually made. citeturn4view2turn4view3turn4view4

This is one reason “interview + something else” is a recurring best practice. Knowledge-elicitation work distinguishes between “natural” and “contrived” methods and recommends a program of techniques rather than relying solely on conversation. citeturn4view3turn4view4turn18view1

Two evidence-based families of technique are especially relevant to your prompt’s shape:

- **Incident-based elicitation (Critical Incident Technique and Critical Decision Method).** The critical incident tradition emphasizes collecting detailed accounts of significant events/behaviors (not generic opinions). citeturn4view5turn28view1turn18view2  
  Building on that, the **Critical Decision Method (CDM)**—co-developed by entity["people","Gary Klein","ndm researcher"] and colleagues in work with entity["organization","U.S. Army Research Institute","fort belvoir, VA, US"]—uses retrospective probing of *actual non-routine incidents* to surface cues, judgments, and decision points. citeturn17view0turn17view1turn28view0turn18view2

- **Applied Cognitive Task Analysis (ACTA).** ACTA was created to make CTA more usable by practitioners, typically combining a task overview (“task diagram”), a targeted “knowledge audit” of what makes the work hard (including cues and common errors), and scenario/simulation-style probing to reveal expert strategies. citeturn5view0turn5view1turn4view1turn17view1

A further refinement relevant to *physical debugging* is the role of **external stimuli (visual artifacts, video, logs, examples)**. A reflective version of video-stimulated interviewing argues that placing the interview around a concrete replay of practice (and using prompts like “What do you notice?”) can bring forward implicit theories and unconscious choices better than abstract questioning, provided the interview is used to stimulate *reflection* rather than to demand perfect “recall” of past cognition. citeturn8view0  
More generally, elicitation interviews that use participant-created or participant-selected documents/artifacts are explicitly described as a way to shape conversation and establish meaning with less ambiguity than document-only analysis. citeturn25view1turn28view3

## Domain context: why AJP operations generate tacit knowledge

Industrial aerosol jet printing is a technically dense, multi-parameter process with strong coupling between materials, flow, geometry, and time-dependent drift—exactly the kind of environment where experts rely on subtle perceptual cues and learned heuristics.

On the platform side, entity["company","Optomec","additive manufacturing company"]’s AJ HD2 family is positioned for fine-feature printed electronics, with published specs including (for the HD2-3x configuration) line widths from ~10 µm up to millimeter scales and “hands-off” runtime up to hours, implying long sessions where drift and gradual degradation are operational realities. citeturn13view0turn29view0

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["aerosol jet printing schematic","Optomec Aerosol Jet HD2 printer","aerosol jet print head nozzle close up","aerosol jet printed conductive traces microscope"],"num_per_query":1}

On the process-physics side, AJP quality is often discussed in terms of line morphology metrics such as **linewidth** and **overspray** (material dispersed outside the main line body). A 2025 “digital twin” preprint operationalizes these concepts explicitly (including image-based definitions) and shows that linewidth and overspray vary with gas flow parameters and can drift during extended prints. citeturn9view1turn29view4  
That same work reports nearly linear relationships between linewidth/overspray and carrier/sheath flow rates across tested regimes, and it models how internal changes like **nozzle deposition** can distort flow and degrade line quality—in other words, “clogging or internal buildup” is not merely a binary failure; it can be progressive and quality-affecting before it becomes catastrophic. citeturn9view1turn29view4

Independent experimental/numerical studies echo the importance of **sheath vs. carrier flow** and **standoff/working distance**. For example, one Materials (MDPI) study defines focusing ratio as sheath flow divided by carrier flow, links increases in focusing ratio to reduced apparent line width (via stronger compression of the aerosol beam), and reports that increasing working distance tends to increase feature width—exactly the kind of coupled effect that operators learn as a “feel” over time. citeturn16view2  
Scientific Reports papers similarly describe sheath gas as the mechanism that focuses the aerosol mist and directly influences line width; they also note that too-low or too-high sheath flow can degrade printing quality. citeturn9view2

Time dependence is not an edge case. In run-time stability research associated with entity["organization","Rochester Institute of Technology","Rochester, NY, US"], authors describe how atomizing gas flow can drive solvent evaporation in the atomization cup; as volatile solvent is removed, solid loading increases, rheological properties change, and print output can become unstable—linking session duration to gradual onset failures and “drift” that a novice may misattribute to unrelated causes. citeturn11view0turn29view3turn12view0

Finally, AJP’s origins and applications help explain why expert judgment is central: the technology emerged from a entity["organization","Defense Advanced Research Projects Agency","us defense agency"] program (MICE) and was commercialized for printing functional materials on complex substrates—use cases where small mistakes produce expensive scrap and where “good enough vs. abort” decisions are frequent. citeturn29view2turn13view2turn13view1

## Strengths of the current prompt against established elicitation methods

The prompt’s strongest feature is that it is already *structured like a cognitive elicitation tool*, not a procedural checklist. Several components map cleanly to validated CTA/NDM constructs:

The perceptual focus (“healthy system looks like / sounds like; earliest sign something is wrong”) targets the “critical cues” and expectancy violations that naturalistic decision-making models treat as central to expert situation assessment. citeturn18view0turn17view1  
This is also consistent with ACTA’s emphasis on extracting perceptual skills and cue usage (including the “what novices miss” framing). citeturn5view0turn4view1

The diagnostic reasoning blocks (“top hypotheses; discriminators; wrong conclusion that feels right”) mirror incident-based CTA goals: not just “what happened,” but what cues supported situation assessment, what mental models were applied, and how experts reduce uncertainty quickly. citeturn17view1turn18view2turn28view0

The decision-making section (abort vs observe vs continue; cost of being wrong) aligns with CDM’s focus on decision points and probe-based unpacking of judgments. citeturn28view0turn17view0turn18view2

The scenario elicitation (“walk me through a real failure… what happened first… what actually fixed it?”) is tightly aligned with the Critical Incident family: it forces grounding in an actual event with a temporal sequence—precisely where tacit distinctions and “non-obvious” conditionals tend to surface. citeturn4view5turn28view1turn18view2

The “temporal knowledge” framing (startup vs mid-session vs end; problems caused by previous session) is unusually strong for an interview script. In AJP specifically, research on run-time stability (solvent loss, rheology drift) and on line-quality drift over minutes/hours suggests that *time-in-session* can be diagnostic, not just an operational detail. citeturn29view3turn29view4

## Key gaps and failure modes of the interview itself

Even a strong prompt can fail to elicit tacit knowledge if the interview dynamics drift toward “clean explanations.” Several well-documented elicitation hazards suggest where your current script could underperform.

Interview-only elicitation often cannot recover non-verbalizable or routinized knowledge: experts may provide what they can articulate, omit perceptual pattern recognition, or deliver post-hoc rationales that sound good but don’t reflect real-time cognition. citeturn4view4turn4view3  
Your script combats this partly (“If the expert gives a clean explanation, ask ‘What actually happens in practice?’”), but it doesn’t yet enforce the *structural constraints* that reduce these failure modes (e.g., multiple incident “sweeps,” timeline anchoring, and explicit “freeze here—what changed?” probes). citeturn28view0turn17view1turn18view2

Relatedly, scenario elicitation appears only at the end. CDM practice strongly benefits from selecting a specific non-routine incident early and repeatedly re-walking it (multiple passes) to uncover decision points, cue shifts, and error traps. When scenario work is delayed, the first half of the interview can fill with generalized talk that later becomes hard to “convert” into concrete cues and discriminators. citeturn28view0turn17view1turn17view0

The script also under-specifies **context capture**, which matters because expert judgments are context-bound (“this sound is fine *for this ink* but not for that one,” “this overspray is acceptable at this standoff but not at that geometry”). NDM research emphasizes that expertise operates under real constraints and uncertainty, and that situation understanding includes plausible goals, expectancies, and typical actions—elements that are difficult to interpret later if the interview output is not tagged with operating context. citeturn18view0turn18view1turn25view1

AJP adds an additional context challenge: multiple interacting parameters can move the same symptom (e.g., increasing line width) in different directions depending on what else is changing (sheath/carrier flows, working distance, nozzle condition, droplet characteristics). Literature linking linewidth/overspray to gas flows and to nozzle deposition implies that “symptom → cause” mappings are rarely one-to-one; instead, experts use discriminating cues and time-course patterns. If context and timing aren’t captured in a structured way, downstream “graph conversion” can collapse nuanced expertise into brittle rules. citeturn29view4turn16view2turn29view3

Finally, the prompt does not explicitly use *external anchors* (photos of good vs bad prints, camera footage, logs, or artifacts). Reflective video-stimulated approaches and artifact-based elicitation argue that concrete stimuli help participants surface routine, intuitive behaviors and tacit theories that abstract questioning can miss. citeturn8view0turn25view1turn28view3  
For physical debugging, these anchors can be the difference between “I just knew it was wrong” and “here is the moment the plume widened, the edge roughness changed, and I decided to change X.”

## Evidence-informed upgrades and a refined prompt structure

The current prompt is a strong “question library.” The research suggests the biggest gains will come from **re-ordering into an evidence-based interview flow** and **adding capture scaffolds** that make tacit cues extractable and graphable without turning into SOP.

A refined structure that stays faithful to your goals (perception, judgment, failure recognition) while aligning with ACTA/CDM practice would look like this:

First, start with a short *task-diagram pass* to define boundaries and major cognitive demands (what’s “in scope” for this operator). ACTA explicitly uses a high-level task diagram to identify the challenging elements and decide where deeper probing is needed. citeturn5view0turn5view2

Second, move immediately into *incident selection and timeline construction*. CDM is defined as retrospective probing of actual non-routine events; it relies on selecting a real incident and revisiting it in multiple sweeps. citeturn17view0turn28view0turn17view1  
A practical modification is to bring your Section 10 “Scenario Elicitation” forward so that the rest of the interview can repeatedly refer back to the same grounded event.

Third, run a *knowledge audit pass* (ACTA style) to force articulation of cues, strategies, and common errors. The ACTA paper’s knowledge audit examples explicitly target “cues and strategies” and “common errors,” which is extremely close to your “novices misinterpret” and “wrong conclusion that feels right” probes. citeturn4view1turn5view1turn17view1

Fourth, add *counterfactual “what-if” probes* and “freeze-frame” probes at key decision points. CDM emphasizes probe questions and “what-if queries” to reveal decision requirements and cue weighting. citeturn18view2turn17view1turn28view0

Fifth, incorporate *artifact-anchored reflection* at least once: show a print image, a process-camera segment, or a log snippet and ask “what do you notice?” (reflection rather than recall). Reflective video-stimulated interviewing argues that external stimuli can elicit tacit knowledge better than abstract questions, particularly when the prompts focus on interpretation and meaning-making (“what do you notice?”) rather than demanding perfect reconstruction of past thought. citeturn8view0turn25view1turn28view3

To make these upgrades concrete, here are prompt additions (not SOP steps) that are strongly supported by the literature’s failure modes:

Add a **context header** for each scenario: material/ink type, nozzle size, standoff/working distance, approximate session age, and “what changed recently.” This is justified by the known parameter sensitivity in AJP (flows, focusing ratio, working distance) and by the observed drift and nozzle-deposition effects reported in modeling/monitoring work. citeturn16view2turn29view4turn29view3

Add a **cue-to-meaning probe**: “When you notice X, what does it *mean* to you? What would it mean if it happened earlier vs later in the run?” This directly targets situation understanding and expectancies (NDM) and helps disambiguate symptoms with different time courses. citeturn18view0turn29view3turn29view4

Add a **discriminator probe that enforces ‘fast tests’** without becoming SOP: “If you had 60 seconds and could only check one thing to choose between your top hypotheses, what would you check and why?” CDM is explicitly about probing the basis for situation assessment under time pressure, and your own objective emphasizes fast discrimination. citeturn17view0turn18view2turn28view0

Add a **drift probe** that is AJP-specific: “During long runs, what drifts first: geometry (linewidth/overspray), adhesion, electrical performance, or something else? What cue tells you the drift is ink/solvent-related vs nozzle-related?” This is grounded in (a) run-time solvent-loss / rheology-instability mechanisms and (b) evidence that linewidth/overspray drift and nozzle deposition are meaningful latent factors. citeturn29view3turn29view4turn12view2

Add a **‘black box’ rescue probe** (from interview pitfalls): “If you say ‘it’s obvious,’ what exactly is obvious—what would I see/hear/measure that makes it obvious?” This is directly responsive to documented interview hazards where experts provide unhelpful intuition statements that must be unpacked. citeturn4view4turn4view3

## Graph conversion: from interview statements to retrievable knowledge objects

Your file already anticipates a conversion step (“TacitKnowledge nodes, FailureMode nodes, Symptom nodes, Scenario scripts, Retrieval chunks”). The research implies two additional design requirements for the graph to stay faithful to tacit expertise:

Graph entries should preserve **(a) context** and **(b) time-course**, because expert discrimination depends on how cues emerge and evolve under specific conditions. This follows from (i) NDM’s emphasis on context-bound situation understanding and critical cues and (ii) AJP evidence that the same quality metrics drift over time and respond to multiple interacting parameters. citeturn18view0turn29view4turn16view2

Graph entries should preserve **cue interpretation and decision thresholds**, not merely cue–action pairs. CDM outputs often include timelines, decision requirements, and Situation Assessment Records—representations that capture cue usage and goal shifts, not just “if X then do Y.” citeturn28view0turn17view1turn18view2

A practical (graph-friendly) representation consistent with CDM/ACTA outputs is to treat each scenario as a sequence of “decision frames,” each frame containing:

- **Observed cues** (sensory + instrumented): e.g., visible overspray growth, subtle sound change, pressure drift. (AJP literature shows that linewidth/overspray can be extracted from images and can drift; thus “what you see” is legitimately measurable and decision-relevant.) citeturn29view4turn9view1  
- **Interpretation / hypothesis set**: top 2–3 explanations entertained at that moment. (Matches your Diagnostic Reasoning section and CDM probes.) citeturn17view0turn28view0  
- **Discriminators**: what cue or check collapses uncertainty fastest. (Matches NDM uncertainty coping and CDM’s probe logic.) citeturn18view2turn17view1  
- **Decision and rationale**: abort/continue/monitor and why, including cost-of-wrong. (Matches your Decision-Making section and CDM’s decision requirements.) citeturn28view0turn18view2  
- **Outcome / ground truth**: what actually fixed it, plus “what would have happened if…” (Supports debiasing and future training scenarios.) citeturn28view1turn18view2

Finally, for retrieval chunks, the literature on elicitation stimuli strongly suggests storing a short “anchor artifact” reference (image of print defect, short clip, parameter snapshot) alongside the chunk, because future learners can often interpret tacit distinctions faster when they can *see* the cue rather than read a description of it. citeturn8view0turn25view1turn28view3

The net effect of these upgrades is that the prompt becomes not only a good interview guide, but also a reliable *knowledge capture instrument*—one that systematically produces the cues, discriminators, timing signatures, and decision criteria that the tacit knowledge literature identifies as both hardest to verbalize and most valuable to preserve. citeturn4view4turn5view0turn28view2turn29view3