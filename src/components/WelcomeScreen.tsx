/**
 * WelcomeScreen — the landing surface shown before entering a domain.
 *
 * Two parts: a short "here's what this is" hero, and a domain picker driven by
 * the pluggable corpus registry (src/corpus/registry). Every registered domain
 * — AJP (flagship), COLREG collision avoidance, roadside tire change — is
 * enterable; a teaser conveys the bring-your-own-domain roadmap.
 *
 * Selecting a domain hands the id back to App, which sets it as the active
 * domain (via the DomainProvider) and reveals the app.
 */
import { listDomains } from '../corpus/registry';
import type { DomainDescriptor } from '../corpus/types';
import type { DomainId } from '../types';

const LEARNING_SCIENCE = [
  'Vygotsky ZPD',
  'Testing Effect',
  'Problem-Based Learning',
  'Cognitive Load Theory',
  'Situated Learning',
] as const;

/** Not-yet-registered domains, shown disabled to convey the roadmap. */
interface UpcomingDomain {
  instantiation: string;
  name: string;
  description: string;
}

const UPCOMING: readonly UpcomingDomain[] = [
  {
    instantiation: 'Your domain',
    name: 'Bring your own equipment',
    description:
      'Any procedurally-structured, safety-critical, transfer-dependent domain can be authored as a knowledge graph + corpus. Clinical procedures, regulated lab work, industrial maintenance.',
  },
] as const;

/** Short chip describing a domain's engine tier. */
function domainTier(domain: DomainDescriptor): string {
  if (domain.fullEngine) return 'Flagship';
  if (domain.hasSimulator) return 'Interactive';
  return 'Graph-driven';
}

export function WelcomeScreen({ onEnterDomain }: { onEnterDomain: (id: DomainId) => void }) {
  const domains = listDomains();

  function scrollToDomains() {
    const el = document.getElementById('welcome-domains');
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }

  return (
    <div className="welcome-screen">
      <section className="welcome-hero">
        <div className="welcome-hero-glow" aria-hidden="true" />
        <div className="welcome-hero-body">
          <span className="welcome-eyebrow">TeachMe · Adaptive Technical Training</span>
          <h1 className="welcome-title">
            Learn the machine, <em>not just the manual.</em>
          </h1>
          <p className="welcome-lead">
            TeachMe is a corpus-bound training system for safety-critical equipment. It doesn&rsquo;t
            just answer questions — it asks them: Socratic probes calibrated to your current level,
            situated fault scenarios, and a narrator that refuses to fabricate.
          </p>
          <div className="welcome-hero-actions">
            <button type="button" className="welcome-hero-cta" onClick={scrollToDomains}>
              Choose a domain <span aria-hidden="true">↓</span>
            </button>
          </div>
          <p className="welcome-science" aria-label="Grounded in learning science">
            <span className="welcome-science-label">Grounded in</span>
            {LEARNING_SCIENCE.map((item, i) => (
              <span key={item} className="welcome-science-term">
                {i > 0 && <span className="welcome-science-sep" aria-hidden="true">·</span>}
                {item}
              </span>
            ))}
          </p>
        </div>
      </section>

      <section id="welcome-domains" className="welcome-domains" aria-label="Choose a domain">
        <div className="welcome-domains-head">
          <h2>Choose a domain</h2>
          <p>Each domain is a corpus-bound instantiation of the same engine.</p>
        </div>
        <div className="welcome-domain-grid">
          {domains.map((domain) => (
            <DomainCard key={domain.id} domain={domain} onEnter={() => onEnterDomain(domain.id)} />
          ))}
          {UPCOMING.map((domain) => (
            <UpcomingCard key={domain.name} domain={domain} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DomainCard({ domain, onEnter }: { domain: DomainDescriptor; onEnter: () => void }) {
  const nodeCount = domain.nodes.length;
  const edgeCount = domain.edges.length;

  return (
    <article className="welcome-domain-card welcome-domain-card--available">
      <div className="welcome-domain-top">
        <span className="welcome-domain-badge">{domainTier(domain)}</span>
        <span className="welcome-domain-status welcome-domain-status--live">Available</span>
      </div>
      <h3 className="welcome-domain-name">{domain.name}</h3>
      <p className="welcome-domain-desc">{domain.blurb}</p>
      <div className="welcome-domain-stats">
        {/* Node/edge counts are meaningful only for the graph-driven domains; the
            flagship rides the full retrieval engine (its graph is baked into the
            engine, not carried on the corpus descriptor), so show that instead of a
            misleading "0 graph nodes". */}
        {nodeCount > 0 && (
          <span>
            <strong>{nodeCount}</strong> graph nodes
          </span>
        )}
        {edgeCount > 0 && (
          <span>
            <strong>{edgeCount}</strong> edges
          </span>
        )}
        {domain.fullEngine && <span>full retrieval engine</span>}
        {domain.hasSimulator && <span>interactive simulator</span>}
      </div>
      <button type="button" className="welcome-domain-cta" onClick={onEnter}>
        Begin training →
      </button>
    </article>
  );
}

function UpcomingCard({ domain }: { domain: UpcomingDomain }) {
  return (
    <article className="welcome-domain-card welcome-domain-card--upcoming" aria-disabled="true">
      <div className="welcome-domain-top">
        <span className="welcome-domain-badge">{domain.instantiation}</span>
        <span className="welcome-domain-status">Planned</span>
      </div>
      <h3 className="welcome-domain-name">{domain.name}</h3>
      <p className="welcome-domain-desc">{domain.description}</p>
      <button type="button" className="welcome-domain-cta" disabled>
        Coming soon
      </button>
    </article>
  );
}
