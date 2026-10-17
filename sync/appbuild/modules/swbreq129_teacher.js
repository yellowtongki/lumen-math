/* ═════════════════════════════════════════════════════════════════
 * v19-129: 📗 교재 목록 새로고침 — 학생앱 숙제 화면의 «교재 목록»만 빨리 맞추기
 *   (원장 2026-10-17: 중1 학생들에게 매쓰플랫에서 새 교재를 배정했는데 학생앱에 안 보였다)
 *
 *  왜 따로 있나: 학생앱 숙제 화면은 lumen_store 'mf_swb_<학생코드>' (학생별 교재·쪽 목록)를 읽는데, 이 목록은 «전체 수집»(하루 3번 · 약 25분)이
 *  다시 쓸 때만 바뀌었다. 지금은 울트라일일의 빨간 「🔄 지금 가져오기」 옆 「📗 교재 목록 새로고침」으로 교재 목록만 1~2분에 받는다.
 *
 *  동작: 단추 → 작은 선택 창(전체 / 학년 / 반) → lumen_store 'mf_swb_req' 에 쪽지를 남긴다
 *     { status:'requested', codes:['학생코드',…] (빈 배열 = 전체), reqAt, by:'teacher' }
 *   → GitHub 서버 워커(sync/collect_request_worker.js, 5분마다)가 수집기 --swb-only 로 처리 → running → done { ok, note, finishedAt }.
 *   앱은 15초마다 상태를 확인해 단추에 보여 준다 (대기 → 갱신 중 → 완료/실패 + 메모).
 *   GitHub 토큰(설정)이 있으면 쪽지를 남기는 순간 서버를 깨운다 (HTS_WAKE_KEYS 에 mf_swb_req 추가 — supaSetItem 감싸기가 처리).
 *  문서 docs/swb_refresh.md · 검사 sync/appbuild/tests/test_v19129.js
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 다른 동작은 바꾸지 않는다 — udFetchBtn 뒤에 단추 하나를 덧붙일 뿐.
 * ═════════════════════════════════════════════════════════════════ */
var SWB = { req:null, loaded:false, open:false, sel:'all', poll:null, busy:false };
var SWB_KEY = 'mf_swb_req';
var SWB_STALE_MIN = 30;   /* 이만큼 지나도 requested/running 이면 서버가 놓친 것 — 다시 요청할 수 있게 푼다 */
try{ if(typeof HTS_WAKE_KEYS!=='undefined') HTS_WAKE_KEYS[SWB_KEY]=1; }catch(e){}

function swbShortGrade(g){
  g=String(g||'');
  return g.replace(/초등학교\s*(\d)\s*학년/,'초$1').replace(/중학교\s*(\d)\s*학년/,'중$1').replace(/고등학교\s*(\d)\s*학년/,'고$1');
}
/* 코드가 연결된 재원생 [{code, grade, group}] */
function swbStudents(){
  var list=[];
  try{ list=(typeof getSortedStudents==='function')?getSortedStudents():[]; }catch(e){ list=[]; }
  if(!list||!list.length){ try{ list=JSON.parse(localStorage.getItem('or_studentdb')||'[]').filter(function(s){ return !s.withdrawn; }); }catch(e){ list=[]; } }
  return (list||[]).filter(function(s){ return s && s.lumen_rec_code; }).map(function(s){
    return { code:String(s.lumen_rec_code), grade:String(s.grade||''), group:String(s.group||'') };
  });
}
/* 선택 키: 'all' · 'g:<학년>' · 'c:<반>' → 학생코드 배열 (전체는 빈 배열 = 서버가 전체 학생) */
function swbCodesFor(sel){
  var st=swbStudents();
  if(!sel||sel==='all') return [];
  var kind=sel.charAt(0), v=sel.slice(2);
  return st.filter(function(s){ return kind==='g'?s.grade===v:s.group===v; }).map(function(s){ return s.code; });
}
function swbHHMM(iso){
  try{ var d=new Date(iso); if(isNaN(d.getTime())) return ''; return ('0'+d.getHours()).slice(-2)+':'+('0'+d.getMinutes()).slice(-2); }catch(e){ return ''; }
}
function swbState(){
  var q=SWB.req;
  if(!q||!q.status) return { k:'idle' };
  var t=Date.parse(q.startedAt||q.reqAt||'')||0, mins=t?(Date.now()-t)/60000:0;
  if(q.status==='requested') return mins>SWB_STALE_MIN?{ k:'idle', q:q, stale:true}:{ k:'wait', q:q };
  if(q.status==='running') return mins>SWB_STALE_MIN?{ k:'idle', q:q, stale:true}:{ k:'run', q:q };
  if(q.status==='done'){
    var fin=Date.parse(q.finishedAt||q.reqAt||'')||0;
    return { k:(q.ok===false?'fail':'done'), q:q, recent:(Date.now()-fin)/60000<60 };
  }
  return { k:'idle', q:q };
}

