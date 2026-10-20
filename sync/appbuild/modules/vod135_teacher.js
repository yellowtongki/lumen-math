/* ═════════════════════════════════════════════════════════════════
 * v19-135: 🎬 강의실 — 📦 묶음 배정 · 🗺 시청 지도 · 회차별 시청 기록
 *   (원장 2026-10-18 「학생이 동영상을 2번 이상 볼 수 있다. 그 부분의 기능이 없다.
 *    동영상을 체크하고 묶음을 학생들에게 배정하는 기능, 누가 얼마나 보고 있는지 시각적으로 한번에 들어오지 않는다.」
 *    「보기횟수는 지정이 아니고 학생이 영상 2번 이상 들을 수 있으니 그 날짜와 시간을 내가 확인하는 기능이다.
 *     내가 영상을 내준 날짜와 학생이 시청한 날짜시간 등을 쉽게 확인할 수 있는 관리화면을 원하는 것이다.」)
 *
 *  ① 📦 묶음 배정 — 강의 관리에서 영상 여러 개 체크 → 「📤 일괄 배정」 창에 «묶음 이름» 칸 → 「📦 묶음으로 내주기」.
 *     묶음 하나(이름·영상·학생·마감·내준 시각)를 기록하고, 학생앱이 읽는 배정(lumen_vod_assign)도 그대로 채운다.
 *  ② 내준 날짜 — 묶음으로 내줄 때뿐 아니라 영상 하나씩 체크해 배정할 때·폴더 일괄 배정 때도 «처음 내준 시각»을 남긴다
 *     (먼저 남은 날짜는 절대 덮지 않는다). v19-135 전에 배정한 것은 날짜가 없어 「기록 없음(v19-135 이전)」 —
 *     그런 영상을 묶음으로 다시 내줘도 «처음 내준 날»은 기록 없음 그대로, 다시 준 날은 상세 칸 «묶음» 줄에 보인다.
 *  ③ 🗺 시청 지도 — 모니터링 첫 탭. 줄 = 학생, 칸 = 영상. 칸 색 = 얼마나 봤나(진도 %), 칸 숫자 = 본 횟수(회차),
 *     빨간 테두리 = 마감 지났는데 아직 다 못 봄, ↻ = 두 번 이상 봄. 마우스를 올리면 내준 날짜·마감·마지막 시청.
 *  ④ 회차별 구간 막대 — 칸을 누르면 오른쪽(좁으면 아래)에 그 학생·그 영상의 «회차» 목록:
 *     시작 날짜·시각 → 본 길이 · 가장 멀리 간 지점 · 배속 · 화면 이탈, 그리고 그 회차에 본 구간 막대.
 *
 *  데이터
 *   - 시청 기록 vod_watch_logs: 학생앱이 «한 번 볼 때마다» 한 줄을 만들고 보는 동안 같은 줄을 고친다 → 1줄 = 1회차.
 *     20초(VOD_SHORT_SEC) 미만은 «잠깐 열어봄» — 목록에는 흐리게 보이지만 칸 숫자(회차)에는 세지 않는다.
 *     전송 실패 뒤 다시 보내다 같은 회차가 두 줄이 되면(같은 영상·학생·시작 시각) 많이 본 쪽 한 줄만 쓴다.
 *   - lumen_vod_bundles   = {bundles:[{id,name,folderId,vids:[영상id],codes:[학생코드],due:'YYYY-MM-DD',at:'ISO',by:'teacher'}]}
 *   - lumen_vod_assign_at = {영상id:{학생코드:'처음 내준 ISO 시각'}}
 *     둘 다 lumen_store 로 기기 ↔ 서버 동기화(SYNC_KEYS). 서버에서 받을 때 덮어쓰지 않고 합친다
 *     (묶음은 id 합집합 · 이 기기 것 우선 / 내준 날짜는 더 이른 쪽).
 *   - 학생앱이 읽는 lumen_vod_assign {영상id:{codes,due}} 모양은 그대로 둔다(새 칸을 넣지 않는다) → 학생앱 v2-139 그대로 동작.
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 원래 함수는 감싸기만 한다.
 * ═════════════════════════════════════════════════════════════════ */
var VOD_SHORT_SEC = 20;                       /* 이보다 짧게 본 회차 = «잠깐 열어봄» (회차 숫자에 안 셈) */
var VOD5_KEY_B = 'lumen_vod_bundles';
var VOD5_KEY_AT = 'lumen_vod_assign_at';
var VOD5 = { bundles:null, at:null, sel:'', open:null, bname:null };   /* sel '' = 폴더 전체 · 묶음 id */
var VOD5_WD = ['일','월','화','수','목','금','토'];
try{ if(typeof SYNC_KEYS!=='undefined'){ [VOD5_KEY_B, VOD5_KEY_AT].forEach(function(k){ if(SYNC_KEYS.indexOf(k)===-1) SYNC_KEYS.push(k); }); } }catch(e){}
try{ if(typeof VOD_MON_TAB!=='undefined') VOD_MON_TAB='map'; }catch(e){}   /* 모니터링 첫 화면 = 🗺 시청 지도 */

/* ── 날짜 글자 (브라우저 = 한국 시각) ── */
function vod5Two(n){ return (n<10?'0':'')+n; }
function vod5When(iso){
  if(!iso) return '';
  var d=new Date(iso); if(isNaN(d.getTime())) return '';
  return (d.getMonth()+1)+'/'+d.getDate()+' ('+VOD5_WD[d.getDay()]+') '+vod5Two(d.getHours())+':'+vod5Two(d.getMinutes());
}
function vod5Day(ymd){
  var m=String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})/); if(!m) return '';
  var d=new Date(+m[1], +m[2]-1, +m[3]);
  return (+m[2])+'/'+(+m[3])+' ('+VOD5_WD[d.getDay()]+')';
}
function vod5Today(){ var d=new Date(); return d.getFullYear()+'-'+vod5Two(d.getMonth()+1)+'-'+vod5Two(d.getDate()); }
function vod5Ms(iso){ var t=Date.parse(iso||''); return isNaN(t)?0:t; }

