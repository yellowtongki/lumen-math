/**
 * 매쓰플랫 학습 데이터 수집기 (2단계) — 학습지 + 교재 통합
 * ==========================================================
 * 학생별로 (1) 학습지 문항 단위 정오답, (2) 학습지·교재 세션 단위 정오답 수와
 * 채점/학습 시각을 매쓰플랫에서 시간순으로 수집한다.
 *
 * 수집 경로 (모두 실측 검증됨):
 *   로그인:   POST /v2/login
 *   활동학생: GET  /students?size=...            → status=ACTIVE 만
 *   [A] 문항단위 학습지 정오답
 *     GET /lesson-classes                                → 반 목록
 *     GET /student-worksheet/lesson-class/{classId}      → 반 학습지 + 배정학생
 *     GET /student-worksheet/assign/{swId}               → 채점시각·정답수·점수
 *     GET /student-worksheet/assign/{swId}/problem       → 문항별 CORRECT/WRONG + 유형
 *   [B] 학습지+교재 세션(시간순) 정오답 수
 *     GET /student-history/work/student/{studentId}?startDate=&endDate=
 *          → bookType=WORKSHEET(학습지)/WORKBOOK(교재) 항목, 각 components 에
 *            correctCount/wrongCount/updateDatetime/page/chapter
 *   [C] 교재 문항별 O/X (✅ 2026-07-13 확보)
 *     GET /student-workbook/student/{sid}/{studentWorkbookId}/{studentBookId}/{progressId}
 *          → 문항별 scoring.result(CORRECT/WRONG) + updateDatetime + 단원 + 문항번호 + 유형
 *            진도(progressId)별 응답을 workbook_problem_id로 dedup(최신 채점 유지)
 *
 * 사용법 (클라우드):
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_collector.js --days 30
 *
 * 옵션:
 *   --days N        최근 N일 범위 (기본 30)
 *   --limit N       [A] 학습지 처리 개수 제한 (0=무제한, 테스트용)
 *   --students N    [B] 학습내역 조회할 학생 수 제한 (0=전체 ACTIVE, 테스트용)
 *   --skip-problems [A] 건너뛰기 (교재 세션만 빠르게)
 *   --skip-history  [B] 건너뛰기 (학습지 문항만)
 *   --out-dir DIR   결과 폴더 (기본 sync/_debug)
 *
 * 출력 (개인정보 포함 → 커밋 금지, .gitignore 처리):
 *   {out-dir}/mf_answer_records.json   [A] 문항 단위 학습지 정오답
 *   {out-dir}/mf_study_sessions.json   [B] 학습지+교재 세션 단위(시간순)
 *
 * Supabase: SUPABASE_URL, SUPABASE_SERVICE_KEY 있으면 각각 테이블에 upsert.
 *   (스키마: docs/mathflat_schema.md)
 *
 * 규칙: 비밀번호/키는 환경변수만. 결과 파일(실명 포함 가능)은 절대 커밋하지 않는다.
 */

const fs = require('fs');
const path = require('path');

const API = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';
const ID = process.env.MATHFLAT_ID;
const PW = process.env.MATHFLAT_PASSWORD;

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const DAYS = parseInt(opt('--days', '30'), 10);
const LIMIT = parseInt(opt('--limit', '0'), 10);
const STU_LIMIT = parseInt(opt('--students', '0'), 10);
const WB_LIMIT = parseInt(opt('--wb-limit', '0'), 10); // 교재 문항수집 대상 교재 수 제한(0=전체)
const OUT_DIR = opt('--out-dir', path.join(__dirname, '_debug'));
const SKIP_PROBLEMS = has('--skip-problems');
const SKIP_HISTORY = has('--skip-history');
const SKIP_WORKBOOK = has('--skip-workbook'); // 교재 문항단위 수집 건너뛰기

function log(...a) { const t = new Date().toISOString().replace('T', ' ').slice(0, 19); console.log(`[${t}]`, ...a); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (d) => d.toISOString().slice(0, 10);
// 매쓰플랫 원본 result: CORRECT / WRONG(INCORRECT) / UNKNOWN(학생이 누른 「모름」) / NONE(미채점)
//   「모름」은 학생이 스스로 “이건 모르겠다”고 표시한 것 = 아하노트에 올려야 할 문제 그 자체라
//   오답(X)·미채점(-)과 반드시 구분해 '?'로 저장한다. (이전에는 '-'로 뭉개져 정보가 버려졌다)
//   ⚠ Supabase 제약을 먼저 풀어야 저장된다 → docs/supabase_unknown_result.sql
//      (안 풀린 상태에서도 수집이 멈추지 않도록 upsert()가 '?'→'-'로 자동 강등한다)
const toOX = (r) => (r === 'CORRECT' ? 'O' : (r === 'WRONG' || r === 'INCORRECT') ? 'X' : r === 'UNKNOWN' ? '?' : '-');

let TOKEN = null;
function _apiHeaders() {
  return {
    'content-type': 'application/json', accept: 'application/json, text/plain, */*',
    'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
    authorization: `Bearer ${TOKEN}`, 'x-auth-token': TOKEN,
    origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/',
  };
}
async function api(pathname, _retried) {
  const res = await fetch(`${API}${pathname}`, { headers: _apiHeaders() });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  // 토큰 만료(401) → 재로그인 후 1회 재시도 (긴 수집 중 세션 끊김 대응)
  if (res.status === 401 && !_retried) {
    log('토큰 만료 감지 → 재로그인');
    await login();
    return api(pathname, true);
  }
  if (!res.ok) throw new Error(`${res.status} ${(json && json.code) || ''} @ ${pathname}`);
  return json ? (json.data !== undefined ? json.data : json) : null;
}

async function login() {
  const res = await fetch(`${API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' },
    body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await res.json();
  if (!res.ok || !j.accessToken) throw new Error(`로그인 실패: ${j.code || res.status}`);
  TOKEN = j.accessToken;
  return { academyId: j.academyId, teacherId: j.userId };
}

async function getActiveStudents() {
  const d = await api('/students?size=500');
  return (d.content || []).filter((s) => s.status === 'ACTIVE');
}

// mf_answer_records 컬럼 통일 — PostgREST는 한 배치의 모든 객체 키가 같아야 함(PGRST102).
// 학습지·교재가 같은 키 집합을 갖도록 빈 값은 null로 채운다.
const REC_COLS = [
  'record_key','source','student_worksheet_id','problem_seq','student_workbook_id','student_book_id',
  'workbook_page_id','workbook_problem_id','number','page','mf_student_id','lumen_rec_code','academy_id',
  'class_id','class_name','book_id','worksheet_id','worksheet_title','worksheet_type','chapter','school','grade',
  'problem_id','worksheet_problem_id','concept_id','topic_id','sub_topic_id','level','result','score',
  'score_datetime','assign_datetime',
];
function mkRec(partial) {
  const o = {};
  for (const k of REC_COLS) o[k] = (partial[k] !== undefined ? partial[k] : null);
  return o;
}

// ── [A] 문항 단위 학습지 정오답 (학생 → 학습내역 → 문항) ──
// v2 (2026-07-17): 기존 "반 → 학습지" 경로는 반별 학습지가 300개를 넘으면
// 최신 학습지가 첫 페이지 밖으로 밀려 통째로 누락됨(M4·T5·T630에서 실제 발생).
// 학생별 학습내역(student-history)은 반 배정·페이지와 무관하게 전부 나오므로 교체.
// history component.studentBookId가 곧 studentWorksheetId (assign API에 그대로 사용 가능 확인).
const WS_TAGS = {}; // worksheet_id → {tag,type,titleTag} — 숙제(HOMEWORK) 등 태그 구분용
const WS_BEHAV = {}; // studentWorksheetId → {sid,wid,date,b:[{name,score,grade}]} — 원클릭 보고서 행동영역(역량)
const WS_ASSIGN = {}; // worksheet_id → { sid → {st,tot,cor,wrg,dt} } — 채점 미완료(이어 채점·미채점) 포함 배정 현황

// 원클릭 보고서 PDF에서 행동영역(역량별 성취율·등급) 추출
// GET /report/worksheet/download?studentWorksheetId={swId} → 서버 생성 PDF (텍스트 레이어 있음)
let _pdfParse = null, _pdfWarned = false;
function getPdfParse() {
  if (_pdfParse) return _pdfParse;
  try { _pdfParse = require('pdf-parse'); } catch (e) {
    if (!_pdfWarned) { log('⚠ pdf-parse 미설치 → 역량(행동영역) 수집 생략 (npm install 필요)'); _pdfWarned = true; }
  }
  return _pdfParse;
}
const BEHAV_NAMES = ['문제해결역량', '추론역량', '의사소통역량', '연결역량', '정보처리역량'];
async function fetchReportStats(swId) {
  const pdfParse = getPdfParse(); if (!pdfParse) return null;
  const H = { ..._apiHeaders(), accept: '*/*' };
  // 전국(NATION)은 매쓰플랫 제공 테스트지(주간·단원 등)에서만 가능 — 커스텀 학습지는 거부될 수 있어 폴백
  let res = await fetch(`${API}/report/worksheet/download?studentWorksheetId=${swId}&reportRankOptions=NATION&reportRankOptions=ACADEMY`, { headers: H });
  if (!res.ok) res = await fetch(`${API}/report/worksheet/download?studentWorksheetId=${swId}&reportRankOptions=ACADEMY`, { headers: H });
  if (!res.ok) res = await fetch(`${API}/report/worksheet/download?studentWorksheetId=${swId}`, { headers: H });
  if (!res.ok) throw new Error(`보고서 다운로드 ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const d = await pdfParse(buf);
  // 공백 + 제어문자(PDF 텍스트 레이어에 섞여 있음) 제거
  const t = (d.text || '').replace(/[\s\u0000-\u001f]+/g, '');
  const out = { b: null, nat: null, acad: null };
  const m = t.match(/행동영역[\s\S]*?영역별성취율([\d.]+)%([\d.]+)%([\d.]+)%([\d.]+)%([\d.]+)%영역별등급(\d)(\d)(\d)(\d)(\d)/);
  if (m) out.b = BEHAV_NAMES.map((name, i) => ({ name, score: Number(m[1 + i]), grade: Number(m[6 + i]) }));
  const n = t.match(/전국전체평균([\d.]+)점등수(\d+)등\/(\d+)명/);
  if (n) out.nat = { avg: Number(n[1]), rank: Number(n[2]), n: Number(n[3]) };
  const a = t.match(/학원전체평균([\d.]+)점등수(\d+)등\/(\d+)명/);
  if (a) out.acad = { avg: Number(a[1]), rank: Number(a[2]), n: Number(a[3]) };
  // 커스텀 학습지는 "전국"이 사실상 우리 학원뿐 → 전국 응시자가 학원 응시자보다 많을 때만 진짜 전국으로 인정
  if (out.nat && !(out.nat.n > ((out.acad && out.acad.n) || 1))) out.nat = null;
  return (out.b || out.nat || out.acad) ? out : null;
}

async function collectAnswerRecords(me, students, cutoff) {
  const start = fmt(cutoff), end = fmt(new Date(Date.now() + 86400000));
  log(`[A] 학습지 문항 수집(학생 단위) · 학생 ${students.length}명 (${start}~${end})`);
  const records = [];
  const seen = new Set();
  let processed = 0;
  for (const st of students) {
    let items;
    try { items = await api(`/student-history/work/student/${st.id}?startDate=${start}&endDate=${end}`); }
    catch (e) { log(`  · 학생 ${st.id} 학습내역 실패: ${e.message}`); continue; }
    for (const it of items || []) {
      if (it.bookType !== 'WORKSHEET') continue;
      for (const c of it.components || []) {
        const swId = c.studentBookId; // = studentWorksheetId
        if (!swId || seen.has(swId)) continue;
        // 배정 현황(채점 미완료 포함) — 명예의 전당 응시 명단용. COMPLETE 필터보다 먼저 기록.
        if (it.bookId && !(c.updateDatetime && new Date(c.updateDatetime) < cutoff)) {
          const W = WS_ASSIGN[it.bookId] = WS_ASSIGN[it.bookId] || {};
          W[st.id] = { st: c.status || null, tot: c.assignedCount != null ? c.assignedCount : null,
            cor: c.correctCount || 0, wrg: c.wrongCount || 0, dt: (c.updateDatetime || '').slice(0, 10) };
        }
        if (c.status !== 'COMPLETE') continue;
        if (c.updateDatetime && new Date(c.updateDatetime) < cutoff) continue;
        seen.add(swId);
        if (LIMIT && processed >= LIMIT) { log(`  [A] --limit ${LIMIT} 도달`); return records; }
        let summary, problems;
        try {
          summary = await api(`/student-worksheet/assign/${swId}`);
          if (summary.scoreDatetime && new Date(summary.scoreDatetime) < cutoff) continue;
          problems = (await api(`/student-worksheet/assign/${swId}/problem`)).content || [];
        } catch (e) { log(`  · 채점 조회 실패 sw=${swId}: ${e.message}`); continue; }
        const ws = summary.worksheet || {};
        if (ws.id) WS_TAGS[ws.id] = { tag: ws.tag || null, type: ws.type || null, titleTag: ws.titleTag || null };
        // 역량(행동영역): 숙제·입학테스트 제외한 학습지만 원클릭 보고서 PDF에서 추출
        if (ws.tag !== 'HOMEWORK' && ws.tag !== 'ENTRANCE_TEST') {
          try {
            const stat = await fetchReportStats(swId);
            // 전국(nat)은 매쓰플랫 제공 시험지(WEEKLY·CHAPTER)에서만 저장 —
            // 학원 자체 학습지(오답지 등)는 기출 문항 때문에 PDF에 전국 수치가 실려도 허수(비교 기준이 다름)
            const natOk = ws.type === 'WEEKLY' || ws.type === 'CHAPTER';
            if (stat) WS_BEHAV[swId] = { sid: st.id, wid: ws.id, date: (summary.scoreDatetime || '').slice(0, 10), b: stat.b, nat: natOk ? stat.nat : null, acad: stat.acad };
          } catch (e) { log(`  · 역량·등수 추출 실패 sw=${swId}: ${e.message}`); }
        }
        problems.forEach((pr, idx) => {
          const prob = pr.problem || {};
          const natRate = prob.problemSummary && prob.problemSummary.answerRate != null ? prob.problemSummary.answerRate : null;
          records.push(mkRec({
            record_key: `ws:${swId}:${idx + 1}`, source: '학습지',
            academy_id: me.academyId, mf_student_id: st.id,
            student_worksheet_id: swId, problem_seq: idx + 1,
            worksheet_id: ws.id, worksheet_title: ws.title, worksheet_type: ws.type,
            chapter: ws.chapter || null, school: ws.school || null, grade: ws.grade || null,
            worksheet_problem_id: pr.worksheetProblemId, problem_id: prob.id,
            concept_id: prob.conceptId || null, topic_id: prob.topicId || null, sub_topic_id: prob.subTopicId || null,
            level: prob.level || null, result: toOX(pr.result),
            number: idx + 1,          // 문항 번호 (풀이 순서)
            page: natRate,            // ⚠ 학습지 행에서 page 컬럼은 전국 정답률(%)로 재활용 (전용 컬럼 없음)
            score: summary.score, score_datetime: summary.scoreDatetime, assign_datetime: summary.assignDatetime,
          }));
        });
        processed++;
        await sleep(120);
      }
    }
    await sleep(80);
  }
  return records;
}

// 역량(행동영역) 사전을 lumen_store 'mf_ws_behaviors'에 병합 저장 (90일 이전 정리)
async function saveWsBehaviors() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !Object.keys(WS_BEHAV).length) return;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    let cur = {};
    const rc = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_behaviors&select=value`, { headers: sbHeaders });
    if (rc.ok) { const j = await rc.json(); if (j[0] && j[0].value && j[0].value.map) cur = j[0].value.map; }
    Object.assign(cur, WS_BEHAV);
    const cutoff90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    Object.keys(cur).forEach((k) => { if (cur[k] && cur[k].date && cur[k].date < cutoff90) delete cur[k]; });
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_ws_behaviors', value: { map: cur, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`역량 행동영역(mf_ws_behaviors): 신규 ${Object.keys(WS_BEHAV).length} · 총 ${Object.keys(cur).length}개 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('역량 저장 실패(치명적 아님):', e.message); }
}

