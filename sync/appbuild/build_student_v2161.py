# -*- coding: utf-8 -*-
# 학생앱 v2-161 조립 — «v2-160 복사 + rep 고침»
#   원장 2026-11-05 「학생앱 숙제체크 후에 제출기능이 없다」 → 설계서 docs/hw_dispatch_contract.md §11-1
#   [무엇] 홈 「📚 숙제 체크」 카드(v2-159 아코디언)에 **📤 선생님께 제출** 단추.
#          ① 펼친 카드 네 줄(아하노트 줄) 아래 · 안내·기록 줄 위에 큰 단추. 풀이·채점·오답 값이 모두 있고(0 포함)
#             아하노트가 「없어요」이거나 눈금을 골랐을 때만 눌린다. 아니면 회색 + 「풀이·채점·오답·아하노트를 모두 고르면 제출할 수 있어요」.
#          ② 누르면 hw_self_<코드>.byDate[수업일].sub = ISO (같은 upsert 길 hwSelfSave · 작성 시각 at 은 그대로) → 펼친 날짜 기억(hw_fold_open) 지우고 접힘
#             → 접힌 줄 초록 「✓ 제출함 · HH:MM · 수업 때 선생님이 확인해요」 · 토스트 「제출했어요」(서버 저장이 된 뒤).
#          ③ 제출한 날짜에서 눈금(또는 없어요/있어요)을 바꾸면 그 저장에서 sub 를 지우고 subPrev(앞 제출 시각)를 남긴다
#             → 단추 「📤 다시 제출」 · 접힌 줄 주황 「고친 내용은 다시 제출해 주세요」. 같은 값을 다시 누르면 아무 일도 없다(제출 유지).
#          ④ 값은 있는데 제출 전 → 접힌 줄 주황 「아직 제출 안 했어요 · ▾ 눌러 제출」 + v2-159 진행 막대. 아무것도 안 눌렀으면 「✍ 수업 전에 눌러 주세요」 그대로.
#          ⑤ 선생님 확인(hw_teach_)이 있는 날짜는 v2-159 대로 파란 숫자 · 「✓ 선생님이 확인했어요」 가 우선.
#          ⑥ 펼친 상태에서 제출된 날이면 단추 위 작은 초록 「✓ HH:MM 에 제출했어요」 · 단추는 비활성 「제출 완료」.
#          ⑦ 고침: v2-158 hwRecFor 가 눈금 하나만 눌러도 안 누른 풀이·채점·오답을 0 으로 채워 저장하던 것 → 고른 칸만 저장한다
#             (그래야 「일부만 고름」 을 알 수 있다. 학원앱 hwsOf 는 빈 칸을 null 로 읽어 그대로 맞는다. 이미 저장된 0 은 그대로 0).
#   [안 바꾼 것] 저장 키·upsert 길(hw_self_ onConflict key) · hw_teach_ 읽기 · 수업일 계산 · ◀▶ · 접힘 기억 규칙 · 다른 화면.
#          실서버에 쓰는 새 길 없음. 고정 주소 student_v1.html 은 손대지 않는다.
#   실행: python3 sync/appbuild/build_student_v2161.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-160.html'); DST = os.path.join(ROOT, 'student_v2-161.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-160';", "var STU_VER = 'v2-161';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-161 (2026-11-05) 📤 「숙제 체크」에 <b>선생님께 제출</b> 단추 (원장 2026-11-05 「학생앱 숙제체크 후에 제출기능이 없다」 — docs/hw_dispatch_contract.md §11-1)\n"
    " *   · 카드를 펼치면 네 줄 아래에 큰 단추 「📤 선생님께 제출」. 풀이·채점·오답을 모두 고르고 아하노트를 「없어요」 또는 눈금으로 골라야 눌립니다.\n"
    " *   · 제출하면 카드가 접히고 초록 「✓ 제출함 · 16:28 · 수업 때 선생님이 확인해요」. 학원앱은 제출 시각(sub)을 보고 「🙋 제출」로 보여 줍니다.\n"
    " *   · 제출 뒤 눈금을 고치면 제출이 풀리고 「📤 다시 제출」 · 접힌 줄 주황 「고친 내용은 다시 제출해 주세요」.\n"
    " *   · 골랐지만 제출 전이면 접힌 줄 주황 「아직 제출 안 했어요 · ▾ 눌러 제출」. 선생님이 확인한 날은 파란 「✓ 선생님이 확인했어요」가 먼저.\n"
    " *   · 눈금 하나만 눌러도 나머지 칸이 0 으로 저장되던 것을 고쳐, 고른 칸만 저장합니다.\n"
    " *\n")

