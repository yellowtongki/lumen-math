#!/usr/bin/env node
/* 학원앱 v19-184 검사 — 📑 월간보고서 한 화면 + 루멘 학부모앱 공개 (시안 docs/mockup_monthly_report.html)
 *   외부망 차단 · getSupaClient·supaSetItem·callAI 를 가짜로(실서버·AI 호출 없음) · 이름 ○○○
 *   ① 줄 태그: 의견 출처(기본 매쓰플랫 AI · mfrep_src → ✍ 루멘 데이터) · 매쓰플랫 ✓/비공개 · 루멘 ✓/루멘/코드 없음 · 요약 «루멘 공개»
 *   ② ✍ 루멘 데이터로 다시 쓰기 → callAI 프롬프트(원장 프롬프트 + 매쓰플랫 숫자 + 숙제 이행도 + 아하 질문) → 저장 전 · ✍ 태그 · ↩ 저장된 글로
 *   ③ 의견 저장 → mfrep_req comment + mfrep_src_<달> 에 lu
 *   ④ 공개 대상 → mfrep_req {publish, ids, mf, lumen, sms} · 매쓰플랫 끄면 문자 꺼짐 · 둘 다 끄면 안 보냄 · 공개 취소도 대상 그대로
 *   ⑤ 예전 📊 월간보고서 탭 없음 ⑥ 버전 · 페이지 오류 없음
 *   실행: NODE_PATH=/opt/node-tools/node_modules node sync/appbuild/tests/test_v19184.js lumen_v19-184.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-184.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 1300, height: 950 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const P = (fn, a) => pg.evaluate(fn, a);
  await P(() => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const ym = mrMonths()[0];
    window.__ym = ym; window.__sets = []; window.__ai = [];
    window.__STORE = {
      ['mfrep_' + ym]: { month: ym, at: '2026-11-10T01:00:00Z', missing: [], rows: [
        { sid: 'I1', name: '○○○', grade: '중2', reportId: 101, scoringCount: 1092, correctRate: 79, rank: 3, shared: false, comment: '매쓰플랫 AI 의견 글', commentOn: true, code: 'AAA111', lumen: false },
        { sid: 'I2', name: '○○○', grade: '중1', reportId: 102, scoringCount: 500, correctRate: 88, rank: 2, shared: true, comment: '이미 고친 글', commentOn: true, code: 'BBB222', lumen: true },
        { sid: 'I3', name: '○○○', grade: '초6', reportId: 103, scoringCount: 300, correctRate: 70, rank: 4, shared: false, comment: '', commentOn: true, code: '', lumen: false }] },
      ['mfrep_src_' + ym]: { by: { '102': 'lu' } },
      hw_teach_AAA111: { byDate: { [ym + '-07']: { t: 80 }, [ym + '-21']: { t: 100 } } },
      mf_report_cfg: { prompt: '원장 프롬프트 시험글' }
    };
    const mk = (tbl) => { const b = { f: {}, select() { return b; }, eq(k, v) { b.f[k] = v; return b; }, in(k, a) { b.f.in = a; return b; }, gte() { return b; }, lt() { return b; }, lte() { return b; }, limit() { return b; }, order() { return b; }, maybeSingle() { b.one = true; return b; }, single() { b.one = true; return b; },
      then(r, j) { let data = [];
        if (tbl === 'lumen_store') { const ks = b.f.in || (b.f.key ? [b.f.key] : []); data = ks.filter((k) => k in __STORE).map((k) => ({ key: k, value: JSON.parse(JSON.stringify(__STORE[k])) })); if (b.one) data = data[0] || null; }
        else if (tbl === 'aha_notes') data = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
        else if (tbl === 'mf_students') data = [{ mf_student_id: 'I1', name: '○○○', lumen_rec_code: 'AAA111' }];
        else if (tbl === 'mf_answer_records') data = [];
        return Promise.resolve({ data, error: null }).then(r, j); } }; return b; };
    window.__FAKE = { from: mk };
    getSupaClient = function () { return __FAKE; };
    supaSetItem = function (k, v) { __sets.push({ k, v: JSON.parse(JSON.stringify(v)) }); return Promise.resolve(true); };
    callAI = function (p) { __ai.push(p); return Promise.resolve('이번 달 새로 쓴 의견입니다.'); };
    apiKey = 'test-key-not-real';
    MR.month = ym; MR.data = {}; MR.t = 0; MR.req = null; MR.srcT = {}; MR.src = {};
    VIEW = 'mfrep'; render();
  });
  await pg.waitForTimeout(400);
  const row = (id) => P((id) => { const e = document.querySelector('.mr-row[data-rid="' + id + '"]'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; }, id);

  /* ① */
  const r1 = await row(101), r2 = await row(102), r3 = await row(103);
  t('① 101: 매쓰플랫 AI · 매쓰플랫 비공개 · 루멘(아직)', /매쓰플랫 AI/.test(r1) && /매쓰플랫 비공개/.test(r1) && /루멘/.test(r1) && !/루멘 ✓/.test(r1), r1.slice(0, 160));
  t('① 102: ✍ 루멘 데이터(mfrep_src) · 매쓰플랫 ✓ · 루멘 ✓', /✍ 루멘 데이터/.test(r2) && /매쓰플랫 ✓/.test(r2) && /루멘 ✓/.test(r2), r2.slice(0, 160));
  t('① 103: 루멘 코드 없음 · 의견 없음', /루멘 코드 없음/.test(r3) && /의견 없음/.test(r3), r3.slice(0, 160));
  const sum = await P(() => document.querySelector('.mr-sum').innerText.replace(/\s+/g, ' '));
  t('① 요약 — 매쓰플랫 공개 1 · 루멘 공개 1', /매쓰플랫 공개 1/.test(sum) && /루멘 공개 1/.test(sum), sum);

  /* ② */
  await P(() => mrOpen('101')); await pg.waitForTimeout(100);
  await P(() => document.querySelector('.mr-row[data-rid="101"] .mr-btn.lu').click()); await pg.waitForTimeout(500);
  const ai = await P(() => __ai.slice());
  t('② callAI 1번 · 프롬프트에 원장 프롬프트 · 매쓰플랫 숫자 · 숙제 90% · 아하 4개', ai.length === 1 && /원장 프롬프트 시험글/.test(ai[0]) && /푼 문항 1092개 · 정답률 79% · 전국 3등급/.test(ai[0]) && /숙제 이행도[^\n]*90%/.test(ai[0]) && /아하노트에 올린 질문: 4개/.test(ai[0]), (ai[0] || '').slice(-400));
  t('② 학생 이름은 프롬프트에 없음', ai[0] && !/○○○/.test(ai[0]), '');
  const r1b = await row(101);
  const ta = await P(() => (document.querySelector('.mr-row[data-rid="101"] textarea') || {}).value);
  t('② 새 글이 칸에 · ✍ 루멘 데이터 · 저장 전', ta === '이번 달 새로 쓴 의견입니다.' && /✍ 루멘 데이터/.test(r1b) && /저장 전/.test(r1b), r1b.slice(0, 160));
  await P(() => document.querySelector('.mr-row[data-rid="101"] .mr-tools .mr-btn:not(.lu)').click()); await pg.waitForTimeout(100);
  t('② ↩ 저장된 글로 → 원래 글 · 매쓰플랫 AI', (await P(() => document.querySelector('.mr-row[data-rid="101"] textarea').value)) === '매쓰플랫 AI 의견 글' && /매쓰플랫 AI/.test(await row(101)), '');

  /* ③ */
  await P(() => document.querySelector('.mr-row[data-rid="101"] .mr-btn.lu').click()); await pg.waitForTimeout(500);
  await P(() => { __sets.length = 0; mrSaveComments(); }); await pg.waitForTimeout(300);
  const S3 = await P(() => __sets.slice());
  const YM = await P(() => __ym); const req3 = S3.find((x) => x.k === 'mfrep_req'), src3 = S3.find((x) => x.k === 'mfrep_src_' + YM);
  t('③ mfrep_req comment — 101 새 글', req3 && req3.v.action === 'comment' && req3.v.items[0].reportId === 101 && req3.v.items[0].comment === '이번 달 새로 쓴 의견입니다.', JSON.stringify(req3 && req3.v).slice(0, 200));
  t('③ mfrep_src_<달> — 101 lu · 102 lu 그대로', src3 && src3.v.by['101'] === 'lu' && src3.v.by['102'] === 'lu', JSON.stringify(src3 && src3.v));

  /* ④ */
  const send = async (fn) => { await P(() => { MR.req = null; __sets.length = 0; }); await P(fn); await pg.waitForTimeout(200); return P(() => { const x = __sets.find((s) => s.k === 'mfrep_req'); return x ? x.v : null; }); };
  let q = await send(() => { MR.pick = { '101': 1, '103': 1 }; MR.sms = true; MR.tMf = true; MR.tLm = true; render(); document.getElementById('mr-pub').click(); });
  t('④ 공개(둘 다 · 문자) → {publish, ids 101·103, mf, lumen, sms}', q && q.action === 'publish' && JSON.stringify(q.ids) === '[101,103]' && q.mf === true && q.lumen === true && q.sms === true, JSON.stringify(q));
  q = await send(() => { MR.pick = { '101': 1 }; MR.sms = true; render(); document.getElementById('mr-t-mf').click(); document.getElementById('mr-pub').click(); });
  t('④ 매쓰플랫 끄면 → 루멘만 · 문자 false', q && q.mf === false && q.lumen === true && q.sms === false, JSON.stringify(q));
  q = await send(() => { MR.pick = { '101': 1 }; MR.tMf = false; MR.tLm = false; render(); document.getElementById('mr-pub').click(); });
  t('④ 둘 다 끄면 안 보냄', q === null, JSON.stringify(q));
  q = await send(() => { MR.pick = { '102': 1 }; MR.tMf = false; MR.tLm = true; render(); document.getElementById('mr-unpub').click(); });
  t('④ 공개 취소(루멘만) → {unpublish, mf false, lumen true}', q && q.action === 'unpublish' && q.mf === false && q.lumen === true && JSON.stringify(q.ids) === '[102]', JSON.stringify(q));

  /* ⑤ ⑥ */
  t('⑤ 예전 📊 월간보고서 탭(mfmonth) 메뉴에서 빠짐', await P(() => !document.documentElement.outerHTML.includes("v:'mfmonth'")), '');
  t('⑥ APP_VER v19-184', (await P(() => APP_VER)) === 'v19-184', '');
  t('⑥ 페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
