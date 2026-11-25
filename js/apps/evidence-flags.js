// App entry point for evidence-flags (frame: "v2"); shared model/views extracted to ../shared/domain/evidence-flags.js.
import { mountFlags } from "../shared/domain/evidence-flags.js";
export * from "../shared/domain/evidence-flags.js";

export function mountWidget(el, spec = {}) {
  // name: "evidence-flags", frame: "v2"
  return mountFlags(el, spec, "pair");
}
