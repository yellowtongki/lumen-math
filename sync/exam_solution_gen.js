#!/usr/bin/env node
/* 고난도·서술형 문항 해설지 생성기 — A4 인쇄용
 *
 * 수학비서에는 해설 데이터가 없다(explanations: null). 그래서 해설은
 * ① 문항 이미지를 보고 AI가 단계별 풀이를 쓰고
 * ② 수학비서가 가진 <정답>과 대조해 검증하고
 * ③ 선생님이 검수하는
 * 순서로 만든다. 이 스크립트는 ①②가 끝난 풀이 JSON을 인쇄용 해설지로 묶는다.
 *
 * 입력
 *   sol/index.json          : 문항 목록 (exam, tag, no, band, score, type, answer, file)
 *   sol/solutions_*.json    : { "<tag>_<번호2자리>": { given, steps[], answer, trap, verify?, verifyNote? } }
 *
 * 사용법:
 *   node sync/exam_solution_gen.js --dir sync/_debug/sol --outdir ./해설지
 *
 * ⚠️ 기출 문항 이미지가 들어가므로 학원 수강생 배포용으로만 쓴다(저장소 커밋 금지).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const DIR = arg('dir');
const OUTDIR = arg('outdir', '.');
if (!DIR) { console.error('필수 인자: --dir <sol 폴더> [--outdir <저장 폴더>]'); process.exit(1); }

const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json'), 'utf8'));
const SOL = {};
fs.readdirSync(DIR).filter(f => /^solutions_.*\.json$/.test(f))
  .forEach(f => Object.assign(SOL, JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))));

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const b64 = fp => `data:image/png;base64,${fs.readFileSync(fp).toString('base64')}`;
const key = it => `${it.tag}_${String(it.no).padStart(2, '0')}`;
const bandCls = b => (b === '하' ? 'lo' : b === '중' ? 'md' : 'hi');
const today = new Date().toISOString().slice(0, 10);

// 시험지 제목을 사람이 읽는 이름으로
function niceTitle(t) {
  return String(t).replace('내신 ', '').replace('경기 부천시 ', '')
    .replace(/(중\d|고\d)\s*공통\s*/, '$1 ').replace(/\s+/g, ' ').trim();
}

// 시험지별로 묶는다
const byExam = {};
index.forEach(it => (byExam[it.exam] = byExam[it.exam] || { title: it.title, tag: it.tag, items: [] }).items.push(it));

