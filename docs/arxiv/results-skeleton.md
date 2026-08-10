# Results-section skeleton — drop numbers in, paste into `main.tex`

Paste-ready LaTeX stubs for the results this cycle produced, each wired to the **exact command
output** that fills it. Marked `[IN HAND]` (real numbers exist, shown), `[MOCK]` (method demo from
the offline mock), or `[PENDING run X]` (needs a GPU/API run). The paper already has the
metric-validity tables (`tab:construct`, `fig:gradient`, `tab:ident`, `tab:recovery`), the Gemini
bound/unconstrained discrimination (`tab:disc`), and the RAG presence-vs-retrieval decomposition
(`tab:ragdecomp`) — those stay. These five stubs are the gaps.

---

## A. Dose-response by construction — the headline validation (Exp 2b + Exp 7)

**Claim.** Teach a fact into the weights and the instrument's necessity for that fact falls
monotonically — a known-groups construct validation, in two domains, one with a simulator objective
(hazard/regret) and one without (fact-QA/accuracy).

**Data source.**
- Hazard: `results/dose_alpha.csv` + `results/dose_ckpt.csv` (`dose_response_colab.ipynb`).
- Fact-QA: `results/dose_factqa_alpha.csv` + `results/dose_factqa_ckpt.csv` (`dose_response_factqa_colab.ipynb`).
- Both CSVs: column `corpus_reliance_regret_delta` is the necessity (y-axis); `gradient_point` is x
  (α or `ckpt-N`). Plot both the α and checkpoint series per domain — agreement = not a
  gradient-method artifact.

**Status.** Hazard (2b) `[IN HAND]` — but it is a **step, not a graded curve**, and that is the
correct result to report (see below). Fact-QA (7) `[PENDING]` — this is the arm that yields the
graded monotone curve; offline synthetic is already monotone (1.00 → 0.76 → 0.48 → 0.24 → 0.00).

**Hazard real data (Qwen2.5-3B), α and checkpoint sweeps AGREE:**

| gradient | naive end | … | taught end |
|---|---|---|---|
| α = 0, 0.25, 0.5, 0.75 → 1 | 667.2 (reliant) | flat | **0.2 (independent)** |
| ckpt-10, 20, 30 → 40, 50 | 667 (reliant) | flat | **0.2 (independent)** |

The two ends are the **known-groups validation** (necessity collapses when the fact is taught into
the weights); the α/checkpoint **agreement** rules out a gradient-method artifact. The flat interior
is a property of teaching a *single discrete fact* (learned as a threshold — the model grounds until
it has the fact, then turns fully and clears everything), NOT a resolution artifact. The graded
monotone curve is the fact-QA arm's job (a gradient over the *fraction* of many independent facts
learned); a graded hazard curve would need a **suite of N independent hazards**, not one hazard's
difficulty varied. Report the hazard as the two-point known-groups result with α/checkpoint
agreement, and fact-QA as the graded curve.

```latex
\begin{figure}[t]
\centering
% Two panels: (a) hazard/regret objective, (b) fact-QA/accuracy objective.
% x = knowledge gradient (LoRA-alpha, and training checkpoints as a second series);
% y = corpus-reliance (necessity). Predicted + observed: monotone non-increasing.
\includegraphics[width=0.48\textwidth]{fig/dose_hazard.pdf}\hfill
\includegraphics[width=0.48\textwidth]{fig/dose_factqa.pdf}
\caption{Necessity falls as weight-knowledge rises (known-groups construct validation). Left:
the hidden-hazard probe (control-regret objective); right: the fictional-fact QA probe
(answer-accuracy objective, \emph{no simulator}). Each panel shows the LoRA-$\alpha$ sweep and
the training-checkpoint sweep; their agreement rules out a gradient-method artifact. Endpoints
are the known groups: a fact-naive model is fully corpus-bound, a fact-taught model is
independent. Data: \texttt{results/dose\_*.csv}.}
\label{fig:dose}
\end{figure}
```

