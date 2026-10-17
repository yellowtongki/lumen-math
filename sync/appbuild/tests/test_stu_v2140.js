#!/usr/bin/env node
/* 학생앱 v2-140 검사 — 다시 도전: 주관식 5번 · 객관식 1번 (원장 2026-10-17) · 외부망 차단 · 가짜 Supabase
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2140.js student_v2-140.html
 *   SP 폴더에 다시 도전 카드 화면(stu_v2140_retry.png)을 남긴다. */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-140.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 400, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);

  /* ── 준비: 학습지 한 장 · 1차 채점(학생앱) ── */
  const o = await pg.evaluate(async () => {
    const out = { ver: STU_VER };
    window.idle = async () => { await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < 200 && BK.busy; i++) await new Promise((r) => setTimeout(r, 10)); await new Promise((r) => setTimeout(r, 5)); };
    window.C = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
    const store = {}; const ups = [];
    const fakeSb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, is() { return b; }, like() { return b; }, ilike() { return b; }, contains() { return b; }, range() { return b; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, insert() { return Promise.resolve({ data: null, error: null }); }, update() { return b; }, delete() { return b; }, order() { return b; }, limit() { return b; }, single() { return Promise.resolve({ data: null, error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((x) => { if (!x || !x.key) return; ups.push(x.key); const js = JSON.stringify(x.value); store[x.key] = js === undefined ? null : JSON.parse(js); }); return Promise.resolve({ error: null }); },
      then(r, j) { let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; } };
    window.sb = fakeSb; window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중1', group: 'T5' };
    window.go = (id) => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); const el = document.getElementById(id); if (el) el.classList.add('active'); };
    window.confirm = () => true; window.alert = () => {};
    window.__store = store; window.__ups = ups;
    const P = (wpId, num, type, answer, extra) => Object.assign({ wpId, num, type, answer, result: '-', userAnswer: '', shape: 'num', parts: [{ kind: 'num', unit: '', label: '' }], cnt: 1, self: false, gradable: true, concept: '일차방정식의 풀이' }, extra || {});
    const w = { swId: 9101, wid: 7101, title: '테스트 학습지', date: '2026-10-17', status: '학습가능', n: 6, auto: true, problems: [
      P(101, '1', 'SHORT_ANSWER', '3'),
      P(102, '2', 'SINGLE_CHOICE', '2', { optionCount: 5 }),
      P(103, '3', 'SHORT_ANSWER', '12'),
      P(104, '4', 'SHORT_ANSWER', '7'),
      P(105, '5', 'SHORT_ANSWER', '20'),
      P(106, '6', 'SHORT_ANSWER', 'ㄱ, ㄷ', { shape: 'mark', parts: [{ kind: 'mark', unit: '', label: '' }, { kind: 'mark', unit: '', label: '' }] }) ] };
    BK.wsq = { list: [w] }; BK.scores = {}; BK.loaded = true;
    await bkOpenWs(9101);
    const probs = BK.ans['ws_9101'].pages['w9101'].problems;
    const find = (id) => probs.find((p) => String(p.wpId) === String(id));
    out.isChoice = { p101: bkRtIsChoice(find(101)), p102: bkRtIsChoice(find(102)), p106: bkRtIsChoice(find(106)) };
    out.max = { p101: bkRtMax(find(101)), p102: bkRtMax(find(102)) };
    out.consts = [BK_RT_MAX_SUBJ, BK_RT_MAX_OBJ];
    /* 1차 — 1·2·3·5·6번 틀리고 4번 맞힘 */
    await bkGrade('101', '5', { vals: ['5'], sh: bkShape(find(101)) });
    bkPick('102', 4); await idle();
    await bkGrade('103', '1', { vals: ['1'], sh: bkShape(find(103)) });
    await bkGrade('104', '7', { vals: ['7'], sh: bkShape(find(104)) });
    await bkGrade('105', '9', { vals: ['9'], sh: bkShape(find(105)) });
    await bkGrade('106', 'ㄱ,ㄴ', { vals: ['ㄱ', 'ㄴ'], sh: bkShape(find(106)) });
    out.soft106 = !!BK.soft['ws_9101_106'] || !!BK.sample['ws_9101_106'];
    out.first = C(BK.scores);
    out.sync1 = ((store['hw_sync_AAA111'] || {}).items || []).length;
    out.doneCard = bkDoneHtml(BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    bkRtStart(2);
    out.ids = BK.rt.ids.join(',');
    out.askCard101 = bkCardHtml(find(101), 0, BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.askCard102 = bkCardHtml(find(102), 1, BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    /* 주관식 1번 — 자판으로 9 를 넣고 제출(틀림) */
    bkFocus('101', 0); bkKey('9'); bkKey('GO');
    await idle();
    const m = BK.scores['ws_9101_101'];
    out.after1 = { rt: m.rt || null, rtp: m.rtp || null, active: BK.active, fields: BK.fields.slice(),
      fld: ((document.getElementById('bkf-101-0') || {}).textContent || ''),
      card: ((document.getElementById('qc-101') || {}).textContent || '').replace(/\s+/g, ' ') };
    document.getElementById('qc-101').scrollIntoView({ block: 'start' });
    return out;
  });
  await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(SP, 'stu_v2140_retry.png') });
  const shotEl = await pg.$('#qc-101'); if (shotEl) await shotEl.screenshot({ path: path.join(SP, 'stu_v2140_retry_card.png') });

  /* ── 이어서: 고쳐서 다시 내기 · 객관식 · 5번 다 틀리기 · 정답 보기 ── */
  const q = await pg.evaluate(async () => {
    const out = {}; const store = window.__store;
    try {
    const probs = BK.ans['ws_9101'].pages['w9101'].problems;
    const find = (id) => probs.find((p) => String(p.wpId) === String(id));
    /* 1번: 남겨 둔 9 를 지우고 8 (틀림) → 3 (맞음) = 3번 만에 */
    bkFocus('101', 0); out.keptOnFocus = BK.fields[0];
    bkKey('BS'); bkKey('8'); bkKey('GO'); await idle();
    out.left2 = (BK.scores['ws_9101_101'].rtp || {}).tries ? 5 - BK.scores['ws_9101_101'].rtp.tries.length : null;
    out.card2 = ((document.getElementById('qc-101') || {}).textContent || '').replace(/\s+/g, ' ');
    bkFocus('101', 0); bkKey('BS'); bkKey('3'); bkKey('GO'); await idle();
    out.m101 = C(BK.scores['ws_9101_101']);
    out.card101 = ((document.getElementById('qc-101') || {}).textContent || '').replace(/\s+/g, ' ');
    /* 2번 객관식: 한 번 틀리면 끝 */
    bkPick('102', 5); await idle();
    out.m102 = C(BK.scores['ws_9101_102']);
    /* 6번 보기 기호(ㄱ, ㄷ): 고르는 문항이라 한 번 */
    await bkGrade('106', 'ㄱ,ㄹ', { vals: ['ㄱ', 'ㄹ'], sh: bkShape(find(106)) });
    out.m106 = C(BK.scores['ws_9101_106']);
    /* 3번: 다섯 번 다 틀림 */
    out.left3 = [];
    for (const v of ['2', '4', '6', '8', '10']) {
      await bkGrade('103', v, { vals: [v], sh: bkShape(find(103)) });
      const mm = BK.scores['ws_9101_103'];
      out.left3.push(mm.rtp ? 5 - mm.rtp.tries.length : 'done');
    }
    out.m103 = C(BK.scores['ws_9101_103']);
    out.card103 = ((document.getElementById('qc-103') || {}).textContent || '').replace(/\s+/g, ' ');
    /* 5번: 한 번 틀린 뒤 「정답 보기」 */
    await bkGrade('105', '11', { vals: ['11'], sh: bkShape(find(105)) });
    out.give105btn = !!document.querySelector('#qc-105 .bk-rtgive');
    await bkRtGiveUp('105');
    out.m105 = C(BK.scores['ws_9101_105']);
    out.card105 = ((document.getElementById('qc-105') || {}).textContent || '').replace(/\s+/g, ' ');
    /* 2차 마무리 */
    out.body = (document.getElementById('bkq-body').textContent || '').replace(/\s+/g, ' ');
    out.sc = bkRtScores(BK.page, probs);
    out.syncAfter = ((store['hw_sync_AAA111'] || {}).items || []).length;
    out.savedHas = !!(store['hw_scores_AAA111'] && store['hw_scores_AAA111'].items['ws_9101_101'].rt);
    out.savedRtp = !!(store['hw_scores_AAA111'] && store['hw_scores_AAA111'].items['ws_9101_101'].rtp);
    /* 3차 — 3번의 2차 기록을 4일 전으로 돌리고 3차에서 한 번 틀린 뒤 맞힘 */
    const m3 = BK.scores['ws_9101_103']; m3.rt[0].at = new Date(Date.now() - 4 * 86400000).toISOString();
    BK.scores['ws_9101_102'].rt[0].at = new Date(Date.now() - 4 * 86400000).toISOString();
    bkRtEnd(); bkRtStart(3);
    out.ids3 = BK.rt.ids.join(',');
    await bkGrade('103', '13', { vals: ['13'], sh: bkShape(find(103)) });
    out.r3mid = { rtLen: BK.scores['ws_9101_103'].rt.length, rtp: C(BK.scores['ws_9101_103'].rtp || null) };
    await bkGrade('103', '12', { vals: ['12'], sh: bkShape(find(103)) });
    out.m103b = C(BK.scores['ws_9101_103']);
    bkPick('102', 3); await idle();
    out.m102b = C(BK.scores['ws_9101_102']);
    out.syncEnd = ((store['hw_sync_AAA111'] || {}).items || []).length;
    out.final = C(BK.scores);
    } catch (e) { out.err = String(e && e.stack || e); out.final = C(BK.scores); }
    return out;
  });

  if (q.err) console.log('⚠️ 검사 도중 오류: ' + q.err);
  const f = o.first;
  console.log('1차 기록 키: ' + Object.keys(f).join(',') + ' · 6번 자기채점 넘어감? ' + o.soft106);
  console.log(JSON.stringify({ isChoice: o.isChoice, ids: o.ids, after1: o.after1, m101: q.m101, m103: q.m103, m105: q.m105, left3: q.left3 }, null, 1).slice(0, 2500));
  t('버전 v2-140', o.ver === 'v2-140', o.ver);
  t('상수 BK_RT_MAX_SUBJ=5 · BK_RT_MAX_OBJ=1', o.consts[0] === 5 && o.consts[1] === 1, o.consts.join(','));
  t('객관식 판단: 단답=주관식 · SINGLE_CHOICE=객관식 · 보기 기호=객관식', o.isChoice.p101 === false && o.isChoice.p102 === true && o.isChoice.p106 === true && o.max.p101 === 5 && o.max.p102 === 1, JSON.stringify(o.isChoice));
  t('1차 채점 → 매쓰플랫 대기열 6건', o.sync1 === 6, o.sync1);
  t('1차 마무리 카드에 「5번까지」 안내', /5번까지/.test(o.doneCard), o.doneCard.slice(0, 300));
  t('2차 대상 = 1·2·3·5·6번', o.ids === '101,102,103,105,106', o.ids);
  t('주관식 카드 처음: 「기회 5번」', /기회 5번/.test(o.askCard101), o.askCard101.slice(0, 200));
  t('객관식 카드 처음: 「한 번만」', /한 번\s*만/.test(o.askCard102), o.askCard102.slice(0, 200));
  t('주관식 1번째 틀림 → rt 없음 · rtp 1건', !o.after1.rt || o.after1.rt.length === 0, JSON.stringify(o.after1.rt));
  t('주관식 1번째 틀림 → 「다시 생각해 보세요 · 남은 기회 4번」', /다시 생각해 보세요/.test(o.after1.card) && /남은 기회 4번/.test(o.after1.card), o.after1.card.slice(0, 300));
  t('개념 힌트는 그대로', /일차방정식의 풀이/.test(o.after1.card));
  t('쓴 답이 칸에 남음 (9)', o.after1.active === '101' && o.after1.fields[0] === '9' && /9/.test(o.after1.fld), JSON.stringify([o.after1.active, o.after1.fields, o.after1.fld]));
  t('칸을 누르면 남긴 답 9 에서 이어 고침', q.keptOnFocus === '9', q.keptOnFocus);
  t('2번째 틀림 → 남은 기회 3번', q.left2 === 3 && /남은 기회 3번/.test(q.card2), q.left2 + ' / ' + q.card2.slice(0, 160));
  const e1 = (q.m101.rt || [])[0] || {};
  t('3번째에 맞힘 → rt[0] {n:2, r:O, a:3, k:3, tries 2개} · rtp 지움', q.m101.rt.length === 1 && e1.n === 2 && e1.r === 'O' && e1.a === '3' && e1.k === 3 && e1.tries.length === 2 && e1.tries[0].a === '9' && e1.tries[1].a === '8' && e1.tries[0].r === 'X' && !q.m101.rtp, JSON.stringify(q.m101));
  t('카드: 「3번 만에 맞혔어요」', /3번 만에 맞혔어요/.test(q.card101), q.card101.slice(0, 200));
  t('객관식은 한 번 틀리면 끝 (k:1, tries 0)', q.m102.rt.length === 1 && q.m102.rt[0].r === 'X' && q.m102.rt[0].k === 1 && q.m102.rt[0].tries.length === 0 && !q.m102.rtp, JSON.stringify(q.m102.rt));
  t('보기 기호 문항도 한 번이면 끝', q.m106 && q.m106.rt && q.m106.rt.length === 1 && q.m106.rt[0].k === 1, JSON.stringify(q.m106.rt));
  t('주관식 5번 다 틀림: 남은 기회 4·3·2·1 → 끝', q.left3.join(',') === '4,3,2,1,done', q.left3.join(','));
  const e3 = (q.m103.rt || [])[0] || {};
  t('5번째 틀림 → rt[0] {n:2, r:X, a:10, k:5, tries 4개}', q.m103.rt.length === 1 && e3.r === 'X' && e3.a === '10' && e3.k === 5 && e3.tries.length === 4 && !q.m103.rtp, JSON.stringify(e3));
  t('5번 다 쓴 문항 정답은 아직 가림', /다 써 봤어요/.test(q.card103) && /다시 도전/.test(q.card103) && !/정답\s*12/.test(q.card103), q.card103.slice(0, 250));
  t('「정답 보기」 단추가 틀린 뒤에 보임', q.give105btn === true);
  const e5 = (q.m105.rt || [])[0] || {};
  t('「정답 보기」 → rt {r:X, k:1, give} · seen · 그 문항 정답 열림', e5.r === 'X' && e5.k === 1 && e5.give === true && e5.tries.length === 0 && !!q.m105.seen && /20/.test(q.card105), JSON.stringify(q.m105) + ' / ' + q.card105.slice(0, 200));
  t('2차 마무리: 「1번 · 3번 만에」 칩 · +1 XP (한 번만)', /1번 · 3번 만에/.test(q.body) && /\+1 XP/.test(q.body) && /다시 맞힌 1문항|맞힌 1문항/.test(q.body), q.body.slice(-500));
  t('2차 점수: 1차 1/6 → 2차 2/6', q.sc.n1 === 1 && q.sc.n2 === 2, JSON.stringify(q.sc));
  t('다시 도전은 매쓰플랫 대기열(hw_sync)에 안 들어감', q.syncAfter === 6 && q.syncEnd === 6, q.syncAfter + ' / ' + q.syncEnd);
  t('기록(hw_scores)은 저장됨 · 끝난 문항에 rtp 없음', q.savedHas && !q.savedRtp);
  t('3차 대상 = 2·3번 (기한 지남)', q.ids3 === '102,103', q.ids3);
  t('3차 주관식 틀림 → rt 그대로 1칸 · rtp n:3', q.r3mid.rtLen === 1 && q.r3mid.rtp && q.r3mid.rtp.n === 3 && q.r3mid.rtp.tries.length === 1, JSON.stringify(q.r3mid));
  const e33 = (q.m103b.rt || [])[1] || {};
  t('3차 2번 만에 맞힘 → rt[1] {n:3, r:O, k:2}', q.m103b.rt.length === 2 && e33.n === 3 && e33.r === 'O' && e33.k === 2 && e33.tries.length === 1, JSON.stringify(q.m103b.rt));
  t('3차 객관식은 한 번 (k:1)', q.m102b.rt.length === 2 && q.m102b.rt[1].n === 3 && q.m102b.rt[1].k === 1, JSON.stringify(q.m102b.rt));
  let same = true, diff = '';
  Object.keys(f).forEach((k) => { const a = f[k], b = q.final[k]; if (!b || a.r !== b.r || a.a !== b.a || a.at !== b.at) { same = false; diff = k; } });
  t('1차 기록(r·a·at) 그대로', same, diff);
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log('\n스크린샷: ' + path.join(SP, 'stu_v2140_retry.png') + ' · ' + path.join(SP, 'stu_v2140_retry_card.png'));
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
