#!/usr/bin/env node
/* 교재 은행 색인(mf_bookbank_index) 다시 만들기 — mf_textbook_<id> 키 전부를 훑어 제목·종류·쪽·문항 수를 적는다.
 * (2026-09-24: 색인이 생기기 전에 받아 둔 교과서 8권을 색인에 넣기 위해) 쓰는 법: node sync/mf_bookbank_reindex.js */
const SB=(process.env.SUPABASE_URL||'').replace(/\/$/,''), K=process.env.SUPABASE_SERVICE_KEY; if(!SB||!K){ console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
const H={ apikey:K, authorization:`Bearer ${K}`, 'content-type':'application/json' };
(async()=>{
  const keys=await (await fetch(`${SB}/rest/v1/lumen_store?select=key&key=like.mf_textbook_%25`,{headers:H})).json();
  const idx={};
  for(const k of keys){ const r=await (await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(k.key)}&select=value`,{headers:H})).json(); const v=r[0]&&r[0].value; if(!v) continue;
    idx[String(v.bid||k.key.replace('mf_textbook_',''))]={ title:v.title||'', type:v.type||(/교과서_/.test(v.title||'')?'SCHOOL':''), pages:(v.pages||[]).length, problems:(v.problems||[]).length, updated:v.updated||null }; }
  const w=await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`,{method:'POST',headers:{...H,prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{key:'mf_bookbank_index',value:idx,updated_at:new Date().toISOString()}])});
  console.log(w.ok?`색인 ${Object.keys(idx).length}권 저장`:`저장 실패 ${w.status}`);
})();
