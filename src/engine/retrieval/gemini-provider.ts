/** This module implements engine retrieval gemini provider. */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmbeddingProvider } from './index';

// gemini-embedding-001 returns 3072-dim vectors at default and they come
// pre-normalized (unit L2). Truncated outputs (outputDimensionality < 3072)
// would need manual L2 renormalization — we avoid that by using the full
// dim everywhere so chunks, nodes, and queries all share one vector space.

/**
 * Creates an EmbeddingProvider backed by Google's gemini-embedding-001 model.
 *
 * Usage (in App.tsx or equivalent entry point):
 *   import { createGeminiProvider } from './engine/retrieval/gemini-provider';
 *   import { setEmbeddingProvider } from './engine/retrieval';
 *   setEmbeddingProvider(createGeminiProvider(import.meta.env.VITE_GEMINI_API_KEY));
 */
export function createGeminiProvider(apiKey: string): EmbeddingProvider {
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: 'gemini-embedding-001' });

  return {
    modelId: 'gemini-embedding-001',

    async embed(texts: string[]): Promise<number[][]> {
      const results = await Promise.all(
        texts.map((t) => model.embedContent(t)),
      );
      return results.map((r) => r.embedding.values);
    },

    cosineSimilarity(a: number[], b: number[]): number {
      let dot = 0, na = 0, nb = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
      }
      if (na === 0 || nb === 0) return 0;
      return dot / (Math.sqrt(na) * Math.sqrt(nb));
    },
  };
}
