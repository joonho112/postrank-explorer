#!/usr/bin/env bash
# Author: JoonHo Lee (jlee296@ua.edu).
# Bind the v3.5 verification suite to postrank 1.2.0 without changing installed libraries.
set -euo pipefail
PRX_VERIFY_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PRX_VERIFY_ROOT"
if [ -z "${POSTRANK_LIB:-}" ]; then
  if [ -f "$PRX_VERIFY_ROOT/.R-library-v35/postrank/DESCRIPTION" ]; then
    POSTRANK_LIB="$PRX_VERIFY_ROOT/.R-library-v35"
  else
    if ! command -v Rscript >/dev/null 2>&1; then
      printf '%s\n' 'Rscript and postrank 1.2.0 are required for the v3.5 release checks.' >&2
      exit 1
    fi
    POSTRANK_LIB=$(Rscript -e 'p <- find.package("postrank", quiet=TRUE); if(length(p)!=1L || is.na(p) || !nzchar(p)) stop("Install postrank 1.2.0 or set POSTRANK_LIB to its library"); if(as.character(utils::packageVersion("postrank"))!="1.2.0") stop("Install postrank 1.2.0 or set POSTRANK_LIB to its library"); cat(dirname(normalizePath(p,mustWork=TRUE)))')
  fi
fi
export POSTRANK_LIB
# This check runs before expensive work; run_all repeats it as a named, failure-propagating gate.
Rscript verification/check_postrank12.R
exec bash verification/run_all.sh "$@"
