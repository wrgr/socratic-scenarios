/**
 * PedagogyDrawer — global slide-out panel with the Mission/Pedagogy/AI
 * Rationale content (formerly the full-tab AboutView). Reachable from a
 * persistent masthead trigger on every screen, so it isn't tied to `ajpTab`.
 *
 * Pillars expand inline (accordion), not via a nested AjpExpansionLightbox —
 * stacking two overlays inside one another is exactly the kind of thing that
 * makes Escape-key handling ambiguous. ExpansionBody (shared with the
 * lightbox — see AjpExpansionLightbox.tsx) keeps the expanded content
 * identical to what Architecture's FLOW_STEPS lightbox renders.
 */
import { useState } from 'react';
import { PILLARS, WHITEPAPER_URL } from './ajp-background-model.data';
import { ExpansionBody } from './AjpExpansionLightbox';
import { ReferencesModal } from './ReferencesModal';
import { useEscapeToClose } from '../hooks/useEscapeStack';

export function PedagogyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expandedTitle, setExpandedTitle] = useState<string | null>(null);
  const [showRefs, setShowRefs] = useState(false);

  useEscapeToClose(open, onClose);

  if (!open) return null;

  return (
    <>
      {/* ReferencesModal is a sibling, not a child, of this backdrop — it has its
          own full-screen backdrop with its own onClick-to-close, and nesting it
          here would let a click on its backdrop bubble up and close this drawer
          too (this backdrop's own onClick has no stopPropagation guard against it). */}
      <div className="pedagogy-drawer-backdrop" onClick={onClose}>
        <aside
          className="pedagogy-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mission, pedagogy, and AI rationale"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pedagogy-drawer-header">
            <span className="pedagogy-drawer-eyebrow">About EDDIE</span>
            <button type="button" className="ajp-modal-close" onClick={onClose} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <h2 className="pedagogy-drawer-title">Mission, Pedagogy, and AI Rationale</h2>
          <p className="pedagogy-drawer-intro">
            What is implemented today, what drives measurable educational lift, and why AI is the
            right mechanism for adaptive technical training. Click any pillar to go deeper.
          </p>

          <div className="pedagogy-drawer-pillars">
            {PILLARS.map((pillar) => {
              const isExpanded = expandedTitle === pillar.title;
              return (
                <article key={pillar.title} className="pedagogy-pillar">
                  <button
                    type="button"
                    className="pedagogy-pillar-toggle"
                    onClick={() => setExpandedTitle(isExpanded ? null : pillar.title)}
                    aria-expanded={isExpanded}
                  >
                    <h3>{pillar.title}</h3>
                    <span className="pedagogy-pillar-caret" aria-hidden="true">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  <ul className="pedagogy-pillar-points">
                    {pillar.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  {isExpanded && (
                    <div className="pedagogy-pillar-expansion">
                      {/* bullets omitted here — pillar.points are already shown
                          persistently above, so repeating them as "bullets" would
                          duplicate the same list right below itself. */}
                      <ExpansionBody
                        expansion={{
                          kind: 'text',
                          title: pillar.title,
                          callout: pillar.expansion.callout,
                          checklist: pillar.expansion.checklist,
                          paragraphs: pillar.expansion.paragraphs,
                        }}
                        hideTitle
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <div className="ajp-refs-footer">
            <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer" className="ajp-whitepaper-link">
              TeachMe AJP — full system whitepaper ↗
            </a>
            <button type="button" className="ajp-refs-trigger-btn" onClick={() => setShowRefs(true)}>
              References &amp; Whitepaper
            </button>
          </div>
        </aside>
      </div>

      {showRefs ? <ReferencesModal onClose={() => setShowRefs(false)} /> : null}
    </>
  );
}
