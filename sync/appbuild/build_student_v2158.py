# -*- coding: utf-8 -*-
# 학생앱 v2-158 조립 — «v2-157 복사 + rep 고침»
#   원장 2026-11-05 「추천대로 만들고 배포」 → docs/hw_dispatch_contract.md §10 숙제 체크 카드 2판 (시안 docs/mockup_student_hwcheck.html 2판 ①②③)
#   [무엇] ① 홈 「📚 숙제 체크」 카드를 2판 모양으로 바꾼다 — 흰 카드 · 머리 「📚 숙제 체크」 + 오른쪽 종합 % 큰 숫자 · 날짜 ◀▶ 줄(수업일 계산은 v2-155 그대로)
#             · 진행 막대 · 네 줄(풀이·채점·오답·아하노트) 각각 네 눈금 단추 0 안 함 / 30 조금 / 60 절반 넘게 / 100 다 함 (줄마다 색 s1~s4).
#             카드 자리는 「📌 오늘 할 일」 **위**(§10 「홈 맨 위 흰 카드」 · 공지·D-day 띠는 그대로 그 위).
#          ② 아하노트 줄 위에 「막힌 문제가 없어요 / 있어요」 두 칩. 「없어요」 → aNone:true 로 적고 a 는 지운다 · 눈금 흐림 · 「해당 없음」 · 종합은 셋 평균.
#             「있어요」 → aNone 지우고 a 눈금 저장(처음엔 0).
#          ③ 저장 hw_self_<코드>.byDate[수업일] = {p,c,w,a?,aNone?,at} 값 0/30/60/100 (v2-155 의 0/100 과 호환). upsert onConflict key. 학생앱만 쓴다(todo_·todo_st_ 안 씀).
#          ④ 카드 아래 **최근 5번 수업 기록 줄**(날짜 · 숫자) — 수업일 5개는 반 요일표로 거꾸로(요일표 없으면 적힌 날짜 최근 5개).
#             숫자 = hw_teach_<코드>.byDate[iso].t 있으면 파란색(선생님 확인) · 없으면 내 종합값 검정 · 둘 다 없으면 「—」.
#             hw_teach_<코드> 는 학원앱이 발행(v19-175) — 학생앱은 hw_self 와 같이 bkFetchStore 로 한 번에 읽기만.
#          ⑤ 「이번 숙제」 목록(카드·학습지)은 홈에서 뺀다(함수 hwCardsFor·hwWsFor·hwGoSw 는 남김). 📅 계획 탭 🔒 선생님 줄(v2-153)은 그대로.
#          ⑥ XP 글자·토스트 전부 없음(원장 11/5 「XP 관련은 삭제」). 안내 한 줄 「눈금을 누르면 바로 저장돼요 · 수업 때 선생님이 확인하면 파란색으로 바뀌어요」.
#   [안 바꾼 것] 수업일 계산·◀▶ 범위(오늘-7일 ~ 다음 수업일) · 스위치 stu_features.hw · 다른 화면 · 고정 주소 student_v1.html 은 손대지 않는다(배포는 원장 「배포」 때).
#   실행: python3 sync/appbuild/build_student_v2156.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-157.html'); DST = os.path.join(ROOT, 'student_v2-158.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

def between(a, b, incl_b=False):
    """s 안에서 a 로 시작해 b 앞(incl_b 면 b 까지)까지 한 덩어리를 돌려준다 — rep 의 옛 글자로 쓴다(둘 다 정확히 1번이어야 한다)"""
    assert s.count(a) == 1 and s.count(b) == 1, (a[:50], s.count(a), b[:50], s.count(b))
    i = s.index(a); j = s.index(b); assert j > i
    return s[i:(j + len(b)) if incl_b else j]

