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
 *   ⑤-2 지난 기출 비교 — 같은 학교·학년 지난 시험(기본 최근 4년, 중간·기말 모두) 문항과 그림 판정 → it.past · stats.past (우리 자료 적중률과 따로, 2026-10-11)
 *   ⑥ 저장 — lumen_store exam_hit_<examId> + exam_hit_index. 확정(✓/✗)은 원장님이 학원앱에서.
 *
 * 실행
 *   node sync/exam_hit_worker.js                       요청(exam_hit_req) 확인 → 있으면 처리 (5분마다 워크플로)
 *   node sync/exam_hit_worker.js --mydb 387569 --school 옥길중 --grade 중1 [--year 2025 --semester 2 --term 중간]
 *        [--from 2026-07-01 --to 2026-10-01]   우리 자료 기간 (기본: 그 학기 시작 ~ 시험일)
 *        [--exam-id 이름]  [--no-ai]  [--dry]
 *   node sync/exam_hit_worker.js --rejudge <examId>   인식은 그대로 두고 자료·판정만 다시
 *   node sync/exam_hit_worker.js --past-only <examId> [--dry] [--years 4] [--same-term]   2026-10-11 «학교 기출과 비교»만 다시 (우리 자료·판정은 그대로)
 *   node sync/exam_hit_worker.js --prep [--dry] [--force] [--cap 12]
 *        2026-10-10 «우리 자료 3종» 새벽 준비 (mathflat-collect.yml 04시 회차):
 *        수학비서 학년 폴더(고1·고2·고3·중1·중2·중3) 학습지 미리 인식 → ms_paper_<id> · 목록 ms_papers_index
 *        · PDF 자료함(exam_lib) 대기 파일 인식 · 지정 교과서 은행(mf_textbook_<bid>)이 없으면 만들기.
 *        --dry = 읽기만 하고 할 일 목록만 보여 준다. 새벽(한국 3~6시)이 아니면 --force 없이는 건너뛴다.
 *        2026-10-11: 수학비서 «내 문제지»(원장님이 만든 프린트) 색인 ms_mypapers_index + 기억한 구성의 mpOn 미리 인식
 *   node sync/exam_hit_worker.js --mypapers-index            내 문제지 폴더 나무·목록만 새로 받기
 *   node sync/exam_hit_worker.js --mp-build 2061686,2032273  내 문제지 인식 → ms_mypaper_<id> (+ 색인)
 *   node sync/exam_hit_worker.js --rejudge <examId> --dry --src-file src.json   자료 구성을 바꿔 저장 없이 돌려 보기
 *   큰 자료는 10쪽씩 나눠 인식한다(매쓰플랫 문서 인식은 한 번에 10쪽까지 — 넘으면 「pageIndexes: must be valid」).
 *
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · MATHFLAT_ID/PASSWORD · ANTHROPIC_API_KEY · MATHSECR_ID/PASSWORD(기출 DB 찾기)
 * 규칙: 로그에 학생 이름·문항 원문을 남기지 않는다(번호·개수만). 시험지 그림은 exam_images(비공개)에만.
 * ═══════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');
const pathMod = require('path');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const REQ_KEY = 'exam_hit_req';
const BUCKET = 'exam_images';
const STAGE_BUCKET = 'aha_photos';      // 학원앱이 쓸 수 있는 자리(임시). 옮긴 뒤 바로 지운다.
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-4-6'];   /* 2026-10-12 원장 「품질 좋은 것으로」 — 이번 달 크레딧 기간(~11/6) 최상위 모델, 안 되면 다음 것 */
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

