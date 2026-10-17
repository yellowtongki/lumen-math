# 학생앱 v2-140 조립 — «v2-139(지금 학생 주소) 복사 + rep 고침»  ※ v2-137(수학퀴즈, 미배포)은 아직 안 합침
#   원장 2026-10-17 「정답 시도가 2번이라 못 맞췄다는 학생이 있다 · 주관식은 여러 번도 괜찮다」
#   → 다시 도전(2차·3차) 안에서 «주관식은 5번까지», «객관식(고르는 문항)은 지금처럼 1번».
#   · 1차 기록(r·a·at)과 매쓰플랫 되돌려쓰기(hw_sync)는 그대로. 재도전 결과는 hw_sync 에 안 들어간다.
#   · rt 는 차수마다 한 칸 {n, r, a, at} 그대로 + k(낸 횟수) · tries:[{a,r,at}](앞서 틀린 답)
#   · 아직 기회가 남은 문항은 rt 가 아니라 rtp:{n, tries:[…]} 에 잠깐 둔다(학원앱은 rtp 를 읽지 않는다).
#   계약: docs/retry_contract.md §6 (2026-10-17)
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-139.html'); DST = os.path.join(ROOT, 'student_v2-140.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-139';", "var STU_VER = 'v2-140';")

# ── 1) 화면 꾸밈 — 「다시 생각해 보세요 · 남은 기회 n번」 상자
rep(".bk-rtmark.no{background:#fdf3e0;color:#a15c00}",
    ".bk-rtmark.no{background:#fdf3e0;color:#a15c00}\n"
    "/* ★ v2-140: 주관식 다시 도전 5번 (원장 2026-10-17) */\n"
    ".bk-rtagain{background:#fff7ed;border:1.5px solid #fdba74;border-radius:11px;padding:9px 11px}\n"
    ".bk-rtagain .t{font-size:12.5px;font-weight:900;color:#c2410c;line-height:1.5}\n"
    ".bk-rtagain .t b{color:#9a3412}\n"
    ".bk-rtagain .s{font-size:10.5px;font-weight:800;color:#64748b;margin-top:3px;line-height:1.55;word-break:break-all}\n"
    ".bk-rtagain s{color:#dc3b34;text-decoration-thickness:1.5px}\n"
    ".bk-rtleft{font-size:10.5px;font-weight:800;color:#0f766e;background:#f0fbf9;border-radius:8px;padding:5px 9px;align-self:flex-start}\n"
    ".bk-rtleft.obj{color:#64748b;background:#f1f5f9}\n"
    ".bk-rtgive{width:100%;margin-top:2px;border:1.5px solid #cbd5e1;background:var(--surface);color:#64748b;border-radius:10px;padding:8px 12px;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer}")

