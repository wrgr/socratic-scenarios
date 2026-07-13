/**
 * Internal tacit-knowledge authoring docs cited as KB-DOC-## labels in
 * corpus node `source` fields. Unlike source-ref-registry.ts's SRC-###
 * entries (external third-party documents), these are authored by the
 * TeachMe project itself — see docs/kb-candidates/01-10.
 */

export interface KbDocRecord {
  id: string;
  title: string;
  /** Repo-relative path — not web-servable, so shown as plain text, not a link. */
  path: string;
}

export const KB_DOC_RECORDS: readonly KbDocRecord[] = [
  {
    id: 'KB-DOC-01',
    title: 'AJP Process Signals — What Experts Read in Real Time',
    path: 'docs/kb-candidates/01_ajp_process_signals.md',
  },
  {
    id: 'KB-DOC-02',
    title: 'Fault Diagnosis — How Experts Reason from Symptom to Root Cause',
    path: 'docs/kb-candidates/02_fault_diagnosis_reasoning.md',
  },
  {
    id: 'KB-DOC-03',
    title: 'Gas System — The Counterintuitive Rules and Why Novices Get It Wrong',
    path: 'docs/kb-candidates/03_gas_system_tacit.md',
  },
  {
    id: 'KB-DOC-04',
    title: 'Assembly and Maintenance — What Experienced Hands Feel',
    path: 'docs/kb-candidates/04_assembly_maintenance_tacit.md',
  },
  {
    id: 'KB-DOC-05',
    title: 'Sintering — The Decision Layer and What to Read Afterward',
    path: 'docs/kb-candidates/05_sintering_decision_tacit.md',
  },
  {
    id: 'KB-DOC-06',
    title: 'Tacit Knowledge Theory — What It Is, How It Works, and Why It Matters Here',
    path: 'docs/kb-candidates/06_tacit_knowledge_theory_reference.md',
  },
  {
    id: 'KB-DOC-07',
    title: 'Expert Operator Knowledge Elicitation Template',
    path: 'docs/kb-candidates/07_expert_elicitation_template.md',
  },
  {
    id: 'KB-DOC-08',
    title: 'Process Signal Cross-Reference Index',
    path: 'docs/kb-candidates/08_signal_fault_crossref_index.md',
  },
  {
    id: 'KB-DOC-09',
    title: 'Research Design for an Operational Knowledge Corpus for Optomec HD2 Aerosol Jet PCB Trace Repair',
    path: 'docs/kb-candidates/09_operational_corpus_research_design.md',
  },
  {
    id: 'KB-DOC-10',
    title: 'Deep Research on the Tacit Knowledge Elicitation Prompt for AJP Physical Debugging',
    path: 'docs/kb-candidates/10_tacit_elicitation_methods_review.md',
  },
];
