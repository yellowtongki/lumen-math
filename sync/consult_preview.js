#!/usr/bin/env node
/* 📋 상담 리포트 미리보기 — 실제 학생 한 명의 기록을 서버에서 «읽기만» 해서, 학원앱(v19-161~)의 상담 리포트 함수로 그대로 그린 HTML 을 만든다.
 *   쓰기 없음: 브라우저 안 서버 연결은 가짜이고, 저장(supaSetItem)은 막는다.
 *   실행: NODE_PATH=/opt/node22/lib/node_modules NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *         SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node sync/consult_preview.js lumen_v19-161.html <학생코드> <결과.html> [개월=3]
 *   ⚠ 결과 html 에는 실명·점수가 들어 있다 → 세션 임시 폴더(scratchpad)에만 두고 저장소에 올리지 않는다. 원장님께는 비공개 artifact 로.
 *   결과에는 «🔒 원장님 메모»도 붙는다(학원앱 인쇄본에는 빠지는 칸). */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [APP, CODE, OUT, MON] = process.argv.slice(2);
if (!APP || !CODE || !OUT) { console.error('사용법: node sync/consult_preview.js <학원앱.html> <학생코드> <결과.html> [개월]'); process.exit(1); }
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('SUPABASE_URL · SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function get(q){ const r = await fetch(URL + '/rest/v1/' + q, { headers: H }); if (!r.ok) throw new Error(q.split('?')[0] + ' ' + r.status); return r.json(); }
async function store(keys){ const rows = await get('lumen_store?select=key,value&key=in.(' + keys.map(encodeURIComponent).join(',') + ')'); const o = {};
  rows.forEach((r) => { let v = r.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} } o[r.key] = v; }); return o; }
(async () => {
  const months = +MON || 3;
  const S = await store(['or_studentdb', 'mf_progress', 'mf_books', 'bp_config', 'mf_weekly', 'lumen_group_days', 'hw_scores_' + CODE]);
  const db = S.or_studentdb; const arr = Array.isArray(db) ? db : (db.students || db.list || Object.values(db));
  const stu = arr.find((x) => x && String(x.lumen_rec_code) === CODE); if (!stu) throw new Error('등록부에 없는 학생 코드');
  const mfs = await get('mf_students?select=mf_student_id,name,lumen_rec_code&lumen_rec_code=eq.' + CODE); if (!mfs.length) throw new Error('매쓰플랫 연결 없음');
  const from = new Date(Date.now() + 9 * 3600e3 - (Math.round(months * 30.44) + 14) * 86400e3).toISOString().slice(0, 10);
  let recs = []; for (let off = 0; off < 50000; off += 1000) {
    const r = await get('mf_answer_records?select=source,book_id,result,score_datetime,worksheet_title,student_worksheet_id&mf_student_id=eq.' + mfs[0].mf_student_id + '&score_datetime=gte.' + from + 'T00:00:00&order=score_datetime.asc&limit=1000&offset=' + off);
    recs = recs.concat(r); if (r.length < 1000) break; }
  const aha = await get('aha_notes?select=created_at&student_code=eq.' + CODE);
  const D = { stu, books: (S.mf_books || {}).books || {}, prog: (S.mf_progress || {}).byStudent || {}, cfg: S.bp_config || {}, weekly: (S.mf_weekly || {}).tests || [], gd: S.lumen_group_days || {},
    hws: (S['hw_scores_' + CODE] || {}).items || {}, recs, aha, mfs, code: CODE, months };
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const pg = await br.newPage({ viewport: { width: 1400, height: 1000 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + path.resolve(APP)); await pg.waitForTimeout(2500);
  const html = await pg.evaluate(async (D) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    window.__STORE = {}; window.__STORE['hw_scores_' + D.code] = { items: D.hws }; window.__TABLES = { mf_answer_records: D.recs, aha_notes: D.aha };
    window.getSupaClient = function(){ return { from(tb){ const o = { _t: tb, _k: null, _r: null, in(c, ks){ o._k = ks; return p; }, eq(c, k){ if (c === 'key') o._k = [k]; return p; }, range(a, z){ o._r = [a, z]; return p; },
      then(res, rej){ let data; if (o._t === 'lumen_store') data = (o._k || []).filter((k) => k in window.__STORE).map((k) => ({ key: k, value: window.__STORE[k] })); else { data = window.__TABLES[o._t] || []; if (o._r) data = data.slice(o._r[0], o._r[1] + 1); } return Promise.resolve({ data, error: null }).then(res, rej); } };
      const p = new Proxy(o, { get(tg, k){ if (k in tg) return tg[k]; return function(){ return p; }; } }); return p; } }; };
    window.supaSetItem = function(){ return Promise.resolve(false); };
    BP.books = D.books; BP.prog = D.prog; BP.mfList = D.mfs; BP.cfg = { def: Number(D.cfg.def) || 3, months: D.cfg.months || {}, pages: D.cfg.pages || {}, rep: D.cfg.rep || {}, done: D.cfg.done || {}, starts: D.cfg.starts || {}, hiSem: D.cfg.hiSem !== false }; BP.loaded = true;
    WK.tests = D.weekly; WK.loaded = true; Object.keys(D.gd).forEach((k) => { groupDays[k] = D.gd[k]; });
    students.length = 0; students.push(D.stu);
    CR.code = D.code; CR.months = D.months; CR.data = null; CR.err = ''; await crLoad();
    if (CR.err) return 'ERR ' + CR.err;
    const X = crCompute(); let h = crReport(X, 'print');
    const memo = '<section class="cr-memo"><b>🔒 원장님만 보는 상담 준비 메모</b> <span style="color:#5f6b80;font-size:12px">— 학원앱 화면에만 보이고 인쇄·PDF 에는 빠집니다</span><ul>' + X.memo.map((m) => '<li>' + m + '</li>').join('') + '</ul></section>';
    return '<style>' + CR_CSS + 'body{background:#eef1f5;padding-block:16px 40px;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}</style>' + h.replace('<div class="cr-foot">', memo + '<div class="cr-foot">');
  }, D);
  await br.close();
  if (/^ERR /.test(html)) { console.error(html); process.exit(1); }
  fs.writeFileSync(OUT, '<title>' + stu.name + ' 학습 상담 리포트</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap">\n' + html);
  console.log('만듦 → ' + OUT + ' · 문항 기록 ' + recs.length + '개' + (errs.length ? ' · 페이지 오류 ' + errs.slice(0, 2).join(' | ') : ''));
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
