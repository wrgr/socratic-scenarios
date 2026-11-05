/** Ensure missing document identifiers stop retrieval before any external embedding request. */
import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const corpus = readFileSync(new URL('../../../../public/ajp-corpus.json', import.meta.url), 'utf8');
afterEach(() => vi.unstubAllGlobals());

it('withholds graph chains, passages, and mentor evidence for an unknown part', async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(corpus, { headers: { 'content-type': 'application/json' } })));
  const { bootActiveDomain } = await import('../../../domains/boot');
  bootActiveDomain();
  const { setEmbeddingProvider } = await import('../index');
  const embed = vi.fn(async () => [[1]]);
  setEmbeddingProvider({ modelId: 'gemini-embedding-001', embed, cosineSimilarity: () => 1 });
  const { retrieveHybrid, formatHybridContext } = await import('../hybrid-retrieval');
  const result = await retrieveHybrid({ symptomText: 'What is the service life of replacement part ZX-999999?' });
  expect(result.evidence?.status).toBe('insufficient-evidence');
  expect(result.corpusAvailable).toBe(true);
  expect(result.denseMatches).toEqual([]);
  expect(result.graphChains).toEqual([]);
  expect(result.nodeMatchTrace).toEqual([]);
  expect(embed).not.toHaveBeenCalled();
  expect(formatHybridContext(result)).toContain('NO SUPPORTING PASSAGE');
});
