/* VibeOFF: оффлайн-приложение без зависимостей (кроме highlight.js) */
(function () {
  'use strict';
  const D = window.SPRAV;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LV = { j: 'Junior', m: 'Middle', s: 'Senior', a: 'Все уровни', d: 'Подробно' };
  const tabsHTML = (q, l) => ['j', 'm', 's', 'a'].concat(q.more ? ['d'] : []).map(k => `<button data-l="${k}" class="${k === l || (l === 'd' && !q.more && k === 'a') ? 'on' : ''}">${k === 'a' ? 'Все' : k === 'd' ? '📖 Подробно' : LV[k]}</button>`).join('');

  // ---------- индекс ----------
  const Q = {}; const ORDER = []; const TOPIC = {};
  D.topics.forEach(t => {
    TOPIC[t.slug] = t; let n = 0;
    t.sections.forEach(s => s.items.forEach(q => { q.topic = t; q.sec = s.title; q.n = ++n; Q[q.id] = q; ORDER.push(q); }));
    t.count = n;
  });
  const QZ_BY_REF = {}, QZ_BY_T = {};
  (D.quiz || []).forEach(z => { if (z.ref) (QZ_BY_REF[z.ref] = QZ_BY_REF[z.ref] || []).push(z); (QZ_BY_T[z.t] = QZ_BY_T[z.t] || []).push(z); });
  const norm = s => s.toLowerCase().replace(/ё/g, 'е');
  ORDER.forEach(q => { q._q = norm(q.q); q._t = norm(q.text || ''); });

  // ---------- хранилище ----------
  // профили: у каждого пользователя свой прогресс в localStorage этого браузера
  const PKEY = 'java-sprav:profiles';
  let P = null;
  try { P = JSON.parse(localStorage.getItem(PKEY)); } catch (e) { }
  if (!P || !P.list || !P.list.length) P = { cur: 'p0', list: [{ id: 'p0', name: 'Основной' }] };
  if (!P.list.some(p => p.id === P.cur)) P.cur = P.list[0].id;
  const saveP = () => { try { localStorage.setItem(PKEY, JSON.stringify(P)); } catch (e) { } };
  saveP();
  const pkey = id => id === 'p0' ? 'java-sprav:v1' : 'java-sprav:v1:' + id;
  const KEY = pkey(P.cur);
  const curProfile = () => P.list.find(p => p.id === P.cur);
  let S = {};
  try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
  S.st = S.st || {}; S.notes = S.notes || {}; S.level = S.level || 'j'; S.theme = S.theme || 'light'; S.style = S.style || 'lime'; S.collapsed = S.collapsed || {};
  S.hist = S.hist || []; S.tk = S.tk || {}; S.code = S.code || {}; S.pads = S.pads || []; S.road = S.road || {};
  // объединённые дубли: перенести отметки со старых id
  Object.entries(D.alias || {}).forEach(([o, n]) => {
    if (S.st[o]) { if (!S.st[n]) S.st[n] = S.st[o]; delete S.st[o]; }
    if (S.notes[o]) { S.notes[n] = (S.notes[n] ? S.notes[n] + '\n\n' : '') + S.notes[o]; delete S.notes[o]; }
  });
  const learnSig = () => JSON.stringify([S.st, S.qz, S.gl, S.gitlab, S.sqllab, S.tk, S.hist.length, S.road, S.code, !!S.jwtOk, Object.keys(S.notes).length]);
  let lastSig = null;
  function trackActivity() {
    const sig = learnSig(); if (lastSig !== null && sig !== lastSig) {
      S.days = S.days || {}; const k = todayKey(); S.days[k] = (S.days[k] || 0) + 1;
      const ks = Object.keys(S.days).sort(); if (ks.length > 400) ks.slice(0, ks.length - 400).forEach(x => delete S.days[x]);
      S.bestStreak = Math.max(S.bestStreak || 0, streak());
      const hr = new Date().getHours(); if (hr < 5) S.owl = 1; else if (hr >= 5 && hr < 7) S.lark = 1;
      if (typeof checkAchievements === 'function') checkAchievements();
    }
    lastSig = sig;
  }
  const save = () => { trackActivity(); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить: хранилище браузера недоступно'); } };
  const st = id => S.st[id] || '';
  function setSt(id, v) {
    if (st(id) === v) delete S.st[id]; else S.st[id] = v;
    save(); refreshStatus(id); renderNav(); updateTopicProgress();
  }

  // ---------- тема ----------
  // схемы SVG имеют отдельный тёмный вариант (img/svg-dark), остальные изображения приглушаются стилями
  const effTheme = () => S.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme;
  const imgSrc = src => effTheme() === 'dark' && src.startsWith('img/svg/') ? src.replace('img/svg/', 'img/svg-dark/') : src;
  function applyTheme() {
    document.documentElement.dataset.theme = effTheme(); document.documentElement.dataset.style = S.style;
    applyWall();
    $$('img[data-src0]').forEach(im => { im.src = imgSrc(im.dataset.src0); });
    if ($('#lb').classList.contains('open')) showLB();
  }

  // ---------- утилиты ----------
  function toast(msg) { const t = $('#toast'); if (t.classList.contains('sticky')) return; t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
  function stats(list) { let k = 0, r = 0; list.forEach(q => { const v = st(q.id); if (v === 'k') k++; else if (v === 'r') r++; }); return { k, r, n: list.length }; }
  const topicQs = t => t.sections.flatMap(s => s.items);
  function barHTML(s, cls = 'bar') { const pk = s.n ? s.k / s.n * 100 : 0, pr = s.n ? s.r / s.n * 100 : 0; return `<div class="${cls}"><i class="k" style="width:${pk}%"></i><i class="r" style="width:${pr}%"></i></div>`; }
  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); }

  // ---------- боковая навигация ----------
  let navFilter = '';
  function renderNav() {
    const cur = location.hash || '#/';
    const mod = currentModule(cur);
    $('#sideLinks').innerHTML = `<div class="mod-grid"><button class="mod mini-only" id="miniTopics" data-hint="Темы: открыть список тем" aria-label="Темы"><span class="mi">📚</span><span class="mt">Темы</span></button>${MODULES.map(m => `<a class="mod${mod === m.id ? ' active' : ''}" href="${m.href}" data-hint="${esc(HINTS[m.id] || m.long || m.t)}" aria-label="${esc(m.long || m.t)}"><span class="mi">${m.ico}</span><span class="mt">${esc(m.t)}</span></a>`).join('')}</div>
      <div class="nav-filter"><input id="navQ" placeholder="Найти тему…" value="${esc(navFilter)}" autocomplete="off"></div>`;
    const curSlug = (cur.match(/^#\/t\/([^/]+)(?:\/do)?$/) || [])[1];
    const qm = cur.match(/^#\/(?:q|solve)\/(.+)$/);
    const curTopic = qm ? (Q[decodeURIComponent(qm[1])] || {}).topic : TOPIC[curSlug];
    if (curTopic && !curTopic.module && !navFilter && S.navFor !== cur) { S.openGroup = curTopic.group; S.navFor = cur; }
    const f = norm(navFilter.trim());
    $('#nav').innerHTML = D.groups.map(g => {
      const ts = D.topics.filter(t => t.group === g && !t.module && (!f || norm(t.title).includes(f) || norm(g).includes(f)));
      if (!ts.length) return '';
      const open = f || S.openGroup === g;
      const gs = stats(ts.flatMap(topicQs));
      return `<div class="nav-group${open ? '' : ' collapsed'}" data-g="${esc(g)}"><div class="nav-gtitle"><span class="chev">▼</span>${esc(g)}<span class="g-cnt">${gs.k}/${gs.n}</span></div><div class="nav-items">` +
        ts.map(t => {
          const s = stats(topicQs(t));
          return `<a class="nav-item${curTopic === t ? ' active' : ''}" href="#/t/${t.slug}"><div class="nav-row"><span class="nav-name">${esc(t.title)}</span><span class="nav-cnt">${s.k}/${t.count}</span></div>${barHTML(s, 'mini-bar')}</a>`;
        }).join('') + '</div></div>';
    }).join('') || '<div class="muted" style="padding:8px 12px">Тема не найдена</div>';
    $('#miniTopics').onclick = e => { e.stopPropagation(); document.body.classList.toggle('mini-open'); if (document.body.classList.contains('mini-open')) $('#navQ').focus(); };
    $('#navQ').oninput = e => { navFilter = e.target.value; const pos = e.target.selectionStart; renderNav(); const n = $('#navQ'); n.focus(); n.setSelectionRange(pos, pos); };
  }
  document.addEventListener('click', e => {
    const gt = e.target.closest('.nav-gtitle'); if (!gt) return;
    const g = gt.parentElement.dataset.g; S.openGroup = S.openGroup === g ? null : g; save(); renderNav();
  });

  // ---------- рендер ответа ----------
  function levelHTML(q, l) {
    if (l === 'd') return q.more ? `<div class="more-block">${q.more}</div>` : levelHTML(q, 'a');
    if (l === 'a') return ['j', 'm', 's'].map(k => `<div class="lv-block"><div class="lv-head ${k}">${LV[k]}</div>${levelHTML(q, k)}</div>`).join('');
    const h = q.lv[l];
    let out = h || '<p class="empty-lv">Для этого уровня дополнений нет.</p>';
    return out;
  }
  function badges(q) {
    let b = '';
    if (q.star) b += '<span class="badge star" title="Ключевой вопрос темы">★ Ключевой</span>';
    if (q.lc) b += `<span class="badge lc">LeetCode ${q.lc.num}</span><span class="badge ${q.lc.diff.toLowerCase()}">${q.lc.diff}</span>`;
    if (q.more) b += '<span class="badge more" title="Есть развёрнутый материал">📖 подробно</span>';
    return b ? `<span class="badges">${b}</span>` : '';
  }
  function cardHTML(q, opts = {}) {
    const s = st(q.id);
    const label = opts.showTopic ? `<div class="crumbs" style="margin:0 0 2px">${esc(q.topic.title)}</div>` : '';
    return `<div class="card${s ? ' st-' + s : ''}" id="q-${q.id}" data-id="${q.id}">
      <div class="card-h"><div class="card-num">${s === 'k' ? '✓' : s === 'r' ? '↻' : q.n}</div>
      <div class="card-q">${label}${esc(q.q)}${badges(q)}</div><div class="card-chev">▶</div></div>
      <div class="card-b"></div></div>`;
  }
  function fillCard(card, level) {
    const q = Q[card.dataset.id]; const b = $('.card-b', card);
    const l = level || card.dataset.lv || S.level;
    card.dataset.lv = l;
    const s = st(q.id); const note = S.notes[q.id] || '';
    const solving = card.dataset.solve === '1';
    b.innerHTML = `<div class="card-tools">
        <div class="lv-tabs">${solving ? `<span class="solve-badge">${q.starter ? '🛠 Практикум: найдите и исправьте проблемы' : '✍ Режим «Решить самому»'}</span>` : tabsHTML(q, l)}</div>
        <div class="tools-r">${canSolve(q) ? `<button class="tbtn solve-t${solving ? ' on' : ''}" data-act="solve" title="Скрыть ответ и решить задачу самостоятельно">${solving ? '📖 К ответу' : q.starter ? '🛠 Отрефакторить самому' : '✍ Решить самому'}</button>` : ''}${QZ_BY_REF[q.id] ? `<a class="tbtn" href="#/quiz/q/${q.id}" title="Вопросы самотеста по этой теме">🧪 ${QZ_BY_REF[q.id].length}</a>` : ''}
          <button class="tbtn k${s === 'k' ? ' on' : ''}" data-act="k" title="Отметить как изученный">✓ Знаю</button>
          <button class="tbtn r${s === 'r' ? ' on' : ''}" data-act="r" title="Добавить в список повторения">↻ Повторить</button>
          <button class="tbtn n${note ? ' on' : ''}" data-act="note" title="Личная заметка">📝 Заметка</button>
          <button class="tbtn" data-act="link" title="Скопировать ссылку на вопрос">🔗</button>
        </div></div>
      ${solving ? solveHTML(q) : `<div class="answer">${levelHTML(q, l)}</div>`}
      ${!solving && q.imgs && q.imgs.length ? galleryHTML(q.imgs, 'Иллюстрации') : ''}
      ${q.rel && q.rel.length ? `<div class="related"><span class="rel-h">Связанные вопросы:</span>${q.rel.map(id => `<a href="#/q/${id}">${esc(Q[id].q)}</a>`).join('')}</div>` : ''}
      <div class="notes"><div class="notes-h"><b>Мои заметки</b><span class="saved"></span></div><textarea placeholder="Свой ответ, пример из практики, что осталось непонятным…">${esc(note)}</textarea></div>
      ${note ? `<div class="note-preview">${esc(note)}</div>` : ''}`;
    if (solving) mountSolve(b, q, card); else { enhanceCode(b, q); glossLink($('.answer', b), q); }
  }
  function galleryHTML(imgs, title, big) {
    const key = 'g' + Math.random().toString(36).slice(2);
    GAL[key] = imgs;
    return `<div class="gallery"><div class="gallery-h">${esc(title)} · ${imgs.length}</div><div class="thumbs${big ? ' big' : ''}">` +
      imgs.map((im, i) => `<div class="thumb" data-g="${key}" data-i="${i}"><img loading="lazy" src="${imgSrc(im.src)}" data-src0="${im.src}" alt=""></div>`).join('') + '</div></div>';
  }
  const GAL = {};

  // ---------- подсветка кода + построчная разметка ----------
  function splitLines(html) {
    const parts = html.split(/(<span[^>]*>|<\/span>|\n)/);
    const lines = []; let cur = ''; const stack = [];
    for (const p of parts) {
      if (!p) continue;
      if (p === '\n') { cur += '</span>'.repeat(stack.length); lines.push(cur); cur = stack.join(''); }
      else if (p.startsWith('<span')) { stack.push(p); cur += p; }
      else if (p === '</span>') { stack.pop(); cur += p; }
      else cur += p;
    }
    lines.push(cur);
    return lines;
  }
  function enhanceCode(root, q) {
    $$('pre > code', root).forEach(code => {
      const pre = code.parentElement; if (pre.dataset.done) return; pre.dataset.done = 1;
      const raw = code.textContent;
      const lang = (code.className.match(/language-(\w+)/) || [])[1] || 'java';
      try { if (window.hljs && hljs.getLanguage(lang)) code.innerHTML = hljs.highlight(raw, { language: lang, ignoreIllegals: true }).value; } catch (e) { }
      let tips = {}; try { tips = JSON.parse(pre.dataset.tips || '{}'); } catch (e) { }
      code.innerHTML = splitLines(code.innerHTML).map((l, i) => `<span class="ln${tips[i] ? ' tip' : ''}" data-i="${i}">${l || ' '}</span>`).join('');
      const hasLogic = q && q.logic;
      if (hasLogic) pre.classList.add('logic');
      const bar = document.createElement('div'); bar.className = 'pre-bar';
      bar.innerHTML = (hasLogic || Object.keys(tips).length ? '<span class="pre-hint">💡 наведите — логика решения</span>' : '') +
        `<span class="pre-lang">${lang}</span><button class="pre-btn" data-copy>Копировать</button>`;
      pre.insertBefore(bar, code);
      pre._raw = raw; pre._tips = tips; pre._q = q;
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const pre = b.closest('pre');
    navigator.clipboard ? navigator.clipboard.writeText(pre._raw).then(() => toast('Код скопирован'), () => fallbackCopy(pre._raw)) : fallbackCopy(pre._raw);
  });
  function fallbackCopy(text) { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Скопировано'); } catch (e) { } t.remove(); }

  // всплывающая подсказка
  const tip = document.createElement('div'); tip.className = 'ctip'; document.body.appendChild(tip);
  let tipKey = '';
  document.addEventListener('mousemove', e => {
    const pre = e.target.closest && e.target.closest('.answer pre');
    if (!pre || !(pre._q && pre._q.logic) && !(pre._tips && Object.keys(pre._tips).length)) { if (tipKey) { tip.classList.remove('show'); tipKey = ''; } return; }
    const ln = e.target.closest('.ln'); const i = ln ? +ln.dataset.i : -1;
    const lt = pre._tips[i];
    if (!lt && !(pre._q && pre._q.logic)) { tip.classList.remove('show'); tipKey = ''; return; }
    const key = (pre._q ? pre._q.id : '') + ':' + (lt ? i : 'x');
    if (key !== tipKey) {
      tipKey = key; const L = pre._q && pre._q.logic;
      tip.innerHTML = (lt ? `<div class="ct-line"><b>Строка ${i + 1}</b>${esc(lt)}</div>` : '') +
        (L ? `<div class="ct-h">Логика решения</div><div class="ct-idea">${esc(L.idea)}</div><ol>${L.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>${L.cx ? `<div class="ct-cx">⏱ ${esc(L.cx)}</div>` : ''}` : '');
    }
    tip.classList.add('show');
    const r = pre.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
    const lr = ln ? ln.getBoundingClientRect() : { top: e.clientY - 10, bottom: e.clientY + 10 };
    let x, y;
    if (r.right + 14 + tw <= innerWidth - 8) { x = r.right + 14; y = lr.top - 12; }          // справа от блока кода
    else {                                                                                       // под строкой, у правого края блока
      x = Math.max(8, Math.min(r.right - tw - 8, innerWidth - tw - 8));
      y = lr.bottom + 8;
      if (y + th > innerHeight - 8) y = lr.top - th - 8;
    }
    if (y + th > innerHeight - 8) y = innerHeight - th - 8;
    tip.style.left = x + 'px'; tip.style.top = Math.max(10, y) + 'px';
  });

  // ---------- карточки: события ----------
  document.addEventListener('click', e => {
    const h = e.target.closest('.card-h');
    if (h) { toggleCard(h.parentElement); return; }
    const tab = e.target.closest('.lv-tabs button');
    if (tab) { const card = tab.closest('.card'); if (card) fillCard(card, tab.dataset.l); else trainLevel(tab.dataset.l); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const card = act.closest('.card'); const id = card.dataset.id; const a = act.dataset.act;
      if (a === 'k' || a === 'r') setSt(id, a);
      else if (a === 'solve') { card.dataset.solve = card.dataset.solve === '1' ? '' : '1'; fillCard(card); }
      else if (a === 'note') { const n = $('.notes', card); n.classList.toggle('open'); act.classList.toggle('on', n.classList.contains('open') || !!S.notes[id]); if (n.classList.contains('open')) $('textarea', n).focus(); }
      else if (a === 'link') { const url = location.href.split('#')[0] + '#/q/' + id; fallbackCopy(url); }
      return;
    }
    const th = e.target.closest('.thumb'); if (th) openLB(GAL[th.dataset.g], +th.dataset.i);
  });
  let noteTimer;
  document.addEventListener('input', e => {
    if (!e.target.matches('.notes textarea')) return;
    const card = e.target.closest('.card'); const id = card.dataset.id; const v = e.target.value;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => {
      if (v.trim()) S.notes[id] = v; else delete S.notes[id];
      save(); $('.saved', card).textContent = 'сохранено ✓';
      let p = $('.note-preview', card);
      if (v.trim()) { if (!p) { p = document.createElement('div'); p.className = 'note-preview'; $('.card-b', card).appendChild(p); } p.textContent = v; } else if (p) p.remove();
      renderNav();
    }, 400);
  });
  function toggleCard(card, force) {
    const open = force !== undefined ? force : !card.classList.contains('open');
    if (open && !card.dataset.filled) { fillCard(card); card.dataset.filled = 1; }
    card.classList.toggle('open', open);
    clearTimeout(navSaveT); navSaveT = setTimeout(navSave, 60);
  }
  function refreshStatus(id) {
    $$(`.card[data-id="${id}"]`).forEach(card => {
      const s = st(id); card.classList.remove('st-k', 'st-r'); if (s) card.classList.add('st-' + s);
      $('.card-num', card).textContent = s === 'k' ? '✓' : s === 'r' ? '↻' : Q[id].n;
      $$('.tbtn.k,.tbtn.r', card).forEach(b => b.classList.toggle('on', b.dataset.act === s));
    });
    $$(`.outline a[data-id="${id}"]`).forEach(a => { a.classList.remove('k', 'r'); if (st(id)) a.classList.add(st(id)); });
  }

  // ---------- лайтбокс ----------
  let LB = { imgs: [], i: 0 };
  function openLB(imgs, i) { LB = { imgs, i }; $('#lb').classList.add('open'); showLB(); }
  function showLB() { const im = LB.imgs[LB.i]; $('#lbImg').src = imgSrc(im.src); $('#lbStage').classList.remove('zoom'); $('#lbInfo').textContent = `${LB.i + 1} / ${LB.imgs.length}  ·  клик — увеличить, ← → — листать, Esc — закрыть`; $('#lbPrev').style.display = $('#lbNext').style.display = LB.imgs.length > 1 ? '' : 'none'; }
  function closeLB() { $('#lb').classList.remove('open'); }
  $('#lbImg').addEventListener('click', e => { e.stopPropagation(); $('#lbStage').classList.toggle('zoom'); });
  $('#lbStage').addEventListener('click', e => { if (e.target.id === 'lbStage') closeLB(); });
  $('#lbClose').onclick = closeLB;
  $('#lbPrev').onclick = () => { LB.i = (LB.i - 1 + LB.imgs.length) % LB.imgs.length; showLB(); };
  $('#lbNext').onclick = () => { LB.i = (LB.i + 1) % LB.imgs.length; showLB(); };

  // ---------- страницы ----------
  const main = () => $('#content');
  let outlineObs = null;

  // ---------- главная ----------
  const isNewUser = () => !Object.keys(S.st).length && !S.hist.length && !Object.keys(S.qz || {}).length && !S.last;
  const ROAD_KEY = { j: 'j', m: 'm', s: 's' };
  function nextRoadItem() {
    const R = D.road || []; const pref = ROAD_KEY[S.level];
    const order = pref ? R.filter(r => r.key === pref).concat(R.filter(r => r.key !== pref)) : R;
    for (const r of order) for (const b of r.blocks) for (const it of b.items) if (!roadDone(r.key, it)) return { r, b, it };
    return null;
  }
  function streak() {
    const days = S.days || {}; let n = 0; const d = new Date();
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);            // сегодня ещё не занимались — считаем со вчера
    while (days[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function heatHTML() {
    const days = S.days || {}; const WEEKS = 26;
    const end = new Date(); const start = new Date(end); start.setDate(end.getDate() - (WEEKS * 7 - 1) - ((end.getDay() + 6) % 7 === 6 ? 0 : 0));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));   // с понедельника
    const cells = []; const d = new Date(start); let total = 0, active = 0;
    while (d <= end) { const k = dayKey(d), v = days[k] || 0; total += v; if (v) active++; const lvl = !v ? 0 : v < 3 ? 1 : v < 8 ? 2 : v < 20 ? 3 : 4; cells.push(`<i class="h${lvl}" title="${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}: ${v ? plural(v, 'действие', 'действия', 'действий') : 'нет занятий'}"></i>`); d.setDate(d.getDate() + 1); }
    return { html: `<div class="heat">${cells.join('')}</div>`, total, active };
  }
  function weakTopics() {
    return D.topics.filter(t => t.count && QZ_BY_T[t.slug]).map(t => {
      const za = QZ_BY_T[t.slug].filter(z => z.id in S.qz), zo = za.filter(z => S.qz[z.id] === 1).length;
      return { t, n: za.length, acc: za.length ? Math.round(zo / za.length * 100) : null };
    }).filter(r => r.acc !== null && r.n >= 3 && r.acc < 70).sort((a, b) => a.acc - b.acc).slice(0, 3);
  }
  function achievements() {
    const all = stats(ORDER); const core = stats(D.topics.filter(t => t.group === 'Java Core').flatMap(topicQs));
    const gitN = (EXT.find(x => x.id === 'gitlab') || {}).prog, sqlN = (EXT.find(x => x.id === 'sqllab') || {}).prog;
    const g = gitN ? gitN(S) : null, s = sqlN ? sqlN(S) : null;
    const glk = Object.values(S.gl || {}).filter(v => v === 'k').length;
    const exams = S.hist.filter(h => h.m === 'exam' && h.pass).length, tks = Object.values(S.tk).filter(r => r.pass).length;
    const sk = Math.max(streak(), S.bestStreak || 0);
    const grp = name => stats(D.topics.filter(t => t.group === name && !t.module).flatMap(topicQs));
    const kt = grp('Kotlin'), spr = grp('Spring'), dat = grp('Данные'), arc = grp('Архитектура'), sec = grp('Безопасность');
    const roadOk = key => { const r = (D.road || []).find(x => x.key === key); if (!r) return [0, 0]; const its = r.blocks.flatMap(b => b.items); return [its.filter(it => roadDone(r.key, it)).length, its.length]; };
    const rj = roadOk('j'), rm = roadOk('m'), rs = roadOk('s');
    const leet = TOPIC.live ? topicQs(TOPIC.live).filter(q => st(q.id) === 'k').length : 0;
    const ref = TOPIC.refactor ? stats(topicQs(TOPIC.refactor)) : { k: 0, n: 1 };
    const ex = S.hist.filter(h => h.m === 'exam'); const perfect = ex.some(h => h.ok === h.n && h.n >= 10);
    const last5 = ex.slice(-5); const run5 = last5.length === 5 && last5.every(h => h.pass);
    const notes = Object.keys(S.notes).filter(k => S.notes[k]).length, qz = Object.keys(S.qz || {}).length;
    const pair = (a) => `${a.k}/${a.n}`;
    return [
      ['👣', 'Первый шаг', 'Отметьте первый вопрос «✓ Знаю»', all.k >= 1, `${Math.min(all.k, 1)}/1`],
      ['💯', 'Сотня', '100 изученных вопросов', all.k >= 100, `${Math.min(all.k, 100)}/100`],
      ['🏔', 'Половина пути', 'Изучена половина всех вопросов', all.k >= all.n / 2, `${Math.round(all.k / all.n * 100)}%`],
      ['☕', 'Java Core', 'Изучены все вопросы группы Java Core', core.k === core.n, `${core.k}/${core.n}`],
      ['🎓', 'Экзамен сдан', 'Сдайте экзамен (ошибок не больше двух)', exams > 0, exams ? '✓' : '0/1'],
      ['🎫', 'Все билеты', 'Сдайте все билеты', tks === TICKETS.length, `${tks}/${TICKETS.length}`],
      ['🌿', 'Мастер Git', 'Пройдите все уровни Git-тренажёра', g && g.k === g.n, g ? `${g.k}/${g.n}` : ''],
      ['🗄', 'Мастер SQL', 'Решите все задачи SQL-тренажёра', s && s.k === s.n, s ? `${s.k}/${s.n}` : ''],
      ['📘', 'Словарный запас', '100 терминов глоссария отмечены «знаю»', glk >= 100, `${Math.min(glk, 100)}/100`],
      ['🔥', 'Неделя подряд', 'Занимайтесь 7 дней подряд', sk >= 7, `${Math.min(sk, 7)}/7`],
      ['📅', 'Месяц подряд', 'Занимайтесь 30 дней подряд', sk >= 30, `${Math.min(sk, 30)}/30`],
      ['💎', 'Сто дней', 'Занимайтесь 100 дней подряд', sk >= 100, `${Math.min(sk, 100)}/100`],
      ['🚀', 'Пятьсот', '500 изученных вопросов', all.k >= 500, `${Math.min(all.k, 500)}/500`],
      ['🏁', 'Всё изучено', 'Отмечены «знаю» все вопросы', all.k === all.n, `${all.k}/${all.n}`],
      ['🟣', 'Kotlin', 'Изучены все темы группы Kotlin', kt.n && kt.k === kt.n, pair(kt)],
      ['🌱', 'Spring', 'Изучены все темы группы Spring', spr.n && spr.k === spr.n, pair(spr)],
      ['🗃', 'Данные', 'Изучены все темы группы «Данные»', dat.n && dat.k === dat.n, pair(dat)],
      ['🏛', 'Архитектор', 'Изучены все темы группы «Архитектура»', arc.n && arc.k === arc.n, pair(arc)],
      ['🔐', 'Безопасник', 'Изучены все темы группы «Безопасность»', sec.n && sec.k === sec.n, pair(sec)],
      ['🧭', 'Junior пройден', 'Закрыты все пункты дорожной карты Junior', rj[1] && rj[0] === rj[1], `${rj[0]}/${rj[1]}`],
      ['🧗', 'Middle пройден', 'Закрыты все пункты дорожной карты Middle', rm[1] && rm[0] === rm[1], `${rm[0]}/${rm[1]}`],
      ['🦅', 'Senior пройден', 'Закрыты все пункты дорожной карты Senior', rs[1] && rs[0] === rs[1], `${rs[0]}/${rs[1]}`],
      ['💻', 'Решатель', '10 задач LeetCode отмечены решёнными', leet >= 10, `${Math.min(leet, 10)}/10`],
      ['🛠', 'Рефакторинг', 'Все задачи практикума рефакторинга решены', ref.k === ref.n, `${ref.k}/${ref.n}`],
      ['🎯', 'Без единой ошибки', 'Сдайте экзамен (от 10 вопросов) без ошибок', perfect, perfect ? '✓' : ''],
      ['🔁', 'Пять из пяти', 'Сдайте пять экзаменов подряд', run5, `${last5.filter(h => h.pass).length}/5`],
      ['🧪', 'Сто ответов', 'Ответьте на 100 вопросов самотеста', qz >= 100, `${Math.min(qz, 100)}/100`],
      ['📝', 'Конспект', '50 личных заметок к вопросам', notes >= 50, `${Math.min(notes, 50)}/50`],
      ['🦉', 'Ночная сова', 'Позанимайтесь после полуночи', !!S.owl, ''],
      ['🐦', 'Ранняя пташка', 'Позанимайтесь с 5 до 7 утра', !!S.lark, ''],
      ['🔑', 'Взломщик подписей', 'Проверьте подпись JWT в инструментах', !!S.jwtOk, ''],
    ];
  }
  // ---------- достижения: уведомление о новых ----------
  let achT = 0;
  function checkAchievements() {
    clearTimeout(achT);
    achT = setTimeout(() => {
      const got = achievements().filter(a => a[3]).map(a => a[1]);
      if (!Array.isArray(S.achGot)) { S.achGot = got; save(); return; }     // первый расчёт — без поздравлений
      const fresh = got.filter(t => !S.achGot.includes(t)); if (!fresh.length) return;
      S.achGot = got; save();
      fresh.forEach((t, i) => setTimeout(() => { const a = achievements().find(x => x[1] === t); toast(`🏆 Новое достижение: ${a ? a[0] + ' ' : ''}${t}`); }, i * 2200));
    }, 500);
  }

  // ---------- экскурсия для нового пользователя ----------
  const TOUR = [
    ['.mod-grid', 'Модули', 'Тренажёры, тесты, тренировка, глоссарий, прогресс и инструменты. Наведите на иконку — появится подсказка, что она делает.'],
    ['.nav', 'Темы', 'Все темы по группам: от Java Core и Kotlin до архитектуры и практики. Когда вы читаете тему, меню само сворачивается до иконок, чтобы не отвлекать; наведите на него — оно развернётся.'],
    ['#bottomBar', 'Быстрые переходы', 'Главная, темы, LeetCode, тесты и прогресс — всегда под рукой.'],
    ['#menuBtn', 'Меню', 'Здесь все модули и темы.'],
    ['#lvSeg', 'Уровень ответа', 'Junior — основа, Middle — детали и практика, Senior — устройство и компромиссы, «Подробно» — развёрнутая статья.'],
    ['.search', 'Поиск', 'Ищет по вопросам и ответам. Клавиша / или Ctrl+K.'],
    ['#themeBtn', 'Оформление', 'Светлая или тёмная тема и пять стилей.'],
    ['.home-head a[href="#/about"]', 'О приложении', 'Что умеет VibeOFF, как заниматься каждый день, обратная связь. Загляните сюда первым делом!'],
  ];
  let tourEls = null;
  function tourVisible(el) { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden'; }
  function endTour() { if (tourEls) { tourEls.hole.remove(); tourEls.card.remove(); tourEls = null; } S.tourDone = true; save(); window.removeEventListener('resize', tourPlace); }
  function tourPlace() {
    if (!tourEls) return;
    const { steps, i, hole, card } = tourEls; const el = $(steps[i][0]); if (!el) return endTour();
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: Math.min(r.height, innerHeight - 20) + pad * 2 + 'px' });
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x = r.right + 16, y = r.top;
    if (x + cw > innerWidth - 10) { x = Math.min(Math.max(10, r.left), innerWidth - cw - 10); y = r.bottom + 14; if (y + ch > innerHeight - 10) y = r.top - ch - 14; }
    card.style.left = Math.max(10, x) + 'px'; card.style.top = Math.max(10, Math.min(y, innerHeight - ch - 10)) + 'px';
  }
  function startTour() {
    if (tourEls) return;
    const steps = TOUR.filter(s => tourVisible($(s[0]))); if (!steps.length) return;
    const hole = document.createElement('div'); hole.className = 'tour-hole';
    const card = document.createElement('div'); card.className = 'tour-card'; card.setAttribute('role', 'dialog');
    document.body.append(hole, card);
    tourEls = { steps, i: 0, hole, card };
    const show = () => {
      const { i } = tourEls; const [, t, d] = steps[i];
      card.innerHTML = `<div class="tour-n">${i + 1} из ${steps.length}</div><b>${esc(t)}</b><p>${esc(d)}</p><div class="tour-act"><button class="chip" id="tourSkip">Пропустить</button><span class="sp"></span>${i ? '<button class="chip" id="tourPrev">Назад</button>' : ''}<button class="btn" id="tourNext">${i === steps.length - 1 ? 'Готово' : 'Далее'}</button></div>`;
      $('#tourSkip').onclick = endTour;
      if ($('#tourPrev')) $('#tourPrev').onclick = () => { tourEls.i--; show(); };
      $('#tourNext').onclick = () => { if (tourEls.i === steps.length - 1) endTour(); else { tourEls.i++; show(); } };
      tourPlace(); $('#tourNext').focus({ preventScroll: true });
    };
    window.addEventListener('resize', tourPlace);
    show();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && tourEls) endTour(); });

  function hblock(id, title, body, extra) {
    const fold = !!(S.homeFold || {})[id];
    return `<section class="hblock${fold ? ' folded' : ''}" data-hb="${id}"><div class="hb-h"><h2>${title}</h2>${extra || ''}<button class="hb-fold" data-hint="${fold ? 'Развернуть блок' : 'Свернуть блок'}" aria-label="Свернуть или развернуть">▾</button></div><div class="hb-body">${body}</div></section>`;
  }
  function pageHome() {
    const all = stats(ORDER); const fresh = isNewUser();
    const last = S.last && Q[S.last] ? Q[S.last] : null;
    const repN = ORDER.filter(q => st(q.id) === 'r').length;
    const nx = nextRoadItem(); const nxQ = nx ? Q[nx.it.ids.find(id => st(id) !== 'k') || nx.it.ids[0]] : null;
    const sk = streak(); const heat = heatHTML(); const weak = weakTopics();
    const head = `<div class="home-head"><div><h1>VibeOFF <span class="slogan">· Выруби автопилот. Вруби мозги</span></h1><p>${fresh ? 'Тренажёр и учебник Java-разработчика: от основ языка до архитектуры. Чтобы навыки не зависели от автодополнения.' : `Изучено ${all.k} из ${all.n} · на повторении ${all.r}${sk ? ` · 🔥 ${plural(sk, 'день', 'дня', 'дней')} подряд` : ''}`}</p></div>
      <div class="home-head-r">${META.download && location.protocol.startsWith('http') ? `<a class="hh-btn" href="${esc(META.download)}" data-hint="Скачать приложение на компьютер: распакуйте архив и откройте index.html — работает без интернета">⬇ Скачать</a>` : ''}<a class="hh-btn${S.aboutSeen ? '' : ' pulse'}" href="#/about" data-hint="Что умеет приложение, как им пользоваться, автор и обратная связь">ℹ️ О приложении</a></div></div>`;
    const news = !fresh && META.version && S.seenVersion !== META.version && (META.changelog || [])[0]
      ? `<div class="home-news"><span>✨ Новое в v${esc(META.version)}: <b>${esc(META.changelog[0].title)}</b></span><a href="javascript:void 0" data-changes>Подробнее</a></div>` : '';
    const lvBtns = ['j', 'm', 's'].map(k => `<button class="chip${S.level === k ? ' on' : ''}" data-setlv="${k}">${LV[k]}</button>`).join('');
    const today = fresh
      ? `<div class="start-steps">
          <div class="step"><b>1</b><div><h3>Выберите уровень ответов</h3><p>Его можно сменить в любой момент вверху страницы.</p><div class="chips">${lvBtns}</div></div></div>
          <div class="step"><b>2</b><div><h3>Начните с первой темы</h3><p>Дорожная карта подскажет порядок изучения.</p><div class="chips"><a class="chip on" href="#/t/core1">Язык и ООП →</a><a class="chip" href="#/road">🧭 Дорожная карта</a></div></div></div>
          <div class="step"><b>3</b><div><h3>Проверьте себя</h3><p>Короткий самотест покажет, что вы уже знаете.</p><div class="chips"><a class="chip" href="#/quiz">🧪 Самотест</a><a class="chip" href="#/about">ℹ️ Как всё устроено</a></div></div></div>
        </div>`
      : `<div class="today">
          ${last ? `<a class="td-card" href="#/q/${last.id}"><span class="td-i">▶</span><span class="td-t">Продолжить</span><span class="td-d">${esc(last.q)}</span></a>` : ''}
          <a class="td-card${repN ? '' : ' muted-card'}" href="${repN ? '#/train/repeat' : '#/repeat'}"><span class="td-i">↻</span><span class="td-t">${repN ? `Повторить ${plural(repN, 'вопрос', 'вопроса', 'вопросов')}` : 'Повторять нечего'}</span><span class="td-d">${repN ? 'Карточки из списка «На повторение»' : 'Отмечайте «↻ Повторить» у трудных вопросов'}</span></a>
          ${nx ? `<a class="td-card" href="${nxQ ? '#/q/' + nxQ.id : '#/road/' + nx.r.key}"><span class="td-i">🧭</span><span class="td-t">Дальше по карте · ${esc(nx.r.lv)}</span><span class="td-d">${esc(nx.it.t)}</span></a>` : ''}
        </div>`;
    const q = questionOfDay(); const term = termOfDay(); const ex = exampleOfDay();
    const daily = `<div class="daily">
        <div class="panel qod"><div class="qod-h"><span>📅 Вопрос дня</span><span class="muted">${esc(q.topic.title)}</span><button class="chip" id="qodNext" data-hint="Показать другой вопрос на сегодня">↻ Другой</button></div>${cardHTML(q)}</div>
        <div class="daily-side">
          ${term ? `<div class="panel mini"><div class="qod-h"><span>📘 Термин дня</span></div><b class="mini-t">${esc(term.t)}</b><p>${esc(term.d)}</p><a href="#/q/${term.q}">Подробнее →</a></div>` : ''}
          ${ex ? `<div class="panel mini"><div class="qod-h"><span>✅❌ Пример дня</span></div><b class="mini-t">${esc(ex.t)}</b><p class="muted">${esc(ex.topic.title)}</p><a href="#/t/${ex.topic.slug}/do">Как правильно →</a></div>` : ''}
        </div></div>`;
    const ach = achievements(); const got = ach.filter(a => a[3]).length;
    const progress = `<div class="prog-grid">
        <div class="panel"><div class="pg-h"><b>Активность</b><span class="muted">${sk ? `🔥 ${plural(sk, 'день', 'дня', 'дней')} подряд · ` : ''}${plural(heat.active, 'день', 'дня', 'дней')} с занятиями</span></div>${heat.html}
          <div class="heat-leg"><span>меньше</span><i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i><span>больше</span></div>
          <div class="pg-sum">${barHTML(all)}<span>Изучено ${all.k} из ${all.n} · на повторении ${all.r}</span></div></div>
        <div class="panel"><div class="pg-h"><b>Слабые места</b><a class="muted" href="#/stats">статистика →</a></div>
          ${weak.length ? weak.map(r => `<a class="list-link" href="#/quiz/${r.t.slug}"><span class="tt">${esc(r.t.title)}</span><span class="m">${r.acc}% верных · потренировать →</span></a>`).join('') : `<p class="muted">${Object.keys(S.qz).length ? 'Слабых мест нет — во всех пройденных темах больше 70% верных ответов.' : 'Пройдите самотест по нескольким темам — здесь появятся темы, которые стоит подтянуть.'}</p>`}
          <div class="pg-h" style="margin-top:14px"><b>Достижения</b><span class="muted">${got} из ${ach.length}</span></div>
          <div class="ach">${ach.map(([i, t, d, ok, p]) => `<span class="ach-i${ok ? ' ok' : ''}" data-hint="${esc(t)}: ${esc(d)}${p && !ok ? ' · ' + esc(p) : ok ? ' · получено ✓' : ''}">${i}</span>`).join('')}</div></div>
      </div>`;
    const trainers = [
      ...MODULES.filter(m => m.topic || m.trainer).map(m => {
        const ts = m.topic ? topicQs(TOPIC[m.topic]) : null; const pr = m.prog ? m.prog(S) : ts ? { k: ts.filter(x => st(x.id) === 'k').length, n: ts.length } : null;
        return { href: m.href, ico: m.ico, t: m.long || m.t, d: ts ? plural(ts.length, 'задача', 'задачи', 'задач') : m.desc, pr, hint: HINTS[m.id] };
      }),
      { href: '#/dodont', ico: '✅', t: 'Правильно и неправильно', d: `${plural(DD_ALL.length, 'пример', 'примера', 'примеров')} «как не надо / как надо»`, pr: null, hint: HINTS.dodont },
    ];
    const trHTML = `<div class="trainers">${trainers.map(x => `<a class="trainer" href="${x.href}" data-hint="${esc(x.hint || '')}"><span class="ti">${x.ico}</span><span class="tt">${esc(x.t)}</span><span class="td">${esc(x.d || '')}</span>${x.pr ? `<span class="tp">${barHTML({ k: x.pr.k, r: 0, n: x.pr.n }, 'mini-bar')}<span>${x.pr.k}/${x.pr.n}</span></span>` : ''}</a>`).join('')}</div>`;
    const started = D.topics.filter(t => !t.module && t.count).map(t => ({ t, s: stats(topicQs(t)) })).filter(r => r.s.k + r.s.r > 0 && r.s.k < r.s.n)
      .sort((a, b) => b.s.k / b.s.n - a.s.k / a.s.n).slice(0, 3);
    const openG = (S.homeGroups || {});
    const topicsHTML = (started.length ? `<div class="cont-list">${started.map(r => `<a class="cont" href="#/t/${r.t.slug}"><span class="tt">${esc(r.t.title)}</span>${barHTML(r.s, 'mini-bar')}<span class="m">${r.s.k}/${r.s.n}</span></a>`).join('')}</div>` : '') +
      `<div class="glist">${D.groups.map(g => { const ts = D.topics.filter(t => t.group === g && !t.module); const gs = stats(ts.flatMap(topicQs)); return `<div class="gl-row2${openG[g] ? ' open' : ''}" data-g="${esc(g)}"><button class="gl-h2"><span class="chev">▶</span><b>${esc(g)}</b><span class="gl-bar">${barHTML(gs, 'mini-bar')}</span><span class="muted">${gs.k}/${gs.n}</span></button><div class="gb-topics">${ts.map(t => { const s = stats(topicQs(t)); return `<a href="#/t/${t.slug}" class="gb-t${s.k === s.n && s.n ? ' done' : ''}">${esc(t.title)}<span>${s.k}/${s.n}</span></a>`; }).join('')}</div></div>`; }).join('')}</div>`;
    const qt = quoteOfDay();
    main().innerHTML = `<div class="page wide home">${head}${news}
      ${qt ? `<div class="quote"><span class="q-mark">“</span><div><div class="q-text">${esc(qt[0])}</div><div class="q-auth">— ${esc(qt[1])}</div></div><button class="chip" id="qtNext" data-hint="Другая цитата">↻</button></div>` : ''}
      ${hblock('today', fresh ? 'С чего начать' : 'Сегодня', today)}
      ${hblock('daily', 'На каждый день', daily)}
      ${fresh ? '' : hblock('prog', 'Прогресс', progress)}
      ${hblock('trainers', 'Тренажёры', trHTML)}
      ${hblock('topics', 'Темы', topicsHTML, started.length ? '<span class="muted hb-sub">продолжить изучение</span>' : '')}
      <div class="home-foot">${esc(META.title || 'VibeOFF')} · ${esc(META.author || '')} · <a href="javascript:void 0" data-changes>v${esc(META.version || '')} — что нового</a> · <a href="#/about">о приложении</a> · <a href="#/about/support">поддержать автора</a></div>
    </div>`;
    $('#qodNext').onclick = () => { S.qod.skip++; save(); const sc = $('.main').scrollTop; pageHome(); $('.main').scrollTop = sc; };
    const hm = $('.heat'); if (hm) hm.scrollLeft = hm.scrollWidth;
    if ($('#qtNext')) $('#qtNext').onclick = () => { S.qtSkip = (S.qtSkip || 0) + 1; save(); const qq = quoteOfDay(); $('.q-text').textContent = qq[0]; $('.q-auth').textContent = '— ' + qq[1]; };
    if (fresh && !S.tourDone) setTimeout(() => { if (location.hash === '' || location.hash === '#/') startTour(); }, 900);
    $$('[data-setlv]').forEach(b => b.onclick = () => { setLevel(b.dataset.setlv); $$('[data-setlv]').forEach(x => x.classList.toggle('on', x === b)); });
    $$('.hb-fold').forEach(b => b.onclick = () => { const s = b.closest('.hblock'); s.classList.toggle('folded'); S.homeFold = S.homeFold || {}; S.homeFold[s.dataset.hb] = s.classList.contains('folded'); b.dataset.hint = S.homeFold[s.dataset.hb] ? 'Развернуть блок' : 'Свернуть блок'; save(); });
    $$('.gl-h2').forEach(b => b.onclick = () => { const r = b.parentElement; r.classList.toggle('open'); S.homeGroups = S.homeGroups || {}; S.homeGroups[r.dataset.g] = r.classList.contains('open'); save(); });
  }

  // ---------- о приложении ----------
  function pageAbout() {
    const email = META.email || '';
    if (!S.aboutSeen) { S.aboutSeen = true; save(); }
    const F = [
      ['📚', 'Темы и уровни ответов', `${D.topics.filter(t => !t.module).length} тем и ${ORDER.length} вопросов. У каждого вопроса — ответы Junior, Middle, Senior и статья «Подробно»; уровень переключается вверху страницы или клавишами 1–5.`, '#/t/core1'],
      ['✅', 'Правильно и неправильно', 'Типичные ошибки в коде рядом с исправленным вариантом. Наведите на отмеченную строку — появится пояснение.', '#/dodont'],
      ['🔎', 'Поиск', 'Ищет по вопросам и текстам ответов. Клавиша / или Ctrl+K.', null],
      ['🎯', 'Тренировка', 'Карточки: вспомните ответ, откройте его и отметьте «знаю» или «повторить». Есть тренировка терминов глоссария.', '#/train'],
      ['🧪', 'Самотест и экзамен', `Вопросы с разбором ответов и экзамен по билетам: ${plural(ZALL.length, 'вопрос', 'вопроса', 'вопросов')} в банке.`, '#/quiz'],
      ['🧭', 'Дорожная карта', 'Что нужно знать на каждом уровне — от Junior до Staff; пункты закрываются по мере изучения.', '#/road'],
      ['📘', 'Глоссарий и сравнения', `${GL.length} терминов и аннотаций (в ответах подчёркнуты — наведите для определения) и вопросы вида «X против Y».`, '#/gloss'],
      ['💻', 'LeetCode и лайфкодинг', 'Задачи с режимом «Решить самому»: редактор кода, подсказки по шагам, разбор и решение.', '#/leetcode'],
      ['🛠', 'Практикум рефакторинга', 'Плохой код открывается в редакторе — найдите и исправьте проблемы, затем сверьтесь с разбором.', '#/refactor'],
      ['🌿', 'Git-тренажёр', 'Вводите команды git — граф коммитов перестраивается сразу. Уровни и песочница.', '#/gitlab'],
      ['🧰', 'Инструменты: JWT, JSON, хеши', 'Разбор и проверка подписи JWT, создание токенов; проверка JSON с понятными ошибками, форматирование и дерево с путями; Base64, Hex, SHA-256 и HMAC.', '#/jwt'],
      ['🗄', 'SQL-тренажёр', 'Настоящая база SQLite прямо в браузере, задачи с автопроверкой.', '#/sql'],
      ['💡', 'IntelliJ IDEA', 'Горячие клавиши (Windows/Linux и macOS), приёмы, отладка, шаблоны и тренажёр сочетаний.', '#/idea'],
      ['📝', 'Заметки и блокнот кода', 'Личная заметка к любому вопросу и блокнот с подсветкой Java — всё сохраняется автоматически.', '#/notes'],
      ['📊', 'Прогресс', 'Статистика по темам, слабые места, история тестов, активность и достижения на главной.', '#/stats'],
      ['👥', 'Профили', 'У каждого пользователя на компьютере свой прогресс: меню с именем под логотипом.', null],
      ['◐', 'Оформление и телефон', 'Кнопка ◐ справа вверху: светлая, тёмная или системная тема и пять стилей (Soft Lime, Sage, Terminal Green, Electric Lime, Классика). На телефоне — меню ☰ и нижняя панель.', null],
    ];
    const routine = ['Откройте вопрос дня на главной и ответьте себе вслух, прежде чем раскрыть ответ.', 'Пройдите карточки «На повторение» — 5–10 минут.', 'Изучите следующий пункт дорожной карты и отметьте вопросы «✓ Знаю».', 'Решите задачу в одном из тренажёров: LeetCode, рефакторинг, Git или SQL.', 'Раз в неделю сдавайте билет или экзамен — так видно, что закрепилось.'];
    main().innerHTML = `<div class="page about"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">О приложении</h1>
      <p class="subtitle">${esc(META.title || 'VibeOFF')} · версия ${esc(META.version || '')} · <a href="javascript:void 0" data-changes>что нового</a></p>
      <div class="panel about-why"><h3>Зачем это приложение</h3>
        <p><b>VibeOFF</b> — «Выруби автопилот. Вруби мозги». Этот учебник-тренажёр создан, чтобы не забывать навыки программирования в условиях быстро развивающихся технологий искусственного интеллекта. Ассистенты пишут всё больше кода, но понимать его, проверять и принимать решения по-прежнему должен разработчик. Здесь можно регулярно повторять основы Java и углубляться — от Junior до Staff.</p>
        <p class="muted">Работает без интернета и без установки. Прогресс, заметки и результаты сохраняются в браузере автоматически, отдельно для каждого профиля.</p></div>
      <div class="sec-title">Что можно делать</div>
      <div class="feat-grid">${F.map(([i, t, d, h]) => `${h ? `<a class="feat" href="${h}"` : '<div class="feat"'}><span class="fi">${i}</span><b>${esc(t)}</b><span>${esc(d)}</span>${h ? '</a>' : '</div>'}`).join('')}</div>
      ${META.download ? `<div class="sec-title">Работа без интернета</div><div class="panel offline-box">${location.protocol.startsWith('http')
        ? `<p>Скачайте приложение на компьютер: распакуйте архив и откройте файл <b>index.html</b>. Всё будет работать без интернета; прогресс в скачанной копии хранится отдельно от сайта.</p><a class="btn" href="${esc(META.download)}" data-hint="Скачать архив приложения (zip)">⬇ Скачать VibeOFF</a>`
        : `<p>Это скачанная копия — она работает без интернета. Когда интернет есть, приложение само проверяет, не вышла ли новая версия.${META.site ? ` Онлайн-версия: <a href="${esc(META.site)}" target="_blank" rel="noopener">${esc(META.site)}</a>` : ''}</p><a class="btn" href="${esc(META.download)}">⬇ Скачать последнюю версию</a>`}</div>` : ''}
      <div class="sec-title">Как заниматься</div>
      <div class="panel"><div class="tour-again"><button class="chip" id="tourAgain" data-hint="Короткая экскурсия по интерфейсу на главной странице">▶ Показать экскурсию по интерфейсу</button></div><ol class="routine">${routine.map(r => `<li>${esc(r)}</li>`).join('')}</ol>
        <p class="muted" style="margin:8px 0 0">Подсказка: наведите на любую иконку или кнопку — появится описание того, что она делает.</p></div>
      <div class="sec-title">Клавиши</div>
      <div class="tbl"><table><tbody>
        <tr><td><kbd>/</kbd> или <kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>поиск</td></tr>
        <tr><td><kbd>R</kbd></td><td>случайный вопрос</td></tr>
        <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>уровень ответа: Junior, Middle, Senior, Все, Подробно</td></tr>
        <tr><td><kbd>Пробел</kbd></td><td>в тренировке — показать ответ</td></tr>
        <tr><td><kbd>1</kbd>–<kbd>9</kbd>, <kbd>Enter</kbd></td><td>в тестах — выбрать вариант, проверить, дальше</td></tr>
        <tr><td><kbd>Tab</kbd>, <kbd>Shift</kbd>+<kbd>Tab</kbd>, <kbd>Ctrl</kbd>+<kbd>/</kbd></td><td>в редакторе кода — отступ, убрать отступ, закомментировать</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>закрыть окно или просмотр изображения</td></tr>
      </tbody></table></div>
      <div class="sec-title">Автор</div>
      <div class="panel author">
        <div class="au-name">${esc(META.author || '')}</div>
        <div class="au-mail">✉ Обратная связь: <a href="mailto:${esc(email)}">${esc(email)}</a> <button class="chip" id="auCopy" data-hint="Скопировать адрес в буфер обмена">Скопировать адрес</button></div>
        <h3>Пожелания по обучению</h3>
        <p>Чего не хватает: темы, вопроса, тренажёра, примера? Нашли ошибку? Напишите — учту в следующих версиях.</p>
        <input id="auFrom" class="au-in" type="email" placeholder="Ваша почта для ответа (необязательно)" value="${esc(S.fbEmail || '')}" autocomplete="email">
        <textarea id="auWish" placeholder="Например: добавить тему про …, в вопросе «…» неточность, хочется тренажёр по …">${esc(S.wish || '')}</textarea>
        <input id="auHoney" class="au-honey" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="au-act"><button class="btn" id="auSend" data-hint="Отправить сообщение автору">✉ Отправить</button><span class="muted" id="auNote">${META.feedback ? 'Сообщение уйдёт автору сразу. Без интернета откроется почтовая программа.' : 'Откроется почтовая программа с готовым письмом.'}</span></div>
        <div id="auRes"></div>
        <blockquote class="au-quote">«Зорко одно лишь сердце. Самого главного глазами не увидишь.»<cite>— Антуан де Сент-Экзюпери, «Маленький принц»</cite></blockquote>
      </div>
      ${(META.support || []).length ? `<div class="sec-title" id="support">Поддержать автора</div>
      <div class="panel support">
        <p>VibeOFF бесплатный и работает без рекламы. Если он помогает вам учиться и вы хотите поддержать развитие — новые темы, тренажёры и исправления, — можно сделать перевод по реквизитам. Любая сумма — спасибо!</p>
        <div class="tbl"><table><tbody>${META.support.map(([k, v], i) => `<tr><td class="sup-k">${esc(k)}</td><td class="sup-v">${esc(v)}</td><td class="sup-c"><button class="chip" data-sup="${i}" data-hint="Скопировать «${esc(k)}»">Копировать</button></td></tr>`).join('')}</tbody></table></div>
        <div class="au-act"><button class="btn" id="supAll" data-hint="Скопировать все реквизиты одним текстом">Скопировать все реквизиты</button><span class="muted">Перевод по номеру счёта в приложении любого банка: банк сам подставит корреспондентский счёт по БИК.</span></div>
      </div>` : ''}</div>`;
    $('#auCopy').onclick = () => navigator.clipboard ? navigator.clipboard.writeText(email).then(() => toast('Адрес скопирован'), () => fallbackCopy(email)) : fallbackCopy(email);
    $('#auWish').oninput = e => { S.wish = e.target.value; save(); };
    const cp = (t, msg) => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => toast(msg), () => fallbackCopy(t)) : fallbackCopy(t);
    $$('[data-sup]').forEach(b => b.onclick = () => { const [k, v] = META.support[+b.dataset.sup]; cp(v, k + ' — скопировано'); });
    if ($('#supAll')) $('#supAll').onclick = () => cp(META.support.map(([k, v]) => k + ': ' + v).join('\n'), 'Реквизиты скопированы');
    $('#tourAgain').onclick = () => { S.tourDone = false; location.hash = '#/'; setTimeout(startTour, 500); };
    $('#auFrom').oninput = e => { S.fbEmail = e.target.value.trim(); save(); };
    const mailBody = () => $('#auWish').value.trim() + `\n\n—\n${META.title || ''} v${META.version || ''}` + (S.fbEmail ? `\nОтвет: ${S.fbEmail}` : '');
    const mailto = () => { location.href = `mailto:${email}?subject=${encodeURIComponent('VibeOFF: пожелание')}&body=${encodeURIComponent(mailBody())}`; };
    const fallback = why => {
      $('#auRes').innerHTML = `<div class="au-res warn">${esc(why)} Отправьте письмом:<div class="au-act"><button class="chip" id="auMail">✉ Открыть почтовую программу</button><button class="chip" id="auCopyAll">Скопировать адрес и текст</button></div></div>`;
      $('#auMail').onclick = mailto; $('#auCopyAll').onclick = () => cp(email + '\n\n' + mailBody(), 'Адрес и текст скопированы');
    };
    $('#auSend').onclick = async () => {
      const text = $('#auWish').value.trim(), from = $('#auFrom').value.trim();
      if (!text) { toast('Напишите сообщение'); $('#auWish').focus(); return; }
      if (from && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from)) { toast('Проверьте адрес почты для ответа'); $('#auFrom').focus(); return; }
      if ($('#auHoney').value) return;
      if (!META.feedback) { mailto(); return; }
      if (!navigator.onLine) { fallback('Нет подключения к интернету.'); return; }
      const btn = $('#auSend'); btn.disabled = true; btn.textContent = 'Отправляю…'; $('#auRes').innerHTML = '';
      const data = { access_key: META.feedbackKey || '', subject: 'VibeOFF: пожелание', from_name: from || 'Пользователь VibeOFF', message: text,
        version: META.version || '', page: location.protocol.startsWith('http') ? 'сайт' : 'скачанная копия' };
      if (from) { data.email = from; data.replyto = from; }
      try {
        const r = await fetch(META.feedback, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({}));
        const ok = r.ok && (j.success === true || String(j.success) === 'true');
        if (ok) { $('#auRes').innerHTML = `<div class="au-res ok">✓ Спасибо! Сообщение отправлено${from ? ', ответ придёт на ' + esc(from) : ''}.</div>`; $('#auWish').value = ''; S.wish = ''; save(); }
        else fallback('Сервис не принял сообщение.');
      } catch (e) { fallback('Не удалось связаться с сервисом отправки.'); }
      finally { btn.disabled = false; btn.textContent = '✉ Отправить'; }
    };
    $('.main').scrollTop = 0;
  }

  // ---------- всплывающие подсказки к иконкам и кнопкам ----------
  const HINTS = {
    home: 'Главная: план на сегодня, вопрос дня, прогресс и достижения',
    leet: 'LeetCode и лайфкодинг: решите задачу сами в редакторе, затем сверьтесь с подсказками и разбором',
    ref: 'Практикум рефакторинга: исправьте плохой код и сравните с решением',
    gitlab: 'Git-тренажёр: команды git и живой граф коммитов, уровни и песочница',
    sqllab: 'SQL-тренажёр: настоящая база SQLite в браузере, задачи с автопроверкой',
    idea: 'IntelliJ IDEA: горячие клавиши, приёмы, отладка и тренажёр сочетаний',
    tests: 'Тесты: самотест с разбором ответов, экзамен и билеты',
    train: 'Тренировка: карточки вопросов и терминов — «знаю» или «повторить»',
    road: 'Дорожная карта: что знать на уровнях Junior, Middle, Senior, Staff',
    gloss: 'Глоссарий: термины и аннотации, сравнения «X против Y», примеры «правильно и неправильно»',
    prog: 'Прогресс: статистика, вопросы на повторение, заметки, ключевые вопросы',
    about: 'О приложении: возможности, как заниматься, автор и обратная связь',
    tools: 'Инструменты: JWT (разбор, проверка, создание), JSON (проверка, форматирование, исправление), хеши и Base64 — офлайн',
    dodont: 'Правильно и неправильно: типичные ошибки в коде и исправленные варианты',
  };
  const LV_HINT = { j: 'Junior: коротко и по сути — основа, которую нужно знать', m: 'Middle: детали, подводные камни и практика', s: 'Senior: внутреннее устройство, компромиссы, архитектура', a: 'Все уровни сразу: Junior + Middle + Senior', d: 'Подробно: развёрнутая статья с таблицами и примерами' };
  const hintEl = document.createElement('div'); hintEl.className = 'hint-pop'; document.body.appendChild(hintEl);
  let hintFor = null, hintT = 0;
  const hintText = el => el.dataset.hint || (el.matches('#lvSeg button') ? LV_HINT[el.dataset.l] : '');
  document.addEventListener('mouseover', e => {
    if (!matchMedia('(hover: hover)').matches) return;
    const el = e.target.closest && e.target.closest('[data-hint], #lvSeg button');
    if (el === hintFor) return;
    hintFor = el; clearTimeout(hintT); hintEl.classList.remove('show');
    if (!el || !hintText(el)) return;
    hintT = setTimeout(() => {
      if (hintFor !== el || !document.body.contains(el)) return;
      hintEl.textContent = hintText(el); hintEl.classList.add('show');
      const r = el.getBoundingClientRect(), w = hintEl.offsetWidth, h = hintEl.offsetHeight;
      let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
      if (y + h > innerHeight - 8) y = r.top - h - 8;
      hintEl.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; hintEl.style.top = Math.max(8, y) + 'px';
    }, 350);
  });
  document.addEventListener('mousedown', () => { clearTimeout(hintT); hintEl.classList.remove('show'); hintFor = null; });
  window.addEventListener('hashchange', () => { clearTimeout(hintT); hintEl.classList.remove('show'); hintFor = null; });

  let topicFilter = 'all';
  function pageTopic(slug, focusId) {
    const t = TOPIC[slug]; if (!t) return pageHome();
    const qs = topicQs(t);
    const s = stats(qs);
    if (!t.count) {
      main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a> · ${esc(t.group)}</div><h1 class="title">${esc(t.title)}</h1><p class="subtitle">Шпаргалки — кликните по изображению, чтобы открыть в полном размере.</p>${galleryHTML(t.gallery, 'Шпаргалки', true)}</div>`;
      return;
    }
    const cnt = { all: qs.length, new: qs.filter(q => !st(q.id)).length, r: qs.filter(q => st(q.id) === 'r').length, k: qs.filter(q => st(q.id) === 'k').length, star: qs.filter(q => q.star).length };
    const pass = q => topicFilter === 'all' || (topicFilter === 'new' && !st(q.id)) || (topicFilter === 'star' && q.star) || st(q.id) === topicFilter;
    main().innerHTML = `<div class="topic-layout"><div>
      <div class="topic-head"><div class="crumbs"><a href="#/">Главная</a> · ${t.module ? `<a href="${t.module === 'leetcode' ? '#/leetcode' : '#/refactor'}">← к каталогу задач</a>` : esc(t.group)}</div><h1 class="title">${esc(t.title)}</h1>
        ${topicSwitch(t, false)}<div class="progress">${barHTML(s)}<span class="lbl" id="tpLbl">изучено ${s.k} из ${s.n} · повторить ${s.r}</span></div>
        <div class="chips">${[['all', 'Все'], ['new', 'Не изучено'], ['r', '↻ Повторить'], ['k', '✓ Знаю'], ['star', '★ Ключевые']].filter(([k]) => k !== 'star' || cnt.star).map(([k, l]) => `<button class="chip${topicFilter === k ? ' on' : ''}" data-f="${k}">${l}<span class="n">${cnt[k]}</span></button>`).join('')}
          <span class="sp"></span><button class="chip" id="expAll">Развернуть все</button><button class="chip" id="colAll">Свернуть</button><a class="chip" href="#/train/${t.slug}">🎯 Тренировка</a>${QZ_BY_T[t.slug] ? `<a class="chip" href="#/quiz/${t.slug}">🧪 Тест по теме · ${QZ_BY_T[t.slug].length}</a>` : ''}</div></div>
      ${t.sections.map(sec => { const items = sec.items.filter(pass); if (!items.length) return ''; return (sec.title ? `<div class="sec-title">${esc(sec.title)}</div>` : '') + items.map(q => cardHTML(q)).join(''); }).join('') || '<div class="empty"><div class="big">🎉</div>В этом фильтре вопросов нет</div>'}
      ${t.gallery && t.gallery.length ? `<div class="sec-title">Архив: слайды по JUnit 4</div><div class="panel legacy"><p class="muted" style="margin-top:0">Это слайды по <b>JUnit 4</b> (@Before, @BeforeClass, @Ignore, @Test(expected/timeout), правило «should» в имени). Для справки они сохранены, но в новых проектах используйте JUnit 5/6 — актуальные схемы и таблица соответствия аннотаций приведены в вопросах выше.</p>${galleryHTML(t.gallery, 'JUnit 4 — устаревшие слайды')}</div>` : ''}
    </div><button class="outline-tab" id="olTab" data-hint="Содержание темы: наведите или нажмите">☰ Содержание</button><aside class="outline"><div class="outline-h"><span>Содержание темы</span><button class="ol-pin" id="olPin" data-hint="${S.outlinePin ? 'Спрятать содержание к краю — оно будет выезжать при наведении' : 'Закрепить содержание колонкой справа'}">${S.outlinePin ? '⇥' : '📌'}</button></div>${t.sections.map(sec => (sec.title ? `<div class="o-sec">${esc(sec.title)}</div>` : '') + sec.items.filter(pass).map(q => `<a href="#/q/${q.id}" data-id="${q.id}" class="${st(q.id)}">${esc(q.q)}</a>`).join('')).join('')}</aside></div>`;
    $$('.chip[data-f]').forEach(c => c.onclick = () => { topicFilter = c.dataset.f; pageTopic(slug); });
    mountOutline();
    $('#expAll').onclick = () => $$('.card').forEach(c => toggleCard(c, true));
    $('#colAll').onclick = () => $$('.card').forEach(c => toggleCard(c, false));
    // scrollspy
    if (outlineObs) outlineObs.disconnect();
    outlineObs = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { $$('.outline a.cur').forEach(a => a.classList.remove('cur')); const a = $(`.outline a[data-id="${en.target.dataset.id}"]`); if (a) { a.classList.add('cur'); const o = $('.outline'); if (a.offsetTop < o.scrollTop || a.offsetTop > o.scrollTop + o.clientHeight - 40) o.scrollTop = a.offsetTop - 120; } } });
    }, { root: $('.main'), rootMargin: '-80px 0px -70% 0px' });
    $$('.card').forEach(c => outlineObs.observe(c));
    if (focusId) {
      let card = $('#q-' + CSS.escape(focusId));
      if (!card) { topicFilter = 'all'; return pageTopic(slug, focusId); }
      toggleCard(card, true); S.last = focusId; save();
      requestAnimationFrame(() => { card.scrollIntoView({ block: 'start', behavior: 'instant' }); card.classList.add('flash'); });
    } else $('.main').scrollTop = 0;
  }
  // содержание темы: прячется к правому краю, выезжает при наведении или нажатии на язычок; 📌 — закрепить колонкой
  let olT = 0;
  function setOutlineMode() {
    const has = !!$('.topic-layout .outline');
    document.body.classList.toggle('has-outline', has);
    document.body.classList.toggle('ol-auto', has && !S.outlinePin);
    if (!has) document.body.classList.remove('ol-open');
  }
  function mountOutline() {
    setOutlineMode();
    const ol = $('.topic-layout .outline'), tab = $('#olTab'); if (!ol || !tab) return;
    const open = v => { clearTimeout(olT); if (v) document.body.classList.add('ol-open'); else olT = setTimeout(() => document.body.classList.remove('ol-open'), 280); };
    const hover = () => matchMedia('(hover: hover)').matches;
    tab.onmouseenter = () => { if (hover()) open(true); };
    tab.onclick = () => open(true);
    ol.onmouseenter = () => { if (document.body.classList.contains('ol-auto')) open(true); };
    ol.onmouseleave = () => { if (document.body.classList.contains('ol-auto') && hover()) open(false); };
    $('#olPin').onclick = e => { e.stopPropagation(); S.outlinePin = !S.outlinePin; save(); document.body.classList.remove('ol-open'); const sc = $('.main').scrollTop; pageTopic(curTopicPage ? curTopicPage.slug : (location.hash.match(/^#\/t\/([^/]+)/) || [])[1]); $('.main').scrollTop = sc; };
    $$('a', ol).forEach(a => a.addEventListener('click', () => { if (document.body.classList.contains('ol-auto')) document.body.classList.remove('ol-open'); }));
  }
  document.addEventListener('click', e => { if (document.body.classList.contains('ol-open') && document.contains(e.target) && !e.target.closest('.outline, #olTab')) document.body.classList.remove('ol-open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('ol-open'); });

  function updateTopicProgress() {
    const m = location.hash.match(/^#\/t\/(.+)$/) || (location.hash.startsWith('#/q/') ? [0, (Q[location.hash.slice(4)] || { topic: {} }).topic.slug] : null);
    if (!m || !TOPIC[m[1]]) return;
    const s = stats(topicQs(TOPIC[m[1]])); const head = $('.topic-head .progress'); if (!head) return;
    head.innerHTML = `${barHTML(s)}<span class="lbl">изучено ${s.k} из ${s.n} · повторить ${s.r}</span>`;
  }

  // ---------- правильно и неправильно ----------
  const DD_ALL = D.topics.filter(t => t.dodont).flatMap(t => t.dodont.map(d => Object.assign(d, { topic: t })));
  function topicSwitch(t, onDo) {
    if (!t.dodont) return '';
    return `<div class="tp-switch"><a href="#/t/${t.slug}" class="${onDo ? '' : 'on'}">📚 Вопросы<span class="n">${t.count}</span></a><a href="#/t/${t.slug}/do" class="${onDo ? 'on' : ''}">✅❌ Правильно и неправильно<span class="n">${t.dodont.length}</span></a></div>`;
  }
  function ddCardHTML(d, showTopic) {
    return `<div class="dd-card answer" id="dd-${d.id}"><div class="dd-h"><h3>${esc(d.t)}</h3>${showTopic ? `<a class="dd-topic" href="#/t/${d.topic.slug}/do">${esc(d.topic.title)}</a>` : ''}</div>
      <div class="dd-why"><b>Почему</b>${d.why}</div>
      <div class="dd-cols"><div class="dd-col bad"><div class="dd-lbl">❌ Неправильно</div>${d.bad}</div><div class="dd-col good"><div class="dd-lbl">✅ Правильно</div>${d.good}</div></div></div>`;
  }
  function ddToolsHTML() {
    return `<div class="dd-tools"><label class="dd-tg"><input type="checkbox" id="ddInline"${S.ddInline ? ' checked' : ''}> 💬 Комментарии прямо в коде</label><span class="muted dd-hint">Строки с пометкой <span class="dd-mark"></span> поясняются: наведите на строку${matchMedia('(hover: hover)').matches ? '' : ' (или коснитесь её)'} или включите комментарии.</span></div>`;
  }
  function ddEnhance(root) {
    enhanceCode(root);
    $$('pre', root).forEach(pre => {
      if (pre.dataset.dd) return; pre.dataset.dd = 1;
      $$('.ln.tip', pre).forEach(ln => { const c = document.createElement('span'); c.className = 'ln-c'; c.textContent = '  // ' + pre._tips[ln.dataset.i]; ln.appendChild(c); });
      const hint = $('.pre-hint', pre); if (hint) hint.textContent = '💡 наведите на отмеченные строки';
    });
    root.classList.toggle('dd-inline', !!S.ddInline);
    const cb = $('#ddInline'); if (cb) cb.onchange = () => { S.ddInline = cb.checked; save(); root.classList.toggle('dd-inline', cb.checked); };
  }
  function pageDoDont(slug) {
    const t = TOPIC[slug]; if (!t || !t.dodont) return pageTopic(slug);
    main().innerHTML = `<div class="page wide dd-page"><div class="topic-head"><div class="crumbs"><a href="#/">Главная</a> · ${esc(t.group)} · <a href="#/dodont">все примеры</a></div><h1 class="title">${esc(t.title)}</h1>
      ${topicSwitch(t, true)}<p class="subtitle">${plural(t.dodont.length, 'пример', 'примера', 'примеров')}: как писать не стоит и как лучше — с объяснением и комментариями к ключевым строкам.</p>${ddToolsHTML()}</div>
      ${t.dodont.map(d => ddCardHTML(d)).join('')}</div>`;
    ddEnhance($('.dd-page')); $('.main').scrollTop = 0;
  }
  function pageDoDontAll() {
    const groups = D.groups.map(g => [g, D.topics.filter(t => t.group === g && t.dodont)]).filter(([, ts]) => ts.length);
    main().innerHTML = `<div class="page wide dd-page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">Правильно и неправильно</h1>
      <p class="subtitle">${plural(DD_ALL.length, 'пример', 'примера', 'примеров')} в ${plural(groups.reduce((a, [, ts]) => a + ts.length, 0), 'теме', 'темах', 'темах')}: типичная ошибка рядом с исправленным вариантом. Те же примеры открываются кнопкой «✅❌ Правильно и неправильно» на странице темы.</p>
      <div class="dd-cat">${groups.map(([g, ts]) => `<div class="dd-g"><div class="dd-gt">${esc(g)}</div>${ts.map(t => `<a href="#/t/${t.slug}/do"><span>${esc(t.title)}</span><span class="n">${t.dodont.length}</span></a>`).join('')}</div>`).join('')}</div>
      <div class="sec-title">Случайный пример <button class="chip" id="ddMore">↻ Другой</button></div>${ddToolsHTML()}<div id="ddRnd"></div></div>`;
    const show = () => { const d = DD_ALL[Math.floor(Math.random() * DD_ALL.length)]; $('#ddRnd').innerHTML = ddCardHTML(d, true); ddEnhance($('.dd-page')); };
    $('#ddMore').onclick = show; show(); $('.main').scrollTop = 0;
  }

  function pageList(title, sub, qs, empty) {
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">${title}</h1><p class="subtitle">${sub}</p>
      ${qs.length ? qs.map(q => cardHTML(q, { showTopic: true })).join('') : `<div class="empty"><div class="big">📭</div>${empty}</div>`}</div>`;
    $('.main').scrollTop = 0;
  }
  function pageTop() {
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">⭐ Ключевые вопросы</h1>
      <p class="subtitle">Фундамент каждой темы: то, что Java-разработчик должен понимать уверенно. Хорошая точка старта и материал для регулярного повторения.</p>
      <div class="chips" style="margin-bottom:10px"><a class="chip" href="#/train/top">🎯 Тренировка по ключевым вопросам</a></div>
      ${D.boss.map(b => `<div class="sec-title">${esc(b.title)}</div>` + b.ids.map(id => cardHTML(Q[id], { showTopic: true })).join('')).join('')}</div>`;
    $('.main').scrollTop = 0;
  }
  function pageNotes() {
    const qs = ORDER.filter(q => S.notes[q.id]);
    pageList('📝 Мои заметки', 'Вопросы, к которым вы написали личные заметки. Заметки сохраняются автоматически в профиле «' + esc(curProfile().name) + '».', qs, 'Заметок пока нет. Откройте любой вопрос и нажмите «📝 Заметка».');
  }
  function pageRepeat() {
    pageList('↻ На повторение', 'Вопросы, отмеченные для повторения.', ORDER.filter(q => st(q.id) === 'r'), 'Список пуст.');
  }

  // ---------- поиск ----------
  function search(query, limit) {
    const words = norm(query).split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
    if (!words.length) return [];
    const res = [];
    for (const q of ORDER) {
      let score = 0, ok = true;
      for (const w of words) {
        const inQ = q._q.includes(w), inT = !inQ && q._t.includes(w);
        if (!inQ && !inT) { ok = false; break; }
        score += inQ ? 10 : 1;
      }
      if (ok) { if (q._q.includes(norm(query.trim()))) score += 20; res.push([score, q]); }
    }
    res.sort((a, b) => b[0] - a[0]);
    return res.slice(0, limit || 300).map(r => r[1]);
  }
  function hl(text, query) {
    let h = esc(text);
    norm(query).split(/\s+/).filter(w => w.length > 1).forEach(w => {
      const re = new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]') + ')', 'gi');
      h = h.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag ? tag : txt.replace(re, '<mark>$1</mark>'));
    });
    return h;
  }
  function snippet(q, query) {
    const w = norm(query).split(/\s+/).filter(x => x.length > 1)[0]; if (!w) return '';
    const i = q._t.indexOf(w); if (i < 0) return '';
    const s = Math.max(0, i - 50); return (s ? '…' : '') + q.text.slice(s, i + 110).replace(/\s+/g, ' ') + '…';
  }
  const sInput = () => $('#search'); const sDrop = () => $('#sdrop');
  let sSel = -1;
  function renderDrop() {
    const v = sInput().value.trim();
    if (v.length < 2) { sDrop().classList.remove('open'); return; }
    const all = search(v); const r = all.slice(0, 8); sSel = -1;
    sDrop().innerHTML = r.length ? r.map((q, i) => `<a class="s-item" data-i="${i}" href="#/q/${q.id}"><div class="t">${hl(q.q, v)}</div><div class="meta">${esc(q.topic.title)}${q.sec ? ' · ' + esc(q.sec) : ''}</div>${!q._q.includes(norm(v.split(/\s+/)[0])) ? `<div class="snip">${hl(snippet(q, v), v)}</div>` : ''}</a>`).join('') +
      `<div class="s-foot">Найдено: ${all.length}${all.length >= 300 ? '+' : ''} · <kbd>Enter</kbd> — все результаты · <kbd>↑</kbd><kbd>↓</kbd> — выбор</div>`
      : '<div class="s-foot">Ничего не найдено</div>';
    sDrop().classList.add('open');
  }
  function pageSearch(query) {
    const r = search(query);
    const groups = {};
    r.forEach(q => (groups[q.topic.title] = groups[q.topic.title] || []).push(q));
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">Поиск: «${esc(query)}»</h1>
      <p class="subtitle">${r.length ? 'Найдено ' + plural(r.length, 'вопрос', 'вопроса', 'вопросов') : 'Ничего не найдено. Попробуйте другие слова или английский термин (например, «HashMap», «volatile»).'}</p>
      ${Object.entries(groups).map(([t, qs]) => `<div class="res-group"><div class="sec-title">${esc(t)} · ${qs.length}</div>${qs.map(q => `<a class="list-link" href="#/q/${q.id}"><span class="tt">${hl(q.q, query)}${!q._q.includes(norm(query.split(/\s+/)[0])) ? `<div style="font-size:13px;color:var(--muted)">${hl(snippet(q, query), query)}</div>` : ''}</span></a>`).join('')}</div>`).join('')}</div>`;
    $('.main').scrollTop = 0;
  }

  // ---------- тренировка ----------
  let T = null;
  // выбор нескольких тем: список с галочками по группам
  function topicPickerHTML(id, sel, counter) {
    const groups = D.groups.map(g => [g, D.topics.filter(t => t.group === g && !t.module && counter(t))]).filter(([, ts]) => ts.length);
    const all = groups.flatMap(([, ts]) => ts);
    const label = !sel.size ? 'Все темы' : sel.size === 1 ? TOPIC[[...sel][0]].title : `${plural(sel.size, 'тема', 'темы', 'тем')} из ${all.length}`;
    return `<div class="tpick" id="${id}"><button type="button" class="tpick-btn"><span>${esc(label)}</span><span class="chev">▾</span></button>
      <div class="tpick-pop"><div class="tpick-acts"><button type="button" class="chip" data-tp="all">Выбрать все</button><button type="button" class="chip" data-tp="none">Снять все</button><span class="muted">${sel.size ? 'выбрано ' + sel.size : 'не выбрано — значит все'}</span></div>
      ${groups.map(([g, ts]) => { const on = ts.filter(t => sel.has(t.slug)).length; return `<div class="tpick-g"><label class="tpick-gh"><input type="checkbox" data-tg="${esc(g)}"${on === ts.length ? ' checked' : ''}${on && on < ts.length ? ' data-part="1"' : ''}> <b>${esc(g)}</b></label>
        <div class="tpick-ts">${ts.map(t => `<label><input type="checkbox" data-ts="${t.slug}"${sel.has(t.slug) ? ' checked' : ''}> ${esc(t.title)} <span class="muted">${counter(t)}</span></label>`).join('')}</div></div>`; }).join('')}
      </div></div>`;
  }
  function mountTopicPicker(id, sel, counter, onChange) {
    const root = $('#' + id); if (!root) return;
    const redraw = () => { const open = root.classList.contains('open'); const sc = $('.tpick-pop', root).scrollTop; root.outerHTML = topicPickerHTML(id, sel, counter); mountTopicPicker(id, sel, counter, onChange); const r = $('#' + id); if (open) r.classList.add('open'); $('.tpick-pop', r).scrollTop = sc; onChange(); };
    $$('[data-part]', root).forEach(x => x.indeterminate = true);
    $('.tpick-btn', root).onclick = e => { e.stopPropagation(); root.classList.toggle('open'); };
    $('.tpick-pop', root).onclick = e => e.stopPropagation();
    $$('[data-ts]', root).forEach(c => c.onchange = () => { c.checked ? sel.add(c.dataset.ts) : sel.delete(c.dataset.ts); redraw(); });
    $$('[data-tg]', root).forEach(c => c.onchange = () => { D.topics.filter(t => t.group === c.dataset.tg && !t.module && counter(t)).forEach(t => c.checked ? sel.add(t.slug) : sel.delete(t.slug)); redraw(); });
    $$('[data-tp]', root).forEach(b => b.onclick = () => { if (b.dataset.tp === 'all') D.topics.filter(t => !t.module && counter(t)).forEach(t => sel.add(t.slug)); else sel.clear(); redraw(); });
  }
  document.addEventListener('click', () => $$('.tpick.open').forEach(x => x.classList.remove('open')));

  function pageTrain(src) {
    const opts = [['all', 'Все вопросы'], ['top', '⭐ Ключевые вопросы'], ['new', 'Только не изученные'], ['repeat', '↻ Отмеченные «Повторить»']]
      .concat((D.road || []).map(r => ['road:' + r.key, '🧭 Дорожная карта: ' + r.lv]));
    const tsel = new Set(TOPIC[src] ? [src] : (S.trTopics || []).filter(x => TOPIC[x]));
    const sel = src && !TOPIC[src] ? src : 'all';
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🎯 Тренировка</h1>
      <p class="subtitle">Режим карточек: сначала вопрос — попробуйте ответить вслух, затем откройте ответ и оцените себя.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Темы</label>${topicPickerHTML('trTopics', tsel, t => t.count)}</div>
        <div class="field"><label>Какие вопросы</label><select id="trSrc">${opts.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>Порядок</label><select id="trOrd"><option value="rnd">Случайный</option><option value="seq">По порядку</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:10px;align-items:center"><button class="btn" id="trGo">Начать</button><span class="muted" id="trCnt"></span></div></div>
      <div id="trArea"></div></div>`;
    const set = () => { const base = trainSet($('#trSrc').value); return tsel.size ? base.filter(q => tsel.has(q.topic.slug)) : base; };
    const upd = () => { S.trTopics = [...tsel]; save(); $('#trCnt').textContent = plural(set().length, 'вопрос', 'вопроса', 'вопросов'); };
    mountTopicPicker('trTopics', tsel, t => t.count, upd);
    $('#trSrc').onchange = upd; upd();
    $('#trGo').onclick = () => startTrain(set(), $('#trOrd').value);
    if (src) startTrain(set(), 'rnd');
    $('.main').scrollTop = 0;
  }
  function trainSet(src) {
    if (src === 'top') return ORDER.filter(q => q.star);
    if (src.startsWith('road:')) return roadIds(src.slice(5)).map(id => Q[id]);
    if (src === 'new') return ORDER.filter(q => !st(q.id));
    if (src === 'repeat') return ORDER.filter(q => st(q.id) === 'r');
    if (src.startsWith('t:')) return topicQs(TOPIC[src.slice(2)]);
    return ORDER.slice();
  }
  function startTrain(src, ord) {
    const list = Array.isArray(src) ? src.slice() : trainSet(src);
    if (ord === 'rnd') for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    T = { list, i: 0, shown: false, lv: S.level, k: 0, r: 0 };
    renderTrain();
  }
  function renderTrain() {
    const a = $('#trArea'); if (!a || !T) return;
    if (!T.list.length) { a.innerHTML = '<div class="empty"><div class="big">📭</div>В этом наборе нет вопросов</div>'; return; }
    if (T.i >= T.list.length) { a.innerHTML = `<div class="flash-card"><div class="empty"><div class="big">🏁</div><h2>Готово!</h2><p>Знаю: ${T.k} · Повторить: ${T.r} · Всего: ${T.list.length}</p><button class="btn" onclick="location.hash='#/train'">Новая тренировка</button></div></div>`; return; }
    const q = T.list[T.i];
    a.innerHTML = `<div class="train-bar"><i style="width:${T.i / T.list.length * 100}%"></i></div>
      <div class="flash-card"><div class="fc-meta"><span>${esc(q.topic.title)}${q.sec ? ' · ' + esc(q.sec) : ''}</span><span>${T.i + 1} / ${T.list.length}</span></div>
      <div class="fc-q">${esc(q.q)} ${badges(q)}</div>
      ${T.shown ? `<div class="fc-answer"><div class="card-tools" style="border:0;padding:0"><div class="lv-tabs">${tabsHTML(q, T.lv)}</div><a class="tbtn" style="margin-left:auto" href="#/q/${q.id}">Открыть в теме →</a></div><div class="answer">${levelHTML(q, T.lv)}</div>${q.imgs.length ? galleryHTML(q.imgs, 'Иллюстрации') : ''}</div>` : ''}
      <div class="fc-actions">${T.shown ? `<button class="btn ok" id="tK">✓ Знаю</button><button class="btn rep" id="tR">↻ Повторить</button><button class="btn ghost" id="tN">Пропустить →</button><span class="hint"><kbd>1</kbd> знаю · <kbd>2</kbd> повторить · <kbd>→</kbd> дальше</span>`
        : `<button class="btn" id="tShow">Показать ответ</button><button class="btn ghost" id="tN">Пропустить →</button><span class="hint"><kbd>Пробел</kbd> показать ответ</span>`}</div></div>`;
    if (T.shown) { enhanceCode($('.fc-answer', a), q); glossLink($('.fc-answer .answer', a), q); }
    const nx = () => { T.i++; T.shown = false; renderTrain(); };
    if ($('#tShow')) $('#tShow').onclick = () => { T.shown = true; renderTrain(); };
    if ($('#tK')) $('#tK').onclick = () => { S.st[q.id] = 'k'; T.k++; save(); renderNav(); nx(); };
    if ($('#tR')) $('#tR').onclick = () => { S.st[q.id] = 'r'; T.r++; save(); renderNav(); nx(); };
    $('#tN').onclick = nx;
  }
  function trainLevel(l) { if (T) { T.lv = l; renderTrain(); } }

  function randomQ() { const q = ORDER[Math.floor(Math.random() * ORDER.length)]; location.hash = '#/q/' + q.id; }

  // ---------- самотест ----------
  let QZ = null;
  S.qz = S.qz || {};
  const ZALL = D.quiz || [];
  const ZID = {}; ZALL.forEach(z => ZID[z.id] = z);
  const topicTitle = slug => TOPIC[slug] ? TOPIC[slug].title : slug;
  function quizSet(src) {
    if (src === 'all') return ZALL.slice();
    if (src === 'wrong') return ZALL.filter(z => S.qz[z.id] === 0);
    if (src === 'new') return ZALL.filter(z => !(z.id in S.qz));
    if (src.startsWith('t:')) return (QZ_BY_T[src.slice(2)] || []).slice();
    if (src.startsWith('q:')) return (QZ_BY_REF[src.slice(2)] || []).slice();
    return ZALL.slice();
  }
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function pageQuiz(arg) {
    const done = Object.keys(S.qz).filter(k => ZID[k]).length, ok = Object.keys(S.qz).filter(k => ZID[k] && S.qz[k] === 1).length;
    const wrong = ZALL.filter(z => S.qz[z.id] === 0).length;
    let sel = 'all';
    if (arg && arg.startsWith('q/')) sel = 'q:' + arg.slice(2); else if (arg === 'wrong') sel = 'wrong';
    const tsel = new Set(arg && QZ_BY_T[arg] ? [arg] : sel.startsWith('q:') ? [] : (S.qzTopics || []).filter(x => QZ_BY_T[x]));
    const opts = [['all', 'Все вопросы'], ['new', 'Ещё не решённые'], ['wrong', `Мои ошибки (${wrong})`]]
      .concat(sel.startsWith('q:') ? [[sel, 'По вопросу: ' + (Q[sel.slice(2)] || { q: '' }).q.slice(0, 60)]] : []);
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🧪 Самотест</h1>
      <p class="subtitle">Вопросы с вариантами ответов. Где правильных ответов несколько, это будет указано: отметьте все подходящие. После проверки увидите разбор и ссылку на подробный ответ.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Темы</label>${topicPickerHTML('qzTopics', tsel, t => (QZ_BY_T[t.slug] || []).length)}</div>
        <div class="field"><label>Какие вопросы</label><select id="qzSrc">${opts.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>Количество</label><select id="qzCnt"><option value="10">10 вопросов</option><option value="20" selected>20 вопросов</option><option value="40">40 вопросов</option><option value="0">Все</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" id="qzGo">Начать тест</button><span class="muted" id="qzInfo"></span>
      <span class="muted" style="margin-left:auto">Решено: ${done} из ${ZALL.length} · верно ${done ? Math.round(ok / done * 100) : 0}%</span></div></div>
      <div id="qzArea"></div></div>`;
    const set = () => { const v = $('#qzSrc').value, base = quizSet(v); return tsel.size && !v.startsWith('q:') ? base.filter(z => tsel.has(z.t)) : base; };
    const upd = () => { if (!sel.startsWith('q:')) { S.qzTopics = [...tsel]; save(); } $('#qzInfo').textContent = 'доступно: ' + set().length; };
    mountTopicPicker('qzTopics', tsel, t => (QZ_BY_T[t.slug] || []).length, upd);
    $('#qzSrc').onchange = upd; upd();
    $('#qzGo').onclick = () => startQuiz(set(), +$('#qzCnt').value);
    if (arg) startQuiz(set(), sel.startsWith('q:') ? 0 : 20);
    $('.main').scrollTop = 0;
  }
  function startQuiz(src, cnt) {
    let list = shuffle(Array.isArray(src) ? src.slice() : quizSet(src));
    if (cnt) list = list.slice(0, cnt);
    QZ = { list: list.map(z => ({ z, perm: shuffle(z.o.map((_, i) => i)), pick: new Set(), checked: false, ok: null })), i: 0 };
    renderQuiz();
    const a = $('#qzArea'); if (a) a.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function renderQuiz() {
    const a = $('#qzArea'); if (!a || !QZ) return;
    if (!QZ.list.length) { a.innerHTML = '<div class="empty"><div class="big">📭</div>В этом наборе нет вопросов</div>'; return; }
    if (QZ.i >= QZ.list.length) return renderQuizResult();
    const it = QZ.list[QZ.i], z = it.z, multi = z.c.length > 1;
    const right = QZ.list.filter(x => x.ok).length;
    a.innerHTML = `<div class="train-bar"><i style="width:${QZ.i / QZ.list.length * 100}%"></i></div>
      <div class="flash-card quiz">${QZ.exam ? `<div class="ex-head">🎫 ${esc(QZ.exam.title)} · ошибок ${QZ.list.filter(x => x.checked && !x.ok).length} из ${allowedErr(QZ.list.length)} допустимых</div>` : ''}<div class="fc-meta"><span>${esc(topicTitle(z.t))}</span><span>${QZ.i + 1} / ${QZ.list.length} · верно ${right}</span></div>
      <div class="fc-q">${z.q}</div>
      ${z.code ? `<div class="answer"><pre><code class="language-java">${z.code}</code></pre></div>` : ''}
      <div class="qz-kind">${multi ? '☑ Выберите все правильные варианты' : '◉ Выберите один вариант'}</div>
      <div class="qz-opts">${it.perm.map((oi, n) => {
        let cls = '';
        if (it.checked) { const corr = z.c.includes(oi), pk = it.pick.has(oi); cls = corr && pk ? 'ok' : corr ? 'miss' : pk ? 'bad' : ''; }
        else if (it.pick.has(oi)) cls = 'sel';
        return `<label class="qz-opt ${cls}${multi ? ' multi' : ''}" data-oi="${oi}"><span class="qz-mark"></span><span class="qz-n">${n + 1}</span><span class="qz-t">${z.o[oi]}</span></label>`;
      }).join('')}</div>
      ${it.checked ? `<div class="qz-res ${it.ok ? 'ok' : 'bad'}"><b>${it.ok ? '✓ Верно!' : '✗ Неверно'}</b>${!it.ok && multi ? ' — правильные варианты подсвечены зелёным' : ''}</div>
        <div class="qz-expl answer">${z.e}${z.ref && Q[z.ref] ? `<p><a href="#/q/${z.ref}">📚 Читать ответ в справочнике: ${esc(Q[z.ref].q)} →</a></p>` : ''}</div>` : ''}
      <div class="fc-actions">${it.checked ? `<button class="btn" id="qzNext">${QZ.i + 1 < QZ.list.length ? 'Следующий вопрос →' : 'Результаты'}</button>` : `<button class="btn" id="qzCheck"${it.pick.size ? '' : ' disabled'}>Проверить</button>${QZ.exam ? '' : '<button class="btn ghost" id="qzSkip">Пропустить</button>'}`}
        <span class="hint"><kbd>1</kbd>–<kbd>${Math.min(9, z.o.length)}</kbd> выбор · <kbd>Enter</kbd> ${it.checked ? 'дальше' : 'проверить'}</span></div></div>`;
    enhanceCode(a, null);
    $$('.qz-opt', a).forEach(l => l.onclick = () => quizPick(+l.dataset.oi));
    if ($('#qzCheck')) $('#qzCheck').onclick = quizCheck;
    if ($('#qzSkip')) $('#qzSkip').onclick = () => { QZ.i++; renderQuiz(); };
    if ($('#qzNext')) $('#qzNext').onclick = () => { QZ.i++; renderQuiz(); };
  }
  function quizPick(oi) {
    const it = QZ.list[QZ.i]; if (it.checked) return;
    if (it.z.c.length > 1) { it.pick.has(oi) ? it.pick.delete(oi) : it.pick.add(oi); } else { it.pick = new Set([oi]); }
    renderQuiz();
  }
  function quizCheck() {
    const it = QZ.list[QZ.i]; if (it.checked || !it.pick.size) return;
    it.checked = true;
    it.ok = it.pick.size === it.z.c.length && it.z.c.every(c => it.pick.has(c));
    S.qz[it.z.id] = it.ok ? 1 : 0; save();
    renderQuiz();
  }
  function renderQuizResult() {
    const a = $('#qzArea'); const ans = QZ.list.filter(x => x.checked); const ok = ans.filter(x => x.ok).length;
    const pct = ans.length ? Math.round(ok / ans.length * 100) : 0;
    const bad = ans.filter(x => !x.ok);
    const EX = QZ.exam; const errs = QZ.list.length - ok; const pass = EX ? errs <= allowedErr(QZ.list.length) : null;
    if (!QZ.recorded && ans.length) {
      QZ.recorded = true;
      if (EX) {
        pushHist({ m: EX.kind, title: EX.title, n: QZ.list.length, ok, pass });
        if (EX.kind === 'ticket') { const prev = S.tk[EX.no]; if (!prev || ok > prev.ok || (pass && !prev.pass)) S.tk[EX.no] = { ok, n: QZ.list.length, pass, d: Date.now() }; save(); }
        if (EX.kind === 'ticket') { const tb = $(`.ticket[data-tk="${EX.no}"]`), r = S.tk[EX.no]; if (tb && r) { tb.className = 'ticket ' + (r.pass ? 'pass' : 'fail'); $('span', tb).textContent = `${r.ok} из ${r.n}`; } }
      } else pushHist({ m: 'quiz', title: 'Самотест', n: ans.length, ok });
    }
    const head = EX ? (pass ? `✅ ${esc(EX.title)}: сдан` : `❌ ${esc(EX.title)}: не сдан`) : (pct >= 85 ? 'Отлично!' : pct >= 60 ? 'Неплохо, но есть что повторить' : 'Стоит повторить тему');
    a.innerHTML = `<div class="flash-card${EX ? (pass ? ' ex-pass' : ' ex-fail') : ''}"><div class="qz-score"><div class="qz-ring" style="--p:${pct}"><span>${pct}%</span></div>
      <div><h2 style="margin:0 0 6px">${head}</h2>${EX ? `<p class="muted" style="margin:0 0 4px">Ошибок: ${errs}, допускается не больше ${allowedErr(QZ.list.length)}.</p>` : ''}
      <p class="muted" style="margin:0">Верно ${ok} из ${ans.length}${QZ.list.length > ans.length ? ` · пропущено ${QZ.list.length - ans.length}` : ''}</p>
      <div class="fc-actions" style="margin-top:14px">${bad.length ? '<button class="btn rep" id="qzRetry">Повторить ошибки</button>' : ''}<button class="btn ghost" id="qzNew">${EX ? 'К билетам' : 'Новый тест'}</button></div></div></div>
      ${bad.length ? `<div class="sec-title">Разбор ошибок</div>` + bad.map(x => `<div class="qz-review"><div class="qz-rq">${x.z.q}</div>
        <div class="qz-ra">Правильно: ${x.z.c.map(c => `<span class="qz-ok">${x.z.o[c]}</span>`).join(' ')}</div><div class="answer">${x.z.e}</div>
        ${x.z.ref && Q[x.z.ref] ? `<a href="#/q/${x.z.ref}">📚 ${esc(Q[x.z.ref].q)} →</a>` : ''}</div>`).join('') : ''}</div>`;
    $('#qzNew').onclick = () => { if (EX) { if (location.hash === '#/exam') pageExam(); else location.hash = '#/exam'; } else { if (location.hash === '#/quiz') pageQuiz(); else location.hash = '#/quiz'; } };
    if ($('#qzRetry')) $('#qzRetry').onclick = () => { QZ = { list: shuffle(bad.map(x => ({ z: x.z, perm: shuffle(x.z.o.map((_, i) => i)), pick: new Set(), checked: false, ok: null }))), i: 0 }; renderQuiz(); };
    renderNav();
  }
  document.addEventListener('keydown', e => {
    if (!QZ || !$('#qzArea') || e.target.matches('input,textarea,select') || e.ctrlKey || e.altKey) return;
    if (QZ.i >= QZ.list.length) return;
    const it = QZ.list[QZ.i];
    if (/^[1-9]$/.test(e.key) && !it.checked) { const n = +e.key - 1; if (n < it.perm.length) { e.preventDefault(); quizPick(it.perm[n]); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (it.checked) { QZ.i++; renderQuiz(); } else quizCheck(); }
  });

  // ======================================================================
  // ---------- профили ----------
  function renderProfile() {
    const el = $('#profile'); if (!el) return;
    const ava = n => esc((n || '?').slice(0, 1).toUpperCase());
    el.innerHTML = `<button class="prof-btn" id="profBtn" title="Профиль: у каждого пользователя свой прогресс"><span class="prof-ava">${ava(curProfile().name)}</span><span class="prof-name">${esc(curProfile().name)}</span><span class="prof-chev">▾</span></button>
      <div class="prof-menu" id="profMenu"><div class="pm-h">Профили на этом компьютере</div>
      ${P.list.map(p => `<button class="pm-item${p.id === P.cur ? ' cur' : ''}" data-pid="${p.id}"><span class="prof-ava sm">${ava(p.name)}</span>${esc(p.name)}${p.id === P.cur ? '<span class="pm-cur">✓</span>' : ''}</button>`).join('')}
      <div class="pm-sep"></div><button class="pm-act" data-pa="new">＋ Новый профиль</button><button class="pm-act" data-pa="ren">✎ Переименовать текущий</button>${P.list.length > 1 ? '<button class="pm-act danger" data-pa="del">🗑 Удалить текущий</button>' : ''}
      <div class="pm-note">Прогресс, заметки, результаты тестов и черновики кода сохраняются автоматически в браузере на этом компьютере — отдельно для каждого профиля.</div></div>`;
    $('#profBtn').onclick = e => { e.stopPropagation(); $('#profMenu').classList.toggle('open'); };
    $$('.pm-item', el).forEach(b => b.onclick = () => { if (b.dataset.pid !== P.cur) { P.cur = b.dataset.pid; saveP(); location.hash = '#/'; location.reload(); } });
    $$('.pm-act', el).forEach(b => b.onclick = () => {
      const a = b.dataset.pa;
      if (a === 'new') { const n = (prompt('Имя нового профиля:') || '').trim().slice(0, 30); if (!n) return; const id = 'p' + Date.now().toString(36); P.list.push({ id, name: n }); P.cur = id; saveP(); location.hash = '#/'; location.reload(); }
      else if (a === 'ren') { const n = (prompt('Новое имя профиля:', curProfile().name) || '').trim().slice(0, 30); if (!n) return; curProfile().name = n; saveP(); renderProfile(); }
      else if (a === 'del') { if (!confirm(`Удалить профиль «${curProfile().name}» вместе со всем прогрессом?`)) return; try { localStorage.removeItem(KEY); } catch (e) { } P.list = P.list.filter(p => p.id !== P.cur); P.cur = P.list[0].id; saveP(); location.hash = '#/'; location.reload(); }
    });
  }
  document.addEventListener('click', e => { const m = $('#profMenu'); if (m && !e.target.closest('#profile')) m.classList.remove('open'); });

  // ---------- история тестов ----------
  function pushHist(rec) { S.hist.push(Object.assign({ d: Date.now() }, rec)); if (S.hist.length > 300) S.hist = S.hist.slice(-300); save(); }
  const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };

  // ---------- экзамен и билеты (как в ПДД) ----------
  const TICKET = 20;
  const TICKETS = (() => {
    const byT = D.topics.map(t => (QZ_BY_T[t.slug] || []).slice()).filter(a => a.length);
    const seq = []; let i = 0;
    while (byT.some(a => a.length > i)) { byT.forEach(a => { if (a[i]) seq.push(a[i]); }); i++; }
    const res = [];
    for (let k = 0; k + TICKET <= seq.length; k += TICKET) res.push(seq.slice(k, k + TICKET));
    const rest = seq.slice(res.length * TICKET);
    if (rest.length) { const fill = seq.filter(z => !rest.includes(z)).slice(0, TICKET - rest.length); res.push(rest.concat(fill)); }
    return res;
  })();
  const allowedErr = n => Math.max(1, Math.floor(n / 10));
  function pageExam() {
    const passed = Object.values(S.tk).filter(r => r.pass).length;
    const exams = S.hist.filter(h => h.m === 'exam'); const examOk = exams.filter(h => h.pass).length;
    const groups = D.groups.filter(g => D.topics.some(t => t.group === g && QZ_BY_T[t.slug]));
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🎫 Экзамен и билеты</h1>
      <p class="subtitle">Как в ПДД: билет — ${TICKET} вопросов из разных тем, без таймера. Экзамен сдан, если ошибок не больше ${allowedErr(TICKET)}. Пропустить вопрос нельзя — сразу после ответа видно, верно ли.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Темы экзамена</label><select id="exSrc"><option value="all">Все темы</option>${groups.map(g => `<option value="g:${esc(g)}">${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label>Количество вопросов</label><select id="exCnt"><option value="20" selected>20 — как в ПДД</option><option value="40">40</option><option value="10">10 — короткий</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" id="exGo">Начать экзамен</button>
      <span class="muted">Экзаменов сдано: ${examOk} из ${exams.length}</span></div></div>
      <div class="sec-title">Билеты · сдано ${passed} из ${TICKETS.length}</div>
      <div class="tickets">${TICKETS.map((tk, i) => { const r = S.tk[i + 1]; return `<button class="ticket ${r ? (r.pass ? 'pass' : 'fail') : ''}" data-tk="${i + 1}"><b>${i + 1}</b><span>${r ? `${r.ok} из ${r.n}` : 'не решён'}</span></button>`; }).join('')}</div>
      <p class="muted" style="font-size:13px">Состав билетов постоянный: в каждом — вопросы из разных тем. Зелёный — сдан, красный — не сдан (в зачёт идёт лучший результат).</p>
      <div id="qzArea"></div></div>`;
    $('#exGo').onclick = () => {
      const src = $('#exSrc').value, n = +$('#exCnt').value;
      const pool = src === 'all' ? ZALL.slice() : ZALL.filter(z => TOPIC[z.t] && TOPIC[z.t].group === src.slice(2));
      const byT = {}; shuffle(pool).forEach(z => (byT[z.t] = byT[z.t] || []).push(z));
      const keys = shuffle(Object.keys(byT)); const pick = [];
      while (pick.length < n && keys.some(k => byT[k].length)) keys.forEach(k => { if (pick.length < n && byT[k].length) pick.push(byT[k].pop()); });
      runExam(shuffle(pick), { kind: 'exam', title: 'Экзамен' + (src === 'all' ? '' : ': ' + src.slice(2)) });
    };
    $$('.ticket').forEach(b => b.onclick = () => runExam(TICKETS[+b.dataset.tk - 1].slice(), { kind: 'ticket', no: +b.dataset.tk, title: 'Билет № ' + b.dataset.tk }));
    $('.main').scrollTop = 0;
  }
  function runExam(list, meta) {
    QZ = { list: list.map(z => ({ z, perm: shuffle(z.o.map((_, i) => i)), pick: new Set(), checked: false, ok: null })), i: 0, exam: meta };
    renderQuiz(); $('#qzArea').scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  // ---------- статистика ----------
  function pageStats() {
    const all = stats(ORDER);
    const ans = Object.keys(S.qz).filter(k => ZID[k]), okN = ans.filter(k => S.qz[k] === 1).length;
    const exams = S.hist.filter(h => h.m === 'exam'), tks = Object.values(S.tk);
    const notes = Object.keys(S.notes).filter(k => Q[k] && S.notes[k]).length;
    const rows = D.topics.filter(t => t.count).map(t => {
      const s = stats(topicQs(t)); const zs = QZ_BY_T[t.slug] || [];
      const za = zs.filter(z => z.id in S.qz), zo = za.filter(z => S.qz[z.id] === 1).length;
      return { t, s, zn: zs.length, za: za.length, zo, acc: za.length ? Math.round(zo / za.length * 100) : null };
    });
    const weak = rows.filter(r => r.acc !== null && r.za >= 3 && r.acc < 70).sort((a, b) => a.acc - b.acc);
    const tile = (v, l, sub) => `<div class="st-tile"><b>${v}</b><span>${l}</span>${sub ? `<i>${sub}</i>` : ''}</div>`;
    main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">📊 Статистика</h1>
      <p class="subtitle">Профиль «${esc(curProfile().name)}». Всё считается по вашим отметкам «Знаю / Повторить», самотесту и экзаменам.</p>
      <div class="st-tiles">${tile(Math.round(all.k / all.n * 100) + '%', 'изучено', `${all.k} из ${all.n} вопросов`)}${tile(all.r, 'на повторении', '')}
        ${tile(ans.length, 'решено в самотесте', `из ${ZALL.length} · верно ${ans.length ? Math.round(okN / ans.length * 100) : 0}%`)}
        ${tile(exams.filter(h => h.pass).length + ' / ' + exams.length, 'экзаменов сдано', '')}${tile(tks.filter(r => r.pass).length + ' / ' + TICKETS.length, 'билетов сдано', '')}${tile(notes, 'заметок', '')}</div>
      ${weak.length ? `<div class="panel warn"><h3>Слабые места</h3><p class="muted" style="margin-top:0">Темы, где в самотесте меньше 70% верных ответов:</p>${weak.map(r => `<a class="list-link" href="#/quiz/${r.t.slug}"><span class="tt">${esc(r.t.title)}</span><span class="m">${r.acc}% · ${r.zo} из ${r.za} → тест по теме</span></a>`).join('')}${ZALL.some(z => S.qz[z.id] === 0) ? '<a class="list-link" href="#/quiz/wrong"><span class="tt">🔁 Прорешать все свои ошибки</span></a>' : ''}</div>` : ''}
      <div class="sec-title">По темам</div>
      <div class="tbl st-table"><table><thead><tr><th>Тема</th><th style="width:34%">Изучено</th><th>Самотест</th><th>Точность</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><a href="#/t/${r.t.slug}">${esc(r.t.title)}</a></td><td><div class="st-bar">${barHTML(r.s)}<span>${r.s.k}/${r.s.n}</span></div></td><td>${r.zn ? `${r.za}/${r.zn}` : '—'}</td><td>${r.acc === null ? '<span class="muted">—</span>' : `<span class="acc ${r.acc >= 85 ? 'hi' : r.acc >= 60 ? 'mid' : 'lo'}">${r.acc}%</span>`}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="sec-title">История тестов и экзаменов</div>
      ${S.hist.length ? `<div class="tbl"><table><thead><tr><th>Когда</th><th>Что</th><th>Результат</th></tr></thead><tbody>${S.hist.slice(-25).reverse().map(h => `<tr><td>${fmtDate(h.d)}</td><td>${esc(h.title || 'Самотест')}</td><td>${h.ok} из ${h.n}${h.m !== 'quiz' ? (h.pass ? ' · <span class="acc hi">сдан</span>' : ' · <span class="acc lo">не сдан</span>') : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Пройдите самотест или экзамен — результаты появятся здесь.</p>'}
    </div>`;
    $('.main').scrollTop = 0;
  }

  // ---------- дорожная карта ----------
  let roadLv = null;
  const roadDone = (key, it) => !!S.road[key + ':' + it.t] || it.ids.every(id => st(id) === 'k');
  function pageRoad(lv) {
    const R = D.road || []; roadLv = lv || roadLv || (R[0] && R[0].key);
    const L = R.find(r => r.key === roadLv) || R[0];
    const lvStat = r => { const its = r.blocks.flatMap(b => b.items); return { d: its.filter(it => roadDone(r.key, it)).length, n: its.length }; };
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🧭 Дорожная карта</h1>
      <p class="subtitle">Что нужно знать на каждом уровне — от Junior до Staff. Пункт закрывается, когда все связанные вопросы отмечены «✓ Знаю» (или отметьте его вручную кружком слева).</p>
      <div class="road-tabs">${R.map(r => { const s = lvStat(r); return `<a class="road-tab${r.key === L.key ? ' on' : ''}" href="#/road/${r.key}"><b>${esc(r.lv)}</b><span>${s.d} / ${s.n}</span><div class="bar"><i class="k" style="width:${s.n ? s.d / s.n * 100 : 0}%"></i></div></a>`; }).join('')}</div>
      <div class="panel road-desc">${esc(L.d)}</div>
      ${L.blocks.map(b => `<div class="sec-title">${esc(b.t)}</div><div class="road-block">${b.items.map(it => {
        const k = L.key + ':' + it.t, d = roadDone(L.key, it), kn = it.ids.filter(id => st(id) === 'k').length;
        return `<div class="road-item${d ? ' done' : ''}"><button class="road-chk${S.road[k] ? ' manual' : ''}" data-rk="${esc(k)}" title="${S.road[k] ? 'Снять ручную отметку' : 'Отметить пункт вручную'}">${d ? '✓' : ''}</button>
          <div class="road-body"><div class="road-t">${esc(it.t)}<span class="road-n">${kn}/${it.ids.length}</span></div>
          <div class="road-qs">${it.ids.map(id => `<a class="road-q ${st(id)}" href="#/q/${id}" title="${esc(Q[id].q)}">${esc(Q[id].q.length > 64 ? Q[id].q.slice(0, 62) + '…' : Q[id].q)}</a>`).join('')}</div></div></div>`;
      }).join('')}</div>`).join('')}
      <div class="chips" style="margin-top:18px"><a class="chip" href="#/train/road:${L.key}">🎯 Тренировка по вопросам уровня ${esc(L.lv)}</a></div></div>`;
    $$('.road-chk').forEach(b => b.onclick = () => { const k = b.dataset.rk; if (S.road[k]) delete S.road[k]; else S.road[k] = 1; save(); const sc = $('.main').scrollTop; pageRoad(L.key); $('.main').scrollTop = sc; });
    $('.main').scrollTop = 0;
  }
  const roadIds = key => { const L = (D.road || []).find(r => r.key === key); return L ? [...new Set(L.blocks.flatMap(b => b.items.flatMap(it => it.ids)))] : []; };

  // ---------- редактор кода с подсветкой ----------
  function rainbow(html) {
    const parts = html.split(/(<span[^>]*>|<\/span>)/); const stack = []; let depth = 0, out = '';
    for (const p of parts) {
      if (!p) continue;
      if (p.startsWith('<span')) { stack.push(/hljs-(string|comment)/.test(p)); out += p; continue; }
      if (p === '</span>') { stack.pop(); out += p; continue; }
      if (stack.some(Boolean)) { out += p; continue; }
      out += p.replace(/[(\[{)\]}]/g, c => {
        if ('([{'.includes(c)) { const s = `<span class="rb rb${depth % 3}">${c}</span>`; depth++; return s; }
        depth = Math.max(0, depth - 1); return `<span class="rb rb${depth % 3}">${c}</span>`;
      });
    }
    return out;
  }
  function makeEditor(host, value, onChange, opts = {}) {
    host.innerHTML = `<div class="ed${opts.tall ? ' tall' : ''}"><div class="ed-gut"></div><div class="ed-wrap"><pre class="ed-hl" aria-hidden="true"><code class="hljs"></code></pre><textarea class="ed-ta" spellcheck="false" wrap="off" autocapitalize="off" autocomplete="off" placeholder="${esc(opts.placeholder || 'Пишите код здесь…')}"></textarea></div></div>
      <div class="ed-bar"><span class="ed-info">${esc(opts.info || 'Java · Tab — отступ · Shift+Tab — убрать отступ · Ctrl+/ — комментарий · код не компилируется')}</span><span class="ed-saved"></span></div>`;
    const ta = $('.ed-ta', host), code = $('.ed-hl code', host), pre = $('.ed-hl', host), gut = $('.ed-gut', host);
    ta.value = value || '';
    let timer;
    const sync = () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; };
    const paint = () => {
      const v = ta.value;
      let h; try { h = window.hljs ? hljs.highlight(v, { language: opts.lang || 'java', ignoreIllegals: true }).value : esc(v); } catch (e) { h = esc(v); }
      code.innerHTML = rainbow(h) + '\n ';
      const n = v.split('\n').length; gut.innerHTML = Array.from({ length: n }, (_, i) => `<span>${i + 1}</span>`).join('') + '<span> </span>';
      sync();
    };
    const changed = () => { paint(); clearTimeout(timer); timer = setTimeout(() => { onChange(ta.value); const s = $('.ed-saved', host); if (s) { s.textContent = 'сохранено ✓'; clearTimeout(s._t); s._t = setTimeout(() => s.textContent = '', 1400); } }, 350); };
    const ins = text => { ta.focus(); let ok = false; try { ok = document.execCommand('insertText', false, text); } catch (e) { } if (!ok) { ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, 'end'); changed(); } };
    const lineStart = pos => ta.value.lastIndexOf('\n', pos - 1) + 1;
    const PAIR = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'" };
    ta.addEventListener('input', changed);
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => {
      const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s === en && !e.shiftKey) { ins('    '); return; }
        const ls = lineStart(s); const block = v.slice(ls, en);
        const nb = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
        ta.setSelectionRange(ls, en); ins(nb); ta.setSelectionRange(ls, ls + nb.length); return;
      }
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const ls = lineStart(s); const ind = (v.slice(ls, s).match(/^[ \t]*/) || [''])[0];
        const prev = v[s - 1], next = v[s];
        if ((prev === '{' && next === '}') || (prev === '(' && next === ')') || (prev === '[' && next === ']')) { ins('\n' + ind + '    \n' + ind); const p = s + 1 + ind.length + 4; ta.setSelectionRange(p, p); }
        else ins('\n' + ind + (prev === '{' ? '    ' : ''));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault(); const ls = lineStart(s); let le = v.indexOf('\n', Math.max(s, en - (en > s && v[en - 1] === '\n' ? 1 : 0))); if (le < 0) le = v.length;
        const block = v.slice(ls, le); const all = block.split('\n').every(l => /^\s*\/\//.test(l) || !l.trim());
        const nb = block.split('\n').map(l => all ? l.replace(/^(\s*)\/\/ ?/, '$1') : (l.trim() ? l.replace(/^(\s*)/, '$1// ') : l)).join('\n');
        ta.setSelectionRange(ls, le); ins(nb); ta.setSelectionRange(ls, ls + nb.length); return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (')]}'.includes(e.key) && s === en && v[s] === e.key) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
      if (PAIR[e.key] && s === en) {
        const next = v[s] || '';
        if ((e.key === '"' || e.key === "'") && next === e.key) { e.preventDefault(); ta.setSelectionRange(s + 1, s + 1); return; }
        if ((e.key === '"' || e.key === "'") && /[\w"']/.test(v[s - 1] || '')) return;
        if (!next || /[\s)\]};,]/.test(next)) { e.preventDefault(); ins(e.key + PAIR[e.key]); ta.setSelectionRange(s + 1, s + 1); return; }
      }
      if (e.key === '}' && s === en) {
        const ls = lineStart(s); const before = v.slice(ls, s);
        if (/^ +$/.test(before) && before.length >= 4) { e.preventDefault(); ta.setSelectionRange(s - 4, s); ins('}'); return; }
      }
      if (e.key === 'Backspace' && s === en && s > 0 && PAIR[v[s - 1]] && PAIR[v[s - 1]] === v[s]) { e.preventDefault(); ta.setSelectionRange(s - 1, s + 1); ins(''); }
    });
    paint();
    return { ta, get: () => ta.value, set: x => { ta.value = x; paint(); onChange(x); } };
  }

  // ---------- «Решить самому» для задач ----------
  const canSolve = q => q.topic.slug === 'live' || !!q.logic;
  function sectionOf(html, title) {
    if (!html) return '';
    const parts = html.split(/(<h4>[\s\S]*?<\/h4>)/); let on = false, out = '';
    for (const p of parts) { if (p.startsWith('<h4>')) { on = p.replace(/<[^>]+>/g, '').trim() === title; continue; } if (on) out += p; }
    return out;
  }
  function solveHTML(q) {
    let cond = sectionOf(q.more, 'Условие') || `<p>${esc(q.q)}</p>`;
    if (q.starter) cond = cond.replace(/<pre[\s\S]*?<\/pre>/g, '') + '<p class="muted">Исходный код уже в редакторе — правьте его прямо здесь.</p>';
    const L = q.logic || {};
    const hints = [];
    if (L.idea) hints.push(['💡 Подсказка 1: идея', `<p>${esc(L.idea)}</p>`]);
    if (L.steps) hints.push(['🧭 Подсказка 2: шаги решения', `<ol class="num">${L.steps.map((s, i) => `<li data-n="${i + 1}.">${esc(s)}</li>`).join('')}</ol>${L.cx ? `<p class="muted">⏱ ${esc(L.cx)}</p>` : ''}`]);
    const ap = sectionOf(q.more, 'Подходы'), edge = sectionOf(q.more, 'Крайние случаи и тесты'), found = sectionOf(q.more, 'Найденные проблемы');
    if (found) hints.push(['🧪 Подсказка 3: разбор всех проблем', found]);
    else if (ap || edge) hints.push(['🧪 Подсказка 3: подходы, крайние случаи и тесты', ap + (edge ? '<h4>Крайние случаи и тесты</h4>' + edge : '')]);
    const sol = sectionOf(q.more, 'Итоговое решение') || q.lv.j || q.lv.m || '';
    hints.push(['✅ Показать решение', sol + `<p><button class="tbtn" data-full="1">📖 Полный разбор задачи</button></p>`]);
    return `<div class="solve"><div class="solve-cond"><div class="solve-h">Условие</div>${cond}</div>
      <div class="solve-ed"></div>
      <div class="solve-tools">${q.starter ? '<button class="tbtn" data-sv="orig">Вернуть исходный код</button>' : '<button class="tbtn" data-sv="tpl">Заготовка класса</button>'}<button class="tbtn" data-sv="copy">Копировать</button><button class="tbtn" data-sv="clear">Очистить</button><a class="tbtn" href="#/pad/q:${q.id}">Открыть в блокноте</a></div>
      <div class="solve-hints"><div class="solve-h">Подсказки — открывайте по одной, если застряли</div>${hints.map(([t, h], i) => `<div class="hint-row" data-h="${i}"><button class="hint-btn${i === hints.length - 1 ? ' sol' : ''}">${t}</button><div class="hint-body answer">${h}</div></div>`).join('')}</div></div>`;
  }
  const TPL = 'import java.util.*;\n\npublic class Solution {\n\n    public static void main(String[] args) {\n        \n    }\n}\n';
  function mountSolve(root, q, card) {
    const ed = makeEditor($('.solve-ed', root), S.code[q.id] || q.starter || '', v => { if (v.trim()) S.code[q.id] = v; else delete S.code[q.id]; save(); }, { placeholder: 'Напишите решение здесь. Если застряли — откройте подсказку ниже.' });
    $$('.hint-btn', root).forEach(b => b.onclick = () => { const r = b.parentElement; r.classList.toggle('open'); if (r.classList.contains('open')) enhanceCode(r, q); });
    $$('[data-full]', root).forEach(b => b.onclick = () => { card.dataset.solve = ''; fillCard(card, 'd'); });
    $$('[data-sv]', root).forEach(b => b.onclick = () => {
      const a = b.dataset.sv;
      if (a === 'tpl') { if (!ed.get().trim() || confirm('Заменить текущий код заготовкой?')) ed.set(TPL); }
      else if (a === 'orig') { if (confirm('Вернуть исходный код задачи? Ваши правки будут потеряны.')) ed.set(q.starter); }
      else if (a === 'copy') fallbackCopy(ed.get());
      else if (a === 'clear') { if (confirm('Очистить черновик?')) ed.set(''); }
    });
  }

  // ---------- блокнот кода ----------
  function pagePad(arg) {
    const tasks = Object.keys(S.code).filter(id => Q[id] && S.code[id]);
    let cur = arg || S.padCur || (S.pads[0] ? 'p:' + S.pads[0].id : tasks[0] ? 'q:' + tasks[0] : null);
    if (cur && cur.startsWith('q:') && !Q[cur.slice(2)]) cur = null;
    if (cur && cur.startsWith('p:') && !S.pads.find(p => p.id === cur.slice(2))) cur = null;
    if (!cur) { const p = { id: Date.now().toString(36), name: 'Черновик 1', code: TPL }; S.pads.push(p); cur = 'p:' + p.id; }
    S.padCur = cur; save();
    const isQ = cur.startsWith('q:'); const q = isQ ? Q[cur.slice(2)] : null; const pad = isQ ? null : S.pads.find(p => p.id === cur.slice(2));
    const tasksAll = isQ && !tasks.includes(q.id) ? tasks.concat(q.id) : tasks;
    main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">⌨️ Блокнот кода</h1>
      <p class="subtitle">Пишите код с подсветкой синтаксиса и цветными скобками. Код не компилируется и не запускается — это тренировка «на доске». Черновики сохраняются автоматически.</p>
      <div class="pad-layout"><aside class="pad-list">
        <button class="btn" id="padNew" style="width:100%">＋ Новый черновик</button>
        <div class="pad-h">Мои черновики</div>${S.pads.map(p => `<a class="pad-item${cur === 'p:' + p.id ? ' on' : ''}" href="#/pad/p:${p.id}">${esc(p.name)}</a>`).join('') || '<div class="muted pad-empty">пока нет</div>'}
        <div class="pad-h">Решения задач</div>${tasksAll.map(id => `<a class="pad-item${cur === 'q:' + id ? ' on' : ''}" href="#/pad/q:${id}">${esc(Q[id].q)}</a>`).join('') || '<div class="muted pad-empty">Откройте задачу в теме «Лайфкодинг и LeetCode» и нажмите «✍ Решить самому» — решение появится здесь.</div>'}
      </aside><div class="pad-main">
        <div class="pad-top">${isQ ? `<a class="pad-title" href="#/q/${q.id}">${esc(q.q)} →</a>` : `<input class="pad-name" id="padName" value="${esc(pad.name)}" maxlength="60" title="Название черновика">`}
          <span class="sp"></span><button class="tbtn" id="padTpl">Заготовка класса</button><button class="tbtn" id="padCopy">Копировать</button>${isQ ? '' : '<button class="tbtn" id="padDel">🗑 Удалить</button>'}</div>
        <div id="padEd"></div></div></div></div>`;
    const ed = makeEditor($('#padEd'), isQ ? (S.code[q.id] || '') : pad.code, v => { if (isQ) { if (v.trim()) S.code[q.id] = v; else delete S.code[q.id]; } else { pad.code = v; pad.ts = Date.now(); } save(); }, { tall: true });
    $('#padNew').onclick = () => { const p = { id: Date.now().toString(36), name: 'Черновик ' + (S.pads.length + 1), code: TPL }; S.pads.push(p); save(); location.hash = '#/pad/p:' + p.id; };
    $('#padCopy').onclick = () => fallbackCopy(ed.get());
    $('#padTpl').onclick = () => { if (!ed.get().trim() || confirm('Заменить текущий код заготовкой?')) ed.set(TPL); };
    if (pad) {
      $('#padName').onchange = e => { pad.name = e.target.value.trim() || pad.name; save(); pagePad(cur); };
      $('#padDel').onclick = () => { if (!confirm(`Удалить черновик «${pad.name}»?`)) return; S.pads = S.pads.filter(p => p !== pad); S.padCur = null; save(); if (location.hash === '#/pad') pagePad(); else location.hash = '#/pad'; };
    }
    $('.main').scrollTop = 0;
  }

  // ---------- глоссарий ----------
  const GL = D.gloss || [];
  const GL_RE = {};
  (function () {
    const B = '(?<![\\p{L}\\p{N}_])', A = '(?![\\p{L}\\p{N}_])';
    const groups = { giu: [], gu: [] };
    GL.forEach((g, i) => { if (g.slang || !g.p) return; groups[g.cs ? 'gu' : 'giu'].push(i); g.slug = Q[g.q] ? Q[g.q].topic.slug : ''; });
    Object.entries(groups).forEach(([fl, ids]) => {
      if (!ids.length) return;
      try { GL_RE[fl] = { re: new RegExp(ids.map(i => B + '(' + GL[i].p.replace(/(?<!\\)\((?!\?)/g, '(?:') + ')' + A).join('|'), fl), ids }; }
      catch (e) { console.warn('glossary regex', e); }
    });
  })();
  function glossLink(root, q) {
    if (!GL.length) return;
    const used = new Set(); let links = 0; const MAX = 10;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest('pre, a, h4, .gl, .lv-head, .filled-note, button, .solve-ed') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (links >= MAX) break;
      const text = node.nodeValue; if (text.length < 2) continue;
      const found = [];
      Object.values(GL_RE).forEach(({ re, ids }) => {
        re.lastIndex = 0; let m;
        while ((m = re.exec(text))) { const gi = m.slice(1).findIndex(x => x !== undefined); found.push([m.index, m[0].length, ids[gi]]); if (!m[0].length) re.lastIndex++; }
      });
      if (!found.length) continue;
      found.sort((a, b) => a[0] - b[0]);
      const frag = document.createDocumentFragment(); let pos = 0, any = false;
      for (const [s, l, idx] of found) {
        const g = GL[idx];
        if (s < pos || used.has(idx) || links >= MAX || (q && (g.q === q.id || g.slug === q.topic.slug))) continue;
        used.add(idx); links++; any = true;
        frag.appendChild(document.createTextNode(text.slice(pos, s)));
        const a = document.createElement('a'); a.className = 'gl'; a.href = '#/q/' + g.q; a.dataset.g = idx; a.textContent = text.slice(s, s + l);
        frag.appendChild(a); pos = s + l;
      }
      if (!any) continue;
      frag.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    }
  }
  const gtip = document.createElement('div'); gtip.className = 'gtip'; document.body.appendChild(gtip);
  document.addEventListener('mouseover', e => {
    const a = e.target.closest && e.target.closest('.gl');
    if (!a) { gtip.classList.remove('show'); return; }
    const g = GL[+a.dataset.g]; if (!g) return;
    gtip.innerHTML = `<b>${esc(g.t)}</b><div>${esc(g.d)}</div><span class="gt-go">Клик — подробнее в теме «${esc(Q[g.q].topic.title)}»</span>`;
    gtip.classList.add('show');
    const r = a.getBoundingClientRect(); const w = gtip.offsetWidth, h = gtip.offsetHeight;
    const x = Math.min(innerWidth - w - 10, Math.max(10, r.left)); let y = r.bottom + 8; if (y + h > innerHeight - 10) y = r.top - h - 8;
    gtip.style.left = x + 'px'; gtip.style.top = y + 'px';
  });
  let glFilter = '', glKind = 'all';
  const glKindOf = g => g.slang ? 'slang' : g.t.startsWith('@') ? 'ann' : 'term';
  function pageGloss() {
    const letters = [...new Set(GL.map(g => g.t[0].toUpperCase()))];
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">📘 Глоссарий</h1>
      <p class="subtitle">${plural(GL.length, 'термин', 'термина', 'терминов')} с короткими определениями. В ответах справочника такие термины подчёркнуты пунктиром: наведите — увидите определение, кликните — перейдёте к вопросу, где тема разобрана подробно.</p>
      <div class="chips" style="margin-bottom:12px">${[['all', 'Все'], ['term', 'Термины'], ['ann', 'Аннотации'], ['slang', '💬 Сленг']].map(([k, l]) => `<button class="chip${glKind === k ? ' on' : ''}" data-gk="${k}">${l}<span class="n">${k === 'all' ? GL.length : GL.filter(g => glKindOf(g) === k).length}</span></button>`).join('')}<span class="sp"></span><a class="chip" href="#/gloss/train">🎯 Тренировка терминов</a></div>
      <input class="gl-search" id="glQ" placeholder="Фильтр терминов и аннотаций…" value="${esc(glFilter)}" autocomplete="off">
      <div class="gl-letters">${letters.map(l => `<button data-l="${esc(l)}">${esc(l)}</button>`).join('')}</div>
      <div id="glList"></div></div>`;
    const draw = () => {
      const f = norm(glFilter.trim());
      const items = GL.filter(g => (glKind === 'all' || glKindOf(g) === glKind) && (!f || norm(g.t).includes(f) || norm(g.d).includes(f)));
      let last = '';
      $('#glList').innerHTML = items.map(g => { const L = g.t[0].toUpperCase(); const h = L !== last ? `<div class="gl-letter" id="gl-${esc(L)}">${esc(L)}</div>` : ''; last = L; return h + `<div class="gl-row"><div class="gl-t">${esc(g.t)}</div><div class="gl-d">${g.slang ? '<span class="gl-slang">сленг</span> ' : ''}${esc(g.d)}${Q[g.q] ? `<a href="#/q/${g.q}">${esc(Q[g.q].q)} →</a>` : ''}</div></div>`; }).join('') || '<div class="empty">Ничего не найдено</div>';
    };
    draw();
    $('#glQ').oninput = e => { glFilter = e.target.value; draw(); };
    $$('[data-gk]').forEach(b => b.onclick = () => { glKind = b.dataset.gk; pageGloss(); });
    $$('.gl-letters button').forEach(a => a.onclick = () => { const el = document.getElementById('gl-' + a.dataset.l); if (el) el.scrollIntoView({ block: 'start' }); });
    $('.main').scrollTop = 0;
  }
  // ======================================================================

  // ---------- журнал изменений ----------
  const META = D.meta || {};
  function openChanges() {
    const log = META.changelog || [];
    let m = $('#chgModal');
    if (!m) { m = document.createElement('div'); m.id = 'chgModal'; m.className = 'modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal-box" role="dialog" aria-label="Что нового"><div class="modal-h"><div><b>Что нового</b><span class="muted"> · ${esc(META.title || '')} v${esc(META.version || '')}</span></div><button class="modal-x" title="Закрыть (Esc)">✕</button></div>
      <div class="modal-body">${log.map((r, i) => `<div class="chg${i === 0 ? ' cur' : ''}"><div class="chg-h"><span class="chg-v">v${esc(r.v)}</span><span class="chg-t">${esc(r.title)}</span>${i === 0 ? '<span class="chg-now">текущая</span>' : ''}<span class="chg-d">${esc(r.date)}</span></div><ul>${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="modal-f">${esc(META.author || '')}</div></div>`;
    m.classList.add('open'); $('#toast').classList.remove('show', 'sticky');
    $('.modal-x', m).onclick = closeChanges;
    m.onclick = e => { if (e.target === m) closeChanges(); };
    S.seenVersion = META.version; save();
  }
  function closeChanges() { const m = $('#chgModal'); if (m) m.classList.remove('open'); }
  document.addEventListener('click', e => { if (e.target.closest('[data-changes]')) { e.preventDefault(); openChanges(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeChanges(); });
  function versionHint() {
    if (!META.version || S.seenVersion === META.version) return;
    if (!S.seenVersion && !Object.keys(S.st).length) { S.seenVersion = META.version; save(); return; }  // новый пользователь
    const t = $('#toast'); t.innerHTML = `Приложение обновлено до v${esc(META.version)} — <a href="javascript:void 0" data-changes>что нового?</a>`;
    t.classList.add('show', 'sticky'); setTimeout(() => t.classList.remove('show', 'sticky'), 9000);
  }

  // ---------- тренировка по глоссарию ----------
  S.gl = S.gl || {};
  let GT = null;
  const isAnn = g => g.t.startsWith('@');
  function glossSet(src) {
    if (src === 'new') return GL.filter(g => S.gl[g.t] !== 'k');
    if (src === 'repeat') return GL.filter(g => S.gl[g.t] === 'r');
    if (src === 'ann') return GL.filter(isAnn);
    if (src === 'terms') return GL.filter(g => !isAnn(g) && !g.slang);
    if (src === 'slang') return GL.filter(g => g.slang);
    return GL.slice();
  }
  function pageGlossTrain() {
    const known = GL.filter(g => S.gl[g.t] === 'k').length, rep = GL.filter(g => S.gl[g.t] === 'r').length;
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a> · <a href="#/gloss">Глоссарий</a></div><h1 class="title">🎯 Тренировка терминов</h1>
      <p class="subtitle">Карточки по ${plural(GL.length, 'термину', 'терминам', 'терминам')} глоссария, включая аннотации. Знаю: ${known} · на повторении: ${rep}.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Режим</label><select id="gtMode"><option value="td">Термин → вспомнить определение</option><option value="dt">Определение → вспомнить термин</option><option value="mc">Тест: выбрать определение из 4</option></select></div>
        <div class="field"><label>Набор</label><select id="gtSrc"><option value="all">Все термины</option><option value="new">Ещё не выученные</option><option value="repeat">На повторении</option><option value="ann">Только аннотации</option><option value="terms">Только термины (без аннотаций)</option><option value="slang">💬 Программистский сленг</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:10px;align-items:center"><button class="btn" id="gtGo">Начать</button><span class="muted" id="gtCnt"></span></div></div>
      <div id="gtArea"></div></div>`;
    const upd = () => { $('#gtCnt').textContent = plural(glossSet($('#gtSrc').value).length, 'карточка', 'карточки', 'карточек'); };
    $('#gtSrc').onchange = upd; upd();
    $('#gtGo').onclick = () => {
      const list = shuffle(glossSet($('#gtSrc').value)).slice(0, 30);
      GT = { list, i: 0, shown: false, mode: $('#gtMode').value, k: 0, r: 0, pick: null };
      renderGT(); $('#gtArea').scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    $('.main').scrollTop = 0;
  }
  function gtOptions(g) {
    if (!g._opts) {
      const pool = shuffle(GL.filter(x => x !== g && isAnn(x) === isAnn(g) && !!x.slang === !!g.slang)).slice(0, 3);
      g._opts = shuffle([g].concat(pool));
    }
    return g._opts;
  }
  function renderGT() {
    const a = $('#gtArea'); if (!a || !GT) return;
    if (!GT.list.length) { a.innerHTML = '<div class="empty"><div class="big">📭</div>В этом наборе нет терминов</div>'; return; }
    if (GT.i >= GT.list.length) {
      a.innerHTML = `<div class="flash-card"><div class="empty"><div class="big">🏁</div><h2>Готово!</h2><p>Знаю: ${GT.k} · Повторить: ${GT.r} · Всего: ${GT.list.length}</p><button class="btn" id="gtAgain">Ещё раз</button></div></div>`;
      $('#gtAgain').onclick = () => pageGlossTrain(); renderNav(); return;
    }
    const g = GT.list[GT.i], q = Q[g.q];
    const link = q ? `<a class="tbtn" href="#/q/${g.q}">Подробнее: ${esc(q.topic.title)} →</a>` : '';
    let body;
    if (GT.mode === 'mc') {
      const opts = gtOptions(g);
      body = `<div class="fc-q gt-term">${esc(g.t)}</div><div class="qz-kind">◉ Выберите определение</div>
        <div class="qz-opts">${opts.map((o, n) => { let cls = ''; if (GT.pick !== null) cls = o === g ? 'ok' : (GT.pick === n ? 'bad' : ''); return `<label class="qz-opt ${cls}" data-n="${n}"><span class="qz-mark"></span><span class="qz-n">${n + 1}</span><span class="qz-t">${esc(o.d)}</span></label>`; }).join('')}</div>
        ${GT.pick !== null ? `<div class="fc-actions"><button class="btn" id="gtNext">Дальше →</button>${link}</div>` : ''}`;
    } else {
      const front = GT.mode === 'td' ? `<div class="fc-q gt-term">${esc(g.t)}</div>` : `<div class="fc-q gt-def">${esc(g.d)}</div>`;
      const back = GT.mode === 'td' ? `<div class="gt-answer">${esc(g.d)}</div>` : `<div class="gt-answer gt-term">${esc(g.t)}</div>`;
      body = front + (GT.shown ? back : '') + `<div class="fc-actions">${GT.shown
        ? `<button class="btn ok" id="gtK">✓ Знаю</button><button class="btn rep" id="gtR">↻ Повторить</button>${link}<span class="hint"><kbd>1</kbd> знаю · <kbd>2</kbd> повторить</span>`
        : `<button class="btn" id="gtShow">Показать ответ</button><button class="btn ghost" id="gtSkip">Пропустить →</button><span class="hint"><kbd>Пробел</kbd> показать</span>`}</div>`;
    }
    a.innerHTML = `<div class="train-bar"><i style="width:${GT.i / GT.list.length * 100}%"></i></div>
      <div class="flash-card"><div class="fc-meta"><span>${g.slang ? 'Сленг' : isAnn(g) ? 'Аннотация' : 'Термин'}${S.gl[g.t] === 'k' ? ' · ✓ знаю' : S.gl[g.t] === 'r' ? ' · ↻ повторить' : ''}</span><span>${GT.i + 1} / ${GT.list.length}</span></div>${body}</div>`;
    const next = () => { GT.i++; GT.shown = false; GT.pick = null; renderGT(); };
    const mark = v => { S.gl[g.t] = v; v === 'k' ? GT.k++ : GT.r++; save(); next(); };
    if ($('#gtShow')) $('#gtShow').onclick = () => { GT.shown = true; renderGT(); };
    if ($('#gtSkip')) $('#gtSkip').onclick = next;
    if ($('#gtK')) $('#gtK').onclick = () => mark('k');
    if ($('#gtR')) $('#gtR').onclick = () => mark('r');
    if ($('#gtNext')) $('#gtNext').onclick = next;
    $$('.qz-opt[data-n]', a).forEach(l => l.onclick = () => {
      if (GT.pick !== null) return;
      GT.pick = +l.dataset.n; const ok = gtOptions(g)[GT.pick] === g;
      S.gl[g.t] = ok ? 'k' : 'r'; ok ? GT.k++ : GT.r++; save(); renderGT();
    });
  }
  document.addEventListener('keydown', e => {
    if (!GT || !$('#gtArea') || e.target.matches('input,textarea,select') || e.ctrlKey || e.altKey) return;
    if (GT.i >= GT.list.length) return;
    if (e.key === ' ' && $('#gtShow')) { e.preventDefault(); $('#gtShow').click(); }
    else if (e.key === '1' && $('#gtK')) $('#gtK').click();
    else if (e.key === '2' && $('#gtR')) $('#gtR').click();
    else if (/^[1-4]$/.test(e.key) && GT.mode === 'mc' && GT.pick === null) { const el = $(`.qz-opt[data-n="${+e.key - 1}"]`); if (el) el.click(); }
    else if (e.key === 'Enter' && $('#gtNext')) $('#gtNext').click();
  });

  // ---------- вопрос дня ----------
  const strHash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const dayKey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const todayKey = () => dayKey(new Date());
  const roadIdSet = key => new Set((D.road || []).filter(r => !key || r.key === key || (key === 's' && r.key === 'st')).flatMap(r => r.blocks.flatMap(b => b.items.flatMap(it => it.ids))));
  function questionOfDay() {
    S.qod = S.qod && S.qod.d === todayKey() ? S.qod : { d: todayKey(), skip: 0 };
    const lvIds = ROAD_KEY[S.level] ? roadIdSet(ROAD_KEY[S.level]) : null;          // вопросы своего уровня из дорожной карты
    const base = ORDER.filter(q => !q.topic.module && st(q.id) !== 'k');
    let pool = lvIds ? base.filter(q => lvIds.has(q.id)) : base;
    if (pool.length < 5) pool = base.length ? base : ORDER.filter(q => !q.topic.module);
    return pool[(strHash(S.qod.d + P.cur + S.level) + S.qod.skip) % pool.length];
  }
  function quoteOfDay() {
    const Qs = D.quotes || []; if (!Qs.length) return null;
    if (S.qtDay !== todayKey()) { S.qtDay = todayKey(); S.qtSkip = 0; }
    return Qs[(strHash('q' + todayKey()) + (S.qtSkip || 0)) % Qs.length];
  }
  function termOfDay() { const pool = GL.filter(g => (S.gl || {})[g.t] !== 'k' && Q[g.q]); return pool.length ? pool[strHash('t' + todayKey() + P.cur) % pool.length] : null; }
  function exampleOfDay() { return DD_ALL.length ? DD_ALL[strHash('d' + todayKey() + P.cur) % DD_ALL.length] : null; }

  // ---------- сравнения ----------
  const CMP_RE = /(\bvs\.?\b|против|отличает|отличаются|отличие|отличия|разниц|сравн|различ|\bили\b[^?]*\?|когда что)/i;
  const COMPARE = ORDER.filter(q => CMP_RE.test(q.q) && q.topic.slug !== 'refactor');
  let cmpFilter = '';
  function pageCompare() {
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">⚖️ Сравнения</h1>
      <p class="subtitle">${plural(COMPARE.length, 'вопрос', 'вопроса', 'вопросов')} вида «X против Y» со всех тем: ArrayList и LinkedList, REST и gRPC, Kafka и RabbitMQ, merge и rebase… Откройте карточку — ответ на нужном уровне прямо здесь.</p>
      <input class="gl-search" id="cmpQ" placeholder="Фильтр: например, Kafka или JPA" value="${esc(cmpFilter)}" autocomplete="off">
      <div id="cmpList"></div></div>`;
    const draw = () => {
      const f = norm(cmpFilter.trim());
      const qs = COMPARE.filter(q => !f || q._q.includes(f) || norm(q.topic.title).includes(f));
      const byT = {}; qs.forEach(q => (byT[q.topic.title] = byT[q.topic.title] || []).push(q));
      $('#cmpList').innerHTML = Object.entries(byT).map(([t, list]) => `<div class="sec-title">${esc(t)} · ${list.length}</div>` + list.map(q => cardHTML(q)).join('')).join('') || '<div class="empty">Ничего не найдено</div>';
    };
    draw();
    $('#cmpQ').oninput = e => { cmpFilter = e.target.value; draw(); };
    $('.main').scrollTop = 0;
  }

  // ---------- модули и вкладки (0.9.6) ----------
  const MODULES = [
    { id: 'home', href: '#/', ico: '🏠', t: 'Главная', re: /^#\/?$|^$/ },
    { id: 'leet', href: '#/leetcode', ico: '💻', t: 'LeetCode', long: 'LeetCode и лайфкодинг', re: /^#\/leetcode/, topic: 'live' },
    { id: 'ref', href: '#/refactor', ico: '🛠', t: 'Рефакторинг', long: 'Практикум рефакторинга', re: /^#\/refactor/, topic: 'refactor' },
    { id: 'tests', href: '#/quiz', ico: '🧪', t: 'Тесты', re: /^#\/(quiz|exam)/ },
    { id: 'train', href: '#/train', ico: '🎯', t: 'Тренировка', re: /^#\/(train|gloss\/train)/ },
    { id: 'road', href: '#/road', ico: '🧭', t: 'Карта', re: /^#\/road/ },
    { id: 'gloss', href: '#/gloss', ico: '📘', t: 'Глоссарий', re: /^#\/(gloss$|compare|dodont)/ },
    { id: 'prog', href: '#/stats', ico: '📊', t: 'Прогресс', re: /^#\/(stats|repeat|notes|top)/ },
  ];
  // тренажёры из отдельных файлов (assets/js/*.js подключаются до app.js и регистрируются в window.APP_EXT)
  const EXT = window.APP_EXT || [];
  MODULES.splice(MODULES.findIndex(m => m.id === 'ref') + 1, 0, ...EXT.map(x => Object.assign({ trainer: true }, x)));
  const API = {
    $, $$, esc, plural, norm, toast, save, st, Q, TOPIC, ORDER,
    main: () => main(), S: () => S, renderNav: () => renderNav(),
    makeEditor: (...a) => makeEditor(...a), enhanceCode: (...a) => enhanceCode(...a), fallbackCopy: t => fallbackCopy(t),
  };
  const TABS = {
    tests: [['#/quiz', '🧪 Самотест'], ['#/exam', '🎫 Экзамен и билеты']],
    train: [['#/train', '🎯 Вопросы'], ['#/gloss/train', '📘 Термины']],
    gloss: [['#/gloss', '📘 Глоссарий'], ['#/compare', '⚖️ Сравнения'], ['#/dodont', '✅❌ Правильно и неправильно']],
    tools: [['#/jwt', '🔑 JWT'], ['#/json', '{ } JSON'], ['#/hash', '# Хеши и Base64']],
    prog: [['#/stats', '📊 Статистика'], ['#/repeat', '↻ На повторение'], ['#/notes', '📝 Заметки'], ['#/top', '⭐ Ключевые вопросы']],
  };
  function currentModule(h) {
    const q = h.startsWith('#/q/') || h.startsWith('#/solve/') ? Q[h.replace(/^#\/(q|solve)\//, '')] : null;
    if (q) { const m = MODULES.find(m => m.topic && m.topic === q.topic.slug); return m ? m.id : null; }
    const t = h.match(/^#\/t\/(.+)$/); if (t) { const m = MODULES.find(m => m.topic === t[1]); return m ? m.id : null; }
    const m = MODULES.find(m => m.re.test(h)); return m ? m.id : null;
  }
  function addTabs(h) {
    const mod = currentModule(h); const tabs = TABS[mod]; const page = $('#content .page'); if (!tabs || !page) return;
    const base = h.split('/').slice(0, 3).join('/');
    const counts = { '#/repeat': ORDER.filter(q => st(q.id) === 'r').length, '#/notes': Object.keys(S.notes).filter(k => S.notes[k] && Q[k]).length };
    const bar = document.createElement('div'); bar.className = 'page-tabs';
    bar.innerHTML = tabs.map(([href, label]) => `<a href="${href}" class="${(h === href || base === href || (href !== '#/gloss' && h.startsWith(href + '/'))) ? 'on' : ''}">${label}${counts[href] ? `<span class="n">${counts[href]}</span>` : ''}</a>`).join('');
    page.insertBefore(bar, page.firstChild);
  }

  // ---------- каталоги тренажёров ----------
  const diffOf = q => (q.lc && q.lc.diff) || q.diff || '—';
  const solvedState = q => st(q.id) === 'k' ? 'done' : S.code[q.id] ? 'draft' : 'new';
  const STATE_LABEL = { done: '✓ решено', draft: '✎ черновик', new: '' };
  let leetF = { diff: 'all', tag: 'all', state: 'all' };
  function pageLeet() {
    const tasks = topicQs(TOPIC.live);
    const tags = [...new Set(tasks.flatMap(q => q.tags || []))].sort((a, b) => a.localeCompare(b, 'ru'));
    const done = tasks.filter(q => solvedState(q) === 'done').length;
    main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a> · Тренажёры</div><h1 class="title">💻 LeetCode и лайфкодинг</h1>
      <p class="subtitle">${plural(tasks.length, 'задача', 'задачи', 'задач')} · решено ${done}. Откройте задачу — она сразу запустится в режиме «решить самому»: условие, редактор, подсказки по шагам и разбор. Решение считается засчитанным, когда вы отметите задачу «✓ Знаю».</p>
      <div class="cat-filters">
        <div class="chips">${['all', 'Easy', 'Medium', 'Hard'].map(d => `<button class="chip${leetF.diff === d ? ' on' : ''}" data-diff="${d}">${d === 'all' ? 'Любая сложность' : d}</button>`).join('')}</div>
        <div class="chips">${[['all', 'Все'], ['new', 'Не начаты'], ['draft', 'Черновик'], ['done', 'Решены']].map(([k, l]) => `<button class="chip${leetF.state === k ? ' on' : ''}" data-state="${k}">${l}</button>`).join('')}
          <select id="leetTag" class="cat-select"><option value="all">Все техники</option>${tags.map(t => `<option${leetF.tag === t ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <a class="chip" href="#/pad">⌨️ Блокнот кода</a></div></div>
      <div id="catList"></div></div>`;
    const draw = () => {
      const list = tasks.filter(q => (leetF.diff === 'all' || diffOf(q) === leetF.diff) && (leetF.tag === 'all' || (q.tags || []).includes(leetF.tag)) && (leetF.state === 'all' || solvedState(q) === leetF.state));
      $('#catList').innerHTML = list.length ? `<div class="cat-table">${list.map((q, i) => { const s = solvedState(q); return `<a class="cat-row ${s}" href="#/solve/${q.id}">
        <span class="cat-n">${q.lc ? 'LC ' + q.lc.num : i + 1}</span>
        <span class="cat-t">${esc(q.q.replace(/\s*\(LeetCode[^)]*\)/, ''))}<span class="cat-tags">${(q.tags || []).map(t => `<i>${esc(t)}</i>`).join('')}</span></span>
        <span class="badge ${diffOf(q).toLowerCase()}">${diffOf(q)}</span><span class="cat-s">${STATE_LABEL[s]}</span></a>`; }).join('')}</div>` : '<div class="empty">Нет задач по фильтру</div>';
    };
    draw();
    $$('[data-diff]').forEach(b => b.onclick = () => { leetF.diff = b.dataset.diff; pageLeet(); });
    $$('[data-state]').forEach(b => b.onclick = () => { leetF.state = b.dataset.state; pageLeet(); });
    $('#leetTag').onchange = e => { leetF.tag = e.target.value; draw(); };
    $('.main').scrollTop = 0;
  }
  let refF = { cat: 'all', size: 'all', state: 'all' };
  const classCount = q => (q.starter || '').match(/^\s*(public\s+|final\s+|abstract\s+)*(class|interface|record|enum)\s+\w+/gm)?.length || 1;
  const problemCount = q => { const sec = sectionOf(q.more, 'Найденные проблемы'); return Math.max(0, (sec.match(/<tr>/g) || []).length - 1); };
  function pageRefCatalog() {
    const tasks = topicQs(TOPIC.refactor);
    const cats = [...new Set(tasks.map(q => q.sec))];
    const done = tasks.filter(q => solvedState(q) === 'done').length;
    main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a> · Тренажёры</div><h1 class="title">🛠 Практикум рефакторинга</h1>
      <p class="subtitle">${plural(tasks.length, 'задача', 'задачи', 'задач')} с плохим кодом · выполнено ${done}. Код открывается прямо в редакторе: найдите проблемы, исправьте, затем сверьтесь с подсказками, разбором и решением. Теория — в теме «<a href="#/t/clean">Чистый код</a>».</p>
      <div class="cat-filters">
        <div class="chips"><button class="chip${refF.cat === 'all' ? ' on' : ''}" data-cat="all">Все</button>${cats.map(c => `<button class="chip${refF.cat === c ? ' on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
        <div class="chips">${[['all', 'Любой объём'], ['one', 'Один класс'], ['many', 'Несколько классов']].map(([k, l]) => `<button class="chip${refF.size === k ? ' on' : ''}" data-size="${k}">${l}</button>`).join('')}
          ${[['all', 'Все'], ['new', 'Не начаты'], ['draft', 'Черновик'], ['done', 'Выполнены']].map(([k, l]) => `<button class="chip${refF.state === k ? ' on' : ''}" data-state="${k}">${l}</button>`).join('')}
          <a class="chip" href="#/pad">⌨️ Блокнот кода</a></div></div>
      <div id="catList"></div></div>`;
    const list = tasks.filter(q => (refF.cat === 'all' || q.sec === refF.cat) && (refF.size === 'all' || (refF.size === 'many') === (classCount(q) > 1)) && (refF.state === 'all' || solvedState(q) === refF.state));
    $('#catList').innerHTML = list.length ? `<div class="cat-table">${list.map((q, i) => { const s = solvedState(q), n = classCount(q); return `<a class="cat-row ${s}" href="#/solve/${q.id}">
      <span class="cat-n">${i + 1}</span>
      <span class="cat-t">${esc(q.q)}<span class="cat-tags"><i>${esc(q.sec)}</i><i>${n > 1 ? plural(n, 'класс', 'класса', 'классов') : 'один класс'}</i><i>${plural(problemCount(q), 'проблема', 'проблемы', 'проблем')}</i></span></span>
      <span class="cat-s">${STATE_LABEL[s]}</span></a>`; }).join('')}</div>` : '<div class="empty">Нет задач по фильтру</div>';
    $$('[data-cat]').forEach(b => b.onclick = () => { refF.cat = b.dataset.cat; pageRefCatalog(); });
    $$('[data-size]').forEach(b => b.onclick = () => { refF.size = b.dataset.size; pageRefCatalog(); });
    $$('[data-state]').forEach(b => b.onclick = () => { refF.state = b.dataset.state; pageRefCatalog(); });
    $('.main').scrollTop = 0;
  }
  function openSolve(id) {
    const q = Q[id]; if (!q) return pageHome();
    pageTopic(q.topic.slug, id);
    const card = $('#q-' + CSS.escape(id)); if (!card) return;
    card.dataset.solve = '1'; fillCard(card);
  }

  function renderBottomBar(h) {
    const bb = $('#bottomBar'); if (!bb) return; const mod = currentModule(h || location.hash || '#/');
    bb.innerHTML = [['#/', '🏠', 'Главная', 'home'], ['menu', '📚', 'Темы', ''], ['#/leetcode', '💻', 'LeetCode', 'leet'], ['#/quiz', '🧪', 'Тесты', 'tests'], ['#/stats', '📊', 'Прогресс', 'prog']]
      .map(([href, i, t, id]) => href === 'menu' ? `<button class="bb-i" id="bbMenu"><span>${i}</span>${t}</button>` : `<a class="bb-i${mod === id ? ' on' : ''}" href="${href}" data-hint="${esc(HINTS[id] || t)}"><span>${i}</span>${t}</a>`).join('');
    $('#bbMenu').onclick = () => setNav(true);
  }
  // ---------- меню: само сворачивается на страницах тем, разворачивается при наведении ----------
  // S.sidePin: null — автоматически; 'open' / 'mini' — закреплено вручную стрелкой
  if (S.sideMini !== undefined) { delete S.sideMini; }
  const isReading = h => /^#\/(t|q|solve)\//.test(h || '');
  const autoMini = h => isReading(h);
  function applySideMini(h) {
    h = h === undefined ? decodeURIComponent(location.hash || '#/') : h;
    const wide = matchMedia('(min-width: 901px)').matches;   // на телефоне меню — шторка, сворачивать нечего
    const mini = wide && (S.sidePin ? S.sidePin === 'mini' : autoMini(h));
    document.body.classList.toggle('side-mini', mini);
    if (!mini) document.body.classList.remove('side-peek');
    const b = $('#sideToggle'); if (!b) return;
    b.textContent = mini ? '»' : '«';
    b.dataset.hint = mini
      ? (S.sidePin ? 'Развернуть меню' : 'Меню свёрнуто само, чтобы не отвлекать. Наведите — развернётся; нажмите — закрепить развёрнутым')
      : (S.sidePin ? 'Свернуть меню до иконок' : 'Свернуть меню до иконок (на страницах тем оно сворачивается само)');
  }
  $('#sideToggle').onclick = e => {
    e.stopPropagation();
    const h = decodeURIComponent(location.hash || '#/'), cur = document.body.classList.contains('side-mini'), next = !cur;
    S.sidePin = next === autoMini(h) ? null : (next ? 'mini' : 'open');   // совпало с автоматикой — снова автоматически
    save(); document.body.classList.remove('mini-open', 'side-peek'); applySideMini(h);
  };
  // наведение на полосу иконок — меню выезжает поверх страницы, увели мышь — сворачивается
  let peekT = 0;
  $('.sidebar').addEventListener('mouseenter', () => {
    if (!document.body.classList.contains('side-mini') || !matchMedia('(hover: hover) and (min-width: 901px)').matches) return;
    clearTimeout(peekT); peekT = setTimeout(() => document.body.classList.add('side-peek'), 220);
  });
  $('.sidebar').addEventListener('mouseleave', () => { clearTimeout(peekT); peekT = setTimeout(() => document.body.classList.remove('side-peek'), 250); });
  document.addEventListener('click', e => { if (document.body.classList.contains('mini-open') && document.contains(e.target) && !e.target.closest('.nav, .nav-filter, #miniTopics')) document.body.classList.remove('mini-open'); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.body.classList.remove('mini-open', 'side-peek'); });
  applySideMini();
  matchMedia('(min-width: 901px)').addEventListener('change', () => applySideMini());
  // ---------- мобильное меню ----------
  const isMobile = () => matchMedia('(max-width: 900px)').matches;
  function setNav(open) { document.body.classList.toggle('nav-open', open); }
  $('#menuBtn').onclick = () => setNav(!document.body.classList.contains('nav-open'));
  $('#navScrim').onclick = () => setNav(false);
  document.addEventListener('click', e => { if (isMobile() && e.target.closest('.sidebar a[href^="#"]')) setNav(false); });

  // ---------- история: возврат туда, где были ----------
  // для каждой записи истории браузера запоминаем прокрутку, раскрытые ответы и фильтр темы
  let navIdx = -1; const NAV = [];
  function navSave() {
    const m = $('.main'); if (!m || navIdx < 0) return;
    const st = Object.assign({}, history.state || {}, { idx: navIdx, sc: Math.round(m.scrollTop), open: $$('.card.open').map(c => c.dataset.id).slice(0, 40), tf: topicFilter });
    try { history.replaceState(st, ''); } catch (e) { }
  }
  let navSaveT = 0;
  $('.main').addEventListener('scroll', () => { clearTimeout(navSaveT); navSaveT = setTimeout(navSave, 120); }, { passive: true });
  function pageLabel(h) {
    let m;
    if ((m = h.match(/^#\/(?:q|solve)\/(.+)$/)) && Q[m[1]]) { const t = Q[m[1]].q; return t.length > 60 ? t.slice(0, 58) + '…' : t; }
    if ((m = h.match(/^#\/t\/([^/]+)/)) && TOPIC[m[1]]) return TOPIC[m[1]].title + (h.endsWith('/do') ? ' · правильно и неправильно' : '');
    if (h === '#/' || h === '') return 'Главная';
    const t = $('#content h1'); return t ? t.textContent.replace(/^[^\p{L}\p{N}{]+/u, '').trim().slice(0, 60) : 'предыдущая страница';
  }
  function navBefore() {
    const st = history.state;
    if (st && typeof st.idx === 'number') { navIdx = st.idx; return st.sc !== undefined ? st : null; }
    navIdx = navIdx + 1; NAV.length = navIdx;
    try { history.replaceState({ idx: navIdx }, ''); } catch (e) { }
    return null;
  }
  function navAfter(h, saved) {
    NAV[navIdx] = { hash: h, title: pageLabel(h) };
    const prev = NAV[navIdx - 1];
    if (prev && prev.hash !== h && h !== '#/') {
      const b = document.createElement('button'); b.className = 'back-pill'; b.dataset.hint = 'Вернуться туда, где вы были (как кнопка «Назад» браузера)';
      b.innerHTML = `<span>←</span> Назад: <b>${esc(prev.title)}</b>`; b.onclick = () => history.back();
      main().insertBefore(b, main().firstChild);
    }
    if (saved) {
      (saved.open || []).forEach(id => { const c = $('#q-' + CSS.escape(id)); if (c) toggleCard(c, true); });
      const restore = () => { const m = $('.main'); if (m) m.scrollTo({ top: saved.sc || 0, behavior: 'instant' }); };
      restore(); requestAnimationFrame(() => requestAnimationFrame(restore)); setTimeout(restore, 120);
    }
  }

  // ---------- роутер ----------
  function route() {
    const h = decodeURIComponent(location.hash || '#/');
    const saved = navBefore(); if (saved && saved.tf) topicFilter = saved.tf;
    tip.classList.remove('show'); sDrop().classList.remove('open'); const spop = document.getElementById('stylePop'); if (spop) spop.classList.remove('open'); sInput().blur(); QZ = null; setNav(false);
    let m;
    if ((m = h.match(/^#\/t\/([^/]+)\/do$/)) && TOPIC[m[1]]) { curTopicPage = null; pageDoDont(m[1]); }
    else if (h === '#/about' || h === '#/about/support') { curTopicPage = null; pageAbout(); if (h.endsWith('/support')) { const go = () => { const el = $('#support'); if (el && location.hash === '#/about/support') el.scrollIntoView({ block: 'start' }); }; setTimeout(go, 60); (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(go, 30)); } }
    else if (h === '#/dodont') { curTopicPage = null; pageDoDontAll(); }
    else if ((m = h.match(/^#\/t\/(.+)$/))) { if (TOPIC[m[1]] !== curTopicPage && !saved) topicFilter = 'all'; curTopicPage = TOPIC[m[1]]; pageTopic(m[1]); }
    else if ((m = h.match(/^#\/q\/(.+)$/)) && Q[m[1]]) { const q = Q[m[1]]; if (curTopicPage !== q.topic && !saved) topicFilter = 'all'; curTopicPage = q.topic; pageTopic(q.topic.slug, q.id); }
    else if (EXT.some(x => (m = h.match(x.re)) && (curTopicPage = null, x.page(API, m), true))) { }
    else if ((m = h.match(/^#\/solve\/(.+)$/)) && Q[m[1]]) { curTopicPage = Q[m[1]].topic; topicFilter = 'all'; openSolve(m[1]); }
    else if (h === '#/leetcode') { curTopicPage = null; pageLeet(); }
    else if (h === '#/refactor') { curTopicPage = null; pageRefCatalog(); }
    else if (h === '#/top') { curTopicPage = null; pageTop(); }
    else if (h === '#/notes') { curTopicPage = null; pageNotes(); }
    else if ((m = h.match(/^#\/road(?:\/(.+))?$/))) { curTopicPage = null; pageRoad(m[1]); }
    else if (h === '#/exam') { curTopicPage = null; pageExam(); }
    else if (h === '#/stats') { curTopicPage = null; pageStats(); }
    else if (h === '#/gloss') { curTopicPage = null; pageGloss(); }
    else if (h === '#/gloss/train') { curTopicPage = null; pageGlossTrain(); }
    else if (h === '#/compare') { curTopicPage = null; pageCompare(); }
    else if ((m = h.match(/^#\/pad(?:\/(.+))?$/))) { curTopicPage = null; pagePad(m[1]); }
    else if (h === '#/repeat') { curTopicPage = null; pageRepeat(); }
    else if ((m = h.match(/^#\/train(?:\/(.+))?$/))) { curTopicPage = null; pageTrain(m[1]); }
    else if ((m = h.match(/^#\/quiz(?:\/(.+))?$/))) { curTopicPage = null; pageQuiz(m[1]); }
    else if ((m = h.match(/^#\/search\/(.+)$/))) { curTopicPage = null; pageSearch(m[1]); }
    else { curTopicPage = null; pageHome(); }
    addTabs(h); navAfter(h, saved); renderNav(); renderBottomBar(h); document.body.classList.remove('mini-open', 'side-peek', 'ol-open'); applySideMini(h); setOutlineMode();
  }
  let curTopicPage = null;

  // ---------- верхняя панель ----------
  function renderLevelSeg() {
    $('#lvSeg').innerHTML = ['j', 'm', 's', 'a', 'd'].map(k => `<button data-l="${k}" class="${S.level === k ? 'on' : ''}" title="${LV[k]}">${k === 'a' ? 'Все' : k === 'd' ? 'Подробно' : LV[k]}</button>`).join('');
  }
  function setLevel(l) {
    S.level = l; save(); renderLevelSeg();
    $$('.card').forEach(c => { c.dataset.lv = l; if (c.dataset.filled) fillCard(c, l); });
    if (T && $('#trArea')) trainLevel(l);
  }
  $('#lvSeg').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setLevel(b.dataset.l); });
  // обои: одна обработанная картинка на каждый вариант, рисунок окрашивается цветом акцента активного стиля
  const WALLS = D.walls || [];
  if (location.protocol === 'file:') document.documentElement.classList.add('file-mode');
  function applyWall() {
    let id = S.wall || 'none';
    if (id === 'daily' && WALLS.length) id = WALLS[strHash('w' + todayKey()) % WALLS.length][0];
    const ok = WALLS.some(w => w[0] === id);
    document.body.classList.toggle('has-wall', ok);
    if (ok) $('#wall').style.setProperty('--wall-img', `url("../wallpapers/${id}.jpg")`   /* путь считается от assets/css/style.css */);
  }
  // окно оформления: тема и стиль
  const STYLES = [
    ['lime', 'Soft Lime', 'по умолчанию: свежо, без неона', ['#a3d65c', '#202720', '#f5f6f1']],
    ['sage', 'Sage', 'спокойный, для долгого чтения', ['#76bfa1', '#202923', '#f3f5f0']],
    ['terminal', 'Terminal Green', 'гик-стиль, заголовки как в терминале', ['#8dce70', '#171a18', '#f4f4ef']],
    ['electric', 'Electric Lime', 'энергичный, больше контраста', ['#b5d96b', '#181a20', '#f7f6f1']],
    ['classic', 'Классика', 'прежний сине-фиолетовый стиль', ['#4f6bed', '#15171c', '#f6f5f1']],
  ];
  const stylePop = document.createElement('div'); stylePop.className = 'style-pop'; stylePop.id = 'stylePop'; document.body.appendChild(stylePop);
  function renderStylePop() {
    stylePop.innerHTML = `<div class="sp-h">Тема</div><div class="sp-modes">${[['light', '☀️ Светлая'], ['dark', '🌙 Тёмная'], ['auto', '🖥 Как в системе']].map(([k, l]) => `<button data-mode="${k}" class="${S.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="sp-h">Обои <span class="sp-note">по краям широкого экрана</span></div><div class="sp-walls">
        <button class="sp-w${!S.wall || S.wall === 'none' ? ' on' : ''}" data-wall="none" data-hint="Без обоев — спокойный фон"><span class="sp-wt none">—</span>Нет</button>
        <button class="sp-w${S.wall === 'daily' ? ' on' : ''}" data-wall="daily" data-hint="Каждый день — другие обои"><span class="sp-wt none">↻</span>Каждый день</button>
        ${WALLS.map(([id, t]) => `<button class="sp-w${S.wall === id ? ' on' : ''}" data-wall="${id}" data-hint="${esc(t)}"><span class="sp-wt" style="--t:url('../wallpapers/${id}-thumb.jpg')"></span>${esc(t)}</button>`).join('')}</div>
      <div class="sp-h">Стиль</div><div class="sp-styles">${STYLES.map(([k, t, d, c]) => `<button class="sp-st${S.style === k ? ' on' : ''}" data-style="${k}"><span class="sp-sw">${c.map(x => `<i style="background:${x}"></i>`).join('')}</span><b>${t}</b><span>${d}</span></button>`).join('')}</div>`;
    $$('[data-mode]', stylePop).forEach(b => b.onclick = () => { S.theme = b.dataset.mode; save(); applyTheme(); renderStylePop(); });
    $$('.sp-st', stylePop).forEach(b => b.onclick = () => { S.style = b.dataset.style; save(); applyTheme(); renderStylePop(); });
    $$('[data-wall]', stylePop).forEach(b => b.onclick = () => { S.wall = b.dataset.wall; save(); applyWall(); renderStylePop(); });
  }
  $('#themeBtn').onclick = e => { e.stopPropagation(); renderStylePop(); stylePop.classList.toggle('open'); };
  stylePop.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') stylePop.classList.remove('open'); });   // перерисовка не должна закрывать окно
  document.addEventListener('click', e => { if (!e.target.closest('#stylePop, #themeBtn')) stylePop.classList.remove('open'); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') applyTheme(); });
  $('#rndBtn').onclick = randomQ;
  $('.brand').onclick = () => { location.hash = '#/'; };

  sInput().addEventListener('input', renderDrop);
  sInput().addEventListener('focus', renderDrop);
  sInput().addEventListener('keydown', e => {
    const items = $$('.s-item', sDrop());
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!items.length) return; sSel = (sSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((it, i) => it.classList.toggle('sel', i === sSel)); items[sSel].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { const v = sInput().value.trim(); if (sSel >= 0 && items[sSel]) location.hash = items[sSel].getAttribute('href'); else if (v) location.hash = '#/search/' + encodeURIComponent(v); sInput().blur(); sDrop().classList.remove('open'); }
    else if (e.key === 'Escape') { sInput().blur(); sDrop().classList.remove('open'); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) sDrop().classList.remove('open'); });

  document.addEventListener('keydown', e => {
    if ($('#lb').classList.contains('open')) {
      if (e.key === 'Escape') closeLB(); else if (e.key === 'ArrowLeft') $('#lbPrev').click(); else if (e.key === 'ArrowRight') $('#lbNext').click();
      return;
    }
    if (e.target.matches('input,textarea,select')) return;
    if (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) { e.preventDefault(); sInput().focus(); sInput().select(); return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (T && $('#trArea') && T.i < T.list.length) {
      if (e.key === ' ' && !T.shown) { e.preventDefault(); $('#tShow') && $('#tShow').click(); return; }
      if (e.key === '1' && T.shown) { $('#tK').click(); return; }
      if (e.key === '2' && T.shown) { $('#tR').click(); return; }
      if (e.key === 'ArrowRight') { $('#tN').click(); return; }
    } else if (!QZ && ['1', '2', '3', '4', '5'].includes(e.key)) { const l = 'jmsad'['12345'.indexOf(e.key)]; setLevel(l); toast('Уровень: ' + LV[l]); return; }
    if (!QZ && (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к')) randomQ();
  });

  // ---------- проверка обновлений ----------
  const cmpVer = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  function checkUpdate() {
    if (!META.site || !navigator.onLine || !window.fetch) return;
    fetch(META.site + 'version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => {
      if (!v || !v.version || cmpVer(v.version, META.version) <= 0 || sessionStorage.getItem('vibeoff:upd-later') === v.version || $('#updBar')) return;
      const online = location.protocol.startsWith('http');
      const bar = document.createElement('div'); bar.id = 'updBar'; bar.className = 'upd-bar';
      bar.innerHTML = `<span>✨ Вышла новая версия <b>v${esc(v.version)}</b>${v.title ? ': ' + esc(v.title) : ''}</span>
        ${online ? '<button class="btn" id="updGo">Обновить</button>' : `<a class="btn" id="updGo" href="${esc(META.download || META.site)}">Скачать</a>`}<button class="chip" id="updLater">Позже</button>`;
      document.body.appendChild(bar);
      if (online) $('#updGo').onclick = () => { save(); location.replace(location.pathname + '?v=' + encodeURIComponent(v.version) + location.hash); };
      $('#updLater').onclick = () => { sessionStorage.setItem('vibeoff:upd-later', v.version); bar.remove(); };
    }).catch(() => { });
  }
  setTimeout(checkUpdate, 2500); setInterval(checkUpdate, 30 * 60 * 1000);

  // ---------- старт ----------
  lastSig = learnSig();
  if (!Array.isArray(S.achGot)) S.achGot = achievements().filter(a => a[3]).map(a => a[1]);   // уже полученные — без поздравлений
  applyTheme(); renderLevelSeg(); renderProfile();
  setTimeout(versionHint, 800);
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) { clearTimeout(navSaveT); navSave(); } }, true);
  route();
})();
