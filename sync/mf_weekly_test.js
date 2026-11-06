#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 매쓰플랫 고등부 주간테스트 학습지 만들기        (2026-11-06 원장님 지시)
 * ═══════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   매쓰플랫 「주간TEST」 보관함에는 초1~중3 것만 있다(1,500여 회분). 고등부는 없다.
 *   그래서 «내신대비 교과서 학습지»를 재료로 20문항 한 장을 직접 만들어야 한다.
 *
 *   그런데 교과서 학습지는 «중단원 마무리» 단위로 올라와 있어서 시험범위 밖 문항이
 *   같이 들어 있다. 예를 들어 「집합과 명제」 한 장에 집합이 절반, 「미분」 한 장에
 *   미분계수·도함수·접선이 섞여 있다. 학습지째로 고르면 범위가 어긋난다.
 *   → 이 도구는 문항을 «소단원(littleChapterName) 하나하나» 보고 골라낸다.
 *
 * 무엇을 하나
 *   1) 계획 파일(JSON)에 반별 교과서 학습지 번호 + 시험범위 소단원 + 회차를 적는다
 *   2) 회차마다 20문항을 뽑는다 — 소단원을 고르게 나누고, 그 안에서 어려운 것부터
 *      난이도 쿼타(상2/중9/하7/최하2)를 채운다
 *   3) 한 반의 회차끼리 문항이 겹치지 않는다
 *   4) 「주간TEST」 태그 + 원장님 서식(46163)으로 만든다 — 문제 출처(교과서) 인쇄 켜짐
 *
 * 쓰는 법
 *   # ① 교재 찾기 — 어떤 교과서 학습지가 있고 소단원이 어떻게 들어 있나
 *   node sync/mf_weekly_test.js --scan 미적분1 --publisher 비상
 *   node sync/mf_weekly_test.js --units 67899135,67899137,67899142
 *
 *   # ② 계획 세워 보기 (만들지 않음)
 *   node sync/mf_weekly_test.js --plan sync/weekly_plans/2026-11_고1고2_기말.json --dry
 *
 *   # ③ 실제로 만들기 (한 회차만: --round 2)
 *   node sync/mf_weekly_test.js --plan sync/weekly_plans/... --round 2
 *
 *   # ④ 학생에게 배정
 *   node sync/mf_weekly_test.js --assign 85441865 --students I2038512,I2375052,I2415567
 *
 * 계정은 환경변수 MATHFLAT_ID / MATHFLAT_PASSWORD (저장소에 비밀번호를 적지 않는다)
 *
 * 함께 보기
 *   docs/mathflat_weekly_test.md        — 범위 잡는 방법·주의할 점
 *   sync/mf_progress_by_unit.js         — 학생이 실제로 어디까지 채점했나(소단원별)
 * ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const API = 'https://api.mathflat.com', BASE = 'https://teacher.mathflat.com';
let TOKEN = '';

const H = () => ({
  'content-type': 'application/json', 'x-platform': 'TEACHER_WEB',
  'x-freewheelin-host': 'mathflat.com', origin: BASE, referer: BASE + '/',
  ...(TOKEN ? { authorization: 'Bearer ' + TOKEN } : {}),
});
const log = (...a) => console.log(...a);

