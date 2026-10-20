#!/usr/bin/env node
/* 학원앱 v19-124 검사 — 📅 네이버 예약
 *   가짜 서버(lumen_store 흉내, 쓰기를 모두 적는다) · 외부망 차단 · 가짜 학생(○○○) · 가짜 예약자·전화(지어낸 값)
 *   예약 자료는 수집기와 같은 모양(naver_bookings + 잠근 상자 naver_bookings_pii — 페이지 안에서 nbSeal 로 잠근다)
 *   ① 메뉴(수업·출결 · 출결·보충 바로 뒤) · 제목 · 시작 다운로드 제외(naver_book)
 *   ② 화면: 오늘 · 다가오는 예약(날짜별) · 지난 7일(접힘) · 잠근 상자 열어 이름·전화(전화 걸기 링크)·메모·추가 답 · 취소 흐리게 · 상태 글
 *   ③ 종류 칩(텐투텐만) · 텐투텐 날짜별 인원(취소 빼고 · 2명 예약은 2)
 *   ④ 띠: 쿠키 만료 → 「네이버 다시 연결이 필요해요」+ 방법 · 열쇠 없는 기기 · 다른 열쇠 · 수집기 열쇠 없음
 *   ⑤ 학생 연결: 고르기 → naver_booking_links 저장(다른 기기에서 넣은 연결은 그대로) · 명단에 없음 · 연결 풀기 · 형제 후보
 *   ⑥ 리커버리 보드: ✓ 네이버 예약 HH:MM · 「시간 넣기」(누를 때만 rc_state 에) · 다른 시간 ⚠ · 「예약 아직」 · 「예약했지만 명단에 없음」 · ＋ 확정 명단에
 *      출결(lumen_recovery_log) 은 쓰지 않음
 *   ⑦ 홈 「오늘 네이버 예약 n건」 (취소 빼고 · 학생 이름 / 예약자 이름) · 만료면 빨간 줄
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19124.js lumen_v19-124.html
 *   그림: $SP/v19124_list.png · v19124_rc.png · v19124_home.png */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-124.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-124'])[0];
const VER = Number(WANT.replace('v19-', ''));   /* v19-126 부터 이름·전화 띠 글이 «예약 열쇠» 쪽으로 바뀜 */
const MOD = path.join(__dirname, '..', 'modules', 'naverbook124_teacher.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 3학년', group: 'M3', lumen_rec_code: 'AAA111', parentPhone: '010-0000-0001', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 2학년', group: 'M2', lumen_rec_code: 'AAA222', parentPhone: '010-0000-0002', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중학교 1학년', group: 'M1', lumen_rec_code: 'AAA333', parentPhone: '010-0000-0003', lumen_planner: {} },
  { id: 'S4', name: '○○○4', grade: '중학교 1학년', group: 'M1', lumen_rec_code: 'AAA444', parentPhone: '010-0000-0003', lumen_planner: {} }];
