# 학생앱 v2-150 조립 — «v2-149 복사 + rep 고침»
#   원장 2026-10-31 「매쓰플랫 화면이 깔끔하다 · 새 자판으로 앱이 읽는 답을 늘리자 · 사진은 유지 · 그 순서로 진행 · 학생앱 배포」
#   ① 채점 엔진 인라인 블록을 sync/hw_grade_engine.js 최신본으로 (순환소수·분수 안 지수·합동 조건·㈎ 빈칸·「7°」「12·」)
#   ② 자판을 매쓰플랫 10/29 수식 키패드 모양으로 — 탭 기본·문자·도형·보기, 흰 키, 빈칸 틀(분수·대분수·지수·√·선분·반직선·직선·호),
#      순환점, 각도. 자판 위에 «답 막대»(지금 칸을 크게 + 제출). 시안 docs/mockup_student_keypad.html
#   ③ 사진 자기채점은 그대로 (원장 「사진은 유지」)
#   실행: python3 sync/appbuild/build_student_v2150.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-149.html'); DST = os.path.join(ROOT, 'student_v2-150.html')
ENG = os.path.join(ROOT, 'sync', 'hw_grade_engine.js')
s = open(SRC, encoding='utf-8').read()

def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

# ── 0. 버전 ──
rep("var STU_VER = 'v2-149';", "var STU_VER = 'v2-150';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-150 (2026-10-31) ⌨️ 매쓰플랫식 수식 자판 + 앱이 읽는 답 늘리기 (원장 「매쓰플랫 화면이 깔끔하다 · 그 순서로 진행」)\n"
    " *   · <b>[자판]</b> 탭이 <b>기본 · 문자 · 도형 · 보기</b> 로 바뀌었습니다. 흰 키, 수식 글꼴, 자판 위 «답 막대»(지금 칸을 크게 보여 주고 «제출 ↑»).\n"
    " *     분수·대분수뿐 아니라 <b>지수 □ⁿ · 제곱근 √□ · 선분·반직선·직선·호</b>도 빈칸 틀로 칩니다. <b>순환점</b>(숫자 위 점)과 <b>각도 °</b> 키가 생겼습니다.\n"
    " *     문자 탭은 폰 자판과 같은 qwerty 차례입니다. 예전 자판의 키(도형 A~Z·ㄱ~ㅎ, ≡ ∽ ⊥ ∥, ①~⑤ ㉠ ㈎ …)는 모두 그대로 있습니다.\n"
    " *   · <b>[채점 엔진]</b> 앱이 못 읽어 사진으로 채점하던 답을 읽습니다 — 10월 기록 113건 중 100건이 이제 자동채점.\n"
    " *     ▸ 순환소수 0.4̇8̇ · 0.1̇85̇ (늘어놓은 꼴 0.2272727… 도 같은 값) ▸ 분수 안 지수 1/a² · 3a/b²\n"
    " *     ▸ 합동·닮음 조건 «△ABC≡△FED (RHA 합동)» — 조건은 낱말로 (RAH 는 틀림) ▸ 증명 빈칸 «㈎ ∠ADE ㈏ ∠A ㈐ AA»\n"
    " *   · <b>[오채점 고침]</b> 각도 답에 «°» 를 붙인 «7°», «°» 옆 «·» 를 잘못 누른 «12·» 가 ✗ 였습니다(10월 13건) → 이제 맞음.\n"
    " *   · 정답 3만 가지로 시험: 정답 원문 그대로 넣으면 모두 맞음(실패 0) · 예전에 읽던 답이 못 읽게 된 것 0.\n"
    " *   · 서술형 문항의 «사진 찍고 스스로 채점»은 그대로입니다(원장 결정).\n"
    " *\n")

