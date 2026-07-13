/** This module implements engine retrieval simulated provider. */
import type { EmbeddingProvider } from './index';

/**
 * A TF-IDF vector-space embedding provider for simulation and demos.
 *
 * Builds a vocabulary from all texts seen in a single `embed()` call,
 * then represents each text as a TF-IDF weighted vector. Cosine
 * similarity between these vectors reflects genuine textual overlap,
 * making it suitable for running the simulation harness without an
 * external embedding API.
 */
export function createSimulatedProvider(): EmbeddingProvider {
  return {
    async embed(texts: string[]): Promise<number[][]> {
      // Build vocabulary across all texts
      const tokenized = texts.map(tokenize);
      const vocab = new Map<string, number>();
      const docFreq = new Map<string, number>();

      for (const tokens of tokenized) {
        const unique = new Set(tokens);
        for (const t of unique) {
          docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
          if (!vocab.has(t)) vocab.set(t, vocab.size);
        }
      }

      const vocabSize = vocab.size;
      const nDocs = texts.length;

      // Create TF-IDF vectors
      return tokenized.map((tokens) => {
        const vec = new Array<number>(vocabSize).fill(0);
        const tf = new Map<string, number>();
        for (const t of tokens) {
          tf.set(t, (tf.get(t) ?? 0) + 1);
        }
        for (const [term, count] of tf) {
          const idx = vocab.get(term)!;
          const idf = Math.log((nDocs + 1) / ((docFreq.get(term) ?? 0) + 1)) + 1;
          vec[idx] = (count / tokens.length) * idf;
        }
        // L2-normalize
        const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
        if (norm > 0) {
          for (let i = 0; i < vec.length; i++) vec[i] /= norm;
        }
        return vec;
      });
    },

    cosineSimilarity(a: number[], b: number[]): number {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      const denom = Math.sqrt(na) * Math.sqrt(nb);
      return denom === 0 ? 0 : dot / denom;
    },
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
