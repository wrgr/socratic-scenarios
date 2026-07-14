import { describe, it, expect } from 'vitest';
import { chunkWords } from './chunk-text';

function words(n: number, prefix = 'w'): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
}

describe('chunkWords', () => {
  it('drops trailing fragments below minTrailingWords', () => {
    // First window takes all 320 words (total < wordsPerChunk); the stride (300) then
    // leaves a 20-word remainder for the second window, below the default 30-word floor.
    const text = words(320);
    const chunks = chunkWords(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content.split(/\s+/)).toHaveLength(320);
  });

  it('keeps trailing fragments at or above minTrailingWords', () => {
    // Windows start at 0, 300, 600 (stride 300); 690 total words leaves a 90-word remainder at 600, above the floor.
    const text = words(690);
    const chunks = chunkWords(text);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].content.split(/\s+/)).toHaveLength(90);
  });

  it('overlaps consecutive windows by the configured overlap', () => {
    const text = words(600);
    const chunks = chunkWords(text, { wordsPerChunk: 350, overlap: 50 });
    expect(chunks).toHaveLength(2);
    const firstWords = chunks[0].content.split(/\s+/);
    const secondWords = chunks[1].content.split(/\s+/);
    // Last 50 words of chunk 0 should equal first 50 words of chunk 1.
    expect(firstWords.slice(-50)).toEqual(secondWords.slice(0, 50));
  });

  it('assigns sequential indices', () => {
    const chunks = chunkWords(words(1000));
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
  });

  it('derives a sectionHint from the first sentence', () => {
    const text = `Intro sentence here. ${words(340)}`;
    const chunks = chunkWords(text);
    expect(chunks[0].sectionHint).toBe('Intro sentence here');
  });

  it('respects custom wordsPerChunk/overlap/minTrailingWords', () => {
    const chunks = chunkWords(words(100), { wordsPerChunk: 40, overlap: 10, minTrailingWords: 5 });
    // stride = 30: windows start at 0, 30, 60, 90 -> last window has 10 words (>= 5, kept)
    expect(chunks).toHaveLength(4);
    expect(chunks[3].content.split(/\s+/)).toHaveLength(10);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkWords('')).toEqual([]);
  });
});
