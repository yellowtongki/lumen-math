#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🏫 학교 학사일정 수집기  v1  (2026-08)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나요?】
 *   우리 학생들이 다니는 학교(옥길중·범박중·범박고·소사고 …)의 <b>시험일</b>을
 *   교육부 나이스(NEIS)에서 매일 자동으로 받아옵니다.
 *
 *   그러면 원장님이 시험 날짜를 손으로 넣으실 일이 없어지고,
 *   진도 레이스도 「옥길중 2학기 기말 D-28」처럼 앱이 먼저 알려줄 수 있습니다.
 *
 * 【어디서 가져오나요?】
 *   나이스 교육정보 개방 포털 (open.neis.go.kr) — 교육부가 공개하는 자료입니다.
 *   인증키는 GitHub Secrets의 NEIS_KEY에만 두고 저장소에는 넣지 않습니다.
 *   (키가 없으면 학교당 5건만 와서 시험일을 놓칩니다 — 반드시 키가 있어야 합니다)
 *
 * 【무엇을 저장하나요?】  lumen_store 'school_calendar'
 *   {
 *     at, year,
 *     schools: [{
 *       name:'옥길중학교', short:'옥길중', atpt:'J10', code:'7581258',
 *       addr, kind:'중',
 *       exams: [{ from:'2026-09-30', to:'2026-10-01', days:2,
 *                 label:'2학기 중간', grades:[1,2,3]|null, name:'지필평가' }],
 *       next: { ...가장 가까운 다가올 시험..., dday: 113 }
 *     }],
 *     students: { '옥길중학교': 11, ... }   // 우리 학원 재원생 수
 *   }
 *
 * 실행: node sync/school_info.js            (수집 후 저장)
 *       node sync/school_info.js --dry      (저장하지 않고 화면에만)
 */

const NEIS = 'https://open.neis.go.kr/hub';
const KEY = (process.env.NEIS_KEY || '').trim();
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DRY = process.argv.includes('--dry');

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });
const log = (...a) => console.log('[학사일정]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Supabase ─────────────────────────────────────────────── */
async function kvGet(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${key}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) log(`저장 실패 ${key} ${r.status}`);
  return r.ok;
}

/* ── 나이스 ───────────────────────────────────────────────── */
async function neis(path, params) {
  const q = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: '1000', ...params });
  if (KEY) q.set('KEY', KEY);
  const url = `${NEIS}/${path}?${q}`;
  const r = await fetch(url, { headers: { 'user-agent': 'lumen-math/1' } });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!j) return { rows: [], msg: `응답이 JSON이 아님 (HTTP ${r.status})` };
  if (j.RESULT) return { rows: [], msg: `${j.RESULT.CODE} ${j.RESULT.MESSAGE}` };
  const box = j[path];
  if (!Array.isArray(box)) return { rows: [], msg: '예상과 다른 응답' };
  const h = box.find((x) => x.head), rr = box.find((x) => x.row);
  const total = h && h.head && h.head[0] && h.head[0].list_total_count;
  return { rows: (rr && rr.row) || [], total, msg: '' };
}

/* ── 학교 찾기 ────────────────────────────────────────────── */
async function findSchool(name) {
  const { rows, msg } = await neis('schoolInfo', { SCHUL_NM: name });
  if (msg) return { err: msg };
  if (!rows.length) return { err: '학교를 찾지 못함' };
  // 같은 이름이 여럿이면 경기도(부천) 것을 고른다 — 우리 학원 학생 기준
  const pick = rows.find((s) => /경기|부천/.test(String(s.LCTN_SC_NM) + String(s.ORG_RDNMA))) || rows[0];
  return {
    name: pick.SCHUL_NM, atpt: pick.ATPT_OFCDC_SC_CODE, code: pick.SD_SCHUL_CODE,
    addr: pick.ORG_RDNMA || '', region: pick.LCTN_SC_NM || '',
    kind: /고등/.test(pick.SCHUL_NM) ? '고' : (/중학/.test(pick.SCHUL_NM) ? '중' : '초'),
    dup: rows.length > 1,
  };
}