# ① 모양 — 제출 단추 · 제출 줄 CSS (v2-159 접힘 CSS 끝 줄 뒤)
rep(".hwk-body{margin-top:2px}\n",
    ".hwk-body{margin-top:2px}\n"
    "/* ★ v2-161: 📤 선생님께 제출 — 단추 · 위 초록 글 · 아래 회색 안내 · 접힌 줄(초록 제출함 / 주황 제출 전·다시 제출) */\n"
    ".hwk-sbw{margin-top:11px}\n"
    ".hwk-sbt{font-size:11px;font-weight:800;color:#15803d;text-align:center;margin-bottom:5px}\n"
    ".hwk-sb{display:block;width:100%;border:none;border-radius:12px;padding:13px 0;font-size:15px;font-weight:900;font-family:inherit;background:var(--navy,#0d2240);color:#fff;cursor:pointer;box-shadow:0 3px 10px rgba(13,34,64,.22);-webkit-tap-highlight-color:transparent}\n"
    ".hwk-sb:active{transform:translateY(1px)}\n"
    ".hwk-sb:disabled{background:#e2e8f0;color:#94a3b8;box-shadow:none;cursor:default;transform:none}\n"
    ".hwk-sb.done:disabled{background:#dcfce7;color:#15803d}\n"
    ".hwk-sbn{font-size:10.5px;color:#94a3b8;font-weight:700;text-align:center;margin-top:5px}\n"
    ".hwk-subok{margin-top:7px;border-radius:8px;padding:5px 9px;font-size:10.5px;font-weight:800;background:#f0fdf4;color:#15803d}\n"
    ".hwk-subno{margin-top:7px;border-radius:8px;padding:5px 9px;font-size:10.5px;font-weight:800;background:#fff7ed;color:#c2410c}\n")

# ② hwSelfOf — 제출 시각 sub · 앞 제출 시각 subPrev 도 돌려준다
rep("""  return { p:hwVal(h.p), c:hwVal(h.c), w:hwVal(h.w), a:hwVal(h.a), aNone:h.aNone===true, aSet:(h.a!=null && h.aNone!==true), at:h.at||null, has:!!hwRawOf(date),
    set:{ p:h.p!=null, c:h.c!=null, w:h.w!=null } };
}
window.hwSelfOf=hwSelfOf;
""", """  return { p:hwVal(h.p), c:hwVal(h.c), w:hwVal(h.w), a:hwVal(h.a), aNone:h.aNone===true, aSet:(h.a!=null && h.aNone!==true), at:h.at||null, has:!!hwRawOf(date),
    set:{ p:h.p!=null, c:h.c!=null, w:h.w!=null },
    sub:h.sub||null, subPrev:h.subPrev||null };   /* ★ v2-161: sub = 선생님께 제출한 시각 · subPrev = 제출 뒤 고쳐서 풀린 앞 제출 시각 */
}
window.hwSelfOf=hwSelfOf;
/* ★ v2-161: 제출할 수 있나 — 풀이·채점·오답 값이 모두 있고(0 포함) 아하노트가 「없어요」이거나 눈금을 골랐을 때 */
function hwReady(h4){ return !!(h4 && h4.set.p && h4.set.c && h4.set.w && (h4.aNone || h4.aSet)); }
window.hwReady=hwReady;
""")

# ③ 펼친 카드 — 네 줄 아래 · 안내·기록 줄 위에 제출 단추
rep("""  h+='</div>';
  h+='<div class="hwk-tip'+(pct>=100?' done':'')+'">눈금을 누르면 바로 저장돼요 · 수업 때 선생님이 확인하면 파란색으로 바뀌어요</div>';
""", """  h+='</div>';
  h+=hwSubHtml(h4);   /* ★ v2-161: 📤 선생님께 제출 */
  h+='<div class="hwk-tip'+(pct>=100?' done':'')+'">눈금을 누르면 바로 저장돼요 · 수업 때 선생님이 확인하면 파란색으로 바뀌어요</div>';
""")

