/** App entry — pluggable teaching domains (AJP / EDDIE, COLREG, roadside tire). */
import { useState } from 'react';
import { InOperationView } from './components/InOperationView';
import { SocraticView } from './components/SocraticView';
import { RetrievalLabView } from './components/RetrievalLabView';
import { RagCoverageView } from './components/RagCoverageView';
import { ArchitectureView } from './components/ArchitectureView';
import { PedagogyDrawer } from './components/PedagogyDrawer';
import { AjpWorkflowDemo } from './components/AjpWorkflowDemo';
import { ScenarioView } from './components/ScenarioView';
import { HudDashboard } from './components/HudDashboard';
import { ColregSimulator } from './components/ColregSimulator';
import { WelcomeScreen } from './components/WelcomeScreen';
import { DomainProvider } from './domain/DomainContext';
import { useDomain } from './domain/useDomain';
import type { DomainId } from './types';
import { setEmbeddingProvider } from './engine/retrieval';
import { createGeminiProvider } from './engine/retrieval/gemini-provider';
import { createSimulatedProvider } from './engine/retrieval/simulated-provider';
import { setMentorService, createMentorService } from './engine/mentor';
import { setSimulatedLearnerService, createSimulatedLearnerService } from './engine/simulated-learner';
import { setPromptEnricher, createPromptEnricher } from './engine/prompt-enhancer';
import { createSimulatedEnricher } from './engine/prompt-enhancer/simulated-enricher';
import { createGeminiChatProvider } from './engine/llm/gemini-chat-provider';
import { createGithubModelsChatProvider } from './engine/llm/github-models-provider';
import type { ChatCompletionProvider } from './engine/llm/types';
import { resolveGeminiKey, resolveGithubModelsToken } from './hooks/useApiKey';
import { ApiKeySettings } from './components/ApiKeySettings';
import { WHITEPAPER_URL } from './components/ajp-background-model.data';
import { useOperatorMode } from './hooks/useOperatorMode';
import type { OperatorMode } from './hooks/useOperatorMode';
import { loadGateStatus, pendingCriticalGates } from './hooks/useSafetyGates';
// Registers every teaching domain (AJP, COLREG, tire) into the corpus registry
// before the DomainProvider mounts. Import for side effects.
import './corpus/domains';
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

// Chat-completion provider mode (mentor evaluation, prompt enrichment, simulated
// learner — NOT embeddings, which stay Gemini-only per embeddingMode above):
// - gemini: force Gemini (no fallback)
// - github: force GitHub Models (no fallback)
// - auto (default): Gemini when a key exists, else GitHub Models when a token
//   exists, else simulated/no-op fallbacks
//
// GitHub Models token resolution mirrors the Gemini key: localStorage (gear icon)
// → VITE_GITHUB_MODELS_TOKEN env (dev fallback). See src/hooks/useApiKey.ts.
const llmProviderMode = (import.meta.env.VITE_LLM_PROVIDER as string | undefined)?.toLowerCase() ?? 'auto';
const githubModelsToken = resolveGithubModelsToken();

function resolveChatProvider(): ChatCompletionProvider | null {
  if (llmProviderMode === 'gemini') return geminiKey ? createGeminiChatProvider(geminiKey) : null;
  if (llmProviderMode === 'github') return githubModelsToken ? createGithubModelsChatProvider(githubModelsToken) : null;
  if (geminiKey) return createGeminiChatProvider(geminiKey);
  if (githubModelsToken) return createGithubModelsChatProvider(githubModelsToken);
  return null;
}

const chatProvider = resolveChatProvider();

if (chatProvider) {
  setMentorService(createMentorService(chatProvider));
  setSimulatedLearnerService(createSimulatedLearnerService(chatProvider));
  setPromptEnricher(createPromptEnricher(chatProvider));
} else {
  setPromptEnricher(createSimulatedEnricher());
}

type AjpTab =
  | 'ajp-dashboard'
  | 'ajp-architecture'
  | 'ajp-demo'
  | 'ajp-scenario'
  | 'ajp-socratic'
  | 'ajp-reachback'
  | 'ajp-lab'
  | 'ajp-rag'
  | 'colreg-sim';

interface NavTabDef {
  id: AjpTab;
  label: string;
  /** Position in the pedagogical sequence (mirrors the dashboard training phases). */
  phase?: string;
  /** Comprehensive training surface — locked while the operator is in high-stress mode. */
  trainingOnly: boolean;
  /**
   * Rendered as a pill in the top nav bar. The four training-phase destinations
   * are deliberately NOT shown here — they'd just duplicate the Dashboard's own
   * "Training Sequence" card, which already links to the same tabs with richer,
   * expandable descriptions. They stay fully reachable (and still correctly
   * locked in high-stress mode via trainingOnly below, checked against the full
   * list, not this filtered one) from there.
   */
  showInTopNav: boolean;
  /**
   * Requires the full retrieval engine (AJP only). These surfaces depend on the
   * engine's baked knowledge graph and dense corpus, so they are hidden for the
   * lighter pluggable domains (COLREG, tire) that ride only the
   * Scenario / Socratic / Dashboard paradigm.
   */
  fullEngineOnly: boolean;
}

