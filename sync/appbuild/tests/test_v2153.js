#!/usr/bin/env node
/* 학생앱 v2-153 검사 — 📌 「오늘 숙제」 카드 + 📅 주간계획표 「🔒 선생님」 줄 (docs/hw_dispatch_contract.md §2-2 · §3 의 3·4)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111)
 *   ① 스위치 stu_features.hw 꺼짐/학년 제외 → 카드 없음 · 켜짐 → 오늘·마감 지난 카드만(미래·확인 끝·숙제 아닌 카드는 빼고)
 *   ② 토글 → todo_st_<코드> 에만 upsert(todo_<코드> 는 안 씀) · hw {p,c,w,a} 0/100 · hat · st 규칙(하나→doing · 넷→done · 안 내림)
 *   ③ 채점 자동 ✓ — 학습지(hw_scores ws_ 기록 · 매쓰플랫 학습완료) · 교재(그 쪽 pid 기록) · 자동 ✓ 는 저장 안 함 · 눌러도 안 풀림
 *   ④ 📅 주간계획표 「🔒 선생님」 줄 (날짜 칸 · 읽기만) · 스위치 꺼지면 없음
 *   ⑤ 새 코드 ES5(템플릿 리터럴·화살표·let/const 없음) · 홈·탭 회귀 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2152.js [student_v2-153.html] */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-153.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* 가짜 Supabase — lumen_store 를 흉내 낸다. in()/eq() 로 고른 키만 돌려주고, upsert 는 적어 둔다 */
