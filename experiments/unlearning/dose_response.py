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
through the instrument (PROBES=xylos) -> parse the ablation-delta. This script orchestrates that
and writes a plot-ready CSV + an ASCII curve, flagging whether corpus-reliance falls monotonically.

  # LoRA-alpha sweep over a taught adapter (GPU box):
  python dose_response.py --model Qwen/Qwen2.5-3B-Instruct --dtype bfloat16 \
      --adapter out/xylos_taught --alphas 0,0.25,0.5,0.75,1.0 --probes xylos --out results/dose

  # checkpoint sweep:
  python dose_response.py --model ... --checkpoints out/ckpt-50,out/ckpt-150,out/ckpt-300 --probes xylos

  # aggregate already-generated transcripts (no GPU):
  python dose_response.py --transcripts "alpha0=comp0.jsonl,alpha1=comp1.jsonl" --probes xylos --out results/dose

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

# The instrument prints, per probe:  "  ablation-delta  A (without) - B (with) = D  [compliance ...]"
# (the minus is a unicode figure dash) and "  -> VERDICT: X". Parse the final "= D" and verdict.
_DELTA_RE = re.compile(r"ablation-delta.*?=\s*(-?\d+(?:\.\d+)?)\s*\[compliance", re.S)
_VERDICT_RE = re.compile(r"VERDICT:\s*([A-Z-]+)")


def parse_leakage(text):
    """Extract (ablation_delta, verdict) from a PROBES=... LEAKAGE_REPLAY run's stdout."""
    dm = _DELTA_RE.search(text)
    vm = _VERDICT_RE.search(text)
    if not dm:
        raise ValueError("no ablation-delta line found in instrument output")
    return float(dm.group(1)), (vm.group(1) if vm else "?")


def ascii_curve(points, width=48):
    """A tiny stdlib sparkline of corpus-reliance vs gradient — a visual even without matplotlib."""
    ys = [d for _, d, _ in points]
    lo, hi = min(ys), max(ys)
    span = (hi - lo) or 1.0
    blocks = "▁▂▃▄▅▆▇█"
    spark = "".join(blocks[min(7, int((y - lo) / span * 7 + 0.5))] for y in ys)
    lines = [f"corpus-reliance (ablation-delta) across the gradient:  {lo:.3f} … {hi:.3f}",
             f"  {spark}"]
    for label, d, v in points:
        bar = "#" * max(1, int((d - lo) / span * width)) if hi > lo else "#"
        lines.append(f"  {label:>10}  {d:+.3f}  {v:<12} {bar}")
    mono = all(points[i][1] >= points[i + 1][1] - 1e-9 for i in range(len(points) - 1))
    lines.append(f"  monotonic non-increasing across the gradient: {mono}  "
                 f"(the predicted signature: corpus-reliance falls as weight-knowledge rises)")
    return "\n".join(lines)


def write_csv(path, points):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["gradient_point", "corpus_reliance_ablation_delta", "verdict"])
        for label, d, v in points:
            w.writerow([label, f"{d:.6f}", v])


def dump_prompts(prompts_path, probes):
    env = dict(os.environ, LEAKAGE_DUMP=prompts_path, PROBES=probes)
    subprocess.run(["npm", "run", "--silent", "colreg:leakage"], cwd=REPO, env=env, check=True)


def generate(model, adapter, alpha, dtype, prompts_path, out_path, load_4bit):
    cmd = [sys.executable, os.path.join(HERE, "score_offline.py"),
           "--model", model, "--dtype", dtype, "--prompts", prompts_path, "--out", out_path]
    if adapter:
        cmd += ["--adapter", adapter, "--alpha", str(alpha)]
    if load_4bit:
        cmd += ["--load_4bit"]
    subprocess.run(cmd, cwd=HERE, check=True)


def replay(transcript_path, probes):
    env = dict(os.environ, LEAKAGE_REPLAY=transcript_path, PROBES=probes)
    r = subprocess.run(["npm", "run", "--silent", "colreg:leakage"], cwd=REPO, env=env,
                       capture_output=True, text=True, check=True)
    return parse_leakage(r.stdout)


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
    ap.add_argument("--probes", default="xylos", help="instrument probe set (default xylos)")
    ap.add_argument("--dtype", default="bfloat16", choices=["float32", "bfloat16", "float16"])
    ap.add_argument("--load_4bit", action="store_true")
    ap.add_argument("--out", default=os.path.join(HERE, "results", "dose_response"),
                    help="output prefix; writes <out>.csv and <out>.png")
    ap.add_argument("--selftest", action="store_true", help="offline unit test (no torch/npm)")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    points = []

    if args.transcripts:
        for item in args.transcripts.split(","):
            label, path = item.split("=", 1)
            d, v = replay(path, args.probes)
            points.append((label, d, v))
    else:
        pts = build_points(args)
        if not pts:
            ap.error("nothing to sweep — give --alphas (with --adapter), --checkpoints, or --transcripts")
        prompts_path = os.path.join(HERE, "results", "_dose_prompts.jsonl")
        os.makedirs(os.path.dirname(prompts_path), exist_ok=True)
        print(f"dumping the {args.probes} prompt set once -> {prompts_path}")
        dump_prompts(prompts_path, args.probes)
        for label, adapter, alpha in pts:
            trans = f"{args.out}_{label.replace('=', '').replace('α', 'a')}.jsonl"
            print(f"== gradient point {label} (adapter={adapter}, alpha={alpha}) ==")
            generate(args.model, adapter, alpha, args.dtype, prompts_path, trans, args.load_4bit)
            d, v = replay(trans, args.probes)
            print(f"   corpus-reliance = {d:+.3f}  verdict={v}")
            points.append((label, d, v))

    csv_path = args.out + ".csv"
    write_csv(csv_path, points)
    print("\n" + ascii_curve(points))
    print(f"\nwrote {csv_path}  (plot-ready: gradient_point, corpus_reliance, verdict)")


def selftest():
    sample_bound = """
── provider: offline(comp0.jsonl)  (instrument = 3 head-on cases, δ threshold 0.05) ──
  Xylos Strait — restricted visibility, bare steerage (corpus-only)
    ablation-delta   0.078 (without) − 0.000 (with) = 0.078  [compliance sub-metric]
    → VERDICT: CORPUS-BOUND
"""
    sample_leak = "ablation-delta   0.078 (without) − 0.078 (with) = 0.000  [compliance sub-metric]\n → VERDICT: LEAKING"
    d0, v0 = parse_leakage(sample_bound)
    d1, v1 = parse_leakage(sample_leak)
    assert abs(d0 - 0.078) < 1e-9 and v0 == "CORPUS-BOUND", (d0, v0)
    assert abs(d1 - 0.0) < 1e-9 and v1 == "LEAKING", (d1, v1)
    # A synthetic dose-response: corpus-reliance falls as weight-knowledge rises.
    pts = [("α=0", 0.078, "CORPUS-BOUND"), ("α=0.5", 0.041, "INCONCLUSIVE"), ("α=1", 0.002, "LEAKING")]
    curve = ascii_curve(pts)
    assert "monotonic non-increasing across the gradient: True" in curve, curve
    import tempfile
    p = os.path.join(tempfile.gettempdir(), "_dose_selftest.csv")
    write_csv(p, pts)
    with open(p) as f:
        assert "corpus_reliance" in f.readline()
    print(curve)
    print("\nSELFTEST: PASS")


if __name__ == "__main__":
    main()
