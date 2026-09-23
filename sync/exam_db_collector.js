#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 📚 기출 DB 수집기 — 수학비서 기준 (2026-09-23, docs/exam_prep_contract.md §8)
 *
 * 원장 결정: 「단원·유형 기준은 수학비서. 기출은 수학비서에 많다. 이미지 넣어도 된다.
 *            새벽에만. 옥길중부터. 우리 학원이 다루는 학교는 옥길중·범박중·범박고·소사고」
 *
 * 무엇을 하나
 *   A. 수학비서 「나만의 DB」에서 학교 폴더의 기출 시험지를 문항 단위로 받는다
 *      — 단원 경로(5단계)·유형 태그·정답·난이도·배점·서술형·예상 풀이시간·시험 범위(scopes)
 *      — 문항 이미지는 CDN 서명 쿠키로 내려받아 Supabase Storage 「exam_images」(비공개)에 넣는다
 *      → lumen_store  ms_exams_<학교>   { school, updated, exams:[…] }
 *   B. --bridge : 매쓰플랫이 같은 기출을 «원본 학습지»로 인식해 둔 것(twin_done · exam_ws_map)에서
 *      문항별 매쓰플랫 유형(conceptId)·난도·문제/정답/풀이 그림 주소를 받는다
 *      → lumen_store  ms_exam_bridge    { updated, byMydb:{ <수학비서 시험지id>: { ws, problems:[…] } } }
 *      ⚠️ 매쓰플랫은 동시 로그인 시 원장님 접속이 끊긴다 — B 는 새벽에만 (워크플로가 지킨다)
 *
 * 사용법
 *   node sync/exam_db_collector.js --schools 옥길중                 # A (수학비서만)
 *   node sync/exam_db_collector.js --schools 옥길중,범박고 --bridge  # A + B (새벽)
 *   옵션: --no-images  이미지 생략 · --bridge-only  B 만 · --dry-run  저장 안 함 · --limit 3  앞에서 N장만
 *
 * 환경변수: MATHSECR_ID/PASSWORD · SUPABASE_URL/SUPABASE_SERVICE_KEY · (--bridge) MATHFLAT_ID/PASSWORD
 * 규칙: 비밀번호·키는 환경변수만. 학생 이름·코드는 여기 없다. 로그에 시험 제목만 남긴다.
 * ═══════════════════════════════════════════════════════════════════ */