const MOCK = () => {
  window.__store = {}; window.__ups = []; window.__gos = []; window.__toasts = [];
  const store = window.__store;
  window.sb = { from(tbl) { const b = { f: {}, op: 'select', select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, gte() { return b; }, lte() { return b; }, is() { return b; }, or() { return b; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { let keys = Object.keys(store); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.length ? { key: keys[0], value: store[keys[0]] } : null, error: null }); },
    upsert(row) { __ups.push({ tbl, key: row.key, value: JSON.parse(JSON.stringify(row.value)) }); if (tbl === 'lumen_store') store[row.key] = row.value; return Promise.resolve({ error: null }); },
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
  window.__today = today; window.__add = add;
  /* 선생님이 쓴 카드(todo_<코드>) — 학생앱은 읽기만 */
  store['todo_AAA111'] = { items: [
    { id: 'hw:' + today + ':B1', kind: 'book', title: '개념+유형 중2(상)', book: '개념+유형 중2(상)', bookId: 'B1', from: 12, to: 15, n: 38, due: today, src: 'hw', hw: true },
    { id: 'hw:' + add(today, -2) + ':B1', kind: 'book', title: '개념+유형 중2(상)', book: '개념+유형 중2(상)', bookId: 'B1', from: 40, to: 41, n: 20, due: add(today, -2), src: 'hw', hw: true },
    { id: 'a:ws:7001', kind: 'ws', title: '오답 쌍둥이 10/31', wid: 7001, n: 12, due: today, src: 'auto:ws', hw: true },
    { id: 'a:ws:7002', kind: 'ws', title: '유형 점검 11/1', wid: 7002, n: 10, due: add(today, -1), src: 'auto:ws', hw: true },
    { id: 'hw:p:1', kind: 'etc', title: '📄 일차함수 프린트', print: true, n: 15, due: today, src: 'hw', hw: true },
    { id: 'a:vod:9', kind: 'vod', title: '일차함수 2강', due: today, src: 'auto:vod', hw: true },
    { id: 'hw:' + add(today, 3) + ':B1', kind: 'book', title: '개념+유형 중2(상)', bookId: 'B1', from: 16, to: 18, n: 30, due: add(today, 3), src: 'hw', hw: true },   /* 미래 — 오늘 숙제엔 없고 주간계획표엔 보임 */
    { id: 'hw:' + add(today, -3) + ':B1', kind: 'book', title: '개념+유형 중2(상)', bookId: 'B1', from: 1, to: 2, n: 9, due: add(today, -3), src: 'hw', hw: true, tst: 'ok', thw: { p: 100, c: 100, w: 100, a: 100 } },   /* 선생님 확인 끝 */
    { id: 'm:1', kind: 'etc', title: '숙제 아닌 카드', due: today, src: 'manual' } ] };
  store['todo_st_AAA111'] = { 'a:ws:7002': { st: 'got', at: '2026-11-01T10:00:00.000Z', photo: '' }, upd: '2026-11-01T10:00:00.000Z' };
  /* 내 학습지 목록 · 교재 쪽 목록 · 앱 채점 기록 */
  store['mf_wsq_AAA111'] = { list: [
    { swId: 9001, wid: 7001, title: '오답 쌍둥이 10/31', date: add(today, -2), status: '풀이 중', n: 12, o: 0, x: 0, q: 0, tag: 'HOMEWORK', problems: [{ wpId: 101, num: '1' }, { wpId: 102, num: '2' }, { wpId: 103, num: '3' }] },
    { swId: 9002, wid: 7002, title: '유형 점검 11/1', date: add(today, -1), status: '학습완료', n: 10, o: 8, x: 2, q: 0, tag: 'HOMEWORK' } ] };
  store['mf_swb_AAA111'] = { books: [ { bid: 'B1', title: '개념+유형 중2(상)', pages: [ { pid: 5012, wpid: 'w12', page: 12 }, { pid: 5013, wpid: 'w13', page: 13 }, { pid: 5040, wpid: 'w40', page: 40 }, { pid: 5041, wpid: 'w41', page: 41 } ] } ] };
  store['hw_scores_AAA111'] = { items: { 'ws_9001_101': { r: 'O', a: '3' }, 'ws_9001_102': { r: 'X', a: '5' }, '5013_777': { r: 'O', a: '1' } } };
  store['lumen_group_days'] = { T5: [2, 4] };
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
  /* 스위치를 바꾸고 다시 불러온 뒤 홈 카드를 그린다 */
  const setup = (hwCfg, todoCfg) => P(async ([hw, todo]) => {
    SF.cfg = {}; if (hw) SF.cfg.hw = hw; if (todo) SF.cfg.todo = todo;
    TD.loaded = false; TD.busy = false; TD.items = []; TD.st = {}; HW.bkReq = false; BK.loaded = false;
    await tdLoad(true); await bkLoad(true); hwHomeUpdate(); await new Promise((r) => setTimeout(r, 50)); tdHomeUpdate();
    const el = document.getElementById('hw-home');
    return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' ') };
  }, [hwCfg, todoCfg]);
  const home = () => P(() => { const el = document.getElementById('hw-home'); return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' ') }; });

  t('버전 v2-153', (await P(() => STU_VER)) === 'v2-153');
  t('새 함수 있음', await P(() => ['hwOpen', 'hwHomeUpdate', 'hwToggle', 'hwGoWs', 'hwWeekStripHtml', 'hwAutoC', 'hwTodayCards'].every((f) => typeof window[f] === 'function')));
  t('홈 첫 화면 「📌 오늘 할 일」(.td4) 바로 아래에 #hw-home (🔔 서랍 아님)', await P(() => { const a = document.querySelector('#screen-home .td4'); const el = document.getElementById('hw-home'); return !!a && a.nextElementSibling === el && !el.closest('#bell-sheet'); }));

  /* ① 스위치 */
  let r = await setup(null, null);
  t('스위치 없음(기본 꺼짐) → 카드 없음', r.disp === 'none' && r.html === '', r.disp);
  r = await setup({ on: false }, null);
  t('hw.on=false → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['중2'] }, null);
  t('hw 켜졌지만 내 학년(중2) 제외 → 카드 없음', r.disp === 'none', r.disp);
  r = await setup({ on: true, off: ['초6'] }, null);
  t('hw 켜짐(할 일 보드는 잠김) → 오늘 숙제 카드 보임 · 🗂 는 그대로 「추후 공개」', r.disp === 'block' && /오늘 숙제/.test(r.txt) && (await P(() => !tdOpen() && document.getElementById('td-home').innerHTML.indexOf('tdb-soon') >= 0)), r.txt.slice(0, 120));
  const n = await P(() => document.querySelectorAll('#hw-home .hwc').length);
  t('오늘·마감 지난 카드 6개 (미래·확인 끝·숙제 아닌 카드는 빼고)', n === 6, 'n=' + n);
  t('목록에 미래 카드·확인 끝 카드·숙제 아닌 카드 없음', !/p\.16~18/.test(r.txt) && !/p\.1~2/.test(r.txt) && !/숙제 아닌 카드/.test(r.txt), r.txt);
  t('마감 지난 것 — 빨간 「2일 지남」·「1일 지남」, 오늘 것은 「오늘까지」', /2일 지남/.test(r.txt) && /1일 지남/.test(r.txt) && /오늘까지/.test(r.txt) && (await P(() => document.querySelectorAll('#hw-home .hwc-s .late').length)) === 2, r.txt);
  t('마감 빠른 것이 먼저 (2일 지남 → 1일 지남 → 오늘)', (() => { const a = r.txt.indexOf('2일 지남'), b = r.txt.indexOf('1일 지남'), c = r.txt.indexOf('오늘까지'); return a >= 0 && a < b && b < c; })(), r.txt);
  t('📗 교재 카드: 제목 · p.12~15 · 38문항', /📗\s*개념\+유형 중2\(상\)\s*p\.12~15 · 38문항/.test(r.txt), r.txt);
  t('📄 학습지 카드: 제목 · 12문항 · ◯/✗ 수 · 「학습지 채점으로 가기」', /📄\s*오답 쌍둥이 10\/31\s*12문항 · ◯ 1 ✗ 1/.test(r.txt) && (await P(() => document.querySelectorAll('#hw-home .hwc.ws .hwc-go').length)) === 2, r.txt);
  t('✏️ 프린트 카드: 프린트 · 15문항 (학원앱이 붙인 📄 는 떼고)', /✏️\s*일차함수 프린트\s*프린트 · 15문항/.test(r.txt), r.txt);
  t('📺 영상 카드: 4칸 대신 「영상 보기」 안내만', await P(() => { const v = document.querySelector('#hw-home .hwc.vod'); return !!v && !v.querySelector('.hws') && /영상 보기/.test(v.innerText); }));
  t('다른 카드는 4칸(풀이·채점·오답·아하노트)', await P(() => Array.prototype.every.call(document.querySelectorAll('#hw-home .hwc:not(.vod)'), (c) => c.querySelectorAll('.hws').length === 4 && /풀이.*채점.*오답.*아하노트/.test(c.innerText.replace(/\s+/g, ' ')))));

  /* ③ 채점 자동 ✓ */
  const autoOf = (sel) => P((s) => { const c = document.querySelector(s); const b = c && c.querySelectorAll('.hws')[1]; return b ? { auto: b.classList.contains('auto'), ck: b.querySelector('.ck').textContent, xp: b.querySelector('.xp').textContent } : null; }, sel);
  const a1 = await autoOf('#hw-home .hwc.ws');                               /* 7002 (1일 지남 · 학습완료) 가 먼저 */
  const a2 = await P(() => { const cs = document.querySelectorAll('#hw-home .hwc.ws'); const b = cs[1].querySelectorAll('.hws')[1]; return { auto: b.classList.contains('auto'), txt: cs[1].innerText.replace(/\s+/g, ' ') }; });
  t('학습지 (매쓰플랫 「학습완료」 · hw_scores 없음) → 채점 자동 ✓ · 맞은 수 8/10', a1 && a1.auto && a1.ck === '✓' && a1.xp === '자동' && /◯ 8 ✗ 2/.test(r.txt), JSON.stringify(a1));
  t('학습지 (hw_scores 에 ws_9001_ 기록) → 채점 자동 ✓ · ◯ 1 ✗ 1', a2.auto && /◯ 1 ✗ 1/.test(a2.txt), JSON.stringify(a2));
  const bAuto = await P(() => Array.prototype.map.call(document.querySelectorAll('#hw-home .hwc.book'), (c) => ({ t: c.querySelector('.rr').textContent, auto: c.querySelectorAll('.hws')[1].classList.contains('auto') })));
  t('교재 p.12~15 (pid 5013 기록 있음) → 자동 ✓ · p.40~41 (기록 없음) → 안 됨', JSON.stringify(bAuto) === JSON.stringify([{ t: 'p.40~41 · 20문항', auto: false }, { t: 'p.12~15 · 38문항', auto: true }]), JSON.stringify(bAuto));

  /* ② 토글 → todo_st_ 에만 */
  const bookId = await P(() => 'hw:' + __today + ':B1');
  await P(() => { __ups.length = 0; });
  await P(async (id) => { await hwToggle(id, 'p'); }, bookId);
  let ups = await P(() => __ups.map((u) => u.key));
  let saved = await P((id) => __store['todo_st_AAA111'][id], bookId);
  t('풀이 누름 → todo_st_AAA111 에만 upsert (todo_AAA111 은 안 씀)', ups.length === 1 && ups[0] === 'todo_st_AAA111' && ups.indexOf('todo_AAA111') < 0, ups.join(','));
  t('저장값 hw={p:100,c:0,w:0,a:0} · hat 있음 · st doing (자동 ✓ 채점은 저장 안 함)', saved && saved.hw.p === 100 && saved.hw.c === 0 && saved.hw.w === 0 && saved.hw.a === 0 && !!saved.hat && saved.st === 'doing', JSON.stringify(saved));
  t('화면: 풀이 칸 on · 「+5 XP」 글자 · 토스트 +5 XP', await P((id) => { const c = document.querySelector('#hw-home .hwc.book:nth-of-type(1)'); const cs = Array.prototype.filter.call(document.querySelectorAll('#hw-home .hwc.book'), (x) => /p\.12~15/.test(x.innerText)); const b = cs[0].querySelectorAll('.hws')[0]; return b.classList.contains('on') && b.querySelector('.xp').textContent === '+5 XP' && __toasts.some((m) => /\+5 XP/.test(m)); }, bookId));
  t('다른 카드(todo_st 에 있던 a:ws:7002 got)는 그대로 남음', await P(() => { const v = __store['todo_st_AAA111']; return v['a:ws:7002'] && v['a:ws:7002'].st === 'got' && !!v.upd; }));
  /* 자동 ✓ 인 채점 칸은 눌러도 안 풀림 · 저장 없음 */
  await P(() => { __ups.length = 0; });
  await P(async (id) => { await hwToggle(id, 'c'); }, bookId);
  t('자동 ✓ 채점 칸 누르기 → 저장 없음 · 그대로 ✓', (await P(() => __ups.length)) === 0 && (await P((id) => __store['todo_st_AAA111'][id].hw.c, bookId)) === 0);
  /* 오답·아하노트까지 → 넷 다(자동 ✓ 포함) → done */
  await P(async (id) => { await hwToggle(id, 'w'); await hwToggle(id, 'a'); }, bookId);
  saved = await P((id) => __store['todo_st_AAA111'][id], bookId);
  t('풀이·오답·아하노트 + 자동 채점 = 넷 다 → st done', saved.st === 'done' && saved.hw.w === 100 && saved.hw.a === 100, JSON.stringify(saved));
  /* 하나를 되돌려도 st 는 내리지 않는다 */
  await P(async (id) => { await hwToggle(id, 'w'); }, bookId);
  saved = await P((id) => __store['todo_st_AAA111'][id], bookId);
  t('오답을 되돌려도 st 는 done 그대로(안 내림) · hw.w=0', saved.st === 'done' && saved.hw.w === 0, JSON.stringify(saved));
  /* 자동 ✓ 없는 카드(프린트): 넷 다 눌러야 done · 하나만 → doing */
  await P(async () => { await hwToggle('hw:p:1', 'c'); });
  saved = await P(() => __store['todo_st_AAA111']['hw:p:1']);
  t('프린트 카드 채점만 → hw.c=100 · st doing', saved && saved.hw.c === 100 && saved.st === 'doing', JSON.stringify(saved));
  await P(async () => { await hwToggle('hw:p:1', 'p'); await hwToggle('hw:p:1', 'w'); await hwToggle('hw:p:1', 'a'); });
  saved = await P(() => __store['todo_st_AAA111']['hw:p:1']);
  t('프린트 카드 넷 다 → st done · 4/4 단계', saved.st === 'done' && (await home()).txt.indexOf('4/4 단계') >= 0, JSON.stringify(saved));
  t('todo_AAA111 은 끝까지 한 번도 안 씀 · 선생님 카드 그대로', (await P(() => __ups.every((u) => u.key === 'todo_st_AAA111') && __store['todo_AAA111'].items.length === 9 && __store['todo_AAA111'].items.every((it) => !it.hw || !('hat' in it)))));
  /* 「학습지 채점으로 가기」 */
  await P(() => { __gos.length = 0; });
  await P(async () => { await hwGoWs('a:ws:7001'); });
  t('「학습지 채점으로 가기」 → 학습지 채점 화면(screen-bookq) · BK.mode ws · swId 9001', await P(() => __gos.indexOf('screen-bookq') >= 0 && BK.mode === 'ws' && BK.ws && BK.ws.swId === 9001), await P(() => __gos.join(',')));

  /* ④ 📅 주간계획표 「🔒 선생님」 줄 */
  const week = await P(async () => {
    await wplLoad(true); WP.tab = 'this'; go('screen-wplan'); wplRender();
    const strip = document.querySelector('#wp-body .wpc-hw');
    const cols = strip ? Array.prototype.map.call(strip.querySelectorAll('.c'), (c) => c.innerText.replace(/\s+/g, ' ').trim()) : null;
    const mon = PW.thisMon(); const dIdx = PW.dow(__today);
    return { has: !!strip, cols, dIdx, legend: (document.querySelector('#wp-body .wpc-lg') || {}).innerText || '', hdFirst: !!document.querySelector('#wp-body .wpc-hd'), body: !!document.querySelector('#wp-body .wpc-bd'), ups: __ups.filter((u) => u.key !== 'todo_st_AAA111').map((u) => u.key) };
  });
  t('주간계획표에 🔒 선생님 줄(7칸) · 머리와 시간표 사이', week.has && week.cols.length === 7 && week.hdFirst && week.body, JSON.stringify(week).slice(0, 300));
  t('오늘 칸에 📗 38 · 📄 12 · ✏️ 15 · 📺 (아이콘 + 문항 수)', week.has && /📗\s*38/.test(week.cols[week.dIdx]) && /📄\s*12/.test(week.cols[week.dIdx]) && /✏️\s*15/.test(week.cols[week.dIdx]) && /📺/.test(week.cols[week.dIdx]), week.cols && week.cols[week.dIdx]);
  t('미래 카드(+3일)는 그 날짜 칸에 (이번 주 안이면)', (() => { const fi = week.dIdx + 3; if (fi > 6) return true; return /📗\s*30/.test(week.cols[fi]); })(), JSON.stringify(week.cols));
  t('선생님 줄 칩 누르면 제목·쪽·문항·마감 토스트 (편집 아님)', await P(() => { __toasts.length = 0; hwStripTap('hw:' + __today + ':B1'); return /🔒 선생님 숙제 — 📗 개념\+유형 중2\(상\) p\.12~15 · 38문항 · 마감/.test(__toasts[0] || '') && __ups.every((u) => u.key === 'todo_st_AAA111'); }), await P(() => __toasts[0]));
  t('범례에 「🔒 선생님 숙제 (읽기만)」 · 주간계획표 저장(wplan_) 안 함', /🔒 선생님 숙제/.test(week.legend) && week.ups.indexOf('wplan_AAA111') < 0, week.legend + ' | ' + week.ups.join(','));
  const off = await P(() => { SF.cfg = { hw: { on: false } }; wplRender(); hwHomeUpdate(); return { strip: !!document.querySelector('#wp-body .wpc-hw'), legend: (document.querySelector('#wp-body .wpc-lg') || {}).innerText || '', home: document.getElementById('hw-home').style.display }; });
  t('스위치 끄면 선생님 줄·범례·홈 카드 모두 사라짐', !off.strip && !/선생님 숙제/.test(off.legend) && off.home === 'none', JSON.stringify(off));

  /* ⑤ ES5 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-153 hw-begin */'), i1 = src.indexOf('/* ★ v2-153 hw-end */');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 있음', i0 > 0 && i1 > i0);
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk), '');
  const tail = src.slice(src.indexOf("var STU_VER = 'v2-153'"));
  t('STU_VER 갱신 · 버전 로그에 v2-153 줄', /v2-153 \(2026-11-02\)/.test(src) && tail.length > 0);
  t('고정 주소 student_v1.html 은 그대로(v2-153 아님)', !fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-153'") < 0);
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'bell-empty', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-wplan', 'screen-bookscore', 'screen-aha'].every((id) => !!document.getElementById(id))));
  t('기능 스위치 없을 때 다른 기능(sfOn)은 예전처럼 켜짐 · 🗂 보드는 잠김', await P(() => { SF.cfg = null; return sfOn('retry') === true && tdOpen() === false && hwOpen() === false; }));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
