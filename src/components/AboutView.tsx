/**
 * AboutView — "here's what this is" tab.
 *
 * The introduction plus the engineering + learning-sciences explanation
 * (the three pillars: Mission Impact, Educational Approach, Why AI) and the
 * references/whitepaper. Split out of the former AjpBackgroundModel banner so
 * the dashboard/welcome screen stays clean.
 */
import { useState } from 'react';
import { PILLARS, WHITEPAPER_URL } from './ajp-background-model.data';
import { AjpExpansionLightbox, type Expansion, type TextExpansionConfig } from './AjpExpansionLightbox';
import { ReferencesModal } from './ReferencesModal';

export function AboutView() {
  const [expansion, setExpansion] = useState<Expansion | null>(null);
  const [showRefs, setShowRefs] = useState(false);

  const openText = (cfg: TextExpansionConfig) => setExpansion({ kind: 'text', ...cfg });

  return (
    <section className="ajp-about-view" aria-label="About EDDIE">
      <div className="ajp-model-header">
        <span className="ajp-model-eyebrow">About EDDIE</span>
        <h2>Mission, Pedagogy, and AI Rationale</h2>
        <p>
          What is implemented today, what drives measurable educational lift, and why AI is the right
          mechanism for adaptive technical training. Click any pillar to go deeper.
        </p>
      </div>

      <div className="ajp-pillars-grid">
        {PILLARS.map((pillar) => (
          <article
            key={pillar.title}
            className="ajp-pillar-card ajp-expandable-tile"
            onClick={() =>
              openText({
                title: pillar.title,
                bullets: pillar.points,
                callout: pillar.expansion.callout,
                checklist: pillar.expansion.checklist,
                paragraphs: pillar.expansion.paragraphs,
              })
            }
            title="Click to expand"
            aria-label={`Expand ${pillar.title}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openText({
                  title: pillar.title,
                  bullets: pillar.points,
                  callout: pillar.expansion.callout,
                  checklist: pillar.expansion.checklist,
                  paragraphs: pillar.expansion.paragraphs,
                });
              }
            }}
          >
            <h3>{pillar.title}</h3>
            <ul>
              {pillar.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="ajp-refs-footer">
        <a href={WHITEPAPER_URL} target="_blank" rel="noreferrer" className="ajp-whitepaper-link">
          TeachMe AJP — full system whitepaper ↗
        </a>
        <button type="button" className="ajp-refs-trigger-btn" onClick={() => setShowRefs(true)}>
          References &amp; Whitepaper
        </button>
      </div>

      <AjpExpansionLightbox expansion={expansion} onClose={() => setExpansion(null)} />
      {showRefs ? <ReferencesModal onClose={() => setShowRefs(false)} /> : null}
    </section>
  );
}
