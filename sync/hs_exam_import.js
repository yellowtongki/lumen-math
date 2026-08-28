#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 고등학교 기출 → 매쓰플랫 학년별 폴더 일괄 등록  v1  (2026-08-28)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나요?】
 *   수학비서에 사 두신 학교 기출(소사고·범박고 등)을 매쓰플랫 「기타 학습자료」로
 *   등록하고, 학년별 폴더(예: 「범박고 고1 기출」)에 학습지로 담습니다.
 *   기존 exam_twin_pipeline.js(중학교로 검증됨)를 고등학교에 맞게 감싼 것입니다.
 *
 * 【고등학교가 중학교와 다른 점 — 이 파일이 해결하는 것】
 *   ① 교육과정 키(trieKey)가 학기가 아니라 <b>과목</b>으로 갈린다
 *      (공통수학1 / 공통수학2 / 대수 / 미적분I / 확률과통계 / 미적분II / 기하)
 *   ② 매쓰플랫 문제은행에 15개정 고등이 따로 없다 → 옛 과목명(수학상·수학1…)도
 *      내용이 같은 22개정 키로 보낸다. 실측: 1.2.10(15개정 고등)은 0개.
 *   ③ 학습지의 「학년」 값이 숫자가 아니라 과목명 문자열이다.
 *   ④ 제목에 과목명이 없는 기출이 있다 → 학년·학기로 과목을 추론한다.
 *
 * 【사용법】
 *   node sync/hs_exam_import.js --plan                 # 대상 목록만 보기(실행 안 함)
 *   node sync/hs_exam_import.js --only 571186          # 시험지 하나만 (시범)
 *   node sync/hs_exam_import.js --schools 범박고,소사고 --grades 고1,고2
 *   옵션: --from 2024      이 연도부터 (기본 2024 = 최근 3년)
 *         --twin           쌍둥이 학습지도 만든다 (기본은 원본만)
 *         --limit 5        앞에서 N장만
 *         --resume         이미 넣은 것은 건너뛴다 (기본 켜짐, --no-resume로 끔)
 *
 * 【이어하기】 넣은 기록은 Supabase lumen_store 'hs_exam_import'에 남습니다.
 *   중간에 끊겨도 다시 실행하면 안 넣은 것부터 이어서 합니다.
 *
 * 계정: MATHSECR_ID/PASSWORD, MATHFLAT_ID/PASSWORD, SUPABASE_URL/SERVICE_KEY (환경변수만)
 * 주의: 매쓰플랫 동시 로그인 시 원장님 접속이 끊길 수 있습니다.
 */
const { runTwinPipeline } = require('./exam_twin_pipeline.js');

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const STATE_KEY = 'hs_exam_import';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

