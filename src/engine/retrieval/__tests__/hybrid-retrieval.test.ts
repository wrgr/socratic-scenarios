/**
 * hybrid-retrieval.test.ts
 *
 * Tests the hybrid retrieval merge logic:
 * - Graph-only path (no embedding provider or dense data)
 * - formatHybridContext output shape
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { retrieveHybrid, formatHybridContext } from '../hybrid-retrieval';
import { setEmbeddingProvider } from '../index';
import { setDenseBackend } from '../dense-retrieval';
import type { DenseBackend, DenseChunk } from '../dense-retrieval';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChunk(id: string, text: string): DenseChunk {
  return {
    id,
    source: 'Test SOP',
    section: 'Section 1',
    text,
    embedding: Array.from({ length: 768 }, () => Math.random()),
  };
}

function makeBackend(chunks: DenseChunk[]): DenseBackend {
  return {
    async query(_queryEmbedding, topK) {
      return chunks.slice(0, topK).map((c) => ({ chunk: c, score: 0.75 }));
    },
    hasData() {
      return chunks.length > 0;
    },
    modelId() {
      return undefined;
    },
  };
}

// ─── Graph-only path ──────────────────────────────────────────────────────────

describe('retrieveHybrid — graph-only (no embedding provider)', () => {
  beforeEach(() => {
    // Ensure no embedding provider is set
    setEmbeddingProvider(null as unknown as Parameters<typeof setEmbeddingProvider>[0]);
    setDenseBackend(makeBackend([]));
  });

  it('returns graph chains for known symptom text', async () => {
    const result = await retrieveHybrid({
      symptomText: 'pressure elevated and line looks narrow',
    });
    expect(result.graphChains.length).toBeGreaterThan(0);
    expect(result.hasDenseData).toBe(false);
    expect(result.denseMatches).toHaveLength(0);
    expect(result.queryText).toBe('pressure elevated and line looks narrow');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('graphTopK limits the number of chains', async () => {
    const result = await retrieveHybrid({
      symptomText: 'pressure elevated clog nozzle atomizer',
      graphTopK: 1,
    });
    expect(result.graphChains.length).toBeLessThanOrEqual(1);
  });

  it('hasDenseData is false when no backend data', async () => {
    const result = await retrieveHybrid({ symptomText: 'nozzle pressure clog' });
    expect(result.hasDenseData).toBe(false);
  });
});

// ─── Graph + dense path ───────────────────────────────────────────────────────

describe('retrieveHybrid — with dense backend and embedding provider', () => {
  beforeEach(() => {
    // Simulated embedding provider
    setEmbeddingProvider({
      embed: async (texts: string[]) => texts.map(() => Array(768).fill(0.1)),
      cosineSimilarity(a, b) {
        const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
        const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
        const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
        return magA && magB ? dot / (magA * magB) : 0;
      },
    });
    setDenseBackend(
      makeBackend([
        makeChunk('chunk-1', 'Sheath gas prevents clogging by keeping aerosol focused through the nozzle.'),
        makeChunk('chunk-2', 'Partial nozzle occlusion causes elevated KEWB pressure and reduced line width.'),
      ]),
    );
  });

  it('returns both graph chains and dense matches', async () => {
    const result = await retrieveHybrid({
      symptomText: 'pressure elevated and line looks narrow',
      denseTopK: 2,
    });
    expect(result.graphChains.length).toBeGreaterThan(0);
    expect(result.denseMatches.length).toBeGreaterThan(0);
    expect(result.hasDenseData).toBe(true);
  });

  it('denseTopK limits the number of dense matches', async () => {
    const result = await retrieveHybrid({
      symptomText: 'pressure elevated clog',
      denseTopK: 1,
    });
    expect(result.denseMatches.length).toBeLessThanOrEqual(1);
  });
});

// ─── formatHybridContext ──────────────────────────────────────────────────────

describe('formatHybridContext', () => {
  it('includes graph chain content when chains are present', () => {
    const fakeResult = {
      graphChains: [
        {
          anchorId: 'FAULT-CLOG-PARTIAL-001',
          anchorScore: 0.8,
          fault: { id: 'FAULT-CLOG-PARTIAL-001', type: 'FailureMode' as const, content: 'Partial nozzle occlusion', confidence: 'High' as const, source: 'Test' },
          symptoms: [
            { id: 'SYMPT-HIGH-PRESSURE-001', type: 'Symptom' as const, content: 'KEWB pressure above nominal', confidence: 'High' as const, source: 'Test' },
          ],
          correctiveActions: [
            { id: 'ACTION-SHEATH-INCREASE-001', type: 'CorrectiveAction' as const, content: 'Increase sheath gas by 0.5 PSI', confidence: 'High' as const, source: 'Test' },
          ],
          safetyHazards: [],
          tacitNodes: [],
          score: 0.8,
        },
      ],
      denseMatches: [],
      hasDenseData: false,
      nodeMatchTrace: [],
      queryText: 'pressure elevated',
      timestamp: Date.now(),
    };
    const ctx = formatHybridContext(fakeResult);
    expect(ctx).toContain('Knowledge Graph');
    expect(ctx).toContain('Partial nozzle occlusion');
    expect(ctx).toContain('KEWB pressure above nominal');
    expect(ctx).toContain('Increase sheath gas');
  });

  it('includes SOP context section when dense matches are present', () => {
    const fakeResult = {
      graphChains: [],
      denseMatches: [
        {
          chunk: {
            id: 'chunk-1',
            source: 'Stanford SNF SOP',
            section: 'Section 9',
            text: 'Sheath gas must be flowing at nominal pressure before atomizer start.',
            embedding: [],
          },
          score: 0.82,
        },
      ],
      hasDenseData: true,
      nodeMatchTrace: [],
      queryText: 'sheath gas sequence',
      timestamp: Date.now(),
    };
    const ctx = formatHybridContext(fakeResult);
    expect(ctx).toContain('SOP / Literature Context');
    expect(ctx).toContain('Stanford SNF SOP');
    expect(ctx).toContain('Sheath gas must be flowing');
  });

  it('returns empty string when no graph chains and no dense matches', () => {
    const fakeResult = {
      graphChains: [],
      denseMatches: [],
      hasDenseData: false,
      nodeMatchTrace: [],
      queryText: 'nothing',
      timestamp: Date.now(),
    };
    expect(formatHybridContext(fakeResult)).toBe('');
  });
});
