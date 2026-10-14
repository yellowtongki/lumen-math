# 학생앱 v2-136 조립 — «v2-135 복사 + rep 고침»
#   원장 2026-10-14 시안 승인: docs/mockup_codi_balance.html (스터디 코디 과목 균형)
#   문제: 코디가 수학만 짜고(주간 계획 184칸 중 176칸이 수학) 빈 시간을 다 채웠다(초6 한 주 22시간).
#   ① 한 주 공부 한도: 초등 10시간 · 중등 14시간 · 고등 18시간 (studentInfo.grade, 모르면 중등)
#   ② 수학은 그중 6할까지(초 6h · 중 8h · 고 10.5h — 30분 칸으로 내림). 시험대비 D-14 안이면 8할까지.
#      한도를 넘는 수학 할 일은 넣지 않고 「수학 할 일 중 «…»는 다음 주로 미뤘어요」 (원래 순서 = 급한 것 먼저)
#   ③ 짜기 전에 한 번 묻기: 「이번 주 다른 과목 할 일 있어?」 — 과목 칩 · 한 줄 · 시간 · ✕ 목록
#      「✨ 이대로 계획 짜 줘」 · 「없어요 — 코디가 알아서 채워 줘」 → codi_goals_<코드>.items 에 { me:true, week, subj, title, min, due? } (먼저 자리 · ✏️ · src 'me')
#      물어본 주 = codi_goals_<코드>.asked['<월요일>'] · 다시 열기 「✏️ 다른 과목 넣기」
#   ④ 남는 칸은 다른 과목 30분(🧭 · src 'codi'): 영어학원 간 날 저녁 「영어학원 숙제」 · 초 영어·독서 · 중 영어·국어·과학·사회 · 고 영어·국어
#   ⑤ 위에 요약 카드: 공부 N시간 / 한도 · 과목 막대 · 수학 6할 · 미룬 수학
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-135.html'); DST = os.path.join(ROOT, 'student_v2-136.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-135';", "var STU_VER = 'v2-136';")

# ── 공용: 학년 한도 · 채움 과목 · 받침 ──
BAL = r"""var SUBJ={ '수학':'#e0463c','영어':'#3b82f6','국어':'#7c4bd6','과학':'#15803d','사회':'#c2410c','기타':'#4b5563' };
/* ══ v2-136: ⚖️ 과목 균형 (원장 승인 시안 docs/mockup_codi_balance.html)
 *   한 주 공부 한도(30분 칸): 초등 20(10시간) · 중등 28(14시간) · 고등 36(18시간) — studentInfo.grade, 모르면 중등
 *   수학은 그중 6할(내림) · 시험대비 D-14 안이면 8할 · 학생이 넣은 다른 과목(✏️)이 먼저 · 남는 칸은 학년별 다른 과목 30분(🧭) */
var BAL={ cap:{ '초':20, '중':28, '고':36 }, nm:{ '초':'초등', '중':'중등', '고':'고등' }, ratio:0.6, examRatio:0.8,
  fill:{ '초':[['영어','영어 단어 복습'],['국어','독서 30분']], '중':[['영어','영어 단어·본문'],['국어','국어 교과서 복습'],['과학','과학 교과서 복습'],['사회','사회 교과서 복습']], '고':[['영어','영어 독해'],['국어','국어 문학·비문학']] },
  fillTxt:{ '초':'영어 · 독서', '중':'영어 · 국어 · 과학 · 사회', '고':'영어 · 국어' },
  subj:['영어','국어','과학','사회'] };
window.SC_BAL=BAL;
function gradeBand(){ var g=String((typeof studentInfo!=='undefined'&&studentInfo&&studentInfo.grade)||''); if(/초/.test(g)) return '초'; if(/고/.test(g)) return '고'; return '중'; }
window.scGradeBand=gradeBand;
/* «…»은/는 — 끝 글자 받침 (숫자는 읽는 소리로) */
function josaEun(w){ var t=String(w||'').replace(/[\s\)\]»」』'".,~]+$/,''), c=t.charCodeAt(t.length-1); if(c>=0xAC00&&c<=0xD7A3) return (c-0xAC00)%28?'은':'는'; if(/[013678]$/.test(t)) return '은'; return '는'; }
"""
rep("var SUBJ={ '수학':'#e0463c','영어':'#3b82f6','국어':'#7c4bd6','과학':'#15803d','사회':'#c2410c','기타':'#4b5563' };\n", BAL)

# ── 학생이 넣은 다른 과목: 그 주에만 · 요일 있으면 그날 · 없으면 고르게 · src 'me' ──
rep("""  (SC.goals.items||[]).forEach(function(g){ if(!g||!g.title) return; items.push({ kind:'goal', subj:g.subj||'기타', title:String(g.title).slice(0,22), min:Math.min(120,Math.max(30,Math.round((Number(g.min)||30)/30)*30)), due:g.due!=null?Number(g.due):5, pri:6, ref:g.id }); });""",
    """  (SC.goals.items||[]).forEach(function(g){ if(!g||!g.title) return; if(g.me&&g.week&&g.week!==weekStart) return;   /* v2-136: 「이번 주 다른 과목」은 그 주에만 */
    var hasDay=g.due!=null&&g.due!=='', it={ kind:'goal', subj:g.subj||'기타', title:String(g.title).slice(0,22), min:Math.min(120,Math.max(30,Math.round((Number(g.min)||30)/30)*30)), due:hasDay?Number(g.due):5, pri:6, ref:g.id };
    if(g.me){ it.src='me'; it.spread=!hasDay; } items.push(it); });""")

