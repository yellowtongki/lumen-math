/**
 * 교재 채점 엔진 시험 — sync/hw_grade_engine.js
 * ==========================================================
 * 계약서 docs/bookscore_v2_contract.md §2 「시험」 + 부록 docs/bookscore_v2_elem.md §4 를 돌린다.
 *
 *   ① 불변식 : 정답 원문을 그대로 넣으면 반드시 「맞음」
 *              — 중등·초등 각각 모양별 300개씩, 실패 0이어야 함
 *   ② 오답 검사 : 값을 바꾼 입력은 반드시 「틀림」
 *   ③ 모양 분포 : 라이트 1-2(bid 2124102) 전 문항 (자동채점 ≥ 90%)
 *                 + 초등 전체 (자동채점 ≥ 88%) + 초등 교재별 비율 표
 *   ④ 못 읽은 답 상위 목록 — 엔진을 어디부터 보강할지 보여 준다
 *
 * 실행:  node sync/test_hw_grade.js            (Supabase 읽기만 · 매쓰플랫 로그인 불필요)
 *        node sync/test_hw_grade.js --book 2124102   (한 교재만 자세히)
 * 규칙: 학생 개인정보는 읽지 않는다(정답사전만). 저장은 하지 않는다.
 */
const HW = require('./hw_grade_engine.js');

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ONE_BOOK = opt('--book', '');
const LIGHT = '2124102';                      // 개념+유형 유형편 기초탄탄 라이트 중1-2
const PER_SHAPE = 300;                        // 모양별 불변식 표본 수
const ELEM_GOAL = 88;                         // 초등 자동채점 목표(%)  — docs/bookscore_v2_elem.md
const LIGHT_GOAL = 90;                        // 라이트 1-2 자동채점 목표(%)

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };

function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }
function padL(s, n) { s = String(s); while (s.length < n) s = ' ' + s; return s; }
const shapeOf = (p) => HW.shapeOf({ type: p.type, answer: p.answer, objective: p.objective, cnt: p.cnt, units: p.units });

async function loadBooks() {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요 (읽기 전용)'); process.exit(1); }
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.mf_bookans_*&select=key,value&limit=2000`, { headers: H });
  if (!r.ok) { console.error('정답사전 조회 실패', r.status); process.exit(1); }
  const rows = (await r.json()).filter((x) => /^mf_bookans_/.test(x.key));
  return rows.map((x) => ({
    bid: x.key.replace('mf_bookans_', ''),
    store: (typeof x.value === 'string' ? JSON.parse(x.value) : x.value) || {},
  }));
}

// 학생에게 배정된 교재의 학년 (초4/초5/초6/중1…) — mf_swb_* 에서 모은다
async function loadGrades() {
  const g = {}, cnt = {};
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.mf_swb_*&select=key,value&limit=500`, { headers: H });
  if (!r.ok) return { grade: g, students: cnt };
  for (const row of await r.json()) {
    const v = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) || {};
    for (const b of v.books || []) { g[b.bid] = b.grade || ''; cnt[b.bid] = (cnt[b.bid] || 0) + 1; }
  }
  return { grade: g, students: cnt };
}

// 정답 하나를 「틀린 답」으로 바꾼다 (맨 뒤 숫자를 +7, 숫자가 없으면 글자를 덧붙임)
//   ※ 식(eq)은 「마지막 = 뒤 값」만 채점하므로 앞쪽 숫자가 아니라 맨 뒤 숫자를 건드려야
//      진짜 오답이 된다.
function mutate(ans) {
  const s = String(ans);
  if (/\d/.test(s)) return s.replace(/\d+/g, (d) => String(Number(d) + 7));
  return s + '틀';
}

