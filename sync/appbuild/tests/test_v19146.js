#!/usr/bin/env node
/* 학원앱 v19-146 검사 — 🚑 리커버리 안내문에서 시간 빼기 (원장 2026-10-22 「네이버예약 시간은 빼자」) · v19-145 검사를 시간 없이로 고침
 *   외부망 차단 · 가짜 학생(○○○) · 확정 명단(rcConfirmed)·네이버 예약(nbkRecOf)은 흉내
 *   ① 주간테스트 있음 + 예약 없음: «40문항 중 10문항을 맞혀 25점» · «네이버 예약으로 … (10:00 · 11:00 · 13:00)» · 「예약 아직」 표시
 *   ② 예약 있음: 날짜에 예약 시간 · «네이버 예약(11:00)은 확인했습니다» · 예약 부탁 줄 없음
 *   ③ 시험 기록 없음(직접 호출): «최근 학습 점검» · 보충 내용 줄
 *   ④ 예약 주소 넣기 → 예약 부탁 줄 아래 «예약: 주소» (예약한 학생에겐 안 붙음) · http 아닌 글은 거절
 *   ⑤ 📋 복사 = 그 학생 글 · 전체 복사 = 세 명 · 🤖 AI 초안 요청에 점수·예약 여부·주소가 들어감 · 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19145.js lumen_v19-146.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-146.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    try { localStorage.removeItem('rc_nb_url'); } catch (e) {}
    window.__clip = []; navigator.clipboard.writeText = (s) => { window.__clip.push(s); return Promise.resolve(); };
    RC.cfg.slots = ['10:00', '11:00', '13:00'];
    window.rcConfirmed = () => [
      { k: 'S1', name: '○○○1', score: 25, rx: ['「일차방정식」 개념 요약 복습'], row: { testHit: { score: 25, correct: 10, total: 40, date: '2026-10-20' } }, e: { on: true, slot: '10:00' } },
      { k: 'S2', name: '○○○2', score: 75, rx: ['「원과 부채꼴」 개념 요약 복습'], row: { testHit: { score: 75, correct: 30, total: 40 } }, e: { on: true } },
      { k: 'S3', name: '○○○3', score: null, rx: ['「닮은 도형의 성질」 실전 유형 연습'], row: null, e: { on: true, manual: true } }];
    window.nbkHas = () => true;
    window.nbkRecOf = (k) => (k === 'S2' ? { start: '11:00', item: { kind: 'recovery' } } : null);
    window.__req = null; window.fetch = (u, o) => { window.__req = JSON.parse(o.body); return Promise.resolve({ ok: true, json: () => Promise.resolve({ content: [{ text: '[루멘수학] AI 글' }] }) }); };
    localStorage.setItem('or_api_key', 'sk-test');
    rcOpenSms();
  });
  await pg.waitForTimeout(200);
  const TX = () => pg.evaluate(() => [0, 1, 2].map((i) => (document.getElementById('rc-sms-' + i) || {}).value || ''));
  let tx = await TX();
  const pop = await pg.evaluate(() => document.getElementById('rc-pop').innerText);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-146');
  t('① 점수 «40문항 중 10문항을 맞혀 25점이 나와»', /이번 주 주간테스트에서 40문항 중 10문항을 맞혀 25점이 나와/.test(tx[0]), tx[0]);
  t('① 예약 부탁(가능 시간 없음) · 날짜만(배정 시간 없음)', /네이버 예약으로 편하신 시간을 잡아 주시면 감사하겠습니다/.test(tx[0]) && /일\(.\) 리커버리/.test(tx[0]) && !/\d\d:\d\d/.test(tx[0]), tx[0]);
  t('① [루멘수학] 시작 · 감사합니다 끝 · 보충 내용', /^\[루멘수학\] 안녕하세요, ○○○1 학생 학부모님\./.test(tx[0]) && /감사합니다\.$/.test(tx[0]) && /보충 내용: 「일차방정식」/.test(tx[0]));
  t('① 「예약 아직」 표시 · ② 「✓ 네이버 예약 11:00」 표시', /예약 아직/.test(pop) && /✓ 네이버 예약 11:00/.test(pop), pop.slice(0, 300));
  t('② 예약 있음: 시간 없이 «네이버 예약은 확인했습니다» · 부탁 줄 없음', /일\(.\) 리커버리/.test(tx[1]) && /네이버 예약은 확인했습니다\. 예약하신 시간에 맞춰 보내 주세요\./.test(tx[1]) && !/\d\d:\d\d/.test(tx[1]) && !/잡아 주시면/.test(tx[1]), tx[1]);
  t('③ 시험 기록 없음 → «최근 학습 점검»', /최근 학습 점검에서 보완이 필요한 단원이 있어/.test(tx[2]) && !/주간테스트/.test(tx[2]), tx[2]);
  /* ④ 주소 */
  await pg.evaluate(() => { document.getElementById('r145-url-in').value = 'naver.me/xyz'; r145SetUrl('naver.me/xyz'); });
  t('④ http 아닌 주소 거절', (await pg.evaluate(() => localStorage.getItem('rc_nb_url'))) === null);
  await pg.evaluate(() => r145SetUrl('https://naver.me/abc123')); await pg.waitForTimeout(150);
  tx = await TX();
  t('④ 주소 → 예약 부탁 줄 아래 «예약: 주소» · 예약한 학생엔 없음', /잡아 주시면 감사하겠습니다\.\n예약: https:\/\/naver\.me\/abc123\n감사합니다\.$/.test(tx[0]) && !/naver\.me/.test(tx[1]), JSON.stringify(tx.slice(0, 2)));
  t('④ 칸에 주소 그대로 남음', (await pg.evaluate(() => document.getElementById('r145-url-in').value)) === 'https://naver.me/abc123');
  /* ⑤ 복사 · AI */
  await pg.evaluate(() => r145Copy(1)); 
  t('⑤ 📋 복사 = 그 학생 글', (await pg.evaluate(() => window.__clip[window.__clip.length - 1])) === tx[1]);
  await pg.evaluate(() => rcSmsDraft(0, 'S1')); await pg.waitForTimeout(200);
  const rq = await pg.evaluate(() => window.__req && window.__req.messages[0].content);
  t('⑤ AI 초안 요청에 점수·예약 부탁·가능 시간·주소', rq && /40문항 중 10문항 맞힘, 25점/.test(rq) && /네이버 예약: 아직 없음/.test(rq) && !/10:00/.test(rq) && /시간\(몇 시\)은 문자에 쓰지 말 것/.test(rq) && /https:\/\/naver\.me\/abc123/.test(rq), rq);
  t('⑤ AI 글이 칸에 들어감', (await TX())[0] === '[루멘수학] AI 글');
  await pg.evaluate(() => rcSmsDraft(1, 'S2')); await pg.waitForTimeout(200);
  t('⑤ 예약한 학생 AI 요청 = «이미 예약함» · 시간 없음', /이미 예약함/.test(await pg.evaluate(() => window.__req.messages[0].content)));
  await pg.evaluate(() => rcCopyAllSms(3));
  t('⑤ 전체 복사 = 세 명', (await pg.evaluate(() => window.__clip[window.__clip.length - 1].split('\n\n').length)) === 3);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
