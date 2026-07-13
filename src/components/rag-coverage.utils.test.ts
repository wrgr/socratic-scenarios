import { describe, it, expect } from 'vitest';
import {
  toQueryText,
  queriesFromNodes,
  queriesFromGaps,
  computeSourceCoverage,
  computeUnusedChunks,
  buildHeatmap,
  computeQueryOutcome,
  summarizeConfusion,
  summarizeChunkPrecision,
  findWeakQueries,
  relevanceKey,
  type EvalQuery,
  type QueryRun,
  type ChunkInventoryItem,
  type JudgmentSnapshot,
} from './rag-coverage.utils';

const inventory: ChunkInventoryItem[] = [
  { id: 'a1', source: 'A', section: 's' },
  { id: 'a2', source: 'A', section: 's' },
  { id: 'a3', source: 'A', section: 's' },
  { id: 'b1', source: 'B', section: 's' },
  { id: 'c1', source: 'C', section: 's' }, // never retrieved
];

const runs: QueryRun[] = [
  {
    queryId: 'q1',
    bestScore: 0.8,
    hits: [
      { chunkId: 'a1', source: 'A', section: 's', score: 0.8, rank: 0 },
      { chunkId: 'b1', source: 'B', section: 's', score: 0.5, rank: 1 },
    ],
  },
  {
    queryId: 'q2',
    bestScore: 0.2, // weak
    hits: [{ chunkId: 'a2', source: 'A', section: 's', score: 0.2, rank: 0 }],
  },
];

describe('toQueryText', () => {
  it('collapses whitespace and keeps short content', () => {
    expect(toQueryText('  hello\n  world ')).toBe('hello world');
  });
  it('clips long content at a sentence boundary when possible', () => {
    const long = 'First sentence here that is reasonably long. ' + 'x'.repeat(200);
    expect(toQueryText(long)).toBe('First sentence here that is reasonably long.');
  });
  it('hard-clips with an ellipsis when no sentence boundary fits', () => {
    const out = toQueryText('x'.repeat(300), 50);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(51);
  });
});

describe('query seeding', () => {
  it('builds stable ids from nodes and gaps', () => {
    expect(queriesFromNodes([{ id: 'SYMPT-1', content: 'pressure high' }], 'symptom')).toEqual([
      { id: 'q-symptom-SYMPT-1', text: 'pressure high', origin: 'symptom', refId: 'SYMPT-1' },
    ]);
    expect(queriesFromGaps([{ id: 'GAP-003', summary: 'sheath table' }])[0].id).toBe('q-gap-GAP-003');
  });
});

describe('computeSourceCoverage', () => {
  it('aggregates hits, distinct chunks, and coverage ratio per source', () => {
    const cov = computeSourceCoverage(runs, inventory);
    const a = cov.find((c) => c.source === 'A')!;
    expect(a.totalChunks).toBe(3);
    expect(a.chunksHit).toBe(2); // a1, a2
    expect(a.hitCount).toBe(2);
    expect(a.queriesHitting).toBe(2);
    expect(a.bestScore).toBeCloseTo(0.8);
    expect(a.coverageRatio).toBeCloseTo(2 / 3);

    const c = cov.find((c) => c.source === 'C')!;
    expect(c.chunksHit).toBe(0);
    expect(c.coverageRatio).toBe(0);
  });
});

describe('computeUnusedChunks', () => {
  it('returns chunks never present in any top-K', () => {
    const unused = computeUnusedChunks(runs, inventory);
    expect(unused.map((u) => u.id)).toEqual(['a3', 'c1']);
  });
});

describe('buildHeatmap', () => {
  it('produces per-query source cells restricted to sourceOrder', () => {
    const queries: EvalQuery[] = [
      { id: 'q1', text: '', origin: 'custom' },
      { id: 'q2', text: '', origin: 'custom' },
    ];
    const hm = buildHeatmap(queries, runs, ['A', 'B']);
    expect(hm.sources).toEqual(['A', 'B']);
    const q1 = hm.rows.find((r) => r.queryId === 'q1')!;
    expect(q1.cells.A).toEqual({ count: 1, bestScore: 0.8 });
    expect(q1.cells.B).toEqual({ count: 1, bestScore: 0.5 });
    const q2 = hm.rows.find((r) => r.queryId === 'q2')!;
    expect(q2.cells.A.count).toBe(1);
    expect(q2.cells.B).toBeUndefined();
  });
});

