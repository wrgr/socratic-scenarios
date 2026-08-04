# COLREG Collision-Avoidance Simulator — Design

**Status:** Largely implemented. The kinematic engine, elliptical ship domain,
CRI, compliance scoring, SB-MPC reference solver, and the interactive
`ColregSimulator` component all shipped (`src/engine/colreg-sim/`,
`src/components/ColregSimulator.tsx`). The **velocity-obstacle** analysis
(`velocity-obstacle.ts`) and its velocity-space **inset visualization** are now in
too, alongside a fuller set of Imazu-style multi-ship scenarios. Remaining future
work: a VO-cone-based reference solver (the current reference is the SB-MPC sweep)
and the complete 22-case Imazu benchmark. This document specifies the *full
buildout* that complements the shipped **COLREG basic** teaching domain
(`src/corpus/colreg/`). The basic domain teaches the Rules through the standard
TeachMe paradigm (knowledge graph + scripted encounters + Socratic probes +
safety gates). This simulator adds the thing that paradigm cannot express: a
**continuous kinematic model with learner controls, hard constraints, and a
performance objective** that scores a maneuver on *safety/compliance* and *route
optimality* together.

> Scope note: this is a training/《educational》simulator for reasoning about the
> COLREGs, not a navigation aid. It is deliberately 2-D and kinematic.

---

## 1. Goals

A learner is given an encounter (ownship + one or more target vessels) and must
choose a maneuver — changes to **heading** and/or **speed** over time — that:

1. **Stays safe** — never breaches the ship domain (the hard floor: no collision /
   domain incursion) and *opens* the closest point of approach (CPA) toward a
   target margin of **2× the ship-domain radius**. The 2× margin is an
   **objective to maximize toward, not a pass/fail threshold**: in extremis,
   restricted sea-room, or awkward multi-target geometry it may be unachievable,
   and the model must still return the *best available* maneuver rather than
   declare the encounter infeasible. The only hard safety constraint is avoiding
   the domain itself.
2. **Stays compliant** — obeys the applicable COLREG Rules (correct give-way /
   stand-on role, correct *direction* of alteration, *substantial* and *early*
   action, no alteration to port for a crossing vessel on the starboard side,
   safe speed in restricted visibility, …).
3. **Stays optimal** — minimizes deviation from the direct route, because minimum
   deviation is the proxy for **less time and less fuel**. The best maneuver is
   the *smallest* compliant one that opens a good margin.

The teaching point is the trade-off among 1, 2, and 3. The only hard constraints
are *don't breach the ship domain* and the direction rules; everything else —
the **margin toward 2×**, the *amount* of extra deviation — is a graded objective.
Good seamanship is the maneuver that opens a healthy margin **and** keeps
deviation low: not the maximum-avoidance panic turn (huge margin, huge deviation),
not the tempting shortcut that leaves only a sliver of margin. Because 2× is an
objective rather than a gate, the solver can legitimately trade a slightly smaller
margin for much less deviation when the geometry is tight — which is exactly the
judgment the trainer is teaching.

This maps directly onto the user's framing: **constraints** (speed, turn radius,
plus the hard no-domain-incursion floor), **controls** (speed, heading),
**performance** = maintaining safety/compliance + optimality of routes (minimum
deviation), with the **2× safety margin as an optimization target**.

---

## 2. State & units

Work in a local 2-D plane, SI-ish units: metres, seconds, with speed shown to the
learner in knots and distances in nautical miles.

```
Vessel = {
  id: string
  x, y:      position (m)          // local tangent plane
  psi:       heading (rad)         // 0 = North, clockwise +, compass convention
  v:         speed (m/s)
  // static:
  domainRadius: m                  // ship-domain radius for the safety margin
  vMax, vMin:   m/s
  turnRateMax:  rad/s              // = v / turnRadiusMin (speed-dependent)
  accelMax:     m/s^2              // surge accel/decel limit
}
Scenario = {
  ownship: Vessel
  targets: Vessel[]                // each on a fixed course/speed (v1), or scripted
  visibility: 'clear' | 'restricted'
  seaRoom: bounds                  // optional soft boundaries
  intendedTrack: { psi0, ... }     // the direct route deviation is measured against
}
```

Compass convention so heading math reads naturally:

```
xdot = v * sin(psi)      // East
ydot = v * cos(psi)      // North
```

