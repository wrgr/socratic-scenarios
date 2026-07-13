import type {
  RetrievalQuery,
  RetrievalResult,
  ScoredChunk,
  CorpusChunk,
  LearnerProfile,
  ScoringPolicy,
  RetrievalPhase,
} from '../../types';
import { getProficiencyIndex } from '../learner-model';

// ─── Embedding Provider ─────────────────────────────────────────
//
// An `EmbeddingProvider` must be registered via `setEmbeddingProvider()`
// before calling `retrieve()`.
//
// Example (OpenAI-style):
//
//   import { setEmbeddingProvider } from './engine/retrieval';
//   setEmbeddingProvider({
//     async embed(texts) {
//       const res = await openai.embeddings.create({
//         model: 'text-embedding-3-small',
//         input: texts,
//       });
//       return res.data.map(d => d.embedding);
//     },
//     cosineSimilarity(a, b) {
//       let dot = 0, na = 0, nb = 0;
//       for (let i = 0; i < a.length; i++) {
//         dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2;
//       }
//       return dot / (Math.sqrt(na) * Math.sqrt(nb));
//     },
//   });
//

export interface EmbeddingProvider {
  /** Return one embedding vector per input text. */
  embed(texts: string[]): Promise<number[][]>;
  /** Cosine similarity between two vectors. */
  cosineSimilarity(a: number[], b: number[]): number;
  /**
   * Identifier for the embedding model (e.g. 'text-embedding-004').
   * Baked vector files are tagged with the model that produced them, and
   * loaders refuse to use them unless this matches — otherwise query and
   * doc vectors would live in different spaces and cosine scores would be
   * meaningless. Leave undefined for providers whose vectors should never
   * be reused across sessions (e.g. the simulated TF-IDF provider).
   */
  modelId?: string;
}

let embeddingProvider: EmbeddingProvider | null = null;

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  id: 'full',
  similarityWeight: 0.3,
  proficiencyWeight: 0.3,
  roleWeight: 0.15,
  transferWeight: 0.25,
  normalizeByWeightSum: false,
};

export const ABLATION_SCORING_POLICIES: Record<
  'semantic-only' | 'semantic+proficiency' | '+role' | 'full',
  ScoringPolicy
> = {
  'semantic-only': {
    id: 'semantic-only',
    similarityWeight: 1,
    proficiencyWeight: 0,
    roleWeight: 0,
    transferWeight: 0,
    normalizeByWeightSum: true,
  },
  'semantic+proficiency': {
    id: 'semantic+proficiency',
    similarityWeight: 0.5,
    proficiencyWeight: 0.5,
    roleWeight: 0,
    transferWeight: 0,
    normalizeByWeightSum: true,
  },
  '+role': {
    id: '+role',
    similarityWeight: 0.4,
    proficiencyWeight: 0.3,
    roleWeight: 0.3,
    transferWeight: 0,
    normalizeByWeightSum: true,
  },
  full: {
    ...DEFAULT_SCORING_POLICY,
    normalizeByWeightSum: true,
  },
};

/** Register an embedding backend. Must be called before retrieval. */
export function setEmbeddingProvider(provider: EmbeddingProvider | null) {
  embeddingProvider = provider;
}

/** Read-only access for tests / diagnostics. */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  return embeddingProvider;
}

// ─── Main Retrieval Function ─────────────────────────────────────

export async function retrieveFromChunks(query: RetrievalQuery, chunks: CorpusChunk[]): Promise<RetrievalResult> {
  const topK = query.topK ?? 3;
  const allChunks = query.conceptId
    ? chunks.filter((c) => c.conceptId === query.conceptId)
    : chunks;

  const scoredChunks =
    query.strategy === 'semantic'
      ? await semanticRetrieval(query, allChunks)
      : await proficiencyCalibratedRetrieval(query, allChunks);

  const sortedAll = scoredChunks.sort((a, b) => b.score - a.score);
  const {
    chunks: sorted,
    applied: transferExposureConstraintApplied,
  } = enforceTransferExposureConstraint(query, sortedAll, topK);
  const phaseTransferMultiplier = query.phase
    ? getPhaseTransferMultiplier(query.phase)
    : 1;
  const filteringSteps =
    query.strategy === 'proficiency-calibrated'
      ? [
          'proficiency-match',
          'role-context-boost',
          'transfer-potential-boost',
          'difficulty-calibration',
        ]
      : ['cosine-similarity'];
  if (query.strategy === 'proficiency-calibrated' && phaseTransferMultiplier > 1) {
    filteringSteps.push(`phase-transfer-multiplier(${phaseTransferMultiplier.toFixed(2)})`);
  }
  if (transferExposureConstraintApplied) {
    filteringSteps.push('transfer-exposure-constraint');
  }

  return {
    chunks: sorted,
    strategy: query.strategy,
    queryTimestamp: Date.now(),
    metadata: {
      totalCandidates: allChunks.length,
      filteringSteps,
    },
  };
}

