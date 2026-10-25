(function () {
  const KEY = 'craft-manager-v1';
  const STATUS = { none: '未作成', manual: '手動', auto: '自動化' };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString('ja-JP');

  let state = load();
  let ui = { tab: 'items', game: '', status: '', q: '', calc: { id: '', qty: 1, roundUp: true, onlyTodo: false }, editing: null };

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.items)) return { items: s.items, tombstones: s.tombstones || {} }; } catch (e) {}
    return { items: [], tombstones: {} };
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert('保存に失敗しました（容量不足またはプライベートモード）'); } }
  function save() { persist(); scheduleSync(); }
  const touch = (it) => { it.updatedAt = Date.now(); return it; };
  const removeItems = (ids) => {
    const now = Date.now();
    ids.forEach((id) => (state.tombstones[id] = now));
    state.items = state.items.filter((i) => !ids.includes(i.id));
    state.items.forEach((i) => { if (i.inputs.some((x) => ids.includes(x.id))) { i.inputs = i.inputs.filter((x) => !ids.includes(x.id)); touch(i); } });
  };
  const byId = (id) => state.items.find((i) => i.id === id);
  const isRaw = (i) => !(i.inputs && i.inputs.length);
  const games = () => [...new Set(state.items.map((i) => i.game).filter(Boolean))];

  // ---------- 描画 ----------
  function render() {
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
    $('#title').textContent = { items: 'アイテム', calc: '必要素材の計算', settings: '設定' }[ui.tab];
    $('#addBtn').style.display = ui.tab === 'items' ? '' : 'none';
    $('#games').innerHTML = games().map((g) => `<option value="${esc(g)}">`).join('');
    ({ items: renderItems, calc: renderCalc, settings: renderSettings })[ui.tab]();
  }

  function renderItems() {
    const gs = games();
    if (ui.game && !gs.includes(ui.game)) ui.game = '';
    const list = state.items.filter((i) =>
      (!ui.game || i.game === ui.game) && (!ui.status || i.status === ui.status) &&
      (!ui.q || i.name.toLowerCase().includes(ui.q.toLowerCase())))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    const cnt = (s) => state.items.filter((i) => (!ui.game || i.game === ui.game) && i.status === s).length;
    $('#main').innerHTML = `
      <input id="q" type="search" placeholder="検索" value="${esc(ui.q)}">
      <div class="chips" style="margin-top:8px">
        <button class="chip ${!ui.game ? 'on' : ''}" data-game="">すべて</button>
        ${gs.map((g) => `<button class="chip ${ui.game === g ? 'on' : ''}" data-game="${esc(g)}">${esc(g)}</button>`).join('')}
      </div>
      <div class="chips">
        <button class="chip ${!ui.status ? 'on' : ''}" data-status="">全状態</button>
        ${Object.keys(STATUS).map((s) => `<button class="chip ${ui.status === s ? 'on' : ''}" data-status="${s}">${STATUS[s]} ${cnt(s)}</button>`).join('')}
      </div>
      ${list.length ? list.map(itemCard).join('') : `<div class="empty">${state.items.length ? '該当なし' : 'アイテムがありません。<br>「＋ 追加」か、設定からサンプルを読み込んでください。'}</div>`}`;
    const q = $('#q');
    q.oninput = () => { ui.q = q.value; const pos = q.selectionStart; renderItems(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#main').onclick = (e) => {
      const g = e.target.closest('[data-game]'), s = e.target.closest('[data-status]'), b = e.target.closest('[data-cycle]'), c = e.target.closest('[data-edit]');
      if (g) { ui.game = g.dataset.game; renderItems(); }
      else if (s) { ui.status = s.dataset.status; renderItems(); }
      else if (b) { const it = byId(b.dataset.cycle); it.status = { none: 'manual', manual: 'auto', auto: 'none' }[it.status]; touch(it); save(); renderItems(); }
      else if (c) openEditor(c.dataset.edit);
    };
  }
  function itemCard(i) {
    const recipe = isRaw(i) ? '原料' : `${fmt(i.outQty)}個 ← ` + i.inputs.map((x) => `${esc(byId(x.id)?.name ?? '(削除済)')}×${fmt(x.qty)}`).join('、');
    return `<div class="card item"><div class="grow" data-edit="${i.id}"><div class="name">${esc(i.name)}</div>
      <div class="meta">${esc(i.game || '未分類')} ・ ${recipe}</div>${i.note ? `<div class="meta">📝 ${esc(i.note)}</div>` : ''}</div>
      <button class="badge ${i.status}" data-cycle="${i.id}">${STATUS[i.status]}</button></div>`;
  }

  function renderCalc() {
    const c = ui.calc;
    const opts = [...state.items].sort((a, b) => (a.game || '').localeCompare(b.game || '', 'ja') || a.name.localeCompare(b.name, 'ja'))
      .map((i) => `<option value="${i.id}" ${i.id === c.id ? 'selected' : ''}>${esc(i.game ? i.game + ' / ' : '')}${esc(i.name)}</option>`).join('');
    $('#main').innerHTML = `
      <div class="card">
        <label>作りたいもの<select id="cId"><option value="">選択してください</option>${opts}</select></label>
        <label>必要数<input id="cQty" type="number" min="0" step="any" inputmode="decimal" value="${esc(c.qty)}"></label>
        <label class="row" style="color:var(--text)"><input id="cRound" type="checkbox" style="width:auto;margin:0" ${c.roundUp ? 'checked' : ''}>レシピ回数を切り上げる（マイクラ向け。サティスファクトリーの毎分計算は OFF）</label>
        <label class="row" style="color:var(--text)"><input id="cTodo" type="checkbox" style="width:auto;margin:0" ${c.onlyTodo ? 'checked' : ''}>未自動化のものだけ表示</label>
      </div><div id="result"></div>`;
    const upd = () => { c.id = $('#cId').value; c.qty = parseFloat($('#cQty').value) || 0; c.roundUp = $('#cRound').checked; c.onlyTodo = $('#cTodo').checked; renderResult(); };
    ['#cId', '#cQty', '#cRound', '#cTodo'].forEach((s) => ($(s).oninput = upd));
    renderResult();
  }
  function renderResult() {
    const c = ui.calc, out = $('#result');
    if (!c.id || !byId(c.id)) { out.innerHTML = '<div class="empty">作りたいものと数を入力すると、必要な素材が表示されます。</div>'; return; }
    const res = Calc.calculate(state.items, c.id, c.qty, { roundUp: c.roundUp });
    if (res.error === 'cycle') { out.innerHTML = `<div class="card warn">レシピが循環しています: ${res.cycle.map((id) => esc(byId(id)?.name)).join(' → ')}</div>`; return; }
    const rows = res.rows.map((r) => ({ ...r, item: byId(r.id) }));
    const todo = rows.filter((r) => r.item.status !== 'auto');
    const show = (r) => !c.onlyTodo || r.item.status !== 'auto';
    const row = (r) => `<div class="card item"><div class="grow"><div class="name">${esc(r.item.name)}</div>
        <div class="sub">${r.leaf ? esc(r.item.game || '') : `レシピ ${fmt(r.batches)}回 → ${fmt(r.produced)}個生産`}</div></div>
        <div class="num">${fmt(r.amount)}</div><span class="badge ${r.item.status}">${STATUS[r.item.status]}</span></div>`;
    const sec = (title, list) => { list = list.filter(show); return list.length ? `<h3>${title}</h3>${list.map(row).join('')}` : ''; };
    const unbuilt = rows.filter((r) => r.item.status === 'none');
    out.innerHTML = `${unbuilt.length ? `<div class="card warn">未作成: ${unbuilt.map((r) => esc(r.item.name)).join('、')}</div>` : ''}
      <div class="sub">自動化済み ${rows.length - todo.length} / ${rows.length} 品目</div>
      ${sec('原料（必要な資源）', rows.filter((r) => r.leaf && !r.isTarget))}
      ${sec('中間素材', rows.filter((r) => !r.leaf && !r.isTarget))}
      ${sec('完成物', rows.filter((r) => r.isTarget))}`;
  }

  function renderSettings() {
    $('#main').innerHTML = `
      ${syncCard()}
      <div class="card"><b>データ</b><div class="sub" style="margin:4px 0 10px">${state.items.length}件。データはこの端末のブラウザ内にのみ保存されます。機種変更前にバックアップしてください。</div>
        <div class="row"><button id="exp">バックアップを書き出す</button><button id="imp">読み込む</button></div>
        <input type="file" id="file" accept="application/json" hidden></div>
      <div class="card"><b>サンプル</b><div class="sub" style="margin:4px 0 10px">サティスファクトリーとマイクラの例を追加します（既存データは残ります）。</div>
        <button id="sample">サンプルを追加</button></div>
      <div class="card"><b>全削除</b><div class="sub" style="margin:4px 0 10px">元に戻せません。</div><button id="wipe" class="danger">全データを削除</button></div>`;
    $('#exp').onclick = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
      a.download = `craft-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    };
    $('#imp').onclick = () => $('#file').click();
    $('#file').onchange = async (e) => {
      try {
        const d = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(d.items)) throw 0;
        if (!confirm(`現在のデータを置き換えて ${d.items.length} 件を読み込みますか？`)) return;
        const now = Date.now(), keep = new Set(d.items.map((i) => i.id));
        removeItems(state.items.map((i) => i.id).filter((id) => !keep.has(id)));
        d.items.forEach((i) => { touch(i); delete state.tombstones[i.id]; });
        state.items = d.items; save(); alert('読み込みました'); render();
      } catch (err) { alert('読み込めないファイルです'); }
    };
    $('#sample').onclick = () => { addSample(); save(); alert('追加しました'); ui.tab = 'items'; render(); };
    $('#wipe').onclick = () => { if (confirm('本当に全データを削除しますか？' + (cloud.token ? '（連携中の他の端末からも消えます）' : ''))) { removeItems(state.items.map((i) => i.id)); save(); render(); } };
    bindSync();
  }
  function addSample() {
    const S = 'サティスファクトリー', M = 'マインクラフト', mk = {};
    const add = (key, game, name, status, outQty, inputs) => {
      mk[key] = touch({ id: uid(), game, name, status, outQty, inputs: (inputs || []).map(([k, qty]) => ({ id: mk[k].id, qty })), note: '' });
      state.items.push(mk[key]);
    };
    add('fe', S, '鉄鉱石', 'auto', 1);
    add('fi', S, '鉄インゴット', 'auto', 1, [['fe', 1]]);
    add('fp', S, '鉄板', 'manual', 2, [['fi', 3]]);
    add('fr', S, '鉄の棒', 'auto', 1, [['fi', 1]]);
    add('sc', S, 'ネジ', 'none', 4, [['fr', 1]]);
    add('rp', S, '強化鉄板', 'none', 1, [['fp', 6], ['sc', 12]]);
    add('pl', M, '原木', 'manual', 1);
    add('pk', M, '板材', 'manual', 4, [['pl', 1]]);
    add('st', M, '棒', 'none', 4, [['pk', 2]]);
    add('co', M, '丸石', 'auto', 1);
    add('pi', M, '石のツルハシ', 'none', 1, [['co', 3], ['st', 2]]);
  }

  // ---------- エディタ ----------
  const dlg = $('#editor'), form = $('#editForm');
  function inputRow(inp, selfId) {
    const opts = state.items.filter((i) => i.id !== selfId).sort((a, b) => a.name.localeCompare(b.name, 'ja'))
      .map((i) => `<option value="${i.id}" ${i.id === inp.id ? 'selected' : ''}>${esc(i.game ? i.game + ' / ' : '')}${esc(i.name)}</option>`).join('');
    return `<div class="inrow"><select><option value="">選択</option>${opts}</select>
      <input type="number" min="0" step="any" inputmode="decimal" value="${esc(inp.qty ?? 1)}"><button type="button" class="danger">✕</button></div>`;
  }
  function openEditor(id) {
    const it = id ? byId(id) : { id: '', name: '', game: ui.game, status: 'none', outQty: 1, inputs: [], note: '' };
    ui.editing = id || null;
    $('#editTitle').textContent = id ? 'アイテムを編集' : 'アイテムを追加';
    form.name.value = it.name; form.game.value = it.game || ''; form.status.value = it.status;
    form.outQty.value = it.outQty ?? 1; form.note.value = it.note || '';
    $('#inputs').innerHTML = (it.inputs || []).map((x) => inputRow(x, id)).join('');
    $('#delBtn').style.display = id ? '' : 'none';
    dlg.showModal();
  }
  $('#addInput').onclick = () => $('#inputs').insertAdjacentHTML('beforeend', inputRow({ qty: 1 }, ui.editing));
  $('#inputs').onclick = (e) => { if (e.target.tagName === 'BUTTON') e.target.closest('.inrow').remove(); };
  $('#cancelBtn').onclick = () => dlg.close();
  $('#delBtn').onclick = () => {
    const id = ui.editing, users = state.items.filter((i) => i.inputs.some((x) => x.id === id));
    if (!confirm(users.length ? `「${users.map((u) => u.name).join('、')}」のレシピでも使われています。削除しますか？` : '削除しますか？')) return;
    removeItems([id]);
    save(); dlg.close(); render();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    const inputs = [...document.querySelectorAll('#inputs .inrow')].map((r) => ({ id: r.querySelector('select').value, qty: parseFloat(r.querySelector('input').value) || 0 }))
      .filter((x) => x.id && x.qty > 0);
    const data = { name: form.name.value.trim(), game: form.game.value.trim(), status: form.status.value, outQty: parseFloat(form.outQty.value) || 1, inputs, note: form.note.value.trim() };
    if (!data.name) return;
    if (ui.editing) touch(Object.assign(byId(ui.editing), data)); else state.items.push(touch({ id: uid(), ...data }));
    const probe = Calc.calculate(state.items, ui.editing || state.items[state.items.length - 1].id, 1);
    if (probe.error === 'cycle') alert('注意: このレシピは循環しています（計算できません）。材料を見直してください。');
    save(); dlg.close(); render();
  };

  // ---------- 端末間同期（GitHub シークレットGist） ----------
  const CK = 'craft-sync-v1', FILE = 'craft-manager-data.json', API = 'https://api.github.com';
  let cloud = (() => { try { return JSON.parse(localStorage.getItem(CK)) || {}; } catch (e) { return {}; } })();
  const saveCloud = () => { try { localStorage.setItem(CK, JSON.stringify(cloud)); } catch (e) {} };
  let syncing = false, again = false, timer;

  async function gh(path, opt) {
    const r = await fetch(API + path, { ...opt, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + cloud.token, 'Content-Type': 'application/json' } });
    if (!r.ok) { const e = new Error(r.status === 401 ? 'トークンが無効です' : `GitHubエラー (${r.status})`); e.status = r.status; throw e; }
    return r.json();
  }
  async function findGist() {
    for (let p = 1; p <= 5; p++) {
      const l = await gh(`/gists?per_page=100&page=${p}`);
      const g = l.find((g) => g.files && g.files[FILE]);
      if (g) return g.id;
      if (l.length < 100) break;
    }
    return null;
  }
  function scheduleSync() { if (cloud.token) { clearTimeout(timer); timer = setTimeout(syncNow, 1500); } }
  async function syncNow() {
    if (!cloud.token) return;
    if (syncing) { again = true; return; }
    syncing = true; cloud.err = ''; showSync('同期中…');
    try {
      if (!cloud.gistId) cloud.gistId = await findGist();
      let remote = null;
      if (cloud.gistId) {
        const f = (await gh('/gists/' + cloud.gistId)).files[FILE];
        if (f) {
          if (f.truncated) throw new Error('データが大きすぎて同期できません');
          const d = JSON.parse(f.content);
          if (Array.isArray(d.items)) remote = { items: d.items, tombstones: d.tombstones || {} };
        }
      }
      const merged = remote ? Sync.merge(state, remote) : state;
      const localChanged = !Sync.same(merged, state);
      if (!remote || !Sync.same(merged, remote)) {
        const content = JSON.stringify({ items: merged.items, tombstones: merged.tombstones });
        if (cloud.gistId) await gh('/gists/' + cloud.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
        else cloud.gistId = (await gh('/gists', { method: 'POST', body: JSON.stringify({ description: 'クラフト管理アプリのデータ', public: false, files: { [FILE]: { content } } }) })).id;
      }
      state = merged; persist(); cloud.last = Date.now();
      if (localChanged && !dlg.open) render();
    } catch (e) {
      cloud.err = e.status === 404 && cloud.gistId ? 'Gistが見つかりません。連携を解除してやり直してください' : e instanceof TypeError ? 'オフラインです（次回オンライン時に同期します）' : e.message;
    } finally {
      syncing = false; saveCloud(); showSync();
      if (again) { again = false; syncNow(); }
    }
  }
  function showSync(msg) {
    const el = $('#syncStatus'); if (!el) return;
    el.textContent = msg || (cloud.err ? '⚠ ' + cloud.err : cloud.last ? '✓ 最終同期 ' + new Date(cloud.last).toLocaleString('ja-JP') : '未同期');
    el.className = 'sub' + (cloud.err && !msg ? ' none' : '');
  }
  function syncCard() {
    const help = `<div class="sub" style="margin:4px 0 10px">PCとスマホで同じデータを使います。保存先はあなたのGitHubの非公開Gistです。
      <a href="https://github.com/settings/tokens/new?scopes=gist&description=craft-manager" target="_blank" rel="noopener" style="color:var(--accent)">こちら</a>でトークンを作成（権限は <b>gist</b> のみ・有効期限は「No expiration」推奨）し、使う端末ごとに同じトークンを貼り付けてください。</div>`;
    return `<div class="card"><b>端末間の同期</b>${help}${cloud.token
      ? `<div id="syncStatus" class="sub"></div><div class="row" style="margin-top:8px"><button id="syncBtn">今すぐ同期</button><button id="unlink" class="danger">連携を解除</button></div>`
      : `<label>GitHubトークン<input id="tok" type="password" autocomplete="off" placeholder="ghp_..."></label><button id="link" class="primary">連携して同期</button><div id="syncStatus" class="sub"></div>`}</div>`;
  }
  function bindSync() {
    showSync();
    if ($('#link')) $('#link').onclick = async () => {
      const t = $('#tok').value.trim(); if (!t) return;
      cloud = { token: t }; saveCloud(); await syncNow();
      if (cloud.err) { const e = cloud.err; cloud = {}; saveCloud(); renderSettings(); $('#syncStatus').textContent = '⚠ ' + e; $('#syncStatus').className = 'sub none'; }
      else renderSettings();
    };
    if ($('#syncBtn')) $('#syncBtn').onclick = syncNow;
    if ($('#unlink')) $('#unlink').onclick = () => { if (confirm('この端末の連携を解除しますか？（データは端末に残り、Gistも削除されません）')) { cloud = {}; saveCloud(); renderSettings(); } };
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  window.addEventListener('online', syncNow);

  // ---------- 起動 ----------
  document.querySelectorAll('nav button').forEach((b) => (b.onclick = () => { ui.tab = b.dataset.tab; render(); window.scrollTo(0, 0); }));
  $('#addBtn').onclick = () => openEditor(null);
  render();
  syncNow();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
