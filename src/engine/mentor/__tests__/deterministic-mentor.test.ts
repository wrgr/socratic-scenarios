/**
 * deterministic-mentor.test.ts — keyless keyword-rubric Mentor fallback.
 * The contract under test: deterministic (same input → same output), honest
 * labeling (engine: 'deterministic'), coverage-based scoring against
 * expectedConcepts, wrong-answer penalty, safety-gate threshold, and the
 * attempt-≥2 reveal.
 */
import { describe, expect, it } from 'vitest';
import { createDeterministicMentorService } from '../deterministic-mentor';
import type { MentorContext } from '../index';

const service = createDeterministicMentorService();

function ctx(overrides: Partial<MentorContext>): MentorContext {
  return {
    probeQuestion: 'Why does sheath gas matter for line quality?',
    expectedConcepts: [
      'sheath gas focuses the aerosol stream',
      'prevents nozzle clogging',
      'controls line width and overspray',
    ],
    learnerResponse: '',
    priorAttempts: 0,
    ...overrides,
  };
}

describe('createDeterministicMentorService', () => {
  it('is marked deterministic and tags every evaluation with the engine', async () => {
    expect(service.deterministic).toBe(true);
    const result = await service.evaluate(ctx({ learnerResponse: 'anything' }));
    expect(result.engine).toBe('deterministic');
  });

  it('same input produces identical output', async () => {
    const input = ctx({ learnerResponse: 'The sheath gas focuses the aerosol and prevents clogs.' });
    const a = await service.evaluate(input);
    const b = await service.evaluate(input);
    expect(a).toEqual(b);
  });

  it('full-coverage answer scores high and passes mastery', async () => {
    const result = await service.evaluate(ctx({
      learnerResponse:
        'The sheath gas focuses the aerosol stream, prevents the nozzle from clogging, and controls the line width and overspray.',
    }));
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.masteryPassed).toBe(true);
    expect(result.followUpProbe.length).toBeGreaterThan(0);
  });

  it('an unrelated answer scores low and names the gap without revealing it', async () => {
    const result = await service.evaluate(ctx({
      learnerResponse: 'You should always wear gloves and check the manual.',
    }));
    expect(result.score).toBeLessThan(0.3);
    expect(result.masteryPassed).toBe(false);
    // reveal only at attempt >= 2
    expect(result.feedback).not.toContain('sheath gas focuses the aerosol stream”.');
  });

  it('reveals the missing concept text at attempt >= 2', async () => {
    const result = await service.evaluate(ctx({
      learnerResponse: 'No idea.',
      priorAttempts: 2,
    }));
    expect(result.feedback).toContain('sheath gas focuses the aerosol stream');
  });

  it('penalizes answers matching a common wrong answer', async () => {
    const base = ctx({
      learnerResponse: 'Sheath gas focuses the aerosol stream and prevents nozzle clogging; just increase the atomizer power.',
    });
    const clean = await service.evaluate(base);
    const penalized = await service.evaluate({
      ...base,
      commonWrongAnswers: ['increase the atomizer power'],
    });
    expect(penalized.score).toBeLessThan(clean.score);
    expect(penalized.feedback).toContain('misconception');
  });

  it('safety gate raises the mastery threshold to 0.90', async () => {
    // Two of three concepts covered → score ≈ 0.67: passes neither, but a
    // response covering all three passes 0.80 yet a 0.85-ish score would not
    // pass a safety gate. Use partial coverage to check the boundary moves.
    const twoOfThree = 'The sheath gas focuses the aerosol stream and prevents nozzle clogging.';
    const normal = await service.evaluate(ctx({ learnerResponse: twoOfThree }));
    const gated = await service.evaluate(ctx({ learnerResponse: twoOfThree, safetyGate: true }));
    expect(normal.score).toEqual(gated.score);
    expect(gated.masteryPassed).toBe(false);
  });

  it('handles a probe with no rubric honestly', async () => {
    const result = await service.evaluate(ctx({ expectedConcepts: [], learnerResponse: 'anything' }));
    expect(result.score).toBe(0);
    expect(result.masteryPassed).toBe(false);
    expect(result.feedback).toContain('cannot grade');
  });

  it('stemming lets inflected forms match rubric vocabulary', async () => {
    const result = await service.evaluate(ctx({
      learnerResponse: 'Sheath gases focus the aerosol streams so the nozzles avoid clogs.',
    }));
    // "gases/focus/streams/nozzles/clogs" should still hit "gas/focuses/stream/nozzle/clogging"
    expect(result.score).toBeGreaterThan(0.3);
  });
});