# ── 1. 채점 엔진 최신본 ──
mark = '/* ★ v2-82: 아래 블록은 sync/hw_grade_engine.js 를 그대로 복사한 것이다'
i0 = s.index(mark); i1 = s.index('/* ═', i0)
end_tok = "})(typeof globalThis !== 'undefined' ? globalThis : this);"
i2 = s.index(end_tok, i1) + len(end_tok)
eng = open(ENG, encoding='utf-8').read().rstrip('\n')
assert eng.startswith('/* ═') and eng.endswith(end_tok)
s = s[:i1] + eng + s[i2:]

# ── 2. 자판 틀(HTML) — 답 막대 + 탭 + 키 + 아래 기능 줄 ──
rep('''  <div class="rec-body" id="bkq-body" style="padding:12px 12px 340px"></div>''',
    '''  <div class="rec-body" id="bkq-body" style="padding:12px 12px 470px"></div>''')
rep('''  <div class="kpad" id="bk-kpad">
    <div class="kptabs" id="bk-kptabs"></div>
    <div class="kwrap" id="bk-kwrap"></div>
  </div>''',
'''  <div class="kpad v150" id="bk-kpad">
    <!-- v2-150: 매쓰플랫식 — 답 막대(지금 칸 크게 + 제출) · 탭 · 키 · 기능 줄 -->
    <div class="kbar"><div class="kin empty" id="bk-kin"></div><button class="kgo" onclick="bkKey('GO')">제출 ↑</button></div>
    <div class="kptabs" id="bk-kptabs"></div>
    <div class="kwrap" id="bk-kwrap"></div>
    <div class="kfn" id="bk-kfn"></div>
  </div>''')

