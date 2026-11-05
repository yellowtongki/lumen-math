#!/usr/bin/env node
/* 학원앱 v19-177 검사 — 🎨 숙제체크 칸 3판: 색 = 이행도 · 모양 = 누가 매겼나 (docs/hw_dispatch_contract.md §12)
 *   ① 4단 색(선생님 값 100/80/45/10 칸 배경·실선) · 학생 제출 칸 흰 바탕+점선+「🙋 제출」 · 작성 중 점점선+「✎ 작성 중」 · 빈 칸 그대로 · 칸 밖 알약 없음
 *   ② 4칸 띠 색 · 보라 배지(30 이상만)   ③ 오늘 칸 파란 바깥선(노란 없음)
 *   ④ 줄 끝 「최근 4번」 평균·추세·🚑 후보   ⑤ 반 머리 평균 칩   ⑥ 범례
 *   ⑦ 탭: 제출 칸 → 학생 값 저장·되돌리기·hw_teach_ / 작성 중 칸 → 세부 창·저장 없음 / 빈 칸 → 100 / 선생님 칸 → 바탕 규칙
 *   ⑧ 수업 모드 칸 색·모양   ⑨ 회귀(홈·학생별 보기·할 일 보드·리커버리 보드) · 실서버 쓰기 없음 · 페이지 오류 없음
 *   가짜 학생 7명(○○○1~7 · M4·T5 둘 다 오늘 수업) · 가짜 서버(lumen_store 흉내, test_v19176.js 의 mk) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19177.js lumen_v19-177.html [그리드.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-177.html');
const SHOT_A = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-177'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
/* 그리드의 「오늘」과 같은 기준(UTC 날짜) */
const D = new Date().toISOString().slice(0, 10);
const D0 = add(D, -1).slice(0, 7) === D.slice(0, 7) ? add(D, -1) : add(D, 1);   /* 같은 달 빈 칸 */
const T5DAYS = [dow(D), dow(D0)];   /* T5 는 오늘·D0 수업 (수업 모드에서 칸이 크게) */
const names = (n) => '○○○' + n;
const code = (n) => (n <= 4 ? 'AAA' : 'BBB') + String(n).repeat(3).slice(0, 3);
const STUDENTS = [];
for (let n = 1; n <= 7; n++) STUDENTS.push({ id: 'S' + n, name: names(n), grade: '중학교 1학년', group: n <= 4 ? 'M4' : 'T5', lumen_rec_code: code(n), lumen_planner: {} });
const HW0 = {
  S1: { [D]: { p: 100, c: 100, w: 100 }, [add(D, -2)]: { p: 100, c: 100, w: 100 }, [add(D, -4)]: { p: 30, c: 30, w: 30 }, [add(D, -6)]: { p: 30, c: 30, w: 30 }, [add(D, -9)]: { p: 0, c: 0, w: 0 } },   /* 100 · 최근 4번 [100,100,30,30] → 65 ↗ */
  S2: { [D]: { p: 100, c: 100, w: 40 }, [add(D, -2)]: { p: 100, c: 100, w: 40 } },   /* 80 · [80,80] → 80 → */
  S3: { [D]: { p: 100, c: 30, w: 5 } },                                             /* 45 · 한 번 → 칩만 */
  S4: { [D]: { p: 30, c: 0, w: 0 }, [add(D, -2)]: { p: 0, c: 0, w: 0 }, [add(D, -4)]: { p: 100, c: 100, w: 100 }, [add(D, -6)]: { p: 100, c: 100, w: 100 } }   /* 10 · [10,0,100,100] → 53 ↘ 🚑 */
};
STUDENTS.forEach((s) => { s.lumen_hw = JSON.parse(JSON.stringify(HW0[s.id] || {})); });
const C = {}; for (let n = 1; n <= 7; n++) C[n] = code(n);
const AT = D + 'T07:20:00.000Z', SUB = D + 'T07:28:00.000Z';
const STORE = {
  lumen_group_days: { M4: [0, 1, 2, 3, 4, 5, 6], T5: T5DAYS },
  stu_features: { retry: { on: true, off: [] }, hw: { on: true, off: [] } },
  ['hw_self_' + C[2]]: { byDate: { [D]: { p: 100, c: 100, w: 100, a: 100, at: AT, sub: SUB } }, upd: SUB },          /* 학생 100 − 선생님 80 = 20 → 배지 없음 */
  ['hw_self_' + C[3]]: { byDate: { [D]: { p: 100, c: 100, w: 60, at: AT } }, upd: AT },                              /* 학생 87 − 선생님 45 = 42 → 🙋87 */
  ['hw_self_' + C[4]]: { byDate: { [D]: { p: 30, c: 30, w: 60, at: AT } }, upd: AT },                                /* 학생 40 − 선생님 10 = 30 → 🙋40 (경계) */
  ['hw_self_' + C[5]]: { byDate: { [D]: { p: 60, c: 0, w: 0, aNone: true, at: AT, sub: SUB } }, upd: SUB },          /* 제출 · 20 */
  ['hw_self_' + C[6]]: { byDate: { [D]: { p: 100, c: 60, w: 30, aNone: true, at: AT } }, upd: AT },
  ['todo_' + C[2]]: { items: [ { id: 'hw:' + D + ':702', kind: 'book', title: '가짜 교재 20쪽', ref: '', src: 'hw', hw: true, due: D, n: 4, from: 20, to: 20, bookId: 702, book: '가짜 교재', tst: 'todo', tat: {}, auto: null, at: D + 'T00:00:00Z', unit: null, order: 1 } ], upd: D + 'T00:00:00Z' } };               /* 작성 중 · 63 */

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1900, height: 1100 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  const reqs = []; let faked = false; await pg.route(/^https?:\/\//, (r) => { reqs.push((faked ? 'after:' : 'boot:') + r.request().url()); r.abort(); });
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STORE, STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: clone(STORE), ups: [], toasts: [], q: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, desc: '',
        select() { return b; }, eq(k, v) { b.desc += ' eq:' + v; b.f.push((x) => x === v); return b; }, in(k, a) { b.desc += ' in:' + a.length + ':' + String(a[0] || ''); b.f.push((x) => a.indexOf(x) >= 0); return b; },
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
    window.supaSetItem = (k, v) => { T.store[k] = clone(v); T.ups.push({ tbl: 'lumen_store', keys: [k] }); return Promise.resolve(true); };
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.alert = m; };
    try { localStorage.setItem('lumen_xp_pub_at', String(Date.now())); } catch (e) {}
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {}
    try { groupDays.M4 = [0, 1, 2, 3, 4, 5, 6]; groupDays.T5 = STORE.lumen_group_days.T5; saveGroupDays(); } catch (e) {}
    try { ['M4', 'T5'].forEach((g) => { if (groupList.indexOf(g) < 0) groupList.push(g); }); } catch (e) {}
  }, { STORE, STUDENTS });
  faked = true;
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const txt = () => pg.evaluate(() => (document.getElementById('content') || document.body).innerText);
  const resetHw = () => pg.evaluate(({ HW0 }) => { students.forEach((s) => { s.lumen_hw = JSON.parse(JSON.stringify(HW0[s.id] || {})); }); try { saveStudents(); } catch (e) {} T.toasts.length = 0; T.ups.length = 0; HWC.pop = null; HWC.undo = null; HWSF.arm = ''; render(); }, { HW0 });
  const cell = (id, d) => pg.evaluate(({ id, d }) => {
    const el = document.getElementById('hwc-c-' + id + '-' + d); if (!el) return null; const cs = getComputedStyle(el);
    const steps = [...el.querySelectorAll('.hwk-steps i')].map((i) => getComputedStyle(i).backgroundColor);
    const b = el.querySelector('.hwk-bdg');
    return { kind: el.getAttribute('data-hwk'), tier: el.getAttribute('data-tier'), v: (el.querySelector('.hwk-v') || {}).textContent || '', who: (el.querySelector('.hwk-who') || {}).textContent || '',
      bg: cs.backgroundColor, bc: cs.borderTopColor, bs: cs.borderTopStyle, bw: cs.borderTopWidth, op: cs.opacity, oc: cs.outlineColor, os: cs.outlineStyle, ow: cs.outlineWidth, oo: cs.outlineOffset, sh: cs.boxShadow,
      steps, bdg: b ? b.textContent : '', bdgBg: b ? getComputedStyle(b).backgroundColor : '', w: el.offsetWidth, h: el.offsetHeight, fsV: el.querySelector('.hwk-v') ? parseFloat(getComputedStyle(el.querySelector('.hwk-v')).fontSize) : 0 };
  }, { id, d });
  const RGB = { g100: 'rgb(187, 247, 208)', s100: 'rgb(22, 163, 74)', g60: 'rgb(236, 252, 203)', s60: 'rgb(132, 204, 22)', g30: 'rgb(254, 215, 170)', s30: 'rgb(249, 115, 22)', g0: 'rgb(254, 202, 202)', s0: 'rgb(239, 68, 68)', na: 'rgb(203, 213, 225)', white: 'rgb(255, 255, 255)' };

  const ZM = await pg.evaluate(() => { const z = parseFloat(getComputedStyle(document.body).zoom || getComputedStyle(document.documentElement).zoom || '1'); const d = document.createElement('div'); d.style.cssText = 'border:2px solid red;position:absolute'; document.body.appendChild(d); const w = parseFloat(getComputedStyle(d).borderTopWidth) / 2; d.remove(); return w || z || 1; });   /* 학원앱 화면 확대 비율(2px 가 몇 px 로 보이나) */
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: hwkPaint · hwkRecent · hwkTapBase', await pg.evaluate(() => typeof hwkPaint === 'function' && typeof hwkRecent === 'function' && typeof window.hwkTapBase === 'function'));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWC_CM = ''; render(); }); await settle(600);
  await pg.waitForFunction(() => HWSF.loaded, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => render()); await settle(250);

  /* ① 4단 색 · 모양 */
  const c1 = await cell('S1', D), c2 = await cell('S2', D), c3 = await cell('S3', D), c4 = await cell('S4', D), c5 = await cell('S5', D), c6 = await cell('S6', D), c7 = await cell('S7', D), e1 = await cell('S1', D0);
  t('선생님 100 칸: 진초록 채움(#bbf7d0) + 실선(#16a34a) · 숫자 100', c1 && c1.kind === 'T' && c1.bg === RGB.g100 && c1.bc === RGB.s100 && c1.bs === 'solid' && c1.v === '100', JSON.stringify(c1));
  t('선생님 80 칸: 연두(#ecfccb · #84cc16) · 숫자 80', c2 && c2.kind === 'T' && c2.bg === RGB.g60 && c2.bc === RGB.s60 && c2.bs === 'solid' && c2.v === '80', JSON.stringify(c2));
  t('선생님 45 칸: 주황(#fed7aa · #f97316) · 숫자 45', c3 && c3.kind === 'T' && c3.bg === RGB.g30 && c3.bc === RGB.s30 && c3.v === '45', JSON.stringify(c3));
  t('선생님 10 칸: 빨강(#fecaca · #ef4444) · 숫자 10', c4 && c4.kind === 'T' && c4.bg === RGB.g0 && c4.bc === RGB.s0 && c4.v === '10', JSON.stringify(c4));
  t('학생 제출 칸(선생님 값 없음): 흰 바탕 + 같은 색 2px 점선(20 → 빨강) + 「🙋 제출」', c5 && c5.kind === 'S' && c5.bg === RGB.white && c5.bs === 'dashed' && Math.abs(parseFloat(c5.bw) / 2 - ZM) < 0.02 && c5.bc === RGB.s0 && c5.who === '🙋 제출' && c5.v === '20', JSON.stringify(c5));
  t('학생 작성 중 칸: 흰 바탕 + 점점선(63 → 연두) + 「✎ 작성 중」 · 조금 흐리게(.8)', c6 && c6.kind === 'D' && c6.bg === RGB.white && c6.bs === 'dotted' && c6.bc === RGB.s60 && c6.who === '✎ 작성 중' && c6.v === '63' && c6.op === '0.8', JSON.stringify(c6));
  t('아무 값 없는 칸: 빈 칸 그대로(숫자·띠 없음 · 연한 바탕)', c7 && c7.kind === '' && !c7.v && !c7.steps.length && c7.bg === 'rgb(251, 252, 254)' && e1 && e1.kind === '' && !e1.v, JSON.stringify([c7, e1]));
  t('칸 밖 알약 없음(v19-176 .hws-pill 0개) · 점 4개도 없음', await pg.evaluate(() => document.querySelectorAll('.hws-pill').length === 0 && document.querySelectorAll('.hws-dots').length === 0));

  /* ② 4칸 띠 · 보라 배지 */
  t('4칸 띠(선생님 45 칸 풀이 100·채점 30·오답 5·아하 해당 없음) = 초록·주황·빨강·회색', c3 && c3.steps.join('|') === [RGB.s100, RGB.s30, RGB.s0, RGB.na].join('|'), JSON.stringify(c3 && c3.steps));
  t('4칸 띠(학생 작성 중 100·60·30·아하 없음) = 초록·연두·주황·회색', c6 && c6.steps.join('|') === [RGB.s100, RGB.s60, RGB.s30, RGB.na].join('|'), JSON.stringify(c6 && c6.steps));
  t('보라 배지: 학생 87 − 선생님 45 = 42 → 「🙋87」(#7c3aed) · 차이 30 (40−10) 경계도 「🙋40」', c3.bdg === '🙋87' && c3.bdgBg === 'rgb(124, 58, 237)' && c4.bdg === '🙋40', JSON.stringify([c3.bdg, c3.bdgBg, c4.bdg]));
  t('보라 배지 없음: 차이 20(학생 100 · 선생님 80) · 학생 값 없는 칸 · 학생 칸 자체', !c2.bdg && !c1.bdg && !c5.bdg && !c6.bdg, JSON.stringify([c2.bdg, c1.bdg, c5.bdg]));

  /* ③ 오늘 칸 */
  t('오늘 칸 = 파란(#1d6fe8) 바깥선 2px · 간격 2px (빈 칸·학생 칸·선생님 칸 모두)', [c7, c5, c1].every((c) => c.oc === 'rgb(29, 111, 232)' && c.os === 'solid' && Math.abs(parseFloat(c.ow) / 2 - ZM) < 0.02 && Math.abs(parseFloat(c.oo) / 2 - ZM) < 0.02) && e1.os === 'none', JSON.stringify([c7.oc, c7.os, c7.ow, c7.oo, e1.os]));
  t('노란 테두리(#ffd54a) 그리드에 없음', await pg.evaluate(() => !/ffd54a|255, 213, 74/i.test(document.getElementById('hwc-wrap').innerHTML) && [...document.querySelectorAll('[id^="hwc-c-"]')].every((e) => !/255, 213, 74/.test(getComputedStyle(e).boxShadow))));

  /* ④ 줄 끝 「최근 4번」 */
  const rec = await pg.evaluate(() => { const o = {}; ['S1', 'S2', 'S3', 'S4', 'S5'].forEach((id) => { const td = document.querySelector('#hwc-row-' + id + ' td.hwk-rec'); const a = td && td.querySelector('.hwk-avg'); const tr = td && td.querySelector('.hwk-trend');
    o[id] = { has: !!td, last: td ? td === td.parentElement.lastElementChild : false, avg: a ? a.textContent : '', bg: a ? getComputedStyle(a).backgroundColor : '', col: a ? getComputedStyle(a).color : '', tr: tr ? tr.textContent : '', rc: !!(td && td.querySelector('.hwk-rc')), txt: td ? td.textContent : '' }; });
    o.head = !!document.querySelector('#hwc-wrap th.hwk-rec-h'); return o; });
  t('줄 끝 「최근 4번」 칸: 머리 · 학생 줄 맨 오른쪽', rec.head && rec.S1.has && rec.S1.last && rec.S5.has, JSON.stringify(rec.S1));
  t('○○○1 [100,100,30,30] → 65% 연두 칩(흰 글) ↗ · 🚑 없음 (5번째 옛 기록은 안 셈)', rec.S1.avg === '65%' && rec.S1.bg === 'rgb(101, 163, 13)' && rec.S1.col === RGB.white && rec.S1.tr === '↗' && !rec.S1.rc, JSON.stringify(rec.S1));
  t('○○○4 [10,0,100,100] → 53% 주황 ↘ + 「🚑 후보」(최근 3번 중 2번 60 미만)', rec.S4.avg === '53%' && rec.S4.bg === 'rgb(234, 88, 12)' && rec.S4.tr === '↘' && rec.S4.rc && /🚑 후보/.test(rec.S4.txt), JSON.stringify(rec.S4));
  t('○○○2 [80,80] → 80% → · ○○○3 한 번(45) → 칩만(추세·🚑 없음) · ○○○5 기록 없음', rec.S2.avg === '80%' && rec.S2.tr === '→' && !rec.S2.rc && rec.S3.avg === '45%' && !rec.S3.tr && !rec.S3.rc && !rec.S5.avg && /기록 없음/.test(rec.S5.txt), JSON.stringify([rec.S2, rec.S3, rec.S5]));
  t('🚑 후보 기준 = 학부모앱 미흡 기준(weakBelow) — 40 으로 낮추면 ○○○4 도 후보 아님', await pg.evaluate(() => { const st = students.find((s) => s.id === 'S4'); const a = hwkRecent(st).rc; HWC_CFG.v.weakBelow = 5; const b = hwkRecent(st).rc; HWC_CFG.v.weakBelow = 60; return a === true && b === false; }));

  /* ⑤ 반 머리 평균 */
  const cav = await pg.evaluate(() => [...document.querySelectorAll('.hwk-cavg')].map((x) => ({ g: x.parentElement.firstChild.nodeValue.trim(), avg: x.getAttribute('data-avg'), txt: x.textContent, bg: getComputedStyle(x).backgroundColor, cs: x.parentElement.getAttribute('colspan') })));
  const barIso = await pg.evaluate(() => document.getElementById('hws-bar').getAttribute('data-iso'));
  const M4 = cav.find((x) => x.g === 'M4'), T5 = cav.find((x) => x.g === 'T5');
  t('반 머리 M4: 띠 날짜(오늘) 평균 59% 주황 칩 (선생님 100·80·45·10)', barIso === D && M4 && M4.avg === '59' && /평균 59%/.test(M4.txt) && M4.bg === 'rgb(234, 88, 12)', JSON.stringify([barIso, M4]));
  t('반 머리 T5: 선생님 값 없으면 학생 제출 값(20, 작성 중은 뺌) → 20% 빨강 칩', T5 && T5.avg === '20' && T5.bg === 'rgb(220, 38, 38)', JSON.stringify(T5));
  t('반 머리 줄 colspan 이 한 칸 늘어 표가 안 틀어짐(날짜 수 + 3)', await pg.evaluate(() => { const n = document.querySelector('#hwc-wrap tr').children.length; const g = [...document.querySelectorAll('#hwc-wrap td[colspan]')]; const r = document.querySelector('#hwc-row-S1').children.length; return g.length >= 2 && g.every((x) => Number(x.getAttribute('colspan')) === n) && r === n; }));

  /* ⑥ 범례 */
  const lg = await pg.evaluate(() => { const l = document.getElementById('hwk-legend'); if (!l) return null; const w = l.querySelector('.hwk-weak'); const cs = w ? getComputedStyle(w) : null; return { n: l.querySelectorAll('.hwk-sw').length, weak: cs ? cs.borderLeftStyle + ' ' + cs.borderLeftColor : '', txt: l.textContent, inWrap: !!l.closest('#hwc-wrap'), beforeBar: l.nextElementSibling && l.nextElementSibling.id === 'hws-bar' }; });
  t('범례 한 줄: 4단 색 · 빨간 점선 「아래 = 학부모앱 미흡」 · 모양 3가지 · 띠 바로 위', lg && lg.n === 4 && lg.weak === 'dashed rgb(220, 38, 38)' && /학부모앱 「미흡」/.test(lg.txt) && /꽉 채움 = 선생님 확인/.test(lg.txt) && /점선 = 🙋 학생 제출/.test(lg.txt) && /점점선 = ✎ 작성 중/.test(lg.txt) && lg.beforeBar, JSON.stringify(lg));
  t('맨 위 띠 #hws-bar(v19-176) 그대로 · 알약 안내 문구 없음', await pg.evaluate(() => { const b = document.getElementById('hws-bar'); return !!b && !!b.querySelector('#hws-acc-all') && !/알약/.test(b.textContent) && /점선 칸/.test(b.textContent); }));
  t('반 머리 「🙋 n/m」 칩(v19-176) 그대로 — M4 오늘 1/4 · T5 오늘 1/3', await pg.evaluate(({ D }) => { const a = [...document.querySelectorAll('.hws-chip')].filter((b) => b.getAttribute('onclick').indexOf(D) >= 0).map((b) => b.textContent); return a.length === 2 && a.indexOf('🙋 1/4') >= 0 && a.indexOf('🙋 1/3') >= 0; }, { D }));
  if (SHOT_A) { await pg.setViewportSize({ width: 2300, height: 1100 }); await pg.evaluate(() => { const w = document.getElementById('hwc-wrap'); w.style.overflow = 'visible'; w.style.width = 'max-content'; w.scrollIntoView(); }); await settle(250);
    await pg.locator('#hwc-wrap').screenshot({ path: SHOT_A }); await pg.setViewportSize({ width: 1900, height: 1100 }); await pg.evaluate(() => render()); await settle(150); }

  /* ⑦ 탭 */
  await pg.evaluate(({ D }) => { T.ups.length = 0; T.toasts.length = 0; hwcTap('S5', D); }, { D }); await settle(400);
  const tp5 = await pg.evaluate(({ D, C5 }) => ({ hw: students.find((s) => s.id === 'S5').lumen_hw[D], undo: HWC.undo && HWC.undo.items && HWC.undo.items[0], pop: HWC.pop, toast: T.toasts.slice(-1)[0] || '', teach: T.store['hw_teach_' + C5], kind: document.getElementById('hwc-c-S5-' + D).getAttribute('data-hwk') }), { D, C5: C[5] });
  t('제출 칸 한 번 탭 → lumen_hw = 학생 값 {60,0,0} · 칸이 꽉 채움(선생님)으로', tp5.hw && tp5.hw.p === 60 && tp5.hw.c === 0 && tp5.hw.w === 0 && tp5.kind === 'T' && !tp5.pop, JSON.stringify(tp5));
  t('제출 칸 탭 → 되돌리기 기록(이전 값 없음) · 토스트 「학생 값 그대로」', tp5.undo && tp5.undo.id === 'S5' && tp5.undo.prev === null && /학생 값 그대로/.test(tp5.toast), JSON.stringify([tp5.undo, tp5.toast]));
  t('제출 칸 탭 → hw_teach_ 발행(byDate[오늘] = {p:60,c:0,w:0,t})', tp5.teach && tp5.teach.byDate && tp5.teach.byDate[D] && tp5.teach.byDate[D].p === 60 && typeof tp5.teach.byDate[D].t === 'number', JSON.stringify(tp5.teach));
  await pg.evaluate(() => hwcUndo()); await settle(200);
  t('↩ 되돌리기 → 다시 학생 제출 칸(점선)', await pg.evaluate(({ D }) => !students.find((s) => s.id === 'S5').lumen_hw[D] && document.getElementById('hwc-c-S5-' + D).getAttribute('data-hwk') === 'S', { D }));
  await pg.evaluate(({ D }) => { T.ups.length = 0; hwcTap('S6', D); }, { D }); await settle(300);
  const tp6 = await pg.evaluate(({ D }) => { const p = document.getElementById('hwc-pop'); const b = p && [...p.querySelectorAll('button')].find((x) => /전부 100%/.test(x.textContent)); return { hw: students.find((s) => s.id === 'S6').lumen_hw[D], pop: HWC.pop, open: !!p, sec: !!(p && p.querySelector('.hws-pop')), btn: b ? b.getAttribute('onclick') : '', ups: T.ups.length }; }, { D });
  t('작성 중 칸 탭 → 세부 창(학생 칸 포함) 열림 · 저장 없음', tp6.pop === 'S6|' + D && tp6.open && tp6.sec && !tp6.hw && tp6.ups === 0, JSON.stringify(tp6));
  await pg.evaluate(() => { const p = document.getElementById('hwc-pop'); [...p.querySelectorAll('button')].find((x) => /전부 100%/.test(x.textContent)).click(); }); await settle(300);
  t('그 창의 「🟢 전부 100%」 는 바탕 규칙 그대로 → {100,100,100}', await pg.evaluate(({ D }) => { const v = students.find((s) => s.id === 'S6').lumen_hw[D]; return v && v.p === 100 && v.c === 100 && v.w === 100 && !HWC.pop; }, { D }));
  await pg.evaluate(({ D }) => hwcTap('S7', D), { D }); await settle(250);
  t('빈 칸 탭 → 바탕 규칙 100·100·100', await pg.evaluate(({ D }) => { const v = students.find((s) => s.id === 'S7').lumen_hw[D]; return v && v.p === 100 && v.c === 100 && v.w === 100; }, { D }));
  await pg.evaluate(({ D }) => hwcTap('S1', D), { D }); await settle(250);
  const tp1 = await pg.evaluate(({ D }) => ({ v: students.find((s) => s.id === 'S1').lumen_hw[D], pop: HWC.pop }), { D });
  await pg.evaluate(({ D }) => { HWC.pop = null; hwcTap('S2', D); }, { D }); await settle(250);
  const tp2 = await pg.evaluate(({ D }) => students.find((s) => s.id === 'S2').lumen_hw[D], { D });
  t('선생님 값 칸 → 바탕 규칙(100 → 0 + 창 · 80(학생 제출 있어도) → 100)', tp1.v && tp1.v.p === 0 && tp1.v.c === 0 && tp1.pop === 'S1|' + D && tp2 && tp2.p === 100 && tp2.w === 100, JSON.stringify([tp1, tp2]));

  /* ⑧ 수업 모드 */
  await resetHw();
  await pg.evaluate(() => { HWC_CM = 'T5'; render(); }); await settle(400);
  const m5 = await cell('S5', D), m6 = await cell('S6', D), m7 = await cell('S7', D);
  const cmx = await pg.evaluate(() => ({ cm: !!document.getElementById('hwc-cm'), lg: !!document.querySelector('#hwc-cm #hwk-legend'), rec: document.querySelectorAll('#hwc-cm .hwk-rec').length, pill: document.querySelectorAll('.hws-pill').length }));
  t('수업 모드: 제출 칸 점선 빨강 「🙋 제출」 · 작성 중 점점선 연두 · 칸 52px · 숫자 15px(조금 크게)', cmx.cm && m5 && m5.kind === 'S' && m5.bs === 'dashed' && m5.bc === RGB.s0 && m5.who === '🙋 제출' && m5.w === 52 && m5.fsV === 15 && m6.kind === 'D' && m6.bs === 'dotted' && m6.bc === RGB.s60, JSON.stringify([m5, m6]));
  t('수업 모드: 오늘 빈 칸 파란 바깥선 · 범례 있음 · 알약·줄 끝 없음', m7 && m7.oc === 'rgb(29, 111, 232)' && m7.os === 'solid' && cmx.lg && cmx.rec === 0 && cmx.pill === 0, JSON.stringify([m7 && m7.oc, cmx]));
  await pg.evaluate(() => { HWC_CM = 'M4'; render(); }); await settle(300);
  const m1 = await cell('S1', D), m3 = await cell('S3', D);
  t('수업 모드 M4(매일 반, 작은 칸): 선생님 100 진초록 · 45 주황 + 🙋87 배지', m1 && m1.bg === RGB.g100 && m1.bs === 'solid' && m3 && m3.bg === RGB.g30 && m3.bdg === '🙋87', JSON.stringify([m1, m3]));
  await pg.evaluate(() => { HWC_CM = ''; render(); }); await settle(200);

  /* ⑨ 회귀 */
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(400);
  const home = await txt(); t('홈이 그려짐', home.length > 200, home.slice(0, 100));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'stu'; render(); }); await settle(250);
  t('숙제체크 학생별 보기엔 범례·띠·칸 색 안 붙음', await pg.evaluate(() => !document.getElementById('hwk-legend') && !document.getElementById('hws-bar') && !document.querySelector('[data-hwk]') && (document.getElementById('content') || document.body).innerText.length > 100));
  await pg.evaluate(() => { HWC_VIEW = 'grid'; render(); }); await settle(250);
  t('숙제체크 그리드 그대로(표 · ✅ 한 번에 · 띠)', await pg.evaluate(() => { const c = document.getElementById('content') || document.body; return !!c.querySelector('#hwc-wrap table') && !!c.querySelector('#hws-bar') && c.querySelectorAll('button[onclick^="hwcAllDone("]').length > 10; }));
  await pg.evaluate(() => { VIEW = 'todo'; TD.tab = 'board'; render(); }); await settle(300);
  const tdx = await txt(); t('할 일 보드 「📋 보드」 탭 그대로', /배정됨/.test(tdx) && /확인 끝/.test(tdx), tdx.slice(0, 300));
  await pg.evaluate(() => { VIEW = 'recovery'; GRP = groupOfView('recovery'); try { RC.view = 'board'; } catch (e) {} render(); }); await settle(500);
  t('리커버리 보드 그려짐', await pg.evaluate(() => (document.getElementById('content') || document.body).innerText.length > 100 && !/오류/.test((document.getElementById('content') || document.body).innerText.slice(0, 200))));
  t('가짜 서버 쓰기는 등록부·hw_teach_ 등만(학생 키 hw_self_ 안 씀)', await pg.evaluate(() => [].concat.apply([], T.ups.map((u) => u.keys)).every((k) => !/^hw_self_/.test(k))));
  t('실서버 질의 없음(외부망 전부 차단 · 가짜 서버만)', reqs.filter((r) => /after:.*supabase/.test(r)).length === 0, reqs.filter((r) => /after:/.test(r)).slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
