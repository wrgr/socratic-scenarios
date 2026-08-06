# Local RAG decomposition — result

Key-free run of `local_decomp.py`: generator **Qwen2.5-1.5B-Instruct** (CPU), retriever
**all-MiniLM-L6-v2**, `k=5`, over 7 equipment-specific AJP fact-recall queries whose answers
live in `public/ajp-corpus.json`. Scored by the same answer regexes as the oracle/gold set.

| condition | accuracy | reads as |
|---|---|---|
| `none` (priors only) | **0/7 (0%)** | closed-book — the model knows none of these values |
| `retrieved` (MiniLM top-k) | **3/7 (43%)** | what a deployed RAG pipeline delivers |
| `oracle` (answer-bearing chunk) | **7/7 (100%)** | every fact is recoverable with perfect retrieval |

**Attribution**

- CONTENT ceiling `acc(oracle) − acc(none)` = **100%** — all value is in the corpus (priors add nothing).
- real-RAG value `acc(retrieved) − acc(none)` = **43%** — what the pipeline actually captures.
- RETRIEVAL gap `acc(oracle) − acc(retrieved)` = **57%** — in the corpus but never surfaced.

Generator-independent retrieval read: **recall@5 = 4/7** of any answer-bearing chunk.

**Reading.** On this domain the binding constraint is **retrieval, not coverage or model
capability**: the corpus contains every answer (oracle 100%) and the model can report it when
handed the right chunk, yet the deployed retriever forfeits the majority (57%) of that value.
This separates three outcomes the binary leakage verdict cannot — curation failure (fact
absent), retrieval failure (present but unranked), and priors success.

_Scope: one small model, seven queries, one corpus — illustrates the decomposition method, not
a benchmark. Reproduce: `python local_decomp.py` (no API key)._
