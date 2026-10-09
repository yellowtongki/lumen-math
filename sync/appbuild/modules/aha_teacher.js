/* ═══════════════════════════════════════════════════════════════
 * v19-51: 📋 채점 작업대 날짜 고르기 + 💡 힌트 읽음·「아직 모르겠어요」 표시 + 힌트 발송 즉시 푸시
 *   (원장 지시 2026-09-27 「이 범위 초안 작성에서 날짜를 선택할 수 있게 · 힌트 도착을 학생이 알 수 있게」)
 *   · A 부터~까지: 머리띠 날짜 두 칸 (WB.range='custom', WB.from/WB.to) — wbNotes 가 이 범위로 거른다
 *   · B 왼쪽 날짜: 📅 날짜 모드에서 날짜를 누르면 초안 단추가 「9/25 AI 초안 (n건)」으로 그 날만 (✕ 날짜 해제)
 *   · 카드·줄 배지: 힌트를 보낸 노트에 「👀 읽음 / 💡 아직 안 봄 / 📵 알림 안 켬」, 학생이 「아직 모르겠어요」를 누르면 🙋
 *     (학생앱 v2-109 가 aha_hint_seen_<코드> = {seen:{노트id:시각}, help:{노트id:시각}} 에 적는다)
 *   · 모아 보기에 「🙋 아직 모르겠어요」 묶음
 *   · 힌트 발송(hntSend·hntReuseSend) 뒤 push_hint_queue 에 요청을 남긴다 → 5분 워커(sync/push_hint.js)가 학생 폰으로
 * 규칙: docs/aha_hint_contract.md
 * ═══════════════════════════════════════════════════════════════ */
var AHS={ seen:{}, at:0, loading:false, queue:null, subs:null };
function ahsSb(){ return (typeof getSupaClient==='function')?getSupaClient():window.sb; }

/* ── A. 부터~까지 ── */
window.wbSetFrom=function(v){ WB.from=String(v||''); if(!WB.to||WB.to<WB.from) WB.to=WB.from; WB.range='custom'; WB.grp=''; WB.sel=''; render(); };
window.wbSetTo=function(v){ WB.to=String(v||''); if(!WB.from||WB.from>WB.to) WB.from=WB.to; WB.range='custom'; WB.grp=''; WB.sel=''; render(); };
function wbDateHtml(){
  var on=(WB.range==='custom');
  var f=WB.from||wbYesterday(), t=WB.to||wbToday();
  var inp=function(id,v,fn){ return '<input type="date" id="'+id+'" value="'+ahaEsc(v)+'" onchange="'+fn+'(this.value)" style="font-family:inherit;font-size:12px;font-weight:800;border:none;border-radius:5px;padding:3px 6px;background:#fff;color:#0d2240;width:128px">'; };
  return '<div title="부터~까지 날짜를 고르면 그 범위의 노트만 보이고, AI 초안 단추 숫자도 따라갑니다" style="display:flex;align-items:center;gap:5px;border-radius:8px;padding:3px 8px;font-size:12px;font-weight:800;'
    +(on?'background:#fff;color:#0d2240;border:1px solid #fff':'background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3)')+'">📅 '
    +inp('wb-from',f,'wbSetFrom')+' ~ '+inp('wb-to',t,'wbSetTo')+'</div>';
}
/* ── B. 왼쪽 날짜 하나 ── 고른 날짜(YYYY-MM-DD) 또는 '' */
function wbDayPicked(){
  if(WB.mode!=='day'||!/^d_\d{4}-\d{2}-\d{2}$/.test(WB.grp||'')) return '';
  var d=WB.grp.slice(2), ok=false, arr=wbNotes();
  for(var i=0;i<arr.length;i++){ if(iblDay(arr[i].created_at)===d){ ok=true; break; } }
  return ok?d:'';
}
window.wbClearDay=function(){ WB.grp=''; WB.sel=''; render(); };
function wbDayClearBtn(){
  return '<div onclick="wbClearDay()" title="날짜 고르기를 풀고 범위 전체로" style="cursor:pointer;border-radius:8px;padding:6px 11px;font-size:12px;font-weight:800;background:rgba(255,255,255,.28);color:#fff;border:1px solid rgba(255,255,255,.4)">✕ 날짜 해제</div>';
}
function wbRangeKo(){
  var d=wbDayPicked(); if(d) return wbDayShort(d)+' 하루';
  if(WB.range==='custom') return wbDayShort(WB.from||'')+'~'+wbDayShort(WB.to||'');
  return WB.range==='y'?'어제':(WB.range==='all'?'전체':'최근 7일');
}
/* 초안 대상: 날짜를 골랐으면 그 날만, 아니면 지금 범위 */
function wbDraftPool(){ return wbDayPicked()?wbCurList():wbNotes(); }