# ── 3. 자판 모양(CSS) ──
rep('''.kptabs button.on{background:#0d2240;color:#fff}''',
'''.kptabs button.on{background:#0d2240;color:#fff}
/* ★ v2-150: 매쓰플랫식 수식 자판 (시안 docs/mockup_student_keypad.html) */
#bk-kpad.v150{background:#f2f3f5;border-top:0;border-radius:18px 18px 0 0;padding:0 8px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -6px 26px rgba(15,23,42,0.16)}
#bk-kpad.v150 .kbar{max-width:560px;margin:-16px auto 8px;background:#fff;border-radius:16px;box-shadow:0 3px 14px rgba(15,23,42,0.14);display:flex;align-items:center;gap:8px;padding:6px 6px 6px 14px;min-height:54px}
#bk-kpad.v150 .kin{flex:1;min-width:0;overflow-x:auto;white-space:nowrap;display:flex;align-items:center;gap:2px;font-family:ui-monospace,Menlo,monospace;font-size:18px;font-weight:800;color:#111827;min-height:36px}
#bk-kpad.v150 .kin.empty::before{content:"답안을 입력해 주세요";color:#9aa0a8;font-size:14px;font-weight:600;font-family:inherit}
#bk-kpad.v150 .kin .kno{font-size:11px;font-weight:900;color:#0f766e;background:#e5f5f2;border-radius:50px;padding:2px 8px;margin-right:6px;font-family:inherit}
#bk-kpad.v150 .kgo{flex-shrink:0;border:0;background:#0f766e;color:#fff;border-radius:999px;height:42px;padding:0 16px;font-family:inherit;font-weight:900;font-size:14.5px;cursor:pointer}
#bk-kpad.v150 .kptabs{gap:6px;margin:0 auto 8px;overflow-x:auto}
#bk-kpad.v150 .kptabs button{flex:0 0 auto;background:#fff;border:1px solid #e5e7eb;color:#374151;border-radius:12px;padding:7px 15px;font-size:13.5px;font-weight:800}
#bk-kpad.v150 .kptabs button.on{background:#55575c;color:#fff;border-color:#55575c}
#bk-kpad.v150 .kwrap{grid-template-columns:repeat(10,minmax(0,1fr)) !important;gap:5px}
#bk-kpad.v150 .kwrap button,#bk-kpad.v150 .kfn button{height:42px;padding:0;border:0;border-radius:9px;box-shadow:0 1px 2px rgba(0,0,0,0.14);cursor:pointer;overflow:hidden;display:flex;align-items:center;justify-content:center}
#bk-kpad.v150 .kwrap button{background:#fff;color:#1f2937;font-family:"Times New Roman","STIX Two Math","Cambria Math",serif;font-size:19px;font-weight:400}
#bk-kpad.v150 .kwrap button.mi{font-style:italic}
#bk-kpad.v150 .kwrap button.ko{font-family:inherit;font-size:14px;font-weight:700}
#bk-kpad.v150 .kwrap button.ks{font-family:inherit;font-size:11.5px;font-weight:800;color:#0f766e;flex-direction:column;line-height:1.05}
#bk-kpad.v150 .kwrap button:active,#bk-kpad.v150 .kfn button:active{background:#e5e7eb}
#bk-kpad.v150 .kfn{max-width:560px;margin:5px auto 0;display:grid;gap:5px}
#bk-kpad.v150 .kfn button{height:44px;background:#e4e5e8;color:#374151;font-family:inherit;font-size:14px;font-weight:800}
#bk-kpad.v150 .kfn button.ser{font-family:"Times New Roman",serif;font-size:20px;font-weight:400}
.kbx{display:inline-block;width:.62em;height:.72em;border:1.3px dashed #8b919a;border-radius:2px;vertical-align:middle;box-sizing:border-box}
.kfr{display:inline-flex;flex-direction:column;align-items:center;line-height:1;vertical-align:middle}
.kfr .kbx{width:.5em;height:.46em}
.kfr .kl{display:block;width:.68em;border-top:1.3px solid #333;margin:1.5px 0}
.ksup{font-size:.62em;vertical-align:.7em}
.ksup .kbx{width:.6em;height:.66em}
.krt{display:inline-flex;align-items:flex-end}
.krt .kbx{border-top:1.4px solid #333}
.kov{position:relative;display:inline-block;padding-top:.32em}
.kov .kd{position:absolute;left:-.1em;right:-.1em;top:-.12em;text-align:center;font-size:.62em;line-height:1;font-style:normal}
.kov .kd.ln{top:.12em;height:0;border-top:1.4px solid #333;font-size:0}
/* 입력칸·답 막대 안의 새 틀 (지수·제곱근·선분 무리) */
.bk-sup{display:inline-flex;align-self:flex-start;margin-top:-4px}
.bk-sup .bk-fb{min-width:17px;height:17px;font-size:12px;padding:0 3px}
.bk-rt{display:inline-flex;align-items:center}
.bk-rt .bk-rtv{display:inline-flex;border-top:2px solid #334155;padding-top:2px;margin-left:1px}
.bk-ov{position:relative;display:inline-flex;padding-top:9px}
.bk-ov .kd{position:absolute;left:0;right:0;top:-2px;text-align:center;font-size:12px;line-height:1;color:#334155;font-family:-apple-system,sans-serif}
.bk-ov .kd.ln{top:4px;border-top:2px solid #334155;font-size:0}''')

