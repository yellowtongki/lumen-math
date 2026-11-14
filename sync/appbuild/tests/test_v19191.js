#!/usr/bin/env node
/* 학원앱 v19-191 검사 — 📖 기출 해설집 학교 › 연도 아코디언
 *   외부망 차단 · HS.cat 을 docs/exam_reports 의 해설집 머리 정보로 채움(학생 정보 없음)
 *   ① 학교 묶음 수 · 중학교가 위 ② 처음엔 모두 접힘 ③ 학교 펼치면 최근 연도만 열림 · 접힌 연도 요약 줄
 *   ④ 연도 순서(최근 위) · 범위맞춤 묶음은 맨 아래 ⑤ 연도 안 학년 → 기말·중간 ⑥ 학년 칩 → 그 학년만 · 펼친 채
 *   ⑦ 모두 펼치기/접기 ⑧ 펼친 상태 기억 ⑨ 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19191.js lumen_v19-191.html [그림.png] */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-191.html'), SHOT = process.argv[3] || '';
const DIR = path.join(__dirname, '..', '..', '..', 'docs', 'exam_reports');
const cat = [];
fs.readdirSync(DIR).forEach((d) => {
  const f = path.join(DIR, d, '해설집.html'); if (!fs.existsSync(f)) return;
  const h = fs.readFileSync(f, 'utf8'); const m = (n) => ((h.match(new RegExp('<meta name="haesol-' + n + '" content="([^"]*)"')) || [])[1] || '');
  cat.push({ code: m('code') || d, title: m('title'), school: m('school'), grade: m('grade'), term: m('term'), subject: m('subject'), n: Number(m('count')) || 20, qs: [], addedAt: '2026-11-0' + (cat.length % 9 + 1) });
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
    years: Array.from(s.querySelectorAll('.hs191-year')).map((y) => ({ h: y.querySelector('.hs191-yh').innerText.replace(/\s+/g, ' ').trim(), cards: Array.from(y.querySelectorAll('.hs191-card')).map((c) => c.innerText.replace(/\s+/g, ' ').trim()) })) })));
  let S = await st();
  const schools = [...new Set(cat.map((c) => c.school))];
  t('① 학교 묶음 ' + schools.length + '개 · 중학교가 위', S.length === schools.length && /중학교/.test(S[0].name) && /고등학교|고 /.test(S[S.length - 1].name + ' '), S.map((x) => x.name).join(' / '));
  t('② 처음엔 모두 접힘(연도 칸 없음)', S.every((x) => x.years.length === 0), '');
  await P(() => { const s = Array.from(document.querySelectorAll('.hs191-sh')).find((x) => /소사고등학교/.test(x.innerText)); s.click(); });
  await pg.waitForTimeout(200); S = await st();
  const so = S.find((x) => /소사고등학교/.test(x.name));
  t('③ 소사고 펼침 → 연도 4칸 · 2026만 열림 · 접힌 연도 요약', so && so.years.length === 4 && /2026학년도/.test(so.years[0].h) && so.years[0].cards.length === 2 && so.years.slice(1).every((y) => y.cards.length === 0) && /고1 2학기 기말 · 고1 2학기 중간/.test(so.years[1].h), JSON.stringify(so && so.years.map((y) => y.h)));
  t('④ 연도 순서 2026 › 2025 › 2024 › 2023', so && so.years.map((y) => (y.h.match(/20\d\d/) || [''])[0]).join(',') === '2026,2025,2024,2023', '');
  t('⑤ 2026 안: 고1 먼저, 고2 다음', so && /^고1/.test(so.years[0].cards[0]) && /^고2/.test(so.years[0].cards[1]), JSON.stringify(so && so.years[0].cards));
  await P(() => { const s = Array.from(document.querySelectorAll('.hs191-sh')).find((x) => /옥길중학교/.test(x.innerText)); s.click(); });
  await pg.waitForTimeout(200); S = await st();
  const ok = S.find((x) => /옥길중학교/.test(x.name));
  t('④ 옥길중 범위맞춤 묶음은 맨 아래', ok && /범위맞춤 대비 묶음/.test(ok.years[ok.years.length - 1].h) && /2026학년도/.test(ok.years[0].h), JSON.stringify(ok && ok.years.map((y) => y.h)));
  await P(() => { const y = Array.from(document.querySelectorAll('.hs191-yh')).find((x) => /2025학년도/.test(x.innerText) && /중2|중3/.test(x.innerText) && x.closest('.hs191-school').innerText.indexOf('옥길중학교') >= 0); y.click(); });
  await pg.waitForTimeout(200); S = await st();
  const ok25 = S.find((x) => /옥길중학교/.test(x.name)).years.find((y) => /2025/.test(y.h));
  t('⑤ 옥길중 2025: 중2 → 중3 기말 → 중3 중간', ok25 && ok25.cards.length === 3 && /^중2/.test(ok25.cards[0]) && /^중3 2학기 기말/.test(ok25.cards[1]) && /^중3 2학기 중간/.test(ok25.cards[2]), JSON.stringify(ok25));
  const saved = await P(() => localStorage.getItem('hs_acc191'));
  await P(() => { HS191.open = null; render(); }); S = await st();
  t('⑧ 펼친 상태 기억(다시 그려도 소사고·옥길중 열림)', /소사고등학교/.test(saved) && S.filter((x) => x.years.length).length === 2, saved);
  await P(() => hsGradeSet('고2')); await pg.waitForTimeout(200); S = await st();
  t('⑥ 학년 칩 «고2» → 고2 있는 학교만 · 펼친 채 · 카드는 고2만', S.length === 2 && S.every((x) => x.years.length && x.years.every((y) => y.cards.every((c) => /^고2/.test(c)))), JSON.stringify(S.map((x) => x.name)));
  await P(() => hsGradeSet('전체'));
  await P(() => hs191All(true)); S = await st();
  const nCards = S.reduce((a, x) => a + x.years.reduce((b, y) => b + y.cards.length, 0), 0);
  t('⑦ 모두 펼치기 → 카드 ' + cat.length + '장 전부', nCards === cat.length, String(nCards));
  if (SHOT) { await P(() => { hs191All(false); hs191Tog('s:소사고등학교', false); hs191Tog('s:옥길중학교', false); window.scrollTo(0, 0); }); await pg.waitForTimeout(200);
    const el = await pg.$('#content') || null; await pg.screenshot({ path: SHOT, fullPage: true }); }
  await P(() => hs191All(false)); S = await st();
  t('⑦ 모두 접기', S.every((x) => x.years.length === 0), '');
  t('⑨ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
