/**
 * Prompt Enrichment service — HITL query reformulation layer.
 *
 * When enabled, takes a short or underspecified learner query and rewrites it
 * into a well-formed, contextually grounded prompt before retrieval fires.
 * The user always reviews the enriched version (HITL) and may accept, edit,
 * or discard it. Grounded in query reformulation literature (Chehbouni et al.
 * 2025, Zhou et al. 2022 APE, Ahmed et al. 2023 ASAP).
 *
 * Usage (App.tsx):
 *   import { setPromptEnricher, createPromptEnricher } from './engine/prompt-enhancer';
 *   if (geminiKey) setPromptEnricher(createPromptEnricher(geminiKey));
 *   else           setPromptEnricher(createSimulatedEnricher());
 *
 * Consumer pattern: call getPromptEnricher() — always non-null when App.tsx
 * has initialized it (either Gemini or simulated shim).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

// ─── Public Interfaces ────────────────────────────────────────────

/** Contextual signal injected into the enrichment prompt. */
export interface EnrichmentContext {
  /** Domain identifier (e.g. 'software-architecture', 'algebra-2'). */
  domainId: string;
  /** Title of the active learning scenario. */
  scenarioTitle: string;
  /** The current challenge/prompt the learner is working on. */
  promptText: string;
  /** Active guidance style: 'mentor' | 'naive'. */
  guidanceStyle: string;
  /** Active scaffold level: 'high' | 'medium' | 'low'. */
  scaffoldLevel: string;
}

/** Structured result returned by the enricher. */
export interface EnrichmentResult {
  /** The rewritten, contextually enriched prompt ready to send to retrieval. */
  enrichedPrompt: string;
  /**
   * One sentence describing the single most important assumption the enricher
   * made — shown to the learner as a transparency/correctability hook.
   */
  assumptionNote: string;
}

/** Prompt enricher — rewrites a raw learner query into a richer form. */
export interface PromptEnricher {
  enrich(rawQuery: string, context: EnrichmentContext): Promise<EnrichmentResult>;
}

// ─── Singleton Registry ───────────────────────────────────────────

let _enricher: PromptEnricher | null = null;

export function setPromptEnricher(enricher: PromptEnricher): void {
  _enricher = enricher;
}

export function getPromptEnricher(): PromptEnricher | null {
  return _enricher;
}

// ─── Gemini Flash Implementation ──────────────────────────────────

const SYSTEM_INSTRUCTION = `You are a prompt enrichment agent for an educational AI tutoring system.
Your job is to rewrite a short or underspecified learner query into a well-formed, detailed prompt
that will elicit a high-quality pedagogical response from an AI assistant.

Rules:
- Preserve the learner's intent exactly — do NOT change what they are asking for.
- Add specificity: surface implicit constraints, supply missing context from the profile below.
- Add output-format guidance where helpful (e.g. step-by-step, compare X and Y).
- Note the single most important assumption you made in the rewrite.
- Return ONLY valid JSON — no markdown fences, no text outside the JSON object.`;

function buildEnrichPrompt(rawQuery: string, ctx: EnrichmentContext): string {
  return `LEARNER PROFILE:
- Domain: ${ctx.domainId}
- Scenario: ${ctx.scenarioTitle}
- Current challenge: ${ctx.promptText}
- Guidance style: ${ctx.guidanceStyle}, Scaffold level: ${ctx.scaffoldLevel}

ORIGINAL QUERY (learner typed this):
"${rawQuery}"

TASK: Rewrite the query to be specific, well-scoped, and pedagogically useful.
Preserve the learner's intent completely.
Add domain context, clarify the desired output format, and surface any implicit constraints.

Return ONLY this JSON (no other text):
{"enrichedPrompt": "<improved query>", "assumptionNote": "<one sentence describing your key assumption>"}`;
}

function parseEnrichmentResponse(raw: string, fallbackQuery: string): EnrichmentResult {
  try {
    const cleaned = raw.replace(/```(?:json)?/g, '').trim();
    const parsed = JSON.parse(cleaned) as { enrichedPrompt?: unknown; assumptionNote?: unknown };
    const enrichedPrompt =
      typeof parsed.enrichedPrompt === 'string' && parsed.enrichedPrompt.trim().length > 0
        ? parsed.enrichedPrompt.trim()
        : fallbackQuery;
    const assumptionNote =
      typeof parsed.assumptionNote === 'string' && parsed.assumptionNote.trim().length > 0
        ? parsed.assumptionNote.trim()
        : 'No specific assumption noted.';
    return { enrichedPrompt, assumptionNote };
  } catch {
    return { enrichedPrompt: fallbackQuery, assumptionNote: 'Enrichment could not be parsed; showing original query.' };
  }
}

/** Create a prompt enricher backed by Gemini Flash. */
export function createPromptEnricher(apiKey: string): PromptEnricher {
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  return {
    async enrich(rawQuery: string, context: EnrichmentContext): Promise<EnrichmentResult> {
      const prompt = buildEnrichPrompt(rawQuery, context);
      try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        return parseEnrichmentResponse(raw, rawQuery);
      } catch (err) {
        console.error('[PromptEnricher] Gemini call failed:', err);
        return {
          enrichedPrompt: rawQuery,
          assumptionNote: 'Enrichment service unavailable; showing your original query.',
        };
      }
    },
  };
}