rep("var STU_VER = 'v2-157';", "var STU_VER = 'v2-158';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-158 (2026-11-05) 📚 「숙제 체크」 카드 2판 — 네 눈금 · 아하노트 「없어요」 · 기록 줄 (원장 2026-11-05 「추천대로 만들고 배포」 — docs/hw_dispatch_contract.md §10)\n"
    " *   · 홈 맨 위(「📌 오늘 할 일」 위) 흰 카드 <b>📚 숙제 체크 · 수 11/5 수업</b>. 오른쪽 위에 종합 %, 아래 진행 막대.\n"
    " *   · 풀이 · 채점 · 오답 · 아하노트 네 줄마다 <b>0 안 함 · 30 조금 · 60 절반 넘게 · 100 다 함</b> 네 눈금(학원앱 숙제체크와 같은 눈금). 누르면 바로 저장, 다시 누르면 바뀜.\n"
    " *   · 아하노트 줄 위 <b>「막힌 문제가 없어요 / 있어요」</b> — 없어요면 아하노트는 해당 없음, 종합은 세 단계 평균.\n"
    " *   · 카드 아래 <b>최근 5번 수업 기록 줄</b> — 파란 숫자 = 선생님이 확인한 값, 검은 숫자 = 내가 누른 값(확인 전), — = 기록 없음.\n"
    " *   · 홈의 「이번 숙제」 목록은 뺐습니다(📅 계획 탭 🔒 선생님 줄은 그대로). XP 표시는 없습니다.\n"
    " *\n")

