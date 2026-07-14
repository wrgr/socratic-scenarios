/**
 * Small retry/backoff helper for ingestion's external API calls (Gemini extraction
 * and embedding), which routinely hit free-tier 429/503 errors. Without this, a
 * single rate-limited call causes that source to silently contribute 0 chunks.
 */

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  backoffFactor?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, attempts: number, err: unknown, delayMs: number) => void;
}

const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 2000;
const DEFAULT_BACKOFF_FACTOR = 2;

/** Matches Gemini's rate-limit/overload error shapes, e.g. "[GoogleGenerativeAI Error]: ... 429 ..." */
export function isRateLimitOrOverloadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b(429|503)\b/.test(msg) || /rate.?limit|overloaded|too many requests|service unavailable/i.test(msg);
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const isRetryable = options.isRetryable ?? isRateLimitOrOverloadError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts || !isRetryable(err)) throw err;
      const delayMs = baseDelayMs * backoffFactor ** (attempt - 1);
      options.onRetry?.(attempt, attempts, err, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable — the loop always returns or throws — but keeps TS satisfied.
  throw new Error('withRetry: exhausted attempts without a result or error');
}
