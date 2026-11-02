# -*- coding: utf-8 -*-
# 학생앱 v2-153 조립 — «v2-152 복사 + rep 고침»
#   원장 2026-11-02 결정 「숙제 한 바퀴」 1판 (docs/hw_dispatch_contract.md §2-2 · §3 의 3·4, 시안 docs/mockup_hw_dispatch.html 화면 2)
#   [무엇] ① 홈 「📌 오늘 할 일」 바로 아래 「📌 오늘 숙제」 카드 — 할 일 보드 카드(todo_<코드>) 중 hw===true 이고
#             마감이 오늘까지(KST)인 것(선생님 확인 tst 'ok' 는 빼고). 마감 지난 것은 빨간 「n일 지남」.
#             카드마다 풀이·채점·오답·아하노트 4칸 토글 → todo_st_<코드>[카드id].hw={p,c,w,a}(0/100)·hat 저장 (학생앱만 쓰는 키).
#             st 규칙: 한 칸이라도 100 → 최소 'doing' · 넷 다 → 'done' · 더 앞선 상태는 내리지 않는다.
#             채점 칸 자동 ✓(§2-2): 학습지 = hw_scores 의 ws_<swId>_ 기록 또는 매쓰플랫 「학습완료」 · 교재 = 그 쪽(from~to)의 <pid>_ 기록.
#             자동 ✓ 는 저장하지 않고 화면에서만 센다. 학습지 카드엔 「📄 학습지 채점으로 가기」.
#             스위치 stu_features.hw {on, off:[학년]} — 할 일 보드(stu_features.todo)가 잠겨 있어도 hw 가 켜져 있으면 보인다.
#          ② 📅 주간계획표(그 주 달력) 날짜 머리 아래 「🔒 선생님」 줄 — 그 주에 마감인 숙제 카드를 읽기만 그린다(저장 안 함 · 점수 계산에 안 들어감).
#   [안 바꾼 것] todo_<코드> 는 읽기만(학원앱이 쓴다) · 아래 탭·다른 화면 그대로 · 고정 주소 student_v1.html 은 손대지 않는다.
#   실행: python3 sync/appbuild/build_student_v2152.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-152.html'); DST = os.path.join(ROOT, 'student_v2-153.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-152';", "var STU_VER = 'v2-153';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-153 (2026-11-02) 📌 「오늘 숙제」 카드 + 📅 주간계획표 「선생님」 줄 (원장 결정 2026-11-02 「숙제 한 바퀴」 1판 — docs/hw_dispatch_contract.md)\n"
    " *   · 홈 「📌 오늘 할 일」 바로 아래에 <b>오늘 숙제</b> 카드가 생겼습니다. 선생님이 내준 숙제(교재 쪽·학습지·프린트·영상) 중 오늘까지 해야 할 것만 모아 보여 줍니다.\n"
    " *     마감이 지난 것은 빨간 「n일 지남」. 카드마다 <b>풀이 · 채점 · 오답 · 아하노트</b> 네 칸을 스스로 누르면 칸마다 +5 XP(실제 점수는 선생님 확인 뒤 학원앱이 셉니다).\n"
    " *   · 채점 칸은 앱 「학습지 채점」·「교재 채점」을 했으면 <b>자동 ✓</b>(맞은 수 표시). 학습지 카드엔 「📄 학습지 채점으로 가기」 단추.\n"
    " *   · 📅 주간계획표 날짜 머리 아래에 <b>🔒 선생님</b> 줄 — 그 주에 마감인 숙제가 날짜별로 보입니다(읽기만 · 내 계획 점수와 상관없음).\n"
    " *   · 원장님이 학원앱 「🎛 기능 켜고 끄기」에서 「오늘 숙제」(hw)를 켠 학년에게만 보입니다. 할 일 보드(🗂)는 그대로 잠겨 있어도 됩니다.\n"
    " *\n")