/* ── 읽음 기록 읽기 (aha_hint_seen_<코드>) — 2분에 한 번 ── */
window.ahsLoad=async function(force){
  if(AHS.loading) return; if(!force&&Date.now()-AHS.at<120000) return; AHS.loading=true;
  try{
    var sb=ahsSb(); if(!sb) throw new Error('no supabase');
    var r=await sb.from('lumen_store').select('key,value').like('key','aha_hint_seen_%');
    var seen={};
    ((r&&r.data)||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } if(v) seen[String(row.key).replace('aha_hint_seen_','')]={ seen:v.seen||{}, help:v.help||{} }; });
    var q=await sb.from('lumen_store').select('value').eq('key','push_hint_queue');
    var qv=(q&&q.data&&q.data[0]&&q.data[0].value)||null; if(typeof qv==='string'){ try{ qv=JSON.parse(qv); }catch(e){ qv=null; } }
    AHS.seen=seen; AHS.queue=(qv&&Array.isArray(qv.list))?qv.list:[]; AHS.at=Date.now();
    if(typeof HNT!=='undefined' && HNT.hints===null && !HNT.loading){ try{ hntLoad(); }catch(e){} }
    if(VIEW==='aha') render();
  }catch(e){ console.warn('[힌트 읽음] 로드 실패', e); AHS.at=Date.now(); }
  AHS.loading=false;
};
function ahsRec(n){ return (n && typeof HNT!=='undefined' && HNT.hints && HNT.hints.byId && HNT.hints.byId[String(n.id)])||null; }
function ahsSeenOf(n){ var s=AHS.seen[String(n.student_code||'')]; return !!(s && s.seen && s.seen[String(n.id)]); }
function ahsHelp(n){ var s=AHS.seen[String(n.student_code||'')]; return !!(s && s.help && s.help[String(n.id)]) && ahaIsPending(n); }
function ahsQueueOf(id){ var q=AHS.queue||[]; for(var i=q.length-1;i>=0;i--){ if(String(q[i].id)===String(id)) return q[i]; } return null; }
/* 줄·카드에 붙는 배지 */
function ahsBadge(n){
  var rec=ahsRec(n); if(!rec || rec.status!=='sent') return '';
  var h='';
  if(ahsSeenOf(n)) h+='<span title="학생이 학생앱에서 힌트를 열어 봤습니다" style="font-weight:800;background:#dcfce7;color:#166534;border:1px solid #86efac;border-radius:5px;padding:0 5px">👀 읽음</span>';
  else {
    var q=ahsQueueOf(n.id);
    h+='<span title="힌트를 보냈지만 학생이 아직 열어 보지 않았습니다" style="font-weight:800;background:#ede9fe;color:#6d28d9;border:1px solid #ddd6fe;border-radius:5px;padding:0 5px">💡 아직 안 봄</span>';
    if(q && q.status==='nosub') h+='<span title="이 학생은 학생앱에서 「🔔 알림 켜기」를 아직 안 했습니다 — 앱을 열어야 힌트를 봅니다" style="font-weight:800;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:5px;padding:0 5px">📵 알림 안 켬</span>';
    else if(q && q.status==='pending') h+='<span title="5분 안에 학생 폰으로 알림이 갑니다" style="font-weight:800;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:5px;padding:0 5px">📲 알림 예약</span>';
  }
  if(ahsHelp(n)) h+='<span title="학생이 힌트를 보고도 「💬 아직 모르겠어요」를 눌렀습니다 — 수업 때 봐 주세요" style="font-weight:800;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:5px;padding:0 5px">🙋 아직 모르겠어요</span>';
  return h;
}