/* ── 시험 판정 ────────────────────────────────────────────── */
// 「지필평가」「중간고사」「기말고사」 등만 시험으로 본다.
// 「수행평가」는 날짜가 흩어져 있어 시험기간으로 잡으면 안 된다.
const EXAM_RE = /지필|중간고사|기말고사|중간·기말|고사(?!장)|(?<!수행)평가/;
// 수능·모의고사·전국연합은 학교 시험이 아니라 제외한다(시험 대비 기간이 완전히 다르다).
const NOT_EXAM_RE = /수행평가|진단평가|모의|학력|성취도|설문|만족도|자율|전국연합|수능|대학수학능력|졸업|입학|상담/;
const isExam = (nm) => {
  const t = String(nm || '');
  if (NOT_EXAM_RE.test(t)) return false;
  return EXAM_RE.test(t);
};
/* 「1,2학년」「2·3학년」「3학년」 같은 표기에서 학년을 뽑는다. 없으면 null(전 학년) */
function gradesOf(nm) {
  const m = String(nm || '').match(/([0-9]\s*(?:[,·~및]\s*[0-9]\s*)*)학년/);
  if (!m) return null;
  const g = (m[1].match(/[0-9]/g) || []).map(Number).filter((x) => x >= 1 && x <= 3);
  return g.length ? [...new Set(g)].sort() : null;
}
const ymd = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const dnum = (s) => new Date(`${ymd(s)}T00:00:00Z`).getTime();
/* 달로 학기·중간/기말을 추측한다 (학교마다 조금씩 다르지만 표시용) */
function labelOf(ymdStr) {
  const m = Number(ymdStr.slice(4, 6));
  if (m >= 3 && m <= 5) return '1학기 중간';
  if (m >= 6 && m <= 8) return '1학기 기말';
  if (m >= 9 && m <= 10) return '2학기 중간';
  return '2학기 기말';
}

/* 흩어진 시험 날짜를 「연속된 기간」으로 묶는다 (주말은 건너뛴 것으로 본다) */
function groupExams(events) {
  const days = events.filter((e) => isExam(e.EVENT_NM))
    .map((e) => ({ d: String(e.AA_YMD || ''), nm: String(e.EVENT_NM || '').trim() }))
    .filter((x) => /^\d{8}$/.test(x.d))
    .sort((a, b) => a.d.localeCompare(b.d));
  const out = [];
  days.forEach((x) => {
    const last = out[out.length - 1];
    // 앞 시험 마지막 날과 4일 이내면 같은 시험기간(주말·공휴일이 낀 경우)
    if (last && (dnum(x.d) - dnum(last.toRaw)) <= 4 * 86400000) {
      last.to = ymd(x.d); last.toRaw = x.d; last.days += 1;
      if (!last.names.includes(x.nm)) last.names.push(x.nm);
      const g = gradesOf(x.nm); if (g) last.grades = [...new Set([...(last.grades || []), ...g])].sort();
      return;
    }
    out.push({ from: ymd(x.d), fromRaw: x.d, to: ymd(x.d), toRaw: x.d, days: 1,
      names: [x.nm], grades: gradesOf(x.nm), label: labelOf(x.d) });
  });
  return out.map((e) => ({
    from: e.from, to: e.to, days: e.days, label: e.label,
    grades: e.grades, name: e.names[0],
  }));
}