# ── 4. 자판 그리기 — 탭 기본·문자·도형·보기 (안쪽 이름 num·alg·geo·mark 는 그대로) ──
OLD_RENDER = s[s.index('function bkKpadRender(){'):s.index("window.bkTab=function(t){ BK.tab=t; bkKpadRender(); };")]
assert OLD_RENDER.count('function bkKpadRender') == 1
NEW_RENDER = r'''/* ★ v2-150 (2026-10-31): 매쓰플랫식 수식 자판. 키 = 글자 하나(그대로 넣음) 또는 [보이는 것(html), 넣을 것/기능, 꾸밈]
 *   꾸밈: mi 기울인 수식 글자 · ko 한글 · ks 작은 글씨 기능. 기능: FRAC 분수 · MIX 대분수 · POW 지수 · ROOT 제곱근 · DOT 순환점 · SEG:<선분|반직선|직선|호>
 *   예전 자판(v2-81~v2-149)에 있던 키는 하나도 빼지 않았다(학생 제보로 넣은 ≡ ∽ ㈎ ㉥ A~Z ㄱ~ㅎ 등). 단, 「·」(가운뎃점)는 «°» 와 헷갈려(10월 «12·» 오채점)
 *   기본 탭에서 뺐다 — 곱하기는 «×» 키. */
var BKF_BOX='<i class="kbx"></i>';
var BKF={
  FRAC:'<span class="kfr"><i class="kbx"></i><i class="kl"></i><i class="kbx"></i></span>',
  MIX:'<i class="kbx"></i><span class="kfr"><i class="kbx"></i><i class="kl"></i><i class="kbx"></i></span>',
  POW:'<i class="kbx"></i><span class="ksup"><i class="kbx"></i></span>',
  ROOT:'<span class="krt">√<i class="kbx"></i></span>',
  DEG:'<i class="kbx"></i><span class="ksup">°</span>',
  DOT:'<span style="font-size:17px">3&#775;</span><span style="font-size:9.5px">순환점</span>',
  SEG:function(k){ var d=(k==='선분')?'<i class="kd ln"></i>':'<i class="kd">'+(k==='반직선'?'→':(k==='직선'?'↔':'⌒'))+'</i>'; return '<span class="kov">'+d+'<i class="kbx"></i></span>'; }
};
function bkKpTpl(n){ return [BKF[n], n, (n==='DOT'?'ks':'')]; }
function bkKpSeg(k){ return [BKF.SEG(k), 'SEG:'+k, '']; }
function bkKpMi(list){ return list.split(' ').map(function(c){ return [c,c,'mi']; }); }
function bkKpKo(list){ return list.split(' ').map(function(c){ return [c,c,'ko']; }); }
var BK_KP150={
  num:function(){ return '1 2 3 4 5 6 7 8 9 0'.split(' ')
      .concat(['+',['−','-'],'×','÷','=','≠','<','>','≤','≥'])
      .concat(['(',')',bkKpTpl('FRAC'),bkKpTpl('MIX'),bkKpTpl('POW'),bkKpTpl('ROOT'),'π',[BKF.DEG,'°',''],bkKpTpl('DOT'),'±']); },
  alg:function(){ return '1 2 3 4 5 6 7 8 9 0'.split(' ')
      .concat(['+',['−','-'],'×','÷','=','<','>','≤','≥','≠'])
      .concat(['(',')',bkKpTpl('FRAC'),bkKpTpl('POW'),bkKpTpl('ROOT'),'π','±','|',"'",'_'])
      .concat(bkKpMi('q w e r t y u i o p'), bkKpMi('a s d f g h j k l'), [':'])
      .concat(bkKpMi('z x c v b n m'), [bkKpTpl('MIX'),[BKF.DEG,'°',''],bkKpTpl('DOT')]); },
  geo:function(){
    var head=[bkKpSeg('선분'),bkKpSeg('반직선'),bkKpSeg('직선'),bkKpSeg('호'),'∠','△','□','○','⊥','∥'];
    var en=bkKpMi('A B C D E F G H I J').concat(bkKpMi('K L M N O P Q R S T'), bkKpMi('U V W X Y Z'), ['≡','∽','≠',"'"]);
    var ko=bkKpKo('ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ').concat(bkKpKo('ㅋ ㅌ ㅍ ㅎ 점 변 면 각'), [[BKF.DEG,'°',''],'=']);
    return head.concat(bkIsElem()?ko.concat(en):en.concat(ko)); },
  mark:function(){
    var nm=bkKpKo('① ② ③ ④ ⑤ (1) (2) (3) (4) (5)'), cr=bkKpKo('㉠ ㉡ ㉢ ㉣ ㉤ ㉮ ㉯ ㉰ ㉱ ㉲'), pr=bkKpKo('㈎ ㈏ ㈐ ㈑ ㉥');
    var ja=bkKpKo('ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ');
    return bkIsElem()?ja.concat(cr, nm, pr):nm.concat(cr, pr, ja); }
};
/* 아래 기능 줄 — [보이는 것, 기능, 넓이] */
var BK_FN150={
  num:[['다음 칸','NEXT',2],[',',',',1,'ser'],['.','.',1,'ser'],[':',':',1,'ser'],['|','|',1,'ser'],['⌫','BS',1.4]],
  alg:[['다음 칸','NEXT',2],[',',',',1,'ser'],['.','.',1,'ser'],['⌫','BS',1.4]],
  geo:[['다음 칸','NEXT',2],[',',',',1,'ser'],['⌫','BS',1.4]],
  mark:[['다음 칸','NEXT',2],[',',',',1,'ser'],['⌫','BS',1.4]]
};
function bkKpadRender(){
  var tabs=document.getElementById('bk-kptabs'), wrap=document.getElementById('bk-kwrap'), fn=document.getElementById('bk-kfn');
  if(!tabs||!wrap) return;
  var defs=[['num','기본'],['alg','문자'],['geo','도형'],['mark','보기']];
  if(!BK_KP150[BK.tab]) BK.tab='num';
  var th='';
  defs.forEach(function(d){ th+='<button class="'+(BK.tab===d[0]?'on':'')+'" onclick="bkTab('+bkQ(d[0])+')">'+d[1]+'</button>'; });
  tabs.innerHTML=th;
  var h='';
  BK_KP150[BK.tab]().forEach(function(k){
    if(typeof k==='string') k=[k,k,''];
    var face=k[0], act=k[1], cls=k[2]||'';
    h+='<button'+(cls?(' class="'+cls+'"'):'')+' onclick="bkKey('+bkQ(act)+')">'+(/^</.test(face)?face:h3Esc(face))+'</button>';
  });
  wrap.innerHTML=h;
  if(fn){
    var L=BK_FN150[BK.tab]||BK_FN150.num, cols=[], f='';
    L.forEach(function(k){ cols.push(k[2]+'fr'); f+='<button'+(k[3]?' class="'+k[3]+'"':'')+' onclick="bkKey('+bkQ(k[1])+')">'+h3Esc(k[0])+'</button>'; });
    fn.style.gridTemplateColumns=cols.join(' '); fn.innerHTML=f;
  }
}
'''
s = s.replace(OLD_RENDER, NEW_RENDER)