/* ── 저장: 묶음 · 내준 날짜 ── */
function vod5Read(k){ try{ var raw=localStorage.getItem(k); if(raw){ var o=JSON.parse(raw); if(o&&typeof o==='object') return o; } }catch(e){} return null; }
function vod5Write(k, o){ try{ localStorage.setItem(k, JSON.stringify(o)); }catch(e){ console.warn('[강의실 묶음] 저장 실패', e); } }
function vod5CleanBundle(b){
  if(!b||!b.id) return null;
  b.vids=Array.isArray(b.vids)?b.vids:[]; b.codes=Array.isArray(b.codes)?b.codes:[];
  b.name=String(b.name||'묶음'); b.due=String(b.due||''); b.at=String(b.at||'');
  return b;
}
function vod5Bundles(){
  if(VOD5.bundles===null){
    var o=vod5Read(VOD5_KEY_B);
    VOD5.bundles=((o&&Array.isArray(o.bundles))?o.bundles:[]).map(vod5CleanBundle).filter(Boolean);
  }
  return VOD5.bundles;
}
function vod5SaveBundles(){ vod5Write(VOD5_KEY_B, {bundles:vod5Bundles()}); }
function vod5BundlesSorted(){ return vod5Bundles().slice().sort(function(a,b){ return vod5Ms(b.at)-vod5Ms(a.at); }); }
function vod5BundleById(id){ var B=vod5Bundles(); for(var i=0;i<B.length;i++){ if(B[i].id===id) return B[i]; } return null; }
function vod5At(){ if(VOD5.at===null){ var o=vod5Read(VOD5_KEY_AT); VOD5.at=(o&&!Array.isArray(o))?o:{}; } return VOD5.at; }
function vod5SaveAt(){ vod5Write(VOD5_KEY_AT, vod5At()); }
/* 지금 «아직 배정 안 된» 쌍만 고른다 — 이미 배정돼 있던 것(v19-135 전, 날짜 모름)에 오늘 날짜를 붙이지 않으려고 */
function vod5NewPairs(vids, codes){
  var out=[];
  try{ vodEnsure(); }catch(e){}
  (vids||[]).forEach(function(vid){
    var a=(typeof VOD_ASSIGN!=='undefined'&&VOD_ASSIGN)?VOD_ASSIGN[vid]:null, cs=(a&&Array.isArray(a.codes))?a.codes:[];
    (codes||[]).forEach(function(c){ if(c && cs.indexOf(c)===-1) out.push([vid,c]); });
  });
  return out;
}
function vod5MarkPairs(pairs, iso){
  var A=vod5At(), ch=false; iso=iso||new Date().toISOString();
  (pairs||[]).forEach(function(p){ var vid=p[0], c=p[1]; if(!A[vid]||typeof A[vid]!=='object') A[vid]={}; if(!A[vid][c]){ A[vid][c]=iso; ch=true; } });
  if(ch) vod5SaveAt();
  return ch;
}
/* 이 학생에게 이 영상을 처음 내준 시각 (내준 날짜 기록 · 묶음 중 더 이른 것) — 없으면 '' */
/*   묶음 날짜로 메우지 않는다 — v19-135 전에 이미 준 영상을 묶음으로 다시 줘도 «처음 내준 날»로 보이지 않게.
 *   (묶음으로 다시 준 날짜는 상세 칸 «묶음» 줄에 따로 보인다) */
function vod5GivenAt(vid, code){
  var a=vod5At()[vid];
  return (a&&a[code])||'';
}
function vod5BundlesOf(vid, code){
  return vod5BundlesSorted().filter(function(b){ return b.vids.indexOf(vid)!==-1 && b.codes.indexOf(code)!==-1; });
}

/* ── 서버에서 받을 때 합치기 (덮어쓰기 금지) ── */
function vod5ParseVal(v){ if(v==null) return null; if(typeof v==='string'){ try{ return JSON.parse(v); }catch(e){ return null; } } return v; }
function vod5MergeBundlesObj(loc, cloud){
  var map={}, order=[], extra=false, cloudIds={};
  ((cloud&&cloud.bundles)||[]).forEach(function(b){ if(b&&b.id){ if(!map[b.id]) order.push(b.id); map[b.id]=b; cloudIds[b.id]=1; } });
  ((loc&&loc.bundles)||[]).forEach(function(b){ if(b&&b.id){ if(!map[b.id]) order.push(b.id); map[b.id]=b; if(!cloudIds[b.id]) extra=true; } });   /* 같은 id 는 이 기기 것 */
  return { obj:{bundles:order.map(function(id){ return map[id]; })}, extra:extra };
}
function vod5MergeAtObj(loc, cloud){
  var out={}, extra=false;
  Object.keys(cloud||{}).forEach(function(vid){ var c=cloud[vid]; if(c&&typeof c==='object'){ out[vid]={}; Object.keys(c).forEach(function(code){ if(c[code]) out[vid][code]=c[code]; }); } });
  Object.keys(loc||{}).forEach(function(vid){
    var l=loc[vid]; if(!l||typeof l!=='object') return;
    if(!out[vid]) out[vid]={};
    Object.keys(l).forEach(function(code){
      var t=l[code]; if(!t) return;
      var cur=out[vid][code];
      if(!cur || (vod5Ms(t) && vod5Ms(t)<vod5Ms(cur))){ out[vid][code]=t; extra=true; }   /* 더 이른 날짜가 이긴다 */
    });
  });
  return { obj:out, extra:extra };
}
function vod5MergePulled(key, value){
  var cloud=vod5ParseVal(value), loc=vod5Read(key);
  var r=(key===VOD5_KEY_B)
    ? vod5MergeBundlesObj(loc||{bundles:[]}, (cloud&&typeof cloud==='object')?cloud:{bundles:[]})
    : vod5MergeAtObj((loc&&!Array.isArray(loc))?loc:{}, (cloud&&typeof cloud==='object'&&!Array.isArray(cloud))?cloud:{});
  return { json:JSON.stringify(r.obj), extra:r.extra };
}
/* supaFullPull 은 따로 다루지 않는 키를 safePullSetItem 으로 «덮어쓴다» → 이 두 키만 합쳐서 넘긴다 */
if(typeof safePullSetItem==='function'){
  safePullSetItem=(function(o){ return function(key, value){
    if(key===VOD5_KEY_B || key===VOD5_KEY_AT){
      var m=null;
      try{ m=vod5MergePulled(key, value); }catch(e){ m=null; }
      if(m){
        var r=o.call(this, key, m.json);
        VOD5.bundles=null; VOD5.at=null;
        if(m.extra && typeof scheduleSync==='function'){ try{ scheduleSync(key); }catch(e){} }   /* 이 기기에만 있던 것은 서버로 다시 올린다 */
        return r;
      }
    }
    return o.apply(this, arguments);
  }; })(safePullSetItem);
}

