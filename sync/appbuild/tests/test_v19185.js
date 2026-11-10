#!/usr/bin/env node
/* 학원앱 v19-185 검사 — 플래너 AI 분석 «참고 날짜» 새벽 3시 규칙 (서버 plExpectedDate 와 같은 답인지)
 *   학원앱 파일에서 참고 날짜를 만드는 줄을 그대로 꺼내 돌린다(브라우저 없이) · 실행: node sync/appbuild/tests/test_v19185.js lumen_v19-185.html */
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-185.html');
const src = fs.readFileSync(FILE, 'utf8');
const i = src.indexOf("    // 제출 시간에서 기대 날짜 추출 (날짜 교차 검증용)"), j = src.indexOf('} catch(e) {}', i);
const body = src.slice(i, j + 13);
const f = new Function('setId', body + '\nreturn expectedDate;');
const { plExpectedDate } = require(path.resolve(__dirname, '..', '..', 'planner_night_grader.js'));
let pass = 0, fail = 0;
['20261105_0000', '20261105_0259', '20261105_0300', '20261104_2356', '20261101_0130', '20260101_0010', '20260301_0200', '20261105'].forEach((id) => {
  const a = f(id), b = plExpectedDate(id), ok = a === b;
  ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + id + ' → 학원앱 ' + a + ' · 서버 ' + b);
});
const v = /var APP_VER = 'v19-185'/.test(src); v ? pass++ : fail++; console.log((v ? '✅' : '❌') + ' APP_VER v19-185');
console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
