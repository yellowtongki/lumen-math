#!/usr/bin/env node
/* 수학비서 폴더 정리기 — 「나만의 DB」 최상위에 쌓인 학교 기출을 학교·학년 폴더로 옮긴다
 *
 * 왜 필요한가:
 *   나만의 DB 최상위 «작업공간»에 학교 기출이 100장 넘게 쌓여 있다. 제목이
 *   「내신 2025년 경기 부천시 시온고 고1 공통 2학기 기말 공통수학2」처럼 규칙적이라
 *   학교와 학년을 제목에서 읽어 이미 만들어 둔 폴더로 자동으로 넣을 수 있다.
 *
 * 원칙 (2026-10-01 원장 지시):
 *   · 이미 만들어진 학교 폴더와 그 아래 학년 폴더에만 넣는다
 *   · **폴더가 없는 학교의 기출은 건드리지 않고 그대로 둔다** (폴더를 새로 만들지 않는다)
 *   · 학년 폴더가 없으면 학교 폴더 자체에 넣는다
 *   · 교과서·교사용자료처럼 학교 기출이 아닌 것은 그대로 둔다
 *
 * 사용법:
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/mathsecr_tidy.js            # 계획만 보기 (아무것도 바꾸지 않는다)
 *   ... node sync/mathsecr_tidy.js --go     # 실제로 옮기기
 *   ... node sync/mathsecr_tidy.js --go --limit 5   # 앞 5장만 (시험용)
 *
 * 옵션:
 *   --go              실제 이동 (없으면 계획만)
 *   --limit N         N장만 처리
 *   --create 상일중,소래고   이 학교들의 폴더를 새로 만든 뒤 정리한다
 *                           (학교 이름 끝 글자로 「고등학교」/「중학교」 아래에 넣고,
 *                            다른 학교와 똑같이 1·2·3학년 폴더까지 만든다)
 *   --retitle         올린 파일명이 그대로 제목이 된 기출을 수학비서 형식으로 고친다
 *                     「26년 옥길중 3-2 중간」
 *                       → 「내신 2026년 경기 부천시 옥길중 중3 2학기 중간 중등수학3하」
 *   --out <파일>      계획을 마크다운으로 저장
 *   --undo <파일>     이동 기록(_debug/tidy_log_*.json)을 읽어 되돌린다
 *
 * 이동 API (2026-10-01 확인):
 *   나만의 DB   PATCH /bms/api/v1/mydbs?target=folder
 *               body { targetPoDbIds: [id...], targetFolderId: N }
 *   내 문제지   POST  /bms/api/v1/my-papers?action=move&targetPaperIds=<id>&targetFolderId=<N>
 *   둘 다 성공하면 204를 돌려준다.
 *   폴더 만들기 POST  /bms/api/v1/folders?folderType=mydb   body { name, parentId }
 *
 * 계정: 환경변수 MATHSECR_ID / MATHSECR_PASSWORD (코드·저장소에 절대 넣지 않는다)
 */
