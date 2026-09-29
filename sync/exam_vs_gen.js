#!/usr/bin/env node
/* 두 학교 기출 비교 리포트 생성기 (A안 — 통계 비교판)
 *
 * 같은 해·같은 학년·같은 시험을 치른 두 학교의 시험지를 나란히 비교한다.
 * 비교 축 네 개: ① 난이도 분포 ② 문항번호별 난이도 곡선 ③ 답형식(객관식/단답/서술)
 *                ④ 교과서 연계율(수학비서 교과서 DB와 세부유형 대조)
 *
 * 사용법:
 *   1) 먼저 시험지·교과서 DB를 수집한다 (문항 이미지는 받지 않는다)
 *      NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *        node sync/mathsecr_exam_collector.js --ids 707019,387493,703025,435860,303175,386426,386436,346993
 *   2) 리포트를 만든다
 *      node sync/exam_vs_gen.js \
 *        --data sync/_debug/ms_exams_ids.json \
 *        --a 소래고 --b 소사고 \
 *        --pair 2024:707019:387493 --pair 2025:703025:435860 \
 *        --tb 미래엔:303175,386426 --tb 비상:386436,346993 \
 *        --title "소래고 · 소사고 고1 2학기 기말 비교" \
 *        --out docs/exam_reports/sorae_vs_sosa_g1_2fin.html \
 *        --analysis sync/_debug/sorae_vs_sosa.json
 *
 * 인자:
 *   --pair <라벨>:<A학교 시험지id>:<B학교 시험지id>   (여러 번 지정 = 여러 해)
 *   --tb   <교과서이름>:<시험지id,시험지id,...>        (여러 번 지정 = 여러 출판사)
 *   --analysis <파일>  집계 결과를 JSON으로도 내보낸다 (PPT·다른 산출물이 같은 숫자를 쓰도록)
 *
 * ⚠️ 결과 HTML에는 문항 이미지가 들어가지 않는다(수학비서 구매 콘텐츠).
 *    그래서 docs/ 에 커밋해도 된다. 이미지를 넣으려면 별도 산출물로 만들고 커밋하지 말 것.
 * ⚠️ 수학비서의 배점은 추정치라 합이 100이 아닌 경우가 있다. SCORE_FIX 로 보정하고
 *    보정 내역을 리포트 맨 아래에 그대로 적는다(숨기지 않는다).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const argAll = n => args.reduce((a, v, i) => (v === '--' + n && args[i + 1] ? a.concat(args[i + 1]) : a), []);

const DATA = arg('data', 'sync/_debug/ms_exams_ids.json');
const NAME_A = arg('a', 'A학교');
const NAME_B = arg('b', 'B학교');
const OUT = arg('out', 'docs/exam_reports/vs.html');
const ANALYSIS = arg('analysis', null);
const TITLE = arg('title', `${NAME_A} · ${NAME_B} 비교`);
const PAIRS = argAll('pair').map(s => { const [label, a, b] = s.split(':'); return { label, a: Number(a), b: Number(b) }; });
const TBS = argAll('tb').map(s => { const i = s.indexOf(':'); return { name: s.slice(0, i), ids: s.slice(i + 1).split(',').map(Number) }; });

/* ── 배점 보정 ────────────────────────────────────────────────
 * 수학비서 DB의 배점이 틀린 것을 직접 확인해 고친 값. 근거를 반드시 남긴다. */
const SCORE_FIX = {
  387493: { 4: 4.4, 6: 4.5 },  // 4·6번이 44·45로 저장돼 있었다(소수점 누락). 고치면 합계 180.1 → 100.0
  707019: { 21: 6 },           // 21번 배점이 비어 있었다. 저장소 해설집 보정본(총 100)의 6점을 쓴다
};
const FIX_NOTE = [
  `${NAME_B} 2024 · 4번과 6번 배점이 <b>44점·45점</b>으로 저장돼 있었다(소수점 누락). 4.4점·4.5점으로 고치면 배점 합계가 180.1점에서 <b>정확히 100점</b>이 된다.`,
  `${NAME_A} 2024 · 21번 배점이 <b>비어 있었다</b>. 저장소의 해설집 보정본에 따라 6점으로 넣어 합계 100점을 맞췄다.`,
  `${NAME_B} 2025 · 배점 합계가 <b>100.4점</b>으로 0.4점 넘친다. 수학비서 배점은 추정치이므로 그대로 두고 표기만 했다.`,
];

/* ── 공통 도구 ───────────────────────────────────────────── */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clean = s => String(s || '').replace(/^\d+\s+/, '');           // "06 집합의 연산" → "집합의 연산"
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const r1 = n => (Math.round(n * 10) / 10).toFixed(1);

// 수학비서 난이도(1~8)를 학원에서 쓰는 4단계로 묶는다
const BANDS = ['하', '중', '상', '최상'];
const band = d => (d == null ? null : d <= 2 ? '하' : d <= 4 ? '중' : d <= 6 ? '상' : '최상');
// 답형식
const TYPE_KO = { single_choice: '객관식', short_answer: '단답형', integer_answer: '단답형', long_answer: '서술형' };
const typeKo = t => TYPE_KO[t] || '기타';
const isChoice = t => t === 'single_choice';

const key4 = c => (c.chapters || []).slice(0, 4).join(' > ');   // 유형까지
const key5 = c => (c.chapters || []).slice(0, 5).join(' > ');   // 세부유형까지
const unitOf = c => clean((c.chapters || [])[1] || '');         // 중단원
const leafOf = c => clean((c.chapters || []).slice(-1)[0] || '');

/* ── 데이터 읽기 ─────────────────────────────────────────── */
const raw = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const byId = {};
raw.forEach(e => { byId[e.id] = e; });

