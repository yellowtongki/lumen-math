#!/usr/bin/env node
/* 학생앱 v2-158 검사 — 📚 「숙제 체크」 카드 2판 (docs/hw_dispatch_contract.md §10 · 시안 docs/mockup_student_hwcheck.html)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111 · 반 T5 화·목)
 *   ① 스위치 stu_features.hw 꺼짐/학년 제외 → 없음 · 켜짐 → 흰 카드(네 줄 × 네 눈금 · 종합 % · 아하노트 칩 · 기록 줄)
 *   ② 수업일 계산 — 요일표 있음(다음 화·목) / 없음(오늘)  (v2-155 그대로)
 *   ③ 눈금 누름 → hw_self_<코드> 에만 upsert(onConflict key · todo_st_·todo_ 안 씀) · 값 30/60/100 · 되누르면 바뀜 · 종합 % (네 평균)
 *   ④ 아하노트 「없어요」 → aNone:true · a 없음 · 눈금 흐림 · 「해당 없음」 · 종합은 셋 평균 / 「있어요」 되돌리기
 *   ⑤ 날짜 ◀▶ — 지난 수업일(7일 안)에 따로 저장 · 범위 밖으로 못 감
 *   ⑥ 기록 줄 5칸 — hw_teach 있으면 파란 · 없으면 내 값 검정 · 둘 다 없으면 — · 요일표 없으면 적힌 날짜
 *   ⑦ 홈에 「이번 숙제」 목록 없음 · 'XP' 글자 0개 · 📅 주간계획표 🔒 선생님 줄 그대로 · ES5 · 홈·탭 회귀 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2156.js [student_v2-158.html]
 *        SHOT=/경로/stu156.png 를 주면 끝에 체크 중 상태(풀이 100 · 채점 60 · 오답 30 · 아하 없어요) 스크린샷 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-158.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* 가짜 Supabase — lumen_store 를 흉내 낸다. in()/eq() 로 고른 키만 돌려주고, upsert 는 적어 둔다 */