// 배정 현황(채점 미완료 포함)을 lumen_store 'mf_ws_assign'에 병합 저장 (35일 이전 정리)
async function saveWsAssign() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !Object.keys(WS_ASSIGN).length) return;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    let cur = {};
    const rc = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_assign&select=value`, { headers: sbHeaders });
    if (rc.ok) { const j = await rc.json(); if (j[0] && j[0].value && j[0].value.map) cur = j[0].value.map; }
    Object.keys(WS_ASSIGN).forEach((wid) => { cur[wid] = Object.assign(cur[wid] || {}, WS_ASSIGN[wid]); });
    const cutoff35 = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
    Object.keys(cur).forEach((wid) => {
      const latest = Object.values(cur[wid]).reduce((a, s) => (s.dt > a ? s.dt : a), '');
      if (latest && latest < cutoff35) delete cur[wid];
    });
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_ws_assign', value: { map: cur, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`배정 현황(mf_ws_assign): 학습지 ${Object.keys(cur).length}개 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('배정 현황 저장 실패(치명적 아님):', e.message); }
}

// 학습지 태그 사전을 lumen_store 'mf_ws_tags'에 병합 저장 (숙제 제외 필터용)
async function saveWsTags() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || !Object.keys(WS_TAGS).length) return;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    let cur = {};
    const rc = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_tags&select=value`, { headers: sbHeaders });
    if (rc.ok) { const j = await rc.json(); if (j[0] && j[0].value && j[0].value.tags) cur = j[0].value.tags; }
    Object.assign(cur, WS_TAGS);
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_ws_tags', value: { tags: cur, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`학습지 태그(mf_ws_tags): ${Object.keys(cur).length}개 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('학습지 태그 저장 실패(치명적 아님):', e.message); }
}

// ── [B] 학습지+교재 세션 단위 (학생별 학습내역, 시간순) ──
async function collectStudySessions(students, cutoff) {
  // 학습내역 API는 조회 범위 최대 약 365일 → start를 안전하게 클램프
  const maxBack = new Date(Date.now() - 360 * 86400 * 1000);
  const startDate = cutoff > maxBack ? cutoff : maxBack;
  const start = fmt(startDate), end = fmt(new Date(Date.now() + 86400000));
  const target = STU_LIMIT ? students.slice(0, STU_LIMIT) : students;
  log(`[B] 학습지+교재 세션 수집 · 학생 ${target.length}명 (${start}~${end})`);
  const rows = [];
  for (const st of target) {
    let items;
    try { items = await api(`/student-history/work/student/${st.id}?startDate=${start}&endDate=${end}`); }
    catch (e) { log(`  · 학생 ${st.id} 학습내역 실패: ${e.message}`); continue; }
    for (const it of items || []) {
      const kind = it.bookType === 'WORKBOOK' ? '교재' : '학습지';
      for (const c of it.components || []) {
        // updateDatetime(교재/학습지 공통) 기준 기간 필터
        if (c.updateDatetime && new Date(c.updateDatetime) < cutoff) continue;
        rows.push({
          academy_id: undefined, mf_student_id: st.id,
          source: kind,                                  // '학습지' | '교재'
          book_type: it.bookType,                        // WORKSHEET | WORKBOOK
          book_id: it.bookId || null,
          title: it.title || null, subtitle: it.subtitle || null,
          chapter: it.chapter || null, page: c.page || null,
          student_book_id: c.studentBookId || null,
          student_workbook_id: c.studentWorkbookId || null,
          assigned_count: c.assignedCount != null ? c.assignedCount : null,
          correct_count: c.correctCount != null ? c.correctCount : null,
          wrong_count: c.wrongCount != null ? c.wrongCount : null,
          status: c.status || it.status || null,
          update_datetime: c.updateDatetime || null,     // 학습/채점 시각
          problem_count: Array.isArray(c.progressIdList) ? c.progressIdList.length : (Array.isArray(it.elements) ? it.elements.length : null),
        });
      }
    }
    await sleep(120);
  }
  return rows;
}

// ── [C] 교재 문항 단위 정오답 (student-workbook 진도별 → dedup) ──
// GET /student-workbook/student/{sid}/{studentWorkbookId}/{studentBookId}/{progressId}
//   → 문항별 scoring.result(CORRECT/WRONG) + updateDatetime + 단원(title) + 문항번호(number) + 유형
async function collectWorkbookProblems(me, students, cutoff) {
  const start = fmt(cutoff > new Date(Date.now() - 360 * 86400000) ? cutoff : new Date(Date.now() - 360 * 86400000));
  const end = fmt(new Date(Date.now() + 86400000));
  const target = STU_LIMIT ? students.slice(0, STU_LIMIT) : students;
  log(`[C] 교재 문항 수집 · 학생 ${target.length}명`);
  const records = [];
  let wbCount = 0;
  for (const st of target) {
    let items;
    try { items = await api(`/student-history/work/student/${st.id}?startDate=${start}&endDate=${end}`); }
    catch (e) { continue; }
    const books = (items || []).filter((it) => it.bookType === 'WORKBOOK');
    for (const it of books) {
      for (const c of it.components || []) {
        if (c.updateDatetime && new Date(c.updateDatetime) < cutoff) continue; // 기간 밖 교재 스킵
        if (WB_LIMIT && wbCount >= WB_LIMIT) { log(`  [C] --wb-limit ${WB_LIMIT} 도달`); return records; }
        wbCount++;
        const base = `/student-workbook/student/${st.id}/${c.studentWorkbookId}/${c.studentBookId}`;
        const byProblem = {};
        for (const pid of c.progressIdList || []) {
          let page;
          try { page = await api(`${base}/${pid}?page=0&size=1000000`); }
          catch (e) { continue; }
          for (const p of (page && page.content) || []) {
            const s = p.scoring || {};
            const prev = byProblem[p.id];
            if (!prev || (s.updateDatetime || '') > (prev.at || '')) {
              byProblem[p.id] = { unit: p.title, number: p.number, result: s.result, at: s.updateDatetime,
                conceptId: p.conceptId, topicId: p.topicId, subTopicId: p.subTopicId, level: p.level, pageId: p.workbookPageId };
            }
          }
          await sleep(90);
        }
        for (const [wpId, v] of Object.entries(byProblem)) {
          /* ★ 2026-08-28: 고유키에 「회차」(studentBookId)를 넣는다.
           * [왜] 전에는 wb:학생교재ID:문항ID 였다. 그런데 같은 교재를 2회차로 다시 풀리면
           *   학생교재ID는 그대로이고 회차ID만 바뀐다. 그래서 2회차에 같은 문항을 풀면
           *   1회차 기록을 <b>덮어써</b> 문항수가 늘지 않았다(진도 레이스 점수도 그대로).
           *   1회차 오답 기록도 사라져 오답 추적이 끊겼다.
           * [지금까지 안 터진 이유] 실제 2회차 사례가 옥서희(개념원리 미적분1) 하나뿐이었고,
           *   그마저 1·2회차가 서로 다른 페이지라 겹치는 문항이 0개였다.
           *   블랙반이 쎈을 2회 도는 계획이라 곧 터질 상황이었다.
           * [기존 기록] 옛 키(wb:교재:문항)로 쌓인 39,292건은 그대로 둔다.
           *   다음 수집부터 새 키로 들어오므로, 이미 푼 1회차가 새 키로 한 번 더 들어올 수 있다.
           *   같은 문항을 두 번 세는 셈이 되므로 아래 fixLegacyWbKeys()가 옛 키를 정리한다. */
          records.push(mkRec({
            record_key: `wb:${c.studentWorkbookId}:${c.studentBookId}:${wpId}`, source: '교재',
            academy_id: me.academyId, mf_student_id: st.id,
            student_workbook_id: c.studentWorkbookId, student_book_id: c.studentBookId,
            book_id: it.bookId, worksheet_title: (it.title || '') + (it.subtitle || ''),
            chapter: v.unit || it.chapter || null, page: c.page || null, workbook_page_id: v.pageId,
            workbook_problem_id: Number(wpId), number: v.number || null,
            concept_id: v.conceptId || null, topic_id: v.topicId || null, sub_topic_id: v.subTopicId || null,
            level: v.level || null, result: toOX(v.result), score_datetime: v.at || null,
          }));
        }
      }
    }
  }
  return records;
}

function saveJson(name, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const p = path.join(OUT_DIR, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 1));
  log(`저장: ${p} (${data.length}건 · 커밋 금지)`);
  return p;
}

/* ═══════════ 월간보고서 자동 실행 (--monthly) ═══════════
 * 학원앱 「🚀 일괄 실행」이 저장한 lumen_store 'mf_report_req'
 * ({ym, status:'requested', students:[{sid,name,code,opinion}]})를 읽어
 * 매쓰플랫에서 학생별 월간 리포트 PDF를 다운로드하고
 * Supabase Storage(photos/mf_monthly/<YYYY-MM>/)에 업로드 →
 * 'mf_report_files' 색인 갱신 → status: done/partial/failed.
 * 월간 리포트 API 경로는 최초 1회 웹 번들에서 자동 탐색해
 * lumen_store 'mf_report_api'에 저장·재사용. */

const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_SERVICE_KEY;
function sbH(extra) { return Object.assign({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` }, extra || {}); }
async function storeGet(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  const j = await r.json().catch(() => null);
  return Array.isArray(j) && j[0] ? j[0].value : null;
}
async function storeSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST', headers: sbH({ 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) log(`lumen_store ${key} 저장 실패 ${r.status}`);
  return r.ok;
}
async function storageUpload(pathRel, buf, contentType) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${pathRel}`, {
    method: 'POST', headers: sbH({ 'content-type': contentType, 'x-upsert': 'true' }), body: buf,
  });
  if (!r.ok) log(`Storage 업로드 실패 ${r.status} @ ${pathRel}: ${(await r.text().catch(() => '')).slice(0, 120)}`);
  return r.ok;
}

// ── 월간 리포트: "이미 매쓰플랫에 생성된" 보고서를 다운로드해 Supabase에 적재 ──
// (2026-07-19 확인) 매쓰플랫 월간보고서는 공개 다운로드 API가 없고, 대신 다음 흐름:
//   1) GET /report/{studentId}?type=MONTHLY&size=50 → 학생이 이미 생성한 월간보고서 목록
//      각 항목: {id, type:'MONTHLY', yearMonth, status:'SUCCESS', pdfUrl, totalScore, ...}
//   2) 항목의 pdfUrl(https://mathflat-user-uploads.mathflat.com/created-report/{id}.pdf)을 그대로 GET
// ※ 보고서 "생성"은 매쓰플랫 내부 다단계(scoring+create) 절차라 자동화가 취약 → 생성은
//   원장님이 매쓰플랫에서(그룹 보고서 생성 1회) 하고, 수집기는 "생성된 것 자동 다운로드"만 담당.
const MF_UPLOAD_HOST = 'https://mathflat-user-uploads.mathflat.com';

// ym 정규화: '2026.06' / '2026-06' → '2026-06'
function normYm(ym) { return String(ym || '').replace(/[./]/g, '-').slice(0, 7); }

// 학생의 월간보고서 목록 (최신순). 실패 시 [].
async function listMonthlyReports(sid) {
  try {
    const d = await api(`/report/${sid}?type=MONTHLY&size=50`);
    return (d && d.content) || [];
  } catch (e) { return []; }
}

// pdfUrl 직접 다운로드 → PDF Buffer (성공 시). 인증 헤더 불필요하지만 붙여도 무방.
async function downloadReportPdf(pdfUrl) {
  const res = await fetch(pdfUrl, { headers: { accept: '*/*' } });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 4 && buf.slice(0, 4).toString() === '%PDF') return buf;
  if (buf.length >= 10000) return buf; // octet-stream이어도 충분히 크면 인정
  return null;
}

async function runMonthly() {
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
  const req = await storeGet('mf_report_req');
  if (!req || req.status !== 'requested') { log(`월간보고서: 대기 중인 요청 없음 (status=${(req && req.status) || '없음'})`); return; }
  const ym = normYm(req.ym);
  const items = req.students || [];
  log(`월간보고서 다운로드: ${ym} · 요청 ${items.length}명`);
  const me = await login();
  log(`로그인 성공 · 학원 ${me.academyId}`);
  const students = await getActiveStudents();
  const byName = {}; students.forEach((s) => { byName[s.name] = s; });

  const results = [];
  for (const it of items) {
    const st = byName[it.name] || students.find((s) => String(s.id) === String(it.sid));
    if (!st) { results.push({ name: it.name, ok: false, why: '매쓰플랫 학생 매칭 실패' }); continue; }
    const list = await listMonthlyReports(st.id);
    // 요청 월과 일치 + 생성 완료(SUCCESS)한 보고서
    const rep = list.find((r) => normYm(r.yearMonth) === ym && r.status === 'SUCCESS' && r.pdfUrl && !r.deleted);
    if (!rep) {
      const has = list.some((r) => normYm(r.yearMonth) === ym);
      results.push({ name: it.name, ok: false, why: has ? '매쓰플랫에서 생성 중/미완료' : '매쓰플랫에 미생성' });
      await sleep(120); continue;
    }
    const buf = await downloadReportPdf(rep.pdfUrl);
    if (!buf) { results.push({ name: it.name, ok: false, why: 'PDF 다운로드 실패' }); await sleep(150); continue; }
    // Supabase Storage 키는 ASCII만 허용 → 한글 이름 대신 매쓰플랫 학생ID 사용
    // (한글 이름은 아래 mf_report_files 색인의 name 필드에 보관 → 앱에서 표시)
    const safe = String(st.id).replace(/[^A-Za-z0-9]/g, '');
    const rel = `photos/mf_monthly/${ym}/${safe}_${ym}.pdf`;
    const ok = await storageUpload(rel, buf, 'application/pdf');
    results.push({
      name: it.name, ok, path: ok ? rel : null, why: ok ? '' : '업로드 실패',
      reportId: rep.id, totalScore: rep.totalScore, totalTier: rep.totalTier,
    });
    log(`  · ${it.name}: ${ok ? '저장 완료 (' + Math.round(buf.length / 1024) + 'KB, ' + (rep.totalScore ?? '-') + '점)' : '업로드 실패'}`);
    await sleep(250);
  }
  // 색인 갱신 (mf_report_files: {ym:{files:[{name,path,at,score,tier}]}})
  const okR = results.filter((r) => r.ok);
  if (okR.length) {
    const files = (await storeGet('mf_report_files')) || {};
    files[ym] = files[ym] || { files: [] };
    okR.forEach((r) => {
      files[ym].files = (files[ym].files || []).filter((f) => f.path !== r.path);
      files[ym].files.push({ name: `${r.name}_${ym}.pdf`, path: r.path, at: new Date().toISOString(), score: r.totalScore, tier: r.totalTier });
    });
    await storeSet('mf_report_files', files);
  }
  const fails = results.filter((r) => !r.ok);
  const notMade = fails.filter((f) => f.why === '매쓰플랫에 미생성' || f.why === '매쓰플랫에서 생성 중/미완료');
  req.status = okR.length ? (fails.length ? 'partial' : 'done') : 'failed';
  req.doneAt = new Date().toISOString();
  req.note = fails.length ? '미수집: ' + fails.map((f) => `${f.name}(${f.why})`).join(', ') : '';
  await storeSet('mf_report_req', req);
  log(`월간보고서 완료: 다운로드 ${okR.length} · 미수집 ${fails.length}${req.note ? ' · ' + req.note : ''}`);
  if (notMade.length) {
    log(`※ ${notMade.length}명은 매쓰플랫에 ${ym} 보고서가 아직 생성되지 않았습니다.`);
    log('※ 매쓰플랫(teacher.mathflat.com)에서 해당 학생 월간보고서를 생성하면, 다음 실행 때 자동으로 받아옵니다.');
  }
}

