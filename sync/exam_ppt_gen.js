#!/usr/bin/env node
/* 학교별 기출 출제경향 발표용 PPT 생성기
 *
 * exam_report_gen.js 가 --analysis 로 내보낸 분석 JSON을 읽어
 * 학생들에게 보여 줄 수업용 슬라이드(.pptx)를 만든다.
 * 보고서(HTML)와 똑같은 분석 결과를 쓰므로 두 자료의 숫자가 어긋나지 않는다.
 *
 * 사용법:
 *   # 1) 보고서를 만들면서 분석 JSON도 함께 내보낸다
 *   node sync/exam_report_gen.js --data ... --out ... --analysis sync/_debug/an.json
 *   # 2) 그 JSON으로 PPT를 만든다
 *   node sync/exam_ppt_gen.js --analysis sync/_debug/an.json --out 옥길중_중2.pptx
 *
 * 옵션:
 *   --theme brand|navy   brand(기본) = 루멘수학 로고 색(붉은색·네이비·골드), navy = 파란 계열
 *   --only-mine   반복 유형이 많을 때 "우리 학교 출제(★)" 유형만 낱장 슬라이드로 만든다
 *                 (지정 안 하면 유형이 12개를 넘을 때 자동 적용)
 *
 * 문항 이미지는 exam_image_fetch.js 가 내려받아 둔 sync/_debug/exam_images/ 를 쓴다.
 * 이미지가 없으면 그 자리를 비우고 개념 설명만 넣는다(에러 없이 진행).
 */
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ANALYSIS = arg('analysis');
const OUT = arg('out');
const ONLY_MINE = args.includes('--only-mine');
if (!ANALYSIS || !OUT) { console.error('필수 인자: --analysis <분석JSON> --out <파일.pptx>'); process.exit(1); }

const A = JSON.parse(fs.readFileSync(ANALYSIS, 'utf8'));
const IMG_DIR = path.join(__dirname, '_debug', 'exam_images');
const MAP_FILE = path.join(__dirname, '_debug', 'ms_exam_images_map.json');
const IMGMAP = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};

// ── 색·글꼴 ────────────────────────────────────────────
// --theme brand : 루멘수학 로고 색 (붉은색 + 네이비 + 골드) — 기본값
// --theme navy  : 처음 만들었던 네이비/블루 배색
const THEME = arg('theme', 'brand');
const P = THEME === 'navy'
  ? {
      dark: '14274E', dark2: '24549E', onDark: 'C9D8F2', big: 'C9D8F2',
      head: '14274E', acc: '2A78D6', acc2: 'EB6834',
      soft: 'F2F5FA', mine: 'E9F1FD', line: 'E3E7EE',
      series: ['2A78D6', 'EB6834', '7C5CD6', '0F9D76'],
      cards: ['2A78D6', 'EB6834', '0F9D76'],
      badge: '24549E',
      bandFg: { 하: '0F7A48', 중: '9C6200', 상: 'CC2222' },
      bandBg: { 하: 'E6F6EE', 중: 'FFF3DD', 상: 'FDEAEA' },
    }
  : {
      // 로고에서 뽑은 색 — 붉은 원, 골드 전구, 네이비 π
      dark: 'C63D2E', dark2: 'A5301F', onDark: 'F5C7BC', big: 'F2B733',
      head: '1E3A5C', acc: 'C63D2E', acc2: 'D99A1F',
      soft: 'F8F5F2', mine: 'FBEAE6', line: 'E8E2DD',
      series: ['C63D2E', '1E3A5C', 'D99A1F', '4E7A5E'],
      cards: ['C63D2E', '1E3A5C', 'D99A1F'],
      badge: '1E3A5C',   // 붉은 바탕 위에서도 번호가 또렷하게 보이도록 로고의 네이비를 쓴다
      bandFg: { 하: '2F6B45', 중: '8A6314', 상: '9E2B1C' },
      bandBg: { 하: 'E9F2EC', 중: 'FBF0DA', 상: 'F6E0DC' },
    };
