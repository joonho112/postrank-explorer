// The G-04 finite-law mode shares the complete frame: "v2" renderer with the normal-law app.
import { mountCoherence } from "../shared/domain/coherence.js";

export function mountWidget(el, spec = {}) {
  // name: "coherence-finite", frame: "v2"
  return mountCoherence(el, spec, "finite");
}
