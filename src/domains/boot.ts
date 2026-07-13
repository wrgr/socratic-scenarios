/**
 * Domain boot — resolve the active domain and wire it into the engine.
 * Called once at startup (main.tsx) before render, and in test setup, so that
 * getActiveDomain() and the retrieval graph are ready before any component or
 * retrieval strategy runs.
 */
import type { DomainConfig } from '../types';
import { getDomain, resolveActiveDomainId } from './registry';
import { setActiveDomain } from './domain-context';
import { bindDomainGraph } from '../engine/retrieval/graph-utils';

/** Resolve, install, and bind the active domain. Returns the chosen config. */
export function bootActiveDomain(): DomainConfig {
  const domain = getDomain(resolveActiveDomainId());
  setActiveDomain(domain);
  bindDomainGraph(domain.graph);
  return domain;
}
