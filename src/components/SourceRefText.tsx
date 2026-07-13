/**
 * Renders plain text with clickable SRC-### citations that open a source record card.
 */
import { Fragment, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { getSourceRefRecord } from '../corpus/source-ref-registry';
import { splitSourceRefSegments, type SourceRefSegment } from './source-ref-inline.utils';

type Tag = 'span' | 'div' | 'p';

export interface SourceRefTextProps {
  text: string;
  /** Optional wrapper element; default span for inline use inside paragraphs. */
  as?: Tag;
  className?: string;
}

function SourceRefCitation({
  seg,
  popoverId,
  expanded,
  onOpen,
  onClose,
}: {
  seg: Extract<SourceRefSegment, { kind: 'ref' }>;
  popoverId: string;
  expanded: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const record = getSourceRefRecord(seg.sourceId);

  useEffect(() => {
    if (!expanded) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded, onClose]);

  return (
    <span ref={wrapRef} className="source-ref-citation-wrap">
      <button
        type="button"
        className="source-ref-citation-btn"
        aria-expanded={expanded}
        aria-controls={popoverId}
        onClick={() => (expanded ? onClose() : onOpen())}
      >
        {seg.text}
      </button>
      {expanded && (
        <span id={popoverId} className="source-ref-popover" role="dialog" aria-label={`Source ${seg.sourceId}`}>
          {record ? (
            <>
              <span className="source-ref-popover-title">{record.title}</span>
              {record.author && (
                <span className="source-ref-popover-author">{record.author}</span>
              )}
              {seg.location && (
                <span className="source-ref-popover-loc">
                  <span className="source-ref-popover-loc-label">Citation detail</span>
                  {seg.location}
                </span>
              )}
              <p className="source-ref-popover-summary">{record.summary}</p>
              {record.url && (
                <a
                  className="source-ref-popover-link"
                  href={record.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open document
                </a>
              )}
            </>
          ) : (
            <>
              <span className="source-ref-popover-title">Unknown source</span>
              <p className="source-ref-popover-summary">
                No registry entry for <strong>{seg.sourceId}</strong>. Ask your administrator to add it to
                the source registry.
              </p>
              {seg.location && (
                <span className="source-ref-popover-loc">
                  <span className="source-ref-popover-loc-label">Citation detail</span>
                  {seg.location}
                </span>
              )}
            </>
          )}
          <button type="button" className="source-ref-popover-close" onClick={onClose}>
            Close
          </button>
        </span>
      )}
    </span>
  );
}

export function SourceRefText({ text, as: Tag = 'span', className }: SourceRefTextProps) {
  const baseId = useId();
  const segments = useMemo(() => splitSourceRefSegments(text), [text]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);

  return (
    <Tag className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <Fragment key={`t-${i}`}>{seg.text}</Fragment>
        ) : (
          <SourceRefCitation
            key={`r-${i}`}
            seg={seg}
            popoverId={`${baseId}-popover-${i}`}
            expanded={openIndex === i}
            onOpen={() => setOpenIndex(i)}
            onClose={close}
          />
        ),
      )}
    </Tag>
  );
}
