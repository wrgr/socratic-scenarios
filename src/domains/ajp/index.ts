/**
 * AJP domain — the "EDDIE" instantiation of TeachMe: Aerosol Jet Printing
 * operator training on the Optomec HD2.
 *
 * This module assembles the combined knowledge graph from the hand-authored
 * corpus in src/corpus/ajp/*, and packages it (with identity + dense-corpus
 * refs) as a DomainConfig. The engine reads this via the active-domain context
 * rather than importing the corpus directly — see src/domains/domain-context.ts.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';
import type { DomainConfig } from '../../types';

import { ajpNodes, ajpEdges } from '../../corpus/ajp/graph';
import {
  extendedSymptomNodes,
  extendedFaultNodes,
  extendedActionNodes,
  extendedEdges,
} from '../../corpus/ajp/graph-faults';
import {
  designFaultNodes,
  designSymptomNodes,
  designTacitNodes,
  designFaultEdges,
} from '../../corpus/ajp/design-faults';
import { designActionNodes, designActionEdges } from '../../corpus/ajp/design-actions';
import { consequenceNodes, consequenceEdges } from '../../corpus/ajp/consequences';
import { tacitKnowledgeNodes, tacitKnowledgeEdges } from '../../corpus/ajp/tacit-knowledge';
import { ajpProbeNodes, ajpProbeEdges } from '../../corpus/ajp/probes';
import {
  parameterNodes,
  verificationCheckNodes,
  parameterEdges,
  supportedByEdges,
} from '../../corpus/ajp/parameters';

// ─── Combined graph (assembled once at module load) ───────────────

const nodes: AJPNode[] = [
  ...ajpNodes,
  ...extendedSymptomNodes,
  ...extendedFaultNodes,
  ...extendedActionNodes,
  ...designFaultNodes,
  ...designSymptomNodes,
  ...designTacitNodes,
  ...designActionNodes,
  ...consequenceNodes,
  ...tacitKnowledgeNodes,
  ...ajpProbeNodes,
  ...parameterNodes,
  ...verificationCheckNodes,
];

const edges: AJPEdge[] = [
  ...ajpEdges,
  ...extendedEdges,
  ...designFaultEdges,
  ...designActionEdges,
  ...consequenceEdges,
  ...tacitKnowledgeEdges,
  ...ajpProbeEdges,
  ...parameterEdges,
  ...supportedByEdges,
];

export const ajpDomain: DomainConfig = {
  id: 'ajp',
  product: 'TeachMe',
  instantiation: 'EDDIE',
  name: 'Aerosol Jet Printing — Optomec HD2',
  subtitle: 'Aerosol Jet Printer Demo',
  description:
    'Corpus-bounded operator training for Aerosol Jet Printing on the Optomec HD2: ' +
    'safety-gated startup/shutdown, fault diagnosis, and tacit process knowledge.',
  graph: { nodes, edges },
  denseCorpus: {
    corpusUrl: 'ajp-corpus.json',
    nodeEmbeddingsUrl: 'ajp-node-embeddings.json',
  },
};
