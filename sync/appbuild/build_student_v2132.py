# 학생앱 v2-132 조립 — «v2-131 복사 + rep 고침» (docs/handoff.md §2)
#   원장 결정 2026-10-09: 「B안(분수 틀) + 엔진으로 가자. 옛 기록도 다시 채점해서 ◯로 바꿔줘」
#   ① 채점 엔진 인라인 블록을 sync/hw_grade_engine.js 최신본으로 통째로 교체
#   ② 자판 「／분수」 → 「분수」(틀 넣기) · 「대분수」 키 추가 (숫자·문자식 자판)
#   ③ 입력칸을 «글 조각 + 분수 틀» 모델(BK.fx)로 — 위아래 두 칸, 정수 칸, 커서 이동, 우리말 읽기
#   실행: python3 sync/appbuild/build_student_v2132.py   (저장소 맨 위 폴더에서)
import re, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-131.html'); DST = os.path.join(ROOT, 'student_v2-132.html')
ENG = os.path.join(ROOT, 'sync', 'hw_grade_engine.js')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-131';", "var STU_VER = 'v2-132';")

# ① 엔진 교체 — 「★ v2-82: 아래 블록은 … 복사한 것이다」 표시 뒤 헤더부터 IIFE 끝까지
mark = '/* ★ v2-82: 아래 블록은 sync/hw_grade_engine.js 를 그대로 복사한 것이다'
i0 = s.index(mark); i1 = s.index('/* ═', i0)
end_tok = "})(typeof globalThis !== 'undefined' ? globalThis : this);"
i2 = s.index(end_tok, i1) + len(end_tok)
eng = open(ENG, encoding='utf-8').read().rstrip('\n')
assert eng.startswith('/* ═') and eng.endswith(end_tok)
s = s[:i1] + eng + s[i2:]

# ② 자판
rep("['0'],[',',',','fn'],['／분수','/','fn'],['π','π','fn'],",
    "['0'],[',',',','fn'],['분수','FRAC','fn'],['π','π','fn'],")
rep("['다음 칸','NEXT','fn'],['제출','GO','go',3]\n  ]},",
    "['대분수','MIX','fn'],['다음 칸','NEXT','fn'],['제출','GO','go',2]\n  ]},")
rep("['('],[')'],['／분수','/','fn'],['='],['_'],",
    "['('],[')'],['분수','FRAC','fn'],['='],['_'],")
rep("[',',',','fn'],['.'],[\"'\"],['⌫','BS','fn'],['다음 칸','NEXT','fn'],\n    ['제출','GO','go',5]",
    "[',',',','fn'],['.'],[\"'\"],['⌫','BS','fn'],['다음 칸','NEXT','fn'],\n    ['대분수','MIX','fn'],['제출','GO','go',4]")

# ③ 입력칸 모델
rep("BK.active=null; BK.fields=[]; BK.fi=0; BK.sh=null;", "BK.active=null; BK.fields=[]; BK.fx=[]; BK.fi=0; BK.sh=null;", 5)
rep("    BK.fields=[]; for(var i=0;i<BK.sh.parts.length;i++) BK.fields.push('');",
    "    BK.fields=[]; BK.fx=[]; for(var i=0;i<BK.sh.parts.length;i++){ BK.fields.push(''); BK.fx.push(bkFxNew()); }")
rep("""  var el=document.getElementById('bkf-'+wp+'-'+ix); if(!el) return;
  el.textContent=clear?'':(v||'');
  el.classList.toggle('foc', !clear&&foc);""",
"""  var el=document.getElementById('bkf-'+wp+'-'+ix); if(!el) return;
  var fx=(!clear&&BK.fx&&BK.fx[ix])?BK.fx[ix]:null;          /* ★ v2-132: 분수 틀 모델이 있으면 그것을 그린다 */
  if(fx) el.innerHTML=bkFxHtml(fx,ix,foc); else el.textContent=clear?'':(v||'');
  el.classList.toggle('foc', !clear&&foc);""")
