/**
 * LLM Mentor service — Phase 3 multi-agent layer. Domain-agnostic: the same
 * service evaluates probes for every registered domain (AJP, Tire, COLREG, …),
 * so it carries no domain-specific identity of its own — callers pass the active
 * domain's name via `MentorContext.domainLabel` (see the domain switcher).
 * Uses a chat-completion LLM to evaluate free-text learner responses against the
 * expectedConcepts of a SocraticProbe node, then generates a targeted
 * follow-up probe without revealing the answer on first attempt.
 *
 * Usage (App.tsx):
 *   import { setMentorService, createMentorService } from './engine/mentor';
 *   if (chatProvider) setMentorService(createMentorService(chatProvider));
 *
 * The provider is swappable (Gemini or GitHub Models — see src/engine/llm/) —
 * this service only depends on the ChatCompletionProvider interface, not a
 * specific vendor SDK.
 *
 * Consumer pattern: call getMentorService() — returns null when no provider is set,
 * allowing callers to gracefully degrade to static probe display.
 */
import type { ChatCompletionProvider } from '../llm/types';

// ─── Public Interfaces ────────────────────────────────────────────

/** Input context for a single Mentor evaluation call. */
export interface MentorContext {
  /** The Socratic probe question shown to the learner. */
  probeQuestion: string;
  /** Key concepts a complete answer must address (from SocraticProbe node). */
  expectedConcepts: string[];
  /** Common wrong answers with context (optional enrichment). */
  commonWrongAnswers?: string[];
  /** The learner's free-text response. */
  learnerResponse: string;
  /**
   * Number of prior attempts on this probe (0 = first attempt).
   * At attempt ≥ 2 the Mentor is permitted to reveal the answer.
   */
  priorAttempts: number;
  /** When true, mastery threshold is raised to 0.90 and feedback is firmer. */
  safetyGate?: boolean;
  /**
   * Optional corpus-grounded context from hybrid retrieval (graph + dense).
   * Produced by formatHybridContext() in hybrid-retrieval.ts.
   * When present, the Mentor grounds its response in this retrieved content
   * rather than relying solely on training data.
   */
  retrievalContext?: string;
  /**
   * Active domain's human name (e.g. "Aerosol Jet Printing", "Roadside Tire
   * Change", "COLREG — Collision Avoidance"). Used to frame the Mentor's system
   * instruction for the correct domain. When omitted, a domain-neutral framing
   * is used — never assume a specific domain here.
   */
  domainLabel?: string;
}

/** Structured result returned by the Mentor service. */
export interface MentorEvaluation {
  /** Fraction of expected concepts adequately addressed (0–1). */
  score: number;
  /** 2–3 sentence feedback: acknowledges correct elements, identifies the main gap. */
  feedback: string;
  /** One-sentence follow-up probe targeting the most important missing concept. */
  followUpProbe: string;
  /** True when score ≥ masteryThreshold (default 0.80, 0.90 for safetyGate). */
  masteryPassed: boolean;
  /**
   * True only when this evaluation is a fallback produced after the LLM call
   * failed (network error, quota exceeded) — score/masteryPassed are placeholder
   * values, not a real assessment. Consumers should render this distinctly
   * (e.g. an alert banner) rather than as a normal score.
   */
  degraded?: boolean;
}

/** Mentor service — evaluate a learner response and generate a follow-up probe. */
export interface MentorService {
  evaluate(ctx: MentorContext): Promise<MentorEvaluation>;
}

// ─── Singleton Registry ───────────────────────────────────────────

let _mentorService: MentorService | null = null;

export function setMentorService(service: MentorService): void {
  _mentorService = service;
}

export function getMentorService(): MentorService | null {
  return _mentorService;
}

// ─── Chat-Completion Implementation ────────────────────────────────

/**
 * Build the Mentor's system instruction for the active domain. Domain-agnostic:
 * with a `domainLabel` it names that domain; without one it falls back to a
 * neutral framing so the Mentor never miscredits a scenario to the wrong domain
 * (e.g. an "AJP mentor" grading a tire-change answer).
 */
