/* ═════════════════════════════════════════════════════════════════
 * v19-201: 🎬 강의실 › 모니터링 «👤 학생별» 2판 — A안(반 칩 + 학생 한 줄 표) + B안(학생 서랍)
 *   (원장 2026-11-21 「다른 학원 영상학습관리와 비교 · 개별 학생 확인이 잘 안 보인다」 → 시안 docs/mockup_vod_student.html «추천대로 A+B»)
 *  ① 모니터링 첫 탭 = 👤 학생별 (🗺 시청 지도 · 🎬 영상별 · 🏫 반별 탭은 그대로)
 *  ② 반 칩(학생 반 group · 빨간 숫자 = 챙길 학생 수) · «🚩 챙길 학생만» · 위 숫자 5개
 *  ③ 학생 한 줄: 진도(완료/배정) · 마감 지남 · 다시 봄(2번 이상 본 영상) · 마지막 시청 · 상태
 *     상태 = 🚩 밀림(마감 지난 미완료) > 🚩 안 봄(배정 있는데 3일 넘게 시청 없음) > ⏩ 건너뛰며 봄(본 시간 < 간 지점의 절반) > ✓ 완료 > 진행 중
 *  ④ 줄을 누르면 오른쪽 서랍(좁으면 아래): 숫자 4칸 · ▶ 다음에 볼 영상 · 폴더 › 단원별 영상(막대 · % · 내준 날 · 마감 · 상태)
 *     · 📨 학부모 한 줄 복사 · 영상 줄을 누르면 🗺 시청 지도의 회차 창(그 폴더)으로
 *  계산은 v19-135 vod5Info(같은 «완료» 기준 = 폴더 완료 %)를 그대로 쓴다. 서버 읽기·쓰기 추가 없음(VOD_LOGS 그대로).
 *  ※ 문자열 연결로만. 앞 vodMonitor 감싸기(v19-135)를 한 번 더 감싼다.
 * ═════════════════════════════════════════════════════════════════ */
var VOD7 = { grp:'', flag:false, sel:'' };
var VOD7_IDLE_DAYS = 3;
try{ if(typeof VOD_MON_TAB!=='undefined') VOD_MON_TAB='student'; }catch(e){}

function vod7AllVids(){ var out=[]; try{ vodFolders().forEach(function(f){ vodVideosOf(f.id).forEach(function(v){ out.push(v); }); }); }catch(e){} return out; }
/* 학생 한 명 요약 */
function vod7Sum(code, vids){
  var asg=0, done=0, late=0, re=0, ff=0, last='', lm=0, firstGiven=0, rows=[];
  vids.forEach(function(v){
    var a=vodAssignOf(v.id); if(a.codes.indexOf(code)<0) return;
    var i=vod5Info(v.id, code, a.due); asg++;
    if(i.done) done++; if(i.late) late++; if(i.n>=2) re++;
    var skip=(i.maxPos>=60 && i.watched < i.maxPos*0.5);
    if(skip) ff++;
    var t=vod5Ms(i.last); if(i.last && t>=lm){ lm=t; last=i.last; }
    var g=vod5GivenAt(v.id, code), gm=vod5Ms(g); if(gm && (!firstGiven || gm<firstGiven)) firstGiven=gm;
    rows.push({ v:v, i:i, due:a.due, given:g, skip:skip });
  });
  var idleFrom = lm || firstGiven;
  var idle = asg>done && idleFrom && (Date.now()-idleFrom) > VOD7_IDLE_DAYS*86400000;
  if(asg>done && !lm && !firstGiven) idle=true;
  var st = late?'late':(idle?'idle':(ff?'skip':(asg&&done>=asg?'done':'run')));
  return { code:code, asg:asg, done:done, late:late, re:re, ff:ff, last:last, lm:lm, idle:idle, st:st, rows:rows, pct:asg?Math.round(done/asg*100):0 };
}
var VOD7_ST = { late:['🚩 밀림','#fee2e2','#b91c1c'], idle:['🚩 안 봄','#fee2e2','#b91c1c'], skip:['⏩ 건너뛰며 봄','#fef3c7','#b45309'], done:['✓ 완료','#dcfce7','#15803d'], run:['진행 중','#e0f2fe','#0369a1'] };
function vod7Badge(st){ var s=VOD7_ST[st]||VOD7_ST.run; return '<span style="display:inline-block;border-radius:99px;padding:2px 9px;font-size:11px;font-weight:900;white-space:nowrap;background:'+s[1]+';color:'+s[2]+'">'+s[0]+'</span>'; }
function vod7Flag(x){ return x.st==='late'||x.st==='idle'||x.st==='skip'; }
function vod7BarCol(p){ return p>=100?'#16a34a':(p>=60?'#84cc16':(p>=30?'#f97316':'#ef4444')); }
function vod7Bar(p, w){ return '<span style="display:inline-block;vertical-align:middle;width:'+(w||110)+'px;height:8px;background:#f1f5f9;border-radius:8px;overflow:hidden"><i style="display:block;height:100%;width:'+Math.max(0,Math.min(100,p))+'%;background:'+vod7BarCol(p)+'"></i></span>'; }
function vod7Ago(ms){ if(!ms) return ''; var d=Math.floor((Date.now()-ms)/86400000); return d>=VOD7_IDLE_DAYS?' <span style="display:inline-block;border-radius:99px;padding:1px 7px;font-size:10.5px;font-weight:900;background:#fef3c7;color:#b45309">'+d+'일 전</span>':''; }