function exam(id) {
  const e = byId[id];
  if (!e) throw new Error(`시험지 ${id} 가 ${DATA} 에 없습니다. 먼저 mathsecr_exam_collector.js 로 수집하세요.`);
  const fix = SCORE_FIX[id] || {};
  const cells = e.cells
    .map(c => ({ ...c, score: fix[c.no] != null ? fix[c.no] : c.score }))
    .sort((x, y) => x.no - y.no);
  return { ...e, cells };
}

/* ── 교과서 유형 사전 ────────────────────────────────────── */
const books = TBS.map(tb => {
  const cells = tb.ids.flatMap(id => exam(id).cells);
  return {
    name: tb.name,
    ids: tb.ids,
    titles: tb.ids.map(id => byId[id].title),
    n: cells.length,
    s4: new Set(cells.map(key4).filter(Boolean)),
    s5: new Set(cells.map(key5).filter(Boolean)),
  };
});
const anyBook4 = c => books.some(b => b.s4.has(key4(c)));

/* ── 시험지 한 장 집계 ───────────────────────────────────── */
function stat(id, school) {
  const e = exam(id);
  const cs = e.cells;
  const n = cs.length;
  const ds = cs.map(c => c.difficulty).filter(d => d != null);
  const bandN = {}; BANDS.forEach(b => (bandN[b] = 0));
  ds.forEach(d => bandN[band(d)]++);
  const scoreTotal = cs.reduce((a, c) => a + (c.score || 0), 0);
  const nonChoice = cs.filter(c => !isChoice(c.answerType));
  const typeN = {};
  cs.forEach(c => { const k = typeKo(c.answerType); typeN[k] = (typeN[k] || 0) + 1; });
  return {
    id, school, title: e.title, n,
    sourcePath: e.sourcePath || null,
    units: [...new Set(cs.map(unitOf).filter(Boolean))],
    avgDiff: ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : null,
    bandN,
    scoreTotal,
    typeN,
    nonChoice: nonChoice.map(c => ({ no: c.no, type: typeKo(c.answerType), score: c.score, difficulty: c.difficulty })),
    nonChoiceScore: nonChoice.reduce((a, c) => a + (c.score || 0), 0),
    hard: cs.filter(c => (c.difficulty || 0) >= 5).map(c => c.no),
    // 교과서 연계
    link: books.map(b => ({
      name: b.name,
      m4: cs.filter(c => b.s4.has(key4(c))).length,
      m5: cs.filter(c => b.s5.has(key5(c))).length,
    })),
    linkAny4: cs.filter(anyBook4).length,
    offBook: cs.filter(c => !anyBook4(c)).map(c => ({
      no: c.no, difficulty: c.difficulty, band: band(c.difficulty),
      unit: unitOf(c), leaf: leafOf(c), score: c.score, type: typeKo(c.answerType),
    })),
    curve: cs.map(c => ({ no: c.no, d: c.difficulty, unit: unitOf(c), leaf: leafOf(c) })),
  };
}

const years = PAIRS.map(p => ({ label: p.label, A: stat(p.a, NAME_A), B: stat(p.b, NAME_B) }));

/* ── 색 (루멘수학 리포트 공통 팔레트 — dataviz 검증 통과: 인접쌍 ΔE 24.7 protan) ── */
const CA = '#2a78d6';   // A학교
const CB = '#eb6834';   // B학교

/* ══════════════════════════════════════════════════════════
 *  차트 1 — 난이도 분포 (묶은 막대, 가로)
 * ══════════════════════════════════════════════════════════ */
function diffBars(y) {
  const max = Math.max(...BANDS.map(b => Math.max(y.A.bandN[b], y.B.bandN[b])), 1);
  const rows = BANDS.filter(b => y.A.bandN[b] || y.B.bandN[b]).map(b => {
    const bar = (s, color) => {
      const v = s.bandN[b];
      const w = (v / max) * 100;
      return `<div class="bline" title="${esc(s.school)} ${esc(y.label)} · 난이도 ${b} ${v}문항 (${pct(v, s.n)}%)">
        <span class="bsch" style="color:${color}">${esc(s.school)}</span>
        <span class="btrack"><i class="bfill" style="width:${w.toFixed(1)}%;background:${color}"></i></span>
        <span class="bval">${v}문항 <em>${pct(v, s.n)}%</em></span></div>`;
    };
    return `<div class="brow"><div class="blab">난이도 ${b} <span class="bsub">${b === '하' ? '1~2' : b === '중' ? '3~4' : b === '상' ? '5~6' : '7~8'}</span></div>
      ${bar(y.A, CA)}${bar(y.B, CB)}</div>`;
  }).join('');
  return `<div class="chart">${rows}</div>`;
}

/* ══════════════════════════════════════════════════════════
 *  차트 2 — 문항번호별 난이도 곡선 (인라인 SVG)
 * ══════════════════════════════════════════════════════════ */