# ── 5. 입력 모델 — 분수(f)에 지수(p)·제곱근(r)·선분 무리(o) 틀을 더한다 ──
rep('''function bkFxText(fx){
  var out='';
  fx.segs.forEach(function(sg){
    if(sg.t==='x'){ out+=sg.s; return; }
    out+=(sg.mixed&&sg.w?sg.w+' ':'')+bkFxWrap(sg.n)+'/'+bkFxWrap(sg.d);
  });
  return out;
}''','''/* ★ v2-150: 틀 종류 — f 분수 {w,n,d,mixed} · p 지수 {e} · r 제곱근 {v} · o 선분·반직선·직선·호 {k,v}
 *   채점에 쓰는 글자: 「a^2」「a^(n+1)」「√12」「√(2x)」「선분AB」 — 엔진이 원래 읽는 꼴이다. */
function bkFxTok(v){ v=String(v||''); return /^(?:\\d+(?:\\.\\d+)?|[A-Za-zπ])$/.test(v)?v:'('+v+')'; }
function bkFxText(fx){
  var out='';
  fx.segs.forEach(function(sg){
    if(sg.t==='x'){ out+=sg.s; return; }
    if(sg.t==='p'){ if(sg.e) out+='^'+bkFxTok(sg.e); return; }
    if(sg.t==='r'){ if(sg.v) out+='√'+bkFxTok(sg.v); return; }
    if(sg.t==='o'){ if(sg.v) out+=sg.k+sg.v; return; }
    out+=(sg.mixed&&sg.w?sg.w+' ':'')+bkFxWrap(sg.n)+'/'+bkFxWrap(sg.d);
  });
  return out;
}
function bkFxLastBox(sg){ return sg.t==='f'?'d':(sg.t==='p'?'e':'v'); }
function bkFxEmptyTpl(sg){ return sg.t==='f'?(!sg.w&&!sg.n&&!sg.d):(sg.t==='p'?!sg.e:!sg.v); }''')
rep('''    if(sg.t==='x'){ h+=h3Esc(sg.s); if(foc&&c.i===si&&c.p==='s') h+='<span class="bk-caret"></span>'; return; }
    var on=foc&&c.i===si;''','''    if(sg.t==='x'){ h+=h3Esc(sg.s); if(foc&&c.i===si&&c.p==='s') h+='<span class="bk-caret"></span>'; return; }
    var on=foc&&c.i===si;
    /* ★ v2-150: 지수 · 제곱근 · 선분 무리 */
    if(sg.t==='p'){ h+='<span class="bk-sup">'+bkFxBox(ix,si,'e',sg.e,on,'e')+'</span>'; return; }
    if(sg.t==='r'){ h+='<span class="bk-rt">√<span class="bk-rtv">'+bkFxBox(ix,si,'v',sg.v,on,'v')+'</span></span>'; return; }
    if(sg.t==='o'){ var dk=(sg.k==='선분')?'<i class="kd ln"></i>':'<i class="kd">'+(sg.k==='반직선'?'→':(sg.k==='직선'?'↔':'⌒'))+'</i>';
      h+='<span class="bk-ov">'+dk+bkFxBox(ix,si,'v',sg.v,on,'v')+'</span>'; return; }''')
