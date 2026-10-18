# 학생앱 v2-141 조립 — «v2-140 복사 + rep 고침»  (만들기만 · 배포는 원장 지시 때)
#   원장 결정 2026-10-18 「보스 넣어 · 중고등학교는 학년통합, 초등부는 따로 · 고등 학년은 순위판에서 가림 ·
#                        2주 전 버프 · 보관함은 둘 다(꾸미기 + Claude 그리기)」
#   계약: docs/raid_s2_contract.md §6
#   1) 레이드 카드 — raid.art {name,w,h,pal,rows} 가 있으면 그 그림으로 보스를 그린다 (없으면 예전 RAIDART.BOSSES)
#   2) raid.hideSch — 레이드 화면에서 학교·학년을 안 보인다 (앱에서도 한 번 더 비움)
#   3) 순위표 부 이름 — board.bandNames (통합이면 「중고등부」)
#   4) 추가 버프 띠 — buff.boost.windows 가 있으면 «내 줄의 bz 기간»으로 (전: 예고 한 줄 · 안: 지금 띠 · 없음: 띠 없음)
#      달력의 「추가 버프 시작」 표시도 내 기간 시작일
#   5) 「점수는 하루 세 번」 → 하루 여섯 번 (새벽 4시 · 오후 4시 · 저녁 6시 · 8시 · 밤 10시 · 자정)
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-140.html'); DST = os.path.join(ROOT, 'student_v2-141.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-140';", "var STU_VER = 'v2-141';")

# ── 0) 화면 꾸밈 — 버프 기간 전 예고 한 줄
rep(".bzn{font-size:10.5px;color:#6b8781;border-top:1px solid #1f5a4c;padding-top:6px}",
    ".bzn{font-size:10.5px;color:#6b8781;border-top:1px solid #1f5a4c;padding-top:6px}\n"
    "/* ★ v2-141: 내 버프 기간 전 — 작은 예고 한 줄 */\n"
    ".bzsoon{margin:0 0 10px;padding:10px 13px;border-radius:12px;background:#f0fbf7;border:1.5px solid #a7e3cf;"
    "font-size:12.5px;font-weight:800;color:#0f5a47;line-height:1.6}\n"
    ".bzsoon b{color:#0b7a5c}\n"
    ".bzsoon span{display:block;font-size:11px;font-weight:700;color:#5b7f74}")

# ── 1) 보스 보관함 그림 (raid.art) ──────────────────────────────
rep("""  paper:{ic:'📄',n:'시험지 괴물'}, slime:{ic:'🟢',n:'슬라임'} };""",
"""  paper:{ic:'📄',n:'시험지 괴물'}, slime:{ic:'🟢',n:'슬라임'} };
/* ★ v2-141: 보스 보관함 그림 (계약 docs/raid_s2_contract.md §4·§6)
 *   raid.art = { name, w, h, pal:[색…], rows:['..0011…', …] }
 *   rows[y][x] 한 글자 = pal 번호 (글자표 RD_ART_CH, 62색까지) · '.' = 투명.
 *   테두리까지 칠해진 완성 그림이라 따로 테두리를 두르지 않는다.
 *   art 가 없으면 예전처럼 RAIDART.BOSSES 의 key 로 그린다. */
var RD_ART_CH='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function rdArtGrid(a){
  if(!a||!Array.isArray(a.rows)||!a.rows.length||!Array.isArray(a.pal)||!a.pal.length) return null;
  if(a._grid) return a._grid;
  var rows=a.rows, w=Number(a.w)||0, i;
  for(i=0;i<rows.length;i++) w=Math.max(w,String(rows[i]||'').length);
  if(!w) return null;
  var g=[];
  for(var y=0;y<rows.length;y++){
    var line=String(rows[y]||''), row=[];
    for(var x=0;x<w;x++){
      var ch=line.charAt(x), k=(ch&&ch!=='.')?RD_ART_CH.indexOf(ch):-1;
      row.push(k>=0&&a.pal[k]?String(a.pal[k]):null);
    }
    g.push(row);
  }
  try{ Object.defineProperty(a,'_grid',{ value:g, enumerable:false, configurable:true }); }catch(e){}
  return g;
}
/* 보스 이름표 — 기본 6종은 RD_BOSS, 보관함 보스(꾸민 것·새로 그린 것)는 art.name */
function rdBossOf(r){
  var B=r&&RD_BOSS[r.boss];
  if(B) return B;
  return { ic:'⚔️', n:(r&&r.art&&r.art.name)?String(r.art.name):'보스' };
}""")
rep("""      var B=RD_BOSS[r.boss]||{ic:'⚔️',n:'보스'};""", """      var B=rdBossOf(r);   /* ★ v2-141: 보관함 보스는 art.name */""")
rep("""+'<i>'+B.n+""", """+'<i>'+rcEsc(B.n)+""")
rep("""  var boss=(A.BOSSES.filter(function(x){ return x.key===b.boss; })[0] || A.BOSSES[3]).grid;""",
"""  /* ★ v2-141: 보관함 그림(art)이 있으면 그것을 먼저 */
  var boss=rdArtGrid(b.art) || (A.BOSSES.filter(function(x){ return x.key===b.boss; })[0] || A.BOSSES[3]).grid;""")