# ① 모양 — v2-155 의 .hwd 묶음을 2판 카드(.hwk) 로 통째 바꾼다 (시안 .hw/.seg/.aha/.hist 를 학생앱 색·글꼴에 맞춤)
OLD_CSS = between("/* ★ v2-155: 📚 숙제 체크 — 날짜 단위 4칸 (hw_self_<코드>) */\n", "/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n")
assert '.hwd{' in OLD_CSS and '.hwd-empty{' in OLD_CSS
NEW_CSS = (
    "/* ★ v2-158: 📚 숙제 체크 카드 2판 — 흰 카드 · 네 눈금 · 아하노트 칩 · 기록 줄 (docs/hw_dispatch_contract.md §10) */\n"
    ".hwh.hwk{background:#fff;border-radius:18px;padding:12px 13px 11px;box-shadow:0 2px 10px rgba(13,34,64,.06);color:#0f172a}\n"
    ".hwk-hd{display:flex;align-items:center;gap:6px}\n"
    ".hwk-hd .ic{font-size:15px}.hwk-hd .t{font-size:14px;font-weight:900;color:#0d2240}\n"
    ".hwk-pct{margin-left:auto;font-size:24px;font-weight:900;line-height:1;font-variant-numeric:tabular-nums}\n"
    ".hwk-pct small{font-size:11px;font-weight:800;color:#64748b;margin-left:2px}\n"
    ".hwk-dt{display:flex;align-items:center;gap:6px;margin-top:7px;font-size:12px;color:#475569;font-weight:800}\n"
    ".hwk-dt button{font-family:inherit;flex:none;width:30px;height:28px;border-radius:8px;border:none;background:#f1f5f9;color:#64748b;font-weight:900;font-size:12px;cursor:pointer}\n"
    ".hwk-dt button:disabled{opacity:.3;cursor:default}\n"
    ".hwk-dt .d{flex:1;min-width:0;text-align:center;line-height:1.3}\n"
    ".hwk-dt .d small{display:block;font-size:10px;color:#94a3b8;font-weight:700}\n"
    ".hwk-bar{height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden;margin-top:8px}.hwk-bar i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#22c55e);transition:width .25s}\n"
    ".hwk-st{margin-top:8px}\n"
    ".hwk-r{padding:7px 0;border-top:1px dashed #e2e8f0}.hwk-r:first-child{border-top:none}\n"
    ".hwk-r .l{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:900;color:#0d2240}\n"
    ".hwk-r .l small{font-size:10.5px;color:#64748b;font-weight:700}\n"
    ".hwk-r .l .v{margin-left:auto;font-size:12.5px;font-weight:900;font-variant-numeric:tabular-nums}\n"
    ".hwk-r.s1 .v{color:#3b82f6}.hwk-r.s2 .v{color:#f59e0b}.hwk-r.s3 .v{color:#22c55e}.hwk-r.s4 .v{color:#a855f7}\n"
    ".hwk-r .l .v.mute{color:#94a3b8}\n"
    ".hwk-seg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin-top:5px}\n"
    ".hwk-seg button{font-family:inherit;border-radius:8px;padding:5px 0 4px;text-align:center;font-size:11px;font-weight:900;background:#f1f5f9;color:#94a3b8;border:1.5px solid transparent;cursor:pointer;min-width:0;line-height:1.3}\n"
    ".hwk-seg button small{display:block;font-size:9px;font-weight:800;color:#94a3b8;white-space:nowrap}\n"
    ".hwk-seg button.on{color:#fff}.hwk-seg button.on small{color:rgba(255,255,255,.85)}\n"
    ".hwk-r.s1 .hwk-seg button.on{background:#3b82f6}.hwk-r.s2 .hwk-seg button.on{background:#f59e0b}.hwk-r.s3 .hwk-seg button.on{background:#22c55e}.hwk-r.s4 .hwk-seg button.on{background:#a855f7}\n"
    ".hwk-r .hwk-seg button.on.z{background:#94a3b8}\n"
    ".hwk-seg.soft{opacity:.7}.hwk-seg.dim{opacity:.45}.hwk-seg.dim button{cursor:default}\n"
    ".hwk-aha{display:flex;gap:5px;align-items:center;margin-top:5px;flex-wrap:wrap}\n"
    ".hwk-aha .q{font-size:10.5px;color:#64748b;font-weight:800}\n"
    ".hwk-aha button{font-family:inherit;border-radius:20px;padding:3px 10px;font-size:10.5px;font-weight:900;border:1.5px solid #cbd5e1;background:#fff;color:#64748b;cursor:pointer}\n"
    ".hwk-aha button.on{background:#0d2240;color:#fff;border-color:#0d2240}\n"
    ".hwk-na{margin-top:5px;border-radius:8px;padding:5px 8px;background:#f8fafc;color:#94a3b8;font-size:10.5px;font-weight:800;text-align:center}\n"
    ".hwk-tip{margin-top:9px;border-radius:9px;padding:6px 9px;font-size:10.5px;font-weight:800;background:#f8fafc;color:#64748b;line-height:1.45}\n"
    ".hwk-tip.done{background:#f0fdf4;color:#15803d}\n"
    ".hwk-hist{display:flex;gap:4px;margin-top:8px}\n"
    ".hwk-hist>div{flex:1;min-width:0;border-radius:7px;background:#f1f5f9;padding:4px 0;text-align:center}\n"
    ".hwk-hist>div.sel{outline:1.5px solid #cbd5e1}\n"
    ".hwk-hist .d{font-size:9px;font-weight:800;color:#94a3b8}\n"
    ".hwk-hist .p{font-size:12px;font-weight:900;color:#0d2240;font-variant-numeric:tabular-nums}\n"
    ".hwk-hist .p.t{color:#1d6fe8}.hwk-hist .p.e{color:#cbd5e1}\n"
    ".hwk-tip2{font-size:9.5px;color:#94a3b8;font-weight:700;margin-top:5px;line-height:1.5}\n")
rep(OLD_CSS, NEW_CSS)

# ② 자리 — 「📌 오늘 할 일」 아래 → 위 (§10 「홈 맨 위 흰 카드」). 어두운 .tdb-bell 틀은 벗긴다(흰 카드)
rep("    <!-- v2-153: 📌 오늘 숙제 (hwHomeUpdate · stu_features.hw 로 학년별 켬) -->\n"
    "    <div id=\"hw-home\" class=\"hwh tdb-bell\" style=\"display:none\"></div>\n", "")
