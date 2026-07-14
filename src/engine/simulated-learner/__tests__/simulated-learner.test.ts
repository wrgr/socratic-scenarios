import { describe, it, expect, vi } from 'vitest';
import { createSimulatedLearnerService } from '../index';
import type { ChatCompletionProvider } from '../../llm/types';
import type { SimulatedLearnerContext } from '../index';

function stubProvider(complete: ChatCompletionProvider['complete']): ChatCompletionProvider {
  return { complete };
}

const ctx: SimulatedLearnerContext = {
  probeQuestion: 'What do you check first?',
  expectedConcepts: ['sheath gas pressure'],
  expertiseLevel: 'intermediate',
  priorAttempts: 0,
};

describe('createSimulatedLearnerService', () => {
  it('trims and unquotes the provider response', async () => {
    const provider = stubProvider(async () => '  "I would check the sheath gas pressure first."  ');
    const service = createSimulatedLearnerService(provider);
    const result = await service.generateResponse(ctx);
    expect(result).toBe('I would check the sheath gas pressure first.');
  });

  it('passes temperature 0.85 to the provider for persona variability', async () => {
    const complete = vi.fn<ChatCompletionProvider['complete']>(async () => 'a response');
    const service = createSimulatedLearnerService(stubProvider(complete));
    await service.generateResponse(ctx);

    expect(complete).toHaveBeenCalledTimes(1);
    const [, , options] = complete.mock.calls[0];
    expect(options).toEqual({ temperature: 0.85 });
  });

  it('falls back to a generic response when the provider call fails', async () => {
    const provider = stubProvider(async () => {
      throw new Error('429 rate limited');
    });
    const service = createSimulatedLearnerService(provider);
    const result = await service.generateResponse(ctx);
    expect(result).toMatch(/not sure/i);
  });
});
