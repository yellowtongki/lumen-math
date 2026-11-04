# 학생앱 v2-157 조립 — «v2-156 복사 + rep 고침»
#   원장 2026-11-04 (학생 캡처 RPM 중2(하) 127P) 「학생앱에 다시 도전하기가 없다. 잘 보이게 만들자. 지금 구현이 되어 있나?」
#   [까닭] 다시 도전은 있다(v2-91). 그런데
#     ① 2차를 이미 하고 또 틀리면 3차는 3일 뒤에 열린다 — 그 사이 화면엔 «다시 도전에서 풀어요»만 있고 버튼도 날짜도 없었다(캡처가 이 경우).
#     ② 2차 「다시 도전 시작하기」는 쪽 «맨 아래» 마무리 카드에만 있었다. 쪽을 나가면 다시 그 쪽을 열어 맨 아래까지 내려야 보였다.
#     ③ 채점 홈·학생앱 홈에는 3차(3일 뒤)만 모아 보였고 2차를 기다리는 쪽은 안 보였다.
#   [고침] ① 쪽 맨 위에 상태 카드: 「🔁 다시 도전 N문항 · 시작하기」(주황, 눈에 띄게) / 「⏳ 3차 도전은 11/7(토)부터」 / 「🔔 3차 도전하기」
#          ② 틀린 문항 칸(정답 가림 상자)에 바로 「🔁 다시 도전 시작하기」·「3차 도전하기」 버튼, 기다릴 때는 날짜
#          ③ 채점 홈 맨 위에 «다시 도전 기다리는 쪽»(최근 14일) 모아 보기 → 누르면 그 쪽을 열고 바로 시작
#          ④ 학생앱 홈 「📖 교재 채점」 칸 배지: 「🔁 다시 도전 N」
#   실행: python3 sync/appbuild/build_student_v2157.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-156.html'); DST = os.path.join(ROOT, 'student_v2-157.html')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-156';", "var STU_VER = 'v2-157';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-157 (2026-11-04) 🔁 「다시 도전」이 잘 보이게 (원장 「다시 도전하기가 없다. 잘 보이게」 — 학생 캡처 RPM 중2(하) 127P)\n"
    " *   · 쪽 맨 위에 다시 도전 카드: 「🔁 다시 도전 N문항 · 시작하기」(주황) · 2차도 틀렸으면 「⏳ 3차 도전은 11/7(토)부터」 · 그날이 되면 「🔔 3차 도전하기」.\n"
    " *   · 틀린 문항 칸에도 바로 「다시 도전 시작하기」 버튼 (기다릴 때는 3차 날짜).\n"
    " *   · 채점 홈 맨 위에 «다시 도전을 기다리는 쪽»(최근 14일)을 모아 보여 줍니다 — 누르면 그 쪽으로 가서 바로 시작.\n"
    " *   · 학생앱 홈 「📖 교재 채점」 칸에 「🔁 다시 도전 N」 배지.\n"
    " *\n")

# ── 모양 ──
rep(".bk-rtcard.warn{border-color:#f0d9a8;background:#fffbeb}",
    ".bk-rtcard.warn{border-color:#f0d9a8;background:#fffbeb}\n"
    "/* ★ v2-157: 다시 도전 카드 — 눈에 띄게(주황) · 기다림(회색) */\n"
    ".bk-rtcard.hot{border:2px solid #fb923c;background:linear-gradient(135deg,#fff7ed,#ffedd5);box-shadow:0 4px 14px rgba(234,88,12,.15)}\n"
    ".bk-rtcard.hot .t1{color:#c2410c;font-size:15px}\n"
    ".bk-rtcard.hot .bk-next{background:#ea580c}\n"
    ".bk-rtcard.wait{border-color:#cbd5e1;background:#f8fafc}\n"
    ".bk-rtcard.wait .t1{color:#334155}\n"
    ".bk-hideans .bk-rtgo{display:block;width:100%;margin-top:8px;border:0;border-radius:10px;background:#ea580c;color:#fff;font-family:inherit;font-size:13px;font-weight:900;padding:10px 6px;cursor:pointer}\n"
    ".bk-hideans .when{font-size:12px;font-weight:900;color:#c2410c;margin-top:4px}")

