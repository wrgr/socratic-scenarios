/**
 * Citation integrity for the AJP knowledge graph.
 *
 * corpus-integrity.test.ts covers graph *structure* (dangling edges, duplicate
 * IDs). This file covers *provenance*: every SRC-### citation embedded in a
 * node's `source` or `content` field must resolve to a real entry in
 * source-ref-registry.ts, and no node may ship with an unfilled authoring
 * template placeholder (see the NODE TEMPLATE block in tacit-knowledge.ts).
 *
 * Uses graph-utils.ts's `allNodes` — the same combined graph every retrieval
 * strategy queries at runtime — rather than re-assembling the node list here,
 * so this test can't silently miss a corpus file the way an earlier version
 * of it missed parameters.ts's parameterNodes/verificationCheckNodes.
 */
import { describe, it, expect } from 'vitest';
import { allNodes } from '../../../engine/retrieval/graph-utils';
import { getDanglingCitations, getDanglingKbDocCitations, findSrcIds } from '../../source-usage';

describe('Corpus citation integrity', () => {
  it('every SRC-### referenced anywhere in the corpus resolves in the registry', () => {
    const dangling = getDanglingCitations();
    const report = dangling.map((d) => `${d.sourceId}: cited by ${d.nodeIds.join(', ')}`);
    expect(report, `Dangling SRC-### citations:\n${report.join('\n')}`).toHaveLength(0);
  });

  it('every KB-DOC-## referenced anywhere in the corpus resolves in KB_DOC_RECORDS', () => {
    const dangling = getDanglingKbDocCitations();
    const report = dangling.map((d) => `${d.sourceId}: cited by ${d.nodeIds.join(', ')}`);
    expect(report, `Dangling KB-DOC-## citations:\n${report.join('\n')}`).toHaveLength(0);
  });

  it('no node.source is an unfilled authoring template placeholder', () => {
    // Guards against the literal placeholder documented in the tacit-knowledge.ts
    // NODE TEMPLATE comment ("Expert interview YYYY-MM-DD, [expert role], or doc
    // ref") — or similar TBD/TODO markers — ever landing in real node data.
    const placeholderPatterns = [/YYYY-MM-DD/, /\[expert role\]/i, /\bTBD\b/i, /\bTODO\b/i];
    const bad = allNodes
      .filter((n) => n.source && placeholderPatterns.some((p) => p.test(n.source as string)))
      .map((n) => `${n.id}: source="${n.source}"`);
    expect(bad, `Unfilled placeholder source strings:\n${bad.join('\n')}`).toHaveLength(0);
  });

  it('every node with a source citation has non-empty content to attribute', () => {
    const bad = allNodes
      .filter((n) => n.source && n.source.trim().length > 0 && !n.content?.trim())
      .map((n) => n.id);
    expect(bad).toHaveLength(0);
  });

  it('findSrcIds extracts every distinct SRC-### id from mixed citation text', () => {
    expect(findSrcIds('SRC-018 §3.2, Islam 2025; also SRC-019 and SRC-018 again')).toEqual(
      expect.arrayContaining(['SRC-018', 'SRC-019']),
    );
    expect(findSrcIds(undefined)).toEqual([]);
    expect(findSrcIds('no citations here')).toEqual([]);
  });
});
