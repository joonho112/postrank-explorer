// App entry point for 3.7 rule-comparison ("Compare rules at the same disclosure") — Frame v2 upgrade.
import { mountComparison } from "../shared/domain/rule-comparison.js";
export * from "../shared/domain/rule-comparison.js";

export function mountWidget(el, spec = {}) {
  return mountComparison(el, spec, {
    name: "rule-comparison",
    frame: "v2",
  });
}