# ── 도우미 + 쪽 맨 위 카드 + 채점 홈 모아 보기 ──
rep("/* 채점 화면 맨 위 「🔔 3일 전에 못 맞힌 문항」 (계약 §2-4) */\nfunction bkRt3Card(pg,probs){",
    r"""/* ★ v2-157: 3차를 기다리는 문항 — 2차에 못 맞혔고 아직 3일이 안 지났다 */
function bkRtWait3(p,m,now){
  if(!bkRtBase(p,m)||m.seen) return false;
  var l=bkRtLast(m);
  if(!l||Number(l.n)!==2||l.r==='O') return false;
  return !bkRtDue3(m,now);
}
/* 3차가 열리는 때 (ms) */
function bkRtDueAt(m){ var l=bkRtLast(m); var t=Date.parse(String(l&&l.at||'')); return t?t+BK_RT_DAYS*86400000:0; }
function bkRtDay(ms){ if(!ms) return ''; var d=new Date(ms); return (d.getMonth()+1)+'/'+d.getDate()+'('+'일월화수목금토'.charAt(d.getDay())+')'; }
/* 지금 보고 있는 쪽(학습지)의 문항들 */
function bkCurProbs(){
  try{ var b=BK.book, pg=BK.page; if(!b||!pg) return [];
    var ans=BK.ans[b.bid], pa=ans&&ans.pages&&ans.pages[pg.wpid]; return (pa&&pa.problems)||[]; }catch(e){ return []; }
}
/* 쪽 맨 위 — 다시 도전 상태 카드 하나 (3차 때 → 2차 시작 → 3차 기다림 순) */
function bkRtTopCard(pg,probs){
  var h3=bkRt3Card(pg,probs); if(h3) return h3;
  var now=Date.now(), rt2=bkRtList(pg,probs,2,now);
  if(rt2.length){
    var st=bkPageStat(pg,probs);
    if(st.done<st.tot) return '';      /* 다 채점하기 전에는 아래 마무리 안내로 */
    return '<div class="bk-rtcard hot" style="margin:0 0 10px"><div class="t1">🔁 다시 도전할 문항 '+rt2.length+'개</div>'
      +'<div class="s1">틀린 '+rt2.map(function(p){ return h3Esc(String(p.num||'')); }).join(' · ')+'번을 다시 풀어요. 맞히면 XP!</div>'
      +'<button class="bk-next" onclick="bkRtStart(2)">다시 도전 시작하기 →</button></div>';
  }
  return bkRtWaitCard(pg,probs,'0 0 10px');
}
/* 2차도 못 맞혀 3차를 기다리는 문항 — 날짜를 알려 준다 */
function bkRtWaitCard(pg,probs,mg){
  var now=Date.now(), nums=[], due=0;
  (probs||[]).forEach(function(p){
    var m=BK.scores[bkKeyOf(pg.pid,p.wpId)];
    if(!bkRtWait3(p,m,now)) return;
    nums.push(h3Esc(String(p.num||''))); var t=bkRtDueAt(m); if(t&&(!due||t<due)) due=t;
  });
  if(!nums.length) return '';
  return '<div class="bk-rtcard wait" style="margin:'+(mg||'10px 0 0')+'"><div class="t1">⏳ 3차 도전은 '+bkRtDay(due)+'부터 열려요</div>'
    +'<div class="s1">2차 다시 도전에서 못 맞힌 '+nums.join(' · ')+'번 — 3일 뒤에 한 번 더 풀면 오래 기억에 남아요.<br>그날 이 쪽 맨 위와 채점 홈에 「3차 도전하기」가 떠요.</div></div>';
}
/* 채점 홈 — 2차 다시 도전을 기다리는 쪽 모아 보기 (최근 14일) */
function bkRt2Groups(){
  var now=Date.now(), groups=[], by={};
  Object.keys(BK.scores).forEach(function(k){
    var m=BK.scores[k];
    if(!m||m.self||m.seen) return;
    if(m.r!=='X'&&m.r!=='?') return;
    if(bkRtArr(m).length) return;
    var t=Date.parse(String(m.at||'')); if(!t||now-t>14*86400000) return;
    var gid='';
    if(m.kind==='ws'&&m.swId!=null) gid='ws:'+m.swId;
    else if(m.pid!=null) gid='bk:'+m.pid;
    else return;
    if(!by[gid]){ by[gid]={ gid:gid, n:0, t:'', at:'' }; groups.push(by[gid]); }
    by[gid].n++; if(String(m.at)>by[gid].at) by[gid].at=String(m.at);
  });
  groups.sort(function(a,b){ return a.at<b.at?1:-1; });
  return groups;
}
function bkRtGroupTitle(g){
  var wsl=(BK.wsq&&BK.wsq.list)||[], books=(BK.swb&&BK.swb.books)||[];
  if(g.gid.indexOf('ws:')===0){
    var sid=g.gid.slice(3), w=wsl.find(function(x){ return String(x.swId)===sid; });
    return w?bkShortTitle(w.title||'학습지'):'';
  }
  var pid=g.gid.slice(3), t='';
  books.forEach(function(b){ (b.pages||[]).forEach(function(pg){ if(String(pg.pid)===pid) t=bkShortTitle(b.title||'교재')+(pg.page!=null?(' '+pg.page+'P'):''); }); });
  return t;
}
function bkRt2Home(){
  var gs=bkRt2Groups().filter(function(g){ g.t=bkRtGroupTitle(g); return !!g.t; });
  if(!gs.length) return '';
  var tot=0; gs.forEach(function(g){ tot+=g.n; });
  var h='<div class="bk-rtcard hot" style="margin:0 0 10px">';
  h+='<div class="t1">🔁 다시 도전할 문항 '+tot+'개</div>';
  h+='<div class="s1">틀린 문항만 다시 풀어요 · 누르면 그 쪽으로 가서 바로 시작해요.</div>';
  gs.slice(0,6).forEach(function(g){
    h+='<button class="bk-ghost" onclick="bkRtGo('+bkQ(g.gid)+',2)">'+h3Esc(g.t)+' · '+g.n+'문항 · 다시 도전 →</button>';
  });
  if(gs.length>6) h+='<div class="s1" style="margin-top:6px">… 그 밖에 '+(gs.length-6)+'쪽</div>';
  h+='</div>';
  return h;
}
/* 채점 화면 맨 위 「🔔 3일 전에 못 맞힌 문항」 (계약 §2-4) */
function bkRt3Card(pg,probs){""")

