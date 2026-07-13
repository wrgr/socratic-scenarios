/**
 * AJP corpus chunks for proficiency-calibrated retrieval during In-Operation and
 * Socratic modes. Similarity scores are pre-computed estimates (TF-IDF-compatible).
 */
import type { CorpusChunk } from '../../types';

export const ajpCorpusChunks: CorpusChunk[] = [
  {
    id: 'ajp-machine-overview-explain',
    conceptId: 'ajp-machine-systems',
    content:
      'The Optomec HD2 Aerosol Jet Printer deposits conductive traces using a focused aerosol stream. Four key subsystems: (1) atomizer — converts liquid ink to fine aerosol; (2) deposition head — focuses aerosol via coaxial sheath gas through a nozzle; (3) motion stage — moves the substrate under the stationary head; (4) KEWB — the control software that monitors gas pressure, flow rates, and atomizer current in real time.',
    chunkType: 'explanation',
    difficulty: 'novice',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-atomizer-explain': 0.65,
      'ajp-sheath-gas-explain': 0.55,
      'ajp-startup-procedure': 0.60,
      'ajp-fault-clog-explain': 0.40,
      'ajp-tacit-plume-visual': 0.30,
      'ajp-safety-nanoparticle': 0.50,
      'ajp-transfer-flex-pcb': 0.35,
      'ajp-parameter-interactions': 0.45,
    },
  },
  {
    id: 'ajp-atomizer-explain',
    conceptId: 'ajp-machine-systems',
    content:
      'The ultrasonic atomizer (UA) uses transducer vibration (0.3–0.7 mA operating range) to aerosolize 2–3 mL of ink into 2–5 μm droplets. The pneumatic atomizer (PA) uses pressurized gas and handles higher-viscosity inks. UA is preferred for silver nanoparticle ink and fine-feature repair. Key monitoring: KEWB atomizer current (nominal 0.4–0.6 mA for UA). Below range = insufficient aerosolization; above range = over-aerosolization with widened particle distribution.',
    chunkType: 'explanation',
    difficulty: 'beginner',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.65,
      'ajp-sheath-gas-explain': 0.70,
      'ajp-startup-procedure': 0.72,
      'ajp-fault-clog-explain': 0.65,
      'ajp-tacit-plume-visual': 0.60,
      'ajp-safety-nanoparticle': 0.45,
      'ajp-transfer-flex-pcb': 0.40,
      'ajp-parameter-interactions': 0.62,
    },
  },
  {
    id: 'ajp-sheath-gas-explain',
    conceptId: 'ajp-process-parameters',
    content:
      'Sheath gas flows coaxially around the aerosol stream inside the deposition head, compressing it narrower than the nozzle orifice diameter. This focusing effect enables sub-nozzle feature sizes. Nominal pressure for 150 μm nozzle: 4.5–5.5 PSI. Too low: aerosol contacts nozzle walls → immediate clogging. Too high: stream defocused → wide, blurry lines. Sheath gas must be established and confirmed before atomizer start — it protects the nozzle during startup.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.55,
      'ajp-atomizer-explain': 0.70,
      'ajp-startup-procedure': 0.75,
      'ajp-fault-clog-explain': 0.68,
      'ajp-tacit-plume-visual': 0.58,
      'ajp-safety-nanoparticle': 0.42,
      'ajp-transfer-flex-pcb': 0.45,
      'ajp-parameter-interactions': 0.78,
    },
  },
  {
    id: 'ajp-startup-procedure',
    conceptId: 'ajp-startup-procedure',
    content:
      'HD2 startup sequence (order is safety-critical): (1) PPE + ventilation check; (2) PCB load + ESD strap; (3) sheath gas to nominal and confirmed; (4) atomizer activation + KEWB current verify; (5) plume check on camera + test trace. Each step has a verification gate — do not advance until the current step is confirmed. Sheath gas before atomizer is the most common sequencing error made by new technicians.',
    chunkType: 'procedure',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.60,
      'ajp-atomizer-explain': 0.72,
      'ajp-sheath-gas-explain': 0.75,
      'ajp-fault-clog-explain': 0.70,
      'ajp-tacit-plume-visual': 0.62,
      'ajp-safety-nanoparticle': 0.60,
      'ajp-transfer-flex-pcb': 0.50,
      'ajp-parameter-interactions': 0.65,
    },
  },
  {
    id: 'ajp-fault-clog-explain',
    conceptId: 'ajp-fault-diagnosis',
    content:
      'Nozzle clog is the most common AJP failure. Partial clog: KEWB pressure slightly above nominal, line width reduced, atomizer current normal. Full clog: pressure significantly elevated, zero deposition. Diagnosis key: if atomizer current is normal, the fault is downstream of atomization — the nozzle. First-line response to partial clog: increase sheath gas by 0.5–1.0 PSI and monitor. Never increase atomizer pressure to force through a clog — this drives partial → full and risks dangerous pressure buildup.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.40,
      'ajp-atomizer-explain': 0.65,
      'ajp-sheath-gas-explain': 0.68,
      'ajp-startup-procedure': 0.70,
      'ajp-tacit-plume-visual': 0.75,
      'ajp-safety-nanoparticle': 0.55,
      'ajp-transfer-flex-pcb': 0.65,
      'ajp-parameter-interactions': 0.60,
    },
  },
  {
    id: 'ajp-tacit-plume-visual',
    conceptId: 'ajp-print-quality',
    content:
      'Expert plume assessment: a healthy plume appears as a thin, stable, slightly luminous stream on the camera feed — consistent width along its length, no flickering. A clogging plume appears narrowed, sometimes intermittent. A sheath-deficient plume appears wider and less defined. Atomizer issues appear as plume flickering or absence. Experienced operators catch a developing clog by a sustained plume narrowing trend over 3–5 minutes, before KEWB pressure crosses the threshold. This perceptual skill is the primary expert-novice gap.',
    chunkType: 'explanation',
    difficulty: 'advanced',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.30,
      'ajp-atomizer-explain': 0.60,
      'ajp-sheath-gas-explain': 0.58,
      'ajp-startup-procedure': 0.62,
      'ajp-fault-clog-explain': 0.75,
      'ajp-safety-nanoparticle': 0.40,
      'ajp-transfer-flex-pcb': 0.70,
      'ajp-parameter-interactions': 0.55,
    },
  },
  {
    id: 'ajp-safety-nanoparticle',
    conceptId: 'ajp-safety-protocols',
    content:
      'Silver nanoparticle ink hazards: inhalation risk (particles 1–100 nm penetrate deep lung tissue), dermal absorption risk. Required PPE: nitrile gloves (not latex — silver nanoparticles penetrate latex), N95 or better respirator, lab coat. Ventilation must be active before any ink handling. Nanoparticle exposure risk is not limited to printing — particles are present on any surface contacting the ink including vial exterior, tubing fittings, and workstation surfaces.',
    chunkType: 'explanation',
    difficulty: 'beginner',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.50,
      'ajp-atomizer-explain': 0.45,
      'ajp-sheath-gas-explain': 0.42,
      'ajp-startup-procedure': 0.60,
      'ajp-fault-clog-explain': 0.55,
      'ajp-tacit-plume-visual': 0.40,
      'ajp-transfer-flex-pcb': 0.45,
      'ajp-parameter-interactions': 0.38,
    },
  },
  {
    id: 'ajp-transfer-flex-pcb',
    conceptId: 'ajp-fault-diagnosis',
    content:
      'Transfer scenario: AJP repair on flexible polyimide (flex PCB) substrate. Key differences from FR-4: lower thermal tolerance (max chuck temp ~100°C vs. 200°C for FR-4), surface energy differences requiring plasma cleaning, different mechanical fixturing to prevent substrate movement. Fault diagnosis principles transfer directly — the nozzle and gas system behave identically regardless of substrate. A pressure spike on flex PCB has the same differential diagnosis as on FR-4: check nozzle first, not substrate.',
    chunkType: 'transfer-scenario',
    difficulty: 'advanced',
    roleContext: 'repair-technician',
    transferDomain: 'ajp-flex-pcb-repair',
    similarityScores: {
      'ajp-machine-overview-explain': 0.35,
      'ajp-atomizer-explain': 0.40,
      'ajp-sheath-gas-explain': 0.45,
      'ajp-startup-procedure': 0.50,
      'ajp-fault-clog-explain': 0.65,
      'ajp-tacit-plume-visual': 0.70,
      'ajp-safety-nanoparticle': 0.45,
      'ajp-parameter-interactions': 0.55,
    },
  },
  {
    id: 'ajp-parameter-interactions',
    conceptId: 'ajp-process-parameters',
    content:
      'Critical parameter interactions: (1) Sheath gas ↔ standoff — increasing sheath gas without adjusting standoff shifts the focus point and defocuses the line. (2) Atomizer current ↔ ink viscosity — higher viscosity inks need more current; same current setting produces different particle sizes with different ink batches. (3) Print speed ↔ line width — faster speed = thinner line, all else equal. (4) Chuck temperature ↔ in-situ sintering — temperatures above 150°C during printing can pre-sinter and crack silver traces before the toolpath completes.',
    chunkType: 'explanation',
    difficulty: 'advanced',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-machine-overview-explain': 0.45,
      'ajp-atomizer-explain': 0.62,
      'ajp-sheath-gas-explain': 0.78,
      'ajp-startup-procedure': 0.65,
      'ajp-fault-clog-explain': 0.60,
      'ajp-tacit-plume-visual': 0.55,
      'ajp-safety-nanoparticle': 0.38,
      'ajp-transfer-flex-pcb': 0.55,
    },
  },

  // ── KB-DOC-01–05 tacit knowledge chunks (dense retrieval) ─────────

  {
    id: 'ajp-tacit-process-signals',
    conceptId: 'ajp-fault-diagnosis',
    content:
      'Expert perceptual signals for AJP HD2 in-operation monitoring. ' +
      'PA atomizer: healthy jar wall shows fine uniform droplet mist on lower walls continuously; bare patches or large blobs indicate viscosity/clog problem; cycling mist indicates intermittent partial clog. ' +
      'Nozzle plume: healthy plume is tight coaxial column with slight convergence; wide diffuse plume means sheath too low; sideways drift means nozzle damage. ' +
      'Five-state canonical line quality: Ideal (crisp edges, uniform width, no satellites); Overspray (diffuse edge halo, sheath too low or standoff too large); Dropout (intermittent gaps, partial clog or speed too high); Blob formation (discrete accumulations, reduce atomizer or clean impactor); No deposition (complete blockage). ' +
      'UA sound: steady high-pitched tone = normal; pulsing = ink level critically low; pitch rising = level dropping; rattling = vial incorrectly seated. ' +
      'KEWB pressure trend: rising = developing clog; falling = possible leak; stable with spikes = blob events; sudden flat = gas flow problem.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-fault-clog-explain': 0.72,
      'ajp-atomizer-explain': 0.68,
      'ajp-sheath-gas-explain': 0.65,
      'ajp-tacit-fault-diagnosis': 0.70,
      'ajp-parameter-interactions': 0.60,
    },
  },

  {
    id: 'ajp-tacit-fault-diagnosis',
    conceptId: 'ajp-fault-diagnosis',
    content:
      'Expert fault diagnosis reasoning for AJP HD2. ' +
      'OBSERVE→LOCALIZE→DISCRIMINATE→ACT→VERIFY loop: always observe the full symptom set before acting; use temporal onset (from-first-line vs. mid-print vs. sudden) to localize the root cause category. ' +
      'Single-change rule: change one parameter at a time and run a qualification print after each change; two simultaneous changes make root cause undetectable. ' +
      'Wide-line discrimination (4 causes with different fixes): sheath gas too low (increase sheath); print speed too slow (increase speed); atomizer output too high (reduce carrier flow); standoff too large (reduce Z height). ' +
      'Substrate vs. parameter distinction: gaps and dewetting with correct line shape = substrate preparation problem, not print parameter problem. ' +
      'Novice error pattern: adjusting print parameters when the real problem is substrate contamination or surface energy.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-fault-clog-explain': 0.75,
      'ajp-tacit-process-signals': 0.70,
      'ajp-parameter-interactions': 0.68,
      'ajp-sheath-gas-explain': 0.60,
      'ajp-startup-procedure': 0.50,
    },
  },

  {
    id: 'ajp-tacit-gas-system',
    conceptId: 'ajp-process-parameters',
    content:
      'Expert tacit knowledge for AJP gas system management. ' +
      'Startup sequence rationale (exhaust→sheath→atomizer): exhaust must be running before aerosol is generated — it creates the wind-tunnel effect that prevents nanoparticle escape into the lab. Sheath must be flowing before atomizer starts so the aerosol is focused immediately. ' +
      'Shutdown sequence reversal with 10-second and 60-second purge waits: skipping purge leaves aerosol in the system that dries and clogs. ' +
      'Focus ratio (sheath:carrier, optimal 2–4): this is the managed parameter, not individual flow values. Adjusting carrier without compensating sheath changes the focus ratio and shifts line width. ' +
      'Elevation correction: labs above sea level require higher sheath pressure setpoints to achieve equivalent volumetric flow. ' +
      'First-of-day conditioning: run 3–5 test lines on sacrificial substrate to flush residual dried ink from lines; in cold environments (<18°C), allow 15-minute warm-up before printing.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-sheath-gas-explain': 0.78,
      'ajp-startup-procedure': 0.72,
      'ajp-parameter-interactions': 0.70,
      'ajp-tacit-process-signals': 0.60,
      'ajp-tacit-fault-diagnosis': 0.58,
    },
  },

  {
    id: 'ajp-tacit-assembly',
    conceptId: 'ajp-startup-procedure',
    content:
      'Expert tacit knowledge for AJP HD2 assembly and maintenance. ' +
      'Nozzle installation: rotate counterclockwise first to feel the click indicating threads are aligned before engaging; finger-tight plus 1/8 turn (O-ring seal, not metal clamping); cross-threading causes uneven pressure distribution and immediate leak. ' +
      'PA jar loading: jet tube must be ≥15 mm above ink surface; overfill shows zero KEWB pressure despite gas flowing; jar lid O-ring should give slight resistance on final quarter-turn. ' +
      'Cleaning protocol: DI water flush → 4-hour Branson IS ultrasonic soak → IPA rinse → N₂ blow-out; shortening the 4-hour soak leaves dried ink residue that causes virtual impactor clogging; remove all O-rings before sonication. ' +
      'O-ring inspection: visual sheen present but no excess bead; tactile slightly tacky with no thick smear; both over- and under-lubrication cause leaks.',
    chunkType: 'explanation',
    difficulty: 'intermediate',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-startup-procedure': 0.72,
      'ajp-tacit-process-signals': 0.55,
      'ajp-atomizer-explain': 0.58,
      'ajp-tacit-gas-system': 0.60,
      'ajp-fault-clog-explain': 0.65,
    },
  },

  {
    id: 'ajp-tacit-sintering',
    conceptId: 'ajp-print-quality',
    content:
      'Expert tacit knowledge for sintering AJP silver nanoparticle traces. ' +
      'Substrate thermal limits: FR-4 PCB 130–160 °C; polyimide 200–250 °C; ceramic 300 °C+; flex (PET/PEN) 120–150 °C. Most thermally sensitive component in the sintering zone governs the window. ' +
      'Ramp rate ≤5 °C/min: faster ramps trap organic binder outgas under a densifying outer layer causing transverse cracks. Never place PCB in pre-heated oven. Use staged profile: ambient → 100 °C hold 10 min → ramp to sinter temp. ' +
      'Temperature–time tradeoff: 130 °C for 60–90 min can substitute for 150 °C for 30–45 min when substrate limits are tight. After ~90 min, additional time gives diminishing conductivity returns. ' +
      'Resistance interpretation post-sinter: 1–10 Ω = excellent; 10–100 Ω = adequate for repair; 100–500 Ω = marginal; >500 Ω = insufficient; OL = gap. ' +
      'Visual inspection alone is insufficient: always measure resistance and check for shorts to adjacent traces after sintering.',
    chunkType: 'explanation',
    difficulty: 'advanced',
    roleContext: 'repair-technician',
    similarityScores: {
      'ajp-fault-clog-explain': 0.50,
      'ajp-tacit-process-signals': 0.55,
      'ajp-tacit-fault-diagnosis': 0.58,
      'ajp-startup-procedure': 0.45,
      'ajp-parameter-interactions': 0.55,
    },
  },
];
