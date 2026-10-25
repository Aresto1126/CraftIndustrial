// 複数端末のデータ統合（DOM非依存）。アイテム単位で updatedAt が新しい方を採用し、削除は tombstones で伝播する
(function (root) {
  function merge(a, b) {
    const ts = {};
    for (const t of [a.tombstones || {}, b.tombstones || {}]) for (const id in t) ts[id] = Math.max(ts[id] || 0, t[id]);
    const map = new Map();
    for (const it of [...a.items, ...b.items]) {
      const cur = map.get(it.id);
      if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) map.set(it.id, it); // 同時刻は a(ローカル)優先
    }
    const items = [], tombstones = {};
    for (const [id, it] of map) if (!(ts[id] && ts[id] >= (it.updatedAt || 0))) items.push(it);
    for (const id in ts) if (!items.some((i) => i.id === id)) tombstones[id] = ts[id];
    return { items, tombstones };
  }
  function digest(s) {
    const items = [...s.items].sort((x, y) => (x.id < y.id ? -1 : 1));
    const ts = Object.keys(s.tombstones || {}).sort().map((k) => [k, s.tombstones[k]]);
    return JSON.stringify([items, ts]);
  }
  const api = { merge, digest, same: (a, b) => digest(a) === digest(b) };
  if (typeof module !== 'undefined') module.exports = api; else root.Sync = api;
})(typeof self !== 'undefined' ? self : this);
