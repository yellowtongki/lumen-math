#!/usr/bin/env node
/* 📅 운영 달력 계획(lumen_store ops_plan) 넣기 — 학원앱 v19-158 이 읽는다 (docs/opscal_contract.md)
 *   사용: SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node sync/ops_plan_seed.js <ops_plan.json> [--dry]
 *   ops_plan.json 은 학관노 도구 백업 + 연간 마케팅 시트로 채팅에서 만든다(학원 숫자가 있으니 저장소에 올리지 않는다).
 *   체크 기록(ops_checks)은 건드리지 않는다. */
const fs = require('fs');
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY;
const file = process.argv[2], dry = process.argv.includes('--dry');
if (!file) { console.error('사용: node sync/ops_plan_seed.js <ops_plan.json> [--dry]'); process.exit(1); }
const P = JSON.parse(fs.readFileSync(file, 'utf8'));
const need = ['themes', 'keywords', 'events', 'regular', 'mkt', 'manuals', 'ranks'];
const miss = need.filter((k) => !(k in P));
if (miss.length) { console.error('빠진 칸: ' + miss.join(', ')); process.exit(1); }
console.log('행사 ' + P.events.length + ' · D-업무 ' + P.events.reduce((s, e) => s + (e.d || []).length, 0) + ' · 매뉴얼 ' + P.manuals.length + ' · 정기 ' + P.regular.length + ' · 세금 ' + (P.tax || []).length + ' · 채널 ' + P.mkt.channels.join('·'));
if (dry) { console.log('(--dry: 서버에 쓰지 않음)'); process.exit(0); }
if (!U || !K) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 없습니다'); process.exit(1); }
(async () => {
  const r = await fetch(U + '/rest/v1/lumen_store?on_conflict=key', { method: 'POST',
    headers: { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key: 'ops_plan', value: P, updated_at: new Date().toISOString() }]) });
  console.log(r.ok ? '✅ ops_plan 저장' : ('❌ ' + r.status + ' ' + await r.text()));
  process.exit(r.ok ? 0 : 1);
})();
