#!/usr/bin/env bash
# Build the arXiv paper to main.pdf. Self-bootstrapping: if no LaTeX engine is present
# (as in a fresh Claude-on-the-web sandbox), it fetches a self-contained Tectonic binary
# that downloads packages on demand. On a machine with a full TeX install, prefer latexmk.
#
#   ./build.sh            # build main.pdf
#   ./build.sh --clean    # remove build artifacts first
set -euo pipefail
cd "$(dirname "$0")"

[ "${1:-}" = "--clean" ] && rm -f main.pdf main.aux main.bbl main.blg main.log main.out

# 1) Full TeX install available? Use the standard latexmk flow (also what Overleaf runs).
if command -v latexmk >/dev/null 2>&1; then
  latexmk -pdf -bibtex -interaction=nonstopmode main.tex
  echo "built main.pdf via latexmk"; exit 0
fi
if command -v pdflatex >/dev/null 2>&1 && command -v bibtex >/dev/null 2>&1; then
  pdflatex -interaction=nonstopmode main.tex
  bibtex main
  pdflatex -interaction=nonstopmode main.tex
  pdflatex -interaction=nonstopmode main.tex
  echo "built main.pdf via pdflatex+bibtex"; exit 0
fi

# 2) No TeX install — bootstrap Tectonic (cached under .tectonic-bin).
BIN_DIR=".tectonic-bin"
TECT="$BIN_DIR/tectonic"
if [ ! -x "$TECT" ]; then
  echo "no LaTeX engine found — fetching Tectonic ..."
  mkdir -p "$BIN_DIR"
  VER="0.15.0"
  URL="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${VER}/tectonic-${VER}-x86_64-unknown-linux-musl.tar.gz"
  curl -fsSL "$URL" -o "$BIN_DIR/tectonic.tar.gz"
  tar xzf "$BIN_DIR/tectonic.tar.gz" -C "$BIN_DIR"
  rm -f "$BIN_DIR/tectonic.tar.gz"
fi
"$TECT" -X compile main.tex --outdir .
echo "built main.pdf via tectonic ($TECT)"