const fs = require('fs');
const path = require('path');

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const OUT_DIR = path.join(__dirname, '_debug');
const MYDB_ROOT = 53046;   // 나만의 DB 최상위 «작업공간»

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const GO = args.includes('--go');
const LIMIT = Number(arg('limit', 0)) || 0;
const OUT = arg('out', null);
const UNDO = arg('undo', null);
const CREATE = (arg('create', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const RETITLE = args.includes('--retitle');

/* 맥에서 올린 파일명은 한글이 «분해형»(NFD)으로 저장된다 — 「년」이 ᄂ+ᅧ+ᆫ 세 글자다.
 * 그대로 두면 글자 맞추기가 전부 실패하므로 읽을 때 반드시 합쳐 놓는다. */
const NFC = s => String(s || '').normalize('NFC').trim();

const log = m => console.log(m);

/* ── 수학비서 ────────────────────────────────────────────── */
let TOKEN = null;
const H = () => ({ accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  TOKEN = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!r.ok || !TOKEN) throw new Error(`수학비서 로그인 실패 ${r.status}`);
}
async function msGet(p) {
  const r = await fetch(MS_API + p, { headers: H() });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${p} → ${r.status}`);
  return j;
}
// 나만의 DB 를 폴더로 옮긴다. 성공하면 204.
// ⚠️ 본문 열쇠말은 targetDbIds 다. 수학비서 코드에 targetPoDbIds 를 쓰는 훅이 따로 있는데
//    그건 구매 DB용이라 여기에 쓰면 404(not found)가 난다. (2026-10-01 실측)
async function moveMydbs(ids, folderId) {
  const r = await fetch(`${MS_API}/bms/api/v1/mydbs?target=folder`, {
    method: 'PATCH', headers: H(),
    body: JSON.stringify({ targetDbIds: ids, targetFolderId: folderId }),
  });
  if (!r.ok) throw new Error(`이동 실패 ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.status;
}

/* 폴더를 새로 만든다.
 * ⚠️ 이 API 는 만들어진 폴더의 id 를 돌려주지 않는다(2026-10-01 실측). 그래서 만든 뒤
 *    폴더 트리를 다시 읽어 이름으로 찾는다. 응답만 믿으면 id 를 못 받아 멈춘다. */
async function createFolder(name, parentId) {
  const r = await fetch(`${MS_API}/bms/api/v1/folders?folderType=mydb`, {
    method: 'POST', headers: H(), body: JSON.stringify({ name, parentId }),
  });
  if (!r.ok) throw new Error(`폴더 만들기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`);
}
// 그 이름의 폴더가 없으면 만들고, 어느 쪽이든 id 를 돌려준다 (여러 번 돌려도 안전하다)
async function ensureFolder(name, parentName, parentId) {
  let tree = await folderTree();
  let hit = tree.find(f => f.name === name && f.parent === parentName);
  if (hit) return { id: hit.id, created: false };
  await createFolder(name, parentId);
  tree = await folderTree();
  hit = tree.find(f => f.name === name && f.parent === parentName);
  if (!hit) throw new Error(`「${parentName} / ${name}」 를 만들었는데 다시 찾지 못했습니다`);
  return { id: hit.id, created: true };
}

async function folderTree() {
  const j = await msGet('/bms/api/v1/folders?folderType=mydb');
  const flat = [];
  (function walk(n, parent) {
    if (!n) return;
    flat.push({ id: n.id, name: n.name, parent });
    (n.children || []).forEach(c => walk(c, n.name));
  })(j.data || j, null);
  return flat;
}
async function listMydbs() {
  const all = [];
  let cursor = '';
  for (let i = 0; i < 60; i++) {
    const j = await msGet(`/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const items = (j.data && j.data.mydbs) || [];
    all.push(...items);
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor || !items.length) break;
  }
  return all;
}

/* ── 제목에서 학교·학년 읽기 ───────────────────────────────
 * 「내신 2025년 경기 부천시 시온고 고1 공통 2학기 기말 공통수학2」
 *                            ^^^^^ ^^^ 여기 둘만 쓴다
 * 학교 이름은 «고/중»으로 끝나는 낱말, 바로 뒤가 «고1~3/중1~3».
 * 학교명이 부분적으로 겹치는 경우(중흥중 ↔ 중흥고)가 있어 반드시 낱말 전체로 맞춘다. */
function parseTitle(t) {
  const m = NFC(t).match(/(\S*?[고중](?:등학교|학교)?)\s*(고|중)\s*([1-3])/);
  if (!m) return null;
  // 「옥길중학교」→「옥길중」, 「부천고등학교」→「부천고」 로 맞춘다
  const school = m[1].replace(/등?학교$/, '');
  return { school, grade: m[2] + m[3] };
}

/* 학교 폴더 찾기 — 「고등학교」/「중학교」 아래에 있고 이름이 정확히 같아야 한다 */
function findSchoolFolder(folders, school) {
  return folders.find(f => (f.parent === '고등학교' || f.parent === '중학교') && f.name === school) || null;
}
/* 학년 폴더 찾기 — 이름이 「고1」이거나 「상원고 고1」·「중원고1」처럼 학교명이 붙어 있기도 하다 */
function findGradeFolder(folders, schoolFolder, grade) {
  const kids = folders.filter(f => f.parent === schoolFolder.name);
  return kids.find(k => {
    const n = k.name.replace(schoolFolder.name, '').replace(/\s+/g, '');
    return n === grade || n === grade.slice(1);
  }) || null;
}

/* ── 제목 고치기 ────────────────────────────────────────── */
// 제목 바꾸기 API. 성공하면 204.
async function renameMydb(id, title) {
  const r = await fetch(`${MS_API}/bms/api/v1/mydbs/${id}?target=title`, {
    method: 'PATCH', headers: H(), body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error(`제목 바꾸기 실패 ${r.status} ${(await r.text()).slice(0, 200)}`);
}

/* 올바른 제목에서 지역·계열·과목을 배운다. 수학비서는 띄어쓰기가 들쭉날쭉해서
 * 「중3공통 2학기중간」처럼 붙여 쓴 것까지 읽을 수 있게 느슨하게 맞춘다. */
const GOOD_RE = /^내신\s+(20\d\d)년\s+(.+?)\s+(\S*?[고중])\s*(고|중)\s*([1-3])\s*(공통|공|문과|이과)?\s*([12])\s*학기\s*(중간|기말)\s*(\S+)\s*$/;
function learnGood(all) {
  const out = [];
  all.forEach(x => {
    const m = GOOD_RE.exec(NFC(x.title));
    if (m) out.push({ year: +m[1], region: m[2], school: m[3].replace(/등?학교$/, ''), gk: m[4], g: +m[5], track: (m[6] === '공' ? '공통' : m[6]) || '', sem: +m[7], term: m[8], subject: m[9] });
  });
  return out;
}
/* 파일명형 제목에서 연도·학교·학년·학기·중간기말을 읽는다 */
function parseFileName(t) {
  const y = t.match(/(20\d\d)|(?:^|\D)(\d\d)년/) || [];
  const gs = t.match(/([1-3])\s*-\s*([12])/) || [];
  return {
    year: y[1] ? +y[1] : (y[2] ? 2000 + +y[2] : null),
    school: (t.match(/([가-힣]+[고중])(?![등학])/) || [])[1] || null,
    grade: gs[1] ? +gs[1] : null, sem: gs[2] ? +gs[2] : null,
    term: /기말/.test(t) ? '기말' : (/중간|1차|지필/.test(t) ? '중간' : null),
  };
}
function proposeTitle(t, good) {
  const p = parseFileName(t);
  const miss = ['year', 'school', 'grade', 'sem', 'term'].filter(k => !p[k]);
  if (miss.length) return { why: `제목에서 ${miss.join('·')} 를 못 읽음` };
  const sib = good.filter(g => g.school === p.school);
  if (!sib.length) return { why: `「${p.school}」의 올바른 제목이 없어 지역을 못 배움` };
  const region = sib[0].region;
  const gk = sib[0].gk;
  if (gk === '중') {
    // 중학교는 학기로 과목이 정해진다 — 1학기=상, 2학기=하. 계열은 쓰지 않는다.
    // (옛 2015개정 자료 중에 2학기인데 「3상」으로 적힌 것이 있어 그쪽을 따라가면 틀린다)
    return { title: `내신 ${p.year}년 ${region} ${p.school} 중${p.grade} ${p.sem}학기 ${p.term} 중등수학${p.grade}${p.sem === 1 ? '상' : '하'}` };
  }
  // 고등학교는 해마다 과목이 달라 같은 학년·학기 자료에서 계열·과목을 가져온다
  const cand = sib.filter(g => g.g === p.grade && g.sem === p.sem).sort((a, b) => Math.abs(a.year - p.year) - Math.abs(b.year - p.year));
  if (!cand.length) return { why: `${p.school} 고${p.grade} ${p.sem}학기 자료가 없어 과목을 못 정함` };
  const ref = cand[0];
  return { title: `내신 ${p.year}년 ${region} ${p.school} 고${p.grade}${ref.track ? ' ' + ref.track : ''} ${p.sem}학기 ${p.term} ${ref.subject}`, ref };
}

async function retitle(all) {
  const good = learnGood(all);
  const odd = all.filter(x => x.paperType === 'school_exams' && !/^내신/.test(NFC(x.title)));
  log(`형식이 맞는 제목 ${good.length}장에서 규칙을 배웁니다 · 파일명 그대로인 것 ${odd.length}장\n`);
  const plan = [], skip = [];
  for (const x of odd) {
    const from = NFC(x.title);
    const r = proposeTitle(from, good);
    if (r.title) plan.push({ id: x.id, q: x.questionCount, status: x.dbStatus, from, to: r.title });
    else skip.push({ id: x.id, from, why: r.why });
  }
  log(`■ 고칠 것 — ${plan.length}장`);
  plan.forEach(r => { log(`  [${r.id}] Q${r.q}${r.status === 'dbProcessing' ? ' (DB화 진행 중)' : ''}\n      지금 「${r.from}」\n      바꿈 「${r.to}」`); });
  if (skip.length) { log(`\n■ 손대지 않을 것 — ${skip.length}장`); skip.forEach(s => log(`  [${s.id}] ${s.from}  → ${s.why}`)); }
  if (!GO) { log('\n※ 계획만 보여드렸습니다. 실제로 고치려면 --go 를 붙이세요.'); return; }
  const done = [], fails = [];
  for (const r of (LIMIT ? plan.slice(0, LIMIT) : plan)) {
    try { await renameMydb(r.id, r.to); done.push(r); log(`  ✅ [${r.id}] ${r.to}`); }
    catch (e) { fails.push({ ...r, error: e.message }); log(`  ❌ [${r.id}] ${e.message}`); }
    await new Promise(s => setTimeout(s, 200));
  }
  const f = path.join(OUT_DIR, `retitle_log_${Date.now()}.json`);
  fs.writeFileSync(f, JSON.stringify({ at: new Date().toISOString(), done, fails }, null, 1));
  log(`\n고침 ${done.length}장 · 실패 ${fails.length}장\n기록: ${f}`);
}

/* ── 되돌리기 ───────────────────────────────────────────── */
async function undo(file) {
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  log(`되돌리기: ${file} — ${rec.moves.length}건`);
  const byFrom = {};
  rec.moves.forEach(m => { (byFrom[m.from] = byFrom[m.from] || []).push(m.id); });
  for (const [folderId, ids] of Object.entries(byFrom)) {
    if (GO) { await moveMydbs(ids, Number(folderId)); log(`  ${ids.length}장 → 폴더 ${folderId} 복구`); }
    else log(`  [계획] ${ids.length}장 → 폴더 ${folderId}`);
  }
  if (!GO) log('\n※ 계획만 보여드렸습니다. 실제로 되돌리려면 --go 를 붙이세요.');
}

/* ── 본체 ───────────────────────────────────────────────── */
(async () => {
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) throw new Error('MATHSECR_ID/PASSWORD 환경변수가 없습니다');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await msLogin();
  log('로그인 OK');

  if (UNDO) return undo(UNDO);

  let folders = await folderTree();
  const all = await listMydbs();
  if (RETITLE) return retitle(all);
  const root = all.filter(x => x.folderId === MYDB_ROOT);
  log(`나만의 DB 전체 ${all.length}장 · 최상위에 쌓인 것 ${root.length}장\n`);

  // ── --create: 학교 폴더 + 1·2·3학년 폴더 만들기
  if (CREATE.length) {
    log('■ 새로 만들 폴더');
    const made = [];
    for (const school of CREATE) {
      const isHigh = /고$/.test(school);
      const parentName = isHigh ? '고등학교' : '중학교';
      const parentFolder = folders.find(f => f.name === parentName);
      if (!parentFolder) { log(`   ❌ 「${parentName}」 폴더를 못 찾음 — 「${school}」 건너뜀`); continue; }
      const grades = [1, 2, 3].map(n => (isHigh ? '고' : '중') + n);
      // 이 학교 기출이 실제로 몇 장인지 (확인용)
      const n = root.filter(x => { const p = parseTitle(x.title); return p && p.school === school; }).length;
      log(`   「${school}」 → ${parentName} 아래 · 학년 폴더 ${grades.join('·')} · 들어갈 기출 ${n}장`);
      if (!GO) continue;
      const sf = await ensureFolder(school, parentName, parentFolder.id);
      made.push({ name: school, id: sf.id, created: sf.created });
      for (const g of grades) {
        const gf = await ensureFolder(g, school, sf.id);
        made.push({ name: `${school}/${g}`, id: gf.id, created: gf.created });
      }
      const n2 = made.filter(m => m.created && m.name.startsWith(school)).length;
      log(`   ✅ 「${school}」 — 새로 만든 폴더 ${n2}개 (이미 있던 것은 그대로 씀)`);
    }
    if (GO && made.length) {
      fs.writeFileSync(path.join(OUT_DIR, `tidy_folders_${Date.now()}.json`), JSON.stringify(made, null, 1));
      folders = await folderTree();   // 새 폴더를 반영해 다시 읽는다
    }
    log('');
  }

  const plan = [];      // 옮길 것
  const stay = [];      // 그대로 둘 것
  for (const x of root) {
    const p = parseTitle(x.title);
    if (!p) { stay.push({ ...x, why: '학교 기출이 아님(교과서·교사용자료 등)' }); continue; }
    const sf = findSchoolFolder(folders, p.school);
    if (!sf) { stay.push({ ...x, why: `「${p.school}」 폴더가 없음`, school: p.school }); continue; }
    const gf = findGradeFolder(folders, sf, p.grade);
    plan.push({
      id: x.id, title: x.title, school: p.school, grade: p.grade,
      to: (gf || sf).id, toName: gf ? `${sf.name} / ${gf.name}` : sf.name, gradeFolder: !!gf,
    });
  }

  // ── 계획 보여주기
  const byTarget = {};
  plan.forEach(p => { (byTarget[p.toName] = byTarget[p.toName] || []).push(p); });
  log('■ 옮길 것 — ' + plan.length + '장');
  Object.entries(byTarget).sort().forEach(([k, v]) => log(`   ${String(v.length).padStart(3)}장 → ${k}${v[0].gradeFolder ? '' : '  (학년 폴더가 없어 학교 폴더로)'}`));

  const stayBy = {};
  stay.forEach(s => { (stayBy[s.why] = stayBy[s.why] || []).push(s); });
  log('\n■ 그대로 둘 것 — ' + stay.length + '장');
  Object.entries(stayBy).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => log(`   ${String(v.length).padStart(3)}장  ${k}`));

  if (OUT) {
    let md = `# 나만의 DB 최상위 정리 계획\n\n작성 ${new Date().toLocaleDateString('ko-KR')} · 최상위 ${root.length}장 중 **${plan.length}장 이동 · ${stay.length}장 유지**\n\n`;
    md += '## 옮길 것\n\n| id | 가는 곳 | 제목 |\n|---|---|---|\n';
    plan.forEach(p => { md += `| \`${p.id}\` | ${p.toName} | ${p.title} |\n`; });
    md += '\n## 그대로 둘 것\n\n| id | 이유 | 제목 |\n|---|---|---|\n';
    stay.forEach(s => { md += `| \`${s.id}\` | ${s.why} | ${s.title} |\n`; });
    fs.writeFileSync(OUT, md);
    log(`\n계획 문서: ${OUT}`);
  }

  if (!GO) { log('\n※ 계획만 보여드렸습니다. 실제로 옮기려면 --go 를 붙이세요.'); return; }

  // ── 실제 이동 (같은 목적지끼리 묶어서 한 번에)
  const target = LIMIT ? plan.slice(0, LIMIT) : plan;
  const groups = {};
  target.forEach(p => { (groups[p.to] = groups[p.to] || []).push(p); });
  const moves = [], fails = [];
  for (const [folderId, items] of Object.entries(groups)) {
    try {
      await moveMydbs(items.map(i => i.id), Number(folderId));
      items.forEach(i => moves.push({ id: i.id, title: i.title, from: MYDB_ROOT, to: Number(folderId), toName: i.toName }));
      log(`  ✅ ${items.length}장 → ${items[0].toName}`);
    } catch (e) {
      items.forEach(i => fails.push({ id: i.id, title: i.title, error: String(e.message) }));
      log(`  ❌ ${items.length}장 → ${items[0].toName} — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }
  const logFile = path.join(OUT_DIR, `tidy_log_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`);
  fs.writeFileSync(logFile, JSON.stringify({ at: new Date().toISOString(), type: 'mydb', moves, fails }, null, 1));
  log(`\n옮김 ${moves.length}장 · 실패 ${fails.length}장`);
  log(`기록: ${logFile}`);
  log(`되돌리려면: node sync/mathsecr_tidy.js --undo ${logFile} --go`);
})();
