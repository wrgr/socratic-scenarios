# Knowing vs. doing: eliciting works, installing-by-SFT does not (the B arc)

Provenance for the "make the action move" follow-ups (Qwen2.5-3B-Instruct, A100, seed 0). Records
the full three-run arc of the decision-format teach (B) so the negative is documented with the raw
evidence, and states the A-vs-B contrast the paper rests on. All numbers are from logged Colab runs;
notebook: `experiments/colab_action_followups.ipynb`.

## The gap being probed

Teaching the hidden-hazard fact as **prose** ("...you should → alter starboard 55°") puts it in the
weights — `recall_probe.py` shows free-text recall of the action rise from **0.00 → 0.78** (base →
taught) — but the **scored JSON maneuver decision does not move**: necessity is flat **~667 across
α=0/0.5/1.0** (`dose_prose_single`). Knowledge is present but does not reach the decision. Two ways to
try to close the gap: **elicit** it at inference (A), or **install** the decision directly by SFT (B).

## A — CoT elicitation (WORKS, and is naturally conditional)

`dose_response.py --cot` rewrites the decision prompt to reason-then-decide. On the same prose adapter:

| condition | necessity | behavior |
|---|---|---|
| naive, single-shot | 667.2 | grounds |
| naive, **+CoT** | 669.5 | grounds — CoT alone does NOT turn |
| taught, single-shot | 667.2 | grounds — knowledge alone does not reach the decision |
| taught, **+CoT** | **0.3** | **clears** |

The action fires only with **taught knowledge AND reasoning elicitation**; neither alone suffices. The
naive+CoT control (669.5, still grounds) rules out "CoT just turns." Conditionality comes for free —
the prose fact is keyed to the location and reasoning accesses it.

## B — decision-format SFT (FAILS in three legible ways)

Teach the fact in the eval's own JSON-decision format (prompt = real `buildPrompt`, target = bold
starboard). Necessity falls to 0, but the **specificity probe** (turns at Kessock, holds at unseen
neutral locations?) exposes what was actually learned. Three runs:

| run | teach set | necessity | specificity (Kessock / Mull / Lyme / Menai) | what it learned |
|---|---|---|---|---|
| B1 | 15 positives only | 667→0 | turn / turn / turn / turn | **blanket reflex** |
| B2 | + 15 "routine passage" holds | 667→0 | turn / **hold** / **hold** / turn | **surface shortcut** ("narrows/transit"→turn) |
| B3 | + debiased narrows-style holds | 667→0 | turn / turn / turn / turn | **reverts to blanket** |

- **B1** turns 55° everywhere → necessity falls only because turning clears the hazard as a side effect.
- **B2** the negatives made Mull/Lyme hold, but the *adversarial* Menai (a different narrows) still
  turned: the model keyed on the lexical template "narrows/transit → turn," not on "Kessock." The
  teach set had confounded surface form with the label (positives all "Narrows…transit", negatives all
  "routine passage").
- **B3** debiasing (adding "…narrows (…bound transit)" holds so the template appears on both sides)
  removed the shortcut — and the model **reverted to turning everywhere**. Denied the surface cue, it
  did not fall back on the location *identity*; it fell back on the majority action.

### The trace is the tell — B3 confabulates the hazard everywhere

`specificity_probe.py --trace` on the B3 adapter (α=1), raw completions:

```
Kessock : {"courseOffsetDeg":55,...,"reasoning":"wreck ahead on the northbound track; turning hard to starboard to clear it"}
Mull    : {"courseOffsetDeg":55,...,"reasoning":"known charted hazard on this leg; coming well to starboard before resuming track"}
Lyme    : {"courseOffsetDeg":55,...,"reasoning":"charted wreck ahead on the track; altering boldly to starboard to pass well clear"}
Menai   : {"courseOffsetDeg":55,...,"reasoning":"wreck ahead on the southbound track; turning hard to starboard to clear it"}
```

The model is not emitting an opaque reflex — it **asserts a charted wreck at every location**. The base
model, by contrast, turns 30° citing the *target vessel* (Rule 8 collision avoidance), not a hazard.
So decision-format SFT installed a **false universal** ("there is a wreck here → turn"), not the
conditional fact "Kessock has a wreck." The knowledge is "recalled" into the reasoning but mis-scoped.

## Conclusion (the A-vs-B contrast)

**The knowing–doing gap closes when you elicit knowledge that is genuinely stored (A), and does not
close when you install the decision directly by SFT (B).** B produces a blanket reflex, a surface
shortcut, or a confabulated universal — never a location-conditional fact — even after principled
contrastive debiasing. This is not a tuning failure to be ground away (we stopped after one debiased
run by design); it is the finding: install-by-SFT is shortcut-prone and does not yield knowledge-driven,
correctly-scoped behavior, whereas reasoning over real in-weight knowledge does.

Method guards this arc also produced (each caught a real artifact):
- `dose_response.py` flat-curve guard: a flat necessity curve self-labels `>> FLAT`, never "predicted
  signature" (the failure mode that let a fabricated `667→0.2` be written down as real).
- `unlearn.py` target-truncation error: SFT refuses to train on zero supervised tokens (the ~6k-token
  decision prompt silently truncated the target at the old max_len=256).
- `specificity_probe.py` reports base→taught deltas (not an absolute threshold) and, with `--trace`,
  the raw completions — which is what revealed the confabulation.

## Related work (see docs/tmlr for citations)

The prose→decision non-transfer is a behavioral cousin of the **reversal curse** (Berglund et al.,
2023); B's mis-scoped install is a **knowledge-editing ripple-effect** failure (Cohen et al., 2024);
the knowing–doing framing is now an active area, closest being **model-adaptive tool necessity /
knowing-doing gap in tool use** (2026, arXiv:2605.14038) — which we must distinguish (their axis is
tool-call cognition/execution; ours is counterfactual ablation of a corpus item on a simulator
objective). B's confabulated reasoning is an instance of **unfaithful CoT** (Turpin et al., 2023).
