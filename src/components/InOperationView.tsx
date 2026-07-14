/**
 * In-Operation (field reachback) view for AJP training.
 * Operator describes what they observe; system returns corpus-grounded causal chains
 * (graph tier) augmented by relevant SOP/literature passages (dense tier when available).
 *
 * Uses hybrid retrieval (graph + dense) from hybrid-retrieval.ts:
 *   - Graph tier:  always available, returns typed causal chains
 *   - Dense tier:  active after running `npm run ingest`, returns SOP/paper excerpts
 *
 * Every graph result is traceable to a knowledge graph node — no generated content.
 * Dense results cite their source document and section.
 */
import { useState, useRef, useId } from 'react';
import type { CausalChainResult, NodeMatchTrace } from '../engine/retrieval/graph-retrieval';
import type { DenseMatch } from '../engine/retrieval/dense-retrieval';
import { retrieveHybrid, formatHybridContext } from '../engine/retrieval/hybrid-retrieval';
import type { HybridResult } from '../engine/retrieval/hybrid-retrieval';
import { getMentorService } from '../engine/mentor';
import type { MentorEvaluation } from '../engine/mentor';
import {
  confidenceLabel,
  confidenceClass,
  extractSafetyAlerts,
  chainSeverityClass,
  nodeLabel,
  isConservativeAction,
  emptyStateText,
  noResultsText,
  chainTopicTitle,
} from './in-operation-view.utils';
import { SourceRefText } from './SourceRefText';
import { MentorDegradedBanner } from './MentorDegradedBanner';

// ─── Graph tier sub-renderers ─────────────────────────────────────

