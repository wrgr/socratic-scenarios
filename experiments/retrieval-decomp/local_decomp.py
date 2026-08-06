#!/usr/bin/env python3
"""
Local, key-free RAG decomposition: how much of retrieval-augmented curation's value
comes from the fact being IN THE CORPUS vs. from the retriever ACTUALLY SURFACING it.

No API key. Generator = a local instruct model (Qwen2.5-1.5B by default, CPU-OK);
retriever = a local sentence embedder (all-MiniLM-L6-v2). This is the port of
scripts/ajp-retrieval-decomp.ts off the (suspended) Gemini stack so the decomposition
is runnable anywhere.

Three conditions per equipment-specific fact-recall question:
  none      closed-book (model PRIORS only)              -> "not in corpus / not retrieved"
  retrieved top-k chunks from the real dense retriever   -> "in corpus AND retrieved"
  oracle    the gold chunk that holds the answer         -> "in corpus, perfect retrieval"

Outcome attribution (accuracy over ANSWERABLE questions; a generation error is its own
bucket, never scored as a wrong answer -- same three-state discipline as the TS harness):
  CONTENT ceiling  acc(oracle)   - acc(none)      value if retrieval were perfect
  real-RAG value   acc(retrieved)- acc(none)      what the deployed retriever delivers
  RETRIEVAL gap    acc(oracle)   - acc(retrieved) in corpus but not surfaced

Retrieval-layer view (independent of the generator): recall@k of the gold chunk --
the pure "did the retriever surface the needed fact" measurement.

  QDECOMP_MODEL=Qwen/Qwen2.5-1.5B-Instruct QDECOMP_K=5 python local_decomp.py
"""
import json
import os
import re
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
CORPUS = os.path.join(REPO, "public", "ajp-corpus.json")