# ── 계획 짜기: 과목 균형 ──
OLD_MAKE_START = "function itemKey(it){ return it.kind+'|'+it.title; }\nwindow.scMakePlan=function(weekStart, keep){"
i0 = s.index(OLD_MAKE_START)
OLD_MAKE_END = "  return { week:weekStart, made:new Date().toISOString(), blocks:blocks, overflow:overflow.map(function(x){ return x.title; }), cap:cap };\n};\n"
i1 = s.index(OLD_MAKE_END, i0) + len(OLD_MAKE_END)
NEW_MAKE = r"""function itemKey(it){ return it.kind+'|'+it.title+(it.kind==='fill'?'|'+(it.ref||''):''); }   /* v2-136: 다른 과목 채움 칸은 날마다 따로 */
window.scMakePlan=function(weekStart, keep){
  var grid=freeGrid(), used=[], cap=[], d, i, blocks=[], overflow=[];
  var f=SC.fixed||fixedDefault(), rules=f.rules||{};
  for(d=0;d<7;d++){ used[d]=grid[d].map(function(){ return false; }); var free=grid[d].filter(function(x){ return x; }).length; cap[d]=(d===6&&rules.sunday!==false)?0:Math.max(Math.min(free,4),Math.ceil(free/2)); }
  var todayIdx=(weekStart===weekStartOf(todayStr()))?dowMon(todayStr()):0;
  /* v2-136: 「다른 과목」 목록에서 지운 칸(✏️)은 다시 짤 때 빠진다 (지나간 날 것은 그대로) */
  var gIds={}; (SC.goals.items||[]).forEach(function(g){ if(g&&g.id) gIds[g.id]=1; });
  keep=(keep||[]).filter(function(b){ var it=(b&&b.item)||{}; return !(it.kind==='goal'&&it.src==='me'&&it.ref&&!gIds[it.ref]&&b.d>=todayIdx); });
  /* 다시 짤 때: 지나간 날·이미 한 칸은 그대로 두고, 그 할 일은 새로 넣지 않는다 */
  var kept={}; keep.forEach(function(b){ blocks.push(b); kept[itemKey(b.item)]=1; for(var j=0;j<b.n;j++) if(used[b.d]) used[b.d][b.s+j]=true; });
  function place(item, n, part, o){
    /* 마감 전날부터 거꾸로(오늘까지만) → 안 되면 마감 뒤 날 → 지나간 날엔 절대 안 넣는다 · o.order 가 있으면 그 요일 순서 · o.after[요일] 앞 칸은 뒤로 미룸 */
    var order=[];
    if(o&&o.order) order=o.order.filter(function(x){ return x>=todayIdx&&x<=6; });
    else { for(d=Math.min(6,item.due); d>=todayIdx; d--) order.push(d); for(d=Math.max(item.due+1,todayIdx); d<=6; d++) if(order.indexOf(d)<0) order.push(d); }
    for(var oi=0; oi<order.length; oi++){ d=order[oi]; if(cap[d]<n) continue; var best=-1, bs=1e9, aft=(o&&o.after&&o.after[d]!=null)?o.after[d]:-1;
      for(i=0;i+n<=SLOTN;i++){ var ok=true; for(var j=0;j<n;j++){ if(!grid[d][i+j]||used[d][i+j]){ ok=false; break; } } if(!ok) continue; var sc=slotScore(d,i)+(i<aft?500:0); if(sc<bs){ bs=sc; best=i; } }
      if(best>=0){ for(var j2=0;j2<n;j2++) used[d][best+j2]=true; cap[d]-=n; blocks.push({ id:'b'+blocks.length+Date.now().toString(36).slice(-3), d:d, s:best, n:n, item:item, part:part||'' }); return true; } }
    return false;
  }
  /* ── v2-136: 과목 균형 — 학년 한 주 한도 · 수학 6할(시험 D-14 안이면 8할) ── */
  var all=scItems(weekStart), band=gradeBand(), capS=BAL.cap[band]||BAL.cap['중'], exam=all.some(function(x){ return x.kind==='exam'; });
  var tot=0, mth=0; blocks.forEach(function(b){ tot+=b.n; if(b.item&&b.item.subj==='수학') mth+=b.n; });
  var left=7-todayIdx, capE=left>=7?capS:Math.min(capS, tot+Math.ceil(capS*left/7));   /* 주 중간에 처음 짜면 남은 날만큼 */
  var mathE=Math.floor(capE*(exam?BAL.examRatio:BAL.ratio)), deferred=[];
  function slotsOf(item){ return Math.max(1,Math.round(item.min/30)); }
  function load(x){ var c=0; for(var j=0;j<SLOTN;j++) if(used[x][j]) c++; return c; }
  function spread(){ var ds=[]; for(var x=todayIdx;x<=6;x++) ds.push(x); return ds.sort(function(a,b){ return ((a===6)-(b===6))||(load(a)-load(b))||(a-b); }); }   /* 덜 찬 날 먼저 · 일요일은 맨 나중 */
  function put(item, n, part, o){ if(!place(item,n,part,o)) return false; tot+=n; if(item.subj==='수학') mth+=n; return true; }
  function putAll(item, how){ var slots=slotsOf(item), parts=Math.ceil(slots/2); for(var k=0;k<parts;k++){ var n=Math.min(2,slots-k*2); if(!put(item,n,parts>1?((k+1)+'/'+parts):'',how==='spread'?{ order:spread() }:null)){ overflow.push(item); return false; } } return true; }
  /* ① 학생이 넣은 다른 과목(✏️) — 먼저 자리를 잡는다 (요일을 적었으면 그날부터, 아니면 덜 찬 날) */
  all.forEach(function(item){ if(item.kind!=='goal'||kept[itemKey(item)]) return; putAll(item, item.spread?'spread':''); });
  /* 수학 몫은 남겨 둔다 */
  var maths=all.filter(function(x){ return x.kind!=='goal'&&x.subj==='수학'&&!kept[itemKey(x)]; }), need=0; maths.forEach(function(x){ need+=slotsOf(x); });
  var reserve=Math.max(0,Math.min(mathE-mth,need));
  /* ② 영어학원 가는 날 저녁 — 「영어학원 숙제」 30분 (학원 끝난 뒤 칸을 먼저) */
  var eng={}; fixedAll().forEach(function(b){ if(!b||b.type!=='academy'||!/영어/.test(String(b.label||'')+String(b.subj||''))) return; (b.days||[]).forEach(function(x){ var e=slotOfTime(b.end)+(rules.rest!==false?1:0); if(eng[x]==null||e>eng[x]) eng[x]=e; }); });
  Object.keys(eng).map(Number).sort().forEach(function(x){ if(x<todayIdx||capE-tot-reserve<1) return; var it={ kind:'fill', subj:'영어', title:'영어학원 숙제', min:30, due:x, pri:7, ref:'eng:'+x, src:'codi' }; if(kept[itemKey(it)]) return; var o={ order:[x], after:{} }; o.after[x]=eng[x]; put(it,1,'',o); });
  /* ③ 수학 — 한도 안에 들 것을 중요한 순서(시험대비 › 할 일 카드 › 교재 › 학습지 › 오답 › 아하, 같으면 급한 것)로 고르고, 넘치는 것은 다음 주로 · 넣는 순서는 예전 그대로(마감 먼저) */
  var pm=mth, pt=tot, pick1={};
  maths.map(function(x,k){ return { x:x, k:k }; }).sort(function(a,b){ return (a.x.pri-b.x.pri)||(a.x.due-b.x.due)||(a.k-b.k); }).forEach(function(o){ var n=slotsOf(o.x); if(pm+n>mathE||pt+n>capE){ if(deferred.indexOf(o.x.title)<0) deferred.push(o.x.title); return; } pm+=n; pt+=n; pick1[o.k]=1; });
  maths.forEach(function(item,k){ if(pick1[k]) putAll(item,''); });
  /* ④ 남는 칸 — 학년별 다른 과목 30분씩, 날마다 고르게 */
  var rot=BAL.fill[band]||BAL.fill['중'], ri=0, dead={}, guard=0;
  while(capE-tot>=1&&guard++<100){
    var ds=spread().filter(function(x){ return !dead[x]; }); if(!ds.length) break; var dd=ds[0], onDay={};
    blocks.forEach(function(b){ if(b.d===dd&&b.item) onDay[b.item.subj]=1; });
    var pick=null; for(var r=0;r<rot.length;r++){ var c=rot[(ri+r)%rot.length]; if(!onDay[c[0]]){ pick=c; ri=(ri+r+1)%rot.length; break; } }
    if(!pick){ pick=rot[ri%rot.length]; ri=(ri+1)%rot.length; }
    var k2=0, it2; do { it2={ kind:'fill', subj:pick[0], title:pick[1], min:30, due:dd, pri:8, ref:'fill:'+dd+':'+k2, src:'codi' }; k2++; } while(kept[itemKey(it2)]||blocks.some(function(b){ return b.item&&itemKey(b.item)===itemKey(it2); }));
    if(!put(it2,1,'',{ order:[dd] })) dead[dd]=1;
  }
  blocks.sort(function(a,b){ return (a.d-b.d)||(a.s-b.s); });
  /* 나눈 칸(1/2·2/2)은 시간 순서대로 다시 번호를 붙이고, 칸 번호는 「할 일+몇 번째」로 정해서 다시 짜도 실천 체크가 남는다 */
  var seen={}, ids={}; blocks.forEach(function(b){ var k=itemKey(b.item); if(b.part){ seen[k]=(seen[k]||0)+1; b.part=seen[k]+'/'+b.part.split('/')[1]; } var id='b'+hashKey(k+'|'+b.part); ids[id]=(ids[id]||0)+1; b.id=ids[id]>1?id+'_'+ids[id]:id; });
  return { week:weekStart, made:new Date().toISOString(), blocks:blocks, overflow:overflow.map(function(x){ return x.title; }), cap:cap,
    bal:{ band:band, cap:capS, capE:capE, mathCap:mathE, exam:exam, deferred:deferred } };   /* v2-136 */
};
/* ── v2-136: 요약 카드 — 공부 N시간 / 한도 · 과목 막대 · 미룬 수학 (코디 화면 · 주간계획표 달력이 같이 쓴다)
 *   list = [{ subj, n(30분 칸) }] · bal = 계획의 bal(시험 · 미룬 것) */
window.scBalHtml=function(list, bal, o){
  o=o||{}; bal=bal||{}; var band=gradeBand(), capS=BAL.cap[band]||BAL.cap['중'], by={}, tot=0, order=['수학','영어','국어','과학','사회','기타'];
  (list||[]).forEach(function(x){ if(!x) return; var sj=SUBJ[x.subj]?x.subj:'기타', n=Math.max(1,Number(x.n)||2); by[sj]=(by[sj]||0)+n; tot+=n; });
  if(!tot) return '';
  var hh=function(sl){ var v=sl/2; return (v%1?v.toFixed(1):String(v))+'h'; }, has=order.filter(function(x){ return by[x]; }), over=tot>capS;
  var h='<div class="sc-bal"'+(o.id?' id="'+o.id+'"':'')+'><div class="cap"><span>공부 <b>'+minTxt(tot*30)+'</b> / '+BAL.nm[band]+' 한도 '+(capS/2)+'시간</span><em class="'+(over?'over':'')+'">'+(over?'한도보다 '+minTxt((tot-capS)*30)+' 많아요':'✓ 한도 안')+'</em></div>';
  h+='<div class="bar">'+has.map(function(x){ return '<i style="width:'+(by[x]/tot*100).toFixed(1)+'%;background:'+SUBJ[x]+'" title="'+x+'"></i>'; }).join('')+'</div>';
  h+='<div class="leg">'+has.map(function(x){ return '<span style="color:'+SUBJ[x]+'">'+x+' <b>'+hh(by[x])+'</b>'+(x==='수학'?' '+Math.round(by[x]/tot*100)+'%':'')+'</span>'; }).join('')+'</div>';
  if(bal.exam) h+='<div class="note exam">📝 시험 2주 전이라 수학을 8할까지 넣었어요</div>';
  var df=bal.deferred||[]; if(df.length){ var sh=df.slice(0,3); h+='<div class="note def">수학 할 일 중 '+sh.map(function(t){ return '«'+esc(t)+'»'; }).join(' · ')+(df.length>3?' 외 '+(df.length-3)+'개는':josaEun(sh[sh.length-1]))+' 다음 주로 미뤘어요</div>'; }
  if(bal.capE&&bal.capE<capS) h+='<div class="note">이번 주는 남은 날만큼 '+minTxt(bal.capE*30)+'까지 짰어요</div>';
  if(o.btns) h+='<div class="btns">'+o.btns+'</div>';
  return h+'</div>';
};
"""
s = s[:i0] + NEW_MAKE + s[i1:]

