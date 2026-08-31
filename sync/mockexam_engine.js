#!/usr/bin/env node
/*
 * mockexam_engine.js — 기출모의 자동 성적표 엔진 (1단계, 2026-08-29)
 *
 * 흐름: 매쓰플랫에서 기출 「원본」 학습지를 풀고 채점되면 → 수집기가 문항별 O/X를
 *       mf_answer_records에 쌓음 → 이 엔진이 O/X × 수학비서 배점표 = 자동 점수 계산
 *       → lumen_store 'mockexam_auto'에 저장 → 학원앱 기출모의 탭 「자동 수신함」이
 *       표시하고, 서술형 부분점수만 원장님이 입력해 mock_exams에 정식 등록.
 *
 * 모드:
 *   --build   시험↔학습지 연결표(exam_ws_map) 생성/갱신
 *             ① hs_exam_import.done(고등 37장: examId↔worksheetId 이미 저장)을 옮겨 담고
 *             ② 연결 안 된 「… 원본」 학습지는 수학비서 시험 제목과 대조해 백필
 *             ③ 각 시험의 문항별 배점·정답·답형식을 수학비서에서 수집해 배점표로 저장
 *             (수학비서 로그인 필요: MATHSECR_ID / MATHSECR_PASSWORD)
 *   --score   (기본) 연결표에 있는 학습지의 채점 기록을 학생×시험으로 묶어
 *             자동 점수 계산 → mockexam_auto 저장. 로그인 불필요, Supabase만.
 *   --dry-run 저장 없이 결과만 출력
 *
 * 서술형: 매쓰플랫 O/X로는 부분점수를 못 주므로, exam_ws_map[].essayNos에 든 문항은
 *         자동 합산에서 빼고 「원장님 입력 대기」로 넘긴다. 초기값은 답형식이 서술형인
 *         문항이며, 학원앱 연결표 편집 화면에서 문항별로 켜고 끌 수 있다.
 */
const fs = require('fs');

const SB_URL = process.env.SUPABASE_URL || 'https://bhkkkbcytcrlxhrtjgen.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_D3ryC0YXrf5Fq2Buu8IA8A_OvmCQbbi';
const MS_API = 'https://api.mathsecr.com';

const MODE_BUILD = process.argv.includes('--build');
const DRY = process.argv.includes('--dry-run');

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }
function sbH(extra) { return Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, extra || {}); }

