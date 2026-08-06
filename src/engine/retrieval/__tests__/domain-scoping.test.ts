/**
 * domain-scoping.test.ts
 *
 * Regression guard for the cross-domain "background knowledge" leak: retrieval
 * strategies must search the ACTIVE domain's graph, not the baked AJP graph.
 * Before the GraphView fix, a tire probe token-matched AJP TacitKnowledge nodes
 * (e.g. TACIT-ASSEMBLY-TUBING-001) because they were the only tacit nodes in
 * the global graph.
 */
import { describe, expect, it } from 'vitest';
import { tacitLookupStrategy, graphViewForDomain, retrieveForContext } from '../retrieval-router';
import { tireDomain } from '../../../corpus/tire';
import { colregDomain } from '../../../corpus/colreg';
import { ajpDomain } from '../../../corpus/ajp';

const ajpTacitIds = new Set(
  ajpDomain.nodes.filter((n) => n.type === 'TacitKnowledge').map((n) => n.id),
);

// The real tire "secure the vehicle" Socratic probe (src/corpus/tire/probes.ts).
const TIRE_PROBE_TEXT =
  'Before you lift the car even an inch, what must you do to keep it from moving — and why is each of those steps necessary?';

describe('domain-scoped retrieval (graphViewForDomain)', () => {
  it('scopes a tire probe to the tire graph — never surfaces AJP tacit knowledge', () => {
    const tireGraph = graphViewForDomain(tireDomain);
    const result = tacitLookupStrategy(TIRE_PROBE_TEXT, 3, tireGraph);

    // Every match (if any) must belong to the tire corpus, never AJP.
    const tireNodeIds = new Set(tireDomain.nodes.map((n) => n.id));
    for (const { node } of result.matches) {
      expect(node.type).toBe('TacitKnowledge');
      expect(ajpTacitIds.has(node.id)).toBe(false);
      expect(tireNodeIds.has(node.id)).toBe(true);
    }
    // Explicitly: the two nodes the bug report saw must not appear.
    const ids = result.matches.map((m) => m.node.id);
    expect(ids).not.toContain('TACIT-ASSEMBLY-TUBING-001');
    expect(ids).not.toContain('TACIT-DIAGNOSIS-SINGLE-CHANGE-001');
  });

  it('tire graph still surfaces its OWN tacit knowledge for a relevant query', () => {
    const tireGraph = graphViewForDomain(tireDomain);
    const result = tacitLookupStrategy(
      'judge the ground surface before jacking on a soft sloped shoulder',
      3,
      tireGraph,
    );
    expect(result.matches.map((m) => m.node.id)).toContain('TACIT-TIRE-GROUND-CHECK-001');
  });

  it('default (unscoped) lookup preserves AJP behavior for AJP surfaces', () => {
    const result = tacitLookupStrategy('single change one parameter per test cycle when diagnosing', 3);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every((m) => m.node.type === 'TacitKnowledge')).toBe(true);
    // Default scope is AJP: no tire node ever leaks in.
    expect(result.matches.every((m) => ajpTacitIds.has(m.node.id))).toBe(true);
  });

  it('tire surfaces its authored torque tacit knowledge for a torque probe', () => {
    const tireGraph = graphViewForDomain(tireDomain);
    const result = tacitLookupStrategy(
      'tighten the lug nuts in a star pattern and torque them to spec with the wheel on the ground',
      4,
      tireGraph,
    );
    const ids = result.matches.map((m) => m.node.id);
    expect(ids).toContain('TACIT-TIRE-STAR-PATTERN-001');
    // still no AJP leak
    expect(result.matches.every((m) => !ajpTacitIds.has(m.node.id))).toBe(true);
  });

  it('COLREG surfaces its OWN seamanship tacit knowledge and never AJP', () => {
    const colregGraph = graphViewForDomain(colregDomain);
    const cbdr = tacitLookupStrategy(
      'the compass bearing of the approaching vessel stays steady while the range decreases',
      3,
      colregGraph,
    );
    expect(cbdr.matches.map((m) => m.node.id)).toContain('TACIT-COLREG-CBDR-001');
    expect(cbdr.matches.every((m) => !ajpTacitIds.has(m.node.id))).toBe(true);

    const safeSpeed = tacitLookupStrategy(
      'what is a safe speed in fog and why does right of way not change it',
      3,
      colregGraph,
    );
    expect(safeSpeed.matches.every((m) => m.node.id.includes('COLREG'))).toBe(true);
  });

  it('every AJP probe has at least one PROBES→TacitKnowledge background edge', () => {
    const tacitIds = new Set(
      ajpDomain.nodes.filter((n) => n.type === 'TacitKnowledge').map((n) => n.id),
    );
    const probeIds = ajpDomain.nodes.filter((n) => n.type === 'SocraticProbe').map((n) => n.id);
    const probesWithTacit = new Set(
      ajpDomain.edges
        .filter((e) => e.type === 'PROBES' && tacitIds.has(e.to) && e.from.startsWith('PROBE-'))
        .map((e) => e.from),
    );
    const uncovered = probeIds.filter((id) => !probesWithTacit.has(id));
    expect(uncovered).toEqual([]);
  });

  it('graphViewForDomain(ajp) is equivalent to the AJP default', () => {
    const ajpView = graphViewForDomain(ajpDomain);
    const query = 'single change one parameter per test cycle when diagnosing';
    const scoped = tacitLookupStrategy(query, 3, ajpView).matches.map((m) => m.node.id);
    const def = tacitLookupStrategy(query, 3).matches.map((m) => m.node.id);
    expect(scoped).toEqual(def);
  });
});