const NAVY = P.dark, NAVY2 = P.dark2, ICE = P.onDark;   // 어두운 표지형 슬라이드용
const HEAD = P.head, BLUE = P.acc, ORANGE = P.acc2;     // 밝은 본문 슬라이드용
const SOFT = P.soft, MINE = P.mine, LINE = P.line;
const INK = '101418', INK2 = '4B5563', MUT = '8A92A0';
const WHITE = 'FFFFFF';
const SERIES = P.series;
const DPAL = [...P.series, 'C2185B', '8A92A0', '3E7CB1'];   // 도넛(단원 수가 많을 때)
const FONT = '맑은 고딕';                 // 한국어 윈도우 기본 글꼴
const W = 13.333, H = 7.5;               // LAYOUT_WIDE
const M = 0.6;                           // 기본 여백

// ── PNG 크기 읽기 (가로세로 비율 유지용) ────────────────
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function localImg(url) {
  if (!url || !IMGMAP[url]) return null;
  const fp = path.join(IMG_DIR, IMGMAP[url]);
  if (!fs.existsSync(fp)) return null;
  return { path: fp, ...pngSize(fp) };
}

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.author = '루멘수학';
pres.title = `${A.title} 출제경향 분석`;

// ── 공통 조각 ──────────────────────────────────────────
// 어두운 표지형 슬라이드 바탕
function darkSlide() {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape(pres.ShapeType.ellipse, { x: W - 2.6, y: -1.9, w: 5.2, h: 5.2, fill: { color: NAVY2 }, line: { color: NAVY2 } });
  return s;
}
// 밝은 본문 슬라이드 + 제목
function contentSlide(title, sub) {
  const s = pres.addSlide();
  s.background = { color: WHITE };
  s.addText(title, {
    x: M, y: 0.42, w: W - M * 2, h: 0.62, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 30, bold: true, color: HEAD, valign: 'middle',
  });
  if (sub) s.addText(sub, {
    x: M, y: 1.06, w: W - M * 2, h: 0.36, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 14, color: INK2, valign: 'middle',
  });
  return s;
}
// 작은 알약 배지 — 글자 폭을 대략 계산해 넘치지 않게 한다
function pillWidth(text, fontSize) {
  let u = 0;
  for (const ch of String(text)) u += /[ㄱ-힝]/.test(ch) ? 1 : (/[\s.·]/.test(ch) ? 0.35 : 0.58);
  return 0.22 + u * (fontSize / 72) * 1.02;
}
function addPill(s, x, y, text, bg, fg, fontSize = 11) {
  const w = pillWidth(text, fontSize);
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h: 0.28, rectRadius: 0.14, fill: { color: bg }, line: { color: bg } });
  s.addText(text, {
    x, y, w, h: 0.28, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize, bold: true, color: fg, align: 'center', valign: 'middle',
  });
  return x + w + 0.12;
}
// 번호 원형 배지 — 이 자료 전체를 관통하는 시각 모티프
function addNumBadge(s, x, y, d, n, bg = NAVY, fg = WHITE) {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg } });
  s.addText(String(n), {
    x, y, w: d, h: d, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: Math.round(d * 34), bold: true, color: fg, align: 'center', valign: 'middle',
  });
}
function card(s, x, y, w, h, fill = SOFT) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: LINE, width: 1 },
    shadow: { type: 'outer', color: '000000', opacity: 0.10, blur: 8, offset: 2, angle: 90 },
  });
}
const bandOf = d => (d == null ? null : d <= 2 ? '하' : d <= 4 ? '중' : d <= 6 ? '상' : '최상');
const bandColor = b => P.bandFg[b] || P.bandFg['상'];
const bandBg = b => P.bandBg[b] || P.bandBg['상'];

// 표지 제목 — "중2 2학기"처럼 숫자가 붙어 읽히지 않도록 "2학년"으로 풀어 쓴다
const gradeNum = (String(A.grade).match(/(\d)/) || [])[1];
const coverTitle = gradeNum
  ? `${A.school} ${gradeNum}학년 ${A.semester}학기 ${A.term}고사`
  : A.title;

