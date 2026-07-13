/**
 * ExpertFlagButton — compact 3-state toggle for expert review status.
 *
 *   none → ✓ good → ⚠ needs-review → none
 *
 * Accepts any stable id (graph node id, dense chunk id, etc.).
 * Paired with <ExpertFlagBadge /> for read-only display in surfaces
 * where we don't want full toggle affordance.
 */
import { useExpertFlags, useFlagStatus, type FlagStatus } from '../hooks/useExpertFlags';

interface ExpertFlagButtonProps {
  id: string;
  /** Optional short label describing what's being flagged (e.g. node type). */
  label?: string;
  /** Compact rendering (just the icon) vs full (icon + current status word). */
  variant?: 'compact' | 'full';
}

const STATUS_META: Record<FlagStatus, { icon: string; label: string; className: string }> = {
  'good': { icon: '✓', label: 'Good', className: 'expert-flag--good' },
  'needs-review': { icon: '⚠', label: 'Needs review', className: 'expert-flag--review' },
  'gap': { icon: '?', label: 'Gap', className: 'expert-flag--gap' },
};

export function ExpertFlagButton({ id, label, variant = 'compact' }: ExpertFlagButtonProps) {
  const { getFlag, cycleFlag } = useExpertFlags();
  const entry = getFlag(id);
  const meta = entry ? STATUS_META[entry.status] : null;

  const title = meta
    ? `Expert flag: ${meta.label}${label ? ` · ${label}` : ''} — click to cycle`
    : `Flag${label ? ` ${label}` : ''} (click: ✓ good → ⚠ needs review → clear)`;

  return (
    <button
      type="button"
      className={`expert-flag-btn ${meta?.className ?? 'expert-flag--none'}`}
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); cycleFlag(id); }}
    >
      <span className="expert-flag-icon">{meta?.icon ?? '○'}</span>
      {variant === 'full' && (
        <span className="expert-flag-label">{meta?.label ?? 'Flag'}</span>
      )}
    </button>
  );
}

/** Read-only status indicator. Shows nothing if id is unflagged. */
export function ExpertFlagBadge({ id }: { id: string | undefined | null }) {
  const entry = useFlagStatus(id);
  if (!entry) return null;
  const meta = STATUS_META[entry.status];
  return (
    <span
      className={`expert-flag-badge ${meta.className}`}
      title={`Expert flag: ${meta.label}`}
    >
      {meta.icon}
    </span>
  );
}
