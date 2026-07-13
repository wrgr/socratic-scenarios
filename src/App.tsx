/** App entry — AJP / EDDIE demo only. */
import { useState } from 'react';
import { InOperationView } from './components/InOperationView';
import { SocraticView } from './components/SocraticView';
import { RetrievalLabView } from './components/RetrievalLabView';
import { RagCoverageView } from './components/RagCoverageView';
import { AboutView } from './components/AboutView';
import { ArchitectureView } from './components/ArchitectureView';
import { AjpWorkflowDemo } from './components/AjpWorkflowDemo';
import { ScenarioView } from './components/ScenarioView';
import { HudDashboard } from './components/HudDashboard';
import { WelcomeScreen } from './components/WelcomeScreen';
import { getActiveDomain } from './domains/domain-context';
import { persistActiveDomainId } from './domains/registry';
import type { DomainId } from './types';
import { setEmbeddingProvider } from './engine/retrieval';
import { createGeminiProvider } from './engine/retrieval/gemini-provider';
import { createSimulatedProvider } from './engine/retrieval/simulated-provider';
import { setMentorService, createMentorService } from './engine/mentor';
import { setSimulatedLearnerService, createSimulatedLearnerService } from './engine/simulated-learner';
import { setPromptEnricher, createPromptEnricher } from './engine/prompt-enhancer';
import { createSimulatedEnricher } from './engine/prompt-enhancer/simulated-enricher';
import { resolveGeminiKey } from './hooks/useApiKey';
import { ApiKeySettings } from './components/ApiKeySettings';
import { useOperatorMode } from './hooks/useOperatorMode';
import type { OperatorMode } from './hooks/useOperatorMode';
import { loadGateStatus, pendingCriticalGates } from './hooks/useSafetyGates';
import './App.css';

// Embedding provider mode:
// - simulated: always local deterministic provider
// - gemini: force Gemini (falls back to simulated if key missing)
// - auto (default): Gemini when key exists, otherwise simulated
//
// Key resolution: localStorage (set via the gear icon) → VITE_GEMINI_API_KEY env (dev fallback).
// See src/hooks/useApiKey.ts.
const embeddingMode = (import.meta.env.VITE_EMBEDDING_PROVIDER as string | undefined)?.toLowerCase() ?? 'auto';
const geminiKey = resolveGeminiKey();

if (embeddingMode === 'simulated') {
  setEmbeddingProvider(createSimulatedProvider());
} else if (embeddingMode === 'gemini' || embeddingMode === 'auto') {
  if (geminiKey) {
    setEmbeddingProvider(createGeminiProvider(geminiKey));
  } else {
    setEmbeddingProvider(createSimulatedProvider());
  }
} else {
  setEmbeddingProvider(createSimulatedProvider());
}

if (geminiKey) {
  setMentorService(createMentorService(geminiKey));
  setSimulatedLearnerService(createSimulatedLearnerService(geminiKey));
  setPromptEnricher(createPromptEnricher(geminiKey));
} else {
  setPromptEnricher(createSimulatedEnricher());
}

type AjpTab = 'ajp-dashboard' | 'ajp-about' | 'ajp-architecture' | 'ajp-demo' | 'ajp-scenario' | 'ajp-socratic' | 'ajp-reachback' | 'ajp-lab' | 'ajp-rag';

interface NavTabDef {
  id: AjpTab;
  label: string;
  /** Position in the pedagogical sequence (mirrors the dashboard training phases). */
  phase?: string;
  /** Comprehensive training surface — locked while the operator is in high-stress mode. */
  trainingOnly: boolean;
}

