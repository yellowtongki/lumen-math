#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🏫 학교알리미 수집기  v1  (2026-09-23)   — docs/ideas.md 6번 「고교 비교 해설 리포트」
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나요?】
 *   우리 학생들이 갈 부천 고교(7곳, 나중에 시흥·목동 추가 가능)의
 *   「교과별 학업성취 사항」(과목별 평균·A~E 비율)과 「학교 기본 현황」(재적·학급·교원)을
 *   학교알리미(schoolinfo.go.kr) 공개 API 로 받아 Supabase(lumen_store)에 저장합니다.
 *   → 원장님이 학교알리미 화면을 캡처해 올리던 일이 사라집니다.
 *
 * 【어디서 돌리나요?】
 *   클라우드 채팅은 학교알리미 접속이 막혀 있습니다(403). 그래서
 *     · 맥미니        : node sync/school_alrimi.js --probe   (바로 확인)
 *     · GitHub Actions: .github/workflows/school-alrimi.yml (주 1회 자동)
 *   둘 다 같은 파일을 씁니다.
 *
 * 【열쇠·주소는 어디에?】  절대 저장소에 넣지 않습니다.
 *   맥미니 : sync/.env.local 파일(깃에 안 올라감)에 한 줄씩
 *              ALRIMI_KEY=발급받은키
 *              SUPABASE_URL=https://bhkkkbcytcrlxhrtjgen.supabase.co
 *              SUPABASE_SERVICE_KEY=...
 *   Actions: Settings → Secrets → ALRIMI_KEY (NEIS_KEY 와 같은 자리)
 *
 * 【두 단계로 씁니다 — 처음엔 «살펴보기»】
 *   ① --probe   학교알리미가 어떤 항목(apiType)에 무엇을 주는지 훑어서
 *               lumen_store 'school_alrimi_probe' 와 sync/_debug/alrimi_probe.json 에 남깁니다.
 *               (Claude 가 클라우드에서 이 기록을 읽고 파서를 정확히 맞춥니다)
 *   ② --collect 살펴보기로 정한 항목 번호(lumen_store 'school_alrimi_cfg')로 본수집.
 *               지정이 없으면 아무것도 저장하지 않고 안내만 하고 끝납니다.
 *
 * 【학교 목록】  lumen_store 'school_alrimi_targets'  (처음 실행 때 7곳을 심어 둡니다)
 *   node sync/school_alrimi.js --list
 *   node sync/school_alrimi.js --add "소래고등학교"      ← 시흥·목동 학교도 이렇게 추가
 *   node sync/school_alrimi.js --remove "소래고등학교"
 *
 * 【저장하는 키】
 *   school_alrimi_targets : { schools:[{name, short, region}], updatedAt }
 *   school_alrimi_probe   : { at, year, base, tried:[{type, http, resultCode, count, columns, hits:[…]}] }
 *   school_alrimi_cfg     : { items:{ basic:'번호', ach:'번호' }, years:[2025,2024] }   ← 살펴본 뒤 정함
 *   school_alrimi_raw     : { at, years:{ '2025': { '<번호>': { '범박고등학교':[행…] } } } }
 *
 * 【로그 규칙】 열쇠는 절대 찍지 않습니다(주소도 가린 채 찍음). 학생 자료는 없습니다.
 */

'use strict';
const fs = require('fs');
const path = require('path');

/* ── sync/.env.local 이 있으면 읽는다 (맥미니용 · 깃에 안 올라감) ── */
(function loadLocalEnv() {
  try {
    const p = path.join(__dirname, '.env.local');
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) {}
})();

const KEY = (process.env.ALRIMI_KEY || '').trim();
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
/* 학교알리미 공개 API 주소 — 바뀌면 환경변수로 덮어쓴다 */
const BASE = (process.env.ALRIMI_BASE || 'https://www.schoolinfo.go.kr/openApi/openApiPeriodData.do').trim();
const BASE_SCHOOL = (process.env.ALRIMI_BASE_SCHOOL || 'https://www.schoolinfo.go.kr/openApi/openApiSchoolData.do').trim();

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const MODE = has('--probe') ? 'probe' : has('--list') ? 'list' : has('--add') ? 'add' : has('--remove') ? 'remove' : 'collect';
const DRY = has('--dry');
const YEAR = Number(opt('--year', '')) || (new Date().getFullYear() - 1);   /* 공시는 보통 전년도 것이 최신 */

