/* ═══════════════════════════════════════════════════════════════
 * v19-48: 🧭 스터디 코디 현황판 + 설정 + 플래너 코칭 (학원앱 쪽)
 *   · 현황판: 대상 학생마다 시간표·이번 주 계획·실천·뺀 것·못 넣은 것·코칭, 「도움 필요」(사흘 밀림)
 *   · 설정(codi_settings): 대상 학교·학년 스위치 · 학부모 공개 스위치 — 학생앱 v2-108이 읽는다
 *   · 플래너 AI 분석에 그날 코디 계획을 같이 보내 「계획 대비 실천」(codiCheck)을 받고,
 *     codi_done_<코드>(실천 ✓)와 codi_coach_<코드>(아침 코칭 문장)에 적는다 — 학생앱은 읽기만
 * 학생앱 쪽 규칙: docs/study_codi_contract.md
 * ═══════════════════════════════════════════════════════════════ */
var CD={ loaded:false, loading:false, at:0, fixed:{}, plan:{}, done:{}, goals:{}, coach:{}, settings:null, sel:null, filter:'', edit:false, work:null };
var CD_DEF_TARGETS=['옥길중|중1','옥길중|중2'];
function cdSb(){ return (typeof getSupaClient==='function')?getSupaClient():window.sb; }   /* 학원앱은 전역 sb 가 없다 */
function cdKst(d){ return new Date((d||Date.now())+9*3600000).toISOString().slice(0,10); }
function cdAdd(s,n){ var t=new Date(s+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); }
function cdDow(s){ return (new Date(s+'T00:00:00Z').getUTCDay()+6)%7; }
function cdWeekStart(s){ return cdAdd(s,-cdDow(s)); }
function cdSlot(i){ var m=(14+i)*30, h=Math.floor(m/60); return (h<10?'0':'')+h+':'+(m%60?'30':'00'); }
function cdSchool(st){ return String((st&&st.school)||'').replace(/\s/g,'').replace(/등학교$|학교$/,''); }
function cdGrade(st){ var m=String((st&&st.grade)||'').match(/(초등학교|초|중학교|중|고등학교|고)\s*(\d)/); if(!m) return ''; return ({'초등학교':'초','중학교':'중','고등학교':'고'}[m[1]]||m[1])+m[2]; }
function cdTargets(){ var s=CD.settings; return (s&&Array.isArray(s.targets))?s.targets:CD_DEF_TARGETS.slice(); }
function cdInTarget(st){ var tg=cdTargets(); if(tg.indexOf('*')>=0) return true;   /* v19-59: 「전체 학생」 (원장 결정 2026-09-29) */
  var k=cdSchool(st)+'|'+cdGrade(st); return tg.indexOf(k)>=0; }
