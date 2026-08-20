/**
 * RagCoverageView.tsx
 *
 * A RAG *coverage* visualizer — focused on which chunks/docs get hit by which
 * queries, NOT on embedding projections. It answers:
 *   • Coverage    — query × source hit heatmap, per-source coverage bars.
 *   • Dead corpus — chunks never retrieved by any query.
 *   • Expansion   — queries whose best hit is weak (corpus likely thin here).
 *   • Accuracy    — TP / FP / FN / TN once a reviewer judges relevance in-app.
 *
 * Retrieval runs live in the browser through the same dense backend the rest of
 * the app uses, so it needs a Gemini key whose model matches the baked corpus
 * (gemini-embedding-001). Relevance judgments are the ground truth and persist
 * to localStorage (see useRelevanceJudgments).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getEmbeddingProvider } from '../engine/retrieval';
import type { EmbeddingProvider } from '../engine/retrieval';
import {
  queryDense,
  queryDenseLexical,
  getDenseBackend,
  loadChunkInventory,
  type ChunkInventoryItem,
} from '../engine/retrieval/dense-retrieval';
import { nodesByType } from '../engine/retrieval/graph-utils';
import { corpusGaps } from '../corpus/ajp/corpus-gaps';
import {
  exampleQueries,
  queriesFromGaps,
  queriesFromNodes,
  computeSourceCoverage,
  computeUnusedChunks,
  buildHeatmap,
  computeQueryOutcome,
  summarizeConfusion,
  summarizeChunkPrecision,
  findWeakQueries,
  pct,
  ORIGIN_LABELS,
  type EvalQuery,
  type QueryRun,
  type ChunkHit,
  type QueryOrigin,
  type ConfusionCell,
} from './rag-coverage.utils';
import { useRelevanceJudgments, downloadJudgmentsJson } from '../hooks/useRelevanceJudgments';

const CORPUS_MODEL = 'gemini-embedding-001';

// Groups the user can toggle into the eval set. Failure modes are off by
// default to keep the first run's embedding-call count modest.
const SEED_GROUPS: { origin: QueryOrigin; label: string; defaultOn: boolean }[] = [
  { origin: 'example', label: 'Example queries', defaultOn: true },
  { origin: 'symptom', label: 'Symptom nodes', defaultOn: true },
  { origin: 'gap', label: 'Known gaps', defaultOn: true },
  { origin: 'failure-mode', label: 'Failure-mode nodes', defaultOn: false },
];

type SubTab = 'overview' | 'heatmap' | 'health' | 'judge';

// ─── Live retrieval runner ────────────────────────────────────────

async function runEvalSet(
  queries: EvalQuery[],
  provider: EmbeddingProvider,
  topK: number,
  onProgress: (done: number) => void,
): Promise<QueryRun[]> {
  const results: QueryRun[] = new Array(queries.length);
  const CONCURRENCY = 4;
  let done = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < queries.length) {
      const i = cursor++;
      const q = queries[i];
      try {
        // Providers without a modelId (simulated TF-IDF) can't be scored
        // against the baked embeddings — use the lexical corpus path so
        // coverage analysis still works keyless.
        let res;
        if (provider.modelId) {
          const [embedding] = await provider.embed([q.text]);
          res = await queryDense({
            queryEmbedding: embedding,
            queryModelId: provider.modelId,
            topK,
            minScore: 0, // keep the whole top-K; tau is applied in the UI
          });
        } else {
          res = await queryDenseLexical({ queryText: q.text, topK, minScore: 0 });
        }
        const hits: ChunkHit[] = res.matches.map((m, rank) => ({
          chunkId: m.chunk.id,
          source: m.chunk.source,
          section: m.chunk.section,
          score: m.score,
          rank,
          text: m.chunk.text.slice(0, 400),
        }));
        results[i] = {
          queryId: q.id,
          hits,
          bestScore: hits.length ? hits[0].score : 0,
          error: res.modelMismatch ? 'embedding model mismatch' : undefined,
        };
      } catch (err) {
        results[i] = { queryId: q.id, hits: [], bestScore: 0, error: String(err) };
      } finally {
        done++;
        onProgress(done);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker),
  );
  return results;
}

// ─── Small presentational helpers ─────────────────────────────────

function shortSource(source: string): string {
  return source.length > 22 ? `${source.slice(0, 21)}…` : source;
}

/** Background for a heat cell — opacity scales with score. */
function heatStyle(bestScore: number): React.CSSProperties {
  if (bestScore <= 0) return {};
  const alpha = Math.min(0.92, 0.12 + bestScore * 0.9);
  return { background: `rgba(14, 92, 102, ${alpha.toFixed(3)})`, color: bestScore > 0.5 ? '#fff' : 'var(--text)' };
}

