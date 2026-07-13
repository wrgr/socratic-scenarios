/**
 * graph-utils.ts
 *
 * Shared in-memory graph: node/edge accessors and token similarity used by
 * all retrieval strategies. Domain-agnostic — the combined graph is injected
 * at boot via bindDomainGraph() (see src/domains/boot.ts) rather than imported
 * from a specific domain's corpus.
 *
 * All retrieval strategies (fault-diagnosis, step-context, probe-context,
 * safety-gate, tacit-lookup) import the `allNodes`/`allEdges` live bindings
 * from here so the graph is never reconstructed in multiple places.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';
import { getActiveDomain } from '../../domains/domain-context';

// ─── Active-domain graph (bound once at boot) ─────────────────────
// Exported as `let` so bindDomainGraph() can reassign them; consumers import
// the live bindings and see the bound graph after boot. Both start empty until
// boot runs (main.tsx for the app, test-setup for vitest).

export let allNodes: AJPNode[] = [];
export let allEdges: AJPEdge[] = [];

/**
 * Bind the retrieval graph to the active domain's graph. Called once at boot.
 * Reassigns the exported live bindings and clears the node-embedding cache so
 * a domain switch never serves stale vectors.
 */
export function bindDomainGraph(graph: { nodes: AJPNode[]; edges: AJPEdge[] }): void {
  allNodes = graph.nodes;
  allEdges = graph.edges;
  invalidateNodeEmbeddingCache();
}

// ─── Node access ──────────────────────────────────────────────────

export function nodeById(id: string): AJPNode | undefined {
  return allNodes.find((n) => n.id === id);
}

export function nodesByType(type: AJPNode['type']): AJPNode[] {
  return allNodes.filter((n) => n.type === type);
}

// ─── Edge traversal ───────────────────────────────────────────────

/** All nodes reachable from `fromId` via a given edge type. */
export function outNeighbors(fromId: string, edgeType: string): AJPNode[] {
  return allEdges
    .filter((e) => e.from === fromId && e.type === edgeType)
    .map((e) => nodeById(e.to))
    .filter((n): n is AJPNode => n !== undefined);
}

/** All nodes that point to `toId` via a given edge type. */
export function inNeighbors(toId: string, edgeType: string): AJPNode[] {
  return allEdges
    .filter((e) => e.to === toId && e.type === edgeType)
    .map((e) => nodeById(e.from))
    .filter((n): n is AJPNode => n !== undefined);
}

/** All edge types present for a given node (outbound). */
export function outEdgeTypes(nodeId: string): string[] {
  return [...new Set(allEdges.filter((e) => e.from === nodeId).map((e) => e.type))];
}

// ─── Token similarity ─────────────────────────────────────────────

/** Jaccard token-overlap similarity. No API required. */
export function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set((s.toLowerCase().match(/[a-z]+/g) ?? []).filter((t) => t.length > 2));
  const A = tokenize(a);
  const B = tokenize(b);
  const intersection = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : intersection / union;
}