// ── 1. 표지 ────────────────────────────────────────────
{
  const s = darkSlide();
  s.addText('LUMEN MATH · 루멘수학', {
    x: M, y: 1.5, w: 8, h: 0.34, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 13, bold: true, color: ICE, charSpacing: 3,
  });
  s.addText(coverTitle, {
    x: M, y: 1.95, w: 11.5, h: 0.85, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 38, bold: true, color: WHITE,
  });
  s.addText('수학 출제경향 분석', {
    x: M, y: 2.82, w: 11.5, h: 0.95, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 46, bold: true, color: P.big,
  });
  const sub = A.peer
    ? `${A.school} ${A.anchorYear}년 기출 + 인근 학교 ${A.peerNames.length}회분 · 총 ${A.totalN}문항 분석`
    : `${A.labels.join(' · ')} 실제 기출 ${A.exams.length}회분 · ${A.totalN}문항 분석`;
  s.addText(sub, {
    x: M, y: 3.95, w: 11.5, h: 0.4, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 17, color: ICE,
  });
  let px = M;
  px = addPill(s, px, 4.65, `실제 기출 근거`, NAVY2, WHITE, 12);
  px = addPill(s, px, 4.65, A.school, NAVY2, WHITE, 12);
  addPill(s, px, 4.65, A.today, NAVY2, WHITE, 12);
  s.addNotes(`${A.title} 출제경향 발표 자료. 근거: 수학비서 기출 문항 DB.`);
}

// ── 2. 한눈에 보기 ─────────────────────────────────────
{
  const s = contentSlide('한눈에 보기', '이번 시험, 어디를 먼저 공부해야 하는가');
  const items = [
    {
      big: A.topShare != null ? `${A.topShare}%` : `${(A.unitByKey[A.keys[0]] || {})[A.topUnit] || ''}문항`,
      lab: '배점 1위 단원',
      txt: `${A.topUnit}\n${A.school} ${A.anchorYear}년 시험에서 가장 큰 비중`,
      col: P.cards[0],
    },
    {
      big: `${A.repeated.length}개`,
      lab: A.peer ? '반복 출제 유형' : '매년 나온 유형',
      txt: A.peer
        ? `2개 이상 시험지에 반복\n그중 ★ ${A.school} 출제 ${A.mineRepN}개`
        : `분석한 모든 연도에 빠짐없이 출제\n올해도 나올 가능성이 가장 높다`,
      col: P.cards[1],
    },
    {
      big: A.repPct != null ? `${A.repPct}%` : `${A.essays.length}문항`,
      lab: A.repPct != null ? '반복 유형이 차지한 배점' : '서술형 문항',
      txt: A.repPct != null
        ? `${A.school} ${A.anchorYear}년 ${A.repScoreLatest}점\n반복 유형만 잡아도 이만큼`
        : `${A.essayUnits.join(', ')} 단원`,
      col: P.cards[2],
    },
  ];
  items.forEach((it, i) => {
    const x = M + i * 4.15, w = 3.85;
    card(s, x, 1.85, w, 4.45, WHITE);
    s.addShape(pres.ShapeType.roundRect, { x, y: 1.85, w, h: 1.85, rectRadius: 0.12, fill: { color: it.col }, line: { color: it.col } });
    s.addText(it.big, {
      x: x + 0.28, y: 1.98, w: w - 0.56, h: 1.1, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 54, bold: true, color: WHITE, valign: 'middle',
    });
    s.addText(it.lab, {
      x: x + 0.28, y: 3.08, w: w - 0.56, h: 0.36, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 14, bold: true, color: WHITE,
    });
    s.addText(it.txt, {
      x: x + 0.28, y: 3.95, w: w - 0.56, h: 2.2, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 17, color: INK, lineSpacingMultiple: 1.4, valign: 'top',
    });
  });
  s.addNotes('이 세 장이 오늘 이야기의 전부다. 나머지 슬라이드는 근거.');
}