// ─── Semantic Similarity Retrieval ───────────────────────────────
// Standard approach: rank by cosine similarity to query using embeddings.

async function semanticRetrieval(
  query: RetrievalQuery,
  candidates: CorpusChunk[],
): Promise<ScoredChunk[]> {
  const similarities = await computeSemanticSimilarities(query.text, candidates);
  return candidates.map((chunk, i) => {
    const similarity = similarities[i];
    return {
      chunk,
      score: similarity,
      scoreBreakdown: {
        similarity,
        proficiencyMatch: 0,
        roleRelevance: 0,
        transferPotential: 0,
      },
    };
  });
}

// ─── Proficiency-Calibrated Retrieval ────────────────────────────
// Novel approach: factors in learner state, role context, and transfer potential.

async function proficiencyCalibratedRetrieval(
  query: RetrievalQuery,
  candidates: CorpusChunk[],
): Promise<ScoredChunk[]> {
  const profile = query.learnerProfile;
  const scoringPolicy = query.scoringPolicy ?? DEFAULT_SCORING_POLICY;
  const weights = toPhaseAdjustedWeights(scoringPolicy, query.phase);
  const similarities = await computeSemanticSimilarities(query.text, candidates);

  return candidates.map((chunk, i) => {
    const similarity = similarities[i];
    const proficiencyMatch = computeProficiencyMatch(chunk, profile);
    const roleRelevance = computeRoleRelevance(chunk, profile);
    const transferPotential = computeTransferPotential(chunk, profile);

    // Weighted combination — the key difference from pure semantic
    const score =
      similarity * weights.similarity +
      proficiencyMatch * weights.proficiency +
      roleRelevance * weights.role +
      transferPotential * weights.transfer;

    return {
      chunk,
      score,
      scoreBreakdown: {
        similarity,
        proficiencyMatch,
        roleRelevance,
        transferPotential,
      },
    };
  });
}

function toEffectiveWeights(scoringPolicy: ScoringPolicy): {
  similarity: number;
  proficiency: number;
  role: number;
  transfer: number;
} {
  const raw = {
    similarity: scoringPolicy.similarityWeight,
    proficiency: scoringPolicy.proficiencyWeight,
    role: scoringPolicy.roleWeight,
    transfer: scoringPolicy.transferWeight,
  };
  if (!scoringPolicy.normalizeByWeightSum) {
    return raw;
  }
  const total = raw.similarity + raw.proficiency + raw.role + raw.transfer;
  if (total <= 0) {
    return {
      similarity: 1,
      proficiency: 0,
      role: 0,
      transfer: 0,
    };
  }
  return {
    similarity: raw.similarity / total,
    proficiency: raw.proficiency / total,
    role: raw.role / total,
    transfer: raw.transfer / total,
  };
}

function toPhaseAdjustedWeights(
  scoringPolicy: ScoringPolicy,
  phase?: RetrievalPhase,
): {
  similarity: number;
  proficiency: number;
  role: number;
  transfer: number;
} {
  const base = toEffectiveWeights(scoringPolicy);
  if (!phase) return base;

  const adjusted = {
    similarity: base.similarity,
    proficiency: base.proficiency,
    role: base.role,
    transfer: base.transfer * getPhaseTransferMultiplier(phase),
  };

  if (!scoringPolicy.normalizeByWeightSum) {
    return adjusted;
  }

  const total =
    adjusted.similarity +
    adjusted.proficiency +
    adjusted.role +
    adjusted.transfer;
  if (total <= 0) return base;

  return {
    similarity: adjusted.similarity / total,
    proficiency: adjusted.proficiency / total,
    role: adjusted.role / total,
    transfer: adjusted.transfer / total,
  };
}

function getPhaseTransferMultiplier(phase: RetrievalPhase): number {
  if (phase === 'pretest') return 1.0;
  if (phase === 'learning') return 1.15;
  if (phase === 'posttest') return 1.35;
  return 1.5; // transfer phase
}

function enforceTransferExposureConstraint(
  query: RetrievalQuery,
  sortedAll: ScoredChunk[],
  topK: number,
): { chunks: ScoredChunk[]; applied: boolean } {
  const top = sortedAll.slice(0, topK);
  if (!shouldApplyTransferExposureConstraint(query) || top.length === 0) {
    return { chunks: top, applied: false };
  }

  const alreadyHasTransfer = top.some((item) => item.chunk.chunkType === 'transfer-scenario');
  if (alreadyHasTransfer) {
    return { chunks: top, applied: false };
  }

  const transferCandidate = sortedAll.find((item) => item.chunk.chunkType === 'transfer-scenario');
  if (!transferCandidate) {
    return { chunks: top, applied: false };
  }

  const replaced = [...top];
  replaced[replaced.length - 1] = transferCandidate;
  replaced.sort((a, b) => b.score - a.score);
  return { chunks: replaced, applied: true };
}

