/**
 * COLREG interactive simulator — the "full buildout" companion to the basic
 * COLREG teaching domain. The learner commits a maneuver (course offset + speed
 * factor); the sim integrates ownship + targets, and a scoreboard grades the run
 * on the SOTA measurements: Collision Risk Index, ship-domain clearance (with the
 * 2× margin as a graded objective), per-rule COLREG compliance, and route
 * deviation. "Show optimal" overlays an SB-MPC-style reference maneuver.
 *
 * See docs/colreg-simulator-design.md and src/engine/colreg-sim/.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import type { ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import type { SimScenario, Vessel, Trajectory } from '../engine/colreg-sim';
import {
  integrate,
  maneuverControl,
  evaluate,
  solveReference,
  solveReferenceVO,
  domainRadii,
  MS_TO_KNOTS,
  NM_TO_M,
  M_TO_NM,
  criInstant,
  collisionCone,
  inCone,
  ownVelocity,
  safetyRadius,
  learnerPolicy,
  competenceAtStage,
  CURRICULUM,
  runBenchmark,
  type CollisionCone,
} from '../engine/colreg-sim';
import { colregSimScenarios } from '../corpus/colreg/simulator-scenarios';
import { imazuBenchmark } from '../corpus/colreg/imazu';
import { restrictedBenchmark } from '../corpus/colreg/restricted';
import '../styles/colreg-sim.css';

const DEG = Math.PI / 180;
const CANVAS_W = 760;
const CANVAS_H = 520;
// Playback: trajectory samples advanced per real second at 1× speed. The old loop advanced one
// sample per animation frame (~60/s), i.e. ~240× real time — far too fast to follow. This is a
// watchable default; the speed control multiplies it.
const BASE_FPS = 12;
const SPEEDS = [0.5, 1, 2] as const;

// Palette — role identity (own / target / reference) + reserved status hues.
const COL = {
  own: '#5ad1a0',
  target: '#6fb3ff',
  ref: '#e7c86a',
  domain: '#f2686c',
  margin: '#f2c14e',
  good: '#52e0b8',
  warn: '#f2c14e',
  bad: '#f2686c',
  ink: 'rgba(226,238,240,0.92)',
  faint: 'rgba(180,205,215,0.16)',
};

type Pt = [number, number];
type ToScreen = (x: number, y: number) => Pt;

// ─── Geometry helpers ─────────────────────────────────────────────

interface Bounds { minX: number; maxX: number; minY: number; maxY: number; }

function boundsOf(trajs: Trajectory[]): Bounds {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const traj of trajs) {
    for (const s of traj) {
      for (const p of [s.own, ...s.targets]) {
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      }
    }
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.14 + 500;
  return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
}

/** Crisp canvas context at logical W×H (backing store scaled by devicePixelRatio). */
function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function domainPolygon(v: Vessel, factor: number): Pt[] {
  const r = domainRadii(v);
  const pts: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    const fwd = Math.cos(a), right = Math.sin(a);
    const aLon = fwd >= 0 ? r.fore : r.aft;
    const bLat = right >= 0 ? r.star : r.port;
    const t = factor / Math.sqrt((fwd / aLon) ** 2 + (right / bLat) ** 2);
    const f = fwd * t, rt = right * t;
    pts.push([v.x + f * Math.sin(v.psi) + rt * Math.cos(v.psi), v.y + f * Math.cos(v.psi) - rt * Math.sin(v.psi)]);
  }
  return pts;
}