describe('computeQueryOutcome + confusion matrix', () => {
  const q1: EvalQuery = { id: 'q1', text: '', origin: 'custom' };
  const q2: EvalQuery = { id: 'q2', text: '', origin: 'custom' };
  const tau = 0.35;

  it('uses the score proxy before any judging', () => {
    const empty: JudgmentSnapshot = { relevance: {}, answerable: {} };
    expect(computeQueryOutcome(q1, runs[0], empty, tau).hitState).toBe('proxy-hit');
    expect(computeQueryOutcome(q2, runs[1], empty, tau).hitState).toBe('proxy-miss');
  });

  it('lets judged relevance override the proxy in both directions', () => {
    // q2 is a proxy-miss (0.2 < tau) but judged relevant → judged-hit.
    const j: JudgmentSnapshot = {
      relevance: { [relevanceKey('q2', 'a2')]: 'relevant' },
      answerable: {},
    };
    expect(computeQueryOutcome(q2, runs[1], j, tau).hitState).toBe('judged-hit');
    expect(computeQueryOutcome(q2, runs[1], j, tau).hit).toBe(true);

    // q1 is a proxy-hit but every retrieved chunk judged irrelevant → judged-miss.
    const j2: JudgmentSnapshot = {
      relevance: {
        [relevanceKey('q1', 'a1')]: 'irrelevant',
        [relevanceKey('q1', 'b1')]: 'irrelevant',
      },
      answerable: {},
    };
    expect(computeQueryOutcome(q1, runs[0], j2, tau).hitState).toBe('judged-miss');
    expect(computeQueryOutcome(q1, runs[0], j2, tau).hit).toBe(false);
  });

  it('maps answerable × hit to the right confusion cell', () => {
    const j: JudgmentSnapshot = { relevance: {}, answerable: { q1: 'yes', q2: 'yes' } };
    expect(computeQueryOutcome(q1, runs[0], j, tau).cell).toBe('TP'); // answerable + hit
    expect(computeQueryOutcome(q2, runs[1], j, tau).cell).toBe('FN'); // answerable + miss

    const j2: JudgmentSnapshot = { relevance: {}, answerable: { q1: 'no', q2: 'no' } };
    expect(computeQueryOutcome(q1, runs[0], j2, tau).cell).toBe('FP'); // not-answerable + hit
    expect(computeQueryOutcome(q2, runs[1], j2, tau).cell).toBe('TN'); // not-answerable + miss
  });

  it('excludes unknown-answerable queries from the matrix', () => {
    const empty: JudgmentSnapshot = { relevance: {}, answerable: {} };
    const o1 = computeQueryOutcome(q1, runs[0], empty, tau);
    expect(o1.cell).toBeNull();
    const sum = summarizeConfusion([o1]);
    expect(sum.unlabeled).toBe(1);
    expect(sum.precision).toBeNull();
  });

  it('computes precision/recall/f1/accuracy from a full matrix', () => {
    // 2 TP, 1 FP, 1 FN, 1 TN
    const outcomes = [
      { cell: 'TP' }, { cell: 'TP' }, { cell: 'FP' }, { cell: 'FN' }, { cell: 'TN' },
    ].map((o) => ({ ...o } as ReturnType<typeof computeQueryOutcome>));
    const sum = summarizeConfusion(outcomes);
    expect(sum).toMatchObject({ TP: 2, FP: 1, FN: 1, TN: 1, unlabeled: 0 });
    expect(sum.precision).toBeCloseTo(2 / 3);
    expect(sum.recall).toBeCloseTo(2 / 3);
    expect(sum.f1).toBeCloseTo(2 / 3);
    expect(sum.accuracy).toBeCloseTo(3 / 5);
  });
});

describe('summarizeChunkPrecision', () => {
  it('counts judged pairs per source', () => {
    const j: JudgmentSnapshot = {
      relevance: {
        [relevanceKey('q1', 'a1')]: 'relevant',
        [relevanceKey('q1', 'b1')]: 'irrelevant',
      },
      answerable: {},
    };
    const cp = summarizeChunkPrecision(runs, j);
    expect(cp.tp).toBe(1);
    expect(cp.fp).toBe(1);
    expect(cp.precision).toBeCloseTo(0.5);
    expect(cp.perSource.find((s) => s.source === 'A')!.precision).toBe(1);
    expect(cp.perSource.find((s) => s.source === 'B')!.precision).toBe(0);
  });
});

describe('findWeakQueries', () => {
  it('flags queries below tau, sorted ascending', () => {
    const weak = findWeakQueries(runs, 0.35);
    expect(weak.map((w) => w.queryId)).toEqual(['q2']);
    expect(weak[0].topSource).toBe('A');
  });
});
