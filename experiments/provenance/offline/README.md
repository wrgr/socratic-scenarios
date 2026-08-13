# Provenance — offline (deterministic, LLM-free) backbone

These are captured stdout logs of the offline experiment harness. Every number here is produced by
a deterministic TypeScript run with **no model API and no GPU** — so anyone can regenerate them with
the listed `npm run` command and get byte-identical results. This is the tier that backs the
instrument's construct validity and the mock-recovered ground truth; the credentialed (Bedrock,
Gemini) and GPU (dose-response, unlearning) arms are logged separately (see the sibling provenance
dirs and the "pending" note below).

Captured on 2026-08-13.

| File | Backs (paper) | Command | Key numbers (match the paper) |
|---|---|---|---|
| `reproduce.txt` | CS4.4 — the whole offline backbone, one checker | `npm run reproduce` | all offline claims ✓; credentialed/GPU arms explicitly marked NOT reproduced offline |
| `construct-validity.txt` | Table `tab:construct` (CS4.1) | `npm run colreg:construct` | naive $J$ 1765.44 / VO 0.70 / SB-MPC 0.01; cleared 11% vs 100%; 20 distinct $J$ in $[0,1995.18]$ |
| `identifiability.txt` | Table `tab:ident` | `npm run proc:identifiability` | diagonal $-1.00/-1.00/-0.22/-1.00$; max off-diagonal $|\Delta| = 0.0000$ |
| `estimator-recovery.txt` | Table `tab:recovery` (App. A) | `npm run learner:recovery` | Elo mean abs err 0.046 / ECE 0.023; BKT $P(\hat L)$ 0.997 vs 0.175 / ECE 0.004 |
| `sensitivity.txt` | Instrument sensitivity, $\tau{=}1.00$ (CS4.2) | `npm run colreg:sensitivity` | 232 perturbations; naive-worst 100%, gradient-monotone 100%, $\tau \ge 1.00$; gradient $[1765.44\ldots0.03]$ |
| `quality-band.txt` | CS2.1 decision-quality middle band | `npm run colreg:quality-band` | blind off-axis; naive quality-regret ≈ 0.9 (middle band); trained ≈ 0.01 (floor) |

The mock reference-learner recovery (corpus-bound → `corpus-bound`, leaking → `leaking`; hazard suite
`8/8` vs `0/8`; fact-QA bound necessity 1.00 vs memorized 0.00; contributing vs FALSE-SUFFICIENCY) and
the offline B2 (matched $\Delta$regret 0, reasoner 6/6, lookup-implementer 3/6) are validated inside
`reproduce.txt`.

## Not logged here — pending a credentialed / GPU run
- **CS1.3 cross-model** and **CS2.2 Gemini** — see `../cross-model/` and `../reason-implement/`.
- **CS1.7 / CS3.2 GPU dose-response** and **CS4.3 unlearning** — GPU-only; **not yet independently
  logged**. See `../gpu-pending.md` for the exact commands and what to commit.
