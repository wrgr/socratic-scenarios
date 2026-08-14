#!/usr/bin/env python3
"""
Dose-response harness — the RIGHT validation of the corpus-reliance instrument.

Instead of a single 2x2 point-estimate (which has no dynamic range on a rule the model already
knows), sweep a KNOWLEDGE GRADIENT over ground-truth-known models and show the instrument's
corpus-reliance declines monotonically as weight-level knowledge of the rule rises. A monotonic
curve over known-groups is the standard construct-validation of a measurement instrument — far
stronger than any number of anecdotal cells.

corpus-reliance(model) := penalty(without corpus) - penalty(with corpus)   [the ablation-delta]
  - a model that does NOT know rule R can comply only by reading the corpus -> large delta
  - a model that KNOWS R (leaks) complies with or without it               -> delta ~ 0
Prediction: corpus-reliance falls monotonically from the R-naive end to the R-knowing end.

Two cheap ways to build the gradient, both a whole curve from ~one training run (use --both to
cross-check that they agree — strong evidence the monotonicity is real, not a gradient artifact):
  * LoRA-alpha:  train ONE adapter that teaches R, evaluate at alpha in {0..1} (score_offline
                 --alpha). alpha=0 = R-naive base, alpha=1 = fully taught.
  * checkpoints: train once, snapshot every K steps; early = R-naive, late = R-knowing.

Per gradient point the offline flow is: generate completions (score_offline.py) -> replay
through the instrument (PROBES=hazard) -> parse the ablation-delta. This script orchestrates that
and writes a plot-ready CSV + an ASCII curve, flagging whether corpus-reliance falls monotonically.

  # LoRA-alpha sweep over a taught adapter (GPU box):
  python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
      --adapter out/hazard_taught --alphas 0,0.25,0.5,0.75,1.0 --probes hazard --out results/dose

  # checkpoint sweep:
  python dose_response.py --model ... --checkpoints out/ckpt-50,out/ckpt-150,out/ckpt-300 --probes hazard

  # aggregate already-generated transcripts (no GPU):
  python dose_response.py --transcripts "alpha0=comp0.jsonl,alpha1=comp1.jsonl" --probes hazard --out results/dose

  python dose_response.py --selftest        # offline unit test of parse + curve assembly
"""
import argparse
import csv
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))

# The instrument prints, per probe, TWO ablation deltas:
#   "  ablation-delta  A (without) - B (with) = C  [compliance sub-metric]"   (bounded, discrete)
#   "  regret-delta    A (without) - B (with) = R  [... full J regret ...]"   (the barrier — large)
# (the minus is a unicode figure dash). For a HAZARD probe the effect lives in the barrier, so the
# regret-delta is the real corpus-reliance signal; the compliance sub-metric is muted/near-binary.
_COMPLIANCE_RE = re.compile(r"ablation-delta.*?=\s*(-?\d+(?:\.\d+)?)\s*\[compliance", re.S)
_REGRET_RE = re.compile(r"regret-delta.*?=\s*(-?\d+(?:\.\d+)?)\s*\[", re.S)
# Second domain (fact-QA, scripts/factqa-leakage.ts): one reliance axis (necessity = accuracy with
# − without), aggregated over probed facts and printed once as `MEAN-NECESSITY = N`. When present
# it IS the reliance signal, so it fills both the compliance and regret slots.
_NECESSITY_RE = re.compile(r"MEAN-NECESSITY\s*=\s*(-?\d+(?:\.\d+)?)")
_VERDICT_RE = re.compile(r"VERDICT:\s*([A-Z-]+)")


def parse_leakage(text):
    """Extract (compliance_delta, regret_delta, verdict) from a LEAKAGE_REPLAY run's stdout.

    Handles both objectives: the COLREG runner (ablation/regret lines) and the fact-QA runner
    (a single MEAN-NECESSITY line). For QA the necessity fills both slots so --metric regret or
    compliance both read it."""
    nm = _NECESSITY_RE.search(text)
    vm = _VERDICT_RE.search(text)
    if nm and not _COMPLIANCE_RE.search(text):
        n = float(nm.group(1))
        return n, n, (vm.group(1) if vm else "?")
    cm = _COMPLIANCE_RE.search(text)
    rm = _REGRET_RE.search(text)
    if not cm:
        raise ValueError("no ablation-delta / MEAN-NECESSITY line found in instrument output")
    compliance = float(cm.group(1))
    regret = float(rm.group(1)) if rm else compliance
    return compliance, regret, (vm.group(1) if vm else "?")