// ── 3. 시험 개요 ───────────────────────────────────────
{
  const s = contentSlide('시험 개요', A.peer
    ? `분석에 쓴 시험지 ${A.exams.length}회분 — ★ 가 ${A.school} 실제 기출입니다`
    : `최근 ${A.exams.length}개년 실제 시험지의 문항 구성`);
  const n = A.exams.length;
  const gap = 0.28, tw = (W - M * 2 - gap * (n - 1)) / n;
  A.exams.forEach((e, i) => {
    const x = M + i * (tw + gap);
    card(s, x, 1.85, tw, 2.85, e.anchor ? MINE : SOFT);
    s.addText((e.anchor ? '★ ' : '') + e.label, {
      x: x + 0.24, y: 2.05, w: tw - 0.48, h: 0.36, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 15, bold: true, color: e.anchor ? BLUE : INK2,
    });
    s.addText([{ text: String(e.n), options: { fontSize: 40, bold: true, color: HEAD } },
               { text: ' 문항', options: { fontSize: 15, color: INK2 } }], {
      x: x + 0.24, y: 2.5, w: tw - 0.48, h: 0.9, isTextBox: true, margin: 0,
      fontFace: FONT, valign: 'middle',
    });
    s.addText(`객관식 ${e.choice} · 서술형 ${e.essay}${e.total ? `\n${e.total}점 만점` : ''}`, {
      x: x + 0.24, y: 3.5, w: tw - 0.48, h: 0.95, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 14, color: INK2, lineSpacingMultiple: 1.3,
    });
  });
  if (A.scope) {
    card(s, M, 5.1, W - M * 2, 1.3, SOFT);
    s.addText(`시험 범위 (${A.school} ${A.anchorYear}년 기준)`, {
      x: M + 0.3, y: 5.28, w: W - M * 2 - 0.6, h: 0.3, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 12.5, bold: true, color: MUT,
    });
    s.addText(A.scope, {
      x: M + 0.3, y: 5.62, w: W - M * 2 - 0.6, h: 0.55, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 17, bold: true, color: INK,
    });
  }
  if (A.peer) s.addText(`※ ${A.school} 기출은 현행 교육과정 기준 ${A.anchorYear}년 1회분만 있습니다. 같은 학군 ${A.peerNames.join(', ')} 시험을 함께 분석했습니다.`, {
    x: M, y: 6.62, w: W - M * 2, h: 0.4, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 12, color: MUT,
  });
}

// ── 4. 단원별 출제 비중 (가로 막대) ─────────────────────
{
  const s = contentSlide('단원별 출제 비중', '단원마다 몇 문항이 나왔는지 비교했습니다');
  const cats = A.unitSet.slice().reverse();   // 가로막대는 아래→위로 그려져 순서를 뒤집는다
  const data = A.keys.map((k, i) => ({
    name: A.labels[i],
    labels: cats,
    values: cats.map(u => (A.unitByKey[k] || {})[u] || 0),
  }));
  s.addChart(pres.ChartType.bar, data, {
    x: M, y: 1.6, w: W - M * 2, h: 5.3, barDir: 'bar', barGrouping: 'clustered', barGapWidthPct: 45,
    chartColors: SERIES, showLegend: A.keys.length > 1, legendPos: 't', legendFontSize: 12, legendColor: INK2,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelColor: INK2, dataLabelFontFace: FONT,
    dataLabelFormatCode: '#,##0;;;',
    catAxisLabelColor: INK, catAxisLabelFontSize: 13, catAxisLabelFontFace: FONT,
    valAxisLabelColor: MUT, valAxisLabelFontSize: 10, valAxisHidden: true,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
  });
  s.addNotes('가장 긴 막대가 곧 공부 순서다.');
}