---

## 3. Controls & constraints

The learner (or the reference solver) issues a **control command**:

```
Command = {
  headingCmd: rad          // desired heading
  speedCmd:   m/s          // desired speed
  atTime:     s            // when the command is issued (for "early action" scoring)
}
```

Constraints turn the command into achievable motion — these are the "input
constraints like speed and turn radius" made concrete:

- **Speed limits:** `speedCmd` clamped to `[vMin, vMax]`.
- **Surge limit:** `|dv/dt| ≤ accelMax` (a ship cannot change speed instantly).
- **Turn-radius limit:** `|dpsi/dt| ≤ turnRateMax`, where
  `turnRateMax = v / turnRadiusMin`. This is the key coupling — **a faster ship
  turns in a wider circle**, so the minimum turn radius is a hard constraint and
  slowing down can be part of a tighter avoiding maneuver.
- **Rudder-rate limit (optional, phase 2):** cap `d(dpsi/dt)/dt` so heading
  changes ramp rather than step.

## 4. Dynamics

A kinematic unicycle model, integrated with a fixed timestep (RK4; `dt ≈ 0.5 s`,
sim horizon a few minutes). No hydrodynamics — turn/accel *rate limits* stand in
for maneuverability, which is the right altitude for a Rules trainer.

```
psi  += clamp(headingError, ±turnRateMax*dt)
v    += clamp(speedError,   ±accelMax*dt)
x    += v*sin(psi)*dt
y    += v*cos(psi)*dt
```

Targets advance on their own (constant course/speed by default; scripted profiles
for advanced scenarios, e.g. a give-way vessel that "wakes up" late).

`src/engine/colreg-sim/kinematics.ts` owns `stepVessel(vessel, cmd, dt)` and
`integrate(scenario, commands, horizon)` → a `Trajectory` (array of world states).

---

## 5. Safety metric — CPA/TCPA and the 2× margin

For ownship O and target T, from relative position `r = T − O` and relative
velocity `w = vT − vO`:

```
TCPA = −(r · w) / (w · w)          // time to closest approach (clamp ≥ 0)
DCPA = | r + w * TCPA |            // distance at closest approach
```

- **Instantaneous** DCPA/TCPA drive the live readout and the "risk exists"
  signal (Rule 7: steady bearing ⇒ DCPA→0).
- **Realized** min-range over the integrated trajectory is what scoring uses (a
  maneuver can look fine instantaneously and still close the margin as geometry
  evolves), evaluated against every target (worst case).

Two distinct quantities — keep them separate:

- **Hard safety floor (the only safety *constraint*):** `min-range ≥ domainRadius`
  for all targets. Breaching the ship domain *is* the collision/near-miss the
  model must never choose; it is enforced as a barrier in the objective, not
  traded against anything.
- **Margin objective (the *target*):** `targetCPA = k · domainRadius`, with
  `k = 2.0` baseline (configurable per scenario). Opening min-range toward
  `targetCPA` is **rewarded** by the objective (§7) — it is *not* a feasibility
  gate. A maneuver that clears the domain but only reaches, say, 1.4× is
  safe-but-suboptimal, not "failed"; the score reflects the shortfall smoothly.

`src/engine/colreg-sim/cpa.ts`: `cpa(o, t)`, `minRangeOverTrajectory(traj, targets)`.

---

## 6. Compliance checker (rule-based)

Classify the encounter, derive the required action, and score the learner's
maneuver against it. This reuses the *concepts already encoded* in the basic
domain's graph (`src/corpus/colreg/nodes.ts`), so the simulator and the Socratic
content stay consistent.

1. **Classify** from relative bearing + aspect at detection:
   head-on (Rule 14), crossing (Rule 15), overtaking (Rule 13); plus Rule 18
   vessel-type overrides if modeled.
