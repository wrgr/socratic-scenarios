#!/usr/bin/env python3
"""
Real-hazard corpus-reliance — external validity (Exp 4). Runs REAL, publicly-documented charted
dangers through the necessity instrument on one Bedrock model. Two phases, one model, no GPU:

  1. Closed-book SCREEN — ask the model, with no corpus, whether it already knows the danger at each
     location. Names the danger (danger_terms) -> leaked (parametric) -> DROP. Doesn't -> USABLE
     (corpus-bound target). Screening against the SAME model the instrument uses is the right check
     (a danger one model knows another may not). Which candidates drop is itself reportable data.
  2. Instrument RUN — each USABLE hazard through HAZARDS_FILE=<line> PROBES=hazard colreg:leakage:
     the danger sits on the track, scored by the barrier but shown only in the corpus.
     necessity = regret(ablated) - regret(present).

Every model call (screen + run) is printed and logged with a UTC stamp. Results save to
results/real-hazards/realhazards_<UTC>.json plus per-hazard raw .txt, and a PASTE-THIS-BACK block
prints at the end.

Usage:
  python experiments/unlearning/real_ship_nav.py
  BEDROCK_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0 python experiments/unlearning/real_ship_nav.py
  HAZARDS_FILE=/path/to/my_hazards.jsonl python experiments/unlearning/real_ship_nav.py
  NPM_INSTALL=0 python experiments/unlearning/real_ship_nav.py   # skip npm install

Auth: standard AWS chain (env / ~/.aws / instance role) — nothing pasted. Candidates + citations:
real_hazards.jsonl / real_hazards.SOURCES.md (Elwha / Fullastern / Whittle real; Seven Stones = a
famous control, expected to DROP).
"""
import os, re, json, subprocess, datetime, sys

# ─── CONFIG ───────────────────────────────────────────────────────────────────────────
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# The single model to screen AND run the instrument against (screen and instrument must agree on
# 'does THIS model know it'). Default: a large model (most likely to already know a real danger, so
# the screen has teeth). See model_scan.py for the verified class x size matrix.
BEDROCK_MODEL = os.environ.get('BEDROCK_MODEL', 'us.anthropic.claude-opus-4-5-20251101-v1:0')

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))  # this script runs in-repo
# Candidate hazards: repo file by default (Elwha, Fullastern, Whittle real + Seven Stones control).
HAZARDS_FILE = os.environ.get('HAZARDS_FILE', os.path.join(REPO, 'experiments/unlearning/real_hazards.jsonl'))
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


def to_md(rows, cols):
    cols = [c for c in cols if any(c in r for r in rows)]
    head = '| ' + ' | '.join(cols) + ' |'
    sep = '| ' + ' | '.join('---' for _ in cols) + ' |'
    body = '\n'.join('| ' + ' | '.join(str(r.get(c, '')) for c in cols) + ' |' for r in rows)
    return '\n'.join([head, sep, body])


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:40]


def bedrock_client_or_none():
    """Return (bedrock-runtime client, None) if the OPTIONAL closed-book screen can run, else
    (None, reason). The screen needs boto3 + working AWS creds — and for SSO/login creds also
    botocore[crt]. Any of that missing is not fatal: we skip the screen and let the instrument read
    leakage behaviorally. Set SKIP_SCREEN=1 to force-skip."""
    if os.environ.get('SKIP_SCREEN') == '1':
        return None, 'skipped (SKIP_SCREEN=1)'
    try:
        import boto3
    except ImportError:
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'boto3'], check=True)
            import boto3
        except Exception:
            return None, 'skipped (boto3 not installable — run: %s -m pip install boto3)' % sys.executable
    try:
        return boto3.client('bedrock-runtime', region_name=AWS_REGION), None
    except Exception as e:
        name = type(e).__name__
        hint = ' — for SSO/login creds run: %s -m pip install "botocore[crt]"' % sys.executable \
            if 'crt' in str(e).lower() or name == 'MissingDependencyException' else ''
        return None, f'skipped ({name}{hint})'