rep("""function bkPaintFields(){
  if(BK.active==null) return;
  for(var i=0;i<BK.fields.length;i++) bkPaintOne(BK.active,i,bkKindAt(i),BK.fields[i]||'',i===BK.fi,false);
}""",
"""function bkPaintFields(){
  if(BK.active==null) return;
  for(var i=0;i<BK.fields.length;i++) bkPaintOne(BK.active,i,bkKindAt(i),BK.fields[i]||'',i===BK.fi,false);
  bkReadPaint();                                               /* ★ v2-132: 「5분의 2」 우리말 읽기 */
}""")
rep("""window.bkKey=function(k){
  if(BK.active==null) return;
  if(k==='GO'){ bkSubmit(); return; }
  if(k==='NEXT'){ BK.fi=(BK.fi+1)%Math.max(1,BK.fields.length); bkPaintFields(); return; }
  var i=BK.fi;
  if(k==='BS') BK.fields[i]=String(BK.fields[i]||'').slice(0,-1);
  else BK.fields[i]=String(BK.fields[i]||'')+k;
  bkPaintFields();
};""",
r"""/* ═══ ★ v2-132: 분수 틀 입력 (원장 결정 2026-10-09 「B안 + 엔진」 · 시안 docs/mockup_fraction_input.html) ═══
 * [왜] 학생들이 「분수 채점이 어렵다」 — 기록 3,544건을 보니 분수 ✗ 150건 중 값이 정말 틀린 것은 48건뿐.
 *   우리말 「6분의 1」 순서로 6/1 을 치거나(17건), 띄어쓰기 키가 없어 대분수를 못 치거나(652·1/1/2),
 *   엔진이 「{43/12}」(수학비서 꼴)·「28/x」 를 못 읽어 맞는 답이 ✗ 가 됐다(22건).
 * [무엇] 「분수」 키를 누르면 칸 안에 «위(분자)·아래(분모) 두 칸» 틀이 생기고 위부터 채운다.
 *   「대분수」 는 앞에 정수 칸을 붙인다. 「다음 칸」은 틀 안에서 정수→분자→분모→틀 뒤로, 틀 밖이면 다음 입력칸.
 *   칸을 손으로 눌러도 옮겨진다. 칸 밑에 「5분의 2」 처럼 우리말로 읽어 준다.
 * [모델] 한 입력칸 = 글 조각(x)과 분수 조각(f)이 번갈아 늘어선 목록. 늘 글 조각으로 시작·끝난다.
 *   {t:'x',s:'2'} {t:'f',w:'',n:'3',d:'4',mixed:false} {t:'x',s:'x+1'}   커서 cur={i:조각, p:'s'|'w'|'n'|'d'}
 *   채점에는 bkFxText 로 편 글자(「2 3/4」「(2x+1)/3」「-15/x」)를 쓴다 — 엔진이 빗금을 분수로 읽는다(같은 날 보강). */
function bkFxNew(){ return { segs:[{t:'x',s:''}], cur:{i:0,p:'s'} }; }
function bkFxFrom(txt){ var f=bkFxNew(); f.segs[0].s=String(txt||''); return f; }
function bkFxAt(i){ if(!BK.fx) BK.fx=[]; if(!BK.fx[i]) BK.fx[i]=bkFxFrom(BK.fields[i]); return BK.fx[i]; }
function bkFxWrap(x){ x=String(x||''); if(/^\([^()]*\)$/.test(x)) return x; return /[+\-×÷*]/.test(x.slice(1))?'('+x+')':x; }   // 이미 괄호로 묶인 것은 그대로
function bkFxText(fx){
  var out='';
  fx.segs.forEach(function(sg){
    if(sg.t==='x'){ out+=sg.s; return; }
    out+=(sg.mixed&&sg.w?sg.w+' ':'')+bkFxWrap(sg.n)+'/'+bkFxWrap(sg.d);
  });
  return out;
}
function bkFxBox(ix,si,p,val,on,cls){
  return '<span class="bk-fb '+cls+(val?' has':'')+(on?' on':'')+'" onclick="event.stopPropagation();bkFxTap('+ix+','+si+',\''+p+'\')">'+h3Esc(val)+'</span>';
}
function bkFxHtml(fx,ix,foc){
  var h='', c=fx.cur;
  fx.segs.forEach(function(sg,si){
    if(sg.t==='x'){ h+=h3Esc(sg.s); if(foc&&c.i===si&&c.p==='s') h+='<span class="bk-caret"></span>'; return; }
    var on=foc&&c.i===si;
    h+='<span class="bk-fr">';
    if(sg.mixed) h+=bkFxBox(ix,si,'w',sg.w,on&&c.p==='w','w');
    h+='<span class="bk-fs">'+bkFxBox(ix,si,'n',sg.n,on&&c.p==='n','n')+'<span class="bk-bar"></span>'+bkFxBox(ix,si,'d',sg.d,on&&c.p==='d','d')+'</span></span>';
  });
  return h;
}
window.bkFxTap=function(ix,si,p){
  if(BK.active==null) return;
  BK.fi=ix; var fx=bkFxAt(ix); if(!fx.segs[si]) return;
  fx.cur={i:si,p:p}; bkPaintFields(); bkKpadShow(true);
};
/* 「분수」(mixed=false)·「대분수」(mixed=true) 키 */
function bkFxFrac(fx,mixed){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t==='f'){                                   // 이미 틀 안 — 대분수로 바꾸거나 칸만 옮긴다
    if(mixed&&!sg.mixed){ sg.mixed=true; if(sg.n&&!sg.d&&!sg.w){ sg.w=sg.n; sg.n=''; } c.p=sg.w?'n':'w'; }
    else if(c.p==='n'&&sg.n) c.p='d';
    return;
  }
  // 글 조각 끝의 한 덩어리(「2」「2x」「√3」「(2x+1)」)를 분자(대분수면 정수)로 끌어온다
  var m=sg.s.match(/((?:\d+\.?\d*|[A-Za-zπ√])+|\([^()]*\))$/), tok='';
  if(m){ tok=m[1]; sg.s=sg.s.slice(0,-tok.length); }
  var f={t:'f',w:'',n:'',d:'',mixed:!!mixed};
  if(mixed){ if(/^\d+$/.test(tok)) f.w=tok; else sg.s+=tok; }
  else f.n=tok;
  fx.segs.splice(c.i+1,0,f,{t:'x',s:''});
  fx.cur={i:c.i+1,p:(mixed?(f.w?'n':'w'):(f.n?'d':'n'))};
}
/* 「다음 칸」 — 틀 안이면 정수→분자→분모→틀 뒤 글. 틀 밖이면 false (다음 입력칸으로) */
function bkFxNext(fx){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t!=='f') return false;
  if(c.p==='w') c.p='n';
  else if(c.p==='n') c.p='d';
  else fx.cur={i:c.i+1,p:'s'};
  return true;
}
function bkFxBack(fx){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t==='x'){
    if(sg.s){ sg.s=sg.s.slice(0,-1); return; }
    if(c.i>0) fx.cur={i:c.i-1,p:'d'};              // 앞 분수 틀의 분모로
    return;
  }
  if(sg[c.p]) sg[c.p]=sg[c.p].slice(0,-1);
  else if(c.p==='d') c.p='n'; else if(c.p==='n'&&sg.mixed) c.p='w';   // 빈 칸이면 한 칸 앞으로
  if(!sg.w&&!sg.n&&!sg.d){                          // 다 비면 틀을 없애고 앞뒤 글을 잇는다
    var pre=fx.segs[c.i-1], post=fx.segs[c.i+1];
    pre.s+=post.s; fx.segs.splice(c.i,2); fx.cur={i:c.i-1,p:'s'};
  }
}
function bkFxType(fx,k){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t==='x'){ sg.s+=k; return; }
  if(k===','){ fx.cur={i:c.i+1,p:'s'}; fx.segs[c.i+1].s+=k; return; }   // 쉼표는 틀 밖으로
  sg[c.p]=(sg[c.p]||'')+k;
}
/* 우리말 읽기 — 「2와 5분의 1」 「x분의 15」. 분수가 없으면 빈 글 */
function bkReadKo(txt){
  var t=String(txt||'').trim(), m;
  if(t.indexOf('/')<0) return '';
  m=t.match(/(-?)(\d+) ([A-Za-z0-9.π√^]+|\([^()]*\))\/([A-Za-z0-9.π√^]+|\([^()]*\))/);
  if(m) return (m[1]?'마이너스 ':'')+m[2]+'와 '+m[4]+'분의 '+m[3];
  m=t.match(/(-?)([A-Za-z0-9.π√^]+|\([^()]*\))\/([A-Za-z0-9.π√^]+|\([^()]*\))/);
  if(m) return (m[1]?'마이너스 ':'')+m[3]+'분의 '+m[2];
  return '';
}
function bkReadPaint(){
  var el=(BK.active!=null)?document.getElementById('bkrd-'+BK.active):null; if(!el) return;
  var fx=BK.fx&&BK.fx[BK.fi], sg=fx&&fx.segs[fx.cur.i], t='';
  if(sg&&sg.t==='f'){
    if(!sg.n&&!sg.w) t='위 칸(분자)부터 채워요';
    else if(!sg.d) t='아래 칸(분모)을 채워요 — 「다음 칸」으로 내려가요';
    else t=((sg.mixed&&sg.w)?sg.w+'와 ':'')+sg.d+'분의 '+sg.n;
  } else t=bkReadKo(BK.fields[BK.fi]||'');
  el.textContent=t;
}
window.bkKey=function(k){
  if(BK.active==null) return;
  if(k==='GO'){ bkSubmit(); return; }
  var i=BK.fi, fx=bkFxAt(i);
  if(k==='NEXT'){
    if(!bkFxNext(fx)) BK.fi=(BK.fi+1)%Math.max(1,BK.fields.length);   // 틀 안이면 틀 안에서, 아니면 다음 입력칸
    bkPaintFields(); return;
  }
  if(k==='FRAC') bkFxFrac(fx,false);
  else if(k==='MIX') bkFxFrac(fx,true);
  else if(k==='BS') bkFxBack(fx);
  else bkFxType(fx,k);
  BK.fields[i]=bkFxText(fx);
  bkPaintFields();
};""")
# 우리말 읽기 줄 — 보통 칸(bk-fields 뒤)과 눌러 고르는 칸(bk-hint 앞)
rep("""    if(pt.unit) h+='<span class="bk-unit">'+h3Esc(pt.unit)+'</span>';
  });
  h+='</div>';
  h+='<div style="display:flex;align-items:center;gap:6px">';""",
"""    if(pt.unit) h+='<span class="bk-unit">'+h3Esc(pt.unit)+'</span>';
  });
  h+='</div>';
  h+='<div class="bk-read" id="bkrd-'+h3Esc(wp)+'"></div>';     /* ★ v2-132: 우리말 읽기 */
  h+='<div style="display:flex;align-items:center;gap:6px">';""")
