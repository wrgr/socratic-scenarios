/**
 * AJP learning scenarios for the existing LearningScenario/advancePrompt flow.
 * Contains one placeholder scenario — the actual Scenario Mode walkthrough is
 * handled by ScenarioView, which calls advancePrompt once on completion.
 */
import type { LearningScenario } from '../../types';

export const ajpLearningScenarios: LearningScenario[] = [
  {
    id: 'ajp-startup-scenario',
    title: 'HD2 Startup and Fault Response',
    context:
      'You are a repair technician preparing the Optomec HD2 to restore electrical continuity on a damaged PCB trace. Walk through the full startup sequence and respond to any anomalies detected.',
    conceptIds: [
      'ajp-startup-procedure',
      'ajp-process-parameters',
      'ajp-fault-diagnosis',
      'ajp-safety-protocols',
    ],
    prompts: [
      {
        id: 'ajp-scenario-main',
        text: 'Complete the HD2 startup and partial clog response scenario.',
        conceptId: 'ajp-startup-procedure',
        expectedInsight:
          'Correct PPE, ESD, sheath-gas-before-atomizer sequencing, and partial clog diagnosis via KEWB pressure + line width pattern.',
        hints: [
          'Review the startup sequence in the HD2 SOP — each step has a specific ordering dependency.',
          'When KEWB shows elevated pressure, cross-reference with line width and atomizer current to isolate the fault location.',
        ],
      },
    ],
  },
];
