/** Show passage-evidence status without presenting similarity as answer confidence. */
import type { PassageEvidence } from '../engine/retrieval/passage-ranking';

export function PassageEvidenceNotice({ evidence }: { evidence?: PassageEvidence }) {
  if (!evidence) return null;
  const title = evidence.status === 'insufficient-evidence' ? 'No supporting passage found'
    : evidence.status === 'unavailable' ? 'Document search unavailable' : 'Verify the answer in the cited passages';
  return <div className="in-op-dense-hint" role="status"><strong>{title}</strong><p>{evidence.message}</p></div>;
}