# ④ 접힌 카드 — 상태 한 줄 (선생님 확인 > 아무것도 안 누름 > 제출함 > 다시 제출 / 제출 전)
rep("""    if(showT) h+='<div class="hwk-ok">✓ 선생님이 확인했어요'+(sel!==d0?(' · 다음 수업 '+HW_DOW[hwDow(d0)]+' '+hwMD(d0)+' 체크는 ▾ 눌러서'):'')+'</div>';
    else if(pct===0 && !pressed) h+='<div class="hwk-nudge">✍ 수업 전에 눌러 주세요 · 누르면 펼쳐져요</div>';
    else h+='<div class="hwk-bar"><i style="width:'+pct+'%"></i></div>';
""", """    if(showT) h+='<div class="hwk-ok">✓ 선생님이 확인했어요'+(sel!==d0?(' · 다음 수업 '+HW_DOW[hwDow(d0)]+' '+hwMD(d0)+' 체크는 ▾ 눌러서'):'')+'</div>';
    else if(pct===0 && !pressed) h+='<div class="hwk-nudge">✍ 수업 전에 눌러 주세요 · 누르면 펼쳐져요</div>';
    else if(h4.sub){ var shm=hwHM(h4.sub); h+='<div class="hwk-subok">✓ 제출함'+(shm?(' · '+shm):'')+' · 수업 때 선생님이 확인해요</div>'; }   /* ★ v2-161 */
    else {
      h+='<div class="hwk-subno">'+(h4.subPrev?'고친 내용은 다시 제출해 주세요 · ▾ 눌러 제출':'아직 제출 안 했어요 · ▾ 눌러 제출')+'</div>';   /* ★ v2-161 */
      h+='<div class="hwk-bar"><i style="width:'+pct+'%"></i></div>';
    }
""")

# ⑤ 저장 기록 — 고른 칸만 · 앞 제출 시각은 subPrev 로 넘긴다(sub 는 안 넘긴다 = 고치면 제출이 풀린다)
rep("""function hwRecFor(sel){
  var raw=hwRawOf(sel)||{}; var rec={ p:hwVal(raw.p), c:hwVal(raw.c), w:hwVal(raw.w) };
  if(raw.aNone===true) rec.aNone=true; else if(raw.a!=null) rec.a=hwVal(raw.a);
  return rec;
}""", """function hwRecFor(sel){
  /* ★ v2-161: 고른 칸만 넣는다(v2-158 은 안 고른 풀이·채점·오답을 0 으로 채웠다 → 「일부만 고름」을 알 수 없었다) */
  var raw=hwRawOf(sel)||{}; var rec={};
  ['p','c','w'].forEach(function(k){ if(raw[k]!=null) rec[k]=hwVal(raw[k]); });
  if(raw.aNone===true) rec.aNone=true; else if(raw.a!=null) rec.a=hwVal(raw.a);
  /* ★ v2-161: 제출한 날을 고치면 sub 는 빠지고 앞 제출 시각만 subPrev 로 남는다(「다시 제출」 표시) */
  var ps=raw.sub||raw.subPrev; if(ps) rec.subPrev=ps;
  return rec;
}""")

# ⑥ 저장 함수 — keepAt(작성 시각 그대로 · 제출 때) · 성공/실패를 돌려준다
rep("""async function hwSelfSave(sel, rec){
  var s=tdSb(); var code=studentInfo.lumen_rec_code; var now=new Date().toISOString();
  if(!HW.self || typeof HW.self!=='object') HW.self={ byDate:{} }; if(!HW.self.byDate || typeof HW.self.byDate!=='object') HW.self.byDate={};
  rec.at=now; HW.self.byDate[sel]=rec; HW.self.upd=now;""", """async function hwSelfSave(sel, rec, keepAt){
  var s=tdSb(); var code=studentInfo.lumen_rec_code; var now=new Date().toISOString();
  if(!HW.self || typeof HW.self!=='object') HW.self={ byDate:{} }; if(!HW.self.byDate || typeof HW.self.byDate!=='object') HW.self.byDate={};
  if(!(keepAt && rec.at)) rec.at=now; HW.self.byDate[sel]=rec; HW.self.upd=now;   /* ★ v2-161: 제출(keepAt)은 작성 시각 at 을 그대로 둔다 */""")
rep("""    var r=await s.from('lumen_store').upsert({ key:'hw_self_'+code, value:v, updated_at:now },{ onConflict:'key' });
    if(r && r.error) throw r.error;
  }catch(e){ if(typeof toast==='function') toast('저장이 안 됐어요 — 잠시 후 다시 눌러 주세요'); }
}""", """    var r=await s.from('lumen_store').upsert({ key:'hw_self_'+code, value:v, updated_at:now },{ onConflict:'key' });
    if(r && r.error) throw r.error;
    return true;   /* ★ v2-161: 성공/실패를 돌려준다(제출 토스트용) */
  }catch(e){ if(typeof toast==='function') toast('저장이 안 됐어요 — 잠시 후 다시 눌러 주세요'); return false; }
}""")

