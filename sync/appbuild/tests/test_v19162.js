#!/usr/bin/env node
/* 학원앱 v19-162 검사 — 📞 학부모 상담 통합(리포트 · 대본 · 기록) (가짜 학생 홍길동 · 가짜 교재 3권 · 날짜는 오늘 기준으로 만든다)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19162.js lumen_v19-162.html [스크린샷.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-162.html');
const SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-162');
  t('진도·리포트 탭의 «상담 리포트»는 빠짐', await pg.evaluate(() => !GROUPS.find((g) => g.key === 'score').subs.some((s) => s.v === 'consult')));
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
    window.__STU = students.slice(); window.__STORE.counsel_log = {}; CR.code = ''; CR.data = null; cnsOpen('s1');
  });
  await pg.waitForTimeout(1500);
  const txt = () => pg.evaluate(() => document.body.innerText);
  let tx = await txt();
  t('왼쪽 단추 화면(counsel) · 제목 «📞 학부모 상담» · 탭 3개', await pg.evaluate(() => VIEW === 'counsel') && /📞 학부모 상담/.test(tx) && /📊 상담 리포트/.test(tx) && /📞 통화 대본/.test(tx) && /📝 상담 기록/.test(tx), tx.slice(0, 300));
  t('브리핑: 숙제 해 온 수업 «20번 중 N번» · 집중 교재 진도·필요 속도', /20번 중 \d번/.test(tx) && /개념편 숙제 해 온 수업/.test(tx) && /필요 주 \+\d+쪽/.test(tx));
  t('리포트 탭(기본): 숙제 흐름 · 과정별 시험 그래프', /숙제 흐름/.test(tx) && /시험 점수 — 과정별/.test(tx) && (await pg.evaluate(() => document.querySelectorAll('.cr svg').length)) >= 10);
  await pg.evaluate(() => cn2Tab('script')); await pg.waitForTimeout(300); tx = await txt();
  t('통화 대본 탭: 옛 대본 + «꼭 짚을 것 — 개념편 숙제 흐름»(리포트 숫자)', /꼭 짚을 것 — 개념편 숙제 흐름/.test(tx) && /최근 수업 20번 중/.test(tx) && /예상 질문/.test(tx));
  t('대본 탭에 옛 머리줄·브리핑·통화 후 기록 칸이 겹치지 않음', (tx.match(/통화 전 30초 브리핑/g) || []).length === 1 && !/통화 후 기록/.test(tx) && (await pg.evaluate(() => document.querySelectorAll('select').length)) <= 4 && (await pg.evaluate(() => document.querySelectorAll('#cns-note').length)) === 0);
  await pg.evaluate(() => cnsKind('drop')); await pg.waitForTimeout(200);
  t('상담 종류 바꾸면 대본이 바뀌고 탭 유지', await pg.evaluate(() => CNS.kind === 'drop' && CNS.tab === 'script' && /걱정되는 것/.test(document.body.innerText)));
  await pg.evaluate(() => cn2Tab('log')); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const n = document.getElementById('cns-note'); n.value = '가짜 통화 메모'; n.dispatchEvent(new Event('input')); const p = document.getElementById('cr-plan'); p.value = '가짜 계획 한 줄'; p.dispatchEvent(new Event('input')); cnsMood('good'); });
  await pg.evaluate(() => cn2Save()); await pg.waitForTimeout(500);
  const sv = await pg.evaluate(() => ({ log: JSON.stringify(CNS.log || {}), c: window.__STORE.consult_C1 }));
  t('📝 저장 한 번 → 통화 메모(counsel_log) + 계획·숫자(consult_C1)', /가짜 통화 메모/.test(sv.log) && sv.c && sv.c.list.length === 1 && sv.c.list[0].plan === '가짜 계획 한 줄' && sv.c.list[0].nums.board === 20, JSON.stringify(sv).slice(0, 300));
  tx = await txt();
  t('지난 상담 목록: 📞 통화 · 📋 리포트(계획 주 N쪽 → 지금 주 M쪽)', /📞 \d{4}-\d{2}-\d{2}/.test(tx) && /📋 \d{4}-\d{2}-\d{2}/.test(tx) && /계획 주 \d+쪽 → 지금 주 \d+쪽/.test(tx));
  t('브리핑에 «지난번 계획 → 지금»', /지난번 계획/.test(tx));
  await pg.evaluate(() => cn2Tab('rep'));
  const pr = await pg.evaluate(() => { let html = ''; const fake = { document: { open(){}, write(h){ html += h; }, close(){} }, focus(){}, print(){} }; const o = window.open; window.open = () => fake; cn2Print(); window.open = o; return html; });
  t('리포트 탭 인쇄: 리포트 + 고친 계획 · 원장 메모 없음', /홍길동 학습 상담 리포트/.test(pr) && /가짜 계획 한 줄/.test(pr) && !/원장님만 보는/.test(pr));
  await pg.evaluate(() => { BP.sel = 's1'; VIEW = 'bookprog'; render(); }); await pg.waitForTimeout(300);
  t('진도 현황 «📋 상담 리포트» 단추 → 학부모 상담 화면 리포트 탭', await pg.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /📋 상담 리포트/.test(x.textContent)); if (!b) return false; b.click(); return VIEW === 'counsel' && CNS.tab === 'rep' && CNS.id === 's1'; }));
  await pg.evaluate(() => { VIEW = 'consult'; render(); }); await pg.waitForTimeout(300);
  t('옛 VIEW consult 로 와도 통합 화면', await pg.evaluate(() => VIEW === 'counsel' && /📞 학부모 상담/.test(document.body.innerText)));
  /* 검사 환경에선 앱이 가끔 시연용 학생으로 목록을 바꿔치기한다 → 가짜 학생을 다시 넣고 화면 함수를 바로 부른다 */
  const s2 = await pg.evaluate(() => { students.length = 0; window.__STU.forEach((x) => students.push(x)); CNS.id = 's2'; CR.code = ''; CNS.tab = 'script'; const a = rCounsel(); CNS.tab = 'log'; const b = rCounsel(); return { a: /박하나/.test(a) && /예상 질문/.test(a), note: /id="cns-note"/.test(b) }; });
  t('매쓰플랫 없는 학생으로 바꿔도 대본·기록 탭은 동작', s2.a && s2.note, JSON.stringify(s2));
  if (SHOT) { await pg.evaluate(() => { students.length = 0; window.__STU.forEach((x) => students.push(x)); CR.code = ''; cnsPick('s1'); cn2Tab('rep'); }); await pg.waitForTimeout(900); await pg.setViewportSize({ width: 1500, height: 2400 }); await pg.waitForTimeout(400); await pg.screenshot({ path: SHOT }); }
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