function log(...a) { console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 22개정 고등 과목별 교육과정 키 (2026-08-28 매쓰플랫 실측) ──
 * 왼쪽에 15개정 옛 과목명도 함께 둔 이유: 매쓰플랫에 15개정 고등 문제은행이
 * 없어서(1.2.10 → 0개), 내용이 같은 22개정 과목으로 매칭시켜야 하기 때문. */
const HS_TRIE = {
  '공통수학1': '1.4.4147.4175', '수학상': '1.4.4147.4175', '수학(상)': '1.4.4147.4175',
  '공통수학2': '1.4.4147.4176', '수학하': '1.4.4147.4176', '수학(하)': '1.4.4147.4176',
  '대수': '1.4.4147.4177', '수학1': '1.4.4147.4177', '수학I': '1.4.4147.4177',
  '미적분1': '1.4.4147.4178', '수학2': '1.4.4147.4178', '수학II': '1.4.4147.4178', '미적분I': '1.4.4147.4178',
  '확률과통계': '1.4.4147.4179', '확통': '1.4.4147.4179',
  '미적분2': '1.4.4147.4180', '미적분': '1.4.4147.4180', '미적분II': '1.4.4147.4180',
  '기하': '1.4.4147.4181', '기하와벡터': '1.4.4147.4181',
};
/* 제목에 과목명이 없을 때 — 학년·학기로 추론 (일반적인 편성) */
const BY_GRADE_SEM = { '1-1': '공통수학1', '1-2': '공통수학2', '2-1': '대수', '2-2': '미적분1', '3-1': '확률과통계', '3-2': '확률과통계' };

/* 제목에서 과목명 뽑기 — 긴 이름부터 맞춰 본다(「수학1」이 「공통수학1」을 잡아채지 않게) */
function subjectOf(title) {
  const s = String(title || '').replace(/\s+/g, '');
  const keys = Object.keys(HS_TRIE).sort((a, b) => b.length - a.length);
  for (const k of keys) if (s.includes(k.replace(/\s+/g, ''))) return k;
  return null;
}

/* 수학비서 시험지 하나 → 매쓰플랫에 넣을 때 쓸 값들 */
function planOf(row) {
  const t = String(row.title || '');
  const grade = row.grade;                                   // 폴더에서 온 학년 (1 or 2) — 제목보다 믿을 만하다
  const sem = (t.match(/(\d)\s*학기/) || [])[1]
    || (t.match(/\b\d-(\d)\b/) || [])[1]                     // 「범박고 1-2 중간」 같은 짧은 제목
    || '1';
  let subj = subjectOf(t) || BY_GRADE_SEM[`${grade}-${sem}`] || null;
  const trie = subj ? HS_TRIE[subj] : null;
  const year = (t.match(/(20\d\d)/) || [])[1] || '';
  const term = t.includes('기말') ? '기말' : (t.includes('중간') ? '중간' : '');
  /* 22개정 과목명으로 통일해 표시 — 옛 이름(수학상)이면 새 이름(공통수학1)으로 */
  const canon = Object.keys(HS_TRIE).find((k) => HS_TRIE[k] === trie) || subj;
  /* row.school은 폴더 이름 그대로(「범박고」). 제목엔 「범박고등학교」로 풀어 쓴다 —
   * 이 제목이 문항 위 출처 꼬리표가 되므로 학교가 분명해야 한다. */
  const full = row.school.endsWith('고') ? row.school + '등학교' : row.school;
  const title = [full, grade + '학년', year + '년', sem + '학기', term, canon].filter(Boolean).join(' ');
  return { trie, subject: canon, gradeLabel: `고 ${grade}-${sem}`, title,
    mylist: `${row.school} 고${grade} 기출`, sortKey: `${row.school}${grade}${year}${sem}${term === '중간' ? 1 : 2}` };
}

/* ── 수학비서 ── */
let MS_TOKEN = null;
const msH = () => ({ accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  MS_TOKEN = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!MS_TOKEN) throw new Error('수학비서 로그인 실패 ' + r.status);
}
async function msGet(p) {
  const r = await fetch(MS_API + p, { headers: msH() });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return j;
}

/* 폴더 트리에서 「학교 > 고N」 폴더를 찾는다 */
async function findFolders(schools, grades) {
  const j = await msGet('/bms/api/v1/folders?folderType=mydb');
  const roots = Array.isArray(j.data) ? j.data : [j.data];
  const out = [];
  (function walk(list, school) {
    (list || []).forEach((f) => {
      if (!f) return;
      const isSchool = schools.includes(f.name);
      const g = (String(f.name).match(/고\s*([1-3])/) || [])[1];
      if (school && g && grades.includes('고' + g)) out.push({ id: f.id, school, grade: g, name: f.name });
      walk(f.children, isSchool ? f.name : school);
    });
  })(roots, null);
  return out;
}

async function msListAll() {
  const all = []; let cursor = '';
  for (let i = 0; i < 60; i++) {
    const p = await msGet(`/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const items = (p.data && p.data.mydbs) || [];
    all.push(...items);
    cursor = p.pagination && p.pagination.cursor;
    if (!cursor || !items.length) break;
  }
  return all;
}

/* ── 이어하기 기록 ── */
async function stateGet() {
  if (!SB_URL || !SB_KEY) return { done: {} };
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${STATE_KEY}&select=value`, { headers: { apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY } });
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v && v.done ? v : { done: {} };
  } catch (e) { return { done: {} }; }
}
async function stateSet(v) {
  if (!SB_URL || !SB_KEY) return;
  try {
    await fetch(`${SB_URL}/rest/v1/lumen_store`, {
      method: 'POST',
      headers: { apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ key: STATE_KEY, value: v, updated_at: new Date().toISOString() }),
    });
  } catch (e) {}
}

