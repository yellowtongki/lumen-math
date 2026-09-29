/**
 * 매쓰플랫 풀이 그림 «깨진 수식» 바로잡기 — 결과를 lumen_store 'mf_sol_fix' 에 올린다 (원장 지적 2026-09-29)
 *
 * 매쓰플랫 풀이 그림(solution.png) 가운데 일부는 수식이 망가져 있다(₩frac · egin{aligned} · ight · o0 …).
 * 매쓰플랫은 풀이를 그림으로만 주므로, 그림을 한 장씩 보고 망가진 것은 풀이를 그대로 옮겨 올바른 수식으로 다시 쓴다.
 *   - 입력 ① 검사 결과 폴더: <dir>/w*\/out.jsonl  (한 줄 = {simg, status:'ok'|'fixed', text?, note?})
 *   - 입력 ② 빨간 오류 글씨 자동 검사: <dir>/scan_all.json  ({simg: {red, rows, h}}) — red>200 이면 깨진 그림
 * 저장: mf_sol_fix = { fix:{ <simg>: {text, note, at} }, bad:{ <simg>:1 }, ok:{ <simg>:1 }, upd }
 *   - fix = 다시 쓴 풀이 → 학원앱 시험 대비 인쇄물이 그림 대신 이 글을 싣는다 (학원앱 v19-60 eaSolOf)
 *   - bad = 빨간 오류가 있는데 아직 다시 쓰지 않은 그림 → 인쇄물에서 빼고 정답만 싣는다
 *   - ok  = 사람이(=Claude가) 보고 정상이라 확인한 그림
 * 서버에 이미 있는 fix/ok 는 지우지 않고 합친다.
 *
 * 사용법: SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node sync/mf_solfix_upload.js <dir> [--dry]
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
const DRY = process.argv.includes('--dry');
const U = (process.env.SUPABASE_URL || '').replace(/\/$/, ''), K = process.env.SUPABASE_SERVICE_KEY;
if (!dir || !U || !K) { console.error('사용법: SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node sync/mf_solfix_upload.js <dir> [--dry]'); process.exit(1); }
const H = { apikey: K, authorization: `Bearer ${K}`, 'content-type': 'application/json' };

function readRows() {
  const rows = [];
  for (const w of fs.readdirSync(dir).filter((d) => /^w\d+$/.test(d)).sort()) {
    const f = path.join(dir, w, 'out.jsonl'); if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch (e) { console.warn('JSON 오류 건너뜀:', f); }
    }
  }
  return rows;
}
function textOk(t) {
  t = String(t || '');
  if (t.length < 20) return false;
  if (/₩|\\begin|\\end\{|\\boxed/.test(t)) return false;
  if ((t.match(/\\\(/g) || []).length !== (t.match(/\\\)/g) || []).length) return false;
  if ((t.match(/\$\$/g) || []).length % 2) return false;
  return true;
}

(async () => {
  const r = await fetch(`${U}/rest/v1/lumen_store?select=value&key=eq.mf_sol_fix`, { headers: H });
  let cur = ((await r.json())[0] || {}).value || {}; if (typeof cur === 'string') cur = JSON.parse(cur);
  const out = { fix: cur.fix || {}, bad: {}, ok: cur.ok || {}, upd: new Date().toISOString() };
  let nFix = 0, nOk = 0, nSkip = 0;
  for (const x of readRows()) {
    if (!x || !x.simg) continue;
    if (x.status === 'fixed') { if (textOk(x.text)) { out.fix[x.simg] = { text: x.text, note: x.note || '', at: out.upd }; nFix++; } else nSkip++; }
    else if (x.status === 'ok') { out.ok[x.simg] = 1; nOk++; }
  }
  const scanF = path.join(dir, 'scan_all.json');
  if (fs.existsSync(scanF)) {
    const scan = JSON.parse(fs.readFileSync(scanF, 'utf8'));
    for (const [u, v] of Object.entries(scan)) if (v && v.red > 200 && !out.fix[u]) out.bad[u] = 1;
  }
  console.log(`다시 쓴 풀이 ${Object.keys(out.fix).length} (이번 ${nFix}, 형식 오류로 뺀 것 ${nSkip}) · 정상 확인 ${Object.keys(out.ok).length} · 아직 못 쓴 깨진 그림 ${Object.keys(out.bad).length}`);
  if (DRY) return;
  const w = await fetch(`${U}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'mf_sol_fix', value: out, updated_at: out.upd }) });
  console.log(w.ok ? '저장 완료' : ('저장 실패 ' + w.status));
})();
