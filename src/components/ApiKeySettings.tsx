/**
 * ApiKeySettings — gear button in the masthead that opens a small modal
 * for the user to paste their own Gemini API key and/or GitHub Models token.
 * Both are stored in localStorage via useApiKey/useGithubModelsToken; saving
 * or clearing reloads the page so the provider singletons in App.tsx re-init
 * with the new value.
 */
import { useEffect, useRef, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useApiKey, useGithubModelsToken } from '../hooks/useApiKey';
import { createGithubModelsChatProvider } from '../engine/llm/github-models-provider';

type TestState = 'idle' | 'testing' | 'ok' | 'error';

async function validateGeminiKey(key: string): Promise<{ ok: true; note?: string } | { ok: false; message: string }> {
  try {
    const genai = new GoogleGenerativeAI(key);
    const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await model.generateContent('Reply with exactly: OK');
    const text = result.response.text().trim();
    const note = text.toLowerCase().includes('ok') ? undefined : 'Gemini reachable (unexpected reply).';
    return { ok: true, note };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

async function validateGithubToken(token: string): Promise<{ ok: true; note?: string } | { ok: false; message: string }> {
  try {
    const provider = createGithubModelsChatProvider(token);
    const text = (await provider.complete('You are a test.', 'Reply with exactly: OK')).trim();
    const note = text.toLowerCase().includes('ok') ? undefined : 'GitHub Models reachable (unexpected reply).';
    return { ok: true, note };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}

export function ApiKeySettings() {
  const gemini = useApiKey();
  const github = useGithubModelsToken();
  const [open, setOpen] = useState(false);

  const [geminiDraft, setGeminiDraft] = useState('');
  const [geminiReveal, setGeminiReveal] = useState(false);
  const [geminiTestState, setGeminiTestState] = useState<TestState>('idle');
  const [geminiTestMessage, setGeminiTestMessage] = useState('');
  const geminiValidatedDraftRef = useRef<string | null>(null);

  const [githubDraft, setGithubDraft] = useState('');
  const [githubReveal, setGithubReveal] = useState(false);
  const [githubTestState, setGithubTestState] = useState<TestState>('idle');
  const [githubTestMessage, setGithubTestMessage] = useState('');
  const githubValidatedDraftRef = useRef<string | null>(null);

  const dialogRef = useRef<HTMLDivElement | null>(null);

  const openModal = () => {
    setGeminiDraft(gemini.storedKey ?? '');
    setGeminiReveal(false);
    setGeminiTestState('idle');
    setGeminiTestMessage('');
    setGithubDraft(github.storedKey ?? '');
    setGithubReveal(false);
    setGithubTestState('idle');
    setGithubTestMessage('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const geminiStatus =
    gemini.source === 'user' ? 'User key set'
    : gemini.source === 'env' ? 'Using VITE_GEMINI_API_KEY'
    : 'Simulated mode (no key)';

  const githubStatus =
    github.source === 'user' ? 'User token set'
    : github.source === 'env' ? 'Using VITE_GITHUB_MODELS_TOKEN'
    : 'Not configured';

  const handleGeminiSave = async () => {
    const key = geminiDraft.trim();
    if (!key) return;
    if (geminiValidatedDraftRef.current !== key) {
      setGeminiTestState('testing');
      setGeminiTestMessage('Validating key before saving…');
      const result = await validateGeminiKey(key);
      if (!result.ok) {
        setGeminiTestState('error');
        setGeminiTestMessage(`Key rejected — not saved. ${result.message}`);
        return;
      }
      geminiValidatedDraftRef.current = key;
      setGeminiTestState('ok');
      setGeminiTestMessage(result.note ?? 'Key validated — saving…');
    }
    gemini.save(key);
    window.location.reload();
  };

  const handleGeminiClear = () => {
    gemini.clear();
    window.location.reload();
  };

  const handleGeminiTest = async () => {
    const key = geminiDraft.trim();
    if (!key) return;
    setGeminiTestState('testing');
    setGeminiTestMessage('Testing key…');
    const result = await validateGeminiKey(key);
    if (result.ok) {
      geminiValidatedDraftRef.current = key;
      setGeminiTestState('ok');
      setGeminiTestMessage(result.note ?? 'Key works (Gemini reachable).');
    } else {
      setGeminiTestState('error');
      setGeminiTestMessage(result.message);
    }
  };

  const handleGithubSave = async () => {
    const token = githubDraft.trim();
    if (!token) return;
    if (githubValidatedDraftRef.current !== token) {
      setGithubTestState('testing');
      setGithubTestMessage('Validating token before saving…');
      const result = await validateGithubToken(token);
      if (!result.ok) {
        setGithubTestState('error');
        setGithubTestMessage(`Token rejected — not saved. ${result.message}`);
        return;
      }
      githubValidatedDraftRef.current = token;
      setGithubTestState('ok');
      setGithubTestMessage(result.note ?? 'Token validated — saving…');
    }
    github.save(token);
    window.location.reload();
  };

  const handleGithubClear = () => {
    github.clear();
    window.location.reload();
  };

  const handleGithubTest = async () => {
    const token = githubDraft.trim();
    if (!token) return;
    setGithubTestState('testing');
    setGithubTestMessage('Testing token…');
    const result = await validateGithubToken(token);
    if (result.ok) {
      githubValidatedDraftRef.current = token;
      setGithubTestState('ok');
      setGithubTestMessage(result.note ?? 'Token works (GitHub Models reachable).');
    } else {
      setGithubTestState('error');
      setGithubTestMessage(result.message);
    }
  };

  return (
    <>
      <button
        type="button"
        className="masthead-gear"
        title={`AI provider settings — ${geminiStatus}`}
        aria-label="AI provider settings"
        onClick={openModal}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div className="api-key-modal-backdrop" onClick={() => setOpen(false)}>
          <div
            ref={dialogRef}
            className="api-key-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="api-key-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="api-key-modal-title" className="api-key-modal-title">AI provider settings</h2>

            <section className="api-key-provider-section">
              <h3 className="api-key-provider-title">Gemini API key</h3>
              <p className="api-key-modal-status">
                <span className={`api-key-status-dot api-key-status-dot--${gemini.source}`} />
                {geminiStatus}
              </p>
              <p className="api-key-modal-help">
                Paste your own key to enable Gemini-powered embeddings, mentor evaluation, and prompt enrichment. The key stays in your browser&apos;s localStorage and is never sent anywhere except Google&apos;s API.
              </p>
              <p className="api-key-modal-help">
                Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. Without a key, the app runs in simulated mode (deterministic local provider) unless a GitHub Models token is set below.
              </p>

              <label className="api-key-field-label" htmlFor="api-key-input">API key</label>
              <div className="api-key-input-row">
                <input
                  id="api-key-input"
                  className="api-key-input"
                  type={geminiReveal ? 'text' : 'password'}
                  placeholder="AIza…"
                  value={geminiDraft}
                  onChange={(e) => setGeminiDraft(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="api-key-reveal-btn"
                  onClick={() => setGeminiReveal((v) => !v)}
                  aria-label={geminiReveal ? 'Hide key' : 'Reveal key'}
                >
                  {geminiReveal ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="api-key-modal-actions">
                <button
                  type="button"
                  className="api-key-btn api-key-btn--ghost"
                  onClick={handleGeminiClear}
                  disabled={!gemini.storedKey}
                >
                  Clear stored key
                </button>
                <p className={`api-key-test-status api-key-test-status--${geminiTestState}`} aria-live="polite">
                  {geminiTestMessage}
                </p>
                <div className="api-key-actions-right">
                  <button
                    type="button"
                    className="api-key-btn"
                    onClick={() => void handleGeminiTest()}
                    disabled={!geminiDraft.trim() || geminiTestState === 'testing'}
                  >
                    Test key
                  </button>
                  <button
                    type="button"
                    className="api-key-btn api-key-btn--primary"
                    onClick={() => void handleGeminiSave()}
                    disabled={!geminiDraft.trim() || geminiDraft.trim() === gemini.storedKey || geminiTestState === 'testing'}
                  >
                    {geminiTestState === 'testing' ? 'Validating…' : 'Save & reload'}
                  </button>
                </div>
              </div>
            </section>

            <section className="api-key-provider-section">
              <h3 className="api-key-provider-title">GitHub Models token (free-tier alternative)</h3>
              <p className="api-key-modal-status">
                <span className={`api-key-status-dot api-key-status-dot--${github.source}`} />
                {githubStatus}
              </p>
              <p className="api-key-modal-help">
                Paste a GitHub personal access token to enable GitHub Models as a free chat-completion
                provider for mentor evaluation, prompt enrichment, and the simulated learner — useful
                when Gemini&apos;s free tier is rate-limited. Embeddings still require a Gemini key.
              </p>
              <p className="api-key-modal-help">
                Create a token at <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">github.com/settings/tokens</a> (no special scopes required for the public models endpoint).
              </p>

              <label className="api-key-field-label" htmlFor="github-token-input">GitHub token</label>
              <div className="api-key-input-row">
                <input
                  id="github-token-input"
                  className="api-key-input"
                  type={githubReveal ? 'text' : 'password'}
                  placeholder="ghp_…"
                  value={githubDraft}
                  onChange={(e) => setGithubDraft(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="api-key-reveal-btn"
                  onClick={() => setGithubReveal((v) => !v)}
                  aria-label={githubReveal ? 'Hide token' : 'Reveal token'}
                >
                  {githubReveal ? 'Hide' : 'Show'}
                </button>
              </div>

              <div className="api-key-modal-actions">
                <button
                  type="button"
                  className="api-key-btn api-key-btn--ghost"
                  onClick={handleGithubClear}
                  disabled={!github.storedKey}
                >
                  Clear stored token
                </button>
                <p className={`api-key-test-status api-key-test-status--${githubTestState}`} aria-live="polite">
                  {githubTestMessage}
                </p>
                <div className="api-key-actions-right">
                  <button
                    type="button"
                    className="api-key-btn"
                    onClick={() => void handleGithubTest()}
                    disabled={!githubDraft.trim() || githubTestState === 'testing'}
                  >
                    Test token
                  </button>
                  <button
                    type="button"
                    className="api-key-btn api-key-btn--primary"
                    onClick={() => void handleGithubSave()}
                    disabled={!githubDraft.trim() || githubDraft.trim() === github.storedKey || githubTestState === 'testing'}
                  >
                    {githubTestState === 'testing' ? 'Validating…' : 'Save & reload'}
                  </button>
                </div>
              </div>
            </section>

            <div className="api-key-modal-footer">
              <button type="button" className="api-key-btn" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
