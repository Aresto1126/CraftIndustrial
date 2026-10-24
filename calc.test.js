const assert = require('assert');
const { calculate } = require('./calc.js');
const items = [
  { id: 'ore', name: '鉄鉱石', inputs: [] },
  { id: 'ingot', name: '鉄インゴット', outQty: 1, inputs: [{ id: 'ore', qty: 1 }] },
  { id: 'plate', name: '鉄板', outQty: 2, inputs: [{ id: 'ingot', qty: 3 }] },
  { id: 'rod', name: '鉄棒', outQty: 1, inputs: [{ id: 'ingot', qty: 1 }] },
  { id: 'screw', name: 'ネジ', outQty: 4, inputs: [{ id: 'rod', qty: 1 }] },
  { id: 'rp', name: '強化板', outQty: 1, inputs: [{ id: 'plate', qty: 6 }, { id: 'screw', qty: 12 }] },
];
const get = (r, id) => r.rows.find((x) => x.id === id);
let r = calculate(items, 'rp', 5);
assert.equal(get(r, 'plate').amount, 30);
assert.equal(get(r, 'plate').batches, 15);
assert.equal(get(r, 'screw').amount, 60);
assert.equal(get(r, 'rod').amount, 15);
assert.equal(get(r, 'ingot').amount, 45 + 15); // 共有素材は合算される
assert.equal(get(r, 'ore').amount, 60);
assert.ok(get(r, 'ore').leaf);
r = calculate(items, 'plate', 3); // 3個 → 2個レシピ2回 = 4個作る
assert.equal(get(r, 'plate').batches, 2);
assert.equal(get(r, 'plate').produced, 4);
assert.equal(get(r, 'ore').amount, 6);
r = calculate(items, 'plate', 3, { roundUp: false });
assert.equal(get(r, 'plate').batches, 1.5);
const loop = [{ id: 'a', inputs: [{ id: 'b', qty: 1 }] }, { id: 'b', inputs: [{ id: 'a', qty: 1 }] }];
assert.equal(calculate(loop, 'a', 1).error, 'cycle');
console.log('ok');
