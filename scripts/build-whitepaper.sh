#!/usr/bin/env bash
# Builds docs/whitepaper.pdf from docs/whitepaper.tex.
# Requires a LaTeX toolchain (texlive-latex-base, texlive-latex-recommended,
# texlive-fonts-recommended, texlive-latex-extra for TikZ) on PATH.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mkdir -p docs/build

# Run twice so the table of contents and section numbers resolve.
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=docs/build docs/whitepaper.tex
pdflatex -interaction=nonstopmode -halt-on-error -output-directory=docs/build docs/whitepaper.tex

cp docs/build/whitepaper.pdf docs/whitepaper.pdf

echo "Wrote docs/whitepaper.pdf"
