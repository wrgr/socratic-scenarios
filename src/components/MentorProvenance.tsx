/**
 * Shared provenance affordances for Mentor output, reused across SocraticView,
 * ScenarioView, and AjpWorkflowDemo.
 *
 *  - ProvenanceBadge: tags an evaluation grounded (corpus in the prompt) vs
 *    naive, and lists the grounding node ids.
 *  - AblationPanel: shows the with/without-corpus diff (RAG-driven vs baked-in).
 *  - ProvenanceToggle: opt-in switch for the (2× model call) ablation probe.
 */
import type { MentorEvaluation, AblationDiff } from '../engine/mentor';

export function ProvenanceBadge({ evaluation }: { evaluation: MentorEvaluation }) {
  const { grounded, groundingNodeIds } = evaluation;
  return (
    <div className={`provenance-badge ${grounded ? 'is-grounded' : 'is-naive'}`}>
      <span className="provenance-dot" aria-hidden="true">{grounded ? '⛓' : '○'}</span>
      {grounded ? (
        <span className="provenance-text">
          Grounded · {groundingNodeIds.length} corpus node{groundingNodeIds.length !== 1 ? 's' : ''}
          {groundingNodeIds.length > 0 && (
            <span className="provenance-ids" title={groundingNodeIds.join(', ')}>
              {' '}({groundingNodeIds.slice(0, 3).join(', ')}{groundingNodeIds.length > 3 ? '…' : ''})
            </span>
          )}
        </span>
      ) : (
        <span className="provenance-text">Ungrounded (naive) — no corpus context in the prompt</span>
      )}
    </div>
  );
}

export function AblationPanel({ diff }: { diff: AblationDiff<MentorEvaluation> }) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className={`ablation-panel ${diff.ragDependent ? 'rag-dependent' : 'baked-in'}`}>
      <div className="ablation-title">
        <strong>{diff.ragDependent ? '🔗 RAG-driven' : '🧠 Baked-in'}</strong>
        <span className="ablation-subtitle">
          {diff.ragDependent
            ? 'removing the corpus changed the answer'
            : 'the corpus did not change the answer — model used its own priors'}
        </span>
      </div>
      <div className="ablation-rows">
        <div className="ablation-row"><span>With corpus</span><b>{pct(diff.grounded.score)}</b></div>
        <div className="ablation-row"><span>Without corpus</span><b>{pct(diff.ablated.score)}</b></div>
        <div className="ablation-row"><span>Δ score</span><b>{diff.scoreDelta >= 0 ? '+' : ''}{pct(diff.scoreDelta)}</b></div>
        <div className="ablation-row"><span>Feedback overlap</span><b>{pct(diff.feedbackSimilarity)}</b></div>
      </div>
    </div>
  );
}

export function ProvenanceToggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="provenance-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>Provenance probe — score with &amp; without corpus (2× calls)</span>
    </label>
  );
}
