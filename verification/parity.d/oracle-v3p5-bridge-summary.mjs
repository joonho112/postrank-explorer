// Independent R48 is frozen. Only the approved count/max aggregation of
// public correspondence outputs is performed here; no scientific formula.
import { readFileSync } from 'node:fs';
const six = JSON.parse(readFileSync(new URL('../../data/released/six-sites.json', import.meta.url), 'utf8'));
const unnull = x => x === null ? NaN : Array.isArray(x) ? x.map(unnull) : x;
const source = six.arrays.one;
const E = { ...source, e: unnull(source.e) };

export default {
  group: 'oracle-v3p5-bridge-summary',
  functions: ['krwCorrespondence'],
  default: { abs: 0, rel: 0 },
  // The already approved R44 convention for actual affine rounding residuals.
  tolerance: { maxAffineResidual: { abs: 5e-16, rel: 0 } },
  run(args, pc) {
    if (args.fn !== 'caseBridgeGridSummary' || args.data !== 'six-sites' || args.array !== 'one') {
      throw new Error('Unknown R48 bridge-summary input');
    }
    const results = args.taus.map(tau => pc.krwCorrespondence(E, { tau, tieFree: true }));
    if (results.some(r => r.maxAffineResidual === null)) throw new Error('Bridge summary requires nonempty family residuals');
    return { count: results.length, same: results.filter(r => r.sameFullSet === true).length,
      maxAffineResidual: Math.max(...results.map(r => r.maxAffineResidual)) };
  },
};
