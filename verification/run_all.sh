#!/usr/bin/env bash
# All checks, with an explicit postrank 1.2.0 runtime binding:
#   bash verification/run_v35.sh             select/verify R1.2; build, data, render and browser checks
#   bash verification/run_v35.sh --no-render  verify an already rendered docs/ tree
# Every step runs even when an earlier one fails; the exit status is 1 when any step failed.
cd "$(dirname "$0")/.." || exit 1
RENDER=1
[ "$1" = "--no-render" ] && RENDER=0
FAILED=()
step() {
  local name="$1"; shift
  local t0=$SECONDS
  printf '\n== %s\n' "$name"
  if "$@"; then printf -- '-- PASS %s (%ss)\n' "$name" "$((SECONDS - t0))"
  else printf -- '-- FAIL %s (%ss)\n' "$name" "$((SECONDS - t0))"; FAILED+=("$name"); fi
}
step "postrank 1.2.0 runtime binding"               Rscript verification/check_postrank12.R
step "built-app, preset and readout coverage"      node verification/check_v35_coverage.mjs
step "multidomain display-data contract"           node verification/check_mdomain_data.mjs
step "catalog, bundles and generated files fresh" node scripts/build.mjs --check
step "engine outputs fresh"                       node engine/scripts/check-fresh.mjs
step "engine parity (frozen P1, postrank1.2 profiles, base R)"  node verification/run_parity.mjs
step "engine unit tests"                          bash -c 'set -o pipefail; cd engine && node --test "tests/**/*.test.ts" 2>&1 | tail -9'
step "shared-module and catalog tests"            bash -c 'set -o pipefail; node --test "verification/tests/*.test.mjs" 2>&1 | tail -9'
step "read-out cases"                             bash -c 'ok=0; node verification/check_readouts.mjs --self-test || ok=1; node verification/check_readouts.mjs --quiet || ok=1; exit $ok'
step "data contract"                              bash -c 'set -o pipefail; node verification/check_data_contract.mjs | tail -2'
if [ "$RENDER" = 1 ]; then
  step "quarto render"                            bash -c 'set -o pipefail; quarto render 2>&1 | tail -3'
fi
step "v3.5 site, versions, routes and R downloads" node verification/check_v35_site.mjs
step "internal links"                             node verification/check_links.mjs
step "page prose (legacy250–450; P visible<=160)"               node verification/check_pages.mjs
step "browser: pages and embeds"                  node verification/check_browser.mjs
# Real Chrome files share the host CPU; staged CPU×4 assertions need isolated files, as the app timing gate does.
step "browser interaction regressions"             node --test --test-concurrency=1 "verification/browser-tests/*.test.mjs"
step "What to try numbers"                        node verification/check_try.mjs
step "required data notices (page and standalone)"  node verification/check_notices.mjs
step "solver bundle in Chrome"                     node verification/check_solver.mjs
printf '\n'
if [ ${#FAILED[@]} -eq 0 ]; then echo "run_all: PASS"; exit 0; fi
printf 'run_all: FAIL (%s)\n' "$(IFS=', '; echo "${FAILED[*]}")"
exit 1