# ── 블록 줄: ✏️(내가 넣은 것) · 🧭(코디) ──
rep("""<b>'+esc(b.item.title)+(b.part?' <span>'+b.part+'</span>':'')+'</b>""",
    """<b>'+esc(b.item.title)+(b.part?' <span>'+b.part+'</span>':'')+'<em class="sc-src">'+((b.item.kind==='goal'||b.item.src==='me')?'✏️':'🧭')+'</em></b>""")

# ── 코디 화면: 묻기 카드 · 요약 카드 ──
rep("""  if(!SC.fixed){ h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">안녕! 나는 스터디 코디야. 먼저 <b>학교·학원·운동 시간</b>을 한 번만 넣어 줘. 빈 시간을 보고 이번 주 수학 계획을 짜 줄게.</div></div>""",
    """  if(!SC.fixed){ h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">안녕! 나는 스터디 코디야. 먼저 <b>학교·학원·운동 시간</b>을 한 번만 넣어 줘. 빈 시간을 보고 이번 주 공부 계획을 짜 줄게.</div></div>""")
rep("""  if(!SC.plan||SC.plan.week!==ws){ h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">이번 주('+mmdd(ws)+'~) 계획이 아직 없어. 지금 짜 줄까?</div></div>""",
    """  var wplAsk=!!(SC.ask&&SC.ask.via==='wpl');
  if((!SC.plan||SC.plan.week!==ws)&&!wplAsk&&(SC.asking||scAskNeed(ws))){   /* v2-136: 새 주 첫 「지금 짜 줄까?」 = 다른 과목부터 묻는다 */
    if(!SC.ask||SC.ask.week!==ws) SC.ask={ week:ws, via:'codi', subj:'영어', min:30, draft:'', first:true }; SC.asking=true;
    h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">이번 주('+mmdd(ws)+'~) 계획이 아직 없어. 지금 짜 줄까? 그 전에 하나만 물어볼게.</div></div>'+askHtml()+'<button class="sc-btn" style="width:100%;margin-top:8px" onclick="scGoFixed()">시간표 고치기</button>';
    body.innerHTML=h; return; }
  if(!SC.plan||SC.plan.week!==ws){ h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">이번 주('+mmdd(ws)+'~) 계획이 아직 없어. 지금 짜 줄까?</div></div>""")