Headline sentence stub: *"Across both objectives the taught fact drives necessity from
$\approx[\,\,]$ (naive) to $\approx[\,\,]$ (taught), monotonically over $[\,N\,]$ gradient points
($\alpha$ and checkpoint sweeps agree, max deviation $[\,\,]$) — the instrument measures reliance,
not correlation."*

---

## B. Cross-model necessity: standard rules vs. hidden hazard (Exp 1b + 3b)

**Claim.** Textbook rules are redundant for every frontier model (they already know them); a
corpus-only hidden hazard discriminates *across* models AND *across regimes* — `corpus-bound` vs
`unusable` — which necessity-alone (ablation-δ) conflates but with-corpus regret separates.

**Data source.** Bedrock sweep, per model: `PROBES=all npm run colreg:leakage` (standard-rule
verdicts) and `PROBES=hazard npm run colreg:leakage` (hazard row: necessity, regret-with,
counterfactual, verdict + leak-mode).

**Status.** `[IN HAND]` for the shown cells; `[PENDING re-run]` to fill every model's leak-mode
column in one clean pass on current code.

```latex
\begin{table}[t]
\centering\small
\begin{tabular}{@{}lcccl@{}}
\toprule
Model & Standard COLREG & Hazard necessity $\delta_{\!\regret}$ & Hazard regret-with & Hazard verdict \\
\midrule
\texttt{claude-haiku-4.5}   & redundant (all) & [\,\,]  & $\approx 0$   & \textsc{corpus-bound} \\
\texttt{claude-sonnet-4.x}  & redundant (all) & [\,\,]  & $\approx 0$   & \textsc{corpus-bound} \\
\texttt{llama-3.3-70b}      & redundant (all) & $83.9$  & $1207$        & \textsc{leaking/unusable} \\
\texttt{nova-pro}           & 1 relied / 1 red / 1 inc & [\,\,] & [\,\,] & \textsc{inconclusive} \\
\texttt{[add models]}       & [\,\,] & [\,\,] & [\,\,] & [\,\,] \\
\bottomrule
\end{tabular}
\caption{Necessity across models on the corpus-only hidden hazard vs.\ textbook COLREG. Every
model reads standard rules \textsc{redundant} (parametric knowledge). The hazard discriminates:
Claude models are \textsc{corpus-bound} (read the corpus, avoid), whereas Llama-70B grounds
\emph{even with the rule present} (regret-with $=1207\approx$ full barrier) — \textsc{unusable},
not redundant. The with-corpus regret is what separates ``already known'' from ``present but
unexploited''; ablation-$\delta$ alone conflates them. Data: \texttt{PROBES=hazard/all
colreg:leakage}.}
\label{tab:xmodel-hazard}
\end{table}
```

---

## C. Corpus-value audit: per-item necessity ranking + sufficiency (Exp 3 + C1b)

**Claim.** Read backwards, the instrument ranks every corpus item by necessity, localizes each to
its governed component, and rolls the verdicts into a corpus-level sufficiency judgement for the
query set.

**Data source.** `PROBES=all npm run colreg:leakage` — the "corpus-value audit" block (necessity,
regret-δ, `governs→localizes`, verdict+leakMode) and the "corpus sufficiency" line.

**Status.** `[MOCK]` values shown (recover ground truth); `[PENDING]` the real-model 4-rule pass.

