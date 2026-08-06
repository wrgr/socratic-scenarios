#!/usr/bin/env python3
"""
Minimal OpenAI-compatible server wrapping a base (or unlearned) open-weight model, so
the existing TypeScript scoring harness scores it UNCHANGED:

  python serve.py --model <id> [--adapter out/unlearned] --port 8000
  # then, in another shell:
  OPENAI_API_KEY=x OPENAI_BASE_URL=http://localhost:8000/v1 OPENAI_MODEL=local \
    npm run colreg:leakage

`openAiCompatCompleter` (src/engine/colreg-sim/llm-learner.ts) POSTs to
/v1/chat/completions; this returns the generated text in the OpenAI shape. Stdlib
http.server only — no FastAPI/uvicorn dependency.

For the real experiment run this twice (adapter off = base, adapter on = unlearned) and
score each with and without the corpus (the 2x2 in docs/novelty-and-positioning.md §8).
"""
import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

STATE = {}


def generate(messages, max_new=200):
    tok, model, device = STATE["tok"], STATE["model"], STATE["device"]
    # Render with the model's chat template so INSTRUCT models get their user/assistant
    # control tokens (feeding the raw text produces uncontrolled continuations and makes
    # the JSON-decision parsing fail). Fall back to the last message for base models
    # without a chat template.
    if getattr(tok, "chat_template", None):
        text = tok.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
    else:
        text = messages[-1]["content"] if messages else ""
    ids = tok(text, return_tensors="pt").to(device)
    with torch.no_grad():
        out = model.generate(**ids, max_new_tokens=max_new, do_sample=False,
                             pad_token_id=tok.pad_token_id or tok.eos_token_id)
    return tok.decode(out[0][ids.input_ids.shape[1]:], skip_special_tokens=True).strip()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        if not self.path.rstrip("/").endswith("/chat/completions"):
            self.send_error(404)
            return
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        messages = body.get("messages", [])
        text = generate(messages)
        payload = json.dumps({
            "id": "local", "object": "chat.completion", "model": STATE["name"],
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text},
                         "finish_reason": "stop"}],
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--adapter", default=None)
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    ap.add_argument("--dtype", choices=["float32", "bfloat16", "float16"], default="float32",
                    help="model dtype (float32 for CPU; bfloat16 for a real GPU run)")
    args = ap.parse_args()
    dtype = {"float32": torch.float32, "bfloat16": torch.bfloat16, "float16": torch.float16}[args.dtype]

    tok = AutoTokenizer.from_pretrained(args.model)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.model, torch_dtype=dtype).to(args.device).eval()
    name = args.model
    if args.adapter:
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.adapter).to(args.device).eval()
        name = f"{args.model}+{args.adapter}"
    STATE.update(tok=tok, model=model, device=args.device, name=name)

    print(f"serving {name} on http://localhost:{args.port}/v1  (device={args.device})")
    ThreadingHTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
