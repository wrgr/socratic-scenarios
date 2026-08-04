/**
 * Consequence nodes for the COLREG Collision Avoidance domain.
 * Activated when a learner advances past an unresolved safety gate — the Narrator
 * then describes the realistic downstream outcome of the non-compliant decision.
 * Severity reuses the AJP shape; at sea the relevant severities are 'human'
 * (injury/loss of life) and 'machine' (vessel damage).
 */
import type { AJPEdge } from '../../types/ajp';
import type { ConsequenceNode } from '../ajp/consequences';

export const colregConsequenceNodes: ConsequenceNode[] = [
  {
    id: 'CONSEQUENCE-COLREG-COLLISION-001',
    type: 'Consequence',
    content:
      'The two vessels collided. Because the required give-way action was wrong or absent, the closing range ran out before the situation could be resolved. A collision at sea risks loss of life, pollution, and total loss of the vessels — and under the Rules both vessels can be found at fault, the give-way vessel for not acting correctly and the stand-on vessel for failing to act when collision could not be avoided by the give-way vessel alone.',
    severity: 'human',
    reversible: false,
    immediateAction:
      'Sound the danger signal (at least five short and rapid blasts), take all way off or go astern as needed, and render assistance. A collision is not recoverable — the Rules exist to prevent reaching this point.',
    linkedFaultId: 'FAULT-COLREG-ALTER-TO-PORT-001',
    safetyAlert:
      'Wrong or absent give-way action leads to collision. Act early, act substantially, act in the direction the Rules require.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 8, 15, 16, 17',
  },
  {
    id: 'CONSEQUENCE-COLREG-CLOSE-QUARTERS-001',
    type: 'Consequence',
    content:
      'A close-quarters situation developed: the vessels passed dangerously close and the safe passing distance was lost. A small or late alteration that was not readily apparent to the other vessel — or an unsafe speed in restricted visibility — left no margin for error or for the other vessel to misjudge. Close-quarters is the last warning before collision; it forces rushed, ambiguous manoeuvres.',
    severity: 'machine',
    reversible: true,
    immediateAction:
      'Take positive action now: a bold alteration and/or a reduction of speed to open the range. Do not rely on a series of small changes. Reassess CPA before resuming course.',
    linkedFaultId: 'FAULT-COLREG-SMALL-ALTERATION-001',
    safetyAlert:
      'A close-quarters situation is the last margin before collision. Prevent it with early, substantial action and a safe speed.',
    confidence: 'High',
    source: 'IMO COLREG 1972, Rules 6, 8, 19',
  },
];

export const colregConsequenceEdges: AJPEdge[] = [];
