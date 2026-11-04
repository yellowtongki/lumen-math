#!/usr/bin/env node
/* 학생앱 v2-155 검사 — 📚 「숙제 체크」 날짜 단위 4칸 (docs/hw_dispatch_contract.md §9 최소판 §9-1·§9-2)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111 · 반 T5 화·목)
 *   ① 스위치 stu_features.hw 꺼짐/학년 제외 → 없음 · 켜짐 + 숙제 카드 없음 → 4칸 카드 보임
 *   ② 수업일 계산 — 요일표 있음(다음 화·목) / 없음(오늘)
 *   ③ 토글 → hw_self_<코드> 에만 upsert(todo_st_·todo_ 안 씀) · byDate[수업일] {p,c,w,a} 0/100 · at · upd · 되돌리기
 *   ④ 날짜 ◀▶ — 지난 수업일(7일 안)로 가서 누르면 그 날짜에 저장 · 7일 밖·다음 수업일 너머로는 못 감
 *   ⑤ 「이번 숙제」 읽기 전용 — 숙제 카드 줄(토글 없음) · 「숙제」 태그 학습지만(HOMEWORK · 7일 안) · 맞은 수 · 「학습지 채점으로 가기」
 *   ⑥ v2-153 카드 단위 토글은 화면에 없음 · 📅 주간계획표 🔒 선생님 줄 그대로 · ES5 · 홈·탭 회귀 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2154.js [student_v2-155.html] */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-155.html'));
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
  /* 우리 반 T5 = 화(2)·목(4) → 다음 수업일 D0 (오늘이 화·목이면 오늘) · 그 앞 수업일 D1 (오늘-7 안) */
  let D0 = today; for (let i = 0; i < 7; i++) { if ([2, 4].indexOf(dow(add(today, i))) >= 0) { D0 = add(today, i); break; } }
  let D1 = null; for (let i = 1; i <= 7; i++) { const d = add(D0, -i); if (d < add(today, -7)) break; if ([2, 4].indexOf(dow(d)) >= 0) { D1 = d; break; } }
  window.__D0 = D0; window.__D1 = D1;
  /* 선생님이 쓴 카드(todo_<코드>) — 학생앱은 읽기만. 마감은 D0(다음 수업일) */
  window.__todo = { items: [
    { id: 'hw:' + D0 + ':B1', kind: 'book', title: '개념+유형 중2(상)', book: '개념+유형 중2(상)', bookId: 'B1', from: 12, to: 15, n: 38, due: D0, src: 'hw', hw: true },
    { id: 'hw:p:1', kind: 'etc', title: '📄 일차함수 프린트', print: true, n: 15, due: D0, src: 'hw', hw: true },
    { id: 'a:ws:7001', kind: 'ws', title: '오답 쌍둥이 10/31', wid: 7001, n: 12, due: D0, src: 'auto:ws', hw: true },   /* 학습지 줄과 겹침 → 한 번만 */
    { id: 'hw:' + add(D0, 9) + ':B1', kind: 'book', title: '개념+유형 중2(상)', bookId: 'B1', from: 16, to: 18, n: 30, due: add(D0, 9), src: 'hw', hw: true },   /* 먼 미래 — 안 보임 */
    { id: 'hw:' + add(D0, -9) + ':B1', kind: 'book', title: '개념+유형 중2(상)', bookId: 'B1', from: 1, to: 2, n: 9, due: add(D0, -9), src: 'hw', hw: true },   /* 7일 넘게 지남 — 안 보임 */
    { id: 'm:1', kind: 'etc', title: '숙제 아닌 카드', due: D0, src: 'manual' } ] };
  store['todo_st_AAA111'] = { 'a:ws:7001': { st: 'got', at: '2026-11-01T10:00:00.000Z', photo: '' }, upd: '2026-11-01T10:00:00.000Z' };
  /* 내 학습지 목록 — 숙제 태그 2개(7일 안) · 숙제 태그지만 8일 전 · 다른 태그 */
  window.__wsq = { list: [
    { swId: 9001, wid: 7001, title: '오답 쌍둥이 10/31', date: add(today, -1), status: '풀이 중', n: 12, o: 0, x: 0, q: 0, tag: 'HOMEWORK', problems: [{ wpId: 101, num: '1' }, { wpId: 102, num: '2' }, { wpId: 103, num: '3' }] },
    { swId: 9002, wid: 7002, title: '유형 점검 11/1', date: add(today, -2), status: '학습완료', n: 10, o: 8, x: 2, q: 0, tag: 'HOMEWORK' },
    { swId: 9003, wid: 7003, title: '옛 숙제 학습지', date: add(D0, -8), status: '학습완료', n: 10, o: 5, x: 5, q: 0, tag: 'HOMEWORK' },
    { swId: 9004, wid: 7004, title: '주간테스트 11/2', date: add(today, -1), status: '학습완료', n: 20, o: 15, x: 5, q: 0, tag: 'WEEKLY_TEST' } ] };
  store['mf_wsq_AAA111'] = JSON.parse(JSON.stringify(window.__wsq));
  store['mf_swb_AAA111'] = { books: [ { bid: 'B1', title: '개념+유형 중2(상)', pages: [ { pid: 5012, wpid: 'w12', page: 12 }, { pid: 5013, wpid: 'w13', page: 13 } ] } ] };
  store['hw_scores_AAA111'] = { items: { 'ws_9001_101': { r: 'O', a: '3' }, 'ws_9001_102': { r: 'X', a: '5' } } };
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
    if (o.noTodo) delete __store['todo_AAA111']; else __store['todo_AAA111'] = JSON.parse(JSON.stringify(__todo));
    if (o.noDays) delete __store['lumen_group_days']; else if (o.futureDays) __store['lumen_group_days'] = { T5: [(__dow(__today) + 2) % 7] }; else __store['lumen_group_days'] = { T5: [2, 4], T3: [1, 3, 5] };
    if (o.resetSelf) delete __store['hw_self_AAA111'];
    if (o.noWs) delete __store['mf_wsq_AAA111']; else if (window.__wsq) __store['mf_wsq_AAA111'] = JSON.parse(JSON.stringify(__wsq));
    TD.loaded = false; TD.busy = false; TD.items = []; TD.st = {}; HW.bkReq = false; BK.loaded = false;
    HW.loaded = false; HW.busy = false; HW.self = null; HW.days = null; HW.sel = null; if (window.WP) WP.days = null; if (window.CAL) CAL.data = null;
    __ups.length = 0;
    await hwLoad(true); await tdLoad(true); await bkLoad(true); hwHomeUpdate(); await new Promise((r) => setTimeout(r, 50)); tdHomeUpdate();
    const el = document.getElementById('hw-home');
    return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' '), ups: __ups.map((u) => u.key) };
  }, [hwCfg, o]);
  const home = () => P(() => { const el = document.getElementById('hw-home'); return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' ') }; });
  const rows = () => P(() => Array.prototype.map.call(document.querySelectorAll('#hw-home .hwd-row'), (b) => ({ on: b.classList.contains('on'), nm: b.querySelector('b').textContent, xp: b.querySelector('.xp').textContent, ck: b.querySelector('.ck').textContent })));
  const navSt = () => P(() => { const bs = document.querySelectorAll('#hw-home .hwd-nav button'); return { prev: !bs[0].disabled, next: !bs[1].disabled, lab: document.querySelector('#hw-home .hwd-nav .dt').innerText.replace(/\s+/g, ' ') }; });
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const md = (s) => Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10));
  const info = await P(() => ({ today: __today, D0: __D0, D1: __D1 }));
  const labOf = (d) => DOW[new Date(d + 'T00:00:00Z').getUTCDay()] + ' ' + md(d) + ' 수업';
  console.log('   (오늘 ' + info.today + ' · 다음 수업일 ' + info.D0 + ' · 그 앞 수업일 ' + info.D1 + ')');

  t('버전 v2-155', (await P(() => STU_VER)) === 'v2-155');
  t('새 함수 있음 (hwLoad·hwSelfToggle·hwNav·hwClassDate·hwWsFor·hwGoSw) · v2-153 함수도 남아 있음', await P(() => ['hwLoad', 'hwSelfToggle', 'hwNav', 'hwClassDate', 'hwWsFor', 'hwGoSw', 'hwSelfOf', 'hwOpen', 'hwHomeUpdate', 'hwToggle', 'hwWeekStripHtml'].every((f) => typeof window[f] === 'function')));
  t('홈 첫 화면 「📌 오늘 할 일」(.td4) 바로 아래에 #hw-home 그대로', await P(() => { const a = document.querySelector('#screen-home .td4'); const el = document.getElementById('hw-home'); return !!a && a.nextElementSibling === el && !el.closest('#bell-sheet'); }));

  /* ① 스위치 */
  let r = await setup(null, { noTodo: true });
  t('스위치 없음(기본 꺼짐) → 카드 없음', r.disp === 'none' && r.html === '', r.disp);
  r = await setup({ on: false }, { noTodo: true });
  t('hw.on=false → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['중2'] }, { noTodo: true });
  t('hw 켜졌지만 내 학년(중2) 제외 → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['초6'] }, { noTodo: true, resetSelf: true });
  t('hw 켜짐 + 숙제 카드 없음 → 📚 숙제 체크 카드 보임 · 4칸(풀이·채점·오답·아하노트) · 0/4', r.disp === 'block' && /📚 숙제 체크/.test(r.txt) && /0\/4/.test(r.txt) && JSON.stringify((await rows()).map((x) => x.nm)) === JSON.stringify(['풀이', '채점', '오답', '아하노트']), r.txt.slice(0, 160));
  t('카드 없어도 「숙제」 태그 학습지 줄은 보임(2개) · 불러오기만 하고 저장(upsert)은 없음', /이번 숙제/.test(r.txt) && (await P(() => document.querySelectorAll('#hw-home .hwc.ws').length)) === 2 && !(await P(() => !!document.querySelector('#hw-home .hwd-empty'))) && r.ups.length === 0, r.ups.join(',') + ' ' + r.txt.slice(0, 200));
  r = await setup({ on: true }, { noTodo: true, noWs: true });
  t('카드도 학습지도 없음 → 4칸은 그대로 · 「이번 숙제」 자리엔 안내 글', r.disp === 'block' && (await rows()).length === 4 && (await P(() => !!document.querySelector('#hw-home .hwd-empty'))) && (await P(() => document.querySelectorAll('#hw-home .hwc').length)) === 0, r.txt.slice(0, 200));

  /* ② 수업일 계산 */
  t('수업일 = 반 요일표(T5 화·목)로 다음 수업일 「' + labOf(info.D0) + '」 (오늘이 수업일이면 오늘)', (await P(() => hwClassDate())) === info.D0 && r.txt.indexOf('📚 숙제 체크 · ' + labOf(info.D0)) >= 0, r.txt.slice(0, 80));
  const nd = await setup({ on: true }, { noTodo: true, noDays: true });
  t('요일표 없음 → 수업일 = 오늘 「' + labOf(info.today) + '」', (await P(() => hwClassDate())) === info.today && nd.txt.indexOf('📚 숙제 체크 · ' + labOf(info.today)) >= 0, nd.txt.slice(0, 80));

  const fd = await setup({ on: true }, { noTodo: true, futureDays: true, resetSelf: true });
  const fdSt = await P(() => ({ cd: hwClassDate(), want: __add(__today, 2), prevWant: __add(__today, -5), prev: (() => { hwNav(-1); return HW.sel; })(), prevLab: document.querySelector('#hw-home .hwd-nav .dt').innerText.replace(/\s+/g, ' ') }));
  t('오늘이 수업일이 아니면 수업일 = 오늘+2(요일표의 다음 수업일) · 「다음 수업」 안내 · ◀ → 그 앞 수업일(오늘-5)', fdSt.cd === fdSt.want && fd.txt.indexOf('📚 숙제 체크 · ' + labOf(fdSt.want)) >= 0 && /다음 수업/.test(fd.txt) && fdSt.prev === fdSt.prevWant && /지난 수업 · 5일 전/.test(fdSt.prevLab), JSON.stringify(fdSt) + ' ' + fd.txt.slice(0, 120));

  /* ③ 토글 → hw_self_ 에만 */
  r = await setup({ on: true }, { resetSelf: true });
  await P(() => { __ups.length = 0; __toasts.length = 0; });
  await P(async () => { await hwSelfToggle('p'); });
  let ups = await P(() => __ups.map((u) => u.key + '|' + (u.opt && u.opt.onConflict)));
  let saved = await P(() => __store['hw_self_AAA111']);
  t('풀이 누름 → hw_self_AAA111 에만 upsert(onConflict key) · todo_st_·todo_ 는 안 씀', ups.length === 1 && ups[0] === 'hw_self_AAA111|key', ups.join(','));
  t('저장값 byDate[' + info.D0 + ']={p:100,c:0,w:0,a:0,at} · upd 있음', saved && saved.byDate && saved.byDate[info.D0] && saved.byDate[info.D0].p === 100 && saved.byDate[info.D0].c === 0 && saved.byDate[info.D0].w === 0 && saved.byDate[info.D0].a === 0 && !!saved.byDate[info.D0].at && !!saved.upd, JSON.stringify(saved));
  let rw = await rows();
  t('화면: 풀이 칸 on · ✓ · 「+5 XP」 · 다른 칸 「대기」 · 1/4 · 토스트 +5 XP', rw[0].on && rw[0].ck === '✓' && rw[0].xp === '+5 XP' && !rw[1].on && rw[1].xp === '대기' && /1\/4/.test((await home()).txt) && (await P(() => __toasts.some((m) => /\+5 XP/.test(m)))), JSON.stringify(rw));
  await P(async () => { await hwSelfToggle('p'); });
  saved = await P(() => __store['hw_self_AAA111']);
  t('다시 누르면 되돌림 → p=0 · 토스트 「되돌렸어요」', saved.byDate[info.D0].p === 0 && (await P(() => __toasts.some((m) => /되돌렸어요/.test(m)))), JSON.stringify(saved));
  await P(async () => { await hwSelfToggle('p'); await hwSelfToggle('c'); await hwSelfToggle('w'); await hwSelfToggle('a'); });
  saved = await P(() => __store['hw_self_AAA111']);
  rw = await rows();
  t('넷 다 누름 → {100,100,100,100} · 4/4 · 네 칸 모두 on', saved.byDate[info.D0].p === 100 && saved.byDate[info.D0].c === 100 && saved.byDate[info.D0].w === 100 && saved.byDate[info.D0].a === 100 && /4\/4/.test((await home()).txt) && rw.every((x) => x.on), JSON.stringify(saved));
  t('채점 칸은 날짜 단위라 자동 ✓ 없이 학생이 누른다 (c 저장값 100)', saved.byDate[info.D0].c === 100);

  /* ④ 날짜 ◀▶ */
  let nv = await navSt();
  t('기본 날짜(다음 수업일)에서 ▶ 는 막힘 · ◀ 는 열림', !nv.next && nv.prev, JSON.stringify(nv));
  await P(() => { hwNav(1); });
  t('▶ 눌러도 다음 수업일 너머로 안 감 · 토스트', (await P(() => HW.sel)) === info.D0 && (await P(() => __toasts.some((m) => /다음 수업일까지만/.test(m)))));
  await P(() => { hwNav(-1); });
  nv = await navSt();
  t('◀ → 지난 수업일 「' + labOf(info.D1) + '」 · 「지난 수업」 안내 · ▶ 열림', (await P(() => HW.sel)) === info.D1 && nv.lab.indexOf(labOf(info.D1)) >= 0 && (info.D1 === info.today ? true : /지난 수업/.test(nv.lab)) && nv.next, JSON.stringify(nv) + ' sel=' + (await P(() => HW.sel)));
  rw = await rows();
  t('지난 수업일 칸은 비어 있음(날짜마다 따로)', rw.every((x) => !x.on), JSON.stringify(rw));
  await P(async () => { __ups.length = 0; await hwSelfToggle('w'); });
  saved = await P(() => __store['hw_self_AAA111']);
  t('지난 수업일에 오답 누름 → byDate[' + info.D1 + '].w=100 · 다음 수업일 값(4/4)은 그대로', saved.byDate[info.D1] && saved.byDate[info.D1].w === 100 && saved.byDate[info.D1].p === 0 && saved.byDate[info.D0].a === 100 && (await P(() => __ups.every((u) => u.key === 'hw_self_AAA111'))), JSON.stringify(saved));
  /* 7일 밖으로는 못 감 */
  const back = await P(() => { let n = 0; for (let i = 0; i < 10; i++) { const b = HW.sel; hwNav(-1); if (HW.sel === b) break; n++; } return { n, sel: HW.sel, min: __add(__today, -7), prev: !document.querySelectorAll('#hw-home .hwd-nav button')[0].disabled }; });
  t('◀ 를 계속 눌러도 오늘-7일 안 수업일까지만 · 그 끝에서 ◀ 막힘', back.sel >= back.min && back.sel < info.D0 && !back.prev, JSON.stringify(back));
  await P(() => { for (let i = 0; i < 10; i++) hwNav(1); });
  t('▶ 로 다음 수업일까지 돌아옴 · 4/4 그대로', (await P(() => HW.sel)) === info.D0 && /4\/4/.test((await home()).txt));

  /* ⑤ 「이번 숙제」 읽기 전용 */
  r = await home();
  const cnt = await P(() => ({ hwc: document.querySelectorAll('#hw-home .hwc').length, ws: document.querySelectorAll('#hw-home .hwc.ws').length, book: document.querySelectorAll('#hw-home .hwc.book').length, etc: document.querySelectorAll('#hw-home .hwc.etc').length, hws: document.querySelectorAll('#hw-home .hws').length, go: document.querySelectorAll('#hw-home .hwc-go').length }));
  t('숙제 카드 줄 — 📗 교재 p.12~15 · 38문항 · ✏️ 프린트 15문항 (먼 미래·7일 넘게 지난 것·숙제 아닌 카드 없음)', cnt.book === 1 && cnt.etc === 1 && /📗\s*개념\+유형 중2\(상\)\s*p\.12~15 · 38문항/.test(r.txt) && /✏️\s*일차함수 프린트\s*프린트 · 15문항/.test(r.txt) && !/p\.16~18/.test(r.txt) && !/p\.1~2/.test(r.txt) && !/숙제 아닌 카드/.test(r.txt), r.txt);
  t('카드 줄은 읽기 전용 — 카드 단위 4칸(.hws) 없음', cnt.hws === 0, 'hws=' + cnt.hws);
  t('학습지 줄 — 「숙제」 태그 7일 안 2개만 (주간테스트 태그·8일 전 숙제 제외) · 카드와 겹치는 7001 은 한 번만', cnt.ws === 2 && /오답 쌍둥이 10\/31/.test(r.txt) && /유형 점검 11\/1/.test(r.txt) && !/주간테스트/.test(r.txt) && !/옛 숙제 학습지/.test(r.txt) && (r.txt.match(/오답 쌍둥이 10\/31/g) || []).length === 1, r.txt);
  t('학습지 줄 — n문항 · 맞은 수 ◯/✗ (앱 채점 기록 ◯ 1 ✗ 1 · 매쓰플랫 ◯ 8 ✗ 2) · 「학습지 채점으로 가기」 2개', /12문항 · ◯ 1 ✗ 1/.test(r.txt) && /10문항 · ◯ 8 ✗ 2/.test(r.txt) && cnt.go === 2, r.txt);
  await P(() => { __gos.length = 0; });
  await P(async () => { await hwGoSw(9002); });
  t('「학습지 채점으로 가기」 → 학습지 채점 화면(screen-bookq) · BK.mode ws · swId 9002', await P(() => __gos.indexOf('screen-bookq') >= 0 && BK.mode === 'ws' && BK.ws && BK.ws.swId === 9002), await P(() => __gos.join(',')));
  t('todo_AAA111 · todo_st_AAA111 은 끝까지 한 번도 안 씀', await P(() => __ups.every((u) => u.key === 'hw_self_AAA111') && __store['todo_AAA111'].items.length === 6 && __store['todo_st_AAA111']['a:ws:7001'].st === 'got'));

  /* ⑥ 주간계획표 🔒 선생님 줄 그대로 */
  await P(() => go('screen-home'));
  const week = await P(async () => {
    await wplLoad(true); WP.tab = 'this'; go('screen-wplan'); wplRender();
    const strip = document.querySelector('#wp-body .wpc-hw');
    return { has: !!strip, cols: strip ? strip.querySelectorAll('.c').length : 0, legend: (document.querySelector('#wp-body .wpc-lg') || {}).innerText || '', ups: __ups.filter((u) => u.key !== 'hw_self_AAA111').map((u) => u.key) };
  });
  t('📅 주간계획표 🔒 선생님 줄(7칸)·범례 그대로 (D0 가 이번 주 안일 때) · 주간계획표 저장 안 함', (() => { const mon = (() => { const d = new Date(info.today + 'T00:00:00Z'); const k = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - k); return d.toISOString().slice(0, 10); })(); const inWeek = info.D0 >= mon && info.D0 <= (() => { const d = new Date(mon + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); return d.toISOString().slice(0, 10); })(); return (!inWeek || (week.has && week.cols === 7)) && /🔒 선생님 숙제/.test(week.legend) && week.ups.indexOf('wplan_AAA111') < 0; })(), JSON.stringify(week));

  /* ⑦ ES5 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-155 hwself-begin */'), i1 = src.indexOf('/* ★ v2-155 hwself-end */');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 있음 · v2-153 블록도 그대로', i0 > 0 && i1 > i0 && src.indexOf('/* ★ v2-153 hw-begin */') > 0 && src.indexOf('/* ★ v2-153 hw-end */') > i1);
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk), '');
  t('STU_VER 갱신 · 버전 로그에 v2-155 줄', /v2-155 \(2026-11-03\)/.test(src) && src.indexOf("var STU_VER = 'v2-155'") > 0);
  t('고정 주소 student_v1.html 은 그대로(v2-155 아님)', !fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-155'") < 0);
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'bell-empty', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-wplan', 'screen-bookscore', 'screen-aha'].every((id) => !!document.getElementById(id))));
  t('기능 스위치 없을 때 다른 기능(sfOn)은 예전처럼 켜짐 · 🗂 보드·숙제 체크는 잠김', await P(() => { SF.cfg = null; hwHomeUpdate(); return sfOn('retry') === true && tdOpen() === false && hwOpen() === false && document.getElementById('hw-home').style.display === 'none'; }));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  if (process.env.SHOT) { try { await P(async () => { SF.cfg = { hw: { on: true } }; __store['todo_AAA111'] = JSON.parse(JSON.stringify(__todo)); TD.loaded = false; await tdLoad(true); HW.sel = null; hwHomeUpdate(); go('screen-home'); window.scrollTo(0, 0); document.getElementById('hw-home').scrollIntoView(); }); await pg.waitForTimeout(300); await pg.screenshot({ path: process.env.SHOT }); console.log('📸 ' + process.env.SHOT); } catch (e) { console.log('스크린샷 실패', e.message); } }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
