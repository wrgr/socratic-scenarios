/**
 * COLREG Collision Avoidance domain — the Navigation Rules taught in the same
 * paradigm as AJP (knowledge graph of rules + scripted encounters + Socratic probes
 * + safety gates + consequences). Two layers make up the graph:
 *   • `nodes.ts` — the core give-way decision loop (Rules 5–19), the training focus.
 *   • `amalgamated.ts` — the full USCG "Navigation Rules, Amalgamated" rulebook
 *     (72 COLREGS + U.S. Inland, Rules 1–41 across Parts A–F and Annexes I–V), so
 *     the corpus is comprehensive for reachback/retrieval, not only the decision loop.
 * The separate full interactive simulator (kinematics + controls + minimum-deviation
 * objective) is specified in docs/colreg-simulator-design.md. Self-registers on import.
 */
import { registerDomain } from '../registry';
import type { DomainDescriptor } from '../types';
import { colregGraphNodes, colregGraphEdges } from './nodes';
import { colregProbeNodes, colregProbeEdges } from './probes';
import { colregConsequenceNodes, colregConsequenceEdges } from './consequences';
import { colregScenarioScripts } from './scenario-scripts';
import {
  colregAmalgamatedNodes,
  colregAmalgamatedEdges,
  colregAmalgamatedProbeNodes,
  colregAmalgamatedProbeEdges,
} from './amalgamated';

export { colregGraphNodes, colregGraphEdges } from './nodes';
export { colregProbeNodes, colregProbeEdges } from './probes';
export { colregConsequenceNodes } from './consequences';
export { colregScenarioScripts, getColregScenarioById } from './scenario-scripts';
export {
  colregAmalgamatedNodes,
  colregAmalgamatedEdges,
  colregAmalgamatedProbeNodes,
  colregAmalgamatedProbeEdges,
} from './amalgamated';

/**
 * Full knowledge-graph node set: the base give-way loop (`nodes.ts`) plus the
 * amalgamated full-rulebook expansion (`amalgamated.ts`, Parts A–F + Annexes).
 */
export const colregAllGraphNodes = [...colregGraphNodes, ...colregAmalgamatedNodes];
export const colregAllProbeNodes = [...colregProbeNodes, ...colregAmalgamatedProbeNodes];

export const COLREG_PHASE_LABELS: Record<string, string> = {
  LOOKOUT: 'Look-out',
  ASSESS_RISK: 'Assess Risk',
  CLASSIFY: 'Classify Encounter',
  DECIDE_ROLE: 'Give-way / Stand-on',
  ACT: 'Take Action',
  MONITOR: 'Monitor CPA',
  RESUME: 'Resume Passage',
  COMPLETE: 'Complete',
};

export const colregDomain: DomainDescriptor = registerDomain({
  id: 'colreg-collision-avoidance',
  name: 'COLREG — Collision Avoidance',
  masthead: 'COLREG Collision Avoidance',
  blurb:
    'Learn the Navigation Rules as published in the USCG "Amalgamated" edition — the International Regulations for Preventing Collisions at Sea (72 COLREGS) and the U.S. Inland Rules — covering risk of collision, safe speed, and give-way/stand-on duties across head-on, crossing, overtaking, narrow-channel, traffic-separation, and restricted-visibility encounters, plus lights, shapes, and sound signals (Rules 1–41 and Annexes I–V).',
  nodes: colregAllGraphNodes,
  edges: [
    ...colregGraphEdges,
    ...colregAmalgamatedEdges,
    ...colregProbeEdges,
    ...colregAmalgamatedProbeEdges,
    ...colregConsequenceEdges,
  ],
  scenarios: colregScenarioScripts,
  probes: colregAllProbeNodes,
  consequences: colregConsequenceNodes,
  phaseLabels: COLREG_PHASE_LABELS,
  hasSimulator: true,
});
