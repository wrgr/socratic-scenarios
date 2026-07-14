/**
 * useApiKey — BYOK ("bring your own key") storage for the Gemini API key and,
 * alongside it, the optional GitHub Models personal access token (an alternative
 * chat-completion provider — see src/engine/llm/github-models-provider.ts).
 *
 * Resolution order for each: localStorage → matching VITE_* env var (dev fallback).
 * When the user saves or clears a key from the settings UI we reload the page
 * so module-level provider singletons in App.tsx pick up the new value cleanly.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'teachme.geminiApiKey';
const GITHUB_STORAGE_KEY = 'teachme.githubModelsToken';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
const githubListeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribeGithub(listener: () => void) {
  githubListeners.add(listener);
  return () => githubListeners.delete(listener);
}

function getSnapshot(): string | null {
  return readStorage(STORAGE_KEY);
}

function getGithubSnapshot(): string | null {
  return readStorage(GITHUB_STORAGE_KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

/** Resolve the active key without reading from localStorage in render. */
export function resolveGeminiKey(): string | undefined {
  const stored = readStorage(STORAGE_KEY);
  if (stored && stored.trim().length > 0) return stored.trim();
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return envKey && envKey.trim().length > 0 ? envKey.trim() : undefined;
}

/** Resolve the active GitHub Models token without reading from localStorage in render. */
export function resolveGithubModelsToken(): string | undefined {
  const stored = readStorage(GITHUB_STORAGE_KEY);
  if (stored && stored.trim().length > 0) return stored.trim();
  const envKey = import.meta.env.VITE_GITHUB_MODELS_TOKEN as string | undefined;
  return envKey && envKey.trim().length > 0 ? envKey.trim() : undefined;
}

export function useApiKey() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const active = stored && stored.trim().length > 0 ? stored.trim() : (envKey?.trim() || null);

  return {
    storedKey: stored,
    activeKey: active,
    source: stored ? 'user' : envKey ? 'env' : 'none' as 'user' | 'env' | 'none',
    save(key: string) {
      const trimmed = key.trim();
      if (!trimmed) return;
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      for (const l of listeners) l();
    },
    clear() {
      window.localStorage.removeItem(STORAGE_KEY);
      for (const l of listeners) l();
    },
  };
}

/** BYOK storage for the GitHub Models token, mirroring useApiKey() above. */
export function useGithubModelsToken() {
  const stored = useSyncExternalStore(subscribeGithub, getGithubSnapshot, getServerSnapshot);
  const envKey = import.meta.env.VITE_GITHUB_MODELS_TOKEN as string | undefined;
  const active = stored && stored.trim().length > 0 ? stored.trim() : (envKey?.trim() || null);

  return {
    storedKey: stored,
    activeKey: active,
    source: stored ? 'user' : envKey ? 'env' : 'none' as 'user' | 'env' | 'none',
    save(token: string) {
      const trimmed = token.trim();
      if (!trimmed) return;
      window.localStorage.setItem(GITHUB_STORAGE_KEY, trimmed);
      for (const l of githubListeners) l();
    },
    clear() {
      window.localStorage.removeItem(GITHUB_STORAGE_KEY);
      for (const l of githubListeners) l();
    },
  };
}
