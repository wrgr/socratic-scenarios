/**
 * Consequence nodes for the Roadside Tire Change domain.
 * Activated when a learner advances past an unresolved safety gate — the Narrator
 * then describes the realistic downstream outcome of the skipped action.
 * Severity: 'human' | 'machine' | 'part'  (reuses the AJP ConsequenceNode shape).
 */
import type { AJPEdge } from '../../types/ajp';
import type { ConsequenceNode } from '../ajp/consequences';

export const tireConsequenceNodes: ConsequenceNode[] = [
  {
    id: 'CONSEQUENCE-TIRE-VEHICLE-FALL-001',
    type: 'Consequence',
    content:
      'The vehicle shifted and dropped off the jack. On soft or sloped ground, or when sideways force is applied to a raised vehicle, the jack tips and the car falls. Anyone reaching in near the wheel well can be crushed — this is the leading cause of serious injury during tire changes. The jack and rocker panel are likely damaged and the wheel work is lost.',
    severity: 'human',
    reversible: false,
    immediateAction:
      'Keep all body parts out from under a jack-supported vehicle. If it drops, do not reach in. Re-chock, reset on firm level ground, and use jack stands before any further work.',
    linkedFaultId: 'FAULT-TIRE-JACK-UNSTABLE-001',
    safetyAlert:
      'A vehicle can fall off a jack in under a second. Never place any part of your body under a vehicle held only by a jack.',
    confidence: 'High',
    source: 'NHTSA roadside tire-change guidance; vehicle owner manual jacking section',
  },
  {
    id: 'CONSEQUENCE-TIRE-WHEEL-DETACH-001',
    type: 'Consequence',
    content:
      'The wheel worked loose and separated while driving. Lug nuts that were not tightened to specification in a star (crisscross) pattern let the wheel seat unevenly; the nuts back off over the first few miles and the wheel departs the vehicle at speed. Result is loss of control, damage to the hub and fender, and danger to other road users.',
    severity: 'human',
    reversible: false,
    immediateAction:
      'Before driving, tighten every lug by hand, then torque to the vehicle spec in a star pattern with the wheel back on the ground. Re-check torque after ~50 miles.',
    linkedFaultId: 'FAULT-TIRE-TORQUE-IMPROPER-001',
    safetyAlert:
      'Under-torqued or unevenly torqued lug nuts cause wheel-off events. Torque to spec in a star pattern, on the ground.',
    confidence: 'High',
    source: 'Vehicle owner manual lug-torque spec; tire-industry (TIA) wheel-installation practice',
  },
  {
    id: 'CONSEQUENCE-TIRE-ROLLAWAY-001',
    type: 'Consequence',
    content:
      'The vehicle rolled while being lifted. With the parking brake off, no wheel chock, and (on a manual) not left in gear, raising one corner let the car roll off the jack and forward. A rolling vehicle on a roadside endangers the operator and passing traffic.',
    severity: 'human',
    reversible: false,
    immediateAction:
      'Stop work. Set the parking brake, place a chock at the wheel diagonally opposite the one being changed, and put an automatic in Park / a manual in gear before lifting again.',
    linkedFaultId: 'FAULT-TIRE-NO-CHOCK-001',
    safetyAlert:
      'Parking brake ON, chock the diagonal wheel, and leave the transmission engaged before jacking.',
    confidence: 'High',
    source: 'NHTSA roadside tire-change guidance; vehicle owner manual',
  },
  {
    id: 'CONSEQUENCE-TIRE-BODY-DAMAGE-001',
    type: 'Consequence',
    content:
      'The jack punched into the floor pan / rocker instead of a reinforced jack point. Lifting on unreinforced sheet metal bends and tears the body, and the jack can slip off the deforming surface — turning a cosmetic mistake into the vehicle-fall hazard. The bent pinch-weld seam is a structural repair, not a quick fix.',
    severity: 'part',
    reversible: false,
    immediateAction:
      'Lower the vehicle. Locate the reinforced jack point (the marked pinch-weld seam behind the front wheels / ahead of the rear wheels per the owner manual) and reposition the jack there.',
    linkedFaultId: 'FAULT-TIRE-JACK-WRONG-POINT-001',
    safetyAlert:
      'Jack only on the reinforced jack points shown in the owner manual — never on the floor pan, oil pan, or plastic trim.',
    confidence: 'High',
    source: 'Vehicle owner manual jacking-point diagram',
  },
];

// No intra-domain consequence edges are required for the scenario engine; the
// CAUSES linkage from fault → consequence lives in nodes.ts alongside the graph.
export const tireConsequenceEdges: AJPEdge[] = [];
