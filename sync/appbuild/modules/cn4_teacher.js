/* ═══════════════════════════════════════════════════════════════════
 * v19-102: 📰 카드뉴스를 블로그 브랜드와 통일 + 「⬇ 블로그 폴더로 내려받기」 (원장 결정 2026-10-11)
 *   원장 지시: 「v19-102 먼저 만들어 배포, 12색은 사용해보고 결정」 → 12색은 그대로 두고 브랜드 색 둘을 «앞에 더해» 기본으로.
 *  ① 브랜드 한 곳: 색·로고는 조립할 때 sync/card_templates/_base.css 에서 읽어 window.CN_BRAND 로 심는다(build_app.py).
 *     _base.css 를 고치고 다시 조립하면 앱 카드도 같이 바뀐다.
 *     · 색 「브랜드 · 붉은 바탕」(기본 — 새 시험) · 「브랜드 · 아이보리」(밝은 바탕엔 노랑을 쓰지 않는다 — _base.css 주석) → 그다음 12색
 *       시험 설정 exam_hit_<시험>.card.pal = 'br' | 'bi' | 0~11 (이미 고른 시험은 그대로)
 *     · 모든 새 스타일 카드의 꼬리말 = 블로그 카드 꼬리말: 로고 점 + 「루멘수학」 + 오른쪽 쪽수 n / N
 *     · 제목 글꼴 칩 「브랜드 글꼴(Pretendard)」 = 기본 (굵은/부드러운 글꼴은 그대로 고를 수 있음) — 굵기 800 · 외곽선·그림자 유지
 *     · 새 스타일 카드에서 「기출」 → 「시험」·「지난 시험」 (학교 시험지는 외부 공개 금지) · 반복 출제 카드는 유형 이름만(연도 없음)
 *  ② 「⬇ 블로그 폴더로 내려받기」: zip 안이 곧 blog/<날짜-학교학년-exam>/ 폴더
 *     cards/NN_종류.png · cards.json(type external) · source.md(사실 자료) · post_draft.md(AI 초안, 키 있을 때) · README.txt
 *     블로그 세션: 저장소 blog/ 에 폴더를 넣고 post_draft.md → post.md 로 다듬은 뒤 post_check → naver_draft
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 이름 · 교재 이름 · 쪽 번호 · 외부 서비스 이름은 넣지 않는다.
 * ═══════════════════════════════════════════════════════════════════ */
var CN4_FONT_URL='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css';
var CN4_JSZIP='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
var CN4_H2C='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
/* 조립 때 심은 값이 없으면(검사용) _base.css 색 그대로 */
var CN4_B=(typeof window!=='undefined' && window.CN_BRAND) || { tokens:{ red:'#c03f3f', redDeep:'#8d2c2c', yellow:'#fdc108', navy:'#073756', bg:'#f8f4ef', white:'#ffffff', text:'#1c1414', muted:'#6b5a5a', line:'#e8ded6' }, logo:'', font:'Pretendard' };
var CN4_T=CN4_B.tokens;
/* 브랜드 색 둘 — cn2Pal 과 같은 모양(bg1 · bg2 · gold · red · ink · panel) */
var CN4_PAL={
  br:{ n:'브랜드 · 붉은 바탕', bg1:CN4_T.red, bg2:CN4_T.redDeep, gold:CN4_T.yellow, red:CN4_T.white, ink:CN4_T.text, panel:CN4_T.white, brand:'br' },
  bi:{ n:'브랜드 · 아이보리', bg1:CN4_T.bg, bg2:CN4_T.line, gold:CN4_T.red, red:CN4_T.navy, ink:CN4_T.text, panel:CN4_T.white, brand:'bi' }
};
var CN4_KEYS=['br','bi'];
function cn4IsBrand(p){ return Object.prototype.hasOwnProperty.call(CN4_PAL, String(p)); }

/* ── 글꼴: 브랜드 글꼴(Pretendard)이 기본 — v19-102 를 처음 열 때 한 번 바꿔 둔다(그 뒤 고른 것은 기억) ── */
(function(){
  var done='', v='';
  try{ done=localStorage.getItem('cn_brand102')||''; v=localStorage.getItem('cn_font')||''; }catch(e){}
  if(!done){ CN.font='pre'; try{ localStorage.setItem('cn_font','pre'); localStorage.setItem('cn_brand102','1'); }catch(e){} }
  else CN.font=(v==='dohyeon'||v==='black')?v:'pre';
})();
function cn4FontName(){ return CN.font==='dohyeon'?'부드러운 글꼴(Do Hyeon)':(CN.font==='black'?'굵은 글꼴(Black Han Sans)':'브랜드 글꼴(Pretendard)'); }
window.cn2Set=(function(o){ return function(k, v){
  if(k==='font' && v==='pre'){ CN.font='pre'; try{ localStorage.setItem('cn_font','pre'); }catch(e){} CN.bgPick=''; render(); return; }
  return o(k, v); }; })(window.cn2Set);