const CSS = `
:root{--red:#C63D2E;--red2:#A5301F;--navy:#1E3A5C;--gold:#D99A1F;
  --ink:#12161B;--ink2:#454F5B;--mut:#8A929C;--line:#E4DFDA;--soft:#FAF7F4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif;color:var(--ink);
  background:#DDD8D3;line-height:1.62;-webkit-font-smoothing:antialiased}
.bar{position:sticky;top:0;z-index:9;background:var(--navy);color:#fff;padding:9px 16px;font-size:13px;text-align:center}
.bar b{color:#FFD9A0}
.sheet{width:210mm;margin:10mm auto;background:#fff;padding:14mm 14mm 12mm;box-shadow:0 3px 14px rgba(0,0,0,.16)}
.head{border-bottom:3px solid var(--red);padding-bottom:4mm;margin-bottom:5mm}
.brand{font-size:9pt;font-weight:900;letter-spacing:2.5px;color:var(--red)}
h1{font-size:20pt;font-weight:900;color:var(--navy);margin:1.5mm 0 1mm;line-height:1.25}
.sub{font-size:9.5pt;color:var(--ink2)}
.note{margin-top:4mm;background:#FDF6EC;border:1px solid #EFDCBC;border-radius:2mm;padding:3mm 4mm;font-size:8.8pt;color:#6B4A12}
.note b{color:#8A6314}
.warnbox{margin-top:3mm;background:#FBEAE6;border:1px solid #E7BFB6;border-radius:2mm;padding:3mm 4mm;font-size:8.8pt;color:#8E2A1B}
.q{border:1px solid var(--line);border-radius:3mm;overflow:hidden;margin-bottom:6mm;break-inside:avoid;page-break-inside:avoid}
.qh{display:flex;align-items:center;gap:3mm;background:var(--soft);padding:3mm 4mm;border-bottom:1px solid var(--line)}
.qno{background:var(--navy);color:#fff;font-weight:900;font-size:11pt;border-radius:1.5mm;padding:.8mm 3mm;flex:none}
.qmeta{flex:1;font-size:8.6pt;color:var(--ink2)}
.qtype{font-size:10pt;font-weight:800;color:var(--navy);display:block}
.pill{display:inline-block;font-size:7.8pt;font-weight:800;padding:.4mm 2.2mm;border-radius:9mm;background:#EDE9E5;color:var(--ink2);margin-right:1.2mm}
.pill.lo{background:#E9F2EC;color:#2F6B45}.pill.md{background:#FBF0DA;color:#8A6314}
.pill.hi{background:#F6E0DC;color:#9E2B1C}.pill.es{background:#EDEAFD;color:#5747C9}
.qb{padding:4mm}
.qimg{border:1px solid #D5DEE7;border-radius:2mm;padding:2mm;background:#fff;margin-bottom:4mm}
.qimg img{display:block;width:100%;max-width:150mm;margin:0 auto}
.given{font-size:8.8pt;color:var(--ink2);background:var(--soft);border-left:2.5px solid var(--gold);
  border-radius:0 2mm 2mm 0;padding:2.5mm 3.5mm;margin-bottom:3mm}
.given b{color:var(--navy)}
.lab{font-size:8.4pt;font-weight:900;color:var(--red);letter-spacing:.5px;margin-bottom:1.5mm}
ol.steps{margin:0 0 3mm 5.5mm;font-size:9.2pt;color:var(--ink2)}
ol.steps li{margin:1.6mm 0;padding-left:1mm}
.ansbox{background:#F1F5F9;border:1px solid #D5DEE7;border-radius:2mm;padding:2.5mm 4mm;margin-bottom:3mm}
.ansbox b{font-size:8.4pt;color:var(--mut);display:block}
.ansv{font-size:12pt;font-weight:900;color:var(--red)}
.trap{background:#FDF6EC;border:1px solid #EFDCBC;border-radius:2mm;padding:2.5mm 3.5mm;font-size:8.8pt;color:#6B4A12}
.trap b{display:block;color:#8A6314;font-size:8.4pt;margin-bottom:.6mm}
.mism{background:#FBEAE6;border:1px solid #E7BFB6;border-radius:2mm;padding:2.5mm 3.5mm;font-size:8.8pt;color:#8E2A1B;margin-bottom:3mm}
.mism b{display:block;font-size:8.4pt;margin-bottom:.6mm}
.foot{margin-top:6mm;border-top:1px solid var(--line);padding-top:2.5mm;font-size:7.6pt;color:var(--mut);
  display:flex;justify-content:space-between}
@media print{
  @page{size:A4 portrait;margin:12mm 12mm 10mm}
  body{background:#fff}
  .bar{display:none}
  .sheet{width:auto;margin:0;padding:0;box-shadow:none}
}`;

let made = 0, mismatch = 0;
fs.mkdirSync(OUTDIR, { recursive: true });

