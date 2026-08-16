# ---------------------------------------------------------------------------
# modal_submit.py — FIRE-AND-FORGET submission against the DEPLOYED app.
#
# Why this exists: `modal run --detach` creates an EPHEMERAL app whose lifetime
# is still tied to the run invocation; if the app is torn down (client/runtime
# death at the wrong moment, or `modal app stop`), every in-flight container
# gets SIGTERM. A DEPLOYED app + .spawn() has no client dependency at all:
# spawned calls run to completion server-side no matter what dies locally.
#
# Usage (Colab or any authed shell):
#   !modal deploy /content/repo/experiments/modal_headline.py     # once
#   !python /content/repo/experiments/modal_submit.py             # spawn all 15, exit
#
# Optional env: MODELS="a,b" SEEDS="0,1" to submit a subset.
# Jobs are resumable: a (model, seed) whose final transcript already sits on the
# volume is skipped by gpu_job.sh, so re-submitting after a partial run only
# redoes unfinished work.
# ---------------------------------------------------------------------------
import os

import modal

MODELS = os.environ.get("MODELS", ",".join([
    "Qwen/Qwen2.5-3B-Instruct",
    "microsoft/Phi-3.5-mini-instruct",
    "HuggingFaceH4/zephyr-7b-beta",
    "meta-llama/Llama-3.1-8B-Instruct",
    "allenai/OLMo-2-1124-7B-Instruct",
])).split(",")
SEEDS = [int(s) for s in os.environ.get("SEEDS", "0,1,2").split(",")]
ALPHAS = os.environ.get("ALPHAS", "")  # optional grid override for THESE spawns only

run_one = modal.Function.from_name("necessity-audit-headline", "run_one")

handles = []
for m in MODELS:
    for s in SEEDS:
        h = run_one.spawn(m, s, ALPHAS)
        handles.append(h)
        print(f"spawned {h.object_id}  {m}  seed {s}")

print(f"\n{len(handles)} jobs spawned on the DEPLOYED app — they run to completion "
      f"server-side; it is safe to close this runtime immediately.")
print("Watch: modal.com dashboard -> Apps -> necessity-audit-headline")
print("Fetch when green: modal volume get necessity-results / ./results_from_modal")
