import { describe, it, expect } from 'vitest';
import {
  LearnerAgent,
  applyEvent,
  createLearnerState,
  replay,
  heuristicEstimator,
  bktEstimator,
  eloEstimator,
  masteryGate,
  isMastered,
  frontier,
  selectNextKC,
  summarize,
  levelFromMastery,
  type DomainModel,
  type EvidenceEvent,
} from '../index';

const DOMAIN: DomainModel = {
  id: 'test',
  kcs: [
    { id: 'a' },
    { id: 'b', prerequisites: ['a'] },
    { id: 'safety', safetyCritical: true },
  ],
  masteryThreshold: 0.8,
  safetyThreshold: 0.9,
  confidenceThreshold: 0.6,
};

let t = 0;
const ev = (kcIds: string[], outcome: number, extra: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  timestamp: ++t,
  kcIds,
  itemId: 'item',
  outcome,
  kind: 'probe',
  source: 'human',
  ...extra,
});

describe('state initialization', () => {
  it('initializes every domain KC at the estimator prior, novice, zero confidence', () => {
    const s = createLearnerState(DOMAIN, bktEstimator());
    expect(Object.keys(s.knowledge)).toEqual(['a', 'b', 'safety']);
    expect(s.knowledge.a.mastery).toBeCloseTo(0.2, 5); // DEFAULT_BKT.pInit
    expect(s.knowledge.a.level).toBe('novice');
    expect(s.knowledge.a.confidence).toBe(0);
  });

  it('levelFromMastery is novice before any attempt regardless of prior', () => {
    expect(levelFromMastery(0.95, 0)).toBe('novice');
    expect(levelFromMastery(0.95, 1)).toBe('expert');
    expect(levelFromMastery(0.5, 3)).toBe('intermediate');
  });
});

describe('estimators build on their source methods', () => {
  it('heuristic tracks the running success rate', () => {
    const est = heuristicEstimator();
    const a = new LearnerAgent(DOMAIN, est);
    a.observe(ev(['a'], 1));
    a.observe(ev(['a'], 1));
    a.observe(ev(['a'], 0));
    expect(a.estimate('a').mastery).toBeCloseTo(2 / 3, 5);
  });

  it('BKT posterior rises on correct, falls on incorrect, and converges to mastery', () => {
    const est = bktEstimator();
    const up = new LearnerAgent(DOMAIN, est);
    let prev = up.estimate('a').mastery;
    for (let i = 0; i < 8; i++) {
      up.observe(ev(['a'], 1));
      // Non-decreasing (strictly rising until it saturates at the probability clamp).
      expect(up.estimate('a').mastery).toBeGreaterThanOrEqual(prev);
      prev = up.estimate('a').mastery;
    }
    expect(up.estimate('a').mastery).toBeGreaterThan(0.95);

    const down = new LearnerAgent(DOMAIN, est);
    down.observe(ev(['a'], 1));
    down.observe(ev(['a'], 1)); // build some belief
    const before = down.estimate('a').mastery;
    down.observe(ev(['a'], 0)); // a wrong answer must lower P(known)
    expect(down.estimate('a').mastery).toBeLessThan(before);
  });

  it('Elo cold-starts at 0.5 and separates a strong from a weak learner', () => {
    const strong = new LearnerAgent(DOMAIN, eloEstimator());
    const weak = new LearnerAgent(DOMAIN, eloEstimator());
    expect(strong.estimate('a').mastery).toBeCloseTo(0.5, 5);
    for (let i = 0; i < 6; i++) {
      strong.observe(ev(['a'], 1));
      weak.observe(ev(['a'], 0));
    }
    expect(strong.estimate('a').mastery).toBeGreaterThan(0.75);
    expect(weak.estimate('a').mastery).toBeLessThan(0.25);
  });

  it('Elo credits success on a HARDER item more than on an easy one', () => {
    const hard = new LearnerAgent(DOMAIN, eloEstimator());
    const easy = new LearnerAgent(DOMAIN, eloEstimator());
    hard.observe(ev(['a'], 1, { difficulty: 2 })); // succeeded against a hard item
    easy.observe(ev(['a'], 1, { difficulty: -2 })); // succeeded against an easy item
    expect(hard.estimate('a').mastery).toBeGreaterThan(easy.estimate('a').mastery);
  });
});