function shouldApplyTransferExposureConstraint(query: RetrievalQuery): boolean {
  if (query.strategy !== 'proficiency-calibrated') return false;
  if (query.phase !== 'transfer') return false;
  const scoringPolicy = query.scoringPolicy ?? DEFAULT_SCORING_POLICY;
  return scoringPolicy.transferWeight > 0;
}

// ─── Scoring Components ──────────────────────────────────────────

async function computeSemanticSimilarities(queryText: string, chunks: CorpusChunk[]): Promise<number[]> {
  if (!embeddingProvider) {
    throw new Error(
      'No EmbeddingProvider configured. Call setEmbeddingProvider() before using retrieval.',
    );
  }

  const texts = [queryText, ...chunks.map((c) => c.content)];
  const embeddings = await embeddingProvider.embed(texts);
  const queryEmbedding = embeddings[0];

  return embeddings.slice(1).map((chunkEmbedding) =>
    embeddingProvider!.cosineSimilarity(queryEmbedding, chunkEmbedding),
  );
}

function computeProficiencyMatch(
  chunk: CorpusChunk,
  profile: LearnerProfile,
): number {
  const conceptProf = profile.conceptProficiencies[chunk.conceptId];
  if (!conceptProf) return 0.5; // unknown concept, neutral score

  const learnerLevel = getProficiencyIndex(conceptProf.level);
  const chunkLevel = getProficiencyIndex(chunk.difficulty);

  // Optimal: chunk is at or slightly above learner's level (ZPD — zone of proximal development)
  const diff = chunkLevel - learnerLevel;

  if (diff === 0) return 0.9;      // at level
  if (diff === 1) return 1.0;      // one step ahead (ZPD sweet spot)
  if (diff === -1) return 0.6;     // review
  if (diff === 2) return 0.5;      // stretch
  return Math.max(0, 0.3 - Math.abs(diff) * 0.1); // too far either way
}

function computeRoleRelevance(
  chunk: CorpusChunk,
  profile: LearnerProfile,
): number {
  if (!chunk.roleContext || !profile.role) return 0.5; // neutral if no role info
  if (chunk.roleContext === profile.role) return 1.0;

  // Partial match for related roles
  const roleRelations: Record<string, string[]> = {
    // Software architecture roles
    'backend-engineer': ['architect', 'devops-engineer', 'full-stack'],
    architect: ['backend-engineer', 'tech-lead', 'full-stack'],
    'frontend-engineer': ['full-stack', 'ui-designer'],
    'devops-engineer': ['backend-engineer', 'sre'],
    // Elegoo / maker roles
    'beginner-maker': ['hobbyist', 'student'],
    hobbyist: ['beginner-maker', 'design-student', 'makerspace-lead'],
    student: ['beginner-maker', 'design-student', 'tutor', 'teacher', 'parent'],
    'makerspace-lead': ['hobbyist', 'design-student'],
    'design-student': ['student', 'hobbyist', 'makerspace-lead'],
    // Algebra learning roles
    tutor: ['student', 'teacher', 'parent'],
    teacher: ['tutor', 'student', 'parent'],
    parent: ['student', 'teacher', 'tutor'],
  };

  const related = roleRelations[profile.role] ?? [];
  return related.includes(chunk.roleContext) ? 0.7 : 0.3;
}

function computeTransferPotential(
  chunk: CorpusChunk,
  profile: LearnerProfile,
): number {
  // Transfer scenarios are highly valuable for learners who have at least beginner proficiency
  if (chunk.chunkType !== 'transfer-scenario') {
    // Non-transfer chunks get moderate baseline
    return 0.35;
  }

  const conceptProf = profile.conceptProficiencies[chunk.conceptId];
  if (!conceptProf) return 0.5;

  const level = getProficiencyIndex(conceptProf.level);

  // Transfer scenarios are most valuable for intermediate+ learners
  // Novices need foundations first; experts already transfer well
  if (level <= 0) return 0.55; // novice — scaffolded transfer examples still add value
  if (level === 1) return 0.78; // beginner — should now see transfer content more consistently
  if (level === 2) return 1.0; // intermediate — peak transfer value
  if (level === 3) return 0.9; // advanced — still valuable
  return 0.75;                  // expert — less incremental value
}

