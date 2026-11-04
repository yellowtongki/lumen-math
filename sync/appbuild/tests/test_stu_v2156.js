/* 학생앱 v2-156 검사 — «(가)» 꼴 답 채점 (원장 2026-11-04 「2차 채점이 안 된다」)
 * 실행: node sync/appbuild/tests/test_stu_v2156.js student_v2-156.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-156.html');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/^https?:\/\//, (r) => r.abort());
  await p.goto('file://' + FILE); await p.waitForTimeout(800);
  const C = [
    ['(다),(마),(가),(나),(라),(바)', '다, 마, 가, 나, 라, 바', true],
    ['(다),(마),(가),(나),(라),(바)', '다마가나라바', true],
    ['(다),(마),(가),(나),(라),(바)', '바, 라, 나, 가, 마, 다', false],
    ['(라),(가)', '라,가', true], ['(라),(가)', '라 가', true], ['(라),(가)', '㈑,㈎', true],
    ['(라),(가)', '가, 라', false], ['(라),(가)', '30,4', false],
    ['(가)', '가', true], ['3,4', '34', false], ['ㄹ,ㅁ', 'ㄹㅁ,', true],
  ];
  const out = await p.evaluate((C) => C.map(([c, s]) => !!(window.HWGrade && HWGrade.grade(c, s).correct)), C);
  let ok = 0; C.forEach(([c, s, want], i) => { const g = out[i] === want; if (g) ok++; console.log((g ? '✅' : '❌') + ' «' + c + '» ← «' + s + '» ' + (out[i] ? 'O' : 'X')); });
  const ver = await p.evaluate(() => window.STU_VER); const vOk = ver === 'v2-156'; console.log((vOk ? '✅' : '❌') + ' 버전 ' + ver);
  console.log((errs.length ? '❌' : '✅') + ' 페이지 오류 ' + errs.length + (errs[0] ? ' ' + errs[0] : ''));
  const n = C.length + 2, pass = ok + (vOk ? 1 : 0) + (errs.length ? 0 : 1);
  console.log(`\n${pass}/${n}` + (pass === n ? ' ✅' : ' ❌')); await b.close(); process.exit(pass === n ? 0 : 1);
})();
