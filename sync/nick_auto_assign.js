#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🏷 자동 별명 — 별명이 없는 재원생에게 낱말 조합 별명을 하나씩 붙인다
 * ═══════════════════════════════════════════════════════════════════
 * 원장 결정 2026-10-05: 「1번 자동 별명으로 진행」 — 학생앱 순위표가 ○○○ 로 가득 차지 않게.
 *   · 학생앱 「별명 고르기」와 같은 낱말(lumen_store nick_words, 없으면 기본 목록)에서 꾸밈말+낱말을 뽑는다
 *   · 재원생끼리 겹치지 않게 · 띄어쓰기 빼고 8자 이하 · 학생 이름(성 뺀 이름 포함)이 들어가지 않게
 *   · 저장: nick_<코드> = { nick, at, by:'auto' }
 *     by:'auto' 는 학생이 고른 것이 아니므로 학생앱에서 언제든 바로 바꿀 수 있다(「한 달에 한 번」에 안 들어감)
 *   · 이미 별명이 있는 학생(학생이 고름·원장님이 넣음)은 건드리지 않는다
 *
 * 쓰는 법: node sync/nick_auto_assign.js [--dry]
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY
 * 로그: 인원수만 (이름·별명은 남기지 않는다 — 공개 저장소의 Actions 로그 대비)
 * ═══════════════════════════════════════════════════════════════════ */
const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;
const DRY = process.argv.includes('--dry');
if (!SB || !SK) { console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
const H = { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' };

/* 학원앱 nick_teacher.js · 학생앱 nick123.js 와 같은 기본 목록 */
const WORDS_DEF = {
  adj: ['번개','조용한','날쌘','반짝','씩씩한','똑똑한','느긋한','용감한','재빠른','신나는','커다란','작은','황금','은빛','푸른','붉은','초록','보라','하얀','검은','달리는','웃는','꿈꾸는','튼튼한','포근한','비밀','우주','바람','구름','별빛','새벽','한낮','겨울','여름','수수께끼','무적'],
  noun: ['소수','삼각형','원주율','파이','제곱','루트','분수','약수','배수','인수','함수','무한','영점','직각','정수','벡터','미지수','상수','공식','좌표','도형','극한','행렬','집합','확률','등식','변수','여우','사자','고래','펭귄','수달','토끼','호랑이','독수리','돌고래','치타','올빼미','판다','늑대','다람쥐','거북이','코알라','햄스터','고슴도치'],
};

async function kv(key) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: H });
  const j = await r.json(); let v = j && j[0] ? j[0].value : null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
const norm = (s) => String(s || '').replace(/\s/g, '').toLowerCase();

(async () => {
  let db = await kv('or_studentdb'); if (db && !Array.isArray(db)) db = db.students || Object.values(db);
  const act = (db || []).filter((s) => s && !s.withdrawn && s.lumen_rec_code);
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.nick_%25&select=key,value`, { headers: H });
  const nicks = {};
  (await r.json()).forEach((x) => { if (/^nick_[A-Za-z0-9]{6}$/.test(x.key) && x.value && x.value.nick) nicks[x.key.slice(5)] = String(x.value.nick).trim(); });
  const used = new Set(Object.values(nicks).map(norm));
  act.forEach((s) => { if (s.nick) used.add(norm(s.nick)); });
  const w = (await kv('nick_words')) || WORDS_DEF;
  const adj = (w.adj && w.adj.length ? w.adj : WORDS_DEF.adj), noun = (w.noun && w.noun.length ? w.noun : WORDS_DEF.noun);
  const missing = act.filter((s) => !nicks[String(s.lumen_rec_code)] && !String(s.nick || '').trim());
  let made = 0;
  for (const s of missing) {
    const nm = String(s.name || '').trim(), given = nm.length >= 3 ? nm.slice(1) : '';
    let pick = '';
    for (let t = 0; t < 500 && !pick; t++) {
      const a = adj[Math.floor(Math.random() * adj.length)], b = noun[Math.floor(Math.random() * noun.length)];
      const cand = a + ' ' + b, k = norm(cand);
      if ((a + b).length > 8 || used.has(k)) continue;
      if (nm && (k.indexOf(norm(nm)) >= 0 || (given && k.indexOf(norm(given)) >= 0))) continue;
      pick = cand;
    }
    if (!pick) continue;
    used.add(norm(pick));
    const val = { nick: pick, at: new Date().toISOString(), by: 'auto' };
    if (!DRY) {
      const wr = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ key: 'nick_' + s.lumen_rec_code, value: val, updated_at: val.at }]) });
      if (!wr.ok) { console.error('저장 실패', wr.status); continue; }
    }
    made++;
  }
  console.log(`재원생 ${act.length}명 · 이미 별명 ${act.length - missing.length}명 · 자동 별명 ${made}명${DRY ? ' (시험 — 저장 안 함)' : ''}`);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
