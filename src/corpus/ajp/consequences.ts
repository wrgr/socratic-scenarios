/**
 * Consequence nodes for AJP Scenario Mode (design document §4.3, §5.1).
 * Activated when a learner proceeds past an unresolved safety gate, allowing
 * the Narrator to describe the realistic downstream effect of the missed action.
 * Severity levels: 'human' | 'machine' | 'part'
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export interface ConsequenceNode extends AJPNode {
  type: 'Consequence';
  /** Who or what is harmed. */
  severity: 'human' | 'machine' | 'part';
  /** True if the outcome can be corrected; false = total loss / permanent harm. */
  reversible: boolean;
  /** Narrator announcement of immediate required action once consequence triggers. */
  immediateAction: string;
  /** The fault that, if unresolved, leads to this consequence. */
  linkedFaultId: string;
}

export const consequenceNodes: ConsequenceNode[] = [
  {
    id: 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001',
    type: 'Consequence',
    content:
      'Unsheathed Ag NP aerosol released into the work area. Operator and nearby personnel are exposed to silver nanoparticle aerosol. Exposure cannot be undone once inhaled. Immediate mandatory actions: evacuate area, ventilate, do not re-enter for 30 minutes, report to lab safety officer within 1 hour, complete nanoparticle exposure incident report.',
    severity: 'human',
    reversible: false,
    immediateAction:
      'EVACUATE immediately. Do not re-enter for 30 minutes. Notify lab safety officer within 1 hour.',
    linkedFaultId: 'FAULT-GAS-SEQUENCE-WRONG-001',
    safetyAlert:
      'Nanoparticle exposure — evacuate, ventilate, and report. This event must be documented.',
    confidence: 'High',
    source: 'HAZARD-NANOPARTICLE-001, regulatory requirement',
  },
  {
    id: 'CONSEQUENCE-PCB-THERMAL-DAMAGE-001',
    type: 'Consequence',
    content:
      'PCB substrate oversintered beyond glass transition temperature. FR4 substrate yellowing, delamination, or trace cracking visible. Thermal damage to PCB is irreversible — the board cannot be recovered. All repair work performed so far is lost. Loss of component reliability on adjacent circuits cannot be ruled out.',
    severity: 'part',
    reversible: false,
    immediateAction:
      'Remove board from oven immediately. Inspect under magnification. Document damage. Board is likely lost — do not attempt further repair.',
    linkedFaultId: 'FAULT-SINTER-THERMAL-DAMAGE-001',
    safetyAlert:
      'PCB thermal damage is irreversible. Verify substrate Tg before every sinter cycle.',
    confidence: 'High',
    source: 'Standard electronics practice, SRC-007',
  },
  {
    id: 'CONSEQUENCE-NOZZLE-CONTACT-001',
    type: 'Consequence',
    content:
      'Ceramic nozzle tip contacted the substrate during print — standoff was too small. The nozzle tip is chipped or broken and cannot be repaired. PCB may have physical damage (gouged trace, dislodged component) from nozzle contact. Both nozzle and PCB require immediate inspection under magnification before any decision to continue.',
    severity: 'machine',
    reversible: false,
    immediateAction:
      'Emergency stop. Inspect nozzle and PCB under magnification immediately. Label damaged nozzle. Assess PCB for contact damage before deciding to continue.',
    linkedFaultId: 'FAULT-STANDOFF-TOO-SMALL-001',
    safetyAlert:
      'Nozzle contact with PCB: stop immediately and inspect both nozzle and board.',
    confidence: 'High',
    source: 'SRC-018 Figure 4, SRC-019 Section 1.6',
  },
  {
    id: 'CONSEQUENCE-CLOG-UNDETECTED-PRINT-001',
    type: 'Consequence',
    content:
      'Operator continued printing through a developing clog without aborting. The deposited trace shows intermittent gaps, blobs, and inconsistent width across the repair area. A silver blob from the clog event fell on an adjacent circuit feature, creating a potential short circuit. The trace will not pass continuity testing after sintering. Repair must be re-done after PCB inspection and cleaning.',
    severity: 'part',
    reversible: true,
    immediateAction:
      'Abort print. Inspect PCB under magnification for blobs and foreign deposits. Clean with IPA if no component damage. Diagnose clog before restarting.',
    linkedFaultId: 'FAULT-CLOG-PARTIAL-001',
    safetyAlert: 'Silver blob on PCB: inspect for shorts before sintering.',
    confidence: 'High',
    source: 'SRC-018 Section 8.4',
  },
];

export const consequenceEdges: AJPEdge[] = [
  // Gas sequence wrong → nanoparticle exposure consequence
  {
    from: 'FAULT-GAS-SEQUENCE-WRONG-001',
    to: 'CONSEQUENCE-NANOPARTICLE-EXPOSURE-001',
    type: 'CAUSES',
  },
  // Sinter thermal damage → irreversible PCB loss
  {
    from: 'FAULT-SINTER-THERMAL-DAMAGE-001',
    to: 'CONSEQUENCE-PCB-THERMAL-DAMAGE-001',
    type: 'CAUSES',
  },
  // Standoff too small → nozzle contact
  {
    from: 'FAULT-STANDOFF-TOO-SMALL-001',
    to: 'CONSEQUENCE-NOZZLE-CONTACT-001',
    type: 'CAUSES',
  },
  // Partial clog unresolved → print continues into damage
  {
    from: 'FAULT-CLOG-PARTIAL-001',
    to: 'CONSEQUENCE-CLOG-UNDETECTED-PRINT-001',
    type: 'CAUSES',
  },
];
