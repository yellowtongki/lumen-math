#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 기출 → 쌍둥이 학습지 파이프라인  v1  (2026-08-26 시범 성공)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 수학비서에 있는 학교 기출 시험지를 매쓰플랫 「기타 학습자료」(우리 학원 전용,
 * 전국 공유 안 됨)로 등록하고, 문항마다 쌍둥이·유사 문제를 뽑아
 * 학습지까지 만든다. 전 과정 자동.
 *
 *   ① 수학비서 문항 이미지 내려받기 (CDN 서명 쿠키)
 *   ② A4 2단 시험지 PDF 조립 (pdf-lib)
 *   ③ 매쓰플랫 업로드 (sai.mathflat.com — 2026-08 신형 AI 서버)
 *   ④ AI 문항 인식 (document-processing-flow) → 문항 상자
 *   ⑤ 문제은행 매칭 (analysis-flow + trieKey) → 문항별 유형·난이도·원본문제
 *   ⑥ 기타 학습자료 원본 생성 (POST /v2/papers/by-custom, shareScope=ACADEMY)
 *   ⑦ 쌍둥이·유사 필터 (POST /v2/worksheet/filter/school-test-paper/similar)
 *   ⑧ 학습지 2장 생성 — 「…원본」(기출 그대로)과 「…쌍둥이」(유사문제)
 *      배정은 하지 않는다. 원장님이 확인하고 배정.
 *   ⑨ 마이리스트(폴더)에 담기
 *
 * 【원본 학습지의 함정】 원본은 OCR한 우리 문제라, 문제은행 문제로 «복사»되기
 *   전에는 필터가 비어 있다. POST /my-db-problems/copy-to-problem 으로 복사를
 *   «실행»하고 status 가 COPIED 가 될 때까지 기다린 뒤라야 만들 수 있다.
 *   또 만들 때 problemList 와 함께 myDbProblemDetailIds 를 반드시 넣어야 한다.
 *
 * 시범 결과(2025 옥길중 중1 2학기중간): 21문항 → 23상자 인식 → 23/23 매칭
 *   → 쌍둥이 23문항 학습지 「…쌍둥이 (시범)」 생성. 전 문항 자동채점 가능.
 *
 * 사용법:
 *   node sync/exam_twin_pipeline.js --mydb 387569 --trie 1.4.4146.4154.4170
 *   옵션: --title "..."      제목 직접 지정 (생략하면 수학비서 시험명에서
 *                            「옥길중학교 1학년 2025년 2학기 중간」 형식으로 자동 생성.
 *                            이 제목이 문항 위 출처 꼬리표가 되므로 학교명이 중요)
 *         --grade "중 1-2"   학년 표기 (생략하면 자동 · 고등은 과목명 「공통수학2」)
 *         --mylist "기출 쌍둥이"  만든 학습지를 이 마이리스트(폴더)에 넣기 (없으면 만든다)
 *         --similar-x 1      문항당 쌍둥이 수
 *         --skip-worksheet   원본 등록까지만
 *         --assign "김가희"   기출원본 학습지를 이 학생에게 배정 (이름 또는 매쓰플랫 id, 쉼표로 여러 명)
 *         --assign-twin      쌍둥이 학습지도 같이 배정 (기본은 원본만)
 *
 * trieKey (22개정 중등): 중1-1 1.4.4146.4154.4169 · 중1-2 1.4.4146.4154.4170
 *   중2-1 1.4.4146.4155.4171 · 중2-2 1.4.4146.4155.4172
 *   중3-1 1.4.4146.4156.4173 · 중3-2 1.4.4146.4156.4174
 * trieKey (15개정 중등): 중1 1.2.9.27.62/.80 · 중2 1.2.9.29.64/.82 · 중3 1.2.9.31.66/.84
 * trieKey (22개정 고등 — 학년이 아니라 과목이 단위): 공통수학1 1.4.4147.4175 ·
 *   공통수학2 .4176 · 대수 .4177 · 미적분1 .4178 · 확률과 통계 .4179 · 미적분2 .4180 · 기하 .4181
 *
 * 계정: MATHSECR_ID/PASSWORD, MATHFLAT_ID/PASSWORD (환경변수만, 커밋 금지)
 * 주의: 매쓰플랫 동시 로그인 시 기존 접속이 끊길 수 있음 → 새벽 실행 권장.
 *       생성물 삭제는 DELETE /papers/{id}, 학습지는 앱에서.
 */
