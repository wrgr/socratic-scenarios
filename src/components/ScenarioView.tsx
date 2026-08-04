/**
 * Scenario Mode UI — rewired to use ScenarioEngine + scripted ScenarioDefinitions.
 * Design doc §4.3 full section.
 *
 * Flow:
 *   1. Selector grid — learner picks one of 6 scripted scenarios
 *   2. Narrator + Mentor loop driven by useScenarioEngine state
 *   3. Fault injection: Narrator announces, student must resolve before advancing
 *   4. Missed safety gate: Consequence node content shown with severity warning
 *   5. ProcedureScaffold sidebar shows phase / step / gates throughout
 *
 * Backward compat: getMentorService() === null → static probe text, no reflection panel.
 */
import { useState, useRef, useMemo, useEffect } from 'react';
import type { LearnerProfile } from '../types';
import type { MentorEvaluation } from '../engine/mentor';
import { getMentorService } from '../engine/mentor';
import { getSimulatedLearnerService } from '../engine/simulated-learner';
import type { SimulatedExpertiseLevel } from '../engine/simulated-learner';
import { useScenarioEngine } from '../engine/scenario/engine';
import type { ScenarioDefinition } from '../engine/scenario/types';
import { useDomain } from '../domain/useDomain';
import { findProbe, findConsequence, findNode } from '../corpus/registry';
import { ProcedureScaffold } from './ProcedureScaffold';
import { MentorDegradedBanner } from './MentorDegradedBanner';
import { SourceRefText } from './SourceRefText';
import { GapFlagButton } from './GapFlagButton';
import { safetyGateStrategy, probeContextStrategy, tacitLookupStrategy, formatProbeRetrievalContext } from '../engine/retrieval/retrieval-router';
import type { AJPNode } from '../types/ajp';

