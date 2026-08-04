/**
 * Pure utility functions for SocraticView — topic labels, mastery state helpers,
 * progress text, and score display. No React or async dependencies.
 */
import type { AJPNode } from '../types/ajp';

/** Human-readable label for each SocraticProbe node ID. */
export const PROBE_LABELS: Record<string, string> = {
  'PROBE-GAS-SEQUENCE-START-001': 'Gas Startup Sequence',
  'PROBE-GAS-SEQUENCE-STOP-001': 'Gas Shutdown Sequence',
  'PROBE-PRESSURE-INTERPRETATION-001': 'KEWB Pressure Interpretation',
  'PROBE-NOZZLE-INSPECT-001': 'Nozzle Inspection',
  'PROBE-SINTER-PARAMETERS-001': 'Sintering Parameters',
  'PROBE-ESD-PROTOCOL-001': 'ESD Protection Protocol',
  'PROBE-TACIT-LINE-QUALITY-001': 'Line Quality Defects',
  'PROBE-ABORT-DECISION-001': 'Abort Decision Logic',
  'PROBE-ATOMIZATION-PA-001': 'PA Atomizer Visual',
  'PROBE-PLUME-VISUAL-001': 'Aerosol Plume Visual',
  'PROBE-UA-SOUND-001': 'Ultrasonic Atomizer Sound',
  // Roadside Tire Change domain
  'PROBE-TIRE-SECURE-VEHICLE-001': 'Securing the Vehicle',
  'PROBE-TIRE-JACK-POINT-001': 'Jack Placement',
  'PROBE-TIRE-LOOSEN-FIRST-001': 'Loosen Before Lifting',
  'PROBE-TIRE-STAR-TORQUE-001': 'Star-Pattern Torque',
  'PROBE-TIRE-SPARE-LIMITS-001': 'Compact Spare Limits',
  // COLREG Collision Avoidance domain
  'PROBE-COLREG-CROSSING-001': 'Crossing — Who Gives Way',
  'PROBE-COLREG-STARBOARD-001': 'Why Alter to Starboard',
  'PROBE-COLREG-SUBSTANTIAL-001': 'Substantial Alteration',
  'PROBE-COLREG-BEARING-001': 'Steady Bearing = Risk',
  'PROBE-COLREG-STANDON-001': 'Stand-On Duties',
  'PROBE-COLREG-SAFE-SPEED-001': 'Safe Speed',
};

/** Topic categories for display grouping. */
export const PROBE_CATEGORIES: Record<string, string> = {
  'PROBE-GAS-SEQUENCE-START-001': 'Startup & Gas',
  'PROBE-GAS-SEQUENCE-STOP-001': 'Startup & Gas',
  'PROBE-PRESSURE-INTERPRETATION-001': 'Diagnostics',
  'PROBE-NOZZLE-INSPECT-001': 'Hardware',
  'PROBE-SINTER-PARAMETERS-001': 'Post-Process',
  'PROBE-ESD-PROTOCOL-001': 'Safety',
  'PROBE-TACIT-LINE-QUALITY-001': 'Print Quality',
  'PROBE-ABORT-DECISION-001': 'Diagnostics',
  'PROBE-ATOMIZATION-PA-001': 'Perceptual Signals',
  'PROBE-PLUME-VISUAL-001': 'Perceptual Signals',
  'PROBE-UA-SOUND-001': 'Perceptual Signals',
  // Roadside Tire Change domain
  'PROBE-TIRE-SECURE-VEHICLE-001': 'Securing & Stability',
  'PROBE-TIRE-JACK-POINT-001': 'Securing & Stability',
  'PROBE-TIRE-LOOSEN-FIRST-001': 'Technique',
  'PROBE-TIRE-STAR-TORQUE-001': 'Technique',
  'PROBE-TIRE-SPARE-LIMITS-001': 'After the Change',
  // COLREG Collision Avoidance domain
  'PROBE-COLREG-CROSSING-001': 'Give-Way / Stand-On',
  'PROBE-COLREG-STANDON-001': 'Give-Way / Stand-On',
  'PROBE-COLREG-STARBOARD-001': 'Action to Avoid Collision',
  'PROBE-COLREG-SUBSTANTIAL-001': 'Action to Avoid Collision',
  'PROBE-COLREG-BEARING-001': 'Risk Assessment',
  'PROBE-COLREG-SAFE-SPEED-001': 'Risk Assessment',
};

/** Return human label for a probe node, falling back to its id. */
export function probeLabel(probeId: string): string {
  return PROBE_LABELS[probeId] ?? probeId;
}

/** Return category label for a probe node. */
export function probeCategory(probeId: string): string {
  return PROBE_CATEGORIES[probeId] ?? 'General';
}

/** Return whether this probe node is safety-critical (elevated mastery gate). */
export function isSafetyProbe(probe: AJPNode): boolean {
  return probe.safetyAlert !== undefined && probe.safetyAlert.length > 0;
}

/** Return the effective mastery threshold for a probe node. */
export function masteryThreshold(probe: AJPNode): number {
  return probe.masteryThreshold ?? (isSafetyProbe(probe) ? 0.90 : 0.80);
}

/** Return a short score label for display. */
export function scoreLabel(score: number): string {
  if (score >= 0.90) return 'Excellent — full mastery demonstrated';
  if (score >= 0.80) return 'Good — key concepts addressed';
  if (score >= 0.60) return 'Partial — some important concepts missing';
  return 'Needs development — review the expected concepts';
}

/** Return CSS class for the score bar fill. */
export function scoreClass(score: number): string {
  if (score >= 0.80) return 'score--pass';
  if (score >= 0.60) return 'score--partial';
  return 'score--fail';
}

/** Return a display string for a mastery state badge. */
export function masteryBadge(mastered: boolean, attempts: number): string {
  if (mastered) return '✓ Mastered';
  if (attempts > 0) return `${attempts} attempt${attempts > 1 ? 's' : ''} — in progress`;
  return 'Not started';
}