const fs = require('fs');
const path = require('path');
/* pdf-lib는 워커(깃허브 서버)에는 기본으로 없어서, 쓰는 순간에만 불러온다.
 * 워커 쪽(twin_request_worker)이 필요할 때 즉석 설치한 뒤 이 함수를 부른다. */
let _pdflib = null;
function pdflib() { if (!_pdflib) _pdflib = require('pdf-lib'); return _pdflib; }

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const MF_API = 'https://api.mathflat.com';
const MF_SAI = 'https://sai.mathflat.com';   // AI(업로드·인식·매칭) 전용 서버
const MF_BASE = 'https://teacher.mathflat.com';
const OUT_DIR = path.join(__dirname, '_debug', 'twin_pipeline');

/* 교육과정 키. 22·15개정 중학교 전 학기 확보 (15개정은 /curriculums/by-key 스캔으로 확인) */
const TRIE_22 = { '1-1': '1.4.4146.4154.4169', '1-2': '1.4.4146.4154.4170', '2-1': '1.4.4146.4155.4171', '2-2': '1.4.4146.4155.4172', '3-1': '1.4.4146.4156.4173', '3-2': '1.4.4146.4156.4174' };
const TRIE_15 = { '1-1': '1.2.9.27.62', '1-2': '1.2.9.27.80', '2-1': '1.2.9.29.64', '2-2': '1.2.9.29.82', '3-1': '1.2.9.31.66', '3-2': '1.2.9.31.84' };
/* 고등 22개정은 「학년」이 아니라 「과목」이 단위다 (매쓰플랫 curriculum의 grade 값이 과목명).
 * /curriculums/by-key?key=1.4.4147 스캔으로 확인 (2026-09-01). */
const TRIE_22_HIGH = {
  '공통수학1': '1.4.4147.4175', '공통수학2': '1.4.4147.4176', '대수': '1.4.4147.4177',
  '미적분1': '1.4.4147.4178', '확률과 통계': '1.4.4147.4179', '미적분2': '1.4.4147.4180', '기하': '1.4.4147.4181',
};
/* 2022 개정 적용 연도: 중1은 2025년부터, 중2는 2026년부터, 중3은 2027년부터 */
function trieForExam(grade, semester, year) {
  const is22 = Number(year) >= 2024 + Number(grade);
  const key = `${grade}-${semester}`;
  return (is22 ? TRIE_22 : TRIE_15)[key] || '';
}
/* 수학비서 시험명에서 고등 과목명 뽑기 (예: "…소래고 고1공통 2학기기말 공통수학2" → 공통수학2) */
function hsSubjectOf(title) {
  const t = String(title || '').replace(/\s+/g, '');
  const m = t.match(/(공통수학[12]|확률과통계|미적분[12]|대수|기하)/);
  if (!m) return '';
  return m[1] === '확률과통계' ? '확률과 통계' : m[1];
}
/* 학교 이름 토큰 (…중 / …고). 제목 어디에 있든 학교명만 집어낸다 */
function schoolTokenOf(title) {
  return (String(title || '').match(/([가-힣]+(?:중|고))(?:학교)?\s/) || [])[1] || '';
}