function polyPath(ctx: CanvasRenderingContext2D, poly: Pt[], T: ToScreen) {
  ctx.beginPath();
  poly.forEach((p, i) => { const [x, y] = T(p[0], p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.closePath();
}

function drawTrail(ctx: CanvasRenderingContext2D, pts: Pt[], T: ToScreen, color: string, dashed = false) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.setLineDash(dashed ? [7, 6] : []);
  // Fade older samples: draw in segments with rising alpha.
  for (let i = 1; i < pts.length; i++) {
    ctx.globalAlpha = dashed ? 0.5 : 0.15 + 0.75 * (i / pts.length);
    ctx.strokeStyle = color;
    const [x0, y0] = T(pts[i - 1][0], pts[i - 1][1]);
    const [x1, y1] = T(pts[i][0], pts[i][1]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  ctx.restore();
}

function drawShip(ctx: CanvasRenderingContext2D, v: Vessel, T: ToScreen, color: string, size: number, glow = false) {
  const [sx, sy] = T(v.x, v.y);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(v.psi); // screen y is down; compass heading rotates the bow-up glyph correctly
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.6);
  ctx.lineTo(size, size * 1.1);
  ctx.lineTo(0, size * 0.5);
  ctx.lineTo(-size, size * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function niceStep(target: number): number {
  const steps = [0.25, 0.5, 1, 2, 5, 10, 20];
  return steps.find((s) => s >= target) ?? 20;
}

/** Compass heading (0–359°, zero-padded) from a radian heading. */
function compassDeg(psi: number): string {
  return String(Math.round((((psi * 180) / Math.PI) % 360 + 360) % 360) % 360).padStart(3, '0');
}

function drawHeadingVector(ctx: CanvasRenderingContext2D, v: Vessel, T: ToScreen, color: string, lenPx: number) {
  const [sx, sy] = T(v.x, v.y);
  ctx.save();
  ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy);
  ctx.lineTo(sx + Math.sin(v.psi) * lenPx, sy - Math.cos(v.psi) * lenPx);
  ctx.stroke();
  ctx.restore();
}

// ─── Velocity-obstacle inset ──────────────────────────────────────

const VO_SIZE = 220;

function deltaFor(bearing: number, lenPx: number): Pt {
  return [Math.sin(bearing) * lenPx, -Math.cos(bearing) * lenPx];
}

function drawVOInset(ctx: CanvasRenderingContext2D, own: Vessel, targets: Vessel[]) {
  ctx.clearRect(0, 0, VO_SIZE, VO_SIZE);
  const bg = ctx.createLinearGradient(0, 0, 0, VO_SIZE);
  bg.addColorStop(0, '#0a1922'); bg.addColorStop(1, '#06121a');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, VO_SIZE, VO_SIZE);
  const cx = VO_SIZE / 2, cy = VO_SIZE / 2;
  const vmax = own.vMax ?? own.v * 1.5;
  const scaleMax = Math.max(vmax, ...targets.map((t) => t.v)) * 1.15 || 1;
  const sc = (VO_SIZE * 0.42) / scaleMax;
  const toS = (vx: number, vy: number): Pt => [cx + vx * sc, cy - vy * sc];

  ctx.strokeStyle = COL.faint; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(VO_SIZE, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, VO_SIZE); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, vmax * sc, 0, 2 * Math.PI); ctx.stroke();

  const Rs = safetyRadius(own);
  const cones: CollisionCone[] = targets.map((t) => collisionCone(own, t, Rs));
  const len = scaleMax * 3 * sc;
  for (const c of cones) {
    if (c.enveloping) { ctx.fillStyle = 'rgba(242,104,108,0.25)'; ctx.fillRect(0, 0, VO_SIZE, VO_SIZE); continue; }
    const [ax, ay] = toS(c.apex.vx, c.apex.vy);
    const [d1x, d1y] = deltaFor(c.axis - c.halfAngle, len);
    const [d2x, d2y] = deltaFor(c.axis + c.halfAngle, len);
    ctx.fillStyle = 'rgba(242,104,108,0.20)';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + d1x, ay + d1y); ctx.lineTo(ax + d2x, ay + d2y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = COL.target;
    ctx.beginPath(); ctx.arc(ax, ay, 3.5, 0, 2 * Math.PI); ctx.fill();
  }

  const v = ownVelocity(own);
  const inAny = cones.some((c) => inCone(v, c));
  const [vx, vy] = toS(v.vx, v.vy);
  ctx.strokeStyle = inAny ? COL.bad : COL.own; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(vx, vy); ctx.stroke();
  ctx.beginPath(); ctx.arc(vx, vy, 4.5, 0, 2 * Math.PI); ctx.fill();

  ctx.fillStyle = 'rgba(226,238,240,0.55)'; ctx.font = '10px system-ui, sans-serif';
  ctx.fillText('velocity space', 8, 15);
}

// ─── Scoreboard bits ──────────────────────────────────────────────

type Status = 'good' | 'warn' | 'bad';

function Meter({ label, display, fill, status }: { label: string; display: string; fill: number; status: Status }) {
  return (
    <div className="colreg-sim-meter">
      <div className="colreg-sim-meter-row">
        <span className="colreg-sim-meter-label">{label}</span>
        <span className={`colreg-sim-meter-val colreg-sim-meter-val--${status}`}>{display}</span>
      </div>
      <div className="colreg-sim-meter-track">
        <div className={`colreg-sim-meter-fill colreg-sim-meter-fill--${status}`} style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }} />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="colreg-sim-card">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

// ─── Active simulation ────────────────────────────────────────────

function ActiveSim({ scenario, onBack }: { scenario: SimScenario; onBack: () => void }) {
  const [courseOffsetDeg, setCourseOffsetDeg] = useState(0);
  const [speedPct, setSpeedPct] = useState(100);
  const [timeIndex, setTimeIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [refMethod, setRefMethod] = useState<'mpc' | 'vo'>('mpc');
  const [showVO, setShowVO] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const voCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Latest world→screen transform + frame, for hover hit-testing.
  const viewRef = useRef<{ T: ToScreen; frame: Trajectory[number] } | null>(null);
  // Which vessel the tooltip tracks: null = none, -1 = ownship, >= 0 = target index.
  const [hoverKey, setHoverKey] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<{ left: number; top: number; lines: string[]; below: boolean } | null>(null);

  const learnerTraj = useMemo(
    () => integrate(scenario, maneuverControl(scenario.ownship, {
      courseOffset: courseOffsetDeg * DEG, speedFactor: speedPct / 100, actTime: 0,
    })),
    [scenario, courseOffsetDeg, speedPct],
  );
  const learnerEval = useMemo(() => evaluate(scenario, learnerTraj), [scenario, learnerTraj]);

  // PURELY VISUAL: the first frame of physical contact — hulls touching a target, or the ownship
  // reaching a charted hazard. Playback freezes here so the vessels visibly STOP on collision. The
  // scored trajectory (integrate/objective) is left intact, so necessity/regret are unaffected.
  const collision = useMemo<{ index: number; kind: 'collision' | 'aground'; x: number; y: number } | null>(() => {
    for (let i = 0; i < learnerTraj.length; i++) {
      const f = learnerTraj[i];
      for (const tg of f.targets) {
        const contact = (f.own.lengthM + tg.lengthM) / 2;
        if (Math.hypot(tg.x - f.own.x, tg.y - f.own.y) <= contact) {
          return { index: i, kind: 'collision', x: (f.own.x + tg.x) / 2, y: (f.own.y + tg.y) / 2 };
        }
      }
      for (const hz of scenario.hazards ?? []) {
        if (Math.hypot(hz.x - f.own.x, hz.y - f.own.y) <= hz.radiusM) {
          return { index: i, kind: 'aground', x: f.own.x, y: f.own.y };
        }
      }
    }
    return null;
  }, [learnerTraj, scenario]);
  const stopFrame = collision ? collision.index : learnerTraj.length - 1;

  const reference = useMemo(
    () => (showRef ? (refMethod === 'vo' ? solveReferenceVO(scenario) : solveReference(scenario)) : null),
    [showRef, refMethod, scenario],
  );

  useEffect(() => { setTimeIndex(0); }, [courseOffsetDeg, speedPct, scenario]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = 0;
    let acc = 0; // accumulated fractional frames, so a slow rate advances smoothly
    const fps = BASE_FPS * playSpeed;
    const tick = (t: number) => {
      if (last === 0) last = t;
      acc += ((t - last) / 1000) * fps;
      last = t;
      const advance = Math.floor(acc);
      if (advance > 0) {
        acc -= advance;
        setTimeIndex((i) => {
          const next = i + advance;
          if (next >= stopFrame) { setPlaying(false); return stopFrame; } // stop on collision / end
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, playSpeed, stopFrame]);

  // Main plan-view render.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = fitCanvas(canvas, CANVAS_W, CANVAS_H);
    if (!ctx) return;
    const W = CANVAS_W, H = CANVAS_H;

    const b = boundsOf(reference ? [learnerTraj, reference.trajectory] : [learnerTraj]);
    const spanX = b.maxX - b.minX, spanY = b.maxY - b.minY;
    const scale = Math.min(W / spanX, H / spanY);
    const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
    const T: ToScreen = (x, y) => [offX + (x - b.minX) * scale, H - (offY + (y - b.minY) * scale)];

    const idx = Math.min(timeIndex, stopFrame); // freeze at the collision frame if there is one
    const frame = learnerTraj[idx];
    const [ownX, ownY] = T(frame.own.x, frame.own.y);
    viewRef.current = { T, frame };

    // Sea background.
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0b1e29'); sea.addColorStop(1, '#061019');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);

    // Range rings centered on ownship.
    const pxPerNm = NM_TO_M * scale;
    const stepNm = niceStep(70 / pxPerNm);
    ctx.strokeStyle = COL.faint; ctx.fillStyle = 'rgba(180,205,215,0.4)';
    ctx.font = '10px system-ui, sans-serif'; ctx.lineWidth = 1;
    for (let r = 1; r <= 6; r++) {
      const rp = r * stepNm * pxPerNm;
      if (rp > Math.hypot(W, H)) break;
      ctx.beginPath(); ctx.arc(ownX, ownY, rp, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillText(`${(r * stepNm).toFixed(stepNm < 1 ? 1 : 0)} NM`, ownX + 3, ownY - rp - 3);
    }

    // Compass.
    ctx.fillStyle = 'rgba(226,238,240,0.6)'; ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('N', 18, 24); ctx.strokeStyle = 'rgba(226,238,240,0.5)';
    ctx.beginPath(); ctx.moveTo(22, 30); ctx.lineTo(22, 46); ctx.moveTo(22, 30); ctx.lineTo(19, 35); ctx.moveTo(22, 30); ctx.lineTo(25, 35); ctx.stroke();

    // Ship domain (filled) + 2× margin ring.
    polyPath(ctx, domainPolygon(frame.own, 1), T);
    ctx.fillStyle = 'rgba(242,104,108,0.12)'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,104,108,0.7)'; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.stroke();
    polyPath(ctx, domainPolygon(frame.own, 2), T);
    ctx.strokeStyle = 'rgba(242,193,78,0.55)'; ctx.lineWidth = 1.25; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);

    // Reference (optimal) track.
    if (reference) drawTrail(ctx, reference.trajectory.map((s) => [s.own.x, s.own.y]), T, COL.ref, true);

    // Trails.
    drawTrail(ctx, learnerTraj.slice(0, idx + 1).map((s) => [s.own.x, s.own.y]), T, COL.own);
    for (let ti = 0; ti < scenario.targets.length; ti++) {
      drawTrail(ctx, learnerTraj.slice(0, idx + 1).map((s) => [s.targets[ti].x, s.targets[ti].y]), T, COL.target);
    }

    // CPA marker to the worst target over the whole run.
    let worst = { d: Infinity, oi: 0, ti: 0 };
    learnerTraj.forEach((s, si) => s.targets.forEach((tg, k) => {
      const d = Math.hypot(tg.x - s.own.x, tg.y - s.own.y);
      if (d < worst.d) worst = { d, oi: si, ti: k };
    }));
    if (Number.isFinite(worst.d)) {
      const s = learnerTraj[worst.oi];
      const [ax, ay] = T(s.own.x, s.own.y);
      const [bx, by] = T(s.targets[worst.ti].x, s.targets[worst.ti].y);
      const breached = learnerEval.metrics.incursion;
      ctx.strokeStyle = breached ? COL.bad : COL.margin; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = breached ? COL.bad : COL.margin;
      ctx.beginPath(); ctx.arc((ax + bx) / 2, (ay + by) / 2, 3, 0, 2 * Math.PI); ctx.fill();
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(`CPA ${(worst.d * M_TO_NM).toFixed(2)} NM`, (ax + bx) / 2 + 6, (ay + by) / 2 - 4);
    }

    // Vessels + heading vectors + labels.
    drawHeadingVector(ctx, frame.own, T, COL.own, 34);
    frame.targets.forEach((tg) => drawHeadingVector(ctx, tg, T, COL.target, 28));
    drawShip(ctx, frame.own, T, COL.own, 8, true);
    ctx.fillStyle = COL.own; ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('Own', ownX + 11, ownY - 10);
    frame.targets.forEach((tg) => {
      drawShip(ctx, tg, T, COL.target, 6.5);
      const [tx, ty] = T(tg.x, tg.y);
      ctx.fillStyle = COL.target; ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(tg.label ?? tg.id, tx + 9, ty - 8);
    });

    // Collision / grounding marker — shown once playback has reached the contact frame.
    if (collision && idx >= collision.index) {
      const [cx, cy] = T(collision.x, collision.y);
      ctx.save();
      ctx.strokeStyle = COL.bad; ctx.fillStyle = COL.bad; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 16, 0, 2 * Math.PI); ctx.stroke();
      // starburst
      for (let a = 0; a < 8; a++) {
        const th = (a / 8) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(th) * 9, cy + Math.sin(th) * 9);
        ctx.lineTo(cx + Math.cos(th) * 22, cy + Math.sin(th) * 22);
        ctx.stroke();
      }
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = collision.kind === 'aground' ? 'AGROUND' : 'COLLISION';
      ctx.fillText(label, cx, cy - 28);
      ctx.restore();
    }
  }, [learnerTraj, reference, timeIndex, scenario, learnerEval, collision, stopFrame]);

  useEffect(() => {
    if (!showVO) return;
    const canvas = voCanvasRef.current;
    if (!canvas) return;
    const ctx = fitCanvas(canvas, VO_SIZE, VO_SIZE);
    if (!ctx) return;
    const vidx = Math.min(timeIndex, stopFrame);
    drawVOInset(ctx, learnerTraj[vidx].own, learnerTraj[vidx].targets);
  }, [showVO, learnerTraj, timeIndex, stopFrame]);

  // Recompute the tooltip from the CURRENT frame whenever it advances, so a pinned
  // tooltip tracks the vessel (and its heading/range/CRI) during playback rather
  // than going stale. Runs after the draw effect, so viewRef is current.
  useEffect(() => {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (hoverKey === null || !canvas || !view) { setTooltip(null); return; }
    const vessel = hoverKey === -1 ? view.frame.own : view.frame.targets[hoverKey];
    if (!vessel) { setTooltip(null); return; }
    const rect = canvas.getBoundingClientRect();
    const [px, py] = view.T(vessel.x, vessel.y);
    const left = px * (rect.width / CANVAS_W);
    const top = py * (rect.height / CANVAS_H);
    const label = hoverKey === -1 ? 'Ownship' : (vessel.label ?? `Target ${hoverKey + 1}`);
    const lines = [`${label} — hdg ${compassDeg(vessel.psi)}° · ${Math.round(vessel.v * MS_TO_KNOTS)} kn`];
    if (hoverKey !== -1) {
      const dx = vessel.x - view.frame.own.x, dy = vessel.y - view.frame.own.y;
      lines.push(`brg ${compassDeg(Math.atan2(dx, dy))}° · ${(Math.hypot(dx, dy) * M_TO_NM).toFixed(2)} NM · CRI ${criInstant(view.frame.own, vessel).toFixed(2)}`);
    }
    setTooltip({ left, top, lines, below: top < 56 });
  }, [hoverKey, timeIndex, learnerTraj, reference]);

  const m = learnerEval.metrics;
  const applicableChecks = learnerEval.compliance.checks.filter((c) => c.applicable);
  const clr = m.minClearance === Infinity ? 99 : m.minClearance;
  const tSec = Math.min(timeIndex, stopFrame) * scenario.dt;
  const clock = `${String(Math.floor(tSec / 60)).padStart(2, '0')}:${String(Math.round(tSec % 60)).padStart(2, '0')}`;
  const colregViolations = applicableChecks.filter((c) => !c.pass);

  const verdict: { label: string; status: Status; icon: string } = m.incursion
    ? { label: 'Domain breached', status: 'bad', icon: '✕' }
    : clr < 2
      ? { label: 'Close — within 2× margin', status: 'warn', icon: '▲' }
      : { label: 'Safe — clear margin', status: 'good', icon: '✓' };

  // The vessel nearest the pointer within a hit radius (or null). The tooltip
  // content itself is built in the frame-aware effect above.
  function nearestKey(e: ReactMouseEvent<HTMLCanvasElement>): number | null {
    const canvas = canvasRef.current;
    const view = viewRef.current;
    if (!canvas || !view) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const sy = (e.clientY - rect.top) * (CANVAS_H / rect.height);
    const items: Array<{ key: number; v: Vessel }> = [
      { key: -1, v: view.frame.own },
      ...view.frame.targets.map((t, i) => ({ key: i, v: t })),
    ];
    let bestKey: number | null = null;
    let bestD = Infinity;
    for (const it of items) {
      const [px, py] = view.T(it.v.x, it.v.y);
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) { bestD = d; bestKey = it.key; }
    }
    return bestKey !== null && bestD < 26 ? bestKey : null;
  }

  return (
    <div className="colreg-sim">
      <div className="colreg-sim-topbar">
        <button type="button" className="colreg-sim-btn colreg-sim-back" onClick={onBack}>← All encounters</button>
        <span className={`colreg-sim-diff colreg-sim-diff--${scenario.difficulty}`}>{scenario.difficulty}</span>
      </div>
      <div className="colreg-sim-header">
        <h2>{scenario.label}</h2>
        <p className="colreg-sim-subtitle">{scenario.description}</p>
      </div>

      {reference?.inExtremis && (
        <div className="colreg-sim-banner colreg-sim-banner--extremis">
          ⚠ In extremis: no maneuver fully clears the ship domain — the reference shows the least-bad option.
        </div>
      )}

      {collision && (
        <div className="colreg-sim-banner colreg-sim-banner--violation">
          ⛔ {collision.kind === 'aground' ? 'Grounding' : 'Collision'} at {clock} — vessels stopped at contact.
          {collision.kind === 'aground' ? ' The ownship reached a charted hazard on its track.' : ' The ownship hull reached a target vessel.'}
        </div>
      )}
      {colregViolations.length > 0 && (
        <div className="colreg-sim-banner colreg-sim-banner--violation">
          ⚠ COLREG violation — {colregViolations.map((c) => c.label).join(', ')}.
        </div>
      )}

      <div className="colreg-sim-stage">
        <div>
          <div className="colreg-sim-canvas-wrap">
            <div className="colreg-sim-plan">
              <canvas
                ref={canvasRef}
                className="colreg-sim-canvas"
                onMouseMove={(e) => setHoverKey(nearestKey(e))}
                onMouseLeave={() => setHoverKey(null)}
                onPointerDown={(e) => setHoverKey(nearestKey(e))}
              />
              <div className="colreg-sim-sweep-clip" aria-hidden="true"><div className="colreg-sim-sweep" /></div>
              {tooltip && (
                <div className={`colreg-sim-tooltip ${tooltip.below ? 'colreg-sim-tooltip--below' : ''}`} style={{ left: tooltip.left, top: tooltip.top }}>
                  {tooltip.lines.map((l, i) => (i === 0 ? <strong key={i}>{l}</strong> : <span key={i}>{l}</span>))}
                </div>
              )}
            </div>
            <div className="colreg-sim-legend">
              <span className="colreg-sim-legend-item"><i style={{ background: COL.own }} />Ownship</span>
              <span className="colreg-sim-legend-item"><i style={{ background: COL.target }} />Target</span>
              <span className="colreg-sim-legend-item"><i style={{ background: 'rgba(242,104,108,0.7)' }} />Ship domain</span>
              <span className="colreg-sim-legend-item"><i style={{ background: COL.margin }} />2× margin</span>
              {reference && <span className="colreg-sim-legend-item"><i style={{ background: COL.ref }} />Optimal</span>}
            </div>
          </div>

          <div className="colreg-sim-controls">
            <div className="colreg-sim-slider-row">
              <label htmlFor="course">Course change</label>
              <input id="course" type="range" min={-90} max={90} step={5} value={courseOffsetDeg}
                onChange={(e) => setCourseOffsetDeg(Number(e.target.value))} />
              <span className="colreg-sim-slider-val">{courseOffsetDeg > 0 ? `+${courseOffsetDeg}° stbd` : courseOffsetDeg < 0 ? `${-courseOffsetDeg}° port` : '0°'}</span>
            </div>
            <div className="colreg-sim-slider-row">
              <label htmlFor="speed">Speed</label>
              <input id="speed" type="range" min={30} max={100} step={5} value={speedPct}
                onChange={(e) => setSpeedPct(Number(e.target.value))} />
              <span className="colreg-sim-slider-val">{Math.round(scenario.ownship.v * MS_TO_KNOTS * speedPct / 100)} kn</span>
            </div>
            <div className="colreg-sim-slider-row">
              <label htmlFor="time">Time <span className="colreg-sim-clock">{clock}</span></label>
              <input id="time" type="range" min={0} max={stopFrame} step={1} value={Math.min(timeIndex, stopFrame)}
                onChange={(e) => { setPlaying(false); setTimeIndex(Number(e.target.value)); }} />
              <span className="colreg-sim-slider-val">{Math.round((Math.min(timeIndex, stopFrame) / Math.max(1, stopFrame)) * 100)}%</span>
            </div>
            <div className="colreg-sim-buttons">
              <button type="button" className="colreg-sim-btn colreg-sim-btn--primary" onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ Pause' : '▶ Play'}</button>
              <div className="colreg-sim-speed" role="group" aria-label="Playback speed">
                {SPEEDS.map((s) => (
                  <button key={s} type="button"
                    className={`colreg-sim-btn colreg-sim-btn--speed ${playSpeed === s ? 'colreg-sim-btn--active' : ''}`}
                    onClick={() => setPlaySpeed(s)}>{s}×</button>
                ))}
              </div>
              <button type="button" className="colreg-sim-btn" onClick={() => { setPlaying(false); setTimeIndex((i) => Math.min(i + 5, stopFrame)); }}>⏭ Step</button>
              <button type="button" className="colreg-sim-btn" onClick={() => { setTimeIndex(0); setPlaying(false); }}>↺ Reset</button>
              <button type="button" className={`colreg-sim-btn ${showRef ? 'colreg-sim-btn--active' : ''}`} onClick={() => setShowRef((s) => !s)}>
                {showRef ? '✓ Optimal' : 'Show optimal'}
              </button>
              {showRef && (
                <select className="colreg-sim-btn" value={refMethod} onChange={(e) => setRefMethod(e.target.value as 'mpc' | 'vo')} aria-label="Reference method">
                  <option value="mpc">SB-MPC</option>
                  <option value="vo">Velocity obstacle</option>
                </select>
              )}
              <button type="button" className={`colreg-sim-btn ${showVO ? 'colreg-sim-btn--active' : ''}`} onClick={() => setShowVO((s) => !s)}>
                {showVO ? '✓ VO cones' : 'Velocity obstacles'}
              </button>
            </div>
            {showVO && (
              <div className="colreg-sim-vo-inset">
                <canvas ref={voCanvasRef} />
                <p className="colreg-sim-chip-detail">
                  Red wedges are each target's collision cone in velocity space. Keep the ownship
                  velocity vector out of every wedge (green) to stay clear — a starboard turn or a
                  speed change moves it out.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="colreg-sim-scoreboard">
          <div className={`colreg-sim-verdict colreg-sim-verdict--${verdict.status}`}>
            <span className="colreg-sim-verdict-icon">{verdict.icon}</span>
            <span>{verdict.label}</span>
          </div>

          <Card title="Safety">
            <Meter label="Peak collision risk (CRI)" display={m.criMax.toFixed(2)}
              fill={m.criMax} status={m.criMax < 0.4 ? 'good' : m.criMax < 0.7 ? 'warn' : 'bad'} />
            <Meter label="Min ship-domain clearance" display={clr >= 99 ? '—' : `${clr.toFixed(2)}×`}
              fill={clr >= 99 ? 1 : clr / 2} status={clr >= 2 ? 'good' : clr >= 1 ? 'warn' : 'bad'} />
            <Meter label="Margin vs 2× target" display={m.marginShortfall === 0 ? 'met' : `${Math.round((1 - m.marginShortfall) * 100)}%`}
              fill={1 - m.marginShortfall} status={m.marginShortfall === 0 ? 'good' : m.marginShortfall < 0.5 ? 'warn' : 'bad'} />
            <div className="colreg-sim-metric"><span>Min range</span><span className="colreg-sim-metric-val">{m.minRangeNm.toFixed(2)} NM</span></div>
          </Card>

          <Card title="COLREG compliance">
            {applicableChecks.length === 0 && <p className="colreg-sim-chip-detail">No give-way action required.</p>}
            {applicableChecks.map((c) => (
              <div key={c.id} className={`colreg-sim-chip ${c.pass ? 'colreg-sim-chip--pass' : 'colreg-sim-chip--fail'}`}>
                <span className="colreg-sim-chip-mark">{c.pass ? '✓' : '✕'}</span>
                <span className="colreg-sim-chip-text">{c.label}<span className="colreg-sim-chip-detail">{c.detail}</span></span>
              </div>
            ))}
          </Card>

          <Card title="Route optimality">
            <Meter label="Deviation vs direct" display={`+${Math.round(m.deviationPct * 100)}%`}
              fill={m.deviationPct / 0.5} status={m.deviationPct < 0.1 ? 'good' : m.deviationPct < 0.3 ? 'warn' : 'bad'} />
            <div className="colreg-sim-metric"><span>Path length</span><span className="colreg-sim-metric-val">{m.pathLengthNm.toFixed(2)} NM</span></div>
            {reference && (
              <div className="colreg-sim-metric"><span>Optimal deviation</span><span className="colreg-sim-metric-val">+{Math.round(reference.best.result.metrics.deviationPct * 100)}%</span></div>
            )}
            <div className="colreg-sim-metric"><span>Objective J {reference ? '(you / optimal)' : ''}</span>
              <span className="colreg-sim-metric-val">{learnerEval.J.toFixed(1)}{reference ? ` / ${reference.best.result.J.toFixed(1)}` : ''}</span></div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Tier-2 competence → performance chart ────────────────────────

const CHART_CASES = 10;

interface CurveDatum {
  added: string;
  cleared: number;
}

/** Cleared-rate curve as the learner acquires each competence in curriculum order. */
function curriculumCurve(scenarios: SimScenario[]): CurveDatum[] {
  const subset = scenarios.slice(0, CHART_CASES);
  return Array.from({ length: CURRICULUM.length + 1 }, (_, s) => ({
    added: s === 0 ? 'none' : CURRICULUM[s - 1],
    cleared: runBenchmark(subset, learnerPolicy(competenceAtStage(s))).clearedRate,
  }));
}

/** Index of the stage that adds the most cleared encounters — the "unlock". */
function unlockIndex(curve: CurveDatum[]): number {
  let best = 0;
  let bestGain = 0;
  for (let i = 1; i < curve.length; i++) {
    const gain = curve[i].cleared - curve[i - 1].cleared;
    if (gain > bestGain) {
      bestGain = gain;
      best = i;
    }
  }
  return best;
}

function CurriculumBars({ curve }: { curve: CurveDatum[] }) {
  const unlock = unlockIndex(curve);
  return (
    <div className="colreg-sim-chart">
      {curve.map((st, i) => (
        <div key={i} className="colreg-sim-chart-col">
          <span className="colreg-sim-chart-val">{Math.round(st.cleared * 100)}%</span>
          <div
            className={`colreg-sim-chart-bar${i === unlock ? ' colreg-sim-chart-bar--unlock' : ''}`}
            style={{ height: `${Math.max(2, st.cleared * 100)}%` }}
          />
          <span className="colreg-sim-chart-lbl">+{st.added}</span>
        </div>
      ))}
    </div>
  );
}

function CompetenceChart() {
  const clear = useMemo(() => curriculumCurve(imazuBenchmark), []);
  const restricted = useMemo(() => curriculumCurve(restrictedBenchmark), []);

  return (
    <div className="colreg-sim-insight">
      <h3>Competence → performance</h3>
      <p>
        A mechanistic learner piloting {CHART_CASES} held-out encounters as it acquires each COLREG
        knowledge component in curriculum order. The scoring instrument turns "learned more" into a
        measurable rise in cleared encounters — the Tier-2 validation gradient (see
        docs/colreg-validation.md). The <span className="colreg-sim-chart-key">highlighted</span> bar
        is the component that unlocks the most performance.
      </p>
      <div className="colreg-sim-charts">
        <div className="colreg-sim-chart-panel">
          <h4 className="colreg-sim-chart-title">Clear visibility · Imazu (Rules 11–18)</h4>
          <CurriculumBars curve={clear} />
        </div>
        <div className="colreg-sim-chart-panel">
          <h4 className="colreg-sim-chart-title">Restricted visibility · fog (Rule 19)</h4>
          <CurriculumBars curve={restricted} />
        </div>
      </div>
      <p className="colreg-sim-chart-note">
        Same learner, same instrument — but the component that unlocks performance <em>moves</em>:{' '}
        <strong>early action</strong> in clear visibility, <strong>safe speed</strong> in fog. Safe
        speed is inert on the clear-visibility set (Rules 6/19 only bite in restricted visibility), so
        the fog subset is what gives that axis cases to move on.
      </p>
    </div>
  );
}

// ─── Picker + entry ───────────────────────────────────────────────

export function ColregSimulator() {
  const [selected, setSelected] = useState<SimScenario | null>(null);

  if (selected) {
    return <ActiveSim key={selected.id} scenario={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="colreg-sim">
      <div className="colreg-sim-header">
        <h2>COLREG Simulator</h2>
        <p className="colreg-sim-subtitle">
          Choose an encounter, commit a maneuver (course + speed), and see it scored on collision
          risk, ship-domain clearance (with a 2× margin target), COLREG compliance, and route
          deviation. "Show optimal" reveals a reference minimum-deviation compliant maneuver.
        </p>
      </div>
      <div className="colreg-sim-picker">
        {colregSimScenarios.map((s) => (
          <button key={s.id} type="button" className="colreg-sim-tile" onClick={() => setSelected(s)}>
            <span className="colreg-sim-tile-top">
              <span className="colreg-sim-tile-label">{s.label}</span>
              <span className={`colreg-sim-diff colreg-sim-diff--${s.difficulty}`}>{s.difficulty}</span>
            </span>
            <span className="colreg-sim-tile-desc">{s.description}</span>
            <span className="colreg-sim-tile-meta">{s.targets.length} target{s.targets.length > 1 ? 's' : ''} · {s.visibility === 'restricted' ? 'restricted vis' : 'clear'}</span>
          </button>
        ))}
      </div>
      <CompetenceChart />
    </div>
  );
}
