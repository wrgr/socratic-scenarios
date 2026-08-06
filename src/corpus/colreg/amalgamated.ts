/**
 * Amalgamated Navigation Rules expansion for the COLREG Collision Avoidance domain.
 *
 * The base build (`nodes.ts`) models the give-way decision loop and the core
 * steering-and-sailing rules (5–19). This module extends the knowledge graph to
 * the *full* rulebook as published in the U.S. Coast Guard "Navigation Rules,
 * Amalgamated" edition, which interleaves the International Regulations for
 * Preventing Collisions at Sea (72 COLREGS) with the U.S. Inland Navigation Rules
 * (33 CFR Subchapter E). It adds:
 *
 *   • Part A — General (Rules 1–3)
 *   • Part B — the remaining steering/sailing rules (4, 9, 10, 11, 12)
 *   • Part C — Lights and Shapes (20–31)
 *   • Part D — Sound and Light Signals (32–37)
 *   • Part E — Exemptions (38)
 *   • Part F — Verification of Compliance (39–41)
 *   • Annexes I–V
 *
 * plus the operational quantities, tacit seamanship, failure modes, and corrective
 * actions those rules introduce. Where the International and Inland texts diverge,
 * the difference is called out in the node content and the source cites the
 * amalgamated edition.
 *
 * All rule text is PARAPHRASED (per repo sourcing policy — never ship raw source
 * text); each node cites the governing rule number in the amalgamated edition.
 * Source: USCG Navigation Rules, Amalgamated —
 * https://www.navcen.uscg.gov/navigation-rules-amalgamated
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

const AMALG = 'USCG Navigation Rules (Amalgamated) — 72 COLREGS & 33 CFR Subchapter E (Inland)';
const VER = 'v1.0-2026-08-06';

// ─── Part A — General (Rules 1–3) ─────────────────────────────────

export const colregPartANodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-01',
    type: 'TheoryReference',
    content:
      'Rule 1 — Application: the Rules apply to all vessels upon the high seas and connected navigable waters. The International Rules govern seaward of the COLREGS Demarcation Lines; the U.S. Inland Rules govern shoreward of them. Special rules made by an appropriate authority for roadsteads, harbours, rivers, lakes, or inland waterways must conform as closely as possible to these Rules.',
    confidence: 'High',
    source: `${AMALG}, Rule 1`,
  },
  {
    id: 'RULE-COLREG-02',
    type: 'TheoryReference',
    content:
      'Rule 2 — Responsibility: nothing in the Rules exonerates any vessel (or her owner, master, or crew) from the consequences of neglecting to comply, or of neglecting any precaution required by the ordinary practice of seamen or by the special circumstances of the case. Rule 2(b) — the "general prudential rule" — allows a departure from the Rules when necessary to avoid immediate danger.',
    confidence: 'High',
    source: `${AMALG}, Rule 2`,
  },
  {
    id: 'RULE-COLREG-03',
    type: 'TheoryReference',
    content:
      'Rule 3 — General definitions: defines the terms the Rules use — "vessel", "power-driven vessel", "sailing vessel", "vessel engaged in fishing" (with gear that restricts manoeuvrability), "seaplane", "vessel not under command" (NUC), "vessel restricted in her ability to manoeuvre" (RAM), "vessel constrained by her draught" (International), "underway" (not at anchor, made fast to the shore, or aground), "length and breadth", "in sight of one another", "restricted visibility", and (Inland) "Western Rivers", "Great Lakes", and "vessel engaged in dredging or underwater operations".',
    confidence: 'High',
    source: `${AMALG}, Rule 3`,
  },
];

// ─── Part B §I — remaining conduct-in-any-visibility rules ────────

export const colregPartBNodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-04',
    type: 'TheoryReference',
    content:
      'Rule 4 — Application (Section I): Rules 4 through 10 apply in any condition of visibility. These are the look-out, safe-speed, risk-assessment, avoiding-action, narrow-channel, and traffic-separation rules that govern whether or not the vessels are in sight of one another.',
    confidence: 'High',
    source: `${AMALG}, Rule 4`,
  },
  {
    id: 'RULE-COLREG-09',
    type: 'TheoryReference',
    content:
      'Rule 9 — Narrow channels: keep as near to the outer limit of the channel or fairway which lies on your starboard side as is safe and practicable. A vessel of less than 20 m, a sailing vessel, or a vessel engaged in fishing shall not impede a vessel that can safely navigate only within the channel; nor shall any vessel cross a narrow channel if that impedes such a vessel. Avoid anchoring in a narrow channel. Inland: a downbound vessel on the Great Lakes / Western Rivers with a following current has the right of way over an upbound vessel and initiates the manoeuvring signals under Rule 34(a)(i).',
    confidence: 'High',
    source: `${AMALG}, Rule 9`,
  },
  {
    id: 'RULE-COLREG-10',
    type: 'TheoryReference',
    content:
      'Rule 10 — Traffic separation schemes: a vessel using a TSS adopted by IMO shall proceed in the appropriate traffic lane in the general direction of flow, keep clear of the separation line or zone, and normally join or leave a lane at its termination or at as small an angle as practicable. A vessel crossing traffic lanes shall do so on a heading as nearly as practicable at right angles to the direction of flow. Vessels under 20 m, sailing vessels, and fishing vessels shall not impede the safe passage of a power-driven vessel following a lane.',
    confidence: 'High',
    source: `${AMALG}, Rule 10`,
  },
  {
    id: 'RULE-COLREG-11',
    type: 'TheoryReference',
    content:
      'Rule 11 — Application (Section II): Rules 11 through 18 apply to vessels in sight of one another. The give-way / stand-on role rules (13–18) operate only when the vessels can see each other visually; in restricted visibility Rule 19 governs instead.',
    confidence: 'High',
    source: `${AMALG}, Rule 11`,
  },
  {
    id: 'RULE-COLREG-12',
    type: 'TheoryReference',
    content:
      'Rule 12 — Sailing vessels: when two sailing vessels approach so as to involve risk of collision, (i) when each has the wind on a different side, the vessel with the wind on the port side keeps out of the way; (ii) when both have the wind on the same side, the vessel to windward keeps out of the way of the vessel to leeward; (iii) a vessel with the wind on the port side that sees a vessel to windward and cannot tell which tack she is on shall keep out of the way. The windward side is the side opposite that on which the mainsail is carried.',
    confidence: 'High',
    source: `${AMALG}, Rule 12`,
  },
];

// ─── Part C — Lights and Shapes (Rules 20–31) ─────────────────────

export const colregPartCNodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-20',
    type: 'TheoryReference',
    content:
      'Rule 20 — Application (lights and shapes): the light rules apply in all weathers and shall be complied with from sunset to sunrise, and also from sunrise to sunset in restricted visibility. The shape rules apply by day. Lights required by the Rules shall be exhibited whenever visibility so requires and may be shown at other times.',
    confidence: 'High',
    source: `${AMALG}, Rule 20`,
  },
  {
    id: 'RULE-COLREG-21',
    type: 'TheoryReference',
    content:
      'Rule 21 — Definitions of lights: "masthead light" = a white light over the fore-and-aft centreline showing an unbroken 225° arc from right ahead to 22.5° abaft the beam each side; "sidelights" = green to starboard and red to port, each a 112.5° arc from ahead to 22.5° abaft the beam; "sternlight" = white, 135° centred on right astern; "towing light" = yellow with the same characteristics as a sternlight; "all-round light" = 360°; "flashing light" = 120+ flashes per minute.',
    confidence: 'High',
    source: `${AMALG}, Rule 21`,
  },
  {
    id: 'RULE-COLREG-22',
    type: 'TheoryReference',
    content:
      'Rule 22 — Visibility of lights: minimum luminous ranges depend on vessel length. For vessels 50 m or more — masthead 6 miles, sidelights 3, sternlight/towing/all-round 3. For 12 m up to 50 m — masthead 5 (3 if under 20 m), sidelights 2, others 2. For under 12 m — masthead 2, sidelights 1, others 2.',
    confidence: 'High',
    source: `${AMALG}, Rule 22`,
  },
  {
    id: 'RULE-COLREG-23',
    type: 'TheoryReference',
    content:
      'Rule 23 — Power-driven vessels underway: exhibit a forward masthead light, a second masthead light abaft and higher (vessels 50 m or more; optional under 50 m), sidelights, and a sternlight. A power-driven vessel under 12 m may instead show an all-round white light and sidelights; under 7 m and under 7 knots, an all-round white light (and sidelights if practicable).',
    confidence: 'High',
    source: `${AMALG}, Rule 23`,
  },
  {
    id: 'RULE-COLREG-24',
    type: 'TheoryReference',
    content:
      'Rule 24 — Towing and pushing: a vessel towing astern shows two masthead lights in a vertical line (three when the tow length exceeds 200 m), sidelights, a sternlight, a towing light above the sternlight, and — if the tow is over 200 m — a diamond shape by day. The vessel being towed shows sidelights and a sternlight (and a diamond if over 200 m). Composite units and vessels pushing ahead / towing alongside have their own configurations. Inland: a vessel being pushed ahead (not part of a composite unit) is lit at its forward end with sidelights and a "special flashing light" — yellow, flashing 50–70 times per minute; Western Rivers exceptions apply under Rule 24(j).',
    confidence: 'High',
    source: `${AMALG}, Rule 24`,
  },
  {
    id: 'RULE-COLREG-25',
    type: 'TheoryReference',
    content:
      'Rule 25 — Sailing vessels underway and vessels under oars: a sailing vessel shows sidelights and a sternlight; a vessel under 20 m may combine these in one lantern at the masthead. She may additionally show two all-round lights at the masthead, red over green ("red over green, sailing machine") — but not together with the combined lantern. A sailing vessel also proceeding under power is a power-driven vessel and by day shows a cone point-down forward.',
    confidence: 'High',
    source: `${AMALG}, Rule 25`,
  },
  {
    id: 'RULE-COLREG-26',
    type: 'TheoryReference',
    content:
      'Rule 26 — Fishing vessels: a vessel trawling shows two all-round lights in a vertical line, green over white, plus a masthead light abaft and higher (optional under 50 m), and, when making way, sidelights and a sternlight. A vessel engaged in fishing other than trawling shows red over white ("red over white, fishing at night") and, if her gear extends more than 150 m horizontally, a white all-round light or cone toward the gear. By day the shape is two cones apex to apex.',
    confidence: 'High',
    source: `${AMALG}, Rule 26`,
  },
  {
    id: 'RULE-COLREG-27',
    type: 'TheoryReference',
    content:
      'Rule 27 — Vessels not under command (NUC) or restricted in their ability to manoeuvre (RAM): a NUC shows two all-round red lights in a vertical line ("red over red, the captain is dead") and, when making way, sidelights and a sternlight; by day, two balls. A RAM shows red-white-red all-round in a vertical line and, by day, ball-diamond-ball. Vessels towing a tow that severely restricts them, dredging (with obstruction/clear side marks), diving, mineclearance, and similar operations carry the RAM configuration with the prescribed additions.',
    confidence: 'High',
    source: `${AMALG}, Rule 27`,
  },
  {
    id: 'RULE-COLREG-28',
    type: 'TheoryReference',
    content:
      'Rule 28 — Vessels constrained by their draught (International only): a power-driven vessel constrained by her draught may, in addition to the lights for a power-driven vessel underway, exhibit three all-round red lights in a vertical line, or a cylinder by day. In the U.S. Inland Rules this rule is Reserved — there is no draught-constrained signal inland.',
    confidence: 'High',
    source: `${AMALG}, Rule 28 (International; Inland: Reserved)`,
  },
  {
    id: 'RULE-COLREG-29',
    type: 'TheoryReference',
    content:
      'Rule 29 — Pilot vessels: a vessel on pilotage duty shows at or near the masthead two all-round lights in a vertical line, white over red ("white over red, pilot ahead"), plus sidelights and a sternlight when underway, or the anchor light(s) when at anchor.',
    confidence: 'High',
    source: `${AMALG}, Rule 29`,
  },
  {
    id: 'RULE-COLREG-30',
    type: 'TheoryReference',
    content:
      'Rule 30 — Anchored vessels and vessels aground: a vessel at anchor shows a forward all-round white light (and a second aft for vessels 50 m or more), or a ball by day. A vessel aground shows the anchor light(s) plus two all-round red lights in a vertical line, or three balls by day. Vessels under 7 m not near a channel/anchorage/where others navigate need not show anchor lights.',
    confidence: 'High',
    source: `${AMALG}, Rule 30`,
  },
  {
    id: 'RULE-COLREG-31',
    type: 'TheoryReference',
    content:
      'Rule 31 — Seaplanes: where a seaplane or WIG (wing-in-ground) craft cannot exhibit lights and shapes of the characteristics or in the positions prescribed, she shall exhibit lights and shapes as closely similar as possible.',
    confidence: 'High',
    source: `${AMALG}, Rule 31`,
  },
];

// ─── Part D — Sound and Light Signals (Rules 32–37) ───────────────

export const colregPartDNodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-32',
    type: 'TheoryReference',
    content:
      'Rule 32 — Definitions (signals): "whistle" = any sound-signalling appliance capable of producing the prescribed blasts; "short blast" = about one second; "prolonged blast" = four to six seconds.',
    confidence: 'High',
    source: `${AMALG}, Rule 32`,
  },
  {
    id: 'RULE-COLREG-33',
    type: 'TheoryReference',
    content:
      'Rule 33 — Equipment for sound signals: a vessel 12 m or more shall carry a whistle; 20 m or more, also a bell; 100 m or more, also a gong (of a tone not confusable with the bell). Smaller vessels must at least carry some means of making an efficient sound signal.',
    confidence: 'High',
    source: `${AMALG}, Rule 33`,
  },
  {
    id: 'RULE-COLREG-34',
    type: 'TheoryReference',
    content:
      'Rule 34 — Manoeuvring and warning signals: International — a power-driven vessel in sight of another signals the manoeuvre she is taking: one short blast "I am altering to starboard", two short "I am altering to port", three short "I am operating astern propulsion". Inland — the whistle signals intent and passing agreement: one short "I intend to leave you on my port side", two short "…on my starboard side". The doubt/danger signal is at least five short and rapid blasts. Vessels nearing a bend where an approaching vessel may be obscured sound one prolonged blast, answered by one prolonged blast.',
    confidence: 'High',
    source: `${AMALG}, Rule 34`,
  },
  {
    id: 'RULE-COLREG-35',
    type: 'TheoryReference',
    content:
      'Rule 35 — Sound signals in restricted visibility (in or near, day or night): a power-driven vessel making way sounds one prolonged blast every ≤2 minutes; stopped and making no way, two prolonged blasts. A vessel NUC/RAM/constrained by draught/sailing/fishing/towing sounds one prolonged plus two short blasts. A vessel towed (or the last if manned) sounds one prolonged plus three short. A vessel at anchor rings the bell rapidly ~5 seconds every ≤1 minute (with the gong aft if 100 m or more); aground adds three separate bell strokes before and after.',
    confidence: 'High',
    source: `${AMALG}, Rule 35`,
  },
  {
    id: 'RULE-COLREG-36',
    type: 'TheoryReference',
    content:
      'Rule 36 — Signals to attract attention: a vessel may make light or sound signals that cannot be mistaken for any signal authorised elsewhere in the Rules, or direct the beam of a searchlight toward a danger, so as not to embarrass another vessel. High-intensity intermittent or revolving lights (e.g. strobes) are to be avoided as attention signals.',
    confidence: 'High',
    source: `${AMALG}, Rule 36`,
  },
  {
    id: 'RULE-COLREG-37',
    type: 'TheoryReference',
    content:
      'Rule 37 — Distress signals: when a vessel is in distress and requires assistance she uses or exhibits the signals described in Annex IV — e.g. a continuous sounding of a fog-signalling apparatus, red flares/rockets, "SOS" by any method, "MAYDAY" by radiotelephone, the flag signal NC, a square flag with a ball above or below, and orange smoke.',
    confidence: 'High',
    source: `${AMALG}, Rule 37`,
  },
];

// ─── Parts E & F — Exemptions and Verification (Rules 38–41) ──────

export const colregPartEFNodes: AJPNode[] = [
  {
    id: 'RULE-COLREG-38',
    type: 'TheoryReference',
    content:
      'Rule 38 — Exemptions: a vessel (or class) whose keel was laid before the Rules entered into force, and which complies with the earlier 1960 Collision Regulations, may be granted time-limited exemptions from certain light-positioning, sound-appliance, and technical requirements while she is repositioned to conform.',
    confidence: 'Medium',
    source: `${AMALG}, Rule 38`,
  },
  {
    id: 'RULE-COLREG-39',
    type: 'TheoryReference',
    content:
      'Rule 39 — Definitions (Part F, Verification of Compliance): defines the audit, the Code for Implementation of IMO Instruments (III Code), and the Organization’s audit standard used to verify that a State gives effect to the Convention.',
    confidence: 'Medium',
    source: `${AMALG}, Rule 39`,
  },
  {
    id: 'RULE-COLREG-40',
    type: 'TheoryReference',
    content:
      'Rule 40 — Application (Part F): Contracting Parties shall use the provisions of the III Code in the performance of their obligations under the Convention. Part F is an administrative/State-level part, not a shiphandling rule.',
    confidence: 'Medium',
    source: `${AMALG}, Rule 40`,
  },
  {
    id: 'RULE-COLREG-41',
    type: 'TheoryReference',
    content:
      'Rule 41 — Verification of compliance: each Contracting Party is subject to periodic audit by the Organization against the audit standard to verify implementation and enforcement of the Convention.',
    confidence: 'Medium',
    source: `${AMALG}, Rule 41`,
  },
];

// ─── Annexes I–V ──────────────────────────────────────────────────

export const colregAnnexNodes: AJPNode[] = [
  {
    id: 'ANNEX-COLREG-I',
    type: 'TheoryReference',
    content:
      'Annex I — Positioning and technical details of lights and shapes: prescribes the exact vertical spacing and heights of masthead lights, the horizontal separation of forward/after masthead lights, the positions of sidelights and all-round lights, screening of sidelights, and the dimensions and spacing of shapes (balls, cones, cylinders, diamonds — a ball is at least 0.6 m in diameter).',
    confidence: 'Medium',
    source: `${AMALG}, Annex I`,
  },
  {
    id: 'ANNEX-COLREG-II',
    type: 'TheoryReference',
    content:
      'Annex II — Additional signals for fishing vessels fishing in close proximity: extra all-round lights in a vertical line — two white for shooting their nets, white over red for hauling their nets, and two red when the nets have come fast upon an obstruction — so vessels working together can read each other’s operation.',
    confidence: 'Medium',
    source: `${AMALG}, Annex II`,
  },
  {
    id: 'ANNEX-COLREG-III',
    type: 'TheoryReference',
    content:
      'Annex III — Technical details of sound signal appliances: the fundamental frequencies, sound-pressure levels, and audibility ranges required of whistles by vessel length, and the construction of bells and gongs.',
    confidence: 'Medium',
    source: `${AMALG}, Annex III`,
  },
  {
    id: 'ANNEX-COLREG-IV',
    type: 'TheoryReference',
    content:
      'Annex IV — Distress signals: the authoritative list of signals indicating distress and need of assistance, used or exhibited together or separately, referenced by Rule 37 (gun/explosive signals at ~1-minute intervals, continuous fog-apparatus sound, rockets/flares, SOS, MAYDAY, NC flag, square-flag-and-ball, flames, orange smoke, slowly raising and lowering outstretched arms, EPIRB, and approved radio signals).',
    confidence: 'High',
    source: `${AMALG}, Annex IV`,
  },
  {
    id: 'ANNEX-COLREG-V',
    type: 'TheoryReference',
    content:
      'Annex V — Pilot Rules (U.S. Inland only): additional U.S. requirements not in the International Rules — e.g. a law-enforcement vessel may display a flashing blue light, and a public-safety vessel an alternating red-and-yellow light, when engaged on their duties. There is no International equivalent.',
    confidence: 'Medium',
    source: `${AMALG}, Annex V (Inland only)`,
  },
];

// ─── Key quantities / concepts introduced by the added rules ──────

export const colregAmalgParameterNodes: AJPNode[] = [
  {
    id: 'PARAM-COLREG-INLAND-INTL-001',
    type: 'Parameter',
    content:
      'Which rulebook applies is set by geography: the International Rules (72 COLREGS) apply seaward of the COLREGS Demarcation Lines; the U.S. Inland Rules (33 CFR Subchapter E) apply shoreward of them, on the Great Lakes, and on the Western Rivers. The amalgamated edition prints both so the differences are visible side by side — most numbered rules are identical, but signals (Rule 34), some right-of-way on rivers (Rules 9, 14, 15), a few lights (Rules 23, 24), Rule 28, and Annex V differ.',
    confidence: 'High',
    source: `${AMALG}, Rule 1`,
  },
  {
    id: 'PARAM-COLREG-LIGHT-ARCS-001',
    type: 'Parameter',
    content:
      'Navigation-light arcs encode a vessel’s aspect. Masthead light: 225° (right ahead to 22.5° abaft each beam). Each sidelight: 112.5° (ahead to 22.5° abaft its beam) — green to starboard, red to port. Sternlight: 135° centred astern. Together the sidelights + sternlight cover the full 360°, and the boundary between a sidelight and the sternlight (22.5° abaft the beam) is exactly the overtaking cut-off of Rule 13.',
    confidence: 'High',
    source: `${AMALG}, Rules 21, 22`,
  },
  {
    id: 'PARAM-COLREG-DAY-SHAPES-001',
    type: 'Parameter',
    content:
      'Day shapes (black): a ball = at anchor (Rule 30); a cone point-down = a sailing vessel also under power (Rule 25) or, apex-together as two cones, a fishing vessel (Rule 26); a cylinder = constrained by draught (Rule 28, International); a diamond = a tow exceeding 200 m (Rule 24); ball-diamond-ball = restricted in ability to manoeuvre (Rule 27); two balls = not under command; three balls = aground.',
    confidence: 'High',
    source: `${AMALG}, Rules 24–30`,
  },
  {
    id: 'PARAM-COLREG-SOUND-SIGNALS-001',
    type: 'Parameter',
    content:
      'Sound-signal vocabulary: a short blast is ~1 s, a prolonged blast 4–6 s (Rule 32). In sight (Rule 34) the blasts mean manoeuvre (International) or intent (Inland); the doubt/danger signal is five or more short rapid blasts. In restricted visibility (Rule 35) a power-driven vessel making way sounds one prolonged blast ≤ every 2 min, stopped two prolonged; a hampered/sailing/fishing/towing vessel one prolonged + two short; a vessel at anchor rings the bell for ~5 s every ≤1 min.',
    confidence: 'High',
    source: `${AMALG}, Rules 32, 34, 35`,
  },
];

// ─── Tacit seamanship for the added rules ─────────────────────────

export const colregAmalgTacitNodes: AJPNode[] = [
  {
    id: 'TACIT-COLREG-LIGHT-READING-001',
    type: 'TacitKnowledge',
    content:
      'At night you fly by the lights: the pattern tells you the other vessel’s type, size, aspect, and what she is doing before you can see her hull. ' +
      'Sidelight colour gives aspect at a glance — see her green and you are looking up her starboard side; see red and green together she is nearly bow-on. ' +
      'Vertical pairs of all-round lights are the "who am I" code — red over red not under command, red over white a fisherman, green over white a trawler, white over red a pilot, red-white-red restricted in ability to manoeuvre. ' +
      'A second, higher masthead light aft means a bigger power-driven vessel (50 m or more) and shows you her heading. ' +
      'Misreading the lights means applying the wrong rule to the wrong vessel — the recognition has to be automatic.',
    confidence: 'High',
    source: `${AMALG}, Rules 21–30 · seamanship practice · ${VER}`,
  },
  {
    id: 'TACIT-COLREG-NARROW-CHANNEL-001',
    type: 'TacitKnowledge',
    content:
      'A narrow channel rewrites the ordinary give-way logic (Rule 9). ' +
      'Everyone keeps to the starboard side of the channel, like a road, so meeting traffic passes port-to-port by default. ' +
      'The deep-draught ship that can only stay in the dredged water has effective priority: a vessel under 20 m, a sailing vessel, or one fishing "shall not impede" her, and you do not cross ahead of her if it forces her to check for you. ' +
      '"Not impede" is stronger than give-way — it means arrange your passage early so she never has to alter for you at all. ' +
      'On U.S. rivers add the current: the downbound ship, harder to stop, holds the right of way and calls the passing signal.',
    confidence: 'High',
    source: `${AMALG}, Rules 9, 34 · seamanship practice · ${VER}`,
  },
  {
    id: 'TACIT-COLREG-TSS-001',
    type: 'TacitKnowledge',
    content:
      'Treat a traffic separation scheme like a motorway (Rule 10). ' +
      'Join at the ends and travel with the flow in your lane; never run against it, and stay out of the separation zone that divides the streams. ' +
      'When you must cross, do it deliberately — head as near to a right angle to the flow as you can so you are in the traffic for the shortest time and your intention to cross (not to join) is unmistakable to the ships coming down the lane. ' +
      'Crossing on a shallow, lane-parallel heading is the classic error: it keeps you in the danger zone and looks like a merge. ' +
      'Small craft, sailing, and fishing vessels must not impede a power-driven vessel following a lane.',
    confidence: 'High',
    source: `${AMALG}, Rule 10 · seamanship practice · ${VER}`,
  },
  {
    id: 'TACIT-COLREG-SAILING-HIERARCHY-001',
    type: 'TacitKnowledge',
    content:
      'Two sailing rules stack, and people confuse them (Rules 12 and 18). ' +
      'Between two sailing vessels, Rule 12 decides: different tacks, the port-tack boat gives way; same tack, the windward boat gives way (she has the room to bear away); in doubt about the other’s tack, give way. ' +
      'But Rule 18 sits above Rule 12 for mixed encounters — a power-driven vessel normally keeps clear of a sailing vessel, yet a sailing vessel does not out-rank a vessel not under command, restricted in ability to manoeuvre, or fishing, and Rule 13 overtaking overrides everything. ' +
      'The skill is applying the right layer: which vessels are involved fixes which rule you are even in.',
    confidence: 'High',
    source: `${AMALG}, Rules 12, 13, 18 · seamanship practice · ${VER}`,
  },
  {
    id: 'TACIT-COLREG-INLAND-INTL-001',
    type: 'TacitKnowledge',
    content:
      'Know which rulebook you are under before you need it — the amalgamated edition exists precisely because the two diverge (Rule 1). ' +
      'The trap is the whistle: at sea (International) a blast reports the manoeuvre you are making ("one short — I am turning to starboard"); inland it proposes intent and asks agreement ("one short — I mean to pass you port-to-port"), so an unanswered or cross signal inland is a real disagreement to resolve, not a status report. ' +
      'Rivers add current-based right of way (Rules 9, 14, 15) that has no international counterpart, and inland has its own lights (special flashing light, Annex V blue/red-yellow) and drops the draught-constrained signal (Rule 28 Reserved). ' +
      'Crossing a demarcation line changes the rules under your keel.',
    confidence: 'High',
    source: `${AMALG}, Rules 1, 34 · seamanship practice · ${VER}`,
  },
  {
    id: 'TACIT-COLREG-FOG-SIGNALS-001',
    type: 'TacitKnowledge',
    content:
      'In fog your ears run the plot the eyes cannot (Rule 35). ' +
      'One prolonged blast every couple of minutes is a power-driven vessel making way; two prolonged is one stopped and dead in the water; one prolonged and two short marks a hampered vessel — not under command, restricted, constrained by draught, sailing, fishing, or towing — that you should not count on to manoeuvre out of your way. ' +
      'A rapidly rung bell is a vessel at anchor. ' +
      'Remember there is no stand-on vessel in restricted visibility (Rule 19): the signal tells you what kind of contact to expect, not who has right of way, and you are bound to take avoiding action regardless. ' +
      'Hearing a fog signal apparently forward of the beam, before you have it plotted on radar and know it will pass clear, is the Rule 19 cue to slow to bare steerageway or stop — a signal you can hear but not resolve is exactly the situation the sound rules are built for.',
    confidence: 'High',
    source: `${AMALG}, Rules 19, 35 · seamanship practice · ${VER}`,
  },
];

// ─── Failure modes introduced by the added rules ──────────────────

export const colregAmalgFaultNodes: AJPNode[] = [
  {
    id: 'FAULT-COLREG-IMPEDE-NARROW-001',
    type: 'FailureMode',
    content:
      'A small craft, sailing vessel, or fishing vessel crossing or dawdling in a narrow channel so a deep-draught ship confined to the channel is forced to slow or alter — or any vessel not keeping to the starboard side of the channel. Violates Rule 9 and puts the least-manoeuvrable vessel in the worst position.',
    safetyAlert: 'Do not impede a vessel that can only stay in the channel — keep right and clear early.',
    confidence: 'High',
    source: `${AMALG}, Rule 9`,
  },
  {
    id: 'FAULT-COLREG-TSS-WRONG-ANGLE-001',
    type: 'FailureMode',
    content:
      'Crossing a traffic separation scheme on a shallow, lane-parallel heading, proceeding against the flow, or navigating in the separation zone. Prolongs exposure to lane traffic and makes the crossing look like a merge. Violates Rule 10.',
    safetyAlert: 'Cross a TSS on a heading as near right angles to the flow as practicable — never run against the lane.',
    confidence: 'High',
    source: `${AMALG}, Rule 10`,
  },
  {
    id: 'FAULT-COLREG-MISREAD-LIGHTS-001',
    type: 'FailureMode',
    content:
      'Misidentifying another vessel from her lights or shapes — e.g. treating a not-under-command or restricted-in-ability-to-manoeuvre vessel (which you must keep clear of) as an ordinary power-driven give-way vessel, or missing that a light pattern shows a tow or a fishing vessel with gear out. Leads to applying the wrong rule and the wrong role.',
    safetyAlert: 'Read the lights/shapes before deciding the rule — the pattern tells you the vessel’s type and duties.',
    confidence: 'High',
    source: `${AMALG}, Rules 18, 21–30`,
  },
  {
    id: 'FAULT-COLREG-WRONG-SIGNAL-SET-001',
    type: 'FailureMode',
    content:
      'Using the wrong signal vocabulary for the waters — reading an inland "intent" whistle as an international "manoeuvre" report (or vice versa), or failing to answer / cross-signalling an inland passing proposal. Because inland Rule 34 signals seek agreement, an unresolved exchange is a genuine disagreement, not a status update.',
    safetyAlert: 'Confirm which rulebook applies — inland whistle signals propose intent and must be answered.',
    confidence: 'Medium',
    source: `${AMALG}, Rules 1, 34`,
  },
];

// ─── Corrective actions introduced by the added rules ─────────────

export const colregAmalgActionNodes: AJPNode[] = [
  {
    id: 'ACTION-COLREG-KEEP-STARBOARD-CHANNEL-001',
    type: 'CorrectiveAction',
    content:
      'Keep to the starboard side of a narrow channel or fairway, and if you are a small/sailing/fishing vessel, arrange your passage early so you never impede a vessel confined to the channel (Rule 9).',
    confidence: 'High',
    source: `${AMALG}, Rule 9`,
  },
  {
    id: 'ACTION-COLREG-CROSS-TSS-RIGHT-ANGLE-001',
    type: 'CorrectiveAction',
    content:
      'When crossing a traffic separation scheme, steer a heading as nearly as practicable at right angles to the direction of traffic flow so you clear the lanes in minimum time and your crossing intention is unmistakable (Rule 10).',
    confidence: 'High',
    source: `${AMALG}, Rule 10`,
  },
  {
    id: 'ACTION-COLREG-IDENTIFY-LIGHTS-001',
    type: 'CorrectiveAction',
    content:
      'Identify the other vessel from her lights and shapes first — sidelight colour for aspect, vertical all-round pairs for type (NUC, RAM, fishing, trawling, pilot), extra masthead lights for size — then apply the rule that matches that vessel type (Rules 18, 21–30).',
    confidence: 'High',
    source: `${AMALG}, Rules 18, 21–30`,
  },
];

// ─── Combined node list for the amalgamated expansion ─────────────

export const colregAmalgamatedNodes: AJPNode[] = [
  ...colregPartANodes,
  ...colregPartBNodes,
  ...colregPartCNodes,
  ...colregPartDNodes,
  ...colregPartEFNodes,
  ...colregAnnexNodes,
  ...colregAmalgParameterNodes,
  ...colregAmalgTacitNodes,
  ...colregAmalgFaultNodes,
  ...colregAmalgActionNodes,
];

// ─── Edges ────────────────────────────────────────────────────────

export const colregAmalgamatedEdges: AJPEdge[] = [
  // Classification step now reaches the added encounter-type rules
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-12', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-09', type: 'SUPPORTED_BY' },
  { from: 'STEP-COLREG-CLASSIFY-001', to: 'RULE-COLREG-10', type: 'SUPPORTED_BY' },
  // The whole loop sits under Part A general responsibility + definitions
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'RULE-COLREG-05', type: 'SUPPORTED_BY' },
  { from: 'RULE-COLREG-11', to: 'RULE-COLREG-02', type: 'SUPPORTED_BY' },
  { from: 'RULE-COLREG-18', to: 'RULE-COLREG-03', type: 'REQUIRES' },
  // Look-out includes reading lights/shapes and hearing fog signals
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'PARAM-COLREG-LIGHT-ARCS-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'PARAM-COLREG-DAY-SHAPES-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'TACIT-COLREG-LIGHT-READING-001', type: 'REQUIRES' },
  { from: 'STEP-COLREG-LOOKOUT-001', to: 'TACIT-COLREG-FOG-SIGNALS-001', type: 'REQUIRES' },
  // Light/shape rules ground the light-reading knowledge
  { from: 'PARAM-COLREG-LIGHT-ARCS-001', to: 'RULE-COLREG-21', type: 'SUPPORTED_BY' },
  { from: 'PARAM-COLREG-LIGHT-ARCS-001', to: 'RULE-COLREG-22', type: 'SUPPORTED_BY' },
  { from: 'PARAM-COLREG-DAY-SHAPES-001', to: 'RULE-COLREG-30', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-LIGHT-READING-001', to: 'RULE-COLREG-27', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-LIGHT-READING-001', to: 'RULE-COLREG-23', type: 'SUPPORTED_BY' },
  // Sound-signal knowledge grounded in Parts D and Rule 19
  { from: 'PARAM-COLREG-SOUND-SIGNALS-001', to: 'RULE-COLREG-34', type: 'SUPPORTED_BY' },
  { from: 'PARAM-COLREG-SOUND-SIGNALS-001', to: 'RULE-COLREG-35', type: 'SUPPORTED_BY' },
  { from: 'PARAM-COLREG-SOUND-SIGNALS-001', to: 'RULE-COLREG-32', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-FOG-SIGNALS-001', to: 'RULE-COLREG-35', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-FOG-SIGNALS-001', to: 'RULE-COLREG-19', type: 'SUPPORTED_BY' },
  { from: 'ACTION-COLREG-SOUND-SIGNAL-001', to: 'RULE-COLREG-34', type: 'SUPPORTED_BY' },
  { from: 'ACTION-COLREG-SOUND-SIGNAL-001', to: 'RULE-COLREG-33', type: 'REQUIRES' },
  // Narrow channel: rule → tacit/param/action, and the failure it prevents
  { from: 'TACIT-COLREG-NARROW-CHANNEL-001', to: 'RULE-COLREG-09', type: 'SUPPORTED_BY' },
  { from: 'FAULT-COLREG-IMPEDE-NARROW-001', to: 'RULE-COLREG-09', type: 'INDICATES' },
  { from: 'FAULT-COLREG-IMPEDE-NARROW-001', to: 'ACTION-COLREG-KEEP-STARBOARD-CHANNEL-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-IMPEDE-NARROW-001', to: 'TACIT-COLREG-NARROW-CHANNEL-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-IMPEDE-NARROW-001', to: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001', type: 'CAUSES' },
  // TSS: rule → tacit/param/action, and the failure it prevents
  { from: 'TACIT-COLREG-TSS-001', to: 'RULE-COLREG-10', type: 'SUPPORTED_BY' },
  { from: 'FAULT-COLREG-TSS-WRONG-ANGLE-001', to: 'RULE-COLREG-10', type: 'INDICATES' },
  { from: 'FAULT-COLREG-TSS-WRONG-ANGLE-001', to: 'ACTION-COLREG-CROSS-TSS-RIGHT-ANGLE-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-TSS-WRONG-ANGLE-001', to: 'TACIT-COLREG-TSS-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-TSS-WRONG-ANGLE-001', to: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001', type: 'CAUSES' },
  // Misreading lights → wrong rule; identify-first action fixes it
  { from: 'FAULT-COLREG-MISREAD-LIGHTS-001', to: 'RULE-COLREG-18', type: 'INDICATES' },
  { from: 'FAULT-COLREG-MISREAD-LIGHTS-001', to: 'ACTION-COLREG-IDENTIFY-LIGHTS-001', type: 'FIXED_BY' },
  { from: 'FAULT-COLREG-MISREAD-LIGHTS-001', to: 'TACIT-COLREG-LIGHT-READING-001', type: 'REQUIRES' },
  { from: 'FAULT-COLREG-MISREAD-LIGHTS-001', to: 'CONSEQUENCE-COLREG-COLLISION-001', type: 'CAUSES' },
  { from: 'ACTION-COLREG-IDENTIFY-LIGHTS-001', to: 'RULE-COLREG-18', type: 'SUPPORTED_BY' },
  // Sailing hierarchy
  { from: 'TACIT-COLREG-SAILING-HIERARCHY-001', to: 'RULE-COLREG-12', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-SAILING-HIERARCHY-001', to: 'RULE-COLREG-18', type: 'SUPPORTED_BY' },
  // Inland vs International
  { from: 'PARAM-COLREG-INLAND-INTL-001', to: 'RULE-COLREG-01', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-INLAND-INTL-001', to: 'RULE-COLREG-01', type: 'SUPPORTED_BY' },
  { from: 'TACIT-COLREG-INLAND-INTL-001', to: 'RULE-COLREG-34', type: 'SUPPORTED_BY' },
  { from: 'FAULT-COLREG-WRONG-SIGNAL-SET-001', to: 'RULE-COLREG-34', type: 'INDICATES' },
  { from: 'FAULT-COLREG-WRONG-SIGNAL-SET-001', to: 'TACIT-COLREG-INLAND-INTL-001', type: 'REQUIRES' },
  // Distress signalling: Rule 37 ↔ Annex IV
  { from: 'RULE-COLREG-37', to: 'ANNEX-COLREG-IV', type: 'REQUIRES' },
  // Lights/shapes technical detail lives in Annex I
  { from: 'RULE-COLREG-20', to: 'ANNEX-COLREG-I', type: 'REQUIRES' },
  { from: 'RULE-COLREG-33', to: 'ANNEX-COLREG-III', type: 'REQUIRES' },
  { from: 'RULE-COLREG-26', to: 'ANNEX-COLREG-II', type: 'REQUIRES' },
];

// ─── Socratic probes for the added rules ──────────────────────────

export const colregAmalgamatedProbeNodes: AJPNode[] = [
  {
    id: 'PROBE-COLREG-LIGHTS-001',
    type: 'SocraticProbe',
    content:
      'At night you see, dead ahead, two all-round red lights in a vertical line and no sidelights yet. What is the other vessel, and how does that change your obligations compared with meeting an ordinary power-driven vessel?',
    expectedConcepts: [
      'Two all-round red lights in a vertical line = a vessel not under command (NUC) (Rule 27)',
      'A NUC cannot manoeuvre as required by the Rules, so she is not a normal give-way/stand-on party',
      'Under Rule 18 a power-driven vessel must keep out of the way of a vessel not under command',
      'No sidelights visible / not making way is consistent with her being stopped',
      'Identify the light pattern first, then apply the rule for that vessel type (Rules 21–30, 18)',
    ],
    commonWrongAnswers: [
      'It is a normal power-driven vessel and the usual crossing/head-on rules apply',
      'Two red lights mean her port side — read it as a sidelight',
      'I am the stand-on vessel so I hold course regardless',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: misreading a NUC/RAM as an ordinary give-way vessel applies the wrong rule.',
    confidence: 'High',
    source: `${AMALG}, Rules 27, 18, 21`,
  },
  {
    id: 'PROBE-COLREG-NARROW-CHANNEL-001',
    type: 'SocraticProbe',
    content:
      'You are in a 15-metre vessel about to cross a narrow buoyed channel as a large deep-draught ship comes up it, confined to the dredged water. What does Rule 9 require of you, and how is "shall not impede" different from ordinary give-way?',
    expectedConcepts: [
      'A vessel under 20 m shall not impede a vessel that can navigate only within the channel (Rule 9(b))',
      'A vessel shall not cross a narrow channel if crossing impedes a vessel confined to the channel (Rule 9(d))',
      '"Not impede" means keep well clear early so she never has to alter or slow for you — stronger than give-way',
      'Time the crossing to pass well astern of the confined vessel, or hold and wait, rather than crossing ahead of her',
      'The deep-draught ship has effectively no room to manoeuvre out of the channel',
      '(Rule 9(a) keep-to-the-starboard-side applies to a vessel proceeding along the channel, not to one crossing it)',
    ],
    commonWrongAnswers: [
      'I can cross first because I am the stand-on/smaller vessel',
      'She must give way to me because I am crossing from her starboard side',
      'A small alteration by the big ship is fine — she can just steer around me',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: `${AMALG}, Rule 9`,
  },
  {
    id: 'PROBE-COLREG-TSS-001',
    type: 'SocraticProbe',
    content:
      'Your passage requires you to cross an IMO traffic separation scheme. On what heading should you cross, and why is a shallow angle roughly along the lane the wrong choice?',
    expectedConcepts: [
      'Cross on a heading as nearly as practicable at right angles to the direction of traffic flow (Rule 10)',
      'A right-angle crossing minimises the time spent in the lanes / among the traffic',
      'It makes your intention to cross (not to join the lane) unmistakable to vessels in the lane',
      'Proceed with the flow if using a lane; do not run against it or navigate the separation zone',
      'A shallow angle keeps you in the danger zone longer and looks like a merge',
    ],
    commonWrongAnswers: [
      'Cross at a shallow angle to keep your speed up along the lane',
      'Cut across the separation zone by the shortest straight line regardless of heading',
      'Traffic in the lane must give way to me, so heading does not matter',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: `${AMALG}, Rule 10`,
  },
  {
    id: 'PROBE-COLREG-SAILING-001',
    type: 'SocraticProbe',
    content:
      'Two sailing vessels are approaching with risk of collision. Explain how Rule 12 decides who keeps clear when they are on different tacks versus the same tack, and what to do if you cannot tell the other’s tack.',
    expectedConcepts: [
      'Different tacks: the vessel with the wind on her port side keeps out of the way (Rule 12)',
      'Same tack: the windward vessel keeps out of the way of the leeward vessel',
      'If you have the wind on your port side and cannot tell the windward vessel’s tack, keep out of the way',
      'The windward side is the side opposite to the side on which the mainsail is carried',
      'Rule 12 governs between two sailing vessels; Rule 18 / Rule 13 govern mixed and overtaking cases',
    ],
    commonWrongAnswers: [
      'The larger sailing vessel always has right of way',
      'Starboard-tack always gives way to port-tack',
      'The leeward vessel always keeps clear',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: `${AMALG}, Rule 12`,
  },
  {
    id: 'PROBE-COLREG-INLAND-INTL-001',
    type: 'SocraticProbe',
    content:
      'A vessel ahead in a U.S. inland waterway sounds one short blast. Under the Inland Rules, what is she telling you, and how would the meaning of that same one short blast differ under the International Rules?',
    expectedConcepts: [
      'Inland: one short blast proposes intent — "I intend to leave you on my port side" (a port-to-port passing) (Rule 34)',
      'It is a proposal that expects agreement — you answer with the same signal to agree',
      'International: one short blast reports the manoeuvre being taken — "I am altering my course to starboard"',
      'Inland signals seek agreement; International signals announce action',
      'If you disagree or are in doubt, sound the danger signal — five or more short rapid blasts',
    ],
    commonWrongAnswers: [
      'One short blast means the same thing everywhere',
      'Inland one short blast means "I am turning to starboard" just like international',
      'No answer is needed to an inland passing signal',
    ],
    masteryThreshold: 0.85,
    confidence: 'High',
    source: `${AMALG}, Rules 34, 1`,
  },
  {
    id: 'PROBE-COLREG-FOG-SIGNALS-001',
    type: 'SocraticProbe',
    content:
      'In dense fog you hear, apparently forward of your beam, one prolonged blast followed by two short blasts, repeated. What kind of vessel is that, and what does Rule 19 require you to do?',
    expectedConcepts: [
      'One prolonged + two short blasts marks a hampered vessel — not under command, restricted in ability to manoeuvre, constrained by draught, sailing, fishing, or towing/pushing (Rule 35(c))',
      'The signal names a class of vessels, not one specific status, and confers no right of way',
      'In restricted visibility there is no stand-on or give-way vessel — Rule 19, not the Rule 18 hierarchy, governs and both vessels must act',
      'A fog signal forward of the beam that you cannot resolve by radar is a Rule 19 close-quarters cue',
      'Reduce to bare steerageway, or stop, until the situation is resolved (Rules 19, 6)',
    ],
    commonWrongAnswers: [
      'It is a power-driven vessel making way — one prolonged blast only',
      'Hold course and speed because I am the stand-on vessel',
      'She must keep clear of me / I have right of way once I identify her signal',
      'Alter boldly to port toward the sound to pass it quickly',
    ],
    masteryThreshold: 0.9,
    safetyAlert: 'Safety-critical: an unresolved fog signal forward of the beam calls for slowing or stopping (Rule 19).',
    confidence: 'High',
    source: `${AMALG}, Rules 35, 19, 6`,
  },
];

export const colregAmalgamatedProbeEdges: AJPEdge[] = [
  { from: 'PROBE-COLREG-LIGHTS-001', to: 'RULE-COLREG-27', type: 'PROBES' },
  { from: 'PROBE-COLREG-LIGHTS-001', to: 'FAULT-COLREG-MISREAD-LIGHTS-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-LIGHTS-001', to: 'TACIT-COLREG-LIGHT-READING-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-NARROW-CHANNEL-001', to: 'RULE-COLREG-09', type: 'PROBES' },
  { from: 'PROBE-COLREG-NARROW-CHANNEL-001', to: 'FAULT-COLREG-IMPEDE-NARROW-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-NARROW-CHANNEL-001', to: 'TACIT-COLREG-NARROW-CHANNEL-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-TSS-001', to: 'RULE-COLREG-10', type: 'PROBES' },
  { from: 'PROBE-COLREG-TSS-001', to: 'FAULT-COLREG-TSS-WRONG-ANGLE-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-TSS-001', to: 'TACIT-COLREG-TSS-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAILING-001', to: 'RULE-COLREG-12', type: 'PROBES' },
  { from: 'PROBE-COLREG-SAILING-001', to: 'TACIT-COLREG-SAILING-HIERARCHY-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-INLAND-INTL-001', to: 'RULE-COLREG-34', type: 'PROBES' },
  { from: 'PROBE-COLREG-INLAND-INTL-001', to: 'FAULT-COLREG-WRONG-SIGNAL-SET-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-INLAND-INTL-001', to: 'TACIT-COLREG-INLAND-INTL-001', type: 'PROBES' },
  { from: 'PROBE-COLREG-FOG-SIGNALS-001', to: 'RULE-COLREG-35', type: 'PROBES' },
  { from: 'PROBE-COLREG-FOG-SIGNALS-001', to: 'RULE-COLREG-19', type: 'PROBES' },
  { from: 'PROBE-COLREG-FOG-SIGNALS-001', to: 'TACIT-COLREG-FOG-SIGNALS-001', type: 'PROBES' },
];
