#!/usr/bin/env node
/**
 * 옛 ✗ 기록 다시 채점 — 새 채점 엔진이 ◯ 로 읽는 것만 ◯ 로 바꾼다
 * ════════════════════════════════════════════════════════════════
 * 원장 지시 2026-10-09: 「옛 기록도 다시 채점해서 ◯로 바꿔줘」 (분수 입력·엔진 보강 v2-132 와 한 벌)
 *
 * 무엇을 하나
 *   lumen_store 의 hw_scores_<학생코드> 안 항목 가운데 r:'X' 이고 자기채점(self)이 아닌 것을
 *   정답 대장(mf_bookans_*, mf_wsq_<코드>)과 다시 맞춰 보고, 새 엔진(sync/hw_grade_engine.js)이
 *   ◯ 라고 하면 r:'O' 로 바꾼다. 바꾼 항목엔 regraded:'<날짜>', r0:'X' 를 남긴다(되돌릴 수 있게).
 *   ◯ → ✗ 로는 절대 바꾸지 않는다(원장 지시 범위 밖).
 *   매쓰플랫에도 고친 결과가 가도록 hw_sync_<코드> 대기열에 같은 항목을 result:'O' 로 덧붙인다
 *   (기존 되돌려쓰기 워커 sync/hw_sync_flush.js 가 보낸다). --no-mf 를 주면 대기열엔 안 넣는다.
 *
 * 실행
 *   node sync/regrade_hw_scores.js --dry      # 무엇이 바뀔지 세어만 본다 (서버에 쓰지 않음)
 *   node sync/regrade_hw_scores.js            # 실제로 바꾼다
 *   (SUPABASE_URL · SUPABASE_SERVICE_KEY 환경변수 필요. 학생 이름은 읽지 않는다 — 코드만)
 *
 * ⚠️ 학생이 앱을 켜 둔 채 채점하면 그 기기의 옛 기록이 다시 올라와 되돌아갈 수 있다.
 *   학생이 없는 시간(새벽·오전)에 돌린다. 되돌아간 항목은 다시 돌리면 또 고쳐진다(멱등).
 */
const HW = require('./hw_grade_engine.js');
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const DRY = process.argv.includes('--dry');
const NO_MF = process.argv.includes('--no-mf');
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const TODAY = new Date().toISOString().slice(0, 10);

async function q(path) {
  const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${await r.text()}`);
  return r.json();
}
async function getVal(key) {
  const rows = await q(`lumen_store?select=value&key=eq.${encodeURIComponent(key)}`);
  let v = rows[0] && rows[0].value;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v || null;
}
async function upsert(key, value) {
  const r = await fetch(`${SB}/rest/v1/lumen_store`, {
    method: 'POST', headers: Object.assign({ prefer: 'resolution=merge-duplicates' }, H),
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error(`upsert ${key} → ${r.status} ${await r.text()}`);
}
function gradeOf(ans, a) {
  try { const g = HW.grade(ans, a); return g.gradable ? (g.correct ? 'O' : 'X') : '?'; } catch (e) { return '?'; }
}

(async () => {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  // 교재 정답 (wpId → 문항)
  const byWp = {};
  for (const r of await q('lumen_store?select=key&key=like.mf_bookans_*')) {
    const v = await getVal(r.key); const pages = (v && v.pages) || {};
    for (const pid in pages) for (const p of (pages[pid].problems || [])) byWp[String(p.wpId)] = p;
  }
  console.log('교재 문항', Object.keys(byWp).length);
  const codes = (await q('lumen_store?select=key&key=like.hw_scores_*')).map((r) => r.key.slice('hw_scores_'.length));
  let tot = 0, cand = 0, flipped = 0, stillX = 0, unread = 0, noAns = 0;
  const examples = [];
  for (const code of codes) {
    const sv = await getVal('hw_scores_' + code); const items = (sv && sv.items) || {};
    const wsq = await getVal('mf_wsq_' + code); const wmap = {};
    for (const w of ((wsq && wsq.list) || [])) for (const p of (w.problems || [])) wmap['ws_' + w.swId + '_' + p.wpId] = p;
    const changed = [];
    for (const k in items) {
      const it = items[k]; tot++;
      if (!it || it.r !== 'X' || it.self) continue;
      if (it.a == null || String(it.a).trim() === '') continue;
      const p = (it.kind === 'ws') ? wmap[k] : byWp[k.split('_')[1]];
      if (!p || !p.answer) { noAns++; continue; }
      cand++;
      const g = gradeOf(String(p.answer), String(it.a));
      if (g === 'O') {
        it.r0 = 'X'; it.r = 'O'; it.regraded = TODAY; flipped++; changed.push(k);
        if (examples.length < 40) examples.push(`${code.slice(0, 2)}** ${JSON.stringify(it.a)} ← ${JSON.stringify(p.answer)}`);
      } else if (g === 'X') stillX++; else unread++;
    }
    if (changed.length && !DRY) {
      await upsert('hw_scores_' + code, { items, updated: new Date().toISOString(), regraded: TODAY });
      if (!NO_MF) {
        const sq = (await getVal('hw_sync_' + code)) || {}; const qu = sq.items || [];
        for (const k of changed) {
          const it = items[k];
          if (it.kind === 'ws') qu.push({ id: Date.now() + '_rg_' + k, kind: 'ws', swId: it.swId, wpId: Number(k.split('_')[2]), result: 'O', userAnswer: it.a, at: new Date().toISOString(), regraded: TODAY });
          else qu.push({ id: Date.now() + '_rg_' + k, pid: it.pid, wpId: Number(k.split('_')[1]), result: 'O', userAnswer: it.a, at: new Date().toISOString(), regraded: TODAY });
        }
        await upsert('hw_sync_' + code, { items: qu, updated: new Date().toISOString() });
      }
      console.log(`  ${code.slice(0, 2)}**: ${changed.length}건 ◯ 로 (매쓰플랫 대기열 ${NO_MF ? '제외' : '추가'})`);
    }
  }
  console.log(`\n${DRY ? '[미리 보기]' : '[완료]'} 학생 ${codes.length}명 · 기록 ${tot}건 · 다시 본 ✗ ${cand}건 → ◯ 로 바뀜 ${flipped}건 · 그대로 ✗ ${stillX}건 · 못 읽음 ${unread}건 · 정답 못 찾음 ${noAns}건`);
  examples.forEach((e) => console.log('   ', e));
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
