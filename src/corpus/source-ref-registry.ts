/**
 * Canonical metadata for SRC-### citation IDs used across the AJP corpus.
 * Every ID here should also appear in sources/SOURCES_LOG.md.
 */

export interface SourceRefRecord {
  id: string;
  title: string;
  author: string | null;
  url: string | null;
  /** Short plain-language description for UI popovers. */
  summary: string;
}

const records: SourceRefRecord[] = [
  {
    id: 'SRC-001',
    title: 'HD2 launch specifications (trade press)',
    author: null,
    url: 'https://3dprintingindustry.com/news/optomec-launches-new-aerosol-jet-hd2-electronics-3d-printer-technical-specifications-and-pricing-182453/',
    summary: 'News coverage of Optomec HD2 launch with public-facing technical specifications and positioning.',
  },
  {
    id: 'SRC-002',
    title: 'Optomec HD2 datasheet',
    author: 'Optomec',
    url: 'https://optomec.com/wp-content/uploads/2021/06/HD2-Datasheet_2-1.pdf',
    summary: 'Vendor datasheet for the HD2 aerosol jet platform: hardware capabilities and headline process limits.',
  },
  {
    id: 'SRC-003',
    title: 'Multifunctional inks in aerosol jet printing',
    author: null,
    url: 'https://www.frontiersin.org/journals/manufacturing-technology/articles/10.3389/fmtec.2025.1558209/full',
    summary: 'Peer-reviewed survey of multifunctional AJP inks, formulation constraints, and deposition behavior.',
  },
  {
    id: 'SRC-004',
    title: 'Pneumatic aerosol jet process optimization',
    author: null,
    url: 'https://www.nature.com/articles/s41598-023-47544-4',
    summary: 'Scientific Reports parametric study linking gas flows, nozzle conditions, and line quality in pneumatic AJP.',
  },
  {
    id: 'SRC-005',
    title: 'AJP of 3D pillar arrays',
    author: null,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9412835/',
    summary: 'PMC article on pillar-array printing with AJP; useful for feature-scale and process-window context.',
  },
  {
    id: 'SRC-006',
    title: 'Mist flow visualization (preprint)',
    author: null,
    url: 'https://arxiv.org/pdf/1805.11015',
    summary: 'arXiv paper on mist/plume flow visualization relevant to atomization and gas-delivery intuition.',
  },
  {
    id: 'SRC-007',
    title: 'Sintering silver nanoparticle ink (conference abstract)',
    author: null,
    url: 'https://academic.oup.com/mam/article/30/Supplement_1/ozae044.1002/7720298',
    summary: 'Microscopy & Microanalysis piece on Ag NP ink sintering behavior and conductivity development.',
  },
  {
    id: 'SRC-008',
    title: 'Water vapor assisted sintering',
    author: null,
    url: 'https://link.springer.com/article/10.1007/s42452-019-0542-0',
    summary: 'Applied-sciences study on humidity / vapor influences on nanoparticle sintering outcomes.',
  },
  {
    id: 'SRC-009',
    title: 'Ag nanoparticle ink conductivity after sintering',
    author: null,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8437949/',
    summary: 'PMC work tying sintering conditions to electrical performance of printed Ag NP traces.',
  },
  {
    id: 'SRC-010',
    title: 'Moderate-temperature sintering of Ag nanoparticles (review)',
    author: null,
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6539082/',
    summary: 'PMC review summarizing practical sintering windows and failure modes for Ag NP films.',
  },
  {
    id: 'SRC-011',
    title: 'NIOSH CIB 70 — occupational exposure to silver nanomaterials',
    author: 'NIOSH / CDC',
    url: 'https://www.cdc.gov/niosh/docs/2021-112/default.html',
    summary: 'NIOSH criteria document establishing recommended exposure limits, surveillance guidance, and health-risk controls for silver nanomaterials in workplace air.',
  },
  {
    id: 'SRC-012',
    title: 'AIHA summary — NIOSH REL for silver nanomaterials',
    author: null,
    url: 'https://www.aiha.org/news/210610-niosh-derives-new-rel-for-occupational-exposure-to-silver-nanomaterials',
    summary: 'Professional society overview of NIOSH-derived exposure limits for Ag nanomaterials.',
  },
  {
    id: 'SRC-013',
    title: 'NIH ORS nanotechnology safety and health program',
    author: 'NIH',
    url: 'https://ors.od.nih.gov/sr/dohs/Documents/nanotechnology-safety-and-health-program.pdf',
    summary: 'Institutional nanomaterial safety program guidance including exposure control themes.',
  },
  {
    id: 'SRC-014',
    title: 'Acoustic-enhanced aerosol jet printing',
    author: null,
    url: 'https://www.nature.com/articles/s41467-024-50789-w',
    summary: 'Nature Communications article on acoustic augmentation of AJP process behavior.',
  },
  {
    id: 'SRC-015',
    title: 'Aging and fatigue of printed Ag traces',
    author: null,
    url: 'https://asmedigitalcollection.asme.org/electronicpackaging/article/143/2/021006/1087524',
    summary: 'ASME packaging article on reliability and fatigue of aerosol-jetted silver interconnects.',
  },
  {
    id: 'SRC-016',
    title: 'Optomec — aerosol jet technology overview',
    author: 'Optomec',
    url: 'https://optomec.com/printed-electronics/aerosol-jet-technology/',
    summary: 'Vendor overview of AJP operating principles and typical application spaces.',
  },
  {
    id: 'SRC-017',
    title: 'Analytical investigation of aerosol jet printing',
    author: null,
    url: 'https://www.tandfonline.com/doi/full/10.1080/02786826.2014.940439',
    summary: 'Aerosol science journal analytical treatment of AJP mist generation and deposition physics.',
  },
  {
    id: 'SRC-018',
    title: 'Stanford SNF Optomec AJ300 manual',
    author: 'Kerst & Kommera (nano@stanford, 2018)',
    url: 'https://snfguide.stanford.edu/files/sections/diplayfiles/final_copy_of_optomec_manual_0.pdf',
    summary:
      'Shared-facility manual for AJ300 assembly, KEWB software, startup/shutdown, cleaning, and troubleshooting; derived from Optomec AJ300 user manual P/N 9000324.',
  },
  {
    id: 'SRC-019',
    title: 'Boise State IML AJP SOP v1.0',
    author: 'Travis G.; Pete Miranda (IML), 2020',
    url: 'https://www.boisestate.edu/coen-imfl/wp-content/uploads/sites/690/2020/04/AJP-SOP_ver1.0_Final.pdf',
    summary:
      'Laboratory SOP for AJ200 PA/UA operation: line-quality reference, KEWB workflow, shutdown, and practical tuning guidance.',
  },
  {
    id: 'SRC-020',
    title: 'OSHA FS-3634 — working safely with nanomaterials',
    author: 'OSHA',
    url: 'https://www.osha.gov/sites/default/files/publications/OSHA_FS-3634.pdf',
    summary: 'OSHA fact sheet on engineering controls, PPE, and work practices for engineered nanomaterials.',
  },
];

const byId: ReadonlyMap<string, SourceRefRecord> = new Map(records.map((r) => [r.id, r]));

export function getSourceRefRecord(id: string): SourceRefRecord | undefined {
  return byId.get(id);
}

/** Every registered source-citation record, in registry order. */
export function listSourceRefRecords(): readonly SourceRefRecord[] {
  return records;
}
