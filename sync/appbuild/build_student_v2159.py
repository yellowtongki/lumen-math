# -*- coding: utf-8 -*-
# 학생앱 v2-159 조립 — «v2-158 복사 + rep 고침»
#   원장 2026-11-05 「아코디언으로 접은 상태가 보이고 누르면 펼쳐지게」 → 시안 docs/mockup_student_hwcheck_fold.html
#   원장 결정: 기본 접힘 · 펼친 상태는 그날만 기억(날짜 바뀌면 접힘) · 접힌 줄에 네 단계 칩 + 종합 %
#   [무엇] ① 홈 「📚 숙제 체크」 카드(v2-158 #hw-home)를 아코디언으로. 기본은 **접힘**:
#             첫 줄 「📚 숙제 체크 · (요일) m/d 수업 · 종합 % · ▾」, 둘째 줄 풀이·채점·오답·아하 작은 칩 4개
#             (값 0/30/60/100 숫자 · 안 누름 「—」 · 아하 「없어요」면 「없음」 · 칩 색은 줄 색 s1~s4, 값 없으면 회색).
#             상태별 한 줄: 종합 0 이고 아무것도 안 누름 → 주황 「✍ 수업 전에 눌러 주세요」 · 체크 중/다 함 → 진행 막대
#             · 보고 있는 날짜에 선생님 확인값(hw_teach_<코드>.byDate[iso].t)이 있으면 파란 숫자 + 「✓ 선생님이 확인했어요」(칩은 선생님 값 ✓/◐/◔/○).
#          ② 카드 머리(첫 줄)를 누르면 v2-158 화면 전부(날짜 ◀▶ · 네 줄 눈금 · 없어요/있어요 · 안내 · 기록 줄)가 아래로 펼쳐지고 ▾ → ▴. 다시 누르면 접힘.
#             눈금 단추는 펼친 상태에서만 그린다(접힌 상태에는 없음).
#          ③ 기억: localStorage `hw_fold_open` = 펼친 날짜 'YYYY-MM-DD'. 오늘과 같으면 펼침, 아니면 접힘. 읽기·쓰기 모두 try/catch.
#   [안 바꾼 것] 자료·저장(hw_self_ 쓰기 · hw_teach_ 읽기 · 수업일 계산 · ◀▶ 범위) 은 v2-158 그대로. 다른 화면 · 고정 주소 student_v1.html 은 손대지 않는다.
#   실행: python3 sync/appbuild/build_student_v2159.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-158.html'); DST = os.path.join(ROOT, 'student_v2-159.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

def between(a, b, incl_b=False):
    """s 안에서 a 로 시작해 b 앞(incl_b 면 b 까지)까지 한 덩어리를 돌려준다 — rep 의 옛 글자로 쓴다(둘 다 정확히 1번이어야 한다)"""
    assert s.count(a) == 1 and s.count(b) == 1, (a[:50], s.count(a), b[:50], s.count(b))
    i = s.index(a); j = s.index(b); assert j > i
    return s[i:(j + len(b)) if incl_b else j]

rep("var STU_VER = 'v2-158';", "var STU_VER = 'v2-159';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-159 (2026-11-05) 📚 「숙제 체크」 카드를 접었다 펼치는 아코디언으로 (원장 2026-11-05 「아코디언으로 접은 상태가 보이고 누르면 펼쳐지게」 — 시안 docs/mockup_student_hwcheck_fold.html)\n"
    " *   · 홈에서는 기본으로 <b>접힌 두 줄</b>만 보입니다 — 「📚 숙제 체크 · 금 11/6 수업 · 종합 % · ▾」 + 풀이·채점·오답·아하 작은 칩 4개(숫자 · — · 없음).\n"
    " *   · 아직 아무것도 안 눌렀으면 주황 「✍ 수업 전에 눌러 주세요」, 체크 중이면 진행 막대, 선생님이 확인한 수업이면 파란 숫자와 「✓ 선생님이 확인했어요」.\n"
    " *   · 첫 줄을 누르면 v2-158 화면(날짜 ◀▶ · 네 줄 눈금 · 없어요/있어요 · 기록 줄)이 아래로 펼쳐지고(▾ → ▴), 다시 누르면 접힙니다.\n"
    " *   · 펼친 상태는 그날만 기억합니다(날짜가 바뀌면 다시 접힘). 저장 자료는 바뀌지 않습니다.\n"
    " *\n")

