/**
 * Active-domain context object + hook. Kept separate from the provider component
 * (DomainContext.tsx) so the provider file exports only a component — satisfies
 * the react-refresh/only-export-components lint rule.
 */
import { createContext, useContext } from 'react';
import type { DomainId } from '../types';
import type { DomainDescriptor } from '../corpus/types';

export interface DomainContextValue {
  /** The active domain's descriptor. */
  domain: DomainDescriptor;
  domainId: DomainId;
  setDomainId: (id: DomainId) => void;
  /** All registered domains, in registration order. */
  domains: DomainDescriptor[];
}

export const DomainContext = createContext<DomainContextValue | null>(null);

/** Access the active domain. Throws if used outside a DomainProvider. */
export function useDomain(): DomainContextValue {
  const ctx = useContext(DomainContext);
  if (!ctx) throw new Error('useDomain must be used within a DomainProvider');
  return ctx;
}
