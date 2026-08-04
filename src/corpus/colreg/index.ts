/**
 * COLREG Collision Avoidance domain — the "basic" build: the International
 * Regulations for Preventing Collisions at Sea taught in the same paradigm as AJP
 * (knowledge graph of rules + scripted encounters + Socratic probes + safety gates
 * + consequences). The separate full interactive simulator (kinematics + controls
 * + minimum-deviation objective) is specified in docs/colreg-simulator-design.md.
 * Self-registers on import.
 */
import { registerDomain } from '../registry';
import type { DomainDescriptor } from '../types';
import { colregGraphNodes, colregGraphEdges } from './nodes';
import { colregProbeNodes, colregProbeEdges } from './probes';
import { colregConsequenceNodes, colregConsequenceEdges } from './consequences';
import { colregScenarioScripts } from './scenario-scripts';

export { colregGraphNodes, colregGraphEdges } from './nodes';
export { colregProbeNodes, colregProbeEdges } from './probes';
export { colregConsequenceNodes } from './consequences';
export { colregScenarioScripts, getColregScenarioById } from './scenario-scripts';

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
    'Learn the International Regulations for Preventing Collisions at Sea — risk of collision, safe speed, and give-way/stand-on duties across head-on, crossing, overtaking, and restricted-visibility encounters.',
  nodes: colregGraphNodes,
  edges: [...colregGraphEdges, ...colregProbeEdges, ...colregConsequenceEdges],
  scenarios: colregScenarioScripts,
  probes: colregProbeNodes,
  consequences: colregConsequenceNodes,
  phaseLabels: COLREG_PHASE_LABELS,
  hasSimulator: true,
});
