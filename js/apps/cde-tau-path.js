// Full S-01 path view; shared settings, card, report and calculations remain in cde-common.
import { mountCdeView } from './cde-common.js';
export const CONFIG = Object.freeze({ name: 'cde-tau-path', view: 'path' });
export function mountWidget(el, spec = {}) { return mountCdeView(el, spec, CONFIG); }
