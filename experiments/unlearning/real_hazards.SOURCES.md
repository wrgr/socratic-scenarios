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

## Candidates

| Location | Danger | Expectation | Source |
|---|---|---|---|
| Cayou Channel, Orcas Island, Puget Sound | **Elwha Rock** — submerged rock, ~5 ft (1.5 m) at MLW, W of Grindstone Harbor; ferries *Elwha* (1983) & *Nisqually* (1994) grounded | likely **usable** (obscure) | [Wikipedia: Elwha Rock](https://en.wikipedia.org/wiki/Elwha_Rock) |
| Johnston Passage, Adelaide Island, Antarctica | **Fullastern Rock** — isolated submerged rock ~7 nm WNW of Cape Adriasola; named when RRS *John Biscoe* went full astern to avoid it | likely **usable** (very obscure) | [Wikipedia: Fullastern Rock](https://en.wikipedia.org/wiki/Fullastern_Rock) |
| False Bay, Western Cape, South Africa | **Whittle Rock** — granite reef, min depth ~3.2 m, ~8 km E of Miller's Point; East Cardinal buoy | uncertain | [Wikipedia: Whittle Rock](https://en.wikipedia.org/wiki/Whittle_Rock) |
| off Rodeo Beach, Marin County, California | **Centissima Reef** (surrounds Sears Rock) — historically a hazard, later reduced by blasting | uncertain (reduced danger) | [Wikipedia: Centissima Reef](https://en.wikipedia.org/wiki/Centissima_Reef) |
| approaches W of Land's End, Cornwall | **Seven Stones Reef** — ~15 mi W of Land's End; site of the 1967 *Torrey Canyon* wreck | **control — expect DROP** (famous, model likely knows it) | [Wikipedia: Seven Stones Reef](https://en.wikipedia.org/wiki/Seven_Stones_Reef) |

The Seven Stones row is included on purpose: a well-known danger the base model *should* name
closed-book, so the screen dropping it is the expected behavior — and that drop is itself reportable
data ("N of M candidates screened out as already-known").

## Run

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
