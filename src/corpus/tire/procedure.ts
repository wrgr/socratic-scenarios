/**
 * Roadside tire change as a procedural-task instrument instance — the second domain
 * for the in-silico validation method (the first is COLREG, a continuous-control
 * task). The canonical order and the safety-ordering constraints are the ones that
 * actually matter on the roadside:
 *   - park on level ground, set the parking brake, and chock the wheels BEFORE the
 *     vehicle is jacked;
 *   - loosen the lug nuts while the wheel is still on the ground (before raising);
 *   - torque the nuts only AFTER the vehicle is back on the ground.
 *
 * Scored by engine/procedure-sim. See docs/learner-agent-design.md and
 * docs/novelty-and-positioning.md (§4, second-domain generality).
 */
import type { ProcedureSpec } from '../../engine/procedure-sim';

export const tireChangeProcedure: ProcedureSpec = {
  id: 'tire-change',
  label: 'Roadside tire change',
  steps: [
    // ── Safety setup (must precede jacking) ──
    { id: 'level-ground', label: 'Stop on firm, level ground', bucket: 'safety' },
    { id: 'parking-brake', label: 'Engage the parking brake', bucket: 'safety' },
    { id: 'chock-wheels', label: 'Chock the wheel diagonal to the flat', bucket: 'safety' },
    // ── Core mechanical procedure ──
    { id: 'loosen-nuts', label: 'Break the lug nuts loose (wheel on ground)', bucket: 'core' },
    {
      id: 'position-jack',
      label: 'Position the jack at the jack point',
      bucket: 'core',
      after: ['level-ground', 'parking-brake', 'chock-wheels'],
    },
    {
      id: 'raise-jack',
      label: 'Raise the vehicle',
      bucket: 'core',
      after: ['loosen-nuts', 'position-jack'],
    },
    { id: 'remove-nuts', label: 'Remove the lug nuts', bucket: 'core', after: ['raise-jack'] },
    { id: 'swap-tire', label: 'Remove the flat tire', bucket: 'core', after: ['remove-nuts'] },
    { id: 'seat-spare', label: 'Mount the spare', bucket: 'core', after: ['swap-tire'] },
    { id: 'hand-tighten', label: 'Hand-tighten the lug nuts', bucket: 'core', after: ['seat-spare'] },
    { id: 'lower-jack', label: 'Lower the vehicle', bucket: 'core', after: ['hand-tighten'] },
    // ── Finishing ──
    {
      id: 'torque-star',
      label: 'Torque the nuts in a star pattern',
      bucket: 'finish',
      after: ['lower-jack'],
    },
    { id: 'stow-tools', label: 'Stow the flat and tools', bucket: 'finish', after: ['torque-star'] },
  ],
};