function curveSvg(y, idx) {
  const W = 760, H = 250, PL = 30, PR = 104, PT = 14, PB = 30;
  const maxNo = Math.max(y.A.n, y.B.n);
  const D0 = 1, D1 = 7;                                   // 난이도 축 (하1~2 · 중3~4 · 상5~6 · 최상7~)
  const x = no => PL + ((no - 1) / (maxNo - 1)) * (W - PL - PR);
  const yy = d => PT + (1 - (d - D0) / (D1 - D0)) * (H - PT - PB);

  // 난이도 구간 배경 (같은 색 계열 옅은→진한 = 순차 램프)
  const zones = [
    { lo: 1, hi: 2, lab: '하', fill: '#f4f7fc' },
    { lo: 2, hi: 4, lab: '중', fill: '#e9eff8' },
    { lo: 4, hi: 6, lab: '상', fill: '#dde6f4' },
    { lo: 6, hi: 7, lab: '최상', fill: '#d0dcef' },
  ].map(z => `<rect x="${PL}" y="${yy(z.hi).toFixed(1)}" width="${(W - PL - PR).toFixed(1)}" height="${(yy(z.lo) - yy(z.hi)).toFixed(1)}" fill="${z.fill}"/>
    <text x="${W - PR + 64}" y="${((yy(z.lo) + yy(z.hi)) / 2 + 4).toFixed(1)}" class="zlab">${z.lab}</text>`).join('');
  // 구간 라벨(오른쪽 끝)과 계열 이름표(마지막 점 옆)가 겹치지 않도록 x를 벌려 둔다

  // x축 눈금 (5문항마다 + 마지막)
  const ticks = [];
  for (let n = 1; n <= maxNo; n++) if (n === 1 || n === maxNo || n % 5 === 0) ticks.push(n);
  const xAxis = ticks.map(n => `<text x="${x(n).toFixed(1)}" y="${H - 10}" class="tick">${n}</text>`).join('');
  const yAxis = [2, 4, 6].map(d => `<text x="${PL - 7}" y="${(yy(d) + 4).toFixed(1)}" class="tick ta-e">${d}</text>`).join('');

  const series = (s, color) => {
    const pts = s.curve.filter(p => p.d != null);
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.no).toFixed(1)},${yy(p.d).toFixed(1)}`).join(' ');
    const dots = pts.map(p => `<g class="pt" data-sch="${esc(s.school)}" data-no="${p.no}" data-d="${p.d}" data-band="${band(p.d)}" data-unit="${esc(p.unit)}" data-leaf="${esc(p.leaf)}" data-color="${color}">
      <circle cx="${x(p.no).toFixed(1)}" cy="${yy(p.d).toFixed(1)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="2"/>
      <title>${esc(s.school)} ${p.no}번 · 난이도 ${p.d}(${band(p.d)}) · ${esc(p.unit)}</title></g>`).join('');
    const last = pts[pts.length - 1];
    return `<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}
      <text x="${(x(last.no) + 9).toFixed(1)}" y="${(yy(last.d) + 4).toFixed(1)}" class="elab" fill="${color}">${esc(s.school)}</text>`;
  };

  return `<figure class="fig">
  <svg viewBox="0 0 ${W} ${H}" class="cv" data-idx="${idx}" role="img"
       aria-label="${esc(y.label)} 문항번호별 난이도. ${esc(y.A.school)} 평균 ${r1(y.A.avgDiff)}, ${esc(y.B.school)} 평균 ${r1(y.B.avgDiff)}.">
    ${zones}${xAxis}${yAxis}
    <line x1="${PL}" y1="${H - PB}" x2="${W - PR}" y2="${H - PB}" stroke="#d6dce6" stroke-width="1"/>
    ${series(y.A, CA)}${series(y.B, CB)}
  </svg>
  <figcaption>문항 번호(가로) — 난이도(세로). 오른쪽으로 갈수록 뒷번호.</figcaption>
