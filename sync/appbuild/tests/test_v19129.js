#!/usr/bin/env node
/* 학원앱 v19-129 검사 — 📗 교재 목록 새로고침 (원장 2026-10-17 「중1 새 교재가 학생앱에 안 보인다」)
 *   울트라일일 「🔄 지금 가져오기」 바로 뒤에 「📗 교재 목록 새로고침」 단추 → 선택 창(전체 / 학년 / 반) → lumen_store mf_swb_req 쪽지
 *   ① 단추가 «지금 가져오기» 뒤에 붙고 rUltra 가 udFetchBtn 을 그대로 부름 (원래 단추는 그대로)
 *   ② 선택 창: 전체 학생 · 학년(중1…) · 반 칩과 인원 · 코드 없는 학생·퇴원생은 뺌
 *   ③ 요청: 전체 = codes [] · 중1 = 그 학생 코드만 · {status:'requested', reqAt, by:'teacher'} · 토스트
 *   ④ 상태: 대기 → 갱신 중 → 완료(메모) / 실패 · 15초마다 확인(폴링) · 30분 넘게 멈춘 요청은 다시 요청 가능
 *   ⑤ 요청 중에는 선택 창에 단추 없이 상태만 · 깨우기 열쇠 목록에 mf_swb_req
 *   실행: SP=<임시폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19129.js lumen_v19-129.html
 *   그림: $SP/v19129.png   가짜 서버 · 외부망 차단. 학생 실명 없음(○○○). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-129.html');
const SP = process.env.SP || '/tmp';
const WANT = (FILE.match(/v19-\d+/) || ['v19-129'])[0];
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const STUDENTS = [
  { id: 'S1', name: '○○○', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'AAA111' },
  { id: 'S2', name: '○○○', grade: '중학교 1학년', group: '중1 B반', lumen_rec_code: 'BBB222' },
  { id: 'S3', name: '○○○', grade: '중학교 1학년', group: '중1 A반', lumen_rec_code: 'CCC333' },
  { id: 'S4', name: '○○○', grade: '중학교 1학년', group: '중1 A반' },                       /* 코드 없음 → 뺌 */
  { id: 'S5', name: '○○○', grade: '중학교 2학년', group: '중2 A반', lumen_rec_code: 'DDD444' },
  { id: 'S6', name: '○○○', grade: '고등학교 1학년', group: '고1 A반', lumen_rec_code: 'EEE555' } ];

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate((STUDENTS) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.T = { store: {}, upserts: [], toasts: [], selects: 0 };
    window.getSupaClient = () => ({
      from: () => ({
        select: () => ({ eq: (k, v) => { T.selects++; return Promise.resolve({ data: Object.prototype.hasOwnProperty.call(T.store, v) ? [{ key: v, value: JSON.parse(JSON.stringify(T.store[v])) }] : [] }); } }),
        upsert: (row) => { const rows = Array.isArray(row) ? row : [row]; rows.forEach((r) => { T.upserts.push({ key: r.key, value: JSON.parse(JSON.stringify(r.value)) }); T.store[r.key] = JSON.parse(JSON.stringify(r.value)); }); return Promise.resolve({ error: null }); } }) });
    window.getSortedStudents = () => STUDENTS;
    window.plToast = (m) => { T.toasts.push(m); };
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.confirm = () => true;
    const box = document.createElement('div'); box.id = 'tdemo'; box.style.cssText = 'width:1000px;padding:12px;background:#f1f5f9;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:7px;align-items:center'; document.body.appendChild(box);
    window.render = () => { box.innerHTML = '<span style="font-weight:800">04-17 · 12명 학습</span>' + udFetchBtn(); };
    VIEW = 'ultra';
    // 가짜 시계: 15초 폴링을 바로 돌릴 수 있게 setInterval 을 잡아 둔다
    window.__iv = []; const si = window.setInterval; window.setInterval = (f, ms) => { window.__iv.push({ f, ms }); return si(() => {}, 1e9); };
  }, STUDENTS);
  await pg.evaluate(() => { document.querySelectorAll('body > div').forEach((d) => { if (d.id !== 'tdemo' && getComputedStyle(d).position === 'fixed') d.style.display = 'none'; }); });
  const settle = (ms) => pg.evaluate((ms) => new Promise((r) => setTimeout(r, ms || 120)), ms);
  const ver = await pg.evaluate(() => APP_VER);
  t('버전 ' + WANT, ver === WANT, ver);

  /* ── ① 단추 ── */
  const src = await pg.evaluate(() => ({ ultra: String(rUltra).indexOf('udFetchBtn()') >= 0, wake: HTS_WAKE_KEYS.mf_swb_req === 1, wakeOld: HTS_WAKE_KEYS.mf_collect_req === 1 }));
  t('rUltra 가 udFetchBtn() 을 부름 (그 뒤에 새 단추가 덧붙음) · 깨우기 열쇠에 mf_swb_req · 기존 열쇠 그대로', src.ultra && src.wake && src.wakeOld, JSON.stringify(src));
  await pg.evaluate(() => render()); await settle(150); await pg.evaluate(() => render()); await settle(50);
  const b1 = await pg.evaluate(() => { const box = document.getElementById('tdemo'), bs = [...box.querySelectorAll('button')];
    return { labels: bs.map((b) => b.textContent.replace(/\s+/g, ' ').trim()), idx: bs.map((b) => /지금 가져오기/.test(b.textContent) ? 'A' : (/교재 목록/.test(b.textContent) ? 'B' : '?')).join('') }; });
  t('「🔄 지금 가져오기」 바로 뒤에 「📗 교재 목록 새로고침」 (둘 다 있음 · 순서 A→B)', b1.idx === 'AB' && /📗 교재 목록 새로고침/.test(b1.labels[1]), JSON.stringify(b1));
  t('서버 상태를 한 번 읽음 (mf_swb_req 없음 → 대기 아님)', await pg.evaluate(() => T.selects >= 1 && swbState().k === 'idle'));

  /* ── ② 선택 창 ── */
  await pg.click('#swb-btn'); await settle(100);
  const p1 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); const chips = [...box.querySelectorAll('span[onclick^="swbPick"]')].map((c) => c.textContent.replace(/\s+/g, ' ').trim());
    return { open: SWB.open, chips, txt: box.textContent, send: [...box.querySelectorAll('button')].some((b) => /새로고침 요청하기/.test(b.textContent)) }; });
  t('선택 창이 열림 · 칩 «전체 학생 5» «중1 3» «중2 1» «고1 1» + 반 «중1 A반 2»… (코드 없는 학생 뺌)',
    p1.open && p1.chips.indexOf('전체 학생 5') >= 0 && p1.chips.indexOf('중1 3') >= 0 && p1.chips.indexOf('중2 1') >= 0 && p1.chips.indexOf('고1 1') >= 0 && p1.chips.indexOf('중1 A반 2') >= 0 && p1.chips.indexOf('중1 B반 1') >= 0, JSON.stringify(p1.chips));
  t('설명 줄(새 교재가 안 보일 때 · 교재 목록만 · 1~2분) · 「전체 학생 5명」 · 요청 단추', /안 보일 때/.test(p1.txt) && /교재 목록만/.test(p1.txt) && /1~2분/.test(p1.txt) && /전체 학생 5명의 교재 목록/.test(p1.txt) && p1.send, p1.txt.slice(0, 300));
  await pg.screenshot({ path: SP + '/v19129.png', clip: { x: 0, y: 0, width: 1200, height: 700 } });

  /* ── ③ 요청: 중1 ── */
  await pg.evaluate(() => swbPick('g:중학교 1학년')); await settle(60);
  t('중1 고르면 「선택한 3명」', await pg.evaluate(() => /선택한 3명의 교재 목록/.test(document.getElementById('tdemo').textContent)));
  await pg.evaluate(() => swbSend()); await settle(200);
  const r1 = await pg.evaluate(() => ({ up: T.upserts.filter((u) => u.key === 'mf_swb_req'), toast: T.toasts.slice(-1)[0], open: SWB.open, st: swbState().k }));
  const q1 = r1.up[0] && r1.up[0].value;
  t('mf_swb_req 에 {status:requested, codes:[중1 3명], by:teacher, reqAt}', r1.up.length === 1 && q1.status === 'requested' && q1.by === 'teacher' && /^\d{4}-\d\d-\d\dT/.test(q1.reqAt) && JSON.stringify(q1.codes) === JSON.stringify(['AAA111', 'BBB222', 'CCC333']), JSON.stringify(r1.up));
  t('요청 뒤 창 닫힘 · 토스트 · 상태 «대기»', !r1.open && /요청했습니다/.test(r1.toast) && r1.st === 'wait', JSON.stringify(r1));
  const w1 = await pg.evaluate(() => { const b = document.querySelector('#swb-btn'); return { txt: b.textContent.replace(/\s+/g, ' ').trim(), iv: window.__iv.filter((x) => x.ms === 15000).length }; });
  t('단추가 «⏳ 교재 목록 대기 중» · 15초마다 확인하는 감시 1개', /⏳ 교재 목록 대기 중/.test(w1.txt) && w1.iv === 1, JSON.stringify(w1));

  /* ── ④ 상태 변화: 대기 → 갱신 중 → 완료 ── */
  await pg.evaluate(() => { T.store.mf_swb_req = Object.assign({}, T.store.mf_swb_req, { status: 'running', startedAt: new Date().toISOString(), note: '매쓰플랫 접속 중…' }); const iv = window.__iv.filter((x) => x.ms === 15000)[0]; iv.f(); });
  await settle(150);
  const w2 = await pg.evaluate(() => ({ txt: document.querySelector('#swb-btn').textContent.replace(/\s+/g, ' ').trim(), k: swbState().k }));
  t('15초 확인 → «📗 교재 목록 갱신 중… 매쓰플랫 접속 중…»', w2.k === 'run' && /갱신 중/.test(w2.txt) && /매쓰플랫 접속 중/.test(w2.txt), JSON.stringify(w2));
  await pg.click('#swb-btn'); await settle(80);
  const p2 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); return { txt: box.textContent, send: [...box.querySelectorAll('button')].some((b) => /새로고침 요청하기/.test(b.textContent)), chips: box.querySelectorAll('span[onclick^="swbPick"]').length }; });
  t('진행 중에 창을 열면 상태 줄만 (칩·요청 단추 없음)', /갱신 중 — 매쓰플랫 접속 중/.test(p2.txt) && !p2.send && p2.chips === 0, p2.txt.slice(0, 200));
  await pg.evaluate(() => swbClose());
  await pg.evaluate(() => { T.toasts.length = 0; T.store.mf_swb_req = Object.assign({}, T.store.mf_swb_req, { status: 'done', ok: true, finishedAt: new Date().toISOString(), note: '교재 목록 갱신 완료 (3명 · 약 1분)' }); const iv = window.__iv.filter((x) => x.ms === 15000)[0]; iv.f(); });
  await settle(150);
  const w3 = await pg.evaluate(() => ({ txt: document.querySelector('#swb-btn').textContent.replace(/\s+/g, ' ').trim(), k: swbState().k, toast: T.toasts.join('|'), poll: SWB.poll }));
  t('완료 → 단추 «✅ 교재 목록 완료» · 토스트에 메모 «3명 · 약 1분» · 감시 멈춤', w3.k === 'done' && /✅ 교재 목록 완료/.test(w3.txt) && /교재 목록 갱신 완료 \(3명 · 약 1분\)/.test(w3.toast) && w3.poll === null, JSON.stringify(w3));
  await pg.click('#swb-btn'); await settle(80);
  const p3 = await pg.evaluate(() => { const box = document.getElementById('tdemo'); return { txt: box.textContent, send: [...box.querySelectorAll('button')].some((b) => /새로고침 요청하기/.test(b.textContent)) }; });
  t('완료 뒤 다시 열면 메모 줄 + 다시 요청 가능', /교재 목록 갱신 완료 \(3명 · 약 1분\)/.test(p3.txt) && p3.send);
  /* 전체 요청 + 실패 */
  await pg.evaluate(() => swbPick('all')); await pg.evaluate(() => swbSend()); await settle(150);
  const q2 = await pg.evaluate(() => T.upserts.filter((u) => u.key === 'mf_swb_req').slice(-1)[0].value);
  t('전체 요청은 codes: [] (서버가 전체 학생)', q2.status === 'requested' && Array.isArray(q2.codes) && q2.codes.length === 0, JSON.stringify(q2));
  await pg.evaluate(() => { T.toasts.length = 0; T.store.mf_swb_req = Object.assign({}, T.store.mf_swb_req, { status: 'done', ok: false, finishedAt: new Date().toISOString(), note: '교재 목록 갱신 실패 (코드 1) — 잠시 뒤 다시 눌러 주세요' }); window.__iv.filter((x) => x.ms === 15000).slice(-1)[0].f(); });
  await settle(150);
  const w4 = await pg.evaluate(() => ({ txt: document.querySelector('#swb-btn').textContent.replace(/\s+/g, ' ').trim(), toast: T.toasts.join('|') }));
  t('실패 → 단추 «⚠ 교재 목록 실패» · 토스트에 실패 메모', /⚠ 교재 목록 실패/.test(w4.txt) && /갱신 실패/.test(w4.toast), JSON.stringify(w4));
  /* 30분 넘게 멈춘 요청은 다시 요청 가능 */
  await pg.evaluate(() => { SWB.req = { status: 'running', startedAt: new Date(Date.now() - 40 * 60000).toISOString(), codes: [], by: 'teacher' }; render(); });
  const w5 = await pg.evaluate(() => ({ k: swbState().k, stale: swbState().stale, txt: document.querySelector('#swb-btn').textContent.replace(/\s+/g, ' ').trim() }));
  t('40분 넘게 «갱신 중»인 요청은 멈춘 것으로 보고 다시 요청 가능', w5.k === 'idle' && w5.stale && /📗 교재 목록 새로고침/.test(w5.txt), JSON.stringify(w5));
  /* 반 고르기 */
  await pg.evaluate(() => { SWB.req = null; swbPick('c:중1 A반'); });
  t('반(중1 A반) 고르면 코드 2명 (AAA111, CCC333)', await pg.evaluate(() => JSON.stringify(swbCodesFor(SWB.sel)) === JSON.stringify(['AAA111', 'CCC333'])));
  /* 지금 가져오기 원래 단추 */
  const old = await pg.evaluate(() => { UD.freq = null; const h = udFetchBtn(); return { has: /udFetchNow\(\)/.test(h) && /지금 가져오기/.test(h) }; });
  t('원래 「🔄 지금 가져오기」 단추(udFetchNow)는 그대로', old.has);

  t('페이지 오류 없음', errs.length === 0, errs.join(' | ').slice(0, 300));
  console.log('\n' + (fail ? '❌' : '✅') + ' 통과 ' + pass + ' · 실패 ' + fail);
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
