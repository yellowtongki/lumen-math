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

// ── [A] 문항 단위 학습지 정오답 (반 → 학습지 → 문항) ──
async function collectAnswerRecords(me, cutoff) {
  const classes = await api('/lesson-classes');
  const classList = classes.content || classes || [];
  log(`[A] 학습지 문항 수집 · 반 ${classList.length}개`);
  const records = [];
  const seen = new Set();
  let processed = 0;
  for (const cls of classList) {
    let worksheets;
    try { worksheets = (await api(`/student-worksheet/lesson-class/${cls.id}?page=0&size=300`)).content || []; }
    catch (e) { log(`  · 반 ${cls.name} 조회 실패: ${e.message}`); continue; }
    for (const w of worksheets) {
      for (const asg of w.assignedStudentList || []) {
        if (asg.status !== 'COMPLETE' || seen.has(asg.studentWorksheetId)) continue;
        seen.add(asg.studentWorksheetId);
        if (LIMIT && processed >= LIMIT) { log(`  [A] --limit ${LIMIT} 도달`); return records; }
        let summary, problems;
        try {
          summary = await api(`/student-worksheet/assign/${asg.studentWorksheetId}`);
          if (summary.scoreDatetime && new Date(summary.scoreDatetime) < cutoff) continue;
          problems = (await api(`/student-worksheet/assign/${asg.studentWorksheetId}/problem`)).content || [];
        } catch (e) { log(`  · 채점 조회 실패 sw=${asg.studentWorksheetId}: ${e.message}`); continue; }
        const ws = summary.worksheet || w.worksheet || {};
        problems.forEach((pr, idx) => {
          const prob = pr.problem || {};
          records.push(mkRec({
            record_key: `ws:${asg.studentWorksheetId}:${idx + 1}`, source: '학습지',
            academy_id: me.academyId, mf_student_id: asg.studentId,
            student_worksheet_id: asg.studentWorksheetId, problem_seq: idx + 1,
            worksheet_id: ws.id, worksheet_title: ws.title, worksheet_type: ws.type,
            chapter: ws.chapter || null, school: ws.school || null, grade: ws.grade || null,
            worksheet_problem_id: pr.worksheetProblemId, problem_id: prob.id,
            concept_id: prob.conceptId || null, topic_id: prob.topicId || null, sub_topic_id: prob.subTopicId || null,
            level: prob.level || null, result: toOX(pr.result),
            score: summary.score, score_datetime: summary.scoreDatetime, assign_datetime: summary.assignDatetime,
          }));
        });
        processed++;
        await sleep(120);
      }
    }
  }
  return records;
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

async function main() {
  if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }
  const cutoff = new Date(Date.now() - DAYS * 86400 * 1000);
  log(`로그인 중… (최근 ${DAYS}일, 기준 ${fmt(cutoff)} 이후)`);
  const me = await login();
  log(`로그인 성공 · 학원 ${me.academyId} · 선생님 ${me.teacherId}`);
  const students = await getActiveStudents();
  log(`활동 학생(ACTIVE) ${students.length}명`);

  let wsAnswers = [], wbAnswers = [], sessions = [];
  if (!SKIP_PROBLEMS) wsAnswers = await collectAnswerRecords(me, cutoff);
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
    await refreshConceptNames();
    await refreshBookCatalog();
    await refreshTypeDb();
  } else {
    log('SUPABASE_URL/SERVICE_KEY 미설정 → 로컬 저장·검증만 (Supabase 저장 생략).');
  }
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
