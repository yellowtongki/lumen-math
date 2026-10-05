#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🎯 적중 분석 워커 — 시험지 ↔ 우리 자료 직접 대조 (docs/exam_hit_contract.md)
 * ═══════════════════════════════════════════════════════════════════
 * 원장 결정 2026-10-04: 시범 옥길중 중1 · 적중 기준은 화면에서 고른다 · 블로그는 .md 자료로 넘긴다.
 *
 * 흐름
 *   ① 시험지 — 학원앱이 올린 사진·PDF(aha_photos 의 임시 자리 → exam_images/hit/… 비공개로 옮기고 지운다)
 *              또는 --mydb <수학비서 시험지 id> (ms_exams 에 있으면 그 그림, 없으면 기출 DB 에서 바로 받는다 — 2026-10-05)
 *   ② 문항 나누기 — 매쓰플랫 AI(document-processing-flow → analysis-flow): 문항 상자 그림 · 유형(cid) · 난도 ·
 *              가장 닮은 원본(sourceProblemId: p=문제은행 · b=교재 · s=기출, sourceWorkbookId)
 *   ③ 우리 자료 — 그 학교·학년 학생들이 이번 학기 매쓰플랫에서 푼 학습지·교재 문항 전부(mf_answer_records)
 *              + 학원앱에서 올린 우리 프린트(②와 같은 인식)
 *   ④ 후보 — 문항마다 «원본 번호가 같은 것»과 «유형 번호가 같은 것»만 추려(최대 6) Claude 가 그림을 보고
 *              같은 문제 / 변형 / 지문만 겹침 / 아님 을 가른다. 유형 번호만 같으면 「유형」.
 *   ⑤ 반복 출제 — 같은 학교·학년·학기·중간/기말 지난 기출(ms_exam_bridge 의 유형 번호)과 겹치는 것
 *   ⑥ 저장 — lumen_store exam_hit_<examId> + exam_hit_index. 확정(✓/✗)은 원장님이 학원앱에서.
 *
 * 실행
 *   node sync/exam_hit_worker.js                       요청(exam_hit_req) 확인 → 있으면 처리 (5분마다 워크플로)
 *   node sync/exam_hit_worker.js --mydb 387569 --school 옥길중 --grade 중1 [--year 2025 --semester 2 --term 중간]
 *        [--from 2026-07-01 --to 2026-10-01]   우리 자료 기간 (기본: 그 학기 시작 ~ 시험일)
 *        [--exam-id 이름]  [--no-ai]  [--dry]
 *   node sync/exam_hit_worker.js --rejudge <examId>   인식은 그대로 두고 자료·판정만 다시
 *
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID/PASSWORD · ANTHROPIC_API_KEY · MATHSECR_ID/PASSWORD(기출 DB 찾기)
 * 규칙: 로그에 학생 이름·문항 원문을 남기지 않는다(번호·개수만). 시험지 그림은 exam_images(비공개)에만.
 * ═══════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { execSync } = require('child_process');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const REQ_KEY = 'exam_hit_req';
const BUCKET = 'exam_images';
const STAGE_BUCKET = 'aha_photos';      // 학원앱이 쓸 수 있는 자리(임시). 옮긴 뒤 바로 지운다.
const MODELS = ['claude-sonnet-5-5', 'claude-sonnet-4-6'];
const STALE_MIN = 60;

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
const has = (n) => args.includes('--' + n);
const DRY = has('dry');
const NO_AI = has('no-ai') || !AI_KEY;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SB || !SK) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }

/* ── Supabase ─────────────────────────────────────────────── */
const sbH = (x) => Object.assign({ apikey: SK, authorization: 'Bearer ' + SK }, x || {});
async function kvGet(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  if (!r.ok) return null; const j = await r.json(); let v = j && j[0] ? j[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
async function kvSet(key, value) {
  if (DRY) { log(`[dry] ${key} 저장 생략 (${Math.round(JSON.stringify(value).length / 1024)}KB)`); return true; }
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST',
    headers: sbH({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]) });
  if (!r.ok) throw new Error(`${key} 저장 실패 ${r.status}`);
  return true;
}
async function stGet(bucket, path) {
  const r = await fetch(`${SB}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: sbH() });
  if (!r.ok) throw new Error(`그림 받기 실패 ${r.status} (${bucket})`);
  return Buffer.from(await r.arrayBuffer());
}
async function stPut(bucket, path, buf, type) {
  if (DRY) return path;
  const r = await fetch(`${SB}/storage/v1/object/${bucket}/${path}`, { method: 'POST',
    headers: sbH({ 'content-type': type || 'image/png', 'x-upsert': 'true' }), body: buf });
  if (!r.ok) throw new Error(`그림 올리기 실패 ${r.status} ${(await r.text()).slice(0, 100)}`);
  return path;
}
/* 학원앱은 비공개 버킷 서명을 못 하는 경우가 있어(v19-74 「그림 준비 중」), 기출 DB 처럼 1년짜리 서명 주소를 같이 적어 둔다 */
async function stSign(path, sec) {
  if (DRY || !path) return '';
  try {
    const r = await fetch(`${SB}/storage/v1/object/sign/${BUCKET}/${path}`, { method: 'POST', headers: sbH({ 'content-type': 'application/json' }), body: JSON.stringify({ expiresIn: sec || 31536000 }) });
    const j = await r.json(); return j && j.signedURL ? SB + '/storage/v1' + j.signedURL : '';
  } catch (e) { return ''; }
}
async function stDel(bucket, paths) {
  if (DRY || !paths.length) return;
  await fetch(`${SB}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: sbH({ 'content-type': 'application/json' }), body: JSON.stringify({ prefixes: paths }) }).catch(() => {});
}
async function sbRows(table, query) {
  const out = [];
  for (let off = 0; off < 200000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/${table}?${query}&order=id.asc&limit=1000&offset=${off}`, { headers: sbH() });
    if (!r.ok) throw new Error(`${table} 읽기 실패 ${r.status}`);
    const j = await r.json(); out.push(...j); if (j.length < 1000) break;
  }
  return out;
}

/* ── 작은 도구 ─────────────────────────────────────────────── */
function schoolKey(s) { return String(s || '').replace(/\s/g, '').replace(/등학교$|학교$/, '').replace(/고등$/, '고'); }
function gradeKey(g) { const t = String(g || ''); const lv = /고등|고\s*\d/.test(t) ? '고' : (/초등|초\s*\d/.test(t) ? '초' : '중'); const n = (t.match(/(\d)/) || [])[1] || ''; return n ? lv + n : ''; }
function examIdOf(e) { return [schoolKey(e.school), gradeKey(e.grade), e.year, e.semester, e.term].join('_'); }
function slugOf(id) { return 'x' + crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 12); }
function mimeOf(buf) { if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'; if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'; if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif'; if (buf.slice(0, 4).toString() === 'RIFF') return 'image/webp'; if (buf.slice(0, 4).toString() === '%PDF') return 'application/pdf'; return ''; }
function pidOfUrl(u) { const m = String(u || '').match(/\/problem\/(\d+)\//); return m ? Number(m[1]) : null; }
function semStart(year, sem) { return sem === '1' || sem === 1 ? `${year}-01-01` : `${year}-07-01`; }
async function fetchBuf(url) {
  for (let i = 0; i < 3; i++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(30000) }); if (r.ok) return Buffer.from(await r.arrayBuffer()); if (r.status === 404 || r.status === 403) return null; } catch (e) {}
    await sleep(800 * (i + 1));
  }
  return null;
}

/* pdf-lib 는 깃허브 서버에 기본으로 없어서 요청이 있을 때만 즉석 설치 (twin_request_worker 와 같은 방식) */
function ensurePdfLib() {
  try { require('pdf-lib'); return true; } catch (e) {}
  log('pdf-lib 즉석 설치 중…');
  try { execSync('npm install pdf-lib@^1 --no-save --no-audit --no-fund --loglevel=error', { stdio: 'inherit', cwd: require('path').join(__dirname, '..') }); require('pdf-lib'); return true; }
  catch (e) { log('pdf-lib 설치 실패:', e.message.slice(0, 150)); return false; }
}
let TW = null;   // exam_twin_pipeline 의 매쓰플랫 도구 (pdf-lib 확인 뒤에 불러온다)
function tw() { if (!TW) { TW = require('./exam_twin_pipeline.js'); TW.setLog(log); } return TW; }

/* 사진 여러 장 → A4 PDF (한 장 = 한 쪽, 가장자리 여백만) */
async function imagesToPdf(bufs) {
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.create();
  for (const b of bufs) {
    const m = mimeOf(b);
    const im = m === 'image/png' ? await doc.embedPng(b) : await doc.embedJpg(b);
    const W = 595.28, H = 841.89, M = 18;
    const s = Math.min((W - 2 * M) / im.width, (H - 2 * M) / im.height);
    const pg = doc.addPage([W, H]);
    pg.drawImage(im, { x: (W - im.width * s) / 2, y: H - M - im.height * s, width: im.width * s, height: im.height * s });
  }
  return { bytes: Buffer.from(await doc.save()), pages: doc.getPageCount() };
}
async function pdfPages(buf) { const { PDFDocument } = require('pdf-lib'); const d = await PDFDocument.load(buf, { ignoreEncryption: true }); return d.getPageCount(); }

/* ── 매쓰플랫 AI 인식 — 기출 쌍둥이 파이프라인 ③④⑤와 같은 길 ── */
async function recognize(pdfBuf, pages, trieKey) {
  const T = tw();
  const jobId = await T.saiJob();
  const { data: pres } = await T.mf(T.MF_SAI, 'POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdfBuf });
  if (!up.ok) throw new Error(`PDF 업로드 실패 ${up.status}`);
  await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageIndexes: `1~${pages}`, pageImageQuality: 'HIGH' } });
  const doc = await T.saiPoll(jobId, 300000);
  await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/analysis-flow',
    parameters: { pageImageUrls: doc.pageImageUrls, boxesOnEachPage: doc.boxesOnEachPage, trieKey } });
  const an = await T.saiPoll(jobId, 420000);
  const boxes = []; let t = 0;
  (an.boxesOnEachPage || []).forEach((pb, pi) => pb.forEach(() => {
    const s = an.sourceData[t] || {};
    boxes.push({ page: pi + 1, url: an.boxImageUrls[t], cid: s.conceptId || null, topic: s.topicId || null, sub: s.subTopicId || null,
      level: s.level || null, src: s.sourceProblemId || '', srcWb: s.sourceWorkbookId || null });
    t++;
  }));
  return boxes;
}

/* ── Claude 판정 ──────────────────────────────────────────── */
let MODEL_I = 0;
async function claude(content, maxTokens) {
  let last = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS[MODEL_I], max_tokens: maxTokens || 1200, temperature: 0, messages: [{ role: 'user', content }] }) });
    const d = await r.json().catch(() => null);
    if (r.ok && d && !d.error) return ((d.content || []).find((c) => c.type === 'text') || {}).text || '';
    const msg = (d && d.error && d.error.message) || r.statusText;
    last = new Error('Claude ' + r.status + ': ' + String(msg).slice(0, 160));
    if ((r.status === 404 || /model/i.test(msg)) && MODEL_I < MODELS.length - 1) { MODEL_I++; log(`모델 바꿈 → ${MODELS[MODEL_I]}`); continue; }
    if ([429, 500, 503, 529].includes(r.status)) { await sleep(6000 * Math.pow(2, attempt)); continue; }
    break;
  }
  throw last;
}
function imgPart(buf) { return { type: 'image', source: { type: 'base64', media_type: mimeOf(buf) || 'image/png', data: buf.toString('base64') } }; }
function parseJson(t) { const m = String(t || '').match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch (e) { return null; } }

const JUDGE_RULE = [
  '너는 중·고등 수학 시험 분석가다. 첫 그림은 «이번 학교 시험 문항»이고, 그 뒤 그림들은 학원 학생들이 시험 전에 풀었던 «학원 자료 후보»다.',
  '후보마다 시험 문항과의 관계를 하나로 고른다:',
  '- same : 같은 문제. 묻는 것·숫자·문자·기호(점·모서리 이름)·조건이 하나도 다르지 않다(보기 순서·글자 표현·그림 크기·색만 다른 것은 same).',
  '         숫자 하나, 점이나 모서리 이름 하나라도 바뀌었으면 same 이 아니라 var 다.',
  '- var  : 변형(쌍둥이). 문제의 «뼈대»가 같다 — 같은 질문(구하는 값이 같은 종류), 같은 도형·그래프·표의 짜임, 같은 풀이 순서. 숫자·문자·보기 구성만 바뀌었다.',
  '         이 후보를 풀어 본 학생이면 시험장에서 «아, 그 문제» 하고 같은 순서로 풀 수 있어야 var 다.',
  '- text : 지문만 겹침. 같은 상황·그림·소재를 쓰지만 묻는 것이나 풀이가 다르다.',
  '- none : 위 어디에도 해당하지 않는다(같은 단원·같은 유형의 다른 문제일 뿐).',
  'var 가 아닌 예: 도형 종류가 다르다(직육면체 ↔ 삼각기둥), 묻는 것이 다르다(합 ↔ 개수, 옳은 것 ↔ 옳지 않은 것의 개수), 조건의 짜임이 다르다(점 하나 ↔ 점 둘), 풀이에 필요한 성질이 다르다. 이런 것은 none 이다.',
  '엄격하게 판단한다. 확실하지 않으면 한 단계 낮은 쪽을 고른다(same 대신 var, var 대신 none). why 에는 «무엇이 같은지»를 적는다.',
  '반드시 아래 JSON 하나만 답한다. 다른 글은 쓰지 않는다.',
  '{"ask":"시험 문항이 묻는 것 한 줄(25자 이내, 숫자 없이)","essay":true 또는 false(서술형·풀이 과정을 쓰는 문항이면 true),"cands":[{"i":후보번호,"kind":"same|var|text|none","why":"15자 이내 근거"}]}',
].join('\n');

async function judgeItem(examBuf, cands) {
  const content = [{ type: 'text', text: JUDGE_RULE }, { type: 'text', text: '【시험 문항】' }, imgPart(examBuf)];
  cands.forEach((c, i) => { content.push({ type: 'text', text: `【후보 ${i + 1}】` }); content.push(imgPart(c.buf)); });
  if (!cands.length) content.push({ type: 'text', text: '(후보 없음 — cands 는 빈 배열로)' });
  for (let k = 0; k < 2; k++) {
    const j = parseJson(await claude(content, 1200));
    if (j && Array.isArray(j.cands)) return j;
    log('판정 답을 읽지 못함 — 한 번 더');
  }
  return { ask: '', essay: null, cands: [] };
}

/* ── ③ 우리 자료 ──────────────────────────────────────────── */
async function loadStudents(school, grade) {
  let db = await kvGet('or_studentdb'); if (db && !Array.isArray(db)) db = db.students || Object.values(db);
  const sk = schoolKey(school), gk = gradeKey(grade);
  return (db || []).filter((s) => s && !s.withdrawn && s.lumen_rec_code && schoolKey(s.school) === sk && gradeKey(s.grade) === gk)
    .map((s) => String(s.lumen_rec_code));
}
async function loadMaterials(codes, from, to, excludeRe) {
  if (!codes.length) return [];
  const cols = 'id,source,worksheet_id,worksheet_title,problem_seq,book_id,workbook_page_id,workbook_problem_id,page,number,problem_id,concept_id,level,result,score_datetime,lumen_rec_code';
  const q = `select=${cols}&lumen_rec_code=in.(${codes.join(',')})&score_datetime=gte.${from}&score_datetime=lte.${to}T23:59:59`;
  const rows = await sbRows('mf_answer_records', q);
  const mats = {};
  rows.forEach((x) => {
    if (excludeRe && excludeRe.test(x.worksheet_title || '')) return;
    let k; if (x.source === '교재') { if (!x.workbook_problem_id) return; k = 'wb:' + x.workbook_problem_id; }
    else { if (!x.problem_id) return; k = 'ws:' + x.problem_id; }
    const m = mats[k] = mats[k] || { k, kind: x.source === '교재' ? 'book' : 'ws', title: x.worksheet_title || '', cid: x.concept_id || null, level: x.level || null,
      pid: x.problem_id || null, wbp: x.workbook_problem_id || null, wsId: x.worksheet_id || null, seq: x.problem_seq || null,
      bookId: x.book_id || null, pageId: x.workbook_page_id || null, page: x.page || '', number: x.number || '', res: {}, at: {} };
    const c = String(x.lumen_rec_code || ''); if (!c || !x.result || x.result === '-') return;
    if (!m.at[c] || String(x.score_datetime) > m.at[c]) { m.at[c] = String(x.score_datetime); m.res[c] = x.result; }
  });
  log(`우리 자료: 기록 ${rows.length}건 → 서로 다른 문항 ${Object.keys(mats).length}개`);
  return Object.values(mats);
}
function whereOf(m) {
  if (m.kind === 'book') { const pg = String(m.page || '').replace(/~.*/, ''); return `${m.title}${pg ? ' ' + pg + '쪽' : ''}${m.number ? ' ' + String(m.number).replace(/\s*번$/, '') + '번' : ''}`; }
  if (m.kind === 'upload') return `${m.title} ${m.no}번`;
  return `${m.title}${m.seq ? ' ' + m.seq + '번' : ''}`;
}
/* 후보 그림 주소 — 학습지는 /worksheet/{id}/problem, 교재는 /workbook/{bid}/page/{pid} (한 번 받은 것은 기억) */
const WS_CACHE = {}, WB_CACHE = {};
async function matImage(m) {
  if (m.img) return m.img;
  const T = tw();
  const pic = (o) => (o && (o.url || o.imageUrl)) || null;
  try {
    if (m.kind === 'ws' && m.wsId) {
      if (!WS_CACHE[m.wsId]) {
        const { data } = await T.mf(T.MF_API, 'GET', `/worksheet/${m.wsId}/problem?size=300`);
        const map = {}; ((data && data.content) || []).forEach((c) => { const p = c.problem || c; if (p && p.id) map[p.id] = p.problemImageUrl || ''; });
        WS_CACHE[m.wsId] = map; await sleep(80);
      }
      m.img = WS_CACHE[m.wsId][m.pid] || '';
    } else if (m.kind === 'book' && m.bookId && m.pageId) {
      const ck = m.bookId + ':' + m.pageId;
      if (!WB_CACHE[ck]) {
        const { data } = await T.mf(T.MF_API, 'GET', `/workbook/${m.bookId}/page/${m.pageId}?size=300`);
        const arr = Array.isArray(data) ? data : ((data && data.content) || []);
        const map = {}; arr.forEach((q) => { map[q.id] = pic(q.problem) || pic(q.exampleProblem) || q.problemImageUrl || ''; });
        WB_CACHE[ck] = map; await sleep(80);
      }
      m.img = WB_CACHE[ck][m.wbp] || '';
    }
  } catch (e) { m.img = ''; }
  if (m.img && !m.pid) m.pid = pidOfUrl(m.img);
  return m.img;
}

/* ── ⑤ 반복 출제 — 같은 학교·학년·학기·시험의 지난 기출 유형 번호 ── */
async function pastTypes(exam) {
  const ms = await kvGet('ms_exams_' + schoolKey(exam.school));
  const br = (await kvGet('ms_exam_bridge')) || { byMydb: {} };
  /* 유형 번호가 같거나, 교육과정이 바뀌어 번호가 달라도 유형 이름이 같으면 (v19-37 과 같은 규칙) */
  const out = { cid: {}, name: {} };   // → [{year,no}]
  const nm = (s) => String(s || '').replace(/\s/g, '');
  ((ms && ms.exams) || []).forEach((e) => {
    if (gradeKey(e.grade) !== gradeKey(exam.grade) || String(e.semester) !== String(exam.semester) || e.term !== exam.term) return;
    if (Number(e.year) >= Number(exam.year)) return;
    const b = br.byMydb[String(e.id)]; if (!b) return;
    (b.problems || []).forEach((p, i) => {
      const hit = { year: Number(e.year), no: p.no || i + 1 };
      const cid = p.conceptId || p.cid; if (cid) (out.cid[cid] = out.cid[cid] || []).push(hit);
      if (p.concept) (out.name[nm(p.concept)] = out.name[nm(p.concept)] || []).push(hit);
    });
  });
  out.of = (it) => { const a = (out.cid[it.cid] || []).concat(out.name[nm(it.type)] || []); const seen = {}; return a.filter((h) => { const k = h.year + ':' + h.no; if (seen[k]) return false; seen[k] = 1; return true; }).sort((x, y) => y.year - x.year); };
  return out;
}

/* ══ 한 시험 처리 ═════════════════════════════════════════════ */
async function runExam(exam, opt) {
  const step = opt.step || (async () => {});
  const examId = exam.examId || examIdOf(exam);
  const slug = slugOf(examId);
  const T = tw();
  const prev = (await kvGet('exam_hit_' + examId)) || null;
  const trie = T.trieForExam(String(gradeKey(exam.grade)).replace(/\D/g, ''), exam.semester, exam.year);
  if (!trie) throw new Error(`교육과정 키를 정할 수 없습니다 (${exam.grade} ${exam.semester}학기 ${exam.year})`);

  /* ①② 시험지 → 문항 */
  let items;
  if (opt.rejudge && prev && prev.items && prev.items.length) {
    items = prev.items.map((it) => ({ ...it }));
    for (const it of items) if (it.img && !it.imgUrl) it.imgUrl = await stSign(it.img);   // 옛 문항에 서명 주소 채우기
    log(`인식은 그대로 (${items.length}문항) — 자료·판정만 다시`);
  } else {
    await step('시험지 모으는 중', 5);
    let pdf = null, meta = [];
    if (opt.mydb) {
      const ms = await kvGet('ms_exams_' + schoolKey(exam.school));
      let e = ((ms && ms.exams) || []).find((x) => String(x.id) === String(opt.mydb));
      if (!e || !(e.cells || []).some((c) => c.img)) { await step('기출 DB에서 시험지 받는 중', 4); e = await mydbFetch(opt.mydb, exam.school, slug); }   /* v19-80: 아직 안 받은 시험지 */
      meta = (e.cells || []).filter((c) => c.img);
      if (!meta.length) throw new Error('기출 DB 시험지에 문항 그림이 없습니다');
      const imgs = [];
      for (const c of meta) imgs.push({ no: c.no, buf: await stGet(BUCKET, c.img) });
      const b = await T.buildPdf(imgs, examId.replace(/[^\x20-\x7E]/g, '') || 'EXAM');
      pdf = { bytes: Buffer.from(b.bytes), pages: b.pages };
    } else {
      const files = opt.files || [];
      if (!files.length) throw new Error('올린 시험지가 없습니다');
      const bufs = [];
      for (const f of files) {
        const buf = await stGet(f.bucket || STAGE_BUCKET, f.path);
        await stPut(BUCKET, `hit/${slug}/src/${bufs.length + 1}.${mimeOf(buf) === 'application/pdf' ? 'pdf' : (mimeOf(buf) === 'image/png' ? 'png' : 'jpg')}`, buf, mimeOf(buf) || 'application/octet-stream');
        bufs.push(buf);
      }
      await stDel(STAGE_BUCKET, files.filter((f) => (f.bucket || STAGE_BUCKET) === STAGE_BUCKET).map((f) => f.path));
      const pdfs = bufs.filter((b) => mimeOf(b) === 'application/pdf'), imgs = bufs.filter((b) => mimeOf(b) !== 'application/pdf');
      if (pdfs.length === 1 && !imgs.length) pdf = { bytes: pdfs[0], pages: await pdfPages(pdfs[0]) };
      else if (!pdfs.length) pdf = await imagesToPdf(imgs);
      else {   // PDF 와 사진이 섞이면 PDF 를 쪽마다 붙이고 사진을 뒤에
        const { PDFDocument } = require('pdf-lib'); const out = await PDFDocument.create();
        for (const p of pdfs) { const d = await PDFDocument.load(p, { ignoreEncryption: true }); (await out.copyPages(d, d.getPageIndices())).forEach((pg) => out.addPage(pg)); }
        if (imgs.length) { const ip = await imagesToPdf(imgs); const d = await PDFDocument.load(ip.bytes); (await out.copyPages(d, d.getPageIndices())).forEach((pg) => out.addPage(pg)); }
        pdf = { bytes: Buffer.from(await out.save()), pages: out.getPageCount() };
      }
    }
    log(`시험지 PDF ${pdf.pages}쪽 · ${(pdf.bytes.length / 1024) | 0}KB`);
    await step('매쓰플랫 AI 가 문항을 나누는 중 (2~5분)', 15);
    await T.mfLogin();
    const boxes = await recognize(pdf.bytes, pdf.pages, trie);
    log(`문항 인식: ${boxes.length}상자 · 유형 붙은 것 ${boxes.filter((b) => b.cid).length}`);
    items = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i], no = i + 1;
      const buf = await fetchBuf(b.url);
      const img = buf ? await stPut(BUCKET, `hit/${slug}/q/${String(no).padStart(2, '0')}.png`, buf, mimeOf(buf) || 'image/png') : '';
      const c = meta.length === boxes.length ? meta[i] : null;   // 기출 DB 시험지는 번호·배점·난이도까지
      items.push({ no, img, imgUrl: await stSign(img), cid: b.cid, topic: b.topic, sub: b.sub, level: b.level, src: b.src, srcWb: b.srcWb,
        score: c ? c.score || null : null, diff: c ? c.difficulty || null : null,
        essay: c ? /essay|descript|서술/i.test(String(c.answerType || '')) : null });
    }
  }

  /* 유형 이름 · 교과서 여부 */
  const names = (await kvGet('mf_concept_names')) || {};
  const tbs = ((await kvGet('mf_textbooks')) || {}).books || {};
  const tbIds = new Set(Object.keys(tbs).map(String));
  items.forEach((it) => {
    const n = names[it.cid] || {}; it.type = n.n || ''; it.chapter = n.m || '';
    const pre = String(it.src || '')[0];
    it.source = it.srcWb && tbIds.has(String(it.srcWb)) ? 'textbook' : (pre === 'b' ? 'workbook' : (pre === 's' ? 'exam' : 'bank'));
    it.killer = it.diff != null ? Number(it.diff) >= 6 : Number(it.level || 0) >= 4;
  });

  /* ③ 우리 자료 */
  await step('우리 자료 모으는 중', 40);
  const codes = await loadStudents(exam.school, exam.grade);
  const from = opt.from || semStart(exam.year, exam.semester);
  const to = opt.to || exam.date || new Date().toISOString().slice(0, 10);
  const own = new RegExp(`${schoolKey(exam.school)}[^\\n]*${exam.year}[^\\n]*${exam.semester}학기[^\\n]*${exam.term}`);
  const mats = await loadMaterials(codes, from, to, own);
  /* 학원앱에서 올린 우리 프린트 */
  for (const [ui, u] of (opt.uploads || []).entries()) {
    try {
      const buf = await stGet(u.bucket || STAGE_BUCKET, u.path);
      await stDel(STAGE_BUCKET, (u.bucket || STAGE_BUCKET) === STAGE_BUCKET ? [u.path] : []);
      const pdf = mimeOf(buf) === 'application/pdf' ? { bytes: buf, pages: await pdfPages(buf) } : await imagesToPdf([buf]);
      await T.mfLogin();
      const bx = await recognize(pdf.bytes, pdf.pages, trie);
      for (let j = 0; j < bx.length; j++) {
        const b = bx[j]; const ib = await fetchBuf(b.url); if (!ib) continue;
        const p = await stPut(BUCKET, `hit/${slug}/mat/${ui + 1}_${j + 1}.png`, ib, mimeOf(ib) || 'image/png');
        mats.push({ k: `up:${ui + 1}:${j + 1}`, kind: 'upload', title: u.title || `우리 프린트 ${ui + 1}`, no: j + 1, cid: b.cid, level: b.level,
          pid: /^p\d+$/.test(b.src) ? Number(b.src.slice(1)) : null, wbp: null, store: p, storeUrl: await stSign(p), res: {}, at: {} });
      }
      log(`우리 프린트 ${ui + 1}: ${bx.length}문항`);
    } catch (e) { log(`우리 프린트 ${ui + 1} 인식 실패: ${e.message.slice(0, 120)}`); }
  }
  const byCid = {}; mats.forEach((m) => { if (m.cid) (byCid[m.cid] = byCid[m.cid] || []).push(m); });

  /* ④ 후보 + 판정 */
  const past = await pastTypes(exam);
  const used = {};
  let n = 0;
  if (mats.some((m) => m.kind !== 'upload')) { try { await T.mfLogin(); } catch (e) { log('매쓰플랫 로그인 실패 — 후보 그림 없이 진행'); } }
  for (const it of items) {
    n++; await step(`판정 중 ${n}/${items.length}`, 45 + Math.round(50 * n / items.length));
    it.repeat = past.of(it).slice(0, 6);
    const srcN = /^[pbs]\d+$/.test(it.src || '') ? Number(it.src.slice(1)) : null, srcP = String(it.src || '')[0];
    const pool = {};
    /* 원본 번호가 같은 자료 (유형이 달라도) */
    mats.forEach((m) => { if (srcN && ((srcP === 'p' && m.pid === srcN) || (srcP === 'b' && m.wbp === srcN))) pool[m.k] = { m, idSame: true }; });
    (byCid[it.cid] || []).forEach((m) => { if (!pool[m.k]) pool[m.k] = { m, idSame: false }; });
    const wrong = (m) => Object.values(m.res).filter((r) => r === 'X' || r === '?').length;
    const solved = (m) => Object.keys(m.res).length;
    const ranked = Object.values(pool).sort((a, b) => (b.idSame - a.idSame) || (Math.abs((a.m.level || 3) - (it.level || 3)) - Math.abs((b.m.level || 3) - (it.level || 3))) || (wrong(b.m) - wrong(a.m)) || (solved(b.m) - solved(a.m)));
    /* 그림을 받아 같은 그림(같은 원본 문제)은 하나로 */
    const cands = []; const seenPid = {};
    for (const c of ranked) {
      if (cands.length >= 6) break;
      const m = c.m;
      let buf = null;
      if (m.kind === 'upload') buf = await stGet(BUCKET, m.store).catch(() => null);
      else { const u = await matImage(m); if (!u) continue; const pid = pidOfUrl(u); if (pid && seenPid[pid]) { seenPid[pid].also.push(m.k); continue; } buf = await fetchBuf(u); if (pid) seenPid[pid] = { also: [] }; c.pidKey = pid; }
      if (!buf) continue;
      c.buf = buf; cands.push(c);
    }
    cands.forEach((c) => { c.also = c.pidKey && seenPid[c.pidKey] ? seenPid[c.pidKey].also : []; });
    let verdict = { ask: it.ask || '', essay: it.essay, cands: [] };
    if (!NO_AI && it.img) {
      try { const eb = await stGet(BUCKET, it.img); verdict = await judgeItem(eb, cands); }
      catch (e) { log(`${it.no}번 판정 실패: ${e.message.slice(0, 120)}`); }
    }
    const kindOf = (i, c) => { const v = (verdict.cands || []).find((x) => Number(x.i) === i + 1); const k = v && v.kind; if (k === 'same' || k === 'var' || k === 'text') return { kind: k, why: v.why || '' }; return { kind: c.m.cid === it.cid ? 'type' : 'none', why: v ? (v.why || '') : (c.idSame ? '원본 번호 같음' : '') }; };
    it.cands = cands.map((c, i) => { const kv = kindOf(i, c); [c.m.k].concat(c.also || []).forEach((k) => { used[k] = 1; }); return { k: c.m.k, also: c.also || [], kind: kv.kind, why: String(kv.why || '').slice(0, 40), idSame: !!c.idSame }; })
      .filter((c) => c.kind !== 'none');
    const order = { same: 4, var: 3, text: 2, type: 1 };
    it.cands.sort((a, b) => order[b.kind] - order[a.kind]);
    if (verdict.ask) it.ask = String(verdict.ask).slice(0, 40);
    if (it.essay == null && typeof verdict.essay === 'boolean') it.essay = verdict.essay;
    /* 원장님 확정은 그대로 둔다 (같은 자료가 아직 후보에 있을 때) */
    const old = prev && (prev.items || []).find((x) => x.no === it.no);
    if (old && old.hit && old.hit.ok != null && it.cands.some((c) => c.k === old.hit.k)) it.hit = old.hit;
    else if (old && old.hit && old.hit.ok === false && !old.hit.k) it.hit = old.hit;   // 「적중 없음」 확정
    else it.hit = null;
    const top = it.cands[0];
    log(`${it.no}번: 후보 ${cands.length} → ${top ? top.kind : '없음'}${it.repeat.length ? ' · 반복' : ''}`);
  }

  /* 저장용 자료(쓰인 것만) */
  const matOut = {};
  mats.forEach((m) => { if (!used[m.k]) return; matOut[m.k] = { kind: m.kind, title: m.title, where: whereOf(m), cid: m.cid, level: m.level, img: m.img || '', store: m.store || '', storeUrl: m.storeUrl || '', res: m.res }; });

  /* 통계 */
  const st = { total: items.length, same: 0, var: 0, text: 0, type: 0, killers: items.filter((x) => x.killer).length,
    essay: items.filter((x) => x.essay).length, levelAvg: 0, source: { textbook: 0, workbook: 0, exam: 0, bank: 0 }, repeat: items.filter((x) => (x.repeat || []).length).length };
  items.forEach((x) => { const t = x.cands && x.cands[0]; if (t) st[t.kind]++; st.source[x.source] = (st.source[x.source] || 0) + 1; st.levelAvg += Number(x.level || 0); });
  st.levelAvg = items.length ? Math.round(st.levelAvg / items.length * 10) / 10 : 0;

  /* 출제 경향 · 킬러 문항 한 단락 (학원앱 보고서·블로그 자료에 쓴다) */
  let trend = prev && prev.trend && (opt.rejudge || prev.trend.edited) ? prev.trend : null;   // v19-79: 고친 글은 늘 남김
  if (!NO_AI) {
    try {
      const SRC = { textbook: '교과서', workbook: '시중 교재', exam: '다른 학교 기출', bank: '문제은행' };
      const brief = items.map((x) => `${x.no}번 | ${x.chapter} > ${x.type} | 난도 ${x.level}${x.killer ? ' ☠' : ''}${x.essay ? ' 서술' : ''} | ${x.ask || ''} | 가장 닮은 원본 ${SRC[x.source] || ''}${(x.repeat || []).length ? ' | 지난 기출 ' + x.repeat.map((r) => r.year).join(',') : ''}`).join('\n');
      const t = await claude([{ type: 'text', text: `${schoolKey(exam.school)} ${gradeKey(exam.grade)} ${exam.year}년 ${exam.semester}학기 ${exam.term}고사 문항 목록이다.\n${brief}\n\n학부모·원장님이 읽을 분석을 쓴다. 학생 이름·학원 이름은 쓰지 않는다. 영어 낱말·프로그램 이름·「단원 표기」 같은 자료 내부 사정은 쓰지 않는다. ~합니다체.\n아래 JSON 하나만 답한다.\n{"trend":"출제 경향 3~4문장(단원 비중·난도 흐름·교과서 비중·눈에 띄는 점)","killer":"킬러(☠) 문항이 무엇을 요구했는지 2~3문장. 킬러가 없으면 가장 어려운 문항 기준"}` }], 900);
      const j = parseJson(t); if (j && j.trend) trend = { trend: String(j.trend).slice(0, 600), killer: String(j.killer || '').slice(0, 400) };
      /* v19-79: 원장님이 고친 글은 다시 판정해도 그대로 (AI 새 글은 ai 칸에만) */
      if (prev && prev.trend && prev.trend.edited) trend = { ...prev.trend, ai: trend ? { trend: trend.trend, killer: trend.killer } : (prev.trend.ai || null) };
    } catch (e) { log('경향 글 실패: ' + e.message.slice(0, 100)); }
  }

  const out = { examId, exam: { school: schoolKey(exam.school), grade: gradeKey(exam.grade), year: Number(exam.year), semester: String(exam.semester), term: exam.term, date: exam.date || '', mydb: opt.mydb || null },
    basis: (prev && prev.basis) || 'same+var', from, to, students: codes, items, mats: matOut, stats: st, trend,
    at: new Date().toISOString(), by: 'worker', confirmedAt: (prev && prev.confirmedAt) || null };
  await kvSet('exam_hit_' + examId, out);
  const idx = (await kvGet('exam_hit_index')) || { items: [] };
  idx.items = (idx.items || []).filter((x) => x.examId !== examId);
  idx.items.push({ examId, school: out.exam.school, grade: out.exam.grade, year: out.exam.year, semester: out.exam.semester, term: out.exam.term, total: st.total, auto: { same: st.same, var: st.var, type: st.type, text: st.text }, at: out.at });
  idx.items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  await kvSet('exam_hit_index', idx);
  log(`저장: exam_hit_${examId} — ${st.total}문항 · 같은 문제 ${st.same} · 변형 ${st.var} · 유형 ${st.type} · 지문만 ${st.text} · 학생 ${codes.length}명 · 자료 ${Object.keys(matOut).length}`);
  return out;
}

/* ══ 2026-10-05: 📚 기출 DB(원장님이 구입한 나만의 DB)에서 찾기 ════════════════
 * 원장 요청 「시험지 올리기와 수학비서에 내가 구매한 db가 있으니 수학비서에서 기출을 찾아서 확인하는 기능도 추가하자」
 *  · 색인 ms_mydb_index (제목·학교·연도·학기·시험·문항 수, 약 200KB) — 12시간마다 또는 학원앱 「목록 새로 받기」(ms_mydb_index_req)
 *  · 요청에 mydb 가 있으면 그 시험지를 받아(문항 그림) 바로 문항 나누기로. DB화가 끝난 시험지는 ms_exams_<학교> 에도 넣어
 *    기출 분석 화면에도 쓰이게 하고, 처리 중인 시험지는 그림만 exam_images/hit/<시험>/src 에 둔다(기출 분석은 건드리지 않는다).
 *  환경변수 MATHSECR_ID/PASSWORD (없으면 색인·받기를 건너뛴다)
 */
let MSC = null;
function msc() { if (!MSC) MSC = require('./exam_db_collector.js'); return MSC; }
async function mydbFetch(id, school, slug) {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('기출 DB 계정(MATHSECR_ID) 이 서버에 없습니다');
  const C = msc(); await C.msLogin();
  const all = await C.msListMydbs(); const t = all.find((m) => String(m.id) === String(id));
  if (!t) throw new Error(`기출 DB 에 ${id} 시험지가 없습니다`);
  if (t.dbStatus === 'dbCompleted') { log(`기출 DB ${id}: DB화 완료 → ms_exams_${schoolKey(school)} 에도 넣음`); return C.fetchOne(schoolKey(school), id); }
  const ex = await C.msExam(Number(id) || id);
  log(`기출 DB ${id}: 아직 처리 중 — 그림만 받음 (${ex.cells.length}문항)`);
  for (const c of ex.cells) {
    if (!c.imgUrl) { c.img = null; continue; }
    try { const im = await C.msImage(c.imgUrl); const p = `hit/${slug}/src/q${String(c.no).padStart(2, '0')}.png`; await stPut(BUCKET, p, im.buf, im.type || 'image/png'); c.img = p; } catch (e) { c.img = null; }
    delete c.imgUrl; await sleep(120);
  }
  return ex;
}
async function examDateFromCalendar(exam) {   /* 시험 첫날을 모르면 학원 달력(school_calendar)에서 */
  try {
    const v = await kvGet('school_calendar'); const s = ((v && v.schools) || []).find((x) => schoolKey(x.name) === schoolKey(exam.school));
    const re = new RegExp(`${exam.semester}학기\\s*${exam.term}`);
    const e = s && (s.exams || []).find((x) => re.test(String(x.label || '')) && String(x.from || '').slice(0, 4) === String(exam.year));
    return (e && e.from) || '';
  } catch (e) { return ''; }
}
async function maybeIndex() {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) return;
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.ms_mydb_index&select=updated_at`, { headers: sbH() });
  const row = r.ok ? (await r.json())[0] : null;
  const age = row ? (Date.now() - new Date(row.updated_at).getTime()) / 3600000 : 1e9;
  const req = await kvGet('ms_mydb_index_req');
  const asked = req && req.status === 'requested';
  if (age < 12 && !asked) return;
  log(`기출 DB 목록 색인 새로 받기 (${asked ? '학원앱 요청' : (row ? (age | 0) + '시간 지남' : '처음')})`);
  try {
    const C = msc(); await C.msLogin(); const ix = await C.buildIndex();
    await kvSet('ms_mydb_index', ix);
    if (asked) await kvSet('ms_mydb_index_req', { ...req, status: 'done', doneAt: new Date().toISOString(), n: ix.items.length });
    log(`색인 저장: ${ix.items.length}장`);
  } catch (e) {
    log('색인 실패:', e.message);
    if (asked) await kvSet('ms_mydb_index_req', { ...req, status: 'error', error: String(e.message).slice(0, 120), doneAt: new Date().toISOString() });
  }
}

