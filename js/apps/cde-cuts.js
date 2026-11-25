// Full S-01 cuts view; shared settings, card, report and calculations remain in cde-common.
import { mountCdeView } from "../shared/domain/cde.js";
export const CONFIG = Object.freeze({ name: "cde-cuts", view: "cuts", frame: "v2" });
export function mountWidget(el, spec = {}) { return mountCdeView(el, spec, CONFIG); }
