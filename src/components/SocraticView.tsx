/**
 * Socratic Practice mode for AJP training — Phase 3 multi-agent layer.
 * Presents SocraticProbe nodes from the knowledge graph; learner responds in
 * free text; the LLM Mentor (Gemini Flash) evaluates against expectedConcepts
 * and generates targeted follow-up probes until mastery threshold is reached.
 * Fully standalone — does not require an active experiment session.
 */
import { useState, useMemo } from 'react';
import type { AJPNode } from '../types/ajp';
import type { MentorEvaluation, AblationDiff } from '../engine/mentor';
import { getMentorService, runAblationProbe } from '../engine/mentor';
import { getSimulatedLearnerService } from '../engine/simulated-learner';
import type { SimulatedExpertiseLevel } from '../engine/simulated-learner';
import { useDomain } from '../domain/useDomain';
import { useDomainGraph } from '../domain/useDomainGraph';
import {
  probeLabel,
  probeCategory,
  isSafetyProbe,
  masteryThreshold,
  scoreLabel,
  scoreClass,
  masteryBadge,
} from './socratic-view.utils';
import { probeContextStrategy, tacitLookupStrategy, formatProbeRetrievalContext, groundingNodeIdsFrom } from '../engine/retrieval/retrieval-router';
import { loadProbeProgress, recordProbeAttempt } from '../engine/learner-model/probe-progress';
import { SourceRefText } from './SourceRefText';
import { MentorDegradedBanner } from './MentorDegradedBanner';
import { ProvenanceBadge, AblationPanel, ProvenanceToggle } from './MentorProvenance';

// ─── Types ────────────────────────────────────────────────────────

interface ProbeSession {
  probe: AJPNode;
  attempts: number;
  mastered: boolean;
  lastScore: number | null;
}

// ─── Sub-renderers ────────────────────────────────────────────────

