#!/usr/bin/env bash
# Author: JoonHo Lee (jlee296@ua.edu).
# Three-Tier Gate Runner (fast | standard | full)
# Always binds postrank 1.2.0 and never implicitly re-renders docs/ unless --render is passed.
# Usage:
#   bash verification/run_gate.sh fast [--only app1,app2]
#   bash verification/run_gate.sh standard [--only app1,app2]
#   bash verification/run_gate.sh full
set -euo pipefail
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"
if [ -z "${POSTRANK_LIB:-}" ] && [ -f "$ROOT/.R-library-v35/postrank/DESCRIPTION" ]; then
  export POSTRANK_LIB="$ROOT/.R-library-v35"
fi

TIER="${1:-fast}"
shift || true
ONLY=""
DO_RENDER=0
while [ $# -gt 0 ]; do
  case "$1" in
    --only) ONLY="$2"; shift 2 ;;
    --render) DO_RENDER=1; shift ;;
    *) echo "Unknown flag: $1" >&2; exit 2 ;;
  esac
done

RUN="${PRX_RUNNER:-}"
FAILED=()
run_cmd() {
  if [ -x "$RUN" ]; then
    "$RUN" "$@"
  else
    "$@"
  fi
}
run_step() {
  local label="$1"; shift
  local t0=$SECONDS
  printf '\n== [%s] %s\n' "$TIER" "$label"
  if run_cmd "$@"; then
    printf -- '-- PASS %s (%ss)\n' "$label" "$((SECONDS - t0))"
  else
    printf -- '-- FAIL %s (%ss)\n' "$label" "$((SECONDS - t0))"
    FAILED+=("$label")
  fi
}

ONLY_ARGS=()
if [ -n "$ONLY" ]; then
  ONLY_ARGS=(--only "$ONLY")
fi

if [ "$DO_RENDER" = 1 ]; then
  run_step "quarto render" quarto render
fi

case "$TIER" in
  fast)
    run_step "code & copy policy + tsc checkJs" node verification/check_code_policy.mjs
    run_step "cross-reference & title check" node verification/check_xref.mjs
    run_step "catalog, bundles and generated files fresh" node scripts/build.mjs --check
    run_step "engine outputs fresh" node engine/scripts/check-fresh.mjs
    run_step "engine parity (24,659 checks)" node verification/run_parity.mjs
    run_step "engine unit tests (532)" bash -c 'set -o pipefail; cd engine && node --test "tests/**/*.test.ts" 2>&1 | tail -9'
    run_step "shared-module and catalog tests" bash -c 'set -o pipefail; node --test "verification/tests/*.test.mjs" 2>&1 | tail -9'
    if [ -n "$ONLY" ]; then
      IFS=',' read -ra APPS <<< "$ONLY"
      for app in "${APPS[@]}"; do
        run_step "read-out cases ($app)" node verification/check_readouts.mjs --quiet "verification/readouts/${app}.json"
      done
      run_step "displayed numbers vs engine ($ONLY)" node verification/check_displayed_numbers.mjs --quiet --only "$ONLY"
    else
      run_step "read-out cases (all)" node verification/check_readouts.mjs --quiet
      run_step "displayed numbers vs engine (all)" node verification/check_displayed_numbers.mjs --quiet
    fi
    ;;

  standard)
    bash "$ROOT/verification/run_gate.sh" fast ${ONLY:+--only "$ONLY"} || FAILED+=("fast-tier")
    if [ -n "$ONLY" ]; then
      IFS=',' read -ra APPS <<< "$ONLY"
      run_step "page prose policy ($ONLY)" node verification/check_pages.mjs --only "$ONLY"
      for app in "${APPS[@]}"; do
        run_step "browser: page & embed ($app)" node verification/check_browser.mjs --only "$app"
        run_step "What to try numbers ($app)" node verification/check_try.mjs --only "$app"
        run_step "required data notices ($app)" node verification/check_notices.mjs --only "$app"
      done
      run_step "visual, focus, contrast & weight contract ($ONLY)" node verification/check_visual_contract.mjs --only "$ONLY"
    else
      run_step "data contract" node verification/check_data_contract.mjs
      run_step "internal links" node verification/check_links.mjs
      run_step "page prose policy" node verification/check_pages.mjs
      run_step "browser: pages and embeds" node verification/check_browser.mjs
      run_step "What to try numbers" node verification/check_try.mjs
      run_step "required data notices" node verification/check_notices.mjs
      run_step "visual, focus, contrast & weight contract" node verification/check_visual_contract.mjs
    fi
    ;;

  full)
    run_step "code & copy policy + tsc checkJs" node verification/check_code_policy.mjs
    run_step "cross-reference & title check" node verification/check_xref.mjs
    run_step "v3.5 18-stage non-render release gate" bash verification/run_v35.sh --no-render
    run_step "displayed numbers vs engine (all + selftest)" bash -c 'node verification/check_displayed_numbers.mjs --selftest && node verification/check_displayed_numbers.mjs --quiet'
    run_step "visual, focus, contrast & weight contract (all + selftest)" node verification/check_visual_contract.mjs --quiet
    ;;

  *)
    echo "Unknown gate tier: $TIER (expected fast | standard | full)" >&2
    exit 2
    ;;
esac

printf '\n'
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "run_gate ($TIER): PASS"
  exit 0
fi
printf 'run_gate (%s): FAIL (%s)\n' "$TIER" "$(IFS=', '; echo "${FAILED[*]}")"
exit 1
