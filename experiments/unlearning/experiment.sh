#!/usr/bin/env bash
# Headless driver for the open-weight unlearning arm — the script form of colab.ipynb, for a
# rented GPU box (AWS g5/g6/g4dn, RunPod, Lambda, …). Runs the whole arm and the 2×2 instrument
# scoring, logging EVERYTHING to a timestamped results dir with all artifacts collected:
#
#   build → unlearn → audit (→ relearn) → portless 2×2 scoring (dump → generate → replay)
#
# Usage (env-configured, same knobs as run.sh plus a few):
#   MODEL=Qwen/Qwen2.5-3B-Instruct SCALE=full SEED=0 ./experiment.sh          # small
#   MODEL=Qwen/Qwen2.5-7B-Instruct SCALE=full SEED=0 RELEARN=1 ./experiment.sh # larger
#
# Knobs (all optional):
#   MODEL METHOD DTYPE SCALE EPOCHS SEED RELEARN LOAD_4BIT BATCH OUT   — passed to run.sh
#   SCORE=1        also run the 2×2 instrument scoring after the audit (default 1; 0 = audit only)
#   SKIP_SETUP=1   skip pip/npm install (assume the env is already prepared)
#   RESULTS_DIR    override the output dir (default results/<model>_<method>_s<seed>_<timestamp>)
#
# Everything (stdout+stderr) is tee'd to <results>/run.log; key outputs are also saved to their
# own files (unlearn-audit.txt, leakage-base.txt, leakage-unlearned.txt, completions-*.jsonl,
# prompts.jsonl, unlearn_config.json, pip-versions.txt, the datasets). Idempotent per results dir.
set -euo pipefail
cd "$(dirname "$0")"
ARM="$(pwd)"
REPO="$(cd ../.. && pwd)"

MODEL="${MODEL:-Qwen/Qwen2.5-3B-Instruct}"
METHOD="${METHOD:-simnpo}"
DTYPE="${DTYPE:-bfloat16}"
SCALE="${SCALE:-full}"
EPOCHS="${EPOCHS:-3}"
SEED="${SEED:-0}"
RELEARN="${RELEARN:-0}"
LOAD_4BIT="${LOAD_4BIT:-0}"
BATCH="${BATCH:-1}"
SCORE="${SCORE:-1}"
SKIP_SETUP="${SKIP_SETUP:-0}"

slug="$(printf '%s' "$MODEL" | tr '/:' '__')"
TS="${TIMESTAMP:-$(date +%Y%m%d-%H%M%S)}"
RESULTS_DIR="${RESULTS_DIR:-$ARM/results/${slug}_${METHOD}_s${SEED}_${TS}}"
OUT="${OUT:-$ARM/out/${slug}_${METHOD}_s${SEED}}"
mkdir -p "$RESULTS_DIR"

# Tee all subsequent output to the run log while still printing to the console.
exec > >(tee -a "$RESULTS_DIR/run.log") 2>&1

echo "== experiment start $(date -u +%FT%TZ) =="
echo "model=$MODEL method=$METHOD dtype=$DTYPE scale=$SCALE epochs=$EPOCHS seed=$SEED relearn=$RELEARN load_4bit=$LOAD_4BIT score=$SCORE"
echo "results_dir=$RESULTS_DIR"
echo "adapter_out=$OUT"

# Provenance: GPU + library versions (so a results dir is self-describing / reproducible).
python - <<'PY' || true
import torch
print("torch", torch.__version__, "| cuda_available", torch.cuda.is_available())
if torch.cuda.is_available():
    free, total = torch.cuda.mem_get_info()
    print("gpu", torch.cuda.get_device_name(0), f"| vram {total/2**30:.1f} GiB (free {free/2**30:.1f})")
PY
pip freeze 2>/dev/null | grep -iE '^(torch|transformers|peft|accelerate|bitsandbytes|safetensors)==' \
    > "$RESULTS_DIR/pip-versions.txt" || true

if [ "$SKIP_SETUP" != "1" ]; then
    echo "== setup: pip + npm =="
    pip install -q -r requirements.txt
    [ "$LOAD_4BIT" = "1" ] && pip install -q bitsandbytes
    ( cd "$REPO" && npm install --no-audit --no-fund --loglevel=error )
fi

# 1) build → unlearn → audit (→ relearn) via run.sh; also capture just this stream to its own file.
echo "== arm: build -> unlearn -> audit${RELEARN:+ (+relearn)} =="
MODEL="$MODEL" METHOD="$METHOD" DTYPE="$DTYPE" SCALE="$SCALE" EPOCHS="$EPOCHS" \
    SEED="$SEED" RELEARN="$RELEARN" LOAD_4BIT="$LOAD_4BIT" BATCH="$BATCH" OUT="$OUT" \
    bash run.sh | tee "$RESULTS_DIR/unlearn-audit.txt"

cp -f "$OUT/unlearn_config.json" "$RESULTS_DIR/" 2>/dev/null || true
cp -f data/forget.jsonl data/retain.jsonl data/audit.jsonl "$RESULTS_DIR/" 2>/dev/null || true

# 2) 2×2 instrument scoring (portless): dump prompts once, generate base + unlearned, replay each.
if [ "$SCORE" = "1" ]; then
    echo "== 2x2 instrument scoring (portless) =="
    Q4=""; [ "$LOAD_4BIT" = "1" ] && Q4="--load_4bit"
    DUMP="$RESULTS_DIR/prompts.jsonl"
    ( cd "$REPO" && LEAKAGE_DUMP="$DUMP" npm run --silent colreg:leakage )

    score_model () {  # $1 = label, $2.. = extra score_offline.py args (e.g. --adapter DIR)
        local label="$1"; shift
        local trans="$RESULTS_DIR/completions-$label.jsonl"
        echo "-- generate ($label) --"
        python score_offline.py --model "$MODEL" --dtype "$DTYPE" $Q4 "$@" \
            --prompts "$DUMP" --out "$trans"
        echo "-- score ($label) --"
        ( cd "$REPO" && LEAKAGE_REPLAY="$trans" npm run --silent colreg:leakage ) \
            | tee "$RESULTS_DIR/leakage-$label.txt"
    }
    score_model base                       # base row of the 2×2 (adapter off)
    score_model unlearned --adapter "$OUT" # unlearned row (adapter on)
fi

echo "== done $(date -u +%FT%TZ) =="
echo "artifacts:"
ls -la "$RESULTS_DIR"