/* ── 본체 ─────────────────────────────────────────────────── */
async function run() {
  if (!KEY) {
    log('⚠️ NEIS_KEY가 없습니다 — 학교당 5건만 와서 시험일을 놓칩니다.');
    log('   GitHub → Settings → Secrets and variables → Actions 에 NEIS_KEY를 넣어 주세요.');
  }
  // 우리 학원 학생들의 학교 목록
  let names = [], counts = {};
  const stu = await kvGet('or_studentdb');
  if (Array.isArray(stu)) {
    stu.forEach((s) => {
      if (!s || s.withdrawn) return;
      const sc = String(s.school || '').trim();
      if (!sc || /초등학교$/.test(sc)) return;   // 초등학교는 지필평가가 없어 제외
      counts[sc] = (counts[sc] || 0) + 1;
      if (names.indexOf(sc) < 0) names.push(sc);
    });
  }
  if (!names.length) { log('재원생 학교 정보가 없습니다 — 건너뜁니다.'); return null; }
  log(`대상 학교 ${names.length}곳: ${names.join(' · ')}`);

  const year = new Date().getFullYear();
  const schools = [];
  for (const nm of names) {
    const sc = await findSchool(nm);
    if (sc.err) { log(`  ${nm} — 찾지 못함 (${sc.err})`); schools.push({ name: nm, err: sc.err }); continue; }
    const { rows, total, msg } = await neis('SchoolSchedule', {
      ATPT_OFCDC_SC_CODE: sc.atpt, SD_SCHUL_CODE: sc.code,
      AA_FROM_YMD: `${year}0101`, AA_TO_YMD: `${year}1231`,
    });
    if (msg) { log(`  ${sc.name} — 학사일정 실패 (${msg})`); schools.push({ ...sc, err: msg }); continue; }
    const exams = groupExams(rows);
    // 학교마다 시험 이름이 다르다. 「시험 같아 보이는데 안 잡힌 일정」을 남겨 두면
    // 새 학교가 늘어도 무엇을 놓쳤는지 바로 보인다.
    const missed = [...new Set(rows
      .filter((e) => /평가|고사|시험/.test(String(e.EVENT_NM || '')) && !isExam(e.EVENT_NM))
      .map((e) => String(e.EVENT_NM).trim()))];
    const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    const upcoming = exams.filter((e) => e.to >= today);
    const next = upcoming[0]
      ? { ...upcoming[0], dday: Math.round((Date.parse(upcoming[0].from + 'T00:00:00') - Date.parse(today + 'T00:00:00')) / 86400000) }
      : null;
    schools.push({
      name: sc.name, short: sc.name.replace(/(중|고등)학교$/, '$1'), atpt: sc.atpt, code: sc.code,
      addr: sc.addr, kind: sc.kind, eventN: rows.length, eventTotal: total || rows.length,
      exams, next, missed,
    });
    log(`  ${sc.name} — 일정 ${rows.length}건${total && total > rows.length ? `/${total}` : ''} · 시험 ${exams.length}회`
      + (next ? ` · 다음 ${next.label} ${next.from}${next.days > 1 ? `~${next.to}` : ''} (D-${next.dday})` : ' · 남은 시험 없음'));
    exams.forEach((e) => log(`      ${e.label.padEnd(8)} ${e.from}${e.days > 1 ? '~' + e.to : '        '} ${e.days}일`
      + (e.grades ? ` · ${e.grades.join(',')}학년` : ' · 전 학년') + ` · ${e.name}`));
    if (missed.length) log(`      ↪ 시험으로 세지 않은 일정: ${missed.join(' / ')}`);
    if (!exams.length) log(`      ⚠️ 시험을 하나도 못 찾았습니다 — 이 학교는 일정 이름이 다를 수 있습니다.`);
    await sleep(300);
  }

  const value = { at: new Date().toISOString(), year, schools, students: counts, keyed: !!KEY };
  if (DRY) { log('--dry 이므로 저장하지 않습니다.'); return value; }
  if (!SB_URL || !SB_KEY) { log('Supabase 환경변수가 없어 저장을 건너뜁니다.'); return value; }
  await kvSet('school_calendar', value);
  log('school_calendar 저장 완료');
  return value;
}

module.exports = { run, groupExams, isExam, gradesOf, labelOf };

if (require.main === module) {
  run().catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
