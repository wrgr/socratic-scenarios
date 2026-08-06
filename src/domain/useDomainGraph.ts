/**
 * useDomainGraph — a GraphView scoped to the active domain, for domain-correct retrieval.
 *
 * Replaces the identical `useMemo(() => graphViewForDomain(domain), [domain])` that was
 * copy-pasted across SocraticView / ScenarioView / AjpWorkflowDemo. graphViewForDomain
 * caches by descriptor, so every caller shares one stable view per domain.
 */
import { useMemo } from 'react';
import { useDomain } from './useDomain';
import { graphViewForDomain } from '../engine/retrieval/retrieval-router';
import type { GraphView } from '../engine/retrieval/graph-utils';

export function useDomainGraph(): GraphView {
  const { domain } = useDomain();
  return useMemo(() => graphViewForDomain(domain), [domain]);
}
