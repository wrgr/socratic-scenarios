/** This module implements engine learner model index. */
import type {
  LearnerProfile,
  ProficiencyLevel,
  ProficiencyScore,
  ExperimentCondition,
  InteractionEvent,
} from '../../types';
import { PROFICIENCY_ORDER } from '../../types';
/** Create learner profile. */
export function createLearnerProfile(
  condition: ExperimentCondition,
  role?: string,
  concepts?: { id: string }[],
): LearnerProfile {
  const profile: LearnerProfile = {
    id: crypto.randomUUID(),
    conceptProficiencies: {},
    interactionHistory: [],
    assignedCondition: condition,
    role,
  };

  // Initialize all concepts at novice
  for (const concept of concepts ?? []) {
    profile.conceptProficiencies[concept.id] = {
      level: 'novice',
      confidence: 0,
      lastAssessed: Date.now(),
      attempts: 0,
      successRate: 0,
    };
  }

  return profile;
}

/** Update proficiency. */
export function updateProficiency(
  profile: LearnerProfile,
  conceptId: string,
  correct: boolean,
  transferScore?: number,
): LearnerProfile {
  const current = profile.conceptProficiencies[conceptId];
  if (!current) return profile;

  const newAttempts = current.attempts + 1;
  const newSuccessRate =
    (current.successRate * current.attempts + (correct ? 1 : 0)) / newAttempts;

  // Transfer score gives extra weight — demonstrating transfer means deeper understanding
  const effectiveRate = transferScore !== undefined
    ? newSuccessRate * 0.5 + transferScore * 0.5
    : newSuccessRate;

  const newLevel = computeLevel(effectiveRate, newAttempts);
  const newConfidence = Math.min(1, newAttempts / 5) * (effectiveRate > 0.3 ? effectiveRate : 0.3);

  const updated: ProficiencyScore = {
    level: newLevel,
    confidence: newConfidence,
    lastAssessed: Date.now(),
    attempts: newAttempts,
    successRate: newSuccessRate,
  };

  return {
    ...profile,
    conceptProficiencies: {
      ...profile.conceptProficiencies,
      [conceptId]: updated,
    },
  };
}

/** Record interaction. */
export function recordInteraction(
  profile: LearnerProfile,
  event: InteractionEvent,
): LearnerProfile {
  return {
    ...profile,
    interactionHistory: [...profile.interactionHistory, event],
  };
}

/** Return proficiency index. */
export function getProficiencyIndex(level: ProficiencyLevel): number {
  return PROFICIENCY_ORDER.indexOf(level);
}

/** Return overall proficiency. */
export function getOverallProficiency(profile: LearnerProfile): ProficiencyLevel {
  const scores = Object.values(profile.conceptProficiencies);
  if (scores.length === 0) return 'novice';

  const avgIndex =
    scores.reduce((sum, s) => sum + getProficiencyIndex(s.level), 0) / scores.length;

  return PROFICIENCY_ORDER[Math.round(avgIndex)];
}

// ─── Internal ────────────────────────────────────────────────────

function computeLevel(successRate: number, attempts: number): ProficiencyLevel {
  // Need minimum attempts for higher levels
  if (attempts < 1) return 'novice';
  if (successRate < 0.2) return 'novice';
  if (successRate < 0.4 || attempts < 2) return 'beginner';
  if (successRate < 0.6) return 'intermediate';
  if (successRate < 0.8 || attempts < 3) return 'advanced';
  return 'expert';
}
