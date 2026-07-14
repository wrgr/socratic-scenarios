/**
 * AjpExpansionLightbox — shared modal for the Architecture tab (and, via the
 * extracted ExpansionBody below, the global pedagogy drawer — see
 * PedagogyDrawer.tsx).
 *
 * Two content kinds: a full-bleed diagram image, or a text panel with an
 * optional lead / callout / checklist / bullets / paragraphs. Extracted from
 * the former AjpBackgroundModel so both surfaces render expansions identically.
 */
import { useEscapeToClose } from '../hooks/useEscapeStack';

export interface DiagramDef {
  label: string;
  text: string;
  src: string;
}

export type TextExpansion = Extract<Expansion, { kind: 'text' }>;

export type Expansion =
  | { kind: 'diagram'; diagram: DiagramDef }
  | {
      kind: 'text';
      title: string;
      lead?: string;
      bullets?: readonly string[];
      callout?: string;
      checklist?: readonly string[];
      paragraphs: readonly string[];
    };

/**
 * Renders a text expansion's body (title/lead/callout/checklist/bullets/
 * paragraphs) with no modal chrome — reused by both the lightbox below and
 * PedagogyDrawer's inline accordion, so the two surfaces never duplicate this
 * markup even though the drawer doesn't nest a lightbox inside itself.
 */
export function ExpansionBody({ expansion, hideTitle }: { expansion: TextExpansion; hideTitle?: boolean }) {
  return (
    <div className="ajp-text-lightbox-body">
      {hideTitle ? null : <h3 className="ajp-text-lightbox-title">{expansion.title}</h3>}
      {expansion.lead ? <p className="ajp-text-lightbox-lead">{expansion.lead}</p> : null}
      {expansion.callout ? <div className="ajp-text-callout">{expansion.callout}</div> : null}
      {expansion.checklist && expansion.checklist.length > 0 ? (
        <div className="ajp-text-checklist">
          <p className="ajp-text-checklist-label">Quick check</p>
          <ul className="ajp-text-checklist-items">
            {expansion.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {expansion.bullets && expansion.bullets.length > 0 ? (
        <ul className="ajp-text-lightbox-bullets">
          {expansion.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
      {expansion.paragraphs.map((p) => (
        <p key={p} className="ajp-text-lightbox-para">
          {p}
        </p>
      ))}
    </div>
  );
}

export function AjpExpansionLightbox({
  expansion,
  onClose,
}: {
  expansion: Expansion | null;
  onClose: () => void;
}) {
  useEscapeToClose(expansion !== null, onClose);

  if (!expansion) return null;

  return (
    <div
      className="ajp-diagram-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={expansion.kind === 'diagram' ? `Expanded diagram: ${expansion.diagram.label}` : expansion.title}
      onClick={onClose}
    >
      <div
        className={expansion.kind === 'diagram' ? 'ajp-diagram-lightbox-content' : 'ajp-text-lightbox-content'}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="ajp-modal-close" onClick={onClose} aria-label="Close">
          <span aria-hidden="true">×</span>
        </button>
        {expansion.kind === 'diagram' ? (
          <>
            <img src={expansion.diagram.src} alt={expansion.diagram.label} />
            <div className="ajp-diagram-lightbox-caption">
              <strong>{expansion.diagram.label}</strong>
              <span>{expansion.diagram.text}</span>
            </div>
          </>
        ) : (
          <ExpansionBody expansion={expansion} />
        )}
      </div>
    </div>
  );
}

/** Shared helper: build a text expansion from a clickable tile's config. */
export type TextExpansionConfig = Omit<Extract<Expansion, { kind: 'text' }>, 'kind'>;
