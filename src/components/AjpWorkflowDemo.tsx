/**
 * AJP Workflow Demo — three-phase guided experience.
 *
 * Phase 1 (setup):    Select learner name, expertise level, and mode:
 *                     - Manual:   human types responses
 *                     - Simulate: LLM plays the learner, Mentor evaluates, runs automatically
 * Phase 2 (practice): Probe-by-probe interaction.
 *                     Simulate mode: Learner → Mentor loop runs automatically with
 *                     ⏸ Pause / ▶ Resume and ← Previous controls.
 * Phase 3 (results):  Per-concept mastery summary.
 *
 * Probe selection by expertise:
 *   novice     → 3 foundational probes
 *   technician → 6 core-operations probes
 *   expert     → all 11 probes
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { AJPNode } from '../types/ajp';
import type { MentorEvaluation } from '../engine/mentor';
import { getMentorService } from '../engine/mentor';
import { getSimulatedLearnerService } from '../engine/simulated-learner';
import { useDomain } from '../domain/useDomain';
import { ajpProbeNodes } from '../corpus/ajp/probes';
import { probeLabel, isSafetyProbe, masteryThreshold, scoreClass } from './socratic-view.utils';
import {
  probeContextStrategy,
  tacitLookupStrategy,
  formatProbeRetrievalContext,
  groundingNodeIdsFrom,
  graphViewForDomain,
} from '../engine/retrieval/retrieval-router';
import { SourceRefText } from './SourceRefText';
import { ProvenanceBadge } from './MentorProvenance';
import { MentorDegradedBanner } from './MentorDegradedBanner';

// ─── Types ────────────────────────────────────────────────────────

type ExpertiseLevel = 'complete-novice' | 'novice' | 'naive' | 'intermediate' | 'proficient';
type DemoMode = 'manual' | 'simulate';
type DemoPhase = 'setup' | 'practice' | 'results';

interface ProbeRecord {
  probe: AJPNode;
  attempts: number;
  mastered: boolean;
  lastScore: number | null;
  skipped: boolean;
}

// ─── Probe selection by expertise ────────────────────────────────

const NOVICE_PROBE_IDS = [
  'PROBE-GAS-SEQUENCE-START-001',
  'PROBE-ESD-PROTOCOL-001',
  'PROBE-PRESSURE-INTERPRETATION-001',
];
const TECHNICIAN_PROBE_IDS = [
  'PROBE-GAS-SEQUENCE-START-001',
  'PROBE-GAS-SEQUENCE-STOP-001',
  'PROBE-ESD-PROTOCOL-001',
  'PROBE-PRESSURE-INTERPRETATION-001',
  'PROBE-NOZZLE-INSPECT-001',
  'PROBE-ABORT-DECISION-001',
];

function selectProbes(level: ExpertiseLevel): AJPNode[] {
  const byId = new Map(ajpProbeNodes.map((p) => [p.id, p]));
  if (level === 'complete-novice' || level === 'novice') return NOVICE_PROBE_IDS.map((id) => byId.get(id)!).filter(Boolean);
  if (level === 'naive' || level === 'intermediate') return TECHNICIAN_PROBE_IDS.map((id) => byId.get(id)!).filter(Boolean);
  return ajpProbeNodes;
}

// ─── Setup screen ─────────────────────────────────────────────────

function SetupScreen({
  onStart,
}: {
  onStart: (name: string, level: ExpertiseLevel, mode: DemoMode) => void;
}) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<ExpertiseLevel>('intermediate');
  const hasLlm = !!getMentorService();
  // Simulate mode requires the LLM; default to manual when no key.
  const [mode, setMode] = useState<DemoMode>(hasLlm ? 'simulate' : 'manual');

  const LEVELS: { value: ExpertiseLevel; label: string; desc: string; count: number }[] = [
    { value: 'complete-novice', label: 'Complete Novice', desc: 'No AJP vocab, no relevant tech background', count: 3 },
    { value: 'novice',          label: 'Novice',          desc: 'Eng. tech experience, no AJP vocabulary', count: 3 },
    { value: 'naive',           label: 'Naive',           desc: 'AJP vocab from manual/class, no hands-on', count: 6 },
    { value: 'intermediate',    label: 'Intermediate',    desc: 'Supervised hands-on, knows procedures', count: 6 },
    { value: 'proficient',      label: 'Proficient',      desc: 'Full SOPs, physics, perceptual signals', count: 11 },
  ];

  return (
    <div className="workflow-setup">
      <div className="workflow-setup-header">
        <h2>Configure the Demo</h2>
        <p className="workflow-setup-sub">
          An LLM Mentor evaluates AJP knowledge probes and produces a proficiency summary.
          In simulate mode an AI learner answers automatically — watch the full Learner → Mentor
          loop run with pause and rewind controls.
        </p>
      </div>

      <div className="workflow-setup-form">
        <label className="workflow-field-label" htmlFor="demo-learner-name">
          Learner name <span className="workflow-optional">(optional)</span>
        </label>
        <input
          id="demo-learner-name"
          type="text"
          className="workflow-name-input"
          placeholder="e.g. Alex"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={48}
          autoFocus
        />

        <p className="workflow-field-label">Expertise level</p>
        <div className="workflow-level-grid">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`workflow-level-card ${level === l.value ? 'workflow-level-card--active' : ''}`}
              onClick={() => setLevel(l.value)}
            >
              <span className="workflow-level-name">{l.label}</span>
              <span className="workflow-level-count">{l.count} probe{l.count !== 1 ? 's' : ''}</span>
              <span className="workflow-level-desc">{l.desc}</span>
            </button>
          ))}
        </div>

        <p className="workflow-field-label">Interaction mode</p>
        <div className="workflow-mode-row">
          <button
            type="button"
            className={`workflow-mode-card ${mode === 'simulate' ? 'workflow-mode-card--active' : ''}`}
            onClick={() => hasLlm && setMode('simulate')}
            disabled={!hasLlm}
            title={hasLlm ? undefined : 'Add a Gemini API key to enable simulation'}
          >
            <span className="workflow-mode-icon">🤖</span>
            <span className="workflow-mode-name">
              Simulate{!hasLlm && <span className="workflow-mode-locked"> · API key required</span>}
            </span>
            <span className="workflow-mode-desc">
              AI learner generates responses at the chosen expertise level.
              Includes pause, resume, and go-back controls.
            </span>
          </button>
          <button
            type="button"
            className={`workflow-mode-card ${mode === 'manual' ? 'workflow-mode-card--active' : ''}`}
            onClick={() => setMode('manual')}
          >
            <span className="workflow-mode-icon">✏️</span>
            <span className="workflow-mode-name">Manual</span>
            <span className="workflow-mode-desc">
              You type your own responses. The Mentor evaluates them and guides
              you toward mastery.
            </span>
          </button>
        </div>

        {!hasLlm && (
          <p className="workflow-no-key-warn">
            Add a Gemini API key via the <span aria-hidden="true">⚙</span> gear in the header to enable LLM evaluation and simulation.
          </p>
        )}

        <button
          type="button"
          className="btn-primary workflow-launch-btn"
          onClick={() => onStart(name.trim() || 'Learner', level, mode)}
        >
          Launch Demo →
        </button>
      </div>
    </div>
  );
}

// ─── Learner response bubble ──────────────────────────────────────

function LearnerBubble({ text }: { text: string }) {
  return (
    <div className="sim-learner-bubble">
      <span className="sim-bubble-label">🎓 LEARNER</span>
      <p className="sim-bubble-text">{text}</p>
    </div>
  );
}

// ─── Simulation step indicator ────────────────────────────────────

function SimThinking({ label }: { label: string }) {
  return (
    <div className="sim-thinking">
      <span className="sim-spinner" />
      <span>{label}</span>
    </div>
  );
}

// ─── Probe practice panel ─────────────────────────────────────────

type SimStep =
  | 'idle'
  | 'generating-response'
  | 'paused-before-eval'
  | 'evaluating'
  | 'paused-before-followup'
  | 'generating-followup'
  | 'paused-before-followup-eval'
  | 'evaluating-followup'
  | 'done';

function ProbePracticePanel({
  record,
  probeIndex,
  totalProbes,
  expertiseLevel,
  demoMode,
  canGoBack,
  onNext,
  onSkip,
  onFinish,
  onGoBack,
}: {
  record: ProbeRecord;
  probeIndex: number;
  totalProbes: number;
  expertiseLevel: ExpertiseLevel;
  demoMode: DemoMode;
  canGoBack: boolean;
  onNext: (probeId: string, mastered: boolean, score: number | null) => void;
  onSkip: (probeId: string) => void;
  onFinish: () => void;
  onGoBack: () => void;
}) {
  const { probe } = record;
  const { domain } = useDomain();
  const mentorService = getMentorService();
  const learnerService = getSimulatedLearnerService();
  const threshold = masteryThreshold(probe);
  const isSafety = isSafetyProbe(probe);

  // Shared evaluation state
  const [evaluation, setEvaluation] = useState<MentorEvaluation | null>(null);
  const [followUpEval, setFollowUpEval] = useState<MentorEvaluation | null>(null);
  const [attempts, setAttempts] = useState(0);

  // Simulation-specific state
  const [simStep, setSimStep] = useState<SimStep>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [simLearnerResponse, setSimLearnerResponse] = useState<string | null>(null);
  const [simFollowUpResponse, setSimFollowUpResponse] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const isPausedRef = useRef(false);

  // Manual mode state
  const [response, setResponse] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextExpanded, setContextExpanded] = useState(false);

  const isLast = probeIndex === totalProbes - 1;
  const currentEval = followUpEval ?? evaluation;
  const mastered = currentEval?.masteryPassed === true;

  // Scope retrieval to the active domain (not the boot-bound graph) so grounding never
  // leaks cross-domain — matching SocraticView/ScenarioView. Memoized so the identities
  // the runSimulation callback depends on stay stable across renders.
  const graph = useMemo(() => graphViewForDomain(domain), [domain]);
  const probeCtx = useMemo(() => probeContextStrategy(probe.id, graph), [probe.id, graph]);
  const tacitResult = useMemo(() => tacitLookupStrategy(probe.content, 3, graph), [probe.content, graph]);
  const groundingNodeIds = useMemo(() => groundingNodeIdsFrom(probeCtx, tacitResult), [probeCtx, tacitResult]);
  const hasContext = tacitResult.matches.length > 0 || tacitResult.linkedHazards.length > 0;

  // Pause/resume helpers
  function pause() {
    isPausedRef.current = true;
    setIsPaused(true);
  }
  function resume() {
    isPausedRef.current = false;
    setIsPaused(false);
  }

  // Wait until unpaused (polled every 150 ms inside async simulation loop)
  async function waitIfPaused() {
    while (isPausedRef.current) {
      await new Promise<void>((r) => setTimeout(r, 150));
    }
  }

  // ── Simulation loop ──────────────────────────────────────────

  const runSimulation = useCallback(async () => {
    if (!mentorService || !learnerService) return;

    const retrievalContext =
      formatProbeRetrievalContext(probeCtx, tacitResult) || undefined;

    try {
      // Step 1 — generate learner response
      setSimStep('generating-response');
      await waitIfPaused();
      const learnerResp = await learnerService.generateResponse({
        probeQuestion: probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        expertiseLevel,
        priorAttempts: 0,
        domainLabel: domain.name,
      });
      setSimLearnerResponse(learnerResp);

      // Pause point — after response appears, before evaluation fires.
      // Auto-pause so the user must explicitly advance.
      setSimStep('paused-before-eval');
      pause();
      await waitIfPaused();

      // Step 2 — Mentor evaluates
      setSimStep('evaluating');
      const eval1 = await mentorService.evaluate({
        probeQuestion: probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        commonWrongAnswers: probe.commonWrongAnswers,
        learnerResponse: learnerResp,
        priorAttempts: 0,
        safetyGate: isSafety,
        retrievalContext,
        groundingNodeIds,
        domainLabel: domain.name,
      });
      setEvaluation(eval1);
      setAttempts(1);

      if (eval1.masteryPassed) {
        setSimStep('done');
        return;
      }

      // Pause point — after eval 1 appears, before follow-up generation.
      // Auto-pause so the user must explicitly advance.
      setSimStep('paused-before-followup');
      pause();
      await waitIfPaused();

      // Step 3 — learner responds to follow-up
      setSimStep('generating-followup');
      const followUpResp = await learnerService.generateResponse({
        probeQuestion: probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        expertiseLevel,
        priorAttempts: 1,
        mentorFeedback: eval1.feedback,
        followUpQuestion: eval1.followUpProbe,
        domainLabel: domain.name,
      });
      setSimFollowUpResponse(followUpResp);

      // Pause point — after follow-up response, before re-evaluation.
      // Auto-pause so the user must explicitly advance.
      setSimStep('paused-before-followup-eval');
      pause();
      await waitIfPaused();

      // Step 4 — Mentor re-evaluates
      setSimStep('evaluating-followup');
      const eval2 = await mentorService.evaluate({
        probeQuestion: eval1.followUpProbe,
        expectedConcepts: probe.expectedConcepts ?? [],
        commonWrongAnswers: probe.commonWrongAnswers,
        learnerResponse: followUpResp,
        priorAttempts: 1,
        safetyGate: isSafety,
        retrievalContext,
        groundingNodeIds,
        domainLabel: domain.name,
      });
      setFollowUpEval(eval2);
      setAttempts(2);
      setSimStep('done');
    } catch (err) {
      // Surface LLM/network failures rather than hanging on a spinner.
      const msg = err instanceof Error ? err.message : String(err);
      setSimError(msg);
      setSimStep('done');
      resume();
    }
  }, [probe, probeCtx, tacitResult, groundingNodeIds, expertiseLevel, isSafety, mentorService, learnerService, domain.name]);

  // Auto-start simulation
  useEffect(() => {
    if (demoMode === 'simulate' && simStep === 'idle') {
      void runSimulation();
    }
  }, [demoMode, simStep, runSimulation]);

  // No auto-advance: the user must press Next → to move to the next probe.

  // ── Manual mode helpers ──────────────────────────────────────

  async function submitManual(text: string, isFollowUp: boolean) {
    if (!text.trim() || !mentorService) return;
    setLoading(true);
    try {
      const retrievalContext =
        formatProbeRetrievalContext(probeCtx, tacitResult) || undefined;
      const result = await mentorService.evaluate({
        probeQuestion: isFollowUp && evaluation ? evaluation.followUpProbe : probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        commonWrongAnswers: probe.commonWrongAnswers,
        learnerResponse: text.trim(),
        priorAttempts: attempts,
        safetyGate: isSafety,
        retrievalContext,
        groundingNodeIds,
        domainLabel: domain.name,
      });
      setAttempts((n) => n + 1);
      if (isFollowUp) setFollowUpEval(result);
      else setEvaluation(result);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, text: string, isFollowUp: boolean) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submitManual(text, isFollowUp);
    }
  }

  // ── Status label ──────────────────────────────────────────────

  const stepLabel: Record<SimStep, string> = {
    idle: '',
    'generating-response':       'Learner is thinking…',
    'paused-before-eval':        'Learner responded — press ▶ Resume to evaluate',
    evaluating:                  'Mentor is evaluating…',
    'paused-before-followup':    'Evaluation done — press ▶ Resume to continue',
    'generating-followup':       'Learner is responding to follow-up…',
    'paused-before-followup-eval': 'Follow-up received — press ▶ Resume to re-evaluate',
    'evaluating-followup':       'Mentor is re-evaluating…',
    done: mastered
      ? 'Mastery reached — press Next → when ready'
      : 'Exchange complete — press Next → when ready',
  };

  // Spinner visible during LLM calls or immediately before one fires
  const showSpinner =
    simStep === 'generating-response' ||
    simStep === 'evaluating' ||
    simStep === 'generating-followup' ||
    simStep === 'evaluating-followup';

  // Whether we're sitting at a pause point (step rendered, next not yet started)
  const atPausePoint =
    simStep === 'paused-before-eval' ||
    simStep === 'paused-before-followup' ||
    simStep === 'paused-before-followup-eval' ||
    simStep === 'done';

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="workflow-probe-panel">
      {/* Progress row */}
      <div className="workflow-progress">
        <div className="workflow-progress-dots">
          {Array.from({ length: totalProbes }).map((_, i) => (
            <span
              key={i}
              className={`workflow-progress-dot ${
                i < probeIndex ? 'dot--done' : i === probeIndex ? 'dot--current' : 'dot--future'
              }`}
            />
          ))}
        </div>
        <span className="workflow-progress-label">{probeIndex + 1} / {totalProbes}</span>
        {demoMode === 'manual' && (
          <button type="button" className="btn-ghost workflow-finish-early" onClick={onFinish}>
            View Results
          </button>
        )}
      </div>

      {/* Simulation transport controls */}
      {demoMode === 'simulate' && (
        <div className="sim-transport">
          <button
            type="button"
            className="sim-transport-btn sim-back-btn"
            onClick={onGoBack}
            disabled={!canGoBack}
            title="Previous probe"
          >
            ◀ Back
          </button>

          {isPaused ? (
            <button
              type="button"
              className="sim-transport-btn sim-play-btn"
              onClick={resume}
              title="Resume simulation"
            >
              ▶ Resume
            </button>
          ) : (
            <button
              type="button"
              className={`sim-transport-btn sim-pause-btn ${atPausePoint && !showSpinner ? 'sim-pause-btn--active' : ''}`}
              onClick={pause}
              disabled={simStep === 'done' && !isPaused}
              title="Pause simulation"
            >
              ⏸ Pause
            </button>
          )}

          <span className="sim-status-label">
            {showSpinner && <span className="sim-spinner sim-spinner--inline" />}
            {stepLabel[simStep]}
          </span>

          {(simStep === 'done' || isPaused) && (
            <button
              type="button"
              className="sim-transport-btn sim-skip-btn"
              onClick={() => onNext(probe.id, mastered, currentEval?.score ?? null)}
              title="Skip to next probe now"
            >
              {isLast ? 'Finish →' : 'Next →'}
            </button>
          )}
        </div>
      )}

      {/* Probe heading */}
      <div className="workflow-probe-header">
        <span className="workflow-probe-topic">{probeLabel(probe.id)}</span>
        {isSafety && <span className="workflow-safety-badge">⚠ Safety-critical</span>}
      </div>

      {/* Safety alert */}
      {isSafety && probe.safetyAlert && (
        <div className="workflow-safety-alert">
          <SourceRefText text={probe.safetyAlert} />
        </div>
      )}

      {/* Probe question */}
      <div className="workflow-probe-question">
        <span className="workflow-probe-label">🧑‍🏫 MENTOR ASKS</span>
        <p className="workflow-probe-text">
          <SourceRefText text={probe.content} />
        </p>
      </div>

      {/* Background context (manual mode only) */}
      {demoMode === 'manual' && hasContext && (
        <div className="workflow-context-strip">
          <button
            type="button"
            className="graph-context-toggle"
            onClick={() => setContextExpanded((e) => !e)}
            aria-expanded={contextExpanded}
          >
            📚 Background context · {tacitResult.matches.length} concept{tacitResult.matches.length !== 1 ? 's' : ''}
            {tacitResult.linkedHazards.length > 0 ? ` · ${tacitResult.linkedHazards.length} safety note${tacitResult.linkedHazards.length !== 1 ? 's' : ''}` : ''}
            {contextExpanded ? ' ▲' : ' ▼'}
          </button>
          {contextExpanded && (
            <div className="graph-context-body">
              {tacitResult.matches.map(({ node }) => (
                <div key={node.id} className="tacit-item">
                  <p className="tacit-content"><SourceRefText text={node.content} /></p>
                  <span className="graph-node-ref">{node.id}</span>
                </div>
              ))}
              {tacitResult.linkedHazards.map((h) => (
                <div key={h.id} className="hazard-item">
                  {h.safetyAlert && <p className="hazard-alert">⚠️ <SourceRefText text={h.safetyAlert} /></p>}
                  <p className="hazard-content"><SourceRefText text={h.content} /></p>
                  <span className="graph-node-ref">{h.id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SIMULATE MODE EXCHANGE ── */}
      {demoMode === 'simulate' && (
        <div className="sim-exchange">
          {simStep === 'generating-response' && (
            <SimThinking label="Simulated learner is thinking…" />
          )}

          {simLearnerResponse && (
            <LearnerBubble text={simLearnerResponse} />
          )}

          {simStep === 'evaluating' && (
            <SimThinking label="Mentor is evaluating…" />
          )}

          {evaluation && (
            <div className={`mentor-evaluation ${scoreClass(evaluation.score)}`}>
              {evaluation.degraded ? (
                <MentorDegradedBanner feedback={evaluation.feedback} />
              ) : (
                <>
                  <div className="eval-score-row">
                    <div className="eval-score-bar">
                      <div className="eval-score-fill" style={{ width: `${Math.round(evaluation.score * 100)}%` }} />
                    </div>
                    <span className="eval-score-pct">{Math.round(evaluation.score * 100)}%</span>
                  </div>
                  <p className="eval-feedback">{evaluation.feedback}</p>
                  <ProvenanceBadge evaluation={evaluation} />
                </>
              )}
              {!evaluation.masteryPassed && (
                <p className="eval-followup"><em>Follow-up: {evaluation.followUpProbe}</em></p>
              )}
              {evaluation.masteryPassed && (
                <div className="mastery-achieved">
                  <span className="mastery-icon">✓</span>
                  <span>Mastery threshold ({Math.round(threshold * 100)}%) reached</span>
                </div>
              )}
            </div>
          )}

          {simStep === 'generating-followup' && (
            <SimThinking label="Learner is responding to follow-up…" />
          )}

          {simFollowUpResponse && (
            <LearnerBubble text={simFollowUpResponse} />
          )}

          {simStep === 'evaluating-followup' && (
            <SimThinking label="Mentor is re-evaluating…" />
          )}

          {followUpEval && (
            <div className={`mentor-evaluation ${scoreClass(followUpEval.score)}`}>
              {followUpEval.degraded ? (
                <MentorDegradedBanner feedback={followUpEval.feedback} />
              ) : (
                <>
                  <div className="eval-score-row">
                    <div className="eval-score-bar">
                      <div className="eval-score-fill" style={{ width: `${Math.round(followUpEval.score * 100)}%` }} />
                    </div>
                    <span className="eval-score-pct">{Math.round(followUpEval.score * 100)}%</span>
                  </div>
                  <p className="eval-feedback">{followUpEval.feedback}</p>
                  <ProvenanceBadge evaluation={followUpEval} />
                </>
              )}
              {mastered ? (
                <div className="mastery-achieved">
                  <span className="mastery-icon">✓</span>
                  <span>Mastery threshold ({Math.round(threshold * 100)}%) reached</span>
                </div>
              ) : (
                <p className="eval-followup"><em>{followUpEval.followUpProbe}</em></p>
              )}
            </div>
          )}

          {simError && (
            <div className="sim-error" role="alert">
              <strong>Simulation error:</strong> {simError}
              <p className="sim-error-hint">Use Next → to skip this probe, or check your API key in the gear menu.</p>
            </div>
          )}
        </div>
      )}

      {/* ── MANUAL MODE ── */}
      {demoMode === 'manual' && (
        <>
          {!mastered && !currentEval && (
            <div className="workflow-response-block">
              <textarea
                className="mentor-textarea"
                rows={4}
                placeholder="Type your response… (Ctrl+Enter to submit)"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, response, false)}
                disabled={loading}
                aria-label="Probe response"
              />
              <div className="workflow-response-actions">
                {mentorService ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void submitManual(response, false)}
                    disabled={!response.trim() || loading}
                  >
                    {loading ? 'Evaluating…' : 'Submit Response'}
                  </button>
                ) : (
                  <p className="workflow-no-mentor">
                    Add a Gemini API key via the <span aria-hidden="true">⚙</span> gear in the header to enable LLM evaluation.
                  </p>
                )}
                <button type="button" className="btn-ghost" onClick={() => onSkip(probe.id)}>Skip</button>
              </div>
            </div>
          )}

          {evaluation && !mastered && !followUpEval && (
            <div className={`mentor-evaluation ${scoreClass(evaluation.score)}`}>
              {evaluation.degraded ? (
                <MentorDegradedBanner feedback={evaluation.feedback} />
              ) : (
                <>
                  <div className="eval-score-row">
                    <div className="eval-score-bar">
                      <div className="eval-score-fill" style={{ width: `${Math.round(evaluation.score * 100)}%` }} />
                    </div>
                    <span className="eval-score-pct">{Math.round(evaluation.score * 100)}%</span>
                  </div>
                  <p className="eval-feedback">{evaluation.feedback}</p>
                  <ProvenanceBadge evaluation={evaluation} />
                </>
              )}
              <div className="probe-followup-block">
                <div className="probe-question-label">🧑‍🏫 FOLLOW-UP</div>
                <p className="probe-question">{evaluation.followUpProbe}</p>
                <textarea
                  className="mentor-textarea"
                  rows={3}
                  placeholder="Continue your response…"
                  value={followUpResponse}
                  onChange={(e) => setFollowUpResponse(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, followUpResponse, true)}
                  disabled={loading}
                  aria-label="Follow-up response"
                />
                <div className="workflow-response-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void submitManual(followUpResponse, true)}
                    disabled={!followUpResponse.trim() || loading}
                  >
                    {loading ? 'Evaluating…' : 'Submit Follow-up'}
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => onNext(probe.id, false, null)}>
                    {isLast ? 'Finish →' : 'Next probe →'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentEval && (mastered || followUpEval) && (
            <div className={`mentor-evaluation ${scoreClass(currentEval.score)}`}>
              {currentEval.degraded ? (
                <MentorDegradedBanner feedback={currentEval.feedback} />
              ) : (
                <>
                  <div className="eval-score-row">
                    <div className="eval-score-bar">
                      <div className="eval-score-fill" style={{ width: `${Math.round(currentEval.score * 100)}%` }} />
                    </div>
                    <span className="eval-score-pct">{Math.round(currentEval.score * 100)}%</span>
                  </div>
                  <p className="eval-feedback">{currentEval.feedback}</p>
                  <ProvenanceBadge evaluation={currentEval} />
                </>
              )}
              {mastered ? (
                <div className="mastery-achieved">
                  <span className="mastery-icon">✓</span>
                  <span>Mastery threshold ({Math.round(threshold * 100)}%) reached</span>
                </div>
              ) : (
                <p className="eval-followup"><em>{currentEval.followUpProbe}</em></p>
              )}
              <button type="button" className="btn-primary" onClick={() => onNext(probe.id, mastered, currentEval.score)}>
                {isLast ? 'Finish →' : 'Next probe →'}
              </button>
            </div>
          )}

          {!mentorService && !currentEval && (
            <div className="workflow-nollm-nav">
              <button type="button" className="btn-primary" onClick={() => onNext(probe.id, false, null)}>
                {isLast ? 'Finish →' : 'Next probe →'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Results screen ───────────────────────────────────────────────

function ResultsScreen({
  name,
  level,
  mode,
  records,
  onRestart,
}: {
  name: string;
  level: ExpertiseLevel;
  mode: DemoMode;
  records: ProbeRecord[];
  onRestart: () => void;
}) {
  const masteredCount = records.filter((r) => r.mastered).length;
  const attemptedCount = records.filter((r) => r.attempts > 0).length;
  const totalCount = records.length;
  const masteryPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  function categoryOf(id: string): string {
    if (id.startsWith('PROBE-GAS')) return 'Startup & Gas';
    if (id === 'PROBE-ESD-PROTOCOL-001') return 'Safety';
    if (id === 'PROBE-PRESSURE-INTERPRETATION-001' || id === 'PROBE-ABORT-DECISION-001') return 'Diagnostics';
    if (id === 'PROBE-NOZZLE-INSPECT-001') return 'Hardware';
    if (id === 'PROBE-SINTER-PARAMETERS-001') return 'Post-Process';
    if (id === 'PROBE-TACIT-LINE-QUALITY-001') return 'Print Quality';
    return 'Perceptual Signals';
  }

  const categories = [...new Set(records.map((r) => categoryOf(r.probe.id)))];
  const LEVEL_LABELS: Record<ExpertiseLevel, string> = {
    'complete-novice': 'Complete Novice',
    novice:            'Novice (Eng. Tech)',
    naive:             'Naive (Vocab Only)',
    intermediate:      'Intermediate',
    proficient:        'Proficient',
  };

  return (
    <div className="workflow-results">
      <div className="workflow-results-header">
        <h2>Session Complete</h2>
        <p className="workflow-results-meta">
          {name} · {LEVEL_LABELS[level]} · {mode === 'simulate' ? 'Simulated' : 'Manual'} ·{' '}
          {attemptedCount} of {totalCount} probe{totalCount !== 1 ? 's' : ''} attempted
        </p>
      </div>

      <div className="workflow-results-score">
        <div className="workflow-score-arc">
          <span className="workflow-score-pct">{masteryPct}%</span>
          <span className="workflow-score-label">mastery</span>
        </div>
        <div className="workflow-score-breakdown">
          <div className="workflow-score-stat">
            <span className="workflow-score-stat-num">{masteredCount}</span>
            <span className="workflow-score-stat-label">Mastered</span>
          </div>
          <div className="workflow-score-stat">
            <span className="workflow-score-stat-num">{attemptedCount - masteredCount}</span>
            <span className="workflow-score-stat-label">Needs practice</span>
          </div>
          <div className="workflow-score-stat">
            <span className="workflow-score-stat-num">{totalCount - attemptedCount}</span>
            <span className="workflow-score-stat-label">Not attempted</span>
          </div>
        </div>
      </div>

      <div className="workflow-score-bar-full">
        <div className="workflow-score-bar-fill" style={{ width: `${masteryPct}%` }} />
      </div>

      <div className="workflow-results-categories">
        {categories.map((cat) => {
          const catRecords = records.filter((r) => categoryOf(r.probe.id) === cat);
          return (
            <div key={cat} className="workflow-results-category">
              <h3 className="workflow-results-cat-title">{cat}</h3>
              <ul className="workflow-results-probe-list">
                {catRecords.map((r) => (
                  <li
                    key={r.probe.id}
                    className={`workflow-results-probe-item ${
                      r.mastered ? 'probe-result--mastered'
                      : r.skipped || r.attempts === 0 ? 'probe-result--skipped'
                      : 'probe-result--needs-practice'
                    }`}
                  >
                    <span className="probe-result-icon">
                      {r.mastered ? '✓' : r.skipped || r.attempts === 0 ? '—' : '✗'}
                    </span>
                    <span className="probe-result-name">{probeLabel(r.probe.id)}</span>
                    {isSafetyProbe(r.probe) && <span className="probe-result-safety">⚠</span>}
                    {r.lastScore !== null && (
                      <span className="probe-result-score">{Math.round(r.lastScore * 100)}%</span>
                    )}
                    {(r.skipped || r.attempts === 0) && (
                      <span className="probe-result-note">not attempted</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {records.some((r) => isSafetyProbe(r.probe) && !r.mastered && r.attempts > 0) && (
        <div className="workflow-results-safety-note">
          ⚠ One or more safety-critical probes did not reach the mastery threshold.
          Review the AJP SOPs before unsupervised operation.
        </div>
      )}

      <button type="button" className="btn-primary workflow-restart-btn" onClick={onRestart}>
        Start New Session
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────

/** AJP Workflow Demo — profile setup → guided probe practice → proficiency results. */
export function AjpWorkflowDemo() {
  const [phase, setPhase] = useState<DemoPhase>('setup');
  const [learnerName, setLearnerName] = useState('Learner');
  const [expertiseLevel, setExpertiseLevel] = useState<ExpertiseLevel>('naive');
  const [demoMode, setDemoMode] = useState<DemoMode>('simulate');
  const [records, setRecords] = useState<ProbeRecord[]>([]);
  const [probeIndex, setProbeIndex] = useState(0);

  function handleStart(name: string, level: ExpertiseLevel, mode: DemoMode) {
    const probes = selectProbes(level);
    setLearnerName(name);
    setExpertiseLevel(level);
    setDemoMode(mode);
    setRecords(probes.map((p) => ({ probe: p, attempts: 0, mastered: false, lastScore: null, skipped: false })));
    setProbeIndex(0);
    setPhase('practice');
  }

  function handleNext(probeId: string, mastered: boolean, score: number | null) {
    setRecords((prev) =>
      prev.map((r) =>
        r.probe.id === probeId ? { ...r, mastered, lastScore: score, attempts: r.attempts + 1 } : r,
      ),
    );
    if (probeIndex < records.length - 1) {
      setProbeIndex((i) => i + 1);
    } else {
      setPhase('results');
    }
  }

  function handleSkip(probeId: string) {
    setRecords((prev) =>
      prev.map((r) => (r.probe.id === probeId ? { ...r, skipped: true } : r)),
    );
    if (probeIndex < records.length - 1) {
      setProbeIndex((i) => i + 1);
    } else {
      setPhase('results');
    }
  }

  function handleGoBack() {
    if (probeIndex === 0) return;
    const prevIndex = probeIndex - 1;
    // Reset the record for the probe we're returning to so it re-runs cleanly
    setRecords((prev) =>
      prev.map((r, i) =>
        i === prevIndex
          ? { ...r, attempts: 0, mastered: false, lastScore: null, skipped: false }
          : r,
      ),
    );
    setProbeIndex(prevIndex);
  }

  return (
    <div className="ajp-workflow-demo">
      {phase === 'setup' && <SetupScreen onStart={handleStart} />}
      {phase === 'practice' && records.length > 0 && (
        <ProbePracticePanel
          key={`${records[probeIndex].probe.id}-${probeIndex}`}
          record={records[probeIndex]}
          probeIndex={probeIndex}
          totalProbes={records.length}
          expertiseLevel={expertiseLevel}
          demoMode={demoMode}
          canGoBack={probeIndex > 0}
          onNext={handleNext}
          onSkip={handleSkip}
          onFinish={() => setPhase('results')}
          onGoBack={handleGoBack}
        />
      )}
      {phase === 'results' && (
        <ResultsScreen
          name={learnerName}
          level={expertiseLevel}
          mode={demoMode}
          records={records}
          onRestart={() => { setPhase('setup'); setRecords([]); setProbeIndex(0); }}
        />
      )}
    </div>
  );
}
