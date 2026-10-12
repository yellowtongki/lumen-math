#!/usr/bin/env node
/* 학원앱 v19-114 검사 — 📅 주간 점수 화면 오른쪽 칸 = 학생 주간계획표 (시안 docs/mockup_weekly_plan_panel.html)
 *   (원장 2026-10-12 「학생들 주간계획표가 학원앱에 보여야 한다. 우측 탭을 만들고 3분할 화면으로」 → 「시안대로 v19-114 만들어 배포해줘」)
 *   가짜 학생 3명(이름은 ○○○), 실제 모양의 키(wplan_ · wplan_chk_ · codi_plan_ · codi_done_ · sungong_ · plweek_paper · lumen_group_days · student_planner_).
 *   날짜는 «오늘이 든 주(MON)»에서 거꾸로 셈 — 표의 기본 주 W = MON-7, 오른쪽 칸 기본 «다음 주» = MON.
 *     ○○○1 AAA111: 다음 주(MON) 할 일 10개(월 3 · 화 2 · 수 5, 코디 6 · 직접 등) 금요일 22:20 제출(제때 5) · 월 17:00 할 일 ✓
 *                  이번 주(W) 4개 — 영어 ✓ · 수학 ✓(증거 없음 → ?) · 코디 칸 ✓(codi_done_, 증거 없음 → ?) · 국어
 *                  순공 사진(W) · 종이 가져옴 · 학생앱 줄 student_planner_ 있음
 *     ○○○2 BBB222: 학생 달력 없음 · 다음 주 코디 계획 3칸만(codi_plan_) · 학생앱 줄 없음
 *     ○○○3 CCC333: 아무것도 없음
 *   검사: 첫 학생 자동 선택 · 줄 누르면 고르기(파란 띠) · 숫자·요일 묶음·접기/펼치기 · 출처 글자 · ↑/↓ · 입력 칸에선 안 움직임 ·
 *         지난/이번/다음 주 · 실천 ✓ = 표의 계획 실천과 같은 자료 · 표의 주를 넘겨도 선택 유지 · ⤢ 크게 보기 · 🧭 코디로 ·
 *         💬 한마디 → wpmsg_<코드> 모양 · student_planner_.teacherComment (updated_at 안 보냄) · 👍 좋아요만 · 내리기 ·
 *         발행(publishPlannerDataForStudent) 뒤에도 한마디 유지 · 학생앱 줄 없는 학생 · 순공 사진·크게 · 인쇄 ·
 *         1280 오른쪽 칸 폭 · 1024 서랍 · 420px 표 아래 · 가로 스크롤 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19114.js lumen_v19-114.html
 *   그림: $SP/v19114_panel.png (1600px) · 가짜 서버 · 외부망 차단. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-114.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-114'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
/* 날짜 (KST) */
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const TODAY = iso(new Date(Date.now() + 9 * 3600000));
const MON = add(TODAY, -((new Date(TODAY + 'T00:00:00Z').getUTCDay() + 6) % 7));
const W = add(MON, -7), NX = MON;
const it = (id, d, tm, n, subj, title, kind, ref, src) => ({ id, d, t: tm, n, subj, title, kind, ref, src, part: '', mv: false, at: W + 'T10:00:00Z' });
const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '초등학교 6학년', group: 'T5', lumen_rec_code: 'BBB222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중학교 3학년', group: 'T5', lumen_rec_code: 'CCC333', lumen_planner: {} } ];
const STORE = {
  lumen_group_days: { T5: [2, 4, 6] },
  plweek_paper: { byCode: { AAA111: { [W]: { at: MON + 'T03:00:00Z' } } } },
  sungong_AAA111: { code: 'AAA111', weeks: { [W]: { subj: { '수학': 600, '영어': 150 }, total: 750, note: '이번 주 열심히', photo: 'AAA111/sungong_test.jpg', at: add(W, 6) + 'T10:00:00Z' } } },
  wplan_AAA111: { code: 'AAA111', upd: add(W, 4) + 'T13:20:00Z', weeks: {
    [NX]: { imp: 1, upd: add(W, 4) + 'T13:20:00Z', submittedAt: add(W, 4) + 'T13:20:00Z', items: [
      it('n1', 0, '17:00', 2, '수학', '중1-2 (Ⅴ. 기본 도형)', 'todo', 'a:ws:111', 'codi'),
      it('n2', 0, '18:00', 2, '수학', '개념서 111~114쪽', 'book', '개념서', 'codi'),
      it('n3', 0, '21:00', 1, '영어', '단어 50개', '', '', 'me'),
      it('n4', 1, '17:00', 2, '수학', '교과서변형 학습지', 'ws', 'ws9', 'codi'),
      it('n5', 1, '19:00', 2, '국어', '수행평가 준비', '', '', 'me'),
      it('n6', 2, '16:00', 2, '수학', '오답 5문제 다시 풀기', 'wrong', '', 'codi'),
      it('n7', 2, '17:00', 2, '수학', '아하노트 재풀이 2개', 'aha', '', 'codi'),
      it('n8', 2, '18:00', 2, '수학', '목표 문제집', 'goal', '', 'codi'),
      it('n9', 2, '19:00', 2, '과학', '실험 보고서', '', '', 'me'),
      it('n10', 2, '20:00', 2, '수학', '숙제 카드', 'todo', 'a:hw:9', 'me') ] },
    [W]: { submittedAt: add(W, -3) + 'T12:00:00Z', items: [
      it('w1', 0, '19:00', 2, '영어', '영어 독해', '', '', 'me'),
      it('w2', 1, '19:00', 2, '수학', '수학 숙제', '', '', 'me'),
      it('w3', 2, '17:00', 2, '수학', '코디 학습지', 'todo', 'a:ws:5', 'codi'),
      it('w4', 3, '19:00', 2, '국어', '국어 문법', '', '', 'me') ] } } },
  wplan_chk_AAA111: { weeks: { [W]: { w1: { ok: true, at: add(W, 0) + 'T12:00:00Z' }, w2: { ok: true, at: add(W, 1) + 'T12:00:00Z' } }, [NX]: { n1: { ok: true, at: NX + 'T09:00:00Z' } } } },
  codi_done_AAA111: { [add(W, 2)]: { w3: { at: add(W, 2) + 'T12:00:00Z' } } },
  student_planner_AAA111: { studentId: 'S1', scores: {}, flags: {}, weekly: {}, teacherComment: '', lastUpdated: W + 'T00:00:00Z' },
  codi_plan_BBB222: { week: NX, made: add(W, 6) + 'T14:00:00Z', upd: add(W, 6) + 'T14:00:00Z', blocks: [
    { id: 'b1', d: 0, s: 20, n: 2, part: '', item: { kind: 'book', subj: '수학', title: '개념서 30~35쪽', ref: 'x', min: 60 } },
    { id: 'b2', d: 2, s: 22, n: 2, part: '', item: { kind: 'todo', subj: '수학', title: '학습지 7', ref: 'a:ws:55', min: 60 } },
    { id: 'b3', d: 4, s: 24, n: 2, part: '', item: { kind: 'wrong', subj: '수학', title: '오답 5문제', min: 60 } } ] },
  plweek_ev: { byCode: {} } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [], opened: [] };
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
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    window.open = () => { const doc = { html: '', open() {}, write(s) { doc.html += s; }, close() {} }; T.opened.push(doc); return { document: doc }; };
    try { _origSetItem('lumen_plw_pub_stamp', rk113Stamp()); } catch (e) {}
    try { _origSetItem('wkc_mode', JSON.stringify({ m: 'score', d: PW.day() })); } catch (e) {}   /* 플래너 자동 다시 올리기는 이 검사와 상관없음 */
    T.seed = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {} };
    T.seed();
    Object.assign(PWB, { loaded: false, loading: false, at: 0, W: null });
  }, { STORE, STUDENTS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);

  /* ① 열기 → 불러온 뒤 첫 학생 자동 선택 */
  await pg.evaluate(() => { T.seed(); VIEW = 'plweek'; render(); });
  await settle(1800);
  const A = await pg.evaluate(() => {
    const tp = document.getElementById('TOOL_PANEL'), pn = document.getElementById('wpp-panel');
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;   /* 학원앱은 화면 폭·글씨 크기에 따라 body zoom 을 건다 */
    return { order: PWB.order, sel: WPP.sel, z, tpw: tp ? tp.getBoundingClientRect().width / z : 0, head: pn ? pn.querySelector('h3').textContent : '',
      rows: [...document.querySelectorAll('#CONTENT tr.wpp-row')].map((r) => r.getAttribute('data-wpp')), selRows: [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.getAttribute('data-wpp')),
      evOn: JSON.stringify(PWB.ev || {}) };
  });
  console.log(JSON.stringify(A));
  t('표 순서 AAA111 → BBB222 → CCC333 · 줄 3개 모두 고를 수 있음', JSON.stringify(A.order) === '["AAA111","BBB222","CCC333"]' && A.rows.length === 3, JSON.stringify(A));
  t('1600px: 오른쪽 칸(380px)에 맨 위 학생 자동 — 「📅 ○○○1 주간계획표」 · 그 줄만 파란 띠', A.sel === 'AAA111' && A.head === '📅 ○○○1 주간계획표' && Math.round(A.tpw) === 380 && JSON.stringify(A.selRows) === '["AAA111"]', JSON.stringify(A));

  /* ② 다른 줄 누르기(빈 칸) → 고르기 / 다시 ○○○1 */
  await pg.click('#CONTENT tr[data-wpp="CCC333"] td:nth-child(6)'); await settle(500);
  const B0 = await pg.evaluate(() => ({ sel: WPP.sel, h: document.querySelector('#wpp-panel h3').textContent, selRows: [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.getAttribute('data-wpp')), none: (document.querySelector('#wpp-panel .wpp-none') || {}).textContent || '' }));
  t('줄 누르면 그 학생 — ○○○3 (계획 없음 안내)', B0.sel === 'CCC333' && B0.h === '📅 ○○○3 주간계획표' && JSON.stringify(B0.selRows) === '["CCC333"]' && /아직 없어요/.test(B0.none), JSON.stringify(B0));
  await pg.click('#CONTENT tr[data-wpp="AAA111"] .wks-nm'); await settle(500);   /* v19-115 점수 보기: 📅 단추 대신 이름 */
  const B = await pg.evaluate(() => {
    const pn = document.getElementById('wpp-panel'), kp = [...pn.querySelectorAll('.wpp-kpi b')].map((b) => b.textContent);
    const days = [...pn.querySelectorAll('.wpp-day')].map((d) => ({ h: d.querySelector('h4').textContent, n: d.querySelectorAll('.wpp-it').length, more: (d.querySelector('.wpp-more') || {}).textContent || '' }));
    const items = {}; pn.querySelectorAll('.wpp-it').forEach((x) => { items[x.getAttribute('data-id')] = { t: x.querySelector('.t').textContent, ck: x.querySelector('.wpp-ck').className, src: x.querySelector('.src').textContent, sj: x.querySelector('.wpp-sj').textContent }; });
    const tr = document.querySelector('#CONTENT tr.wpp-sel'), td0 = tr && tr.querySelector('td');
    return { week: pn.getAttribute('data-week'), seg: (pn.querySelector('.wpp-seg .on') || {}).textContent, line: pn.querySelector('.wpp-line').textContent, kp, days, items,
      bar: td0 ? getComputedStyle(td0).boxShadow : '', bg: td0 ? getComputedStyle(td0).backgroundColor : '', cal: (tr.querySelector('.wpp-calon') || {}).textContent || '' };
  });
  console.log(JSON.stringify({ line: B.line, kp: B.kp, days: B.days }, null, 1));
  t('📅 단추로 ○○○1 · 기본 «다음 주» = ' + NX + ' · 고른 줄 파란 띠·옅은 파랑·📅▸', B.week === NX && B.seg === '다음 주' && /(inset 4px 0px 0px|4px 0px 0px 0px inset)/.test(B.bar) && /rgb\(239, 246, 255\)/.test(B.bg) , JSON.stringify([B.week, B.seg, B.bar, B.bg, B.cal]));
  const md = (s) => (+s.slice(5, 7)) + '/' + (+s.slice(8, 10));
  t('머리 줄: 월~일 날짜 · 제출(제때 · 5점) · 스터디 코디에서 가져온 6개 · 직접 4개', B.line.indexOf(md(NX) + '(월) ~ ' + md(add(NX, 6)) + '(일)') === 0 && /제출 .* \(제때 · 5점\)/.test(B.line) && /스터디 코디에서 가져온 6개 · 직접 4개/.test(B.line), B.line);
  t('숫자 칸: 계획 10 · 실천 체크 1 · 계획 시간 9.5h (30분 칸 19개)', JSON.stringify(B.kp) === '["10","1","9.5h"]', JSON.stringify(B.kp));
  t('요일 묶음: 월 3 · 화 2 · 수 5(3개만 + 「… 2개 더 (펼치기)」) · 목~일 없음', B.days.length === 7 && B.days[0].n === 3 && /3개/.test(B.days[0].h) && B.days[1].n === 2 && B.days[2].n === 3 && /5개/.test(B.days[2].h) && B.days[2].more === '… 2개 더 (펼치기)' && B.days.slice(3).every((d) => d.n === 0 && /없음/.test(d.h)) && /^월 /.test(B.days[0].h) && /^일 /.test(B.days[6].h), JSON.stringify(B.days));
  t('출처: a:ws: 할 일=학습지 · 교재 · 직접 · ws=학습지 · 오답 · (코디 🧭) · 시각 순서', B.items.n1.src === '🧭학습지' && B.items.n2.src === '🧭교재' && B.items.n3.src === '직접' && B.items.n4.src === '🧭학습지' && B.items.n5.src === '직접' && B.items.n6.src === '🧭오답' && B.items.n1.t === '17:00' && B.items.n3.sj === '영어', JSON.stringify(B.items));
  t('실천 ✓ = wplan_chk_ (월 17:00 할 일만 ✓)', /\bon\b/.test(B.items.n1.ck) && Object.keys(B.items).filter((k) => /\bon\b/.test(B.items[k].ck)).length === 1, JSON.stringify(B.items));
  await pg.click('#wpp-panel .wpp-day[data-d="2"] .wpp-more'); await settle(300);
  const B2 = await pg.evaluate(() => { const d = document.querySelector('#wpp-panel .wpp-day[data-d="2"]'); const ids = [...d.querySelectorAll('.wpp-it')].map((x) => x.getAttribute('data-id')); const src = {}; d.querySelectorAll('.wpp-it').forEach((x) => { src[x.getAttribute('data-id')] = x.querySelector('.src').textContent; }); return { ids, more: d.querySelector('.wpp-more').textContent, src }; });
  t('펼치기 → 수요일 5개 · 「접기」 · 아하노트·목표·직접·할 일(a:hw:)', B2.ids.join(',') === 'n6,n7,n8,n9,n10' && B2.more === '접기' && B2.src.n7 === '🧭아하노트' && B2.src.n8 === '🧭목표' && B2.src.n9 === '직접' && B2.src.n10 === '할 일', JSON.stringify(B2));

  /* ③ ↑/↓ — 입력 칸 밖에서만 */
  const K = [];
  await pg.evaluate(() => { document.activeElement && document.activeElement.blur && document.activeElement.blur(); });
  await pg.keyboard.press('ArrowDown'); await settle(200); K.push(await pg.evaluate(() => WPP.sel + '|' + document.querySelector('#wpp-panel h3').textContent));
  await pg.keyboard.press('ArrowDown'); await settle(200); K.push(await pg.evaluate(() => WPP.sel));
  await pg.keyboard.press('ArrowDown'); await settle(200); K.push(await pg.evaluate(() => WPP.sel));   /* 끝에서 멈춤 */
  await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('ArrowUp'); await settle(300); K.push(await pg.evaluate(() => WPP.sel + '|' + [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.getAttribute('data-wpp')).join(',')));
  await pg.focus('#wpp-msg'); await pg.keyboard.press('ArrowDown'); await settle(200); K.push(await pg.evaluate(() => WPP.sel));
  t('↓ ↓ ↓ ↑ ↑ = BBB222 → CCC333 → (끝) → AAA111 · 한마디 칸 안에서는 안 움직임', K[0] === 'BBB222|📅 ○○○2 주간계획표' && K[1] === 'CCC333' && K[2] === 'CCC333' && K[3] === 'AAA111|AAA111' && K[4] === 'AAA111', JSON.stringify(K));

  /* ④ ○○○2 = 코디 계획만 */
  await pg.evaluate(() => wppPick('BBB222')); await settle(500);
  const C2 = await pg.evaluate(() => { const pn = document.getElementById('wpp-panel'); return { line: pn.querySelector('.wpp-line').textContent, kp: [...pn.querySelectorAll('.wpp-kpi b')].map((b) => b.textContent), ids: [...pn.querySelectorAll('.wpp-it')].map((x) => x.getAttribute('data-id') + ':' + x.querySelector('.t').textContent + ':' + x.querySelector('.src').textContent) }; });
  t('○○○2: 학생 달력이 비면 코디 계획(codi_plan_) — 3칸 · 시각 17:00/18:00/19:00 · 코디 계획 시각 제때 5점', /코디가 짠 계획/.test(C2.line) && /코디 계획 .*\(제때 · 5점\)/.test(C2.line) && C2.ids.join(',') === 'b1:17:00:🧭교재,b2:18:00:🧭학습지,b3:19:00:🧭오답' && JSON.stringify(C2.kp) === '["3","0","3h"]', JSON.stringify(C2));

  /* ⑤ 이번 주 / 지난 주 · 실천 ✓ 가 표의 «계획 실천»과 같은 자료 */
  await pg.evaluate(() => wppPick('AAA111')); await settle(400);
  await pg.click('#wpp-panel .wpp-seg button:nth-child(2)'); await settle(300);
  const D = await pg.evaluate(() => {
    const pn = document.getElementById('wpp-panel'), st = students.find((s) => s.lumen_rec_code === 'AAA111'), sc = plwScore(st, PWB.W || plwDefaultW());
    const ck = {}; pn.querySelectorAll('.wpp-it').forEach((x) => { ck[x.getAttribute('data-id')] = x.querySelector('.wpp-ck').className.replace('wpp-ck', '').trim() || '-'; });
    const tr = document.querySelector('#CONTENT tr[data-wpp="AAA111"]'), cell = tr.children[2].querySelector('.wks-pill').getAttribute('title').replace('계획 실천 ', '');
    return { week: pn.getAttribute('data-week'), ck, kp: [...pn.querySelectorAll('.wpp-kpi b')].map((b) => b.textContent), lines: [...pn.querySelectorAll('.wpp-line')].map((l) => l.textContent), prac: sc.prac, cell };
  });
  console.log(JSON.stringify(D));
  const pl = D.lines.find((l) => /점수로 센 실천/.test(l)) || '';
  t('«이번 주» = 표의 주 ' + W + ' · ✓ 영어(직접 체크) · ? 수학·코디 칸(플래너 O·증거 없음) · 국어 빈칸', D.week === W && D.ck.w1 === 'on' && D.ck.w2 === 'ev' && D.ck.w3 === 'ev' && D.ck.w4 === '-' && D.kp[1] === '3', JSON.stringify(D.ck));
  t('점수로 센 실천 = 표의 「계획 실천」 칸과 같음 (' + D.prac.ok + '/' + D.prac.n + ' · ' + D.prac.rate + '% → ' + D.prac.pt + '점)', pl.indexOf('점수로 센 실천 ' + D.prac.ok + '/' + D.prac.n + ' · ' + D.prac.rate + '% → ' + D.prac.pt + '점') === 0 && D.cell.indexOf(D.prac.ok + '/' + D.prac.n + ' · ' + D.prac.rate + '%') === 0 && (!D.prac.noEv || pl.indexOf('증거 없음 ' + D.prac.noEv) > 0), pl + ' / ' + D.cell);
  await pg.click('#wpp-panel .wpp-seg button:nth-child(1)'); await settle(300);
  const D2 = await pg.evaluate(() => document.getElementById('wpp-panel').getAttribute('data-week'));
  t('«지난 주» = W-7', D2 === add(W, -7), D2);

  /* ⑥ 표의 주를 넘겨도 선택 유지 (지난 주 › 다음 주) */
  await pg.click('#wpp-panel .wpp-seg button:nth-child(3)'); await settle(200);
  const E = await pg.evaluate(async () => { plwGo(-1); await new Promise((r) => setTimeout(r, 300)); const a = { W: PWB.W, sel: WPP.sel, wk: document.getElementById('wpp-panel').getAttribute('data-week'), rows: [...document.querySelectorAll('#CONTENT tr.wpp-sel')].map((r) => r.getAttribute('data-wpp')) };
    plwGo(1); await new Promise((r) => setTimeout(r, 300)); a.back = { W: PWB.W, sel: WPP.sel, wk: document.getElementById('wpp-panel').getAttribute('data-week') }; return a; });
  t('표의 주를 앞으로 넘겨도 ○○○1 그대로 · 오른쪽 «다음 주» = 그 주 +7', E.sel === 'AAA111' && E.W === add(W, -7) && E.wk === W && JSON.stringify(E.rows) === '["AAA111"]' && E.back.sel === 'AAA111' && E.back.wk === NX, JSON.stringify(E));

  /* ⑦ ⤢ 크게 보기 · 🧭 코디 */
  await pg.click('#wpp-panel .wpp-btn:nth-child(1)'); await settle(300);
  const F = await pg.evaluate(() => { const ov = document.getElementById('plw-cal-ov'); const r = { open: !!ov, txt: ov ? ov.innerText.slice(0, 200) : '', W: PWC.W }; if (ov) plwCalClose(); return r; });
  t('⤢ 크게 보기 → 달력 창(학생앱 모양) · 같은 주', F.open && /○○○1/.test(F.txt) && F.W === NX, JSON.stringify(F));
  await pg.click('#wpp-panel .wpp-btn:nth-child(3)'); await settle(400);
  const G = await pg.evaluate(() => ({ v: VIEW, sel: CD.sel, toast: T.toasts.slice(-1)[0] || '' }));
  t('🧭 스터디 코디에서 고치기 → 코디 화면 · CD.sel = AAA111', G.v === 'codi' && G.sel === 'AAA111', JSON.stringify(G));
  await pg.evaluate(() => { VIEW = 'plweek'; render(); }); await settle(400);

  /* ⑧ 💬 한마디 */
  await pg.fill('#wpp-msg', '월요일 영어 단어는 학원 오기 전에!');
  await pg.evaluate(() => { T.ups = []; T.toasts = []; });
  await pg.click('#wpp-msgbox .wpp-btn.pri'); await settle(500);
  const H = await pg.evaluate(() => ({ msg: T.store.wpmsg_AAA111, sp: T.store.student_planner_AAA111, ups: T.ups.map((u) => ({ k: u.keys.join('+'), upd: u.upd[0] })), toast: T.toasts.slice(-1)[0] || '', sent: (document.querySelector('#wpp-msgbox .wpp-sent') || {}).textContent || '', ta: document.getElementById('wpp-msg').value }));
  console.log(JSON.stringify(H, null, 1));
  const e1 = H.msg && H.msg.weeks && H.msg.weeks[NX];
  t('보내기 → wpmsg_AAA111 = { code, upd, last, weeks:{ ' + NX + ':{ text, like:false, at } }, log } (updated_at 보냄)', !!e1 && e1.text === '월요일 영어 단어는 학원 오기 전에!' && e1.like === false && !!e1.at && H.msg.code === 'AAA111' && H.msg.last === NX && H.msg.log.length === 1 && H.ups.some((u) => u.k === 'wpmsg_AAA111' && u.upd === true), JSON.stringify(H.msg));
  t('학생앱 줄 student_planner_AAA111.teacherComment 에 한마디 · 다른 칸 그대로 · updated_at 안 보냄', /월요일 영어 단어는 학원 오기 전에! — 원장님$/.test(H.sp.teacherComment) && H.sp.teacherComment.indexOf('📅 ' + md(NX) + '~' + md(add(NX, 6)) + ' 계획: ') === 0 && H.sp.studentId === 'S1' && H.ups.some((u) => u.k === 'student_planner_AAA111' && u.upd === false), JSON.stringify([H.sp, H.ups]));
  t('패널에 「학생앱에 보이는 중」 · 칸 비움 · 알림', /학생앱에 보이는 중/.test(H.sent) && H.ta === '' && /선생님 한마디/.test(H.toast), JSON.stringify([H.sent, H.ta, H.toast]));
  /* 플래너 승인(발행)이 공용 코멘트로 다시 써도 한마디 유지 */
  const I = await pg.evaluate(async () => { const st = students.find((s) => s.lumen_rec_code === 'AAA111'); T.ups = []; await publishPlannerDataForStudent(st); await new Promise((r) => setTimeout(r, 300));
    return { tc: T.store.student_planner_AAA111.teacherComment, ups: T.ups.map((u) => u.keys.join('+') + ':' + u.upd[0]), weekly: !!T.store.student_planner_AAA111.weekly }; });
  t('발행(publishPlannerDataForStudent) 뒤에도 한마디 다시 들어감', /학원 오기 전에! — 원장님$/.test(I.tc) && I.ups.filter((u) => /^student_planner_AAA111/.test(u)).length === 2 && I.ups.indexOf('student_planner_AAA111:false') >= 0, JSON.stringify(I));
  /* 👍 좋아요만 */
  await pg.evaluate(() => { T.ups = []; }); await pg.click('#wpp-msgbox .wpp-btn:nth-child(2)'); await settle(500);
  const J = await pg.evaluate(() => ({ e: T.store.wpmsg_AAA111.weeks[WPP.rel === 'next' ? PW.add(PWB.W || plwDefaultW(), 7) : ''], tc: T.store.student_planner_AAA111.teacherComment, log: T.store.wpmsg_AAA111.log.length }));
  t('👍 좋아요만 → { text:"", like:true } · 학생앱 「👍 … 주간계획 좋아요! — 원장님」', J.e && J.e.like === true && J.e.text === '' && J.tc === '👍 ' + md(NX) + '~' + md(add(NX, 6)) + ' 주간계획 좋아요! — 원장님' && J.log === 2, JSON.stringify(J));
  /* ✕ 내리기 → 공용 코멘트(여기선 빈 글)로 */
  await pg.click('#wpp-msgbox .wpp-btn:nth-child(3)'); await settle(500);
  const K2 = await pg.evaluate(() => ({ off: !!T.store.wpmsg_AAA111.weeks[PW.add(PWB.W || plwDefaultW(), 7)].off, tc: T.store.student_planner_AAA111.teacherComment, sent: !!document.querySelector('#wpp-msgbox .wpp-sent') }));
  t('✕ 내리기 → off 표시 · 학생앱 칸은 공용 코멘트(빈 글)로', K2.off && K2.tc === '' && !K2.sent, JSON.stringify(K2));
  /* 학생앱 줄이 없는 ○○○2 */
  await pg.evaluate(() => wppPick('BBB222')); await settle(500);
  await pg.fill('#wpp-msg', '수요일 계획이 비었어요'); await pg.evaluate(() => { T.toasts = []; });
  await pg.click('#wpp-msgbox .wpp-btn.pri'); await settle(500);
  const L = await pg.evaluate(() => ({ msg: T.store.wpmsg_BBB222, row: T.store.student_planner_BBB222 || null, toast: T.toasts.slice(-1)[0] || '', note: document.getElementById('wpp-msgbox').textContent }));
  t('학생앱 줄 없는 학생: wpmsg_ 만 저장 · student_planner_ 새로 안 만듦 · 「첫 승인 때」 안내', L.msg && L.msg.weeks[NX] && L.msg.weeks[NX].text === '수요일 계획이 비었어요' && !L.row && /첫 승인 때/.test(L.toast) && /첫 승인 때/.test(L.note), JSON.stringify(L).slice(0, 300));

  /* ⑨ 순공 · 인쇄 */
  await pg.evaluate(() => wppPick('AAA111')); await settle(500);
  const M = await pg.evaluate(() => { const b = document.getElementById('wpp-sg'); const img = b.querySelector('img'); return { txt: b.textContent, src: img ? img.getAttribute('src') : '' }; });
  t('📔 이번 주 순공: 사진 제출 5점 · 종이 가져옴 5점 · 순공 12:30 · 사진(sungong_.weeks[W].photo)', /사진 제출 .*5점/.test(M.txt) && /종이 제출 .*5점/.test(M.txt) && /순공 12:30/.test(M.txt) && /AAA111\/sungong_test\.jpg$/.test(M.src), JSON.stringify(M));
  await pg.click('#wpp-sg .wpp-ph button'); await settle(200);
  const N1 = await pg.evaluate(() => !!document.getElementById('wpp-zoom'));
  await pg.keyboard.press('Escape'); await settle(150);
  const N2 = await pg.evaluate(() => !!document.getElementById('wpp-zoom'));
  t('사진 누르면 크게 · Esc 로 닫힘', N1 && !N2, JSON.stringify([N1, N2]));
  await pg.evaluate(() => { T.opened = []; wppPrint(); });
  const P1 = await pg.evaluate(() => (T.opened[0] || {}).html || '');
  t('🖨 인쇄 = 그 주 계획만(새 창) — 이름 · 할 일 10개 · ☑ 1개 · 출처', /○○○1 주간계획표/.test(P1) && /할 일 10개/.test(P1) && (P1.match(/☑/g) || []).length === 1 && /교재/.test(P1) && /window\.print/.test(P1) && !/<table[^>]*>[\s\S]*plweek/.test(P1), P1.slice(0, 160));

  /* ⑩ 그림 (1600) */
  await pg.evaluate(() => { const h = document.querySelector('.ui-scroll-hint, #uiScrollHint'); if (h) h.style.display = 'none'; WPP.rel = 'next'; WPP.sel = 'CCC333'; wppPick('AAA111'); });
  await settle(600);
  t('다른 학생을 고르면 오른쪽 칸은 맨 위부터', await pg.evaluate(() => document.getElementById('TOOL_PANEL').scrollTop === 0));
  await pg.screenshot({ path: SP + '/v19114_panel.png', fullPage: false });

  /* ⑪ 1280 · 1024(서랍) · 420(표 아래) — 가로 스크롤 없음 */
  const sizes = {};
  for (const w of [1280, 1024, 420]) {
    await pg.setViewportSize({ width: w, height: 900 }); await settle(500);
    await pg.evaluate(() => render()); await settle(300);
    sizes[w] = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: innerWidth,
      tp: (() => { const e = document.getElementById('TOOL_PANEL'), z = parseFloat(getComputedStyle(document.body).zoom) || 1; return e ? Math.round(e.getBoundingClientRect().width / z) : -1; })(),
      fab: (() => { const f = document.getElementById('L3_FAB'); return !!(f && f.classList.contains('on') && getComputedStyle(f).display !== 'none'); })(),
      inline: !!document.getElementById('wpp-inline') }));
  }
  console.log(JSON.stringify(sizes));
  t('1280: 오른쪽 칸 340px · 가로 스크롤 없음', sizes[1280].tp === 340 && sizes[1280].sw <= 1280 && !sizes[1280].inline, JSON.stringify(sizes[1280]));
  t('1024: 칸 숨김 · 「🛠 도구」 단추 · 가로 스크롤 없음', sizes[1024].fab && sizes[1024].sw <= 1024 && !sizes[1024].inline, JSON.stringify(sizes[1024]));
  await pg.setViewportSize({ width: 1024, height: 900 }); await settle(400); await pg.evaluate(() => render()); await settle(200);
  await pg.click('#CONTENT tr[data-wpp="BBB222"] td:nth-child(6)'); await settle(500);
  const Q = await pg.evaluate(() => { const tp = document.getElementById('TOOL_PANEL'); return { drawer: tp.classList.contains('l3-drawer'), vis: getComputedStyle(tp).display, h: (tp.querySelector('#wpp-panel h3') || {}).textContent || '', sw: document.documentElement.scrollWidth }; });
  t('1024: 줄 누르면 서랍이 열리고 ○○○2 주간계획표', Q.drawer && Q.vis !== 'none' && Q.h === '📅 ○○○2 주간계획표' && Q.sw <= 1024, JSON.stringify(Q));
  await pg.evaluate(() => l3Drawer(false));
  await pg.setViewportSize({ width: 420, height: 860 }); await settle(500); await pg.evaluate(() => { mobSetPc(true); VIEW = 'plweek'; render(); }); await settle(300);   /* 폰은 「🖥 PC 화면」으로 와야 주간 점수가 있다 */
  await pg.evaluate(() => { const tr = document.querySelector('#CONTENT tr[data-wpp="AAA111"]'); tr.children[5].click(); }); await settle(600);
  const R = await pg.evaluate(() => { const ip = document.getElementById('wpp-inline'); const r = ip ? ip.getBoundingClientRect() : null;
    return { inline: !!ip, h: ip ? ip.querySelector('h3').textContent : '', w: r ? Math.round(r.width) : 0, sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, n: ip ? ip.querySelectorAll('.wpp-it').length : 0,
      tableScroll: (() => { const tb = document.querySelector('#CONTENT table'); return tb ? tb.parentElement.scrollWidth > tb.parentElement.clientWidth : null; })() }; });
  t('420px: 표 아래에 주간계획표(○○○1) · 칸이 화면 안 · 페이지 가로 스크롤 없음(표는 칸 안에서만 밀림)', R.inline && R.h === '📅 ○○○1 주간계획표' && R.w <= 420 && R.sw <= 420 && R.bw <= 420 && R.n > 0, JSON.stringify(R));
  await pg.evaluate(() => { const ip = document.getElementById('wpp-inline'); if (ip) ip.scrollIntoView({ block: 'start' }); }); await settle(200);
  await pg.screenshot({ path: SP + '/v19114_phone.png', fullPage: false });
  await pg.setViewportSize({ width: 1600, height: 1000 }); await settle(300);

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