/* ── 서버 상태 읽기 · 15초마다 확인 ── */
function swbLoad(){
  if(SWB.loaded) return;
  SWB.loaded=true;
  swbFetch().then(function(){ try{ if(VIEW==='ultra') render(); }catch(e){} });
}
function swbFetch(){
  try{
    var sb=getSupaClient(); if(!sb) return Promise.resolve();
    return Promise.resolve(sb.from('lumen_store').select('value').eq('key',SWB_KEY)).then(function(r){
      var v=(r&&r.data&&r.data[0])?r.data[0].value:null;
      if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
      SWB.req=v||null;
    },function(){});
  }catch(e){ return Promise.resolve(); }
}
function swbPoll(){
  if(SWB.poll) return;
  SWB.poll=setInterval(function(){
    var was=swbState().k;
    swbFetch().then(function(){
      var s=swbState();
      if(s.k!=='wait'&&s.k!=='run'){
        clearInterval(SWB.poll); SWB.poll=null;
        if(s.q&&(was==='wait'||was==='run')){
          if(s.k==='done') plToast('📗 '+(s.q.note||'교재 목록 갱신 완료'));
          else if(s.k==='fail') plToast('⚠ '+(s.q.note||'교재 목록 갱신 실패'));
        }
      }
      try{ if(VIEW==='ultra') render(); }catch(e){}
    });
  }, 15000);
}

