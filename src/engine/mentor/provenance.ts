/**
 * provenance.ts — telling structure/RAG-grounded output apart from a naive or
 * baked-in LLM call.
 *
 * Two cheap-to-compute signals plus one rigorous probe:
 *  - `isGrounded` / `extractGroundingNodeIds`: was corpus context actually put
 *    in front of the model, and which nodes? (the "grounded vs naive" tag)
 *  - `diffEvaluations`: given a grounded evaluation and an ablated one (same
 *    answer scored with the corpus context removed), decide whether the corpus
 *    changed the output at all. If it didn't, the Mentor answered from its
 *    parametric priors — "baked-in", not RAG-driven.
 *
 * All functions here are pure and dependency-free so they unit-test without an
 * API key.
 */

/** A minimal shape of a Mentor evaluation this module needs to reason about. */
export interface EvaluationLike {
  score: number;
  feedback: string;
}

/** True when a non-empty corpus context string was assembled for the prompt. */
export function isGrounded(retrievalContext?: string): boolean {
  return !!(retrievalContext && retrievalContext.trim().length > 0);
}

/**
 * Best-effort extraction of the node ids embedded in a formatted retrieval
 * context (e.g. `[TACIT-ESD-HANDLING-001 · relevance 40%]`, `[HAZARD-ESD-001]`).
 * Callers that hold the structured results should pass ids explicitly instead;
 * this is the fallback for pre-formatted strings.
 */
export function extractGroundingNodeIds(retrievalContext?: string): string[] {
  if (!retrievalContext) return [];
  const ids = new Set<string>();
  // Node ids appear immediately after a "[" and end at " ·" (relevance) or "]".
  const re = /\[([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)(?: ·|\])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(retrievalContext)) !== null) ids.add(m[1]);
  return [...ids];
}

// ─── Ablation diff (rigorous: did the corpus actually matter?) ────────────────

export interface AblationDiff<T extends EvaluationLike = EvaluationLike> {
  /** Evaluation produced WITH corpus grounding. */
  grounded: T;
  /** Same learner answer scored WITHOUT the corpus context. */
  ablated: T;
  /** grounded.score − ablated.score (signed). */
  scoreDelta: number;
  /** Jaccard token overlap of the two feedback strings (0–1; 1 = identical). */
  feedbackSimilarity: number;
  /**
   * True when removing the corpus materially changed the output — the answer
   * was genuinely RAG-driven. False ⇒ the corpus made no difference, i.e. the
   * Mentor was drawing on baked-in knowledge, not the structure.
   */
  ragDependent: boolean;
}

export interface AblationThresholds {
  /** Minimum |scoreDelta| that counts as material. Default 0.15. */
  scoreEps?: number;
  /** Feedback similarity below this counts as diverged. Default 0.5. */
  simThreshold?: number;
}

/** Jaccard token overlap, matching graph-utils.tokenSimilarity (kept local so
 *  this module stays dependency-free and unit-testable without the graph). */
export function tokenOverlap(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set((s.toLowerCase().match(/[a-z]+/g) ?? []).filter((t) => t.length > 2));
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  const inter = [...A].filter((t) => B.has(t)).length;
  const union = new Set([...A, ...B]).size;
  return union === 0 ? 0 : inter / union;
}

/**
 * Compare a grounded evaluation against its ablated (corpus-removed) twin and
 * decide whether the corpus changed the answer.
 */
export function diffEvaluations<T extends EvaluationLike>(
  grounded: T,
  ablated: T,
  thresholds: AblationThresholds = {},
): AblationDiff<T> {
  const scoreEps = thresholds.scoreEps ?? 0.15;
  const simThreshold = thresholds.simThreshold ?? 0.5;

  const scoreDelta = grounded.score - ablated.score;
  const feedbackSimilarity = tokenOverlap(grounded.feedback, ablated.feedback);
  const ragDependent =
    Math.abs(scoreDelta) >= scoreEps || feedbackSimilarity < simThreshold;

  return { grounded, ablated, scoreDelta, feedbackSimilarity, ragDependent };
}
