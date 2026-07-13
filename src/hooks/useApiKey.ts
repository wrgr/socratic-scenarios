/**
 * useApiKey — BYOK ("bring your own key") storage for the Gemini API key.
 *
 * Resolution order: localStorage → VITE_GEMINI_API_KEY env (dev fallback).
 * When the user saves or clears a key from the settings UI we reload the page
 * so module-level provider singletons in App.tsx pick up the new value cleanly.
 */
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'teachme.geminiApiKey';

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return readStorage();
}

function getServerSnapshot(): string | null {
  return null;
}

/** Resolve the active key without reading from localStorage in render. */
export function resolveGeminiKey(): string | undefined {
  const stored = readStorage();
  if (stored && stored.trim().length > 0) return stored.trim();
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
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
