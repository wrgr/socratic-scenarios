#!/usr/bin/env python3
"""
Cross-model / cross-PROVIDER necessity scan (class x size) — the tab:disc grid, driven by a model
MATRIX, not a hardcoded list, so the output organizes itself by class and size and is reproducible.

Three providers, one instrument. Each row is (label, provider, model_id); the runner
(colreg:leakage) already selects the completer from the environment, so this harness just sets the
right env per row and — crucially — isolates the provider selectors so a Bedrock key can't hijack a
Gemini/OpenAI row:
  - bedrock : env BEDROCK_MODEL + AWS_REGION      (AWS standard credential chain)
  - gemini  : env GEMINI_MODEL  + GEMINI_API_KEY  (native Google API — NOT Bedrock)
  - openai  : env OPENAI_MODEL  + OPENAI_API_KEY  (native OpenAI API — NOT Bedrock; gpt-4 class is
              not on Bedrock, only open-weight gpt-oss is)

For each model it runs two probe sets:
  - PROBES=hazard : necessity (regret-delta) + the redundant/unusable split (regret-with)
  - PROBES=all    : the corpus-value audit summary + the sufficiency verdict

Every model call is printed and logged with a UTC stamp (never the key value). Results save to
results/model-scan/scan_<UTC>.json + per-model raw .txt, and a PASTE-THIS-BACK block prints at the
end (markdown table + machine-readable JSON) for the paper's tab:disc.

Usage:
  python experiments/model-scan/model_scan.py                       # full matrix, providers with creds
  PROBES_SETS=hazard python experiments/model-scan/model_scan.py    # just the hazard probe
  ONLY="gemini-* llama-large" python experiments/model-scan/model_scan.py   # only matching labels
  AWS_REGION=us-west-2 python experiments/model-scan/model_scan.py
  NPM_INSTALL=0 python experiments/model-scan/model_scan.py         # skip npm install

Auth: each provider's standard chain (AWS env/SSO/role; GEMINI_API_KEY; OPENAI_API_KEY) — nothing
pasted. Rows whose provider has no credential are SKIPPED with a note (that's reported, not fatal).
"""
import os, re, json, subprocess, datetime, sys, fnmatch

