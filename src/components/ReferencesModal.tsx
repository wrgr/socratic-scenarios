import { useEffect, useState } from 'react';
import { REFERENCE_SECTIONS } from './ajp-background-model.data';
import { DomainSourcesPanel } from './DomainSourcesPanel';

const ALL = 'All';
const DOMAIN_SOURCES = 'Domain Sources';

export function ReferencesModal({ onClose }: { onClose: () => void }) {
  const [activeTopic, setActiveTopic] = useState(ALL);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Domain Sources is its own pill, not folded into "All" — it's a computed
  // fact-source audit, not more pedagogy reading, so it stays out of the way
  // unless someone specifically wants to see what backs the corpus.
  const topics = [ALL, ...REFERENCE_SECTIONS.map((s) => s.topic), DOMAIN_SOURCES];
  const visible =
    activeTopic === ALL
      ? REFERENCE_SECTIONS
      : activeTopic === DOMAIN_SOURCES
        ? []
        : REFERENCE_SECTIONS.filter((s) => s.topic === activeTopic);

  return (
    <div
      className="ajp-diagram-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="References and whitepaper"
      onClick={onClose}
    >
      <div className="ajp-refs-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ajp-modal-close"
          onClick={onClose}
          aria-label="Close references"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="ajp-refs-modal-header">
          <h3 className="ajp-refs-modal-heading">References &amp; Whitepaper</h3>
          <div className="ajp-refs-filter" role="group" aria-label="Filter by topic">
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                className={`ajp-refs-filter-pill${activeTopic === t ? ' ajp-refs-filter-pill--active' : ''}`}
                onClick={() => setActiveTopic(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="ajp-refs-modal-body">
          {activeTopic === DOMAIN_SOURCES && <DomainSourcesPanel />}
          {visible.map((section) => (
            <div key={section.topic} className="ajp-refs-section">
              <h4 className="ajp-reference-topic-title">{section.topic}</h4>
              <ul className="ajp-reference-list">
                {section.items.map((item) => (
                  <li key={item.title} className="ajp-reference-item">
                    {item.href ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="ajp-reference-link"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span className="ajp-reference-title">{item.title}</span>
                    )}
                    <span className="ajp-reference-summary">{item.summary}</span>
                    {item.bullets && item.bullets.length > 0 ? (
                      <ul className="ajp-refs-item-bullets">
                        {item.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
