#!/usr/bin/env node
/* 학원앱 v19-171 검사 — 📚 숙제 한 바퀴 1판 (docs/hw_dispatch_contract.md §8 학원앱 ①~⑤)
 *   ① 내주기 → todo_<코드> 에 날짜별 교재 카드(id hw:<날짜>:<bookId> · src hw · n 자동) + 프린트 카드 · 같은 id 덮어쓰기
 *   ② 숙제 태그(HOMEWORK) 학습지 카드 → hw:true · n · 마감 = 배정일 뒤 첫 수업일 · 다른 태그는 그대로 · hwMan 보호 · 「숙제로 넣기/빼기」
 *   ③ 숙제체크 2차 확인 → thw · thwAt · tst 'ok' · 거울 lumen_hw[날짜](평균 → 0/30/60/100) · lumen_hw_at · 선생님 칸 누르기
 *   ④ calcXP: 학생 셀프 체크 단계 100 하나당 +5   ⑤ 기능 스위치 stu_features.hw(기본 꺼짐) · 학생 상세 머리 단추 · 회귀(홈·숙제체크·보드)
 *   가짜 학생 6명(○○○1~6 · M4 월수금 · T5 화목토) · 가짜 서버(lumen_store 흉내) · 외부망 전부 차단 — 실서버에 쓰지 않는다.
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19171.js lumen_v19-171.html [그림.png]
 *   바탕: test_v19170.js 의 가짜 서버(mk) · 날짜는 오늘(KST)이 든 주의 월요일(MON)에서 셈 */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-171.html');
