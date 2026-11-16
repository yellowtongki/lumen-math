#!/usr/bin/env node
/* 🔥 연속 기록 랭킹판 — 전체 학생의 플래너·녹음 연속을 계산해 lumen_store 'streak_board' 에 둔다
 *   (원장 2026-11-16 「연속 학습이 많은 상위 5명 · 전체 학생 랭킹」 → 학생앱 v2-164 «🔥 연속 기록» TOP 5)
 *   학생앱은 다른 학생의 사진·녹음 목록을 직접 볼 수 없으므로 서버가 매일 새벽 계산해 둔다(planner-night.yml).
 *   이름은 별명(nick_<코드>)만 · 없으면 «○○○» — 학생 실명은 넣지 않는다.
 *   streak_board = { at, recFrom, list:[{c:코드, n:별명, g:'중2', pl, plB, rc, rcB}] }
 *   실행: node sync/streak_board.js [--dry]   환경변수 SUPABASE_URL · SUPABASE_SERVICE_KEY
 */
const STK = require('./streak_core.js');
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), KEY = process.env.SUPABASE_SERVICE_KEY || '';
const H = { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json' };
const DRY = process.argv.includes('--dry');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function store(keys) {
  const out = {};
  for (let i = 0; i < keys.length; i += 40) {
    const part = keys.slice(i, i + 40);
    const r = await fetch(`${SB}/rest/v1/lumen_store?select=key,value&key=in.(${part.map(encodeURIComponent).join(',')})`, { headers: H });
    if (!r.ok) throw new Error('lumen_store 읽기 ' + r.status);
    (await r.json()).forEach((x) => { let v = x.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } out[x.key] = v; });
  }
  return out;
}
async function listPhotos(code) {
  const names = []; let off = 0;
  while (off < 5000) {
    const r = await fetch(`${SB}/storage/v1/object/list/photos`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: code + '/', limit: 1000, offset: off, sortBy: { column: 'name', order: 'asc' } }) });
    if (!r.ok) break;
    const j = await r.json(); if (!Array.isArray(j) || !j.length) break;
    j.forEach((f) => { if (f && f.name) names.push(f.name); });
    if (j.length < 1000) break; off += 1000;
  }
  return names;
}
const gShort = (g) => { const m = String(g || '').match(/(초|중|고)[^0-9]*(\d)/); return m ? m[1] + m[2] : ''; };
(async () => {
  if (!SB || !KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  const db = (await store(['or_studentdb'])).or_studentdb;
  const L = (Array.isArray(db) ? db : ((db && db.students) || Object.values(db || {}))).filter((s) => s && s.lumen_rec_code && !s.withdrawn && s.name);
  const codes = L.map((s) => String(s.lumen_rec_code));
  const kv = await store(codes.map((c) => 'submissions_' + c).concat(codes.map((c) => 'nick_' + c)));
  const list = [];
  for (const s of L) {
    const c = String(s.lumen_rec_code);
    const names = await listPhotos(c); await sleep(150);
    const pl = STK.streak(STK.plannerDays(names), STK.everyDay);
    const sub = kv['submissions_' + c]; const rc = STK.streak(STK.recDays(Array.isArray(sub) ? sub : []), STK.recDue(STK.classDays(s.group)));
    const nk = kv['nick_' + c]; const nick = (nk && nk.nick) ? String(nk.nick) : '○○○';
    list.push({ c, n: nick, g: gShort(s.grade), pl: pl.cur, plB: pl.best, rc: rc.cur, rcB: rc.best });
  }
  list.sort((a, b) => (b.pl - a.pl) || (b.rc - a.rc));
  const board = { at: new Date().toISOString(), recFrom: STK.REC_DAILY_FROM, list };
  const top = (k) => list.slice().sort((a, b) => b[k] - a[k]).slice(0, 5).map((x) => x.n + ' ' + x[k]).join(' · ');
  console.log(`학생 ${list.length}명 · 플래너 TOP5: ${top('pl')} · 녹음 TOP5: ${top('rc')}`);
  if (DRY) { console.log('(설계만 — 저장 안 함)'); return; }
  const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: 'streak_board', value: board }]) });
  console.log(r.ok ? '✅ streak_board 저장' : '❌ 저장 실패 ' + r.status);
  if (!r.ok) process.exit(1);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
