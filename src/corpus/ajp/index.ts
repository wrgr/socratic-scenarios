/**
 * AJP (Aerosol Jet Printer) corpus for the TeachMe Optomec HD2 training domain.
 * Self-registers with the domain registry on import; also exports typed graph data
 * for use by the Narrator engine and ScenarioView.
 */
import type { Concept, CorpusChunk, LearningScenario, TransferProblem } from '../../types';
import { ajpConcepts } from './concepts';
import { ajpCorpusChunks } from './chunks';
import { ajpLearningScenarios } from './scenarios';
import { ajpTransferProblems } from './problems';
import { registerDomain } from '../registry';
import type { DomainDescriptor } from '../types';
import { SCENARIO_PHASE_LABELS } from '../../engine/scenario/types';
import { allNodes as ajpAllNodes, allEdges as ajpAllEdges } from '../../engine/retrieval/graph-utils';
import { consequenceNodes as ajpConsequenceNodes } from './consequences';
import { ajpProbeNodes as ajpProbes } from './probes';
import { ajpScenarioScripts as ajpScenarios } from './scenario-scripts';

export { ajpConcepts, ajpCorpusChunks, ajpLearningScenarios, ajpTransferProblems };
export { ajpNodes, ajpEdges, DEMO_SCENARIO_STEPS } from './graph';
export {
  extendedSymptomNodes,
  extendedFaultNodes,
  extendedActionNodes,
  extendedEdges,
} from './graph-faults';
export {
  designFaultNodes,
  designSymptomNodes,
  designTacitNodes,
  designFaultEdges,
} from './design-faults';
export { designActionNodes, designActionEdges } from './design-actions';
export { consequenceNodes, consequenceEdges } from './consequences';
export type { ConsequenceNode } from './consequences';
export { tacitKnowledgeNodes, tacitKnowledgeEdges } from './tacit-knowledge';
export { corpusGaps, getGapById, getOpenGaps, getGapAffectedNodeIds, isNodeGapAffected } from './corpus-gaps';
export type { CorpusGap, GapStatus } from './corpus-gaps';
export { ajpProbeNodes, ajpProbeEdges } from './probes';
export { ajpScenarioScripts, getScenarioById } from './scenario-scripts';
export type { AJPNode, AJPEdge, ScenarioStepView, ScenarioAction, ScenarioProgress } from '../../types/ajp';

// ─── Typed accessors ──────────────────────────────────────────────

/** Return AJP concept by id. */
export function getAJPConceptById(id: string): Concept | undefined {
  return ajpConcepts.find((c) => c.id === id);
}

/** Return AJP chunks for a concept. */
export function getAJPChunksForConcept(conceptId: string): CorpusChunk[] {
  return ajpCorpusChunks.filter((c) => c.conceptId === conceptId);
}

/** Return AJP learning scenario by id. */
export function getAJPScenarioById(id: string): LearningScenario | undefined {
  return ajpLearningScenarios.find((s) => s.id === id);
}

/** Return AJP transfer problem by id. */
export function getAJPProblemById(id: string): TransferProblem | undefined {
  return ajpTransferProblems.find((p) => p.id === id);
}

// ─── Domain registration ──────────────────────────────────────────
// AJP is the original engine-backed domain: its graph is baked into the
// retrieval + narrator layer (graph-utils / narrator), so the retrieval-heavy
// surfaces and the AJP safety-gate pre-flight only apply here (fullEngine).

export const ajpDomain: DomainDescriptor = registerDomain({
  id: 'ajp-electronics-repair',
  name: 'Aerosol Jet Printing',
  masthead: 'Aerosol Jet Printer Demo',
  blurb:
    'Corpus-bound training for Optomec HD2 aerosol-jet PCB repair — startup/shutdown sequencing, clog and leak diagnosis, sinter decisions, and nanoparticle/ESD safety.',
  nodes: ajpAllNodes,
  edges: ajpAllEdges,
  scenarios: ajpScenarios,
  probes: ajpProbes,
  consequences: ajpConsequenceNodes,
  phaseLabels: SCENARIO_PHASE_LABELS,
  fullEngine: true,
});
