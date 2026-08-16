# ---------------------------------------------------------------------------
# modal_headline.py — submit the headline calibration to Modal (modal.com):
# 15 independent (model x seed) jobs fan out in PARALLEL, each on its own A100,
# results land in a persistent Modal Volume. No notebook to babysit.
#
# One-time setup (local machine, ~2 min):
#   pip install modal
#   modal setup                      # browser auth
#   modal secret create huggingface HF_TOKEN=hf_...   # a FRESH token (rotate the leaked one)
#
# Submit everything and walk away:
#   modal run --detach experiments/modal_headline.py
# Or a subset:
#   modal run --detach experiments/modal_headline.py --models Qwen/Qwen2.5-3B-Instruct --seeds 0,1
#
# Watch / fetch results:
#   modal app logs necessity-audit-headline
#   modal volume get necessity-results / ./results_from_modal
#
# Written against Modal's stable public API (App/Image/Volume/Secret, 2024-2025).
# Not run in this dev environment (no Modal account here) — if an API detail has
# drifted, the error will be at import/deploy time and cosmetic to fix.
# ---------------------------------------------------------------------------
import modal

app = modal.App("necessity-audit-headline")

REPO = "https://github.com/wrgr/socratic-scenarios"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git")
    .pip_install(
        "torch",
        "transformers>=4.48",
        "peft>=0.11",
        "accelerate>=0.30",
        "safetensors>=0.4",
        "bitsandbytes>=0.43",
    )
)

vol = modal.Volume.from_name("necessity-results", create_if_missing=True)

MODELS_DEFAULT = ",".join([
    "Qwen/Qwen2.5-3B-Instruct",
    "microsoft/Phi-3.5-mini-instruct",
    "HuggingFaceH4/zephyr-7b-beta",
    "meta-llama/Llama-3.1-8B-Instruct",
    "allenai/OLMo-2-1124-7B-Instruct",
])


@app.function(
    image=image,
    gpu="A100",
    timeout=6 * 60 * 60,  # one (model, seed): teach + 21-alpha batched sweep; 8B fits well inside 6h
    volumes={"/results": vol},
    secrets=[modal.Secret.from_name("huggingface")],
)
def run_one(model: str, seed: int, alphas: str = "", run_dir: str = "") -> str:
    import os
    import subprocess
    import tempfile

    os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", os.environ.get("HF_TOKEN", ""))
    # Clone into a FRESH temp dir per call: Modal reuses warm containers across
    # inputs, so a fixed path like /repo already exists on the second input and
    # git clone dies with exit 128 (the 29ms-fail signature).
    workdir = tempfile.mkdtemp(prefix="repo_")
    subprocess.run(["git", "clone", "--depth", "1", REPO, workdir], check=True)
    # Transcripts + CSV names must land on the shared volume; gpu_job.sh honors OUT_DIR.
    base = "/results/" + run_dir.strip("/") if run_dir else "/results"
    env = dict(
        os.environ,
        MODEL=model,
        SEED=str(seed),
        OUT_DIR=base,
        # Adapters persist on the volume: teach once per (model, seed), then every
        # retry / tail-fill skips straight to generation.
        ADAPTER_ROOT=base + "/adapters",
        # Tolerate ONE argmax-tie flip in the batched-vs-single probe before falling
        # back to single-stream (~5x faster fills). Disclosed in provenance.
        SELF_CHECK_TOLERANCE="1",
        PYTHONUNBUFFERED="1",
    )
    if alphas:
        env["ALPHAS"] = alphas  # per-submit grid override (e.g. an 11-point 0.1 grid)
    subprocess.run(["bash", f"{workdir}/experiments/gpu_job.sh"], check=True, env=env)
    vol.commit()  # persist before the container dies
    slug = model.split("/")[-1]
    return f"done: {model} seed {seed} -> {base}/dose_factqa_{slug}_s{seed}_a*.jsonl"


@app.local_entrypoint()
def main(models: str = MODELS_DEFAULT, seeds: str = "0,1,2"):
    jobs = [(m, int(s), "", "") for m in models.split(",") for s in seeds.split(",")]
    print(f"submitting {len(jobs)} (model, seed) jobs in parallel...")
    for result in run_one.starmap(jobs):
        print(result)
    print("all jobs done. Fetch with: modal volume get necessity-results / ./results_from_modal")
