#!/usr/bin/env node
/* 학생앱 v2-157 검사 — 「다시 도전」이 잘 보이는가 (원장 2026-11-04) · 외부망 차단 · 가짜 Supabase
 * 실행: SP=<폴더> node sync/appbuild/tests/test_stu_v2157.js student_v2-157.html   (SP 에 화면 사진을 남긴다) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-157.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch();
  const pg = await (await br.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  const o = await pg.evaluate(async () => {
    const out = { ver: STU_VER };
    const idle = async () => { await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < 200 && BK.busy; i++) await new Promise((r) => setTimeout(r, 10)); };
    const txt = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const store = {};
    const fakeSb = { from() { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, is() { return b; }, like() { return b; }, ilike() { return b; }, contains() { return b; }, range() { return b; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, insert() { return Promise.resolve({ data: null, error: null }); }, update() { return b; }, delete() { return b; }, order() { return b; }, limit() { return b; }, single() { return Promise.resolve({ data: null, error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((x) => { if (x && x.key) store[x.key] = JSON.parse(JSON.stringify(x.value)); }); return Promise.resolve({ error: null }); },
      then(r, j) { let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; } };
    window.sb = fakeSb; window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중2', group: 'T5' };
    window.go = (id) => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); const el = document.getElementById(id); if (el) el.classList.add('active'); };
    window.confirm = () => true; window.alert = () => {};
    const P = (wpId, num, type, answer, extra) => Object.assign({ wpId, num, type, answer, result: '-', userAnswer: '', shape: 'num', parts: [{ kind: 'num', unit: '', label: '' }], cnt: 1, self: false, gradable: true }, extra || {});
    const w = { swId: 9201, wid: 7201, title: 'RPM 중2(하) 127P', date: '2026-11-04', status: '학습가능', n: 3, auto: true, problems: [
      P(738, '738', 'SINGLE_CHOICE', '1', { optionCount: 5 }), P(739, '739', 'SHORT_ANSWER', '161'), P(740, '740', 'SHORT_ANSWER', '3') ] };
    BK.wsq = { list: [w] }; BK.scores = {}; BK.loaded = true;
    await bkOpenWs(9201);
    const probs = BK.ans['ws_9201'].pages['w9201'].problems;
    const find = (id) => probs.find((p) => String(p.wpId) === String(id));
    const body = () => txt(document.getElementById('bkq-body').innerHTML);
    /* ① 738 만 틀리고 아직 다 안 채점 */
    bkPick('738', 2); await idle();
    out.part = body();
    /* ② 다 채점 → 2차 열림 */
    await bkGrade('739', '161', { vals: ['161'], sh: bkShape(find(739)) });
    await bkGrade('740', '3', { vals: ['3'], sh: bkShape(find(740)) });
    out.ready = body();
    out.readyBtns = [...document.querySelectorAll('#bkq-body button')].map((b) => b.textContent.trim());
    out.home2 = txt(bkRt2Home());
    /* ③ 2차도 틀림 (1일 전) → 3차 기다림 */
    const k = 'ws_9201_738', m = BK.scores[k];
    m.rt = [{ a: '2', k: 1, n: 2, r: 'X', at: new Date(Date.now() - 86400000).toISOString(), self: false, photo: '', tries: [] }];
    bkRenderQ(); out.wait = body();
    const due = new Date(Date.now() + 2 * 86400000); out.dueTxt = (due.getMonth() + 1) + '/' + due.getDate();
    out.home2b = bkRt2Home();
    /* ④ 4일 지남 → 3차 */
    m.rt[0].at = new Date(Date.now() - 4 * 86400000).toISOString();
    bkRenderQ(); out.due3 = body();
    out.due3Btns = [...document.querySelectorAll('#bkq-body button')].map((b) => b.textContent.trim());
    m.rt[0].at = new Date(Date.now() - 86400000).toISOString(); bkRenderQ();   // 사진은 기다림 화면으로
    return out;
  });
  t('버전 v2-157', o.ver === 'v2-157', o.ver);
  t('① 다 채점 전: 틀린 칸에 «다 채점하면 열려요»', /이 쪽을 다 채점하면/.test(o.part), o.part.slice(0, 300));
  t('① 다 채점 전: 맨 위 시작 카드 없음', !/다시 도전할 문항 1개 .*다시 도전할 문항 1개/.test(o.part));
  t('② 맨 위·틀린 칸·마무리 세 곳에 시작 버튼', o.readyBtns.filter((x) => /다시 도전 시작하기/.test(x)).length === 3, JSON.stringify(o.readyBtns));
  t('② 맨 위 카드에 문항 번호', /틀린 738번을 다시 풀어요/.test(o.ready), o.ready.slice(0, 200));
  t('② 채점 홈에 모아 보기', /다시 도전할 문항 1개/.test(o.home2) && /RPM 중2\(하\) 127P · 1문항 · 다시 도전/.test(o.home2), o.home2);
  t('③ 3차 기다림 날짜 (맨 위·칸·마무리)', (o.wait.match(new RegExp('3차 도전은 ' + o.dueTxt.replace('/', '\\/'), 'g')) || []).length === 3, o.wait.slice(0, 400));
  t('③ 칸 제목 «2차에서도 못 맞혔어요»', /2차 다시 도전에서도 못 맞혔어요/.test(o.wait));
  t('③ 시작 버튼 없음', !/다시 도전 시작하기/.test(o.wait));
  t('③ 채점 홈 모아 보기에서 빠짐', o.home2b === '', o.home2b);
  t('④ 3차 버튼 (맨 위·칸·마무리)', o.due3Btns.filter((x) => /3차 도전하기/.test(x)).length === 3, JSON.stringify(o.due3Btns));
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { document.getElementById('bkq-body').scrollTop = 0; });
  await pg.screenshot({ path: path.join(SP, 'stu_v2157_wait.png') });
  await pg.evaluate(() => { const m = BK.scores['ws_9201_738']; delete m.rt; bkRenderQ(); document.getElementById('bkq-body').scrollTop = 0; });
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(SP, 'stu_v2157_ready.png') });
  t('페이지 오류 없음', !errs.length, errs.join(' | '));
  console.log(`\n${pass}/${pass + fail}` + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})();