2. **Assign role:** give-way (Rule 16) or stand-on (Rule 17).
3. **Score the maneuver** on the dimensions the Rules actually care about:
   - **Direction:** starboard alteration for head-on / crossing give-way;
     *penalize* alteration to port for a crossing vessel on the starboard side
     (Rule 15) and, for a stand-on vessel acting, altering to port for a vessel
     on its port side (Rule 17c).
   - **Magnitude:** alteration must be **substantial / readily apparent** — a
     single bold change (≈ ≥30° in open water), not a succession of small ones
     (Rule 8). Measured from the trajectory's heading history.
   - **Timing:** action taken in **ample time** — scored on TCPA-at-command
     (Rule 8/16). Late action is penalized even if it "works".
   - **Speed (restricted visibility):** require a reduction to a safe speed and
     penalize alteration to port for a contact forward of the beam (Rules 6/19).
   - **Stand-on discipline:** hold course/speed until the give-way vessel is
     plainly not acting, then act (Rule 17) — scored on *when* the stand-on
     learner intervenes.

Output: `ComplianceReport { encounter, role, perRulePass: {ruleId: bool|score},
violations: string[] }`.

`src/engine/colreg-sim/colreg-rules.ts`.

---

## 7. Objective function

A single scalar the learner is scored against and the reference solver minimizes.
Note the shape: **one hard barrier** (domain incursion) and **three graded
objective terms** — the 2× margin is one of the graded terms, not a gate.

```
J = BARRIER(min-range < domainRadius)   // hard floor: domain incursion is effectively infeasible (huge penalty), never traded against deviation
  + w_margin     * marginShortfall      // graded margin OBJECTIVE toward 2x — see below
  + w_compliance * compliancePenalty    // from the per-rule report (direction/magnitude/timing/speed)
  + w_deviation  * deviationCost         // extra path length vs. the direct route (∝ time & fuel)
```

- **`marginShortfall`** = `clamp((targetCPA − min-range) / (targetCPA − domainRadius), 0, 1)`
  — **0 once min-range reaches the 2× target** (no reward for going further; you
  don't want the panic turn), rising smoothly to 1 at the domain edge. This is
  what makes the 2× margin an *objective the solver optimizes toward* rather than
  a constraint it must satisfy. (An even simpler variant: reward
  `min(min-range, targetCPA)` directly.)
- **`deviationCost`** = `(pathLength − progressAlongIntendedTrack) / directDistance`
  — the optimality term. Measuring *progress lost against the intended track*
  (not raw path length) is what makes a pure course change cost something: a
  bigger turn loses more ground, so the objective rewards the **smallest**
  sufficient maneuver. Minimum deviation ⇒ faster and less fuel.
- **Weights** encode the doctrine: the domain barrier dominates absolutely
  (never choose a collision). Among domain-clearing maneuvers,
  `w_margin` and `w_compliance` are large relative to `w_deviation`, but they are
  *finite* — so a slightly smaller margin (still well clear of the domain) can be
  legitimately traded for much less deviation when sea-room is tight. A
  wrong-*direction* turn is penalized through `compliancePenalty` and is not
  bought back by a shorter route. Deviation primarily differentiates *among*
  solutions that already open a good margin and comply.

`src/engine/colreg-sim/objective.ts`: `evaluate(trajectory, scenario) → { J, terms }`.

---

## 8. Reference solver (the "optimal" to grade against)

To score a learner we need the compliant minimum-deviation maneuver. Phase in:

- **Phase 1 — parameter sweep.** Discretize the decision as
  `(alterationAngle ∈ [−90°..+90°], speedFactor ∈ [0.3..1.0], commandTime)` and
  evaluate `J` for each on the integrator. Feasibility is only *domain-clearing +
  compliant* (not the 2× margin); among those, pick the minimum-`J` candidate —
  which balances the margin objective against deviation. If no candidate clears
  the domain (true in-extremis), return the max-min-range maneuver and flag it
  rather than reporting "no solution". Cheap, transparent, easy to explain to a
  learner ("here is the family of maneuvers and where yours sits").
- **Phase 2 — velocity obstacle (VO).** Compute the set of ownship velocities
  that lead to a domain incursion within the horizon; the compliant minimum-
  deviation velocity outside the VO (biased to starboard per the Rules) is the
  reference. More principled, supports multiple targets, and gives a clean
  visualization (the VO cone).

`src/engine/colreg-sim/reference-solver.ts`: `solve(scenario) → Trajectory + J`.

The learner's score is reported both absolutely (safety margin achieved, per-rule
pass/fail) and relative to the reference (`deviation vs optimal, %`).

---

## 9. Visualization & controls (UI)

New component `src/components/ColregSimulator.tsx` — a custom `<canvas>` (not
`@xyflow`, which is a node-graph tool): 