# ① 홈 — 「📌 오늘 할 일」(하브루타·플래너 .td4) 바로 아래 「📌 오늘 숙제」 자리
#    (🗂 이번 할 일 #td-home 은 v2-116 부터 🔔 알림 서랍 안에 있다 — 숙제는 서랍이 아니라 홈 첫 화면에 둔다: 시안 「홈 맨 위 오늘 숙제 카드」)
rep('    </div>\n    <!-- v2-116: 🏆 루멘 리그 — 종목 4칸',
    '    </div>\n'
    '    <!-- v2-153: 📌 오늘 숙제 (hwHomeUpdate · stu_features.hw 로 학년별 켬) -->\n'
    '    <div id="hw-home" class="hwh tdb-bell" style="display:none"></div>\n'
    '    <!-- v2-116: 🏆 루멘 리그 — 종목 4칸')

# ② 모양
rep(".tdb-soon{display:flex;align-items:center;gap:11px;",
    "/* ★ v2-153: 📌 오늘 숙제 카드 (홈 첫 화면 · 「📌 오늘 할 일」 바로 아래) */\n"
    ".hwh{margin:0}\n"
    ".hwc{background:#fff;border-radius:12px;padding:9px 10px;margin-bottom:7px;border-left:4px solid #16a34a}\n"
    ".hwc.ws{border-left-color:#c8731e}.hwc.etc{border-left-color:#6366f1}.hwc.vod{border-left-color:#0ea5e9}.hwc.late{border-left-color:#dc2626}\n"
    ".hwc-t{display:flex;align-items:flex-start;gap:6px;font-size:13px;font-weight:900;color:#0d2240;line-height:1.35}\n"
    ".hwc-t .ic{flex:none}.hwc-t .tt{flex:1;min-width:0;word-break:break-all}.hwc-t .rr{flex:none;font-size:10.5px;font-weight:800;color:#64748b;white-space:nowrap;margin-top:1px}\n"
    ".hwc-s{font-size:10.5px;color:#64748b;font-weight:700;margin-top:2px;line-height:1.4}\n"
    ".hwc-s .late{color:#dc2626;font-weight:900}\n"
    ".hws-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:8px}\n"
    ".hws{font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:2px;border:1.5px solid #e2e8f0;background:#fff;border-radius:9px;padding:6px 2px 5px;cursor:pointer;min-width:0}\n"
    ".hws .ck{width:20px;height:20px;border-radius:50%;border:2px solid #cbd5e1;font-size:12px;font-weight:900;color:#fff;display:flex;align-items:center;justify-content:center;background:#fff}\n"
    ".hws .nm{font-size:11px;font-weight:900;color:#334155;white-space:nowrap}\n"
    ".hws .xp{font-size:9px;font-weight:900;color:#94a3b8;white-space:nowrap}\n"
    ".hws.on{border-color:#16a34a;background:#f0fdf4}.hws.on .ck{background:#16a34a;border-color:#16a34a}.hws.on .xp{color:#15803d}\n"
    ".hws.auto{border-color:#1d6fe8;background:#eff6ff;cursor:default}.hws.auto .ck{background:#1d6fe8;border-color:#1d6fe8}.hws.auto .xp{color:#1d4ed8}\n"
    ".hwc-go{font-family:inherit;display:block;width:100%;margin-top:7px;border:none;border-radius:9px;padding:8px;background:#fff7ed;color:#9a3412;font-size:11.5px;font-weight:900;cursor:pointer}\n"
    ".hwc-vod{margin-top:6px;font-size:11px;font-weight:800;color:#0369a1;background:#f0f9ff;border-radius:8px;padding:7px 9px}\n"
    ".hwc-note{font-size:10px;color:rgba(255,255,255,0.55);font-weight:700;line-height:1.5;margin-top:2px}\n"
    "/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n"
    ".wpc-hw{display:grid;grid-template-columns:24px repeat(7,minmax(0,1fr));background:#f1f5f9;border-bottom:1px solid #e3e8ef}\n"
    ".wpc-hw .l{font-size:9px;text-align:center;color:#94a3b8;padding-top:3px;font-weight:900}\n"
    ".wpc-hw .c{padding:2px 1px;min-height:14px;border-right:1px solid #eef2f6;min-width:0}.wpc-hw .c:last-child{border-right:none}\n"
    ".wpc-hw .hwi{display:block;font-size:9px;font-weight:900;color:#475569;background:#e2e8f0;border-radius:4px;padding:1px 2px;margin:1px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center;cursor:pointer}\n"
    ".wpc-hw .hwi.late{color:#b91c1c;background:#fee2e2}\n"
    ".tdb-soon{display:flex;align-items:center;gap:11px;")

