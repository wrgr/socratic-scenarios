# Passage ranking and unsupported questions

Reachback and the Retrieval Lab use the repaired AJP document corpus. The current
575 chunks and their stored embeddings are unchanged by this ranking update. The
HD2 glossary remains marked incomplete; it is excluded from these checks.

## Ranking policy

`rankPassages` in `src/engine/retrieval/passage-ranking.ts` indexes source labels,
sections, and passage text with BM25 (k1 = 1.2, b = 0.75). It normalizes ordinary
inflections, PDF line-break hyphenation, and minimum/maximum phrases. In semantic
mode, it combines keyword and cosine ranks by weighted reciprocal-rank fusion:
0.65 / (10 + keyword rank) + 0.35 / (10 + semantic rank). Without a comparable
embedding provider, it uses keyword ranking alone.

The bundled JSON backend considers all 575 semantic candidates before the five
passages are selected. Custom backends supply at least 50 candidates; their
coverage depends on the backend's candidate pool. The raw `queryDense` API still
returns cosine-ranked results when `queryText` is omitted. App document lookups
and RAG Coverage supply `queryText`, so they use the same passage-ranking policy.
RAG Coverage thresholds continue to apply to displayed similarity, not fusion rank.

Before displaying or assembling context, the ranker applies these checks:

- A requested part/model identifier must occur as a complete normalized identifier
  in the corpus. An absent identifier stops Reachback before external embedding
  calls. A known longer identifier does not satisfy a shorter identifier.
- A named manual, author, review, or study constrains candidates when the source
  can be identified from its label. Explicitly named sources remain available
  together for comparison questions.
- After removing common document-title framing, at least one topic term must be
  known. Questions with three or more topic terms need at least 60% known terms.
- Questions explicitly requesting certain quantities require a passage containing
  the corresponding units: magnification, torque, temperature, or liquid volume.

These are conservative lexical and format heuristics, not a general semantic
answerability test. They can reject valid unfamiliar paraphrases, miss source
aliases, or admit a related passage that does not answer the exact question.
Unit presence does not establish that a number applies to the requested item.
They do not verify every claim, negative assertion, pressure range, or procedure.

## Result and mentor behavior

The result distinguishes passages found, insufficient evidence, and unavailable
document search. Insufficient evidence returns no document passages, graph chains,
or node-match trace and hides the Reachback mentor panel. This prevents unrelated
fault chains from appearing as an answer to an unsupported document question.
Explicit graph-only calls (`denseTopK: 0`) retain graph behavior.

All five displayed passages are included in mentor context, including a relevant
passage at rank four or five. The context instructs the mentor to use only text
that answers the exact question and state when evidence is insufficient. This is
an instruction, not a measured guarantee of generated-answer correctness. Search
unavailability is reported separately; existing graph fallback remains available.

Displayed semantic scores are raw cosine similarities. Keyword scores are a
bounded transformation of BM25. Neither is a calibrated probability of a correct
answer, and the two scales are not directly comparable. Fusion rank controls
ordering independently of the displayed similarity score.

## Checks measured on 2026-11-04 (America/New_York)

The original ten HD2 manual questions improved from 9/10 to 10/10 with keyword
retrieval and from 8/10 to 10/10 with semantic retrieval, measured by an expected
manual passage appearing in the first five results. The failures included the
ultrasonic add-back solvent minimum, manual viscosity evidence, and inspection
magnification evidence. A corrected Fisher microgravity question also recovered
its expected passage (keyword rank 1; semantic fusion rank 3).

The expanded set contains 18 supported questions: 15 from the HD2 Process Manual
and one each from Nature, Salary, and Fisher. Both keyword and semantic modes
returned an expected passage in the first five for 18/18, including 15/15 manual
questions. Four unsupported controls (two nonexistent part identifiers, Paris
weather, and an unsupported teleportation capability) returned no passages in
both modes. The production-style no-key browser preview also passed all 18
supported questions and four unsupported controls, with no graph or mentor panel
shown for the unsupported questions.

The live-provider check used the actual retrieval engine and Gemini query
embeddings against the production corpus downloaded from
`https://experttrace.org/ajp-corpus.json`. Its SHA-256 was
`6e21900d25a8e095ac3aa9bbc99a5f3cebc2593575a54d2fd3b09d2b70d939c0`.
The browser checks used a local production build without configured provider keys.
These checks validate the proposed change; they do not imply it is deployed.
The compact [run record](retrieval-ranking-check-2026-11-04.json) preserves the
returned passage IDs, expected-passage ranks, and evidence status for each case.

The initial 13 supported questions informed development. Five further manual
questions and three further unsupported controls expanded the original negative
control. This small set was inspected while developing the policy and is not an
independent holdout or representative accuracy benchmark. No generated-answer
quality, human learning gains, or operational validation is measured here.

## Repeatable offline regressions

Run:

```sh
npm test -- src/engine/retrieval/__tests__/passage-ranking.test.ts src/engine/retrieval/__tests__/lookup-evidence.test.ts src/engine/retrieval/__tests__/hybrid-retrieval.test.ts
npm test
npm run lint
VITE_GEMINI_API_KEY= VITE_GITHUB_MODELS_TOKEN= VITE_EMBEDDING_PROVIDER=auto VITE_LLM_PROVIDER=auto npm run build
```

`__tests__/fixtures/passage-queries.json` records each exact question, expected
chunk IDs, source/PDF page anchors, and evidence pattern. Its real
`gemini-embedding-001` query vectors have 3072 dimensions, encoded as little-endian
float32 base64 so tests need no API key. They are captured query embeddings, not
fabricated cosine scores. The tests recompute cosine against the checked-in
corpus and exercise both keyword-only and fused ranking. They also check complete
identifier matching, multi-source comparison, unsupported-query early exit,
graph-only behavior, and inclusion of the fifth passage in mentor context.

To refresh the fixture after a deliberate embedding-model or corpus migration,
embed the recorded question strings with the matching provider/model, preserve the
question-to-vector order, and encode the returned vectors as float32 little-endian
bytes. Review source anchors and chunk IDs against the rebuilt corpus before
accepting changed expectations. A passing rank test establishes retrieval of the
annotated passage, not correctness of a generated answer.
