#!/usr/bin/env node
/* 학원앱 v19-165 검사 — 📱 모바일 이미지가 글씨 배율(body zoom)과 상관없이 폭 480 그대로 (v19-164 검사 전부 + 배율 0.78·1.15·1.45) (html2canvas 는 $SP/libs/html2canvas.min.js) (가짜 학생 홍길동 · 가짜 교재 3권 · 날짜는 오늘 기준으로 만든다)
 *   실행: NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19165.js lumen_v19-165.html [스크린샷.png] */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-165.html');
const SHOT = process.argv[3] || '';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1500, height: 1000 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  const LIB = path.join(process.env.SP || '.', 'libs', 'html2canvas.min.js');
  await pg.route('**/html2canvas.min.js', (r) => r.fulfill({ path: LIB, contentType: 'application/javascript' }));
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  t('버전', (await pg.evaluate(() => APP_VER)) === 'v19-165');
  t('진도·리포트 탭의 «상담 리포트»는 빠짐', await pg.evaluate(() => !GROUPS.find((g) => g.key === 'score').subs.some((s) => s.v === 'consult')));
  await pg.evaluate(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const D = (n) => crAdd(crToday(), -n);
    /* 매쓰플랫 문항 기록: 집중 교재 b1 은 앞 4주만 거의 매 수업, 뒤로는 드문드문 · b2 는 꾸준히 · 학습지 */
    const recs = []; let id = 0;
    const add = (n, day, src, bid, title, wsid, okRate) => { for (let i = 0; i < n; i++) recs.push({ id: ++id, source: src, book_id: bid, result: (i / n) < okRate ? 'O' : 'X', score_datetime: day + 'T06:00:00+00:00', worksheet_title: title || null, student_worksheet_id: wsid || null }); };
    for (let k = 88; k >= 60; k -= 2) add(15, D(k), '교재', 101, null, null, 0.8);
    [50, 49, 30, 23].forEach((k) => add(k === 30 ? 2 : 20, D(k), '교재', 101, null, null, 0.8));
    for (let k = 88; k >= 1; k -= 3) add(25, D(k), '교재', 102, null, null, 0.75);
    for (let k = 80; k >= 40; k -= 4) add(12, D(k), '교재', 103, null, null, 0.85);
    for (let k = 86; k >= 2; k -= 2) add(20, D(k), '학습지', null, '중1 주간 (가짜)', 'w' + k, 0.6);
    add(11, D(3), '학습지', null, '가짜월일 가짜 개념편 - 중등수학1(하) 69~80p', 'wf1', 0.55);
    add(10, D(7), '학습지', null, '[오답] 가짜 개념편 - 중등수학1(하) 69~85p', 'wf2', 0.2);
    const hws = {}; for (let k = 40; k >= 1; k -= 3) for (let i = 0; i < 12; i++) hws['p' + k + '_' + i] = { at: D(k) + 'T06:00:00Z', r: i < 8 ? 'O' : 'X' };
    window.__STORE = { hw_scores_C1: { items: hws } };
    window.__TABLES = { mf_answer_records: recs, aha_notes: [{ created_at: D(80) + 'T05:00:00Z' }, { created_at: D(75) + 'T05:00:00Z' }, { created_at: D(70) + 'T05:00:00Z' }] };
    window.getSupaClient = function(){ return { storage: { from(){ return { list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } }, from(tb){ const o = { _t: tb, _k: null, _r: null, in(c, ks){ o._k = ks; return p; }, eq(c, k){ if (c === 'key') o._k = [k]; return p; }, range(a, b){ o._r = [a, b]; return p; },
      then(res, rej){ let data; if (o._t === 'lumen_store') data = (o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(window.__STORE[k])) })); else { data = (window.__TABLES[o._t] || []); if (o._r) data = data.slice(o._r[0], o._r[1] + 1); }
        return Promise.resolve({ data, error: null }).then(res, rej); } };
      const p = new Proxy(o, { get(tg, k){ if (k in tg) return tg[k]; return function(){ return p; }; } }); return p; } }; };
    window.supaSetItem = function(k, v){ window.__STORE[k] = JSON.parse(JSON.stringify(v)); return Promise.resolve(true); };
    const mm = (n) => D(n).slice(0, 7);
    BP.books = { 101: { n: '가짜 개념편 - 중등수학1(하)', g: '중1-2', pages: 158 }, 102: { n: '가짜 RPM - 중등수학1(상)', g: '중1-1', pages: 0 }, 103: { n: '가짜 최상위 - 초등수학6-2', g: '초6-2', pages: 0 } };
    const months = {}; months[mm(88)] = { maxP: 53, c: 450, t: 584 }; months[mm(50)] = Object.assign(months[mm(50)] || {}, { maxP: 71, c: 111, t: 138 }); months[mm(1)] = { maxP: 85, c: 42, t: 52 };
    BP.prog = { m1: { 101: { firstDate: D(88), lastDate: D(7), maxPage: 85, weekPages: 5, months: months, chapters: [] },
      102: { firstDate: D(88), lastDate: D(1), maxPage: 130, weekPages: 9, months: { [mm(88)]: { maxP: 47, c: 447, t: 498 }, [mm(50)]: { maxP: 97, c: 430, t: 495 }, [mm(1)]: { maxP: 130, c: 284, t: 431 } }, chapters: [] },
      103: { firstDate: D(80), lastDate: D(40), maxPage: 77, weekPages: 0, months: { [mm(50)]: { maxP: 77, c: 199, t: 242 } }, chapters: [] } } };
    BP.mfList = [{ mf_student_id: 'm1', name: '홍길동', lumen_rec_code: 'C1' }];
    BP.cfg = { def: 3, months: {}, pages: {}, rep: { s1: '101' }, done: {}, starts: {} }; BP.loaded = true;
    WK.loaded = true;
    const T = (d, title, label, sem, score, avg, wc) => ({ date: d, type: 'WEEKLY', title, paper: { label, sem }, students: [{ sid: 'm1', date: d, score, acadAvg: avg, acadRank: 3, acadN: 5, wrongConcepts: (wc || []).map((n) => ({ n, cnt: 1 })) }] });
    WK.tests = [T(D(60), '중1 (2026.05.09)', '중1-1', 1, 80, 75), T(D(40), '중1 (2026.04.25)', '중1', null, 70, 80), T(D(19), '중1 (2026.05.09)', '중1-1', 1, 55, 63, ['일차식의 덧셈과 뺄셈', '식의 값']),
      T(D(5), '중1 (2026.05.30)', '중1-1', 1, 25, 52, ['일차식의 덧셈과 뺄셈', '등식의 성질', '여러 가지 일차방정식의 풀이']), T(D(30), '초6 (2026.10.03)', '초6', null, 90, 73), T(D(10), '초6 (2026.10.17)', '초6-2', 2, 85, 77)];
    groupDays.M3 = [1, 3, 5];
    const hw = {}, stt = {}, pl = []; for (let k = 85; k >= 1; k -= 2){ hw[D(k)] = { p: k > 45 ? 100 : 60, c: k > 45 ? 80 : 30, w: k > 45 ? 60 : 10 }; stt[D(k).replace(/-/g, '.')] = 180; }
    for (let k = 60; k >= 1; k -= 3) pl.push({ setId: D(k).replace(/-/g, '') + '_2300', analysis: { date: D(k).replace(/-/g, '.'), tasksTranscript: ['[O] 수학숙제 (RPM 20문제)', '[O] 영어숙제'], zeroReason: k === 6 ? 'dup' : '' } });
    students.length = 0;
    students.push({ id: 's1', name: '홍길동', grade: '초등학교 6학년', group: 'M3', school: '가짜초등학교', lumen_rec_code: 'C1', lumen_hw: hw, lumen_study_time: stt, lumen_planner_photos: pl, lumen_classMemo: { [D(20).replace(/-/g, '.')]: '가짜 수업 메모' }, lumen_attendance: { [D(15)]: { status: 'late', lateMin: 5 } } },
      { id: 's2', name: '박하나', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'C2' });
    window.__STU = students.slice(); window.__STORE.counsel_log = {}; CR.code = ''; CR.data = null; cnsOpen('s1');
  });
  await pg.waitForTimeout(1500);
  const scr = await pg.evaluate(() => { window.__CRD = CR.data; const X = crCompute(); return crReport(X, 'screen'); });
  const nums = (scr.match(/<span class="cr-no">(\d+)<\/span>/g) || []).map((x) => +x.replace(/\D/g, ''));
  t('화면: 그래프·표 번호 1부터 차례로 (12개 이상)', nums.length >= 12 && nums.every((v, i) => v === i + 1), JSON.stringify(nums));
  t('과정별 시험 패널 7-1 · 7-2 …', /<span class="cr-no sm">7-1<\/span>/.test(scr) && /<span class="cr-no sm">7-2<\/span>/.test(scr));
  t('화면: 계획·가정 칸 🔒 원장님만', /🔒 다음 달 학원 계획/.test(scr) && /🔒 가정에서 도와주실 것/.test(scr) && /원장님만 · 인쇄·이미지에 빠짐/.test(scr));
  const pr = await pg.evaluate(() => crReport(crCompute(), 'print'));
  t('인쇄: 계획·가정 칸 빠짐 · 번호 그대로', !/다음 달 학원 계획/.test(pr) && !/가정에서 도와주실/.test(pr) && /<span class="cr-no">12<\/span>/.test(pr));
  t('통화 대본 «꼭 짚을 것»에 «리포트 1·2·3번»', await pg.evaluate(() => { CNS.tab = 'script'; return /리포트 1·2·3번/.test(rCounsel()); }));
  t('상담 기록 탭 계획 칸 안내 «원장님만»', await pg.evaluate(() => { CNS.tab = 'log'; return /🔒 원장님만 — 인쇄·모바일 이미지에는 빠집니다/.test(rCounsel()); }));
  t('위쪽 줄에 «📱 모바일 이미지» 단추', await pg.evaluate(() => { CNS.tab = 'rep'; return /onclick="crMobile\(\)"/.test(rCounsel()); }));
  const mob = await pg.evaluate(() => { CR_M = true; const h = crReport(crCompute(), 'print'); CR_M = false; const big = (h.match(/viewBox="0 0 900[^"]*"[\s\S]*?<\/svg>/) || [''])[0]; const fs = (big.match(/font-size="([\d.]+)"/) || [])[1]; return { fs: +fs, week: /\(이번 주\)/.test(h) }; });
  t('모바일: 넓은 그래프 글자 키움 · «(이번 주)» 줄임', mob.fs > 15 && !mob.week, JSON.stringify(mob));
  await pg.evaluate(() => crMobile()); await pg.waitForTimeout(6000);
  const ov = await pg.evaluate(() => { const o = document.getElementById('cr-mob-ov'); if (!o) return null; const img = o.querySelector('img'), a = o.querySelector('a[download]'); return { src: img && img.src.slice(0, 22), w: img && img.naturalWidth, h: img && img.naturalHeight, dl: a && a.getAttribute('download'), host: !!document.getElementById('cr-mob-host') }; });
  t('📱 모바일 이미지: PNG 그림 · 저장 단추 · 임시 틀 지움', ov && ov.src === 'data:image/png;base64,' && ov.w >= 900 && ov.h > ov.w * 3 && /홍길동_상담리포트_\d{4}-\d{2}-\d{2}\.png/.test(ov.dl) && !ov.host, JSON.stringify(ov));
  await pg.waitForTimeout(3000);
  for (const z of ['0.78', '1.15', '1.45']) {
    await pg.evaluate((zz) => { const o = document.getElementById('cr-mob-ov'); if (o) o.remove(); if (!students.some((s) => s.id === 's1')) { students.length = 0; window.__STU.forEach((s) => students.push(s)); } if (!CR.data) CR.data = window.__CRD; CR.code = 'C1'; document.body.style.zoom = zz; return crMobile(); }, z); await pg.waitForTimeout(5000);
    const r = await pg.evaluate(() => new Promise((res) => { const img = document.querySelector('#cr-mob-ov img'); if (!img) return res(null); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = 600; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, 600).data; let maxX = 0; for (let y = 0; y < 600; y += 3) for (let i = 0; i < c.width; i++) { const k = (y * c.width + i) * 4; if (d[k] < 200 || d[k + 1] < 200 || d[k + 2] < 200) maxX = Math.max(maxX, i); } res({ w: img.naturalWidth, right: maxX }); }));
    t('글씨 배율 ' + z + ': 그림 폭 960 · 오른쪽 여백 남음(안 잘림)', r && Math.abs(r.w - 960) <= 4 && r.right < r.w - 12 && r.right > r.w - 60, JSON.stringify(r));
  }
  await pg.evaluate(() => { document.body.style.zoom = ''; });
  if (SHOT) { const d = await pg.evaluate(() => document.querySelector('#cr-mob-ov img').src); require('fs').writeFileSync(SHOT, Buffer.from(d.split(',')[1], 'base64')); }
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