/* ── 기존 배정 동작 감싸기: 내준 날짜 남기기 ── */
if(typeof vodToggleAssign==='function'){
  vodToggleAssign=(function(o){ return function(vid, code){
    try{ vodEnsure(); var a=VOD_ASSIGN[vid]; var was=!!(a&&Array.isArray(a.codes)&&a.codes.indexOf(code)!==-1); if(!was) vod5MarkPairs([[vid,code]]); }catch(e){}
    return o.apply(this, arguments);
  }; })(vodToggleAssign);
}
if(typeof vodBulkApply==='function'){
  vodBulkApply=(function(o){ return function(){
    var vids=[], codes=[];
    try{
      vids=Object.keys(VOD_VSEL).filter(function(k){ return VOD_VSEL[k]&&vodVideoById(k); });
      codes=Object.keys(VOD_BULK_PICK).filter(function(c){ return VOD_BULK_PICK[c]; });
    }catch(e){}
    var pairs=(vids.length && codes.length)?vod5NewPairs(vids, codes):[];
    var r=o.apply(this, arguments);
    try{ if(pairs.length && !VOD_BULK_OPEN) vod5MarkPairs(pairs); }catch(e){}   /* 실제로 배정됐을 때만 */
    return r;
  }; })(vodBulkApply);
}
if(typeof vodBulkAssignFolder==='function'){
  vodBulkAssignFolder=(function(o){ return function(fid){
    var pairs=[];
    try{   /* 창이 닫히기 전에 체크한 학생을 읽어 둔다 */
      var picked=vodBulkPickedCodes();
      if(picked && picked.length && vodActiveStudents().length) pairs=vod5NewPairs(vodVideosOf(fid).map(function(v){ return v.id; }), picked);
    }catch(e){ pairs=[]; }
    var r=o.apply(this, arguments);
    try{ if(pairs.length) vod5MarkPairs(pairs); }catch(e){}
    return r;
  }; })(vodBulkAssignFolder);
}

/* ── ① 일괄 배정 창 → 📦 묶음으로 내주기 ── */
function vod5SelVids(){ return Object.keys(VOD_VSEL||{}).filter(function(k){ return VOD_VSEL[k]&&vodVideoById(k); }); }
function vod5DefaultName(vids){
  var v0=vids&&vids.length?vodVideoById(vids[0]):null;
  var f=vodFolderById((v0&&v0.folderId)||VOD_SEL_FOLDER);
  var d=new Date();
  return (f?f.name:'묶음')+' · '+(d.getMonth()+1)+'/'+d.getDate();
}
if(typeof vodBulkOpen==='function'){
  vodBulkOpen=(function(o){ return function(){ VOD5.bname=null; return o.apply(this, arguments); }; })(vodBulkOpen);
}
if(typeof vodBulkModal==='function'){
  vodBulkModal=(function(o){ return function(){
    var h=o.apply(this, arguments);
    try{
      var vids=vod5SelVids();
      var pickN=Object.keys(VOD_BULK_PICK||{}).filter(function(c){ return VOD_BULK_PICK[c]; }).length;
      var nm=(VOD5.bname!==null)?VOD5.bname:vod5DefaultName(vids);
      var row='<div style="padding:11px 18px 0;border-top:1px solid #eef2f8;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
        +'<span style="font-size:12px;font-weight:800;color:#0d2240">📦 묶음 이름</span>'
        +'<input id="vod5-bname" value="'+vodEsc(nm)+'" oninput="VOD5.bname=this.value" placeholder="예: 공수2 집합 · 10/18" style="flex:1;min-width:180px;border:1.5px solid #cbd5e1;border-radius:8px;padding:7px 10px;font-size:12.5px;font-weight:700;font-family:inherit;color:#0d2240">'
        +'<span style="width:100%;font-size:10.5px;color:#94a3b8">내준 날짜·시각은 저절로 남습니다 · 모니터링 «🗺 시청 지도»에서 이 이름으로 골라 봅니다</span></div>';
      var foot='<div style="padding:13px 18px;border-top:1px solid #eef2f8;display:flex;align-items:center;gap:10px;flex-wrap:wrap">';
      var fi=h.lastIndexOf(foot);
      if(fi>=0) h=h.slice(0,fi)+row+foot.replace('border-top:1px solid #eef2f8;','')+h.slice(fi+foot.length);
      var btn='<button id="vod5-bapply" onclick="vod5BundleApply()" style="margin-left:auto;background:#10b981;color:#fff;border:none;border-radius:10px;padding:11px 18px;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer">📦 묶음으로 내주기 ('+pickN+'명 · 영상 '+vids.length+'개)</button>';
      var re=/<button onclick="vodBulkApply\(\)"[^>]*>[^<]*<\/button>/;
      if(re.test(h)) h=h.replace(re, btn);
      else { var k=h.lastIndexOf('</div></div>'); if(k>=0) h=h.slice(0,k)+'<div style="padding:0 18px 13px;display:flex">'+btn+'</div>'+h.slice(k); }
    }catch(e){ console.warn('[묶음 창]', e); }
    return h;
  }; })(vodBulkModal);
}
function vod5BundleApply(){
  var vids=vod5SelVids();
  var codes=Object.keys(VOD_BULK_PICK||{}).filter(function(c){ return VOD_BULK_PICK[c]; });
  if(!vids.length){ alert('선택된 영상이 없습니다.'); return; }
  if(!codes.length){ alert('학생을 한 명 이상 선택하세요.'); return; }
  var el=document.getElementById('vod5-bname');
  var name=String((el&&el.value)||VOD5.bname||'').trim()||vod5DefaultName(vids);
  var now=new Date().toISOString(), due=String(VOD_BULK_DUE||'');
  vodEnsure();
  var pairs=vod5NewPairs(vids, codes);   /* 처음 받는 학생·영상만 «내준 날짜» = 지금 */
  /* 학생앱이 읽는 배정 — 예전 일괄 배정과 똑같이 (학생 합집합 · 마감은 넣었을 때만) */
  vids.forEach(function(vid){
    var cur=VOD_ASSIGN[vid]||{codes:[],due:''};
    if(!Array.isArray(cur.codes)) cur.codes=[];
    codes.forEach(function(c){ if(cur.codes.indexOf(c)===-1) cur.codes.push(c); });
    if(due) cur.due=due;
    VOD_ASSIGN[vid]={codes:cur.codes, due:cur.due||''};
  });
  vodSaveAssign();
  vod5MarkPairs(pairs, now);
  var v0=vodVideoById(vids[0]);
  var b={ id:vodId('vb'), name:name, folderId:(v0&&v0.folderId)||'', vids:vids, codes:codes, due:due, at:now, by:'teacher' };
  vod5Bundles().push(b); vod5SaveBundles();
  VOD_BULK_OPEN=false; VOD_VSEL={}; VOD5.bname=null; VOD5.sel=b.id; VOD5.open=null;
  vodToast('📦 「'+name+'」 — '+codes.length+'명에게 영상 '+vids.length+'개를 내줬습니다');
  render();
}

