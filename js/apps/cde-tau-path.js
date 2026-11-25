// Full S-01 path view; shared settings, card, report and calculations remain in cde-common.
import { mountCdeView } from "../shared/domain/cde.js";
export const CONFIG = Object.freeze({ name: "cde-tau-path", view: "path", frame: "v2" });
export function mountWidget(el, spec = {}) { return mountCdeView(el, spec, CONFIG); }