rep("""    h+='<div class="bk-hint">'+h3Esc(bkTapHint(sh))+'</div>';""",
"""    h+='<div class="bk-read" id="bkrd-'+h3Esc(wp)+'"></div>';     /* ★ v2-132: 우리말 읽기 */
    h+='<div class="bk-hint">'+h3Esc(bkTapHint(sh))+'</div>';""")
# CSS
rep(""".bk-fld.sm{flex:0 1 84px;max-width:110px}   /* v2-82: 「3 시 20 분」처럼 이름표가 뒤에 붙는 칸 */""",
""".bk-fld.sm{flex:0 1 84px;max-width:110px}   /* v2-82: 「3 시 20 분」처럼 이름표가 뒤에 붙는 칸 */
/* ★ v2-132: 분수 틀 — 「분수」 키를 누르면 위(분자)·아래(분모) 두 칸, 「대분수」 는 앞에 정수 칸 */
.bk-fld{display:flex;align-items:center;gap:2px}
.bk-fr{display:inline-flex;align-items:center;gap:3px;vertical-align:middle}
.bk-fs{display:inline-flex;flex-direction:column;align-items:center;line-height:1.05}
.bk-fb{display:inline-flex;min-width:24px;height:22px;padding:0 4px;align-items:center;justify-content:center;border:1.5px dashed #cbd5e1;border-radius:5px;font-size:14px;cursor:pointer}
.bk-fb.has{border-style:solid}
.bk-fb.on{border:2px solid #14b8a6;background:#e6fffa}
.bk-fs .bk-bar{width:100%;border-top:2px solid #334155;margin:2px 0}
.bk-caret{display:inline-block;width:2px;height:18px;background:#14b8a6;margin-left:1px;animation:bkblink 1s steps(2) infinite}
@keyframes bkblink{to{opacity:0}}
@media (prefers-reduced-motion:reduce){.bk-caret{animation:none}}
.bk-read{font-size:12px;font-weight:800;color:#0f766e;min-height:16px}""")

