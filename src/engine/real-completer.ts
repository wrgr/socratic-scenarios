/**
 * Shared real-model completer selection from the environment — Bedrock (Converse) plus the
 * OpenAI-compatible / Gemini / GitHub-Models providers. Used by the gated live functional tests so
 * they run through the SAME providers as the sweeps. (The two runners still carry their own copies
 * for now; this is the canonical home for new code.)
 *
 * Auth is always the provider's standard chain — for Bedrock the AWS credential chain (env / SSO /
 * instance role); nothing is ever passed in here.
 */
import { geminiCompleter, openAiCompatCompleter, type Completer } from './colreg-sim';

type BedrockContentBlock = { text?: string; reasoningContent?: { reasoningText?: { text?: string } } };
type BedrockConverseResponse = { output?: { message?: { content?: BedrockContentBlock[] } } };

/** AWS Bedrock via the Converse API. Lazy-imports the SDK so it's only required when used. */
export function bedrockCompleter(cfg: { model: string; region?: string; maxTokens?: number }): Completer {
  let clientP: Promise<{ client: { send: (c: unknown) => Promise<BedrockConverseResponse> }; ConverseCommand: new (i: unknown) => unknown }> | null = null;
  const load = () =>
    (clientP ??= import('@aws-sdk/client-bedrock-runtime').then(({ BedrockRuntimeClient, ConverseCommand }) => ({
      client: new BedrockRuntimeClient({ region: cfg.region ?? process.env.AWS_REGION ?? 'us-east-1' }),
      ConverseCommand,
    })));
  return async (prompt: string) => {
    const { client, ConverseCommand } = await load();
    const res = await client.send(
      new ConverseCommand({
        modelId: cfg.model,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        // Reasoning models (e.g. gpt-oss) need headroom past the analysis channel or the answer
        // block comes back empty; non-reasoning models still stop early.
        inferenceConfig: { temperature: 0, maxTokens: cfg.maxTokens ?? Number(process.env.BEDROCK_MAX_TOKENS) || 4096 },
      }),
    );
    const blocks = res.output?.message?.content ?? [];
    const text = blocks.map((c) => c.text ?? '').join('').trim();
    // Fallback: some models return the answer only in the reasoning channel.
    return text || blocks.map((c) => c.reasoningContent?.reasoningText?.text ?? '').join('').trim();
  };
}

/** Pick a real completer from the environment, Bedrock first. Returns null if no credential is set. */
export function selectRealCompleter(): { completer: Completer; label: string } | null {
  const env = process.env;
  if (env.BEDROCK_MODEL)
    return { completer: bedrockCompleter({ model: env.BEDROCK_MODEL, region: env.AWS_REGION }), label: `bedrock(${env.BEDROCK_MODEL})` };
  if (env.GEMINI_API_KEY)
    return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.5-flash'), label: `gemini(${env.GEMINI_MODEL ?? 'gemini-2.5-flash'})` };
  if (env.OPENAI_API_KEY)
    return { completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini' }), label: `openai(${env.OPENAI_MODEL ?? 'gpt-4o-mini'})` };
  if (env.GITHUB_MODELS_TOKEN)
    return { completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini' }), label: 'github-models' };
  return null;
}