# ─── CONFIG ───────────────────────────────────────────────────────────────────────────
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# (label, provider, model_id) — labels 'class-size' so the table sorts by tier.
MODELS = [
    # ── Anthropic Claude on Bedrock (4.5 gen):  haiku < sonnet < opus ──
    ('claude-small',  'bedrock', 'us.anthropic.claude-haiku-4-5-20251001-v1:0'),
    ('claude-medium', 'bedrock', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    ('claude-large',  'bedrock', 'us.anthropic.claude-opus-4-5-20251101-v1:0'),
    # ── Meta Llama on Bedrock:  8B < 70B  (two rungs only — see note) ──
    # No clean "large" text rung: llama3-1-405b isn't offered, llama3-2-90b is a Vision profile that
    # rejects plain-text Converse, and Llama-4 Maverick/Scout are 17B MoE (not "larger than 70B" in a
    # size-ladder sense). So Llama is presented as small/medium. Uncomment a large below if desired.
    ('llama-small',   'bedrock', 'us.meta.llama3-1-8b-instruct-v1:0'),
    ('llama-medium',  'bedrock', 'us.meta.llama3-3-70b-instruct-v1:0'),
    # ('llama-mav',   'bedrock', 'us.meta.llama4-maverick-17b-instruct-v1:0'),  # 17B MoE, off-ladder
    # ('llama-scout', 'bedrock', 'us.meta.llama4-scout-17b-instruct-v1:0'),     # 17B MoE, off-ladder
    # ── Amazon Nova on Bedrock:  micro < lite < pro ──
    ('nova-small',    'bedrock', 'us.amazon.nova-micro-v1:0'),
    ('nova-medium',   'bedrock', 'us.amazon.nova-lite-v1:0'),
    ('nova-large',    'bedrock', 'us.amazon.nova-pro-v1:0'),
    # ── OpenAI on Bedrock (open-weight gpt-oss via the Mantle engine — bills Bedrock, NOT OpenAI) ──
    # gpt-4/o-series are still not on Bedrock; only the open-weight gpt-oss models are. If Converse
    # rejects these on your account, they need the OpenAI-compatible endpoint instead (see NOTE below).
    ('openai-small',  'bedrock', 'openai.gpt-oss-20b-1:0'),
    ('openai-large',  'bedrock', 'openai.gpt-oss-120b-1:0'),
    # ── More vendor families, still on Bedrock (single models) — skipped for now ──
    # ('deepseek-r1',   'bedrock', 'us.deepseek.r1-v1:0'),
    # ('writer-x5',     'bedrock', 'us.writer.palmyra-x5-v1:0'),
    # ── Optional 5-gen Claude on Bedrock (uncomment to extend the Claude family) ──
    # ('claude5-sonnet','bedrock', 'us.anthropic.claude-sonnet-5'),
    # ('claude5-opus',  'bedrock', 'us.anthropic.claude-opus-5'),
    #
    # ── Google Gemini — NOT on Bedrock (Mantle serves Anthropic/Meta/OpenAI, not Google), so this
    #    bills Google and needs a funded GEMINI_API_KEY. OFF by default. ──
    # ('gemini-small',  'gemini',  'gemini-2.5-flash-lite'),
    # ('gemini-medium', 'gemini',  'gemini-2.5-flash'),
    # ('gemini-large',  'gemini',  'gemini-2.5-pro'),
]
# NOTE — OpenAI-on-Bedrock via the OpenAI-compatible endpoint (fallback if Converse rejects gpt-oss):
#   set the row's provider to 'openai' and export, on your Mac:
#     OPENAI_BASE_URL=https://bedrock-runtime.<region>.amazonaws.com/openai/v1
#     OPENAI_API_KEY=<your Bedrock API key>     # Bedrock long/short-term key, NOT an OpenAI key
#   That still bills Bedrock. The 'bedrock' rows above try the Converse path first (no extra setup).
PROBES_SETS = os.environ.get('PROBES_SETS', 'hazard all').split()
ONLY = os.environ.get('ONLY', '').replace(',', ' ').split()   # label globs; empty = all

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # this script runs in-repo
# ──────────────────────────────────────────────────────────────────────────────────────

DASH = r'[-−]'   # ASCII hyphen or unicode minus
# every provider-selecting env var, stripped before each run so exactly one provider is active
SELECTORS = ('BEDROCK_MODEL', 'AWS_REGION', 'GEMINI_MODEL', 'GEMINI_API_KEY',
             'OPENAI_MODEL', 'OPENAI_API_KEY', 'OPENAI_BASE_URL',
             'GITHUB_MODELS_TOKEN', 'GITHUB_MODELS_MODEL')


def provider_ready(provider):
    e = os.environ
    if provider == 'bedrock':
        return bool(e.get('AWS_ACCESS_KEY_ID') or e.get('AWS_PROFILE') or e.get('AWS_ROLE_ARN')
                    or e.get('AWS_WEB_IDENTITY_TOKEN_FILE')
                    or os.path.exists(os.path.expanduser('~/.aws/credentials')))
    if provider == 'gemini':
        return bool(e.get('GEMINI_API_KEY'))
    if provider == 'openai':
        return bool(e.get('OPENAI_API_KEY'))
    return False


def build_env(provider, model):
    """Clean env with all provider selectors stripped, then only the chosen provider set.
    Returns (env, shown) where `shown` masks secrets (never the key value)."""
    env = {k: v for k, v in os.environ.items() if k not in SELECTORS}
    if provider == 'bedrock':
        env['AWS_REGION'] = AWS_REGION; env['BEDROCK_MODEL'] = model
        shown = f"AWS_REGION={AWS_REGION} BEDROCK_MODEL={model}"
    elif provider == 'gemini':
        env['GEMINI_API_KEY'] = os.environ.get('GEMINI_API_KEY', ''); env['GEMINI_MODEL'] = model
        shown = f"GEMINI_API_KEY=<env> GEMINI_MODEL={model}"
    elif provider == 'openai':
        env['OPENAI_API_KEY'] = os.environ.get('OPENAI_API_KEY', ''); env['OPENAI_MODEL'] = model
        if os.environ.get('OPENAI_BASE_URL'):
            env['OPENAI_BASE_URL'] = os.environ['OPENAI_BASE_URL']
        shown = f"OPENAI_API_KEY=<env> OPENAI_MODEL={model}"
    else:
        raise ValueError(f"unknown provider {provider}")
    return env, shown


def parse_hazard(out):
    r = {}
    m = re.search(r'regret-delta\s+[\d.]+\s*\(without\)\s*' + DASH + r'\s*([\d.]+)\s*\(with\)\s*=\s*(-?[\d.]+)', out)
    if m:
        r['necessity'] = float(m.group(2)); r['regret_with'] = float(m.group(1))
    v = re.search(r'VERDICT:\s*([A-Z-]+)(?:\s*\((\w+):\s*regret-with\s*([\d.]+)\))?', out)
    if v:
        r['verdict'] = v.group(1); r['leak_mode'] = v.group(2) or ''
        if v.group(3):
            r['regret_with'] = float(v.group(3))
    return r


def parse_all(out):
    r = {}
    s = re.search(r'(\d+)\s*rules?\s*·\s*(\d+)\s*relied-on.*?·\s*(\d+)\s*redundant.*?·\s*(\d+)\s*unusable.*?·\s*(\d+)\s*inconclusive', out)
    if s:
        r.update(rules=int(s.group(1)), relied=int(s.group(2)), redundant=int(s.group(3)),
                 unusable=int(s.group(4)), inconclusive=int(s.group(5)))
    suff = re.search(r'(FALSE SUFFICIENCY|CONTRIBUTING|UNUSABLE|PARTIAL)', out)
    if suff:
        r['sufficiency'] = suff.group(1)
    return r


def to_md(rows, cols):
    cols = [c for c in cols if any(c in r for r in rows)]
    head = '| ' + ' | '.join(cols) + ' |'
    sep = '| ' + ' | '.join('---' for _ in cols) + ' |'
    body = '\n'.join('| ' + ' | '.join(str(r.get(c, '')) for c in cols) + ' |' for r in rows)
    return '\n'.join([head, sep, body])


def main():
    models = [m for m in MODELS if not ONLY or any(fnmatch.fnmatch(m[0], g) for g in ONLY)]
    provs = sorted({p for _, p, _ in models})
    ready = {p: provider_ready(p) for p in provs}
    print('repo:', REPO, '| region:', AWS_REGION, '| rows:', len(models), '| probe sets:', PROBES_SETS)
    print('providers:', ', '.join(f"{p}={'READY' if ready[p] else 'NO-CREDS (skip)'}" for p in provs))
    if ONLY:
        print('ONLY filter:', ONLY)

    if os.environ.get('NPM_INSTALL', '1') != '0':
        subprocess.run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], cwd=REPO, check=True)

    run_utc = datetime.datetime.now(datetime.timezone.utc)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    PROV = {
        'run_utc': run_utc.isoformat(),
        'run_local': datetime.datetime.now().astimezone().isoformat(),
        'git_commit': commit, 'aws_region': AWS_REGION,
        'models': {lbl: {'provider': p, 'model': m} for lbl, p, m in models},
        'providers_ready': ready, 'probe_sets': PROBES_SETS, 'only': ONLY,
        'instrument': 'colreg:leakage (necessity=regret-delta; redundant/unusable=regret-with)',
    }
    print(json.dumps(PROV, indent=2))

    outdir = os.path.join(REPO, 'results', 'model-scan'); os.makedirs(outdir, exist_ok=True)
    run_log = []   # traceability: exact command + UTC per call (secrets masked)

    def run_one(label, provider, model, probes):
        env, shown = build_env(provider, model)
        env['PROBES'] = probes
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cmd = f"{shown} PROBES={probes} npm run --silent colreg:leakage"
        print(f"RUN {ts}  [{label:14}] {cmd}", flush=True)
        run_log.append({'utc': ts, 'label': label, 'provider': provider, 'model': model, 'probes': probes, 'cmd': cmd})
        return subprocess.run(['npm', 'run', '--silent', 'colreg:leakage'], cwd=REPO, env=env, capture_output=True, text=True)

    rows = []
    for label, provider, model in models:
        row = {'label': label, 'provider': provider, 'model': model}
        if not ready[provider]:
            row['skipped'] = f'no {provider} credential'
            rows.append(row)
            print(f"  -> [{label:14}] SKIP ({row['skipped']})\n")
            continue
        for probes in PROBES_SETS:
            p = run_one(label, provider, model, probes)
            out = (p.stdout or '') + '\n' + (p.stderr or '')
            open(os.path.join(outdir, f'{label}__{probes}.txt'), 'w').write(out)
            if 'VERDICT' not in out and p.returncode != 0:
                row[f'{probes}_error'] = (p.stderr or p.stdout or 'failed')[-200:]
            elif probes == 'hazard':
                row.update(parse_hazard(out))
            else:
                row.update(parse_all(out))
        rows.append(row)
        err = '  ERR' if any(k.endswith('_error') for k in row) else ''
        print(f"  -> [{label:14}] hazard={row.get('verdict','?')}/{row.get('leak_mode','')} "
              f"necessity={row.get('necessity','?')} regret-with={row.get('regret_with','?')} | "
              f"std relied={row.get('relied','?')} redundant={row.get('redundant','?')} suff={row.get('sufficiency','?')}{err}\n")

    stamp = run_utc.strftime('%Y%m%dT%H%M%SZ')
    payload = {'provenance': PROV, 'command_log': run_log, 'rows': rows}
    json.dump(payload, open(os.path.join(outdir, f'scan_{stamp}.json'), 'w'), indent=2)

    cols = ['label', 'provider', 'verdict', 'leak_mode', 'necessity', 'regret_with',
            'relied', 'redundant', 'unusable', 'inconclusive', 'sufficiency', 'skipped']
    print('==================== PASTE THIS BACK ====================')
    print(f"cross-model necessity scan | run_utc={PROV['run_utc']} | local={PROV['run_local']}")
    print(f"commit={PROV['git_commit'][:9]} region={AWS_REGION} | {len(run_log)} commands logged")
    print()
    print(to_md(rows, cols))
    print('\n<details><summary>provenance + command log + rows (machine-readable)</summary>\n')
    print('```json'); print(json.dumps(payload, indent=2)); print('```\n</details>')
    print(f"\nsaved: results/model-scan/scan_{stamp}.json  (+ per-model raw .txt)")


if __name__ == '__main__':
    main()
