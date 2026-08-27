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
const LV_PT = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
const ptOf = (level, result) => {
  const base = LV_PT[Number(level)] || 2;          // 난이도 미상은 '중' 취급
  return result === 'O' ? base * 2 : base;
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

  const { sid2code, info } = await loadStudents();
  log(`학생 매핑 ${Object.keys(sid2code).length}명`);

  const t0 = kstStartUtc(season.from);
  const t1 = kstEndUtc(season.to);
  const recs = await sbAll(
    'mf_answer_records?select=mf_student_id,level,result,score_datetime' +
    `&score_datetime=gte.${t0}&score_datetime=lt.${t1}&order=score_datetime.asc`);
  log(`기간 ${season.from}~${season.to} · 채점기록 ${recs.length}건`);

  /* 학생별 집계 */
  const agg = {};   // code → {...}
  // 서버(깃허브)는 UTC로 도니 「오늘」은 +9가 맞다 (이건 진짜 UTC 시계다)
  const todayK = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  recs.forEach((r) => {
    if (r.result !== 'O' && r.result !== 'X' && r.result !== '?') return;  // '-' 미채점 제외
    const code = sid2code[r.mf_student_id];
    if (!code || !info[code]) return;
    const a = agg[code] || (agg[code] = { code, pts: 0, n: 0, ok: 0, hard: 0, byDay: {} });
    const lv = Number(r.level) || 2;
    a.pts += ptOf(lv, r.result);
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
        const a = agg[c] || { pts: 0, n: 0, ok: 0, hard: 0, byDay: {} };
        // 성장률 = (후반 하루평균 ÷ 전반 하루평균 − 1) × 100
        // 기간이 짧으면 하루 결석만으로도 숫자가 튀므로 10일 이상일 때만 계산한다.
        const avg = (ds) => (ds.length ? ds.reduce((s, d) => s + (a.byDay[d] || 0), 0) / ds.length : 0);
        const f = avg(firstHalf), l = avg(lastHalf);
        return {
          code: c, nm: info[c].nm, sch: info[c].sch, gr: info[c].gr,
          pts: a.pts, n: a.n, ok: a.ok,
          rate: a.n ? Math.round((a.ok / a.n) * 100) : 0,
          hard: a.hard,
          days: Object.keys(a.byDay).filter((d) => (a.byDay[d] || 0) > 0).length,
          up: days.length < 10 ? null
            : (f ? Math.max(-100, Math.min(300, Math.round(((l - f) / f) * 100))) : (l ? 300 : 0)),
          spark: days.slice(-14).map((d) => a.byDay[d] || 0),        // 최근 14일 막대
        };
      })
      .sort((a, b) => b.pts - a.pts || b.n - a.n);
    rows.forEach((r, i) => {
      r.rank = i + 1;
      Object.assign(r, tierOf(r.pts, tiers));
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

  ['elem', 'mid', 'high'].forEach((band) => {
    if (!leagues[band]) return;
    const rows = buildBand(band);
    board[band] = rows;
    if (band === 'elem') return;               // 체험 리그는 여기까지
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

  await kvSet('race_board', board);
  await kvSet('race_watch', watch);

  const BN = { elem: '초등부(체험)', mid: '중등부', high: '고등부' };
  const brief = ['elem', 'mid', 'high'].filter((b) => board[b]).map((b) =>
    `${BN[b]} ${board[b].length}명 · 1위 ${board[b][0] ? board[b][0].pts + '점' : '-'}`).join(' / ');
  log(`완료: ${brief}${board.ended ? ` · 시즌 종료 ${board.endedDays}일째` : ''}${watch.items.length ? ` · 확인필요 ${watch.items.length}명` : ''}`);
  return board;
}

module.exports = { runRace, ptOf, tierOf, DEF_TIERS };

if (require.main === module) {
  runRace().catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
