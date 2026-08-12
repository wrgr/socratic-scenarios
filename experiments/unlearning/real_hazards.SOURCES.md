# Real-hazard candidates — sources & verification (Exp 4)

`real_hazards.jsonl` holds **real, publicly-documented** charted dangers, sourced with citations, for
the external-validity leg (probe #2). They are **candidates, not verified chart data**: before any
number from these goes in the paper, **verify each against the official chart / Notice to Mariners**
(NOAA ENC / US Coast Pilot; UKHO ADMIRALTY; SAN for False Bay; etc.). The details below were pulled
from the cited pages and may be dated or imprecise — the *screen* is the empirical gate for
usability, and chart verification is the gate for accuracy.

Two things to keep straight:
- Only the **(place, danger)** pair needs to be real. The avoidance *action* in each `disclosure`
  ("alter to starboard by ≥55°") is the fixed simulator template, not a claim about the charted
  recommended track.
- `danger_terms` are the distinctive names the *screen* looks for in a closed-book answer (if the
  model names the danger unprompted, it already knows it → drop it). The instrument never sees them.

## Candidates (with verification)

Each was cross-checked against a second, more authoritative source than the original Wikipedia page.
**Verification level reached:** existence + location + danger-status corroborated across multiple
public sources (and, for two, *official name gazetteers*). **Not** yet reached: reading the exact
depths/coordinates off the official ENC / ADMIRALTY chart — so treat the numeric details as
well-supported-but-confirm-before-citing.

| Location | Danger | Verification | Screen expectation |
|---|---|---|---|
| Cayou Channel, Orcas Island, Puget Sound | **Elwha Rock** — submerged rock ~5 ft (1.5 m) at MLW, W of Grindstone Harbor; ferry *Elwha* grounded 2 Oct 1983 | ✅ **strong** — *official* name (Washington Board on Geographic Names, Dec 1989); multiple independent sources; added to the chart after the grounding ([WaPo 1989](https://www.washingtonpost.com/archive/politics/1989/12/10/ferry-makes-the-map-with-a-rock-hit/fa09a623-2ece-43c5-8449-3201f311d254/), [San Juan Journal](https://www.sanjuanjournal.com/life/a-ferry-tale-remembering-the-elwha/)) | likely **usable** (obscure) |
| Johnston Passage, Adelaide Island, Antarctica | **Fullastern Rock** — isolated submerged rock ~7 nm WNW of Cape Adriasola, 67°37′S 69°26′W | ✅ **strong** — *official* Antarctic gazetteers: [Australian Antarctic Data Centre](https://data.aad.gov.au/aadc/gaz/display_name.cfm?gaz_id=108936), SCAR Composite Gazetteer, Gazetteer of the British Antarctic Territory | likely **usable** (very obscure) |
| False Bay, Western Cape, South Africa | **Whittle Rock** — granite reef, min depth ~3.2 m at 34°14.845′S 18°33.714′E; East Cardinal buoy | ✅ **good** — multiple independent sources agree on coords/depth/buoy ([Wikivoyage](https://en.wikivoyage.org/wiki/Diving_the_Cape_Peninsula_and_False_Bay/Whittle_Rock), [ScubaGo](https://www.scubago.com/en/explore/divesite/whittle-rock-cape-town-south-africa-237877)); "most significant navigational hazard in False Bay" | uncertain — a popular dive site, so may screen out as locally-known |
| approaches W of Land's End, Cornwall | **Seven Stones Reef** — ~15 mi W of Land's End; 1967 *Torrey Canyon* wreck | ✅ (famous) — [Wikipedia](https://en.wikipedia.org/wiki/Seven_Stones_Reef) | **control — expect DROP** (model should name it) |

The Seven Stones row is a deliberate **control**: a well-known danger the base model *should* name
closed-book, so the screen dropping it is the expected behavior — reportable data ("N of M candidates
screened out as already-known").

### Dropped on verification
- **Centissima Reef** (off Rodeo Beach, CA) — a real charted feature, but verification showed it was
  **blasted to ~40 ft depth (~1917)** and Congress noted by 1922 it "neither posed a navigation
  hazard" ([Wikipedia](https://en.wikipedia.org/wiki/Centissima_Reef)). A "danger" that is no longer
  a danger is a poor probe, so it was removed from `real_hazards.jsonl`. (A small illustration that
  the verification step has teeth.)

## Run

**One-command script (API, no GPU):** `real_ship_nav.py` screens *and* runs every candidate against
the same Bedrock model (screen and instrument should agree on "does this model know it"), logs each
model call with a UTC stamp for traceability, and emits a paste-back table + provenance JSON:

```bash
BEDROCK_MODEL=us.anthropic.claude-opus-4-5-20251101-v1:0 \
  python experiments/unlearning/real_ship_nav.py
```

The closed-book screen is an **optional pre-filter**: it needs `boto3` + working AWS creds (and, for
SSO/login creds, `botocore[crt]`). If that's unavailable the screen is skipped and **every** candidate
is run through the instrument — leakage is then read behaviorally (an already-known danger reads
`LEAKING`/redundant with necessity ≈ 0, which *is* the screen result, measured rather than asked).
Force-skip with `SKIP_SCREEN=1`.

The CLI path below is the equivalent GPU route (screen with a local base model instead of the API):

```bash
# 1. screen closed-book — keep only the dangers the base model does NOT already know (reports drops)
python experiments/unlearning/screen_hazards.py --model Qwen/Qwen2.5-7B-Instruct --dtype bfloat16 \
    --hazards experiments/unlearning/real_hazards.jsonl --out experiments/unlearning/data/usable_hazards.jsonl

# 2. run each USABLE hazard through the instrument (one JSON object per HAZARDS_FILE)
while IFS= read -r line; do
  echo "$line" > /tmp/hz.json
  HAZARDS_FILE=/tmp/hz.json PROBES=hazard npm run --silent colreg:leakage
done < experiments/unlearning/data/usable_hazards.jsonl
```

Report both: the necessity per *usable* real hazard, and which candidates were screened out (and
why). Add your own from official charts — the pipeline takes any `{location, disclosure,
danger_terms}` line.
