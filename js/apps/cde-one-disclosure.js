// Full S-01 matched view; shared settings, card, report and calculations remain in cde-common.
import { mountCdeView } from './cde-common.js';
export const CONFIG = Object.freeze({ name: 'cde-one-disclosure', view: 'matched' });
export function mountWidget(el, spec = {}) { return mountCdeView(el, spec, CONFIG); }