rep('''function bkFxFrac(fx,mixed){
  var c=fx.cur, sg=fx.segs[c.i];''','''function bkFxFrac(fx,mixed){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t!=='x'&&sg.t!=='f'){ fx.cur={i:c.i+1,p:'s'}; c=fx.cur; sg=fx.segs[c.i]; }   /* ★ v2-150: 지수·√ 틀 안이면 틀 뒤에서 */''')
rep('''  if(sg.t!=='f') return false;
  if(c.p==='w') c.p='n';''','''  if(sg.t==='x') return false;
  if(sg.t!=='f'){ fx.cur={i:c.i+1,p:'s'}; return true; }            /* ★ v2-150: 지수·√·선분 틀은 한 칸 — 틀 뒤로 */
  if(c.p==='w') c.p='n';''')
rep('''    if(c.i>0) fx.cur={i:c.i-1,p:'d'};              // 앞 분수 틀의 분모로
    return;
  }
  if(sg[c.p]) sg[c.p]=sg[c.p].slice(0,-1);
  else if(c.p==='d') c.p='n'; else if(c.p==='n'&&sg.mixed) c.p='w';   // 빈 칸이면 한 칸 앞으로
  if(!sg.w&&!sg.n&&!sg.d){                          // 다 비면 틀을 없애고 앞뒤 글을 잇는다''','''    if(c.i>0) fx.cur={i:c.i-1,p:bkFxLastBox(fx.segs[c.i-1])};   // 앞 틀의 마지막 칸으로 (v2-150: 지수·√·선분도)
    return;
  }
  if(sg[c.p]) sg[c.p]=sg[c.p].slice(0,-1);
  else if(c.p==='d') c.p='n'; else if(c.p==='n'&&sg.mixed) c.p='w';   // 빈 칸이면 한 칸 앞으로
  if(bkFxEmptyTpl(sg)){                             // 다 비면 틀을 없애고 앞뒤 글을 잇는다''')
