/**
 * Knowledge-graph nodes + edges for the COLREG Collision Avoidance domain.
 * Models the give-way decision loop, the core Rules as TheoryReference nodes, the
 * key quantities (CPA/TCPA, safe speed, "substantial" alteration, safety margin),
 * the common non-compliant failure modes, and the correct actions. Reuses the
 * AJPNode / AJPEdge shape and node-type union.
 *
 * All rule text is paraphrased from the International Regulations for Preventing
 * Collisions at Sea (COLREG 1972); node sources cite the governing rule number.
 *
 * This file holds the core give-way decision loop (Rules 5–19). The remaining rules
 * of the full USCG "Navigation Rules, Amalgamated" rulebook — Part A general, narrow
 * channels & TSS, sailing vessels, lights/shapes, sound signals, exemptions,
 * verification, and Annexes I–V — live in ./amalgamated.ts and are merged into the
 * domain in ./index.ts.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

// ─── Rule references (TheoryReference) ────────────────────────────

export const colregRuleNodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-05',
    type: 'TheoryReference',
    content:
      'Rule 5 — Look-out: every vessel shall at all times maintain a proper look-out by sight and hearing as well as by all available means (including radar/ARPA) appropriate to the circumstances, so as to make a full appraisal of the situation and the risk of collision.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 5',
  },
  {
    id: 'RULE-COLREG-06',
    type: 'TheoryReference',
    content:
      'Rule 6 — Safe speed: every vessel shall at all times proceed at a safe speed so it can take proper and effective action to avoid collision and stop within a distance appropriate to the prevailing circumstances (visibility, traffic density, manoeuvrability, stopping distance, state of wind/sea, radar limitations, draft vs depth).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 6',
  },
  {
    id: 'RULE-COLREG-07',
    type: 'TheoryReference',
    content:
      'Rule 7 — Risk of collision: use all available means to determine if risk exists; assume it exists if in doubt. Risk shall be deemed to exist if the compass bearing of an approaching vessel does not appreciably change, and can exist even with an appreciable bearing change when approaching a very large vessel or a tow, or at close range.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7',
  },
  {
    id: 'RULE-COLREG-08',
    type: 'TheoryReference',
    content:
      'Rule 8 — Action to avoid collision: any action shall be positive, made in ample time, and with due regard to good seamanship. If there is sufficient sea-room, an alteration of course alone may be most effective — and it shall be large enough to be readily apparent to another vessel observing visually or by radar. A succession of small alterations should be avoided.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'RULE-COLREG-13',
    type: 'TheoryReference',
    content:
      'Rule 13 — Overtaking: any vessel overtaking another (coming up from more than 22.5° abaft the beam) shall keep out of the way of the vessel being overtaken, and remains the give-way vessel until finally past and clear. When in doubt whether you are overtaking, assume you are.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 13',
  },
  {
    id: 'RULE-COLREG-14',
    type: 'TheoryReference',
    content:
      'Rule 14 — Head-on situation: when two power-driven vessels meet on reciprocal or nearly reciprocal courses so as to involve risk of collision, each shall alter course to starboard so that each passes on the port side of the other.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 14',
  },
  {
    id: 'RULE-COLREG-15',
    type: 'TheoryReference',
    content:
      'Rule 15 — Crossing situation: when two power-driven vessels are crossing so as to involve risk of collision, the vessel which has the other on her own starboard side shall keep out of the way and shall, if the circumstances admit, avoid crossing ahead of the other vessel.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 15',
  },
  {
    id: 'RULE-COLREG-16',
    type: 'TheoryReference',
    content:
      'Rule 16 — Action by the give-way vessel: the vessel directed to keep out of the way shall, so far as possible, take early and substantial action to keep well clear.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 16',
  },
  {
    id: 'RULE-COLREG-17',
    type: 'TheoryReference',
    content:
      'Rule 17 — Action by the stand-on vessel: the stand-on vessel shall keep her course and speed, but may take action to avoid collision as soon as it becomes apparent the give-way vessel is not taking appropriate action, and shall take such action when collision cannot be avoided by the give-way vessel alone. A stand-on power-driven vessel taking action in a crossing shall, if the circumstances admit, not alter course to port for a vessel on her own port side.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 17',
  },
  {
    id: 'RULE-COLREG-18',
    type: 'TheoryReference',
    content:
      'Rule 18 — Responsibilities between vessels: a power-driven vessel shall, in general, keep out of the way of a vessel not under command, restricted in her ability to manoeuvre, engaged in fishing, or a sailing vessel (order per the Rule).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 18',
  },
  {
    id: 'RULE-COLREG-19',
    type: 'TheoryReference',
    content:
      'Rule 19 — Conduct in restricted visibility: proceed at a safe speed adapted to the conditions with engines ready. A vessel detecting another by radar alone shall determine if a close-quarters situation is developing and, if so, take avoiding action in ample time — avoiding an alteration to port for a vessel forward of the beam (other than one being overtaken), and an alteration toward a vessel abeam or abaft the beam.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 19',
  },
];

// ─── Key quantities / concepts (Parameter) ────────────────────────

export const colregParameterNodes: AJPNode[] = [
  {
    id: 'PARAM-COLREG-CPA-001',
    type: 'Parameter',
    content:
      'CPA (Closest Point of Approach) is the minimum range the two vessels will reach on present courses and speeds; TCPA is the time until that point. A steady compass bearing with decreasing range means CPA ≈ 0 — a collision course. CPA/TCPA are read from radar/ARPA or by taking repeated compass bearings.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7; standard radar plotting practice',
  },
  {
    id: 'PARAM-COLREG-SAFE-SPEED-001',
    type: 'Parameter',
    content:
      'Safe speed (Rule 6) is not a fixed number: it is the speed at which you can take effective avoiding action and stop in the distance appropriate to visibility, traffic, manoeuvrability, and radar performance. In restricted visibility it is materially lower than in clear weather.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 6',
  },
  {
    id: 'PARAM-COLREG-SUBSTANTIAL-001',
    type: 'Parameter',
    content:
      'A "substantial" alteration (Rule 8) is one large enough to be readily apparent to the other vessel by eye or by radar — in open water this typically means a bold course change (often on the order of 30° or more), made in one clear move rather than a creeping series of small changes.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'PARAM-COLREG-SAFETY-MARGIN-001',
    type: 'Parameter',
    content:
      'Passing distance should leave a safe margin — plan the manoeuvre to open CPA well beyond a bare miss (a common training rule of thumb is at least twice the minimum acceptable passing distance / ship-domain radius) so the situation stays safe even if the other vessel misjudges or does not act as expected.',
    confidence: 'Medium',
    source: 'IMO COLREG 1972, Rules 8 & 16; good-seamanship practice',
  },
];

// ─── Decision-loop steps (Step) ───────────────────────────────────

export const colregStepNodes: AJPNode[] = [
  {
    id: 'STEP-COLREG-LOOKOUT-001',
    type: 'Step',
    content: 'Maintain a proper look-out by sight, hearing, and radar; detect the other vessel and start tracking its bearing and range (Rule 5).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 5',
  },
  {
    id: 'STEP-COLREG-ASSESS-001',
    type: 'Step',
    content: 'Assess risk of collision: take repeated compass bearings / read CPA and TCPA. A steady bearing means risk exists (Rule 7).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7',
  },
  {
    id: 'STEP-COLREG-CLASSIFY-001',
    type: 'Step',
    content: 'Classify the encounter from the relative bearing and aspect: head-on (Rule 14), crossing (Rule 15), or overtaking (Rule 13); consider vessel-type responsibilities (Rule 18).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 13–15, 18',
  },
  {
    id: 'STEP-COLREG-ROLE-001',
    type: 'Step',
    content: 'Determine your role: give-way (Rule 16) or stand-on (Rule 17), based on the classification.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 16–17',
  },
  {
    id: 'STEP-COLREG-ACT-001',
    type: 'Step',
    content: 'Take early, substantial, positive action per the Rules — normally a bold alteration to starboard and/or a reduction of speed — and make it readily apparent (Rule 8).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'STEP-COLREG-MONITOR-001',
    type: 'Step',
    content: 'Monitor the effect: confirm CPA is opening and the bearing is drawing clear before assuming the situation is resolved.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'STEP-COLREG-RESUME-001',
    type: 'Step',
    content: 'When finally past and clear, resume passage — returning toward the intended track to minimise deviation once it is safe to do so.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
];

// ─── Failure modes (the scenario safety gates) ────────────────────

export const colregFaultNodes: AJPNode[] = [
  {
    id: 'FAULT-COLREG-SMALL-ALTERATION-001',
    type: 'FailureMode',
    content:
      'An alteration too small to be readily apparent, or a succession of small changes, so the other vessel cannot detect the intention by eye or radar. Violates Rule 8 and tends to produce a close-quarters situation.',
    safetyAlert: 'Alteration not readily apparent — make it bold and in one clear move.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8',
  },
  {
    id: 'FAULT-COLREG-ALTER-TO-PORT-001',
    type: 'FailureMode',
    content:
      'Altering course to port for a vessel crossing from your own starboard side. This turns into the other vessel’s likely path, is contrary to Rules 15/17, and is a classic collision cause.',
    safetyAlert: 'Do not alter to port for a crossing vessel on your starboard side.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 15, 17',
  },
  {
    id: 'FAULT-COLREG-STANDON-FAILS-001',
    type: 'FailureMode',
    content:
      'The stand-on vessel rigidly holds course and speed even though the give-way vessel is plainly not acting. Rule 17 permits action once that is apparent, and requires action when collision cannot be avoided by the give-way vessel alone.',
    safetyAlert: 'Stand-on is not "stand-on regardless" — you must act when the give-way vessel does not.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 17',
  },
  {
    id: 'FAULT-COLREG-EXCESS-SPEED-VIS-001',
    type: 'FailureMode',
    content:
      'Maintaining an unsafe speed for the visibility — e.g. proceeding at full sea speed in fog with only a radar contact. Violates Rules 6 and 19 and removes the time and stopping distance needed to avoid a contact detected late.',
    safetyAlert: 'Reduce to a safe speed in restricted visibility — you cannot see what you cannot avoid.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 6, 19',
  },
];

// ─── Corrective actions ───────────────────────────────────────────

export const colregActionNodes: AJPNode[] = [
  {
    id: 'ACTION-COLREG-ALTER-STARBOARD-001',
    type: 'CorrectiveAction',
    content: 'Alter course boldly to starboard so the change is readily apparent and opens CPA — the default avoiding action in head-on and most crossing give-way situations.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 8, 14, 15',
  },
  {
    id: 'ACTION-COLREG-REDUCE-SPEED-001',
    type: 'CorrectiveAction',
    content: 'Reduce speed, stop, or reverse to take way off — appropriate when sea-room is limited, in restricted visibility, or to reinforce an alteration (Rules 6, 8, 19).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 6, 8, 19',
  },
  {
    id: 'ACTION-COLREG-SOUND-SIGNAL-001',
    type: 'CorrectiveAction',
    content: 'Use the prescribed manoeuvring/warning sound signals; sound at least five short and rapid blasts if in doubt about the other vessel’s intentions or actions (Rule 34).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 34',
  },
];

// ─── Tacit knowledge ──────────────────────────────────────────────
// The seamanship "why" behind the rules — the interpretation and judgement an
// experienced watchkeeper brings, surfaced as Socratic background context.

export const colregTacitNodes: AJPNode[] = [
  {
    id: 'TACIT-COLREG-CBDR-001',
    type: 'TacitKnowledge',
    content:
      'Constant bearing, decreasing range (CBDR) is the master signal of collision risk. ' +
      'Take a series of compass bearings of the other vessel; if the bearing holds steady while she grows larger, you are on a collision course and must act — you do not need a plot to know it. ' +
      'A bearing that draws appreciably is reassuring, but not proof of safety when the other vessel is very large, is a tow, or is close aboard. ' +
      'Almost every collision at sea began as an unremarked CBDR (Rule 7).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7 · seamanship practice (CBDR) · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-STARBOARD-BIAS-001',
    type: 'TacitKnowledge',
    content:
      'Why the Rules push almost every action to starboard: predictability is itself the safety property. ' +
      'In a head-on both vessels turn to starboard and pass port-to-port; a give-way vessel turns to starboard and passes astern. ' +
      'The danger of a port turn is that it steers into where the other vessel will go if she does the expected starboard thing — two “reasonable” turns that close on each other. ' +
      'Altering to starboard is doing what the other bridge is entitled to expect of you, even with no radio call and no exchange of intentions (Rules 14–17).',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 14–17 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-BOLD-ALTERATION-001',
    type: 'TacitKnowledge',
    content:
      'An avoiding action must be big enough to be obvious — by eye and on the other vessel’s radar (Rule 8b). ' +
      'A 5–10° nudge barely changes your visual aspect or the slow radar picture; it reads as normal yawing, not a decision, and leaves the other bridge guessing. ' +
      'One deliberate alteration of 30° or more, made early and held, is unmistakable and lets her plan around you. ' +
      'A succession of small changes is the classic ambiguous action the Rule forbids — each one too small to see, the sum impossible to read.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-COURSE-OVER-SPEED-001',
    type: 'TacitKnowledge',
    content:
      'With sea room, a bold course alteration usually beats a speed change. ' +
      'A turn is instantly visible by eye and shows at once as a changed heading on radar; a speed reduction is nearly invisible to the other vessel until the range rate slowly changes, which for a large ship takes minutes and miles. ' +
      'So course alone is often the more “readily apparent” action Rule 8 wants — provided it is early, substantial, and does not simply set up a new close-quarters situation with a third vessel. ' +
      'Slowing or stopping is the tool when there is no room to turn or the situation is already close.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 8 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-PASS-ASTERN-001',
    type: 'TacitKnowledge',
    content:
      'The give-way vessel’s safe geometry is to pass astern, not to cross ahead. ' +
      'Aiming to go under the other vessel’s stern points you at where she is leaving, so any error in your estimate of her speed only opens the gap; crossing ahead points you at where she is going, so the same error closes it — and if she then acts too, you meet. ' +
      'Alter to starboard early and enough that your intention to pass astern is plain (Rules 15–16). ' +
      '“I can just make it across” is the reasoning behind a large share of crossing collisions.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 15–16 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-STANDON-ESCALATION-001',
    type: 'TacitKnowledge',
    content:
      '“Stand-on” is a duty to be predictable, not a right to hold course into a collision (Rule 17). ' +
      'It escalates in stages: first keep course and speed so the give-way vessel can plan around you; then you may act when it is apparent she is not keeping clear; then you must act when collision cannot be avoided by her action alone. ' +
      'The hard skill is judging the moment to break stand-on — too soon undermines the predictability the Rules depend on, too late throws away your options. ' +
      'When you do act in a crossing, do not alter to port for a vessel on your own port side.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 17 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-SAFE-SPEED-001',
    type: 'TacitKnowledge',
    content:
      'Safe speed is not a number, it is a stopping-distance argument (Rule 6). ' +
      'It is any speed at which you can still take effective avoiding action and stop within a distance suited to the conditions — so it falls with reduced visibility, dense traffic, a crowded radar picture, poor maneuverability or a heavy sea. ' +
      'The fog test is simple: you must be able to react inside the distance at which you can detect. ' +
      'Having “right of way” changes none of this — a stand-on vessel proceeding at unsafe speed is still at fault.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 6 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-RESTRICTED-VIS-001',
    type: 'TacitKnowledge',
    content:
      'In restricted visibility there is no stand-on and no give-way — vessels detect each other by radar and both are equally bound to act (Rule 19). ' +
      'Two alterations are traps: do not turn to port for a vessel forward of your beam (except one you are overtaking), because she may be altering to starboard into you; and do not turn toward a vessel abeam or abaft the beam. ' +
      'Favor a bold alteration to starboard, or take speed off. ' +
      'A fog signal heard forward of the beam, or a close-quarters situation you cannot avoid by a turn, calls for reducing to bare steerageway or stopping.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 19 · seamanship practice · v1.0-2026-08-05',
  },
  {
    id: 'TACIT-COLREG-RADAR-PLOTTING-001',
    type: 'TacitKnowledge',
    content:
      'Use radar systematically or not at all (Rule 7). ' +
      'A single glance at a blip is “scanty radar information” — it breeds assumption, and the Rules warn against acting on it. ' +
      'Proper use means long-range scanning and plotting (or ARPA) to get each contact’s CPA, TCPA, and true course and speed, so you can pick an alteration that actually opens CPA without setting up a new close-quarters situation with a third ship. ' +
      'The plot is also what tells you a slow-drawing bearing can still mean risk when the range is closing fast.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rule 7 · seamanship practice · v1.0-2026-08-05',
  },
];

// ─── Combined node list ───────────────────────────────────────────

export const colregGraphNodes: AJPNode[] = [
  ...colregRuleNodes,
  ...colregParameterNodes,
  ...colregStepNodes,
  ...colregFaultNodes,
  ...colregActionNodes,
  ...colregTacitNodes,
];

// ─── Edges ────────────────────────────────────────────────────────

export const colregGraphEdges: AJPEdge[] = [
  // Decision loop order
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'STEP-COLREG-ASSESS-001', type: 'NEXT_STEP' },
  { from: 'STEP-COLREG-ASSESS-001', to: 'STEP-COLREG-CLASSIFY-001', type: 'NEXT_STEP' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'STEP-COLREG-ROLE-001', type: 'NEXT_STEP' },
  { from: 'STEP-COLREG-ROLE-001', to: 'STEP-COLREG-ACT-001', type: 'NEXT_STEP' },
  { from: 'STEP-COLREG-ACT-001', to: 'STEP-COLREG-MONITOR-001', type: 'NEXT_STEP' },
  { from: 'STEP-COLREG-MONITOR-001', to: 'STEP-COLREG-RESUME-001', type: 'NEXT_STEP' },
  // Steps grounded in the rules
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'RULE-COLREG-05', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ASSESS-001', to: 'RULE-COLREG-07', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ASSESS-001', to: 'PARAM-COLREG-CPA-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-14', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-15', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-13', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ROLE-001', to: 'RULE-COLREG-16', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ROLE-001', to: 'RULE-COLREG-17', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ACT-001', to: 'RULE-COLREG-08', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-ACT-001', to: 'PARAM-COLREG-SUBSTANTIAL-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-ACT-001', to: 'PARAM-COLREG-SAFETY-MARGIN-001', type: 'REQUIRES' },
  // Safe speed governs the whole loop
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'RULE-COLREG-06', type: 'SUPPORTED_BY' },
  { from: 'RULE-COLREG-06', to: 'PARAM-COLREG-SAFE-SPEED-001', type: 'REQUIRES' },
  // Correct actions fix the failure modes
  { from: 'FAULT-COLREG-SMALL-ALTERATION-001', to: 'ACTION-COLREG-ALTER-STARBOARD-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-ALTER-TO-PORT-001', to: 'ACTION-COLREG-ALTER-STARBOARD-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-STANDON-FAILS-001', to: 'ACTION-COLREG-ALTER-STARBOARD-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', to: 'ACTION-COLREG-REDUCE-SPEED-001', type: 'FIXED_BY' },
  // Faults violate specific rules
  { from: 'FAULT-COLREG-SMALL-ALTERATION-001', to: 'RULE-COLREG-08', type: 'INDICATES' },
  { from: 'FAULT-COLREG-ALTER-TO-PORT-001', to: 'RULE-COLREG-15', type: 'INDICATES' },
  { from: 'FAULT-COLREG-STANDON-FAILS-001', to: 'RULE-COLREG-17', type: 'INDICATES' },
  { from: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', to: 'RULE-COLREG-19', type: 'INDICATES' },
  // Fault → consequence chains
  { from: 'FAULT-COLREG-ALTER-TO-PORT-001', to: 'CONSEQUENCE-COLREG-COLLISION-001', type: 'CAUSES' },
  { from: 'FAULT-COLREG-STANDON-FAILS-001', to: 'CONSEQUENCE-COLREG-COLLISION-001', type: 'CAUSES' },
  { from: 'FAULT-COLREG-SMALL-ALTERATION-001', to: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001', type: 'CAUSES' },
  { from: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', to: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001', type: 'CAUSES' },
  // Tacit seamanship grounded in the underlying rule (tacit → TheoryReference)
  { from: 'TACIT-COLREG-CBDR-001', to: 'RULE-COLREG-07', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-RADAR-PLOTTING-001', to: 'RULE-COLREG-07', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-STARBOARD-BIAS-001', to: 'RULE-COLREG-14', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-BOLD-ALTERATION-001', to: 'RULE-COLREG-08', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-COURSE-OVER-SPEED-001', to: 'RULE-COLREG-08', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-PASS-ASTERN-001', to: 'RULE-COLREG-15', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-STANDON-ESCALATION-001', to: 'RULE-COLREG-17', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-SAFE-SPEED-001', to: 'RULE-COLREG-06', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-RESTRICTED-VIS-001', to: 'RULE-COLREG-19', type: 'SUPPORTED_BY' },
  // Failure modes / steps that each tacit concept explains (fault/step → tacit)
  { from: 'FAULT-COLREG-SMALL-ALTERATION-001', to: 'TACIT-COLREG-BOLD-ALTERATION-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-ALTER-TO-PORT-001', to: 'TACIT-COLREG-STARBOARD-BIAS-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-ALTER-TO-PORT-001', to: 'TACIT-COLREG-PASS-ASTERN-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-STANDON-FAILS-001', to: 'TACIT-COLREG-STANDON-ESCALATION-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', to: 'TACIT-COLREG-SAFE-SPEED-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-EXCESS-SPEED-VIS-001', to: 'TACIT-COLREG-RESTRICTED-VIS-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-ASSESS-001', to: 'TACIT-COLREG-CBDR-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'TACIT-COLREG-RADAR-PLOTTING-001', type: 'REQUIRES' },
];
