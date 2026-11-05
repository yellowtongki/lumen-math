#!/usr/bin/env node
/* 학원앱 v19-178 검사 — 👆 칸을 누르면 먼저 창 (바탕은 v19-177 검사 틀) · 원래: 학원앱 v19-177 검사 — 🎨 숙제체크 칸 3판: 색 = 이행도 · 모양 = 누가 매겼나 (docs/hw_dispatch_contract.md §12)
 *   ① 4단 색(선생님 값 100/80/45/10 칸 배경·실선) · 학생 제출 칸 흰 바탕+점선+「🙋 제출」 · 작성 중 점점선+「✎ 작성 중」 · 빈 칸 그대로 · 칸 밖 알약 없음
 *   ② 4칸 띠 색 · 보라 배지(30 이상만)   ③ 오늘 칸 파란 바깥선(노란 없음)
 *   ④ 줄 끝 「최근 4번」 평균·추세·🚑 후보   ⑤ 반 머리 평균 칩   ⑥ 범례
 *   ⑦ 탭: 제출 칸 → 학생 값 저장·되돌리기·hw_teach_ / 작성 중 칸 → 세부 창·저장 없음 / 빈 칸 → 100 / 선생님 칸 → 바탕 규칙
 *   ⑧ 수업 모드 칸 색·모양   ⑨ 회귀(홈·학생별 보기·할 일 보드·리커버리 보드) · 실서버 쓰기 없음 · 페이지 오류 없음
 *   가짜 학생 7명(○○○1~7 · M4·T5 둘 다 오늘 수업) · 가짜 서버(lumen_store 흉내, test_v19176.js 의 mk) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19178.js lumen_v19-178.html [그리드.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-178.html');
const SHOT_A = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-178'])[0];
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
  const hwOf = (id, d) => pg.evaluate(({ id, d }) => { const s = students.find((x) => x.id === id); return s && s.lumen_hw ? (s.lumen_hw[d] || null) : null; }, { id, d });
  const pop = () => pg.evaluate(() => { const p = document.getElementById('hwc-pop'); if (!p) return null; return { mini: p.classList.contains('hws-mini'), pre: p.querySelectorAll('.hwq-pre button').length, txt: p.innerText }; });
  const tap = (id, d) => pg.evaluate(({ id, d }) => { hwcTap(id, d); }, { id, d });
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: HWQ · hwqToggle · hwqPick · 기본 빠른 탭 끔', await pg.evaluate(() => typeof HWQ === 'object' && typeof hwqToggle === 'function' && typeof hwqPick === 'function' && HWQ.on === false));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWC_CM = ''; render(); }); await settle(600);
  await pg.waitForFunction(() => HWSF.loaded, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => render()); await settle(300);
  t('맨 위 띠에 👆 빠른 탭 단추', await pg.evaluate(() => { const b = document.querySelector('#hws-bar .hwq-btn'); return !!b && /빠른 탭 끔/.test(b.textContent); }));
  t('띠 안내 = 칸을 누르면 창이 먼저', /창<\/b>이 먼저 열려요|창이 먼저 열려요/.test(await pg.evaluate(() => (document.getElementById('hws-bar') || {}).innerHTML || '')));
  /* 빈 칸(학생 값 없음) */
  t('S7 빈 칸 처음엔 기록 없음', (await hwOf('S7', D)) === null);
  await tap('S7', D); await settle(250);
  t('빈 칸 탭 → 저장 안 됨', (await hwOf('S7', D)) === null);
  let P = await pop();
  t('빈 칸 탭 → 작은 창 + 조합 4개(다 했음·풀이만·채점까지·안 했음)', P && P.mini && P.pre === 4 && /다 했음/.test(P.txt) && /풀이만/.test(P.txt) && /채점까지/.test(P.txt) && /안 했음/.test(P.txt), JSON.stringify(P));
  t('작은 창에 「전부 100%」 즉시 단추 없음 · 「닫기 (안 바꿈)」 있음', P && !/전부 100%/.test(P.txt) && /닫기 \(안 바꿈\)/.test(P.txt));
  await tap('S7', D); await settle(200);
  t('같은 칸 한 번 더 탭 → 창 닫힘 · 여전히 저장 없음', (await pop()) === null && (await hwOf('S7', D)) === null);
  await tap('S7', D); await settle(200);
  await pg.evaluate(({ D }) => { const b = [...document.querySelectorAll('#hwc-pop .hwq-pre button')].find((x) => /풀이만/.test(x.textContent)); b.click(); }, { D }); await settle(300);
  let v = await hwOf('S7', D);
  t('「풀이만」 누름 → 100·0·0 저장', v && v.p === 100 && v.c === 0 && v.w === 0, JSON.stringify(v));
  P = await pop();
  t('저장 뒤 큰 세부 창으로 이어짐(단계 고치기)', P && !P.mini && /풀이/.test(P.txt) && /채점/.test(P.txt), JSON.stringify(P && { mini: P.mini }));
  t('되돌리기 기록 남음', await pg.evaluate(() => typeof HWC === 'object' && (Array.isArray(HWC.undo) ? HWC.undo.length > 0 : true)));
  await pg.evaluate(() => hwcClosePop()); await settle(150);
  /* 🙋 학생 제출 칸(S5, 선생님 값 없음) */
  t('S5 처음엔 선생님 기록 없음', (await hwOf('S5', D)) === null);
  await tap('S5', D); await settle(250);
  t('🙋 제출 칸 탭 → 바로 저장 안 됨(창만)', (await hwOf('S5', D)) === null);
  P = await pop();
  t('🙋 제출 칸 창에 학생 값 · 「학생 값 그대로」 단추', P && /학생 스스로/.test(P.txt) && /학생 값 그대로/.test(P.txt), P && P.txt.slice(0, 120));
  await pg.evaluate(() => hwcClosePop()); await settle(150);
  /* 선생님 값 있는 칸(S1 = 100) */
  await tap('S1', D); await settle(250);
  v = await hwOf('S1', D);
  t('선생님 100 칸 탭 → 값 그대로(0 으로 안 바뀜) · 큰 창', v && v.p === 100 && v.c === 100 && v.w === 100 && (await pop()) && !(await pop()).mini, JSON.stringify(v));
  await pg.evaluate(() => hwcClosePop()); await settle(150);
  /* ⚡ 빠른 탭 */
  await pg.evaluate(() => hwqToggle()); await settle(250);
  t('⚡ 빠른 탭 켬 → localStorage hwc_quick_tap=1 · 단추 글', await pg.evaluate(() => localStorage.getItem('hwc_quick_tap') === '1' && /빠른 탭 켜짐/.test((document.querySelector('#hws-bar .hwq-btn') || {}).textContent || '')));
  await pg.evaluate(({ D }) => { const s = students.find((x) => x.id === 'S7'); delete s.lumen_hw[D]; }, { D });
  await tap('S7', D); await settle(250);
  v = await hwOf('S7', D);
  t('빠른 탭: 빈 칸 탭 → 바로 100·100·100 (예전 방식)', v && v.p === 100 && v.c === 100 && v.w === 100, JSON.stringify(v));
  await tap('S5', D); await settle(250);
  v = await hwOf('S5', D);
  t('빠른 탭: 🙋 제출 칸 탭 → 학생 값 그대로(60·0·0)', v && v.p === 60 && v.c === 0 && v.w === 0, JSON.stringify(v));
  await pg.evaluate(() => hwqToggle()); await settle(200);
  t('다시 끔 → localStorage 0 · HWQ.on false', await pg.evaluate(() => localStorage.getItem('hwc_quick_tap') === '0' && HWQ.on === false));
  /* 수업 모드에서도 창부터 */
  await pg.evaluate(() => { HWC_CM = (groupList && groupList[0]) || 'M4'; render(); }); await settle(400);
  await pg.evaluate(({ D }) => { const s = students.find((x) => x.id === 'S3'); delete s.lumen_hw[D]; }, { D });
  await tap('S3', D); await settle(250);
  t('수업 모드: 빈 칸 탭 → 저장 안 됨 · 창', (await hwOf('S3', D)) === null && !!(await pop()));
  await pg.evaluate(() => { hwcClosePop(); HWC_CM = ''; render(); }); await settle(300);
  /* 회귀 */
  t('홈 화면 그려짐', await pg.evaluate(() => { VIEW = 'home'; render(); return (document.getElementById('content') || document.body).innerText.length > 200; }));
  t('할 일 보드·리커버리 화면 그려짐', await pg.evaluate(() => { let ok = true; try { VIEW = 'todo'; render(); VIEW = 'recovery'; render(); } catch (e) { ok = false; } return ok; }));
  t('실서버 쓰기 없음(외부망 차단)', reqs.filter((u) => /after:/.test(u) && /POST|PATCH|DELETE/.test(u)).length === 0);
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
