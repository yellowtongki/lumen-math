#!/usr/bin/env node
/* 학교별 기출 출제경향 보고서 생성기
 *
 * mathsecr_exam_collector.js가 모아둔 문항 데이터(sync/_debug/ms_exams_*.json)를 읽어
 * 학교·학년·학기·중간/기말 단위의 출제경향 분석 HTML 보고서를 만든다.
 *
 * 사용법:
 *   node sync/exam_report_gen.js --data sync/_debug/ms_exams_옥길중.json \
 *     --school 옥길중 --grade 중1 --semester 2 --term 중간 \
 *     --out docs/exam_reports/okgil_m1_2_mid.html
 *
 * 보고서에는 집계 데이터(단원·유형·난이도·배점 통계)만 담는다.
 * 시험 문제 원문·이미지는 절대 포함하지 않는다(저작권).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function arg(n, d) { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; }
const DATA = arg('data'); const SCHOOL = arg('school', '');
const GRADE = arg('grade'); const SEM = arg('semester'); const TERM = arg('term');
const OUT = arg('out');
if (!DATA || !GRADE || !SEM || !TERM || !OUT) {
  console.error('필수 인자: --data --grade --semester --term --out'); process.exit(1);
}

const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const exams = all
  .filter(e => e.grade === GRADE && e.semester === SEM && e.term === TERM)
  .sort((a, b) => Number(a.year) - Number(b.year));
if (!exams.length) { console.error('해당 조건의 시험지가 없습니다'); process.exit(1); }

const clean = s => String(s || '').replace(/^\d+ /, '');
// 난이도 값(수학비서 1~8 추정) → 하/중/상/최상 구간
function diffBand(d) { if (d == null) return null; if (d <= 2) return '하'; if (d <= 4) return '중'; if (d <= 6) return '상'; return '최상'; }
const isEssay = t => t && t !== 'single_choice';

// ── 집계 ──────────────────────────────────────────────
const years = exams.map(e => e.year);
const perExam = exams.map(e => {
  const total = e.cells.reduce((s, c) => s + (c.score || 0), 0);
  return {
    year: e.year, id: e.id, n: e.cells.length,
    total: total >= 90 ? total : null,           // 배점 미입력(전부 0) 시험지는 총점 표기 생략
    choice: e.cells.filter(c => !isEssay(c.answerType)).length,
    essay: e.cells.filter(c => isEssay(c.answerType)).length,
    scope: e.scopes || null,
    avgTime: Math.round(e.cells.reduce((s, c) => s + (c.solvingTime || 0), 0) / e.cells.length * 10) / 10,
  };
});

// 대단원(레벨2)별 문항수 — 연도별
const unitSet = [];
const unitByYear = {};
exams.forEach(e => {
  e.cells.forEach(c => {
    const u = clean(c.chapters[1]) || '기타';
    if (!unitSet.includes(u)) unitSet.push(u);
    unitByYear[e.year] = unitByYear[e.year] || {};
    unitByYear[e.year][u] = (unitByYear[e.year][u] || 0) + 1;
  });
});
// 단원 정렬: 최신 연도 문항수 많은 순
const latest = years[years.length - 1];
unitSet.sort((a, b) => ((unitByYear[latest] || {})[b] || 0) - ((unitByYear[latest] || {})[a] || 0));

// 최신 연도 배점 비중 (배점 있는 시험지만)
const latestExam = exams[exams.length - 1];
const unitScore = {};
let unitScoreTotal = 0;
latestExam.cells.forEach(c => {
  if (c.score) { const u = clean(c.chapters[1]) || '기타'; unitScore[u] = (unitScore[u] || 0) + c.score; unitScoreTotal += c.score; }
});

// 세부유형(레벨4)별 출현 연도 — 매년 반복 유형
const typeMap = {};
exams.forEach(e => {
  e.cells.forEach(c => {
    const k = clean(c.chapters[3]);
    if (!k) return;
    const t = typeMap[k] = typeMap[k] || { name: k, unit: clean(c.chapters[1]), years: {}, diffs: [], essay: false, scores: [] };
    t.years[e.year] = (t.years[e.year] || 0) + 1;
    if (c.difficulty != null) t.diffs.push(c.difficulty);
    if (isEssay(c.answerType)) t.essay = true;
    if (c.score) t.scores.push(c.score);
  });
});
const repeated = Object.values(typeMap)
  .filter(t => Object.keys(t.years).length >= years.length && years.length >= 2)
  .sort((a, b) => Math.max(...b.diffs) - Math.max(...a.diffs));

// 난이도 분포 — 연도별
const diffBands = ['하', '중', '상', '최상'];
const diffByYear = {};
exams.forEach(e => {
  diffByYear[e.year] = { 하: 0, 중: 0, 상: 0, 최상: 0 };
  e.cells.forEach(c => { const b = diffBand(c.difficulty); if (b) diffByYear[e.year][b]++; });
});

// 서술형 문항의 단원·유형
const essays = [];
exams.forEach(e => e.cells.forEach(c => {
  if (isEssay(c.answerType)) essays.push({ year: e.year, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), diff: diffBand(c.difficulty), score: c.score || null });
}));

// 고난도(상·최상) 문항의 유형
const hard = [];
exams.forEach(e => e.cells.forEach(c => {
  const b = diffBand(c.difficulty);
  if (b === '상' || b === '최상') hard.push({ year: e.year, no: c.no, unit: clean(c.chapters[1]), type: clean(c.chapters[3]) || clean(c.chapters[2]), band: b, essay: isEssay(c.answerType) });
}));

// ── HTML ──────────────────────────────────────────────
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const totalN = exams.reduce((s, e) => s + e.cells.length, 0);
const YCOLOR = { [years[years.length - 1]]: 'var(--s1)', [years[years.length - 2]]: 'var(--s2)' };
const maxUnitN = Math.max(...unitSet.map(u => Math.max(...years.map(y => (unitByYear[y] || {})[u] || 0))));

function barRow(label, rows, maxV) {
  // rows: [{year, v, color}] — 연도별 가로막대 묶음
  let h = `<div class="brow"><div class="blab">${esc(label)}</div><div class="bars">`;
  rows.forEach(r => {
    const w = maxV && r.v ? Math.max(2, Math.round(r.v / maxV * 100)) : 0;
    h += `<div class="bline"><span class="byr">${esc(r.year)}</span><div class="btrack"><div class="bfill" style="width:${w}%;background:${r.color}"></div></div><span class="bval">${r.v}문항</span></div>`;
  });
  return h + '</div></div>';
}

let unitBars = '';
unitSet.forEach(u => {
  unitBars += barRow(u, years.map(y => ({ year: y + '년', v: (unitByYear[y] || {})[u] || 0, color: YCOLOR[y] || 'var(--s1)' })), maxUnitN);
});

let scoreBars = '';
if (unitScoreTotal >= 90) {
  unitSet.forEach(u => {
    const v = unitScore[u] || 0;
    const w = Math.max(2, Math.round(v / unitScoreTotal * 100));
    scoreBars += `<div class="brow"><div class="blab">${esc(u)}</div><div class="bars"><div class="bline"><div class="btrack"><div class="bfill" style="width:${w}%;background:var(--s1)"></div></div><span class="bval">${v}점 (${Math.round(v / unitScoreTotal * 100)}%)</span></div></div></div>`;
  });
}

let diffBars = '';
diffBands.forEach(b => {
  const rows = years.map(y => ({ year: y + '년', v: diffByYear[y][b] || 0, color: YCOLOR[y] || 'var(--s1)' }));
  if (rows.every(r => !r.v)) return;
  const maxD = Math.max(...years.map(y => Math.max(...diffBands.map(bb => diffByYear[y][bb] || 0))));
  diffBars += barRow(b, rows, maxD);
});

const repRows = repeated.map((t, i) => {
  const maxD = t.diffs.length ? diffBand(Math.max(...t.diffs)) : null;
  const cnt = years.map(y => `${y}년 ${t.years[y]}문항`).join(' · ');
  return `<tr><td class="num">${i + 1}</td><td><b>${esc(t.name)}</b><div class="sub">${esc(t.unit)}</div></td><td>${cnt}</td><td>${maxD ? `<span class="pill p-${maxD === '하' ? 'lo' : maxD === '중' ? 'md' : 'hi'}">${maxD}</span>` : '-'}${t.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td></tr>`;
}).join('');

const essayRows = essays.map(e => `<tr><td>${esc(e.year)}년</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td>${e.diff || '-'}${e.score ? ` · ${e.score}점` : ''}</td></tr>`).join('');
const hardRows = hard.map(e => `<tr><td>${esc(e.year)}년</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td><span class="pill p-hi">${e.band}</span>${e.essay ? ' <span class="pill p-es">서술형</span>' : ''}</td></tr>`).join('');

const tiles = perExam.map(p => `
  <div class="tile"><div class="tyear">${esc(p.year)}년</div>
    <div class="tv">${p.n}<span class="tu">문항</span></div>
    <div class="ts">객관식 ${p.choice} · 서술형 ${p.essay}${p.total ? ` · ${p.total}점` : ''}</div>
  </div>`).join('');

const scopeTxt = (latestExam.scopes || []).map(esc).join('<br>') ||
  (latestExam.sourcePath ? esc(latestExam.sourcePath.split('>').slice(-3).join(' · ')) : '');

const legend = years.map(y => `<span class="lg"><i style="background:${YCOLOR[y] || 'var(--s1)'}"></i>${esc(y)}년</span>`).join('');

const today = new Date().toISOString().slice(0, 10);
const title = `${SCHOOL} ${GRADE} ${SEM}학기 ${TERM}고사 수학 출제경향`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--s1:#2a78d6;--s2:#eb6834;--ink:#0b0b0b;--ink2:#52514e;--mut:#8a887f;--bg:#f4f5f7;--card:#ffffff;--line:#e5e7eb}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}
.wrap{max-width:820px;margin:0 auto;padding:28px 18px 60px}
.brand{font-size:13px;font-weight:800;color:var(--s1);letter-spacing:.5px}
h1{font-size:24px;margin:6px 0 2px;font-weight:800}
.meta{font-size:13px;color:var(--ink2);margin-bottom:20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:16px}
h2{font-size:16px;font-weight:800;margin-bottom:4px}
.desc{font-size:13px;color:var(--ink2);margin-bottom:14px}
.tiles{display:flex;gap:10px;flex-wrap:wrap}
.tile{flex:1;min-width:140px;background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.tyear{font-size:12px;font-weight:700;color:var(--ink2)}
.tv{font-size:26px;font-weight:800}.tu{font-size:13px;font-weight:600;color:var(--ink2);margin-left:2px}
.ts{font-size:12px;color:var(--ink2)}
.legend{display:flex;gap:14px;margin-bottom:12px;font-size:12px;color:var(--ink2)}
.lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.brow{margin-bottom:14px}
.blab{font-size:13.5px;font-weight:700;margin-bottom:4px}
.bline{display:flex;align-items:center;gap:8px;margin-bottom:3px}
.byr{font-size:11px;color:var(--mut);width:44px;text-align:right;flex:none}
.btrack{flex:1;height:14px;background:#eef1f4;border-radius:4px;overflow:hidden}
.bfill{height:100%;border-radius:0 4px 4px 0}
.bval{font-size:12px;color:var(--ink2);width:72px;flex:none}
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-size:12px;color:var(--ink2);text-align:left;padding:6px 8px;border-bottom:2px solid var(--line);font-weight:700}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}
td.num{color:var(--mut);width:26px}
.sub{font-size:11.5px;color:var(--mut)}
.pill{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px}
.p-lo{background:#e8f5ee;color:#137a4b}.p-md{background:#fff4e0;color:#a06000}.p-hi{background:#fdeaea;color:#c02b2b}.p-es{background:#eceafd;color:#5b4bc4}
.note{font-size:12px;color:var(--mut);margin-top:6px}
.tips li{margin:6px 0 6px 18px;font-size:13.5px}
.scope{font-size:13px;background:#f8fafc;border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.foot{font-size:11.5px;color:var(--mut);text-align:center;margin-top:26px;line-height:1.7}
@media print{body{background:#fff}.card{break-inside:avoid;border-color:#ccc}.wrap{padding:0}}
</style></head><body>
<div class="wrap">
  <div class="brand">루멘수학 LUMEN MATH</div>
  <h1>${esc(title)} 분석</h1>
  <div class="meta">근거: ${years.map(y => y + '년').join(' · ')} 기출 ${exams.length}회분 · 총 ${totalN}문항 (수학비서 기출 DB) · ${today} 작성</div>

  <div class="card"><h2>📌 시험 개요</h2>
    <div class="desc">최근 ${exams.length}개년 실제 시험지의 문항 구성입니다.</div>
    <div class="tiles">${tiles}</div>
    ${scopeTxt ? `<div class="note">시험 범위(${esc(latest)}년 기준)</div><div class="scope">${scopeTxt}</div>` : ''}
  </div>

  <div class="card"><h2>📊 단원별 출제 비중</h2>
    <div class="desc">단원마다 몇 문항이 나왔는지 연도별로 비교했습니다.</div>
    <div class="legend">${legend}</div>
    ${unitBars}
  </div>

  ${scoreBars ? `<div class="card"><h2>💯 단원별 배점 비중 (${esc(latest)}년)</h2>
    <div class="desc">100점 만점에서 단원별로 몇 점이 걸려 있는지입니다.</div>
    ${scoreBars}</div>` : ''}

  <div class="card"><h2>🔁 매년 반복 출제된 세부유형 — 반드시 준비</h2>
    <div class="desc">분석한 ${exams.length}개년 모두에 등장한 유형입니다. 올해도 나올 가능성이 가장 높은 목록입니다.</div>
    <table><tr><th>#</th><th>세부유형 (단원)</th><th>출제 이력</th><th>난이도</th></tr>${repRows || '<tr><td colspan="4">반복 유형 없음</td></tr>'}</table>
  </div>

  <div class="card"><h2>🌡️ 난이도 분포</h2>
    <div class="desc">수학비서가 매긴 문항 난이도를 하·중·상으로 묶었습니다.</div>
    <div class="legend">${legend}</div>
    ${diffBars}
  </div>

  ${hardRows ? `<div class="card"><h2>🔥 고난도 문항이 나온 유형</h2>
    <div class="desc">변별력 문항(난이도 상 이상)이 출제된 자리입니다. 상위권은 이 목록을 집중 대비하세요.</div>
    <table><tr><th>연도</th><th>번호</th><th>단원</th><th>세부유형</th><th>비고</th></tr>${hardRows}</table></div>` : ''}

  ${essayRows ? `<div class="card"><h2>✍️ 서술형 출제 위치</h2>
    <div class="desc">서술형(풀이 과정 채점)이 나온 단원과 유형입니다.</div>
    <table><tr><th>연도</th><th>번호</th><th>단원</th><th>세부유형</th><th>난이도·배점</th></tr>${essayRows}</table></div>` : ''}

  <div class="foot">
    이 보고서는 실제 기출 문항의 <b>유형·난이도·배점 통계</b>만 담고 있으며, 시험 문제 원문은 포함하지 않습니다.<br>
    루멘수학 · 문의는 원장 직통으로 부탁드립니다.
  </div>
</div>
</body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`보고서 저장: ${OUT}`);
console.log(`  시험지 ${exams.length}회분(${years.join(', ')}) · ${totalN}문항 · 반복유형 ${repeated.length}개 · 고난도 ${hard.length}개 · 서술형 ${essays.length}개`);