rep("""  var bw=boss[0].length, bh=boss.length, base=Math.floor(LH*0.53);
  ctx.fillStyle='#1e1748'; ctx.fillRect(Math.round((LW-bw-6)/2)*S,base*S,(bw+6)*S,5*S);
  ctx.fillStyle='#2c2366'; ctx.fillRect(Math.round((LW-bw-6)/2)*S,base*S,(bw+6)*S,S);
  var bob=Math.floor(t/9)%2;
  A.paint(ctx,boss,S,Math.round((LW-bw)/2),base-bh+bob);""",
"""  var bw=boss[0].length, bh=boss.length, base=Math.floor(LH*0.53);
  var bob=Math.floor(t/9)%2;
  /* ★ v2-141: 보관함 보스는 더 클 수 있다 — 64 x 56 까지는 기본 보스와 같은 크기(한 칸 3px)로,
   * 그보다 커서 무대(가로 104칸 · 받침 위 61칸)를 넘으면 한 칸을 2px·1px 로 줄여 통째로 보이게 한다. */
  var bs=S; while(bs>1 && (bw*bs>(LW-6)*S || bh*bs>(base-2)*S)) bs--;
  if(bs===S){
  ctx.fillStyle='#1e1748'; ctx.fillRect(Math.round((LW-bw-6)/2)*S,base*S,(bw+6)*S,5*S);
  ctx.fillStyle='#2c2366'; ctx.fillRect(Math.round((LW-bw-6)/2)*S,base*S,(bw+6)*S,S);
  A.paint(ctx,boss,S,Math.round((LW-bw)/2),base-bh+bob);
  } else {
    var bpx=Math.round((cv.width-bw*bs)/2), bpy=base*S-bh*bs+bob*S;
    ctx.fillStyle='#1e1748'; ctx.fillRect(bpx-3*S,base*S,bw*bs+6*S,5*S);
    ctx.fillStyle='#2c2366'; ctx.fillRect(bpx-3*S,base*S,bw*bs+6*S,S);
    for(var by=0;by<bh;by++) for(var bx=0;bx<bw;bx++){
      var bc=boss[by][bx]; if(!bc) continue;
      ctx.fillStyle=bc; ctx.fillRect(bpx+bx*bs,bpy+by*bs,bs,bs);
    }
  }""")

# ── 2) 학교·학년 가리기 (raid.hideSch) — 엔진이 비워 보내지만 앱에서도 한 번 더
rep("""    ((RD.board && RD.board.list) || []).forEach(function(r){
""", """    ((RD.board && RD.board.list) || []).forEach(function(r){
      /* ★ v2-141: 학교·학년 가리기 — 이 레이드 줄에서는 학교·학년을 아무 데도 쓰지 않는다 */
      if(r && r.hideSch) (r.rows||[]).forEach(function(x){ if(x){ x.sch=''; x.gr=''; } });
""")

