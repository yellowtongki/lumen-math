#!/usr/bin/env node
/* 학생앱 v2-133 검사 — 매쓰플랫이 채점한 ✗ 학습지 문항의 «다시 도전» (외부망 차단 · 가짜 Supabase)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2133.js student_v2-133.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-133.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  const o = await pg.evaluate(async () => {
    const out = { ver: STU_VER };
    const store = {}; const ups = [];
    const fakeSb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, order() { return b; }, limit() { return b; }, single() { return Promise.resolve({ data: null, error: null }); },
      upsert(row) { ups.push(row.key); store[row.key] = row.value; return Promise.resolve({ error: null }); },
      then(r, j) { let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; } };
    window.sb = fakeSb; window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중1', group: 'T5' };
    window.go = () => {};
    /* 매쓰플랫(선생님)이 채점해 둔 리커버리 학습지: 1·2번 ✗, 3번 ◯ */
    const w = { swId: 9001, wid: 7001, title: '리커버리 10/10 ○○○', date: '2026-10-10', status: '학습완료', n: 3, auto: false, score: 33, problems: [
      { wpId: 101, num: '1', type: 'SHORT_ANSWER', answer: '3', result: 'X', userAnswer: '5', shape: 'num', parts: [{ kind: 'num', unit: '', label: '' }], cnt: 1, self: false, gradable: true },
      { wpId: 102, num: '2', type: 'SINGLE_CHOICE', answer: '2', result: 'X', userAnswer: '', shape: 'num', parts: [{ kind: 'num', unit: '', label: '' }], cnt: 1, self: false, gradable: true, optionCount: 5 },
      { wpId: 103, num: '3', type: 'SHORT_ANSWER', answer: '7', result: 'O', userAnswer: '7', shape: 'num', parts: [{ kind: 'num', unit: '', label: '' }], cnt: 1, self: false, gradable: true } ] };
    BK.wsq = { list: [w] }; BK.scores = {}; BK.loaded = true;
    await bkOpenWs(9001);
    const probs = BK.ans['ws_9001'].pages['w9001'].problems;
    out.seeded = Object.keys(BK.scores).sort();
    out.seedRec = BK.scores['ws_9001_101'];
    const st = bkPageStat(BK.page, probs); out.stat = { done: st.done, tot: st.tot, xn: st.xn };
    out.rt2 = bkRtList(BK.page, probs, 2, Date.now()).map((p) => p.num);
    out.card1 = bkCardHtml(probs[0], 0, BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.card3 = bkCardHtml(probs[2], 2, BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    out.doneCard = bkDoneHtml(BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    /* 다시 도전 2차 — 1번에 정답 3 을 넣는다 */
    bkRtStart(2); out.rtOn = bkRtOn() && BK.rt.round === 2 && BK.rt.ids.join(',');
    await bkGrade('101', '3', { vals: ['3'], sh: bkShape(probs[0]) });
    const m = BK.scores['ws_9001_101'];
    out.after = { r1: m.r, a1: m.a, rt: m.rt };
    out.ups = ups.slice();
    out.rtCard = bkCardHtml(probs[0], 0, BK.page, probs).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    return out;
  });
  console.log(JSON.stringify(o, null, 1).slice(0, 3000));
  t('버전 v2-133', o.ver === 'v2-133');
  t('매쓰플랫 ✗ 두 문항에 1차 기록이 생김 (◯ 는 안 만듦)', o.seeded.join(',') === 'ws_9001_101,ws_9001_102', o.seeded.join(','));
  t('1차 기록 = X · 매쓰플랫 답 5 · mf 표시 · 학습지 정보', o.seedRec && o.seedRec.r === 'X' && o.seedRec.a === '5' && o.seedRec.mf === true && o.seedRec.kind === 'ws' && o.seedRec.swId === 9001, JSON.stringify(o.seedRec));
  t('다 채점 상태 3/3 · ✗ 2', o.stat.done === 3 && o.stat.tot === 3 && o.stat.xn === 2, JSON.stringify(o.stat));
  t('2차 대상 = 1번·2번', o.rt2.join(',') === '1,2', o.rt2.join(','));
  t('✗ 카드: 「매쓰플랫 채점」 표시 + 정답 가림', /매쓰플랫 채점/.test(o.card1) && /다시 도전/.test(o.card1) && !/정답 \(매쓰플랫\)/.test(o.card1), o.card1.slice(0, 200));
  t('◯ 카드는 전처럼 「이미 채점이 끝난 문제」', /이미 채점이 끝난 문제/.test(o.card3), o.card3.slice(0, 120));
  t('마무리 카드에 「다시 도전할 문항 2개」', /다시 도전할 문항 2개/.test(o.doneCard) && /다시 도전 시작하기/.test(o.doneCard), o.doneCard.slice(0, 200));
  t('다시 도전 시작 (2차 · 1,2번)', o.rtOn === '101,102', String(o.rtOn));
  t('2차 채점: 1차 X 그대로 · 2차 ◯ 기록', o.after.r1 === 'X' && o.after.a1 === '5' && o.after.rt && o.after.rt.length === 1 && o.after.rt[0].n === 2 && o.after.rt[0].r === 'O', JSON.stringify(o.after));
  t('매쓰플랫 대기열(hw_sync)에는 안 넣음 · 기록은 저장', o.ups.indexOf('hw_sync_AAA111') < 0 && o.ups.indexOf('hw_scores_AAA111') >= 0, o.ups.join(','));
  t('2차 카드: 「다시 맞혔어요」', /다시 맞혔어요/.test(o.rtCard), o.rtCard.slice(0, 160));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
