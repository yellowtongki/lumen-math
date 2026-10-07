#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📗 매쓰플랫 「교과서 문제 은행」 수집기 → lumen_store 'mf_textbook_<교과서id>'
 * ═══════════════════════════════════════════════════════════════════
 * 원장 결정 2026-09-24: 학생별 약점 문제집에 기출 1 + 교과서 원문항 2 + 쌍둥이 1. 옥길중 1·2·3 부터.
 *   학교별 교과서는 매쓰플랫의 학생 배정(mf_textbooks, sync/mf_textbook_map.js)에서 읽는다.
 *
 * 어떻게 (mf_book_toc.js 와 같은 길)
 *   ① 그 교과서를 가진 학생 한 명 → GET /student-workbook/student/{sid}?workbookType=SCHOOL → swId·revId
 *   ② GET /student-workbook/student/{sid}/{swId}/{revId}?size=2000 → 쪽 목록(쪽 번호·쪽 제목 = 소단원)
 *   ③ 쪽마다 GET /workbook/{bid}/page/{pid}?size=300 → 문항: id·번호·유형 번호(conceptId)·난이도·그림·정답
 *   ④ (--twins) 문항마다 쌍둥이(숫자 변형) 문항을 받아 둔다 — 낮에 학원앱이 매쓰플랫에 가지 않도록 미리
 *
 * 저장
 *   mf_textbook_<bid> = { bid, title, updated, pages:[{page,pid,title}], problems:[{ id, page, no, title, cid, topic, level, type, auto, pimg, aimg, answer, twins:[{id,pimg,aimg,answer,level}] }] }
 *   학생 이름·기록은 넣지 않는다. 그림은 매쓰플랫 주소 그대로(공개 CDN) — 학생앱에는 띄우지 않는다.
 *
 * 쓰는 법
 *   node sync/mf_textbook_bank.js --school 옥길중            학교의 배정 교과서 전부
 *   node sync/mf_textbook_bank.js --bids 2110004,2110005    특정 교과서
 *   옵션: --twins  쌍둥이까지 · --pages 120-190  그 쪽만 · --dry-run  저장 안 함 · --limit N  앞 N쪽만
 * ═══════════════════════════════════════════════════════════════════ */
