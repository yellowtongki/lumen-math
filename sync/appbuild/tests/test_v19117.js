#!/usr/bin/env node
/* 학원앱 v19-117 검사 — 아이패드(사파리)에서도 저장 보호 장치가 걸리는가
 *   (원장 2026-10-13 아이패드 수업 모드: QuotaExceededError setItem@[native code] ← saveStudents ← hwcSave)
 *   기기 저장 한도를 약 1.2MB 로 흉내(그 이상 쓰면 QuotaExceededError) + 옛 버전이 남긴 디스크 사본
 *   (서버 전용 키 ms_exam_test 0.5MB · 사파리가 저장한 «setItem» 값 · 큰 등록부)을 미리 넣고 연다.
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19117.js lumen_v19-117.html
 *   학생 실명·실제 점수 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-117.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v19117-'));
  const blank = path.join(dir, 'blank.html'); fs.writeFileSync(blank, '<p>x</p>');
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 820 } });
  await ctx.addInitScript(() => {
    const P = Storage.prototype, nSet = P.setItem, nGet = P.getItem, LIM = 1200000;
    P.setItem = function (k, v) {
      if (this === window.localStorage) {
        let used = 0; for (let i = 0; i < this.length; i++) { const kk = this.key(i); if (kk !== k) used += kk.length + (nGet.call(this, kk) || '').length; }
        if (used + String(k).length + String(v).length > LIM) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; }
      }
      return nSet.call(this, k, v);
    };
  });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + blank);
  await pg.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('ms_exam_test', 'm'.repeat(500000));
    localStorage.setItem('setItem', 'function(key, value) { /* 옛 대입 */ }');
    const sts = []; for (let i = 0; i < 6; i++) sts.push({ id: 's' + i, name: '○○○' + i, lumen_rec_code: 'AAA11' + i, school: '옥길중', grade: '중1', memo: 'n'.repeat(80000) });
    localStorage.setItem('or_studentdb', JSON.stringify(sts));
  });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r = await pg.evaluate(() => {
    const o = {};
    o.hook = window.__lsHook;
    o.ownSet = Object.prototype.hasOwnProperty.call(localStorage, 'setItem');
    o.diskMs = _origGetItem('ms_exam_test'); o.readMs = (localStorage.getItem('ms_exam_test') || '').length;
    o.junk = _origGetItem('setItem');
    o.studentsN = (typeof students !== 'undefined' && students.length) || 0;
    try { localStorage.setItem('ms_exam_big', 'b'.repeat(2000000)); o.bigOk = true; } catch (e) { o.bigOk = 'throw ' + e.name; }
    o.bigDisk = _origGetItem('ms_exam_big'); o.bigRead = (localStorage.getItem('ms_exam_big') || '').length;
    try { students.forEach(function (s) { s.memo2 = 'z'.repeat(300000); }); saveStudents(); o.saveOk = true; } catch (e) { o.saveOk = 'throw ' + e.name; }
    o.memFull = (_memStore.or_studentdb || '').length;
    try { hwcSave(students[0], '2026-10-13', { p: 100, c: 100, w: 100 }); o.hwcOk = true; } catch (e) { o.hwcOk = 'throw ' + e.name + ' ' + e.message; }
    o.hwcRead = (JSON.parse(localStorage.getItem('or_studentdb'))[0].lumen_hw || {})['2026-10-13'];
    try { localStorage.setItem('or_small_x', '1'); o.small = _origGetItem('or_small_x'); } catch (e) { o.small = 'throw'; }
    sessionStorage.setItem('ss_t', 'v'); o.ss = sessionStorage.getItem('ss_t'); o.ssLs = _origGetItem('ss_t');
    localStorage.removeItem('or_small_x'); o.rem = localStorage.getItem('or_small_x');
    let used = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); used += k.length + (_origGetItem(k) || '').length; } o.used = used;
    return o;
  });
  t('감싸기가 Storage.prototype 에 걸림', r.hook === 'prototype', r.hook);
  t('localStorage 자기 속성 setItem 없음(사파리와 같은 길)', r.ownSet === false);
  t('서버 전용 키 디스크 사본 → 비움', r.diskMs === null);
  t('서버 전용 키 읽기는 메모리에서 그대로', r.readMs === 500000, r.readMs);
  t('사파리가 남긴 «setItem» 값 지움', r.junk === null, r.junk);
  t('등록부 학생 6명 읽힘', r.studentsN === 6, r.studentsN);
  t('서버 전용 큰 자료 2MB 저장 — 오류 없음', r.bigOk === true, r.bigOk);
  t('  … 디스크엔 안 쓰고 메모리로', r.bigDisk === null && r.bigRead === 2000000);
  t('등록부 1.8MB 저장(saveStudents) — 오류 없음', r.saveOk === true, r.saveOk);
  t('  … 메모리엔 전체본', r.memFull > 1800000, r.memFull);
  t('수업 모드 숙제 저장(hwcSave) — 오류 없음', r.hwcOk === true, r.hwcOk);
  t('  … 저장한 숙제 값이 읽힘', r.hwcRead && r.hwcRead.p === 100, JSON.stringify(r.hwcRead));
  t('작은 값 저장은 디스크에', r.small === '1', r.small);
  t('지우기 작동', r.rem === null, r.rem);
  t('sessionStorage 는 그대로(디스크 localStorage 와 섞이지 않음)', r.ss === 'v' && r.ssLs === null);
  t('기기 사용량 한도 안', r.used <= 1200000, r.used);
  const red = await pg.evaluate(() => !!Array.from(document.querySelectorAll('div')).find((d) => /화면을 그리지 못했습니다/.test(d.textContent || '') && d.offsetParent));
  t('「화면을 그리지 못했습니다」 없음', !red);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n결과: ' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
