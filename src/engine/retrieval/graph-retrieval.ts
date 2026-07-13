/**
 * Fault-diagnosis graph retrieval for AJP In-Operation mode.
 * Pattern: query → token-overlap match to Symptom/FailureMode nodes →
 * graph traversal (INDICATES → FailureMode → FIXED_BY → CorrectiveAction,
 * REQUIRES → SafetyHazard) → ranked causal chains.
 *
 * Graph assembly and shared helpers live in graph-utils.ts.
 * For step-context, probe-context, safety-gate, and tacit-lookup strategies
 * see retrieval-router.ts.
 *
 * Phase 2 upgrade path: replace token similarity with Gemini embeddings,
 * replace in-memory traversal with Neo4j Cypher queries.
 */
import type { AJPNode } from '../../types/ajp';
import { allNodes, allEdges, matchNodes, matchNodesSemantic, outNeighbors, inNeighbors, nodeById } from './graph-utils';

// Re-export graph-utils so callers that previously imported these from here still work.
export { allNodes, allEdges, matchNodes, matchNodesSemantic, outNeighbors, inNeighbors, nodeById };

// ─── Causal Chain ─────────────────────────────────────────────────

export interface CausalChainResult {
  /** Anchor: the symptom or fault node that matched the query. */
  anchorId: string;
  anchorScore: number;
  fault: AJPNode;
  /** All symptom nodes that indicate this fault. */
  symptoms: AJPNode[];
  /** First-line corrective actions. */
  correctiveActions: AJPNode[];
  /** Safety hazards always co-retrieved. */
  safetyHazards: AJPNode[];
  /** Tacit knowledge nodes linked via REQUIRES edges from this fault. */
  tacitNodes: AJPNode[];
  /** Combined relevance score. */
  score: number;
  /**
   * Set when the result may be unreliable: anchor score < 0.5 or the fault
   * node content contains a GAP-* marker. Value is a recommended action.
   * InOperationView renders an amber caution band when any chain has this set.
   */
  reachbackNote?: string;
}

function buildChainFromFault(faultId: string, anchorScore: number): CausalChainResult | null {
  const fault = nodeById(faultId);
  if (!fault || fault.type !== 'FailureMode') return null;

  const symptoms = inNeighbors(faultId, 'INDICATES');
  const correctiveActions = outNeighbors(faultId, 'FIXED_BY');
  const requires = outNeighbors(faultId, 'REQUIRES');
  const safetyHazards = requires.filter((n) => n.type === 'SafetyHazard');
  const tacitNodes = requires.filter((n) => n.type === 'TacitKnowledge');

  // Reachback note: flag low-confidence or known-gap results
  let reachbackNote: string | undefined;
  if (anchorScore < 0.5) {
    reachbackNote =
      'Low match confidence — describe the symptom in more specific terms or consult the HD2 SOP directly.';
  } else if (fault.content.includes('GAP-')) {
    const gapMatch = fault.content.match(/GAP-\d+/);
    reachbackNote = gapMatch
      ? `Known corpus gap (${gapMatch[0]}) — this fault requires external documentation not yet ingested. Do not proceed until verified with site SOP.`
      : 'Known corpus gap — this fault requires external documentation. Do not proceed until verified with site SOP.';
  }

  return {
    anchorId: faultId,
    anchorScore,
    fault,
    symptoms,
    correctiveActions,
    safetyHazards,
    tacitNodes,
    score: anchorScore,
    ...(reachbackNote ? { reachbackNote } : {}),
  };
}

// ─── Main Retrieval Entry Point ───────────────────────────────────