/* ── 색: 새 시험은 「브랜드 · 붉은 바탕」 (이미 색이 저장된 시험은 그대로) ── */
cnCfg=(function(o){ return function(d){ var fresh=!!d && (!d.card || d.card.pal==null); var c=o(d); if(fresh) c.pal='br'; return c; }; })(cnCfg);
cn2Pal=function(i){ return CN4_PAL[i] || CN_PAL2[i] || CN_PAL2[1]; };
cn2PalVars=(function(o){ return function(i){
  var v=o(i)+';--tx:'+CN4_T.text+';--mu:'+CN4_T.muted+';--ln:'+CN4_T.line+';--bred:'+CN4_T.red+';--bnavy:'+CN4_T.navy+';--bylw:'+CN4_T.yellow;
  if(i==='bi') v+=';--wm2:rgba(192,63,63,.07)';
  return v; }; })(cn2PalVars);
cn2WrapCls=(function(o){ return function(c){ return o(c)+(CN.font==='pre'?' f-pre':'')+(cn4IsBrand(c&&c.pal)?(' pv-brand pv-'+c.pal):''); }; })(cn2WrapCls);
/* 색 칩: 브랜드 둘이 맨 앞, 그다음 12색 */
cn2PalHtml=function(c){
  var dot=function(bar, ball){ return '<b style="position:absolute;left:6px;top:7px;width:30px;height:5px;border-radius:2px;background:'+bar+'"></b><b style="position:absolute;right:5px;bottom:5px;width:13px;height:13px;border-radius:50%;background:'+ball+'"></b>'; };
  var btn=function(key, label, sw, inner){ var on=String(c.pal)===String(key);
    return '<button class="'+(on?'on':'')+'" data-cn4pal="'+key+'" onclick="cnSet(\'pal\','+(typeof key==='number'?key:('\''+key+'\''))+')"><i style="'+sw+'">'+inner+'</i>'+label+'</button>'; };
  var T=CN4_T;
  return '<div class="cn-pal">'
    +btn('br', '★ '+cnEsc(CN4_PAL.br.n)+' (기본)', 'background:linear-gradient(165deg,'+T.red+','+T.redDeep+')', dot(T.yellow, T.white))
    +btn('bi', '★ '+cnEsc(CN4_PAL.bi.n), 'background:'+T.bg+';box-shadow:inset 0 0 0 1px '+T.line, dot(T.red, T.navy))
    +CN_PAL2.map(function(p,i){ return btn(i, (i+1)+'. '+cnEsc(p.n), 'background:linear-gradient(165deg,'+p.bg1+','+p.bg2+')', dot(p.red, p.gold)); }).join('')+'</div>';
};
/* 맨 위 칩: 카드 모양 · 제목 글꼴(브랜드 글꼴 기본) · 크기 */
cn2OptsHtml=function(){
  var v2=CN.style==='v2';
  var h='<div class="cn2-opts" id="cn2-opts"><span class="ht-sub" style="font-weight:800">카드 모양</span>'
    +cn2Chip(v2,'✨ 새 스타일',"cn2Set('style','v2')",'data-cn2="style:v2"')+cn2Chip(!v2,'지금 스타일',"cn2Set('style','v1')",'data-cn2="style:v1"');
  if(v2) h+='<span class="ht-sub" style="font-weight:800;margin-left:10px">제목 글꼴</span>'
    +cn2Chip(CN.font==='pre','<span style="font-family:\'Pretendard\',sans-serif;font-weight:800">브랜드 글꼴(Pretendard)</span> (기본)',"cn2Set('font','pre')",'data-cn2="font:pre"')
    +cn2Chip(CN.font==='black','<span style="font-family:\'Black Han Sans\',sans-serif">굵은 글꼴</span>',"cn2Set('font','black')",'data-cn2="font:black"')
    +cn2Chip(CN.font==='dohyeon','<span style="font-family:\'Do Hyeon\',sans-serif">부드러운 글꼴</span>',"cn2Set('font','dohyeon')",'data-cn2="font:dohyeon"')
    +'<span class="ht-sub" style="font-weight:800;margin-left:10px">크기</span>'
    +cn2Chip(CN.size==='45','4:5 (1080×1350)',"cn2Set('size','45')",'data-cn2="size:45"')+cn2Chip(CN.size==='11','1:1 (1080×1080)',"cn2Set('size','11')",'data-cn2="size:11"');
  return h+'</div>';
};

/* ── 「기출」 낱말 빼기 (학교 시험지는 외부 공개 금지 — docs/lumen_blog_profile.md 5-2) ── */
function cn4NoGc(s){
  return String(s==null?'':s)
    .replace(/기출은<br>/g,'유형은<br>').replace(/기출은 반복된다/g,'유형은 반복된다')
    .replace(/지난 기출과 겹친 유형/g,'지난 시험과 겹친 유형').replace(/노란 점은 기출 반복/g,'노란 점은 반복 출제 유형')
    .replace(/기출 유형 반복/g,'반복 출제 유형').replace(/기출 반복 유형/g,'반복 유형').replace(/기출 DB 난이도/g,'난이도 DB')
    .replace(/지난 기출/g,'지난 시험').replace(/기출문제/g,'시험 문제').replace(/기출/g,'시험');
}
/* 밖으로 나가는 글: 「매쓰플랫」「수학비서」「기출」 · 반복 유형의 연도 표시 빼기 */
function cn4Clean(s){
  s=cn3NoMf(s).replace(/수학비서 학습지/g,'학원 대비 학습지').replace(/수학비서/g,'학원 자료');
  s=s.replace(/\d{4}(?:·\d{4})*년 같은 시험에도 나온 유형입니다\./g,'지난 시험에도 나온 유형입니다.').replace(/ \(\d{4}(?:·\d{4})*\)/g,'');
  return cn4NoGc(s);
}

