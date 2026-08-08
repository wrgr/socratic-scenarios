/**
 * Auto-select a Bedrock discrimination matrix — one small / medium / large model per provider
 * — from what is ACTUALLY enabled in your account/region, so nobody has to curate models.txt.
 *
 *   AWS_REGION=us-east-1 npx tsx pick-models.ts            # prints invocation ids (stdout)
 *   PROVIDERS=Anthropic,Meta,Amazon npx tsx pick-models.ts # choose providers
 *   SELFTEST=1 npx tsx pick-models.ts                      # offline unit test of the picker
 *
 * Discovery uses the AWS CLI (already on a DLAMI; no extra SDK dep). Only the chosen ids go to
 * stdout (one per line) so sweep.sh can consume them; a human-readable table goes to stderr.
 */
import { execFileSync } from 'node:child_process';

// Never crash with a stack trace if the reader (e.g. sweep.sh) closes stdout early.
process.stdout.on('error', (e: NodeJS.ErrnoException) => { if (e.code === 'EPIPE') process.exit(0); throw e; });

export type FM = {
  modelId: string;
  modelArn?: string;
  providerName?: string;
  modelName?: string;
  inferenceTypesSupported?: string[];
  modelLifecycle?: { status?: string };
};
export type Pick = { provider: string; size: string; name: string; id: string; score: number };

/** Rough "B-equivalent" size so a provider's models sort small→large. Explicit parameter
 * counts win (70b, 8x7b, 405b); otherwise a keyword tier (haiku<sonnet<opus, micro<lite<pro). */
export function sizeScore(name: string): number {
  const n = name.toLowerCase();
  const moe = n.match(/(\d+)\s*x\s*(\d+)\s*b\b/); // 8x7b -> 56
  if (moe) return parseInt(moe[1], 10) * parseInt(moe[2], 10);
  const b = n.match(/(\d+(?:\.\d+)?)\s*b\b/); // 70b, 8b, 405b, 3.5 -> "3.5b"? guarded by \bb
  if (b) return parseFloat(b[1]);
  const tiers: Array<[RegExp, number]> = [
    [/micro|nano|tiny/, 1],
    [/mini|haiku|flash|small|light\b/, 6],
    [/\blite\b/, 12],
    [/sonnet|command-r(?![-+ ]?plus)|medium|jamba/, 40],
    [/\bpro\b/, 90],
    [/opus|premier|\blarge\b|command-r[-+ ]?plus|\bplus\b/, 300],
  ];
  for (const [re, s] of tiers) if (re.test(n)) return s;
  return NaN; // unknown → not rankable, excluded
}

/** Invokable id: prefer a cross-region inference profile (needed by many newer models),
 * else the bare id if the model is on-demand, else null (can't invoke without provisioning). */
export function invocationId(m: FM, profilesByArn: Map<string, string>): string | null {
  const prof = m.modelArn ? profilesByArn.get(m.modelArn) : undefined;
  if (prof) return prof;
  if ((m.inferenceTypesSupported ?? []).includes('ON_DEMAND')) return m.modelId;
  return null;
}

export function selectMatrix(models: FM[], profilesByArn: Map<string, string>, providers: string[]): Pick[] {
  const out: Pick[] = [];
  for (const prov of providers) {
    const cand = models
      .filter((m) => (m.providerName ?? '').toLowerCase().includes(prov.toLowerCase()))
      .filter((m) => (m.modelLifecycle?.status ?? 'ACTIVE') === 'ACTIVE')
      .map((m) => ({ m, id: invocationId(m, profilesByArn), score: sizeScore(m.modelName ?? m.modelId) }))
      .filter((x): x is { m: FM; id: string; score: number } => !!x.id && Number.isFinite(x.score));

    // Dedup models that land in the same size bucket, keeping the newest (ids encode date/version).
    const byScore = new Map<number, { m: FM; id: string; score: number }>();
    for (const x of cand) {
      const cur = byScore.get(x.score);
      if (!cur || x.id > cur.id) byScore.set(x.score, x);
    }
    const uniq = [...byScore.values()].sort((a, b) => a.score - b.score);
    if (!uniq.length) continue;

    const idx = uniq.length <= 3 ? uniq.map((_, i) => i) : [0, Math.floor((uniq.length - 1) / 2), uniq.length - 1];
    const picks = [...new Set(idx)].map((i) => uniq[i]);
    const labels = picks.length === 1 ? ['only'] : picks.length === 2 ? ['small', 'large'] : ['small', 'medium', 'large'];
    picks.forEach((p, i) => out.push({ provider: prov, size: labels[i] ?? `pick${i}`, name: p.m.modelName ?? p.m.modelId, id: p.id, score: p.score }));
  }
  return out;
}