function TopicGrid({
  sessions,
  onSelect,
}: {
  sessions: ProbeSession[];
  onSelect: (probeId: string) => void;
}) {
  const categories = [...new Set(sessions.map((s) => probeCategory(s.probe.id)))];

  return (
    <div className="socratic-grid">
      {categories.map((cat) => (
        <div key={cat} className="socratic-category">
          <h3 className="category-label">{cat}</h3>
          <div className="category-cards">
            {sessions
              .filter((s) => probeCategory(s.probe.id) === cat)
              .map((s) => (
                <button
                  key={s.probe.id}
                  type="button"
                  className={`probe-card ${s.mastered ? 'probe-card--mastered' : s.attempts > 0 ? 'probe-card--in-progress' : ''}`}
                  onClick={() => onSelect(s.probe.id)}
                >
                  <span className="probe-card-title">{probeLabel(s.probe.id)}</span>
                  {isSafetyProbe(s.probe) && (
                    <span className="probe-card-safety">⚠️ Safety-critical</span>
                  )}
                  <span className="probe-card-badge">
                    {masteryBadge(s.mastered, s.attempts)}
                  </span>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Graph context panel ──────────────────────────────────────────
// Collapsed by default; surfaces tacit knowledge and linked hazards
// from the retrieval router alongside the Socratic probe question.

function SocraticGraphContext({ probe }: { probe: AJPNode }) {
  const [expanded, setExpanded] = useState(false);

  // Scope retrieval to the active domain so a tire/COLREG probe cannot surface
  // AJP tacit knowledge as "background" (and vice-versa).
  const graph = useDomainGraph();
  const probeCtx = useMemo(() => probeContextStrategy(probe.id, graph), [probe.id, graph]);
  const tacitResult = useMemo(() => tacitLookupStrategy(probe.content, 3, graph), [probe.content, graph]);

  const tacitCount = tacitResult.matches.length;
  const hazardCount = tacitResult.linkedHazards.length;

  if (tacitCount === 0 && hazardCount === 0) return null;

  return (
    <div className="socratic-graph-context">
      <button
        type="button"
        className="graph-context-toggle"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        📚 Background context · {tacitCount} concept{tacitCount !== 1 ? 's' : ''}
        {hazardCount > 0 ? ` · ${hazardCount} safety note${hazardCount !== 1 ? 's' : ''}` : ''}
        {expanded ? ' ▲' : ' ▼'}
      </button>

      {expanded && (
        <div className="graph-context-body">
          {tacitResult.matches.length > 0 && (
            <div className="tacit-section">
              <strong>Why this matters:</strong>
              {tacitResult.matches.map(({ node, score }) => (
                <div key={node.id} className="tacit-item">
                  <p className="tacit-content">
                    <SourceRefText text={node.content} />
                  </p>
                  <span className="graph-node-ref">
                    {node.id} · relevance {Math.round(score * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
          {tacitResult.linkedHazards.length > 0 && (
            <div className="hazard-section">
              <strong>Safety considerations:</strong>
              {tacitResult.linkedHazards.map((h) => (
                <div key={h.id} className="hazard-item">
                  {h.safetyAlert && (
                    <p className="hazard-alert">
                      ⚠️ <SourceRefText text={h.safetyAlert} />
                    </p>
                  )}
                  <p className="hazard-content">
                    <SourceRefText text={h.content} />
                  </p>
                  <span className="graph-node-ref">{h.id}</span>
                </div>
              ))}
            </div>
          )}
          {probeCtx && probeCtx.probes.filter((p) => p.id !== probe.id).length > 0 && (
            <div className="related-probes-section">
              <strong>Related questions:</strong>
              <ul className="related-probe-list">
                {probeCtx.probes
                  .filter((p) => p.id !== probe.id)
                  .map((p) => (
                    <li key={p.id} className="related-probe-item">
                      <span className="graph-node-ref">{p.id}</span>
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

function ProbePanel({
  session,
  onBack,
  onAttempt,
  expertiseLevel,
}: {
  session: ProbeSession;
  onBack: () => void;
  onAttempt: (probeId: string, score: number, masteryPassed: boolean) => void;
  expertiseLevel: SimulatedExpertiseLevel;
}) {
  const { probe } = session;
  const mentorService = getMentorService();
  const learnerService = getSimulatedLearnerService();
  const threshold = masteryThreshold(probe);

  const [response, setResponse] = useState('');
  const [evaluation, setEvaluation] = useState<MentorEvaluation | null>(null);
  const [followUpResponse, setFollowUpResponse] = useState('');
  const [followUpEval, setFollowUpEval] = useState<MentorEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(session.attempts);
  const [mastered, setMastered] = useState(session.mastered);
  const [simulatedResponse, setSimulatedResponse] = useState<string | null>(null);
  const [simFollowUpResponse, setSimFollowUpResponse] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  // Ground the Mentor in the ACTIVE domain's graph, not the boot-bound graph.
  const graph = useDomainGraph();
  // Provenance probe (dev): run each evaluation with AND without corpus grounding
  // and show whether the corpus actually changed the answer.
  const [ablationOn, setAblationOn] = useState(false);
  const [ablation, setAblation] = useState<AblationDiff<MentorEvaluation> | null>(null);

  async function simulateAndSubmit(isFollowUp: boolean) {
    if (!learnerService || !mentorService) return;
    setSimLoading(true);
    try {
      const generatedText = await learnerService.generateResponse({
        probeQuestion: isFollowUp && evaluation ? evaluation.followUpProbe : probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        expertiseLevel,
        priorAttempts: attempts,
        mentorFeedback: isFollowUp ? evaluation?.feedback : undefined,
        followUpQuestion: isFollowUp && evaluation ? evaluation.followUpProbe : undefined,
      });
      if (isFollowUp) {
        setSimFollowUpResponse(generatedText);
      } else {
        setSimulatedResponse(generatedText);
      }
      await submitResponse(generatedText, isFollowUp);
    } finally {
      setSimLoading(false);
    }
  }

  async function submitResponse(text: string, isFollowUp: boolean) {
    if (!text.trim() || !mentorService) return;
    setLoading(true);
    try {
      // Build retrieval context from graph for this probe — grounds the Mentor
      // in tacit knowledge and linked safety nodes without requiring dense corpus.
      const probeCtx = probeContextStrategy(probe.id, graph);
      const tacitResult = tacitLookupStrategy(probe.content, 4, graph);
      const retrievalContext = formatProbeRetrievalContext(probeCtx, tacitResult) || undefined;
      const groundingNodeIds = groundingNodeIdsFrom(probeCtx, tacitResult);

      const ctx = {
        probeQuestion: isFollowUp && evaluation
          ? evaluation.followUpProbe
          : probe.content,
        expectedConcepts: probe.expectedConcepts ?? [],
        commonWrongAnswers: probe.commonWrongAnswers,
        learnerResponse: text.trim(),
        priorAttempts: attempts,
        safetyGate: isSafetyProbe(probe),
        retrievalContext,
        groundingNodeIds,
      };

      // Ablation probe (dev): only meaningful when grounding exists and on the
      // first-pass answer. Reuses the grounded run so it costs one extra call.
      let result: MentorEvaluation;
      if (ablationOn && retrievalContext && !isFollowUp) {
        const diff = await runAblationProbe(mentorService, ctx);
        setAblation(diff);
        result = diff.grounded;
      } else {
        // Clear any prior ablation on every non-ablation submit — including follow-ups —
        // so a first-pass diff never renders stale beneath a later evaluation.
        setAblation(null);
        result = await mentorService.evaluate(ctx);
      }

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (isFollowUp) {
        setFollowUpEval(result);
      } else {
        setEvaluation(result);
      }

      if (result.masteryPassed) {
        setMastered(true);
      }
      onAttempt(probe.id, result.score, result.masteryPassed);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    e: React.KeyboardEvent,
    text: string,
    isFollowUp: boolean,
  ) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submitResponse(text, isFollowUp);
    }
  }

  const currentEval = followUpEval ?? evaluation;

  return (
    <div className="socratic-probe-panel">
      <button type="button" className="btn-text back-btn" onClick={onBack}>
        ← All Topics
      </button>

      <div className="probe-header">
        <h2 className="probe-title">{probeLabel(probe.id)}</h2>
        {isSafetyProbe(probe) && (
          <div className="safety-alert">
            ⚠️ <SourceRefText text={probe.safetyAlert ?? ''} />
          </div>
        )}
      </div>

      <div className="probe-question-block">
        <div className="probe-question-label">🧑‍🏫 MENTOR ASKS</div>
        <p className="probe-question">
          <SourceRefText
            key={followUpEval && evaluation ? 'follow-up' : 'primary'}
            text={followUpEval && evaluation ? evaluation.followUpProbe : probe.content}
          />
        </p>
      </div>

      <SocraticGraphContext probe={probe} />

      {!mastered && !currentEval && !simulatedResponse && (
        <div className="probe-response-block">
          <textarea
            className="mentor-textarea"
            rows={4}
            placeholder="Type your response… (Ctrl+Enter to submit)"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, response, false)}
            disabled={loading || simLoading}
            aria-label="Socratic response"
          />
          <div className="probe-response-actions">
            {mentorService ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitResponse(response, false)}
                disabled={!response.trim() || loading || simLoading}
              >
                {loading ? 'Evaluating…' : 'Submit'}
              </button>
            ) : (
              <p className="no-mentor-note">
                Add a Gemini API key via the <span aria-hidden="true">⚙</span> gear in the header to enable LLM evaluation.
              </p>
            )}
            {learnerService && mentorService && (
              <button
                type="button"
                className="btn-secondary sim-inline-btn"
                onClick={() => void simulateAndSubmit(false)}
                disabled={loading || simLoading}
              >
                {simLoading
                  ? <><span className="sim-spinner sim-spinner--inline" /> Generating…</>
                  : '🤖 Simulate'}
              </button>
            )}
          </div>
          {mentorService && (
            <ProvenanceToggle
              checked={ablationOn}
              onChange={setAblationOn}
              disabled={loading || simLoading}
            />
          )}
        </div>
      )}

      {simulatedResponse && !evaluation && (
        <div className="sim-learner-bubble">
          <span className="sim-bubble-label">🎓 LEARNER (simulated)</span>
          <p className="sim-bubble-text">{simulatedResponse}</p>
          {(loading || simLoading) && (
            <div className="sim-thinking">
              <span className="sim-spinner sim-spinner--inline" />
              <span>Mentor is evaluating…</span>
            </div>
          )}
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
                  <div
                    className="eval-score-fill"
                    style={{ width: `${Math.round(evaluation.score * 100)}%` }}
                  />
                </div>
                <span className="eval-score-pct">{Math.round(evaluation.score * 100)}%</span>
              </div>
              <p className="eval-score-label">{scoreLabel(evaluation.score)}</p>
              <p className="eval-feedback">{evaluation.feedback}</p>
              <ProvenanceBadge evaluation={evaluation} />
              {ablation && <AblationPanel diff={ablation} />}
            </>
          )}

          <div className="probe-followup-block">
            <div className="probe-question-label">🧑‍🏫 FOLLOW-UP</div>
            <p className="probe-question">{evaluation.followUpProbe}</p>
            {simFollowUpResponse ? (
              <div className="sim-learner-bubble">
                <span className="sim-bubble-label">🎓 LEARNER (simulated)</span>
                <p className="sim-bubble-text">{simFollowUpResponse}</p>
                {(loading || simLoading) && (
                  <div className="sim-thinking">
                    <span className="sim-spinner sim-spinner--inline" />
                    <span>Mentor is evaluating…</span>
                  </div>
                )}
              </div>
            ) : (
              <>
                <textarea
                  className="mentor-textarea"
                  rows={3}
                  placeholder="Continue your response…"
                  value={followUpResponse}
                  onChange={(e) => setFollowUpResponse(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, followUpResponse, true)}
                  disabled={loading || simLoading}
                  aria-label="Follow-up response"
                />
                <div className="probe-response-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void submitResponse(followUpResponse, true)}
                    disabled={!followUpResponse.trim() || loading || simLoading}
                  >
                    {loading ? 'Evaluating…' : 'Submit Follow-up'}
                  </button>
                  {learnerService && (
                    <button
                      type="button"
                      className="btn-secondary sim-inline-btn"
                      onClick={() => void simulateAndSubmit(true)}
                      disabled={loading || simLoading}
                    >
                      {simLoading
                        ? <><span className="sim-spinner sim-spinner--inline" /> Generating…</>
                        : '🤖 Simulate'}
                    </button>
                  )}
                </div>
              </>
            )}
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
                  <div
                    className="eval-score-fill"
                    style={{ width: `${Math.round(currentEval.score * 100)}%` }}
                  />
                </div>
                <span className="eval-score-pct">{Math.round(currentEval.score * 100)}%</span>
              </div>
              <p className="eval-score-label">{scoreLabel(currentEval.score)}</p>
              <p className="eval-feedback">{currentEval.feedback}</p>
              <ProvenanceBadge evaluation={currentEval} />
              {ablation && <AblationPanel diff={ablation} />}
            </>
          )}

          {mastered ? (
            <div className="mastery-achieved">
              <span className="mastery-icon">✓</span>
              <span>
                Mastery threshold ({Math.round(threshold * 100)}%) reached
              </span>
            </div>
          ) : (
            <p className="eval-followup">
              <em>{currentEval.followUpProbe}</em>
            </p>
          )}

          <button type="button" className="btn-secondary" onClick={onBack}>
            Back to Topics
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

const EXPERTISE_LEVELS: { value: SimulatedExpertiseLevel; label: string }[] = [
  { value: 'complete-novice', label: 'Complete Novice' },
  { value: 'novice',          label: 'Novice (Eng. Tech)' },
  { value: 'naive',           label: 'Naive (Vocab Only)' },
  { value: 'intermediate',    label: 'Intermediate' },
  { value: 'proficient',      label: 'Proficient' },
];

/** Socratic Practice — free-text knowledge assessment with LLM Mentor, over the active domain's probes. */
export function SocraticView() {
  const { domain } = useDomain();
  // Seed from persisted progress so mastery survives tab switches and reloads
  // (and feeds the dashboard's Mastery Map).
  const [sessions, setSessions] = useState<ProbeSession[]>(() => {
    const progress = loadProbeProgress();
    return domain.probes.map((probe) => ({
      probe,
      attempts: progress[probe.id]?.attempts ?? 0,
      mastered: progress[probe.id]?.mastered ?? false,
      lastScore: progress[probe.id]?.lastScore ?? null,
    }));
  });
  const [activeProbeId, setActiveProbeId] = useState<string | null>(null);
  const [expertiseLevel, setExpertiseLevel] = useState<SimulatedExpertiseLevel>('naive');
  const hasLearnerService = !!getSimulatedLearnerService();

  const activeSession = sessions.find((s) => s.probe.id === activeProbeId) ?? null;
  const masteredCount = sessions.filter((s) => s.mastered).length;

  function handleAttempt(probeId: string, score: number, masteryPassed: boolean) {
    recordProbeAttempt(probeId, score, masteryPassed);
    setSessions((prev) =>
      prev.map((s) =>
        s.probe.id === probeId
          ? { ...s, attempts: s.attempts + 1, mastered: s.mastered || masteryPassed, lastScore: score }
          : s,
      ),
    );
  }

  function handleSelect(probeId: string) {
    setActiveProbeId(probeId);
  }

  function handleBack() {
    setActiveProbeId(null);
  }

  return (
    <div className="socratic-view">
      <div className="socratic-header">
        <h2>Socratic Practice</h2>
        <p className="socratic-subtitle">
          Free-text {domain.name} knowledge assessment. The Mentor evaluates your
          responses against expected concepts and guides you toward mastery without
          giving answers.
        </p>
        <div className="socratic-header-row">
          <div className="socratic-progress">
            {masteredCount} / {sessions.length} topics mastered
            {masteredCount === sessions.length && (
              <span className="all-mastered"> — All topics complete ✓</span>
            )}
          </div>
          {hasLearnerService && (
            <div className="sim-expertise-picker">
              <span className="sim-expertise-label">🤖 Simulate as:</span>
              {EXPERTISE_LEVELS.map((l) => (
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
          )}
        </div>
      </div>

      {activeSession ? (
        <ProbePanel
          session={activeSession}
          onBack={handleBack}
          onAttempt={handleAttempt}
          expertiseLevel={expertiseLevel}
        />
      ) : (
        <TopicGrid sessions={sessions} onSelect={handleSelect} />
      )}
    </div>
  );
}