rep("""  h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">'+esc(morningMsg())+'</div></div>';
  var tb=P.blocks""", """  h+='<div class="sc-codi"><div class="sc-face"></div><div class="sc-say">'+esc(morningMsg())+'</div></div>';
  if(SC.asking&&SC.ask&&SC.ask.via==='codi') h+=askHtml();   /* v2-136: 「✏️ 다른 과목 넣기」로 다시 연 묻기 카드 */
  h+=scBalHtml(P.blocks.map(function(b){ return { subj:b.item&&b.item.subj, n:b.n }; }), P.bal, { id:'sc-bal', btns:'<button type="button" onclick="scAskOpen()">✏️ 다른 과목 넣기</button><button type="button" onclick="scBuild()">🔄 다시 짜 줘</button>' });
  var tb=P.blocks""")
rep("""<button class="sc-btn" onclick="scGoalForm()">＋ 다른 과목 목표</button>""", "")
# 주간 계획 화면
rep("""  var today=todayStr(), h='<div class="sc-h"><b>'+mmdd(P.week)+' ~ '+mmdd(addDays(P.week,6))+'</b><span onclick="scBuild()">다시 짜 줘</span></div>';""",
    """  var today=todayStr(), h='<div class="sc-h"><b>'+mmdd(P.week)+' ~ '+mmdd(addDays(P.week,6))+'</b><span><span onclick="scAskOpen()">✏️ 다른 과목 넣기</span> · <span onclick="scBuild()">다시 짜 줘</span></span></div>';
  h+=scBalHtml(P.blocks.map(function(b){ return { subj:b.item&&b.item.subj, n:b.n }; }), P.bal);   /* v2-136 */""")
