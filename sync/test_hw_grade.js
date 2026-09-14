/**
 * 교재 채점 엔진 시험 — sync/hw_grade_engine.js
 * ==========================================================
 * 계약서 docs/bookscore_v2_contract.md §2 「시험」 항목을 그대로 돌린다.
 *
 *   ① 불변식 : 정답 원문을 그대로 넣으면 반드시 「맞음」 (모양별 300개씩, 실패 0이어야 함)
 *   ② 오답 검사 : 값을 바꾼 입력은 반드시 「틀림」
 *   ③ 모양 분포 : 라이트 1-2(bid 2124102) 전 문항의 shape·self 비율 (자동채점 ≥ 90%)
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

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };

function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s; }

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

// 학생에게 배정된 교재의 학년 (중1/중2/중3/고1…) — mf_swb_* 에서 모은다
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

(async () => {
  const books = await loadBooks();
  const { grade, students } = await loadGrades();
  console.log(`정답사전 ${books.length}권 읽음\n`);

  // ── 문항 모으기 ────────────────────────────────────────────
  const all = [];          // { bid, grade, p }
  for (const b of books) {
    if (ONE_BOOK && b.bid !== ONE_BOOK) continue;
    for (const pid of Object.keys(b.store.pages || {})) {
      const v = Number(b.store.pages[pid].v || 1);      // 정답사전 판(2판이면 img·cnt·units 가 들어 있다)
      for (const p of (b.store.pages[pid].problems || [])) all.push({ bid: b.bid, grade: grade[b.bid] || '', v, p });
    }
  }
  console.log(`전체 문항 ${all.length}개 (교재 ${new Set(all.map((x) => x.bid)).size}권)\n`);

  // ── ① 불변식 : 정답 원문 → 맞음 ────────────────────────────
  // 중1 교재를 우선 표본으로 삼되, 모자라면 다른 학년으로 채운다
  const byShape = {};
  const rank = (x) => (x.grade === '중1' ? 0 : x.grade === '중2' ? 1 : x.grade === '중3' ? 2 : 3);
  all.sort((a, b) => rank(a) - rank(b));
  for (const it of all) {
    const p = it.p;
    if (p.objective) continue;                      // 객관식은 번호 비교(엔진 밖)
    const s = HW.shapeOf({ type: p.type, answer: p.answer, objective: p.objective, cnt: p.cnt, units: p.units });
    if (s.self) continue;                           // 자기채점으로 가는 답은 불변식 대상 아님
    (byShape[s.shape] = byShape[s.shape] || []).push(it);
  }
  let inv = 0, invFail = 0, wrongChecked = 0, wrongFail = 0;
  const failSample = [], wrongSample = [];
  for (const shape of Object.keys(byShape).sort()) {
    const list = byShape[shape].slice(0, PER_SHAPE);
    let f = 0;
    for (const it of list) {
      inv++;
      const g = HW.grade(it.p.answer, it.p.answer);
      if (!g.gradable || !g.correct) { invFail++; f++; if (failSample.length < 20) failSample.push([shape, it.p.answer]); }
      // ② 오답 검사
      const bad = mutate(it.p.answer);
      if (bad !== String(it.p.answer)) {
        wrongChecked++;
        const g2 = HW.grade(it.p.answer, bad);
        if (g2.correct) { wrongFail++; if (wrongSample.length < 20) wrongSample.push([shape, it.p.answer, bad]); }
      }
    }
    console.log(`  ${pad(shape, 9)} 표본 ${pad(list.length, 4)} · 불변식 실패 ${f}`);
  }
  console.log(`\n① 불변식(정답 원문 → 맞음): ${inv - invFail}/${inv} 통과 · 실패 ${invFail}`);
  failSample.forEach((x) => console.log(`   ✗ [${x[0]}] ${JSON.stringify(x[1])}`));
  console.log(`② 오답 검사(값 바꾼 입력 → 틀림): ${wrongChecked - wrongFail}/${wrongChecked} 통과 · 실패 ${wrongFail}`);
  wrongSample.forEach((x) => console.log(`   ✗ [${x[0]}] 정답 ${JSON.stringify(x[1])} ← 입력 ${JSON.stringify(x[2])} 를 맞다고 함`));

  // ── ③ 모양 분포 (교재별) ───────────────────────────────────
  const report = (bid, items, title) => {
    const dist = {}, selfTop = {};
    let auto = 0;
    for (const it of items) {
      const p = it.p;
      const s = HW.shapeOf({ type: p.type, answer: p.answer, objective: p.objective, cnt: p.cnt, units: p.units });
      const k = s.shape + (s.self ? ' (자기채점)' : '');
      dist[k] = (dist[k] || 0) + 1;
      if (!s.self) auto++;
      else if (p.type !== 'ESSAY' && String(p.answer || '').trim() !== '.') {
        const key = JSON.stringify(String(p.answer).slice(0, 60));
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
  if (light.length) lightPct = report(LIGHT, light, `라이트 1-2 (bid ${LIGHT})`);
  else console.log(`\n③ 라이트 1-2(bid ${LIGHT}) 정답사전이 아직 없다`);

  if (!ONE_BOOK) {
    report('ALL', all, '전체 교재');
    // 배정 학생 수 많은 중등 교재 상위 10권
    const per = {};
    all.forEach((x) => { (per[x.bid] = per[x.bid] || []).push(x); });
    const list = Object.keys(per).filter((b) => /^중/.test(grade[b] || ''))
      .sort((a, b) => (students[b] || 0) - (students[a] || 0)).slice(0, 10);
    console.log('\n   ▸ 배정 학생 많은 중등 교재 자동채점 비율');
    list.forEach((b) => {
      let auto = 0, v2 = 0;
      per[b].forEach((x) => {
        const s = HW.shapeOf({ type: x.p.type, answer: x.p.answer, objective: x.p.objective, cnt: x.p.cnt, units: x.p.units });
        if (!s.self) auto++;
        if (x.v >= 2) v2++;
      });
      console.log(`     ${pad(grade[b] || '?', 4)} 학생 ${pad(students[b] || 0, 3)} · 문항 ${pad(per[b].length, 5)} · 자동 ${pad(pct(auto, per[b].length) + '%', 7)} · 2판저장 ${pct(v2, per[b].length)}%  ${b}`);
    });
  }

  console.log('\n──────────────────────────────────────────────');
  console.log(`결과: 불변식 실패 ${invFail} · 오답 오인정 ${wrongFail} · 라이트 1-2 자동채점 ${lightPct}%`);
  if (invFail === 0 && lightPct >= 90) console.log('✅ 계약 §2 기준 통과');
  else console.log(`⚠ 기준 미달 (불변식 실패 0 · 라이트 1-2 자동 90% 이상 필요)`);
})();