/* ── 시청 기록 정리: 영상|학생 → 회차 목록 (오래된 것 먼저) ── */
var VOD5_IDX={ src:null, n:-1, map:{} };
function vod5T(l){ return vod5Ms((l&&(l.session_start||l.created_at))||''); }
function vod5Index(){
  var L=VOD_LOGS||[];
  if(VOD5_IDX.src===L && VOD5_IDX.n===L.length) return VOD5_IDX.map;
  var map={}, seen={};
  L.forEach(function(l){
    if(!l||!l.video_id||!l.student_code) return;
    var k=l.video_id+'|'+l.student_code;
    var sk=k+'|'+(l.session_start||l.created_at||l.id||'');
    var prev=seen[sk];
    if(prev){   /* 같은 회차가 두 줄(다시 보내기) → 많이 본 쪽 하나만 */
      if((+l.watched_sec||0)>(+prev.watched_sec||0)){ var arr=map[k]; arr[arr.indexOf(prev)]=l; seen[sk]=l; }
      return;
    }
    seen[sk]=l; (map[k]=map[k]||[]).push(l);
  });
  Object.keys(map).forEach(function(k){ map[k].sort(function(a,b){ return vod5T(a)-vod5T(b); }); });
  VOD5_IDX={ src:L, n:L.length, map:map };
  return map;
}
function vod5Sessions(vid, code){ return vod5Index()[vid+'|'+code]||[]; }
/* 한 칸 요약 — 진도 % 는 기존 화면(vodComplete)과 같은 셈 */
function vod5Info(vid, code, due){
  var v=vodVideoById(vid), f=v?vodFolderById(v.folderId):null, th=(f&&f.completeThreshold)?f.completeThreshold:90;
  var ss=vod5Sessions(vid, code), dur=(v&&v.durationSec)||0;
  var maxPos=0, watched=0, comp=false, n=0, last='', lastMs=0;
  ss.forEach(function(l){
    var w=+l.watched_sec||0, mp=+l.max_position_sec||0;
    watched+=w; if(mp>maxPos) maxPos=mp; if(l.completed) comp=true;
    if(w>=VOD_SHORT_SEC) n++;
    var t=vod5T(l); if(t>=lastMs){ lastMs=t; last=l.session_start||l.created_at||''; }
  });
  var pct=!ss.length?0:(comp?100:(!dur?(watched>0?1:0):Math.min(100, Math.round(maxPos/dur*100))));
  var done=ss.length>0 && pct>=th;
  return { n:n, all:ss.length, pct:pct, done:done, late:!!(due && due<vod5Today() && !done), last:last, th:th, dur:dur, maxPos:maxPos, watched:watched };
}
function vod5Col(pct, th, has){
  if(!has || pct<=0) return { bg:'#e2e8f0', fg:'#64748b' };
  if(pct<50) return { bg:'#bfdbfe', fg:'#1e3a8a' };
  if(pct<th) return { bg:'#3b82f6', fg:'#fff' };
  return { bg:'#22c55e', fg:'#fff' };
}