const API = 'https://api.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SKEY = process.env.SUPABASE_SERVICE_KEY;
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;
if (!SB || !SKEY) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
if (!ID || !PW) { console.error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 필요합니다'); process.exit(1); }
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const OPT = { school: val('--school', ''), bids: String(val('--bids', '')).split(',').map((s) => s.trim()).filter(Boolean),
  twins: has('--twins'), dry: has('--dry-run'), limit: Number(val('--limit', 0)) || 0, pages: val('--pages', ''),
  assigned: has('--assigned'), skipDone: has('--skip-done') };
/* --assigned : 활동 학생에게 배정된 «모든» 교재(교과서·시중교재·시그니처·커스텀)를 전부 (2026-09-24 아하노트 ↔ 정오답 연동용:
 *              아하노트의 교재·쪽·번호를 매쓰플랫 문항 id 로 바꾸려면 시중교재의 쪽·번호 표가 필요하다)
 * --skip-done: 이미 서버에 있는 교재는 건너뛴다 */
const sbH = { apikey: SKEY, authorization: `Bearer ${SKEY}`, 'content-type': 'application/json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

let TOKEN = '';
const mfH = () => ({ 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) });
async function login() {
  /* 토큰이 만료돼 다시 로그인할 때 401 이 한 번씩 난다(2026-09-24 실측) → 5초·20초·60초 쉬고 세 번까지 다시 */
  const waits = [0, 30000, 120000, 300000, 600000]; let last = '';   /* 2026-09-24: 60초로는 모자랐다(401 세 번) → 30초·2분·5분·10분 */
  for (let i = 0; i < waits.length; i++) {
    if (waits[i]) await sleep(waits[i]);
    const res = await fetch(`${API}/v2/login`, { method: 'POST', headers: mfH(), body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
    const j = await res.json().catch(() => null);
    if (res.ok && j && j.accessToken) { TOKEN = j.accessToken; return; }
    last = String(res.status); log(`  로그인 ${last} — 다시 시도 ${i + 1}/${waits.length - 1}`);
  }
  throw new Error('매쓰플랫 로그인 실패: ' + last);
}
async function api(p, body, _retried) {
  const res = await fetch(`${API}${p}`, body ? { method: 'POST', headers: mfH(), body: JSON.stringify(body) } : { headers: mfH() });
  const text = await res.text(); let j = null; try { j = JSON.parse(text); } catch (_) {}
  if (res.status === 401 && !_retried) { await login(); return api(p, body, true); }
  if (!res.ok) throw new Error(`${res.status} ${(j && j.code) || ''} @ ${p}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}
async function sbGet(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH });
  if (!r.ok) return null; const j = await r.json(); let v = (j[0] || {}).value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) {} } return v === undefined ? null : v;
}
async function sbSet(key, value) {
  if (OPT.dry) { log(`[dry-run] ${key} 저장 생략 (${Math.round(JSON.stringify(value).length / 1024)}KB)`); return true; }
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...sbH, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
  return r.ok;
}
const img = (o) => (o && (o.url || o.imageUrl)) || null;

/* 쌍둥이(숫자 변형·유사) 문항 — 매쓰플랫 학습지 만들기의 「쌍둥이·유사」와 같은 요청.
 * 요청 모양은 선생님 웹 번들에서 확인한 것을 쓰고, 안 되면 빈 배열을 두고 넘어간다(은행은 그대로 쓸 수 있다). */
async function twinsOf(problemId) {
  const tries = [
    () => api(`/problem/${problemId}/similar?size=3`),
    () => api('/v2/worksheet/filter/similar', { problemIds: [problemId], similarX: 1, similarLevel: 'AS_IS' }),
  ];
  for (const t of tries) {
    try { const r = await t(); const arr = Array.isArray(r) ? r : ((r && (r.content || r.problems || r.list)) || []);
      if (arr.length) return arr.slice(0, 3).map((p) => ({ id: p.id, pimg: img(p.problem || p.exampleProblem) || p.problemImageUrl || null, aimg: p.answerImageUrl || null, answer: p.answer || null, level: p.level || null, cid: p.conceptId || null }));
    } catch (_) {}
  }
  return [];
}

(async () => {
  await login(); log('매쓰플랫 로그인 OK');
  const T = (await sbGet('mf_textbooks')) || { books: {}, byStudent: {}, bySchoolGrade: {} };
  let bids = OPT.bids.slice();
  const ALLB = {};   // --assigned: bid → { title, type, sid, swId, revId }
  if (OPT.assigned) {
    const d = await api('/students?size=500'); const stus = ((d && d.content) || []).filter((s) => s.status === 'ACTIVE');
    for (const st of stus) { let l = null; try { l = await api(`/student-workbook/student/${st.id}?workbookType=ALL`); } catch (e) { continue; }
      (Array.isArray(l) ? l : ((l && l.content) || [])).forEach((b) => { const k = String(b.id); if (!ALLB[k] && b.studentWorkbook && b.recentRevisionId) ALLB[k] = { title: (b.fulltitle || b.title || '').trim(), type: b.type || '', sid: st.id, swId: b.studentWorkbook.id, revId: b.recentRevisionId }; });
      await sleep(50); }
    Object.keys(ALLB).forEach((k) => { if (bids.indexOf(k) < 0) bids.push(k); });
    log(`배정된 교재 ${Object.keys(ALLB).length}종 (학생 ${stus.length}명)`);
    if (OPT.skipDone) { const idx = (await sbGet('mf_bookbank_index')) || {}; bids = bids.filter((b) => !idx[b]); log(`  이미 받은 것 빼고 ${bids.length}종`); }
  }
  if (OPT.school) Object.keys(T.bySchoolGrade || {}).forEach((k) => { if (k.split('|')[0] === OPT.school) Object.keys(T.bySchoolGrade[k].books).forEach((b) => { if (bids.indexOf(b) < 0) bids.push(b); }); });
  if (!bids.length) { log('교과서가 없습니다 — --school 또는 --bids'); process.exit(1); }
  log(`교과서 ${bids.length}권: ${bids.map((b) => (T.books[b] || {}).fulltitle || b).join(' · ')}`);
  const range = OPT.pages ? OPT.pages.split('-').map(Number) : null;

  for (const bid of bids) {
    const meta = T.books[bid] || {};
    let sid, swId, revId, b = null;
    if (ALLB[bid]) { sid = ALLB[bid].sid; swId = ALLB[bid].swId; revId = ALLB[bid].revId; b = { fulltitle: ALLB[bid].title, type: ALLB[bid].type }; }
    else {
      sid = Object.keys(T.byStudent).find((s) => (T.byStudent[s].books || []).indexOf(bid) >= 0);
      if (!sid) { log(`  [${bid}] 배정된 학생이 없어 쪽 목록을 못 엽니다`); continue; }
      const list = await api(`/student-workbook/student/${sid}?workbookType=ALL`);
      b = (Array.isArray(list) ? list : (list.content || [])).find((x) => String(x.id) === String(bid));
      if (!b || !b.studentWorkbook) { log(`  [${bid}] 학생 교재함에 없음`); continue; }
      swId = b.studentWorkbook.id; revId = b.recentRevisionId;
    }
    const det = await api(`/student-workbook/student/${sid}/${swId}/${revId}?size=2000`);
    let pages = ((det && det.page && det.page.content) || []).map((pg) => ({ pid: pg.workbookPage.id, page: pg.workbookPage.page, title: pg.workbookPage.title || '' })).filter((p) => p.pid && p.page != null);
    pages.sort((x, y) => x.page - y.page);
    if (range) pages = pages.filter((p) => p.page >= range[0] && p.page <= range[1]);
    if (OPT.limit) pages = pages.slice(0, OPT.limit);
    log(`  [${bid}] ${meta.fulltitle || b.fulltitle || ''} — ${pages.length}쪽`);
    const problems = []; let fail = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i]; let arr = null;
      try { const r = await api(`/workbook/${bid}/page/${p.pid}?size=300`); arr = Array.isArray(r) ? r : ((r && r.content) || []); }
      catch (e) { fail++; await sleep(300); try { const r = await api(`/workbook/${bid}/page/${p.pid}?size=300`); arr = Array.isArray(r) ? r : ((r && r.content) || []); fail--; } catch (_) { continue; } }
      arr.forEach((q) => {
        problems.push({ id: q.id, page: p.page, no: String(q.number || ''), title: q.title || p.title || '', cid: q.conceptId || null, topic: q.topicId || null,
          level: q.level || null, type: q.type || null, auto: q.autoScoredType || null, pimg: img(q.problem) || img(q.exampleProblem) || null, aimg: q.answerImageUrl || null,
          answer: (q.answer && q.answer !== '.') ? String(q.answer).slice(0, 80) : null, twins: [] });
      });
      if ((i + 1) % 25 === 0) process.stdout.write(`    …${i + 1}/${pages.length}쪽 · 문항 ${problems.length}\r`);
      await sleep(70);
    }
    log(`  [${bid}] 문항 ${problems.length}개 (쪽 ${pages.length} · 실패 ${fail}) · 유형 ${new Set(problems.map((q) => q.cid).filter(Boolean)).size}개`);
    if (OPT.twins) {
      let got = 0;
      for (let i = 0; i < problems.length; i++) { problems[i].twins = await twinsOf(problems[i].id); if (problems[i].twins.length) got++; if ((i + 1) % 50 === 0) process.stdout.write(`    쌍둥이 …${i + 1}/${problems.length} (있음 ${got})\r`); await sleep(60); }
      log(`  [${bid}] 쌍둥이 있는 문항 ${got}/${problems.length}`);
    }
    const ok = await sbSet(`mf_textbook_${bid}`, { bid, title: meta.fulltitle || b.fulltitle || '', type: (b && b.type) || meta.type || '', updated: new Date().toISOString(), pages, problems });
    log(ok ? `  저장: mf_textbook_${bid}` : `  저장 실패: mf_textbook_${bid}`);
    if (ok && !OPT.dry) { try { const idx = (await sbGet('mf_bookbank_index')) || {}; idx[bid] = { title: meta.fulltitle || b.fulltitle || '', type: (b && b.type) || meta.type || '', pages: pages.length, problems: problems.length, updated: new Date().toISOString() }; await sbSet('mf_bookbank_index', idx); } catch (e) {} }
  }
  log('끝');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