rep("""    h+='<div class="sc-day'+(day===today?' today':'')+'"><div class="sc-dh">'+DOW[d]+' '+mmdd(day)+(day===today?' <em>오늘</em>':'')+'<small>""",
    """    var dmin=0; bs.forEach(function(b){ dmin+=b.n*30; });
    h+='<div class="sc-day'+(day===today?' today':'')+'"><div class="sc-dh">'+DOW[d]+' '+mmdd(day)+(day===today?' <em>오늘</em>':'')+(dmin?' <span class="sc-dt">'+minTxt(dmin)+'</span>':'')+'<small>""")
rep("""(day<today?'지나간 날':(d===6?'밀린 것 옮기는 날':'비어 있음'))""", """(day<today?'지나간 날':(d===6?'쉬는 날 — 밀린 것만 옮겨요':'비어 있음'))""")
rep("""(x.kind==='goal'?'내 목표':'이번 주')""", """(x.kind==='goal'?(x.src==='me'?'내가 넣은 것 ✏️':'내 목표'):'이번 주')""")
rep("""<small>총 '+Math.round(tm/60*10)/10+'시간 · 숙제는 수업 전날, 오답은 채점 다음 날, 한 블록 60분까지, 빈 시간의 절반은 비워 둠</small>""",
    """<small>할 일 총 '+Math.round(tm/60*10)/10+'시간 · 한 주 공부 '+BAL.nm[gradeBand()]+' '+(BAL.cap[gradeBand()]/2)+'시간까지 · 수학은 그중 6할(시험 2주 전엔 8할) · 남는 칸은 '+BAL.fillTxt[gradeBand()]+' · 숙제는 수업 전날, 오답은 채점 다음 날, 한 블록 60분까지</small>""")

# 짜기: 물어본 적 없는 주면 먼저 묻는다
rep("""window.scBuild=async function(){ var today=todayStr(), ws=weekStartOf(today), ti=dowMon(today), keep=[], dropped=[];""",
    """window.scBuild=async function(opt){ var today=todayStr(), ws=weekStartOf(today), ti=dowMon(today), keep=[], dropped=[];
  if(!(opt&&opt.force)&&scAskNeed(ws)){ scAskOpen(ws,'codi'); return; }   /* v2-136: 그 주 처음 짤 때는 「다른 과목 할 일 있어?」부터 */
  SC.asking=false; if(SC.ask&&SC.ask.via==='codi') SC.ask=null;""")
rep("""if(window.toast) toast('이번 주 계획을 짰어 — '+SC.plan.blocks.length+'칸'); scRender(); scRenderWeek(); scHomeUpdate(); };""",
    """if(window.toast){ var tm2=0; SC.plan.blocks.forEach(function(b){ tm2+=b.n*30; }); toast('이번 주 계획을 짰어 — '+SC.plan.blocks.length+'칸 · 공부 '+minTxt(tm2)); } scRender(); scRenderWeek(); scHomeUpdate(); };""")