/* ── ③ 모니터링 탭: 🗺 시청 지도 (첫 탭) ── */
vodMonTabs=function(){
  function tb(k,label){ var on=(VOD_MON_TAB===k);
    return '<button onclick="vodMonSetTab(\''+k+'\')" style="border:none;font-family:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border-radius:8px;cursor:pointer;'+(on?'background:#0d2240;color:#fff':'background:transparent;color:#64748b')+'">'+label+'</button>'; }
  return '<div style="flex-shrink:0;background:#fff;border-bottom:1px solid #e2e8f0;padding:9px 16px;display:flex;align-items:center;gap:8px">'
    +'<div style="display:inline-flex;background:#f1f5f9;border-radius:10px;padding:4px;gap:4px;flex-wrap:wrap">'+tb('map','🗺 시청 지도')+tb('student','👤 학생별')+tb('video','🎬 영상별')+tb('class','🏫 반별')+'</div>'
    +'<button onclick="vodRefreshLogs()" style="margin-left:auto;font-size:10px;color:#64748b;background:#fff;border:1px solid #cbd5e1;border-radius:7px;padding:6px 11px;font-family:inherit;cursor:pointer;font-weight:700">↻ 새로고침</button></div>';
};
if(typeof vodMonitor==='function'){
  vodMonitor=(function(o){ return function(){
    if(VOD_MON_TAB!=='map') return o.apply(this, arguments);
    var body='';
    try{ body=vod5Map(); }catch(e){ console.error(e); body='<div style="padding:20px;color:#b91c1c;font-weight:800">시청 지도 오류: '+vodEsc(e.message)+'</div>'; }
    return '<div style="height:100%;display:flex;flex-direction:column;overflow:hidden">'+vodMonTabs()+body+'</div>';
  }; })(vodMonitor);
}
function vod5Pick(id){ VOD5.sel=id||''; VOD5.open=null; render(); }
function vod5Open(vid, code){
  if(VOD5.open && VOD5.open.vid===vid && VOD5.open.code===code) VOD5.open=null;
  else VOD5.open={ vid:vid, code:code };
  render();
}
function vod5Close(){ VOD5.open=null; render(); }
/* 지도에 놓을 영상·학생 */
function vod5Src(){
  var b=VOD5.sel?vod5BundleById(VOD5.sel):null;
  if(VOD5.sel && !b) VOD5.sel='';
  var asg={};
  function asgOf(vid){ if(!asg[vid]){ var s={}; vodAssignOf(vid).codes.forEach(function(c){ s[c]=1; }); asg[vid]=s; } return asg[vid]; }
  var vids=[], codes=[], cset={};
  if(b){
    vids=b.vids.filter(function(id){ return !!vodVideoById(id); });
    b.codes.forEach(function(c){ if(!cset[c] && !vodIsWithdrawnCode(c)){ cset[c]=1; codes.push(c); } });
  } else {
    var fid=vodDefaultFolder();
    vids=vodVideosOf(fid).filter(function(v){ return Object.keys(asgOf(v.id)).length>0; }).map(function(v){ return v.id; });
    vids.forEach(function(vid){ Object.keys(asgOf(vid)).forEach(function(c){ if(!cset[c]){ cset[c]=1; codes.push(c); } }); });
  }
  return { b:b, vids:vids, codes:codes,
    assigned:function(vid, code){ return !!asgOf(vid)[code]; },
    due:function(vid){ return (b&&b.due) || vodAssignOf(vid).due || ''; } };
}
function vod5StuMap(){
  var all=[]; try{ all=(typeof getSortedStudents==='function')?(getSortedStudents(true)||[]):[]; }catch(e){ all=[]; }
  var m={}; all.forEach(function(s){ if(s&&s.lumen_rec_code) m[s.lumen_rec_code]=s; }); return m;
}
function vod5Short(t, n){ t=String(t||''); return t.length>n?(t.slice(0,n-1)+'…'):t; }
function vod5Map(){
  var h='<div id="vod5-map" style="flex:1;overflow:auto;padding:14px">';
  if(VOD_LOGS===null) return h+'<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">시청 기록 불러오는 중…</div></div>';
  var fid=vodDefaultFolder(), f=vodFolderById(fid);
  var B=vod5BundlesSorted();
  var S=vod5Src();
  /* 고르기: 폴더 전체 / 묶음 (최근 먼저) */
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'
    +'<span style="font-size:12px;font-weight:800;color:#64748b">보기</span>'
    +'<select id="vod5-sel" onchange="vod5Pick(this.value)" style="max-width:100%;border:1.5px solid #cbd5e1;border-radius:9px;padding:7px 10px;font-size:12.5px;font-weight:700;font-family:inherit;color:#0d2240;background:#fff">'
    +'<option value=""'+(S.b?'':' selected')+'>📁 '+vodEsc(f?f.name:'폴더')+' — 배정된 영상 전체 (왼쪽에서 폴더 고르기)</option>';
  B.forEach(function(b){
    h+='<option value="'+vodEsc(b.id)+'"'+(S.b&&S.b.id===b.id?' selected':'')+'>📦 '+vodEsc(b.name)+' · '+vodEsc(vod5When(b.at)||'날짜 없음')+' 내줌 · 영상 '+b.vids.length+' · 학생 '+b.codes.length+'</option>';
  });
  h+='</select>';
  if(!B.length) h+='<span style="font-size:10.5px;color:#94a3b8">묶음은 강의 관리 → 영상 체크 → 「📤 일괄 배정」 → 「📦 묶음으로 내주기」로 만듭니다</span>';
  h+='</div>';
  if(S.b){
    var bd=S.b;
    h+='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:10px;padding:9px 13px;margin-bottom:10px;font-size:12px;color:#334155">'
      +'<b style="color:#0d2240;font-size:13px">📦 '+vodEsc(bd.name)+'</b>'
      +'<span>📤 내준 날짜 <b>'+vodEsc(vod5When(bd.at)||'—')+'</b></span>'
      +'<span>🗓 마감 <b>'+(bd.due?vodEsc(vod5Day(bd.due)):'없음')+'</b></span>'
      +'<span>영상 '+bd.vids.length+'개 · 학생 '+bd.codes.length+'명</span></div>';
  }
  if(!S.vids.length || !S.codes.length){
    h+='<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">'
      +(S.b?'이 묶음에 남은 영상·학생이 없습니다.':('📁 '+vodEsc(f?f.name:'')+' — 이 폴더에 배정된 영상이 없습니다.<br><span style="font-size:11px">왼쪽에서 다른 폴더를 고르거나 위에서 묶음을 고르세요.</span>'))+'</div></div>';
    return h;
  }
  var stu=vod5StuMap();
  var codes=S.codes.slice().sort(function(a,b){
    var sa=stu[a], sb=stu[b], ga=(sa&&sa.group)||'~', gb=(sb&&sb.group)||'~';
    if(ga!==gb) return ga.localeCompare(gb,'ko');
    return ((sa&&sa.name)||'').localeCompare((sb&&sb.name)||'','ko');
  });
  /* 칸 계산 한 번에 */
  var cell={}, colSum={}, colN={};
  S.vids.forEach(function(vid){ colSum[vid]=0; colN[vid]=0; });
  codes.forEach(function(c){ S.vids.forEach(function(vid){
    if(!S.assigned(vid,c)){ var i0=vod5Info(vid,c,''); cell[vid+'|'+c]={na:true, info:i0}; return; }
    var info=vod5Info(vid, c, S.due(vid));
    cell[vid+'|'+c]={ info:info };
    colSum[vid]+=info.pct; colN[vid]++;
  }); });
  /* 표 + 오른쪽 상세 */
  h+='<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap">';
  h+='<div style="flex:1 1 240px;min-width:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:auto">';
  h+='<table id="vod5-grid" style="border-collapse:separate;border-spacing:0;font-size:11.5px;min-width:100%">';
  h+='<tr><th style="position:sticky;left:0;z-index:2;background:#f8fafc;text-align:left;padding:8px 12px;color:#94a3b8;font-size:10.5px;border-bottom:1px solid #e2e8f0;min-width:90px">학생 · 반</th>';
  S.vids.forEach(function(vid){
    var v=vodVideoById(vid); var avg=colN[vid]?Math.round(colSum[vid]/colN[vid]):0; var due=S.due(vid);
    h+='<th class="vod5-col" title="'+vodEsc((v&&v.title)||'')+(due?' · 마감 '+vodEsc(vod5Day(due)):'')+'" style="background:#f8fafc;padding:6px 4px;border-bottom:1px solid #e2e8f0;min-width:44px;max-width:86px;vertical-align:bottom">'
      +'<div style="font-size:10px;color:#475569;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:86px">'+vodEsc(vod5Short(v&&v.title, 9))+'</div>'
      +'<div style="font-size:10px;font-weight:900;color:'+(avg>=90?'#15803d':(avg>=50?'#1d4ed8':'#94a3b8'))+'">평균 '+avg+'%</div></th>';
  });
  h+='<th style="background:#f8fafc;padding:8px 6px;color:#94a3b8;font-size:10px;border-bottom:1px solid #e2e8f0;white-space:nowrap">완료/배정</th></tr>';
  codes.forEach(function(c){
    var st=stu[c]||vodStudentByCode(c); var nm=st?st.name:('(미등록 '+c+')'); var grp=st?(st.group||'미배정'):'—';
    var done=0, tot=0;
    h+='<tr><td style="position:sticky;left:0;z-index:1;background:#fff;padding:6px 12px;border-bottom:1px solid #f1f5f9;white-space:nowrap"><b style="color:#0d2240">'+vodEsc(nm)+'</b> <span style="color:#94a3b8;font-size:10.5px">· '+vodEsc(grp)+'</span></td>';
    S.vids.forEach(function(vid){
      var x=cell[vid+'|'+c], i=x.info, v=vodVideoById(vid);
      var sel=!!(VOD5.open && VOD5.open.vid===vid && VOD5.open.code===c);
      if(x.na){
        h+='<td style="text-align:center;border-bottom:1px solid #f1f5f9;padding:4px"><div class="vod5-cell vod5-na" data-vid="'+vodEsc(vid)+'" data-code="'+vodEsc(c)+'"'+(i.all?' onclick="vod5Open(\''+vodEsc(vid)+'\',\''+vodEsc(c)+'\')"':'')+' title="배정 안 됨'+(i.all?' (그래도 '+i.n+'회 봄)':'')+'" style="width:36px;height:28px;margin:auto;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:13px;'+(i.all?'cursor:pointer;border:1px dashed #cbd5e1;border-radius:6px':'')+'">'+(i.n?i.n:'·')+'</div></td>';
        return;
      }
      tot++; if(i.done) done++;
      var col=vod5Col(i.pct, i.th, i.all>0);
      var given=vod5GivenAt(vid, c), due=S.due(vid);
      var tip=nm+' · '+((v&&v.title)||'')
        +'\n내준 날짜: '+(given?vod5When(given):'기록 없음(v19-135 이전)')
        +'\n마감: '+(due?vod5Day(due):'없음')+(i.late?' (지남)':'')
        +'\n마지막 시청: '+(i.last?vod5When(i.last):'아직 안 봄')
        +'\n진도 '+i.pct+'% · 본 횟수 '+i.n+'회'+(i.all>i.n?' (+잠깐 열어봄 '+(i.all-i.n)+')':'');
      h+='<td style="text-align:center;border-bottom:1px solid #f1f5f9;padding:4px">'
        +'<div class="vod5-cell" data-vid="'+vodEsc(vid)+'" data-code="'+vodEsc(c)+'" data-n="'+i.n+'" data-pct="'+i.pct+'" data-late="'+(i.late?1:0)+'" data-re="'+(i.n>=2?1:0)+'" onclick="vod5Open(\''+vodEsc(vid)+'\',\''+vodEsc(c)+'\')" title="'+vodEsc(tip)+'"'
        +' style="position:relative;width:36px;height:28px;margin:auto;border-radius:6px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:900;font-size:12.5px;background:'+col.bg+';color:'+col.fg+';border:2px solid '+(i.late?'#dc2626':'transparent')+(sel?';box-shadow:0 0 0 2px #0d2240':'')+'">'
        +(i.n?i.n:'')
        +(i.n>=2?'<span class="vod5-re" style="position:absolute;top:-7px;right:-7px;background:#7c3aed;color:#fff;border-radius:50%;width:16px;height:16px;font-size:11px;line-height:16px;text-align:center;font-weight:900">↻</span>':'')
        +'</div></td>';
    });
    h+='<td style="text-align:center;font-weight:900;border-bottom:1px solid #f1f5f9;color:'+(tot&&done===tot?'#15803d':'#475569')+'">'+done+'/'+tot+'</td></tr>';
  });
  h+='</table>';
  /* 범례 */
  function sw(bg, extra){ return '<span style="display:inline-block;width:14px;height:11px;border-radius:3px;background:'+bg+';vertical-align:-1px;margin-right:4px;'+(extra||'')+'"></span>'; }
  h+='<div id="vod5-legend" style="display:flex;gap:12px;flex-wrap:wrap;padding:9px 12px;border-top:1px solid #f1f5f9;font-size:10.5px;color:#64748b">'
    +'<span>'+sw('#e2e8f0')+'안 봄</span><span>'+sw('#bfdbfe')+'1~49%</span><span>'+sw('#3b82f6')+'50%~</span><span>'+sw('#22c55e')+'완료(폴더 기준 %)</span>'
    +'<span><b style="color:#0d2240">숫자</b> = 본 횟수(회차 · '+VOD_SHORT_SEC+'초 미만은 안 셈)</span>'
    +'<span><span style="display:inline-block;width:12px;height:9px;border:2px solid #dc2626;border-radius:3px;vertical-align:-1px;margin-right:4px"></span>마감 지남 · 미완료</span>'
    +'<span><span style="display:inline-block;background:#7c3aed;color:#fff;border-radius:50%;width:13px;height:13px;font-size:8.5px;line-height:13px;text-align:center;margin-right:4px">↻</span>두 번 이상 봄</span>'
    +'<span>· = 배정 안 됨 · 칸을 누르면 회차별 기록</span></div>';
  h+='</div>';
  if(VOD5.open){
    var od=VOD5.open;
    h+='<div style="flex:0 1 330px;min-width:280px;position:sticky;top:0">'+vod5Detail(od.vid, od.code, S.assigned(od.vid,od.code)?S.due(od.vid):vodAssignOf(od.vid).due, stu)+'</div>';
  }
  h+='</div></div>';
  return h;
}

