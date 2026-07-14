import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGithubModelsChatProvider } from '../github-models-provider';

describe('createGithubModelsChatProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the system/user messages and returns the completion content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello there' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGithubModelsChatProvider('gh-token-123');
    const result = await provider.complete('system prompt', 'user prompt');

    expect(result).toBe('hello there');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://models.github.ai/inference/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer gh-token-123');
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
  });

  it('passes temperature through when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGithubModelsChatProvider('gh-token-123');
    await provider.complete('sys', 'user', { temperature: 0.85 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.85);
  });

  it('throws with the token redacted from the error message on a non-ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited for token gh-token-123',
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGithubModelsChatProvider('gh-token-123');
    await expect(provider.complete('sys', 'user')).rejects.toThrow(/HTTP 429/);

    try {
      await provider.complete('sys', 'user');
      expect.unreachable('expected complete() to throw');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toContain('gh-token-123');
      expect(message).toContain('[token-redacted]');
    }
  });

  it('throws when the response has no message content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = createGithubModelsChatProvider('gh-token-123');
    await expect(provider.complete('sys', 'user')).rejects.toThrow(/missing choices/);
  });
});