// ── 행동영역·전국등수 백필 (v16-43) ───────────────────────────
// 원클릭 보고서 PDF는 매쓰플랫이 비결정적으로 생성(같은 시험지도 행동영역이
// 있다 없다 함) → 첫 수집에서 놓친 시험지의 행동영역(오각형)·전국/학원 등수를
// 최근 N일 범위에서 다시 시도해 채운다. 시험지당 최대 3회 재요청.
async function backfillBehaviors(days) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  if (!getPdfParse()) return;
  try {
    // 현재 사전 + 태그
    let cur = {}, tags = {};
    const rc = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_behaviors&select=value`, { headers: sbHeaders });
    if (rc.ok) { const j = await rc.json(); cur = (j[0] && j[0].value && j[0].value.map) || {}; }
    const rt = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_tags&select=value`, { headers: sbHeaders });
    if (rt.ok) { const j = await rt.json(); tags = (j[0] && j[0].value && j[0].value.tags) || {}; }
    // 최근 학습지 시험지 목록
    const d0 = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const rows = [];
    for (let off = 0; off < 50000; off += 1000) {
      const q = `select=student_worksheet_id,worksheet_id,worksheet_type,mf_student_id,score_datetime&source=eq.${encodeURIComponent('학습지')}&score_datetime=gte.${d0}&limit=1000&offset=${off}`;
      const r = await fetch(`${url}/rest/v1/mf_answer_records?${q}`, { headers: sbHeaders });
      if (!r.ok) break;
      const b = await r.json(); rows.push(...b);
      if (b.length < 1000) break;
    }
    const sws = {};
    rows.forEach((r) => {
      if (!r.student_worksheet_id) return;
      const tg = tags[r.worksheet_id];
      if ((tg && (tg.tag === 'HOMEWORK' || tg.tag === 'ENTRANCE_TEST')) || r.worksheet_type === 'ENTRANCE') return;
      sws[r.student_worksheet_id] = { sid: r.mf_student_id, wid: r.worksheet_id, type: r.worksheet_type, date: (r.score_datetime || '').slice(0, 10) };
    });
    // 누락 대상: 사전에 없거나, 행동영역(b) 없거나, (주간·단원인데) 전국(nat) 없음
    const targets = Object.keys(sws).filter((swId) => {
      const e = cur[String(swId)];
      if (!e) return true;
      const wantNat = (sws[swId].type === 'WEEKLY' || sws[swId].type === 'CHAPTER') && !e.nat;
      return !e.b || wantNat;
    });
    if (!targets.length) { log(`행동영역 백필: 누락 없음 (최근 ${days}일)`); return; }
    targets.sort((a, b) => String(sws[b].date).localeCompare(String(sws[a].date))); // 최신 시험지 우선 (뒤쪽이 속도제한에 걸려도 중요한 최근분은 확보)
    log(`행동영역 백필: 대상 ${targets.length}건 (최근 ${days}일) — 시험지당 최대 3회 재시도`);
    let got = 0;
    for (const swId of targets) {
      const prev = cur[String(swId)] || {};
      let best = null;
      for (let att = 1; att <= 3; att++) {
        try {
          const s2 = await fetchReportStats(swId);
          // 전국(nat)은 WEEKLY·CHAPTER만 채택 (자체 학습지의 기출 유래 전국 수치는 허수)
          const natOk2 = sws[swId].type === 'WEEKLY' || sws[swId].type === 'CHAPTER';
          if (s2) { best = best || {}; if (s2.b && !best.b) best.b = s2.b; if (s2.nat && !best.nat && natOk2) best.nat = s2.nat; if (s2.acad && !best.acad) best.acad = s2.acad; }
        } catch (e) {}
        const needMore = !best || !best.b || ((sws[swId].type === 'WEEKLY' || sws[swId].type === 'CHAPTER') && !best.nat);
        if (!needMore) break;
        await sleep(best ? 700 : 2000); // 실패(속도제한 의심)면 길게 쉼
      }
      if (best && (best.b || best.nat || best.acad)) {
        const natKeep = (sws[swId].type === 'WEEKLY' || sws[swId].type === 'CHAPTER') ? (best.nat || prev.nat || null) : null;
        cur[String(swId)] = { sid: sws[swId].sid, wid: sws[swId].wid, date: sws[swId].date,
          b: best.b || prev.b || null, nat: natKeep, acad: best.acad || prev.acad || null };
        got++;
      }
      await sleep(450);
    }
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_ws_behaviors', value: { map: cur, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`행동영역 백필: ${got}/${targets.length} 확보 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('행동영역 백필 실패(치명적 아님):', e.message); }
}