// ── 5. 단원별 배점 비중 (도넛) ─────────────────────────
if (A.unitScoreTotal >= 90) {
  const s = contentSlide('단원별 배점 비중', `${A.school} ${A.anchorYear}년 실제 시험에서 단원별로 몇 점이 걸려 있는가`);
  const units = A.unitSet.filter(u => A.unitScore[u]).sort((a, b) => A.unitScore[b] - A.unitScore[a]);
  s.addChart(pres.ChartType.doughnut, [{ name: '배점', labels: units, values: units.map(u => A.unitScore[u]) }], {
    x: 0.5, y: 1.6, w: 6.6, h: 5.2, holeSize: 52,
    chartColors: DPAL,
    showLegend: false, showValue: true, dataLabelPosition: 'ctr',
    dataLabelFontSize: 12, dataLabelColor: WHITE, dataLabelFontFace: FONT, dataLabelFormatCode: '0"점"',
  });
  units.forEach((u, i) => {
    const y = 1.85 + i * 0.72;
    const pct = Math.round(A.unitScore[u] / A.unitScoreTotal * 100);
    s.addShape(pres.ShapeType.roundRect, {
      x: 7.4, y, w: 0.26, h: 0.26, rectRadius: 0.08,
      fill: { color: DPAL[i % DPAL.length] }, line: { color: DPAL[i % DPAL.length] },
    });
    s.addText(u, {
      x: 7.8, y: y - 0.03, w: 3.5, h: 0.33, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 15, bold: true, color: INK, valign: 'middle',
    });
    s.addText(`${A.unitScore[u]}점 · ${pct}%`, {
      x: 11.35, y: y - 0.03, w: 1.4, h: 0.33, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 14, bold: true, color: i === 0 ? BLUE : INK2, align: 'right', valign: 'middle',
    });
  });
}

// ── 6. 난이도 분포 ─────────────────────────────────────
{
  const s = contentSlide('난이도 분포', '문항 난이도를 하 · 중 · 상으로 묶었습니다');
  const bands = A.diffBands.filter(b => A.keys.some(k => (A.diffByKey[k] || {})[b]));
  s.addChart(pres.ChartType.bar, A.keys.map((k, i) => ({
    name: A.labels[i], labels: bands, values: bands.map(b => (A.diffByKey[k] || {})[b] || 0),
  })), {
    x: M, y: 1.7, w: W - M * 2, h: 5.1, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 55,
    chartColors: SERIES, showLegend: A.keys.length > 1, legendPos: 't', legendFontSize: 12, legendColor: INK2,
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: INK2, dataLabelFontFace: FONT,
    dataLabelFormatCode: '#,##0;;;',
    catAxisLabelColor: INK, catAxisLabelFontSize: 16, catAxisLabelFontFace: FONT,
    valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
  });
}

// ── 7. 섹션 표지 — 반복 유형 ───────────────────────────
const mineTypes = A.repeated.filter(r => r.mine);
const useOnlyMine = ONLY_MINE || (A.peer && A.repeated.length > 12 && mineTypes.length >= 5);
const slideTypes = useOnlyMine ? mineTypes : A.repeated;
const restTypes = useOnlyMine ? A.repeated.filter(r => !r.mine) : [];
{
  const s = darkSlide();
  s.addText(A.peer ? '반복 출제되는 유형' : '매년 반복 출제된 유형', {
    x: M, y: 2.2, w: 9, h: 0.7, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 24, bold: true, color: P.big,
  });
  s.addText([{ text: String(slideTypes.length), options: { fontSize: 110, bold: true, color: WHITE } },
             { text: ' 개', options: { fontSize: 40, bold: true, color: P.big } }], {
    x: M, y: 2.85, w: 9, h: 1.6, isTextBox: true, margin: 0, fontFace: FONT, valign: 'middle',
  });
  s.addText(useOnlyMine
    ? `${A.school}에 실제로 출제된 반복 유형입니다. 지금부터 하나씩, 실제 기출 문제와 함께 봅니다.`
    : (A.peer
      ? '2개 이상 시험지에 반복해서 나온 유형입니다. 지금부터 하나씩, 실제 기출 문제와 함께 봅니다.'
      : '분석한 모든 연도에 빠짐없이 나온 유형입니다. 지금부터 하나씩, 실제 기출 문제와 함께 봅니다.'), {
    x: M, y: 4.6, w: 10.5, h: 0.9, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 17, color: ICE, lineSpacingMultiple: 1.3,
  });
}

