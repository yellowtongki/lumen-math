# -*- coding: utf-8 -*-
# 학생앱 v2-155 조립 — «v2-154 복사 + rep 고침»
#   원장 2026-11-03 「우선 학생앱에 숙제체크 버튼만 만들고 나머지 기능을 추가」 → docs/hw_dispatch_contract.md §9 최소판(§9-1·§9-2)
#   [무엇] ① 홈 「📚 숙제 체크 · 수 11/5 수업」 카드 — v2-153 의 #hw-home 자리를 **날짜 단위 4칸**(풀이·채점·오답·아하노트)이 주인공이 되게 고친다.
#             숙제 카드(todo_<코드> 의 hw 카드)가 없어도 stu_features.hw 를 켠 학년이면 항상 보인다.
#             날짜 = 그 숙제를 확인받는 수업일(다음 수업일 · 오늘이 수업일이면 오늘). 반 요일표 lumen_group_days[studentInfo.group] (0=일…6=토), 없으면 오늘.
#             4칸 토글 → 새 키 hw_self_<코드> = { byDate:{ 'YYYY-MM-DD':{p,c,w,a(0|100),at} }, upd } 에만 쓴다(upsert, onConflict key). 학생앱만 쓰는 키.
#             누르면 「+5 XP」 글자·토스트(실제 XP 는 학원앱 §5 규칙으로 날짜 단위 단계마다 +5).
#             날짜 ◀▶ 로 지난 수업일(오늘-7일 안)로 되돌아가 누를 수 있다. 앞으로는 다음 수업일까지만.
#          ② 그 아래 「이번 숙제」 읽기 전용 목록 — v2-153 hw 카드(토글은 빼고 제목·쪽·문항만, 그 수업일까지 마감·7일 안)
#             + 「숙제」 태그 학습지(mf_wsq_<코드> list 중 tag==='HOMEWORK', 그 수업일 앞 7일 안: 제목·n문항·맞은 수 ◯/✗·「📄 학습지 채점으로 가기」 bkOpenWs).
#             학습지 목록은 bkLoad(bkFetchStore) 로 가볍게 한 번 읽는다(묻는 중이면 또 묻지 않는다 — HW.bkReq).
#          ③ v2-153 의 카드 단위 토글(todo_st_…hw, hwToggle·hwCardHtml)은 코드에 남기되 화면에서는 안 보인다. 📅 주간계획표 🔒 선생님 줄은 그대로.
#   [안 바꾼 것] todo_<코드>·todo_st_<코드> 는 이번 판에서 안 쓴다(읽기만) · 선생님 확인(lumen_hw) 잠금은 학생앱이 등록부를 못 읽으므로 생략(§9-2 허용) ·
#             아래 탭·다른 화면 그대로 · 고정 주소 student_v1.html 은 손대지 않는다.
#   실행: python3 sync/appbuild/build_student_v2154.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-154.html'); DST = os.path.join(ROOT, 'student_v2-155.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-154';", "var STU_VER = 'v2-155';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-155 (2026-11-03) 📚 「숙제 체크」 날짜 단위 4칸 (원장 2026-11-03 「우선 학생앱에 숙제체크 버튼만」 — docs/hw_dispatch_contract.md §9 최소판)\n"
    " *   · 홈 「📌 오늘 할 일」 아래 카드가 <b>📚 숙제 체크 · 수 11/5 수업</b> 으로 바뀌었습니다. 선생님이 숙제 카드를 내주지 않아도 항상 보입니다(기능 스위치 hw 를 켠 학년).\n"
    " *   · 날짜는 <b>숙제를 확인받는 수업일</b>(다음 수업일 · 오늘이 수업일이면 오늘). 풀이 · 채점 · 오답 · 아하노트 네 칸을 스스로 누르면 칸마다 +5 XP.\n"
    " *     ◀ ▶ 로 지난 수업일(7일 안)도 되돌아가 누를 수 있습니다. 저장은 새 칸 hw_self_&lt;코드&gt;(학생앱만 씀) — 학원앱 숙제체크가 이 값을 미리 보여 줍니다.\n"
    " *   · 그 아래 <b>이번 숙제</b> — 선생님이 내준 숙제 카드(교재 쪽·프린트·영상)와 매쓰플랫 「숙제」 태그 학습지(제목·문항·맞은 수)를 읽기만 나열. 학습지는 「📄 학습지 채점으로 가기」.\n"
    " *   · v2-153 의 카드마다 누르던 4칸은 화면에서 뺐습니다(날짜 단위 한 벌로 통일). 📅 주간계획표 🔒 선생님 줄은 그대로.\n"
    " *\n")

