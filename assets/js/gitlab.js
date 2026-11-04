/* Тренажёр Git: модель репозитория, команды, визуализация графа коммитов, уровни с целями. */
(function () {
  'use strict';

  // ---------- модель ----------
  class Repo {
    constructor() {
      this.commits = { C0: { id: 'C0', parents: [], msg: 'Начальный коммит' }, C1: { id: 'C1', parents: ['C0'], msg: 'Первый коммит' } };
      this.branches = { main: 'C1' }; this.tags = {}; this.head = { branch: 'main' }; this.next = 2;
    }
    clone() { const r = new Repo(); r.commits = JSON.parse(JSON.stringify(this.commits)); r.branches = { ...this.branches }; r.tags = { ...this.tags }; r.head = { ...this.head }; r.next = this.next; return r; }
    headId() { return this.head.branch ? this.branches[this.head.branch] : this.head.detached; }
    newId() { return 'C' + (this.next++); }
    copyId(id) { let n = id.replace(/'+$/, '') + "'"; while (this.commits[n]) n += "'"; return n; }
    ancestors(id) { const seen = new Set(), st = [id]; while (st.length) { const c = st.pop(); if (!c || seen.has(c)) continue; seen.add(c); st.push(...this.commits[c].parents); } return seen; }
    isAncestor(a, b) { return this.ancestors(b).has(a); }
    moveHead(id) { if (this.head.branch) this.branches[this.head.branch] = id; else this.head.detached = id; }
    resolve(ref) {
      if (!ref) throw new Error('Не указана ссылка');
      const m = ref.match(/^([^~^]+)((?:[~^]\d*)*)$/); if (!m) throw new Error(`Не понимаю ссылку «${ref}»`);
      let name = m[1], id;
      if (name === 'HEAD' || name === '@') id = this.headId();
      else if (this.branches[name] !== undefined) id = this.branches[name];
      else if (this.tags[name] !== undefined) id = this.tags[name];
      else { const c = name.replace(/^c/, 'C'); if (this.commits[c]) id = c; }
      if (!id) throw new Error(`Нет ветки, тега или коммита «${name}»`);
      for (const op of m[2].match(/[~^]\d*/g) || []) {
        const n = op.length > 1 ? +op.slice(1) : 1;
        if (op[0] === '~') { for (let i = 0; i < n; i++) { id = this.commits[id].parents[0]; if (!id) throw new Error(`У коммита нет предка для «${ref}»`); } }
        else { id = this.commits[id].parents[n - 1]; if (!id) throw new Error(`У коммита нет родителя ^${n}`); }
      }
      return id;
    }
  }

  // ---------- команды ----------
  function tokenize(line) { return (line.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(t => t.replace(/^["']|["']$/g, '')); }
  function run(repo, line) {
    const tk = tokenize(line); if (!tk.length) return '';
    if (tk[0] !== 'git') throw new Error('Команда должна начинаться с git (или используйте undo, reset, clear, help)');
    const cmd = tk[1], args = tk.slice(2), flags = args.filter(a => a.startsWith('-')), pos = args.filter((a, i) => !a.startsWith('-') && !(args[i - 1] === '-m'));
    const has = (...f) => f.some(x => flags.includes(x));
    switch (cmd) {
      case 'commit': {
        if (has('--amend')) {
          const old = repo.headId(), c = repo.commits[old], id = repo.copyId(old);
          repo.commits[id] = { id, parents: [...c.parents], msg: c.msg + ' (исправлен)' }; repo.moveHead(id); return `[${id}] коммит исправлен`;
        }
        const id = repo.newId(), mi = args.indexOf('-m');
        repo.commits[id] = { id, parents: [repo.headId()], msg: mi >= 0 ? args[mi + 1] || '' : 'Коммит ' + id }; repo.moveHead(id);
        return `[${repo.head.branch || 'HEAD отделён'} ${id}]`;
      }
      case 'branch': {
        if (!pos.length && !flags.length) return Object.keys(repo.branches).map(b => (b === repo.head.branch ? '* ' : '  ') + b).join('\n');
        if (has('-d', '-D', '--delete')) { const b = pos[0]; if (!(b in repo.branches)) throw new Error(`Нет ветки ${b}`); if (b === repo.head.branch) throw new Error('Нельзя удалить текущую ветку'); delete repo.branches[b]; return `Ветка ${b} удалена`; }
        const name = pos[0]; if (!/^[\w./-]+$/.test(name)) throw new Error('Недопустимое имя ветки');
        if (repo.branches[name] !== undefined && !has('-f', '--force')) throw new Error(`Ветка ${name} уже существует (переместить: git branch -f ${name} <куда>)`);
        if (name === repo.head.branch && has('-f')) throw new Error('Нельзя переместить текущую ветку через branch -f — используйте reset');
        repo.branches[name] = repo.resolve(pos[1] || 'HEAD'); return `Ветка ${name} → ${repo.branches[name]}`;
      }
      case 'checkout': case 'switch': {
        if (has('-b', '-c', '-B', '-C')) { const name = pos[0]; if (repo.branches[name] !== undefined && !has('-B', '-C')) throw new Error(`Ветка ${name} уже существует`); repo.branches[name] = repo.resolve(pos[1] || 'HEAD'); repo.head = { branch: name }; return `Переключено на новую ветку ${name}`; }
        const t = pos[0]; if (!t) throw new Error('Укажите ветку или коммит');
        if (repo.branches[t] !== undefined && !has('--detach')) { repo.head = { branch: t }; return `Переключено на ветку ${t}`; }
        if (cmd === 'switch' && !has('--detach', '-d')) throw new Error(`Нет ветки ${t}. Для перехода на коммит: git switch --detach ${t} или git checkout ${t}`);
        repo.head = { detached: repo.resolve(t) }; return `HEAD отделён на ${repo.head.detached}`;
      }
      case 'merge': {
        const target = repo.resolve(pos[0]), cur = repo.headId();
        if (repo.isAncestor(target, cur)) return 'Уже актуально (Already up to date)';
        if (repo.isAncestor(cur, target) && !has('--no-ff')) { repo.moveHead(target); return `Fast-forward до ${target}`; }
        const id = repo.newId(); repo.commits[id] = { id, parents: [cur, target], msg: 'Merge ' + pos[0] }; repo.moveHead(id); return `Создан коммит слияния ${id}`;
      }
      case 'rebase': {
        if (has('-i', '--interactive')) throw new Error('Интерактивный rebase в тренажёре не поддерживается: используйте cherry-pick или reset --soft');
        const upstream = repo.resolve(pos[0]);
        if (pos[1]) { if (repo.branches[pos[1]] === undefined) throw new Error(`Нет ветки ${pos[1]}`); repo.head = { branch: pos[1] }; }
        const cur = repo.headId();
        if (repo.isAncestor(cur, upstream)) { repo.moveHead(upstream); return `Fast-forward до ${upstream}`; }
        const base = repo.ancestors(upstream);
        const todo = [...repo.ancestors(cur)].filter(c => !base.has(c) && repo.commits[c].parents.length < 2).sort(byOrder);
        if (!todo.length) return 'Нечего переносить';
        let prev = upstream; const made = [];
        for (const c of todo) { const id = repo.copyId(c); repo.commits[id] = { id, parents: [prev], msg: repo.commits[c].msg }; prev = id; made.push(id); }
        repo.moveHead(prev); return `Перенесены коммиты: ${made.join(', ')}`;
      }
      case 'cherry-pick': {
        if (!pos.length) throw new Error('Укажите коммиты');
        const made = [];
        for (const r of pos) { const c = repo.resolve(r), id = repo.copyId(c); repo.commits[id] = { id, parents: [repo.headId()], msg: repo.commits[c].msg }; repo.moveHead(id); made.push(id); }
        return `Применены: ${made.join(', ')}`;
      }
      case 'reset': { const t = repo.resolve(pos[0] || 'HEAD'); repo.moveHead(t); const mode = has('--hard') ? 'hard' : has('--soft') ? 'soft' : 'mixed'; return `HEAD теперь ${t} (reset --${mode}${mode === 'soft' ? ': изменения остались в индексе' : mode === 'mixed' ? ': изменения остались в рабочем каталоге' : ': изменения отброшены'})`; }
      case 'revert': { const t = repo.resolve(pos[0]); const id = repo.newId(); repo.commits[id] = { id, parents: [repo.headId()], msg: 'Revert ' + t, revert: t }; repo.moveHead(id); return `Создан коммит ${id}, отменяющий ${t}`; }
      case 'tag': {
        if (!pos.length) return Object.keys(repo.tags).join('\n') || '(тегов нет)';
        if (has('-d')) { delete repo.tags[pos[0]]; return `Тег ${pos[0]} удалён`; }
        if (repo.tags[pos[0]] !== undefined) throw new Error(`Тег ${pos[0]} уже существует`);
        repo.tags[pos[0]] = repo.resolve(pos[1] || 'HEAD'); return `Тег ${pos[0]} → ${repo.tags[pos[0]]}`;
      }
      case 'log': { const out = []; let c = repo.headId(); while (c) { out.push(`${c}  ${repo.commits[c].msg}`); c = repo.commits[c].parents[0]; } return out.join('\n'); }
      case 'status': return repo.head.branch ? `На ветке ${repo.head.branch} (${repo.headId()})` : `HEAD отделён на ${repo.head.detached}`;
      default: throw new Error(`Команда git ${cmd || ''} не поддерживается. Введите help`);
    }
  }
  const byOrder = (a, b) => num(a) - num(b) || a.length - b.length;
  const num = id => +id.replace(/\D/g, '');

  // ---------- сравнение с целью ----------
  const norm = id => id.replace(/'+$/, '') + (id.includes("'") ? "'" : '');
  function signature(repo, opts) {
    const chain = id => { const out = []; while (id) { const c = repo.commits[id]; out.push(norm(id) + (c.parents[1] ? '+' + norm(c.parents[1]) : '')); id = c.parents[0]; } return out.join('>'); };
    const sig = { b: {}, t: {} };
    for (const [b, id] of Object.entries(repo.branches)) sig.b[b] = chain(id);
    for (const [t, id] of Object.entries(repo.tags)) sig.t[t] = norm(id);
    if (opts.head) sig.h = repo.head.branch ? 'b:' + repo.head.branch : 'd:' + norm(repo.head.detached);
    const ord = o => Object.keys(o).sort().map(k => k + '=' + o[k]).join('|');
    return 'B:' + ord(sig.b) + ' T:' + ord(sig.t) + ' H:' + (sig.h || '');
  }

  // ---------- отрисовка графа ----------
  function layout(repo) {
    const ids = Object.keys(repo.commits).sort(byOrder);
    const gen = {}; const g = id => gen[id] ?? (gen[id] = repo.commits[id].parents.length ? 1 + Math.max(...repo.commits[id].parents.map(g)) : 0);
    ids.forEach(g);
    const lane = {}; let lanes = 0;
    const order = Object.keys(repo.branches).sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));
    const walk = id => { let any = false; while (id && lane[id] === undefined) { lane[id] = lanes; any = true; id = repo.commits[id].parents[0]; } if (any) lanes++; };
    order.forEach(b => walk(repo.branches[b]));
    Object.values(repo.tags).forEach(walk);
    if (!repo.head.branch) walk(repo.head.detached);
    ids.slice().reverse().forEach(walk);
    const live = new Set(); [...Object.values(repo.branches), ...Object.values(repo.tags), repo.headId()].forEach(id => repo.ancestors(id).forEach(x => live.add(x)));
    return { ids, gen, lane, lanes, live };
  }
  function svgGraph(repo, scale = 1) {
    const L = layout(repo), dx = 74 * scale, dy = 62 * scale, r = 17 * scale, ox = 34 * scale, oy = 46 * scale;
    const pos = id => [ox + L.gen[id] * dx, oy + L.lane[id] * dy];
    const maxG = Math.max(...L.ids.map(i => L.gen[i]));
    const W = ox * 2 + maxG * dx + 110 * scale, H = oy + L.lanes * dy + 10 * scale;
    let edges = '', nodes = '', labels = '';
    for (const id of L.ids) {
      const [x, y] = pos(id);
      for (const p of repo.commits[id].parents) {
        const [px, py] = pos(p);
        edges += `<path d="M${px} ${py} C ${px + dx / 2} ${py}, ${x - dx / 2} ${y}, ${x} ${y}" class="g-edge${L.live.has(id) ? '' : ' dead'}"/>`;
      }
      const isHead = repo.headId() === id;
      nodes += `<g class="g-node${L.live.has(id) ? '' : ' dead'}${isHead ? ' head' : ''}${repo.commits[id].parents.length > 1 ? ' merge' : ''}"><title>${id}: ${repo.commits[id].msg.replace(/[<&]/g, '')}</title><circle cx="${x}" cy="${y}" r="${r}"/><text x="${x}" y="${y + 4 * scale}" font-size="${12 * scale}">${id}</text></g>`;
    }
    const at = {};
    const push = (id, html) => (at[id] = at[id] || []).push(html);
    for (const [b, id] of Object.entries(repo.branches)) push(id, `<tspan class="${repo.head.branch === b ? 'g-cur' : 'g-br'}">${b}${repo.head.branch === b ? '*' : ''}</tspan>`);
    for (const [t, id] of Object.entries(repo.tags)) push(id, `<tspan class="g-tag">🏷${t}</tspan>`);
    if (!repo.head.branch) push(repo.head.detached, `<tspan class="g-cur">HEAD</tspan>`);
    for (const [id, arr] of Object.entries(at)) {
      const [x, y] = pos(id);
      arr.forEach((h, i) => { labels += `<text x="${x}" y="${y - r - 6 * scale - i * 15 * scale}" font-size="${12.5 * scale}" class="g-label">${h}</text>`; });
    }
    return `<svg class="git-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${edges}${nodes}${labels}</svg>`;
  }

  // ---------- уровни ----------
  const LEVELS = [
    { id: 'commit', g: 'Основы', t: 'Коммиты', start: '', sol: 'git commit; git commit',
      d: 'Коммит — снимок проекта. Каждый новый коммит ссылается на родителя, а текущая ветка передвигается на него.', task: 'Сделайте два коммита.', cmds: ['git commit', 'git commit -m "текст"'] },
    { id: 'branch', g: 'Основы', t: 'Ветки', start: '', sol: 'git branch bugFix; git switch bugFix', head: true,
      d: 'Ветка — просто подвижный указатель на коммит. Создать ветку почти бесплатно. HEAD показывает, где вы сейчас (у текущей ветки звёздочка).', task: 'Создайте ветку bugFix и переключитесь на неё.', cmds: ['git branch имя', 'git switch имя', 'git switch -c имя'] },
    { id: 'merge', g: 'Основы', t: 'Слияние: merge', start: '', sol: 'git switch -c bugFix; git commit; git switch main; git commit; git merge bugFix', head: true,
      d: 'merge объединяет две линии разработки: появляется коммит слияния с двумя родителями.', task: 'Создайте ветку bugFix и сделайте в ней коммит. Вернитесь на main, сделайте коммит и влейте bugFix в main.', cmds: ['git switch -c bugFix', 'git commit', 'git switch main', 'git merge bugFix'] },
    { id: 'rebase', g: 'Основы', t: 'Перебазирование: rebase', start: 'git switch -c bugFix; git commit; git switch main; git commit; git switch bugFix', sol: 'git rebase main', head: true,
      d: 'rebase переносит коммиты ветки поверх другой: создаются копии (C2′), история становится линейной.', task: 'Перенесите работу ветки bugFix поверх main.', cmds: ['git rebase main'] },
    { id: 'ff', g: 'Основы', t: 'Fast-forward', start: 'git switch -c feature; git commit; git commit; git switch main', sol: 'git merge feature', head: true,
      d: 'Если main не ушла вперёд, merge просто передвигает указатель — коммит слияния не нужен.', task: 'Влейте feature в main.', cmds: ['git merge feature'] },
    { id: 'detached', g: 'Перемещение', t: 'Отделённый HEAD', start: 'git commit; git commit', sol: 'git checkout C2', head: true,
      d: 'HEAD может указывать прямо на коммит, а не на ветку, — это «detached HEAD». Новые коммиты в этом состоянии не принадлежат никакой ветке.', task: 'Перейдите на коммит C2.', cmds: ['git checkout C2', 'git switch --detach C2'] },
    { id: 'relative', g: 'Перемещение', t: 'Относительные ссылки ^ и ~', start: 'git switch -c feature; git commit; git commit; git commit', sol: 'git checkout feature~2', head: true,
      d: 'feature^ — родитель вершины ветки, feature~3 — три шага назад, HEAD~1 — предыдущий коммит. У коммита слияния второй родитель — ^2.', task: 'Переместите HEAD на два коммита назад от вершины feature (не называя коммит по номеру).', cmds: ['git checkout feature~2', 'git checkout HEAD^'] },
    { id: 'force', g: 'Перемещение', t: 'Перемещение ветки: branch -f', start: 'git switch -c bugFix; git commit; git commit; git switch main; git commit; git checkout C1', sol: 'git branch -f main C2; git branch -f bugFix C0', head: true,
      d: 'git branch -f имя куда — передвинуть ветку на любой коммит (кроме текущей — для неё reset).', task: 'Вы в отделённом HEAD на C1. Передвиньте ветку main на C2, а bugFix — на C0, не переключаясь на них.', cmds: ['git branch -f main C2', 'git branch -f bugFix C0'] },
    { id: 'reset', g: 'Отмена изменений', t: 'reset и revert', start: 'git switch -c local; git commit; git switch main; git switch -c pushed; git commit; git switch local', sol: 'git reset HEAD~1; git switch pushed; git revert HEAD', head: true,
      d: 'reset передвигает ветку назад — история переписывается, годится для неопубликованного. revert создаёт новый коммит, отменяющий изменения, — безопасно для общих веток.', task: 'На ветке local отмените последний коммит через reset. На ветке pushed (она уже опубликована) отмените последний коммит через revert.', cmds: ['git reset HEAD~1', 'git switch pushed', 'git revert HEAD'] },
    { id: 'wrong', g: 'Отмена изменений', t: 'Коммиты не в той ветке', start: 'git commit; git commit', sol: 'git branch feature; git reset --hard C1; git switch feature', head: true,
      d: 'Частая ситуация: начали фичу прямо в main. Ветку можно создать задним числом, а main вернуть назад.', task: 'Коммиты C2 и C3 должны оказаться в новой ветке feature, main — вернуться на C1, а вы — на feature.', cmds: ['git branch feature', 'git reset --hard C1', 'git switch feature'] },
    { id: 'amend', g: 'Отмена изменений', t: 'Исправить последний коммит', start: 'git commit', sol: 'git commit --amend', head: true,
      d: '--amend заменяет последний коммит новым (C2′). Так исправляют сообщение или забытый файл — пока коммит не опубликован.', task: 'Исправьте последний коммит.', cmds: ['git commit --amend'] },
    { id: 'squash', g: 'Отмена изменений', t: 'Склеить коммиты', start: 'git switch -c feature; git commit; git commit; git commit', sol: 'git reset --soft C1; git commit', head: true,
      d: 'Без интерактивного rebase три коммита можно склеить так: reset --soft на основание (изменения останутся в индексе) и один новый коммит.', task: 'Превратите три коммита feature в один.', cmds: ['git reset --soft C1', 'git commit'] },
    { id: 'cherry', g: 'Перенос изменений', t: 'cherry-pick', start: 'git switch -c side; git commit; git commit; git commit; git switch main', sol: 'git cherry-pick C2 C4', head: true,
      d: 'cherry-pick копирует выбранные коммиты на текущую ветку.', task: 'Перенесите в main только коммиты C2 и C4 (C3 не нужен).', cmds: ['git cherry-pick C2 C4'] },
    { id: 'hotfix', g: 'Перенос изменений', t: 'Исправление в релизную ветку', start: 'git switch -c release; git switch main; git commit; git commit', sol: 'git switch release; git cherry-pick C3', head: true,
      d: 'Исправление сделано в main (C3), но релиз уже отведён в release. Нужно перенести только исправление.', task: 'Добавьте исправление C3 в ветку release и оставайтесь на ней.', cmds: ['git switch release', 'git cherry-pick C3'] },
    { id: 'update', g: 'Перенос изменений', t: 'Обновить ветку фичи и влить', start: 'git switch -c feature; git commit; git commit; git switch main; git commit; git commit; git switch feature', sol: 'git rebase main; git switch main; git merge feature', head: true,
      d: 'Типичный поток: перед вливанием фичу обновляют поверх свежего main (rebase), затем merge проходит как fast-forward и история линейная.', task: 'Перенесите feature поверх main, затем влейте её в main без коммита слияния. В конце — на main.', cmds: ['git rebase main', 'git switch main', 'git merge feature'] },
    { id: 'tags', g: 'Перенос изменений', t: 'Теги релизов', start: 'git commit; git commit', sol: 'git tag v1.0 C1; git tag v1.1', head: true,
      d: 'Тег — неподвижная метка на коммите, обычно версия релиза.', task: 'Поставьте тег v1.0 на C1 и v1.1 на текущий коммит.', cmds: ['git tag v1.0 C1', 'git tag v1.1'] },
  ];
  const HELP = `Поддерживаются: git commit [-m "текст"] [--amend], git branch [-f|-d] имя [куда], git switch [-c|--detach] имя,
git checkout [-b] имя|коммит, git merge [--no-ff] ref, git rebase ref, git cherry-pick C1 C2…, git reset [--soft|--hard] ref,
git revert ref, git tag имя [ref], git log, git status. Ссылки: имя ветки, тег, C3, HEAD, HEAD~2, main^, C5^2.
Служебные: undo — отменить последнюю команду, reset — начать уровень заново, clear — очистить терминал, help — эта подсказка.
Несколько команд — через «;».`;

  function buildRepo(cmds) { const r = new Repo(); (cmds || '').split(/[;\n]/).map(s => s.trim()).filter(Boolean).forEach(c => run(r, c)); return r; }

  // ---------- страница ----------
  let LV = null, ST = null;
  function page(api, m) {
    const S = api.S(); S.gitlab = S.gitlab || {};
    const id = m[1] || (LEVELS.find(l => !S.gitlab[l.id]) || LEVELS[0]).id;
    const sandbox = id === 'sandbox';
    LV = sandbox ? { id: 'sandbox', t: 'Песочница', d: 'Свободный режим: экспериментируйте с любыми командами. Цели нет.', task: '', start: '', sol: '' } : LEVELS.find(l => l.id === id) || LEVELS[0];
    ST = { repo: buildRepo(LV.start), hist: [], out: [], cmdHist: [], ch: -1, goal: sandbox ? null : buildRepo(LV.start + ';' + LV.sol) };
    const done = LEVELS.filter(l => S.gitlab[l.id]).length;
    const groups = [...new Set(LEVELS.map(l => l.g))];
    api.main().innerHTML = `<div class="page wide git-page"><div class="crumbs"><a href="#/">Главная</a> · Тренажёры</div>
      <h1 class="title">🌿 Git-тренажёр</h1>
      <p class="subtitle">Учитесь ветвлению на живом графе: вводите команды git — граф коммитов меняется сразу. Цель уровня — привести репозиторий к виду справа. Пройдено ${done} из ${LEVELS.length}.</p>
      <div class="git-levels">${groups.map(g => `<div class="gl-grp"><b>${api.esc(g)}</b>${LEVELS.filter(l => l.g === g).map((l, i) => `<a href="#/gitlab/${l.id}" class="gl-lv${l.id === LV.id ? ' on' : ''}${S.gitlab[l.id] ? ' ok' : ''}">${S.gitlab[l.id] ? '✓ ' : ''}${api.esc(l.t)}</a>`).join('')}</div>`).join('')}
        <div class="gl-grp"><b>Свободно</b><a href="#/gitlab/sandbox" class="gl-lv${sandbox ? ' on' : ''}">🧪 Песочница</a></div></div>
      <div class="git-task panel"><h3>${api.esc(LV.t)}</h3><p>${api.esc(LV.d)}</p>${LV.task ? `<p><b>Задание:</b> ${api.esc(LV.task)}</p>` : ''}
        <div class="git-tools">${LV.cmds ? `<button class="tbtn" id="gitHint">💡 Подсказка: команды</button>` : ''}${LV.sol ? `<button class="tbtn" id="gitSol">✅ Показать решение</button>` : ''}<button class="tbtn" id="gitReset">↺ Начать заново</button><a class="tbtn" href="#/t/git">📖 Тема «Git»</a></div>
        <div class="git-reveal" id="gitReveal"></div></div>
      <div class="git-boards"><div class="git-board"><div class="gb-cap">Ваш репозиторий</div><div id="gitCur" class="git-canvas"></div></div>
        ${ST.goal ? `<div class="git-board goal"><div class="gb-cap">Цель</div><div id="gitGoal" class="git-canvas"></div></div>` : ''}</div>
      <div class="git-term"><div class="gt-out" id="gitOut"></div><div class="gt-in"><span>$</span><input id="gitIn" autocomplete="off" spellcheck="false" placeholder="git commit — Enter. help — список команд"></div></div>
    </div>`;
    const $ = api.$;
    const draw = () => { $('#gitCur').innerHTML = svgGraph(ST.repo); if (ST.goal) $('#gitGoal').innerHTML = svgGraph(ST.goal, 0.8); };
    const print = (txt, cls = '') => { ST.out.push(`<div class="${cls}">${api.esc(txt)}</div>`); const o = $('#gitOut'); o.innerHTML = ST.out.slice(-200).join(''); o.scrollTop = o.scrollHeight; };
    const check = () => {
      if (!ST.goal) return;
      if (signature(ST.repo, LV) === signature(ST.goal, LV)) {
        const first = !S.gitlab[LV.id]; S.gitlab[LV.id] = true; api.save();
        const optimal = LV.sol.split(';').length, used = ST.cmdHist.length;
        print(`🎉 Уровень пройден! Команд: ${used}${used <= optimal ? ' — оптимально' : ` (можно за ${optimal})`}.`, 'ok');
        const next = LEVELS[LEVELS.indexOf(LV) + 1];
        if (next) { const a = document.createElement('a'); a.href = '#/gitlab/' + next.id; a.className = 'btn'; a.textContent = 'Следующий уровень: ' + next.t + ' →'; $('#gitOut').appendChild(a); }
        if (first) api.renderNav();
      }
    };
    const exec = line => {
      line = line.trim(); if (!line) return;
      ST.cmdHist.push(line); ST.ch = ST.cmdHist.length;
      for (const part of line.split(';').map(s => s.trim()).filter(Boolean)) {
        print('$ ' + part, 'cmd');
        if (part === 'help') { print(HELP); continue; }
        if (part === 'clear') { ST.out = []; $('#gitOut').innerHTML = ''; continue; }
        if (part === 'undo') { if (ST.hist.length) { ST.repo = ST.hist.pop(); print('Отменено'); } else print('Нечего отменять'); continue; }
        if (part === 'reset') { ST.repo = buildRepo(LV.start); ST.hist = []; ST.cmdHist = []; print('Уровень начат заново'); continue; }
        try { const snap = ST.repo.clone(); const res = run(ST.repo, part); ST.hist.push(snap); if (res) print(res); }
        catch (e) { print(e.message, 'err'); }
      }
      draw(); check();
    };
    $('#gitIn').addEventListener('keydown', e => {
      if (e.key === 'Enter') { exec(e.target.value); e.target.value = ''; }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (ST.ch > 0) e.target.value = ST.cmdHist[--ST.ch] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); if (ST.ch < ST.cmdHist.length) e.target.value = ST.cmdHist[++ST.ch] || ''; }
    });
    if ($('#gitHint')) $('#gitHint').onclick = () => { $('#gitReveal').innerHTML = `<p><b>Пригодятся:</b> ${LV.cmds.map(c => `<code>${api.esc(c)}</code>`).join(' ')}</p>`; };
    if ($('#gitSol')) $('#gitSol').onclick = () => { $('#gitReveal').innerHTML = `<p><b>Решение:</b> <code>${api.esc(LV.sol)}</code></p>`; };
    $('#gitReset').onclick = () => exec('reset');
    print(sandbox ? 'Песочница: main на C1. Введите команды git.' : 'Введите команды git. help — список команд, undo — отмена.');
    draw(); setTimeout(() => { if (matchMedia('(hover: hover)').matches) $('#gitIn').focus(); }, 50);
    api.$('.main').scrollTop = 0;
  }

  (window.APP_EXT = window.APP_EXT || []).push({
    id: 'gitlab', href: '#/gitlab', ico: '🌿', t: 'Git', long: 'Git-тренажёр', desc: `${LEVELS.length} уровней: ветки, merge, rebase, reset, cherry-pick`,
    prog: S => ({ k: LEVELS.filter(l => (S.gitlab || {})[l.id]).length, n: LEVELS.length }),
    re: /^#\/gitlab(?:\/([\w-]+))?$/, page,
  });
  window.GITLAB_TEST = { Repo, run, signature, LEVELS, buildRepo };
})();
