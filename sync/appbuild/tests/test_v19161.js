#!/usr/bin/env node
/* 학원앱 v19-161 검사 — 📋 상담 리포트 (가짜 학생 홍길동 · 가짜 교재 3권 · 날짜는 오늘 기준으로 만든다)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19161.js lumen_v19-161.html [스크린샷.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-161.html');
const SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-161');
  t('진도·리포트 탭에 «상담 리포트»', await pg.evaluate(() => GROUPS.find((g) => g.key === 'score').subs.some((s) => s.v === 'consult')));
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const D = (n) => crAdd(crToday(), -n);
    /* 매쓰플랫 문항 기록: 집중 교재 b1 은 앞 4주만 거의 매 수업, 뒤로는 드문드문 · b2 는 꾸준히 · 학습지 */
    const recs = []; let id = 0;
    const add = (n, day, src, bid, title, wsid, okRate) => { for (let i = 0; i < n; i++) recs.push({ id: ++id, source: src, book_id: bid, result: (i / n) < okRate ? 'O' : 'X', score_datetime: day + 'T06:00:00+00:00', worksheet_title: title || null, student_worksheet_id: wsid || null }); };
    for (let k = 88; k >= 60; k -= 2) add(15, D(k), '교재', 101, null, null, 0.8);
    [50, 49, 30, 23].forEach((k) => add(k === 30 ? 2 : 20, D(k), '교재', 101, null, null, 0.8));
    for (let k = 88; k >= 1; k -= 3) add(25, D(k), '교재', 102, null, null, 0.75);
    for (let k = 80; k >= 40; k -= 4) add(12, D(k), '교재', 103, null, null, 0.85);
    for (let k = 86; k >= 2; k -= 2) add(20, D(k), '학습지', null, '중1 주간 (가짜)', 'w' + k, 0.6);
    add(11, D(3), '학습지', null, '가짜월일 가짜 개념편 - 중등수학1(하) 69~80p', 'wf1', 0.55);
    add(10, D(7), '학습지', null, '[오답] 가짜 개념편 - 중등수학1(하) 69~85p', 'wf2', 0.2);
    const hws = {}; for (let k = 40; k >= 1; k -= 3) for (let i = 0; i < 12; i++) hws['p' + k + '_' + i] = { at: D(k) + 'T06:00:00Z', r: i < 8 ? 'O' : 'X' };
    window.__STORE = { hw_scores_C1: { items: hws } };
    window.__TABLES = { mf_answer_records: recs, aha_notes: [{ created_at: D(80) + 'T05:00:00Z' }, { created_at: D(75) + 'T05:00:00Z' }, { created_at: D(70) + 'T05:00:00Z' }] };
    window.getSupaClient = function(){ return { storage: { from(){ return { list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } }, from(tb){ const o = { _t: tb, _k: null, _r: null, in(c, ks){ o._k = ks; return p; }, eq(c, k){ if (c === 'key') o._k = [k]; return p; }, range(a, b){ o._r = [a, b]; return p; },
      then(res, rej){ let data; if (o._t === 'lumen_store') data = (o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })); else { data = (window.__TABLES[o._t] || []); if (o._r) data = data.slice(o._r[0], o._r[1] + 1); }
        return Promise.resolve({ data, error: null }).then(res, rej); } };
      const p = new Proxy(o, { get(tg, k){ if (k in tg) return tg[k]; return function(){ return p; }; } }); return p; } }; };
    window.supaSetItem = function(k, v){ window.__STORE[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(true); };
    const mm = (n) => D(n).slice(0, 7);
    BP.books = { 101: { n: '가짜 개념편 - 중등수학1(하)', g: '중1-2', pages: 158 }, 102: { n: '가짜 RPM - 중등수학1(상)', g: '중1-1', pages: 0 }, 103: { n: '가짜 최상위 - 초등수학6-2', g: '초6-2', pages: 0 } };
    const months = {}; months[mm(88)] = { maxP: 53, c: 450, t: 584 }; months[mm(50)] = Object.assign(months[mm(50)] || {}, { maxP: 71, c: 111, t: 138 }); months[mm(1)] = { maxP: 85, c: 42, t: 52 };
    BP.prog = { m1: { 101: { firstDate: D(88), lastDate: D(7), maxPage: 85, weekPages: 5, months: months, chapters: [] },
      102: { firstDate: D(88), lastDate: D(1), maxPage: 130, weekPages: 9, months: { [mm(88)]: { maxP: 47, c: 447, t: 498 }, [mm(50)]: { maxP: 97, c: 430, t: 495 }, [mm(1)]: { maxP: 130, c: 284, t: 431 } }, chapters: [] },
      103: { firstDate: D(80), lastDate: D(40), maxPage: 77, weekPages: 0, months: { [mm(50)]: { maxP: 77, c: 199, t: 242 } }, chapters: [] } } };
    BP.mfList = [{ mf_student_id: 'm1', name: '홍길동', lumen_rec_code: 'C1' }];
    BP.cfg = { def: 3, months: {}, pages: {}, rep: { s1: '101' }, done: {}, starts: {} }; BP.loaded = true;
    WK.loaded = true;
    const T = (d, title, label, sem, score, avg, wc) => ({ date: d, type: 'WEEKLY', title, paper: { label, sem }, students: [{ sid: 'm1', date: d, score, acadAvg: avg, acadRank: 3, acadN: 5, wrongConcepts: (wc || []).map((n) => ({ n, cnt: 1 })) }] });
    WK.tests = [T(D(60), '중1 (2026.05.09)', '중1-1', 1, 80, 75), T(D(40), '중1 (2026.04.25)', '중1', null, 70, 80), T(D(19), '중1 (2026.05.09)', '중1-1', 1, 55, 63, ['일차식의 덧셈과 뺄셈', '식의 값']),
      T(D(5), '중1 (2026.05.30)', '중1-1', 1, 25, 52, ['일차식의 덧셈과 뺄셈', '등식의 성질', '여러 가지 일차방정식의 풀이']), T(D(30), '초6 (2026.10.03)', '초6', null, 90, 73), T(D(10), '초6 (2026.10.17)', '초6-2', 2, 85, 77)];
    groupDays.M3 = [1, 3, 5];
    const hw = {}, stt = {}, pl = []; for (let k = 85; k >= 1; k -= 2){ hw[D(k)] = { p: k > 45 ? 100 : 60, c: k > 45 ? 80 : 30, w: k > 45 ? 60 : 10 }; stt[D(k).replace(/-/g, '.')] = 180; }
    for (let k = 60; k >= 1; k -= 3) pl.push({ setId: D(k).replace(/-/g, '') + '_2300', analysis: { date: D(k).replace(/-/g, '.'), tasksTranscript: ['[O] 수학숙제 (RPM 20문제)', '[O] 영어숙제'], zeroReason: k === 6 ? 'dup' : '' } });
    students.length = 0;
    students.push({ id: 's1', name: '홍길동', grade: '초등학교 6학년', group: 'M3', school: '가짜초등학교', lumen_rec_code: 'C1', lumen_hw: hw, lumen_study_time: stt, lumen_planner_photos: pl, lumen_classMemo: { [D(20).replace(/-/g, '.')]: '가짜 수업 메모' }, lumen_attendance: { [D(15)]: { status: 'late', lateMin: 5 } } },
      { id: 's2', name: '박하나', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'C2' });
    CR.code = ''; CR.data = null; VIEW = 'consult'; render();
  });
  await pg.waitForTimeout(1200);
  const st = await pg.evaluate(() => ({ err: CR.err, loaded: !!CR.data, text: document.body.innerText }));
  t('리포트 그려짐 (오류 없음)', st.loaded && !st.err && /홍길동 학습 상담 리포트/.test(st.text), st.err);
  const X = await pg.evaluate(() => { const x = crCompute(); return { focus: x.focus, books: x.books, board: x.board.length, full: x.bFull, part: x.bPart, none: x.bNone, gaps: x.gaps.length, labs: x.labs, fws: x.fws.length, time: x.time.map((q) => [q.m, Math.round(q.avg || 0), Math.round(q.math || 0)]), wrong: x.wrong.slice(0, 2), need: x.prog && x.prog.need, memo: x.memo.join(' | '), plan: x.planDef }; });
  t('집중 교재 = 대표 교재(개념편) · 맨 앞', X.focus === '101' && X.books[0] === '101', JSON.stringify(X.books));
  t('수업 판: 최근 수업 20번 · 해 옴/조금/안 해 옴 나뉨', X.board === 20 && X.none >= 14 && X.full + X.part + X.none === 20, JSON.stringify([X.board, X.full, X.part, X.none]));
  t('집중 교재 빈 기간(빨간 띠) 잡힘', X.gaps >= 1, X.gaps);
  t('시험 과정별: 중1-2(집중 교재) 맨 앞 · 중1-1 · 초6-2 (학기 없는 시험지는 날짜로)', X.labs[0] === '중1-2' && X.labs.includes('중1-1') && X.labs.includes('초6-2') && !X.labs.includes('중1') && !X.labs.includes('초6'), JSON.stringify(X.labs));
  t('집중 교재 학습지 점수 2장(◆)', X.fws === 2, X.fws);
  t('하루 평균 공부 180분 · 수학은 할 일 비율(50%)로 90분', X.time.some((q) => q[1] === 180 && q[2] === 90), JSON.stringify(X.time));
  t('틀린 개념: «일차식의 덧셈과 뺄셈» 2번이 맨 위', X.wrong[0] && X.wrong[0][0] === '일차식의 덧셈과 뺄셈' && X.wrong[0][1] === 2, JSON.stringify(X.wrong));
  t('필요한 속도 · 계획 첫 줄', X.need && X.need.wk >= 10 && /주 \d+쪽씩/.test(X.plan), JSON.stringify(X.need) + ' ' + X.plan);
  t('원장 메모: 플래너 같은 사진 · 출결 지각 1 · 수업 메모', /예전 사진과 같은 쪽/.test(X.memo) && /지각 1회/.test(X.memo) && /가짜 수업 메모/.test(X.memo), X.memo);
  t('화면에 그래프 10개 이상(SVG)', (await pg.evaluate(() => document.querySelectorAll('.cr svg').length)) >= 10);
  t('숙제 현황판(수업일 칸 표) 없음', !(await pg.evaluate(() => !!document.querySelector('.cr table'))));
  if (SHOT) { await pg.setViewportSize({ width: 1500, height: 7400 }); await pg.waitForTimeout(400); await pg.screenshot({ path: SHOT }); await pg.setViewportSize({ width: 1500, height: 1000 }); }
  /* 집중 교재 바꾸기 */
  await pg.evaluate(() => crSetFocus('102')); await pg.waitForTimeout(300);
  t('집중 교재 바꾸면 RPM 기준으로', await pg.evaluate(() => crCompute().focus === '102' && /가짜 RPM - 중등수학1\(상\) — 숙제 흐름/.test(document.body.innerText)));
  await pg.evaluate(() => crSetFocus('101'));
  /* 인쇄 */
  const pr = await pg.evaluate(() => { let html = ''; const fake = { document: { open(){}, write(h){ html += h; }, close(){} }, focus(){}, print(){} }; const o = window.open; window.open = () => fake; crPrint(); window.open = o; return html; });
  t('인쇄 창: 리포트 있음 · 원장 메모 없음 · 계획은 목록', /홍길동 학습 상담 리포트/.test(pr) && !/원장님만 보는/.test(pr) && /<ol><li>/.test(pr) && !/<textarea/.test(pr));
  /* 계획 고쳐 쓰고 저장 */
  await pg.evaluate(() => { const ta = document.getElementById('cr-plan'); ta.value = '가짜 계획 한 줄'; ta.dispatchEvent(new Event('input')); crSave(); }); await pg.waitForTimeout(400);
  t('💾 저장 → consult_C1 에 계획·숫자', await pg.evaluate(() => { const v = window.__STORE.consult_C1; return v && v.list.length === 1 && v.list[0].plan === '가짜 계획 한 줄' && v.list[0].nums.board === 20; }));
  t('시작 다운로드에서 consult_ 뺌', await pg.evaluate(() => PULL_SKIP_PREFIX.indexOf('consult_') >= 0));
  /* 진도 현황 상세 단추 */
  await pg.evaluate(() => { BP.sel = 's1'; VIEW = 'bookprog'; render(); }); await pg.waitForTimeout(300);
  t('진도 현황 상세에 «📋 상담 리포트» → 그 학생 리포트', await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /📋 상담 리포트/.test(x.textContent)); if (!b) return false; b.click(); return VIEW === 'consult' && CR.code === 'C1'; }));
  await pg.waitForTimeout(600);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