interface Props {
  profile: LearnerProfile;
  onAdvancePhase: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────

function difficultyBadgeClass(d: ScenarioDefinition['difficulty']): string {
  return d === 'beginner' ? 'badge--easy' : d === 'intermediate' ? 'badge--medium' : 'badge--hard';
}

function difficultyLabel(d: ScenarioDefinition['difficulty']): string {
  return d === 'beginner' ? 'Beginner' : d === 'intermediate' ? 'Intermediate' : 'Advanced';
}

// Node lookups resolve across every registered domain (node ids are globally
// unique), so a scenario step's referenced probe / consequence node is found
// regardless of which domain owns it.
function getConsequenceById(id: string) {
  return findConsequence(id);
}

function getProbeById(id: string) {
  return findProbe(id);
}

// ─── Scenario Selector ────────────────────────────────────────────

function ScenarioSelectorGrid({
  scenarios,
  subtitle,
  onSelect,
}: {
  scenarios: ScenarioDefinition[];
  subtitle: string;
  onSelect: (def: ScenarioDefinition) => void;
}) {
  return (
    <div className="scenario-selector">
      <h2>Select a Scenario</h2>
      <p className="scenario-selector-subtitle">{subtitle}</p>
      <div className="scenario-grid">
        {scenarios.map((def) => (
          <button
            key={def.id}
            type="button"
            className="scenario-tile"
            onClick={() => onSelect(def)}
          >
            <div className="scenario-tile-header">
              <span className="scenario-tile-label">{def.label}</span>
              <span className={`scenario-difficulty-badge ${difficultyBadgeClass(def.difficulty)}`}>
                {difficultyLabel(def.difficulty)}
              </span>
            </div>
            <p className="scenario-tile-desc">{def.description}</p>
            <div className="scenario-tile-meta">
              <span>{def.steps.length} steps</span>
              {def.faultInjections.length > 0 && (
                <span>⚡ {def.faultInjections.length} fault injection{def.faultInjections.length > 1 ? 's' : ''}</span>
              )}
              {def.steps.some((s) => s.safetyGateNodeId) && (
                <span>⚠ safety gates</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Graph-backed safety gate panel ──────────────────────────────
// Uses safetyGateStrategy from the retrieval router to surface actual
// hazard node content (PPE requirements, hazard descriptions) from the
// knowledge graph rather than a generic acknowledgement message.

function GraphSafetyGatePanel({
  safetyGateId,
  onAcknowledge,
}: {
  safetyGateId: string;
  onAcknowledge: () => void;
}) {
  const gateResult = useMemo(() => safetyGateStrategy(safetyGateId), [safetyGateId]);
  // AJP gates resolve via the engine's baked graph; for other domains the gate
  // node lives only in the domain corpus — fall back to a registry lookup.
  const fallbackNode = useMemo(
    () => (gateResult?.sourceNode ? undefined : findNode(safetyGateId)),
    [gateResult, safetyGateId],
  );
  const [expanded, setExpanded] = useState(true);

  const hazards = gateResult?.hazards ?? [];
  const sourceContent = gateResult?.sourceNode?.content ?? fallbackNode?.content;

  return (
    <div className="safety-gate-banner graph-safety-gate" role="alert">
      <div className="safety-gate-header">
        <strong>⚠ Safety Requirement</strong>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {expanded && (
        <div className="safety-gate-graph-details">
          {fallbackNode?.safetyAlert && (
            <p className="hazard-alert">
              ⚠️ <SourceRefText text={fallbackNode.safetyAlert} />
            </p>
          )}
          {sourceContent && (
            <div className="safety-gate-source">
              <span className="graph-node-ref">{safetyGateId}</span>
              <p className="safety-gate-source-text">
                <SourceRefText text={sourceContent} />
              </p>
            </div>
          )}
          {hazards.length > 0 && (
            <div className="safety-gate-hazards">
              <strong>Required precautions:</strong>
              <ul className="safety-gate-hazard-list">
                {hazards.map((h: AJPNode) => (
                  <li key={h.id} className="safety-gate-hazard-item">
                    {h.safetyAlert && (
                      <p className="hazard-alert">
                        ⚠️ <SourceRefText text={h.safetyAlert} />
                      </p>
                    )}
                    <p className="hazard-content">
                      <SourceRefText text={h.content} />
                    </p>
                    <span className="graph-node-ref">
                      {h.id} · <SourceRefText text={h.source ?? ''} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hazards.length === 0 && (
            <p className="safety-gate-no-hazards">
              Review the safety requirements above before continuing.
            </p>
          )}
        </div>
      )}

      <button type="button" className="btn-danger" onClick={onAcknowledge}>
        I understand — acknowledge safety requirement
      </button>
    </div>
  );
}

// ─── Graph context strip for mentor probes ────────────────────────
// Uses probeContextStrategy and tacitLookupStrategy to surface related
// tacit knowledge nodes when a mentor probe is being answered.

function GraphProbeContextStrip({ probeId }: { probeId: string }) {
  const [expanded, setExpanded] = useState(false);

  const probeCtx = useMemo(() => probeContextStrategy(probeId), [probeId]);
  const tacitResult = useMemo(() => {
    const probe = findProbe(probeId);
    return probe ? tacitLookupStrategy(probe.content, 2) : null;
  }, [probeId]);

  const hasTacit = (tacitResult?.matches.length ?? 0) > 0;
  const hasLinkedProbes = (probeCtx?.probes.length ?? 0) > 0;

  if (!hasTacit && !hasLinkedProbes) return null;

  return (
    <div className="graph-probe-context-strip">
      <button
        type="button"
        className="graph-context-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        📚 Background knowledge ({tacitResult?.matches.length ?? 0} concept{(tacitResult?.matches.length ?? 0) !== 1 ? 's' : ''}
        {hasLinkedProbes ? ` · ${probeCtx!.probes.length} related question${probeCtx!.probes.length !== 1 ? 's' : ''}` : ''})
        {expanded ? ' ▲' : ' ▼'}
      </button>

      {expanded && (
        <div className="graph-context-body">
          {hasTacit && (
            <div className="tacit-section">
              <strong>Why this matters:</strong>
              {tacitResult!.matches.map(({ node }) => (
                <div key={node.id} className="tacit-item">
                  <p className="tacit-content">
                    <SourceRefText text={node.content} />
                  </p>
                  <span className="graph-node-ref">
                    {node.id} · <SourceRefText text={node.source ?? ''} />
                  </span>
                </div>
              ))}
            </div>
          )}
          {hasLinkedProbes && (
            <div className="related-probes-section">
              <strong>Related questions:</strong>
              <ul className="related-probe-list">
                {probeCtx!.probes.map((p) => (
                  <li key={p.id} className="related-probe-item">
                    <span className="graph-node-ref">{p.id}</span>
                    <p>
                      <SourceRefText text={p.content} />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Narrator panel ───────────────────────────────────────────────

function NarratorPanel({
  narratorText,
  isFaultStep,
  safetyGateId,
  safetyGateAcknowledged,
  onAcknowledge,
  stepId,
}: {
  narratorText: string;
  isFaultStep: boolean;
  safetyGateId: string | null;
  safetyGateAcknowledged: boolean;
  onAcknowledge: () => void;
  stepId?: string;
}) {
  const hasFault = isFaultStep || narratorText.includes('⚠ ANOMALY');
  return (
    <div className={`narrator-panel ${hasFault ? 'narrator-panel--fault' : ''}`}>
      <div className="narrator-label">
        <span className="narrator-label-text">
          {hasFault ? '🔴 NARRATOR — ANOMALY DETECTED' : '⬜ NARRATOR — MACHINE STATE'}
        </span>
        {stepId && <GapFlagButton targetId={stepId} label="step" />}
      </div>
      <pre className="narrator-text">{narratorText}</pre>
      {safetyGateId && !safetyGateAcknowledged && (
        <GraphSafetyGatePanel safetyGateId={safetyGateId} onAcknowledge={onAcknowledge} />
      )}
    </div>
  );
}

// ─── Consequence display ──────────────────────────────────────────

function ConsequencePanel({
  consequenceId,
  onContinue,
}: {
  consequenceId: string;
  onContinue: () => void;
}) {
  const node = getConsequenceById(consequenceId);
  if (!node) return null;

  const severityClass =
    node.severity === 'human' ? 'consequence--human' :
    node.severity === 'machine' ? 'consequence--machine' : 'consequence--part';

  return (
    <div className={`consequence-panel ${severityClass}`} role="alert">
      <div className="consequence-label">
        ⛔ CONSEQUENCE — {node.severity === 'human' ? 'HUMAN SAFETY' : node.severity === 'machine' ? 'EQUIPMENT DAMAGE' : 'PART LOSS'}
        {!node.reversible && ' — IRREVERSIBLE'}
      </div>
      <p className="consequence-content">
        <SourceRefText text={node.content} />
      </p>
      <div className="consequence-immediate">
        <strong>Immediate action required:</strong>{' '}
        <SourceRefText text={node.immediateAction} />
      </div>
      {node.safetyAlert && (
        <div className="consequence-safety">⚠ {node.safetyAlert}</div>
      )}
      <button type="button" className="btn-danger" onClick={onContinue}>
        Acknowledged — continue scenario
      </button>
    </div>
  );
}

// ─── Mentor reflection panel ──────────────────────────────────────

export interface ProbeAttemptRecord {
  evaluation: MentorEvaluation;
  learnerResponse: string;
  wasSimulated: boolean;
  attempts: number;
}

function MentorReflectionPanel({
  probeId,
  onSatisfied,
  expertiseLevel,
  readOnly,
  initialRecord,
  onAttemptRecorded,
}: {
  probeId: string;
  onSatisfied: () => void;
  expertiseLevel: SimulatedExpertiseLevel;
  readOnly?: boolean;
  initialRecord?: ProbeAttemptRecord;
  onAttemptRecorded?: (record: ProbeAttemptRecord) => void;
}) {
  const mentorService = getMentorService();
  const learnerService = getSimulatedLearnerService();
  const probe = getProbeById(probeId);
  const probeText = probe?.mentorProbe ?? probe?.content ?? probeId;
  const expectedConcepts = probe?.expectedConcepts ?? [];
  const commonWrongAnswers = probe?.commonWrongAnswers ?? [];
  const masteryThreshold = probe?.masteryThreshold ?? 0.80;
  const isSafetyCritical = masteryThreshold >= 0.90;

  const [response, setResponse] = useState(initialRecord && !initialRecord.wasSimulated ? initialRecord.learnerResponse : '');
  const [evaluation, setEvaluation] = useState<MentorEvaluation | null>(initialRecord?.evaluation ?? null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(initialRecord?.attempts ?? 0);
  const [simulatedResponse, setSimulatedResponse] = useState<string | null>(
    initialRecord?.wasSimulated ? initialRecord.learnerResponse : null,
  );
  const [simLoading, setSimLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit() {
    if (!response.trim() || !mentorService) return;
    setLoading(true);
    try {
      const probeCtx = probe ? probeContextStrategy(probe.id) : null;
      const tacitResult = tacitLookupStrategy(probeText, 4);
      const retrievalContext = formatProbeRetrievalContext(probeCtx, tacitResult) || undefined;

      const typed = response.trim();
      const result = await mentorService.evaluate({
        probeQuestion: probeText,
        expectedConcepts,
        commonWrongAnswers,
        learnerResponse: typed,
        priorAttempts: attempts,
        safetyGate: isSafetyCritical,
        retrievalContext,
      });
      setEvaluation(result);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      onAttemptRecorded?.({
        evaluation: result,
        learnerResponse: typed,
        wasSimulated: false,
        attempts: nextAttempts,
      });
    } finally {
      setLoading(false);
    }
  }

  async function simulateAndEvaluate() {
    if (!learnerService || !mentorService) return;
    setSimLoading(true);
    try {
      const generatedText = await learnerService.generateResponse({
        probeQuestion: probeText,
        expectedConcepts,
        expertiseLevel,
        priorAttempts: attempts,
      });
      setSimulatedResponse(generatedText);

      const probeCtx = probe ? probeContextStrategy(probe.id) : null;
      const tacitResult = tacitLookupStrategy(probeText, 4);
      const retrievalContext = formatProbeRetrievalContext(probeCtx, tacitResult) || undefined;

      const result = await mentorService.evaluate({
        probeQuestion: probeText,
        expectedConcepts,
        commonWrongAnswers,
        learnerResponse: generatedText,
        priorAttempts: attempts,
        safetyGate: isSafetyCritical,
        retrievalContext,
      });
      setEvaluation(result);
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      onAttemptRecorded?.({
        evaluation: result,
        learnerResponse: generatedText,
        wasSimulated: true,
        attempts: nextAttempts,
      });
    } finally {
      setSimLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const passedMastery = evaluation?.masteryPassed === true;

  // Auto-satisfy the probe when mastery passes, so the learner only clicks once (the Next button)
  // to proceed. Keeps pacing explicit — Next sits in the footer, not on the eval card itself.
  useEffect(() => {
    if (passedMastery && !readOnly) onSatisfied();
  }, [passedMastery, readOnly, onSatisfied]);

  return (
    <div className={`mentor-panel ${isSafetyCritical ? 'mentor-panel--safety' : ''}`}>
      <div className="mentor-label">
        <span className="mentor-label-text">
          🧑‍🏫 MENTOR{isSafetyCritical ? ' — SAFETY-CRITICAL PROBE' : ''}
        </span>
        <GapFlagButton targetId={probeId} label="probe" />
      </div>
      <p className="mentor-probe">{probeText}</p>
      <GraphProbeContextStrip probeId={probeId} />

      {!evaluation && !simulatedResponse && (
        <div className="mentor-reflection">
          <textarea
            ref={textareaRef}
            className="mentor-textarea"
            rows={3}
            placeholder="Type your response… (Ctrl+Enter to submit)"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={readOnly || loading || simLoading}
            aria-label="Mentor reflection response"
          />
          <div className="mentor-reflection-actions">
            {mentorService && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void handleSubmit()}
                disabled={readOnly || !response.trim() || loading || simLoading}
              >
                {loading ? 'Evaluating…' : 'Submit Reflection'}
              </button>
            )}
            {learnerService && mentorService && (
              <button
                type="button"
                className="btn-secondary sim-inline-btn"
                onClick={() => void simulateAndEvaluate()}
                disabled={readOnly || loading || simLoading}
              >
                {simLoading
                  ? <><span className="sim-spinner sim-spinner--inline" /> Generating…</>
                  : '🤖 Simulate'}
              </button>
            )}
            {!readOnly && (
              <button type="button" className="btn-secondary" onClick={onSatisfied}>
                {mentorService ? 'Skip' : 'Continue to Actions →'}
              </button>
            )}
          </div>
        </div>
      )}

      {simulatedResponse && !evaluation && (
        <div className="sim-learner-bubble">
          <span className="sim-bubble-label">🎓 LEARNER (simulated)</span>
          <p className="sim-bubble-text">{simulatedResponse}</p>
          <div className="sim-thinking">
            <span className="sim-spinner sim-spinner--inline" />
            <span>Mentor is evaluating…</span>
          </div>
        </div>
      )}

      {simulatedResponse && evaluation && (
        <div className="sim-learner-bubble sim-learner-bubble--with-eval">
          <span className="sim-bubble-label">🎓 LEARNER (simulated)</span>
          <p className="sim-bubble-text">{simulatedResponse}</p>
        </div>
      )}

      {evaluation && (
        <div className={`mentor-evaluation ${evaluation.masteryPassed ? 'eval--pass' : 'eval--partial'}`}>
          {evaluation.degraded ? (
            <MentorDegradedBanner feedback={evaluation.feedback} />
          ) : (
            <>
              <div className="eval-score-bar">
                <div
                  className="eval-score-fill"
                  style={{ width: `${Math.round(evaluation.score * 100)}%` }}
                />
              </div>
              <p className="eval-feedback">{evaluation.feedback}</p>
            </>
          )}
          {!evaluation.masteryPassed && (
            <p className="eval-followup"><em>{evaluation.followUpProbe}</em></p>
          )}
          {passedMastery ? (
            <p className="eval-mastery-hint">
              ✓ Mastery reached. Use <strong>Next →</strong> below when you're ready to advance,
              or <strong>← Previous</strong> to revisit prior steps.
            </p>
          ) : !readOnly ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => { setEvaluation(null); setResponse(''); setSimulatedResponse(null); }}
            >
              Try again
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Active fault resolution panel ───────────────────────────────

function ActiveFaultPanel({
  faultId,
  onResolved,
}: {
  faultId: string;
  onResolved: (faultId: string) => void;
}) {
  return (
    <div className="active-fault-panel" role="status">
      <div className="fault-panel-label">⚡ ACTIVE FAULT — must resolve before advancing</div>
      <p className="fault-panel-id">{faultId}</p>
      <p className="fault-panel-hint">
        Diagnose and address this fault using the corpus knowledge. When resolved, mark it below.
      </p>
      <button type="button" className="btn-warning" onClick={() => onResolved(faultId)}>
        Mark as resolved
      </button>
    </div>
  );
}

// ─── Assessment Summary ──────────────────────────────────────────

/** Detect which expected concepts the learner's response plausibly addressed.
 *  Pure token-overlap heuristic — no LLM. Two signals per concept:
 *   - exact:    at least one distinctive ≥5-char token appears verbatim (case-insensitive)
 *   - partial:  any ≥4-char token overlaps
 *  A concept is "hit" on exact match, "partial" on partial-only, else "missed". */
function analyzeExpectedConcepts(
  learnerResponse: string,
  expectedConcepts: string[],
): { concept: string; status: 'hit' | 'partial' | 'missed' }[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'must', 'are', 'was', 'were',
    'have', 'has', 'been', 'will', 'would', 'should', 'could', 'about', 'when', 'what', 'why',
    'because', 'before', 'after', 'during', 'then', 'than', 'them', 'they', 'their',
  ]);
  const responseLower = learnerResponse.toLowerCase();
  return expectedConcepts.map((concept) => {
    const tokens = concept.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !stop.has(t));
    if (tokens.length === 0) return { concept, status: 'partial' as const };
    const distinctive = tokens.filter((t) => t.length >= 5);
    const exactHits = distinctive.filter((t) => responseLower.includes(t)).length;
    const anyHits = tokens.filter((t) => responseLower.includes(t)).length;
    const exactRatio = distinctive.length > 0 ? exactHits / distinctive.length : 0;
    const partialRatio = anyHits / tokens.length;
    if (exactRatio >= 0.5 || partialRatio >= 0.6) return { concept, status: 'hit' as const };
    if (partialRatio >= 0.3) return { concept, status: 'partial' as const };
    return { concept, status: 'missed' as const };
  });
}

function detectCommonWrongAnswers(learnerResponse: string, wrongAnswers: string[]): string[] {
  const responseLower = learnerResponse.toLowerCase();
  return wrongAnswers.filter((wrong) => {
    const tokens = wrong.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 5);
    if (tokens.length === 0) return false;
    const hits = tokens.filter((t) => responseLower.includes(t)).length;
    return hits / tokens.length >= 0.6;
  });
}

function ProbeAssessmentCard({
  stepId,
  probeId,
  record,
}: {
  stepId: string;
  probeId: string;
  record: ProbeAttemptRecord;
}) {
  const [expanded, setExpanded] = useState(false);
  const probe = getProbeById(probeId);
  const probeText = probe?.mentorProbe ?? probe?.content ?? probeId;
  const masteryThreshold = probe?.masteryThreshold ?? 0.80;

  const { evaluation, learnerResponse, wasSimulated, attempts } = record;
  const scorePct = Math.round(evaluation.score * 100);
  const thresholdPct = Math.round(masteryThreshold * 100);

  const conceptAnalysis = useMemo(
    () => analyzeExpectedConcepts(learnerResponse, probe?.expectedConcepts ?? []),
    [learnerResponse, probe],
  );
  const detectedWrongs = useMemo(
    () => detectCommonWrongAnswers(learnerResponse, probe?.commonWrongAnswers ?? []),
    [learnerResponse, probe],
  );

  const hitCount = conceptAnalysis.filter((c) => c.status === 'hit').length;
  const partialCount = conceptAnalysis.filter((c) => c.status === 'partial').length;
  const missedCount = conceptAnalysis.filter((c) => c.status === 'missed').length;

  return (
    <div className={`probe-assessment-card ${evaluation.masteryPassed ? 'probe-assessment--pass' : 'probe-assessment--partial'}`}>
      <button
        type="button"
        className="probe-assessment-header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="probe-assessment-header-main">
          <span className="probe-assessment-step">Step {stepId}</span>
          <span className="probe-assessment-probe-text">{probeText}</span>
        </div>
        <div className="probe-assessment-header-meta">
          <span className={`probe-assessment-status ${evaluation.masteryPassed ? 'status--pass' : 'status--partial'}`}>
            {evaluation.masteryPassed ? '✓ Mastery' : '◐ Partial'}
          </span>
          <span className="probe-assessment-score">{scorePct}% <span className="probe-assessment-threshold">/ {thresholdPct}%</span></span>
          <span className="probe-assessment-caret">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="probe-assessment-body">
          {evaluation.degraded ? (
            <MentorDegradedBanner feedback={evaluation.feedback} />
          ) : (
            <>
              <div className="probe-assessment-score-bar">
                <div
                  className="probe-assessment-score-fill"
                  style={{ width: `${scorePct}%` }}
                />
                <div
                  className="probe-assessment-score-threshold"
                  style={{ left: `${thresholdPct}%` }}
                  aria-label={`Mastery threshold ${thresholdPct}%`}
                />
              </div>

              <div className="probe-assessment-section">
                <strong>Mentor feedback</strong>
                <p>{evaluation.feedback}</p>
                {!evaluation.masteryPassed && evaluation.followUpProbe && (
                  <p className="probe-assessment-followup"><em>Follow-up: {evaluation.followUpProbe}</em></p>
                )}
              </div>
            </>
          )}

          <div className="probe-assessment-section">
            <strong>
              Concept coverage — {hitCount} hit{hitCount !== 1 ? 's' : ''},
              {' '}{partialCount} partial, {missedCount} missed
            </strong>
            <ul className="probe-assessment-concept-list">
              {conceptAnalysis.map(({ concept, status }, idx) => (
                <li key={idx} className={`probe-concept probe-concept--${status}`}>
                  <span className="probe-concept-marker">
                    {status === 'hit' ? '✓' : status === 'partial' ? '◐' : '✗'}
                  </span>
                  <span className="probe-concept-text">{concept}</span>
                </li>
              ))}
            </ul>
          </div>

          {detectedWrongs.length > 0 && (
            <div className="probe-assessment-section probe-assessment-section--warn">
              <strong>⚠ Misconceptions detected</strong>
              <ul className="probe-assessment-wrong-list">
                {detectedWrongs.map((w, idx) => <li key={idx}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="probe-assessment-section">
            <strong>Learner response{wasSimulated ? ' (simulated)' : ''}</strong>
            <blockquote className="probe-assessment-response">{learnerResponse}</blockquote>
            <p className="probe-assessment-meta">
              Attempts: {attempts} · Threshold: {thresholdPct}%
              {probe?.safetyAlert && <span className="probe-assessment-safety"> · ⚠ Safety-critical</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentSummaryPanel({
  definition,
  triggeredConsequences,
  resolvedFaults,
  probeRecords,
  onFinish,
  onSelectAnother,
}: {
  definition: ScenarioDefinition;
  triggeredConsequences: string[];
  resolvedFaults: string[];
  probeRecords: Record<string, ProbeAttemptRecord>;
  onFinish: () => void;
  onSelectAnother: () => void;
}) {
  const safetyClean = triggeredConsequences.length === 0;
  const probeEntries = definition.steps
    .filter((s) => s.mentorProbeId && probeRecords[s.id])
    .map((s) => ({ step: s, record: probeRecords[s.id] }));

  const attempted = probeEntries.length;
  const mastered = probeEntries.filter(({ record }) => record.evaluation.masteryPassed).length;
  const avgScore = attempted > 0
    ? probeEntries.reduce((sum, { record }) => sum + record.evaluation.score, 0) / attempted
    : 0;
  const overallPct = Math.round(avgScore * 100);

  return (
    <div className="scenario-completion assessment-summary">
      <h2>Scenario Assessment</h2>
      <p className="scenario-completion-label">{definition.label}</p>

      <div className="assessment-overview">
        <div className="assessment-metric">
          <span className="assessment-metric-value">{mastered}/{attempted}</span>
          <span className="assessment-metric-label">Probes mastered</span>
        </div>
        <div className="assessment-metric">
          <span className="assessment-metric-value">{overallPct}%</span>
          <span className="assessment-metric-label">Average score</span>
        </div>
        <div className="assessment-metric">
          <span className="assessment-metric-value">{resolvedFaults.length}</span>
          <span className="assessment-metric-label">Faults resolved</span>
        </div>
        <div className="assessment-metric">
          <span className={`assessment-metric-value ${safetyClean ? 'metric--clean' : 'metric--warn'}`}>
            {triggeredConsequences.length}
          </span>
          <span className="assessment-metric-label">Consequences triggered</span>
        </div>
      </div>

      <div className={`completion-safety ${safetyClean ? 'safety--clean' : 'safety--violations'}`}>
        {safetyClean ? (
          <p>✓ No safety violations or missed consequences</p>
        ) : (
          <p>
            ⚠ {triggeredConsequences.length} consequence{triggeredConsequences.length > 1 ? 's' : ''} triggered
            during this run. Review the consequence nodes before unsupervised practice.
          </p>
        )}
      </div>

      {triggeredConsequences.length > 0 && (
        <ul className="completion-consequence-list">
          {triggeredConsequences.map((id) => {
            const node = getConsequenceById(id);
            return node ? (
              <li key={id} className="completion-consequence-item">
                <strong>{node.id}</strong> — {node.immediateAction}
              </li>
            ) : null;
          })}
        </ul>
      )}

      {probeEntries.length > 0 && (
        <div className="assessment-probes">
          <h3 className="assessment-probes-title">Probe-by-probe rationale</h3>
          <p className="assessment-probes-hint">Click any probe to expand its structured rationale.</p>
          {probeEntries.map(({ step, record }) => (
            <ProbeAssessmentCard
              key={step.id}
              stepId={step.id}
              probeId={step.mentorProbeId!}
              record={record}
            />
          ))}
        </div>
      )}

      {probeEntries.length === 0 && (
        <p className="assessment-no-probes">
          No Mentor probes were evaluated during this run. Enable a Mentor service and re-run the
          scenario to see detailed proficiency assessments.
        </p>
      )}

      <div className="completion-actions">
        <button type="button" className="btn-secondary" onClick={onSelectAnother}>
          Try another scenario
        </button>
        <button type="button" className="btn-primary" onClick={onFinish}>
          Continue
        </button>
      </div>
    </div>
  );
}

// ─── Active Scenario view ─────────────────────────────────────────

function ActiveScenarioView({
  definition,
  onFinish,
  onSelectAnother,
  expertiseLevel,
}: {
  definition: ScenarioDefinition;
  onFinish: () => void;
  onSelectAnother: () => void;
  expertiseLevel: SimulatedExpertiseLevel;
}) {
  const { domain } = useDomain();
  const engine = useScenarioEngine(definition);
  const [pendingConsequenceId, setPendingConsequenceId] = useState<string | null>(null);
  const [probeRecords, setProbeRecords] = useState<Record<string, ProbeAttemptRecord>>({});

  const {
    state,
    currentStep,
    narratorText,
    mentorProbeId,
    safetyGateId,
    isComplete,
    isReviewMode,
    canGoPrevious,
    canGoNext,
    activeFaultIds,
    triggeredConsequenceIds,
    advance,
    goPrevious,
    goNext,
    satisfyMentorProbe,
    acknowledgeSafetyGate,
    resolveFault,
    missConsequence,
  } = engine;

  function handleAdvance() {
    const result = advance();
    if (result.blocked) {
      if (result.reason === 'safety_gate') {
        // Try to trigger consequence if there is one for the active fault
        const activeFault = activeFaultIds[0];
        if (activeFault) {
          const info = missConsequence(activeFault);
          if (info) setPendingConsequenceId(info.consequenceId);
        }
      }
    }
  }

  function handleConsequenceAcknowledged() {
    setPendingConsequenceId(null);
    // Force-acknowledge safety gate after consequence is shown
    acknowledgeSafetyGate();
    activeFaultIds.forEach((id) => resolveFault(id));
  }

  if (isComplete && !pendingConsequenceId) {
    return (
      <AssessmentSummaryPanel
        definition={definition}
        triggeredConsequences={triggeredConsequenceIds}
        resolvedFaults={state.resolvedFaultIds}
        probeRecords={probeRecords}
        onFinish={onFinish}
        onSelectAnother={onSelectAnother}
      />
    );
  }

  const isFaultStep = !!currentStep?.faultInjectionId || activeFaultIds.length > 0;
  const isLastStep = state.currentStepIndex === definition.steps.length - 1;
  const nextBlockReason =
    activeFaultIds.length > 0 ? 'Resolve all active faults before advancing.' :
    !state.safetyGateAcknowledged ? 'Acknowledge the safety requirement to continue.' :
    !state.mentorProbeSatisfied ? 'Complete the Mentor probe to continue.' :
    null;
  const nextEnabled = isReviewMode ? canGoNext : nextBlockReason === null;

  function handleNext() {
    if (isReviewMode) {
      goNext();
    } else {
      handleAdvance();
    }
  }

  const currentProbeRecord = mentorProbeId && currentStep
    ? probeRecords[currentStep.id]
    : undefined;

  function recordProbeAttempt(stepId: string, record: ProbeAttemptRecord) {
    setProbeRecords((prev) => {
      const existing = prev[stepId];
      // Keep the highest-scoring attempt so the assessment summary reflects best performance.
      if (existing && existing.evaluation.score >= record.evaluation.score) return prev;
      return { ...prev, [stepId]: record };
    });
  }

  return (
    <div className="scenario-active">
      <div className="scenario-active-header">
        <h3 className="scenario-active-title">{definition.label}</h3>
        {isReviewMode && (
          <span className="scenario-review-badge" role="status">
            👁 Reviewing step {state.currentStepIndex + 1} of {definition.steps.length}
          </span>
        )}
        <button type="button" className="btn-ghost scenario-back-btn" onClick={onSelectAnother}>
          ← All scenarios
        </button>
      </div>

      <div className="scenario-active-body">
        {/* Sidebar */}
        <ProcedureScaffold definition={definition} state={state} phaseLabels={domain.phaseLabels} />

        {/* Main content */}
        <div className="scenario-main-content">
          {/* Consequence takes priority when triggered */}
          {pendingConsequenceId ? (
            <ConsequencePanel
              consequenceId={pendingConsequenceId}
              onContinue={handleConsequenceAcknowledged}
            />
          ) : (
            <>
              <NarratorPanel
                narratorText={narratorText}
                isFaultStep={isFaultStep}
                safetyGateId={safetyGateId}
                safetyGateAcknowledged={state.safetyGateAcknowledged}
                onAcknowledge={acknowledgeSafetyGate}
                stepId={currentStep?.id}
              />

              {/* Active fault resolution */}
              {activeFaultIds.map((faultId) => (
                <ActiveFaultPanel
                  key={faultId}
                  faultId={faultId}
                  onResolved={resolveFault}
                />
              ))}

              {/* Mentor probe */}
              {mentorProbeId && currentStep && (
                <MentorReflectionPanel
                  key={currentStep.id}
                  probeId={mentorProbeId}
                  onSatisfied={satisfyMentorProbe}
                  expertiseLevel={expertiseLevel}
                  readOnly={isReviewMode}
                  initialRecord={currentProbeRecord}
                  onAttemptRecorded={(rec) => recordProbeAttempt(currentStep.id, rec)}
                />
              )}

              {/* Navigation: Previous / Next — always visible so learners can pace themselves */}
              <div className="scenario-nav">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={goPrevious}
                  disabled={!canGoPrevious}
                >
                  ← Previous
                </button>
                <div className="scenario-nav-spacer" />
                <div className="scenario-nav-next">
                  {!isReviewMode && nextBlockReason && (
                    <p className="advance-blocked-hint">{nextBlockReason}</p>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={!nextEnabled}
                  >
                    {isReviewMode ? 'Next (return to current) →' : isLastStep ? 'Complete Scenario →' : 'Next →'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

const SCENARIO_EXPERTISE_LEVELS: { value: SimulatedExpertiseLevel; label: string }[] = [
  { value: 'complete-novice', label: 'Complete Novice' },
  { value: 'novice',          label: 'Novice (Eng. Tech)' },
  { value: 'naive',           label: 'Naive (Vocab Only)' },
  { value: 'intermediate',    label: 'Intermediate' },
  { value: 'proficient',      label: 'Proficient' },
];

/** Scenario Mode: selector grid + Narrator/Mentor/Student interaction loop. */
export function ScenarioView({ onAdvancePhase }: Props) {
  const { domain } = useDomain();
  const [selectedDef, setSelectedDef] = useState<ScenarioDefinition | null>(null);
  const [expertiseLevel, setExpertiseLevel] = useState<SimulatedExpertiseLevel>('naive');
  const hasLearnerService = !!getSimulatedLearnerService();

  const selectorSubtitle = domain.fullEngine
    ? 'Each scenario walks through a corpus-grounded HD2 operation. Narrator text is drawn directly from AJP knowledge graph nodes — no generation.'
    : `Each scenario walks through a ${domain.name} situation, grounded in the domain's knowledge graph. Narrator text is drawn directly from the corpus — no generation.`;

  const expertisePicker = hasLearnerService ? (
    <div className="sim-expertise-picker">
      <span className="sim-expertise-label">🤖 Simulate as:</span>
      {SCENARIO_EXPERTISE_LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          className={`sim-expertise-btn ${expertiseLevel === l.value ? 'sim-expertise-btn--active' : ''}`}
          onClick={() => setExpertiseLevel(l.value)}
        >
          {l.label}
        </button>
      ))}
    </div>
  ) : null;

  if (!selectedDef) {
    return (
      <div className="scenario-view">
        {expertisePicker}
        <ScenarioSelectorGrid
          scenarios={domain.scenarios}
          subtitle={selectorSubtitle}
          onSelect={setSelectedDef}
        />
      </div>
    );
  }

  return (
    <div className="scenario-view">
      {expertisePicker}
      <ActiveScenarioView
        key={selectedDef.id}
        definition={selectedDef}
        onFinish={onAdvancePhase}
        onSelectAnother={() => setSelectedDef(null)}
        expertiseLevel={expertiseLevel}
      />
    </div>
  );
}
