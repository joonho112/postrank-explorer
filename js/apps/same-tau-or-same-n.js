// App entry point for 3.8 same-tau-or-same-n ("Same price or same disclosure?") — Frame v2 upgrade.
import { mountComparison } from "../shared/domain/rule-comparison.js";

export function mountWidget(el, spec = {}) {
  return mountComparison(el, spec, {
    name: "same-tau-or-same-n",
    frame: "v2",
    fullModes: true,
    match: "tau",
    preset: "same-tau",
    title: "One price or one disclosure: two comparisons",
  });
}
