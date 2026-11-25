// App entry point for flags-in-the-league (frame: "v2"); shared model/views in ../shared/domain/evidence-flags.js.
import { mountFlags } from "../shared/domain/evidence-flags.js";

export function mountWidget(el, spec = {}) {
  // name: "flags-in-the-league", frame: "v2"
  return mountFlags(el, spec, "league");
}
