/**
 * Parse SRC-### citations (with optional section / figure tails) for inline UI.
 */

export type SourceRefSegment =
  | { kind: 'text'; text: string }
  | { kind: 'ref'; text: string; sourceId: string; location: string };

const SRC_HEAD = /^SRC-\d{3}/;

/** Optional location after SRC-###: parenthetical, Section…, §…, or Figure…. */
function extendLocation(s: string, pos: number): { end: number; location: string } {
  let p = pos;
  while (p < s.length && s[p] === ' ') p++;
  if (p >= s.length) return { end: pos, location: '' };

  if (s[p] === '(') {
    const close = s.indexOf(')', p);
    if (close !== -1) return { end: close + 1, location: s.slice(p, close + 1) };
    return { end: pos, location: '' };
  }

  const head = s.slice(p);
  // Section lists use commas only between numeric tokens (e.g. 4.6, 4.11) — never ", SRC-…"
  const sectionOrFigure = head.match(
    /^(?:(?:Section|Sections|section)\s+(?:(?:[\w.\-–]+|\d+)(?:\s*,\s*[\d.\-–]+)*(?:\s+Figure\s+[\d.]+)?(?:\s+steps\s+[\d\-–]+)?)|§\s*[\d.\-–]+|Figure\s+[\d.]+)/i,
  );
  if (!sectionOrFigure) return { end: pos, location: '' };

  return { end: p + sectionOrFigure[0].length, location: sectionOrFigure[0].trim() };
}

/**
 * Split plain text into alternating plain segments and SRC citations.
 * Best-effort: stops combined citations at natural delimiters before the next SRC id.
 */
export function splitSourceRefSegments(text: string): SourceRefSegment[] {
  if (!text) return [];

  const out: SourceRefSegment[] = [];
  let i = 0;

  while (i < text.length) {
    const idx = text.indexOf('SRC-', i);
    if (idx === -1) {
      out.push({ kind: 'text', text: text.slice(i) });
      break;
    }

    if (idx > i) {
      out.push({ kind: 'text', text: text.slice(i, idx) });
    }

    const slice = text.slice(idx);
    const m = slice.match(SRC_HEAD);
    if (!m || m.index !== 0) {
      out.push({ kind: 'text', text: text.slice(idx, idx + 4) });
      i = idx + 4;
      continue;
    }

    const sourceId = m[0];
    const afterId = idx + sourceId.length;
    const { end: locEnd, location } = extendLocation(text, afterId);
    const end = locEnd > afterId ? locEnd : afterId;
    const citation = text.slice(idx, end);
    out.push({ kind: 'ref', text: citation, sourceId, location });
    i = end;
  }

  return out;
}
