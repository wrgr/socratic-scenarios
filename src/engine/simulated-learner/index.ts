/**
 * Simulated Learner service — generates realistic learner responses to a
 * Socratic probe question at a specified expertise level.
 *
 * Domain-agnostic: the same service drives simulated answers for every
 * registered domain (AJP, Tire, COLREG, …). The personas describe a *competence
 * level*, not a specific domain, and the concrete domain context comes from the
 * probe question + expected concepts plus the domain name passed via
 * `SimulatedLearnerContext.domainLabel`. It carries no hard-coded domain
 * vocabulary of its own, so it never puts, say, aerosol-jet-printing terms in a
 * tire-change trainee's mouth.
 *
 * The service drives the "auto-answer" mode in the Workflow Demo and the
 * Simulate control in Scenario Mode, allowing a viewer to watch a simulated
 * novice / technician / expert interact with the LLM Mentor without typing
 * their own responses.
 *
 * Expertise-level personas (competence, not content):
 *   novice      — first-time trainee: knows vocabulary, misses sequences, safety, edge cases
 *   technician  — 6 months supervised: knows procedures, misses nuanced tacit knowledge
 *   expert      — years of experience: full protocols, SOPs, underlying principles, tacit patterns
 *
 * On follow-up attempts the persona is aware of the Mentor's prior feedback and
 * can improve their answer accordingly.
 *
 * Backed by a swappable ChatCompletionProvider (Gemini or GitHub Models — see
 * src/engine/llm/), injected by App.tsx rather than constructed here.
 */
import type { ChatCompletionProvider } from '../llm/types';

// ─── Public interfaces ────────────────────────────────────────────

export type SimulatedExpertiseLevel = 'complete-novice' | 'novice' | 'naive' | 'intermediate' | 'proficient';

export interface SimulatedLearnerContext {
  probeQuestion: string;
  expectedConcepts: string[];
  expertiseLevel: SimulatedExpertiseLevel;
  /** 0 = first attempt, increments on follow-up. */
  priorAttempts: number;
  /** Mentor feedback from the prior evaluation, used on follow-up responses. */
  mentorFeedback?: string;
  /** Follow-up probe text when this is a second attempt. */
  followUpQuestion?: string;
  /**
   * Active domain's human name (e.g. "Aerosol Jet Printing", "Roadside Tire
   * Change"). Frames the persona for the correct domain. When omitted, a neutral
   * framing is used — never assume a specific domain here.
   */
  domainLabel?: string;
}

export interface SimulatedLearnerService {
  generateResponse(ctx: SimulatedLearnerContext): Promise<string>;
}

// ─── Singleton registry ───────────────────────────────────────────

let _learnerService: SimulatedLearnerService | null = null;

export function setSimulatedLearnerService(service: SimulatedLearnerService): void {
  _learnerService = service;
}

export function getSimulatedLearnerService(): SimulatedLearnerService | null {
  return _learnerService;
}

// ─── Persona descriptions ─────────────────────────────────────────

/**
 * Persona builders — parameterized by the active domain's name. Each describes a
 * *competence level* in domain-neutral terms; the concrete subject matter comes
 * from the probe question and expected concepts, never from hard-coded domain
 * vocabulary. `domain` is a readable phrase like "Aerosol Jet Printing",
 * "Roadside Tire Change", or the neutral fallback below.
 */
