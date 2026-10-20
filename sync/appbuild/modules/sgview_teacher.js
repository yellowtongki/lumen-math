/* ═══════════════════════════════════════════════════════════════════
 * v19-89: 📔 순공피드백 화면 다시 짜기 (2026-10-07 원장 「순공피드백 점수가 몇점인가? 1-2달치만 보이면 좋겠다. 화면이 효율적이지가 않다」)
 *   · 칸 = 그 주 순공피드백 점수(0~4)를 크게 — 아래 작게 📸사진·📔종이 점수와 순공시간
 *   · 기간 = 이번 달 · 지난 달 · 2달 (주는 일요일이 든 달로 센다 — 랭킹과 같다)
 *   · 오른쪽 합계 = 보이는 기간의 순공 점수 / 만점 (발표된 주만)
 *   · 줄을 얇게, 「2주 연속 미제출」 딱지·전주 대비·목표 칸은 뺐다(목표는 칸을 눌러 창에서)
 *   점수 계산은 plwScore(주간 점수판과 같은 계산) 그대로. 칸을 누르면 v19-86 창(사진 대조·주 옮기기·점수 고치기).
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var SGV = { range:'2', sort:'group' };
function sgvYM(off){ var d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+off); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
/* 그 달의 주(월요일) — 일요일이 그 달에 드는 주 */
function sgvMonthWeeks(ym){
  var out=[], W=PW.mon(ym+'-01');
  for(var i=0;i<7;i++){ var sun=PW.add(W,6), m=sun.slice(0,7); if(m>ym) break; if(m===ym) out.push(W); W=PW.add(W,7); }
  return out;
}
function sgvMonths(){ var c=sgvYM(0), p=sgvYM(-1); return SGV.range==='this'?[c]:(SGV.range==='last'?[p]:[p,c]); }
window.sgvSet=function(k,v){ SGV[k]=v; render(); };
function sgvCell(code, W){
  var e=sgOf(code,W), go='onclick="sgOpen(\''+esc2(code)+'\',\''+W+'\')"', tm=e?sgFmt(sgTotal(e)):'';
  var td='<td '+go+' style="padding:3px 2px;border-bottom:1px solid #f1f5f9;text-align:center;cursor:pointer;min-width:62px">';
  if(W<PW.W0){
    return td+(e?'<span style="font-size:11px;font-weight:800;color:#64748b">'+tm+'</span><div style="font-size:9px;color:#cbd5e1;font-weight:700">점수 전</div>':'<span style="color:#e2e8f0">·</span>')+'</td>';
  }
  var s=sgsScore(code,W);
  if(!s) return td+'<span style="color:#cbd5e1">…</span></td>';
  var pts=s.photoPt+s.paperPt, rel=s.released;
  var small='<div style="font-size:9.5px;font-weight:800;color:#94a3b8;white-space:nowrap;line-height:1.3">'
    +(s.photo!=='none'?'<span style="color:'+(s.photo==='ok'?'#15803d':'#b45309')+'">📸'+s.photoPt+(s.photoOv?'✋':'')+'</span> ':'')
    +(s.paper!=='none'?'<span style="color:'+(s.paper==='ok'?'#15803d':'#b45309')+'">📔'+s.paperPt+'</span> ':'')
    +(tm?tm:'')+(e&&e.moved?' ↪':'')+'</div>';
  if(!rel){
    if(!e&&s.paper==='none') return td+'<span style="color:#e2e8f0">·</span></td>';
    return td+'<span style="display:inline-block;border:1.5px dashed #a78bfa;color:#7c3aed;border-radius:7px;padding:1px 7px;font-size:11px;font-weight:900">'+(e?'제출 ✓':'·')+'</span>'+small+'</td>';
  }
  var bg=pts>=PW.MAX.sg?'#7c3aed':(pts>=PW.MAX.sg/2?'#a78bfa':(pts>0?'#ddd6fe':'#fee2e2')), fg=pts>=PW.MAX.sg/2?'#fff':(pts>0?'#5b21b6':'#dc2626');
  return td+'<span style="display:inline-block;min-width:24px;background:'+bg+';color:'+fg+';border-radius:7px;padding:2px 6px;font-size:13px;font-weight:900">'+pts+'</span>'+(pts||e?small:'')+'</td>';
}
function rSungong(){
  if(!SG.kicked){ SG.kicked=true; setTimeout(function(){ sgLoad().then(function(){ render(); }); },0); }
  var chip=function(on,label,js){ return '<span onclick="'+js+'" style="cursor:pointer;border:1.5px solid '+(on?'#5b21b6':'#e2e8f0')+';background:'+(on?'#5b21b6':'#fff')+';color:'+(on?'#fff':'#64748b')+';border-radius:50px;padding:4px 12px;font-size:12px;font-weight:900;user-select:none;white-space:nowrap">'+label+'</span>'; };
  var cm=sgvYM(0), pm=sgvYM(-1), mLbl=function(ym){ return (+ym.slice(5))+'월'; };
  var h='<div style="padding:14px 20px 40px;max-width:1500px">';
  h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px">';
  h+='<div style="font-size:19px;font-weight:900;color:#0d2240;margin-right:6px">📔 순공피드백 점수</div>';
  h+=chip(SGV.range==='last',mLbl(pm),"sgvSet('range','last')")+chip(SGV.range==='this',mLbl(cm),"sgvSet('range','this')")+chip(SGV.range==='2',mLbl(pm)+'+'+mLbl(cm),"sgvSet('range','2')");
  h+='<span style="width:8px"></span>'+chip(SGV.sort==='group','반 순',"sgvSet('sort','group')")+chip(SGV.sort==='score','점수 높은 순',"sgvSet('sort','score')")+chip(SGV.sort==='low','점수 낮은 순',"sgvSet('sort','low')");
  h+='<button onclick="sgReload()" style="margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#475569;font-family:inherit;font-size:12px;font-weight:800;padding:5px 12px;border-radius:9px;cursor:pointer">'+(SG.busy?'🔄 불러오는 중…':'🔄 새로고침')+'</button></div>';
  h+='<div style="font-size:11.5px;color:#7c3aed;font-weight:800;margin-bottom:10px">한 주 '+PW.MAX.sg+'점 = 📸 사진(일요일 24시까지 '+PW.PT.photo.ok+' · 월요일 '+PW.PT.photo.late+') + 📔 종이(다음 주 첫 수업까지 '+PW.PT.paper.ok+' · 그 주 안 '+PW.PT.paper.late+') · 칸은 종이에 적힌 주 · 일요일 밤 발표 · 칸을 누르면 사진 대조·주 옮기기·점수 고치기·종이 가져옴</div>';
  if(!SG.loaded||!sgsReady()){ h+='<div style="padding:50px;text-align:center;color:#94a3b8;font-weight:800;font-size:14px">🔄 불러오는 중…</div></div>'; return h; }

  var thisW=PW.thisMon(), weeks=[]; sgvMonths().forEach(function(ym){ sgvMonthWeeks(ym).forEach(function(W){ if(W<=thisW) weeks.push({W:W,ym:ym}); }); });   /* 앞으로 올 주는 안 보인다 */
  var rel=weeks.filter(function(x){ return x.W>=PW.W0&&Date.now()>=PW.dueMs(x.W); }), maxPt=rel.length*PW.MAX.sg;
  var list=getSortedStudents().filter(function(st){ return !st.withdrawn&&st.lumen_rec_code; });
  var rows=list.map(function(st){ var c=String(st.lumen_rec_code), tot=0, by={};
    rel.forEach(function(x){ var s=sgsScore(c,x.W); var p=s?(s.photoPt+s.paperPt):0; tot+=p; by[x.ym]=(by[x.ym]||0)+p; });
    return { st:st, code:c, tot:tot, by:by }; });
  if(SGV.sort==='score') rows.sort(function(a,b){ return b.tot-a.tot; });
  if(SGV.sort==='low') rows.sort(function(a,b){ return a.tot-b.tot; });

  /* 요약 */
  var sw=plwDefaultW(), nP=0, nPa=0, nCur=0, curW=PW.thisMon();
  rows.forEach(function(r){ var s=sgsScore(r.code,sw); if(s&&s.photo!=='none') nP++; if(s&&s.paper!=='none') nPa++; if(sgOf(r.code,curW)) nCur++; });
  var avg=rows.length?(rows.reduce(function(a,r){ return a+r.tot; },0)/rows.length):0;
  var tile=function(k,v,c){ return '<div style="background:#fff;border:1px solid #ede9fe;border-radius:11px;padding:7px 13px"><span style="font-size:11px;color:#8a92a0;font-weight:800">'+k+'</span> <b style="font-size:15px;color:'+c+'">'+v+'</b></div>'; };
  h+='<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
    +tile('점수 주 '+sgsLbl(sw)+' · 사진', nP+'명','#5b21b6')+tile('종이', nPa+'명','#5b21b6')
    +tile('이번 주('+PW.md(curW)+'~) 벌써 낸', nCur+' / '+rows.length+'명','#0d2240')
    +tile('평균 순공 점수', (maxPt?(avg.toFixed(1)+' / '+maxPt):'발표 전'),'#7c3aed')+'</div>';

  /* 표 */
  h+='<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:6px 10px;overflow-x:auto">';
  h+='<table style="width:100%;border-collapse:collapse;font-size:12.5px">';
  h+='<tr><th style="text-align:left;font-size:11px;color:#8a92a0;padding:6px 8px;border-bottom:1.5px solid #eef2f8;white-space:nowrap">학생</th>';
  weeks.forEach(function(x){
    var isSw=(x.W===sw), isCur=(x.W===curW);
    h+='<th style="font-size:10.5px;color:'+(isSw?'#7c3aed':(isCur?'#0d2240':'#8a92a0'))+';padding:5px 2px;border-bottom:1.5px solid #eef2f8;text-align:center;white-space:nowrap;font-weight:'+(isSw||isCur?'900':'700')+(isSw?';background:#f5f3ff':'')+'">'
      +PW.md(x.W)+'~'+PW.md(PW.add(x.W,6)).replace(/^\d+\//,'')+'<br><span style="font-size:9px">'+(isSw?'점수 주':(isCur?'이번 주':(x.W<PW.W0?'점수 전':mLbl(x.ym))))+'</span></th>';
  });
  var mons=sgvMonths().filter(function(ym){ return rel.some(function(x){ return x.ym===ym; }); });   /* 점수 낸 주가 있는 달만 */
  mons.forEach(function(ym){ var n=rel.filter(function(x){ return x.ym===ym; }).length; h+='<th style="font-size:11px;color:#5b21b6;padding:5px 8px;border-bottom:1.5px solid #eef2f8;text-align:center;white-space:nowrap;background:#faf5ff">'+mLbl(ym)+'<br><span style="font-size:9px;color:#94a3b8">/'+(n*PW.MAX.sg)+'</span></th>'; });
  h+='</tr>';
  var lastGrp=null;
  rows.forEach(function(r){
    var st=r.st, grp=st.group||'';
    if(SGV.sort==='group'&&grp!==lastGrp){ lastGrp=grp; h+='<tr><td colspan="'+(1+weeks.length+mons.length)+'" style="padding:6px 8px 2px;font-size:10.5px;font-weight:900;color:#7c3aed">'+esc2(grp||'반 없음')+'</td></tr>'; }
    h+='<tr>';
    h+='<td style="padding:3px 8px;border-bottom:1px solid #f1f5f9;white-space:nowrap"><b style="font-size:13px;color:#0d2240">'+esc2(st.name)+'</b> <span style="color:#94a3b8;font-size:10px;font-weight:800">'+esc2((st.grade||'').replace(/학교|학년/g,'').replace(/\s/g,''))+(SGV.sort!=='group'&&st.group?' · '+esc2(st.group):'')+'</span></td>';
    weeks.forEach(function(x){ h+=sgvCell(r.code, x.W); });
    mons.forEach(function(ym){ var n=rel.filter(function(x){ return x.ym===ym; }).length, v=r.by[ym]||0;
      h+='<td style="padding:3px 8px;border-bottom:1px solid #f1f5f9;text-align:center;background:#faf5ff;white-space:nowrap">'+(n?'<b style="font-size:14px;color:'+(v?'#5b21b6':'#dc2626')+'">'+v+'</b><span style="font-size:10px;color:#94a3b8;font-weight:800">/'+(n*PW.MAX.sg)+'</span>':'<span style="color:#cbd5e1;font-size:11px">—</span>')+'</td>'; });
    h+='</tr>';
  });
  h+='</table></div>';
  h+=sgPopup();
  h+='</div>';
  return h;
}
/* 목표 시간은 칸을 누른 창에서 */
(function(){
  if(typeof sgsPopActions!=='function') return; var o=sgsPopActions;
  sgsPopActions=function(code, mon){ var st=sgsStu(code), g=SG.goals[code]||0;
    return o(code, mon)+'<div style="display:flex;align-items:center;gap:7px;margin:-4px 0 12px;font-size:12px;font-weight:800;color:#475569">🎯 주간 목표 순공시간 <b style="color:#0d2240">'+(g?sgFmt(g):'없음')+'</b>'
      +'<button onclick="sgSetGoal(\''+esc2(code)+'\',\''+esc2(String((st&&st.name)||'')).replace(/'/g,'')+'\')" style="border:1px dashed #cbd5e1;background:#fff;color:#475569;font-family:inherit;font-size:11.5px;font-weight:900;padding:3px 10px;border-radius:7px;cursor:pointer">설정</button></div>'; };
})();
