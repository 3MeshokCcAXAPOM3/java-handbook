/* Java-справочник: оффлайн-приложение без зависимостей (кроме highlight.js) */
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
  S.st = S.st || {}; S.notes = S.notes || {}; S.level = S.level || 'j'; S.theme = S.theme || 'light'; S.collapsed = S.collapsed || {};
  S.hist = S.hist || []; S.tk = S.tk || {}; S.code = S.code || {}; S.pads = S.pads || []; S.road = S.road || {};
  // объединённые дубли: перенести отметки со старых id
  Object.entries(D.alias || {}).forEach(([o, n]) => {
    if (S.st[o]) { if (!S.st[n]) S.st[n] = S.st[o]; delete S.st[o]; }
    if (S.notes[o]) { S.notes[n] = (S.notes[n] ? S.notes[n] + '\n\n' : '') + S.notes[o]; delete S.notes[o]; }
  });
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Не удалось сохранить: хранилище браузера недоступно'); } };
  const st = id => S.st[id] || '';
  function setSt(id, v) {
    if (st(id) === v) delete S.st[id]; else S.st[id] = v;
    save(); refreshStatus(id); renderNav(); updateTopicProgress();
  }

  // ---------- тема ----------
  function applyTheme() { document.documentElement.dataset.theme = S.theme; $('#themeBtn').textContent = S.theme === 'dark' ? '☀️' : '🌙'; }

  // ---------- утилиты ----------
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 1800); }
  function stats(list) { let k = 0, r = 0; list.forEach(q => { const v = st(q.id); if (v === 'k') k++; else if (v === 'r') r++; }); return { k, r, n: list.length }; }
  const topicQs = t => t.sections.flatMap(s => s.items);
  function barHTML(s, cls = 'bar') { const pk = s.n ? s.k / s.n * 100 : 0, pr = s.n ? s.r / s.n * 100 : 0; return `<div class="${cls}"><i class="k" style="width:${pk}%"></i><i class="r" style="width:${pr}%"></i></div>`; }
  function plural(n, a, b, c) { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); }

  // ---------- боковая навигация ----------
  function renderNav() {
    const cur = location.hash;
    const starCnt = ORDER.filter(q => q.star).length, repCnt = ORDER.filter(q => st(q.id) === 'r').length, noteCnt = Object.keys(S.notes).filter(k => S.notes[k] && Q[k]).length;
    $('#sideLinks').innerHTML = [
      ['#/', '🏠', 'Главная', ''],
      ['#/road', '🧭', 'Дорожная карта', ''],
      ['#/top', '⭐', 'Ключевые вопросы', starCnt],
      ['#/train', '🎯', 'Тренировка', ''],
      ['#/quiz', '🧪', 'Самотест', (D.quiz || []).length],
      ['#/exam', '🎫', 'Экзамен и билеты', ''],
      ['#/pad', '⌨️', 'Блокнот кода', ''],
      ['#/gloss', '📘', 'Глоссарий', (D.gloss || []).length || ''],
      ['#/stats', '📊', 'Статистика', ''],
      ['#/repeat', '↻', 'На повторение', repCnt || ''],
      ['#/notes', '📝', 'Мои заметки', noteCnt || ''],
    ].map(([h, i, t, c]) => `<a class="side-link${(cur === h || (h === '#/' && (cur === '' || cur === '#'))) ? ' active' : ''}" href="${h}"><span class="ico">${i}</span>${t}<span class="cnt">${c}</span></a>`).join('');
    const curSlug = (cur.match(/^#\/(?:t|q)\/([^/]+?)(?:-x?\d+)?$/) || [])[1];
    const curTopic = cur.startsWith('#/q/') ? (Q[decodeURIComponent(cur.slice(4))] || {}).topic : TOPIC[curSlug];
    $('#nav').innerHTML = D.groups.map(g => {
      const ts = D.topics.filter(t => t.group === g);
      return `<div class="nav-group${S.collapsed[g] ? ' collapsed' : ''}" data-g="${esc(g)}"><div class="nav-gtitle"><span class="chev">▼</span>${esc(g)}</div><div class="nav-items">` +
        ts.map(t => {
          const s = stats(topicQs(t));
          const cnt = t.count ? `${s.k}/${t.count}` : `${t.gallery.length} илл.`;
          return `<a class="nav-item${curTopic === t ? ' active' : ''}" href="#/t/${t.slug}"><div class="nav-row"><span class="nav-name">${esc(t.title)}</span><span class="nav-cnt">${cnt}</span></div>${t.count ? barHTML(s, 'mini-bar') : ''}</a>`;
        }).join('') + '</div></div>';
    }).join('');
  }
  document.addEventListener('click', e => {
    const gt = e.target.closest('.nav-gtitle'); if (!gt) return;
    const g = gt.parentElement.dataset.g; S.collapsed[g] = !S.collapsed[g]; save(); gt.parentElement.classList.toggle('collapsed');
  });

  // ---------- рендер ответа ----------
  function levelHTML(q, l) {
    if (l === 'd') return q.more ? `<div class="more-block">${q.more}</div>` : levelHTML(q, 'a');
    if (l === 'a') return ['j', 'm', 's'].map(k => `<div class="lv-block"><div class="lv-head ${k}">${LV[k]}</div>${levelHTML(q, k)}</div>`).join('');
    const h = q.lv[l];
    let out = h || '<p class="empty-lv">Для этого уровня дополнений нет.</p>';
    if (l === 's' && q.filled) out += '<div class="filled-note">Senior-ответ дописан в справочнике (в методичке был пропуск).</div>';
    return out;
  }
  function badges(q) {
    let b = '';
    if (q.star) b += '<span class="badge star" title="Ключевой вопрос темы">★ Ключевой</span>';
    if (q.lc) b += `<span class="badge lc">LeetCode ${q.lc.num}</span><span class="badge ${q.lc.diff.toLowerCase()}">${q.lc.diff}</span>`;
    if (q.added) b += '<span class="badge add">дополнено</span>';
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
        <div class="lv-tabs">${solving ? '<span class="solve-badge">✍ Режим «Решить самому»</span>' : tabsHTML(q, l)}</div>
        <div class="tools-r">${canSolve(q) ? `<button class="tbtn solve-t${solving ? ' on' : ''}" data-act="solve" title="Скрыть ответ и решить задачу самостоятельно">${solving ? '📖 К ответу' : '✍ Решить самому'}</button>` : ''}${QZ_BY_REF[q.id] ? `<a class="tbtn" href="#/quiz/q/${q.id}" title="Вопросы самотеста по этой теме">🧪 ${QZ_BY_REF[q.id].length}</a>` : ''}
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
      imgs.map((im, i) => `<div class="thumb" data-g="${key}" data-i="${i}"><img loading="lazy" src="${im.src}" alt=""></div>`).join('') + '</div></div>';
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
  function showLB() { const im = LB.imgs[LB.i]; $('#lbImg').src = im.src; $('#lbStage').classList.remove('zoom'); $('#lbInfo').textContent = `${LB.i + 1} / ${LB.imgs.length}  ·  клик — увеличить, ← → — листать, Esc — закрыть`; $('#lbPrev').style.display = $('#lbNext').style.display = LB.imgs.length > 1 ? '' : 'none'; }
  function closeLB() { $('#lb').classList.remove('open'); }
  $('#lbImg').addEventListener('click', e => { e.stopPropagation(); $('#lbStage').classList.toggle('zoom'); });
  $('#lbStage').addEventListener('click', e => { if (e.target.id === 'lbStage') closeLB(); });
  $('#lbClose').onclick = closeLB;
  $('#lbPrev').onclick = () => { LB.i = (LB.i - 1 + LB.imgs.length) % LB.imgs.length; showLB(); };
  $('#lbNext').onclick = () => { LB.i = (LB.i + 1) % LB.imgs.length; showLB(); };

  // ---------- страницы ----------
  const main = () => $('#content');
  let outlineObs = null;

  function pageHome() {
    const all = stats(ORDER);
    const last = S.last && Q[S.last] ? Q[S.last] : null;
    const repeat = ORDER.filter(q => st(q.id) === 'r').slice(0, 6);
    main().innerHTML = `<div class="page wide">
      <div class="hero"><h1>Java-справочник</h1>
        <p>Учебник и справочник Java-разработчика: от основ языка до архитектуры и инфраструктуры. Каждый ответ — на трёх уровнях (Junior, Middle, Senior) и развёрнутой статьёй «Подробно».</p>
        <div class="hero-stats"><div class="hero-stat"><b>${ORDER.length}</b><span>вопросов</span></div>
          <div class="hero-stat"><b>${D.topics.length}</b><span>тем</span></div>
          <div class="hero-stat"><b>${all.k}</b><span>изучено</span></div>
          <div class="hero-stat"><b>${all.r}</b><span>на повторение</span></div></div>
        <div class="hero-actions">${last ? `<a class="hbtn primary" href="#/q/${last.id}">Продолжить: ${esc(last.q.slice(0, 48))}${last.q.length > 48 ? '…' : ''}</a>` : `<a class="hbtn primary" href="#/t/core1">Начать с Java Core →</a>`}
          <a class="hbtn" href="#/road">🧭 Дорожная карта</a><a class="hbtn" href="#/exam">🎫 Экзамен</a><a class="hbtn" href="#/train">🎯 Тренировка</a><a class="hbtn" href="#/quiz">🧪 Самотест</a><button class="hbtn" id="rndBtn2">🎲 Случайный вопрос</button></div></div>
      <div class="home-row">
        <div class="panel"><h3>Общий прогресс</h3>${barHTML(all)}<p class="muted" style="margin:10px 0 0">Изучено ${all.k} из ${all.n} · на повторении ${all.r}. Отмечайте вопросы кнопками «✓ Знаю» и «↻ Повторить», прогресс сохраняется в браузере.</p>
          <div class="kbd-help"><span><kbd>/</kbd> поиск</span><span><kbd>R</kbd> случайный вопрос</span><span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> уровень</span></div></div>
        <div class="panel"><h3>На повторение</h3>${repeat.length ? repeat.map(q => `<a class="list-link" href="#/q/${q.id}"><span class="tt">${esc(q.q)}</span><span class="m">${esc(q.topic.title)}</span></a>`).join('') + (ORDER.filter(q => st(q.id) === 'r').length > 6 ? '<a class="list-link" href="#/repeat"><span class="tt">Все вопросы на повторение →</span></a>' : '') : '<p class="muted">Пока пусто. Нажмите «↻ Повторить» у вопроса, который нужно освежить.</p>'}</div>
      </div>
      ${D.groups.map(g => `<h2 class="group-h">${esc(g)}</h2><div class="tiles">${D.topics.filter(t => t.group === g).map(t => { const s = stats(topicQs(t)); return `<a class="tile" href="#/t/${t.slug}"><span class="t">${esc(t.title)}</span><span class="d">${t.count ? plural(t.count, 'вопрос', 'вопроса', 'вопросов') + ' · изучено ' + s.k : plural(t.gallery.length, 'иллюстрация', 'иллюстрации', 'иллюстраций')}</span>${t.count ? barHTML(s) : ''}</a>`; }).join('')}</div>`).join('')}
      <div class="home-foot">${esc((D.meta || {}).title || 'Java-справочник')} · ${esc((D.meta || {}).author || '')} · v${esc((D.meta || {}).version || '')}</div>
    </div>`;
    $('#rndBtn2').onclick = randomQ;
  }

  let topicFilter = 'all';
  function pageTopic(slug, focusId) {
    const t = TOPIC[slug]; if (!t) return pageHome();
    const qs = topicQs(t);
    const s = stats(qs);
    if (!t.count) {
      main().innerHTML = `<div class="page wide"><div class="crumbs"><a href="#/">Главная</a> · ${esc(t.group)}</div><h1 class="title">${esc(t.title)}</h1><p class="subtitle">Шпаргалки из методички — кликните по изображению, чтобы открыть в полном размере.</p>${galleryHTML(t.gallery, 'Шпаргалки', true)}</div>`;
      return;
    }
    const cnt = { all: qs.length, new: qs.filter(q => !st(q.id)).length, r: qs.filter(q => st(q.id) === 'r').length, k: qs.filter(q => st(q.id) === 'k').length, star: qs.filter(q => q.star).length };
    const pass = q => topicFilter === 'all' || (topicFilter === 'new' && !st(q.id)) || (topicFilter === 'star' && q.star) || st(q.id) === topicFilter;
    main().innerHTML = `<div class="topic-layout"><div>
      <div class="topic-head"><div class="crumbs"><a href="#/">Главная</a> · ${esc(t.group)}</div><h1 class="title">${esc(t.title)}</h1>
        <div class="progress">${barHTML(s)}<span class="lbl" id="tpLbl">изучено ${s.k} из ${s.n} · повторить ${s.r}</span></div>
        <div class="chips">${[['all', 'Все'], ['new', 'Не изучено'], ['r', '↻ Повторить'], ['k', '✓ Знаю'], ['star', '★ Ключевые']].filter(([k]) => k !== 'star' || cnt.star).map(([k, l]) => `<button class="chip${topicFilter === k ? ' on' : ''}" data-f="${k}">${l}<span class="n">${cnt[k]}</span></button>`).join('')}
          <span class="sp"></span><button class="chip" id="expAll">Развернуть все</button><button class="chip" id="colAll">Свернуть</button><a class="chip" href="#/train/${t.slug}">🎯 Тренировка</a>${QZ_BY_T[t.slug] ? `<a class="chip" href="#/quiz/${t.slug}">🧪 Тест по теме · ${QZ_BY_T[t.slug].length}</a>` : ''}</div></div>
      ${t.sections.map(sec => { const items = sec.items.filter(pass); if (!items.length) return ''; return (sec.title ? `<div class="sec-title">${esc(sec.title)}</div>` : '') + items.map(q => cardHTML(q)).join(''); }).join('') || '<div class="empty"><div class="big">🎉</div>В этом фильтре вопросов нет</div>'}
      ${t.gallery && t.gallery.length ? `<div class="sec-title">Архив: слайды из методички</div><div class="panel legacy"><p class="muted" style="margin-top:0">Это слайды по <b>JUnit 4</b> (@Before, @BeforeClass, @Ignore, @Test(expected/timeout), правило «should» в имени). Для справки они сохранены, но в новых проектах используйте JUnit 5/6 — актуальные схемы и таблица соответствия аннотаций приведены в вопросах выше.</p>${galleryHTML(t.gallery, 'JUnit 4 — устаревшие слайды')}</div>` : ''}
    </div><aside class="outline"><div class="outline-h">Содержание темы</div>${t.sections.map(sec => (sec.title ? `<div class="o-sec">${esc(sec.title)}</div>` : '') + sec.items.filter(pass).map(q => `<a href="#/q/${q.id}" data-id="${q.id}" class="${st(q.id)}">${esc(q.q)}</a>`).join('')).join('')}</aside></div>`;
    $$('.chip[data-f]').forEach(c => c.onclick = () => { topicFilter = c.dataset.f; pageTopic(slug); });
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
  function updateTopicProgress() {
    const m = location.hash.match(/^#\/t\/(.+)$/) || (location.hash.startsWith('#/q/') ? [0, (Q[location.hash.slice(4)] || { topic: {} }).topic.slug] : null);
    if (!m || !TOPIC[m[1]]) return;
    const s = stats(topicQs(TOPIC[m[1]])); const head = $('.topic-head .progress'); if (!head) return;
    head.innerHTML = `${barHTML(s)}<span class="lbl">изучено ${s.k} из ${s.n} · повторить ${s.r}</span>`;
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
  function pageTrain(src) {
    const opts = [['all', 'Все вопросы'], ['top', '⭐ Ключевые вопросы'], ['new', 'Только не изученные'], ['repeat', '↻ Отмеченные «Повторить»']]
      .concat((D.road || []).map(r => ['road:' + r.key, '🧭 Дорожная карта: ' + r.lv]))
      .concat(D.topics.filter(t => t.count).map(t => ['t:' + t.slug, 'Тема: ' + t.title]));
    const sel = src ? (TOPIC[src] ? 't:' + src : src) : 'all';
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🎯 Тренировка</h1>
      <p class="subtitle">Режим карточек: сначала вопрос — попробуйте ответить вслух, затем откройте ответ и оцените себя.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Набор вопросов</label><select id="trSrc">${opts.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>Порядок</label><select id="trOrd"><option value="rnd">Случайный</option><option value="seq">По порядку</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:10px;align-items:center"><button class="btn" id="trGo">Начать</button><span class="muted" id="trCnt"></span></div></div>
      <div id="trArea"></div></div>`;
    const upd = () => { $('#trCnt').textContent = plural(trainSet($('#trSrc').value).length, 'вопрос', 'вопроса', 'вопросов'); };
    $('#trSrc').onchange = upd; upd();
    $('#trGo').onclick = () => startTrain($('#trSrc').value, $('#trOrd').value);
    if (src) startTrain(sel, 'rnd');
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
    const list = trainSet(src);
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
    if (arg && arg.startsWith('q/')) sel = 'q:' + arg.slice(2); else if (arg === 'wrong') sel = 'wrong'; else if (arg && QZ_BY_T[arg]) sel = 't:' + arg;
    const opts = [['all', 'Все вопросы'], ['new', 'Ещё не решённые'], ['wrong', `Мои ошибки (${wrong})`]]
      .concat(sel.startsWith('q:') ? [[sel, 'По вопросу: ' + (Q[sel.slice(2)] || { q: '' }).q.slice(0, 60)]] : [])
      .concat(D.topics.filter(t => QZ_BY_T[t.slug]).map(t => ['t:' + t.slug, `Тема: ${t.title} (${QZ_BY_T[t.slug].length})`]));
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">🧪 Самотест</h1>
      <p class="subtitle">Вопросы с вариантами ответов. Где правильных ответов несколько, это будет указано: отметьте все подходящие. После проверки увидите разбор и ссылку на подробный ответ.</p>
      <div class="panel"><div class="train-setup">
        <div class="field"><label>Набор вопросов</label><select id="qzSrc">${opts.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>
        <div class="field"><label>Количество</label><select id="qzCnt"><option value="10">10 вопросов</option><option value="20" selected>20 вопросов</option><option value="40">40 вопросов</option><option value="0">Все</option></select></div>
      </div><div style="margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" id="qzGo">Начать тест</button><span class="muted" id="qzInfo"></span>
      <span class="muted" style="margin-left:auto">Решено: ${done} из ${ZALL.length} · верно ${done ? Math.round(ok / done * 100) : 0}%</span></div></div>
      <div id="qzArea"></div></div>`;
    const upd = () => { $('#qzInfo').textContent = 'доступно: ' + quizSet($('#qzSrc').value).length; };
    $('#qzSrc').onchange = upd; upd();
    $('#qzGo').onclick = () => startQuiz($('#qzSrc').value, +$('#qzCnt').value);
    if (arg) startQuiz(sel, sel.startsWith('q:') ? 0 : 20);
    $('.main').scrollTop = 0;
  }
  function startQuiz(src, cnt) {
    let list = shuffle(quizSet(src));
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
      <div class="ed-bar"><span class="ed-info">Java · Tab — отступ · Shift+Tab — убрать отступ · Ctrl+/ — комментарий · код не компилируется</span><span class="ed-saved"></span></div>`;
    const ta = $('.ed-ta', host), code = $('.ed-hl code', host), pre = $('.ed-hl', host), gut = $('.ed-gut', host);
    ta.value = value || '';
    let timer;
    const sync = () => { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.scrollTop = ta.scrollTop; };
    const paint = () => {
      const v = ta.value;
      let h; try { h = window.hljs ? hljs.highlight(v, { language: 'java', ignoreIllegals: true }).value : esc(v); } catch (e) { h = esc(v); }
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
    const cond = sectionOf(q.more, 'Условие') || `<p>${esc(q.q)}</p>`;
    const L = q.logic || {};
    const hints = [];
    if (L.idea) hints.push(['💡 Подсказка 1: идея', `<p>${esc(L.idea)}</p>`]);
    if (L.steps) hints.push(['🧭 Подсказка 2: шаги решения', `<ol class="num">${L.steps.map((s, i) => `<li data-n="${i + 1}.">${esc(s)}</li>`).join('')}</ol>${L.cx ? `<p class="muted">⏱ ${esc(L.cx)}</p>` : ''}`]);
    const ap = sectionOf(q.more, 'Подходы'), edge = sectionOf(q.more, 'Крайние случаи и тесты');
    if (ap || edge) hints.push(['🧪 Подсказка 3: подходы, крайние случаи и тесты', ap + (edge ? '<h4>Крайние случаи и тесты</h4>' + edge : '')]);
    const sol = sectionOf(q.more, 'Итоговое решение') || q.lv.j || q.lv.m || '';
    hints.push(['✅ Показать решение', sol + `<p><button class="tbtn" data-full="1">📖 Полный разбор задачи</button></p>`]);
    return `<div class="solve"><div class="solve-cond"><div class="solve-h">Условие</div>${cond}</div>
      <div class="solve-ed"></div>
      <div class="solve-tools"><button class="tbtn" data-sv="tpl">Заготовка класса</button><button class="tbtn" data-sv="copy">Копировать</button><button class="tbtn" data-sv="clear">Очистить</button><a class="tbtn" href="#/pad/q:${q.id}">Открыть в блокноте</a></div>
      <div class="solve-hints"><div class="solve-h">Подсказки — открывайте по одной, если застряли</div>${hints.map(([t, h], i) => `<div class="hint-row" data-h="${i}"><button class="hint-btn${i === hints.length - 1 ? ' sol' : ''}">${t}</button><div class="hint-body answer">${h}</div></div>`).join('')}</div></div>`;
  }
  const TPL = 'import java.util.*;\n\npublic class Solution {\n\n    public static void main(String[] args) {\n        \n    }\n}\n';
  function mountSolve(root, q, card) {
    const ed = makeEditor($('.solve-ed', root), S.code[q.id] || '', v => { if (v.trim()) S.code[q.id] = v; else delete S.code[q.id]; save(); }, { placeholder: 'Напишите решение здесь. Если застряли — откройте подсказку ниже.' });
    $$('.hint-btn', root).forEach(b => b.onclick = () => { const r = b.parentElement; r.classList.toggle('open'); if (r.classList.contains('open')) enhanceCode(r, q); });
    $$('[data-full]', root).forEach(b => b.onclick = () => { card.dataset.solve = ''; fillCard(card, 'd'); });
    $$('[data-sv]', root).forEach(b => b.onclick = () => {
      const a = b.dataset.sv;
      if (a === 'tpl') { if (!ed.get().trim() || confirm('Заменить текущий код заготовкой?')) ed.set(TPL); }
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
    GL.forEach((g, i) => { groups[g.cs ? 'gu' : 'giu'].push(i); g.slug = Q[g.q] ? Q[g.q].topic.slug : ''; });
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
  let glFilter = '';
  function pageGloss() {
    const letters = [...new Set(GL.map(g => g.t[0].toUpperCase()))];
    main().innerHTML = `<div class="page"><div class="crumbs"><a href="#/">Главная</a></div><h1 class="title">📘 Глоссарий</h1>
      <p class="subtitle">${plural(GL.length, 'термин', 'термина', 'терминов')} с короткими определениями. В ответах справочника такие термины подчёркнуты пунктиром: наведите — увидите определение, кликните — перейдёте к вопросу, где тема разобрана подробно.</p>
      <input class="gl-search" id="glQ" placeholder="Фильтр терминов…" value="${esc(glFilter)}" autocomplete="off">
      <div class="gl-letters">${letters.map(l => `<button data-l="${esc(l)}">${esc(l)}</button>`).join('')}</div>
      <div id="glList"></div></div>`;
    const draw = () => {
      const f = norm(glFilter.trim());
      const items = GL.filter(g => !f || norm(g.t).includes(f) || norm(g.d).includes(f));
      let last = '';
      $('#glList').innerHTML = items.map(g => { const L = g.t[0].toUpperCase(); const h = L !== last ? `<div class="gl-letter" id="gl-${esc(L)}">${esc(L)}</div>` : ''; last = L; return h + `<div class="gl-row"><div class="gl-t">${esc(g.t)}</div><div class="gl-d">${esc(g.d)}<a href="#/q/${g.q}">${esc(Q[g.q].q)} →</a></div></div>`; }).join('') || '<div class="empty">Ничего не найдено</div>';
    };
    draw();
    $('#glQ').oninput = e => { glFilter = e.target.value; draw(); };
    $$('.gl-letters button').forEach(a => a.onclick = () => { const el = document.getElementById('gl-' + a.dataset.l); if (el) el.scrollIntoView({ block: 'start' }); });
    $('.main').scrollTop = 0;
  }
  // ======================================================================

  // ---------- роутер ----------
  function route() {
    const h = decodeURIComponent(location.hash || '#/');
    tip.classList.remove('show'); sDrop().classList.remove('open'); sInput().blur(); QZ = null;
    let m;
    if ((m = h.match(/^#\/t\/(.+)$/))) { if (TOPIC[m[1]] !== curTopicPage) topicFilter = 'all'; curTopicPage = TOPIC[m[1]]; pageTopic(m[1]); }
    else if ((m = h.match(/^#\/q\/(.+)$/)) && Q[m[1]]) { const q = Q[m[1]]; if (curTopicPage !== q.topic) topicFilter = 'all'; curTopicPage = q.topic; pageTopic(q.topic.slug, q.id); }
    else if (h === '#/top') { curTopicPage = null; pageTop(); }
    else if (h === '#/notes') { curTopicPage = null; pageNotes(); }
    else if ((m = h.match(/^#\/road(?:\/(.+))?$/))) { curTopicPage = null; pageRoad(m[1]); }
    else if (h === '#/exam') { curTopicPage = null; pageExam(); }
    else if (h === '#/stats') { curTopicPage = null; pageStats(); }
    else if (h === '#/gloss') { curTopicPage = null; pageGloss(); }
    else if ((m = h.match(/^#\/pad(?:\/(.+))?$/))) { curTopicPage = null; pagePad(m[1]); }
    else if (h === '#/repeat') { curTopicPage = null; pageRepeat(); }
    else if ((m = h.match(/^#\/train(?:\/(.+))?$/))) { curTopicPage = null; pageTrain(m[1]); }
    else if ((m = h.match(/^#\/quiz(?:\/(.+))?$/))) { curTopicPage = null; pageQuiz(m[1]); }
    else if ((m = h.match(/^#\/search\/(.+)$/))) { curTopicPage = null; pageSearch(m[1]); }
    else { curTopicPage = null; pageHome(); }
    renderNav();
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
  $('#themeBtn').onclick = () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
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

  // ---------- старт ----------
  applyTheme(); renderLevelSeg(); renderProfile();
  window.addEventListener('hashchange', route);
  route();
})();
