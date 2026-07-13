/**
 * Narrator engine: corpus-grounded responses for AJP Scenario Mode.
 * The Narrator simulates the machine environment using only verified knowledge graph
 * nodes — no generative output. Every response is traceable to a source node.
 */
import type { AJPNode } from '../../types/ajp';
import { getActiveDomain } from '../../domains/domain-context';

// ─── Node Lookup ──────────────────────────────────────────────────

/** Return a node by ID, or undefined if not found. */
export function getNodeById(id: string): AJPNode | undefined {
  return getActiveDomain().graph.nodes.find((n) => n.id === id);
}

/** Return all nodes of a given type. */
export function getNodesByType(type: AJPNode['type']): AJPNode[] {
  return getActiveDomain().graph.nodes.filter((n) => n.type === type);
}

// ─── Graph Traversal ──────────────────────────────────────────────

/** Return IDs of nodes reachable via a given edge type from a source node. */
export function getOutNeighbors(
  fromId: string,
  edgeType: string,
): string[] {
  return getActiveDomain().graph.edges
    .filter((e) => e.from === fromId && e.type === edgeType)
    .map((e) => e.to);
}

/** Return IDs of nodes pointing to this node via a given edge type. */
export function getInNeighbors(
  toId: string,
  edgeType: string,
): string[] {
  return getActiveDomain().graph.edges
    .filter((e) => e.to === toId && e.type === edgeType)
    .map((e) => e.from);
}

// ─── Narrator Response ────────────────────────────────────────────

export interface NarratorOutput {
  /** Node ID providing this response (for traceability). */
  sourceNodeId: string;
  /** Text the Narrator reads aloud. Corpus-sourced, not generated. */
  text: string;
  /** Safety alert to show in red, if present on the node. */
  safetyAlert?: string;
  /** True when this response represents a fault/anomaly state. */
  isFault: boolean;
}

/**
 * Return a corpus-grounded Narrator response for a given node ID.
 * Falls back to node content if no dedicated narratorText is defined.
 */
export function getNarratorOutput(nodeId: string): NarratorOutput | null {
  const node = getNodeById(nodeId);
  if (!node) return null;

  const isFault = node.type === 'FailureMode' || node.type === 'Symptom';
  const text = node.narratorText ?? node.content;

  return {
    sourceNodeId: node.id,
    text,
    safetyAlert: node.safetyAlert,
    isFault,
  };
}

// ─── Causal Chain Lookup ──────────────────────────────────────────

export interface CausalChain {
  symptomIds: string[];
  faultId: string;
  correctiveActionIds: string[];
  safetyHazardIds: string[];
}

/**
 * Build the causal chain for a given failure mode node ID.
 * Returns symptoms, corrective actions, and required safety hazards.
 */
export function getCausalChain(faultNodeId: string): CausalChain | null {
  const fault = getNodeById(faultNodeId);
  if (!fault || fault.type !== 'FailureMode') return null;

  const symptomIds = getInNeighbors(faultNodeId, 'INDICATES');
  const correctiveActionIds = getOutNeighbors(faultNodeId, 'FIXED_BY');
  const safetyHazardIds = getOutNeighbors(faultNodeId, 'REQUIRES');

  return { symptomIds, faultId: faultNodeId, correctiveActionIds, safetyHazardIds };
}

/**
 * Return the corrective action node text for a fault, or null if not found.
 * Used by the Narrator to report what happens after a correct resolution action.
 */
export function getCorrectiveActionText(faultNodeId: string): string | null {
  const chain = getCausalChain(faultNodeId);
  if (!chain || chain.correctiveActionIds.length === 0) return null;

  const actionNode = getNodeById(chain.correctiveActionIds[0]);
  if (!actionNode) return null;
  return actionNode.narratorText ?? actionNode.content;
}
