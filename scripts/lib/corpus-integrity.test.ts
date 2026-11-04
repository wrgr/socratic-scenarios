/** Validate every shipped document chunk, manifest count, and embedding after corpus repairs. */
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { assertEmbedding, chunkBelongsToSource, assertSourceContent } from './source-quality';

interface Chunk { id: string; source: string; text: string; embedding: number[] }
interface Source { id: string; label: string; chunks: number; status: string }
const corpus = JSON.parse(readFileSync(new URL('../../public/ajp-corpus.json', import.meta.url), 'utf8')) as {
  totalChunks: number; model: string; chunks: Chunk[]; sourcesSummary: Source[];
};

it('ships a consistent source inventory with unique chunk IDs', () => {
  expect(corpus.totalChunks).toBe(corpus.chunks.length);
  expect(new Set(corpus.chunks.map((chunk) => chunk.id)).size).toBe(corpus.chunks.length);
  for (const source of corpus.sourcesSummary) {
    const chunks = corpus.chunks.filter((chunk) => chunkBelongsToSource(chunk.id, source.id));
    expect(chunks.length, source.id).toBe(source.chunks);
    expect(chunks.every((chunk) => chunk.source === source.label), source.id).toBe(true);
  }
  expect(corpus.chunks.every((chunk) => corpus.sourcesSummary.some((source) => chunkBelongsToSource(chunk.id, source.id)))).toBe(true);
});

it('ships finite vectors in the corpus model space and no browser-challenge extracts', () => {
  expect(corpus.model).toBe('gemini-embedding-001');
  for (const chunk of corpus.chunks) {
    expect(() => assertEmbedding(chunk.embedding), chunk.id).not.toThrow();
    // Some legitimate trailing chunks are under 200 characters; validate the
    // containing source below rather than rejecting valid short tails here.
    expect(chunk.text.trim().length, chunk.id).toBeGreaterThan(0);
  }
  for (const source of corpus.sourcesSummary.filter((source) => source.status === 'ok')) {
    const text = corpus.chunks.filter((chunk) => chunkBelongsToSource(chunk.id, source.id)).map((chunk) => chunk.text).join(' ');
    expect(() => assertSourceContent(text), source.id).not.toThrow();
  }
});
