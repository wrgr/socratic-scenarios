/**
 * ApiKeySettings — gear button in the masthead that opens a small modal
 * for the user to paste their own Gemini API key. Stored in localStorage
 * via useApiKey; saving or clearing reloads the page so the provider
 * singletons in App.tsx re-init with the new key.
 */
import { useEffect, useRef, useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useApiKey } from '../hooks/useApiKey';

export function ApiKeySettings() {
  const { storedKey, source, save, clear } = useApiKey();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [reveal, setReveal] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const openModal = () => {
    setDraft(storedKey ?? '');
    setReveal(false);
    setTestState('idle');
    setTestMessage('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const status =
    source === 'user' ? 'User key set'
    : source === 'env' ? 'Using VITE_GEMINI_API_KEY'
    : 'Simulated mode (no key)';

  // The draft that was last successfully validated. Allows Save to skip
  // re-testing if the user already pressed "Test key" on the same value.
  const validatedDraftRef = useRef<string | null>(null);

  async function validateKey(key: string): Promise<{ ok: true; note?: string } | { ok: false; message: string }> {
    try {
      const genai = new GoogleGenerativeAI(key);
      const model = genai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent('Reply with exactly: OK');
      const text = result.response.text().trim();
      const note = text.toLowerCase().includes('ok')
        ? undefined
        : 'Gemini reachable (unexpected reply).';
      return { ok: true, note };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  const handleSave = async () => {
    const key = draft.trim();
    if (!key) return;
    if (validatedDraftRef.current !== key) {
      setTestState('testing');
      setTestMessage('Validating key before saving…');
      const result = await validateKey(key);
      if (!result.ok) {
        setTestState('error');
        setTestMessage(`Key rejected — not saved. ${result.message}`);
        return;
      }
      validatedDraftRef.current = key;
      setTestState('ok');
      setTestMessage(result.note ?? 'Key validated — saving…');
    }
    save(key);
    window.location.reload();
  };

  const handleClear = () => {
    clear();
    window.location.reload();
  };

  const handleTest = async () => {
    const key = draft.trim();
    if (!key) return;
    setTestState('testing');
    setTestMessage('Testing key…');
    const result = await validateKey(key);
    if (result.ok) {
      validatedDraftRef.current = key;
      setTestState('ok');
      setTestMessage(result.note ?? 'Key works (Gemini reachable).');
    } else {
      setTestState('error');
      setTestMessage(result.message);
    }
  };

  return (
    <>
      <button
        type="button"
        className="masthead-gear"
        title={`API key settings — ${status}`}
        aria-label="API key settings"
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
            <h2 id="api-key-modal-title" className="api-key-modal-title">Gemini API key</h2>
            <p className="api-key-modal-status">
              <span className={`api-key-status-dot api-key-status-dot--${source}`} />
              {status}
            </p>
            <p className="api-key-modal-help">
              Paste your own key to enable Gemini-powered embeddings, mentor evaluation, and prompt enrichment. The key stays in your browser&apos;s localStorage and is never sent anywhere except Google&apos;s API.
            </p>
            <p className="api-key-modal-help">
              Get a key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>. Without a key, the app runs in simulated mode (deterministic local provider).
            </p>

            <label className="api-key-field-label" htmlFor="api-key-input">API key</label>
            <div className="api-key-input-row">
              <input
                id="api-key-input"
                className="api-key-input"
                type={reveal ? 'text' : 'password'}
                placeholder="AIza…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="api-key-reveal-btn"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide key' : 'Reveal key'}
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            </div>

            <div className="api-key-modal-actions">
              <button
                type="button"
                className="api-key-btn api-key-btn--ghost"
                onClick={handleClear}
                disabled={!storedKey}
              >
                Clear stored key
              </button>
              <p className={`api-key-test-status api-key-test-status--${testState}`} aria-live="polite">
                {testMessage}
              </p>
              <div className="api-key-actions-right">
                <button
                  type="button"
                  className="api-key-btn"
                  onClick={() => void handleTest()}
                  disabled={!draft.trim() || testState === 'testing'}
                >
                  Test key
                </button>
                <button type="button" className="api-key-btn" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="api-key-btn api-key-btn--primary"
                  onClick={() => void handleSave()}
                  disabled={!draft.trim() || draft.trim() === storedKey || testState === 'testing'}
                >
                  {testState === 'testing' ? 'Validating…' : 'Save & reload'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
