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
const EMBED = args.includes('--embed');   // 문항 이미지를 base64로 인라인 (자체 포함 배포본)
if (!DATA || !GRADE || !SEM || !TERM || !OUT) {
  console.error('필수 인자: --data --grade --semester --term --out'); process.exit(1);
}

const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const exams = all
  .filter(e => e.grade === GRADE && e.semester === SEM && e.term === TERM)
  .sort((a, b) => Number(a.year) - Number(b.year));
if (!exams.length) { console.error('해당 조건의 시험지가 없습니다'); process.exit(1); }

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

const clean = s => String(s || '').replace(/^\d+ /, '');
function diffBand(d) { if (d == null) return null; if (d <= 2) return '하'; if (d <= 4) return '중'; if (d <= 6) return '상'; return '최상'; }
const isEssay = t => t && t !== 'single_choice';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── 집계 ──────────────────────────────────────────────
const years = exams.map(e => e.year);
const latest = years[years.length - 1];
const latestExam = exams[exams.length - 1];
const totalN = exams.reduce((s, e) => s + e.cells.length, 0);

const perExam = exams.map(e => {
  const total = e.cells.reduce((s, c) => s + (c.score || 0), 0);
  return {
    year: e.year, n: e.cells.length,
    total: total >= 90 ? total : null,
    choice: e.cells.filter(c => !isEssay(c.answerType)).length,
    essay: e.cells.filter(c => isEssay(c.answerType)).length,
  };
});

const unitSet = [];
const unitByYear = {};
exams.forEach(e => e.cells.forEach(c => {
  const u = clean(c.chapters[1]) || '기타';
  if (!unitSet.includes(u)) unitSet.push(u);
  (unitByYear[e.year] = unitByYear[e.year] || {})[u] = ((unitByYear[e.year] || {})[u] || 0) + 1;
}));
unitSet.sort((a, b) => ((unitByYear[latest] || {})[b] || 0) - ((unitByYear[latest] || {})[a] || 0));

const unitScore = {};
let unitScoreTotal = 0;
latestExam.cells.forEach(c => {
  if (c.score) { const u = clean(c.chapters[1]) || '기타'; unitScore[u] = (unitScore[u] || 0) + c.score; unitScoreTotal += c.score; }
});

// 세부유형(레벨4) — 연도별 출현 문항 기록 (이미지 포함)
const typeMap = {};
exams.forEach(e => e.cells.forEach(c => {
  const k = clean(c.chapters[3]);
  if (!k) return;
  const t = typeMap[k] = typeMap[k] || { name: k, unit: clean(c.chapters[1]), items: [] };
  t.items.push({ year: e.year, no: c.no, img: c.img, diff: c.difficulty, essay: isEssay(c.answerType), score: c.score || null, time: c.solvingTime || null, answer: c.answer });
}));
const repeated = Object.values(typeMap)
  .filter(t => new Set(t.items.map(i => i.year)).size >= years.length && years.length >= 2)
  .sort((a, b) => Math.max(...b.items.map(i => i.diff || 0)) - Math.max(...a.items.map(i => i.diff || 0)));

const diffBandsArr = ['하', '중', '상', '최상'];
const diffByYear = {};
exams.forEach(e => {
  diffByYear[e.year] = { 하: 0, 중: 0, 상: 0, 최상: 0 };
  e.cells.forEach(c => { const b = diffBand(c.difficulty); if (b) diffByYear[e.year][b]++; });
});

const essays = [];
exams.forEach(e => e.cells.forEach(c => {
  if (isEssay(c.answerType)) essays.push({ year: e.year, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), diff: diffBand(c.difficulty), score: c.score || null, img: c.img, essay: true, answer: c.answer });
}));
const hard = [];
exams.forEach(e => e.cells.forEach(c => {
  const b = diffBand(c.difficulty);
  if (b === '상' || b === '최상') hard.push({ year: e.year, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), band: b, essay: isEssay(c.answerType), img: c.img, answer: c.answer });
}));

