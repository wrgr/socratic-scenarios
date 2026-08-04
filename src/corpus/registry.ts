/**
 * Domain registry — the pluggable-domain lookup the AJP `index.ts` comment always
 * claimed existed. Each domain module calls `registerDomain` on import; the UI
 * reads the registered set via `listDomains` / `getDomain`.
 *
 * Node-lookup helpers (`findProbe` / `findConsequence` / `findNode`) search across
 * ALL registered domains. Node ids are globally unique (enforced by the corpus
 * integrity tests), so a scenario step can resolve its referenced probe /
 * consequence / gate node without the caller knowing which domain owns it.
 */
import type { AJPNode } from '../types/ajp';
import type { DomainId } from '../types';
import type { DomainDescriptor } from './types';
import type { ConsequenceNode } from './ajp/consequences';

const registry = new Map<DomainId, DomainDescriptor>();

/** Register (or replace) a domain descriptor. Idempotent per id. */
export function registerDomain(descriptor: DomainDescriptor): DomainDescriptor {
  registry.set(descriptor.id, descriptor);
  return descriptor;
}

/** All registered domains, in registration order. */
export function listDomains(): DomainDescriptor[] {
  return [...registry.values()];
}

/** Look up a domain descriptor by id. */
export function getDomain(id: DomainId): DomainDescriptor | undefined {
  return registry.get(id);
}

/** Find a probe node by id across every registered domain. */
export function findProbe(id: string): AJPNode | undefined {
  for (const d of registry.values()) {
    const hit = d.probes.find((p) => p.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Find a consequence node by id across every registered domain. */
export function findConsequence(id: string): ConsequenceNode | undefined {
  for (const d of registry.values()) {
    const hit = d.consequences.find((c) => c.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Find any graph/probe/consequence node by id across every registered domain. */
export function findNode(id: string): AJPNode | undefined {
  for (const d of registry.values()) {
    const hit =
      d.nodes.find((n) => n.id === id) ??
      d.probes.find((n) => n.id === id) ??
      d.consequences.find((n) => n.id === id);
    if (hit) return hit;
  }
  return undefined;
}
