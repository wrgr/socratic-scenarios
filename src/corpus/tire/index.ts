/**
 * Roadside Tire Change domain — a procedural, safety-critical teaching domain
 * built in the same paradigm as AJP (knowledge graph + scripted scenarios +
 * Socratic probes + safety gates + consequences). Self-registers on import.
 */
import { registerDomain } from '../registry';
import type { DomainDescriptor } from '../types';
import { tireGraphNodes, tireGraphEdges } from './nodes';
import { tireProbeNodes, tireProbeEdges } from './probes';
import { tireConsequenceNodes, tireConsequenceEdges } from './consequences';
import { tireScenarioScripts } from './scenario-scripts';

export { tireGraphNodes, tireGraphEdges } from './nodes';
export { tireProbeNodes, tireProbeEdges } from './probes';
export { tireConsequenceNodes } from './consequences';
export { tireScenarioScripts, getTireScenarioById } from './scenario-scripts';

export const TIRE_PHASE_LABELS: Record<string, string> = {
  LOCATE: 'Locate & Signal',
  SECURE: 'Secure Vehicle',
  PREP: 'Break Lugs',
  LIFT: 'Jack & Lift',
  SWAP: 'Swap Wheel',
  TORQUE: 'Torque',
  STOW: 'Stow',
  VERIFY: 'Verify',
  COMPLETE: 'Complete',
};

export const tireDomain: DomainDescriptor = registerDomain({
  id: 'roadside-tire-change',
  name: 'Roadside Tire Change',
  masthead: 'Roadside Tire Change',
  blurb:
    'Change a flat tire safely on the roadside — securing the vehicle, correct jack placement, loosening and torque order, and compact-spare limits.',
  nodes: tireGraphNodes,
  edges: [...tireGraphEdges, ...tireProbeEdges, ...tireConsequenceEdges],
  scenarios: tireScenarioScripts,
  probes: tireProbeNodes,
  consequences: tireConsequenceNodes,
  phaseLabels: TIRE_PHASE_LABELS,
});
