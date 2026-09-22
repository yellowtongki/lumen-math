/* 🔥 추가 버프 검증 — docs/race_boost_contract.md §8
 * 실행: NODE_PATH=/home/user/lumen-math/node_modules node sync/verify_boost.js
 * 읽기 전용 — 서버에 아무것도 쓰지 않는다. */
const fs = require('fs');
const { buffMult } = require('./race_engine.js');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const K = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: K, authorization: 'Bearer ' + K };
const out = []; let bad = 0;
const ok = (n, c, x) => { if (!c) bad++; out.push((c ? '  ✅ ' : '  ❌ ') + n + (x !== undefined && x !== '' ? (' — ' + String(x).slice(0, 200)) : '')); };

async function kv(k) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${k}&select=value`, { headers: H });
  const j = await r.json(); let v = j[0] ? j[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
async function all(p) {
  const o = []; let f = 0;
  for (;;) {
    const r = await fetch(`${SB}/rest/v1/${p}`, { headers: { ...H, range: `${f}-${f + 999}` } });
    const j = await r.json(); o.push(...j);
    if (j.length < 1000) break; f += 1000; if (f > 60000) break;
  }
  return o;
}
const LV = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4 };
const ptOf = (lv, r) => (LV[Number(lv)] || 2) * (r === 'O' ? 2 : 1);
const dayOf = (iso) => String(iso || '').slice(0, 10);
const planDay = (k) => { const m = String(k || '').match(/^\s*(20\d\d)[.\-/](\d{1,2})[.\-/](\d{1,2})/); return m ? m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0') : null; };

(async () => {
  /* ── A. 배율 계산기 — 엔진과 학원앱이 같은 값을 내는가 ── */
  const appSrc = fs.readFileSync('/home/user/lumen-math/lumen_v19-29.html', 'utf8');
  const m = appSrc.match(/function rcBuffMult\(planScore, max, day, boost\)\{[\s\S]*?\n\}/);
  ok('학원앱에 새 rcBuffMult 가 있다', !!m);
  let rcBuffMult = null;
  if (m) { rcBuffMult = new Function('return (' + m[0].replace('function rcBuffMult', 'function') + ')')(); }

  const BZ = { on: true, from: '2026-09-22', flat: 1.3, max: 1.0 };
  const grid = [];
  [0, 1, 5, 7, 10, 12].forEach((p) => ['2026-09-01', '2026-09-21', '2026-09-22', '2026-09-30'].forEach((d) => {
    [null, BZ, { on: false, from: '2026-09-22', flat: 1.3, max: 1.0 }].forEach((b) => grid.push([p, 0.4, d, b]));
  }));
  let diff = 0, sample = '';
  grid.forEach((g) => {
    const a = buffMult(g[0], g[1], g[2], g[3]);
    const b = rcBuffMult ? rcBuffMult(g[0], g[1], g[2], g[3]) : NaN;
    if (Math.abs(a - b) > 1e-12) { diff++; if (!sample) sample = JSON.stringify(g) + ` 엔진 ${a} ≠ 앱 ${b}`; }
  });
  ok(`엔진과 학원앱 계산기가 ${grid.length}가지 경우에서 모두 같다`, diff === 0, sample);

  /* 규칙 자체가 맞는지 */
  ok('시작일 전날(9/21)은 옛 규칙 그대로 ×1.40', Math.abs(buffMult(10, 0.4, '2026-09-21', BZ) - 1.4) < 1e-12);
  ok('시작일(9/22) 플래너 0점이면 ×1.30', Math.abs(buffMult(0, 0.4, '2026-09-22', BZ) - 1.3) < 1e-12);
  ok('시작일(9/22) 플래너 10점이면 ×2.60', Math.abs(buffMult(10, 0.4, '2026-09-22', BZ) - 2.6) < 1e-12);
  ok('boost.on 이 거짓이면 옛 규칙만', Math.abs(buffMult(10, 0.4, '2026-09-22', { on: false, from: '2026-09-22', flat: 1.3, max: 1 }) - 1.4) < 1e-12);

  /* ── B. 실자료 — 시작일 이전 피해가 1점도 안 바뀌는가 (가장 중요) ── */
  const season = await kv('race_season');
  const bz = (season.buff || {}).boost;
  ok('서버 시즌에 추가 버프가 켜져 있다', !!(bz && bz.on), JSON.stringify(bz));
  const from = String((bz && bz.from) || '2026-09-22');
  const baseMax = Number((season.buff || {}).max) || 0.4;

  let arr = await kv('or_studentdb'); if (!Array.isArray(arr)) arr = [];
  const byName = {}, dup = {}, info = {};
  arr.forEach((s) => {
    if (!s || !s.name || s.lumen_rec_code == null || s.withdrawn) return;
    const nm = String(s.name).trim();
    if (byName[nm]) dup[nm] = true; else byName[nm] = String(s.lumen_rec_code);
    const g = String(s.grade || ''); const band = /고등/.test(g) ? 'high' : (/중학/.test(g) ? 'mid' : 'elem');
    const num = (g.match(/(\d)\s*학년/) || [])[1] || '';
    info[String(s.lumen_rec_code)] = { gr: (band === 'high' ? '고' : band === 'mid' ? '중' : '초') + num,
      sch: String(s.school || '').replace(/(중|고등)학교$/, '$1').replace(/초등학교$/, '초') };
  });
  const sid = {};
  (await all('mf_students?select=mf_student_id,name')).forEach((x) => {
    const nm = String(x.name || '').trim(); if (nm && !dup[nm] && byName[nm]) sid[x.mf_student_id] = byName[nm];
  });
  const plan = {};
  (await all('lumen_store?key=like.student_planner_*&select=key,value')).forEach((row) => {
    const code = String(row.key).replace('student_planner_', '');
    let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    const sc = (v && v.scores) || {}; const mm = {};
    Object.keys(sc).forEach((k) => { const d = planDay(k); if (!d) return; const n = Number(sc[k]); if (!isNaN(n)) mm[d] = Math.max(mm[d] || 0, n); });
    if (Object.keys(mm).length) plan[code] = mm;
  });
  const recs = await all(`mf_answer_records?score_datetime=gte.${season.from}T00:00:00&score_datetime=lt.2026-10-01T00:00:00&select=mf_student_id,level,result,score_datetime`);

  const BZ2 = { on: true, from, flat: Number(bz.flat) || 1.3, max: Number(bz.max) || 1.0 };
  let pastOff = 0, pastOn = 0, futOff = 0, futOn = 0, nPast = 0, nFut = 0;
  recs.forEach((r) => {
    if (r.result !== 'O' && r.result !== 'X' && r.result !== '?') return;
    const code = sid[r.mf_student_id]; if (!code || !info[code]) return;
    const d = dayOf(r.score_datetime);
    const raw = ptOf(r.level, r.result);
    const p = (plan[code] || {})[d];
    const a = raw * buffMult(p, baseMax, d, null);
    const b = raw * buffMult(p, baseMax, d, BZ2);
    if (d < from) { pastOff += a; pastOn += b; nPast++; } else { futOff += a; futOn += b; nFut++; }
  });
  ok(`시작일 이전 ${nPast.toLocaleString()}건의 점수가 켜기 전과 <b>완전히 같다</b>`,
    Math.abs(pastOff - pastOn) < 1e-6, `켜기전 ${Math.round(pastOff)} · 켠뒤 ${Math.round(pastOn)}`);
  ok(`시작일 이후는 늘어난다 (${nFut.toLocaleString()}건)`,
    nFut === 0 || futOn > futOff, `켜기전 ${Math.round(futOff)} → 켠뒤 ${Math.round(futOn)}`);
  if (nFut === 0) out.push('  ℹ️ 시작일 이후 채점 기록이 아직 없습니다 (오늘 새벽이면 정상)');

  /* ── C. 순위표가 boost 를 실어 보내는가 ── */
  const board = await kv('race_board');
  const bb = board && board.buff && board.buff.boost;
  ok('race_board.buff.boost 가 앱으로 나간다', !!bb, JSON.stringify(bb));
  if (bb) {
    ok('  · 시작일이 맞다', String(bb.from) === from, bb.from);
    ok('  · 남은 날(dday)이 들어 있다', typeof bb.dday === 'number', bb.dday);
  }

  /* ── D. 학생앱 — 띠가 계산을 하지 않고 읽기만 하는가 ── */
  const stu = fs.readFileSync('/home/user/lumen-math/student_v2-101.html', 'utf8');
  ok('학생앱에 버프 띠가 있다', stu.indexOf('function bzRender') > 0);
  ok('띠 자리가 홈에 있다', stu.indexOf('id="bz-banner"') > 0);
  ok('띠는 race_board 의 boost 를 읽기만 한다 (자체 계산 없음)',
    stu.indexOf('BF.boost = (b&&b.buff&&b.buff.boost&&b.buff.boost.on)') > 0 && !/function bz[A-Za-z]*Mult/.test(stu));
  ok('버프가 꺼져 있으면 아무것도 안 그린다', /if\(!bz\)\{ el\.innerHTML=''; return; \}/.test(stu));
  ok('학생앱 판이 v2-101 이다', /var STU_VER = 'v2-101';/.test(stu));
  ok('학원앱 판이 v19-29 이다', /var APP_VER = 'v19-29';/.test(appSrc));

  /* ── E. 밤 9시 알림 ── */
  const pb = fs.readFileSync('/home/user/lumen-math/sync/push_boost.js', 'utf8');
  ok('알림이 9시가 아니면 바로 끝난다(서버 부담)', /now\.getUTCHours\(\) !== HOUR\) return;/.test(pb));
  ok('하루 한 번만 보낸다', /state\.day === day\) return;/.test(pb));
  ok('버프가 꺼지면 저절로 멈춘다', /if \(!bz \|\| !bz\.on\)/.test(pb));
  ok('워커에 연결돼 있다', fs.readFileSync('/home/user/lumen-math/sync/collect_request_worker.js', 'utf8').indexOf("require('./push_boost.js')") > 0);

  console.log(out.join('\n'));
  console.log(bad ? `\n❌ ${bad}개 실패` : `\n✅ ${out.filter((x) => x.indexOf('✅') >= 0).length}개 모두 통과`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
