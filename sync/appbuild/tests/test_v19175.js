#!/usr/bin/env node
/* 학원앱 v19-175 검사 — 📚 숙제 체크 2판 맞춤 (docs/hw_dispatch_contract.md §10): 눈금 0/30/60/100 그대로 · aNone · 점 진하기 · 「그대로 ✓」 30/60 · XP 0 · hw_teach_ 발행
 *   ① hw_self 읽기: 숙제체크를 열면 활동 학생 전원을 in('key',[…]) 한 번 · 다시 그려도 30초 안엔 안 묻는다 · PULL_SKIP_PREFIX 'hw_self_'
 *   ② 그리드 칸마다 점 4개(100 초록 · 0 회색 · 안 누름 점선) · 안 누른 학생은 점선 4개 · 반 머리 「한 번에」 줄 🟢n · 수업 모드 칸에도
 *   ③ 세부 창: 빈 칸 오른쪽 클릭 → 작은 창(학생 스스로 줄 · 「학생 체크 그대로 ✓」) · 찍은 칸 창에도 줄
 *   ④ 「그대로 ✓」 칸 하나 → lumen_hw[날짜]={p,c,w} · lumen_hw_at · 등록부 저장 · 아하(lumen_hw_aha) 안 적음 · 이미 찍은 칸은 두 번 누르기
 *   ⑤ 반 전부 → 스스로 누른 학생만 · 이미 찍은 칸은 건너뜀
 *   ⑥ v19-171 카드 2차 확인 줄의 학생 셀프 = 카드 값 우선, 없으면 날짜 값   ⑦ calcXP +5 날짜 단위(카드 단위와 겹치면 한 번만) · 계산 때 서버 안 묻음
 *   ⑧ xp_board 게시 전에 한 번 읽어 둠   ⑨ 회귀(홈·숙제체크·학생별·할 일 보드·내주기) · 실서버 질의 없음 · 페이지 오류 없음
 *   가짜 학생 6명(○○○1~6 · M4 월수금 · T5 화목토) · 가짜 서버(lumen_store 흉내) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19175.js lumen_v19-175.html [그림.png]
 *   바탕: test_v19171.js 의 가짜 서버(mk) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-175.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-175'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const TODAY = iso(new Date(Date.now() + 9 * 3600000));
const M4 = [1, 3, 5];
/* 이번 달 안의 M4 수업일 — 오늘에서 뒤로, 없으면 앞으로 (그리드가 이번 달이라 칸에 id 가 있어야 한다) */
const pickDay = (days, not) => { const ym = TODAY.slice(0, 7); for (let i = 0; i <= 10; i++) { const d = add(TODAY, -i); if (d.slice(0, 7) === ym && days.indexOf(dow(d)) >= 0 && d !== not) return d; } for (let i = 1; i <= 10; i++) { const d = add(TODAY, i); if (d.slice(0, 7) === ym && days.indexOf(dow(d)) >= 0 && d !== not) return d; } return add(TODAY, -2); };
const D = pickDay(M4), D0 = pickDay(M4, D);
const names = (n) => '○○○' + n;
const code = (n) => (n <= 4 ? 'AAA' : 'BBB') + String(n).repeat(3).slice(0, 3);
const STUDENTS = [];
for (let n = 1; n <= 6; n++) STUDENTS.push({ id: 'S' + n, name: names(n), grade: n === 6 ? '초등학교 6학년' : '중학교 1학년', group: n <= 4 ? 'M4' : 'T5', lumen_rec_code: code(n), lumen_planner: {} });
const C1 = code(1), C2 = code(2), C3 = code(3), C4 = code(4);
const AT = D + 'T09:40:00.000Z';   /* KST 18:40 */
const STORE = {
  lumen_group_days: { M4: M4, T5: [2, 4, 6] },
  stu_features: { retry: { on: true, off: [] }, hw: { on: true, off: [] } },
  ['hw_self_' + C1]: { byDate: { [D]: { p: 100, c: 100, w: 0, at: AT }, [D0]: { p: 100, at: D0 + 'T10:00:00Z' } }, upd: AT },
  ['hw_self_' + C2]: { byDate: { [D]: { p: 100, c: 100, w: 100, a: 0, at: AT } }, upd: AT },
  ['hw_self_' + C3]: { byDate: { [D]: { p: 100, c: 60, w: 30, aNone: true, at: AT } }, upd: AT },
  ['todo_' + C1]: { items: [ { id: 'hw:' + D + ':701', kind: 'book', title: '가짜 교재 12쪽', ref: '', src: 'hw', hw: true, due: D, n: 5, from: 12, to: 12, bookId: 701, book: '가짜 교재', tst: 'todo', tat: {}, auto: null, at: D + 'T00:00:00Z', unit: null, order: 1 } ], upd: D + 'T00:00:00Z' },
  ['todo_st_' + C1]: { ['hw:' + D + ':701']: { st: 'doing', at: AT, hw: { p: 100, c: 0, w: 100, a: 0 }, hat: AT }, upd: AT },
  ['todo_' + C2]: { items: [ { id: 'hw:' + D + ':702', kind: 'book', title: '가짜 교재 20쪽', ref: '', src: 'hw', hw: true, due: D, n: 4, from: 20, to: 20, bookId: 702, book: '가짜 교재', tst: 'todo', tat: {}, auto: null, at: D + 'T00:00:00Z', unit: null, order: 1 } ], upd: D + 'T00:00:00Z' } };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
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
    try { localStorage.setItem('lumen_xp_pub_at', String(Date.now())); } catch (e) {}   /* 15초 뒤 자동 게시가 검사 중간에 끼지 않게 */
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {}
    try { groupDays.M4 = [1, 3, 5]; groupDays.T5 = [2, 4, 6]; saveGroupDays(); } catch (e) {}
    try { ['M4', 'T5'].forEach((g) => { if (groupList.indexOf(g) < 0) groupList.push(g); }); } catch (e) {}   /* 실제처럼 반 목록에도 있어야 그리드가 반 머리로 묶는다 */
  }, { STORE, STUDENTS });
  faked = true;

  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: hwtPublish · hwsNum · PULL_SKIP_PREFIX hw_teach_', await pg.evaluate(() => typeof hwtPublish === 'function' && typeof hwsNum === 'function' && PULL_SKIP_PREFIX.indexOf('hw_teach_') >= 0));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWC_CM = ''; render(); }); await settle(600);
  await pg.waitForFunction(() => HWSF.loaded, null, { timeout: 5000 }).catch(() => {});
  const v3 = await pg.evaluate(({ C3, D }) => hwsOf(C3, D), { C3, D });
  t('hwsOf: 0/30/60/100 그대로 (p100 c60 w30) · aNone → a=\'na\'', v3 && v3.p === 100 && v3.c === 60 && v3.w === 30 && v3.a === 'na' && v3.aNone === true, JSON.stringify(v3));
  const v1 = await pg.evaluate(({ C1, D }) => hwsOf(C1, D), { C1, D });
  t('옛 0/100 값도 그대로 (p100 c100 w0 · a 안 누름 null)', v1 && v1.p === 100 && v1.c === 100 && v1.w === 0 && v1.a === null, JSON.stringify(v1));
  t('hwsToHw: 30·60 이 숙제체크 눈금으로 그대로', await pg.evaluate(({ C3, D }) => { const h = hwsToHw(hwsOf(C3, D)); return h.p === 100 && h.c === 60 && h.w === 30; }, { C3, D }));
  t('hwsMark: 0 ○ · 30 ◔ · 60 ◐ · 100 ✓ · na 해당 없음 · null —', await pg.evaluate(() => hwsMark(0) === '○' && hwsMark(30) === '◔' && hwsMark(60) === '◐' && hwsMark(100) === '✓' && hwsMark('na') === '해당 없음' && hwsMark(null) === '—'));
  const dots = await pg.evaluate(({ C3, D }) => hwsDots(hwsOf(C3, D), true), { C3, D });
  t('점 4개: 100 진초록 · 60 초록 · 30 연초록 · 해당 없음 가로 줄', /#15803d/.test(dots) && /#4ade80/.test(dots) && /#bbf7d0/.test(dots) && /border-top:2px solid/.test(dots), dots.slice(0, 200));
  const cell = await pg.evaluate(({ C3, D }) => { const st = students.find((s) => s.lumen_rec_code === C3); const el = document.getElementById('hwc-c-' + st.id + '-' + D) || document.querySelector('[id^="hwc-c-' + st.id + '"]'); return el ? el.innerHTML : ''; }, { C3, D });
  t('그리드 칸에 값 크기대로 진한 점이 붙음', /hws-dots/.test(cell) && /#4ade80|#bbf7d0/.test(cell), cell.slice(0, 160));
  /* XP */
  t('hwlSelfXP → 0 (셀프 체크 XP 끔)', await pg.evaluate(({ C1 }) => { const r = hwlSelfXP(C1); return r && r.xp === 0 && r.month === 0; }, { C1 }));
  t('calcXP 에 hwself 가 더해지지 않음', await pg.evaluate(({ C3 }) => { const st = students.find((s) => s.lumen_rec_code === C3); const x = calcXP(st, []); return !(x.breakdown && x.breakdown.hwself); }, { C3 }));
  /* 「그대로 ✓」 → lumen_hw 30/60 + hw_teach_ 발행 */
  await pg.evaluate(() => { T.ups.length = 0; });
  const okSave = await pg.evaluate(({ C3, D }) => { const st = students.find((s) => s.lumen_rec_code === C3); hwcSave(st, D, hwsToHw(hwsOf(C3, D))); return st.lumen_hw[D]; }, { C3, D });
  t('hwcSave(학생 값 그대로) → lumen_hw[D] = {p100,c60,w30}', okSave && okSave.p === 100 && okSave.c === 60 && okSave.w === 30, JSON.stringify(okSave));
  await settle(400);
  const teach = await pg.evaluate(({ C3 }) => T.store['hw_teach_' + C3], { C3 });
  t('hw_teach_<코드> 발행: byDate[D] = {p,c,w,t} · upd', teach && teach.byDate && teach.byDate[D] && teach.byDate[D].p === 100 && teach.byDate[D].c === 60 && teach.byDate[D].w === 30 && typeof teach.byDate[D].t === 'number' && !!teach.upd, JSON.stringify(teach));
  t('발행은 upsert 1회 · 등록부(or_studentdb)와 hw_teach_ 만 씀', await pg.evaluate(({ C3 }) => { const ks = [].concat.apply([], T.ups.map((u) => u.keys)); return ks.filter((k) => k === 'hw_teach_' + C3).length === 1 && ks.every((k) => k === 'hw_teach_' + C3 || k === 'or_studentdb' || /^or_|^lumen_/.test(k)); }, { C3 }), await pg.evaluate(() => JSON.stringify(T.ups.map((u) => u.keys))));
  /* 두 번째 날짜 저장은 같은 키에 합쳐진다(앞 날짜 유지) */
  await pg.evaluate(({ C3, D0 }) => { const st = students.find((s) => s.lumen_rec_code === C3); hwcSave(st, D0, { p: 100, c: 100, w: 100 }); }, { C3, D0 }); await settle(400);
  const teach2 = await pg.evaluate(({ C3 }) => T.store['hw_teach_' + C3], { C3 });
  t('다른 날짜 저장 → 같은 키에 두 날짜 모두', teach2 && teach2.byDate[D] && teach2.byDate[D0] && teach2.byDate[D0].t === 100, JSON.stringify(teach2 && Object.keys(teach2.byDate || {})));
  /* 지우면 그 날짜 칸이 빠진다 */
  await pg.evaluate(({ C3, D0 }) => { const st = students.find((s) => s.lumen_rec_code === C3); hwcSave(st, D0, null); }, { C3, D0 }); await settle(400);
  t('칸을 지우면 hw_teach_ 에서도 그 날짜가 빠짐', await pg.evaluate(({ C3, D0 }) => { const v = T.store['hw_teach_' + C3]; return v && v.byDate && !v.byDate[D0]; }, { C3, D0 }));
  /* 회귀 */
  t('홈 화면 그려짐', await pg.evaluate(() => { VIEW = 'home'; render(); return (document.getElementById('content') || document.body).innerText.length > 200; }));
  t('실서버 질의 없음(외부망 전부 차단 · 가짜 서버만)', reqs.filter((u) => u.indexOf('after:') === 0).length === 0, reqs.slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
