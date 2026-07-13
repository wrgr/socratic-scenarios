/**
 * retrieval-router.ts
 *
 * Context-aware graph retrieval dispatcher. Each named strategy encodes the
 * correct edge-traversal pattern for one operational context in the pipeline.
 *
 * ═══════════════════════════════════════════════════════════════
 *  WHAT SHOULD GO AT EACH PROCESS NODE — DECISION TABLE
 * ═══════════════════════════════════════════════════════════════
 *
 * ┌──────────────────────┬──────────────────────┬───────────────────────────────────┬───────────────────────────────────────────┐
 * │ Mode                 │ When to use          │ Graph traversal                   │ Dense augmentation hint                   │
 * ├──────────────────────┼──────────────────────┼───────────────────────────────────┼───────────────────────────────────────────┤
 * │ fault-diagnosis      │ In-Operation: learner │ Symptom/Fault → INDICATES →       │ SOP passage for this fault type           │
 * │                      │ describes a symptom  │ FailureMode → FIXED_BY +          │ (e.g. Stanford/Boise State SOP section)   │
 * │                      │                      │ REQUIRES(SafetyHazard)            │                                           │
 * ├──────────────────────┼──────────────────────┼───────────────────────────────────┼───────────────────────────────────────────┤
 * │ step-context         │ Scenario: Narrator   │ Step -[NEXT_STEP]→ nextStep        │ SOP section matching this step label      │
 * │                      │ is at step N;        │ Step -[PROBES]→ SocraticProbes    │ (for Narrator's corpus-grounded output)   │
 * │                      │ Mentor probes after  │ Step -[REQUIRES]→ SafetyHazards   │                                           │
 * │                      │ each action          │ Step ←[CAUSES]- FailureModes      │                                           │
 * ├──────────────────────┼──────────────────────┼───────────────────────────────────┼───────────────────────────────────────────┤
 * │ probe-context        │ Socratic: Mentor     │ SocraticProbe ← PROBES ─ node     │ KB-candidate passage for the linked       │
 * │                      │ needs to evaluate a  │ probe.expectedConcepts as anchors │ concept (tacit knowledge files)           │
 * │                      │ learner's answer     │ probe.commonWrongAnswers for hints │                                           │
 * ├──────────────────────┼──────────────────────┼───────────────────────────────────┼───────────────────────────────────────────┤
 * │ safety-gate          │ Any time a           │ node -[REQUIRES]→ SafetyHazard    │ OSHA/NIOSH passage matching the hazard    │
 * │                      │ CorrectiveAction or  │ (all immediate REQUIRES edges     │ type (nanoparticle, solvent, ESD)         │
 * │                      │ Step involves a known│ from any anchor)                  │                                           │
 * │                      │ hazard               │                                   │                                           │
 * ├──────────────────────┼──────────────────────┼───────────────────────────────────┼───────────────────────────────────────────┤
 * │ tacit-lookup         │ Mentor wants to      │ TacitKnowledge text match →       │ KB-candidate section for this tacit       │
 * │                      │ surface "why" behind │ outNeighbors(REQUIRES) for hazards│ concept + any linked fault text           │
 * │                      │ an action or param   │ inNeighbors(PROBES) for linked    │                                           │
 * │                      │                      │ SocraticProbes                    │                                           │
 * └──────────────────────┴──────────────────────┴───────────────────────────────────┴───────────────────────────────────────────┘
 *
 * EDGE TYPES USED BY EACH STRATEGY:
 *   fault-diagnosis : INDICATES (in), FIXED_BY (out), REQUIRES (out)
 *   step-context    : NEXT_STEP (out), PROBES (out), REQUIRES (out), CAUSES (in)
 *   probe-context   : PROBES (in — find probes attached to a node)
 *   safety-gate     : REQUIRES (out)
 *   tacit-lookup    : REQUIRES (out), PROBES (in)
 *
 * RULES FOR ADDING A NEW NODE TYPE TO THE GRAPH:
 *   1. Which strategy fires for it? Add it to the anchor type list in that strategy.
 *   2. What edges does it have? Document them in graph-utils.ts outEdgeTypes() docs.
 *   3. What does the Narrator need? Add `narratorText` field to the node and use step-context.
 *   4. What does the Mentor need? Add a SocraticProbe linked via PROBES and use probe-context.
 *   5. Safety risk? Add REQUIRES → SafetyHazard; safety-gate fires automatically.
 */

