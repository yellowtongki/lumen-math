#!/usr/bin/env node
/* 학원앱 v19-153 검사 — 🚑 리커버리: 네이버 예약 시간 자동 연동 · 전용 왼쪽 기둥 · 📊 통계 · 홈 «예약 아직» (docs/recovery_tab_contract.md §5)
 *   가짜 서버(lumen_store: or_studentdb 6명 · rc_config · rc_state · naver_bookings · lumen_group_days · mf_weekly / mf_students 표) · 외부망 차단
 *   이름은 가짜(홍길동·박하나·이순신·김유신·장보고·신사임당) · 쓰기는 window.__W 에 모은다
 *   이번 주 확정 5명: 자동 대상 2(홍길동 시간 없음 → 09:00 · 박하나 옛 10:00 → 11:00) · 손으로 고른 1(이순신 ✋10:00, 예약 11:00) · 취소 1(김유신 11:00 naver) · 예약 없음 1(장보고)
 *   A 1~5 · B 기둥 6칸 · C 통계 숫자(다음 테스트 ± 계산 포함) · D-1 홈 줄 · 저장 횟수 · 안내문/학생앱 알림이 자동 시간을 쓰는지
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19153.js lumen_v19-153.html  (SHOT=<폴더> 를 주면 보드·통계·홈 화면 사진도) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-153.html');
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

  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-153');
  const E = () => pg.evaluate((wk) => JSON.parse(JSON.stringify(RC.state.calls[wk])), FX.wk);
  const rcW = () => pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_state'));
  let e = await E();
  /* A-1 자동 맞춤 */
  t('A1 홍길동(시간 없음) → 예약 09:00 · slotSrc naver · slotAt', e.S1.slot === '09:00' && e.S1.slotSrc === 'naver' && /^\d{4}-/.test(e.S1.slotAt || ''), JSON.stringify(e.S1));
  t('A1 박하나(옛 10:00, 직접 표시 없음) → 예약 11:00 으로 따라감', e.S2.slot === '11:00' && e.S2.slotSrc === 'naver', JSON.stringify(e.S2));
  t('A2 이순신(✋ 직접 10:00) → 덮지 않음', e.S3.slot === '10:00' && e.S3.slotSrc === 'manual', JSON.stringify(e.S3));
  t('A4 김유신(예약 취소 · naver 11:00) → 시간 그대로', e.S4.slot === '11:00' && e.S4.slotSrc === 'naver', JSON.stringify(e.S4));
  t('A 장보고(예약 없음) → 시간 없음', !e.S5.slot && !e.S5.slotSrc, JSON.stringify(e.S5));
  let w = await rcW();
  t('저장 — 두 학생 바뀜을 한 번에 모아 rc_state 1회', w.length === 1 && w[0].value.calls[FX.wk].S1.slot === '09:00' && w[0].value.calls[FX.wk].S2.slotSrc === 'naver', 'writes=' + w.length);
  await pg.evaluate(() => { render(); render(); }); await pg.waitForTimeout(400);
  t('저장 — 바뀐 것이 없으면 다시 그려도 쓰기 0회', (await rcW()).length === 1, 'writes=' + (await rcW()).length);
  t('저장 — 원장 기본 시간대(rc_config)는 안 씀 · 메모리도 그대로', (await pg.evaluate(() => window.__W.filter((x) => x.key === 'rc_config').length === 0 && RC.cfg.slots.join(',') === '10:00,11:00,13:00')));

  /* A 오른쪽 확정 명단 */
  const side = () => pg.evaluate(() => {
    const out = {}; document.querySelectorAll('#CONTENT [data-rn153-k]').forEach((b) => { const k = b.getAttribute('data-rn153-k'); (out[k] = out[k] || []).push({ t: b.getAttribute('data-rn153-slot'), nv: b.classList.contains('rn153-nv'), on: /background:#1d6fe8/.test(b.getAttribute('style') || '') }); });
    return out; });
  let S = await side();
  t('A3 칩 = 기본 + 그 날·8주 네이버 시간, 시간순 (09:00 · 09:30 · 10:00 · 11:00 · 13:00)', S.S1 && S.S1.map((x) => x.t).join(',') === '09:00,09:30,10:00,11:00,13:00', JSON.stringify(S.S1));
  t('A3 70일 전 예약(15:00)·텐투텐(16:00)은 칩에 없음', S.S1 && !S.S1.some((x) => x.t === '15:00' || x.t === '16:00'));
  t('A3 네이버 시간은 점선(rn153-nv) · 기본 셋은 실선', S.S1 && S.S1.filter((x) => x.nv).map((x) => x.t).join(',') === '09:00,09:30');
  t('A3 홍길동 09:00 칩이 켜짐(파랑)', S.S1 && S.S1.find((x) => x.t === '09:00').on && !S.S1.find((x) => x.t === '10:00').on);
  const rowTxt = (nm) => pg.evaluate((nm) => { const r = [...document.querySelectorAll('#CONTENT div[style*="padding:9px 10px"]')].find((d) => d.innerText.indexOf(nm) >= 0); return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, nm);
  let r1 = await rowTxt('홍길동'), r3 = await rowTxt('이순신'), r4 = await rowTxt('김유신'), r5 = await rowTxt('장보고');
  t('A 배지: 홍길동 «✓ 네이버 예약 09:00» · «⟳ 자동»', /✓ 네이버 예약 09:00/.test(r1) && /⟳ 자동/.test(r1), r1);
  t('A2 배지: 이순신 «✋ 직접 10:00 · ⚠ 예약과 다름» + 「예약 시간으로」', /✋ 직접 10:00 · ⚠ 예약과 다름/.test(r3) && /예약 시간으로/.test(r3), r3);
  t('A4 배지: 김유신 «⚠ 예약 취소됨 (11:00)»', /⚠ 예약 취소됨 \(11:00\)/.test(r4), r4);
  t('A4 배지: 장보고 «예약 아직»', /예약 아직/.test(r5), r5);
  t('A5 옛 「시간 넣기」 단추 없음', (await pg.evaluate(() => !/시간 넣기/.test(document.getElementById('CONTENT').innerText))));
  t('A 예약했지만 명단에 없음(신사임당 13:00)은 그대로', /예약했지만 명단에 없음/.test(await pg.evaluate(() => document.getElementById('CONTENT').innerText)));

  /* A-2 「예약 시간으로」 */
  await pg.evaluate(() => { const b = document.querySelector('#CONTENT [data-rn153-use="S3"]'); b && b.click(); }); await pg.waitForTimeout(300);
  e = await E();
  t('A2 「예약 시간으로」 → 이순신 11:00 · naver · 쓰기 +1', e.S3.slot === '11:00' && e.S3.slotSrc === 'naver' && (await rcW()).length === 2, JSON.stringify(e.S3) + ' w=' + (await rcW()).length);
  /* A-2 직접 누르기 · 해제 */
  await pg.evaluate(() => rcSetSlot('S1', '13:00')); await pg.waitForTimeout(300);
  e = await E();
  t('A2 칩 직접 누름 → 13:00 · slotSrc manual (다시 그려도 안 덮음)', e.S1.slot === '13:00' && e.S1.slotSrc === 'manual', JSON.stringify(e.S1));
  r1 = await rowTxt('홍길동');
  t('A2 홍길동 «✋ 직접 13:00 · ⚠ 예약과 다름»', /✋ 직접 13:00 · ⚠ 예약과 다름/.test(r1), r1);
  await pg.evaluate(() => rcSetSlot('S1', '13:00')); await pg.waitForTimeout(400);
  e = await E();
  t('A2 같은 칩 다시 눌러 해제 → slotSrc 지움 → 다음 그리기에서 예약 09:00 자동', e.S1.slot === '09:00' && e.S1.slotSrc === 'naver', JSON.stringify(e.S1));
  /* A-1 예약 시간이 바뀌면 따라감 */
  const wBefore = (await rcW()).length;
  await pg.evaluate(() => { NBK.data.bookings.find((b) => b.id === 'b1').start = '09:30'; render(); }); await pg.waitForTimeout(400);
  e = await E();
  t('A1 예약 시간 09:00 → 09:30 으로 바뀌면 따라감 (쓰기 1회)', e.S1.slot === '09:30' && e.S1.slotSrc === 'naver' && (await rcW()).length === wBefore + 1, JSON.stringify(e.S1));
  await pg.evaluate(() => { NBK.data.bookings.find((b) => b.id === 'b1').start = '09:00'; render(); }); await pg.waitForTimeout(400);

  /* A-5 학생앱 알림 · 안내문이 자동 시간을 쓰는지 */
  await pg.evaluate(() => rcPublishCalls()); await pg.waitForTimeout(300);
  const pub = await pg.evaluate(() => { const x = window.__W.filter((y) => y.key === 'rc_calls_pub'); return x.length ? x[x.length - 1].value : null; });
  t('A5 학생앱 알림(rc_calls_pub) = 자동 시간 (홍길동 09:00 · 박하나 11:00 · 이순신 11:00)', pub && pub.items.AAA111.slot === '09:00' && pub.items.BBB222.slot === '11:00' && pub.items.CCC333.slot === '11:00', JSON.stringify(pub && pub.items));
  await pg.evaluate(() => rcOpenSms()); await pg.waitForTimeout(200);
  const sms = await pg.evaluate(() => { const p = document.getElementById('rc-pop'); const tx = [...document.querySelectorAll('#rc-pop textarea')].map((x) => x.value); return { pop: p ? p.innerText : '', tx }; });
  const smsOf = (nick) => sms.tx.find((x) => x.indexOf(nick) >= 0) || '';
  t('A5 안내문: 홍길동 «✓ 네이버 예약 09:00» 표시 · «예약은 확인했습니다»', /✓ 네이버 예약 09:00/.test(sms.pop) && /네이버 예약은 확인했습니다/.test(smsOf('길동이가')), sms.pop.slice(0, 200));
  t('A5 안내문: 장보고 «예약으로 편하신 시간» 부탁 · 문자에 시각 없음(v19-146 그대로)', /편하신 시간/.test(smsOf('보고가')) && !/\d\d:\d\d/.test(smsOf('길동이가')), smsOf('보고가'));
  await pg.evaluate(() => { try { rcPopClose(); } catch (e) {} });

  /* B 왼쪽 기둥 */
  await pg.evaluate(() => { RC.view = 'board'; render(); }); await pg.waitForTimeout(300);
  const L = await pg.evaluate(() => {
    const LC = document.getElementById('LIST_CONTENT'), q = (s) => LC.querySelector(s), n = (k) => { const x = LC.querySelector('[data-rn153-n="' + k + '"] .v'); return x ? x.textContent : null; };
    const right = {}; LC.querySelectorAll('[data-rn153-right]').forEach((x) => { right[x.getAttribute('data-rn153-right')] = x.textContent; });
    const times = {}; LC.querySelectorAll('[data-rn153-time]').forEach((x) => { times[x.getAttribute('data-rn153-time')] = x.querySelector('.n').textContent; });
    const secs = [...LC.querySelectorAll('.l3-sec')].map((x) => x.textContent);
    return { text: LC.innerText, secs, conf: n('conf'), booked: n('booked'), nobook: n('nobook'), ws: n('ws'), calls: n('calls'), done: n('done'), noshow: n('noshow'), delta: n('delta'),
      doneK: (LC.querySelector('[data-rn153-n="done"] .k') || {}).textContent, right, times, nob: q('[data-rn153-nobook]') && q('[data-rn153-nobook]').innerText,
      freq: q('[data-rn153-freq]') && q('[data-rn153-freq]').innerText, bars: LC.querySelectorAll('.rn153-bars rect').length, stats: !!q('[data-rn153-stats]'), ledger: LC.querySelectorAll('[data-l3r-ledger]').length,
      cfg: q('[data-rn153-cfg]') && q('[data-rn153-cfg]').innerText.replace(/\s+/g, ' '), fold: /공용 메뉴/.test(LC.innerText) };
  });
  const md = await pg.evaluate((d) => rn153Md(d), FX.recDt);
  t('B① 머리 «🚑 이번 주 · ' + md + '»', L.secs.indexOf('🚑 이번 주 · ' + md) >= 0, JSON.stringify(L.secs));
  t('B① 숫자 4칸: 확정 5 · 네이버 예약 3 · 예약 아직 2 · 학습지 만듦 1', L.conf === '5' && L.booked === '3' && L.nobook === '2' && L.ws === '1', JSON.stringify([L.conf, L.booked, L.nobook, L.ws]));
  t('B② 시간대별 인원: 09:00 1 · 11:00 3 · 시간 미정 1', L.times['09:00'] === '1명' && L.times['11:00'] === '3명' && L.times.none === '1명' && !L.times['10:00'], JSON.stringify(L.times));
  t('B③ 명단 머리 «호출 5 · 미정 1» · 미정 신사임당', L.secs.some((s) => /명단 · 호출 5 · 미정 1/.test(s)) && L.right.S6 === '미정', JSON.stringify(L.secs) + JSON.stringify(L.right));
  t('B③ 오른쪽: 홍길동 «✓09:00 · 📄» · 장보고 «예약 아직» · 김유신 «⚠ 취소 11:00»', L.right.S1 === '✓09:00 · 📄' && L.right.S5 === '예약 아직' && L.right.S4 === '⚠ 취소 11:00', JSON.stringify(L.right));
  await pg.evaluate(() => { const e = RC.state.calls[rcWeekKey()].S3; e.slot = '10:00'; e.slotSrc = 'manual'; render(); }); await pg.waitForTimeout(300);
  t('B③ 오른쪽: 직접 고른 이순신 «✋10:00 ⚠»', (await pg.evaluate(() => document.querySelector('#LIST_CONTENT [data-rn153-right="S3"]').textContent)) === '✋10:00 ⚠');
  t('B④ «📨 예약 안 한 2명» · 김유신 · 장보고 · 안내문 ›', L.secs.indexOf('📨 예약 안 한 2명') >= 0 && /김유신 · 장보고/.test(L.nob) && /안내문 ›/.test(L.nob), L.nob);
  /* ⑤ 통계 요약 — 기대값은 가짜 자료에서 따로 센다 */
  const X = await pg.evaluate((fx) => {
    const n = new Date(), nowYm = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
    const ymAdd = (ym, k) => { let y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + k; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0'); };
    const months = []; for (let i = 5; i >= 0; i--) months.push(ymAdd(nowYm, -i));
    const rows = [  /* [리커버리 날짜, 출석, 노쇼, 학습지, 다음 테스트 ±(출석+점수+다음 시험 있을 때만), 학년, 사유] */
      [fx.recDt, 0, 0, 0, null, '중2', '주간테스트'], [fx.recDt, 0, 0, 0, null, '초6', '주간테스트'], [fx.recDt, 0, 0, 0, null, '중2', '주간테스트'], [fx.recDt, 0, 0, 0, null, '중3', '주간테스트'], [fx.recDt, 0, 0, 0, null, '중1', '직접'],
      [fx.wkB, 1, 0, 0, 20, '중2', '둘 다'], [fx.wkB, 1, 0, 0, -5, '초6', '주간테스트'], [fx.wkB, 0, 1, 0, null, '중2', '주간테스트'], [fx.wkB, 1, 0, 1, null, '중3', '단원'],
      [fx.wkC, 1, 0, 0, 15, '중2', '주간테스트'], [fx.wkC, 1, 0, 0, null, '중1', '직접']];
    const by = {}; months.forEach((ym) => { by[ym] = { calls: 0, done: 0, noshow: 0, ws: 0, d: [] }; });
    const G = {};
    rows.forEach((r) => { const m = by[r[0].slice(0, 7)]; if (!m) return; m.calls++; m.done += r[1]; m.noshow += r[2]; m.ws += r[3]; if (r[4] != null) m.d.push(r[4]); const g = G[r[5]] = G[r[5]] || { calls: 0, why: {} }; g.calls++; g.why[r[6]] = (g.why[r[6]] || 0) + 1; });
    months.forEach((ym) => { const m = by[ym]; m.avg = m.d.length ? Math.round(m.d.reduce((a, b) => a + b, 0) / m.d.length * 10) / 10 : null; m.up = m.d.filter((v) => v > 0).length; });
    return { nowYm, months, by, G };
  }, FX);
  const C = X.by[X.nowYm];
  const sg = (v) => (v == null ? '—' : (v > 0 ? '+' + v : (v < 0 ? '−' + Math.abs(v) : '±0')));
  t('B⑤ 이번 달 숫자: 호출 · 출석(%) · 노쇼 · 다음 테스트', L.calls === String(C.calls) && L.done === String(C.done) && L.noshow === String(C.noshow) && L.delta === sg(C.avg) && (C.calls ? L.doneK === '출석 (' + Math.round(C.done / C.calls * 100) + '%)' : true), JSON.stringify([L.calls, L.done, L.noshow, L.delta, L.doneK, C]));
  t('B⑤ 6개월 막대 SVG 6개 · «🔁 3회 이상 · 1명» · 통계 자세히 · 📜 장부 줄', L.bars === 6 && /🔁 3회 이상 · 1명/.test(L.freq || '') && L.stats && L.ledger >= 2, JSON.stringify([L.bars, L.freq, L.stats, L.ledger]));
  t('B⑥ ⚙ 기준 «주간 80점 · 단원 60% · 초6 75점 · 3주» + 접힌 공용 메뉴', L.cfg === '주간 80점 단원 60% 초6 75점 3주' && L.fold, L.cfg);
  if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'v19153_board.png'), fullPage: false });
  /* 왼쪽 클릭 */
  await pg.evaluate(() => document.querySelector('#LIST_CONTENT [data-rn153-nobook]').click()); await pg.waitForTimeout(200);
  t('B④ 「안내문 ›」 → 학부모 안내문 팝업', (await pg.evaluate(() => { const p = document.getElementById('rc-pop'); return !!p && /학부모 안내문/.test(p.innerText); })));
  await pg.evaluate(() => { try { rcPopClose(); } catch (e) {} });
  await pg.evaluate(() => document.querySelector('#LIST_CONTENT [data-l3r-stu="S5"]').click()); await pg.waitForTimeout(300);
  t('B③ 명단 누르면 l3rPick(보드 · 그 학생 표시)', (await pg.evaluate(() => L3B.rcFocus === 'S5' && RC.view === 'board' && document.querySelector('#LIST_CONTENT [data-l3r-stu="S5"]').classList.contains('on'))));

  /* C 📊 통계 */
  await pg.evaluate(() => document.querySelector('#LIST_CONTENT [data-rn153-stats]').click()); await pg.waitForTimeout(300);
  const CV = await pg.evaluate(() => {
    const C = document.getElementById('CONTENT');
    const tabs = [...C.querySelectorAll('[data-rn153-tab]')].map((b) => b.getAttribute('data-rn153-tab') + (/background:#0d2240/.test(b.getAttribute('style')) ? '*' : ''));
    const months = {}; C.querySelectorAll('[data-rn153-ym]').forEach((r) => { months[r.getAttribute('data-rn153-ym')] = { calls: +r.dataset.calls, done: +r.dataset.done, noshow: +r.dataset.noshow, ws: +r.dataset.ws, avg: r.dataset.avg === '' ? null : +r.dataset.avg }; });
    const grades = {}; C.querySelectorAll('[data-rn153-grade]').forEach((r) => { grades[r.getAttribute('data-rn153-grade')] = r.innerText.replace(/\s+/g, ' '); });
    const freq = {}; C.querySelectorAll('[data-rn153-table="freq"] [data-rn153-stu]').forEach((r) => { freq[r.getAttribute('data-rn153-stu')] = r.innerText.replace(/\s+/g, ' '); });
    const kpi = (k) => { const x = C.querySelector('[data-rn153-kpi="' + k + '"]'); return x ? x.innerText.replace(/\s+/g, ' ') : ''; };
    return { view: RC.view, on: !!C.querySelector('[data-rn153-statsview]'), tabs, months, grades, freq, kD: kpi('delta'), kR: kpi('rate'), kW: kpi('wsrate'), kC: kpi('calls'), nbs: /예약 통계 열기/.test(C.innerText), ledgerOn: !!C.querySelector('[data-rn153-statsview]') && !/학생별 리커버리 누적/.test(C.innerText) };
  });
  if (process.env.SHOT){ await pg.evaluate(() => { const c = document.getElementById('CONTENT'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); document.querySelectorAll('*').forEach((x) => { if (x.scrollTop) x.scrollTop = 0; }); }); await pg.screenshot({ path: path.join(process.env.SHOT, 'v19153_stats.png'), fullPage: false }); }
  t('C 탭 셋(보드 · 장부 · 📊 통계) · 통계가 켜짐 · 가운데 통계 화면', CV.view === 'stats' && CV.on && CV.tabs.join(',') === 'board,ledger,stats*' && CV.ledgerOn, JSON.stringify(CV.tabs));
  const mOk = X.months.every((ym) => { const a = CV.months[ym], b = X.by[ym]; return a && a.calls === b.calls && a.done === b.done && a.noshow === b.noshow && a.ws === b.ws && a.avg === b.avg; });
  t('C 표① 달별 6개월: 호출·출석·노쇼·학습지·다음 테스트 ± 가 가짜 자료와 같음', mOk && Object.keys(CV.months).length === 6, JSON.stringify(CV.months) + ' vs ' + JSON.stringify(X.by));
  const nx = await pg.evaluate((fx) => [rn153Next('S1', fx.wkB), rn153Next('S1', fx.wkC), rn153Next('S2', fx.wkB), rn153Next('S1', fx.recDt)], FX);
  t('C 다음 테스트 = 리커버리 날짜 «뒤» 첫 주간테스트 (60 · 40 · 65 · 없음)', nx[0] && nx[0].score === 60 && nx[1] && nx[1].score === 40 && nx[2] && nx[2].score === 65 && nx[3] === null, JSON.stringify(nx));
  const st = await pg.evaluate(() => { const S = rn153Stats(true); return { all: S.entries.filter((x) => x.delta != null).map((x) => x.k + ':' + x.delta).sort(), noshowDelta: S.entries.some((x) => x.noshow && x.delta != null) }; });
  t('C 다음 테스트 ± = 출석한 학생만 (홍길동 +20 · 박하나 −5 · 홍길동 +15) · 노쇼(이순신 90점)는 빠짐', st.all.join(',') === 'S1:15,S1:20,S2:-5' && !st.noshowDelta, JSON.stringify(st));
  t('C 머리 숫자: 이번 달 호출 · 출석률 · 다음 테스트(«n명 중 m명 올랐어요» 또는 기록 없음)', /호출/.test(CV.kC) && CV.kC.indexOf(String(C.calls)) >= 0 && (C.calls ? CV.kR.indexOf(Math.round(C.done / C.calls * 100) + '%') >= 0 : /—/.test(CV.kR)) && (C.d.length ? (CV.kD.indexOf(sg(C.avg) + '점') >= 0 && CV.kD.indexOf(C.d.length + '명 중 ' + C.up + '명 올랐어요') >= 0) : /기록이 없어요/.test(CV.kD)), JSON.stringify([CV.kC, CV.kR, CV.kD]));
  const wsm = await pg.evaluate((ym) => rn153Stats(true).by[ym], FX.wkB.slice(0, 7));
  t('C 학습지 정답률 = 학습지 채점(9/12) 있으면 75% · 없으면 «—»', (!wsm || wsm.wsRate === 75) && (X.by[X.nowYm].ws ? true : /—/.test(CV.kW)), JSON.stringify([wsm && wsm.wsRate, CV.kW]));
  const gOk = Object.keys(X.G).every((g) => CV.grades[g] && CV.grades[g].indexOf(String(X.G[g].calls)) >= 0) && Object.keys(CV.grades).length === Object.keys(X.G).length;
  t('C 표② 학년 × 사유 (중2 · 초6 · 중3 · 중1)', gOk && (!CV.grades['중1'] || /직접/.test(CV.grades['중1'])) && (!CV.grades['중3'] || /단원|주간/.test(CV.grades['중3'])), JSON.stringify(CV.grades));
  t('C 표③ 🔁 홍길동 3회 «25 → 40 → 55점 ↗» · 상담 권유 · 맨 위', CV.freq.S1 && /25 → 40 → 55점 ↗/.test(CV.freq.S1) && /상담 권유/.test(CV.freq.S1) && Object.keys(CV.freq)[0] === 'S1', JSON.stringify(CV.freq));
  t('C 표③ 이순신 «50 → 65점 ↗ · 노쇼 1» · 박하나 «70 → 60점 ↘»', /50 → 65점 ↗ · 노쇼 1/.test(CV.freq.S3 || '') && /70 → 60점 ↘/.test(CV.freq.S2 || ''), JSON.stringify(CV.freq));
  t('C 예약 통계(v19-127) 안내 줄 + 단추', CV.nbs);
  await pg.evaluate(() => { RC.view = 'board'; render(); rn153GoFreq(); }); await pg.waitForTimeout(300);
  t('B⑤ 「🔁 3회 이상 › 」 → 통계 화면 자주 오는 학생 표', (await pg.evaluate(() => RC.view === 'stats' && !!document.getElementById('rn153-freq'))));
  await pg.evaluate(() => rcSetView('ledger')); await pg.waitForTimeout(200);
  t('C 장부 탭은 예전 그대로(학생별 누적 · 탭 셋)', (await pg.evaluate(() => /학생별 리커버리 누적/.test(document.getElementById('CONTENT').innerText) && document.querySelectorAll('#CONTENT [data-rn153-tab]').length === 3)));
  await pg.evaluate(() => rcSetView('board')); await pg.waitForTimeout(200);
  t('보드 탭 그대로 · 통계 화면 없음', (await pg.evaluate(() => !document.querySelector('#CONTENT [data-rn153-statsview]') && /확정 명단 · 시간 배분/.test(document.getElementById('CONTENT').innerText))));

  /* D-1 홈 */
  const home = () => pg.evaluate(() => { VIEW = 'home'; render(); const x = document.querySelector('#CONTENT .rn153-home'); return x ? { n: x.getAttribute('data-rn153-home'), tx: x.innerText.replace(/\s+/g, ' ') } : null; });
  let H = await home(); await pg.waitForTimeout(200); H = await home();
  t('D-1 전날: «🚑 내일 리커버리 · 예약 아직 2명 — 김유신 · 장보고» + 📨 안내문', H && H.n === '2' && /🚑 내일 리커버리 · 예약 아직 2명 — 김유신 · 장보고/.test(H.tx) && /📨 안내문/.test(H.tx), JSON.stringify(H));
  if (process.env.SHOT) await pg.screenshot({ path: path.join(process.env.SHOT, 'v19153_home.png'), fullPage: false });
  t('D-1 네이버 예약 칸 안에 들어감', (await pg.evaluate(() => !!document.querySelector('#CONTENT [data-nbk-home] .rn153-home'))));
  await pg.evaluate((d) => { RC.state.dates[rcWeekKey()] = d; }, FX.today);
  H = await home();
  t('D-1 당일: «오늘 리커버리» (그 날 예약이 없으니 5명)', H && /🚑 오늘 리커버리 · 예약 아직 5명/.test(H.tx), JSON.stringify(H));
  await pg.evaluate((d) => { RC.state.dates[rcWeekKey()] = d; }, await pg.evaluate((t0) => rn153Add(t0, 3), FX.today));
  H = await home();
  t('D-1 리커버리 이틀 넘게 남으면 안 보임', H === null, JSON.stringify(H));
  await pg.evaluate((d) => { RC.state.dates[rcWeekKey()] = d; }, FX.recDt);
  await pg.evaluate(() => { const b = NBK.data.bookings; b.push({ id: 'x4', item: { kind: 'recovery' }, status: { k: 'confirmed' }, date: rcRecDate(rcWeekKey()), start: '10:00', match: { stKey: 'S4' } }); b.push({ id: 'x5', item: { kind: 'recovery' }, status: { k: 'confirmed' }, date: rcRecDate(rcWeekKey()), start: '10:00', match: { stKey: 'S5' } }); });
  H = await home();
  t('D-1 모두 예약하면(0명) 안 보임', H === null, JSON.stringify(H));
  await pg.evaluate(() => { NBK.data.bookings = NBK.data.bookings.filter((b) => b.id !== 'x4' && b.id !== 'x5'); });
  H = await home();
  await pg.evaluate(() => { const b = document.querySelector('#CONTENT .rn153-home button'); b && b.click(); }); await pg.waitForTimeout(400);
  t('D-1 「📨 안내문」 → 리커버리 보드 + 학부모 안내문 팝업', (await pg.evaluate(() => VIEW === 'recovery' && RC.view === 'board' && !!document.getElementById('rc-pop') && /학부모 안내문/.test(document.getElementById('rc-pop').innerText))));
  await pg.evaluate(() => { try { rcPopClose(); } catch (e) {} });
  t('D-1 홈이 아닌 곳(리커버리)엔 그 줄 없음', (await pg.evaluate(() => !document.querySelector('.rn153-home'))));

  /* 저장·안전 */
  const ws = await pg.evaluate(() => window.__W.map((x) => x.key));
  t('안전: 네이버 예약·등록부·기본 시간대는 한 번도 안 씀', !ws.some((k) => /^naver|^or_studentdb$|^rc_config$/.test(String(k))), JSON.stringify(ws));
  const keysOk = await pg.evaluate(() => { const ok = ['on', 'done', 'doneAt', 'noshow', 'slot', 'manual', 'snap', 'ws', 'reason', 'why', 'at', 'slotSrc', 'slotAt']; const W = RC.state.calls[rcWeekKey()]; return Object.keys(W).every((k) => Object.keys(W[k]).every((f) => ok.indexOf(f) >= 0)); });
  t('저장 모양: 새 칸은 slotSrc · slotAt 둘뿐', keysOk);
  /* 폰 폭: 왼쪽 기둥 없음 · 가운데 통계 탭은 있음 */
  await pg.setViewportSize({ width: 600, height: 900 }); await pg.evaluate(() => { VIEW = 'recovery'; RC.view = 'board'; render(); }); await pg.waitForTimeout(300);
  t('폰(<900): 왼쪽 기둥 없음 · 통계 탭은 가운데에', (await pg.evaluate(() => !document.querySelector('[data-rn153-week]') && document.querySelectorAll('#CONTENT [data-rn153-tab]').length === 3)));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
