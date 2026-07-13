/**
 * Corpus integrity tests for the AJP knowledge graph.
 * Verifies that every edge target exists as a node, every scenario reference
 * resolves to a real node, and no duplicate node IDs exist.
 * These are the class of checks that would have caught the two broken edge
 * references (FAULT-OVERSPRAY-001, FAULT-WEAK-ATOMIZATION-001) before merge.
 */
import { describe, it, expect } from 'vitest';

// Corpus data
import { ajpNodes, ajpEdges } from '../graph';
import { extendedSymptomNodes, extendedFaultNodes, extendedActionNodes, extendedEdges } from '../graph-faults';
import { designFaultNodes, designSymptomNodes, designTacitNodes, designFaultEdges } from '../design-faults';
import { designActionNodes, designActionEdges } from '../design-actions';
import { consequenceNodes, consequenceEdges } from '../consequences';
import { ajpProbeNodes, ajpProbeEdges } from '../probes';
import { tacitKnowledgeNodes, tacitKnowledgeEdges } from '../tacit-knowledge';
import { ajpScenarioScripts } from '../scenario-scripts';

// Combined graph (mirrors graph-retrieval.ts allNodes/allEdges)
const allNodes = [
  ...ajpNodes,
  ...extendedSymptomNodes,
  ...extendedFaultNodes,
  ...extendedActionNodes,
  ...designFaultNodes,
  ...designSymptomNodes,
  ...designTacitNodes,
  ...designActionNodes,
  ...consequenceNodes,
  ...ajpProbeNodes,
  ...tacitKnowledgeNodes,
];

const allEdges = [
  ...ajpEdges,
  ...extendedEdges,
  ...designFaultEdges,
  ...designActionEdges,
  ...consequenceEdges,
  ...ajpProbeEdges,
  ...tacitKnowledgeEdges,
];

const nodeIds = new Set(allNodes.map((n) => n.id));

// ─── Node uniqueness ──────────────────────────────────────────────

describe('Node IDs are unique', () => {
  it('has no duplicate node IDs across the full graph', () => {
    const ids = allNodes.map((n) => n.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `Duplicate IDs: ${dupes.join(', ')}`).toHaveLength(0);
  });

  it('all nodes have non-empty id and content', () => {
    const bad = allNodes.filter((n) => !n.id || !n.content);
    expect(bad.map((n) => n.id), 'Nodes with missing id or content').toHaveLength(0);
  });
});

// ─── Edge referential integrity ───────────────────────────────────

describe('Edge referential integrity', () => {
  it('every edge.from references an existing node', () => {
    const broken = allEdges.filter((e) => !nodeIds.has(e.from));
    const report = broken.map((e) => `${e.from} → ${e.to} (${e.type})`);
    expect(report, `Broken edge sources:\n${report.join('\n')}`).toHaveLength(0);
  });

  it('every edge.to references an existing node', () => {
    const broken = allEdges.filter((e) => !nodeIds.has(e.to));
    const report = broken.map((e) => `${e.from} → ${e.to} (${e.type})`);
    expect(report, `Broken edge targets:\n${report.join('\n')}`).toHaveLength(0);
  });
});

// ─── Consequence node integrity ───────────────────────────────────

describe('Consequence nodes', () => {
  it('every linkedFaultId references an existing node', () => {
    const broken = consequenceNodes.filter((c) => !nodeIds.has(c.linkedFaultId));
    const report = broken.map((c) => `${c.id} → linkedFaultId: ${c.linkedFaultId}`);
    expect(report, `Broken consequence linkedFaultIds:\n${report.join('\n')}`).toHaveLength(0);
  });

  it('every consequence has a non-empty immediateAction', () => {
    const bad = consequenceNodes.filter((c) => !c.immediateAction?.trim());
    expect(bad.map((c) => c.id)).toHaveLength(0);
  });

  it('severity is one of the allowed values', () => {
    const allowed = new Set(['human', 'machine', 'part']);
    const bad = consequenceNodes.filter((c) => !allowed.has(c.severity));
    expect(bad.map((c) => c.id)).toHaveLength(0);
  });
});

// ─── Scenario script integrity ────────────────────────────────────