// Ordered to match the training sequence on the dashboard: orient (dashboard →
// about → architecture) → practice concepts → apply in scenarios → observe the
// full loop → operate → inspect. About/Architecture are context surfaces, locked
// in high-stress mode so only the dashboard + reachback stay reachable.
const NAV_TABS: readonly NavTabDef[] = [
  { id: 'ajp-dashboard', label: 'Dashboard', trainingOnly: false },
  { id: 'ajp-about', label: 'About', trainingOnly: true },
  { id: 'ajp-architecture', label: 'Architecture', trainingOnly: true },
  { id: 'ajp-socratic', label: 'Socratic Practice', phase: '01', trainingOnly: true },
  { id: 'ajp-scenario', label: 'Scenario Mode', phase: '02', trainingOnly: true },
  { id: 'ajp-demo', label: 'Workflow Demo', phase: '03', trainingOnly: true },
  { id: 'ajp-reachback', label: 'Reachback Lookup', phase: '04', trainingOnly: false },
  { id: 'ajp-lab', label: 'Retrieval Lab', trainingOnly: true },
  { id: 'ajp-rag', label: 'RAG Coverage', trainingOnly: true },
];

function isTrainingOnly(tab: AjpTab): boolean {
  return NAV_TABS.find((t) => t.id === tab)?.trainingOnly ?? false;
}

