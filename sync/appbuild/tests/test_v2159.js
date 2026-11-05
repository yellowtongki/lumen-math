#!/usr/bin/env node
/* 학생앱 v2-159 검사 — 📚 「숙제 체크」 카드 아코디언 (시안 docs/mockup_student_hwcheck_fold.html · 원장 결정: 기본 접힘 · 그날만 기억 · 칩 4개 + 종합 %)
 *   외부망 차단 · 가짜 Supabase(lumen_store 흉내 — 실서버에 아무것도 안 씀) · 가짜 학생(○○○ · AAA111 · 반 T5 화·목) — test_v2158.js 와 같은 틀
 *   ① 기본 접힘 — 눈금 단추 없음 · 칩 4개 · 종합 % · ▾ · 0% 이고 아무것도 안 누름 → 주황 촉구 줄
 *   ② 머리 누름 → 펼침(눈금 16개 · ◀▶ · 기록 줄 · ▴ · localStorage hw_fold_open = 오늘) · 다시 누름 → 접힘(지워짐)
 *   ③ 기억 — hw_fold_open 이 오늘이면 새로 그려도 펼침 · 어제면 접힘
 *   ④ 체크 중 — 펼친 상태에서 눈금 저장(hw_self_ 에만) → 접힌 칩에 숫자 · 아하 「없음」 · 63% 막대 · 다 함 100%
 *   ⑤ 선생님 확인값(hw_teach) 있는 날짜 → 파란 숫자 · 「✓ 선생님이 확인했어요」 · 칩 ✓/◐ · 펼치면 내 값(v2-158 그대로)
 *   ⑥ ES5 · 버전 · student_v1 그대로 · 홈·탭 회귀 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2159.js [student_v2-159.html]
 *        SHOT=/경로/stu159.png 를 주면 끝에 접힌 상태(체크 중 63%) 스크린샷 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-159.html'));
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* 가짜 Supabase — lumen_store 를 흉내 낸다 (test_v2158.js 그대로) */
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
  /* 카드 상태 — 접힘/펼침 · 머리 글자 · % · 화살 · 눈금 단추 수 · 칩 · 상태 줄 · 막대 · localStorage */
  const st = () => P(() => {
    const el = document.getElementById('hw-home'); const hd = el.querySelector('.hwk-hd'); const pct = el.querySelector('.hwk-pct');
    let ls = null; try { ls = localStorage.getItem('hw_fold_open'); } catch (e) { ls = 'ERR'; }
    return { disp: el.style.display, hd: hd ? hd.innerText.replace(/\s+/g, ' ') : '', expanded: hd ? hd.getAttribute('aria-expanded') : null, ar: (el.querySelector('.hwk-ar') || {}).textContent,
      pct: pct ? Number(pct.textContent.replace('%', '')) : null, pctColor: pct ? pct.style.color : '', body: !!el.querySelector('.hwk-body'),
      segs: el.querySelectorAll('.hwk-seg button').length, nav: el.querySelectorAll('.hwk-dt button').length, hist: el.querySelectorAll('.hwk-hist > div').length, rows: el.querySelectorAll('.hwk-r').length,
      chips: Array.prototype.map.call(el.querySelectorAll('.hwk-chip'), (c) => ({ nm: c.childNodes[0].textContent, v: c.querySelector('small').textContent, cls: c.className.replace('hwk-chip', '').trim() })),
      nudge: (el.querySelector('.hwk-nudge') || {}).textContent || '', ok: (el.querySelector('.hwk-ok') || {}).textContent || '', bar: el.querySelector('.hwk-bar i') ? el.querySelector('.hwk-bar i').style.width : null, ls, txt: el.innerText.replace(/\s+/g, ' ') };
  });
  /* 카드 머리를 손으로 누른다 — 홈 화면을 띄운 뒤 진짜 클릭(보이지 않으면 DOM click 으로) */
  const clickHead = async () => {
    await P(() => { go('screen-home'); document.getElementById('hw-home').scrollIntoView(); });
    try { await pg.click('#hw-home .hwk-hd', { timeout: 3000 }); } catch (e) { await P(() => document.querySelector('#hw-home .hwk-hd').click()); }
    await pg.waitForTimeout(60);
  };
  const saved = () => P(() => JSON.parse(JSON.stringify(__store['hw_self_AAA111'] || null)));
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];
  const md = (s) => Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10));
  const labOf = (d) => DOW[new Date(d + 'T00:00:00Z').getUTCDay()] + ' ' + md(d) + ' 수업';
  const info = await P(() => ({ today: __today, D0: __D0, CD: __CD }));
  const RGB_BLUE = 'rgb(29, 111, 232)';
  console.log('   (오늘 ' + info.today + ' · 다음 수업일 ' + info.D0 + ' · 기록 줄 ' + info.CD.join(',') + ')');

  t('버전 v2-159', (await P(() => STU_VER)) === 'v2-159');
  t('새 함수 hwFoldToggle·hwFoldOpen 있음 · v2-158 함수(hwLoad·hwSelfSet·hwAhaNone·hwNav·hwPct·hwTeachOf·hwHistDates) 그대로', await P(() => ['hwFoldToggle', 'hwFoldOpen', 'hwLoad', 'hwSelfSet', 'hwAhaNone', 'hwNav', 'hwClassDate', 'hwPct', 'hwTeachOf', 'hwHistDates', 'hwSelfOf', 'hwOpen', 'hwHomeUpdate'].every((f) => typeof window[f] === 'function')));
  t('카드 자리 그대로 — 「📌 오늘 할 일」(.td4) 바로 위 흰 카드(hwk)', await P(() => { const a = document.querySelector('#screen-home .td4'); const el = document.getElementById('hw-home'); return !!a && el.nextElementSibling === a && el.classList.contains('hwk'); }));

  /* ① 기본 접힘 */
  let r = await setup(null, { resetSelf: true });
  t('스위치 없음 → 카드 없음(v2-158 그대로)', r.disp === 'none' && r.html === '', r.disp);
  r = await setup({ on: true }, { resetSelf: true, noTeach: true });
  let S = await st();
  t('기본 접힘 — 눈금 단추 0개 · ◀▶ 없음 · 기록 줄 없음 · 펼침 몸통 없음 · aria-expanded=false', S.disp === 'block' && S.segs === 0 && S.nav === 0 && S.hist === 0 && S.rows === 0 && !S.body && S.expanded === 'false', JSON.stringify(S));
  t('접힌 첫 줄 「📚 숙제 체크 · ' + labOf(info.D0) + ' · 0% · ▾」', /📚\s*숙제 체크/.test(S.hd) && S.hd.indexOf(labOf(info.D0)) > 0 && S.pct === 0 && S.ar === '▾', S.hd + ' ' + S.ar);
  t('둘째 줄 칩 4개 풀이·채점·오답·아하 — 전부 「—」 회색(색 클래스 없음)', S.chips.length === 4 && JSON.stringify(S.chips.map((c) => c.nm)) === JSON.stringify(['풀이', '채점', '오답', '아하']) && S.chips.every((c) => c.v === '—' && c.cls === ''), JSON.stringify(S.chips));
  t('0% 이고 아무것도 안 누름 → 주황 촉구 줄 「✍ 수업 전에 눌러 주세요」 · 막대 없음 · 확인 줄 없음', /✍ 수업 전에 눌러 주세요/.test(S.nudge) && S.bar === null && S.ok === '', JSON.stringify(S));
  t('불러오기만 · 저장(upsert) 없음', r.ups.length === 0, r.ups.join(','));

  /* ② 머리 누름 → 펼침 → 다시 접힘 */
  await clickHead();
  S = await st();
  t('머리 누름 → 펼침 — 눈금 16개 · ◀▶ · 네 줄 · 기록 줄 5칸 · ▴ · aria-expanded=true · 안내 줄', S.segs === 16 && S.nav === 2 && S.rows === 4 && S.hist === 5 && S.ar === '▴' && S.expanded === 'true' && S.body && /눈금을 누르면 바로 저장돼요/.test(S.txt) && /막힌 문제가\s*없어요\s*있어요/.test(S.txt), JSON.stringify(S));
  t('펼치면 localStorage hw_fold_open = 오늘(' + info.today + ')', S.ls === info.today, S.ls);
  await clickHead();
  S = await st();
  t('다시 머리 누름 → 접힘 — 눈금 0개 · ▾ · 칩 4개 · localStorage 지워짐', S.segs === 0 && S.ar === '▾' && S.chips.length === 4 && !S.body && S.ls === null, JSON.stringify({ segs: S.segs, ar: S.ar, ls: S.ls }));

  /* ③ 기억 — 오늘이면 펼침 · 어제면 접힘 */
  r = await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  S = await st();
  t('hw_fold_open = 오늘 → 새로 그려도 펼침(눈금 16개 · ▴)', S.segs === 16 && S.ar === '▴' && S.body, JSON.stringify({ segs: S.segs, ar: S.ar }));
  r = await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'yest' });
  S = await st();
  t('hw_fold_open = 어제 → 접힘(날짜 바뀌면 다시 접힘) · 눈금 0개 · ▾', S.segs === 0 && S.ar === '▾' && !S.body, JSON.stringify({ segs: S.segs, ar: S.ar }));

  /* ④ 체크 중 — 펼친 상태에서 눈금 저장 → 접힌 칩 반영 */
  r = await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
  await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 60); hwSelfSet('w', 30); hwAhaNone(true); });
  await pg.waitForTimeout(40);
  let sv = await saved(); S = await st();
  t('펼친 상태에서 풀이 100·채점 60·오답 30·아하 「없어요」 → hw_self_AAA111 에만 저장 · 펼침 유지 · 63%', sv && sv.byDate[info.D0] && sv.byDate[info.D0].p === 100 && sv.byDate[info.D0].c === 60 && sv.byDate[info.D0].w === 30 && sv.byDate[info.D0].aNone === true && (await P(() => __ups.every((u) => u.key === 'hw_self_AAA111') && __ups.length === 4)) && S.segs === 16 && S.pct === 63, JSON.stringify(sv) + ' ' + S.segs + ' ' + S.pct);
  await clickHead();
  S = await st();
  t('접으면 칩에 숫자 — 풀이 100(s1) · 채점 60(s2) · 오답 30(s3) · 아하 「없음」(na) · 63% 주황 · 진행 막대 63% · 촉구 줄 없음', JSON.stringify(S.chips) === JSON.stringify([{ nm: '풀이', v: '100', cls: 's1' }, { nm: '채점', v: '60', cls: 's2' }, { nm: '오답', v: '30', cls: 's3' }, { nm: '아하', v: '없음', cls: 'na' }]) && S.pct === 63 && S.pctColor === 'rgb(245, 158, 11)' && S.bar === '63%' && S.nudge === '' && S.ok === '', JSON.stringify(S));
  await P(() => { hwFoldToggle(); hwAhaNone(false); hwSelfSet('a', 100); hwSelfSet('c', 100); hwSelfSet('w', 100); hwFoldToggle(); });
  await pg.waitForTimeout(40);
  S = await st();
  t('다 함 → 접힌 칩 전부 100(s1~s4) · 100% 초록 · 막대 100%', S.chips.every((c) => c.v === '100') && JSON.stringify(S.chips.map((c) => c.cls)) === JSON.stringify(['s1', 's2', 's3', 's4']) && S.pct === 100 && S.pctColor === 'rgb(34, 197, 94)' && S.bar === '100%' && S.segs === 0, JSON.stringify(S.chips) + ' ' + S.pct + ' ' + S.bar);
  await P(() => { hwFoldToggle(); hwSelfSet('p', 0); hwSelfSet('c', 0); hwSelfSet('w', 0); hwSelfSet('a', 0); hwFoldToggle(); });
  await pg.waitForTimeout(40);
  S = await st();
  t('전부 0 「안 함」을 눌렀으면(0% 이지만 누른 것) → 촉구 줄 대신 막대 0% · 칩 0 숫자', S.pct === 0 && S.nudge === '' && S.bar === '0%' && S.chips.every((c) => c.v === '0'), JSON.stringify(S));

  /* ⑤ 선생님 확인값 */
  r = await setup({ on: true }, { oldSelf: true });
  await P((d) => { HW.sel = d; hwHomeUpdate(); }, info.CD[3]);
  S = await st();
  t('선생님이 확인한 날짜(' + info.CD[3] + ' t=80)를 접힌 상태로 보면 파란 숫자 80 · 「✓ 선생님이 확인했어요」 · 「다음 수업 … 체크는 ▾ 눌러서」', S.pct === 80 && S.pctColor === RGB_BLUE && /✓ 선생님이 확인했어요/.test(S.ok) && new RegExp('다음 수업 ' + DOW[new Date(info.D0 + 'T00:00:00Z').getUTCDay()] + ' ' + md(info.D0) + ' 체크는 ▾ 눌러서').test(S.ok) && S.bar === null && S.nudge === '' && S.hd.indexOf(labOf(info.CD[3])) > 0, JSON.stringify(S));
  t('그때 칩은 선생님 값 — 풀이 ✓(100) · 채점 ◐(60) · 오답 ◐(60) · 아하 —(na)', JSON.stringify(S.chips) === JSON.stringify([{ nm: '풀이', v: '✓', cls: 's1' }, { nm: '채점', v: '◐', cls: 's2' }, { nm: '오답', v: '◐', cls: 's3' }, { nm: '아하', v: '—', cls: 'na' }]), JSON.stringify(S.chips));
  await clickHead();
  S = await st();
  t('펼치면 v2-158 그대로 — 종합은 내 값 100% · 기록 줄에 CD[3] 파란 80', S.segs === 16 && S.pct === 100 && S.pctColor !== RGB_BLUE && (await P(() => { const ds = document.querySelectorAll('#hw-home .hwk-hist > div'); return ds[3].querySelector('.p').textContent === '80' && ds[3].querySelector('.p').classList.contains('t'); })), JSON.stringify({ segs: S.segs, pct: S.pct, color: S.pctColor }));
  /* 선생님 값이 다음 수업일(기본 날짜)에 바로 있는 경우 — 「다음 수업 … ▾」 꼬리 없음 */
  const tch = { byDate: {}, upd: '2026-11-01T10:00:00.000Z' }; tch.byDate[info.D0] = { p: 30, c: 0, w: 100, t: 55 };
  r = await setup({ on: true }, { resetSelf: true, teach: tch });
  S = await st();
  t('다음 수업일에 선생님 값 t=55 → 접힌 기본 화면이 파란 55 · ✓ 문구(꼬리 없음) · 칩 ◔·○·✓·—', S.pct === 55 && S.pctColor === RGB_BLUE && S.ok === '✓ 선생님이 확인했어요' && JSON.stringify(S.chips.map((c) => c.v)) === JSON.stringify(['◔', '○', '✓', '—']), JSON.stringify(S));
  await setup({ on: true }, { resetSelf: true, noTeach: true });
  S = await st();
  t('hw_teach 가 없으면 파란 글자 없음 — 내 값 0% 회색 · 촉구 줄 · 확인 줄 없음', S.pct === 0 && S.pctColor === 'rgb(148, 163, 184)' && S.ok === '' && /✍/.test(S.nudge), JSON.stringify(S));

  /* ⑥ ES5 · 버전 · 회귀 */
  const src = fs.readFileSync(FILE, 'utf8');
  const i0 = src.indexOf('/* ★ v2-159 hwself-begin */'), i1 = src.indexOf('/* ★ v2-159 hwself-end */');
  const blk = src.slice(i0, i1);
  t('새 코드 블록 표식 v2-159 있음 · v2-158 표식 없음 · 접힘 함수(hwFoldOpen·hwFoldSet·hwChipsHtml) 블록 안', i0 > 0 && i1 > i0 && src.indexOf('/* ★ v2-158 hwself-begin */') < 0 && /function hwFoldOpen\(\)/.test(blk) && /function hwFoldSet\(/.test(blk) && /function hwChipsHtml\(/.test(blk));
  t('새 코드 ES5 — 템플릿 리터럴·화살표 함수·let/const 없음 · localStorage 읽기·쓰기 try/catch', blk.indexOf('`') < 0 && !/=>/.test(blk) && !/\b(let|const)\s/.test(blk) && /try\{ return localStorage\.getItem\('hw_fold_open'\)/.test(blk) && /try\{ if\(open\) localStorage\.setItem\('hw_fold_open'/.test(blk), '');
  t('STU_VER 갱신 · 버전 로그에 v2-159 줄 · 접힘 CSS(.hwk-chips·.hwk-nudge·.hwk-ok) 있음', /v2-159 \(2026-11-05\)/.test(src) && src.indexOf("var STU_VER = 'v2-159'") > 0 && src.indexOf('.hwk-chips{') > 0 && src.indexOf('.hwk-nudge{') > 0 && src.indexOf('.hwk-ok{') > 0);
  t('고정 주소 student_v1.html 은 그대로(v2-159 아님)', !fs.existsSync(path.join(ROOT, 'student_v1.html')) || fs.readFileSync(path.join(ROOT, 'student_v1.html'), 'utf8').indexOf("var STU_VER = 'v2-159'") < 0);
  t('홈·탭 회귀 — 홈 요소·아래 탭·주요 화면 그대로', await P(() => ['screen-home', 'td-home', 'bell-empty', 'btabs', 'screen-plan', 'screen-study', 'screen-me', 'screen-todo', 'screen-wplan', 'screen-bookscore', 'screen-aha', 'hm-notice', 'td4-date'].every((id) => !!document.getElementById(id))));
  t('기능 스위치 없을 때 다른 기능(sfOn)은 예전처럼 켜짐 · 숙제 체크는 잠김', await P(() => { SF.cfg = null; hwHomeUpdate(); return sfOn('retry') === true && hwOpen() === false && document.getElementById('hw-home').style.display === 'none'; }));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));

  if (process.env.SHOT) {
    try {
      await setup({ on: true }, { resetSelf: true, noTeach: true, fold: 'today' });
      await P(() => { hwSelfSet('p', 100); hwSelfSet('c', 60); hwSelfSet('w', 30); hwAhaNone(true); hwFoldToggle(); go('screen-home'); window.scrollTo(0, 0); document.getElementById('hw-home').scrollIntoView(); });
      await pg.waitForTimeout(400); await pg.screenshot({ path: process.env.SHOT }); console.log('📸 ' + process.env.SHOT);
    } catch (e) { console.log('스크린샷 실패', e.message); }
  }
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
