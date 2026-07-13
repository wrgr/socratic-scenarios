/**
 * ArchitectureView — the flowchart + architecture-diagram tab.
 *
 * The system flow (Signals → Retrieval → Mentor Loop → Safety Gate → Transfer)
 * and the two architecture diagrams (concept map + code-level package
 * architecture). Split out of the former AjpBackgroundModel banner.
 */
import { useState } from 'react';
import { FLOW_STEPS } from './ajp-background-model.data';
import { AjpExpansionLightbox, type Expansion, type DiagramDef } from './AjpExpansionLightbox';

const DIAGRAMS: readonly DiagramDef[] = [
  {
    label: 'AJP Concept Demo',
    text: 'System concept map: inputs, adaptation hub, and operating modes.',
    src: `${import.meta.env.BASE_URL}diagrams/teachme_eddie_concept_demo.svg`,
  },
  {
    label: 'Package Architecture',
    text: 'Code-level package and dependency architecture for TeachMe + AJP stack.',
    src: `${import.meta.env.BASE_URL}diagrams/teachme_package_architecture_demo.svg`,
  },
];

export function ArchitectureView() {
  const [expansion, setExpansion] = useState<Expansion | null>(null);

  return (
    <section className="ajp-architecture-view" aria-label="System architecture">
      <div className="ajp-model-header">
        <span className="ajp-model-eyebrow">Architecture</span>
        <h2>System Flow &amp; Architecture</h2>
        <p>
          How evidence moves through the system, and how the code is organized. Click any flow step
          or diagram to expand.
        </p>
      </div>

      <div className="ajp-flow-model" aria-label="AJP learning and impact flow">
        {FLOW_STEPS.map((step, index) => (
          <div key={step.title} className="ajp-flow-step">
            <div
              className="ajp-flow-node ajp-expandable-tile"
              onClick={() =>
                setExpansion({
                  kind: 'text',
                  title: step.title,
                  lead: step.detail,
                  callout: step.expansion.callout,
                  checklist: step.expansion.checklist,
                  paragraphs: step.expansion.paragraphs,
                })
              }
              title="Click to expand"
              role="button"
              aria-label={`Expand ${step.title} step`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpansion({
                    kind: 'text',
                    title: step.title,
                    lead: step.detail,
                    callout: step.expansion.callout,
                    checklist: step.expansion.checklist,
                    paragraphs: step.expansion.paragraphs,
                  });
                }
              }}
            >
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </div>
            {index < FLOW_STEPS.length - 1 ? <span className="ajp-flow-arrow">→</span> : null}
          </div>
        ))}
      </div>

      <div className="ajp-diagram-grid" aria-label="Architecture diagram previews">
        {DIAGRAMS.map((d) => (
          <figure
            key={d.label}
            className="ajp-diagram-card ajp-diagram-card--interactive"
            onClick={() => setExpansion({ kind: 'diagram', diagram: d })}
            title="Click to expand"
          >
            <img src={d.src} alt={d.label} loading="lazy" />
            <figcaption>
              <strong>{d.label}</strong>
              <span>{d.text}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <AjpExpansionLightbox expansion={expansion} onClose={() => setExpansion(null)} />
    </section>
  );
}