import type { AJPNode } from '../../types/ajp';
import { nodeById, outNeighbors, inNeighbors, matchNodes } from './graph-utils';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type RetrievalMode =
  | 'fault-diagnosis'
  | 'step-context'
  | 'probe-context'
  | 'safety-gate'
  | 'tacit-lookup';

export interface ContextualQuery {
  mode: RetrievalMode;
  /** Free text for semantic matching (used by fault-diagnosis, tacit-lookup). */
  text?: string;
  /** Direct node ID lookup (used by step-context, probe-context, safety-gate). */
  nodeId?: string;
  topK?: number;
}

export interface ContextualResult {
  mode: RetrievalMode;
  anchorIds: string[];
  nodes: Record<string, AJPNode[]>;
  timestamp: number;
}

// ─── Strategy: fault-diagnosis ────────────────────────────────────────────────
// Used by: InOperationView, Mentor when learner describes a symptom
// Returns: fault chains with symptoms, corrective actions, safety hazards
// Dense hint: SOP passage for the fault type

export interface FaultChain {
  fault: AJPNode;
  symptoms: AJPNode[];
  correctiveActions: AJPNode[];
  safetyHazards: AJPNode[];
  tacitNodes: AJPNode[];
  score: number;
  reachbackNote?: string;
}

export function faultDiagnosisStrategy(text: string, topK = 3): FaultChain[] {
  const chains = new Map<string, { chain: FaultChain; score: number }>();

  const symptomMatches = matchNodes(text, ['Symptom'], 6);
  for (const { node, score } of symptomMatches) {
    for (const fault of outNeighbors(node.id, 'INDICATES')) {
      const existing = chains.get(fault.id);
      const newScore = score + (existing?.score ?? 0);
      chains.set(fault.id, { chain: buildFaultChain(fault, newScore), score: newScore });
    }
  }

  const faultMatches = matchNodes(text, ['FailureMode'], 4);
  for (const { node: fault, score } of faultMatches) {
    if (!chains.has(fault.id)) {
      chains.set(fault.id, { chain: buildFaultChain(fault, score), score });
    } else {
      const e = chains.get(fault.id)!;
      chains.set(fault.id, { chain: e.chain, score: e.score + score * 0.5 });
    }
  }

  return [...chains.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((e) => ({ ...e.chain, score: e.score }));
}

function buildFaultChain(fault: AJPNode, score: number): FaultChain {
  const safetyHazards = outNeighbors(fault.id, 'REQUIRES').filter((n) => n.type === 'SafetyHazard');
  const tacitNodes = outNeighbors(fault.id, 'REQUIRES').filter((n) => n.type === 'TacitKnowledge');

  let reachbackNote: string | undefined;
  if (score < 0.5) {
    reachbackNote = 'Low match confidence — describe the symptom more specifically or consult the HD2 SOP.';
  } else if (fault.content.includes('GAP-')) {
    const m = fault.content.match(/GAP-\d+/);
    reachbackNote = m
      ? `Known corpus gap (${m[0]}) — do not proceed without verifying against site SOP.`
      : 'Known corpus gap — verify with site SOP before proceeding.';
  }

  return {
    fault,
    symptoms: inNeighbors(fault.id, 'INDICATES'),
    correctiveActions: outNeighbors(fault.id, 'FIXED_BY'),
    safetyHazards,
    tacitNodes,
    score,
    ...(reachbackNote ? { reachbackNote } : {}),
  };
}

// ─── Strategy: step-context ───────────────────────────────────────────────────
// Used by: ScenarioEngine when advancing steps; Narrator before each step output
// Returns: current step, next step, probes due at this step, hazards, faults that
//          can be triggered here (for fault-injection in scenario mode)
// Dense hint: SOP passage matching the step label

export interface StepContext {
  step: AJPNode;
  nextSteps: AJPNode[];
  probes: AJPNode[];
  safetyHazards: AJPNode[];
  triggerableFaults: AJPNode[];
  /** Pass/fail criteria for this step from VERIFIED_BY edges. */
  verificationChecks: AJPNode[];
}

export function stepContextStrategy(stepId: string): StepContext | null {
  const step = nodeById(stepId);
  if (!step || step.type !== 'Step') return null;

  return {
    step,
    nextSteps: outNeighbors(stepId, 'NEXT_STEP'),
    probes: outNeighbors(stepId, 'PROBES'),
    safetyHazards: outNeighbors(stepId, 'REQUIRES').filter((n) => n.type === 'SafetyHazard'),
    // Step -[CAUSES]→ FailureMode: outNeighbors gives faults this step can trigger
    triggerableFaults: outNeighbors(stepId, 'CAUSES'),
    verificationChecks: outNeighbors(stepId, 'VERIFIED_BY'),
  };
}

// ─── Strategy: probe-context ──────────────────────────────────────────────────
// Used by: Mentor when it needs to evaluate a learner's answer against a probe
// Entry: a node ID (Step, FailureMode, TacitKnowledge) → find attached probes
// Dense hint: KB-candidate passage for the expected concept

export interface ProbeContext {
  anchorNode: AJPNode;
  probes: AJPNode[];
}

export function probeContextStrategy(nodeId: string): ProbeContext | null {
  const anchor = nodeById(nodeId);
  if (!anchor) return null;

  // Probes point TO their teaching target via PROBES edge
  const probes = inNeighbors(nodeId, 'PROBES');

  return { anchorNode: anchor, probes };
}

// ─── Strategy: safety-gate ────────────────────────────────────────────────────
// Used by: Mentor before confirming any action that REQUIRES a SafetyHazard node;
//          Narrator when a corrective action has PPE/hazard implications
// Entry: any node ID → surface all immediate REQUIRES → SafetyHazard links
// Dense hint: OSHA/NIOSH passage matching the hazard keyword

export interface SafetyGateResult {
  sourceNode: AJPNode;
  hazards: AJPNode[];
  isBlocking: boolean;
}

export function safetyGateStrategy(nodeId: string): SafetyGateResult | null {
  const source = nodeById(nodeId);
  if (!source) return null;

  const hazards = outNeighbors(nodeId, 'REQUIRES').filter((n) => n.type === 'SafetyHazard');

  return {
    sourceNode: source,
    hazards,
    // Block progression if any hazard has High confidence (the SDS is confirmed)
    isBlocking: hazards.some((h) => h.confidence === 'High'),
  };
}

// ─── Strategy: tacit-lookup ───────────────────────────────────────────────────
// Used by: Mentor to surface the "why" behind a parameter setting or procedure step
//          when a learner asks "why do we do this?"
// Dense hint: KB-candidate tacit knowledge section for this concept

export interface TacitResult {
  matches: Array<{ node: AJPNode; score: number }>;
  linkedProbes: AJPNode[];
  linkedHazards: AJPNode[];
}

export function tacitLookupStrategy(text: string, topK = 3): TacitResult {
  const matches = matchNodes(text, ['TacitKnowledge'], topK);
  const linkedProbes: AJPNode[] = [];
  const linkedHazards: AJPNode[] = [];
  const seen = new Set<string>();

  for (const { node } of matches) {
    for (const probe of inNeighbors(node.id, 'PROBES')) {
      if (!seen.has(probe.id)) { seen.add(probe.id); linkedProbes.push(probe); }
    }
    for (const hazard of outNeighbors(node.id, 'REQUIRES')) {
      if (hazard.type === 'SafetyHazard' && !seen.has(hazard.id)) {
        seen.add(hazard.id); linkedHazards.push(hazard);
      }
    }
  }

  return { matches, linkedProbes, linkedHazards };
}

// ─── Context formatter ────────────────────────────────────────────────────────
// Turns typed graph results into a flat string the Mentor LLM can consume.
// Used by SocraticView and ScenarioView to ground evaluate() calls.

/**
 * Format probe context (from probeContextStrategy + tacitLookupStrategy) into
 * a retrieval context string for the Mentor LLM. Returns an empty string when
 * there is nothing useful to include.
 */
export function formatProbeRetrievalContext(
  probeCtx: ProbeContext | null,
  tacitResult: TacitResult,
): string {
  const parts: string[] = [];

  if (tacitResult.matches.length > 0) {
    parts.push('=== Background Knowledge (graph) ===');
    for (const { node, score } of tacitResult.matches) {
      parts.push(`[${node.id} · relevance ${Math.round(score * 100)}%]\n${node.content}`);
    }
  }

  if (tacitResult.linkedHazards.length > 0) {
    parts.push('=== Safety Considerations ===');
    for (const h of tacitResult.linkedHazards) {
      const alert = h.safetyAlert ? `⚠ ${h.safetyAlert} — ` : '';
      parts.push(`[${h.id}] ${alert}${h.content}`);
    }
  }

  if (probeCtx && probeCtx.probes.length > 0) {
    parts.push('=== Related Probe Concepts ===');
    for (const p of probeCtx.probes) {
      if (p.expectedConcepts && p.expectedConcepts.length > 0) {
        parts.push(`[${p.id}] Expected concepts: ${p.expectedConcepts.join(', ')}`);
      }
    }
  }

  return parts.join('\n\n');
}

// ─── Router ───────────────────────────────────────────────────────────────────
// Convenience dispatcher — callers can pass a ContextualQuery without knowing
// which strategy handles it.

export function retrieveForContext(query: ContextualQuery): ContextualResult {
  const { mode, text = '', nodeId = '', topK = 3 } = query;
  const timestamp = Date.now();

  switch (mode) {
    case 'fault-diagnosis': {
      const chains = faultDiagnosisStrategy(text, topK);
      return {
        mode,
        anchorIds: chains.map((c) => c.fault.id),
        nodes: {
          faults: chains.map((c) => c.fault),
          symptoms: chains.flatMap((c) => c.symptoms),
          actions: chains.flatMap((c) => c.correctiveActions),
          hazards: chains.flatMap((c) => c.safetyHazards),
          tacit: chains.flatMap((c) => c.tacitNodes),
        },
        timestamp,
      };
    }

    case 'step-context': {
      const ctx = stepContextStrategy(nodeId);
      if (!ctx) return { mode, anchorIds: [], nodes: {}, timestamp };
      return {
        mode,
        anchorIds: [ctx.step.id],
        nodes: {
          step: [ctx.step],
          nextSteps: ctx.nextSteps,
          probes: ctx.probes,
          hazards: ctx.safetyHazards,
          faults: ctx.triggerableFaults,
          verifications: ctx.verificationChecks,
        },
        timestamp,
      };
    }

    case 'probe-context': {
      const ctx = probeContextStrategy(nodeId);
      if (!ctx) return { mode, anchorIds: [], nodes: {}, timestamp };
      return {
        mode,
        anchorIds: [ctx.anchorNode.id],
        nodes: { anchor: [ctx.anchorNode], probes: ctx.probes },
        timestamp,
      };
    }

    case 'safety-gate': {
      const ctx = safetyGateStrategy(nodeId);
      if (!ctx) return { mode, anchorIds: [], nodes: {}, timestamp };
      return {
        mode,
        anchorIds: [ctx.sourceNode.id],
        nodes: { source: [ctx.sourceNode], hazards: ctx.hazards },
        timestamp,
      };
    }

    case 'tacit-lookup': {
      const result = tacitLookupStrategy(text, topK);
      return {
        mode,
        anchorIds: result.matches.map((m) => m.node.id),
        nodes: {
          tacit: result.matches.map((m) => m.node),
          probes: result.linkedProbes,
          hazards: result.linkedHazards,
        },
        timestamp,
      };
    }
  }
}