function OriginBadge({ origin }: { origin: QueryOrigin }) {
  return <span className={`rag-origin-badge rag-origin-badge--${origin}`}>{ORIGIN_LABELS[origin]}</span>;
}

const CELL_LABELS: Record<ConfusionCell, string> = {
  TP: 'True positive',
  FP: 'False positive',
  FN: 'False negative',
  TN: 'True negative',
};

// ─── Main component ───────────────────────────────────────────────

export function RagCoverageView() {
  const { judgments, cycleRelevance, setAnswerable, clearAll, buildExport } = useRelevanceJudgments();

  const [enabled, setEnabled] = useState<Set<QueryOrigin>>(
    () => new Set(SEED_GROUPS.filter((g) => g.defaultOn).map((g) => g.origin)),
  );
  const [customText, setCustomText] = useState('');
  const [customQueries, setCustomQueries] = useState<string[]>([]);
  const [topK, setTopK] = useState(8);
  const [tau, setTau] = useState(0.35);

  const [inventory, setInventory] = useState<ChunkInventoryItem[] | null>(null);
  const [result, setResult] = useState<{ queries: EvalQuery[]; runs: QueryRun[]; topK: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [runError, setRunError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('overview');
  const [judgeFilter, setJudgeFilter] = useState<'all' | 'unlabeled' | 'weak'>('all');

  // Load the corpus inventory once (reuses the dense backend's cached parse).
  useEffect(() => {
    let alive = true;
    loadChunkInventory().then((inv) => { if (alive) setInventory(inv); });
    return () => { alive = false; };
  }, []);

  const provider = getEmbeddingProvider();
  const backend = getDenseBackend();
  const corpusModel = backend.modelId() ?? (inventory && inventory.length > 0 ? CORPUS_MODEL : undefined);
  // Semantic mode needs a provider whose modelId matches the baked corpus;
  // a provider without a modelId (simulated TF-IDF) now runs via the lexical
  // corpus path instead, so coverage analysis stays available keyless.
  const lexicalMode = !!provider && !provider.modelId;
  const denseReady =
    !!provider && (lexicalMode || !corpusModel || provider.modelId === corpusModel);

  // Assemble the live query set from enabled groups + custom queries.
  const assembledQueries = useMemo<EvalQuery[]>(() => {
    const out: EvalQuery[] = [];
    if (enabled.has('example')) out.push(...exampleQueries());
    if (enabled.has('symptom')) {
      out.push(...queriesFromNodes(nodesByType('Symptom').map((n) => ({ id: n.id, content: n.content })), 'symptom'));
    }
    if (enabled.has('failure-mode')) {
      out.push(...queriesFromNodes(nodesByType('FailureMode').map((n) => ({ id: n.id, content: n.content })), 'failure-mode'));
    }
    if (enabled.has('gap')) {
      out.push(...queriesFromGaps(corpusGaps.map((g) => ({ id: g.id, summary: g.summary }))));
    }
    for (const text of customQueries) {
      out.push({ id: `q-custom-${encodeURIComponent(text).slice(0, 48)}`, text, origin: 'custom' });
    }
    // De-dupe by id (a custom query could collide with itself).
    const seen = new Set<string>();
    return out.filter((q) => (seen.has(q.id) ? false : (seen.add(q.id), true)));
  }, [enabled, customQueries]);

  const stale =
    result !== null &&
    (result.topK !== topK ||
      result.queries.length !== assembledQueries.length ||
      result.queries.some((q, i) => q.id !== assembledQueries[i]?.id));

  const runQueries = useCallback(async () => {
    if (!provider || !denseReady || assembledQueries.length === 0) return;
    setRunning(true);
    setRunError(null);
    setProgress({ done: 0, total: assembledQueries.length });
    try {
      const runs = await runEvalSet(assembledQueries, provider, topK, (done) =>
        setProgress({ done, total: assembledQueries.length }),
      );
      setResult({ queries: assembledQueries, runs, topK });
      const mismatched = runs.filter((r) => r.error === 'embedding model mismatch').length;
      if (mismatched > 0) {
        setRunError(`${mismatched} queries skipped the dense tier — query embedding model does not match the corpus (${corpusModel ?? CORPUS_MODEL}).`);
      }
    } catch (err) {
      setRunError(String(err));
    } finally {
      setRunning(false);
    }
  }, [provider, denseReady, assembledQueries, topK, corpusModel]);

  function toggleGroup(origin: QueryOrigin) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(origin)) next.delete(origin); else next.add(origin);
      return next;
    });
  }

  function addCustom() {
    const t = customText.trim();
    if (!t || customQueries.includes(t)) { setCustomText(''); return; }
    setCustomQueries((prev) => [...prev, t]);
    setCustomText('');
  }

  // ─── Derived analytics (recompute on tau/judgment change; no re-run) ───
  const runs = useMemo(() => result?.runs ?? [], [result]);
  const ranQueries = useMemo(() => result?.queries ?? [], [result]);
  const runById = useMemo(() => new Map(runs.map((r) => [r.queryId, r])), [runs]);

  const sourceCoverage = useMemo(
    () => (inventory ? computeSourceCoverage(runs, inventory) : []),
    [runs, inventory],
  );
  const unusedChunks = useMemo(
    () => (inventory ? computeUnusedChunks(runs, inventory) : []),
    [runs, inventory],
  );
  const outcomes = useMemo(
    () => ranQueries.map((q) => computeQueryOutcome(q, runById.get(q.id), judgments, tau)),
    [ranQueries, runById, judgments, tau],
  );
  const outcomeById = useMemo(() => new Map(outcomes.map((o) => [o.queryId, o])), [outcomes]);
  const confusion = useMemo(() => summarizeConfusion(outcomes), [outcomes]);
  const chunkPrecision = useMemo(() => summarizeChunkPrecision(runs, judgments), [runs, judgments]);
  const weakQueries = useMemo(() => findWeakQueries(runs, tau), [runs, tau]);
  const weakSet = useMemo(() => new Set(weakQueries.map((w) => w.queryId)), [weakQueries]);

  const heatSources = useMemo(
    () => sourceCoverage.filter((s) => s.hitCount > 0).map((s) => s.source),
    [sourceCoverage],
  );
  const heatmap = useMemo(
    () => buildHeatmap(ranQueries, runs, heatSources),
    [ranQueries, runs, heatSources],
  );

  const queryText = useCallback(
    (id: string) => ranQueries.find((q) => q.id === id)?.text ?? id,
    [ranQueries],
  );

  const judgmentCount = Object.keys(judgments.relevance).length + Object.keys(judgments.answerable).length;

  // ─── Precondition gates ───────────────────────────────────────────
  const corpusEmpty = inventory !== null && inventory.length === 0;

  return (
    <div className="rag-coverage-view">
      <div className="rag-header">
        <div className="rag-header-row">
          <h2>RAG Coverage</h2>
          <div className="rag-header-actions">
            <span className="rag-judgment-count" title="Relevance + answerability judgments this session">
              Judgments: <strong>{judgmentCount}</strong>
            </span>
            <button
              type="button"
              className="expert-flag-export-btn"
              disabled={judgmentCount === 0}
              onClick={() => downloadJudgmentsJson(buildExport())}
              title="Download relevance judgments as JSON"
            >
              Export
            </button>
            <button
              type="button"
              className="expert-flag-clear-btn"
              disabled={judgmentCount === 0}
              onClick={() => {
                if (window.confirm(`Clear all ${judgmentCount} judgment${judgmentCount !== 1 ? 's' : ''}?`)) clearAll();
              }}
            >
              Clear
            </button>
          </div>
        </div>
        <p className="rag-subtitle">
          Which chunks and documents actually get retrieved for a set of queries — coverage, dead
          corpus, and (once you judge relevance) a TP / FP / FN / TN matrix. Retrieval runs live
          against the dense corpus; scoring is over chunk/doc hits, not embedding projections.
        </p>
      </div>

      {/* Config bar */}
      <div className="rag-config">
        <div className="rag-config-block">
          <span className="rag-config-label">Query set</span>
          <div className="rag-group-toggles">
            {SEED_GROUPS.map((g) => {
              const count = countForGroup(g.origin);
              return (
                <label key={g.origin} className={`rag-group-toggle ${enabled.has(g.origin) ? 'active' : ''}`}>
                  <input type="checkbox" checked={enabled.has(g.origin)} onChange={() => toggleGroup(g.origin)} />
                  {g.label} <span className="rag-group-count">{count}</span>
                </label>
              );
            })}
          </div>
          <div className="rag-custom-row">
            <input
              type="text"
              className="lab-node-input"
              placeholder="Add a custom query…"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            />
            <button type="button" className="btn-secondary" onClick={addCustom} disabled={!customText.trim()}>
              Add
            </button>
          </div>
          {customQueries.length > 0 && (
            <div className="rag-custom-chips">
              {customQueries.map((t) => (
                <span key={t} className="rag-custom-chip">
                  {t}
                  <button type="button" onClick={() => setCustomQueries((prev) => prev.filter((x) => x !== t))} aria-label="Remove">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rag-config-block rag-config-sliders">
          <label className="rag-slider">
            <span>Top-K per query: <strong>{topK}</strong></span>
            <input type="range" min={3} max={15} step={1} value={topK} onChange={(e) => setTopK(Number(e.target.value))} />
          </label>
          <label className="rag-slider">
            <span>Relevance threshold τ: <strong>{tau.toFixed(2)}</strong></span>
            <input type="range" min={0.15} max={0.65} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} />
            <span className="rag-slider-hint">Score proxy for a “hit” until you judge relevance. Recomputes without re-running.</span>
          </label>
        </div>

        <div className="rag-config-block rag-config-run">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void runQueries()}
            disabled={running || !denseReady || assembledQueries.length === 0}
          >
            {running
              ? `Running ${progress.done}/${progress.total}…`
              : `Run ${assembledQueries.length} quer${assembledQueries.length === 1 ? 'y' : 'ies'}`}
          </button>
          {stale && !running && <span className="rag-stale-hint">Query set / K changed — re-run to refresh.</span>}
        </div>
      </div>

      {runError && <div className="rag-warning" role="status">⚠ {runError}</div>}

      {/* Precondition messaging */}
      {corpusEmpty ? (
        <div className="lab-empty-state">
          <p>No dense corpus loaded.</p>
          <p>Run <code>npm run ingest</code> to generate <code>public/ajp-corpus.json</code>, then reload.</p>
        </div>
      ) : !denseReady ? (
        <div className="lab-empty-state">
          <p><strong>Dense retrieval needs a matching embedding provider.</strong></p>
          <p>
            The corpus is embedded with <code>{corpusModel ?? CORPUS_MODEL}</code>. Add a Gemini API
            key via the gear icon in the header to run live coverage — the simulated/offline provider
            can’t query the baked vectors.
          </p>
        </div>
      ) : !result ? (
        <div className="lab-empty-state">
          <p>Assemble a query set above and press <strong>Run</strong>.</p>
          <p className="rag-run-note">
            {lexicalMode
              ? <>Keyless mode: queries run as TF-IDF keyword matches over{' '}
                  {inventory ? inventory.length : '—'} corpus chunks (add a Gemini key for semantic
                  scoring). {assembledQueries.length} queries queued.</>
              : <>Each query is one embedding call against your Gemini key, then a cosine sweep over{' '}
                  {inventory ? inventory.length : '—'} corpus chunks. {assembledQueries.length} queries queued.</>}
          </p>
        </div>
      ) : (
        <>
          <div className="rag-subtabs">
            {([
              ['overview', 'Overview & metrics'],
              ['heatmap', 'Coverage heatmap'],
              ['health', 'Corpus health'],
              ['judge', 'Judge relevance'],
            ] as [SubTab, string][]).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`nav-tab ${subTab === id ? 'active' : ''}`}
                onClick={() => setSubTab(id)}
              >
                {label}
                {id === 'judge' && confusion.unlabeled > 0 && (
                  <span className="tab-count">{confusion.unlabeled}</span>
                )}
              </button>
            ))}
          </div>

          <div className="rag-subtab-content">
            {subTab === 'overview' && (
              <OverviewPanel
                confusion={confusion}
                chunkPrecision={chunkPrecision}
                totalQueries={ranQueries.length}
                weakCount={weakQueries.length}
                unusedCount={unusedChunks.length}
                totalChunks={inventory?.length ?? 0}
                tau={tau}
              />
            )}
            {subTab === 'heatmap' && (
              <HeatmapPanel heatmap={heatmap} queryText={queryText} ranQueries={ranQueries} outcomeById={outcomeById} />
            )}
            {subTab === 'health' && (
              <HealthPanel
                sourceCoverage={sourceCoverage}
                unusedChunks={unusedChunks}
                weakQueries={weakQueries}
                queryText={queryText}
                tau={tau}
              />
            )}
            {subTab === 'judge' && (
              <JudgePanel
                ranQueries={ranQueries}
                runById={runById}
                judgments={judgments}
                outcomeById={outcomeById}
                cycleRelevance={cycleRelevance}
                setAnswerable={setAnswerable}
                filter={judgeFilter}
                setFilter={setJudgeFilter}
                weakSet={weakSet}
                tau={tau}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Group counts are cheap (graph nodes / gaps / examples) — compute directly.
function countForGroup(origin: QueryOrigin): number {
  switch (origin) {
    case 'example': return exampleQueries().length;
    case 'symptom': return nodesByType('Symptom').length;
    case 'failure-mode': return nodesByType('FailureMode').length;
    case 'gap': return corpusGaps.length;
    default: return 0;
  }
}

// ─── Overview & metrics ───────────────────────────────────────────

function OverviewPanel({
  confusion,
  chunkPrecision,
  totalQueries,
  weakCount,
  unusedCount,
  totalChunks,
  tau,
}: {
  confusion: ReturnType<typeof summarizeConfusion>;
  chunkPrecision: ReturnType<typeof summarizeChunkPrecision>;
  totalQueries: number;
  weakCount: number;
  unusedCount: number;
  totalChunks: number;
  tau: number;
}) {
  const labeled = confusion.TP + confusion.FP + confusion.FN + confusion.TN;
  return (
    <div className="rag-overview">
      <div className="rag-metric-row">
        <MetricCard label="Queries run" value={String(totalQueries)} sub={`${confusion.unlabeled} unlabeled`} />
        <MetricCard label="Precision" value={pct(confusion.precision)} sub="TP / (TP+FP)" tone="accent" />
        <MetricCard label="Recall" value={pct(confusion.recall)} sub="TP / (TP+FN)" tone="accent" />
        <MetricCard label="F1" value={pct(confusion.f1)} sub="harmonic mean" tone="accent" />
        <MetricCard label="Weak queries" value={String(weakCount)} sub={`best hit < ${tau.toFixed(2)}`} tone="warn" />
        <MetricCard label="Unused chunks" value={`${unusedCount}/${totalChunks}`} sub="never retrieved" tone="warn" />
      </div>

      <div className="rag-matrix-wrap">
        <div className="rag-matrix-card">
          <h3>Query-level confusion matrix</h3>
          <p className="rag-matrix-caption">
            Scored per query: <em>answerable</em> = you asserted the corpus should answer it;{' '}
            <em>hit</em> = a retrieved chunk you judged relevant (or, until judged, best score ≥ τ).
            {labeled === 0 && ' Mark queries answerable in the Judge tab to populate this.'}
          </p>
          <table className="rag-confusion">
            <thead>
              <tr>
                <th aria-hidden />
                <th className="rag-confusion-axis" colSpan={2}>Retrieved a relevant hit</th>
              </tr>
              <tr>
                <th aria-hidden />
                <th>Yes</th>
                <th>No</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="rag-confusion-axis">Answerable · Yes</th>
                <td className="rag-cell rag-cell--tp"><span className="rag-cell-tag">TP</span><span className="rag-cell-n">{confusion.TP}</span></td>
                <td className="rag-cell rag-cell--fn"><span className="rag-cell-tag">FN</span><span className="rag-cell-n">{confusion.FN}</span></td>
              </tr>
              <tr>
                <th className="rag-confusion-axis">Answerable · No</th>
                <td className="rag-cell rag-cell--fp"><span className="rag-cell-tag">FP</span><span className="rag-cell-n">{confusion.FP}</span></td>
                <td className="rag-cell rag-cell--tn"><span className="rag-cell-tag">TN</span><span className="rag-cell-n">{confusion.TN}</span></td>
              </tr>
            </tbody>
          </table>
          <ul className="rag-legend">
            <li><strong>FN</strong> — should be covered but retrieval missed it → tune or <em>expand the corpus</em>.</li>
            <li><strong>FP</strong> — pulled chunks for a query the corpus shouldn’t answer → over-retrieval risk.</li>
            <li><strong>TN</strong> — correctly returned nothing for out-of-scope queries → the system declining well.</li>
          </ul>
        </div>

        <div className="rag-matrix-card">
          <h3>Chunk-level precision</h3>
          <p className="rag-matrix-caption">
            Over every retrieved chunk you’ve judged (independent of the query-level matrix).
          </p>
          <div className="rag-chunkprec-headline">
            <span className="rag-chunkprec-value">{pct(chunkPrecision.precision)}</span>
            <span className="rag-chunkprec-sub">{chunkPrecision.tp} relevant · {chunkPrecision.fp} irrelevant judged</span>
          </div>
          {chunkPrecision.perSource.length > 0 ? (
            <table className="rag-mini-table">
              <thead><tr><th>Source</th><th>Rel</th><th>Irrel</th><th>Prec</th></tr></thead>
              <tbody>
                {chunkPrecision.perSource.map((s) => (
                  <tr key={s.source}>
                    <td title={s.source}>{shortSource(s.source)}</td>
                    <td>{s.tp}</td>
                    <td>{s.fp}</td>
                    <td>{pct(s.precision)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="lab-empty-note">No chunks judged yet — use the Judge tab.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'accent' | 'warn' }) {
  return (
    <div className={`rag-metric-card ${tone ? `rag-metric-card--${tone}` : ''}`}>
      <span className="rag-metric-value">{value}</span>
      <span className="rag-metric-label">{label}</span>
      {sub && <span className="rag-metric-sub">{sub}</span>}
    </div>
  );
}

// ─── Coverage heatmap ─────────────────────────────────────────────

function HeatmapPanel({
  heatmap,
  queryText,
  ranQueries,
  outcomeById,
}: {
  heatmap: ReturnType<typeof buildHeatmap>;
  queryText: (id: string) => string;
  ranQueries: EvalQuery[];
  outcomeById: Map<string, ReturnType<typeof computeQueryOutcome>>;
}) {
  const originById = useMemo(() => new Map(ranQueries.map((q) => [q.id, q.origin])), [ranQueries]);
  if (heatmap.sources.length === 0) {
    return <p className="lab-empty-note">No hits above threshold — every query came back empty. That itself is a strong coverage signal.</p>;
  }
  return (
    <div className="rag-heatmap-wrap">
      <p className="rag-panel-caption">
        Each cell shows how many of a query’s top-K hits came from a source; color intensity is the
        best score. Blank = that source never surfaced for the query. Rows with mostly blank cells or
        pale colors are corpus-thin for that query.
      </p>
      <div className="rag-heatmap-scroll">
        <table className="rag-heatmap">
          <thead>
            <tr>
              <th className="rag-heatmap-corner">Query</th>
              {heatmap.sources.map((s) => (
                <th key={s} className="rag-heatmap-col" title={s}><span>{shortSource(s)}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => {
              const outcome = outcomeById.get(row.queryId);
              return (
                <tr key={row.queryId}>
                  <th className="rag-heatmap-rowlabel" title={queryText(row.queryId)}>
                    <span className={`rag-heat-origin rag-origin-badge--${originById.get(row.queryId) ?? 'custom'}`} />
                    <span className="rag-heat-qtext">{queryText(row.queryId)}</span>
                    {outcome?.cell && <span className={`rag-heat-cell-tag rag-cell--${outcome.cell.toLowerCase()}`}>{outcome.cell}</span>}
                  </th>
                  {heatmap.sources.map((s) => {
                    const cell = row.cells[s];
                    return (
                      <td
                        key={s}
                        className="rag-heat-cell"
                        style={cell ? heatStyle(cell.bestScore) : undefined}
                        title={cell ? `${s}\n${cell.count} hit(s), best ${Math.round(cell.bestScore * 100)}%` : `${s}: no hits`}
                      >
                        {cell ? cell.count : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Corpus health ────────────────────────────────────────────────

function HealthPanel({
  sourceCoverage,
  unusedChunks,
  weakQueries,
  queryText,
  tau,
}: {
  sourceCoverage: ReturnType<typeof computeSourceCoverage>;
  unusedChunks: ChunkInventoryItem[];
  weakQueries: ReturnType<typeof findWeakQueries>;
  queryText: (id: string) => string;
  tau: number;
}) {
  const unusedBySource = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of unusedChunks) m.set(c.source, (m.get(c.source) ?? 0) + 1);
    return m;
  }, [unusedChunks]);

  return (
    <div className="rag-health">
      <section className="rag-health-section">
        <h3>Per-source coverage</h3>
        <p className="rag-panel-caption">
          How much of each source the query set exercises. Low “chunks hit / total” = the query set
          never touches most of that document (blind spot or an over-large source).
        </p>
        <table className="rag-source-table">
          <thead>
            <tr><th>Source</th><th>Chunks hit</th><th>Coverage</th><th>Queries</th><th>Total hits</th><th>Best</th></tr>
          </thead>
          <tbody>
            {sourceCoverage.map((s) => (
              <tr key={s.source} className={s.chunksHit === 0 ? 'rag-source-row--dead' : ''}>
                <td title={s.source}>{shortSource(s.source)}</td>
                <td>{s.chunksHit}/{s.totalChunks}</td>
                <td>
                  <div className="rag-cov-bar">
                    <div className="rag-cov-bar-fill" style={{ width: `${Math.round(s.coverageRatio * 100)}%` }} />
                    <span>{pct(s.coverageRatio)}</span>
                  </div>
                </td>
                <td>{s.queriesHitting}</td>
                <td>{s.hitCount}</td>
                <td>{s.bestScore > 0 ? `${Math.round(s.bestScore * 100)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="rag-health-cols">
        <section className="rag-health-section">
          <h3>Weak queries <span className="rag-count-pill">{weakQueries.length}</span></h3>
          <p className="rag-panel-caption">Best hit below τ={tau.toFixed(2)} — candidates for corpus expansion.</p>
          {weakQueries.length > 0 ? (
            <ul className="rag-weak-list">
              {weakQueries.map((w) => (
                <li key={w.queryId}>
                  <span className="rag-weak-score">{Math.round(w.bestScore * 100)}%</span>
                  <span className="rag-weak-text" title={queryText(w.queryId)}>{queryText(w.queryId)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="lab-empty-note">No weak queries — every query has a hit ≥ τ.</p>}
        </section>

        <section className="rag-health-section">
          <h3>Unused chunks <span className="rag-count-pill">{unusedChunks.length}</span></h3>
          <p className="rag-panel-caption">Never retrieved by any query in this set — dead/unexercised corpus.</p>
          {unusedBySource.size > 0 ? (
            <ul className="rag-unused-list">
              {Array.from(unusedBySource.entries()).sort((a, b) => b[1] - a[1]).map(([source, n]) => (
                <li key={source}>
                  <span className="rag-unused-count">{n}</span>
                  <span title={source}>{shortSource(source)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="lab-empty-note">Every chunk was retrieved by at least one query.</p>}
        </section>
      </div>
    </div>
  );
}

// ─── Judge relevance ──────────────────────────────────────────────

function JudgePanel({
  ranQueries,
  runById,
  judgments,
  outcomeById,
  cycleRelevance,
  setAnswerable,
  filter,
  setFilter,
  weakSet,
  tau,
}: {
  ranQueries: EvalQuery[];
  runById: Map<string, QueryRun>;
  judgments: ReturnType<typeof useRelevanceJudgments>['judgments'];
  outcomeById: Map<string, ReturnType<typeof computeQueryOutcome>>;
  cycleRelevance: (queryId: string, chunkId: string) => void;
  setAnswerable: (queryId: string, value: 'yes' | 'no' | null) => void;
  filter: 'all' | 'unlabeled' | 'weak';
  setFilter: (f: 'all' | 'unlabeled' | 'weak') => void;
  weakSet: Set<string>;
  tau: number;
}) {
  const visible = ranQueries.filter((q) => {
    if (filter === 'unlabeled') return (outcomeById.get(q.id)?.answerable ?? 'unknown') === 'unknown';
    if (filter === 'weak') return weakSet.has(q.id);
    return true;
  });

  return (
    <div className="rag-judge">
      <div className="rag-judge-toolbar">
        <p className="rag-panel-caption">
          Set whether the corpus <em>should</em> answer each query, then mark each retrieved chunk
          relevant (✓) or not (✗). These judgments are the ground truth behind the confusion matrix.
        </p>
        <div className="rag-judge-filters">
          {(['all', 'unlabeled', 'weak'] as const).map((f) => (
            <button key={f} type="button" className={`rag-filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'unlabeled' ? 'Unlabeled' : 'Weak only'}
            </button>
          ))}
        </div>
      </div>

      <div className="rag-judge-list">
        {visible.map((q) => {
          const run = runById.get(q.id);
          const outcome = outcomeById.get(q.id);
          const answerable = outcome?.answerable ?? 'unknown';
          return (
            <div key={q.id} className="rag-judge-card">
              <div className="rag-judge-card-head">
                <OriginBadge origin={q.origin} />
                <span className="rag-judge-qtext">{q.text}</span>
                {q.refId && <span className="graph-node-ref">{q.refId}</span>}
                {outcome?.cell && <span className={`rag-heat-cell-tag rag-cell--${outcome.cell.toLowerCase()}`} title={CELL_LABELS[outcome.cell]}>{outcome.cell}</span>}
              </div>

              <div className="rag-answerable-row">
                <span className="rag-answerable-label">Corpus should answer this?</span>
                <button
                  type="button"
                  className={`rag-ans-btn ${answerable === 'yes' ? 'rag-ans-btn--yes' : ''}`}
                  onClick={() => setAnswerable(q.id, answerable === 'yes' ? null : 'yes')}
                >Yes</button>
                <button
                  type="button"
                  className={`rag-ans-btn ${answerable === 'no' ? 'rag-ans-btn--no' : ''}`}
                  onClick={() => setAnswerable(q.id, answerable === 'no' ? null : 'no')}
                >Not in corpus</button>
                {outcome && (
                  <span className={`rag-hitstate rag-hitstate--${outcome.hitState}`}>
                    {outcome.hitState === 'judged-hit' ? 'relevant hit'
                      : outcome.hitState === 'judged-miss' ? 'no relevant hit'
                      : outcome.hitState === 'proxy-hit' ? `best ≥ τ (unjudged)`
                      : `best < τ (unjudged)`}
                  </span>
                )}
              </div>

              {run && run.hits.length > 0 ? (
                <ul className="rag-hit-list">
                  {run.hits.map((h) => {
                    const verdict = judgments.relevance[`${q.id}::${h.chunkId}`];
                    return (
                      <li key={h.chunkId} className={`rag-hit ${verdict ? `rag-hit--${verdict}` : ''}`}>
                        <button
                          type="button"
                          className={`rag-hit-verdict rag-hit-verdict--${verdict ?? 'none'}`}
                          onClick={() => cycleRelevance(q.id, h.chunkId)}
                          title="Cycle: unset → relevant → irrelevant"
                        >
                          {verdict === 'relevant' ? '✓' : verdict === 'irrelevant' ? '✗' : '·'}
                        </button>
                        <span className={`rag-hit-score ${h.score >= tau ? 'rag-hit-score--strong' : 'rag-hit-score--weak'}`}>
                          {Math.round(h.score * 100)}%
                        </span>
                        <div className="rag-hit-body">
                          <div className="rag-hit-meta">
                            <span className="dense-match-source" title={h.source}>{shortSource(h.source)}</span>
                            <span className="dense-match-section">— {h.section}</span>
                          </div>
                          {h.text && <p className="rag-hit-text">{h.text}{h.text.length >= 400 ? '…' : ''}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="lab-empty-note">
                  {run?.error ? `Retrieval error: ${run.error}` : 'No chunks retrieved above the corpus floor — a strong FN / expansion signal.'}
                </p>
              )}
            </div>
          );
        })}
        {visible.length === 0 && <p className="lab-empty-note">No queries match this filter.</p>}
      </div>
    </div>
  );
}