function vod7Data(){
  var all=[]; try{ all=(typeof getSortedStudents==='function')?(getSortedStudents(true)||[]):[]; }catch(e){}
  var vids=vod7AllVids(), out=[];
  all.forEach(function(s){ if(!s||!s.lumen_rec_code||s.withdrawn) return; var x=vod7Sum(s.lumen_rec_code, vids); if(!x.asg) return; x.s=s; x.grp=String(s.group||'반 없음'); out.push(x); });
  return out;
}
window.vod7Grp=function(g){ VOD7.grp=(VOD7.grp===g?'':g); render(); };
window.vod7FlagTog=function(){ VOD7.flag=!VOD7.flag; render(); };
window.vod7Pick=function(c){ VOD7.sel=(VOD7.sel===c?'':c); render(); try{ var d=document.getElementById('vod7-drawer'); if(d && window.innerWidth<1100) d.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){} };
window.vod7Map=function(vid, code){ try{ var v=vodVideoById(vid); if(v && typeof VOD_FOLDER!=='undefined') VOD_FOLDER=v.folderId; }catch(e){} try{ VOD5.sel=''; VOD5.open={ vid:vid, code:code }; }catch(e){} VOD_MON_TAB='map'; render(); };
window.vod7Copy=function(code){
  var D=vod7Data().filter(function(x){ return x.code===code; })[0]; if(!D) return;
  var nm=D.s.name||'', nx=D.rows.filter(function(r){ return !r.i.done; });
  var t='[루멘수학] '+nm+' 학생 영상 학습 — 배정 '+D.asg+'편 중 '+D.done+'편 완료('+D.pct+'%)'
    +(D.late?(', 마감 지난 영상 '+D.late+'편'):'')
    +(D.last?(', 마지막 시청 '+vod5When(D.last)):', 아직 시청 기록이 없어요')
    +(nx.length?('. 다음에 볼 영상: «'+(nx[0].v.title||'')+'»'):'')+'.';
  try{ navigator.clipboard.writeText(t).then(function(){ try{ plToast('📨 복사했어요'); }catch(e){} }, function(){ prompt('복사해서 쓰세요', t); }); }catch(e){ prompt('복사해서 쓰세요', t); }
};