/* ── 새 스타일 카드 고치기: 꼬리말 = 블로그 꼬리말 · 「기출」 없음 · 반복 출제 = 유형 이름만 ── */
/* 문항 카드 체크 줄: 「2024·2025년 기출에도」 → 「지난 시험에도 나온 유형」 (연도를 쓰지 않는다) */
function cn4YearLine(h){ return String(h).replace(/<b>\d{4}(?:·\d{4})*년<\/b> 기출에도/g, '<b>지난 시험</b>에도 나온 유형'); }
function cn4Foot(no, N){ return '<div class="foot bf"><span class="cn4fb"><i class="cn4dot" aria-hidden="true"></i><span class="cn4nm">루멘수학</span></span><span class="cn4pg">'+no+' / '+N+'</span></div>'; }
cn2Cards=(function(o){ return function(d){
  var out=o(d), c=cnCfg(d), R=cnRows(d), N=out.length, E=cnEsc;
  var rep=R.filter(function(r){ return r.yrs && r.yrs.length; }), types=[];
  rep.forEach(function(r){ var t=String(r.type||'').trim(); if(t && types.indexOf(t)<0) types.push(t); });
  out.forEach(function(x, i){
    var h=x.html;
    h=h.replace(/<div class="foot">[\s\S]*?<\/div>(?=<\/div><div class="wmk")/, cn4Foot(i+1, N));
    h=cn4YearLine(h);
    if(/_반복출제$/.test(x.file)){
      var bl=types.length ? cn2Fit(types.slice(0,3).map(function(t){ return '<b>'+E(cn2Clip(t,16))+'</b>'; })) : ['지난 시험과 겹친 유형이 <b>없습니다</b>', '<b>새 유형</b>이 많이 나온 시험'];
      h=h.replace(/<div class="list">[\s\S]*?<\/div><div class="slogan">/, function(){ return '<div class="list">'+bl.map(function(b){ return '<div class="li"><i>✓</i><span>'+b+'</span></div>'; }).join('')+'</div><div class="slogan">'; });
      h=h.replace('같은 학교 · 같은 학년 · 같은 시험과 비교', '같은 학년 같은 시험의 출제 유형과 비교');
    }
    if(cn4IsBrand(c.pal)) h=h.replace('변별 문항 (빨간 점)', '변별 문항 (큰 점)');
    if(c.pal==='bi') h=h.replace('노란 점은 기출 반복', '남색 점은 반복 출제 유형');
    x.html=cn4NoGc(h);
  });
  return out; }; })(cn2Cards);