function awsJson(args: string[], region: string): Record<string, unknown> {
  const raw = execFileSync('aws', ['bedrock', ...args, '--region', region, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(raw);
}

function main() {
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const providers = (process.env.PROVIDERS ?? 'Anthropic,Meta,Amazon').split(',').map((s) => s.trim()).filter(Boolean);

  let models: FM[] = [];
  try {
    models = ((awsJson(['list-foundation-models', '--by-output-modality', 'TEXT'], region).modelSummaries as FM[]) ?? []);
  } catch (e) {
    console.error(`pick-models: aws bedrock list-foundation-models failed (${(e as Error).message.split('\n')[0]}).`);
    console.error('Check AWS creds/region and the Bedrock permission bedrock:ListFoundationModels.');
    process.exit(2);
  }
  const profilesByArn = new Map<string, string>();
  try {
    const profs = (awsJson(['list-inference-profiles'], region).inferenceProfileSummaries as Array<{ inferenceProfileId: string; models?: Array<{ modelArn?: string }> }>) ?? [];
    // Prefer a `global.` cross-region profile over a regional (`us.`/`eu.`/…) one: the newest
    // Claude models (Sonnet/Opus 5) are invokable via `global.` but their regional profile id
    // resolves to a model the account can't call ("… is not available for this account").
    const profRank = (id: string) => (id.startsWith('global.') ? 3 : /^(us|eu|apac|ap)\./.test(id) ? 2 : 1);
    for (const p of profs)
      for (const mm of p.models ?? []) {
        if (!mm.modelArn) continue;
        const cur = profilesByArn.get(mm.modelArn);
        if (!cur || profRank(p.inferenceProfileId) > profRank(cur)) profilesByArn.set(mm.modelArn, p.inferenceProfileId);
      }
  } catch {
    /* inference profiles optional / may be unauthorized — fall back to on-demand ids */
  }

  const picks = selectMatrix(models, profilesByArn, providers);
  if (!picks.length) {
    console.error('pick-models: no invokable text models matched the requested providers in ' + region + '.');
    console.error('Enable model access (Bedrock console → Model access) or widen PROVIDERS, then retry.');
    process.exit(3);
  }
  console.error(`Auto-selected ${picks.length} models in ${region} (provider × size):`);
  for (const p of picks) console.error(`  ${p.provider.padEnd(10)} ${p.size.padEnd(7)} ${p.id}   (${p.name})`);
  console.error('');
  for (const p of picks) console.log(p.id); // stdout = ids only, for sweep.sh
}

function selfTest() {
  const fm = (modelId: string, providerName: string, modelName: string): FM => ({ modelId, modelArn: `arn:${modelId}`, providerName, modelName, inferenceTypesSupported: ['ON_DEMAND'], modelLifecycle: { status: 'ACTIVE' } });
  const models: FM[] = [
    fm('anthropic.claude-3-5-haiku-20241022-v1:0', 'Anthropic', 'Claude 3.5 Haiku'),
    fm('anthropic.claude-3-5-sonnet-20240620-v1:0', 'Anthropic', 'Claude 3.5 Sonnet'),
    fm('anthropic.claude-3-5-sonnet-20241022-v2:0', 'Anthropic', 'Claude 3.5 Sonnet v2'),
    fm('anthropic.claude-3-opus-20240229-v1:0', 'Anthropic', 'Claude 3 Opus'),
    fm('meta.llama3-1-8b-instruct-v1:0', 'Meta', 'Llama 3.1 8B Instruct'),
    fm('meta.llama3-1-70b-instruct-v1:0', 'Meta', 'Llama 3.1 70B Instruct'),
    fm('meta.llama3-1-405b-instruct-v1:0', 'Meta', 'Llama 3.1 405B Instruct'),
    fm('amazon.nova-micro-v1:0', 'Amazon', 'Nova Micro'),
    fm('amazon.nova-lite-v1:0', 'Amazon', 'Nova Lite'),
    fm('amazon.nova-pro-v1:0', 'Amazon', 'Nova Pro'),
  ];
  const picks = selectMatrix(models, new Map(), ['Anthropic', 'Meta', 'Amazon']);
  const got = picks.map((p) => `${p.provider}/${p.size}=${p.id}`).join('\n');
  const expect = [
    'Anthropic/small=anthropic.claude-3-5-haiku-20241022-v1:0',
    'Anthropic/medium=anthropic.claude-3-5-sonnet-20241022-v2:0', // newest sonnet, dedup by score
    'Anthropic/large=anthropic.claude-3-opus-20240229-v1:0',
    'Meta/small=meta.llama3-1-8b-instruct-v1:0',
    'Meta/medium=meta.llama3-1-70b-instruct-v1:0',
    'Meta/large=meta.llama3-1-405b-instruct-v1:0',
    'Amazon/small=amazon.nova-micro-v1:0',
    'Amazon/medium=amazon.nova-lite-v1:0',
    'Amazon/large=amazon.nova-pro-v1:0',
  ].join('\n');
  console.log(got);
  console.log(got === expect ? 'SELFTEST: PASS' : 'SELFTEST: FAIL\n--- expected ---\n' + expect);
  process.exit(got === expect ? 0 : 1);
}

if (process.env.SELFTEST === '1') selfTest();
else main();