let log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 고등 기출 수입 장부 (hs_exam_import) ────────────────────
 * 기출모의 엔진(mockexam_engine --build)은 고등 시험을 이 장부에서 읽어
 * 「수학비서 시험 ↔ 매쓰플랫 원본 학습지」를 잇는다. 중학교는 채점 기록 제목 대조로
 * 백필되지만, 고등은 학교명 꼬리(「소래고등학교」→「소래고등」)가 어긋나 백필이 안 된다.
 * 그래서 고등 시험은 만들자마자 여기에 적어 둔다 — 안 적으면 학생이 풀어도
 * 기출모의 자동 수신함에 뜨지 않는다. */
async function registerHsExam(examId, entry) {
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY || '';
  if (!url || !key) { log('⚠ SUPABASE 환경변수가 없어 고등 수입 장부 등록을 건너뜁니다'); return false; }
  const H = { apikey: key, authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  const r = await fetch(`${url}/rest/v1/lumen_store?select=value&key=eq.hs_exam_import`, { headers: H });
  const rows = await r.json();
  let v = (rows && rows[0] && rows[0].value) || {};
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = {}; } }
  v.done = v.done || {};
  if (v.done[examId] && v.done[examId].worksheet) { log(`고등 수입 장부: ${examId} 이미 등록됨 (worksheet ${v.done[examId].worksheet}) — 건너뜀`); return false; }
  v.done[examId] = { ...entry, at: new Date().toISOString(), filed: true };
  v.updated = new Date().toISOString();
  const w = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key: 'hs_exam_import', value: v, updated_at: v.updated }),
  });
  if (!w.ok) { log(`⚠ 고등 수입 장부 등록 실패 ${w.status}: ${(await w.text()).slice(0, 140)}`); return false; }
  log(`고등 수입 장부에 등록: ${examId} → worksheet ${entry.worksheet} (총 ${Object.keys(v.done).length}건)`);
  return true;
}

