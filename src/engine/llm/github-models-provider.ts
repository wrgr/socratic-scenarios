/**
 * GitHub Models implementation of ChatCompletionProvider — free-tier alternative
 * to Gemini for chat-completion inference (mentor evaluation, prompt enrichment,
 * simulated-learner responses), authenticated with a personal GitHub token.
 *
 * Scope note: this covers chat completions only, not embeddings. GitHub Models
 * does expose an embeddings endpoint, but it requires an org with Models enabled
 * (not a plain personal-access-token flow), and this app's dense retrieval layer
 * (src/engine/retrieval/dense-retrieval.ts) refuses to mix embeddings from
 * different models in one vector space — so a GitHub Models embedding backend
 * would need its own separately-tagged corpus, which is out of scope here.
 * See docs/whitepaper.md's "Provider Options" section.
 */
import type { ChatCompletionOptions, ChatCompletionProvider } from './types';

const GITHUB_MODELS_ENDPOINT = 'https://models.github.ai/inference/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

function redactToken(message: string, token: string): string {
  return token ? message.split(token).join('[token-redacted]') : message;
}

export function createGithubModelsChatProvider(token: string, model: string = DEFAULT_MODEL): ChatCompletionProvider {
  return {
    async complete(systemInstruction: string, userPrompt: string, options?: ChatCompletionOptions): Promise<string> {
      let response: Response;
      try {
        response = await fetch(GITHUB_MODELS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: userPrompt },
            ],
            ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
          }),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`GitHub Models request failed: ${redactToken(msg, token)}`);
      }

      if (!response.ok) {
        const bodyText = await response.text().catch(() => '');
        throw new Error(
          `GitHub Models request failed: HTTP ${response.status} ${redactToken(bodyText, token).slice(0, 300)}`,
        );
      }

      const data = await response.json();
      const content: unknown = data?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('GitHub Models response missing choices[0].message.content');
      }
      return content;
    },
  };
}
