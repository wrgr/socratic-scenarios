/**
 * Hybrid retrieval — graph traversal + dense vector lookup for AJP In-Operation mode.
 *
 * This implements the LightRAG dual-tier pattern in TypeScript:
 *   - Graph tier:  symptom → fault → corrective action (exact causal chain traversal)
 *   - Dense tier:  semantic similarity over ingested SOPs and peer literature
 *
 * When public/ajp-corpus.json exists (post ingestion), dense results augment the
 * graph chains with relevant SOP passages. When it does not exist, the function
 * returns graph-only results — identical to the Phase 2 behaviour.
 *
 * Score fusion: graph chains are scored by causal chain confidence;
 * dense chunks are scored by cosine similarity. Both are normalised to 0–1 and
 * merged independently — callers receive both lists and can display them in
 * their own sections.
 */
import { getEmbeddingProvider } from './index';
import { retrieveFromGraphAsync } from './graph-retrieval';
import type { CausalChainResult, NodeMatchTrace } from './graph-retrieval';
import { queryDense, queryDenseLexical } from './dense-retrieval';
import type { DenseMatch } from './dense-retrieval';

// ─── Types ────────────────────────────────────────────────────────

export interface HybridQuery {
  /** Operator's free-text symptom or question. */
  symptomText: string;
  /** Max causal chains from the graph tier. Default 3. */
  graphTopK?: number;
  /** Max dense chunks from the document tier. Default 5. */
  denseTopK?: number;
}

export interface HybridResult {
  /** Typed causal chains from the knowledge graph (always present). */
  graphChains: CausalChainResult[];
  /** Relevant SOP/literature passages from the dense tier (empty when not ingested). */
  denseMatches: DenseMatch[];
  /** True when the dense corpus is loaded and returned results. */
  hasDenseData: boolean;
  /**
   * How the dense matches were scored: 'embedding' (semantic cosine over
   * baked vectors — Gemini key mode) or 'lexical' (TF-IDF keyword overlap
   * on chunk text — simulated/no-key mode). Undefined when no dense tier ran.
   * Surfaces in the UI so a keyword hit is never presented as a semantic one.
   */
  denseTier?: 'embedding' | 'lexical';
  /**
   * Intermediate per-node match scores from the graph tier — shows exactly which
   * Symptom and FailureMode nodes matched the query and at what Jaccard score,
   * before chain traversal. Useful for debugging retrieval quality.
   */
  nodeMatchTrace: NodeMatchTrace[];
  queryText: string;
  timestamp: number;
}

// ─── Hybrid Retrieval ─────────────────────────────────────────────

/**
 * Run graph + dense retrieval in parallel and merge results.
 * Falls back to graph-only when no embedding provider is set or corpus is empty.
 */
export async function retrieveHybrid(query: HybridQuery): Promise<HybridResult> {
  const { symptomText, graphTopK = 3, denseTopK = 5 } = query;

  // Provider is checked once so both graph and dense tiers use the same instance
  const provider = getEmbeddingProvider();

  // Graph retrieval: use semantic matching when a provider is available,
  // otherwise fall back to Jaccard. Both run asynchronously here so dense
  // lookup and graph embedding can overlap when both are active.
  const graphResult = await retrieveFromGraphAsync({
    symptomText,
    topK: graphTopK,
    embeddingProvider: provider ?? undefined,
  });

  let denseMatches: DenseMatch[] = [];
  let hasDenseData = false;
  let denseTier: 'embedding' | 'lexical' | undefined;

  // NOTE: do NOT pre-gate on getDenseBackend().hasData() — the corpus is
  // lazy-loaded inside queryDense*, so before the first query hasData() is
  // always false and the dense tier would never connect (that exact bug
  // shipped: chat modes ran graph-only forever unless the RAG Coverage view
  // happened to warm the cache first).
  try {
    if (provider) {
      // Embedding path first: queryDense loads the corpus and refuses to
      // score vectors from a different model space (modelMismatch).
      const [embedding] = await provider.embed([symptomText]);
      const denseResult = await queryDense({
        queryEmbedding: embedding,
        queryModelId: provider.modelId,
        topK: denseTopK,
        minScore: 0.35,
      });
      if (denseResult.modelMismatch) {
        // Simulated/no-key mode against a baked corpus: provider vectors are
        // per-call TF-IDF spaces that can't be cosine'd against the corpus
        // embeddings. Fall back to lexical TF-IDF over chunk text so the
        // corpus stays reachable without a key.
        const lexResult = await queryDenseLexical({
          queryText: symptomText,
          topK: denseTopK,
        });
        denseMatches = lexResult.matches;
        hasDenseData = lexResult.hasData && lexResult.matches.length > 0;
        denseTier = denseMatches.length > 0 ? 'lexical' : undefined;
      } else {
        denseMatches = denseResult.matches;
        hasDenseData = denseResult.hasData && denseResult.matches.length > 0;
        denseTier = denseMatches.length > 0 ? 'embedding' : undefined;
      }
    }
  } catch (err) {
    // Embedding call failed — degrade gracefully to graph-only
    console.warn('[HybridRetrieval] Dense retrieval failed, using graph only:', err);
  }

  return {
    graphChains: graphResult.chains,
    denseMatches,
    hasDenseData,
    denseTier,
    nodeMatchTrace: graphResult.nodeMatchTrace,
    queryText: symptomText,
    timestamp: Date.now(),
  };
}

/**
 * Convenience wrapper: run hybrid retrieval and return a flat summary string
 * suitable for feeding into the Mentor LLM as context. Used by the Mentor
 * service when evaluating In-Operation free-text queries.
 */
export function formatHybridContext(result: HybridResult): string {
  const parts: string[] = [];

  if (result.graphChains.length > 0) {
    parts.push('=== Knowledge Graph Results ===');
    for (const chain of result.graphChains) {
      parts.push(`Fault: ${chain.fault.content}`);
      if (chain.symptoms.length > 0) {
        parts.push(`Symptoms: ${chain.symptoms.map((s) => s.content).join(' | ')}`);
      }
      if (chain.correctiveActions.length > 0) {
        parts.push(`Actions: ${chain.correctiveActions.map((a) => a.content).join(' | ')}`);
      }
    }
  }

  if (result.denseMatches.length > 0) {
    parts.push('=== SOP / Literature Context ===');
    for (const m of result.denseMatches.slice(0, 3)) {
      parts.push(`[${m.chunk.source} — ${m.chunk.section}]\n${m.chunk.text}`);
    }
  }

  return parts.join('\n\n');
}
