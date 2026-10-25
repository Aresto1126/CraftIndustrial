const assert = require('assert');
const { merge, same } = require('./sync.js');
const it = (id, name, updatedAt) => ({ id, name, updatedAt, inputs: [] });
// 双方で別アイテムを追加 → 和集合
let m = merge({ items: [it('a', 'A', 1)] }, { items: [it('b', 'B', 2)] });
assert.deepEqual(m.items.map((i) => i.id).sort(), ['a', 'b']);
// 同一アイテムは新しい方
m = merge({ items: [it('a', 'old', 1)] }, { items: [it('a', 'new', 5)] });
assert.equal(m.items[0].name, 'new');
// 削除が新しければ消える／編集が新しければ復活
m = merge({ items: [it('a', 'A', 1)] }, { items: [], tombstones: { a: 3 } });
assert.equal(m.items.length, 0); assert.equal(m.tombstones.a, 3);
m = merge({ items: [it('a', 'A', 9)] }, { items: [], tombstones: { a: 3 } });
assert.equal(m.items.length, 1); assert.equal(m.tombstones.a, undefined);
// 冪等・順序非依存
const x = { items: [it('a', 'A', 1), it('c', 'C', 4)] }, y = { items: [it('b', 'B', 2)], tombstones: { c: 6 } };
assert.ok(same(merge(x, y), merge(y, x)));
assert.ok(same(merge(merge(x, y), y), merge(x, y)));
console.log('ok');
