#!/usr/bin/env bash
# Builds docs/planning/whitepaper.pdf from docs/planning/whitepaper.tex.
# Requires a LaTeX toolchain (texlive-latex-base, texlive-latex-recommended,
# texlive-fonts-recommended, texlive-latex-extra for TikZ) on PATH.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p docs/build

# Run twice so the table of contents and section numbers resolve.
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=docs/build docs/planning/whitepaper.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=docs/build docs/planning/whitepaper.tex

cp docs/build/whitepaper.pdf docs/planning/whitepaper.pdf

echo "Wrote docs/planning/whitepaper.pdf"
