/**
 * AJP concept definitions for the proficiency-calibrated retrieval system.
 * Six concepts corresponding to the major knowledge domains of the HD2 repair workflow.
 */
import type { Concept } from '../../types';

export const ajpConcepts: Concept[] = [
  {
    id: 'ajp-machine-systems',
    name: 'AJP Machine Systems',
    description:
      'Optomec HD2 hardware components: atomizer (UA/PA), deposition head, motion stage, vision system, and their functional roles.',
    prerequisites: [],
    transferDomains: ['direct-write-manufacturing', 'inkjet-printing', 'dispensing-systems'],
  },
  {
    id: 'ajp-process-parameters',
    name: 'Process Parameters',
    description:
      'Operating parameters (sheath gas pressure, atomizer flow, standoff distance, print speed, chuck temperature) and their effects on deposition quality.',
    prerequisites: ['ajp-machine-systems'],
    transferDomains: ['fluid-dynamics', 'process-control', 'materials-processing'],
  },
  {
    id: 'ajp-startup-procedure',
    name: 'Startup and Shutdown Procedure',
    description:
      'Sequential startup and shutdown steps with gas sequencing dependencies, safety checks, and verification gates at each step.',
    prerequisites: ['ajp-machine-systems', 'ajp-process-parameters'],
    transferDomains: ['equipment-commissioning', 'lab-safety-protocols'],
  },
  {
    id: 'ajp-fault-diagnosis',
    name: 'Fault Diagnosis',
    description:
      'Fault taxonomy (clog, gas, deposition, substrate, post-process), symptom recognition, causal chain traversal, and corrective actions.',
    prerequisites: ['ajp-startup-procedure'],
    transferDomains: ['process-troubleshooting', 'root-cause-analysis', 'fluidic-systems'],
  },
  {
    id: 'ajp-safety-protocols',
    name: 'Safety Protocols',
    description:
      'Nanoparticle respiratory and dermal hazards, ESD protection for PCBs, pressure hazards, and risk priority hierarchy.',
    prerequisites: ['ajp-machine-systems'],
    transferDomains: ['nanomaterial-handling', 'electronics-lab-safety', 'chemical-safety'],
  },
  {
    id: 'ajp-print-quality',
    name: 'Print Quality and Tacit Knowledge',
    description:
      'Deposition quality indicators (line width, KEWB pressure trends, plume visual, atomizer sound) and expert perceptual knowledge.',
    prerequisites: ['ajp-process-parameters', 'ajp-fault-diagnosis'],
    transferDomains: ['quality-control', 'sensor-interpretation', 'process-monitoring'],
  },
];
