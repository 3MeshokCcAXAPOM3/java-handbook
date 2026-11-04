/* Тренажёр SQL: настоящая SQLite в браузере (sql.js, без сервера), учебная база магазина, задачи с автопроверкой. */
(function () {
  'use strict';
  const DATA = window.SQLLAB_DATA;
  let SQL = null, loading = null;
  const engine = () => SQL ? Promise.resolve(SQL) : (loading = loading || window.initSqlJs().then(s => (SQL = s)));
  const freshDb = () => { const db = new SQL.Database(); db.exec(DATA.schema + '\n' + DATA.data); return db; };

  const normVal = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
  const normRows = (res, ordered) => { const rows = res.values.map(r => JSON.stringify(r.map(normVal))); return ordered ? rows : rows.slice().sort(); };
  function runSql(db, sql) { const res = db.exec(sql); return res.length ? res[res.length - 1] : { columns: [], values: [] }; }
  function resultFor(task, sql) {
    const db = freshDb();
    try { if (task.check) { db.exec(sql); return runSql(db, task.check); } return runSql(db, sql); }
    finally { db.close(); }
  }
  function compare(task, mine, exp) {
    if (mine.columns.length !== exp.columns.length) return `Число столбцов: ${mine.columns.length}, ожидается ${exp.columns.length}.`;
    if (mine.values.length !== exp.values.length) return `Число строк: ${mine.values.length}, ожидается ${exp.values.length}.`;
    const a = normRows(mine, task.ordered), b = normRows(exp, task.ordered);
    if (a.join('\n') === b.join('\n')) return null;
    if (task.ordered && normRows(mine, false).join('\n') === normRows(exp, false).join('\n')) return 'Строки верные, но порядок другой — проверьте ORDER BY.';
    return 'Значения в строках отличаются от ожидаемых.';
  }
  const tableHTML = (res, esc, limit = 200) => !res.columns.length ? '<p class="muted">Запрос выполнен, строк для показа нет.</p>' :
    `<div class="tbl sql-res"><table><thead><tr>${res.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${res.values.slice(0, limit).map(r => `<tr>${r.map(v => `<td${v === null ? ' class="null"' : ''}>${v === null ? 'NULL' : esc(String(v))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
     <div class="muted sql-cnt">${res.values.length} строк${res.values.length > limit ? `, показаны первые ${limit}` : ''}</div>`;

  function page(api, m) {
    const S = api.S(); S.sqllab = S.sqllab || {}; S.sqlcode = S.sqlcode || {};
    const id = m[1] || (DATA.tasks.find(t => !S.sqllab[t.id]) || DATA.tasks[0]).id;
    const sandbox = id === 'sandbox';
    const task = sandbox ? { id: 'sandbox', t: 'Песочница', d: 'Любые запросы к учебной базе. Изменения не сохраняются: каждый запуск идёт по свежей копии базы.', g: 'Свободно' } : DATA.tasks.find(t => t.id === id) || DATA.tasks[0];
    const groups = [...new Set(DATA.tasks.map(t => t.g))];
    const done = DATA.tasks.filter(t => S.sqllab[t.id]).length;
    const esc = api.esc, $ = api.$;
    api.main().innerHTML = `<div class="page wide sql-page"><div class="crumbs"><a href="#/">Главная</a> · Тренажёры</div>
      <h1 class="title">🗄 SQL-тренажёр</h1>
      <p class="subtitle">Настоящая база SQLite прямо в браузере — без сервера и интернета. Учебная база интернет-магазина: клиенты, товары, категории, заказы, сотрудники. Пишите запрос, запускайте и проверяйте. Решено ${done} из ${DATA.tasks.length}.</p>
      <div class="git-levels">${groups.map(g => `<div class="gl-grp"><b>${esc(g)}</b>${DATA.tasks.filter(t => t.g === g).map(t => `<a href="#/sql/${t.id}" class="gl-lv${t.id === task.id ? ' on' : ''}${S.sqllab[t.id] ? ' ok' : ''}">${S.sqllab[t.id] ? '✓ ' : ''}${esc(t.t)}</a>`).join('')}</div>`).join('')}
        <div class="gl-grp"><b>Свободно</b><a href="#/sql/sandbox" class="gl-lv${sandbox ? ' on' : ''}">🧪 Песочница</a></div></div>
      <div class="sql-layout"><div class="sql-main">
        <div class="panel git-task"><h3>${esc(task.t)}</h3><p>${esc(task.d)}</p>${task.check ? '<p class="muted">Задача на изменение данных: проверяется состояние таблиц после ваших команд.</p>' : ''}${task.ordered && !task.check ? '<p class="muted">Порядок строк важен.</p>' : ''}
          <div class="git-tools">${task.hint ? '<button class="tbtn" id="sqlHint">💡 Подсказка</button>' : ''}${task.sol ? '<button class="tbtn" id="sqlSol">✅ Решение</button>' : ''}${task.sol ? '<button class="tbtn" id="sqlExp">👁 Ожидаемый результат</button>' : ''}<a class="tbtn" href="#/t/db">📖 Тема «SQL и базы данных»</a></div>
          <div class="git-reveal" id="sqlReveal"></div></div>
        <div id="sqlEd"></div>
        <div class="sql-actions"><button class="btn" id="sqlRun">▶ Выполнить <kbd>Ctrl+Enter</kbd></button>${sandbox ? '' : '<button class="btn ok" id="sqlCheck">✓ Проверить</button>'}<span id="sqlMsg" class="sql-msg"></span></div>
        <div id="sqlOut"></div></div>
        <aside class="sql-schema panel"><h3>Схема базы</h3>${Object.entries(DATA.tables).map(([tb, cols]) => `<div class="sch-t"><button class="sch-name" data-tb="${tb}">${tb}</button><div class="sch-cols">${cols.map(c => `<code>${esc(c)}</code>`).join(' ')}</div></div>`).join('')}<p class="muted" style="font-size:12.5px">Клик по таблице — показать данные.</p></aside></div></div>`;
    const ed = api.makeEditor($('#sqlEd'), S.sqlcode[task.id] || (sandbox ? 'SELECT * FROM products LIMIT 10;' : ''), v => { S.sqlcode[task.id] = v; api.save(); },
      { lang: 'sql', placeholder: 'SELECT …', info: 'SQL (SQLite) · Ctrl+Enter — выполнить' });
    const msg = (t, cls) => { const el = $('#sqlMsg'); el.className = 'sql-msg ' + (cls || ''); el.textContent = t; };
    const out = h => { $('#sqlOut').innerHTML = h; };
    const go = fn => { msg('Загрузка движка SQLite…'); engine().then(() => { msg(''); fn(); }).catch(e => msg('Не удалось запустить SQLite: ' + e.message, 'err')); };
    const execute = () => go(() => {
      const sql = ed.get().trim(); if (!sql) return msg('Введите запрос', 'err');
      const db = freshDb();
      try { const t0 = performance.now(); const res = runSql(db, sql); out(tableHTML(res, esc)); msg(`Выполнено за ${Math.round(performance.now() - t0)} мс`); }
      catch (e) { out(''); msg('Ошибка: ' + e.message, 'err'); }
      finally { db.close(); }
    });
    const check = () => go(() => {
      const sql = ed.get().trim(); if (!sql) return msg('Введите запрос', 'err');
      let mine, exp;
      try { mine = resultFor(task, sql); } catch (e) { out(''); return msg('Ошибка: ' + e.message, 'err'); }
      exp = resultFor(task, task.sol);
      const diff = compare(task, mine, exp);
      out((task.check ? '<p class="muted">Состояние после ваших команд:</p>' : '') + tableHTML(mine, esc));
      if (!diff) {
        const first = !S.sqllab[task.id]; S.sqllab[task.id] = true; api.save(); msg('✓ Верно!', 'ok');
        const next = DATA.tasks[DATA.tasks.indexOf(task) + 1];
        if (next) $('#sqlOut').insertAdjacentHTML('afterbegin', `<a class="btn" href="#/sql/${next.id}">Следующая задача: ${esc(next.t)} →</a>`);
        if (first) api.renderNav();
      } else msg('✗ ' + diff, 'err');
    });
    $('#sqlRun').onclick = execute;
    if ($('#sqlCheck')) $('#sqlCheck').onclick = check;
    $('#sqlEd').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); sandbox ? execute() : check(); } }, true);
    if ($('#sqlHint')) $('#sqlHint').onclick = () => { $('#sqlReveal').innerHTML = `<p><b>Подсказка:</b> ${esc(task.hint)}</p>`; };
    if ($('#sqlSol')) $('#sqlSol').onclick = () => { $('#sqlReveal').innerHTML = `<p><b>Решение:</b></p><pre class="sql-sol"><code>${esc(task.sol)}</code></pre>`; };
    if ($('#sqlExp')) $('#sqlExp').onclick = () => go(() => { $('#sqlReveal').innerHTML = '<p><b>Ожидаемый результат:</b></p>' + tableHTML(resultFor(task, task.sol), esc, 50); });
    api.$$('.sch-name').forEach(b => b.onclick = () => go(() => { const db = freshDb(); try { out(`<p><b>${b.dataset.tb}</b></p>` + tableHTML(runSql(db, `SELECT * FROM ${b.dataset.tb}`), esc)); } finally { db.close(); } }));
    engine();
    api.$('.main').scrollTop = 0;
  }

  (window.APP_EXT = window.APP_EXT || []).push({
    id: 'sqllab', href: '#/sql', ico: '🗄', t: 'SQL', long: 'SQL-тренажёр', desc: `${DATA.tasks.length} задач: от SELECT до оконных функций, автопроверка`,
    prog: S => ({ k: DATA.tasks.filter(t => (S.sqllab || {})[t.id]).length, n: DATA.tasks.length }),
    re: /^#\/sql(?:\/([\w-]+))?$/, page,
  });
})();
