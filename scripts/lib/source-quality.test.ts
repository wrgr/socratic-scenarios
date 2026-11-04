/** Exercise extraction failures observed in the shipped Nature article and OEM manual. */
import { describe, expect, it } from 'vitest';
import { assertCompletePdfText, assertEmbedding, chunkBelongsToSource, prepareSourceText, safeSourceError } from './source-quality';

const document = 'Technical procedures and safety information. '.repeat(100);

describe('source text quality', () => {
  it('rejects a long browser challenge even when it passes the old length threshold', () => {
    expect(() => prepareSourceText(`Client Challenge JavaScript is disabled in your browser. ${document}`)).toThrow('browser challenge');
  });
  it('rejects inaccessible or empty extracts', () => {
    expect(() => prepareSourceText('unavailable')).toThrow('too short');
  });
  it('removes the entire revision log but retains operational content and scrubbing', () => {
    const text = `P/N 9000983 Revisions Employee A authored the manual. Employee B revised it. Disclaimer ${document} Decathlon`;
    const clean = prepareSourceText(text, true);
    expect(clean).not.toContain('Employee');
    expect(clean).not.toContain('Decathlon');
    expect(clean).toContain('Disclaimer');
    expect(clean).toContain(document);
    expect(clean).toContain('HD2');
  });
  it('keeps complete document text without a revision log', () => {
    expect(prepareSourceText(document, true)).toBe(document);
  });
});

describe('model extraction completeness', () => {
  it('rejects output cut off by the generation limit', () => {
    expect(() => assertCompletePdfText(document, document, 'MAX_TOKENS')).toThrow('did not finish');
  });
  it('rejects suspicious condensation even with a successful finish reason', () => {
    expect(() => assertCompletePdfText(document.slice(0, 500), document, 'STOP')).toThrow('less than 80%');
  });
  it('allows ordinary cleanup of a complete text layer', () => {
    expect(() => assertCompletePdfText(document, document, 'STOP')).not.toThrow();
  });
});

it('preserves other source namespaces during a targeted replacement', () => {
  expect(chunkBelongsToSource('hd2-process-manual-chunk-0', 'hd2-process-manual')).toBe(true);
  expect(chunkBelongsToSource('hd2-process-manual-extra-chunk-0', 'hd2-process-manual')).toBe(false);
});

it('rejects incompatible dimensions and non-finite vectors', () => {
  expect(() => assertEmbedding([1, 2], 3)).toThrow('Invalid embedding');
  expect(() => assertEmbedding([1, NaN, 2], 3)).toThrow('Invalid embedding');
  expect(() => assertEmbedding([1, 2, 3], 3)).not.toThrow();
});

it('redacts provider credentials from source errors', () => {
  expect(safeSourceError(new Error(`request failed: AIza${'x'.repeat(35)}`))).toBe('request failed: [key-redacted]');
});

it('drops PDF download watermarks without retaining reader identifiers', () => {
  const text = `${document}\nDownloaded from publisher.example by reader@example.invalid on 2020-01-01\nMore technical content.`;
  const clean = prepareSourceText(text);
  expect(clean).not.toContain('reader@');
  expect(clean).not.toContain('Downloaded from');
  expect(clean).toContain('More technical content.');
});
