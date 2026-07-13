# TeachMe — Socratic Scenarios

**TeachMe** is a domain-agnostic, corpus-bound training platform for safety-critical technical work. It doesn't just answer questions — it *asks* them: Socratic probes calibrated to your level, situated fault scenarios, and a narrator that refuses to fabricate (every response traces to a knowledge-graph node).

Pick a domain on the welcome screen. The flagship instantiation is **EDDIE** — **Aerosol Jet Printing (AJP)** operator training on the Optomec HD2 — built from a typed knowledge graph + a dense retrieval corpus. Additional domains (e.g. roadside flat-tire diagnostics) run on the same engine to demonstrate that any procedurally-structured, safety-critical domain can be authored as a graph + corpus.

> **Runs with no API key** in a deterministic **simulated** mode. Add a Gemini key via the gear icon (BYOK) for LLM-powered mentoring and dense retrieval. Deployed as a static site via GitHub Pages — see **Deploying**.

> **Why does this thing look the way it does?** See [OVERVIEW.md](OVERVIEW.md) — the short read on how learning-science theory drove the AI architecture (rather than the other way around).

> **Evidence status:** outcomes shown in the app are simulation-based and support internal mechanism testing. They are not human-subject external-validity results.

## What's in here

Surfaces over the same AJP knowledge base, ordered to match the training sequence:

| Tab | Purpose |
|---|---|
| **Dashboard** | Mission brief — safety gate checklist, mastery map from Socratic Practice scores, launch points for each training phase |
| **About** | Mission, pedagogy, and AI rationale (expandable pillars) plus references / whitepaper |
| **Architecture** | TeachMe Loop flowchart and package/concept diagrams |
| **Socratic Practice** (01) | Concept-by-concept practice with LLM-evaluated free-text responses |
| **Scenario Mode** (02) | Narrator + Mentor — procedural scenarios end-to-end; requires critical safety gates verified on the Dashboard |
| **Workflow Demo** (03) | Interactive walkthrough with optional Simulated Learner — observe the full Mentor evaluation loop |
| **Reachback Lookup** (04) | In-operation reachback — search the symptom/fault/action graph from the operator's seat |
| **Retrieval Lab** | Inspect retrieval ranking, flag corpus items, compare strategies |
| **RAG Coverage** | Coverage map of dense vs graph evidence |

### Operator state

The toolbar carries an **operator state** toggle — the app's cognitive-load switch:

- **Training** — the full instructional surface described above.
- **High-stress ops** — for an operator at the machine under time pressure. Training surfaces are locked; visual chrome is stripped; only the Dashboard and corpus-bound Reachback Lookup remain. This follows the cognitive load stance in [OVERVIEW.md](OVERVIEW.md). The state persists across reloads; "Stand down" returns to Training.

## Getting started

```bash
./start.sh
```

Installs dependencies on first run and starts the Vite dev server. See [start.sh](start.sh) for flags (port override, LAN binding) and Node version notes.

Or:

```bash
npm install
npm run dev
```

The app runs without an API key in **simulated mode** — a deterministic local provider stands in for embeddings and LLM evaluation. To enable Gemini-powered retrieval and mentor evaluation, click the gear in the header and paste a key (see *Configuration*). Saving validates the key against Gemini before persisting.

## Package structure

```
src/
  App.tsx                 entry — providers, tab routing, operator-state gates
  components/             React UI (views, workflow demo, flags, source popovers, …)
  corpus/ajp/             typed knowledge graph: nodes, edges, faults, probes, scenarios
  domains/                domain registry / boot (active domain binding)
  engine/
    retrieval/            embedding providers + graph + dense + hybrid retrieval
    mentor/               Gemini Flash free-text evaluation
    simulated-learner/    drives the Workflow Demo loop
    scenario/             scenario engine
    prompt-enhancer/      query enrichment
    learner-model/        proficiency scoring
  hooks/                  API key, operator mode, safety gates, expert flags, …
  types/                  shared TypeScript types

scripts/
  ingest-corpus.ts        canonical dense-corpus ingestion (`npm run ingest`)
  db/                     optional / deprecated SQLite knowledge-DB pipeline

docs/                     durable project docs (see below)
sources/                  canonical per-source provenance ledger
knowledge/                SQLite DB + source cache (gitignored except placeholders)
local-sources/            gitignored raw PDFs for ingest (see local-sources/README.md)
public/                   JSON corpora and SVG assets served by Vite
```

