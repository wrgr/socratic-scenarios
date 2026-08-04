import { describe, it, expect } from 'vitest';
import {
  mulberry32,
  simulateIrt,
  simulateBkt,
  calibration,
  runEstimator,
  eloEstimator,
  bktEstimator,
  type BktGenParams,
} from '../index';

const spread = (n: number, lo: number, hi: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
const sig = (x: number) => 1 / (1 + Math.exp(-x));

describe('deterministic PRNG', () => {
  it('is reproducible for a given seed and varies across seeds', () => {
    const a = Array.from({ length: 5 }, mulberry32(42));
    const b = Array.from({ length: 5 }, mulberry32(42));
    const c = Array.from({ length: 5 }, mulberry32(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('calibration metric behaves correctly', () => {
  it('scores well-calibrated predictions ~0 and miscalibrated predictions high', () => {
    // Perfectly calibrated: at p=0.8, exactly 80% are correct; likewise 0.2, 0.5.
    const good: { p: number; y: number }[] = [];
    for (const p of [0.2, 0.5, 0.8]) {
      for (let i = 0; i < 100; i++) good.push({ p, y: i < Math.round(p * 100) ? 1 : 0 });
    }
    expect(calibration(good).ece).toBeLessThan(0.02);

    // Overconfident: predicts 0.9 but only 0.5 succeed.
    const bad = Array.from({ length: 200 }, (_, i) => ({ p: 0.9, y: i < 100 ? 1 : 0 }));
    expect(calibration(bad).ece).toBeGreaterThan(0.3);
  });
});

describe('Elo recovers and is calibrated on static-ability (IRT) learners', () => {
  const rng = mulberry32(12345);
  const abilities = spread(200, -3, 3);
  const warmup = 15;
  let absErr = 0;
  const points: { p: number; y: number }[] = [];
  for (const ability of abilities) {
    const difficulties = spread(60, -2.5, 2.5).map((d, i) => d + (i % 2 ? 0.3 : -0.3) * rng());
    const { final, points: pts } = runEstimator(eloEstimator(), simulateIrt(rng, ability, difficulties));
    absErr += Math.abs(final.mastery - sig(ability));
    points.push(...pts.slice(warmup));
  }
  const mae = absErr / abilities.length;
  const ece = calibration(points).ece;

  it('recovers each learner’s true mastery (mean abs error < 0.08)', () => {
    expect(mae).toBeLessThan(0.08);
  });
  it('is well-calibrated post-warmup (ECE < 0.05)', () => {
    expect(ece).toBeLessThan(0.05);
  });
});

describe('BKT recovers the latent known-state and is calibrated on BKT traces', () => {
  const gen: BktGenParams = { pInit: 0.15, pTransit: 0.12, pSlip: 0.1, pGuess: 0.2 };
  const rng = mulberry32(999);
  const warmup = 3;
  let knownSum = 0, knownN = 0, unknownSum = 0, unknownN = 0;
  const points: { p: number; y: number }[] = [];
  for (let i = 0; i < 400; i++) {
    const { outcomes, known } = simulateBkt(rng, gen, 40);
    const { final, points: pts } = runEstimator(bktEstimator(gen), outcomes.map((outcome) => ({ outcome })));
    if (known[known.length - 1]) { knownSum += final.mastery; knownN++; }
    else { unknownSum += final.mastery; unknownN++; }
    points.push(...pts.slice(warmup));
  }
  const knownMean = knownSum / (knownN || 1);
  const unknownMean = unknownSum / (unknownN || 1);

  it('assigns high mastery to truly-learned learners and low to un-learned ones', () => {
    expect(knownMean).toBeGreaterThan(0.9);
    expect(knownMean - unknownMean).toBeGreaterThan(0.5);
  });
  it('is well-calibrated on its own generative family (ECE < 0.03)', () => {
    expect(calibration(points).ece).toBeLessThan(0.03);
  });
});
