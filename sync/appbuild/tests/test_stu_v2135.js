#!/usr/bin/env node
/* 학생앱 v2-135 검사 — ⏰ 루멘수학 수업 시간: 반 시간(lumen_group_times) · 내가 고친 학원 시간(codi_fixed_ 안 type 'lumen' own)
 *   (원장 2026-10-13 「학원앱에서 각 클래스의 시간을 조정하는 기능이 있나? 없으면 만들자.」 · 「학생들이 학원시간을 수정할 수 있게 하자.」)
 *   ① 주간계획표 달력: T730 반 = 화·목 19:30~22:00 · 토 10:30~13:00 (학원앱이 정한 반 시간, 요일별) · 읽을 때 lumen_group_times 도 같이
 *   ② 안 정한 반은 반 이름 짐작(M7 → 월수금 19:00~21:00)
 *   ③ 📌 고정 일정 › 「🏫 루멘수학 수업 시간」: 반 시간 보여 줌 → 토 빼고 화 20:00 2시간으로 고쳐 저장
 *      → codi_fixed_<코드>.blocks 에 { type:'lumen', own:true, label:'루멘수학', id:'lumen_me…' } · 학교 칸은 그대로 · 달력도 바로 바뀜
 *   ④ 스터디 코디 「내 고정 시간표」도 내가 고친 시간(지우기 단추 없음) + 「✏️ 학원 시간 고치기」
 *   ⑤ 「↺ 반 시간으로 되돌리기」 · 반 시간과 똑같이 저장하면 고친 칸을 만들지 않음 · 요일 0개는 저장 안 함
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2135.js student_v2-135.html
 *   그림: $SP/stu2135_editor.png · $SP/stu2135_cal.png · 가짜 서버 · 외부망 차단 · 학생 이름 ○○○ */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-135.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v2-\d+/) || ['v2-135'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: { lumen_group_days: { T730: [2, 4, 6], M7: [1, 3, 5] }, lumen_group_times: { T730: { 2: { start: '19:30', min: 150 }, 4: { start: '19:30', min: 150 }, 6: { start: '10:30', min: 150 } } }, codi_settings: { targets: ['*'] } }, ups: [], toasts: [], inKeys: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false,
        select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { if (tbl === 'lumen_store') T.inKeys.push(a.slice()); b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; }, or() { return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.ups.push(r.key); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]) }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    sb = { from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: p } }) }) } };
    window.supabase = { createClient: () => sb };
    studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중2', school: '옥길중', group: 'T730', id: 'S1' }; isTest = false;
    window.toast = (m) => { T.toasts.push(m); };
  });
  const ver = await pg.evaluate(() => STU_VER);
  t('버전 ' + WANT, ver === WANT, ver);
  const wait = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  /* 달력의 루멘 칸: { 요일: 'HH:MM~HH:MM' } (칸 위치에서 거꾸로 셈 — 07:00 부터 30분 = 20px) */
  const calLum = () => pg.evaluate(() => { const o = {}; document.querySelectorAll('#wp-body .wpc-col').forEach((c) => { const x = [...c.querySelectorAll('.wb.fx.lumen')].map((e) => { const top = parseFloat(e.style.top), h = parseFloat(e.style.height) + 1; const s = 7 * 60 + top / 20 * 30, en = s + h / 20 * 30; const f = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); return f(s) + '~' + f(en); }); if (x.length) o[c.getAttribute('data-d')] = x.join(','); }); return o; });

  /* ① 반 시간대로 */
  await pg.evaluate(() => { wplOpen('this'); }); await wait(700);
  const A = await calLum();
  const keysW = await pg.evaluate(() => T.inKeys.filter((a) => a.indexOf('wplan_AAA111') >= 0).map((a) => a.indexOf('lumen_group_times') >= 0));
  console.log(JSON.stringify(A));
  t('주간계획표 달력: 화·목 19:30~22:00 · 토 10:30~13:00 (반 시간, 요일별)', JSON.stringify(A) === JSON.stringify({ 1: '19:30~22:00', 3: '19:30~22:00', 5: '10:30~13:00' }), JSON.stringify(A));
  t('주간계획표가 lumen_group_days 와 함께 lumen_group_times 도 읽음', keysW.length >= 1 && keysW.every(Boolean), JSON.stringify(keysW));
  await pg.screenshot({ path: SP + '/stu2135_cal.png', fullPage: false });
  /* ② 짐작 */
  const G = await pg.evaluate(() => { studentInfo.group = 'M7'; wplRender(); return 1; });
  const G2 = await calLum();
  t('안 정한 반은 반 이름 짐작: M7 → 월·수·금 19:00~21:00', JSON.stringify(G2) === JSON.stringify({ 0: '19:00~21:00', 2: '19:00~21:00', 4: '19:00~21:00' }), JSON.stringify(G2));
  await pg.evaluate(() => { studentInfo.group = 'T730'; WP.lmDraft = null; wplRender(); });

  /* ③ 고정 일정 › 루멘수학 수업 시간 */
  await pg.evaluate(() => { wplFxToggle(); });
  const P = await pg.evaluate(() => { const b = document.getElementById('wpl-lum'); return b ? { txt: b.innerText.replace(/\s+/g, ' '), rows: b.querySelectorAll('.wpl-lum-row').length, days: [...b.querySelectorAll('.wpl-lum-days button.on')].map((x) => x.textContent).join(''), del: [...document.querySelectorAll('.wpf-it')].map((x) => x.innerText).filter((x) => /루멘/.test(x)).length } : null; });
  console.log(JSON.stringify(P));
  t('📌 고정 일정에 「🏫 루멘수학 수업 시간」 — 우리 반 시간 보여 줌 · 화목토 3줄 · 반 시간 그대로', P && /우리 반\(T730\) 시간: 화 19:30~22:00 · 목 19:30~22:00 · 토 10:30~13:00/.test(P.txt) && P.rows === 3 && P.days === '화목토' && /반 시간 그대로예요/.test(P.txt) && !/되돌리기/.test(P.txt), JSON.stringify(P));
  /* 토 빼고 · 화 20:00 2시간 */
  await pg.evaluate(() => wplLumDay(5));
  await pg.selectOption('#wpl-lum-s-1', '20:00'); await pg.selectOption('#wpl-lum-m-1', '120');
  const E1 = await pg.evaluate(() => document.getElementById('wpl-lum-e-1').textContent);
  t('고르면 끝 시간이 바로 바뀜 (~22:00)', E1 === '~22:00', E1);
  await pg.evaluate(() => { const b = document.getElementById('wpl-lum'); b.scrollIntoView({ block: 'center' }); });
  await wait(200);
  await pg.screenshot({ path: SP + '/stu2135_editor.png', fullPage: false });
  await pg.evaluate(async () => { await wplLumSave(); }); await wait(300);
  const S = await pg.evaluate(() => { const f = T.store.codi_fixed_AAA111; const ow = ((f && f.blocks) || []).filter((b) => b.type === 'lumen'); return { ow, school: ((f && f.blocks) || []).filter((b) => b.type === 'school').length, toasts: T.toasts.slice(-1)[0], txt: document.getElementById('wpl-lum').innerText.replace(/\s+/g, ' ') }; });
  console.log(JSON.stringify(S.ow));
  const owS = S.ow.map((b) => b.days.join('') + ' ' + b.start + '~' + b.end + ' ' + (b.own ? 'own' : '') + ' ' + b.label + ' ' + (/^lumen_me/.test(b.id) ? 'id' : 'x')).sort();
  t('저장 → codi_fixed_AAA111 안에 내가 고친 루멘 칸 (화 20:00~22:00 · 목 19:30~22:00, own · 루멘수학 · lumen_me…) · 학교 칸 그대로', JSON.stringify(owS) === JSON.stringify(['1 20:00~22:00 own 루멘수학 id', '3 19:30~22:00 own 루멘수학 id']) && S.school >= 1 && /저장했어요/.test(S.toasts), JSON.stringify([owS, S.school, S.toasts]));
  const C1 = await calLum();
  t('달력도 바로: 화 20:00~22:00 · 목 19:30~22:00 · 토 없음 · 「내가 고친 시간」 · 되돌리기 단추', JSON.stringify(C1) === JSON.stringify({ 1: '20:00~22:00', 3: '19:30~22:00' }) && /내가 고친 시간이에요/.test(S.txt) && /반 시간으로 되돌리기/.test(S.txt), JSON.stringify([C1, S.txt.slice(0, 80)]));
  const L = await pg.evaluate(() => [...document.querySelectorAll('.wpf-it')].map((x) => x.innerText.replace(/\s+/g, ' ')));
  t('아래 고정 일정 목록에 루멘 칸이 «지우기»로 따로 나오지 않음', !L.some((x) => /루멘/.test(x)), JSON.stringify(L));

  /* ④ 스터디 코디 「내 고정 시간표」 */
  const K = await pg.evaluate(async () => { await scFixedInit(); const b = document.getElementById('sc-fixed-body'); return b ? b.innerText.replace(/\s+/g, ' ') : ''; });
  const kKeys = await pg.evaluate(() => T.inKeys.filter((a) => a.indexOf('codi_fixed_AAA111') >= 0 && a.indexOf('codi_plan_AAA111') >= 0).map((a) => a.indexOf('lumen_group_times') >= 0));
  console.log(K.slice(0, 260));
  t('코디 「내 고정 시간표」: 루멘수학 화 20:00~22:00 · 목 19:30~22:00 «내가 고친 시간» · 「✏️ 학원 시간 고치기」 · 코디도 lumen_group_times 읽음', /루멘수학 화 20:00~22:00 내가 고친 시간/.test(K) && /루멘수학 목 19:30~22:00 내가 고친 시간/.test(K) && /학원 시간 고치기/.test(K) && kKeys.length >= 1 && kKeys.every(Boolean), K.slice(0, 200) + ' ' + JSON.stringify(kKeys));
  t('코디 목록에 루멘 칸 «지우기» 없음', !/루멘수학[^·]*지우기/.test(K), K);

  /* ⑤ 요일 0개 · 되돌리기 · 반 시간과 같게 */
  await pg.evaluate(() => { wplOpen('this'); }); await wait(700);
  await pg.evaluate(() => { if (!WP.fxOpen) wplFxToggle(); });
  const Z = await pg.evaluate(async () => { const n0 = T.ups.length; [1, 3].forEach((d) => wplLumDay(d)); await wplLumSave(); return { ups: T.ups.length - n0, toast: T.toasts.slice(-1)[0] }; });
  t('요일을 다 빼고 저장하면 저장 안 함 + 안내', Z.ups === 0 && /요일을 하나 이상/.test(Z.toast), JSON.stringify(Z));
  await pg.evaluate(async () => { WP.lmDraft = null; wplRender(); await wplLumReset(); }); await wait(200);
  const R = await pg.evaluate(() => ({ ow: (T.store.codi_fixed_AAA111.blocks || []).filter((b) => b.type === 'lumen').length, toast: T.toasts.slice(-1)[0] }));
  const C2 = await calLum();
  t('「↺ 반 시간으로 되돌리기」 → 고친 칸 지움 · 달력은 다시 반 시간', R.ow === 0 && /되돌렸어요/.test(R.toast) && JSON.stringify(C2) === JSON.stringify({ 1: '19:30~22:00', 3: '19:30~22:00', 5: '10:30~13:00' }), JSON.stringify([R, C2]));
  const Q = await pg.evaluate(async () => { WP.lmDraft = null; wplRender(); await wplLumSave(); return { ow: (T.store.codi_fixed_AAA111.blocks || []).filter((b) => b.type === 'lumen').length, toast: T.toasts.slice(-1)[0] }; });
  t('반 시간과 똑같이 저장하면 고친 칸을 만들지 않음', Q.ow === 0 && /반 시간과 같아서/.test(Q.toast), JSON.stringify(Q));
  /* 좁은 화면 */
  const N = await pg.evaluate(() => { const b = document.getElementById('wpl-lum'); return { sw: b.scrollWidth, cw: b.clientWidth, doc: document.documentElement.scrollWidth, sel: b.querySelector('select').getBoundingClientRect().height }; });
  t('좁은 화면(390px): 루멘 칸 가로 넘침 없음 · 고르기 칸 높이 ≥ 40px', N.sw <= N.cw + 1 && N.doc <= 391 && N.sel >= 40, JSON.stringify(N));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