### Durable docs

| Doc | Role |
|---|---|
| [OVERVIEW.md](OVERVIEW.md) | Educational frame |
| [docs/whitepaper.md](docs/whitepaper.md) | System design paper |
| [docs/references.md](docs/references.md) | Annotated bibliography |
| [docs/DATA_CATALOG.md](docs/DATA_CATALOG.md) | Every data store: path, pipeline, sensitivity |
| [docs/SOURCE_PROVENANCE_AUDIT.md](docs/SOURCE_PROVENANCE_AUDIT.md) | Source evaluation + handling decisions |
| [sources/SOURCES_LOG.md](sources/SOURCES_LOG.md) | Signed-off disposition ledger |
| [docs/rebuild_corpus.md](docs/rebuild_corpus.md) | Safe corpus rebuild playbook |
| [docs/expert-elicitation-guidelines.md](docs/expert-elicitation-guidelines.md) | Interview protocol for graph authoring |
| [docs/expert-elicitation-log.md](docs/expert-elicitation-log.md) | Live elicitation / gap backlog |
| [docs/deploy-rhel-internal.md](docs/deploy-rhel-internal.md) | RHEL / internal nginx deploy |
| [docs/coding-assistant-guidelines.md](docs/coding-assistant-guidelines.md) | Implementation norms |

## Configuration

`.env` (gitignored — create locally):

```
VITE_GEMINI_API_KEY=                    # optional — prefer the gear icon at runtime
VITE_EMBEDDING_PROVIDER=auto            # auto | gemini | simulated
```

Key resolution: localStorage (gear icon) → `VITE_GEMINI_API_KEY` env (dev fallback).

> **Security note:** `VITE_`-prefixed vars are inlined into the client bundle at build time. Never commit `.env` and never publish a `dist/` built with a real key. Prefer the gear-icon BYOK flow for shared deployments.

## Knowledge stores

The knowledge store has three parts (see [docs/DATA_CATALOG.md](docs/DATA_CATALOG.md)):

| Part | Where | Built how |
|---|---|---|
| **Graph** + **Flow** | `src/corpus/ajp/*.ts` | Hand-authored TypeScript |
| **Dense** | `public/ajp-corpus.json` (+ node embeddings) | `npm run ingest` from sources listed in `scripts/ingest-corpus.ts` |

```bash
npm run ingest             # rebuild dense corpus + embeddings (requires Gemini key + local-sources)
```

An older SQLite pipeline (`npm run db:*`) still exists under `scripts/db/` but is **not** the authoritative path for the shipped dense corpus. Do not mix it with `npm run ingest` mid-rebuild.

Every source that feeds Graph / Flow / Dense should resolve in [sources/SOURCES_LOG.md](sources/SOURCES_LOG.md).

## Expert review

- **In-app flagging** — Retrieval Lab: cycle `○ → ✓ good → ⚠ needs review` on nodes/chunks. Flags persist to `localStorage` and can be exported as JSON.
- **CLI elicitation** — structured sessions via `npm run db:add-elicitation`. Protocol: [docs/expert-elicitation-guidelines.md](docs/expert-elicitation-guidelines.md).

## Source provenance

- **Citation registry** (`src/corpus/source-ref-registry.ts`) — `SRC-###` IDs in node fields render as popovers linking to source documents.
- **Dense corpus** (`public/ajp-corpus.json`) — each chunk carries source document + section.
- **Domain Sources panel** — gear-adjacent **References & Whitepaper** → **Domain Sources**; computed live via `src/corpus/source-usage.ts`.