function vod7Drawer(D){
  var s=D.s, h='<div id="vod7-drawer" style="flex:1 1 420px;min-width:0;max-width:100%;background:#fff;border-radius:16px;box-shadow:0 6px 20px rgba(15,23,42,.12);overflow:hidden;align-self:flex-start">';
  h+='<div style="background:#0d2240;color:#fff;padding:13px 15px;display:flex;align-items:center;gap:11px"><div style="width:42px;height:42px;border-radius:12px;background:#1d6fe8;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px">'+vodEsc(String(s.name||'?').slice(0,1))+'</div>'
    +'<div style="flex:1;min-width:0"><b style="font-size:17px">'+vodEsc(s.name||'')+'</b><div style="opacity:.75;font-weight:700;font-size:11.5px">'+vodEsc([s.grade||'', s.school||'', s.group||''].filter(Boolean).join(' · '))+'</div></div>'
    +'<button type="button" onclick="vod7Pick(\''+vodEsc(D.code)+'\')" aria-label="닫기" style="background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer">✕</button></div>';
  function k(lb, v, c){ return '<div style="background:#f8fafc;border-radius:10px;padding:7px 9px"><small style="display:block;color:#64748b;font-weight:700;font-size:10.5px">'+lb+'</small><b style="font-size:16px;'+(c?'color:'+c:'')+'">'+v+'</b></div>'; }
  var wk=0, wkSec=0, since=Date.now()-7*86400000;
  D.rows.forEach(function(r){ try{ vod5Sessions(r.v.id, D.code).forEach(function(l){ if(vod5T(l)>=since && (+l.watched_sec||0)>=VOD_SHORT_SEC){ wk++; wkSec+=(+l.watched_sec||0); } }); }catch(e){} });
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:11px 13px;border-bottom:1px solid #e2e8f0">'
    +k('진도', D.pct+'% <small style="font-size:11px;color:#64748b">'+D.done+'/'+D.asg+'</small>', vod7BarCol(D.pct))+k('마감 지남', D.late, D.late?'#b91c1c':'')
    +k('최근 7일', wk+'회 · '+Math.round(wkSec/60)+'분')+k('마지막', D.last?vod5When(D.last):'없음')+'</div>';
  var nx=D.rows.filter(function(r){ return !r.i.done; }).sort(function(a,b){ var da=a.due||'9999', db=b.due||'9999'; return da<db?-1:(da>db?1:(vod5Ms(a.given)-vod5Ms(b.given))); })[0];
  if(nx) h+='<div onclick="vod7Map(\''+vodEsc(nx.v.id)+'\',\''+vodEsc(D.code)+'\')" style="cursor:pointer;margin:11px 13px 4px;background:linear-gradient(135deg,#0d2240,#1d4ed8);color:#fff;border-radius:12px;padding:10px 13px;font-weight:800">▶ 다음에 볼 영상 · '+vodEsc(nx.v.title||'')
    +'<small style="display:block;opacity:.85;font-size:11px">'+(nx.due?('마감 '+vod5Day(nx.due)+(nx.i.late?' 지남':'')+' · '):'')+'지금까지 '+nx.i.pct+'% 봄</small></div>';
  /* 폴더 › 단원별 */
  var byF={}, fo=[];
  D.rows.forEach(function(r){ var f=r.v.folderId; if(!byF[f]){ byF[f]={}; fo.push(f); } byF[f][r.v.id]=r; });
  fo.forEach(function(fid){
    var f=vodFolderById(fid), rs=byF[fid], groups=[];
    try{ groups=vodGroupedVideos(fid); }catch(e){ groups=[{ name:'', videos:vodVideosOf(fid) }]; }
    h+='<div style="margin:12px 13px 2px;font-size:11.5px;font-weight:900;color:#1d4ed8">📁 '+vodEsc(f?f.name:'폴더')+'</div>';
    groups.forEach(function(g){
      var list=(g.videos||[]).filter(function(v){ return rs[v.id]; }); if(!list.length) return;
      var dn=list.filter(function(v){ return rs[v.id].i.done; }).length;
      h+='<div style="margin:8px 13px 0;font-weight:900;font-size:12.5px;color:#334155;display:flex;justify-content:space-between;gap:8px"><span>'+vodEsc(g.name||'미분류')+'</span><span style="color:#64748b;font-weight:700">'+dn+'/'+list.length+' 완료</span></div>';
      list.forEach(function(v){
        var r=rs[v.id], i=r.i, st=i.done?(i.n>=2?['완료 ↻'+i.n,'#dcfce7','#15803d']:['완료','#dcfce7','#15803d']):(i.late?['마감 지남','#fee2e2','#b91c1c']:(r.skip?['⏩ 건너뜀','#fef3c7','#b45309']:(i.all?['보는 중','#e0f2fe','#0369a1']:['시청 전','#f1f5f9','#64748b'])));
        h+='<div class="vod7-v" onclick="vod7Map(\''+vodEsc(v.id)+'\',\''+vodEsc(D.code)+'\')" title="누르면 🗺 시청 지도의 회차 창" style="cursor:pointer;display:grid;grid-template-columns:minmax(0,1fr) auto 40px auto;gap:8px;align-items:center;margin:0 13px;padding:7px 0;border-bottom:1px dashed #eef2f7">'
          +'<div style="min-width:0"><div style="font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+vodEsc(v.title||'')+'</div><small style="color:#64748b;font-weight:700;font-size:10.5px">'
          +[r.given?(vod6DateOnlySafe(r.given)+' 내줌'):'', r.due?('마감 '+vod5Day(r.due)):'', i.last?(vod5When(i.last)+' 봄'):''].filter(Boolean).join(' · ')+'</small></div>'
          +vod7Bar(i.pct, 90)+'<b style="font-size:12px;text-align:right">'+i.pct+'%</b>'
          +'<span style="display:inline-block;border-radius:99px;padding:2px 8px;font-size:10.5px;font-weight:900;white-space:nowrap;background:'+st[1]+';color:'+st[2]+'">'+st[0]+'</span></div>';
      });
    });
  });
  h+='<div style="display:flex;gap:6px;padding:12px 13px 14px;flex-wrap:wrap"><button type="button" onclick="vod7Copy(\''+vodEsc(D.code)+'\')" style="border:0;border-radius:10px;padding:8px 12px;font-weight:900;font-size:12px;background:#eff6ff;color:#1d4ed8;cursor:pointer;font-family:inherit">📨 학부모 한 줄 복사</button></div>';
  return h+'</div>';
}
function vod6DateOnlySafe(iso){ try{ return vod6DateOnly(iso); }catch(e){ return vod5When(iso); } }