/* ── 이미 만든 학습지를 폴더에만 담기 ── */
async function refile() {
  const MF_API = 'https://api.mathflat.com', MF_BASE = 'https://teacher.mathflat.com';
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_BASE, referer: MF_BASE + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const lj = await r.json();
  if (!lj.accessToken) throw new Error('매쓰플랫 로그인 실패');
  const T = lj.accessToken;
  const H = { 'content-type': 'application/json', accept: 'application/json, text/plain, */*',
    'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
    authorization: 'Bearer ' + T, 'x-auth-token': T, origin: MF_BASE, referer: MF_BASE + '/' };
  const call = async (method, p, body) => {
    const rr = await fetch(MF_API + p, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await rr.text(); let jj = null; try { jj = JSON.parse(t); } catch (e) {}
    if (!rr.ok) throw new Error(`${method} ${p} → ${rr.status} ${t.slice(0, 160)}`);
    return jj && jj.data !== undefined ? jj.data : jj;
  };

  const st = await stateGet();
  const pending = Object.entries(st.done).filter(([, v]) => v && v.worksheet && !v.filed);
  if (!pending.length) { console.log('폴더에 담을 것이 없습니다 (모두 담겨 있음)'); return; }

  const byList = {};
  pending.forEach(([id, v]) => { (byList[v.mylist] || (byList[v.mylist] = [])).push({ id, ws: v.worksheet }); });
  const lists = await call('GET', '/mylist');
  const all = (lists && lists.myLists) || (Array.isArray(lists) ? lists : []);
  console.log(`현재 폴더 ${all.length}/20개 · 담을 학습지 ${pending.length}장 (폴더 ${Object.keys(byList).length}종)\n`);

  for (const [name, items] of Object.entries(byList)) {
    try {
      let target = all.find((l) => l.name === name);
      if (!target) {
        const mk = await call('POST', '/mylist', { name });
        target = (mk && mk.myList) || mk;
        all.push(target);
        console.log(`폴더 「${name}」 새로 만듦`);
      }
      await call('POST', `/mylist/${target.id}/element`, { worksheetIds: items.map((x) => Number(x.ws)) });
      items.forEach((x) => { st.done[x.id].filed = true; });
      await stateSet(st);
      console.log(`✅ 「${name}」에 ${items.length}장 담음`);
    } catch (e) {
      console.log(`❌ 「${name}」 실패: ${e.message.slice(0, 180)}`);
      if (/MY_LIST_LIMIT_EXCEEDED/.test(e.message))
        console.log('   → 매쓰플랫 폴더가 20개로 꽉 찼습니다. 안 쓰는 폴더를 지우신 뒤 다시 실행해 주세요.');
    }
  }
}

(async () => {
  const schools = (arg('schools', '범박고,소사고') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const grades = (arg('grades', '고1,고2') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const FROM = Number(arg('from', '2024'));
  const ONLY = Number(arg('only', '0'));
  const LIMIT = Number(arg('limit', '0'));
  const TWIN = has('--twin');
  const RESUME = !has('--no-resume');

  /* --refile: 이미 만들어 둔 학습지를 폴더에만 담는다 (폴더가 20개로 꽉 찼을 때 쓴다).
   * 매쓰플랫에 다시 등록하지 않으므로 중복이 생기지 않는다. */
  if (has('--refile')) { await refile(); return; }

  await msLogin();
  const folders = await findFolders(schools, grades);
  if (!folders.length) throw new Error('학교/학년 폴더를 못 찾았습니다: ' + schools.join(',') + ' / ' + grades.join(','));
  const fmap = {}; folders.forEach((f) => { fmap[f.id] = f; });

  const all = await msListAll();
  const yearOf = (t) => Number((String(t || '').match(/(20\d\d)/) || [])[1] || 0);
  let rows = all
    .filter((m) => fmap[m.folderId] && yearOf(m.title) >= FROM && m.dbStatus === 'dbCompleted')
    .map((m) => ({ id: m.id, title: m.title, q: m.questionCount, school: fmap[m.folderId].school, grade: fmap[m.folderId].grade }))
    .map((r) => ({ ...r, plan: planOf(r) }))
    .sort((a, b) => a.plan.sortKey.localeCompare(b.plan.sortKey));   // 학교 → 학년 → 연도 → 학기 → 중간/기말 순

  if (ONLY) rows = rows.filter((r) => r.id === ONLY);
  const st = await stateGet();
  const skipped = RESUME ? rows.filter((r) => st.done[r.id]).length : 0;
  if (RESUME) rows = rows.filter((r) => !st.done[r.id]);
  if (LIMIT) rows = rows.slice(0, LIMIT);

  console.log(`\n대상 ${rows.length}장${skipped ? ` (이미 넣은 ${skipped}장 건너뜀)` : ''} · ${TWIN ? '원본+쌍둥이' : '원본만'}\n`);
  const noTrie = rows.filter((r) => !r.plan.trie);
  if (noTrie.length) { console.log('❌ 과목을 못 정한 것:'); noTrie.forEach((r) => console.log('   ' + r.title)); }
  rows.forEach((r, i) => console.log(`  ${String(i + 1).padStart(2)}. [${r.id}] ${r.plan.mylist} | ${r.q}문항 | ${r.plan.subject} | ${r.plan.title}`));

  if (has('--plan')) { console.log('\n--plan 이라 여기까지 (아무것도 만들지 않았습니다)'); return; }
  if (noTrie.length) throw new Error('과목을 못 정한 시험지가 있어 멈춥니다 (제목 확인 필요)');

  const okList = [], failList = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    log(`\n━━ ${i + 1}/${rows.length}  [${r.id}] ${r.plan.title} ━━`);
    try {
      const out = await runTwinPipeline({
        mydb: r.id, trie: r.plan.trie, grade: r.plan.gradeLabel, gradeValue: r.plan.subject,
        title: r.plan.title, mylist: r.plan.mylist, originalOnly: !TWIN, log,
      });
      const filedOk = !!(out.filed && out.filed.ok);
      okList.push({ id: r.id, title: r.plan.title, ws: out.worksheetOriginal, matched: `${out.matched}/${out.matchedTotal}`, filed: filedOk });
      st.done[r.id] = { at: new Date().toISOString(), title: r.plan.title, mylist: r.plan.mylist,
        worksheet: out.worksheetOriginal, paper: out.paperId, filed: filedOk };
      await stateSet(st);
      log(`✅ 완료 — 매칭 ${out.matched}/${out.matchedTotal}${filedOk ? '' : ' · 폴더엔 못 담음(나중에 --refile)'}`);
    } catch (e) {
      failList.push({ id: r.id, title: r.plan.title, err: String(e.message).slice(0, 200) });
      log(`❌ 실패: ${e.message}`);
    }
    if (i < rows.length - 1) await sleep(3000);   // 매쓰플랫에 몰아치지 않게 잠깐 쉼
  }

  const unfiled = okList.filter((x) => !x.filed).length;
  console.log(`\n══ 마무리 ══\n성공 ${okList.length}장 · 실패 ${failList.length}장${unfiled ? ` · 폴더 못 담음 ${unfiled}장` : ''}`);
  okList.forEach((x) => console.log(`  ✅ ${x.title} (학습지 ${x.ws} · 매칭 ${x.matched})${x.filed ? '' : ' ⚠ 폴더 대기'}`));
  failList.forEach((x) => console.log(`  ❌ ${x.title} — ${x.err}`));
  if (unfiled) console.log(`\n폴더가 비면 다음으로 담을 수 있습니다:\n  node sync/hs_exam_import.js --refile`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