# 바뀐 점 기록 (맨 위 항목 앞)
log = """ * v2-132 (2026-10-09) ➗ 분수는 «틀»로 칩니다 — 위 칸(분자)·아래 칸(분모) · 「대분수」 키 · 우리말 읽기
 *   · <b>학생 건의</b>: 「분수 채점이 어렵다」. 채점 기록 3,544건을 모두 살펴보니 분수가 든 기록 180건 중
 *     ✗ 가 150건(83%)인데 <b>값이 정말 틀린 것은 48건뿐</b>이었습니다. 나머지는 입력 방법·엔진 탓이었습니다.
 *     ① 우리말 「6분의 1」 순서로 <b>6/1</b> 을 친 것 17건 ② 띄어쓰기 키가 없어 대분수를 <b>652·1/1/2</b> 처럼 친 것
 *     ③ 오답 학습지(수학비서) 정답 <b>{43/12}</b> 꼴과 분모에 문자가 있는 <b>28/x</b> 를 엔진이 못 읽어 맞는 답이 ✗ 가 된 것 22건.
 *   · <b>[입력]</b> 자판의 「／분수」 가 <b>「분수」</b> 로 바뀌었습니다. 누르면 칸 안에 <b>위·아래 두 칸 틀</b>이 생기고
 *     위(분자)부터 채웁니다. 「다음 칸」으로 아래(분모)로 내려가고, 칸을 손으로 눌러도 옮겨집니다.
 *     「2」를 친 뒤 「분수」를 누르면 2가 분자로 올라갑니다. <b>「대분수」</b> 키는 앞에 정수 칸을 붙입니다.
 *     칸 밑에 <b>「5분의 2」</b> 처럼 우리말로 읽어 줘서 거꾸로 쳤는지 바로 보입니다.
 *   · <b>[엔진]</b> 수학비서 꼴 분수 <b>{60/7} · 2{1/5} · {55/8}[cm]</b>, 분모에 문자가 있는 <b>28/x · y=-15/x</b>,
 *     분자에 곱이 든 <b>2x/3 · (a+5)h/2 · 3π/2</b>, 같은 값의 다른 꼴 <b>0.5x = ½x = x/2</b> 를 모두 맞게 읽습니다.
 *     학습지 정답이 「1/4」 처럼 빗금 꼴이면 분수로 읽어 <b>「4/1」 은 이제 ✗</b> 입니다(순서를 안 따지던 오채점 2건 수정).
 *   · <b>[확인]</b> 실제 정답 112,815개 전수: 「정답 원문 그대로 → ◯」 불변식 그대로(103,813개), 못 읽게 된 답 0개,
 *     대괄호 단위 「4[개]」「75[˚]」 1,191개가 새로 자동채점. 분수 답 4,834개에 거꾸로·+1 을 넣은 오채점 0건.
 *   · 옛 ✗ 기록 가운데 새 엔진이 ◯ 로 읽는 것은 원장님 지시로 다시 채점해 ◯ 로 바꿨습니다(sync/regrade_hw_scores.js).
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s)
assert first, 'changelog top not found'
s = s[:first.start()+1] + log + s[first.start()+1:]

open(DST, 'w', encoding='utf-8').write(s)
print('ok →', DST, len(s))