const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const MF_API = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'exam_images';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const SCHOOLS = String(arg('schools', '옥길중')).split(',').map((s) => s.trim()).filter(Boolean);
const BRIDGE = args.includes('--bridge') || args.includes('--bridge-only');
const BRIDGE_ONLY = args.includes('--bridge-only');
const NO_IMG = args.includes('--no-images');
const DRY = args.includes('--dry-run');
const LIMIT = Number(arg('limit', 0)) || 0;

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Supabase ─────────────────────────────────────────────── */
const sbH = (extra) => Object.assign({ apikey: SK, authorization: 'Bearer ' + SK }, extra || {});
async function sbGet(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  const j = await r.json(); let v = j && j[0] ? j[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
async function sbPut(key, value) {
  if (DRY) { log(`[dry-run] ${key} 저장 생략 (${Math.round(JSON.stringify(value).length / 1024)}KB)`); return; }
  const now = new Date().toISOString();
  const r = await fetch(`${SB}/rest/v1/lumen_store`, { method: 'POST',
    headers: sbH({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ key, value, updated_at: now }) });
  if (!r.ok) throw new Error(`${key} 저장 실패 ${r.status} ${(await r.text()).slice(0, 120)}`);
  log(`저장: ${key} (${Math.round(JSON.stringify(value).length / 1024)}KB)`);
}
async function sbEnsureBucket() {
  const r = await fetch(`${SB}/storage/v1/bucket`, { method: 'POST', headers: sbH({ 'content-type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, file_size_limit: 5242880 }) });
  if (r.ok) { log(`Storage 버킷 만듦: ${BUCKET} (비공개)`); return; }
  const t = await r.text();
  if (r.status === 409 || /already exists|Duplicate/i.test(t)) return;
  throw new Error(`버킷 확인 실패 ${r.status} ${t.slice(0, 120)}`);
}
async function sbExists(path) {
  const r = await fetch(`${SB}/storage/v1/object/info/${BUCKET}/${path}`, { headers: sbH() });
  return r.ok;
}
async function sbUpload(path, buf, type) {
  const r = await fetch(`${SB}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST',
    headers: sbH({ 'content-type': type || 'image/png', 'x-upsert': 'true' }), body: buf });
  if (!r.ok) throw new Error(`업로드 ${r.status} ${(await r.text()).slice(0, 100)}`);
}

/* ── 수학비서 ─────────────────────────────────────────────── */
let MS_TOKEN = null, MS_CDN_COOKIE = null;
const msH = () => ({ accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }) });
  const j = await r.json().catch(() => null);
  MS_TOKEN = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!r.ok || !MS_TOKEN) throw new Error(`수학비서 로그인 실패 ${r.status}`);
}
async function msGet(p, retried) {
  const r = await fetch(`${MS_API}${p}`, { headers: msH() });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
  const hit = sc.find((c) => c && c.includes('Cloud-CDN-Cookie'));
  if (hit) MS_CDN_COOKIE = hit.split(';')[0];     /* 문항 이미지 열쇠 (약 78분 유효) */
  /* 토큰이 10분쯤 지나면 401 이 난다(첫 실행에서 13장 놓침) — 다시 로그인하고 한 번 더 */
  if (r.status === 401 && !retried) { await msLogin(); log('  (토큰 갱신)'); return msGet(p, true); }
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return j;
}
async function msListMydbs() {
  const all = []; let cursor = '';
  for (let i = 0; i < 60; i++) {
    const j = await msGet(`/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const items = (j.data && j.data.mydbs) || []; all.push(...items);
    cursor = j.pagination && j.pagination.cursor; if (!cursor || !items.length) break;
  }
  return all;
}
/* 학교 폴더(예: 「옥길중」)와 그 아래 폴더들의 id — 폴더 이름은 원장님이 수학비서에 지은 그대로 */
async function msFolderIds(school) {
  const j = await msGet('/bms/api/v1/folders?folderType=mydb');
  const roots = Array.isArray(j.data) ? j.data : [j.data];
  const ids = new Set();
  (function walk(f, inSchool) {
    if (!f) return;
    const now = inSchool || (String(f.name || '').replace(/\s/g, '') === school.replace(/\s/g, ''));
    if (now && f.id) ids.add(f.id);
    (f.children || []).forEach((c) => walk(c, now));
  })({ name: '', children: roots }, false);
  return ids;
}
function parseTitle(t) {
  return {
    year: (t.match(/(20\d\d)년/) || [])[1] || null,
    grade: (t.match(/(중[1-3]|고[1-3])/) || [])[1] || null,
    semester: (t.match(/([12])학기/) || [])[1] || null,
    term: /중간/.test(t) ? '중간' : (/기말/.test(t) ? '기말' : null),
  };
}
async function msExam(id) {
  const det = (await msGet(`/bms/api/v1/mydbs/${id}`)).data;
  const cells = []; let cursor = '';
  for (let i = 0; i < 10; i++) {
    const j = await msGet(`/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    ((j.data && j.data.pages) || []).forEach((pg) => (pg.cells || []).forEach((c) => cells.push({ ...c, _page: pg.pageNumber })));
    cursor = j.pagination && j.pagination.cursor; if (!cursor) break;
  }
  let scores = []; try { scores = ((await msGet(`/bms/api/v1/mydbs/${id}/scores`)).data || {}).questionScores || []; } catch (e) {}
  const scoreMap = {}; scores.forEach((s) => { scoreMap[`${s.pageNumber}|${s.questionNumber}`] = s; });
  const slim = cells.map((c) => {
    const a = (c.answers && c.answers[0]) || {}; const sc = scoreMap[`${c._page}|${c.questionNumber}`] || {};
    const my = (c.myDbInfos && c.myDbInfos[0]) || {};
    return {
      no: c.questionNumber, page: c._page,
      score: (my.scores && my.scores[0]) != null ? my.scores[0] : (sc.score != null ? sc.score : null),
      answerType: a.type || sc.answerType || null,
      answer: a.latex || (a.answer && a.answer.join(',')) || null,
      difficulty: (a.difficulty && a.difficulty.mathSecr) != null ? a.difficulty.mathSecr : (sc.difficulty != null ? sc.difficulty : null),
      solvingTime: (a.solvingTime && a.solvingTime.mathSecr) || null,
      chapters: (c.chapters && c.chapters[0] && c.chapters[0].chapter) || [],
      tags: (c.adaptiveTags || []).map((t) => t.name),
      imgUrl: c.imagePath || null,
    };
  }).sort((x, y) => x.no - y.no);
  return Object.assign({ id, title: det.title, questionCount: det.questionCount, difficultyCount: det.difficultyCount,
    averageDifficulty: det.averageDifficulty, sourcePath: det.sourcePath || null,   /* 2026-09-23: 출처 경로(연도 › 내신 시험 › 경기도 › 부천시 › 학교 › 학년 › 시험) — 인쇄물 「출제」 칸 */
    cells: slim }, parseTitle(det.title || ''));
}
async function msImage(url) {
  const r = await fetch(url, { headers: { cookie: MS_CDN_COOKIE || '', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' } });
  if (!r.ok) throw new Error(`이미지 ${r.status}`);
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' };
}

/* ── A. 학교 하나 ─────────────────────────────────────────── */
async function collectSchool(school, allMydbs) {
  const fids = await msFolderIds(school);
  if (!fids.size) { log(`⚠️ ${school}: 수학비서에 그 이름의 폴더가 없습니다 — 건너뜀`); return null; }
  let targets = allMydbs.filter((m) => fids.has(m.folderId) && m.dbStatus === 'dbCompleted');
  log(`${school}: DB화 완료 ${targets.length}장 (폴더 안 전체 ${allMydbs.filter((m) => fids.has(m.folderId)).length}장)`);
  if (LIMIT) targets = targets.slice(0, LIMIT);
  const prev = (await sbGet('ms_exams_' + school)) || { exams: [] };
  const prevById = {}; (prev.exams || []).forEach((e) => { prevById[String(e.id)] = e; });
  const exams = [];
  let imgOk = 0, imgSkip = 0, imgFail = 0;
  for (const t of targets) {
    try {
      const ex = await msExam(t.id);
      ex.scopes = t.scopes || null;   /* 시험 범위(단원) — 목록 응답에만 있다 */
      ex.folder = t.folderName || null;
      const old = prevById[String(ex.id)];
      for (const c of ex.cells) {
        const key = `${ex.id}/${String(c.no).padStart(2, '0')}.png`;
        const oc = old && (old.cells || []).find((x) => x.no === c.no);
        if (NO_IMG || !c.imgUrl) { c.img = oc && oc.img ? oc.img : null; continue; }
        if (oc && oc.img) { c.img = oc.img; imgSkip++; continue; }   /* 이미 올렸다 */
        try {
          if (!DRY) { const im = await msImage(c.imgUrl); await sbUpload(key, im.buf, im.type); }
          c.img = key; imgOk++;
        } catch (e) { c.img = null; imgFail++; }
        await sleep(120);
      }
      ex.cells.forEach((c) => { delete c.imgUrl; });   /* CDN 원주소는 저장하지 않는다(서명 필요·회원 전용) */
      exams.push(ex);
      log(`  [${ex.id}] ${ex.title} — ${ex.cells.length}문항`);
    } catch (e) { log(`  ⚠️ [${t.id}] 실패: ${e.message}`); }
  }
  /* 이번에 못 받은 옛 시험지는 지우지 않고 남긴다 */
  (prev.exams || []).forEach((e) => { if (!exams.some((x) => String(x.id) === String(e.id)) && !LIMIT) exams.push(e); });
  exams.sort((a, b) => String(a.grade).localeCompare(String(b.grade)) || String(b.year).localeCompare(String(a.year)) || String(a.title).localeCompare(String(b.title)));
  const val = { school, updated: new Date().toISOString(), exams, imgs: { ok: imgOk, skip: imgSkip, fail: imgFail } };
  await sbPut('ms_exams_' + school, val);
  log(`${school}: 시험지 ${exams.length}장 · 문항 ${exams.reduce((s, e) => s + e.cells.length, 0)}개 · 이미지 새로 ${imgOk} · 있던 것 ${imgSkip} · 실패 ${imgFail}`);
  return val;
}

/* ── B. 매쓰플랫 다리 ─────────────────────────────────────── */
let MF_TOKEN = null;
const mfH = () => ({ accept: 'application/json', authorization: `Bearer ${MF_TOKEN}`, 'x-platform': 'TEACHER_WEB',
  'x-freewheelin-host': 'mathflat.com', origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' });
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json(); if (!r.ok || !j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
async function mfApi(p) {
  const r = await fetch(`${MF_API}${p}`, { headers: mfH() }); const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (_) {}
  if (!r.ok) throw new Error(`${r.status} @ ${p}`);
  return j ? (j.data !== undefined ? j.data : j) : null;
}
async function mfWorksheet(wsId) {
  const head = await mfApi(`/worksheet/${wsId}`);
  const d = await mfApi(`/worksheet/${wsId}/problem?size=300`);
  const rows = (d && d.content) || [];
  const problems = rows.map((c, i) => {
    const p = c.problem || c;
    return { no: i + 1, problemId: p.id, wpId: c.worksheetProblemId || p.id,
      conceptId: p.conceptId != null ? p.conceptId : (p.concept && p.concept.id != null ? p.concept.id : null),
      concept: p.conceptName || (p.concept && p.concept.name) || '',
      topicId: p.topicId != null ? p.topicId : null, level: p.level || null,
      answer: p.answer != null ? String(p.answer) : '', type: p.type || '',
      pimg: p.problemImageUrl || '', aimg: p.answerImageUrl || '', simg: p.solutionImageUrl || '' };
  });
  return { ws: Number(wsId), title: (head && head.title) || '', chapter: (head && head.chapter) || '', fetched: new Date().toISOString(),
    rawKeys: rows[0] ? Object.keys(rows[0].problem || rows[0]).slice(0, 40) : [], problems };
}
async function bridge(schoolVals) {
  const done = ((await sbGet('twin_done')) || {}).byMydb || {};
  const wsmap = ((await sbGet('exam_ws_map')) || {}).exams || {};
  const prev = (await sbGet('ms_exam_bridge')) || { byMydb: {} };
  const byMydb = Object.assign({}, prev.byMydb || {});
  const want = [];
  schoolVals.forEach((v) => (v && v.exams || []).forEach((e) => {
    const id = String(e.id);
    const ws = (done[id] && done[id].wsOriginal) || (wsmap[id] && wsmap[id].worksheetId) || null;
    if (ws && !(byMydb[id] && byMydb[id].ws === Number(ws) && (byMydb[id].problems || []).length)) want.push({ id, ws, title: e.title });
  }));
  log(`다리: 받을 시험지 ${want.length}장 (이미 있는 것 ${Object.keys(byMydb).length}장)`);
  if (!want.length) return;
  await mfLogin(); log('매쓰플랫 로그인 OK');
  let n = 0;
  for (const w of want) {
    try {
      const r = await mfWorksheet(w.ws);
      byMydb[w.id] = r; n++;
      const withC = r.problems.filter((p) => p.conceptId != null).length;
      log(`  [${w.id}] ${w.title} → 학습지 ${w.ws} · ${r.problems.length}문항 · 유형 번호 있는 것 ${withC}`);
      if (n === 1) log(`  (문항 필드: ${r.rawKeys.join(',')})`);
    } catch (e) { log(`  ⚠️ [${w.id}] ${e.message}`); }
    await sleep(200);
  }
  await sbPut('ms_exam_bridge', { updated: new Date().toISOString(), byMydb });
}

/* ── 실행 ─────────────────────────────────────────────────── */
(async () => {
  if (!SB || !SK) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다');
  const vals = [];
  if (!BRIDGE_ONLY) {
    if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('MATHSECR_ID/PASSWORD 가 없습니다');
    await msLogin(); log('수학비서 로그인 OK');
    if (!NO_IMG && !DRY) await sbEnsureBucket();
    const all = await msListMydbs(); log(`나만의 DB 전체 ${all.length}장`);
    for (const s of SCHOOLS) vals.push(await collectSchool(s, all));
  } else {
    for (const s of SCHOOLS) vals.push(await sbGet('ms_exams_' + s));
  }
  if (BRIDGE) {
    if (!process.env.MATHFLAT_ID || !process.env.MATHFLAT_PASSWORD) throw new Error('MATHFLAT_ID/PASSWORD 가 없습니다 (--bridge)');
    await bridge(vals);
  }
  log('끝');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