# ① 모양 — 날짜 단위 4칸 카드 (시안 docs/mockup_hw_dispatch.html 화면 2 의 줄 모양: 네모 ✓ · 이름/설명 · +5 XP 알약)
rep("/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n",
    "/* ★ v2-155: 📚 숙제 체크 — 날짜 단위 4칸 (hw_self_<코드>) */\n"
    ".hwd{background:#fff;border-radius:12px;padding:8px 10px 9px;margin-bottom:7px}\n"
    ".hwd-nav{display:flex;align-items:center;gap:6px;margin-bottom:4px}\n"
    ".hwd-nav button{font-family:inherit;flex:none;border:1.5px solid #e2e8f0;background:#fff;border-radius:8px;width:32px;height:30px;font-size:12px;font-weight:900;color:#334155;cursor:pointer}\n"
    ".hwd-nav button:disabled{opacity:.25;cursor:default}\n"
    ".hwd-nav .dt{flex:1;min-width:0;text-align:center;font-size:13px;font-weight:900;color:#0d2240;line-height:1.3}\n"
    ".hwd-nav .dt small{display:block;font-size:10px;color:#64748b;font-weight:700}\n"
    ".hwd-bar{height:6px;border-radius:3px;background:#e5e9e4;overflow:hidden;margin:2px 0 4px}.hwd-bar i{display:block;height:100%;background:#16a34a}\n"
    ".hwd-row{font-family:inherit;display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:none;border-top:1px dashed #e5e9e4;background:#fff;padding:7px 2px;cursor:pointer;min-width:0}\n"
    ".hwd-row:first-child{border-top:none}\n"
    ".hwd-row .ck{width:22px;height:22px;border-radius:7px;border:2px solid #9aa5b1;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex:none;background:#fff}\n"
    ".hwd-row .n{flex:1;min-width:0}\n"
    ".hwd-row .n b{display:block;font-size:12.5px;color:#182230;line-height:1.3}\n"
    ".hwd-row .n span{font-size:10.5px;color:#7b8694;font-weight:700}\n"
    ".hwd-row .xp{flex:none;font-size:10px;font-weight:900;padding:2px 8px;border-radius:12px;background:#eef1ee;color:#5b6775;white-space:nowrap}\n"
    ".hwd-row.on .ck{background:#16a34a;border-color:#16a34a}.hwd-row.on .n b{color:#15803d}.hwd-row.on .xp{background:#e1f2ea;color:#15803d}\n"
    ".hwd-sub{font-size:11.5px;font-weight:900;color:rgba(255,255,255,.85);margin:9px 0 5px;display:flex;justify-content:space-between;align-items:center}\n"
    ".hwd-sub small{font-size:10px;color:rgba(255,255,255,.5);font-weight:700}\n"
    ".hwd-empty{font-size:11px;color:rgba(255,255,255,.6);font-weight:700;background:rgba(255,255,255,.06);border-radius:10px;padding:9px 10px;line-height:1.5}\n"
    "/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n")

# ② HW 상태 칸 추가
rep("var HW={ bkReq:false };\n",
    "var HW={ bkReq:false, loaded:false, busy:false, self:null, days:null, sel:null, for:'' };   /* ★ v2-155: self = hw_self_<코드> · days = lumen_group_days · sel = 보고 있는 수업일 */\n")