async function mf(method, path, body) {
  const o = { method, headers: H() };
  if (body !== undefined) o.body = JSON.stringify(body);
  const r = await fetch(API + encodeURI(path), o);
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 160)}`);
  if (!t) return null;
  const j = JSON.parse(t);
  return j.data !== undefined ? j.data : j;
}
const get = (p) => mf('GET', p);
const post = (p, b) => mf('POST', p, b);

async function login() {
  const id = (process.env.MATHFLAT_ID || '').trim();
  const pw = (process.env.MATHFLAT_PASSWORD || '').trim();
  if (!id || !pw) throw new Error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 없습니다');
  const r = await fetch(API + '/v2/login', {
    method: 'POST', headers: H(),
    body: JSON.stringify({ id, password: pw, userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  if (!r.ok) throw new Error('매쓰플랫 로그인 실패 ' + r.status);
  TOKEN = (await r.json()).accessToken;
}

/* 문항의 소단원 이름 — 범위를 가르는 기준 */
const unitOf = (p) => ((p.concept || {}).littleChapterName) || p.conceptName || '?';
/* 「(교과서-비상교육) p.96~98 …」 에서 쪽수 */
const pageOf = (s) => { const m = /p\.(\d+)/.exec(s || ''); return m ? +m[1] : 9999; };

/* 학습지 한 장의 문항 */
async function problemsOf(id) {
  const x = await get(`/worksheet/${id}?ignoredForDeleted=true`);
  const w = x.worksheet || x;
  return { title: (w.title || '').replace(/^\[[^\]]+\]\s*/, ''), tag: w.tag, problems: x.problems || w.problems || [] };
}

/* ── ① 교재 찾기 ──────────────────────────────────────────────── */
async function scanTextbooks(grade, publisher) {
  let all = [];
  for (let page = 0; page < 30; page++) {
    const d = await get(`/worksheet/school-prepare-textbook?page=${page}&size=100`);
    const c = d.content || [];
    all = all.concat(c);
    if (c.length < 100 || d.last) break;
  }
  const hit = all.filter((w) =>
    (!grade || String(w.grade || '').includes(grade) || String(w.title || '').includes(grade)) &&
    (!publisher || String(w.publisher || '').includes(publisher)));
  hit.sort((a, b) => pageOf(a.chapter) - pageOf(b.chapter));
  log(`내신대비 교과서 학습지 ${all.length}장 중 ${hit.length}장\n`);
  for (const w of hit) log(`  ${w.id} | ${w.publisher} | ${String(w.problemCount).padStart(3)}문항 | ${w.title} | ${w.chapter}`);
  return hit;
}

/* ── ② 소단원 분포 보기 ────────────────────────────────────────── */
async function showUnits(ids) {
  const agg = new Map();
  for (const id of ids) {
    const { title, problems } = await problemsOf(id);
    const c = {};
    problems.forEach((p) => { const u = unitOf(p); c[u] = (c[u] || 0) + 1;
      if (!agg.has(u)) agg.set(u, { n: 0, lv: {} });
      const a = agg.get(u); a.n++; a.lv[p.level] = (a.lv[p.level] || 0) + 1; });
    log(`  ${id} ${title}`);
    log(`      ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
  }
  log('\n  [합계] 소단원별');
  [...agg.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([u, v]) =>
    log(`    ${u.padEnd(28)} ${String(v.n).padStart(3)}문항  최하${v.lv[1] || 0}/하${v.lv[2] || 0}/중${v.lv[3] || 0}/상${v.lv[4] || 0}`));
}

/* ── ③ 20문항 뽑기 ────────────────────────────────────────────────
 * 소단원을 고르게 나누고(나머지는 문항이 많은 소단원에), 각 소단원 안에서
 * 어려운 난이도부터 쿼타를 채운다. 쿼타가 차면 남은 자리는 순서대로. */
function pickProblems(byUnit, units, used, count, quota) {
  const avail = {};
  units.forEach((u) => { avail[u] = (byUnit.get(u) || []).filter((p) => !used.has(p.id)); });
  const live = units.filter((u) => avail[u].length > 0);
  if (!live.length) return [];

  const target = {}; let left = count;
  const base = Math.floor(count / live.length);
  live.forEach((u) => { target[u] = Math.min(base, avail[u].length); left -= target[u]; });
  const order = [...live].sort((a, b) => (avail[b].length - target[b]) - (avail[a].length - target[a]));
  while (left > 0) {
    let moved = false;
    for (const u of order) { if (left <= 0) break; if (target[u] < avail[u].length) { target[u]++; left--; moved = true; } }
    if (!moved) break;
  }

  const need = { ...quota }, out = [];
  for (const u of live) {
    const pool = avail[u].slice(); let got = 0;
    for (const lv of [4, 3, 2, 1]) {
      while (got < target[u] && need[lv] > 0) {
        const i = pool.findIndex((p) => p.level === lv);
        if (i < 0) break;
        out.push(pool[i]); pool.splice(i, 1); need[lv]--; got++;
      }
    }
    while (got < target[u] && pool.length) { out.push(pool.shift()); got++; }
  }
  return out;
}