function SafetyAlertBar({ alerts }: { alerts: string[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="safety-alert-bar">
      {alerts.map((a) => (
        <div key={a} className="safety-alert-item">
          ⚠️ <SourceRefText text={a} />
        </div>
      ))}
    </div>
  );
}

/** SVG fan-out: query text → highest-scoring Symptom / FailureMode nodes (lookup engine). */
function NodeLookupEngineViz({ queryText, trace }: { queryText: string; trace: NodeMatchTrace[] }) {
  const markerId = `arrow-lookup-${useId().replace(/:/g, '')}`;
  const top = trace.slice(0, 6);
  if (top.length === 0) {
    return (
      <p className="in-op-lookup-viz-empty">
        No symptom or fault nodes scored above the retrieval threshold for this query.
      </p>
    );
  }
  const qPreview = queryText.length > 42 ? `${queryText.slice(0, 41)}…` : queryText;
  const w = 520;
  const h = 132;
  const qx = 24;
  const qy = 46;
  const qw = 100;
  const qh = 40;

  return (
    <div className="in-op-lookup-viz">
      <svg className="in-op-lookup-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Node match graph">
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="rgba(148,163,184,0.7)" />
          </marker>
        </defs>
        <rect x={qx} y={qy} width={qw} height={qh} rx="8" className="in-op-svg-node in-op-svg-node--query" />
        <text x={qx + qw / 2} y={qy + qh / 2 + 4} textAnchor="middle" className="in-op-svg-label in-op-svg-label--query">
          {qPreview}
        </text>
        {top.map((m, i) => {
          const nx = 168 + (i % 3) * 112;
          const ny = 18 + Math.floor(i / 3) * 58;
          const nw = 104;
          const nh = 36;
          const scorePct = Math.round(m.score * 100);
          const idShort = m.nodeId.length > 14 ? `${m.nodeId.slice(0, 13)}…` : m.nodeId;
          const cx = qx + qw;
          const cy = qy + qh / 2;
          const tx = nx;
          const ty = ny + nh / 2;
          return (
            <g key={m.nodeId}>
              <line
                x1={cx}
                y1={cy}
                x2={tx}
                y2={ty}
                className="in-op-svg-edge"
                markerEnd={`url(#${markerId})`}
              />
              <rect x={nx} y={ny} width={nw} height={nh} rx="6" className={`in-op-svg-node in-op-svg-node--${m.nodeType === 'Symptom' ? 'symptom' : 'fault'}`} />
              <text x={nx + 6} y={ny + 14} className="in-op-svg-id">{idShort}</text>
              <text x={nx + 6} y={ny + 28} className="in-op-svg-meta">
                {m.nodeType} · {scorePct}% · {m.matchMethod}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Compact causal graph for one chain: indicators → fault → actions. */
function CausalChainFlowSvg({ chain }: { chain: CausalChainResult }) {
  const markerId = `arrow-chain-${useId().replace(/:/g, '')}`;
  const symptoms = chain.symptoms.slice(0, 4);
  const actions = chain.correctiveActions.slice(0, 5);
  const rowH = 34;
  const leftW = 118;
  const midW = 132;
  const rightW = 118;
  const gap = 28;
  const pad = 16;
  const leftCount = Math.max(symptoms.length, 1);
  const rightCount = Math.max(actions.length, 1);
  const bodyRows = Math.max(leftCount, rightCount);
  const h = pad * 2 + bodyRows * rowH + 8;
  const w = pad * 2 + leftW + gap + midW + gap + rightW;
  const midX = pad + leftW + gap;
  const midY = pad + (bodyRows * rowH) / 2 - 22;

  const faultShort = chain.fault.id.length > 16 ? `${chain.fault.id.slice(0, 15)}…` : chain.fault.id;

  return (
    <div className="in-op-chain-flow-wrap">
      <svg className="in-op-chain-flow-svg" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Causal chain graph">
        <defs>
          <marker id={markerId} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="rgba(94,234,212,0.55)" />
          </marker>
        </defs>
        <text x={pad} y={pad + 10} className="in-op-svg-col-title">INDICATES (symptoms)</text>
        <text x={midX} y={pad + 10} className="in-op-svg-col-title">Fault</text>
        <text x={midX + midW + gap} y={pad + 10} className="in-op-svg-col-title">FIXED_BY (actions)</text>

        {symptoms.length === 0 ? (
          <text x={pad} y={pad + 36} className="in-op-svg-meta">(none in chain — matched via fault text)</text>
        ) : (
          symptoms.map((s, i) => {
            const y = pad + 22 + i * rowH;
            const idS = s.id.length > 15 ? `${s.id.slice(0, 14)}…` : s.id;
            return (
              <g key={s.id}>
                <rect x={pad} y={y} width={leftW} height={rowH - 6} rx="6" className="in-op-svg-node in-op-svg-node--symptom" />
                <text x={pad + 6} y={y + 20} className="in-op-svg-id">{idS}</text>
                <line
                  x1={pad + leftW}
                  y1={y + (rowH - 6) / 2}
                  x2={midX}
                  y2={midY + 20}
                  className="in-op-svg-edge in-op-svg-edge--accent"
                  markerEnd={`url(#${markerId})`}
                />
              </g>
            );
          })
        )}

        <rect x={midX} y={midY} width={midW} height={44} rx="8" className="in-op-svg-node in-op-svg-node--fault-center" />
        <text x={midX + midW / 2} y={midY + 27} textAnchor="middle" className="in-op-svg-id in-op-svg-id--center">
          {faultShort}
        </text>

        {actions.map((a, i) => {
          const y = pad + 22 + i * rowH;
          const ax = midX + midW + gap;
          const idA = a.id.length > 15 ? `${a.id.slice(0, 14)}…` : a.id;
          return (
            <g key={a.id}>
              <line
                x1={midX + midW}
                y1={midY + 22}
                x2={ax}
                y2={y + (rowH - 6) / 2}
                className="in-op-svg-edge in-op-svg-edge--accent"
                markerEnd={`url(#${markerId})`}
              />
              <rect x={ax} y={y} width={rightW} height={rowH - 6} rx="6" className="in-op-svg-node in-op-svg-node--action" />
              <text x={ax + 6} y={y + 20} className="in-op-svg-id">{idA}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ChainAnalysisBody({ chain }: { chain: CausalChainResult }) {
  const safetyAlerts = extractSafetyAlerts(chain);
  const conservativeActions = chain.correctiveActions.filter(isConservativeAction);
  const escalationActions = chain.correctiveActions.filter((a) => !isConservativeAction(a));

  return (
    <div className="chain-body">
      <CausalChainFlowSvg chain={chain} />
      {safetyAlerts.length > 0 && <SafetyAlertBar alerts={safetyAlerts} />}

      <section className="chain-section">
        <h4>Fault</h4>
        <p className="chain-content">
          <SourceRefText text={chain.fault.content} />
        </p>
        <span className="chain-node-ref">{nodeLabel(chain.fault)}</span>
      </section>

      {chain.symptoms.length > 0 && (
        <section className="chain-section">
          <h4>Matching Indicators</h4>
          <ul className="chain-list">
            {chain.symptoms.map((s) => (
              <li key={s.id}>
                <span className="chain-content">
                  <SourceRefText text={s.content} />
                </span>
                <span className="chain-node-ref">{nodeLabel(s)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {conservativeActions.length > 0 && (
        <section className="chain-section chain-section--action">
          <h4>First-Line Response (conservative)</h4>
          {conservativeActions.map((a) => (
            <div key={a.id} className="action-card action-card--conservative">
              <p className="chain-content">
                <SourceRefText text={a.content} />
              </p>
              <span className="chain-node-ref">{nodeLabel(a)}</span>
            </div>
          ))}
        </section>
      )}

      {escalationActions.length > 0 && (
        <section className="chain-section chain-section--escalation">
          <h4>Escalation (if conservative fails)</h4>
          {escalationActions.map((a) => (
            <div key={a.id} className="action-card action-card--escalation">
              <p className="chain-content">
                <SourceRefText text={a.content} />
              </p>
              {a.safetyAlert && (
                <div className="safety-alert">
                  ⚠️ <SourceRefText text={a.safetyAlert} />
                </div>
              )}
              <span className="chain-node-ref">{nodeLabel(a)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function ReachbackCautionBand({ chains }: { chains: CausalChainResult[] }) {
  const notes = chains.flatMap((c) => c.reachbackNote ? [c.reachbackNote] : []);
  const uniqueNotes = [...new Set(notes)];
  if (uniqueNotes.length === 0) return null;
  return (
    <div className="reachback-caution-band" role="alert">
      <strong>⚠ Reachback confidence limited</strong>
      {uniqueNotes.map((note) => (
        <p key={note} className="reachback-caution-note">
          This situation may exceed reliable corpus coverage. Recommended: {note} Do not proceed until verified.
        </p>
      ))}
    </div>
  );
}

function GraphResultsPanel({
  chains,
  queryText,
  nodeMatchTrace,
  resultKey,
}: {
  chains: CausalChainResult[];
  queryText: string;
  nodeMatchTrace: NodeMatchTrace[];
  resultKey: string;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(chains.length === 1 ? 0 : null);
  const [prevResultKey, setPrevResultKey] = useState(resultKey);

  // New retrieval result: reset the selection during render (auto-select when
  // there is exactly one chain) instead of via an effect.
  if (prevResultKey !== resultKey) {
    setPrevResultKey(resultKey);
    setSelectedIdx(chains.length === 1 ? 0 : null);
  }

  if (chains.length === 0) {
    return <p className="in-op-empty">{noResultsText(queryText)}</p>;
  }

  const selectedChain = selectedIdx !== null ? chains[selectedIdx] : null;

  return (
    <div className="in-op-results">
      <ReachbackCautionBand chains={chains} />

      <div className="in-op-results-block">
        <h3 className="in-op-block-title">1 · Node-based lookup</h3>
        <p className="in-op-block-hint">
          Symptom and failure-mode nodes scored against your text (token or embedding match), before chains are ranked.
        </p>
        <NodeLookupEngineViz queryText={queryText} trace={nodeMatchTrace} />
      </div>

      <div className="in-op-results-block">
        <h3 className="in-op-block-title">2 · Ranked fault chains</h3>
        <p className="in-op-block-hint">
          Each row is one candidate topic. Select a row to open the full corpus-grounded analysis and causal diagram below.
        </p>
        <p className="in-op-results-meta">
          {chains.length} chain{chains.length > 1 ? 's' : ''} · corpus-grounded (no generation)
        </p>
        <div className="chain-topic-list" role="listbox" aria-label="Ranked fault chains">
          {chains.map((chain, i) => {
            const selected = i === selectedIdx;
            return (
              <button
                key={chain.fault.id}
                type="button"
                className={`chain-topic-row ${selected ? 'chain-topic-row--selected' : ''}`}
                role="option"
                aria-selected={selected}
                onClick={() => setSelectedIdx(i)}
              >
                <span className="chain-topic-rank">#{i + 1}</span>
                <span className="chain-topic-text">{chainTopicTitle(chain)}</span>
                <span className={`chain-topic-confidence ${confidenceClass(chain.anchorScore)}`}>
                  {confidenceLabel(chain.anchorScore)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="in-op-results-block in-op-results-block--analysis">
        <h3 className="in-op-block-title">3 · Chain analysis</h3>
        {selectedChain ? (
          <div className={chainSeverityClass(selectedChain)}>
            <ChainAnalysisBody chain={selectedChain} />
          </div>
        ) : (
          <p className="in-op-analysis-placeholder">
            Select a chain in step 2 to show the causal graph, safety notes, and corrective actions here.
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Dense tier sub-renderers ─────────────────────────────────────

function DenseMatchCard({ match, rank }: { match: DenseMatch; rank: number }) {
  const [expanded, setExpanded] = useState(rank === 0);
  const scorePercent = Math.round(match.score * 100);

  return (
    <div className="dense-match-card">
      <button
        type="button"
        className="dense-match-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span className="dense-match-source">{match.chunk.source}</span>
        <span className="dense-match-section">— {match.chunk.section}</span>
        <span className="dense-match-score">{scorePercent}% match</span>
        <span className="chain-toggle">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="dense-match-body">
          <p className="dense-match-text">{match.chunk.text}</p>
          <span className="chain-node-ref">chunk: {match.chunk.id}</span>
        </div>
      )}
    </div>
  );
}

function DenseResultsPanel({ matches }: { matches: DenseMatch[] }) {
  return (
    <div className="in-op-dense-results">
      <h3 className="in-op-section-title">SOP / Literature Context</h3>
      <p className="in-op-results-meta">
        {matches.length} relevant passage{matches.length > 1 ? 's' : ''} from ingested corpus
      </p>
      {matches.map((m, i) => (
        <DenseMatchCard key={m.chunk.id} match={m} rank={i} />
      ))}
    </div>
  );
}

// ─── Mentor interpret panel ───────────────────────────────────────
// Feeds formatHybridContext() output into the Mentor LLM so the operator
// can ask follow-up questions grounded in the retrieved corpus.
// Only rendered when a Mentor service is available (Gemini API key present).

function MentorInterpretPanel({
  hybridResult,
  queryText,
}: {
  hybridResult: HybridResult;
  queryText: string;
}) {
  const mentorService = getMentorService();
  const [followUp, setFollowUp] = useState('');
  const [evaluation, setEvaluation] = useState<MentorEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  if (!mentorService) return null;

  const retrievalContext = formatHybridContext(hybridResult);
  if (!retrievalContext) return null;

  async function handleAsk() {
    if (!followUp.trim() || loading) return;
    setLoading(true);
    try {
      const result = await mentorService!.evaluate({
        probeQuestion: queryText,
        expectedConcepts: [],
        learnerResponse: followUp.trim(),
        priorAttempts: attempts,
        retrievalContext,
        safetyGate: false,
      });
      setEvaluation(result);
      setAttempts((n) => n + 1);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mentor-interpret-panel">
      <div className="mentor-label">🧑‍🏫 ASK THE MENTOR</div>
      <p className="mentor-interpret-hint">
        Ask a follow-up question. The Mentor draws directly from the causal chains and SOP
        passages retrieved above.
      </p>
      {!evaluation && (
        <>
          <textarea
            className="mentor-textarea"
            rows={2}
            placeholder={`e.g. "What should I do first given these results?"`}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleAsk();
              }
            }}
            disabled={loading}
            aria-label="Mentor follow-up question"
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleAsk()}
            disabled={!followUp.trim() || loading}
          >
            {loading ? 'Asking Mentor…' : 'Ask Mentor (Ctrl+Enter)'}
          </button>
        </>
      )}
      {evaluation && (
        <div className="mentor-evaluation eval--partial">
          {evaluation.degraded ? (
            <MentorDegradedBanner feedback={evaluation.feedback} />
          ) : (
            <p className="eval-feedback">{evaluation.feedback}</p>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setEvaluation(null); setFollowUp(''); }}
          >
            Ask another question
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

/** Symptom-to-fault graph lookup (field reachback): query → node match trace + ranked chains + SOP passages. */
export function InOperationView() {
  const [queryText, setQueryText] = useState('');
  const [committedQuery, setCommittedQuery] = useState('');
  const [graphChains, setGraphChains] = useState<CausalChainResult[]>([]);
  const [nodeMatchTrace, setNodeMatchTrace] = useState<NodeMatchTrace[]>([]);
  const [denseMatches, setDenseMatches] = useState<DenseMatch[]>([]);
  const [hasDenseData, setHasDenseData] = useState(false);
  const [hybridResult, setHybridResult] = useState<HybridResult | null>(null);
  const [hasQueried, setHasQueried] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [queryRunId, setQueryRunId] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function doSearch(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSearching) return;
    setIsSearching(true);
    try {
      const result = await retrieveHybrid({ symptomText: trimmed, graphTopK: 3, denseTopK: 5 });
      setGraphChains(result.graphChains);
      setNodeMatchTrace(result.nodeMatchTrace);
      setDenseMatches(result.denseMatches);
      setHasDenseData(result.hasDenseData);
      setHybridResult(result);
      setCommittedQuery(trimmed);
      setQueryRunId((n) => n + 1);
      setHasQueried(true);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearch() {
    void doSearch(queryText);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  }

  function handleClear() {
    setQueryText('');
    setGraphChains([]);
    setNodeMatchTrace([]);
    setDenseMatches([]);
    setHasDenseData(false);
    setHybridResult(null);
    setHasQueried(false);
    setCommittedQuery('');
    inputRef.current?.focus();
  }

  return (
    <div className="in-op-view">
      <div className="in-op-header">
        <h2>Symptom-to-fault graph lookup</h2>
        <p className="in-op-subtitle">
          Describe what you are observing (KEWB, plume, deposition). The graph tier scores your text against
          symptom and fault nodes, then walks typed edges to ranked fault chains — all traceable to corpus nodes.
        </p>
        <div className="in-op-safety-note">
          ⚠️ Safety rules always apply. Results do not replace site-specific SOPs.
        </div>
      </div>

      <div className="in-op-search">
        <textarea
          ref={inputRef}
          className="in-op-input"
          rows={3}
          placeholder={emptyStateText()}
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Symptom description"
          disabled={isSearching}
        />
        <div className="in-op-search-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleSearch}
            disabled={isSearching || !queryText.trim()}
          >
            {isSearching ? 'Searching…' : 'Search Knowledge Graph'}
          </button>
          {hasQueried && !isSearching && (
            <button type="button" className="btn-secondary" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      {hasQueried && (
        <>
          <GraphResultsPanel
            chains={graphChains}
            queryText={committedQuery}
            nodeMatchTrace={nodeMatchTrace}
            resultKey={String(queryRunId)}
          />
          {hasDenseData && <DenseResultsPanel matches={denseMatches} />}
          {!hasDenseData && (
            <p className="in-op-dense-hint">
              Run <code>npm run ingest</code> to activate SOP / literature context from the dense corpus.
            </p>
          )}
          {hybridResult && (
            <MentorInterpretPanel hybridResult={hybridResult} queryText={committedQuery} />
          )}
        </>
      )}

      {!hasQueried && (
        <div className="in-op-examples">
          <p className="examples-label">Try an example:</p>
          <div className="examples-list">
            {[
              'pressure is elevated and line looks narrow',
              'no deposition, pressure spiked very high',
              'pressure is dropping and line quality getting blurry',
              'atomizer current is low and no plume',
            ].map((ex) => (
              <button
                key={ex}
                type="button"
                className="example-chip"
                onClick={() => { setQueryText(ex); void doSearch(ex); }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
