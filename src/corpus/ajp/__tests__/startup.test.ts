/** Verify cold-start domain registration keeps the AJP graph visible before and after boot. */
import { expect, it, vi } from 'vitest';

it('registers the assembled AJP graph before the retrieval engine boots', async () => {
  // Global test setup boots first, so reload modules to reproduce a fresh browser.
  vi.resetModules();
  await import('../../domains');
  const { getDomain } = await import('../../registry');
  const { ajpDomain: config } = await import('../../../domains/ajp');
  const engine = await import('../../../engine/retrieval/graph-utils');
  const descriptor = getDomain('ajp-electronics-repair')!;

  expect(engine.allNodes).toHaveLength(0);
  expect(engine.allEdges).toHaveLength(0);
  expect(descriptor.nodes.length).toBeGreaterThan(0);
  expect(descriptor.edges.length).toBeGreaterThan(0);
  expect(descriptor.nodes).toBe(config.graph.nodes);
  expect(descriptor.edges).toBe(config.graph.edges);

  const { bootActiveDomain } = await import('../../../domains/boot');
  bootActiveDomain();
  expect(descriptor.nodes).toBe(engine.allNodes);
  expect(descriptor.edges).toBe(engine.allEdges);

  // An engine rebind must never erase the independently registered AJP corpus.
  engine.bindDomainGraph({ nodes: [], edges: [] });
  expect(descriptor.nodes).toBe(config.graph.nodes);
  expect(descriptor.nodes.length).toBeGreaterThan(0);
  bootActiveDomain();
});
