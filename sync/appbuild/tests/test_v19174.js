#!/usr/bin/env node
/* 학원앱 v19-174 검사 — 🚑 리커버리 보드 2판 (docs/recovery_tab_contract.md §9 · 시안 docs/mockup_recovery_compact.html)
 *   가짜 서버(lumen_store: or_studentdb 8명 · rc_config · rc_state · naver_bookings · mf_weekly · mf_progress · mf_books / mf_students 표) · 외부망 전부 차단
 *   가짜 이름 ○○○1~8 · 월수금 반(M4·M7·H1) · 화목토 반(T630·T5·T730) · 요일 없는 반(X1 → 그 밖) · 초·중·고 섞어
 *   ① 줄 표 · 묶음 머리·소제목·인원 ② 2분할(1400px) / 한 기둥(1100px) ③ 날짜 표기(매쓰플랫 채점일) ④ 보기 칩 거르기 · 묶음 토글 → localStorage rc_board_view
 *   ⑤ 호출 토글 → rc_state(기존 길) ⑥ 완료 줄 회색 맨 아래 ⑦ 서랍(학생 칸 · 시간 칩 → rcSetSlot · ✅ 완료) ⑧ 띠 접힘 기본 · 📌 기억
 *   ⑨ 적중 분석·백지테스트 띠·서랍(회귀) ⑩ 1024~1279 FAB 그대로 ⑪ 카드 보기 되돌림 ⑫ 실서버 쓰기 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19174.js lumen_v19-174.html [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-174.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-174'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  const reqs = []; let faked = false; await pg.route(/^https?:\/\//, (r) => { reqs.push((faked ? 'after:' : 'boot:') + r.request().method() + ' ' + r.request().url()); r.abort(); });
  await pg.addInitScript(() => {
    window.__W = []; window.__STORE = {}; window.__TABLES = {};
    const mk = (tbl) => { const b = { f: [], op: 'select', select() { return b; }, eq(k, v) { if (k === 'key') b.f.push((x) => x === v); return b; }, in(k, a) { if (k === 'key') b.f.push((x) => a.indexOf(x) >= 0); return b; }, like() { return b; }, ilike() { return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, gt() { return b; }, lt() { return b; }, lte() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; }, filter() { return b; }, match() { return b; }, single() { return b; }, maybeSingle() { return b; },
      update() { b.op = 'u'; return b; }, delete() { b.op = 'd'; return b; }, insert() { return Promise.resolve({ error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { window.__W.push({ tbl, key: r.key, value: JSON.parse(JSON.stringify(r.value === undefined ? null : r.value)) }); }); return Promise.resolve({ error: null }); },
      then(r, j) { let data = [];
        if (b.op === 'select') { if (tbl === 'lumen_store') data = Object.keys(window.__STORE).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })); else data = JSON.parse(JSON.stringify(window.__TABLES[tbl] || [])); }
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    window.__FAKE = () => ({ from: mk, rpc: () => Promise.resolve({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {}, storage: { from: () => ({ upload: () => Promise.resolve({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) } });
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  /* 부팅 때 시작된 진짜 서버 읽기(진도·주간테스트·명예의 전당·잠금)가 다 끝난 뒤에 가짜를 심는다 — 늦게 끝난 읽기가 빈 목록으로 덮지 않게 */
  await pg.waitForFunction(() => typeof BP !== 'undefined' && BP.loaded && typeof WK !== 'undefined' && WK.loaded, null, { timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 12; i++) { const n = reqs.length; await pg.waitForTimeout(1500); if (reqs.length === n) break; }   /* 1.5초 동안 요청이 없을 때까지 */

  /* ── 가짜 자료 심기 ── */
  const FX = await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const add = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const wk = rcWeekKey(), recDt = add(today, 1), tD = add(today, -4), tD2 = add(today, -6);
    const nm = (n) => '○○○' + n;
    const STU = [
      { id: 'S1', name: nm(1), grade: '중학교 2학년', group: 'M4', lumen_rec_code: 'AAA111' },
      { id: 'S2', name: nm(2), grade: '중학교 2학년', group: 'M4', lumen_rec_code: 'AAA222' },
      { id: 'S3', name: nm(3), grade: '중학교 1학년', group: 'M7', lumen_rec_code: 'AAA333' },
      { id: 'S4', name: nm(4), grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'AAA444' },
      { id: 'S5', name: nm(5), grade: '초등학교 6학년', group: 'T630', lumen_rec_code: 'BBB555' },
      { id: 'S6', name: nm(6), grade: '초등학교 6학년', group: 'T5', lumen_rec_code: 'BBB666' },
      { id: 'S7', name: nm(7), grade: '중학교 3학년', group: 'T730', lumen_rec_code: 'BBB777' },
      { id: 'S8', name: nm(8), grade: '중학교 2학년', group: 'X1', lumen_rec_code: 'CCC888' }];
    students.length = 0; STU.forEach((s) => students.push(JSON.parse(JSON.stringify(s))));
    window.__TABLES.mf_students = STU.map((s, i) => ({ mf_student_id: 'M' + (i + 1), name: s.name, lumen_rec_code: s.lumen_rec_code }));
    groupDays = { M4: [1, 3, 5], M7: [1, 3, 5], H1: [1, 3, 5], T630: [2, 4, 6], T5: [2, 4, 6], T730: [2, 4, 6] };
    const sn = (n, grade, score) => ({ name: nm(n), group: '', grade, score, rx: [], holes: 0, rxN: 0, units: [] });
    const calls = {};
    calls[wk] = {
      S1: { on: true, snap: sn(1, '중학교 2학년', 52) },
      S2: { on: true, snap: sn(2, '중학교 2학년', 48) },
      S3: { on: true, slot: '11:00', slotSrc: 'manual', snap: sn(3, '중학교 1학년', 55) },
      S5: { on: true, done: today, slot: '10:00', snap: sn(5, '초등학교 6학년', 62) },
      S7: { on: true, slot: '13:00', slotSrc: 'naver', snap: sn(7, '중학교 3학년', 57) } };
    const dates = {}; dates[wk] = recDt;
    const W = (sid, score, date, wrong) => ({ sid, score, correct: Math.round(score / 5), total: 20, date, wrongConcepts: wrong || [] });
    const bk = (id, k, date, start, cancelled) => ({ id, item: { id: 'Irec', name: '리커버리 클래스', kind: 'recovery' }, status: cancelled ? { k: 'cancelled', label: '취소' } : { k: 'confirmed', label: '확정' }, date, start, end: '', match: { stKey: k, how: 'phone' } });
    Object.assign(window.__STORE, {
      or_studentdb: STU,
      rc_config: { minScore: 60, minUnit: 70, elem6Score: 75, weeks: 3, slots: ['10:00', '11:00', '13:00'], range: null },
      rc_state: { calls, dates, periods: {} },
      lumen_group_days: groupDays,
      mf_weekly: { tests: [
        { wid: 21, key: 'w21', type: 'WEEKLY', title: '중2 주간', date: tD, students: [W('M1', 52, tD, [{ id: 'c1', n: '일차함수', cnt: 3 }]), W('M2', 48, tD), W('M8', 58, tD)] },
        { wid: 22, key: 'w22', type: 'WEEKLY', title: '중1 주간', date: tD2, students: [W('M3', 55, tD2)] },
        { wid: 23, key: 'w23', type: 'WEEKLY', title: '초6 주간', date: tD, students: [W('M5', 62, tD), W('M6', 88, tD)] },
        { wid: 24, key: 'w24', type: 'WEEKLY', title: '중3 주간', date: tD2, students: [W('M7', 57, tD2)] },
        { wid: 25, key: 'w25', type: 'CHAPTER', title: '단원 TEST 다항식', date: tD, students: [W('M4', 54, tD)] }] },
      mf_progress: { byStudent: {
        M1: { b1: { lastDate: today, chapters: [{ n: '일차함수', total: 10, correct: 6, minP: 22, maxP: 41 }] } },
        M6: { b2: { lastDate: today, chapters: [{ n: '분수의 나눗셈', total: 10, correct: 6, minP: 8, maxP: 19 }] } } } },
      mf_books: { books: { b1: { n: '개념+유형 중2-1' }, b2: { n: '초6 기본' } } },
      naver_bookings: { at: new Date().toISOString(), ok: true, items: [], bookings: [ bk('b1', 'S1', recDt, '10:00'), bk('b7', 'S7', recDt, '13:00', true) ] },
      naver_booking_links: {} });
    window.getSupaClient = window.__FAKE; try { _supaClient = window.__FAKE(); } catch (e) {}
    /* 안전망: 부팅 때 시작돼 아직 안 끝난 진짜 bpLoad 가 빈 목록으로 덮는 것을 막는다 (검사용) */
    (function(){ var v = BP.mfList; Object.defineProperty(BP, 'mfList', { get() { return v; }, set(x) { if (x && x.length) v = x; }, configurable: true }); })();
    /* 좁은 모니터 자동 축소(zoom .85)를 끄고 CSS px 그대로 잰다 — 2분할 기준은 가운데 칸 980px */
    document.body.style.zoom = '1'; document.body.style.setProperty('--lz', '1');
    try { localStorage.removeItem('rc_board_view'); localStorage.removeItem('l3_tools_pin'); } catch (e) {}
    RC.loaded = false; RC.view = 'board'; RC.cfg.slots = ['10:00', '11:00', '13:00']; BP.loaded = false; WK.loaded = false;
    NBK.loaded = false; NBK.at = 0; NBK.loading = false; NBK.data = null;
    RCWS.made = { S1: { wk, wsId: 8466, n: 30, parts: { twin: 10, tb: 8, book: 8, boost: 4 } } }; RCWS.loaded = true;
    window.__W.length = 0;
    VIEW = 'recovery'; render();
    return { today, wk, recDt, tD, tD2 };
  });
  faked = true;
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(400);
  const md = (ymd) => Number(ymd.slice(5, 7)) + '/' + Number(ymd.slice(8, 10));

  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  const q = (fn, arg) => pg.evaluate(fn, arg);
  const rowOf = (k) => q((k) => { const tr = document.querySelector('#CONTENT tr[data-rb174-row="' + k + '"]'); if (!tr) return null; const td = [...tr.children].map((x) => x.innerText.replace(/\s+/g, ' ').trim()); return { cls: tr.className, td, grp: tr.closest('[data-rb174-group]') && tr.closest('[data-rb174-group]').getAttribute('data-rb174-group') }; }, k);

  /* ① 줄 표 · 묶음 */
  const B = await q(() => { const b = document.querySelector('#CONTENT [data-rb174-board]'); return b ? { n: b.getAttribute('data-rb174-n'), rows: b.querySelectorAll('tr[data-rb174-row]').length, cards: document.querySelectorAll('#CONTENT div[style*="padding:13px 16px"]').length, side: /📞 확정 명단 · 시간 배분/.test(b.innerText), heads: [...b.querySelectorAll('.rb174-g1')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), subs: [...b.querySelectorAll('.rb174-g2')].map((x) => x.closest('[data-rb174-group]').getAttribute('data-rb174-group') + ':' + x.innerText.replace(/\s+/g, ' ').trim()) } : null; });
  t('줄 표 — 학생 8명 = 8줄 · 옛 카드·확정 명단 칸 없음', B && B.n === '8' && B.rows === 8 && B.cards === 0 && !B.side, JSON.stringify(B));
  t('묶음 머리 「월 · 수 · 금 반 · 4명 · 🔥1 · 확정 3」', B && B.heads.some((h) => /^월 · 수 · 금 반 4명 · 🔥1 · 확정 3$/.test(h)), JSON.stringify(B && B.heads));
  t('묶음 머리 「화 · 목 · 토 반 · 3명 · 확정 2」(완료 포함 · 🔥 없음) · 「그 밖 1명 · 확정 0」', B && B.heads.some((h) => /^화 · 목 · 토 반 3명 · 확정 2$/.test(h)) && B.heads.some((h) => /^그 밖 1명 · 확정 0$/.test(h)), JSON.stringify(B && B.heads));
  t('소제목: 월수금 → 중등 3 · 고등 1 / 화목토 → 초등 2 · 중등 1 / 그 밖 → 중등 1 (초 → 중 → 고 순)', B && B.subs.join('|') === 'mwf:중등 3|mwf:고등 1|tts:초등 2|tts:중등 1|etc:중등 1', JSON.stringify(B && B.subs));
  const r1 = await rowOf('S1'), r4 = await rowOf('S4'), r5 = await rowOf('S5'), r7 = await rowOf('S7'), r2 = await rowOf('S2'), r3 = await rowOf('S3'), r6 = await rowOf('S6'), r8 = await rowOf('S8');
  t('줄 칸: ○○○1 = ✓ · 이름 · 「중2 · M4」 · 🔥 「주간 52점 · ' + md(FX.tD) + '」 「일차함수」 60% · 호출 · 「10:00 네이버」 · 「30문항 ✓」 · 상세 ›', r1 && r1.td[2] === '중2 · M4' && /🔥/.test(r1.td[3]) && r1.td[3].indexOf('주간 52점 · ' + md(FX.tD)) >= 0 && /「일차함수」 60%/.test(r1.td[3]) && r1.td[4] === '호출' && r1.td[5] === '10:00 네이버' && r1.td[6] === '30문항 ✓' && /상세/.test(r1.td[7]), JSON.stringify(r1));
  t('날짜 표기 = 학생 응시일(매쓰플랫 채점일): ○○○3 「주간 55점 · ' + md(FX.tD2) + '」', r3 && r3.td[3].indexOf('주간 55점 · ' + md(FX.tD2)) >= 0, JSON.stringify(r3));
  t('고등 ○○○4: 「단원 TEST 다항식 54점 · ' + md(FX.tD) + '」(테스트 이름 + 채점일) · 미정 · 시간·학습지 빈칸', r4 && r4.td[3].indexOf('단원 TEST 다항식 54점 · ' + md(FX.tD)) >= 0 && r4.td[4] === '미정' && r4.td[5] === '' && r4.td[6] === '' && r4.grp === 'mwf', JSON.stringify(r4));
  t('단원만 걸린 ○○○6: 「분수의 나눗셈」 60% · 미정 · 화목토 초등', r6 && /「분수의 나눗셈」 60%/.test(r6.td[3]) && !/점/.test(r6.td[3]) && r6.td[4] === '미정' && r6.grp === 'tts', JSON.stringify(r6));
  t('시간 칸: ○○○3 「✋ 11:00」(직접 · 예약 없음) · ○○○7 「⚠ 취소 13:00」 · ○○○2 「예약 아직」 · ○○○2 학습지 「아직」', r3 && r3.td[5] === '✋ 11:00' && r7 && r7.td[5] === '⚠ 취소 13:00' && r2 && r2.td[5] === '예약 아직' && r2.td[6] === '아직', JSON.stringify([r3 && r3.td[5], r7 && r7.td[5], r2 && r2.td[5], r2 && r2.td[6]]));
  t('요일 없는 반(X1) ○○○8 → 「그 밖」', r8 && r8.grp === 'etc', JSON.stringify(r8));
  /* ⑥ 완료 줄 */
  const doneRow = await q(() => { const g = document.querySelector('#CONTENT [data-rb174-group="tts"]'); const trs = [...g.querySelectorAll('tr[data-rb174-row]')]; const sub = trs.filter((tr) => tr.getAttribute('data-rb174-gk') === 'e'); return { order: sub.map((tr) => tr.getAttribute('data-rb174-row')), lastDone: sub.length && sub[sub.length - 1].classList.contains('rb174-done'), color: sub.length ? getComputedStyle(sub[sub.length - 1].querySelector('.rb174-nm')).color : '' }; });
  t('완료 줄(○○○5) — 초등 묶음 맨 아래 · 회색 · 「✅ ' + md(FX.today) + ' 완료」', doneRow.order.join(',') === 'S6,S5' && doneRow.lastDone && doneRow.color === 'rgb(148, 163, 184)' && r5 && r5.td[4] === '✅ ' + md(FX.today) + ' 완료' && r5.td[5] === '10:00', JSON.stringify([doneRow, r5 && r5.td]));

  /* ② 2분할 */
  const split = () => q(() => { const w = document.querySelector('#CONTENT [data-rb174-board]'), s = document.querySelector('#CONTENT [data-rb174-split]'); if (!s) return null; const cols = getComputedStyle(s).gridTemplateColumns.trim().split(/\s+/).length; const g = (k) => document.querySelector('#CONTENT [data-rb174-group="' + k + '"]'); const r = (k) => { const el = g(k); return el ? el.getBoundingClientRect() : null; }; return { two: w.classList.contains('rb174-two'), cols, mwf: r('mwf'), tts: r('tts'), etc: r('etc'), center: document.querySelector('.app > .right-panel').clientWidth }; });
  let S = await split();
  t('2분할(1400px · 가운데 ' + (S && S.center) + 'px ≥ 980): 월수금 왼쪽 · 화목토 오른쪽(같은 줄) · 그 밖은 아래 전체 폭', S && S.two && S.cols === 2 && S.tts.left > S.mwf.right - 1 && Math.abs(S.tts.top - S.mwf.top) < 2 && S.etc.top > Math.max(S.mwf.top, S.tts.top) && S.etc.width > S.mwf.width * 1.5, JSON.stringify(S));
  await pg.setViewportSize({ width: 1100, height: 950 }); await pg.waitForTimeout(500); await q(() => render()); await pg.waitForTimeout(300);
  S = await split();
  t('한 기둥(1100px): 화목토가 월수금 아래로', S && !S.two && S.cols === 1 && S.tts.top > S.mwf.bottom - 1, JSON.stringify(S));
  /* ⑩ 1024~1279: FAB 서랍 그대로 · 띠 없음 */
  const fab = await q(() => { const tp = document.getElementById('TOOL_PANEL'), fb = document.getElementById('L3_FAB'); return { rail: !!(tp && tp.classList.contains('l3-rail')), fab: !!(fb && fb.classList.contains('on') && getComputedStyle(fb).display !== 'none'), drawer: !!(tp && tp.classList.contains('l3-drawer')) }; });
  t('PC 1100px: 띠 없음 · 「🛠 도구」 FAB 보임 · 서랍 닫힘(지금 그대로)', fab && !fab.rail && fab.fab && !fab.drawer, JSON.stringify(fab));
  await q(() => rb174Pick('S1')); await pg.waitForTimeout(300);
  const fab2 = await q(() => { const tp = document.getElementById('TOOL_PANEL'); return { drawer: !!(tp && tp.classList.contains('l3-drawer')), stu: !!(tp && tp.querySelector('[data-rb174-stu="S1"]')), txt: tp ? tp.innerText.slice(0, 60) : '' }; });
  t('PC 1100px: 줄을 누르면 FAB 서랍이 학생 칸으로 열림', fab2.drawer && fab2.stu, JSON.stringify(fab2));
  await q(() => { l3Drawer(false); rb174Close(); });
  await pg.setViewportSize({ width: 1400, height: 950 }); await pg.waitForTimeout(500); await q(() => render()); await pg.waitForTimeout(300);
  S = await split(); t('다시 1400px → 2분할로 돌아옴', S && S.two && S.cols === 2, JSON.stringify(S && [S.two, S.cols]));

  /* ⑧ 도구 띠 기본 접힘 */
  const rail = () => q(() => { const tp = document.getElementById('TOOL_PANEL'); if (!tp) return null; const r = tp.getBoundingClientRect(); return { rail: tp.classList.contains('l3-rail'), open: tp.classList.contains('l3-rail-open'), w: tp.offsetWidth, icons: [...tp.querySelectorAll('.l3-rbar [data-l3-ric]')].map((b) => b.getAttribute('data-l3-ric')), pin: tp.querySelector('[data-l3-pin]') && tp.querySelector('[data-l3-pin]').getAttribute('data-l3-pin'), drawer: !!tp.querySelector('[data-l3-drawer]'), title: (tp.querySelector('.l3-rhead b') || {}).innerText || '', stu: (tp.querySelector('[data-rb174-stu]') || { getAttribute() { return ''; } }).getAttribute('data-rb174-stu'), tools: !!tp.querySelector('#l3r-rule') }; });
  let R = await rail();
  t('띠 기본 접힘: 44px · 아이콘 👤📝🛠📨🖨🔐 + 📌 꺼짐 · 서랍 없음', R && R.rail && !R.open && R.w === 44 && R.icons.join(',') === 'stu,rule,make,sms,print,acct' && R.pin === '0' && !R.drawer, JSON.stringify(R));
  /* ⑤·⑦ 줄 → 서랍 */
  await q(() => { document.querySelector('#CONTENT tr[data-rb174-row="S1"] .rb174-nm').click(); }); await pg.waitForTimeout(400);
  R = await rail();
  const sel = await q(() => { const tr = document.querySelector('#CONTENT tr[data-rb174-row="S1"]'); const d = document.querySelector('#TOOL_PANEL [data-rb174-stu="S1"]'); return { sel: tr && tr.classList.contains('rb174-sel'), head: d ? d.querySelector('.rb174-sh').innerText.replace(/\s+/g, ' ').trim() : '', txt: d ? d.innerText.replace(/\s+/g, ' ') : '', match: d && d.querySelector('[data-rb174-match]') && d.querySelector('[data-rb174-match]').getAttribute('data-rb174-match'), slots: d ? [...d.querySelectorAll('[data-rb174-slot]')].map((b) => b.getAttribute('data-rb174-slot') + (b.classList.contains('on') ? '*' : '') + (b.classList.contains('nv') ? '~' : '')) : [] }; });
  t('줄을 누르면 서랍 열림(344px) · 「👤 학생」 · 줄 강조', R && R.open && R.w === 344 && R.drawer && R.title === '👤 학생' && R.stu === 'S1' && sel.sel, JSON.stringify([R, sel.sel]));
  t('학생 칸: 「👤 ○○○1 중2 · M4」 · 🔥 · 「주간 52점 · ' + md(FX.tD) + '」 · 시험지 보기 · 🧩 매칭 「일차함수」 3문항 60% 교재 p.22~41 · 🔥 진짜 구멍', /👤 ○○○1 중2 · M4/.test(sel.head) && /주간 52점 · /.test(sel.txt) && /시험지 보기/.test(sel.txt) && sel.match === '1' && /일차함수 3문항 틀림 60% 개념\+유형 중2-1 p\.22~41 🔥 진짜 구멍/.test(sel.txt), JSON.stringify(sel));
  t('학생 칸: 🗓 시간 칩 10:00*(네이버 자동) · 11:00 · 13:00 · 📄 30문항 만듦 #8466 · 다시 설계 · 📨 안내문 · ✅ 완료 · ⛔ 노쇼 · 🛠 전체 도구(학습지 규칙)', sel.slots.join(',') === '10:00*,11:00,13:00' && /30문항 만듦/.test(sel.txt) && /#8466/.test(sel.txt) && /다시 설계/.test(sel.txt) && /📨 안내문 복사/.test(sel.txt) && /✅ 완료/.test(sel.txt) && /⛔ 노쇼/.test(sel.txt) && R.tools, JSON.stringify([sel.slots, R.tools]));
  /* 시간 칩 → rcSetSlot(기존 길) */
  const E = () => q((wk) => JSON.parse(JSON.stringify(RC.state.calls[wk])), FX.wk);
  const rcW = () => q(() => window.__W.filter((x) => x.key === 'rc_state').length);
  const w0 = await rcW();
  await q(() => { document.querySelector('#TOOL_PANEL [data-rb174-slot="13:00"]').click(); }); await pg.waitForTimeout(400);
  let e = await E(); const r1b = await rowOf('S1');
  const sel2 = await q(() => [...document.querySelectorAll('#TOOL_PANEL [data-rb174-slot]')].map((b) => b.innerText.trim() + (b.classList.contains('on') ? '*' : '')).join(','));
  t('서랍 시간 칩 13:00 → rcSetSlot: slot 13:00 · slotSrc manual · 저장 +1 · 줄 「✋ 13:00 ⚠」 · 칩 「13:00 ✋」', e.S1.slot === '13:00' && e.S1.slotSrc === 'manual' && (await rcW()) === w0 + 1 && r1b.td[5] === '✋ 13:00 ⚠' && /13:00 ✋\*/.test(sel2), JSON.stringify([e.S1, r1b && r1b.td[5], sel2]));
  await q(() => { document.querySelector('#TOOL_PANEL [data-rb174-slot="13:00"]').click(); }); await pg.waitForTimeout(500);
  e = await E();
  t('같은 칩 다시 → 해제 → 네이버 10:00 자동으로 돌아옴', e.S1.slot === '10:00' && e.S1.slotSrc === 'naver', JSON.stringify(e.S1));
  /* ⑤ 호출 토글 (줄에서) */
  await q(() => { document.querySelector('#CONTENT [data-rb174-tg="S4"]').click(); }); await pg.waitForTimeout(400);
  e = await E(); const r4b = await rowOf('S4');
  t('줄 ✓ 토글(○○○4) → rcToggleCall: on · snap(점수 54) · rc_state 저장 · 줄 「호출」 「예약 아직」 「아직」 · 묶음 머리 확정 4', e.S4 && e.S4.on === true && e.S4.snap && e.S4.snap.score === 54 && r4b.td[4] === '호출' && r4b.td[5] === '예약 아직' && r4b.td[6] === '아직' && (await q(() => [...document.querySelectorAll('#CONTENT .rb174-g1')].some((x) => /월 · 수 · 금 반 4명 · 🔥1 · 확정 4/.test(x.innerText.replace(/\s+/g, ' '))))), JSON.stringify([e.S4, r4b && r4b.td]));
  t('서랍은 ○○○1 그대로(다시 그려도 유지)', (await rail()).stu === 'S1');
  await q(() => { document.querySelector('#CONTENT [data-rb174-tg="S4"]').click(); }); await pg.waitForTimeout(300);
  e = await E(); t('다시 누르면 해제(on false)', e.S4 && e.S4.on === false, JSON.stringify(e.S4));
  /* 서랍 ✅ 완료 → rcMarkDone */
  await q(() => rb174Pick('S2')); await pg.waitForTimeout(300);
  await q(() => { document.querySelector('#TOOL_PANEL [data-rb174-act="done"]').click(); }); await pg.waitForTimeout(400);
  e = await E(); const r2b = await rowOf('S2');
  t('서랍 「✅ 완료」(○○○2) → rcMarkDone: done 오늘 · 줄 회색 · 중등 묶음 맨 아래 · 「↩ 완료 되돌리기」', e.S2.done === FX.today && /rb174-done/.test(r2b.cls) && (await q(() => { const trs = [...document.querySelectorAll('#CONTENT [data-rb174-group="mwf"] tr[data-rb174-row][data-rb174-gk="m"]')]; return trs[trs.length - 1].getAttribute('data-rb174-row') === 'S2' && !!document.querySelector('#TOOL_PANEL [data-rb174-act="undo"]'); })), JSON.stringify([e.S2, r2b && r2b.cls]));
  await q(() => { document.querySelector('#TOOL_PANEL [data-rb174-act="undo"]').click(); }); await pg.waitForTimeout(400);
  e = await E(); t('「↩ 완료 되돌리기」 → done 지움', !e.S2.done && e.S2.on === true, JSON.stringify(e.S2));

  /* ④ 보기 칩 거르기 */
  const vis = () => q(() => [...document.querySelectorAll('#CONTENT tr[data-rb174-row]')].map((tr) => tr.getAttribute('data-rb174-row')).join(','));
  await q(() => rb174Set('filter', 'fire')); await pg.waitForTimeout(300);
  t('칩 🔥 1순위 → ○○○1 만', (await vis()) === 'S1', await vis());
  await q(() => rb174Set('filter', 'pend')); await pg.waitForTimeout(300);
  t('칩 미정 → ○○○4 · ○○○6 · ○○○8', (await vis()).split(',').sort().join(',') === 'S4,S6,S8', await vis());
  await q(() => rb174Set('filter', 'nobook')); await pg.waitForTimeout(300);
  t('칩 예약 아직 → 확정인데 네이버 예약 없는 ○○○2 · ○○○3 · ○○○7(취소)', (await vis()).split(',').sort().join(',') === 'S2,S3,S7', await vis());
  await q(() => rb174Set('filter', 'done')); await pg.waitForTimeout(300);
  t('칩 완료 → ○○○5', (await vis()) === 'S5', await vis());
  await q(() => rb174Set('filter', 'all')); await pg.waitForTimeout(300);
  const cnt = await q(() => [...document.querySelectorAll('#CONTENT [data-rb174-chips="1"] [data-rb174-filter]')].map((b) => b.innerText.trim()).join('|'));
  t('칩 수: 전체 8 · 🔥 1순위 1 · 확정 4 · 미정 3 · 예약 아직 3 · 완료 1', cnt === '전체 8|🔥 1순위 1|확정 4|미정 3|예약 아직 3|완료 1', cnt);
  /* ④ 묶음 토글 → localStorage */
  await q(() => rb174Set('group', 'gradeday')); await pg.waitForTimeout(300);
  const G = await q(() => ({ ls: (typeof _origGetItem === 'function' ? _origGetItem('rc_board_view') : localStorage.getItem('rc_board_view')), heads: [...document.querySelectorAll('#CONTENT .rb174-g1')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), subs: [...document.querySelectorAll('#CONTENT [data-rb174-group="m"] .rb174-g2')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()), split: !!document.querySelector('#CONTENT [data-rb174-split]') }));
  t('묶음 「학년부 › 반」 → 머리 초등·중등·고등 · 중등 안 소제목 월수금 3 · 화목토 1 · 그 밖 1 · 2분할 없음 · 기기 localStorage rc_board_view 에 저장', G.heads.length === 3 && /^초등 2명/.test(G.heads[0]) && /^중등 5명/.test(G.heads[1]) && /^고등 1명/.test(G.heads[2]) && G.subs.join('|') === '월 · 수 · 금 반 3|화 · 목 · 토 반 1|그 밖 1' && !G.split && /"group":"gradeday"/.test(G.ls || ''), JSON.stringify(G));
  await q(() => rb174Set('group', 'none')); await pg.waitForTimeout(300);
  t('묶음 「없음」 → 머리·소제목 없이 한 표 8줄', (await q(() => document.querySelectorAll('#CONTENT .rb174-g1').length === 0 && document.querySelectorAll('#CONTENT .rb174-g2').length === 0 && document.querySelectorAll('#CONTENT tr[data-rb174-row]').length === 8)));
  await q(() => rb174Set('group', 'daygrade')); await pg.waitForTimeout(300);
  t('보기 설정은 서버(lumen_store)로 안 감', (await q(() => window.__W.filter((x) => /rc_board_view|l3_tools_pin/.test(String(x.key))).length === 0)));

  /* ⑧ 📌 핀 기억 */
  await q(() => rb174Close()); await pg.waitForTimeout(200);
  R = await rail(); t('✕ 닫기 → 띠로 접힘', R && !R.open && R.w === 44, JSON.stringify(R));
  await q(() => { document.querySelector('#TOOL_PANEL [data-l3-pin]').click(); }); await pg.waitForTimeout(300);
  R = await rail();
  t('📌 → 늘 펼침(도구 서랍) · localStorage l3_tools_pin=1', R && R.open && R.pin === '1' && R.tools && (await q(() => (typeof _origGetItem === 'function' ? _origGetItem('l3_tools_pin') : localStorage.getItem('l3_tools_pin')) === '1')), JSON.stringify(R));
  await q(() => { RB174.open = false; render(); }); await pg.waitForTimeout(300);
  R = await rail(); t('핀이면 다시 그려도 펼친 채', R && R.open, JSON.stringify(R));
  /* ⑨ 다른 3분할 화면 회귀 */
  await q(() => { VIEW = 'examhit'; GRP = groupOfView('examhit'); render(); }); await pg.waitForTimeout(500);
  R = await rail();
  const hit = await q(() => ({ tool: !!document.querySelector('#TOOL_PANEL .l3-rdrawer .l3-tool'), none: !!document.querySelector('#TOOL_PANEL #l3h-none') || !!document.querySelector('#TOOL_PANEL #l3h-server') }));
  t('적중 분석: 띠(🛠 하나 + 📌) · 핀이라 서랍 열림 · 적중 분석 도구 그대로(서버 상태 칸)', R && R.rail && R.open && R.icons.join(',') === 'tools' && hit.tool && hit.none, JSON.stringify([R, hit]));
  await q(() => { document.querySelector('#TOOL_PANEL [data-l3-pin]').click(); }); await pg.waitForTimeout(300);
  R = await rail(); t('적중 분석에서 📌 끄기 → 접힘 · l3_tools_pin=0', R && !R.open && R.pin === '0', JSON.stringify(R));
  await q(() => { VIEW = 'blank'; GRP = groupOfView('blank'); render(); }); await pg.waitForTimeout(500);
  R = await rail();
  await q(() => { document.querySelector('#TOOL_PANEL [data-l3-ric="tools"]').click(); }); await pg.waitForTimeout(400);
  const bt = await q(() => { const tp = document.getElementById('TOOL_PANEL'); return { open: tp.classList.contains('l3-rail-open'), txt: tp.innerText.replace(/\s+/g, ' ').slice(0, 200) }; });
  t('백지테스트: 띠 접힘 → 🛠 누르면 서랍에 백지테스트 도구(과정·문항 수·만들기)', R && R.rail && !R.open && bt.open && /과정|문항 수|만들기/.test(bt.txt), JSON.stringify([R && R.open, bt]));
  await q(() => { VIEW = 'home'; GRP = groupOfView('home'); render(); }); await pg.waitForTimeout(400);
  t('도구 없는 화면(홈): 도구 칸 접힘(l3-empty) · 띠 없음', (await q(() => { const tp = document.getElementById('TOOL_PANEL'); return tp.classList.contains('l3-empty') && !tp.classList.contains('l3-rail'); })));
  /* 왼쪽 기둥·장부·통계 그대로 */
  await q(() => { VIEW = 'recovery'; GRP = groupOfView('recovery'); RC.view = 'board'; render(); }); await pg.waitForTimeout(500);
  t('왼쪽 기둥(이번 주 4칸 · 명단) · 📒 장부 · 📊 통계 탭 · 요약 4칸 · 기준 줄 그대로', (await q(() => !!document.querySelector('[data-rn153-week]') && document.querySelectorAll('#CONTENT [data-rn153-tab]').length === 3 && /🚨 예상 명단/.test(document.getElementById('CONTENT').innerText) && /선발 기준:/.test(document.getElementById('CONTENT').innerText))));
  /* 왼쪽 기둥 이름 → 줄 선택 */
  await q(() => rb174Close()); await pg.waitForTimeout(200);
  const lc = await q(() => { const b = document.querySelector('[data-l3r-stu="S3"]'); if (b) b.click(); return !!b; }); await pg.waitForTimeout(500);
  const lcR = await q(() => { const tr = document.querySelector('#CONTENT tr[data-rb174-row="S3"]'); return { tr: !!tr, sel: !!(tr && tr.classList.contains('rb174-sel')), stu: !!document.querySelector('#TOOL_PANEL [data-rb174-stu="S3"]'), st: [RB174.sel, RB174.kind, RB174.open] }; });
  t('왼쪽 기둥에서 이름을 누르면 그 줄 강조 + 서랍 학생 칸', lc && lcR.sel && lcR.stu, JSON.stringify([lc, lcR]));
  if (SHOT) { await q(() => rb174Pick('S1')); await pg.waitForTimeout(400); await pg.screenshot({ path: SHOT, fullPage: false }); }
  await q(() => rcSetView('ledger')); await pg.waitForTimeout(300);
  t('📒 장부 탭은 줄 표 없이 그대로', (await q(() => !document.querySelector('[data-rb174-board]') && /운영 장부|장부/.test(document.getElementById('CONTENT').innerText))));
  await q(() => rcSetView('stats')); await pg.waitForTimeout(300);
  t('📊 통계 탭 그대로', (await q(() => !!document.querySelector('[data-rn153-statsview]') && !document.querySelector('[data-rb174-board]'))));
  await q(() => rcSetView('board')); await pg.waitForTimeout(300);
  /* ⑪ 카드 보기 */
  await q(() => rb174Set('mode', 'cards')); await pg.waitForTimeout(400);
  const C = await q(() => ({ cards: (document.getElementById('CONTENT').innerHTML.match(/border-radius:15px;padding:13px 16px;margin-bottom:10px/g) || []).length, qsa: document.querySelectorAll('#CONTENT div[style*="padding:13px 16px"]').length, tg: (document.getElementById('CONTENT').innerHTML.match(/rcToggleCall\(/g) || []).length, side: /📞 확정 명단 · 시간 배분/.test(document.getElementById('CONTENT').innerText), table: !!document.querySelector('[data-rb174-board]'), back: !!document.querySelector('#CONTENT [data-rb174-mode="table"]'), ls: (typeof _origGetItem === 'function' ? _origGetItem('rc_board_view') : localStorage.getItem('rc_board_view')) }));
  t('「🗂 카드 보기」 → 옛 카드 보드(카드 8장 + 📞 확정 명단 칸) · 「☰ 줄 표 보기」 칩 · 기억', C.cards === 8 && C.side && !C.table && C.back && /"mode":"cards"/.test(C.ls || ''), JSON.stringify(C));
  await q(() => rb174Set('mode', 'table')); await pg.waitForTimeout(300);
  t('「☰ 줄 표 보기」 → 줄 표로', (await q(() => !!document.querySelector('[data-rb174-board]') && !/border-radius:15px;padding:13px 16px;margin-bottom:10px/.test(document.getElementById('CONTENT').innerHTML))));
  /* 폰 */
  await pg.setViewportSize({ width: 600, height: 900 }); await pg.waitForTimeout(400); await q(() => { RC.view = 'board'; render(); }); await pg.waitForTimeout(300);
  await q(() => { rb174Close(); rb174Pick('S1'); }); await pg.waitForTimeout(300);
  t('폰(600px): 줄 표 한 기둥 · 줄을 누르면 팝업에 학생 칸', (await q(() => !!document.querySelector('[data-rb174-board]') && !document.querySelector('[data-rb174-board]').classList.contains('rb174-two') && !!document.querySelector('#rc-pop [data-rb174-stu="S1"]'))));
  await q(() => { try { rcPopClose(); } catch (e) {} });

  /* ⑫ 안전 */
  const ws = await q(() => window.__W.map((x) => x.key));
  t('안전: 쓰기는 rc_state 와 등록부(완료 → 출결 기록)만 · 네이버 예약·기본 시간대·보기 설정은 안 씀', !ws.some((k) => /^naver|^rc_config$|rc_board_view|l3_tools_pin|rc_ws_rule/.test(String(k))), JSON.stringify(ws));
  /* 읽기(GET)는 부팅 때 시작된 것이 인증 잠금 뒤에 늦게 나가는 일이 있어(전부 차단되어 무해) 수만 적는다 */
  console.log('ℹ️ 가짜를 심은 뒤 차단된 읽기 ' + reqs.filter((r) => /^after:GET/.test(r)).length + '건 (모두 외부망 차단)');
  t('실서버 쓰기(POST/PATCH) 없음', reqs.filter((r) => /^after:(POST|PATCH|PUT|DELETE)/.test(r)).length === 0, reqs.filter((r) => /^after:(POST|PATCH|PUT|DELETE)/.test(r)).slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
