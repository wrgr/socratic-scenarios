/**
 * Shared word-window chunker used by both the legacy JSON ingestion pipeline
 * (scripts/ingest-corpus.ts) and the SQLite-backed pipeline (scripts/db/ingest-sources.ts).
 * Splits text into overlapping ~350-word windows; trailing fragments below
 * minTrailingWords are dropped rather than shipped as near-empty chunks.
 */

export interface ChunkTextOptions {
  wordsPerChunk?: number;
  overlap?: number;
  minTrailingWords?: number;
}

export interface RawTextChunk {
  index: number;
  content: string;
  /** First sentence of the chunk, truncated — useful as a section hint. */
  sectionHint: string;
}

const DEFAULT_WORDS_PER_CHUNK = 350;
const DEFAULT_OVERLAP = 50;
const DEFAULT_MIN_TRAILING_WORDS = 30;
const SECTION_HINT_MAX_LENGTH = 80;

export function chunkWords(text: string, options: ChunkTextOptions = {}): RawTextChunk[] {
  const wordsPerChunk = options.wordsPerChunk ?? DEFAULT_WORDS_PER_CHUNK;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const minTrailingWords = options.minTrailingWords ?? DEFAULT_MIN_TRAILING_WORDS;

  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const chunks: RawTextChunk[] = [];
  let idx = 0;
  let index = 0;

  while (idx < words.length) {
    const slice = words.slice(idx, idx + wordsPerChunk);
    if (slice.length < minTrailingWords) break;

    const content = slice.join(' ');
    const sectionHint = content.split(/[.!?]/)[0].trim().slice(0, SECTION_HINT_MAX_LENGTH);

    chunks.push({ index, content, sectionHint });

    idx += wordsPerChunk - overlap;
    index++;
  }

  return chunks;
}
