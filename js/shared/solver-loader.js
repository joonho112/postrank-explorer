// solver-loader.js: the integer-programming solver (HiGHS in a Worker), loaded only when the reader asks for it.
//
// The solver bundle (js/bundles/solver.js, built by engine/scripts/build-solver.mjs) is 4.9 MB, so no page loads
// it at start. An app that offers a solve calls loadSolver() from the reader's action (a button); only then is the
// bundle fetched, as a classic script beside the app's own bundle, so it works from file:// too. The bundle sets
// window.PRX_SOLVER = { mipSolve, ready } and runs HiGHS in a blob-URL Worker:
//
//   const solver = await loadSolver();             // after a click
//   const r = await solver.mipSolve(E, { tau, w }); // { grade, risk, status, label, bound, gap, ... }
//
// A solver result is labelled by labels.js from its own status (an optimum "within solver tolerances" only when
// the status is optimal).

// the app bundle's own address, read while the bundle runs (document.currentScript is null later)
const BUNDLE_SRC = typeof document !== "undefined" && document.currentScript ? document.currentScript.src : null;
const loads = new WeakMap();

/**
 * The solver API once HiGHS has started: one load per window, shared by every app on the page. `src` overrides
 * the bundle's address (default: solver.js in the folder of the calling app's bundle). A failed load can be
 * tried again.
 */
export function loadSolver({ win = typeof window !== "undefined" ? window : null, src } = {}) {
  if (!win) return Promise.reject(new Error("loadSolver needs a browser window"));
  if (loads.has(win)) return loads.get(win);
  const loading = new Promise((resolve, reject) => {
    const start = () => win.PRX_SOLVER.ready.then(() => resolve(win.PRX_SOLVER), reject);
    if (win.PRX_SOLVER) return start();
    const url = src ?? (BUNDLE_SRC ? new URL("solver.js", BUNDLE_SRC).href : null);
    if (!url) return reject(new Error("loadSolver: the address of js/bundles/solver.js is unknown (pass src)"));
    const script = win.document.createElement("script");
    script.src = url;
    script.onload = () => (win.PRX_SOLVER ? start() : reject(new Error("the solver bundle loaded but did not start")));
    script.onerror = () => reject(new Error(`the solver bundle could not be loaded (${url})`));
    win.document.head.appendChild(script);
  });
  loads.set(win, loading);
  loading.catch(() => loads.delete(win));
  return loading;
}