# ③ 할 일 보드 — 그릴 때마다 「오늘 숙제」도 같이 그린다 · 불러온 뒤 주간계획표가 열려 있으면 다시 그린다
rep("window.tdHomeUpdate=function(){\n",
    "window.tdHomeUpdate=function(){\n"
    "  try{ if(window.hwHomeUpdate) hwHomeUpdate(); }catch(e){}   /* ★ v2-153: 📌 오늘 숙제 (할 일 보드 잠김과 상관없이) */\n")
rep("  tdHomeUpdate();\n  var sc=document.getElementById('screen-todo'); if(sc && sc.classList.contains('active')) tdRender();\n};\nwindow.tdInit=",
    "  tdHomeUpdate();\n  var sc=document.getElementById('screen-todo'); if(sc && sc.classList.contains('active')) tdRender();\n"
    "  try{ var scw=document.getElementById('screen-wplan'); if(scw && scw.classList.contains('active') && window.wplRender && window.WP && WP.loaded) wplRender(); }catch(e){}   /* ★ v2-153: 🔒 선생님 줄 */\n"
    "};\nwindow.tdInit=")

# ④ (🔔 알림 서랍 수는 건드리지 않는다 — 숙제 카드는 홈 첫 화면에 있다)

# ⑤ 📅 주간계획표 — 날짜 머리 아래 「🔒 선생님」 줄 + 범례
rep("  h += '</div><div class=\"wpc-bd\" style=\"height:' + (SN * H) + 'px\"><div class=\"wpc-tc\">';",
    "  h += '</div>';\n"
    "  if (window.hwWeekStripHtml){ try { h += hwWeekStripHtml(W, today); } catch(e){} }   /* ★ v2-153: 🔒 선생님 숙제 줄 (읽기만) */\n"
    "  h += '<div class=\"wpc-bd\" style=\"height:' + (SN * H) + 'px\"><div class=\"wpc-tc\">';")
rep("(WP.codi ? '<span>🧭 코디가 넣은 칸</span>' : '')",
    "(WP.codi ? '<span>🧭 코디가 넣은 칸</span>' : '') + ((window.hwOpen && hwOpen()) ? '<span>🔒 선생님 숙제 (읽기만)</span>' : '')")

