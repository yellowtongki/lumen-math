#!/usr/bin/env node
/* 학원앱 v19-182 검사 — 🔑 서버 열쇠 칸 · 비밀 값은 이 기기에만
 *   외부망 전부 차단 · window.supabase.createClient 를 가짜로 바꿔 «머리글로 원장을 알아보는» 서버를 흉내 낸다(실서버 쓰기 없음)
 *   ① 비밀 이름·규칙(lumenIsSecretKey) ② scheduleSync·supaSetItem 이 비밀 값을 안 올림 · 보통 키는 올림
 *   ③ PULL_SKIP_KEYS · safePullSetItem 받기 막기 ④ 주소 #dbkey= 로 열쇠가 안 들어감(주소에서는 지움)
 *   ⑤ 설정 화면 「🔑 서버 열쇠」 칸 · 지문 ⑥ 새 열쇠 43글자 · 한 번만 보이는 창 · 서버로 안 감
 *   ⑦ 서버 등록 한 줄 = sha256 해시(열쇠 글자 없음) ⑧ 붙여넣기 검사 ⑨ 열쇠 시험: 서버가 아는 열쇠 ✅ / 모르는 열쇠 ❌
 *   ⑩ 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19182.js lumen_v19-182.html */
const { chromium } = require('playwright');
const path = require('path');
const crypto = require('crypto');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-182.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1300, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.addInitScript(() => {
    window.__W = []; window.__ROWS = {}; window.__ACCEPT = null; window.__HDRS = [];
    window.__fakeCreate = function(url, key, opt){
      const hdr = (opt && opt.global && opt.global.headers) || {};
      window.__HDRS.push(hdr['x-lumen-teacher'] ? 'set' : 'none');
      const teacher = () => !!(window.__ACCEPT && hdr['x-lumen-teacher'] === window.__ACCEPT);
      const mk = (tbl) => { const b = { f: null, op: 'select', select() { return b; }, eq(k, v) { b.f = v; return b; }, in() { return b; }, like() { return b; }, not() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, gt() { return b; }, lt() { return b; }, lte() { return b; }, neq() { return b; }, is() { return b; }, or() { return b; }, ilike() { return b; }, filter() { return b; }, match() { return b; }, single() { return b; }, maybeSingle() { return b; },
        insert() { return Promise.resolve({ error: null }); }, update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; },
        upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { window.__W.push(r.key); if (tbl === 'lumen_store') window.__ROWS[r.key] = r.value; }); return Promise.resolve({ error: null }); },
        then(res, rej) { let data = [];
          if (b.op === 'd') { if (teacher() && b.f != null) delete window.__ROWS[b.f]; }
          else if (b.op === 'select' && tbl === 'lumen_store' && b.f != null) data = (b.f in window.__ROWS) ? [{ key: b.f, value: window.__ROWS[b.f] }] : [];
          return Promise.resolve({ data, error: null }).then(res, rej); } }; return b; };
      return { from: mk, rpc: () => Promise.resolve({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, storage: { from: () => ({ upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } };
    };
  });
  await pg.goto('file://' + FILE + '#dbkey=OLDKEY_from_url_1234567890', { waitUntil: 'load' });
  await pg.waitForTimeout(2500);

  /* ④ 주소로 열쇠 넣기 없앰 */
  const urlRes = await pg.evaluate(() => ({ ls: localStorage.getItem('lumen_db_key'), hash: location.hash }));
  t('④ 주소 #dbkey= 로는 열쇠가 저장되지 않음 · 주소에서는 지움', urlRes.ls === null && !/dbkey/.test(urlRes.hash), JSON.stringify(urlRes));

  /* 가짜 서버 심기 */
  await pg.evaluate(() => { const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none'; window.supabase = { createClient: window.__fakeCreate }; try { _supaClient = null; } catch (e) {} window.__W.length = 0; });

  /* ① 이름·규칙 */
  const sec = await pg.evaluate(() => ['lumen_db_key', 'or_api_key', 'or_gemini_key', 'or_nb_key', 'or_mf_id', 'or_mf_pw', 'or_gh_token', 'mf_token', 'x_secret', 'abc_key', 'ma_pw', 'or_studentdb', 'lumen_pw_hash', 'rc_ws_rule', 'hw_teach_AAA111'].map((k) => k + ':' + (lumenIsSecretKey(k) ? 1 : 0)).join(' '));
  t('① 비밀 이름·규칙 — 열쇠·토큰·비번은 막고, 화면 폭 ma_pw·등록부·잠금 해시·보통 키는 그대로', sec === 'lumen_db_key:1 or_api_key:1 or_gemini_key:1 or_nb_key:1 or_mf_id:1 or_mf_pw:1 or_gh_token:1 mf_token:1 x_secret:1 abc_key:1 ma_pw:0 or_studentdb:0 lumen_pw_hash:0 rc_ws_rule:0 hw_teach_AAA111:0', sec);

  /* ② 올리기 막기 */
  await pg.evaluate(async () => { await supaSetItem('or_mf_pw', 'x'); await supaSetItem('abc_token', 'x'); await supaSetItem('rc_test_plain', { a: 1 }); localStorage.setItem('or_gh_token', 'zzz'); localStorage.setItem('lumen_db_key', 'k'.repeat(43)); localStorage.setItem('rc_test_plain2', '{"b":2}'); });
  await pg.waitForTimeout(2600);
  const W = await pg.evaluate(() => window.__W.slice());
  t('② 비밀 값은 서버로 안 감(직접 올리기·자동 동기화 모두)', !W.some((k) => /or_mf_pw|abc_token|or_gh_token|lumen_db_key/.test(k)), JSON.stringify(W));
  t('② 보통 키는 그대로 올라감', W.indexOf('rc_test_plain') >= 0 && W.indexOf('rc_test_plain2') >= 0, JSON.stringify(W));

  /* ③ 받기 막기 */
  const pull = await pg.evaluate(() => { const r = safePullSetItem('or_api_key', 'FROM_SERVER'); return { skip: ['lumen_db_key', 'or_api_key', 'or_mf_pw', 'mf_token', '_dbk_test'].every((k) => PULL_SKIP_KEYS.indexOf(k) >= 0), api: localStorage.getItem('or_api_key'), r }; });
  t('③ 시작 다운로드에서 비밀 줄 뺌 · 서버 값이 이 기기 비밀 값을 덮지 않음', pull.skip && pull.api !== 'FROM_SERVER', JSON.stringify(pull));

  /* ⑤ 설정 칸 */
  await pg.evaluate(() => { localStorage.removeItem('lumen_db_key'); VIEW = 'settings'; render(); });
  await pg.waitForTimeout(300);
  const box0 = await pg.evaluate(() => { const b = document.getElementById('dbk-box'); const api = Array.from(document.querySelectorAll('.st')).find((e) => /API 키 설정/.test(e.textContent)); return { box: !!b, before: !!(b && api && (b.compareDocumentPosition(api) & Node.DOCUMENT_POSITION_FOLLOWING)), txt: b ? b.textContent : '', sqlDis: !!(document.getElementById('dbk-sql') || {}).disabled }; });
  t('⑤ 설정에 「🔑 서버 열쇠」 칸 — API 키 설정 위 · 열쇠 없으면 「없음」 · 등록 한 줄 단추 잠김', box0.box && box0.before && /없음/.test(box0.txt) && box0.sqlDis, JSON.stringify(box0).slice(0, 200));

  /* ⑥ 새 열쇠 */
  await pg.evaluate(() => { window.__W.length = 0; dbkNew(); });
  await pg.waitForTimeout(300);
  const nk = await pg.evaluate(() => { const k = localStorage.getItem('lumen_db_key'); const once = document.getElementById('dbk-once'); const v = (document.getElementById('dbk-once-k') || {}).value; return { len: (k || '').length, ok: /^[A-Za-z0-9_\-]{43}$/.test(k || ''), once: !!once, same: v === k, k }; });
  t('⑥ 새 열쇠 43글자(영문·숫자·-·_) · 이 기기에 저장 · 한 번만 보이는 창에 같은 값', nk.ok && nk.once && nk.same, JSON.stringify({ len: nk.len, once: nk.once, same: nk.same }));
  /* 두 번 만들면 다른 열쇠 */
  const k2 = await pg.evaluate(() => { document.getElementById('dbk-once').remove(); dbkNew(); const k = localStorage.getItem('lumen_db_key'); return k; });
  t('⑥ 다시 만들면 다른 열쇠(무작위)', k2 && k2 !== nk.k, '');
  await pg.waitForTimeout(1800);
  t('⑥ 새 열쇠는 서버로 안 감', !(await pg.evaluate(() => window.__W.indexOf('lumen_db_key') >= 0)), '');

  /* ⑦ 서버 등록 한 줄 */
  const line = await pg.evaluate(async () => dbkSqlLine(localStorage.getItem('lumen_db_key')));
  const want = crypto.createHash('sha256').update(k2).digest('hex');
  t('⑦ 서버 등록 한 줄 = sha256 해시 · 열쇠 글자는 없음', line.indexOf(want) >= 0 && line.indexOf(k2) < 0 && /insert into private\.teacher_key/.test(line) && /'main'/.test(line), line.slice(0, 90));
  /* 닫기 → 칸에 지문 */
  await pg.evaluate(() => document.getElementById('dbk-once-close').click());
  await pg.waitForTimeout(400);
  const fp = await pg.evaluate(() => (document.getElementById('dbk-fp') || {}).textContent);
  t('⑤ 닫으면 창이 사라지고 칸에 지문 6글자(해시 앞)', fp === want.slice(0, 6) && !(await pg.evaluate(() => !!document.getElementById('dbk-once'))), fp);

  /* ⑨ 열쇠 시험 */
  await pg.evaluate(() => { window.__ACCEPT = null; });
  await pg.evaluate(() => dbkTest()); await pg.waitForTimeout(200);
  const m1 = await pg.evaluate(() => DBK.msg);
  t('⑨ 서버가 모르는 열쇠 → ❌ 안내', /❌/.test(m1), m1);
  await pg.evaluate((k) => { window.__ACCEPT = k; }, k2);
  await pg.evaluate(() => dbkTest()); await pg.waitForTimeout(200);
  const m2 = await pg.evaluate(() => DBK.msg);
  t('⑨ 서버가 아는 열쇠 → ✅ (시험 줄 넣고 지워짐)', /✅/.test(m2) && !(await pg.evaluate(() => '_dbk_test' in window.__ROWS)), m2);
  t('⑨ 열쇠를 바꾸면 서버 연결을 새로 만들어 머리글에 새 열쇠', (await pg.evaluate(() => window.__HDRS.slice(-1)[0])) === 'set', '');

  /* ⑧ 붙여넣기 */
  await pg.evaluate(() => { render(); });
  await pg.waitForTimeout(200);
  await pg.fill('#dbk-paste', 'short-1'); await pg.click('#dbk-paste-save');
  const p1 = await pg.evaluate(() => ({ k: localStorage.getItem('lumen_db_key'), m: DBK.msg }));
  t('⑧ 짧은·이상한 값은 거절(이 기기 열쇠 그대로)', p1.k === k2 && /⚠/.test(p1.m), p1.m);
  const k3 = 'Abc_def-' + 'x'.repeat(40);
  await pg.fill('#dbk-paste', k3); await pg.click('#dbk-paste-save'); await pg.waitForTimeout(300);
  const p2 = await pg.evaluate(() => ({ k: localStorage.getItem('lumen_db_key'), m: DBK.msg, v: (document.getElementById('dbk-paste') || {}).value }));
  t('⑧ 올바른 값은 저장 · 칸은 비움', p2.k === k3 && /✅/.test(p2.m) && !p2.v, p2.m);

  t('⑩ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