/* ══ 요청 처리 (학원앱 → exam_hit_req) ═══════════════════════ */
async function handleRequest() {
  const req = await kvGet(REQ_KEY);
  if (!req || !req.status) { log('대기 중인 적중 분석 요청 없음'); return; }
  if (req.status === 'running') {
    const age = (Date.now() - new Date(req.startedAt || req.reqAt || 0).getTime()) / 60000;
    if (age < STALE_MIN) { log(`진행 중인 요청 (${age | 0}분째) — 기다림`); return; }
    await kvSet(REQ_KEY, { ...req, status: 'error', error: '시간 초과로 멈춤 — 다시 요청해 주세요', doneAt: new Date().toISOString() });
    return;
  }
  if (req.status !== 'requested') { log(`요청 상태 ${req.status} — 할 일 없음`); return; }
  if (!ensurePdfLib()) { await kvSet(REQ_KEY, { ...req, status: 'error', error: 'pdf-lib 설치 실패', doneAt: new Date().toISOString() }); return; }
  const startedAt = new Date().toISOString();
  const step = async (s, pct) => { log(`· ${s}`); try { await kvSet(REQ_KEY, { ...req, status: 'running', step: s, pct, startedAt }); } catch (e) {} };
  await step('시작', 1);
  try {
    const exam = { ...req.exam, examId: req.examId };
    if (!exam.date) { exam.date = await examDateFromCalendar(exam); if (exam.date) log(`시험 첫날(학원 달력): ${exam.date}`); }
    const out = await runExam(exam, { files: req.files || [], uploads: req.mats || [], mydb: req.mydb || null, rejudge: !!req.rejudge, from: req.from, to: req.to, step });
    await kvSet(REQ_KEY, { ...req, status: 'done', step: '끝', pct: 100, startedAt, doneAt: new Date().toISOString(), examId: out.examId,
      summary: { total: out.stats.total, same: out.stats.same, var: out.stats.var, type: out.stats.type, text: out.stats.text } });
  } catch (e) {
    log('실패:', e.message);
    await kvSet(REQ_KEY, { ...req, status: 'error', error: String(e.message || e).slice(0, 200), startedAt, doneAt: new Date().toISOString() });
    process.exitCode = 1;
  }
}