describe('Scenario scripts — 6 scenarios defined', () => {
  it('has exactly 6 scenarios', () => {
    expect(ajpScenarioScripts).toHaveLength(6);
  });

  it('all scenario IDs are unique', () => {
    const ids = ajpScenarioScripts.map((s) => s.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `Duplicate scenario IDs: ${dupes.join(', ')}`).toHaveLength(0);
  });

  it('every scenario has at least one step', () => {
    const empty = ajpScenarioScripts.filter((s) => s.steps.length === 0);
    expect(empty.map((s) => s.id)).toHaveLength(0);
  });
});

describe('Scenario scripts — step references resolve', () => {
  for (const scenario of ajpScenarioScripts) {
    describe(scenario.id, () => {
      it('all step IDs are unique within the scenario', () => {
        const ids = scenario.steps.map((s) => s.id);
        const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
        expect(dupes, `Duplicate step IDs: ${dupes.join(', ')}`).toHaveLength(0);
      });

      it('every mentorProbeId references an existing probe node', () => {
        const broken = scenario.steps
          .filter((s) => s.mentorProbeId && !nodeIds.has(s.mentorProbeId))
          .map((s) => `${s.id}: mentorProbeId=${s.mentorProbeId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });

      it('every safetyGateNodeId references an existing node', () => {
        const broken = scenario.steps
          .filter((s) => s.safetyGateNodeId && !nodeIds.has(s.safetyGateNodeId))
          .map((s) => `${s.id}: safetyGateNodeId=${s.safetyGateNodeId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });

      it('every faultInjectionId references an existing node', () => {
        const broken = scenario.steps
          .filter((s) => s.faultInjectionId && !nodeIds.has(s.faultInjectionId))
          .map((s) => `${s.id}: faultInjectionId=${s.faultInjectionId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });
    });
  }
});

describe('Scenario scripts — fault injection references resolve', () => {
  for (const scenario of ajpScenarioScripts) {
    if (scenario.faultInjections.length === 0) continue;
    describe(scenario.id, () => {
      it('every faultNodeId references an existing node', () => {
        const broken = scenario.faultInjections
          .filter((fi) => !nodeIds.has(fi.faultNodeId))
          .map((fi) => `faultNodeId=${fi.faultNodeId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });

      it('every triggerStepId references a step in this scenario', () => {
        const stepIds = new Set(scenario.steps.map((s) => s.id));
        const broken = scenario.faultInjections
          .filter((fi) => !stepIds.has(fi.triggerStepId))
          .map((fi) => `triggerStepId=${fi.triggerStepId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });

      it('every missedConsequenceId references an existing consequence node', () => {
        const consequenceIds = new Set(consequenceNodes.map((c) => c.id));
        const broken = scenario.faultInjections
          .filter((fi) => !consequenceIds.has(fi.missedConsequenceId))
          .map((fi) => `missedConsequenceId=${fi.missedConsequenceId}`);
        expect(broken, broken.join('\n')).toHaveLength(0);
      });
    });
  }
});

// ─── Probe node schema ────────────────────────────────────────────

describe('Probe nodes', () => {
  it('every probe has expectedConcepts with at least one entry', () => {
    const bad = ajpProbeNodes.filter(
      (p) => !p.expectedConcepts || p.expectedConcepts.length === 0,
    );
    expect(bad.map((p) => p.id)).toHaveLength(0);
  });

  it('masteryThreshold is between 0 and 1 when present', () => {
    const bad = ajpProbeNodes.filter(
      (p) => p.masteryThreshold !== undefined &&
             (p.masteryThreshold < 0 || p.masteryThreshold > 1),
    );
    expect(bad.map((p) => p.id)).toHaveLength(0);
  });

  it('safety-critical probes have masteryThreshold >= 0.90', () => {
    // Probes with safetyAlert set or safetyGate flag should require 0.90 threshold
    const safetyProbes = ajpProbeNodes.filter((p) => p.safetyAlert);
    const insufficientThreshold = safetyProbes.filter(
      (p) => (p.masteryThreshold ?? 0.80) < 0.90,
    );
    expect(
      insufficientThreshold.map((p) => `${p.id} (threshold=${p.masteryThreshold})`),
    ).toHaveLength(0);
  });
});