/** Interstitial shown when Scenario Mode is opened with critical safety gates unverified. */
function GateInterstitial({ onBack }: { onBack: () => void }) {
  const pending = pendingCriticalGates(loadGateStatus());
  return (
    <div className="gate-interstitial" role="alert">
      <h2>Critical safety gates not verified</h2>
      <p>
        Scenario Mode simulates live HD2 operation. Verify the remaining critical gates on the
        mission brief before starting a run:
      </p>
      <ul>
        {pending.map((g) => (
          <li key={g.id}>
            <strong>{g.label}</strong> — {g.detail}
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary" onClick={onBack}>
        Open mission brief to verify gates
      </button>
    </div>
  );
}

// Whether the user has entered a domain this session. Persisted in
// sessionStorage so in-session reloads skip the welcome screen, but a fresh
// tab always lands on it — matching the "welcome → choose a domain → workflows"
// flow. "Change domain" clears it.
const ENTERED_KEY = 'teachme-entered';

function readEntered(): boolean {
  try {
    return sessionStorage.getItem(ENTERED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEntered(entered: boolean): void {
  try {
    sessionStorage.setItem(ENTERED_KEY, entered ? '1' : '0');
  } catch {
    /* ignore persistence failures */
  }
}

function App() {
  const [view, setView] = useState<'welcome' | 'app'>(() => (readEntered() ? 'app' : 'welcome'));
  const [ajpTab, setAjpTab] = useState<AjpTab>('ajp-dashboard');
  const [mode, setMode] = useOperatorMode();

  // Boot installed the active domain before render (main.tsx), so this is safe.
  const activeDomain = getActiveDomain();

  function enterDomain(id: DomainId) {
    writeEntered(true);
    if (id === activeDomain.id) {
      // Already the booted domain — just reveal the app.
      setView('app');
    } else {
      // A different domain needs a fresh boot (graph rebind + corpus reload).
      persistActiveDomainId(id);
      window.location.reload();
    }
  }

  function changeDomain() {
    writeEntered(false);
    setView('welcome');
  }

  function navigate(tab: AjpTab) {
    if (mode === 'high-stress' && isTrainingOnly(tab)) return;
    setAjpTab(tab);
  }

  function switchMode(next: OperatorMode) {
    setMode(next);
    // Entering high-stress from a locked surface drops straight to reachback —
    // the one surface built for an operator under load.
    if (next === 'high-stress' && isTrainingOnly(ajpTab)) {
      setAjpTab('ajp-reachback');
    }
  }

  const highStress = mode === 'high-stress';
  const scenarioGatesPending =
    ajpTab === 'ajp-scenario' && pendingCriticalGates(loadGateStatus()).length > 0;

  return (
    <div className="app-shell">
      <header className="app-masthead" role="banner">
        <div className="app-masthead-inner">
          <div className="app-masthead-mark">
            <span className="app-masthead-mark-dot" aria-hidden="true" />
            <span className="app-masthead-mark-text">TeachMe</span>
          </div>
          <div className="app-masthead-divider" aria-hidden="true" />
          <h1 className="app-masthead-title">
            {view === 'app' ? (
              <>
                {activeDomain.instantiation}{' '}
                <span className="app-masthead-title-sub">{activeDomain.subtitle}</span>
              </>
            ) : (
              <span className="app-masthead-title-sub">Adaptive Technical Training</span>
            )}
          </h1>
          <span className="app-masthead-badge">Research Prototype</span>
          {view === 'app' && (
            <button
              type="button"
              className="app-masthead-domain-btn"
              onClick={changeDomain}
              title="Return to the welcome screen to switch domains"
            >
              ⇦ Change domain
            </button>
          )}
          <ApiKeySettings />
        </div>
      </header>
      {view === 'welcome' ? (
        <WelcomeScreen onEnterDomain={enterDomain} />
      ) : (
      <section className={`ajp-mode-shell ${highStress ? 'ajp-mode-shell--high-stress' : ''}`}>
        <div className="mode-shell-toolbar">
          <nav className="app-sub-nav" aria-label="Training surfaces">
            {NAV_TABS.map((tab) => {
              const locked = highStress && tab.trainingOnly;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-tab ${ajpTab === tab.id ? 'active' : ''} ${locked ? 'nav-tab--locked' : ''}`}
                  onClick={() => navigate(tab.id)}
                  disabled={locked}
                  title={locked ? 'Locked in high-stress mode — comprehensive training is paused to limit cognitive load' : undefined}
                >
                  {tab.phase && <span className="nav-tab-phase">{tab.phase}</span>}
                  {tab.label}
                  {locked && <span className="nav-tab-lock" aria-hidden="true">🔒</span>}
                </button>
              );
            })}
          </nav>
          <div className="operator-mode-toggle" role="group" aria-label="Operator state">
            <span className="operator-mode-label">Operator state</span>
            <button
              type="button"
              className={`operator-mode-btn ${!highStress ? 'operator-mode-btn--active' : ''}`}
              onClick={() => switchMode('training')}
              aria-pressed={!highStress}
            >
              Training
            </button>
            <button
              type="button"
              className={`operator-mode-btn operator-mode-btn--stress ${highStress ? 'operator-mode-btn--active' : ''}`}
              onClick={() => switchMode('high-stress')}
              aria-pressed={highStress}
            >
              High-stress ops
            </button>
          </div>
        </div>
        {highStress && (
          <div className="high-stress-banner" role="status">
            <span className="high-stress-banner-dot" aria-hidden="true" />
            <p>
              <strong>High-stress mode.</strong> Comprehensive training is paused to keep
              extraneous cognitive load low. Corpus-bound Reachback Lookup and the mission
              brief remain available; stand down to Training to resume the full sequence.
            </p>
            <button type="button" className="high-stress-standdown" onClick={() => switchMode('training')}>
              Stand down
            </button>
          </div>
        )}
        <div className="ajp-content-surface">
          {ajpTab === 'ajp-dashboard' ? (
            <HudDashboard onNavigate={navigate} mode={mode} />
          ) : ajpTab === 'ajp-about' ? (
            <AboutView />
          ) : ajpTab === 'ajp-architecture' ? (
            <ArchitectureView />
          ) : ajpTab === 'ajp-demo' ? (
            <AjpWorkflowDemo />
          ) : ajpTab === 'ajp-reachback' ? (
            <InOperationView />
          ) : ajpTab === 'ajp-socratic' ? (
            <SocraticView />
          ) : ajpTab === 'ajp-lab' ? (
            <RetrievalLabView />
          ) : ajpTab === 'ajp-rag' ? (
            <RagCoverageView />
          ) : scenarioGatesPending ? (
            <GateInterstitial onBack={() => setAjpTab('ajp-dashboard')} />
          ) : (
            <ScenarioView
              profile={{ id: 'standalone', conceptProficiencies: {}, interactionHistory: [], assignedCondition: 'unassigned' }}
              onAdvancePhase={() => { /* standalone mode — no experiment phase to advance */ }}
            />
          )}
        </div>
      </section>
      )}
    </div>
  );
}

export default App;
