#!/usr/bin/env node
/* 수학비서 「나만의 DB」 기출 시험지 수집기
 *
 * 목표: 원장님이 구입해 둔 학교별 기출 DB(1,400여 개)에서 문항 단위 데이터를 수집한다.
 *   문항마다 단원 경로(5단계)·유형 태그(adaptiveTags)·정답·난이도·배점·예상풀이시간이
 *   붙어 있어, PDF 파싱 없이 바로 출제경향 분석에 쓸 수 있다.
 *
 * 사용법:
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/mathsecr_exam_collector.js --school 옥길중            # 학교 폴더 하나
 *   node sync/mathsecr_exam_collector.js --school 옥길중 --grade 중1  # 학년 폴더만
 *   node sync/mathsecr_exam_collector.js --ids 387569,342067          # 시험지 id 직접 지정
 *
 * 결과: sync/_debug/ms_exams_<이름>.json
 *   [{ id, title, year, school, grade, semester, term, questionCount, difficultyCount,
 *      scopes, cells: [{ no, page, score, answerType, answer, difficulty, solvingTime,
 *                        chapters(단원 경로 배열), tags(유형 태그) }] }]
 *   ⚠️ 시험 문제 이미지·원문은 수집하지 않는다(저작권). 분석용 메타데이터만.
 *   ⚠️ _debug는 .gitignore — 커밋 금지.
 *
 * 계정: 환경변수 MATHSECR_ID / MATHSECR_PASSWORD (코드·저장소에 절대 넣지 않기)
 */
const fs = require('fs');
const path = require('path');

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const OUT_DIR = path.join(__dirname, '_debug');

const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const SCHOOL = arg('school', null);
const GRADE = arg('grade', null);
const IDS = (arg('ids', '') || '').split(',').map(s => s.trim()).filter(Boolean).map(Number);

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

let MS_TOKEN = null;
function msHeaders() {
  return { accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` };
}
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  const tok = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!r.ok || !tok) throw new Error(`수학비서 로그인 실패 ${r.status}`);
  MS_TOKEN = tok;
}
async function msGet(p) {
  const r = await fetch(`${MS_API}${p}`, { headers: msHeaders() });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return j;
}

// 나만의 DB 전체 목록 (커서 페이지네이션 — pagination은 응답 최상위에 있다)
async function msListMydbs() {
  const all = [];
  let cursor = '';
  for (let i = 0; i < 40; i++) {
    const j = await msGet(`/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const items = (j.data && j.data.mydbs) || [];
    all.push(...items);
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor || !items.length) break;
  }
  return all;
}

// 폴더 트리에서 학교/학년 폴더 id 집합 찾기
async function folderIdsFor(school, grade) {
  const j = await msGet('/bms/api/v1/folders?folderType=mydb');
  const roots = Array.isArray(j.data) ? j.data : [j.data];
  const hit = [];
  (function walk(f, inSchool) {
    if (!f) return;
    const isSchool = f.name === school;
    const now = inSchool || isSchool;
    if (now && (!grade || f.name === grade || isSchool)) hit.push({ id: f.id, name: f.name, inGrade: !grade || f.name === grade });
    (f.children || []).forEach(c => walk(c, now));
  })({ name: '', children: roots }, false);
  // grade 지정 시: 학교 폴더 자체 + 해당 학년 폴더만
  const ids = new Set();
  for (const h of hit) if (!grade || h.inGrade || h.name === school) ids.add(h.id);
  return ids;
}