// ── 요점정리 A: 공부 우선순위 (데이터 기반) ────────────
const repNames = new Set(repeated.map(t => t.name));
let repScoreLatest = 0;
latestExam.cells.forEach(c => { if (repNames.has(clean(c.chapters[3])) && c.score) repScoreLatest += c.score; });
const repPct = unitScoreTotal >= 90 ? Math.round(repScoreLatest / unitScoreTotal * 100) : null;
// 반복 유형별 대표값(최신 연도 기준)
const repRep = repeated.map(t => {
  const yr = t.items.filter(it => it.year === latest);
  const r = yr[0] || t.items[t.items.length - 1];
  return { name: t.name, unit: t.unit, score: r.score, diff: r.diff, time: r.time, essay: t.items.some(it => it.essay), count: t.items.length };
});

// ── 요점정리 B: 유형별 핵심 개념 (루멘수학 작성 · 원장님 검수) ──
// 문항 데이터가 아니라 교과 지식으로 쓴 요약이므로, 새 유형은 아래에 추가하면 된다.
const CONCEPTS = {
  '삼각형의 결정조건1 (기본 조건)': '삼각형이 하나로 정해지는 경우는 딱 셋 — ① 세 변, ② 두 변과 그 끼인각, ③ 한 변과 그 양 끝 각. 세 각만 주면 크기가 안 정해지고, 두 변과 "끼인각이 아닌" 각을 주면 삼각형이 두 개 생길 수 있어 안 된다. 세 변으로 줄 때는 (가장 긴 변) < (나머지 두 변의 합)을 만족해야 삼각형이 만들어진다.',
  '간단한 도형의 작도4 (평행선의 작도)': '"동위각(또는 엇각)이 같으면 두 직선은 평행하다"는 성질을 거꾸로 이용한다. 주어진 직선의 각과 크기가 같은 각을 다른 점에 컴퍼스로 옮겨 그리면 그 점을 지나는 평행선이 작도된다. 바탕이 되는 것은 "크기가 같은 각 옮기기" 작도. 작도 순서와 "왜 평행한가"의 근거를 설명하는 문제가 나온다.',
  '삼각형의 합동의 활용1 (정삼각형)': '정삼각형은 세 변이 모두 같고 세 각이 모두 60°. 이 성질로 두 삼각형이 SAS(두 변과 끼인각) 합동임을 보이는 문제가 단골이다. 합동이 증명되면 대응하는 변·각이 같음을 이용해 값을 구한다. 서술형으로 자주 나오므로 "어떤 합동조건(SSS·SAS·ASA)인지"를 근거로 쓰는 연습이 중요.',
  '위치 관계6 (직선과 평면)': '공간에서 두 직선·직선과 평면·두 평면의 관계를 따진다. 핵심은 "꼬인 위치" — 만나지도 평행하지도 않는(한 평면에 없는) 경우. 직육면체 그림에서 한 모서리를 기준으로 평행·수직·꼬인 위치 모서리의 개수를 정확히 세는 연습이 필수다.',
  '두 점 사이의 거리2 (관계식이 주어진 두 점)': '좌표평면에서 두 점의 좌표를 먼저 구한 뒤 거리를 계산한다. 정비례·반비례 식(y=ax, y=a/x)이 주어지면 x값을 대입해 점의 좌표를 얻는다. 두 점이 같은 세로선(또는 가로선) 위에 있으면 거리는 좌표의 차이. 그래프 위 점의 좌표를 식으로 구하는 것이 첫걸음.',
  '반비례 관계4 (y=a/x에서 a의 값 구하기)': '그래프나 표에서 지나는 점 (x, y) 하나만 알면 a = x × y로 비례상수 a가 바로 나온다. 반비례에서 곱 xy는 항상 a로 일정하다는 것이 핵심. 가장 기본 유형이니 실수 없이 득점해야 한다.',
  '반비례 관계7 (y=a/x의 그래프 위의 점의 좌표가 정수인 경우)': 'y=a/x 위의 점 중 x, y가 모두 정수인 점의 개수는 a의 약수 개수와 같다. xy=a이므로 (x, y)는 곱이 a가 되는 정수쌍 — a의 약수가 몇 개인지 세면 된다. 음수 약수(음의 정수쌍)도 빠뜨리지 말 것.',
  '반비례 관계9 (y=ax, y=a/x의 그래프가 만나는 점)': '정비례 y=ax와 반비례 y=b/x의 교점은 두 식을 연립 — ax=b/x → x²=b/a. 교점은 원점에 대해 대칭인 두 점이다. 한 교점의 좌표가 주어지면 대입해 상수를 구한다. "두 그래프가 만나는 점"이 나오면 연립을 떠올린다.',
};

