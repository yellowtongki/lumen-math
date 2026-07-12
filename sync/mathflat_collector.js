/**
 * 매쓰플랫 문항 단위 정오답 수집기 (2단계)
 * =========================================
 * 학생별·교재(학습지)별·문항별 정오답(O/X)과 채점 시각을 매쓰플랫에서 수집한다.
 *
 * 수집 경로 (모두 실측 검증됨):
 *   1) POST /v2/login                                   → accessToken
 *   2) GET  /lesson-classes                             → 반 목록
 *   3) GET  /student-worksheet/lesson-class/{classId}   → 반의 학습지 + 배정 학생 목록
 *   4) GET  /student-worksheet/assign/{swId}            → 채점 시각·정답수·점수
 *   5) GET  /student-worksheet/assign/{swId}/problem    → 문항별 CORRECT/WRONG + 유형(개념/토픽)
 *
 * 사용법 (클라우드):
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     MATHFLAT_ID=... MATHFLAT_PASSWORD=... node sync/mathflat_collector.js --days 14
 *
 * 옵션:
 *   --days N     최근 N일 내 채점된 학습지만 수집 (기본 14)
 *   --out FILE   정규화 결과를 JSON으로 저장 (기본 sync/_debug/collected.json — 커밋 금지)
 *   --limit N    학습지 처리 개수 제한 (테스트용)
 *
 * Supabase 저장:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY 환경변수가 있으면 mf_answer_records 테이블에 upsert.
 *   (테이블 스키마는 docs/mathflat_schema.md 참고)
 *   키가 없으면 저장은 건너뛰고 로컬 JSON + 통계만 출력한다.
 *
 * 규칙: 비밀번호/키는 환경변수만. 실제 학생 데이터가 담긴 결과 파일(_debug/)은 커밋하지 않는다.
 */

const fs = require('fs');
const path = require('path');

const API = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';
const ID = process.env.MATHFLAT_ID;
const PW = process.env.MATHFLAT_PASSWORD;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const DAYS = parseInt(opt('--days', '14'), 10);
const OUT = opt('--out', path.join(__dirname, '_debug', 'collected.json'));
const LIMIT = parseInt(opt('--limit', '0'), 10); // 0 = 무제한

function log(...a) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${t}]`, ...a);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let TOKEN = null;
async function api(pathname) {
  const res = await fetch(`${API}${pathname}`, {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/plain, */*',
      'x-platform': 'TEACHER_WEB',
      'x-freewheelin-host': 'mathflat.com',
      authorization: `Bearer ${TOKEN}`,
      'x-auth-token': TOKEN,
      origin: 'https://teacher.mathflat.com',
      referer: 'https://teacher.mathflat.com/',
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  if (!res.ok) {
    const code = json && json.code ? json.code : res.status;
    throw new Error(`${res.status} ${code} @ ${pathname}`);
  }
  return json ? (json.data !== undefined ? json.data : json) : null;
}

async function login() {
  const res = await fetch(`${API}/v2/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platform': 'TEACHER_WEB',
      'x-freewheelin-host': 'mathflat.com',
      origin: 'https://teacher.mathflat.com',
      referer: 'https://teacher.mathflat.com/',
    },
    body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await res.json();
  if (!res.ok || !j.accessToken) throw new Error(`로그인 실패: ${j.code || res.status}`);
  TOKEN = j.accessToken;
  return { academyId: j.academyId, teacherId: j.userId };
}

// 'O'(정답)/'X'(오답)/'-'(미채점) 로 정규화
function toOX(result) {
  if (result === 'CORRECT') return 'O';
  if (result === 'WRONG' || result === 'INCORRECT') return 'X';
  return '-';
}