/* ── CSS: 카드 CSS(cn2-css) 뒤에 붙인다 → 내려받기 틀(iframe)에도 같이 들어간다 ── */
function cn4Css(){
  var L=CN4_B.logo||'';
  return ''
  /* 블로그 꼬리말 — 로고 점 + 루멘수학 · 쪽수 (글자 2.6% · 로고 3.4%) */
  +'.cn2 .foot.bf{align-items:center;margin-top:2cqw;font-size:2.6cqw;font-weight:700;letter-spacing:0;color:rgba(255,255,255,.85);line-height:1}'
  +'.cn2 .foot.bf .cn4fb{display:flex;align-items:center;gap:1.3cqw;padding:0;margin:0}.cn2 .foot.bf .cn4pg{padding:0;margin:0;font-variant-numeric:tabular-nums;white-space:nowrap}'
  +'.cn2 .foot.bf .cn4dot{display:block;width:3.4cqw;height:3.4cqw;border-radius:.8cqw;flex:none;box-shadow:0 0 0 .2cqw rgba(255,255,255,.35);'+(L?('background:url("'+L+'") center/cover no-repeat'):'background:'+CN4_T.red)+'}'
  /* 꼬리말 자리는 늘 남겨 둔다 — 글꼴이 달라 넓어져도 꼬리말이 카드 밖으로 밀리지 않게: 꼬리말은 줄지 않고 한 줄, 흰 패널이 대신 줄어든다(넘치면 잘림) */
  +'.cn2 .cn2-in>.foot{flex:0 0 auto;white-space:nowrap;overflow:hidden}.cn2 .foot.bf .cn4fb{min-width:0;overflow:hidden}.cn2 .foot.bf .cn4nm{overflow:hidden;text-overflow:clip}'
  +'.cn2 .cn2-in>.list{flex-shrink:1;min-height:0;overflow:hidden}.cn2 .cn2-in>.slogan{flex:0 0 auto}'
  +'.cn2-wrap.s11 .cn2 .foot.bf{margin-top:1cqw;font-size:2.2cqw}.cn2-wrap.s11 .cn2 .foot.bf .cn4dot{width:2.6cqw;height:2.6cqw;border-radius:.6cqw}'   /* 1:1 은 세로가 짧다 — 옛 꼬리말 높이 안으로 */
  /* 브랜드 글꼴 Pretendard — 제목 굵기 800 · 외곽선·그림자는 그대로(사진 위에서도 읽히게) */
  +'.cn2-wrap.f-pre{--cn2d:"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
  +'.cn2-wrap.f-pre .cn2{font-family:"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
  +'.cn2-wrap.f-pre .cn2 .ttl{font-weight:800;letter-spacing:-.035em;line-height:1.12}'
  +'.cn2-wrap.f-pre .cn2 .brand,.cn2-wrap.f-pre .cn2 .big b,.cn2-wrap.f-pre .cn2 .tl b,.cn2-wrap.f-pre .cn2 .pk .no b{font-weight:800;letter-spacing:-.02em}'
  +'.cn2-wrap.f-pre .cn2 .brand small{font-family:inherit}'
  /* 두 브랜드 색 공통 — 흰 패널 강조 글자는 브랜드 붉은색 */
  +'.cn2-wrap.pv-brand .cn2 .li b{color:var(--bred)}'
  /* 브랜드 · 붉은 바탕: 강조 = 노랑 + 흰색 */
  +'.cn2-wrap.pv-br .cn2 .ribbon{background:var(--b2)}'
  +'.cn2-wrap.pv-br .cn2 .li i{background:var(--b1)}'
  +'.cn2-wrap.pv-br .cn2 .pk .no{background:var(--b2)}'
  +'.cn2-wrap.pv-br .cn2 .kw span.hit{background:#fff;border-color:#fff;color:var(--b1)}'
  /* 브랜드 · 아이보리: 밝은 바탕 — 글자는 진한 색, 강조 = 붉은색 + 남색 (노랑 안 씀) */
  +'.cn2-wrap.pv-bi .cn2{color:var(--tx)}'
  +'.cn2-wrap.pv-bi .cn2 .dots{background-image:radial-gradient(rgba(192,63,63,.16) 1.1px,transparent 1.4px)}'
  +'.cn2-wrap.pv-bi .cn2 .math{color:rgba(7,55,86,.16)}.cn2-wrap.pv-bi .cn2 .star{text-shadow:none}'
  +'.cn2-wrap.pv-bi .cn2 .ribbon{opacity:.1}.cn2-wrap.pv-bi .cn2 .ribbon2{opacity:.3}'
  +'.cn2-wrap.pv-bi .cn2 .brand{color:var(--tx);text-shadow:none}'
  +'.cn2-wrap.pv-bi .cn2 .eyebrow{text-shadow:none}'
  +'.cn2-wrap.pv-bi .cn2 .ttl{color:var(--tx)}'
  +'.cn2-wrap.pv-bi .cn2 .viz{background:#fff;border-color:var(--ln)}'
  +'.cn2-wrap.pv-bi .cn2 .big span,.cn2-wrap.pv-bi .cn2 .vb em,.cn2-wrap.pv-bi .cn2 .hb .r,.cn2-wrap.pv-bi .cn2 .tl b{color:var(--tx)}'
  +'.cn2-wrap.pv-bi .cn2 .tl b.g{color:var(--gd)}.cn2-wrap.pv-bi .cn2 .tl b.r{color:var(--rd)}'
  +'.cn2-wrap.pv-bi .cn2 .tl div{background:var(--b1)}.cn2-wrap.pv-bi .cn2 .tl span,.cn2-wrap.pv-bi .cn2 .vb span{color:var(--mu)}'
  +'.cn2-wrap.pv-bi .cn2 .hb .bar{background:rgba(28,20,20,.08)}'
  +'.cn2-wrap.pv-bi .cn2 .mp b[style*="255,255,255"]{background:var(--ln) !important;color:var(--mu)}.cn2-wrap.pv-bi .cn2 .mp b i{background:var(--bnavy)}'
  +'.cn2-wrap.pv-bi .cn2 svg circle[stroke^="rgba(255"]{stroke:var(--ln)}.cn2-wrap.pv-bi .cn2 svg line[stroke^="rgba(255"]{stroke:rgba(28,20,20,.18)}'
  +'.cn2-wrap.pv-bi .cn2 svg circle[fill="#ffffff"]{stroke:var(--mu)}.cn2-wrap.pv-bi .cn2 svg text{fill:var(--tx)}'
  +'.cn2-wrap.pv-bi .cn2 .kw span{background:#fff;color:var(--tx)}.cn2-wrap.pv-bi .cn2 .kw span.hit{background:var(--rd);border-color:var(--rd);color:#fff}'
  +'.cn2-wrap.pv-bi .cn2 .slogan{color:#fff}'
  +'.cn2-wrap.pv-bi .cn2 .list{box-shadow:0 1.4cqw 3cqw rgba(28,20,20,.12);border:.3cqw solid var(--ln)}'
  +'.cn2-wrap.pv-bi .cn2 .foot.bf{color:var(--mu)}.cn2-wrap.pv-bi .cn2 .foot.bf .cn4dot{box-shadow:none}'
  /* 아이보리 + 배경 그림: 어둡게 대신 아이보리 막(진한 글자가 읽히게) */
  +'.cn2-wrap.pv-bi .cn2.hasbg .bgdim{background:rgba(248,244,239,.84) !important}'
  /* 설정 칸 — 내려받기 단추 */
  +'#cn4-blog{border-color:#c03f3f;color:#c03f3f;font-weight:800}';
}
cn2EnsureCss=(function(o){ return function(){ o(); var st=document.getElementById('cn2-css'); if(st && !st.getAttribute('data-cn4')){ st.textContent+=cn4Css(); st.setAttribute('data-cn4','1'); } }; })(cn2EnsureCss);

