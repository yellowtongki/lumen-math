#!/usr/bin/env node
/* 학원앱 v19-97 검사 — 📝 백지테스트 «💬 채팅으로 고치기» (가짜 유형DB · 가짜 교과서 은행 · 가짜 AI · 외부망 차단)
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v1997.js lumen_v19-97.html
 *   그림: $SP/v1997_chat.png (편집 칸 맨 아래 대화 상자 + 미리보기) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-97.html');
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
    /* 가짜 자료 (test_v1994 와 같음) */
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
    window.getSortedStudents = () => [{ id: 'S1', name: '○○○', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '△△△', grade: '중학교 3학년', group: 'T630', lumen_rec_code: 'BBB222' }, { id: 'S3', name: '□□□', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'CCC333' }];
    let upserts = 0;
    window.getSupaClient = () => ({ from: () => ({ upsert: () => { upserts++; return Promise.resolve({}); } }) });
    window.HWC = { loaded: true, stuck: {} }; window.ahaNotes = []; window.HWB = { loaded: true, swb: {} };
    window.tqSummary = () => ({ weak: [{ cid: 502, name: '나머지 정리', unit: '다항식의 연산', cur: 40, n: 5 }], newweak: [], worse: [] });
    /* 가짜 AI — 다음 답(nextReply)을 그대로 돌려준다 */
    let calls = 0, lastPrompt = '', nextReply = null;
    window.callAI = async (p) => { calls++; lastPrompt = p; return typeof nextReply === 'string' ? nextReply : JSON.stringify(nextReply); };
    const it = (q, a, s, type) => ({ type: type || 'blank', q, a, s: s || '다항식의 사칙연산' });
    /* 화면 */
    BT.loaded = true; BT.saved = []; BT.stu = 'AAA111'; BT.cfg.p1 = 5; BT.cfg.p2 = 0; BT.cfg.p3 = 2; BT.cfg.p3mode = 'tb'; BT.cfg.course = ''; BT.cfg.subs = [];
    window.render = () => {}; window.btPainting = () => false;
    rBtMake(); bt2Course('공통수학1'); rBtMake();
    BT.tb.loading = false; await bt2TbLoad('AAA111');
    const last = () => BT.chat.log[BT.chat.log.length - 1];
    try {
      BT.chat.log = [{ r: 'me', t: '옛 대화' }];
      nextReply = { title: '백지테스트 — 공통수학1 · 다항식', p1: [it('첫 문항 [[  ]]', '가'), it('둘째 문항 [[  ]]', '나'), it('셋째 문항', '다', '항등식과 나머지 정리', 'write'), it('넷째 문항 [[  ]]', '라'), it('다섯째 문항', '마', '항등식과 나머지 정리', 'write')] };
      await btGen();
      const d = BT.draft;
      out.gen = { p1: d.p1.length, p3: d.p3.map((x) => x.id), logReset: BT.chat.log.length === 0 };
      /* 화면: 대화 상자가 편집 칸 안 · 미리보기 앞 */
      const ed = rBtDraft(); const iEd = ed.indexOf('id="bt2-ed"'), iCh = ed.indexOf('id="bt2-chat"'), iPv = ed.indexOf('id="bt2-pv"'), iNote = ed.indexOf('아래에 붙일 한마디');
      out.ui = { inEd: iEd >= 0 && iCh > iEd && iCh < iPv && iCh > iNote, input: /id="bt2-chat-in"/.test(ed), send: /bt2ChatSend\(\)/.test(ed), chips: (ed.match(/bt2ChatQuick\(/g) || []).length, title: /AI 에게 말로 고치기/.test(ed) };
      /* (a) 추가 */
      nextReply = { reply: '곱셈공식 변형 문항 2개를 넣었습니다', add: [it('a²+b² = (a+b)² − [[  ]]', '2ab', '다항식의 사칙연산'), it('a³+b³ 를 구하는 과정을 쓰시오.', '(a+b)³−3ab(a+b)', '다항식의 사칙연산', 'write')] };
      await bt2ChatSend('곱셈공식 변형 2문제 더');
      out.a = { n: d.p1.length, log: BT.chat.log.map((x) => x.r).join(','), undo: !!last().undo, fresh: BT.chat.fresh && Object.keys(BT.chat.fresh.p1).join(','),
        prompt: /\[원장님 지시\] 곱셈공식 변형 2문제 더/.test(lastPrompt) && /\[이 대단원 전체의 소단원·유형/.test(lastPrompt) && /다항식의 인수분해 — 유형: 인수분해 공식/.test(lastPrompt) && !/복소수의 뜻과 성질/.test(lastPrompt) && /\[지금 시험지 — 1부\]\n1\. \(blank\) \[다항식의 사칙연산\] 첫 문항/.test(lastPrompt) && /비상교육 교과서 12쪽 3번/.test(lastPrompt) };
      /* (b) 바꾸기 */
      nextReply = { reply: '3번을 바꿨습니다', replace: [{ n: 3, type: 'write', q: '새 문항', a: '답', s: '항등식과 나머지 정리' }] };
      await bt2ChatSend('3번 더 쉽게'); out.b = { q: d.p1[2].q, type: d.p1[2].type, n: d.p1.length };
      /* (c) 삭제 */
      nextReply = { reply: '1번을 뺐습니다', remove: [1, 1, 99] };
      await bt2ChatSend('1번 삭제'); out.c = { n: d.p1.length, first: d.p1[0].q };
      /* (d) 취소 → 되돌리기 */
      const calls0 = calls;
      await bt2ChatSend('방금 거 취소'); out.d = { n: BT.draft.p1.length, first: BT.draft.p1[0].q, reply: last().t, ai: calls === calls0 };
      /* (e) 교과서 — AI 없이 */
      const calls1 = calls; const p3a = BT.draft.p3.map((x) => x.id);
      await bt2ChatSend('교과서에서 다항식의 사칙연산 2개 더');
      const p3b = BT.draft.p3.map((x) => x.id);
      out.e = { ai: calls === calls1, before: p3a, after: p3b, reply: last().t, undo: !!last().undo, bankIds: p3b.every((id) => [1, 2, 3, 4, 5].indexOf(id) >= 0), dup: new Set(p3b).size === p3b.length };
      /* (e2) 교과서 n번 바꾸기 · 같은 유형 */
      await bt2ChatSend('교과서 1번 다른 걸로'); out.e2 = { p3: BT.draft.p3.map((x) => x.id), reply: last().t, ai: calls === calls1 };
      /* (f) 없는 낱말 */
      const undoN = BT.chat.undo.length; const p3c = JSON.stringify(BT.draft.p3.map((x) => x.id));
      await bt2ChatSend('교과서에서 삼각함수 2개 더'); out.f = { reply: last().t, same: JSON.stringify(BT.draft.p3.map((x) => x.id)) === p3c, undo: BT.chat.undo.length === undoN, ai: calls === calls1 };
      /* (g) 순서 */
      const q0 = BT.draft.p1[0].q, q1 = BT.draft.p1[1].q;
      nextReply = { reply: '1·2번 순서를 바꿨습니다', order: [2, 1, 3, 4, 5, 6, 7] };
      await bt2ChatSend('1번과 2번 순서 바꿔줘'); out.g = { swapped: BT.draft.p1[0].q === q1 && BT.draft.p1[1].q === q0, n: BT.draft.p1.length };
      /* (h) 잘못된 순서 → 무시 */
      const snapN = BT.chat.undo.length; const before = JSON.stringify(BT.draft.p1);
      nextReply = { reply: '순서를 바꿨습니다', order: [1, 1, 2, 3, 4, 5, 6] };
      await bt2ChatSend('순서 섞어줘'); out.h = { same: JSON.stringify(BT.draft.p1) === before, reply: last().t, undo: BT.chat.undo.length === snapN };
      /* 힌트 */
      nextReply = { reply: '힌트를 붙였습니다', hint: true, hints: [{ n: 1, h: '정의를 떠올리기' }, { n: 2, h: '전개해 보기' }] };
      await bt2ChatSend('답지에 힌트 한 줄씩'); out.hint = { a0: BT.draft.p1[0].a, a1: BT.draft.p1[1].a, a2: BT.draft.p1[2].a };
      /* AI 오류 → 그대로 */
      const snapE = BT.chat.undo.length; const beforeE = JSON.stringify(BT.draft.p1);
      nextReply = '죄송합니다 못 했어요';
      await bt2ChatSend('아무거나'); out.err = { reply: last().t, same: JSON.stringify(BT.draft.p1) === beforeE, undo: BT.chat.undo.length === snapE, busy: BT.chat.busy };
      /* 앞 말풍선의 「↩ 되돌리기」 → 그 뒤 고침까지 */
      const idxOrder = BT.chat.log.findIndex((x) => x.r === 'ai' && x.undo && /순서를 바꿨습니다/.test(x.t));
      bt2ChatUndo(idxOrder); out.undoIdx = { first: BT.draft.p1[0].q === q0, hintGone: !/힌트/.test(BT.draft.p1[0].a), reply: last().t, undoLeft: BT.chat.undo.length };
      /* 제목·추가 20 상한 */
      nextReply = { reply: '제목을 바꾸고 많이 넣었습니다', title: '다항식 개념 점검', add: Array.from({ length: 30 }, (_, i) => it('추가 ' + i, 'x')) };
      await bt2ChatSend('제목 바꾸고 20개 넣어줘'); out.cap = { n: BT.draft.p1.length, title: BT.draft.title };
      /* (i) 보관 — 대화도 함께 */
      window.btSave(); await new Promise((r) => setTimeout(r, 30));
      out.save = { chat: Array.isArray(BT.saved[0] && BT.saved[0].chat), n: BT.saved[0] && BT.saved[0].chat.length, keys: BT.saved[0] && BT.saved[0].chat[0] && Object.keys(BT.saved[0].chat[0]).join(','), upserts };
      /* 다른 학생 → 대화 새로 · 보관함에서 열기 → 대화 돌아옴 */
      const sid = BT.saved[0].id;
      btPick('BBB222'); out.pick = { log: BT.chat.log.length, undo: BT.chat.undo.length, draft: BT.draft };
      btOpen(sid); out.open = { log: BT.chat.log.length, draft: !!BT.draft && BT.draft.id === sid, undo: BT.chat.undo.length };
      /* 그림용: 하나 더 넣어 노란 표시 */
      nextReply = { reply: '1번을 다시 쓰고 곱셈공식 변형 1문항을 넣었습니다', replace: [{ n: 1, type: 'blank', q: '(a−b)² = a² − [[  ]] + b²', a: '2ab', s: '다항식의 사칙연산' }], add: [it('x + 1/x = t 일 때 x² + 1/x² = [[  ]]', 't²−2')] };
      BT.draft.p1 = BT.draft.p1.slice(0, 7);
      await bt2ChatSend('1번 바꾸고 곱셈공식 변형 하나 더'); out.last = { fresh: BT.chat.fresh && Object.keys(BT.chat.fresh.p1).join(',') };
    } catch (e) { out.ex = String(e && e.stack || e); }
    /* 화면 그림 */
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1240px;padding:12px;background:#eef2f8;font-family:sans-serif'; box.innerHTML = rBtDraft(); document.body.appendChild(box);
    bt2ChatAfterRender();
    out.dom = { freshRows: document.querySelectorAll('#bt2-ed .bt2-fresh').length, chat: !!document.querySelector('#bt2-ed #bt2-chat'), logScroll: (() => { const l = document.getElementById('bt2-chat-log'); return l ? l.scrollTop + l.clientHeight >= l.scrollHeight - 2 : false; })() };
    return out;
  });
  console.log(JSON.stringify(o, null, 1).slice(0, 5000));
  t('버전 v19-97', o.ver === 'v19-97', o.ver);
  t('초안: 1부 5문항 · 3부 2문항 · 대화 새로', o.gen && o.gen.p1 === 5 && o.gen.p3.length === 2 && o.gen.logReset, JSON.stringify(o.gen));
  t('대화 상자: 편집 칸 안 · 한마디 밑 · 미리보기 앞 · 입력칸 · 보내기 · 빠른 말 6개', o.ui && o.ui.inEd && o.ui.input && o.ui.send && o.ui.chips === 6 && o.ui.title, JSON.stringify(o.ui));
  t('(a) 「곱셈공식 변형 2문제 더」 → 7문항 · 말풍선 나·AI · 되돌리기 · 노란 표시 6,7번', o.a && o.a.n === 7 && o.a.log === 'me,ai' && o.a.undo && o.a.fresh === '5,6', JSON.stringify(o.a));
  t('(a) AI 지시: [원장님 지시] · 대단원 전체 유형(고르지 않은 소단원 포함 · 다른 대단원 없음) · 지금 시험지 번호', o.a && o.a.prompt === true);
  t('(b) 3번 바꾸기 → 「새 문항」 서술', o.b && o.b.q === '새 문항' && o.b.type === 'write' && o.b.n === 7, JSON.stringify(o.b));
  t('(c) 1번 삭제(겹친 번호·없는 번호 무시) → 6문항 · 첫 문항 바뀜', o.c && o.c.n === 6 && o.c.first === '둘째 문항 [[  ]]', JSON.stringify(o.c));
  t('(d) 「취소」 → 7문항 · 첫 문항 돌아옴 · AI 안 부름', o.d && o.d.n === 7 && o.d.first === '첫 문항 [[  ]]' && /되돌렸습니다/.test(o.d.reply) && o.d.ai, JSON.stringify(o.d));
  t('(e) 「교과서에서 다항식의 사칙연산 2개 더」 → AI 안 부름 · 3부 +2 · 은행 문항 · 사칙연산 쪽 먼저 · 겹침 없음', o.e && o.e.ai && o.e.after.length === o.e.before.length + 2 && o.e.bankIds && o.e.dup && o.e.undo && o.e.after[o.e.before.length] === 2 && /AI 없이/.test(o.e.reply), JSON.stringify(o.e));
  t('(e2) 「교과서 1번 다른 걸로」 → 3부 1번만 바뀜 · AI 안 부름', o.e2 && o.e2.ai && o.e2.p3.length === o.e.after.length && o.e2.p3[0] !== o.e.after[0] && o.e2.p3.slice(1).join() === o.e.after.slice(1).join(), JSON.stringify(o.e2));
  t('(f) 없는 낱말 → 「찾지 못했습니다」 · 3부 그대로 · 되돌리기 칸 그대로', o.f && /찾지 못했습니다/.test(o.f.reply) && o.f.same && o.f.undo && o.f.ai, JSON.stringify(o.f));
  t('(g) 순서 [2,1,…] → 1·2번 바뀜', o.g && o.g.swapped && o.g.n === 7, JSON.stringify(o.g));
  t('(h) 잘못된 순서 → 무시 · 「바뀐 것은 없습니다」 · 되돌리기 칸 그대로', o.h && o.h.same && /바뀐 것은 없습니다/.test(o.h.reply) && o.h.undo, JSON.stringify(o.h));
  t('힌트: 1·2번 모범답에 「· 힌트:」 · 3번 그대로', o.hint && /· 힌트: 정의를 떠올리기$/.test(o.hint.a0) && /· 힌트: 전개해 보기$/.test(o.hint.a1) && !/힌트/.test(o.hint.a2), JSON.stringify(o.hint));
  t('AI 오류 → 「고치지 못했습니다」 · 시험지 그대로 · 바쁨 풀림', o.err && /^고치지 못했습니다/.test(o.err.reply) && o.err.same && o.err.undo && o.err.busy === false, JSON.stringify(o.err));
  t('앞 말풍선 「↩ 되돌리기」 → 그 뒤 고침(힌트)까지 함께', o.undoIdx && o.undoIdx.first && o.undoIdx.hintGone && /함께/.test(o.undoIdx.reply), JSON.stringify(o.undoIdx));
  t('제목 바꾸기 · 1부 20문항 상한', o.cap && o.cap.n === 20 && o.cap.title === '다항식 개념 점검', JSON.stringify(o.cap));
  t('(i) 💾 보관 → 보관함 시험지에 대화 기록(chat: r·t, 20줄 이하)', o.save && o.save.chat && o.save.n > 0 && o.save.n <= 20 && o.save.keys === 'r,t' && o.save.upserts === 1, JSON.stringify(o.save));
  t('다른 학생 고르면 대화·되돌리기 칸 비움 · 보관함에서 열면 대화가 돌아옴', o.pick && o.pick.log === 0 && o.pick.undo === 0 && o.pick.draft === null && o.open && o.open.draft && o.open.log === o.save.n && o.open.undo === 0, JSON.stringify([o.pick, o.open]));
  t('새 문항 노란 표시: 1번(바꿈)·8번(추가) → 편집 칸 2줄', o.last && o.last.fresh === '0,7' && o.dom.freshRows === 2 && o.dom.chat && o.dom.logScroll, JSON.stringify([o.last, o.dom]));
  t('예외 없음', !o.ex, o.ex);
  t('(j) 페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  /* 편집 칸 아래쪽(대화 상자)이 보이게 — 왼쪽 칸 맨 아래 + 오른쪽 미리보기 일부 */
  const r = await pg.evaluate(() => { const a = document.querySelector('#tdemo #bt2-chat').getBoundingClientRect(), b = document.getElementById('tdemo').getBoundingClientRect(); return { x: b.left + scrollX, w: b.width, top: b.top + scrollY, bot: a.bottom + scrollY }; });
  const y = Math.max(r.top, r.bot - 880);
  await pg.screenshot({ path: SP + '/v1997_chat.png', fullPage: true, clip: { x: r.x, y, width: r.w, height: r.bot + 14 - y } });
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
