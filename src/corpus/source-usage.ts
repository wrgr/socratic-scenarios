/**
 * Cross-references the two citation registries (SRC-### external sources,
 * KB-DOC-## internal tacit-knowledge docs) against the live corpus graph:
 * which registered sources are actually cited, by which nodes, and which
 * cited IDs have no registry entry at all (dangling)? Computed, not
 * hand-maintained, so the answer can't drift from the real corpus the way
 * a manually kept "used sources" list would. Shared by the
 * citation-integrity test and the Domain Sources panel so both read from
 * one computation.
 */
import { allNodes } from '../engine/retrieval/graph-utils';
import { getSourceRefRecord, listSourceRefRecords, type SourceRefRecord } from './source-ref-registry';
import { KB_DOC_RECORDS, type KbDocRecord } from './kb-doc-registry';

const SRC_ID = /SRC-\d{3}/g;
const KB_DOC_ID = /KB-DOC-\d{2}/g;

function findIds(text: string | undefined, pattern: RegExp): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(pattern)].map((m) => m[0]))];
}

/** Distinct SRC-### ids found in a string, or []. */
export function findSrcIds(text: string | undefined): string[] {
  return findIds(text, SRC_ID);
}

/** Distinct KB-DOC-## ids found in a string, or []. */
export function findKbDocIds(text: string | undefined): string[] {
  return findIds(text, KB_DOC_ID);
}

/** Map of id → node IDs that cite it, scanning every node's source and content fields with the given finder. */
function buildCitationIndex(finder: (text: string | undefined) => string[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const node of allNodes) {
    const ids = new Set([...finder(node.source), ...finder(node.content)]);
    for (const id of ids) {
      const list = index.get(id);
      if (list) list.push(node.id);
      else index.set(id, [node.id]);
    }
  }
  return index;
}

/** Map of SRC-### id → node IDs that cite it. */
export function getCitationIndex(): Map<string, string[]> {
  return buildCitationIndex(findSrcIds);
}

/** Map of KB-DOC-## id → node IDs that cite it. */
export function getKbDocCitationIndex(): Map<string, string[]> {
  return buildCitationIndex(findKbDocIds);
}

export interface RegistrySourceUsage extends SourceRefRecord {
  citedByNodeIds: string[];
}

/** Every registry source paired with which corpus nodes actually cite it (may be empty). */
export function getRegistryUsageReport(): RegistrySourceUsage[] {
  const index = getCitationIndex();
  return listSourceRefRecords().map((r) => ({
    ...r,
    citedByNodeIds: index.get(r.id) ?? [],
  }));
}

/** SRC-### ids cited somewhere in the corpus but missing from the registry entirely. */
export function getDanglingCitations(): Array<{ sourceId: string; nodeIds: string[] }> {
  const index = getCitationIndex();
  const dangling: Array<{ sourceId: string; nodeIds: string[] }> = [];
  for (const [id, nodeIds] of index) {
    if (!getSourceRefRecord(id)) dangling.push({ sourceId: id, nodeIds });
  }
  return dangling;
}

export interface KbDocUsage extends KbDocRecord {
  citedByNodeIds: string[];
  /** True for docs bundled elsewhere in the app (e.g. as a downloadable reference) even without a node citation. */
  surfacedElsewhere: boolean;
}

// KB-DOC-09/10 are bundled as downloadable references in the Mission/Pedagogy
// panel (ajp-background-model.data.ts) — surfaced to users without ever being
// cited on a specific graph node.
const KB_DOC_SURFACED_ELSEWHERE = new Set(['KB-DOC-09', 'KB-DOC-10']);

/** Every KB-DOC-## doc paired with which corpus nodes cite it (may be empty). */
export function getKbDocUsageReport(): KbDocUsage[] {
  const index = getKbDocCitationIndex();
  return KB_DOC_RECORDS.map((r) => ({
    ...r,
    citedByNodeIds: index.get(r.id) ?? [],
    surfacedElsewhere: KB_DOC_SURFACED_ELSEWHERE.has(r.id),
  }));
}

/** KB-DOC-## ids cited somewhere in the corpus but missing from the KB_DOC_RECORDS catalog entirely. */
export function getDanglingKbDocCitations(): Array<{ sourceId: string; nodeIds: string[] }> {
  const index = getKbDocCitationIndex();
  const known = new Set(KB_DOC_RECORDS.map((r) => r.id));
  const dangling: Array<{ sourceId: string; nodeIds: string[] }> = [];
  for (const [id, nodeIds] of index) {
    if (!known.has(id)) dangling.push({ sourceId: id, nodeIds });
  }
  return dangling;
}
