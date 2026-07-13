/**
 * AJP transfer problems for pretest, posttest, and transfer assessment phases.
 * Problems are designed to measure diagnostic reasoning and fault knowledge transfer.
 */
import type { TransferProblem } from '../../types';

export const ajpTransferProblems: TransferProblem[] = [
  {
    id: 'ajp-pretest-001',
    title: 'Startup Pressure Anomaly',
    scenario:
      'A technician starts the Optomec HD2 after a 2-hour idle period. The atomizer current reads nominal (0.5 mA), but KEWB pressure is trending 20% above the normal range for this nozzle. The deposition line on the test trace appears slightly narrower than the established baseline.',
    sourceConceptIds: ['ajp-fault-diagnosis', 'ajp-process-parameters'],
    targetDomain: 'ajp-repair',
    difficulty: 'intermediate',
    rubric: [
      {
        criterion: 'Correct fault identification',
        weight: 0.5,
        levels: {
          novice: 'Cannot identify the fault or identifies an unrelated system component',
          beginner: 'Identifies a pressure-related issue but cannot specify the fault location',
          intermediate: 'Identifies partial nozzle clog based on pressure + line width pattern',
          advanced: 'Identifies partial clog and explains why normal atomizer current rules out upstream cause',
          expert: 'Full differential diagnosis including why each distractor is incorrect',
        },
      },
      {
        criterion: 'Correct corrective action',
        weight: 0.5,
        levels: {
          novice: 'No corrective action identified or dangerous action proposed',
          beginner: 'Suggests stopping the print but does not specify next action',
          intermediate: 'Suggests sheath gas increase as first-line conservative response',
          advanced: 'Sheath gas increase + monitoring criteria + escalation condition',
          expert: 'Full corrective plan with safety notes and prevention strategy',
        },
      },
    ],
    options: [
      {
        id: 'a',
        text: 'Partial nozzle clog — residual ink dried at the orifice during the 2-hour idle',
        transferScore: 1.0,
        explanation:
          'Correct. Elevated pressure + narrowed line + normal atomizer current = classic partial clog signature. Residual ink drying during idle is the most common cause after unplanned downtime.',
      },
      {
        id: 'b',
        text: 'Sheath gas supply failure — gas line pressure is dropping',
        transferScore: 0.1,
        explanation:
          'Incorrect. A sheath gas supply failure would show falling or unstable pressure, not consistently elevated pressure. The direction of the KEWB deviation points away from this cause.',
      },
      {
        id: 'c',
        text: 'Atomizer malfunction — particle size distribution has widened',
        transferScore: 0.15,
        explanation:
          'Incorrect. Atomizer current is nominal (0.5 mA), indicating normal UA operation. Large particles could contribute to future clogging, but the atomizer itself is not the active fault here.',
      },
      {
        id: 'd',
        text: 'Stage positioning error — print head standoff is incorrect',
        transferScore: 0.1,
        explanation:
          'Incorrect. Stage and standoff errors affect geometric placement accuracy, not upstream gas pressure readings. Elevated KEWB pressure is a fluidic phenomenon, not a geometry one.',
      },
    ],
  },
  {
    id: 'ajp-posttest-001',
    title: 'Mid-Run Pressure Spike',
    scenario:
      'A repair technician is 20 minutes into a PCB trace repair when KEWB pressure spikes from 5.0 PSI to 7.8 PSI over 90 seconds. Deposition stops. Atomizer current remains at 0.5 mA. Camera shows no plume on the substrate.',
    sourceConceptIds: ['ajp-fault-diagnosis', 'ajp-startup-procedure'],
    targetDomain: 'ajp-repair',
    difficulty: 'intermediate',
    rubric: [
      {
        criterion: 'Full vs. partial clog differentiation',
        weight: 0.6,
        levels: {
          novice: 'Cannot distinguish fault severity',
          beginner: 'Identifies a clog but cannot determine severity',
          intermediate: 'Identifies full clog based on zero deposition + very high pressure',
          advanced: 'Full clog diagnosis with correct escalation decision (disassembly required)',
          expert: 'Full diagnosis + explains why conservative sheath adjustment would not work here',
        },
      },
      {
        criterion: 'Safety-first response',
        weight: 0.4,
        levels: {
          novice: 'Proposes increasing atomizer current',
          beginner: 'Stops the print but no structured plan',
          intermediate: 'Abort and disassemble without safety notes',
          advanced: 'Abort, disassemble, references nanoparticle safety for cleaning procedure',
          expert: 'Full response with safety protocol, cleaning steps, and requalification plan',
        },
      },
    ],
    options: [
      {
        id: 'a',
        text: 'Full nozzle clog — abort print and execute full disassembly and sonication protocol',
        transferScore: 1.0,
        explanation:
          'Correct. 7.8 PSI (>50% above nominal) + zero deposition + sudden onset = full occlusion. This requires full nozzle disassembly and sonication (4+ hours). Conservative sheath adjustment is not appropriate — the clog is complete.',
      },
      {
        id: 'b',
        text: 'Partial clog — increase sheath gas to 6.0 PSI and monitor',
        transferScore: 0.25,
        explanation:
          'Incorrect. The pressure spike magnitude (7.8 PSI) and zero deposition indicate a full clog, not a partial one. Conservative sheath gas increase is appropriate for partial clogs, not complete occlusions.',
      },
      {
        id: 'c',
        text: 'Increase atomizer current to push ink through the blockage',
        transferScore: 0.0,
        explanation:
          'Dangerous. Never increase atomizer pressure or current to force through a clog. This risks pressure buildup and potential tubing failure. This is the most dangerous response option.',
      },
      {
        id: 'd',
        text: 'Reduce print speed to compensate for reduced flow',
        transferScore: 0.05,
        explanation:
          'Incorrect. Print speed reduction does not address a nozzle occlusion. There is zero deposition — no speed adjustment can compensate for zero ink flow through the nozzle.',
      },
    ],
  },
  {
    id: 'ajp-transfer-001',
    title: 'Flexible Substrate Pressure Spike',
    scenario:
      'An electronics repair team is printing conductive traces on a flexible polyimide substrate (flex PCB) — a new application requiring lower chuck temperature and different mechanical fixturing than the standard FR-4 board used in training. Mid-print, KEWB pressure spikes to 2× nominal and all deposition stops. The repair is time-critical.',
    sourceConceptIds: ['ajp-fault-diagnosis', 'ajp-startup-procedure', 'ajp-safety-protocols'],
    targetDomain: 'ajp-flex-pcb-repair',
    difficulty: 'advanced',
    rubric: [
      {
        criterion: 'Transfer of fault diagnosis to novel substrate context',
        weight: 0.7,
        levels: {
          novice: 'Attributes the fault to the substrate change',
          beginner: 'Identifies a fault but is confused by the novel context',
          intermediate: 'Correctly identifies full clog regardless of substrate context',
          advanced: 'Identifies full clog and explains why substrate type does not change the fault diagnosis',
          expert: 'Full transfer: same fault → same diagnosis → same protocol, with substrate-specific safety notes',
        },
      },
      {
        criterion: 'Correct protocol despite novel context',
        weight: 0.3,
        levels: {
          novice: 'Suggests substrate-specific interventions unrelated to the fault',
          beginner: 'Correct abort decision but incorrect protocol',
          intermediate: 'Correct disassembly protocol',
          advanced: 'Correct protocol + flex-PCB-specific handling notes during disassembly',
          expert: 'Full protocol with safety, flex PCB handling, and requalification steps',
        },
      },
    ],
    options: [
      {
        id: 'a',
        text: 'Full nozzle clog — abort print and execute full disassembly protocol (substrate type does not change the diagnosis)',
        transferScore: 1.0,
        explanation:
          'Correct. The nozzle and gas system behave identically regardless of substrate. 2× pressure spike + zero deposition = full clog. The flex substrate changes fixturing and chuck temperature settings, not the fault diagnosis or corrective protocol.',
      },
      {
        id: 'b',
        text: 'The flex substrate moved and blocked the nozzle — check fixturing and re-register',
        transferScore: 0.15,
        explanation:
          'Incorrect. Substrate movement causes geometric errors (misplaced traces), not pressure spikes. KEWB pressure is a fluidic measurement upstream of the substrate — substrate position does not affect it.',
      },
      {
        id: 'c',
        text: 'Temperature-induced ink viscosity change due to the flex substrate\'s different thermal conductivity',
        transferScore: 0.1,
        explanation:
          'Incorrect. Ink properties are set by the ink formulation and atomizer/head temperature, not the substrate\'s thermal conductivity. The substrate does not alter ink viscosity in the nozzle.',
      },
      {
        id: 'd',
        text: 'Try conservative sheath gas increase first — the flex substrate may have different requirements',
        transferScore: 0.2,
        explanation:
          'Partially correct reasoning (conservative first is right for partial clogs), but severity is wrong. 2× pressure + zero deposition = full clog, not partial. Conservative adjustment is not appropriate here. The flex substrate is a distractor — it does not change fault severity criteria.',
      },
    ],
  },
];
