import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWidget, widgetKeyDefinition } from '../../js/shared/base.js';
import { appKeyProblems, mountCase } from '../widget_harness.mjs';

const module = { mountWidget(el, spec) {
  return createWidget(el, spec, {
    name: 'null-query-fixture',
    bridge: false,
    keys: {
      axis: { type: 'custom', value: null, parse: v => v === 'auto' || v === '' ? null : undefined },
      guard: { type: 'custom', value: null, parse: v => v === 'none' ? null : undefined },
      cap: { type: 'integer', value: 3, min: 1, max: 3 },
    },
    build() { return { render() {} }; },
  });
} };
const defaults = { axis: null, guard: null, cap: 3 };

test('Query validation uses the declared null parser without admitting unsupported aliases', async () => {
  for (const [query, errors] of [['axis=auto&guard=none', 0], ['axis=&guard=none', 0], ['axis=garbage&guard=auto', 2], ['axis=null', 1], ['cap=99', 1]]) {
    const m = await mountCase({ module, query });
    try {
      const problems = appKeyProblems({ initial: m.initial, defaults, query, handle: m.handle });
      assert.equal(problems.length, errors, JSON.stringify({ query, problems }));
      assert.deepEqual(Object.keys(m.handle.state), ['axis', 'guard', 'cap']);
      const declaration = widgetKeyDefinition(m.handle, 'axis');
      declaration.value = 'changed';
      assert.equal(widgetKeyDefinition(m.handle, 'axis').value, null);
    } finally { m.close(); }
    assert.equal(widgetKeyDefinition(m.handle, 'axis'), undefined);
  }
});