// 한 묶음(중등 표본 · 초등 표본)에 대해 ①불변식 ②오답검사 를 돌린다
function invariantRun(title, items, rank) {
  const byShape = {};
  const list = items.slice().sort((a, b) => rank(a) - rank(b));
  for (const it of list) {
    const p = it.p;
    if (p.objective) continue;                      // 객관식은 번호 비교(엔진 밖)
    const s = shapeOf(p);
    if (s.self) continue;                           // 자기채점으로 가는 답은 불변식 대상 아님
    (byShape[s.shape] = byShape[s.shape] || []).push(it);
  }
  let inv = 0, invFail = 0, wrongChecked = 0, wrongFail = 0;
  const failSample = [], wrongSample = [];
  console.log(`\n① ${title} — 모양별 표본 ${PER_SHAPE}개씩`);
  for (const shape of Object.keys(byShape).sort()) {
    const pick = byShape[shape].slice(0, PER_SHAPE);
    let f = 0;
    for (const it of pick) {
      inv++;
      const g = HW.grade(it.p.answer, it.p.answer);
      if (!g.gradable || !g.correct) { invFail++; f++; if (failSample.length < 20) failSample.push([shape, it.p.answer]); }
      const bad = mutate(it.p.answer);              // ② 오답 검사
      if (bad !== String(it.p.answer)) {
        wrongChecked++;
        const g2 = HW.grade(it.p.answer, bad);
        if (g2.correct) { wrongFail++; if (wrongSample.length < 10) wrongSample.push([shape, it.p.answer, bad]); }
      }
    }
    console.log(`   ${pad(shape, 9)} 표본 ${pad(pick.length, 4)} · 불변식 실패 ${f}`);
  }
  console.log(`   ▸ 불변식(정답 원문 → 맞음): ${inv - invFail}/${inv} 통과 · 실패 ${invFail}`);
  failSample.forEach((x) => console.log(`     ✗ [${x[0]}] ${JSON.stringify(x[1])}`));
  console.log(`   ▸ 오답 검사(값 바꾼 입력 → 틀림): ${wrongChecked - wrongFail}/${wrongChecked} 통과 · 놓침 ${wrongFail}`);
  wrongSample.forEach((x) => console.log(`     ✗ [${x[0]}] 정답 ${JSON.stringify(String(x[1]).slice(0, 60))} ← 입력 ${JSON.stringify(String(x[2]).slice(0, 60))}`));
  return { inv, invFail, wrongChecked, wrongFail };
}

// 초등 답 모양 손시험 — docs/bookscore_v2_elem.md §1 표의 실제 정답 예
function elemFixtures() {
  const T = [
    ['점 ㄱ', 'geo'], ['선분 ㄱㄴ, 선분 ㄹㄷ', 'geo'], ['변 ㄹㄴ', 'geo'], ['면 ㅁㅂㅅㅇ', 'geo'],
    ['각 ㄹㄴㄷ', 'geo'], ['직선 ㄱㄴ', 'geo'], ['반직선 ㄴㄱ', 'geo'],
    ['㈏', 'mark'], ['㉮', 'mark'], ['㉠', 'mark'],
    ['( )( ○ )', 'pick'], ['[ ][○]', 'pick'], ['( )( ○ )( )', 'pick'],
    ['십에 ○표 / 백에 ○표', 'choice'], ['이상에 ○표 / 이하에 ○표', 'choice'], ['초과에 ○표 / 미만에 ○표', 'choice'],
    ['\\times, -, \\div, +', 'op'], ['(\\times)', 'op'], ['+, -', 'op'],
    ['㎢', 'word'], ['㎡', 'word'], ['cm', 'word'], ['L', 'word'],
    ['40^{\\circ}', 'unit'], ['90^{\\circ}', 'unit'],
    ['(위에서부터)\\frac{1}{8}, \\frac{3}{8}', 'num'], ['(왼쪽부터) 3, 5', 'num'],
    ['3시 20분', 'unit'], ['1시간 30분', 'unit'], ['2시 15분 30초', 'unit'],
    ['3m 20cm', 'unit'], ['1kg 300g', 'unit'], ['2L 500mL', 'unit'],
    ['약 1600', 'num'], ['약 3000원', 'unit'],
    ['>', 'mark'], ['<', 'mark'], ['=', 'mark'],
  ];
  // 같은 값을 다르게 쓴 학생 입력도 맞아야 한다
  const SAME = [['3m 20cm', '320cm'], ['1kg 300g', '1300g'], ['3시 20분', '200분'],
    ['각 ㄹㄴㄷ', 'ㄷㄴㄹ'], ['선분 ㄱㄴ', 'ㄴㄱ'], ['점 ㄱ', 'ㄱ'], ['십에 ○표', '십']];
  // 반드시 틀려야 하는 입력
  const DIFF = [['3m 20cm', '321cm'], ['십에 ○표', '백'], ['( )( ○ )', '(○)( )'],
    ['40^{\\circ}', '50°'], ['㈏', '㈎'], ['\\times, -, \\div, +', '+, -, \\div, \\times']];
  let bad = 0;
  console.log('\n① 초등 손시험 (사양 표의 실제 정답 예)');
  for (const [a, want] of T) {
    const s = shapeOf({ type: 'SHORT_ANSWER', answer: a });
    const g = HW.grade(a, a);
    if (s.self || !g.correct || s.shape !== want) {
      bad++; console.log(`     ✗ ${JSON.stringify(a)} → shape ${s.shape}(바람 ${want}) self=${s.self} 맞음=${g.correct}`);
    }
  }
  for (const [a, b] of SAME) if (!HW.grade(a, b).correct) { bad++; console.log(`     ✗ 같은 답인데 틀렸다: ${JSON.stringify(a)} ← ${JSON.stringify(b)}`); }
  for (const [a, b] of DIFF) if (HW.grade(a, b).correct) { bad++; console.log(`     ✗ 다른 답인데 맞다고 했다: ${JSON.stringify(a)} ← ${JSON.stringify(b)}`); }
  console.log(`   ▸ 손시험 ${T.length + SAME.length + DIFF.length}가지 중 어긋남 ${bad}`);
  return bad;
}

