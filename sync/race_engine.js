#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🏁 진도 레이스 집계 엔진  v1  (2026-08)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 시험기간 동안 학생이 「매쓰플랫에서 채점된 문항」을 얼마나 풀었는지
 * 난이도 가중치를 붙여 점수로 환산하고, 순위·리그·상 후보를 계산한다.
 *
 * ── 점수 규칙 (학생에게 공개) ─────────────────────────────────────
 *   난이도      기본   맞히면 두 배
 *   하   (1)     1점      2점
 *   중   (2)     2점      4점
 *   상   (3)     3점      6점
 *   최상 (4~5)   4점      8점
 *   · 틀려도 점수는 받는다(도전 자체가 점수) — 대신 맞히면 두 배.
 *   · 「모름(?)」도 푼 것으로 인정(기본점). 「미채점(-)」은 제외.
 *   · 학습지·교재·오답지·주간테스트 — 매쓰플랫에서 채점되면 모두 포함.
 *
 * ── 부(部) ────────────────────────────────────────────────────────
 *   중등부 · 고등부 = 시상 대상
 *   초등부 = 「체험 리그」 — 시상에서는 빼고, 중등부와 똑같은 잣대로 점수만
 *            쌓아 중학생 형·누나들의 공부량을 미리 겪어 보게 한다.
 *            기본은 6학년만(학원앱에서 4·5학년도 넣을 수 있다).
 *
 * ── 리그 (기본값, 학원앱에서 조정 가능) ───────────────────────────
 *   브론즈 0 · 실버 2,500 · 골드 5,000 · 다이아 9,000 · 마스터 13,000
 *   (실측 평균 2.58점/문항 기준 → 1,000 / 2,000 / 3,500 / 5,000문항)
 *   각 리그는 III → II → I 로 3등분 (마스터는 단일)
 *
 * ── 입력 / 출력 (lumen_store) ─────────────────────────────────────
 *   IN   race_season  = 시즌 설정 (학원앱이 저장) — 없으면 아무것도 안 함
 *   OUT  race_board   = 순위표 (학생앱·학부모앱·학원앱이 읽음, 이름은 김○○)
 *   OUT  race_watch   = 이상 신호 (원장님 화면 전용 — 정답률이 유난히 낮은 학생)
 *
 * 실행: node sync/race_engine.js   또는  require('./race_engine').runRace()
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });

const log = (...a) => console.log('[레이스]', ...a);

/* 난이도 → 기본 점수 (맞히면 ×2) */
/* ── 미리보기 모드 (2026-09-02) ────────────────────────────────────
 * `node sync/race_engine.js --dry`        아무것도 저장하지 않고 계산만 한다
 * `node sync/race_engine.js --dry --buff` 버프를 강제로 켜서 「켜면 어떻게 되나」를 본다
 *
 * ★ 왜 필요한가 — 버프를 켜기 전에 결과를 미리 보려고 계산기를 따로 짜면
 *   규칙이 어긋나 엉뚱한 숫자가 나온다(실제로 한 번 그랬다). 진짜 엔진을
 *   그대로 돌리되 저장만 막는 것이 유일하게 믿을 수 있는 방법이다. */
const DRY  = process.argv.includes('--dry');
const FBUF = process.argv.includes('--buff');

const LV_PT = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
const ptOf = (level, result) => {
  const base = LV_PT[Number(level)] || 2;          // 난이도 미상은 '중' 취급
  return result === 'O' ? base * 2 : base;
};

/* ═══ 🔥 집중 버프 — 플래너를 올린 날은 그날 문제 점수가 커진다 ═══
 * (2026-09-02 원장 결정)
 *
 * 배율 = 1 + (그날 플래너 점수 ÷ 10) × max      ※ 기본 max = 0.4 → 최대 1.4배
 *   플래너 10점 → ×1.40 · 9점 → ×1.36 · 5점 → ×1.20 · 안 올린 날 → ×1.00
 *
 * ★ 왜 「그날」인가
 *   아이들은 문제를 낮에 풀고 플래너는 밤 10시 이후에 올린다. 그래서 버프는
 *   「지금부터 더 풀어라」가 아니라 「그날 하루를 잘 마쳤으니 얹어 준다」이다.
 *   플래너 점수에는 이미 「어느 날 것인지」 날짜가 붙어 있으므로(원장님이 채점할 때 적는다),
 *   승인이 며칠 늦어도 날짜끼리 맞추면 된다. 레이스는 매번 시즌 전체를 다시 세므로
 *   나중에 승인해도 그날 점수가 저절로 채워진다.
 *
 * ⚠️ 이 규칙은 학원앱 안의 계산기(lumen_v18-134.html rcBuffMult)와 <b>똑같아야</b> 한다.
 *    한쪽만 고치면 두 화면의 점수가 어긋난다. */