// ── 8. 유형별 슬라이드 ─────────────────────────────────
slideTypes.forEach((t, i) => {
  const s = pres.addSlide();
  s.background = { color: WHITE };
  addNumBadge(s, M, 0.42, 0.56, i + 1, t.mine ? BLUE : NAVY);
  s.addText(t.name, {
    x: M + 0.76, y: 0.36, w: W - M * 2 - 0.76, h: 0.7, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 23, bold: true, color: HEAD, valign: 'middle',
  });
  // 배지 줄 — 단원 · 출제 · 배점 · 난이도 · 시간
  let px = M;
  px = addPill(s, px, 1.2, t.unit, 'EEF1F6', INK2, 12);
  if (A.peer && t.mine) px = addPill(s, px, 1.2, `★ ${A.school} 출제`, BLUE, WHITE, 12);
  if (A.peer) px = addPill(s, px, 1.2, `${t.nEx}개 시험지`, 'EEF1F6', INK2, 12);
  const rep = t.rep || {};
  if (rep.score) px = addPill(s, px, 1.2, `${rep.score}점`, 'EEF1F6', INK2, 12);
  const band = bandOf(rep.diff);
  if (band) px = addPill(s, px, 1.2, `난이도 ${band}`, bandBg(band), bandColor(band), 12);
  if (rep.time) px = addPill(s, px, 1.2, `${rep.time}분`, 'EEF1F6', INK2, 12);
  if (rep.essay) px = addPill(s, px, 1.2, '서술형 출제', 'EDEAFD', '5747C9', 12);

  // 대표 문항 이미지 — 우리 학교 것 우선
  const isMineItem = it => A.peer && it.label === A.anchorLabel;
  const item = (t.items.find(it => it.label === A.anchorLabel && localImg(it.img))
    || t.items.find(it => localImg(it.img)) || null);
  const img = item ? localImg(item.img) : null;

  const textW = img ? 5.75 : W - M * 2;
  const cardY = 1.68, cardH = 5.25;
  card(s, M, cardY, textW, cardH, SOFT);
  // 개념 글의 줄 수를 어림해 카드 안에서 위아래 가운데에 오도록 배치한다
  const body = t.concept || '핵심 정리 준비 중입니다.';
  const bodyFS = img ? 15 : 17;
  const perLine = Math.max(10, ((textW - 0.6) * 72) / bodyFS);
  let cu = 0; for (const ch of body) cu += /[ㄱ-힣]/.test(ch) ? 1 : 0.55;
  const bodyH = Math.min(cardH - 1.1, Math.ceil(cu / perLine) * (bodyFS * 1.52 / 72) + 0.1);
  const top = cardY + Math.max(0.2, (cardH - (0.32 + 0.14 + bodyH)) / 2);
  s.addText('이것만은 알고 가자', {
    x: M + 0.3, y: top, w: textW - 0.6, h: 0.32, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 13, bold: true, color: BLUE, charSpacing: 1,
  });
  s.addText(body, {
    x: M + 0.3, y: top + 0.46, w: textW - 0.6, h: bodyH, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: bodyFS, color: INK, lineSpacingMultiple: 1.5, valign: 'top',
  });

  if (img) {
    const bx = M + textW + 0.35, bw = W - M - bx;
    // 캡션(출처·번호·정답) + 문제 이미지
    const capH = 0.42;
    card(s, bx, 1.68, bw, 5.25, WHITE);
    s.addShape(pres.ShapeType.rect, { x: bx, y: 1.68, w: bw, h: capH, fill: { color: isMineItem(item) ? MINE : SOFT }, line: { color: LINE, width: 1 } });
    const ans = item.answer ? (item.essay ? '서술형' : String(item.answer)) : null;
    s.addText(`${isMineItem(item) ? '★ ' : ''}${item.label} · ${item.no}번${item.score ? ` · ${item.score}점` : ''}${ans ? `   정답 ${ans}` : ''}`, {
      x: bx + 0.18, y: 1.68, w: bw - 0.36, h: capH, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 12, bold: true, color: isMineItem(item) ? BLUE : INK2, valign: 'middle',
    });
    // 비율을 지키며 남은 공간에 맞춘다
    const availW = bw - 0.44, availH = 5.25 - capH - 0.36;
    const scale = Math.min(availW / img.w, availH / img.h);
    const iw = img.w * scale, ih = img.h * scale;
    s.addImage({ path: img.path, x: bx + (bw - iw) / 2, y: 1.68 + capH + 0.18 + (availH - ih) / 2, w: iw, h: ih });
  }
  s.addNotes(`${t.name} — ${t.unit}. ${A.peer ? `${t.nEx}개 시험지에 출제${t.mine ? `, ${A.school} 포함` : ''}.` : ''} ${t.conceptSrc ? `근거: ${t.conceptSrc}.` : '개념 설명은 교재 검수 전 초안.'}`);
});