# ── 2) 횟수 상수 + 도우미 함수
HELP = r"""var BK_RT_DAYS=3;
/* ★ v2-140: 다시 도전 한 차수 안에서 «낼 수 있는 횟수» (원장 결정 2026-10-17)
 *   「정답 시도가 2번이라 못 맞췄다는 학생이 있다 · 주관식은 여러 번도 괜찮다」
 *   · 주관식(숫자·식·분수·낱말을 직접 쓰는 답) — 틀리면 「다시 생각해 보세요 · 남은 기회 n번」, 5번째에 틀리면 그 차수는 ✗ 로 끝.
 *   · 객관식(①~⑤ · 보기 기호 ㄱㄴㄷ · O/X · ○표 · 낱말 칩처럼 «보기 중에서 고르는» 문항) — 지금처럼 1번.
 *     보기가 5개 이하라 여러 번 주면 찍어서 맞히게 되기 때문이다.
 *   · 저장(계약 §6): rt 에는 차수마다 «마지막 결과» 한 칸 {n,r,a,at,k,tries} 만 둔다.
 *     아직 기회가 남은 문항은 rtp:{n,tries:[{a,r,at}]} 에 잠깐 둔다 → 끝나면 rt 로 옮기고 rtp 는 지운다. */
var BK_RT_MAX_SUBJ=5;   /* 주관식 — 원장 2026-10-17 */
var BK_RT_MAX_OBJ=1;    /* 객관식 — 그대로 한 번 */
/* 다시 도전에서 «고르는 문항(객관식)»인가
 *   ① 정답 대장 kind:'choice' · 매쓰플랫 MULTIPLE_CHOICE/SINGLE_CHOICE · objective (bkIsObj — 1차 채점과 같은 판단)
 *   ② 엔진 답 모양이 보기 기호(mark)·O/X·○표(pick)·낱말 고르기(choice)·연산 기호(op)이거나, 칸이 전부 그런 «누르는 칸»
 *   ③ 낱말 칩 4개 가운데 하나를 누르는 낱말 문항 */
function bkRtIsChoice(p){
  if(bkIsObj(p)) return true;
  var sh=null; try{ sh=bkShape(p); }catch(e){ sh=null; }
  if(!sh) return false;
  var TAP={ mark:1, ox:1, pick:1, choice:1, op:1 };
  if(TAP[String(sh.shape||'')]) return true;
  var ps=sh.parts||[], all=ps.length>0;
  ps.forEach(function(pt){ if(!TAP[String((pt&&pt.kind)||'')]) all=false; });
  if(all) return true;
  try{
    if(sh.shape==='word'&&!bkIsUnitWord(sh,p)&&bkSplitTop(p.answer).length<=1&&!bkHasTapKind(sh)) return true;
  }catch(e2){}
  return false;
}
function bkRtMax(p){ return bkRtIsChoice(p)?BK_RT_MAX_OBJ:BK_RT_MAX_SUBJ; }
/* 이 차수(n)에서 아직 끝나지 않은 시도 (없으면 null) */
function bkRtPend(m,n){
  var q=m&&m.rtp;
  if(!q||Number(q.n)!==Number(n)||!Array.isArray(q.tries)||!q.tries.length) return null;
  return q;
}
/* 다시 도전 한 번 낸 것을 적는다 — 1차 r·a·at 은 건드리지 않는다
 *   틀렸고(✗) 기회가 남았으면 rtp 에만 쌓고 { done:false, left } · 아니면 rt 에 마지막 결과 한 칸 { done:true } */
function bkRtPush(m,n,p,r,a,opt){
  opt=opt||{};
  var now=new Date().toISOString(), max=bkRtMax(p);
  var pend=bkRtPend(m,n), tries=pend?pend.tries.slice():[];
  if(r==='X'&&!opt.self&&tries.length+1<max){
    tries.push({ a:a, r:r, at:now });
    m.rtp={ n:Number(n), tries:tries };
    return { done:false, left:max-tries.length, k:tries.length };
  }
  if(!Array.isArray(m.rt)) m.rt=[];
  m.rt.push({ n:Number(n), r:r, a:a, at:now, self:!!opt.self, photo:opt.photo||'', k:tries.length+1, tries:tries });
  delete m.rtp;
  return { done:true, left:0, k:tries.length+1 };
}
/* 틀린 뒤 «방금 쓴 답»을 그대로 남겨 고칠 수 있게 — 칸 입력이면 칸 값, 글 입력이면 글 */
function bkRtKeepNow(wp){
  wp=String(wp);
  if(String(BK.active)===wp&&BK.fields&&BK.fields.length){
    var fx=[]; try{ fx=JSON.parse(JSON.stringify(BK.fx||[])); }catch(e){ fx=[]; }
    return { wp:wp, fields:BK.fields.slice(), fx:fx };
  }
  var el=document.getElementById('bkw-'+wp);
  if(el) return { wp:wp, word:String(el.value||'') };
  return { wp:wp };
}
/* 다시 그린 뒤 남겨 둔 답을 칸에 다시 넣는다 (자판은 닫은 채 — 칸을 누르면 이어서 고친다) */
function bkRtRestore(){
  var kp=BK.rtKeep;
  if(!kp||!bkRtOn()||!BK.page) return;
  var m=BK.scores[bkKeyOf(BK.page.pid,kp.wp)];
  if(BK.rt.ids.indexOf(kp.wp)<0||!m||bkRtEntry(m,BK.rt.round)){ BK.rtKeep=null; return; }
  if(kp.word!=null){ var el=document.getElementById('bkw-'+kp.wp); if(el) el.value=kp.word; return; }
  if(!kp.fields||!kp.fields.length) return;
  var p=bkFindProb(kp.wp); if(!p) return;
  var sh=bkShape(p);
  if(!sh||!sh.parts||sh.parts.length!==kp.fields.length) return;
  BK.active=kp.wp; BK.sh=sh; BK.fields=kp.fields.slice(); BK.fi=0;
  try{ BK.fx=JSON.parse(JSON.stringify(kp.fx||[])); }catch(e){ BK.fx=[]; }
  for(var i=0;i<BK.fields.length;i++) bkPaintOne(BK.active,i,bkKindAt(i),BK.fields[i]||'',false,false);
  try{ bkReadPaint(); }catch(e2){}
}
/* 「다시 생각해 보세요 · 남은 기회 n번」 (또는 처음이면 기회 안내 한 줄) */
function bkRtTriesHtml(p,wp,m){
  var n=BK.rt?BK.rt.round:2, max=bkRtMax(p), pend=bkRtPend(m,n);
  if(!pend){
    if(max<=1) return '<div class="bk-rtleft obj">☝️ 고르는 문항은 <b>한 번</b>만 낼 수 있어요</div>';
    return '<div class="bk-rtleft">✍️ 틀려도 다시 낼 수 있어요 · 기회 <b>'+max+'번</b></div>';
  }
  var left=max-pend.tries.length;
  var h='<div class="bk-rtagain"><div class="t">🤔 다시 생각해 보세요 · 남은 기회 <b>'+left+'번</b></div>';
  h+='<div class="s">지금까지 낸 답 · ';
  pend.tries.forEach(function(x,i){ h+=(i?' → ':'')+'<s>'+h3Esc(x.a||'(빈칸)')+'</s>'; });
  h+=' ✕ · 아래 답을 고쳐서 다시 내 보세요</div></div>';
  return h;
}
/* 「정답 보기」 — 기회가 남았어도 여기서 그 문항을 끝낸다(이번 차수 ✗). 그 문항만 정답을 연다. */
window.bkRtGiveUp=async function(wpId){
  wpId=String(wpId);
  if(!bkRtOn()||!BK.page||BK.busy) return;
  var n=BK.rt.round, key=bkKeyOf(BK.page.pid,wpId), m=BK.scores[key];
  var pend=bkRtPend(m,n);
  if(!m||!pend||bkRtEntry(m,n)) return;
  var goOn=true;
  try{ goOn=window.confirm('정답을 보면 이 문항은 이번 '+n+'차에서 «못 맞힘»으로 끝나요.\n정답을 볼까요?'); }catch(e){ goOn=true; }
  if(!goOn) return;
  var now=new Date().toISOString(), tries=pend.tries.slice(), last=tries.pop()||{ a:'' };
  if(!Array.isArray(m.rt)) m.rt=[];
  m.rt.push({ n:Number(n), r:'X', a:String(last.a||''), at:now, self:false, photo:'', k:tries.length+1, tries:tries, give:true });
  delete m.rtp;
  if(!m.seen) m.seen=now;
  BK.scores[key]=m;
  if(BK.rtKeep&&BK.rtKeep.wp===wpId) BK.rtKeep=null;
  bkBlur(); bkKpadShow(false);
  bkRenderQ();
  await bkPersist(wpId, 'X', String(last.a||''), true);   // 매쓰플랫에는 보내지 않는다
};"""
rep("var BK_RT_DAYS=3;", HELP)