const buffMult = (planScore, max) => {
  const v = Number(planScore);
  if (!(v > 0)) return 1;                       // 미제출·0점은 그대로
  return 1 + (Math.min(10, v) / 10) * (max > 0 ? max : 0.4);
};
/* 플래너 날짜 키를 YYYY-MM-DD 로 통일한다.
 * 실제 저장된 예: "2026.09.02" · "2026.9.2" · "2026.08.31(제출은 9/1)" */
const planDay = (key) => {
  const m = String(key || '').match(/^\s*(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
};

/* 기본 리그 구간 — 원장님이 학원앱에서 바꿀 수 있다 */
const DEF_TIERS = [
  { k: 'bronze',  n: '브론즈', at: 0 },
  { k: 'silver',  n: '실버',   at: 2500 },
  { k: 'gold',    n: '골드',   at: 5000 },
  { k: 'diamond', n: '다이아', at: 9000 },
  { k: 'master',  n: '마스터', at: 13000 },
];

/* ── Supabase 도우미 ──────────────────────────────────────────── */
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
  if (DRY) { log(`[미리보기] ${key} — 저장하지 않았습니다`); return; }
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST',
    headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) log(`저장 실패 ${key} ${r.status}`);
}
/* PostgREST는 한 번에 1000행까지 → range 헤더로 이어 받는다 */
async function sbAll(path) {
  const out = []; let from = 0;
  for (;;) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { ...sbH(), range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`조회 실패 ${r.status} @ ${path.slice(0, 60)}`);
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) break;
    from += 1000;
    if (from > 400000) break;   // 안전장치
  }
  return out;
}

/* ── 날짜 ────────────────────────────────────────────────────────
 * ⚠️ 중요: mf_answer_records.score_datetime에 적힌 시각은 <b>이미 한국시간</b>이다.
 *   매쓰플랫이 시간대 표시 없이 한국시간을 주고, 그대로 저장돼 있다(뒤에 +00:00이
 *   붙어 있지만 실제로는 한국시간이다). 여기에 9시간을 더하면 오후·저녁에 푼 것이
 *   전부 다음 날로 밀린다.
 *
 *   [확인 방법] 8월 채점기록 23,074건의 시각 분포:
 *     그대로 읽으면  → 15~17시·21~22시 정점, 새벽 3~6시 0건 (학원 운영시간과 일치 ✅)
 *     9시간 더하면   → 자정~2시 정점, 낮 12~15시 0건 (있을 수 없는 모습 ❌)
 *   그래서 <b>더하지 않고 그대로 쓴다</b>. 학원앱도 같은 방식이다(.slice(0,10)).
 *
 *   (2026-08-27에 잡은 버그 — 그전에는 +9를 해서 저녁에 푼 문제가 다음 날 점수로
 *    잡히고 있었다. 총점은 크게 다르지 않지만 「푼 날」·최근 14일 막대·성장률이 어긋났다.)  */