describe('purity and replay', () => {
  it('applyEvent does not mutate the input state', () => {
    const est = eloEstimator();
    const s0 = createLearnerState(DOMAIN, est);
    const snapshot = JSON.stringify(s0);
    const s1 = applyEvent(s0, ev(['a'], 1), est);
    expect(JSON.stringify(s0)).toBe(snapshot); // unchanged
    expect(s1).not.toBe(s0);
    expect(s1.history).toHaveLength(1);
  });

  it('replaying the event log reproduces the live state exactly', () => {
    const est = bktEstimator();
    const agent = new LearnerAgent(DOMAIN, est, { id: 'L1' });
    const events = [ev(['a'], 1), ev(['a', 'b'], 0.9), ev(['safety'], 1), ev(['b'], 0.4)];
    events.forEach((e) => agent.observe(e));
    const rebuilt = replay(DOMAIN, est, agent.state.history, { id: 'L1' });
    expect(rebuilt.knowledge).toEqual(agent.state.knowledge);
    expect(rebuilt.updatedAt).toBe(agent.state.updatedAt);
  });

  it('a multi-KC event updates every KC in its Q-matrix row', () => {
    const agent = new LearnerAgent(DOMAIN, eloEstimator());
    agent.observe(ev(['a', 'b'], 1));
    expect(agent.estimate('a').attempts).toBe(1);
    expect(agent.estimate('b').attempts).toBe(1);
    expect(agent.estimate('safety').attempts).toBe(0);
  });
});

describe('policy: gates, prerequisites, ZPD selection', () => {
  it('a mastery gate needs both mastery AND confidence', () => {
    const agent = new LearnerAgent(DOMAIN, eloEstimator());
    agent.observe(ev(['a'], 1)); // high outcome, but only one attempt → low confidence
    const g = masteryGate(agent.state, DOMAIN, 'a');
    expect(g.passed).toBe(false);
    expect(g.reasons.some((r) => r.includes('confidence'))).toBe(true);
    for (let i = 0; i < 8; i++) agent.observe(ev(['a'], 1));
    expect(isMastered(agent.state, DOMAIN, 'a')).toBe(true);
  });

  it('safety-critical KCs gate at the higher threshold', () => {
    expect(masteryGate(createLearnerState(DOMAIN, eloEstimator()), DOMAIN, 'a').masteryThreshold).toBe(0.8);
    expect(masteryGate(createLearnerState(DOMAIN, eloEstimator()), DOMAIN, 'safety').masteryThreshold).toBe(0.9);
  });

  it('a KC stays off the frontier until its prerequisites are mastered', () => {
    const agent = new LearnerAgent(DOMAIN, eloEstimator());
    expect(frontier(agent.state, DOMAIN).map((k) => k.id)).not.toContain('b');
    expect(frontier(agent.state, DOMAIN).map((k) => k.id)).toContain('a');
    for (let i = 0; i < 10; i++) agent.observe(ev(['a'], 1)); // master the prerequisite
    expect(isMastered(agent.state, DOMAIN, 'a')).toBe(true);
    expect(frontier(agent.state, DOMAIN).map((k) => k.id)).toContain('b');
  });

  it('selectNextKC picks the lowest-mastery reachable KC and stops when done', () => {
    const agent = new LearnerAgent(DOMAIN, eloEstimator());
    // 'a' and 'safety' are unlocked; nudge 'safety' up so 'a' is the weaker one.
    agent.observe(ev(['safety'], 1));
    expect(selectNextKC(agent.state, DOMAIN)).toBe('a');
    // Master everything → nothing left to select.
    const mastered = new LearnerAgent(DOMAIN, eloEstimator());
    for (let i = 0; i < 12; i++) {
      mastered.observe(ev(['a'], 1));
      mastered.observe(ev(['b'], 1));
      mastered.observe(ev(['safety'], 1));
    }
    expect(selectNextKC(mastered.state, DOMAIN)).toBeNull();
  });

  it('summarize reports mastered / attempted / mean mastery', () => {
    const agent = new LearnerAgent(DOMAIN, eloEstimator());
    for (let i = 0; i < 10; i++) agent.observe(ev(['a'], 1));
    const s = summarize(agent.state, DOMAIN);
    expect(s.total).toBe(3);
    expect(s.attempted).toBe(1);
    expect(s.masteredKCs).toContain('a');
    expect(s.meanMastery).toBeGreaterThan(0);
  });
});