# ── 3) 순위표 부 이름 — board.bandNames ─────────────────────────
rep("""var RC_BN={elem:'초등부',mid:'중등부',high:'고등부'};""",
"""var RC_BN={elem:'초등부',mid:'중등부',high:'고등부'};
/* ★ v2-141: 부 이름은 순위판(board.bandNames)을 먼저 따른다 — 중·고등 통합이면 mid = 「중고등부」 */
function rcBN(k,b){
  b=b||RC.board;
  var n=b&&b.bandNames&&b.bandNames[k];
  return n?String(n):(RC_BN[k]||'');
}
/* 체험 리그 안내의 「중학생 형·누나들」 — 통합이면 「중고등부 형·누나들」 */
function rcBigs(b){
  b=b||RC.board;
  return (b&&b.bandNames&&b.bandNames.mid)?(rcEsc(rcBN('mid',b))+' 형·누나들'):'중학생 형·누나들';
}
/* 순위 줄의 「중2 옥길중 · 」 — 학교·학년이 비어 있으면(가린 줄) 군더더기 « · » 없이 */
function rcWho(r){
  var w=[r&&r.gr,r&&r.sch].filter(function(x){ return x!=null&&String(x).trim(); }).map(rcEsc).join(' ');
  return w?(w+' · '):'';
}""")
rep("""onclick="rcTab(\\''+k+'\\')">'+RC_BN[k]""", """onclick="rcTab(\\''+k+'\\')">'+rcEsc(rcBN(k,b))""")
rep("RC_BN[band]", "rcEsc(rcBN(band,b))", 5)
rep("""(pc>=100?'중등부만큼 풀고 있어요! 대단해요 🎉'""", """(pc>=100?rcEsc(rcBN('mid',b))+'만큼 풀고 있어요! 대단해요 🎉'""")
rep("""<div class="rc-cmp"><span class="l">중등부</span>""", """<div class="rc-cmp"><span class="l">'+rcEsc(rcBN('mid',b))+'</span>""")
rep("""상은 없지만, 중학생 형·누나들과 <b>똑같은 잣대</b>""", """상은 없지만, '+rcBigs(b)+'과 <b>똑같은 잣대</b>""")
rep("""<div class="hd">📊 중학생 형·누나들과 견주면?</div>""", """<div class="hd">📊 '+rcBigs(b)+'과 견주면?</div>""")
rep("""      +'<div class="sc">'+rcEsc(r.gr)+' '+rcEsc(r.sch)+' · '+rcEsc(r.label||t.n)""",
    """      +'<div class="sc">'+rcWho(r)+rcEsc(r.label||t.n)""")
rep("""  if(bandEl) bandEl.textContent=LG_BN[band]||'';""",
"""  /* ★ v2-141: 🏁 진도 탭이거나 IB아하 순위가 없으면 진도 레이스의 부 이름(bandNames — 통합이면 「중고등부」) */
  if(bandEl) bandEl.textContent=(((LG.tab==='race'||!b)&&RC.board)?rcBN(rcMyBand(RC.board),RC.board):LG_BN[band])||'';""")