# 「3차 도전하기」 열기를 2차에도 — round 를 받는다
rep("window.bkRtGo=async function(gid){\n  gid=String(gid||'');",
    "window.bkRtGo=async function(gid,round){\n  gid=String(gid||''); round=Number(round)||3;   /* ★ v2-157: 2차도 */")
rep("if(gid.indexOf('ws:')===0){ await bkOpenWs(gid.slice(3)); bkRtStart(3); return; }",
    "if(gid.indexOf('ws:')===0){ await bkOpenWs(gid.slice(3)); bkRtStart(round); return; }")
rep("if(String(pgs[j].pid)===pid){ await bkOpenBook(i); bkOpenPage(j); bkRtStart(3); return; }",
    "if(String(pgs[j].pid)===pid){ await bkOpenBook(i); bkOpenPage(j); bkRtStart(round); return; }")

# 쪽 맨 위
rep("  var h=bkRt3Card(pg,probs);            /* ★ v2-91: 「🔔 3일 전에 못 맞힌 문항」 */",
    "  var h=bkRtTopCard(pg,probs);          /* ★ v2-157: 다시 도전 상태(2차 시작 · 3차 · 3차 기다림) — v2-91 은 3차만 */")
# 채점 홈 맨 위
rep("  h+=bkRt3Home();                    /* ★ v2-91: 「🔔 3일 전에 못 맞힌 문항」 */",
    "  h+=bkRt3Home();                    /* ★ v2-91: 「🔔 3일 전에 못 맞힌 문항」 */\n"
    "  h+=bkRt2Home();                    /* ★ v2-157: 「🔁 다시 도전할 문항」 — 쪽마다 */")