rep("    <!-- v2-34(C안): 📌 오늘 할 일 — 매일 하는 두 가지 (모양 그대로 · v2-116) -->\n",
    "    <!-- v2-158: 📚 숙제 체크 카드 2판 (hwHomeUpdate · stu_features.hw 로 학년별 켬 · 「📌 오늘 할 일」 위) -->\n"
    "    <div id=\"hw-home\" class=\"hwh hwk\" style=\"display:none\"></div>\n"
    "    <!-- v2-34(C안): 📌 오늘 할 일 — 매일 하는 두 가지 (모양 그대로 · v2-116) -->\n")

# ③ HW 상태 칸 — 선생님 확인값(hw_teach_<코드>) 추가
rep("var HW={ bkReq:false, loaded:false, busy:false, self:null, days:null, sel:null, for:'' };",
    "var HW={ bkReq:false, loaded:false, busy:false, self:null, teach:null, days:null, sel:null, for:'' };   /* ★ v2-158: teach = hw_teach_<코드>(학원앱 발행 · 읽기만) */")

# ④ 홈 카드 — v2-155 hwself 블록을 2판 블록으로 통째 바꾼다
OLD_HOME = between("/* ★ v2-155 hwself-begin */\n", "/* ★ v2-155 hwself-end */\n", incl_b=True)
assert 'window.hwSelfToggle=' in OLD_HOME and 'hwCardRoHtml' in OLD_HOME
NEW_HOME = r'''/* ★ v2-158 hwself-begin */
/* ═══════════════ v2-158: 📚 숙제 체크 카드 2판 (docs/hw_dispatch_contract.md §10 · 시안 docs/mockup_student_hwcheck.html) ═══════════════
 * 저장 hw_self_<내 코드> = { byDate:{ 'YYYY-MM-DD':{ p,c,w, a?, aNone?, at } }, upd }  값 0/30/60/100 (v2-155 의 0/100 과 호환) ← 학생앱만 쓴다.
 *   아하노트 「막힌 문제가 없어요」 → aNone:true 로 적고 a 는 지운다 · 「있어요」 → aNone 지우고 a 눈금(처음 0) 저장.
 *   종합 % = 네 눈금 평균 · aNone 이면 풀이·채점·오답 셋 평균.
 * 읽기 hw_teach_<내 코드> = { byDate:{ iso:{p,c,w,t} }, upd } ← 학원앱이 발행(선생님 확인 · v19-175). 기록 줄의 파란 숫자. 학생앱은 읽기만.
 * 날짜 = 그 숙제를 확인받는 수업일(다음 수업일 · 오늘이 수업일이면 오늘 · 요일표 없으면 오늘). ◀▶ 지난 수업일(오늘-7일 안) ↔ 다음 수업일 (v2-155 그대로).
 * 숙제 목록(카드·학습지)은 홈에서 뺐다(📅 계획 탭 🔒 선생님 줄만). XP 글자·토스트 없음(원장 11/5).
 * v2-153 의 카드 단위 4칸(hwToggle·hwCardHtml)은 남겨 두되 화면에서는 안 쓴다. */
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
/* hw_self_<코드> + hw_teach_<코드> + lumen_group_days — 한 번에 읽는다(묻는 중이면 또 묻지 않는다) */
window.hwLoad=async function(force){
  if(HW.busy) return; if(HW.loaded && !force) return;
  var s=tdSb(); if(!s || !studentInfo || isTest){ HW.loaded=true; return; }
  HW.busy=true; var code=studentInfo.lumen_rec_code;
  try{
    var st=await bkFetchStore(['hw_self_'+code,'hw_teach_'+code,'lumen_group_days']);
    var v=st['hw_self_'+code]; HW.self=(v && typeof v==='object' && v.byDate && typeof v.byDate==='object')?v:{ byDate:{} };
    var tv=st['hw_teach_'+code]; HW.teach=(tv && typeof tv==='object' && tv.byDate && typeof tv.byDate==='object')?tv:null;
    HW.days=st['lumen_group_days']||null;
  }catch(e){ if(!HW.self) HW.self={ byDate:{} }; }
  HW.loaded=true; HW.busy=false; HW.for=code;
};
/* 눈금 — 0/30/60/100 으로 맞춘다(옛 0/100 값도 그대로 · 다른 숫자는 가까운 아래 눈금) */
var HW_VALS=[0,30,60,100];
function hwVal(x){ x=Number(x); if(isNaN(x)) return 0; if(HW_VALS.indexOf(x)>=0) return x; return x>=100?100:(x>=60?60:(x>=30?30:0)); }
function hwRawOf(date){ var m=(HW.self && HW.self.byDate)||{}; var h=m[date]; return (h && typeof h==='object')?h:null; }
/* 그 날짜에 내가 누른 값 — p,c,w,a(0/30/60/100) · aNone(막힌 문제 없어요) · aSet(「있어요」 골라 a 를 적음) · has(그 날짜 기록 있음) */
function hwSelfOf(date){
  var h=hwRawOf(date)||{};
  return { p:hwVal(h.p), c:hwVal(h.c), w:hwVal(h.w), a:hwVal(h.a), aNone:h.aNone===true, aSet:(h.a!=null && h.aNone!==true), at:h.at||null, has:!!hwRawOf(date),
    set:{ p:h.p!=null, c:h.c!=null, w:h.w!=null } };
}
window.hwSelfOf=hwSelfOf;
/* 종합 % — 네 눈금 평균 · 「없어요」면 풀이·채점·오답 셋 평균 */
function hwPct(h){ if(!h) return 0; var ks=h.aNone?['p','c','w']:['p','c','w','a']; var sum=0; ks.forEach(function(k){ sum+=hwVal(h[k]); }); return Math.round(sum/ks.length); }
window.hwPct=hwPct;
function hwPctColor(p){ return p>=100?'#22c55e':(p>0?'#f59e0b':'#94a3b8'); }
function hwHM(iso){ try{ var d=new Date(iso); if(isNaN(d.getTime())) return ''; var k=new Date(d.getTime()+9*3600000); return ('0'+k.getUTCHours()).slice(-2)+':'+('0'+k.getUTCMinutes()).slice(-2); }catch(e){ return ''; } }
/* 선생님 확인값 — hw_teach_<코드>.byDate[날짜].t (없으면 null) */
function hwTeachOf(date){ var m=(HW.teach && HW.teach.byDate)||{}; var h=m[date]; if(h && typeof h==='object' && h.t!=null && h.t!=='' && !isNaN(Number(h.t))) return Math.round(Number(h.t)); return null; }
window.hwTeachOf=hwTeachOf;
/* 기록 줄 날짜 5개 — 다음 수업일부터 반 요일표로 거꾸로 세기 · 요일표 없으면 hw_self·hw_teach 에 적힌 날짜(다음 수업일 포함) 최근 5개 */
function hwHistDates(){
  var d0=hwClassDate(); var out=[];
  if(hwDays()){ out.push(d0); for(var i=1;i<=60 && out.length<5;i++){ var x=hwAddDays(d0,-i); if(hwIsClass(x)) out.push(x); } out.reverse(); return out; }
  var set={}; set[d0]=1;
  [(HW.self && HW.self.byDate), (HW.teach && HW.teach.byDate)].forEach(function(m){ if(m && typeof m==='object') Object.keys(m).forEach(function(k){ if(/^\d{4}-\d{2}-\d{2}$/.test(k) && k<=d0) set[k]=1; }); });
  return Object.keys(set).sort().slice(-5);
}
window.hwHistDates=hwHistDates;
function hwHistHtml(sel){
  var ds=hwHistDates(); var h='<div class="hwk-hist">';
  ds.forEach(function(d){
    var t=hwTeachOf(d); var v, cls='';
    if(t!=null){ v=t; cls=' t'; } else if(hwRawOf(d)){ v=hwPct(hwSelfOf(d)); } else { v='—'; cls=' e'; }
    h+='<div class="'+(d===sel?'sel':'')+'"><div class="d">'+hwMD(d)+'</div><div class="p'+cls+'">'+v+'</div></div>';
  });
  return h+'</div>';
}
/* 「이번 숙제」 재료 — 이 판에서는 홈에 그리지 않는다(함수만 남김) */
function hwCardsFor(date){
  var mn=hwAddDays(date,-7);
  return hwCards().filter(function(it){ return it.due && String(it.due)<=date && String(it.due)>mn && it.tst!=='ok'; }).sort(function(a,b){
    return hwKindOrd(a.kind)-hwKindOrd(b.kind) || String(a.due).localeCompare(String(b.due)) || String(a.title||'').localeCompare(String(b.title||''));
  });
}
function hwWsFor(date){
  var list=(BK.wsq && BK.wsq.list)||[]; var mn=hwAddDays(date,-7);
  return list.filter(function(w){ if(!w || String(w.tag||'')!=='HOMEWORK') return false; var d=String(w.date||'').slice(0,10); return d && d<=date && d>mn; })
    .sort(function(a,b){ return String(b.date||'').localeCompare(String(a.date||'')) || String(a.title||'').localeCompare(String(b.title||'')); });
}
window.hwWsFor=hwWsFor;
var HW_SELF_STEP=[['p','풀이','문제 풀기'],['c','채점','답 맞춰 보기'],['w','오답','틀린 문제 다시'],['a','아하노트','왜 틀렸는지']];
var HW_SEG=[[0,'안 함'],[30,'조금'],[60,'절반 넘게'],[100,'다 함']];
/* 네 눈금 단추 한 줄 — cur: 지금 값 · chosen: 값을 고른 적 있음(아니면 아무것도 안 켬) · dim: 「없어요」(흐림·못 누름) · soft: 아직 안 고름(살짝 흐림) */
function hwSegHtml(k, cur, chosen, dim, soft){
  var h='<div class="hwk-seg'+(dim?' dim':(soft?' soft':''))+'">';
  HW_SEG.forEach(function(sg){
    var on=chosen && !dim && cur===sg[0];
    h+='<button type="button" class="'+(on?('on'+(sg[0]===0?' z':'')):'')+'" onclick="hwSelfSet(\''+k+'\','+sg[0]+')" aria-pressed="'+(on?'true':'false')+'"'+(dim?' disabled':'')+'>'+sg[0]+'<small>'+sg[1]+'</small></button>';
  });
  return h+'</div>';
}
/* 홈 「📚 숙제 체크」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다 · 숙제 카드가 없어도 보인다) */
window.hwHomeUpdate=function(){
  var el=document.getElementById('hw-home'); if(!el) return;
  if(!hwOpen()){ el.style.display='none'; el.innerHTML=''; return; }
  if(!HW.loaded){ el.style.display='none'; if(!HW.busy){ try{ hwLoad().then(function(){ hwHomeUpdate(); }, function(){}); }catch(e){} } return; }
  var t=hwToday(); var d0=hwClassDate(); var sel=hwSelDate(); var h4=hwSelfOf(sel); var pct=hwPct(h4);
  var prev=hwPrevClass(sel), next=hwNextClass(sel);
  var lab=HW_DOW[hwDow(sel)]+' '+hwMD(sel)+' 수업';
  var base = sel===t ? '오늘 수업' : (sel===d0 ? '다음 수업' : ('지난 수업 ' + Math.round((Date.parse(t+'T00:00:00Z')-Date.parse(sel+'T00:00:00Z'))/86400000) + '일 전'));
  var hint;
  if(h4.has && h4.at){ var hm=hwHM(h4.at); hint=(pct>=100?'다 했어요 🎉':'저장됨')+(hm?(' · '+hm):''); }
  else hint = sel===t ? '수업 전에 눌러 두세요' : (sel===d0 ? '수업 전까지 누르면 돼요' : '아직 안 눌렀어요');
  var h='<div class="hwk-hd"><span class="ic">📚</span><span class="t">숙제 체크</span><span class="hwk-pct" style="color:'+hwPctColor(pct)+'">'+pct+'<small>%</small></span></div>';
  h+='<div class="hwk-dt">'
    +'<button type="button" onclick="hwNav(-1)" '+(prev?'':'disabled')+' aria-label="지난 수업일">◀</button>'
    +'<div class="d">'+lab+'<small>'+base+' · '+hint+'</small></div>'
    +'<button type="button" onclick="hwNav(1)" '+(next?'':'disabled')+' aria-label="다음 수업일">▶</button></div>';
  h+='<div class="hwk-bar"><i style="width:'+pct+'%"></i></div>';
  h+='<div class="hwk-st">';
  HW_SELF_STEP.forEach(function(st, i){
    var k=st[0];
    h+='<div class="hwk-r s'+(i+1)+'"><div class="l">'+(i+1)+' '+st[1]+' <small>'+st[2]+'</small>';
    if(k==='a'){
      var vtxt = h4.aNone ? '해당 없음' : (h4.aSet ? (h4.a+'%') : '—');
      h+='<span class="v'+((h4.aNone||!h4.aSet)?' mute':'')+'">'+vtxt+'</span></div>';
      h+='<div class="hwk-aha"><span class="q">막힌 문제가</span>'
        +'<button type="button" class="'+(h4.aNone?'on':'')+'" onclick="hwAhaNone(true)" aria-pressed="'+(h4.aNone?'true':'false')+'">없어요</button>'
        +'<button type="button" class="'+(h4.aSet?'on':'')+'" onclick="hwAhaNone(false)" aria-pressed="'+(h4.aSet?'true':'false')+'">있어요</button></div>';
      if(h4.aNone) h+='<div class="hwk-na">막힌 문제가 없으면 아하노트는 빼고 세 단계로 계산해요</div>';
      h+=hwSegHtml('a', h4.a, h4.aSet, h4.aNone, !h4.aSet);
    } else {
      var chosen=h4.set[k];
      h+='<span class="v'+(chosen?'':' mute')+'">'+(chosen?(h4[k]+'%'):'—')+'</span></div>';
      h+=hwSegHtml(k, h4[k], chosen, false, false);
    }
    h+='</div>';
  });
  h+='</div>';
  h+='<div class="hwk-tip'+(pct>=100?' done':'')+'">눈금을 누르면 바로 저장돼요 · 수업 때 선생님이 확인하면 파란색으로 바뀌어요</div>';
  h+=hwHistHtml(sel);
  h+='<div class="hwk-tip2">최근 5번 수업 · 파란 숫자 = 선생님이 확인한 값 · 검은 숫자 = 내가 누른 값(아직 확인 전)</div>';
  el.innerHTML=h; el.style.display='block';
};
/* 날짜 ◀▶ — 지난 수업일(오늘-7일 안) ↔ 다음 수업일 */
window.hwNav=function(dir){
  var sel=hwSelDate(); var d=dir<0?hwPrevClass(sel):hwNextClass(sel);
  if(!d){ if(typeof toast==='function') toast(dir<0?'7일 전까지만 되돌아갈 수 있어요':'다음 수업일까지만 볼 수 있어요'); return; }
  HW.sel=d; hwHomeUpdate();
};
/* 저장할 기록 — 그 날짜의 지금 값에서 시작(p,c,w 는 늘 숫자 · a 는 「있어요」일 때만 · aNone 은 「없어요」일 때만) */
function hwRecFor(sel){
  var raw=hwRawOf(sel)||{}; var rec={ p:hwVal(raw.p), c:hwVal(raw.c), w:hwVal(raw.w) };
  if(raw.aNone===true) rec.aNone=true; else if(raw.a!=null) rec.a=hwVal(raw.a);
  return rec;
}
/* hw_self_<내 코드>.byDate[수업일] 에만 쓴다 (todo_st_·todo_ 는 안 건드린다) — 성공 토스트 없음(날짜 줄에 「저장됨 · 시각」) */
async function hwSelfSave(sel, rec){
  var s=tdSb(); var code=studentInfo.lumen_rec_code; var now=new Date().toISOString();
  if(!HW.self || typeof HW.self!=='object') HW.self={ byDate:{} }; if(!HW.self.byDate || typeof HW.self.byDate!=='object') HW.self.byDate={};
  rec.at=now; HW.self.byDate[sel]=rec; HW.self.upd=now;
  var v={ byDate:{}, upd:now }; Object.keys(HW.self.byDate).forEach(function(d){ v.byDate[d]=HW.self.byDate[d]; });
  hwHomeUpdate();
  try{
    var r=await s.from('lumen_store').upsert({ key:'hw_self_'+code, value:v, updated_at:now },{ onConflict:'key' });
    if(r && r.error) throw r.error;
  }catch(e){ if(typeof toast==='function') toast('저장이 안 됐어요 — 잠시 후 다시 눌러 주세요'); }
}
function hwCanSave(){
  if(!requireLogin(null,null,null)) return false;
  var s=tdSb(); if(!s || isTest){ if(typeof toast==='function') toast('테스트 계정은 저장되지 않아요'); return false; }
  if(!HW.loaded){ if(typeof toast==='function') toast('잠깐만요 — 불러오는 중이에요'); return false; }
  return true;
}
/* 눈금 누르기 — k: p/c/w/a · v: 0/30/60/100. 아하노트 눈금을 누르면 「있어요」로 본다 */
window.hwSelfSet=function(k, v){
  if(['p','c','w','a'].indexOf(k)<0 || HW_VALS.indexOf(Number(v))<0) return;
  if(!hwCanSave()) return;
  var sel=hwSelDate(); var rec=hwRecFor(sel);
  if(k==='a'){ delete rec.aNone; }
  rec[k]=Number(v);
  hwSelfSave(sel, rec);
};
/* 「막힌 문제가 없어요 / 있어요」 — 없어요: aNone:true · a 지움 / 있어요: aNone 지움 · a 는 그대로(없으면 0) */
window.hwAhaNone=function(none){
  if(!hwCanSave()) return;
  var sel=hwSelDate(); var rec=hwRecFor(sel);
  if(none){ rec.aNone=true; delete rec.a; }
  else { delete rec.aNone; if(rec.a==null) rec.a=0; }
  hwSelfSave(sel, rec);
};
/* 「📄 학습지 채점으로 가기」 — 학습지 id(swId)로 바로 (기존 학습지 채점 화면 bkOpenWs) · 이 판 홈에는 단추가 없지만 함수는 남긴다 */
window.hwGoSw=async function(swId){
  if(isTest){ if(typeof toast==='function') toast('테스트 모드에서는 쓸 수 없어요'); return; }
  try{ if(!BK.loaded && typeof bkLoad==='function') await bkLoad(); }catch(e){}
  var list=(BK.wsq && BK.wsq.list)||[]; var w=null;
  for(var i=0;i<list.length;i++){ if(list[i] && String(list[i].swId)===String(swId)){ w=list[i]; break; } }
  if(!w){ if(typeof toast==='function') toast('학습지 목록에 아직 없어요 — 📖 채점 › 📄 학습지에서 찾아 주세요'); go('screen-bookscore'); return; }
  BK.top='ws';
  await bkOpenWs(w.swId);
};
/* ★ v2-158 hwself-end */
'''
rep(OLD_HOME, NEW_HOME)

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