// 한눈에 보기 — 자동 요약 3줄
const topUnit = unitSet[0];
const topShare = unitScoreTotal >= 90 ? Math.round((unitScore[topUnit] || 0) / unitScoreTotal * 100) : null;
const essayUnits = [...new Set(essays.map(e => e.unit))];
const highlights = [
  `<b>${esc(topUnit)}</b> 단원이 가장 큰 비중${topShare ? ` — ${latest}년 배점의 <b>${topShare}%</b>` : ''}`,
  `${years.length}개년 모두 출제된 세부유형 <b>${repeated.length}개</b> — 올해도 나올 가능성이 가장 높은 목록`,
  essays.length ? `서술형은 <b>${esc(essayUnits[0])}</b>${essayUnits.length > 1 ? ' 등' : ''}에서 반복 출제` : '서술형 출제 없음',
];

// ── HTML 조각 ─────────────────────────────────────────
const YCOLOR = { [latest]: 'var(--s1)', [years[years.length - 2]]: 'var(--s2)' };
const maxUnitN = Math.max(...unitSet.map(u => Math.max(...years.map(y => (unitByYear[y] || {})[u] || 0))));

function barRow(label, rows, maxV, unitTxt) {
  let h = `<div class="brow"><div class="blab">${esc(label)}</div><div class="bars">`;
  rows.forEach(r => {
    const w = maxV && r.v ? Math.max(2, Math.round(r.v / maxV * 100)) : 0;
    h += `<div class="bline"><span class="byr">${esc(r.year)}</span><div class="btrack"><div class="bfill" style="width:${w}%;background:${r.color}"></div></div><span class="bval">${r.v}${unitTxt}</span></div>`;
  });
  return h + '</div></div>';
}

