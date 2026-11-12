#!/usr/bin/env node
/* 학원앱 v19-187 검사 — 📈 성적 한눈에 (시안 docs/mockup_score_overview.html)
 *   외부망 차단 · getSupaClient 가짜(mf_weekly · mf_students 읽기만) · 이름 ○○○
 *   학생 A(중2, AAA111 ↔ 매쓰플랫 S1): 주간 7회(전국 등수 5회 · 1회는 비어 리포트로 채움 · 리포트에만 있는 옛 회차 1) · HIGH_TEST 주간 제목 1(전국 없음) · CHAPTER 1(안 보임)
 *          학교 2학기 중간 수학 84(직전 1학기 기말 79 → ↑5) · 다른 과목 2 · 일일 리포트 4회(학원 평균 이상 3)
 *   학생 B(중1, BBB222 ↔ S2): 주간 2회(상위 10% 이내) · 학교·일일 없음 · 리포트 없음 → 프로필이 열려야 함
 *   ① 메뉴 · 줄(점수 · 378/823명 3등급 색 · 미니 막대 6개 · 학교 · 일일) ② 정렬(전국 위치 · 하락) · 학년 고르기
 *   ③ 오른쪽: 회차 표(시험지 제목 · 리포트 보충 · 옛 회차 · 고등 자체 · 단원 빠짐) · 그래프 · 학교 ＋다른 과목 · 일일 막대
 *   ④ 학생 프로필 «📈 성적» 탭 · 리포트 없는 학생 프로필 열림 ⑤ 서버 쓰기 없음 · 버전 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19187.js lumen_v19-187.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-187.html');
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const P = (fn, a) => pg.evaluate(fn, a);
  await P(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.__W = [];
    const S = (sid, score, r, n, avg, acadAvg) => ({ sid, score, natRank: r, natN: n, natAvg: avg, acadAvg, date: '' });
    const T = (wid, type, title, date, sts) => ({ wid, key: 'w' + wid, type, title, date, students: sts });
    const MFW = { tests: [
      T(10, 'WEEKLY', '[중2] 주간 4회 · 일차부등식', '2026-09-23', [S('S1', 88, 124, 830, 72, 70)]),
      T(11, 'WEEKLY', '[중2] 주간 5회 · 연립방정식', '2026-09-30', [S('S1', 78, null, null, null, 69)]),
      T(12, 'WEEKLY', '[중2] 주간 6회', '2026-10-07', [S('S1', 85, 181, 819, 73, 70)]),
      T(13, 'WEEKLY', '[중2] 주간 7회', '2026-10-14', [S('S1', 90, 97, 824, 74, 71)]),
      T(14, 'WEEKLY', '[중2] 주간 8회', '2026-10-21', [S('S1', 75, 288, 817, 70, 68)]),
      T(15, 'WEEKLY', '[중2] 주간 10회 · 삼각형의 성질', '2026-11-04', [S('S1', 70, 378, 823, 68, 66)]),
      T(16, 'HIGH_TEST', '[중2] 주간 특강 테스트', '2026-11-06', [S('S1', 60, null, null, null, 55)]),
      T(17, 'CHAPTER', '[중2] 단원 테스트 · 안 보여야 함', '2026-11-07', [S('S1', 99, 1, 100, 80, 80)]),
      T(20, 'WEEKLY', '[중1] 주간 9회', '2026-10-28', [S('S2', 95, 30, 905, 64, 70)]),
      T(21, 'WEEKLY', '[중1] 주간 10회', '2026-11-04', [S('S2', 97, 20, 908, 62, 71)]) ] };
    window.__STORE = { mf_weekly: MFW };
    const mk = (tbl) => { const b = { f: {}, select() { return b; }, in(k, a) { b.f.in = a; return b; }, eq() { return b; }, order() { return b; }, limit() { return b; }, maybeSingle() { return b; },
      upsert() { __W.push(tbl); return Promise.resolve({ error: null }); }, update() { __W.push(tbl); return b; }, delete() { __W.push(tbl); return b; },
      then(r, j) { let data = [];
        if (tbl === 'lumen_store') data = (b.f.in || []).filter((k) => k in __STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(__STORE[k])) }));
        if (tbl === 'mf_students') data = [{ mf_student_id: 'S1', lumen_rec_code: 'AAA111' }, { mf_student_id: 'S2', lumen_rec_code: 'BBB222' }];
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    getSupaClient = function () { return { from: mk }; };
    students.length = 0;
    students.push({ id: 'A', name: '○○○A', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111', school: '테스트중' });
    students.push({ id: 'B', name: '○○○B', grade: '중학교 1학년', group: 'M7', lumen_rec_code: 'BBB222' });
    list.length = 0;
    const R = (date, testType, score, extra) => Object.assign({ id: 'r' + date + testType, name: '○○○A', studentId: 'A', grade: '중학교 2학년', group: 'T5', date, testType, score: String(score) }, extra || {});
    list.push(R('2026.09.30', 'weekly', 78, { rank: 247, total: 822, avgScore: 69 }));   /* 비어 있던 전국 등수 보충 */
    list.push(R('2026.06.10', 'weekly', 66, { rank: 400, total: 700, avgScore: 65, paper: { label: '중1', range: '정수' } }));   /* 리포트에만 있는 옛 회차 */
    list.push(R('2026.11.03', 'class', 63, { acadAvg: 60, bookname: '삼각형의 성질 p.8' }));
    list.push(R('2026.11.05', 'class', 47, { acadAvg: 52 }));
    list.push(R('2026.11.06', 'class', 66, { acadAvg: 58 }));
    list.push(R('2026.11.10', 'class', 70, { acadAvg: 49 }));
    schoolScores = { A: [
      { id: 'x1', year: 2026, semester: { grade: 2, term: 1 }, examType: '기말', subjects: [{ name: '수학', score: 79, grade: 3, rank: '62/268', average: 68 }] },
      { id: 'x2', year: 2026, semester: { grade: 2, term: 2 }, examType: '중간', subjects: [{ name: '수학', score: 84, grade: 2, rank: '45/270', average: 70 }, { name: '국어', score: 86 }, { name: '영어', score: 90, grade: 1 }] } ] };
    SO.loaded = false; SO.busy = false; SO.t = 0;
    VIEW = 'scoreov'; render();
  });
  await pg.waitForTimeout(500);
  const rowTxt = (i) => P((i) => { const r = document.querySelectorAll('.so-row')[i]; return r ? r.innerText.replace(/\s+/g, ' ') : ''; }, i);

  /* ① */
  t('① 메뉴에 «📈 성적 한눈에»', await P(() => document.documentElement.outerHTML.includes("label:'성적 한눈에'")), '');
  const n = await P(() => document.querySelectorAll('.so-row').length);
  const r0 = await rowTxt(0);
  t('① 학생 2줄 · A줄: 70점 · 378/823명 · 3등급', n === 2 && /70점/.test(r0) && /378\/823명/.test(r0) && /3등급/.test(r0), r0);
  const sp = await P(() => Array.from(document.querySelectorAll('.so-row')[0].querySelectorAll('.so-spark i')).map((i) => i.style.background));
  t('① 미니 막대 최근 6회 · 마지막 3등급 노랑 · 앞에 2등급 파랑', sp.length === 6 && /180, 83, 9|#b45309/.test(sp[5]) && sp.some((c) => /29, 111, 232|#1d6fe8/.test(c)), JSON.stringify(sp));
  t('① 학교: 84점 · 2등급 · ↑5 · 석차 45/270', /84점 · 2등급 ↑5/.test(r0) && /석차 45\/270/.test(r0), r0);
  t('① 일일: 3/4 학원 평균 이상', /3\/4 학원 평균 이상/.test(r0), r0);
  const r1 = await rowTxt(1);
  t('① B줄: 97점 · 20/908명 · 1등급 · 학교 «입력 없음»', /97점/.test(r1) && /20\/908명/.test(r1) && /1등급/.test(r1) && /입력 없음/.test(r1), r1);

  /* ② */
  await P(() => soSetSort('rank')); t('② 전국 위치 정렬 → B(상위 2%) 먼저', /○○○B/.test(await rowTxt(0)), await rowTxt(0));
  await P(() => soSetSort('name')); await P(() => soSetG('중1'));
  t('② 학년 «중1» → B 한 줄', (await P(() => document.querySelectorAll('.so-row').length)) === 1 && /○○○B/.test(await rowTxt(0)), '');
  await P(() => { soSetG('all'); soPick('A'); });

  /* ③ */
  const rows = await P(() => Array.from(document.querySelectorAll('.so-tbl tbody tr')).map((tr) => tr.innerText.replace(/\s+/g, ' ')));
  t('③ 회차 표 8줄(주간 6 + 고등 주간 1 + 옛 리포트 1) · 단원 테스트 빠짐', rows.length === 8 && !rows.some((x) => /단원 테스트/.test(x)), JSON.stringify(rows));
  t('③ 맨 위 고등 주간 → «고등 자체» · 시험지 제목 그대로', /주간 특강 테스트/.test(rows[0]) && /고등 자체/.test(rows[0]), rows[0]);
  t('③ 9/30 전국 등수 비었던 것 → 리포트로 247/822명', rows.some((x) => /^9\/30/.test(x) && /247\/822명/.test(x)), JSON.stringify(rows));
  t('③ 리포트에만 있는 6/10 옛 회차도 · 400/700명', rows.some((x) => /^6\/10/.test(x) && /400\/700명/.test(x)), JSON.stringify(rows.slice(-2)));
  const right = await P(() => { const s = document.querySelectorAll('.so-wrap > div')[1]; return { svg: s.querySelectorAll('svg').length, txt: s.innerText.replace(/\s+/g, ' ') }; });
  t('③ 그래프 2개(주간 · 일일) · 상위 46% · 전국 평균 68점 · 지난번보다 -10', right.svg === 2 && /상위 46%/.test(right.txt) && /전국 평균 68점/.test(right.txt), right.txt.slice(0, 200));
  t('③ 학교 시험 학기 2개(최근 위) · ＋ 다른 과목 2', /2026 2학년 2학기 중간[\s\S]*2026 2학년 1학기 기말/.test(right.txt) && /＋ 다른 과목 2/.test(right.txt), right.txt.slice(200, 600));
  await P(() => document.querySelector('.so-more').click()); await pg.waitForTimeout(100);
  t('③ ＋ 다른 과목 → 국어 86 · 영어 90 1등급', await P(() => /86\s*국어/.test(document.body.innerText) && /90\s*영어 · 1등급/.test(document.body.innerText)), '');
  t('③ 일일: 4회 중 3회 학원 평균 이상', /최근 4회 중 3회 학원 평균 이상/.test(await P(() => document.body.innerText.replace(/\s+/g, ' '))), '');

  if (process.env.SHOT) { await P(() => { window.scrollTo(0, 0); }); await pg.screenshot({ path: process.env.SHOT, fullPage: false }); }
  /* ④ */
  await P(() => soOpenProfile('B')); await pg.waitForTimeout(300);
  const pb = await P(() => ({ view: VIEW, tab: STUDENT_TAB, sel: SELECTED_STUDENT, txt: document.body.innerText.replace(/\s+/g, ' ') }));
  t('④ 리포트 없는 B도 프로필 열림 · «📈 성적» 탭 · 전국주간 97점', pb.view === 'student_detail' && pb.tab === '성적' && /97점/.test(pb.txt) && /20\/908명/.test(pb.txt) && /학생 프로필/.test(pb.txt), JSON.stringify({ v: pb.view, t: pb.tab, s: pb.sel }));
  t('④ 프로필 탭 줄에 «성적»', await P(() => !!document.querySelector('[data-stab="성적"]')), '');
  await P(() => { selectStudent('○○○A', '중학교 2학년'); STUDENT_TAB = '현황'; render(); });
  t('④ 리포트 있는 A는 «현황» 그대로 열림', (await P(() => VIEW === 'student_detail' && STUDENT_TAB === '현황')), '');

  /* ⑤ */
  t('⑤ 서버 쓰기 없음', (await P(() => __W.length)) === 0, '');
  t('⑤ APP_VER v19-187', (await P(() => APP_VER)) === 'v19-187', '');
  t('⑤ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