async function sbGetKey(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  const j = await r.json();
  return (j && j[0] && j[0].value) || null;
}
async function sbPutKey(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST',
    headers: sbH({ 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' }),
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(`lumen_store ${key} 저장 실패 ${r.status}: ${await r.text()}`);
}

/* ═══════════ 수학비서 (build 모드 전용) ═══════════ */
let MS_TOKEN = null;
const MS_ORIGIN = 'https://mathsecr.com';
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  MS_TOKEN = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!r.ok || !MS_TOKEN) throw new Error('수학비서 로그인 실패 ' + r.status);
}
async function msGet(p) {
  const r = await fetch(MS_API + p, { headers: { accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', Authorization: 'Bearer ' + MS_TOKEN } });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status}`);
  return r.json();
}
async function msListMydbs() {
  const out = []; let cursor = '';
  for (let i = 0; i < 30; i++) {
    const j = await msGet(`/bms/api/v1/mydbs?limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    (j.data && j.data.mydbs || []).forEach(m => out.push(m));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return out;
}
// 시험지 하나의 배점표 (mathsecr_exam_collector.fetchExam 축약판)
async function msScoreTable(id) {
  const cells = []; let cursor = '';
  for (let i = 0; i < 10; i++) {
    const j = await msGet(`/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    ((j.data && j.data.pages) || []).forEach(pg => (pg.cells || []).forEach(c => cells.push({ ...c, _page: pg.pageNumber })));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  let scores = [];
  try { scores = ((await msGet(`/bms/api/v1/mydbs/${id}/scores`)).data || {}).questionScores || []; } catch (e) {}
  const scoreMap = {};
  scores.forEach(s => { scoreMap[`${s.pageNumber}|${s.questionNumber}`] = s; });
  return cells.map((c, idx) => {
    const a = (c.answers && c.answers[0]) || {};
    const sc = scoreMap[`${c._page}|${c.questionNumber}`] || {};
    const my = (c.myDbInfos && c.myDbInfos[0]) || {};
    // 배점: 내 수정값(my) 우선하되, 상식 범위(0<x<=30)를 벗어나면 공식 배점(sc)으로 폴백
    //  (실측: 소사고 387479의 4.8점이 my에 48로 잘못 저장돼 있었다)
    var vMy = (my.scores && my.scores[0]) != null ? my.scores[0] : null;
    var vSc = sc.score != null ? sc.score : null;
    var pick = (v) => v != null && v > 0 && v <= 30;
    var scoreVal = pick(vMy) ? vMy : (pick(vSc) ? vSc : (vMy != null ? vMy : vSc));
    // 소수점 누락 오타 보정: 48 → 4.8 (10으로 나눠야 상식 범위에 들어오는 경우)
    if (scoreVal != null && !pick(scoreVal) && scoreVal > 30 && pick(scoreVal / 10)) scoreVal = scoreVal / 10;
    var chArr = (c.chapters && c.chapters[0] && c.chapters[0].chapter) || [];
    return {
      seq: idx + 1,                      // 학습지 문항 순서 (= mf_answer_records.problem_seq)
      no: c.questionNumber,
      score: scoreVal,
      answerType: a.type || sc.answerType || null,
      answer: a.latex || (a.answer && a.answer.join(',')) || null,
      chapter: chArr.slice(-1)[0] || null,                       // 세부 유형
      unit: chArr.length > 1 ? chArr[1] : (chArr[0] || null),    // 대단원 (성적표 단원별 정답률용)
      difficulty: (a.difficulty && a.difficulty.mathSecr) != null ? a.difficulty.mathSecr : (sc.difficulty != null ? sc.difficulty : null),
    };
  });
}

// 제목 파싱: 「소사고등학교 2학년 2024년 2학기 중간 미적분1」 / 「강일중 1-1 기말 2025 원본」
function parseExamTitle(t) {
  t = String(t || '');
  const year = (t.match(/(20\d\d)년?/) || [])[1] || null;
  let grade = (t.match(/([1-3])학년/) || [])[1] || null;
  let semester = (t.match(/([12])학기/) || [])[1] || null;
  const short = t.match(/([1-3])-([12])/);          // 「1-1」 표기
  if (!grade && short) grade = short[1];
  if (!semester && short) semester = short[2];
  if (!grade) { const g2 = t.match(/[중고]\s?([1-3])(?![0-9])/); if (g2) grade = g2[1]; }   // 「중1공통」 표기
  const term = /중간/.test(t) ? '중간고사' : (/기말/.test(t) ? '기말고사' : null);
  // 학교명: 제목 맨 앞이 기본이지만 「내신 2025년 서울 강동구 강일중 …」처럼 중간에 올 수도 있다
  let school = (t.match(/^([가-힣]+?(?:중학교|고등학교|중|고))(?=\s)/) || [])[1] || null;
  if (!school) school = (t.match(/([가-힣]{2,}(?:중학교|고등학교|중|고))(?=\s)/) || [])[1] || null;
  const level = /고등학교|고(?:\s|$)/.test(school || '') ? '고' : '중';
  const subject = (t.match(/(공통수학[12]|미적분[I1-2]*|대수|확률과통계|기하|수학[I12상하]*)\s*(?:원본)?$/) || [])[1] || '수학';
  return { year, grade, semester, term, school, level, subject };
}

function isEssayType(answerType) { return /서술|essay|long_answer/i.test(String(answerType || '')); }

/* ═══════════ build: 연결표 생성 ═══════════ */
async function build() {
  if (!process.env.MATHSECR_ID) throw new Error('--build에는 MATHSECR_ID/PASSWORD 환경변수가 필요합니다');
  await msLogin(); log('수학비서 로그인 OK');

  const map = (await sbGetKey('exam_ws_map')) || { exams: {}, updated: null };
  map.exams = map.exams || {};

  // ① 고등 수입 기록(hs_exam_import)에서 examId↔worksheetId 옮겨 담기
  const hs = (await sbGetKey('hs_exam_import')) || {};
  const done = hs.done || {};
  let fromHs = 0;
  for (const examId of Object.keys(done)) {
    const d = done[examId];
    if (!d.worksheet) continue;
    if (!map.exams[examId]) { map.exams[examId] = { examId: +examId, title: d.title, worksheetId: d.worksheet, worksheetTitle: d.title + ' 원본' }; fromHs++; }
  }
  log(`고등 수입 기록에서 연결 ${fromHs}건 추가 (총 ${Object.keys(map.exams).length}건)`);

  // ② 백필: 채점 기록에 있는 「… 원본」 학습지 중 연결 안 된 것 → 수학비서 제목 대조
  // 「… 원본」 제목만 서버에서 바로 골라온다 — 전체 기록은 수만 행이라 앞부분만 읽으면
  // 최근 학습지를 놓친다 (실사례: 옥길중 2025-2 중간이 스캔 밖이라 미집계)
  const rr = await fetch(`${SB_URL}/rest/v1/mf_answer_records?source=eq.학습지&worksheet_title=like.${encodeURIComponent('*원본')}&select=worksheet_id,worksheet_title&limit=20000`, { headers: sbH() });
  const rows = await rr.json();
  const wsSeen = {};
  rows.forEach(x => { wsSeen[x.worksheet_id] = x.worksheet_title; });
  const linkedWs = new Set(Object.values(map.exams).map(e => e.worksheetId));
  const orphans = Object.keys(wsSeen).filter(id => !linkedWs.has(+id));
  if (orphans.length) {
    log(`연결 안 된 원본 학습지 ${orphans.length}개 — 수학비서 제목 대조 시도`);
    const mydbs = await msListMydbs();
    for (const wid of orphans) {
      const wt = wsSeen[wid];
      const pw = parseExamTitle(wt);
      const schoolToken = (pw.school || '').replace(/학교$/, '');   // 「강일중학교」→「강일중」
      const cand = mydbs.filter(m => {
        if (!schoolToken || !String(m.title).includes(schoolToken)) return false;
        const pm = parseExamTitle(m.title);
        if (pw.grade && pm.grade && pm.grade !== pw.grade) return false;
        if (pw.semester && pm.semester && pm.semester !== pw.semester) return false;
        if (pw.term && pm.term && pm.term !== pw.term) return false;
        if (pw.year && pm.year && pm.year !== pw.year) return false;
        return true;
      });
      if (cand.length === 1) {
        const ex = cand[0];
        map.exams[ex.id] = { examId: ex.id, title: ex.title, worksheetId: +wid, worksheetTitle: wt };
        log(`  백필: 「${wt}」 ↔ 수학비서 ${ex.id} 「${ex.title}」`);
      } else {
        log(`  ⚠ 「${wt}」 매칭 ${cand.length}건 — 건너뜀 (수동 연결 필요)`);
      }
    }
  }

  // ③ 배점표 수집 (없는 것만)
  for (const examId of Object.keys(map.exams)) {
    const e = map.exams[examId];
    e.meta = parseExamTitle(e.title);            // 제목 파싱은 항상 최신 규칙으로
    var hasDiff = e.scoreTable && e.scoreTable.length && e.scoreTable.every(q => q.difficulty != null || q.unit != null);
    if (e.scoreTable && e.scoreTable.length && hasDiff) continue;   // 난이도·대단원까지 있으면 통과
    try {
      const st = await msScoreTable(examId);
      let tot = st.reduce((s, q) => s + (q.score || 0), 0);
      if (tot === 0 && st.length) {           // 배점 미등록 시험 → 균등 배점(추정)
        const per = Math.round(1000 / st.length) / 10;
        st.forEach(q => { q.score = per; });
        tot = st.reduce((s, q) => s + q.score, 0);
        e.scoreMode = 'uniform';
      }
      e.scoreTable = st;
      e.total = Math.round(tot * 10) / 10;
      if (!e.essayNos) e.essayNos = st.filter(q => isEssayType(q.answerType)).map(q => q.seq);
      Object.assign(e, { meta: parseExamTitle(e.title) });
      log(`배점표: ${examId} 「${e.title}」 ${st.length}문항 · 총점 ${e.total}${e.total !== 100 ? ' ⚠ 100 아님' : ''}${e.scoreMode==='uniform'?' (균등 배점 추정)':''} · 서술형 초기값 ${e.essayNos.length}문항`);
    } catch (err) {
      log(`⚠ 배점표 실패 ${examId}: ${err.message}`);
    }
    await new Promise(s => setTimeout(s, 300));
  }

  map.updated = new Date().toISOString();
  if (DRY) { log('[dry-run] 저장 생략'); fs.writeFileSync('/tmp/exam_ws_map.json', JSON.stringify(map, null, 1)); return; }
  await sbPutKey('exam_ws_map', map);
  log(`exam_ws_map 저장 — 시험 ${Object.keys(map.exams).length}건`);
}

/* ═══════════ score: 자동 점수 계산 ═══════════ */
async function score() {
  const map = (await sbGetKey('exam_ws_map')) || { exams: {} };
  const exams = Object.values(map.exams || {}).filter(e => e.worksheetId && e.scoreTable && e.scoreTable.length);
  if (!exams.length) { log('연결표가 비어 있습니다 — 먼저 --build 를 실행하세요'); return; }
  const byWs = {}; exams.forEach(e => { byWs[e.worksheetId] = e; });

  // 학생 매핑: mf_student_id → {name, code}  (수집기가 백필한 lumen_rec_code + 이름 조인)
  const stuR = await fetch(`${SB_URL}/rest/v1/mf_students?select=mf_student_id,name,lumen_rec_code`, { headers: sbH() });
  const mfStu = await stuR.json();
  const roster = (await sbGetKey('or_studentdb')) || [];
  const byName = {};
  roster.forEach(s => { if (s && s.name && !s.withdrawn) byName[s.name.replace(/\s/g, '')] = s; });
  const stuMap = {};
  mfStu.forEach(m => {
    const nm = (m.name || '').replace(/\s/g, '');
    const ros = byName[nm];
    if (!ros) return;                                   // 등록부에 없거나 퇴원 → 제외
    stuMap[m.mf_student_id] = { name: ros.name, code: String(ros.lumen_rec_code || m.lumen_rec_code || '') };
  });

  // 채점 기록: 연결표 학습지만
  const ids = exams.map(e => e.worksheetId).join(',');
  const ansR = await fetch(`${SB_URL}/rest/v1/mf_answer_records?source=eq.학습지&worksheet_id=in.(${ids})&select=worksheet_id,student_worksheet_id,problem_seq,mf_student_id,result,score_datetime,concept_id,school,grade&limit=100000`, { headers: sbH() });
  const ans = await ansR.json();
  log(`채점 기록 ${ans.length}행 (${exams.length}개 시험 학습지)`);

  // 학생×학습지 응시로 묶기 (같은 학습지를 두 번 낸 경우 student_worksheet_id 최신 것만)
  const attempts = {};   // key: mfSid|worksheetId → {swId, per:{seq:{r,at}}}
  ans.forEach(a => {
    const stu = stuMap[a.mf_student_id]; if (!stu) return;
    const k = a.mf_student_id + '|' + a.worksheet_id;
    const cur = attempts[k];
    if (!cur || a.student_worksheet_id > cur.swId) {
      if (!cur || a.student_worksheet_id !== cur.swId) attempts[k] = { swId: a.student_worksheet_id, wsId: a.worksheet_id, sid: a.mf_student_id, mfSchool: a.school || null, mfGrade: a.grade || null, per: {} };
    }
    const at = attempts[k];
    if (a.student_worksheet_id === at.swId) at.per[a.problem_seq] = { r: a.result, at: a.score_datetime, cid: a.concept_id || null };
  });

  // 학습지 문항수(기록 관측) — 시험 문항수와 다르면 OCR 쪼개짐 등으로 순서가 어긋난 것
  const wsProbCount = {};
  Object.values(attempts).forEach(at => {
    const n = Math.max(0, ...Object.keys(at.per).map(Number));
    if (!wsProbCount[at.wsId] || n > wsProbCount[at.wsId]) wsProbCount[at.wsId] = n;
  });

  const items = [];
  Object.values(attempts).forEach(at => {
    const e = byWs[at.wsId]; const stu = stuMap[at.sid];
    const essaySet = new Set(e.essayNos || []);
    let auto = 0, autoMax = 0, wrong = [], ungraded = 0, lastAt = null;
    const per = [];
    e.scoreTable.forEach(q => {
      const rec = at.per[q.seq] || {};
      const r = rec.r || '-';
      if (rec.at && (!lastAt || rec.at > lastAt)) lastAt = rec.at;
      const isEssay = essaySet.has(q.seq);
      if (!isEssay) {
        autoMax += (q.score || 0);
        if (r === 'O') auto += (q.score || 0);
        else if (r === 'X' || r === '?') wrong.push(q.seq);
        else ungraded++;
      }
      per.push({ seq: q.seq, r, sc: q.score, essay: isEssay, chapter: q.chapter || null, unit: q.unit || null, diff: q.difficulty != null ? q.difficulty : null, cid: rec.cid || null });
    });
    auto = Math.round(auto * 10) / 10; autoMax = Math.round(autoMax * 10) / 10;
    const essay = e.scoreTable.filter(q => essaySet.has(q.seq)).map(q => ({ seq: q.seq, max: q.score || 0 }));
    items.push({
      key: stu.code + '|' + e.examId,
      student_code: stu.code, student_name: stu.name,
      examId: e.examId, examTitle: e.title, meta: e.meta || parseExamTitle(e.title),
      total: e.total || null,
      autoScore: auto, autoMax, essay, essayMax: essay.reduce((s, q) => s + q.max, 0),
      ungraded, wrongSeqs: wrong, per,
      solUrl: e.solUrl || null,           // 해설집 링크 (문항 앵커 #qN 지원)
      status: (wsProbCount[at.wsId] && wsProbCount[at.wsId] !== e.scoreTable.length) ? 'mismatch'
            : (ungraded > 0 ? 'partial' : 'ready'),
      wsCount: wsProbCount[at.wsId] || null, examCount: e.scoreTable.length,
      solvedAt: lastAt,
      mfStudentId: at.sid, mfSchool: at.mfSchool || null, mfGrade: at.mfGrade || null,
    });
  });

  items.sort((a, b) => (b.solvedAt || '').localeCompare(a.solvedAt || ''));
  log(`자동 채점 항목 ${items.length}건 — ready ${items.filter(i => i.status === 'ready').length} · partial ${items.filter(i => i.status === 'partial').length} · 문항수불일치 ${items.filter(i => i.status === 'mismatch').length}`);
  items.slice(0, 10).forEach(i => log(`  ${i.student_name} · ${i.examTitle} — 자동 ${i.autoScore}/${i.autoMax}점, 서술형 ${i.essay.length}문항(${i.essayMax}점) 대기, 미채점 ${i.ungraded}`));

  if (DRY) { fs.writeFileSync('/tmp/mockexam_auto.json', JSON.stringify({ items }, null, 1)); log('[dry-run] /tmp/mockexam_auto.json 저장'); return; }
  await sbPutKey('mockexam_auto', { items, updated: new Date().toISOString() });
  log('mockexam_auto 저장 완료');
}

(async () => {
  if (MODE_BUILD) await build(); else await score();
})().catch(e => { console.error('오류:', e.message); process.exit(1); });