# ── 4) 추가 버프 — 학교별 기간(windows) · 내 줄의 bz ─────────────
rep("""      BF.me = null;
      if(b) ['mid','elem','high'].forEach(function(bd){
        ((b[bd])||[]).forEach(function(r){ if(String(r.code)===code) BF.me=r; });
      });
""", """      BF.me = null;
      if(b) ['mid','elem','high'].forEach(function(bd){
        ((b[bd])||[]).forEach(function(r){ if(String(r.code)===code) BF.me=r; });
      });
      try{ bzRender(); }catch(e){}   /* ★ v2-141: 학교별 버프 기간은 내 줄(bz)을 봐야 그릴 수 있다 */
""")
rep("""  var dd=Number(bz.dday); if(!(dd>=0)) dd=0;
""", """  var dd=Number(bz.dday); if(!(dd>=0)) dd=0;
  /* ★ v2-141: 학교·학년마다 버프 기간이 다르다(boost.windows · 원장 2026-10-18 「시험 2주 전 버프」).
   *   내 줄의 bz{from,to}(엔진이 정해 준 내 기간)만 본다 — 기간 전이면 예고 한 줄, 기간 안이면 지금 띠
   *   (남은 날은 내 기간 마지막 날까지), 기간이 지났거나 내 기간이 없으면 띠 없음.
   *   windows 가 없으면 예전 그대로(모두 같은 날부터). */
  if(Array.isArray(bz.windows)){
    var mr=bzMyRow(B), w=mr&&mr.bz, td=bzToday();
    if(!w||!w.from||!w.to||td>String(w.to)){ el.innerHTML=''; return; }
    if(td<String(w.from)){
      el.innerHTML='<div class="bzsoon">🔥 <b>'+bzMD(w.from)+'</b>부터 시험 대비 버프!'
        +'<span>그날부터 '+bzMD(w.to)+'까지 점수가 ×'+flat.toFixed(1)+', 플래너까지 올리면 ×'+top.toFixed(1)+'</span></div>';
      return;
    }
    dd=Math.max(0,bzDays(td,String(w.to)));
  }
""")
rep("""function bzRender(){
  /* v2-103:""", """/* ★ v2-141: 내 줄 — 학교별 추가 버프 기간(bz)이 들어 있다. 버프 자료(BF.me)가 먼저, 없으면 진도 순위판 */
function bzMyRow(B){
  if(B&&B.me) return B.me;
  var code=String((typeof studentInfo!=='undefined'&&studentInfo&&studentInfo.lumen_rec_code)||''); if(!code) return null;
  var rb=(typeof RC!=='undefined'&&RC&&RC.board)?RC.board:null; if(!rb) return null;
  var hit=null;
  ['elem','mid','high'].forEach(function(k){ (rb[k]||[]).forEach(function(r){ if(!hit&&r&&String(r.code)===code) hit=r; }); });
  return hit;
}
window.bzMyRow=bzMyRow;
function bzToday(){ return new Date(Date.now()+9*3600000).toISOString().slice(0,10); }
function bzDays(a,b){ return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }
function bzMD(d){ var a=String(d).split('-'); return Number(a[1])+'월 '+Number(a[2])+'일'; }

function bzRender(){
  /* v2-103:""")
# 달력 — 「추가 버프 시작」 표시
rep("""/* 서버 자료 → 날짜별 항목.""", """/* ★ v2-141: 학교별 추가 버프 기간(windows)에서 «내» 시작일.
 *   진도 순위판의 내 줄(bz — 엔진이 정해 준 것)을 먼저 보고, 순위판에 내 줄이 아직 없으면
 *   엔진과 같은 규칙(학교 이름 앞부분 · 학년, 맞는 첫 줄)으로 찾는다. 맞는 줄이 없으면 null. */
function calMyBzFrom(wins, me){
  try{
    var mr=window.bzMyRow?bzMyRow(window.BF||null):null;
    if(mr) return (mr.bz&&mr.bz.from)?String(mr.bz.from):null;
  }catch(e){}
  var sch=String((me&&me.school)||'').trim().replace(/(중|고등)학교$/,'$1').replace(/초등학교$/,'초');
  var g=String((me&&me.grade)||''), lv=(g.match(/[초중고]/)||[''])[0], n=(g.match(/\\d/)||[''])[0], gr=(lv&&n)?(lv+n):'';
  for(var i=0;i<(wins||[]).length;i++){
    var w=wins[i]; if(!w||!w.from) continue;
    var grs=Array.isArray(w.grs)?w.grs.map(String):[];
    if(grs.length&&grs.indexOf(gr)<0) continue;
    var sc=String(w.sch||'').trim();
    if(!sc||sch.indexOf(sc)===0) return String(w.from);
  }
  return null;
}
/* 서버 자료 → 날짜별 항목.""")
rep("""    if(rs.buff&&rs.buff.boost&&rs.buff.boost.on&&rs.buff.boost.from) put(rs.buff.boost.from,{ k:'race', t:'추가 버프 시작' }); }""",
"""    /* ★ v2-141: 학교별 버프 기간(windows)이면 «내» 기간 시작일 (내 기간이 없으면 표시 안 함) */
    if(rs.buff&&rs.buff.boost&&rs.buff.boost.on){
      var _bzf=Array.isArray(rs.buff.boost.windows)?calMyBzFrom(rs.buff.boost.windows, me):rs.buff.boost.from;
      if(_bzf) put(_bzf,{ k:'race', t:'추가 버프 시작' });
    } }""")