function systemInstruction(domainLabel?: string): string {
  const role = domainLabel
    ? `an expert ${domainLabel} training mentor`
    : 'an expert technical training mentor for safety-critical, procedural work';
  return `You are ${role}.
Your role is to evaluate learner responses to Socratic probe questions and provide targeted scaffolding.
You speak directly to the learner in second person, are encouraging but precise, and never pad with filler phrases.
Return ONLY valid JSON — no markdown fences, no explanation outside the JSON object.`;
}

function buildPrompt(ctx: MentorContext): string {
  const threshold = ctx.safetyGate ? 0.90 : 0.80;
  const revealAnswer = ctx.priorAttempts >= 2;

  const wrongAnswerBlock =
    ctx.commonWrongAnswers && ctx.commonWrongAnswers.length > 0
      ? `\nCOMMON WRONG ANSWERS TO WATCH FOR:\n${ctx.commonWrongAnswers.map((w) => `- ${w}`).join('\n')}`
      : '';

  const retrievalBlock = ctx.retrievalContext && ctx.retrievalContext.trim().length > 0
    ? `CORPUS CONTEXT (graph + dense retrieval — ground your response in this content):\n${ctx.retrievalContext}\n\n`
    : '';

  return `${retrievalBlock}PROBE QUESTION:
"${ctx.probeQuestion}"

EXPECTED CONCEPTS (a complete answer addresses most of these):
${ctx.expectedConcepts.map((c, i) => `${i + 1}. ${c}`).join('\n')}${wrongAnswerBlock}

LEARNER RESPONSE (attempt ${ctx.priorAttempts + 1}):
"${ctx.learnerResponse}"

MASTERY THRESHOLD: ${threshold}
REVEAL ANSWER IF STILL MISSING: ${revealAnswer}

EVALUATION TASK:
1. Score 0.0–1.0: what fraction of expected concepts did the learner adequately address?
2. Feedback (2–3 sentences):
   - Acknowledge what was correct (be specific about which concepts)
   - Identify the single most important missing or incomplete concept
   - If revealAnswer=true: provide the correct explanation for the gap directly
   - If revealAnswer=false: guide toward the gap WITHOUT giving the answer
3. FollowUpProbe (1 sentence): a question that targets the most important remaining gap.
   If masteryPassed, the follow-up should deepen understanding rather than re-test.

Respond with ONLY this JSON (no other text):
{"score": <number>, "feedback": "<string>", "followUpProbe": "<string>"}`;
}

function parseMentorResponse(
  raw: string,
  ctx: MentorContext,
): MentorEvaluation {
  const threshold = ctx.safetyGate ? 0.90 : 0.80;
  let parsed: { score?: unknown; feedback?: unknown; followUpProbe?: unknown };

  try {
    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```(?:json)?/g, '').trim();
    parsed = JSON.parse(cleaned) as typeof parsed;
  } catch {
    // Fallback if LLM returns malformed JSON
    return {
      score: 0.5,
      feedback:
        'I had trouble processing your response. Please try restating your answer more clearly.',
      followUpProbe: ctx.probeQuestion,
      masteryPassed: false,
    };
  }

  const score = typeof parsed.score === 'number'
    ? Math.max(0, Math.min(1, parsed.score))
    : 0.5;

  return {
    score,
    feedback:
      typeof parsed.feedback === 'string' && parsed.feedback.trim().length > 0
        ? parsed.feedback.trim()
        : 'Keep developing your answer.',
    followUpProbe:
      typeof parsed.followUpProbe === 'string' && parsed.followUpProbe.trim().length > 0
        ? parsed.followUpProbe.trim()
        : ctx.probeQuestion,
    masteryPassed: score >= threshold,
  };
}

/** Create a Mentor service backed by the given chat-completion provider. */
export function createMentorService(provider: ChatCompletionProvider): MentorService {
  return {
    async evaluate(ctx: MentorContext): Promise<MentorEvaluation> {
      const prompt = buildPrompt(ctx);
      try {
        const raw = await provider.complete(systemInstruction(ctx.domainLabel), prompt);
        return parseMentorResponse(raw, ctx);
      } catch (err) {
        // Network error or quota exceeded — fail gracefully
        console.error('[MentorService] LLM call failed:', err);
        return {
          score: 0,
          feedback:
            'The Mentor is temporarily unavailable. Review your answer against the expected concepts and try again.',
          followUpProbe: ctx.probeQuestion,
          masteryPassed: false,
          degraded: true,
        };
      }
    },
  };
}
