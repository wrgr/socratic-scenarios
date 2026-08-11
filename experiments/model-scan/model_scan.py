#!/usr/bin/env python3
"""
Cross-model necessity scan (class x size) — the tab:disc grid, driven by a model MATRIX, not a
hardcoded list, so the output organizes itself by class and size and is reproducible.

For each model it runs two probe sets through the same instrument:
  - PROBES=hazard : necessity (regret-delta) + the redundant/unusable split (regret-with)
  - PROBES=all    : the corpus-value audit summary + the sufficiency verdict

Every Bedrock call is printed and logged with a UTC stamp for traceability. Results save to
results/model-scan/scan_<UTC>.json plus per-model raw .txt, and a PASTE-THIS-BACK block prints
at the end (markdown table + machine-readable JSON) to drop straight into the paper's tab:disc.

Usage:
  python experiments/model-scan/model_scan.py                 # runs the MODELS matrix below
  AWS_REGION=us-west-2 python experiments/model-scan/model_scan.py
  PROBES_SETS="hazard" python experiments/model-scan/model_scan.py   # just the hazard probe
  NPM_INSTALL=0 python experiments/model-scan/model_scan.py    # skip npm install (deps already there)

Auth: standard AWS chain (env / ~/.aws / instance role) — nothing pasted. Throttled ~30 rpm by the
runner. Edit MODELS to trim/extend; ids below were verified against a real list-inference-profiles.
"""
import os, re, json, subprocess, datetime

# ─── CONFIG ───────────────────────────────────────────────────────────────────────────
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# (label, bedrock_model_id) — labels 'class-size' so the table sorts by tier. All ids verified present.
MODELS = [
    # Anthropic Claude, 4.5 generation:  haiku < sonnet < opus
    ('claude-small',  'us.anthropic.claude-haiku-4-5-20251001-v1:0'),
    ('claude-medium', 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    ('claude-large',  'us.anthropic.claude-opus-4-5-20251101-v1:0'),
    # Meta Llama:  8B < 70B < 90B   (no 405B offered on this account)
    ('llama-small',   'us.meta.llama3-1-8b-instruct-v1:0'),
    ('llama-medium',  'us.meta.llama3-3-70b-instruct-v1:0'),
    ('llama-large',   'us.meta.llama3-2-90b-instruct-v1:0'),
    # Amazon Nova:  micro < lite < pro
    ('nova-small',    'us.amazon.nova-micro-v1:0'),
    ('nova-medium',   'us.amazon.nova-lite-v1:0'),
    ('nova-large',    'us.amazon.nova-pro-v1:0'),
    # --- optional extras available on this account (uncomment to include) ---
    # ('deepseek-r1',   'us.deepseek.r1-v1:0'),
    # ('writer-x5',     'us.writer.palmyra-x5-v1:0'),
    # ('llama4-mav',    'us.meta.llama4-maverick-17b-instruct-v1:0'),
    # ('claude-opus5',  'us.anthropic.claude-opus-5'),      # newest gen; note: no -v1:0 suffix
    # ('claude-sonnet5','us.anthropic.claude-sonnet-5'),
]
PROBES_SETS = os.environ.get('PROBES_SETS', 'hazard all').split()

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # this script runs in-repo
# ──────────────────────────────────────────────────────────────────────────────────────

DASH = r'[-−]'   # ASCII hyphen or unicode minus


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
    print('repo:', REPO, '| region:', AWS_REGION, '| models:', len(MODELS), '| probe sets:', PROBES_SETS)

    # deps + credential check
    if os.environ.get('NPM_INSTALL', '1') != '0':
        subprocess.run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], cwd=REPO, check=True)
    who = subprocess.run(['aws', 'sts', 'get-caller-identity'], capture_output=True, text=True)
    if who.returncode == 0:
        print('AWS identity OK:', json.loads(who.stdout).get('Arn', '?'))
    else:
        have = [k for k in ('AWS_ACCESS_KEY_ID', 'AWS_PROFILE', 'AWS_ROLE_ARN', 'AWS_WEB_IDENTITY_TOKEN_FILE') if os.environ.get(k)]
        print('aws cli check unavailable; env-chain markers present:', have or 'NONE — set creds before the scan')

    # provenance
    run_utc = datetime.datetime.now(datetime.timezone.utc)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    PROV = {
        'run_utc': run_utc.isoformat(),
        'run_local': datetime.datetime.now().astimezone().isoformat(),
        'git_commit': commit, 'aws_region': AWS_REGION,
        'models': dict(MODELS), 'probe_sets': PROBES_SETS,
        'instrument': 'colreg:leakage (necessity=regret-delta; redundant/unusable=regret-with)',
    }
    print(json.dumps(PROV, indent=2))

    outdir = os.path.join(REPO, 'results', 'model-scan'); os.makedirs(outdir, exist_ok=True)
    run_log = []   # traceability: exact command + UTC per call

    def run_one(label, model, probes):
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cmd = f"AWS_REGION={AWS_REGION} BEDROCK_MODEL={model} PROBES={probes} npm run --silent colreg:leakage"
        print(f"RUN {ts}  [{label:13}] {cmd}", flush=True)
        run_log.append({'utc': ts, 'label': label, 'model': model, 'probes': probes, 'cmd': cmd})
        env = dict(os.environ, AWS_REGION=AWS_REGION, BEDROCK_MODEL=model, PROBES=probes)
        return subprocess.run(['npm', 'run', '--silent', 'colreg:leakage'], cwd=REPO, env=env, capture_output=True, text=True)

    rows = []
    for label, model in MODELS:
        row = {'label': label, 'model': model}
        for probes in PROBES_SETS:
            p = run_one(label, model, probes)
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
        print(f"  -> [{label:13}] hazard={row.get('verdict','?')}/{row.get('leak_mode','')} "
              f"necessity={row.get('necessity','?')} regret-with={row.get('regret_with','?')} | "
              f"std relied={row.get('relied','?')} redundant={row.get('redundant','?')} suff={row.get('sufficiency','?')}{err}\n")

    stamp = run_utc.strftime('%Y%m%dT%H%M%SZ')
    payload = {'provenance': PROV, 'command_log': run_log, 'rows': rows}
    json.dump(payload, open(os.path.join(outdir, f'scan_{stamp}.json'), 'w'), indent=2)

    cols = ['label', 'verdict', 'leak_mode', 'necessity', 'regret_with', 'relied', 'redundant', 'unusable', 'inconclusive', 'sufficiency']
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