const SHOT = process.argv[3] || '';
const WANT = (FILE.match(/v19-\d+/) || ['v19-171'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const iso = (d) => d.toISOString().slice(0, 10);
const add = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const TODAY = iso(new Date(Date.now() + 9 * 3600000));
const MON = add(TODAY, -((dow(TODAY) + 6) % 7));
const D1 = add(MON, 1), D3 = add(MON, 3), D4 = add(MON, 4);
const M4 = [1, 3, 5];
const nextClass = (from, days) => { for (let i = 1; i <= 7; i++) { const d = add(from, i); if (days.indexOf(dow(d)) >= 0) return d; } return add(from, 3); };
const WS1 = add(TODAY, -1), WS2 = add(TODAY, -2);
const names = (n) => '○○○' + n;
const code = (n) => (n <= 4 ? 'AAA' : 'BBB') + String(n).repeat(3).slice(0, 3);
const STUDENTS = [];
for (let n = 1; n <= 6; n++) STUDENTS.push({ id: 'S' + n, name: names(n), grade: n === 6 ? '초등학교 6학년' : '중학교 1학년', group: n <= 4 ? 'M4' : 'T5', lumen_rec_code: code(n), lumen_planner: {} });
const C1 = code(1), C2 = code(2);
const STORE = {
  lumen_group_days: { M4: M4, T5: [2, 4, 6] },
  stu_features: { retry: { on: true, off: [] } },
  ['mf_wsq_' + C1]: { list: [
    { swId: 5001, wid: 9001, title: '오답 쌍둥이 (가짜)', date: WS1, status: '학습가능', auto: true, score: null, tag: 'HOMEWORK', n: 12, o: 0, x: 0, q: 0, _st: 'INCOMPLETE' },
    { swId: 5002, wid: 9002, title: '주간테스트 (가짜)', date: WS2, status: '학습완료', auto: true, score: 75, tag: 'WEEKLY_TEST', n: 20, o: 15, x: 5, q: 0, _st: 'COMPLETE' },
    { swId: 5003, wid: 9003, title: '손으로 뺀 숙제 (가짜)', date: WS2, status: '학습가능', auto: true, score: null, tag: 'HOMEWORK', n: 8, o: 0, x: 0, q: 0, _st: 'INCOMPLETE' } ] },
  ['mf_wsq_' + C2]: { list: [ { swId: 5011, wid: 9011, title: '오답 쌍둥이 2 (가짜)', date: WS1, status: '학습가능', auto: true, score: null, tag: 'HOMEWORK', n: 10, o: 0, x: 0, q: 0, _st: 'INCOMPLETE' } ] },
  ['mf_swb_' + C1]: { code: C1, name: '', books: [ { bid: 701, type: 'PUBLIC', auto: false, title: '가짜 개념편 중1(하)', swId: 1, revId: 1, grade: '중1', pages: [
    { pid: 'p1', wpid: 'w1', page: 12, title: '', st: '' }, { pid: 'p2', wpid: 'w2', page: 13, title: '', st: '' }, { pid: 'p3', wpid: 'w3', page: 14, title: '', st: 'COMPLETE' } ] } ] },
  ['hw_scores_' + C1]: { items: { 'p3_0': { r: 'O', at: TODAY + 'T01:00:00Z' }, 'p3_1': { r: 'X', at: TODAY + 'T01:00:00Z' } } },
  mf_bookans_701: { pages: { w1: { v: 3, problems: [1, 2, 3, 4, 5] }, w2: { v: 3, problems: [1, 2, 3] }, w3: { v: 3, problems: [1, 2] } } },
  ['todo_' + C1]: { items: [
    { id: 'a:ws:9001', kind: 'ws', title: '오답 쌍둥이 (가짜)', ref: '', wid: '9001', src: 'auto:ws', unitTitle: '', tst: 'todo', tat: {}, auto: null, at: WS1 + 'T20:00:00Z', unit: null, order: 1 },
    { id: 'a:ws:9002', kind: 'ws', title: '주간테스트 (가짜)', ref: '', wid: '9002', src: 'auto:ws', unitTitle: '', tst: 'todo', tat: {}, auto: { st: 'done', at: WS2 + 'T20:00:00Z' }, at: WS2 + 'T20:00:00Z', unit: null, order: 2 },
    { id: 'a:ws:9003', kind: 'ws', title: '손으로 뺀 숙제 (가짜)', ref: '', wid: '9003', src: 'auto:ws', unitTitle: '', tst: 'todo', tat: {}, auto: null, at: WS2 + 'T20:00:00Z', unit: null, order: 3, hw: false, hwMan: true } ], upd: TODAY + 'T00:00:00Z' },
  ['todo_st_' + C1]: { 'a:ws:9001': { st: 'doing', at: TODAY + 'T02:00:00Z', hw: { p: 100, c: 0, w: 100, a: 0 }, hat: TODAY + 'T02:00:00Z' }, upd: TODAY + 'T02:00:00Z' } };

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
    window.supaSetItem = (k, v) => { T.store[k] = clone(v); T.ups.push({ tbl: 'lumen_store', keys: [k] }); return Promise.resolve(true); };
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.alert = m; };
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); try { localStorage.setItem('or_studentdb', JSON.stringify(students)); } catch (e) {}
    /* 반 요일표는 이 기기 사본(lumen_group_days · SYNC_KEYS)에서 읽는다 — 실제 앱처럼 기기에 둔다 */
    try { groupDays.M4 = [1, 3, 5]; groupDays.T5 = [2, 4, 6]; saveGroupDays(); } catch (e) {}
    /* 학생 상세 화면용 가짜 리포트 한 장 (이름 ○○○1) — 동기화 타이머가 list 를 바꿔도 되살리게 함수로 */
    window.__seedReport = () => { try { if (!list.some((r) => r && r.id === 'R1')) list.push({ id: 'R1', studentId: 'S1', name: '○○○1', grade: '중학교 1학년', group: 'M4', date: '2026.10.30', score: '80', testType: 'weekly' }); } catch (e) {} };
    window.__seedReport();
  }, { STORE, STUDENTS });
  faked = true;
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const txt = () => pg.evaluate(() => (document.getElementById('content') || document.body).innerText);
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);
  t('부품이 붙음: HWL · rHwlDispatch · hwlAutoWs', await pg.evaluate(() => typeof HWL === 'object' && typeof rHwlDispatch === 'function' && typeof hwlAutoWs === 'function'));

  /* ── ② 보드를 열면 자동 패스가 숙제 태그 학습지에 hw·n·due ── */
  await pg.evaluate(() => { VIEW = 'todo'; TD.tab = 'board'; render(); }); await settle(700);
  await pg.evaluate(() => { try { if (typeof WSG !== 'undefined' && !WSG.loaded) return wsgLoad(); } catch (e) {} }); await settle(400);
  await pg.evaluate(() => { TD.autoAt = 0; HWL.autoAt = 0; render(); }); await settle(500);
  const a1 = await pg.evaluate(({ C1 }) => { const by = {}; (TD.items[C1] || []).forEach((it) => { by[it.id] = it; }); return by; }, { C1 });
  const dueWs1 = nextClass(WS1, M4);
  t('숙제 태그 학습지 → hw:true · n 12 · 마감 = 배정일 뒤 첫 수업일(' + dueWs1 + ')', a1['a:ws:9001'] && a1['a:ws:9001'].hw === true && a1['a:ws:9001'].n === 12 && a1['a:ws:9001'].due === dueWs1, JSON.stringify(a1['a:ws:9001']));
  t('다른 태그(주간테스트) 학습지는 숙제 아님', a1['a:ws:9002'] && !a1['a:ws:9002'].hw, JSON.stringify(a1['a:ws:9002']));
  t('손으로 뺀 것(hwMan) 은 자동이 다시 안 건드림', a1['a:ws:9003'] && a1['a:ws:9003'].hw === false && a1['a:ws:9003'].hwMan === true, JSON.stringify(a1['a:ws:9003']));
  const srv1 = await pg.evaluate(({ C1 }) => (T.store['todo_' + C1].items || []).filter((it) => it.id === 'a:ws:9001')[0], { C1 });
  t('자동 결과가 서버 todo_<코드> 에 저장됨(바뀐 학생만)', srv1 && srv1.hw === true && srv1.due === dueWs1, JSON.stringify(srv1));
  const savedKeys = await pg.evaluate(() => T.ups.map((u) => u.keys.join()).filter((k) => /^todo_/.test(k)));
  t('todo_st_ (학생 키) 에는 쓰지 않음', savedKeys.length > 0 && savedKeys.every((k) => !/^todo_st_/.test(k)), savedKeys.join(' | '));

  /* ── ① 내주기 화면 ── */
  t('보드 탭 줄에 「📚 숙제 내주기」 칩', /📚 숙제 내주기/.test(await txt()));
  await pg.evaluate(({ C1 }) => { hwlOpenFor(C1); }, { C1 }); await settle(300);
  const v1 = await pg.evaluate(() => ({ view: VIEW, tab: TD.tab, stu: HWL.stu, sel: Object.keys(HWL.sel), txt: (document.getElementById('content') || document.body).innerText, opts: [...document.querySelectorAll('#hwl-book option')].map((o) => o.textContent) }));
  t('학생을 들고 내주기 탭이 열림 · 교재 목록(매쓰플랫)에 가짜 교재', v1.view === 'todo' && v1.tab === 'hw' && v1.stu === C1 && v1.sel.join() === C1 && /📗 어떤 책을/.test(v1.txt) && v1.opts.some((o) => /가짜 개념편/.test(o)), JSON.stringify({ view: v1.view, tab: v1.tab, stu: v1.stu, opts: v1.opts }));
  t('학습지 목록: 숙제 태그 ✓ · 다른 태그 「숙제로 넣기」 · 새로고침 단추', /✓ 숙제/.test(v1.txt) && /숙제로 넣기/.test(v1.txt) && /🔄 학습지·교재 목록 새로고침/.test(v1.txt));
  await pg.evaluate(({ D1, D3, D4 }) => { HWL.week = null; hwlEnsureWeek(); HWL.days[D1] = { f: '12', t: '13', n: '' }; HWL.days[D3] = { f: '14', t: '', n: '' }; HWL.prints = [{ t: '일차함수 서술형 6', n: 6, d: D1 }]; render(); }, { D1, D3, D4 });
  await settle(150);
  t('7칸 중 문항 수 자동(12~13쪽 = 5+3 = 8)', await pg.evaluate(({ D1 }) => (document.getElementById('hwl-n-' + D1) || {}).placeholder === '자동 8', { D1 }));
  await pg.evaluate(() => hwlSend()); await settle(400);
  const s1 = await pg.evaluate(({ C1 }) => { const by = {}; (T.store['todo_' + C1].items || []).forEach((it) => { by[it.id] = it; }); return { by, n: Object.keys(by).length }; }, { C1 });
  const bk1 = s1.by['hw:' + D1 + ':701'], bk3 = s1.by['hw:' + D3 + ':701'], prints = Object.keys(s1.by).filter((k) => /^hw:p:/.test(k)).map((k) => s1.by[k]);
  t('내주기 → 날짜별 교재 카드 (id hw:<날짜>:<bookId> · kind book · from/to · n 자동 8 · due · src hw · hw true)', bk1 && bk1.kind === 'book' && bk1.from === 12 && bk1.to === 13 && bk1.n === 8 && bk1.due === D1 && bk1.src === 'hw' && bk1.hw === true && bk1.bookId === 701 && /가짜 개념편 중1\(하\) 12~13쪽/.test(bk1.title), JSON.stringify(bk1));
  t('한 쪽만 적은 날 → to=from · n 2', bk3 && bk3.from === 14 && bk3.to === 14 && bk3.n === 2 && bk3.due === D3, JSON.stringify(bk3));
  t('프린트 → etc 카드 print:true · n 6 · 마감', prints.length === 1 && prints[0].kind === 'etc' && prints[0].print === true && prints[0].n === 6 && prints[0].due === D1 && prints[0].hw === true, JSON.stringify(prints));
  await pg.evaluate(({ D1 }) => { HWL.days[D1] = { f: '12', t: '14', n: '' }; hwlSend(); }, { D1 }); await settle(400);
  const s2 = await pg.evaluate(({ C1, D1 }) => { const items = T.store['todo_' + C1].items || []; return { n: items.length, card: items.filter((it) => it.id === 'hw:' + D1 + ':701')[0] }; }, { C1, D1 });
  t('같은 날짜·교재 다시 보내면 덮어씀(장수 같음 · 범위 12~14 · n 10)', s2.n === s1.n && s2.card && s2.card.to === 14 && s2.card.n === 10, JSON.stringify({ n1: s1.n, n2: s2.n, card: s2.card }));
  /* 숙제로 넣기 / 빼기 */
  await pg.evaluate(({ C1 }) => hwlWsToggle(C1, 'a:ws:9002'), { C1 }); await settle(250);
  const tg = await pg.evaluate(({ C1 }) => (T.store['todo_' + C1].items || []).filter((it) => it.id === 'a:ws:9002')[0], { C1 });
  t('「숙제로 넣기」 → hw true · hwMan true · n 20 · 마감 = 배정일 뒤 첫 수업일', tg && tg.hw === true && tg.hwMan === true && tg.n === 20 && tg.due === nextClass(WS2, M4), JSON.stringify(tg));
  await pg.evaluate(({ C1 }) => hwlWsToggle(C1, 'a:ws:9002'), { C1 }); await settle(250);
  t('「빼기」 → hw false (hwMan 유지)', await pg.evaluate(({ C1 }) => { const it = (T.store['todo_' + C1].items || []).filter((x) => x.id === 'a:ws:9002')[0]; return it && it.hw === false && it.hwMan === true; }, { C1 }));

  /* ── ③ 숙제체크 2차 확인 · 거울 ── */
  await pg.evaluate(({ C1, D1 }) => { TD.st[C1] = TD.st[C1] || {}; TD.st[C1]['hw:' + D1 + ':701'] = { st: 'doing', at: new Date().toISOString(), hw: { p: 100, c: 100, w: 60, a: 0 }, hat: new Date().toISOString() }; VIEW = 'hwcheck'; HWC_VIEW = 'grid'; HWL.date = D1; render(); }, { C1, D1 }); await settle(500);
  await pg.evaluate(() => render()); await settle(200);
  const c1 = await txt();
  t('숙제체크 아래 「📚 숙제 카드 2차 확인」 · 그날 마감 카드 2장(교재·프린트) · 학생 체크 그대로 ✓', /📚 숙제 카드 2차 확인/.test(c1) && /가짜 개념편/.test(c1) && /일차함수 서술형 6/.test(c1) && /학생 체크 그대로 ✓ \(보이는 전부 1명\)/.test(c1), c1.slice(-600));
  await pg.evaluate(({ C1, D1 }) => hwlAccept(C1, D1), { C1, D1 }); await settle(350);
  const m1 = await pg.evaluate(({ C1, D1 }) => { const items = T.store['todo_' + C1].items || []; const bk = items.filter((it) => it.id === 'hw:' + D1 + ':701')[0]; const pr = items.filter((it) => /^hw:p:/.test(it.id))[0]; const st = students.filter((s) => s.lumen_rec_code === C1)[0]; return { bk: { thw: bk.thw, tst: bk.tst, thwAt: bk.thwAt }, pr: { thw: pr.thw, tst: pr.tst }, hw: st.lumen_hw[D1], at: (st.lumen_hw_at || {})[D1], ls: (JSON.parse(localStorage.getItem('or_studentdb') || '[]').filter((s) => s.lumen_rec_code === C1)[0] || {}).lumen_hw }; }, { C1, D1 });
  t('「학생 체크 그대로 ✓」 → 카드 thw = 학생 hw · tst ok · thwAt', m1.bk.thw && m1.bk.thw.p === 100 && m1.bk.thw.c === 100 && m1.bk.thw.w === 60 && m1.bk.tst === 'ok' && !!m1.bk.thwAt && m1.pr.thw && m1.pr.thw.p === 0 && m1.pr.tst === 'ok', JSON.stringify(m1));
  t('거울: lumen_hw[날짜] = 두 카드 평균 → 0/30/60/100 (p 50→60 · c 50→60 · w 30→30) · lumen_hw_at 적힘 · 등록부 저장', m1.hw && m1.hw.p === 60 && m1.hw.c === 60 && m1.hw.w === 30 && !!m1.at && m1.ls && m1.ls[D1] && m1.ls[D1].p === 60, JSON.stringify(m1));
  await pg.evaluate(({ C1, D1 }) => hwlT(C1, 'hw:' + D1 + ':701', 'w'), { C1, D1 }); await settle(300);
  const m2 = await pg.evaluate(({ C1, D1 }) => { const bk = (T.store['todo_' + C1].items || []).filter((it) => it.id === 'hw:' + D1 + ':701')[0]; const st = students.filter((s) => s.lumen_rec_code === C1)[0]; return { w: bk.thw.w, hw: st.lumen_hw[D1] }; }, { C1, D1 });
  t('선생님 칸 누르기(오답 60→✓100) → 거울 w (100+0)/2 → 60', m2.w === 100 && m2.hw.w === 60, JSON.stringify(m2));
  /* 세부 창 안 카드 줄 */
  await pg.evaluate(({ D1 }) => { hwcOpenPop('S1', D1); }, { D1 }); await settle(250);
  t('숙제체크 세부 창에 「이 날 마감 숙제 카드」 줄', await pg.evaluate(() => { const p = document.getElementById('hwc-pop'); return !!p && /이 날 마감 숙제 카드 2/.test(p.innerText) && p.querySelectorAll('.hwl-card').length === 2; }));
  await pg.evaluate(() => hwcClosePop()); await settle(150);
  /* 채점 자동 ✓ (저장 안 함): 14쪽 카드는 hw_scores p3_* 가 있어 채점 자동 · 맞은 수 1/2 */
  const ac = await pg.evaluate(({ C1, D3 }) => { const it = (TD.items[C1] || []).filter((x) => x.id === 'hw:' + D3 + ':701')[0]; return { a: hwlAutoC(C1, it), self: hwlSelfEff(C1, it), saved: !!(T.store['todo_st_' + C1] || {})['hw:' + D3 + ':701'] }; }, { C1, D3 });
  t('채점 칸 자동 ✓ 규칙(§2-2): 매쓰플랫 채점 있는 쪽 → c 100 · 맞은 수 1/2 · 저장은 안 함', ac.a.auto === true && ac.a.right === '1/2' && ac.self.c === 100 && ac.saved === false, JSON.stringify(ac));

  /* ── ④ XP ── */
  const xp = await pg.evaluate(({ C1 }) => { const st = students.filter((s) => s.lumen_rec_code === C1)[0]; const a = calcXP(st, []); const bak = TD.st[C1]; TD.st[C1] = {}; const b = calcXP(st, []); TD.st[C1] = bak; return { diff: a.total - b.total, bd: a.breakdown.hwself }; }, { C1 });
  t('calcXP: 셀프 체크 단계 100 하나당 +5 (a:ws 풀이·오답 2단계 + 교재 풀이·채점 2단계 = +20 · 60은 안 셈)', xp.diff === 20 && xp.bd === 20, JSON.stringify(xp));

  /* ── ⑤ 기능 스위치 · 학생 상세 머리 단추 · 회귀 ── */
  await pg.evaluate(() => { VIEW = 'stufeat'; SFA.loaded = false; SFA.cfg = null; return sfaLoad(); }); await settle(200);
  await pg.evaluate(() => render()); await settle(150);
  const sf = await pg.evaluate(() => ({ txt: (document.getElementById('content') || document.body).innerText, cfg: SFA.cfg.hw }));
  t('🎛 기능 켜고 끄기에 「📚 오늘 숙제」 줄 · 기본 꺼짐', /오늘 숙제/.test(sf.txt) && sf.cfg && sf.cfg.on === false, JSON.stringify(sf.cfg));
  await pg.evaluate(() => { sfaToggleAll('hw'); return sfaSave(); }); await settle(200);
  t('켜고 저장 → stu_features.hw.on true · 다른 스위치(retry) 그대로', await pg.evaluate(() => T.store.stu_features.hw.on === true && T.store.stu_features.retry && T.store.stu_features.retry.on === true));
  await pg.evaluate(() => { window.__seedReport(); SELECTED_STUDENT = '○○○1__중학교 1학년'; STUDENT_TAB = '현황'; VIEW = 'student_detail'; render(); }); await settle(300);
  const sd = await pg.evaluate(() => { const b = document.getElementById('hwl-sd-btn'); return { has: !!b, dis: b ? b.disabled : null, view: VIEW, sel: SELECTED_STUDENT, reps: list.length }; });
  t('학생 상세 머리에 「📚 숙제 내주기」 단추', sd.has && sd.dis === false && sd.view === 'student_detail', JSON.stringify(sd));
  await pg.evaluate(() => { HWL.sel = {}; HWL.stu = null; const b = document.getElementById('hwl-sd-btn'); if (b) b.click(); }); await settle(300);
  t('단추 → 그 학생이 골라진 내주기 화면', await pg.evaluate(({ C1 }) => VIEW === 'todo' && TD.tab === 'hw' && HWL.stu === C1 && HWL.cls === 'M4', { C1 }));
  /* 회귀 */
  await pg.evaluate(() => { VIEW = 'home'; render(); }); await settle(400);
  const home = await txt(); t('홈이 그려짐', home.length > 200, home.slice(0, 100));
  await pg.evaluate(() => { VIEW = 'todo'; TD.tab = 'board'; render(); }); await settle(300);
  t('할 일 보드 「📋 보드」 탭 그대로(5열)', /배정됨/.test(await txt()) && /확인 끝/.test(await txt()));
  await pg.evaluate(() => { VIEW = 'hwcheck'; HWC_VIEW = 'grid'; render(); }); await settle(300);
  t('숙제체크 그리드 그대로(날짜 머리·반 묶음) + 2차 확인 칸', await pg.evaluate(() => { const c = document.getElementById('content') || document.body; return !!c.querySelector('#hwc-wrap table') && !!c.querySelector('#hwl-check'); }));
  await pg.evaluate(() => { HWC_VIEW = 'stu'; render(); }); await settle(200);
  t('학생별 보기에는 2차 확인 칸 안 붙음', await pg.evaluate(() => !document.getElementById('hwl-check')));
  await pg.evaluate(() => { HWC_VIEW = 'grid'; });
  if (SHOT) { await pg.evaluate(({ C1 }) => { hwlOpenFor(C1); }, { C1 }); await settle(300); await pg.screenshot({ path: SHOT, fullPage: false }); }
  t('실서버 질의 없음(외부망 전부 차단 · 가짜 서버만)', reqs.filter((r) => /after:.*supabase/.test(r)).length === 0, reqs.filter((r) => /after:/.test(r)).slice(0, 3).join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