async function main() {
  // --monthly: 월간보고서 요청 처리 (매쓰플랫 로그인 필요)
  if (has('--monthly')) { await runMonthly(); return; }
  // --behaviors-only: 행동영역·등수 백필만 (매쓰플랫 로그인 필요)
  if (has('--behaviors-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meB = await login();
    log(`로그인 성공 · 학원 ${meB.academyId}`);
    await backfillBehaviors(parseInt(opt('--days', '14'), 10));
    return;
  }
  // --roadmap-only: 로드맵(mf_progress) 집계만 (단원명 매핑에 매쓰플랫 로그인 필요)
  if (has('--roadmap-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meR = await login();
    log(`로그인 성공 · 학원 ${meR.academyId}`);
    await refreshRoadmap();
    return;
  }
  // --wkcat-only: 주간 TEST 카탈로그(다음 시험 예고용)만 수집 (매쓰플랫 로그인 필요)
  if (has('--wkcat-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meW = await login();
    log(`로그인 성공 · 학원 ${meW.academyId}`);
    await refreshWkCatalog();
    return;
  }
  // --books-only: 주문 교재 PDF 목록만 새로고침 (매쓰플랫 로그인 필요)
  if (has('--books-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meBk = await login();
    log(`로그인 성공 · 학원 ${meBk.academyId}`);
    await refreshWorkbookPdfs();
    return;
  }
  // --bookans-only: 교재 정답사전만 새로고침 (매쓰플랫 로그인 필요) — v18-74
  if (has('--bookans-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meBa = await login();
    log(`로그인 성공 · 학원 ${meBa.academyId}`);
    await refreshStudentWorkbooks();
    await refreshBookAnswers();
    return;
  }
  // --kmm-only: KMM 경시 성적만 수집
  if (has('--kmm-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const meK = await login();
    log(`로그인 성공 · 학원 ${meK.academyId}`);
    await refreshKmm();
    return;
  }
  // --regrade-bookans: 매쓰플랫 로그인 없이 저장된 정답사전의 gradable 판정만 재계산 — v2-41
  // (채점엔진이 좋아지면 이미 받은 정답으로 자동채점 가능 문항이 늘어난다. API 재호출 없음)
  if (has('--regrade-bookans')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await regradeBookAnswers();
    return;
  }
  // --weekly-only: 매쓰플랫 로그인 없이 주간테스트 집계만 (Supabase 기존 기록 사용)
  if (has('--weekly-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await refreshWkCand();
    await refreshWeekly();
    return;
  }
  // --counts-only: 매쓰플랫 로그인 없이 월별 문항수 집계만 (Supabase 기존 기록 사용)
  if (has('--counts-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await refreshMonthCounts();
    return;
  }
  // --typeach-only: 매쓰플랫 로그인 없이 유형성취도 2주 집계만 (Supabase 기존 기록 사용)
  if (has('--typeach-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await refreshTypeAch();
    return;
  }
  // --fix-keys: 매쓰플랫 로그인 없이 옛 교재 고유키만 새 형식으로 옮긴다 (--dry-run 이면 세어만 봄)
  if (has('--fix-keys')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await fixLegacyWbKeys({ dry: has('--dry-run') });
    return;
  }
  // --stuck-only: 매쓰플랫 로그인 없이 「막힌 문제」만 재계산 (Supabase 기존 기록 사용)
  if (has('--stuck-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    await refreshStuck();
    return;
  }
  // --scores-only: 월간보고서 점수·티어만 수집 (매쓰플랫 로그인 필요)
  if (has('--scores-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
    if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
    const me2 = await login();
    log(`로그인 성공 · 학원 ${me2.academyId}`);
    await refreshMonthScores(await getActiveStudents());
    return;
  }
  if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
  const cutoff = new Date(Date.now() - DAYS * 86400 * 1000);
  log(`로그인 중… (최근 ${DAYS}일, 기준 ${fmt(cutoff)} 이후)`);
  const me = await login();
  log(`로그인 성공 · 학원 ${me.academyId} · 선생님 ${me.teacherId}`);
  const students = await getActiveStudents();
  log(`활동 학생(ACTIVE) ${students.length}명`);

  let wsAnswers = [], wbAnswers = [], sessions = [];
  if (!SKIP_PROBLEMS) wsAnswers = await collectAnswerRecords(me, students, cutoff);
  if (!SKIP_WORKBOOK) wbAnswers = await collectWorkbookProblems(me, students, cutoff);
  const answers = wsAnswers.concat(wbAnswers);           // 학습지 + 교재 문항단위 통합
  if (answers.length) saveJson('mf_answer_records.json', answers);
  if (!SKIP_HISTORY)  { sessions = await collectStudySessions(students, cutoff); saveJson('mf_study_sessions.json', sessions); }

  // 통계
  const bkSess = sessions.filter((s) => s.source === '교재');
  log('── 수집 완료 ──');
  log(`[A] 학습지 문항: ${wsAnswers.length}개 (오답 ${wsAnswers.filter((r) => r.result === 'X').length})`);
  log(`[C] 교재 문항:   ${wbAnswers.length}개 (오답 ${wbAnswers.filter((r) => r.result === 'X').length})`);
  log(`[B] 세션(시간순): 학습지 ${sessions.filter((s) => s.source === '학습지').length} · 교재 ${bkSess.length}`);

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    // 학생 명단(이름·학년) 저장 — 앱에서 mf_student_id를 실제 이름으로 표시하기 위함
    const studentRows = students.map((s) => ({
      mf_student_id: s.id, name: s.name, login_id: s.loginId || null,
      grade: s.grade != null ? String(s.grade) : null, school_type: s.schoolType || null,
      status: s.status || null,
    }));
    if (studentRows.length) await upsert('mf_students', studentRows, 'mf_student_id');
    // 교재 기록을 저장하기 직전에 옛 고유키를 새 형식으로 옮긴다 (같은 문제 두 번 세는 것 방지)
    await fixLegacyWbKeys({ dry: has('--dry-run') });
    if (answers.length) await upsert('mf_answer_records', answers, 'record_key');
    if (sessions.length) await upsert('mf_study_sessions', sessions, 'mf_student_id,book_id,student_workbook_id,student_book_id,update_datetime');
    await saveWsTags();
    await saveWsAssign();
    await saveWsBehaviors();
    await backfillBehaviors(14); // 놓친 행동영역·전국등수 매일 자동 재시도 (v16-43)
    await refreshConceptNames();
    await refreshBookCatalog();
    await refreshWorkbookPdfs();   // v18-61: 주문 교재 PDF 목록(앱 다운로드용)
    await refreshKmm();            // v1-19: KMM 경시대회 성적·수상
    await refreshTypeDb();
    await refreshRoadmap();
    await refreshWeekly();
    await refreshWkCatalog();
    await refreshWkCand();
    await refreshMonthCounts();
    await refreshMonthScores(students);
    await refreshTypeAch();
    await refreshStuck();          // v18-46: 「막힌 문제」 사전 계산 (아하노트 퍼센트의 분모)
    await refreshStudentWorkbooks(); // v18-74: 학생별 교재·회차·페이지(progressId)
    await refreshBookAnswers();    // v18-74: 교재 채점용 정답사전
    // v18-86: 🏁 진도 레이스 순위 집계 (시즌이 없으면 스스로 건너뛴다)
    try { const { runRace } = require('./race_engine.js'); await runRace(); }
    catch (e) { log('진도 레이스 집계 실패(치명적 아님):', e.message); }
    // v18-38: 수학비서 주간테스트 파이프라인 — 지정폴더 스캔·매쓰플랫 업로드 (새벽 전체 수집에 편승)
    if (process.env.MATHSECR_ID && process.env.MATHSECR_PASSWORD) {
      try {
        const { runPipeline } = require('./mathsecr_weekly_pipeline.js');
        await runPipeline({ upload: true });   // 새벽 실행이므로 매쓰플랫 업로드 단계까지
      } catch (e) { log('수학비서 파이프라인 실패(치명적 아님):', e.message); }
    }
  } else {
    log('SUPABASE_URL/SERVICE_KEY 미설정 → 로컬 저장·검증만 (Supabase 저장 생략).');
  }
}

// ── 매쓰플랫 학생ID ↔ 학원 학생코드 매핑 ───────────────────────────
// mf_answer_records의 lumen_rec_code는 비어 있음(수집 시 미매핑) → 집계 시점에
// or_studentdb(이름→코드)와 mf_students(sid→이름)를 이름으로 조인해 해결.
// 이름이 중복되면 그 학생만 매핑 생략(sid: 키 유지). 매핑된 코드는
// mf_students.lumen_rec_code에도 백필해 앱(월간보고서 등)의 매칭을 돕는다.
async function buildSidCodeMap() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const map = {}; // mf_student_id → lumen_rec_code
  try {
    const r1 = await fetch(`${url}/rest/v1/lumen_store?key=eq.or_studentdb&select=value`, { headers: sbHeaders });
    const j1 = await r1.json();
    let arr = Array.isArray(j1) && j1[0] ? j1[0].value : [];
    if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch (e) { arr = []; } }
    const byName = {}; const dup = {};
    (arr || []).forEach((s) => {
      if (!s || !s.name || s.lumen_rec_code == null || s.withdrawn) return;
      const nm = String(s.name).trim();
      if (byName[nm]) dup[nm] = true; else byName[nm] = String(s.lumen_rec_code);
    });
    const r2 = await fetch(`${url}/rest/v1/mf_students?select=mf_student_id,name`, { headers: sbHeaders });
    const rows = await r2.json();
    const backfill = [];
    (Array.isArray(rows) ? rows : []).forEach((m) => {
      const nm = String(m.name || '').trim();
      if (!nm || dup[nm] || !byName[nm]) return;
      map[m.mf_student_id] = byName[nm];
      backfill.push({ mf_student_id: m.mf_student_id, lumen_rec_code: byName[nm] });
    });
    if (backfill.length) {
      await fetch(`${url}/rest/v1/mf_students?on_conflict=mf_student_id`, {
        method: 'POST', headers: Object.assign({}, sbHeaders, { prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(backfill),
      });
    }
    log(`학생 매핑: ${Object.keys(map).length}명 (mf_students 코드 백필 ${backfill.length}건)`);
  } catch (e) { log('학생 매핑 실패(치명적 아님):', e.message); }
  return map;
}

// ── 월별 문항수 집계 → lumen_store 'mf_month_counts' ───────────────
// 레벨관리 「이번달 문제수 손 입력」 대체: mf_answer_records에서 채점(O/X)된
// 문항을 학생×월로 집계. 최근 3개월만 다시 계산하고 과거 달은 보존한다.
// 값 형태: { months: { '2026-07': { '<lumen_rec_code|sid:...>': 문항수 } }, updated }
async function refreshMonthCounts() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const sidCode = await buildSidCodeMap();
    const now = new Date();
    const months = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    const fresh = {};
    for (const ym of months) {
      const [y, m] = ym.split('-').map(Number);
      const next = new Date(y, m, 1); // m은 1-12 → Date月 인덱스로 쓰면 다음 달 1일
      const nextYm = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
      const counts = {};
      for (let off = 0; off < 200000; off += 1000) {
        const q = `select=lumen_rec_code,mf_student_id,result&score_datetime=gte.${ym}-01&score_datetime=lt.${nextYm}-01&limit=1000&offset=${off}`;
        const res = await fetch(`${url}/rest/v1/mf_answer_records?${q}`, { headers: sbHeaders });
        if (!res.ok) { log(`월별 집계 조회 실패 ${res.status} (${ym})`); break; }
        const batch = await res.json();
        batch.forEach((r) => {
          if (r.result !== 'O' && r.result !== 'X') return;
          const k = r.lumen_rec_code || sidCode[r.mf_student_id] || (r.mf_student_id ? 'sid:' + r.mf_student_id : null);
          if (!k) return;
          counts[k] = (counts[k] || 0) + 1;
        });
        if (batch.length < 1000) break;
      }
      fresh[ym] = counts;
    }
    // 기존 저장분과 병합 — 3개월보다 오래된 달은 그대로 유지
    const prevRes = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_month_counts&select=value`, { headers: sbHeaders });
    let prev = {};
    try { const j = await prevRes.json(); prev = (Array.isArray(j) && j[0] && j[0].value && j[0].value.months) || {}; } catch (e) {}
    const merged = Object.assign({}, prev, fresh);
    const w = await fetch(`${url}/rest/v1/lumen_store`, {
      method: 'POST', headers: Object.assign({}, sbHeaders, { prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: 'mf_month_counts', value: { months: merged, updated: new Date().toISOString() } }),
    });
    if (!w.ok) { log(`mf_month_counts 저장 실패 ${w.status}`); return; }
    const mm = months.map((ym) => {
      const c = fresh[ym] || {};
      return `${ym}: ${Object.values(c).reduce((a, b) => a + b, 0)}문항/${Object.keys(c).length}명`;
    }).join(' · ');
    log(`월별 문항수 집계 저장(mf_month_counts): ${mm}`);
  } catch (e) { log('월별 문항수 집계 실패(치명적 아님):', e.message); }
}

// ── 유형성취도 2주 단위 집계 → lumen_store 'mf_type_ach' ─────────────
// mf_answer_records(문항×유형×난이도×정오)를 학생×2주기간×유형으로 집계.
// 학원앱 유형성취도 「자동 회차·변화 대시보드」, 학부모 유형 리포트,
// 학생앱 정복 퀘스트의 데이터원. PDF 업로드 불필요.
// 기간: 2025-11-03(월)부터 14일 창. 최근 8개 기간(16주)만 저장.
// 값: { epoch, periods:[시작일...], names:{cid:{m:중단원,n:유형명}},
//       data: { '<code|sid:...>': { '<기간시작일>': { '<cid>': [총,정답, 개념총,개념정답, 기본총,기본정답, 심화총,심화정답] } } } }
const TA_EPOCH = '2025-11-03';
function taPeriodStart(dateStr) {
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00Z');
  const e = new Date(TA_EPOCH + 'T00:00:00Z');
  const idx = Math.floor((d - e) / (14 * 86400000));
  if (idx < 0) return null;
  return new Date(e.getTime() + idx * 14 * 86400000).toISOString().slice(0, 10);
}
async function refreshTypeAch() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const sidCode = await buildSidCodeMap();
    // 최근 8개 기간의 시작일
    const nowP = taPeriodStart(new Date().toISOString());
    const periods = [];
    for (let i = 7; i >= 0; i--) {
      const t = new Date(nowP + 'T00:00:00Z').getTime() - i * 14 * 86400000;
      const p = new Date(t).toISOString().slice(0, 10);
      if (p >= TA_EPOCH) periods.push(p);
    }
    const since = periods[0];
    const data = {};
    let nRec = 0;
    for (let off = 0; off < 500000; off += 1000) {
      const q = `select=lumen_rec_code,mf_student_id,concept_id,level,result,score_datetime`
        + `&score_datetime=gte.${since}&limit=1000&offset=${off}&order=score_datetime.asc`;
      const res = await fetch(`${url}/rest/v1/mf_answer_records?${q}`, { headers: sbHeaders });
      if (!res.ok) { log(`유형 집계 조회 실패 ${res.status}`); break; }
      const batch = await res.json();
      batch.forEach((r) => {
        if ((r.result !== 'O' && r.result !== 'X') || !r.concept_id || !r.score_datetime) return;
        const p = taPeriodStart(r.score_datetime); if (!p || p < since) return;
        const codeK = r.lumen_rec_code || sidCode[r.mf_student_id] || (r.mf_student_id ? 'sid:' + r.mf_student_id : null);
        if (!codeK) return;
        const cid = String(r.concept_id);
        const stu = data[codeK] || (data[codeK] = {});
        const per = stu[p] || (stu[p] = {});
        const arr = per[cid] || (per[cid] = [0, 0, 0, 0, 0, 0, 0, 0]);
        const ok = r.result === 'O' ? 1 : 0;
        arr[0]++; arr[1] += ok;
        const lv = Number(r.level) || 3;
        const b = lv <= 2 ? 1 : lv === 3 ? 2 : 3; // 1=개념(1-2) 2=기본(3) 3=심화(4-5)
        arr[b * 2]++; arr[b * 2 + 1] += ok;
        nRec++;
      });
      if (batch.length < 1000) break;
    }
    // 등장한 유형의 이름 사전만 동봉 (앱이 별도 로드 없이 바로 표시)
    const usedCids = new Set();
    Object.values(data).forEach((stu) => Object.values(stu).forEach((per) => Object.keys(per).forEach((c) => usedCids.add(c))));
    let names = {};
    try {
      const rn = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_concept_names&select=value`, { headers: sbHeaders });
      const jn = await rn.json();
      const all = (Array.isArray(jn) && jn[0] && jn[0].value) || {};
      usedCids.forEach((c) => { if (all[c]) names[c] = all[c]; });
    } catch (e) {}
    const w = await fetch(`${url}/rest/v1/lumen_store`, {
      method: 'POST', headers: Object.assign({}, sbHeaders, { prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: 'mf_type_ach', value: { epoch: TA_EPOCH, periods, names, data, updated: new Date().toISOString() } }),
    });
    if (!w.ok) { log(`mf_type_ach 저장 실패 ${w.status}`); return; }
    log(`유형성취도 집계 저장(mf_type_ach): ${periods[0]}~ · 문항 ${nRec} · 학생 ${Object.keys(data).length}명 · 유형 ${usedCids.size}개`);
    // 학생앱용 개인별 키(typeach_stu_<code>) — 다른 학생 데이터·코드가 노출되지 않게 분리 저장
    const stuRows = [];
    Object.keys(data).forEach((codeK) => {
      if (codeK.startsWith('sid:')) return; // 코드 매핑 안 된 학생은 학생앱 표시 불가
      const mine = data[codeK];
      const myNames = {};
      Object.values(mine).forEach((per) => Object.keys(per).forEach((c) => { if (names[c]) myNames[c] = names[c]; }));
      stuRows.push({ key: 'typeach_stu_' + codeK, value: { periods, names: myNames, mine, updated: new Date().toISOString() } });
    });
    if (stuRows.length) {
      const w2 = await fetch(`${url}/rest/v1/lumen_store`, {
        method: 'POST', headers: Object.assign({}, sbHeaders, { prefer: 'resolution=merge-duplicates' }),
        body: JSON.stringify(stuRows),
      });
      if (!w2.ok) log(`typeach_stu_* 저장 실패 ${w2.status}`);
      else log(`학생앱용 개인 유형데이터 저장: ${stuRows.length}명`);
    }
  } catch (e) { log('유형성취도 집계 실패(치명적 아님):', e.message); }
}

// ── 매쓰플랫 월간보고서 점수·티어 → lumen_store 'mf_month_scores' ──────
// 학생별 생성된 월간보고서(SUCCESS)의 종합점수·티어·영역/행동점수를 수집.
// PDF 없이 목록 API 값만 사용. 레벨관리 훈장·뱃지·추이 그래프의 데이터원.
// 값 형태: { months: { '2025-12': { '<code|sid:...>': {s,t,a,b} } }, updated }
async function refreshMonthScores(students) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const sidCode = await buildSidCodeMap();
    const months = {};
    let nRep = 0;
    for (const st of students) {
      let list = [];
      try { const d = await api(`/report/${st.id}?type=MONTHLY&size=50`); list = (d && d.content) || []; }
      catch (e) { continue; }
      const k = sidCode[st.id] || ('sid:' + st.id);
      list.forEach((r) => {
        if (r.status !== 'SUCCESS' || r.deleted || !r.yearMonth) return;
        const ym = String(r.yearMonth).slice(0, 7);
        if (!months[ym]) months[ym] = {};
        months[ym][k] = { s: r.totalScore ?? null, t: r.totalTier ?? null, a: r.areaScore ?? null, b: r.behaviorScore ?? null };
        nRep++;
      });
      await sleep(120);
    }
    // 기존 저장분과 병합(월 단위 덮어쓰기 — 같은 달은 최신 조회가 정답)
    const prevRes = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_month_scores&select=value`, { headers: sbHeaders });
    let prev = {};
    try { const j = await prevRes.json(); prev = (Array.isArray(j) && j[0] && j[0].value && j[0].value.months) || {}; } catch (e) {}
    const merged = Object.assign({}, prev, months);
    const w = await fetch(`${url}/rest/v1/lumen_store`, {
      method: 'POST', headers: Object.assign({}, sbHeaders, { prefer: 'resolution=merge-duplicates' }),
      body: JSON.stringify({ key: 'mf_month_scores', value: { months: merged, updated: new Date().toISOString() } }),
    });
    if (!w.ok) { log(`mf_month_scores 저장 실패 ${w.status}`); return; }
    log(`월간보고서 점수 수집 저장(mf_month_scores): 보고서 ${nRep}건 · 월 ${Object.keys(months).length}개`);
  } catch (e) { log('월간보고서 점수 수집 실패(치명적 아님):', e.message); }
}

// ── 교재 카탈로그 갱신 ───────────────────────────────────────
// 학생별 매쓰플랫 교재 목록 + 교재 메타(이름·출판사·학년학기)를
// lumen_store 'mf_books'에 저장. (학생앱 아하노트 교재 선택,
// 학원앱 '매쓰플랫 교재 가져오기'가 이 카탈로그를 사용)
/* 학원이 주문한 시그니처 교재의 PDF 목록을 앱에 넘긴다 (v18-61).
 *
 * 매쓰플랫 교재 목록 응답에 PDF 주소(pdfUrl·solutionPdfUrl)가 그대로 들어 있고,
 * 그 주소는 로그인 없이 열리는 고정 주소다. 그래서 파일을 우리가 보관하지 않고
 * 「목록만」 Supabase에 저장해두면, 학원앱이 그 목록을 읽어 다운로드 링크를 걸 수 있다.
 * (학원앱은 공개된 파일이라 매쓰플랫 비밀번호를 넣을 수 없으므로 이렇게 우회한다)
 *
 * 저장 키: lumen_store 'mf_workbook_pdfs'
 *   { at, books:[{id,title,grade,page,orderDatetime,pdfUrl,solutionPdfUrl,thumb}] }
 */
// ── v1-19: KMM 수학경시대회 성적 (매쓰플랫이 주관 — /exam API) ─────────────
// 학부모앱·진학 나침반이 쓸 「우리 학생 경시 기록」을 lumen_store 'mf_kmm'에 저장.
// 회차별로 학년 시험이 나뉘고, 각 시험 안에 응시 학생의 점수·수상등급(tier)이 들어 있다.
// tier: GOLD_AWARD/SILVER_AWARD/BRONZE_AWARD/ENCOURAGEMENT_AWARD/NOT_AWARDED
async function refreshKmm() {
  try {
    const sch = await api('/exam/schedule?type=KMM');
    const rounds = (Array.isArray(sch) ? sch : []).filter((x) => x && x.year && x.month);
    if (!rounds.length) { log('KMM 경시: 일정 없음'); return; }
    // 최근 회차부터 (오래된 회차는 이미 저장돼 있으면 건너뛴다)
    let prev = {};
    try {
      const r0 = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.mf_kmm&select=value`, { headers: sbH() });
      if (r0.ok) { const j = await r0.json(); prev = (j[0] && j[0].value) || {}; }
    } catch (e) {}
    const byStudent = (prev.byStudent && typeof prev.byStudent === 'object') ? prev.byStudent : {};
    const seen = prev.rounds || {};
    const CAP = Number(process.env.KMM_ROUND_CAP || 30);
    let done = 0, nRec = 0;
    const sorted = rounds.slice().sort((a, b) => (b.year - a.year) || (b.month - a.month));
    for (const r of sorted) {
      if (done >= CAP) break;
      const ym = `${r.year}-${String(r.month).padStart(2, '0')}`;
      // 이미 받아둔 회차이고 「채점 끝(RESOLVED)」이면 다시 받지 않는다
      if (seen[ym] === 'RESOLVED' && r.progress === 'RESOLVED') continue;
      let exams = null;
      try { exams = await api(`/exam/by-year-month?yearMonth=${ym}&type=KMM`); } catch (e) { continue; }
      if (!Array.isArray(exams)) continue;
      exams.forEach((ex) => {
        const grade = ({ ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' }[ex.schoolType] || '') + (ex.grade || '');
        (ex.studentExams || []).forEach((se) => {
          if (!se || !se.studentId) return;
          const rec = {
            ym, round: r.round || null, title: r.title || '', grade,
            examId: ex.id, score: se.score != null ? se.score : null,
            correct: se.correctCount != null ? se.correctCount : null,
            wrong: se.wrongCount != null ? se.wrongCount : null,
            tier: se.tier || 'NOT_AWARDED', status: se.status || '',
          };
          const arr = byStudent[se.studentId] = byStudent[se.studentId] || [];
          const at = arr.findIndex((x) => x.ym === ym && x.examId === ex.id);
          if (at >= 0) arr[at] = rec; else arr.push(rec);
          nRec++;
        });
      });
      seen[ym] = r.progress || '';
      done++;
      await sleep(200);
    }
    // 학생별로 최근 회차가 앞에 오도록 정렬
    Object.keys(byStudent).forEach((k) => { byStudent[k].sort((a, b) => String(b.ym).localeCompare(String(a.ym))); });
    await storeSet('mf_kmm', { at: new Date().toISOString(), rounds: seen, byStudent });
    const nStu = Object.keys(byStudent).length;
    const nAward = Object.values(byStudent).reduce((a, arr) => a + arr.filter((x) => x.tier && x.tier !== 'NOT_AWARDED').length, 0);
    log(`KMM 경시: 회차 ${done}개 조회 · 기록 ${nRec}건 · 학생 ${nStu}명 · 수상 ${nAward}건`);
  } catch (e) {
    log('KMM 경시 수집 실패(치명적 아님):', e.message);
  }
}

/* ── v18-83: 시그니처 교재 전체로 확대 ──────────────────────────────
 * 매쓰플랫 교재 화면의 탭이 API의 type 값과 이렇게 대응한다:
 *
 *   시그니처 교재 ┬ CUSTOM_SIGNATURE (275권) 우리 학원 표지가 붙은 것 + 카탈로그 사본
 *                └ SIGNATURE        (249권) 매쓰플랫이 만든 교재 전체
 *                                           (연산·개념·유형·심화유형·개념유형라이트·내신대비·N제)
 *   내 교재        CUSTOM           ( 25권) 선생님이 직접 만든 학습지 (PDF 있는 것 15권)
 *   시중교재       PUBLIC          (1000권) 출판사 교재 — PDF 주소를 주지 않는다(상대경로뿐)
 *
 * 그래서 내려받을 수 있는 것은 앞의 세 가지다. 시중교재는 출판사 저작물이라
 * 매쓰플랫 자체가 PDF를 안 주므로 자동으로 빠진다(우리가 막는 게 아니다).
 *
 * CUSTOM_SIGNATURE 275권 중 248권은 SIGNATURE와 같은 교재(id가 같다)라
 * 「주문일이 있는 것」만 우리 교재로 보고, 나머지는 시그니처 쪽에서 한 번만 담는다.
 */
async function refreshWorkbookPdfs() {
  try {
    const SCHOOL = { ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' };
    const KIND = {
      ARITHMETIC: '연산서', CONCEPT: '개념서', BASIC: '유형서', HIGH: '심화유형서',
      CONCEPT_UNIT_LIGHT: '개념유형라이트', SCHOOL_TEST: '내신대비', N_PROBLEM: 'N제',
    };
    const SUB = { COMPLEX: '종합편', BASIC: '기본편', HIGH: '심화편' };
    const THUMB_BASE = 'https://mathflat-user-uploads.mathflat.com/created-workbook/';
    // 썸네일은 시그니처 쪽만 상대경로로 온다 (예: sample/1319991/thumbnail.png)
    const absThumb = (u) => (!u ? '' : (/^https?:/.test(u) ? u : THUMB_BASE + u));
    // 「표지 체험 교재」처럼 주소가 잘려 파일명이 없는 것이 있다 → 받아도 403이라 걸러낸다
    const pdfOk = (u) => /^https?:\/\/\S+\.pdf(\?|$)/.test(String(u || ''));

    // 고등 22개정은 학년 대신 과목명이 들어온다 (grade='공통수학1', semester=null)
    const gradeLabel = (w) => {
      const s = SCHOOL[w.schoolType] || '';
      const g = w.grade == null ? '' : String(w.grade);
      if (!s) return '';
      if (w.schoolType === 'HIGH' && g && !/^\d+$/.test(g)) return '고 ' + g;
      return s + g + (w.semester != null ? '-' + w.semester : '');
    };
    const gradeKey = (w) => {                       // 화면 위쪽 칩에 쓰는 묶음 이름
      const s = SCHOOL[w.schoolType] || '';
      const g = w.grade == null ? '' : String(w.grade);
      if (w.schoolType === 'HIGH') return /^\d+$/.test(g) ? '고' + g : (g || '고');
      return s + g;
    };
    const kindLabel = (w) => {
      const k = KIND[w.signatureType] || '';
      const sb = SUB[w.signatureSubtype] || '';
      return k && sb ? k + '(' + sb + ')' : k;
    };
    const rec = (w, src) => ({
      id: w.id,
      title: w.fulltitle || w.title || '',
      grade: gradeLabel(w),
      gkey: gradeKey(w),
      school: SCHOOL[w.schoolType] || '',
      kind: kindLabel(w),
      rev: w.revision === 'CURRICULUM_22' ? '22개정' : (w.revision === 'CURRICULUM_15' ? '15개정' : ''),
      page: w.page || null,
      src,                                          // mine=우리 주문 · sig=매쓰플랫 시그니처 · own=직접 만든
      orderDatetime: w.orderDatetime || '',
      orderStatus: w.orderStatus || '',
      pdfUrl: pdfOk(w.pdfUrl) ? w.pdfUrl : '',
      solutionPdfUrl: pdfOk(w.solutionPdfUrl) ? w.solutionPdfUrl : '',
      thumb: absThumb(w.thumbnailImageUrl),
    });
    const asList = (r) => (Array.isArray(r) ? r : ((r && r.content) || []));
    const pull = async (type) => {
      try { return asList(await api(`/workbook?type=${type}&size=1000`)); }
      catch (e) { log(`교재 목록 ${type} 실패:`, e.message); return []; }
    };

    const [cs, sg, cu] = [await pull('CUSTOM_SIGNATURE'), await pull('SIGNATURE'), await pull('CUSTOM')];

    const books = [];
    const seen = new Set();
    const add = (w, src) => {
      const r = rec(w, src);
      if (!r.pdfUrl && !r.solutionPdfUrl) return;    // 받을 게 없으면 넣지 않는다
      if (seen.has(String(r.id))) return;
      seen.add(String(r.id));
      books.push(r);
    };
    cs.filter((w) => w.orderDatetime).forEach((w) => add(w, 'mine'));   // ① 우리가 주문한 교재
    sg.forEach((w) => add(w, 'sig'));                                   // ② 매쓰플랫 시그니처 전체
    cu.forEach((w) => add(w, 'own'));                                   // ③ 선생님이 직접 만든 학습지

    // 우리 주문 교재가 맨 앞(최근 주문순), 그다음 시그니처, 그다음 직접 만든 것
    const rank = { mine: 0, sig: 1, own: 2 };
    books.sort((a, b) => (rank[a.src] - rank[b.src])
      || String(b.orderDatetime).localeCompare(String(a.orderDatetime))
      || String(a.grade).localeCompare(String(b.grade))
      || String(a.title).localeCompare(String(b.title)));

    const n = (s) => books.filter((b) => b.src === s).length;
    await storeSet('mf_workbook_pdfs', { at: new Date().toISOString(), books });
    log(`교재 PDF 목록: ${books.length}권 저장 `
      + `(주문 ${n('mine')} · 시그니처 ${n('sig')} · 직접 만든 ${n('own')} / 해설 ${books.filter((b) => b.solutionPdfUrl).length}권)`);
  } catch (e) {
    log('교재 PDF 목록 실패:', e.message);
  }
}

// ── v18-74: 학생별 교재 상태 (mf_swb_<학생코드>) ──────────────────────────
// 학생앱 「교재 채점」의 뼈대 데이터. 학생앱은 매쓰플랫에 직접 못 붙으므로
// 교재·회차(revisionId)·페이지(progressId 포함) 목록을 여기서 미리 만들어 둔다.
// progressId는 되돌려쓰기(PATCH /student-workbook/scoring)의 필수 키.
async function refreshStudentWorkbooks() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const rs = await fetch(`${url}/rest/v1/mf_students?select=mf_student_id,lumen_rec_code,name`, { headers: sbHeaders });
    if (!rs.ok) { log('학생 교재상태: mf_students 조회 실패'); return; }
    const students = (await rs.json()).filter((s) => s.lumen_rec_code && s.mf_student_id);
    const allPages = {};                                   // bid → Set(wpid) — 정답사전 대상
    let nStu = 0, nBook = 0;
    for (const st of students) {
      const books = [];
      for (const wt of ['PUBLIC', 'SCHOOL', 'CUSTOM']) {
        let list = null;
        try { list = await api(`/student-workbook/student/${st.mf_student_id}?workbookType=${wt}`); } catch (e) { continue; }
        if (!Array.isArray(list)) list = (list && list.content) || [];
        for (const b of list) {
          const swId = b.studentWorkbook && b.studentWorkbook.id;
          const revId = b.recentRevisionId;
          if (!swId || !revId) continue;
          let det = null;
          try { det = await api(`/student-workbook/student/${st.mf_student_id}/${swId}/${revId}?size=500`); } catch (e) { continue; }
          const content = (det && det.page && det.page.content) || [];
          const pages = content.map((pg) => ({
            pid: pg.progressId,
            wpid: pg.workbookPage && pg.workbookPage.id,
            page: pg.workbookPage && pg.workbookPage.page,
            title: (pg.workbookPage && pg.workbookPage.title) || '',
            st: pg.status || '',
          })).filter((p) => p.pid && p.wpid);
          pages.forEach((p) => { (allPages[b.id] = allPages[b.id] || new Set()).add(String(p.wpid)); });
          books.push({
            bid: b.id, type: wt, title: (b.fulltitle || ((b.title || '') + ' ' + (b.subtitle || ''))).replace(/\s+/g, ' ').trim(),
            swId, revId, round: b.recentRevisionRound || 1,
            rounds: Object.keys(b.roundToRevisionRoundMap || {}).length || 1,
            recentPage: b.recentPageNumber || null,
            grade: (({ ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' })[b.schoolType] || '') + (b.grade || ''),
            pages,
          });
          nBook++;
          await sleep(80);
        }
        await sleep(60);
      }
      const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
        method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: `mf_swb_${st.lumen_rec_code}`, value: { code: st.lumen_rec_code, name: st.name || '', books, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
      });
      if (res.ok) nStu++;
    }
    // 정답사전 대상 페이지 합집합 저장 (refreshBookAnswers가 읽음 — 등록 교재 전체 페이지)
    const union = {}; Object.keys(allPages).forEach((bid) => { union[bid] = Array.from(allPages[bid]); });
    await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_bookpages', value: { map: union, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`학생 교재상태(mf_swb_*): 학생 ${nStu} · 교재 ${nBook} · 정답사전 대상 ${Object.keys(union).length}권`);
  } catch (e) { log('학생 교재상태 갱신 실패(치명적 아님):', e.message); }
}

// ── v18-74: 교재 정답사전 (mf_bookans_<bookId>) ─────────────────────────
// 학생앱 교재 채점용. 우리 학생이 실제 도달한 (교재·페이지)의 문항·정답을 매쓰플랫에서
// 받아 채점엔진으로 정규화·gradable 판정해 저장. 회차와 무관(같은 교재는 문항·정답 동일).
// 약관: 등록·도달 페이지에 한정. 문제 이미지는 저장하지 않음(번호·정답·유형만).
const HWGrade = require('./hw_grade_engine.js');
async function refreshBookAnswers() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    // 우리 학생이 채점 기록을 남긴 (교재, 페이지) 쌍 = 도달한 페이지
    const pairs = new Set(); const bookName = {};
    for (let off = 0; off < 200000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_answer_records?select=book_id,workbook_page_id&source=eq.${encodeURIComponent('교재')}&book_id=not.is.null&workbook_page_id=not.is.null&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      batch.forEach((r) => pairs.add(r.book_id + '|' + r.workbook_page_id));
      if (batch.length < 1000) break;
    }
    // 등록 교재의 「전체 페이지」 (refreshStudentWorkbooks가 만든 mf_bookpages) — 학생앱 채점 대상
    try {
      const rp = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_bookpages&select=value`, { headers: sbHeaders });
      if (rp.ok) { const j = await rp.json(); const map = ((j[0] || {}).value || {}).map || {};
        Object.keys(map).forEach((bid) => (map[bid] || []).forEach((wpid) => pairs.add(bid + '|' + wpid))); }
    } catch (e) {}
    if (!pairs.size) { log('교재 정답사전: 도달 페이지 없음 → 건너뜀'); return; }
    // 교재명 사전 (mf_books)
    try {
      const rb = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_books&select=value`, { headers: sbHeaders });
      if (rb.ok) { const j = await rb.json(); const bk = ((j[0] || {}).value || {}).books || {}; Object.keys(bk).forEach((id) => { bookName[id] = bk[id].n || ''; }); }
    } catch (e) {}
    // 교재별로 묶기
    const byBook = {};
    pairs.forEach((k) => { const [b, p] = k.split('|'); (byBook[b] = byBook[b] || new Set()).add(p); });

    // 한 번에 받는 새 페이지 상한 — 매쓰플랫 부하·약관 고려해 점진적으로 채운다(매일 새벽 반복)
    const PAGE_CAP = Number(process.env.BOOKANS_PAGE_CAP || 500);   // 밤마다 500페이지씩 점진 수집(전체 채워질 때까지)
    let capLeft = PAGE_CAP;
    let totBooks = 0, totPages = 0, totProb = 0, totGrad = 0;
    for (const bid of Object.keys(byBook)) {
      if (capLeft <= 0) break;
      const pageIds = Array.from(byBook[bid]);
      // 이미 저장된 사전 불러와 병합(같은 페이지는 스킵 — 정답 안 바뀜)
      let store = { book: '', pages: {} };
      try {
        const rr = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_bookans_${bid}&select=value`, { headers: sbHeaders });
        if (rr.ok) { const j = await rr.json(); if (j[0] && j[0].value) store = j[0].value; }
      } catch (e) {}
      store.pages = store.pages || {};
      let changed = false;
      for (const pid of pageIds) {
        if (capLeft <= 0) break;
        if (store.pages[pid]) continue;                       // 이미 있음
        capLeft--;
        let page = null;
        try { page = await api(`/workbook/${bid}/page/${pid}`); } catch (e) { continue; }
        const items = (page && (page.content || page)) || [];
        if (!Array.isArray(items) || !items.length) continue;
        const probs = items.map((p) => {
          // ★ 객관식 판정은 「유형」으로만. optionCount는 모든 문항에 기본 5가 붙어 신뢰할 수 없다.
          const objective = (p.type === 'MULTIPLE_CHOICE' || p.type === 'SINGLE_CHOICE');
          const gradable = objective ? true : (p.type === 'SHORT_ANSWER' && HWGrade.isGradable(p.answer));
          const rec = {
            wpId: p.id, num: p.number || '', type: p.type || '',
            answer: p.answer != null ? String(p.answer) : '',
            objective: !!objective, optionCount: (objective ? (p.optionCount || 5) : 0),
            gradable: !!gradable, unit: objective ? '' : HWGrade.unitOf(p.answer),
          };
          return rec;
        });
        store.pages[pid] = { title: (items[0] && items[0].title) || '', page: (items[0] && items[0].page) || '', problems: probs };
        store.book = bookName[bid] || store.book || '';
        changed = true; totPages++; totProb += probs.length; totGrad += probs.filter((x) => x.gradable).length;
        await sleep(90);
      }
      if (changed) {
        store.updated = new Date().toISOString();
        const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
          method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ key: `mf_bookans_${bid}`, value: store, updated_at: new Date().toISOString() }]),
        });
        if (res.ok) totBooks++;
      }
    }
    const pct = totProb ? Math.round(totGrad / totProb * 100) : 0;
    log(`교재 정답사전: 교재 ${totBooks} · 새 페이지 ${totPages} · 문항 ${totProb}(자동채점 ${totGrad}=${pct}%)`);
  } catch (e) { log('교재 정답사전 갱신 실패(치명적 아님):', e.message); }
}

// v2-41: 저장된 정답사전 전체의 gradable·unit을 현재 엔진 기준으로 재계산 (로그인 불필요)
async function regradeBookAnswers() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const rr = await fetch(`${url}/rest/v1/lumen_store?key=like.mf_bookans_*&select=key,value&limit=1000`, { headers: sbHeaders });
  if (!rr.ok) { log('정답사전 재계산: 목록 조회 실패'); return; }
  const rows = (await rr.json()).filter((x) => /^mf_bookans_/.test(x.key));
  let nBook = 0, nProb = 0, nFlip = 0;
  for (const row of rows) {
    const store = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) || {};
    let changed = false;
    Object.keys(store.pages || {}).forEach((pid) => {
      (store.pages[pid].problems || []).forEach((p) => {
        nProb++;
        const g = p.objective ? true : (p.type === 'SHORT_ANSWER' && HWGrade.isGradable(p.answer));
        const u = p.objective ? '' : HWGrade.unitOf(p.answer);
        if (!!g !== !!p.gradable || u !== (p.unit || '')) { if (!!g !== !!p.gradable) nFlip++; p.gradable = !!g; p.unit = u; changed = true; }
      });
    });
    if (changed) {
      store.updated = new Date().toISOString();
      const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
        method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: row.key, value: store, updated_at: new Date().toISOString() }]),
      });
      if (res.ok) nBook++;
      await sleep(60);
    }
  }
  log(`정답사전 재계산: 갱신 교재 ${nBook}/${rows.length} · 검사 문항 ${nProb} · 판정 바뀜 ${nFlip}`);
}

async function refreshBookCatalog() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const gradeKeyOf = (w) => {
    const sc = { ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' }[w.schoolType] || '';
    if (!sc || !w.grade) return '';
    return sc + w.grade + (w.semester ? '-' + w.semester : '');
  };
  try {
    // 누적된 세션 테이블에서 학생별 교재 목록 수집
    const rows = [];
    for (let off = 0; off < 50000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_study_sessions?select=mf_student_id,book_id,title,subtitle&source=eq.${encodeURIComponent('교재')}&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    const byStudent = {}; const bookIds = new Set();
    rows.forEach((r) => {
      if (!r.book_id) return;
      bookIds.add(r.book_id);
      const a = (byStudent[r.mf_student_id] = byStudent[r.mf_student_id] || []);
      if (a.indexOf(r.book_id) < 0) a.push(r.book_id);
    });
    if (!bookIds.size) { log('교재 카탈로그: 대상 없음 → 건너뜀'); return; }
    const books = {};
    for (const bid of bookIds) {
      let w = null;
      try { w = await api(`/workbook/${bid}`); } catch (e) {}
      const row = rows.find((r) => r.book_id === bid) || {};
      books[bid] = w
        ? { n: (w.fulltitle || ((w.title || '') + ' ' + (w.subtitle || ''))).replace(/\s+/g, ' ').trim(), p: w.publisher || '', g: gradeKeyOf(w), pages: w.maxPage || 0 }
        : { n: ((row.title || '') + ' ' + (row.subtitle || '')).trim(), p: '', g: '', pages: 0 };
      // 교재 목차(대단원 순서) — 로드맵 '앞으로 배울 단원' 표시용
      try {
        const chips = await api(`/concept/chips?curriculumKey=1&workbookIds=${bid}`);
        const bigs = [], seen = new Set();
        (chips || []).slice()
          .sort((a, b) => String(a.orderingNumber || '').localeCompare(String(b.orderingNumber || '')))
          .forEach((c) => { const bg = c.bigChapterName; if (bg && !seen.has(bg)) { seen.add(bg); bigs.push(bg); } });
        if (bigs.length) books[bid].units = bigs;
      } catch (e) {}
      await sleep(80);
    }
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_books', value: { books, byStudent, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`교재 카탈로그(mf_books): 교재 ${Object.keys(books).length} · 학생 ${Object.keys(byStudent).length} ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('교재 카탈로그 갱신 실패(치명적 아님):', e.message); }
}

// ── 전체 교육과정 유형DB 갱신 ────────────────────────────────
// 매쓰플랫 개념칩 전체(초/중/고 3키) + 우리 교재 per-workbook 칩을 union하고,
// 각 유형의 orderingNumber로 학년(초1-1 … 고 과목)을 해독해 트리로 만들어
// lumen_store 'mf_typedb'에 저장. (학원앱 유형DB 화면이 이 트리를 렌더)
const _HS_SUBJ = { 1: '공통수학1', 2: '공통수학2', 3: '대수', 4: '미적분Ⅰ', 5: '확률과통계', 6: '미적분Ⅱ', 7: '기하' };
const _GROUP_ORD = { 초등: 0, 중등: 1, 고등: 2, 기타: 3 };
function _decodeGrade(ord) {
  ord = String(ord || ''); const s = ord[1], g = ord[2], sem = ord[3];
  if (s === '1') return { group: '초등', label: `초${g}-${sem}` };
  if (s === '2') return { group: '중등', label: `중${g}-${sem}` };
  if (s === '3') return { group: '고등', label: _HS_SUBJ[g] || ('고' + g) };
  return { group: '기타', label: '기타' };
}
async function refreshTypeDb() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const cleanNm = (n) => String(n || '').split(';')[0].trim();
  try {
    const byConcept = {};
    const addChips = (arr) => (arr || []).forEach((c) => {
      if (!c.conceptId) return;
      const ord = String(c.orderingNumber || ''); const cur = byConcept[c.conceptId];
      if (!cur || (ord && ord < cur.ord)) byConcept[c.conceptId] = { name: cleanNm(c.conceptName), big: c.bigChapterName || '', mid: c.middleChapterName || '', little: c.littleChapterName || '', ord: ord || (cur && cur.ord) || '' };
    });
    // 1) 전체 교육과정 (초/중/고)
    for (const k of ['1.4.4145', '1.4.4146', '1.4.4147']) { try { addChips(await api(`/concept/chips?curriculumKey=${k}`)); } catch (e) {} }
    // 2) 우리 교재로 누락 단원 보강
    const sessRes = await fetch(`${url}/rest/v1/mf_study_sessions?select=book_id&source=${encodeURIComponent('교재')}&limit=5000`, { headers: sbHeaders });
    const bookIds = sessRes.ok ? [...new Set((await sessRes.json()).map((r) => r.book_id).filter(Boolean))] : [];
    for (const bid of bookIds) { try { addChips(await api(`/concept/chips?curriculumKey=1&workbookIds=${bid}`)); } catch (e) {} await sleep(60); }
    // 3) 트리 구성: 학년 → 대단원 → 중단원 → 소단원 → [유형]
    const grades = {};
    Object.values(byConcept).forEach((c) => {
      const d = _decodeGrade(c.ord); const gl = d.label;
      const big = c.big || '(대단원)', mid = c.mid || '(중단원)', lit = c.little || mid, typ = c.name || '(유형)';
      const G = (grades[gl] = grades[gl] || { group: d.group, ord: c.ord || '999', tree: {} });
      if (c.ord && c.ord < G.ord) G.ord = c.ord;
      G.tree[big] = G.tree[big] || {};
      G.tree[big][mid] = G.tree[big][mid] || {};
      (G.tree[big][mid][lit] = G.tree[big][mid][lit] || new Set()).add(typ);
    });
    const order = Object.keys(grades).sort((a, b) => (_GROUP_ORD[grades[a].group] - _GROUP_ORD[grades[b].group]) || grades[a].ord.localeCompare(grades[b].ord));
    const out = order.map((gl) => {
      const G = grades[gl];
      const bigs = Object.keys(G.tree).sort().map((big) => {
        const mids = Object.keys(G.tree[big]).map((mid) => ({ n: mid, s: Object.keys(G.tree[big][mid]).map((lit) => ({ n: lit, t: [...G.tree[big][mid][lit]] })) }));
        let tc = 0; mids.forEach((m) => m.s.forEach((l) => tc += l.t.length));
        return { n: big, c: tc, m: mids };
      });
      return { g: gl, grp: G.group, b: bigs };
    });
    if (!out.length) { log('유형DB: 대상 없음 → 건너뜀'); return; }
    const total = out.reduce((a, g) => a + g.b.reduce((x, b) => x + b.c, 0), 0);
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_typedb', value: { updated: new Date().toISOString(), total, grades: out }, updated_at: new Date().toISOString() }]),
    });
    log(`유형DB(mf_typedb): 학년 ${out.length} · 유형 ${total} ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('유형DB 갱신 실패(치명적 아님):', e.message); }
}

// ── 로드맵 진도 집계 갱신 ─────────────────────────────────────
// 교재 세션(mf_study_sessions, source=교재)을 학생×교재로 집계해
// lumen_store 'mf_progress'에 저장. (학생앱/학원앱 로드맵이 이 데이터로
// 도달 페이지·현재 단원·주간 진도·단원별·월별 정답률을 렌더)
//   value = { updated, byStudent: { <sid>: { <book_id>: {
//     maxPage, curChapter, lastDate, weekPages,
//     chapters:[{n,minP,maxP,lastDate,correct,total}],
//     months:{ "YYYY-MM": {c,t,maxP} } } } } }
// 현행/선행 구분은 '오늘' 기준이라 앱에서 계산(학년+교재 학기 g).
function _parsePage(p) { const m = String(p == null ? '' : p).match(/\d+/g); return m ? Math.max.apply(null, m.map(Number)) : 0; }
async function refreshRoadmap() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const cut = (d) => String(d || '').slice(0, 10);
  try {
    const rows = [];
    for (let off = 0; off < 300000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_study_sessions?select=mf_student_id,book_id,chapter,page,correct_count,wrong_count,update_datetime,student_workbook_id,student_book_id&source=eq.${encodeURIComponent('교재')}&order=update_datetime.asc&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (!rows.length) { log('로드맵: 교재 세션 없음 → 건너뜀'); return; }
    const now = Date.now(), WEEK = 7 * 86400000;
    // v17-5: 회차(재수강) 분리 — 같은 교재라도 매쓰플랫 배정(student_workbook_id)마다 별도 회차로 집계.
    //        최상위 필드는 「현재(최근 채점) 회차」 기준 → 앱들은 수정 없이 현재 회차를 보게 됨.
    const byStudent = {}; // sid → bid → rkey → round
    rows.forEach((r) => {
      if (!r.book_id || r.mf_student_id == null) return;
      const pg = _parsePage(r.page);
      const dt = r.update_datetime || '';
      const cc = r.correct_count || 0, wc = r.wrong_count || 0;
      const rk = String(r.student_book_id || r.student_workbook_id || '0');
      const S = byStudent[r.mf_student_id] = byStudent[r.mf_student_id] || {};
      const Bk = S[r.book_id] = S[r.book_id] || {};
      const R = Bk[rk] = Bk[rk] || { k: rk, maxPage: 0, curChapter: '', lastDate: '', firstDate: '', weekBase: null, _chap: {}, months: {}, n: 0, c: 0, t: 0 };
      R.n++;
      if (pg > R.maxPage) R.maxPage = pg;
      if (dt && (!R.firstDate || dt < R.firstDate)) R.firstDate = dt;
      if (dt >= R.lastDate) { R.lastDate = dt; if (r.chapter) R.curChapter = r.chapter; }
      if (r.chapter) {
        const c = R._chap[r.chapter] = R._chap[r.chapter] || { n: r.chapter, minP: 1e9, maxP: 0, lastDate: '', correct: 0, total: 0 };
        if (pg && pg < c.minP) c.minP = pg;
        if (pg > c.maxP) c.maxP = pg;
        if (dt > c.lastDate) c.lastDate = dt;
        c.correct += cc; c.total += cc + wc;
      }
      R.c += cc; R.t += cc + wc;
      const ts = dt ? Date.parse(dt.replace(' ', 'T')) : NaN;
      if (!isNaN(ts) && (now - ts) > WEEK) { if (R.weekBase === null || pg > R.weekBase) R.weekBase = pg; }
      const ym = dt.slice(0, 7);
      if (ym) {
        const m = R.months[ym] = R.months[ym] || { c: 0, t: 0, maxP: 0 };
        m.c += cc; m.t += cc + wc; if (pg > m.maxP) m.maxP = pg;
      }
    });
    const out = {};
    Object.keys(byStudent).forEach((sid) => {
      out[sid] = {};
      Object.keys(byStudent[sid]).forEach((bid) => {
        const rounds = Object.values(byStudent[sid][bid]).sort((a, b) => String(a.firstDate).localeCompare(String(b.firstDate)) || String(a.k).localeCompare(String(b.k)));
        const cur = rounds.reduce((a, b) => (String(b.lastDate) >= String(a.lastDate) ? b : a));
        const chapters = Object.values(cur._chap)
          .map((c) => ({ n: c.n, minP: (c.minP === 1e9 ? 0 : c.minP), maxP: c.maxP, lastDate: cut(c.lastDate), correct: c.correct, total: c.total }))
          .sort((a, b) => (a.minP - b.minP) || a.lastDate.localeCompare(b.lastDate));
        const weekPages = cur.weekBase === null ? cur.maxPage : Math.max(0, cur.maxPage - cur.weekBase);
        out[sid][bid] = {
          maxPage: cur.maxPage, curChapter: cur.curChapter, lastDate: cut(cur.lastDate), firstDate: cut(cur.firstDate),
          weekPages, chapters, months: cur.months,
          curKey: cur.k, roundNo: rounds.indexOf(cur) + 1, roundN: rounds.length,
          rounds: rounds.map((r, i) => ({ no: i + 1, k: r.k, first: cut(r.firstDate), last: cut(r.lastDate), maxP: r.maxPage, n: r.n, rate: (r.t > 0 ? Math.round(r.c / r.t * 100) : null), cur: (r === cur) })),
        };
      });
    });

    // ── 단원명 보강: 문항단위 기록(mf_answer_records, 교재)에서 「현재 회차」 것만 골라
    //    concept→대단원명으로 묶어 깨끗한 단원별 정오답으로 교체. 회차별 정답률(rate)도 문항 기준으로 보강. ──
    try {
      const conceptBig = {};
      for (const k of ['1.4.4145', '1.4.4146', '1.4.4147']) {
        try { (await api(`/concept/chips?curriculumKey=${k}`) || []).forEach((c) => { if (c.conceptId && c.bigChapterName) conceptBig[c.conceptId] = c.bigChapterName; }); } catch (e) {}
      }
      const arows = [];
      for (let off = 0; off < 500000; off += 1000) {
        const res2 = await fetch(`${url}/rest/v1/mf_answer_records?select=mf_student_id,book_id,chapter,concept_id,page,result,score_datetime,student_workbook_id,student_book_id&source=eq.${encodeURIComponent('교재')}&order=score_datetime.asc&limit=1000&offset=${off}`, { headers: sbHeaders });
        if (!res2.ok) break;
        const b2 = await res2.json();
        arows.push(...b2);
        if (b2.length < 1000) break;
      }
      if (arows.length) {
        const ca = {}; // sid → bid → { cur, curDate, _chap } (현재 회차만)
        const roundAcc = {}; // sid → bid → rkey → {c,t} (회차별 문항 정답률 보강)
        arows.forEach((r) => {
          if (!r.book_id || r.mf_student_id == null) return;
          const rk = String(r.student_book_id || r.student_workbook_id || '0');
          const ra = ((roundAcc[r.mf_student_id] = roundAcc[r.mf_student_id] || {})[r.book_id] = (roundAcc[r.mf_student_id][r.book_id] || {}));
          const acc = ra[rk] = ra[rk] || { c: 0, t: 0 };
          if (r.result === 'O') { acc.c++; acc.t++; } else if (r.result === 'X') { acc.t++; }
          const o = out[r.mf_student_id] && out[r.mf_student_id][r.book_id];
          if (!o || String(o.curKey) !== rk) return; // 단원별 정오답은 현재 회차만
          const chapName = (r.concept_id != null) ? conceptBig[r.concept_id] : null;
          if (!chapName) return;
          const dt = r.score_datetime || '';
          const pg = _parsePage(r.page);
          const S = ca[r.mf_student_id] = ca[r.mf_student_id] || {};
          const Bk = S[r.book_id] = S[r.book_id] || { cur: '', curDate: '', _chap: {} };
          if (dt >= Bk.curDate) { Bk.curDate = dt; Bk.cur = chapName; }
          const c = Bk._chap[chapName] = Bk._chap[chapName] || { n: chapName, minP: 1e9, maxP: 0, lastDate: '', correct: 0, total: 0 };
          if (pg && pg < c.minP) c.minP = pg;
          if (pg > c.maxP) c.maxP = pg;
          if (dt > c.lastDate) c.lastDate = dt;
          if (r.result === 'O') { c.correct++; c.total++; } else if (r.result === 'X') { c.total++; }
        });
        let filled = 0;
        Object.keys(ca).forEach((sid) => {
          Object.keys(ca[sid]).forEach((bid) => {
            const o = out[sid] && out[sid][bid]; if (!o) return;
            const Bk = ca[sid][bid];
            const chapters = Object.values(Bk._chap)
              .map((c) => ({ n: c.n, minP: (c.minP === 1e9 ? 0 : c.minP), maxP: c.maxP, lastDate: cut(c.lastDate), correct: c.correct, total: c.total }))
              .sort((a, b) => (a.minP - b.minP) || a.lastDate.localeCompare(b.lastDate));
            o.chapters = chapters;
            if (Bk.cur) o.curChapter = Bk.cur;
            filled++;
          });
        });
        // 회차별 문항 정답률 반영 (세션 카운트보다 정확 — 5문항 이상일 때만 교체)
        Object.keys(roundAcc).forEach((sid) => {
          Object.keys(roundAcc[sid]).forEach((bid) => {
            const o = out[sid] && out[sid][bid]; if (!o || !o.rounds) return;
            o.rounds.forEach((r) => {
              const acc = roundAcc[sid][bid][r.k];
              if (acc && acc.t >= 5) r.rate = Math.round(acc.c / acc.t * 100);
            });
          });
        });
        log(`로드맵: 단원명 보강 ${filled}개 교재(현재 회차 기준)`);
      }
    } catch (e) { log('로드맵 단원명 보강 실패(치명적 아님):', e.message); }

    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_progress', value: { updated: new Date().toISOString(), byStudent: out }, updated_at: new Date().toISOString() }]),
    });
    const nRe = Object.values(out).reduce((a, bks) => a + Object.values(bks).filter((b) => b.roundN > 1).length, 0);
    log(`로드맵(mf_progress): 학생 ${Object.keys(out).length} · 재수강(2회차+) 교재 ${nRe}권 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('로드맵 갱신 실패(치명적 아님):', e.message); }
}

// ── 주간 TEST 카탈로그(전 학년, 미래 시험 포함) — 학생앱 「다음 시험 예고」용 ──
// GET /worksheet/weekly (매쓰플랫 제공 시험지 라이브러리): id·학년·개정·제목(날짜)·범위(chapter)·문항수.
// lumen_store 'mf_wk_catalog'에 저장. 학생앱은 "내가 최근 본 시험지의 다음 순서"로 다음 범위를 찾는다.
// ── v18-42: 「주간테스트로 쓸 학습지」 후보 목록 (lumen_store 'mf_wk_cand') ──
// 고등부는 매쓰플랫이 주간 TEST를 제공하지 않아, 원장님이 「내신대비」 학습지를 주간테스트로 쓰기도 한다.
// 태그만 보고 자동 포함하면 1~2명이 푼 개인 숙제까지 섞이므로, 앱에서 고를 수 있게 후보만 모아 둔다.
// 대상: 최근 90일 채점 기록이 있는 학습지 중 숙제·입학테스트가 아닌 것. 이미 주간(WEEKLY)인 것은 제외.
async function refreshWkCand() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    let tags = {};
    try {
      const rt = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_tags&select=value`, { headers: sbHeaders });
      if (rt.ok) { const j = await rt.json(); tags = ((j[0] || {}).value || {}).tags || {}; }
    } catch (e) {}
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const rows = [];
    for (let off = 0; off < 200000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_answer_records?select=worksheet_id,worksheet_title,worksheet_type,mf_student_id,score_datetime,school,grade,chapter&source=eq.${encodeURIComponent('학습지')}&score_datetime=gte.${since}&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    const map = {};
    rows.forEach((r) => {
      if (!r.worksheet_id) return;
      const tg = tags[r.worksheet_id] || {};
      if (tg.tag === 'HOMEWORK' || tg.tag === 'ENTRANCE_TEST') return;      // 숙제·입학테스트 제외
      if (r.worksheet_type === 'WEEKLY') return;                            // 이미 주간이면 후보 불필요
      const m = map[r.worksheet_id] = map[r.worksheet_id] || {
        wid: Number(r.worksheet_id), t: r.worksheet_title || '', type: r.worksheet_type || '',
        tag: tg.tag || null, tagName: tg.titleTag || null,
        sc: r.school || null, g: r.grade != null ? Number(r.grade) : null, ch: r.chapter || null,
        d: '', sids: {},
      };
      m.sids[r.mf_student_id] = 1;
      const dt = (r.score_datetime || '').slice(0, 10);
      if (dt > m.d) m.d = dt;
      if (!m.ch && r.chapter) m.ch = r.chapter;
    });
    const items = Object.values(map).map((m) => ({ wid: m.wid, t: m.t, type: m.type, tag: m.tag, tagName: m.tagName,
      sc: m.sc, g: m.g, ch: m.ch, d: m.d, n: Object.keys(m.sids).length }))
      .sort((a, b) => String(b.d).localeCompare(String(a.d)))
      .slice(0, 300);
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_wk_cand', value: { updated: new Date().toISOString(), items }, updated_at: new Date().toISOString() }]),
    });
    log(`주간테스트 후보(mf_wk_cand): 학습지 ${items.length}개 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('주간테스트 후보 갱신 실패(치명적 아님):', e.message); }
}


// ★ v18-73: 고등부 내신대비 학습지 → 주간 카탈로그 항목
//   items 배열에 직접 밀어 넣는다. 반환값 = 추가한 개수.
async function addHighNesin(url, sbHeaders, items) {
  let tags = {};
  try {
    const rt = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_tags&select=value`, { headers: sbHeaders });
    if (rt.ok) { const j = await rt.json(); tags = ((j[0] || {}).value || {}).tags || {}; }
  } catch (e) {}
  const nesinIds = Object.keys(tags).filter((id) => /내신/.test(String((tags[id] || {}).titleTag || '')));
  if (!nesinIds.length) return 0;

  const since = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
  const map = {};
  for (let i = 0; i < nesinIds.length; i += 100) {
    const chunk = nesinIds.slice(i, i + 100).join(',');
    const r = await fetch(`${url}/rest/v1/mf_answer_records?select=worksheet_id,worksheet_title,chapter,school,score_datetime,concept_id&worksheet_id=in.(${chunk})&score_datetime=gte.${since}&limit=20000`, { headers: sbHeaders });
    if (!r.ok) continue;
    (await r.json()).forEach((x) => {
      if (!x.worksheet_id || x.school !== 'HIGH') return;      // 고등만 (중등은 진짜 주간 TEST가 있다)
      const m = map[x.worksheet_id] = map[x.worksheet_id] || { t: x.worksheet_title || '', ch: x.chapter || '', d: '', q: {} };
      if (!m.ch && x.chapter) m.ch = x.chapter;
      const dt = String(x.score_datetime || '').slice(0, 10);
      if (dt > m.d) m.d = dt;
      if (x.concept_id != null) m.q[x.concept_id] = 1;         // 문항 수 근사(유형 수)
    });
  }
  const have = new Set(items.map((x) => String(x.id)));
  let n = 0;
  Object.keys(map).forEach((wid) => {
    if (have.has(String(wid))) return;
    const m = map[wid];
    if (!m.d) return;
    // 제목 앞 [공통수학2] → 과목명. 없으면 「고등」으로 묶는다.
    const sm = String(m.t).match(/^\s*\[([^\]]+)\]/);
    const subj = sm ? sm[1].trim() : '고등';
    items.push({
      id: Number(wid), sc: 'HIGH', g: subj, rev: 'CURRICULUM_22',
      t: subj + ' (' + m.d.replace(/-/g, '.') + ')',
      ch: m.ch || '', n: Object.keys(m.q).length || null,
      nesin: true, orig: m.t,
    });
    n++;
  });
  return n;
}

async function refreshWkCatalog() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const items = [];
    for (let pg = 0; pg < 6; pg++) {
      const d = await api(`/worksheet/weekly?size=1000&page=${pg}`);
      const list = (d && d.content) || (Array.isArray(d) ? d : []);
      list.forEach((w) => {
        if (!w || !w.id) return;
        items.push({ id: w.id, sc: w.schoolType || '', g: String(w.grade || ''), rev: w.revision || '',
          t: w.title || '', ch: w.chapter || '', n: w.problemCount || null });
      });
      if (list.length < 1000) break;
      await sleep(150);
    }
    if (!items.length) { log('주간 카탈로그: 조회 결과 없음 → 건너뜀'); return; }

    // ★ v18-73: 고등부 「내신대비」 학습지를 카탈로그에 합류
    //   매쓰플랫은 고등 주간 TEST를 제공하지 않아 카탈로그에 HIGH 계열이 0개였고,
    //   그래서 고등부 학생앱에는 「다음 주간테스트」 범위가 아예 뜨지 않았다.
    //   내신대비 태그 학습지는 범위(chapter)를 갖고 있으므로 그대로 시험지처럼 쓴다.
    //   계열은 제목 앞 대괄호의 과목명([공통수학2] 등)으로 나눈다 — 고등은 학년이 숫자가 아니라 과목이라서.
    //   (카탈로그는 「예고 후보」일 뿐이라 발표·명예의 전당에는 영향이 없다. 실제 주간테스트 합류는
    //    지금처럼 원장이 고른 wk_manual_ids만.)
    try {
      const nCand = await addHighNesin(url, sbHeaders, items);
      if (nCand) log(`주간 카탈로그: 고등 내신대비 ${nCand}개 합류`);
    } catch (e) { log('고등 내신대비 합류 실패(치명적 아님):', e.message); }

    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_wk_catalog', value: { updated: new Date().toISOString(), items }, updated_at: new Date().toISOString() }]),
    });
    log(`주간 카탈로그(mf_wk_catalog): 시험지 ${items.length}개 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('주간 카탈로그 갱신 실패(치명적 아님):', e.message); }
}

// ── 주간·단원테스트(WEEKLY·CHAPTER) 리포트 데이터 집계 ────────────────────
// mf_answer_records의 worksheet_type='WEEKLY'/'CHAPTER'를 학생×학습지로 집계해
// lumen_store 'mf_weekly'에 저장. 학원 내 평균·등수는 같은 학습지를 푼
// 우리 학생들로 즉시 계산(전국 등수는 원클릭 보고서 PDF에서만 확보 → mf_ws_behaviors).
// (단원테스트는 원클릭 PDF의 행동영역·전국등수가 불안정해서, 학원 등수라도 PDF 없이 보장하기 위함)
//   value = { updated, tests: [{ key, title, date, students: [{ sid, score,
//     correct, total, wrongConcepts:[{id,n,cnt}], acadRank, acadN, acadAvg }] }] }
// 시험지 정보(학교급·학년·학기·범위) 계산 — 학기는 범위의 단원명 키워드로 판정.
// 두 학기 키워드가 섞이거나 판정 불가면 학기 없이 학년만 (틀린 학기를 보여주는 것보다 안전).
const SEM_KEYS = {
  '초4': { 1: ['큰 수', '각도', '곱셈과 나눗셈', '평면도형의 이동', '막대그래프', '규칙 찾기'],
           2: ['분수의 덧셈', '진분수', '대분수', '삼각형', '소수의 덧셈', '사각형', '꺾은선', '다각형'] },
  '초5': { 1: ['혼합 계산', '약수와 배수', '규칙과 대응', '약분과 통분', '분수의 덧셈', '둘레와 넓이'],
           2: ['수의 범위', '어림', '분수의 곱셈', '합동과 대칭', '소수의 곱셈', '직육면체', '평균과 가능성'] },
  '초6': { 1: ['각기둥과 각뿔', '비와 비율', '여러 가지 그래프', '직육면체의 부피'],
           2: ['공간과 입체', '비례식', '비례배분', '원의 넓이', '원기둥', '원뿔', '구'] },
  '중1': { 1: ['소인수분해', '최대공약수', '최소공배수', '정수와 유리수', '문자', '식의 값', '일차식', '일차방정식', '순서쌍', '좌표', '그래프', '정비례', '반비례', '기호의 생략'],
           2: ['점, 선, 면', '각', '위치 관계', '평행선', '작도', '합동', '다각형', '부채꼴', '다면체', '회전체', '겉넓이', '부피', '도수분포', '히스토그램', '상대도수'] },
  '중2': { 1: ['유리수의 소수', '순환소수', '지수법칙', '단항식', '다항식', '일차부등식', '부등식', '연립방정식', '함숫값', '일차함수'],
           2: ['이등변', '외심', '내심', '삼각형의 성질', '평행사변형', '사각형', '닮음', '피타고라스', '경우의 수', '확률'] },
  '중3': { 1: ['제곱근', '무리수', '실수', '근호', '곱셈 공식', '인수분해', '이차방정식', '이차함수'],
           2: ['삼각비', '원주각', '현', '접선', '대푯값', '산포도', '상관관계'] },
};
function paperOf(school, grade, chapter, title) {
  const scMap = { ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' };
  const sc = scMap[school] || '';
  if (!sc || !grade) return null;
  const range = chapter || '';
  // 고등: 학기 대신 과목명 (제목에서 추출)
  if (sc === '고') {
    const m = String(title || '').match(/(공통수학\s*\d|대수|미적분\s*[Ⅰ Ⅱ12]*|수학\s*[ⅠⅡ12]|확률과 통계|기하)/);
    return { sc, g: grade, sem: null, label: m ? m[1].replace(/\s+/g, '') : '고' + grade, range };
  }
  const gk = sc + grade;
  // 제목에 "중N-M" 형태가 있으면 그대로 (단원테스트 제목 등)
  const tm = String(title || '').match(new RegExp(gk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*-\\s*([12])'));
  if (tm) return { sc, g: grade, sem: Number(tm[1]), label: gk + '-' + tm[1], range };
  const keys = SEM_KEYS[gk];
  let sem = null;
  if (keys && range) {
    const hit = { 1: 0, 2: 0 };
    [1, 2].forEach((s) => keys[s].forEach((k) => { if (range.includes(k)) hit[s]++; }));
    if (hit[1] > 0 && hit[2] === 0) sem = 1;
    else if (hit[2] > 0 && hit[1] === 0) sem = 2;
  }
  return { sc, g: grade, sem, label: gk + (sem ? '-' + sem : ''), range };
}

async function refreshWeekly() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const rows = [];
    for (let off = 0; off < 500000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_answer_records?select=mf_student_id,worksheet_id,student_worksheet_id,worksheet_title,worksheet_type,concept_id,result,score,score_datetime,chapter,school,grade&source=eq.${encodeURIComponent('학습지')}&worksheet_type=in.(WEEKLY,CHAPTER)&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    // v18-38: 커스텀 주간테스트(고등부 등) 인식 — 매쓰플랫이 주간 TEST를 중등까지만 제공하므로
    // 원장이 직접 만든 학습지도 다음 규칙 중 하나면 주간테스트로 집계에 포함한다:
    //   ① 학습지 태그가 WEEKLY_TEST  ② 제목에 '주간' 포함  ③ 수학비서 파이프라인이 등록한 학습지
    //   ④ v18-42: 원장이 학원앱에서 직접 고른 학습지(wk_manual_ids) — 고등부 「내신대비」 학습지를
    //      주간테스트로 쓰는 경우. 태그만으로 자동 포함하면 1~2명이 푼 개인 숙제까지 주간테스트가
    //      되어 발표·명예의 전당이 오염되므로, 반드시 원장이 고른 것만 넣는다.
    try {
      const rowKey = (r) => [r.mf_student_id, r.student_worksheet_id, r.concept_id, r.score_datetime, r.result].join('|');
      const seen = new Set(rows.map(rowKey));
      const wkIds = new Set();
      try {
        const rt = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_tags&select=value`, { headers: sbHeaders });
        if (rt.ok) { const j = await rt.json(); const tags = ((j[0] || {}).value || {}).tags || {};
          Object.keys(tags).forEach((id) => { if (tags[id] && tags[id].tag === 'WEEKLY_TEST' && tags[id].type === 'CUSTOM') wkIds.add(Number(id)); }); }
      } catch (e) {}
      try {
        const rs = await fetch(`${url}/rest/v1/lumen_store?key=eq.msecr_weekly_state&select=value`, { headers: sbHeaders });
        if (rs.ok) { const j = await rs.json(); const st = ((j[0] || {}).value || {}).processed || {};
          Object.values(st).forEach((p) => { if (p && p.worksheetId) wkIds.add(Number(p.worksheetId)); }); }
      } catch (e) {}
      // ④ 원장이 직접 고른 학습지 (태그·종류 무관 — 내신대비 등)
      const manIds = new Set();
      try {
        const rm = await fetch(`${url}/rest/v1/lumen_store?key=eq.wk_manual_ids&select=value`, { headers: sbHeaders });
        if (rm.ok) { const j = await rm.json(); ((j[0] || {}).value || {}).ids?.forEach((id) => manIds.add(Number(id))); }
      } catch (e) {}
      const sel = 'select=mf_student_id,worksheet_id,student_worksheet_id,worksheet_title,worksheet_type,concept_id,result,score,score_datetime,chapter,school,grade';
      const urls = [`${url}/rest/v1/mf_answer_records?${sel}&source=eq.${encodeURIComponent('학습지')}&worksheet_type=eq.CUSTOM&worksheet_title=ilike.${encodeURIComponent('*주간*')}&limit=5000`];
      if (wkIds.size) urls.push(`${url}/rest/v1/mf_answer_records?${sel}&source=eq.${encodeURIComponent('학습지')}&worksheet_type=eq.CUSTOM&worksheet_id=in.(${Array.from(wkIds).join(',')})&limit=5000`);
      if (manIds.size) urls.push(`${url}/rest/v1/mf_answer_records?${sel}&source=eq.${encodeURIComponent('학습지')}&worksheet_id=in.(${Array.from(manIds).join(',')})&limit=8000`);
      let extraN = 0;
      for (const u of urls) {
        const re = await fetch(u, { headers: sbHeaders });
        if (!re.ok) continue;
        (await re.json()).forEach((r) => { const k = rowKey(r); if (!seen.has(k)) { seen.add(k); rows.push(r); extraN++; } });
      }
      if (extraN) log(`주간테스트: 커스텀·직접지정(고등부 등) 기록 ${extraN}건 포함 (원장 지정 ${manIds.size}개 포함)`);
    } catch (e) { log('커스텀 주간 인식 실패(치명적 아님):', e.message); }
    if (!rows.length) { log('주간테스트: WEEKLY 기록 없음 → 건너뜀'); return; }
    // 배정 현황(채점 미완료 포함) — 이어 채점·미채점 학생도 명단에 넣기 위함
    let assign = {};
    try {
      const ra = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_ws_assign&select=value`, { headers: sbHeaders });
      if (ra.ok) { const ja = await ra.json(); assign = ((ja[0] && ja[0].value) || {}).map || {}; }
    } catch (e) {}
    // 유형명 사전 (오답 유형 이름 표시용)
    let cname = {};
    try {
      const rc = await fetch(`${url}/rest/v1/lumen_store?key=eq.mf_concept_names&select=value`, { headers: sbHeaders });
      if (rc.ok) { const j = await rc.json(); cname = (j[0] && j[0].value) || {}; }
    } catch (e) {}
    // 학습지(worksheet_id) × 학생(student_worksheet_id) 집계
    const tests = {}; // wid → { title, type, date, students: { sid → agg } }
    rows.forEach((r) => {
      if (!r.worksheet_id || r.mf_student_id == null) return;
      const T = tests[r.worksheet_id] = tests[r.worksheet_id] || { title: r.worksheet_title || '', type: r.worksheet_type || '', date: '', students: {},
        school: r.school || null, grade: r.grade != null ? Number(r.grade) : null, chapter: r.chapter || null };
      if (!T.chapter && r.chapter) T.chapter = r.chapter;
      if (!T.school && r.school) { T.school = r.school; T.grade = r.grade != null ? Number(r.grade) : T.grade; }
      const S = T.students[r.mf_student_id] = T.students[r.mf_student_id] || { sid: r.mf_student_id, score: null, correct: 0, total: 0, wrong: {} , dt: '' };
      S.total++;
      if (r.result === 'O') S.correct++;
      else if (r.result === 'X' && r.concept_id != null) S.wrong[r.concept_id] = (S.wrong[r.concept_id] || 0) + 1;
      if (r.score != null) S.score = r.score;
      const dt = (r.score_datetime || '').slice(0, 10);
      if (dt > S.dt) S.dt = dt;
      if (dt > T.date) T.date = dt;
    });
    const out = [];
    Object.keys(tests).forEach((wid) => {
      const T = tests[wid];
      const sts = Object.values(T.students);
      // 학원 내 평균·등수 (점수 있는 학생 기준)
      const scored = sts.filter((s) => s.score != null);
      const avg = scored.length ? Math.round(scored.reduce((a, s) => a + s.score, 0) / scored.length) : null;
      const sorted = scored.slice().sort((a, b) => b.score - a.score);
      const students = sts.map((s) => {
        const rank = (s.score != null) ? (sorted.findIndex((x) => x.score === s.score) + 1) : null; // 동점=같은 등수
        const wrongConcepts = Object.keys(s.wrong)
          .map((cid) => ({ id: Number(cid), n: (cname[cid] && cname[cid].n) || '', cnt: s.wrong[cid] }))
          .sort((a, b) => b.cnt - a.cnt).slice(0, 8);
        return { sid: s.sid, score: s.score, correct: s.correct, total: s.total, date: s.dt,
          wrongConcepts, acadRank: rank, acadN: scored.length, acadAvg: avg,
          natAvg: null, natRank: null, natN: null }; // 전국은 보고서 API 확보 후
      });
      // 채점 미완료(이어 채점·미채점) 학생 추가 — 문항 기록은 없어도 명단·진행 상황 표시
      const am = assign[wid] || {};
      Object.keys(am).forEach((sid) => {
        if (T.students[sid]) return;                      // 채점 완료 학생은 이미 포함
        const a = am[sid];
        if (a.st === 'COMPLETE') return;                  // 완료인데 기록 미수집 → 다음 수집에서 정식 반영
        students.push({ sid: Number(sid), score: null, st: a.st || 'PROGRESS',
          done: (a.cor || 0) + (a.wrg || 0), correct: a.cor || 0, total: a.tot,
          date: a.dt || '', wrongConcepts: [], acadRank: null, acadN: scored.length, acadAvg: avg,
          natAvg: null, natRank: null, natN: null });
      });
      out.push({ key: 'w' + wid, wid: Number(wid), title: T.title, type: T.type, date: T.date,
        paper: paperOf(T.school, T.grade, T.chapter, T.title), students });
    });
    out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_weekly', value: { updated: new Date().toISOString(), tests: out }, updated_at: new Date().toISOString() }]),
    });
    const nStu = out.reduce((a, t) => a + t.students.length, 0);
    const nWk = out.filter((t) => t.type === 'WEEKLY').length, nCh = out.filter((t) => t.type === 'CHAPTER').length;
    log(`주간·단원테스트(mf_weekly): 테스트 ${out.length}개(주간 ${nWk}·단원 ${nCh}) · 학생기록 ${nStu}건 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('주간테스트 갱신 실패(치명적 아님):', e.message); }
}

// ── 유형명 사전 갱신 ─────────────────────────────────────────
// mf_answer_records에 등장하는 concept_id의 한글 유형명을 매쓰플랫
// /concept/chips에서 받아 lumen_store 'mf_concept_names'에 저장.
// (학생앱 '스포트라이트'·학원앱 취약유형 화면이 이 사전으로 이름 표시)
async function refreshConceptNames() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    // 1) 저장된 정오답에서 concept_id·book_id 수집
    const usedIds = new Set(); const bookIds = new Set();
    for (let off = 0; off < 50000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_answer_records?select=concept_id,book_id,source&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const rows = await res.json();
      rows.forEach((r) => { if (r.concept_id != null) usedIds.add(r.concept_id); if (r.source === '교재' && r.book_id) bookIds.add(r.book_id); });
      if (rows.length < 1000) break;
    }
    if (!usedIds.size) { log('유형사전: 대상 concept 없음 → 건너뜀'); return; }
    // 2) 매쓰플랫 유형칩: 전체(key=1) + 교재별 필터 union (커버리지 최대화)
    const dict = {};
    const addChips = (arr) => (arr || []).forEach((c) => {
      if (c.conceptId && !dict[c.conceptId]) dict[c.conceptId] = { n: String(c.conceptName || '').split(';')[0].trim(), m: c.middleChapterName || '' };
    });
    addChips(await api('/concept/chips?curriculumKey=1'));
    for (const bid of bookIds) {
      try { addChips(await api(`/concept/chips?curriculumKey=1&workbookIds=${bid}`)); } catch (e) {}
      await sleep(80);
    }
    // 3) 실사용 concept만 추려 lumen_store에 저장
    const val = {};
    usedIds.forEach((id) => { if (dict[id]) val[id] = dict[id]; });
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_concept_names', value: val, updated_at: new Date().toISOString() }]),
    });
    log(`유형사전(mf_concept_names): ${Object.keys(val).length}/${usedIds.size}개 매핑 ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('유형사전 갱신 실패(치명적 아님):', e.message); }
}

// ── 「막힌 문제」 사전 계산 → lumen_store 'mf_stuck' (v18-46) ──────────────
//   아하노트는 “오답 정리를 해도 해결 안 되는 문제를 질문하는 것”이므로,
//   학생이 그 날 실제로 막혔는지를 먼저 알아야 아하노트 퍼센트를 매길 수 있다.
//   막힘 근거 3가지 (원장님 승인 2026-08-12 — 유형 3회 포함):
//     ❓ unk : 매쓰플랫 「모름」 체크 (학생이 직접 누름 — 가장 확실)
//     🔁 re  : 예전에 틀린 문제를 또 틀림 (스스로 정리했는데도 해결 못 함)
//     📉 t3  : 같은 유형에서 3번째 오답 (문제 하나가 아니라 개념이 안 잡힘)
//   결과: { "학생코드|YYYY-MM-DD": [{k,t}] } — 최근 120일, 하루 최대 12개
const STUCK_DAYS = 120, STUCK_PER_DAY = 12;
async function refreshStuck() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const sidCode = await buildSidCodeMap();
    // 판정에는 전 기간 이력이 필요하다(“예전에 틀린 문제”, “유형 누적 오답”)
    let rows = [], off = 0;
    while (off < 200000) {
      const sel = 'select=mf_student_id,problem_id,workbook_problem_id,topic_id,result,score_datetime,'
        + 'worksheet_title,chapter,page,number,source';
      const res = await fetch(`${url}/rest/v1/mf_answer_records?${sel}&order=score_datetime.asc,id.asc&offset=${off}&limit=1000`, { headers: sbHeaders });
      if (!res.ok) break;
      const j = await res.json();
      if (!Array.isArray(j) || !j.length) break;
      rows = rows.concat(j); off += 1000;
      if (j.length < 1000) break;
    }
    const since = new Date(Date.now() - STUCK_DAYS * 86400000).toISOString().slice(0, 10);
    const seenWrong = new Set();   // 학생|문제 — 이미 틀린 적 있음
    const topicWrong = {};         // 학생|유형 — 누적 오답 수
    const out = {};
    const label = (r) => {
      const book = String(r.worksheet_title || r.chapter || '').trim().slice(0, 30);
      const no = r.number != null && String(r.number).trim() ? String(r.number).trim() + '번' : '';
      // ⚠ 학습지 행의 page 컬럼은 전국 정답률로 재활용되고 있어 쪽수로 쓰면 안 된다
      // ⚠ 교재 page는 회차 전체 범위('8~146')가 들어오는 경우가 있어, 범위면 쪽수로 쓰지 않는다
      const pRaw = (r.source === '교재' && r.page != null) ? String(r.page).trim() : '';
      const pg = (pRaw && /^\d+$/.test(pRaw)) ? pRaw + 'p ' : '';
      return [book, (pg + no).trim()].filter(Boolean).join(' · ') || '문항';
    };
    const push = (code, day, k, r) => {
      if (day < since) return;
      const key2 = code + '|' + day;
      const a = out[key2] || (out[key2] = []);
      if (a.length >= STUCK_PER_DAY) return;
      a.push({ k, t: label(r) });
    };
    rows.forEach((r) => {
      const code = sidCode[r.mf_student_id];
      const day = String(r.score_datetime || '').slice(0, 10);
      if (!code || !day) return;
      if (r.result === '?') { push(code, day, 'unk', r); return; }
      if (r.result !== 'X') return;
      const pid = r.problem_id || (r.workbook_problem_id ? 'wb' + r.workbook_problem_id : null);
      if (pid) {
        const pk = code + '|' + pid;
        if (seenWrong.has(pk)) push(code, day, 're', r);
        seenWrong.add(pk);
      }
      if (r.topic_id) {
        const tk = code + '|' + r.topic_id;
        topicWrong[tk] = (topicWrong[tk] || 0) + 1;
        if (topicWrong[tk] === 3) push(code, day, 't3', r);   // 3번째 오답에서 한 번만
      }
    });
    const nDays = Object.keys(out).length;
    const nItems = Object.values(out).reduce((a, b) => a + b.length, 0);
    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST',
      headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_stuck', value: { map: out, days: STUCK_DAYS, updated: new Date().toISOString() }, updated_at: new Date().toISOString() }]),
    });
    log(`막힌 문제(mf_stuck): ${nItems}건 / 학생·날짜 ${nDays}건 (최근 ${STUCK_DAYS}일) ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);

    // 학부모앱용 — 학생별로 쪼개 저장한다(자기 아이 것만 내려받게, 최근 60일)
    const cut60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    const per = {};
    Object.keys(out).forEach((k) => {
      const i = k.lastIndexOf('|');
      const code = k.slice(0, i), day = k.slice(i + 1);
      if (day < cut60) return;
      (per[code] || (per[code] = {}))[day] = out[k];
    });
    const perRows = Object.keys(per).map((code) => ({
      key: 'stuck_' + code,
      value: { map: per[code], updated: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }));
    if (perRows.length) {
      const r2 = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
        method: 'POST',
        headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(perRows),
      });
      log(`  학부모앱용 학생별 분할(stuck_<코드>): ${perRows.length}명 ${r2.ok ? '저장 완료' : '저장 실패 ' + r2.status}`);
    }
  } catch (e) { log('막힌 문제 계산 실패(치명적 아님):', e.message); }
}

/* ── 옛 교재 고유키 정리 (2026-08-28) ───────────────────────────────────────
 * [무엇] 교재 문항의 고유키를 「wb:학생교재ID:문항ID」 → 「wb:학생교재ID:회차ID:문항ID」로 바꿨다.
 * [왜 정리가 필요한가] 옛 키로 쌓인 기록을 그대로 두면, 다음 수집에서 같은 문항이
 *   새 키로 한 번 더 들어온다. 그러면 한 문제를 두 번 세게 되어 진도 레이스 문항수·점수가
 *   부풀고, 정답률도 틀어진다.
 * [어떻게] 옛 기록의 「학생교재ID·회차ID·문항ID」는 이미 각 줄에 저장돼 있다.
 *   그 값으로 새 키를 만들어 그대로 옮겨 심고(내용은 하나도 안 바뀜), 옛 줄만 지운다.
 *   즉 지우는 게 아니라 <b>이름표만 바꿔 다는</b> 작업이다.
 * [언제] 매일 수집에서 교재 기록을 저장하기 <b>직전</b>에 한 번 돌린다.
 *   한 번 옮기고 나면 옛 줄이 0건이라 그냥 지나간다(부담 없음).
 *   `node sync/mathflat_collector.js --fix-keys` 로 따로 돌릴 수도 있고,
 *   `--dry-run` 을 붙이면 「몇 건이 옮겨질지」만 세어 보고 실제로는 건드리지 않는다. */
async function fixLegacyWbKeys(opts) {
  const dry = !!(opts && opts.dry);
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { scanned: 0, moved: 0, skipped: 0 };
  const H = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  const isLegacy = (k) => String(k || '').startsWith('wb:') && String(k).split(':').length === 3;

  try {
    // 1) 옛 형식(콜론 2개) 줄만 훑는다 — 새 형식(콜론 3개)은 서버에서 미리 걸러 낸다.
    const cols = REC_COLS.join(',');
    const rows = [];
    for (let off = 0; ; off += 1000) {
      const q = `${url}/rest/v1/mf_answer_records?select=${cols}`
        + `&record_key=like.wb:*&record_key=not.like.wb:*:*:*`
        + `&order=record_key.asc&limit=1000&offset=${off}`;
      const r = await fetch(q, { headers: H });
      if (!r.ok) { log(`  옛 키 조회 실패(${r.status}) — 이번엔 건너뜁니다`); return { scanned: 0, moved: 0, skipped: 0 }; }
      const page = await r.json();
      rows.push(...page.filter((x) => isLegacy(x.record_key)));   // 서버 필터를 한 번 더 확인
      if (page.length < 1000) break;
      await sleep(80);
    }
    if (!rows.length) return { scanned: 0, moved: 0, skipped: 0 };

    // 2) 각 줄에 새 이름표를 붙인다 (세 값 중 하나라도 비면 손대지 않고 그대로 둔다)
    const moved = [], oldKeys = [];
    let skipped = 0;
    for (const row of rows) {
      const swb = row.student_workbook_id, sbk = row.student_book_id, wp = row.workbook_problem_id;
      if (swb == null || sbk == null || wp == null) { skipped++; continue; }
      const nk = `wb:${swb}:${sbk}:${wp}`;
      if (nk === row.record_key) { skipped++; continue; }
      moved.push(mkRec(Object.assign({}, row, { record_key: nk })));
      oldKeys.push(row.record_key);
    }
    log(`옛 교재 고유키 정리: 대상 ${rows.length}건 → 옮길 ${moved.length}건 / 그대로 둘 ${skipped}건${dry ? ' (미리보기 — 실제 변경 없음)' : ''}`);
    if (dry || !moved.length) return { scanned: rows.length, moved: moved.length, skipped };

    // 3) 새 이름표로 먼저 심는다 (순서 중요: 중간에 멈춰도 기록이 사라지지 않음)
    await upsert('mf_answer_records', moved, 'record_key');

    // 4) 「진짜로 새 줄이 들어갔는지」 DB에 다시 물어본다.
    //    저장이 일부라도 실패했는데 옛 줄을 지우면 기록이 통째로 날아가므로,
    //    <b>확인된 것만</b> 지운다. 못 옮긴 줄은 그대로 남아 다음 날 다시 시도된다.
    const live = new Set();
    for (let off = 0; ; off += 1000) {
      const r = await fetch(`${url}/rest/v1/mf_answer_records?select=record_key`
        + `&record_key=like.wb:*:*:*&order=record_key.asc&limit=1000&offset=${off}`, { headers: H });
      if (!r.ok) { log(`  새 줄 확인 실패(${r.status}) — 안전을 위해 옛 줄은 지우지 않습니다`); return { scanned: rows.length, moved: 0, skipped }; }
      const page = await r.json();
      page.forEach((x) => live.add(x.record_key));
      if (page.length < 1000) break;
      await sleep(60);
    }
    const safeOld = [];
    for (let i = 0; i < oldKeys.length; i++) if (live.has(moved[i].record_key)) safeOld.push(oldKeys[i]);
    if (safeOld.length < oldKeys.length) log(`  ⚠ ${oldKeys.length - safeOld.length}건은 아직 안 옮겨져 옛 줄을 남겨 둡니다(내일 다시 시도)`);

    let gone = 0;
    for (let i = 0; i < safeOld.length; i += 100) {
      const part = safeOld.slice(i, i + 100);
      const list = part.map((k) => `"${k}"`).join(',');
      const r = await fetch(`${url}/rest/v1/mf_answer_records?record_key=in.(${encodeURIComponent(list)})`, {
        method: 'DELETE', headers: { ...H, prefer: 'return=minimal' },
      });
      if (r.ok) gone += part.length;
      else log(`  옛 줄 삭제 실패(${r.status}): ${(await r.text()).slice(0, 120)}`);
      await sleep(80);
    }
    log(`  옛 줄 ${gone}/${safeOld.length}건 정리 완료 — 이제 회차별로 따로 세어집니다`);
    return { scanned: rows.length, moved: moved.length, skipped };
  } catch (e) {
    log('옛 교재 고유키 정리 실패(치명적 아님):', e.message);
    return { scanned: 0, moved: 0, skipped: 0 };
  }
}

async function upsert(table, records, onConflict) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const CH = 500; let ok = 0, downgraded = 0;
  const send = (batch) => fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(batch),
  });
  for (let i = 0; i < records.length; i += CH) {
    let batch = records.slice(i, i + CH);
    let res = await send(batch);
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      // 「모름(?)」 제약이 아직 안 풀린 DB — 수집을 멈추지 말고 '-'로 강등해 재시도
      if (res.status === 400 && body.includes('23514') && batch.some((r) => r.result === '?')) {
        const n = batch.filter((r) => r.result === '?').length;
        batch = batch.map((r) => (r.result === '?' ? Object.assign({}, r, { result: '-' }) : r));
        res = await send(batch);
        if (res.ok) downgraded += n;
      }
      if (!res.ok) { log(`  ${table} upsert 실패(${res.status}): ${body.slice(0, 160)}`); await sleep(100); continue; }
    }
    ok += batch.length;
    await sleep(100);
  }
  log(`Supabase ${table}: ${ok}/${records.length}개 저장`);
  if (downgraded) log(`  ⚠ 「모름」 ${downgraded}건이 '-'로 저장됐습니다 — docs/supabase_unknown_result.sql 을 한 번 실행하면 '?'로 구분 저장됩니다`);
}

main().catch((e) => { log('❌ 오류:', e.message); process.exit(1); });
