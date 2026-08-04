/**
 * Estimator recovery + calibration report — reproducible numbers for the paper's
 * measurement-validity claim (docs/novelty-and-positioning.md §4, C2).
 *
 * Deterministic (seeded PRNG): `npm run learner:recovery`. No API key, no wall clock.
 *
 *   1. Elo RECOVERY on static-ability (IRT) learners: recovered σ(θ̂) vs true σ(ability).
 *   2. Elo CALIBRATION on an IRT population: reliability curve + ECE (post-warmup).
 *   3. BKT RECOVERY + CALIBRATION on BKT-generated learning traces.
 */
import {
  mulberry32,
  simulateIrt,
  simulateBkt,
  calibration,
  runEstimator,
  eloEstimator,
  bktEstimator,
  type BktGenParams,
} from '../src/engine/learner-agent';

const f = (x: number) => x.toFixed(3);
const spread = (n: number, lo: number, hi: number) =>
  Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));

// ── 1 & 2: Elo on static-ability (IRT) learners ─────────────────────────────────
function eloReport() {
  const rng = mulberry32(12345);
  const abilities = spread(200, -3, 3); // a population spanning weak → strong
  const itemsPerLearner = 60;
  const warmup = 15; // Elo is an online tracker; judge calibration once it has data

  let absErr = 0;
  const calPoints: { p: number; y: number }[] = [];
  for (const ability of abilities) {
    const difficulties = spread(itemsPerLearner, -2.5, 2.5).map(
      (d, i) => d + (i % 2 ? 0.3 : -0.3) * rng(), // jitter so items aren't perfectly ordered
    );
    const stream = simulateIrt(rng, ability, difficulties);
    const { final, points } = runEstimator(eloEstimator(), stream);
    absErr += Math.abs(final.mastery - 1 / (1 + Math.exp(-ability)));
    calPoints.push(...points.slice(warmup));
  }
  const mae = absErr / abilities.length;
  const cal = calibration(calPoints);
  console.log('\n=== Elo — static-ability (IRT) learners ===');
  console.log(`RECOVERY  mean |σ(θ̂) − σ(ability)| over ${abilities.length} learners: ${f(mae)}`);
  console.log(`CALIBRATION  ECE (post-warmup, ${cal.n} points): ${f(cal.ece)}`);
  console.log('reliability curve (predicted → empirical):');
  for (const b of cal.bins) if (b.count) console.log(`  ${f(b.confidence)} → ${f(b.accuracy)}  (n=${b.count})`);
}

// ── 3: BKT on BKT-generated learning traces ─────────────────────────────────────
function bktReport() {
  const rng = mulberry32(999);
  const gen: BktGenParams = { pInit: 0.15, pTransit: 0.12, pSlip: 0.1, pGuess: 0.2 };
  const learners = 400;
  const n = 40;
  const warmup = 3;

  let endKnownMastery = 0, endKnownCount = 0, endUnknownMastery = 0, endUnknownCount = 0;
  const calPoints: { p: number; y: number }[] = [];
  for (let i = 0; i < learners; i++) {
    const { outcomes, known } = simulateBkt(rng, gen, n);
    const { final, points } = runEstimator(
      bktEstimator(gen),
      outcomes.map((outcome) => ({ outcome })),
    );
    if (known[n - 1]) { endKnownMastery += final.mastery; endKnownCount++; }
    else { endUnknownMastery += final.mastery; endUnknownCount++; }
    calPoints.push(...points.slice(warmup));
  }
  const cal = calibration(calPoints);
  console.log('\n=== BKT — BKT-generated learning traces (estimator params = generator params) ===');
  console.log(`RECOVERY  mean final P(L̂):  truly-known learners ${f(endKnownMastery / (endKnownCount || 1))}  vs  still-unknown ${f(endUnknownMastery / (endUnknownCount || 1))}`);
  console.log(`CALIBRATION  ECE (post-warmup, ${cal.n} points): ${f(cal.ece)}`);
  console.log('reliability curve (predicted → empirical):');
  for (const b of cal.bins) if (b.count) console.log(`  ${f(b.confidence)} → ${f(b.accuracy)}  (n=${b.count})`);
}

eloReport();
bktReport();
