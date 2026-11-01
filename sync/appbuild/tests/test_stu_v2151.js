#!/usr/bin/env node
/* 학생앱 v2-151 검사 — 홈 맨 아래 카드가 아래 탭 줄에 가리지 않는다 (원장 2026-11-01 학생 아이폰 캡처 「밑에 채점이 짤린다」)
 *   폰 높이 2가지 × 글씨 크기 3가지(보통·크게·아주 크게)에서 홈을 끝까지 내려 마지막 카드 아래 끝 ≤ 탭 줄 위 끝.
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2151.js student_v2-151.html */
const { chromium } = require('playwright'); const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-151.html'); const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0; const t = (n, ok, i) => { ok ? pass++ : fail++; console.log((ok ? '✅ ' : '❌ ') + n + (ok ? '' : '  ← ' + (i || ''))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const H of [664, 844]) {
    const pg = await (await br.newContext({ viewport: { width: 390, height: H }, deviceScaleFactor: 2 })).newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
    await pg.route(/^https?:\/\//, (r) => r.abort());
    await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
    const r = await pg.evaluate(async () => {
      studentInfo = { name: '테스트', grade: '중1', lumen_rec_mission: '', lumen_rec_code: 'TEST' }; isTest = true; renderHome(); go('screen-home');
      await new Promise((r) => setTimeout(r, 600));
      /* 실제 학생 홈처럼 길게 — 카드 6장을 더 붙인다 */
      const body = document.querySelector('#screen-home .h3-body');
      for (let i = 0; i < 6; i++) { const d = document.createElement('div'); d.className = 'x-test-card'; d.style.cssText = 'height:120px;background:#dbeafe;border-radius:14px'; d.textContent = '카드 ' + (i + 1); body.appendChild(d); }
      const out = [];
      for (const k of FZ_STEPS.map((x) => x.k)) {
        fzSet(k); await new Promise((r) => setTimeout(r, 200));
        body.scrollTop = 1e6; await new Promise((r) => setTimeout(r, 80));
        const last = [...body.children].filter((c) => c.offsetHeight > 0).pop();
        const gap = Math.round(document.getElementById('btabs').getBoundingClientRect().top - last.getBoundingClientRect().bottom);
        out.push({ k, gap, on: document.documentElement.classList.contains('btabh-on'), btabh: getComputedStyle(document.documentElement).getPropertyValue('--btabh'), scrhd: getComputedStyle(document.documentElement).getPropertyValue('--scrhd') });
      }
      out.ver = STU_VER; out.dvhRule = [...document.styleSheets].some((ss) => { try { return [...ss.cssRules].some((r) => r.conditionText && /100dvh/.test(r.conditionText)); } catch (e) { return false; } });
      return { out, ver: STU_VER, dvhRule: out.dvhRule };
    });
    if (H === 664) { t('버전 v2-151', r.ver === 'v2-151', r.ver); t('dvh 규칙(@supports) 들어 있음', r.dvhRule); }
    r.out.forEach((x) => t(`폰 높이 ${H} · 글씨 ${x.k} — 마지막 카드가 탭 줄 위로 다 보임 (틈 ${x.gap}px)`, x.on && x.gap >= 8, JSON.stringify(x)));
    await pg.evaluate(() => fzSet('m')); await pg.waitForTimeout(200);
    await pg.screenshot({ path: path.join(SP, `stu_v2151_home_${H}.png`) });
    t(`폰 높이 ${H} 페이지 오류 없음`, errs.length === 0, errs.slice(0, 2).join(' | '));
  }
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