# ── 3) 다시 그린 뒤 남겨 둔 답 되살리기
rep("    body.innerHTML=bkRtRender(pg,probs);\n    BK.active=null; BK.fields=[]; BK.fx=[]; BK.fi=0; BK.sh=null;\n    bkKpadShow(false);\n",
    "    body.innerHTML=bkRtRender(pg,probs);\n    BK.active=null; BK.fields=[]; BK.fx=[]; BK.fi=0; BK.sh=null;\n    bkKpadShow(false);\n    bkRtRestore();                      /* ★ v2-140: 틀린 뒤 방금 쓴 답을 칸에 남긴다 */\n")
rep("  BK.rt={ round:round, ids:list.map(function(p){ return String(p.wpId); }) };",
    "  BK.rt={ round:round, ids:list.map(function(p){ return String(p.wpId); }) }; BK.rtKeep=null;")
rep("window.bkRtEnd=function(){\n  BK.rt=null;", "window.bkRtEnd=function(){\n  BK.rtKeep=null; BK.rt=null;")
rep("  if(String(BK.active)!==wpId){\n    bkBlur();",
    "  if(String(BK.active)!==wpId){\n    if(BK.rtKeep&&BK.rtKeep.wp!==wpId) BK.rtKeep=null;   /* ★ v2-140 */\n    bkBlur();")