# ① 모양 — 접힘/펼침 CSS 를 v2-158 카드 CSS 바로 뒤(v2-153 주간계획표 CSS 앞)에 넣는다
rep("/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n",
    "/* ★ v2-159: 숙제 체크 카드 접힘/펼침 — 머리 줄(누르면 펼침) · 접힌 칩 4개 · 촉구/확인 줄 (시안 docs/mockup_student_hwcheck_fold.html) */\n"
    ".hwk-hd{cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}\n"
    ".hwk-hd .d{font-size:11px;color:#64748b;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}\n"
    ".hwk-hd .hwk-pct{font-size:20px}\n"
    ".hwk-ar{flex:none;width:22px;height:22px;border-radius:6px;background:#f1f5f9;color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;margin-left:2px}\n"
    ".hwk-chips{display:flex;gap:5px;margin-top:8px}\n"
    ".hwk-chip{flex:1;min-width:0;border-radius:8px;padding:4px 0;text-align:center;font-size:10.5px;font-weight:900;background:#f1f5f9;color:#94a3b8;line-height:1.3}\n"
    ".hwk-chip small{display:block;font-size:10px;font-weight:800;color:#94a3b8;font-variant-numeric:tabular-nums}\n"
    ".hwk-chip.s1{background:#dbeafe;color:#1d4ed8}.hwk-chip.s2{background:#fef3c7;color:#b45309}.hwk-chip.s3{background:#dcfce7;color:#15803d}.hwk-chip.s4{background:#f3e8ff;color:#7e22ce}\n"
    ".hwk-chip.s1 small,.hwk-chip.s2 small,.hwk-chip.s3 small,.hwk-chip.s4 small{color:inherit;opacity:.85}\n"
    ".hwk-chip.na{background:#f8fafc;color:#cbd5e1}.hwk-chip.na small{color:#cbd5e1}\n"
    ".hwk-nudge{margin-top:7px;border-radius:8px;padding:5px 9px;font-size:10.5px;font-weight:800;background:#fff7ed;color:#9a3412}\n"
    ".hwk-ok{margin-top:7px;border-radius:8px;padding:5px 9px;font-size:10.5px;font-weight:800;background:#eff6ff;color:#1e40af}\n"
    ".hwk-body{margin-top:2px}\n"
    "/* ★ v2-153: 📅 주간계획표 「🔒 선생님」 줄 (읽기만) */\n")

# ② 홈 카드 그리기 — v2-158 hwHomeUpdate 를 접힘/펼침 판으로 통째 바꾼다 (자료·저장 함수는 그대로)
OLD_FN = between("/* 홈 「📚 숙제 체크」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다 · 숙제 카드가 없어도 보인다) */\n",
                 "/* 날짜 ◀▶ — 지난 수업일(오늘-7일 안) ↔ 다음 수업일 */\n")
