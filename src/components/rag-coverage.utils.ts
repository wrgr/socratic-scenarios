/**
 * rag-coverage.utils.ts
 *
 * Pure logic for the RAG Coverage view. Kept free of React and of the
 * retrieval singletons so the coverage/confusion math is unit-testable.
 *
 * The view answers three questions about the dense corpus:
 *   1. Coverage    — which sources/chunks do queries actually hit? (label-free)
 *   2. Dead corpus — which chunks are never retrieved by any query? (label-free)
 *   3. Accuracy    — TP / FP / FN / TN once a reviewer judges relevance.
 *
 * On the confusion matrix (deliberately explicit, because RAG has no clean
 * TN otherwise): we score it at the QUERY level, not the (query,chunk) level —
 * the latter's TN cell is every-chunk × every-query and swamps everything.
 *
 *   answerable = the reviewer's assertion that the corpus SHOULD answer a query
 *   hit        = the query retrieved at least one chunk judged relevant
 *                (falls back to a score-threshold proxy until judged)
 *
 *   answerable=yes & hit  → TP  (corpus covers it, retrieval found it)
 *   answerable=yes & miss → FN  (should be covered but wasn't — expand / tune)
 *   answerable=no  & hit  → FP  (retrieved for something the corpus shouldn't answer)
 *   answerable=no  & miss → TN  (correctly declined — the app's core virtue)
 *   answerable=unknown    → excluded from the matrix (counted as "unlabeled")
 */

// ─── Types ────────────────────────────────────────────────────────

export type QueryOrigin = 'symptom' | 'failure-mode' | 'gap' | 'example' | 'custom';

export interface EvalQuery {
  /** Stable id used as the localStorage key prefix for judgments. */
  id: string;
  text: string;
  origin: QueryOrigin;
  /** Node/gap id this query was derived from (shown as a badge). */
  refId?: string;
}

/** One retrieved chunk for a query (a top-K entry). */
export interface ChunkHit {
  chunkId: string;
  source: string;
  section: string;
  score: number;
  /** 0-based rank within the query's top-K. */
  rank: number;
  text?: string;
}

/** Result of running one query against the dense corpus. */
export interface QueryRun {
  queryId: string;
  hits: ChunkHit[];
  bestScore: number;
  error?: string;
}

export interface ChunkInventoryItem {
  id: string;
  source: string;
  section: string;
}

// ─── Judgment model (mirrors useRelevanceJudgments) ───────────────

export type Relevance = 'relevant' | 'irrelevant';
export type Answerable = 'yes' | 'no';

export interface JudgmentSnapshot {
  /** key `${queryId}::${chunkId}` → relevance */
  relevance: Record<string, Relevance>;
  /** key queryId → answerable (absence means "unknown") */
  answerable: Record<string, Answerable>;
}

export function relevanceKey(queryId: string, chunkId: string): string {
  return `${queryId}::${chunkId}`;
}

// ─── Query seeding (pure) ─────────────────────────────────────────

/** The three canonical demo queries also used by the Retrieval Lab. */
export const EXAMPLE_QUERY_TEXTS: readonly string[] = [
  'pressure elevated and line looks narrow',
  'no deposition and pressure spiked',
  'atomizer current low',
];

/** Collapse whitespace and clip a node's content into a query-length string. */
export function toQueryText(content: string, maxLen = 160): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (flat.length <= maxLen) return flat;
  // Prefer cutting at the first sentence boundary within the budget.
  const period = flat.slice(0, maxLen).lastIndexOf('. ');
  if (period > 40) return flat.slice(0, period + 1);
  return `${flat.slice(0, maxLen).trimEnd()}…`;
}

export function queriesFromNodes(
  nodes: readonly { id: string; content: string }[],
  origin: Extract<QueryOrigin, 'symptom' | 'failure-mode'>,
): EvalQuery[] {
  return nodes.map((n) => ({
    id: `q-${origin}-${n.id}`,
    text: toQueryText(n.content),
    origin,
    refId: n.id,
  }));
}

export function queriesFromGaps(
  gaps: readonly { id: string; summary: string }[],
): EvalQuery[] {
  return gaps.map((g) => ({
    id: `q-gap-${g.id}`,
    text: toQueryText(g.summary),
    origin: 'gap' as const,
    refId: g.id,
  }));
}

export function exampleQueries(): EvalQuery[] {
  return EXAMPLE_QUERY_TEXTS.map((text, i) => ({
    id: `q-example-${i}`,
    text,
    origin: 'example' as const,
  }));
}

// ─── Coverage aggregation (label-free) ────────────────────────────

export interface SourceCoverage {
  source: string;
  totalChunks: number;
  /** Distinct chunks of this source retrieved by ≥1 query. */
  chunksHit: number;
  /** Total appearances across every query's top-K. */
  hitCount: number;
  /** Distinct queries that retrieved ≥1 chunk of this source. */
  queriesHitting: number;
  /** Best cosine score any query achieved against this source. */
  bestScore: number;
  /** chunksHit / totalChunks, 0..1. */
  coverageRatio: number;
}

