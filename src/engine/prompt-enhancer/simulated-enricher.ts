/**
 * Simulated prompt enricher — deterministic local shim.
 *
 * Provides heuristic query enrichment without requiring a Gemini API key.
 * Mirrors the createSimulatedProvider() pattern used for embeddings, ensuring
 * the prompt enrichment toggle is always functional in development and demo
 * contexts.
 */
import type { EnrichmentContext, EnrichmentResult, PromptEnricher } from './index';

/** Create a deterministic local enricher that adds domain/scenario framing. */
export function createSimulatedEnricher(): PromptEnricher {
  return {
    async enrich(rawQuery: string, ctx: EnrichmentContext): Promise<EnrichmentResult> {
      const trimmed = rawQuery.trim();

      // Inject domain + scenario framing and request structured output
      const contextPrefix = `In the context of ${ctx.domainId} (scenario: "${ctx.scenarioTitle}"):`;
      const formatSuffix = `Please provide a step-by-step explanation relevant to: ${ctx.promptText.slice(0, 100).trim()}`;

      const enrichedPrompt = [contextPrefix, trimmed, formatSuffix].join(' ');

      return {
        enrichedPrompt,
        assumptionNote:
          'Assumed you want a structured, domain-grounded explanation within the current scenario context.',
      };
    },
  };
}
