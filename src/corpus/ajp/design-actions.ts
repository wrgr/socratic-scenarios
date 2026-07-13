/**
 * AJP corrective action nodes from design document §5.1.
 * Four action sequences missing from the original Knowledge Registry that are
 * referenced by fault nodes in design-faults.ts and required by scenario scripts.
 *
 * Sources: Stanford SNF SOP (SRC-018), Boise State IML SOP (SRC-019),
 * standard ESD / nanoparticle safety practice.
 */
import type { AJPNode, AJPEdge } from '../../types/ajp';

export const designActionNodes: AJPNode[] = [
  {
    id: 'ACTION-LEAK-DIAGNOSIS-001',
    type: 'CorrectiveAction',
    content:
      'Systematic leak isolation sequence. Step 1: set sheath gas to zero immediately — do NOT start atomizer. Step 2: visually inspect each connection in frequency order: PFA tube at printhead → PFA tube at virtual impactor → printhead O-rings → impactor O-rings → atomizer cap gasket. Step 3: look for white haze, angled tube cuts, loose ferrules, or dry O-rings. Step 4: fix each issue (re-seat tube fully, replace O-ring, apply Apiezon L grease). Step 5: restore sheath gas and confirm KEWB pressure is in nominal band for ≥60 seconds before proceeding.',
    safetyAlert: 'Zero sheath gas before any inspection. Never start atomizer gas while leak is suspected.',
    confidence: 'High',
    source: 'SRC-018 Section 8.2',
  },
  {
    id: 'ACTION-ABORT-PRINT-001',
    type: 'CorrectiveAction',
    content:
      'Mid-print abort procedure. Step 1: pause stage motion in KEWB. Step 2: execute correct gas shutdown sequence — Atomizer OFF → wait 10 seconds → Exhaust OFF → wait 60 seconds → Sheath OFF. Step 3: do NOT lift nozzle over PCB until gas sequence is complete (aerosol still present). Step 4: inspect nozzle tip under magnification; inspect PCB for blobs, drag marks, or unexpected deposits. Step 5: diagnose the fault that triggered abort before deciding to resume or disassemble.',
    safetyAlert: 'Always complete the gas shutdown sequence before moving nozzle. Aerosol persists briefly after atomizer off.',
    confidence: 'High',
    source: 'SRC-018 Sections 9-10, SRC-019 Section 7.1',
  },
  {
    id: 'ACTION-ESD-PROTOCOL-001',
    type: 'CorrectiveAction',
    content:
      'ESD handling procedure before touching PCB. Step 1: put on wrist strap and connect to verified ground point. Step 2: TEST the wrist strap using the tester on the ESD mat — do not assume it works. Step 3: touch ESD mat with both hands before picking up board. Step 4: keep board on ESD mat when not in fixture. Step 5: verify PCB is placed on ESD-safe surface inside fixture. Step 6: if humidity is below 40% RH, use ionising blower if available — low humidity dramatically increases static charge accumulation.',
    safetyAlert: 'Always test the wrist strap with a tester — a broken strap provides no protection. ESD damage is often invisible and irreversible.',
    confidence: 'High',
    source: 'HAZARD-ESD-001, standard electronics ESD practice',
  },
  {
    id: 'ACTION-INCIDENT-REPORT-001',
    type: 'CorrectiveAction',
    content:
      'Post-nanoparticle-exposure reporting procedure. If unsheathed aerosol is released: Step 1: evacuate area immediately and ventilate. Step 2: do not re-enter until airborne particles have settled (minimum 30 minutes). Step 3: notify lab safety officer within 1 hour of incident. Step 4: document: time, duration of exposure, estimated quantity of ink involved, personnel present. Step 5: complete institution nanoparticle exposure incident report per your site SDS. Step 6: follow up with occupational health per site protocol. Silver nanoparticles are not acutely toxic at typical AJP quantities but cumulative exposure requires tracking.',
    safetyAlert: 'Report ALL unsheathed aerosol releases to the lab safety officer — nanoparticle exposure requires documentation per regulatory requirement.',
    confidence: 'High',
    source: 'HAZARD-NANOPARTICLE-001, regulatory requirement',
  },
];

export const designActionEdges: AJPEdge[] = [
  // Leak diagnosis resolves both leak fault types
  { from: 'FAULT-LEAK-FITTING-001', to: 'ACTION-LEAK-DIAGNOSIS-001', type: 'FIXED_BY' },
  { from: 'FAULT-LEAK-ORING-001', to: 'ACTION-LEAK-DIAGNOSIS-001', type: 'FIXED_BY' },
  { from: 'ACTION-LEAK-DIAGNOSIS-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // Abort print resolves mid-print faults requiring stop
  { from: 'FAULT-BLOB-FORMATION-001', to: 'ACTION-ABORT-PRINT-001', type: 'FIXED_BY' },
  { from: 'FAULT-CLOG-VIRTUAL-IMPACTOR-001', to: 'ACTION-ABORT-PRINT-001', type: 'FIXED_BY' },
  { from: 'ACTION-ABORT-PRINT-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },

  // ESD protocol required before any board handling
  { from: 'FAULT-ESD-DAMAGE-001', to: 'ACTION-ESD-PROTOCOL-001', type: 'FIXED_BY' },
  { from: 'ACTION-ESD-PROTOCOL-001', to: 'HAZARD-ESD-001', type: 'REQUIRES' },

  // Incident report required after nanoparticle release
  { from: 'FAULT-GAS-SEQUENCE-WRONG-001', to: 'ACTION-INCIDENT-REPORT-001', type: 'FIXED_BY' },
  { from: 'ACTION-INCIDENT-REPORT-001', to: 'HAZARD-NANOPARTICLE-001', type: 'REQUIRES' },
];