let unitBars = '';
unitSet.forEach(u => {
  unitBars += barRow(u, years.map(y => ({ year: y + '년', v: (unitByYear[y] || {})[u] || 0, color: YCOLOR[y] || 'var(--s1)' })), maxUnitN, '문항');
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
  const maxD = Math.max(...years.map(y => Math.max(...diffBandsArr.map(b => diffByYear[y][b] || 0))));
  diffBandsArr.forEach(b => {
    const rows = years.map(y => ({ year: y + '년', v: diffByYear[y][b] || 0, color: YCOLOR[y] || 'var(--s1)' }));
    if (rows.every(r => !r.v)) return;
    diffBars += barRow(b, rows, maxD, '문항');
  });
}

const pillD = d => { const b = diffBand(d); return b ? `<span class="pill p-${b === '하' ? 'lo' : b === '중' ? 'md' : 'hi'}">${b}</span>` : ''; };
// 이미지는 임베드 모드(--embed)에서만 넣는다. 비임베드(공개 링크)에서는
// CDN 직접 링크가 로그인 없이는 안 열려 깨지므로 아예 표시하지 않는다.
const probImg = (it, label) => {
  if (!it.img || !EMBED) return '';
  const src = imgSrc(it.img);
  if (src === it.img) return '';   // 로컬 파일이 없어 CDN 원주소로 떨어진 경우 → 표시 안 함
  // 정답 배지 — 객관식은 기호(①~⑤), 서술형은 LaTeX라 "서술형"으로 표기
  const ans = it.answer ? (it.essay ? '서술형' : esc(String(it.answer))) : '';
  const cap = `${esc(label)}${ans ? ` <span class="ans">정답 ${ans}</span>` : ''}`;
  // base64 인라인이므로 loading="lazy" 안 씀 — 일부 파일 뷰어가 스크롤 로드를 안 걸어
  // 아래쪽 이미지가 빈 채로 보이던 문제를 막는다.
  return `<figure class="prob"><figcaption>${cap}</figcaption><img src="${src}" alt="문제"></figure>`;
};

const repCards = repeated.map((t, i) => {
  const byYear = {};
  t.items.forEach(it => (byYear[it.year] = byYear[it.year] || []).push(it));
  const meta = t.items.some(it => it.essay) ? ' <span class="pill p-es">서술형 출제</span>' : '';
  const maxD = Math.max(...t.items.map(it => it.diff || 0));
  let imgs = '';
  years.forEach(y => (byYear[y] || []).forEach(it => {
    imgs += probImg(it, `${y}년 · ${it.no}번${it.score ? ` · ${it.score}점` : ''}`);
  }));
  return `<div class="repcard">
    <div class="rephead"><span class="repno">${i + 1}</span>
      <div><div class="repname">${esc(t.name)}</div><div class="repunit">${esc(t.unit)}</div></div>
      <div class="repmeta">${pillD(maxD)}${meta}</div></div>
    ${imgs ? `<div class="probs">${imgs}</div>` : ''}
  </div>`;
}).join('');

const hardRows = hard.map(e => `<tr><td>${esc(e.year)}년</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td><span class="pill p-hi">${e.band}</span>${e.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td></tr>`).join('');
const hardImgs = hard.map(e => probImg(e, `${e.year}년 · ${e.no}번 · ${e.type}`)).join('');
const essayRows = essays.map(e => `<tr><td>${esc(e.year)}년</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td>${e.diff || '-'}${e.score ? ` · ${e.score}점` : ''}</td></tr>`).join('');
const essayImgs = essays.map(e => probImg(e, `${e.year}년 · ${e.no}번 · ${e.type}`)).join('');

// 요점정리 A — 공부 우선순위 표
const bandPill = b => b ? `<span class="pill p-${b === '하' ? 'lo' : b === '중' ? 'md' : 'hi'}">${b}</span>` : '-';
const strategyRows = repRep.map((r, i) => `<tr>
  <td><span class="repno sm">${i + 1}</span></td>
  <td><b>${esc(r.name)}</b></td>
  <td>${esc(r.unit)}</td>
  <td>${r.score ? r.score + '점' : '-'}</td>
  <td>${bandPill(diffBand(r.diff))}</td>
  <td>${r.time ? r.time + '분' : '-'}${r.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td>
</tr>`).join('');

// 요점정리 B — 유형별 핵심 개념
const conceptCards = repRep.map((r, i) => {
  const c = CONCEPTS[r.name];
  return `<div class="concept">
    <div class="chd"><span class="repno sm">${i + 1}</span>
      <div><div class="repname">${esc(r.name)}</div><div class="repunit">${esc(r.unit)}</div></div></div>
    <p class="cbody">${c ? esc(c) : '<span style="color:var(--mut)">핵심 정리 준비 중입니다.</span>'}</p>
  </div>`;
}).join('');

const tiles = perExam.map(p => `
  <div class="tile"><div class="tyear">${esc(p.year)}년</div>
    <div class="tv">${p.n}<span class="tu">문항</span></div>
    <div class="ts">객관식 ${p.choice} · 서술형 ${p.essay}${p.total ? ` · ${p.total}점 만점` : ''}</div>
  </div>`).join('');

const scopeTxt = (latestExam.scopes || []).map(esc).join('<br>');
const legend = years.map(y => `<span class="lg"><i style="background:${YCOLOR[y] || 'var(--s1)'}"></i>${esc(y)}년</span>`).join('');
const today = new Date().toISOString().slice(0, 10);
const title = `${SCHOOL} ${GRADE} ${SEM}학기 ${TERM}고사`;

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
.byr{font-size:11px;color:var(--mut);width:44px;text-align:right;flex:none;font-weight:600}
.btrack{flex:1;height:15px;background:#edf0f5;border-radius:5px;overflow:hidden}
.bfill{height:100%;border-radius:0 5px 5px 0}
.bval{font-size:12px;color:var(--ink2);width:64px;flex:none;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-size:11.5px;color:var(--mut);text-align:left;padding:6px 8px;border-bottom:2px solid var(--line);font-weight:800;letter-spacing:.3px}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.pill{display:inline-block;font-size:11px;font-weight:800;padding:1px 9px;border-radius:99px}
.p-lo{background:#e6f6ee;color:#0f7a48}.p-md{background:#fff3dd;color:#9c6200}.p-hi{background:#fdeaea;color:#c22}.p-es{background:#edeafd;color:#5747c9}
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
    <div class="csub">${years.map(y => y + '년').join(' · ')} 실제 기출 ${exams.length}회분 · ${totalN}문항 완전 분석</div>
    <div class="chips"><span class="chip">📅 ${today}</span><span class="chip">📚 근거: 기출 문항 DB</span><span class="chip">🏫 ${esc(SCHOOL)}</span></div>
  </div>

  <div id="imgwarn">⚠️ 일부 문제 이미지가 표시되지 않았습니다. 수학비서 이미지 서버 접근이 제한된 네트워크일 수 있어요 — 다른 기기(휴대폰 데이터 등)에서 다시 열어보세요.</div>

  <div class="hl"><h2>한눈에 보기</h2><ul>${highlights.map(h => `<li>${h}</li>`).join('')}</ul></div>

  <div class="sec"><div class="shead"><span class="snum">01</span><h2 class="st">시험 개요</h2></div>
    <div class="desc">최근 ${exams.length}개년 실제 시험지의 문항 구성입니다.</div>
    <div class="tiles">${tiles}</div>
    ${scopeTxt ? `<div class="note">시험 범위 (${esc(latest)}년 기준)</div><div class="scope">${scopeTxt}</div>` : ''}
  </div>

  <div class="sec"><div class="shead"><span class="snum">02</span><h2 class="st">단원별 출제 비중</h2></div>
    <div class="desc">단원마다 몇 문항이 나왔는지 연도별로 비교했습니다.</div>
    <div class="legend">${legend}</div>
    ${unitBars}
  </div>

  ${scoreBars ? `<div class="sec"><div class="shead"><span class="snum">03</span><h2 class="st">단원별 배점 비중 <span style="font-size:13px;color:var(--mut)">(${esc(latest)}년)</span></h2></div>
    <div class="desc">100점 만점에서 단원별로 몇 점이 걸려 있는지입니다.</div>
    ${scoreBars}</div>` : ''}

  <div class="sec"><div class="shead"><span class="snum">04</span><h2 class="st">매년 반복 출제된 세부유형</h2></div>
    <div class="desc">분석한 ${exams.length}개년 <b>모두</b>에 등장한 유형입니다. 실제 기출 문제와 함께 확인하세요 — 올해도 나올 가능성이 가장 높은 목록입니다.</div>
    ${repCards || '<div class="desc">반복 유형 없음</div>'}
  </div>

  <div class="sec"><div class="shead"><span class="snum">05</span><h2 class="st">난이도 분포</h2></div>
    <div class="desc">문항 난이도를 하·중·상으로 묶었습니다.</div>
    <div class="legend">${legend}</div>
    ${diffBars}
  </div>

  ${hardRows ? `<div class="sec"><div class="shead"><span class="snum">06</span><h2 class="st">고난도 문항 — 변별력이 갈리는 자리</h2></div>
    <div class="desc">난이도 상 이상 문항이 출제된 위치입니다. 상위권 목표라면 이 유형을 집중 대비하세요.</div>
    <table><tr><th>연도</th><th>번호</th><th>단원</th><th>세부유형</th><th>비고</th></tr>${hardRows}</table>
    ${hardImgs ? `<div class="probs" style="padding:14px 0 0">${hardImgs}</div>` : ''}</div>` : ''}

  ${essayRows ? `<div class="sec"><div class="shead"><span class="snum">07</span><h2 class="st">서술형 출제 위치</h2></div>
    <div class="desc">풀이 과정을 채점하는 서술형이 나온 자리입니다. 답만 맞히는 연습으로는 부족합니다.</div>
    <table><tr><th>연도</th><th>번호</th><th>단원</th><th>세부유형</th><th>난이도·배점</th></tr>${essayRows}</table>
    ${essayImgs ? `<div class="probs" style="padding:14px 0 0">${essayImgs}</div>` : ''}</div>` : ''}

  <div class="sec"><div class="shead"><span class="snum">08</span><h2 class="st">시험 대비 요점정리 ① — 공부 우선순위</h2></div>
    <div class="desc">매년 빠짐없이 나온 유형만 모았습니다. 여기부터 완벽히 잡는 것이 가장 효율적입니다.</div>
    ${repPct != null ? `<div class="hlstat">매년 반복된 <b>${repeated.length}개 유형</b>에서 ${esc(latest)}년 시험 <b>${repScoreLatest}점</b>${repPct ? `(전체의 <b>${repPct}%</b>)` : ''}이 출제됐습니다. <b>이것부터</b> 잡으세요.</div>` : ''}
    <table><tr><th>번호</th><th>유형</th><th>단원</th><th>배점</th><th>난이도</th><th>예상 풀이시간</th></tr>${strategyRows}</table>
    <div class="note">배점·난이도·풀이시간은 ${esc(latest)}년 기출 기준입니다. 번호는 아래 개념 정리·반복유형 카드와 같습니다.</div>
  </div>

  <div class="sec"><div class="shead"><span class="snum">09</span><h2 class="st">시험 대비 요점정리 ② — 유형별 핵심 개념</h2></div>
    <div class="desc">위 반복 유형마다 꼭 알아야 할 개념과 접근법입니다. 문제를 풀기 전에 먼저 읽어 두세요.</div>
    ${conceptCards}
  </div>

  <div class="final"><h2>💡 루멘수학 대비 포인트</h2><ul>
    <li><b>${esc(topUnit)}</b> 단원을 가장 먼저, 가장 깊게 — 배점 비중이 제일 큽니다.</li>
    <li>위 <b>반복 유형 ${repeated.length}개</b>는 유사 문제까지 반드시 연습합니다.</li>
    ${essays.length ? `<li>서술형 대비: <b>${esc(essayUnits.join(', '))}</b>은 풀이 과정을 쓰는 연습까지.</li>` : ''}
    <li>위 <b>요점정리 ①·②</b>대로 우선순위를 잡고, 반복 유형은 유사 문제까지 반복 연습하세요.</li>
  </ul></div>

  <div class="foot">
    루멘수학 내부 제작 자료 · ${years.map(y => y + '년').join('·')} ${esc(SCHOOL)} 기출 근거 · ${today}<br>
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
console.log(`  시험지 ${exams.length}회분(${years.join(', ')}) · ${totalN}문항(이미지 ${imgN}개) · 반복유형 ${repeated.length}개 · 고난도 ${hard.length}개 · 서술형 ${essays.length}개`);
