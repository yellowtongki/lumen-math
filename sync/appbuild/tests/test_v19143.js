#!/usr/bin/env node
/* 학원앱 v19-143 검사 — 홈 위 «퇴원 → 재원» 알림 문구 (원장 2026-10-20 「퇴원생 오류」)
 *   가짜 학생(○○○) · 외부망 차단 · 켜기 전에 이 기기 기록(localStorage)을 심는다
 *   ① 복귀만: 주황 띠 · «퇴원했던 학생이 재원으로 바뀌었습니다» · «(복귀)» · «로그인 코드가 바뀌었습니다» 없음 · × 로 닫으면 위 여백 0
 *   ② 다시 켜면 띠 없음(한 번만)
 *   ③ 코드가 바뀐 학생 + 복귀: 빨간 띠 · 두 문장 모두
 *   실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19143.js lumen_v19-143.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-143.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STU = [
  { id: 'S1', name: '○○○1', grade: '초등학교 5학년', group: 'T3', lumen_rec_code: 'AAA111', withdrawn: false },
  { id: 'S2', name: '○○○2', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'BBB222' }];
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1366, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  const boot = async (seed) => {
    await pg.goto('file://' + FILE + '#x', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pg.evaluate((seed) => { localStorage.clear(); Object.keys(seed).forEach((k) => localStorage.setItem(k, JSON.stringify(seed[k]))); }, seed);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => !!document.getElementById('lm-code-warn'), null, { timeout: 15000 }).catch(() => {});
    return pg.evaluate(() => { const d = document.getElementById('lm-code-warn'); return d ? { txt: d.innerText, bg: d.style.background, pad: document.body.style.paddingTop } : null; });
  };
  t('버전', (await (async () => { await pg.goto('file://' + FILE); return pg.evaluate(() => APP_VER); })()) === (FILE.match(/v19-\d+/) || [''])[0]);
  /* ① 복귀만 */
  const fp = { '○○○1': 'AAA111', '○○○2': 'BBB222' };
  let b = await boot({ or_studentdb: STU, lumen_rec_code_fingerprint: fp, lumen_withdrawn_names: { '○○○1': 1 } });
  t('① 복귀만 → 띠 나옴', !!b, JSON.stringify(b));
  t('① 주황 · «퇴원했던 학생이 재원으로» · (복귀) · 코드 문장 없음', b && /217, 119, 6|d97706/.test(b.bg) && /퇴원했던 학생이 재원으로 바뀌었습니다/.test(b.txt) && /○○○1: 퇴원 → 재원 \(복귀\)/.test(b.txt) && !/로그인 코드가 바뀌었습니다/.test(b.txt), JSON.stringify(b));
  await pg.evaluate(() => document.querySelector('#lm-code-warn button').click()); await pg.waitForTimeout(100);
  t('① × → 닫히고 위 여백 0', await pg.evaluate(() => !document.getElementById('lm-code-warn') && !document.body.style.paddingTop));
  /* ② 다시 켜면 없음 */
  await pg.reload({ waitUntil: 'load' }); await pg.waitForTimeout(12000);
  t('② 다시 켜면 띠 없음(한 번만)', await pg.evaluate(() => !document.getElementById('lm-code-warn')));
  /* ③ 코드 바뀜 + 복귀 */
  b = await boot({ or_studentdb: STU, lumen_rec_code_fingerprint: { '○○○1': 'AAA111', '○○○2': 'ZZZ999' }, lumen_withdrawn_names: { '○○○1': 1 } });
  t('③ 코드 바뀜 + 복귀 → 빨간 띠 · 두 문장', b && /220, 38, 38|dc2626/.test(b.bg) && /로그인 코드가 바뀌었습니다/.test(b.txt) && /○○○2: ZZZ999 → BBB222/.test(b.txt) && /퇴원했던 학생이 재원으로/.test(b.txt), JSON.stringify(b));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