/* ── 힌트 발송 → 즉시 푸시 요청 (push_hint_queue) ── */
window.ahsQueuePush=async function(n){
  if(!n || !n.student_code) return;
  var sb=ahsSb(); if(!sb) return;
  try{
    var r=await sb.from('lumen_store').select('value').eq('key','push_hint_queue');
    var v=(r&&r.data&&r.data[0]&&r.data[0].value)||null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    var list=(v&&Array.isArray(v.list))?v.list:[];
    var dup=false; list.forEach(function(x){ if(String(x.id)===String(n.id) && x.status==='pending') dup=true; });
    if(!dup) list.push({ id:String(n.id), code:String(n.student_code), src:ahaCopyText(n), at:new Date().toISOString(), status:'pending' });
    if(list.length>300) list=list.slice(-300);
    var w=await sb.from('lumen_store').upsert({ key:'push_hint_queue', value:{ list:list, upd:new Date().toISOString() }, updated_at:new Date().toISOString() },{ onConflict:'key' });
    if(w&&w.error) throw w.error;
    AHS.queue=list;
    /* 이 학생이 폰 알림을 켰는지 — 켰으면 「5분 안에」, 아니면 「앱을 열어야 본다」 */
    var on=await ahsStudentHasSub(n.student_code);
    ahaToast(on?'📲 학생 폰 알림은 5분 안에 갑니다':'📵 이 학생은 아직 폰 알림을 안 켰어요 — 앱을 열면 보입니다');
  }catch(e){ console.warn('[힌트 푸시 요청] 실패', e); }
};
/* 발송 취소 → 아직 안 나간 요청은 지운다 */
window.ahsQueueCancel=async function(id){
  var sb=ahsSb(); if(!sb) return;
  try{
    var r=await sb.from('lumen_store').select('value').eq('key','push_hint_queue');
    var v=(r&&r.data&&r.data[0]&&r.data[0].value)||null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    var list=(v&&Array.isArray(v.list))?v.list:[];
    var keep=list.filter(function(x){ return !(String(x.id)===String(id) && x.status==='pending'); });
    if(keep.length===list.length) return;
    await sb.from('lumen_store').upsert({ key:'push_hint_queue', value:{ list:keep, upd:new Date().toISOString() }, updated_at:new Date().toISOString() },{ onConflict:'key' });
    AHS.queue=keep;
  }catch(e){}
};
async function ahsStudentHasSub(code){
  try{
    if(!AHS.subs || Date.now()-(AHS.subsAt||0)>300000){
      var sb=ahsSb(); var r=await sb.from('lumen_store').select('value').eq('key','push_subs');
      var v=(r&&r.data&&r.data[0]&&r.data[0].value)||{}; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v={}; } }
      AHS.subs=v||{}; AHS.subsAt=Date.now();
    }
    var ids=Object.keys(AHS.subs||{});
    for(var i=0;i<ids.length;i++){ var s=AHS.subs[ids[i]]; if(s && s.role!=='owner' && String(s.code||'')===String(code)) return true; }
  }catch(e){}
  return false;
}

/* ── v19-53: 「7일·전체·부터~까지」를 고르면 가운데 목록에 그 범위 «전체»가 날짜별로 보인다 (원장 지적 2026-09-28)
 *   전에는 왼쪽 날짜 중 첫 「대기」 날 하나만 자동으로 골라 보여 줘서, 7일을 눌러도 하루치만 보였다.
 *   이제 날짜 모드에서 날짜를 «누르지 않았으면» 범위 전체를 보여 주고, 날짜를 누르면 그 날만(v19-51 B) — 「🗂 이 범위 전체」로 되돌린다. */
function wbRangeBucket(all){
  var list=[], pend=0;
  (all||[]).forEach(function(b){ if(b && !b.special) list=list.concat(b.list||[]); });
  list.forEach(function(n){ if(!ibqIsFinal(n.id)) pend++; });
  return { key:'', label:'🗂 이 범위 전체', chip:'🗂 전체', sub:'', list:list, pend:pend, done:list.length-pend };
}
/* 머리띠 날짜 칸에 «실제로 보고 있는 범위»를 보여 준다 (7일이면 오늘부터 6일 전까지) */
function wbEffRange(){
  if(WB.range==='custom') return [WB.from||wbYesterday(), WB.to||wbToday()];
  if(WB.range==='y'){ var y=wbYesterday(); return [y,y]; }
  if(WB.range==='all'){ var mn=wbToday(); (ahaNotes||[]).forEach(function(n){ var d=iblDay(n.created_at); if(d&&d<mn) mn=d; }); return [mn, wbToday()]; }
  return [iblDay(new Date(Date.now()-6*864e5).toISOString()), wbToday()];
}
