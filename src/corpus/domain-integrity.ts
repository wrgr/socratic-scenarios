/**
 * Reusable corpus-integrity checker for any DomainDescriptor.
 *
 * Mirrors the invariants enforced for AJP in
 * src/corpus/ajp/__tests__/corpus-integrity.test.ts, but parameterised over a
 * descriptor so every domain (tire, COLREG, …) validates against the same rules.
 * Returns a list of human-readable issue strings — an empty array means the
 * domain's data is structurally sound. Kept free of any test-runner import so it
 * can be reused outside tests.
 */
import type { DomainDescriptor } from './types';

const SEVERITIES = new Set(['human', 'machine', 'part']);

export function collectDomainIssues(d: DomainDescriptor): string[] {
  const issues: string[] = [];

  // Combined node set: graph nodes + probes + consequences (mirrors the runtime
  // union and the AJP integrity test's allNodes).
  const allNodes = [...d.nodes, ...d.probes, ...d.consequences];
  const nodeIds = new Set(allNodes.map((n) => n.id));
  const probeIds = new Set(d.probes.map((p) => p.id));
  const consequenceIds = new Set(d.consequences.map((c) => c.id));

  // ── Node uniqueness + content ──
  const seen = new Set<string>();
  for (const n of allNodes) {
    if (seen.has(n.id)) issues.push(`duplicate node id: ${n.id}`);
    seen.add(n.id);
    if (!n.id) issues.push('node with empty id');
    if (!n.content || !n.content.trim()) issues.push(`node with empty content: ${n.id}`);
  }

  // ── Edge referential integrity ──
  for (const e of d.edges) {
    if (!nodeIds.has(e.from)) issues.push(`edge.from missing node: ${e.from} → ${e.to} (${e.type})`);
    if (!nodeIds.has(e.to)) issues.push(`edge.to missing node: ${e.from} → ${e.to} (${e.type})`);
  }

  // ── Consequence nodes ──
  for (const c of d.consequences) {
    if (!nodeIds.has(c.linkedFaultId)) issues.push(`${c.id}: linkedFaultId missing node ${c.linkedFaultId}`);
    if (!c.immediateAction?.trim()) issues.push(`${c.id}: empty immediateAction`);
    if (!SEVERITIES.has(c.severity)) issues.push(`${c.id}: invalid severity ${c.severity}`);
  }

  // ── Scenario scripts ──
  const scenarioIds = new Set<string>();
  for (const s of d.scenarios) {
    if (scenarioIds.has(s.id)) issues.push(`duplicate scenario id: ${s.id}`);
    scenarioIds.add(s.id);
    if (s.steps.length === 0) issues.push(`${s.id}: no steps`);

    const stepIds = new Set<string>();
    for (const step of s.steps) {
      if (stepIds.has(step.id)) issues.push(`${s.id}: duplicate step id ${step.id}`);
      stepIds.add(step.id);
      if (step.mentorProbeId && !probeIds.has(step.mentorProbeId)) {
        issues.push(`${s.id}/${step.id}: mentorProbeId not a probe: ${step.mentorProbeId}`);
      }
      if (step.safetyGateNodeId && !nodeIds.has(step.safetyGateNodeId)) {
        issues.push(`${s.id}/${step.id}: safetyGateNodeId missing node: ${step.safetyGateNodeId}`);
      }
      if (step.faultInjectionId && !nodeIds.has(step.faultInjectionId)) {
        issues.push(`${s.id}/${step.id}: faultInjectionId missing node: ${step.faultInjectionId}`);
      }
    }

    for (const fi of s.faultInjections) {
      if (!nodeIds.has(fi.faultNodeId)) issues.push(`${s.id}: fault injection faultNodeId missing node: ${fi.faultNodeId}`);
      if (!stepIds.has(fi.triggerStepId)) issues.push(`${s.id}: fault injection triggerStepId not in scenario: ${fi.triggerStepId}`);
      if (!consequenceIds.has(fi.missedConsequenceId)) issues.push(`${s.id}: missedConsequenceId not a consequence: ${fi.missedConsequenceId}`);
    }
  }

  // ── Probe nodes ──
  for (const p of d.probes) {
    if (!p.expectedConcepts || p.expectedConcepts.length === 0) {
      issues.push(`${p.id}: probe has no expectedConcepts`);
    }
    if (p.masteryThreshold !== undefined && (p.masteryThreshold < 0 || p.masteryThreshold > 1)) {
      issues.push(`${p.id}: masteryThreshold out of range: ${p.masteryThreshold}`);
    }
    if (p.safetyAlert && (p.masteryThreshold ?? 0.8) < 0.9) {
      issues.push(`${p.id}: safety-critical probe must have masteryThreshold >= 0.90 (has ${p.masteryThreshold})`);
    }
  }

  return issues;
}
