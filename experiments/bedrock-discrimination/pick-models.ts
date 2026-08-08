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
/** Returns true if `id` is actually invokable by this account (a 1-token Converse succeeds).
 * Injected so selection is unit-testable offline; omitted → every candidate assumed invokable. */
export type ProbeFn = (id: string) => boolean;

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

type Cand = { m: FM; id: string; score: number };

export function selectMatrix(
  models: FM[],
  profilesByArn: Map<string, string>,
  providers: string[],
  probe?: ProbeFn,
): Pick[] {
  // Memoize the probe: each id is Converse-tested at most once across all providers/slots.
  const memo = new Map<string, boolean>();
  const ok = (id: string): boolean => {
    if (!probe) return true;
    if (!memo.has(id)) memo.set(id, probe(id));
    return memo.get(id)!;
  };

  const out: Pick[] = [];
  for (const prov of providers) {
    const cand: Cand[] = models
      .filter((m) => (m.providerName ?? '').toLowerCase().includes(prov.toLowerCase()))
      .filter((m) => (m.modelLifecycle?.status ?? 'ACTIVE') === 'ACTIVE')
      .map((m) => ({ m, id: invocationId(m, profilesByArn), score: sizeScore(m.modelName ?? m.modelId) }))
      .filter((x): x is Cand => !!x.id && Number.isFinite(x.score));
    if (!cand.length) continue;

    // Group by size score; within a group sort NEWEST-FIRST (id string desc, since ids encode
    // date/version) so a slot tries the latest model and, if it's not invokable, the prior one.
    const groups = new Map<number, Cand[]>();
    for (const x of cand) (groups.get(x.score) ?? groups.set(x.score, []).get(x.score)!).push(x);
    const scores = [...groups.keys()].sort((a, b) => a - b);
    for (const s of scores) groups.get(s)!.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

    // Slots map to the low / middle / high size groups (fewer groups → fewer slots).
    const n = scores.length;
    const slots =
      n <= 1 ? [{ label: 'only', i: 0 }]
      : n === 2 ? [{ label: 'small', i: 0 }, { label: 'large', i: n - 1 }]
      : [{ label: 'small', i: 0 }, { label: 'medium', i: Math.floor((n - 1) / 2) }, { label: 'large', i: n - 1 }];

    // For each slot, take the newest INVOKABLE model in its group; if the whole group is
    // un-invokable (or already used), walk to the nearest neighbouring group outward.
    const used = new Set<string>();
    for (const { label, i } of slots) {
      let pick: Cand | undefined;
      for (let d = 0; d < n && !pick; d++)
        for (const j of [i - d, i + d]) {
          if (j < 0 || j >= n || (d > 0 && j === i)) continue;
          pick = groups.get(scores[j])!.find((x) => ok(x.id) && !used.has(x.id));
          if (pick) break;
        }
      if (pick) {
        used.add(pick.id);
        out.push({ provider: prov, size: label, name: pick.m.modelName ?? pick.m.modelId, id: pick.id, score: pick.score });
      }
    }
  }
  return out;
}