Object.entries(byExam).forEach(([examId, ex]) => {
  const title = niceTitle(ex.title);
  const items = ex.items.slice().sort((a, b) => a.no - b.no);
  const missing = items.filter(it => !SOL[key(it)]).map(it => it.no);
  const mis = items.filter(it => (SOL[key(it)] || {}).verify === 'MISMATCH');
  mismatch += mis.length;

  const blocks = items.map(it => {
    const s = SOL[key(it)];
    const isEssay = it.answerType && it.answerType !== 'single_choice';
    const badges = [
      `<span class="pill ${bandCls(it.band)}">난이도 ${esc(it.band)}</span>`,
      it.score ? `<span class="pill">${it.score}점</span>` : '',
      isEssay ? '<span class="pill es">서술형</span>' : '',
    ].join('');
    if (!s) return `<div class="q"><div class="qh"><span class="qno">${it.no}번</span>
      <div class="qmeta"><span class="qtype">${esc(it.type)}</span>${badges}</div></div>
      <div class="qb"><div class="mism"><b>풀이 준비 중</b>이 문항의 풀이가 아직 작성되지 않았습니다.</div></div></div>`;
    return `<div class="q">
      <div class="qh"><span class="qno">${it.no}번</span>
        <div class="qmeta"><span class="qtype">${esc(it.type)}</span>${badges}<span class="pill">${esc(it.unit)}</span></div></div>
      <div class="qb">
        <div class="qimg"><img src="${b64(it.file)}" alt="${it.no}번 문제"></div>
        ${s.verify === 'MISMATCH' ? `<div class="mism"><b>⚠️ 정답 대조 불일치 — 선생님 검수 필요</b>${esc(s.verifyNote || '')}</div>` : ''}
        ${s.given ? `<div class="given"><b>주어진 것</b> · ${esc(s.given)}</div>` : ''}
        <div class="lab">풀이</div>
        <ol class="steps">${(s.steps || []).map(t => `<li>${esc(t)}</li>`).join('')}</ol>
        <div class="ansbox"><b>답</b><span class="ansv">${esc(s.answer)}</span></div>
        ${s.trap ? `<div class="trap"><b>여기서 갈린다</b>${esc(s.trap)}</div>` : ''}
      </div></div>`;
  }).join('\n');

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} 고난도·서술형 해설 — 루멘수학</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body>
<div class="bar">📄 <b>Ctrl+P</b>(맥은 ⌘+P) → <b>"PDF로 저장"</b> 으로 인쇄하세요. 이 안내줄은 인쇄되지 않습니다.</div>
<div class="sheet">
  <div class="head">
    <div class="brand">LUMEN MATH · 루멘수학</div>
    <h1>${esc(title)}<br>고난도 · 서술형 해설</h1>
    <div class="sub">난이도 <b>상</b> 이상 문항과 서술형 문항 <b>${items.length}개</b>의 단계별 풀이입니다.</div>
  </div>
  <div class="note"><b>이 해설지에 대하여</b><br>
    수학비서 기출 DB에는 해설이 들어 있지 않아, 문항을 보고 <b>새로 작성한 풀이</b>입니다.
    작성한 답은 DB가 가진 <b>공식 정답과 하나씩 대조</b>했습니다${mis.length ? `<b> — 다만 ${mis.map(m => m.no + '번').join(', ')}은 정답이 일치하지 않아 표시해 두었습니다.</b>` : ' — 모두 일치했습니다.'}
    수업에 쓰시기 전에 선생님 검수를 권합니다.</div>
  ${missing.length ? `<div class="warnbox">풀이가 아직 없는 문항: ${missing.join(', ')}번</div>` : ''}
  ${blocks}
  <div class="foot"><span>루멘수학 내부 제작 자료 · ${today} · 학원 수강생용(무단 재배포 금지)</span><span>${esc(title)}</span></div>
</div>
</body></html>`;

  const out = path.join(OUTDIR, `${ex.tag}_해설.html`);
  fs.writeFileSync(out, html);
  made++;
  console.log(`해설지 저장: ${out}  (${items.length}문항${mis.length ? `, 정답 불일치 ${mis.length}건` : ''}${missing.length ? `, 풀이 없음 ${missing.length}건` : ''})`);
});
console.log(`\n총 ${made}개 해설지 · 문항 ${index.length}개 · 정답 불일치 ${mismatch}건`);
