#!/usr/bin/env node
/**
 * ✍️ 서술형 «최종 답» 넣기 (2026-11-01 원장 「B로 진행 — 서술형도 최종 답만 쳐서 자동채점」)
 *   매쓰플랫엔 교재 서술형 정답이 «그림»뿐이라 학생앱이 사진 자기채점으로 보냈다.
 *   그림을 채팅 하위 에이전트들이 읽어 최종 답을 적어 두고(out_*.json), 이 도구가 정답사전에 넣는다.
 *
 * 사용: node sync/essay_final_apply.js <폴더> [--dry]
 *   <폴더>/list.json  = [{bid, wpId, num, ...}]   (그림 목록 — 어느 교재의 어느 문항인지)
 *   <폴더>/out_*.json 또는 all.json = { wpId: {kind:'single'|'multi'|'none', final} }
 *   ※ 옛 사용법 `node sync/essay_final_apply.js <교재번호> <폴더>` 도 된다(list.json 에 bid 가 없을 때).
 * 하는 일(교재마다):
 *   ① 정답사전 원본을 <폴더>/backup_mf_bookans_<교재>.json 으로 남긴다(저장소엔 안 올림)
 *   ② 문항을 type 'SHORT_ANSWER' · answer <최종 답> · essayFinal:true (원래 값은 origType · origAnswer) 로
 *   ③ 덮어쓰기표 mf_essayfinal_<교재> 에 «합쳐서» 저장 — 수집기가 쪽을 새로 받아도 다시 넣는다(mathflat_collector)
 *   kind 'none'(표·작도·증명·문장)은 그대로 둔다 → 학생앱에서 사진 자기채점.
 *   엔진(hw_grade_engine)이 못 읽는 답이나 «원문 그대로 넣어도 ✗»인 답은 넣지 않고 알려 준다.
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY
 */
const fs = require('fs'), path = require('path');
const W = require('./wrongtwin_make.js'), E = require('./hw_grade_engine.js');
const argv = process.argv.slice(2), DRY = argv.includes('--dry'), pos = argv.filter((a) => !a.startsWith('--'));
const DIR = pos.length >= 2 ? pos[1] : pos[0], ONEBID = pos.length >= 2 ? pos[0] : '';
(async () => {
  const L = JSON.parse(fs.readFileSync(path.join(DIR, 'list.json')));
  let all = {};
  if (fs.existsSync(path.join(DIR, 'all.json'))) all = JSON.parse(fs.readFileSync(path.join(DIR, 'all.json')));
  fs.readdirSync(DIR).filter((f) => /^out_\d+\.json$/.test(f)).forEach((f) => { try { Object.assign(all, JSON.parse(fs.readFileSync(path.join(DIR, f)))); } catch (e) { console.log('⚠ 읽기 실패', f, e.message); } });
  const byBid = {}; L.forEach((x) => { const b = String(x.bid || ONEBID); (byBid[b] = byBid[b] || []).push(x); });
  const missing = L.filter((x) => !all[x.wpId]).length;
  if (missing) console.log('⚠ 결과가 없는 문항', missing, '— 그 문항은 그대로 둔다');
  let tot = 0;
  for (const bid of Object.keys(byBid)) {
    const r = await W.q('lumen_store?select=value&key=eq.mf_bookans_' + bid); if (!r[0]) { console.log('정답사전 없음', bid); continue; }
    let v = r[0].value; if (typeof v === 'string') v = JSON.parse(v);
    if (!DRY) fs.writeFileSync(path.join(DIR, 'backup_mf_bookans_' + bid + '.json'), JSON.stringify(v));
    const want = {}, bad = [];
    byBid[bid].forEach((x) => { const o = all[x.wpId]; if (!o || o.kind === 'none' || !String(o.final || '').trim()) return;
      const f = String(o.final).trim(); const sh = E.shapeOf({ type: 'SHORT_ANSWER', answer: f });
      if (!sh.gradable || !E.grade(f, f).correct) { bad.push(x.num + ' «' + f + '»'); return; }
      want[x.wpId] = f; });
    let n = 0;
    Object.values(v.pages || {}).forEach((pg) => (pg.problems || []).forEach((p) => { const f = want[p.wpId]; if (!f) return;
      if (!p.essayFinal) { p.origType = p.type; p.origAnswer = p.answer; }
      const sh = E.shapeOf({ type: 'SHORT_ANSWER', answer: f });
      p.type = 'SHORT_ANSWER'; p.answer = f; p.essayFinal = true; p.self = !!sh.self; p.gradable = !!sh.gradable; p.shape = sh.shape; n++; }));
    const o0 = await W.q('lumen_store?select=value&key=eq.mf_essayfinal_' + bid); let ov = o0[0] ? o0[0].value : null; if (typeof ov === 'string') ov = JSON.parse(ov);
    const answers = Object.assign({}, (ov && ov.answers) || {}, want);
    console.log(`${bid} ${(v.book || '').slice(0, 30)} — 그림 ${byBid[bid].length} · 넣음 ${n} · 그대로(사진) ${byBid[bid].length - n}` + (bad.length ? ` · 엔진이 못 읽어 뺌 ${bad.length}: ${bad.slice(0, 5).join(', ')}` : ''));
    tot += n;
    if (DRY || !n) continue;
    v.updated = new Date().toISOString();
    await W.setItem('mf_bookans_' + bid, v);
    await W.setItem('mf_essayfinal_' + bid, { book: bid, at: new Date().toISOString(), by: '채팅에서 정답 그림 읽기', answers });
  }
  console.log((DRY ? '(시험) ' : '') + '합계 넣은 문항', tot);
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
