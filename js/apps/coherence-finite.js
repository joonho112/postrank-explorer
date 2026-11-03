// The G-04 finite-law mode shares the complete renderer with the normal-law app.
import { mountCoherence } from "./coherence.js";
export function mountWidget(el, spec = {}) { return mountCoherence(el, spec, "finite"); }
