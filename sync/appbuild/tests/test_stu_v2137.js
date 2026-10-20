#!/usr/bin/env node
/* 학생앱 v2-137 검사 — 🧠 루멘 수학퀴즈 (원장 승인 시안 docs/mockup_char_lesson_px2.html)
 *   가짜 학생 ○○○ (중학교 1학년 · 오늘 2026-10-15 → 중1-2) · 가짜 서버 · 외부망 차단
 *   ① 홈 카드 «🧠 루멘 수학퀴즈 · 새 퀴즈 1개» · 📚 공부 탭 줄 두 개
 *   ② 코스: 발행(pub)된 내 학년 퀴즈만 (초안·다른 학년 안 보임) · 옆 학기 탭
 *   ③ 퀴즈: «다음»마다 한 줄 · 문제 전엔 «다음» 잠김 · 오답 → 바로 안내 · 다시 못 고름 · 🔊 ko-KR
 *   ④ quizlog_<코드> 저장 → 다시 열면 멈춘 곳부터 · 📒 담기 → saved · 끝 → done · 목록 «✓ 끝» · «내가 담은 아하 포인트»
 *   ⑤ 🍙 낱말 Day: 학년 탭 · Day 칩 · 알아요/헷갈려요 → wordlog_<코드> · 어제 헷갈린 낱말 «🔁 다시 볼 낱말» · Day 끝 줄 긋기
 *   ⑥ 교재 재료(mats) 안 보임 · 390px 가로 넘침 없음 · 페이지 오류 없음
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2137.js student_v2-137.html
 *   그림: $SP/stu2137_home.png · stu2137_list.png · stu2137_play.png · stu2137_words.png */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-137.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v2-\d+/) || ['v2-137'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 860 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const S = MQR.sample();
    window.T = { store: {
      quiz_index: { items: [
        { id: 'qA', title: '동위각과 엇각', grade: '중1-2', unit: 'Ⅰ-3', status: 'pub', pubAt: '2026-10-12T00:00:00Z', n: 8 },
        { id: 'qB', title: '작도와 합동', grade: '중1-2', unit: 'Ⅰ-4', status: 'draft', n: 5 },
        { id: 'qC', title: '삼각형의 성질', grade: '중2-2', unit: 'Ⅰ-1', status: 'pub', n: 6 },
        { id: 'qD', title: '소인수분해', grade: '중1-1', unit: 'Ⅰ-1', status: 'pub', n: 4 }] },
      quiz_qA: { id: 'qA', title: S.title, grade: '중1-2', unit: 'Ⅰ-3', mats: [{ name: '교과서 p.24', url: 'https://example.com/secret_textbook.png', kind: 'img' }], lines: S.lines },
      'quiz_words_중1-2': { days: [ { n: 1, words: [ { w: '동위각', hanja: '同位角', hj: '同 같을 동 · 位 자리 위 · 角 뿔 각', mean: '같은 위치의 두 각', say: 'F자!', ex: '«l ∥ m»', unit: 'Ⅰ-3' }, { w: '엇각', hanja: '엇角', mean: '엇갈린 위치의 두 각', say: 'Z자!', unit: 'Ⅰ-3' } ] },
        { n: 2, words: [ { w: '합동', hanja: '合同', mean: '포개어지는 두 도형', unit: 'Ⅰ-4', who: 'aha' }, { w: '현', hanja: '弦', mean: '원 위의 두 점을 이은 선분', unit: 'Ⅱ-2' } ] } ] },
      'quiz_words_중2-2': { days: [ { n: 1, words: [ { w: '이등변삼각형', mean: '두 변의 길이가 같은 삼각형' } ] } ] },
      wordlog_AAA111: { known: {}, confused: { 현: '2026-10-14T03:00:00.000Z' } }
    }, ups: [] };
    const mk = (tbl) => {
      const b = { f: [], one: false,
        select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; },
        like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; }, or() { return b; },
        order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, is() { return b; },
        single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { return b; }, delete() { return b; },
        insert(row) { T.ups.push('INSERT:' + tbl); return Promise.resolve({ data: null, error: null }); },
        upsert(row) { const arr = Array.isArray(row) ? row : [row]; arr.forEach((r) => { T.ups.push(r.key); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
        then(r, j) { if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
          const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]) }));
          return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } };
      return b; };
    sb = { from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }), getPublicUrl: (p) => ({ data: { publicUrl: p } }) }) } };
    window.supabase = { createClient: () => sb };
    studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 1학년', school: '옥길중', group: 'T5', id: 'S1' }; isTest = false;
    MQS.fakeNow = '2026-10-15T10:00:00+09:00';
    window.__spk = [];
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { cancel() {}, getVoices() { return [{ lang: 'ko-KR', name: '가짜' }]; }, speak(u) { window.__spk.push({ text: u.text, lang: u.lang }); } } });
    window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  });
  t('버전 ' + WANT, (await pg.evaluate(() => STU_VER)) === WANT);
  const wait = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
  const noOverflow = () => pg.evaluate(() => { const a = document.querySelector('.screen.active'); return { doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, scr: a ? a.scrollWidth : 0 }; });
  const okW = (o) => o.doc <= 390 && o.body <= 390 && o.scr <= 390;

  /* ① 홈 카드 */
  await pg.evaluate(() => go('screen-home')); await wait(500);
  const H = await pg.evaluate(() => { const el = document.getElementById('mq-home'); return { vis: !!el && el.offsetHeight > 0, sub: document.getElementById('mq-home-sub').textContent, n: document.getElementById('mq-home-n').textContent, av: document.querySelectorAll('#mq-home-av img').length,
    study: [...document.querySelectorAll('#screen-study .mrow b')].map((b) => b.textContent).slice(0, 2) }; });
  t('홈 카드 «🧠 루멘 수학퀴즈» — 새 퀴즈 1개 · 얼굴 셋 · 📚 공부 탭 줄(루멘 수학퀴즈 · 수학 낱말 Day)', H.vis && /새 퀴즈 1개/.test(H.sub) && H.n === '1' && H.av === 3 && H.study.join() === '루멘 수학퀴즈,수학 낱말 Day', JSON.stringify(H));
  await pg.screenshot({ path: SP + '/stu2137_home.png' });
  const N0 = await noOverflow();
  t('390px: 홈 가로 넘침 없음', okW(N0), JSON.stringify(N0));

  /* ② 코스 */
  await pg.evaluate(() => go('screen-mq')); await wait(500);
  const L0 = await pg.evaluate(() => ({ units: [...document.querySelectorAll('.mqs-unit')].map((b) => b.innerText.replace(/\s+/g, ' ')), tabs: [...document.querySelectorAll('#mqs-body .mqs-tabs button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')), cast: document.querySelectorAll('#mqs-body .mq-cast img').length, ttl: document.querySelector('#mqs-body .mqs-ttl').textContent }));
  console.log(JSON.stringify(L0));
  t('코스: 중1-2 발행 퀴즈만(Ⅰ-3 동위각과 엇각 · 8장) — 초안 Ⅰ-4 · 중2-2 안 보임', L0.units.length === 1 && /Ⅰ-3 동위각과 엇각 8장/.test(L0.units[0]) && /중1-2/.test(L0.ttl), JSON.stringify(L0.units));
  t('캐릭터 셋(전신) · 학기 탭 중1-1(1) / 중1-2(1, 고름)', L0.cast === 3 && L0.tabs.join('|') === '중1-1 1|중1-2 1*', JSON.stringify(L0.tabs));
  await pg.click('#mqs-body .mqs-tabs button:nth-child(1)'); await wait(150);
  const L1 = await pg.evaluate(() => [...document.querySelectorAll('.mqs-unit')].map((b) => b.innerText.replace(/\s+/g, ' ')));
  t('중1-1 탭 → 소인수분해', L1.length === 1 && /소인수분해/.test(L1[0]), JSON.stringify(L1));
  await pg.click('#mqs-body .mqs-tabs button:nth-child(2)'); await wait(150);
  await pg.screenshot({ path: SP + '/stu2137_list.png' });
  const N1 = await noOverflow();
  t('390px: 코스 가로 넘침 없음', okW(N1), JSON.stringify(N1));

  /* ③ 퀴즈 */
  await pg.click('.mqs-unit[data-id="qA"]'); await wait(500);
  const P0 = await pg.evaluate(() => ({ act: document.querySelector('.screen.active').id, n: document.querySelectorAll('#mqs-chat [data-i]').length, sub: document.getElementById('mqs-psub').textContent, next: document.getElementById('mqs-next').textContent, log: T.store.quizlog_AAA111,
    px: [...document.querySelectorAll('#mqs-chat .mq-px')].every((i) => /^data:image\/png/.test(i.src) && getComputedStyle(i).imageRendering === 'pixelated') }));
  t('퀴즈 열기 → 첫 줄 하나만 · 1/8 · «다음 ›» · quizlog 시작(startAt) · 도트 그림', P0.act === 'screen-mq-play' && P0.n === 1 && /Ⅰ-3 · 1\/8/.test(P0.sub) && P0.next === '다음 ›' && P0.log && P0.log.byQuiz.qA && P0.log.byQuiz.qA.startAt && P0.log.byQuiz.qA.step === 0 && P0.px, JSON.stringify(P0).slice(0, 300));
  await pg.click('#mqs-next'); await wait(150);
  const P1 = await pg.evaluate(() => ({ n: document.querySelectorAll('#mqs-chat [data-i]').length, step: T.store.quizlog_AAA111.byQuiz.qA.step, nm: [...document.querySelectorAll('#mqs-chat .mq-nm')].map((e) => e.textContent) }));
  t('«다음» → 두 줄(루미 → 아하) · quizlog step 1', P1.n === 2 && P1.step === 1 && P1.nm.join() === '루미,아하', JSON.stringify(P1));
  await pg.click('#mqs-chat [data-i="1"] .mq-tts'); await wait(50);
  const SPK = await pg.evaluate(() => window.__spk.slice(-1)[0]);
  t('🔊 → 기기 음성 ko-KR (기호는 말로: ∠ → 각, ° → 도)', SPK && SPK.lang === 'ko-KR' && /각 a = 70도/.test(SPK.text) && !/\*\*/.test(SPK.text), JSON.stringify(SPK));
  for (let k = 0; k < 4; k++) { await pg.click('#mqs-next'); await wait(80); }
  const P2 = await pg.evaluate(() => ({ n: document.querySelectorAll('#mqs-chat [data-i]').length, last: document.querySelector('#mqs-chat [data-i="5"]').className, next: document.getElementById('mqs-next'), hl: [...document.querySelectorAll('#mqs-chat .mq-hl')].map((e) => e.textContent).slice(0, 2), card: !!document.querySelector('#mqs-chat .mq-card svg') }));
  const nb = await pg.evaluate(() => ({ t: document.getElementById('mqs-next').textContent, d: document.getElementById('mqs-next').disabled }));
  t('문제 줄에서 «다음» 잠김(«보기를 골라 봐요») · 개념 카드 그림 · **강조**', P2.n === 6 && /mq-quiz/.test(P2.last) && nb.t === '보기를 골라 봐요' && nb.d && P2.card && P2.hl[0] === '같은 자리', JSON.stringify([P2.n, nb, P2.hl]));
  await pg.click('#mqs-chat [data-i="5"] .mq-opt:nth-child(2)'); await wait(150);
  const Q = await pg.evaluate(() => ({ fb: document.querySelector('#mqs-chat .mq-fb').innerText, ok: document.querySelector('#mqs-chat .mq-opt.ok').textContent, no: document.querySelector('#mqs-chat .mq-opt.no').textContent, ans: T.store.quizlog_AAA111.byQuiz.qA.ans, next: document.getElementById('mqs-next').textContent }));
  t('오답(115°) → 「아쉬워요 — 정답은 65°」 · 정답 초록 · quizlog ans {5:{pick:1, ok:false}} · «다음» 풀림', /아쉬워요/.test(Q.fb) && /65°/.test(Q.ok) && /115°/.test(Q.no) && JSON.stringify(Q.ans) === '{"5":{"pick":1,"ok":false}}' && Q.next === '다음 ›', JSON.stringify(Q));
  await pg.evaluate(() => mqsPick(5, 0)); await wait(100);
  t('다시 고를 수 없음(첫 답 그대로)', await pg.evaluate(() => T.store.quizlog_AAA111.byQuiz.qA.ans['5'].pick === 1));
  const noMats = await pg.evaluate(() => !document.documentElement.innerHTML.includes('secret_textbook') && !document.querySelector('#mqs-chat img[src^="http"]'));
  t('교재 재료(mats) 그림·주소가 화면에 없음', noMats);
  await pg.screenshot({ path: SP + '/stu2137_play.png' });
  const N2 = await noOverflow();
  t('390px: 퀴즈 가로 넘침 없음', okW(N2), JSON.stringify(N2));

  /* ④ 이어 보기 */
  await pg.click('#mqs-next'); await wait(100);   /* step 6 */
  await pg.evaluate(() => { mqsBack(); MQS.log = null; MQS.docs = {}; }); await wait(200);
  await pg.evaluate(() => go('screen-mq')); await wait(300);
  const L2 = await pg.evaluate(() => [...document.querySelectorAll('.mqs-unit')].map((b) => b.innerText.replace(/\s+/g, ' ') + (b.classList.contains('cur') ? '*' : '')));
  t('목록에 «7/8 진행 중» (노란 칸)', /7\/8 진행 중\*$/.test(L2[0]), JSON.stringify(L2));
  await pg.click('.mqs-unit[data-id="qA"]'); await wait(400);
  const R = await pg.evaluate(() => ({ n: document.querySelectorAll('#mqs-chat [data-i]').length, sub: document.getElementById('mqs-psub').textContent, fb: !!document.querySelector('#mqs-chat .mq-fb.no') }));
  t('다시 열기 → 멈춘 곳(7번째 줄)부터 · 문제 답도 그대로', R.n === 7 && /7\/8/.test(R.sub) && R.fb, JSON.stringify(R));
  await pg.click('#mqs-next'); await wait(150);
  const PT = await pg.evaluate(() => ({ pt: !!document.querySelector('#mqs-chat .mq-point'), btn: (document.getElementById('mqs-save') || {}).textContent, next: document.getElementById('mqs-next').textContent }));
  t('마지막 줄: 정수쌤 아하 포인트 + 「📒 아하노트에 담기」 · «끝 🎉»', PT.pt && PT.btn === '📒 아하노트에 담기' && PT.next === '끝 🎉', JSON.stringify(PT));
  await pg.click('#mqs-save'); await wait(150);
  const SV = await pg.evaluate(() => ({ e: T.store.quizlog_AAA111.byQuiz.qA, btn: document.querySelector('#mqs-chat .mq-pbtns button').textContent, ins: T.ups.filter((x) => /^INSERT/.test(x)) }));
  t('담기 → quizlog saved:true (+ 담은 글) · 「담았어요 ✓」 · aha_notes 에는 넣지 않음', SV.e.saved === true && /F자/.test(SV.e.savedText) && /담았어요/.test(SV.btn) && SV.ins.length === 0, JSON.stringify({ saved: SV.e.saved, btn: SV.btn, ins: SV.ins }));
  await pg.click('#mqs-next'); await wait(200);
  const F = await pg.evaluate(() => ({ e: T.store.quizlog_AAA111.byQuiz.qA, fin: (document.getElementById('mqs-fin') || {}).innerText || '', next: document.getElementById('mqs-next').textContent, again: getComputedStyle(document.getElementById('mqs-again')).display }));
  t('끝 → done · doneAt · 「🎉 끝! … 문제 0/1」 · «목록으로» · «처음부터»', F.e.done === true && !!F.e.doneAt && F.e.step === 7 && /끝!/.test(F.fin) && /문제 0\/1/.test(F.fin) && F.next === '목록으로' && F.again !== 'none', JSON.stringify({ e: F.e, fin: F.fin }));
  await pg.click('#mqs-next'); await wait(300);
  const L3 = await pg.evaluate(() => ({ u: [...document.querySelectorAll('.mqs-unit')].map((b) => b.innerText.replace(/\s+/g, ' ')), saved: [...document.querySelectorAll('.mqs-saved')].map((e) => e.innerText) }));
  t('목록: «✓ 끝 · 0/1» · «📒 내가 담은 아하 포인트»에 포인트', /✓ 끝 · 0\/1/.test(L3.u[0]) && L3.saved.length === 1 && /F자/.test(L3.saved[0]), JSON.stringify(L3));
  await pg.evaluate(() => go('screen-home')); await wait(300);
  t('홈 카드: 다 봤어요 ✓', await pg.evaluate(() => /다 봤어요/.test(document.getElementById('mq-home-sub').textContent) && document.getElementById('mq-home-n').style.display === 'none'));

  /* ⑤ 낱말 Day */
  await pg.evaluate(() => go('screen-mq-words')); await wait(500);
  const W0 = await pg.evaluate(() => ({ tabs: [...document.querySelectorAll('#mqs-wbody .mqs-tabs button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')), days: [...document.querySelectorAll('.mqs-days button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')),
    rv: [...document.querySelectorAll('.mqs-rv .mq-word')].map((e) => e.getAttribute('data-w')), words: [...document.querySelectorAll('#mqs-wlist .mq-word')].map((e) => e.getAttribute('data-w')), hj: (document.querySelector('#mqs-wlist .mq-word .hjs') || {}).textContent, say: document.querySelectorAll('#mqs-wlist .mq-wc img').length }));
  console.log(JSON.stringify(W0));
  t('낱말 Day: 학년 탭(중1-2 고름 · 중2-2) · Day 1 · 2 · Day 1 낱말 2(한자 풀이 · 캐릭터 한마디)', W0.tabs.join('|') === '중1-2*|중2-2' && W0.days.join('|') === 'Day 1*|Day 2' && W0.words.join() === '동위각,엇각' && /同 같을 동/.test(W0.hj) && W0.say === 2, JSON.stringify(W0));
  t('어제 «헷갈려요» 한 「현」 → 맨 위 «🔁 다시 볼 낱말»', W0.rv.join() === '현', JSON.stringify(W0.rv));
  await pg.click('#mqs-wlist .mq-word[data-w="동위각"] .mqs-chk button:nth-child(1)'); await wait(150);
  await pg.click('#mqs-wlist .mq-word[data-w="엇각"] .mqs-chk button:nth-child(2)'); await wait(150);
  const W1 = await pg.evaluate(() => ({ log: T.store.wordlog_AAA111, days: [...document.querySelectorAll('.mqs-days button')].map((b) => b.className), fin: !!document.querySelector('#mqs-wbody .mqs-fin'), rv: [...document.querySelectorAll('.mqs-rv .mq-word')].map((e) => e.getAttribute('data-w')),
    btn: document.querySelector('#mqs-wlist .mq-word[data-w="엇각"] .mqs-chk button.n').textContent }));
  t('알아요(동위각) · 헷갈려요(엇각) → wordlog_AAA111 known/confused · 오늘 헷갈린 건 오늘은 다시 안 나옴 · Day 1 끝(줄 긋기)', W1.log.known['동위각'] && W1.log.confused['엇각'] && W1.log.confused['현'] && W1.fin && /done/.test(W1.days[0]) && W1.rv.join() === '현' && /헷갈려요/.test(W1.btn), JSON.stringify(W1));
  await pg.click('.mqs-rv .mq-word[data-w="현"] .mqs-chk button:nth-child(1)'); await wait(150);
  const W2 = await pg.evaluate(() => ({ log: T.store.wordlog_AAA111, rv: document.querySelectorAll('.mqs-rv .mq-word').length }));
  t('다시 볼 낱말 「현」 알아요 → confused 에서 빠짐 · 칸 사라짐', W2.log.known['현'] && !W2.log.confused['현'] && W2.rv === 0, JSON.stringify(W2));
  await pg.evaluate(() => { MQS.fakeNow = '2026-10-16T10:00:00+09:00'; mqsWordsPaint(); }); await wait(100);
  const W3 = await pg.evaluate(() => ({ rv: [...document.querySelectorAll('.mqs-rv .mq-word')].map((e) => e.getAttribute('data-w')), day: [...document.querySelectorAll('.mqs-days button')].map((b) => b.textContent + (b.classList.contains('on') ? '*' : '')) }));
  t('다음 날: 헷갈린 「엇각」이 «🔁 다시 볼 낱말»로', W3.rv.join() === '엇각', JSON.stringify(W3));
  await pg.evaluate(() => { MQS.wDay = -1; mqsWordsPaint(); }); await wait(100);
  t('다시 열면 아직 안 끝난 Day 2 부터', await pg.evaluate(() => document.querySelector('.mqs-days button.on').textContent === 'Day 2'));
  await pg.screenshot({ path: SP + '/stu2137_words.png' });
  const N3 = await noOverflow();
  t('390px: 낱말 Day 가로 넘침 없음', okW(N3), JSON.stringify(N3));
  await pg.click('#mqs-wbody .mqs-tabs button:nth-child(2)'); await wait(300);
  t('학년 탭 중2-2 → 이등변삼각형', await pg.evaluate(() => [...document.querySelectorAll('#mqs-wlist .mq-word')].map((e) => e.getAttribute('data-w')).join() === '이등변삼각형'));

  /* 기능 스위치 · 테스트 모드 */
  await pg.evaluate(() => { SF.cfg = { mathquiz: { on: false } }; go('screen-home'); }); await wait(200);
  const OFF = await pg.evaluate(() => { go('screen-mq'); return { home: document.getElementById('mq-home').style.display, act: document.querySelector('.screen.active').id }; });
  t('🎛 기능 끔(mathquiz) → 홈 카드 숨김 · 화면 들어가면 홈으로', OFF.home === 'none' && OFF.act === 'screen-home', JSON.stringify(OFF));
  await pg.evaluate(() => { SF.cfg = null; });
  const before = await pg.evaluate(() => T.ups.length);
  await pg.evaluate(() => { isTest = true; mqsMark('합동', 'known'); }); await wait(100);
  t('테스트 모드에서는 서버에 쓰지 않음', (await pg.evaluate(() => T.ups.length)) === before);

  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 400));
  console.log('\n' + (fail ? '❌' : '✅') + ' ' + pass + '/' + (pass + fail));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