`src/corpus/ajp/__tests__/source-integrity.test.ts` enforces that every cited `SRC-###` resolves and no authoring-template placeholders ship.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest |
| `npm run preview` | Preview production build |
| `npm run ingest` | Rebuild dense corpus + embeddings |

## Deploying

The app is a pure static bundle — users supply Gemini keys at runtime via the gear icon.

> **`dist/` is gitignored.** Never commit build output. Build on the deploy target (via [scripts/deploy.sh](scripts/deploy.sh)) or in CI.

### GitHub Pages (this repo)

This repo ships [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml): every push to `main` builds and deploys to GitHub Pages. The workflow derives the base path from the repo name (`/socratic-scenarios/`) automatically — no config needed. Enable it once under **Settings → Pages → Source: GitHub Actions**. The deployed site runs in simulated mode; visitors add their own Gemini key via the gear icon (nothing server-side).

### Host nginx (for a self-hosted box)

> **RHEL / internal corporate box?** See [docs/deploy-rhel-internal.md](docs/deploy-rhel-internal.md) for AppStream module resets, corp-CA TLS trust, SELinux tagging, firewalld, and the stock-`nginx.conf` collision. The block below is the happy path.

One-time setup on a fresh Linux box:

```bash
sudo dnf install -y nginx policycoreutils-python-utils
sudo mkdir -p /var/www/teachme
sudo chown -R "$USER":"$USER" /var/www/teachme

# SELinux: let nginx read /var/www/teachme
sudo semanage fcontext -a -t httpd_sys_content_t "/var/www/teachme(/.*)?"
sudo restorecon -Rv /var/www/teachme

# nginx config (SPA fallback + gzip + immutable caching on /assets/)
sudo tee /etc/nginx/conf.d/teachme.conf > /dev/null <<'EOF'
server {
  listen 80 default_server;
  server_name _;
  root /var/www/teachme;
  index index.html;
  gzip on;
  gzip_types text/css application/javascript text/javascript image/svg+xml application/json;
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }
  location / { try_files $uri $uri/ /index.html; }
}
EOF
sudo sed -i '/server {/,/^}/d' /etc/nginx/nginx.conf   # strip the stock default server block
sudo nginx -t && sudo systemctl enable --now nginx
sudo firewall-cmd --permanent --add-service=http && sudo firewall-cmd --reload
```

Then every deploy is just:
```bash
cd ~/teachme && ./scripts/deploy.sh
```

[scripts/deploy.sh](scripts/deploy.sh) pulls, builds, snapshots the previous `dist/` (keeps the last 3 for rollback), and rsyncs to `/var/www/teachme/`. Override with `DEPLOY_ROOT=/some/other/path ./scripts/deploy.sh`.

Rollback:
```bash
sudo rsync -a --delete /var/www/teachme.prev.<timestamp>/ /var/www/teachme/
```

### Docker

```bash
docker build -t teachme .
docker run -d --name teachme --restart unless-stopped -p 8080:80 teachme
# → http://<host>:8080
```

The multi-stage [Dockerfile](Dockerfile) builds with `node:20` and serves with `nginx:1.27-alpine`. [nginx.conf](nginx.conf) adds gzip, immutable caching for `/assets/`, and SPA fallback.

## Known gaps

- **Expert flags do not persist to the DB.** In-app flags write to `localStorage` only; JSON export is manual.
- **`VITE_GEMINI_API_KEY` is build-time inlined.** Use the gear-icon BYOK flow for shared builds.
- **Dense corpus rebuild** may still need a post-ingest scrub pass for site-specific terms — see [sources/SOURCES_LOG.md](sources/SOURCES_LOG.md).

## Coding guidelines

See [docs/coding-assistant-guidelines.md](docs/coding-assistant-guidelines.md).