/** Find best-matching nodes of given types against a query text. */
export function matchNodes(
  queryText: string,
  types: AJPNode['type'][],
  topK: number,
): Array<{ node: AJPNode; score: number }> {
  return allNodes
    .filter((n) => types.includes(n.type))
    .map((n) => ({ node: n, score: tokenSimilarity(queryText, n.content) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── Semantic node cache ──────────────────────────────────────────
// Pre-computed embeddings for all node content strings. Populated lazily
// on first call to matchNodesSemantic() and cached for the session lifetime.
// When the embedding provider is available this replaces Jaccard matching,
// dramatically improving recall for paraphrases and synonyms.

interface EmbeddingLike {
  embed(texts: string[]): Promise<number[][]>;
  cosineSimilarity(a: number[], b: number[]): number;
  /** Identifies the embedding model so baked files with a different model are rejected. */
  modelId?: string;
}

let nodeEmbeddingCache: Map<string, number[]> | null = null;
let cacheBuiltFor: EmbeddingLike | null = null;

/**
 * Try to load pre-baked node embeddings from public/ajp-node-embeddings.json.
 * Returns null on miss or on a model-id mismatch (in which case the caller
 * must live-embed with the active provider so query and doc vectors share
 * a vector space).
 */
async function loadBakedNodeEmbeddings(
  provider: EmbeddingLike,
): Promise<Map<string, number[]> | null> {
  if (!provider.modelId) return null;
  const ref = getActiveDomain().denseCorpus?.nodeEmbeddingsUrl;
  if (!ref) return null; // graph-only domain — no baked vectors, live-embed instead
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${ref}`);
    if (!res.ok) return null;
    const data = await res.json() as {
      model?: string;
      nodes?: Array<{ id: string; embedding: number[] }>;
    };
    if (data.model !== provider.modelId) {
      console.warn(
        `[GraphRetrieval] Baked node embeddings use model "${data.model}" but provider is "${provider.modelId}" — falling back to live embed`,
      );
      return null;
    }
    const cache = new Map<string, number[]>();
    for (const n of data.nodes ?? []) cache.set(n.id, n.embedding);
    console.info(
      `[GraphRetrieval] Loaded ${cache.size} baked node embeddings (${provider.modelId})`,
    );
    return cache;
  } catch {
    return null;
  }
}

/**
 * Pre-embed all node content strings and store by node ID.
 * Prefers baked vectors from ingest (public/ajp-node-embeddings.json) when the
 * active provider's modelId matches the file. Falls back to live embedding
 * with the provider — same vector space is guaranteed by using one provider
 * for both the cache and the query.
 * Safe to call multiple times — only rebuilds when the provider changes.
 */
async function buildNodeEmbeddingCache(provider: EmbeddingLike): Promise<Map<string, number[]>> {
  if (nodeEmbeddingCache && cacheBuiltFor === provider) return nodeEmbeddingCache;

  const baked = await loadBakedNodeEmbeddings(provider);
  if (baked) {
    nodeEmbeddingCache = baked;
    cacheBuiltFor = provider;
    return baked;
  }

  // Live embed: ensures query and node vectors share a space even for
  // providers without baked data (e.g. simulated TF-IDF).
  const cache = new Map<string, number[]>();
  const contents = allNodes.map((n) => n.content);
  const embeddings = await provider.embed(contents);
  for (let i = 0; i < allNodes.length; i++) {
    cache.set(allNodes[i].id, embeddings[i]);
  }
  nodeEmbeddingCache = cache;
  cacheBuiltFor = provider;
  return cache;
}

/**
 * Semantic node matching using cosine similarity over pre-computed embeddings.
 * Falls back to Jaccard (matchNodes) when the provider is unavailable or embedding fails.
 * The `matchMethod` field in results indicates which path was taken.
 */
export async function matchNodesSemantic(
  queryText: string,
  types: AJPNode['type'][],
  topK: number,
  provider: EmbeddingLike,
): Promise<Array<{ node: AJPNode; score: number; method: 'embedding' | 'jaccard' }>> {
  try {
    const cache = await buildNodeEmbeddingCache(provider);
    const [queryEmbedding] = await provider.embed([queryText]);

    const candidates = allNodes.filter((n) => types.includes(n.type));
    return candidates
      .map((n) => {
        const nodeEmb = cache.get(n.id);
        const score = nodeEmb ? provider.cosineSimilarity(queryEmbedding, nodeEmb) : 0;
        return { node: n, score, method: 'embedding' as const };
      })
      .filter((r) => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  } catch {
    // Degrade gracefully to Jaccard
    return matchNodes(queryText, types, topK).map((r) => ({ ...r, method: 'jaccard' as const }));
  }
}

/** Invalidate the node embedding cache (e.g. when provider changes). */
export function invalidateNodeEmbeddingCache(): void {
  nodeEmbeddingCache = null;
  cacheBuiltFor = null;
}
