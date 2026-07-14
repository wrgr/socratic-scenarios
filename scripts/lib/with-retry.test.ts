import { describe, it, expect, vi } from 'vitest';
import { withRetry, isRateLimitOrOverloadError } from './with-retry';

describe('isRateLimitOrOverloadError', () => {
  it('matches Gemini-style 429/503 messages', () => {
    expect(isRateLimitOrOverloadError(new Error('[GoogleGenerativeAI Error]: Error fetching from https://... 429 Too Many Requests'))).toBe(true);
    expect(isRateLimitOrOverloadError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isRateLimitOrOverloadError(new Error('Extracted text too short'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { baseDelayMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors up to the configured attempt count, then succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 rate limited'))
      .mockRejectedValueOnce(new Error('503 overloaded'))
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();
    const result = await withRetry(fn, { attempts: 3, baseDelayMs: 0, onRetry });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on a non-retryable error without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Extracted text too short'));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow('too short');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('429 rate limited'));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 0 })).rejects.toThrow('429');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