(async () => {
  const books = await loadBooks();
  const { grade, students } = await loadGrades();
  console.log(`정답사전 ${books.length}권 읽음\n`);

  // ── 문항 모으기 ────────────────────────────────────────────
  const all = [];          // { bid, grade, v, p }
  for (const b of books) {
    if (ONE_BOOK && b.bid !== ONE_BOOK) continue;
    for (const pid of Object.keys(b.store.pages || {})) {
      const v = Number(b.store.pages[pid].v || 1);      // 정답사전 판(2판이면 img·cnt·units 가 들어 있다)
      for (const p of (b.store.pages[pid].problems || [])) {
        all.push({ bid: b.bid, grade: grade[b.bid] || '', name: b.store.book || '', v, p });
      }
    }
  }
  console.log(`전체 문항 ${all.length}개 (교재 ${new Set(all.map((x) => x.bid)).size}권)`);

  const mid = all.filter((x) => /^중/.test(x.grade));
  const elem = all.filter((x) => /^초/.test(x.grade));

  // ── ① 불변식 · ② 오답 검사 ────────────────────────────────
  const rMid = invariantRun('중등 표본', mid.length ? mid : all,
    (x) => (x.grade === '중1' ? 0 : x.grade === '중2' ? 1 : x.grade === '중3' ? 2 : 3));
  const rElem = elem.length
    ? invariantRun('초등 표본', elem, (x) => (x.grade.indexOf('초6') === 0 ? 0 : x.grade.indexOf('초5') === 0 ? 1 : 2))
    : { inv: 0, invFail: 0, wrongChecked: 0, wrongFail: 0 };
  const fixBad = elemFixtures();

  // ── ③ 모양 분포 ───────────────────────────────────────────
  const report = (items, title) => {
    const dist = {}, selfTop = {};
    let auto = 0;
    for (const it of items) {
      const p = it.p;
      const s = shapeOf(p);
      const k = s.shape + (s.self ? ' (자기채점)' : '');
      dist[k] = (dist[k] || 0) + 1;
      if (!s.self) auto++;
      else if (p.type !== 'ESSAY' && String(p.answer || '').trim() !== '.') {
        const key = JSON.stringify(String(HW.unlatex(p.answer)).slice(0, 60));
        selfTop[key] = (selfTop[key] || 0) + 1;
      }
    }
    console.log(`\n③ ${title} — 문항 ${items.length} · 자동채점 ${auto} (${pct(auto, items.length)}%) · 자기채점 ${items.length - auto}`);
    Object.keys(dist).sort((a, b) => dist[b] - dist[a]).forEach((k) => console.log(`     ${pad(k, 20)} ${dist[k]}`));
    const tops = Object.keys(selfTop).sort((a, b) => selfTop[b] - selfTop[a]).slice(0, 10);
    if (tops.length) {
      console.log(`   못 읽어 자기채점으로 보낸 답 상위 ${tops.length}개:`);
      tops.forEach((k) => console.log(`     ${pad(selfTop[k], 4)} ${k}`));
    }
    return pct(auto, items.length);
  };

  const light = all.filter((x) => x.bid === LIGHT);
  let lightPct = 0;
  if (light.length) lightPct = report(light, `라이트 1-2 (bid ${LIGHT})`);
  else console.log(`\n③ 라이트 1-2(bid ${LIGHT}) 정답사전이 아직 없다`);

  let elemPct = 0;
  if (!ONE_BOOK) {
    report(all, '전체 교재');
    if (elem.length) {
      elemPct = report(elem, '초등 전체 (초4~초6)');
      // 초등 교재별 비율 표 (41권)
      const per = {};
      elem.forEach((x) => { (per[x.bid] = per[x.bid] || []).push(x); });
      const list = Object.keys(per).sort((a, b) => (students[b] || 0) - (students[a] || 0)
        || per[b].length - per[a].length);
      console.log(`\n   ▸ 초등 교재별 자동채점 비율 (${list.length}권)`);
      console.log(`     ${pad('학년', 5)}${padL('학생', 4)}${padL('문항', 7)}${padL('자동', 8)}${padL('2판', 7)}  교재`);
      list.forEach((b) => {
        let auto = 0, v2 = 0;
        per[b].forEach((x) => { if (!shapeOf(x.p).self) auto++; if (x.v >= 2) v2++; });
        const nm = (per[b][0].name || b).slice(0, 38);
        console.log(`     ${pad(per[b][0].grade || '?', 5)}${padL(students[b] || 0, 4)}${padL(per[b].length, 7)}${padL(pct(auto, per[b].length) + '%', 8)}${padL(pct(v2, per[b].length) + '%', 7)}  ${nm}`);
      });
    }
    // 배정 학생 많은 중등 교재 상위 10권
    const perM = {};
    mid.forEach((x) => { (perM[x.bid] = perM[x.bid] || []).push(x); });
    const listM = Object.keys(perM).sort((a, b) => (students[b] || 0) - (students[a] || 0)).slice(0, 10);
    console.log('\n   ▸ 배정 학생 많은 중등 교재 자동채점 비율');
    listM.forEach((b) => {
      let auto = 0, v2 = 0;
      perM[b].forEach((x) => { if (!shapeOf(x.p).self) auto++; if (x.v >= 2) v2++; });
      console.log(`     ${pad(grade[b] || '?', 4)} 학생 ${pad(students[b] || 0, 3)} · 문항 ${pad(perM[b].length, 5)} · 자동 ${pad(pct(auto, perM[b].length) + '%', 7)} · 2판저장 ${pct(v2, perM[b].length)}%  ${b}`);
    });
  }

  const invFail = rMid.invFail + rElem.invFail;
  console.log('\n──────────────────────────────────────────────');
  console.log(`결과: 불변식 실패 ${invFail} (중등 ${rMid.invFail} · 초등 ${rElem.invFail}) · 초등 손시험 어긋남 ${fixBad}`);
  console.log(`      오답 놓침 중등 ${rMid.wrongFail}/${rMid.wrongChecked} · 초등 ${rElem.wrongFail}/${rElem.wrongChecked}`);
  console.log(`      라이트 1-2 자동채점 ${lightPct}% (목표 ${LIGHT_GOAL}%) · 초등 자동채점 ${elemPct}% (목표 ${ELEM_GOAL}%)`);
  const pass = invFail === 0 && fixBad === 0 && lightPct >= LIGHT_GOAL && (!elem.length || elemPct >= ELEM_GOAL);
  if (pass) console.log('✅ 계약 §2 + 초등 부록 §4 기준 통과');
  else console.log(`⚠ 기준 미달 (불변식 실패 0 · 손시험 0 · 라이트 1-2 ${LIGHT_GOAL}% · 초등 ${ELEM_GOAL}% 이상 필요)`);
})();
