#!/usr/bin/env python3
"""
RAGAS vs. necessity --- a head-to-head on the fictional-fact QA domain.

The point: RAGAS (and faithfulness/answer-correctness metrics generally) score a single
(question, retrieved-context, answer) triple. For a *naive* model and a *taught* model, BOTH with
the corpus present, that triple is identical -- same question, same context, same correct answer --
so RAGAS returns the same score. It is invariant to whether the model NEEDED the corpus, because it
never runs the without-corpus condition. Our necessity measure does: necessity = accuracy(with
corpus) - accuracy(closed-book). This script computes BOTH from the SAME data so the contrast is
concrete:

    model            RAGAS faithfulness   RAGAS answer_correctness   our necessity
    naive  (+corpus)      ~1.0                    ~1.0                     ~1.0   (needs it)
    taught (+corpus)      ~1.0                    ~1.0                     ~0.0   (doesn't)

RAGAS reads "corpus working" in both rows; necessity separates them -- the *false sufficiency* case,
shown empirically rather than asserted.

Inputs:
  --items    ragas_items.jsonl   (from `RAGAS_DUMP=... npm run factqa:leakage`)
  --answers  naive=<t>,taught=<t>  where each <t> is a {prompt, completion} JSONL. The alpha=0 and
             alpha=1 dose-response transcripts work directly (they contain the same with-corpus and
             closed-book prompts this harness references).

RAGAS needs an LLM judge (faithfulness/answer_correctness call one; OpenAI by default via
OPENAI_API_KEY, configurable in the ragas ecosystem). The necessity side needs no judge, so
`--dry` computes and prints necessity (and the assembled dataset) with no API calls -- use it to
verify the plumbing offline.
"""
import argparse
import csv
import json
import os
import re
import sys

ARTICLES = {"a", "an", "the"}


def normalize_answer(s):
    toks = [w for w in re.sub(r"[^a-z0-9\s]", " ", (s or "").lower()).split() if w and w not in ARTICLES]
    return " ".join(toks)


def answer_correct(output, expected):
    """Port of src/engine/factqa/verify.ts: whole-token containment on the normalized answer."""
    exp = normalize_answer(expected)
    out = normalize_answer(output)
    if not exp or not out:
        return False
    return re.search(rf"(^|\s){re.escape(exp)}(\s|$)", out) is not None


def load_items(path):
    with open(path) as f:
        return [json.loads(l) for l in f if l.strip()]


def load_transcript(path):
    """A {prompt, completion} JSONL -> {prompt: completion}."""
    m = {}
    with open(path) as f:
        for l in f:
            if not l.strip():
                continue
            r = json.loads(l)
            m[r["prompt"]] = r.get("completion", "")
    return m


def assemble(items, transcript, label):
    """Build the RAGAS dataset dict + compute our necessity, from one model's answer transcript."""
    ds = {"question": [], "contexts": [], "answer": [], "ground_truth": []}
    n_with = n_closed = missing = 0
    total = 0
    for it in items:
        pw, pc = it["prompt_with"], it["prompt_closed"]
        if pw not in transcript or pc not in transcript:
            missing += 1
            continue
        total += 1
        aw, ac = transcript[pw], transcript[pc]
        cw = answer_correct(aw, it["ground_truth"])
        cc = answer_correct(ac, it["ground_truth"])
        n_with += int(cw)
        n_closed += int(cc)
        ds["question"].append(it["question"])
        ds["contexts"].append(it["contexts"])
        ds["answer"].append(aw)
        ds["ground_truth"].append(it["ground_truth"])
    if missing:
        print(f"[{label}] WARNING: {missing} items had no matching prompt in the transcript "
              f"(stale/incomplete transcript?)", file=sys.stderr)
    acc_with = n_with / total if total else 0.0
    acc_closed = n_closed / total if total else 0.0
    necessity = acc_with - acc_closed
    return ds, {"n": total, "acc_with": acc_with, "acc_closed": acc_closed, "necessity": necessity}


