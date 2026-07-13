/**
 * Active-domain singleton — the injection seam that makes the engine
 * domain-agnostic. Set once at boot (src/domains/boot.ts) via setActiveDomain();
 * engine modules read the active domain's data through getActiveDomain() instead
 * of importing a specific domain's corpus. Mirrors the existing provider-service
 * pattern (setEmbeddingProvider / setMentorService / …) used in App.tsx.
 */
import type { DomainConfig } from '../types';

let active: DomainConfig | null = null;

/** Install the active domain. Call once at boot before any retrieval runs. */
export function setActiveDomain(domain: DomainConfig): void {
  active = domain;
}

/** The active domain. Throws if boot never ran — a programming error, not a user path. */
export function getActiveDomain(): DomainConfig {
  if (!active) {
    throw new Error(
      'No active domain set. Call bootActiveDomain() (src/domains/boot.ts) before rendering or retrieval.',
    );
  }
  return active;
}

/** The active domain, or null if boot hasn't run yet. For guards that must not throw. */
export function getActiveDomainOrNull(): DomainConfig | null {
  return active;
}