# 묻기 카드 함수
ASK = r"""/* ── v2-136: 짜기 전에 한 번 묻기 — 「이번 주 다른 과목 할 일 있어?」
 *   학생이 넣은 것: codi_goals_<코드>.items 에 { id, subj, title, min, week:'<월요일>', me:true, due?(월0~일6 — 「(목)」처럼 적으면) } — 예전 목표(me 없음)는 예전처럼 매주
 *   물어본 주: codi_goals_<코드>.asked['<월요일>'] = 시각 (최근 8주만) */
var DAYK=['월','화','수','목','금','토','일'];
window.scAskNeed=function(week){ var a=(SC.goals&&SC.goals.asked)||{}; return !a[week]; };
function askItems(week){ return ((SC.goals&&SC.goals.items)||[]).filter(function(g){ return g&&g.me&&g.week===week; }); }
function askHost(){ return (SC.ask&&SC.ask.via==='wpl')?document.getElementById('sc-ask-sheet'):document.getElementById('sc-body'); }
function askHtml(){
  var A=SC.ask; if(!A) return ''; var W=A.week, band=gradeBand(), its=askItems(W);
  var h='<div class="sc-ask" id="sc-ask"><h3>이번 주 다른 과목 할 일 있어?</h3><p>'+mmdd(W)+' ~ '+mmdd(addDays(W,6))+' · 있으면 먼저 넣고, 수학은 한 주 공부의 6할까지만 짤게.</p>';
  h+='<div class="sc-ask-chips">'+BAL.subj.map(function(x){ var on=A.subj===x, c=SUBJ[x]; return '<button type="button" class="'+(on?'on':'')+'" style="'+(on?'background:'+c+';border-color:'+c+';color:#fff':'color:'+c)+'" aria-pressed="'+on+'" onclick="scAskSubj(\''+x+'\')">'+x+'</button>'; }).join('')+'</div>';
  h+='<div class="sc-ask-in"><input class="sca-t" maxlength="30" aria-label="할 일" placeholder="예: 영어 단어 시험 준비 (목)" value="'+esc(A.draft||'')+'" onkeydown="if(event.key===\'Enter\'){event.preventDefault();scAskAdd();}"><select class="sca-m" aria-label="걸리는 시간">'+[[30,'30분'],[60,'1시간'],[90,'1시간 30분']].map(function(x){ return '<option value="'+x[0]+'"'+(Number(A.min||30)===x[0]?' selected':'')+'>'+x[1]+'</option>'; }).join('')+'</select><button type="button" class="sca-add" onclick="scAskAdd()" aria-label="넣기">＋</button></div>';
  h+='<div class="sc-ask-tip">요일이 정해져 있으면 끝에 (목)처럼 적어 줘</div>';
  if(its.length) h+='<div class="sc-ask-list">'+its.map(function(g){ var c=SUBJ[g.subj]||SUBJ['기타']; return '<div class="ad"><i style="background:'+c+'">'+esc(g.subj)+'</i><span>'+esc(g.title)+(g.due!=null&&g.due!==''?' ('+DAYK[g.due]+')':'')+' · '+minTxt(g.min)+'</span><button type="button" aria-label="빼기" onclick="scAskDel(\''+esc(g.id)+'\')">✕</button></div>'; }).join('')+'</div>';
  h+='<button type="button" class="sc-btn pri sca-go" onclick="scAskGo(false)">✨ 이대로 계획 짜 줘</button>';
  h+='<button type="button" class="sc-ask-none sca-none" onclick="scAskGo(true)">없어요 — 코디가 알아서 채워 줘</button>';
  if(!A.first) h+='<button type="button" class="sc-ask-none" onclick="scAskClose()">닫기</button>';
  h+='<div class="sc-ask-rule"><b>코디가 지킬 규칙</b>· 한 주 공부 <b>'+BAL.nm[band]+' '+(BAL.cap[band]/2)+'시간</b>까지 (초등 10 · 중등 14 · 고등 18)<br>· 수학은 그중 <b>6할</b> · 시험 2주 전엔 수학 더<br>· 영어학원 간 날 저녁엔 「영어학원 숙제」<br>· 남는 칸: '+BAL.fillTxt[band]+'</div>';
  return h+'</div>';
}
function askPull(){ var host=askHost(); if(!host||!SC.ask) return; var t=host.querySelector('.sca-t'), m=host.querySelector('.sca-m'); if(t) SC.ask.draft=t.value; if(m) SC.ask.min=Number(m.value)||30; }
function askRender(){ if(SC.ask&&SC.ask.via==='wpl'){ var sh=document.getElementById('sc-ask-sheet'); if(sh) sh.innerHTML='<div class="bs-handle"></div>'+askHtml(); } else scRender(); }
window.scAskOpen=function(week, via){
  week=week||weekStartOf(todayStr()); SC.ask={ week:week, via:via||'codi', subj:'영어', min:30, draft:'', first:scAskNeed(week) };
  if(SC.ask.via==='wpl'){ askRender(); var ov=document.getElementById('sc-ask-ov'); if(ov) ov.classList.add('show'); return; }
  SC.asking=true; var wk=document.getElementById('screen-codi-week');
  if(wk&&wk.classList.contains('active')&&window.go) go('screen-codi'); else scRender();
  var b=document.getElementById('sc-ask'); if(b&&b.scrollIntoView) try{ b.scrollIntoView({ block:'start' }); }catch(e){}
};
/* 주간계획표(달력)에서 열 때는 코디 자료(목표)를 먼저 읽는다 */
window.scAskOpenWpl=async function(week){ await scLoad(); scAskOpen(week,'wpl'); };
window.scAskSubj=function(x){ askPull(); if(SC.ask) SC.ask.subj=x; askRender(); };
window.scAskAdd=async function(silent){
  askPull(); var A=SC.ask; if(!A) return false; var raw=String(A.draft||'').trim();
  if(!raw){ if(!silent&&window.toast) toast('무엇을 할지 적어 줘'); return false; }
  var due=null, m=raw.match(/\s*[\(（]\s*(월|화|수|목|금|토|일)(?:요일)?\s*[\)）]\s*$/); if(m){ due=DAYK.indexOf(m[1]); raw=raw.slice(0,m.index).trim()||raw; }
  var g={ id:'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), subj:A.subj||'영어', title:raw.slice(0,22), min:Number(A.min)||30, week:A.week, me:true, at:new Date().toISOString() }; if(due!=null&&due>=0) g.due=due;
  SC.goals=SC.goals||{ items:[] }; var old=addDays(A.week,-56);
  SC.goals.items=(SC.goals.items||[]).filter(function(x){ return !(x&&x.me&&x.week&&x.week<old); }).concat([g]);   /* 8주 지난 것은 정리 */
  A.draft=''; askRender(); await kvSet('codi_goals_'+code(), SC.goals); return true;
};
window.scAskDel=async function(id){ askPull(); SC.goals.items=(SC.goals.items||[]).filter(function(g){ return !(g&&g.id===id); }); askRender(); await kvSet('codi_goals_'+code(), SC.goals); };
window.scAskClose=function(){ var via=SC.ask&&SC.ask.via; SC.asking=false; SC.ask=null; var ov=document.getElementById('sc-ask-ov'); if(ov) ov.classList.remove('show'); if(via!=='wpl') scRender(); };
window.scAskGo=async function(none){
  if(!SC.ask) return; askPull(); var A=SC.ask;
  if(!none&&String(A.draft||'').trim()) await scAskAdd(true);   /* 적어 두고 ＋ 안 눌렀어도 넣는다 */
  SC.goals=SC.goals||{ items:[] }; SC.goals.asked=SC.goals.asked||{}; SC.goals.asked[A.week]=new Date().toISOString();
  var ks=Object.keys(SC.goals.asked).sort(); while(ks.length>8) delete SC.goals.asked[ks.shift()];
  await kvSet('codi_goals_'+code(), SC.goals);
  var via=A.via; SC.asking=false; SC.ask=null; var ov=document.getElementById('sc-ask-ov'); if(ov) ov.classList.remove('show');
  if(via==='wpl'){ if(window.wplCodiFill) await wplCodiFill({ skipAsk:true }); } else await scBuild({ force:true });
};
"""
rep("/* 다른 과목 목표 */\nwindow.scGoalForm=function(){", ASK + "/* 다른 과목 목표 (예전 「＋ 다른 과목 목표」 — 함수는 남겨 둔다) */\nwindow.scGoalForm=function(){")
rep("  if(!SC.fixed) txt='시간표를 넣으면 이번 주 수학 계획을 짜 줘';", "  if(!SC.fixed) txt='시간표를 넣으면 이번 주 공부 계획을 짜 줘';")