/* ── 설정 칸: 「⬇ 블로그 폴더로 내려받기」 단추 (기존 내려받기 단추 옆) ── */
cnPanelHtml=(function(o){ return function(d){
  var h=o(d); if(CN.style==='v1') return h;
  var k=h.indexOf('<button class="ht-btn" onclick="cnToggle()">닫기</button>');
  var b='<button class="ht-btn" id="cn4-blog" onclick="cn4BlogExport()" title="blog/날짜-학교학년-exam/ 폴더 그대로 — 카드 PNG · cards.json · source.md · AI 초안 post_draft.md · README.txt">'+(CN.busy&&CN.blog?('⏳ '+cnEsc(CN.busy)):'⬇ 블로그 폴더로 내려받기')+'</button>';
  return k>=0 ? (h.slice(0,k)+b+h.slice(k)) : h; }; })(cnPanelHtml);

/* ── 카드 그림 만들기 (새 스타일 · 고른 크기 · 글꼴 받은 뒤 · 모자이크 들어간 그림) — 두 내려받기가 같이 쓴다 ── */
async function cn4Render(d, cards, W, H, label){
  if(typeof html2canvas==='undefined') await _mrLoadScript(CN4_H2C);
  cn2EnsureCss(); if(!CN.bgIdx) await cn2BgLoad();
  var c=cnCfg(d), out=[];
  /* 학원앱의 화면 줌이 닿지 않는 따로 된 틀(iframe)에서 1080px 로 그린다 (v19-80 과 같은 방법) */
  var fr=document.createElement('iframe'); fr.setAttribute('aria-hidden','true');
  fr.style.cssText='position:fixed;left:-20000px;top:0;width:'+W+'px;height:'+H+'px;border:0;zoom:1';
  document.documentElement.appendChild(fr);
  try{
    var css=((document.getElementById('cn-css')||{}).textContent||'')+((document.getElementById('cn2-css')||{}).textContent||'');
    var fd=fr.contentDocument; fd.open();
    fd.write('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="'+CN2_FONT_URL_ALL+'"><link rel="stylesheet" href="'+CN4_FONT_URL+'"><style>html,body{margin:0;padding:0;background:transparent}'+css+'</style></head><body><div id="h" class="'+cn2WrapCls(c)+'" style="display:block;width:'+W+'px;'+cn2PalVars(c.pal)+'"></div></body></html>');
    fd.close();
    await new Promise(function(r){ if(fd.readyState==='complete') r(); else fr.onload=function(){ r(); }; setTimeout(r,4000); });
    var host=fd.getElementById('h');
    for(var i=0;i<cards.length;i++){
      CN.busy=(label||'카드')+' '+(i+1)+'/'+cards.length; var b=document.getElementById(CN.blog?'cn4-blog':'') || document.querySelector('#cn-panel .ht-btn.pri'); if(b) b.textContent='⏳ '+CN.busy;
      host.innerHTML=cards[i].html;
      var imgs=host.querySelectorAll('img');
      for(var j=0;j<imgs.length;j++){ var im=imgs[j]; try{ var du=await cnToDataUrl(im.getAttribute('src')); if(im.getAttribute('data-blur')){ du=await cnMosaic(du); im.classList.remove('blur'); } im.src=du; await new Promise(function(r){ if(im.complete) r(); else { im.onload=r; im.onerror=r; } }); }catch(e){ im.removeAttribute('src'); } }
      /* 글꼴: 제목 글꼴을 확실히 받은 뒤 그린다 (첫 장은 0.3초 더 기다림) */
      try{ if(fd.fonts&&fd.fonts.load){ await Promise.all([fd.fonts.load('800 120px "Pretendard"','루멘수학 0123'), fd.fonts.load('700 40px "Pretendard"','루멘수학 0123'), fd.fonts.load('400 120px "Black Han Sans"','루멘수학 0123'), fd.fonts.load('400 120px "Do Hyeon"','루멘수학 0123'), fd.fonts.load('900 40px "Noto Sans KR"','루멘수학')]); } }catch(e){}
      try{ if(fd.fonts&&fd.fonts.ready) await fd.fonts.ready; }catch(e){}
      await new Promise(function(r){ setTimeout(r, i===0?300:60); });
      var cv=await html2canvas(host.firstChild, { scale:1, useCORS:true, backgroundColor:null, logging:false, width:W, height:H, windowWidth:W, windowHeight:H });
      out.push(await new Promise(function(r){ cv.toBlob(r,'image/png'); }));
    }
  } finally { fr.remove(); }
  return out;
}

