#!/usr/bin/env node
/* 학원앱 v19-154 검사 — 🚑 리커버리 「🔄 채점 새로고침」 · 「↻ 다시 읽기」 (원장 2026-10-23 「새로고침 단추 넣어줘」)
 *   가짜 서버·자료 심기는 test_v19153.js 와 같다(가짜 이름만). 그 아래가 v19-154 검사.
 *   가짜 서버(lumen_store: or_studentdb 6명 · rc_config · rc_state · naver_bookings · lumen_group_days · mf_weekly / mf_students 표) · 외부망 차단
 *   이름은 가짜(홍길동·박하나·이순신·김유신·장보고·신사임당) · 쓰기는 window.__W 에 모은다
 *   이번 주 확정 5명: 자동 대상 2(홍길동 시간 없음 → 09:00 · 박하나 옛 10:00 → 11:00) · 손으로 고른 1(이순신 ✋10:00, 예약 11:00) · 취소 1(김유신 11:00 naver) · 예약 없음 1(장보고)
 *   A 1~5 · B 기둥 6칸 · C 통계 숫자(다음 테스트 ± 계산 포함) · D-1 홈 줄 · 저장 횟수 · 안내문/학생앱 알림이 자동 시간을 쓰는지
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19153.js lumen_v19-154.html  (SHOT=<폴더> 를 주면 보드·통계·홈 화면 사진도) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-154.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1500, height: 950 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
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

  /* ── 가짜 자료 심기 (날짜는 오늘 기준으로) ── */
  const FX = await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const add = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const wk = rcWeekKey(), recDt = add(today, 1), wkB = add(wk, -14), wkC = add(wk, -21);
    const STU = [
      { id: 'S1', name: '홍길동', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' },
      { id: 'S2', name: '박하나', grade: '초등학교 6학년', group: 'M3', lumen_rec_code: 'BBB222' },
      { id: 'S3', name: '이순신', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'CCC333' },
      { id: 'S4', name: '김유신', grade: '중학교 3학년', group: 'T7', lumen_rec_code: 'DDD444' },
      { id: 'S5', name: '장보고', grade: '중학교 1학년', group: 'T3', lumen_rec_code: 'EEE555' },
      { id: 'S6', name: '신사임당', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'FFF666' }];
    students.length = 0; STU.forEach((s) => students.push(JSON.parse(JSON.stringify(s))));
    window.__TABLES.mf_students = STU.map((s, i) => ({ mf_student_id: 'M' + (i + 1), name: s.name, lumen_rec_code: s.lumen_rec_code }));
    const sn = (name, grade, score, extra) => Object.assign({ name, group: '', grade, score, rx: [], holes: 0, rxN: 0, units: [] }, extra || {});
    const calls = {};
    calls[wk] = {
      S1: { on: true, snap: sn('홍길동', '중학교 2학년', 55) },
      S2: { on: true, slot: '10:00', snap: sn('박하나', '초등학교 6학년', 60) },
      S3: { on: true, slot: '10:00', slotSrc: 'manual', snap: sn('이순신', '중학교 2학년', 65) },
      S4: { on: true, slot: '11:00', slotSrc: 'naver', snap: sn('김유신', '중학교 3학년', 75) },
      S5: { on: true, manual: true, snap: sn('장보고', '중학교 1학년', null, { rx: ['원장님 직접 지정'] }) } };
    calls[wkB] = {
      S1: { on: true, done: wkB, snap: sn('홍길동', '중학교 2학년', 40, { units: [{ n: '일차방정식', rate: 40 }] }) },
      S2: { on: true, done: wkB, snap: sn('박하나', '초등학교 6학년', 70) },
      S3: { on: true, noshow: true, snap: sn('이순신', '중학교 2학년', 50) },
      S4: { on: true, done: wkB, ws: { wsId: 1, n: 12, correct: 9, total: 12 }, snap: sn('김유신', '중학교 3학년', null, { units: [{ n: '원의 성질', rate: 50 }] }) } };
    calls[wkC] = {
      S1: { on: true, done: wkC, snap: sn('홍길동', '중학교 2학년', 25) },
      S5: { on: true, done: wkC, manual: true, snap: sn('장보고', '중학교 1학년', null, { rx: ['원장님 직접 지정'] }) } };
    const dates = {}; dates[wk] = recDt;
    const W = (sid, score, date) => ({ sid, score, correct: Math.round(score / 5), total: 20, date, wrongConcepts: [] });
    const bk = (id, k, date, start, kind, cancelled) => ({ id, item: { id: 'I' + kind, name: kind === 'recovery' ? '리커버리 클래스' : '텐투텐', kind }, status: cancelled ? { k: 'cancelled', label: '취소' } : { k: 'confirmed', label: '확정' }, date, start, end: '', match: { stKey: k, how: 'phone' } });
    Object.assign(window.__STORE, {
      or_studentdb: STU,
      rc_config: { minScore: 80, minUnit: 60, elem6Score: 75, weeks: 3, slots: ['10:00', '11:00', '13:00'], range: null },
      rc_state: { calls, dates, periods: {} },
      lumen_group_days: { T5: [2, 4], M3: [1, 3], T7: [2, 4], T3: [1, 5], H1: [3, 6] },
      mf_weekly: { tests: [
        { wid: 11, key: 'w11', type: 'WEEKLY', title: '중2 주간 A', date: add(wkC, 4), students: [W('M1', 40, add(wkC, 4))] },
        { wid: 12, key: 'w12', type: 'WEEKLY', title: '초6 주간', date: add(wkB, 2), students: [W('M2', 65, add(wkB, 2))] },
        { wid: 13, key: 'w13', type: 'WEEKLY', title: '중2 주간 B', date: add(wkB, 3), students: [W('M1', 60, add(wkB, 3)), W('M3', 90, add(wkB, 3))] },
        { wid: 14, key: 'w14', type: 'WEEKLY', title: '중2 주간 C', date: add(wkB, 5), students: [W('M1', 80, add(wkB, 5))] },
        { wid: 15, key: 'w15', type: 'HIGH_TEST', title: '고1 테스트', date: add(today, -2), students: [W('M6', 50, add(today, -2))] }] },
      naver_bookings: { at: new Date().toISOString(), ok: true, items: [], bookings: [
        bk('b1', 'S1', recDt, '09:00', 'recovery'), bk('b2', 'S2', recDt, '11:00', 'recovery'), bk('b3', 'S3', recDt, '11:00', 'recovery'),
        bk('b4', 'S4', recDt, '11:00', 'recovery', true), bk('b6', 'S6', recDt, '13:00', 'recovery'),
        bk('b7', 'S1', add(today, -14), '09:30', 'recovery'), bk('b8', 'S2', add(today, -70), '15:00', 'recovery'), bk('b9', 'S3', today, '16:00', 'tenten')] },
      naver_booking_links: {} });
    window.getSupaClient = window.__FAKE;
    RC.loaded = false; RC.view = 'board'; RC.cfg.slots = ['10:00', '11:00', '13:00']; BP.loaded = false; WK.loaded = false;
    NBK.loaded = false; NBK.at = 0; NBK.loading = false; NBK.data = null;
    RCWS.made = { S1: { wk, wsId: 5, n: 10, parts: {} } }; RCWS.loaded = true;
    window.__W.length = 0;
    VIEW = 'recovery'; render();
    return { today, wk, recDt, wkB, wkC };
  });
  await pg.waitForTimeout(1800);
  await pg.evaluate(() => render()); await pg.waitForTimeout(400);

  await pg.evaluate(() => { window.__STORE.mf_weekly.updated = new Date(Date.now() - 25 * 60000).toISOString(); RC154.t = 0; RC154.at = ''; render(); });
  await pg.waitForTimeout(500); await pg.evaluate(() => render()); await pg.waitForTimeout(200);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-154');
  const bar = () => pg.evaluate(() => { const b = document.getElementById('rc154-bar'); return b ? b.innerText.replace(/\s+/g, ' ') : ''; });
  let B = await bar();
  t('① 보드 머리 아래 «📡 매쓰플랫 채점 자료 · 마지막 수집 HH:MM (25분 전)»', /📡 매쓰플랫 채점 자료 · 마지막 수집 \d\d:\d\d \(2[45]분 전\)/.test(B), B);
  t('① 「🔄 채점 새로고침」·「↻ 다시 읽기」 단추', /🔄 채점 새로고침/.test(B) && /↻ 다시 읽기/.test(B), B);
  t('① 탭 줄(이번 주 보드·운영 장부·📊 통계) 바로 위', await pg.evaluate(() => { const b = document.getElementById('rc154-bar'); const n = b && b.nextElementSibling; return !!(n && /이번 주 보드/.test(n.innerText) && /통계/.test(n.innerText)); }));
  t('② 머리의 옛 새로고침도 다시 읽기로 (rcLoad(true).then 남지 않음)', await pg.evaluate(() => { const c = document.getElementById('CONTENT').innerHTML; return c.indexOf('rcLoad(true).then') < 0 && c.indexOf('rc154Reload()') >= 0; }));

  /* ② 다시 읽기 — 서버에 새 주간테스트가 생기면 앱이 읽는다 (예전엔 rcLoad(true) 가 wkLoad 를 안 다시 불러 그대로였다) */
  const n0 = await pg.evaluate(() => (WK.tests || []).length);
  await pg.evaluate((today) => { window.__STORE.mf_weekly.tests.push({ wid: 99, key: 'w99', type: 'WEEKLY', title: '중1 주간 새것', date: today, students: [{ sid: 'M5', score: 30, correct: 6, total: 20, date: today, wrongConcepts: [] }] }); window.__STORE.mf_weekly.updated = new Date().toISOString(); }, FX.today);
  await pg.evaluate(() => rcLoad(true)); await pg.waitForTimeout(300);
  t('② (옛 방식) rcLoad(true) 만으로는 새 주간테스트를 못 읽음 — 고친 까닭 확인', (await pg.evaluate(() => (WK.tests || []).length)) === n0);
  await pg.click('#rc154-reload'); await pg.waitForTimeout(900);
  t('② 「↻ 다시 읽기」 → 새 주간테스트까지 읽음', (await pg.evaluate(() => (WK.tests || []).length)) === n0 + 1, (await pg.evaluate(() => (WK.tests || []).length)) + ' vs ' + n0);
  B = await bar();
  t('② 다시 읽기 뒤 «마지막 수집» 이 방금으로 바뀜', /마지막 수집 \d\d:\d\d \((방금|1분 전)\)/.test(B), B);
  t('② 다시 읽기는 서버에 쓰지 않음(rc_state 자동 맞춤 빼고)', await pg.evaluate(() => window.__W.filter((x) => x.key === 'mf_collect_req' || x.key === 'mf_weekly').length === 0));

  /* ③ 채점 새로고침 — mf_collect_req 요청 */
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('#rc154-btn'); await pg.waitForTimeout(600);
  let q = await pg.evaluate(() => window.__W.filter((x) => x.key === 'mf_collect_req').map((x) => x.value));
  t('③ 「🔄 채점 새로고침」 → mf_collect_req {status:requested, by:recovery, date:오늘}', q.length === 1 && q[0].status === 'requested' && q[0].by === 'recovery' && q[0].date === FX.today && /^\d{4}-/.test(q[0].reqAt), JSON.stringify(q));
  B = await bar();
  t('③ 단추가 «⏳ 요청됨 · 곧 시작 · 요청 HH:MM · 누르면 취소»', /⏳ 요청됨 · 곧 시작 요청 \d\d:\d\d · 누르면 취소/.test(B), B);
  t('③ 요청 중엔 30초 감시가 돈다', await pg.evaluate(() => !!RC154.poll));
  await pg.evaluate(() => { window.__W.length = 0; }); await pg.click('#rc154-btn'); await pg.waitForTimeout(500);
  q = await pg.evaluate(() => window.__W.filter((x) => x.key === 'mf_collect_req').map((x) => x.value));
  t('③ 요청됨일 때 다시 누르면 취소(cancelled)', q.length === 1 && q[0].status === 'cancelled', JSON.stringify(q));
  t('③ 취소 뒤 다시 「🔄 채점 새로고침」', /🔄 채점 새로고침/.test(await bar()));

  /* ④ 수집 중 · 끝남 */
  await pg.evaluate(() => { window.__STORE.mf_collect_req = { status: 'running', reqAt: new Date().toISOString(), note: '학습지 12/40' }; RC154.t = 0; return rc154Meta().then(() => render()); }); await pg.waitForTimeout(200);
  t('④ 수집 중 → «🔄 수집 중… 학습지 12/40»', /🔄 수집 중… 학습지 12\/40/.test(await bar()), await bar());
  const wBefore = await pg.evaluate(() => (WK.tests || []).length);
  await pg.evaluate((today) => { window.__STORE.mf_weekly.tests.push({ wid: 100, key: 'w100', type: 'WEEKLY', title: '초6 주간 새것', date: today, students: [{ sid: 'M2', score: 40, correct: 8, total: 20, date: today, wrongConcepts: [] }] });
    window.__STORE.mf_collect_req = { status: 'done', reqAt: new Date(Date.now() - 15 * 60000).toISOString(), finishedAt: new Date().toISOString(), result: { students: 28 } };
    clearInterval(RC154.poll); RC154.poll = null; RC154.req = { status: 'running' };
    /* 30초 감시 한 번을 바로 돌린다 */
    const orig = window.setInterval; window.setInterval = (fn) => { setTimeout(fn, 10); return 777; }; rc154Poll(); window.setInterval = orig; }, FX.today);
  await pg.waitForTimeout(1500); await pg.evaluate(() => render()); await pg.waitForTimeout(200);
  t('④ 끝나면 저절로 다시 읽음(새 주간테스트 들어옴)', (await pg.evaluate(() => (WK.tests || []).length)) === wBefore + 1);
  t('④ 끝난 뒤 10분은 «🕓 방금 모음 · n분 후 다시 가능»(누를 수 없음)', await pg.evaluate(() => { const b = document.getElementById('rc154-btn'); return !!(b && b.disabled && /방금 모음/.test(b.innerText) && /분 후 다시 가능/.test(b.innerText)); }), await bar());

  /* ⑤ 다른 화면 · 오류 */
  await pg.evaluate(() => { RC.view = 'stats'; render(); }); await pg.waitForTimeout(300);
  t('⑤ 📊 통계 탭(v19-153)도 그대로 그려짐 · 새로고침 줄 있음', await pg.evaluate(() => /통계/.test(document.getElementById('CONTENT').innerText) && !!document.getElementById('rc154-bar')));
  await pg.evaluate(() => { RC.view = 'board'; render(); }); await pg.waitForTimeout(300);
  t('⑤ 등록부(or_studentdb)에 쓰지 않음', await pg.evaluate(() => window.__W.filter((x) => x.key === 'or_studentdb').length === 0));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
