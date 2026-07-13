/**
 * Knowledge management schema — Drizzle ORM table definitions.
 *
 * SQLite is the source of truth for the growing AJP corpus. All authoring,
 * enrichment, tacit elicitation, and gap lifecycle management happens here via
 * scripts/db/. The client consumes build-time exports (ajp-corpus.json) and
 * continues to use the existing in-memory graph at runtime.
 *
 * Storage location: knowledge/knowledge.db
 */

// We use raw SQL strings via better-sqlite3 for table creation (in init.ts),
// and export TypeScript interfaces here for type-safe script access.
// Drizzle ORM can optionally be used for richer query building.

// ─── Node Types ───────────────────────────────────────────────────────────────

export type NodeType =
  | 'Equipment'
  | 'Step'
  | 'Procedure'
  | 'Parameter'
  | 'FailureMode'
  | 'Symptom'
  | 'Cause'
  | 'CorrectiveAction'
  | 'SafetyHazard'
  | 'TacitKnowledge'
  | 'VerificationCheck'
  | 'SocraticProbe'
  | 'DecisionPoint'
  | 'Consequence';

export type ConfidenceLevel = 'High' | 'Medium' | 'Low';

export type SourceTier =
  | 'OfficialDoc'    // Vendor manuals, SOPs — Tier 1
  | 'PeerReview'     // Peer-reviewed literature — Tier 2
  | 'Standard'       // IPC, OSHA, NIOSH standards — Tier 2
  | 'Elicited'       // Expert interview / ExpertTrace session — Tier 3
  | 'Inferred';      // Reasoned from domain knowledge — Tier 4

export type GapStatus = 'open' | 'partial' | 'resolved';
export type GapPriority = 'critical' | 'high' | 'medium' | 'low';

export type EdgeType =
  | 'NEXT_STEP'
  | 'HAS_STEP'
  | 'CAUSES'
  | 'INDICATES'
  | 'FIXED_BY'
  | 'REQUIRES'
  | 'VERIFIED_BY'
  | 'PART_OF'
  | 'PROBES';

export type ChunkType =
  | 'explanation'
  | 'example'
  | 'analogy'
  | 'procedure'
  | 'transfer-scenario'
  | 'tacit-cue'
  | 'case-study'
  | 'discrimination-heuristic';

export type DifficultyLevel = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type EnrichmentEventType =
  | 'seed-migration'
  | 'content-update'
  | 'gap-resolved'
  | 'gap-created'
  | 'confidence-update'
  | 'source-added'
  | 'tacit-elicited'
  | 'failure-captured'
  | 'embedding-refreshed'
  | 'kb-candidate-ingested'
  | 'edge-added'
  | 'edge-updated';

export type ElicitationStatus = 'draft' | 'reviewed' | 'codified';
export type SourceType =
  | 'OfficialDoc'
  | 'PeerReview'
  | 'Standard'
  | 'SMEInterview'
  | 'OperationalLog'
  | 'KBCandidate';

// ─── Row Interfaces ───────────────────────────────────────────────────────────

/** A node in the AJP knowledge graph. */
export interface NodeRow {
  id: string;
  domain: string;
  type: NodeType;
  content: string;
  confidence: ConfidenceLevel;
  source_tier: SourceTier | null;
  /** JSON: type-specific fields (narratorText, mentorProbe, safetyAlert, etc.) */
  metadata: string | null;
  /** SHA-256 of content — used to detect stale embeddings. */
  content_hash: string;
  version: number;
  created_at: string;
  updated_at: string;
}

/** A typed edge between two nodes. */
export interface EdgeRow {
  id: number;
  from_node: string;
  to_node: string;
  type: EdgeType;
  weight: number;
  /** JSON: conditions under which this edge applies, e.g. { ink: 'Ag-NP' } */
  context: string | null;
  created_at: string;
}

/** A retrievable pedagogical content chunk. */
export interface ChunkRow {
  id: string;
  domain: string;
  concept_id: string | null;
  content: string;
  chunk_type: ChunkType;
  difficulty: DifficultyLevel | null;
  role_context: string | null;
  /** JSON: string[] of node IDs this chunk enriches */
  linked_node_ids: string | null;
  /** SHA-256 of content — used to detect stale embeddings. */
  content_hash: string;
  created_at: string;
  updated_at: string;
}

