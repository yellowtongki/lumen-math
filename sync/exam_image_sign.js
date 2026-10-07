#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🖼 기출 문항 그림 주소 서명 — ms_exams_<학교> 의 문항마다 imgUrl(1년짜리 서명 주소)을 넣는다
 * ═══════════════════════════════════════════════════════════════════
 * 왜: exam_images 버킷은 비공개다. 학원앱은 공개 열쇠(publishable key)로 서명 주소를 만들려 했지만
 *     저장소 규칙이 없어 「object does not exist or you do not have access」 가 나왔고, 인쇄물에 그림이 안 나왔다
 *     (2026-09-25 원장 제보 「시험대비 학생별 프린트에서 문제가 안보이는 문제」).
 *     서버 규칙(SQL)을 바꾸지 않고, 수집기(서비스 열쇠)가 서명 주소를 미리 만들어 문항에 넣어 두는 쪽을 택했다.
 *     주소는 1년 뒤 만료되는데, 주 1회 새벽 수집이 매번 새로 서명하므로 늘 살아 있다.
 * 쓰는 법: node sync/exam_image_sign.js [--schools 옥길중,범박고] [--days 365]
 * ═══════════════════════════════════════════════════════════════════ */
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), K = process.env.SUPABASE_SERVICE_KEY;
if (!SB || !K) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
const argv = process.argv.slice(2); const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DAYS = Number(val('--days', 365)) || 365; const ONLY = String(val('--schools', '')).split(',').map((s) => s.trim()).filter(Boolean);
const H = { apikey: K, authorization: `Bearer ${K}`, 'content-type': 'application/json' };
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

async function signPaths(paths) {
  const out = {};
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const r = await fetch(`${SB}/storage/v1/object/sign/exam_images`, { method: 'POST', headers: H, body: JSON.stringify({ expiresIn: DAYS * 86400, paths: chunk }) });
    if (!r.ok) { log(`  서명 실패 ${r.status}`); continue; }
    (await r.json()).forEach((x) => { if (x && x.signedURL && !x.error) out[x.path] = `${SB}/storage/v1${x.signedURL}`; });
  }
  return out;
}
async function signSchool(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H });
  const row = (await r.json())[0]; let v = row && row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } }
  if (!v || !v.exams) { log(`${key}: 자료 없음`); return; }
  const paths = []; v.exams.forEach((e) => (e.cells || []).forEach((c) => { if (c.img && !/^https?:/.test(c.img)) paths.push(c.img); }));
  const signed = await signPaths(paths);
  let n = 0; v.exams.forEach((e) => (e.cells || []).forEach((c) => { if (c.img && signed[c.img]) { c.imgUrl = signed[c.img]; n++; } }));
  v.imgSigned = { at: new Date().toISOString(), days: DAYS, n };
  const w = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key, value: v, updated_at: new Date().toISOString() }]) });
  log(`${key}: 문항 그림 ${paths.length}개 중 ${n}개 서명 (${DAYS}일) → 저장 ${w.ok ? 'OK' : w.status}`);
}
module.exports = { signSchool };
if (require.main === module) (async () => {
  const keys = await (await fetch(`${SB}/rest/v1/lumen_store?select=key&key=like.ms_exams_%25`, { headers: H })).json();
  for (const k of keys) { const school = k.key.replace('ms_exams_', ''); if (ONLY.length && ONLY.indexOf(school) < 0) continue; await signSchool(k.key); }
  log('끝');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
