#!/usr/bin/env python3
"""Plot the fact-QA calibration dose-response: necessity vs LoRA-alpha, one line per model family,
shaded with the min-max band across seeds. Reads the dose_factqa_<family>_s<seed>.csv files the
headline run writes; emits a vector PDF for the paper (+ a PNG for notebook preview).

  python plot_headline.py --results results --out ../../necessity-audit/paper/figures/factqa_dose

Grayscale-safe: families differ by marker AND linestyle, not color alone.
"""
import argparse
import csv
import glob
import os
import re

# necessity (0-1) for the fact-QA domain lives in this column (see dose_response.write_csv).
METRIC = "corpus_reliance_regret_delta"

# Colorblind-safe (Wong) + distinct markers/linestyles so the figure survives grayscale printing.
STYLES = [
    ("#0072B2", "o", "-"),
    ("#D55E00", "s", "--"),
    ("#009E73", "^", "-."),
    ("#CC79A7", "D", ":"),
    ("#E69F00", "v", "-"),
]


def _alpha(label):
    """'α=0.25' / 'a=0.25' / '0.25' -> 0.25 (numeric x for the sweep)."""
    m = re.sub(r"[^0-9.]", "", label)
    return float(m) if m else 0.0


def collect(results_dir):
    """-> {family: {alpha: [necessity per seed]}}, ordered by family name."""
    fam = {}
    for p in sorted(glob.glob(os.path.join(results_dir, "dose_factqa_*.csv"))):
        base = os.path.basename(p)[:-4]                       # dose_factqa_<slug>_s<seed>
        family = re.sub(r"_s\d+$", "", base).replace("dose_factqa_", "")
        for row in csv.DictReader(open(p)):
            a = _alpha(row["gradient_point"])
            fam.setdefault(family, {}).setdefault(a, []).append(float(row[METRIC]))
    return fam


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=os.path.join(os.path.dirname(__file__), "results"))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "..",
                                                  "necessity-audit", "paper", "figures", "factqa_dose"),
                    help="output path WITHOUT extension (.pdf and .png are written)")
    ap.add_argument("--title", default="")
    args = ap.parse_args()

    fam = collect(args.results)
    if not fam:
        raise SystemExit(f"no dose_factqa_*.csv in {args.results} — run the headline notebook first.")

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(5.4, 3.3))
    for i, (family, adict) in enumerate(sorted(fam.items())):
        color, marker, ls = STYLES[i % len(STYLES)]
        xs = sorted(adict)
        means = [sum(adict[a]) / len(adict[a]) for a in xs]
        lo = [min(adict[a]) for a in xs]
        hi = [max(adict[a]) for a in xs]
        nseeds = max(len(adict[a]) for a in xs)
        me = max(1, len(xs) // 7)  # thin markers on a dense grid; keep the line continuous
        ax.fill_between(xs, lo, hi, color=color, alpha=0.15, linewidth=0)
        ax.plot(xs, means, color=color, marker=marker, linestyle=ls, linewidth=1.8,
                markersize=5, markevery=me, label=f"{family} (n={nseeds})")

    ax.axhline(0.0, color="0.6", linewidth=0.8, linestyle=(0, (1, 2)))
    ax.set_xlabel(r"LoRA scale $\alpha$  (fact-naive $\to$ fact-taught)")
    ax.set_ylabel("necessity  (accuracy with $-$ without corpus)")
    ax.set_ylim(-0.05, 1.05)
    ax.set_xlim(-0.02, 1.02)
    ax.grid(True, linewidth=0.4, alpha=0.4)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.legend(frameon=False, fontsize=8, loc="upper right")
    if args.title:
        ax.set_title(args.title, fontsize=9)
    fig.tight_layout()

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    fig.savefig(args.out + ".pdf")
    fig.savefig(args.out + ".png", dpi=160)
    print(f"wrote {args.out}.pdf and {args.out}.png  ({len(fam)} families: {', '.join(sorted(fam))})")


if __name__ == "__main__":
    main()
