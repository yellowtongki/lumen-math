#!/usr/bin/env node
/* 학원앱 v19-94 검사 — 📝 백지테스트 2판 (가짜 유형DB · 가짜 교과서 은행 · 가짜 AI · 외부망 차단)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v1994.js lumen_v19-94.html
 *   그림: $SP/v1994_bt.png (편집 + 미리보기) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-94.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const o = await pg.evaluate(async () => {
    const out = { ver: APP_VER };
    /* 가짜 자료 */
    window.MF_TYPEDB = { grades: [
      { g: '중3-2', grp: '중등', b: [{ n: '삼각비', m: [{ n: '삼각비', s: [{ n: '삼각비의 뜻', t: ['삼각비의 값'] }] }] }] },
      { g: '공통수학1', grp: '고등', b: [
        { n: '다항식', m: [{ n: '다항식의 연산', s: [{ n: '다항식의 사칙연산', t: ['다항식의 덧셈과 뺄셈', '다항식의 곱셈', '다항식의 나눗셈', '조립제법'] }, { n: '항등식과 나머지 정리', t: ['항등식', '미정계수법', '나머지 정리', '인수 정리'] }] }, { n: '인수분해', s: [{ n: '다항식의 인수분해', t: ['인수분해 공식', '치환', '인수 정리를 이용한 인수분해'] }] }] },
        { n: '방정식과 부등식', m: [{ n: '복소수', s: [{ n: '복소수의 뜻과 성질', t: ['복소수'] }] }] } ] } ] };
    window.MF_TYPEDB_LOADING = false;
    window.MF_TYPE_ACH = { names: { 501: { n: '다항식의 곱셈' }, 502: { n: '나머지 정리' }, 503: { n: '인수분해 공식' }, 504: { n: '삼각비의 값' } } };
    window.EA = window.EA || {}; EA.tbMap = { books: { '3119965': { type: 'SCHOOL', grade: '공통수학1', title: '교과서_비상교육', fulltitle: '교과서_비상교육 - 공통수학1' }, '2312251': { type: 'SCHOOL', grade: '3', title: '교과서_미래엔', fulltitle: '교과서_미래엔 - 중등수학3' } }, byStudent: {}, bySchoolGrade: {} };
    const pimg = (id) => 'https://x/problem/' + id + '/a/problem.png';
    EA.tb = { '3119965': { title: '교과서_비상교육 - 공통수학1', pages: [{ page: 12, title: '다항식의 사칙연산' }, { page: 24, title: '항등식과 나머지 정리' }, { page: 34, title: '다항식의 인수분해' }], problems: [
      { id: 1, page: 12, no: '3', cid: 501, level: 2, pimg: pimg(70001), answer: '2x+1', type: 'SHORT_ANSWER' }, { id: 2, page: 13, no: '7', cid: 501, level: 3, pimg: pimg(70002), answer: 'x^2', type: 'SHORT_ANSWER' },
      { id: 3, page: 24, no: '2', cid: 502, level: 2, pimg: pimg(70003), answer: '5', type: 'SHORT_ANSWER', aimg: pimg(70013).replace('problem.png', 'answer.png') }, { id: 4, page: 25, no: '6', cid: 502, level: 3, pimg: pimg(70004), answer: '-3', type: 'SHORT_ANSWER', aimg: pimg(70014).replace('problem.png', 'answer.png') },
      { id: 5, page: 34, no: '1', cid: 503, level: 1, pimg: pimg(70005), answer: '(x+1)(x+2)', type: 'SHORT_ANSWER' }, { id: 6, page: 12, no: '탐구 1', cid: 501, level: 2, pimg: pimg(70006), answer: '', type: 'ESSAY' } ] } };
    window.eaTbLoad = () => Promise.resolve(); window.eaTbBank = (bid) => Promise.resolve(EA.tb[bid] || null);
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'AAA111' }];
    window.getSupaClient = () => null; window.HWC = { loaded: true, stuck: {} }; window.ahaNotes = []; window.HWB = { loaded: true, swb: {} };
    window.tqSummary = () => ({ weak: [{ cid: 502, name: '나머지 정리', unit: '다항식의 연산', cur: 40, n: 5 }], newweak: [], worse: [] });
    window.MF_TYPE_ACH = Object.assign(window.MF_TYPE_ACH, {});
    let aiCalls = [];
    window.callAI = async (p) => { aiCalls.push(p);
      if (/\[바꿀 문항\]/.test(p)) return '{"type":"blank","q":"조립제법은 나누는 식이 [[  ]] 꼴일 때 쓸 수 있다.","a":"x−α","s":"다항식의 사칙연산"}';
      if (/\[이미 있는 문항 — 겹치지 않게\]/.test(p)) return '{"p1":[{"type":"write","q":"미정계수법 두 가지를 설명하시오.","a":"계수비교법·수치대입법","s":"항등식과 나머지 정리"},{"type":"blank","q":"f(α)=0 이면 f(x)는 [[  ]]를 인수로 가진다.","a":"x−α","s":"항등식과 나머지 정리"}]}';
      return '{"title":"백지테스트 — 공통수학1 · 다항식","p1":[{"type":"blank","q":"다항식의 덧셈은 [[  ]]끼리 모아 계산한다.","a":"동류항","s":"다항식의 사칙연산"},{"type":"write","q":"나머지 정리를 설명하시오.","a":"f(x)를 x−α로 나눈 나머지는 f(α)","s":"항등식과 나머지 정리"},{"type":"blank","q":"A=BQ+R 에서 R의 차수는 [[  ]]의 차수보다 낮다.","a":"B","s":"다항식의 사칙연산"}]}'; };
    /* 화면 */
    BT.loaded = true; BT.saved = []; BT.stu = 'AAA111'; BT.cfg.p1 = 3; BT.cfg.p2 = 0; BT.cfg.p3 = 2; BT.cfg.p3mode = 'tb'; BT.cfg.course = ''; BT.cfg.subs = [];
    window.render = () => {}; window.btPainting = () => false;
    let h = rBtMake();
    out.defaultCourse = BT.cfg.course; out.courses = bt2Courses(btStuByCode('AAA111'));
    bt2Course('공통수학1'); h = rBtMake();
    out.after = { course: BT.cfg.course, big: BT.cfg.big, subs: BT.cfg.subs.slice() };
    bt2SubTog('다항식의 연산|항등식과 나머지 정리'); out.picked = bt2Picked().map((x) => x.s + '(' + x.t.length + ')');
    bt2SubTog('다항식의 연산|항등식과 나머지 정리');   // 다시 켠다 → 두 소단원
    out.chips = (h.match(/공통수학1|대단원|소단원/g) || []).length;
    BT.tb.loading = false; await bt2TbLoad('AAA111'); out.tb = { bid: BT.tb.bid, title: BT.tb.title, n: BT.tb.bank && BT.tb.bank.problems.length };
    try {
    await btGen();
    const d = BT.draft; out.draft = d && { title: d.title, course: d.course, big: d.big, subs: d.subs, p1: d.p1.map((x) => x.s), p3: d.p3.map((x) => x.id + ':' + x.s), tb: d.tb };
    out.prompt = { hasSubs: /\[이번 시험 범위 — 소단원과 그 유형\]/.test(aiCalls[0]) && /항등식과 나머지 정리 — 유형: 항등식/.test(aiCalls[0]) && /다항식의 사칙연산 — 유형/.test(aiCalls[0]), hasCourse: /\[과정\] 공통수학1/.test(aiCalls[0]) };
    const ed = rBtDraft(); out.ed = { hasPv: /id="bt2-pv"/.test(ed), hasRe: (ed.match(/bt2Re\(/g) || []).length, hasMore: /bt2More\(2\)/.test(ed), hasTbRe: (ed.match(/bt2TbRe\(/g) || []).length };
    const sheet = bt2SheetHtml(d, false).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.sheet = { hasRange: /범위 · 공통수학1 › 다항식 › 다항식의 사칙연산 · 항등식과 나머지 정리/.test(sheet), p1: /1부\. 개념 백지/.test(sheet), p3: /3부\. 교과서 문항/.test(sheet) && /비상교육 교과서 12쪽 3번/.test(sheet), blank: /class="bl"/.test(bt2SheetHtml(d, false)) };
    await bt2Re(0); out.re = d.p1[0].q;
    await bt2More(2); out.more = d.p1.length;
    bt2Move('p1', 4, -1); out.moved = d.p1[3].s;
    btDel('p1', 0); out.afterDel = d.p1.length;
    bt2TbRe(0); out.tbRe = d.p3[0].id; bt2TbMore(); out.tbMore = d.p3.length;
    const key = bt2KeyHtml(d).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.key = { title: /채점용 답지/.test(key), p1: /1부\. 개념 백지 모범답/.test(key) && /계수비교법·수치대입법/.test(key), p3: /3부\. 교과서 정답/.test(key) && /2x\+1|x\^2|-3|5/.test(key), aimg: /answer\.png/.test(bt2KeyHtml(d)) };
    let opened = []; window.open = () => ({ document: { open() {}, write(s) { opened.push(s); }, close() {} } });
    btPrint(); btAnswers(); bt2PrintBoth(); out.prints = opened.map((s) => s.length + ':' + (/채점용 답지/.test(s) ? 'key' : 'sheet') + (s.split('class="pg"').length - 1));
    } catch (e) { out.err = String(e && e.stack || e); out.draftNow = BT.draft && { p1: BT.draft.p1.length, p3: (BT.draft.p3 || []).length }; out.pool = bt2Picked().map((x) => x.s + ':' + bt2TbPool(x).length); }
    /* 화면 그림 */
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; box.innerHTML = rBtDraft(); document.body.appendChild(box);
    return out;
  });
  console.log(JSON.stringify(o, null, 1).slice(0, 3500));
  t('버전 v19-94', o.ver === 'v19-94');
  t('과정 칩에 공통수학1 있음 · 중3 기본값 중3-2', o.courses.indexOf('공통수학1') >= 0 && o.defaultCourse === '중3-2', JSON.stringify([o.courses, o.defaultCourse]));
  t('공통수학1 고르면 대단원 다항식 · 첫 중단원 소단원 자동 선택', o.after.course === '공통수학1' && o.after.big === '다항식' && o.after.subs.length === 2, JSON.stringify(o.after));
  t('소단원 끄고 켜기 — 고른 소단원 1개(유형 4)', o.picked.join(',') === '다항식의 사칙연산(4)', JSON.stringify(o.picked));
  t('교과서 은행: 비상교육 공통수학1 6문항', o.tb.bid === '3119965' && o.tb.n === 6, JSON.stringify(o.tb));
  t('AI 지시에 과정·소단원·유형 이름', o.prompt.hasCourse && o.prompt.hasSubs, JSON.stringify(o.prompt));
  t('초안: 1부 3문항(소단원 표시) · 3부 교과서 2문항(탐구 제외)', o.draft && o.draft.p1.length === 3 && o.draft.p1[0] === '다항식의 사칙연산' && o.draft.p3.length === 2 && o.draft.p3.every((x) => !/^6:/.test(x)), JSON.stringify(o.draft));
  t('편집 화면: 미리보기 칸 · 문항별 다시 쓰기 3 · AI 2개 더 · 교과서 다른 문항 2', o.ed.hasPv && o.ed.hasRe === 3 && o.ed.hasMore && o.ed.hasTbRe === 2, JSON.stringify(o.ed));
  t('시험지: 범위 줄 · 1부 · 3부 교과서 12쪽 3번 · 빈칸 밑줄', o.sheet.hasRange && o.sheet.p1 && o.sheet.p3 && o.sheet.blank, JSON.stringify(o.sheet));
  t('🔄 이 문항만 다시 — 1번만 바뀜', /조립제법/.test(o.re), o.re);
  t('+ AI 로 2개 더 → 5문항', o.more === 5);
  t('▲ 순서 바꾸기 · ✕ 삭제', o.moved === '항등식과 나머지 정리' && o.afterDel === 4, JSON.stringify([o.moved, o.afterDel]));
  t('3부: 다른 문항으로 바꾸기 · 1문항 더', o.tbRe !== 1 && o.tbMore === 3, JSON.stringify([o.tbRe, o.tbMore]));
  t('답지: 1부 모범답 · 3부 교과서 정답(글·그림)', o.key.title && o.key.p1 && o.key.p3 && o.key.aimg, JSON.stringify(o.key));
  t('인쇄 창 3번: 시험지 1쪽 · 답지 1쪽 · 둘 다 2쪽', o.prints.length === 3 && /sheet1$/.test(o.prints[0]) && /key1$/.test(o.prints[1]) && /2$/.test(o.prints[2]), o.prints.join(' | '));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  await pg.locator('#tdemo').screenshot({ path: SP + '/v1994_bt.png' });
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
