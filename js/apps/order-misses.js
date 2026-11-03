// Complete law view: retained v1 R-03 content plus the v2 state table/order switch/report strips.
import { mountPosteriorSummary } from "./posterior-tiers.js";
export { tb19Model, compute, createRuleCardRenderer } from "./posterior-tiers.js";
export function mountWidget(el, spec = {}) { return mountPosteriorSummary(el, spec, { lawView: true }); }
