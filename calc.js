// 必要素材の計算ロジック（DOM非依存。ブラウザとNodeの両方で動く）
(function (root) {
  // items: [{id, name, outQty, inputs:[{id, qty}]}]  inputsが空 = 原料
  function calculate(items, targetId, qty, opts) {
    const roundUp = !opts || opts.roundUp !== false;
    const map = new Map(items.map((i) => [i.id, i]));
    if (!map.has(targetId)) return { error: 'target not found' };

    // DFSで依存順（利用する側が先）に並べる。循環検出付き
    const order = [], state = new Map();
    let cycle = null;
    (function visit(id, path) {
      if (cycle) return;
      const s = state.get(id);
      if (s === 2) return;
      if (s === 1) { cycle = [...path.slice(path.indexOf(id)), id]; return; }
      state.set(id, 1);
      const it = map.get(id);
      if (it) for (const inp of it.inputs || []) if (map.has(inp.id)) visit(inp.id, [...path, id]);
      state.set(id, 2);
      order.push(id);
    })(targetId, []);
    if (cycle) return { error: 'cycle', cycle };
    order.reverse();

    const need = new Map([[targetId, qty]]);
    const rows = [];
    for (const id of order) {
      const it = map.get(id);
      const amount = need.get(id) || 0;
      const hasRecipe = (it.inputs || []).length > 0;
      let batches = 0, produced = amount;
      if (hasRecipe) {
        const out = it.outQty > 0 ? it.outQty : 1;
        batches = amount / out;
        if (roundUp) batches = Math.ceil(batches - 1e-9);
        produced = batches * out;
        for (const inp of it.inputs) {
          if (map.has(inp.id)) need.set(inp.id, (need.get(inp.id) || 0) + batches * inp.qty);
        }
      }
      rows.push({ id, amount, batches, produced, leaf: !hasRecipe, isTarget: id === targetId });
    }
    return { rows };
  }
  const api = { calculate };
  if (typeof module !== 'undefined') module.exports = api; else root.Calc = api;
})(typeof self !== 'undefined' ? self : this);
