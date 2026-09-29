#!/usr/bin/env node
/* 학교별 기출 출제경향 보고서 생성기 (v2 — 문항 이미지 + 디자인 개편)
 *
 * mathsecr_exam_collector.js가 모아둔 문항 데이터(sync/_debug/ms_exams_*.json)를 읽어
 * 학교·학년·학기·중간/기말 단위의 출제경향 분석 HTML 보고서를 만든다.
 *
 * 사용법:
 *   node sync/exam_report_gen.js --data sync/_debug/ms_exams_옥길중.json \
 *     --school 옥길중 --grade 중1 --semester 2 --term 중간 \
 *     --out docs/exam_reports/okgil_m1_2_mid.html
 *
 * ── 인근 학교 비교 모드 (--anchor) ──
 * 우리 학교 기출이 1회분뿐이라 연도별 비교가 안 될 때 쓴다.
 * 같은 학군 인접 학교의 같은 시험(학년·학기·중간/기말)을 함께 넣고,
 * --anchor 에 "우리 학교 시험지 id"를 주면 그 시험을 기준(★)으로 삼아
 * "여러 학교에서 반복 출제된 유형"을 뽑는다.
 *   node sync/exam_report_gen.js --data sync/_debug/ms_exams_okgil_m2_2mid.json \
 *     --school 옥길중 --grade 중2 --semester 2 --term 중간 --anchor 493934 \
 *     --scope "중2-2: 01 이등변삼각형과 직각삼각형 - 05 도형의 닮음" \
 *     --out docs/exam_reports/okgil_m2_2_mid.html
 *
 * 문항 이미지는 수학비서 CDN 주소를 직접 링크한다(이미지 파일을 저장소에 넣지 않음).
 * 이미지가 안 보이는 환경을 위해 자동 안내 배너가 뜬다.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(n, d) { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; }
const DATA = arg('data'); const SCHOOL = arg('school', '');
const GRADE = arg('grade'); const SEM = arg('semester'); const TERM = arg('term');
const OUT = arg('out');
const ANCHOR = arg('anchor');             // 비교 모드 — 기준이 되는 시험지 id
const SCOPE = arg('scope');               // 시험 범위 직접 지정 (--ids 수집분은 범위 정보가 없다)
// 시험지를 id로 직접 고른다 (학년/학기/중간·기말이 제각각인 시험지를 섞어 볼 때)
const EXAMS = (arg('exams', '') || '').split(',').map(v => v.trim()).filter(Boolean);
// 특정 단원 문항만 남긴다 — "2025년 시험 범위에 해당하는 문항만" 골라낼 때
const UNITS = (arg('units', '') || '').split(',').map(v => v.trim()).filter(Boolean);
// 계열 이름 표기: school = "옥길중 2025", term = "2025년 2학기 중간"
const LABEL = arg('label', 'school');
const EMBED = args.includes('--embed');   // 문항 이미지를 base64로 인라인 (자체 포함 배포본)
if (!DATA || !GRADE || !SEM || !TERM || !OUT) {
  console.error('필수 인자: --data --grade --semester --term --out'); process.exit(1);
}

const clean = s => String(s || '').replace(/^\d+ /, '');
function diffBand(d) { if (d == null) return null; if (d <= 2) return '하'; if (d <= 4) return '중'; if (d <= 6) return '상'; return '최상'; }
const isEssay = t => t && t !== 'single_choice';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
let exams = EXAMS.length
  ? EXAMS.map(id => all.find(e => String(e.id) === id)).filter(Boolean)
  : all.filter(e => e.grade === GRADE && e.semester === SEM && e.term === TERM);
exams.sort((a, b) => Number(a.year) - Number(b.year));
// 시험 범위에 해당하는 단원의 문항만 남긴다
if (UNITS.length) {
  exams.forEach(e => { e.cells = e.cells.filter(c => UNITS.includes(clean(c.chapters[1]))); });
  exams = exams.filter(e => e.cells.length);
}
if (!exams.length) { console.error('해당 조건의 시험지가 없습니다'); process.exit(1); }

// 시험지 제목에서 학교명 뽑기 — "… 부천시 옥길중 중2공통 …" / "… 부천시 옥길중학교 중3공 …"
const schoolOf = t => (String(t).match(/(?:시|군|구)\s+(\S+?중)(?:학교)?\s/) || [])[1] || SCHOOL;
const PEER = !!ANCHOR;                    // 인근 학교 비교 모드 여부
const termLabel = e => `${e.year}년 ${e.semester}학기 ${e.term}`;
exams.forEach(e => {
  e.school = schoolOf(e.title);
  if (!PEER) { e.key = String(e.year); e.label = `${e.year}년`; }
  else if (LABEL === 'term') { e.key = termLabel(e); e.label = termLabel(e); }
  else { e.key = `${e.school} ${e.year}`; e.label = `${e.school} ${e.year}년`; }
});
// 기준 시험지 — 비교 모드면 --anchor, 아니면 가장 최근 연도
const anchorExam = (PEER && exams.find(e => String(e.id) === String(ANCHOR))) || exams[exams.length - 1];
if (PEER) {
  // 우리 학교 시험을 맨 앞에, 나머지는 최신 연도부터
  exams.sort((a, b) => (a === anchorExam ? -1 : b === anchorExam ? 1 : 0)
    || Number(b.year) - Number(a.year) || a.school.localeCompare(b.school));
}
const anchorKey = anchorExam.key;
const isAnchor = k => k === anchorKey;
// 비교 대상이 모두 우리 학교면 "과거 기출 비교", 아니면 "인근 학교 비교"
const OWN = PEER && new Set(exams.map(e => e.school)).size === 1;

// 이미지 인라인용 — 다운로드된 로컬 파일을 base64 data URI로
let IMGMAP = {};
if (EMBED) {
  const mf = path.join(__dirname, '_debug', 'ms_exam_images_map.json');
  if (fs.existsSync(mf)) IMGMAP = JSON.parse(fs.readFileSync(mf, 'utf8'));
}
function imgSrc(url) {
  if (!url) return null;
  if (EMBED && IMGMAP[url]) {
    const fp = path.join(__dirname, '_debug', 'exam_images', IMGMAP[url]);
    if (fs.existsSync(fp)) {
      const ext = IMGMAP[url].endsWith('webp') ? 'webp' : 'png';
      return `data:image/${ext};base64,${fs.readFileSync(fp).toString('base64')}`;
    }
  }
  return url;   // 임베드 안 하면 CDN 원주소(로그인 필요)
}


// ── 집계 ──────────────────────────────────────────────
// keys = 그래프의 계열(비교 모드에서는 "학교 연도", 기본 모드에서는 연도)
const keys = exams.map(e => e.key);
const latest = anchorExam.year;
const latestExam = anchorExam;
const totalN = exams.reduce((s, e) => s + e.cells.length, 0);

const perExam = exams.map(e => {
  const total = e.cells.reduce((s, c) => s + (c.score || 0), 0);
  return {
    key: e.key, label: e.label, anchor: PEER && e === anchorExam, n: e.cells.length,
    total: total >= 90 ? total : null,
    choice: e.cells.filter(c => !isEssay(c.answerType)).length,
    essay: e.cells.filter(c => isEssay(c.answerType)).length,
  };
});

const unitSet = [];
const unitByKey = {};
const unitTotalN = {};
exams.forEach(e => e.cells.forEach(c => {
  const u = clean(c.chapters[1]) || '기타';
  if (!unitSet.includes(u)) unitSet.push(u);
  (unitByKey[e.key] = unitByKey[e.key] || {})[u] = ((unitByKey[e.key] || {})[u] || 0) + 1;
  unitTotalN[u] = (unitTotalN[u] || 0) + 1;
}));
// 기준 시험에서 많이 나온 단원 우선, 같으면 전체 합계 순
unitSet.sort((a, b) => ((unitByKey[anchorKey] || {})[b] || 0) - ((unitByKey[anchorKey] || {})[a] || 0)
  || (unitTotalN[b] || 0) - (unitTotalN[a] || 0));

const unitScore = {};
let unitScoreTotal = 0;
anchorExam.cells.forEach(c => {
  if (c.score) { const u = clean(c.chapters[1]) || '기타'; unitScore[u] = (unitScore[u] || 0) + c.score; unitScoreTotal += c.score; }
});

// 세부유형(레벨4) — 시험지별 출현 문항 기록 (이미지 포함)
const typeMap = {};
exams.forEach(e => e.cells.forEach(c => {
  const k = clean(c.chapters[3]);
  if (!k) return;
  const t = typeMap[k] = typeMap[k] || { name: k, unit: clean(c.chapters[1]), items: [] };
  t.items.push({ key: e.key, label: e.label, no: c.no, img: c.img, diff: c.difficulty, essay: isEssay(c.answerType), score: c.score || null, time: c.solvingTime || null, answer: c.answer });
}));
const nExams = t => new Set(t.items.map(i => i.key)).size;
const hasAnchor = t => t.items.some(i => isAnchor(i.key));
const maxDiff = t => Math.max(...t.items.map(i => i.diff || 0));
const repeated = PEER
  // 비교 모드: 2개 이상 시험지에 나온 유형 — 우리 학교 출제분 먼저, 그다음 학교 수 많은 순
  ? Object.values(typeMap).filter(t => nExams(t) >= 2)
      .sort((a, b) => (hasAnchor(b) - hasAnchor(a)) || (nExams(b) - nExams(a)) || (maxDiff(b) - maxDiff(a)))
  // 기본 모드: 분석한 모든 연도에 빠짐없이 나온 유형
  : Object.values(typeMap).filter(t => nExams(t) >= keys.length && keys.length >= 2)
      .sort((a, b) => maxDiff(b) - maxDiff(a));

const diffBandsArr = ['하', '중', '상', '최상'];
const diffByKey = {};
exams.forEach(e => {
  diffByKey[e.key] = { 하: 0, 중: 0, 상: 0, 최상: 0 };
  e.cells.forEach(c => { const b = diffBand(c.difficulty); if (b) diffByKey[e.key][b]++; });
});

const essays = [];
exams.forEach(e => e.cells.forEach(c => {
  if (isEssay(c.answerType)) essays.push({ label: e.label, anchor: PEER && e === anchorExam, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), diff: diffBand(c.difficulty), score: c.score || null, img: c.img, essay: true, answer: c.answer });
}));
const hard = [];
exams.forEach(e => e.cells.forEach(c => {
  const b = diffBand(c.difficulty);
  if (b === '상' || b === '최상') hard.push({ label: e.label, anchor: PEER && e === anchorExam, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), band: b, essay: isEssay(c.answerType), img: c.img, answer: c.answer });
}));

// ── 요점정리 A: 공부 우선순위 (데이터 기반) ────────────
const repNames = new Set(repeated.map(t => t.name));
let repScoreLatest = 0;
latestExam.cells.forEach(c => { if (repNames.has(clean(c.chapters[3])) && c.score) repScoreLatest += c.score; });
const repPct = unitScoreTotal >= 90 ? Math.round(repScoreLatest / unitScoreTotal * 100) : null;
// 반복 유형별 대표값(최신 연도 기준)
const repRep = repeated.map(t => {
  const mine = t.items.filter(it => isAnchor(it.key));
  const r = mine[0] || t.items[0];
  return { name: t.name, unit: t.unit, score: r.score, diff: r.diff, time: r.time, essay: t.items.some(it => it.essay), count: t.items.length, nEx: nExams(t), mine: !!mine.length };
});

// ── 요점정리 B: 유형별 핵심 개념 ──
// 값이 {text, src} 이면 교재로 근거 확인된 유형(배지 표시), 문자열이면 아직 검수 전 초안.
// 새 유형은 아래에 추가하면 되고, 교재로 확인하면 {text, src} 형태로 바꾼다.
const CONCEPTS = {
  // ── 정비례·반비례 계열 — 「중학 수학 1-1 개념 따라쓰기」로 확인 ──
  '반비례 관계4 (y=a/x에서 a의 값 구하기)': {
    src: '개념 따라쓰기 1-1 · 반비례',
    text: '반비례 관계는 y=a/x, 곧 xy=a(a는 0이 아닌 일정한 수)이다. 그래프나 표에서 지나는 점 (x, y) 하나만 알면 그 둘을 곱해 a = x × y로 상수 a가 바로 나온다. 교재대로 "y=a/x로 놓고 지나는 점의 좌표를 대입"하면 된다. 가장 기본 유형이니 실수 없이 득점해야 한다.',
  },
  '반비례 관계7 (y=a/x의 그래프 위의 점의 좌표가 정수인 경우)': {
    src: '개념 따라쓰기 1-1 · 반비례',
    text: '반비례에서는 곱 xy가 항상 a로 일정하다(xy=a). 따라서 y=a/x 위의 점 중 x, y가 모두 정수인 점은 곱이 a가 되는 정수쌍 (x, y)뿐이고, 그 개수는 a의 약수 개수와 같다. 음수쌍(음의 약수)도 빠뜨리지 말 것 — 예로 a=6이면 (1,6)(2,3)(3,2)(6,1)과 그 음수쌍까지 센다.',
  },
  '반비례 관계9 (y=ax, y=a/x의 그래프가 만나는 점)': {
    src: '개념 따라쓰기 1-1 · 정비례·반비례',
    text: '정비례 y=ax는 원점을 지나는 직선, 반비례 y=b/x는 원점에 대칭인 한 쌍의 곡선이다. 두 그래프의 교점은 두 식을 연립 — ax=b/x → x²=b/a. 교점은 원점에 대해 대칭인 두 점이 된다. 한 교점의 좌표가 주어지면 대입해 상수를 구한다. "두 그래프가 만나는 점"이 나오면 연립을 떠올린다.',
  },
  '두 점 사이의 거리2 (관계식이 주어진 두 점)': {
    src: '개념 따라쓰기 1-1 · 좌표와 그래프',
    text: '정비례(y=ax)·반비례(y=a/x) 식이 주어지면 x값을 대입해 그래프 위 점의 좌표를 먼저 구한다. 반비례는 xy=a를 이용하면 좌표가 빨리 나온다. 두 점이 같은 세로선(x가 같음) 또는 가로선(y가 같음) 위에 있으면 두 점 사이의 거리는 좌표의 차이다. 좌표를 식으로 정확히 구하는 것이 첫걸음.',
  },
  // ── 도형 계열 — 1-2 교재 확인 대기(현재는 검수 전 초안) ──
  '삼각형의 결정조건1 (기본 조건)': '삼각형이 하나로 정해지는 경우는 딱 셋 — ① 세 변, ② 두 변과 그 끼인각, ③ 한 변과 그 양 끝 각. 세 각만 주면 크기가 안 정해지고, 두 변과 "끼인각이 아닌" 각을 주면 삼각형이 두 개 생길 수 있어 안 된다. 세 변으로 줄 때는 (가장 긴 변) < (나머지 두 변의 합)을 만족해야 삼각형이 만들어진다.',
  '간단한 도형의 작도4 (평행선의 작도)': '"동위각(또는 엇각)이 같으면 두 직선은 평행하다"는 성질을 거꾸로 이용한다. 주어진 직선의 각과 크기가 같은 각을 다른 점에 컴퍼스로 옮겨 그리면 그 점을 지나는 평행선이 작도된다. 바탕이 되는 것은 "크기가 같은 각 옮기기" 작도. 작도 순서와 "왜 평행한가"의 근거를 설명하는 문제가 나온다.',
  '삼각형의 합동의 활용1 (정삼각형)': '정삼각형은 세 변이 모두 같고 세 각이 모두 60°. 이 성질로 두 삼각형이 SAS(두 변과 끼인각) 합동임을 보이는 문제가 단골이다. 합동이 증명되면 대응하는 변·각이 같음을 이용해 값을 구한다. 서술형으로 자주 나오므로 "어떤 합동조건(SSS·SAS·ASA)인지"를 근거로 쓰는 연습이 중요.',
  '위치 관계6 (직선과 평면)': '공간에서 두 직선·직선과 평면·두 평면의 관계를 따진다. 핵심은 "꼬인 위치" — 만나지도 평행하지도 않는(한 평면에 없는) 경우. 직육면체 그림에서 한 모서리를 기준으로 평행·수직·꼬인 위치 모서리의 개수를 정확히 세는 연습이 필수다.',

  // ── 중2-2 도형 계열 — 교재 확인 대기(현재는 검수 전 초안) ──
  '이등변삼각형8 (꼭지각의 이등분선)': '이등변삼각형에서 꼭지각의 이등분선은 밑변을 수직이등분한다. 즉 이 선 하나가 "각의 이등분선 · 밑변의 수직선 · 밑변의 중선" 세 역할을 동시에 한다. 그래서 밑변의 절반 길이와 직각을 한 번에 얻을 수 있고, 이어서 합동이나 피타고라스로 연결하면 된다.',
  '이등변삼각형11 (증명)': '서술형 단골이다. "이등변삼각형의 두 밑각의 크기는 같다"를 꼭지각의 이등분선을 보조선으로 긋고 SAS 합동으로 증명하는 흐름을 통째로 쓸 수 있어야 한다. 가정 → 보조선 → 합동조건 제시 → 대응각(대응변)이 같음 → 결론 순서로 쓰고, 어떤 합동조건인지 반드시 밝힌다.',
  '이등변삼각형4 (합동인 삼각형 찾기)': '그림 속에서 합동인 두 삼각형을 골라내는 문제다. 이등변삼각형의 "두 변이 같다 + 두 밑각이 같다"를 조건으로 삼아 SAS나 ASA를 만든다. 공통인 변, 맞꼭지각처럼 그림에 표시돼 있지 않은 조건을 스스로 찾아내는 것이 관건이다.',
  '이등변삼각형9 (이등변삼각형이 되는 조건 이용하기)': '두 각의 크기가 같은 삼각형은 이등변삼각형이다(성질의 역). 각을 계산해 같은 각 두 개를 찾아내면 "그러므로 두 변의 길이가 같다"로 넘어가 길이를 구할 수 있다. 종이 접기나 평행선의 엇각이 나오는 문제에서 특히 자주 쓰인다.',
  '직각삼각형1 (합동조건)': '직각삼각형에는 일반 삼각형의 SSS·SAS·ASA 말고 두 가지 합동조건이 더 있다 — RHA(빗변과 한 예각), RHS(빗변과 다른 한 변). 그림에서 직각 표시와 빗변을 먼저 찾고, 같은 표시가 된 변·각을 대응시켜 어느 조건인지 판단한다.',
  '직각삼각형3 (RHS합동)': '빗변(H)과 다른 한 변(S)이 각각 같은 두 직각삼각형은 합동이다. "각의 이등분선 위의 점에서 두 변에 내린 수선의 길이가 같다"를 증명할 때 가장 많이 쓰인다. 직각 · 빗변 · 나머지 한 변, 이 세 가지를 그림에 표시해 두고 조건을 확인하자.',
  '직각삼각형5 (각의 이등분선의 성질의 활용)': '각의 이등분선 위의 점에서 두 변에 내린 수선의 길이는 서로 같다(RHA 합동으로 증명된다). 거꾸로 두 수선의 길이가 같으면 그 점은 각의 이등분선 위에 있다. 이 성질로 길이를 옮겨 놓고 넓이나 둘레를 구하는 문제로 이어진다.',
  '외심1 (뜻과 성질)': '외심 O는 세 변의 수직이등분선의 교점이고, 세 꼭짓점까지의 거리가 같다(OA=OB=OC=외접원의 반지름). 그래서 OA·OB·OC를 그으면 이등변삼각형 세 개가 생겨 밑각이 짝을 이룬다. 여기서 ∠BOC=2∠A가 나온다. "직각삼각형의 외심은 빗변의 중점"도 반드시 함께 외운다.',
  '내심1 (뜻과 성질)': '내심 I는 세 내각의 이등분선의 교점이고, 세 변까지의 거리가 같다(그 거리가 내접원의 반지름 r). IA·IB·IC를 그으면 각이 둘씩 이등분되므로, 삼각형의 내각의 합 180°와 엮어 각을 구하는 것이 기본 풀이다.',
  '내심4 (각BIC=90도+각A/2)': '내심에서는 ∠BIC = 90° + ½∠A 가 성립한다. 삼각형 IBC에서 ∠IBC+∠ICB = ½(∠B+∠C) = ½(180°−∠A)이므로 자연스럽게 유도된다. 외심의 ∠BOC = 2∠A 와 짝지어 외우면 둘을 헷갈리지 않는다.',
  '내심6 (내접원에서 넓이 구하기)': '삼각형의 넓이 S, 내접원의 반지름 r, 둘레의 길이 l 사이에는 S = ½ × r × l 이 성립한다(내심에서 세 꼭짓점을 이어 삼각형 세 개로 쪼개면 바로 나온다). 직각삼각형이면 r = (두 직각변의 합 − 빗변) ÷ 2 도 자주 쓰인다.',
  '내심9 (외심과 내심)': '외심과 내심을 비교하는 문제다. 외심 = 세 변의 수직이등분선의 교점, 세 꼭짓점까지 거리가 같다, ∠BOC=2∠A. 내심 = 세 내각의 이등분선의 교점, 세 변까지 거리가 같다, ∠BIC=90°+½∠A. "어느 선의 교점인가 / 무엇까지의 거리가 같은가"를 표로 짝지어 정리해 두자.',
  '평행사변형이 되는 조건1 (기본)': '평행사변형이 되는 조건은 다섯 가지다 — ① 두 쌍의 대변이 각각 평행 ② 두 쌍의 대변의 길이가 각각 같다 ③ 두 쌍의 대각의 크기가 각각 같다 ④ 두 대각선이 서로 다른 것을 이등분한다 ⑤ 한 쌍의 대변이 평행하고 그 길이가 같다. "한 쌍은 평행, 다른 한 쌍은 길이가 같다"는 조건이 아니라는 점(등변사다리꼴이 될 수 있다)이 대표적인 함정이다.',
  '평행사변형이 되는 조건4 (평행사변형이 되기 위한 조건의 활용)': '평행사변형이 되는 다섯 가지 조건(대변이 각각 평행 / 대변의 길이가 각각 같다 / 대각의 크기가 각각 같다 / 두 대각선이 서로 다른 것을 이등분 / 한 쌍의 대변이 평행하고 길이가 같다) 중 어느 것을 만족하는지 찾아 "평행사변형이다"를 결론짓는 문제다. 평행사변형의 대각선 위에 같은 길이를 잡아 만든 새 사각형이 다시 평행사변형이 됨을 보이는 유형이 대표적 — 보통 조건 ④(두 대각선이 서로 다른 것을 이등분)를 쓴다.',
  '평행선과 넓이3 (평행사변형에서 높이가 같은 두 삼각형의 넓이)': '평행선 사이에 있는 두 삼각형은 밑변의 길이가 같으면 높이도 같으므로 넓이가 같다. 평행사변형은 한 대각선으로 넓이가 2등분, 두 대각선으로 4등분된다는 성질과 함께 나온다. 넓이를 일일이 계산하지 말고 "같은 넓이를 옮겨 붙이기"로 접근하는 것이 핵심이다.',
  '사각형 사이의 관계1 (사각형의 판별)': '평행사변형에 조건이 하나 붙으면 특별한 사각형이 된다 — "이웃한 두 변의 길이가 같다" 또는 "두 대각선이 수직"이면 마름모, "한 내각이 직각" 또는 "두 대각선의 길이가 같다"면 직사각형, 둘 다면 정사각형. 어떤 조건이 어떤 사각형을 만드는지 표로 정리해 외워야 한다.',
  '사각형 사이의 관계2 (사각형 사이의 관계)': '사각형들의 포함 관계를 묻는다. 정사각형은 직사각형이면서 마름모이고, 직사각형과 마름모는 모두 평행사변형이며, 평행사변형은 사다리꼴이다. "항상 옳은가"를 묻는 참·거짓 문제로 나오므로, 틀린 보기에 대해 반례를 떠올리는 연습이 중요하다(예: 마름모라고 해서 직사각형인 것은 아니다).',
  '정사각형2 (뜻과 성질의 활용)': '정사각형은 네 변의 길이가 모두 같고 네 각이 모두 직각이므로, 직사각형의 성질과 마름모의 성질을 모두 갖는다. 따라서 두 대각선은 길이가 같으면서 서로를 수직이등분한다. 정사각형 안에서 합동인 삼각형을 찾아 각도나 길이를 구하는 문제가 대표적이다.',
  '피타고라스 정리1 (직각삼각형을 이용한 변의 길이)': '직각삼각형에서 (빗변)² = (다른 두 변의 제곱의 합). 빗변이 어느 변인지 — 직각과 마주 보는 변 — 를 먼저 확정하는 것이 실수를 막는 핵심이다. 3:4:5, 5:12:13, 8:15:17 같은 정수비를 외워 두면 계산이 훨씬 빨라진다.',
  '삼각형의 닮음 조건3 (SAS닮음)': '두 쌍의 대응변의 길이의 비가 같고, 그 <끼인각>의 크기가 같으면 두 삼각형은 닮음이다(SAS닮음). 끼인각이 아닌 각이 같다고 해서는 성립하지 않으니 반드시 확인할 것. 실제 문제에서는 공통인 각이나 맞꼭지각이 그 끼인각 역할을 하는 경우가 대부분이다.',
  '직각삼각형의 닮음3 (직각을 낀 변의 길이의 제곱)': '직각삼각형에서 직각인 꼭짓점에서 빗변에 수선을 내리면 큰 삼각형과 작은 삼각형 두 개가 모두 닮음이 된다. 여기서 세 관계식이 나온다 — (직각을 낀 한 변)² = (빗변) × (그 변 쪽 빗변 조각), (수선의 길이)² = (빗변의 두 조각의 곱). 그림과 함께 통째로 외워 두면 바로 대입해서 풀 수 있다.',
  '넓이의 비2 (사각형에서 삼각형의 닮음비 이용)': '닮음비가 m:n이면 넓이의 비는 m²:n²이다. 사다리꼴이나 평행사변형에서 대각선·평행선으로 생긴 두 삼각형이 AA닮음임을 먼저 찾고, 대응변의 비로 닮음비를 구한 뒤 제곱해 넓이의 비를 얻는다. "높이가 같은 두 삼각형은 밑변의 비 = 넓이의 비"도 함께 쓰인다.',
  '평행사변형의 정의1 (기본)': '평행사변형의 정의는 "두 쌍의 대변이 각각 평행". 여기서 세 가지 성질이 따라 나온다 — 두 쌍의 대변의 길이가 같다, 두 쌍의 대각의 크기가 같다, 두 대각선이 서로 다른 것을 이등분한다. 이웃한 두 각의 합이 180°라는 것도 각을 구할 때 자주 쓴다. 가장 기본 유형이니 실수 없이 득점해야 한다.',
  '피타고라스 정리8 (조건에 따른 변의 길이)': '직각삼각형이 두 개 이상 겹쳐 있는 그림에서 나온다. 두 삼각형이 함께 쓰는 <공통인 변>을 다리로 삼아 피타고라스 정리를 두 번 적용하는 것이 정석이다. 구하려는 길이를 x로 놓고, 같은 선분을 두 가지 식으로 표현해 방정식을 세운다. 종이접기 문제도 접힌 변의 길이가 같다는 점을 이용한 같은 방식이다.',
  '피타고라스 정리9 (변의 길이에 따른 삼각형의 종류)': '세 변 중 <가장 긴 변>을 c, 나머지를 a·b라 할 때 — c² = a²+b² 이면 직각삼각형, c² < a²+b² 이면 예각삼각형, c² > a²+b² 이면 둔각삼각형이다. 가장 긴 변을 먼저 찾는 것이 실수를 막는 핵심. 애초에 삼각형이 되는지(가장 긴 변 < 나머지 두 변의 합)도 함께 확인한다.',
  '닮음의 성질 활용2 (입체도형)': '닮음비가 m:n이면 겉넓이의 비는 m²:n², 부피의 비는 m³:n³ 이다. 원뿔이나 각뿔을 밑면에 평행하게 자른 문제가 단골 — 잘라 낸 위쪽 작은 뿔과 원래 뿔이 닮음이므로 그 비로 부피를 구한 뒤, 전체에서 빼서 뿔대의 부피를 얻는다.',
};

// 한눈에 보기 — 자동 요약 3줄
const topUnit = unitSet[0];
const topShare = unitScoreTotal >= 90 ? Math.round((unitScore[topUnit] || 0) / unitScoreTotal * 100) : null;
// 서술형 단원은 우리 학교 시험 기준으로 먼저 본다
const myEssays = PEER ? essays.filter(e => e.anchor) : [];
const essayUnits = [...new Set((myEssays.length ? myEssays : essays).map(e => e.unit))];
const mineRepN = repRep.filter(r => r.mine).length;
const highlights = [
  `<b>${esc(topUnit)}</b> 단원이 가장 큰 비중${topShare ? ` — ${PEER ? esc(SCHOOL) + ' ' : ''}${latest}년 배점의 <b>${topShare}%</b>` : ''}`,
  PEER
    ? (OWN
        ? `${esc(SCHOOL)} 시험지 <b>2회 이상</b>에 반복된 세부유형 <b>${repeated.length}개</b> (그중 ${esc(latest)}년 ${esc(TERM)}고사에 나온 것 <b>${mineRepN}개</b>)`
        : `${exams.length}개 시험지 중 <b>2곳 이상</b>에서 반복된 세부유형 <b>${repeated.length}개</b> (그중 ${esc(SCHOOL)}에 실제 출제된 것 <b>${mineRepN}개</b>)`)
    : `${keys.length}개년 모두 출제된 세부유형 <b>${repeated.length}개</b> — 올해도 나올 가능성이 가장 높은 목록`,
  (myEssays.length ? myEssays : essays).length
    ? `서술형은 <b>${esc(essayUnits[0])}</b>${essayUnits.length > 1 ? ' 등' : ''}에서 반복 출제`
    : '서술형 출제 없음',
];

// ── HTML 조각 ─────────────────────────────────────────
const PAL = ['#eb6834', '#7c5cd6', '#0f9d76', '#c2185b'];
const YCOLOR = {};
if (PEER) { let pi = 0; keys.forEach(k => { YCOLOR[k] = isAnchor(k) ? 'var(--s1)' : PAL[pi++ % PAL.length]; }); }
else { YCOLOR[latest] = 'var(--s1)'; if (keys.length >= 2) YCOLOR[keys[keys.length - 2]] = 'var(--s2)'; }
const labelOf = {}; exams.forEach(e => { labelOf[e.key] = e.label; });
const maxUnitN = Math.max(...unitSet.map(u => Math.max(...keys.map(k => (unitByKey[k] || {})[u] || 0))));

function barRow(label, rows, maxV, unitTxt) {
  let h = `<div class="brow"><div class="blab">${esc(label)}</div><div class="bars">`;
  rows.forEach(r => {
    const w = maxV && r.v ? Math.max(2, Math.round(r.v / maxV * 100)) : 0;
    h += `<div class="bline"><span class="byr${r.anchor ? ' me' : ''}">${esc(r.name)}</span><div class="btrack"><div class="bfill" style="width:${w}%;background:${r.color}"></div></div><span class="bval">${r.v}${unitTxt}</span></div>`;
  });
  return h + '</div></div>';
}
// 계열(연도 또는 학교) 한 줄 데이터 만들기
const seriesRows = pick => keys.map(k => ({ name: labelOf[k], anchor: PEER && isAnchor(k), v: pick(k), color: YCOLOR[k] || 'var(--s1)' }));

let unitBars = '';
unitSet.forEach(u => {
  unitBars += barRow(u, seriesRows(k => (unitByKey[k] || {})[u] || 0), maxUnitN, '문항');
});

let scoreBars = '';
if (unitScoreTotal >= 90) {
  unitSet.forEach(u => {
    const v = unitScore[u] || 0;
    const w = v ? Math.max(2, Math.round(v / unitScoreTotal * 100)) : 0;
    scoreBars += `<div class="brow"><div class="blab">${esc(u)} <span class="bpct">${Math.round(v / unitScoreTotal * 100)}%</span></div><div class="bars"><div class="bline"><div class="btrack"><div class="bfill" style="width:${w}%;background:var(--s1)"></div></div><span class="bval">${v}점</span></div></div></div>`;
  });
}

let diffBars = '';
{
  const maxD = Math.max(...keys.map(k => Math.max(...diffBandsArr.map(b => diffByKey[k][b] || 0))));
  diffBandsArr.forEach(b => {
    const rows = seriesRows(k => diffByKey[k][b] || 0);
    if (rows.every(r => !r.v)) return;
    diffBars += barRow(b, rows, maxD, '문항');
  });
}

const pillD = d => { const b = diffBand(d); return b ? `<span class="pill p-${b === '하' ? 'lo' : b === '중' ? 'md' : 'hi'}">${b}</span>` : ''; };
// 이미지는 임베드 모드(--embed)에서만 넣는다. 비임베드(공개 링크)에서는
// CDN 직접 링크가 로그인 없이는 안 열려 깨지므로 아예 표시하지 않는다.
const probImg = (it, label, mine) => {
  if (!it.img || !EMBED) return '';
  const src = imgSrc(it.img);
  if (src === it.img) return '';   // 로컬 파일이 없어 CDN 원주소로 떨어진 경우 → 표시 안 함
  // 정답 배지 — 객관식은 기호(①~⑤), 서술형은 LaTeX라 "서술형"으로 표기
  const ans = it.answer ? (it.essay ? '서술형' : esc(String(it.answer))) : '';
  const cap = `${mine ? '★ ' : ''}${esc(label)}${ans ? ` <span class="ans">정답 ${ans}</span>` : ''}`;
  // base64 인라인이므로 loading="lazy" 안 씀 — 일부 파일 뷰어가 스크롤 로드를 안 걸어
  // 아래쪽 이미지가 빈 채로 보이던 문제를 막는다.
  return `<figure class="prob${mine ? ' mine' : ''}"><figcaption>${cap}</figcaption><img src="${src}" alt="문제"></figure>`;
};

const repCards = repeated.map((t, i) => {
  const byKey = {};
  t.items.forEach(it => (byKey[it.key] = byKey[it.key] || []).push(it));
  const meta = t.items.some(it => it.essay) ? ' <span class="pill p-es">서술형 출제</span>' : '';
  // 비교 모드: "우리 학교 출제" 여부와 몇 개 학교에서 나왔는지를 배지로
  const peerMeta = PEER
    ? `${hasAnchor(t) ? `<span class="pill p-me">★ ${OWN ? esc(latest) + '년 출제' : esc(SCHOOL) + ' 출제'}</span>` : ''}<span class="pill p-nx">${nExams(t)}개 시험지</span>`
    : '';
  const maxD = Math.max(...t.items.map(it => it.diff || 0));
  let imgs = '';
  keys.forEach(k => (byKey[k] || []).forEach(it => {
    imgs += probImg(it, `${it.label} · ${it.no}번${it.score ? ` · ${it.score}점` : ''}`, PEER && isAnchor(it.key));
  }));
  return `<div class="repcard${PEER && hasAnchor(t) ? ' mine' : ''}">
    <div class="rephead"><span class="repno">${i + 1}</span>
      <div><div class="repname">${esc(t.name)}</div><div class="repunit">${esc(t.unit)}</div></div>
      <div class="repmeta">${peerMeta}${pillD(maxD)}${meta}</div></div>
    ${imgs ? `<div class="probs">${imgs}</div>` : ''}
  </div>`;
}).join('');

const srcCell = e => `<td${e.anchor ? ' class="me"' : ''}>${esc(e.label)}</td>`;
const hardRows = hard.map(e => `<tr>${srcCell(e)}<td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td><span class="pill p-hi">${e.band}</span>${e.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td></tr>`).join('');
const hardImgs = hard.map(e => probImg(e, `${e.label} · ${e.no}번 · ${e.type}`, e.anchor)).join('');
const essayRows = essays.map(e => `<tr>${srcCell(e)}<td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td>${e.diff || '-'}${e.score ? ` · ${e.score}점` : ''}</td></tr>`).join('');
const essayImgs = essays.map(e => probImg(e, `${e.label} · ${e.no}번 · ${e.type}`, e.anchor)).join('');

// 요점정리 A — 공부 우선순위 표
const bandPill = b => b ? `<span class="pill p-${b === '하' ? 'lo' : b === '중' ? 'md' : 'hi'}">${b}</span>` : '-';
const strategyRows = repRep.map((r, i) => `<tr>
  <td><span class="repno sm">${i + 1}</span></td>
  <td><b>${esc(r.name)}</b></td>
  <td>${esc(r.unit)}</td>${PEER ? `
  <td>${r.mine ? `<span class="pill p-me">★ ${OWN ? esc(latest) + '년' : esc(SCHOOL)}</span>` : ''}<span class="pill p-nx">${r.nEx}개 시험지</span></td>` : ''}
  <td>${r.score ? r.score + '점' : '-'}</td>
  <td>${bandPill(diffBand(r.diff))}</td>
  <td>${r.time ? r.time + '분' : '-'}${r.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td>
</tr>`).join('');

// 요점정리 B — 유형별 핵심 개념
const conceptCards = repRep.map((r, i) => {
  const c = CONCEPTS[r.name];
  const text = c ? (typeof c === 'string' ? c : c.text) : null;
  const badge = c && typeof c === 'object' && c.src
    ? `<span class="pill p-lo" title="교재로 근거 확인됨">📖 ${esc(c.src)}</span>`
    : (text ? '<span class="pill p-md" title="교재 확인 전 초안">✎ 교재 확인 대기</span>' : '');
  return `<div class="concept">
    <div class="chd"><span class="repno sm">${i + 1}</span>
      <div><div class="repname">${esc(r.name)}</div><div class="repunit">${esc(r.unit)}</div></div>
      <div class="cbadge">${badge}</div></div>
    <p class="cbody">${text ? esc(text) : '<span style="color:var(--mut)">핵심 정리 준비 중입니다.</span>'}</p>
  </div>`;
}).join('');

const tiles = perExam.map(p => `
  <div class="tile${p.anchor ? ' me' : ''}"><div class="tyear">${p.anchor && PEER ? '★ ' : ''}${esc(p.label)}</div>
    <div class="tv">${p.n}<span class="tu">문항</span></div>
    <div class="ts">객관식 ${p.choice} · 서술형 ${p.essay}${p.total ? ` · ${p.total}점 만점` : ''}</div>
  </div>`).join('');

const scopeTxt = SCOPE ? esc(SCOPE) : (anchorExam.scopes || []).map(esc).join('<br>');
const legend = keys.map(k => `<span class="lg"><i style="background:${YCOLOR[k] || 'var(--s1)'}"></i>${isAnchor(k) && PEER ? '★ ' : ''}${esc(labelOf[k])}</span>`).join('');
const today = new Date().toISOString().slice(0, 10);
const title = `${SCHOOL} ${GRADE} ${SEM}학기 ${TERM}고사`;

// 표지 부제 · 자료 출처 안내
const peerNames = exams.filter(e => e !== anchorExam).map(e => e.label);
const coverSub = !PEER
  ? `${keys.map(k => k + '년').join(' · ')} 실제 기출 ${exams.length}회분 · ${totalN}문항 완전 분석`
  : OWN
    ? `${esc(SCHOOL)} 기출 ${exams.length}회분에서 이 시험 범위 문항 ${totalN}개 분석`
    : `${esc(SCHOOL)} ${latest}년 기출 + 인근 ${new Set(exams.filter(e => e !== anchorExam).map(e => e.school)).size}개교 ${peerNames.length}회분 · 총 ${totalN}문항 분석`;
const srcBox = !PEER ? '' : OWN ? `<div class="srcbox">
  <b>📌 이 자료를 읽는 법</b><br>
  ${esc(SCHOOL)}은 해에 따라 이 범위를 <b>2학기 중간</b>에 내기도 하고 <b>2학기 기말</b>에 내기도 했습니다.
  그래서 ${esc(latest)}년 ${esc(SEM)}학기 ${esc(TERM)}고사 범위에 해당하는 문항을
  <b>${esc(peerNames.join(', '))}</b> 시험지에서도 모두 골라내 함께 분석했습니다.<br>
  <b>여기 나오는 문제는 전부 ${esc(SCHOOL)}이 실제로 낸 문제</b>이고,
  <b>★ 표시가 ${esc(latest)}년 ${esc(SEM)}학기 ${esc(TERM)}고사</b>입니다.
</div>` : `<div class="srcbox">
  <b>📌 이 자료를 읽는 법</b><br>
  ${esc(SCHOOL)}의 ${GRADE} ${SEM}학기 ${TERM}고사 기출은 현행 교육과정 기준으로 <b>${latest}년 1회분</b>만 확보돼 있습니다.
  (그 이전 시험지는 교육과정이 달라 시험 범위 자체가 다릅니다.)<br>
  그래서 같은 학군의 <b>${esc(peerNames.join(', '))}</b> 같은 시험을 함께 분석했습니다.
  <b>★ 표시가 ${esc(SCHOOL)} 실제 기출</b>이고, 나머지는 "이 범위에서 어떤 유형이 반복되는가"를 보는 근거입니다.
</div>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} 수학 출제경향 — 루멘수학</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{--s1:#2a78d6;--s2:#eb6834;--navy:#14274e;--ink:#101418;--ink2:#4b5563;--mut:#8a92a0;--bg:#eef1f6;--card:#ffffff;--line:#e3e7ee}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:0 16px 70px}
/* 표지 */
.cover{background:linear-gradient(135deg,#14274e 0%,#1d3a6e 60%,#24549e 100%);color:#fff;border-radius:0 0 26px 26px;padding:44px 34px 36px;margin:0 -16px 26px;position:relative;overflow:hidden}
.cover::after{content:'';position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.06)}
.cbrand{font-size:13px;font-weight:900;letter-spacing:2.5px;color:#9fc1f5}
.ctitle{font-size:31px;font-weight:900;line-height:1.28;margin:10px 0 4px}
.csub{font-size:16px;font-weight:500;color:#c9d8f2}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.chip{font-size:12px;font-weight:700;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:99px;padding:4px 12px}
/* 한눈에 보기 */
.hl{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--s1);border-radius:14px;padding:16px 20px;margin-bottom:26px;box-shadow:0 1px 4px rgba(20,39,78,.05)}
.hl h2{font-size:14px;font-weight:900;color:var(--s1);letter-spacing:1px;margin-bottom:8px}
.hl li{margin:5px 0 5px 20px;font-size:14.5px}
/* 섹션 */
.sec{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(20,39,78,.05)}
.shead{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.snum{font-size:12px;font-weight:900;color:#fff;background:var(--navy);border-radius:7px;padding:2px 8px;flex:none}
h2.st{font-size:17.5px;font-weight:900}
.desc{font-size:13px;color:var(--ink2);margin:2px 0 16px}
.tiles{display:flex;gap:12px;flex-wrap:wrap}
.tile{flex:1;min-width:150px;background:linear-gradient(180deg,#f7f9fd,#eef3fb);border:1px solid var(--line);border-radius:13px;padding:14px 16px}
.tyear{font-size:12px;font-weight:800;color:var(--s1)}
.tv{font-size:30px;font-weight:900;letter-spacing:-.5px}.tu{font-size:13px;font-weight:600;color:var(--ink2);margin-left:3px}
.ts{font-size:12px;color:var(--ink2)}
.scope{font-size:13px;background:#f7f9fd;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin-top:12px}
.note{font-size:12px;color:var(--mut);margin-top:10px}
.legend{display:flex;gap:14px;margin-bottom:14px;font-size:12.5px;color:var(--ink2);font-weight:600}
.lg i{display:inline-block;width:11px;height:11px;border-radius:3.5px;margin-right:5px;vertical-align:-1px}
.brow{margin-bottom:15px}
.blab{font-size:14px;font-weight:800;margin-bottom:5px}
.bpct{font-size:12px;font-weight:800;color:var(--s1);margin-left:4px}
.bline{display:flex;align-items:center;gap:9px;margin-bottom:4px}
.byr{font-size:11px;color:var(--mut);width:${PEER ? 96 : 44}px;text-align:right;flex:none;font-weight:600}
.btrack{flex:1;height:15px;background:#edf0f5;border-radius:5px;overflow:hidden}
.bfill{height:100%;border-radius:0 5px 5px 0}
.bval{font-size:12px;color:var(--ink2);width:64px;flex:none;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-size:11.5px;color:var(--mut);text-align:left;padding:6px 8px;border-bottom:2px solid var(--line);font-weight:800;letter-spacing:.3px}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.pill{display:inline-block;font-size:11px;font-weight:800;padding:1px 9px;border-radius:99px}
.p-lo{background:#e6f6ee;color:#0f7a48}.p-md{background:#fff3dd;color:#9c6200}.p-hi{background:#fdeaea;color:#c22}.p-es{background:#edeafd;color:#5747c9}
.p-me{background:var(--s1);color:#fff}.p-nx{background:#eef1f6;color:#4b5563}
/* 우리 학교(기준 시험) 강조 */
.byr.me{color:var(--s1);font-weight:900}
td.me{color:var(--s1);font-weight:800}
.tile.me{background:linear-gradient(180deg,#e9f1fd,#dbe8fb);border-color:#b9d2f4}
.repcard.mine{border-color:#b9d2f4;box-shadow:0 0 0 2px rgba(42,120,214,.10)}
.repcard.mine .rephead{background:#eef4fd}
.prob.mine{border-color:#b9d2f4}
.prob.mine figcaption{background:#e9f1fd;color:var(--s1)}
.srcbox{background:#f7f9fd;border:1px solid var(--line);border-radius:12px;padding:13px 16px;font-size:13px;color:var(--ink2);margin-bottom:20px;line-height:1.75}
.srcbox b{color:var(--ink)}
/* 반복 유형 카드 */
.repcard{border:1px solid var(--line);border-radius:14px;margin-bottom:14px;overflow:hidden}
.rephead{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#f7f9fd;border-bottom:1px solid var(--line)}
.repno{width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;flex:none}
.repname{font-size:15px;font-weight:900}
.repunit{font-size:12px;color:var(--mut)}
.repmeta{margin-left:auto;display:flex;gap:6px;align-items:center;flex:none}
.probs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;padding:14px 16px}
.prob{border:1px solid var(--line);border-radius:10px;background:#fff;overflow:hidden}
.prob figcaption{font-size:11.5px;font-weight:800;color:var(--ink2);background:#f2f5fa;padding:5px 10px;border-bottom:1px solid var(--line)}
.ans{display:inline-block;background:#e6f6ee;color:#0f7a48;font-weight:800;border-radius:5px;padding:0 6px;margin-left:2px}
.repno.sm{width:22px;height:22px;font-size:12px}
/* 요점정리 */
.hlstat{background:#eef4fd;border:1px solid #cfe0f7;border-radius:11px;padding:12px 16px;font-size:14.5px;margin-bottom:14px}
.hlstat b{color:var(--s1)}
.concept{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.concept .chd{display:flex;align-items:center;gap:11px;margin-bottom:8px}
.cbadge{margin-left:auto;flex:none}
.cbody{font-size:14px;color:var(--ink2);line-height:1.75}
.prob img{display:block;width:100%;height:auto;padding:8px;background:#fff}
.prob.broken{display:none}
/* 이미지 안내 배너 */
#imgwarn{display:none;background:#fff8e6;border:1px solid #f2d78a;color:#8a6100;font-size:13px;border-radius:12px;padding:12px 16px;margin-bottom:18px}
/* 대비 포인트 */
.final{background:linear-gradient(135deg,#14274e,#24549e);color:#fff;border-radius:16px;padding:22px 24px;margin-bottom:20px}
.final h2{font-size:16px;font-weight:900;margin-bottom:10px}
.final li{margin:7px 0 7px 20px;font-size:14px;color:#dfe9fb}
.final b{color:#fff}
.foot{font-size:11.5px;color:var(--mut);text-align:center;margin-top:28px;line-height:1.8}
@media print{
  body{background:#fff}.wrap{padding:0}
  .cover{border-radius:0;margin:0 0 20px}
  .sec,.repcard{break-inside:avoid;box-shadow:none}
  #imgwarn{display:none!important}
}
</style></head><body>
<div class="wrap">
  <div class="cover">
    <div class="cbrand">LUMEN MATH · 루멘수학</div>
    <div class="ctitle">${esc(title)}<br>수학 출제경향 분석</div>
    <div class="csub">${coverSub}</div>
    <div class="chips"><span class="chip">📅 ${today}</span><span class="chip">📚 근거: 기출 문항 DB</span><span class="chip">🏫 ${esc(SCHOOL)}</span></div>
  </div>

  <div id="imgwarn">⚠️ 일부 문제 이미지가 표시되지 않았습니다. 수학비서 이미지 서버 접근이 제한된 네트워크일 수 있어요 — 다른 기기(휴대폰 데이터 등)에서 다시 열어보세요.</div>

  <div class="hl"><h2>한눈에 보기</h2><ul>${highlights.map(h => `<li>${h}</li>`).join('')}</ul></div>
${srcBox ? '\n  ' + srcBox + '\n' : ''}
  <div class="sec"><div class="shead"><span class="snum">01</span><h2 class="st">시험 개요</h2></div>
    <div class="desc">${!PEER ? `최근 ${exams.length}개년 실제 시험지의 문항 구성입니다.`
      : OWN ? `분석에 쓴 ${esc(SCHOOL)} 시험지 ${exams.length}회분입니다. 기말 시험지는 <b>이 시험 범위에 해당하는 문항만</b> 세었습니다. <b>★</b>가 기준이 되는 ${esc(latest)}년 시험입니다.`
      : `분석에 쓴 시험지 ${exams.length}회분의 문항 구성입니다. <b>★</b>가 ${esc(SCHOOL)} 기출입니다.`}</div>
    <div class="tiles">${tiles}</div>
    ${scopeTxt ? `<div class="note">시험 범위 (${esc(latest)}년 기준)</div><div class="scope">${scopeTxt}</div>` : ''}
  </div>

  <div class="sec"><div class="shead"><span class="snum">02</span><h2 class="st">단원별 출제 비중</h2></div>
    <div class="desc">단원마다 몇 문항이 나왔는지 ${PEER ? '시험지별로' : '연도별로'} 비교했습니다.</div>
    <div class="legend">${legend}</div>
    ${unitBars}
  </div>

  ${scoreBars ? `<div class="sec"><div class="shead"><span class="snum">03</span><h2 class="st">단원별 배점 비중 <span style="font-size:13px;color:var(--mut)">(${PEER ? '★ ' + esc(SCHOOL) + ' ' : ''}${esc(latest)}년)</span></h2></div>
    <div class="desc">${PEER ? esc(SCHOOL) + ' 실제 시험에서' : '100점 만점에서'} 단원별로 몇 점이 걸려 있는지입니다.</div>
    ${scoreBars}</div>` : ''}

  <div class="sec"><div class="shead"><span class="snum">04</span><h2 class="st">${PEER ? '반복 출제되는 세부유형' : '매년 반복 출제된 세부유형'}</h2></div>
    <div class="desc">${PEER
      ? (OWN
          ? `${esc(SCHOOL)} 시험지 <b>2회 이상</b>에 등장한 유형입니다. <b>★</b> 배지가 붙은 것이 ${esc(latest)}년 ${esc(SEM)}학기 ${esc(TERM)}고사에 실제로 나왔던 유형 — 여기부터 보세요.`
          : `분석한 ${exams.length}개 시험지 중 <b>2곳 이상</b>에 등장한 유형입니다. <b>★ ${esc(SCHOOL)} 출제</b> 배지가 붙은 것이 우리 학교에 실제로 나왔던 유형 — 여기부터 보세요.`)
      : `분석한 ${exams.length}개년 <b>모두</b>에 등장한 유형입니다. 실제 기출 문제와 함께 확인하세요 — 올해도 나올 가능성이 가장 높은 목록입니다.`}</div>
    ${repCards || '<div class="desc">반복 유형 없음</div>'}
  </div>

  <div class="sec"><div class="shead"><span class="snum">05</span><h2 class="st">난이도 분포</h2></div>
    <div class="desc">문항 난이도를 하·중·상으로 묶었습니다.</div>
    <div class="legend">${legend}</div>
    ${diffBars}
  </div>

  ${hardRows ? `<div class="sec"><div class="shead"><span class="snum">06</span><h2 class="st">고난도 문항 — 변별력이 갈리는 자리</h2></div>
    <div class="desc">난이도 상 이상 문항이 출제된 위치입니다. 상위권 목표라면 이 유형을 집중 대비하세요.</div>
    <table><tr><th>${PEER ? '출처' : '연도'}</th><th>번호</th><th>단원</th><th>세부유형</th><th>비고</th></tr>${hardRows}</table>
    ${!PEER ? '' : OWN
      ? '<div class="note">※ ' + esc(latest) + '년 시험 범위에 해당하는 문항만 모았습니다. <b>★</b> 가 ' + esc(latest) + '년 ' + esc(SEM) + '학기 ' + esc(TERM) + '고사입니다.</div>'
      : '<div class="note">※ 인근 학교는 시험 범위가 조금씩 다릅니다. ' + esc(SCHOOL) + ' 범위 밖 단원이 섞여 있을 수 있으니 <b>★ ' + esc(SCHOOL) + '</b> 행을 먼저 보세요.</div>'}
    ${hardImgs ? `<div class="probs" style="padding:14px 0 0">${hardImgs}</div>` : ''}</div>` : ''}

  ${essayRows ? `<div class="sec"><div class="shead"><span class="snum">07</span><h2 class="st">서술형 출제 위치</h2></div>
    <div class="desc">풀이 과정을 채점하는 서술형이 나온 자리입니다. 답만 맞히는 연습으로는 부족합니다.</div>
    <table><tr><th>${PEER ? '출처' : '연도'}</th><th>번호</th><th>단원</th><th>세부유형</th><th>난이도·배점</th></tr>${essayRows}</table>
    ${!PEER ? '' : OWN
      ? '<div class="note">※ ' + esc(latest) + '년 시험 범위에 해당하는 문항만 모았습니다. <b>★</b> 가 ' + esc(latest) + '년 ' + esc(SEM) + '학기 ' + esc(TERM) + '고사입니다.</div>'
      : '<div class="note">※ 인근 학교는 시험 범위가 조금씩 다릅니다. ' + esc(SCHOOL) + ' 범위 밖 단원이 섞여 있을 수 있으니 <b>★ ' + esc(SCHOOL) + '</b> 행을 먼저 보세요.</div>'}
    ${essayImgs ? `<div class="probs" style="padding:14px 0 0">${essayImgs}</div>` : ''}</div>` : ''}

  <div class="sec"><div class="shead"><span class="snum">08</span><h2 class="st">시험 대비 요점정리 ① — 공부 우선순위</h2></div>
    <div class="desc">${PEER ? '반복 출제되는 유형만 모았습니다. ★ 표시(우리 학교 출제) 유형부터 잡는 것이 가장 효율적입니다.' : '매년 빠짐없이 나온 유형만 모았습니다. 여기부터 완벽히 잡는 것이 가장 효율적입니다.'}</div>
    ${repPct != null ? `<div class="hlstat">${PEER ? `${OWN ? esc(SCHOOL) + '이 반복해서 낸' : '여러 학교에서 반복된'} <b>${repeated.length}개 유형</b> 가운데 ${esc(SCHOOL)} ${esc(latest)}년 시험에 <b>${repScoreLatest}점</b>` : `매년 반복된 <b>${repeated.length}개 유형</b>에서 ${esc(latest)}년 시험 <b>${repScoreLatest}점</b>`}${repPct ? `(전체의 <b>${repPct}%</b>)` : ''}이 출제됐습니다. <b>이것부터</b> 잡으세요.</div>` : ''}
    <table><tr><th>번호</th><th>유형</th><th>단원</th>${PEER ? '<th>출제</th>' : ''}<th>배점</th><th>난이도</th><th>예상 풀이시간</th></tr>${strategyRows}</table>
    <div class="note">배점·난이도·풀이시간은 ${!PEER ? `${esc(latest)}년 기출` : `${esc(latest)}년 ${esc(SEM)}학기 ${esc(TERM)}고사 기준(그 시험에 없던 유형은 ${OWN ? '다른 해 기출' : '인근 학교 기출'})`} 기준입니다. 번호는 아래 개념 정리·반복유형 카드와 같습니다.</div>
  </div>

  <div class="sec"><div class="shead"><span class="snum">09</span><h2 class="st">시험 대비 요점정리 ② — 유형별 핵심 개념</h2></div>
    <div class="desc">위 반복 유형마다 꼭 알아야 할 개념과 접근법입니다. 문제를 풀기 전에 먼저 읽어 두세요.</div>
    ${conceptCards}
  </div>

  <div class="final"><h2>💡 루멘수학 대비 포인트</h2><ul>
    <li><b>${esc(topUnit)}</b> 단원을 가장 먼저, 가장 깊게 — 배점 비중이 제일 큽니다.</li>
    <li>위 <b>반복 유형 ${repeated.length}개</b>는 유사 문제까지 반드시 연습합니다.${PEER ? ` 그중 <b>★ ${OWN ? esc(latest) + '년 출제' : esc(SCHOOL) + ' 출제'} ${mineRepN}개</b>가 1순위입니다.` : ''}</li>
    ${essays.length ? `<li>서술형 대비: <b>${esc(essayUnits.join(', '))}</b>은 풀이 과정을 쓰는 연습까지.</li>` : ''}
    <li>위 <b>요점정리 ①·②</b>대로 우선순위를 잡고, 반복 유형은 유사 문제까지 반복 연습하세요.</li>
  </ul></div>

  <div class="foot">
    루멘수학 내부 제작 자료 · ${PEER ? (OWN ? `${esc(SCHOOL)} 기출 ${exams.length}회분(${esc(keys.join(', '))}) 근거` : `${esc(SCHOOL)} ${esc(latest)}년 기출 + 인근 학교(${esc(peerNames.join(', '))}) 기출 근거`) : `${keys.map(k => k + '년').join('·')} ${esc(SCHOOL)} 기출 근거`} · ${today}<br>
    학원 수강생 및 학부모 안내용입니다. 무단 재배포는 삼가 주세요.
  </div>
</div>
<script>
function imgFail(el){
  el.closest('.prob').classList.add('broken');
  var w=document.getElementById('imgwarn'); if(w) w.style.display='block';
}
// onerror가 안 불리는 환경 대비 — 8초 뒤에도 안 불러진 이미지는 실패 처리
setTimeout(function(){
  document.querySelectorAll('.prob img').forEach(function(im){
    if(!im.complete || !im.naturalWidth) imgFail(im);
  });
}, 8000);
</script>
</body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
const imgN = exams.reduce((s, e) => s + e.cells.filter(c => c.img).length, 0);
console.log(`보고서 저장: ${OUT}`);
console.log(`  시험지 ${exams.length}회분(${keys.join(', ')}) · ${totalN}문항(이미지 ${imgN}개) · 반복유형 ${repeated.length}개 · 고난도 ${hard.length}개 · 서술형 ${essays.length}개`);

// ── 분석 결과 JSON 덤프 ────────────────────────────────
// PPT 생성기(exam_ppt_gen.js) 등 다른 도구가 보고서와 "똑같은 분석"을 쓰도록,
// 계산이 끝난 집계 결과를 그대로 파일로 내보낸다. (--analysis 를 줄 때만 동작)
const ANALYSIS = arg('analysis');
if (ANALYSIS) {
  const conceptOf = n => (typeof CONCEPTS[n] === 'string' ? CONCEPTS[n] : (CONCEPTS[n] || {}).text) || null;
  const conceptSrcOf = n => (CONCEPTS[n] && typeof CONCEPTS[n] === 'object' && CONCEPTS[n].src) || null;
  fs.writeFileSync(ANALYSIS, JSON.stringify({
    school: SCHOOL, grade: GRADE, semester: SEM, term: TERM, peer: PEER, own: OWN, title, today,
    anchorLabel: anchorExam.label, anchorYear: latest,
    anchorTime: anchorExam.cells.reduce((s2, c) => s2 + (c.solvingTime || 0), 0),
    scope: SCOPE || (anchorExam.scopes || []).join(' / ') || null,
    peerNames, exams: perExam, keys, labels: keys.map(k => labelOf[k]),
    totalN, unitSet, unitByKey, unitScore, unitScoreTotal,
    diffBands: diffBandsArr, diffByKey,
    repeated: repeated.map((t, i) => ({
      idx: i + 1, name: t.name, unit: t.unit, nEx: nExams(t), mine: hasAnchor(t),
      concept: conceptOf(t.name), conceptSrc: conceptSrcOf(t.name),
      rep: repRep[i], items: t.items,
    })),
    hard, essays,
    topUnit, topShare, mineRepN, repScoreLatest, repPct, essayUnits,
  }, null, 1));
  console.log(`분석 JSON 저장: ${ANALYSIS}`);
}