# ── 5) 점수 들어오는 시각 — 하루 여섯 번 ──────────────────────────
rep(""" * 겨루는 이벤트. 채점 기록은 하루 3번(새벽4시·오후4시·밤10시) 매쓰플랫에서""",
    """ * 겨루는 이벤트. 채점 기록은 하루 6번(새벽4시·오후4시·저녁6시·8시·밤10시·자정 — v2-141) 매쓰플랫에서""")
rep("""   * 2026-08-28부터 매쓰플랫 채점 기록을 하루 세 번 가져온다. */
  h+='<div class="rc-card" style="background:#f8fbff;border-color:#dbeafe">'
    +'<div class="hd" style="color:#1d4ed8">🕐 점수는 하루 세 번 들어와요</div>'
    +'<div style="display:flex;gap:7px;margin:2px 0 9px">'
    + [['새벽','4시'],['오후','4시'],['밤','10시']].map(function(t){
        return '<div style="flex:1;background:#fff;border:1.5px solid #dbeafe;border-radius:11px;padding:9px 4px;text-align:center">'""",
"""   * 2026-08-28부터 매쓰플랫 채점 기록을 하루 세 번 가져온다.
   * ★ v2-141: 하루 여섯 번 — 새벽 4시 · 오후 4시 · 저녁 6시 · 8시 · 밤 10시 · 자정 (세 칸씩 두 줄) */
  h+='<div class="rc-card" style="background:#f8fbff;border-color:#dbeafe">'
    +'<div class="hd" style="color:#1d4ed8">🕐 점수는 하루 여섯 번 들어와요</div>'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:2px 0 9px">'
    + [['새벽','4시'],['오후','4시'],['저녁','6시'],['저녁','8시'],['밤','10시'],['밤','12시(자정)']].map(function(t){
        return '<div style="min-width:0;background:#fff;border:1.5px solid #dbeafe;border-radius:11px;padding:9px 4px;text-align:center">'""")
rep("""          +'<div style="font-size:16px;font-weight:900;color:#1d4ed8;margin-top:1px">'+t[1]+'</div></div>';""",
    """          +'<div style="font-size:'+(t[1].length>4?'13':'16')+'px;font-weight:900;color:#1d4ed8;margin-top:1px;white-space:nowrap">'+t[1]+'</div></div>';""")
rep("""    +'지금 푼 문제는 <b style="color:#1d4ed8">다음 시각</b>에 점수로 들어와요. '
    +'바로 안 올라도 걱정 마세요 — 빠짐없이 다 세어집니다 🙂</div></div>';""",
"""    +'지금 푼 문제는 <b style="color:#1d4ed8">다음 시각</b>에 점수로 들어와요. '
    +'가끔은 조금 늦게 들어올 때도 있어요.<br>'
    +'바로 안 올라도 걱정 마세요 — 빠짐없이 다 세어집니다 🙂</div></div>';""")

log = """ * v2-141 (2026-10-18) ⚔️ 다음 시즌 준비 — 보스 보관함 그림 · 학교별 버프 기간 · 중고등부 (원장 결정)
 *   · <b>보스</b>: 레이드에 보관함 그림(art)이 있으면 그 그림으로 보스를 그립니다(원장님이 꾸민 보스·새 보스).
 *     이름도 그 보스 이름으로. 그림이 없으면 예전 6종 그대로.
 *   · <b>학교·학년 가리기</b>: 「가리기」를 켠 레이드는 학교·학년을 어디에도 안 보입니다.
 *   · <b>부 이름</b>: 중·고등학교를 한 리그로 묶으면 순위표·탭·리그 머리에 「중고등부」로 나옵니다.
 *   · <b>추가 버프</b>: 학교·학년마다 기간이 달라졌습니다(시험 2주 전 ~ 시험 마지막 날).
 *     내 기간 전에는 「🔥 ○월 ○일부터 시험 대비 버프!」 한 줄, 기간 안에는 지금 띠(남은 날은 내 기간 기준),
 *     내 기간이 없으면 띠가 안 나옵니다. 달력의 「추가 버프 시작」도 내 기간 시작일에.
 *   · <b>점수 들어오는 시각</b>: 하루 여섯 번(새벽 4시 · 오후 4시 · 저녁 6시 · 8시 · 밤 10시 · 자정),
 *     가끔 조금 늦을 수 있다는 말도 덧붙였습니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST)