# 마무리 카드 — 주황 · 3차 기다림
rep("      h+='<div class=\"bk-rtcard\"><div class=\"t1\">🔁 다시 도전할 문항 '+rt2.length+'개</div>';",
    "      h+='<div class=\"bk-rtcard hot\"><div class=\"t1\">🔁 다시 도전할 문항 '+rt2.length+'개</div>';")
rep("""        +'개 — 남은 문항을 마저 채점하면 시작할 수 있어요.</div>';
    }
  }""", """        +'개 — 남은 문항을 마저 채점하면 시작할 수 있어요.</div>';
    }
  } else {
    h+=bkRt3Card(pg,probs).replace('margin:0 0 10px','margin:10px 0 0');   /* ★ v2-157 */
    h+=bkRtWaitCard(pg,probs);
  }""")

# 틀린 문항 칸 — 정답 가림 상자에 바로 버튼 / 날짜
rep("""    h+='<div class="s">정답은 그때 보여 줄게요 — 지금 보면 다시 풀 까닭이 없으니까요.</div>';
    h+='<button class="bk-seeans" onclick="bkSeeAns('+bkQ(w)+')">지금 정답 보기</button>';""",
    """    /* ★ v2-157: 지금 할 수 있는 다시 도전을 바로 누르게 · 기다릴 때는 날짜 */
    var now7=Date.now(), go7='';
    if(bkRtDue3(m,now7)) go7='<button class="bk-rtgo" onclick="bkRtStart(3)">🔔 3차 도전하기</button>';
    else if(bkRtWait3(p,m,now7)){
      h=h.replace('🔁 이 문항은 <b>다시 도전</b>에서 풀어요','🔁 2차 다시 도전에서도 못 맞혔어요');
      go7='<div class="when">⏳ 3차 도전은 '+bkRtDay(bkRtDueAt(m))+'부터</div>';
    } else if(bkRt2Want(p,m)){
      var pr7=bkCurProbs(), st7=BK.page?bkPageStat(BK.page,pr7):null;
      go7=(st7&&st7.done>=st7.tot)?'<button class="bk-rtgo" onclick="bkRtStart(2)">🔁 다시 도전 시작하기</button>'
        :'<div class="when">이 쪽을 다 채점하면 「다시 도전」이 열려요</div>';
    }
    h+=go7;
    h+='<div class="s">정답은 그때 보여 줄게요 — 지금 보면 다시 풀 까닭이 없으니까요.</div>';
    h+='<button class="bk-seeans" onclick="bkSeeAns('+bkQ(w)+')">지금 정답 보기</button>';""")

# 학생앱 홈 「📖 교재 채점」 배지
rep("  if(todo) todo.style.display='';\n  if(todo) todo.textContent='채점하기 ›';\n}",
    "  if(todo) todo.style.display='';\n  if(todo) todo.textContent='채점하기 ›';\n"
    "  /* ★ v2-157: 다시 도전할 것이 있으면 배지로 */\n"
    "  try{ var rn=0; bkRt2Groups().forEach(function(g){ rn+=g.n; });\n"
    "    var now=Date.now(); Object.keys(BK.scores).forEach(function(k){ var m=BK.scores[k]; if(m&&!m.self&&(m.r==='X'||m.r==='?')&&bkRtDue3(m,now)) rn++; });\n"
    "    if(todo&&rn){ todo.textContent='🔁 다시 도전 '+rn; todo.style.background='#ea580c'; todo.style.color='#fff'; }\n"
    "    else if(todo){ todo.style.background=''; todo.style.color=''; } }catch(e){}\n}")
open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