# ── 주간계획표(달력): 묻기 · 요약 · bal 보관 ──
rep("""      var w = weekOf(tW); w.items = fromBlocks(WP.cp.blocks); w.imp = 1; w.upd = nowIso();""",
    """      var w = weekOf(tW); w.items = fromBlocks(WP.cp.blocks); w.imp = 1; w.upd = nowIso(); if (WP.cp.bal) w.bal = WP.cp.bal;   /* v2-136 */""")
rep("""  var p = { week: W, made: (prev && prev.made) || nowIso(), blocks: toBlocks(weekOf(W).items), overflow: (prev && prev.overflow) || [], dropped: ((prev && prev.dropped) || []).concat(WP.dropNew), fromWplan: true, upd: nowIso() };""",
    """  var p = { week: W, made: (prev && prev.made) || nowIso(), blocks: toBlocks(weekOf(W).items), overflow: (prev && prev.overflow) || [], dropped: ((prev && prev.dropped) || []).concat(WP.dropNew), fromWplan: true, upd: nowIso() };
  var bl0 = (prev && prev.bal) || weekOf(W).bal; if (bl0) p.bal = bl0;   /* v2-136: 과목 균형(미룬 수학 · 시험) */""")
rep("""  w.items = fromBlocks(plan.blocks).concat(untimed); w.imp = 1; w.upd = nowIso();
  WP.cp = plan;""", """  w.items = fromBlocks(plan.blocks).concat(untimed); w.imp = 1; w.upd = nowIso(); if (plan.bal) w.bal = plan.bal;   /* v2-136 */
  WP.cp = plan;""")
rep("""window.wplCodiFill = async function(){
  if (WP.busy || !WP.codi || !window.scMakePlan || !window.scLoad) return;
  var W = curMon();""", """window.wplCodiFill = async function(opt){
  if (WP.busy || !WP.codi || !window.scMakePlan || !window.scLoad) return;
  var W = curMon();
  if (!(opt && opt.skipAsk) && window.scAskNeed){ try { await scLoad(); } catch(e){} if (scAskNeed(W)){ scAskOpen(W, 'wpl'); return; } }   /* v2-136: 그 주 처음이면 「다른 과목 할 일 있어?」부터 */""")
rep("""    if (W === PW.thisMon() && WP.cp && WP.cp.week === W) WP.cp.overflow = plan.overflow || [];""",
    """    if (plan.bal) w.bal = plan.bal;   /* v2-136 */
    if (W === PW.thisMon() && WP.cp && WP.cp.week === W){ WP.cp.overflow = plan.overflow || []; if (plan.bal) WP.cp.bal = plan.bal; }""")
rep("""      say(added ? ('🧭 코디가 ' + added + '칸 채웠어요 — 옮기거나 지워도 돼요' + ((plan.overflow || []).length ? ' · 못 넣은 것 ' + plan.overflow.length + '개' : '')) : '🧭 더 넣을 빈칸이나 할 일이 없어요');""",
    """      say(added ? ('🧭 코디가 ' + added + '칸 채웠어요 — 옮기거나 지워도 돼요' + ((plan.overflow || []).length ? ' · 못 넣은 것 ' + plan.overflow.length + '개' : '')) : '🧭 한 주 한도까지 찼어요 — 더 넣을 칸이 없어요');""")
rep("""/* ── 🧭 코디가 채워 주기 (코디 대상 학생) — 지금 달력 칸은 그대로 두고 빈칸에 수학 할 일을 넣는다 ── */""",
    """/* ── 🧭 코디가 채워 주기 (코디 대상 학생) — 지금 달력 칸은 그대로 두고 빈칸에 할 일을 넣는다 (v2-136: 학년 한도 · 수학 6할 · 다른 과목) ── */""")
rep("""  h += legendHtml();
  h += calHtml(W, items, chk, today);""", """  h += legendHtml();
  if (WP.codi && items.length && window.scBalHtml){   /* v2-136: ⚖️ 과목 균형 요약 */
    var bal = w.bal || ((W === thisW && WP.cp && WP.cp.week === W) ? WP.cp.bal : null);
    h += scBalHtml(items.filter(function(it){ return it && it.title; }).map(function(it){ return { subj: it.subj || '수학', n: +it.n || 2 }; }), bal, { id: 'wp-bal', btns: '<button type="button" onclick="scAskOpenWpl(\\'' + W + '\\')">✏️ 다른 과목 넣기</button>' });
  }
  h += calHtml(W, items, chk, today);""")

# ── 묻기 시트(달력용) ──
rep("""<!-- ══ v2-107: 🧍 내 캐릭터 · 캐릭터 만들기 ══ -->""", """<div class="bs-overlay" id="sc-ask-ov" onclick="if(event.target===this)scAskClose()">
  <div class="bs-sheet" id="sc-ask-sheet"></div>
</div>
<!-- ══ v2-107: 🧍 내 캐릭터 · 캐릭터 만들기 ══ -->""")