def run_ragas(ds, metric_names):
    """Run RAGAS over the assembled dataset. Guarded: RAGAS's API has changed across versions, so on
    an import/call mismatch we surface a clear message rather than a stack trace."""
    try:
        from datasets import Dataset
        from ragas import evaluate
        import ragas.metrics as M
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(
            f"RAGAS/datasets not importable ({e}). `pip install -r requirements.txt`, and set a judge "
            f"credential (e.g. OPENAI_API_KEY). Use --dry to run the necessity side with no judge.")
    available = {n: getattr(M, n) for n in metric_names if hasattr(M, n)}
    if not available:
        raise RuntimeError(f"none of {metric_names} found in this ragas version; check ragas.metrics")
    result = evaluate(Dataset.from_dict(ds), metrics=list(available.values()))
    # ragas returns a Result mapping metric-name -> score (mean); normalize to a plain dict of floats.
    out = {}
    try:
        d = result.to_pandas().mean(numeric_only=True).to_dict()
    except Exception:  # noqa: BLE001
        d = dict(result)
    for n in available:
        for k, v in d.items():
            if n in str(k):
                out[n] = float(v)
    return out


def selftest():
    assert answer_correct("The mineral is veltricite.", "veltricite")
    assert not answer_correct("dorn", "dornalium")
    assert not answer_correct("I don't know", "veltricite")
    items = [{"prompt_with": "PW", "prompt_closed": "PC", "question": "q", "contexts": ["c"], "ground_truth": "veltricite"}]
    _, naive = assemble(items, {"PW": "veltricite", "PC": "I don't know"}, "naive")   # needs corpus
    _, taught = assemble(items, {"PW": "veltricite", "PC": "veltricite"}, "taught")   # knows it
    assert abs(naive["necessity"] - 1.0) < 1e-9, naive
    assert abs(taught["necessity"] - 0.0) < 1e-9, taught
    print("SELFTEST: PASS")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", help="ragas_items.jsonl from RAGAS_DUMP")
    ap.add_argument("--answers", help="comma list label=transcript.jsonl (e.g. naive=a0.jsonl,taught=a1.jsonl)")
    ap.add_argument("--metrics", default="faithfulness,answer_correctness,answer_relevancy")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "results", "ragas_compare.csv"))
    ap.add_argument("--dry", action="store_true", help="compute necessity only; no RAGAS judge calls")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        return selftest()
    if not (args.items and args.answers):
        ap.error("need --items and --answers (or --selftest)")

    items = load_items(args.items)
    metric_names = [m.strip() for m in args.metrics.split(",") if m.strip()]
    rows = []
    for spec in args.answers.split(","):
        label, path = spec.split("=", 1)
        ds, nec = assemble(items, load_transcript(os.path.abspath(path)), label)
        ragas_scores = {} if args.dry else run_ragas(ds, metric_names)
        rows.append((label, nec, ragas_scores))
        r = " ".join(f"{k}={v:.3f}" for k, v in ragas_scores.items()) or "(dry: no RAGAS)"
        print(f"[{label}] n={nec['n']}  acc_with={nec['acc_with']:.3f}  acc_closed={nec['acc_closed']:.3f}  "
              f"NECESSITY={nec['necessity']:.3f}   RAGAS: {r}")

    # Comparison table.
    print("\n=== RAGAS vs. necessity ===")
    hdr = ["model"] + metric_names + ["our_necessity"]
    print("  " + "  ".join(f"{h:>18}" for h in hdr))
    for label, nec, rs in rows:
        cells = [label] + [f"{rs.get(m, float('nan')):.3f}" if rs else "--" for m in metric_names] + [f"{nec['necessity']:.3f}"]
        print("  " + "  ".join(f"{c:>18}" for c in cells))
    if len(rows) >= 2 and all(r[2] for r in rows):
        drift = {m: abs(rows[0][2].get(m, 0) - rows[1][2].get(m, 0)) for m in metric_names}
        nec_gap = abs(rows[0][1]["necessity"] - rows[1][1]["necessity"])
        print(f"\n  RAGAS moves by {drift} across conditions; necessity moves by {nec_gap:.3f}.")
        print("  (RAGAS ~invariant + necessity separating = the false-sufficiency contrast.)")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)) or ".", exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["model", "n", "acc_with", "acc_closed", "necessity"] + metric_names)
        for label, nec, rs in rows:
            w.writerow([label, nec["n"], f"{nec['acc_with']:.4f}", f"{nec['acc_closed']:.4f}",
                        f"{nec['necessity']:.4f}"] + [f"{rs.get(m, ''):}" if rs else "" for m in metric_names])
    print(f"\nwrote {args.out}")


if __name__ == "__main__":
    main()
