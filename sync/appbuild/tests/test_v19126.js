#!/usr/bin/env node
/* 학원앱 v19-126 검사 — 네이버 예약: 네이버 로고 · «예약 열쇠»(or_nb_key)
 *   가짜 서버(lumen_store 흉내, 쓰기를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○) · 가짜 예약자·전화(지어낸 값) · 가짜 열쇠
 *   ① 로고: 메뉴 칸(수업·출결 › 네이버 예약) · 화면 제목 · 홈 「오늘 네이버 예약」 — 초록 #03C75A 네모 + 흰 N(SVG) · 다른 메뉴 아이콘과 같은 크기 · 📅 없음
 *   ② 예약 열쇠로 잠근 상자(kk:'pii' · kid) — 이 기기에 서버 잠금 열쇠만 있으면 「🔑 예약 열쇠를 넣으면」 + 넣는 칸
 *      다른 열쇠 → 「열쇠가 달라요」(지문 다름) · 맞는 열쇠 → 띠 사라지고 줄마다 예약자 이름 · 📞 전화(tel:) · 메모
 *   ③ 열쇠는 이 브라우저 localStorage or_nb_key 에만 — 서버 쓰기 없음(앱의 setItem 길로 넣어도) · HTS_LOCAL_ONLY · 시작 다운로드 제외 · 비상 비우기 KEEP
 *   ④ 수집기에 열쇠가 없을 때(상자 없음) → NAVER_PII_KEY 넣는 방법(20글자 · Settings → Secrets → Actions) + 넣는 칸
 *   ⑤ 예전 상자(서버 잠금 열쇠 kk:'teacher')도 lumen_db_key 로 열림
 *   ⑥ 주소 #nbkey=… 한 번 → 저장 · 주소에서 지움 (#dbkey 와 함께여도 둘 다)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19126.js lumen_v19-126.html
 *   그림: $SP/v19126.png (열린 상자 · 가짜 이름만) · $SP/v19126_key.png (열쇠 넣는 띠) */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-126.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-126'])[0];
