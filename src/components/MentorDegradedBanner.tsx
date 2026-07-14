/**
 * Shown instead of the normal score bar/feedback when a MentorEvaluation is
 * degraded (the LLM call failed and a placeholder score/feedback was
 * substituted) — without this, a Gemini quota error is visually
 * indistinguishable from the learner actually scoring 0%.
 */
export function MentorDegradedBanner({ feedback }: { feedback: string }) {
  return (
    <div className="eval-degraded" role="alert">
      <strong>Mentor unavailable:</strong> {feedback}
    </div>
  );
}
