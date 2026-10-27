#!/usr/bin/env node
/* 학원앱 v19-163 검사 — 📛 플래너 거짓 제출 확인 (가짜 학생 홍길동·박하나 · 날짜는 오늘 기준)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19163.js lumen_v19-163.html [스크린샷.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-163.html');
const SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1100 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-163');
  const SET = () => pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const D = (n) => pfAddD(pfToday(), -n), sid = (n, hm) => D(n).replace(/-/g, '') + '_' + hm, dot = (n) => D(n).replace(/-/g, '.');
    const IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%23fffdf8"/><text x="20" y="40" font-size="20">PLANNER</text></svg>';
    const tasks = ['[O] 수학숙제 (RPM 30문제)', '[O] 영어 단어 3과'];
    window.__STU = [
      { id: 's1', name: '홍길동', group: 'M3', grade: '초등학교 6학년', lumen_rec_code: 'C1', lumen_planner_photos: [
        { setId: sid(18, '2300'), urls: [IMG, IMG], reviewed: true, analysis: { date: dot(18), tasksTranscript: tasks, totalTime: '3시간' } },
        { setId: sid(9, '2350'), urls: [IMG, IMG], reviewed: true, analysis: { date: dot(18), tasksTranscript: tasks.concat(['[O] 새 할 일']), totalTime: '3시간', zeroDay: true, zeroReason: 'sameDate', zeroDup: { day: D(18), setId: sid(18, '2300'), sim: 92, hd: 3 }, zeroBak: { s: '3', p: '3', sp: '2', f: '1' }, studyScore: '0' } },
        { setId: sid(45, '2300'), urls: [IMG], analysis: { date: dot(45), zeroDay: true, zeroReason: 'dup', zeroDup: { day: D(50) } } } ] },
      { id: 's2', name: '박하나', group: 'T5', grade: '중학교 2학년', lumen_rec_code: 'C2', lumen_planner_photos: [
        { setId: sid(4, '2200'), urls: [IMG], analysis: { date: '', zeroDay: true, zeroReason: 'noDate' } } ] } ];
    students.length = 0; window.__STU.forEach((s) => students.push(s));
  });
  await SET();
  const c = await pg.evaluate(() => pfCases().map((x) => [x.st.name, x.r, x.lie, x.ok]));
  t('최근 30일 사건만 (45일 전 것 빠짐) · 거짓/날짜 문제 나눔', c.length === 2 && c.some((x) => x[0] === '홍길동' && x[1] === 'sameDate' && x[2]) && c.some((x) => x[0] === '박하나' && x[1] === 'noDate' && !x[2]), JSON.stringify(c));
  t('플래너 왼쪽 메뉴 «📛 거짓 제출 (1)»', await pg.evaluate(() => { VIEW = 'planner'; PLANNER_VIEW = 'input'; return /거짓 제출 \(1\)/.test(rPlannerLeftNav()); }));
  await SET(); await pg.evaluate(() => pfOpen('s1')); await pg.waitForTimeout(400);
  let tx = await pg.evaluate(() => document.body.innerText);
  t('pfOpen → 플래너 «거짓 제출» 화면 · 홍길동 카드가 열림', await pg.evaluate(() => VIEW === 'planner' && PLANNER_VIEW === 'fake' && PF.stu === 's1') && /📛 플래너 거짓 제출/.test(tx) && /이번에 낸 것/.test(tx) && /먼저 낸 것/.test(tx), tx.slice(0, 300));
  t('사진 나란히(이번 2장 + 그때 2장) · 글 92% · 지문 차이 3 · 겹친 줄 빨강', await pg.evaluate(() => document.querySelectorAll('img[alt="이번 제출"]').length === 2 && document.querySelectorAll('img[alt="먼저 낸 것"]').length === 2 && document.querySelectorAll('mark').length >= 3) && /92%/.test(tx) && /사진 지문 차이\s*3/.test(tx));
  if (SHOT) { await pg.screenshot({ path: SHOT }); }
  await SET(); await pg.evaluate(() => { const st = students[0]; pfConfirm('s1', st.lumen_planner_photos[1].setId); }); await pg.waitForTimeout(200);
  t('⛔ 0점 확정 → zeroOk 날짜 · 확인 전 0 · 메뉴 숫자 사라짐', await pg.evaluate(() => !!students[0].lumen_planner_photos[1].analysis.zeroOk && pfCount() === 0 && !/거짓 제출 \(/.test(rPlannerLeftNav())));
  await pg.evaluate(() => { PF.stu = ''; PF.filter = 'todo'; render(); }); tx = await pg.evaluate(() => document.body.innerText);
  t('«확인 전» 거르기: 박하나(날짜 문제)만 남음', /박하나 · /.test(tx) && !/홍길동 · \d+\/\d+ 제출/.test(tx), tx.slice(0, 200));
  await pg.evaluate(() => pfSet('filter', 'all')); tx = await pg.evaluate(() => document.body.innerText);
  t('«전체»: 확정된 카드 «⛔ 0점 확정»으로 보임', /0점 확정 \d+\/\d+/.test(tx));
  await SET(); await pg.evaluate(() => { const st = students[0]; plzClear('s1', st.lumen_planner_photos[1].setId); });
  t('↩ 되살리기(plzClear) → 목록에서 빠지고 점수 원래대로', await pg.evaluate(() => pfCases().length === 1 && students[0].lumen_planner_photos[1].analysis.studyScore === '3'));
  await SET();
  t('승인 카드 «⛔ 그날 0점» 띠에 «📛 사진 나란히 확인 ›»', await pg.evaluate(() => { const p = students[0].lumen_planner_photos[1]; return /📛 사진 나란히 확인/.test(plzCardHtml(p.analysis, 's1', p.setId)); }));
  await pg.evaluate(() => { VIEW = 'home'; AL._last = [{ k: 'plzlie', st: students[0] }]; alGo(0); });
  t('🔔 알림 «거짓 제출» → 그 학생 거짓 제출 화면', await pg.evaluate(() => VIEW === 'planner' && PLANNER_VIEW === 'fake' && PF.stu === 's1'));
  await pg.evaluate(() => { VIEW = 'risk'; riskGo('planner', 's2'); });
  t('🚨 위험 신호 줄 → 그 학생 거짓 제출 화면 · 다른 줄은 예전처럼', await pg.evaluate(() => { const a = VIEW === 'planner' && PLANNER_VIEW === 'fake' && PF.stu === 's2'; riskGo('hwcheck', 's2'); return a && VIEW === 'hwcheck'; }));
  t('위험 신호 화면 줄이 학생 id 를 넘김', await pg.evaluate(() => { try { return /riskGo\('planner','s1'\)|riskGo\('[a-z]+','s\d'\)/.test(rRisk()); } catch (e) { return 'err ' + e.message; } }) === true);
  const msg = await pg.evaluate(async () => { let got = ''; const o = navigator.clipboard; try { Object.defineProperty(navigator, 'clipboard', { value: { writeText: (s) => { got = s; return Promise.resolve(); } }, configurable: true }); } catch (e) {} pfCopy('s1', students[0].lumen_planner_photos[1].setId); await new Promise((r) => setTimeout(r, 50)); return got; });
  t('💬 학생에게 보낼 말', /홍길동, \d+\/\d+에 낸 플래너 날짜가 \d+\/\d+에 이미 낸 날짜와 같아/.test(msg), msg);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