const MOD = path.join(__dirname, '..', 'modules', 'naverbook126_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', group: 'M3', lumen_rec_code: 'AAA111', parentPhone: '', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 2학년', group: 'M2', lumen_rec_code: 'AAA222', parentPhone: '', lumen_planner: {} }];
const DBKEY = 'TESTDBKEY_fake_1234';                       /* 서버 잠금 열쇠(가짜) */
const PK = 'fake booking passphrase 2026 test';           /* 예약 열쇠(가짜) */
const WRONG = 'another wrong passphrase xx';

async function harness(pg) {
  await pg.evaluate(({ STUDENTS, DBKEY }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], allW: [], toasts: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, op: 'select', eqv: [], lim: 1e9,
        select() { return b; }, eq(k, v) { b.eqv.push(v); b.f.push((x) => String(x[k]) === String(v)); return b; },
        in(k, a) { const s = a.map(String); b.f.push((x) => s.indexOf(String(x[k])) >= 0); return b; },
        gte() { return b; }, lte() { return b; }, not() { return b; }, like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => String(x[k]).indexOf(pre) === 0); return b; },
        or() { return b; }, order() { return b; }, limit(n) { b.lim = n; return b; }, range() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.w.push({ op: 'put', tbl, key: r.key }); T.allW.push(r.key + '=' + JSON.stringify(r.value)); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) {
          if (b.op !== 'select') { T.w.push({ op: b.op, tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          let rows = tbl === 'lumen_store' ? Object.keys(T.store).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' })) : [];
          rows = rows.filter((x) => b.f.every((fn) => fn(x))).slice(0, b.lim);
          return Promise.resolve({ data: b.one ? (rows[0] || null) : rows, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('ALERT ' + m); };
    T.stu = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); };
    T.stu();
    _origSetItem('lumen_db_key', DBKEY);
    /* 수집기와 같은 모양 — 상자는 페이지 안에서 nbSeal 로 잠그고 kk · kid 를 적는다 */
    T.make = async (opt) => {
      opt = opt || {};
      const today = nbTodayKst(), D = (n) => nbAddDays(today, n);
      const it = (id, name) => ({ id: String(id), name, kind: nbKindOf(name, id) });
      const REC = it(7380213, '리커버리 클래스(재원생)'), TT = it(7170543, '텐투텐 신청 (재원생용)'), CS = it(6773412, '루멘수학 테스트&상담'), TLP = it(7401437, 'TLP 학습심리분석 상담(재원생)');
      const st = (k) => ({ confirmed: { code: 'RC03', k: 'confirmed', label: '확정' }, requested: { code: 'RC02', k: 'requested', label: '신청(확정 대기)' } }[k]);
      const B = [], P = {}; let n = 7000;
      const add = (item, date, start, end, status, match, pii) => { const id = String(++n); B.push({ id, item, status: st(status), date, start, end, count: 1, reg: '', confirmed: '', completed: '', cancelled: '', match: match || null }); P[id] = Object.assign({ booker: '가짜예약자' + n, phone: '010-9000-' + String(n).slice(-4), msg: '', form: [] }, pii || {}); return id; };
      T.ids = {
        a: add(CS, today, '10:00', '11:00', 'confirmed', null, { msg: '가짜메모 상담 원해요', form: [{ q: '학년', a: '중1' }] }),
        b: add(TLP, today, '16:00', '17:00', 'requested', { stKey: 'S1', code: 'AAA111', how: 'phone' }),
        c: add(REC, today, '18:00', '19:00', 'confirmed', null, { msg: '가짜메모 보강' }),
        d: add(TT, D(1), '18:00', '22:00', 'confirmed', null),
        e: add(CS, D(2), '11:00', '', 'confirmed', null) };
      const at = new Date(Date.now() - 5 * 60000).toISOString();
      const key = opt.key || '', kk = opt.kk || 'pii';
      let box = null;
      if (key) { box = await nbSeal({ at, byId: P }, key); box.at = at; box.n = B.length; box.kk = kk; }
      const data = { at, ok: true, v: 1, bizId: '1419039', today, items: [REC, TT, CS, TLP], bookings: B, counts: { inWindow: B.length }, pii: box ? { enc: true, n: B.length, kid: box.kid, kk } : { enc: false, n: 0 } };
      T.store = { naver_bookings: data, naver_bookings_status: { at, ok: true, n: B.length, lastOkAt: at }, naver_booking_links: {} };
      if (box) T.store.naver_bookings_pii = box;
      T.w = []; T.toasts = [];
      NBK.loaded = false; NBK.at = 0; NBK.edit = {}; NBK.kind = 'all';
      await nbkLoad(true);
      return { kid: box ? box.kid : '' };
    };
  }, { STUDENTS, DBKEY });
}

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await harness(pg);
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const show = async (v) => { await pg.evaluate((v) => { T.stu(); VIEW = v; render(); }, v); await settle(400); };
  const bans = () => pg.evaluate(() => [...document.querySelectorAll('[data-nbk-ban]')].map((x) => ({ k: x.dataset.nbkBan, p: x.dataset.nbkPii || '', text: x.innerText, input: !!x.querySelector('#nbkKeyIn') })));
  const rowsInfo = () => pg.evaluate(() => [...document.querySelectorAll('#CONTENT .nbk-row')].filter((r) => r.offsetParent !== null && !r.closest('details:not([open])')).map((r) => ({ id: r.dataset.nbkRow, text: r.innerText, tel: (r.querySelector('.nbk-tel') || {}).href || '' })));
  const typeKey = async (k) => { await pg.fill('#nbkKeyIn', k); await pg.click('.nbk-ksave'); await settle(500); };

  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  const K0 = await pg.evaluate(() => T.make({ key: 'fake booking passphrase 2026 test' }));
  t('가짜 상자: kid = 예약 열쇠 지문(8글자)', /^[0-9a-f]{8}$/.test(K0.kid) && K0.kid === (await pg.evaluate((k) => nbKid(k), PK)) && K0.kid !== (await pg.evaluate((k) => nbKid(k), DBKEY)));

  /* ① 로고 */
  await pg.evaluate(() => { const g = GROUPS.find((x) => x.key === 'class'); subGo('class', g.subs.findIndex((s) => s.v === 'naverbk')); }); await settle(500);
  const LG = await pg.evaluate(() => {
    const sub = GROUPS.find((x) => x.key === 'class').subs.find((s) => s.v === 'naverbk');
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 && el.offsetParent !== null }; };
    const menuSvgs = [...document.querySelectorAll('#SUBTAB_BAR .stab .si svg.nbk-logo, .lsub-i .ic svg.nbk-logo')];
    const vis = menuSvgs.filter((s) => s.getBoundingClientRect().width > 0);
    const other = [...document.querySelectorAll('#SUBTAB_BAR .stab .si, .lsub-i .ic')].filter((x) => !x.querySelector('svg') && x.getBoundingClientRect().width > 0)[0];
    const ttl = document.querySelector('#CONTENT .nbk-ttl');
    const svg = vis[0];
    return { icon: sub.icon, label: sub.label, nMenu: vis.length, size: box(svg), other: box(other),
      fill: svg ? svg.querySelector('rect').getAttribute('fill') : '', n: svg ? svg.querySelector('path').getAttribute('fill') : '',
      menuEmoji: menuSvgs.some((s) => (s.parentElement.textContent || '').indexOf('📅') >= 0),
      ttl: ttl ? { svg: !!ttl.querySelector('svg.nbk-logo'), text: ttl.textContent, size: box(ttl.querySelector('svg')) } : null };
  });
  t('메뉴 칸 아이콘 = 네이버 로고 SVG (초록 #03C75A 네모 + 흰 N) · 라벨 그대로', /^<svg class="nbk-logo"/.test(LG.icon) && LG.label === '네이버 예약' && LG.nMenu >= 1 && LG.fill === '#03C75A' && LG.n === '#fff' && !LG.menuEmoji, JSON.stringify(LG));
  t('메뉴 로고 크기: 12~22px 정사각 · 다른 메뉴 아이콘과 비슷', LG.size && LG.size.w >= 12 && LG.size.w <= 22 && LG.size.w === LG.size.h && (!LG.other || Math.abs(LG.other.h - LG.size.h) <= 8), JSON.stringify({ s: LG.size, o: LG.other }));
  const LH = await pg.evaluate(() => { const h = [...document.querySelectorAll('.l3-vhead')].filter((x) => x.getBoundingClientRect().width > 0)[0]; return { head: h ? { svg: !!h.querySelector('b svg.nbk-logo'), text: h.innerText } : null, raw: document.body.innerText.indexOf('<svg') >= 0 || document.body.innerText.indexOf('#03C75A') >= 0, t: l3ViewTitle('naverbk') }; });
  t('왼쪽 머리(3분할): 로고 + 「네이버 예약」 · 화면 어디에도 SVG 글자가 그대로 보이지 않음', LH.head && LH.head.svg && /네이버 예약/.test(LH.head.text) && !LH.raw && LH.t.name === '네이버 예약', JSON.stringify(LH));
  t('화면 제목: 로고 + 「네이버 예약」 · 📅 없음', LG.ttl && LG.ttl.svg && LG.ttl.text.trim() === '네이버 예약' && LG.ttl.size.w >= 14 && LG.ttl.size.w <= 30, JSON.stringify(LG.ttl));
  await show('home');
  const HM = await pg.evaluate(() => { const c = document.querySelector('[data-nbk-home] .nbk-hh'); return c ? { svg: !!c.querySelector('svg.nbk-logo'), text: c.innerText, w: Math.round(c.querySelector('svg').getBoundingClientRect().width) } : null; });
  t('홈 「오늘 네이버 예약」: 로고 · 📅 없음', HM && HM.svg && /오늘 네이버 예약 \d+건/.test(HM.text) && HM.text.indexOf('📅') < 0 && HM.w >= 10 && HM.w <= 22, JSON.stringify(HM));

  /* ② 예약 열쇠 상자 · 이 기기에는 서버 잠금 열쇠뿐 */
  await show('naverbk');
  let B = await bans(), R = await rowsInfo();
  t('예약 열쇠 상자 + 서버 잠금 열쇠뿐 → 「🔑 예약 열쇠를 넣으면」 띠 + 넣는 칸 · 이름 🔒', B.length === 1 && B[0].p === 'nokey-device' && /예약 열쇠를 넣으면/.test(B[0].text) && B[0].input && R.every((r) => /예약자 🔒/.test(r.text) && !r.tel), JSON.stringify(B));
  await typeKey(WRONG);
  B = await bans();
  const S1 = await pg.evaluate(() => ({ ls: localStorage.getItem('or_nb_key'), mine: NBK.kidMine, box: NBK.box.kid, err: NBK.piiErr, val: (document.getElementById('nbkKeyIn') || {}).value }));
  t('다른 열쇠 저장 → or_nb_key 에 저장 · 지문 다름 → 「🔑 열쇠가 달라요」 + 다시 넣는 칸', S1.ls === WRONG && S1.mine && S1.mine !== S1.box && S1.err === 'badkey' && B.length === 1 && B[0].p === 'badkey' && /열쇠가 달라요/.test(B[0].text) && B[0].input, JSON.stringify({ S1, B }));
  t('「열쇠가 달라요」 안내: NAVER_PII_KEY 와 똑같이 · 「지금 저장된 열쇠 있음」 · 지우기', /NAVER_PII_KEY/.test(B[0].text) && /똑같이/.test(B[0].text) && /저장된 열쇠 있음/.test(B[0].text) && (await pg.evaluate(() => !!document.querySelector('.nbk-kdel'))));
  await typeKey(PK);
  B = await bans(); R = await rowsInfo();
  const ids = await pg.evaluate(() => T.ids);
  const ra = R.find((r) => r.id === ids.a), rb = R.find((r) => r.id === ids.b);
  t('맞는 열쇠 → 이름·전화 띠 사라짐 (띠 0개)', B.length === 0, JSON.stringify(B));
  t('줄: 예약자 이름 · 📞 전화(tel:숫자) · 메모 · 추가 답', ra && /가짜예약자7001/.test(ra.text) && /^tel:01090007001$/.test(ra.tel) && /가짜메모 상담 원해요/.test(ra.text) && /학년: 중1/.test(ra.text), JSON.stringify(ra));
  t('연결된 학생 줄도 예약자 이름 + 학생 칸', rb && /가짜예약자7002/.test(rb.text) && /○○○1/.test(rb.text), JSON.stringify(rb));
  t('넣은 칸은 비워지고 화면 어디에도 열쇠 글이 없음', await pg.evaluate((k) => document.body.innerHTML.indexOf(k) < 0 && !document.getElementById('nbkKeyIn'), PK));
  t('열린 열쇠 = 예약 열쇠(or_nb_key)', (await pg.evaluate(() => NBK.piiSrc)) === 'nb');
  await pg.evaluate(() => { const c = document.getElementById('CONTENT'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); });
  await pg.screenshot({ path: path.join(SP, 'v19126.png'), fullPage: false });
  await show('home');
  const HR = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-home] .nbk-hrow')].map((r) => r.innerText.replace(/\s+/g, ' ')));
  t('홈 줄: 못 맞춘 예약은 예약자 이름(가짜예약자…)', HR.some((r) => /^10:00 상담 가짜예약자7001/.test(r)), JSON.stringify(HR));

  /* ③ 서버로 안 올림 */
  await pg.evaluate((k) => { localStorage.setItem('or_nb_key', k); scheduleSync('or_nb_key'); }, PK);   /* 일부러 앱의 저장 길로 */
  await settle(2200);
  const SY = await pg.evaluate((k) => ({ w: T.allW.filter((x) => x.indexOf('or_nb_key') >= 0 || x.indexOf(k) >= 0), lo: !!HTS_LOCAL_ONLY.or_nb_key, pull: PULL_SKIP_KEYS.indexOf('or_nb_key') >= 0, ls: localStorage.getItem('or_nb_key') === k }), PK);
  t('예약 열쇠는 서버로 안 올라감 (localStorage.setItem · scheduleSync 길로도) · 이 브라우저에는 그대로', SY.w.length === 0 && SY.ls, JSON.stringify(SY));
  t('제외 목록: HTS_LOCAL_ONLY · 시작 다운로드 PULL_SKIP_KEYS (lumen_db_key 와 같이)', SY.lo && SY.pull && (await pg.evaluate(() => PULL_SKIP_KEYS.indexOf('lumen_db_key') >= 0 && !!HTS_LOCAL_ONLY.or_gh_token)));
  const html = fs.readFileSync(FILE, 'utf8');
  t('비상 비우기(lumenPanicClear)에서도 남김 (KEEP 에 or_nb_key)', /var KEEP = \{[^}]*lumen_db_key:1, or_nb_key:1/.test(html));
  t('서버 쓰기 전체에 열쇠 글 없음', await pg.evaluate((ks) => T.allW.every((x) => ks.every((k) => x.indexOf(k) < 0)), [PK, WRONG]));

  /* 지우기 → 다시 잠김 */
  await show('naverbk');
  await pg.evaluate(() => nbkKeyForget()); await settle(400);
  t('「지우기」 → or_nb_key 없어지고 다시 「예약 열쇠를 넣으면」', (await pg.evaluate(() => localStorage.getItem('or_nb_key'))) === null && (await bans()).some((b) => b.p === 'nokey-device'));
  t('짧은 열쇠(8글자 미만)는 저장 안 함', await pg.evaluate(async () => { document.getElementById('nbkKeyIn').value = 'abc'; await nbkKeySave(); return localStorage.getItem('or_nb_key') === null && /짧아요/.test(T.toasts.slice(-1)[0] || ''); }));

  /* ④ 수집기에 열쇠 없음 (상자 없음) */
  await pg.evaluate(() => T.make({})); await show('naverbk');
  B = await bans(); R = await rowsInfo();
  t('상자 없음 → 「아직 저장되지 않아요」 + NAVER_PII_KEY · 20글자 · Settings → Secrets → Actions · 넣는 칸', B.length === 1 && B[0].p === 'nokey-server' && /아직 저장되지 않아요/.test(B[0].text) && /NAVER_PII_KEY/.test(B[0].text) && /20글자/.test(B[0].text) && /Settings/.test(B[0].text) && /Secrets and variables/.test(B[0].text) && /Actions/.test(B[0].text) && /New repository secret/.test(B[0].text) && B[0].input, B[0] && B[0].text);
  await pg.screenshot({ path: path.join(SP, 'v19126_key.png'), fullPage: false });
  t('상자 없어도 목록(시간·상품·학생 연결)은 보임', R.length >= 3 && R.every((r) => /예약자 🔒/.test(r.text)));
  await typeKey(PK);
  B = await bans();
  t('상자 없을 때 열쇠를 미리 넣어 두면 → 저장 · 「지금 저장된 열쇠 있음」 (띠는 그대로)', (await pg.evaluate(() => localStorage.getItem('or_nb_key'))) === PK && B.length === 1 && B[0].p === 'nokey-server' && /저장된 열쇠 있음/.test(B[0].text), JSON.stringify(B));
  await pg.evaluate(() => T.make({ key: 'fake booking passphrase 2026 test' })); await show('naverbk');
  t('그 뒤 수집기가 같은 열쇠로 잠그면 바로 열림', (await bans()).length === 0 && (await rowsInfo()).some((r) => /가짜예약자/.test(r.text)));

  /* ⑤ 예전 상자(서버 잠금 열쇠) — or_nb_key 가 달라도 lumen_db_key 로 */
  await pg.evaluate((k) => T.make({ key: k, kk: 'teacher' }), DBKEY); await show('naverbk');
  t('예전 상자(kk teacher)는 lumen_db_key 로 열림 (예약 열쇠가 따로 있어도)', (await bans()).length === 0 && (await pg.evaluate(() => NBK.piiSrc)) === 'db');
  await pg.evaluate(() => { localStorage.removeItem('or_nb_key'); localStorage.setItem('lumen_db_key', 'WRONG_DB_KEY_xx'); });
  await pg.evaluate((k) => T.make({ key: k, kk: 'teacher' }), DBKEY); await show('naverbk');
  B = await bans();
  t('예전 상자 + 서버 잠금 열쇠가 다름 → 「열쇠가 달라요」 + LUMEN_TEACHER_KEY 설명', B.length === 1 && B[0].p === 'badkey' && /열쇠가 달라요/.test(B[0].text) && /LUMEN_TEACHER_KEY/.test(B[0].text), JSON.stringify(B));
  await pg.evaluate((k) => _origSetItem('lumen_db_key', k), DBKEY);

  /* 폰 폭: 넣는 칸이 있어도 가로로 안 넘침 */
  await pg.evaluate(() => T.make({ key: 'fake booking passphrase 2026 test' }));
  await pg.setViewportSize({ width: 390, height: 800 }); await show('naverbk');
  const ov = await pg.evaluate(() => { const w = document.querySelector('.nbk-wrap'); return w && !!document.getElementById('nbkKeyIn') ? w.scrollWidth <= w.clientWidth + 2 : null; });
  t('폰 폭(390): 열쇠 칸 있는 띠도 가로로 안 넘침', ov === true, String(ov));
  await pg.setViewportSize({ width: 1400, height: 950 });

  /* ⑥ 주소 #nbkey=… (새 탭 — 같은 file:// 저장소) */
  await pg.evaluate(() => { localStorage.removeItem('or_nb_key'); });
  const p2 = await ctx.newPage(); const dl = [];
  p2.on('dialog', (d) => { dl.push(d.message()); d.accept(); }); p2.on('pageerror', (e) => errs.push('p2 ' + e.message));
  await p2.route(/^https?:\/\//, (r) => r.abort());
  await p2.goto('file://' + FILE + '#nbkey=' + encodeURIComponent(PK), { waitUntil: 'load' }); await p2.waitForTimeout(1800);
  const H1 = await p2.evaluate(() => ({ ls: localStorage.getItem('or_nb_key'), hash: location.hash, href: location.href }));
  t('#nbkey=(띄어쓰기 든 암호문) → or_nb_key 저장 · 주소에서 지움 · 안내', H1.ls === PK && H1.hash.indexOf('nbkey') < 0 && H1.href.indexOf('passphrase') < 0 && dl.some((m) => /예약 열쇠/.test(m)), JSON.stringify({ hash: H1.hash, ok: H1.ls === PK, dl }));
  await p2.close();
  await pg.evaluate(() => { localStorage.removeItem('or_nb_key'); localStorage.removeItem('lumen_db_key'); });
  const p3 = await ctx.newPage(); p3.on('dialog', (d) => d.accept()); p3.on('pageerror', (e) => errs.push('p3 ' + e.message));
  await p3.route(/^https?:\/\//, (r) => r.abort());
  await p3.goto('file://' + FILE + '#dbkey=FAKEDBKEY_98765&nbkey=' + encodeURIComponent(PK), { waitUntil: 'load' }); await p3.waitForTimeout(1800);
  const H2 = await p3.evaluate(() => ({ nb: localStorage.getItem('or_nb_key'), db: localStorage.getItem('lumen_db_key'), hash: location.hash }));
  t('#dbkey=…&nbkey=… 함께 → 둘 다 저장 · 주소에서 지움', H2.nb === PK && H2.db === 'FAKEDBKEY_98765' && H2.hash.indexOf('key') < 0, JSON.stringify({ db: H2.db, hash: H2.hash, nbOk: H2.nb === PK }));
  await p3.close();
  await pg.evaluate((k) => _origSetItem('lumen_db_key', k), DBKEY);

  const src = fs.readFileSync(MOD, 'utf8');
  t('부품에 템플릿 리터럴 없음 · 조립 결과에 그대로', src.indexOf('`') < 0 && html.indexOf(src.slice(0, 1500)) >= 0);
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
