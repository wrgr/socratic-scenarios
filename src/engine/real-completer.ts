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
export function bedrockCompleter(cfg: { model: string; region?: string; maxTokens?: number; temperature?: number }): Completer {
  let clientP: Promise<{ client: { send: (c: unknown) => Promise<BedrockConverseResponse> }; ConverseCommand: new (i: unknown) => unknown }> | null = null;
  const load = () =>
    (clientP ??= import('@aws-sdk/client-bedrock-runtime').then(({ BedrockRuntimeClient, ConverseCommand }) => ({
      // Cast the concrete SDK types down to the loose local shape so this file type-checks without
      // pinning the browser build to the AWS SDK's generic command/response types.
      client: new BedrockRuntimeClient({ region: cfg.region ?? process.env.AWS_REGION ?? 'us-east-1' }) as unknown as {
        send: (c: unknown) => Promise<BedrockConverseResponse>;
      },
      ConverseCommand: ConverseCommand as unknown as new (i: unknown) => unknown,
    })));
  return async (prompt: string) => {
    const { client, ConverseCommand } = await load();
    const inferenceConfig = {
      // Reasoning models (e.g. gpt-oss) need headroom past the analysis channel or the answer
      // block comes back empty; non-reasoning models still stop early.
      temperature: cfg.temperature ?? Number(process.env.TEMP ?? 0),
      maxTokens: cfg.maxTokens ?? (Number(process.env.BEDROCK_MAX_TOKENS) || 4096),
    };
    const call = (modelId: string) =>
      client.send(new ConverseCommand({ modelId, messages: [{ role: 'user', content: [{ text: prompt }] }], inferenceConfig }));
    let res: BedrockConverseResponse;
    try {
      res = await call(cfg.model);
    } catch (e) {
      // Most current Bedrock models are invocable ONLY through a cross-region inference profile; the
      // bare model id then errors with "on-demand throughput isn't supported / use an inference
      // profile." Transparently retry once with the "us." profile prefix (unless already prefixed).
      const msg = (e as Error).message ?? '';
      if (/inference profile|on-demand throughput/i.test(msg) && !/^(us|eu|apac)\./i.test(cfg.model)) {
        res = await call(`us.${cfg.model}`);
      } else {
        throw e;
      }
    }
    const blocks = res.output?.message?.content ?? [];
    const text = blocks.map((c) => c.text ?? '').join('').trim();
    // Fallback: some models return the answer only in the reasoning channel.
    return text || blocks.map((c) => c.reasoningContent?.reasoningText?.text ?? '').join('').trim();
  };
}

/**
 * Pick a real completer from the environment, Bedrock first. Returns null if no credential is set.
 * `opts.temperature` overrides the decode temperature for EVERY provider (0 = deterministic point
 * estimate; >0 for a sampled ensemble) — without it Bedrock falls back to env TEMP, and Gemini/OpenAI
 * to their own defaults.
 */
export function selectRealCompleter(opts: { temperature?: number } = {}): { completer: Completer; label: string } | null {
  const env = process.env;
  const t = opts.temperature;
  if (env.BEDROCK_MODEL)
    return { completer: bedrockCompleter({ model: env.BEDROCK_MODEL, region: env.AWS_REGION, temperature: t }), label: `bedrock(${env.BEDROCK_MODEL})` };
  if (env.GEMINI_API_KEY)
    return { completer: geminiCompleter(env.GEMINI_API_KEY, env.GEMINI_MODEL ?? 'gemini-2.5-flash', t), label: `gemini(${env.GEMINI_MODEL ?? 'gemini-2.5-flash'})` };
  if (env.OPENAI_API_KEY)
    return { completer: openAiCompatCompleter({ baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL ?? 'gpt-4o-mini', temperature: t }), label: `openai(${env.OPENAI_MODEL ?? 'gpt-4o-mini'})` };
  if (env.GITHUB_MODELS_TOKEN)
    return { completer: openAiCompatCompleter({ baseUrl: 'https://models.github.ai/inference', apiKey: env.GITHUB_MODELS_TOKEN, model: env.GITHUB_MODELS_MODEL ?? 'openai/gpt-4o-mini', temperature: t }), label: 'github-models' };
  return null;
}
