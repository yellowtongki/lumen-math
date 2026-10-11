#!/usr/bin/env node
/* 학원앱 v19-106 검사 — 📝 백지테스트 · 🚑 리커버리를 3분할로 (원장 결정 2026-10-11, 시안 docs/mockup_layout3.html)
 *   📝 ① 왼쪽: 학생 ○/✓ 여러 명(BT.sel) · 이름 = btPick · 「중3 전부 n」「모두 해제」 · 보관함 묶음 → btOpen · 가운데 긴 칩 줄은 1280↑ 숨김
 *      ② 오른쪽: 과정·범위(트리 수 · 🌳 트리 열기) · 1부 칸 ↔ BT.cfg.p1 (양쪽) · 3부 출처 ↔ p3src · ⚡ AI 초안(가짜 callAI) · 👥 n명 · 💬 채팅 한 줄 → bt2ChatSend · 💾 보관
 *   🚑 ① 왼쪽: 이번 주 호출(확정 🚑 · 미정 · 직접) → 가운데 그 카드 깜빡 · 장부(이번 달·지난달)
 *      ② 오른쪽: 규칙 체크(twinPer · boost) → rc_ws_rule 저장(supaSetItem 가짜) · 📣 → rcPublishCalls(가짜) · ⚡ · 🖨 · 🔐 계정 상태
 *   ③ 420px 는 바뀐 것 없음 · 1100px 「🛠 도구」 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19106.js lumen_v19-106.html
 *   그림: $SP/v19106_bt.png · $SP/v19106_rc.png (1400px)
 *   가짜 트리 = test_v1998 과 같은 것(대표 문항 ID·그림 주소는 가짜 80000x). 가짜 서버 · 외부망 차단. 학생 실명·실제 점수 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-106.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-106'])[0];
const TREE = {"updated":"2026-10-10T00:00:00Z","rev":"22","label":"공통수학1","schoolType":"HIGH","curriculumId":4175,"b":[{"id":4186,"n":"다항식","m":[{"id":4337,"n":"다항식의 연산","s":[{"id":4658,"n":"다항식의 사칙연산","c":[{"id":15996,"n":"다항식의 정리방법","pr":61,"tc":3,"sc":13,"t":[{"id":28442,"n":"다항식의 여러 가지 용어","u":[{"id":148879,"n":"단항식의 차수와 계수 구하기 [소문항]","pid":800001,"img":"https://freewheelin-contents.mathflat.com/problem/800001/0a1b2c3d/problem.png"},{"id":126644,"n":"다항식의 상수항 구하기","pid":800002,"img":"https://freewheelin-contents.mathflat.com/problem/800002/0a1b2c3d/problem.png"},{"id":148878,"n":"다항식의 용어에 대한 설명으로 옳은 것 (옳지 않은 것) 찾기","pid":800003,"img":"https://freewheelin-contents.mathflat.com/problem/800003/0a1b2c3d/problem.png"},{"id":148875,"n":"다항식의 항, 차수, 계수 구하기 [소문항]","pid":800004,"img":"https://freewheelin-contents.mathflat.com/problem/800004/0a1b2c3d/problem.png"},{"id":148876,"n":"다항식에 대한 설명(항, 차수, 계수으로 옳은 것 (옳지 않은 것) 찾기","pid":800005,"img":"https://freewheelin-contents.mathflat.com/problem/800005/0a1b2c3d/problem.png"}]},{"id":28444,"n":"오름차순 또는 내림차순으로 정리","u":[{"id":126647,"n":"다항식이 주어졌을 때 x에 대한 내림차순으로 정리하기","pid":800006,"img":"https://freewheelin-contents.mathflat.com/problem/800006/0a1b2c3d/problem.png"},{"id":126648,"n":"다항식이 주어졌을 때 y에 대한 오름차순으로 정리하기","pid":800007,"img":"https://freewheelin-contents.mathflat.com/problem/800007/0a1b2c3d/problem.png"},{"id":104381,"n":"다항식이 주어졌을 때 x에 대한 내림차순으로 정리하기 [빈칸채우기]","pid":800008,"img":"https://freewheelin-contents.mathflat.com/problem/800008/0a1b2c3d/problem.png"},{"id":126649,"n":"다항식을 x(또는 y)에 대한 오름차순, 내림차순으로 정리하기 [소문제]","pid":800009,"img":"https://freewheelin-contents.mathflat.com/problem/800009/0a1b2c3d/problem.png"},{"id":126650,"n":"x(또는 y)에 대한 오름차순, 내림차순으로 정리한 것이 옳지 않은(옳은) 다항식 찾기 [객관식]","pid":800010,"img":"https://freewheelin-contents.mathflat.com/problem/800010/0a1b2c3d/problem.png"},{"id":183907,"n":"x(또는 y)에 대한 오름차순, 내림차순으로 정리한 다항식 찾기 [합답형]","pid":800011,"img":"https://freewheelin-contents.mathflat.com/problem/800011/0a1b2c3d/problem.png"}]},{"id":28445,"n":"다항식의 정리(종합)","u":[{"id":126652,"n":"다항식을 오름차순, 내림차순으로 정리했을 때 옳은 것만을 있는 대로 고르기 [합답형]","pid":800012,"img":"https://freewheelin-contents.mathflat.com/problem/800012/0a1b2c3d/problem.png"},{"id":126653,"n":"다변수 다항식의 정리와 차수 판단","pid":800013,"img":"https://freewheelin-contents.mathflat.com/problem/800013/0a1b2c3d/problem.png"}]}]},{"id":15998,"n":"다항식의 덧셈과 뺄셈","pr":61,"tc":5,"sc":30,"t":[{"id":28447,"n":"두 다항식의 덧셈과 뺄셈","u":[{"id":126657,"n":"두 다항식 A, B가 주어졌을 때 A±B를 간단히 하기","pid":800014,"img":"https://freewheelin-contents.mathflat.com/problem/800014/0a1b2c3d/problem.png"},{"id":126658,"n":"두 다항식 A, B가 주어졌을 때 mA±nB를 간단히 하기 (m, n은 상수)","pid":800015,"img":"https://freewheelin-contents.mathflat.com/problem/800015/0a1b2c3d/problem.png"},{"id":126659,"n":"두 다항식 A, B가 주어졌을 때 A±B를 계산하기 [소문제]","pid":800016,"img":"https://freewheelin-contents.mathflat.com/problem/800016/0a1b2c3d/problem.png"}]},{"id":28448,"n":"세 다항식의 덧셈과 뺄셈","u":[{"id":126666,"n":"세 다항식 A, B, C가 주어졌을 때 mA±nB±lC를 간단히 하기 (m, n, l은 상수)","pid":800017,"img":"https://freewheelin-contents.mathflat.com/problem/800017/0a1b2c3d/problem.png"},{"id":126667,"n":"다항식의 곱셈과 덧셈, 뺄셈을 이용한 합성 다항식 계산","pid":800018,"img":"https://freewheelin-contents.mathflat.com/problem/800018/0a1b2c3d/problem.png"},{"id":126668,"n":"세 다항식 A, B, C가 주어졌을 때 복잡한 식을 간단히 하기","pid":800019,"img":"https://freewheelin-contents.mathflat.com/problem/800019/0a1b2c3d/problem.png"}]}]},{"id":16006,"n":"곱셈 공식의 변형(1) 문자가 2개","pr":61,"tc":5,"sc":49,"t":[{"id":28496,"n":"수가 직접 주어졌을 때, 계산하기","u":[{"id":126925,"n":"하나의 수가 주어졌을 때, 세제곱 계산하기","pid":800020,"img":"https://freewheelin-contents.mathflat.com/problem/800020/0a1b2c3d/problem.png"},{"id":126926,"n":"x, y의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800021,"img":"https://freewheelin-contents.mathflat.com/problem/800021/0a1b2c3d/problem.png"},{"id":126927,"n":"두 수가 주어졌을 때, 세제곱의 합 구하기","pid":800022,"img":"https://freewheelin-contents.mathflat.com/problem/800022/0a1b2c3d/problem.png"}]},{"id":28497,"n":"두 수의 합/차, 곱이 주어졌을 때, 계산하기","u":[{"id":126937,"n":"x+y, xy의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800023,"img":"https://freewheelin-contents.mathflat.com/problem/800023/0a1b2c3d/problem.png"},{"id":126938,"n":"x-y, xy의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800024,"img":"https://freewheelin-contents.mathflat.com/problem/800024/0a1b2c3d/problem.png"},{"id":126939,"n":"x+y, xy의 값이 주어졌을 때, (x-y)^2 계산하기","pid":800025,"img":"https://freewheelin-contents.mathflat.com/problem/800025/0a1b2c3d/problem.png"}]}]}]}]},{"id":4338,"n":"나머지정리","s":[{"id":4659,"n":"항등식과 나머지 정리","c":[{"id":16011,"n":"항등식의 뜻과 성질","pr":61,"tc":2,"sc":5,"t":[]},{"id":16012,"n":"항등식에서 미정계수 구하기(1) 계수 비교법","pr":61,"tc":5,"sc":25,"t":[]}]}]}]},{"id":4187,"n":"방정식과 부등식","m":[{"id":4340,"n":"복소수와 이차방정식","s":[{"id":4661,"n":"복소수의 뜻과 성질","c":[{"id":16208,"n":"복소수의 뜻과 분류","pr":61,"tc":6,"sc":27,"t":[]},{"id":16211,"n":"복소수의 사칙연산","pr":61,"tc":6,"sc":49,"t":[]}]}]}]}]};
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* 가짜 서버(supabase 흉내 — 어떤 줄 잇기든 받는다) · 가짜 유형DB·교과서·AI · 학생 3명(○○○ · △△△ 중3, □□□ 고1) */
async function setup(pg) {
  await pg.evaluate(({ TREE }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const day = new Date().toISOString().slice(0, 10);
    const sheet = (id, code, title, at) => ({ id, code, title, course: '공통수학1', big: '다항식', subs: ['다항식의 사칙연산'], p3mode: 'tb', p3src: 'tb', tb: { bid: '3119965', title: '교과서_비상교육 - 공통수학1' },
      at, savedAt: at, p1: [{ type: 'blank', q: '보관 문항 [[  ]]', a: '가', s: '다항식의 사칙연산' }], p2: [], p3: [], note: '' });
    window.T = { store: { mf_tree_22_공통수학1: clone(TREE) }, upserts: [], sets: [], toasts: [], calls: [], ai: 0, lastPrompt: '', next: null, chats: [] };
    const rows = (tbl, f) => {
      if (tbl !== 'lumen_store') return [];
      const eq = f.find((x) => x[0] === 'eq' && x[1] === 'key'); const inn = f.find((x) => x[0] === 'in' && x[1] === 'key');
      const keys = eq ? [eq[2]] : (inn ? inn[2] : []);
      return keys.filter((k) => Object.prototype.hasOwnProperty.call(T.store, k)).map((k) => ({ key: k, value: clone(T.store[k]) }));
    };
    const builder = (tbl) => { const f = []; const b = new Proxy({}, { get(_, p) {
      if (p === 'then') return (r, j) => Promise.resolve({ data: rows(tbl, f), error: null }).then(r, j);
      if (p === 'upsert') return (row) => { (Array.isArray(row) ? row : [row]).forEach((x) => { T.upserts.push(x.key); T.store[x.key] = clone(x.value); }); return Promise.resolve({ data: null, error: null }); };
      return (...a) => { f.push([p, ...a]); return b; }; } }); return b; };
    const any = () => new Proxy(function () {}, { get(_, p) { if (p === 'then') return undefined; return any(); }, apply() { return any(); } });
    window.getSupaClient = () => new Proxy({}, { get(_, p) { if (p === 'from') return (tbl) => builder(tbl); if (p === 'then') return undefined; return any(); } });
    window.supaSetItem = async (k, v) => { T.sets.push(k); T.store[k] = clone(v); return true; };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true; window.alert = (m) => { T.toasts.push('alert:' + m); };
    window.plToast = (m) => { T.toasts.push(m); };
    /* 백지테스트 재료 (test_v1998 과 같음) */
    window.MF_TYPEDB = { grades: [
      { g: '중3-2', grp: '중등', b: [{ n: '삼각비', m: [{ n: '삼각비', s: [{ n: '삼각비의 뜻', t: ['삼각비의 값'] }] }] }] },
      { g: '공통수학1', grp: '고등', b: [
        { n: '다항식', m: [{ n: '다항식의 연산', s: [{ n: '다항식의 사칙연산', t: ['다항식의 덧셈과 뺄셈', '다항식의 곱셈', '다항식의 나눗셈', '조립제법'] }, { n: '항등식과 나머지 정리', t: ['항등식', '미정계수법', '나머지 정리', '인수 정리'] }] }, { n: '인수분해', s: [{ n: '다항식의 인수분해', t: ['인수분해 공식', '치환', '인수 정리를 이용한 인수분해'] }] }] },
        { n: '방정식과 부등식', m: [{ n: '복소수', s: [{ n: '복소수의 뜻과 성질', t: ['복소수'] }] }] } ] } ] };
    window.MF_TYPEDB_LOADING = false;
    window.MF_TYPE_ACH = { names: { 501: { n: '다항식의 곱셈' } } };
    window.EA = window.EA || {}; EA.tbMap = { books: { '3119965': { type: 'SCHOOL', grade: '공통수학1', title: '교과서_비상교육', fulltitle: '교과서_비상교육 - 공통수학1' } }, byStudent: {}, bySchoolGrade: {} };
    EA.tb = { '3119965': { title: '교과서_비상교육 - 공통수학1', pages: [{ page: 12, title: '다항식의 사칙연산' }], problems: [
      { id: 1, page: 12, no: '3', cid: 501, level: 2, pimg: 'https://x/problem/70001/a/problem.png', answer: '2x+1', type: 'SHORT_ANSWER' } ] } };
    window.eaTbLoad = () => Promise.resolve(); window.eaTbBank = (bid) => Promise.resolve(EA.tb[bid] || null);
    const STU = [{ id: 'S1', name: '○○○', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '△△△', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'BBB222' },
      { id: 'S3', name: '□□□', grade: '고등학교 1학년', group: 'H1', lumen_rec_code: 'CCC333' }];
    window.getSortedStudents = () => STU; students = STU.slice();
    window.HWC = { loaded: true, stuck: {} }; window.ahaNotes = []; window.HWB = { loaded: true, swb: {} };
    window.tqSummary = () => ({ weak: [], newweak: [], worse: [] });
    window.callAI = async (p) => { T.ai++; T.lastPrompt = p; return typeof T.next === 'string' ? T.next : JSON.stringify(T.next); };
    BT.kicked = true; BT.loaded = true; BT.tab = 'make'; BT.stu = null; BT.sel = {}; BT.draft = null; BT.many = null; BT.cls = '';
    BT.saved = [sheet('bt:s1', 'AAA111', '중3 같은 시험지 — 다항식', day + 'T09:00:00Z'), sheet('bt:s2', 'BBB222', '중3 같은 시험지 — 다항식', day + 'T09:00:01Z'), sheet('bt:s3', 'AAA111', '옛 백지테스트', '2026-10-01T09:00:00Z')];
    BT.cfg.p1 = 4; BT.cfg.p2 = 0; BT.cfg.p3 = 3; BT.cfg.p3mode = 'tb'; BT.cfg.p3src = 'mix'; BT.cfg.course = ''; BT.cfg.subs = []; BT.cfg.sel = null;
    try { _origRemoveItem('or_mf_id'); _origRemoveItem('or_mf_pw'); _origRemoveItem('l3_common_open'); } catch (e) {}
  }, { TREE });
}
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await setup(pg);
  await pg.evaluate(() => { VIEW = 'blank'; try { GRP = groupOfView('blank'); } catch (e) {} render(); });
  await wait(150);

  /* ══════ 📝 백지테스트 ══════ */
  const A = await pg.evaluate(() => {
    const LC = document.getElementById('LIST_CONTENT'), tp = document.getElementById('TOOL_PANEL');
    const sel = [...LC.querySelectorAll('[data-l3b-sel]')].map((b) => b.getAttribute('data-l3b-sel') + ':' + b.textContent);
    const hide = [...document.querySelectorAll('#CONTENT .l3b-chide')].map((e) => getComputedStyle(e).display);
    const det = LC.querySelector('details.common-menu');
    return { ver: APP_VER, head: (LC.querySelector('.l3-vhead') || {}).textContent, sel, picks: LC.querySelectorAll('[data-l3b-pick]').length,
      quick: [...LC.querySelectorAll('.l3b-q')].map((b) => b.textContent), box: [...LC.querySelectorAll('[data-l3b-box]')].map((b) => b.textContent),
      det: !!det && !det.open, body: document.body.classList.contains('l3-bt-left'), hide, note: getComputedStyle(document.querySelector('#CONTENT .l3b-cnote')).display,
      tp: getComputedStyle(tp).width, scope: (document.getElementById('l3b-scope') || {}).textContent || '', gen: !!document.getElementById('l3b-gen') };
  });
  t('버전 ' + WANT, A.ver === WANT, A.ver);
  t('왼쪽 맨 위 「📝 백지테스트」 · 학생 3명 모두 ○ · 이름 단추 3', /📝 백지테스트/.test(A.head) && A.sel.join() === 'AAA111:○,BBB222:○,CCC333:○' && A.picks === 3, JSON.stringify([A.head, A.sel, A.picks]));
  t('빠르게: 「고1 전부 1」「중3 전부 2」「보이는 학생 전부」 (아직 고른 학생 없음 → 「모두 해제」 없음)', A.quick.join('|') === '고1 전부 1|중3 전부 2|보이는 학생 전부', JSON.stringify(A.quick));
  t('보관함: 같은 제목·같은 날 2장은 한 줄(«2명» 👥 2) · 다른 1장', A.box.length === 2 && /중3 같은 시험지 — 다항식2명/.test(A.box[0]) && /👥 2/.test(A.box[0]) && /옛 백지테스트○○○ · 10\/01/.test(A.box[1]), JSON.stringify(A.box));
  t('맨 아래 접힌 「▸ 공용 메뉴」', A.det, A.det);
  t('1400px: 가운데 반 칩·학생 칩·빠른 고르기 3줄 숨김 + 한 줄 안내 · body.l3-bt-left', A.body && A.hide.length === 3 && A.hide.every((d) => d === 'none') && A.note === 'block', JSON.stringify([A.body, A.hide, A.note]));
  t('도구 칸 280px · 학생 없으면 「학생을 고르면」 안내 · ⚡ 단추 없음', A.tp === '280px' && /왼쪽에서 학생을 고르면/.test(A.scope) && !A.gen, JSON.stringify([A.tp, A.scope, A.gen]));

  /* 이름 누르기 → btPick · 파란 줄 · 트리 받고 개수 */
  const B = await pg.evaluate(async () => {
    document.querySelector('#LIST_CONTENT [data-l3b-pick="AAA111"]').click();
    await new Promise((r) => setTimeout(r, 300)); render();
    const row = document.querySelector('#LIST_CONTENT [data-l3b-row="AAA111"]');
    return { stu: BT.stu, on: row.classList.contains('on'), others: document.querySelectorAll('#LIST_CONTENT .l3b-stu.on').length, tree: bt2TrOn(),
      course: (document.getElementById('l3b-course') || {}).textContent, counts: (document.getElementById('l3b-counts') || {}).textContent, gen: (document.getElementById('l3b-gen') || {}).textContent };
  });
  t('이름 누르기 → BT.stu · 그 줄만 파란색', B.stu === 'AAA111' && B.on && B.others === 1, JSON.stringify(B));
  t('과정 · 범위: 공통수학1 › 다항식 · 🌳 단원 트리 개념 3 · 주제유형 7 · 세부유형 25 · ⚡ AI 초안 단추', B.tree && B.course === '공통수학1 › 다항식' && /개념 3 · 주제유형 7 · 세부유형 25/.test(B.counts) && B.gen === '⚡ AI 초안 만들기', JSON.stringify(B));

  /* ○ → ✓ 여러 명 · 오른쪽 「n명에게」 수 */
  const C = await pg.evaluate(async () => {
    const q = (s) => document.querySelector(s); const o = {};
    q('#LIST_CONTENT [data-l3b-sel="AAA111"]').click(); q('#LIST_CONTENT [data-l3b-sel="BBB222"]').click();
    o.sel1 = bt2SelCodes().sort().join(); o.ck1 = [...document.querySelectorAll('#LIST_CONTENT [data-l3b-sel]')].map((b) => b.textContent).join('');
    o.many1 = (q('#l3b-many') || {}).textContent; o.clear = !!q('#LIST_CONTENT [data-l3b-q="clear"]');
    q('#LIST_CONTENT [data-l3b-sel="BBB222"]').click(); o.many2 = (q('#l3b-many') || {}).textContent;
    q('#LIST_CONTENT [data-l3b-q="clear"]').click(); o.sel3 = bt2SelCodes().length; o.many3 = !!q('#l3b-many');
    q('#LIST_CONTENT [data-l3b-grade="중3"]').click(); o.sel4 = bt2SelCodes().sort().join(); o.many4 = (q('#l3b-many') || {}).textContent;
    o.center = (document.querySelector('#CONTENT .l3b-cnote') || {}).textContent;
    return o;
  });
  t('○ 두 번 → BT.sel 2명 · ✓✓○ · 오른쪽 「👥 고른 2명에게 같은 시험지」 · 「모두 해제」 생김', C.sel1 === 'AAA111,BBB222' && C.ck1 === '✓✓○' && C.many1 === '👥 고른 2명에게 같은 시험지' && C.clear, JSON.stringify(C));
  t('하나 풀면 「1명에게」 · 「모두 해제」 → 0명 · 단추 사라짐 · 「중3 전부」 → 2명', C.many2 === '👥 고른 1명에게 같은 시험지' && C.sel3 === 0 && !C.many3 && C.sel4 === 'AAA111,BBB222' && C.many4 === '👥 고른 2명에게 같은 시험지', JSON.stringify(C));
  t('가운데 한 줄 안내: 지금 ○○○ · ✓ 2명 고름', /지금 ○○○/.test(C.center) && /✓ 2명 고름/.test(C.center), C.center);

  /* 문항 수 · 3부 출처 — 양쪽 */
  const D = await pg.evaluate(async () => {
    const fire = (el, v) => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); };
    const o = {};
    fire(document.getElementById('l3b-p1'), '6'); o.p1 = BT.cfg.p1; o.cP1 = document.querySelector('#CONTENT input[onchange^="btCfg(\'p1\'"]').value;
    fire(document.querySelector('#CONTENT input[onchange^="btCfg(\'p2\'"]'), '2'); o.p2 = BT.cfg.p2; o.rP2 = document.getElementById('l3b-p2').value;
    fire(document.getElementById('l3b-p3src'), 'rep'); o.src = BT.cfg.p3src; o.cSrc = document.querySelector('#CONTENT select[onchange^="btCfg(\'p3src\'"]').value;
    fire(document.querySelector('#CONTENT select[onchange^="btCfg(\'p3src\'"]'), 'tb'); o.src2 = BT.cfg.p3src; o.rSrc2 = document.getElementById('l3b-p3src').value;
    fire(document.getElementById('l3b-p3src'), 'mix'); fire(document.getElementById('l3b-p2'), '0'); fire(document.getElementById('l3b-p1'), '4');
    o.p3 = document.getElementById('l3b-p3').value; o.mode = document.getElementById('l3b-p3mode').value;
    return o;
  });
  t('오른쪽 1부 → BT.cfg.p1=6 · 가운데 칸도 6', D.p1 === 6 && D.cP1 === '6', JSON.stringify(D));
  t('가운데 2부 → BT.cfg.p2=2 · 오른쪽 칸도 2', D.p2 === 2 && D.rP2 === '2', JSON.stringify(D));
  t('오른쪽 3부 출처 → p3src=rep · 가운데도 rep · 가운데 → tb · 오른쪽도 tb', D.src === 'rep' && D.cSrc === 'rep' && D.src2 === 'tb' && D.rSrc2 === 'tb', JSON.stringify(D));
  t('3부: 교과서·대표 문항 · 3', D.mode === 'tb' && D.p3 === '3', JSON.stringify(D));

  /* 🌳 범위 트리 열기 */
  const E = await pg.evaluate(async () => {
    BT.tree.open = {}; render(); document.getElementById('l3b-tree').click(); await new Promise((r) => setTimeout(r, 250));
    return { open: !!BT.tree.open['b:4186'] && !!BT.tree.open['s:4658'], tree: !!document.getElementById('bt2-tree'), flash: !!document.querySelector('#CONTENT .l3-flash'), rows: document.querySelectorAll('#bt2-tree [data-k]').length };
  });
  t('「🌳 범위 트리 열기」 → 고른 대단원 펼침 · 트리 칸으로 가서 깜빡', E.open && E.tree && E.flash && E.rows > 5, JSON.stringify(E));

  /* ⚡ AI 초안 (가짜 callAI) → 초안 · 미리보기 */
  const F = await pg.evaluate(async () => {
    const it = (q, a, type) => ({ type: type || 'blank', q, a, s: '다항식의 여러 가지 용어' });
    T.next = { title: '백지테스트 — 공통수학1 · 다항식', p1: [it('첫 문항 [[  ]]', '가'), it('둘째 문항 [[  ]]', '나'), it('셋째 문항', '다', 'write'), it('넷째 문항 [[  ]]', '라')] };
    const a0 = T.ai; document.getElementById('l3b-gen').click();
    for (let i = 0; i < 40 && (!BT.draft || BT.gen); i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 50));
    const tp = document.getElementById('TOOL_PANEL');
    return { ai: T.ai - a0, draft: !!BT.draft, p1: BT.draft && BT.draft.p1.length, pv: !!document.getElementById('bt2-pv'), sheet: /첫 문항/.test((document.getElementById('bt2-pv') || {}).textContent || ''),
      btns: ['l3b-print', 'l3b-key', 'l3b-both', 'l3b-save', 'l3b-many'].filter((id) => !tp.querySelector('#' + id)), chat: !!document.getElementById('l3b-chat') };
  });
  t('「⚡ AI 초안 만들기」 → 가짜 AI 1번 · 초안 1부 4문항 · 가운데 A4 미리보기', F.ai === 1 && F.draft && F.p1 === 4 && F.pv && F.sheet, JSON.stringify(F));
  t('초안 뒤 오른쪽: 🖨 인쇄 · 🔑 답지 · 둘 다 · 💾 보관 · 👥 · 💬 채팅 칸', F.btns.length === 0 && F.chat, JSON.stringify(F));

  /* 💬 채팅 한 줄 → bt2ChatSend */
  const G = await pg.evaluate(async () => {
    const orig = window.bt2ChatSend; window.bt2ChatSend = function (x) { T.chats.push(x); return orig.apply(this, arguments); };
    T.next = { reply: '3번을 쉽게 바꿨습니다', replace: [{ part: 'p1', no: 3, type: 'blank', q: '쉬운 셋째 문항 [[  ]]', a: '다' }] };
    const a0 = T.ai; const el = document.getElementById('l3b-chat'); el.focus(); el.value = '3번 더 쉽게'; el.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('l3b-chat-go').click();
    for (let i = 0; i < 40 && BT.chat.busy; i++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 80));
    window.bt2ChatSend = orig;
    return { chats: T.chats.slice(), ai: T.ai - a0, log: BT.chat.log.map((m) => m.r + ':' + m.t), last: (document.getElementById('l3b-chat-last') || {}).textContent, box: document.getElementById('l3b-chat').value };
  });
  t('💬 오른쪽 채팅 칸 「3번 더 쉽게」 → bt2ChatSend(그 말) · AI 1번 · 대화 기록 · 칸 비움 · 답 한 줄', G.chats.join() === '3번 더 쉽게' && G.ai === 1 && G.log[0] === 'me:3번 더 쉽게' && /^ai:/.test(G.log[1]) && G.box === '' && G.last.length > 0, JSON.stringify(G));
  await pg.evaluate(() => document.querySelectorAll('.app *').forEach((e) => { if (e.scrollTop && !e.closest('#TOOL_PANEL')) e.scrollTop = 0; }));
  await pg.screenshot({ path: SP + '/v19106_bt.png' });

  /* 💾 보관 · 보관함 열기 */
  const H = await pg.evaluate(async () => {
    const n0 = BT.saved.length; document.getElementById('l3b-save').click(); await new Promise((r) => setTimeout(r, 60));
    const o = { saved: BT.saved.length - n0, up: T.upserts.indexOf('blank_tests') >= 0, boxN: document.querySelectorAll('#LIST_CONTENT [data-l3b-box]').length, boxOn: !!document.querySelector('#LIST_CONTENT [data-l3b-box].on') };
    const b = [...document.querySelectorAll('#LIST_CONTENT [data-l3b-box]')].find((x) => /중3 같은 시험지/.test(x.textContent)); b.click(); await new Promise((r) => setTimeout(r, 60));
    o.open = BT.draft && BT.draft.id; o.stu = BT.stu; o.many = (BT.many || []).map((x) => x.id).join(); o.pmany = (document.getElementById('l3b-pmany') || {}).textContent;
    o.on = !!document.querySelector('#LIST_CONTENT [data-l3b-box].on') && /중3 같은 시험지/.test(document.querySelector('#LIST_CONTENT [data-l3b-box].on').textContent);
    o.pv = /보관 문항/.test((document.getElementById('bt2-pv') || {}).textContent || '');
    const one = [...document.querySelectorAll('#LIST_CONTENT [data-l3b-box]')].find((x) => /옛 백지테스트/.test(x.textContent)); one.click(); await new Promise((r) => setTimeout(r, 60));
    o.open2 = BT.draft && BT.draft.id; o.many2 = BT.many;
    return o;
  });
  t('오른쪽 💾 보관 → 보관함 +1 · 서버 저장 · 왼쪽 보관함 3줄(지금 것 파란색)', H.saved === 1 && H.up && H.boxN === 3 && H.boxOn, JSON.stringify(H));
  t('보관함 «2명» 줄 → 그 시험지 열림(bt:s1) · 미리보기 · 「🖨 2명 한꺼번에 인쇄」 · 그 줄 파란색', H.open === 'bt:s1' && H.stu === 'AAA111' && H.many === 'bt:s1,bt:s2' && H.pmany === '🖨 2명 한꺼번에 인쇄' && H.on && H.pv, JSON.stringify(H));
  t('보관함 한 장짜리 → 그 시험지 · 여러 명 인쇄 없음', H.open2 === 'bt:s3' && H.many2 === null, JSON.stringify([H.open2, H.many2]));

  /* 가운데 단추 그대로 */
  const K = await pg.evaluate(() => { const tx = [...document.querySelectorAll('#CONTENT button')].map((b) => b.textContent.trim());
    return ['⚡ AI 초안 만들기', '🖨️ 시험지 인쇄', '🔑 채점용 답지', '🖨️+🔑 둘 다', '💾 보관', '🔄 새로고침', '📝 만들기', '보내기'].filter((x) => tx.indexOf(x) < 0)
      .concat(document.querySelectorAll('#CONTENT [onclick^="bt2SelTog("]').length === 3 ? [] : ['학생 칩']); });
  t('가운데 단추·학생 칩(숨김일 뿐) 그대로', K.length === 0, JSON.stringify(K));

  /* ══════ 🚑 리커버리 ══════ */
  await pg.evaluate(() => {
    const ym = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const now = new Date(), pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const wk = rcWeekKey(); window.T.wk = wk;
    const thisW = ym(now) + '-01', lastW = ym(pm) + '-15';
    const ST = getSortedStudents();
    window.rcRows = () => [
      { st: ST[0], sid: 'I1', stKey: 'S1', testHit: { wid: 777, title: '중3 주간', score: 60, correct: 12, total: 20, date: '2026-10-06' }, unitHits: [], carryHits: [], match: [], rx: ['「다항식」 다시'], pri: 1 },
      { st: ST[1], sid: 'I2', stKey: 'S2', testHit: { wid: 777, title: '중3 주간', score: 70, correct: 14, total: 20, date: '2026-10-06' }, unitHits: [], carryHits: [], match: [], rx: [], pri: 1 },
      { st: ST[2], sid: 'I3', stKey: 'S3', testHit: null, unitHits: [{ bid: '1', book: '교재', n: '집합', rate: 52, minP: 10, maxP: 20 }], carryHits: [], match: [], rx: [], pri: 2 } ];
    const calls = {}; calls[wk] = { S1: { on: true, slot: '10:00' }, S2: { on: true }, S4: { on: true, manual: true, snap: { name: '◇◇◇', group: 'T5' } } };
    if (thisW !== wk) calls[thisW] = { S1: { on: true, done: thisW }, S3: { on: true } };
    calls[lastW] = { S2: { on: true, done: lastW } };
    RC.loaded = true; RC.view = 'board'; RC.state = { calls, dates: {}, periods: {} };
    window.rcSaveState = async () => {};
    RCWS.loaded = true; RCWS.made = {}; RCWS.rule = { twinPer: 2, tbPer: 1, bookTwin: 1, boost: true, theory: false, days: 28, auto: true };
    T.store.rc_ws_rule = JSON.parse(JSON.stringify(RCWS.rule));
    ['rcPublishCalls', 'rcMakeWsAll', 'rcPrint', 'rcOpenSms'].forEach((f) => { window[f] = () => { T.calls.push(f); }; });
    T.calls = []; VIEW = 'recovery'; try { GRP = groupOfView('recovery'); } catch (e) {} render();
  });
  await wait(150);
  const R = await pg.evaluate(() => {
    const LC = document.getElementById('LIST_CONTENT');
    const st = [...LC.querySelectorAll('[data-l3r-stu]')].map((b) => b.getAttribute('data-l3r-stu') + '|' + b.textContent);
    return { head: (LC.querySelector('.l3-vhead') || {}).textContent, st, sec: [...LC.querySelectorAll('.l3-sec')].map((e) => e.textContent), ledger: [...LC.querySelectorAll('[data-l3r-ledger]')].map((b) => b.getAttribute('data-l3r-ledger') + '|' + b.textContent),
      det: !!LC.querySelector('details.common-menu'), tools: ['l3r-rule', 'l3r-make', 'l3r-acct-box'].filter((id) => !document.querySelector('#TOOL_PANEL #' + id)), body: document.body.classList.contains('l3-bt-left') };
  });
  t('리커버리 왼쪽 맨 위 「🚑 리커버리」 · 「이번 주 호출 … · 🚑 3」', /🚑 리커버리/.test(R.head) && R.sec.some((s) => /^이번 주 호출 \(.*\) · 🚑 3$/.test(s)), JSON.stringify([R.head, R.sec]));
  t('확정 3명(🚑 · 점수 12/20 · 10:00 · 👋 직접) 먼저, 그 뒤 「예상 명단 · 미정」 1명(🚑 없음)',
    R.st.length === 4 && /^S1\|○○○주간 12\/20 · 확정 · 10:00🚑$/.test(R.st[0]) && /^S2\|△△△주간 14\/20 · 확정🚑$/.test(R.st[1]) && /^S4\|◇◇◇👋 직접 · 확정🚑$/.test(R.st[2]) && /^S3\|□□□단원 52% · 미정$/.test(R.st[3]) && R.sec.indexOf('예상 명단 · 미정') >= 0, JSON.stringify(R.st));
  t('장부: 이번 달 · 지난달 (지난달 호출 1명 · 완료 1 · 100%) · 접힌 공용 메뉴 · 도구 3칸', R.ledger.length === 2 && /^this\|\d+월 호출 \d+명/.test(R.ledger[0]) && /^last\|\d+월 호출 1명완료 1 · 100%📒$/.test(R.ledger[1]) && R.det && R.tools.length === 0 && !R.body, JSON.stringify([R.ledger, R.tools, R.body]));

  /* 학생 누르기 → 가운데 카드 깜빡 */
  const P = await pg.evaluate(async () => {
    document.querySelector('#LIST_CONTENT [data-l3r-stu="S2"]').click(); await new Promise((r) => setTimeout(r, 250));
    const f = document.querySelector('#CONTENT .l3-flash');
    const o = { focus: L3B.rcFocus, on: [...document.querySelectorAll('#LIST_CONTENT [data-l3r-stu].on')].map((b) => b.getAttribute('data-l3r-stu')), card: !!f && /△△△/.test(f.textContent) && /주간 70점/.test(f.textContent) };
    document.querySelector('#LIST_CONTENT [data-l3r-stu="S4"]').click(); await new Promise((r) => setTimeout(r, 250));
    const f2 = [...document.querySelectorAll('#CONTENT .l3-flash')].find((x) => /◇◇◇/.test(x.textContent)); o.side = !!f2 && /👋 직접/.test(f2.textContent);
    RC.view = 'ledger'; render(); document.querySelector('#LIST_CONTENT [data-l3r-stu="S1"]').click(); await new Promise((r) => setTimeout(r, 250));
    o.back = RC.view === 'board' && !!document.querySelector('#CONTENT .l3-flash');
    document.querySelector('#LIST_CONTENT [data-l3r-ledger="last"]').click(); o.ledger = RC.view; RC.view = 'board'; render();
    return o;
  });
  t('왼쪽 △△△ → 가운데 그 학생 카드로 가서 깜빡 · 그 줄 파란색', P.focus === 'S2' && P.card && P.on.join() === 'S2', JSON.stringify(P));
  t('직접 추가 학생 → 오른쪽 확정 명단 줄 깜빡 · 장부 화면에서 눌러도 보드로 · 장부 줄 → 운영 장부', P.side && P.back && P.ledger === 'ledger', JSON.stringify(P));

  /* 학습지 규칙 → rc_ws_rule */
  const Q = await pg.evaluate(async () => {
    const ck = (k) => document.getElementById('l3r-' + k); const o = { init: ['twinPer', 'tbPer', 'bookTwin', 'boost', 'auto', 'theory'].map((k) => k + ':' + ck(k).checked).join(), n: document.getElementById('l3r-twinPer-n').value };
    const s0 = T.sets.length;
    ck('twinPer').click(); await new Promise((r) => setTimeout(r, 30));
    o.t0 = RCWS.rule.twinPer; o.s0 = T.store.rc_ws_rule.twinPer; o.sel0 = document.getElementById('l3r-twinPer-n').disabled; o.ck0 = ck('twinPer').checked;
    ck('boost').click(); await new Promise((r) => setTimeout(r, 30));
    o.b = RCWS.rule.boost; o.sb = T.store.rc_ws_rule.boost; o.sets = T.sets.length - s0; o.keys = T.sets.slice(s0).join();
    ck('twinPer').click(); await new Promise((r) => setTimeout(r, 30)); o.t1 = T.store.rc_ws_rule.twinPer;
    const sel = document.getElementById('l3r-twinPer-n'); sel.value = '3'; sel.dispatchEvent(new Event('change', { bubbles: true })); await new Promise((r) => setTimeout(r, 30)); o.t3 = T.store.rc_ws_rule.twinPer;
    o.rule = rcwsRule(); o.up = !!T.store.rc_ws_rule.updated;
    ck('boost').click(); sel.value = '2'; await new Promise((r) => setTimeout(r, 30)); document.getElementById('l3r-twinPer-n').value = '2'; document.getElementById('l3r-twinPer-n').dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30)); o.end = T.store.rc_ws_rule.twinPer + '/' + T.store.rc_ws_rule.boost;
    return o;
  });
  t('규칙 처음: 쌍둥이 ✓(2) · 교과서 ✓ · 교재 ✓ · 보강 ✓ · 자동채점 ✓ · 이론 □', Q.init === 'twinPer:true,tbPer:true,bookTwin:true,boost:true,auto:true,theory:false' && Q.n === '2', JSON.stringify(Q));
  t('쌍둥이 끄기 → rc_ws_rule.twinPer 0 (서버 저장) · 수 칸 잠김', Q.t0 === 0 && Q.s0 === 0 && Q.sel0 && !Q.ck0, JSON.stringify(Q));
  t('보강 끄기 → boost false 저장 · 저장 길은 rc_ws_rule(supaSetItem) · 다시 켜면 2 · 수 3 으로', Q.b === false && Q.sb === false && Q.sets === 2 && Q.keys === 'rc_ws_rule,rc_ws_rule' && Q.t1 === 2 && Q.t3 === 3 && Q.rule.twinPer === 3 && Q.up && Q.end === '2/true', JSON.stringify(Q));

  /* 만들기 · 계정 */
  const M = await pg.evaluate(async () => {
    const o = {}; T.calls = [];
    ['l3r-pub', 'l3r-all', 'l3r-print', 'l3r-sms'].forEach((id) => document.getElementById(id).click());
    o.calls = T.calls.join(); o.pubTxt = document.getElementById('l3r-pub').textContent; o.allTxt = document.getElementById('l3r-all').textContent;
    o.acct0 = document.getElementById('l3r-acct').textContent;
    document.getElementById('l3r-acct-open').click(); await new Promise((r) => setTimeout(r, 250));
    o.focus = document.activeElement && document.activeElement.id; o.flash = !!document.querySelector('#CONTENT .l3-flash #rcws-id');
    _origSetItem('or_mf_id', 'testid'); _origSetItem('or_mf_pw', 'not-real'); render();
    o.acct1 = document.getElementById('l3r-acct').textContent; o.clear = !!document.getElementById('l3r-acct-clear');
    _origRemoveItem('or_mf_id'); _origRemoveItem('or_mf_pw'); render();
    o.center = ['📣 학생앱에 알리기', '🧩 확정 전원 학습지 한번에 생성', '📨 학부모 안내문 확인', '🚑 이번 주 보드', '📒 운영 장부'].filter((x) => !(document.getElementById('CONTENT').textContent.indexOf(x) >= 0));
    return o;
  });
  t('「📣 학생앱에 알리기 (3명)」 → rcPublishCalls · ⚡ → rcMakeWsAll · 🖨 → rcPrint · 📨 → rcOpenSms', M.calls === 'rcPublishCalls,rcMakeWsAll,rcPrint,rcOpenSms' && /📣 학생앱에 알리기 \(3명\)/.test(M.pubTxt) && /⚡ 확정 전원 학습지 생성 \(2명\)/.test(M.allTxt), JSON.stringify(M));
  t('🔐 계정: 저장 안 됨 → 「계정 넣는 칸 열기」 → 가운데 아이디 칸으로 · 커서 · 저장되면 «✓ 이 PC 에 저장됨 (tes***)»', /저장 안 됨/.test(M.acct0) && M.focus === 'rcws-id' && M.flash && /✓ 이 PC 에 저장됨 \(tes\*\*\*\)/.test(M.acct1) && M.clear, JSON.stringify(M));
  t('리커버리 가운데 단추·보드/장부 그대로', M.center.length === 0, JSON.stringify(M.center));
  /* 가운데 폭에 따라 «확정 명단» 칸: 760px 이하 → 카드 아래 한 칸 · 1000px 이하 → 300px · 그보다 넓으면 예전 400px */
  const gridAt = async (w) => { await pg.setViewportSize({ width: w, height: 900 }); await wait(350);
    return pg.evaluate(() => { render(); const wr = document.querySelector('#CONTENT .l3r-wrap'), g = document.querySelector('#CONTENT .l3r-grid'), side = g.lastElementChild;
      return { wrap: Math.round(wr.getBoundingClientRect().width), cols: getComputedStyle(g).gridTemplateColumns.split(' '), pos: getComputedStyle(side).position,
        below: side.getBoundingClientRect().top >= g.firstElementChild.getBoundingClientRect().bottom - 2, card: Math.round(g.firstElementChild.getBoundingClientRect().width), tp: getComputedStyle(document.getElementById('TOOL_PANEL')).width }; }); };
  const okGrid = (x) => x.wrap <= 760 ? (x.cols.length === 1 && x.pos === 'static' && x.below) : (x.wrap <= 1000 ? (x.cols.length === 2 && x.cols[1] === '300px') : (x.cols.length === 2 && x.cols[1] === '400px'));
  const G14 = await gridAt(1400), G16 = await gridAt(1650), G19 = await gridAt(1920);
  console.log('   폭', JSON.stringify([G14, G16, G19].map((x) => [x.wrap, x.cols.length, x.cols[1] || '', x.card])));
  t('리커버리 가운데 «확정 명단»: 가운데 폭 따라 아래로 · 300px · 400px (1400 · 1650 · 1920px, 도구 칸 280px)', [G14, G16, G19].every(okGrid) && G14.cols.length === 1 && G14.card > 550 && G19.cols[1] === '400px' && [G14, G16, G19].every((x) => x.tp === '280px'), JSON.stringify([G14, G16, G19]));
  await pg.setViewportSize({ width: 1400, height: 900 }); await wait(350);
  await pg.evaluate(() => { L3B.rcFocus = ''; render(); document.querySelectorAll('.app *').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); });
  await pg.screenshot({ path: SP + '/v19106_rc.png' });

  /* 1100px — 「🛠 도구」 단추 */
  await pg.setViewportSize({ width: 1100, height: 850 }); await wait(400);
  const N = await pg.evaluate(() => { render(); const fb = document.getElementById('L3_FAB'); const o = { fab: !!fb && getComputedStyle(fb).display !== 'none', tp: getComputedStyle(document.getElementById('TOOL_PANEL')).display, left: document.querySelectorAll('#LIST_CONTENT [data-l3r-stu]').length };
    VIEW = 'blank'; render(); o.bfab = getComputedStyle(document.getElementById('L3_FAB')).display !== 'none'; o.bleft = document.querySelectorAll('#LIST_CONTENT [data-l3b-sel]').length;
    o.chips = [...document.querySelectorAll('#CONTENT .l3b-chide')].map((e) => getComputedStyle(e).display).filter((d) => d === 'none').length; return o; });
  t('1100px: 도구 칸 숨김 · 「🛠 도구」 단추(두 화면) · 왼쪽 목록 그대로 · 가운데 학생 칩은 보임', N.fab && N.tp === 'none' && N.left === 4 && N.bfab && N.bleft === 3 && N.chips === 0, JSON.stringify(N));

  /* 420px — 바뀐 것 없음 */
  await pg.setViewportSize({ width: 420, height: 860 }); await wait(400);
  const Z = await pg.evaluate(() => { const o = {};
    ['blank', 'recovery'].forEach((v) => { VIEW = v; render(); const LC = document.getElementById('LIST_CONTENT'), fb = document.getElementById('L3_FAB'); const d = document.createElement('div'); d.innerHTML = rList();
      o[v] = { mine: LC.querySelectorAll('[data-l3b-sel],[data-l3r-stu],details.common-menu').length, same: LC.innerHTML.length === d.innerHTML.length, fab: !!fb && getComputedStyle(fb).display !== 'none', tools: document.getElementById('TOOL_PANEL').textContent, body: document.body.classList.contains('l3-bt-left') }; });
    return o; });
  t('420px: 백지테스트·리커버리 왼쪽은 예전 공용 메뉴 그대로 · 도구·단추 없음', ['blank', 'recovery'].every((v) => Z[v].mine === 0 && Z[v].same && !Z[v].fab && Z[v].tools === '' && !Z[v].body), JSON.stringify(Z));

  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
