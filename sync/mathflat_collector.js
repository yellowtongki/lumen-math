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
const toOX = (r) => (r === 'CORRECT' ? 'O' : (r === 'WRONG' || r === 'INCORRECT') ? 'X' : '-');

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
            if (stat) WS_BEHAV[swId] = { sid: st.id, wid: ws.id, date: (summary.scoreDatetime || '').slice(0, 10), b: stat.b, nat: stat.nat, acad: stat.acad };
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
          records.push(mkRec({
            record_key: `wb:${c.studentWorkbookId}:${wpId}`, source: '교재',
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

async function main() {
  // --monthly: 월간보고서 요청 처리 (매쓰플랫 로그인 필요)
  if (has('--monthly')) { await runMonthly(); return; }
  // --weekly-only: 매쓰플랫 로그인 없이 주간테스트 집계만 (Supabase 기존 기록 사용)
  if (has('--weekly-only')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
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
    if (answers.length) await upsert('mf_answer_records', answers, 'record_key');
    if (sessions.length) await upsert('mf_study_sessions', sessions, 'mf_student_id,book_id,student_workbook_id,student_book_id,update_datetime');
    await saveWsTags();
    await saveWsBehaviors();
    await refreshConceptNames();
    await refreshBookCatalog();
    await refreshTypeDb();
    await refreshRoadmap();
    await refreshWeekly();
    await refreshMonthCounts();
    await refreshMonthScores(students);
    await refreshTypeAch();
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
  try {
    const rows = [];
    for (let off = 0; off < 300000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_study_sessions?select=mf_student_id,book_id,chapter,page,correct_count,wrong_count,update_datetime&source=eq.${encodeURIComponent('교재')}&order=update_datetime.asc&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (!rows.length) { log('로드맵: 교재 세션 없음 → 건너뜀'); return; }
    const now = Date.now(), WEEK = 7 * 86400000;
    const byStudent = {};
    rows.forEach((r) => {
      if (!r.book_id || r.mf_student_id == null) return;
      const pg = _parsePage(r.page);
      const dt = r.update_datetime || '';
      const cc = r.correct_count || 0, wc = r.wrong_count || 0;
      const S = byStudent[r.mf_student_id] = byStudent[r.mf_student_id] || {};
      const B = S[r.book_id] = S[r.book_id] || { maxPage: 0, curChapter: '', lastDate: '', weekBase: null, _chap: {}, months: {} };
      if (pg > B.maxPage) B.maxPage = pg;
      if (dt >= B.lastDate) { B.lastDate = dt; if (r.chapter) B.curChapter = r.chapter; }
      if (r.chapter) {
        const c = B._chap[r.chapter] = B._chap[r.chapter] || { n: r.chapter, minP: 1e9, maxP: 0, lastDate: '', correct: 0, total: 0 };
        if (pg && pg < c.minP) c.minP = pg;
        if (pg > c.maxP) c.maxP = pg;
        if (dt > c.lastDate) c.lastDate = dt;
        c.correct += cc; c.total += cc + wc;
      }
      // 주간 진도: 7일 이전 시점의 최대 도달 페이지를 기준선으로
      const ts = dt ? Date.parse(dt.replace(' ', 'T')) : NaN;
      if (!isNaN(ts) && (now - ts) > WEEK) { if (B.weekBase === null || pg > B.weekBase) B.weekBase = pg; }
      const ym = dt.slice(0, 7);
      if (ym) {
        const m = B.months[ym] = B.months[ym] || { c: 0, t: 0, maxP: 0 };
        m.c += cc; m.t += cc + wc; if (pg > m.maxP) m.maxP = pg;
      }
    });
    const out = {};
    Object.keys(byStudent).forEach((sid) => {
      out[sid] = {};
      Object.keys(byStudent[sid]).forEach((bid) => {
        const B = byStudent[sid][bid];
        const chapters = Object.keys(B._chap).map((k) => B._chap[k])
          .map((c) => ({ n: c.n, minP: (c.minP === 1e9 ? 0 : c.minP), maxP: c.maxP, lastDate: (c.lastDate || '').slice(0, 10), correct: c.correct, total: c.total }))
          .sort((a, b) => (a.minP - b.minP) || a.lastDate.localeCompare(b.lastDate));
        const weekPages = B.weekBase === null ? B.maxPage : Math.max(0, B.maxPage - B.weekBase);
        out[sid][bid] = { maxPage: B.maxPage, curChapter: B.curChapter, lastDate: (B.lastDate || '').slice(0, 10), weekPages, chapters, months: B.months };
      });
    });

    // ── 단원명 보강: 세션엔 chapter가 없어 문항단위 기록(mf_answer_records, 교재)에서
    //    단원별 정오답·페이지·현재 단원을 집계해 위 out에 덮어씀 ([C] 수집 시 채워짐).
    //    교재 섹션 제목(p.title: '단원 마무리' 등)은 지저분하므로 concept_id→대단원명으로
    //    묶어 교재 목차(units)와 같은 깨끗한 대단원으로 표기. ──
    try {
      // concept_id → 대단원명 매핑 (전체 교육과정 3키)
      const conceptBig = {};
      for (const k of ['1.4.4145', '1.4.4146', '1.4.4147']) {
        try { (await api(`/concept/chips?curriculumKey=${k}`) || []).forEach((c) => { if (c.conceptId && c.bigChapterName) conceptBig[c.conceptId] = c.bigChapterName; }); } catch (e) {}
      }
      const arows = [];
      for (let off = 0; off < 500000; off += 1000) {
        const res2 = await fetch(`${url}/rest/v1/mf_answer_records?select=mf_student_id,book_id,chapter,concept_id,page,result,score_datetime&source=eq.${encodeURIComponent('교재')}&order=score_datetime.asc&limit=1000&offset=${off}`, { headers: sbHeaders });
        if (!res2.ok) break;
        const b2 = await res2.json();
        arows.push(...b2);
        if (b2.length < 1000) break;
      }
      if (arows.length) {
        const ca = {}; // ca[sid][bid] = { cur:'', curDate:'', _chap:{} }
        arows.forEach((r) => {
          // 개념→대단원 매핑된 것만 사용(교재 섹션 잡음 '단원 마무리·쌍둥이 기출' 등 제거).
          const chapName = (r.concept_id != null) ? conceptBig[r.concept_id] : null;
          if (!r.book_id || r.mf_student_id == null || !chapName) return;
          const sid = r.mf_student_id, bid = r.book_id, dt = r.score_datetime || '';
          const pg = _parsePage(r.page);
          const S = ca[sid] = ca[sid] || {};
          const Bk = S[bid] = S[bid] || { cur: '', curDate: '', _chap: {} };
          if (dt >= Bk.curDate) { Bk.curDate = dt; Bk.cur = chapName; }
          const c = Bk._chap[chapName] = Bk._chap[chapName] || { n: chapName, minP: 1e9, maxP: 0, lastDate: '', correct: 0, total: 0 };
          if (pg && pg < c.minP) c.minP = pg;
          if (pg > c.maxP) c.maxP = pg;
          if (dt > c.lastDate) c.lastDate = dt;
          if (r.result === 'O') { c.correct++; c.total++; }
          else if (r.result === 'X') { c.total++; }
        });
        let filled = 0;
        Object.keys(ca).forEach((sid) => {
          out[sid] = out[sid] || {};
          Object.keys(ca[sid]).forEach((bid) => {
            const Bk = ca[sid][bid];
            const chapters = Object.keys(Bk._chap).map((k) => Bk._chap[k])
              .map((c) => ({ n: c.n, minP: (c.minP === 1e9 ? 0 : c.minP), maxP: c.maxP, lastDate: (c.lastDate || '').slice(0, 10), correct: c.correct, total: c.total }))
              .sort((a, b) => (a.minP - b.minP) || a.lastDate.localeCompare(b.lastDate));
            const prev = out[sid][bid] || { maxPage: 0, weekPages: 0, months: {}, lastDate: '' };
            out[sid][bid] = { maxPage: prev.maxPage, curChapter: Bk.cur, lastDate: prev.lastDate || (Bk.curDate || '').slice(0, 10), weekPages: prev.weekPages, chapters, months: prev.months };
            filled++;
          });
        });
        log(`로드맵: 단원명 보강 ${filled}개 교재(mf_answer_records)`);
      }
    } catch (e) { log('로드맵 단원명 보강 실패(치명적 아님):', e.message); }

    const res = await fetch(`${url}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ key: 'mf_progress', value: { updated: new Date().toISOString(), byStudent: out }, updated_at: new Date().toISOString() }]),
    });
    log(`로드맵(mf_progress): 학생 ${Object.keys(out).length} ${res.ok ? '저장 완료' : '저장 실패 ' + res.status}`);
  } catch (e) { log('로드맵 갱신 실패(치명적 아님):', e.message); }
}

// ── 주간·단원테스트(WEEKLY·CHAPTER) 리포트 데이터 집계 ────────────────────
// mf_answer_records의 worksheet_type='WEEKLY'/'CHAPTER'를 학생×학습지로 집계해
// lumen_store 'mf_weekly'에 저장. 학원 내 평균·등수는 같은 학습지를 푼
// 우리 학생들로 즉시 계산(전국 등수는 원클릭 보고서 PDF에서만 확보 → mf_ws_behaviors).
// (단원테스트는 원클릭 PDF의 행동영역·전국등수가 불안정해서, 학원 등수라도 PDF 없이 보장하기 위함)
//   value = { updated, tests: [{ key, title, date, students: [{ sid, score,
//     correct, total, wrongConcepts:[{id,n,cnt}], acadRank, acadN, acadAvg }] }] }
async function refreshWeekly() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const sbHeaders = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };
  try {
    const rows = [];
    for (let off = 0; off < 500000; off += 1000) {
      const res = await fetch(`${url}/rest/v1/mf_answer_records?select=mf_student_id,worksheet_id,student_worksheet_id,worksheet_title,worksheet_type,concept_id,result,score,score_datetime&source=eq.${encodeURIComponent('학습지')}&worksheet_type=in.(WEEKLY,CHAPTER)&limit=1000&offset=${off}`, { headers: sbHeaders });
      if (!res.ok) break;
      const batch = await res.json();
      rows.push(...batch);
      if (batch.length < 1000) break;
    }
    if (!rows.length) { log('주간테스트: WEEKLY 기록 없음 → 건너뜀'); return; }
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
      const T = tests[r.worksheet_id] = tests[r.worksheet_id] || { title: r.worksheet_title || '', type: r.worksheet_type || '', date: '', students: {} };
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
      out.push({ key: 'w' + wid, wid: Number(wid), title: T.title, type: T.type, date: T.date, students });
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

async function upsert(table, records, onConflict) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, ''); const key = process.env.SUPABASE_SERVICE_KEY;
  const CH = 500; let ok = 0;
  for (let i = 0; i < records.length; i += CH) {
    const batch = records.slice(i, i + CH);
    const res = await fetch(`${url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: 'POST',
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length; else log(`  ${table} upsert 실패(${res.status}): ${(await res.text()).slice(0, 160)}`);
    await sleep(100);
  }
  log(`Supabase ${table}: ${ok}/${records.length}개 저장`);
}

main().catch((e) => { log('❌ 오류:', e.message); process.exit(1); });