MODEL = os.environ.get("QDECOMP_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
EMBEDDER = os.environ.get("QDECOMP_EMBEDDER", "sentence-transformers/all-MiniLM-L6-v2")
TOPK = int(os.environ.get("QDECOMP_K", "5"))
MAXNEW = int(os.environ.get("QDECOMP_MAXNEW", "80"))
EMB_CACHE = os.path.join(HERE, "chunk-emb.npy")

# Equipment-specific recall questions (ported verbatim from ajp-retrieval-decomp.ts).
# `answer` = ALL patterns must be found in the reply. `gold` = distinctive substring of
# the corpus chunk that holds the answer (oracle context + retrieval recall target).
QUESTIONS = [
    dict(id="shutdown",
         q="When shutting down the three AJP gas flows, in what order and with what wait times between them?",
         answer=[r"atomizer[\s\S]{0,50}10\s*s[\s\S]{0,60}exhaust[\s\S]{0,50}60\s*s[\s\S]{0,50}sheath"],
         gold="atomizer -> wait 10 s -> exhaust -> wait 60 s -> sheath"),
    dict(id="flows150",
         q="For a 150 um nozzle, what are the recommended sheath, atomizer, and exhaust gas flow rates (sccm)?",
         answer=[r"55\s*-?\s*60\s*sccm", r"600\s*sccm", r"570\s*sccm"],
         gold="sheath flow of 55-60 sccm, an atomizer flow of ~600 sccm"),
    dict(id="standoff",
         q="What is the nominal allowed standoff distance range between the nozzle and the substrate?",
         answer=[r"3\s*[~\-–to ]{1,4}5\s*mm"],
         gold="range of allowed distances is nominally 3 ~ 5 mm"),
    dict(id="inklevel",
         q="How far below the small hole on the side of the jet should the ink level be kept?",
         answer=[r"15\s*mm"],
         gold="ink level is 15mm below the small hole"),
    dict(id="cleaning",
         q="What is the cleaning protocol for non-critical parts (which solvents, and for how long each)?",
         answer=[r"branson", r"10\s*min"],
         gold="Water (10min x 2 times), Branson"),
    dict(id="flows200",
         q="For a 200 um nozzle, what sheath gas flow is recommended (sccm)?",
         answer=[r"80\s*-?\s*90\s*sccm"],
         gold="nozzle size of 200 um, a sheath flow of 80-90 sccm"),
    dict(id="reenable",
         q="After a stop, how long until the motion controller automatically re-enables the axes?",
         answer=[r"10\s*s(econds)?"],
         gold="After 10 seconds the motion controller will automatically re-enable"),
]


def load_corpus():
    chunks = json.load(open(CORPUS))["chunks"]
    return chunks


def answer_bearing(chunks, q):
    """Indices of every chunk that satisfies ALL of the question's answer regexes — i.e.
    every chunk from which the answer is actually recoverable. This is the ground-truth
    gold SET: 'retrieved successfully' means top-k contains any of these; the canonical
    'oracle' chunk is the lowest-indexed member (earliest, most authoritative SOP passage)."""
    idx = [i for i, c in enumerate(chunks)
           if all(re.search(p, c["text"], re.I) for p in q["answer"])]
    return idx


def build_prompt(q, context):
    return (
        "You are an operator of an Optomec HD2 aerosol jet printer. Answer the question "
        "precisely with specific values. Use your own knowledge together with any reference "
        "notes below.\n\nREFERENCE NOTES:\n" + (context or "(none provided)") +
        f"\n\nQUESTION: {q}\n\nAnswer in one or two sentences with the specific values."
    )


def scored(reply, patterns):
    return all(re.search(p, reply, re.I) for p in patterns)


def main():
    print(f"model: {MODEL}\nembedder: {EMBEDDER}\ntop-k: {TOPK}\n", flush=True)
    import torch
    from sentence_transformers import SentenceTransformer
    from transformers import AutoModelForCausalLM, AutoTokenizer

    chunks = load_corpus()
    texts = [c["text"] for c in chunks]
    gold_set = {qq["id"]: answer_bearing(chunks, qq) for qq in QUESTIONS}
    gold_idx = {qid: (idxs[0] if idxs else -1) for qid, idxs in gold_set.items()}  # canonical oracle
    for qq in QUESTIONS:
        if not gold_set[qq["id"]]:
            print(f"  ! WARNING no answer-bearing chunk for {qq['id']} — oracle undefined", flush=True)

    emb = SentenceTransformer(EMBEDDER, device="cpu")
    if os.path.exists(EMB_CACHE):
        chunk_vecs = np.load(EMB_CACHE)
        if chunk_vecs.shape[0] != len(texts):
            chunk_vecs = None
        else:
            print("loaded cached chunk embeddings", flush=True)
    else:
        chunk_vecs = None
    if chunk_vecs is None:
        print(f"embedding {len(texts)} chunks...", flush=True)
        chunk_vecs = emb.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        np.save(EMB_CACHE, chunk_vecs)
    qvecs = emb.encode([qq["q"] for qq in QUESTIONS], normalize_embeddings=True)

    tok = AutoTokenizer.from_pretrained(MODEL)
    lm = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.float32).eval()

    def generate(prompt):
        msgs = [{"role": "user", "content": prompt}]
        # transformers 5.x: apply_chat_template(return_tensors=...) yields a BatchEncoding,
        # not a bare tensor — use return_dict and splat it into generate().
        enc = tok.apply_chat_template(msgs, add_generation_prompt=True,
                                      return_tensors="pt", return_dict=True)
        in_len = enc["input_ids"].shape[1]
        with torch.no_grad():
            out = lm.generate(**enc, max_new_tokens=MAXNEW, do_sample=False,
                              pad_token_id=tok.eos_token_id)
        return tok.decode(out[0, in_len:], skip_special_tokens=True)

    # retrieval-layer view: recall@k of ANY answer-bearing chunk (the pure
    # "retriever surfaced the needed fact" measurement, independent of the generator).
    recall_hits = 0
    retrieved_idx = {}
    for i, qq in enumerate(QUESTIONS):
        sims = chunk_vecs @ qvecs[i]
        top = [int(j) for j in np.argsort(-sims)[:TOPK]]
        retrieved_idx[qq["id"]] = top
        gs = set(gold_set[qq["id"]])
        hit = bool(gs & set(top))
        recall_hits += int(hit)
        print(f"  [retrieval {qq['id']:9s}] answer-bearing {sorted(gs)} in top-{TOPK}={top}: "
              f"{'HIT' if hit else 'MISS'}", flush=True)

    tally = {m: dict(correct=0, wrong=0, error=0) for m in ("none", "retrieved", "oracle")}
    for i, qq in enumerate(QUESTIONS):
        for mode in ("none", "retrieved", "oracle"):
            if mode == "none":
                context = ""
            elif mode == "oracle":
                gi = gold_idx[qq["id"]]
                context = f"[{chunks[gi]['id']}] {chunks[gi]['text']}"
            else:
                context = "\n\n".join(f"[{chunks[j]['id']}] {chunks[j]['text']}"
                                      for j in retrieved_idx[qq["id"]])
            try:
                reply = generate(build_prompt(qq["q"], context))
                ok = scored(reply, qq["answer"])
                tally[mode]["correct" if ok else "wrong"] += 1
                outcome = "OK " if ok else "MISS"
            except Exception as e:  # noqa: BLE001 -- generation failure is its own bucket
                tally[mode]["error"] += 1
                reply, outcome = str(e), "ERR "
            print(f"  [{qq['id']:9s} {mode:9s}] {outcome} :: {' '.join(reply.split())[:110]}",
                  flush=True)

    def acc(t):
        d = t["correct"] + t["wrong"]
        return float("nan") if d == 0 else t["correct"] / d

    a = {m: acc(tally[m]) for m in tally}
    pct = lambda x: "n/a" if x != x else f"{100*x:.0f}%"  # noqa: E731
    N = len(QUESTIONS)
    print("\n================ RAG DECOMPOSITION (local) ================")
    print(f"retrieval recall@{TOPK} (gold chunk surfaced): {recall_hits}/{N} = {pct(recall_hits/N)}")
    for m in ("none", "retrieved", "oracle"):
        t = tally[m]
        print(f"  {m:10s} {pct(a[m]):>4s}   ({t['correct']}/{t['correct']+t['wrong']} answerable"
              f"{', %d err' % t['error'] if t['error'] else ''})")
    print("  attribution:")
    print(f"    CONTENT ceiling  acc(oracle)-acc(none)      = {pct(a['oracle']-a['none'])}")
    print(f"    real-RAG value   acc(retrieved)-acc(none)   = {pct(a['retrieved']-a['none'])}")
    print(f"    RETRIEVAL gap    acc(oracle)-acc(retrieved) = {pct(a['oracle']-a['retrieved'])}")
    print("==========================================================")


if __name__ == "__main__":
    sys.exit(main())
