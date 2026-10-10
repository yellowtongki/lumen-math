#!/usr/bin/env node
/* 학원앱 v19-98 검사 — 📝 백지테스트 «🌳 매쓰플랫 7단계 단원 트리» (가짜 트리 · 가짜 유형DB · 가짜 교과서 은행 · 가짜 AI · 외부망 차단)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v1998.js lumen_v19-98.html
 *   그림: $SP/v1998_tree.png (트리 상자)
 *   가짜 트리 = 2026-10-10 매쓰플랫에서 받은 공통수학1(22개정) 일부 — 다항식 › 다항식의 사칙연산 의 개념 3개만 주제유형·세부유형까지,
 *   나머지 개념은 주제유형 없이. 대표 문항 ID·그림 주소는 가짜(80000x). 학생 자료 없음. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-98.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-98'])[0];
const TREE = {"updated":"2026-10-10T00:00:00Z","rev":"22","label":"공통수학1","schoolType":"HIGH","curriculumId":4175,"b":[{"id":4186,"n":"다항식","m":[{"id":4337,"n":"다항식의 연산","s":[{"id":4658,"n":"다항식의 사칙연산","c":[{"id":15996,"n":"다항식의 정리방법","pr":61,"tc":3,"sc":13,"t":[{"id":28442,"n":"다항식의 여러 가지 용어","u":[{"id":148879,"n":"단항식의 차수와 계수 구하기 [소문항]","pid":800001,"img":"https://freewheelin-contents.mathflat.com/problem/800001/0a1b2c3d/problem.png"},{"id":126644,"n":"다항식의 상수항 구하기","pid":800002,"img":"https://freewheelin-contents.mathflat.com/problem/800002/0a1b2c3d/problem.png"},{"id":148878,"n":"다항식의 용어에 대한 설명으로 옳은 것 (옳지 않은 것) 찾기","pid":800003,"img":"https://freewheelin-contents.mathflat.com/problem/800003/0a1b2c3d/problem.png"},{"id":148875,"n":"다항식의 항, 차수, 계수 구하기 [소문항]","pid":800004,"img":"https://freewheelin-contents.mathflat.com/problem/800004/0a1b2c3d/problem.png"},{"id":148876,"n":"다항식에 대한 설명(항, 차수, 계수으로 옳은 것 (옳지 않은 것) 찾기","pid":800005,"img":"https://freewheelin-contents.mathflat.com/problem/800005/0a1b2c3d/problem.png"}]},{"id":28444,"n":"오름차순 또는 내림차순으로 정리","u":[{"id":126647,"n":"다항식이 주어졌을 때 x에 대한 내림차순으로 정리하기","pid":800006,"img":"https://freewheelin-contents.mathflat.com/problem/800006/0a1b2c3d/problem.png"},{"id":126648,"n":"다항식이 주어졌을 때 y에 대한 오름차순으로 정리하기","pid":800007,"img":"https://freewheelin-contents.mathflat.com/problem/800007/0a1b2c3d/problem.png"},{"id":104381,"n":"다항식이 주어졌을 때 x에 대한 내림차순으로 정리하기 [빈칸채우기]","pid":800008,"img":"https://freewheelin-contents.mathflat.com/problem/800008/0a1b2c3d/problem.png"},{"id":126649,"n":"다항식을 x(또는 y)에 대한 오름차순, 내림차순으로 정리하기 [소문제]","pid":800009,"img":"https://freewheelin-contents.mathflat.com/problem/800009/0a1b2c3d/problem.png"},{"id":126650,"n":"x(또는 y)에 대한 오름차순, 내림차순으로 정리한 것이 옳지 않은(옳은) 다항식 찾기 [객관식]","pid":800010,"img":"https://freewheelin-contents.mathflat.com/problem/800010/0a1b2c3d/problem.png"},{"id":183907,"n":"x(또는 y)에 대한 오름차순, 내림차순으로 정리한 다항식 찾기 [합답형]","pid":800011,"img":"https://freewheelin-contents.mathflat.com/problem/800011/0a1b2c3d/problem.png"}]},{"id":28445,"n":"다항식의 정리(종합)","u":[{"id":126652,"n":"다항식을 오름차순, 내림차순으로 정리했을 때 옳은 것만을 있는 대로 고르기 [합답형]","pid":800012,"img":"https://freewheelin-contents.mathflat.com/problem/800012/0a1b2c3d/problem.png"},{"id":126653,"n":"다변수 다항식의 정리와 차수 판단","pid":800013,"img":"https://freewheelin-contents.mathflat.com/problem/800013/0a1b2c3d/problem.png"}]}]},{"id":15998,"n":"다항식의 덧셈과 뺄셈","pr":61,"tc":5,"sc":30,"t":[{"id":28447,"n":"두 다항식의 덧셈과 뺄셈","u":[{"id":126657,"n":"두 다항식 A, B가 주어졌을 때 A±B를 간단히 하기","pid":800014,"img":"https://freewheelin-contents.mathflat.com/problem/800014/0a1b2c3d/problem.png"},{"id":126658,"n":"두 다항식 A, B가 주어졌을 때 mA±nB를 간단히 하기 (m, n은 상수)","pid":800015,"img":"https://freewheelin-contents.mathflat.com/problem/800015/0a1b2c3d/problem.png"},{"id":126659,"n":"두 다항식 A, B가 주어졌을 때 A±B를 계산하기 [소문제]","pid":800016,"img":"https://freewheelin-contents.mathflat.com/problem/800016/0a1b2c3d/problem.png"}]},{"id":28448,"n":"세 다항식의 덧셈과 뺄셈","u":[{"id":126666,"n":"세 다항식 A, B, C가 주어졌을 때 mA±nB±lC를 간단히 하기 (m, n, l은 상수)","pid":800017,"img":"https://freewheelin-contents.mathflat.com/problem/800017/0a1b2c3d/problem.png"},{"id":126667,"n":"다항식의 곱셈과 덧셈, 뺄셈을 이용한 합성 다항식 계산","pid":800018,"img":"https://freewheelin-contents.mathflat.com/problem/800018/0a1b2c3d/problem.png"},{"id":126668,"n":"세 다항식 A, B, C가 주어졌을 때 복잡한 식을 간단히 하기","pid":800019,"img":"https://freewheelin-contents.mathflat.com/problem/800019/0a1b2c3d/problem.png"}]}]},{"id":16006,"n":"곱셈 공식의 변형(1) 문자가 2개","pr":61,"tc":5,"sc":49,"t":[{"id":28496,"n":"수가 직접 주어졌을 때, 계산하기","u":[{"id":126925,"n":"하나의 수가 주어졌을 때, 세제곱 계산하기","pid":800020,"img":"https://freewheelin-contents.mathflat.com/problem/800020/0a1b2c3d/problem.png"},{"id":126926,"n":"x, y의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800021,"img":"https://freewheelin-contents.mathflat.com/problem/800021/0a1b2c3d/problem.png"},{"id":126927,"n":"두 수가 주어졌을 때, 세제곱의 합 구하기","pid":800022,"img":"https://freewheelin-contents.mathflat.com/problem/800022/0a1b2c3d/problem.png"}]},{"id":28497,"n":"두 수의 합/차, 곱이 주어졌을 때, 계산하기","u":[{"id":126937,"n":"x+y, xy의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800023,"img":"https://freewheelin-contents.mathflat.com/problem/800023/0a1b2c3d/problem.png"},{"id":126938,"n":"x-y, xy의 값이 주어졌을 때, x^2+y^2 계산하기","pid":800024,"img":"https://freewheelin-contents.mathflat.com/problem/800024/0a1b2c3d/problem.png"},{"id":126939,"n":"x+y, xy의 값이 주어졌을 때, (x-y)^2 계산하기","pid":800025,"img":"https://freewheelin-contents.mathflat.com/problem/800025/0a1b2c3d/problem.png"}]}]}]}]},{"id":4338,"n":"나머지정리","s":[{"id":4659,"n":"항등식과 나머지 정리","c":[{"id":16011,"n":"항등식의 뜻과 성질","pr":61,"tc":2,"sc":5,"t":[]},{"id":16012,"n":"항등식에서 미정계수 구하기(1) 계수 비교법","pr":61,"tc":5,"sc":25,"t":[]}]}]}]},{"id":4187,"n":"방정식과 부등식","m":[{"id":4340,"n":"복소수와 이차방정식","s":[{"id":4661,"n":"복소수의 뜻과 성질","c":[{"id":16208,"n":"복소수의 뜻과 분류","pr":61,"tc":6,"sc":27,"t":[]},{"id":16211,"n":"복소수의 사칙연산","pr":61,"tc":6,"sc":49,"t":[]}]}]}]}]};
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
/* 페이지 안에서 쓸 가짜 자료 (test_v1997 과 같은 유형DB·학생 + 교과서 은행은 1문항) */
async function setup(pg, withTree) {
  await pg.evaluate(({ TREE, withTree }) => {
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
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '△△△', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'BBB222' }];
    window.T98 = { upserts: 0, reads: [] };
    window.getSupaClient = () => ({ from: (tb) => ({
      upsert: () => { T98.upserts++; return Promise.resolve({}); },
      select: () => ({ eq: (k, v) => { T98.reads.push(v); return Promise.resolve({ data: (withTree && v === 'mf_tree_22_공통수학1') ? [{ value: JSON.parse(JSON.stringify(TREE)) }] : [] }); } }) }) });
    window.HWC = { loaded: true, stuck: {} }; window.ahaNotes = []; window.HWB = { loaded: true, swb: {} };
    window.tqSummary = () => ({ weak: [], newweak: [], worse: [] });
    T98.calls = 0; T98.lastPrompt = ''; T98.next = null;
    window.callAI = async (p) => { T98.calls++; T98.lastPrompt = p; return typeof T98.next === 'string' ? T98.next : JSON.stringify(T98.next); };
    window.plToast = (m) => { T98.toast = m; };
    /* 화면: 시험 상자 하나에 rBtMake() 를 그린다 (render 도 여기로) */
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = rBtMake(); }; window.btPainting = () => true;
    BT.loaded = true; BT.saved = []; BT.stu = 'AAA111'; BT.cfg.p1 = 4; BT.cfg.p2 = 0; BT.cfg.p3 = 3; BT.cfg.p3mode = 'tb'; BT.cfg.course = ''; BT.cfg.subs = [];
  }, { TREE, withTree });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await setup(pg, true);
  /* 1) 트리 받기 · 처음 모양 */
  const o1 = await pg.evaluate(async () => {
    render(); bt2Course('공통수학1'); await new Promise((r) => setTimeout(r, 80)); render();
    const box = document.getElementById('tdemo'); const ks = [...box.querySelectorAll('#bt2-tree [data-k]')].map((e) => e.getAttribute('data-k'));
    return { ver: APP_VER, on: bt2TrOn(), reads: T98.reads.slice(), ks, chips: [...box.querySelectorAll('button')].map((b) => b.textContent).filter((x) => /전부$|모두 해제|이 소단원만/.test(x)),
      sel: BT.cfg.sel && BT.cfg.sel.cids.slice(), big: BT.cfg.big, oldChips: /bt2SubTog\(/.test(box.innerHTML), src: !!box.querySelector('select[onchange*="p3src"]'), srcVal: (box.querySelector('select[onchange*="p3src"]') || {}).value, sum: (box.innerHTML.match(/고른 범위 <b[^>]*>([^<]*)<\/b>/) || [])[1] };
  });
  t('버전 ' + WANT, o1.ver === WANT, o1.ver);
  t('트리 받기: mf_tree_22_공통수학1 를 읽고 트리 켜짐', o1.on && o1.reads.indexOf('mf_tree_22_공통수학1') >= 0, JSON.stringify(o1.reads));
  t('처음 모양: 기본 대단원(다항식)의 대단원·중단원·소단원이 열리고 개념은 닫힘 · 다른 대단원은 닫힘', ['b:4186', 'm:4337', 's:4658', 'c:15996', 'c:15998', 'c:16006', 'm:4338', 's:4659', 'c:16011'].every((k) => o1.ks.indexOf(k) >= 0) && !o1.ks.some((k) => /^[tu]:/.test(k)) && o1.ks.indexOf('b:4187') >= 0 && !o1.ks.some((k) => k === 'c:16208'), JSON.stringify(o1.ks));
  t('처음 고른 것: 첫 중단원 개념 3개 · 대단원 다항식 · 예전 소단원 칩 없음', JSON.stringify(o1.sel) === '[15996,15998,16006]' && o1.big === '다항식' && !o1.oldChips, JSON.stringify([o1.sel, o1.big, o1.oldChips]));
  t('빠르게: 「다항식 전부」「방정식과 부등식 전부」「모두 해제」 · 3부 출처 고르기(기본 섞기)', o1.chips.indexOf('다항식 전부') >= 0 && o1.chips.indexOf('방정식과 부등식 전부') >= 0 && o1.chips.indexOf('모두 해제') >= 0 && o1.src && o1.srcVal === 'mix', JSON.stringify([o1.chips, o1.srcVal]));
  /* 2) 체크 — 모두 해제 → 소단원 체크 → 개념 열기 → 주제유형 하나 끄기 → 세부유형 하나 끄기 */
  const o2 = await pg.evaluate(async () => {
    const box = document.getElementById('tdemo'); const q = (k, cb) => box.querySelector('#bt2-tree [data-k="' + k + '"]' + (cb ? ' [data-cb]' : ''));
    const clickBtn = (txt) => [...box.querySelectorAll('button')].find((b) => b.textContent === txt).click();
    const out = {};
    clickBtn('모두 해제'); out.cleared = BT.cfg.sel.cids.length;
    q('s:4658', true).click(); out.afterSub = BT.cfg.sel.cids.slice(); out.subCb = q('s:4658', true).className; out.bigCb = q('b:4186', true).className;
    out.focusChip = [...box.querySelectorAll('button')].some((b) => /이 소단원만/.test(b.textContent));
    q('c:15996').querySelector('.nm').click(); out.topicRows = [...box.querySelectorAll('#bt2-tree [data-k^="t:"]')].map((e) => e.getAttribute('data-k'));
    q('t:28444', true).click(); out.exT = BT.cfg.sel.exT.slice(); out.conCb = q('c:15996', true).className + '|' + q('c:15996', true).textContent; out.cids2 = BT.cfg.sel.cids.slice();
    q('t:28442').querySelector('.nm').click(); q('u:148879', true).click(); out.exU = BT.cfg.sel.exU.slice(); out.topCb = q('t:28442', true).className;
    q('u:148879').querySelector('.nm').click(); out.reOn = BT.cfg.sel.exU.slice();      // 잎 줄을 누르면 다시 켜짐
    q('u:148879', true).click();
    out.picked = bt2Picked(); out.counts = bt2TrCounts();
    out.scrollEl = !!document.getElementById('bt2-tree');
    return out;
  });
  t('「모두 해제」 → 아무것도 안 고름', o2.cleared === 0, o2.cleared);
  t('소단원 체크 → 아래 개념 3개 전부 ✓ · 대단원은 –(다른 중단원 있음) · 「이 소단원만」 칩 생김', JSON.stringify(o2.afterSub) === '[15996,15998,16006]' && /\bon\b/.test(o2.subCb) && /half/.test(o2.bigCb) && o2.focusChip, JSON.stringify(o2));
  t('개념 열기 → 주제유형 3줄 · 주제유형 하나 끄기 → exT 에 들어가고 개념은 –', JSON.stringify(o2.topicRows) === '["t:28442","t:28444","t:28445"]' && JSON.stringify(o2.exT) === '[28444]' && /half/.test(o2.conCb) && /–/.test(o2.conCb) && o2.cids2.indexOf(15996) >= 0, JSON.stringify([o2.topicRows, o2.exT, o2.conCb]));
  t('세부유형 하나 끄기 → exU · 주제유형 – · 잎 줄 누르면 다시 켜짐', JSON.stringify(o2.exU) === '[148879]' && /half/.test(o2.topCb) && o2.reOn.length === 0, JSON.stringify([o2.exU, o2.topCb, o2.reOn]));
  t('bt2Picked() → 소단원 「다항식의 사칙연산」 · 개념 3개', o2.picked.length === 1 && o2.picked[0].s === '다항식의 사칙연산' && o2.picked[0].m === '다항식의 연산' && o2.picked[0].t.length === 3, JSON.stringify(o2.picked));
  t('고른 수: 개념 3 · 주제유형 6 · 세부유형 (4+2)+3+3+3+3=18', o2.counts.c === 3 && o2.counts.t === 6 && o2.counts.u === 18, JSON.stringify(o2.counts));
  /* 그림: 트리 상자 */
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); BT.tree.open['t:28444'] = true; render(); });
  const r = await pg.evaluate(() => { const a = document.querySelector('#tdemo #bt2-tree').parentElement.getBoundingClientRect(); const c = [...document.querySelectorAll('#tdemo div')].find((d) => /^빠르게/.test(d.textContent)).getBoundingClientRect(); return { x: a.left + scrollX, y: c.top + scrollY, w: a.width, h: a.bottom - c.top + 30 }; });
  await pg.screenshot({ path: SP + '/v1998_tree.png', fullPage: true, clip: { x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8 } });
  /* 3) 초안 — 3부 섞기: 교과서 1 + 대표 문항 2 */
  const o3 = await pg.evaluate(async () => {
    const it = (q, a, s, type) => ({ type: type || 'blank', q, a, s: s || '다항식의 여러 가지 용어' });
    T98.next = { title: '백지테스트 — 공통수학1 · 다항식', p1: [it('첫 문항 [[  ]]', '가'), it('둘째 문항 [[  ]]', '나'), it('셋째 문항', '다', '두 다항식의 덧셈과 뺄셈', 'write'), it('넷째 문항 [[  ]]', '라')] };
    BT.tb.loading = false; await btGen();
    const d = BT.draft; const p = T98.lastPrompt;
    const out = { p1: d && d.p1.length, p3: d && d.p3.map((x) => ({ id: x.id, rep: !!x.rep, s: x.s, pid: x.pid })), sel: !!(d && d.sel && d.sel.cids.length === 3), src: d && d.p3src,
      prompt: { head: /\[이번 시험 범위 — 개념 › 주제유형 › 세부유형\]/.test(p), oldHead: /소단원과 그 유형/.test(p), sub: /· \[다항식의 사칙연산 › 다항식의 정리방법\] 다항식의 여러 가지 용어 — 세부유형: 다항식의 상수항 구하기 \/ /.test(p) || /다항식의 상수항 구하기/.test(p), full: /\(세부유형 3개 전부\)/.test(p), noExT: !/오름차순 또는 내림차순으로 정리/.test(p), rule6: /"s" 에는 그 문항이 나온 세부유형/.test(p), fmt: /"s":"세부유형"/.test(p) } };
    render(); const box = document.getElementById('tdemo');
    out.ed = { repRows: (box.innerHTML.match(/>매쓰플랫 대표 문항 · /g) || []).length, repRe: (box.innerHTML.match(/bt2RepRe\(/g) || []).length, more: /bt2RepMore\(1\)/.test(box.innerHTML) };
    const sheet = bt2SheetHtml(d, false); out.sheet = { head: /3부\. 교과서 · 유형 대표 문항/.test(sheet), imgs: (sheet.match(/freewheelin-contents\.mathflat\.com\/problem\/80/g) || []).length };
    /* 🔄 대표 문항 바꾸기 */
    const i = d.p3.findIndex((x) => x.rep); const pid0 = d.p3[i].pid; bt2TbRe(i); out.re = { before: pid0, after: d.p3[i].pid, rep: d.p3[i].rep, seen: (d.p3[i].seen || []).slice() };
    const pid1 = d.p3[i].pid; bt2RepRe(i); out.re2 = { after: d.p3[i].pid, notBack: d.p3[i].pid !== pid0 && d.p3[i].pid !== pid1 };
    const key = bt2KeyHtml(d); out.key = { pid: key.indexOf('정답은 매쓰플랫 문제 ID <b>' + d.p3[i].pid + '</b>') >= 0, head: /대표 문항은 매쓰플랫에서 확인/.test(key), tb: /2x\+1/.test(key), s: key.indexOf('매쓰플랫 대표 문항 — ' + d.p3[i].s) >= 0 };
    return out;
  });
  t('초안: 1부 4문항 · 초안에 sel 저장 · 3부 출처 mix', o3.p1 === 4 && o3.sel && o3.src === 'mix', JSON.stringify(o3));
  t('3부 섞기: 교과서 1(은행 1문항) + 대표 문항 2 (rep:true · 서로 다른 세부유형)', o3.p3 && o3.p3.length === 3 && o3.p3[0].id === 1 && !o3.p3[0].rep && o3.p3[1].rep && o3.p3[2].rep && o3.p3[1].s !== o3.p3[2].s && /^rep:80/.test(o3.p3[1].id), JSON.stringify(o3.p3));
  t('AI 지시: [개념 › 주제유형 › 세부유형] 머리 · 세부유형 이름 · 「n개 전부」 · 끈 주제유형 없음 · 규칙 6 세부유형', Object.values(o3.prompt).every((v, i) => (Object.keys(o3.prompt)[i] === 'oldHead' ? !v : v)), JSON.stringify(o3.prompt));
  t('편집 칸: 대표 문항 줄 2 · 🔄(bt2RepRe) · 「+ 대표 문항」', o3.ed.repRows === 2 && o3.ed.repRe === 2 && o3.ed.more, JSON.stringify(o3.ed));
  t('시험지: 「3부. 교과서 · 유형 대표 문항」 · 대표 문항 그림 2', o3.sheet.head && o3.sheet.imgs === 2, JSON.stringify(o3.sheet));
  t('🔄 대표 문항 → 문제 ID 바뀜 · 다시 눌러도 앞 문항으로 안 돌아감', o3.re.after !== o3.re.before && o3.re.rep && o3.re2.notBack, JSON.stringify([o3.re, o3.re2]));
  t('답지: 「매쓰플랫 대표 문항 — 세부유형」 · 「정답은 매쓰플랫 문제 ID …」 · 교과서 정답', o3.key.pid && o3.key.head && o3.key.tb && o3.key.s, JSON.stringify(o3.key));
  /* 4) 채팅 — 세부유형 이름 · 대표 문항 n개 */
  const o4 = await pg.evaluate(async () => {
    const d = BT.draft; const out = {}; const last = () => BT.chat.log[BT.chat.log.length - 1];
    const ed = rBtDraft(); out.chip = (ed.match(/bt2ChatQuick\(/g) || []).length; out.chipRep = /세부유형 대표 문항 2개 더/.test(ed);
    T98.next = { reply: '내림차순 정리 문항을 넣었습니다', add: [{ type: 'blank', q: '내림차순은 차수가 [[  ]] 항부터', a: '높은', s: '다항식이 주어졌을 때 x에 대한 내림차순으로 정리하기' }] };
    const c0 = T98.calls; await bt2ChatSend('내림차순 정리 1문제 더');
    out.scope = { ai: T98.calls === c0 + 1, exT: BT.cfg.sel.exT.slice(), draftSel: d.sel.exT.slice(), prompt: /오름차순 또는 내림차순으로 정리 \(세부유형 6개 전부\)/.test(T98.lastPrompt), reply: last().t, n: d.p1.length };
    const c1 = T98.calls; const n3 = d.p3.length;
    await bt2ChatQuick('세부유형 대표 문항 2개 더');
    out.rep = { ai: T98.calls === c1, add: d.p3.length - n3, allRep: d.p3.slice(n3).every((x) => x.rep), uniq: new Set(d.p3.map((x) => x.pid || x.id)).size === d.p3.length, reply: last().t, undo: !!last().undo, fresh: BT.chat.fresh && Object.keys(BT.chat.fresh.p3).join(',') };
    bt2ChatUndo(); out.undo = d.p3.length === n3 || BT.draft.p3.length === n3;
    /* 출처 바꾸기 → 대표 문항만 */
    btCfg('p3src', 'rep'); out.srcRep = BT.draft.p3.every((x) => x.rep) && BT.draft.p3.length === 3 && BT.cfg.p3src === 'rep';
    btCfg('p3src', 'mix');
    return out;
  });
  t('채팅 빠른 말: 6개 + 「세부유형 대표 문항 2개 더」', o4.chip === 7 && o4.chipRep, JSON.stringify(o4));
  t('채팅 「내림차순 정리 1문제 더」 → 끈 주제유형이 범위로 돌아옴(exT 빔) · 초안 sel 도 · 지시문에 그 주제유형 · 「범위에 ‹…› 을 넣었습니다」', o4.scope.ai && o4.scope.exT.length === 0 && o4.scope.draftSel.length === 0 && o4.scope.prompt && /^범위에 ‹오름차순 또는 내림차순으로 정리› 을 넣었습니다\. /.test(o4.scope.reply) && o4.scope.n === 5, JSON.stringify(o4.scope));
  t('채팅 「세부유형 대표 문항 2개 더」 → AI 안 부름 · 3부 +2 대표 문항 · 겹침 없음 · 되돌리기 · 노란 표시', o4.rep.ai && o4.rep.add === 2 && o4.rep.allRep && o4.rep.uniq && /AI 없이/.test(o4.rep.reply) && o4.rep.undo && !!o4.rep.fresh && o4.undo, JSON.stringify(o4.rep));
  t('3부 출처 「대표 문항만」 → 3부 3개 모두 대표 문항', o4.srcRep, JSON.stringify(o4.srcRep));
  /* 5) 보관 · 열기 · 옛 시험지 · 빠른 칩 */
  const o5 = await pg.evaluate(async () => {
    const out = {};
    window.btSave(); await new Promise((r) => setTimeout(r, 30));
    const s0 = BT.saved[0]; out.save = { sel: !!(s0 && s0.sel && Array.isArray(s0.sel.cids)), cids: s0 && s0.sel.cids.slice(), src: s0 && s0.p3src, upserts: T98.upserts };
    bt2TrQuickBig(4187); out.quickBig = { cids: BT.cfg.sel.cids.slice(), big: BT.cfg.big, open: !!BT.tree.open['b:4187'] && !!BT.tree.open['s:4661'] };
    btOpen(s0.id); out.open = { sel: JSON.stringify(BT.cfg.sel.cids) === JSON.stringify(s0.sel.cids), big: BT.cfg.big, draft: BT.draft && BT.draft.id === s0.id };
    /* 옛(트리 전) 시험지: sel 없이 소단원 이름만 → 그 소단원의 개념 전부 */
    BT.saved.unshift({ id: 'bt:old1', code: 'AAA111', title: '옛 시험지', course: '공통수학1', big: '다항식', subs: ['항등식과 나머지 정리'], p1: [{ type: 'blank', q: '옛 문항 [[  ]]', a: '가', s: '항등식과 나머지 정리' }], p2: [], p3: [], p3mode: 'tb', at: new Date().toISOString() });
    btOpen('bt:old1'); render(); out.old = { cids: BT.cfg.sel && BT.cfg.sel.cids.slice(), picked: bt2Picked().map((x) => x.s) };
    return out;
  }).catch((e) => ({ ex: String(e) }));
  t('💾 보관 → 보관함 시험지에 sel(개념 목록) · p3src', o5.save && o5.save.sel && o5.save.cids.length === 3 && o5.save.src === 'mix' && o5.save.upserts >= 1, JSON.stringify(o5));
  t('「방정식과 부등식 전부」 → 그 대단원 개념만 · 대단원 바뀜 · 펼침', o5.quickBig && JSON.stringify(o5.quickBig.cids) === '[16208,16211]' && o5.quickBig.big === '방정식과 부등식' && o5.quickBig.open, JSON.stringify(o5.quickBig));
  t('보관함에서 열기 → 고른 트리(sel) 돌아옴', o5.open && o5.open.sel && o5.open.big === '다항식' && o5.open.draft, JSON.stringify(o5.open));
  t('옛 시험지(소단원 이름만) 열기 → 그 소단원 개념 전부로 바꿔 고름', o5.old && o5.old.cids && o5.old.cids.length === 2 && JSON.stringify(o5.old.picked) === '["항등식과 나머지 정리"]', JSON.stringify(o5.old));
  /* 6) 트리 없는 과정(두 번째 페이지) → 안내 + 예전 소단원 칩 그대로 */
  const pg2 = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  pg2.on('pageerror', (e) => errs.push('2: ' + String(e.message)));
  await pg2.route(/^https:\/\//, (r) => r.abort());
  await pg2.goto('file://' + FILE, { waitUntil: 'load' }); await pg2.waitForTimeout(2500);
  await setup(pg2, false);
  const o6 = await pg2.evaluate(async () => {
    render(); bt2Course('공통수학1'); await new Promise((r) => setTimeout(r, 80)); render();
    const h = document.getElementById('tdemo').innerHTML; const out = { on: bt2TrOn(), reads: T98.reads.slice(), msg: /매쓰플랫 단원 트리를 아직 받지 않았습니다 \(새벽 수집 뒤 생깁니다\)/.test(h), chips: /bt2SubTog\(/.test(h), tree: /id="bt2-tree"/.test(h), src: /p3src/.test(h) };
    bt2SubTog('다항식의 연산|항등식과 나머지 정리'); out.picked = bt2Picked().map((x) => x.s + '(' + x.t.length + ')');
    T98.next = { title: '백지테스트', p1: [{ type: 'blank', q: '가 [[  ]]', a: '가', s: '다항식의 사칙연산' }] };
    BT.tb.loading = false; await btGen(); const d = BT.draft;
    out.gen = { p3: d && d.p3.map((x) => x.id), rep: d && d.p3.some((x) => x.rep), head: /소단원과 그 유형/.test(T98.lastPrompt), sel: d && d.sel };
    out.chat = (rBtDraft().match(/bt2ChatQuick\(/g) || []).length;
    const c = T98.calls; await bt2ChatSend('세부유형 대표 문항 2개 더'); out.repMsg = BT.chat.log[BT.chat.log.length - 1].t; out.repAi = T98.calls === c;
    return out;
  });
  t('트리 없음: mf_tree_22 → mf_tree_15 차례로 찾고 없으면 안내 한 줄 + 예전 소단원 칩 · 트리·출처 고르기 없음', !o6.on && JSON.stringify(o6.reads.filter((x) => /^mf_tree/.test(x))) === '["mf_tree_22_공통수학1","mf_tree_15_공통수학1"]' && o6.msg && o6.chips && !o6.tree && !o6.src, JSON.stringify(o6));
  t('트리 없음: 소단원 칩·초안·교과서 3부·예전 지시문 그대로 · 빠른 말 6개', JSON.stringify(o6.picked) === '["다항식의 사칙연산(4)"]' && o6.gen.p3.join() === '1' && !o6.gen.rep && o6.gen.head && !o6.gen.sel && o6.chat === 6, JSON.stringify([o6.picked, o6.gen, o6.chat]));
  t('트리 없음: 「대표 문항」 말 → AI 안 부르고 「트리가 아직 없어」 안내', o6.repAi && /트리가 아직 없어/.test(o6.repMsg), JSON.stringify([o6.repAi, o6.repMsg]));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  await br.close(); process.exit(fail ? 1 : 0);
})();
