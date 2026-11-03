#!/usr/bin/env node
/* 학원앱 v19-173 검사 — 🟢 학생 스스로 숙제 체크(hw_self_<코드>) 를 숙제체크 화면에 (docs/hw_dispatch_contract.md §9-3)
 *   ① hw_self 읽기: 숙제체크를 열면 활동 학생 전원을 in('key',[…]) 한 번 · 다시 그려도 30초 안엔 안 묻는다 · PULL_SKIP_PREFIX 'hw_self_'
 *   ② 그리드 칸마다 점 4개(100 초록 · 0 회색 · 안 누름 점선) · 안 누른 학생은 점선 4개 · 반 머리 「한 번에」 줄 🟢n · 수업 모드 칸에도
 *   ③ 세부 창: 빈 칸 오른쪽 클릭 → 작은 창(학생 스스로 줄 · 「학생 체크 그대로 ✓」) · 찍은 칸 창에도 줄
 *   ④ 「그대로 ✓」 칸 하나 → lumen_hw[날짜]={p,c,w} · lumen_hw_at · 등록부 저장 · 아하(lumen_hw_aha) 안 적음 · 이미 찍은 칸은 두 번 누르기
 *   ⑤ 반 전부 → 스스로 누른 학생만 · 이미 찍은 칸은 건너뜀
 *   ⑥ v19-171 카드 2차 확인 줄의 학생 셀프 = 카드 값 우선, 없으면 날짜 값   ⑦ calcXP +5 날짜 단위(카드 단위와 겹치면 한 번만) · 계산 때 서버 안 묻음
 *   ⑧ xp_board 게시 전에 한 번 읽어 둠   ⑨ 회귀(홈·숙제체크·학생별·할 일 보드·내주기) · 실서버 질의 없음 · 페이지 오류 없음
 *   가짜 학생 6명(○○○1~6 · M4 월수금 · T5 화목토) · 가짜 서버(lumen_store 흉내) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19173.js lumen_v19-173.html [그림.png]
 *   바탕: test_v19171.js 의 가짜 서버(mk) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-173.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-173'])[0];
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
  ['hw_self_' + C3]: { byDate: { [D]: { p: 100, c: 0, w: 0, a: 0, at: AT } }, upd: AT },
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
  const txt = () => pg.evaluate(() => (document.getElementById('content') || document.body).innerText);
  const qSelf = () => pg.evaluate(() => T.q.filter((q) => /in:\d+:hw_self_/.test(q)).length);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: HWSF · hwsLoad · hwsDecorate · HWS.by 가 같은 객체', await pg.evaluate(() => typeof HWSF === 'object' && typeof hwsLoad === 'function' && typeof hwsDecorate === 'function' && HWS.by === HWSF.by));
  t('PULL_SKIP_PREFIX 에 hw_self_ (기기에 저장 안 함)', await pg.evaluate(() => PULL_SKIP_PREFIX.indexOf('hw_self_') >= 0));
  t('화면을 열기 전엔 hw_self 질의 없음', (await qSelf()) === 0);

  /* ── ① 읽기 ── */
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWC_CM = ''; render(); }); await settle(600);
  await pg.waitForFunction(() => HWSF.loaded && TD.loaded, null, { timeout: 5000 }).catch(() => {});
  await pg.evaluate(() => render()); await settle(200);
  const q1 = await qSelf();
  t('숙제체크를 열면 hw_self_* 를 in 질의 한 번(활동 학생 6명 묶음)', q1 === 1 && (await pg.evaluate(() => T.q.filter((q) => /in:6:hw_self_/.test(q)).length)) === 1, JSON.stringify(await pg.evaluate(() => T.q.filter((q) => /hw_self/.test(q)))));
  await pg.evaluate(() => { render(); render(); render(); }); await settle(300);
  t('다시 그려도 30초 안엔 또 묻지 않음(캐시)', (await qSelf()) === q1, String(await qSelf()));
  const rd = await pg.evaluate(({ C1, C4, D }) => ({ c1: (HWSF.by[C1] || {}).byDate && HWSF.by[C1].byDate[D], c4: HWSF.by[C4], v: hwsOf(C1, D), err: HWSF.err, n: Object.keys(HWSF.by).length }), { C1, C4, D });
  t('읽은 값: HWSF.by[코드].byDate[날짜] · hwsOf → p100 c100 w0 a(안 누름)=null · 3명', rd.c1 && rd.c1.p === 100 && !rd.c4 && rd.v && rd.v.p === 100 && rd.v.c === 100 && rd.v.w === 0 && rd.v.a === null && rd.n === 3 && !rd.err, JSON.stringify(rd));

  /* ── ② 칸 점 4개 · 반 머리 🟢n ── */
  const dots = await pg.evaluate(({ D }) => {
    const get = (id) => { const el = document.getElementById(id); if (!el) return null; const is = [...el.querySelectorAll('.hws-dots i')]; return { n: is.length, sty: is.map((i) => (i.style.background || '') + '|' + (i.style.border || '')), has: el.querySelector('.hws-dots') && el.querySelector('.hws-dots').getAttribute('data-hws'), ctx: el.getAttribute('oncontextmenu') || '', title: el.getAttribute('title') || '' }; };
    return { s1: get('hwc-c-S1-' + D), s4: get('hwc-c-S4-' + D), s5: get('hwc-c-S5-' + D), bar: !!document.getElementById('hws-bar'), total: document.querySelectorAll('#hwc-wrap .hws-dots').length };
  }, { D });
  t('칸에 점 4개: 풀이·채점 초록 · 오답 회색 · 아하 점선 · 설명에 「학생 스스로」 줄 · 빈 칸도 오른쪽 클릭 가능', dots.s1 && dots.s1.n === 4 && /22, 163, 74|#16a34a/.test(dots.s1.sty[0]) && /22, 163, 74|#16a34a/.test(dots.s1.sty[1]) && /203, 213, 225|#cbd5e1/.test(dots.s1.sty[2]) && /dashed/.test(dots.s1.sty[3]) && dots.s1.has === 'y' && /hwcOpenPop/.test(dots.s1.ctx) && /학생 스스로: 풀이 ✓ · 채점 ✓ · 오답 ○ · 아하 — · 18:40/.test(dots.s1.title), JSON.stringify(dots.s1));
  t('안 누른 학생 칸은 점선 4개 · 안내 줄 · 그리드 전체에 점이 붙음', dots.s4 && dots.s4.n === 4 && dots.s4.has === 'n' && dots.s4.sty.every((s) => /dashed/.test(s)) && dots.bar && dots.total >= 50, JSON.stringify({ s4: dots.s4, bar: dots.bar, total: dots.total }));
  const hb = await pg.evaluate(({ D }) => { const b = [...document.querySelectorAll('button.hws-acc')].filter((x) => x.getAttribute('onclick') === "hwsAcceptClass('M4','" + D + "')")[0]; return { has: !!b, txt: b ? b.innerText : '', title: b ? b.title : '', t5: [...document.querySelectorAll('button.hws-acc')].filter((x) => /T5/.test(x.getAttribute('onclick'))).length }; }, { D });
  t('반 머리 「한 번에」 줄에 🟢3 (M4 반 스스로 누른 3명) · T5 반(아무도 안 누름)엔 없음', hb.has && hb.txt === '🟢3' && /3명 중 아직 안 찍은 3명/.test(hb.title) && hb.t5 === 0, JSON.stringify(hb));

  /* ── ③ 빈 칸 오른쪽 클릭 → 작은 창 ── */
  await pg.evaluate(({ D }) => { hwcOpenPop('S1', D); }, { D }); await settle(250);
  const mini = await pg.evaluate(() => { const p = document.getElementById('hwc-pop'); return { has: !!p, mini: !!(p && p.classList.contains('hws-mini')), txt: p ? p.innerText : '', btn: !!document.getElementById('hws-acc-one'), vis: p ? p.style.visibility : '' }; });
  t('아직 안 찍은 칸 오른쪽 클릭 → 작은 창: 「학생 스스로 풀이 ✓ 채점 ✓ 오답 ○ 아하 —」 · 「학생 체크 그대로 ✓」 · 칸 옆에 보임', mini.has && mini.mini && /학생 스스로/.test(mini.txt) && /풀이 ✓ · 채점 ✓ · 오답 ○ · 아하 —/.test(mini.txt) && mini.btn && /학생 체크 그대로 ✓/.test(mini.txt) && mini.vis === 'visible', JSON.stringify(mini));

  /* ── ④ 그대로 ✓ 칸 하나 ── */
  const q2 = await qSelf();
  await pg.evaluate(() => document.getElementById('hws-acc-one').click()); await settle(300);
  const w1 = await pg.evaluate(({ C1, D }) => { const st = students.filter((s) => s.lumen_rec_code === C1)[0]; const ls = JSON.parse(localStorage.getItem('or_studentdb') || '[]').filter((s) => s.lumen_rec_code === C1)[0] || {}; const p = document.getElementById('hwc-pop'); return { hw: st.lumen_hw && st.lumen_hw[D], at: (st.lumen_hw_at || {})[D], aha: st.lumen_hw_aha, ls: (ls.lumen_hw || {})[D], pop: !!p, mini: !!(p && p.classList.contains('hws-mini')), sec: !!(p && p.querySelector('.hws-pop')), txt: p ? p.innerText : '', toast: T.toasts.slice(-1)[0] || '', undo: HWC.undo && HWC.undo.label }; }, { C1, D });
  t('「학생 체크 그대로 ✓」 → lumen_hw[날짜]={100,100,0} · lumen_hw_at · 등록부(기기) 저장 · 아하는 안 적음 · 되돌리기 준비', w1.hw && w1.hw.p === 100 && w1.hw.c === 100 && w1.hw.w === 0 && !!w1.at && w1.aha === undefined && w1.ls && w1.ls.p === 100 && /학생값/.test(w1.undo || ''), JSON.stringify(w1));
  t('적은 뒤 세부 창(바탕 창)에 「학생 스스로」 줄 · 「이미 학생 값과 같습니다」', w1.pop && !w1.mini && w1.sec && /이미 학생 값과 같습니다/.test(w1.txt) && /학생 체크 그대로/.test(w1.toast), JSON.stringify({ pop: w1.pop, mini: w1.mini, sec: w1.sec, toast: w1.toast }));
  t('적을 때 서버에 hw_self 를 다시 묻지 않음 · 서버에 쓴 것은 없음(등록부는 기기)', (await qSelf()) === q2 && (await pg.evaluate(() => T.ups.filter((u) => u.keys.some((k) => /^hw_self_/.test(k))).length)) === 0);
  /* 이미 찍은 칸은 두 번 누르기 */
  await pg.evaluate(({ D }) => { const st = students.filter((s) => s.id === 'S2')[0]; st.lumen_hw = st.lumen_hw || {}; st.lumen_hw[D] = { p: 0, c: 0, w: 0 }; saveStudents(); hwcOpenPop('S2', D); }, { D }); await settle(200);
  await pg.evaluate(({ D }) => hwsAccept('S2', D), { D }); await settle(200);
  const p1 = await pg.evaluate(({ D }) => { const st = students.filter((s) => s.id === 'S2')[0]; const p = document.getElementById('hwc-pop'); return { hw: st.lumen_hw[D], arm: HWSF.arm, txt: p ? p.innerText : '', toast: T.toasts.slice(-1)[0] }; }, { D });
  t('이미 찍은 칸: 첫 번째 누름은 안 덮어쓰고 「한 번 더 누르면 덮어씁니다」(confirm 창 없음)', p1.hw && p1.hw.p === 0 && p1.arm === 'S2|' + D && /한 번 더 누르면/.test(p1.txt) && /한 번 더/.test(p1.toast), JSON.stringify(p1));
  await pg.evaluate(({ D }) => hwsAccept('S2', D), { D }); await settle(200);
  const p2 = await pg.evaluate(({ D }) => { const st = students.filter((s) => s.id === 'S2')[0]; return { hw: st.lumen_hw[D], arm: HWSF.arm }; }, { D });
  t('두 번째 누름 → 학생 값(100·100·100)으로 덮어씀', p2.hw && p2.hw.p === 100 && p2.hw.c === 100 && p2.hw.w === 100 && p2.arm === '', JSON.stringify(p2));
  await pg.evaluate(() => hwcClosePop()); await settle(150);

  /* ── ⑤ 반 전부 ── */
  await pg.evaluate(({ D }) => hwsAcceptClass('M4', D), { D }); await settle(300);
  const cl = await pg.evaluate(({ D }) => { const g = (id) => { const st = students.filter((s) => s.id === id)[0]; return st.lumen_hw && st.lumen_hw[D]; }; return { s1: g('S1'), s2: g('S2'), s3: g('S3'), s4: g('S4'), s5: g('S5'), toast: T.toasts.slice(-1)[0], undo: HWC.undo && HWC.undo.items.length }; }, { D });
  t('반 전부 → 스스로 누른 3번만 새로 적힘(100·0·0) · 이미 찍은 1·2번은 그대로 · 안 누른 4번·다른 반은 안 적음 · 안내 글', cl.s3 && cl.s3.p === 100 && cl.s3.c === 0 && cl.s3.w === 0 && cl.s1.w === 0 && cl.s2.c === 100 && !cl.s4 && !cl.s5 && /1명 학생 값 그대로 적음/.test(cl.toast) && /이미 찍은 2명은 건너뜀/.test(cl.toast) && cl.undo === 1, JSON.stringify(cl));

  /* ── ⑥ 2차 확인 줄 — 카드 값 우선, 없으면 날짜 값 ── */
  const row = await pg.evaluate(({ C1, C2, D }) => {
    const it2 = (TD.items[C2] || []).filter((x) => x.id === 'hw:' + D + ':702')[0]; const it1 = (TD.items[C1] || []).filter((x) => x.id === 'hw:' + D + ':701')[0];
    const cnt = (h) => (h.match(/background:#22c55e/g) || []).length;
    return { d: hwlSelfHw(C2, it2), dRow: it2 ? cnt(hwlCardRow(C2, it2, false)) : -1, c: hwlSelfHw(C1, it1), cRow: it1 ? cnt(hwlCardRow(C1, it1, false)) : -1, panel: /숙제 카드 2차 확인/.test((document.getElementById('content') || document.body).innerText) };
  }, { C1, C2, D });
  t('카드 체크가 없는 학생(2번) → 학생 셀프 4칸 = 날짜 값(✓✓✓·아하 ○) · 초록 3개', row.d && row.d.p === 100 && row.d.c === 100 && row.d.w === 100 && row.d.a === 0 && row.dRow === 3 && row.panel, JSON.stringify(row));
  t('카드 체크가 있는 학생(1번) → 카드 값 우선(풀이·오답) · 초록 2개', row.c && row.c.p === 100 && row.c.c === 0 && row.c.w === 100 && row.cRow === 2, JSON.stringify(row));

  /* ── ⑦ XP ── */
  const q3 = await qSelf();
  const xp = await pg.evaluate(({ C1 }) => {
    const st = students.filter((s) => s.lumen_rec_code === C1)[0];
    const all = calcXP(st, []); const bakSt = TD.st[C1], bakBy = HWSF.by[C1];
    HWSF.by[C1] = undefined; delete HWSF.by[C1]; const cardOnly = calcXP(st, []);
    HWSF.by[C1] = bakBy; TD.st[C1] = {}; const dateOnly = calcXP(st, []);
    delete HWSF.by[C1]; const none = calcXP(st, []);
    TD.st[C1] = bakSt; HWSF.by[C1] = bakBy;
    return { all: all.total - none.total, bd: all.breakdown.hwself, card: cardOnly.total - none.total, date: dateOnly.total - none.total, month: all.thisMonth - none.thisMonth };
  }, { C1 });
  t('calcXP: 날짜 단위(풀이·채점 + 다른 날 풀이 = 15) + 카드 단위(풀이·오답 = 10) → 같은 날짜·단계(풀이)는 한 번 → +20', xp.all === 20 && xp.bd === 20 && xp.card === 10 && xp.date === 15, JSON.stringify(xp));
  t('XP 계산 때 서버를 묻지 않음(읽어 둔 값만)', (await qSelf()) === q3);

  /* ── ⑧ xp_board 게시 전에 한 번 읽어 둠 ── */
  await pg.evaluate(() => { HWSF.at = 0; T.ups.length = 0; return lvPublishAll(true); }); await settle(300);
  const pub = await pg.evaluate(({ C1 }) => ({ q: T.q.filter((q) => /in:\d+:hw_self_/.test(q)).length, up: T.ups.filter((u) => u.keys.indexOf('xp_board') >= 0).length, bd: (((T.store.xp_board || {}).byCode || {})[C1] || {}).bd }), { C1 });
  t('xp_board 게시(lvPublishAll) → hw_self 한 번 읽고 게시 · 게시된 XP 에 hwself ' + (pub.bd ? pub.bd.hwself : '(레벨 꺼진 학생은 생략)'), pub.q === q3 + 1 && pub.up === 1 && (!pub.bd || pub.bd.hwself === 20), JSON.stringify(pub));

  /* ── 수업 모드 칸에도 점 ── */
  await pg.evaluate(() => { HWC_CM = 'M4'; render(); }); await settle(400);
  const cm = await pg.evaluate(({ D }) => { const el = document.getElementById('hwc-c-S3-' + D); const is = el ? [...el.querySelectorAll('.hws-dots i')] : []; return { cm: !!document.getElementById('hwc-cm'), n: is.length, w: is[0] ? is[0].style.width : '' }; }, { D });
  t('수업 모드 칸에도 점 4개(조금 크게 6px)', cm.cm && cm.n === 4 && cm.w === '6px', JSON.stringify(cm));
  await pg.evaluate(() => { HWC_CM = ''; render(); }); await settle(200);

  /* ── ⑨ 회귀 ── */
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(400);
  const home = await txt(); t('홈이 그려짐', home.length > 200, home.slice(0, 100));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; render(); }); await settle(300);
  t('숙제체크 그리드 그대로(표·반 묶음·✅ 한 번에) + 2차 확인 칸 + 학생 점 안내 줄', await pg.evaluate(() => { const c = document.getElementById('content') || document.body; return !!c.querySelector('#hwc-wrap table') && !!c.querySelector('#hwl-check') && !!c.querySelector('#hws-bar') && c.querySelectorAll('button[onclick^="hwcAllDone("]').length > 10; }));
  await pg.evaluate(() => { HWC_VIEW = 'stu'; render(); }); await settle(200);
  t('학생별 보기엔 점·안내 줄 안 붙음', await pg.evaluate(() => !document.getElementById('hws-bar') && !document.querySelector('.hws-dots') && !document.getElementById('hwl-check')));
  await pg.evaluate(() => { HWC_VIEW = 'grid'; VIEW = 'todo'; TD.tab = 'board'; render(); }); await settle(300);
  t('할 일 보드 「📋 보드」 탭 그대로', /배정됨/.test(await txt()) && /확인 끝/.test(await txt()));
  await pg.evaluate(({ C1 }) => { hwlOpenFor(C1); }, { C1 }); await settle(300);
  t('숙제 내주기 화면 그대로', await pg.evaluate(() => VIEW === 'todo' && TD.tab === 'hw' && /📗 어떤 책을/.test((document.getElementById('content') || document.body).innerText)));
  if (SHOT) { await pg.evaluate(({ D }) => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; render(); hwcOpenPop('S3', D); }, { D }); await settle(400); await pg.screenshot({ path: SHOT, fullPage: false }); }
  t('실서버 질의 없음(외부망 전부 차단 · 가짜 서버만)', reqs.filter((r) => /after:.*supabase/.test(r)).length === 0, reqs.filter((r) => /after:/.test(r)).slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
