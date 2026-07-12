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
 *   (교재의 "문항별" O/X 상세는 progressIdList까지 확보, 해석 엔드포인트는 추후 연결)
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
const OUT_DIR = opt('--out-dir', path.join(__dirname, '_debug'));
const SKIP_PROBLEMS = has('--skip-problems');
const SKIP_HISTORY = has('--skip-history');

function log(...a) { const t = new Date().toISOString().replace('T', ' ').slice(0, 19); console.log(`[${t}]`, ...a); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (d) => d.toISOString().slice(0, 10);
const toOX = (r) => (r === 'CORRECT' ? 'O' : (r === 'WRONG' || r === 'INCORRECT') ? 'X' : '-');

let TOKEN = null;
async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      'content-type': 'application/json', accept: 'application/json, text/plain, */*',
      'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
      authorization: `Bearer ${TOKEN}`, 'x-auth-token': TOKEN,
      origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/',
    },
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
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
          records.push({
            academy_id: me.academyId, mf_student_id: asg.studentId,
            student_worksheet_id: asg.studentWorksheetId, problem_seq: idx + 1,
            worksheet_id: ws.id, worksheet_title: ws.title, worksheet_type: ws.type,
            chapter: ws.chapter || null, school: ws.school || null, grade: ws.grade || null,
            worksheet_problem_id: pr.worksheetProblemId, problem_id: prob.id,
            concept_id: prob.conceptId || null, topic_id: prob.topicId || null, sub_topic_id: prob.subTopicId || null,
            level: prob.level || null, result: toOX(pr.result),
            score: summary.score, score_datetime: summary.scoreDatetime, assign_datetime: summary.assignDatetime,
          });
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

  let answers = [], sessions = [];
  if (!SKIP_PROBLEMS) { answers = await collectAnswerRecords(me, cutoff); saveJson('mf_answer_records.json', answers); }
  if (!SKIP_HISTORY)  { sessions = await collectStudySessions(students, cutoff); saveJson('mf_study_sessions.json', sessions); }

  // 통계
  const wsSess = sessions.filter((s) => s.source === '학습지');
  const bkSess = sessions.filter((s) => s.source === '교재');
  const bkWrong = bkSess.reduce((a, s) => a + (s.wrong_count || 0), 0);
  log('── 수집 완료 ──');
  log(`[A] 학습지 문항 레코드: ${answers.length}개 (오답 ${answers.filter((r) => r.result === 'X').length})`);
  log(`[B] 세션: 학습지 ${wsSess.length} · 교재 ${bkSess.length} (교재 오답 합계 ${bkWrong})`);

  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    if (answers.length) await upsert('mf_answer_records', answers, 'student_worksheet_id,problem_seq');
    if (sessions.length) await upsert('mf_study_sessions', sessions, 'mf_student_id,book_id,student_workbook_id,student_book_id,update_datetime');
  } else {
    log('SUPABASE_URL/SERVICE_KEY 미설정 → 로컬 저장·검증만 (Supabase 저장 생략).');
  }
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
