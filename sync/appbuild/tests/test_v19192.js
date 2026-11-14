#!/usr/bin/env node
/* 학원앱 v19-192 검사 — 📖 기출 해설집 학교 › 학년 › 연도 (시안 A)
 *   외부망 차단 · HS.cat 을 docs/exam_reports 해설집 머리 정보로 채움(학생 정보 없음)
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19192.js lumen_v19-192.html [그림.png] */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-192.html'), SHOT = process.argv[3] || '';
const DIR = path.join(__dirname, '..', '..', '..', 'docs', 'exam_reports');
const cat = [];
fs.readdirSync(DIR).forEach((d) => {
  const f = path.join(DIR, d, '해설집.html'); if (!fs.existsSync(f)) return;
  const h = fs.readFileSync(f, 'utf8'); const m = (n) => ((h.match(new RegExp('<meta name="haesol-' + n + '" content="([^"]*)"')) || [])[1] || '');
  cat.push({ code: m('code') || d, title: m('title'), school: m('school'), grade: m('grade'), term: m('term'), subject: m('subject'), n: Number(m('count')) || 20, qs: [], addedAt: '2026-11-01' });
});
let pass = 0, fail = 0;
const t = (n, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (info || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1100 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const P = (fn, a) => pg.evaluate(fn, a);
  await P((c) => { const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    try { localStorage.removeItem('hs_acc191'); } catch (e) {} HS191.open = null;
    HS.cat = { items: c }; HS.loaded = true; HS.code = null; HS.gfilter = '전체'; VIEW = 'haesol'; render(); }, cat);
  await pg.waitForTimeout(300);
  const st = () => P(() => Array.from(document.querySelectorAll('.hs191-school')).map((s) => ({
    name: s.querySelector('.hs191-sh').innerText.replace(/\s+/g, ' ').trim(),
    grades: Array.from(s.querySelectorAll('.hs192-grade')).map((g) => ({ h: g.querySelector('.hs192-gh').innerText.replace(/\s+/g, ' ').trim(),
      years: Array.from(g.querySelectorAll('.hs192-year')).map((y) => ({ y: y.querySelector('.hs192-ylab').innerText.replace(/\s+/g, ' ').trim(), rows: Array.from(y.querySelectorAll('.hs192-row')).map((r) => r.innerText.replace(/\s+/g, ' ').trim()) })) })) })));
  const clickS = (n) => P((n) => Array.from(document.querySelectorAll('.hs191-sh')).find((x) => x.innerText.indexOf(n) >= 0).click(), n);
  let S = await st();
  t('① 학교 묶음 · 중학교가 위 · 학교 칸에 학년별 권수', S.length >= 8 && /중학교/.test(S[0].name) && /중3 \d/.test(S.find((x) => /범박중학교/.test(x.name)).name), S.map((x) => x.name).join(' / '));
  t('② 처음엔 모두 접힘', S.every((x) => !x.grades.length), '');
  await clickS('소사고등학교'); S = await st();
  const so = S.find((x) => /소사고등학교/.test(x.name));
  t('③ 소사고 펼침 → 학년 칸 고1·고2 (펼친 채)', so && so.grades.length === 2 && /^▶ 고1/.test(so.grades[0].h) && /고2/.test(so.grades[1].h) && so.grades.every((g) => g.years.length), JSON.stringify(so && so.grades.map((g) => g.h)));
  const g1 = so.grades[0];
  t('④ 고1 연도 제목 2026 › 2025 › 2024 › 2023', g1.years.map((y) => (y.y.match(/20\d\d/) || [''])[0]).join(',') === '2026,2025,2024,2023', JSON.stringify(g1.years.map((y) => y.y)));
  const y25 = g1.years.find((y) => /2025/.test(y.y));
  t('⑤ 같은 해 안 기말 → 중간', y25 && y25.rows.length === 2 && /^2학기 기말/.test(y25.rows[0]) && /^2학기 중간/.test(y25.rows[1]), JSON.stringify(y25));
  await P(() => Array.from(document.querySelectorAll('.hs192-gh')).find((x) => /고1/.test(x.innerText) && x.closest('.hs191-school').innerText.indexOf('소사고등학교') >= 0).click()); S = await st();
  const so2 = S.find((x) => /소사고등학교/.test(x.name));
  t('⑥ 학년 칸 접기(고1 접힘 · 고2 그대로)', so2.grades[0].years.length === 0 && so2.grades[1].years.length > 0, JSON.stringify(so2.grades.map((g) => g.years.length)));
  await clickS('옥길중학교'); S = await st();
  const ok3 = S.find((x) => /옥길중학교/.test(x.name)).grades.find((g) => /중3/.test(g.h));
  t('⑦ 옥길중 중3 — 범위맞춤 대비는 맨 아래', ok3 && /대비/.test(ok3.years[ok3.years.length - 1].y) && /2026|2025/.test(ok3.years[0].y), JSON.stringify(ok3 && ok3.years.map((y) => y.y)));
  const saved = await P(() => localStorage.getItem('hs_acc191'));
  await P(() => { HS191.open = null; render(); }); S = await st();
  t('⑧ 펼친 상태 기억(소사고 고1 접힘 · 옥길중 열림)', /소사고등학교\|고1":false/.test(saved) && S.find((x) => /옥길중학교/.test(x.name)).grades.length > 0, saved);
  await P(() => hsGradeSet('고2')); S = await st();
  t('⑨ 학년 칩 «고2» → 고2 칸만 · 펼침', S.length === 2 && S.every((x) => x.grades.length === 1 && /고2/.test(x.grades[0].h)), JSON.stringify(S.map((x) => x.name)));
  await P(() => hsGradeSet('전체')); await P(() => hs191All(true)); S = await st();
  const nRows = S.reduce((a, x) => a + x.grades.reduce((b, g) => b + g.years.reduce((c, y) => c + y.rows.length, 0), 0), 0);
  t('⑩ 모두 펼치기 → ' + cat.length + '권 전부', nRows === cat.length, String(nRows));
  if (SHOT) { await P(() => { hs191All(false); hs191Tog('s:범박중학교', false); window.scrollTo(0, 0); }); await pg.waitForTimeout(200); await pg.screenshot({ path: SHOT }); }
  await P(() => hs191All(false)); S = await st();
  t('⑩ 모두 접기', S.every((x) => !x.grades.length), '');
  await P(() => hsOpen && 1); t('⑪ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