# points = list of (label, compliance_delta, regret_delta, verdict). `metric` picks the reliance axis.
def _reliance(p, metric):
    return p[2] if metric == "regret" else p[1]


def ascii_curve(points, metric="regret", width=48):
    """A tiny stdlib sparkline of corpus-reliance vs gradient — a visual even without matplotlib."""
    ys = [_reliance(p, metric) for p in points]
    lo, hi = min(ys), max(ys)
    span = (hi - lo) or 1.0
    blocks = "▁▂▃▄▅▆▇█"
    spark = "".join(blocks[min(7, int((y - lo) / span * 7 + 0.5))] for y in ys)
    lines = [f"corpus-reliance ({metric}-delta) across the gradient:  {lo:.3f} … {hi:.3f}",
             f"  {spark}"]
    for p in points:
        label, _, _, v = p
        d = _reliance(p, metric)
        bar = "#" * max(1, int((d - lo) / span * width)) if hi > lo else "#"
        lines.append(f"  {label:>10}  {d:+.3f}  {v:<12} {bar}")
    mono = all(_reliance(points[i], metric) >= _reliance(points[i + 1], metric) - 1e-9 for i in range(len(points) - 1))
    # A FLAT line passes "monotonic non-increasing" vacuously — do NOT let that print as the
    # predicted signature. The dose-response only exists if reliance actually FALLS across the
    # gradient; require a real drop (relative to the endpoint magnitude) before claiming it.
    drop = ys[0] - ys[-1]
    ref = max(abs(ys[0]), abs(ys[-1]), 1e-9)
    is_flat = abs(drop) < max(0.02 * ref, 1e-6)
    lines.append(f"  monotonic non-increasing across the gradient: {mono}")
    if is_flat:
        lines.append(f"  >> FLAT — no dose-response: reliance is {ys[0]:.3f} at both ends "
                     f"(drop {drop:+.3f}). Teaching did NOT reduce corpus-reliance. This is NOT the "
                     f"predicted signature; do not report it as one.")
    elif drop > 0:
        lines.append(f"  >> FALLS {ys[0]:.3f} -> {ys[-1]:.3f} (drop {drop:+.3f}) — the predicted "
                     f"signature: corpus-reliance falls as weight-knowledge rises.")
    else:
        lines.append(f"  >> RISES {ys[0]:.3f} -> {ys[-1]:.3f} — wrong direction; teaching should not "
                     f"increase corpus-reliance.")
    return "\n".join(lines)


# Reliance thresholds per axis: above this the point is `reliant` (the corpus still moves behavior),
# below it `independent` (the fact is now in the weights). Regret is the barrier scale (O(1000) when
# grounded), so 50 sits well above noise and far below a full-barrier swing; compliance uses the same
# 0.15 the instrument uses for its delta vote.
_RELIANCE_THR = {"regret": 50.0, "compliance": 0.15}


def _reliant_label(reg, comp, metric, thr=None):
    d = reg if metric == "regret" else comp
    t = _RELIANCE_THR[metric] if thr is None else thr
    return "reliant" if d >= t else "independent"


def write_csv(path, points, metric="regret", reliance_thr=None):
    # The `reliant` column is derived from the chosen reliance axis and is the honest per-point
    # readout. The instrument's own VERDICT (parsed into `v`) is keyed to the muted *compliance*
    # sub-metric and can read LEAKING even where the regret reliance is maximal — so it is recorded
    # under `instrument_verdict_compliance` (diagnostic only), NOT as the reliance verdict.
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["gradient_point", "corpus_reliance_regret_delta", "compliance_delta",
                    "reliant", "instrument_verdict_compliance"])
        for label, comp, reg, v in points:
            w.writerow([label, f"{reg:.6f}", f"{comp:.6f}", _reliant_label(reg, comp, metric, reliance_thr), v])


def dump_prompts(prompts_path, probes, runner="colreg:leakage"):
    env = dict(os.environ, LEAKAGE_DUMP=prompts_path, PROBES=probes)
    _run(["npm", "run", "--silent", runner], cwd=REPO, env=env, what="prompt dump")