window.cdLoad=async function(force){
  if(CD.loading) return; if(CD.loaded&&!force&&Date.now()-CD.at<60000) return; CD.loading=true;
  try{
    var sb=cdSb(); if(!sb) throw new Error('no supabase');
    var r=await sb.from('lumen_store').select('key,value').like('key','codi_%');
    var F={},P={},D={},G={},C={}, S=null;
    (r.data||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } var k=String(row.key||'');
      if(k==='codi_settings') S=v; else if(k.indexOf('codi_fixed_')===0) F[k.slice(11)]=v; else if(k.indexOf('codi_plan_')===0) P[k.slice(10)]=v; else if(k.indexOf('codi_done_')===0) D[k.slice(10)]=v; else if(k.indexOf('codi_goals_')===0) G[k.slice(11)]=v; else if(k.indexOf('codi_coach_')===0) C[k.slice(11)]=v; });
    CD.fixed=F; CD.plan=P; CD.done=D; CD.goals=G; CD.coach=C; CD.settings=S; CD.loaded=true; CD.at=Date.now();
  }catch(e){ console.warn('코디 자료 실패', e); }
  CD.loading=false; if(VIEW==='codi') render();
};
/* 학생 한 명의 이번 주 상태 */
function cdRow(st){
  var code=String(st.lumen_rec_code||''), today=cdKst(), ws=cdWeekStart(today), ti=cdDow(today);
  var fixed=CD.fixed[code]||null, plan=CD.plan[code]||null, done=CD.done[code]||{}, coach=CD.coach[code]||null;
  var cur=(plan&&plan.week===ws)?plan:null; var blocks=cur?(cur.blocks||[]):[];
  function isDone(b){ var day=cdAdd(cur.week,b.d); return !!((done[day]||{})[b.id]); }
  var tot=blocks.length, dn=blocks.filter(isDone).length;
  var todayB=blocks.filter(function(b){ return b.d===ti; }), todayLeft=todayB.filter(function(b){ return !isDone(b); }).length;
  /* 사흘 밀림: 어제부터 거꾸로, 계획이 있던 날이 사흘 연속 0개 실천 (계획을 짠 날 이후만) */
  var miss=0, madeDay=cur?String(cur.made||'').slice(0,10):'';
  for(var k=1;k<=7&&miss<3;k++){ var dd=cdAdd(today,-k); if(dd<ws||(madeDay&&dd<madeDay)) break; var bs=blocks.filter(function(b){ return cdAdd(cur.week,b.d)===dd; }); if(!bs.length) continue; if(bs.some(isDone)) break; miss++; }
  var dropped=(cur&&cur.dropped)||[], overflow=(cur&&cur.overflow)||[];
  var lastAct=''; [fixed,plan,done,CD.goals[code]].forEach(function(v){ var u=v&&v.upd; if(u&&u>lastAct) lastAct=u; });
  var yday=cdAdd(today,-1), cy=coach&&coach.days&&coach.days[yday];
  var status, sev;
  if(!fixed){ status='시작 전'; sev=0; }
  else if(miss>=3){ status='도움 필요'; sev=3; }
  else if(!cur&&ti>=2){ status='계획 없음'; sev=2; }
  else if(overflow.length||dropped.length>=2||(tot>=4&&ti>=3&&dn/tot<0.34)){ status='주의'; sev=1; }
  else { status=tot?'진행 중':'계획 없음'; sev=tot?0:1; }
  return { st:st, code:code, fixed:fixed, cur:cur, blocks:blocks, tot:tot, dn:dn, todayB:todayB.length, todayLeft:todayLeft, miss:miss, dropped:dropped, overflow:overflow, lastAct:lastAct, coachY:cy, status:status, sev:sev, isDone:isDone };
}
window.cdGo=function(){ VIEW='codi'; render(); };
window.cdFilter=function(k){ CD.filter=(CD.filter===k?'':k); render(); };
window.cdPick=function(code){ CD.sel=(CD.sel===code?null:code); render(); };
window.cdEdit=function(on){ CD.edit=!!on; if(on){ var s=CD.settings||{}; CD.work={ targets:cdTargets().slice(), parentOpen:!!s.parentOpen }; } render(); };
window.cdTgl=function(k){ if(!CD.work) return; var i=CD.work.targets.indexOf(k); if(i>=0) CD.work.targets.splice(i,1); else CD.work.targets.push(k); render(); };
window.cdParent=function(){ if(!CD.work) return; CD.work.parentOpen=!CD.work.parentOpen; render(); };
window.cdSaveSettings=async function(){
  if(!CD.work) return; var v={ on:true, targets:CD.work.targets.slice(), parentOpen:!!CD.work.parentOpen, upd:new Date().toISOString() };
  try{ var sb=cdSb(); var r=await sb.from('lumen_store').upsert({ key:'codi_settings', value:v, updated_at:v.upd },{ onConflict:'key' }); if(r&&r.error) throw r.error; CD.settings=v; CD.edit=false; CD.work=null; try{ plToast('🧭 코디 설정 저장 — 학생앱에 바로 반영'); }catch(e){ alert('저장됨'); } }
  catch(e){ alert('저장 실패: '+(e.message||e)); }
  render();
};
function cdSchoolGradeKeys(){
  var keys={}, order=[]; (typeof getSortedStudents==='function'?getSortedStudents():students).forEach(function(s){ if(!s||s.withdrawn||!s.lumen_rec_code) return; var sc=cdSchool(s), g=cdGrade(s); if(!sc||!g) return; var k=sc+'|'+g; if(!keys[k]){ keys[k]=0; order.push(k); } keys[k]++; });
  order.sort(); return { keys:keys, order:order };
}
function rCodi(){
  if(!CD.loaded) cdLoad();
  var today=cdKst(), ws=cdWeekStart(today);
  var stus=(typeof getSortedStudents==='function'?getSortedStudents():students).filter(function(s){ return s&&s.lumen_rec_code&&!s.withdrawn&&cdInTarget(s); });
  var rows=stus.map(cdRow); rows.sort(function(a,b){ return b.sev-a.sev || (b.miss-a.miss) || String(a.st.name).localeCompare(String(b.st.name)); });
  var counts={ all:rows.length, fixed:rows.filter(function(r){ return r.fixed; }).length, plan:rows.filter(function(r){ return r.cur; }).length, help:rows.filter(function(r){ return r.sev===3; }).length, warn:rows.filter(function(r){ return r.sev===1||r.sev===2; }).length };
  var shown=rows.filter(function(r){ if(CD.filter==='help') return r.sev===3; if(CD.filter==='warn') return r.sev===1||r.sev===2; if(CD.filter==='none') return !r.fixed; return true; });
  var h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:21px;font-weight:900;color:#0d2240;letter-spacing:-.02em">🧭 스터디 코디</div>'
    +'<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:2px">학생이 고정 시간표를 넣으면 빈 시간에 이번 주 수학 계획을 코디가 짜 주고, 저녁 플래너 사진으로 실천을 확인합니다 — 이 화면은 학생별 상태와 설정</div></div>'
    +'<div style="margin-left:auto;display:flex;gap:6px;align-items:center"><span style="font-size:11px;color:#94a3b8;font-weight:700">'+(CD.loaded?('이번 주 '+ws.slice(5).replace('-','/')+'~ · 오늘 '+today.slice(5).replace('-','/')):'🔄 불러오는 중')+'</span><button onclick="cdLoad(true)" style="font-family:inherit;font-size:11.5px;font-weight:800;padding:6px 10px;border-radius:8px;border:1.5px solid #e6eaf1;background:#fff;cursor:pointer">새로고침</button></div></div>';
  /* 설정 */
  var s=CD.settings||{}; var tg=cdTargets(); var sg=cdSchoolGradeKeys();
  h+='<div style="background:#fff;border:1.5px solid #e6eaf1;border-radius:14px;padding:12px 14px;margin-bottom:12px">';
  if(!CD.edit){
    h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><b style="font-size:13px;color:#0d2240">대상</b>'+(tg.length?tg.map(function(k){ return '<span style="font-size:12px;font-weight:800;background:#0d2240;color:#fff;border-radius:20px;padding:4px 10px">'+(k==='*'?'🌐 전체 학생':esc2(k.replace('|',' ')))+'</span>'; }).join(''):'<span style="color:#94a3b8;font-size:12px">없음</span>')
      +'<span style="width:1px;background:#dbe2ec;height:18px;margin:0 4px"></span><b style="font-size:13px;color:#0d2240">학부모 공개</b><span style="font-size:12px;font-weight:800;color:'+(s.parentOpen?'#15803d':'#94a3b8')+'">'+(s.parentOpen?'켬 (학부모앱 다음 판부터 보임)':'끔')+'</span>'
      +'<button onclick="cdEdit(true)" style="margin-left:auto;font-family:inherit;font-size:12px;font-weight:800;padding:6px 12px;border-radius:8px;border:1.5px solid #0d2240;background:#fff;color:#0d2240;cursor:pointer">설정 바꾸기</button></div>';
  } else {
    var w=CD.work||{ targets:[], parentOpen:false };
    h+='<div style="font-size:12px;font-weight:800;color:#64748b;margin-bottom:6px">대상 학교·학년 (등록부 기준 · 괄호는 학생 수) — 켜면 그 학생들 홈에 코디 카드가 보입니다</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
      +(function(){ var on=w.targets.indexOf('*')>=0; return '<button onclick="cdTgl(\'*\')" style="font-family:inherit;font-size:12px;font-weight:900;padding:6px 12px;border-radius:20px;cursor:pointer;border:1.5px solid '+(on?'#15803d':'#e6eaf1')+';background:'+(on?'#15803d':'#fff')+';color:'+(on?'#fff':'#15803d')+'">🌐 전체 학생'+(on?' ✓ (새 학생도 자동)':'')+'</button>'; })()
      +sg.order.map(function(k){ var on=w.targets.indexOf(k)>=0||w.targets.indexOf('*')>=0; return '<button onclick="cdTgl(\''+k+'\')" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px 11px;border-radius:20px;cursor:pointer;border:1.5px solid '+(on?'#0d2240':'#e6eaf1')+';background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':'#475569')+'">'+esc2(k.replace('|',' '))+' ('+sg.keys[k]+')</button>'; }).join('')+'</div>'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><button onclick="cdParent()" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px 11px;border-radius:20px;cursor:pointer;border:1.5px solid '+(w.parentOpen?'#15803d':'#e6eaf1')+';background:'+(w.parentOpen?'#dcfce7':'#fff')+';color:'+(w.parentOpen?'#15803d':'#475569')+'">'+(w.parentOpen?'✅ 학부모 공개 켬':'학부모 공개 끔')+'</button><span style="font-size:11px;color:#94a3b8;font-weight:700">학부모앱에 「이번 주 계획·실천」이 보이게 하는 스위치 (학부모앱 다음 판에서 읽음)</span>'
      +'<span style="margin-left:auto"></span><button onclick="cdEdit(false)" style="font-family:inherit;font-size:12px;font-weight:800;padding:7px 12px;border-radius:8px;border:1.5px solid #e6eaf1;background:#fff;cursor:pointer">취소</button><button onclick="cdSaveSettings()" style="font-family:inherit;font-size:12px;font-weight:900;padding:7px 14px;border-radius:8px;border:none;background:#0d2240;color:#fff;cursor:pointer">저장</button></div>';
  }
  h+='</div>';
  /* 요약 + 필터 */
  var tiles=[['all','대상 학생',counts.all,'#0d2240'],['none','시간표 아직',counts.all-counts.fixed,'#64748b'],['plan','이번 주 계획 있음',counts.plan,'#1d4ed8'],['warn','주의',counts.warn,'#b45309'],['help','도움 필요',counts.help,'#dc2626']];
  h+='<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">'+tiles.map(function(t){ var on=CD.filter===t[0]; var click=(t[0]==='all'||t[0]==='plan')?'cdFilter(\'\')':'cdFilter(\''+t[0]+'\')'; return '<div onclick="'+click+'" style="cursor:pointer;background:'+(on?'#0d2240':'#fff')+';border:1.5px solid '+(on?'#0d2240':'#e6eaf1')+';border-radius:12px;padding:10px 12px"><div style="font-size:11px;font-weight:800;color:'+(on?'#cfdbee':'#64748b')+'">'+t[1]+'</div><div style="font-size:22px;font-weight:900;color:'+(on?'#fff':t[3])+'">'+t[2]+'</div></div>'; }).join('')+'</div>';
  if(!rows.length) h+='<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:24px;text-align:center;color:#64748b;font-weight:800">대상 학생이 없습니다 — 위 「설정 바꾸기」에서 학교·학년을 켜 주세요</div>';
  /* 표 */
  h+='<div style="background:#fff;border:1.5px solid #e6eaf1;border-radius:14px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><thead><tr style="background:#f8fafc;color:#64748b;font-size:11px">'
    +'<th style="text-align:left;padding:9px 12px">학생</th><th style="padding:9px 6px">시간표</th><th style="padding:9px 6px">이번 주 계획</th><th style="padding:9px 6px;min-width:140px">실천</th><th style="padding:9px 6px">오늘</th><th style="padding:9px 6px">뺀 것</th><th style="padding:9px 6px">못 넣음</th><th style="text-align:left;padding:9px 8px">어제 코칭</th><th style="padding:9px 8px">상태</th></tr></thead><tbody>';
  shown.forEach(function(r){ var s2=r.st; var sel=CD.sel===r.code; var pct=r.tot?Math.round(r.dn/r.tot*100):0; var col=r.sev===3?'#dc2626':(r.sev>=1?'#b45309':(r.tot?'#15803d':'#94a3b8'));
    h+='<tr onclick="cdPick(\''+esc2(r.code)+'\')" style="cursor:pointer;border-top:1px solid #f1f5f9;background:'+(sel?'#eff6ff':'#fff')+'">'
      +'<td style="padding:9px 12px"><b style="color:#0d2240">'+esc2(s2.name)+'</b><div style="font-size:10.5px;color:#94a3b8;font-weight:700">'+esc2(cdSchool(s2)+' '+cdGrade(s2)+' · '+(s2.group||'미배정'))+'</div></td>'
      +'<td style="text-align:center">'+(r.fixed?'<span style="color:#15803d;font-weight:900">✓</span>':'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td style="text-align:center;font-weight:800">'+(r.cur?(r.tot+'칸'):'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td style="padding:6px 8px">'+(r.tot?('<div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden"><div style="width:'+pct+'%;height:8px;background:'+(pct>=67?'#15803d':(pct>=34?'#f59e0b':'#dc2626'))+'"></div></div><span style="font-size:11px;font-weight:800;color:#334155;white-space:nowrap">'+r.dn+'/'+r.tot+'</span></div>'):'')+'</td>'
      +'<td style="text-align:center;font-size:11.5px;font-weight:800;color:'+(r.todayLeft?'#b45309':'#64748b')+'">'+(r.todayB?(r.todayLeft?(r.todayLeft+'개 남음'):'다 함'):'—')+'</td>'
      +'<td style="text-align:center;font-weight:800;color:'+(r.dropped.length?'#b45309':'#cbd5e1')+'">'+(r.dropped.length||'—')+'</td>'
      +'<td style="text-align:center;font-weight:800;color:'+(r.overflow.length?'#dc2626':'#cbd5e1')+'">'+(r.overflow.length||'—')+'</td>'
      +'<td style="padding:6px 8px;font-size:11px;color:#475569;max-width:260px">'+(r.coachY?esc2(r.coachY.msg||'').slice(0,60):'<span style="color:#cbd5e1">—</span>')+'</td>'
      +'<td style="text-align:center"><span style="font-size:11px;font-weight:900;color:'+col+';background:'+(r.sev===3?'#fef2f2':(r.sev>=1?'#fffbeb':'#f8fafc'))+';border-radius:20px;padding:3px 9px;white-space:nowrap">'+esc2(r.status)+(r.miss>=3?' · '+r.miss+'일':'')+'</span></td></tr>';
    if(sel) h+='<tr><td colspan="9" style="padding:0 12px 12px;background:#eff6ff">'+cdDetail(r)+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div style="font-size:11px;color:#94a3b8;font-weight:700;margin-top:10px;line-height:1.6">「도움 필요」= 계획이 있던 날이 사흘 연속 실천 0 · 「계획 없음」= 시간표는 있는데 수요일이 지나도록 이번 주 계획을 안 짬 · 「주의」= 빈 시간이 모자라 못 넣은 것이 있거나, 뺀 것이 2개 이상이거나, 목요일 이후 실천이 1/3 미만. 실천 ✓는 학생이 누른 것 + 플래너 사진에서 ○로 읽힌 것 + 그날 매쓰플랫 채점.</div>';
  return h+'</div>';
}
function cdDetail(r){
  var DOW=['월','화','수','목','금','토','일']; var cur=r.cur, code=r.code, today=cdKst();
  var h='<div style="background:#fff;border:1.5px solid #bfdbfe;border-radius:12px;padding:12px 14px">';
  h+='<div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11.5px;color:#475569;font-weight:700;margin-bottom:8px">'
    +'<span>고정 시간: '+(r.fixed?esc2((r.fixed.blocks||[]).map(function(b){ return b.label+' '+(b.days||[]).map(function(d){ return DOW[d]; }).join('')+' '+b.start+'~'+b.end; }).join(' · ')||'학교만'):'아직 없음')+'</span>'
    +(r.fixed&&r.fixed.rules?'<span>규칙: 밤 '+esc2(r.fixed.rules.night||'22:00')+' 이후 제외'+(r.fixed.rules.sunday!==false?' · 일요일 밀린 것만':'')+'</span>':'')
    +'<span>마지막 활동: '+(r.lastAct?esc2(r.lastAct.slice(0,16).replace('T',' ')):'—')+'</span></div>';
  if(!cur){ h+='<div style="color:#94a3b8;font-weight:800;font-size:12px">이번 주 계획이 없습니다'+(r.fixed?' — 학생이 코디 화면을 열면 자동으로 짜집니다':'')+'</div>'; }
  else {
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
    for(var d=0; d<7; d++){ var day=cdAdd(cur.week,d); var bs=(cur.blocks||[]).filter(function(b){ return b.d===d; });
      h+='<div style="background:'+(day===today?'#fffbeb':'#f8fafc')+';border:1px solid '+(day===today?'#fde68a':'#e6eaf1')+';border-radius:10px;padding:6px 7px;min-height:60px"><div style="font-size:11px;font-weight:900;color:#0d2240;margin-bottom:4px">'+DOW[d]+' '+day.slice(5).replace('-','/')+(day===today?' 오늘':'')+'</div>';
      if(!bs.length) h+='<div style="font-size:10.5px;color:#cbd5e1;font-weight:700">—</div>';
      bs.forEach(function(b){ var ok=r.isDone(b); var past=day<today; h+='<div style="font-size:10.5px;font-weight:800;color:'+(ok?'#15803d':(past?'#dc2626':'#334155'))+';margin:2px 0;line-height:1.35">'+(ok?'✓ ':(past?'✗ ':'· '))+esc2(cdSlot(b.s))+' '+esc2((b.item||{}).title||'')+(b.part?' <span style="color:#94a3b8">'+b.part+'</span>':'')+'</div>'; });
      h+='</div>'; }
    h+='</div>';
    if(r.overflow.length) h+='<div style="margin-top:8px;font-size:12px;color:#dc2626;font-weight:800">빈 시간이 모자라 못 넣은 것: '+esc2(r.overflow.join(', '))+' — 시간표를 같이 봐 주세요</div>';
    if(r.dropped.length) h+='<div style="margin-top:6px;font-size:12px;color:#b45309;font-weight:800">학생이 뺀 것: '+r.dropped.map(function(x){ return esc2(x.title)+'('+String(x.at||'').slice(5,10)+')'; }).join(' · ')+'</div>';
  }
  var g=CD.goals[code]; if(g&&g.items&&g.items.length) h+='<div style="margin-top:6px;font-size:12px;color:#475569;font-weight:700">다른 과목 목표: '+g.items.map(function(x){ return esc2((x.subj||'')+' '+x.title); }).join(' · ')+'</div>';
  var c=CD.coach[code]; if(c&&c.days){ var days=Object.keys(c.days).sort().slice(-5).reverse(); if(days.length) h+='<div style="margin-top:8px;border-top:1px dashed #e6eaf1;padding-top:8px"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:4px">플래너 사진으로 확인한 실천 (최근)</div>'+days.map(function(dd){ var x=c.days[dd]; return '<div style="font-size:11.5px;color:#334155;margin:2px 0"><b>'+dd.slice(5).replace('-','/')+'</b> '+x.done+'/'+x.planned+' · '+esc2(x.msg||'')+'</div>'; }).join('')+'</div>'; }
  return h+'</div>';
}
/* ── 플래너 AI 연동 ── */
async function cdPlanFor(code, day){
  var p=CD.plan[code]; if(!p||p.week!==cdWeekStart(day)){ try{ var sb=cdSb(); var r=await sb.from('lumen_store').select('value').eq('key','codi_plan_'+code); var v=(r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } if(v){ CD.plan[code]=v; p=v; } }catch(e){} }
  if(!p||p.week!==cdWeekStart(day)) return [];
  var d=cdDow(day); return (p.blocks||[]).filter(function(b){ return b.d===d; });
}
function cdIso(s){ var m=String(s||'').match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/); return m?(m[1]+'-'+m[2]+'-'+m[3]):''; }
/* 분석 프롬프트에 붙일 줄 — 그날 코디 계획이 있을 때만 */
window.cdPromptLines=async function(stInfo, expectedDate){
  var code=String((stInfo&&stInfo.lumen_rec_code)||''); var day=cdIso(expectedDate); if(!code||!day) return [];
  var bs=await cdPlanFor(code, day); if(!bs.length) return [];
  var titles=[]; bs.forEach(function(b){ var t=(b.item||{}).title||''; if(t&&titles.indexOf(t)<0) titles.push(t); });
  return ['', '━━━━━━━━━━━━━━━━━━━━━━━━━', '【 스터디 코디 계획 대조 (추가) 】', '━━━━━━━━━━━━━━━━━━━━━━━━━', '',
    '이 학생이 이 날(' + day + ') 앱에서 세운 수학 계획은 다음과 같습니다:'].concat(titles.map(function(t,i){ return '  ' + (i+1) + '. ' + t; })).concat(['',
    '당일 플래너의 TASKS 전사와 대조해서, 각 계획 항목이 완료(O 또는 △) 표시된 줄과 «내용이 같거나 비슷하면» done=true, 아니면 false 로 판단하세요.',
    '(예: 계획 "쎈 중1 53~57쪽" ↔ TASKS "[O] 쎈 53-57" 은 같은 것입니다. 쪽수가 조금 달라도 같은 교재면 같은 것으로 봅니다.)',
    '출력 JSON에 다음 키를 «추가»하세요 (계획 항목 이름은 위 목록의 글자 그대로):',
    '  "codiCheck": [' + titles.map(function(t){ return '{"title": "' + t.replace(/"/g,'') + '", "done": true 또는 false}'; }).join(', ') + ']']);
};
/* 분석 결과 → codi_done(실천 ✓) + codi_coach(아침 코칭 문장) */
window.cdCoachSave=async function(stInfo, analysis, expectedDate){
  var code=String((stInfo&&stInfo.lumen_rec_code)||''); if(!code||!analysis) return;
  var day=cdIso(analysis.date)||cdIso(expectedDate); if(!day) return;
  var bs=await cdPlanFor(code, day); if(!bs.length) return;
  var chk={}; (analysis.codiCheck||[]).forEach(function(x){ if(x&&x.title) chk[String(x.title).replace(/\s/g,'')]=!!x.done; });
  /* codiCheck 가 없으면 전사에서 대충 맞춘다: 완료 줄에 교재 이름 앞 네 글자나 「오답」「학습지」「아하」가 들어 있으면 */
  var doneLines=(analysis.tasksTranscript||[]).filter(function(l){ return /^\s*\[(O|△|V|✓|✔)\]/i.test(String(l)); }).map(function(l){ return String(l).replace(/\s/g,''); });
  var items=[], dn=0;
  bs.forEach(function(b){ var t=(b.item||{}).title||''; var k=t.replace(/\s/g,''); var ok;
    if(chk[k]!==undefined) ok=chk[k];
    else { var key=k.replace(/^학습지/,'').replace(/^오답.*/,'오답').replace(/^아하노트.*/,'아하').replace(/\d+~\d+쪽.*$/,'').slice(0,4); ok=!!key&&doneLines.some(function(l){ return l.indexOf(key)>=0; }); }
    items.push({ id:b.id, title:t, ok:!!ok }); if(ok) dn++; });
  var planned=items.length; var missed=items.filter(function(x){ return !x.ok; }).map(function(x){ return x.title; });
  var msg; if(!planned) return;
  if(dn===planned) msg='어제 계획 '+planned+'개를 플래너에 다 ○로 적었어. 멋져!';
  else if(dn===0) msg='어제 계획 '+planned+'개가 플래너에 ○로 안 보였어. 오늘은 「'+missed[0]+'」 한 칸만이라도 꼭!';
  else msg='어제 '+planned+'개 중 '+dn+'개 했어. 못 한 「'+missed[0]+'」'+(missed.length>1?' 등 '+missed.length+'개':'')+'는 오늘 빈 칸에 다시 해 보자.';
  var now=new Date().toISOString();
  try{
    var sb=cdSb(); if(!sb) throw new Error('no supabase');
    /* 실천 ✓ */
    var r=await sb.from('lumen_store').select('value').eq('key','codi_done_'+code); var dv=(r.data&&r.data[0])?r.data[0].value:null; if(typeof dv==='string'){ try{ dv=JSON.parse(dv); }catch(e){ dv=null; } } dv=dv||{}; dv[day]=dv[day]||{};
    items.forEach(function(x){ if(x.ok&&!dv[day][x.id]) dv[day][x.id]={ at:now, auto:true, src:'planner' }; }); dv.upd=now;
    await sb.from('lumen_store').upsert({ key:'codi_done_'+code, value:dv, updated_at:now },{ onConflict:'key' }); CD.done[code]=dv;
    /* 코칭 */
    var r2=await sb.from('lumen_store').select('value').eq('key','codi_coach_'+code); var cv=(r2.data&&r2.data[0])?r2.data[0].value:null; if(typeof cv==='string'){ try{ cv=JSON.parse(cv); }catch(e){ cv=null; } } cv=cv||{ days:{} }; cv.days=cv.days||{};
    cv.days[day]={ planned:planned, done:dn, items:items, msg:msg, rate:(analysis.practiceRate||''), at:now }; cv.upd=now;
    var ks=Object.keys(cv.days).sort(); while(ks.length>60){ delete cv.days[ks.shift()]; }
    await sb.from('lumen_store').upsert({ key:'codi_coach_'+code, value:cv, updated_at:now },{ onConflict:'key' }); CD.coach[code]=cv;
    analysis.codiCoach={ planned:planned, done:dn, msg:msg };
  }catch(e){ console.warn('코디 코칭 저장 실패', e); }
};
