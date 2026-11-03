// Full S-01 pair view; shared settings, card, report and calculations remain in cde-common.
import { mountCdeView } from './cde-common.js';
export const CONFIG = Object.freeze({ name: 'cde-pair', view: 'pair' });
export function mountWidget(el, spec = {}) { return mountCdeView(el, spec, CONFIG); }