# ── 모양 ──
rep(".sc-homecard{display:none;", """/* v2-136: ⚖️ 과목 균형 요약 · 묻기 카드 */
.sc-m b em.sc-src{font-style:normal;font-size:10.5px;margin-left:4px}
.sc-dt{font-size:10.5px;color:var(--sub);font-weight:800;margin-left:4px}
.sc-bal{background:#fff;border:1.5px solid var(--gray2);border-radius:16px;padding:11px 12px;margin:0 0 10px;display:flex;flex-direction:column;gap:7px}
.sc-bal .cap{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:800;color:var(--navy);flex-wrap:wrap}
.sc-bal .cap em{font-style:normal;color:#047857;white-space:nowrap}.sc-bal .cap em.over{color:#b45309}
.sc-bal .bar{display:flex;height:16px;border-radius:8px;overflow:hidden;background:#f1f5f9}.sc-bal .bar i{display:block;height:16px}
.sc-bal .leg{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:11.5px;font-weight:800}.sc-bal .leg b{font-size:13px}
.sc-bal .note{font-size:11.5px;color:#64748b;font-weight:700;line-height:1.5}.sc-bal .note.exam{color:#b3261e}
.sc-bal .btns{display:flex;gap:6px}.sc-bal .btns button{flex:1;min-height:38px;font-family:inherit;font-size:12px;font-weight:900;border:1.5px solid var(--gray2);background:#fff;color:var(--navy);border-radius:10px;cursor:pointer;padding:6px 8px}
.sc-ask{background:#fff;border:1.5px solid var(--gray2);border-radius:16px;padding:12px;margin:0 0 10px}
.bs-sheet .sc-ask{border:none;padding:0;margin:0}
#sc-ask-sheet{max-height:88vh;overflow-y:auto}
.sc-ask h3{margin:0 0 4px;font-size:16px;color:var(--navy);font-weight:900}.sc-ask p{margin:0 0 10px;color:#64748b;font-size:12px;line-height:1.5}
.sc-ask-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.sc-ask-chips button{font-family:inherit;border:2px solid var(--gray2);background:#fff;border-radius:999px;padding:7px 14px;font-weight:900;font-size:13px;cursor:pointer;min-height:38px}
.sc-ask-in{display:grid;grid-template-columns:minmax(0,1fr) auto 42px;gap:6px;margin-bottom:4px}
.sc-ask-in input,.sc-ask-in select{font-family:inherit;font-size:13px;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 8px;min-width:0;min-height:42px;background:#fff;color:#0f172a;box-sizing:border-box}
.sc-ask-in .sca-add{border:none;background:var(--navy);color:#fff;border-radius:10px;font-size:18px;font-weight:900;cursor:pointer;min-height:42px}
.sc-ask-tip{font-size:10.5px;color:#94a3b8;font-weight:700;margin-bottom:8px}
.sc-ask-list{display:flex;flex-direction:column;gap:5px;margin-bottom:10px}
.sc-ask-list .ad{display:flex;align-items:center;gap:6px;font-weight:800;font-size:12.5px;background:#f8fafc;border-radius:8px;padding:6px 8px}
.sc-ask-list .ad i{font-style:normal;color:#fff;font-size:10.5px;font-weight:900;border-radius:5px;padding:2px 6px;flex-shrink:0}
.sc-ask-list .ad span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sc-ask-list .ad button{border:none;background:none;color:#94a3b8;font-size:14px;cursor:pointer;min-width:32px;min-height:32px;font-family:inherit}
.sc-ask-none{display:block;width:100%;border:none;background:none;color:#64748b;font-weight:800;font-size:12.5px;margin-top:6px;padding:9px;cursor:pointer;font-family:inherit}
.sc-ask-rule{background:#f8fafc;border:1.5px dashed var(--gray2);border-radius:12px;padding:9px 11px;font-size:11.5px;color:#475569;line-height:1.7;margin-top:8px}.sc-ask-rule>b:first-child{display:block;font-size:12px;color:var(--navy)}
.sc-homecard{display:none;""")

log = """ * v2-136 (2026-10-14) ⚖️ 스터디 코디 과목 균형 — 학년별 한 주 한도 · 수학 6할 · 다른 과목도 (원장 승인 시안 docs/mockup_codi_balance.html)
 *   · 코디가 짜는 한 주 공부를 학년 한도까지만: <b>초등 10시간 · 중등 14시간 · 고등 18시간</b> (예전엔 빈 시간을 다 채워 초6이 22시간인 일도).
 *   · 수학은 그중 <b>6할</b>까지(초 6시간 · 중 8시간 · 고 10시간 30분). 시험 2주 전(시험대비 트랙)이면 8할까지.
 *     넘치는 수학 할 일은 넣지 않고 「수학 할 일 중 «…»는 다음 주로 미뤘어요」로 보여 줍니다(급한 것부터 남김).
 *   · 그 주 처음 「지금 짜 줄까?」에서 먼저 묻습니다: 「이번 주 다른 과목 할 일 있어?」 — 과목(영어·국어·과학·사회) · 한 줄 · 30분/1시간/1시간 30분.
 *     학생이 넣은 것(✏️)을 먼저 자리에 두고(「(목)」처럼 적으면 그날), 「없어요」를 누르면 코디가 학년 규칙대로 채웁니다. 「✏️ 다른 과목 넣기」로 다시 열 수 있어요.
 *   · 남는 칸은 다른 과목 30분(🧭): 영어학원 가는 날 저녁 「영어학원 숙제」 · 초등 영어 단어·독서 · 중등 영어·국어·과학·사회 · 고등 영어·국어. 일요일은 쉬는 날.
 *   · 코디 화면 · 주간계획표 달력 위에 요약 카드: 「공부 10시간 / 초등 한도 10시간 ✓」 · 과목 색 막대 · 「수학 6h 60% · 영어 2.5h · 국어 1.5h」.
 *   · 「🧭 코디가 채워 주기」(달력)도 같은 규칙. 주간 계획 칸에 과목(subj)이 그대로 실려 학원앱 모아보기에도 과목 색으로 보입니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
