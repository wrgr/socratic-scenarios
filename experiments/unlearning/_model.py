"""Shared base-model loading for the unlearning arm.

One NF4 config in one place so train (unlearn.py), audit (audit.py), and serve (serve.py)
quantize the base *identically*. This is a correctness invariant, not just DRY: the audit
measures unlearning by comparing a base against an adapter, so if the audit's quantization
drifts from training's, it compares against a differently-quantized base and the forget/
retain NLL deltas become meaningless.
"""
import torch
from transformers import AutoModelForCausalLM

DTYPES = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}


def load_base(model_id: str, *, load_4bit: bool, device: str, dtype=torch.float32):
    """Load the base model. A 4-bit (NF4) model is placed by device_map and must NOT be
    .to(device)'d; a full-precision model is moved to `device`. Callers do their own
    post-step (.eval(), or prepare_model_for_kbit_training for training)."""
    if load_4bit:
        from transformers import BitsAndBytesConfig
        bnb = BitsAndBytesConfig(
            load_in_4bit=True, bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16, bnb_4bit_use_double_quant=True,
        )
        # Place the quantized model on the SAME device the caller moves inputs to, so
        # `--device cuda:1` doesn't load onto GPU 0 and fail the first forward with a
        # cross-device error. ("cuda" -> current device; an explicit "cuda:N" is honored.)
        return AutoModelForCausalLM.from_pretrained(
            model_id, quantization_config=bnb, device_map={"": device}, torch_dtype=torch.bfloat16,
        )
    return AutoModelForCausalLM.from_pretrained(model_id, torch_dtype=dtype).to(device)