async function main() {
  if (!ID || !PW) { console.error('❌ MATHFLAT_ID / MATHFLAT_PASSWORD 필요'); process.exit(1); }

  const cutoff = new Date(Date.now() - DAYS * 86400 * 1000);
  log(`로그인 중… (최근 ${DAYS}일, 기준일 ${cutoff.toISOString().slice(0, 10)} 이후 채점분)`);
  const me = await login();
  log(`로그인 성공 · 학원 ${me.academyId} · 선생님 ${me.teacherId}`);

  const classes = await api('/lesson-classes');
  const classList = classes.content || classes || [];
  log(`반 ${classList.length}개 발견`);

  const records = [];      // 문항 단위 레코드
  const seenSw = new Set(); // studentWorksheetId 중복 방지
  let wsProcessed = 0, wsSkipped = 0;

  for (const cls of classList) {
    let worksheets;
    try {
      const r = await api(`/student-worksheet/lesson-class/${cls.id}?page=0&size=300`);
      worksheets = r.content || [];
    } catch (e) { log(`  · 반 ${cls.name} 학습지 조회 실패: ${e.message}`); continue; }

    for (const w of worksheets) {
      for (const asg of w.assignedStudentList || []) {
        if (asg.status !== 'COMPLETE') continue;          // 채점 완료만
        if (seenSw.has(asg.studentWorksheetId)) continue; // 중복 제거
        seenSw.add(asg.studentWorksheetId);

        if (LIMIT && wsProcessed >= LIMIT) { log(`--limit ${LIMIT} 도달, 중단`); return finish(records, me, wsProcessed, wsSkipped); }

        let summary, problems;
        try {
          summary = await api(`/student-worksheet/assign/${asg.studentWorksheetId}`);
          if (summary.scoreDatetime && new Date(summary.scoreDatetime) < cutoff) { wsSkipped++; continue; }
          const p = await api(`/student-worksheet/assign/${asg.studentWorksheetId}/problem`);
          problems = p.content || [];
        } catch (e) { log(`  · 채점 조회 실패 sw=${asg.studentWorksheetId}: ${e.message}`); continue; }

        const ws = summary.worksheet || w.worksheet || {};
        problems.forEach((pr, idx) => {
          const prob = pr.problem || {};
          records.push({
            academy_id: me.academyId,
            class_id: cls.id,
            class_name: cls.name,
            mf_student_id: asg.studentId,          // 매쓰플랫 학생ID (예: I2090532) — 루멘 코드 매핑은 별도
            student_worksheet_id: asg.studentWorksheetId,
            worksheet_id: ws.id,
            worksheet_title: ws.title,
            worksheet_type: ws.type,
            chapter: ws.chapter || null,
            school: ws.school || null,
            grade: ws.grade || null,
            problem_seq: idx + 1,                  // 학습지 내 문항 순번(=문항번호)
            worksheet_problem_id: pr.worksheetProblemId,
            problem_id: prob.id,
            concept_id: prob.conceptId || null,
            topic_id: prob.topicId || null,
            sub_topic_id: prob.subTopicId || null,
            level: prob.level || null,
            result: toOX(pr.result),               // 'O' / 'X' / '-'
            score: summary.score,
            score_datetime: summary.scoreDatetime, // 채점 시각
            assign_datetime: summary.assignDatetime,
          });
        });
        wsProcessed++;
        await sleep(120); // 서버 부하 방지 (예의)
      }
    }
  }
  await finish(records, me, wsProcessed, wsSkipped);
}

async function finish(records, me, wsProcessed, wsSkipped) {
  // 통계
  const students = new Set(records.map((r) => r.mf_student_id));
  const wrong = records.filter((r) => r.result === 'X').length;
  log(`── 수집 완료 ──`);
  log(`학습지(학생×교재) ${wsProcessed}건 처리, ${wsSkipped}건 기간외 제외`);
  log(`문항 레코드 ${records.length}개 · 학생 ${students.size}명 · 오답 ${wrong}개`);

  // 로컬 저장 (개인정보 포함 → _debug, 커밋 금지)
  try {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(records, null, 1));
    log(`결과 저장: ${OUT} (커밋하지 마세요)`);
  } catch (e) { log(`로컬 저장 실패: ${e.message}`); }

  // Supabase 저장 (키가 있을 때만)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    await upsertSupabase(records);
  } else {
    log('SUPABASE_URL/SUPABASE_SERVICE_KEY 미설정 → Supabase 저장은 건너뜀 (수집 검증만).');
  }
}

// mf_answer_records 테이블에 upsert (스키마: docs/mathflat_schema.md)
async function upsertSupabase(records) {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY;
  const CHUNK = 500;
  let ok = 0;
  for (let i = 0; i < records.length; i += CHUNK) {
    const batch = records.slice(i, i + CHUNK);
    const res = await fetch(`${url}/rest/v1/mf_answer_records?on_conflict=student_worksheet_id,problem_seq`, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });
    if (res.ok) ok += batch.length;
    else log(`  Supabase upsert 실패(${res.status}): ${(await res.text()).slice(0, 160)}`);
    await sleep(100);
  }
  log(`Supabase 저장 완료: ${ok}/${records.length}개`);
}

main().catch((e) => { log('❌ 오류:', e.message); process.exit(1); });