module.exports = { schoolKey, gradeKey, examIdOf, whereOf, pidOfUrl, semStart, mydbFetch, examDateFromCalendar };

if (require.main === module) {
  (async () => {
    if (NO_AI && !has('no-ai')) log('⚠ ANTHROPIC_API_KEY 가 없어 그림 판정 없이 유형 번호로만 후보를 남깁니다');
    const mydb = arg('mydb', null), rej = arg('rejudge', null);
    if (!mydb && !rej) { try { await maybeIndex(); } catch (e) { log('색인 건너뜀:', e.message); } return handleRequest(); }
    if (!ensurePdfLib()) throw new Error('pdf-lib 설치 실패');
    let exam;
    if (rej) { const p = await kvGet('exam_hit_' + rej); if (!p) throw new Error('exam_hit_' + rej + ' 가 없습니다'); exam = { ...p.exam, examId: rej }; }
    else {
      const school = arg('school', '옥길중');
      const ms = await kvGet('ms_exams_' + schoolKey(school));
      const e = ((ms && ms.exams) || []).find((x) => String(x.id) === String(mydb));
      if (!e) throw new Error(`기출 DB(ms_exams_${schoolKey(school)})에 ${mydb} 가 없습니다`);
      exam = { school, grade: arg('grade', e.grade), year: arg('year', e.year), semester: String(arg('semester', e.semester)), term: arg('term', e.term), date: arg('date', '') };
      if (arg('exam-id', '')) exam.examId = arg('exam-id', '');
    }
    await runExam(exam, { mydb: rej ? exam.mydb : mydb, rejudge: !!rej, from: arg('from', ''), to: arg('to', '') });
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
