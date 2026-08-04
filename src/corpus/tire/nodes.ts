/**
 * Knowledge-graph nodes + edges for the Roadside Tire Change domain.
 * Mirrors the AJP corpus shape (AJPNode / AJPEdge) so the same Scenario Mode,
 * Socratic, and integrity machinery works unchanged. Node types are drawn from
 * the existing AJPNodeType union (Step, Parameter, FailureMode, SafetyHazard,
 * CorrectiveAction, TacitKnowledge, Equipment).
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

const MANUAL = "Vehicle owner's manual (jacking / tire-change section)";

// ─── Equipment ────────────────────────────────────────────────────

export const tireEquipmentNodes: AJPNode[] = [
  {
    id: 'EQUIP-TIRE-KIT-001',
    type: 'Equipment',
    content:
      'Standard roadside kit: scissor or bottle jack, lug wrench (or breaker bar), temporary spare (full-size or compact "donut"), wheel chock, and hazard triangles/flares. Locations and the jack rating are listed in the owner manual.',
    narratorText:
      'You have the vehicle jack, lug wrench, the spare from the trunk well, a wheel chock, and a reflective triangle.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Steps ────────────────────────────────────────────────────────

export const tireStepNodes: AJPNode[] = [
  {
    id: 'STEP-TIRE-SAFE-STOP-001',
    type: 'Step',
    content:
      'Pull completely off the roadway onto firm, level ground, away from traffic. Turn on hazard lights and set out a warning triangle. A soft shoulder or a slope is not an acceptable work location.',
    confidence: 'High',
    source: 'NHTSA roadside safety guidance',
  },
  {
    id: 'STEP-TIRE-SECURE-001',
    type: 'Step',
    content:
      'Set the parking brake, put an automatic in Park (a manual in gear), and chock the wheel diagonally opposite the one you are changing before doing anything else.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'STEP-TIRE-BREAK-LUGS-001',
    type: 'Step',
    content:
      'With the wheel still on the ground, break each lug nut loose about a quarter turn (counter-clockwise). The grounded tire holds the wheel against your force.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'STEP-TIRE-JACK-001',
    type: 'Step',
    content:
      'Place the jack under the reinforced jack point nearest the wheel and raise until the flat tire is a few centimetres clear of the ground.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'STEP-TIRE-SWAP-001',
    type: 'Step',
    content:
      'Remove the loosened lug nuts, pull the flat straight off, mount the spare, and thread the lug nuts on by hand until snug.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'STEP-TIRE-TORQUE-001',
    type: 'Step',
    content:
      'Lower the vehicle until the spare carries the load, then torque the lug nuts to the vehicle specification in a star (crisscross) pattern.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'STEP-TIRE-STOW-VERIFY-001',
    type: 'Step',
    content:
      'Stow the flat, jack, and tools. Check the spare’s inflation, and if it is a compact spare note its speed and distance limits before driving to a repair shop.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Parameters (operating envelopes) ─────────────────────────────

export const tireParameterNodes: AJPNode[] = [
  {
    id: 'PARAM-TIRE-LUG-TORQUE-001',
    type: 'Parameter',
    content:
      'Lug-nut torque is vehicle-specific — commonly ~80–100 lb-ft for passenger cars, but always use the owner-manual value. Tighten in a star pattern so the wheel seats evenly. Under-torque lets nuts back off; gross over-torque can stretch studs or warp the brake rotor.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'PARAM-TIRE-SPARE-LIMITS-001',
    type: 'Parameter',
    content:
      'A compact ("donut") spare is a temporary get-you-home tire: typically limited to about 50 mph and roughly 70 miles. It has less grip and no tread depth margin — replace it with a full tire as soon as practical.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'PARAM-TIRE-JACK-POINT-001',
    type: 'Parameter',
    content:
      'The reinforced jack points are the marked pinch-weld seams just behind the front wheels and just ahead of the rear wheels (see the owner-manual diagram). Lifting anywhere else risks bending the body and slipping the jack.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Safety hazards ───────────────────────────────────────────────

export const tireHazardNodes: AJPNode[] = [
  {
    id: 'HAZARD-TIRE-TRAFFIC-001',
    type: 'SafetyHazard',
    content:
      'Passing traffic is the deadliest roadside hazard. Work on the side away from traffic where possible, keep hazard lights on and a warning triangle out, and get occupants behind a barrier rather than in the vehicle on the traffic side.',
    safetyAlert: 'Roadside traffic kills. Position the vehicle and yourself away from live lanes before starting.',
    confidence: 'High',
    source: 'NHTSA roadside safety guidance',
  },
  {
    id: 'HAZARD-TIRE-UNDER-VEHICLE-001',
    type: 'SafetyHazard',
    content:
      'A jack only lifts — it does not safely hold. Never place any part of your body under a vehicle supported only by a jack; use jack stands for any under-vehicle work.',
    safetyAlert: 'Never get under a vehicle held up only by a jack.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Failure modes (the scenario safety gates) ────────────────────

export const tireFaultNodes: AJPNode[] = [
  {
    id: 'FAULT-TIRE-JACK-UNSTABLE-001',
    type: 'FailureMode',
    content:
      'Jack set on soft ground, gravel, or a slope, or the vehicle lifted before lugs were broken loose. The jack base sinks or tips and the vehicle can drop.',
    safetyAlert: 'Unstable jack setup — the vehicle can fall. Reset on firm, level ground.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'FAULT-TIRE-NO-CHOCK-001',
    type: 'FailureMode',
    content:
      'Parking brake not set, transmission not engaged, and no wheel chock in place before lifting. The vehicle can roll off the jack.',
    safetyAlert: 'Vehicle not secured against rolling before lifting.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'FAULT-TIRE-JACK-WRONG-POINT-001',
    type: 'FailureMode',
    content:
      'Jack placed under the floor pan, oil pan, suspension arm, or plastic trim instead of the reinforced jack point. The body deforms and the jack can slip.',
    safetyAlert: 'Jack on the reinforced jack point only — not sheet metal or trim.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'FAULT-TIRE-TORQUE-IMPROPER-001',
    type: 'FailureMode',
    content:
      'Lug nuts left finger-tight, tightened out of pattern, or never torqued on the ground. The wheel seats unevenly and the nuts can back off in service.',
    safetyAlert: 'Wheel not properly torqued — it can come loose while driving.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'FAULT-TIRE-LOOSEN-AFTER-LIFT-001',
    type: 'FailureMode',
    content:
      'Attempting to break the lug nuts loose after the wheel is off the ground. The wheel spins freely, the sideways force rocks the vehicle, and the jack can be knocked out.',
    safetyAlert: 'Break lug nuts loose while the wheel is still on the ground.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Corrective actions ───────────────────────────────────────────

export const tireActionNodes: AJPNode[] = [
  {
    id: 'ACTION-TIRE-LOOSEN-BEFORE-LIFT-001',
    type: 'CorrectiveAction',
    content:
      'Break each lug nut loose about a quarter turn while the tire is still on the ground, then jack the vehicle. The grounded tire provides the resistance.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'ACTION-TIRE-STAR-TORQUE-001',
    type: 'CorrectiveAction',
    content:
      'Lower the vehicle so the spare bears the load, then torque the lug nuts to spec in a star (crisscross) sequence, not around the circle in order.',
    confidence: 'High',
    source: MANUAL,
  },
  {
    id: 'ACTION-TIRE-RESET-ON-FIRM-GROUND-001',
    type: 'CorrectiveAction',
    content:
      'Lower and reposition: move to firm, level pavement, seat the jack squarely under the reinforced jack point, and confirm stability before lifting again.',
    confidence: 'High',
    source: MANUAL,
  },
];

// ─── Tacit knowledge ──────────────────────────────────────────────

export const tireTacitNodes: AJPNode[] = [
  {
    id: 'TACIT-TIRE-GROUND-CHECK-001',
    type: 'TacitKnowledge',
    content:
      'Experienced drivers judge the surface before jacking: firm asphalt over dirt, level over sloped, and they will drive slowly to a better spot on a flat rather than jack on a soft shoulder. A board under a bottle jack spreads the load on marginal ground.',
    confidence: 'Medium',
    source: 'Practitioner knowledge',
  },
];

// ─── Combined node list ───────────────────────────────────────────

export const tireGraphNodes: AJPNode[] = [
  ...tireEquipmentNodes,
  ...tireStepNodes,
  ...tireParameterNodes,
  ...tireHazardNodes,
  ...tireFaultNodes,
  ...tireActionNodes,
  ...tireTacitNodes,
];

// ─── Edges ────────────────────────────────────────────────────────
// Every from/to must resolve within the combined domain graph (graph nodes +
// probes + consequences). CAUSES edges link a failure mode to its consequence.

export const tireGraphEdges: AJPEdge[] = [
  // Procedure order
  { from: 'STEP-TIRE-SAFE-STOP-001', to: 'STEP-TIRE-SECURE-001', type: 'NEXT_STEP' },
  { from: 'STEP-TIRE-SECURE-001', to: 'STEP-TIRE-BREAK-LUGS-001', type: 'NEXT_STEP' },
  { from: 'STEP-TIRE-BREAK-LUGS-001', to: 'STEP-TIRE-JACK-001', type: 'NEXT_STEP' },
  { from: 'STEP-TIRE-JACK-001', to: 'STEP-TIRE-SWAP-001', type: 'NEXT_STEP' },
  { from: 'STEP-TIRE-SWAP-001', to: 'STEP-TIRE-TORQUE-001', type: 'NEXT_STEP' },
  { from: 'STEP-TIRE-TORQUE-001', to: 'STEP-TIRE-STOW-VERIFY-001', type: 'NEXT_STEP' },
  // Steps require the equipment
  { from: 'STEP-TIRE-JACK-001', to: 'EQUIP-TIRE-KIT-001', type: 'REQUIRES' },
  // Hazards / faults tied to steps
  { from: 'STEP-TIRE-SAFE-STOP-001', to: 'HAZARD-TIRE-TRAFFIC-001', type: 'REQUIRES' },
  { from: 'STEP-TIRE-JACK-001', to: 'HAZARD-TIRE-UNDER-VEHICLE-001', type: 'REQUIRES' },
  { from: 'STEP-TIRE-SECURE-001', to: 'FAULT-TIRE-NO-CHOCK-001', type: 'INDICATES' },
  { from: 'STEP-TIRE-JACK-001', to: 'FAULT-TIRE-JACK-UNSTABLE-001', type: 'INDICATES' },
  { from: 'STEP-TIRE-JACK-001', to: 'FAULT-TIRE-JACK-WRONG-POINT-001', type: 'INDICATES' },
  { from: 'STEP-TIRE-BREAK-LUGS-001', to: 'FAULT-TIRE-LOOSEN-AFTER-LIFT-001', type: 'INDICATES' },
  { from: 'STEP-TIRE-TORQUE-001', to: 'FAULT-TIRE-TORQUE-IMPROPER-001', type: 'INDICATES' },
  // Parameters govern steps
  { from: 'STEP-TIRE-TORQUE-001', to: 'PARAM-TIRE-LUG-TORQUE-001', type: 'REQUIRES' },
  { from: 'STEP-TIRE-JACK-001', to: 'PARAM-TIRE-JACK-POINT-001', type: 'REQUIRES' },
  { from: 'STEP-TIRE-STOW-VERIFY-001', to: 'PARAM-TIRE-SPARE-LIMITS-001', type: 'REQUIRES' },
  // Corrective actions fix faults
  { from: 'FAULT-TIRE-LOOSEN-AFTER-LIFT-001', to: 'ACTION-TIRE-LOOSEN-BEFORE-LIFT-001', type: 'FIXED_BY' },
  { from: 'FAULT-TIRE-TORQUE-IMPROPER-001', to: 'ACTION-TIRE-STAR-TORQUE-001', type: 'FIXED_BY' },
  { from: 'FAULT-TIRE-JACK-UNSTABLE-001', to: 'ACTION-TIRE-RESET-ON-FIRM-GROUND-001', type: 'FIXED_BY' },
  { from: 'FAULT-TIRE-JACK-WRONG-POINT-001', to: 'ACTION-TIRE-RESET-ON-FIRM-GROUND-001', type: 'FIXED_BY' },
  // Tacit knowledge supports ground assessment
  { from: 'ACTION-TIRE-RESET-ON-FIRM-GROUND-001', to: 'TACIT-TIRE-GROUND-CHECK-001', type: 'SUPPORTED_BY' },
  // Fault → consequence chains
  { from: 'FAULT-TIRE-JACK-UNSTABLE-001', to: 'CONSEQUENCE-TIRE-VEHICLE-FALL-001', type: 'CAUSES' },
  { from: 'FAULT-TIRE-NO-CHOCK-001', to: 'CONSEQUENCE-TIRE-ROLLAWAY-001', type: 'CAUSES' },
  { from: 'FAULT-TIRE-JACK-WRONG-POINT-001', to: 'CONSEQUENCE-TIRE-BODY-DAMAGE-001', type: 'CAUSES' },
  { from: 'FAULT-TIRE-TORQUE-IMPROPER-001', to: 'CONSEQUENCE-TIRE-WHEEL-DETACH-001', type: 'CAUSES' },
  { from: 'FAULT-TIRE-LOOSEN-AFTER-LIFT-001', to: 'CONSEQUENCE-TIRE-VEHICLE-FALL-001', type: 'CAUSES' },
];
