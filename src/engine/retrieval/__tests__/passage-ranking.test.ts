/** Exercise source-grounded passage retrieval and unsupported-query controls on the repaired corpus. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rankPassages, missingPassageIdentifiers } from '../passage-ranking';
import type { DenseChunk, DenseMatch } from '../dense-retrieval';

interface QueryCase { id: string; question: string; goldChunkIds: string[]; queryVector: string; expectUnsupported: boolean; group: string }
const corpus = JSON.parse(readFileSync(new URL('../../../../public/ajp-corpus.json', import.meta.url), 'utf8')).chunks as DenseChunk[];
const fixture = JSON.parse(readFileSync(new URL('./fixtures/passage-queries.json', import.meta.url), 'utf8')) as { model: string; dimensions: number; queries: QueryCase[] };

function semanticMatches(encoded: string): DenseMatch[] {
  const bytes = Buffer.from(encoded, 'base64');
  const vector = Array.from(new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
  expect(vector).toHaveLength(fixture.dimensions);
  const queryNorm = Math.sqrt(vector.reduce((sum, n) => sum + n * n, 0));
  return corpus.map((chunk) => {
    let dot = 0, norm = 0;
    for (let i = 0; i < vector.length; i++) { dot += vector[i] * chunk.embedding[i]; norm += chunk.embedding[i] ** 2; }
    return { chunk, score: dot / (queryNorm * Math.sqrt(norm)) };
  }).sort((a, b) => b.score - a.score);
}

for (const mode of ['keyword', 'hybrid'] as const) {
  describe(`${mode} passage retrieval`, () => {
    for (const test of fixture.queries) {
      it(`${test.group}: ${test.id}`, () => {
        const semantic = mode === 'hybrid' ? semanticMatches(test.queryVector) : [];
        const result = rankPassages(test.question, corpus, semantic, 5);
        if (test.expectUnsupported) {
          expect(result.evidence.status).toBe('insufficient-evidence');
          expect(result.matches).toHaveLength(0);
        } else {
          expect(result.evidence.status).toBe('passages-found');
          expect(result.matches.some((m) => test.goldChunkIds.includes(m.chunk.id)), result.matches.map((m) => m.chunk.id).join(', ')).toBe(true);
        }
      });
    }
  });
}

it('matches complete identifiers instead of accepting a known longer prefix', () => {
  const chunks = [{ id: 'part', source: 'Service Manual', section: 'Parts', text: 'Use component AB12345.', embedding: [] }];
  expect(missingPassageIdentifiers('What is part AB1234?', chunks)).toEqual(['AB1234']);
  expect(missingPassageIdentifiers('What is part AB12345?', chunks)).toEqual([]);
});

it('keeps two explicitly requested authors available for comparison', () => {
  const chunks = [
    { id: 'fisher', source: 'Fisher 2023 Sensor Review', section: 'Conclusions', text: 'Thermal atomization is needed for microgravity applications.', embedding: [] },
    { id: 'salary', source: 'Salary 2019 Review', section: 'Conclusions', text: 'Thermal and pneumatic atomization are compared.', embedding: [] },
    { id: 'secor', source: 'Secor Aerosol Jet Printing', section: 'Mechanisms', text: 'Aerosol jet printing uses pneumatic and ultrasonic atomization.', embedding: [] },
  ];
  const result = rankPassages('Compare Fisher and Salary reviews on thermal atomization for aerosol jet printing.', chunks);
  expect(new Set(result.matches.map((m) => m.chunk.id))).toEqual(new Set(['fisher', 'salary']));
});