/** A cached vector embedding for a chunk or node. */
export interface EmbeddingRow {
  id: number;
  target_id: string;
  target_type: 'chunk' | 'node';
  provider: string;
  model: string;
  /** Serialized Float32Array.buffer */
  embedding: Buffer;
  /** content_hash at the time of computation — compare with parent to detect staleness */
  content_hash: string;
  created_at: string;
}

/** A known knowledge gap with lifecycle tracking. */
export interface CorpusGapRow {
  id: string;
  domain: string;
  summary: string;
  detail: string | null;
  acquisition_path: string | null;
  /** JSON: string[] of affected node IDs */
  affected_node_ids: string | null;
  status: GapStatus;
  priority: GapPriority;
  created_at: string;
  resolved_at: string | null;
}

/** A citable source for corpus provenance. */
export interface SourceRow {
  id: string;
  title: string;
  type: SourceType;
  url: string | null;
  access_date: string | null;
  /** 1=official/standard, 2=peer-reviewed, 3=elicited, 4=inferred */
  tier: number;
  notes: string | null;
}

/** Many-to-many: node → source with excerpt and confidence. */
export interface NodeSourceRow {
  node_id: string;
  source_id: string;
  /** Relevant passage from the source that supports this node. */
  excerpt: string | null;
  confidence: ConfidenceLevel | null;
}

/**
 * Append-only audit log of all knowledge changes.
 * Never delete rows — this is the corpus history.
 */
export interface EnrichmentEventRow {
  id: number;
  domain: string | null;
  target_id: string;
  target_type: 'node' | 'chunk' | 'gap' | 'edge' | 'elicitation' | 'source';
  event_type: EnrichmentEventType;
  /** JSON: { field?, old_value?, new_value?, ... } */
  payload: string | null;
  /** Human-readable source: 'ExpertTrace-Session-01', 'scripts/db/migrate.ts', etc. */
  source: string | null;
  notes: string | null;
  created_at: string;
}

/** Metadata for an ExpertTrace elicitation session. */
export interface ElicitationSessionRow {
  id: string;
  domain: string;
  expert_id: string | null;
  session_date: string | null;
  /** JSON: { material, nozzle_size, standoff_mm, session_age_minutes, ink_lot, ... } */
  context: string | null;
  /** Reference to elicitation template used (e.g., 'ExpertTrace-07') */
  interview_format: string | null;
  /** JSON: string[] of sections completed, e.g. ['A', 'B', 'C', 'D'] */
  sections_completed: string | null;
  raw_notes: string | null;
  status: ElicitationStatus;
  created_at: string;
}

/**
 * A CDM/ACTA decision frame from an expert elicitation session.
 * Each frame captures a single diagnostic/decision moment in full context.
 */
export interface DecisionFrameRow {
  id: string;
  session_id: string;
  /** Links to a TacitKnowledge or FailureMode node (may be null if node not yet created) */
  linked_node_id: string | null;
  /** JSON: string[] — what the expert observed at this moment */
  observed_cues: string | null;
  /** JSON: string[] — top hypotheses considered */
  hypothesis_set: string | null;
  /**
   * JSON: Array<{ check: string, eliminates: string[] }> —
   * the fast tests that collapse the hypothesis space
   */
  discriminators: string | null;
  /** The single fastest discriminating test (60-second check) */
  fast_test: string | null;
  decision: 'abort' | 'continue' | 'monitor' | 'adjust' | null;
  decision_rationale: string | null;
  /** What goes wrong if the diagnosis is incorrect */
  cost_of_wrong: string | null;
  outcome: string | null;
  /** What would have happened with a different decision */
  counterfactual: string | null;
  timing_in_session: 'startup' | 'mid-session' | 'end' | 'cross-session' | null;
  /** Relative path or URL to supporting image/log/video artifact */
  anchor_artifact: string | null;
  created_at: string;
}

/**
 * A captured failure observation from a real training session.
 * Used to detect gaps between corpus coverage and actual queries.
 */
export interface FailureObservationRow {
  id: number;
  domain: string | null;
  /** JSON: { learner_id, mode, timestamp, session_id } */
  session_context: string | null;
  /** JSON: string[] — symptoms the learner described */
  symptoms_observed: string | null;
  /** The raw query text that the system could not adequately serve */
  query_text: string | null;
  /** JSON: the graph result that was returned (may be empty) */
  graph_result: string | null;
  /** Was the graph result adequate for the learner's need? */
  was_adequate: number; // SQLite boolean: 0 | 1
  /** Node ID that should exist but doesn't (if known) */
  missing_node_id: string | null;
  /** Corpus gap this maps to, if already catalogued */
  affected_gap_id: string | null;
  notes: string | null;
  created_at: string;
}

