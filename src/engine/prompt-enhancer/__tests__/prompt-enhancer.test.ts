import { describe, it, expect } from 'vitest';
import { createPromptEnricher } from '../index';
import type { ChatCompletionProvider } from '../../llm/types';
import type { EnrichmentContext } from '../index';

function stubProvider(complete: ChatCompletionProvider['complete']): ChatCompletionProvider {
  return { complete };
}

const ctx: EnrichmentContext = {
  domainId: 'ajp',
  scenarioTitle: 'Startup Sequence',
  promptText: 'Bring the HD2 to a ready state.',
  guidanceStyle: 'mentor',
  scaffoldLevel: 'medium',
};

describe('createPromptEnricher', () => {
  it('parses a well-formed provider response', async () => {
    const provider = stubProvider(async () =>
      JSON.stringify({ enrichedPrompt: 'Rewritten query', assumptionNote: 'Assumed default flow rate.' }),
    );
    const enricher = createPromptEnricher(provider);
    const result = await enricher.enrich('flow rate?', ctx);

    expect(result).toEqual({ enrichedPrompt: 'Rewritten query', assumptionNote: 'Assumed default flow rate.' });
  });

  it('falls back to the original query when the provider call fails', async () => {
    const provider = stubProvider(async () => {
      throw new Error('503 overloaded');
    });
    const enricher = createPromptEnricher(provider);
    const result = await enricher.enrich('flow rate?', ctx);

    expect(result.enrichedPrompt).toBe('flow rate?');
    expect(result.assumptionNote).toMatch(/unavailable/i);
  });

  it('falls back to the original query on malformed JSON', async () => {
    const provider = stubProvider(async () => 'not json');
    const enricher = createPromptEnricher(provider);
    const result = await enricher.enrich('flow rate?', ctx);

    expect(result.enrichedPrompt).toBe('flow rate?');
    expect(result.assumptionNote).toMatch(/could not be parsed/i);
  });
});