function awsJson(args: string[], region: string): Record<string, unknown> {
  const raw = execFileSync('aws', ['bedrock', ...args, '--region', region, '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(raw);
}

/** Real availability test: a 1-token Converse call. A profile can be *listed* yet not invokable
 * ("… not available for this account"), so this is the only reliable "can I use it" signal — and
 * Converse is exactly how the scorer calls models, so passing here means the sweep can use it. */
function converseProbe(region: string): ProbeFn {
  const messages = JSON.stringify([{ role: 'user', content: [{ text: 'ping' }] }]);
  return (id: string): boolean => {
    try {
      execFileSync(
        'aws',
        ['bedrock-runtime', 'converse', '--model-id', id, '--messages', messages,
         '--inference-config', 'maxTokens=1', '--region', region, '--output', 'json'],
        { stdio: ['ignore', 'ignore', 'ignore'] },
      );
      return true;
    } catch {
      return false; // AccessDenied / not-available / unsupported → treat as un-invokable
    }
  };
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
    // For one model with several profiles, prefer a `global.` cross-region profile over a regional
    // (`us.`/`eu.`/…) one: `global.` routes across all supported regions, so it's the most likely
    // to actually resolve. (Whether the account can invoke it at all is decided later by the probe,
    // not the id shape — a listed profile is not proof of access.)
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

  // Probe candidates for real invokability (PROBE=0 to skip → picks the newest id blindly, which
  // may then SKIP in the sweep). Probing walks each size group newest→older until one answers.
  const probe = process.env.PROBE === '0' ? undefined : converseProbe(region);
  if (probe) console.error('probing candidates with a 1-token Converse call (PROBE=0 to skip)…');
  const picks = selectMatrix(models, profilesByArn, providers, probe);
  if (!picks.length) {
    console.error('pick-models: no invokable text models matched the requested providers in ' + region + '.');
    console.error('Enable model access (Bedrock console → Model access) or widen PROVIDERS, then retry.');
    console.error('(If PROBE is on, every candidate failed its Converse test — check bedrock:InvokeModel / bedrock:Converse.)');
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
  const render = (ps: Pick[]) => ps.map((p) => `${p.provider}/${p.size}=${p.id}`).join('\n');

  // Scenario A — no probe: every candidate assumed invokable, newest per size group wins.
  const gotA = render(selectMatrix(models, new Map(), ['Anthropic', 'Meta', 'Amazon']));
  const expectA = [
    'Anthropic/small=anthropic.claude-3-5-haiku-20241022-v1:0',
    'Anthropic/medium=anthropic.claude-3-5-sonnet-20241022-v2:0', // newest sonnet in its group
    'Anthropic/large=anthropic.claude-3-opus-20240229-v1:0',
    'Meta/small=meta.llama3-1-8b-instruct-v1:0',
    'Meta/medium=meta.llama3-1-70b-instruct-v1:0',
    'Meta/large=meta.llama3-1-405b-instruct-v1:0',
    'Amazon/small=amazon.nova-micro-v1:0',
    'Amazon/medium=amazon.nova-lite-v1:0',
    'Amazon/large=amazon.nova-pro-v1:0',
  ].join('\n');

  // Scenario B — mirrors this account: Sonnet 5 / Opus 5 are LISTED but not invokable, so the
  // probe rejects them and the picker must fall back to the newest 4.x that answers.
  const antModels: FM[] = [
    fm('anthropic.claude-haiku-4-5-20251001-v1:0', 'Anthropic', 'Claude Haiku 4.5'),
    fm('anthropic.claude-sonnet-4-5-20250929-v1:0', 'Anthropic', 'Claude Sonnet 4.5'),
    fm('anthropic.claude-sonnet-5', 'Anthropic', 'Claude Sonnet 5'),
    fm('anthropic.claude-opus-4-8', 'Anthropic', 'Claude Opus 4.8'),
    fm('anthropic.claude-opus-5', 'Anthropic', 'Claude Opus 5'),
  ];
  const blocked = new Set(['anthropic.claude-sonnet-5', 'anthropic.claude-opus-5']);
  const probe: ProbeFn = (id) => !blocked.has(id);
  const gotB = render(selectMatrix(antModels, new Map(), ['Anthropic'], probe));
  const expectB = [
    'Anthropic/small=anthropic.claude-haiku-4-5-20251001-v1:0',
    'Anthropic/medium=anthropic.claude-sonnet-4-5-20250929-v1:0', // sonnet-5 rejected → newest 4.x
    'Anthropic/large=anthropic.claude-opus-4-8',                   // opus-5 rejected → opus 4.8
  ].join('\n');

  const passA = gotA === expectA, passB = gotB === expectB;
  console.log(gotA);
  if (!passA) console.log('--- A expected ---\n' + expectA);
  console.log('--- probe fallback ---\n' + gotB);
  if (!passB) console.log('--- B expected ---\n' + expectB);
  console.log(passA && passB ? 'SELFTEST: PASS' : 'SELFTEST: FAIL');
  process.exit(passA && passB ? 0 : 1);
}

if (process.env.SELFTEST === '1') selfTest();
else main();