/* 「⬇ 카드 내려받기」(새 스타일) — 하는 일은 v19-100 그대로(파일 이름 · 블로그자료.md), 그리는 곳만 cn4Render 로 */
cn2Export=async function(){
  var d=HT.data[HT.cur]; if(!d||CN.busy) return;
  var c=cnCfg(d), W=1080, H=CN.size==='11'?1080:1350;
  try{
    CN.busy='준비 중'; CN.blog=false; render();
    if(typeof html2canvas==='undefined') await _mrLoadScript(CN4_H2C);
    if(typeof JSZip==='undefined') await _mrLoadScript(CN4_JSZIP);
    var cards=cn2Cards(d), zip=new JSZip(), blobs=await cn4Render(d, cards, W, H);
    cards.forEach(function(x, i){ zip.file(x.file+'.png', blobs[i]); });
    var md=cnMd(d, cards), note='> - 카드 스타일: 새 스타일(디자인 2판) · 제목 글꼴 '+cn4FontName()+' · '+W+'×'+H+' · 색 「'+cn2Pal(c.pal).n+'」';
    var mi=md.indexOf('\n\n## 제목 후보'); md=mi>=0?(md.slice(0,mi)+'\n'+note+md.slice(mi)):(md+'\n'+note);
    zip.file('블로그자료.md', md);
    CN.busy='묶는 중';
    var z=await zip.generateAsync({ type:'blob' }), e=d.exam||{};
    cn4Save(z, '카드뉴스_'+e.school+'_'+e.grade+'_'+e.year+'_'+e.semester+'학기'+e.term+(CN.size==='11'?'_정사각':'')+'.zip');
    c.exportedAt=new Date().toISOString(); cnSave(d, true);
    CN.busy=''; htToast('🖼 카드 '+cards.length+'장('+W+'×'+H+') + 블로그자료.md 를 내려받았습니다'); render();
  }catch(err){ CN.busy=''; render(); htToast('카드 만들기 실패: '+(err&&err.message||err)); }
};
function cn4Save(blob, name){
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
}