export function computeSourceCoverage(
  runs: readonly QueryRun[],
  inventory: readonly ChunkInventoryItem[],
): SourceCoverage[] {
  const totalBySource = new Map<string, number>();
  for (const item of inventory) {
    totalBySource.set(item.source, (totalBySource.get(item.source) ?? 0) + 1);
  }

  const hitChunksBySource = new Map<string, Set<string>>();
  const hitCountBySource = new Map<string, number>();
  const queriesBySource = new Map<string, Set<string>>();
  const bestBySource = new Map<string, number>();

  for (const run of runs) {
    const sourcesInRun = new Set<string>();
    for (const hit of run.hits) {
      sourcesInRun.add(hit.source);
      if (!hitChunksBySource.has(hit.source)) hitChunksBySource.set(hit.source, new Set());
      hitChunksBySource.get(hit.source)!.add(hit.chunkId);
      hitCountBySource.set(hit.source, (hitCountBySource.get(hit.source) ?? 0) + 1);
      bestBySource.set(hit.source, Math.max(bestBySource.get(hit.source) ?? 0, hit.score));
    }
    for (const source of sourcesInRun) {
      if (!queriesBySource.has(source)) queriesBySource.set(source, new Set());
      queriesBySource.get(source)!.add(run.queryId);
    }
  }

  const sources = new Set<string>([...totalBySource.keys(), ...hitChunksBySource.keys()]);
  return Array.from(sources)
    .map((source) => {
      const totalChunks = totalBySource.get(source) ?? 0;
      const chunksHit = hitChunksBySource.get(source)?.size ?? 0;
      return {
        source,
        totalChunks,
        chunksHit,
        hitCount: hitCountBySource.get(source) ?? 0,
        queriesHitting: queriesBySource.get(source)?.size ?? 0,
        bestScore: bestBySource.get(source) ?? 0,
        coverageRatio: totalChunks > 0 ? chunksHit / totalChunks : 0,
      };
    })
    .sort((a, b) => b.hitCount - a.hitCount || a.source.localeCompare(b.source));
}

/** Chunks that never appear in any query's top-K — dead / unexercised corpus. */
export function computeUnusedChunks(
  runs: readonly QueryRun[],
  inventory: readonly ChunkInventoryItem[],
): ChunkInventoryItem[] {
  const used = new Set<string>();
  for (const run of runs) for (const hit of run.hits) used.add(hit.chunkId);
  return inventory.filter((item) => !used.has(item.id));
}

// ─── Query × source hit matrix (heatmap data) ─────────────────────

export interface HeatCell {
  /** Number of top-K hits from this source for this query. */
  count: number;
  /** Best score among those hits (0 when none). */
  bestScore: number;
}

export interface HeatmapData {
  sources: string[];
  /** Per query: source → cell. Missing source ⇒ no hits. */
  rows: { queryId: string; cells: Record<string, HeatCell> }[];
}

export function buildHeatmap(
  queries: readonly EvalQuery[],
  runs: readonly QueryRun[],
  /** Restrict columns to these sources (e.g. the top-N by hitCount). */
  sourceOrder: readonly string[],
): HeatmapData {
  const runById = new Map(runs.map((r) => [r.queryId, r]));
  const sourceSet = new Set(sourceOrder);
  const rows = queries.map((q) => {
    const run = runById.get(q.id);
    const cells: Record<string, HeatCell> = {};
    if (run) {
      for (const hit of run.hits) {
        if (!sourceSet.has(hit.source)) continue;
        const cell = cells[hit.source] ?? { count: 0, bestScore: 0 };
        cell.count += 1;
        cell.bestScore = Math.max(cell.bestScore, hit.score);
        cells[hit.source] = cell;
      }
    }
    return { queryId: q.id, cells };
  });
  return { sources: [...sourceOrder], rows };
}

// ─── Per-query outcome + confusion matrix ─────────────────────────

export type HitState = 'judged-hit' | 'judged-miss' | 'proxy-hit' | 'proxy-miss';
export type ConfusionCell = 'TP' | 'FP' | 'FN' | 'TN';

export interface QueryOutcome {
  queryId: string;
  answerable: Answerable | 'unknown';
  /** ≥1 retrieved chunk judged relevant. */
  hasJudgedRelevant: boolean;
  /** ≥1 retrieved chunk judged at all (relevant or irrelevant). */
  anyJudged: boolean;
  /** bestScore ≥ tau. */
  proxyHit: boolean;
  hitState: HitState;
  /** Whether this query counts as a hit (judged relevance wins over the proxy). */
  hit: boolean;
  /** Confusion cell, or null when answerable is unknown. */
  cell: ConfusionCell | null;
}