# ⑦ 눈금 · 없어요/있어요 — 제출한 날에 같은 값을 다시 누르면 아무 일도 없다(제출 유지)
rep("""  var sel=hwSelDate(); var rec=hwRecFor(sel);
  if(k==='a'){ delete rec.aNone; }
  rec[k]=Number(v);
  hwSelfSave(sel, rec);
};""", """  var sel=hwSelDate(); var raw=hwRawOf(sel)||{};
  if(raw.sub && raw[k]!=null && hwVal(raw[k])===Number(v) && (k!=='a' || raw.aNone!==true)) return;   /* ★ v2-161: 바뀐 게 없으면 제출 그대로 */
  var rec=hwRecFor(sel);
  if(k==='a'){ delete rec.aNone; }
  rec[k]=Number(v);
  hwSelfSave(sel, rec);
};""")
rep("""  var sel=hwSelDate(); var rec=hwRecFor(sel);
  if(none){ rec.aNone=true; delete rec.a; }""", """  var sel=hwSelDate(); var raw=hwRawOf(sel)||{};
  if(raw.sub && (none ? raw.aNone===true : (raw.a!=null && raw.aNone!==true))) return;   /* ★ v2-161: 바뀐 게 없으면 제출 그대로 */
  var rec=hwRecFor(sel);
  if(none){ rec.aNone=true; delete rec.a; }""")

# ⑧ 제출 단추 HTML · 제출 — 「📄 학습지 채점으로 가기」 앞에 넣는다
rep("""/* 「📄 학습지 채점으로 가기」 — 학습지 id(swId)로 바로""", """/* ★ v2-161: 📤 제출 단추 — 제출됨: 위 초록 「✓ HH:MM 에 제출했어요」 + 비활성 「제출 완료」 · 고친 뒤: 「📤 다시 제출」 · 덜 고름: 회색 + 안내 */
function hwSubHtml(h4){
  var ok=hwReady(h4); var h='<div class="hwk-sbw">';
  if(h4.sub){
    var hm=hwHM(h4.sub);
    h+='<div class="hwk-sbt">✓ '+(hm?(hm+' 에 '):'')+'제출했어요</div>';
    h+='<button type="button" class="hwk-sb done" id="hw-submit" disabled>제출 완료</button>';
  } else {
    h+='<button type="button" class="hwk-sb" id="hw-submit" onclick="hwSubmit()"'+(ok?'':' disabled')+'>'+(h4.subPrev?'📤 다시 제출':'📤 선생님께 제출')+'</button>';
    if(!ok) h+='<div class="hwk-sbn">풀이·채점·오답·아하노트를 모두 고르면 제출할 수 있어요</div>';
  }
  return h+'</div>';
}
/* ★ v2-161: 제출 — hw_self_<코드>.byDate[수업일].sub = 지금(ISO) · 같은 저장 길(hwSelfSave → upsert onConflict key) · 펼친 날짜 기억 지우고 접힘 */
window.hwSubmit=async function(){
  if(!hwCanSave()) return;
  var sel=hwSelDate(); var h4=hwSelfOf(sel);
  if(h4.sub) return;
  if(!hwReady(h4)){ if(typeof toast==='function') toast('풀이·채점·오답·아하노트를 모두 골라 주세요'); return; }
  var raw=hwRawOf(sel)||{}; var rec=hwRecFor(sel); var now=new Date().toISOString();
  delete rec.subPrev; rec.sub=now; if(raw.at) rec.at=raw.at;
  hwFoldSet(false);   /* 접힌 카드로 다시 그린다(hwSelfSave 가 그린다) */
  var ok=await hwSelfSave(sel, rec, true);
  if(ok){ if(typeof toast==='function') toast('제출했어요'); return; }
  /* 저장이 안 됐으면 제출 표시를 되돌린다(저장 실패 토스트는 hwSelfSave 가 띄움) */
  var cur=hwRawOf(sel); if(cur && cur.sub===now){ delete cur.sub; if(raw.subPrev || raw.sub) cur.subPrev=raw.subPrev||raw.sub; }
  hwHomeUpdate();
};
/* 「📄 학습지 채점으로 가기」 — 학습지 id(swId)로 바로""")

# ⑨ 블록 표식 — v2-159 → v2-161 (검사가 이 표식으로 새 코드 덩어리를 찾는다)
rep("/* ★ v2-159 hwself-begin */\n", "/* ★ v2-161 hwself-begin */\n")
rep("/* ★ v2-159 hwself-end */\n", "/* ★ v2-161 hwself-end */\n")

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
