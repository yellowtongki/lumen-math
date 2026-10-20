/* ═══════════════════════════════════════════════════════════════════
 * v19-46: 📅 학원 달력 — 학교별 시험 D-day 한눈에 + 월 보기 + 학원 일정 입력 (원장 요청 2026-09-25, 시안 https://claude.ai/artifact/EeAGJawrgJkTWXxVRQGqFp 1·2번)
 *   읽는 것: school_calendar(나이스 시험 기간) · exam_track.ddays(손으로 적은 디데이) · race_season · or_studentdb(어느 학교 학생이 있나)
 *   쓰는 것: lumen_events  { items:[{ id, kind:'off'|'event'|'prep'|'test'|'notice', title, from, to, time, repeat:'weekly'|'', days:[요일], target:{ schools:[], grades:[], groups:[] }, pub:true }], upd }
 *            — 학원앱만 쓴다. 학생앱(v2-105 내 달력)은 pub:true 인 것만 읽는다. 학생앱은 이 키를 쓰지 않는다.
 *   공휴일은 앱 안의 표. 반 수업은 여기서 그리지 않는다(출결 화면이 맡는다).
 * ═══════════════════════════════════════════════════════════════════ */
var CT={ y:0, m:0, loaded:false, loading:false, ev:{ items:[] }, sc:null, race:null, filter:'', edit:null, saving:false, err:'' };
var CT_HOLI={ '2026-01-01':'신정','2026-02-16':'설날 연휴','2026-02-17':'설날','2026-02-18':'설날 연휴','2026-03-01':'삼일절','2026-03-02':'대체휴일','2026-05-05':'어린이날','2026-05-24':'부처님오신날','2026-05-25':'대체휴일','2026-06-03':'지방선거','2026-06-06':'현충일','2026-08-15':'광복절','2026-08-17':'대체휴일','2026-09-24':'추석 연휴','2026-09-25':'추석','2026-09-26':'추석 연휴','2026-09-28':'대체휴일','2026-10-03':'개천절','2026-10-05':'대체휴일','2026-10-09':'한글날','2026-12-25':'성탄절','2027-01-01':'신정','2027-02-06':'설날 연휴','2027-02-07':'설날','2027-02-08':'설날 연휴','2027-02-09':'대체휴일','2027-03-01':'삼일절','2027-05-05':'어린이날','2027-05-13':'부처님오신날','2027-06-06':'현충일','2027-08-15':'광복절','2027-08-16':'대체휴일','2027-09-14':'추석 연휴','2027-09-15':'추석','2027-09-16':'추석 연휴','2027-10-03':'개천절','2027-10-04':'대체휴일','2027-10-09':'한글날','2027-10-11':'대체휴일','2027-12-25':'성탄절' };
var CT_SCHOOL_COLOR={ '옥길중':'#2f6fdb', '범박중':'#1f9d6a', '범박고':'#7c4bd6', '소사고':'#e2542c', '소래고':'#0e7490' };
var CT_KIND={ off:['휴원','#fde7ea','#c8102e'], event:['학원 행사','#e5e7eb','#374151'], prep:['시험대비 수업','#fde2e2','#b3261e'], test:['주간테스트','#eef1f6','#1b1f27'], notice:['알림','#fef3c7','#92400e'] };
function ctEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ctTodayStr(){ return new Date(Date.now()+9*3600000).toISOString().slice(0,10); }
function ctAdd(s,n){ var t=new Date(s+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); }
function ctDow(s){ return new Date(s+'T00:00:00Z').getUTCDay(); }
function ctDiff(a,b){ return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }
function ctMd(s){ return s?(Number(s.slice(5,7))+'/'+Number(s.slice(8,10))):''; }
function ctShort(n){ return (typeof xtSchoolShort==='function')?xtSchoolShort(n):String(n||''); }
function ctColor(sch){ return CT_SCHOOL_COLOR[ctShort(sch)]||'#4b5563'; }
function ctMySchools(){ var m={}; (typeof activeStudents==='function'?activeStudents():[]).forEach(function(s){ var n=ctShort(s.school); if(n) m[n]=(m[n]||0)+1; }); return m; }
async function ctLoad(force){
  if(CT.loading) return; if(CT.loaded&&!force) return; CT.loading=true; CT.err='';
  try{
    var sb=getSupaClient(); if(!sb) throw new Error('서버 연결이 없습니다');
    var r=await sb.from('lumen_store').select('key,value').in('key',['lumen_events','school_calendar','race_season','exam_track']);
    var got={}; (r.data||[]).forEach(function(x){ var v=x.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } got[x.key]=v; });
    CT.ev=(got.lumen_events&&Array.isArray(got.lumen_events.items))?got.lumen_events:{ items:[] };
    CT.sc=got.school_calendar||null; CT.race=got.race_season||null; CT.dd=(got.exam_track&&got.exam_track.ddays)||[];
    CT.loaded=true;
  }catch(e){ CT.err=String(e.message||e); }
  CT.loading=false; render();
}
/* 학교별 시험 목록 — 우리 학생이 있는 학교만. 나이스가 없으면 손으로 적은 디데이 */
function ctExams(){
  var mine=ctMySchools(), out=[];
  ((CT.sc&&CT.sc.schools)||[]).forEach(function(s){ var sh=ctShort(s.name); if(!mine[sh]) return; (s.exams||[]).forEach(function(e){ if(e.from) out.push({ school:sh, n:mine[sh], from:e.from, to:e.to||e.from, label:e.label||e.name||'시험' }); }); });
  var have={}; out.forEach(function(e){ have[e.school]=1; });
  (CT.dd||[]).forEach(function(x){ var sh=ctShort(x.school); if(have[sh]||!x.date) return; var m=String(x.label||'').match(/\((\d\d)-(\d\d)~(\d\d)-(\d\d)\)/); out.push({ school:sh, n:mine[sh]||0, from:x.date, to:m?(String(x.date).slice(0,4)+'-'+m[3]+'-'+m[4]):x.date, label:String(x.label||'시험').replace(/\s*\(.*\)$/,'') }); });
  return out.sort(function(a,b){ return a.from<b.from?-1:1; });
}
function ctEventsOn(day){
  var out=[]; (CT.ev.items||[]).forEach(function(ev){ if(!ev||!ev.from) return;
    if(ev.repeat==='weekly'){ var to=ev.to||ctAdd(ev.from,120); if(day>=ev.from&&day<=to&&(ev.days||[]).indexOf(ctDow(day))>=0) out.push(ev); }
    else if(day>=ev.from&&day<=(ev.to||ev.from)) out.push(ev); });
  return out;
}
function ctTargetText(ev){ var t=ev.target||{}; var a=[]; if(t.schools&&t.schools.length) a.push(t.schools.join('·')); if(t.grades&&t.grades.length) a.push(t.grades.join('·')); if(t.groups&&t.groups.length) a.push(t.groups.join('·')+' 반'); return a.length?a.join(' / '):'전원'; }
function rCal(){
  if(!CT.y){ var t=new Date(Date.now()+9*3600000); CT.y=t.getUTCFullYear(); CT.m=t.getUTCMonth()+1; }
  if(!CT.loaded&&!CT.loading) setTimeout(function(){ ctLoad(); },0);
  var today=ctTodayStr(), h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:21px;font-weight:900;color:#0d2240;letter-spacing:-.02em">📅 학원 달력</div><div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:2px">학교별 시험 D-day · 진도 레이스 · 휴원·행사·시험대비 수업 — 「학생앱 공개」를 켠 일정은 학생앱 내 달력에 그대로 뜹니다</div></div>'
    +'<div style="margin-left:auto;display:flex;gap:6px">'+eaBtn('＋ 일정 넣기','ctNew()','pri')+eaBtn('🔄 새로고침','ctLoad(true)')+'</div></div>';
  if(CT.err) h+='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 13px;color:#b91c1c;font-size:12px;font-weight:800;margin-bottom:10px">'+ctEsc(CT.err)+'</div>';
  if(!CT.loaded) return h+'<div style="'+eaCard()+'"><div style="font-size:12px;color:#94a3b8;font-weight:700">불러오는 중…</div></div></div>';
  /* ① 학교별 D-day 카드 */
  var ex=ctExams(), next={}; ex.forEach(function(e){ if(e.to>=today&&!next[e.school]) next[e.school]=e; });
  var ks=Object.keys(next).sort(function(a,b){ return next[a].from<next[b].from?-1:1; });
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px">';
  if(!ks.length) h+='<div style="'+eaCard()+'"><div style="font-size:12px;color:#94a3b8;font-weight:700">다가오는 시험이 없습니다 (나이스 학사일정은 매일 새벽 수집 · 시험대비 트랙에서 디데이를 적을 수도 있습니다)</div></div>';
  ks.forEach(function(k){ var e=next[k], dn=ctDiff(today,e.from), on=today>=e.from&&today<=e.to, c=ctColor(k);
    h+='<div style="background:#fff;border-radius:14px;padding:12px 14px;border-top:6px solid '+c+';border:1px solid #e6eaf1;border-top-width:6px;border-top-color:'+c+'"><div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font-size:14px;color:#0d2240">'+ctEsc(k)+'</b><span style="font-size:11px;color:#64748b;font-weight:700">학생 '+e.n+'명</span></div>'
      +'<div style="font-size:34px;font-weight:900;line-height:1.05;color:'+c+';letter-spacing:-.03em;margin:2px 0">'+(on?'시험 중':(dn===0?'D-DAY':'D-'+dn))+'</div><div style="font-size:12px;font-weight:800;color:#0d2240">'+ctEsc(e.label)+'</div><div style="font-size:11px;color:#64748b">'+ctMd(e.from)+(e.to!==e.from?' ~ '+ctMd(e.to):'')+'</div></div>'; });
  h+='</div>';
  /* ② 월 보기 + 오른쪽 목록/편집 */
  h+='<div style="display:grid;grid-template-columns:1fr 340px;gap:12px;align-items:start">';
  h+='<div style="'+eaCard()+'"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'+eaBtn('‹','ctMove(-1)')+'<b style="font-size:16px;color:#0d2240">'+CT.y+'년 '+CT.m+'월</b>'+eaBtn('›','ctMove(1)')+eaBtn('오늘','ctTodayStr()')
    +'<span style="margin-left:auto;display:flex;gap:5px;flex-wrap:wrap">'+eaChip('전체',!CT.filter,"ctFilter('')")+Object.keys(ctMySchools()).map(function(s){ return eaChip(ctEsc(s),CT.filter===s,"ctFilter('"+ctEsc(s)+"')"); }).join('')+eaChip('학원 일정만',CT.filter==='_ev',"ctFilter('_ev')")+'</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;font-size:11px;font-weight:800;color:#64748b;text-align:center;border-bottom:1px solid #e6eaf1;padding-bottom:4px"><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style="color:#2f6fdb">토</div><div style="color:#c8102e">일</div></div>';
  var first=CT.y+'-'+(CT.m<10?'0':'')+CT.m+'-01', fd=(ctDow(first)+6)%7, start=ctAdd(first,-fd);
  h+='<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px">';
  for(var i=0;i<42;i++){ var d=ctAdd(start,i), inM=d.slice(0,7)===first.slice(0,7), dow=ctDow(d), holi=CT_HOLI[d];
    var exs=ex.filter(function(e){ return d>=e.from&&d<=e.to&&(!CT.filter||CT.filter==='_ev'?CT.filter!=='_ev':e.school===CT.filter); });
    var evs=ctEventsOn(d).filter(function(ev){ if(!CT.filter||CT.filter==='_ev') return true; var t=ev.target||{}; return !(t.schools&&t.schools.length)||t.schools.indexOf(CT.filter)>=0; });
    var race=(CT.race&&CT.race.from&&CT.race.to&&d>=CT.race.from&&d<=CT.race.to)&&(!CT.filter||CT.filter!=='_ev');
    var off=holi||evs.some(function(e){ return e.kind==='off'; });
    h+='<div onclick="ctDay(\''+d+'\')" style="min-height:74px;padding:3px 4px;border-top:1px solid #f1f5f9;border-radius:6px;cursor:pointer;'+(inM?'':'opacity:.45;')+(d===today?'background:#eef2ff;':'')+(CT.day===d?'box-shadow:inset 0 0 0 2px #0d2240;':'')+'">'
      +'<div style="font-size:11.5px;font-weight:'+(d===today?'900':'700')+';color:'+(off||dow===0?'#c8102e':(dow===6?'#2f6fdb':'#0d2240'))+'">'+Number(d.slice(8,10))+(holi?' <span style="font-size:9.5px;font-weight:700">'+ctEsc(holi)+'</span>':'')+'</div>';
    exs.forEach(function(e){ h+='<div style="margin-top:2px;background:'+ctColor(e.school)+';color:#fff;border-radius:4px;font-size:9.5px;font-weight:800;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ctEsc(e.school)+' '+ctEsc(e.label)+(d===e.from&&e.to!==e.from?' 시작':(d===e.to&&e.to!==e.from?' 끝':''))+'</div>'; });
    if(race&&(d===CT.race.from||d===CT.race.to||i%7===0)) h+='<div style="margin-top:2px;background:#fbf1d9;color:#7a5200;border-radius:4px;font-size:9.5px;font-weight:800;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(d===CT.race.to?'레이스 마감':(d===CT.race.from?'레이스 시작':'레이스'))+'</div>';
    evs.forEach(function(ev){ var k=CT_KIND[ev.kind]||CT_KIND.event; h+='<div onclick="event.stopPropagation();ctEdit(\''+ctEsc(ev.id)+'\')" style="margin-top:2px;background:'+k[1]+';color:'+k[2]+';border-radius:4px;font-size:9.5px;font-weight:800;padding:1px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'+(ev.pub===false?'opacity:.6;border:1px dashed '+k[2]+';':'')+'">'+(ev.time?ctEsc(ev.time)+' ':'')+ctEsc(ev.title||k[0])+'</div>'; });
    h+='</div>'; }
  h+='</div><div style="display:flex;gap:10px;flex-wrap:wrap;font-size:10.5px;color:#64748b;font-weight:700;margin-top:8px">'+Object.keys(CT_SCHOOL_COLOR).filter(function(s){ return ctMySchools()[s]; }).map(function(s){ return '<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:'+CT_SCHOOL_COLOR[s]+';vertical-align:-1px;margin-right:3px"></i>'+ctEsc(s)+' 시험</span>'; }).join('')
    +'<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#c58a12;vertical-align:-1px;margin-right:3px"></i>진도 레이스</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#c8102e;vertical-align:-1px;margin-right:3px"></i>휴원·공휴일</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#b3261e;vertical-align:-1px;margin-right:3px"></i>시험대비 수업</span><span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#9aa3b2;vertical-align:-1px;margin-right:3px"></i>행사·주간테스트 · 점선 = 학생앱 비공개</span></div></div>';
  /* 오른쪽: 편집 폼 또는 이번 달 목록 */
  h+='<div>'+(CT.edit?ctForm():ctList(first))+'</div></div>';
  return h+'</div>';
}
function ctList(first){
  var ym=first.slice(0,7), items=(CT.ev.items||[]).filter(function(ev){ return ev&&ev.from&&(String(ev.from).slice(0,7)===ym||String(ev.to||ev.from).slice(0,7)===ym||(ev.repeat==='weekly'&&ev.from<=ctAdd(first,41)&&(ev.to||ctAdd(ev.from,120))>=first)); }).sort(function(a,b){ return a.from<b.from?-1:1; });
  var h='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">이 달의 학원 일정 <span style="font-weight:700;color:#94a3b8">— 누르면 고칩니다</span></div>';
  if(!items.length) h+='<div style="font-size:12px;color:#94a3b8;font-weight:700">아직 넣은 일정이 없습니다. 「＋ 일정 넣기」로 휴원·행사·시험대비 수업을 넣어 보세요.</div>';
  items.forEach(function(ev){ var k=CT_KIND[ev.kind]||CT_KIND.event;
    h+='<div onclick="ctEdit(\''+ctEsc(ev.id)+'\')" style="display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid #f1f5f9;cursor:pointer"><span style="background:'+k[1]+';color:'+k[2]+';border-radius:5px;font-size:10px;font-weight:900;padding:2px 7px;white-space:nowrap">'+k[0]+'</span><span style="flex:1;font-size:12.5px;font-weight:800;color:#0d2240;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+ctEsc(ev.title||'')+'</span><span style="font-size:11px;color:#64748b;white-space:nowrap">'+ctMd(ev.from)+(ev.to&&ev.to!==ev.from?'~'+ctMd(ev.to):'')+(ev.repeat==='weekly'?' 매주':'')+(ev.time?' '+ctEsc(ev.time):'')+'</span><span style="font-size:10px;font-weight:800;color:'+(ev.pub===false?'#b45309':'#0f8a4e')+'">'+(ev.pub===false?'비공개':'학생앱')+'</span></div>'; });
  h+='</div>';
  if(CT.day){ var evs=ctEventsOn(CT.day), exs=ctExams().filter(function(e){ return CT.day>=e.from&&CT.day<=e.to; });
    h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">'+ctEsc(CT.day)+' ('+['일','월','화','수','목','금','토'][ctDow(CT.day)]+')'+(CT_HOLI[CT.day]?' · '+ctEsc(CT_HOLI[CT.day]):'')+'</div>';
    exs.forEach(function(e){ h+='<div style="font-size:12px;font-weight:800;color:'+ctColor(e.school)+';padding:3px 0">'+ctEsc(e.school)+' '+ctEsc(e.label)+' <span style="color:#64748b;font-weight:700">'+ctMd(e.from)+'~'+ctMd(e.to)+'</span></div>'; });
    evs.forEach(function(ev){ var k=CT_KIND[ev.kind]||CT_KIND.event; h+='<div style="font-size:12px;font-weight:800;color:'+k[2]+';padding:3px 0">'+k[0]+' · '+ctEsc(ev.title||'')+(ev.time?' '+ctEsc(ev.time):'')+' <span style="color:#64748b;font-weight:700">'+ctTargetText(ev)+'</span></div>'; });
    if(!exs.length&&!evs.length) h+='<div style="font-size:12px;color:#94a3b8;font-weight:700">일정 없음</div>';
    h+='<div style="margin-top:8px">'+eaBtn('이 날에 일정 넣기',"ctNew('"+CT.day+"')")+'</div></div>'; }
  return h;
}
function ctForm(){
  var e=CT.edit, isNew=!e.id; var schools=Object.keys(ctMySchools()); var groups=[]; (typeof activeStudents==='function'?activeStudents():[]).forEach(function(s){ if(s.group&&groups.indexOf(s.group)<0) groups.push(s.group); }); groups.sort();
  var grades=['초4','초5','초6','중1','중2','중3','고1','고2','고3']; var t=e.target||{ schools:[], grades:[], groups:[] };
  function inp(id,val,type,ph){ return '<input id="ct-'+id+'" type="'+(type||'text')+'" value="'+ctEsc(val||'')+'" placeholder="'+ctEsc(ph||'')+'" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:12.5px;padding:7px 9px;border:1.5px solid #e6eaf1;border-radius:9px">'; }
  var h='<div style="'+eaCard()+'"><div style="font-size:13px;font-weight:900;color:#0d2240;margin-bottom:9px">'+(isNew?'＋ 새 일정':'✏️ 일정 고치기')+'</div>';
  h+='<div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:4px">종류</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:9px">'+Object.keys(CT_KIND).map(function(k){ return eaChip(CT_KIND[k][0],e.kind===k,"ctSet('kind','"+k+"')"); }).join('')+'</div>';
  h+='<div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:4px">제목</div>'+inp('title',e.title,'text','예: 추석 연휴 휴원 · 옥길중 시험대비 총정리')+'';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px"><div><div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:4px">시작</div>'+inp('from',e.from,'date')+'</div><div><div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:4px">끝 (선택)</div>'+inp('to',e.to,'date')+'</div><div><div style="font-size:11px;font-weight:800;color:#64748b;margin-bottom:4px">시간 (선택)</div>'+inp('time',e.time,'text','19:00')+'</div></div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:9px">'+eaChip('매주 반복',e.repeat==='weekly',"ctSet('repeat','"+(e.repeat==='weekly'?'':'weekly')+"')");
  if(e.repeat==='weekly') ['일','월','화','수','목','금','토'].forEach(function(n,i){ h+=eaChip(n,(e.days||[]).indexOf(i)>=0,"ctDayToggle("+i+")"); });
  h+='</div>';
  h+='<div style="font-size:11px;font-weight:800;color:#64748b;margin:10px 0 4px">대상 <span style="font-weight:700;color:#94a3b8">— 아무것도 안 고르면 전원</span></div><div style="display:flex;gap:5px;flex-wrap:wrap">'+schools.map(function(s){ return eaChip(ctEsc(s),(t.schools||[]).indexOf(s)>=0,"ctTgl('schools','"+ctEsc(s)+"')"); }).join('')+'</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">'+grades.map(function(g){ return eaChip(g,(t.grades||[]).indexOf(g)>=0,"ctTgl('grades','"+g+"')"); }).join('')+'</div>'
    +'<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px">'+groups.map(function(g){ return eaChip(ctEsc(g)+' 반',(t.groups||[]).indexOf(g)>=0,"ctTgl('groups','"+ctEsc(g)+"')"); }).join('')+'</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-top:10px">'+eaChip('📱 학생앱에 공개',e.pub!==false,"ctSet('pub',"+(e.pub===false?'true':'false')+")")+'<span style="font-size:10.5px;color:#94a3b8;font-weight:700">끄면 학원앱에서만 보입니다</span></div>';
  h+='<div style="display:flex;gap:6px;margin-top:12px">'+eaBtn(CT.saving?'⏳ 저장 중…':'💾 저장','ctSave()','pri')+eaBtn('취소','ctCancel()')+(isNew?'':'<span style="margin-left:auto">'+eaBtn('🗑 지우기','ctDel()')+'</span>')+'</div></div>';
  return h;
}
window.ctMove=function(n){ CT.m+=n; if(CT.m>12){ CT.m=1; CT.y++; } if(CT.m<1){ CT.m=12; CT.y--; } render(); };
window.ctToday=function(){ var t=new Date(Date.now()+9*3600000); CT.y=t.getUTCFullYear(); CT.m=t.getUTCMonth()+1; CT.day=ctTodayStr(); render(); };
window.ctFilter=function(f){ CT.filter=f; render(); };
window.ctDay=function(d){ CT.day=(CT.day===d?'':d); render(); };
window.ctNew=function(d){ CT.edit={ id:'', kind:'off', title:'', from:d||CT.day||ctTodayStr(), to:'', time:'', repeat:'', days:[], target:{ schools:[], grades:[], groups:[] }, pub:true }; render(); };
window.ctEdit=function(id){ var ev=(CT.ev.items||[]).filter(function(x){ return x&&x.id===id; })[0]; if(!ev) return; CT.edit=JSON.parse(JSON.stringify(ev)); CT.edit.target=CT.edit.target||{ schools:[], grades:[], groups:[] }; render(); };
window.ctCancel=function(){ CT.edit=null; render(); };
function ctPull(){ var e=CT.edit; if(!e) return; ['title','from','to','time'].forEach(function(k){ var el=document.getElementById('ct-'+k); if(el) e[k]=String(el.value||'').trim(); }); }
window.ctSet=function(k,v){ ctPull(); CT.edit[k]=v; render(); };
window.ctDayToggle=function(i){ ctPull(); var d=CT.edit.days||(CT.edit.days=[]); var j=d.indexOf(i); if(j>=0) d.splice(j,1); else d.push(i); render(); };
window.ctTgl=function(k,v){ ctPull(); var t=CT.edit.target||(CT.edit.target={ schools:[], grades:[], groups:[] }); var a=t[k]||(t[k]=[]); var j=a.indexOf(v); if(j>=0) a.splice(j,1); else a.push(v); render(); };
async function ctPersist(){
  CT.ev.upd=new Date().toISOString(); CT.saving=true; render();
  var ok=await supaSetItem('lumen_events', CT.ev); CT.saving=false;
  if(!ok){ plToast('저장 실패 — 네트워크를 확인해 주세요'); } else { plToast('📅 저장했습니다'); CT.edit=null; }
  render(); return ok;
}
window.ctSave=function(){
  ctPull(); var e=CT.edit; if(!e) return;
  if(!e.from){ plToast('시작 날짜를 넣어 주세요'); return; } if(e.to&&e.to<e.from){ plToast('끝 날짜가 시작보다 앞입니다'); return; }
  if(!e.title){ e.title=(CT_KIND[e.kind]||CT_KIND.event)[0]; }
  if(e.repeat==='weekly'&&!(e.days&&e.days.length)){ plToast('매주 반복이면 요일을 골라 주세요'); return; }
  if(!e.id){ e.id='ev'+Date.now().toString(36); CT.ev.items=(CT.ev.items||[]).concat([e]); }
  else CT.ev.items=(CT.ev.items||[]).map(function(x){ return (x&&x.id===e.id)?e:x; });
  ctPersist();
};
window.ctDel=function(){ var e=CT.edit; if(!e||!e.id) return; if(!confirm('이 일정을 지울까요?')) return; CT.ev.items=(CT.ev.items||[]).filter(function(x){ return !(x&&x.id===e.id); }); ctPersist(); };