const MOCK = () => {
  window.__store = {}; window.__ups = []; window.__gos = []; window.__toasts = [];
  const store = window.__store;
  window.sb = { from(tbl) { const b = { f: {}, op: 'select', select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, gte() { return b; }, lte() { return b; }, is() { return b; }, or() { return b; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { let keys = Object.keys(store); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.length ? { key: keys[0], value: store[keys[0]] } : null, error: null }); },
    upsert(row, opt) { __ups.push({ tbl, key: row.key, value: JSON.parse(JSON.stringify(row.value)), opt: opt || null }); if (tbl === 'lumen_store') store[row.key] = row.value; return Promise.resolve({ error: null }); },
    insert() { return Promise.resolve({ data: null, error: null }); }, update() { return b; }, delete() { return b; },
    then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: [], error: null }).then(r, j); let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; },
    rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/' + p } }) }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) } };
  window.isTest = false;
  window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5' };
  window.alert = () => {}; window.confirm = () => true;
  const o = window.toast; window.toast = function (m) { __toasts.push(String(m)); try { return o && o.apply(this, arguments); } catch (e) {} };
  const g0 = window.go; window.go = function (id) { __gos.push(id); return g0.apply(this, arguments); };
  /* 오늘(KST) 기준 날짜들 */
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
  window.__today = today; window.__add = add; window.__dow = dow;
  /* 우리 반 T5 = 화(2)·목(4) → 다음 수업일 D0 (오늘이 화·목이면 오늘) · 거꾸로 수업일 D1(7일 안) · 기록 줄 5칸 CD[0..4] (CD[4]=D0) */
  let D0 = today; for (let i = 0; i < 7; i++) { if ([2, 4].indexOf(dow(add(today, i))) >= 0) { D0 = add(today, i); break; } }
  let D1 = null; for (let i = 1; i <= 7; i++) { const d = add(D0, -i); if (d < add(today, -7)) break; if ([2, 4].indexOf(dow(d)) >= 0) { D1 = d; break; } }
  const CD = [D0]; for (let i = 1; CD.length < 5 && i < 60; i++) { const d = add(D0, -i); if ([2, 4].indexOf(dow(d)) >= 0) CD.push(d); } CD.reverse();
  window.__D0 = D0; window.__D1 = D1; window.__CD = CD;
  /* 선생님이 쓴 카드(todo_<코드>) — 학생앱은 읽기만(이 판 홈에는 안 보임 · 📅 계획 탭 🔒 줄만) */
  window.__todo = { items: [
    { id: 'hw:' + D0 + ':B1', kind: 'book', title: '개념+유형 중2(상)', book: '개념+유형 중2(상)', bookId: 'B1', from: 12, to: 15, n: 38, due: D0, src: 'hw', hw: true },
    { id: 'hw:p:1', kind: 'etc', title: '📄 일차함수 프린트', print: true, n: 15, due: D0, src: 'hw', hw: true },
    { id: 'm:1', kind: 'etc', title: '숙제 아닌 카드', due: D0, src: 'manual' } ] };
  store['todo_st_AAA111'] = { 'a:ws:7001': { st: 'got', at: '2026-11-01T10:00:00.000Z', photo: '' }, upd: '2026-11-01T10:00:00.000Z' };
  store['mf_wsq_AAA111'] = { list: [ { swId: 9002, wid: 7002, title: '유형 점검 11/1', date: add(today, -2), status: '학습완료', n: 10, o: 8, x: 2, q: 0, tag: 'HOMEWORK' } ] };
  /* 선생님 확인값(hw_teach_<코드> · 학원앱 발행) — CD[3](=D1 또는 그 즈음) 80 · CD[1] 65. CD[2] 는 아무 기록 없음 → — */
  window.__teach = { byDate: {}, upd: '2026-11-01T10:00:00.000Z' };
  window.__teach.byDate[CD[3]] = { p: 100, c: 60, w: 60, t: 80 };
  window.__teach.byDate[CD[1]] = { p: 60, c: 60, w: 60, t: 65 };
  /* 내가 전에 누른 값 — CD[3] 에도 내 값(100)이 있지만 선생님 값(80·파란색)이 이긴다 · CD[0] 은 내 값만(60·검정) */
  window.__selfOld = { byDate: {}, upd: '2026-11-01T10:00:00.000Z' };
  window.__selfOld.byDate[CD[3]] = { p: 100, c: 100, w: 100, a: 100, at: '2026-11-01T10:00:00.000Z' };
  window.__selfOld.byDate[CD[0]] = { p: 60, c: 60, w: 60, a: 60, at: '2026-10-20T10:00:00.000Z' };
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
  await pg.evaluate(MOCK);
  const P = (fn, a) => pg.evaluate(fn, a);
  /* 스위치·자료를 바꾸고 다시 불러온 뒤 홈 카드를 그린다 */
  const setup = (hwCfg, o) => P(async ([hw, o]) => {
    o = o || {}; SF.cfg = {}; if (hw) SF.cfg.hw = hw;
    __store['todo_AAA111'] = JSON.parse(JSON.stringify(__todo));
    if (o.noDays) delete __store['lumen_group_days']; else __store['lumen_group_days'] = { T5: [2, 4], T3: [1, 3, 5] };
    if (o.resetSelf) delete __store['hw_self_AAA111']; else if (o.oldSelf) __store['hw_self_AAA111'] = JSON.parse(JSON.stringify(__selfOld));
    if (o.noTeach) delete __store['hw_teach_AAA111']; else __store['hw_teach_AAA111'] = JSON.parse(JSON.stringify(__teach));
    TD.loaded = false; TD.busy = false; TD.items = []; TD.st = {}; HW.bkReq = false; BK.loaded = false;
    HW.loaded = false; HW.busy = false; HW.self = null; HW.teach = null; HW.days = null; HW.sel = null; if (window.WP) WP.days = null; if (window.CAL) CAL.data = null;
    __ups.length = 0; __toasts.length = 0;
    await hwLoad(true); await tdLoad(true); hwHomeUpdate(); await new Promise((r) => setTimeout(r, 50)); tdHomeUpdate();
    const el = document.getElementById('hw-home');
    return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' '), ups: __ups.map((u) => u.key) };
  }, [hwCfg, o]);
  const home = () => P(() => { const el = document.getElementById('hw-home'); return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' ') }; });
  /* 네 줄 상태 — 이름 · 값 글자 · 켜진 눈금 값 · 흐림/못 누름 */
  const rows = () => P(() => Array.prototype.map.call(document.querySelectorAll('#hw-home .hwk-r'), (r) => { const seg = r.querySelector('.hwk-seg'); const on = seg.querySelector('button.on'); return { nm: r.querySelector('.l').childNodes[0].textContent.trim(), v: r.querySelector('.v').textContent, on: on ? Number(on.textContent.replace(/\D.*$/, '')) : null, onCnt: seg.querySelectorAll('button.on').length, dim: seg.classList.contains('dim'), disabled: Array.prototype.every.call(seg.querySelectorAll('button'), (b) => b.disabled), segs: Array.prototype.map.call(seg.querySelectorAll('button small'), (s) => s.textContent) }; }));
  const pct = () => P(() => ({ n: Number(document.querySelector('#hw-home .hwk-pct').textContent.replace('%', '')), bar: document.querySelector('#hw-home .hwk-bar i').style.width }));
  const aha = () => P(() => { const bs = document.querySelectorAll('#hw-home .hwk-aha button'); return { none: bs[0].classList.contains('on'), has: bs[1].classList.contains('on'), na: !!document.querySelector('#hw-home .hwk-na') }; });
  const hist = () => P(() => Array.prototype.map.call(document.querySelectorAll('#hw-home .hwk-hist > div'), (d) => ({ d: d.querySelector('.d').textContent, v: d.querySelector('.p').textContent, blue: d.querySelector('.p').classList.contains('t'), empty: d.querySelector('.p').classList.contains('e'), sel: d.classList.contains('sel') })));
  const navSt = () => P(() => { const bs = document.querySelectorAll('#hw-home .hwk-dt button'); return { prev: !bs[0].disabled, next: !bs[1].disabled, lab: document.querySelector('#hw-home .hwk-dt .d').innerText.replace(/\s+/g, ' ') }; });
  const saved = () => P(() => JSON.parse(JSON.stringify(__store['hw_self_AAA111'] || null)));
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const md = (s) => Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10));
  const info = await P(() => ({ today: __today, D0: __D0, D1: __D1, CD: __CD }));
  const labOf = (d) => DOW[new Date(d + 'T00:00:00Z').getUTCDay()] + ' ' + md(d) + ' 수업';
  console.log('   (오늘 ' + info.today + ' · 다음 수업일 ' + info.D0 + ' · 그 앞 수업일 ' + info.D1 + ' · 기록 줄 ' + info.CD.join(',') + ')');

  t('버전 v2-158', (await P(() => STU_VER)) === 'v2-158');
  t('새 함수 있음 (hwLoad·hwSelfSet·hwAhaNone·hwNav·hwClassDate·hwPct·hwTeachOf·hwHistDates) · v2-153·155 함수도 남아 있음', await P(() => ['hwLoad', 'hwSelfSet', 'hwAhaNone', 'hwNav', 'hwClassDate', 'hwPct', 'hwTeachOf', 'hwHistDates', 'hwSelfOf', 'hwOpen', 'hwHomeUpdate', 'hwToggle', 'hwWeekStripHtml', 'hwWsFor', 'hwGoSw'].every((f) => typeof window[f] === 'function')));
  t('홈 첫 화면 「📌 오늘 할 일」(.td4) 바로 위에 #hw-home · 어두운 틀(tdb-bell) 벗고 흰 카드(hwk)', await P(() => { const a = document.querySelector('#screen-home .td4'); const el = document.getElementById('hw-home'); return !!a && el.nextElementSibling === a && el.classList.contains('hwk') && !el.classList.contains('tdb-bell') && !el.closest('#bell-sheet'); }));

  /* ① 스위치 */
  let r = await setup(null, { resetSelf: true });
  t('스위치 없음(기본 꺼짐) → 카드 없음', r.disp === 'none' && r.html === '', r.disp);
  r = await setup({ on: false }, { resetSelf: true });
  t('hw.on=false → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['중2'] }, { resetSelf: true });
  t('hw 켜졌지만 내 학년(중2) 제외 → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['초6'] }, { resetSelf: true, noTeach: true });
  let rw = await rows();
  t('hw 켜짐 → 📚 숙제 체크 카드 · 종합 0% · 네 줄(풀이·채점·오답·아하노트) · 값 「—」 · 눈금 아무것도 안 켜짐', r.disp === 'block' && /📚\s*숙제 체크/.test(r.txt) && (await pct()).n === 0 && rw.length === 4 && JSON.stringify(rw.map((x) => x.nm)) === JSON.stringify(['1 풀이', '2 채점', '3 오답', '4 아하노트']) && rw.every((x) => x.v === '—' && x.onCnt === 0), r.txt.slice(0, 200) + ' ' + JSON.stringify(rw));
  t('눈금 네 개 = 0 안 함 · 30 조금 · 60 절반 넘게 · 100 다 함 (네 줄 모두 · 단추 16개)', rw.every((x) => JSON.stringify(x.segs) === JSON.stringify(['안 함', '조금', '절반 넘게', '다 함'])) && (await P(() => document.querySelectorAll('#hw-home .hwk-seg button').length)) === 16 && /0.*안 함.*30.*조금.*60.*절반 넘게.*100.*다 함/.test(r.txt), JSON.stringify(rw.map((x) => x.segs)));
  let ah = await aha();
  t('아하노트 줄 위 「막힌 문제가 없어요 / 있어요」 두 칩 · 둘 다 안 켜짐 · 눈금은 살짝 흐림(soft) · 안내 한 줄', /막힌 문제가\s*없어요\s*있어요/.test(r.txt) && !ah.none && !ah.has && !ah.na && (await P(() => document.querySelector('#hw-home .hwk-r.s4 .hwk-seg').classList.contains('soft'))) && /눈금을 누르면 바로 저장돼요 · 수업 때 선생님이 확인하면 파란색으로 바뀌어요/.test(r.txt), r.txt);
  t('불러오기만 하고 저장(upsert)은 없음 · 기록 줄 5칸(기록 없음 → 전부 —)', r.ups.length === 0 && (await hist()).length === 5 && (await hist()).every((x) => x.v === '—' && x.empty), r.ups.join(',') + ' ' + JSON.stringify(await hist()));

  /* ② 수업일 계산 */
  t('수업일 = 반 요일표(T5 화·목)로 다음 수업일 「' + labOf(info.D0) + '」 (오늘이 수업일이면 오늘)', (await P(() => hwClassDate())) === info.D0 && (await navSt()).lab.indexOf(labOf(info.D0)) === 0, (await navSt()).lab);
  const nd = await setup({ on: true }, { resetSelf: true, noDays: true });
  t('요일표 없음 → 수업일 = 오늘 「' + labOf(info.today) + '」', (await P(() => hwClassDate())) === info.today && (await navSt()).lab.indexOf(labOf(info.today)) === 0, (await navSt()).lab);

  /* ③ 눈금 누름 → hw_self_ 에만 */
  r = await setup({ on: true }, { resetSelf: true });
  await P(() => { __ups.length = 0; __toasts.length = 0; hwSelfSet('p', 100); });
  await pg.waitForTimeout(30);
  let ups = await P(() => __ups.map((u) => u.key + '|' + (u.opt && u.opt.onConflict)));
  let sv = await saved();
  t('풀이 100 누름 → hw_self_AAA111 에만 upsert(onConflict key) · todo_st_·todo_ 는 안 씀', ups.length === 1 && ups[0] === 'hw_self_AAA111|key', ups.join(','));
  t('저장값 byDate[' + info.D0 + ']={p:100,c:0,w:0,at} · a·aNone 없음(아직 안 고름) · upd 있음', sv && sv.byDate && sv.byDate[info.D0] && sv.byDate[info.D0].p === 100 && sv.byDate[info.D0].c === 0 && sv.byDate[info.D0].w === 0 && !('a' in sv.byDate[info.D0]) && !('aNone' in sv.byDate[info.D0]) && !!sv.byDate[info.D0].at && !!sv.upd, JSON.stringify(sv));
  rw = await rows();
  t('화면: 풀이 줄 100 눈금 켜짐 · 「100%」 · 종합 25%(네 평균) · 막대 25% · 날짜 줄 「저장됨 · 시각」', rw[0].on === 100 && rw[0].v === '100%' && (await pct()).n === 25 && (await pct()).bar === '25%' && /저장됨 · \d\d:\d\d/.test((await navSt()).lab), JSON.stringify(rw[0]) + ' ' + JSON.stringify(await pct()) + ' ' + (await navSt()).lab);
  await P(() => { hwSelfSet('c', 60); hwSelfSet('w', 30); });
  await pg.waitForTimeout(30);
  sv = await saved(); rw = await rows();
  t('채점 60 · 오답 30 → 저장 c=60·w=30 · 종합 48% ((100+60+30+0)/4)', sv.byDate[info.D0].c === 60 && sv.byDate[info.D0].w === 30 && rw[1].on === 60 && rw[2].on === 30 && rw[1].v === '60%' && rw[2].v === '30%' && (await pct()).n === 48, JSON.stringify(sv.byDate[info.D0]) + ' ' + JSON.stringify(await pct()));
  await P(() => { hwSelfSet('c', 100); });
  await pg.waitForTimeout(30);
  const c1 = (await saved()).byDate[info.D0].c;
  await P(() => { hwSelfSet('c', 60); });
  await pg.waitForTimeout(30);
  sv = await saved();
  t('되누르기 — 채점 100 → 다시 60 으로 바뀜(눈금 한 개만 켜짐)', c1 === 100 && sv.byDate[info.D0].c === 60 && (await rows())[1].onCnt === 1, c1 + ' ' + JSON.stringify(sv.byDate[info.D0]));
  await P(() => { hwSelfSet('p', 0); });
  await pg.waitForTimeout(30);
  rw = await rows();
  t('0 「안 함」을 누르면 회색으로 켜짐(값 0%) · 종합 23%', (await saved()).byDate[info.D0].p === 0 && rw[0].on === 0 && rw[0].v === '0%' && (await P(() => document.querySelector('#hw-home .hwk-r.s1 .hwk-seg button.on').classList.contains('z'))) && (await pct()).n === 23, JSON.stringify(rw[0]) + ' ' + JSON.stringify(await pct()));
  await P(() => { hwSelfSet('p', 100); });
  await pg.waitForTimeout(30);

  /* ④ 아하노트 없어요 / 있어요 */
  await P(() => { hwAhaNone(true); });
  await pg.waitForTimeout(30);
  sv = await saved(); rw = await rows(); ah = await aha();
  t('「없어요」 → aNone:true · a 없음 · 「없어요」 칩 켜짐 · 눈금 흐림(dim)·못 누름 · 「해당 없음」 · 안내 글', sv.byDate[info.D0].aNone === true && !('a' in sv.byDate[info.D0]) && ah.none && !ah.has && ah.na && rw[3].dim && rw[3].disabled && rw[3].v === '해당 없음' && rw[3].onCnt === 0, JSON.stringify(sv.byDate[info.D0]) + ' ' + JSON.stringify(rw[3]) + ' ' + JSON.stringify(ah));
  t('종합 % = 셋 평균 63% ((100+60+30)/3) · 막대 63%', (await pct()).n === 63 && (await pct()).bar === '63%', JSON.stringify(await pct()));
  await P(() => { hwAhaNone(false); });
  await pg.waitForTimeout(30);
  sv = await saved(); rw = await rows(); ah = await aha();
  t('「있어요」 되돌리기 → aNone 없음 · a=0 · 「있어요」 칩 켜짐 · 눈금 살아남 · 종합 48%(네 평균)', !('aNone' in sv.byDate[info.D0]) && sv.byDate[info.D0].a === 0 && ah.has && !ah.none && !ah.na && !rw[3].dim && !rw[3].disabled && rw[3].on === 0 && (await pct()).n === 48, JSON.stringify(sv.byDate[info.D0]) + ' ' + JSON.stringify(rw[3]));
  await P(() => { hwSelfSet('a', 100); });
  await pg.waitForTimeout(30);
  sv = await saved();
  t('아하노트 100 → a=100 · 종합 73% ((100+60+30+100)/4)', sv.byDate[info.D0].a === 100 && (await pct()).n === 73, JSON.stringify(sv.byDate[info.D0]) + ' ' + JSON.stringify(await pct()));
  await P(() => { hwAhaNone(true); hwSelfSet('a', 60); });
  await pg.waitForTimeout(30);
  sv = await saved();
  t('「없어요」 상태에서 아하 눈금을 누르면 「있어요」로 보고 저장(aNone 지움 · a=60)', !('aNone' in sv.byDate[info.D0]) && sv.byDate[info.D0].a === 60, JSON.stringify(sv.byDate[info.D0]));
  await P(() => { hwSelfSet('c', 100); hwSelfSet('w', 100); hwSelfSet('a', 100); });
  await pg.waitForTimeout(30);
  t('넷 다 100 → 종합 100% · 날짜 줄 「다 했어요 🎉」 · 안내 줄 초록(done)', (await pct()).n === 100 && /다 했어요/.test((await navSt()).lab) && (await P(() => document.querySelector('#hw-home .hwk-tip').classList.contains('done'))), (await navSt()).lab);
  t('XP 글자·토스트 없음 — 카드 안 \'XP\' 0개 · 저장 토스트 없음(저장됨은 날짜 줄에)', (await home()).html.indexOf('XP') < 0 && (await P(() => __toasts.length)) === 0, (await P(() => __toasts.join(' | '))));

  /* ⑤ 날짜 ◀▶ */
  let nv = await navSt();
  t('기본 날짜(다음 수업일)에서 ▶ 는 막힘 · ◀ 는 열림', !nv.next && nv.prev, JSON.stringify(nv));
  await P(() => { hwNav(1); });
  t('▶ 눌러도 다음 수업일 너머로 안 감 · 안내 토스트', (await P(() => HW.sel)) === info.D0 && (await P(() => __toasts.some((m) => /다음 수업일까지만/.test(m)))));
  await P(() => { __toasts.length = 0; hwNav(-1); });
  nv = await navSt(); rw = await rows();
  t('◀ → 지난 수업일 「' + labOf(info.D1) + '」 · 「지난 수업」 안내 · 그 날짜 눈금은 비어 있음(날짜마다 따로) · 0%', (await P(() => HW.sel)) === info.D1 && nv.lab.indexOf(labOf(info.D1)) === 0 && (info.D1 === info.today ? true : /지난 수업/.test(nv.lab)) && nv.next && rw.every((x) => x.onCnt === 0) && (await pct()).n === 0, JSON.stringify(nv) + ' ' + JSON.stringify(rw));
  await P(() => { __ups.length = 0; hwSelfSet('w', 60); });
  await pg.waitForTimeout(30);
  sv = await saved();
  t('지난 수업일에 오답 60 → byDate[' + info.D1 + '].w=60 · 다음 수업일 값(100%)은 그대로 · hw_self 만 씀', sv.byDate[info.D1] && sv.byDate[info.D1].w === 60 && sv.byDate[info.D1].p === 0 && sv.byDate[info.D0].a === 100 && (await P(() => __ups.every((u) => u.key === 'hw_self_AAA111'))), JSON.stringify(sv));
  const back = await P(() => { let n = 0; for (let i = 0; i < 10; i++) { const b = HW.sel; hwNav(-1); if (HW.sel === b) break; n++; } return { n, sel: HW.sel, min: __add(__today, -7), prev: !document.querySelectorAll('#hw-home .hwk-dt button')[0].disabled }; });
  t('◀ 를 계속 눌러도 오늘-7일 안 수업일까지만 · 그 끝에서 ◀ 막힘', back.sel >= back.min && back.sel < info.D0 && !back.prev, JSON.stringify(back));
  await P(() => { for (let i = 0; i < 10; i++) hwNav(1); });
  t('▶ 로 다음 수업일까지 돌아옴 · 100% 그대로', (await P(() => HW.sel)) === info.D0 && (await pct()).n === 100);

  /* ⑥ 기록 줄 5칸 */
  r = await setup({ on: true }, { oldSelf: true });
  let hs = await hist();
  const CD = info.CD;
  t('기록 줄 = 반 요일표로 거꾸로 센 수업일 5개(마지막 = 다음 수업일) · 날짜 글자', hs.length === 5 && JSON.stringify(hs.map((x) => x.d)) === JSON.stringify(CD.map(md)) && (await P(() => JSON.stringify(hwHistDates()))) === JSON.stringify(CD), JSON.stringify(hs) + ' want ' + CD.join(','));
  t('선생님 확인값 있으면 파란색 (CD[3] 80 — 내 값 100 보다 선생님 값이 이김 · CD[1] 65)', hs[3].v === '80' && hs[3].blue && hs[1].v === '65' && hs[1].blue, JSON.stringify(hs));
  t('선생님 값 없고 내 값만 → 검정 (CD[0] 60) · 둘 다 없으면 「—」 (CD[2] · CD[4]=다음 수업일 아직 안 누름)', hs[0].v === '60' && !hs[0].blue && !hs[0].empty && hs[2].v === '—' && hs[2].empty && hs[4].v === '—' && hs[4].sel, JSON.stringify(hs));
  await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 100); hwSelfSet('w', 100); hwAhaNone(true); });
  await pg.waitForTimeout(30);
  hs = await hist();
  t('다음 수업일에 누르면 그 칸이 내 종합값(100 · 검정)으로 바뀜 · 안내 「파란 숫자 = 선생님이 확인한 값」', hs[4].v === '100' && !hs[4].blue && /파란 숫자 = 선생님이 확인한 값/.test((await home()).txt), JSON.stringify(hs[4]));
  t('옛 0/100 저장값(v2-155)도 그대로 읽힘 — CD[3] 내 값 {100,100,100,100} → hwPct 100 · hwSelfOf 호환', (await P((d) => hwPct(hwSelfOf(d)), CD[3])) === 100);
  const nh = await setup({ on: true }, { oldSelf: true, noDays: true });
  hs = await hist();
  t('요일표 없음 → 기록 줄 = hw_self·hw_teach 에 적힌 날짜 + 오늘(적힌 날짜 3개 + 오늘 = 4칸 · 최대 5) · 날짜 오름차순 · 마지막 = 오늘', hs.length === 4 && hs[3].d === md(info.today) && hs[2].blue && hs[0].v === '60' && (await P(() => { const ds = hwHistDates(); return ds.slice().sort().join() === ds.join() && ds.indexOf(__today) === ds.length - 1; })), JSON.stringify(hs));
  const nt = await setup({ on: true }, { oldSelf: true, noTeach: true });
  hs = await hist();
  t('hw_teach 가 아예 없으면 파란 숫자 없음 · 내 값만 검정 (CD[3] 100 · CD[0] 60)', hs.every((x) => !x.blue) && hs[3].v === '100' && hs[0].v === '60', JSON.stringify(hs));

  /* ⑦ 홈에 「이번 숙제」 목록 없음 · todo_ 안 씀 */
  r = await setup({ on: true }, { oldSelf: true });
  t('홈 카드에 「이번 숙제」 목록·학습지 줄·「학습지 채점으로 가기」 없음 (숙제 카드 2장이 있어도)', !/이번 숙제/.test(r.txt) && (await P(() => document.querySelectorAll('#hw-home .hwc, #hw-home .hwd-sub, #hw-home .hwc-go, #hw-home .hws').length)) === 0 && (await P(() => TD.items.filter((i) => i.hw).length)) === 2, r.txt);
  t('todo_AAA111 · todo_st_AAA111 은 끝까지 한 번도 안 씀', await P(() => __ups.every((u) => u.key === 'hw_self_AAA111') && __store['todo_AAA111'].items.length === 3 && __store['todo_st_AAA111']['a:ws:7001'].st === 'got'));

  /* 📅 주간계획표 🔒 선생님 줄 그대로 */
  await P(() => go('screen-home'));
  const week = await P(async () => {
    await wplLoad(true); WP.tab = 'this'; go('screen-wplan'); wplRender();
    const strip = document.querySelector('#wp-body .wpc-hw');
    return { has: !!strip, cols: strip ? strip.querySelectorAll('.c').length : 0, legend: (document.querySelector('#wp-body .wpc-lg') || {}).innerText || '', ups: __ups.filter((u) => u.key !== 'hw_self_AAA111').map((u) => u.key) };
  });
  t('📅 주간계획표 🔒 선생님 줄(7칸)·범례 그대로 (D0 가 이번 주 안일 때) · 주간계획표 저장 안 함', (() => { const mon = (() => { const d = new Date(info.today + 'T00:00:00Z'); const k = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); })(); const inWeek = info.D0 >= mon && info.D0 <= (() => { const d = new Date(mon + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })(); return (!inWeek || (week.has && week.cols === 7)) && /🔒 선생님 숙제/.test(week.legend) && week.ups.indexOf('wplan_AAA111') < 0; })(), JSON.stringify(week));

  /* ES5 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-158 hwself-begin */'), i1 = src.indexOf('/* ★ v2-158 hwself-end */');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 있음 · v2-155 블록은 바뀜 · v2-153 블록은 그대로', i0 > 0 && i1 > i0 && src.indexOf('/* ★ v2-155 hwself-begin */') < 0 && src.indexOf('/* ★ v2-153 hw-begin */') > 0 && src.indexOf('/* ★ v2-153 hw-end */') > i1);
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음 · \'XP\' 글자 없음', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk) && !/\+5 XP|XP\b(?! 글자)/.test(blk.replace(/XP 글자·토스트 없음/g, '')), '');
  t('STU_VER 갱신 · 버전 로그에 v2-158 줄', /v2-158 \(2026-11-05\)/.test(src) && src.indexOf("var STU_VER = 'v2-158'") > 0);
  t('고정 주소 student_v1.html 은 그대로(v2-158 아님)', !fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-158'") < 0);
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'bell-empty', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-wplan', 'screen-bookscore', 'screen-aha', 'hm-notice', 'td4-date'].every((id) => !!document.getElementById(id))));
  t('기능 스위치 없을 때 다른 기능(sfOn)은 예전처럼 켜짐 · 🗂 보드·숙제 체크는 잠김', await P(() => { SF.cfg = null; hwHomeUpdate(); return sfOn('retry') === true && tdOpen() === false && hwOpen() === false && document.getElementById('hw-home').style.display === 'none'; }));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));

  if (process.env.SHOT) {
    try {
      await setup({ on: true }, { oldSelf: true });
      await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 60); hwSelfSet('w', 30); hwAhaNone(true); go('screen-home'); window.scrollTo(0, 0); document.getElementById('hw-home').scrollIntoView(); });
      await pg.waitForTimeout(400); await pg.screenshot({ path: process.env.SHOT }); console.log('📸 ' + process.env.SHOT);
    } catch (e) { console.log('스크린샷 실패', e.message); }
  }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