rep('''window.bkKey=function(k){
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
  else bkFxType(fx,k);''','''/* ★ v2-150: 지수·√·선분 틀 넣기 — 글 조각이면 틀을 끼우고, 이미 틀 칸 안이면 글자만 (√3/2 처럼 분자에 √) */
function bkFxTpl(fx,seg,plain){
  var c=fx.cur, sg=fx.segs[c.i];
  if(sg.t!=='x'){ bkFxType(fx,plain); return; }
  fx.segs.splice(c.i+1,0,seg,{t:'x',s:''});
  fx.cur={i:c.i+1,p:bkFxLastBox(seg)};
}
/* ★ v2-150: 순환점 — 지금 칸 끝 숫자 위에 점(U+0307). 한 번 더 누르면 지운다 */
function bkFxDot(fx){
  var c=fx.cur, sg=fx.segs[c.i], key=(sg.t==='x')?'s':c.p, v=String(sg[key]||'');
  if(/\\u0307$/.test(v)) sg[key]=v.slice(0,-1);
  else if(/\\d$/.test(v)) sg[key]=v+'\\u0307';
  else if(typeof toast==='function') toast('순환마디 숫자를 먼저 치고 «순환점»을 눌러요 (처음·끝 숫자에)');
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
  else if(k==='POW') bkFxTpl(fx,{t:'p',e:''},'^');
  else if(k==='ROOT') bkFxTpl(fx,{t:'r',v:''},'√');
  else if(k.indexOf('SEG:')===0) bkFxTpl(fx,{t:'o',k:k.slice(4),v:''},k.slice(4));
  else if(k==='DOT') bkFxDot(fx);
  else if(k==='BS') bkFxBack(fx);
  else bkFxType(fx,k);''')

# ── 6. 답 막대 — 지금 칸을 크게 보여 준다 ──
rep('''  for(var i=0;i<BK.fields.length;i++) bkPaintOne(BK.active,i,bkKindAt(i),BK.fields[i]||'',i===BK.fi,false);
  bkReadPaint();                                               /* ★ v2-132: 「5분의 2」 우리말 읽기 */''','''  for(var i=0;i<BK.fields.length;i++) bkPaintOne(BK.active,i,bkKindAt(i),BK.fields[i]||'',i===BK.fi,false);
  bkReadPaint();                                               /* ★ v2-132: 「5분의 2」 우리말 읽기 */
  bkBarPaint();                                                /* ★ v2-150: 자판 위 답 막대 */''')
rep('''function bkBlur(){''','''/* ★ v2-150: 자판 위 «답 막대» — 지금 칸을 크게(누르면 그 틀 칸으로) · 칸이 여럿이면 「2번 칸」 */
function bkBarPaint(){
  var el=document.getElementById('bk-kin'); if(!el) return;
  if(BK.active==null){ el.innerHTML=''; el.classList.add('empty'); return; }
  var fx=BK.fx&&BK.fx[BK.fi], v=String(BK.fields[BK.fi]||''), kind=bkKindAt(BK.fi);
  var no=(BK.fields.length>1)?'<b class="kno">'+(BK.fi+1)+'번 칸</b>':'';
  if(kind==='pick'||kind==='choice'||kind==='op'||kind==='ox'){ el.innerHTML=no+h3Esc(v); el.classList.toggle('empty',!v&&!no); return; }
  var body=fx?bkFxHtml(fx,BK.fi,true):h3Esc(v);
  var blank=!v&&(!fx||fx.segs.length<2);
  el.innerHTML=blank?no:(no+body); el.classList.toggle('empty',blank);
  try{ el.scrollLeft=el.scrollWidth; }catch(e){}
}
function bkBlur(){''')

# ── 7. 칸을 누르면 그 칸 모양에 맞는 탭 · 칸이 자판에 가리면 위로 ──
rep('''  BK.tab=bkTabFor(BK.sh.shape);            // 앱이 답 모양을 보고 자판을 먼저 고른다
  bkPaintFields(); bkKpadRender(); bkKpadShow(true);''','''  BK.tab=bkTabFor(BK.sh.shape);            // 앱이 답 모양을 보고 자판을 먼저 고른다
  /* ★ v2-150: 증명 빈칸(㈎ ∠ADE · ㈏ AA)처럼 칸마다 모양이 다르면 누른 칸의 모양으로 */
  if(BK.sh.shape==='labeled'||BK.sh.shape==='free'){ var pk=bkKindAt(BK.fi); BK.tab=(pk==='word'&&BK.sh.shape==='labeled')?'geo':bkTabFor(pk); }
  bkPaintFields(); bkKpadRender(); bkKpadShow(true);
  try{                                       /* ★ v2-150: 자판이 커졌다 — 칸이 가리면 보이게 올린다 */
    var fe=document.getElementById('bkf-'+wpId+'-'+BK.fi), kp=document.getElementById('bk-kpad');
    if(fe&&kp&&fe.getBoundingClientRect().bottom>kp.getBoundingClientRect().top-12) fe.scrollIntoView({block:'center'});
  }catch(e){}''')

