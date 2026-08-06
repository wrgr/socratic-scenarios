import { describe, it, expect, vi } from 'vitest';
import { createMentorService } from '../index';
import type { ChatCompletionProvider } from '../../llm/types';
import type { MentorContext } from '../index';

function stubProvider(complete: ChatCompletionProvider['complete']): ChatCompletionProvider {
  return { complete };
}

const baseCtx: MentorContext = {
  probeQuestion: 'Why does sheath gas turn on before the atomizer?',
  expectedConcepts: ['prevents nozzle clogging', 'stabilizes aerosol stream'],
  learnerResponse: 'It keeps the nozzle from clogging.',
  priorAttempts: 0,
};

describe('createMentorService', () => {
  it('parses a well-formed provider response into a MentorEvaluation', async () => {
    const provider = stubProvider(async () =>
      JSON.stringify({ score: 0.9, feedback: 'Great job.', followUpProbe: 'What happens if you skip it?' }),
    );
    const service = createMentorService(provider);
    const result = await service.evaluate(baseCtx);

    expect(result).toEqual({
      score: 0.9,
      feedback: 'Great job.',
      followUpProbe: 'What happens if you skip it?',
      masteryPassed: true,
      // No retrievalContext in baseCtx → the evaluation is ungrounded (naive).
      grounded: false,
      groundingNodeIds: [],
    });
    expect(result.degraded).toBeUndefined();
  });

  it('tags the evaluation grounded and carries the grounding node ids when corpus context is supplied', async () => {
    const provider = stubProvider(async () =>
      JSON.stringify({ score: 0.7, feedback: 'Good start.', followUpProbe: 'And then?' }),
    );
    const service = createMentorService(provider);
    const result = await service.evaluate({
      ...baseCtx,
      retrievalContext: '[TACIT-EXAMPLE-001] some corpus background',
      groundingNodeIds: ['TACIT-EXAMPLE-001'],
    });

    expect(result.grounded).toBe(true);
    expect(result.groundingNodeIds).toEqual(['TACIT-EXAMPLE-001']);
  });

  it('raises the mastery threshold to 0.90 under a safety gate', async () => {
    const provider = stubProvider(async () => JSON.stringify({ score: 0.85, feedback: 'Close.', followUpProbe: 'Try again.' }));
    const service = createMentorService(provider);
    const result = await service.evaluate({ ...baseCtx, safetyGate: true });
    expect(result.masteryPassed).toBe(false);
  });

  it('marks the result degraded (not a real 0%) when the provider call fails', async () => {
    const provider = stubProvider(async () => {
      throw new Error('429 rate limited');
    });
    const service = createMentorService(provider);
    const result = await service.evaluate(baseCtx);

    expect(result.degraded).toBe(true);
    expect(result.score).toBe(0);
    expect(result.masteryPassed).toBe(false);
    expect(result.feedback).toMatch(/temporarily unavailable/i);
  });

  it('falls back gracefully (not degraded) on malformed JSON from a live provider response', async () => {
    const provider = stubProvider(async () => 'not valid json at all');
    const service = createMentorService(provider);
    const result = await service.evaluate(baseCtx);

    // A malformed-but-successful response is a different failure mode than a
    // service outage — it should NOT be flagged degraded (that flag is reserved
    // for the provider call itself throwing, e.g. network/quota errors).
    expect(result.degraded).toBeUndefined();
    expect(result.score).toBe(0.5);
  });

  it('passes the built prompt and system instruction to the provider', async () => {
    const complete = vi.fn<ChatCompletionProvider['complete']>(async () =>
      JSON.stringify({ score: 1, feedback: 'ok', followUpProbe: 'ok' }),
    );
    const service = createMentorService(stubProvider(complete));
    await service.evaluate(baseCtx);

    expect(complete).toHaveBeenCalledTimes(1);
    const [systemInstruction, userPrompt] = complete.mock.calls[0];
    // No domainLabel → domain-neutral framing (never a hard-coded domain).
    expect(systemInstruction).toMatch(/training mentor/i);
    expect(systemInstruction).not.toMatch(/AJP|Aerosol Jet/i);
    expect(userPrompt).toContain(baseCtx.probeQuestion);
  });

  it('frames the system instruction for the domain passed via domainLabel', async () => {
    const complete = vi.fn<ChatCompletionProvider['complete']>(async () =>
      JSON.stringify({ score: 1, feedback: 'ok', followUpProbe: 'ok' }),
    );
    const service = createMentorService(stubProvider(complete));
    await service.evaluate({ ...baseCtx, domainLabel: 'Roadside Tire Change' });

    const [systemInstruction] = complete.mock.calls[0];
    expect(systemInstruction).toMatch(/expert Roadside Tire Change training mentor/i);
    expect(systemInstruction).not.toMatch(/AJP|Aerosol Jet/i);
  });
});
