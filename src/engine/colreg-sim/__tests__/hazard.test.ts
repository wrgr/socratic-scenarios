import { describe, it, expect } from 'vitest';
import { runBenchmarkAsync } from '../benchmark';
import { ownship, kn } from '../../../corpus/colreg/benchmark-geometry';
import type { SimScenario, Vessel } from '../index';

// A hidden hazard is the LARGE-EFFECT corpus-reliance lever: a model that does not know the
// hazard (leaking / corpus-ablated) holds its track and grounds (full barrier); a corpus-bound
// model reads it and clears. The swing is the whole barrier range, not a graded sliver.
describe('hidden hazard — corpus-only danger scored by the barrier (large-effect probe)', () => {
  const farTarget: Vessel = { id: 'F', label: 'F', x: 9000, y: 9000, psi: Math.PI, v: kn(6), lengthM: 100 };
  const scn: SimScenario = {
    id: 'HZ-1', label: 'Transit past a charted hazard', description: '', difficulty: 'beginner',
    ownship: ownship(), targets: [farTarget], visibility: 'clear',
    hazards: [{ x: 0, y: 3000, radiusM: 400, label: 'charted wreck' }],
    horizonS: 1200, dt: 4, intendedHeading: 0,
  };
  const runOffset = (deg: number) =>
    runBenchmarkAsync([scn], async () => ({ courseOffset: (deg * Math.PI) / 180, speedFactor: 1, actTime: 0 }));

  it('grounds (huge J) when the track is held, clears (tiny J) when the corpus rule is followed', async () => {
    const held = await runOffset(0);     // leaking / hazard unknown -> grounds
    const cleared = await runOffset(35);  // corpus-bound -> avoids
    expect(held.meanJ).toBeGreaterThan(1000);       // barrier tripped
    expect(cleared.meanJ).toBeLessThan(50);         // clear
    expect(held.meanJ - cleared.meanJ).toBeGreaterThan(900); // full-range corpus-reliance swing
  });

  it('a scenario with no hazard is unaffected (backward compatible)', async () => {
    const noHz = await runBenchmarkAsync([{ ...scn, hazards: [] }],
      async () => ({ courseOffset: 0, speedFactor: 1, actTime: 0 }));
    expect(noHz.meanJ).toBeLessThan(50);
  });
});
