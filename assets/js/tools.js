/* Инструменты: JWT (разбор, проверка, создание) и JSON (проверка, форматирование, исправление). Всё офлайн. */
(function () {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const subtle = (window.crypto && window.crypto.subtle) || null;

  // ---------- base64url ----------
  function b64uToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/'); if (/[^A-Za-z0-9+/=]/.test(s)) throw new Error('Недопустимые символы Base64URL');
    while (s.length % 4) s += '=';
    const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
  }
  function bytesToB64u(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  const strToB64u = s => bytesToB64u(enc.encode(s));

  // ---------- SHA-256 и HMAC без WebCrypto (запасной вариант для HS256) ----------
  const K256 = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(msg) {
    const l = msg.length, bl = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(bl); m.set(msg); m[l] = 0x80;
    const dv = new DataView(m.buffer); dv.setUint32(bl - 4, l * 8); dv.setUint32(bl - 8, Math.floor(l / 0x20000000));
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); const W = new Uint32Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bl; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const s0 = r(W[i - 15], 7) ^ r(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = r(W[i - 2], 17) ^ r(W[i - 2], 19) ^ (W[i - 2] >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + W[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32); const ov = new DataView(out.buffer); H.forEach((v, i) => ov.setUint32(i * 4, v)); return out;
  }
  function hmac256(key, msg) {
    if (key.length > 64) key = sha256(key);
    const k = new Uint8Array(64); k.set(key); const ip = new Uint8Array(64 + msg.length), op = new Uint8Array(96);
    for (let i = 0; i < 64; i++) { ip[i] = k[i] ^ 0x36; op[i] = k[i] ^ 0x5c; }
    ip.set(msg, 64); op.set(sha256(ip), 64); return sha256(op);
  }

  // ---------- алгоритмы ----------
  const HASH = { 256: 'SHA-256', 384: 'SHA-384', 512: 'SHA-512' };
  const ALG = a => { const m = /^(HS|RS|PS|ES)(256|384|512)$/.exec(a || ''); return m ? { fam: m[1], bits: +m[2], hash: HASH[m[2]] } : null; };
  const CURVE = { 256: 'P-256', 384: 'P-384', 512: 'P-521' };
  function keyParams(al) {
    if (al.fam === 'RS') return { name: 'RSASSA-PKCS1-v1_5', hash: al.hash };
    if (al.fam === 'PS') return { name: 'RSA-PSS', hash: al.hash };
    if (al.fam === 'ES') return { name: 'ECDSA', namedCurve: CURVE[al.bits] };
    return { name: 'HMAC', hash: al.hash };
  }
  const signParams = al => al.fam === 'PS' ? { name: 'RSA-PSS', saltLength: al.bits / 8 } : al.fam === 'ES' ? { name: 'ECDSA', hash: al.hash } : al.fam === 'RS' ? { name: 'RSASSA-PKCS1-v1_5' } : { name: 'HMAC' };
  function pemToDer(pem) { const b = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''); const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function derToPem(buf, label) { const b = btoa(String.fromCharCode(...new Uint8Array(buf))); return `-----BEGIN ${label}-----\n${b.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`; }
  async function importKey(al, text, usage) {
    if (!subtle) throw new Error('В этом браузере недоступен WebCrypto — асимметричные алгоритмы не поддерживаются');
    text = text.trim(); const p = keyParams(al);
    if (text.startsWith('{')) { const jwk = JSON.parse(text); return subtle.importKey('jwk', jwk, p, false, [usage]); }
    if (/BEGIN RSA (PUBLIC|PRIVATE) KEY/.test(text)) throw new Error('Ключ в формате PKCS#1. Нужен PEM «BEGIN PUBLIC KEY» (SPKI) или «BEGIN PRIVATE KEY» (PKCS#8), либо JWK');
    if (/BEGIN CERTIFICATE/.test(text)) throw new Error('Это сертификат. Вставьте открытый ключ (BEGIN PUBLIC KEY) или JWK');
    const isPriv = /PRIVATE KEY/.test(text);
    if (usage === 'verify' && isPriv) throw new Error('Для проверки нужен открытый ключ, а не закрытый');
    if (usage === 'sign' && !isPriv) throw new Error('Для подписи нужен закрытый ключ (BEGIN PRIVATE KEY)');
    return subtle.importKey(isPriv ? 'pkcs8' : 'spki', pemToDer(text), p, false, [usage]);
  }
  function secretBytes(secret, isB64) { return isB64 ? b64uToBytes(secret.trim()) : enc.encode(secret); }
  async function hmacSign(al, keyBytes, data) {
    if (subtle) { const k = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: al.hash }, false, ['sign']); return new Uint8Array(await subtle.sign('HMAC', k, data)); }
    if (al.bits !== 256) throw new Error('Без WebCrypto поддерживается только HS256');
    return hmac256(keyBytes, data);
  }
  const eqBytes = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
  async function verify(al, signingInput, sig, keyText, isB64) {
    const data = enc.encode(signingInput);
    if (al.fam === 'HS') return eqBytes(await hmacSign(al, secretBytes(keyText, isB64), data), sig);
    const k = await importKey(al, keyText, 'verify'); return subtle.verify(signParams(al), k, sig, data);
  }
  async function sign(al, signingInput, keyText, isB64) {
    const data = enc.encode(signingInput);
    if (al.fam === 'HS') return hmacSign(al, secretBytes(keyText, isB64), data);
    const k = await importKey(al, keyText, 'sign'); return new Uint8Array(await subtle.sign(signParams(al), k, data));
  }

  // ---------- общие помощники ----------
  let api;
  const esc = s => api.esc(s);
  function hlJson(text) { try { if (window.hljs && hljs.getLanguage('json')) return hljs.highlight(text, { language: 'json', ignoreIllegals: true }).value; } catch (e) { } return esc(text); }
  const copy = t => navigator.clipboard ? navigator.clipboard.writeText(t).then(() => api.toast('Скопировано'), () => api.fallbackCopy(t)) : api.fallbackCopy(t);
  const fmtTime = sec => { const d = new Date(sec * 1000); return isNaN(d) ? '—' : d.toLocaleString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); };
  function ago(sec) { const diff = Math.round(sec - Date.now() / 1000), a = Math.abs(diff); const u = a < 60 ? [a, 'с'] : a < 3600 ? [Math.round(a / 60), 'мин'] : a < 86400 ? [Math.round(a / 3600), 'ч'] : [Math.round(a / 86400), 'дн']; return diff >= 0 ? `через ${u[0]} ${u[1]}` : `${u[0]} ${u[1]} назад`; }
  const CLAIM = { iss: 'издатель', sub: 'субъект (пользователь)', aud: 'получатель', exp: 'истекает', nbf: 'действует с', iat: 'выпущен', jti: 'id токена', scope: 'области доступа', roles: 'роли', name: 'имя', email: 'почта', azp: 'клиент', sid: 'сессия', typ: 'тип', alg: 'алгоритм подписи', kid: 'id ключа', cty: 'тип содержимого' };

  // ======================= JWT =======================
  const SAMPLE_SECRET = 'vibeoff-учебный-секрет-не-для-продакшна-32+';
  async function sampleToken() {
    const now = Math.floor(Date.now() / 1000);
    const h = { alg: 'HS256', typ: 'JWT' }, p = { iss: 'https://auth.vibeoff.local', sub: '42', aud: 'orders-api', name: 'Аня', roles: ['USER'], iat: now, exp: now + 900 };
    const si = strToB64u(JSON.stringify(h)) + '.' + strToB64u(JSON.stringify(p));
    return si + '.' + bytesToB64u(await sign(ALG('HS256'), si, SAMPLE_SECRET, false));
  }
  function parseJwt(tok) {
    tok = tok.trim().replace(/^Bearer\s+/i, '');
    const parts = tok.split('.');
    if (parts.length === 5) throw new Error('Это JWE (зашифрованный токен из 5 частей) — его нельзя прочитать без ключа расшифровки');
    if (parts.length !== 3) throw new Error(`JWT состоит из трёх частей через точку, а здесь ${parts.length}`);
    const out = { parts, raw: tok };
    ['header', 'payload'].forEach((k, i) => {
      let txt; try { txt = dec.decode(b64uToBytes(parts[i])); } catch (e) { throw new Error(`${k === 'header' ? 'Заголовок' : 'Полезная нагрузка'}: не удалось декодировать Base64URL`); }
      try { out[k] = JSON.parse(txt); } catch (e) { throw new Error(`${k === 'header' ? 'Заголовок' : 'Полезная нагрузка'} — не JSON: ${e.message}`); }
    });
    out.sig = parts[2] ? b64uToBytes(parts[2]) : new Uint8Array(0);
    return out;
  }
  const colorTok = t => { const p = t.trim().split('.'); return p.map((x, i) => `<span class="jw-${['h', 'p', 's', 'x', 'x'][i] || 'x'}">${esc(x)}</span>`).join('<span class="jw-dot">.</span>'); };

  let jwtMode = 'dec';
  function pageJwt(m) {
    const S = api.S();
    jwtMode = m === 'create' ? 'enc' : 'dec';
    api.main().innerHTML = `<div class="page wide tool-page"><div class="crumbs"><a href="#/">Главная</a> · Инструменты</div>
      <h1 class="title">🔑 JWT: разбор, проверка и создание</h1>
      <p class="subtitle">Как jwt.io, только офлайн: токен и ключи не покидают ваш компьютер и не сохраняются. Теория — в теме «<a href="#/q/sec-x1">Безопасность → JWT подробно</a>».</p>
      <div class="seg tool-seg"><a href="#/jwt" class="${jwtMode === 'dec' ? 'on' : ''}">Разобрать и проверить</a><a href="#/jwt/create" class="${jwtMode === 'enc' ? 'on' : ''}">Создать токен</a></div>
      <div id="jwtArea"></div></div>`;
    jwtMode === 'dec' ? renderDecode() : renderEncode();
  }
  function renderDecode() {
    const a = api.$('#jwtArea');
    a.innerHTML = `<div class="tool-grid">
      <div class="tool-col"><div class="tool-h"><b>Токен</b><span class="sp"></span><button class="chip" id="jwSample" data-hint="Подставить учебный токен, подписанный HS256">Пример</button><button class="chip" id="jwCopy">Копировать</button><button class="chip" id="jwClear">Очистить</button></div>
        <textarea id="jwIn" class="tool-ta mono" spellcheck="false" placeholder="Вставьте JWT: eyJhbGciOi…  (можно вместе с «Bearer »)"></textarea>
        <div id="jwColor" class="jw-color mono"></div>
        <div id="jwWarn"></div>
        <div class="tool-h" style="margin-top:14px"><b>Проверка подписи</b><span class="muted" id="jwAlg"></span></div>
        <div id="jwKeyBox"></div>
        <div id="jwVerify" class="jw-verify"></div></div>
      <div class="tool-col"><div class="tool-h"><b>Заголовок</b><span class="muted">алгоритм и тип</span></div><pre class="tool-pre" id="jwHead"></pre>
        <div class="tool-h"><b>Полезная нагрузка</b><span class="muted">claims</span></div><pre class="tool-pre" id="jwPay"></pre>
        <div id="jwClaims"></div></div></div>`;
    const ta = api.$('#jwIn');
    const keyState = { secret: '', b64: false, pub: '' };
    let cur = null, t = 0;
    const renderKeyBox = () => {
      const al = cur && ALG(cur.header.alg);
      const box = api.$('#jwKeyBox');
      if (!cur) { box.innerHTML = '<p class="muted">Вставьте токен — здесь появится поле для секрета или открытого ключа.</p>'; return; }
      if (!al) { box.innerHTML = `<p class="muted">${cur.header.alg === 'none' ? '' : 'Алгоритм не поддерживается для проверки.'}</p>`; return; }
      box.innerHTML = al.fam === 'HS'
        ? `<input id="jwSecret" class="tool-in mono" placeholder="Секрет HMAC" value="${esc(keyState.secret)}" autocomplete="off"><label class="tool-cb"><input type="checkbox" id="jwB64"${keyState.b64 ? ' checked' : ''}> секрет в Base64URL</label>`
        : `<textarea id="jwPub" class="tool-ta mono small" spellcheck="false" placeholder="Открытый ключ: -----BEGIN PUBLIC KEY----- … или JWK {&quot;kty&quot;:…}">${esc(keyState.pub)}</textarea>`;
      const s = api.$('#jwSecret'), b = api.$('#jwB64'), p = api.$('#jwPub');
      if (s) s.oninput = () => { keyState.secret = s.value; check(); };
      if (b) b.onchange = () => { keyState.b64 = b.checked; check(); };
      if (p) p.oninput = () => { keyState.pub = p.value; check(); };
    };
    const check = async () => {
      const out = api.$('#jwVerify'); if (!cur) { out.innerHTML = ''; return; }
      const al = ALG(cur.header.alg);
      if (cur.header.alg === 'none') { out.innerHTML = '<div class="jw-bad">⚠ alg = none: токен без подписи. Сервер обязан отклонять такие токены.</div>'; return; }
      if (!al) { out.innerHTML = `<div class="jw-bad">Алгоритм «${esc(cur.header.alg)}» не поддерживается</div>`; return; }
      const key = al.fam === 'HS' ? keyState.secret : keyState.pub;
      if (!key.trim()) { out.innerHTML = `<div class="jw-neutral">Подпись не проверена — введите ${al.fam === 'HS' ? 'секрет' : 'открытый ключ'}.</div>`; return; }
      try {
        const ok = await verify(al, cur.parts[0] + '.' + cur.parts[1], cur.sig, key, keyState.b64);
        out.innerHTML = ok ? '<div class="jw-ok">✓ Подпись верна</div>' : '<div class="jw-bad">✗ Подпись неверна: токен изменён или ключ не тот</div>';
      } catch (e) { out.innerHTML = `<div class="jw-bad">✗ ${esc(e.message)}</div>`; }
    };
    const run = () => {
      const v = ta.value.trim();
      api.$('#jwColor').innerHTML = v ? colorTok(v) : '';
      const warn = api.$('#jwWarn'); warn.innerHTML = '';
      if (!v) { cur = null; ['#jwHead', '#jwPay'].forEach(s => api.$(s).innerHTML = ''); api.$('#jwClaims').innerHTML = ''; api.$('#jwAlg').textContent = ''; renderKeyBox(); check(); return; }
      try { cur = parseJwt(v); } catch (e) { cur = null; warn.innerHTML = `<div class="jw-bad">✗ ${esc(e.message)}</div>`; ['#jwHead', '#jwPay'].forEach(s => api.$(s).innerHTML = ''); api.$('#jwClaims').innerHTML = ''; renderKeyBox(); check(); return; }
      api.$('#jwHead').innerHTML = hlJson(JSON.stringify(cur.header, null, 2));
      api.$('#jwPay').innerHTML = hlJson(JSON.stringify(cur.payload, null, 2));
      api.$('#jwAlg').textContent = cur.header.alg ? 'алгоритм ' + cur.header.alg : '';
      const p = cur.payload, now = Date.now() / 1000, w = [];
      if (typeof p.exp !== 'number') w.push(['warn', 'Нет exp — токен бессрочный. Для access-токенов срок обязателен.']);
      else if (p.exp < now) w.push(['bad', `Токен истёк ${ago(p.exp)}.`]);
      if (typeof p.nbf === 'number' && p.nbf > now) w.push(['warn', `Токен ещё не действует (nbf ${ago(p.nbf)}).`]);
      if (!p.aud) w.push(['warn', 'Нет aud — непонятно, для какого API выпущен токен.']);
      if (cur.header.alg === 'none') w.push(['bad', 'alg = none — токен без подписи.']);
      if (/password|пароль|secret|card|паспорт/i.test(JSON.stringify(p))) w.push(['bad', 'В payload похоже на секретные или персональные данные — payload может прочитать любой.']);
      warn.innerHTML = w.map(([k, t]) => `<div class="jw-${k === 'bad' ? 'bad' : 'warnmsg'}">⚠ ${esc(t)}</div>`).join('');
      const rows = Object.entries(Object.assign({}, cur.header.kid ? { kid: cur.header.kid } : {}, p)).map(([k, v]) => {
        let val = typeof v === 'object' ? JSON.stringify(v) : String(v);
        if (['exp', 'iat', 'nbf', 'auth_time'].includes(k) && typeof v === 'number') val = `${fmtTime(v)} <span class="muted">(${ago(v)})</span>`; else val = esc(val);
        return `<tr><td class="mono">${esc(k)}</td><td>${esc(CLAIM[k] || '')}</td><td>${val}</td></tr>`;
      }).join('');
      api.$('#jwClaims').innerHTML = `<div class="tbl"><table><thead><tr><th>Claim</th><th>Смысл</th><th>Значение</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      renderKeyBox(); check();
    };
    ta.oninput = () => { clearTimeout(t); t = setTimeout(run, 120); };
    api.$('#jwSample').onclick = async () => { ta.value = await sampleToken(); keyState.secret = SAMPLE_SECRET; keyState.b64 = false; run(); };
    api.$('#jwCopy').onclick = () => ta.value.trim() && copy(ta.value.trim());
    api.$('#jwClear').onclick = () => { ta.value = ''; keyState.secret = keyState.pub = ''; run(); };
    const pending = sessionStorage.getItem('vibeoff:jwt'); if (pending) { sessionStorage.removeItem('vibeoff:jwt'); const o = JSON.parse(pending); ta.value = o.t; keyState.secret = o.s || ''; keyState.b64 = !!o.b; keyState.pub = o.p || ''; }
    run();
  }
  function renderEncode() {
    const a = api.$('#jwtArea'); const now = Math.floor(Date.now() / 1000);
    const st = { alg: 'HS256', secret: '', b64: false, priv: '', pub: '' };
    a.innerHTML = `<div class="tool-grid">
      <div class="tool-col">
        <div class="tool-h"><b>Алгоритм</b><select id="jeAlg" class="tool-sel">${['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512', 'PS256', 'ES256', 'ES384'].map(x => `<option>${x}</option>`).join('')}</select></div>
        <div class="tool-h"><b>Заголовок</b></div><textarea id="jeHead" class="tool-ta mono small" spellcheck="false"></textarea>
        <div class="tool-h"><b>Полезная нагрузка</b><span class="sp"></span><button class="chip" id="jeIat" data-hint="Записать iat = текущее время">iat: сейчас</button><button class="chip" id="jeExp" data-hint="Записать exp = текущее время + 15 минут">exp: +15 мин</button></div>
        <textarea id="jePay" class="tool-ta mono" spellcheck="false">${esc(JSON.stringify({ iss: 'https://auth.vibeoff.local', sub: '42', aud: 'orders-api', roles: ['USER'], iat: now, exp: now + 900 }, null, 2))}</textarea>
        <div class="tool-h"><b id="jeKeyH">Секрет</b><span class="sp"></span><button class="chip" id="jeGen" data-hint="Сгенерировать случайный секрет или пару ключей">Сгенерировать ключ</button></div>
        <div id="jeKey"></div></div>
      <div class="tool-col"><div class="tool-h"><b>Готовый токен</b><span class="sp"></span><button class="chip" id="jeCopy">Копировать</button><button class="chip" id="jeOpen" data-hint="Открыть токен в разборе с этим же ключом">Проверить в разборе →</button></div>
        <div id="jeOut" class="jw-color mono big"></div><div id="jeMsg"></div>
        <div class="tool-note"><b>Подсказки.</b> Секрет HMAC должен быть случайным и длиной не меньше 32 байт. Для RS/PS/ES нужен закрытый ключ PKCS#8 (BEGIN PRIVATE KEY) или JWK; кнопка «Сгенерировать ключ» создаст пару, открытый ключ понадобится для проверки. Не кладите в payload пароли и персональные данные.</div>
        <div id="jePubBox"></div></div></div>`;
    const head = api.$('#jeHead'), pay = api.$('#jePay');
    const setHead = () => { let h; try { h = JSON.parse(head.value || '{}'); } catch (e) { h = {}; } h.alg = st.alg; h.typ = h.typ || 'JWT'; head.value = JSON.stringify(h, null, 2); };
    const keyBox = () => {
      const al = ALG(st.alg);
      api.$('#jeKeyH').textContent = al.fam === 'HS' ? 'Секрет' : 'Закрытый ключ';
      api.$('#jeKey').innerHTML = al.fam === 'HS'
        ? `<input id="jeSecret" class="tool-in mono" placeholder="Секрет HMAC" value="${esc(st.secret)}" autocomplete="off"><label class="tool-cb"><input type="checkbox" id="jeB64"${st.b64 ? ' checked' : ''}> секрет в Base64URL</label>`
        : `<textarea id="jePriv" class="tool-ta mono small" spellcheck="false" placeholder="-----BEGIN PRIVATE KEY----- …  или JWK">${esc(st.priv)}</textarea>`;
      const s = api.$('#jeSecret'), b = api.$('#jeB64'), p = api.$('#jePriv');
      if (s) s.oninput = () => { st.secret = s.value; build(); };
      if (b) b.onchange = () => { st.b64 = b.checked; build(); };
      if (p) p.oninput = () => { st.priv = p.value; st.pub = ''; api.$('#jePubBox').innerHTML = ''; build(); };
    };
    let token = '';
    const build = async () => {
      const msg = api.$('#jeMsg'); msg.innerHTML = ''; token = '';
      let h, p;
      try { h = JSON.parse(head.value); } catch (e) { msg.innerHTML = `<div class="jw-bad">Заголовок — не JSON: ${esc(e.message)}</div>`; api.$('#jeOut').innerHTML = ''; return; }
      try { p = JSON.parse(pay.value); } catch (e) { msg.innerHTML = `<div class="jw-bad">Полезная нагрузка — не JSON: ${esc(e.message)}</div>`; api.$('#jeOut').innerHTML = ''; return; }
      const al = ALG(h.alg); if (!al) { msg.innerHTML = '<div class="jw-bad">Укажите поддерживаемый alg в заголовке</div>'; return; }
      const si = strToB64u(JSON.stringify(h)) + '.' + strToB64u(JSON.stringify(p));
      const key = al.fam === 'HS' ? st.secret : st.priv;
      if (!key.trim()) { api.$('#jeOut').innerHTML = colorTok(si + '.'); msg.innerHTML = '<div class="jw-neutral">Введите или сгенерируйте ключ — появится подпись.</div>'; return; }
      try { token = si + '.' + bytesToB64u(await sign(al, si, key, st.b64)); api.$('#jeOut').innerHTML = colorTok(token); if (al.fam === 'HS' && !st.b64 && enc.encode(st.secret).length < 32) msg.innerHTML = '<div class="jw-warnmsg">⚠ Секрет короче 32 байт — для HS256 это слабо.</div>'; }
      catch (e) { msg.innerHTML = `<div class="jw-bad">✗ ${esc(e.message)}</div>`; api.$('#jeOut').innerHTML = ''; }
    };
    api.$('#jeAlg').onchange = e => { st.alg = e.target.value; st.priv = st.pub = ''; api.$('#jePubBox').innerHTML = ''; setHead(); keyBox(); build(); };
    head.oninput = pay.oninput = () => build();
    const edit = f => { try { const o = JSON.parse(pay.value); f(o); pay.value = JSON.stringify(o, null, 2); build(); } catch (e) { api.toast('Сначала исправьте JSON полезной нагрузки'); } };
    api.$('#jeIat').onclick = () => edit(o => { o.iat = Math.floor(Date.now() / 1000); });
    api.$('#jeExp').onclick = () => edit(o => { o.exp = Math.floor(Date.now() / 1000) + 900; });
    api.$('#jeGen').onclick = async () => {
      const al = ALG(st.alg);
      if (al.fam === 'HS') { const r = new Uint8Array(al.bits / 8); crypto.getRandomValues(r); st.secret = bytesToB64u(r); st.b64 = true; keyBox(); build(); return; }
      if (!subtle) { api.toast('WebCrypto недоступен в этом браузере'); return; }
      try {
        const p = keyParams(al); const gp = al.fam === 'ES' ? p : Object.assign({}, p, { modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) });
        const kp = await subtle.generateKey(gp, true, ['sign', 'verify']);
        st.priv = derToPem(await subtle.exportKey('pkcs8', kp.privateKey), 'PRIVATE KEY'); st.pub = derToPem(await subtle.exportKey('spki', kp.publicKey), 'PUBLIC KEY');
        keyBox(); api.$('#jePubBox').innerHTML = `<div class="tool-h" style="margin-top:12px"><b>Открытый ключ</b><span class="sp"></span><button class="chip" id="jePubCopy">Копировать</button></div><pre class="tool-pre mono small">${esc(st.pub)}</pre>`;
        api.$('#jePubCopy').onclick = () => copy(st.pub); build();
      } catch (e) { api.toast('Не удалось сгенерировать ключ: ' + e.message); }
    };
    api.$('#jeCopy').onclick = () => token && copy(token);
    api.$('#jeOpen').onclick = () => { if (!token) return; sessionStorage.setItem('vibeoff:jwt', JSON.stringify({ t: token, s: st.secret, b: st.b64, p: st.pub })); location.hash = '#/jwt'; };
    setHead(); keyBox(); build();
  }

  // ======================= JSON =======================
  // строгий парсер с понятными сообщениями; числа хранятся как текст (без потери точности)
  function JsonError(msg, pos) { const e = new Error(msg); e.pos = pos; return e; }
  function parseStrict(src) {
    let i = 0; const warns = [];
    const ws = () => { for (; ;) { const c = src[i]; if (c === ' ' || c === '\t' || c === '\n' || c === '\r') i++; else if (c === '/' && (src[i + 1] === '/' || src[i + 1] === '*')) throw JsonError('Комментарии в JSON запрещены', i); else if (c === '﻿' && i === 0) i++; else break; } };
    const word = () => { const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i, i + 40)); return m ? m[0] : ''; };
    function value(depth) {
      if (depth > 500) throw JsonError('Слишком глубокая вложенность (больше 500 уровней)', i);
      ws(); const c = src[i];
      if (c === undefined) throw JsonError('Неожиданный конец документа: ожидалось значение', i);
      if (c === '{') return obj(depth); if (c === '[') return arr(depth);
      if (c === '"') return { t: 's', v: str() };
      if (c === "'") throw JsonError('Строки записываются в двойных кавычках, а не в одинарных', i);
      if (c === '-' || (c >= '0' && c <= '9')) return num();
      const w = word();
      if (w === 'true' || w === 'false') { i += w.length; return { t: 'b', v: w }; }
      if (w === 'null') { i += 4; return { t: 'z', v: 'null' }; }
      if (w === 'NaN' || w === 'Infinity' || w === 'undefined') throw JsonError(`${w} недопустимо в JSON — используйте null или строку`, i);
      if (w === 'True' || w === 'False' || w === 'None') throw JsonError(`«${w}» — так пишут в Python; в JSON — ${w === 'None' ? 'null' : w.toLowerCase()}`, i);
      if (w) throw JsonError(`Неизвестное слово «${w}»: строки нужно брать в двойные кавычки`, i);
      if (c === '}' || c === ']') throw JsonError(`Ожидалось значение, а встретилось «${c}»`, i);
      if (c === ',') throw JsonError('Лишняя запятая: ожидалось значение', i);
      throw JsonError(`Неожиданный символ «${c}»`, i);
    }
    function str() {
      const start = i; i++; let out = '';
      for (; ;) {
        const c = src[i];
        if (c === undefined) throw JsonError('Строка не закрыта: нет завершающей кавычки', start);
        if (c === '"') { i++; return out; }
        if (c === '\\') {
          const n = src[i + 1]; const map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (n in map) { out += map[n]; i += 2; continue; }
          if (n === 'u') { const h = src.slice(i + 2, i + 6); if (!/^[0-9a-fA-F]{4}$/.test(h)) throw JsonError('Неверная последовательность \\u: нужно ровно 4 шестнадцатеричные цифры', i); out += String.fromCharCode(parseInt(h, 16)); i += 6; continue; }
          throw JsonError(`Неверная escape-последовательность «\\${n || ''}»`, i);
        }
        if (c < ' ') throw JsonError(c === '\n' ? 'Перенос строки внутри строки: замените на \\n' : c === '\t' ? 'Табуляция внутри строки: замените на \\t' : 'Управляющий символ внутри строки нужно экранировать', i);
        out += c; i++;
      }
    }
    function num() {
      const start = i; const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(src.slice(i, i + 400));
      if (!m || !m[0] || m[0] === '-') throw JsonError('Некорректное число', i);
      const after = src[i + m[0].length];
      if (m[1] === '0' && after >= '0' && after <= '9') throw JsonError('Ведущие нули в числах запрещены (например, 007)', i);
      if (after === '.') throw JsonError('Некорректное число: после точки должны быть цифры', i + m[0].length);
      i += m[0].length;
      const raw = m[0]; if (!m[2] && !m[3] && Math.abs(Number(raw)) > Number.MAX_SAFE_INTEGER) warns.push({ pos: start, msg: `Число ${raw} больше 2^53 − 1: JavaScript-клиенты потеряют точность — передавайте строкой` });
      return { t: 'n', v: raw };
    }
    function obj(depth) {
      const start = i; i++; const kv = []; const seen = new Set(); ws();
      if (src[i] === '}') { i++; return { t: 'o', kv }; }
      for (; ;) {
        ws(); const c = src[i];
        if (c === '}') throw JsonError('Лишняя запятая перед «}»', i - 1);
        if (c === undefined) throw JsonError('Объект не закрыт: нет «}»', start);
        if (c === "'") throw JsonError('Ключ должен быть в двойных кавычках, а не в одинарных', i);
        if (c !== '"') throw JsonError(word() ? `Ключ «${word()}» должен быть в двойных кавычках` : `Ожидался ключ в двойных кавычках, а встретилось «${c}»`, i);
        const kpos = i; const k = str();
        if (seen.has(k)) warns.push({ pos: kpos, msg: `Ключ «${k}» повторяется — разные парсеры возьмут разное значение` }); seen.add(k);
        ws(); if (src[i] !== ':') throw JsonError(`Ожидалось «:» после ключа «${k}»`, i); i++;
        kv.push([k, value(depth + 1)]); ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return { t: 'o', kv }; }
        if (src[i] === undefined) throw JsonError('Объект не закрыт: нет «}»', start);
        throw JsonError(src[i] === '"' ? 'Пропущена запятая между полями' : `Ожидалось «,» или «}», а встретилось «${src[i]}»`, i);
      }
    }
    function arr(depth) {
      const start = i; i++; const v = []; ws();
      if (src[i] === ']') { i++; return { t: 'a', v }; }
      for (; ;) {
        ws(); if (src[i] === ']') throw JsonError('Лишняя запятая перед «]»', i - 1);
        v.push(value(depth + 1)); ws();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return { t: 'a', v }; }
        if (src[i] === undefined) throw JsonError('Массив не закрыт: нет «]»', start);
        throw JsonError(`Ожидалось «,» или «]», а встретилось «${src[i]}»`, i);
      }
    }
    ws(); if (i >= src.length) throw JsonError('Документ пуст', 0);
    const root = value(0); ws();
    if (i < src.length) throw JsonError(`После корневого значения лишние символы «${src.slice(i, i + 12)}»`, i);
    return { root, warns };
  }
  const qs = s => JSON.stringify(s);
  function serialize(n, ind, lvl = 0, sort = false) {
    const pad = ind ? '\n' + ind.repeat(lvl + 1) : '', end = ind ? '\n' + ind.repeat(lvl) : '', sep = ind ? ': ' : ':';
    if (n.t === 'o') { if (!n.kv.length) return '{}'; const kv = sort ? n.kv.slice().sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) : n.kv; return '{' + kv.map(([k, v]) => pad + qs(k) + sep + serialize(v, ind, lvl + 1, sort)).join(',') + end + '}'; }
    if (n.t === 'a') { if (!n.v.length) return '[]'; return '[' + n.v.map(v => pad + serialize(v, ind, lvl + 1, sort)).join(',') + end + ']'; }
    if (n.t === 's') return qs(n.v);
    return n.v;
  }
  function stats(root) { let keys = 0, depth = 0, nodes = 0; (function w(n, d) { nodes++; depth = Math.max(depth, d); if (n.t === 'o') { keys += n.kv.length; n.kv.forEach(([, v]) => w(v, d + 1)); } else if (n.t === 'a') n.v.forEach(v => w(v, d + 1)); })(root, 1); return { keys, depth, nodes }; }
  // «исправление» частых ошибок: комментарии, одинарные кавычки, ключи без кавычек, висячие запятые, Python-литералы
  function repair(src) {
    let out = '', i = 0; const n = src.length;
    while (i < n) {
      const c = src[i];
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++;
        while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i] + (src[i + 1] || ''); i += 2; continue; } if (src[i] === '\n') { s += '\\n'; i++; continue; } if (src[i] === '\t') { s += '\\t'; i++; continue; } s += (q === "'" && src[i] === '"') ? '\\"' : src[i]; i++; }
        i++; if (q === "'") s = s.replace(/\\'/g, "'"); out += '"' + s + '"'; continue;
      }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
      if (/[A-Za-z_$]/.test(c)) {
        const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(i)); const w = m[0]; i += w.length;
        let j = i; while (j < n && /\s/.test(src[j])) j++;
        if (src[j] === ':') { out += '"' + w + '"'; continue; }
        out += ({ True: 'true', False: 'false', None: 'null', NaN: 'null', Infinity: 'null', undefined: 'null' })[w] || w; continue;
      }
      if (c === ',') { let j = i + 1; while (j < n && /\s/.test(src[j])) j++; if (src[j] === '}' || src[j] === ']') { i++; continue; } }
      out += c; i++;
    }
    return out.replace(/\+?\bInfinity\b/g, 'null');
  }
  function posToLC(src, pos) { let line = 1, col = 1; for (let k = 0; k < pos && k < src.length; k++) { if (src[k] === '\n') { line++; col = 1; } else col++; } return { line, col }; }
  function frame(src, pos) {
    const { line, col } = posToLC(src, pos); const lines = src.split('\n'); const from = Math.max(1, line - 2), to = Math.min(lines.length, line + 1);
    let o = ''; for (let l = from; l <= to; l++) { o += `<div class="jf-l${l === line ? ' err' : ''}"><span class="jf-n">${l}</span>${esc(lines[l - 1].slice(0, 200)) || ' '}</div>`; if (l === line) o += `<div class="jf-l caret"><span class="jf-n"></span>${' '.repeat(Math.max(0, Math.min(col - 1, 200)))}^</div>`; }
    return o;
  }
  function treeHTML(n, path, key, open) {
    const label = key !== null ? `<span class="jt-k">${esc(key)}</span>: ` : '';
    const pAttr = ` data-ptr="${esc(path || '')}"`, cp = `<span class="jt-cp" data-ptr="${esc(path || '/')}" title="Скопировать путь JSON Pointer">⧉</span>`;
    if (n.t === 'o' || n.t === 'a') {
      const items = n.t === 'o' ? n.kv : n.v.map((v, i) => [String(i), v]);
      const br = n.t === 'o' ? ['{', '}'] : ['[', ']'];
      return `<details${open ? ' open' : ''}><summary>${cp}${label}<span class="jt-b">${br[0]}</span><span class="muted"> ${items.length} ${n.t === 'o' ? 'полей' : 'элементов'} </span><span class="jt-b">${br[1]}</span></summary><div class="jt-in">${items.map(([k, v]) => treeHTML(v, path + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1'), n.t === 'o' ? k : '[' + k + ']', false)).join('')}</div></details>`;
    }
    const cls = { s: 'jt-s', n: 'jt-n', b: 'jt-l', z: 'jt-l' }[n.t];
    return `<div class="jt-leaf"${pAttr}>${label}<span class="${cls}">${esc(n.t === 's' ? qs(n.v) : n.v)}</span></div>`;
  }
  const SAMPLE_JSON = `{
  "id": "9007199254740993",
  "customer": { "name": "Аня", "email": "anna@mail.ru" },
  "items": [
    { "sku": "JAVA-BOOK", "qty": 1, "price": "1499.90" },
    { "sku": "KOTLIN-MUG", "qty": 2, "price": "590.00" }
  ],
  "paid": true,
  "coupon": null,
  "createdAt": "2026-11-04T10:15:30Z"
}`;
  const BROKEN_JSON = `{
  // заказ из старой системы
  id: 42,
  'customer': 'Аня',
  "items": [1, 2, 3,],
  "paid": True,
  "discount": NaN,
}`;
  function pageJson() {
    const S = api.S();
    api.main().innerHTML = `<div class="page wide tool-page"><div class="crumbs"><a href="#/">Главная</a> · Инструменты</div>
      <h1 class="title">{ } JSON: проверка и форматирование</h1>
      <p class="subtitle">Как JSONLint, только офлайн. Проверка по строгому стандарту RFC 8259 с понятными сообщениями, форматирование без потери точности чисел, исправление частых ошибок и дерево с путями JSON Pointer. Теория — в теме «<a href="#/q/json-x6">JSON и Jackson</a>».</p>
      <div class="tool-bar">
        <button class="btn" id="jsCheck" data-hint="Проверить документ (Ctrl+Enter)">Проверить</button>
        <button class="chip" id="jsFmt" data-hint="Отформатировать с отступами">Форматировать</button>
        <select id="jsInd" class="tool-sel" data-hint="Размер отступа"><option value="2">2 пробела</option><option value="4">4 пробела</option><option value="t">табуляция</option></select>
        <button class="chip" id="jsMin" data-hint="Убрать пробелы и переносы">Сжать</button>
        <button class="chip" id="jsSort" data-hint="Отсортировать ключи объектов по алфавиту">Сортировать ключи</button>
        <button class="chip" id="jsFix" data-hint="Убрать комментарии и висячие запятые, заменить одинарные кавычки, взять ключи в кавычки, True/None/NaN → true/null">🩹 Исправить</button>
        <span class="sp"></span>
        <button class="chip" id="jsSample">Пример</button><button class="chip" id="jsBroken" data-hint="Документ с типичными ошибками — попробуйте «Исправить»">Пример с ошибками</button>
        <button class="chip" id="jsCopy">Копировать</button><button class="chip" id="jsClear">Очистить</button></div>
      <div class="js-ed"><div class="js-gut" id="jsGut"></div><textarea id="jsIn" class="mono" spellcheck="false" wrap="off" placeholder="Вставьте JSON и нажмите «Проверить» (Ctrl+Enter)"></textarea></div>
      <div id="jsRes"></div>
      <div id="jsTreeBox"></div></div>`;
    const ta = api.$('#jsIn'), gut = api.$('#jsGut');
    ta.value = S.jsonDraft || '';
    const lines = () => { const n = ta.value.split('\n').length; gut.innerHTML = Array.from({ length: n }, (_, k) => `<div>${k + 1}</div>`).join(''); gut.scrollTop = ta.scrollTop; };
    ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; });
    let saveT = 0;
    ta.addEventListener('input', () => { lines(); clearTimeout(saveT); saveT = setTimeout(() => { S.jsonDraft = ta.value.length < 200000 ? ta.value : ''; api.save(); }, 500); api.$('#jsRes').innerHTML = ''; });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); check(); }
      else if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); lines(); }
    });
    const ind = () => { const v = api.$('#jsInd').value; return v === 't' ? '\t' : ' '.repeat(+v); };
    const goTo = pos => { ta.focus(); ta.setSelectionRange(pos, Math.min(pos + 1, ta.value.length)); const { line } = posToLC(ta.value, pos); ta.scrollTop = Math.max(0, (line - 4) * parseFloat(getComputedStyle(ta).lineHeight)); };
    function check(quiet) {
      const src = ta.value; const res = api.$('#jsRes'); api.$('#jsTreeBox').innerHTML = '';
      if (!src.trim()) { res.innerHTML = '<div class="js-r neutral">Вставьте JSON для проверки.</div>'; return null; }
      try {
        const r = parseStrict(src); const st = stats(r.root);
        const type = { o: 'объект', a: 'массив', s: 'строка', n: 'число', b: 'логическое значение', z: 'null' }[r.root.t];
        res.innerHTML = `<div class="js-r ok"><b>✓ Корректный JSON</b><span>корень — ${type} · ключей ${st.keys} · узлов ${st.nodes} · глубина ${st.depth} · ${new Blob([src]).size.toLocaleString('ru-RU')} байт</span></div>` +
          (r.warns.length ? `<div class="js-r warn"><b>Предупреждения (${r.warns.length})</b>${r.warns.slice(0, 20).map(w => { const p = posToLC(src, w.pos); return `<a href="javascript:void 0" data-pos="${w.pos}">Строка ${p.line}, столбец ${p.col}: ${esc(w.msg)}</a>`; }).join('')}</div>` : '');
        api.$$('[data-pos]', res).forEach(x => x.onclick = () => goTo(+x.dataset.pos));
        if (!quiet || st.nodes < 5000) showTree(r.root);
        return r;
      } catch (e) {
        if (e.pos === undefined) { res.innerHTML = `<div class="js-r bad"><b>✗ Ошибка</b><span>${esc(e.message)}</span></div>`; return null; }
        const p = posToLC(src, e.pos);
        res.innerHTML = `<div class="js-r bad"><b>✗ Строка ${p.line}, столбец ${p.col}: ${esc(e.message)}</b><div class="jf">${frame(src, e.pos)}</div><div class="js-act"><button class="chip" id="jsGo">Перейти к ошибке</button><button class="chip" id="jsFix2">🩹 Попробовать исправить</button></div></div>`;
        api.$('#jsGo').onclick = () => goTo(e.pos); api.$('#jsFix2').onclick = fix;
        return null;
      }
    }
    function showTree(root) {
      const box = api.$('#jsTreeBox');
      box.innerHTML = `<div class="tool-h" style="margin-top:16px"><b>Дерево</b><span class="muted">клик по значению или ⧉ — скопировать путь JSON Pointer</span><span class="sp"></span><button class="chip" id="jsExpand">Развернуть всё</button></div><div class="js-tree mono">${treeHTML(root, '', null, true)}</div>`;
      api.$('#jsExpand').onclick = () => api.$$('.js-tree details').forEach(d => d.open = true);
      api.$$('.js-tree [data-ptr]').forEach(el => el.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); const ptr = el.dataset.ptr || '/'; copy(ptr); api.toast('Путь скопирован: ' + ptr); }));
    }
    const transform = f => { const r = check(true); if (!r) return; ta.value = f(r.root); lines(); S.jsonDraft = ta.value; api.save(); check(true); };
    api.$('#jsCheck').onclick = () => check();
    api.$('#jsFmt').onclick = () => transform(root => serialize(root, ind()));
    api.$('#jsMin').onclick = () => transform(root => serialize(root, ''));
    api.$('#jsSort').onclick = () => transform(root => serialize(root, ind(), 0, true));
    function fix() {
      const before = ta.value; const fixed = repair(before);
      try { const r = parseStrict(fixed); ta.value = serialize(r.root, ind()); lines(); check(); api.toast(fixed === before ? 'Исправлять нечего' : 'Исправлено и отформатировано'); }
      catch (e) { ta.value = fixed; lines(); check(); api.toast('Часть ошибок исправлена, остальное — вручную'); }
      S.jsonDraft = ta.value; api.save();
    }
    api.$('#jsFix').onclick = fix;
    api.$('#jsSample').onclick = () => { ta.value = SAMPLE_JSON; lines(); check(); };
    api.$('#jsBroken').onclick = () => { ta.value = BROKEN_JSON; lines(); check(); };
    api.$('#jsCopy').onclick = () => ta.value && copy(ta.value);
    api.$('#jsClear').onclick = () => { ta.value = ''; lines(); S.jsonDraft = ''; api.save(); api.$('#jsRes').innerHTML = ''; api.$('#jsTreeBox').innerHTML = ''; };
    lines(); if (ta.value.trim()) check(true);
  }

  function page(a, m) {
    api = a;
    const kind = m[1];
    if (kind === 'json') pageJson(); else pageJwt(m[2]);
    document.querySelector('.main').scrollTop = 0;
  }
  // для тестов
  window.VIBE_TOOLS = { parseStrict, repair, serialize, parseJwt, sign, verify, ALG, sha256, hmac256, bytesToB64u, strToB64u };
  (window.APP_EXT = window.APP_EXT || []).push({
    id: 'tools', href: '#/jwt', ico: '🧰', t: 'JWT, JSON', long: 'Инструменты: JWT и JSON', desc: 'разбор и создание JWT, проверка и форматирование JSON', trainer: false,
    re: /^#\/(jwt|json)(?:\/(create))?$/, page,
  });
})();
