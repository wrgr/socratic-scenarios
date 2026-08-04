/** Heads-up mission brief dashboard — simple ops console entry point for AJP training. */
import { useState, useEffect, useMemo } from 'react';
import type { OperatorMode } from '../hooks/useOperatorMode';
import { SAFETY_GATES, useSafetyGates } from '../hooks/useSafetyGates';
import { loadProbeProgress, summarizeMastery } from '../engine/learner-model/probe-progress';
import { useDomain } from '../domain/useDomain';
import { probeCategory } from './socratic-view.utils';
import '../styles/hud-dashboard.css';

type AjpTab = 'ajp-demo' | 'ajp-scenario' | 'ajp-socratic' | 'ajp-reachback' | 'ajp-lab';

interface HudDashboardProps {
  onNavigate: (tab: AjpTab) => void;
  mode: OperatorMode;
}

const TRAINING_PHASES = [
  {
    tab: 'ajp-socratic' as AjpTab,
    phase: '01',
    label: 'Socratic Practice',
    principle: 'Retrieval practice · ZPD probes',
    description: 'Answer Socratic questions on core AJP concepts. Mentor evaluates and adapts to your current level.',
    trainingOnly: true,
  },
  {
    tab: 'ajp-scenario' as AjpTab,
    phase: '02',
    label: 'Scenario Mode',
    principle: 'Problem-based learning',
    description: 'Diagnose and resolve injected faults in a simulated AJP print run. No recipe — reasoning required. Requires all critical safety gates verified.',
    trainingOnly: true,
  },
  {
    tab: 'ajp-demo' as AjpTab,
    phase: '03',
    label: 'Workflow Demo',
    principle: 'Full evaluation loop',
    description: 'Watch the complete Mentor evaluation loop with a simulated operator at configurable expertise level.',
    trainingOnly: true,
  },
  {
    tab: 'ajp-reachback' as AjpTab,
    phase: '04',
    label: 'Reachback Lookup',
    principle: 'Situated graph search',
    description: 'Search symptom → fault → corrective action graph during live operation. Expert reachback.',
    trainingOnly: false,
  },
] as const;

function useSessionTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
  const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function HudDashboard({ onNavigate, mode }: HudDashboardProps) {
  const { domain } = useDomain();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const { gateStatus, toggleGate } = useSafetyGates();
  const timer = useSessionTimer();
  const highStress = mode === 'high-stress';

  // The AJP safety-gate pre-flight and the retrieval-heavy training phases only
  // apply to the engine-backed AJP domain.
  const showSafetyGates = domain.fullEngine === true;
  const trainingPhases = TRAINING_PHASES.filter(
    (p) => showSafetyGates || p.tab === 'ajp-socratic' || p.tab === 'ajp-scenario',
  );

  // The Mastery Map aggregates real Socratic Practice results per topic category.
  const masteryProbes = useMemo(
    () => domain.probes.map((p) => ({ id: p.id, category: probeCategory(p.id) })),
    [domain],
  );
  // Progress is written by Socratic Practice; the dashboard remounts on every
  // visit (tab switch), so loading once per mount stays current.
  const mastery = useMemo(() => summarizeMastery(masteryProbes, loadProbeProgress()), [masteryProbes]);

  const clearedCount = SAFETY_GATES.filter(g => gateStatus[g.id]).length;
  const totalGates = SAFETY_GATES.length;
  const criticalPending = SAFETY_GATES.filter(g => g.critical && !gateStatus[g.id]).length;
  const systemStatus = criticalPending === 0 ? 'nominal' : clearedCount > 0 ? 'caution' : 'init';

  function toggleCard(id: string) {
    setExpandedCard(prev => (prev === id ? null : id));
  }

  return (
    <div className="hud-root">

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <div className="hud-statusbar">
        <div className="hud-sb-left">
          <span className={`hud-dot hud-dot--${showSafetyGates ? systemStatus : 'nominal'}`} />
          <span className="hud-sb-status">
            {showSafetyGates
              ? (systemStatus === 'nominal' ? 'ALL GATES CLEAR'
                : systemStatus === 'caution' ? `${criticalPending} CRITICAL GATE${criticalPending > 1 ? 'S' : ''} PENDING`
                : 'GATES NOT VERIFIED')
              : 'TRAINING BRIEF'}
          </span>
          {highStress && <span className="hud-badge hud-badge--alert">HIGH-STRESS</span>}
        </div>
        <span className="hud-sb-title">{domain.masthead.toUpperCase()} · MISSION BRIEF</span>
        <div className="hud-sb-right">
          SESSION <span className="hud-timer">{timer}</span>
        </div>
      </div>

      {/* ── High-stress reachback shortcut ─────────────────────────── */}
      {highStress && (
        <div className="hud-stress-strip">
          <div className="hud-stress-strip-text">
            <span className="hud-stress-strip-title">Operating under load</span>
            <span className="hud-stress-strip-sub">
              Training phases are locked. Describe what you observe and get corpus-grounded
              causal chains — no probes, no scaffolding, no detours.
            </span>
          </div>
          <button type="button" className="hud-btn hud-btn--stress" onClick={() => onNavigate('ajp-reachback')}>
            Open Reachback Lookup →
          </button>
        </div>
      )}

      {/* ── Main Cards ─────────────────────────────────────────────── */}
      <div className="hud-grid">

        {/* Safety Gates (AJP engine-backed pre-flight only) */}
        {showSafetyGates && (
        <div className={`hud-card ${expandedCard === 'safety' ? 'hud-card--expanded' : ''}`}>
          <div className="hud-card-head">
            <span className="hud-eyebrow">Safety Gates</span>
            <span className={`hud-badge ${
              criticalPending === 0 ? 'hud-badge--nominal' :
              clearedCount > 0 ? 'hud-badge--caution' : 'hud-badge--dim'
            }`}>
              {clearedCount}/{totalGates} cleared
            </span>
          </div>

          <div className="hud-metric">
            <span className={`hud-metric-big ${criticalPending === 0 ? 'hud-metric-big--nominal' : ''}`}>
              {clearedCount}
            </span>
            <span className="hud-metric-denom">/ {totalGates}</span>
          </div>

          {expandedCard === 'safety' && (
            <div className="hud-detail">
              {SAFETY_GATES.map(gate => (
                <button
                  key={gate.id}
                  type="button"
                  className={`hud-gate-row ${gateStatus[gate.id] ? 'hud-gate-row--clear' : ''}`}
                  onClick={() => toggleGate(gate.id)}
                >
                  <span className={`hud-dot ${gateStatus[gate.id] ? 'hud-dot--nominal' :
                    gate.critical ? 'hud-dot--caution' : 'hud-dot--dim'}`} />
                  <div className="hud-gate-text">
                    <span className="hud-gate-label">{gate.label}</span>
                    <span className="hud-gate-sub">{gate.detail}</span>
                  </div>
                  <span className={`hud-gate-action ${gateStatus[gate.id] ? 'hud-gate-action--clear' : ''}`}>
                    {gateStatus[gate.id] ? 'CLEAR ✓' : gate.critical ? 'VERIFY' : 'CHECK'}
                  </span>
                </button>
              ))}
              <p className="hud-hint">Click each row to mark verified. Critical gates (4) are required before Scenario Mode.</p>
            </div>
          )}

          <div className="hud-card-actions">
            <button type="button" className="hud-btn hud-btn--ghost" onClick={() => toggleCard('safety')}>
              {expandedCard === 'safety' ? 'Collapse ▴' : 'Details ▾'}
            </button>
            {!highStress && (
              <button type="button" className="hud-btn hud-btn--launch" onClick={() => onNavigate('ajp-socratic')}>
                Practice safety →
              </button>
            )}
          </div>
        </div>
        )}

        {/* Mastery Map — live aggregate of Socratic Practice results */}
        <div className={`hud-card ${expandedCard === 'mastery' ? 'hud-card--expanded' : ''}`}>
          <div className="hud-card-head">
            <span className="hud-eyebrow">Mastery Map</span>
            <span className={`hud-badge ${
              mastery.totalMastered === mastery.totalProbes ? 'hud-badge--nominal' :
              mastery.totalAttempted > 0 ? 'hud-badge--caution' : 'hud-badge--dim'
            }`}>
              {mastery.totalMastered === mastery.totalProbes ? 'All mastered' :
               mastery.totalAttempted > 0 ? `${mastery.totalAttempted}/${mastery.totalProbes} attempted` :
               'Not assessed'}
            </span>
          </div>

          <div className="hud-metric">
            {mastery.totalAttempted > 0 ? (
              <>
                <span className={`hud-metric-big ${mastery.totalMastered === mastery.totalProbes ? 'hud-metric-big--nominal' : ''}`}>
                  {mastery.totalMastered}
                </span>
                <span className="hud-metric-denom">/ {mastery.totalProbes}</span>
                <span className="hud-metric-label">probes mastered</span>
              </>
            ) : (
              <>
                <span className="hud-metric-big hud-metric-big--unset">—</span>
                <span className="hud-metric-label">not yet assessed</span>
              </>
            )}
          </div>

          {expandedCard === 'mastery' && (
            <div className="hud-detail">
              {mastery.domains.map(domain => (
                <div key={domain.category} className="hud-domain-row">
                  <span className="hud-domain-label">{domain.category}</span>
                  <div className="hud-bar-track">
                    <div
                      className={`hud-bar-fill ${domain.masteredCount === domain.probeCount ? '' : 'hud-bar-fill--partial'}`}
                      style={{ width: `${Math.round((domain.masteredCount / domain.probeCount) * 100)}%` }}
                    />
                  </div>
                  <span className="hud-domain-count">{domain.masteredCount}/{domain.probeCount}</span>
                </div>
              ))}
              <p className="hud-hint">
                {mastery.totalAttempted > 0
                  ? `Mastered probes per topic. Average best Mentor score ${Math.round((mastery.avgBestScore ?? 0) * 100)}% across ${mastery.totalAttempted} attempted probe${mastery.totalAttempted > 1 ? 's' : ''}.`
                  : `Begin Socratic Practice to track concept mastery across ${mastery.totalProbes} probes.`}
              </p>
            </div>
          )}

          <div className="hud-card-actions">
            <button type="button" className="hud-btn hud-btn--ghost" onClick={() => toggleCard('mastery')}>
              {expandedCard === 'mastery' ? 'Collapse ▴' : 'Details ▾'}
            </button>
            {!highStress && (
              <button type="button" className="hud-btn hud-btn--launch" onClick={() => onNavigate('ajp-socratic')}>
                Build mastery →
              </button>
            )}
          </div>
        </div>

        {/* Training Sequence — spans full width */}
        <div className={`hud-card hud-card--full ${expandedCard === 'path' ? 'hud-card--expanded' : ''}`}>
          <div className="hud-card-head">
            <span className="hud-eyebrow">Training Sequence</span>
            {highStress ? (
              <span className="hud-badge hud-badge--alert">Locked — high-stress mode</span>
            ) : mastery.totalMastered === mastery.totalProbes ? (
              <span className="hud-badge hud-badge--nominal">Phase 01 complete — advance to 02</span>
            ) : mastery.totalAttempted > 0 ? (
              <span className="hud-badge hud-badge--caution">Phase 01 in progress</span>
            ) : (
              <span className="hud-badge hud-badge--dim">Phase 01 available</span>
            )}
          </div>

          <div className="hud-phases">
            {trainingPhases.map((phase) => {
              const locked = highStress && phase.trainingOnly;
              return (
                <div key={phase.tab} className={`hud-phase ${locked ? 'hud-phase--locked' : ''}`}>
                  <span className="hud-phase-num">{phase.phase}</span>
                  <div className="hud-phase-body">
                    <span className="hud-phase-label">{phase.label}</span>
                    <span className="hud-phase-principle">{phase.principle}</span>
                    {expandedCard === 'path' && (
                      <span className="hud-phase-desc">{phase.description}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="hud-btn hud-btn--phase"
                    onClick={() => onNavigate(phase.tab)}
                    disabled={locked}
                    title={locked ? 'Locked in high-stress mode — comprehensive training is paused to limit cognitive load' : undefined}
                  >
                    {locked ? 'Locked 🔒' : 'Launch'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hud-card-actions">
            <button type="button" className="hud-btn hud-btn--ghost" onClick={() => toggleCard('path')}>
              {expandedCard === 'path' ? 'Collapse ▴' : 'Describe each ▾'}
            </button>
            {highStress && (
              <p className="hud-hint hud-hint--inline">
                Cognitive load theory: new instruction on top of live-operation pressure is
                extraneous load. Stand down to Training to resume the sequence.
              </p>
            )}
          </div>
        </div>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="hud-footer">
        <span className="hud-footer-label">Learning science:</span>
        {['Vygotsky ZPD', 'Testing Effect', 'Problem-Based Learning', 'Cognitive Load Theory', 'Situated Learning'].map((item, i, arr) => (
          <span key={item} className="hud-footer-chain">
            <span className="hud-footer-item">{item}</span>
            {i < arr.length - 1 && <span className="hud-footer-sep">·</span>}
          </span>
        ))}
      </div>

    </div>
  );
}
