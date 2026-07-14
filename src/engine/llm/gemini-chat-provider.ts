/**
 * Gemini implementation of ChatCompletionProvider — thin wrapper around the same
 * @google/generative-ai calls the mentor/prompt-enhancer/simulated-learner services
 * used to make directly, now behind the provider-agnostic interface so those
 * services can also run against GitHub Models (see github-models-provider.ts).
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatCompletionOptions, ChatCompletionProvider } from './types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export function createGeminiChatProvider(apiKey: string, model: string = DEFAULT_MODEL): ChatCompletionProvider {
  const genai = new GoogleGenerativeAI(apiKey);

  return {
    async complete(systemInstruction: string, userPrompt: string, options?: ChatCompletionOptions): Promise<string> {
      const genModel = genai.getGenerativeModel({
        model,
        systemInstruction,
        ...(options?.temperature !== undefined
          ? { generationConfig: { temperature: options.temperature } }
          : {}),
      });
      const result = await genModel.generateContent(userPrompt);
      return result.response.text();
    },
  };
}
