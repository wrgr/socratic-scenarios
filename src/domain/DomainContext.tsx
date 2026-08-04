/**
 * Active-domain provider. Holds which teaching domain is selected and supplies its
 * `DomainDescriptor` (via ./useDomain) to Scenario Mode, Socratic Practice, and the
 * Dashboard. Domains must be registered (imported) before this provider mounts —
 * see src/corpus/domains.ts, imported by App.
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { DomainId } from '../types';
import { getDomain, listDomains } from '../corpus/registry';
import { DomainContext, type DomainContextValue } from './useDomain';

export function DomainProvider({
  defaultDomainId,
  children,
}: {
  defaultDomainId?: DomainId;
  children: ReactNode;
}) {
  const domains = useMemo(() => listDomains(), []);
  const [domainId, setDomainId] = useState<DomainId>(
    () => defaultDomainId ?? domains[0]?.id,
  );
  const domain = getDomain(domainId) ?? domains[0];

  const value = useMemo<DomainContextValue>(
    () => ({ domain, domainId, setDomainId, domains }),
    [domain, domainId, domains],
  );

  return <DomainContext.Provider value={value}>{children}</DomainContext.Provider>;
}
