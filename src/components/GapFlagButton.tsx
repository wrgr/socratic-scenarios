/**
 * GapFlagButton — learner-facing "I don't understand this yet" affordance.
 *
 * Distinct from ExpertFlagButton: this is a learner speech act, not a reviewer
 * verdict. A required note captures *what* is unclear so the gap is actionable
 * for a mentor reviewing the JSON export. Multiple gaps per target are allowed.
 */
import { useState } from 'react';
import { useExpertFlags } from '../hooks/useExpertFlags';

interface GapFlagButtonProps {
  /** Step, probe, or concept id being flagged. */
  targetId: string;
  /** Short label describing what's being flagged (e.g. "step", "probe"). */
  label?: string;
}

export function GapFlagButton({ targetId, label }: GapFlagButtonProps) {
  const { addGap, removeFlag, getGapsForTarget } = useExpertFlags();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  const gaps = getGapsForTarget(targetId);
  const count = gaps.length;

  const canSubmit = note.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const id = addGap(targetId, note);
    if (id) {
      setNote('');
      // Keep panel open so learner sees their entry land in the list.
    }
  }

  const title = count > 0
    ? `${count} gap${count === 1 ? '' : 's'} flagged on this ${label ?? 'item'} — click to add/manage`
    : `Flag a knowledge gap on this ${label ?? 'item'}`;

  return (
    <div className={`gap-flag ${open ? 'gap-flag--open' : ''}`}>
      <button
        type="button"
        className={`gap-flag-btn ${count > 0 ? 'gap-flag-btn--has-gaps' : ''}`}
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        <span className="gap-flag-icon">?</span>
        <span className="gap-flag-text">
          {count > 0 ? `${count} gap${count === 1 ? '' : 's'}` : 'Flag gap'}
        </span>
      </button>

      {open && (
        <div className="gap-flag-panel" role="dialog" aria-label="Flag a knowledge gap">
          <form onSubmit={handleSubmit} className="gap-flag-form">
            <label className="gap-flag-form-label" htmlFor={`gap-note-${targetId}`}>
              What's unclear? <span className="gap-flag-required">(required)</span>
            </label>
            <textarea
              id={`gap-note-${targetId}`}
              className="gap-flag-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. I don't understand why we change the stage speed here."
              rows={3}
              autoFocus
            />
            <div className="gap-flag-form-actions">
              <button
                type="button"
                className="gap-flag-cancel"
                onClick={() => { setNote(''); setOpen(false); }}
              >
                Close
              </button>
              <button
                type="submit"
                className="gap-flag-submit"
                disabled={!canSubmit}
              >
                Flag gap
              </button>
            </div>
          </form>

          {count > 0 && (
            <div className="gap-flag-list">
              <div className="gap-flag-list-header">Your flagged gaps</div>
              <ul>
                {gaps.map((g) => (
                  <li key={g.id} className="gap-flag-list-item">
                    <div className="gap-flag-list-note">{g.note}</div>
                    <div className="gap-flag-list-meta">
                      <time dateTime={g.updatedAt}>
                        {new Date(g.updatedAt).toLocaleString()}
                      </time>
                      <button
                        type="button"
                        className="gap-flag-list-remove"
                        onClick={() => removeFlag(g.id)}
                        title="Remove this gap"
                        aria-label="Remove this gap"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