/* ── 수학비서 ─────────────────────────────────────────────── */
let MS_TOKEN = null, MS_CDN_COOKIE = null;
const msH = () => ({ accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json();
  MS_TOKEN = j.data ? j.data.accessToken : j.accessToken;
  if (!MS_TOKEN) throw new Error('수학비서 로그인 실패');
}
/* 수학비서 시험명 → 「옥길중학교 1학년 2025년 2학기 중간」 (매쓰플랫 기출 출처 표기와 같은 꼴)
 * 예: "내신 2025년 경기 부천시 옥길중 중1공통 2학기중간 중등수학1하" */
function sourceTitleOf(msTitle) {
  const t = String(msTitle || '');
  const year = (t.match(/(20\d\d)년/) || [])[1] || '';
  const school = (t.match(/([가-힣]+(?:중|고))(?:학교)?\s/) || [])[1] || '';
  const grade = (t.match(/[중고](\d)/) || [])[1] || '';
  const sem = (t.match(/(\d)학기/) || [])[1] || '';
  const term = t.includes('기말') ? '기말' : (t.includes('중간') ? '중간' : '');
  if (!school) return '';
  const schoolFull = school + (school.endsWith('중') ? '학교' : '등학교');
  return [schoolFull, grade && grade + '학년', year && year + '년', sem && sem + '학기', term].filter(Boolean).join(' ');
}

/* cells 응답의 Set-Cookie(Cloud-CDN-Cookie)가 문항 이미지 열쇠 (약 78분 유효) */
async function msCells(id) {
  // 응답은 data.pages[].cells[] 꼴이고 cursor 페이지네이션 (?curriculumId=2&limit=48 필수)
  const cells = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const r = await fetch(`${MS_API}/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { headers: msH() });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    const hit = sc.find((c) => c && c.includes('Cloud-CDN-Cookie'));
    if (hit) MS_CDN_COOKIE = hit.split(';')[0];
    const j = await r.json();
    ((j.data && j.data.pages) || []).forEach((pg) => (pg.cells || []).forEach((c) => cells.push(c)));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return cells.sort((a, b) => a.questionNumber - b.questionNumber);
}
async function msImage(url) {
  const r = await fetch(url, { headers: { cookie: MS_CDN_COOKIE, origin: MS_ORIGIN, referer: MS_ORIGIN + '/' } });
  if (!r.ok) throw new Error(`이미지 ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/* ── PDF 조립 (A4 2단) ────────────────────────────────────── */
async function buildPdf(images, headTitle) {
  const { PDFDocument, rgb, StandardFonts } = pdflib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const A4 = [595.28, 841.89];
  const M = 42, GAP = 18, COLW = (A4[0] - M * 2 - GAP) / 2;
  let page = doc.addPage(A4), col = 0, y = A4[1] - M - 60, pageNo = 1;
  page.drawText(headTitle.replace(/[^\x20-\x7E]/g, '').trim() || 'EXAM', { x: M, y: A4[1] - M - 18, size: 14, font });
  page.drawLine({ start: { x: M, y: A4[1] - M - 30 }, end: { x: A4[0] - M, y: A4[1] - M - 30 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  const colX = () => M + col * (COLW + GAP);
  for (const { no, buf } of images) {
    const png = await doc.embedPng(buf);
    const scale = Math.min(1, (COLW - 22) / png.width);
    const w = png.width * scale, h = png.height * scale, blockH = h + 26;
    if (y - blockH < M) {
      if (col === 0) { col = 1; y = A4[1] - M - (pageNo === 1 ? 60 : 20); }
      else { page = doc.addPage(A4); pageNo++; col = 0; y = A4[1] - M - 20; }
      if (y - blockH < M) y = A4[1] - M - 20;
    }
    page.drawText(String(no).padStart(2, '0'), { x: colX(), y: y - 12, size: 12, font, color: rgb(0.1, 0.3, 0.7) });
    page.drawImage(png, { x: colX() + 22, y: y - 14 - h, width: w, height: h });
    y -= blockH + 12;
  }
  return { bytes: await doc.save(), pages: doc.getPageCount() };
}

/* ── 매쓰플랫 ────────────────────────────────────────────── */
let MF_TOKEN = null;
const mfH = () => ({ 'content-type': 'application/json', accept: 'application/json, text/plain, */*',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  authorization: `Bearer ${MF_TOKEN}`, 'x-auth-token': MF_TOKEN, origin: MF_BASE, referer: MF_BASE + '/' });
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_BASE, referer: MF_BASE + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
/* 토큰이 만료되면(401) 한 번 다시 로그인하고 재시도한다.
 * 시험지 한 장에 몇 분이 걸리고(원본 OCR 대기), 여러 장을 이어서 돌리면
 * 중간에 토큰이 만료된다 — 실제로 2022년 중3 기말에서 원본 필터 단계가 401로 끊겼다. */
async function mf(host, method, p, body, _retried) {
  const r = await fetch(host + p, { method, headers: mfH(), body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  const data = j && j.data !== undefined ? j.data : j;
  if (r.status === 401 && !_retried) {
    log('토큰 만료 → 다시 로그인');
    await mfLogin();
    return mf(host, method, p, body, true);
  }
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${t.slice(0, 200)}`);
  return { data, raw: t };
}
/* /jobs 는 따옴표 없는 uuid 원문을 돌려준다 */
async function saiJob() {
  const { data, raw } = await mf(MF_SAI, 'POST', '/jobs');
  return (data && (data.jobId || data.id)) || (typeof data === 'string' ? data : null) || (/^[0-9a-f-]{30,}$/.test(raw.trim()) ? raw.trim() : null);
}
async function saiPoll(jobId, timeoutMs) {
  const until = Date.now() + (timeoutMs || 240000);
  while (Date.now() < until) {
    const { data } = await mf(MF_SAI, 'GET', `/async-jobs/${jobId}`);
    if (data.status === 'COMPLETED') return data.returns;
    if (data.status === 'FAILED') throw new Error('AI 작업 실패: ' + JSON.stringify(data).slice(0, 300));
    await sleep(1500);
  }
  throw new Error('AI 작업 시간 초과');
}

async function runTwinPipeline(opts) {
  const MYDB = Number(opts.mydb || 0);
  let TRIE = opts.trie || '';
  let GRADE_LABEL = opts.grade || '';
  let TITLE = opts.title || '';
  const MYLIST = opts.mylist || '';
  const SIMILAR_X = Number(opts.similarX || 1);
  const SKIP_WS = !!opts.skipWorksheet;
  const ASSIGN = String(opts.assign || '').split(',').map((s) => s.trim()).filter(Boolean);   // 학생 이름 또는 매쓰플랫 id
  const ASSIGN_TWIN = !!opts.assignTwin;   // 쌍둥이까지 배정할지 (기본은 기출원본만)
  let IS_HIGH = false, HS_SUBJECT = '', WS_GRADE = '1';
  let assignIds = [], assignNames = [];
  if (opts.log) log = opts.log;
  if (!MYDB) throw new Error('mydb(수학비서 시험지 id)가 필요합니다');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ① 수학비서에서 문항 이미지 + 시험명(출처)
  await msLogin();
  let msMeta = {};
  {
    const dr = await fetch(`${MS_API}/bms/api/v1/mydbs/${MYDB}`, { headers: msH() });
    const dj = await dr.json();
    const md = (dj && dj.data) || {};
    msMeta = md;
    const t = String(md.title || '');
    const g = (t.match(/[중고](\d)/) || [])[1] || '1';
    const sem = (t.match(/(\d)학기/) || [])[1] || '1';
    const yr = (t.match(/(20\d\d)년/) || [])[1] || '';
    IS_HIGH = /고$/.test(schoolTokenOf(t)) || (!schoolTokenOf(t) && t.includes('고') && !t.includes('중'));
    if (!TITLE) TITLE = sourceTitleOf(t) || ('기출 연습 ' + MYDB);
    if (IS_HIGH) {
      // 고등: 학년-학기가 아니라 과목이 단위. 학습지의 grade 칸에도 과목명이 들어간다.
      HS_SUBJECT = hsSubjectOf(t);
      // 고등은 제목 끝에 과목명을 붙인다 — 기출모의 엔진이 과목을 제목 끝에서 읽는다
      // (예: 「소사고등학교 2학년 2024년 2학기 중간 미적분1」). 안 붙이면 과목이 「수학」으로 뭉개진다.
      if (!opts.title && HS_SUBJECT && !TITLE.includes(HS_SUBJECT)) TITLE = TITLE + ' ' + HS_SUBJECT;
      if (!GRADE_LABEL) GRADE_LABEL = HS_SUBJECT || ('고 ' + g + '-' + sem);
      if (!TRIE) {
        TRIE = TRIE_22_HIGH[HS_SUBJECT] || '';
        if (!TRIE) throw new Error(`고등 교육과정 키를 정할 수 없습니다 (과목 「${HS_SUBJECT || '알 수 없음'}」) — --trie로 직접 지정해 주세요`);
      }
    } else {
      if (!GRADE_LABEL) GRADE_LABEL = '중 ' + g + '-' + sem;
      if (!TRIE) {
        TRIE = trieForExam(g, sem, yr);
        if (!TRIE) throw new Error(`교육과정 키를 정할 수 없습니다 (중${g} ${sem}학기 ${yr}년 — 15개정 키 미확보). --trie로 직접 지정해 주세요`);
      }
    }
    WS_GRADE = IS_HIGH ? (HS_SUBJECT || '공통수학1') : g;
  }
  log(`제목(출처): ${TITLE} · 학년 ${GRADE_LABEL}`);
  const cells = await msCells(MYDB);
  if (!cells.length) throw new Error('문항이 없습니다 (mydb id 확인)');
  log(`수학비서: ${cells.length}문항`);
  const images = [];
  for (const c of cells) images.push({ no: c.questionNumber, buf: await msImage(c.imagePath) });

  // ② PDF 조립
  const pdf = await buildPdf(images, TITLE);
  const pdfPath = path.join(OUT_DIR, `exam_${MYDB}.pdf`);
  fs.writeFileSync(pdfPath, pdf.bytes);
  log(`PDF 조립: ${pdf.pages}쪽 ${(pdf.bytes.length / 1024) | 0}KB`);

  // ③ 업로드
  await mfLogin();
  const jobId = await saiJob();
  const { data: pres } = await mf(MF_SAI, 'POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf.bytes });
  if (!up.ok) throw new Error(`PDF 업로드 실패 ${up.status}`);
  log(`업로드 완료 · job ${jobId}`);

  // ④ 문항 인식 (pageIndexes는 "1~N" 형식의 문자열)
  await mf(MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageIndexes: `1~${pdf.pages}`, pageImageQuality: 'HIGH' },
  });
  const doc = await saiPoll(jobId);
  const nBox = [].concat(...doc.boxesOnEachPage).length;
  log(`문항 인식: ${doc.pageImageUrls.length}쪽 · ${nBox}상자`);

  // ⑤ 문제은행 매칭
  await mf(MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/analysis-flow',
    parameters: { pageImageUrls: doc.pageImageUrls, boxesOnEachPage: doc.boxesOnEachPage, trieKey: TRIE },
  });
  const an = await saiPoll(jobId, 360000);
  const matched = an.sourceData.filter((x) => x && x.sourceProblemId).length;
  log(`문제은행 매칭: ${matched}/${an.sourceData.length}`);

  // ⑥ 기타 학습자료 원본 생성 (shareScope는 서버가 ACADEMY로 지정 — 우리 학원 전용)
  const pages = an.pageImageUrls.map((url, i) => ({ index: i + 1, url, boundingBoxes: an.boxesOnEachPage[i] }));
  let t = 0; const boxes = [];
  an.boxesOnEachPage.forEach((pb, pi) => pb.forEach(() => { boxes.push({ pageIndex: pi + 1, index: t + 1, url: an.boxImageUrls[t], ...an.sourceData[t] }); t++; }));
  const { data: paper } = await mf(MF_API, 'POST', '/v2/papers/by-custom', {
    jobId, pdfUrl: pres.url, title: TITLE, gradeSemester: GRADE_LABEL, trieKey: TRIE,
    pages, boxes, needOriginalProblem: true, saveOriginalProblem: true,
  });
  const detailIds = (paper.myDbProblemDetails || []).map((d) => d.id);
  log(`원본 등록: paper ${paper.id} · 문항 ${detailIds.length} · 공개범위 ${paper.shareScope}`);
  fs.writeFileSync(path.join(OUT_DIR, `paper_${MYDB}.json`), JSON.stringify(paper, null, 1));
  if (SKIP_WS) { log('--skip-worksheet: 여기까지'); return { mydb: MYDB, title: TITLE, trie: TRIE, paperId: paper.id, matched, matchedTotal: an.sourceData.length }; }

  // 배정할 학생 찾기 (이름으로 주면 활동학생 명부에서 매쓰플랫 id를 찾는다)
  if (ASSIGN.length) {
    const { data: sd } = await mf(MF_API, 'GET', '/students?size=500');
    const roster = Array.isArray(sd) ? sd : (sd.students || sd.content || []);
    for (const key of ASSIGN) {
      const hit = roster.find((s) => String(s.id) === key) || roster.find((s) => String(s.name || '').trim() === key);
      if (hit) { assignIds.push(hit.id); assignNames.push(hit.name); }
      else log(`⚠ 배정 대상 「${key}」을(를) 매쓰플랫 활동학생에서 못 찾음 — 건너뜁니다`);
    }
    if (assignIds.length) log(`배정 대상: ${assignNames.join(', ')} (${assignIds.join(', ')})`);
  }

  // 학습지 공통 설정 (원본·쌍둥이 둘 다 같은 모양)
  const wsBase = {
    conceptIdList: [], littleChapterConceptIdList: [],
    assignStudentIdList: [], shareScope: 'ACADEMY', writer: '루멘수학',
    layoutType: 0, layoutColor: 'BLUE', partitionType: 0,
    wrongAnswerNoteFlag: false, conceptNameFlag: true, answerRateFlag: false,
    relationWorkbookFlag: false, includeProblemFlag: false,
    conceptSortType: 'CHAPTER',
    schoolType: IS_HIGH ? 'HIGH' : 'MIDDLE',
    revision: TRIE.startsWith('1.4.') ? 'CURRICULUM_22' : 'CURRICULUM_15',
    // 고등 22개정은 학년 칸에 과목명이 들어간다 (중학교는 학년 숫자)
    grade: String(WS_GRADE),
    problemPadding: 60, pdfDateType: 'TODAY', pdfDate: null,
    designTemplateId: null, qrFlag: false, problemTrendFlag: false,
  };
  const made = [];   // 만든 학습지 id들 — 마지막에 폴더로

  // ⑦ 기출원본 학습지 — OCR 문제를 문제은행으로 «복사»한 뒤라야 만들 수 있다
  //    복사는 준비가 끝난 뒤에만 받아준다. 「준비됨」을 우리가 판정하려 했더니 틀렸다 —
  //    ocrStatus가 다 끝나도 문항 이미지 생성이 남아 있어 400(MYDB_PROBLEM_IMAGE_NOT_COMPLETED)이 났다.
  //    그래서 판정하지 않고, 복사 요청 자체를 될 때까지 다시 부른다(서버가 유일한 정답).
  let copied = {};
  let copyOk = false;
  for (let i = 0; i < 60; i++) {                       // 최대 10분 (10초 간격)
    try {
      await mf(MF_API, 'POST', '/my-db-problems/copy-to-problem', { detailIds });
      copyOk = true; break;
    } catch (e) {
      const notReady = /NOT_COMPLETED|INTERNAL_SERVER_ERROR|PROCESSING/i.test(e.message);
      if (!notReady) { log('원본 복사 실패(쌍둥이는 계속 진행):', e.message.slice(0, 150)); break; }
      if (i % 6 === 0) log(`원본 문제 준비 대기… (${i * 10}초)`);
      await sleep(10000);
    }
  }
  if (copyOk) {
    for (let i = 0; i < 80; i++) {
      const { data } = await mf(MF_API, 'POST', '/my-db-problems/copy-to-problem/status', { detailIds });
      const rows = (data && data.details) || [];
      copied = {}; rows.forEach((x) => { if (x.status === 'COPIED') copied[x.myDbProblemDetailId] = x.problemId; });
      if (rows.length && Object.keys(copied).length === rows.length) break;
      await sleep(3000);
    }
  } else log('원본 문제가 제 시간에 준비되지 않음 — 쌍둥이만 만든다');
  const origList = detailIds.map((d, i) => ({ id: copied[d], boxIndex: i + 1 })).filter((p) => p.id);
  log(`원본 문제 복사: ${origList.length}/${detailIds.length}`);
  if (origList.length) {
    const { data: oFlt } = await mf(MF_API, 'POST', '/v2/worksheet/filter/school-test-paper/original', { myDbProblemDetailIds: detailIds });
    const { data: oWs } = await mf(MF_API, 'POST', '/worksheet', {
      ...wsBase, filterId: oFlt.filterId || oFlt,
      problemList: origList, myDbProblemDetailIds: detailIds,   // 원본은 이 둘을 함께 보내야 한다
      title: `${TITLE} 원본`, tag: 'MY_DB_ORIGINAL',
      assignStudentIdList: assignIds,      // 기출 그대로 푸는 것이므로 배정은 원본에 붙인다
    });
    made.push(oWs);
    log(`✅ 기출원본 학습지: worksheet ${oWs} — 「${TITLE} 원본」${assignIds.length ? ` · 배정 ${assignNames.join(', ')}` : ''}`);
  } else {
    log('⚠ 원본 문제 복사가 끝나지 않아 원본 학습지는 건너뜁니다 (나중에 다시 실행)');
  }

  // ⑧ 쌍둥이 학습지 (problemList에는 문제 객체 전체를 그대로 넣어야 한다)
  const { data: flt } = await mf(MF_API, 'POST', '/v2/worksheet/filter/school-test-paper/similar',
    { myDbProblemDetailIds: detailIds, similarX: SIMILAR_X, similarLevel: 'AS_IS' });
  const filterId = flt.filterId || flt;
  const { data: problems } = await mf(MF_API, 'POST', '/worksheet/problem', { filterId });
  log(`쌍둥이 필터: ${problems.length}문항`);
  const { data: wsId } = await mf(MF_API, 'POST', '/worksheet', {
    ...wsBase, filterId, problemList: problems,
    title: `${TITLE} 쌍둥이`, tag: 'CUSTOM_PAPER',
    assignStudentIdList: ASSIGN_TWIN ? assignIds : [],
  });
  made.push(wsId);
  log(`✅ 쌍둥이 학습지: worksheet ${wsId} — 「${TITLE} 쌍둥이」${(ASSIGN_TWIN && assignIds.length) ? ` · 배정 ${assignNames.join(', ')}` : ''}`);

  // ⑨ 마이리스트(폴더)에 넣기 — 같은 이름이 없으면 만든다
  if (MYLIST && made.length) {
    const { data: lists } = await mf(MF_API, 'GET', '/mylist');
    const all = (lists && lists.myLists) || (Array.isArray(lists) ? lists : []);
    let target = all.find((l) => l.name === MYLIST);
    if (!target) {
      const { data: mk } = await mf(MF_API, 'POST', '/mylist', { name: MYLIST });
      target = (mk && mk.myList) || mk;
      log(`마이리스트 「${MYLIST}」 새로 만듦`);
    }
    if (target && target.id) {
      await mf(MF_API, 'POST', `/mylist/${target.id}/element`, { worksheetIds: made });
      log(`마이리스트 「${MYLIST}」에 학습지 ${made.length}장 담음`);
    }
  }

  // ⑩ 고등이면 수입 장부에 적어 둔다 (기출모의 엔진이 이걸 보고 채점을 잇는다)
  const wsOrig = made.length === 2 ? made[0] : (origList.length ? made[0] : null);
  if (IS_HIGH && wsOrig) {
    try { await registerHsExam(String(MYDB), { title: TITLE, paper: paper.id, worksheet: wsOrig, mylist: MYLIST || null }); }
    catch (e) { log('⚠ 고등 수입 장부 등록 오류:', e.message.slice(0, 120)); }
  }

  return {
    mydb: MYDB, title: TITLE, trie: TRIE, gradeLabel: GRADE_LABEL,
    schoolType: IS_HIGH ? 'HIGH' : 'MIDDLE', subject: HS_SUBJECT || null,
    paperId: paper.id, questionCount: cells.length, boxCount: nBox,
    matched, matchedTotal: an.sourceData.length,
    worksheetOriginal: wsOrig,
    worksheetTwin: made[made.length - 1] || null,
    assigned: assignNames, assignedIds: assignIds, assignedTwin: !!ASSIGN_TWIN,
    mylist: MYLIST,
  };
}

module.exports = { runTwinPipeline, sourceTitleOf, trieForExam, hsSubjectOf, registerHsExam, TRIE_22, TRIE_15, TRIE_22_HIGH };

/* ── 명령줄에서 직접 실행할 때 ── */
if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  runTwinPipeline({
    mydb: Number(arg('mydb', 0)),
    trie: arg('trie', ''),
    grade: arg('grade', ''),
    title: arg('title', ''),
    mylist: arg('mylist', ''),
    similarX: Number(arg('similar-x', 1)),
    skipWorksheet: args.includes('--skip-worksheet'),
    assign: arg('assign', ''),
    assignTwin: args.includes('--assign-twin'),
  }).then((r) => log('결과:', JSON.stringify(r)))
    .catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