const kstDay = (iso) => String(iso || '').slice(0, 10);
/* 시즌 시작일 00:00 · 종료일 다음날 00:00 — 저장된 값이 한국시간이므로 그대로 견준다 */
const kstStartUtc = (d) => d + 'T00:00:00';
const kstEndUtc = (d) => new Date(new Date(d + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10) + 'T00:00:00';

/* ── 학생 명단 ────────────────────────────────────────────────
 * mf_answer_records의 lumen_rec_code는 비어 있으므로(수집 시 미매핑)
 * or_studentdb(이름→코드)와 mf_students(매쓰플랫ID→이름)를 이름으로 잇는다.
 * (mathflat_collector.js의 buildSidCodeMap과 같은 방식)                */
async function loadStudents() {
  let arr = await kvGet('or_studentdb');
  if (!Array.isArray(arr)) arr = [];
  const byName = {}, dup = {};
  const info = {};   // code → {name, nm, school, grade, band}
  arr.forEach((s) => {
    if (!s || !s.name || s.lumen_rec_code == null || s.withdrawn) return;
    const nm = String(s.name).trim();
    if (byName[nm]) dup[nm] = true; else byName[nm] = String(s.lumen_rec_code);
    const g = String(s.grade || '');
    const band = /고등/.test(g) ? 'high' : (/중학/.test(g) ? 'mid' : 'elem');
    const num = (g.match(/(\d)\s*학년/) || [])[1] || '';
    info[String(s.lumen_rec_code)] = {
      nm: nm.slice(0, 1) + '○○',
      sch: String(s.school || '').replace(/(중|고등)학교$/, '$1').replace(/초등학교$/, '초'),
      gr: (band === 'high' ? '고' : band === 'mid' ? '중' : '초') + num,
      band, gnum: num,
    };
  });
  const rows = await sbAll('mf_students?select=mf_student_id,name');
  const sid2code = {};
  rows.forEach((m) => {
    const nm = String(m.name || '').trim();
    if (!nm || dup[nm] || !byName[nm]) return;
    sid2code[m.mf_student_id] = byName[nm];
  });
  return { sid2code, info };
}

/* ── 플래너 점수 (학생앱에 발행된 = 원장님이 승인한 것만) ────────
 * lumen_store 의 student_planner_<학생코드> 를 전부 읽어
 *   { 학생코드: { "2026-09-02": 9, ... } } 로 만든다.
 * 승인 전 「예상 점수」는 여기 들어오지 않는다 — 화면에만 보여 주고
 * 점수에는 확정된 것만 넣는다(원장 결정 2026-09-02). */
async function loadPlanner() {
  const out = {};
  try {
    const rows = await sbAll('lumen_store?key=like.student_planner_*&select=key,value');
    rows.forEach((row) => {
      const code = String(row.key || '').replace('student_planner_', '');
      let v = row.value;
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
      const sc = (v && v.scores) || {};
      const m = {};
      Object.keys(sc).forEach((k) => {
        const d = planDay(k);
        if (!d) return;
        const n = Number(sc[k]);
        if (!isNaN(n)) m[d] = Math.max(m[d] || 0, n);   // 같은 날 키가 둘이면 높은 쪽
      });
      if (Object.keys(m).length) out[code] = m;
    });
  } catch (e) { log('플래너 점수 읽기 실패(버프 없이 진행):', e.message); }
  return out;
}

/* ── 리그 판정 ───────────────────────────────────────────────
 * 각 리그를 III → II → I 로 3등분. 마지막(마스터)은 단일 등급.     */
function tierOf(pts, tiers) {
  let i = 0;
  for (let k = 0; k < tiers.length; k++) if (pts >= tiers[k].at) i = k;
  const t = tiers[i];
  if (i === tiers.length - 1) return { tier: t.k, tierName: t.n, div: '', label: t.n };
  const w = Math.max(1, tiers[i + 1].at - t.at);
  const r = (pts - t.at) / w;
  const div = r < 1 / 3 ? 'III' : (r < 2 / 3 ? 'II' : 'I');
  return { tier: t.k, tierName: t.n, div, label: `${t.n} ${div}` };
}

/* ═══ 본체 ═══════════════════════════════════════════════════ */
async function runRace() {
  if (!SB_URL || !SB_KEY) { log('Supabase 환경변수 없음 — 건너뜀'); return null; }

  const season = await kvGet('race_season');
  if (!season || !season.from || !season.to) { log('시즌 설정 없음 — 건너뜀'); return null; }
  if (season.paused) { log('시즌 일시중지 — 건너뜀'); return null; }

  const tiers = (Array.isArray(season.tiers) && season.tiers.length ? season.tiers : DEF_TIERS)
    .slice().sort((a, b) => a.at - b.at);
  // elem = 초등부 「체험 리그」 — 시상에서는 빼고, 중등부와 같은 잣대로 점수만 쌓는다
  // (원장님: 초6이 중등부의 공부량을 미리 체험해 보는 기회. 2026-08-26)
  const leagues = season.leagues || { elem: false, mid: true, high: false };
  const elemGrades = (leagues.elemGrades && leagues.elemGrades.length) ? leagues.elemGrades.map(String) : ['6'];

  /* ── 부별 설정 (2026-08-28 원장님 지시로 추가) ────────────────────
   * [왜 부마다 다르게 두나] 고등부를 켜 보니 실측으로 이런 모습이었다:
   *   고등 7명 · 1등 650점 · 평균 407점   /   중등 12명 · 1등 2,593점 · 평균 1,691점
   *   중등 기준 티어(실버 2,500점)를 그대로 쓰면 <b>고등부는 전원 브론즈</b>에 갇혀
   *   시즌 내내 승급이 없다 — 등급이 올라가는 재미가 통째로 사라진다.
   * [그래서] 부마다 ① 티어 문턱 ② 공개 인원 ③ 상금 여부 ④ 다른 부에 흐리게 보일지를
   *   따로 정할 수 있게 했다. season.bands 에 부 이름으로 넣는다:
   *     bands: { high: { tiers:[...], showTop:3, prize:false, blurToOthers:true } }
   *   아무것도 안 넣으면 예전과 똑같이 동작한다(기존 시즌 설정을 건드리지 않는다). */
  const bandCfg = season.bands || {};
  const cfgOf = (band) => bandCfg[band] || {};
  const tiersOf = (band) => {
    const t = cfgOf(band).tiers;
    return (Array.isArray(t) && t.length) ? t.slice().sort((a, b) => a.at - b.at) : tiers;
  };

  const { sid2code, info } = await loadStudents();
  log(`학생 매핑 ${Object.keys(sid2code).length}명`);

  const t0 = kstStartUtc(season.from);
  const t1 = kstEndUtc(season.to);
  const recs = await sbAll(
    'mf_answer_records?select=mf_student_id,level,result,score_datetime' +
    `&score_datetime=gte.${t0}&score_datetime=lt.${t1}&order=score_datetime.asc`);
  log(`기간 ${season.from}~${season.to} · 채점기록 ${recs.length}건`);

  /* 🔥 집중 버프 설정 — 시즌에 켜져 있을 때만 (기본 꺼짐) */
  const buffOn = !!(season.buff && season.buff.on) || FBUF;
  const buffMax = Number((season.buff || {}).max) || 0.4;
  if (FBUF && !(season.buff && season.buff.on)) log('🔎 --buff : 시즌 스위치는 꺼져 있지만 켠 셈 치고 계산합니다');
  const plan = buffOn ? await loadPlanner() : {};
  if (buffOn) log(`🔥 집중 버프 켜짐 (최대 ×${(1 + buffMax).toFixed(2)}) · 플래너 있는 학생 ${Object.keys(plan).length}명`);

  /* 학생별 집계 */
  const agg = {};   // code → {...}
  // 서버(깃허브)는 UTC로 도니 「오늘」은 +9가 맞다 (이건 진짜 UTC 시계다)
  const todayK = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  recs.forEach((r) => {
    if (r.result !== 'O' && r.result !== 'X' && r.result !== '?') return;  // '-' 미채점 제외
    const code = sid2code[r.mf_student_id];
    if (!code || !info[code]) return;
    const a = agg[code] || (agg[code] = { code, pts: 0, base: 0, n: 0, ok: 0, hard: 0, byDay: {} });
    const lv = Number(r.level) || 2;
    /* base = 버프 없는 원점수 · pts = 버프까지 얹은 점수.
     * 둘 다 남겨야 학원앱에서 「버프로 얼마나 벌었나」를 보여 줄 수 있다. */
    const raw = ptOf(lv, r.result);
    const day = kstDay(r.score_datetime);
    const mult = buffOn ? buffMult((plan[code] || {})[day], buffMax) : 1;
    a.base += raw;
    a.pts += raw * mult;
    a.n += 1;
    if (r.result === 'O') a.ok += 1;
    if (lv >= 4) a.hard += 1;
    const d = kstDay(r.score_datetime);
    a.byDay[d] = (a.byDay[d] || 0) + 1;
  });

  /* 기간 안의 날짜 목록 (오늘까지) */
  const days = [];
  for (let t = new Date(season.from + 'T00:00:00Z').getTime();
       t <= new Date(Math.min(new Date(season.to + 'T00:00:00Z').getTime(),
                              new Date(todayK + 'T00:00:00Z').getTime())).getTime();
       t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
  const half = Math.max(1, Math.ceil(days.length / 2));
  const firstHalf = days.slice(0, half), lastHalf = days.slice(half);

  /* 리그별 순위표 만들기 */
  function buildBand(band) {
    const rows = Object.keys(info)
      .filter((c) => info[c].band === band)
      .filter((c) => band !== 'elem' || elemGrades.indexOf(String(info[c].gnum)) >= 0)
      .map((c) => {
        const a = agg[c] || { pts: 0, base: 0, n: 0, ok: 0, hard: 0, byDay: {} };
        /* 🔥 버프 요약 — 원점수·보너스·플래너 올린 날 수·평균 배율 */
        const pmap = plan[c] || {};
        const pdays = days.filter((d) => (pmap[d] || 0) > 0).length;
        const psum = days.reduce((s2, d) => s2 + (Number(pmap[d]) || 0), 0);
        const basePts = Math.round(a.base || a.pts);
        const bonus = Math.max(0, Math.round(a.pts) - basePts);
        // 성장률 = (후반 하루평균 ÷ 전반 하루평균 − 1) × 100
        // 기간이 짧으면 하루 결석만으로도 숫자가 튀므로 10일 이상일 때만 계산한다.
        const avg = (ds) => (ds.length ? ds.reduce((s, d) => s + (a.byDay[d] || 0), 0) / ds.length : 0);
        const f = avg(firstHalf), l = avg(lastHalf);
        return {
          code: c, nm: info[c].nm, sch: info[c].sch, gr: info[c].gr,
          pts: Math.round(a.pts), base: basePts, bonus: bonus,
          pdays: pdays, pavg: pdays ? Math.round((psum / pdays) * 10) / 10 : 0,
          n: a.n, ok: a.ok,
          rate: a.n ? Math.round((a.ok / a.n) * 100) : 0,
          hard: a.hard,
          days: Object.keys(a.byDay).filter((d) => (a.byDay[d] || 0) > 0).length,
          up: days.length < 10 ? null
            : (f ? Math.max(-100, Math.min(300, Math.round(((l - f) / f) * 100))) : (l ? 300 : 0)),
          spark: days.slice(-14).map((d) => a.byDay[d] || 0),        // 최근 14일 막대
        };
      })
      .sort((a, b) => b.pts - a.pts || b.n - a.n);
    const bt = tiersOf(band);            // 부마다 티어 문턱이 다를 수 있다
    rows.forEach((r, i) => {
      r.rank = i + 1;
      Object.assign(r, tierOf(r.pts, bt));
    });
    return rows;
  }

  const board = {
    at: new Date().toISOString(),
    seasonId: season.id || '',
    name: season.name || '진도 레이스',
    from: season.from, to: season.to,
    open: season.open !== false,
    showTop: Number(season.showTop) || 5,
    prizeTotal: Number((season.prizes || {}).total) || 0,
    prizeCount: Number((season.prizes || {}).count) || 5,
    tiers: tiers.map((t) => ({ k: t.k, n: t.n, at: t.at })),
    rules: {
      pt: [{ lv: '하', base: 1, ok: 2 }, { lv: '중', base: 2, ok: 4 },
           { lv: '상', base: 3, ok: 6 }, { lv: '최상', base: 4, ok: 8 }],
      note: '틀려도 점수를 받습니다. 맞히면 두 배! (정답률도 함께 봅니다)',
    },
    days: days.length,
    buff: { on: buffOn, max: buffMax },   // 앱들이 「🔥 버프 켜짐」 표시에 쓴다
  };

  /* ★ v2: 시즌이 끝났는지 — 끝나도 바로 지우지 않고 「최종 결과」로 며칠 더 보여준다.
   * 앱들은 board.ended / board.endedDays를 보고 표시를 바꾼다.
   * (기간이 지난 순간 화면에서 사라지면, 아이들이 결과를 볼 새가 없다) */
  board.ended = todayK > season.to;
  board.endedDays = board.ended
    ? Math.round((Date.parse(todayK + 'T00:00:00Z') - Date.parse(season.to + 'T00:00:00Z')) / 86400000)
    : 0;
  board.showDaysAfter = Number(season.showDaysAfter) || 7;   // 끝난 뒤 며칠 더 보여줄지

  const watch = { at: board.at, seasonId: board.seasonId, items: [] };

  // 초등부는 「체험 리그」 — 상 계산도, 이상 신호도 만들지 않는다
  board.demoBands = ['elem'];
  board.elemGrades = elemGrades;
  /* 부별 설정을 앱에도 그대로 넘긴다 — 학생앱·학부모앱·학원앱이 같은 값을 본다.
   *   bandTiers    : 부별 티어 (없으면 공통 티어)
   *   bandShowTop  : 부별 공개 인원
   *   noPrizeBands : 상금이 걸리지 않은 부 (예: 고등부)
   *   blurBands    : 다른 부 학생이 볼 때 흐리게(모자이크) 처리할 부 */
  board.bandTiers = {}; board.bandShowTop = {};
  board.noPrizeBands = []; board.blurBands = [];
  ['elem', 'mid', 'high'].forEach((bd) => {
    const c = cfgOf(bd);
    if (Array.isArray(c.tiers) && c.tiers.length) board.bandTiers[bd] = tiersOf(bd).map((t) => ({ k: t.k, n: t.n, at: t.at }));
    if (c.showTop != null) board.bandShowTop[bd] = Number(c.showTop) || 0;
    if (c.prize === false) board.noPrizeBands.push(bd);
    if (c.blurToOthers) board.blurBands.push(bd);
  });

  ['elem', 'mid', 'high'].forEach((band) => {
    if (!leagues[band]) return;
    const rows = buildBand(band);
    board[band] = rows;
    if (band === 'elem') return;               // 체험 리그는 여기까지
    if (cfgOf(band).prize === false) return;   // 상금이 없는 부는 시상 계산도 안 한다 (고등부)
    // 상 후보: 1~3등을 뺀 나머지 중에서
    const rest = rows.filter((r) => r.rank > 3 && r.n > 0);
    const steady = rest.slice().sort((a, b) => b.days - a.days || b.pts - a.pts)[0] || null;
    const gcand = rest.filter((r) => r !== steady && r.up != null);
    const growth = gcand.sort((a, b) => b.up - a.up || b.pts - a.pts)[0] || null;
    board[band + 'Awards'] = {
      steady: steady ? { code: steady.code, nm: steady.nm, days: steady.days } : null,
      growth: growth ? { code: growth.code, nm: growth.nm, up: growth.up } : null,
      note: days.length < 10 ? '성장상은 레이스가 10일 이상 진행되면 계산됩니다' : '',
    };
    // 이상 신호 — 어려운 문제를 그냥 오답 처리해 문항수만 늘리는 경우가 있는지
    // 원장님 화면에서만 참고 (자동 제외는 하지 않는다 — 판단은 원장님 몫)
    rows.forEach((r) => {
      if (r.n >= 80 && r.rate < 45) watch.items.push({ code: r.code, nm: r.nm, n: r.n, rate: r.rate, why: '정답률이 평소 범위(68~91%)보다 많이 낮음' });
    });
  });

  // 부별 요약 — 초등부 화면의 「중등부 형·누나들은 이만큼 풀어요」 게이지에 쓴다
  board.compare = {};
  ['elem', 'mid', 'high'].forEach((band) => {
    const rows = board[band];
    if (!rows || !rows.length) return;
    const tot = rows.reduce((s, r) => s + r.pts, 0);
    const totN = rows.reduce((s, r) => s + r.n, 0);
    /* ★ 초등부↔중등부 견주기는 「상위 5명끼리」로 한다 (2026-08-27 원장님 지시)
     * [왜] 전체 평균으로 견주면 인원 구성 때문에 불공평해진다.
     *   중등부 12명 중 적게 푼 학생들이 평균을 끌어내려, 초등부(6명) 평균과
     *   거의 같아 보였다 — 실측 초등 312문항 vs 중등 352문항(89%).
     *   상위 5명끼리 견주면 344 vs 502(69%)로 실제 격차가 드러난다.
     * [왜 5명] 1위끼리는 한 명 기록이라 그날그날 흔들리고, 5명은
     *   순위표에 공개되는 인원과 같아 아이들이 이해하기 쉽다.
     * 전체 평균(avg·avgN)도 그대로 남겨 둔다 — 다른 화면이 쓸 수 있다. */
    const t5 = rows.slice(0, 5);
    const t5p = t5.reduce((s, r) => s + r.pts, 0);
    const t5n = t5.reduce((s, r) => s + r.n, 0);
    board.compare[band] = {
      n: rows.length,
      avg: Math.round(tot / rows.length),
      avgN: Math.round(totN / rows.length),
      top5n: t5.length,
      top5: Math.round(t5p / t5.length),
      top5N: Math.round(t5n / t5.length),
      top: rows[0].pts,
    };
  });

  /* ★ v2: 끝난 시즌은 'race_history'에 한 번만 담아 둔다.
   * race_board는 키가 하나뿐이라, 다음 시즌을 만들면 지난 결과가 덮여 사라진다.
   * 명예의 전당처럼 두고두고 볼 수 있게 따로 보관한다(최근 12시즌). */
  if (board.ended && board.seasonId) {
    const hist = (await kvGet('race_history')) || {};
    hist.seasons = Array.isArray(hist.seasons) ? hist.seasons : [];
    if (!hist.seasons.some((x) => x && x.seasonId === board.seasonId)) {
      const slim = (rows) => (rows || []).map((r) => ({
        code: r.code, nm: r.nm, sch: r.sch, gr: r.gr,
        pts: r.pts, n: r.n, rate: r.rate, hard: r.hard, days: r.days,
        rank: r.rank, tier: r.tier, label: r.label,
      }));
      hist.seasons.unshift({
        seasonId: board.seasonId, name: board.name, from: board.from, to: board.to,
        endedAt: board.at, prizeTotal: board.prizeTotal,
        elem: slim(board.elem), mid: slim(board.mid), high: slim(board.high),
        midAwards: board.midAwards || null, highAwards: board.highAwards || null,
        compare: board.compare || null,
      });
      hist.seasons = hist.seasons.slice(0, 12);
      hist.updated = new Date().toISOString();
      await kvSet('race_history', hist);
      log(`시즌 종료 — 지난 결과로 보관했습니다 (${board.name})`);
    }
  }

  if (DRY) dryReport(board);

  await kvSet('race_board', board);
  await kvSet('race_watch', watch);

  const BN = { elem: '초등부(체험)', mid: '중등부', high: '고등부' };
  const brief = ['elem', 'mid', 'high'].filter((b) => board[b]).map((b) =>
    `${BN[b]} ${board[b].length}명 · 1위 ${board[b][0] ? board[b][0].pts + '점' : '-'}`).join(' / ');
  log(`완료: ${brief}${board.ended ? ` · 시즌 종료 ${board.endedDays}일째` : ''}${watch.items.length ? ` · 확인필요 ${watch.items.length}명` : ''}`);
  return board;
}

/* ── 미리보기 표 ──────────────────────────────────────────────────
 * 버프를 켜면 누가 얼마나 벌고 순위가 어떻게 움직이는지 한눈에 본다.
 * 이름은 순위표에 이미 가려진 값(옥○○)을 그대로 쓴다. */
function dryReport(board) {
  const BN = { elem: '초등부', mid: '중등부', high: '고등부' };
  const pad = (v, n) => String(v).padStart(n);
  let tb = 0, tg = 0, tm = 0, tn = 0;
  ['elem', 'mid', 'high'].forEach((band) => {
    const rows = board[band]; if (!rows || !rows.length) return;
    const hasBuff = rows.some((r) => Number(r.bonus || 0) > 0);
    console.log(`\n── ${BN[band]} ${rows.length}명 ${hasBuff ? '' : '(버프 없음)'} ──`);
    /* 버프가 없었다면 몇 등이었을까 — base 로 다시 줄 세워 비교한다 */
    const byBase = rows.slice().sort((a, b) => Number(b.base || b.pts) - Number(a.base || a.pts));
    const rk0 = {}; byBase.forEach((r, i) => { rk0[r.code] = i + 1; });
    console.log('순위  학생        원점수 →  버프후   보너스  플래너  순위변동');
    rows.forEach((r) => {
      const base = Number(r.base != null ? r.base : r.pts);
      const bon = Number(r.bonus || 0);
      const mv = rk0[r.code] - r.rank;
      tb += base; tg += bon; tn += 1; if (bon > 0) tm += 1;
      console.log(`${pad(r.rank, 3)}   ${String(r.nm || '').padEnd(9)}${pad(base, 6)} → ${pad(r.pts, 6)}`
        + `  ${pad('+' + bon, 6)}  ${pad((r.pdays || 0) + '일', 5)}   `
        + (mv > 0 ? `▲${mv}` : (mv < 0 ? `▼${-mv}` : '－')));
    });
  });
  console.log(`\n합계: ${tn}명 중 ${tm}명이 버프를 받음 · 원점수 ${tb.toLocaleString()} → `
    + `${(tb + tg).toLocaleString()} (총 +${tg.toLocaleString()}점, ${tb ? Math.round(tg / tb * 100) : 0}%)`);
  console.log('※ 미리보기입니다 — 순위표에 저장하지 않았습니다.\n');
}

module.exports = { runRace, ptOf, tierOf, DEF_TIERS };

if (require.main === module) {
  runRace().catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