/* ── ④ 상세: 회차별 기록 + 구간 막대 ── */
function vod5SesBar(l, dur){
  var segs=Array.isArray(l.segments)?l.segments:[], mp=+l.max_position_sec||0;
  var scale=dur||0;
  if(!scale){ segs.forEach(function(s){ scale=Math.max(scale, +s.end||0); }); scale=Math.max(scale, mp); }
  if(!scale) scale=1;
  function p(x){ return Math.max(0, Math.min(100, (+x||0)/scale*100)); }
  var h='<div class="vod5-bar" style="position:relative;height:12px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;overflow:hidden">';
  if(segs.length){
    segs.forEach(function(s){
      var a=p(s.start), b=p(s.end); if(b<=a) return;
      var r=+s.rate||1;
      h+='<i class="vod5-seg" title="'+vodFmt(s.start)+' ~ '+vodFmt(s.end)+' · ×'+r+'" style="position:absolute;top:0;bottom:0;left:'+a.toFixed(2)+'%;width:'+Math.max(0.7, b-a).toFixed(2)+'%;background:'+(r>1.5?'#fbbf24':'#22c55e')+'"></i>';
    });
  } else if(mp>0){
    h+='<i title="구간 기록 없음 — 처음부터 가장 멀리 간 곳까지로 표시" style="position:absolute;top:0;bottom:0;left:0;width:'+p(mp).toFixed(2)+'%;background:#86efac;opacity:.75"></i>';
  }
  if(mp>0) h+='<i title="가장 멀리 '+vodFmt(mp)+'" style="position:absolute;top:0;bottom:0;left:calc('+p(mp).toFixed(2)+'% - 1px);width:2px;background:#0d2240"></i>';
  h+='</div>';
  return h;
}
function vod5Detail(vid, code, due, stu){
  var v=vodVideoById(vid), f=v?vodFolderById(v.folderId):null;
  var st=(stu&&stu[code])||vodStudentByCode(code);
  var nm=st?st.name:('(미등록 '+code+')');
  var i=vod5Info(vid, code, due), dur=i.dur;
  var ss=vod5Sessions(vid, code).slice();
  var given=vod5GivenAt(vid, code), bs=vod5BundlesOf(vid, code);
  var assigned=vodAssignOf(vid).codes.indexOf(code)!==-1;
  var h='<div id="vod5-detail" style="background:#fff;border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 8px 24px rgba(13,34,64,.10);overflow:hidden">';
  h+='<div style="background:#0d2240;color:#fff;padding:10px 13px;display:flex;align-items:flex-start;gap:8px">'
    +'<div style="min-width:0;flex:1"><div style="font-size:13.5px;font-weight:900">👤 '+vodEsc(nm)+(st&&st.group?' <span style="opacity:.6;font-size:11px">· '+vodEsc(st.group)+'</span>':'')+'</div>'
    +'<div style="font-size:11.5px;opacity:.85;margin-top:2px;word-break:keep-all">🎬 '+vodEsc((v&&v.title)||vid)+(f?' <span style="opacity:.6">· '+vodEsc(f.name)+'</span>':'')+'</div></div>'
    +'<button onclick="vod5Close()" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:16px;cursor:pointer;flex:none">✕</button></div>';
  /* 내준 날짜 · 마감 · 완료 */
  var stat=i.done?'<b style="color:#15803d">✅ 완료</b> ('+i.pct+'%)'
    :(i.all?'<b style="color:#1d4ed8">▶ 보는 중</b> '+i.pct+'%':'<b style="color:#b45309">⚠️ 아직 안 봄</b>');
  function row(k, val){ return '<div style="display:flex;gap:8px;padding:3px 0"><span style="width:62px;flex:none;color:#94a3b8;font-weight:700">'+k+'</span><span style="min-width:0;color:#0d2240">'+val+'</span></div>'; }
  h+='<div style="padding:10px 13px;font-size:12px;border-bottom:1px solid #eef2f8">';
  h+=row('내준 날짜', given?'<b class="vod5-given">'+vodEsc(vod5When(given))+'</b>':'<span class="vod5-given" style="color:#94a3b8">기록 없음(v19-135 이전)</span>');
  if(bs.length) h+=row('묶음', bs.map(function(b){ return '📦 '+vodEsc(b.name)+' <span style="color:#94a3b8">('+vodEsc(vod5When(b.at))+')</span>'; }).join('<br>'));
  h+=row('마감', due?(vodEsc(vod5Day(due))+(i.late?' <b style="color:#dc2626">· 지남</b>':'')):'<span style="color:#94a3b8">없음</span>');
  h+=row('상태', stat+(assigned?'':' <span style="color:#dc2626;font-weight:800">· 지금은 배정 안 됨</span>'));
  h+=row('영상 길이', dur?vodFmt(dur):'<span style="color:#b45309">길이 미등록 — 막대는 대략</span>');
  h+=row('본 횟수', '<b>'+i.n+'회</b>'+(i.all>i.n?' <span style="color:#94a3b8">(+잠깐 열어봄 '+(i.all-i.n)+')</span>':'')+(i.all?' · 합계 '+vodFmt(i.watched):''));
  h+='</div>';
  /* 회차 목록 — 최근 먼저 */
  h+='<div style="padding:8px 13px 12px;max-height:60vh;overflow:auto">';
  if(!ss.length){
    h+='<div style="padding:18px 4px;text-align:center;color:#94a3b8;font-size:12px">아직 시청 기록이 없습니다.</div>';
  } else {
    var no=0, nos=[];
    ss.forEach(function(l){ if((+l.watched_sec||0)>=VOD_SHORT_SEC){ no++; nos.push(no); } else nos.push(0); });   /* 오래된 것부터 1회차 */
    for(var k=ss.length-1;k>=0;k--){
      var l=ss[k], w=+l.watched_sec||0, mp=+l.max_position_sec||0, short=w<VOD_SHORT_SEC;
      var r=+l.playback_rate||1;
      h+='<div class="vod5-ses'+(short?' vod5-short':'')+'" style="padding:8px 0;border-top:1px solid #f1f5f9;'+(short?'opacity:.5':'')+'">'
        +'<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px;margin-bottom:5px">'
        +'<span style="font-weight:900;border-radius:20px;padding:1px 8px;font-size:10.5px;'+(short?'background:#f1f5f9;color:#64748b':'background:#ede9fe;color:#6d28d9')+'">'+(short?'잠깐 열어봄':(nos[k]+'회차'))+'</span>'
        +'<b class="vod5-when" style="color:#0d2240">'+vodEsc(vod5When(l.session_start||l.created_at)||'시각 없음')+'</b>'
        +(l.completed?'<span style="font-size:10.5px;font-weight:800;color:#15803d">✅ 끝까지</span>':'')
        +'</div>'
        +'<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:11px;color:#475569;margin-bottom:5px">'
        +'<span>⏱ 본 길이 <b>'+vodFmt(w)+'</b></span>'
        +'<span>📍 가장 멀리 <b>'+vodFmt(mp)+'</b>'+(dur?' ('+Math.min(100,Math.round(mp/dur*100))+'%)':'')+'</span>'
        +'<span style="color:'+(r>1.5?'#b45309':'#475569')+'">⏩ 배속 <b>×'+r+'</b></span>'
        +'<span style="color:'+((+l.blur_count||0)>1?'#b45309':'#475569')+'">↗ 이탈 <b>'+(+l.blur_count||0)+'회</b></span>'
        +'</div>'
        +vod5SesBar(l, dur)
        +'</div>';
    }
    h+='<div style="display:flex;justify-content:space-between;font-size:9.5px;color:#94a3b8;margin-top:3px"><span>0:00</span><span><span style="display:inline-block;width:8px;height:8px;background:#22c55e;border-radius:2px"></span> 본 구간 · <span style="display:inline-block;width:8px;height:8px;background:#fbbf24;border-radius:2px"></span> 빠른 배속 · <span style="display:inline-block;width:2px;height:8px;background:#0d2240"></span> 가장 멀리</span><span>'+(dur?vodFmt(dur):'')+'</span></div>';
  }
  h+='</div></div>';
  return h;
}

/* ── 학생별 탭: 펼친 줄에 «회차 n · 마지막 날짜시각» ── */
function vod5StuMini(vid, code){
  var ss=vod5Sessions(vid, code), n=0, last='', lm=0;
  ss.forEach(function(l){ if((+l.watched_sec||0)>=VOD_SHORT_SEC) n++; var t=vod5T(l); if(t>=lm){ lm=t; last=l.session_start||l.created_at||''; } });
  return '<span class="vod5-mini" style="width:150px;flex:none;text-align:right;font-size:10px;color:'+(n>=2?'#6d28d9':'#64748b')+';font-weight:700;white-space:nowrap">'
    +(ss.length?('회차 '+n+(n>=2?' ↻':'')+' · '+vodEsc(vod5When(last))):'<span style="color:#cbd5e1">회차 0</span>')+'</span>';
}
if(typeof vodMonStudents==='function'){
  vodMonStudents=(function(o){ return function(){
    var h=o.apply(this, arguments);
    try{
      h=h.replace(/<button onclick="event\.stopPropagation\(\);vodUnassign\('([^']*)','([^']*)'\)"/g, function(m, vid, code){ return vod5StuMini(vid, code)+m; });
    }catch(e){}
    return h;
  }; })(vodMonStudents);
}
