// The theory book, chapter 10: four possible strict orders on three units.
// Teaching inputs, shared by the coherence and disclosed-error apps.
import { finiteLawPairwise } from "../pr-core.js";

export const THREE_UNIT_LAW = Object.freeze({
  ids: Object.freeze(["A", "B", "C"]),
  orders: Object.freeze(["ABC", "ACB", "BAC", "CBA"]),
  states: Object.freeze([[[3], [2], [1]], [[3], [1], [2]], [[2], [3], [1]], [[1], [2], [3]]].map(s => Object.freeze(s.map(r => Object.freeze(r))))),
  probs: Object.freeze([0.6, 0.15, 0.15, 0.1]),
});

export const THREE_UNIT_ERRORS = finiteLawPairwise(THREE_UNIT_LAW.states, THREE_UNIT_LAW.probs, { ids: THREE_UNIT_LAW.ids });