// Ordered to match the training sequence on the dashboard: orient (dashboard →
// architecture) → practice concepts → apply in scenarios → observe the
// full loop → operate → inspect. Architecture is a context surface, locked
// in high-stress mode so only the dashboard + reachback stay reachable.
// Mission/Pedagogy/AI Rationale (formerly an "About" tab here) now lives in the
// global PedagogyDrawer, reachable from the masthead on every screen instead.
const NAV_TABS: readonly NavTabDef[] = [
  { id: 'ajp-dashboard', label: 'Dashboard', trainingOnly: false, showInTopNav: true, fullEngineOnly: false },
  { id: 'ajp-architecture', label: 'Architecture', trainingOnly: true, showInTopNav: true, fullEngineOnly: true },
  { id: 'ajp-socratic', label: 'Socratic Practice', phase: '01', trainingOnly: true, showInTopNav: false, fullEngineOnly: false },
  { id: 'ajp-scenario', label: 'Scenario Mode', phase: '02', trainingOnly: true, showInTopNav: false, fullEngineOnly: false },
  { id: 'ajp-demo', label: 'Workflow Demo', phase: '03', trainingOnly: true, showInTopNav: false, fullEngineOnly: true },
  { id: 'ajp-reachback', label: 'Reachback Lookup', phase: '04', trainingOnly: false, showInTopNav: false, fullEngineOnly: true },
  { id: 'ajp-lab', label: 'Retrieval Lab', trainingOnly: true, showInTopNav: true, fullEngineOnly: true },
  { id: 'ajp-rag', label: 'RAG Coverage', trainingOnly: true, showInTopNav: true, fullEngineOnly: true },
  // COLREG kinematic simulator — only for domains that declare hasSimulator.
  { id: 'colreg-sim', label: 'Simulator', trainingOnly: true, showInTopNav: true, fullEngineOnly: false },
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

function AppShell() {
  // The active teaching domain (COLREG, AJP, tire) comes from the corpus
  // registry via the DomainProvider. It drives Scenario Mode, Socratic Practice,
  // the Dashboard, and the Simulator.
  const { domain, domainId, setDomainId } = useDomain();
  const [view, setView] = useState<'welcome' | 'app'>(() => (readEntered() ? 'app' : 'welcome'));
  const [ajpTab, setAjpTab] = useState<AjpTab>('ajp-dashboard');
  const [mode, setMode] = useOperatorMode();
  // Sibling to ajpTab, not a tab itself — an overlay reachable from every
  // screen (including the pre-dashboard Welcome screen) via the masthead
  // trigger, so opening/closing it never disturbs the active tab.
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Only AJP rides the full retrieval engine; the lighter domains (COLREG, tire)
  // ride the Scenario / Socratic / Dashboard paradigm only.
  const fullEngine = domain.fullEngine === true;

  // A tab is available in the current domain when its engine requirement is met
  // and — for the simulator — the domain declares one.
  function tabAvailable(tab: AjpTab): boolean {
    if (tab === 'colreg-sim') return domain.hasSimulator === true;
    const def = NAV_TABS.find((t) => t.id === tab);
    if (def?.fullEngineOnly && !fullEngine) return false;
    return true;
  }

  function enterDomain(id: DomainId) {
    writeEntered(true);
    setDomainId(id);
    // A different domain may not offer the current tab — land on the dashboard,
    // which every domain has.
    setAjpTab('ajp-dashboard');
    setView('app');
  }

  function changeDomain() {
    writeEntered(false);
    setView('welcome');
  }

  function navigate(tab: AjpTab) {
    if (!tabAvailable(tab)) return;
    if (mode === 'high-stress' && isTrainingOnly(tab)) return;
    setAjpTab(tab);
  }

  // Masthead logo → app home. Inside the app that's the Dashboard (mission
  // brief); it stays reachable in high-stress mode, so no gate needed. Any open
  // overlay is dismissed so "home" always lands somewhere clean. On the Welcome
  // screen we're already at the landing, so this is a no-op there.
  function goHome() {
    setDrawerOpen(false);
    if (view === 'app') setAjpTab('ajp-dashboard');
  }

  function switchMode(next: OperatorMode) {
    setMode(next);
    // Entering high-stress from a locked surface drops straight to reachback —
    // the one surface built for an operator under load (AJP only). Domains
    // without it fall back to the dashboard.
    if (next === 'high-stress' && isTrainingOnly(ajpTab)) {
      setAjpTab(fullEngine ? 'ajp-reachback' : 'ajp-dashboard');
    }
  }

  const highStress = mode === 'high-stress';
  const scenarioGatesPending =
    fullEngine && ajpTab === 'ajp-scenario' && pendingCriticalGates(loadGateStatus()).length > 0;

  // If a domain switch left the active tab unavailable, fall back to the
  // dashboard so the content surface never renders an unavailable tab.
  const activeTab: AjpTab = tabAvailable(ajpTab) ? ajpTab : 'ajp-dashboard';

  return (
    <div className="app-shell">
      <header className="app-masthead" role="banner">
        <div className="app-masthead-inner">
          <button
            type="button"
            className="app-masthead-mark"
            onClick={goHome}
            aria-label={view === 'app' ? 'TeachMe — return to dashboard' : 'TeachMe home'}
            title="Home"
          >
            <span className="app-masthead-mark-dot" aria-hidden="true" />
            <span className="app-masthead-mark-text">TeachMe</span>
          </button>
          <div className="app-masthead-divider" aria-hidden="true" />
          <h1 className="app-masthead-title">
            {view === 'app' ? (
              <>
                {domain.name}{' '}
                <span className="app-masthead-title-sub">{domain.masthead}</span>
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
          <button
            type="button"
            className={`app-masthead-pedagogy-btn ${view === 'app' && highStress ? 'app-masthead-pedagogy-btn--locked' : ''}`}
            onClick={() => setDrawerOpen(true)}
            disabled={view === 'app' && highStress}
            title={
              view === 'app' && highStress
                ? 'Locked in high-stress mode — comprehensive training is paused to limit cognitive load'
                : 'Mission, pedagogy, and AI rationale'
            }
          >
            Mission &amp; Pedagogy
            {view === 'app' && highStress && <span className="app-masthead-pedagogy-lock" aria-hidden="true">🔒</span>}
          </button>
          <a
            className="app-masthead-pedagogy-btn"
            href="posters/"
            target="_blank"
            rel="noopener"
            title="Open-house posters and presenter notes (PDF + PowerPoint)"
          >
            Posters
          </a>
          <ApiKeySettings />
        </div>
      </header>
      {view === 'welcome' ? (
        <WelcomeScreen onEnterDomain={enterDomain} />
      ) : (
      <section className={`ajp-mode-shell ${highStress ? 'ajp-mode-shell--high-stress' : ''}`} key={domainId}>
        <div className="mode-shell-toolbar">
          <nav className="app-sub-nav" aria-label="Training surfaces">
            {NAV_TABS.filter((tab) => tab.showInTopNav && tabAvailable(tab.id)).map((tab) => {
              const locked = highStress && tab.trainingOnly;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`nav-tab ${activeTab === tab.id ? 'active' : ''} ${locked ? 'nav-tab--locked' : ''}`}
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
          {activeTab === 'ajp-dashboard' ? (
            <HudDashboard onNavigate={navigate} mode={mode} />
          ) : activeTab === 'ajp-architecture' ? (
            <ArchitectureView />
          ) : activeTab === 'ajp-demo' ? (
            <AjpWorkflowDemo />
          ) : activeTab === 'ajp-reachback' ? (
            <InOperationView />
          ) : activeTab === 'ajp-socratic' ? (
            <SocraticView />
          ) : activeTab === 'ajp-lab' ? (
            <RetrievalLabView />
          ) : activeTab === 'ajp-rag' ? (
            <RagCoverageView />
          ) : activeTab === 'colreg-sim' ? (
            <ColregSimulator />
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
      <footer className="app-footer">
        <div className="app-footer-inner">
          <span className="app-footer-note">Research prototype · not for operational use without expert review.</span>
          {view === 'app' && highStress ? (
            <span
              className="app-footer-whitepaper app-footer-whitepaper--locked"
              title="Locked in high-stress mode — comprehensive training is paused to limit cognitive load"
            >
              TeachMe AJP — full system whitepaper (PDF)
              <span className="app-masthead-pedagogy-lock" aria-hidden="true">🔒</span>
            </span>
          ) : (
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer" className="app-footer-whitepaper">
              TeachMe AJP — full system whitepaper (PDF) ↗
            </a>
          )}
        </div>
      </footer>
      <PedagogyDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function App() {
  // AJP is the flagship domain (fullEngine); it boots first so the app opens on it.
  return (
    <DomainProvider defaultDomainId="ajp-electronics-repair">
      <AppShell />
    </DomainProvider>
  );
}

export default App;
