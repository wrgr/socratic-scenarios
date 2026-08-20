/**
 * RetrievalLabView.tsx
 *
 * Developer / demo inspection surface for both retrieval pathways.
 *
 * Tabs:
 *   1. Query Lab                — run both pathways side-by-side with per-pathway toggles
 *   2. Node Knowledge Explorer  — browse graph nodes by type in list or visual graph view
 *   3. Dense Browser            — list loaded corpus chunks with source/section filter
 *
 * This is the "CRUD / verify" surface — it lets you:
 *   READ  — browse the full graph and dense corpus
 *   VERIFY — run queries and see raw scored results from each pathway
 *   TOGGLE — enable/disable each pathway independently
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  type Node as RFNode,
  type Edge as RFEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { retrieveHybrid, formatHybridContext } from '../engine/retrieval/hybrid-retrieval';
import type { HybridResult } from '../engine/retrieval/hybrid-retrieval';
import { retrieveForContext } from '../engine/retrieval/retrieval-router';
import type { RetrievalMode } from '../engine/retrieval/retrieval-router';
import {
  allNodes,
  allEdges,
  nodesByType,
} from '../engine/retrieval/graph-utils';
import { getDenseBackend, loadChunkInventory } from '../engine/retrieval/dense-retrieval';
import type { AJPNode } from '../types/ajp';
import { SourceRefText } from './SourceRefText';
import { ExpertFlagButton, ExpertFlagBadge } from './ExpertFlagButton';
import { useExpertFlags, downloadFlagsJson } from '../hooks/useExpertFlags';

// ─── Types ────────────────────────────────────────────────────────

type LabTab = 'query' | 'graph' | 'dense';

const NODE_TYPES: AJPNode['type'][] = [
  'Step',
  'FailureMode',
  'Symptom',
  'CorrectiveAction',
  'SafetyHazard',
  'TacitKnowledge',
  'SocraticProbe',
  'Parameter',
  'Equipment',
  'VerificationCheck',
  'TheoryReference',
  'Consequence',
];

const ROUTER_MODES: { mode: RetrievalMode; label: string; needsText: boolean }[] = [
  { mode: 'fault-diagnosis', label: 'Fault Diagnosis', needsText: true },
  { mode: 'tacit-lookup', label: 'Tacit Lookup', needsText: true },
  { mode: 'step-context', label: 'Step Context', needsText: false },
  { mode: 'probe-context', label: 'Probe Context', needsText: false },
  { mode: 'safety-gate', label: 'Safety Gate', needsText: false },
];

// ─── Query Lab ────────────────────────────────────────────────────

function QueryLab() {
  const [queryText, setQueryText] = useState('');
  const [nodeIdInput, setNodeIdInput] = useState('');
  const [graphEnabled, setGraphEnabled] = useState(true);
  const [denseEnabled, setDenseEnabled] = useState(true);
  const [routerMode, setRouterMode] = useState<RetrievalMode>('fault-diagnosis');
  const [showRouterPanel, setShowRouterPanel] = useState(false);
  const [hybridResult, setHybridResult] = useState<HybridResult | null>(null);
  const [routerResult, setRouterResult] = useState<ReturnType<typeof retrieveForContext> | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [formattedContext, setFormattedContext] = useState<string | null>(null);

  const selectedMode = ROUTER_MODES.find((m) => m.mode === routerMode)!;

  async function runHybrid() {
    if (!queryText.trim()) return;
    setIsRunning(true);
    try {
      const result = await retrieveHybrid({
        symptomText: queryText.trim(),
        graphTopK: graphEnabled ? 3 : 0,
        denseTopK: denseEnabled ? 5 : 0,
      });
      setHybridResult(result);
      setFormattedContext(formatHybridContext(result));
    } finally {
      setIsRunning(false);
    }
  }

  function runRouter() {
    const query = selectedMode.needsText
      ? { mode: routerMode, text: queryText.trim() }
      : { mode: routerMode, nodeId: nodeIdInput.trim() };
    setRouterResult(retrieveForContext(query));
  }

  function handleClear() {
    setHybridResult(null);
    setRouterResult(null);
    setFormattedContext(null);
    setQueryText('');
    setNodeIdInput('');
  }

  // hasData() is false until the lazy corpus load resolves — warm it on
  // mount so the Dense-tier toggle doesn't read "run npm run ingest" while
  // a perfectly good corpus is still downloading.
  const [hasDenseBackend, setHasDenseBackend] = useState(getDenseBackend().hasData());
  useEffect(() => {
    let alive = true;
    void loadChunkInventory().then((inv) => { if (alive) setHasDenseBackend(inv.length > 0); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="retrieval-lab-query">
      {/* Controls */}
      <div className="lab-controls">
        <div className="lab-control-group">
          <label className="lab-label">Query text</label>
          <textarea
            className="in-op-input"
            rows={2}
            placeholder="e.g. pressure elevated and line looks narrow"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void runHybrid(); } }}
          />
        </div>

        <div className="lab-toggle-row">
          <label className="lab-toggle">
            <input
              type="checkbox"
              checked={graphEnabled}
              onChange={(e) => setGraphEnabled(e.target.checked)}
            />
            Graph tier
          </label>
          <label className={`lab-toggle ${!hasDenseBackend ? 'lab-toggle--disabled' : ''}`}>
            <input
              type="checkbox"
              checked={denseEnabled}
              onChange={(e) => setDenseEnabled(e.target.checked)}
              disabled={!hasDenseBackend}
            />
            Dense tier {!hasDenseBackend && '(no dense corpus loaded)'}
          </label>
        </div>

        <div className="lab-action-row">
          <button
            type="button"
            className="btn-primary"
            onClick={() => void runHybrid()}
            disabled={!queryText.trim() || isRunning}
          >
            {isRunning ? 'Running…' : 'Run Hybrid Retrieval'}
          </button>
          <button
            type="button"
            className={`btn-secondary ${showRouterPanel ? 'btn-active' : ''}`}
            onClick={() => setShowRouterPanel((e) => !e)}
          >
            Router strategies {showRouterPanel ? '▲' : '▼'}
          </button>
          {(hybridResult || routerResult) && (
            <button type="button" className="btn-ghost" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>

        {showRouterPanel && (
          <div className="router-panel">
            <div className="router-mode-selector">
              {ROUTER_MODES.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  className={`router-mode-chip ${routerMode === m.mode ? 'active' : ''}`}
                  onClick={() => setRouterMode(m.mode)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {!selectedMode.needsText && (
              <div className="lab-control-group">
                <label className="lab-label">Node ID (for {routerMode})</label>
                <input
                  type="text"
                  className="lab-node-input"
                  placeholder="e.g. STEP-STARTUP-001"
                  value={nodeIdInput}
                  onChange={(e) => setNodeIdInput(e.target.value)}
                />
              </div>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={runRouter}
              disabled={selectedMode.needsText ? !queryText.trim() : !nodeIdInput.trim()}
            >
              Run {selectedMode.label}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="lab-results-grid">
        {hybridResult && (
          <div className="lab-results-col">
            <h3 className="lab-results-title">
              Hybrid Result
              <span className="lab-results-meta">
                {hybridResult.graphChains.length} graph chain{hybridResult.graphChains.length !== 1 ? 's' : ''}
                {hybridResult.hasDenseData && ` · ${hybridResult.denseMatches.length} dense matches`}
              </span>
            </h3>

            {hybridResult.graphChains.length > 0 && (
              <div className="lab-result-section">
                <strong>Graph tier — causal chains:</strong>
                {hybridResult.graphChains.map((chain, i) => (
                  <div key={chain.fault.id} className="lab-chain-card">
                    <div className="lab-chain-rank">#{i + 1} score {chain.score.toFixed(2)}</div>
                    <div className="lab-chain-fault">
                      <span className="graph-node-ref">{chain.fault.id}</span>
                      <ExpertFlagButton id={chain.fault.id} label={chain.fault.type} />
                      <p>
                        <SourceRefText text={chain.fault.content} />
                      </p>
                    </div>
                    <div className="lab-chain-meta">
                      <span>{chain.symptoms.length} symptoms</span>
                      <span>{chain.correctiveActions.length} actions</span>
                      <span>{chain.safetyHazards.length} hazards</span>
                    </div>
                    {chain.reachbackNote && (
                      <p className="lab-reachback-note">
                        ⚠ <SourceRefText text={chain.reachbackNote} />
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {hybridResult.denseMatches.length > 0 && (
              <div className="lab-result-section">
                <strong>Dense tier — SOP passages:</strong>
                {hybridResult.denseMatches.map((m) => (
                  <div key={m.chunk.id} className="lab-dense-card">
                    <div className="lab-dense-header">
                      <span className="dense-match-source">{m.chunk.source}</span>
                      <span className="dense-match-section">— {m.chunk.section}</span>
                      <span className="dense-match-score">{Math.round(m.score * 100)}%</span>
                      <ExpertFlagButton id={m.chunk.id} label="chunk" />
                    </div>
                    <p className="lab-dense-text">{m.chunk.text.slice(0, 200)}{m.chunk.text.length > 200 ? '…' : ''}</p>
                    <span className="graph-node-ref">{m.chunk.id}</span>
                  </div>
                ))}
              </div>
            )}

            {hybridResult.nodeMatchTrace.length > 0 && (
              <div className="lab-result-section">
                <strong>
                  Graph match trace —{' '}
                  {hybridResult.nodeMatchTrace[0]?.matchMethod === 'embedding' ? 'embedding (cosine)' : 'Jaccard token overlap'}
                  {' '}scores before chain traversal
                  <span className="lab-results-meta">
                    {hybridResult.nodeMatchTrace.length} node{hybridResult.nodeMatchTrace.length !== 1 ? 's' : ''} matched
                  </span>
                </strong>
                <table className="lab-trace-table">
                  <thead>
                    <tr>
                      <th>Node ID</th>
                      <th>Type</th>
                      <th>Score</th>
                      <th>Content (truncated)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hybridResult.nodeMatchTrace.map((m) => (
                      <tr key={m.nodeId} className={`lab-trace-row lab-trace-row--${m.nodeType.toLowerCase()}`}>
                        <td className="graph-node-ref">
                          {m.nodeId} <ExpertFlagBadge id={m.nodeId} />
                        </td>
                        <td><span className="node-type-badge">{m.nodeType}</span></td>
                        <td>
                          <span className={`lab-trace-score ${m.score >= 0.5 ? 'lab-trace-score--high' : m.score >= 0.25 ? 'lab-trace-score--mid' : 'lab-trace-score--low'}`}>
                            {(m.score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="lab-trace-content">
                          <SourceRefText
                            text={
                              m.content.length > 120
                                ? `${m.content.slice(0, 120)}…`
                                : m.content
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="lab-trace-hint">
                  {hybridResult.nodeMatchTrace[0]?.matchMethod === 'embedding'
                    ? 'Embedding (cosine) matching active. Scores above ~0.6 are strong matches. Low scores mean the query concept is not well-represented in the graph.'
                    : 'Jaccard token-overlap matching (no embedding provider set). Scores below ~25% are usually noise — add a Gemini API key via the gear in the header to activate semantic matching.'}
                </p>
              </div>
            )}

            {formattedContext && (
              <div className="lab-result-section">
                <strong>LLM context string (what the Mentor sees):</strong>
                <pre className="lab-context-pre">{formattedContext}</pre>
              </div>
            )}
          </div>
        )}

        {routerResult && (
          <div className="lab-results-col">
            <h3 className="lab-results-title">
              Router: {routerResult.mode}
              <span className="lab-results-meta">
                {routerResult.anchorIds.length} anchor{routerResult.anchorIds.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="lab-result-section">
              <strong>Anchor IDs:</strong>
              <div className="lab-anchor-ids">
                {routerResult.anchorIds.length > 0
                  ? routerResult.anchorIds.map((id) => (
                    <span key={id} className="graph-node-ref">
                      {id} <ExpertFlagBadge id={id} />
                    </span>
                  ))
                  : <span className="lab-empty-note">No matches</span>
                }
              </div>
            </div>
            {Object.entries(routerResult.nodes).map(([key, nodes]) => (
              nodes.length > 0 && (
                <div key={key} className="lab-result-section">
                  <strong>{key} ({nodes.length}):</strong>
                  <ul className="lab-node-list">
                    {nodes.map((n) => (
                      <li key={n.id} className="lab-node-item">
                        <span className="graph-node-ref">{n.id}</span>
                        <ExpertFlagButton id={n.id} label={n.type} />
                        <p className="lab-node-content">{n.content.slice(0, 120)}{n.content.length > 120 ? '…' : ''}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))}
          </div>
        )}

        {!hybridResult && !routerResult && (
          <div className="lab-empty-state">
            <p>Run a query to see results from both retrieval pathways side by side.</p>
            <div className="lab-example-queries">
              <p className="lab-example-label">Example queries:</p>
              {['pressure elevated and line looks narrow', 'no deposition and pressure spiked', 'atomizer current low'].map((q) => (
                <button
                  key={q}
                  type="button"
                  className="example-chip"
                  onClick={() => { setQueryText(q); }}
                >
                  {q}
                </button>
              ))}
              <p className="lab-example-label">Example node IDs (for router):</p>
              {['STEP-STARTUP-001', 'PROBE-GAS-SEQUENCE-START-001', 'FAULT-CLOG-PARTIAL-001'].map((id) => (
                <button
                  key={id}
                  type="button"
                  className="example-chip"
                  onClick={() => { setNodeIdInput(id); setShowRouterPanel(true); }}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Node Knowledge Explorer ──────────────────────────────────────

type ExplorerView = 'list' | 'graph';

// Deterministic color per node type (used by the visual graph canvas).
const TYPE_COLORS: Record<AJPNode['type'], string> = {
  Step: '#2563eb',              // blue
  FailureMode: '#dc2626',       // red
  Symptom: '#ea580c',           // orange
  CorrectiveAction: '#059669',  // green
  SafetyHazard: '#b91c1c',      // dark red
  TacitKnowledge: '#7c3aed',    // purple
  SocraticProbe: '#0891b2',     // teal
  Parameter: '#475569',         // slate
  Equipment: '#6b7280',         // gray
  VerificationCheck: '#16a34a', // emerald
  TheoryReference: '#9333ea',   // violet
  Consequence: '#d97706',       // amber
};

/**
 * Visual graph canvas. Renders the focused neighborhood (selected node + 1-hop)
 * when a node is selected, otherwise lays out the filtered node set in
 * per-type columns so the reader can scan the graph by category.
 */
function GraphCanvas({
  filteredNodes,
  selectedNode,
  onSelectNode,
  neighborhoodHops,
}: {
  filteredNodes: AJPNode[];
  selectedNode: AJPNode | null;
  onSelectNode: (node: AJPNode | null) => void;
  neighborhoodHops: number;
}) {
  // Compute visible node set.
  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (selectedNode) {
      // Expand neighborhood N hops from selected node.
      const visited = new Set<string>([selectedNode.id]);
      let frontier = new Set<string>([selectedNode.id]);
      for (let hop = 0; hop < neighborhoodHops; hop++) {
        const next = new Set<string>();
        for (const e of allEdges) {
          if (frontier.has(e.from) && !visited.has(e.to)) next.add(e.to);
          if (frontier.has(e.to) && !visited.has(e.from)) next.add(e.from);
        }
        next.forEach((id) => visited.add(id));
        frontier = next;
        if (frontier.size === 0) break;
      }
      const nodes = allNodes.filter((n) => visited.has(n.id));
      const edges = allEdges.filter((e) => visited.has(e.from) && visited.has(e.to));
      return { visibleNodes: nodes, visibleEdges: edges };
    }
    // No selection: cap the render to a reasonable size.
    const capped = filteredNodes.slice(0, 80);
    const idSet = new Set(capped.map((n) => n.id));
    const edges = allEdges.filter((e) => idSet.has(e.from) && idSet.has(e.to));
    return { visibleNodes: capped, visibleEdges: edges };
  }, [filteredNodes, selectedNode, neighborhoodHops]);

  // Build layout. With a selection, place selected at center and neighbors
  // radially. Without, group by type into columns.
  const rfNodes: RFNode[] = useMemo(() => {
    if (selectedNode) {
      const others = visibleNodes.filter((n) => n.id !== selectedNode.id);
      const R = 260;
      const cx = 0;
      const cy = 0;
      return [
        {
          id: selectedNode.id,
          position: { x: cx, y: cy },
          data: { label: nodeLabel(selectedNode) },
          style: nodeStyle(selectedNode, true),
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        },
        ...others.map((n, i) => {
          const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
          return {
            id: n.id,
            position: { x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) },
            data: { label: nodeLabel(n) },
            style: nodeStyle(n, false),
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
          } satisfies RFNode;
        }),
      ];
    }
    // Columns per type.
    const byType = new Map<AJPNode['type'], AJPNode[]>();
    for (const n of visibleNodes) {
      const list = byType.get(n.type) ?? [];
      list.push(n);
      byType.set(n.type, list);
    }
    const types = Array.from(byType.keys());
    const colW = 220;
    const rowH = 60;
    const out: RFNode[] = [];
    types.forEach((t, ci) => {
      const col = byType.get(t)!;
      col.forEach((n, ri) => {
        out.push({
          id: n.id,
          position: { x: ci * colW, y: ri * rowH },
          data: { label: nodeLabel(n) },
          style: nodeStyle(n, false),
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        });
      });
    });
    return out;
  }, [visibleNodes, selectedNode]);

  const rfEdges: RFEdge[] = useMemo(
    () =>
      visibleEdges.map((e, i) => ({
        id: `${e.from}-${e.type}-${e.to}-${i}`,
        source: e.from,
        target: e.to,
        label: e.type,
        labelStyle: { fontSize: 10, fill: '#475569' },
        labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
        style: { stroke: '#94a3b8', strokeWidth: 1.2 },
      })),
    [visibleEdges],
  );

  const handleNodeClick = useCallback(
    (_: unknown, node: RFNode) => {
      const match = allNodes.find((n) => n.id === node.id) ?? null;
      onSelectNode(match);
    },
    [onSelectNode],
  );

  return (
    <div className="graph-canvas-wrapper">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => (n.style?.background as string) ?? '#94a3b8'}
          maskColor="rgba(241, 245, 249, 0.75)"
        />
      </ReactFlow>
    </div>
  );
}

function nodeLabel(n: AJPNode): string {
  const id = n.id.length > 28 ? `${n.id.slice(0, 26)}…` : n.id;
  return `${n.type}\n${id}`;
}

function nodeStyle(n: AJPNode, selected: boolean): React.CSSProperties {
  const bg = TYPE_COLORS[n.type] ?? '#64748b';
  return {
    background: bg,
    color: '#fff',
    border: selected ? '3px solid #facc15' : '1px solid rgba(0,0,0,0.25)',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 11,
    fontFamily: 'var(--mono, monospace)',
    whiteSpace: 'pre',
    width: 180,
    textAlign: 'center',
    boxShadow: selected ? '0 0 0 4px rgba(250, 204, 21, 0.3)' : undefined,
  };
}

function NodeKnowledgeExplorer() {
  const [filterType, setFilterType] = useState<AJPNode['type'] | 'All'>('All');
  const [filterText, setFilterText] = useState('');
  const [selectedNode, setSelectedNode] = useState<AJPNode | null>(null);
  const [view, setView] = useState<ExplorerView>('list');
  const [neighborhoodHops, setNeighborhoodHops] = useState(1);

  const filteredNodes = useMemo(() => {
    let nodes = filterType === 'All' ? allNodes : nodesByType(filterType);
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      nodes = nodes.filter((n) => n.id.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return nodes;
  }, [filterType, filterText]);

  const typeCounts = useMemo(() =>
    NODE_TYPES.map((t) => ({ type: t, count: nodesByType(t).length })),
    [],
  );

  const outEdges = useMemo(() =>
    selectedNode ? allEdges.filter((e) => e.from === selectedNode.id) : [],
    [selectedNode],
  );
  const inEdges = useMemo(() =>
    selectedNode ? allEdges.filter((e) => e.to === selectedNode.id) : [],
    [selectedNode],
  );

  return (
    <div className="graph-browser">
      <div className="graph-browser-sidebar">
        <div className="explorer-view-toggle">
          <button
            type="button"
            className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
          >
            List
          </button>
          <button
            type="button"
            className={`view-toggle-btn ${view === 'graph' ? 'active' : ''}`}
            onClick={() => setView('graph')}
          >
            Graph
          </button>
        </div>

        {view === 'graph' && (
          <div className="explorer-hops-control">
            <label className="lab-label">
              Neighborhood hops: <strong>{neighborhoodHops}</strong>
            </label>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={neighborhoodHops}
              onChange={(e) => setNeighborhoodHops(Number(e.target.value))}
            />
            <p className="lab-hops-hint">
              {selectedNode
                ? `Showing ${neighborhoodHops}-hop neighborhood of ${selectedNode.id}`
                : `Select a node to focus its neighborhood (showing up to 80 filtered nodes)`}
            </p>
          </div>
        )}

        <div className="graph-stats">
          <strong>Graph stats:</strong>
          <div className="graph-stat-row">
            <span>{allNodes.length} nodes</span>
            <span>{allEdges.length} edges</span>
          </div>
        </div>

        <div className="graph-type-filter">
          <button
            type="button"
            className={`type-filter-chip ${filterType === 'All' ? 'active' : ''}`}
            onClick={() => { setFilterType('All'); setSelectedNode(null); }}
          >
            All ({allNodes.length})
          </button>
          {typeCounts.map(({ type, count }) => (
            <button
              key={type}
              type="button"
              className={`type-filter-chip ${filterType === type ? 'active' : ''}`}
              onClick={() => { setFilterType(type); setSelectedNode(null); }}
            >
              {type} ({count})
            </button>
          ))}
        </div>

        <input
          type="text"
          className="lab-node-input"
          placeholder="Filter by ID or content…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />

        <div className="graph-node-list">
          {filteredNodes.slice(0, 100).map((n) => (
            <button
              key={n.id}
              type="button"
              className={`graph-node-list-item ${selectedNode?.id === n.id ? 'selected' : ''}`}
              onClick={() => setSelectedNode(n)}
            >
              <span className="node-type-badge">{n.type}</span>
              <span className="node-id-label">{n.id}</span>
              <ExpertFlagBadge id={n.id} />
            </button>
          ))}
          {filteredNodes.length > 100 && (
            <p className="lab-truncate-note">Showing 100 of {filteredNodes.length} — refine filter</p>
          )}
        </div>
      </div>

      {view === 'graph' ? (
        <div className="graph-node-detail graph-node-detail--canvas">
          <GraphCanvas
            filteredNodes={filteredNodes}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            neighborhoodHops={neighborhoodHops}
          />
          {selectedNode && (
            <div className="graph-canvas-selected-summary">
              <span className="node-type-badge node-type-badge--large">{selectedNode.type}</span>
              <span className="node-detail-id">{selectedNode.id}</span>
              <p className="node-detail-content">
                <SourceRefText text={selectedNode.content} />
              </p>
            </div>
          )}
        </div>
      ) : (
      <div className="graph-node-detail">
        {selectedNode ? (
          <>
            <div className="node-detail-header">
              <span className="node-type-badge node-type-badge--large">{selectedNode.type}</span>
              <h3 className="node-detail-id">{selectedNode.id}</h3>
              <ExpertFlagButton
                id={selectedNode.id}
                label={selectedNode.type}
                variant="full"
              />
            </div>

            <div className="node-detail-section">
              <strong>Content:</strong>
              <p className="node-detail-content">
                <SourceRefText text={selectedNode.content} />
              </p>
            </div>

            <div className="node-detail-meta">
              {selectedNode.confidence && (
                <span className="node-meta-chip">confidence: {selectedNode.confidence}</span>
              )}
              {selectedNode.source && (
                <span className="node-meta-chip">
                  source: <SourceRefText text={selectedNode.source} />
                </span>
              )}
              {selectedNode.masteryThreshold !== undefined && (
                <span className="node-meta-chip">mastery: {selectedNode.masteryThreshold}</span>
              )}
            </div>

            {selectedNode.safetyAlert && (
              <div className="node-safety-alert">
                ⚠️ <SourceRefText text={selectedNode.safetyAlert} />
              </div>
            )}

            <div className="node-detail-section">
              <strong>Outbound edges ({outEdges.length}):</strong>
              {outEdges.length > 0 ? (
                <ul className="edge-list">
                  {outEdges.map((e) => {
                    const target = allNodes.find((n) => n.id === e.to);
                    return (
                      <li key={`${e.from}-${e.type}-${e.to}`} className="edge-item">
                        <span className="edge-type-badge">─[{e.type}]→</span>
                        <button
                          type="button"
                          className="edge-node-btn"
                          onClick={() => setSelectedNode(target ?? null)}
                        >
                          {e.to}
                          {target && <span className="node-type-badge">{target.type}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="lab-empty-note">No outbound edges</p>
              )}
            </div>

            <div className="node-detail-section">
              <strong>Inbound edges ({inEdges.length}):</strong>
              {inEdges.length > 0 ? (
                <ul className="edge-list">
                  {inEdges.map((e) => {
                    const source = allNodes.find((n) => n.id === e.from);
                    return (
                      <li key={`${e.from}-${e.type}-${e.to}`} className="edge-item">
                        <button
                          type="button"
                          className="edge-node-btn"
                          onClick={() => setSelectedNode(source ?? null)}
                        >
                          {e.from}
                          {source && <span className="node-type-badge">{source.type}</span>}
                        </button>
                        <span className="edge-type-badge">─[{e.type}]→</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="lab-empty-note">No inbound edges</p>
              )}
            </div>
          </>
        ) : (
          <div className="node-detail-empty">
            <p>Select a node from the list to inspect its content and edges.</p>
            <div className="graph-overview-chips">
              {NODE_TYPES.map((t) => {
                const count = nodesByType(t).length;
                return count > 0 ? (
                  <button
                    key={t}
                    type="button"
                    className="type-filter-chip"
                    onClick={() => setFilterType(t)}
                  >
                    {t} ({count})
                  </button>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Dense Corpus Browser ─────────────────────────────────────────

interface DenseChunkPreview {
  id: string;
  source: string;
  section: string;
  text: string;
  linkedNodeId?: string;
}

function DenseBrowser() {
  const [chunks, setChunks] = useState<DenseChunkPreview[]>([]);
  const [filterText, setFilterText] = useState('');
  const [filterSource, setFilterSource] = useState<string>('All');
  // Start as loading — the mount effect kicks off the fetch unconditionally,
  // so showing a loader immediately is correct and avoids a cascading setState
  // inside the effect body.
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    fetch(`${import.meta.env.BASE_URL}ajp-corpus.json`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { chunks?: DenseChunkPreview[] } | null) => {
        if (data?.chunks) {
          setChunks(data.chunks.map(({ id, source, section, text, linkedNodeId }) => ({
            id, source, section, text: text.slice(0, 500), linkedNodeId,
          })));
        }
        setLoaded(true);
        setLoading(false);
      })
      .catch(() => { setLoaded(true); setLoading(false); });
  }, [loaded]);

  const sources = useMemo(() => ['All', ...new Set(chunks.map((c) => c.source))], [chunks]);

  const filtered = useMemo(() => {
    let result = filterSource === 'All' ? chunks : chunks.filter((c) => c.source === filterSource);
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      result = result.filter((c) =>
        c.id.toLowerCase().includes(q) ||
        c.text.toLowerCase().includes(q) ||
        c.section.toLowerCase().includes(q),
      );
    }
    return result;
  }, [chunks, filterSource, filterText]);

  if (loading) return <div className="lab-loading">Loading dense corpus…</div>;

  if (!loaded || chunks.length === 0) {
    return (
      <div className="lab-empty-state">
        <p>No dense corpus loaded.</p>
        <p>
          Run <code>npm run ingest</code> to generate <code>public/ajp-corpus.json</code>,
          then reload the app.
        </p>
        <p className="lab-dense-sources-note">
          Sources configured in <code>scripts/ingest-corpus.ts</code> and catalogued in{' '}
          <code>sources/SOURCES_LOG.md</code>
        </p>
      </div>
    );
  }

  return (
    <div className="dense-browser">
      <div className="dense-browser-controls">
        <div className="dense-stats">
          <strong>{chunks.length} chunks loaded</strong>
          <span>from {sources.length - 1} source{sources.length - 2 !== 1 ? 's' : ''}</span>
        </div>
        <div className="dense-filter-row">
          <select
            className="dense-source-filter"
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
          >
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="text"
            className="lab-node-input"
            placeholder="Filter by text, ID, or section…"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
        </div>
        <p className="lab-results-meta">
          Showing {Math.min(filtered.length, 50)} of {filtered.length} chunk{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="dense-chunk-list">
        {filtered.slice(0, 50).map((c) => (
          <div key={c.id} className="dense-chunk-card">
            <div className="dense-chunk-header">
              <span className="dense-match-source">{c.source}</span>
              <span className="dense-match-section">— {c.section}</span>
              {c.linkedNodeId && (
                <span className="graph-node-ref">linked: {c.linkedNodeId}</span>
              )}
              <ExpertFlagButton id={c.id} label="chunk" />
            </div>
            <p className="dense-chunk-text">{c.text}{c.text.length >= 500 ? '…' : ''}</p>
            <span className="graph-node-ref">{c.id}</span>
          </div>
        ))}
        {filtered.length > 50 && (
          <p className="lab-truncate-note">Showing 50 of {filtered.length} — use filter to narrow</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

/** Retrieval Lab — inspect, query, and verify both retrieval pathways. */
export function RetrievalLabView() {
  const [tab, setTab] = useState<LabTab>('query');
  const { flags, buildExport, clearAll } = useExpertFlags();
  const flagEntries = Object.values(flags);
  const gapCount = flagEntries.filter((f) => f.kind === 'learner-gap').length;
  const expertCount = flagEntries.length - gapCount;
  const flagCount = flagEntries.length;

  return (
    <div className="retrieval-lab-view">
      <div className="retrieval-lab-header">
        <div className="retrieval-lab-header-row">
          <h2>Retrieval Lab</h2>
          <div className="retrieval-lab-flag-actions">
            <span className="expert-flag-count" title="Items flagged by experts in this session">
              Expert: <strong>{expertCount}</strong>
            </span>
            <span className="expert-flag-count" title="Knowledge gaps logged by learners this session">
              Gaps: <strong>{gapCount}</strong>
            </span>
            <button
              type="button"
              className="expert-flag-export-btn"
              disabled={flagCount === 0}
              onClick={() => downloadFlagsJson(buildExport())}
              title="Download all flags (expert + learner gaps) as JSON"
            >
              Export flags
            </button>
            <button
              type="button"
              className="expert-flag-clear-btn"
              disabled={flagCount === 0}
              onClick={() => {
                if (window.confirm(`Clear all ${flagCount} flag${flagCount !== 1 ? 's' : ''} (expert + learner gaps)?`)) {
                  clearAll();
                }
              }}
              title="Clear all flags (cannot be undone)"
            >
              Clear
            </button>
          </div>
        </div>
        <p className="retrieval-lab-subtitle">
          Inspect, query, and verify both retrieval pathways.
          Graph tier uses in-memory causal graph traversal (always available).
          Dense tier uses pre-computed embeddings from ingested SOP corpus (requires{' '}
          <code>npm run ingest</code>).
        </p>
      </div>

      <div className="retrieval-lab-tabs">
        <button
          type="button"
          className={`nav-tab ${tab === 'query' ? 'active' : ''}`}
          onClick={() => setTab('query')}
        >
          Query Lab
        </button>
        <button
          type="button"
          className={`nav-tab ${tab === 'graph' ? 'active' : ''}`}
          onClick={() => setTab('graph')}
        >
          Node Knowledge Explorer
          <span className="tab-count">{allNodes.length}</span>
        </button>
        <button
          type="button"
          className={`nav-tab ${tab === 'dense' ? 'active' : ''}`}
          onClick={() => setTab('dense')}
        >
          Dense Corpus
          {getDenseBackend().hasData() && <span className="tab-count tab-count--active">●</span>}
        </button>
      </div>

      <div className="retrieval-lab-content">
        {tab === 'query' && <QueryLab />}
        {tab === 'graph' && <NodeKnowledgeExplorer />}
        {tab === 'dense' && <DenseBrowser />}
      </div>
    </div>
  );
}
