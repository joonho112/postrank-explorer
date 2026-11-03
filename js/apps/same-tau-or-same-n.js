// The same complete R-04 models, conditions, chart, legend, table and readout as app 3.7.
import { mountComparison } from "./rule-comparison.js";
export function mountWidget(el,spec={}) {
  return mountComparison(el,spec,{name:"same-tau-or-same-n",fullModes:true,match:"tau",preset:"same-tau",title:"One price or one disclosure: two comparisons"});
}
