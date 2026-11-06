#!/usr/bin/env node
/* 학원앱 v19-174 검사 — 🚑 리커버리 보드 2판 (docs/recovery_tab_contract.md §9 · 시안 docs/mockup_recovery_compact.html)
 *   가짜 서버(lumen_store: or_studentdb 8명 · rc_config · rc_state · naver_bookings · mf_weekly · mf_progress · mf_books / mf_students 표) · 외부망 전부 차단
 *   가짜 이름 ○○○1~8 · 월수금 반(M4·M7·H1) · 화목토 반(T630·T5·T730) · 요일 없는 반(X1 → 그 밖) · 초·중·고 섞어
 *   ① 줄 표 · 묶음 머리·소제목·인원 ② 2분할(1400px) / 한 기둥(1100px) ③ 날짜 표기(매쓰플랫 채점일) ④ 보기 칩 거르기 · 묶음 토글 → localStorage rc_board_view
 *   ⑤ 호출 토글 → rc_state(기존 길) ⑥ 완료 줄 회색 맨 아래 ⑦ 서랍(학생 칸 · 시간 칩 → rcSetSlot · ✅ 완료) ⑧ 띠 접힘 기본 · 📌 기억
 *   ⑨ 적중 분석·백지테스트 띠·서랍(회귀) ⑩ 1024~1279 FAB 그대로 ⑪ 카드 보기 되돌림 ⑫ 실서버 쓰기 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19181.js lumen_v19-181.html [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-181.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-181'])[0];
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
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { window.__W.push({ tbl, key: r.key, value: JSON.parse(JSON.stringify(r.value === undefined ? null : r.value)) }); if (tbl === 'lumen_store' && r.key === 'ws_make_req') window.__STORE[r.key] = JSON.parse(JSON.stringify(r.value)); }); return Promise.resolve({ error: null }); },
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
  const q = (fn, arg) => pg.evaluate(fn, arg);
  const W = () => q(() => window.__W.filter((x) => x && x.key === 'ws_make_req').map((x) => x.value));
  t('버전 ' + WANT, (await q(() => APP_VER)) === WANT);
  t('부품이 붙음: RQ · rqLoad · rqBand · rqDirect · HTS_WAKE_KEYS.ws_make_req', await q(() => typeof RQ === 'object' && typeof rqLoad === 'function' && typeof rqBand === 'function' && typeof rqDirect === 'function' && HTS_WAKE_KEYS.ws_make_req === 1));
  t('PULL_SKIP_KEYS 에 ws_make_req', await q(() => PULL_SKIP_KEYS.indexOf('ws_make_req') >= 0));
  /* 매쓰플랫 직접 호출 감시 */
  await q(() => { window.__MF = 0; const of = window.fetch; window.fetch = function (u) { if (/mathflat/.test(String(u))) window.__MF++; return of.apply(this, arguments); }; });
  await q(() => { window.__STORE.ws_make_req = { status: 'done', wk: '2026-08-15', by: 'test' }; RQ.at = 0; });
  await q(() => rcMakeWsAll()); await pg.waitForTimeout(500);
  let w = await W();
  t('⚡ 누름 → ws_make_req = {status:requested, wk:이번 주, by:app}', w.length === 1 && w[0].status === 'requested' && w[0].wk === FX.wk && w[0].by === 'app' && !!w[0].reqAt, JSON.stringify(w));
  t('매쓰플랫을 직접 부르지 않음', (await q(() => window.__MF)) === 0);
  await q(() => render()); await pg.waitForTimeout(200);
  t('보드 맨 위 띠 「예약했습니다」', await q(() => { const b = document.querySelector('#CONTENT .rq-band'); return !!b && /예약했습니다/.test(b.innerText); }));
  await q(() => rcMakeWsAll()); await pg.waitForTimeout(400);
  t('이미 예약됨 → 다시 쓰지 않음', (await W()).length === 1);
  /* 서버가 running 으로 */
  await q((wk) => { window.__STORE.ws_make_req = { status: 'running', wk, total: 16, done: 7, items: [{ key: 'S1', name: '○○○', ok: true, wsId: 1, n: 30 }, { key: 'S2', name: '△○○', ok: false, why: 'error' }] }; }, FX.wk);
  await q(() => rqLoad(true)); await pg.waitForTimeout(300); await q(() => render()); await pg.waitForTimeout(200);
  const run = await q(() => { const b = document.querySelector('#CONTENT .rq-band'); return b ? b.innerText : ''; });
  t('running → 「7/16명」 · 남은 시간 · 못 만든 학생', /7\/16명/.test(run) && /분 남음/.test(run) && /못 만든 학생/.test(run), run);
  t('도구 「만들기」 단추 = 「⏳ 서버가 만드는 중」(눌림 막힘)', await q(() => { const tp = RIGHT_TOOLS.recovery(); return /id="l3r-all" disabled>⏳ 서버가 만드는 중/.test(tp); }));
  /* done → 학습지 기록 다시 읽기 */
  await q(() => { window.__RCL = 0; const o = rcwsLoad; rcwsLoad = function () { window.__RCL++; return o.apply(this, arguments); }; });
  await q((wk) => { window.__STORE.ws_make_req = { status: 'done', wk, total: 16, done: 16, madeN: 16, totalProblems: 1173, finishedAt: new Date().toISOString(), items: [] }; }, FX.wk);
  await q(() => rqLoad(true)); await pg.waitForTimeout(400); await q(() => render()); await pg.waitForTimeout(200);
  const dn = await q(() => { const b = document.querySelector('#CONTENT .rq-band'); return b ? b.innerText : ''; });
  t('done → 「✅ 16명 완료 · 1,173문항」', /16명 완료/.test(dn) && /1,173문항/.test(dn), dn);
  t('done 이 되면 학습지 기록(rc_ws_made) 다시 읽음', (await q(() => window.__RCL)) >= 1);
  /* stopped */
  await q((wk) => { window.__STORE.ws_make_req = { status: 'stopped', wk, total: 16, done: 3, note: '매쓰플랫 보안 확인 후 다시 눌러 주세요', items: [] }; }, FX.wk);
  await q(() => rqLoad(true)); await pg.waitForTimeout(300); await q(() => render()); await pg.waitForTimeout(200);
  const sp = await q(() => { const b = document.querySelector('#CONTENT .rq-band'); return b ? { t: b.innerText, btn: !!b.querySelector('button') } : null; });
  t('stopped → 이유 그대로 · 「다시 예약」 단추', sp && /보안 확인/.test(sp.t) && sp.btn, JSON.stringify(sp));
  /* 다른 주 요청은 띠 없음 */
  await q(() => { window.__STORE.ws_make_req = { status: 'running', wk: '2026-01-03', total: 5, done: 1 }; }); await q(() => rqLoad(true)); await pg.waitForTimeout(300); await q(() => render()); await pg.waitForTimeout(200);
  t('다른 주 요청이면 띠 없음', await q(() => !document.querySelector('#CONTENT .rq-band')));
  t('🔐 계정 칸에 「서버 예약은 계정이 필요 없어요」', await q(() => /서버 예약은 계정이 필요 없어요/.test(RIGHT_TOOLS.recovery())));
  t('도구 칸에 「🧯 비상: 이 PC 에서 바로」', await q(() => /비상: 이 PC 에서 바로/.test(RIGHT_TOOLS.recovery())));
  t('보드 줄 표(v19-174) 그대로', await q(() => !!document.querySelector('#CONTENT [data-rb174-board]')));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