/* ── 단추 (울트라일일 「지금 가져오기」 바로 뒤) ── */
function swbBtn(){
  swbLoad();
  var s=swbState();
  if(s.k==='wait'||s.k==='run') swbPoll();
  var base='border:none;font-family:inherit;font-size:12px;font-weight:900;padding:10px 14px;border-radius:12px;cursor:pointer;';
  var small='font-size:10px;font-weight:800;opacity:.85';
  var txt, sub, bg;
  if(s.k==='wait'){ txt='⏳ 교재 목록 대기 중'; sub='요청 '+swbHHMM(s.q.reqAt)+' · 곧 시작'; bg='#475569'; }
  else if(s.k==='run'){ txt='📗 교재 목록 갱신 중…'; sub=s.q.note||'잠시만요'; bg='#475569'; }
  else if(s.k==='done'&&s.recent){ txt='✅ 교재 목록 완료'; sub=swbHHMM(s.q.finishedAt)+' · 다시 하려면 클릭'; bg='#047857'; }
  else if(s.k==='fail'&&s.recent){ txt='⚠ 교재 목록 실패'; sub='다시 하려면 클릭'; bg='#b91c1c'; }
  else { txt='📗 교재 목록 새로고침'; sub='새 교재가 안 보일 때'; bg='#047857'; }
  var h='<button id="swb-btn" onclick="swbOpen()" title="학생앱 숙제 화면의 교재 목록만 매쓰플랫에서 새로 받습니다 (전체 수집보다 훨씬 빠름)" style="'+base+'background:'+bg+';color:#fff;box-shadow:0 3px 10px rgba(4,120,87,.28)">'+txt+' <span style="'+small+'">'+esc2(sub)+'</span></button>';
  if(SWB.open) h+=swbPanel(s);
  return h;
}
function swbChip(key, label, n){
  var on=(SWB.sel===key);
  return '<span onclick="swbPick(\''+key.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+'\')" style="cursor:pointer;font-size:12px;font-weight:800;border-radius:50px;padding:5px 12px;margin:0 5px 6px 0;display:inline-block;'
    +(on?'background:#047857;color:#fff;border:1.5px solid #047857':'background:#f1f5f9;color:#334155;border:1.5px solid #e2e8f0')+'">'+esc2(label)+' <span style="opacity:.75;font-weight:700">'+n+'</span></span>';
}
function swbPanel(s){
  var st=swbStudents(), grades=[], groups=[], gc={}, cc={};
  st.forEach(function(x){
    if(x.grade){ if(!gc[x.grade]){ gc[x.grade]=0; grades.push(x.grade); } gc[x.grade]++; }
    if(x.group){ if(!cc[x.group]){ cc[x.group]=0; groups.push(x.group); } cc[x.group]++; }
  });
  grades.sort(); groups.sort();
  var busy=(s.k==='wait'||s.k==='run');
  var n=(SWB.sel==='all')?st.length:swbCodesFor(SWB.sel).length;
  var h='<div onclick="if(event.target===this)swbClose()" style="position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px">'
    +'<div style="background:#fff;border-radius:16px;max-width:420px;width:100%;max-height:86vh;overflow:auto;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.25)">'
    +'<div style="display:flex;align-items:center;margin-bottom:6px"><b style="font-size:15px;color:#0d2240">📗 교재 목록 새로고침</b>'
    +'<span onclick="swbClose()" style="margin-left:auto;cursor:pointer;font-size:18px;color:#94a3b8;padding:0 4px">✕</span></div>'
    +'<div style="font-size:12px;line-height:1.6;color:#475569;margin-bottom:10px">매쓰플랫에서 새 교재를 배정했는데 <b>학생앱 숙제 화면에 안 보일 때</b> 누릅니다. 고른 학생의 <b>교재 목록만</b> 새로 받아요 (전체 수집은 약 25분, 이건 1~2분 + 서버가 5분마다 확인).</div>';
  if(busy||(s.k!=='idle'&&s.q&&s.q.note)){
    var col=(s.k==='fail')?'#b91c1c':(s.k==='done'?'#047857':'#475569');
    var lab=(s.k==='wait')?'대기 중 — 서버가 곧 시작합니다':(s.k==='run'?('갱신 중 — '+(s.q.note||'잠시만요')):(s.q.note||''));
    h+='<div style="font-size:12px;font-weight:800;color:'+col+';background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:10px">'+esc2(lab)+(s.q.finishedAt?(' · '+swbHHMM(s.q.finishedAt)):'')+'</div>';
  } else if(s.stale){
    h+='<div style="font-size:12px;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin-bottom:10px">지난 요청이 끝나지 않은 채 멈춘 것 같아요 — 다시 요청할 수 있어요.</div>';
  }
  if(!busy){
    h+='<div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:5px">누구의 교재 목록을 받을까요?</div><div>'
      +swbChip('all','전체 학생',st.length);
    grades.forEach(function(g){ h+=swbChip('g:'+g, swbShortGrade(g), gc[g]); });
    h+='</div>';
    if(groups.length){
      h+='<div style="font-size:11px;font-weight:800;color:#64748b;margin:4px 0 5px">반으로 고르기</div><div>';
      groups.forEach(function(g){ h+=swbChip('c:'+g, g, cc[g]); });
      h+='</div>';
    }
    h+='<div style="font-size:12px;font-weight:800;color:#0d2240;margin:6px 0 10px">'
      +(SWB.sel==='all'?'전체 학생 ':'선택한 ')+'<span style="color:#047857">'+n+'명</span>의 교재 목록을 새로 받습니다'+(n?'':' <span style="color:#b91c1c">(학생앱 코드가 연결된 학생이 없어요)</span>')+'</div>'
      +'<button onclick="swbSend()" '+((SWB.busy||(SWB.sel!=='all'&&!n))?'disabled ':'')+'style="width:100%;border:none;font-family:inherit;font-size:14px;font-weight:900;padding:12px;border-radius:12px;cursor:pointer;background:#047857;color:#fff;'+((SWB.busy||(SWB.sel!=='all'&&!n))?'opacity:.5;cursor:default':'')+'">📗 새로고침 요청하기</button>';
  }
  h+='</div></div>';
  return h;
}

window.swbOpen=function(){ SWB.open=true; try{ render(); }catch(e){} };
window.swbClose=function(){ SWB.open=false; try{ render(); }catch(e){} };
window.swbPick=function(k){ SWB.sel=k; try{ render(); }catch(e){} };
window.swbSend=async function(){
  if(SWB.busy) return;
  var s=swbState(); if(s.k==='wait'||s.k==='run'){ plToast('이미 진행 중입니다'); return; }
  var codes=swbCodesFor(SWB.sel);
  if(SWB.sel!=='all'&&!codes.length){ plToast('받을 학생이 없습니다'); return; }
  var req={ status:'requested', codes:codes, reqAt:new Date().toISOString(), by:'teacher' };
  SWB.busy=true;
  var ok=false;
  try{ ok=await supaSetItem(SWB_KEY, req); }catch(e){ ok=false; }
  SWB.busy=false;
  if(!ok){ plToast('요청 저장 실패 — 네트워크를 확인해 주세요'); return; }
  SWB.req=req; SWB.open=false; swbPoll();
  try{ render(); }catch(e){}
  plToast('📗 요청했습니다 — 서버가 5분 안에 시작해 1~2분이면 끝납니다');
};

/* 울트라일일 「🔄 지금 가져오기」 단추 바로 뒤에 덧붙인다 (그 단추는 그대로) */
if(typeof udFetchBtn==='function') udFetchBtn=(function(o){ return function(){ return o.apply(this, arguments)+swbBtn(); }; })(udFetchBtn);