// ── 9. (낱장에서 뺀) 나머지 반복 유형 목록 ──────────────
if (restTypes.length) {
  const s = contentSlide('그 밖에 이 범위에서 자주 나오는 유형', `${A.school}에는 아직 안 나왔지만 인근 학교에서 반복된 유형입니다 — 올해 나올 수 있습니다`);
  const rows = [[
    { text: '유형', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '단원', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '출제', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '난이도', options: { bold: true, color: MUT, fontSize: 12 } },
  ]];
  restTypes.forEach(t => {
    const band = bandOf((t.rep || {}).diff);
    rows.push([
      { text: t.name, options: { bold: true, color: INK, fontSize: 13 } },
      { text: t.unit, options: { color: INK2, fontSize: 13 } },
      { text: `${t.nEx}개 시험지`, options: { color: INK2, fontSize: 13 } },
      { text: band || '-', options: { color: band ? bandColor(band) : INK2, bold: true, fontSize: 13 } },
    ]);
  });
  s.addTable(rows, {
    x: M, y: 1.75, w: W - M * 2, colW: [6.0, 2.9, 1.7, 1.53], border: { type: 'solid', color: LINE, pt: 1 },
    fontFace: FONT, rowH: 0.52, valign: 'middle', margin: [5, 8, 5, 8],
  });
}

// ── 10. 고난도 문항 위치 ───────────────────────────────
if (A.hard.length) {
  const s = contentSlide('고난도 문항 — 점수가 갈리는 자리', '난이도 상 이상 문항이 나온 위치입니다. 상위권을 노린다면 여기를 집중 대비하세요.');
  const rows = [[
    { text: A.peer ? '출처' : '연도', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '번호', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '단원', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '세부유형', options: { bold: true, color: MUT, fontSize: 12 } },
  ]];
  A.hard.slice(0, 12).forEach(e => rows.push([
    { text: (e.anchor ? '★ ' : '') + e.label, options: { color: e.anchor ? BLUE : INK2, bold: !!e.anchor, fontSize: 12.5 } },
    { text: `${e.no}번`, options: { color: INK2, fontSize: 12.5 } },
    { text: e.unit, options: { color: INK2, fontSize: 12.5 } },
    { text: e.type + (e.essay ? '  (서술형)' : ''), options: { color: INK, bold: true, fontSize: 12.5 } },
  ]));
  s.addTable(rows, {
    x: M, y: 1.68, w: W - M * 2, colW: [2.3, 0.9, 2.7, 6.23], border: { type: 'solid', color: LINE, pt: 1 },
    fontFace: FONT, rowH: 0.38, valign: 'middle', margin: [3, 8, 3, 8],
  });
  if (A.peer) s.addText(`※ 인근 학교는 시험 범위가 조금씩 다릅니다. ★ ${A.school} 행을 먼저 보세요.`, {
    x: M, y: 6.95, w: W - M * 2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 11.5, color: MUT,
  });
}

