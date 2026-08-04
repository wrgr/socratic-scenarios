/**
 * Domain descriptor — the pluggable unit of teaching content.
 *
 * TeachMe's architecture (typed knowledge graph → corpus-bound Narrator →
 * Socratic Mentor → mastery/safety gates → readiness) is domain-agnostic; a
 * `DomainDescriptor` bundles everything a domain needs to drive Scenario Mode,
 * Socratic Practice, and the Dashboard. Each domain module assembles one of
 * these and calls `registerDomain` (see ./registry) on import.
 *
 * AJP is the original, engine-backed domain (`fullEngine: true`) — its graph is
 * also baked into the retrieval/narrator layer, so the retrieval-heavy surfaces
 * (Reachback, Retrieval Lab, Workflow Demo) only apply to it. New domains ride
 * the same Scenario/Socratic/Dashboard paradigm without that engine wiring.
 */
import type { AJPNode, AJPEdge } from '../types/ajp';
import type { ScenarioDefinition } from '../engine/scenario/types';
import type { ConsequenceNode } from './ajp/consequences';
import type { DomainId } from '../types';

export interface DomainDescriptor {
  id: DomainId;
  /** Short name shown in the domain switcher, e.g. "Roadside Tire Change". */
  name: string;
  /** Masthead sub-title shown in the app header when this domain is active. */
  masthead: string;
  /** One-line description used on the dashboard / Socratic header. */
  blurb: string;
  /** Full knowledge-graph nodes (steps, params, faults, hazards, actions, tacit…). */
  nodes: AJPNode[];
  /** Typed directed edges over `nodes`. */
  edges: AJPEdge[];
  /** Scripted scenarios for Scenario Mode. */
  scenarios: ScenarioDefinition[];
  /** SocraticProbe nodes for Socratic Practice + scenario mentor probes. */
  probes: AJPNode[];
  /** Consequence nodes activated when a learner skips a safety gate. */
  consequences: ConsequenceNode[];
  /** Phase-key → human label map for this domain's scenario phases. */
  phaseLabels: Record<string, string>;
  /**
   * True only for AJP: this domain's graph is baked into the retrieval + narrator
   * engine, so the retrieval-heavy surfaces (Reachback, Retrieval Lab, Workflow
   * Demo) and the AJP safety-gate pre-flight apply. New domains leave this false.
   */
  fullEngine?: boolean;
  /** True if this domain has an interactive kinematic simulator (COLREG only). */
  hasSimulator?: boolean;
}