- **Plan view:** ownship + targets as vessel markers with heading vectors; track
  history (fading trails); the ship-domain circle and the `requiredCPA` ring; a
  live **CPA marker** and DCPA/TCPA readout per target; optionally the VO cone.
- **Controls:** a **heading dial** and a **speed slider** (respecting the
  turn-rate/accel limits so the learner *feels* the constraints), plus
  play / pause / step / reset time controls and a "commit maneuver" action.
- **Scoreboard:** safety margin (× domain), per-rule compliance chips,
  deviation-vs-optimal %, and a time/fuel proxy — the objective terms made legible.
- **Debrief:** overlay the learner's track against the reference solver's track.

Surface it as a **"Simulator"** tab that appears only when the COLREG domain is
active (extend the `NAV_TABS` gating already added in `App.tsx`; likely a new
per-descriptor capability flag such as `hasSimulator` alongside `fullEngine`).

---

## 10. Module skeleton

```
src/engine/colreg-sim/
  types.ts             Vessel, Scenario, Command, Trajectory, ComplianceReport, Score
  kinematics.ts        stepVessel(), integrate()            + unit tests
  cpa.ts               cpa(), minRangeOverTrajectory()      + unit tests
  colreg-rules.ts      classifyEncounter(), assignRole(), scoreCompliance()  + unit tests
  objective.ts         evaluate() → { J, terms }            + unit tests
  reference-solver.ts  solve() (sweep → VO)                 + unit tests
  sim-loop.ts          React-facing driver (play/pause/step, applies commands)
src/components/
  ColregSimulator.tsx  canvas view + controls + scoreboard + debrief
src/corpus/colreg/
  simulator-scenarios.ts   numeric encounter setups (reuse the 5 basic encounters
                           as geometry: head-on, crossing, overtaking, stand-on,
                           restricted-vis) so sim ↔ Socratic content stay aligned
```

Pure math modules (`kinematics`, `cpa`, `colreg-rules`, `objective`,
`reference-solver`) are React-free and unit-tested with Vitest — the same
discipline the rest of `src/engine/` follows.

---

## 11. Implementation phases

1. **Kinematics + CPA + a static plan view** — drive ownship manually, see tracks
   and live DCPA/TCPA. Proves the model and the feel of the constraints.
2. **Compliance checker + objective + scoreboard** — score a completed maneuver;
   no reference yet. Already teaches safety + compliance + deviation.
3. **Reference solver (sweep) + debrief overlay** — "deviation vs optimal, %".
4. **Velocity-obstacle solver + multi-target** — the principled optimum and
   richer scenarios.
5. **Restricted-visibility mode + Rule 19 specifics; scenario authoring.**

Each phase is independently useful and shippable.

---

## 12. Testing

- **Unit (Vitest):** analytic CPA cases (head-on closing, parallel, diverging);
  turn-radius honored (`realized turn rate ≤ v/turnRadiusMin`); classifier truth
  table across relative bearings; objective monotonic in deviation for fixed
  safety/compliance; reference solver returns a domain-clearing solution when one
  exists and, when the encounter is already in extremis, returns the
  max-min-range maneuver flagged rather than failing.
- **Property checks:** the reference maneuver is domain-clearing
  (`min-range ≥ domainRadius`) and compliant where achievable, and `J ≤ learner J`.
  When the geometry admits it the reference reaches the 2× target
  (`marginShortfall = 0`), but the solver does **not** require 2× — verify it
  degrades gracefully in extremis instead of reporting "no solution".
- **Runtime smoke (Playwright):** the Simulator tab loads for the COLREG domain,
  a maneuver can be committed, and the scoreboard renders.

---

## 13. Open questions for review

- **Ship domain shape:** a circle (`domainRadius`) is the simplest 2× margin; a
  larger-ahead/asymmetric domain is more realistic but harder to explain. Start
  circular.
- **Continuous control vs. decision points:** let the learner steer continuously,
  or commit discrete `(course, speed, time)` decisions? Discrete is easier to
  score and debrief; continuous is more immersive. Recommend **discrete first**.
- **Weights `w_*`:** expose as scenario config so instructors can tune how hard
  the optimality term pushes against the margin.
- **Multi-target ordering:** with several targets, do we score the worst case or
  an aggregate? Recommend worst-case for safety, aggregate for deviation.
