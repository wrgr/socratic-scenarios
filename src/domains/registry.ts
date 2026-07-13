/**
 * Domain registry — the catalog of selectable use cases and the resolver that
 * picks the active one at boot (URL ?domain= → localStorage → default).
 *
 * Domains are registered statically here. Adding a use case = author its
 * DomainConfig module and add one line to DOMAINS.
 */
import type { DomainConfig, DomainId } from '../types';
import { ajpDomain } from './ajp';

const DOMAIN_STORAGE_KEY = 'teachme-active-domain';
export const DEFAULT_DOMAIN_ID: DomainId = 'ajp';

/** Registered domains. Unregistered ids fall back to the default. */
const DOMAINS: Partial<Record<DomainId, DomainConfig>> = {
  ajp: ajpDomain,
  // 'flat-tire': flatTireDomain,  // added when the proof domain lands
};

/** True if a domain id is currently registered/available. */
export function isRegisteredDomain(id: string): id is DomainId {
  return Object.prototype.hasOwnProperty.call(DOMAINS, id) && DOMAINS[id as DomainId] != null;
}

/** Resolve a domain config by id, falling back to the default. */
export function getDomain(id: DomainId): DomainConfig {
  return DOMAINS[id] ?? DOMAINS[DEFAULT_DOMAIN_ID]!;
}

/** All registered domains, for the picker. */
export function listDomains(): DomainConfig[] {
  return Object.values(DOMAINS).filter((d): d is DomainConfig => d != null);
}

/**
 * Determine the active domain id: URL `?domain=` (also persisted) →
 * localStorage → default. Unknown/unregistered ids fall back to the default.
 */
export function resolveActiveDomainId(): DomainId {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('domain');
    if (fromUrl && isRegisteredDomain(fromUrl)) {
      try {
        localStorage.setItem(DOMAIN_STORAGE_KEY, fromUrl);
      } catch {
        /* ignore persistence failures */
      }
      return fromUrl;
    }
    const fromStorage = localStorage.getItem(DOMAIN_STORAGE_KEY);
    if (fromStorage && isRegisteredDomain(fromStorage)) return fromStorage;
  } catch {
    /* SSR / non-browser context — fall through to default */
  }
  return DEFAULT_DOMAIN_ID;
}

/** Persist a selected domain id (used by the picker before reload). */
export function persistActiveDomainId(id: DomainId): void {
  try {
    localStorage.setItem(DOMAIN_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