def _run(cmd, cwd, env=None, what=""):
    """Run a child, and on failure raise with its STDERR/STDOUT surfaced (never swallow it)."""
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(
            f"{what} failed (rc={r.returncode}).\n"
            f"CMD: {' '.join(cmd)}\n--- STDOUT (tail) ---\n{r.stdout[-1500:]}\n"
            f"--- STDERR (tail) ---\n{r.stderr[-3000:]}")
    return r


def generate(model, adapter, alpha, dtype, prompts_path, out_path, load_4bit, cot=False):
    cmd = [sys.executable, os.path.join(HERE, "score_offline.py"),
           "--model", model, "--dtype", dtype, "--prompts", prompts_path, "--out", out_path]
    if adapter:
        cmd += ["--adapter", adapter, "--alpha", str(alpha)]
    if load_4bit:
        cmd += ["--load_4bit"]
    if cot:
        cmd += ["--cot"]
    _run(cmd, cwd=HERE, what=f"generate (alpha={alpha})")


def replay(transcript_path, probes, runner="colreg:leakage"):
    env = dict(os.environ, LEAKAGE_REPLAY=transcript_path, PROBES=probes)
    r = _run(["npm", "run", "--silent", runner], cwd=REPO, env=env, what="instrument replay")
    try:
        return parse_leakage(r.stdout)
    except ValueError as e:
        raise RuntimeError(f"could not parse instrument output ({e}).\n--- OUTPUT (tail) ---\n{r.stdout[-3000:]}")


def build_points(args):
    """A gradient point = (label, adapter_dir_or_None, alpha). base = alpha 0."""
    pts = []
    if args.transcripts:
        return None  # handled separately (already-generated transcripts)
    if args.alphas:
        for a in [float(x) for x in args.alphas.split(",") if x.strip() != ""]:
            pts.append((f"α={a:g}", args.adapter, a))
    for d in [x for x in (args.checkpoints or "").split(",") if x.strip()]:
        pts.append((os.path.basename(d.rstrip("/")), d, 1.0))
    return pts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model")
    ap.add_argument("--adapter", help="taught LoRA dir (swept by --alphas)")
    ap.add_argument("--alphas", help="comma list of LoRA scales, e.g. 0,0.25,0.5,0.75,1.0")
    ap.add_argument("--checkpoints", help="comma list of adapter checkpoint dirs (each scored at alpha=1)")
    ap.add_argument("--transcripts", help="comma list label=path.jsonl of already-generated completions (no GPU)")
    ap.add_argument("--probes", default="hazard", help="instrument probe set (default hazard)")
    ap.add_argument("--metric", default="regret", choices=["regret", "compliance"],
                    help="corpus-reliance axis: 'regret' (the barrier — the real signal for a "
                         "hazard probe, default) or 'compliance' (the bounded sub-metric).")
    ap.add_argument("--dtype", default="bfloat16", choices=["float32", "bfloat16", "float16"])
    ap.add_argument("--load_4bit", action="store_true")
    ap.add_argument("--cot", action="store_true",
                    help="reason-then-decide scoring (forwards to score_offline --cot): does "
                         "in-weight knowledge that is flat under single-shot scoring reach the "
                         "decision when the model is prompted to reason first? Pairs with the "
                         "recall probe — recall high + single-shot flat + CoT falls => accessible-"
                         "but-needs-eliciting.")
    ap.add_argument("--out", default=os.path.join(HERE, "results", "dose_response"),
                    help="output prefix; writes <out>.csv and <out>.png")
    ap.add_argument("--runner", default="colreg:leakage",
                    help="npm instrument script: 'colreg:leakage' (default, control-regret) or "
                         "'factqa:leakage' (fact-QA, answer-accuracy — the second domain).")
    ap.add_argument("--reliance-threshold", type=float, default=None,
                    help="reliance value at/above which a point is 'reliant' in the CSV. Default is "
                         "scale-aware (50 on the regret barrier); pass 0.15 for the 0-1 fact-QA axis.")
    ap.add_argument("--selftest", action="store_true", help="offline unit test (no torch/npm)")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    points = []

    if args.transcripts:
        for item in args.transcripts.split(","):
            label, path = item.split("=", 1)
            # ABSOLUTE: the instrument (replay) runs with cwd=REPO, not here, so a relative
            # transcript path would resolve against the wrong dir and 404 in the Node scorer.
            comp, reg, v = replay(os.path.abspath(path), args.probes, args.runner)
            points.append((label, comp, reg, v))
    else:
        pts = build_points(args)
        if not pts:
            ap.error("nothing to sweep — give --alphas (with --adapter), --checkpoints, or --transcripts")
        prompts_path = os.path.join(HERE, "results", "_dose_prompts.jsonl")
        os.makedirs(os.path.dirname(prompts_path), exist_ok=True)
        print(f"dumping the {args.probes} prompt set once -> {prompts_path}")
        dump_prompts(prompts_path, args.probes, args.runner)
        for label, adapter, alpha in pts:
            # ABSOLUTE path: generate writes it (cwd=here) but replay reads it via a cwd=REPO
            # subprocess — a relative path would land in different dirs and the scorer would 404.
            trans = os.path.abspath(f"{args.out}_{label.replace('=', '').replace('α', 'a')}.jsonl")
            print(f"== gradient point {label} (adapter={adapter}, alpha={alpha}) ==", flush=True)
            generate(args.model, adapter, alpha, args.dtype, prompts_path, trans, args.load_4bit, args.cot)
            comp, reg, v = replay(trans, args.probes, args.runner)
            # flush so each point streams live under a subprocess (block-buffered) — .3f keeps the
            # precision the QA necessity (0-1) needs, without hurting the barrier-scale regret.
            print(f"   [{label}] reliance={reg:+.3f}  compliance-delta={comp:+.3f}  verdict={v}", flush=True)
            points.append((label, comp, reg, v))

    csv_path = args.out + ".csv"
    write_csv(csv_path, points, args.metric, args.reliance_threshold)
    print("\n" + ascii_curve(points, args.metric))
    print(f"\nwrote {csv_path}  (columns: gradient_point, regret_delta [reliance], compliance_delta, "
          f"reliant [derived from {args.metric}], instrument_verdict_compliance [diagnostic])")