# ── 8. 정답 보여 주기 — 수식 원문 대신 읽기 쉬운 글자 (대분수 «23/5» 로 보이던 것 · \frac{\sqrt{3}}{2} · \dot{} · 지수) ──
rep('''  return bkDegNorm(String(a==null?'':a).replace(/\\$/g,''))
    .replace(/\\\\d?frac\\{(-?[0-9]+)\\}\\{(-?[0-9]+)\\}/g,'$1/$2')''','''  /* ★ v2-150: 대분수는 띄어서(2 3/5 — 예전엔 «23/5» 로 보였다) · 순환점 · √ · 지수 위첨자 · 도형 기호 */
  var SUP={'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','-':'⁻'};
  var t=String(a==null?'':a).replace(/\\$/g,'')
    .replace(/\\\\dot\\s*\\{\\s*(\\d)\\s*\\}/g,'$1\\u0307')
    .replace(/\\{\\s*([A-Za-z0-9]+)\\s*\\}(?=\\s*\\^)/g,'$1')
    .replace(/\\^\\s*\\{?\\s*(-?\\d+)\\s*\\}?/g,function(m0,d){ return d.split('').map(function(c){ return SUP[c]||c; }).join(''); })
    .replace(/\\\\sqrt\\s*\\{([^{}]*)\\}/g,function(m0,x){ return '√'+(/^[0-9A-Za-z.]+$/.test(x)?x:'('+x+')'); })
    .replace(/(\\d)\\s*\\\\[dt]?frac\\{(-?[0-9]+)\\}\\{(-?[0-9]+)\\}/g,'$1 $2/$3')
    .replace(/\\\\[dt]?frac\\{([^{}]*)\\}\\{([^{}]*)\\}/g,function(m0,n,d){ var w=function(x){ return /^[0-9A-Za-z.√²³⁴π-]+$/.test(x)?x:'('+x+')'; }; return w(n)+'/'+w(d); })
    .replace(/\\\\angle/g,'∠').replace(/\\\\triangle/g,'△').replace(/\\\\equiv/g,'≡').replace(/\\\\sim/g,'∽')
    .replace(/\\\\leq?/g,'≤').replace(/\\\\geq?/g,'≥').replace(/\\\\neq?/g,'≠').replace(/\\\\pi/g,'π');
  return bkDegNorm(t)
    .replace(/\\\\d?frac\\{(-?[0-9]+)\\}\\{(-?[0-9]+)\\}/g,'$1/$2')''')

# ── 9. 틀 칸 안의 「a^2」 도 a² 로 보이게 (보이기만 — 채점 글자는 그대로) ──
rep('''  return '<span class="bk-fb '+cls+(val?' has':'')+(on?' on':'')+'" onclick="event.stopPropagation();bkFxTap('+ix+','+si+',\\''+p+'\\')">'+h3Esc(val)+'</span>';''',
    '''  var shown=h3Esc(val).replace(/\\^(\\d+)/g,function(m0,d){ return d.split('').map(function(c){ return '⁰¹²³⁴⁵⁶⁷⁸⁹'.charAt(+c); }).join(''); });   /* ★ v2-150 */
  return '<span class="bk-fb '+cls+(val?' has':'')+(on?' on':'')+'" onclick="event.stopPropagation();bkFxTap('+ix+','+si+',\\''+p+'\\')">'+shown+'</span>';''')

open(DST, 'w', encoding='utf-8').write(s)
print('OK', DST)
