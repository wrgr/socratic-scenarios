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
