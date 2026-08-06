#!/usr/bin/env python3
"""
CPU "middle-ground" real run: unlearn on a small-but-real instruct model that actually
knows the head-on rule, on CPU (no GPU). Slower and weaker than a 7-8B GPU run, but a
genuine unlearning result rather than the distilgpt2 plumbing smoke.

  CPU_MODEL=Qwen/Qwen2.5-1.5B-Instruct python cpu_run.py

Chains: build_datasets -> unlearn (NPO, the CPU-tractable baseline that produced the
documented result; SimNPO is the primary method for the GPU instrument run) -> audit
(base vs unlearned, chat-templated probes). Reads the audit output and prints a compact
before/after verdict. Override the method with CPU_METHOD=simnpo|npo|ga.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("CPU_MODEL", "Qwen/Qwen2.5-1.5B-Instruct")
METHOD = os.environ.get("CPU_METHOD", "npo")
STEPS = os.environ.get("CPU_STEPS", "72")
LR = os.environ.get("CPU_LR", "3e-4")
BETA = os.environ.get("CPU_BETA", "0.05")


def run(cmd, capture=False):
    print("+", " ".join(cmd), flush=True)
    if capture:
        r = subprocess.run(cmd, cwd=HERE, capture_output=True, text=True)
        print(r.stdout[-4000:]);
        if r.returncode: print(r.stderr[-3000:])
        r.check_returncode()
        return r.stdout
    subprocess.run(cmd, cwd=HERE, check=True)
    return ""


def main():
    run([sys.executable, "build_datasets.py"])
    run([sys.executable, "unlearn.py", "--model", MODEL, "--method", METHOD,
         "--epochs", "12", "--max_steps", STEPS, "--batch_size", "1", "--lr", LR,
         "--beta", BETA, "--lora_r", "16", "--retain_weight", "1.0", "--chat",
         "--grad_checkpoint", "--out", "out/cpu"])
    out = run([sys.executable, "audit.py", "--model", MODEL, "--adapter", "out/cpu", "--chat"],
              capture=True)

    f_nll = [float(x) for x in re.findall(r"forget-set mean NLL:\s*([\d.]+)", out)]
    r_nll = [float(x) for x in re.findall(r"retain-set mean NLL:\s*([\d.]+)", out)]
    kw = [x for x in re.findall(r"direction-cue rate[^:]*:\s*(\d+)/(\d+)", out)]
    print("\n================ CPU UNLEARNING RESULT ================")
    print(f"model: {MODEL}  method: {METHOD.upper()}  steps: {STEPS}")
    if len(f_nll) == 2 and len(r_nll) == 2 and len(kw) == 2:
        print(f"forget-set NLL:   base {f_nll[0]:.2f}  ->  unlearned {f_nll[1]:.2f}   (want: UP)")
        print(f"retain-set NLL:   base {r_nll[0]:.2f}  ->  unlearned {r_nll[1]:.2f}   (want: ~flat)")
        print(f"direction-cue:    base {kw[0][0]}/{kw[0][1]}  ->  unlearned {kw[1][0]}/{kw[1][1]}   (want: DOWN)")
        knew = int(kw[0][0]) > 0 or f_nll[0] < f_nll[1]
        print("base knew the rule:" , "yes" if int(kw[0][0]) > 0 else "(weak — check forget NLL)")
    print("=======================================================")


if __name__ == "__main__":
    main()