/* ── ④ 학습지 만들기 ──────────────────────────────────────────── */
async function createWorksheet({ title, grade, revision, schoolType, problems, design }) {
  const conceptIds = [...new Set(problems.map((p) => p.conceptId).filter(Boolean))];
  const flt = await post('/worksheet/filter/concept', {
    type: 'CONCEPT', conceptIdList: conceptIds, excludedTopicIds: [], excludedSubTopicIds: [],
    problemList: null, problemCount: problems.length, level: 3, levelWeight: [5, 30, 30, 25, 10],
    problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: false, excludePrevious: false,
    previousExclusionScope: null, studentIds: null, excludeOOC: true, equalityLevel: null,
    minRate: 0, maxRate: 100, selectedConceptIdList: [], selectedLittleChapterIdList: [],
  });
  const w = await post('/worksheet', {
    filterId: (flt && flt.filterId) || flt,
    title: title.slice(0, 45),            // 제목은 45자까지만 받는다
    tag: 'WEEKLY_TEST',                   // 「주간TEST」 보관함
    conceptIdList: [], littleChapterConceptIdList: [], assignStudentIdList: [],
    shareScope: 'ACADEMY', writer: '루멘수학', conceptSortType: 'CHAPTER',
    schoolType: schoolType || 'HIGH', revision: revision || 'CURRICULUM_22', grade,
    problemPadding: 60, pdfDate: null,
    designTemplateId: design, layoutType: 3, layoutColor: 'SAPPHIRE', partitionType: 4,
    qrFlag: true,
    relationWorkbookFlag: true,           // ★ 문제 출처(교과서)를 인쇄에 찍는다
    conceptNameFlag: false, problemTrendFlag: false, answerRateFlag: false,
    wrongAnswerNoteFlag: false, includeProblemFlag: false, pdfDateType: 'TODAY',
    problemList: problems.map((p) => ({ id: p.id, tagTop: p.tagTop || null })),
  });
  return w.id || w;
}

async function assign(worksheetId, studentIds) {
  const res = await post('/student-worksheet', { worksheetIdList: [worksheetId], studentIdList: studentIds });
  return (res.assignList || []).map((a) => a.studentName || a.studentId);
}

async function deleteWorksheets(ids) {
  const r = await fetch(API + '/worksheet', { method: 'DELETE', headers: H(), body: JSON.stringify(ids) });
  return r.ok;
}

