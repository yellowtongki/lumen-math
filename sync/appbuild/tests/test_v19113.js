#!/usr/bin/env node
/* 학원앱 v19-113 검사 — 🏆 플래너 랭킹 화면 합계 = 매일 + 계획 + 순공 · plwRepublish() 때 학생 전원 student_planner_.weekly
 *   (원장 2026-10-12 「1,2,3 다 고쳐줘」)
 *   가짜 학생 4명(이름은 ○○○), 실제 모양의 주간 자료(wplan_ · wplan_chk_ · sungong_ · plweek_paper · lumen_group_days):
 *     ○○○1 AAA111 매일 8×10일 = 80 · 주간 0
 *     ○○○2 BBB222 매일 8×9일 = 72 · 9/28 주 사진(원장 고침 ok) 5 + 종이 수요일(지각) 2 · 10/5 주 다음 주 계획 5 + 사진 5 → 계획 5 · 순공 12 → 89
 *     ○○○3 CCC333 매일 60 · 9/28 주 다음 주 계획 5 · 10/5 주 계획 실천 100% 5 → 계획 10 → 70 (student_planner_ 줄이 아직 없음)
 *     ○○○4 DDD444 퇴원 — 랭킹·발행에서 빠짐
 *   ① 이번달 랭킹 합계 = 입력 표 합계(plrGridTotal) = 발행 랭킹(calcPlannerRankingForMonth) · 순서 = 전체 합계(2·1·3 — 매일만이면 1·2·3) · 「매일 n · 계획 n · 순공 n」
 *      PWB 안 불렸을 때 → 「불러오는 중」 뒤 자동으로 다시 그림 · 주간(지난주) · 기간 지정(10/1~10/7 = 9/28 주만) · 9월은 예전 화면
 *      월간 화면 「매일 점수만 · 매일 합계」 · 레이스 「매일 점수만」
 *   ③ plwRepublish() → 랭킹 + 바뀐 학생만 묶어 올림(BBB222 · updated_at 안 보냄 · scores 그대로) · 줄 없는 CCC333 은 발행 함수로 ·
 *      AAA111(이미 같음)은 안 씀 · 퇴원생 안 씀 · 자동: 플래너 화면 열면 한 번(이 기기 표시) · 두 번째는 안 돎
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19113.js lumen_v19-113.html
 *   그림: $SP/v19113_rank.png · 가짜 서버 · 외부망 차단. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-113.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-113'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const days = (from, n, v) => { const o = {}; for (let i = 0; i < n; i++) o['2026.10.' + String(from + i).padStart(2, '0')] = v; return o; };
const STUDENTS = [
  { id: 'S1', name: '○○○1', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: Object.assign({ '2026.09.30': 9 }, days(1, 10, 8)) },
  { id: 'S2', name: '○○○2', group: 'T5', lumen_rec_code: 'BBB222', lumen_planner: days(1, 9, 8) },
  { id: 'S3', name: '○○○3', group: 'T5', lumen_rec_code: 'CCC333', lumen_planner: days(1, 6, 10) },
  { id: 'S4', name: '○○○4', group: 'T5', lumen_rec_code: 'DDD444', withdrawn: true, lumen_planner: days(1, 10, 10) } ];
const STORE = {
  lumen_group_days: { T5: [2, 4, 6] },
  plweek_paper: { byCode: { BBB222: { '2026-09-28': { at: '2026-10-07T05:57:09Z', pov: 'ok' } } } },   /* pov = 사진 점수 원장 고침 · 종이는 수요일(첫 수업 화요일 뒤) = 지각 */
  sungong_BBB222: { code: 'BBB222', weeks: { '2026-09-28': { subj: { '수학': 60 }, total: 60, photo: 'p', at: '2026-10-04T10:00:00Z' }, '2026-10-05': { subj: { '수학': 90 }, total: 90, photo: 'p', at: '2026-10-11T09:00:00Z' } } },
  wplan_BBB222: { weeks: { '2026-10-12': { items: [{ id: 'b1', d: 0, title: '영어 단어', subj: '영어' }], submittedAt: '2026-10-10T05:00:00Z' } } },
  wplan_CCC333: { weeks: { '2026-10-05': { items: [{ id: 'c1', d: 1, title: '영어 독해', subj: '영어' }, { id: 'c2', d: 3, title: '국어 문법', subj: '국어' }], submittedAt: '2026-10-04T05:00:00Z' } } },
  wplan_chk_CCC333: { weeks: { '2026-10-05': { c1: { ok: true, at: '2026-10-07T12:00:00Z' }, c2: { ok: true, at: '2026-10-09T12:00:00Z' } } } },
  plweek_ev: { byCode: {} },
  /* 학생앱 줄: AAA111 = 이미 맞음(나중에 화면에서 계산해 넣음) · BBB222 = 10/5 주가 옛 값 8 · CCC333 = 줄 없음 */
  student_planner_BBB222: { studentId: 'S2', scores: { '2026.10.01': 8, '2026.10.02': 8 }, flags: {}, teacherComment: '', lastUpdated: '2026-10-09T00:00:00Z',
    weekly: { '2026-09-28': { t: 10, plan: 0, prac: 0, photo: 5, paper: 5 }, '2026-10-05': { t: 8, plan: 5, prac: 0, photo: 3, paper: 0 } } },
  student_planner_DDD444: { studentId: 'S4', scores: {}, weekly: {} } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false,
        select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or(str) { const cs = String(str).split(',').map((c) => { const m = c.match(/^key\.(like|eq)\.(.*)$/); if (!m) return () => false; if (m[1] === 'eq') return (x) => x === m[2]; const pre = m[2].replace(/%$/, ''); return (x) => x.indexOf(pre) === 0; }); b.f.push((x) => cs.some((fn) => fn(x))); return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; T.ups.push({ tbl, batch: Array.isArray(row), keys: arr.map((r) => r.key), upd: arr.map((r) => Object.prototype.hasOwnProperty.call(r, 'updated_at')) });
          if (tbl === 'lumen_store') arr.forEach((r) => { T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: p } }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    _origSetItem('lumen_plw_pub_stamp', rk113Stamp());   /* 자동 실행은 ③-2 에서 따로 본다 — 지금은 «이미 함» 표시 */
    /* 앱이 켜질 때 넣는 «예시학생»을 나중에 등록부에서 다시 읽어 들일 수 있어서 — 단계마다 가짜 학생으로 다시 채운다 */
    T.seed = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {} };
    T.seed();
    Object.assign(PWB, { loaded: false, loading: false, at: 0 });
  }, { STORE, STUDENTS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* ① 이번달 — PWB 안 불린 상태에서 열기 → 불러오는 중 → 자동으로 다시 그림 */
  const A0 = await pg.evaluate(() => { VIEW = 'planner'; PLANNER_VIEW = 'ranking'; PLANNER_MONTH = '2026.10'; window.PLANNER_RANK_MODE = 'month'; render();
    return document.getElementById('CONTENT').innerText; });
  t('주간 점수 자료가 없으면 「불러오는 중」', /주간 점수\(📅 계획 · 📔 순공\) 불러오는 중/.test(A0), A0.slice(0, 120));
  await settle(1500);
  const A = await pg.evaluate(() => {
    const CT = document.getElementById('CONTENT');
    const rows = [...CT.querySelectorAll('.rk113-tot')].map((e) => ({ name: e.parentElement.children[1].textContent, tot: e.children[0].textContent, split: e.children[1].textContent }));
    const strip = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const grid = {}; students.filter((s) => !s.withdrawn).forEach((s) => { let d = 0; Object.keys(s.lumen_planner).forEach((k) => { if (k.slice(0, 7) === '2026.10') d += s.lumen_planner[k]; }); grid[s.name] = strip(plrGridTotal(s, '2026.10', d, '#000')); });
    const pub = calcPlannerRankingForMonth('2026-10').map((r) => ({ code: r.code, total: r.total, daily: r.daily, weekly: r.weekly, rank: r.rank }));
    return { loaded: PWB.loaded, rows, grid, pub, note: (CT.querySelector('.rk113-note') || {}).textContent || '', podium: CT.innerText.indexOf('매일 72 · 계획 5 · 순공 12') >= 0, text: CT.innerText };
  });
  console.log(JSON.stringify({ rows: A.rows, grid: A.grid, pub: A.pub, note: A.note }, null, 1));
  const byName = {}; A.rows.forEach((r) => { byName[r.name] = r; });
  t('불러온 뒤 자동으로 다시 그림 · 줄 3개(퇴원생 빠짐)', A.loaded && A.rows.length === 3 && !byName['○○○4'], A.rows.map((r) => r.name).join(','));
  t('순서 = 전체 합계: ○○○2 89 → ○○○1 80 → ○○○3 70 (매일만이면 ○○○1 80 > ○○○2 72 로 1·2위가 바뀜)', A.rows.map((r) => r.name + ' ' + r.tot).join(' / ') === '○○○2 89점 / ○○○1 80점 / ○○○3 70점', A.rows.map((r) => r.name + ' ' + r.tot).join(' / '));
  t('줄마다 「매일 n · 계획 n · 순공 n」', byName['○○○2'] && byName['○○○2'].split === '매일 72 · 계획 5 · 순공 12' && byName['○○○3'].split === '매일 60 · 계획 10 · 순공 0' && byName['○○○1'].split === '매일 80 · 계획 0 · 순공 0', JSON.stringify(A.rows.map((r) => r.split)));
  t('랭킹 합계 = 입력 표 합계(plrGridTotal) — 숫자·나눔 모두', A.rows.every((r) => A.grid[r.name] === (parseInt(r.tot) + ' ' + r.split)), JSON.stringify(A.grid));
  t('랭킹 합계 = 발행 랭킹(calcPlannerRankingForMonth) 합계', A.pub.length === 3 && A.pub.every((p) => { const r = A.rows.find((x) => x.name === '○○○' + ({ AAA111: 1, BBB222: 2, CCC333: 3 })[p.code]); return r && parseInt(r.tot) === p.total; }), JSON.stringify(A.pub));
  t('시상대에도 나눔 · 머리 안내 「합계 = 매일 + 계획 + 순공」 · 넣은 주 9/28~10/4 · 10/5~10/11', A.podium && /합계 = 매일 \+ 📅 계획 \+ 📔 순공/.test(A.note) && /9\/28~10\/4 · 10\/5~10\/11/.test(A.note), A.note);
  /* 그림 */
  await pg.evaluate(() => { const h = document.querySelector('.ui-scroll-hint, #uiScrollHint'); if (h) h.style.display = 'none'; });
  await pg.setViewportSize({ width: 1400, height: 1250 }); await settle(300);
  await pg.screenshot({ path: SP + '/v19113_rank.png', fullPage: false });
  await pg.setViewportSize({ width: 1400, height: 1000 }); await settle(200);

  /* 주간(지난주) · 기간 지정 · 9월 */
  const B = await pg.evaluate(() => {
    const rowsOf = () => [...document.getElementById('CONTENT').querySelectorAll('.rk113-tot')].map((e) => ({ name: e.parentElement.children[1].textContent, tot: parseInt(e.children[0].textContent), split: e.children[1].textContent }));
    const out = {};
    /* 주간 지난주: 기대값을 PW 로 따로 셈 (그 주 일요일이 기간 안 · 발표된 주) */
    window.PLANNER_RANK_MODE = 'week'; window.PLANNER_WEEK_OFFSET = -1; render();
    const wr = getWeekRange(-1); let ws = new Date(wr.start.replace(/\./g, '-')), we = new Date(wr.end.replace(/\./g, '-'));
    if (ws.getMonth() !== we.getMonth()) ws = new Date(we.getFullYear(), we.getMonth(), 1);
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const s0 = iso(ws), e0 = iso(we); const exp = {};
    students.filter((s) => !s.withdrawn).forEach((s) => { let d = 0; Object.keys(s.lumen_planner).forEach((k) => { const ki = k.replace(/\./g, '-'); if (ki >= s0 && ki <= e0) d += s.lumen_planner[k]; });
      let W = PW.W0, wk = 0; for (let i = 0; i < 60; i++) { const sun = PW.add(W, 6); if (sun > e0) break; if (sun >= s0 && Date.now() >= PW.dueMs(W)) wk += plwScore(s, W).total; W = PW.add(W, 7); } exp[s.name] = d + wk; });
    out.week = rowsOf(); out.weekExp = exp; out.weekNote = (document.querySelector('.rk113-note') || {}).textContent || '';
    /* 기간 지정 10/1~10/7 → 9/28 주(일요일 10/4)만 */
    window.PLANNER_RANK_MODE = 'custom'; window.PLANNER_RANGE = { s: '2026-10-01', e: '2026-10-07' }; render();
    out.custom = rowsOf(); out.customNote = (document.querySelector('.rk113-note') || {}).textContent || '';
    /* 9월 이번달 → 예전 화면 */
    window.PLANNER_RANK_MODE = 'month'; PLANNER_MONTH = '2026.09'; render();
    out.sep = { n: document.querySelectorAll('#CONTENT .rk113-tot').length, note: !!document.querySelector('#CONTENT .rk113-note'), text: document.getElementById('CONTENT').innerText.slice(0, 400) };
    /* 월간 · 레이스 (10월) */
    PLANNER_MONTH = '2026.10'; PLANNER_VIEW = 'monthly'; render(); out.monthly = document.getElementById('CONTENT').innerText;
    PLANNER_VIEW = 'race'; render(); out.race = document.getElementById('CONTENT').innerText.slice(0, 300);
    PLANNER_MONTH = '2026.09'; PLANNER_VIEW = 'monthly'; render(); out.monthlySep = document.getElementById('CONTENT').innerText;
    PLANNER_MONTH = '2026.10'; PLANNER_VIEW = 'ranking'; window.PLANNER_RANK_MODE = 'month'; render();
    return out;
  });
  console.log(JSON.stringify({ week: B.week, weekExp: B.weekExp, custom: B.custom, customNote: B.customNote }, null, 1));
  t('주간(지난주) 합계 = 그 주 매일 + 일요일이 든 발표된 주의 주간 점수', B.week.length === 3 && B.week.every((r) => r.tot === B.weekExp[r.name]) && B.week.every((r, i, a) => i === 0 || a[i - 1].tot >= r.tot), JSON.stringify([B.week, B.weekExp]));
  const c2 = B.custom.find((r) => r.name === '○○○2'), c3 = B.custom.find((r) => r.name === '○○○3');
  t('기간 지정 10/1~10/7: 9/28 주만 — ○○○2 = 매일 56 + 순공 7 = 63 · ○○○3 = 매일 60 + 계획 5 = 65 (10/5 주는 일요일이 기간 밖) · 순서 3·2·1', c2 && c2.tot === 63 && c2.split === '매일 56 · 계획 0 · 순공 7' && c3 && c3.tot === 65 && c3.split === '매일 60 · 계획 5 · 순공 0' && B.custom[0].name === '○○○3' && /9\/28~10\/4/.test(B.customNote) && !/10\/5~/.test(B.customNote), JSON.stringify([c2, c3, B.customNote]));
  t('9월(주간 점수 전)은 예전 화면 그대로 — 나눔·안내 없음', B.sep.n === 0 && !B.sep.note && /PLANNER RANKING|🏆/.test(B.sep.text), JSON.stringify(B.sep).slice(0, 200));
  t('월간 화면(10월) 「매일 점수만」 · 「매일 합계」 / 9월은 그대로', /매일 점수만/.test(B.monthly) && /매일 합계/.test(B.monthly) && !/매일 점수만/.test(B.monthlySep), B.monthly.slice(0, 160));
  t('레이스 「매일 점수만」', /PLANNER RACE · 매일 점수만/.test(B.race), B.race.slice(0, 120));

  /* ③ plwRepublish() — 학생 전원 weekly */
  const C = await pg.evaluate(async () => {
    /* AAA111 줄은 «이미 맞는 값»으로 미리 넣어 둔다 */
    T.seed();
    T.store.student_planner_AAA111 = { studentId: 'S1', scores: { '2026.10.01': 8 }, flags: {}, teacherComment: 'x', lastUpdated: '2026-10-09T00:00:00Z', weekly: JSON.parse(JSON.stringify(plwStudentWeeks(students[0]))) };
    T.ups = []; T.toasts = [];
    await plwRepublish();
    await new Promise((r) => setTimeout(r, 300));
    const want = {}; students.forEach((s) => { want[s.lumen_rec_code] = plwStudentWeeks(s); });
    const same = (a, b) => JSON.stringify(Object.keys(a || {}).sort().map((k) => [k, a[k].t, a[k].plan, a[k].prac, a[k].photo, a[k].paper])) === JSON.stringify(Object.keys(b || {}).sort().map((k) => [k, b[k].t, b[k].plan, b[k].prac, b[k].photo, b[k].paper]));
    return { ups: T.ups.filter((u) => u.tbl === 'lumen_store').map((u) => ({ batch: u.batch, keys: u.keys, upd: u.upd })),
      ok: ['AAA111', 'BBB222', 'CCC333'].map((c) => same((T.store['student_planner_' + c] || {}).weekly, want[c])),
      b2: T.store.student_planner_BBB222, c3: T.store.student_planner_CCC333, d4: T.store.student_planner_DDD444, toasts: T.toasts.slice(), last: RK113.lastAll,
      rank: (T.store.planner_ranking_2026_10 || T.store['planner_ranking_2026-10'] || {}).ranking };
  });
  console.log(JSON.stringify({ ups: C.ups, last: C.last, toasts: C.toasts }, null, 1));
  const flat = []; C.ups.forEach((u) => u.keys.forEach((k) => flat.push(k)));
  const batchB = C.ups.find((u) => u.batch && u.keys.indexOf('student_planner_BBB222') >= 0);
  t('바뀐 학생(BBB222)은 묶음(배열) upsert 로 · updated_at 안 보냄', !!batchB && batchB.upd.every((x) => x === false), JSON.stringify(batchB));
  t('BBB222 weekly 10/5 주 8 → 10 · scores·teacherComment 는 서버 값 그대로', C.b2.weekly['2026-10-05'].t === 10 && C.b2.weekly['2026-10-05'].plan === 5 && C.b2.weekly['2026-10-05'].photo === 5 && JSON.stringify(C.b2.scores) === '{"2026.10.01":8,"2026.10.02":8}' && !!C.b2.weeklyAt, JSON.stringify(C.b2.weekly));
  t('줄 없던 CCC333 은 원래 발행 함수로 새로 만듦(weekly 계획 5)', !!C.c3 && C.c3.weekly && C.c3.weekly['2026-10-05'] && C.c3.weekly['2026-10-05'].t === 5 && C.c3.weekly['2026-10-05'].prac === 5 && C.c3.scores && C.c3.scores['2026.10.01'] === 10, JSON.stringify(C.c3 && C.c3.weekly));
  t('학생 전원(AAA111·BBB222·CCC333) student_planner_ weekly = plwStudentWeeks', C.ok.every(Boolean), JSON.stringify(C.ok));
  t('이미 맞는 AAA111 · 퇴원 DDD444 는 쓰지 않음', flat.indexOf('student_planner_AAA111') < 0 && flat.indexOf('student_planner_DDD444') < 0 && JSON.stringify(C.d4.weekly) === '{}', flat.join(','));
  t('랭킹(planner_ranking_2026-10)도 같이 올림 · 결과 기록 ok · 알림', flat.indexOf('planner_ranking_2026-10') >= 0 && C.last && C.last.ok && C.last.changed === 1 && C.last.created === 1 && C.toasts.some((x) => /학생앱 주간 점수 2명/.test(x)), JSON.stringify([C.last, C.toasts]));
  /* 같은 때 두 번 불러도(주간 점수판 열기 = plwLoad(true) 가 두 번 부름) 쓰기는 다시 안 생김 */
  const D = await pg.evaluate(async () => { T.ups = []; await Promise.all([plwRepublish(), plwRepublish()]); await new Promise((r) => setTimeout(r, 300));
    return T.ups.filter((u) => u.keys.some((k) => k.indexOf('student_planner_') === 0)).length; });
  t('다시 불러도 이미 맞으면 student_planner_ 쓰기 0', D === 0, String(D));
  /* plwRepublish(code) — 한 학생 길은 전처럼(전원 안 돎) */
  const E = await pg.evaluate(async () => { T.ups = []; await plwRepublish('BBB222'); await new Promise((r) => setTimeout(r, 200)); return T.ups.map((u) => u.keys.join('+')); });
  t('plwRepublish(코드) = 그 학생 발행만(전원 묶음 없음)', E.indexOf('student_planner_BBB222') >= 0 && !E.some((k) => /\+/.test(k)), JSON.stringify(E));

  /* ③-2 자동: 플래너 화면을 열면 한 번 */
  const F = await pg.evaluate(async () => {
    T.store.student_planner_BBB222.weekly['2026-10-05'].t = 7;   /* 다시 옛 값으로 */
    _origRemoveItem('lumen_plw_pub_stamp'); T.ups = []; T.seed();
    VIEW = 'planner'; PLANNER_VIEW = 'input'; render();
    await new Promise((r) => setTimeout(r, 2600));
    const first = { last: RK113.lastAll, stamp: _origGetItem('lumen_plw_pub_stamp'), synced: T.ups.some((u) => u.keys.indexOf('lumen_plw_pub_stamp') >= 0), want: rk113Stamp(), b2: T.store.student_planner_BBB222.weekly['2026-10-05'].t, n: T.ups.length };
    T.store.student_planner_BBB222.weekly['2026-10-05'].t = 6; T.ups = []; T.seed();
    render(); await new Promise((r) => setTimeout(r, 2200));
    return { first, second: { n: T.ups.length, keys: T.ups.map((u) => u.keys.join('+')), b2: T.store.student_planner_BBB222.weekly['2026-10-05'].t } };
  });
  t('자동: 플래너 화면 열면 한 번 돌아 BBB222 를 10 으로 · 이 기기 표시 = 지난 주(+지각 마감 뒤 L) · 서버로 안 감', F.first.b2 === 10 && F.first.stamp === F.first.want && !!F.first.want && !F.first.synced, JSON.stringify(F.first));
  t('자동: 표시가 있으면 다시 안 돎 (student_planner_·랭킹 쓰기 0)', !F.second.keys.some((k) => /student_planner_|planner_ranking_/.test(k)) && F.second.b2 === 6, JSON.stringify(F.second));
  /* 불러오기 실패(PWB 가 비었는데 loaded=true)면 전원 0점으로 덮지 않는다 */
  const G = await pg.evaluate(async () => {
    const keep = { wp: PWB.wp, sg: PWB.sg, cp: PWB.cp, at: PWB.at }; T.seed(); T.ups = [];
    Object.assign(PWB, { wp: {}, sg: {}, cp: {}, at: Date.now() });
    const r = await plwRefreshAllWeekly();
    Object.assign(PWB, keep);
    return { r, n: T.ups.filter((u) => u.keys.some((k) => k.indexOf('student_planner_') === 0)).length, b2: T.store.student_planner_BBB222.weekly['2026-10-05'].t };
  });
  t('주간 자료가 하나도 없으면(불러오기 실패) 학생앱 주간 점수를 0 으로 덮지 않음 · ok=false', G.n === 0 && G.r && G.r.ok === false && G.r.skip === 'no-data' && G.b2 === 6, JSON.stringify(G));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