# ⑥ 본체 — 할 일 보드 코드 바로 뒤
HW_JS = r'''
/* ★ v2-153 hw-begin */
/* ═══════════════ v2-153: 📌 오늘 숙제 — docs/hw_dispatch_contract.md §2-2 · §3 의 3·4 ═══════════════
 * 숙제 = 할 일 보드 카드(todo_<내 코드>.items[]) 중 hw===true 인 것. 학원앱이 만든다 — 학생앱은 읽기만.
 *   「오늘 숙제」 = 그중 마감(due)이 오늘(KST)까지이고 선생님 확인(tst 'ok')이 안 된 것.
 *   내가 누른 4칸(풀이 p · 채점 c · 오답 w · 아하노트 a, 0/100)은 todo_st_<내 코드>[카드id].hw 에만 쓴다(+ hat 시각).
 *   st 규칙: 한 칸이라도 100 → 최소 'doing' · 넷 다 100 → 'done' · 더 앞선 상태는 내리지 않는다.
 *   채점 칸 자동 ✓: 학습지 = hw_scores 의 ws_<swId>_ 기록 또는 매쓰플랫 「학습완료」 · 교재 = 그 쪽(from~to)에 해당하는 <pid>_ 기록.
 *     자동 ✓ 는 저장하지 않고 화면에서만 센다(학원앱도 같은 규칙).
 *   스위치: stu_features.hw {on:true, off:['초6']} — 할 일 보드(stu_features.todo)와 따로. 보드가 잠겨 있어도 숙제 카드는 보인다.
 *   XP: 칸을 켤 때 「+5 XP」 글자만 보여 준다. 실제 점수는 학원앱 calcXP 가 todo_st_ 를 읽어 센다(§5). */
var HW={ bkReq:false };
function hwToday(){ return new Date(Date.now()+9*3600000).toISOString().slice(0,10); }
function hwAddDays(s,n){ var d=new Date(s+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
function hwOpen(){
  try{
    var c=(typeof SF!=='undefined' && SF.cfg) ? SF.cfg.hw : null;
    if(!c || c.on!==true) return false;
    var off=c.off;
    if(Array.isArray(off) && typeof sfMyGrade==='function' && off.indexOf(sfMyGrade())>=0) return false;
    return true;
  }catch(e){ return false; }
}
window.hwOpen=hwOpen;
function hwEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function hwCards(){ return (TD.items||[]).filter(function(it){ return it && it.id && it.hw===true; }); }
function hwKindOrd(k){ return k==='book'?0:(k==='ws'?1:(k==='etc'?2:3)); }
/* 오늘 숙제 — 마감이 오늘까지(지난 것 포함) · 선생님 확인 끝(ok)은 빼고 · 마감 빠른 것부터 */
function hwTodayCards(){
  var t=hwToday();
  return hwCards().filter(function(it){ return it.due && String(it.due)<=t && it.tst!=='ok'; }).sort(function(a,b){
    if(String(a.due)!==String(b.due)) return String(a.due)<String(b.due)?-1:1;
    return hwKindOrd(a.kind)-hwKindOrd(b.kind) || String(a.title||'').localeCompare(String(b.title||''));
  });
}
/* 그 주(월요일 mon ~ 일요일)에 마감인 숙제 카드 — 주간계획표 「선생님」 줄 */
function hwWeekCards(mon){
  var end=hwAddDays(mon,6);
  return hwCards().filter(function(it){ return it.due && String(it.due)>=mon && String(it.due)<=end; }).sort(function(a,b){ return hwKindOrd(a.kind)-hwKindOrd(b.kind); });
}
function hwIc(it){ var k=it&&it.kind; return k==='book'?'📗':(k==='ws'?'📄':(k==='vod'?'📺':'✏️')); }
/* 카드 제목 — 학원앱이 프린트 제목 앞에 붙인 「📄 」는 아이콘과 겹치니 뗀다 */
function hwTitle(it){ return String((it&&it.title)||'').replace(/^(📄|📗|📺|✏️)\s*/,''); }   /* 이모지는 두 글자라 [ ] 대신 | 로 */
function hwCls(it){ var k=it&&it.kind; return k==='book'?'book':(k==='ws'?'ws':(k==='vod'?'vod':'etc')); }
/* 학습지 카드 ↔ 내 학습지 목록(mf_wsq) — 카드 id 'a:ws:<wid>' 또는 wid · swId 로 잇는다 */
function hwWs(it){
  var list=(BK.wsq&&BK.wsq.list)||[]; if(!it) return null;
  var wid=it.wid!=null?String(it.wid):(String(it.id).indexOf('a:ws:')===0?String(it.id).slice(5):'');
  for(var i=0;i<list.length;i++){
    var w=list[i]; if(!w) continue;
    if(it.swId!=null && String(w.swId)===String(it.swId)) return w;
    if(wid && String(w.wid)===wid) return w;
  }
  return null;
}
/* 교재 카드의 쪽(from~to)에 해당하는 매쓰플랫 pid 들 — mf_swb_<코드>.books[].pages[{pid,page}] */
function hwBookPids(it){
  var books=(BK.swb&&BK.swb.books)||[]; var out=[];
  var from=Number(it.from), to=Number(it.to); if(!(from>0)) return out; if(!(to>=from)) to=from;
  var cand=books.filter(function(b){ return b && it.bookId!=null && (String(b.bid)===String(it.bookId) || String(b.id)===String(it.bookId)); });
  if(!cand.length && it.book) cand=books.filter(function(b){ return b && String(b.title||'')===String(it.book); });
  if(!cand.length && it.bookId==null && !it.book) cand=books.filter(function(b){ return b && String(b.title||'')===String(it.title||''); });
  cand.forEach(function(b){ (b.pages||[]).forEach(function(p){ var pg=Number(p&&p.page); if(p && p.pid!=null && pg>=from && pg<=to) out.push(String(p.pid)); }); });
  return out;
}
/* 채점 칸 자동 ✓ (§2-2) → { on, o, x, q, txt } — 저장하지 않는다 */
function hwAutoC(it){
  var sc=BK.scores||{}; var keys=Object.keys(sc);
  if(it.kind==='ws'){
    var w=hwWs(it); var swId=(w&&w.swId!=null)?w.swId:it.swId; var on=false, o=0, x=0, q=0;
    if(swId!=null){ var pre='ws_'+swId+'_'; keys.forEach(function(k){ if(k.indexOf(pre)!==0) return; on=true; var r=sc[k]&&sc[k].r; if(r==='O') o++; else if(r==='X') x++; else q++; }); }
    if(w){ if(String(w.status||'')==='학습완료') on=true; if(!o && !x && !q){ o=Number(w.o||0); x=Number(w.x||0); q=Number(w.q||0); } }
    var tot=o+x+q;
    return { on:on, o:o, x:x, q:q, txt: tot>0?('맞은 수 '+o+'/'+tot+(q?(' · ? '+q):'')):(on?'앱에서 채점했어요':'') };
  }
  if(it.kind==='book'){
    var pids=hwBookPids(it); var hit=false;
    for(var i=0;i<pids.length && !hit;i++){ var p=pids[i]+'_'; for(var j=0;j<keys.length;j++){ if(keys[j].indexOf(p)===0){ hit=true; break; } } }
    return { on:hit, o:0, x:0, q:0, txt: hit?'앱 「교재 채점」 기록이 있어요':'' };
  }
  return { on:false, o:0, x:0, q:0, txt:'' };
}
/* 내가 누른 4칸(저장값) — 0/100 만 */
function hwSelf(it){
  var s=TD.st[it.id]||{}; var h=(s&&s.hw)||{};
  return { p:h.p===100?100:0, c:h.c===100?100:0, w:h.w===100?100:0, a:h.a===100?100:0 };
}
/* 화면에 보이는 4칸 = 저장값 + 자동 ✓ */
function hwShown(it){ var h=hwSelf(it); var ac=hwAutoC(it); if(ac.on) h.c=100; return { h:h, ac:ac }; }
function hwCnt(h){ var n=0; ['p','c','w','a'].forEach(function(k){ if(h[k]===100) n++; }); return n; }
function hwDueTxt(it){
  if(!it.due) return '';
  var d=Math.round((Date.parse(hwToday()+'T00:00:00Z')-Date.parse(String(it.due)+'T00:00:00Z'))/86400000);
  if(d>0) return '<span class="late">🔴 '+d+'일 지남</span>';
  if(d===0) return '<b style="color:#b45309">오늘까지</b>';
  return '마감 '+String(it.due).slice(5).replace('-','/');
}
var HW_STEP=[['p','풀이','다 풀었어요'],['c','채점','답 맞춰 봤어요'],['w','오답','틀린 문제 다시 풀기'],['a','아하노트','왜 틀렸는지 한 줄']];
function hwCardHtml(it){
  var sh=hwShown(it); var h=sh.h, ac=sh.ac; var late=/지남/.test(hwDueTxt(it));
  var ht='<div class="hwc '+hwCls(it)+(late?' late':'')+'">';
  var rr='';
  if(it.kind==='book'){ var f=it.from, t=it.to; if(f!=null && f!=='') rr='p.'+hwEsc(f)+((t!=null && t!=='' && String(t)!==String(f))?('~'+hwEsc(t)):''); if(it.n!=null && it.n!=='') rr+=(rr?' · ':'')+hwEsc(it.n)+'문항'; }
  else if(it.kind==='ws'){ var w=hwWs(it); var n=(it.n!=null && it.n!=='')?it.n:(w&&w.n!=null?w.n:null); if(n!=null) rr=hwEsc(n)+'문항'; if(ac.o+ac.x+ac.q>0) rr+=(rr?' · ':'')+'◯ '+ac.o+' ✗ '+ac.x; }
  else if(it.kind==='vod'){ rr='영상'; }
  else { rr=(it.print?'프린트':'')+((it.n!=null && it.n!=='')?((it.print?' · ':'')+hwEsc(it.n)+'문항'):''); }
  ht+='<div class="hwc-t"><span class="ic">'+hwIc(it)+'</span><span class="tt">'+hwEsc(hwTitle(it)||(it.kind==='book'?(it.book||'교재'):'숙제'))+'</span>'+(rr?'<span class="rr">'+rr+'</span>':'')+'</div>';
  var sub=[]; var dt=hwDueTxt(it); if(dt) sub.push(dt); if(it.ref && it.kind!=='book') sub.push(hwEsc(it.ref));
  if(it.kind!=='vod') sub.push(hwCnt(h)+'/4 단계');
  if(sub.length) ht+='<div class="hwc-s">'+sub.join(' · ')+'</div>';
  if(it.kind==='vod'){
    ht+='<div class="hwc-vod">📺 영상 보기 — 강의실에서 끝까지 보면 자동으로 제출돼요</div>';
  } else {
    ht+='<div class="hws-row">';
    HW_STEP.forEach(function(st){
      var k=st[0]; var on=h[k]===100; var auto=(k==='c' && ac.on);
      ht+='<button type="button" class="hws'+(auto?' auto':(on?' on':''))+'" '+(auto?'title="'+hwEsc(ac.txt)+'" onclick="hwToggle('+hwQ(it.id)+',\'c\')"':'onclick="hwToggle('+hwQ(it.id)+',\''+k+'\')"')+' aria-pressed="'+(on?'true':'false')+'">'
         +'<span class="ck">'+((on||auto)?'✓':'')+'</span><span class="nm">'+st[1]+'</span><span class="xp">'+(auto?'자동':(on?'+5 XP':'대기'))+'</span></button>';
    });
    ht+='</div>';
    if(it.kind==='ws'){ if(ac.txt && !(ac.o+ac.x+ac.q>0)) ht+='<div class="hwc-s">'+hwEsc(ac.txt)+'</div>'; ht+='<button type="button" class="hwc-go" onclick="hwGoWs('+hwQ(it.id)+')">📄 학습지 채점으로 가기 ›</button>'; }
    else if(it.kind==='book' && ac.on) ht+='<div class="hwc-s">'+hwEsc(ac.txt)+'</div>';
  }
  return ht+'</div>';
}
function hwQ(s){ return "'"+String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/</g,'&lt;')+"'"; }
/* 홈 「📌 오늘 숙제」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다) */
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
/* 4칸 누르기 — todo_st_<내 코드>[카드id].hw 에만 쓴다 (todo_<코드> 는 안 건드린다) */
window.hwToggle=async function(id, k){
  if(!requireLogin(null,null,null)) return;
  var s=tdSb(); if(!s || isTest){ if(typeof toast==='function') toast('테스트 계정은 저장되지 않아요'); return; }
  var it=hwCards().filter(function(x){ return x.id===id; })[0]; if(!it) return;
  if(k==='c' && hwAutoC(it).on){ if(typeof toast==='function') toast('채점은 앱 기록으로 자동 ✓ 됐어요'); return; }
  if(['p','c','w','a'].indexOf(k)<0) return;
  var code=studentInfo.lumen_rec_code; var now=new Date().toISOString();
  var cur=TD.st[id]||{}; var hw=hwSelf(it); hw[k]=(hw[k]===100)?0:100;
  var rec={}; Object.keys(cur).forEach(function(kk){ rec[kk]=cur[kk]; });
  rec.hw=hw; rec.hat=now;
  /* st 규칙 — 보이는 칸(자동 ✓ 포함) 하나라도 100 → 최소 doing · 넷 다 → done · 더 앞선 상태는 내리지 않는다 */
  var shown={ p:hw.p, c:hw.c, w:hw.w, a:hw.a }; if(hwAutoC(it).on) shown.c=100;
  var n=hwCnt(shown); var want=n>=4?'done':(n>=1?'doing':null);
  var st=cur.st||'todo';
  if(want && TD_ORD[want]>TD_ORD[st]){ st=want; rec.at=now; }
  rec.st=st; if(!rec.at) rec.at=now; if(rec.photo==null) rec.photo='';
  TD.st[id]=rec;
  var v={}; Object.keys(TD.st).forEach(function(kk){ v[kk]=TD.st[kk]; }); v.upd=now;
  hwHomeUpdate(); try{ if(window.tdHomeUpdate) tdHomeUpdate(); }catch(e){}
  try{
    var r=await s.from('lumen_store').upsert({ key:'todo_st_'+code, value:v, updated_at:v.upd },{ onConflict:'key' });
    if(r && r.error) throw r.error;
    if(typeof toast==='function') toast(hw[k]===100?('✓ '+({p:'풀이',c:'채점',w:'오답',a:'아하노트'}[k])+' · +5 XP'):'되돌렸어요');
  }catch(e){ if(typeof toast==='function') toast('저장이 안 됐어요 — 잠시 후 다시 눌러 주세요'); }
};
/* 「📄 학습지 채점으로 가기」 — 기존 학습지 채점 화면(bkOpenWs) */
window.hwGoWs=async function(id){
  var it=hwCards().filter(function(x){ return x.id===id; })[0]; if(!it) return;
  if(isTest){ if(typeof toast==='function') toast('테스트 모드에서는 쓸 수 없어요'); return; }
  try{ if(!BK.loaded && typeof bkLoad==='function') await bkLoad(); }catch(e){}
  var w=hwWs(it);
  if(!w){ if(typeof toast==='function') toast('학습지 목록에 아직 없어요 — 📖 채점 › 📄 학습지에서 찾아 주세요'); go('screen-bookscore'); return; }
  BK.top='ws';
  await bkOpenWs(w.swId);
};
/* 📅 주간계획표 — 날짜 머리 아래 「🔒 선생님」 줄 (읽기만 · 저장 안 함 · 점수 계산에 안 들어감) */
window.hwWeekStripHtml=function(mon, today){
  if(!hwOpen()) return '';
  if(!TD.loaded){ if(!TD.busy && window.tdLoad) tdLoad(); return ''; }
  var cards=hwWeekCards(mon); if(!cards.length) return '';
  var t=today||hwToday();
  var h='<div class="wpc-hw" title="선생님이 내준 숙제 — 마감 날짜에 보여요"><div class="l">🔒</div>';
  for(var d=0; d<7; d++){
    var date=hwAddDays(mon,d);
    h+='<div class="c">';
    cards.forEach(function(it){
      if(String(it.due)!==date) return;
      var late=(date<t && it.tst!=='ok' && hwCnt(hwShown(it).h)<4);
      /* 칸이 좁다 — 아이콘 + 문항 수만. 누르면 제목·쪽을 토스트로 */
      var n=(it.n!=null && it.n!=='')?String(it.n):'';
      h+='<span class="hwi'+(late?' late':'')+'" title="'+hwEsc(hwStripTxt(it))+'" onclick="event.stopPropagation();hwStripTap('+hwQ(it.id)+')">'+hwIc(it)+(n?(' '+hwEsc(n)):'')+'</span>';
    });
    h+='</div>';
  }
  return h+'</div>';
};
function hwStripTxt(it){
  var t=hwIc(it)+' '+hwTitle(it);
  if(it.kind==='book' && it.from!=null && it.from!=='') t+=' p.'+it.from+((it.to!=null && it.to!=='' && String(it.to)!==String(it.from))?('~'+it.to):'');
  if(it.n!=null && it.n!=='') t+=' · '+it.n+'문항';
  return t+' · 마감 '+String(it.due||'').slice(5).replace('-','/');
}
window.hwStripTap=function(id){ var it=hwCards().filter(function(x){ return x.id===id; })[0]; if(!it) return; if(typeof toast==='function') toast('🔒 선생님 숙제 — '+hwStripTxt(it)); };
/* ★ v2-153 hw-end */
'''
rep("window.tdToggle=function(key){ var units=tdUnits(); var u=units.filter(function(x){ return x.key===key; })[0]; if(!u) return; var cur=TD.open[key]; var def=(u.left>0); TD.open[key]=(cur!=null)?!cur:!def; tdRender(); };\n",
    "window.tdToggle=function(key){ var units=tdUnits(); var u=units.filter(function(x){ return x.key===key; })[0]; if(!u) return; var cur=TD.open[key]; var def=(u.left>0); TD.open[key]=(cur!=null)?!cur:!def; tdRender(); };\n"
    + HW_JS)

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