def main():
    cands = [json.loads(l) for l in open(HAZARDS_FILE) if l.strip()]
    print('repo:', REPO, '| region:', AWS_REGION, '| model:', BEDROCK_MODEL)
    print('candidates:', len(cands), '->', ', '.join(c['location'][:28] for c in cands))

    # deps: npm for the instrument (required); boto3 for the OPTIONAL closed-book screen
    if os.environ.get('NPM_INSTALL', '1') != '0':
        subprocess.run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], cwd=REPO, check=True)
    brt, screen_note = bedrock_client_or_none()   # brt is None if the screen can't run (not fatal)

    # provenance
    run_utc = datetime.datetime.now(datetime.timezone.utc)
    commit = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=REPO, capture_output=True, text=True).stdout.strip()
    PROV = {
        'run_utc': run_utc.isoformat(),
        'run_local': datetime.datetime.now().astimezone().isoformat(),
        'git_commit': commit, 'aws_region': AWS_REGION,
        'model': BEDROCK_MODEL, 'hazards_file': os.path.relpath(HAZARDS_FILE, REPO), 'n_candidates': len(cands),
        'instrument': 'colreg:leakage PROBES=hazard (necessity=regret-delta; redundant/unusable=regret-with)',
        'screen': ('closed-book Bedrock converse vs danger_terms (screen_hazards.knows_hazard)'
                   if brt else screen_note),
    }
    print(json.dumps(PROV, indent=2))

    cmd_log = []   # traceability: exact call + UTC for every model touch (screen + run)

    # ── Phase 1 · closed-book screen (OPTIONAL — skipped if Bedrock/boto3 unavailable) ──────
    screen = []
    if brt:
        # same classifier as the CLI screen, so the two can't drift
        sys.path.insert(0, os.path.join(REPO, 'experiments', 'unlearning'))
        from screen_hazards import knows_hazard, CLOSED_BOOK_Q

        def bedrock_ask(prompt, max_tokens=220):
            r = brt.converse(modelId=BEDROCK_MODEL,
                             messages=[{'role': 'user', 'content': [{'text': prompt}]}],
                             inferenceConfig={'maxTokens': max_tokens, 'temperature': 0.0})
            return r['output']['message']['content'][0]['text']

        print('\n===== Phase 1 · closed-book screen =====')
        for c in cands:
            ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
            call = f"bedrock:converse model={BEDROCK_MODEL} region={AWS_REGION} closed-book('{c['location'][:32]}...')"
            print(f"SCREEN {ts}  {call}", flush=True)
            cmd_log.append({'utc': ts, 'phase': 'screen', 'location': c['location'], 'call': call})
            try:
                ans = bedrock_ask(CLOSED_BOOK_Q.format(location=c['location']))
                leaked = knows_hazard(ans, c.get('danger_terms'))
            except Exception as e:   # a mid-screen failure keeps the candidate (conservative)
                ans, leaked = f'(screen call failed: {type(e).__name__})', False
            screen.append({'location': c['location'], 'leaked': leaked, 'closed_book': ans.replace(chr(10), ' ')})
            print(f"  -> [{'DROP (leaked)' if leaked else 'USABLE       '}] {ans[:150].replace(chr(10),' ')}\n")

        usable = [c for c, s in zip(cands, screen) if not s['leaked']]
        print(f"{len(usable)}/{len(cands)} USABLE (model did not name the danger closed-book); "
              f"{len(cands)-len(usable)} dropped as already-known.")
    else:
        print(f"\n===== Phase 1 · closed-book screen SKIPPED — {screen_note} =====")
        print("  Running ALL candidates through the instrument. Leakage is still read, behaviorally:")
        print("  an already-known danger reads LEAKING/redundant with necessity ~0 (the screen result,")
        print("  measured rather than asked). To enable the pre-filter, see the hint above.\n")
        screen = [{'location': c['location'], 'leaked': None, 'closed_book': None} for c in cands]
        usable = list(cands)

    # ── Phase 2 · run each USABLE hazard through the instrument ──────────────────────────
    print('\n===== Phase 2 · instrument run =====')
    outdir = os.path.join(REPO, 'results', 'real-hazards'); os.makedirs(outdir, exist_ok=True)
    rows = []
    for i, c in enumerate(usable):
        line = json.dumps({'location': c['location'], 'disclosure': c['disclosure']})
        hz_path = os.path.join(outdir, f'hz_{i}.json'); open(hz_path, 'w').write(line)
        ts = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cmd = (f"HAZARDS_FILE={os.path.relpath(hz_path, REPO)} AWS_REGION={AWS_REGION} "
               f"BEDROCK_MODEL={BEDROCK_MODEL} PROBES=hazard npm run --silent colreg:leakage")
        print(f"RUN {ts}  [{slug(c['location']):40}]\n    {cmd}", flush=True)
        cmd_log.append({'utc': ts, 'phase': 'run', 'location': c['location'], 'cmd': cmd})
        env = dict(os.environ, HAZARDS_FILE=hz_path, AWS_REGION=AWS_REGION, BEDROCK_MODEL=BEDROCK_MODEL, PROBES='hazard')
        p = subprocess.run(['npm', 'run', '--silent', 'colreg:leakage'], cwd=REPO, env=env, capture_output=True, text=True)
        out = (p.stdout or '') + '\n' + (p.stderr or '')
        open(os.path.join(outdir, f'{slug(c["location"])}__hazard.txt'), 'w').write(out)
        row = {'location': c['location']}
        if 'VERDICT' not in out and p.returncode != 0:
            row['error'] = (p.stderr or p.stdout or 'failed')[-200:]
        else:
            row.update(parse_hazard(out))
        rows.append(row)
        print(f"  -> necessity={row.get('necessity','?')} verdict={row.get('verdict','?')}/{row.get('leak_mode','')} "
              f"regret-with={row.get('regret_with','?')}{'  ERR' if 'error' in row else ''}\n")

    # ── Summary + paste-back ────────────────────────────────────────────────────────────
    stamp = run_utc.strftime('%Y%m%dT%H%M%SZ')
    def screen_label(s):
        if s['leaked'] is None:
            return 'not screened'
        return 'DROP (leaked)' if s['leaked'] else 'USABLE'
    screen_rows = [{'location': s['location'], 'screen': screen_label(s)} for s in screen]
    payload = {'provenance': PROV, 'command_log': cmd_log, 'screen': screen, 'rows': rows}
    json.dump(payload, open(os.path.join(outdir, f'realhazards_{stamp}.json'), 'w'), indent=2)

    screened = brt is not None
    screen_summary = (f"{sum(not s['leaked'] for s in screen)}/{len(screen)} usable"
                      if screened else f"not run ({screen_note})")
    print('==================== PASTE THIS BACK ====================')
    print(f"real-hazard external-validity run | run_utc={PROV['run_utc']} | local={PROV['run_local']}")
    print(f"commit={PROV['git_commit'][:9]} region={AWS_REGION} model={BEDROCK_MODEL}")
    print(f"screen: {screen_summary} | {len(cmd_log)} model calls logged\n")
    print('SCREEN (all candidates):' if screened else 'SCREEN: skipped — all candidates run through the instrument:')
    print(to_md(screen_rows, ['location', 'screen']))
    print('\nNECESSITY (usable hazards):')
    print(to_md(rows, ['location', 'necessity', 'verdict', 'leak_mode', 'regret_with', 'error']) if rows
          else '(none usable — every candidate was already known to this model)')
    print('\n<details><summary>provenance + screen answers + command log + rows (machine-readable)</summary>\n')
    print('```json'); print(json.dumps(payload, indent=2)); print('```\n</details>')
    print(f"\nsaved: results/real-hazards/realhazards_{stamp}.json  (+ per-hazard raw .txt)")


if __name__ == '__main__':
    main()