function vod7Page(){
  var h='<div style="flex:1;overflow:auto;padding:14px">';
  if(VOD_LOGS===null) return h+'<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">시청 기록 불러오는 중…</div></div>';
  var all=vod7Data();
  if(!all.length) return h+'<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">영상을 배정받은 학생이 없어요</div></div>';
  var gs={}, go=[]; all.forEach(function(x){ if(!gs[x.grp]){ gs[x.grp]={ n:0, f:0 }; go.push(x.grp); } gs[x.grp].n++; if(vod7Flag(x)) gs[x.grp].f++; });
  go.sort();
  if(VOD7.grp && !gs[VOD7.grp]) VOD7.grp='';
  var nf=all.filter(vod7Flag).length;
  function chip(on, label, n, f, click, red){ return '<button type="button" onclick="'+click+'" style="border:1.5px solid '+(red&&!on?'#fca5a5':(on?'#0d2240':'#e2e8f0'))+';border-radius:99px;padding:5px 12px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':(red?'#b91c1c':'#0f172a'))+'">'+label+(n!=null?' '+n:'')+(f?'<b style="color:'+(on?'#facc15':'#e8192c')+';margin-left:4px">'+f+'</b>':'')+'</button>'; }
  h+='<div class="vod7-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'+chip(!VOD7.grp,'전체',all.length,nf,'vod7Grp(\'\')');
  go.forEach(function(g){ h+=chip(VOD7.grp===g, vodEsc(g), gs[g].n, gs[g].f, 'vod7Grp(\''+vodEsc(g).replace(/'/g,'\\\'')+'\')'); });
  h+=chip(VOD7.flag,'🚩 챙길 학생만',null,0,'vod7FlagTog()',true)+'</div>';
  var rows=all.filter(function(x){ return (!VOD7.grp||x.grp===VOD7.grp) && (!VOD7.flag||vod7Flag(x)); });
  var base=all.filter(function(x){ return !VOD7.grp||x.grp===VOD7.grp; });
  var avg=base.length?Math.round(base.reduce(function(s,x){ return s+x.pct; },0)/base.length):0;
  var lateV=base.reduce(function(s,x){ return s+x.late; },0), idleN=base.filter(function(x){ return x.idle; }).length, since=Date.now()-7*86400000, wk=0;
  base.forEach(function(x){ x.rows.forEach(function(r){ if(vod5Ms(r.i.last)>=since) wk++; }); });
  function kp(l,v,c){ return '<div style="background:#fff;border-radius:12px;padding:8px 14px;min-width:104px;border:1px solid #e2e8f0"><small style="display:block;color:#64748b;font-weight:700;font-size:11px">'+l+'</small><b style="font-size:20px;'+(c?'color:'+c:'')+'">'+v+'</b></div>'; }
  h+='<div class="vod7-kpi" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'+kp('학생',base.length+'명')+kp('평균 진도',avg+'%')+kp('마감 지난 영상',lateV+'개',lateV?'#b91c1c':'')+kp(VOD7_IDLE_DAYS+'일 넘게 안 봄',idleN+'명',idleN?'#b45309':'')+kp('최근 7일 본 영상',wk+'편')+'</div>';
  var selD=VOD7.sel?all.filter(function(x){ return x.code===VOD7.sel; })[0]:null; if(VOD7.sel && !selD) VOD7.sel='';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start">';
  var th='font-size:11.5px;color:#64748b;text-align:left;font-weight:800;padding:8px;border-bottom:1.5px solid #e2e8f0;white-space:nowrap', td='padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:middle;font-size:12.5px';
  h+='<div style="flex:'+(selD?'1 1 460px':'1 1 100%')+';min-width:0;max-width:100%;background:#fff;border-radius:14px;border:1px solid #e2e8f0;overflow:auto"><table id="vod7-tbl" style="border-collapse:collapse;width:100%">'
    +'<tr><th style="'+th+'">학생</th><th style="'+th+'">진도 (완료/배정)</th><th style="'+th+'">마감 지남</th>'+(selD?'':'<th style="'+th+'">다시 봄</th>')+'<th style="'+th+'">마지막 시청</th><th style="'+th+'">상태</th></tr>';
  if(!rows.length) h+='<tr><td colspan="6" style="'+td+';text-align:center;color:#94a3b8;padding:24px">챙길 학생이 없어요 👍</td></tr>';
  rows.forEach(function(x){
    var on=(x.code===VOD7.sel);
    h+='<tr class="vod7-row" data-code="'+vodEsc(x.code)+'" onclick="vod7Pick(\''+vodEsc(x.code)+'\')" style="cursor:pointer;'+(on?'background:#fffbeb':'')+'">'
      +'<td style="'+td+'"><b style="font-size:13.5px">'+vodEsc(x.s.name||'')+'</b><small style="display:block;color:#64748b;font-weight:700;font-size:11px">'+vodEsc([x.s.grade?String(x.s.grade).replace('학교 ','').replace('학년',''):'', x.grp].filter(Boolean).join(' · '))+'</small></td>'
      +'<td style="'+td+';white-space:nowrap">'+vod7Bar(x.pct)+' <b>'+x.pct+'%</b> <span style="color:#64748b">'+x.done+'/'+x.asg+'</span></td>'
      +'<td style="'+td+'">'+(x.late?'<b style="color:#b91c1c">'+x.late+'</b>':'0')+'</td>'
      +(selD?'':'<td style="'+td+'">'+x.re+'</td>')
      +'<td style="'+td+';white-space:nowrap">'+(x.last?vod5When(x.last):'<span style="color:#94a3b8">없음</span>')+(x.asg>x.done?vod7Ago(x.lm):'')+'</td>'
      +'<td style="'+td+'">'+vod7Badge(x.st)+'</td></tr>';
  });
  h+='</table><div style="padding:8px 10px;font-size:11px;color:#64748b;line-height:1.6">진도 = 폴더 완료 기준(보통 90%)을 넘긴 영상 비율 · 🚩 밀림 = 마감 지난 영상 · 🚩 안 봄 = '+VOD7_IDLE_DAYS+'일 넘게 시청 없음 · ⏩ = 본 시간이 간 지점의 절반도 안 됨(빨리 감기·건너뛰기) · 줄을 누르면 학생 서랍</div></div>';
  if(selD) h+=vod7Drawer(selD);
  return h+'</div></div>';
}

if(typeof vodMonitor==='function'){
  vodMonitor=(function(o){ return function(){
    if(VOD_MON_TAB!=='student') return o.apply(this, arguments);
    var body=''; try{ body=vod7Page(); }catch(e){ console.error(e); body='<div style="padding:20px;color:#b91c1c;font-weight:800">학생별 오류: '+vodEsc(e.message)+'</div>'; }
    return '<div style="height:100%;display:flex;flex-direction:column;overflow:hidden">'+vodMonTabs()+body+'</div>';
  }; })(vodMonitor);
}
if(typeof vodMonTabs==='function'){
  vodMonTabs=(function(o){ return function(){
    var h=o.apply(this, arguments);
    var a=h.indexOf('<button onclick="vodMonSetTab(\'student\')"'), m=h.indexOf('<button onclick="vodMonSetTab(\'map\')"');
    if(a>m && m>=0){ var e=h.indexOf('</button>', a)+9; var st=h.slice(a, e); h=h.slice(0,a)+h.slice(e); h=h.slice(0,m)+st+h.slice(m); }
    return h;
  }; })(vodMonTabs);
}