# ③ 홈 카드 — v2-153 의 「📌 오늘 숙제」(카드 단위 4칸) 를 날짜 단위 4칸 카드로 바꾼다
OLD_HOME = '''/* 홈 「📌 오늘 숙제」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다) */
window.hwHomeUpdate=function(){
  var el=document.getElementById('hw-home'); if(!el) return;
  if(!hwOpen()){ el.style.display='none'; el.innerHTML=''; return; }
  if(!TD.loaded){ el.style.display='none'; if(!TD.busy && window.tdLoad) tdLoad(); return; }
  if(!BK.loaded && !HW.bkReq && typeof bkLoad==='function'){   /* 자동 ✓·학습지 잇기에 교재·학습지·채점 기록이 필요하다 */
    HW.bkReq=true;
    try{ bkLoad().then(function(){ hwHomeUpdate(); }, function(){}); }catch(e){}
  }
  var cards=hwTodayCards();
  if(!cards.length){ el.style.display='none'; el.innerHTML=''; return; }
  var t=hwToday(); var dow=['일','월','화','수','목','금','토'][new Date(t+'T00:00:00Z').getUTCDay()];
  var h='<div class="tdb-hd"><span>📌 오늘 숙제 · '+Number(t.slice(5,7))+'/'+Number(t.slice(8,10))+'('+dow+')</span><span class="tdb-cnt">'+cards.length+'개</span></div>';
  cards.forEach(function(it){ h+=hwCardHtml(it); });
  h+='<div class="hwc-note">스스로 누르면 칸마다 +5 XP · 선생님이 수업 때 확인하면 나머지 XP가 들어와요. 채점 칸은 앱에서 채점하면 저절로 ✓.</div>';
  el.innerHTML=h; el.style.display='block';
};
'''
NEW_HOME = r'''/* ★ v2-155 hwself-begin */
/* ═══════════════ v2-155: 📚 숙제 체크 — 날짜 단위 4칸 (docs/hw_dispatch_contract.md §9 최소판) ═══════════════
 * 새 키 hw_self_<내 코드> = { byDate:{ 'YYYY-MM-DD':{ p,c,w,a (0|100), at } }, upd }  ← 학생앱만 쓴다(학원앱·학부모앱은 읽기만).
 *   날짜 = 그 숙제를 확인받는 수업일(다음 수업일 · 오늘이 수업일이면 오늘). 반 요일표 lumen_group_days[내 반](0=일…6=토), 없으면 오늘.
 *   ◀▶ 로 지난 수업일(오늘-7일 안)도 되돌아가 누를 수 있다. 앞으로는 다음 수업일까지만.
 *   선생님 확인(lumen_hw) 잠금은 학생앱이 등록부를 못 읽으니 생략(§9-2).
 *   아래 「이번 숙제」 = 그 수업일까지 마감인 숙제 카드(hw 카드 · 읽기만) + 「숙제」 태그 학습지(mf_wsq · 그 수업일 앞 7일 · 읽기만).
 *   v2-153 의 카드 단위 4칸(hwToggle·hwCardHtml)은 남겨 두되 화면에서는 안 쓴다. */
var HW_DOW=['일','월','화','수','목','금','토'];
function hwDow(s){ return new Date(s+'T00:00:00Z').getUTCDay(); }
function hwMD(s){ return Number(s.slice(5,7))+'/'+Number(s.slice(8,10)); }
/* 내 반 수업 요일 — hw_self 와 같이 읽은 lumen_group_days > 주간계획표(WP.days) > 달력(CAL.data). 없으면 null */
function hwDays(){
  var g=String((window.studentInfo && studentInfo.group)||''); if(!g) return null;
  var srcs=[HW.days, (window.WP && WP.days), (window.CAL && CAL.data && CAL.data.lumen_group_days)];
  for(var i=0;i<srcs.length;i++){ var m=srcs[i]; if(m && Array.isArray(m[g]) && m[g].length) return m[g].map(Number); }
  return null;
}
function hwIsClass(s){ var d=hwDays(); if(!d) return true; return d.indexOf(hwDow(s))>=0; }
/* 다음 수업일 — 오늘이 수업일이면 오늘. 요일표가 없으면 오늘 */
function hwClassDate(){ var t=hwToday(); if(!hwDays()) return t; for(var i=0;i<7;i++){ var d=hwAddDays(t,i); if(hwIsClass(d)) return d; } return t; }
window.hwClassDate=hwClassDate;
/* 되돌아갈 수 있는 가장 이른 날 = 오늘-7일 */
function hwMinDate(){ return hwAddDays(hwToday(),-7); }
function hwPrevClass(s){ var mn=hwMinDate(); for(var i=1;i<=14;i++){ var d=hwAddDays(s,-i); if(d<mn) return null; if(hwIsClass(d)) return d; } return null; }
function hwNextClass(s){ var mx=hwClassDate(); for(var i=1;i<=14;i++){ var d=hwAddDays(s,i); if(d>mx) return null; if(hwIsClass(d)) return d; } return null; }
function hwSelDate(){ var d0=hwClassDate(); if(!HW.sel || HW.sel>d0 || HW.sel<hwMinDate()) HW.sel=d0; return HW.sel; }
/* hw_self_<코드> + lumen_group_days — 한 번만 읽는다(묻는 중이면 또 묻지 않는다) */
window.hwLoad=async function(force){
  if(HW.busy) return; if(HW.loaded && !force) return;
  var s=tdSb(); if(!s || !studentInfo || isTest){ HW.loaded=true; return; }
  HW.busy=true; var code=studentInfo.lumen_rec_code;
  try{
    var st=await bkFetchStore(['hw_self_'+code,'lumen_group_days']);
    var v=st['hw_self_'+code]; HW.self=(v && typeof v==='object' && v.byDate && typeof v.byDate==='object')?v:{ byDate:{} };
    HW.days=st['lumen_group_days']||null;
  }catch(e){ if(!HW.self) HW.self={ byDate:{} }; }
  HW.loaded=true; HW.busy=false; HW.for=code;
};
/* 그 날짜에 내가 누른 4칸 (0/100 만) */
function hwSelfOf(date){ var m=(HW.self && HW.self.byDate)||{}; var h=m[date]||{}; return { p:h.p===100?100:0, c:h.c===100?100:0, w:h.w===100?100:0, a:h.a===100?100:0 }; }
window.hwSelfOf=hwSelfOf;
/* 「이번 숙제」 — 그 수업일까지 마감인 숙제 카드(7일 안 · 선생님 확인 끝은 빼고) */
function hwCardsFor(date){
  var mn=hwAddDays(date,-7);
  return hwCards().filter(function(it){ return it.due && String(it.due)<=date && String(it.due)>mn && it.tst!=='ok'; }).sort(function(a,b){
    return hwKindOrd(a.kind)-hwKindOrd(b.kind) || String(a.due).localeCompare(String(b.due)) || String(a.title||'').localeCompare(String(b.title||''));
  });
}
/* 「숙제」 태그 학습지 — 그 수업일 앞 7일 안에 배정된 것(mf_wsq_<코드>.list, tag==='HOMEWORK') */
function hwWsFor(date){
  var list=(BK.wsq && BK.wsq.list)||[]; var mn=hwAddDays(date,-7);
  return list.filter(function(w){ if(!w || String(w.tag||'')!=='HOMEWORK') return false; var d=String(w.date||'').slice(0,10); return d && d<=date && d>mn; })
    .sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')) || String(a.title||'').localeCompare(String(b.title||'')); });
}
window.hwWsFor=hwWsFor;
/* 읽기 전용 카드 줄 — 제목·쪽·문항만 (4칸 토글 없음) */
function hwCardRoHtml(it){
  var ac=hwAutoC(it);
  var ht='<div class="hwc '+hwCls(it)+'">';
  var rr='';
  if(it.kind==='book'){ var f=it.from, t=it.to; if(f!=null && f!=='') rr='p.'+hwEsc(f)+((t!=null && t!=='' && String(t)!==String(f))?('~'+hwEsc(t)):''); if(it.n!=null && it.n!=='') rr+=(rr?' · ':'')+hwEsc(it.n)+'문항'; }
  else if(it.kind==='ws'){ var w=hwWs(it); var n=(it.n!=null && it.n!=='')?it.n:(w&&w.n!=null?w.n:null); if(n!=null) rr=hwEsc(n)+'문항'; if(ac.o+ac.x+ac.q>0) rr+=(rr?' · ':'')+'◯ '+ac.o+' ✗ '+ac.x; }
  else if(it.kind==='vod'){ rr='영상'; }
  else { rr=(it.print?'프린트':'')+((it.n!=null && it.n!=='')?((it.print?' · ':'')+hwEsc(it.n)+'문항'):''); }
  ht+='<div class="hwc-t"><span class="ic">'+hwIc(it)+'</span><span class="tt">'+hwEsc(hwTitle(it)||(it.kind==='book'?(it.book||'교재'):'숙제'))+'</span>'+(rr?'<span class="rr">'+rr+'</span>':'')+'</div>';
  var sub=[]; if(it.due) sub.push('마감 '+hwMD(String(it.due))+'('+HW_DOW[hwDow(String(it.due))]+')'); if(it.ref && it.kind!=='book') sub.push(hwEsc(it.ref));
  if(it.kind==='vod') sub.push('강의실에서 끝까지 보면 자동 제출'); else if(ac.on && ac.txt) sub.push(hwEsc(ac.txt));
  if(sub.length) ht+='<div class="hwc-s">'+sub.join(' · ')+'</div>';
  if(it.kind==='ws'){ var ww=hwWs(it); if(ww) ht+='<button type="button" class="hwc-go" onclick="hwGoSw('+hwQ(ww.swId)+')">📄 학습지 채점으로 가기 ›</button>'; }
  return ht+'</div>';
}
/* 읽기 전용 학습지 줄 — 제목 · n문항 · 맞은 수 ◯/✗ · 「학습지 채점으로 가기」 */
function hwWsRoHtml(w){
  var ac=hwAutoC({ kind:'ws', id:'a:ws:'+(w.wid!=null?w.wid:''), wid:w.wid, swId:w.swId });
  var rr=(w.n!=null && w.n!=='')?(hwEsc(w.n)+'문항'):''; if(ac.o+ac.x+ac.q>0) rr+=(rr?' · ':'')+'◯ '+ac.o+' ✗ '+ac.x;
  var sub=[]; var d=String(w.date||'').slice(0,10); if(d) sub.push('배정 '+hwMD(d)+'('+HW_DOW[hwDow(d)]+')'); if(w.status) sub.push(hwEsc(w.status));
  if(ac.on && !(ac.o+ac.x+ac.q>0) && ac.txt) sub.push(hwEsc(ac.txt));
  var ht='<div class="hwc ws"><div class="hwc-t"><span class="ic">📄</span><span class="tt">'+hwEsc(w.title||'학습지')+'</span>'+(rr?'<span class="rr">'+rr+'</span>':'')+'</div>';
  if(sub.length) ht+='<div class="hwc-s">'+sub.join(' · ')+'</div>';
  ht+='<button type="button" class="hwc-go" onclick="hwGoSw('+hwQ(w.swId)+')">📄 학습지 채점으로 가기 ›</button>';
  return ht+'</div>';
}
var HW_SELF_STEP=[['p','풀이','다 풀었어요'],['c','채점','답 맞춰 봤어요'],['w','오답','틀린 문제 다시 풀기'],['a','아하노트','왜 틀렸는지 한 줄']];
/* 홈 「📚 숙제 체크」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다 · 숙제 카드가 없어도 보인다) */
window.hwHomeUpdate=function(){
  var el=document.getElementById('hw-home'); if(!el) return;
  if(!hwOpen()){ el.style.display='none'; el.innerHTML=''; return; }
  if(!HW.loaded){ el.style.display='none'; if(!HW.busy){ try{ hwLoad().then(function(){ hwHomeUpdate(); }, function(){}); }catch(e){} } return; }
  if(!TD.loaded && !TD.busy && window.tdLoad){ try{ tdLoad(); }catch(e){} }   /* 숙제 카드 목록 — 오면 tdHomeUpdate 가 다시 부른다 */
  if(!BK.loaded && !HW.bkReq && typeof bkLoad==='function'){   /* 학습지 목록·채점 기록 — 한 번만 가볍게 */
    HW.bkReq=true;
    try{ bkLoad().then(function(){ hwHomeUpdate(); }, function(){}); }catch(e){}
  }
  var t=hwToday(); var d0=hwClassDate(); var sel=hwSelDate(); var h4=hwSelfOf(sel); var n=hwCnt(h4);
  var prev=hwPrevClass(sel), next=hwNextClass(sel);
  var lab=HW_DOW[hwDow(sel)]+' '+hwMD(sel)+' 수업';
  var hint = sel===t ? '오늘 수업 · 수업 전에 눌러 두세요' : (sel===d0 ? '다음 수업 · 수업 전까지 누르면 돼요' : ('지난 수업 · ' + Math.round((Date.parse(t+'T00:00:00Z')-Date.parse(sel+'T00:00:00Z'))/86400000) + '일 전'));
  var h='<div class="tdb-hd"><span>📚 숙제 체크 · '+lab+'</span><span class="tdb-cnt">'+n+'/4</span></div>';
  h+='<div class="hwd"><div class="hwd-nav">'
    +'<button type="button" onclick="hwNav(-1)" '+(prev?'':'disabled')+' aria-label="지난 수업일">◀</button>'
    +'<div class="dt">'+lab+'<small>'+hint+'</small></div>'
    +'<button type="button" onclick="hwNav(1)" '+(next?'':'disabled')+' aria-label="다음 수업일">▶</button></div>';
  h+='<div class="hwd-bar"><i style="width:'+(n*25)+'%"></i></div>';
  HW_SELF_STEP.forEach(function(st){
    var k=st[0]; var on=h4[k]===100;
    h+='<button type="button" class="hwd-row'+(on?' on':'')+'" onclick="hwSelfToggle(\''+k+'\')" aria-pressed="'+(on?'true':'false')+'">'
      +'<span class="ck">'+(on?'✓':'')+'</span><span class="n"><b>'+st[1]+'</b><span>'+st[2]+'</span></span><span class="xp">'+(on?'+5 XP':'대기')+'</span></button>';
  });
  h+='</div>';
  h+='<div class="hwc-note">스스로 누르면 칸마다 +5 XP · 선생님이 수업 때 확인하면 나머지 XP가 들어와요.</div>';
  /* 이번 숙제 — 읽기만 */
  var cards=TD.loaded?hwCardsFor(sel):[]; var wss=hwWsFor(sel);
  var shownWid={}; wss.forEach(function(w){ if(w.wid!=null) shownWid[String(w.wid)]=1; if(w.swId!=null) shownWid['s'+w.swId]=1; });
  var rows='';
  cards.forEach(function(it){
    if(it.kind==='ws'){ var w=hwWs(it); if(w && (shownWid[String(w.wid)] || shownWid['s'+w.swId])) return; }   /* 학습지 줄과 겹치면 한 번만 */
    rows+=hwCardRoHtml(it);
  });
  wss.forEach(function(w){ rows+=hwWsRoHtml(w); });
  h+='<div class="hwd-sub"><span>📋 이번 숙제</span><small>'+hwMD(sel)+' 수업까지 · 읽기만</small></div>';
  if(rows) h+=rows;
  else h+='<div class="hwd-empty">아직 목록이 없어요 — 선생님이 내준 교재 쪽·프린트와 매쓰플랫 「숙제」 학습지가 여기 보여요. 숙제는 선생님이 말한 대로 하고 위 네 칸만 눌러 주세요.</div>';
  el.innerHTML=h; el.style.display='block';
};
/* 날짜 ◀▶ — 지난 수업일(오늘-7일 안) ↔ 다음 수업일 */
window.hwNav=function(dir){
  var sel=hwSelDate(); var d=dir<0?hwPrevClass(sel):hwNextClass(sel);
  if(!d){ if(typeof toast==='function') toast(dir<0?'7일 전까지만 되돌아갈 수 있어요':'다음 수업일까지만 볼 수 있어요'); return; }
  HW.sel=d; hwHomeUpdate();
};
/* 4칸 누르기 — hw_self_<내 코드>.byDate[수업일] 에만 쓴다 (todo_st_·todo_ 는 안 건드린다) */
window.hwSelfToggle=async function(k){
  if(!requireLogin(null,null,null)) return;
  var s=tdSb(); if(!s || isTest){ if(typeof toast==='function') toast('테스트 계정은 저장되지 않아요'); return; }
  if(['p','c','w','a'].indexOf(k)<0) return;
  if(!HW.loaded){ if(typeof toast==='function') toast('잠깐만요 — 불러오는 중이에요'); return; }
  var code=studentInfo.lumen_rec_code; var now=new Date().toISOString(); var sel=hwSelDate();
  if(!HW.self || typeof HW.self!=='object') HW.self={ byDate:{} }; if(!HW.self.byDate || typeof HW.self.byDate!=='object') HW.self.byDate={};
  var h=hwSelfOf(sel); h[k]=(h[k]===100)?0:100; h.at=now;
  HW.self.byDate[sel]=h; HW.self.upd=now;
  var v={ byDate:{}, upd:now }; Object.keys(HW.self.byDate).forEach(function(d){ v.byDate[d]=HW.self.byDate[d]; });
  hwHomeUpdate();
  try{
    var r=await s.from('lumen_store').upsert({ key:'hw_self_'+code, value:v, updated_at:now },{ onConflict:'key' });
    if(r && r.error) throw r.error;
    if(typeof toast==='function') toast(h[k]===100?('✓ '+({p:'풀이',c:'채점',w:'오답',a:'아하노트'}[k])+' · +5 XP'):'되돌렸어요');
  }catch(e){ if(typeof toast==='function') toast('저장이 안 됐어요 — 잠시 후 다시 눌러 주세요'); }
};
/* 「📄 학습지 채점으로 가기」 — 학습지 id(swId)로 바로 (기존 학습지 채점 화면 bkOpenWs) */
window.hwGoSw=async function(swId){
  if(isTest){ if(typeof toast==='function') toast('테스트 모드에서는 쓸 수 없어요'); return; }
  try{ if(!BK.loaded && typeof bkLoad==='function') await bkLoad(); }catch(e){}
  var list=(BK.wsq && BK.wsq.list)||[]; var w=null;
  for(var i=0;i<list.length;i++){ if(list[i] && String(list[i].swId)===String(swId)){ w=list[i]; break; } }
  if(!w){ if(typeof toast==='function') toast('학습지 목록에 아직 없어요 — 📖 채점 › 📄 학습지에서 찾아 주세요'); go('screen-bookscore'); return; }
  BK.top='ws';
  await bkOpenWs(w.swId);
};
/* ★ v2-155 hwself-end */
'''
rep(OLD_HOME, NEW_HOME)

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
