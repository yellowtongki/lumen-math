#!/usr/bin/env node
/* 학원앱 v19-174 검사 — 🚑 리커버리 보드 2판 (docs/recovery_tab_contract.md §9 · 시안 docs/mockup_recovery_compact.html)
 *   가짜 서버(lumen_store: or_studentdb 8명 · rc_config · rc_state · naver_bookings · mf_weekly · mf_progress · mf_books / mf_students 표) · 외부망 전부 차단
 *   가짜 이름 ○○○1~8 · 월수금 반(M4·M7·H1) · 화목토 반(T630·T5·T730) · 요일 없는 반(X1 → 그 밖) · 초·중·고 섞어
 *   ① 줄 표 · 묶음 머리·소제목·인원 ② 2분할(1400px) / 한 기둥(1100px) ③ 날짜 표기(매쓰플랫 채점일) ④ 보기 칩 거르기 · 묶음 토글 → localStorage rc_board_view
 *   ⑤ 호출 토글 → rc_state(기존 길) ⑥ 완료 줄 회색 맨 아래 ⑦ 서랍(학생 칸 · 시간 칩 → rcSetSlot · ✅ 완료) ⑧ 띠 접힘 기본 · 📌 기억
 *   ⑨ 적중 분석·백지테스트 띠·서랍(회귀) ⑩ 1024~1279 FAB 그대로 ⑪ 카드 보기 되돌림 ⑫ 실서버 쓰기 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19179.js lumen_v19-179.html [그림.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-179.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-179'])[0];
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
  const q = (fn, arg) => pg.evaluate(fn, arg);
  const add2 = (ymd, n) => new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: rcrBeyond · rcrShift · rcrAuto', await q(() => typeof rcrBeyond === 'function' && typeof rcrShift === 'function' && typeof rcrAuto === 'function'));
  t('기간 지정 안 씀(최근 3주) → 경고 없음', await q(() => !document.querySelector('#CONTENT .rcr-warn') && rcrBeyond() === null));
  /* 기간 지정: 끝 = 오늘-5 → 오늘-4 에 본 시험(○○○1·2·8·5·6 주간 + ○○○4 고등 단원)이 기간 밖 */
  const R = { from: add2(FX.today, -10), to: add2(FX.today, -5) };
  await q((R) => { RC.cfg.range = R; render(); }, R); await pg.waitForTimeout(300);
  const b = await q(() => rcrBeyond());
  t('기간 밖 새 시험 = 6명 · 가장 늦은 응시 = 오늘-4', b && b.n === 6 && b.last === FX.tD, JSON.stringify(b));
  const W = await q(() => { const w = document.querySelector('#CONTENT .rcr-warn'); return w ? w.innerText : ''; });
  t('보드 맨 위 주황 띠 · 기간 · 6명 · 날짜', /선발 기간\(/.test(W) && /6명/.test(W) && W.indexOf(md(FX.tD)) >= 0, W.slice(0, 160));
  const nx = { from: add2(FX.today, -5), to: FX.today };
  t('단추 글 「기간을 오늘까지 옮기기 (' + md(nx.from) + ' ~ ' + md(nx.to) + ')」 · 「최근 1주(자동)로」', W.indexOf('기간을 오늘까지 옮기기 (' + md(nx.from) + ' ~ ' + md(nx.to) + ')') >= 0 && /최근 1주\(자동\)로/.test(W));
  t('기간 칩 옆 작은 칩 「⚠ 기간 밖 새 시험 6명」', await q(() => [...document.querySelectorAll('#CONTENT button')].some((x) => /⚠ 기간 밖 새 시험 6명/.test(x.textContent))));
  t('경고만으로는 기간이 안 바뀜(rc_config 쓰기 없음)', await q(() => !window.__W.some((k) => k && k.key === 'rc_config')) && (await q(() => JSON.stringify(RC.cfg.range))) === JSON.stringify(R));
  await q(() => { const btn = [...document.querySelectorAll('#CONTENT .rcr-warn button')].find((x) => /오늘까지 옮기기/.test(x.textContent)); btn.click(); }); await pg.waitForTimeout(400);
  const after = await q(() => RC.cfg.range);
  t('「오늘까지 옮기기」 → 같은 길이(5일)로 ' + nx.from + ' ~ ' + nx.to, after && after.from === nx.from && after.to === nx.to, JSON.stringify(after));
  t('옮긴 뒤 rc_config 저장 · 경고 사라짐', (await q(() => window.__W.some((k) => k && k.key === 'rc_config'))) && !(await q(() => !!document.querySelector('#CONTENT .rcr-warn'))));
  /* 다시 옛 기간 → 「최근 1주(자동)로」 */
  await q((R) => { RC.cfg.range = R; render(); }, R); await pg.waitForTimeout(300);
  await q(() => { const btn = [...document.querySelectorAll('#CONTENT .rcr-warn button')].find((x) => /최근 1주/.test(x.textContent)); btn.click(); }); await pg.waitForTimeout(400);
  t('「최근 1주(자동)로」 → range 없음 · weeks 1 · 경고 없음', await q(() => !RC.cfg.range && RC.cfg.weeks === 1 && !document.querySelector('#CONTENT .rcr-warn')));
  /* 기간 끝이 최신 시험 뒤면 경고 없음 */
  await q((T) => { RC.cfg.range = { from: T.f, to: T.t }; render(); }, { f: add2(FX.today, -10), t: FX.today }); await pg.waitForTimeout(300);
  t('기간이 오늘까지면 경고 없음', await q(() => !document.querySelector('#CONTENT .rcr-warn') && rcrBeyond() === null));
  /* 장부 보기에선 안 띄움 */
  await q((R) => { RC.cfg.range = R; RC.view = 'ledger'; render(); }, R); await pg.waitForTimeout(300);
  t('📒 장부 보기에선 경고 띠 없음', await q(() => !document.querySelector('#CONTENT .rcr-warn')));
  await q(() => { RC.view = 'board'; render(); }); await pg.waitForTimeout(300);
  t('보드로 돌아오면 다시 경고', await q(() => !!document.querySelector('#CONTENT .rcr-warn')));
  t('보드 줄 표(v19-174) 그대로 그려짐', await q(() => !!document.querySelector('#CONTENT [data-rb174-board]')));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