const KEY = 'TESTKEY_fake_1234';

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, KEY }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    window.T = { store: {}, w: [], allW: [], toasts: [], reads: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, op: 'select', eqv: [], lim: 1e9,
        select() { return b; }, eq(k, v) { b.eqv.push(v); b.f.push((x) => String(x[k]) === String(v)); return b; },
        in(k, a) { const s = a.map(String); b.f.push((x) => s.indexOf(String(x[k])) >= 0); return b; },
        gte() { return b; }, lte() { return b; }, not() { return b; }, like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => String(x[k]).indexOf(pre) === 0); return b; },
        or() { return b; }, order() { return b; }, limit(n) { b.lim = n; return b; }, range() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.w.push({ op: 'put', tbl, key: r.key }); T.allW.push(r.key); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) {
          if (b.op !== 'select') { T.w.push({ op: b.op, tbl, key: b.eqv[0] }); return Promise.resolve({ data: null, error: null }).then(r, j); }
          let rows = tbl === 'lumen_store' ? Object.keys(T.store).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' })) : [];
          rows = rows.filter((x) => b.f.every((fn) => fn(x))).slice(0, b.lim);
          T.reads.push(tbl);
          return Promise.resolve({ data: b.one ? (rows[0] || null) : rows, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('ALERT ' + m); };
    T.stu = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); };
    T.stu();
    _origSetItem('lumen_db_key', KEY);
    /* 수집기와 같은 모양의 가짜 예약 — 오늘·리커버리 날짜 기준 */
    T.make = async (opt) => {
      opt = opt || {};
      const today = nbTodayKst(), D = (n) => nbAddDays(today, n), rec = rcRecDate(rcWeekKey());
      const it = (id, name) => ({ id: String(id), name, kind: nbKindOf(name, id) });
      const REC = it(7380213, '리커버리 클래스(재원생)'), TT = it(7170543, '텐투텐 신청 (재원생용)'), CS = it(6773412, '루멘수학 테스트&상담'), TLP = it(7401437, 'TLP 학습심리분석 상담(재원생)');
      const st = (k) => ({ confirmed: { code: 'RC03', k: 'confirmed', label: '확정' }, cancelled: { code: 'RC04', k: 'cancelled', label: '취소' }, requested: { code: 'RC02', k: 'requested', label: '신청(확정 대기)' }, completed: { code: 'RC08', k: 'completed', label: '이용 완료' } }[k]);
      const B = [], P = {};
      let n = 5000;
      const add = (item, date, start, end, status, match, pii, extra) => { const id = String(++n); B.push(Object.assign({ id, item, status: st(status), date, start, end, count: 1, reg: '', confirmed: '', completed: '', cancelled: status === 'cancelled' ? 'x' : '', match: match || null }, extra || {})); P[id] = Object.assign({ booker: '가짜예약자' + n, phone: '010-9000-' + String(n).slice(-4), msg: '', form: [] }, pii || {}); return id; };
      T.ids = {
        todayCs: add(CS, today, '10:00', '11:00', 'confirmed', null, { msg: '가짜메모 새 학생 상담', form: [{ q: '학년', a: '중1' }] }),
        todayTlp: add(TLP, today, '16:00', '17:00', 'requested', { stKey: 'S1', code: 'AAA111', how: 'phone' }),
        todayCx: add(CS, today, '18:00', '', 'cancelled', null),
        tt1: add(TT, D(1), '18:00', '22:00', 'confirmed', { stKey: 'S2', code: 'AAA222', how: 'phone' }, null, { count: 2 }),
        tt2: add(TT, D(1), '18:00', '22:00', 'confirmed', null),
        tt3: add(TT, D(1), '18:00', '22:00', 'cancelled', null),
        tt4: add(TT, D(8), '18:00', '22:00', 'confirmed', null),
        sib: add(CS, D(2), '11:00', '', 'confirmed', null, null, { cands: ['S3', 'S4'] }),
        past: add(CS, D(-3), '10:00', '', 'completed', { stKey: 'S3', code: 'AAA333', how: 'name' }),
        old: add(CS, D(-20), '10:00', '', 'completed', null),
        r1: add(REC, rec, '14:00', '15:00', 'confirmed', { stKey: 'S1', code: 'AAA111', how: 'phone' }),
        r2: add(REC, rec, '13:00', '14:00', 'confirmed', { stKey: 'S2', code: 'AAA222', how: 'phone' }),
        r4: add(REC, rec, '10:00', '11:00', 'confirmed', { stKey: 'S4', code: 'AAA444', how: 'phone' }),
        rU: add(REC, rec, '09:00', '10:00', 'confirmed', null),
        rCx: add(REC, rec, '15:00', '16:00', 'cancelled', { stKey: 'S3', code: 'AAA333', how: 'phone' }),
      };
      const at = new Date(Date.now() - 5 * 60000).toISOString();
      const data = { at, ok: true, v: 1, bizId: '1419039', today, items: [REC, TT, CS, TLP], bookings: B, counts: { inWindow: B.length }, pii: { enc: true, n: B.length } };
      const box = await nbSeal({ at, byId: P }, opt.key || KEY); box.at = at; box.n = B.length;
      T.store = {
        rc_config: { minScore: 80, minUnit: 60, elem6Score: 75, weeks: 3, slots: ['10:00', '11:00', '13:00'] },
        rc_state: { calls: { [rcWeekKey()]: {
          S1: { on: true, snap: { name: '○○○1', group: 'M3', score: 60, rx: [] } },
          S2: { on: true, slot: '11:00', snap: { name: '○○○2', group: 'M2', score: 55, rx: [] } },
          S3: { on: true, snap: { name: '○○○3', group: 'M1', score: 50, rx: [] } } } }, dates: {}, periods: {} },
        naver_bookings: data, naver_bookings_status: { at, ok: true, n: B.length, lastOkAt: at },
        naver_booking_links: { '999999': 'S3' } };
      if (!opt.noBox) T.store.naver_bookings_pii = box;
      T.w = []; T.toasts = [];
      NBK.loaded = false; NBK.at = 0; NBK.edit = {}; NBK.kind = 'all';
      await nbkLoad(true);
      return { today, rec };
    };
  }, { STUDENTS, KEY });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const show = async (v) => { await pg.evaluate((v) => { T.stu(); VIEW = v; render(); }, v); await settle(400); };
  const rowsInfo = () => pg.evaluate(() => { T.stu(); render(); return [...document.querySelectorAll('#CONTENT .nbk-row')].filter((r) => r.offsetParent !== null && !r.closest('details:not([open])')).map((r) => ({ id: r.dataset.nbkRow, kind: r.dataset.nbkKind, cx: r.classList.contains('nbk-cx'), text: r.innerText, tel: (r.querySelector('.nbk-tel') || {}).href || '', sec: (r.closest('[data-nbk-sec]') || {}).dataset ? r.closest('[data-nbk-sec]').dataset.nbkSec : '' })); });

  const D0 = await pg.evaluate(() => T.make());
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  const MENU = await pg.evaluate(() => { const g = GROUPS.find((x) => x.key === 'class'); const i = g.subs.findIndex((s) => s.v === 'attend'); return { next: g.subs[i + 1] && g.subs[i + 1].v, label: g.subs[i + 1] && g.subs[i + 1].label }; });
  t('메뉴: 수업·출결 「출결·보충」 바로 뒤에 「네이버 예약」', MENU.next === 'naverbk' && MENU.label === '네이버 예약', JSON.stringify(MENU));
  t('시작 다운로드 제외 목록에 naver_book', await pg.evaluate(() => PULL_SKIP_PREFIX.indexOf('naver_book') >= 0));
  t('잠근 상자 열림 (이 기기 열쇠)', await pg.evaluate(() => !!NBK.pii && !NBK.piiErr && Object.keys(NBK.pii).length === NBK.data.bookings.length));

  /* ② 화면 */
  await show('naverbk');
  let R = await rowsInfo();
  const id = await pg.evaluate(() => T.ids);
  const byId = {}; R.forEach((r) => { byId[r.id] = r; });
  t('제목 칸', /네이버 예약/.test(await pg.evaluate(() => document.getElementById('CONTENT').innerText.slice(0, 200))));
  t('오늘 칸: 상담 10:00 · TLP 16:00 · 취소 18:00', byId[id.todayCs] && byId[id.todayCs].sec === 'today' && byId[id.todayTlp].sec === 'today' && byId[id.todayCx].sec === 'today', JSON.stringify(R.filter((r) => r.sec === 'today').map((r) => r.id)));
  t('예약자 이름·전화(전화 걸기 링크 tel:숫자)·메모·추가 답이 열린 상자에서', /가짜예약자/.test(byId[id.todayCs].text) && /^tel:01090005001$/.test(byId[id.todayCs].tel) && /가짜메모 새 학생 상담/.test(byId[id.todayCs].text) && /학년: 중1/.test(byId[id.todayCs].text), JSON.stringify(byId[id.todayCs]));
  t('취소 줄은 흐리게(nbk-cx) · 「취소」', byId[id.todayCx].cx && /취소/.test(byId[id.todayCx].text) && !byId[id.todayCs].cx);
  t('상태 글: 신청(확정 대기) · 확정', /신청\(확정 대기\)/.test(byId[id.todayTlp].text) && /확정/.test(byId[id.todayCs].text));
  t('연결된 학생 이름 + 연결 방법(전화)', /○○○1/.test(byId[id.todayTlp].text) && /전화/.test(byId[id.todayTlp].text));
  const days = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-sec="up"] [data-nbk-day]')].map((d) => d.dataset.nbkDay));
  t('다가오는 예약: 날짜별 묶음(오름차순)', days.length >= 3 && days.every((d, i) => i === 0 || days[i - 1] < d) && days[0] > D0.today, JSON.stringify(days));
  const past = await pg.evaluate(() => { const d = document.querySelector('[data-nbk-sec="past"]'); return { open: d.open, n: d.querySelectorAll('.nbk-row').length, txt: d.querySelector('summary').innerText }; });
  t('지난 7일: 접혀 있음 · 3일 전 1건(20일 전은 안 보임)', !past.open && past.n === 1 && /1건/.test(past.txt) && !byId[id.old], JSON.stringify(past));
  await pg.screenshot({ path: SP + '/v19124_list.png', fullPage: false });

  /* ③ 칩 · 텐투텐 인원 */
  const TT = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-tt]')].map((x) => x.dataset.nbkTt + '=' + x.innerText));
  t('텐투텐 인원: 내일 3명(2명 예약 + 1명 · 취소 빼고) · 8일 뒤 1명', TT.length === 2 && /3명/.test(TT[0]) && /1명/.test(TT[1]), JSON.stringify(TT));
  await pg.evaluate(() => nbkSetKind('tenten')); await settle(200);
  R = await rowsInfo();
  t('「텐투텐」 칩 → 텐투텐 줄만 (4) · 인원 칸은 그대로', R.length === 4 && R.every((r) => r.kind === 'tenten') && (await pg.evaluate(() => !!document.querySelector('[data-nbk-tenten]'))), JSON.stringify(R.map((r) => r.kind)));
  await pg.evaluate(() => nbkSetKind('recovery')); await settle(200);
  R = await rowsInfo();
  t('「리커버리」 칩 → 리커버리 5줄 · 텐투텐 인원 칸 안 보임', R.length === 5 && R.every((r) => r.kind === 'recovery') && !(await pg.evaluate(() => !!document.querySelector('[data-nbk-tenten]'))), R.length);
  const chips = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-chip]')].map((c) => c.dataset.nbkChip));
  t('칩: 전체 · 리커버리 · 텐투텐 · 상담/테스트 · TLP · KMM · 컨설팅 (기타는 있을 때만)', chips.join() === 'all,recovery,tenten,counsel,tlp,kmm,consult', chips.join());
  await pg.evaluate(() => nbkSetKind('all')); await settle(150);

  /* ⑤ 학생 연결 */
  await show('naverbk');
  const selN = await pg.evaluate((i) => { const s = document.querySelector('select[data-nbk-id="' + i + '"]'); return s ? [...s.options].map((o) => o.value) : null; }, id.todayCs);
  t('못 맞춘 예약에 「학생 연결」 고르기(학생 4명 + 명단에 없음)', selN && selN.indexOf('S1') > 0 && selN.indexOf('__none') > 0 && selN.indexOf('__clear') < 0, JSON.stringify(selN));
  const sibOpts = await pg.evaluate((i) => { const s = document.querySelector('select[data-nbk-id="' + i + '"]'); return { o: [...s.options].slice(1, 3).map((o) => o.text), hint: s.parentElement.innerText }; }, id.sib);
  t('형제 후보 먼저(★) + 「형제·같은 이름 2명」', /★ ○○○3/.test(sibOpts.o[0]) && /★ ○○○4/.test(sibOpts.o[1]) && /2명/.test(sibOpts.hint), JSON.stringify(sibOpts));
  await pg.evaluate(() => { T.w = []; T.store.naver_booking_links = { '999999': 'S3', '888888': 'S1' }; });   /* 다른 기기에서 그 사이 넣은 연결 */
  await pg.evaluate((i) => nbkLink(i, 'S2'), id.todayCs); await settle(200);
  let L = await pg.evaluate(() => ({ links: T.store.naver_booking_links, w: T.w.map((x) => x.key) }));
  t('연결 → naver_booking_links[예약]=S2 저장 · 다른 기기 연결(888888) 그대로 · 쓴 키는 이것뿐', L.links[id.todayCs] === 'S2' && L.links['888888'] === 'S1' && L.links['999999'] === 'S3' && L.w.join() === 'naver_booking_links', JSON.stringify(L));
  R = await rowsInfo(); let row = R.find((r) => r.id === id.todayCs);
  t('줄에 「👤 ○○○2 · 직접」', /○○○2/.test(row.text) && /직접/.test(row.text), row.text);
  await pg.evaluate((i) => nbkLink(i, '__none'), id.todayCs); await settle(200);
  R = await rowsInfo(); row = R.find((r) => r.id === id.todayCs);
  t('「명단에 없음(새 가족)」 → 링크 값 \'\' · 줄에 🆕 명단에 없음', (await pg.evaluate((i) => T.store.naver_booking_links[i], id.todayCs)) === '' && /명단에 없음/.test(row.text), row.text);
  await pg.evaluate((i) => nbkEdit(i), id.todayTlp); await settle(150);
  const clearOpt = await pg.evaluate((i) => [...document.querySelector('select[data-nbk-id="' + i + '"]').options].map((o) => o.value), id.todayCs).catch(() => null);
  await pg.evaluate((i) => nbkEdit(i), id.todayCs); await settle(150);
  const clr = await pg.evaluate((i) => [...document.querySelector('select[data-nbk-id="' + i + '"]').options].map((o) => o.value), id.todayCs);
  t('✎ 누르면 바꾸기 고르기 · 직접 연결이 있으면 「연결 풀기」', clr.indexOf('__clear') > 0, JSON.stringify(clr) + ' ' + JSON.stringify(clearOpt));
  await pg.evaluate((i) => nbkLink(i, '__clear'), id.todayCs); await settle(200);
  t('연결 풀기 → 링크에서 빠지고 다시 자동(못 맞춤 → 고르기)', !(id.todayCs in (await pg.evaluate(() => T.store.naver_booking_links))) && (await pg.evaluate((i) => !!document.querySelector('select[data-nbk-id="' + i + '"]'), id.todayCs)));
  await pg.evaluate((i) => nbkLink(i, 'S1'), id.todayTlp); await settle(150);
  t('수집기가 전화로 맞춘 것도 직접 연결이 이김 (S1 → S1 직접)', /직접/.test((await rowsInfo()).find((r) => r.id === id.todayTlp).text));

  /* ④ 띠 */
  let B = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-ban]')].map((x) => x.dataset.nbkBan));
  t('정상일 때 띠 없음', B.length === 0, B.join());
  await pg.evaluate(() => { T.store.naver_bookings_status = { at: new Date().toISOString(), ok: false, reason: 'login', code: 302, lastOkAt: T.store.naver_bookings.at }; return nbkLoad(true); });
  await show('naverbk');
  const ban = await pg.evaluate(() => { const b = document.querySelector('[data-nbk-ban="login"]'); return b ? b.innerText : ''; });
  t('쿠키 만료 → 「네이버 다시 연결이 필요해요」 + ⌘⌥I · Application · Cookies · NID_AUT · NID_SES · NAVER_COOKIE', /네이버 다시 연결이 필요해요/.test(ban) && /⌘ \+ ⌥ \+ I/.test(ban) && /Application/.test(ban) && /Cookies/.test(ban) && /NID_AUT/.test(ban) && /NID_SES/.test(ban) && /NAVER_COOKIE/.test(ban), ban);
  t('만료여도 지난 목록은 그대로 보임', (await rowsInfo()).length > 5);
  await show('home');
  const homeBad = await pg.evaluate(() => { const c = document.querySelector('[data-nbk-home]'); return c ? c.innerText : ''; });
  t('홈 칸에도 「네이버 다시 연결이 필요해요」', /다시 연결이 필요해요/.test(homeBad), homeBad);
  await pg.evaluate(() => { T.store.naver_bookings_status = { at: T.store.naver_bookings.at, ok: true }; localStorage.removeItem('lumen_db_key'); return nbkLoad(true); });
  await show('naverbk');
  B = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-ban]')].map((x) => x.dataset.nbkBan + ':' + x.innerText.slice(0, 40)));
  R = await rowsInfo();
  t('열쇠 없는 기기 → 「이 기기에는 서버 잠금 열쇠가 없어」 · 예약자 🔒 · 전화 링크 없음 · 학생 연결은 보임', B.length === 1 && (VER >= 126 ? /예약 열쇠를 넣으면/ : /서버 잠금 열쇠가 없어/).test(B[0]) && R.every((r) => /예약자 🔒/.test(r.text) && !r.tel) && /○○○1/.test(R.find((r) => r.id === id.todayTlp).text), JSON.stringify(B) + ' ' + JSON.stringify(R.filter((r) => !/예약자 🔒/.test(r.text) || r.tel).map((r) => r.id + '/' + r.sec + '/' + r.text.slice(0, 60))) + ' tlp:' + (R.find((r) => r.id === id.todayTlp) || {}).text);
  await pg.evaluate(() => { localStorage.setItem('lumen_db_key', 'WRONG_KEY_xx'); return nbkLoad(true); }); await show('naverbk');
  B = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-ban]')].map((x) => x.dataset.nbkBan + ':' + x.innerText.slice(0, 40)));
  t('다른 열쇠 → 「이 기기의 열쇠로 이름·전화를 못 열었어요」', B.length === 1 && /못 열었어요/.test(B[0]), JSON.stringify(B));
  await pg.evaluate(() => localStorage.setItem('lumen_db_key', 'TESTKEY_fake_1234'));   /* 일부러 앱의 저장 길로 — 서버에 올라가면 안 됨 */
  await pg.evaluate(() => T.make({ noBox: true })); await pg.evaluate(() => { T.store.naver_bookings.pii = { enc: false, n: 0 }; return nbkLoad(true); }); await show('naverbk');
  B = await pg.evaluate(() => [...document.querySelectorAll('[data-nbk-ban]')].map((x) => x.dataset.nbkBan + ':' + x.innerText.slice(0, 60)));
  t('수집기 열쇠 없음 → 「LUMEN_TEACHER_KEY」 안내 (v19-126 부터 「NAVER_PII_KEY」)', B.length === 1 && (VER >= 126 ? /NAVER_PII_KEY/ : /LUMEN_TEACHER_KEY/).test(B[0]), JSON.stringify(B));
  await pg.evaluate(() => { const a = new Date(Date.now() - 5 * 3600000).toISOString(); T.store.naver_bookings.at = a; T.store.naver_bookings_status.at = a; return nbkLoad(true); }); await show('naverbk');
  t('5시간 전 수집 → 「마지막 수집이 … 전이에요」', await pg.evaluate(() => !!document.querySelector('[data-nbk-ban="stale"]')));
  await pg.evaluate(() => { delete T.store.naver_bookings; delete T.store.naver_bookings_status; return nbkLoad(true); }); await show('naverbk');
  t('자료가 아직 없으면 「아직 받은 예약이 없어요」 · 홈 칸 없음', (await pg.evaluate(() => !!document.querySelector('[data-nbk-ban="empty"]'))) && !(await pg.evaluate(() => { VIEW = 'home'; render(); return !!document.querySelector('[data-nbk-home]'); })));

  /* ⑥ 리커버리 보드 */
  await pg.evaluate(() => T.make());
  await pg.evaluate(async () => { RC.loaded = false; await rcLoad(true); });
  await show('recovery'); await settle(300);
  const RCI = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#CONTENT div[style*="padding:9px 10px"]')];
    const get = (nm) => { const r = rows.find((x) => x.innerText.indexOf(nm) >= 0); return r ? { text: r.innerText, ok: !!r.querySelector('[data-nbk-rc="ok"]'), no: !!r.querySelector('[data-nbk-rc="no"]'), slotBtn: (r.querySelector('.nbk-rcslot') || {}).innerText || '' } : null; };
    const side = document.querySelector('[data-nbk-rcside]');
    return { s1: get('○○○1'), s2: get('○○○2'), s3: get('○○○3'), side: side ? side.innerText : '', sideRows: side ? side.querySelectorAll('.nbk-rcs-row').length : 0 };
  });
  t('확정 ○○○1: 「✓ 네이버 예약 14:00」 + 「시간 넣기」(시간 칸 비어 있음)', RCI.s1 && RCI.s1.ok && /네이버 예약 14:00/.test(RCI.s1.text) && RCI.s1.slotBtn === '시간 넣기', JSON.stringify(RCI.s1));
  t('확정 ○○○2: 배정 11:00 ≠ 예약 13:00 → 「⚠ 11:00 → 13:00」 (자동으로 안 바꿈)', RCI.s2 && RCI.s2.ok && /11:00 → 13:00/.test(RCI.s2.slotBtn) && (await pg.evaluate(() => T.store.rc_state.calls[rcWeekKey()].S2.slot)) === '11:00', JSON.stringify(RCI.s2));
  t('확정 ○○○3: 예약이 취소뿐 → 「예약 아직」', RCI.s3 && RCI.s3.no && !RCI.s3.ok, JSON.stringify(RCI.s3));
  t('「예약했지만 명단에 없음」 2건: ○○○4 (10:00) · 학생 연결 안 됨(09:00) · 취소는 빠짐', RCI.sideRows === 2 && /○○○4/.test(RCI.side) && /09:00/.test(RCI.side) && /10:00/.test(RCI.side) && !/15:00/.test(RCI.side), RCI.side);
  t('보드를 열기만 했을 때 rc_state · naver_ 키를 쓰지 않음', (await pg.evaluate(() => T.w.filter((x) => /^(rc_|naver_)/.test(x.key)).length)) === 0, JSON.stringify(await pg.evaluate(() => T.w)));
  await pg.screenshot({ path: SP + '/v19124_rc.png', fullPage: false });
  await pg.evaluate(() => { T.w = []; const b = [...document.querySelectorAll('.nbk-rcslot')].find((x) => x.innerText === '시간 넣기'); b.click(); }); await settle(250);
  const SL = await pg.evaluate(() => ({ slot: T.store.rc_state.calls[rcWeekKey()].S1.slot, keys: T.w.map((x) => x.key), rlog: students.some((s) => s.lumen_recovery_log && Object.keys(s.lumen_recovery_log).length) }));
  t('「시간 넣기」 → rc_state 의 ○○○1 시간 = 14:00 · 쓴 키 rc_state 만 · 출결 기록 안 씀', SL.slot === '14:00' && SL.keys.join() === 'rc_state' && !SL.rlog, JSON.stringify(SL));
  const after = await pg.evaluate(() => { const r = [...document.querySelectorAll('#CONTENT div[style*="padding:9px 10px"]')].find((x) => x.innerText.indexOf('○○○1') >= 0); return { btn: !!r.querySelector('.nbk-rcslot'), ok: !!r.querySelector('[data-nbk-rc="ok"]') }; });
  t('넣은 뒤에는 단추 사라지고 ✓ 만', !after.btn && after.ok, JSON.stringify(after));
  await pg.evaluate(() => { T.w = []; const b = document.querySelector('[data-nbk-add="S4"]'); b.click(); }); await settle(250);
  const ADD = await pg.evaluate(() => ({ s4: T.store.rc_state.calls[rcWeekKey()].S4, keys: T.w.map((x) => x.key), side: (document.querySelector('[data-nbk-rcside]') || {}).innerText || '' }));
  t('「＋ 확정 명단에」 → ○○○4 확정(직접) · 「명단에 없음」에서 빠지고 1건 남음', ADD.s4 && ADD.s4.on && ADD.s4.manual && ADD.keys.join() === 'rc_state' && !/○○○4/.test(ADD.side) && /09:00/.test(ADD.side), JSON.stringify(ADD));

  /* 가운데 학생 카드(자동 선발 줄)에도 배지 — rcRows 를 가짜 줄로 */
  const CARD = await pg.evaluate(() => {
    const keep = window.rcRows; const fake = (k, nm) => ({ stKey: k, st: { id: k, name: nm, grade: '중학교 1학년', group: 'M1' }, pri: 1, testHit: null, unitHits: [], carryHits: [], match: [], rx: [] });
    window.rcRows = () => [fake('S1', '○○○1'), fake('S3', '○○○3'), fake('S9', '○○○9')];
    T.stu(); let html = ''; try { html = rRecovery(); } catch (e) { html = 'ERR ' + e.message; }
    window.rcRows = keep;
    const d = document.createElement('div'); d.innerHTML = html;
    const cards = [...d.querySelectorAll('div[style*="padding:13px 16px"]')].map((c) => ({ t: c.innerText.slice(0, 80), ok: !!c.querySelector('[data-nbk-rc="ok"]'), no: !!c.querySelector('[data-nbk-rc="no"]'), btn: !!c.querySelector('.nbk-rcslot') }));
    return { err: /^ERR/.test(html) ? html : '', cards };
  });
  const cS1 = CARD.cards.find((c) => /○○○1/.test(c.t)), cS3 = CARD.cards.find((c) => /○○○3/.test(c.t)), cS9 = CARD.cards.find((c) => /○○○9/.test(c.t));
  t('가운데 카드: 확정 ○○○1 = ✓ 네이버 예약(단추는 오른쪽 칸에만) · ○○○3 = 예약 아직 · 호출 안 한 ○○○9 = 배지 없음', !CARD.err && cS1 && cS1.ok && !cS1.btn && cS3 && cS3.no && cS9 && !cS9.ok && !cS9.no, JSON.stringify(CARD));
  /* ⑦ 홈 */
  await pg.evaluate(() => T.make());
  await show('home');
  const HM = await pg.evaluate(() => { const c = document.querySelector('[data-nbk-home]'); return c ? { text: c.innerText, rows: [...c.querySelectorAll('.nbk-hrow')].map((r) => r.innerText.replace(/\s+/g, ' ')) } : null; });
  const NT = await pg.evaluate(() => T.store.naver_bookings.bookings.filter((b) => b.date === nbTodayKst() && b.status.k !== 'cancelled').length);   /* 오늘이 리커버리 날이면 리커버리 예약도 오늘 */
  t('홈 「📅 오늘 네이버 예약 n건」 (취소 빼고 · n=' + NT + ')', HM && new RegExp('오늘 네이버 예약 ' + NT + '건').test(HM.text) && NT >= 2, JSON.stringify(HM));
  t('홈 줄: 시간 순 · 「10:00 상담 가짜예약자…」 · 「16:00 TLP ○○○1」(학생 이름 먼저) · 최대 6줄', HM && HM.rows.length === Math.min(6, NT) && HM.rows.some((r) => /^10:00 상담 가짜예약자/.test(r)) && HM.rows.some((r) => /^16:00 TLP ○○○1/.test(r)) && HM.rows.every((r, i) => i === 0 || HM.rows[i - 1].slice(0, 5) <= r.slice(0, 5)), JSON.stringify(HM && HM.rows));
  await pg.screenshot({ path: SP + '/v19124_home.png', fullPage: false });

  await settle(1800);
  t('서버 잠금 열쇠(lumen_db_key)는 서버로 올라가지 않음 (localStorage.setItem 길로 넣어도)', (await pg.evaluate(() => T.allW.indexOf('lumen_db_key'))) < 0, JSON.stringify(await pg.evaluate(() => T.allW)));
  t('시작 다운로드에서 lumen_db_key 제외', await pg.evaluate(() => PULL_SKIP_KEYS.indexOf('lumen_db_key') >= 0));
  /* 순수 함수 (앱 안의 공용 부품) */
  const PF = await pg.evaluate(() => ({ k: [nbKindOf('리커버리 클래스(재원생)'), nbKindOf('1:1 컨설팅(재원생)'), nbKindOf('TLP 학습심리분석 상담(재원생)'), nbKindOf('???', 7170543)].join(), kst: nbKst('2025-07-20T05:00:00Z').time }));
  t('앱 안 공용 함수: 종류 · UTC→한국', PF.k === 'recovery,consult,tlp,tenten' && PF.kst === '14:00', JSON.stringify(PF));

  /* 좁은 화면(폰) */
  await pg.setViewportSize({ width: 390, height: 800 }); await show('naverbk');
  const ov = await pg.evaluate(() => { const w = document.querySelector('.nbk-wrap'); return w ? w.scrollWidth <= w.clientWidth + 2 : false; });
  t('폰 폭(390)에서 가로로 넘치지 않음', ov);
  await pg.setViewportSize({ width: 1400, height: 950 });

  const src = fs.readFileSync(MOD, 'utf8'), core = fs.readFileSync(path.join(__dirname, '..', '..', 'naver_booking_core.js'), 'utf8');
  t('부품·공용 함수에 템플릿 리터럴 없음 · 조립 결과에 그대로', src.indexOf('`') < 0 && core.indexOf('`') < 0 && fs.readFileSync(FILE, 'utf8').indexOf(src.slice(0, 1500)) >= 0 && fs.readFileSync(FILE, 'utf8').indexOf(core.slice(0, 1500)) >= 0);
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + ' 통과 · ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