async function judgeItem(examBuf, cands, rule) {
  const content = [{ type: 'text', text: rule || JUDGE_RULE }, { type: 'text', text: '【시험 문항】' }, imgPart(examBuf)];
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
  if (m.kind === 'upload' || m.kind === 'ms') return `${m.title} ${m.no}번`;
  if (m.kind === 'textbook') return `${m.title} ${m.page}쪽 ${String(m.number || '').replace(/\s*번$/, '')}번`;   /* 2026-10-10 */
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

/* ── ⑤-2 지난 기출 비교 (2026-10-11 원장 「범박고 분석 시 범박고 기출에서 나온 것도 확인할 수 있나? 소사고 분석 시는 소사고 기출과 비교」) ──
 *   우리 자료와 따로 센다(우리 자료 적중률에 들어가지 않는다).
 *   비교 대상 = ms_exams_<학교> 의 같은 학교·같은 학년 지난 시험지(분석하는 시험보다 앞선 것만, 같은 시험지 id 는 뺌)
 *             · 기본 최근 4년 · 중간/기말 · 1/2학기 모두 (src.past = { on, years, sameTerm })
 *             · 고등부는 같은 교육과정 안에서 과목이 다르면 뺀다(공통수학1 ↔ 공통수학2). 교육과정이 다르면(수학(하) ↔ 공통수학2) 유형으로 맞춘다.
 *   후보 = 문항마다 지난 시험 문항 중 «원본 번호 같음»(다리 problemId = 시험 문항의 가장 닮은 원본) → 같은 유형 번호 → 같은 유형 이름, 최근 시험부터 3개
 *          → 우리 자료와 같은 그림 판정(같은 문제 / 숫자변형 / 지문만), 유형만 같으면 유사유형.
 *   저장 it.past = [{ k:'past:<mydb>:<번호>', mydb, exam:'2025 2학기 중간', year, sem, term, no, kind, why, img, imgUrl, idSame, approx }]
 *        it.pastTop = { k, kind } · 원장 확정 it.pastHit = { k, kind, ok } (다시 판정해도 남고, 그 후보는 맨 앞에 고정)
 *        stats.past = { same, var, type, text, items(같은 문제+숫자변형 문항 수), exams, years, sameTerm, list:[…] } */
const PAST_RULE = JUDGE_RULE.replace('그 뒤 그림들은 학원 학생들이 시험 전에 풀었던 «학원 자료 후보»다.', '그 뒤 그림들은 «같은 학교의 지난 시험 문항 후보»다.');
const PAST_MAX = 3;
function pastCfg(src) {
  const p = (src && src.past) || {};
  const y = Number(p.years); return { on: p.on !== false, years: y >= 1 && y <= 10 ? Math.round(y) : 4, sameTerm: !!p.sameTerm };
}
function termOrd(y, s, t) { return Number(y) * 10 + Number(s) * 2 + (t === '기말' ? 1 : 0); }
function pastSelect(exam, ms, br, cfg, mydb) {
  const gk = gradeKey(exam.grade), me = termOrd(exam.year, exam.semester, exam.term);
  const myC = /^고/.test(gk) ? courseTrie(exam.grade, exam.year, exam.subject || '') : '';
  const cur = (c) => String(c).split('.').slice(0, 3).join('.');
  const exams = [], probs = [], skip = { course: 0, noBridge: 0 };
  ((ms && ms.exams) || []).forEach((e) => {
    if (gradeKey(e.grade) !== gk) return;
    if (mydb && String(e.id) === String(mydb)) return;
    if (!(termOrd(e.year, e.semester, e.term) < me)) return;   /* 같은 시험·뒤 시험은 뺀다 */
    if (Number(e.year) < Number(exam.year) - cfg.years) return;
    if (cfg.sameTerm && e.term !== exam.term) return;
    if (myC) { const c = courseTrie(e.grade, e.year, e.title || ''); if (c && cur(c) === cur(myC) && c !== myC) { skip.course++; return; } }
    const b = (br.byMydb || {})[String(e.id)];
    if (!b || !(b.problems || []).length) { skip.noBridge++; return; }
    const cells = (e.cells || []).slice().sort((x, y) => x.no - y.no), aligned = b.problems.length === cells.length;
    const label = `${e.year} ${e.semester}학기 ${e.term}`;
    exams.push({ mydb: String(e.id), exam: label, year: Number(e.year), sem: String(e.semester), term: e.term, n: cells.length, approx: !aligned });
    b.problems.forEach((p, i) => {
      const c = aligned ? cells[i] : null;
      probs.push({ k: `past:${e.id}:${c ? c.no : (p.no || i + 1)}`, mydb: String(e.id), exam: label, year: Number(e.year), sem: String(e.semester), term: e.term,
        no: c ? c.no : (p.no || i + 1), ord: termOrd(e.year, e.semester, e.term), cid: p.conceptId || p.cid || null, concept: p.concept || '', pid: p.problemId || null,
        store: c && c.img ? c.img : '', url: (c && c.imgUrl) || p.pimg || '', diff: c && c.difficulty != null ? Number(c.difficulty) : null, approx: !aligned });
    });
  });
  exams.sort((a, b) => termOrd(b.year, b.sem, b.term) - termOrd(a.year, a.sem, a.term));
  return { exams, probs, skip };
}
/* 문항 하나의 후보 (판정 전) — 원본 번호 같음 → 같은 유형 번호 → 같은 유형 이름 · 최근 시험 · 난이도 가까운 것 */
function pastCands(it, probs, pinK) {
  const nm = (s) => String(s || '').replace(/\s/g, '');
  const srcN = /^p\d+$/.test(it.src || '') ? Number(it.src.slice(1)) : null;
  const pool = [];
  probs.forEach((p) => {
    const idSame = !!(srcN && p.pid === srcN), cidSame = !!(it.cid && p.cid && String(p.cid) === String(it.cid)), nameSame = !!(it.type && nm(p.concept) && nm(p.concept) === nm(it.type));
    if (idSame || cidSame || nameSame || p.k === pinK) pool.push({ p, idSame, cidSame, nameSame });
  });
  const dd = (p) => (p.diff != null && it.diff != null ? Math.abs(p.diff - Number(it.diff)) : 9);
  pool.sort((a, b) => (b.p.k === pinK) - (a.p.k === pinK) || (b.idSame - a.idSame) || (b.cidSame - a.cidSame) || (b.p.ord - a.p.ord) || (dd(a.p) - dd(b.p)) || (a.p.no - b.p.no));
  return pool.slice(0, PAST_MAX);
}
const PAST_ORDER = { same: 4, var: 3, type: 2, text: 1 };
async function pastCompare(exam, items, prev, src, mydb, step) {
  const cfg = pastCfg(src);
  if (!cfg.on) { items.forEach((it) => { delete it.past; delete it.pastTop; delete it.pastHit; }); log('지난 기출 비교: 꺼 둠 (요청에서 끔)'); return null; }
  const ms = await kvGet('ms_exams_' + schoolKey(exam.school));
  const br = (await kvGet('ms_exam_bridge')) || { byMydb: {} };
  const S = pastSelect(exam, ms, br, cfg, mydb);
  log(`지난 기출 비교: ${schoolKey(exam.school)} ${gradeKey(exam.grade)} 지난 시험 ${S.exams.length}장 · 문항 ${S.probs.length}개 (최근 ${cfg.years}년${cfg.sameTerm ? ' · 같은 ' + exam.term + '만' : ''}${S.skip.course ? ' · 다른 과목 ' + S.skip.course + '장 뺌' : ''}${S.skip.noBridge ? ' · 유형 번호 없는 ' + S.skip.noBridge + '장 뺌' : ''})`);
  const st = { same: 0, var: 0, type: 0, text: 0, items: 0, cands: 0, idSame: 0, exams: S.exams.length, years: cfg.years, sameTerm: cfg.sameTerm,
    list: S.exams.map((x) => ({ mydb: x.mydb, exam: x.exam, year: x.year, sem: x.sem, term: x.term, n: x.n })) };
  let n = 0;
  for (const it of items) {
    n++; if (step && (n === 1 || n % 5 === 0)) await step(`지난 기출과 비교 중 ${n}/${items.length}`, 96);
    const old = prev && (prev.items || []).find((x) => x.no === it.no);
    const oldPast = (old && old.past) || [], oldHit = old && old.pastHit;
    const pinK = oldHit && oldHit.ok != null && oldHit.k ? oldHit.k : null;
    const picks = pastCands(it, S.probs, pinK);
    const cands = [];
    for (const c of picks) {
      let buf = null;
      if (!NO_AI && it.img) {
        try { buf = c.p.store ? await stGet(BUCKET, c.p.store) : (c.p.url ? await fetchBuf(c.p.url) : null); } catch (e) { buf = null; }
        if (!buf) continue;
      }
      c.buf = buf; cands.push(c);
    }
    let verdict = { cands: [] };
    if (!NO_AI && it.img && cands.length) {
      try { const eb = await stGet(BUCKET, it.img); verdict = await judgeItem(eb, cands, PAST_RULE); }
      catch (e) { log(`${it.no}번 지난 기출 판정 실패: ${e.message.slice(0, 120)}`); }
    }
    it.past = cands.map((c, i) => {
      const v = (verdict.cands || []).find((x) => Number(x.i) === i + 1); const k = v && v.kind;
      let kind = (k === 'same' || k === 'var' || k === 'text') ? k : ((c.cidSame || c.nameSame || c.idSame) ? 'type' : 'none');
      const o = oldPast.find((x) => x.k === c.p.k);
      const out = { k: c.p.k, mydb: c.p.mydb, exam: c.p.exam, year: c.p.year, sem: c.p.sem, term: c.p.term, no: c.p.no, kind,
        why: String((v && v.why) || (c.idSame ? '원본 번호 같음' : (c.cidSame ? '같은 유형 번호' : '같은 유형 이름'))).slice(0, 40),
        img: c.p.store || '', imgUrl: c.p.url || '', idSame: c.idSame };
      if (c.p.approx) out.approx = true;
      if (o && o.rejected) out.rejected = true;
      if (o && o.ai) out.ai = o.ai;
      return out;
    }).filter((x) => x.kind !== 'none');
    it.past.sort((a, b) => (b.k === pinK) - (a.k === pinK) || PAST_ORDER[b.kind] - PAST_ORDER[a.kind]);
    /* 원장님 확정은 그 후보가 아직 있을 때 그대로 (「겹침 없음」 확정은 늘 그대로) */
    if (oldHit && oldHit.ok != null && (!oldHit.k || it.past.some((x) => x.k === oldHit.k))) it.pastHit = oldHit; else delete it.pastHit;
    const top = it.past.filter((x) => !x.rejected).sort((a, b) => PAST_ORDER[b.kind] - PAST_ORDER[a.kind])[0] || null;
    it.pastTop = top ? { k: top.k, kind: top.kind } : null;
    if (top) st[top.kind]++;
    if (top && (top.kind === 'same' || top.kind === 'var')) st.items++;
    st.cands += it.past.length; if (it.past.some((x) => x.idSame)) st.idSame++;
    if (it.past.length) log(`${it.no}번 지난 기출: ${it.past.map((x) => x.exam.replace(/학기 /, '-') + ' ' + x.no + '번 ' + x.kind).join(' · ')}`);
  }
  log(`지난 기출 비교 끝: 같은 문제 ${st.same} · 숫자변형 ${st.var} · 유사유형 ${st.type} · 지문만 ${st.text} → 학교 기출에서 다시 나온 문항 ${st.items}개 (후보 ${st.cands}개 · 원본 번호 같음 ${st.idSame}문항)`);
  return st;
}

/* ══ 출판사 교과서 출처 찾기 (2026-10-11 원장: 「매쓰플랫 교과서 출판사별 자료와 범박고 기출을 비교해서 숫자변형 문제가
 *    어느 출판사에서 나왔는지 … 비상교육인데 다른 출판사에서 출제한 것 같다. 비상교육도 포함해서 모든 출판사의 교과서」)
 *   시험 과목(공통수학2·미적분1 …)의 매쓰플랫 «모든 출판사» 교과서 은행(mf_textbook_<bid>, sync/mf_textbook_bank.js --subject)에서
 *   시험 문항과 유형 번호(cid)가 같은 문항을 출판사마다 전부(최대 PUB_PER 개 · 난도 가까운 순) → 그림 판정(same/var/text) → 출판사별로 센다.
 *   우리 자료 적중·지난 기출 비교와 따로. src.pub = { on } — 고등부 기본 켬.
 *   저장 it.pub = [{ k:'pub:<문항id>', bid, pub, page, no, kind, why, imgUrl }] · it.pubTop = { k, kind, pub }
 *        stats.pub = { subject, books:[{ bid, pub, n }], by:{ <출판사>: { same, var, text, type, nos:[시험 번호] } }, items, missing:[과목 은행 없는 출판사] } */
const PUB_PER = 15, PUB_BATCH = 8;   /* 같은 유형 문항은 사실상 전부(고1 범박고 기준 580개 · 판정 약 80번) */
function pubCfg(src) { const p = (src && src.pub) || {}; return { on: p.on !== false }; }
function pubName(title) { const m = String(title || '').match(/^교과서_(.+?)\s*-\s*/); return m ? m[1] : String(title || '').replace(/^교과서_?/, '').split(' - ')[0]; }
function pubCands(it, banks) {
  const out = [];
  banks.forEach((b) => {
    const same = b.problems.filter((p) => it.cid && p.cid && String(p.cid) === String(it.cid) && p.pimg);
    const dl = (p) => (p.level != null && it.level != null ? Math.abs(Number(p.level) - Number(it.level)) : 9);
    same.sort((a, c) => dl(a) - dl(c) || a.page - c.page).slice(0, PUB_PER).forEach((p) => out.push({ b, p }));
  });
  return out;
}
const PUB_RULE = JUDGE_RULE.replace('그 뒤 그림들은 학원 학생들이 시험 전에 풀었던 «학원 자료 후보»다.', '그 뒤 그림들은 «여러 출판사 교과서의 문항 후보»다.');
/* 2026-10-12 중학교: 옛(15)·새(22) 과정 교과서 이름이 같다 → 시험 학년·해로 과정을 정한다 (22개정은 2025 중1·고1 입학부터) */
function pubRev(exam) {
  const n = Number(String(gradeKey(exam.grade)).replace(/\D/g, '')) || 1;
  return (Number(exam.year) - (n - 1)) >= 2025 ? 'CURRICULUM_22' : 'CURRICULUM_15';
}
function pubSubject(exam) {
  if (exam.subject) return exam.subject;
  const g = gradeKey(exam.grade); return /^중/.test(g) ? '중등수학' + String(g).replace(/\D/g, '') : '';
}
async function pubBanks(subject, rev) {
  const subj = String(subject || '').replace(/\s/g, '');
  if (!subj) return { banks: [], missing: [] };
  const idx = (await kvGet('mf_bookbank_index')) || {};
  const mid = /^중등/.test(subj);
  const bids = Object.keys(idx).filter((b) => { const t = String(idx[b].title || ''); if (!(/^교과서_/.test(t) && t.replace(/\s/g, '').split('-').pop() === subj)) return false;
    const r = idx[b].revision || ''; return rev ? (r ? r === rev : !mid && rev === 'CURRICULUM_22') : true; });
  const banks = [];
  for (const bid of bids) { const v = await kvGet('mf_textbook_' + bid); if (v && (v.problems || []).length) banks.push({ bid, pub: pubName(v.title) || v.publisher, title: v.title, problems: v.problems }); }
  banks.sort((a, c) => a.pub.localeCompare(c.pub, 'ko'));
  return { banks, missing: [] };
}
async function pubCompare(exam, items, prev, src, step) {
  const cfg = pubCfg(src);
  if (!cfg.on || !/^[고중]/.test(gradeKey(exam.grade))) { if (!cfg.on) items.forEach((it) => { delete it.pub; delete it.pubTop; }); return null; }   /* 2026-10-12 중학교도 */
  const subject = pubSubject({ ...exam, subject: exam.subject || (prev && prev.exam && prev.exam.subject) || '' });
  const { banks } = await pubBanks(subject, pubRev(exam));
  if (!banks.length) { log(`출판사 교과서 비교: ${subject || '과목 모름'} 교과서 은행이 없어 건너뜀 (node sync/mf_textbook_bank.js --subject ${subject || '과목'})`); return null; }
  log(`출판사 교과서 비교: ${subject} ${banks.length}종 — ${banks.map((b) => b.pub + ' ' + b.problems.length).join(' · ')}`);
  const st = { subject, books: banks.map((b) => ({ bid: b.bid, pub: b.pub, n: b.problems.length })), by: {}, items: 0 };
  banks.forEach((b) => { st.by[b.pub] = { same: 0, var: 0, text: 0, type: 0, nos: [] }; });
  const ORD = { same: 4, var: 3, text: 2, type: 1 };
  let n = 0;
  for (const it of items) {
    n++; if (step && (n === 1 || n % 3 === 0)) await step(`출판사 교과서와 비교 중 ${n}/${items.length}`, 97);
    const old = prev && (prev.items || []).find((x) => x.no === it.no);
    const oldPub = (old && old.pub) || [];
    const picks = pubCands(it, banks); const cands = [];
    for (const c of picks) {
      if (!NO_AI && it.img) { let buf = null; try { buf = await fetchBuf(c.p.pimg); } catch (e) {} if (!buf) continue; c.buf = buf; }
      cands.push(c);
    }
    const kinds = {};
    if (!NO_AI && it.img && cands.length) {
      let eb = null; try { eb = await stGet(BUCKET, it.img); } catch (e) {}
      if (eb) {
        const groups = []; for (let i = 0; i < cands.length; i += PUB_BATCH) groups.push(cands.slice(i, i + PUB_BATCH));
        const res = await Promise.all(groups.map((g) => judgeItem(eb, g, PUB_RULE).catch((e) => { log(`${it.no}번 출판사 판정 실패: ${String(e.message).slice(0, 100)}`); return { cands: [] }; })));
        res.forEach((r, gi) => (r.cands || []).forEach((v) => { const c = groups[gi][Number(v.i) - 1]; if (c) kinds['pub:' + c.p.id] = v; }));
      }
    }
    it.pub = cands.map((c) => {
      const k = 'pub:' + c.p.id, v = kinds[k]; const kind = v && ['same', 'var', 'text'].indexOf(v.kind) >= 0 ? v.kind : 'type';
      const o = oldPub.find((x) => x.k === k);
      const out = { k, bid: c.b.bid, pub: c.b.pub, page: c.p.page, no: c.p.no, kind, why: String((v && v.why) || '같은 유형 번호').slice(0, 40), imgUrl: c.p.pimg };
      if (o && o.rejected) out.rejected = true;
      if (o && o.by === 'teacher') { out.kind = o.kind; out.by = 'teacher'; out.ai = o.ai || kind; if (o.at) out.at = o.at; }   // 2026-10-12 학원앱 v19-116: 원장님이 고른 등급은 다시 비교해도 그대로
      return out;
    }).filter((x) => x.kind !== 'type' || x.by === 'teacher' || NO_AI || !it.img);
    it.pub.sort((a, c) => ORD[c.kind] - ORD[a.kind] || a.pub.localeCompare(c.pub, 'ko'));
    const live = it.pub.filter((x) => !x.rejected);
    const top = live[0] || null; it.pubTop = top ? { k: top.k, kind: top.kind, pub: top.pub } : null;
    /* 출판사별: 그 출판사에서 가장 닮은 것 하나로 센다 */
    const best = {}; live.forEach((x) => { if (!best[x.pub] || ORD[x.kind] > ORD[best[x.pub]]) best[x.pub] = x.kind; });
    Object.keys(best).forEach((pb) => { if (!st.by[pb]) return; st.by[pb][best[pb]]++; if (best[pb] === 'same' || best[pb] === 'var') st.by[pb].nos.push(it.no); });
    if (top && (top.kind === 'same' || top.kind === 'var')) st.items++;
    const sv = live.filter((x) => x.kind === 'same' || x.kind === 'var');
    log(`${it.no}번 출판사: 후보 ${cands.length} → ${sv.length ? sv.map((x) => x.pub + ' ' + x.page + '쪽 ' + x.no + ' ' + x.kind).join(' · ') : '같은/숫자변형 없음'}`);
  }
  log(`출판사 교과서 비교 끝: 같은 문제·숫자변형이 있는 문항 ${st.items}개 — ` + Object.keys(st.by).map((pb) => `${pb} ${st.by[pb].same + st.by[pb].var}`).join(' · '));
  return st;
}

/* ══ 한 시험 처리 ═════════════════════════════════════════════ */
async function runExam(exam, opt) {
  const step = opt.step || (async () => {});
  const examId = exam.examId || examIdOf(exam);
  const slug = slugOf(examId);
  const T = tw();
  const prev = (await kvGet('exam_hit_' + examId)) || null;
  /* 2026-10-10: 고등부는 과목별 교육과정 키 (예전엔 중학교 키로 인식돼 미적분1 시험이 「일차함수」로 읽혔다) — courseTrie 참고 */
  let subjText = exam.subject || '';
  if (!subjText && opt.mydb && /^고/.test(gradeKey(exam.grade))) { try { const ix = await kvGet('ms_mydb_index'); const it = ((ix && ix.items) || []).find((x) => String(x.id) === String(opt.mydb)); subjText = (it && it.t) || ''; } catch (e) {} }
  const trie = courseTrie(exam.grade, exam.year, subjText) || T.trieForExam(String(gradeKey(exam.grade)).replace(/\D/g, ''), exam.semester, exam.year);
  if (/^고/.test(gradeKey(exam.grade))) log(courseTrie(exam.grade, exam.year, subjText) ? `교육과정 키 ${trie} (과목: ${subjText.slice(0, 40)})` : `⚠ 고등부 과목을 몰라 예전 키(${trie})로 인식 — 요청 화면에서 과목을 고르면 정확해집니다`);
  if (!trie) throw new Error(`교육과정 키를 정할 수 없습니다 (${exam.grade} ${exam.semester}학기 ${exam.year})`);

  /* ①② 시험지 → 문항 */
  let items, msLv = (prev && prev.exam && prev.exam.msLv) || null;
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
      msLv = []; (e.cells || []).forEach((c) => { if (c.no) msLv[c.no - 1] = c.difficulty == null ? null : Number(c.difficulty); });   /* v19-81: 카드뉴스 난이도(1~9) */
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

  /* ③ 우리 자료 — 2026-10-10 원장 결정: 교과서 · 수학비서 학습지 · PDF 자료함 · 매쓰플랫 기록 (docs/exam_hit_contract.md §10) */
  await step('자료 모으는 중', 40);
  const codes = await loadStudents(exam.school, exam.grade);
  const from = opt.from || semStart(exam.year, exam.semester);
  const to = opt.to || exam.date || new Date().toISOString().slice(0, 10);
  const own = new RegExp(`${schoolKey(exam.school)}[^\\n]*${exam.year}[^\\n]*${exam.semester}학기[^\\n]*${exam.term}`);
  const src = normSrc(opt.src || (opt.rejudge && prev && prev.src) || null, exam);
  const mats = src.mf ? await loadMaterials(codes, from, to, own) : [];
  if (!src.mf) log('매쓰플랫 기록은 빼고 모음 (요청에서 끔)');
  const ctx = { step, trie, mydb: opt.mydb ? String(opt.mydb) : '' };
  const tbMats = src.tb.on ? await loadTextbookMats(src.tb, exam, items, mats, names) : [];
  tbMats.forEach((m) => mats.push(m));
  const msR = await loadMsMats(src.ms, ctx); msR.mats.forEach((m) => mats.push(m));
  const mpR = await loadMpMats(src.mp, ctx); mpR.mats.forEach((m) => mats.push(m));   /* 2026-10-11 내 문제지(학원 문제지) */
  const libR = await loadLibMats(src.lib, ctx); libR.mats.forEach((m) => mats.push(m));
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
  /* 띠에 보이는 글 — 「자료 모으는 중 — 교과서 783 · 수학비서 3장 · 프린트 1장」 */
  const nPrint = libR.n + (opt.uploads || []).length;
  await step(`자료 모으는 중 — 교과서 ${tbMats.length} · 학원 문제지 ${mpR.n}장 · 수학비서 ${msR.n}장 · 프린트 ${nPrint}장${src.mf ? ' · 매쓰플랫 ' + mats.filter((m) => m.kind === 'ws' || m.kind === 'book').length : ''}`, 44);
  /* 2026-10-11 원장: 「시험 범위 단원만」 — 모든 자료에서 시험 문항의 소단원(mf_typedb)에 없는 문항을 뺀다. 유형이 없는 문항은 남긴다 */
  const U = await unitIndex();
  const units = examUnits(items, U);
  const dropped = {}; const kindKey = (m) => (m.mp ? 'mp' : m.kind);
  if (src.scope === 'exam' && units.lits.size + units.mids.size) {
    const before = {}; mats.forEach((m) => { before[kindKey(m)] = (before[kindKey(m)] || 0) + 1; });
    const kept = mats.filter((m) => { const ok = inScope(m.cid, U, units); if (!ok) dropped[kindKey(m)] = (dropped[kindKey(m)] || 0) + 1; return ok; });
    mats.length = 0; kept.forEach((m) => mats.push(m));
    log(`시험 범위 단원만 (소단원 ${units.lits.size}개): ` + Object.keys(before).map((k) => `${k} ${before[k]}→${before[k] - (dropped[k] || 0)}`).join(' · '));
  } else if (src.scope === 'exam') log('시험 범위 단원만 — 시험 문항 단원을 몰라 전체를 씀');
  const byCid = {}; mats.forEach((m) => { if (m.cid) (byCid[m.cid] = byCid[m.cid] || []).push(m); });
  /* 2026-10-18 원장 「소사고 고1 23번과 같은 문제가 수학비서 학습지에 있는데 재검색 때 안 들어갔다」
     까닭: 후보를 «매쓰플랫 유형 번호(cid)가 같은 것»으로만 골랐다. 매쓰플랫 AI 가 같은 문제에 다른 유형을 붙이면(23번: 집합의 연산 법칙 ↔ 원소배치해석) 아예 후보에 못 올라간다.
     고침: 수학비서 자료(내 문제지 · 학습지)는 «같은 소단원»까지 넓혀 보고, 수학비서가 붙인 단원·태그 글자와 시험 문항의 «묻는 것»이 얼마나 겹치는지로 순위를 매겨 위 3개를 후보에 더한다. */
  const byLit = {}; mats.forEach((m) => { if (m.kind !== 'ms' || !m.cid) return; const u = U.of(m.cid); const key = u && (u.lit || u.mid); if (key) (byLit[key] = byLit[key] || []).push(m); });
  const grams = (t) => { const g = new Set(), z = String(t || '').replace(/[^가-힣a-zA-Z0-9]/g, ''); for (let i = 0; i + 1 < z.length; i++) g.add(z.slice(i, i + 2)); return g; };
  const nearScore = (it, m) => { const a = grams((it.ask || '') + ' ' + (it.type || '')), b = grams((m.msChapter || '') + ' ' + (m.msTags || []).join(' ') + ' ' + (m.type || '')); if (!a.size || !b.size) return 0; let n = 0; a.forEach((x) => { if (b.has(x)) n++; }); return n / Math.min(a.size, b.size); };
  const nearOf = (it) => { const u = U.of(it.cid); const key = u && (u.lit || u.mid); if (!key || !byLit[key]) return [];
    return byLit[key].filter((m) => String(m.cid) !== String(it.cid)).map((m) => ({ m, sc: nearScore(it, m) - Math.abs((m.level || 3) - (it.level || 3)) * 0.03 }))
      .filter((x) => x.sc >= 0.2).sort((a, b) => b.sc - a.sc).slice(0, 3); };

  /* ④ 후보 + 판정 */
  const past = await pastTypes(exam);
  const used = {};
  let n = 0;
  if (mats.some((m) => m.kind === 'ws' || m.kind === 'book')) { try { await T.mfLogin(); } catch (e) { log('매쓰플랫 로그인 실패 — 후보 그림 없이 진행'); } }
  for (const it of items) {
    n++; await step(`판정 중 ${n}/${items.length}`, 45 + Math.round(50 * n / items.length));
    it.repeat = past.of(it).slice(0, 6);
    const srcN = /^[pbs]\d+$/.test(it.src || '') ? Number(it.src.slice(1)) : null, srcP = String(it.src || '')[0];
    const pool = {};
    /* 원본 번호가 같은 자료 (유형이 달라도) */
    mats.forEach((m) => { if (srcN && ((srcP === 'p' && m.pid === srcN) || (srcP === 'b' && m.wbp === srcN))) pool[m.k] = { m, idSame: true }; });
    (byCid[it.cid] || []).forEach((m) => { if (!pool[m.k]) pool[m.k] = { m, idSame: false }; });
    const near = nearOf(it); near.forEach((x) => { if (!pool[x.m.k]) pool[x.m.k] = { m: x.m, idSame: false, near: x.sc }; });
    if (near.length) log(`  ${it.no}번 같은 소단원 수학비서 후보 ${near.length}: ` + near.map((x) => x.m.k + ' ' + x.sc.toFixed(2)).join(', '));
    /* 다시 판정 때 원장님이 ✓/✗ 로 확정했던 후보는 순위와 상관없이 늘 맨 앞에 남긴다 (2026-10-11 — 순위가 바뀌어 확정이 풀리던 문제) */
    const oldIt = prev && (prev.items || []).find((x) => x.no === it.no);
    const pinK = oldIt && oldIt.hit && oldIt.hit.ok != null && oldIt.hit.k ? oldIt.hit.k : null;
    if (pinK && !pool[pinK]) { const pm = mats.find((m) => m.k === pinK); if (pm) pool[pinK] = { m: pm, idSame: false }; }
    const wrong = (m) => Object.values(m.res).filter((r) => r === 'X' || r === '?').length;
    const solved = (m) => Object.keys(m.res).length;
    const ranked = Object.values(pool).sort((a, b) => (b.idSame - a.idSame) || (Math.abs((a.m.level || 3) - (it.level || 3)) - Math.abs((b.m.level || 3) - (it.level || 3))) || (wrong(b.m) - wrong(a.m)) || (solved(b.m) - solved(a.m)));
    /* 그림을 받아 같은 그림(같은 원본 문제)은 하나로 */
    /* 자리 나눠 주기 (2026-10-11): 학생 기록이 없는 자료(내 문제지 · 교과서 · 나만의 DB)는 «푼 학생·틀린 수» 순위에서 늘 밀린다.
       원본 번호가 같은 것은 맨 앞 그대로 두고, 그다음 6자리 안에 내 문제지 2 · 교과서 1 · 나만의 DB 1 자리를 먼저 준다. */
    const head = ranked.filter((c) => c.idSame), rest = ranked.filter((c) => !c.idSame), pick = [];
    const take = (pred, n) => { for (const c of rest) { if (n <= 0) break; if (pick.indexOf(c) < 0 && pred(c.m)) { pick.push(c); n--; } } };
    take((m) => m.mp, 2); take((m) => m.kind === 'textbook', 1); take((m) => m.kind === 'ms' && !m.mp, 1);
    /* 같은 소단원에서 넓혀 찾은 수학비서 후보 중 글자가 가장 많이 겹치는 것 하나는 꼭 넣는다 */
    { const bestNear = rest.filter((c) => c.near != null && pick.indexOf(c) < 0).sort((a, b) => b.near - a.near)[0]; if (bestNear) pick.unshift(bestNear); }
    let ordered = head.concat(pick, rest.filter((c) => pick.indexOf(c) < 0));
    if (pinK && pool[pinK]) ordered = [pool[pinK]].concat(ordered.filter((c) => c !== pool[pinK]));
    const cands = []; const seenPid = {};
    for (const c of ordered) {
      if (cands.length >= 6) break;
      const m = c.m;
      let buf = null;
      if (m.store) buf = await stGet(BUCKET, m.store).catch(() => null);   /* 우리 프린트 · 자료함 · 수학비서 학습지 (exam_images) */
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
    else if (old && old.hit && old.hit.ok === true && /^pub:/.test(old.hit.k || '')) it.hit = old.hit;   // 2026-10-12 학원앱 v19-116: 출판사 교과서 문항으로 확정한 적중 (mats 칸은 아래에서 옮김)
    else it.hit = null;
    const top = it.cands[0];
    log(`${it.no}번: 후보 ${cands.length} → ${top ? top.kind : '없음'}${it.repeat.length ? ' · 반복' : ''}`);
  }

  /* ⑤-2 지난 기출 비교 — 우리 자료와 따로 (2026-10-11) */
  const pastSt = await pastCompare({ ...exam, subject: exam.subject || subjText }, items, prev, src, opt.mydb || (prev && prev.exam && prev.exam.mydb) || null, step);
  /* ⑤-3 출판사 교과서 출처 — 모든 출판사 교과서와 (2026-10-11) */
  const pubSt = await pubCompare({ ...exam, subject: exam.subject || subjText }, items, prev, src, step);

  /* 저장용 자료(쓰인 것만) */
  const matOut = {};
  for (const m of mats) {
    if (!used[m.k]) continue;
    if (m.store && !m.storeUrl) m.storeUrl = await stSign(m.store);   /* 학원앱이 서명 없이 그림을 열게 (1년) */
    matOut[m.k] = { kind: m.kind, title: m.title, where: whereOf(m), cid: m.cid, level: m.level, img: m.img || '', store: m.store || '', storeUrl: m.storeUrl || '', res: m.res };
    if (m.lib) matOut[m.k].lib = true;
    if (m.mp) { matOut[m.k].mp = true; if (m.msChapter) matOut[m.k].msChapter = m.msChapter; }   /* 2026-10-11 내 문제지 */
  }
  /* 2026-10-12 학원앱 v19-116: 원장님이 출판사 교과서 문항으로 확정한 적중의 자료 칸(pub:…)은 앞 결과에서 그대로 옮긴다 */
  items.forEach((it) => { const k = it.hit && it.hit.ok === true && it.hit.k; if (k && /^pub:/.test(k) && !matOut[k] && prev && prev.mats && prev.mats[k]) matOut[k] = prev.mats[k]; });

  /* 통계 */
  const st = { total: items.length, same: 0, var: 0, text: 0, type: 0, killers: items.filter((x) => x.killer).length,
    essay: items.filter((x) => x.essay).length, levelAvg: 0, source: { textbook: 0, workbook: 0, exam: 0, bank: 0 }, repeat: items.filter((x) => (x.repeat || []).length).length };
  items.forEach((x) => { const t = x.cands && x.cands[0]; if (t) st[t.kind]++; st.source[x.source] = (st.source[x.source] || 0) + 1; st.levelAvg += Number(x.level || 0); });
  st.levelAvg = items.length ? Math.round(st.levelAvg / items.length * 10) / 10 : 0;
  /* 2026-10-10: 자료 종류별 — mats = 대조한 문항 수, hit = 자동 1순위 후보가 그 종류인 적중 문항 수(기준 안).
   *   원장님 ✓/✗ 확정을 반영한 숫자는 학원앱이 화면에서 다시 센다(htStats 와 같은 방식). */
  const basis = (prev && prev.basis) || 'same+var';
  const inB = { same: ['same'], 'same+var': ['same', 'var'], type: ['same', 'var', 'type'] }[basis] || ['same', 'var'];
  st.byKind = {}; ['textbook', 'ms', 'upload', 'ws', 'book'].forEach((k) => { st.byKind[k] = { mats: 0, hit: 0 }; });
  mats.forEach((m) => { if (st.byKind[m.kind]) st.byKind[m.kind].mats++; });
  items.forEach((x) => { const t = x.cands && x.cands[0]; const m = t && matOut[t.k]; if (m && inB.includes(t.kind) && st.byKind[m.kind]) st.byKind[m.kind].hit++; });
  /* 2026-10-11: 내 문제지(학원 문제지)는 ms 에 들어가고, 따로도 센다 — ms.mp = { mats, hit, papers } · 시험 범위로 뺀 수 scopeDropped */
  st.byKind.ms.mp = { mats: mats.filter((m) => m.mp).length, hit: 0, papers: mpR.n, cands: 0 };
  items.forEach((x) => { const t = x.cands && x.cands[0]; if (t && /^mp:/.test(t.k) && inB.includes(t.kind)) st.byKind.ms.mp.hit++; (x.cands || []).forEach((c) => { if (/^mp:/.test(c.k)) st.byKind.ms.mp.cands++; }); });
  st.byKind.ms.papers = msR.n;
  Object.keys(dropped).forEach((k) => { if (k === 'mp') st.byKind.ms.mp.scopeDropped = dropped.mp; const kk = k === 'mp' ? 'ms' : k; if (st.byKind[kk]) st.byKind[kk].scopeDropped = (st.byKind[kk].scopeDropped || 0) + dropped[k]; });
  st.scope = src.scope === 'exam' ? 'exam' : 'all';
  if (pastSt) st.past = pastSt;   /* 2026-10-11: 학교 기출에서 다시 나온 문항 — 우리 자료 적중률과 따로 */
  if (pubSt) st.pub = pubSt;   /* 2026-10-11: 출판사 교과서 출처 */

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

  const out = { examId, exam: { school: schoolKey(exam.school), grade: gradeKey(exam.grade), year: Number(exam.year), semester: String(exam.semester), term: exam.term, date: exam.date || '', mydb: opt.mydb || null, msLv: msLv || null, subject: exam.subject || (prev && prev.exam && prev.exam.subject) || '' },
    basis: (prev && prev.basis) || 'same+var', from, to, students: codes, items, mats: matOut, stats: st, trend, src: opt.src || (prev && prev.src) || null,
    units: units.list,   /* 2026-10-11: 시험 범위 단원(소단원) — 학원앱 「범위」 칩 */
    at: new Date().toISOString(), by: 'worker', confirmedAt: (prev && prev.confirmedAt) || null,
    ...(prev && prev.autoAi === false ? { autoAi: false } : {}) };   /* 학원앱 v19-128: 원장님이 끈 «🤖 AI 판정 자동 반영»은 다시 판정 뒤에도 꺼 둔다 */
  await kvSet('exam_hit_' + examId, out);
  const idx = (await kvGet('exam_hit_index')) || { items: [] };
  idx.items = (idx.items || []).filter((x) => x.examId !== examId);
  idx.items.push({ examId, school: out.exam.school, grade: out.exam.grade, year: out.exam.year, semester: out.exam.semester, term: out.exam.term, total: st.total, auto: { same: st.same, var: st.var, type: st.type, text: st.text }, at: out.at });
  idx.items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  await kvSet('exam_hit_index', idx);
  log(`저장: exam_hit_${examId} — ${st.total}문항 · 같은 문제 ${st.same} · 변형 ${st.var} · 유형 ${st.type} · 지문만 ${st.text} · 학생 ${codes.length}명 · 자료 ${Object.keys(matOut).length}`);
  log(`자료 종류별 (대조 문항 / 적중): ${Object.keys(st.byKind).map((k) => k + ' ' + st.byKind[k].mats + '/' + st.byKind[k].hit).join(' · ')}`);
  if (st.byKind.ms.mp.papers) log(`  그중 학원 문제지(내 문제지) ${st.byKind.ms.mp.papers}장: 대조 ${st.byKind.ms.mp.mats} · 1순위 적중 ${st.byKind.ms.mp.hit} · 후보에 오른 것 ${st.byKind.ms.mp.cands}`);
  if (st.scope === 'exam') log(`  시험 범위로 뺀 문항: ${Object.keys(st.byKind).map((k) => k + ' ' + (st.byKind[k].scopeDropped || 0)).join(' · ')}`);
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

/* ══ 2026-10-10: 🎯 우리 자료 3종 — 교과서 · 수학비서 학습지 · PDF 자료함 (docs/exam_hit_contract.md §10) ════════
 * 원장 결정 2026-10-10: 「학년 폴더 기본 · 교과서 전체 포함 · 자료함 두자 · 다른 학교 기출 시험지는 기본 꺼 둠 ·
 *   교과서 은행 없는 책은 새벽 자동 생성」. 범박고 고1 분석이 «우리 자료 0개»였던 것(고등부는 매쓰플랫 기록이 없음)을 메운다.
 *
 *   요청 exam_hit_req.src = { tb:{ on, mode:'all'|'scope', bids:[…] }, ms:[수학비서 학습지 id…], lib:[자료함 id…], mf:true }
 *     src 가 없으면 예전과 같고, 고등부만 교과서 전체를 기본으로 넣는다.
 *   ms_paper_<id>   = { id, title, folder, grade, uploadedAt, n, status:'ready'|'pending'|'error', err, updated, items:[{ no, img, cid, level, src, srcWb, pid }] }
 *   ms_papers_index = { updated, items:[{ id, title, folder, grade, uploadedAt, n, status, exam }] }   (학원앱 목록용)
 *   exam_lib        = { updated, items:[{ id, title, school, grade, sem, year, uploadedAt, src, path, n, status, items:[…], deleted }] }
 *   그림은 모두 exam_images(비공개): ms/<id>/<번호>.png · lib/<id>.pdf · lib/<id>/<번호>.png
 */
const GRADE_FOLDERS = ['고1', '고2', '고3', '중1', '중2', '중3'];
const PREP_DAYS = 150;                       // 학년 폴더: 최근 150일 안에 올린(산) 학습지만 새벽에 인식
const LIST_DAYS = 365;                       // 다른 폴더: 1년 안 학습지만 목록에
const PREP_CAP = Number(arg('cap', 12)) || 12, LIB_CAP = 6;
const PAPER_MAX_Q = 600, PAPER_MAX_PAGES = 200;   /* 2026-10-11: 10쪽씩 나눠 인식하므로 150문항·60쪽 제한을 풀었다 */
const RETRY_H = 20;                          // 실패한 것은 20시간 뒤 다시
/* 기출 = 학교 시험지(school_exams)·「내신 …」 제목 · 전국 모의고사(public_mock_exams) — 다른 학교·지난 시험이라 기본으로 끈다 */
function isExamPaper(m) { return m.paperType === 'school_exams' || /public_mock/.test(m.paperType || '') || /^\s*내신/.test(m.title || ''); }
function paperDate(m) { return m.uploadedAt || m.purchasedAt || ''; }
function kstHour() { return (new Date().getUTCHours() + 9) % 24; }
/* 학기·연도 (교육과정 키를 고르는 데만 쓴다) — 3~6월 1학기, 그 밖 2학기(1·2월은 지난해) */
function semOf(iso) {
  const d = iso ? new Date(iso) : new Date(); const k = new Date(d.getTime() + 9 * 3600e3);
  const y = k.getUTCFullYear(), mo = k.getUTCMonth() + 1;
  if (mo >= 3 && mo <= 6) return { year: y, semester: '1' };
  return { year: mo <= 2 ? y - 1 : y, semester: '2' };
}
/* 고등부 과목 → 매쓰플랫 교육과정 키 (/curriculums/by-key 로 2026-10-10 확인: 22개정 고등 1.4.4147.<과정>, 15개정 고등 1.2.7.<과정>)
 *   중학교는 exam_twin_pipeline.trieForExam 그대로. 22개정 적용: 고1 2025 · 고2 2026 · 고3 2027 부터 (중학교와 같은 식) */
const HS_COURSE = {
  22: [[/공통\s*수학\s*(1|Ⅰ)|공수\s*1/, 4175], [/공통\s*수학\s*(2|Ⅱ)|공수\s*2/, 4176], [/대수/, 4177], [/미적분\s*(Ⅱ|II|2)/, 4180], [/미적분/, 4178], [/확률\s*과\s*통계|확통/, 4179], [/기하/, 4181]],
  15: [[/수학\s*\(?\s*상/, 41], [/수학\s*\(?\s*하/, 42], [/미적분/, 46], [/확률\s*과\s*통계|확통/, 45], [/기하/, 47], [/수학\s*(Ⅱ|II|2)/, 44], [/수학\s*(Ⅰ|I|1)/, 43]] };
function courseTrie(grade, year, text) {
  const gk = gradeKey(grade); if (!/^고\d/.test(gk)) return '';
  const is22 = Number(year) >= 2024 + Number(gk.slice(1));
  for (const [re, id] of HS_COURSE[is22 ? 22 : 15]) if (re.test(String(text || ''))) return (is22 ? '1.4.4147.' : '1.2.7.') + id;
  return '';
}
/* 적중 분석 시험과 같은 방식으로 교육과정 키 — 고등부는 제목·폴더에서 과목을 읽고, 모르면 예전 trieForExam */
function trieOf(grade, year, semester, text) { const c = courseTrie(grade, year, text); if (c) return c; const g = String(gradeKey(grade)).replace(/\D/g, ''); return g ? tw().trieForExam(g, semester, year) : ''; }
function tbTitle(t) { return String(t || '교과서').replace(/^교과서_/, '교과서 ').replace(/\s*-\s*/, ' ').trim(); }
/* 2026-10-11: 유형(cid) → 중단원·소단원 — mf_concept_names(유형 이름·중단원) + mf_typedb(중단원 › 소단원 › 유형 이름) */
const nz = (t) => String(t || '').replace(/\s/g, '');
async function unitIndex() {
  const names = (await kvGet('mf_concept_names')) || {}; const tdb = (await kvGet('mf_typedb')) || {};
  const litOf = {};
  (tdb.grades || []).forEach((g) => (g.b || []).forEach((b) => (b.m || []).forEach((m) => (m.s || []).forEach((l) => (l.t || []).forEach((t) => {
    const k = nz(m.n) + '|' + nz(t); if (!litOf[k]) litOf[k] = l.n; })))));
  const of = (cid) => { const n = cid && names[cid]; if (!n) return null; return { mid: n.m || '', lit: litOf[nz(n.m) + '|' + nz(n.n)] || '' }; };
  return { of };
}
function examUnits(items, U) {
  const lits = new Set(), mids = new Set(), list = [], seen = {};
  (items || []).forEach((it) => { const u = U.of(it.cid); if (!u) return; if (u.lit) lits.add(u.lit); if (u.mid) mids.add(u.mid);
    const k = u.mid + '|' + u.lit; if (!seen[k]) { seen[k] = 1; list.push({ mid: u.mid, lit: u.lit }); } });
  return { lits, mids, list };
}
/* 유형이 없거나 단원을 모르면 남긴다 · 소단원을 알면 소단원으로, 모르면 중단원으로 */
function inScope(cid, U, units) {
  if (!cid) return true; const u = U.of(cid); if (!u) return true;
  if (u.lit && units.lits.size) return units.lits.has(u.lit);
  if (u.mid && units.mids.size) return units.mids.has(u.mid);
  return true;
}
function normSrc(raw, exam) {
  const hs = /^고/.test(gradeKey(exam.grade));
  if (!raw || typeof raw !== 'object') return { tb: { on: hs, mode: 'all', bids: [] }, ms: [], mp: [], lib: [], mf: true, scope: 'all', past: pastCfg(null) };
  const tb = raw.tb || {};
  return { tb: { on: tb.on === true || (tb.on === undefined && hs), mode: tb.mode === 'scope' || raw.scope === 'exam' ? 'scope' : 'all', bids: (tb.bids || []).map(String) },
    ms: (raw.ms || []).map(String), mp: (raw.mp || []).map(String), lib: (raw.lib || []).map(String), mf: raw.mf !== false,
    scope: raw.scope === 'exam' ? 'exam' : 'all',   /* 2026-10-11: mp = 내 문제지 · scope = 시험 범위 단원만 */
    past: pastCfg(raw), pub: pubCfg(raw) };   /* 2026-10-11: 지난 기출 비교 { on, years, sameTerm } — 없으면 켬 · 최근 4년 · 중간/기말 모두 */
}
function matFromItem(kind, k, title, it, extra) {
  const s = String(it.src || ''), n = /^[pbs]\d+$/.test(s) ? Number(s.slice(1)) : null;
  return Object.assign({ k, kind, title, no: it.no, cid: it.cid || null, level: it.level || null, pid: it.pid || (s[0] === 'p' ? n : null),
    wbp: s[0] === 'b' ? n : null, store: it.img || '', res: {}, at: {} }, extra || {});
}
async function keysLike(prefix) {
  const out = new Set();
  for (let off = 0; off < 20000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.${encodeURIComponent(prefix)}*&select=key&order=key.asc&limit=1000&offset=${off}`, { headers: sbH() });
    if (!r.ok) break; const j = await r.json(); j.forEach((x) => out.add(x.key)); if (j.length < 1000) break;
  }
  return out;
}

/* ── (a) 교과서 — 그 학교·학년 지정 교과서 은행 전체(또는 시험 범위 단원 쪽만) ── */
async function textbookBids(exam) {
  const map = (await kvGet('mf_textbooks')) || {};
  const sg = (map.bySchoolGrade || {})[schoolKey(exam.school) + '|' + gradeKey(exam.grade)];
  return Object.keys((sg && sg.books) || {}).filter((b) => { const bk = (map.books || {})[b]; return !bk || !bk.type || bk.type === 'SCHOOL'; });
}
async function loadTextbookMats(tb, exam, items, have, names) {
  const bids = tb.bids.length ? tb.bids : await textbookBids(exam);
  const out = []; const haveWb = new Set(have.filter((m) => m.wbp).map((m) => String(m.wbp)));
  let scope = null;
  if (tb.mode === 'scope') {
    scope = { cids: new Set(items.map((i) => String(i.cid || '')).filter(Boolean)), chs: new Set(items.map((i) => (names[i.cid] || {}).m).filter(Boolean)) };
  }
  for (const bid of bids) {
    const bank = await kvGet('mf_textbook_' + bid);
    if (!bank || !(bank.problems || []).length) { log(`교과서 ${bid}: 은행 없음 — 새벽에 만든다 (--prep)`); continue; }
    const title = tbTitle(bank.title);
    const pageTitle = {}; (bank.pages || []).forEach((pg) => { pageTitle[pg.page] = pg.title || ''; });
    let probs = bank.problems, scoped = false;
    if (scope) {   /* 시험 문항의 유형이 나오는 쪽의 소단원 + 시험 문항 중단원 이름과 같은 쪽 → 그 소단원 쪽 전부 */
      const titles = new Set();
      bank.problems.forEach((p) => { if (p.cid && scope.cids.has(String(p.cid))) titles.add(pageTitle[p.page] || ''); });
      (bank.pages || []).forEach((pg) => { if (scope.chs.has(pg.title)) titles.add(pg.title); });
      titles.delete('');
      const kept = bank.problems.filter((p) => titles.has(pageTitle[p.page] || ''));
      if (kept.length) { probs = kept; scoped = true; } else log(`${title}: 시험 범위 단원과 맞는 쪽이 없어 전체를 씀`);
    }
    let dup = 0;
    probs.forEach((p) => {
      if (haveWb.has(String(p.id))) { dup++; return; }   /* 학생이 매쓰플랫에서 푼 같은 문항(교재 기록)이 이미 있다 — 정오가 있는 쪽을 남긴다 */
      out.push({ k: 'tb:' + p.id, kind: 'textbook', title, bid: String(bid), page: p.page, number: p.no, cid: p.cid || null, level: p.level || null,
        pid: pidOfUrl(p.pimg), wbp: p.id, img: p.pimg || '', res: {}, at: {} });
    });
    log(`${title}: ${probs.length}문항${scoped ? ' (시험 범위 단원만)' : ''}${dup ? ` · 매쓰플랫 기록과 겹친 ${dup}개는 기록 쪽으로` : ''}`);
  }
  return out;
}

/* ── 매쓰플랫 AI 인식 → exam_images 에 문항 그림 (시험지와 같은 길) ── */
let MF_IN = false;
/* 2026-10-11: 매쓰플랫 문서 인식(document-processing-flow)은 «한 번에 10쪽까지만» 받는다 — 넘으면
 *   「pageIndexes: must be valid」로 실패한다(711432 12쪽 · 703496, docs/mathflat_one_worksheet.md 와 같은 제한).
 *   그래서 10쪽씩 잘라 여러 번 인식하고 이어 붙인다. */
const CHUNK_PAGES = 10;
async function pdfSlice(bytes, from, to) {
  const { PDFDocument } = require('pdf-lib');
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true }); const out = await PDFDocument.create();
  const idx = []; for (let i = from; i < to; i++) idx.push(i);
  (await out.copyPages(src, idx)).forEach((pg) => out.addPage(pg));
  return { bytes: Buffer.from(await out.save()), pages: out.getPageCount() };
}
async function recognizeChunked(pdf, trie) {
  if (pdf.pages <= CHUNK_PAGES) return recognize(pdf.bytes, pdf.pages, trie);
  const out = [];
  for (let s = 0; s < pdf.pages; s += CHUNK_PAGES) {
    const part = await pdfSlice(pdf.bytes, s, Math.min(pdf.pages, s + CHUNK_PAGES));
    log(`  나눠 인식 ${s + 1}~${s + part.pages}쪽 / ${pdf.pages}쪽`);
    const bx = await recognize(part.bytes, part.pages, trie);
    bx.forEach((b) => { b.page += s; out.push(b); });
  }
  return out;
}
async function recognizeToStore(pdf, trie, prefix) {
  if (!MF_IN) { await tw().mfLogin(); MF_IN = true; }
  const boxes = await recognizeChunked(pdf, trie);
  const items = [];
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i], no = i + 1; const buf = await fetchBuf(b.url); if (!buf) continue;
    const img = await stPut(BUCKET, `${prefix}/${no}.png`, buf, mimeOf(buf) || 'image/png');
    const s = String(b.src || '');
    items.push({ no, img, cid: b.cid, level: b.level, src: s, srcWb: b.srcWb, pid: /^p\d+$/.test(s) ? Number(s.slice(1)) : null });
  }
  return items;
}

/* ── 2026-10-11: 수학비서 문항 그림(한 칸 = 한 문항) → «우리 상자 좌표»로 인식 ──
 *   매쓰플랫 AI 가 상자를 다시 찾게 두면 문항이 붙거나 갈라져 번호가 어긋난다(sync/mypaper_to_mathflat.js 와 같은 까닭).
 *   우리가 만든 PDF 라 칸마다 자리를 알고 있으니, 쪽 그림만 만들게 하고(document-processing-flow)
 *   유형 찾기(analysis-flow)는 우리 상자로 돌린다 → 수학비서 번호와 1:1. 10쪽씩 나눠 인식(문항 수 제한 없음). */
const zlib = require('zlib');
function pngDecode(buf) {   /* 8비트 · 비월(non-interlace) PNG → RGBA (수학비서 그림은 모두 8비트 RGBA) */
  if (!buf || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 아님');
  let o = 8, w = 0, h = 0, depth = 0, ct = 0, il = 0; const idat = []; let pal = null, trns = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ct = d[9]; il = d[12]; }
    else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || il) throw new Error('지원하지 않는 PNG');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error('지원하지 않는 PNG 색');
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * ch; const px = Buffer.alloc(stride * h); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = px.slice(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : (pb <= pc ? b : c); }
      cur[i] = v & 255;
    }
    prev = cur;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, al = 255;
    if (ct === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; al = px[i * 4 + 3]; }
    else if (ct === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ct === 0) { r = g = b = px[i]; }
    else if (ct === 4) { r = g = b = px[i * 2]; al = px[i * 2 + 1]; }
    else { const k = px[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; b = pal[k * 3 + 2]; al = trns && k < trns.length ? trns[k] : 255; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = al;
  }
  return { w, h, rgba };
}
const CRC_T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function pngEncode(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
/* 지문(passage) 그림을 문항 그림 위에 붙여 한 장으로 — 판정(Claude)이 지문까지 보게. 못 읽으면 문항 그림만 */
function stackPng(top, bottom) {
  try {
    const a = pngDecode(top), b = pngDecode(bottom), GAP = 12, w = Math.max(a.w, b.w), h = a.h + GAP + b.h;
    const out = Buffer.alloc(w * h * 4, 255);
    const put = (im, y0) => { for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const s = (y * im.w + x) * 4, d = ((y0 + y) * w + x) * 4, al = im.rgba[s + 3] / 255;
      for (let k = 0; k < 3; k++) out[d + k] = Math.round(im.rgba[s + k] * al + 255 * (1 - al)); out[d + 3] = 255; } };
    put(a, 0); put(b, a.h + GAP);
    return pngEncode(w, h, out);
  } catch (e) { return bottom; }
}
/* A4 2단 + 칸마다 상자 좌표 (sync/mypaper_to_mathflat.js buildPdf 와 같은 치수) · 10쪽이 차면 새 PDF */
async function packCells(cells) {
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
  const A4W = 595.28, A4H = 841.89, M = 24, GAP = 12, COLW = (A4W - M * 2 - GAP) / 2, NUMW = 22, PAD = 4, LEAD = 14;
  const parts = []; let P = null, page = null, col = 0, y = 0, font = null;
  const newDoc = async () => { if (P) P.done = true; const doc = await PDFDocument.create(); font = await doc.embedFont(StandardFonts.HelveticaBold); P = { doc, pageCount: 0, boxes: [], cells: [] }; parts.push(P); };
  const newPage = async () => { if (!P || P.pageCount >= CHUNK_PAGES) await newDoc(); page = P.doc.addPage([A4W, A4H]); P.pageCount++; col = 0; y = A4H - M; };
  await newPage();
  for (const c of cells) {
    const wh = pngWH(c.buf); if (!wh) continue;   /* 수학비서 그림은 PNG */
    const scale = Math.min(1, (COLW - NUMW - PAD) / wh.w, (A4H - 2 * M - LEAD - 4) / wh.h);
    const w = wh.w * scale, h = wh.h * scale, blockH = Math.max(h, 18) + LEAD;
    if (y - blockH < M) { if (col === 0) { col = 1; y = A4H - M; } else await newPage(); }
    let img; try { img = await P.doc.embedPng(c.buf); } catch (e) { continue; }
    const x0 = M + col * (COLW + GAP), yTop = y, yBot = y - blockH + 6;
    page.drawText(String(c.no), { x: x0 + 2, y: yTop - 13, size: 12, font, color: rgb(0.05, 0.25, 0.7) });
    page.drawImage(img, { x: x0 + NUMW, y: yTop - 2 - h, width: w, height: h });
    P.boxes.push({ pageNo: P.pageCount, x0, y0: yBot, x1: x0 + COLW, y1: yTop }); P.cells.push(c);
    y -= blockH;
  }
  const out = [];
  for (const p of parts) { if (!p.cells.length) continue; out.push({ bytes: Buffer.from(await p.doc.save()), pageCount: p.doc.getPageCount(), boxes: p.boxes, cells: p.cells, A4W, A4H }); }
  return out;
}
function pngWH(buf) { return buf && buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47 ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : null; }
function imgWH(buf) {   /* 쪽 그림은 PNG 또는 JPEG */
  const p = pngWH(buf); if (p) return p;
  if (buf && buf[0] === 0xff && buf[1] === 0xd8) { let o = 2; while (o < buf.length - 8) { if (buf[o] !== 0xff) { o++; continue; } const m = buf[o + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) }; o += 2 + buf.readUInt16BE(o + 2); } }
  return null;
}
async function recognizeOwnBoxes(part, trie) {
  const T = tw();
  const jobId = await T.saiJob();
  const { data: pres } = await T.mf(T.MF_SAI, 'POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: part.bytes });
  if (!up.ok) throw new Error(`PDF 업로드 실패 ${up.status}`);
  await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageIndexes: `1~${part.pageCount}`, pageImageQuality: 'HIGH' } });
  const doc = await T.saiPoll(jobId, 600000);
  if (!doc.pageImageUrls || doc.pageImageUrls.length !== part.pageCount) throw new Error(`쪽 그림 수가 다름 (${(doc.pageImageUrls || []).length}/${part.pageCount})`);
  const sz = imgWH(await fetchBuf(doc.pageImageUrls[0])); if (!sz) throw new Error('쪽 그림 크기를 못 읽음');
  const sx = sz.w / part.A4W, sy = sz.h / part.A4H;
  const boxesOnEachPage = Array.from({ length: part.pageCount }, () => []);
  part.boxes.forEach((b) => boxesOnEachPage[b.pageNo - 1].push([Math.round(b.x0 * sx), Math.round((part.A4H - b.y1) * sy), Math.round((b.x1 - b.x0) * sx), Math.round((b.y1 - b.y0) * sy)]));
  await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/analysis-flow', parameters: { pageImageUrls: doc.pageImageUrls, boxesOnEachPage, trieKey: trie } });
  const an = await T.saiPoll(jobId, 600000);
  const nBox = (an.boxesOnEachPage || []).reduce((a, b) => a + b.length, 0);
  if (nBox !== part.boxes.length) throw new Error(`분석 상자 수가 다름 (${nBox}/${part.boxes.length})`);
  return (an.sourceData || []).map((s) => s || {});
}
/* cells = [{ no, buf(png), meta? }] → exam_images/<prefix>/<no>.png + 매쓰플랫 유형 · 원본 번호 */
async function recognizeCellsToStore(cells, trie, prefix) {
  if (!MF_IN) { await tw().mfLogin(); MF_IN = true; }
  const parts = await packCells(cells);
  const items = [];
  for (const [pi, part] of parts.entries()) {
    if (parts.length > 1) log(`  나눠 인식 ${pi + 1}/${parts.length} · ${part.cells.length}문항 · ${part.pageCount}쪽`);
    let sd = null;
    try { sd = await recognizeOwnBoxes(part, trie); }
    catch (e) { log(`  인식 실패 (${pi + 1}/${parts.length}) — 유형 없이 그림만 둠: ${String(e.message).slice(0, 120)}`); sd = []; }
    for (const [k, c] of part.cells.entries()) {
      const s = sd[k] || {}; const src = String(s.sourceProblemId || '');
      const img = await stPut(BUCKET, `${prefix}/${c.no}.png`, c.buf, mimeOf(c.buf) || 'image/png');
      items.push(Object.assign({ no: c.no, img, cid: s.conceptId || null, level: s.level || null, src, srcWb: s.sourceWorkbookId || null,
        pid: /^p\d+$/.test(src) ? Number(src.slice(1)) : null }, c.meta || {}));
    }
  }
  return items;
}

/* ── (b) 수학비서 학습지 ── */
let MS_LIST = null, MS_LIST_AT = 0, MS_FOLD = null;
async function msPapers() {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('기출 DB 계정(MATHSECR_ID) 이 서버에 없습니다');
  /* PDF 주소(pdfPath)는 1시간짜리 서명이라 40분이 지나면 목록을 새로 받는다 */
  if (!MS_LIST || Date.now() - MS_LIST_AT > 40 * 60000) { const C = msc(); await C.msLogin(); MS_LIST = await C.msListMydbs(); MS_LIST_AT = Date.now(); }
  return MS_LIST;
}
async function msFolders() {
  if (MS_FOLD) return MS_FOLD;
  const C = msc(); const j = await C.msGet('/bms/api/v1/folders?folderType=mydb');
  const roots = Array.isArray(j.data) ? j.data : [j.data];
  const nameOf = {}, gradeOfId = {};
  (function walk(f, g) {
    if (!f) return; const nm = String(f.name || '').replace(/\s/g, '');
    const now = GRADE_FOLDERS.includes(nm) ? nm : g;   /* 학년 폴더 = 이름이 고1·고2 … 와 같은 폴더 (그 아래 폴더 포함) */
    if (f.id) { nameOf[f.id] = f.name || ''; if (now) gradeOfId[f.id] = now; }
    (f.children || []).forEach((c) => walk(c, now));
  })({ name: '', children: roots }, '');
  MS_FOLD = { nameOf, gradeOf: (id) => gradeOfId[id] || '', tree: roots.map(compactTree) };   /* 2026-10-11: 학원앱이 수학비서와 똑같은 폴더 나무를 그린다 */
  return MS_FOLD;
}
async function buildMsPaper(m, folder, grade, opt) {
  const out = { id: m.id, title: m.title || '', folder, grade, uploadedAt: paperDate(m), n: m.questionCount || null, status: 'pending', err: '', updated: '', items: [] };
  try {
    if (!ensurePdfLib()) throw new Error('pdf-lib 설치 실패');
    /* 2026-10-11: 150문항 넘는 것도 10쪽씩 나눠 인식한다 (너무 큰 것만 건너뜀) */
    if ((m.questionCount || 0) > PAPER_MAX_Q) throw new Error(`문항 수 초과 (${m.questionCount}문항 · 한 장 ${PAPER_MAX_Q}문항까지 — 나눠서 올려 주세요)`);
    const so = semOf(out.uploadedAt);
    const trie = (opt && opt.trie) || trieOf(grade || parseGrade(m.title), so.year, so.semester, (m.title || '') + ' ' + folder);
    if (!trie) throw new Error(`교육과정을 정할 수 없음 (${grade || '학년 모름'})`);
    let pdf = null;
    if (m.pdfPath) { const buf = await fetchBuf(m.pdfPath); if (buf && mimeOf(buf) === 'application/pdf') pdf = { bytes: buf, pages: await pdfPages(buf) }; }
    if (pdf) {
      if (pdf.pages > PAPER_MAX_PAGES) throw new Error(`쪽 수 초과 (${pdf.pages}쪽 · ${PAPER_MAX_PAGES}쪽까지)`);
      out.items = await recognizeToStore(pdf, trie, `ms/${m.id}`);
    } else {   /* 산 자료는 PDF 가 없다 → 문항 그림을 받아 «우리 상자»로 인식 (수학비서 번호 그대로) */
      const C = msc(); const ex = await C.msExam(Number(m.id) || m.id); const cells = [];
      for (const c of ex.cells) { if (!c.imgUrl) continue; try { const im = await C.msImage(c.imgUrl); if (mimeOf(im.buf) === 'image/png') cells.push({ no: c.no, buf: im.buf }); } catch (e) {} await sleep(60); }
      if (!cells.length) throw new Error('PDF 도 문항 그림도 없음');
      out.items = await recognizeCellsToStore(cells, trie, `ms/${m.id}`);
    }
    out.n = out.items.length; out.status = out.items.length ? 'ready' : 'error'; if (!out.items.length) out.err = '문항을 하나도 못 나눔';
  } catch (e) { out.status = 'error'; out.err = String(e.message || e).slice(0, 160); }
  out.updated = new Date().toISOString();
  try { await kvSet('ms_paper_' + m.id, out); } catch (e) { log(`ms_paper_${m.id} 저장 실패: ${e.message}`); }
  log(`  [${m.id}] ${out.status} · ${out.items.length}문항${out.err ? ' · ' + out.err : ''}`);
  return out;
}
function parseGrade(t) { return (String(t || '').match(/(중[1-3]|고[1-3])/) || [])[1] || ''; }
async function prepPaper(id, opt) {
  const all = await msPapers(); const m = all.find((x) => String(x.id) === String(id));
  if (!m) return { id, status: 'error', err: '기출 DB 에 그 학습지가 없음', items: [] };
  const F = await msFolders();
  const g = F.gradeOf(m.folderId);
  return buildMsPaper(m, g || F.nameOf[m.folderId] || '', g || parseGrade(m.title), opt);
}
async function loadMsMats(ids, ctx) {
  const out = []; let n = 0;
  for (const id of ids) {
    if (ctx.mydb && String(id) === ctx.mydb) { log(`수학비서 ${id}: 분석하는 시험지 자체라 자료에서 뺌`); continue; }
    let p = await kvGet('ms_paper_' + id);
    if (!p || p.status !== 'ready') {
      log(`수학비서 학습지 ${id}: ${p ? p.status : '아직 인식 안 됨'} → 분석 때 바로 인식`);
      await ctx.step(`수학비서 학습지 분석 때 바로 인식 중 (${n + 1}/${ids.length} · 장당 2~5분)`, 41);
      try { p = await prepPaper(id, { trie: ctx.trie }); } catch (e) { log(`수학비서 ${id} 인식 실패: ${e.message.slice(0, 120)}`); p = null; }
    }
    if (!p || p.status !== 'ready') { log(`수학비서 학습지 ${id}: 못 씀 (${(p && p.err) || ''}) — 빼고 진행`); continue; }
    n++; (p.items || []).forEach((it) => out.push(matFromItem('ms', `ms:${id}:${it.no}`, p.title, it)));
  }
  if (ids.length) log(`수학비서 학습지: ${n}장 · ${out.length}문항`);
  return { mats: out, n };
}

/* ── (b-2) 2026-10-11 수학비서 «내 문제지» — 원장님이 직접 만들어 나눠 준 프린트 ──
 * 원장 「수학비서는 DB 와 내 문제지가 다르다. 내 문제지가 내가 만든 것이다. 그리고 수학비서 폴더 형태와 똑같아야 헷갈리지 않는다.」
 *   폴더 나무 GET /bms/api/v1/folders?folderType=mypaper · 목록 /my-papers?folderId= · 문항 /my-papers/<id>/cells
 *   ms_mypapers_index = { updated, tree:[{ id, n, fc, tc, c:[…] }], items:[{ id, title, folderId, folderPath, n, progress, createdAt, status }] }
 *   ms_mypaper_<id>   = ms_paper_<id> 와 같은 모양(판정이 그대로 쓴다) + 수학비서 정보 msChapter · msTags · answer · msSource
 *   그림 exam_images/msmp/<id>/<번호>.png (지문이 있으면 위에 붙여 한 장) · 요청 src.mp = [id…] · 결과 자료 키 mp:<id>:<번호> (kind 'ms', mp:true) */
function compactTree(f) { return { id: f.id, n: f.name || '', fc: f.fileCount || 0, tc: f.totalFileCount || 0, c: (f.children || []).map(compactTree) }; }
async function msLoginOnce() {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('수학비서 계정(MATHSECR_ID) 이 서버에 없습니다');
  if (!msLoginOnce.at || Date.now() - msLoginOnce.at > 30 * 60000) { await msc().msLogin(); msLoginOnce.at = Date.now(); }
  return msc();
}
async function msMyTree() {
  const C = await msLoginOnce(); const j = await C.msGet('/bms/api/v1/folders?folderType=mypaper');
  const roots = Array.isArray(j.data) ? j.data : [j.data];
  const pathOf = {}; (function walk(f, pre) { if (!f) return; const p = pre ? pre + ' › ' + (f.name || '') : (f.name || ''); if (f.id) pathOf[f.id] = p; (f.children || []).forEach((c) => walk(c, p)); })({ children: roots }, '');
  /* 맨 위 이름 없는 묶음은 빼고 다시 */
  Object.keys(pathOf).forEach((k) => { pathOf[k] = pathOf[k].replace(/^ › /, ''); });
  return { roots, tree: roots.map(compactTree), pathOf };
}
async function msMyList(folderId) {
  const C = await msLoginOnce(); const out = []; let cursor = '';
  for (let i = 0; i < 30; i++) {
    const j = await C.msGet(`/bms/api/v1/my-papers?limit=100&folderId=${folderId}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    const d = j.data || []; out.push(...d);
    cursor = j.pagination && j.pagination.cursor; if (!cursor || !d.length || (j.pagination.totalItems && out.length >= j.pagination.totalItems)) break;
  }
  return out;
}
async function msMyCells(id) {
  const C = await msLoginOnce(); const out = []; let cursor = '';
  for (let i = 0; i < 30; i++) {
    const j = await C.msGet(`/bms/api/v1/my-papers/${id}/cells?limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    const d = j.data || {}; const cells = d.cells || []; out.push(...cells);
    (d.pages || []).forEach((pg) => (pg.cells || []).forEach((c) => out.push(c)));
    cursor = j.pagination && j.pagination.cursor; if (!cursor || !cells.length || (j.pagination.totalItems && out.length >= j.pagination.totalItems)) break;
  }
  return out.sort((a, b) => a.questionNumber - b.questionNumber);
}
async function mpStatuses() {
  const out = {};
  for (let off = 0; off < 20000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.ms_mypaper_*&select=key,st:value->>status,up:value->>updated,n:value->>n&order=key.asc&limit=1000&offset=${off}`, { headers: sbH() });
    if (!r.ok) break; const j = await r.json();
    j.forEach((x) => { out[String(x.key).replace(/^ms_mypaper_/, '')] = { status: x.st || '', updated: x.up || '', n: Number(x.n) || null }; });
    if (j.length < 1000) break;
  }
  return out;
}
/* 목록 색인 — 폴더 나무 + 폴더마다 문제지 (수학비서 화면과 같은 순서) */
async function mypapersIndex() {
  const T = await msMyTree(); const st = await mpStatuses(); const items = [];
  const folders = []; (function walk(fs) { (fs || []).forEach((f) => { folders.push(f); walk(f.children); }); })(T.roots);
  for (const f of folders) {
    if (!f.fileCount) continue;
    const list = await msMyList(f.id);
    list.forEach((p) => { const s = st[String(p.id)] || {};
      items.push({ id: p.id, title: p.title || '', folderId: f.id, folderPath: T.pathOf[f.id] || f.name || '', n: p.questionCount || 0, progress: p.progress || '',
        createdAt: p.createdAt || '', avgDiff: p.averageDifficulty != null ? p.averageDifficulty : null, status: s.status || '' }); });
    await sleep(80);
  }
  const ix = { updated: new Date().toISOString(), tree: T.tree, items };
  await kvSet('ms_mypapers_index', ix);
  log(`내 문제지 색인: 폴더 ${folders.length}개 · 문제지 ${items.length}장 · 인식 완료 ${items.filter((x) => x.status === 'ready').length}`);
  return ix;
}
/* 과목 · 학년 — 문항 단원 맨 앞(예 「08 공통수학2」)이 가장 정확하고, 없으면 제목 */
const HS_GRADE = { 공통수학1: '고1', 공통수학2: '고1', 대수: '고2', 미적분1: '고2', 미적분I: '고2', 확률과통계: '고2', 미적분2: '고3', 미적분II: '고3', 기하: '고3',
  '고등수학(상)': '고1', '고등수학(하)': '고1', 수학I: '고2', 수학II: '고2', 미적분: '고3' };
function mpCurriculum(cells, title, createdAt) {
  let d = null; try { d = require('./mypaper_to_mathflat.js').decideCurriculum(cells); } catch (e) { d = null; }
  if (d && d.ok) {
    const subj = String(d.top || '').replace(/^\d+\s*/, '').trim();
    const grade = d.schoolType === 'MIDDLE' ? '중' + d.grade : (HS_GRADE[subj.replace(/\s/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II')] || parseGrade(title));
    return { trie: d.trie, subject: subj, grade };
  }
  const so = semOf(createdAt); const g = parseGrade(title) || (/공통\s*수학|공수/.test(title) ? '고1' : '');
  return { trie: g ? trieOf(g, so.year, so.semester, title) : '', subject: '', grade: g };
}
async function buildMsMyPaper(id, opt) {
  const out = { id: Number(id) || id, kind: 'mp', title: '', folderId: null, folderPath: '', subject: '', grade: '', createdAt: '', n: null, status: 'pending', err: '', updated: '', trie: '', items: [] };
  try {
    if (!ensurePdfLib()) throw new Error('pdf-lib 설치 실패');
    const C = await msLoginOnce();
    const det = (await C.msGet(`/bms/api/v1/my-papers/${id}`)).data || {};
    const fs = det.folders || []; out.title = det.title || ''; out.n = det.questionCount || null; out.createdAt = det.createdAt || '';
    out.folderId = fs.length ? fs[fs.length - 1].id : null; out.folderPath = fs.map((f) => f.name).join(' › ');
    if ((det.questionCount || 0) > PAPER_MAX_Q) throw new Error(`문항 수 초과 (${det.questionCount}문항 · ${PAPER_MAX_Q}문항까지)`);
    const cells = await msMyCells(id);
    if (!cells.length) throw new Error('문항이 없음 (만드는 중인 문제지?)');
    const cur = mpCurriculum(cells, out.title, out.createdAt);
    out.subject = cur.subject; out.grade = cur.grade; out.trie = cur.trie || (opt && opt.trie) || '';
    if (!out.trie) throw new Error('교육과정을 정할 수 없음');
    log(`내 문제지 [${id}] ${cells.length}문항 · ${out.subject || '과목 모름'} · 교육과정 키 ${out.trie}`);
    const pass = {}; const list = [];
    for (const c of cells) {
      if (!c.imagePath) continue;
      let buf = null; try { buf = (await C.msImage(c.imagePath)).buf; } catch (e) { buf = null; }
      if (!buf || mimeOf(buf) !== 'image/png') continue;
      if (c.passage && c.passage.imagePath) {   /* 지문 — 여러 문항이 같이 쓰므로 한 번만 받는다 */
        const pk = String(c.passage.id || c.passage.imagePath);
        if (pass[pk] === undefined) { try { pass[pk] = (await C.msImage(c.passage.imagePath)).buf; } catch (e) { pass[pk] = null; } }
        if (pass[pk]) buf = stackPng(pass[pk], buf);
      }
      const a = (c.answers || [])[0] || {}; const ch = ((c.chapters || [])[0] || {}).chapter || [];
      list.push({ no: c.questionNumber, buf, meta: {
        msChapter: ch.map((x) => String(x).replace(/^\d+\s*/, '')).filter(Boolean).slice(1).join(' › ').slice(0, 200),
        msTags: (c.adaptiveTags || []).map((t) => t.name).filter(Boolean).slice(0, 8),
        answer: String(a.latex || (Array.isArray(a.answer) ? a.answer.join(', ') : '') || '').slice(0, 200),
        msSource: (((c.sources || [])[0] || {}).combinedTitle || '').slice(0, 120),
        msDiff: a.difficulty && a.difficulty.mathSecr != null ? a.difficulty.mathSecr : null } });
      await sleep(40);
    }
    if (!list.length) throw new Error('문항 그림을 받지 못함');
    out.items = await recognizeCellsToStore(list, out.trie, `msmp/${id}`);
    out.n = out.items.length; out.status = out.items.length ? 'ready' : 'error'; if (!out.items.length) out.err = '문항을 하나도 못 나눔';
    out.typed = out.items.filter((x) => x.cid).length;
  } catch (e) { out.status = 'error'; out.err = String(e.message || e).slice(0, 160); }
  out.updated = new Date().toISOString();
  try { await kvSet('ms_mypaper_' + id, out); } catch (e) { log(`ms_mypaper_${id} 저장 실패: ${e.message}`); }
  log(`  내 문제지 [${id}] ${out.status} · ${out.items.length}문항${out.typed != null ? ' · 유형 붙은 것 ' + out.typed : ''}${out.err ? ' · ' + out.err : ''}`);
  return out;
}
async function loadMpMats(ids, ctx) {
  const out = []; let n = 0;
  for (const id of ids) {
    let p = await kvGet('ms_mypaper_' + id);
    if (!p || p.status !== 'ready') {
      log(`내 문제지 ${id}: ${p ? p.status : '아직 인식 안 됨'} → 분석 때 바로 인식`);
      await ctx.step(`학원 문제지 분석 때 바로 인식 중 (${n + 1}/${ids.length} · 장당 2~5분)`, 41);
      try { p = DRY ? null : await buildMsMyPaper(id, { trie: ctx.trie }); } catch (e) { log(`내 문제지 ${id} 인식 실패: ${e.message.slice(0, 120)}`); p = null; }
    }
    if (!p || p.status !== 'ready') { log(`내 문제지 ${id}: 못 씀 (${(p && p.err) || ''}) — 빼고 진행`); continue; }
    n++; (p.items || []).forEach((it) => out.push(matFromItem('ms', `mp:${id}:${it.no}`, p.title, it, { mp: true, msChapter: it.msChapter || '', msSource: it.msSource || '' })));
  }
  if (ids.length) log(`내 문제지(학원 문제지): ${n}장 · ${out.length}문항`);
  return { mats: out, n };
}

/* ── (c) PDF 자료함 ── */
async function libMerge(id, upd) {   /* 학원앱도 같은 키에 쓰므로 쓰기 직전에 다시 읽어 그 항목만 바꾼다 */
  const lib = (await kvGet('exam_lib')) || { items: [] }; lib.items = lib.items || [];
  const i = lib.items.findIndex((x) => String(x.id) === String(id)); if (i < 0) return null;
  lib.items[i] = Object.assign({}, lib.items[i], upd); lib.updated = new Date().toISOString();
  await kvSet('exam_lib', lib);
  return lib.items[i];
}
function splitPath(p) { const s = String(p || ''); if (s.startsWith(BUCKET + '/')) return { bucket: BUCKET, path: s.slice(BUCKET.length + 1) }; if (s.startsWith(STAGE_BUCKET + '/')) return { bucket: STAGE_BUCKET, path: s.slice(STAGE_BUCKET.length + 1) }; return { bucket: STAGE_BUCKET, path: s }; }
async function prepLib(x, opt) {
  let upd;
  try {
    if (!ensurePdfLib()) throw new Error('pdf-lib 설치 실패');
    const dst = `lib/${x.id}.pdf`;
    const from = x.moved ? { bucket: BUCKET, path: dst } : splitPath(x.src);
    const buf = await stGet(from.bucket, from.path);
    if (!x.moved) {   /* 임시 자리(aha_photos) → exam_images/lib 로 옮기고 임시 파일은 지운다 */
      await stPut(BUCKET, dst, buf, mimeOf(buf) || 'application/pdf');
      if (from.bucket === STAGE_BUCKET) await stDel(STAGE_BUCKET, [from.path]);
      if (!DRY) await libMerge(x.id, { moved: true, src: BUCKET + '/' + dst, path: BUCKET + '/' + dst });
    }
    const pdf = mimeOf(buf) === 'application/pdf' ? { bytes: buf, pages: await pdfPages(buf) } : await imagesToPdf([buf]);
    if (pdf.pages > PAPER_MAX_PAGES) throw new Error(`쪽 수 초과 (${pdf.pages}쪽 · ${PAPER_MAX_PAGES}쪽까지)`);
    const so = semOf(x.uploadedAt);
    const trie = (opt && opt.trie) || trieOf(x.grade, Number(x.year) || so.year, String(x.sem || so.semester), (x.subject || '') + ' ' + (x.title || ''));
    if (!trie) throw new Error(`교육과정을 정할 수 없음 (${x.grade || '학년 모름'})`);
    const items = await recognizeToStore(pdf, trie, `lib/${x.id}`);
    upd = { status: items.length ? 'ready' : 'error', err: items.length ? '' : '문항을 하나도 못 나눔', items, n: items.length, moved: true, src: BUCKET + '/' + dst, path: BUCKET + '/' + dst, done: new Date().toISOString() };
  } catch (e) { upd = { status: 'error', err: String(e.message || e).slice(0, 160), done: new Date().toISOString() }; }
  log(`  자료함 [${x.id}] ${upd.status}${upd.n != null ? ' · ' + upd.n + '문항' : ''}${upd.err ? ' · ' + upd.err : ''}`);
  const merged = await libMerge(x.id, upd);
  return Object.assign({}, x, upd, merged || {});
}
async function loadLibMats(ids, ctx) {
  const out = []; let n = 0; if (!ids.length) return { mats: out, n };
  const lib = (await kvGet('exam_lib')) || { items: [] };
  for (const id of ids) {
    let x = (lib.items || []).find((i) => String(i.id) === String(id) && !i.deleted);
    if (!x) { log(`자료함 ${id}: 없음(지웠거나 아직 안 올라옴)`); continue; }
    if (x.status !== 'ready') {
      log(`자료함 ${id}: ${x.status} → 분석 때 바로 인식`);
      await ctx.step(`자료함 PDF 분석 때 바로 인식 중 (${n + 1}/${ids.length} · 장당 2~5분)`, 42);
      x = await prepLib(x, { trie: ctx.trie });
    }
    if (x.status !== 'ready') { log(`자료함 ${id}: 못 씀 (${x.err || ''}) — 빼고 진행`); continue; }
    n++; (x.items || []).forEach((it) => out.push(matFromItem('upload', `lib:${id}:${it.no}`, x.title || '자료함 프린트', it, { lib: true })));
  }
  log(`자료함: ${n}장 · ${out.length}문항`);
  return { mats: out, n };
}

/* ══ --prep : 새벽 준비 (mathflat-collect.yml 04시 회차) ══ */
async function paperStatuses() {
  const out = {};
  for (let off = 0; off < 20000; off += 1000) {
    const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.ms_paper_*&select=key,st:value->>status,up:value->>updated,er:value->>err&order=key.asc&limit=1000&offset=${off}`, { headers: sbH() });
    if (!r.ok) break; const j = await r.json();
    j.forEach((x) => { out[String(x.key).replace(/^ms_paper_/, '')] = { status: x.st || '', updated: x.up || '', err: x.er || '' }; });
    if (j.length < 1000) break;
  }
  return out;
}
/* 2026-10-11: 예전 크기 제한(150문항 · 10쪽 넘는 「pageIndexes」 실패)으로 건너뛴 것은 이제 나눠 인식하므로 바로 다시 */
const stale = (s) => !s.updated || /너무 많아 건너뜀|pageIndexes/.test(s.err || '') || (Date.now() - new Date(s.updated).getTime()) > RETRY_H * 3600e3;
async function prepPapers() {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) { log('수학비서 계정(MATHSECR_ID) 없음 — 수학비서 학습지 건너뜀'); return; }
  const all = await msPapers(); const F = await msFolders(); const st = await paperStatuses();
  const since = Date.now() - PREP_DAYS * 864e5, listSince = Date.now() - LIST_DAYS * 864e5;
  const idx = [], per = {}, other = {}, want = [];
  GRADE_FOLDERS.forEach((g) => { per[g] = { all: 0, exam: 0, recent: 0, ready: 0, todo: 0 }; });
  all.forEach((m) => {
    const g = F.gradeOf(m.folderId), folder = F.nameOf[m.folderId] || '', exam = isExamPaper(m), at = paperDate(m), t = at ? new Date(at).getTime() : 0;
    const s = st[String(m.id)] || {};
    if (!g) {   /* 학년 폴더 밖: 1년 안에 올린(산) 학습지만 목록에 (학원앱에서 폴더를 바꿔 고를 수 있게) — 인식은 고를 때 */
      if (exam || !t || t < listSince) return;
      other[folder] = (other[folder] || 0) + 1;
    } else {
      const p = per[g]; p.all++; if (exam) p.exam++; if (!exam && t >= since) p.recent++; if (s.status === 'ready') p.ready++;
      if (!exam && t >= since && s.status !== 'ready' && (s.status !== 'error' || stale(s))) { p.todo++; want.push({ m, folder: g, g }); }
    }
    /* 학년 폴더 아래 폴더(예: 고1 › 09월)는 folder=학년 폴더, sub=아래 폴더 이름 — 학원앱 폴더 칩은 folder 로 묶는다 */
    const row = { id: m.id, title: m.title || '', folder: g || folder, grade: g || parseGrade(m.title), uploadedAt: at || '', n: m.questionCount || null, status: s.status || '', exam, fid: m.folderId || null };
    if (g && folder && folder.replace(/\s/g, '') !== g) row.sub = folder;
    idx.push(row);
  });
  log('수학비서 학년 폴더 (전체 · 기출 · 최근 ' + PREP_DAYS + '일 학습지 · 인식 완료 · 할 일):');
  GRADE_FOLDERS.forEach((g) => { const p = per[g]; log(`  ${g}: ${p.all}장 · 기출 ${p.exam} · 최근 학습지 ${p.recent} · 인식 완료 ${p.ready} · 할 일 ${p.todo}`); });
  const oth = Object.keys(other).sort((a, b) => other[b] - other[a]);
  log(`  다른 폴더(1년 안 학습지, 목록만): ${oth.length ? oth.map((f) => f + ' ' + other[f]).join(' · ') : '없음'}`);
  /* 학원앱 「💾 이 구성 기억」(exam_hit_src_<학교>_<학년>)에서 원장님이 켜 둔 다른 폴더 학습지도 미리 인식 */
  const keep = new Set(), keepGrade = {}; const ws = new Set(want.map((w) => String(w.m.id)));
  for (const k of await keysLike('exam_hit_src_')) { const c = await kvGet(k); const kg = k.split('_').pop();   /* exam_hit_src_<학교>_<학년> */
    Object.keys((c && c.msOn) || {}).forEach((id) => { keep.add(String(id)); if (!keepGrade[id]) keepGrade[id] = kg; }); }
  all.forEach((m) => { const s = st[String(m.id)] || {}; if (!keep.has(String(m.id)) || ws.has(String(m.id)) || s.status === 'ready' || (s.status === 'error' && !stale(s))) return;
    const g = F.gradeOf(m.folderId); want.push({ m, folder: g || F.nameOf[m.folderId] || '', g: g || keepGrade[String(m.id)] || parseGrade(m.title) }); });
  if (keep.size) log(`  기억한 구성에서 켠 학습지 ${keep.size}장 (아직 인식 안 된 것은 할 일에 넣음)`);
  want.sort((a, b) => String(paperDate(a.m)).localeCompare(String(paperDate(b.m))));   /* 오래된 것부터 */
  const now = want.slice(0, PREP_CAP);
  log(`이번에 인식할 학습지 ${now.length}장 (할 일 ${want.length}장 · 한 번에 최대 ${PREP_CAP})`);
  now.forEach((w) => log(`  · [${w.m.id}] ${w.g} · ${String(paperDate(w.m)).slice(0, 10)} · ${w.m.questionCount || '?'}문항 · ${w.m.pdfPath ? 'PDF' : '문항 그림'} · ${String(w.m.title || '').slice(0, 40)}`));
  /* 2026-10-11: tree = 나만의 DB 폴더 나무(수학비서와 같은 이름·순서) — 학원앱 「🗄 나만의 DB」 탭이 그대로 그린다. fid = 폴더 id */
  const save = async () => { idx.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt))); await kvSet('ms_papers_index', { updated: new Date().toISOString(), tree: F.tree || [], items: idx }); };
  await save();
  if (DRY) return;
  for (const w of now) {
    const out = await buildMsPaper(w.m, w.folder, w.g, null);
    const it = idx.find((x) => String(x.id) === String(w.m.id)); if (it) { it.status = out.status; if (out.n) it.n = out.n; }
  }
  if (now.length) await save();
}
/* 2026-10-11: 내 문제지 — 색인 갱신 + 기억한 구성(exam_hit_src_*)의 mpOn 문제지 미리 인식 */
async function prepMyPapers() {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) { log('수학비서 계정(MATHSECR_ID) 없음 — 내 문제지 건너뜀'); return; }
  const ix = await mypapersIndex();
  const st = await mpStatuses(); const want = [];
  for (const k of await keysLike('exam_hit_src_')) { const c = await kvGet(k); Object.keys((c && c.mpOn) || {}).forEach((id) => {
    const s = st[String(id)] || {}; if (s.status === 'ready' || (s.status === 'error' && !stale(s)) || want.includes(String(id))) return; want.push(String(id)); }); }
  const now = want.slice(0, PREP_CAP);
  log(`내 문제지 미리 인식: 할 일 ${want.length}장 · 이번 ${now.length}장`);
  if (DRY || !now.length) return;
  for (const id of now) await buildMsMyPaper(id, null);
  await mypapersIndex();
}
async function prepLibAll() {
  const lib = (await kvGet('exam_lib')) || { items: [] };
  const todo = (lib.items || []).filter((x) => !x.deleted && x.status !== 'ready' && (x.status !== 'error' || stale({ updated: x.done })));
  log(`PDF 자료함: ${(lib.items || []).filter((x) => !x.deleted).length}장 · 인식 대기 ${todo.length}장`);
  todo.slice(0, LIB_CAP).forEach((x) => log(`  · [${x.id}] ${x.school || ''} ${x.grade || ''} · ${String(x.title || '').slice(0, 40)} (${x.status || 'pending'})`));
  if (DRY) return;
  for (const x of todo.slice(0, LIB_CAP)) await prepLib(x, null);
}
async function prepBanks() {
  const map = (await kvGet('mf_textbooks')) || {};
  const want = new Set();
  Object.keys(map.bySchoolGrade || {}).forEach((k) => Object.keys((map.bySchoolGrade[k] && map.bySchoolGrade[k].books) || {}).forEach((b) => {
    const bk = (map.books || {})[b]; if (bk && bk.type === 'SCHOOL') want.add(String(b)); }));
  const have = await keysLike('mf_textbook_');
  const miss = [...want].filter((b) => !have.has('mf_textbook_' + b));
  log(`교과서 은행: 학교·학년 지정 교과서 ${want.size}권 · 은행 있음 ${want.size - miss.length} · 없음 ${miss.length}${miss.length ? ' (' + miss.map((b) => ((map.books || {})[b] || {}).fulltitle || b).join(', ') + ')' : ''}`);
  if (!miss.length || DRY) return;
  if (!process.env.MATHFLAT_ID || !process.env.MATHFLAT_PASSWORD) { log('매쓰플랫 계정 없음 — 교과서 은행 건너뜀'); return; }
  log(`교과서 은행 만들기: node sync/mf_textbook_bank.js --bids ${miss.join(',')}`);
  const r = spawnSync(process.execPath, [pathMod.join(__dirname, 'mf_textbook_bank.js'), '--bids', miss.join(',')], { stdio: 'inherit', env: process.env, timeout: 90 * 60000 });
  log(`교과서 은행 만들기 끝 (종료 코드 ${r.status}${r.error ? ' · ' + r.error.message : ''})`);
}
async function prep() {
  const hr = kstHour(), dawn = process.env.PREP_ROUND === 'dawn' || (hr >= 3 && hr <= 6);
  if (!DRY && !has('force') && !dawn) { log(`--prep: 새벽 회차가 아님 (한국 ${hr}시) — 건너뜀 (--force 로 강제)`); return; }
  log(`🌙 적중 분석 «우리 자료» 새벽 준비${DRY ? ' — dry (읽기만, 할 일 목록만)' : ''}`);
  for (const [name, fn] of [['수학비서 학습지', prepPapers], ['내 문제지', prepMyPapers], ['PDF 자료함', prepLibAll], ['교과서 은행', prepBanks]]) {
    try { await fn(); } catch (e) { log(`${name} 실패: ${String(e.message || e).slice(0, 200)}`); process.exitCode = 1; }
  }
  log('새벽 준비 끝');
}

/* ══ 요청 처리 (학원앱 → exam_hit_req) ═══════════════════════ */
/* 출판사 교과서 비교만 — 이미 분석한 시험에 (우리 자료·지난 기출 판정은 그대로). 요청 { only:'pub' } 또는 --pub-only <시험> */
async function pubOnly(id, step) {
  const p = await kvGet('exam_hit_' + id); if (!p) throw new Error('exam_hit_' + id + ' 가 없습니다');
  const items = p.items.map((it) => ({ ...it }));
  for (const it of items) if (it.img && !it.imgUrl) it.imgUrl = await stSign(it.img);
  const pst = await pubCompare({ ...p.exam }, items, p, normSrc(p.src || null, p.exam), step || null);
  const out = { ...p, items, stats: { ...p.stats } }; if (pst) out.stats.pub = pst; else delete out.stats.pub;
  if (!DRY) await kvSet('exam_hit_' + id, out); else log('[dry] 저장 안 함');
  return { ...out, examId: id };
}
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
    const out = req.only === 'pub' ? await pubOnly(req.examId, step) : await runExam(exam, { files: req.files || [], uploads: req.mats || [], mydb: req.mydb || null, rejudge: !!req.rejudge, from: req.from, to: req.to, src: req.src || null, step });
    await kvSet(REQ_KEY, { ...req, status: 'done', step: '끝', pct: 100, startedAt, doneAt: new Date().toISOString(), examId: out.examId,
      summary: { total: out.stats.total, same: out.stats.same, var: out.stats.var, type: out.stats.type, text: out.stats.text, byKind: out.stats.byKind,
        past: out.stats.past ? { same: out.stats.past.same, var: out.stats.past.var, type: out.stats.past.type, items: out.stats.past.items, exams: out.stats.past.exams } : null,
        pub: out.stats.pub ? { items: out.stats.pub.items, by: Object.fromEntries(Object.entries(out.stats.pub.by).map(([k, v]) => [k, v.same + v.var])) } : null } });
  } catch (e) {
    log('실패:', e.message);
    await kvSet(REQ_KEY, { ...req, status: 'error', error: String(e.message || e).slice(0, 200), startedAt, doneAt: new Date().toISOString() });
    process.exitCode = 1;
  }
}

module.exports = { schoolKey, gradeKey, examIdOf, whereOf, pidOfUrl, semStart, mydbFetch, examDateFromCalendar,
  normSrc, textbookBids, loadTextbookMats, matFromItem, isExamPaper, semOf, tbTitle, courseTrie,   /* 2026-10-10 우리 자료 3종 */
  examUnits, inScope, pngDecode, pngEncode, stackPng, packCells, compactTree, mpCurriculum,   /* 2026-10-11 내 문제지 · 시험 범위 */
  pastCfg, pastSelect, pastCands, termOrd,   /* 2026-10-11 지난 기출 비교 */
  pubCfg, pubName, pubCands, pubBanks, pubRev, pubSubject };   /* 2026-10-11 출판사 교과서 출처 */

if (require.main === module) {
  (async () => {
    if (has('prep')) return prep();   /* 2026-10-10: 우리 자료 새벽 준비 */
    /* 2026-10-11: 내 문제지 — 색인만 · 지정한 문제지 인식 (--mp-build 2061686,2032273) */
    if (has('mypapers-index')) return mypapersIndex();
    if (arg('mp-build', '')) { if (!ensurePdfLib()) throw new Error('pdf-lib 설치 실패'); for (const id of String(arg('mp-build', '')).split(',').filter(Boolean)) await buildMsMyPaper(id.trim(), null); return mypapersIndex(); }
    if (NO_AI && !has('no-ai')) log('⚠ ANTHROPIC_API_KEY 가 없어 그림 판정 없이 유형 번호로만 후보를 남깁니다');
    /* 2026-10-11: 지난 기출 비교만 — 이미 분석한 시험에 «학교 기출과 비교»만 다시 (우리 자료·판정은 그대로). --dry 면 숫자만 보여 준다 */
    if (arg('pub-only', '')) { await pubOnly(arg('pub-only', ''), null); return; }
    if (arg('past-only', '')) {
      const id = arg('past-only', ''); const p = await kvGet('exam_hit_' + id); if (!p) throw new Error('exam_hit_' + id + ' 가 없습니다');
      let src = p.src || null; if (arg('src-file', '')) src = JSON.parse(require('fs').readFileSync(arg('src-file', ''), 'utf8'));
      if (arg('years', '') || has('same-term')) src = { ...(src || {}), past: { on: true, years: Number(arg('years', '')) || pastCfg(src).years, sameTerm: has('same-term') } };
      const items = p.items.map((it) => ({ ...it }));
      const pst = await pastCompare({ ...p.exam }, items, p, normSrc(src, p.exam), p.exam.mydb || null, null);
      const out = { ...p, items, stats: { ...p.stats } }; if (pst) out.stats.past = pst; else delete out.stats.past;
      if (src && src.past) out.src = { ...(p.src || {}), past: src.past };
      await kvSet('exam_hit_' + id, out);
      return;
    }
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
    let src = null; if (rej) { const p = await kvGet('exam_hit_' + rej); src = (p && p.src) || null; }
    if (arg('src-file', '')) src = JSON.parse(require('fs').readFileSync(arg('src-file', ''), 'utf8'));   /* 2026-10-11: 손으로 자료 구성 바꿔 보기 (--dry 와 함께) */
    await runExam(exam, { mydb: rej ? exam.mydb : mydb, rejudge: !!rej, from: arg('from', ''), to: arg('to', ''), src });
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