# ── 4) 다시 도전 카드 — 남은 기회 · 정답 보기
rep("  var cc=String((p&&p.concept)||'').trim();",
    "  h+=bkRtTriesHtml(p,wp,m);            /* ★ v2-140: 「다시 생각해 보세요 · 남은 기회 n번」 */\n  var cc=String((p&&p.concept)||'').trim();")
rep("  h+='<button class=\"bk-ghost\" onclick=\"bkToAha('+bkQ(wp)+')\">아직 모르겠어요 · 아하노트에 질문</button>';\n  return h;\n}",
    "  h+='<button class=\"bk-ghost\" onclick=\"bkToAha('+bkQ(wp)+')\">아직 모르겠어요 · 아하노트에 질문</button>';\n"
    "  if(bkRtPend(m,BK.rt?BK.rt.round:2)) h+='<button class=\"bk-rtgive\" onclick=\"bkRtGiveUp('+bkQ(wp)+')\">정답 보기 · 이 문항은 여기까지</button>';   /* ★ v2-140 */\n"
    "  return h;\n}")
# 끝난 카드 — 「3번 만에 맞혔어요」 · 앞서 낸 답
rep("  h+='<div class=\"rev-line\"><span class=\"lb\">'+Number(ent.n)+'차</span>",
    "  /* ★ v2-140: 여러 번 낸 문항은 앞서 틀린 답과 «몇 번 만에»를 보여 준다 */\n"
    "  var kk=Number(ent.k)||1, trs=Array.isArray(ent.tries)?ent.tries:[];\n"
    "  if(trs.length){\n"
    "    h+='<div class=\"rev-line\"><span class=\"lb\">앞서 낸 답</span><span class=\"vv\" style=\"color:#94a3b8\">';\n"
    "    trs.forEach(function(x,i){ h+=(i?' → ':'')+'<s>'+h3Esc(x.a||'(빈칸)')+'</s>'; });\n"
    "    h+='</span></div>';\n"
    "  }\n"
    "  h+='<div class=\"rev-line\"><span class=\"lb\">'+Number(ent.n)+'차</span>")
rep("    +(ent.r==='O'?'🎉 다시 맞혔어요!':'아직이에요 — 조금만 더!')+'</div>';",
    "    +(ent.r==='O'?(kk>1?('🎉 '+kk+'번 만에 맞혔어요!'):'🎉 다시 맞혔어요!')\n"
    "      :(ent.give?'정답을 보고 이 문항은 여기까지 했어요'\n"
    "        :(kk>1?(kk+'번 다 써 봤어요 — 정답은 이번 도전을 마치면 열려요'):'아직이에요 — 조금만 더!')))+'</div>';")

# ── 5) 마무리 요약 — 「3번 만에」 칩
rep("  h+='<div class=\"s1\" style=\"margin-top:4px\">1차 점수는 그대로 남아요",
    "  /* ★ v2-140: 여러 번 만에 맞힌 문항 — 「7번 · 3번 만에」 */\n"
    "  var multi=[];\n"
    "  list.forEach(function(p){\n"
    "    var e=bkRtEntry(BK.scores[bkKeyOf(pg.pid,p.wpId)],round);\n"
    "    if(e&&e.r==='O'&&Number(e.k)>1) multi.push(h3Esc(p.num||'')+'번 · '+Number(e.k)+'번 만에');\n"
    "  });\n"
    "  if(multi.length){\n"
    "    h+='<div class=\"bk-strip\" style=\"margin:6px 0 0\">';\n"
    "    multi.forEach(function(x){ h+='<span style=\"background:#e7f6ec;color:#15803d\">'+x+'</span>'; });\n"
    "    h+='</div>';\n"
    "  }\n"
    "  h+='<div class=\"s1\" style=\"margin-top:4px\">1차 점수는 그대로 남아요")