/* ── ⑤ 계획 실행 ──────────────────────────────────────────────── */
async function runPlan(plan, { dry, onlyRound }) {
  const count = plan.count || 20;
  const quota = plan.quota || { 4: 2, 3: 9, 2: 7, 1: 2 };
  const design = plan.design || 46163;
  const made = [];

  for (const G of plan.groups) {
    /* 재료 모으기 — 시험범위 소단원만, 문항 번호 중복 제거 */
    const byUnit = new Map(); G.scope.forEach((u) => byUnit.set(u, []));
    const seen = new Set();
    let total = 0;
    for (const id of G.books) {
      const { problems } = await problemsOf(id);
      total += problems.length;
      for (const p of problems) {
        const u = unitOf(p);
        if (byUnit.has(u) && !seen.has(p.id)) { byUnit.get(u).push(p); seen.add(p.id); }
      }
    }
    const inScope = G.scope.reduce((a, u) => a + byUnit.get(u).length, 0);

    /* 이미 만들어 둔 학습지의 문항은 다시 쓰지 않는다 */
    const used = new Set();
    for (const id of (G.keepOut || [])) {
      const { problems } = await problemsOf(id);
      problems.forEach((p) => used.add(p.id));
    }

    log(`\n═══ ${G.name} — 교과서 ${total}문항 → 시험범위 ${inScope}문항` +
        (used.size ? ` (이미 쓴 문항 ${used.size}개 제외)` : ''));
    G.scope.forEach((u) => {
      const a = byUnit.get(u), free = a.filter((p) => !used.has(p.id)).length;
      log(`    ${u.padEnd(28)} ${String(a.length).padStart(3)} (쓸 수 있는 것 ${free})`);
    });

    for (const R of G.rounds) {
      if (onlyRound && R.no !== onlyRound) continue;

      /* 그 회차에만 더 넣는 교과서(다른 출판사 섞기 등) */
      if (R.add) for (const id of R.add) {
        const { problems } = await problemsOf(id);
        for (const p of problems) {
          const u = unitOf(p);
          if (byUnit.has(u) && !seen.has(p.id)) { byUnit.get(u).push(p); seen.add(p.id); }
        }
      }

      const units = R.units || G.scope;
      const picked = pickProblems(byUnit, units, used, count, quota);
      picked.forEach((p) => used.add(p.id));

      const lv = {}, su = {};
      picked.forEach((p) => { lv[p.level] = (lv[p.level] || 0) + 1; su[unitOf(p)] = (su[unitOf(p)] || 0) + 1; });
      const title = `${G.name} 주간테스트 ${R.no}회 (${R.date}) ${R.name}`;

      log(`\n  ▸ ${R.no}회차 ${R.date} — ${R.name}`);
      log(`    ${picked.length}문항 · 난이도 최하${lv[1] || 0}/하${lv[2] || 0}/중${lv[3] || 0}/상${lv[4] || 0}`);
      log(`    ${Object.entries(su).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
      if (picked.length < count) log(`    ⚠ 범위 안 문항이 모자라 ${picked.length}문항만 됩니다`);
      if (dry || !picked.length) continue;

      const wid = await createWorksheet({
        title, grade: G.grade, revision: G.revision, schoolType: G.schoolType, problems: picked, design,
      });
      const { problems: got } = await problemsOf(wid);
      const bad = got.filter((p) => !units.includes(unitOf(p))).length;
      log(`    ✅ ${wid} 「${title.slice(0, 45)}」 · ${got.length}문항 · 출처표시 ${got.filter((p) => p.tagTop).length} · 범위밖 ${bad}`);
      made.push({ group: G.name, round: R.no, id: wid });
    }
  }
  if (made.length) log('\n만든 학습지:\n' + made.map((m) => `  ${m.group} ${m.round}회 → ${m.id}`).join('\n'));
  return made;
}

/* ── 명령줄 ──────────────────────────────────────────────────── */
(async () => {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const has = (n) => args.includes('--' + n);

  await login();

  if (has('scan')) { await scanTextbooks(arg('scan'), arg('publisher')); return; }
  if (has('units')) { await showUnits(String(arg('units')).split(',').map(Number)); return; }
  if (has('assign')) {
    const ids = String(arg('students', '')).split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) throw new Error('--students I2038512,I2375052 처럼 학생 번호를 주세요');
    const names = await assign(Number(arg('assign')), ids);
    log(`배정 완료: ${names.join(', ')}`); return;
  }
  if (has('delete')) {
    const ids = String(arg('delete')).split(',').map(Number);
    log(await deleteWorksheets(ids) ? `지웠습니다: ${ids.join(', ')}` : '지우지 못했습니다'); return;
  }
  const planPath = arg('plan');
  if (!planPath) {
    log('쓰는 법은 이 파일 맨 위 설명을 보세요. (--scan / --units / --plan / --assign / --delete)');
    return;
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  await runPlan(plan, { dry: has('dry'), onlyRound: arg('round') ? Number(arg('round')) : null });
})().catch((e) => { console.error('실패:', e.message); process.exit(1); });