// The convenience dispatcher must thread the SAME scope. Before this fix its cases
// called the bare strategies (always boundGraphView = AJP), so any non-AJP caller of
// retrieveForContext silently got cross-domain contamination that the strategy-level
// tests above could not catch.
describe('retrieveForContext honors query.graph scope', () => {
  it('tacit-lookup scoped to tire never surfaces AJP tacit nodes', () => {
    const scoped = retrieveForContext({
      mode: 'tacit-lookup',
      text: TIRE_PROBE_TEXT,
      topK: 3,
      graph: graphViewForDomain(tireDomain),
    });
    const tacit = scoped.nodes.tacit ?? [];
    for (const n of tacit) expect(ajpTacitIds.has(n.id)).toBe(false);
    expect(tacit.map((n) => n.id)).not.toContain('TACIT-ASSEMBLY-TUBING-001');
  });

  it('tacit-lookup with NO graph preserves AJP default behavior', () => {
    const def = retrieveForContext({
      mode: 'tacit-lookup',
      text: 'single change one parameter per test cycle when diagnosing',
      topK: 3,
    });
    const tacit = def.nodes.tacit ?? [];
    expect(tacit.length).toBeGreaterThan(0);
    expect(tacit.every((n) => ajpTacitIds.has(n.id))).toBe(true);
  });

  it('fault-diagnosis scope is threaded — a tire-scoped query returns no AJP faults', () => {
    const ajpFaultIds = new Set(
      ajpDomain.nodes.filter((n) => n.type === 'FailureMode').map((n) => n.id),
    );
    // An AJP symptom phrasing: unscoped it finds AJP faults; tire-scoped it must not.
    const symptomText = 'overspray and inconsistent line width during printing';
    const unscoped = retrieveForContext({ mode: 'fault-diagnosis', text: symptomText, topK: 3 });
    const tireScoped = retrieveForContext({
      mode: 'fault-diagnosis',
      text: symptomText,
      topK: 3,
      graph: graphViewForDomain(tireDomain),
    });
    const tireFaults = tireScoped.nodes.faults ?? [];
    for (const f of tireFaults) expect(ajpFaultIds.has(f.id)).toBe(false);
    // sanity: the unscoped (AJP) path can still find AJP faults for the same text
    expect((unscoped.nodes.faults ?? []).every((f) => ajpFaultIds.has(f.id))).toBe(true);
  });
});