// ─── SQL DDL ──────────────────────────────────────────────────────────────────

/**
 * Complete CREATE TABLE statements for the knowledge database.
 * Used by scripts/db/init.ts to initialize the schema.
 */
export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS nodes (
  id           TEXT PRIMARY KEY,
  domain       TEXT NOT NULL,
  type         TEXT NOT NULL,
  content      TEXT NOT NULL,
  confidence   TEXT NOT NULL DEFAULT 'Low',
  source_tier  TEXT,
  metadata     TEXT,
  content_hash TEXT NOT NULL DEFAULT '',
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS edges (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  from_node  TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  to_node    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  weight     REAL NOT NULL DEFAULT 1.0,
  context    TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node);
CREATE INDEX IF NOT EXISTS idx_edges_to   ON edges(to_node);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);

CREATE TABLE IF NOT EXISTS chunks (
  id              TEXT PRIMARY KEY,
  domain          TEXT NOT NULL,
  concept_id      TEXT,
  content         TEXT NOT NULL,
  chunk_type      TEXT NOT NULL,
  difficulty      TEXT,
  role_context    TEXT,
  linked_node_ids TEXT,
  content_hash    TEXT NOT NULL DEFAULT '',
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_domain     ON chunks(domain);
CREATE INDEX IF NOT EXISTS idx_chunks_concept_id ON chunks(concept_id);

CREATE TABLE IF NOT EXISTS embeddings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id    TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  embedding    BLOB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_embeddings_target ON embeddings(target_id, target_type, provider, model);

CREATE TABLE IF NOT EXISTS corpus_gaps (
  id                TEXT PRIMARY KEY,
  domain            TEXT NOT NULL,
  summary           TEXT NOT NULL,
  detail            TEXT,
  acquisition_path  TEXT,
  affected_node_ids TEXT,
  status            TEXT NOT NULL DEFAULT 'open',
  priority          TEXT NOT NULL DEFAULT 'medium',
  created_at        TEXT NOT NULL,
  resolved_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_gaps_status ON corpus_gaps(status);

CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL,
  url         TEXT,
  access_date TEXT,
  tier        INTEGER NOT NULL DEFAULT 4,
  notes       TEXT
);

CREATE TABLE IF NOT EXISTS node_sources (
  node_id    TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  source_id  TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  excerpt    TEXT,
  confidence TEXT,
  PRIMARY KEY (node_id, source_id)
);

CREATE TABLE IF NOT EXISTS enrichment_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  domain      TEXT,
  target_id   TEXT NOT NULL,
  target_type TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  payload     TEXT,
  source      TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_target ON enrichment_events(target_id);
CREATE INDEX IF NOT EXISTS idx_events_type   ON enrichment_events(event_type);

CREATE TABLE IF NOT EXISTS elicitation_sessions (
  id                  TEXT PRIMARY KEY,
  domain              TEXT NOT NULL,
  expert_id           TEXT,
  session_date        TEXT,
  context             TEXT,
  interview_format    TEXT,
  sections_completed  TEXT,
  raw_notes           TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decision_frames (
  id                  TEXT PRIMARY KEY,
  session_id          TEXT NOT NULL REFERENCES elicitation_sessions(id) ON DELETE CASCADE,
  linked_node_id      TEXT,
  observed_cues       TEXT,
  hypothesis_set      TEXT,
  discriminators      TEXT,
  fast_test           TEXT,
  decision            TEXT,
  decision_rationale  TEXT,
  cost_of_wrong       TEXT,
  outcome             TEXT,
  counterfactual      TEXT,
  timing_in_session   TEXT,
  anchor_artifact     TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_frames_session ON decision_frames(session_id);
CREATE INDEX IF NOT EXISTS idx_frames_node    ON decision_frames(linked_node_id);

CREATE TABLE IF NOT EXISTS failure_observations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  domain           TEXT,
  session_context  TEXT,
  symptoms_observed TEXT,
  query_text       TEXT,
  graph_result     TEXT,
  was_adequate     INTEGER NOT NULL DEFAULT 0,
  missing_node_id  TEXT,
  affected_gap_id  TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL
);
`;
