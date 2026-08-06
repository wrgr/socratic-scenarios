/**
 * Expert-elicited tacit knowledge nodes for the AJP HD2 training corpus.
 *
 * PURPOSE OF THIS FILE
 * ─────────────────────
 * Tacit knowledge is what experienced operators know but rarely write down:
 * perceptual cues, decision heuristics, and judgments that come from running
 * the machine. This file is the dedicated insertion point for that content.
 *
 * HOW TO ADD A NEW NODE
 * ──────────────────────
 * 1. Copy the template below into the tacitKnowledgeNodes array.
 * 2. Assign a sequential ID: TACIT-<DOMAIN>-<TOPIC>-<NNN>
 *    Domain prefixes: NOZZLE, PRESSURE, ATOMIZATION, DEPOSITION, SINTER, ESD, INK
 * 3. Fill `content` with the elicited knowledge — include the observable signal
 *    (what you see / hear / feel), the interpretation, and the decision rule.
 *    Do NOT just paraphrase the SOP. If the SOP covers it, it belongs elsewhere.
 * 4. Add edges to tacitKnowledgeEdges: REQUIRES edges from the FailureMode or
 *    Step node that this tacit knowledge is most relevant to; PROBES edges from
 *    any SocraticProbe node that targets this knowledge.
 * 5. Add to docs/expert-elicitation-log.md: session date, expert, source quote.
 * 6. Run `npm test` — corpus-integrity.test.ts will verify all edges resolve.
 *
 * NODE TEMPLATE
 * ─────────────
 * {
 *   id: 'TACIT-DOMAIN-TOPIC-001',
 *   type: 'TacitKnowledge',
 *   content:
 *     '[Observable signal — what exactly does the expert see / hear / feel?] ' +
 *     '[Interpretation — what does that signal mean?] ' +
 *     '[Decision rule — what action does the expert take based on this reading?]',
 *   confidence: 'High' | 'Medium' | 'Low',
 *   source: 'Expert interview YYYY-MM-DD, [expert role], or doc ref',
 * },
 *
 * QUALITY GATE (from docs/expert-elicitation-guidelines.md)
 * ─────────────────────────────────────────────────────────
 * Before adding: verify the node passes ALL of these:
 * □ Content describes an observable (something learner can see/hear/feel)
 * □ Content is actionable — learner knows what to do after reading it
 * □ Source is traceable (interview date + expert role, not just "experience")
 * □ Confidence is 'Low' if elicited from only one expert; raise after validation
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export const tacitKnowledgeNodes: AJPNode[] = [
  // ── KB-DOC-01: remaining perceptual signals ───────────────────────

  {
    id: 'TACIT-INK-QUALITY-001',
    type: 'TacitKnowledge',
    content:
      'Pre-load ink inspection (Ag NP conductive ink): good ink is bright metallic silver-gray with ' +
      'uniform dispersion after gentle swirling and a light-cream consistency — pourable but not watery. ' +
      'Reject if: (1) settled dark layer at bottom that does not re-disperse → agglomerated particles, do not use; ' +
      '(2) color changed to dark gray or brownish → oxidation, do not use; ' +
      '(3) stringy or gel-like when poured → agglomeration, do not use; ' +
      '(4) ink left in atomizer from prior session without proper shutdown → inspect jet/transducer for dried residue before use. ' +
      'For borderline ink (correct color, past open date): print 3 test lines on sacrificial substrate, ' +
      'sinter, and measure resistance. If resistance ≥10× expected, discard the ink. ' +
      'The test-print cost is far lower than a failed repair on an actual PCB. ' +
      'Baseline ink (Novacentrix Metalon JS-A426, see PARAM-INK-IDENTITY-001) ships and stores refrigerated — ' +
      'let it reach room temperature before swirling and inspecting, or condensation can be mistaken for separation.',
    confidence: 'High',
    source: 'KB-DOC-01 §6.1 · SRC-010, InferredFromDomain, PARAM-INK-IDENTITY-001 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-POST-SINTER-INSPECT-001',
    type: 'TacitKnowledge',
    content:
      'Post-sinter inspection — visual then electrical. ' +
      'Good sinter: bright metallic silver, smooth surface, edges slightly more defined than pre-sinter, ' +
      'adheres firmly (cannot scrape off with fingernail). ' +
      'Incomplete sinter: dark patches within the trace (organic binder not fully decomposed, high local resistance), ' +
      'matte or powdery surface (particles not fused, poor durability). ' +
      'Thermal damage: cracks across the trace (ramp too fast or temperature too high), ' +
      'delamination from substrate (adhesion failure during heating), ' +
      'substrate discoloration adjacent to trace (PCB exceeded thermal limit — escalate, do not re-sinter). ' +
      'Resistance measurement is mandatory — visual alone misses high-resistance necks and incomplete interior sintering. ' +
      'Thresholds: 1–10 Ω short trace (excellent); 10–100 Ω (adequate); 100–500 Ω (marginal, consider re-sinter or reprint); ' +
      '>500 Ω despite visual continuity (insufficient sintering — reprint); open circuit (gap — reprint). ' +
      'Also measure from repair trace to nearest adjacent trace to check for unintended shorts.',
    confidence: 'Medium',
    source: 'KB-DOC-01 §7.1 · SRC-007, SRC-008, SRC-009, InferredFromDomain · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-ASSEMBLY-ORING-001',
    type: 'TacitKnowledge',
    content:
      'O-ring greasing — correct amount and condition checks. ' +
      'Correct amount: O-ring is uniformly shiny with no dry patches and no visible bead or ridge of excess grease. ' +
      'Touch check: running a clean fingertip around the O-ring leaves a thin film but no heavy smear. ' +
      'Assembly feel: slight resistance then a definite "seat" when correctly positioned; loose or gappy feel means not in place. ' +
      'Under-greasing consequence: micro-leaks that manifest as pressure anomalies mimicking gas system faults. ' +
      'Over-greasing consequence: grease migrates into ink or gas path, becomes clog nucleation site. ' +
      'After greasing: inspect from two angles 90° apart to catch dry patches. ' +
      'O-ring condition before greasing: pinch gently — must return to round immediately; any retained flat shape means hardened, replace. ' +
      'Check for cuts, nicks, or flat sections along the circumference. ' +
      'Acetone exposure requires immediate O-ring inspection — acetone attacks some elastomer formulations.',
    confidence: 'High',
    source: 'KB-DOC-01 §5.1 · SRC-018 §4.1, SRC-019 §1.3 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-ASSEMBLY-TUBING-001',
    type: 'TacitKnowledge',
    content:
      'PFA tubing quality checks — cut and insertion. ' +
      'Cut quality: hold the cut end up to the light and look for a circular cross-section. ' +
      'Any oval shape means an angled cut — re-cut flat before inserting. ' +
      'The difference between flat and angled is subtler than expected; the light check is more reliable than visual inspection at an angle. ' +
      'Insertion check: after inserting into a fitting and tightening the omnilock, attempt to pull the tube out. ' +
      'Correct installation fails the pull test — any give means the tube is not fully seated. ' +
      'Replace tubing when: visibly yellowed or discolored (chemical attack), kinked or permanently bent, ' +
      'cut at an angle even temporarily used, or deformed at the cut end from a fitting. ' +
      'PFA tubing is inexpensive relative to the cost of a failed print; replace at first sign of compromise.',
    confidence: 'High',
    source: 'KB-DOC-01 §5.2 · SRC-018 §4.1 · v1.0-2026-04-10',
  },

  // ── KB-DOC-02: fault diagnosis reasoning ─────────────────────────

  {
    id: 'TACIT-DIAGNOSIS-LOOP-001',
    type: 'TacitKnowledge',
    content:
      'Expert diagnostic loop: OBSERVE → LOCALIZE → DISCRIMINATE → ACT → VERIFY → repeat if unresolved. ' +
      'Observe: describe the symptom precisely — not "the line looks bad" but "the line is 40% wider than expected ' +
      'with diffuse edges, consistent width along the full trace." ' +
      'Localize: which subsystem is the likely source? Six domains: fluidic/atomization, gas system, ' +
      'deposition quality, substrate/adhesion, post-process, system/software. Most symptoms narrow to one or two immediately. ' +
      'Discriminate: identify the specific fault using perceptual cues, KEWB data, and onset timing. ' +
      'Act: make ONE change. Not two. Not three. ' +
      'Verify: did the change resolve the symptom? If not, you have eliminated one candidate — loop back to Discriminate. ' +
      'Temporal onset question: "When did this first appear?" eliminates ~50% of candidate faults before any parameter inspection.',
    confidence: 'Medium',
    source: 'KB-DOC-02 §1.1 · InferredFromDomain, Zhang 2024 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-DIAGNOSIS-SINGLE-CHANGE-001',
    type: 'TacitKnowledge',
    content:
      'The single-change rule: when diagnosing a fault, change exactly one parameter per test cycle, ' +
      'then verify the effect before making another change. ' +
      'Rationale: two simultaneous parameter changes make it impossible to determine which caused the observed result — ' +
      'the causal chain is broken. ' +
      'This is the most consistently violated diagnostic rule by novice operators. Its violation produces: ' +
      '(a) accidental fixes the operator cannot replicate; ' +
      '(b) accidental worsening the operator cannot explain; ' +
      '(c) a parameter state far from baseline that is hard to recover. ' +
      'Expert practice: write down current parameter values before changing anything — you can always return to a known state.',
    confidence: 'High',
    source: 'KB-DOC-02 §1.1 · InferredFromDomain, universal precision manufacturing practice · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-SUBSTRATE-VS-PARAM-001',
    type: 'TacitKnowledge',
    content:
      'Critical diagnostic distinction — substrate problem vs. print parameter problem. ' +
      'Rule: if the deposited line shape is geometrically correct but coverage is wrong ' +
      '(holes, dewetting, ink pulling back) — it is a substrate problem, not a print parameter problem. ' +
      'Printing parameters control width, thickness, and position. ' +
      'Substrate adhesion controls whether ink stays where deposited. These are independent failure modes. ' +
      'The novice error: seeing gaps and thinking "I need more ink" → increases atomizer flow → ' +
      'ink still dewets, now also wider and still gappy. The gap pattern did not change because substrate was the problem. ' +
      'Substrate diagnostic questions: (1) IPA-cleaned immediately before mounting, no bare-hand contact of print area? ' +
      '(2) Is this substrate material compatible with this ink? ' +
      '(3) Transfer test: same parameters on sacrificial → fine; same on PCB → gaps → substrate is the variable.',
    confidence: 'Medium',
    source: 'KB-DOC-02 §4.1 · SRC-018, Islam 2025 · v1.0-2026-04-10',
  },

  // ── KB-DOC-03: gas system tacit knowledge ─────────────────────────

  {
    id: 'TACIT-GAS-SEQUENCE-RATIONALE-001',
    type: 'TacitKnowledge',
    content:
      'Gas startup sequence rationale — why the order is not arbitrary. ' +
      'Mental model: think of the system as a wind tunnel. ' +
      'Exhaust ON first creates a low-pressure downstream end. ' +
      'Sheath ON second establishes the focusing flow into a stable aerodynamic environment. ' +
      'Atomizer ON last injects material into an already-stable system. ' +
      'Atomizer before sheath: aerosol is generated before any focusing flow exists — ' +
      'unfocused aerosol deposits on internal printhead surfaces (future clog nucleation) ' +
      'and produces a slug that flushes unpredictably at first print, typically a blob on the substrate. ' +
      'Sheath before exhaust: brief positive pressure inside the printhead can push aerosol backward into carrier gas tubing — rare but cumulative contamination. ' +
      'Shutdown sequence rationale: Atomizer OFF → wait 10 s (carrier gas sweeps residual aerosol out before exhaust stops) → ' +
      'Exhaust OFF → wait 60 s (sheath continues to flush and dry the nozzle path while exhaust winds down) → Sheath OFF. ' +
      'Skipping the waits leaves dried residue that becomes next-session clogs. Expert practice: set a timer — do not estimate by feel.',
    confidence: 'High',
    source: 'KB-DOC-03 §1.1–1.2 · SRC-018 §6–7, SRC-019 §4 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-FOCUS-RATIO-001',
    type: 'TacitKnowledge',
    content:
      'Focus ratio — the sheath-to-carrier gas relationship is the parameter actually being managed, ' +
      'not the individual flow values in isolation. ' +
      'Principle: sheath:carrier ratio determines aerosol focusing. ' +
      'More sheath relative to carrier → narrower, better-focused line. Less sheath → wider line with overspray. ' +
      'The novice error: treating sheath and carrier as independent. ' +
      'If carrier gas is increased for more deposition rate without proportionally increasing sheath, ' +
      'the focus ratio drops and the line widens — even though sheath was not touched. ' +
      'Expert practice: after any carrier gas adjustment, check whether sheath needs proportional adjustment ' +
      'to maintain the focus ratio. ' +
      'Quantitative range from peer literature: optimal focus ratio for conductive line printing is typically 2–4 (sheath:carrier). ' +
      'Below 2: overspray becomes significant. Above 4: beam over-focused, deposition thins.',
    confidence: 'High',
    source: 'KB-DOC-03 §2.1 · Islam 2025, Smith 2017 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-GAS-CONDITIONING-001',
    type: 'TacitKnowledge',
    content:
      'First-of-day gas line conditioning: after any idle period (overnight or longer), ' +
      'gas lines may contain residual dried ink particles or moisture. ' +
      'The first 1–2 test lines may show pressure spikes or irregular deposition that then stabilizes. ' +
      'This is not a fault — it is normal transient clearing behavior. ' +
      'Practice: always run at least 3–5 sacrificial test lines before printing on the actual substrate ' +
      'at the start of any session after an idle period. This serves dual purpose: parameter verification AND gas line conditioning. ' +
      'Cold environment warm-up drift: in environments below 18°C, flow controllers have thermal mass and flow rates ' +
      'may drift during the first 10–15 minutes of operation. ' +
      'Allow a 15-minute warm-up period before printing on actual substrates in cold conditions — ' +
      'this is thermal stabilization, separate from parameter tuning.',
    confidence: 'Medium',
    source: 'KB-DOC-03 §4.1 · InferredFromDomain · v1.0-2026-04-10',
  },

  // ── KB-DOC-04: assembly and maintenance ───────────────────────────

  {
    id: 'TACIT-NOZZLE-INSTALL-001',
    type: 'TacitKnowledge',
    content:
      'Nozzle installation feel checks. ' +
      'Cross-threading test: before applying any torque, rotate the nozzle counterclockwise until you feel/hear a slight click — ' +
      'this is the threads engaging at their starting position. Then rotate clockwise. ' +
      'If threading begins smoothly from the click position, it is correctly aligned. ' +
      'Cross-threaded nozzle: feels like tightening at first then suddenly becomes difficult before full seating — ' +
      'do not force past this; back out completely and restart. ' +
      'Torque rule: the nozzle is ceramic and the seal is made by the O-ring, not by clamping the body. ' +
      'Standard: finger-tight plus 1/8 turn maximum. Over-tightening can crack the ceramic or damage the seat. ' +
      'Under-tightening: gas bypasses the nozzle O-ring → low or zero KEWB pressure despite gas system on, nozzle unsecured. ' +
      'Correct install feel: no wobble when nozzle is gently rocked side-to-side; flush with or slightly recessed into printhead face.',
    confidence: 'High',
    source: 'KB-DOC-04 §1.2 · InferredFromDomain (standard threaded fitting practice) · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-ASSEMBLY-JAR-LOAD-PA-001',
    type: 'TacitKnowledge',
    content:
      'PA (pneumatic atomizer) jar ink loading. ' +
      'Fill level: 0.5–2.5 mL. The jet tube must be approximately 15 mm above the ink surface — not submerged. ' +
      'The novice error — overfilling: jet tube submerged in ink → atomizer gas just bubbles through liquid → no aerosol generated. ' +
      'Symptom of overfill: zero KEWB carrier pressure despite atomizer gas flowing. ' +
      'Verification after filling: hold jar up to the light and visually confirm the jet tube tip is clearly above the ink surface. ' +
      'Jar lid seal check: tightening the lid should show slight resistance at the final turn as the O-ring compresses. ' +
      'A jar that tightens with no final resistance has a missing or improperly seated O-ring.',
    confidence: 'High',
    source: 'KB-DOC-04 §1.3 · SRC-019 §4.3, SRC-018 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-ASSEMBLY-VIAL-LOAD-UA-001',
    type: 'TacitKnowledge',
    content:
      'UA (ultrasonic atomizer) vial loading. ' +
      'Fill to approximately 30 mL. Underfilling is the primary risk — the transducer must contact the ink through the vial wall. ' +
      'Vial seating: the vial must sit squarely in the transducer cradle. ' +
      'A canted vial has poor acoustic coupling → reduced atomization efficiency → irregular UA sound (the auditory diagnostic cue). ' +
      'Verification: press gently down on the vial top — it should not shift or rock. If it rocks, reseat. ' +
      'Connection: irregular vial seating is one cause of the "irregular rattling" abnormal UA sound pattern ' +
      '(see TACIT-ATOMIZATION-SOUND-UA-001).',
    confidence: 'High',
    source: 'KB-DOC-04 §1.3 · SRC-019 §4.3 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-CLEANING-PROTOCOL-001',
    type: 'TacitKnowledge',
    content:
      'Full cleaning sequence: (1) DI water flush, (2) Branson IS solution soak — minimum 4 hours, not approximate. ' +
      'Surfactant action requires time to penetrate dried Ag NP residue; a 30-minute soak leaves residue. ' +
      '(3) IPA rinse — removes Branson IS residue AND has faster evaporation than water; skipping leaves surfactant that affects ink behavior. ' +
      '(4) Nitrogen blow-out if available; otherwise overnight air dry. ' +
      'Sonication notes: remove O-rings before placing components in the ultrasonic bath — sonic energy degrades elastomers. ' +
      'Test the ultrasonic bath before each use: place a small piece of aluminum foil in the bath — ' +
      'a working bath rapidly pits and perforates the foil; intact foil means the transducers are not functioning. ' +
      'Bath at 40–50°C significantly accelerates cleaning for Ag NP inks. ' +
      'Expert rule: clean at the end of every session. Dried Ag NP ink is substantially harder to clean than recently-dried ink.',
    confidence: 'High',
    source: 'KB-DOC-04 §2.1–2.2 · SRC-018 §11, SRC-019 §7 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-PREPRINT-CHECKLIST-001',
    type: 'TacitKnowledge',
    content:
      'Seven-zone pre-print sweep (takes ~2 minutes when internalized — done before touching KEWB): ' +
      'Zone 1 Ink: correct ink for this application, condition checked (visual: color, consistency, no agglomeration), appropriate fill level. ' +
      'Zone 2 Assembly: all O-rings present and greased, nozzle correctly installed, all fittings correct, PFA tubing flat-cut and fully seated. ' +
      'Zone 3 Gas System: gas lines connected to correct ports, KEWB showing expected pre-flow readings. ' +
      'Zone 4 Stage and Substrate: PCB correctly fixtured, IPA-cleaned immediately before mounting with no bare-hand contact of print area after cleaning, Z height set with slide stack. ' +
      'Zone 5 Toolpath: KEWB toolpath on correct layer, start/stop positions verified against PCB trace, alignment checked against reference marks. ' +
      'Zone 6 Safety: ventilation confirmed active, PPE available, lab access restricted if required. ' +
      'Zone 7 Abort Plan: know the emergency stop location, sacrificial substrate ready for test lines, know who to call for emergency shutdown.',
    confidence: 'High',
    source: 'KB-DOC-04 §3.1 · SRC-018 §4.1, §11; SRC-019 §1.3, §4.3, §7 · v1.0-2026-04-10',
  },

  // ── KB-DOC-05: sintering decision tacit ──────────────────────────

  {
    id: 'TACIT-SINTER-SUBSTRATE-LIMIT-001',
    type: 'TacitKnowledge',
    content:
      'Substrate thermal limits govern the sintering window — the substrate is always the binding constraint, not ink preference. ' +
      'Typical maximum safe sinter temperatures: FR-4 PCB 130–160 °C (exceeding Tg risks delamination); ' +
      'polyimide (Kapton) 200–250 °C; ceramic (alumina) 300 °C+ (essentially unlimited); flex substrates (PET/PEN) 120–150 °C. ' +
      'For PCB repair on FR-4: use 130–150 °C for 30–60 min. This is below optimal for maximum conductivity but safe for the board. ' +
      'When existing SMD components are in the sintering zone, identify the most thermally sensitive component and design around its limit — ' +
      'an LGA IC may be rated to 150 °C storage maximum; a ceramic capacitor is typically fine. Always check the component datasheet before sintering. ' +
      'Temperature and time are partially interchangeable: 130 °C for 60–90 min can substitute for 150 °C for 30–45 min when substrate limits are tight. ' +
      'After ~90 min at sintering temperature, additional time produces diminishing conductivity returns for typical Ag NP inks.',
    confidence: 'High',
    source: 'KB-DOC-05 §2.1, §2.2 · SRC-007, SRC-008, SRC-009 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-SINTER-RAMP-RATE-001',
    type: 'TacitKnowledge',
    content:
      'Ramp rate is the most frequently ignored sintering variable and a common source of cracked traces. ' +
      'If the oven heats too quickly, the outer trace surface begins sintering (densifying) before organic binders in the interior have fully outgassed. ' +
      'Trapped binder volatiles then crack the densifying outer layer, leaving transverse cracks visible under 10x magnification. ' +
      'Safe ramp rate: ≤5 °C/min from ambient to sintering temperature (2–5 °C/min is conservative and safe for most Ag NP inks on PCB substrates). ' +
      'Most standard convection ovens are naturally below this limit. ' +
      'Critical novice error: placing the PCB in a pre-heated oven at full temperature — this is effectively an instantaneous ramp. ' +
      'The correct approach is to start with an unheated oven, or use a staged profile: ambient → 100 °C hold for 10 min (solvent evaporation) → ramp at ≤5 °C/min to sinter temperature. ' +
      'If cracks appear post-sinter at regular intervals, suspect ramp rate before blaming temperature choice.',
    confidence: 'High',
    source: 'KB-DOC-05 §2.3 · SRC-007 · v1.0-2026-04-10',
  },

  {
    id: 'TACIT-SINTER-RESISTANCE-001',
    type: 'TacitKnowledge',
    content:
      'Resistance measurement is mandatory after sintering — visual inspection alone cannot detect high-resistance necks, incompletely sintered interiors, or short circuits to adjacent traces. ' +
      'Protocol: (1) allow PCB to cool to room temperature before measuring (thermal EMF in the meter introduces errors during cooling); ' +
      '(2) set multimeter to appropriate Ω range for 3+ significant figures; ' +
      '(3) measure start-pad to end-pad resistance of the repair trace; ' +
      '(4) measure from repair trace to nearest adjacent trace — checking for shorts. ' +
      'Interpretation: 1–10 Ω = excellent sinter (high conductivity); 10–100 Ω = good sinter, adequate for most repairs; ' +
      '100–500 Ω = marginal — may pass depending on circuit, consider re-sintering or reprinting; ' +
      '>500 Ω = insufficient sinter or print quality issue — do not use; ' +
      'OL/open = gap in trace, must reprint; ' +
      'unexpectedly very low resistance or short to adjacent trace = possible bridge short — inspect under magnification. ' +
      'For digital signal lines, < 100 Ω is typically a pass. For power rails, < 10 Ω. For RF/analog, verify against circuit impedance budget.',
    confidence: 'Medium',
    source: 'KB-DOC-05 §4.2 · InferredFromDomain (electronics repair) · v1.0-2026-04-10',
  },

  // ── KB-DOC-06: ESD handling discipline ────────────────────────────

  {
    id: 'TACIT-ESD-HANDLING-001',
    type: 'TacitKnowledge',
    content:
      'ESD discipline: the discharge you cannot see or feel is the one that kills the board. ' +
      'A body charged to a few hundred volts — well below the ~3 kV needed before you feel a spark — is already enough to latent-damage a sensitive device, so "I didn\'t feel a zap" is not evidence of safety. ' +
      'Correct practice is preventive and unconditional: wrist strap bonded to the common ground point before any board contact, dissipative mat under the work, tools and printhead grounded, and boards handled by the edges. ' +
      'The failure mode is insidious — an ESD-wounded trace or die often passes the post-repair continuity test and only fails weeks later in the field — so you never get positive feedback that the discipline worked, only the absence of a later return. That is exactly why novices skip it and experts never do.',
    confidence: 'High',
    source: 'InferredFromDomain · ESD control practice (ANSI/ESD S20.20, IPC-7711/7721) · v1.0-2026-08-05',
  },

  // ── KB-DOC-06: tacit knowledge theory reference ───────────────────

  {
    id: 'THEORY-TACIT-KNOWLEDGE-001',
    type: 'TheoryReference',
    content:
      'Theoretical foundation for the training system\'s tacit knowledge approach. ' +
      'Polanyi (1966): "We know more than we can tell." ' +
      'The focal/subsidiary distinction: the expert is focally aware of the outcome (pressure trend, plume shape) and only subsidiarily aware of the perceptual signals guiding them — the subsidiary layer is the tacit layer. ' +
      'Two types relevant to AJP: (1) Connoisseurship (perceptual expertise) — pattern recognition like reading a plume or hearing UA irregularity; partially teachable by verbally naming categories before physical exposure. ' +
      '(2) Skill (procedural/embodied) — feel of a correctly-seated nozzle or greased O-ring; only scaffoldable through verbal target description, physical skill requires practice. ' +
      'Collins (2010) taxonomy applied to AJP: Relational tacit (best practices not yet written down — fully accessible via elicitation, teachable in Socratic/Scenario mode); ' +
      'Somatic tacit (constituted in the body — nozzle threading feel, O-ring feel; only scaffolding possible, physical practice required); ' +
      'Collective tacit (community-of-practice norms — requires multiple operators\' input, not one expert). ' +
      'Nonaka SECI model: the training system operates in Combination (corpus assembly) and Internalization (Socratic + Scenario converting explicit rules into learner\'s own knowledge structure). ' +
      'It cannot replace Socialization (expert-apprentice co-presence), which is the richest but least scalable transfer mode. ' +
      'Pedagogical arc: Explicit (Socratic mode) → Practiced (Scenario mode) → Automatic (real machine experience). The system covers the first two stages.',
    confidence: 'High',
    source: 'KB-DOC-06 §1–3 · Polanyi (1966), Nonaka & Takeuchi (1995), Collins (2010) · v1.0-2026-04-10',
  },
];

export const tacitKnowledgeEdges: AJPEdge[] = [
  // ── KB-DOC-01 ─────────────────────────────────────────────────────
  { from: 'FAULT-INK-DEGRADED-001', to: 'TACIT-INK-QUALITY-001', type: 'REQUIRES' },
  { from: 'FAULT-SINTER-INCOMPLETE-001', to: 'TACIT-POST-SINTER-INSPECT-001', type: 'REQUIRES' },
  { from: 'FAULT-SINTER-THERMAL-DAMAGE-001', to: 'TACIT-POST-SINTER-INSPECT-001', type: 'REQUIRES' },
  { from: 'PROBE-SINTER-PARAMETERS-001', to: 'TACIT-POST-SINTER-INSPECT-001', type: 'PROBES' },
  { from: 'FAULT-LEAK-ORING-001', to: 'TACIT-ASSEMBLY-ORING-001', type: 'REQUIRES' },
  { from: 'FAULT-LEAK-FITTING-001', to: 'TACIT-ASSEMBLY-TUBING-001', type: 'REQUIRES' },
  // ── KB-DOC-02 ─────────────────────────────────────────────────────
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },
  { from: 'FAULT-BLOB-FORMATION-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'TACIT-DIAGNOSIS-SINGLE-CHANGE-001', type: 'REQUIRES' },
  { from: 'FAULT-DROPOUT-001', to: 'TACIT-DIAGNOSIS-SINGLE-CHANGE-001', type: 'REQUIRES' },
  { from: 'FAULT-POOR-ADHESION-001', to: 'TACIT-SUBSTRATE-VS-PARAM-001', type: 'REQUIRES' },
  { from: 'FAULT-CONTAMINATION-PRE-PRINT-001', to: 'TACIT-SUBSTRATE-VS-PARAM-001', type: 'REQUIRES' },
  // ── KB-DOC-03 ─────────────────────────────────────────────────────
  { from: 'FAULT-GAS-SEQUENCE-WRONG-001', to: 'TACIT-GAS-SEQUENCE-RATIONALE-001', type: 'REQUIRES' },
  { from: 'PROBE-GAS-SEQUENCE-START-001', to: 'TACIT-GAS-SEQUENCE-RATIONALE-001', type: 'PROBES' },
  { from: 'PROBE-GAS-SEQUENCE-STOP-001', to: 'TACIT-GAS-SEQUENCE-RATIONALE-001', type: 'PROBES' },
  { from: 'FAULT-OVERSPRAY-001', to: 'TACIT-FOCUS-RATIO-001', type: 'REQUIRES' },
  { from: 'FAULT-SHEATH-GAS-001', to: 'TACIT-FOCUS-RATIO-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'TACIT-GAS-CONDITIONING-001', type: 'REQUIRES' },
  // ── KB-DOC-04 ─────────────────────────────────────────────────────
  { from: 'FAULT-NOZZLE-DAMAGE-001', to: 'TACIT-NOZZLE-INSTALL-001', type: 'REQUIRES' },
  { from: 'FAULT-NO-ATOMIZATION-001', to: 'TACIT-ASSEMBLY-JAR-LOAD-PA-001', type: 'REQUIRES' },
  { from: 'FAULT-NO-ATOMIZATION-001', to: 'TACIT-ASSEMBLY-VIAL-LOAD-UA-001', type: 'REQUIRES' },
  { from: 'FAULT-WEAK-ATOMIZATION-001', to: 'TACIT-ASSEMBLY-VIAL-LOAD-UA-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', to: 'TACIT-CLEANING-PROTOCOL-001', type: 'REQUIRES' },
  { from: 'FAULT-LEAK-ORING-001', to: 'TACIT-CLEANING-PROTOCOL-001', type: 'REQUIRES' },
  // ── KB-DOC-05 ─────────────────────────────────────────────────────
  { from: 'FAULT-SINTER-THERMAL-DAMAGE-001', to: 'TACIT-SINTER-SUBSTRATE-LIMIT-001', type: 'REQUIRES' },
  { from: 'FAULT-SINTER-INCOMPLETE-001', to: 'TACIT-SINTER-SUBSTRATE-LIMIT-001', type: 'REQUIRES' },
  { from: 'PROBE-SINTER-PARAMETERS-001', to: 'TACIT-SINTER-SUBSTRATE-LIMIT-001', type: 'PROBES' },
  { from: 'FAULT-SINTER-INCOMPLETE-001', to: 'TACIT-SINTER-RAMP-RATE-001', type: 'REQUIRES' },
  { from: 'FAULT-SINTER-THERMAL-DAMAGE-001', to: 'TACIT-SINTER-RAMP-RATE-001', type: 'REQUIRES' },
  { from: 'FAULT-SINTER-INCOMPLETE-001', to: 'TACIT-SINTER-RESISTANCE-001', type: 'REQUIRES' },
  { from: 'PROBE-SINTER-PARAMETERS-001', to: 'TACIT-SINTER-RESISTANCE-001', type: 'PROBES' },

  // ── Provisional edges — pending expert review (added 2026-04-14) ──────────
  // Inferred from KB-DOC-01 through KB-DOC-05 cross-reference index and domain
  // reasoning. Each connection is domain-plausible but has not been confirmed
  // by an expert interview. Review and adjust confidence during Session 2.

  // FAULT-CLOG-PARTIAL-001 — KEWB pressure trend is the real-time early warning;
  // PA jar wall shows complementary deposition-side signal
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-PARTIAL-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'REQUIRES' },

  // FAULT-CLOG-FULL-001 — full clog produces the "sudden jump and stays high" KEWB pattern;
  // diagnosis loop required to distinguish from upstream blockage
  { from: 'FAULT-CLOG-FULL-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },
  { from: 'FAULT-CLOG-FULL-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },

  // FAULT-ATOMIZER-001 — UA sound is the earliest diagnostic; PA jar wall for PA path;
  // systematic diagnosis loop needed to isolate atomizer from downstream faults
  { from: 'FAULT-ATOMIZER-001', to: 'TACIT-ATOMIZATION-SOUND-UA-001', type: 'REQUIRES' },
  { from: 'FAULT-ATOMIZER-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'REQUIRES' },
  { from: 'FAULT-ATOMIZER-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },

  // FAULT-SHEATH-GAS-001 — pressure drop pattern is the KEWB diagnostic signal for gas supply loss
  { from: 'FAULT-SHEATH-GAS-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },

  // FAULT-BLOB-FORMATION-001 — KEWB spike pattern is the real-time diagnostic cue
  { from: 'FAULT-BLOB-FORMATION-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'REQUIRES' },

  // FAULT-NO-ATOMIZATION-001 — PA jar wall is the direct visual diagnostic;
  // diagnosis loop for systematic isolation of cause
  { from: 'FAULT-NO-ATOMIZATION-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'REQUIRES' },
  { from: 'FAULT-NO-ATOMIZATION-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },

  // FAULT-WEAK-ATOMIZATION-001 — PA jar wall for PA path; diagnosis loop
  { from: 'FAULT-WEAK-ATOMIZATION-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'REQUIRES' },
  { from: 'FAULT-WEAK-ATOMIZATION-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },

  // FAULT-INK-DEGRADED-001 — ink quality assessment then diagnosis loop
  { from: 'FAULT-INK-DEGRADED-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'REQUIRES' },

  // FAULT-ESD-DAMAGE-001 — Zone 6 Safety in the pre-print checklist directly prevents this
  { from: 'FAULT-ESD-DAMAGE-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-STANDOFF-TOO-SMALL-001 — nozzle contact triggers immediate abort; nozzle inspection
  // required post-contact; checklist Zone 4 covers Z-height calibration
  { from: 'FAULT-STANDOFF-TOO-SMALL-001', to: 'TACIT-ABORT-DECISION-001', type: 'REQUIRES' },
  { from: 'FAULT-STANDOFF-TOO-SMALL-001', to: 'TACIT-NOZZLE-INSPECT-001', type: 'REQUIRES' },
  { from: 'FAULT-STANDOFF-TOO-SMALL-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-KEWB-FREEZE-001 — software freeze with active gas is an abort situation;
  // checklist Zone 3 Gas System and Zone 6 Safety are preventive
  { from: 'FAULT-KEWB-FREEZE-001', to: 'TACIT-ABORT-DECISION-001', type: 'REQUIRES' },
  { from: 'FAULT-KEWB-FREEZE-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-STAGE-HOME-FAIL-001 — checklist Zone 4 Stage includes stage readiness check
  { from: 'FAULT-STAGE-HOME-FAIL-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-GAS-SEQUENCE-WRONG-001 — checklist Zone 3 Gas System is the preventive intervention
  { from: 'FAULT-GAS-SEQUENCE-WRONG-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-CONTAMINATION-PRE-PRINT-001 — checklist Zone 4 substrate prep directly addresses this
  { from: 'FAULT-CONTAMINATION-PRE-PRINT-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-POOR-ADHESION-001 — checklist Zone 4 substrate prep is the preventive step
  { from: 'FAULT-POOR-ADHESION-001', to: 'TACIT-PREPRINT-CHECKLIST-001', type: 'REQUIRES' },

  // FAULT-DROPOUT-001 — PA jar wall shows atomization-side signal for dropout diagnosis
  { from: 'FAULT-DROPOUT-001', to: 'TACIT-ATOMIZATION-VISUAL-PA-001', type: 'REQUIRES' },

  // ── Probe → tacit coverage for the three probes that lacked background ──
  // PROBE-PRESSURE-INTERPRETATION-001: KEWB pressure reading is the tacit skill behind it
  { from: 'PROBE-PRESSURE-INTERPRETATION-001', to: 'TACIT-KEWB-PRESSURE-READ-001', type: 'PROBES' },
  { from: 'PROBE-PRESSURE-INTERPRETATION-001', to: 'TACIT-DIAGNOSIS-LOOP-001', type: 'PROBES' },
  // PROBE-TACIT-LINE-QUALITY-001: the canonical line-quality reference is its background
  { from: 'PROBE-TACIT-LINE-QUALITY-001', to: 'TACIT-LINE-QUALITY-REFERENCE-001', type: 'PROBES' },
  { from: 'PROBE-TACIT-LINE-QUALITY-001', to: 'TACIT-FOCUS-RATIO-001', type: 'PROBES' },
  // PROBE-ESD-PROTOCOL-001: newly-authored ESD handling discipline
  { from: 'PROBE-ESD-PROTOCOL-001', to: 'TACIT-ESD-HANDLING-001', type: 'PROBES' },
  { from: 'FAULT-ESD-DAMAGE-001', to: 'TACIT-ESD-HANDLING-001', type: 'REQUIRES' },
  { from: 'TACIT-ESD-HANDLING-001', to: 'HAZARD-ESD-001', type: 'REQUIRES' },
];