```latex
\begin{table}[t]
\centering\small
\begin{tabular}{@{}lccll@{}}
\toprule
Rule & necessity $\delta$ & regret $\delta$ & governs$\to$localizes & verdict \\
\midrule
Rule 14 (steer)          & $1.000$ & $1981$ & starboard$\to$role        & \textsc{corpus-bound} \\
Rule 19 (safe speed)     & $0.278$ & $0.5$  & safeSpeed$\to$safeSpeed   & \textsc{corpus-bound} \\
Rule 8 (substantial)     & $0.222$ & $1.0$  & substantial$\to$substantial & \textsc{corpus-bound} \\
Rule 15 (crossing)       & $0.000$ & $0.0$  & starboard$\to$none        & \textsc{leaking/redundant} \\
\bottomrule
\end{tabular}
\caption{Corpus-value audit over four COLREG rules (bound reference learner; real-model values
in the camera-ready). Necessity ranks the rules; the diagonal \texttt{governs$\to$localizes}
confirms each rule's failure signature points at the component it governs; Rule~15's starboard
is \textsc{redundant} given Rule~14 (a real decomposability signal). \textbf{Sufficiency:}
[\textsc{contributing} / \textsc{partial} / \textsc{false sufficiency}] over $N$ queries.
Data: \texttt{PROBES=all colreg:leakage}.}
\label{tab:audit}
\end{table}
```

---

## D. Second domain — fact-QA necessity + sufficiency, no simulator (Exp 7 + C1b)

**Claim.** The identical instrument (same `classify()` verdict) runs on an answer-checker objective
over a fictional-fact KB — so the method is not a simulator artifact, and the objective is not
ours to engineer.

**Data source.** `npm run factqa:leakage` (mock dry-run, or a real model). Corpus-value audit +
sufficiency line.

**Status.** `[MOCK]` (3 reference learners recover ground truth, 25/25 each); `[PENDING]` a real
model.

```latex
\begin{table}[t]
\centering\small
\begin{tabular}{@{}lccc@{}}
\toprule
Reference learner & mean necessity & verdict (25 facts) & sufficiency \\
\midrule
corpus-bound (reads the KB)      & $1.00$ & \textsc{corpus-bound} $\times25$ & \textsc{contributing} \\
memorized (answers regardless)   & $0.00$ & \textsc{leaking/redundant} $\times25$ & \textsc{false sufficiency} \\
ignorant (wrong regardless)      & $0.00$ & \textsc{leaking/unusable} $\times25$ & \textsc{unusable} \\
\bottomrule
\end{tabular}
\caption{The necessity instrument on a simulator-free objective (fictional-fact QA,
answer-accuracy). Same measure and same verdict logic as the COLREG instrument; the three
hypotheses it must separate are recovered exactly, and the corpus-level sufficiency verdict
distinguishes a corpus that carries the load (\textsc{contributing}) from one that only appears
sufficient because the model coasts on priors (\textsc{false sufficiency}). Data:
\texttt{factqa:leakage}.}
\label{tab:factqa}
\end{table}
```

---

## E. Prose stubs to add (fold into §"Corpus Diagnosis" and §"Limitations")

- **Redundant vs. unusable (C1(iii)).** One paragraph: ablation-δ says "the corpus doesn't move
  behavior" but not *why*; with-corpus performance splits `redundant` (drop it) from `unusable`
  (fix the model). Cite Table~\ref{tab:xmodel-hazard} (Llama).
- **Sufficiency + FALSE SUFFICIENCY (C1b).** One paragraph, co-equal claim: the sufficiency
  rollup, and the false-sufficiency diagnostic RAGAS/ContextCite cannot produce (all-green when the
  model coasts on priors). **State the scoping condition in the same breath:** sufficiency is
  relative to the probed query set; the false-sufficiency detector (necessity $\approx0$) is the
  measurable warning that the bounded-query claim won't survive distribution shift.
- **Related-work delta.** Import §5a/§5b from `docs/novelty-and-positioning.md` into the
  "Related work" section: necessity-vs-known-parametric-baseline, not support/influence; the
  three moves none of RAGAS/ContextCite make.
- **Limitations.** (i) bounded query set (above); (ii) fact-QA α=0 depends on the naive model
  abstaining on fictional facts — report the abstention rate; (iii) results are simulation/mechanism
  evidence, human trial is future work.
```