const PERSONA_BUILDERS: Record<SimulatedExpertiseLevel, (domain: string) => string> = {
  'complete-novice': (domain) => `You are a brand-new assistant who was just assigned to help with ${domain} yesterday. You have no relevant technical background at all.
Your characteristics:
- You have no prior knowledge of ${domain}. You have only the vaguest sense of what it involves.
- You confuse it with superficially similar everyday activities and assume it "works about the same."
- You do not know any of the specialized terms, tools, or measurements involved. If such terms come up, you guess based on ordinary English.
- You have never watched an instrument reading or gauge for this work and have no concept of a nominal or safe range.
- You make confidently wrong guesses ("isn't more always better?").
- You completely miss safety concerns and hazards, brushing them off.
- Your answers are 1–2 sentences, confused, and often ask a clarifying question because you don't understand the question.
- You do NOT connect symptoms or cues to causes — you respond to each situation in isolation with no systematic reasoning.
- You sometimes accidentally say something partially correct for entirely the wrong reason.`,

  novice: (domain) => `You are a technician who has been assigned to ${domain} but has no prior exposure to it specifically. You have solid general technical, field, and instrumentation experience.
Your characteristics:
- You have NO ${domain}-specific vocabulary — you do not know its specialized terms or component names, and you will not use them unless the mentor uses them first.
- You ARE comfortable with general concepts: reading gauges and instruments, following SOPs, handling materials safely, recognizing when something is out of range.
- You apply general reasoning ("if this reading is elevated, something downstream is probably restricted") but you cannot name the ${domain}-specific cause.
- You recognize hazards from general experience but don't know this domain's specific protocols.
- You ask intelligent clarifying questions grounded in general experience ("is this a restriction issue?" or "should I check that connection?").
- Your answers are 2–3 sentences, methodical but terminology-free, showing transferable reasoning without domain vocabulary.
- You do not know the specific procedure sequence, the names of any components, or what the nominal parameter ranges are.`,

  naive: (domain) => `You are a newly assigned ${domain} trainee who has completed classroom training and read the manual, but has never done the work hands-on.
Your characteristics:
- You know the ${domain} vocabulary and can use the terms correctly in a sentence.
- You know the procedure steps by name but not by feel — you know the order but not why it matters or what happens if you skip a step.
- You often confuse the order of operations or miss critical sequencing details when describing a procedure.
- You tend to over-simplify ("just turn it on," "just tighten it") without understanding the tradeoffs.
- You completely miss safety-critical edge cases and tacit knowledge — you know protective steps are required but couldn't say precisely why.
- Your answers are 1–3 sentences, use correct vocabulary, but leave out most of the expected conceptual understanding.
- You do NOT list bullet points — you write naturally as a trainee would speak.
- Occasionally you say something technically correct for entirely the wrong reason.`,

  intermediate: (domain) => `You are a ${domain} practitioner with about 6 months of supervised hands-on experience.
Your characteristics:
- You know the standard operating procedures and can execute most steps correctly without being told.
- You understand the basic reasons behind the sequence of steps (e.g. why a preparatory step must come before the main action).
- You occasionally miss nuanced tacit knowledge — you know WHAT to do but not always WHY at a deep level.
- You may skip explaining edge cases or the specific consequences of getting things wrong.
- Your answers are 3–5 sentences, mostly correct, but missing 1–2 of the subtler expected concepts.
- You write naturally, mixing procedural steps with a little rationale.
- You sometimes use shorthand rather than precise SOP language.`,

  proficient: (domain) => `You are an experienced ${domain} practitioner with several years of hands-on experience.
Your characteristics:
- You know the full protocols and SOPs by memory.
- You understand the underlying principles behind every step (why each preparatory step matters, why timing and sequencing matter).
- You can articulate tacit diagnostic knowledge — what the visual, auditory, and instrument cues mean.
- You address safety-critical concerns proactively and precisely.
- Your answers are comprehensive but not padded — 4–7 sentences covering most expected concepts.
- You reference observable signals and readings naturally.
- You give specific values and timings where relevant.`,
};

// ─── Chat-Completion Implementation ────────────────────────────────

/**
 * Build the roleplay system instruction. Names the active domain when provided,
 * otherwise stays neutral — the learner is never framed as belonging to a domain
 * other than the one being taught.
 */
function systemInstruction(domainLabel?: string): string {
  const who = domainLabel ? `a ${domainLabel} trainee` : 'a trainee';
  return (
    `You are roleplaying as ${who} responding to a mentor question. ` +
    'Write only the learner\'s natural spoken response — no preamble, no "As a novice...", no labels, no quotes. ' +
    'Just the response the learner would give.'
  );
}

/** Neutral domain phrase when no domainLabel is supplied. */
const NEUTRAL_DOMAIN = 'this technical, safety-critical procedure';

function buildLearnerPrompt(ctx: SimulatedLearnerContext): string {
  const persona = PERSONA_BUILDERS[ctx.expertiseLevel](ctx.domainLabel ?? NEUTRAL_DOMAIN);
  const isFollowUp = ctx.priorAttempts > 0 && ctx.mentorFeedback;

  const questionBlock = isFollowUp && ctx.followUpQuestion
    ? `MENTOR'S FOLLOW-UP QUESTION:\n"${ctx.followUpQuestion}"\n\n(The mentor previously said: "${ctx.mentorFeedback}")`
    : `MENTOR'S QUESTION:\n"${ctx.probeQuestion}"`;

  return `${persona}

${questionBlock}

Respond as this learner would — naturally, in plain prose, with no formatting or bullet points. Keep it realistic for your level of experience.`;
}

/** Create a Simulated Learner service backed by the given chat-completion provider. */
export function createSimulatedLearnerService(provider: ChatCompletionProvider): SimulatedLearnerService {
  return {
    async generateResponse(ctx: SimulatedLearnerContext): Promise<string> {
      const prompt = buildLearnerPrompt(ctx);
      try {
        const raw = await provider.complete(systemInstruction(ctx.domainLabel), prompt, { temperature: 0.85 });
        // Strip any accidental quoting the model might add
        return raw.trim().replace(/^["']|["']$/g, '').trim();
      } catch (err) {
        console.error('[SimulatedLearnerService] LLM call failed:', err);
        return 'I am not sure — can you explain the procedure again?';
      }
    },
  };
}