assert 'window.hwHomeUpdate=function(){' in OLD_FN and 'hwHistHtml(sel)' in OLD_FN and OLD_FN.count('el.innerHTML=h; el.style.display=\'block\';') == 1
NEW_FN = r'''/* ★ v2-159: 접힘/펼침 — localStorage hw_fold_open = 펼친 날짜('YYYY-MM-DD'). 오늘과 같으면 펼침, 아니면 접힘(날짜가 바뀌면 다시 접힘). 읽기·쓰기 모두 try/catch */
function hwFoldOpen(){ try{ return localStorage.getItem('hw_fold_open')===hwToday(); }catch(e){ return false; } }
function hwFoldSet(open){ try{ if(open) localStorage.setItem('hw_fold_open', hwToday()); else localStorage.removeItem('hw_fold_open'); }catch(e){} }
window.hwFoldOpen=hwFoldOpen;
/* 카드 머리(첫 줄)를 누르면 펼침 ↔ 접힘 */
window.hwFoldToggle=function(){ hwFoldSet(!hwFoldOpen()); hwHomeUpdate(); };
/* 선생님 확인값 한 단계 → 칩 글자 (100 ✓ · 60 ◐ · 30 ◔ · 0 ○ · 없으면 —) */
function hwTeachMark(v){ if(v==null || v==='' || isNaN(Number(v))) return '—'; v=hwVal(v); return v>=100?'✓':(v>=60?'◐':(v>=30?'◔':'○')); }
/* 접힌 줄 칩 4개 — h4: 내가 누른 값 · tr: 선생님 확인 기록(있으면 선생님 값 ✓/◐/◔/○ 로) */
function hwChipsHtml(h4, tr){
  var names=['풀이','채점','오답','아하'], keys=['p','c','w','a'], h='<div class="hwk-chips">';
  for(var i=0;i<4;i++){
    var k=keys[i], txt, cls='';
    if(tr){ txt=hwTeachMark(tr[k]); cls = txt==='—' ? (k==='a'?' na':'') : (' s'+(i+1)); }
    else if(k==='a'){ if(h4.aNone){ txt='없음'; cls=' na'; } else if(h4.aSet){ txt=String(h4.a); cls=' s4'; } else txt='—'; }
    else if(h4.set[k]){ txt=String(h4[k]); cls=' s'+(i+1); } else txt='—';
    h+='<span class="hwk-chip'+cls+'">'+names[i]+'<small>'+txt+'</small></span>';
  }
  return h+'</div>';
}
/* 홈 「📚 숙제 체크」 — tdHomeUpdate 가 부른다 (할 일 보드 잠김과 상관없이 hw 스위치만 본다 · 숙제 카드가 없어도 보인다)
 * v2-159: 기본 접힘(머리 줄 + 칩 4개 + 상태 한 줄) · 머리를 누르면 v2-158 화면(날짜 ◀▶ · 네 줄 눈금 · 기록 줄)이 펼쳐진다 */
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
  /* ★ v2-159: 접힘/펼침 · 접힌 상태에서 선생님 확인값이 있으면 파란 숫자(그 값)로 */
  var open=hwFoldOpen(); var tt=hwTeachOf(sel); var showT=(!open && tt!=null);
  var tr=(HW.teach && HW.teach.byDate && HW.teach.byDate[sel] && typeof HW.teach.byDate[sel]==='object')?HW.teach.byDate[sel]:{};
  var pressed = h4.set.p || h4.set.c || h4.set.w || h4.aSet || h4.aNone;
  var h='<div class="hwk-hd" onclick="hwFoldToggle()" role="button" aria-expanded="'+(open?'true':'false')+'"><span class="ic">📚</span><span class="t">숙제 체크</span><span class="d">'+lab+'</span>'
    +'<span class="hwk-pct" style="color:'+(showT?'#1d6fe8':hwPctColor(pct))+'">'+(showT?tt:pct)+'<small>%</small></span><span class="hwk-ar">'+(open?'▴':'▾')+'</span></div>';
  if(!open){
    h+=hwChipsHtml(h4, showT?tr:null);
    if(showT) h+='<div class="hwk-ok">✓ 선생님이 확인했어요'+(sel!==d0?(' · 다음 수업 '+HW_DOW[hwDow(d0)]+' '+hwMD(d0)+' 체크는 ▾ 눌러서'):'')+'</div>';
    else if(pct===0 && !pressed) h+='<div class="hwk-nudge">✍ 수업 전에 눌러 주세요 · 누르면 펼쳐져요</div>';
    else h+='<div class="hwk-bar"><i style="width:'+pct+'%"></i></div>';
    el.innerHTML=h; el.style.display='block'; return;
  }
  h+='<div class="hwk-body">';
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
  h+='</div>';
  el.innerHTML=h; el.style.display='block';
};
'''
rep(OLD_FN, NEW_FN)

# ③ 블록 표식 — v2-158 → v2-159 (검사가 이 표식으로 새 코드 덩어리를 찾는다)
rep("/* ★ v2-158 hwself-begin */\n", "/* ★ v2-159 hwself-begin */\n")
rep("/* ★ v2-158 hwself-end */\n", "/* ★ v2-159 hwself-end */\n")

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