// ── 11. 서술형 출제 위치 ───────────────────────────────
if (A.essays.length) {
  const s = contentSlide('서술형은 여기서 나온다', '풀이 과정을 채점합니다. 답만 맞히는 연습으로는 점수를 못 받습니다.');
  const rows = [[
    { text: A.peer ? '출처' : '연도', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '번호', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '단원', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '세부유형', options: { bold: true, color: MUT, fontSize: 12 } },
    { text: '배점', options: { bold: true, color: MUT, fontSize: 12 } },
  ]];
  A.essays.slice(0, 12).forEach(e => rows.push([
    { text: (e.anchor ? '★ ' : '') + e.label, options: { color: e.anchor ? BLUE : INK2, bold: !!e.anchor, fontSize: 12.5 } },
    { text: `${e.no}번`, options: { color: INK2, fontSize: 12.5 } },
    { text: e.unit, options: { color: INK2, fontSize: 12.5 } },
    { text: e.type, options: { color: INK, bold: true, fontSize: 12.5 } },
    { text: e.score ? `${e.score}점` : '-', options: { color: ORANGE, bold: true, fontSize: 12.5 } },
  ]));
  s.addTable(rows, {
    x: M, y: 1.68, w: W - M * 2, colW: [2.3, 0.9, 2.5, 5.53, 0.9], border: { type: 'solid', color: LINE, pt: 1 },
    fontFace: FONT, rowH: 0.38, valign: 'middle', margin: [3, 8, 3, 8],
  });
}

// ── 12. 마무리 — 대비 포인트 ───────────────────────────
{
  const s = darkSlide();
  s.addText('오늘부터 이렇게 하자', {
    x: M, y: 0.75, w: 10, h: 0.8, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 34, bold: true, color: WHITE,
  });
  const points = [
    { t: `${A.topUnit} 먼저, 가장 깊게`, d: A.topShare != null ? `배점의 ${A.topShare}%가 이 단원에 걸려 있습니다.` : '출제 비중이 가장 큰 단원입니다.' },
    {
      t: `반복 유형 ${slideTypes.length}개는 유사 문제까지`,
      d: A.repPct != null ? `이 유형들만으로 ${A.anchorYear}년 시험 ${A.repScoreLatest}점(${A.repPct}%)이 나왔습니다.` : '한 번 나온 유형은 또 나옵니다.',
    },
    { t: '서술형은 풀이 과정을 쓰는 연습까지', d: `${A.essayUnits.join(', ')} 단원을 특히 조심하세요.` },
    { t: '틀린 문제는 그날 아하노트에', d: '같은 유형을 두 번 틀리지 않는 것이 점수를 올리는 가장 빠른 길입니다.' },
  ].filter(p => p.d);
  points.forEach((p, i) => {
    const y = 1.85 + i * 1.28;
    addNumBadge(s, M, y, 0.6, i + 1, i === 0 ? P.big : P.badge, i === 0 ? P.head : WHITE);
    s.addText(p.t, {
      x: M + 0.85, y: y - 0.05, w: 11.2, h: 0.42, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 21, bold: true, color: WHITE, valign: 'middle',
    });
    s.addText(p.d, {
      x: M + 0.85, y: y + 0.4, w: 11.2, h: 0.4, isTextBox: true, margin: 0,
      fontFace: FONT, fontSize: 14.5, color: ICE, valign: 'middle',
    });
  });
  s.addText(`루멘수학 내부 제작 자료 · ${A.peer ? `${A.school} ${A.anchorYear}년 기출 + 인근 학교 기출` : `${A.labels.join('·')} ${A.school} 기출`} 근거 · ${A.today}`, {
    x: M, y: 6.85, w: W - M * 2, h: 0.3, isTextBox: true, margin: 0,
    fontFace: FONT, fontSize: 11, color: '7C8DAE',
  });
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log(`PPT 저장: ${OUT}`);
  console.log(`  유형 슬라이드 ${slideTypes.length}개${restTypes.length ? ` (+ 목록으로 넘긴 유형 ${restTypes.length}개)` : ''}`);
});
