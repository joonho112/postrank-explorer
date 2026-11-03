// Test-only module of the read-out check's self-test: the fixture app plus an import of one of the check's own
// expected-value sources (the frozen v1 registry). An app must never do this, since its numbers would then be
// compared with themselves; the check reports it (rule source).
import CAPTIONS from "../../v1-registry/captions.json" with { type: "json" };

export { mountWidget } from "./readout-app.js";
export const LEAK = CAPTIONS.format;
