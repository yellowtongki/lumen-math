#!/usr/bin/env node
/* 학원앱 v19-121 검사 — 🧠 루멘 수학퀴즈 (시안 docs/mockup_char_lesson_teacher.html)
 *   가짜 학생 3명(○○○1~3 · 중1) · 가짜 서버(lumen_store 흉내) · 외부망 차단
 *   ① 메뉴 「📱 학생앱 › 🧠 루멘 수학퀴즈」(강의실 바로 뒤) · 네 탭
 *   ② 📘 예시 불러오기 → 8줄 · 미리보기(학생앱과 같은 MQR 그리기)
 *   ③ 글 고치기 → 미리보기 바로 반영(**강조**) · ↑↓ 순서 · 줄 넣기·지우기 · 캐릭터/표정 · 문제 정답 바꾸기
 *   ④ 💾 임시저장 → quiz_<id> + quiz_index(초안) · 🚀 발행 → status pub · pubAt · n
 *   ⑤ 📋 대본 붙여넣기(JSON) · 🤖 AI 초안(callAI 흉내) · 재료 올리기(Storage 흉내 photos/quiz_mats/<id>/…)
 *   ⑥ 📊 학생 현황: 가짜 quizlog_* → 끝까지 봄 · 정답률 · 담음 · 멈춤 · 학생×줄 표 · 낱말 헷갈려요 순위
 *   ⑦ 🍙 낱말 Day: Day 넣기 · 낱말 넣기·고치기 → quiz_words_중1-2 · 🎨 캐릭터 10장
 *   ⑧ 1180px · 390px 가로 넘침 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19121.js lumen_v19-121.html
 *   그림: $SP/v19121_make.png · v19121_make_390.png · v19121_stat.png · v19121_words.png · v19121_char.png */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-121.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-121'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STUDENTS = [
  { id: 'S1', name: '○○○1', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'AAA111', lumen_planner: {} },
  { id: 'S2', name: '○○○2', grade: '중학교 1학년', group: 'T5', lumen_rec_code: 'AAA222', lumen_planner: {} },
  { id: 'S3', name: '○○○3', grade: '중1', group: 'M7', lumen_rec_code: 'AAA333', lumen_planner: {} },
  { id: 'S4', name: '○○○4', grade: '중학교 2학년', group: 'M7', lumen_rec_code: 'AAA444', lumen_planner: {} }];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1180, height: 820 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: {}, ups: [], toasts: [], q: [], files: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false, desc: '',
        select() { return b; }, eq(k, v) { b.desc += ' eq:' + v; b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { b.desc += ' like:' + p; const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; },
        or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; T.ups.push({ tbl, keys: arr.map((r) => r.key) });
          if (tbl === 'lumen_store') arr.forEach((r) => { T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl === 'lumen_store') T.q.push(b.desc.trim()); if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]), updated_at: '2026-10-10T00:00:00Z' }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: (bk) => ({ upload: (p, f) => { T.files.push({ bk, p, type: f && f.type }); return Promise.resolve({ data: { path: p }, error: null }); }, getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + bk + '/' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    T.seed = () => { students.length = 0; clone(STUDENTS).forEach((s) => students.push(s)); };
    T.seed();
  }, { STUDENTS });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 150)), ms);
  const noOverflow = () => pg.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, w: window.innerWidth }));
  t('버전 ' + WANT, (await pg.evaluate(() => APP_VER)) === WANT);

  /* ① 메뉴 */
  const M = await pg.evaluate(() => { const g = GROUPS.filter((x) => x.key === 'studentapp')[0]; const vs = g.subs.map((s) => s.v); const it = g.subs.filter((s) => s.v === 'mathquiz')[0]; return { vs, label: it && (it.icon + ' ' + it.label), after: vs.indexOf('mathquiz') === vs.indexOf('vod') + 1 }; });
  t('메뉴: 「📱 학생앱」 묶음에 「🧠 루멘 수학퀴즈」 (강의실 바로 뒤)', M.label === '🧠 루멘 수학퀴즈' && M.after, JSON.stringify(M));
  t('🎛 학생앱 기능 켜고 끄기 목록에 «🧠 루멘 수학퀴즈»(mathquiz)', await pg.evaluate(() => SF_LIST.some((f) => f.k === 'mathquiz' && /루멘 수학퀴즈/.test(f.n))));
  await pg.evaluate(() => { const g = GROUPS.filter((x) => x.key === 'studentapp')[0]; g.subs.filter((s) => s.v === 'mathquiz')[0].act(); render(); });
  await settle(500);
  const V0 = await pg.evaluate(() => ({ view: VIEW, tabs: [...document.querySelectorAll('.mqt-tab')].map((b) => b.textContent), empty: !!document.querySelector('.mqt-empty'), units: document.querySelectorAll('.mqt-unit').length, idxQ: T.q.filter((x) => x === 'eq:quiz_index').length, title: (document.querySelector('.mqt-top b') || {}).textContent }));
  t('화면 열림: 네 탭(✍️ 만들기 · 📊 학생 현황 · 🍙 낱말 Day · 🎨 캐릭터) · quiz_index 읽기 · 중1-2 기본 단원 9개 · 빈 안내', V0.view === 'mathquiz' && V0.tabs.join('|') === '✍️ 만들기|📊 학생 현황|🍙 낱말 Day|🎨 캐릭터' && V0.idxQ >= 1 && V0.units === 9 && V0.empty && V0.title === '🧠 루멘 수학퀴즈', JSON.stringify(V0));
  const notCharLesson = await pg.evaluate(() => !/캐릭터 수업|개념 나들이/.test(document.body.innerText));
  t('화면에 옛 이름(캐릭터 수업 · 개념 나들이) 없음', notCharLesson);

  /* ② 예시 */
  await pg.click('#mq-sample'); await settle(300);
  const S = await pg.evaluate(() => ({ n: MQ.cur && MQ.cur.lines.length, rows: document.querySelectorAll('.mqt-row').length, prev: { msg: document.querySelectorAll('#mq-prev .mq-msg').length, card: document.querySelectorAll('#mq-prev .mq-card').length, quiz: document.querySelectorAll('#mq-prev .mq-quiz').length, point: document.querySelectorAll('#mq-prev .mq-point').length },
    px: [...document.querySelectorAll('#mq-prev .mq-px')].every((i) => /^data:image\/png;base64,/.test(i.getAttribute('src')) && getComputedStyle(i).imageRendering === 'pixelated'), hl: [...document.querySelectorAll('#mq-prev .mq-hl')].map((e) => e.textContent).slice(0, 2), svg: !!document.querySelector('#mq-prev .mq-card svg'),
    unitOn: (document.querySelector('.mqt-unit.on') || {}).innerText || '', title: document.getElementById('mq-title').value }));
  console.log(JSON.stringify(S));
  t('📘 예시: 동위각과 엇각 8줄 · 편집 줄 8 · 미리보기 대사 5 · 카드 1(그림) · 문제 1 · 포인트 1', S.n === 8 && S.rows === 8 && S.prev.msg === 5 && S.prev.card === 1 && S.svg && S.prev.quiz === 1 && S.prev.point === 1 && S.title === '동위각과 엇각', JSON.stringify(S));
  t('미리보기 캐릭터 = data URI 도트(pixelated) · **강조** → 주황 · 단원 칸 Ⅰ-3 「새로」', S.px && S.hl[0] === '같은 자리' && /Ⅰ-3/.test(S.unitOn) && /새로/.test(S.unitOn), JSON.stringify([S.hl, S.unitOn]));
  await pg.screenshot({ path: SP + '/v19121_make.png' });
  const N1 = await noOverflow();
  t('1180px: 만들기 가로 넘침 없음', N1.doc <= N1.w && N1.body <= N1.w, JSON.stringify(N1));

  /* ③ 고치기 */
  await pg.fill('.mqt-row[data-i="0"] textarea', '두 직선이 만나면 **평행선** 이야기를 해 보자.');
  await settle(100);
  const E1 = await pg.evaluate(() => ({ data: MQ.cur.lines[0].text, prev: [...document.querySelectorAll('#mq-prev .mq-msg')][0].innerText, hl: [...document.querySelectorAll('#mq-prev .mq-msg')][0].querySelector('.mq-hl').textContent, dirty: document.getElementById('mq-dirty').textContent }));
  t('글 고치기 → 미리보기 바로 반영 · **평행선** 강조 · ● 저장 안 됨', /평행선 이야기/.test(E1.prev) && E1.hl === '평행선' && /저장 안 됨/.test(E1.dirty), JSON.stringify(E1));
  await pg.click('.mqt-row[data-i="0"] .mqt-mv:nth-of-type(2)'); await settle(150);
  const R1 = await pg.evaluate(() => ({ w0: MQ.cur.lines[0].who, w1: MQ.cur.lines[1].who, t1: MQ.cur.lines[1].text, p0: [...document.querySelectorAll('#mq-prev .mq-msg .mq-nm')][0].textContent }));
  t('↓ 순서 바꾸기 → 1번 아하 · 2번 루미 · 미리보기도 아하가 먼저', R1.w0 === 'aha' && R1.w1 === 'lumi' && /평행선/.test(R1.t1) && R1.p0 === '아하', JSON.stringify(R1));
  await pg.click('.mqt-row[data-i="1"] .mqt-mv:nth-of-type(1)'); await settle(150);
  t('↑ 되돌리기', await pg.evaluate(() => MQ.cur.lines[0].who === 'lumi' && MQ.cur.lines[1].who === 'aha'));
  await pg.evaluate(() => { const L = MQ.cur.lines.splice(7, 1)[0]; MQ.cur.lines.splice(0, 0, L); MQ.drag = 0; mqDrop({ preventDefault() {} }, 7); });
  t('끌어서 옮기기(mqDrop) → 제자리', await pg.evaluate(() => MQ.cur.lines[7].t === 'point' && MQ.cur.lines[0].who === 'lumi'));
  await pg.click('.mqt-add button:nth-child(1)'); await settle(200);
  const A1 = await pg.evaluate(() => ({ n: MQ.cur.lines.length, last: MQ.cur.lines[8], rows: document.querySelectorAll('.mqt-row').length, focus: document.activeElement && document.activeElement.tagName }));
  t('「+ 💬 대사」 → 9줄 (빈 대사 · 앞 대사와 다른 캐릭터) · 그 칸에 글쓰기 커서', A1.n === 9 && A1.last.t === 'say' && A1.rows === 9 && A1.focus === 'TEXTAREA', JSON.stringify(A1));
  await pg.fill('.mqt-row[data-i="8"] textarea', '임시 줄'); await settle(80);
  await pg.selectOption('.mqt-row[data-i="8"] select[aria-label="캐릭터"]', 'ssam'); await settle(200);
  const W1 = await pg.evaluate(() => ({ who: MQ.cur.lines[8].who, faces: [...document.querySelectorAll('.mqt-row[data-i="8"] select[aria-label="표정"] option')].map((o) => o.textContent), nm: [...document.querySelectorAll('#mq-prev .mq-msg .mq-nm')].pop().textContent }));
  t('캐릭터를 정수쌤으로 → 표정은 «기본»만 · 미리보기 이름 정수쌤', W1.who === 'ssam' && W1.faces.join() === '기본' && W1.nm === '정수쌤', JSON.stringify(W1));
  await pg.selectOption('.mqt-row[data-i="2"] select[aria-label="표정"]', 'base'); await settle(150);
  t('표정 바꾸기 (루미 당황 → 기본)', await pg.evaluate(() => MQ.cur.lines[2].face === 'base'));
  await pg.selectOption('.mqt-row[data-i="2"] select[aria-label="표정"]', 'oops'); await settle(150);
  await pg.click('.mqt-row[data-i="8"] .del'); await settle(200);
  t('✕ 지우기 → 8줄', await pg.evaluate(() => MQ.cur.lines.length === 8 && document.querySelectorAll('.mqt-row').length === 8));
  await pg.click('.mqt-row[data-i="5"] .mqt-b.sm'); await settle(150);   /* + 보기 */
  await pg.fill('.mqt-row[data-i="5"] .mqt-ch:nth-child(3) input[type=text]', '25°'); await settle(80);
  await pg.click('.mqt-row[data-i="5"] .mqt-ch:nth-child(2) input[type=radio]'); await settle(150);
  const Q1 = await pg.evaluate(() => ({ ch: MQ.cur.lines[5].choices, a: MQ.cur.lines[5].answer, opts: [...document.querySelectorAll('#mq-prev .mq-quiz .mq-opt')].map((b) => b.textContent) }));
  t('문제: 보기 넣기(25°) · 정답을 2번(115°)으로 · 미리보기 보기 3개', JSON.stringify(Q1.ch) === '["65°","115°","25°"]' && Q1.a === 1 && Q1.opts.length === 3, JSON.stringify(Q1));
  await pg.click('#mq-prev .mq-quiz .mq-opt:nth-child(1)'); await settle(150);
  const P1 = await pg.evaluate(() => ({ fb: (document.querySelector('#mq-prev .mq-fb') || {}).innerText || '', ok: (document.querySelector('#mq-prev .mq-opt.ok') || {}).textContent }));
  t('미리보기에서 보기 누르기 → 틀림 안내 · 정답(115°) 초록', /아쉬워요/.test(P1.fb) && /115°/.test(P1.ok), JSON.stringify(P1));
  await pg.click('.mqt-row[data-i="5"] .mqt-ch:nth-child(1) input[type=radio]'); await settle(120);
  await pg.click('.mqt-row[data-i="5"] .mqt-ch:nth-child(3) .mqt-x'); await settle(150);
  t('정답 되돌리기(65°) · 보기 빼기 → 2개', await pg.evaluate(() => MQ.cur.lines[5].answer === 0 && MQ.cur.lines[5].choices.length === 2));

  /* ④ 저장 · 발행 */
  await pg.click('#mq-save'); await settle(500);
  const D1 = await pg.evaluate(() => { const id = MQ.cur.id; return { id, doc: T.store['quiz_' + id], idx: T.store.quiz_index, st: MQ.cur.status, dirty: document.getElementById('mq-dirty').textContent, unit: (document.querySelector('.mqt-unit.on') || {}).innerText || '' }; });
  t('💾 임시저장 → quiz_<id> (8줄 · 제목·학년·단원·범위) + quiz_index 초안', D1.doc && D1.doc.lines.length === 8 && D1.doc.title === '동위각과 엇각' && D1.doc.grade === '중1-2' && D1.doc.unit === 'Ⅰ-3' && D1.doc.scope === '옥길중 2학기 기말'
    && D1.idx && D1.idx.items.length === 1 && D1.idx.items[0].status === 'draft' && D1.idx.items[0].id === D1.id && D1.st === 'draft' && /저장됨/.test(D1.dirty) && /초안/.test(D1.unit), JSON.stringify({ idx: D1.idx, dirty: D1.dirty, unit: D1.unit }));
  t('저장된 줄 모양: 대사 who/face/text · 카드 svg · 문제 choices/answer/src · 포인트', (() => { const L = D1.doc.lines; return L[0].t === 'say' && L[0].who === 'lumi' && L[2].face === 'oops' && L[4].t === 'card' && /^<svg/.test(L[4].svg) && L[5].t === 'quiz' && L[5].answer === 0 && L[5].src && L[7].t === 'point'; })(), JSON.stringify(D1.doc.lines.map((x) => x.t)));
  await pg.evaluate(() => { T.seed(); render(); }); await settle(200);
  const pubLabel = await pg.evaluate(() => document.getElementById('mq-pub').textContent);
  t('발행 단추에 대상 수: 「🚀 발행 (중1 3명)」', pubLabel === '🚀 발행 (중1 3명)', pubLabel);
  await pg.click('#mq-pub'); await settle(500);
  const D2 = await pg.evaluate(() => ({ it: T.store.quiz_index.items[0], st: MQ.cur.status, btn: !!document.getElementById('mq-pub'), save: document.getElementById('mq-save').textContent }));
  t('🚀 발행 → quiz_index status pub · pubAt · n 8 · nq 1 · 단추 「고친 것 저장」·「발행 내리기」', D2.it.status === 'pub' && !!D2.it.pubAt && D2.it.n === 8 && D2.it.nq === 1 && D2.st === 'pub' && !D2.btn && /고친 것 저장/.test(D2.save), JSON.stringify(D2));
  const PUBID = D1.id;

  /* ⑤ 새 퀴즈 + 붙여넣기 + AI + 재료 */
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.mqt-unit')].filter((x) => /Ⅰ-4/.test(x.innerText))[0]; b.click(); });
  await settle(200);
  const N0 = await pg.evaluate(() => ({ unit: MQ.cur.unit, title: MQ.cur.title, st: MQ.cur.status, n: MQ.cur.lines.length }));
  t('없는 단원(Ⅰ-4 작도와 합동) 누르기 → 새 퀴즈(빈 대본)', N0.unit === 'Ⅰ-4' && N0.title === '작도와 합동' && N0.st === 'new' && N0.n === 0, JSON.stringify(N0));
  await pg.click('#mq-paste'); await settle(150);
  await pg.fill('#mq-paste-ta', '```json\n{"title":"작도와 합동","lines":[{"t":"say","who":"lumi","text":"**작도**는 눈금 없는 자와 컴퍼스만 써!"},{"t":"say","who":"aha","face":"base","text":"자로 길이를 재면 되잖아?"},{"t":"quiz","q":"작도에 쓰는 도구는?","choices":["눈금 없는 자와 컴퍼스","각도기"],"answer":0},{"t":"weird"},{"t":"point","text":"작도 = 자 + 컴퍼스"}]}\n```');
  await pg.click('#mq-paste-go'); await settle(200);
  const PS = await pg.evaluate(() => ({ n: MQ.cur.lines.length, t: MQ.cur.lines.map((x) => x.t).join(','), face: MQ.cur.lines[0].face, msg: MQ.aiMsg, ov: !!document.getElementById('mq-paste-ov'), prev: document.querySelectorAll('#mq-prev > *').length }));
  t('📋 붙여넣기(```json 울타리 · 모르는 줄 1개) → 4줄 · face 기본값 · 미리보기 4', PS.n === 4 && PS.t === 'say,say,quiz,point' && PS.face === 'base' && /4줄/.test(PS.msg) && /1개는 뺐어요/.test(PS.msg) && !PS.ov && PS.prev === 4, JSON.stringify(PS));
  await pg.evaluate(() => { apiKey = 'sk-test'; aiProvider = 'claude'; window.__aiPrompt = ''; callAI = async (p) => { window.__aiPrompt = p; return '여기 대본:\n{"title":"작도와 합동","lines":[{"t":"say","who":"lumi","face":"base","text":"자와 컴퍼스!"},{"t":"say","who":"aha","face":"base","text":"자로 재면 되지?"},{"t":"say","who":"lumi","face":"oops","text":"앗, **눈금 없는 자**야!"},{"t":"card","title":"작도 도구","body":"자 = 선 긋기 · 컴퍼스 = 길이 옮기기"},{"t":"quiz","q":"길이를 옮기는 도구는?","choices":["컴퍼스","자","각도기"],"answer":0,"src":"쎈 p.30 #2 숫자 바꿈"},{"t":"say","who":"aha","face":"aha","text":"아하! 컴퍼스로 옮기는구나"},{"t":"point","text":"작도는 **자 + 컴퍼스**"}]}'; }; });
  await pg.click('#mq-ai'); await settle(400);
  const AI = await pg.evaluate(() => ({ n: MQ.cur.lines.length, msg: MQ.aiMsg, p: window.__aiPrompt, aha: (document.querySelector('#mq-prev .mq-ahafx .mq-bub') || {}).innerText || '' }));
  t('🤖 AI 초안(callAI) → 7줄 · 지시문에 두 규칙(숫자만 바꾼 비슷한 문제 · 아하는 자주 하는 실수) · 아하 💡 말풍선', AI.n === 7 && /7줄/.test(AI.msg) && /숫자만 바꾼 비슷한 문제/.test(AI.p) && /아하는 학생들이 자주 하는 실수/.test(AI.p) && /중1-2/.test(AI.p) && /💡/.test(AI.aha), JSON.stringify({ msg: AI.msg, aha: AI.aha }));
  await pg.setInputFiles('#mq-file', [{ name: '교과서 p.24.png', mimeType: 'image/png', buffer: PNG }, { name: 'note.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
  await settle(500);
  const UP = await pg.evaluate(() => ({ files: T.files, mats: MQ.cur.mats, list: [...document.querySelectorAll('.mqt-file')].map((e) => e.innerText) }));
  t('재료 올리기: 사진 → Storage photos/quiz_mats/<id>/… · 재료 목록 1개 (txt 는 거절)', UP.files.length === 1 && UP.files[0].bk === 'photos' && UP.files[0].p.indexOf('quiz_mats/' + (await pg.evaluate(() => MQ.cur.id)) + '/') === 0 && UP.mats.length === 1 && UP.mats[0].kind === 'img' && UP.list.length === 1, JSON.stringify(UP));
  await pg.click('#mq-save'); await settle(500);
  const D3 = await pg.evaluate(() => ({ idx: T.store.quiz_index.items.map((x) => x.unit + ':' + x.status), mats: (T.store['quiz_' + MQ.cur.id] || {}).mats }));
  t('두 번째 퀴즈 임시저장 → 목록 2개(Ⅰ-3 발행 · Ⅰ-4 초안) · 재료 주소 저장', JSON.stringify(D3.idx) === '["Ⅰ-3:pub","Ⅰ-4:draft"]' && D3.mats && D3.mats.length === 1, JSON.stringify(D3));

  /* 390px */
  await pg.setViewportSize({ width: 390, height: 820 }); await pg.evaluate(() => { MOB.pc = true; render(); }); await settle(400);   /* 폰은 「🖥 PC 화면」 으로 들어온 것과 같게 */
  const N2 = await noOverflow();
  t('390px(🖥 PC 화면): 만들기 화면이 그려짐 · 한 줄 칸', await pg.evaluate(() => !!document.querySelector('.mqt-make .mqt-row') && getComputedStyle(document.querySelector('.mqt-grid')).gridTemplateColumns.split(' ').length === 1));
  await pg.evaluate(() => { const m = document.querySelector('.mqt-c'); if (m) m.scrollIntoView({ block: 'start' }); }); await settle(150);
  await pg.screenshot({ path: SP + '/v19121_make_390.png', fullPage: false });
  t('390px: 만들기 가로 넘침 없음', N2.doc <= 390 && N2.body <= 390, JSON.stringify(N2));
  await pg.setViewportSize({ width: 1180, height: 820 }); await settle(200);

  /* ⑥ 학생 현황 */
  await pg.evaluate((id) => {
    const now = Date.now(), iso = (m) => new Date(now - m * 60000).toISOString();
    T.store.quizlog_AAA111 = { byQuiz: { [id]: { step: 7, done: true, startAt: iso(10), doneAt: iso(6), ans: { 5: { pick: 0, ok: true } }, saved: true } } };
    T.store.quizlog_AAA222 = { byQuiz: { [id]: { step: 7, done: true, startAt: iso(20), doneAt: iso(18), ans: { 5: { pick: 1, ok: false } }, saved: false } } };
    T.store.quizlog_AAA333 = { byQuiz: { [id]: { step: 3, done: false, startAt: iso(30), ans: {} } } };
    T.store.quizlog_AAA444 = { byQuiz: { other: { step: 1 } } };
    T.store['quiz_words_중1-2'] = { days: [{ n: 1, words: [{ w: '엇각' }, { w: '동위각' }, { w: '작도' }] }] };
    T.store.wordlog_AAA111 = { known: { 동위각: iso(100) }, confused: { 엇각: iso(100), 작도: iso(50) } };
    T.store.wordlog_AAA222 = { known: {}, confused: { 엇각: iso(80) } };
    T.store.wordlog_AAA444 = { known: {}, confused: { 엇각: iso(80) } };
  }, PUBID);
  await pg.evaluate((id) => { T.seed(); MQ.statQ = id; MQ.logs = null; mqTab('stat'); }, PUBID); await settle(700);
  const ST = await pg.evaluate(() => ({ done: document.getElementById('mq-k-done').innerText, acc: document.getElementById('mq-k-acc').innerText, time: document.getElementById('mq-k-time').innerText, saved: document.getElementById('mq-k-saved').innerText, stop: document.getElementById('mq-k-stop').innerText,
    rows: [...document.querySelectorAll('#mq-stat-tbl tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => td.innerText.trim()).join('|')), heads: document.querySelectorAll('#mq-stat-tbl thead th').length,
    rank: [...document.querySelectorAll('#mq-wrank .mqt-wrd')].map((e) => e.innerText.replace(/\s+/g, ' ')), alertBtn: [...document.querySelectorAll('.mqt-hd2 button')].map((b) => b.textContent + (b.disabled ? '(꺼짐)' : '')), q: T.q.filter((x) => /like:(quizlog|wordlog)_%/.test(x)).length }));
  console.log(JSON.stringify(ST));
  t('현황 KPI: 끝까지 2/3 · 정답률 50% · 평균 3분 0초 · 담음 1 · 멈춤 1', ST.done.replace(/\s/g, '') === '2/3' && /^50%/.test(ST.acc) && ST.time === '3분 0초' && ST.saved === '1' && ST.stop === '1', JSON.stringify(ST));
  t('학생×줄 표: 3명 · 칸 8+2 · ○○○1 문제 O · ○○○2 X · ○○○3 4번째 칸 «…»', ST.rows.length === 3 && ST.heads === 11 && /○○○1/.test(ST.rows[0]) && ST.rows[0].split('|')[6] === 'O' && /📒/.test(ST.rows[0]) && ST.rows.some((r) => /○○○2/.test(r) && r.split('|')[6] === 'X') && ST.rows.some((r) => /○○○3/.test(r) && r.split('|')[4] === '…' && r.split('|')[3] === '✓' && r.split('|')[5] === '·'), JSON.stringify(ST.rows));
  t('낱말 헷갈려요 순위(중1 학생만): 엇각 2명 · 작도 1명 · 기록은 like 질의 한 번씩', ST.rank[0] === '엇각 2명' && ST.rank[1] === '작도 1명' && ST.rank.length === 2 && ST.q >= 2, JSON.stringify(ST.rank));
  t('「안 본 학생에게 알림」은 꺼 둔 단추(준비 중)', ST.alertBtn.some((x) => /안 본 학생 0명에게 알림 \(준비 중\)\(꺼짐\)/.test(x)), JSON.stringify(ST.alertBtn));
  await pg.screenshot({ path: SP + '/v19121_stat.png' });
  const N3 = await noOverflow();
  t('1180px: 현황 가로 넘침 없음', N3.doc <= N3.w && N3.body <= N3.w, JSON.stringify(N3));
  await pg.setViewportSize({ width: 390, height: 820 }); await pg.evaluate(() => render()); await settle(300);
  const N4 = await noOverflow();
  t('390px: 현황 가로 넘침 없음 (표는 칸 안에서 밀기)', N4.doc <= 390 && N4.body <= 390, JSON.stringify(N4));
  await pg.setViewportSize({ width: 1180, height: 820 }); await settle(200);

  /* ⑦ 낱말 Day */
  await pg.evaluate(() => { mqTab('words'); }); await settle(400);
  const W0 = await pg.evaluate(() => ({ chips: [...document.querySelectorAll('.mqt-chip')].filter((b) => /^Day/.test(b.textContent)).map((b) => b.textContent), cards: document.querySelectorAll('.mqt-wcard').length }));
  t('낱말 Day: 서버 quiz_words_중1-2 읽기 → Day 1 (낱말 3)', W0.chips.length === 1 && /Day 1/.test(W0.chips[0]) && W0.cards === 3, JSON.stringify(W0));
  await pg.click('#mq-wday-add'); await settle(200);
  await pg.click('#mq-wadd'); await settle(200);
  await pg.fill('.mqt-wcard[data-k="0"] label:nth-of-type(1) input', '현'); await pg.fill('.mqt-wcard[data-k="0"] label:nth-of-type(2) input', '弦');
  await pg.fill('.mqt-wcard[data-k="0"] > label:nth-of-type(2) input', '원 위의 두 점을 이은 선분');
  await pg.click('#mq-wadd'); await settle(150);
  await pg.click('.mqt-wcard[data-k="1"] .mqt-x'); await settle(150);
  await pg.click('#mq-wsave'); await settle(400);
  const WS = await pg.evaluate(() => T.store['quiz_words_중1-2']);
  console.log(JSON.stringify(WS));
  t('Day 넣기 · 낱말 넣기·고치기·지우기 → 💾 quiz_words_중1-2 = Day 1(3) + Day 2(현 · 弦 · 뜻)', WS && WS.days.length === 2 && WS.days[0].words.length === 3 && WS.days[1].n === 2 && WS.days[1].words.length === 1 && WS.days[1].words[0].w === '현' && WS.days[1].words[0].hanja === '弦' && WS.days[1].words[0].mean === '원 위의 두 점을 이은 선분', JSON.stringify(WS));
  await pg.evaluate(() => { window.prompt = () => '[{"w":"호","hanja":"弧","mean":"원 위의 두 점 사이의 곡선","who":"lumi"}]'; mqWPaste(); }); await settle(200);
  t('📋 JSON 붙여넣기(낱말 목록) → 지금 Day 뒤에 붙임 · 미리보기 카드', await pg.evaluate(() => MQ.words['중1-2'].days[1].words.length === 2 && document.querySelectorAll('.mqt-wprev .mq-word').length === 2));
  await pg.screenshot({ path: SP + '/v19121_words.png' });
  const N5 = await noOverflow();
  t('1180px: 낱말 가로 넘침 없음', N5.doc <= N5.w && N5.body <= N5.w, JSON.stringify(N5));
  await pg.setViewportSize({ width: 390, height: 820 }); await pg.evaluate(() => render()); await settle(300);
  const N6 = await noOverflow();
  t('390px: 낱말 가로 넘침 없음', N6.doc <= 390 && N6.body <= 390, JSON.stringify(N6));
  await pg.setViewportSize({ width: 1180, height: 820 }); await settle(200);

  /* 🎨 캐릭터 */
  await pg.evaluate(() => { MQ.wDirty = false; mqTab('char'); }); await settle(300);
  const CH = await pg.evaluate(() => ({ imgs: document.querySelectorAll('.mqt-chars .mq-px').length, names: [...document.querySelectorAll('.mqt-char h4')].map((h) => h.innerText) }));
  t('🎨 캐릭터: 루미(기본·당황) · 아하(기본·아하) · 정수쌤(기본) — 전신+얼굴 10장', CH.imgs === 10 && /루미/.test(CH.names[0]) && /아하/.test(CH.names[1]) && /정수쌤/.test(CH.names[2]), JSON.stringify(CH));
  await pg.screenshot({ path: SP + '/v19121_char.png' });

  /* 다시 열기: 서버에서 읽어 편집 */
  await pg.evaluate(() => { MQ.cur = null; MQ.dirty = false; MQ.idx = null; mqTab('make'); }); await settle(500);
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.mqt-unit')].filter((x) => /Ⅰ-3/.test(x.innerText))[0]; b.click(); }); await settle(400);
  const RO = await pg.evaluate(() => ({ n: MQ.cur && MQ.cur.lines.length, st: MQ.cur && MQ.cur.status, tag: (document.querySelector('.mqt-unit.on .mqt-st') || {}).textContent }));
  t('다시 열기: 목록 → quiz_<id> 읽어 편집 (8줄 · 발행)', RO.n === 8 && RO.st === 'pub' && RO.tag === '발행', JSON.stringify(RO));
  await pg.evaluate(() => { const b = [...document.querySelectorAll('.mqt-b')].filter((x) => x.textContent === '발행 내리기')[0]; b.click(); }); await settle(400);
  t('발행 내리기 → 초안', await pg.evaluate(() => T.store.quiz_index.items.filter((x) => x.unit === 'Ⅰ-3')[0].status === 'draft'));
  const skip = await pg.evaluate(() => PULL_SKIP_PREFIX.indexOf('quiz') >= 0 && PULL_SKIP_PREFIX.indexOf('wordlog_') >= 0);
  t('시작 다운로드 제외 목록에 quiz · wordlog_', skip);
  const ls = await pg.evaluate(() => Object.keys(localStorage).filter((k) => /^quiz|^wordlog_/.test(k)));
  t('이 기기 저장(localStorage)에 퀴즈 키 없음', ls.length === 0, JSON.stringify(ls));

  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 400));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
