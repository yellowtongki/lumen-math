#!/usr/bin/env node
/* 📖 기출 해설집 업로더 — 해설집.html → Supabase lumen_store
 *
 * 배경: 학원앱의 「기출 해설집」 화면은 lumen_store에서 목록을 읽는다.
 *   여기에 미리 올려 두면 원장님이 파일을 고르지 않아도 앱에 자동으로 뜬다.
 *   (앱의 「＋ 해설집 불러오기」는 그대로 남겨 둔 수동 경로)
 *
 * 저장 형태 — 학원앱 hsParse()와 반드시 같아야 한다:
 *   lumen_haesol_catalog        = { items:[ {code,title,school,grade,term,subject,n,qs[],addedAt} ], updated }
 *   haesol_body_<시험코드>       = { head, cover, tail, items:{ "1":"<section…>", … } }
 *
 * 사용법:
 *   node sync/haesol_upload.js                 # docs/exam_reports 아래 해설집 전부
 *   node sync/haesol_upload.js okgil_m2_2025_2mid   # 특정 시험코드만
 *   node sync/haesol_upload.js --dry            # 올리지 않고 확인만
 *
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (저장소에 키를 넣지 않는다)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'exam_reports');
const URL = process.env.SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_KEY;
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const ONLY = args.filter(a => !a.startsWith('--'));

const log = m => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

/* ── 학원앱 hsPlain()과 같은 규칙 ── */
function plain(s){
  if(!s) return '';
  s = String(s).replace(/<[^>]*>/g,' ');
  s = s.replace(/\\\(|\\\)|\\\[|\\\]/g,' ').replace(/\$\$/g,' ');
  s = s.replace(/\\overline\{([^}]*)\}/g,'$1').replace(/\\mathrm\{([^}]*)\}/g,'$1')
       .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g,'$1/$2').replace(/\\sqrt\{([^}]*)\}/g,'√$1')
       .replace(/\\angle/g,'∠').replace(/\\triangle/g,'△').replace(/\\times/g,'×')
       .replace(/\\backsim/g,'∽').replace(/\\equiv/g,'≡').replace(/\\parallel/g,'∥')
       .replace(/\\perp/g,'⊥').replace(/\\circ/g,'°').replace(/\\lt/g,'<').replace(/\\gt/g,'>')
       .replace(/\\[a-zA-Z]+/g,' ').replace(/[\\${}]/g,' ');
  s = s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
  return s.replace(/\s+/g,' ').trim();
}

/* ── 학원앱 hsParse()와 같은 규칙 ── */
function parse(html){
  const metaOf = n => (html.match(new RegExp(`<meta name="haesol-${n}" content="([^"]*)"`)) || [])[1] || '';
  const wrapAt = html.indexOf('<div class="wrap">');
  if (wrapAt < 0) throw new Error('해설집 형식이 아닙니다 (표지를 찾지 못했습니다)');

  const re = /<section class="sol([^"]*)" id="q(\d+)">([\s\S]*?)<\/section>/g;
  const items = {}, qs = [];
  let m, firstAt = -1, lastEnd = -1;
  while ((m = re.exec(html)) !== null) {
    if (firstAt < 0) firstAt = m.index;
    lastEnd = m.index + m[0].length;
    const no = Number(m[2]), inner = m[3];
    items[no] = m[0];
    const t = (inner.match(/<div class="sol-title">([\s\S]*?)<\/div>/) || [])[1] || '';
    const k = (inner.match(/<div class="sol-kind">([\s\S]*?)<\/div>/) || [])[1] || '';
    const vals = inner.match(/<span class="val">([\s\S]*?)<\/span>/g) || [];
    let ans = '';
    if (vals.length) { const c = plain(vals[vals.length-1]).match(/[①②③④⑤]/g); ans = c ? c[c.length-1] : '서술'; }
    const badge = (k.match(/<span class="dbadge[^"]*">([\s\S]*?)<\/span>/) || [])[1] || '';
    const bp = plain(badge);
    qs.push({ no, title: plain(t), kind: plain(k.replace(/<span class="dbadge[\s\S]*?<\/span>/,'')),
              badge: bp, ans,
              killer: /killer/.test(m[1]) && /킬러|최고난도/.test(bp),
              warn: /오류|부족|미비/.test(bp) });
  }
  if (!qs.length) throw new Error('문항을 하나도 찾지 못했습니다');
  qs.sort((a,b) => a.no - b.no);

  let code = metaOf('code');
  if (!code) throw new Error('meta name="haesol-code" 가 없습니다 — parts/head.html에 식별 정보를 심어 주세요');
  return {
    meta: { code, title: metaOf('title'), school: metaOf('school'), grade: metaOf('grade'),
            term: metaOf('term'), subject: metaOf('subject'), n: qs.length, qs,
            addedAt: new Date().toISOString() },
    body: { head: html.slice(0, wrapAt), cover: html.slice(wrapAt, firstAt),
            tail: html.slice(lastEnd), items }
  };
}

/* ── Supabase ── */
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' };
async function sbGet(key){
  const r = await fetch(`${URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H });
  if (!r.ok) throw new Error(`읽기 실패 ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.length ? j[0].value : null;
}
async function sbPut(key, value){
  const r = await fetch(`${URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`쓰기 실패 ${r.status} ${await r.text()}`);
}

(async () => {
  if (!DRY && (!URL || !KEY)) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다');

  const dirs = fs.readdirSync(DIR)
    .filter(d => fs.existsSync(path.join(DIR, d, '해설집.html')))
    .filter(d => !ONLY.length || ONLY.includes(d));
  if (!dirs.length) throw new Error('올릴 해설집을 찾지 못했습니다');

  const parsed = [];
  for (const d of dirs) {
    const html = fs.readFileSync(path.join(DIR, d, '해설집.html'), 'utf8');
    try {
      const P = parse(html);
      const kb = Math.round(JSON.stringify(P.body).length / 1024);
      log(`✔ ${d} → ${P.meta.code} · ${P.meta.n}문항 · 본문 ${kb}KB`);
      parsed.push(P);
    } catch (e) { log(`⚠️ ${d} 건너뜀 — ${e.message}`); }
  }
  if (!parsed.length) throw new Error('파싱된 해설집이 없습니다');
  if (DRY) { log('--dry 이므로 올리지 않고 끝냅니다'); return; }

  // 본문 먼저 (목록에 뜨는데 본문이 없는 상태를 만들지 않기 위해)
  for (const P of parsed) { await sbPut('haesol_body_' + P.meta.code, P.body); log(`  본문 저장: haesol_body_${P.meta.code}`); }

  // 목록은 기존 것과 병합 (다른 데서 올린 해설집을 지우지 않는다)
  let cat = await sbGet('lumen_haesol_catalog');
  if (typeof cat === 'string') { try { cat = JSON.parse(cat); } catch (e) { cat = null; } }
  cat = cat && Array.isArray(cat.items) ? cat : { items: [] };
  for (const P of parsed) {
    const old = cat.items.find(x => x.code === P.meta.code);
    if (old && old.addedAt) P.meta.addedAt = old.addedAt;   // 최초 등록일은 지킨다
    cat.items = cat.items.filter(x => x.code !== P.meta.code);
    cat.items.push(P.meta);
  }
  cat.updated = new Date().toISOString();
  await sbPut('lumen_haesol_catalog', cat);
  log(`목록 저장: lumen_haesol_catalog (총 ${cat.items.length}권)`);
  log('완료 — 학원앱 「기출 해설집」 화면에 자동으로 뜹니다');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
