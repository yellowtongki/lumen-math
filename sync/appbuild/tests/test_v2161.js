#!/usr/bin/env node
/* 학생앱 v2-161 검사 — 📤 「숙제 체크」 선생님께 제출 (docs/hw_dispatch_contract.md §11-1 · 원장 「학생앱 숙제체크 후에 제출기능이 없다」)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111 · 반 T5 화·목) — test_v2159.js 와 같은 틀
 *   ① 단추 활성 조건 — 일부만 고름(비활성·안내) · 셋+아하 안 고름(비활성) · 셋+없어요(활성) · 셋+아하 값(활성) · 고른 칸만 저장
 *   ② 제출 → hw_self_ 에 sub(upsert 1회 · 다른 값·작성 시각 그대로) · 접힘 · 초록 줄·시각 · 토스트 · 펼치면 「제출했어요」·「제출 완료」 비활성
 *   ③ 고침 → sub 지워짐(subPrev 남음) · 「📤 다시 제출」 · 접힌 주황 「고친 내용은 다시 제출해 주세요」 · 같은 값 다시 누름은 제출 유지 · 다시 제출
 *   ④ 접힌 줄 — 값 있고 제출 전 주황 · 아무것도 없으면 촉구 줄 · hw_teach 있으면 파란 줄 우선 · 불러온 sub 도 초록 · 저장 실패면 되돌림
 *   ⑤ ES5 · 버전 · student_v1 그대로 · 홈·탭 회귀 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2161.js [student_v2-161.html]
 *        SHOT=/경로/stu161.png → 펼친 상태(셋 고르고 없어요 · 제출 단추 활성) · SHOT2=/경로/stu161b.png → 제출 뒤 접힌 상태 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-161.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
/* KST HH:MM (앱 hwHM 과 같은 셈) */
const hm = (iso) => new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(11, 16);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/* 가짜 Supabase — lumen_store 를 흉내 낸다 (test_v2159.js 그대로 · __failUps 면 저장 실패 흉내) */
const MOCK = () => {
  window.__store = {}; window.__ups = []; window.__gos = []; window.__toasts = [];
  const store = window.__store;
  window.sb = { from(tbl) { const b = { f: {}, op: 'select', select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, gte() { return b; }, lte() { return b; }, is() { return b; }, or() { return b; },
    single() { return Promise.resolve({ data: null, error: null }); },
    maybeSingle() { let keys = Object.keys(store); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.length ? { key: keys[0], value: store[keys[0]] } : null, error: null }); },
    upsert(row, opt) { if (window.__failUps) return Promise.resolve({ error: { message: '가짜 실패' } }); __ups.push({ tbl, key: row.key, value: JSON.parse(JSON.stringify(row.value)), opt: opt || null }); if (tbl === 'lumen_store') store[row.key] = row.value; return Promise.resolve({ error: null }); },
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
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
  window.__today = today; window.__add = add; window.__dow = dow;
  /* 우리 반 T5 = 화(2)·목(4) → 다음 수업일 D0 · 기록 줄 5칸 CD[0..4] (CD[4]=D0 · CD[3]=그 앞 수업일) */
  let D0 = today; for (let i = 0; i < 7; i++) { if ([2, 4].indexOf(dow(add(today, i))) >= 0) { D0 = add(today, i); break; } }
  const CD = [D0]; for (let i = 1; CD.length < 5 && i < 60; i++) { const d = add(D0, -i); if ([2, 4].indexOf(dow(d)) >= 0) CD.push(d); } CD.reverse();
  window.__D0 = D0; window.__CD = CD;
  window.__todo = { items: [ { id: 'hw:' + D0 + ':B1', kind: 'book', title: '개념+유형 중2(상)', book: '개념+유형 중2(상)', bookId: 'B1', from: 12, to: 15, n: 38, due: D0, src: 'hw', hw: true } ] };
  /* 선생님 확인값 — CD[3](지난 수업일) 80 (p100·c60·w60) */
  window.__teach = { byDate: {}, upd: '2026-11-01T10:00:00.000Z' };
  window.__teach.byDate[CD[3]] = { p: 100, c: 60, w: 60, t: 80 };
  /* 내가 전에 누른 값 — CD[3] 100 (선생님 값 80 이 이김) */
  window.__selfOld = { byDate: {}, upd: '2026-11-01T10:00:00.000Z' };
  window.__selfOld.byDate[CD[3]] = { p: 100, c: 100, w: 100, a: 100, at: '2026-11-01T10:00:00.000Z' };
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
  /* 스위치·자료·접힘 기억을 바꾸고 다시 불러온 뒤 홈 카드를 그린다 — o.fold: 'today' | 'yest' | 없음(지움) */
  const setup = (hwCfg, o) => P(async ([hw, o]) => {
    o = o || {}; SF.cfg = {}; if (hw) SF.cfg.hw = hw;
    __store['todo_AAA111'] = JSON.parse(JSON.stringify(__todo));
    if (o.noDays) delete __store['lumen_group_days']; else __store['lumen_group_days'] = { T5: [2, 4], T3: [1, 3, 5] };
    if (o.resetSelf) delete __store['hw_self_AAA111']; else if (o.oldSelf) __store['hw_self_AAA111'] = JSON.parse(JSON.stringify(__selfOld));
    if (o.noTeach) delete __store['hw_teach_AAA111']; else __store['hw_teach_AAA111'] = JSON.parse(JSON.stringify(o.teach || __teach));
    try { if (o.fold === 'today') localStorage.setItem('hw_fold_open', __today); else if (o.fold === 'yest') localStorage.setItem('hw_fold_open', __add(__today, -1)); else localStorage.removeItem('hw_fold_open'); } catch (e) {}
    TD.loaded = false; TD.busy = false; TD.items = []; TD.st = {}; HW.bkReq = false; BK.loaded = false;
    HW.loaded = false; HW.busy = false; HW.self = null; HW.teach = null; HW.days = null; HW.sel = null; if (window.WP) WP.days = null; if (window.CAL) CAL.data = null;
    __ups.length = 0; __toasts.length = 0;
    await hwLoad(true); await tdLoad(true); hwHomeUpdate(); await new Promise((r) => setTimeout(r, 50)); tdHomeUpdate();
    const el = document.getElementById('hw-home');
    return { disp: el.style.display, html: el.innerHTML, txt: el.innerText.replace(/\s+/g, ' '), ups: __ups.map((u) => u.key) };
  }, [hwCfg, o]);
  /* 카드 상태 — 접힘/펼침 · 제출 단추 · 제출 줄 · 칩 · 막대 · localStorage */
  const st = () => P(() => {
    const el = document.getElementById('hw-home'); const hd = el.querySelector('.hwk-hd'); const pct = el.querySelector('.hwk-pct');
    const sb = el.querySelector('#hw-submit'); const q = (s) => { const x = el.querySelector(s); return x ? x.textContent : ''; };
    let ls = null; try { ls = localStorage.getItem('hw_fold_open'); } catch (e) { ls = 'ERR'; }
    /* 단추 자리 — 네 줄(.hwk-st) 바로 뒤 · 안내 줄(.hwk-tip) 바로 앞 */
    const w = el.querySelector('.hwk-sbw'); const place = !!w && !!w.previousElementSibling && w.previousElementSibling.classList.contains('hwk-st') && !!w.nextElementSibling && w.nextElementSibling.classList.contains('hwk-tip');
    return { disp: el.style.display, open: !!el.querySelector('.hwk-body'), segs: el.querySelectorAll('.hwk-seg button').length, ar: q('.hwk-ar'),
      pct: pct ? Number(pct.textContent.replace('%', '')) : null, pctColor: pct ? pct.style.color : '',
      btn: sb ? { txt: sb.textContent, dis: sb.disabled, done: sb.classList.contains('done') } : null, place,
      sbt: q('.hwk-sbt'), sbn: q('.hwk-sbn'), subok: q('.hwk-subok'), subno: q('.hwk-subno'), nudge: q('.hwk-nudge'), ok: q('.hwk-ok'),
      bar: el.querySelector('.hwk-bar i') ? el.querySelector('.hwk-bar i').style.width : null, chips: el.querySelectorAll('.hwk-chip').length,
      chipV: Array.prototype.map.call(el.querySelectorAll('.hwk-chip small'), (c) => c.textContent), ls, txt: el.innerText.replace(/\s+/g, ' ') };
  });
  const clickHead = async () => {
    await P(() => { go('screen-home'); document.getElementById('hw-home').scrollIntoView(); });
    try { await pg.click('#hw-home .hwk-hd', { timeout: 3000 }); } catch (e) { await P(() => document.querySelector('#hw-home .hwk-hd').click()); }
    await pg.waitForTimeout(60);
  };
  /* 제출 단추를 손으로 누른다(보이지 않으면 DOM click) */
  const clickSubmit = async () => {
    await P(() => { go('screen-home'); const b = document.getElementById('hw-submit'); if (b) b.scrollIntoView(); });
    try { await pg.click('#hw-submit', { timeout: 3000 }); } catch (e) { await P(() => document.getElementById('hw-submit').click()); }
    await pg.waitForTimeout(120);
  };
  const saved = () => P(() => JSON.parse(JSON.stringify(__store['hw_self_AAA111'] || null)));
  const ups = () => P(() => JSON.parse(JSON.stringify(__ups)));
  const toasts = () => P(() => __toasts.slice());
  const clr = () => P(() => { __ups.length = 0; __toasts.length = 0; });
  const info = await P(() => ({ today: __today, D0: __D0, CD: __CD }));
  const D0 = info.D0;
  const RGB_BLUE = 'rgb(29, 111, 232)';
  console.log('   (오늘 ' + info.today + ' · 다음 수업일 ' + D0 + ' · 기록 줄 ' + info.CD.join(',') + ')');

  t('버전 v2-161 · 새 함수 hwSubmit·hwReady · v2-159 함수(hwFoldToggle·hwSelfSet·hwAhaNone·hwLoad·hwHomeUpdate) 그대로', (await P(() => STU_VER)) === 'v2-161' && await P(() => ['hwSubmit', 'hwReady', 'hwFoldToggle', 'hwFoldOpen', 'hwSelfSet', 'hwAhaNone', 'hwLoad', 'hwHomeUpdate', 'hwSelfOf', 'hwPct'].every((f) => typeof window[f] === 'function')));

  /* ① 단추 활성 조건 */
  await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  let S = await st();
  t('아무것도 안 고름(펼침) → 단추 「📤 선생님께 제출」 회색 비활성 + 안내 · 자리 = 네 줄 아래·안내 줄 위', S.open && S.btn && S.btn.txt === '📤 선생님께 제출' && S.btn.dis && S.sbn === '풀이·채점·오답·아하노트를 모두 고르면 제출할 수 있어요' && S.place, JSON.stringify(S));
  await P(() => { hwSelfSet('p', 60); hwSelfSet('c', 0); });
  await pg.waitForTimeout(40);
  let sv = await saved(); S = await st();
  t('일부만 고름(풀이 60·채점 0) → 비활성 · 안내 그대로', S.btn.dis && S.btn.txt === '📤 선생님께 제출' && /모두 고르면 제출할 수 있어요/.test(S.sbn), JSON.stringify(S.btn));
  t('고른 칸만 저장 — byDate[D0] = {p:60, c:0} (오답 칸 없음 · v2-158 은 0 으로 채웠음)', sv && sv.byDate[D0] && sv.byDate[D0].p === 60 && sv.byDate[D0].c === 0 && !('w' in sv.byDate[D0]) && !('a' in sv.byDate[D0]) && !('sub' in sv.byDate[D0]), JSON.stringify(sv && sv.byDate[D0]));
  await P(() => { hwSelfSet('w', 30); });
  await pg.waitForTimeout(40); S = await st();
  t('풀이·채점·오답 셋 고르고 아하노트 안 고름 → 아직 비활성', S.btn.dis && /모두 고르면/.test(S.sbn), JSON.stringify(S.btn));
  await P(() => { hwAhaNone(true); });
  await pg.waitForTimeout(40); S = await st();
  t('셋 + 아하 「없어요」 → 활성 「📤 선생님께 제출」 · 안내 사라짐', S.btn && !S.btn.dis && S.btn.txt === '📤 선생님께 제출' && S.sbn === '' && S.sbt === '', JSON.stringify(S));
  await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 100); hwSelfSet('w', 60); hwSelfSet('a', 30); });
  await pg.waitForTimeout(40); S = await st();
  t('셋 + 아하 눈금 30(있어요) → 활성', S.btn && !S.btn.dis && S.sbn === '', JSON.stringify(S.btn));
  /* 옛 판(v2-158·0 채움) 기록도 그대로 제출 가능 */
  await P((d) => { HW.self.byDate[d] = { p: 0, c: 0, w: 0, a: 0, at: '2026-11-04T10:00:00.000Z' }; hwHomeUpdate(); }, D0);
  S = await st();
  t('옛 판 기록 {p:0,c:0,w:0,a:0} (0 포함) → 활성', S.btn && !S.btn.dis, JSON.stringify(S.btn));

  /* ② 제출 */
  await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 60); hwSelfSet('w', 30); hwAhaNone(true); });
  await pg.waitForTimeout(40);
  const before = (await saved()).byDate[D0];
  if (process.env.SHOT) { try { await P(() => { go('screen-home'); window.scrollTo(0, 0); document.getElementById('hw-submit').scrollIntoView({ block: 'center' }); }); await pg.waitForTimeout(300); await pg.screenshot({ path: process.env.SHOT }); console.log('📸 ' + process.env.SHOT); } catch (e) { console.log('스크린샷 실패', e.message); } }
  await clr();
  await clickSubmit();
  sv = await saved(); let U = await ups(); let rec = sv.byDate[D0]; S = await st();
  t('제출 → upsert 1회 · 키 hw_self_AAA111 · onConflict key', U.length === 1 && U[0].tbl === 'lumen_store' && U[0].key === 'hw_self_AAA111' && U[0].opt && U[0].opt.onConflict === 'key', JSON.stringify(U.map((u) => [u.key, u.opt])));
  t('그 날짜에 sub = ISO 시각 · 다른 값(p100·c60·w30·aNone) 그대로 · 작성 시각 at 그대로', ISO_RE.test(rec.sub || '') && rec.p === 100 && rec.c === 60 && rec.w === 30 && rec.aNone === true && !('a' in rec) && rec.at === before.at && !('subPrev' in rec), JSON.stringify(rec) + ' / at 전 ' + before.at);
  const SUB1 = rec.sub;
  t('제출하면 접힘 — 눈금 0개 · ▾ · 칩 4개 · 펼친 날짜 기억(hw_fold_open) 지워짐', !S.open && S.segs === 0 && S.ar === '▾' && S.chips === 4 && S.ls === null, JSON.stringify({ open: S.open, ls: S.ls }));
  t('접힌 줄 초록 「✓ 제출함 · ' + hm(SUB1) + ' · 수업 때 선생님이 확인해요」 · 주황 줄·촉구 줄 없음', S.subok === '✓ 제출함 · ' + hm(SUB1) + ' · 수업 때 선생님이 확인해요' && S.subno === '' && S.nudge === '' && S.ok === '', JSON.stringify(S));
  t('토스트 「제출했어요」', (await toasts()).indexOf('제출했어요') >= 0, JSON.stringify(await toasts()));
  await clickHead(); S = await st();
  t('다시 펼치면 단추 위 초록 「✓ ' + hm(SUB1) + ' 에 제출했어요」 · 단추 「제출 완료」 비활성', S.open && S.sbt === '✓ ' + hm(SUB1) + ' 에 제출했어요' && S.btn && S.btn.txt === '제출 완료' && S.btn.dis && S.btn.done && S.sbn === '', JSON.stringify(S));
  await clr();
  await P(() => { hwSelfSet('p', 100); hwAhaNone(true); });
  await pg.waitForTimeout(40); sv = await saved();
  t('같은 값(풀이 100 · 없어요)을 다시 누름 → 저장 없음 · 제출 그대로', (await ups()).length === 0 && sv.byDate[D0].sub === SUB1, JSON.stringify(await ups()));

  /* ③ 고침 → 다시 제출 */
  await P(() => { hwSelfSet('w', 60); });
  await pg.waitForTimeout(40); sv = await saved(); rec = sv.byDate[D0]; S = await st();
  t('제출 뒤 오답 30 → 60 고침 → 저장에서 sub 지워짐 · subPrev = 앞 제출 시각 · 값 w 60', !('sub' in rec) && rec.subPrev === SUB1 && rec.w === 60 && rec.p === 100 && rec.aNone === true, JSON.stringify(rec));
  t('단추 「📤 다시 제출」 활성 · 「제출했어요」 초록 글 없음', S.btn && S.btn.txt === '📤 다시 제출' && !S.btn.dis && S.sbt === '', JSON.stringify(S.btn) + ' ' + S.sbt);
  await clickHead(); S = await st();
  t('접힌 줄 주황 「고친 내용은 다시 제출해 주세요」 + 진행 막대 · 초록 줄 없음', /^고친 내용은 다시 제출해 주세요/.test(S.subno) && S.subok === '' && S.bar !== null, JSON.stringify(S));
  await clickHead(); await clr();
  await P(() => new Promise((r) => setTimeout(r, 15)));
  await clickSubmit();
  sv = await saved(); rec = sv.byDate[D0]; S = await st();
  t('「다시 제출」 → sub 새 시각 · subPrev 지워짐 · 접힘 초록 줄 · upsert 1회', ISO_RE.test(rec.sub || '') && rec.sub >= SUB1 && !('subPrev' in rec) && !S.open && /^✓ 제출함 · /.test(S.subok) && (await ups()).length === 1, JSON.stringify(rec));
  await P(() => { hwFoldToggle(); hwAhaNone(false); });
  await pg.waitForTimeout(40); sv = await saved(); rec = sv.byDate[D0]; S = await st();
  t('제출 뒤 「없어요」→「있어요」 바꿈도 sub 지움 · 「📤 다시 제출」(a 0 이라 활성)', !('sub' in rec) && !!rec.subPrev && rec.a === 0 && S.btn && S.btn.txt === '📤 다시 제출' && !S.btn.dis, JSON.stringify(rec));

  /* ④ 접힌 줄 여러 상태 */
  await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  await P(() => { hwSelfSet('p', 60); hwSelfSet('c', 30); hwFoldToggle(); });
  await pg.waitForTimeout(40); S = await st();
  t('값 있고 제출 전(일부) → 접힌 줄 주황 「아직 제출 안 했어요 · ▾ 눌러 제출」 + 진행 막대(v2-159 그대로)', S.subno === '아직 제출 안 했어요 · ▾ 눌러 제출' && S.bar !== null && S.subok === '' && S.nudge === '', JSON.stringify(S));
  await setup({ on: true }, { resetSelf: true, noTeach: true });
  S = await st();
  t('아무것도 안 누름 → v2-159 촉구 줄 「✍ 수업 전에 눌러 주세요」 · 제출 줄 없음', /✍ 수업 전에 눌러 주세요/.test(S.nudge) && S.subno === '' && S.subok === '' && S.bar === null, JSON.stringify(S));
  /* 서버에 이미 제출된 기록 → 불러와도 초록 */
  const subSelf = { byDate: {}, upd: '2026-11-05T07:28:00.000Z' }; subSelf.byDate[D0] = { p: 100, c: 100, w: 100, aNone: true, at: '2026-11-05T07:20:00.000Z', sub: '2026-11-05T07:28:00.000Z' };
  await P((v) => { __selfOld = v; }, subSelf);
  await setup({ on: true }, { oldSelf: true, noTeach: true });
  S = await st();
  t('불러온 기록에 sub(16:28) → 접힌 초록 「✓ 제출함 · 16:28 · 수업 때 선생님이 확인해요」', S.subok === '✓ 제출함 · 16:28 · 수업 때 선생님이 확인해요', S.subok);
  const tch = { byDate: {}, upd: '2026-11-05T10:00:00.000Z' }; tch.byDate[D0] = { p: 100, c: 60, w: 60, t: 80 };
  await setup({ on: true }, { oldSelf: true, teach: tch });
  S = await st();
  t('그 날짜에 선생님 확인(hw_teach t=80) → 파란 80 · 「✓ 선생님이 확인했어요」 우선 · 제출 줄 없음', S.pct === 80 && S.pctColor === RGB_BLUE && /✓ 선생님이 확인했어요/.test(S.ok) && S.subok === '' && S.subno === '', JSON.stringify(S));
  /* 저장 실패 → 제출 표시 되돌림 */
  await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 100); hwSelfSet('w', 100); hwAhaNone(true); });
  await pg.waitForTimeout(40); await clr();
  await P(() => { window.__failUps = true; });
  await clickSubmit();
  await P(() => { window.__failUps = false; });
  const loc = await P((d) => JSON.parse(JSON.stringify(HW.self.byDate[d])), D0); const T = await toasts(); S = await st();
  t('저장 실패 → 화면 기록에서 sub 되돌림 · 「저장이 안 됐어요」 토스트 · 「제출했어요」 없음 · 접힌 주황 줄', !('sub' in loc) && T.some((x) => /저장이 안 됐어요/.test(x)) && T.indexOf('제출했어요') < 0 && /아직 제출 안 했어요/.test(S.subno), JSON.stringify(loc) + ' ' + JSON.stringify(T));

  /* ⑤ ES5 · 버전 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-161 hwself-begin */'), i1 = src.indexOf('/* ★ v2-161 hwself-end */');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 표식 v2-161 · 옛 표식(v2-159) 없음 · hwSubmit·hwReady·hwSubHtml 블록 안', i0 > 0 && i1 > i0 && src.indexOf('/* ★ v2-159 hwself-begin */') < 0 && /window\.hwSubmit=async function\(\)/.test(blk) && /function hwReady\(/.test(blk) && /function hwSubHtml\(/.test(blk));
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk));
  t('STU_VER · 버전 로그 v2-161 줄 · 제출 CSS(.hwk-sb·.hwk-subok·.hwk-subno) 있음', src.indexOf("var STU_VER = 'v2-161'") > 0 && /v2-161 \(2026-11-05\)/.test(src) && src.indexOf('.hwk-sb{') > 0 && src.indexOf('.hwk-subok{') > 0 && src.indexOf('.hwk-subno{') > 0);
  let v1same = true; try { execSync('git diff --quiet HEAD -- student_v1.html', { cwd: ROOT }); } catch (e) { v1same = false; }
  t('고정 주소 student_v1.html 그대로(커밋본과 같음 · v2-161 아님)', v1same && (!fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-161'") < 0));
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'hw-home', 'bell-empty', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-wplan', 'screen-bookscore', 'screen-aha', 'screen-planner-score', 'hm-notice', 'td4-date'].every((id) => !!document.getElementById(id))));
  t('탭 이동 회귀 — 계획·공부·나·홈 화면 전환', await P(() => { const ids = ['screen-plan', 'screen-study', 'screen-me', 'screen-home']; return ids.every((id) => { go(id); return document.getElementById(id).classList.contains('active') || getComputedStyle(document.getElementById(id)).display !== 'none'; }); }));
  t('기능 스위치 없을 때 다른 기능(sfOn)은 예전처럼 켜짐 · 숙제 체크는 잠김', await P(() => { SF.cfg = null; hwHomeUpdate(); return sfOn('retry') === true && hwOpen() === false && document.getElementById('hw-home').style.display === 'none'; }));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));

  if (process.env.SHOT2) {
    try {
      await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
      await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 60); hwSelfSet('w', 30); hwAhaNone(true); });
      await pg.waitForTimeout(40); await clickSubmit();
      await P(() => { go('screen-home'); window.scrollTo(0, 0); document.getElementById('hw-home').scrollIntoView(); });
      await pg.waitForTimeout(400); await pg.screenshot({ path: process.env.SHOT2 }); console.log('📸 ' + process.env.SHOT2);
    } catch (e) { console.log('스크린샷 실패', e.message); }
  }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