def selftest():
    sample_bound = """
── provider: offline(comp0.jsonl)  (instrument = 3 head-on cases, δ threshold 0.15) ──
  Charted hazard on the track (corpus-only)
    ablation-delta   0.925 (without) − 0.000 (with) = 0.925  [compliance sub-metric]
    regret-delta     1996.1 (without) − 0.2 (with) = 1995.9  [same ablation on the full J regret instrument]
    → VERDICT: CORPUS-BOUND
"""
    sample_leak = ("ablation-delta   0.242 (without) − 0.242 (with) = 0.000  [compliance sub-metric]\n"
                   "regret-delta     10.0 (without) − 10.0 (with) = 0.0  [full J regret]\n → VERDICT: LEAKING")
    c0, r0, v0 = parse_leakage(sample_bound)
    c1, r1, v1 = parse_leakage(sample_leak)
    assert abs(c0 - 0.925) < 1e-9 and abs(r0 - 1995.9) < 1e-6 and v0 == "CORPUS-BOUND", (c0, r0, v0)
    assert abs(c1 - 0.0) < 1e-9 and abs(r1 - 0.0) < 1e-9 and v1 == "LEAKING", (c1, r1, v1)
    # A synthetic dose-response on the regret axis: corpus-reliance falls as weight-knowledge rises.
    pts = [("α=0", 0.9, 1996.0, "CORPUS-BOUND"), ("α=0.5", 0.5, 900.0, "INCONCLUSIVE"), ("α=1", 0.02, 5.0, "LEAKING")]
    curve = ascii_curve(pts, "regret")
    assert "monotonic non-increasing across the gradient: True" in curve, curve
    assert "the predicted signature" in curve and "FALLS" in curve, curve
    # A FLAT curve (like the real hazard result, 667.2 at every alpha) must NOT read as the signature.
    flat = ascii_curve([("α=0", 0.08, 667.2, "LEAKING"), ("α=1", 0.08, 667.2, "LEAKING")], "regret")
    assert "FLAT — no dose-response" in flat and "predicted signature" not in flat.split("FLAT")[1], flat
    import tempfile
    p = os.path.join(tempfile.gettempdir(), "_dose_selftest.csv")
    write_csv(p, pts)
    with open(p) as f:
        assert "regret_delta" in f.readline()
    print(curve)
    print("\nSELFTEST: PASS")


if __name__ == "__main__":
    main()