export function computeQueryOutcome(
  query: EvalQuery,
  run: QueryRun | undefined,
  judgments: JudgmentSnapshot,
  tau: number,
): QueryOutcome {
  const hits = run?.hits ?? [];
  let hasJudgedRelevant = false;
  let anyJudged = false;
  for (const hit of hits) {
    const verdict = judgments.relevance[relevanceKey(query.id, hit.chunkId)];
    if (verdict) {
      anyJudged = true;
      if (verdict === 'relevant') hasJudgedRelevant = true;
    }
  }
  const proxyHit = (run?.bestScore ?? 0) >= tau;

  // Judged relevance is authoritative. If the reviewer looked and marked
  // everything irrelevant, that's a definite miss — don't fall back to score.
  const hit = hasJudgedRelevant || (!anyJudged && proxyHit);

  const hitState: HitState = hasJudgedRelevant
    ? 'judged-hit'
    : anyJudged
      ? 'judged-miss'
      : proxyHit
        ? 'proxy-hit'
        : 'proxy-miss';

  const answerable = judgments.answerable[query.id] ?? 'unknown';
  let cell: ConfusionCell | null = null;
  if (answerable === 'yes') cell = hit ? 'TP' : 'FN';
  else if (answerable === 'no') cell = hit ? 'FP' : 'TN';

  return { queryId: query.id, answerable, hasJudgedRelevant, anyJudged, proxyHit, hitState, hit, cell };
}

export interface ConfusionSummary {
  TP: number;
  FP: number;
  FN: number;
  TN: number;
  /** Queries with answerable = unknown, excluded from the matrix. */
  unlabeled: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  accuracy: number | null;
}

export function summarizeConfusion(outcomes: readonly QueryOutcome[]): ConfusionSummary {
  let TP = 0, FP = 0, FN = 0, TN = 0, unlabeled = 0;
  for (const o of outcomes) {
    if (o.cell === 'TP') TP++;
    else if (o.cell === 'FP') FP++;
    else if (o.cell === 'FN') FN++;
    else if (o.cell === 'TN') TN++;
    else unlabeled++;
  }
  const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);
  const precision = ratio(TP, TP + FP);
  const recall = ratio(TP, TP + FN);
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  const accuracy = ratio(TP + TN, TP + FP + FN + TN);
  return { TP, FP, FN, TN, unlabeled, precision, recall, f1, accuracy };
}

// ─── Chunk-level judgment precision (secondary) ───────────────────

export interface ChunkPrecision {
  /** Retrieved-and-judged-relevant pairs. */
  tp: number;
  /** Retrieved-and-judged-irrelevant pairs. */
  fp: number;
  precision: number | null;
  /** Per-source tp/fp/precision, sorted by volume. */
  perSource: { source: string; tp: number; fp: number; precision: number | null }[];
}

export function summarizeChunkPrecision(
  runs: readonly QueryRun[],
  judgments: JudgmentSnapshot,
): ChunkPrecision {
  let tp = 0, fp = 0;
  const bySource = new Map<string, { tp: number; fp: number }>();
  for (const run of runs) {
    for (const hit of run.hits) {
      const verdict = judgments.relevance[relevanceKey(run.queryId, hit.chunkId)];
      if (!verdict) continue;
      const bucket = bySource.get(hit.source) ?? { tp: 0, fp: 0 };
      if (verdict === 'relevant') { tp++; bucket.tp++; }
      else { fp++; bucket.fp++; }
      bySource.set(hit.source, bucket);
    }
  }
  const perSource = Array.from(bySource.entries())
    .map(([source, { tp, fp }]) => ({
      source,
      tp,
      fp,
      precision: tp + fp > 0 ? tp / (tp + fp) : null,
    }))
    .sort((a, b) => b.tp + b.fp - (a.tp + a.fp));
  return { tp, fp, precision: tp + fp > 0 ? tp / (tp + fp) : null, perSource };
}

// ─── Weak-query detection (label-free expansion candidates) ───────

export interface WeakQuery {
  queryId: string;
  bestScore: number;
  topSource?: string;
}

/** Queries whose best hit falls below tau — candidates for corpus expansion. */
export function findWeakQueries(runs: readonly QueryRun[], tau: number): WeakQuery[] {
  return runs
    .filter((r) => !r.error && r.bestScore < tau)
    .map((r) => ({ queryId: r.queryId, bestScore: r.bestScore, topSource: r.hits[0]?.source }))
    .sort((a, b) => a.bestScore - b.bestScore);
}

// ─── Formatting helpers ───────────────────────────────────────────

export function pct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export const ORIGIN_LABELS: Record<QueryOrigin, string> = {
  symptom: 'Symptom',
  'failure-mode': 'Failure mode',
  gap: 'Known gap',
  example: 'Example',
  custom: 'Custom',
};
