const W = require('./wrongtwin_make.js'); const fs = require('fs');
// 사용: node sync/essay_final_apply.js <교재번호> <폴더(list.json·all.json)>  — 서술형 정답 그림에서 읽은 최종 답을 정답사전에 넣는다 (2026-11-01)
// all.json = { wpId: {kind:'single'|'multi'|'none', final} } (채팅 하위 에이전트가 그림을 읽어 만든 것). 원본은 폴더에 backup_*.json 으로 남긴다.
const BID = process.argv[2], DIR = process.argv[3], all = JSON.parse(fs.readFileSync(DIR + '/all.json'));
const L = JSON.parse(fs.readFileSync(DIR + '/list.json')); const num = {}; L.forEach((x) => { num[x.wpId] = x.num; });
// (쎈 중1하 192번은 책 용어대로 «모서리DH» 로 손봤다 — 교재마다 이런 손질은 all.json 에서)
(async () => {
  const r = await W.q('lumen_store?select=value&key=eq.mf_bookans_' + BID); let v = r[0].value; if (typeof v === 'string') v = JSON.parse(v);
  fs.writeFileSync(DIR + '/backup_mf_bookans_' + BID + '.json', JSON.stringify(v));
  const over = {}; let n = 0;
  Object.values(v.pages || {}).forEach((pg) => (pg.problems || []).forEach((p) => {
    const o = all[p.wpId]; if (!o || o.kind === 'none' || !o.final) return;
    over[p.wpId] = o.final;
    if (!p.essayFinal) { p.origType = p.type; p.origAnswer = p.answer; }
    p.type = 'SHORT_ANSWER'; p.answer = o.final; p.essayFinal = true; p.self = false; p.gradable = true; n++;
  }));
  v.updated = new Date().toISOString();
  await W.setItem('mf_bookans_' + BID, v);
  await W.setItem('mf_essayfinal_' + BID, { book: BID, at: new Date().toISOString(), by: '채팅에서 정답 그림 읽기 (2026-11-01)', answers: over });
  console.log('바꾼 문항', n, '덮어쓰기 표', Object.keys(over).length);
})().catch((e) => console.error(e.message));