const log = (...a) => console.log('[학교알리미]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = (u) => String(u).replace(/(apiKey=)[^&]+/i, '$1***');

/* ── Supabase ─────────────────────────────────────────────── */
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
async function kvGet(key) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
async function kvSet(key, value) {
  if (DRY) { log('(--dry) 저장 생략:', key); return; }
  if (!SB_URL || !SB_KEY) { log('⚠️ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없어 저장하지 못했습니다:', key); return; }
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(key + ' 저장 실패 ' + r.status + ' ' + (await r.text()).slice(0, 120));
}

/* ── 학교 목록 ─────────────────────────────────────────────── */
const DEFAULT_TARGETS = [
  { name: '범박고등학교', short: '범박고', region: '경기 부천' },
  { name: '소사고등학교', short: '소사고', region: '경기 부천' },
  { name: '정명고등학교', short: '정명고', region: '경기 부천' },
  { name: '시온고등학교', short: '시온고', region: '경기 부천' },
  { name: '부천고등학교', short: '부천고', region: '경기 부천' },
  { name: '부명고등학교', short: '부명고', region: '경기 부천' },
  { name: '소명여자고등학교', short: '소명여고', region: '경기 부천' },
];
const shortOf = (n) => String(n).replace(/여자고등학교$/, '여고').replace(/고등학교$/, '고');
async function loadTargets() {
  let t = await kvGet('school_alrimi_targets');
  if (!t || !Array.isArray(t.schools) || !t.schools.length) {
    t = { schools: DEFAULT_TARGETS, updatedAt: new Date().toISOString(), note: '처음 실행 때 7곳을 심었습니다. --add 로 추가하세요' };
    await kvSet('school_alrimi_targets', t);
    log('학교 목록이 없어 기본 7곳을 심었습니다');
  }
  return t;
}
/* 어느 열에든 학교 이름이 들어 있으면 그 학교 행으로 본다 (열 이름을 아직 모르므로) */
function matchSchool(row, targets) {
  const vals = Object.values(row || {}).filter((v) => typeof v === 'string');
  for (const t of targets) {
    if (vals.some((v) => v.indexOf(t.name) >= 0 || v.replace(/\s/g, '') === t.name)) return t.name;
  }
  return null;
}

/* ── 호출 ─────────────────────────────────────────────────── */
async function callApi(base, type, year, extra) {
  const q = new URLSearchParams({ apiKey: KEY, apiType: String(type), pbanYr: String(year), schulKndCode: '04', ...(extra || {}) });
  const url = base + '?' + q.toString();
  const out = { url: mask(url), http: 0, kind: '', resultCode: '', resultMsg: '', rows: [], columns: [], raw: '' };
  try {
    const r = await fetch(url, { headers: { accept: 'application/json, text/plain, */*' } });
    out.http = r.status;
    const ct = String(r.headers.get('content-type') || '');
    const text = await r.text();
    if (/json/i.test(ct) || /^\s*[\[{]/.test(text)) {
      let j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
      if (j) {
        out.kind = 'json';
        out.resultCode = String(j.resultCode || j.result || j.RESULT_CODE || '');
        out.resultMsg = String(j.resultMsg || j.message || j.RESULT_MSG || '').slice(0, 120);
        const list = Array.isArray(j) ? j : (j.list || j.data || j.items || j.rows || (j.body && j.body.items) || []);
        out.rows = Array.isArray(list) ? list : [];
        out.columns = out.rows.length ? Object.keys(out.rows[0]) : Object.keys(j).slice(0, 30);
        return out;
      }
    }
    out.kind = /<html/i.test(text) ? 'html' : 'text';
    out.raw = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  } catch (e) { out.kind = 'error'; out.raw = String(e.message).slice(0, 160); }
  return out;
}

/* ── ① 살펴보기 ───────────────────────────────────────────── */
function parseRange(s) {
  const out = [];
  String(s).split(',').forEach((p) => {
    const m = p.trim().match(/^(\d+)-(\d+)$/);
    if (m) { for (let i = Number(m[1]); i <= Number(m[2]); i++) out.push(i); }
    else if (p.trim()) out.push(p.trim());
  });
  return out;
}
async function probe() {
  if (!KEY) { log('❌ ALRIMI_KEY 가 없습니다. sync/.env.local 또는 GitHub Secrets 에 넣어 주세요.'); process.exit(1); }
  const T = await loadTargets();
  const targets = T.schools;
  const types = parseRange(opt('--types', process.env.ALRIMI_PROBE_TYPES || '0-80'));
  const bases = [BASE, BASE_SCHOOL];
  log(`살펴보기 시작 — 공시연도 ${YEAR} · 항목 ${types.length}개 × 주소 ${bases.length}개 · 학교 ${targets.length}곳`);
  const tried = [];
  for (const base of bases) {
    for (const type of types) {
      const r = await callApi(base, type, YEAR);
      const hits = [];
      r.rows.forEach((row) => { const n = matchSchool(row, targets); if (n && hits.length < 3) hits.push({ school: n, row }); });
      const rec = { base: base.replace(/^https?:\/\/[^/]+/, ''), type, http: r.http, kind: r.kind, resultCode: r.resultCode, resultMsg: r.resultMsg,
        count: r.rows.length, columns: r.columns.slice(0, 40), hits, note: r.raw };
      tried.push(rec);
      const tag = r.kind === 'json' ? `json ${r.resultCode || ''} ${r.rows.length}행` : `${r.kind} ${r.raw.slice(0, 50)}`;
      log(`  ${rec.base}  apiType=${String(type).padStart(2)}  http ${r.http}  ${tag}${hits.length ? '  ★ 우리 학교 ' + hits.length + '건' : ''}`);
      await sleep(350);
    }
  }
  const summary = { at: new Date().toISOString(), year: YEAR, bases, types: types.length, tried };
  try { fs.mkdirSync(path.join(__dirname, '_debug'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '_debug', 'alrimi_probe.json'), JSON.stringify(summary, null, 1)); log('로컬 기록: sync/_debug/alrimi_probe.json'); } catch (e) {}
  /* 서버에는 크기를 줄여 저장 (열 이름 + 우리 학교 행 3개까지) */
  await kvSet('school_alrimi_probe', summary);
  const useful = tried.filter((t) => t.kind === 'json' && t.count > 0);
  const withHits = tried.filter((t) => t.hits.length);
  log(`끝 — JSON 으로 온 항목 ${useful.length}개 · 우리 학교가 보이는 항목 ${withHits.length}개`);
  if (withHits.length) log('  우리 학교가 보인 항목: ' + withHits.map((t) => t.base + '#' + t.type + '(' + t.columns.length + '열)').join(', '));
  log('👉 이제 Claude 에게 「살펴보기 끝났다」고 알려 주시면 기록을 읽고 본수집 파서를 맞춥니다.');
}

/* ── ② 본수집 (항목 번호가 정해진 뒤) ────────────────────────── */
async function collect() {
  if (!KEY) { log('❌ ALRIMI_KEY 가 없습니다.'); process.exit(1); }
  const cfg = await kvGet('school_alrimi_cfg');
  if (!cfg || !cfg.items || !Object.keys(cfg.items).length) {
    log('ℹ️ 아직 어느 항목을 받을지 정해지지 않았습니다 (school_alrimi_cfg 없음).');
    log('   먼저  node sync/school_alrimi.js --probe  를 돌려 주세요. 아무것도 저장하지 않고 끝냅니다.');
    return;
  }
  const T = await loadTargets();
  const targets = T.schools;
  const years = Array.isArray(cfg.years) && cfg.years.length ? cfg.years : [YEAR];
  const base = cfg.base || BASE;
  const prev = (await kvGet('school_alrimi_raw')) || { years: {} };
  const raw = { at: new Date().toISOString(), years: prev.years || {} };
  let total = 0;
  for (const yr of years) {
    raw.years[yr] = raw.years[yr] || {};
    for (const [label, type] of Object.entries(cfg.items)) {
      const r = await callApi(base, type, yr, cfg.extra || null);
      if (r.kind !== 'json') { log(`⚠️ ${yr} ${label}(#${type}) 응답이 JSON 이 아닙니다 — ${r.kind} ${r.raw.slice(0, 80)}`); continue; }
      const bySchool = {};
      r.rows.forEach((row) => { const n = matchSchool(row, targets); if (n) (bySchool[n] = bySchool[n] || []).push(row); });
      raw.years[yr][type] = { label, columns: r.columns, schools: bySchool, count: Object.values(bySchool).reduce((a, b) => a + b.length, 0), at: new Date().toISOString() };
      total += raw.years[yr][type].count;
      log(`${yr} ${label}(#${type}) — 전체 ${r.rows.length}행 중 우리 학교 ${raw.years[yr][type].count}행 (${Object.keys(bySchool).length}곳)`);
      await sleep(350);
    }
  }
  await kvSet('school_alrimi_raw', raw);
  log(`저장 완료 — 우리 학교 행 ${total}건 (school_alrimi_raw)`);
  const missing = targets.filter((t) => !years.some((yr) => Object.values(raw.years[yr] || {}).some((b) => b.schools && b.schools[t.name])));
  if (missing.length) log('⚠️ 한 행도 못 찾은 학교: ' + missing.map((t) => t.name).join(', ') + ' — 이름이 공시 표기와 다른지 확인');
}

/* ── 학교 목록 관리 ───────────────────────────────────────── */
async function manage() {
  const T = await loadTargets();
  if (MODE === 'list') { log('학교 ' + T.schools.length + '곳'); T.schools.forEach((s) => console.log('   ' + s.name + ' (' + (s.region || '') + ')')); return; }
  const name = String(opt(MODE === 'add' ? '--add' : '--remove', '')).trim();
  if (!name) { log('학교 이름을 적어 주세요. 예: --add "소래고등학교"'); return; }
  if (MODE === 'add') {
    if (T.schools.some((s) => s.name === name)) { log('이미 있습니다:', name); return; }
    T.schools.push({ name, short: shortOf(name), region: opt('--region', '') });
    log('추가:', name);
  } else {
    const n0 = T.schools.length; T.schools = T.schools.filter((s) => s.name !== name);
    log(n0 === T.schools.length ? '목록에 없습니다: ' + name : '뺐습니다: ' + name);
  }
  T.updatedAt = new Date().toISOString();
  await kvSet('school_alrimi_targets', T);
  log('학교 ' + T.schools.length + '곳: ' + T.schools.map((s) => s.short || s.name).join(' · '));
}

(async () => {
  if (MODE === 'probe') await probe();
  else if (MODE === 'collect') await collect();
  else await manage();
})().catch((e) => { console.error('[학교알리미] ❌', e.message); process.exit(1); });