</figure>`;
}

/* ══════════════════════════════════════════════════════════
 *  차트 3 — 교과서 연계율
 * ══════════════════════════════════════════════════════════ */
function linkBars(y) {
  const row = (label, sub, getA, getB) => {
    const bar = (s, color, get) => {
      const v = get(s), p = pct(v, s.n);
      return `<div class="bline" title="${esc(s.school)} · ${esc(label)} ${v}/${s.n}문항 (${p}%)">
        <span class="bsch" style="color:${color}">${esc(s.school)}</span>
        <span class="btrack"><i class="bfill" style="width:${p}%;background:${color}"></i></span>
        <span class="bval"><em>${p}%</em> ${v}/${s.n}</span></div>`;
    };
    return `<div class="brow"><div class="blab">${esc(label)} <span class="bsub">${esc(sub)}</span></div>
      ${bar(y.A, CA, getA)}${bar(y.B, CB, getB)}</div>`;
  };
  const out = [];
  books.forEach((b, i) => {
    out.push(row(`${b.name} 교과서 — 유형까지`, '4단계 일치', s => s.link[i].m4, s => s.link[i].m4));
    out.push(row(`${b.name} 교과서 — 세부유형까지`, '5단계 일치 · 더 엄격한 기준', s => s.link[i].m5, s => s.link[i].m5));
  });
  out.push(row('두 교과서 중 하나라도 — 유형까지', '어느 교과서를 쓰든', s => s.linkAny4, s => s.linkAny4));
  return `<div class="chart">${out.join('')}</div>`;
}

/* ══════════════════════════════════════════════════════════
 *  표 — 문항별 난이도 (차트의 표 대체본)
 * ══════════════════════════════════════════════════════════ */
function curveTable(y) {
  const maxNo = Math.max(y.A.n, y.B.n);
  const cell = s => {
    const m = {}; s.curve.forEach(p => (m[p.no] = p.d));
    return Array.from({ length: maxNo }, (_, i) => {
      const d = m[i + 1];
      return d == null ? '<td class="tc mut">·</td>' : `<td class="tc"><span class="pill ${d <= 2 ? 'p-lo' : d <= 4 ? 'p-md' : 'p-hi'}">${d}</span></td>`;
    }).join('');
  };
  const head = Array.from({ length: maxNo }, (_, i) => `<th class="tc">${i + 1}</th>`).join('');
  return `<details class="tbl"><summary>문항별 난이도 표로 보기 — ${esc(y.label)}</summary>
  <div class="scrollx"><table class="grid"><thead><tr><th>문항</th>${head}</tr></thead><tbody>
  <tr><th style="color:${CA}">${esc(y.A.school)}</th>${cell(y.A)}</tr>
  <tr><th style="color:${CB}">${esc(y.B.school)}</th>${cell(y.B)}</tr>
  </tbody></table></div></details>`;
}

/* ══════════════════════════════════════════════════════════
 *  해석 문장 — 숫자에서 자동으로 뽑는다
 * ══════════════════════════════════════════════════════════ */
function readings() {
  const out = [];
  // ① 난이도 평균 — 같은 해 안에서 두 학교가 얼마나 벌어지는지로 본다
  const gaps = years.map(y => Math.abs(y.A.avgDiff - y.B.avgDiff));
  const maxGap = Math.max(...gaps);
  out.push(`<b>난이도 평균은 두 학교가 거의 같다.</b> ${years.map(y => `${y.label}년 ${NAME_A} ${r1(y.A.avgDiff)} · ${NAME_B} ${r1(y.B.avgDiff)}`).join(' / ')} — 같은 해 두 학교의 차이가 가장 컸을 때도 ${r1(maxGap)}에 그친다. "어느 학교가 더 어렵다"로 정리할 문제가 아니다.`);

  // ② 쉬운 문항 — 해마다 뒤집히는지, 한쪽으로 쏠리는지 먼저 판정하고 말한다
  const easy = years.map(y => ({ label: y.label, a: y.A.bandN['하'], b: y.B.bandN['하'] }));
  const signs = [...new Set(easy.map(r => Math.sign(r.a - r.b)).filter(s => s !== 0))];
  const zeros = easy.flatMap(r => [r.a === 0 ? `${r.label}년 ${NAME_A}` : null, r.b === 0 ? `${r.label}년 ${NAME_B}` : null].filter(Boolean));
  const detail = easy.map(r => `${r.label}년 ${NAME_A} ${r.a}개 · ${NAME_B} ${r.b}개`).join(' / ');
  if (signs.length > 1) {
    out.push(`<b>쉬운 문항을 주는지는 해마다 뒤집힌다.</b> 난이도 「하」 문항이 ${detail}. 한 학교의 성향이라기보다 <b>그 해 출제자의 선택</b>으로 봐야 한다.` +
      (zeros.length ? ` 다만 ${esc(zeros.join(', '))}처럼 <b>「하」가 아예 0개인 해</b>가 두 학교 모두에 한 번씩 있었다 — 앞번호에서 점수를 벌 수 있다고 전제하면 안 된다.` : ''));
  } else if (signs.length === 1) {
    const less = signs[0] > 0 ? NAME_B : NAME_A;
    out.push(`<b>대신 분포 모양이 다르다.</b> 난이도 「하」 문항이 ${detail} — 두 해 모두 ${esc(less)} 쪽이 <b>점수를 벌 쉬운 문항을 덜 준다</b>.`);
  }

  // 답형식
  const nc = years.map(y => ({ label: y.label, a: y.A.nonChoice.length, b: y.B.nonChoice.length }));
  const zero = nc.filter(x => x.a === 0 || x.b === 0);
  if (zero.length) {
    zero.forEach(z => {
      const who = z.a === 0 ? NAME_A : NAME_B;
      const other = z.a === 0 ? NAME_B : NAME_A;
      const otherN = z.a === 0 ? z.b : z.a;
      out.push(`<b>${z.label}년 ${esc(who)}는 전 문항이 객관식이다.</b> 같은 해 ${esc(other)}는 객관식이 아닌 문항이 ${otherN}개 있었다. 서술·단답 훈련의 필요도가 두 학교에서 갈린다.`);
    });
  }

  // 교과서 연계 — 세부유형 기준으로 가장 큰 차이
  let best = null;
  years.forEach(y => books.forEach((b, i) => {
    const pa = pct(y.A.link[i].m5, y.A.n), pb = pct(y.B.link[i].m5, y.B.n);
    if (!best || Math.abs(pa - pb) > Math.abs(best.pa - best.pb)) best = { y, b, pa, pb };
  }));
  if (best && Math.abs(best.pa - best.pb) >= 8) {
    const hi = best.pa > best.pb ? NAME_A : NAME_B;
    out.push(`<b>교과서를 얼마나 따라가는지는 다르다.</b> ${best.y.label}년 ${esc(best.b.name)} 교과서의 <b>세부유형</b>과 일치한 비율이 ${NAME_A} ${best.pa}% · ${NAME_B} ${best.pb}% — ${esc(hi)} 쪽이 교과서 유형을 더 그대로 낸다.`);
  }

  // 교과서 미수록
  const offDetail = years.map(y => `${y.label}년 ${NAME_A} ${y.A.offBook.length}문항 · ${NAME_B} ${y.B.offBook.length}문항`).join(' / ');
  out.push(`<b>두 교과서 어디에도 없는 유형</b>이 해마다 꾸준히 나온다 — ${offDetail}. 교과서만 돌려서는 만나지 못하는 자리이고, 대개 뒷번호·고난도에 몰려 있다(§7).`);
  return out;
}

/* ══════════════════════════════════════════════════════════
 *  HTML
 * ══════════════════════════════════════════════════════════ */
const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
const totalQ = years.reduce((a, y) => a + y.A.n + y.B.n, 0);

const tileRow = (label, fmtA, fmtB) => `<tr><th>${esc(label)}</th>${years.map(y => `<td class="va">${fmtA(y.A)}</td><td class="vb">${fmtB(y.B)}</td>`).join('')}</tr>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(TITLE)} — 루멘수학</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{--a:${CA};--b:${CB};--navy:#14274e;--ink:#101418;--ink2:#4b5563;--mut:#8a92a0;--bg:#eef1f6;--card:#fff;--line:#e3e7ee}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans KR','Apple SD Gothic Neo',sans-serif;background:var(--bg);color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:860px;margin:0 auto;padding:0 16px 70px}
.cover{background:linear-gradient(135deg,#14274e 0%,#1d3a6e 60%,#24549e 100%);color:#fff;border-radius:0 0 26px 26px;padding:44px 34px 36px;margin:0 -16px 26px;position:relative;overflow:hidden}
.cover::after{content:'';position:absolute;right:-70px;top:-70px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.06)}
.cbrand{font-size:13px;font-weight:900;letter-spacing:2.5px;color:#9fc1f5}
.ctitle{font-size:31px;font-weight:900;line-height:1.28;margin:10px 0 4px}
.csub{font-size:16px;font-weight:500;color:#c9d8f2}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}
.chip{font-size:12px;font-weight:700;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);border-radius:99px;padding:4px 12px}
.hl{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--a);border-radius:14px;padding:18px 22px;margin-bottom:26px;box-shadow:0 1px 4px rgba(20,39,78,.05)}
.hl h2{font-size:14px;font-weight:900;color:var(--a);letter-spacing:1px;margin-bottom:10px}
.hl li{margin:9px 0 9px 20px;font-size:14.5px}
.sec{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px 24px;margin-bottom:20px;box-shadow:0 1px 4px rgba(20,39,78,.05)}
.shead{display:flex;align-items:baseline;gap:10px;margin-bottom:4px}
.snum{font-size:12px;font-weight:900;color:#fff;background:var(--navy);border-radius:7px;padding:2px 8px;flex:none}
h2.st{font-size:17.5px;font-weight:900}
.desc{font-size:13px;color:var(--ink2);margin:2px 0 16px}
h3.yr{font-size:14px;font-weight:900;color:var(--navy);margin:20px 0 10px;padding-bottom:5px;border-bottom:2px solid var(--line)}
h3.yr:first-of-type{margin-top:4px}
/* 범례 */
.legend{display:flex;gap:16px;margin-bottom:14px;font-size:12.5px;color:var(--ink2);font-weight:700;flex-wrap:wrap}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3.5px;margin-right:6px;vertical-align:-1px}
/* 막대 */
.chart{margin-top:4px}
.brow{margin-bottom:16px}
.blab{font-size:13.5px;font-weight:800;margin-bottom:6px}
.bsub{font-size:11.5px;font-weight:600;color:var(--mut);margin-left:4px}
.bline{display:flex;align-items:center;gap:9px;margin-bottom:3px}
.bsch{font-size:11.5px;font-weight:800;width:52px;text-align:right;flex:none}
.btrack{flex:1;height:15px;background:#edf0f5;border-radius:5px;overflow:hidden;display:block}
.bfill{display:block;height:100%;border-radius:0 5px 5px 0}
.bval{font-size:12px;color:var(--ink2);width:92px;flex:none;font-weight:600}
.bval em{font-style:normal;font-weight:900;color:var(--ink)}
/* SVG */
.fig{margin:6px 0 2px}
.cv{width:100%;height:auto;display:block}
.cv text{font-family:'Noto Sans KR',sans-serif}
.tick{font-size:10.5px;fill:#8a92a0;text-anchor:middle;font-weight:600}
.tick.ta-e{text-anchor:end}
.zlab{font-size:10.5px;fill:#8a92a0;font-weight:700}
.elab{font-size:11.5px;font-weight:900}
.fig figcaption{font-size:11.5px;color:var(--mut);margin-top:4px}
/* 툴팁 */
.tip{position:absolute;z-index:9;pointer-events:none;background:#14274e;color:#fff;font-size:12px;font-weight:600;border-radius:8px;padding:6px 10px;box-shadow:0 4px 14px rgba(20,39,78,.28);opacity:0;transition:opacity .1s;white-space:nowrap}
.tip b{font-weight:900}
.tip.on{opacity:1}
/* 표 */
table{width:100%;border-collapse:collapse;font-size:13px}
th{font-size:11.5px;color:var(--mut);text-align:left;padding:7px 8px;border-bottom:2px solid var(--line);font-weight:800;letter-spacing:.3px}
td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
td.va{color:var(--a);font-weight:700}td.vb{color:var(--b);font-weight:700}
table.cmp th:first-child{width:34%}
table.cmp thead th{text-align:center}
table.cmp thead th.yh{border-bottom:2px solid var(--line);color:var(--navy);font-weight:900;font-size:12.5px}
table.cmp td{text-align:center;font-size:14px}
table.cmp tbody th{color:var(--ink);font-size:13px;font-weight:700;text-align:left}
.pill{display:inline-block;font-size:11px;font-weight:800;padding:1px 9px;border-radius:99px}
.p-lo{background:#e6f6ee;color:#0f7a48}.p-md{background:#fff3dd;color:#9c6200}.p-hi{background:#fdeaea;color:#c22}.p-es{background:#edeafd;color:#5747c9}
.tbl{margin-top:14px;font-size:13px}
.tbl summary{cursor:pointer;font-weight:800;color:var(--a);font-size:12.5px}
.scrollx{overflow-x:auto;margin-top:10px}
table.grid{font-size:12px;min-width:520px}
table.grid th,table.grid td{padding:5px 3px;text-align:center;border-bottom:1px solid var(--line)}
table.grid thead th{font-size:10.5px}
table.grid tbody th{text-align:left;font-weight:900;white-space:nowrap;padding-right:8px}
.tc{text-align:center}.mut{color:var(--mut)}
.scope{font-size:13px;background:#f7f9fd;border:1px solid var(--line);border-radius:10px;padding:11px 14px;margin-top:12px;color:var(--ink2)}
.note{font-size:12px;color:var(--mut);margin-top:12px;line-height:1.75}
.warn{background:#fff8e6;border:1px solid #f2d78a;color:#7a5600;font-size:13px;border-radius:12px;padding:14px 18px;margin-bottom:20px;line-height:1.8}
.warn h2{font-size:13px;font-weight:900;letter-spacing:.5px;margin-bottom:8px;color:#8a6100}
.warn li{margin:6px 0 6px 20px}
.final{background:linear-gradient(135deg,#14274e,#24549e);color:#fff;border-radius:16px;padding:22px 24px;margin-bottom:20px}
.final h2{font-size:16px;font-weight:900;margin-bottom:10px}
.final li{margin:9px 0 9px 20px;font-size:14px;color:#dfe9fb}
.final b{color:#fff}
.foot{font-size:11.5px;color:var(--mut);text-align:center;margin-top:28px;line-height:1.8}
@media print{
  body{background:#fff}.wrap{padding:0}
  .cover{border-radius:0;margin:0 0 20px}
  .sec,.hl,.warn,.final{break-inside:avoid;box-shadow:none}
  .tbl{display:none}.tip{display:none}
}
</style></head><body>
<div class="wrap">

  <div class="cover">
    <div class="cbrand">LUMEN MATH · 루멘수학</div>
    <div class="ctitle">${esc(TITLE)}</div>
    <div class="csub">난이도 · 답형식 · 교과서 연계 세 축으로 나란히 본 통계 비교</div>
    <div class="chips">
      ${years.map(y => `<span class="chip">${esc(y.label)}년</span>`).join('')}
      <span class="chip">시험지 ${years.length * 2}장 · ${totalQ}문항</span>
      <span class="chip">교과서 ${books.map(b => b.name).join('·')} ${books.reduce((a, b) => a + b.n, 0)}문항 대조</span>
      <span class="chip">${esc(today)}</span>
    </div>
  </div>

  <div class="hl">
    <h2>한눈에 보기</h2>
    <ul>${readings().map(t => `<li>${t}</li>`).join('')}</ul>
  </div>

  <!-- 1. 비교 대상 -->
  <div class="sec">
    <div class="shead"><span class="snum">1</span><h2 class="st">비교한 시험지</h2></div>
    <p class="desc">같은 해 · 같은 학년 · 같은 학기 · 같은 시험(기말) · 같은 과목으로만 짝지었다. 조건이 어긋나면 난이도 비교가 성립하지 않는다.</p>
    <table><thead><tr><th>연도</th><th>학교</th><th>시험</th><th class="tc">문항</th><th class="tc">배점 합</th></tr></thead><tbody>
    ${years.map(y => [y.A, y.B].map((s, i) => `<tr>
      ${i === 0 ? `<td rowspan="2" style="font-weight:900;color:var(--navy)">${esc(y.label)}</td>` : ''}
      <td style="font-weight:800;color:${i ? CB : CA}">${esc(s.school)}</td>
      <td style="font-size:12.5px;color:var(--ink2)">${esc(s.title.replace(/^내신\s*/, ''))}</td>
      <td class="tc">${s.n}</td><td class="tc">${r1(s.scoreTotal)}점</td></tr>`).join('')).join('')}
    </tbody></table>
    ${years.map(y => `<div class="scope"><b>${esc(y.label)}년 출제 단원</b> — ${esc([...new Set(y.A.units.concat(y.B.units))].join(' · '))}</div>`).join('')}
  </div>

  <!-- 2. 핵심 지표 대조 -->
  <div class="sec">
    <div class="shead"><span class="snum">2</span><h2 class="st">핵심 지표 한 표로</h2></div>
    <p class="desc">네 축을 한 화면에 놓았다. 아래 절들은 이 표의 각 줄을 풀어서 본 것이다.</p>
    <table class="cmp"><thead>
      <tr><th></th>${years.map(y => `<th colspan="2" class="yh">${esc(y.label)}년</th>`).join('')}</tr>
      <tr><th></th>${years.map(() => `<th style="color:${CA}">${esc(NAME_A)}</th><th style="color:${CB}">${esc(NAME_B)}</th>`).join('')}</tr>
    </thead><tbody>
      ${tileRow('문항 수', s => s.n, s => s.n)}
      ${tileRow('난이도 평균', s => r1(s.avgDiff), s => r1(s.avgDiff))}
      ${tileRow('난이도 「하」', s => `${s.bandN['하']}개`, s => `${s.bandN['하']}개`)}
      ${tileRow('난이도 「상」 이상', s => `${s.bandN['상'] + s.bandN['최상']}개`, s => `${s.bandN['상'] + s.bandN['최상']}개`)}
      ${tileRow('객관식 아닌 문항', s => `${s.nonChoice.length}개`, s => `${s.nonChoice.length}개`)}
      ${books.map((b, i) => tileRow(`${b.name} 세부유형 일치`, s => `${pct(s.link[i].m5, s.n)}%`, s => `${pct(s.link[i].m5, s.n)}%`)).join('')}
      ${tileRow('교과서 미수록 유형', s => `${s.offBook.length}개`, s => `${s.offBook.length}개`)}
    </tbody></table>
  </div>

  <!-- 3. 난이도 분포 -->
  <div class="sec">
    <div class="shead"><span class="snum">3</span><h2 class="st">난이도 분포 — 쉬운 문항을 주는가</h2></div>
    <p class="desc">수학비서가 매긴 난이도(1~8)를 학원에서 쓰는 4단계로 묶었다. 같은 기준으로 매긴 값이라 학교끼리 바로 비교된다.</p>
    <div class="legend">
      <span><i style="background:${CA}"></i>${esc(NAME_A)}</span>
      <span><i style="background:${CB}"></i>${esc(NAME_B)}</span>
    </div>
    ${years.map(y => `<h3 class="yr">${esc(y.label)}년</h3>${diffBars(y)}`).join('')}
    <p class="note">막대 길이는 두 학교·두 해를 통틀어 가장 많은 칸을 기준으로 맞췄다. 문항 수가 22개와 21개로 달라 개수와 비율을 함께 적었다.</p>
  </div>

  <!-- 4. 난이도 곡선 -->
  <div class="sec">
    <div class="shead"><span class="snum">4</span><h2 class="st">문항번호별 난이도 곡선 — 어디서 갈리는가</h2></div>
    <p class="desc">시험지를 앞에서 뒤로 훑으며 난이도가 어떻게 올라가는지 본다. 배경 띠는 하·중·상·최상 구간이다. 점에 손을 올리면 단원이 나온다.</p>
    <div class="legend">
      <span><i style="background:${CA}"></i>${esc(NAME_A)}</span>
      <span><i style="background:${CB}"></i>${esc(NAME_B)}</span>
    </div>
    ${years.map((y, i) => `<h3 class="yr">${esc(y.label)}년</h3>${curveSvg(y, i)}
      <p class="note">난이도 5 이상 문항 — <b style="color:${CA}">${esc(y.A.school)}</b> ${y.A.hard.join(', ')}번 (${y.A.hard.length}개) · <b style="color:${CB}">${esc(y.B.school)}</b> ${y.B.hard.join(', ')}번 (${y.B.hard.length}개)</p>
      ${curveTable(y)}`).join('')}
  </div>

  <!-- 5. 답형식 -->
  <div class="sec">
    <div class="shead"><span class="snum">5</span><h2 class="st">답형식 — 객관식만인가</h2></div>
    <p class="desc">객관식이 아닌 문항은 부분점수와 서술 훈련이 걸리는 자리다. 여기서 두 학교가 가장 크게 갈렸다.</p>
    <table><thead><tr><th>연도</th><th>학교</th><th>구성</th><th class="tc">객관식 아닌 문항</th><th class="tc">그 배점</th></tr></thead><tbody>
    ${years.map(y => [y.A, y.B].map((s, i) => `<tr>
      ${i === 0 ? `<td rowspan="2" style="font-weight:900;color:var(--navy)">${esc(y.label)}</td>` : ''}
      <td style="font-weight:800;color:${i ? CB : CA}">${esc(s.school)}</td>
      <td>${Object.entries(s.typeN).map(([k, v]) => `${esc(k)} ${v}`).join(' · ')}</td>
      <td class="tc">${s.nonChoice.length ? s.nonChoice.map(c => `${c.no}번<span class="pill p-es" style="margin-left:4px">${esc(c.type)}</span>`).join(' ') : '<b style="color:#c22">없음</b>'}</td>
      <td class="tc">${s.nonChoiceScore ? r1(s.nonChoiceScore) + '점' : '—'}</td></tr>`).join('')).join('')}
    </tbody></table>
    <p class="note">수학비서의 답형식 분류는 「어떤 형태로 답을 쓰는가」까지다. 실제 채점에서 부분점수를 주는 서술형인지까지는 보장하지 않으므로, 학교에서 받은 시험지 원본으로 한 번 더 확인하는 편이 안전하다.</p>
  </div>

  <!-- 6. 교과서 연계 -->
  <div class="sec">
    <div class="shead"><span class="snum">6</span><h2 class="st">교과서 연계율 — 교과서를 얼마나 따라가는가</h2></div>
    <p class="desc">수학비서는 모든 문항에 5단계 유형 꼬리표를 붙인다. 기출 문항의 꼬리표가 교과서 DB에도 있는지 맞춰 센 값이다.
      <b>유형(4단계)</b>은 느슨한 기준, <b>세부유형(5단계)</b>은 엄격한 기준이다.</p>
    <div class="legend">
      <span><i style="background:${CA}"></i>${esc(NAME_A)}</span>
      <span><i style="background:${CB}"></i>${esc(NAME_B)}</span>
    </div>
    ${years.map(y => `<h3 class="yr">${esc(y.label)}년</h3>${linkBars(y)}`).join('')}
    <div class="scope"><b>대조에 쓴 교과서 DB</b><br>${books.map(b => `${esc(b.name)} — ${b.titles.map(esc).join(' / ')} (${b.n}문항, 유형 ${b.s4.size}종)`).join('<br>')}</div>
    <p class="note">⚠️ 이 숫자는 <b>「교과서에 같은 유형이 있다」</b>는 뜻이고 <b>「교과서 문제를 변형해 냈다」</b>는 증거가 아니다. 실제 변형 여부는 문항을 나란히 놓고 봐야 한다.<br>
      ⚠️ 두 학교가 어느 교과서를 쓰는지 확인되지 않아 ${books.map(b => b.name).join('·')} 양쪽에 모두 대조했다. 채택 교과서를 알면 숫자가 훨씬 날카로워진다.<br>
      ⚠️ 2015개정 「수학(하)」 교과서 DB가 없어 2024년은 2022개정 공통수학1·2 교과서로 대신 맞췄다. 근사치로 읽어야 한다.</p>
  </div>

  <!-- 7. 교과서 미수록 -->
  <div class="sec">
    <div class="shead"><span class="snum">7</span><h2 class="st">교과서를 벗어난 문항</h2></div>
    <p class="desc">두 교과서 어디에도 같은 유형이 없는 문항이다. 교과서와 학교 프린트만으로는 막히는 자리이므로, 대비의 우선순위가 여기 있다.</p>
    ${years.map(y => `<h3 class="yr">${esc(y.label)}년</h3>
    <table><thead><tr><th>학교</th><th class="tc">번호</th><th class="tc">난이도</th><th>단원</th><th>세부유형</th></tr></thead><tbody>
    ${[y.A, y.B].flatMap((s, i) => s.offBook.length
        ? s.offBook.map((c, j) => `<tr>${j === 0 ? `<td rowspan="${s.offBook.length}" style="font-weight:800;color:${i ? CB : CA}">${esc(s.school)}</td>` : ''}
            <td class="tc" style="font-weight:800">${c.no}</td>
            <td class="tc">${c.difficulty == null ? '·' : `<span class="pill ${c.difficulty <= 2 ? 'p-lo' : c.difficulty <= 4 ? 'p-md' : 'p-hi'}">${c.difficulty}</span>`}</td>
            <td>${esc(c.unit)}</td><td style="font-size:12.5px;color:var(--ink2)">${esc(c.leaf)}</td></tr>`)
        : [`<tr><td style="font-weight:800;color:${i ? CB : CA}">${esc(s.school)}</td><td colspan="4" class="mut">없음 — 전 문항이 교과서 유형 안에 있다</td></tr>`]).join('')}
    </tbody></table>`).join('')}
  </div>

  <!-- 데이터 주의 -->
  <div class="warn">
    <h2>⚠️ 이 리포트의 데이터에 손을 댄 부분</h2>
    <ul>${FIX_NOTE.map(t => `<li>${t}</li>`).join('')}</ul>
    수학비서의 배점·난이도는 사람이 매긴 추정치다. 난이도는 <b>같은 기준으로 매겼다는 점</b>에서 학교끼리 비교하는 데는 쓸 수 있지만, 절대 척도는 아니다.
  </div>

  <div class="final">
    <h2>💡 루멘수학 대비 포인트</h2>
    <ul>
      <li><b>「앞번호는 쉽다」를 전제로 대비하지 않는다.</b> 두 학교 모두 난이도 「하」가 <b>0개인 해</b>가 한 번씩 있었다(§3). 어느 해에 걸릴지 알 수 없으므로, 앞번호에서 점수를 벌어 뒤를 메우는 전략은 세우지 않는다 — 계산 정확도 훈련의 비중을 올린다.</li>
      <li><b>객관식만 나오는 학교의 아이도 서술 훈련은 시킨다.</b> 다만 목적이 다르다. 점수를 받기 위한 서술이 아니라 <b>풀이 과정을 정리해 실수를 줄이기 위한</b> 서술이다.</li>
      <li><b>§7의 교과서 미수록 유형이 대비의 1순위다.</b> 교과서·학교 프린트를 다 풀어도 이 유형은 만나지 못한다. 이 유형만 모은 자체 문제지를 시험 3주 전에 돌린다.</li>
      <li><b>교과서 세부유형 일치율이 높은 학교</b>는 교과서 예제·유제를 끝까지 훑는 것이 가장 수익률이 높다. 낮은 학교는 교과서를 빨리 끝내고 변형 문제로 넘어간다.</li>
    </ul>
  </div>

  <div class="foot">
    ${esc(TITLE)} · 루멘수학 자체 분석 · ${esc(today)}<br>
    출처: 수학비서(mathsecr.com) 「나만의 DB」 문항 메타데이터 — 단원 5단계·난이도·배점·답형식<br>
    시험 문항 이미지·원문은 이 리포트에 담지 않았다(구매 콘텐츠).
  </div>
</div>
<div class="tip" id="tip"></div>
<script>
/* 난이도 곡선 점 위 안내 — 인쇄에는 영향 없음 */
(function(){
  var tip=document.getElementById('tip');
  document.querySelectorAll('.cv .pt').forEach(function(g){
    g.addEventListener('mouseenter',function(e){
      var d=g.dataset;
      tip.innerHTML='<b>'+d.sch+' '+d.no+'번</b> · 난이도 '+d.d+'('+d.band+')<br>'+d.unit+(d.leaf?' · '+d.leaf:'');
      tip.style.whiteSpace='normal'; tip.style.maxWidth='260px';
      tip.classList.add('on');
    });
    g.addEventListener('mousemove',function(e){
      tip.style.left=(e.pageX+14)+'px'; tip.style.top=(e.pageY-10)+'px';
    });
    g.addEventListener('mouseleave',function(){ tip.classList.remove('on'); });
  });
})();
</script>
</body></html>`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`리포트: ${OUT} (${(html.length / 1024).toFixed(0)}KB)`);

if (ANALYSIS) {
  fs.mkdirSync(path.dirname(ANALYSIS), { recursive: true });
  fs.writeFileSync(ANALYSIS, JSON.stringify({
    title: TITLE, today, schoolA: NAME_A, schoolB: NAME_B,
    books: books.map(b => ({ name: b.name, ids: b.ids, titles: b.titles, n: b.n, types4: b.s4.size, types5: b.s5.size })),
    scoreFix: SCORE_FIX, fixNote: FIX_NOTE,
    years: years.map(y => ({ label: y.label, A: y.A, B: y.B })),
    readings: readings(),
  }, null, 1));
  console.log(`집계 JSON: ${ANALYSIS}`);
}

years.forEach(y => {
  [y.A, y.B].forEach(s => {
    console.log(`  ${y.label} ${s.school}: ${s.n}문항 난이도${r1(s.avgDiff)} 배점${r1(s.scoreTotal)} 객관식아닌${s.nonChoice.length} 교과서미수록${s.offBook.length} ` +
      books.map((b, i) => `${b.name}4단계${pct(s.link[i].m4, s.n)}%/5단계${pct(s.link[i].m5, s.n)}%`).join(' '));
  });
});
