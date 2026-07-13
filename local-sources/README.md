# local-sources/

Local copies of source documents consumed by `scripts/ingest-corpus.ts`. This
directory is gitignored (except this file) — **never commit anything here.** It
exists so the ingestion script can reference relative paths like
`./local-sources/oem-manuals/9001094-motion-vision-kewb.pdf` without baking
anyone's absolute home-directory path or username into the repo.

## Layout

One unified, **deduplicated** tree organized by document type. (Historically
this folder held two overlapping structures — a flat ingest set plus a raw
`Aerosol Jet Printing/` download archive — with every ingested file duplicated
in the archive and ~18 further intra-archive dupes. Those were collapsed into
the single tree below; exact byte-duplicates were removed.)

```
local-sources/
  review-articles/     Peer-reviewed papers.                    [ALL 6 INGESTED]
  oem-manuals/         Optomec numbered system/operator manuals,
                       block diagram, 3rd-party (Alicat).        [3 INGESTED]
  process-guides/      Process development, cleaning, assembly
                       aids, mixing, bubbler, pressure checks.   [1 INGESTED]
  ink-materials/       Ink/dielectric/silver datasheets,
                       soldering guides, materials FAQ.          [reference only]
  _excluded/           Held for reference but NOT ingested — sensitivity review
                       (see EXCLUDED_SOURCES in scripts/ingest-corpus.ts):
    hd2-proprietary/     .docx/.pptx trio + connection diagrams
                         (authorship/redistribution rights unconfirmed).
    machine-config/      Raw KEWB Config/*.xml from a real deployment
                         (real IPs, serials, COM ports).
    sequences/           Raw KEWB Sequences/*.xml from a real deployment
                         (real recipe/toolpath filenames).
```

## What ingest actually reads

Only the files named in `scripts/ingest-corpus.ts`'s `ACTIVE_SOURCES` array are
ingested — currently **11** local files:

- `review-articles/` — all six papers (`chen-2018-overspray.pdf`,
  `gu-2017-fillets.pdf`, `fisher-2023-sensors.pdf`, `secor-2018-principles.pdf`,
  `wilkinson-2019-review.pdf`, `salary-2019-state-of-art.pdf`).
- `oem-manuals/` — `9001094-motion-vision-kewb.pdf`, `9000876-health-safety.pdf`,
  `9000983-process-manual.pdf`, `hd2-block-diagram.pdf`.
- `process-guides/` — `24450-process-dev-session11.pdf`.

Everything else (the rest of `oem-manuals/` and `process-guides/`, all of
`ink-materials/`, and all of `_excluded/`) is kept for reference only. To ingest
one, add an `ACTIVE_SOURCES` entry pointing at its path (each entry's `label`
documents intended contents; dispositions live in `sources/SOURCES_LOG.md`).

## What's deliberately not ingested

`scripts/ingest-corpus.ts` also exports `EXCLUDED_SOURCES` — documents left out
of the public corpus after a sensitivity review (unnumbered vendor documents
with unconfirmed redistribution rights, and raw machine-configuration exports
from a real deployment). Their originals live under `_excluded/` above. See that
file for the full list and rationale, and the app's Domain Sources panel
(References & Whitepaper → Domain Sources) for the same list surfaced in-app.
