#!/usr/bin/env node
/* 학원앱 v19-183 검사 — 💡 아하노트 학생 «수업 중 해결» 체크 배지 (외부망 차단 · 실서버 쓰기 없음)
 *   ① 학생 체크(reason class · by student) → 「🏫 수업 중 해결 · 학생 체크」 + 시각 툴팁 ② 원장 정리 class → 예전 「🏫 수업에서 다룸」
 *   ③ answered → 예전 「💬 답변함」 ④ 미해결이면 배지 없음 ⑤ 작은 배지 크기 ⑥ 버전 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19183.js lumen_v19-183.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-183.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const R = await pg.evaluate(() => {
    const at = '2026-11-10T06:05:00.000Z';
    const N = (st, o) => ({ id: 'x', status: st, resolved_at: at, resolved_note: o ? JSON.stringify(o) : null });
    const txt = (h) => { const d = document.createElement('div'); d.innerHTML = h; return { t: d.textContent, title: (d.firstChild && d.firstChild.title) || '', fs: (d.firstChild && d.firstChild.style.fontSize) || '' }; };
    return {
      stu: txt(ahaReasonBadge(N('resolved', { reason: 'class', by: 'student', at, student: 'class', student_at: at }))),
      stuS: txt(ahaReasonBadge(N('resolved', { reason: 'class', by: 'student', at }), true)),
      tch: txt(ahaReasonBadge(N('resolved', { reason: 'class', by: 'teacher', at }))),
      ans: txt(ahaReasonBadge(N('resolved', { reason: 'answered', by: 'teacher', at }))),
      pend: ahaReasonBadge(N('pending', { reason: 'class', by: 'student', at })),
      none: ahaReasonBadge(N('resolved', null)),
      ver: APP_VER
    };
  });
  t('① 학생 체크 → 「🏫 수업 중 해결 · 학생 체크」 · 툴팁에 시각', R.stu.t === '🏫 수업 중 해결 · 학생 체크' && /수업 중 해결/.test(R.stu.title) && /11\/10/.test(R.stu.title), JSON.stringify(R.stu));
  t('② 원장이 정리한 class → 예전 「🏫 수업에서 다룸」', R.tch.t === '🏫 수업에서 다룸', JSON.stringify(R.tch));
  t('③ answered → 「💬 답변함」', R.ans.t === '💬 답변함', JSON.stringify(R.ans));
  t('④ 미해결·이유 없음 → 배지 없음', R.pend === '' && R.none === '', JSON.stringify([R.pend, R.none]));
  t('⑤ 작은 배지(9.5px)', R.stuS.fs === '9.5px', R.stuS.fs);
  t('⑥ APP_VER v19-183', R.ver === 'v19-183', R.ver);
  t('⑥ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