// 시험지 하나의 문항 데이터 (cells + scores)
async function fetchExam(id) {
  const det = (await msGet(`/bms/api/v1/mydbs/${id}`)).data;
  // cells: data.pages[].cells[]
  const cells = [];
  let cursor = '';
  for (let i = 0; i < 10; i++) {
    const j = await msGet(`/bms/api/v1/mydbs/${id}/cells?curriculumId=2&limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    ((j.data && j.data.pages) || []).forEach(pg => (pg.cells || []).forEach(c => cells.push({ ...c, _page: pg.pageNumber })));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  // scores: 배점·난이도·답형식 (페이지·문항번호 기준)
  let scores = [];
  try { scores = ((await msGet(`/bms/api/v1/mydbs/${id}/scores`)).data || {}).questionScores || []; } catch (e) {}
  const scoreMap = {};
  scores.forEach(s => { scoreMap[`${s.pageNumber}|${s.questionNumber}`] = s; });

  const slim = cells.map(c => {
    const a = (c.answers && c.answers[0]) || {};
    const sc = scoreMap[`${c._page}|${c.questionNumber}`] || {};
    const my = (c.myDbInfos && c.myDbInfos[0]) || {};
    return {
      no: c.questionNumber,
      page: c._page,
      score: (my.scores && my.scores[0]) != null ? my.scores[0] : (sc.score != null ? sc.score : null),
      answerType: a.type || sc.answerType || null,          // single_choice / 서술형 등
      answer: a.latex || (a.answer && a.answer.join(',')) || null,
      difficulty: (a.difficulty && a.difficulty.mathSecr) != null ? a.difficulty.mathSecr : (sc.difficulty != null ? sc.difficulty : null),
      solvingTime: (a.solvingTime && a.solvingTime.mathSecr) || null,
      chapters: (c.chapters && c.chapters[0] && c.chapters[0].chapter) || [],
      tags: (c.adaptiveTags || []).map(t => t.name),
      img: c.imagePath || null,      // 문항 이미지 (수학비서 CDN — 열람 권한은 CDN이 판단)
    };
  });
  return {
    id, title: det.title,
    questionCount: det.questionCount, difficultyCount: det.difficultyCount,
    averageDifficulty: det.averageDifficulty,
    sourcePath: det.source && det.source.sourcePath,
    cells: slim,
  };
}

// 제목에서 연도·학년·학기·중간/기말 추출
function parseTitle(t) {
  const m = {
    year: (t.match(/(20\d\d)년/) || [])[1] || null,
    grade: (t.match(/(중[1-3]|고[1-3])/) || [])[1] || null,
    semester: (t.match(/([12])학기/) || [])[1] || null,
    term: /중간/.test(t) ? '중간' : (/기말/.test(t) ? '기말' : null),
  };
  return m;
}

(async () => {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('MATHSECR_ID/PASSWORD 환경변수가 없습니다');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await msLogin();
  log('로그인 OK');

  let targets = [];
  let outName = 'ids';
  if (IDS.length) {
    targets = IDS.map(id => ({ id, scopes: null }));
  } else if (SCHOOL) {
    outName = SCHOOL + (GRADE ? '_' + GRADE : '');
    const fids = await folderIdsFor(SCHOOL, GRADE);
    if (!fids.size) throw new Error(`폴더를 못 찾음: ${SCHOOL} ${GRADE || ''}`);
    const all = await msListMydbs();
    targets = all.filter(m => fids.has(m.folderId) && m.dbStatus === 'dbCompleted');
    log(`${SCHOOL}${GRADE ? ' ' + GRADE : ''}: DB화 완료 ${targets.length}개 (전체 ${all.filter(m => fids.has(m.folderId)).length}개 중)`);
  } else {
    throw new Error('--school 또는 --ids 를 지정하세요');
  }

  const out = [];
  for (const t of targets) {
    try {
      const ex = await fetchExam(t.id);
      ex.scopes = t.scopes || null;   // 시험 범위(단원)는 목록 응답에만 있다
      Object.assign(ex, parseTitle(ex.title));
      out.push(ex);
      log(`  [${ex.id}] ${ex.title} — 문항 ${ex.cells.length}개`);
    } catch (e) {
      log(`  ⚠️ [${t.id}] 실패: ${e.message}`);
    }
  }
  const file = path.join(OUT_DIR, `ms_exams_${outName}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  log(`저장: ${file} (시험지 ${out.length}개, 문항 ${out.reduce((s, e) => s + e.cells.length, 0)}개)`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