# ── 6) 1차 마무리 카드 안내
rep("      h+='<div class=\"s1\">틀린 문항만 모아서 다시 풀어요. 종이에 처음부터 다시 풀고 답을 넣으면 돼요.<br>'",
    "      h+='<div class=\"s1\">틀린 문항만 모아서 다시 풀어요. 종이에 처음부터 다시 풀고 답을 넣으면 돼요.<br>'\n"
    "        +'직접 쓰는 답은 틀려도 <b>'+BK_RT_MAX_SUBJ+'번까지</b> 다시 낼 수 있어요 (고르는 문항은 한 번).<br>'   /* ★ v2-140 */")

# ── 7) 채점 — 주관식은 기회가 남으면 이 차수를 끝내지 않는다
rep("""    if(rtN){
      var m0=BK.scores[key];
      if(!Array.isArray(m0.rt)) m0.rt=[];
      m0.rt.push({ n:rtN, r:r, a:a, at:new Date().toISOString(), self:!!opt.self, photo:opt.photo||'' });
      BK.scores[key]=m0;                         // r·a·at 은 1차 그대로
    } else {""",
"""    var rtGo=null;                               /* ★ v2-140: 주관식은 틀려도 기회가 남으면 이 차수를 끝내지 않는다 */
    if(rtN){
      var m0=BK.scores[key];
      rtGo=bkRtPush(m0, rtN, p, r, a, opt);      // rt 한 칸(끝) 또는 rtp(아직 기회 남음)
      BK.scores[key]=m0;                         // r·a·at 은 1차 그대로
    } else {""")
rep("""    delete BK.photos[key]; delete BK.soft[key]; delete BK.wordIn[key]; delete BK.sample[key];
    if(BK.objPick) delete BK.objPick[key];   // v2-83: 복수 정답 객관식에서 골라 둔 것 비우기
    bkBlur(); bkKpadShow(false);""",
"""    var rtKeep=(rtGo&&!rtGo.done)?bkRtKeepNow(wpId):null;   /* ★ v2-140: 방금 쓴 답을 남겨 고치게 */
    delete BK.photos[key]; delete BK.soft[key]; delete BK.sample[key];
    if(!rtKeep||rtKeep.word==null) delete BK.wordIn[key];
    if(BK.objPick) delete BK.objPick[key];   // v2-83: 복수 정답 객관식에서 골라 둔 것 비우기
    bkBlur(); bkKpadShow(false);
    BK.rtKeep=rtKeep;""")
rep("""    if(!rtN) BK.qn++;                        // ★ v2-91: 재도전은 매쓰플랫으로 안 보내므로 대기열도 안 는다
    bkRenderQ();""",
"""    if(!rtN) BK.qn++;                        // ★ v2-91: 재도전은 매쓰플랫으로 안 보내므로 대기열도 안 는다
    bkRenderQ();
    if(rtGo&&!rtGo.done&&typeof toast==='function') toast('다시 생각해 보세요 · 남은 기회 '+rtGo.left+'번');""")

log = """ * v2-140 (2026-10-17) 🔁 다시 도전 — 직접 쓰는 답은 5번까지 (원장 결정)
 *   · <b>[까닭]</b> 「정답 시도가 2번이라 못 맞췄다」는 학생이 있었습니다(1차 한 번 + 2차 한 번).
 *   · 다시 도전(2차·3차)에서 <b>주관식(숫자·식·분수·낱말을 직접 쓰는 답)</b>은 틀리면 바로
 *     「🤔 다시 생각해 보세요 · 남은 기회 n번」이 뜨고, 쓴 답이 칸에 남아 고쳐서 다시 낼 수 있습니다. 개념 힌트도 그대로.
 *     5번째에도 틀리거나 「정답 보기」를 누르면 그 문항은 그 차수에서 «못 맞힘»으로 끝납니다.
 *   · <b>객관식(①~⑤ · 보기 기호 · O/X · ○표 · 낱말 칩처럼 고르는 문항)</b>은 지금처럼 한 번만 낼 수 있습니다.
 *   · 1차 점수와 매쓰플랫으로 보내는 결과는 그대로(1차가 실력). 다시 맞히면 문항당 +1 XP 한 번.
 *   · 마무리 카드에 「7번 · 3번 만에」처럼 몇 번 만에 맞혔는지 보여 줍니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
