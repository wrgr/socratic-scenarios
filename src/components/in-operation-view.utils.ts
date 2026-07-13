/**
 * Pure utility functions for InOperationView: chain formatting,
 * confidence labels, and safety-priority sorting. No React imports.
 */
import type { CausalChainResult } from '../engine/retrieval/graph-retrieval';
import type { AJPNode } from '../types/ajp';

// ─── Confidence Formatting ────────────────────────────────────────

/** Map a raw similarity score (0–1) to a human-readable confidence label. */
export function confidenceLabel(score: number): string {
  if (score >= 0.4) return 'High confidence';
  if (score >= 0.2) return 'Moderate confidence';
  return 'Low confidence — verify manually';
}

/** CSS class for the confidence badge. */
export function confidenceClass(score: number): string {
  if (score >= 0.4) return 'confidence-high';
  if (score >= 0.2) return 'confidence-medium';
  return 'confidence-low';
}

// ─── Chain Formatting ─────────────────────────────────────────────

/** Extract all unique safety alerts from a chain's safety hazard nodes. */
export function extractSafetyAlerts(chain: CausalChainResult): string[] {
  const alerts: string[] = [];
  for (const hazard of chain.safetyHazards) {
    if (hazard.safetyAlert) alerts.push(hazard.safetyAlert);
  }
  for (const action of chain.correctiveActions) {
    if (action.safetyAlert) alerts.push(action.safetyAlert);
  }
  if (chain.fault.safetyAlert) alerts.push(chain.fault.safetyAlert);
  return [...new Set(alerts)];
}

/** Return a 1-line summary of a chain for collapsed display. */
export function chainSummaryLine(chain: CausalChainResult): string {
  const fixCount = chain.correctiveActions.length;
  const actionVerb = fixCount === 1 ? '1 corrective action' : `${fixCount} corrective actions`;
  return `${chain.fault.id} — ${actionVerb}`;
}

/** Truncate plain text for UI previews (ellipsis when trimmed). */
export function truncateText(s: string, maxLen: number): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}

/**
 * Short human-readable "topic" line for a chain row: fault id plus clipped fault
 * description so operators see meaning before opening full analysis.
 */
export function chainTopicTitle(chain: CausalChainResult): string {
  return `${chain.fault.id} — ${truncateText(chain.fault.content, 96)}`;
}

/** Return CSS class for the chain card based on fault severity. */
export function chainSeverityClass(chain: CausalChainResult): string {
  const faultId = chain.fault.id;
  if (faultId.includes('FULL')) return 'chain-card chain-card--critical';
  if (faultId.includes('PARTIAL')) return 'chain-card chain-card--warning';
  return 'chain-card chain-card--info';
}

// ─── Node Display ─────────────────────────────────────────────────

/** Return the display label for a node (short ID + type). */
export function nodeLabel(node: AJPNode): string {
  return `[${node.id}]`;
}

/** Return whether a corrective action is conservative (first-line) or escalation. */
export function isConservativeAction(node: AJPNode): boolean {
  const escalationKeywords = ['disassembly', 'sonication', 'full clean', 'abort'];
  return !escalationKeywords.some((kw) => node.content.toLowerCase().includes(kw));
}

// ─── Empty State ──────────────────────────────────────────────────

/** Return placeholder text when no query has been entered. */
export function emptyStateText(): string {
  return 'Describe what you are seeing on KEWB or the print — e.g., "pressure is high and line looks narrow" or "no deposition, pressure spiked"';
}

/** Return "no results" explanation based on query text. */
export function noResultsText(queryText: string): string {
  if (queryText.length < 5) {
    return 'Query too short — describe the observable symptom in more detail.';
  }
  return `No fault chains matched "${queryText}". Try different terms: pressure, current, deposition, plume, clog, atomizer, sheath.`;
}
