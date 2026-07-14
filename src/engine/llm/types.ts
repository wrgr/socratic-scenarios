/**
 * Shared chat-completion provider interface used by the mentor, prompt-enhancer,
 * and simulated-learner services, so any of them can run against Gemini or
 * GitHub Models without changing their evaluation/prompt-building logic.
 *
 * Note: this is deliberately separate from the retrieval layer's EmbeddingProvider
 * (src/engine/retrieval/index.ts) — chat completion and embeddings are different
 * capabilities with different provider availability (see github-models-provider.ts).
 */

export interface ChatCompletionOptions {
  /** Sampling temperature, when the caller wants something other than the provider default. */
  temperature?: number;
}

export interface ChatCompletionProvider {
  complete(systemInstruction: string, userPrompt: string, options?: ChatCompletionOptions): Promise<string>;
}