/* ═════ ② 블로그 폴더로 내려받기 ═════ */
/* 학교 이름 → 영문 (폴더 이름용) */
var CN4_SCHOOL={ '옥길중':'okgil-m', '범박중':'beombak-m', '범박고':'beombak-g', '소사고':'sosa-g', '시온고':'sion-g', '정명고':'jeongmyeong-g' };
function cn4Slug(e){
  e=e||{}; var sc=String(e.school||'').trim(), g=String(e.grade||''), dg=(g.match(/\d/)||[''])[0];
  var base=CN4_SCHOOL[sc] || CN4_SCHOOL[sc.replace(/학교$/,'')];
  if(!base) base='school-'+(/고/.test(g)?'g':(/중/.test(g)?'m':(/고(등학교)?$/.test(sc)?'g':'m')));
  return base+dg+'-exam';
}
function cn4Today(){ return new Date(Date.now()+9*3600*1000).toISOString().slice(0,10); }   /* 한국 날짜 */
function cn4Day(ymd){ var p=String(ymd).split('-').map(Number), dt=new Date(Date.UTC(p[0],p[1]-1,p[2])); return p[1]+'월 '+p[2]+'일 '+'일월화수목금토'.charAt(dt.getUTCDay())+'요일'; }
/* 카드 파일 이름 → 블로그 폴더 종류 이름 (blog/2026-10-10-okgil-m1-exam/cards 와 같다) */
var CN4_TYPE={ '표지':'cover', '난이도흐름':'difficulty_flow', '단원비율':'units', '난이도분포':'difficulty', '적중결과':'hit_result', '적중지도':'hit_map', '자료별적중':'by_source', '반복출제':'repeat', '총평':'summary' };
var CN4_LBL={ cover:'표지', difficulty_flow:'난이도 흐름', units:'단원별 비율', difficulty:'난이도 분포', hit_result:'적중 결과', hit_map:'문항별 적중 지도', by_source:'자료별 적중', repeat:'반복 출제 유형', summary:'총평' };
function cn4Type(file){ var f=String(file||'').replace(/^\d+_/,''); if(CN4_TYPE[f]) return CN4_TYPE[f]; var m=/^(\d+)번적중$/.exec(f); return m ? ('q'+(m[1].length<2?'0':'')+m[1]) : 'card'; }
function cn4Names(cards){ return cards.map(function(x, i){ return cn2Pad(i+1)+'_'+cn4Type(x.file)+'.png'; }); }
function cn4Exam(e){ e=e||{}; var gn=String(e.grade||'').replace(/^중/,'').replace(/^고/,''); return (e.school||'')+' '+gn+'학년 · '+(e.year||'')+'년 · '+(e.semester||'')+'학기 · '+(e.term||'')+'고사'; }
/* 카드 한 줄 요약 = 종류 + 카드 제목 */
function cn4Note(x){
  var t=cn4Type(x.file), m=/<div class="ttl">([\s\S]*?)<\/div>/.exec(x.html||''), ttl=m?cn2Plain(m[1].replace(/<br\s*\/?>/g,' ')).replace(/\s+/g,' ').trim():'';
  var lbl=CN4_LBL[t] || (/^q\d+$/.test(t) ? (Number(t.slice(1))+'번 문항 사례') : '카드');
  return cn4Clean(lbl+(ttl?(' — '+ttl):''));
}
function cn4CardsJson(d, cards, names, W, H){
  var c=cnCfg(d);
  return { '_설명':'학원앱 「적중 분석 · 카드뉴스」에서 내려받은 카드 '+cards.length+'장 ('+W+'×'+H+' · 색 「'+cn2Pal(c.pal).n+'」 · 글꼴 '+cn4FontName()+'). 시험: '+cn4Exam(d.exam)+'. 그림은 이미 완성본이라 다시 그리지 않는다(type external).',
    source:'학원앱 적중 분석 카드뉴스 · '+cn4Today(),
    cards:cards.map(function(x, i){ return { type:'external', file:names[i], note:cn4Note(x) }; }) };
}
/* source.md = 블로그자료.md (카드 이름만 폴더 이름으로) — 블로그 세션이 쓸 사실 자료 */
function cn4SourceMd(d, cards, names, W, H){
  var c=cnCfg(d), cc=cards.map(function(x, i){ var y={}; for(var k in x) y[k]=x[k]; y.file='cards/'+names[i].replace(/\.png$/,''); return y; });
  var md=cnMd(d, cc), note='> - 카드 스타일: 새 스타일(디자인 2판) · 제목 글꼴 '+cn4FontName()+' · '+W+'×'+H+' · 색 「'+cn2Pal(c.pal).n+'」\n'
    +'> - 카드 그림은 cards/ 폴더에 있고 cards.json 에는 type external 로 적혀 있다(다시 그리지 않는다).\n'
    +'> - 학교 시험지는 외부 공개 금지 — 본문에 시험지의 출처·연도를 드러내지 않는다(같은 뜻은 「루멘수학 시험대비자료」).';
  var mi=md.indexOf('\n\n## 제목 후보'); md=mi>=0?(md.slice(0,mi)+'\n'+note+md.slice(mi)):(md+'\n'+note);
  return cn4Clean(md);
}
/* AI 초안 — 규칙은 조립 때 docs/lumen_blog_profile.md 에서 그대로 옮긴 것(CN_BLOG_RULES) */
function cn4Prompt(d, src, names){
  var e=d.exam||{}, day=cn4Today();
  return ['너는 부천 옥길동 수학학원 «루멘수학» 원장이 직접 쓰는 네이버 블로그 글의 초안을 쓴다. 1인칭은 「저는」, 합니다체.',
    '아래 «블로그 규칙»(학원 블로그 원본 파일에서 그대로 옮김)을 지키고, 사실은 «사실 자료»에 있는 것만 쓴다.',
    '',
    '[꼭 지킬 것]',
    '- 결과는 마크다운 한 편만. 맨 위 머리말(--- 와 --- 사이)에 title · date: '+day+' · recruit: false · hashtags(8개 이상, 규칙 7번에서 고르기) 를 적는다.',
    '- 제목은 규칙 4-3 대로 «내용을 요약한 문장 + — 부천 옥길동 루멘수학».',
    '- 도입 첫 문장에 날짜와 요일을 적는다: '+cn4Day(day)+'.',
    '- 숫자는 «사실 자료»에 나온 숫자만 쓴다. 없는 숫자(점수 · 학생 수 · 퍼센트 · 연도)를 지어내지 않는다.',
    '- 학생 이름 · 학생 코드 · 개별 점수 · 교재 이름 · 쪽 번호 · 시험 문제 원문은 쓰지 않는다.',
    '- 외부 서비스나 프로그램 이름(학습지 업체 · 문제은행 · 앱 이름)은 쓰지 않는다. 자료는 «교과서» · «루멘수학 학습지» · «루멘수학 시험대비자료» 처럼 종류로만.',
    '- 「기출」「지난 시험지」「작년 시험지」, 연도별 비교는 쓰지 않는다(학교 시험지는 외부 공개 금지). 같은 뜻은 «루멘수학 시험대비자료».',
    '- 카드 그림 자리는 카드 순서대로 [카드 n: 파일이름] 으로 넣는다. 파일: '+names.join(', '),
    '- 실사진 자리 3곳 [실사진 n: 설명 — 학생 얼굴·이름 없이], 끝에 주소 한 줄 «경기도 부천시 소사구 옥길로 116 6층 618호», [지도: 루멘수학교습소], [톡톡: 상담 문의 https://talk.naver.com/w9d7umc].',
    '- 본문 1,500자 안팎. 이모지 쓰지 않는다. ■ 는 첫 소제목 하나만.',
    '- 시험: '+cn4Exam(e)+' 수학',
    '',
    '[블로그 규칙]',
    String((typeof window!=='undefined' && window.CN_BLOG_RULES)||''),
    '',
    '[사실 자료 — source.md]',
    src].join('\n');
}
/* AI 글 다듬기: 코드 울타리 빼기 · 머리말 없으면 붙이기 · 금지 낱말 바꾸기 · 사실 자료에 없는 숫자 표시 */
function cn4DraftFix(txt, d, src){
  var t=String(txt||'').trim().replace(/^```[a-z]*\n?/i,'').replace(/\n?```\s*$/,'').trim();
  t=cn4Clean(t);   /* 「매쓰플랫」「수학비서」「기출」 바꾸기 */
  var day=cn4Today();
  if(!/^---\n[\s\S]*?\n---\n/.test(t)){
    var e=d.exam||{};
    t='---\ntitle: '+(e.school||'')+' '+String(e.grade||'').replace(/^[중고]/,'')+'학년 '+(e.semester||'')+'학기 '+(e.term||'')+'고사 수학 분석 — 부천 옥길동 루멘수학\ndate: '+day+'\nrecruit: false\nhashtags: #옥길동수학학원 #부천수학학원 #부천옥길동수학 #관리형수학학원 #루멘수학 #수학내신 #내신대비 #시험분석\n---\n'+t;
  }
  /* 사실 자료에 없는 숫자 → 머리말에 «확인할 숫자»로 적어 둔다(블로그 세션이 지우거나 고친다) */
  var ok={}; (String(src).match(/\d+/g)||[]).forEach(function(n){ ok[n]=1; });
  day.split('-').forEach(function(n){ ok[n]=1; ok[String(Number(n))]=1; }); ['116','6','618'].forEach(function(n){ ok[n]=1; });
  var m=/^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(t), body=m?m[2]:t, bad=[];
  (body.replace(/\[[^\]]*\]/g,'').replace(/https?:\/\/\S+/g,'').match(/\d+/g)||[]).forEach(function(n){ if(!ok[n] && bad.indexOf(n)<0) bad.push(n); });
  if(m && bad.length) t='---\n'+m[1]+'\n_check: source.md 에 없는 숫자 '+bad.join(', ')+' — 확인 후 고치거나 지울 것\n---\n'+m[2];
  return t+'\n';
}
function cn4Readme(folder, hasDraft, why){
  return ['① 이 폴더('+folder+')를 저장소 blog/ 안에 그대로 넣고, 블로그 세션에서 post_draft.md 를 다듬어 post.md 로 저장한 뒤 node sync/post_check.js '+folder.replace(/\/$/,'')+' → node sync/naver_draft.js '+folder.replace(/\/$/,'')+' 순서로 돌립니다.',
    '② cards/ 의 PNG 는 학원앱 적중 분석에서 만든 완성본이라 cards.json 에 type external 로 적혀 있습니다 — card_render.js 가 다시 그리지 않습니다. source.md 는 글에 쓸 사실(숫자)만 모은 자료입니다.',
    '③ '+(hasDraft?'post_draft.md 는 AI 초안입니다 — 숫자는 source.md 와 맞춰 보고(머리말 _check 줄이 있으면 그 숫자부터), 원장님 말투로 다듬어 주세요.':('post_draft.md 는 만들지 않았습니다 — '+(why||'AI 키가 없습니다')+'. 블로그 세션이 source.md 로 직접 초안을 씁니다.'))].join('\n')+'\n';
}
window.cn4BlogExport=async function(){
  var d=HT.data[HT.cur]; if(!d||CN.busy) return;
  if(CN.style==='v1'){ htToast('블로그 폴더는 새 스타일 카드로 만듭니다 — 「✨ 새 스타일」을 먼저 골라 주세요'); return; }
  var c=cnCfg(d), W=1080, H=CN.size==='11'?1080:1350, e=d.exam||{};
  try{
    CN.busy='블로그 폴더 준비 중'; CN.blog=true; render();
    if(typeof html2canvas==='undefined') await _mrLoadScript(CN4_H2C);
    if(typeof JSZip==='undefined') await _mrLoadScript(CN4_JSZIP);
    try{ if(typeof cn3MzPrep==='function') await cn3MzPrep(d); }catch(_){}
    var cards=cn2Cards(d), names=cn4Names(cards), slug=cn4Today()+'-'+cn4Slug(e), folder='blog/'+slug+'/';
    var blobs=await cn4Render(d, cards, W, H, '블로그 카드');
    var zip=new JSZip();
    names.forEach(function(n, i){ zip.file(folder+'cards/'+n, blobs[i]); });
    zip.file(folder+'cards.json', JSON.stringify(cn4CardsJson(d, cards, names, W, H), null, 2)+'\n');
    var src=cn4SourceMd(d, cards, names, W, H); zip.file(folder+'source.md', src);
    var draft='', why='';
    CN.busy='AI 초안 쓰는 중'; var b=document.getElementById('cn4-blog'); if(b) b.textContent='⏳ '+CN.busy;
    try{ draft=await callAI(cn4Prompt(d, src, names)); if(!String(draft||'').trim()) why='AI 가 빈 글을 보냈습니다'; }
    catch(err){ var msg=String((err&&err.message)||err); why=/API 키/.test(msg)?'AI 키가 없습니다(설정 탭에서 등록하면 다음 내려받기부터 초안이 들어갑니다)':('AI 초안 실패: '+msg); draft=''; }
    if(String(draft||'').trim()) zip.file(folder+'post_draft.md', cn4DraftFix(draft, d, src)); else draft='';
    zip.file(folder+'README.txt', cn4Readme(folder, !!draft, why));
    CN.busy='묶는 중';
    var z=await zip.generateAsync({ type:'blob' });
    cn4Save(z, slug+'.zip');
    c.blogAt=new Date().toISOString(); cnSave(d, true);
    CN.busy=''; CN.blog=false; htToast('⬇ 블로그 폴더 '+folder+' — 카드 '+cards.length+'장 · cards.json · source.md'+(draft?' · post_draft.md':' (AI 초안 없음)')+' · README.txt'); render();
  }catch(err){ CN.busy=''; CN.blog=false; render(); htToast('블로그 폴더 만들기 실패: '+(err&&err.message||err)); }
};