interface EmbeddingLike {
  embed(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
}

export interface GraphRetrievalQuery {
  /** Free-text description of what the operator is observing. */
  symptomText: string;
  /** Max number of causal chains to return. Default 3. */
  topK?: number;
  /**
   * Optional embedding provider. When supplied, semantic (cosine) matching is used
   * instead of Jaccard token overlap, improving recall for paraphrases and synonyms.
   * Falls back to Jaccard automatically if embedding fails.
   */
  embeddingProvider?: EmbeddingLike;
}

/** A single intermediate node match before chain traversal — useful for trace/debug. */
export interface NodeMatchTrace {
  nodeId: string;
  nodeType: 'Symptom' | 'FailureMode';
  content: string;
  score: number;
  matchMethod: 'jaccard' | 'embedding';
}

export interface GraphRetrievalResult {
  chains: CausalChainResult[];
  queryText: string;
  matchedNodeIds: string[];
  /**
   * Raw per-node scores before chain traversal. Shows exactly which Symptom and
   * FailureMode nodes matched the query text and at what score — useful for
   * understanding why a chain was (or was not) retrieved.
   */
  nodeMatchTrace: NodeMatchTrace[];
  timestamp: number;
}

/**
 * Build chains and trace from already-resolved symptom/fault match lists.
 * Extracted so both sync and async entry points share the same logic.
 */
function buildResultFromMatches(
  symptomMatches: Array<{ node: AJPNode; score: number; method?: 'jaccard' | 'embedding' }>,
  faultMatches: Array<{ node: AJPNode; score: number; method?: 'jaccard' | 'embedding' }>,
  symptomText: string,
  topK: number,
): GraphRetrievalResult {
  const chains = new Map<string, CausalChainResult>();

  for (const { node: symptom, score } of symptomMatches) {
    for (const faultNode of outNeighbors(symptom.id, 'INDICATES')) {
      const existing = chains.get(faultNode.id);
      const newScore = score + (existing?.anchorScore ?? 0);
      const chain = buildChainFromFault(faultNode.id, newScore);
      if (chain) chains.set(faultNode.id, { ...chain, score: newScore });
    }
  }

  for (const { node: fault, score } of faultMatches) {
    if (!chains.has(fault.id)) {
      const chain = buildChainFromFault(fault.id, score);
      if (chain) chains.set(fault.id, chain);
    } else {
      const existing = chains.get(fault.id)!;
      chains.set(fault.id, { ...existing, score: existing.score + score * 0.5 });
    }
  }

  const ranked = [...chains.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const nodeMatchTrace: NodeMatchTrace[] = [
    ...symptomMatches.map(({ node, score, method }) => ({
      nodeId: node.id,
      nodeType: 'Symptom' as const,
      content: node.content,
      score,
      matchMethod: (method ?? 'jaccard') as 'jaccard' | 'embedding',
    })),
    ...faultMatches.map(({ node, score, method }) => ({
      nodeId: node.id,
      nodeType: 'FailureMode' as const,
      content: node.content,
      score,
      matchMethod: (method ?? 'jaccard') as 'jaccard' | 'embedding',
    })),
  ].sort((a, b) => b.score - a.score);

  return {
    chains: ranked,
    queryText: symptomText,
    matchedNodeIds: nodeMatchTrace.map((m) => m.nodeId).slice(0, 8),
    nodeMatchTrace,
    timestamp: Date.now(),
  };
}

/**
 * Symptom-first graph retrieval using Jaccard token matching (synchronous).
 * Use `retrieveFromGraphAsync` when an embedding provider is available —
 * it improves recall for paraphrases and synonyms.
 */
export function retrieveFromGraph(query: GraphRetrievalQuery): GraphRetrievalResult {
  const { symptomText, topK = 3 } = query;
  const symptomMatches = matchNodes(symptomText, ['Symptom'], 6);
  const faultMatches = matchNodes(symptomText, ['FailureMode'], 4);
  return buildResultFromMatches(symptomMatches, faultMatches, symptomText, topK);
}

/**
 * Semantic symptom-first graph retrieval (async).
 * Uses embedding cosine similarity when a provider is supplied; falls back to Jaccard.
 * Called by `retrieveHybrid` when an embedding provider is available.
 */
export async function retrieveFromGraphAsync(query: GraphRetrievalQuery): Promise<GraphRetrievalResult> {
  const { symptomText, topK = 3, embeddingProvider } = query;

  if (!embeddingProvider) {
    return retrieveFromGraph(query);
  }

  const [symptomMatches, faultMatches] = await Promise.all([
    matchNodesSemantic(symptomText, ['Symptom'], 6, embeddingProvider),
    matchNodesSemantic(symptomText, ['FailureMode'], 4, embeddingProvider),
  ]);

  return buildResultFromMatches(symptomMatches, faultMatches, symptomText, topK);
}
