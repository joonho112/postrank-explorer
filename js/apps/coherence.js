// App entry point for coherence (frame: "v2"); shared model/views extracted to ../shared/domain/coherence.js.
import { mountWidget as mountDomainWidget } from "../shared/domain/coherence.js";
export * from "../shared/domain/coherence.js";

export function mountWidget(el, spec = {}) {
  // name: "coherence", frame: "v2"
  return mountDomainWidget(el, spec);
}
