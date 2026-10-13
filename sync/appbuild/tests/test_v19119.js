#!/usr/bin/env node
/* 학원앱 v19-119 검사 — ⏰ 반 수업 시간 (lumen_group_times) · 학생이 고친 학원 시간
 *   (원장 2026-10-13 「학원앱에서 각 클래스의 시간을 조정하는 기능이 있나? 없으면 만들자.」 · 「학생들이 학원시간을 수정할 수 있게 하자.」)
 *   가짜 학생 3명(이름 ○○○1~3): ○○○1 T730 반(화목토) · ○○○2 T5 반(화목토, 학생앱에서 «내 학원 시간» 월·수 20:00~22:00 으로 고침) · ○○○3 M7 반(월수금)
 *   ① 설정 › 반(그룹) 관리: 「⏰ 반 수업 시간」 단추 · 요일 옆 요약(짐작) → 창: 반마다 수업 요일 줄 · 시작/길이 · 「짐작」
 *   ② T730 을 화·목 19:30 · 토 10:30, 2시간 30분으로 고침 → 「고침」 → 💾 저장 → lumen_store lumen_group_times (서버로 바로) · 이 기기 사본 · SYNC_KEYS
 *   ③ 주간계획 모아보기: 저장 전엔 짐작(화 19:30~21:30) + 「짐작」 안내 줄 · 저장 뒤 화·목 19:30~22:00 · 토 10:30~13:00 · 자료 읽기 한 번(or 질의에 lumen_group_times)
 *   ④ 안 정한 반은 반 이름 짐작(M7 → 19:00~21:00 · T630 → 18:30~20:30)
 *   ⑤ 학생이 고친 시간이 먼저(T5 화목토 대신 월·수 20:00~22:00) + 카드 「✏️ 학생이 고친 학원 시간」 + 큰 달력에도
 *   ⑥ 모아보기 머리 「⏰ 반 수업 시간」 → 같은 창 · 좁은 화면(390px)에서 가로 넘침 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19119.js lumen_v19-119.html
 *   그림: $SP/v19119_settings.png · $SP/v19119_wall.png · $SP/v19119_narrow.png · 가짜 서버 · 외부망 차단. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-119.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-119'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const TODAY = iso(new Date(Date.now() + 9 * 3600000));
const JSDAY = new Date(TODAY + 'T00:00:00Z').getUTCDay();
const MON = add(TODAY, -((JSDAY + 6) % 7));
const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 1학년', group: 'T730', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중학교 2학년', group: 'M7', lumen_rec_code: 'AAA333', lumen_planner: {} }];
const DAYS = { T730: [2, 4, 6], T5: [2, 4, 6], M7: [1, 3, 5] };
const STORE = {
  lumen_group_days: DAYS,
  codi_fixed_AAA222: { blocks: [
    { id: 'school', label: '학교', type: 'school', days: [0, 1, 2, 3, 4], start: '08:40', end: '16:00' },
    { id: 'lumen_meX0', label: '루멘수학', type: 'lumen', days: [0, 2], start: '20:00', end: '22:00', own: true }] },
  wplan_AAA111: { code: 'AAA111', weeks: { [MON]: { items: [{ id: 'a1', d: 0, t: '17:00', n: 2, subj: '수학', title: '쎈 30~33쪽', src: 'codi', kind: 'book' }], submittedAt: add(MON, -2) + 'T12:00:00Z' } } },
  plweek_ev: { byCode: {} } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 820 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS, DAYS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [], q: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, desc: '',
        select() { return b; }, eq(k, v) { b.desc += ' eq:' + v; b.f.push((x) => x === v); return b; }, in(k, a) { b.desc += ' in:' + a.length; b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { b.desc += ' like:' + p; const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or(str) { b.desc += ' or:' + str; const cs = String(str).split(',').map((c) => { const m = c.match(/^key\.(like|eq)\.(.*)$/); if (!m) return () => false; if (m[1] === 'eq') return (x) => x === m[2]; const pre = m[2].replace(/%$/, ''); return (x) => x.indexOf(pre) === 0; }); b.f.push((x) => cs.some((fn) => fn(x))); return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; T.ups.push({ tbl, keys: arr.map((r) => r.key) });
          if (tbl === 'lumen_store') arr.forEach((r) => { T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl === 'lumen_store') T.q.push(b.desc.trim()); if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: (p) => Promise.resolve({ data: { path: p }, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    try { _origSetItem('lumen_plw_pub_stamp', rk113Stamp()); } catch (e) {}
    try { localStorage.removeItem('lumen_group_times'); } catch (e) {}
    T.seed = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {} };
    T.seed();
    groupList.splice(0, groupList.length, 'T730', 'T5', 'M7');
    Object.keys(groupDays).forEach((k) => { delete groupDays[k]; }); Object.assign(groupDays, clone(DAYS));
    Object.assign(PWB, { loaded: false, loading: false, at: 0, W: null, gt: null });
  }, { STORE, STUDENTS, DAYS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('SYNC_KEYS 에 lumen_group_times (lumen_group_days 바로 뒤)', await pg.evaluate(() => SYNC_KEYS.indexOf('lumen_group_times') === SYNC_KEYS.indexOf('lumen_group_days') + 1));

  /* ③-가 저장 전 모아보기: 짐작 */
  await pg.evaluate(() => { VIEW = 'plwall'; PWB.loaded = false; render(); });
  await settle(1500);
  const lum = (code) => pg.evaluate((code) => { const card = document.querySelector('.pwl-card[data-code="' + code + '"]'); if (!card) return null; const o = {}; card.querySelectorAll('.pwl-col').forEach((c) => { const x = [...c.querySelectorAll('.pwl-fx.lum')].map((e) => e.getAttribute('title').replace(/^루멘 /, '')); if (x.length) o[c.getAttribute('data-d')] = x.join(','); }); return { lum: o, tags: (card.querySelector('.pwl-tags') || {}).innerText || '' }; }, code);
  const W0 = await pg.evaluate(() => ({ q: T.q.slice(), note: (document.querySelector('.pwl-lgt-note') || {}).innerText || '', btn: !!document.querySelector('.pwl-hd .pwl-lgt') }));
  const A0 = await lum('AAA111'), C0 = await lum('AAA333');
  console.log(JSON.stringify({ A0, C0, note: W0.note }));
  t('저장 전: T730 반은 반 이름 짐작 — 화·목·토 19:30~21:30', JSON.stringify(A0.lum) === JSON.stringify({ 1: '19:30~21:30', 3: '19:30~21:30', 5: '19:30~21:30' }), JSON.stringify(A0));
  t('저장 전: 「⏰ … 반 수업 시간이 아직 … 짐작」 안내 줄 · 머리 「⏰ 반 수업 시간」 단추', /짐작/.test(W0.note) && /T730/.test(W0.note) && W0.btn, W0.note);
  t('자료 읽기: 주간 점수와 같은 한 번의 or 질의에 lumen_group_times', W0.q.some((x) => /or:.*key\.eq\.lumen_group_times/.test(x)), JSON.stringify(W0.q));

  /* ① 설정 화면 */
  await pg.evaluate(() => { VIEW = 'settings'; render(); });
  await settle(400);
  const S = await pg.evaluate(() => ({ btn: !!document.querySelector('.lgt-open'), sums: [...document.querySelectorAll('.lgt-sum')].map((e) => e.innerText) }));
  t('설정 › 반(그룹) 관리: 「⏰ 반 수업 시간」 단추 · 반마다 요약 (짐작)', S.btn && S.sums.length === 3 && /화 19:30~21:30 · 목 19:30~21:30 · 토 19:30~21:30 짐작/.test(S.sums[0]), JSON.stringify(S));
  await pg.click('.lgt-open'); await settle(300);
  const O = await pg.evaluate(() => {
    const ov = document.getElementById('lgt-ov'); if (!ov) return null;
    return { secs: [...ov.querySelectorAll('.lgt-g')].map((g) => ({ g: g.getAttribute('data-g'), rows: [...g.querySelectorAll('.lgt-row')].map((r) => r.querySelector('.lgt-dn').textContent + ' ' + r.querySelector('select').value + ' ' + r.querySelectorAll('select')[1].value + ' ' + r.querySelector('.lgt-end b').textContent + ' ' + r.querySelector('.lgt-b').textContent) })),
      q: T.q.filter((x) => x === 'eq:lumen_group_times').length };
  });
  console.log(JSON.stringify(O));
  t('창: T730 · T5 · M7 — 수업 요일마다 한 줄(월요일부터) · 시작/길이/끝 · 「짐작」', O && O.secs.length === 3 && JSON.stringify(O.secs[0].rows) === JSON.stringify(['화 19:30 120 21:30 짐작', '목 19:30 120 21:30 짐작', '토 19:30 120 21:30 짐작']) && O.secs[2].rows[0] === '월 19:00 120 21:00 짐작' && O.secs[1].rows[0] === '화 17:00 120 19:00 짐작', JSON.stringify(O && O.secs));
  t('창을 열면 서버 것을 새로 읽음 (lumen_group_times 한 번)', O && O.q >= 1, O && O.q);
  /* ② T730: 화·목 19:30 · 토 10:30, 2시간 30분 */
  await pg.selectOption('#lgt-0-2-m', '150'); await pg.selectOption('#lgt-0-4-m', '150');
  await pg.selectOption('#lgt-0-6-s', '10:30'); await pg.selectOption('#lgt-0-6-m', '150');
  await settle(200);
  const E = await pg.evaluate(() => [...document.querySelectorAll('#lgt-ov .lgt-g')][0].innerText.replace(/\s+/g, ' '));
  t('고친 줄: 「고침」 · 끝 시간 자동 (22:00 · 13:00)', (E.match(/고침/g) || []).length === 3 && /22:00 끝/.test(E) && /13:00 끝/.test(E), E);
  await pg.screenshot({ path: SP + '/v19119_settings.png' });
  /* 요일 단추: M7 에 토요일 넣기 → 바로 lumen_group_days · 새 줄 */
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#lgt-ov .lgt-g')][2].querySelectorAll('.lgt-d')[5]; b.click(); });
  await settle(200);
  const D = await pg.evaluate(() => ({ gd: groupDays.M7.slice().sort(), ls: JSON.parse(localStorage.getItem('lumen_group_days')).M7.slice().sort(), rows: [...document.querySelectorAll('#lgt-ov .lgt-g')][2].querySelectorAll('.lgt-row').length }));
  t('창의 요일 단추: M7 에 토 넣기 → lumen_group_days 바로 저장 · 줄 4개', JSON.stringify(D.gd) === '[1,3,5,6]' && JSON.stringify(D.ls) === '[1,3,5,6]' && D.rows === 4, JSON.stringify(D));
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#lgt-ov .lgt-g')][2].querySelectorAll('.lgt-d')[5]; b.click(); });   /* 되돌림 */
  await settle(200);
  await pg.click('#lgt-save'); await settle(600);
  const V = await pg.evaluate(() => ({ srv: T.store.lumen_group_times, loc: JSON.parse(localStorage.getItem('lumen_group_times') || 'null'), ups: T.ups.filter((u) => u.keys.indexOf('lumen_group_times') >= 0).length, msg: document.getElementById('lgt-msg').innerText, badges: [...document.querySelectorAll('#lgt-ov .lgt-row .lgt-b')].map((e) => e.textContent) }));
  console.log(JSON.stringify(V.srv));
  const want = { 2: { start: '19:30', min: 150 }, 4: { start: '19:30', min: 150 }, 6: { start: '10:30', min: 150 } };
  t('💾 저장 → 서버 lumen_group_times.T730 = 화·목 19:30 · 토 10:30 (150분)', V.srv && JSON.stringify(V.srv.T730) === JSON.stringify(want) && V.ups >= 1, JSON.stringify(V.srv));
  t('이 기기 사본도 같음 · 저장 뒤 「짐작」 없이 「정함」 · ✅ 안내', V.loc && JSON.stringify(V.loc.T730) === JSON.stringify(want) && V.badges.every((b) => b === '정함') && /저장했어요/.test(V.msg), JSON.stringify([V.badges, V.msg]));
  await pg.evaluate(() => lgtClose());

  /* ③-나 저장 뒤 모아보기 */
  await pg.evaluate(() => { VIEW = 'plwall'; PWB.loaded = false; PWB.gt = null; render(); });
  await settle(1500);
  const A1 = await lum('AAA111'), B1 = await lum('AAA222'), C1 = await lum('AAA333');
  const W1 = await pg.evaluate(() => ({ note: (document.querySelector('.pwl-lgt-note') || {}).innerText || '', gt: PWB.gt && PWB.gt.T730 }));
  console.log(JSON.stringify({ A1, B1, C1 }));
  t('모아보기(서버에서 다시 읽음): T730 화 19:30~22:00 · 목 19:30~22:00 · 토 10:30~13:00', JSON.stringify(A1.lum) === JSON.stringify({ 1: '19:30~22:00', 3: '19:30~22:00', 5: '10:30~13:00' }) && !!W1.gt, JSON.stringify(A1));
  t('M7 반(저장한 짐작 그대로) 월·수·금 19:00~21:00 · 안내 줄 사라짐', JSON.stringify(C1.lum) === JSON.stringify({ 0: '19:00~21:00', 2: '19:00~21:00', 4: '19:00~21:00' }) && !W1.note, JSON.stringify([C1, W1.note]));
  /* ④ 안 정한 반 = 짐작 */
  const G = await pg.evaluate(() => ({ t630: lgtBlocks('T630', { T630: [2, 4] }, {}).map((b) => b.days.join('') + ' ' + b.start + '~' + b.end + (b.guess ? ' 짐작' : '')), mix: lgtBlocks('T730', { T730: [2, 4, 6] }, { T730: { 6: { start: '10:30', min: 150 } } }).map((b) => b.days.join('') + ' ' + b.start + '~' + b.end + (b.guess ? ' 짐작' : '')),
    m7: pwcFixed({ lumen_rec_code: 'ZZZ999', grade: '중1', group: 'M7' }).lumen }));
  t('안 정한 반은 반 이름 짐작: T630 → 화·목 18:30~20:30 · 일부 요일만 정하면 나머지 요일은 짐작', JSON.stringify(G.t630) === JSON.stringify(['13 18:30~20:30 짐작']) && JSON.stringify(G.mix) === JSON.stringify(['5 10:30~13:00', '13 19:30~21:30 짐작']), JSON.stringify(G));
  /* ⑤ 학생이 고친 시간 */
  t('학생이 고친 학원 시간이 먼저: ○○○2(T5 화목토) → 월·수 20:00~22:00 만', JSON.stringify(B1.lum) === JSON.stringify({ 0: '20:00~22:00', 2: '20:00~22:00' }), JSON.stringify(B1));
  t('카드 꼬리표 「✏️ 학생이 고친 학원 시간」 — 그 학생만', /✏️ 학생이 고친 학원 시간/.test(B1.tags) && !/학생이 고친/.test(A1.tags) && !/학생이 고친/.test(C1.tags), JSON.stringify([B1.tags, A1.tags]));
  await pg.screenshot({ path: SP + '/v19119_wall.png', fullPage: false });
  await pg.evaluate(() => plwCal('AAA222')); await settle(300);
  const K = await pg.evaluate(() => { const ov = document.getElementById('plw-cal-ov'); const t = ov ? ov.innerText : ''; plwCalClose(); return t; });
  t('큰 달력에도 「✏️ 학생이 고친 학원 시간」', /✏️ 학생이 고친 학원 시간/.test(K), K.slice(0, 200));
  /* ⑥ 머리 단추 · 좁은 화면 */
  await pg.click('.pwl-hd .pwl-lgt'); await settle(300);
  t('모아보기 머리 「⏰ 반 수업 시간」 → 같은 창', await pg.evaluate(() => !!document.querySelector('#lgt-ov .lgt-g')));
  await pg.setViewportSize({ width: 390, height: 800 }); await settle(300);
  const N = await pg.evaluate(() => { const b = document.querySelector('#lgt-ov .lgt-box'), sc = document.querySelector('#lgt-ov .lgt-scroll'); const sel = document.querySelector('#lgt-ov select'); return { bw: b.getBoundingClientRect().width, sw: sc.scrollWidth, cw: sc.clientWidth, sh: sel.getBoundingClientRect().height, dw: document.querySelector('#lgt-ov .lgt-d').getBoundingClientRect().width }; });
  t('좁은 화면(390px): 창 안 가로 넘침 없음 · 고르기 칸 높이 ≥ 40px · 요일 단추 ≥ 36px', N.bw <= 390 && N.sw <= N.cw + 1 && N.sh >= 40 && N.dw >= 36, JSON.stringify(N));
  await pg.screenshot({ path: SP + '/v19119_narrow.png' });
  await pg.evaluate(() => lgtClose());
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
