/* ═══════════════════════════════════════════════════════════════════
 * v19-100: 📰 카드뉴스 «디자인 2판» + 🖼 배경함 (원장 승인 2026-10-10 — 시안 docs/mockup_cardnews_v2.html)
 *  원장 지시: 「②먼저 만들고 배경함은 둘 다 넣어」 · 제목 글꼴은 굵은 글꼴 기본 + 부드러운 글꼴 고르기
 *  · 폰에서 읽히게: 본문 8~9px(카드 폭 2.3%) → 13px 이상(3.6%) · 제목 폭의 12% · 가장 작은 글자 2.0%
 *  · 한 장 = 제목 3줄 이내(핵심 낱말 금색/빨강) + 체크 3줄(60자 안) + 표어 띠
 *  · 그래프 카드는 «숫자 하나를 크게» + 한 줄 설명 · 시험 문항 카드는 흐린 시험 그림을 흰 패널 안에
 *  · 배경함: 색마다 배경 그림 — 원장님이 올리기 / Gemini 로 만들기(등록된 키) → Storage photos/cardbg/<색>/<id>
 *    목록은 lumen_store cn_bg_index = { updated, items:[{id, pal, url, path, src:'upload'|'gemini', at, note}] }
 *    카드마다 배경 고르기는 시험 설정 exam_hit_<시험>.card.bg = { 카드파일: id, '*': 전체 }
 *  · 「새 스타일 / 지금 스타일」 칩 — 지금 스타일(v19-80 그림)은 그대로 남는다
 *  · 학생 이름 · 교재 이름 · 쪽 번호는 넣지 않는다. 자료는 종류만(교과서 · 학원 학습지 · 학원 프린트 · 매쓰플랫 학습지·교재)
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  function ls(k, dflt){ try{ var v=localStorage.getItem(k); return v==null?dflt:v; }catch(e){ return dflt; } }
  CN.style = ls('cn_style','v2')==='v1' ? 'v1' : 'v2';          /* 카드 모양 */
  CN.font  = ls('cn_font','black')==='dohyeon' ? 'dohyeon' : 'black';   /* 제목 글꼴 */
  CN.size  = ls('cn_size','45')==='11' ? '11' : '45';            /* 4:5(1080×1350) · 1:1(1080×1080) */
  var dm = parseFloat(ls('cn_bgdim','0.35')); CN.bgDim = (isNaN(dm)?0.35:Math.max(0,Math.min(0.8,dm)));
  CN.bgOpen=false; CN.bgIdx=null; CN.bgLoading=false; CN.bgMsg=''; CN.gen=null; CN.genBusy=false; CN.bgPick=''; CN.bgBusy='';
})();
var CN2_BUCKET='photos';   /* 공개 버킷(플래너 사진과 같은 곳) — html2canvas 가 CORS 로 읽을 수 있다 */
var CN2_GEM_URL='https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent';
var CN2_FONT_URL='https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&display=swap';
var CN2_FONT_URL_ALL='https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Noto+Sans+KR:wght@400;700;900&display=swap';

/* 12색 → 진한 바탕 + 금색·빨강 강조 (순서·이름은 CN_PAL 과 같다 — 색 칩이 그대로 동작) */
var CN2_PAL_RAW=[
  ['#163566','#0a1c3b','#f5c542','#ff5a5a'],   /* 미드나잇 블루 */
  ['#1d5a46','#0b2b22','#f5c542','#ff7a59'],   /* 숲속 그린 */
  ['#6b1f35','#2b0b15','#f2c14e','#ff6b6b'],   /* 버건디 골드 */
  ['#3b3b42','#141416','#ffb23d','#ff5a3d'],   /* 차콜 오렌지 */
  ['#3d2a78','#160e33','#f5c542','#ff6b9a'],   /* 퍼플 나이트 */
  ['#145a63','#06272c','#fbbf24','#ff6b6b'],   /* 딥 틸 */
  ['#8a1d2a','#360910','#ffd166','#ff9a4d'],   /* 루멘 레드 */
  ['#1f4f9c','#0c244d','#f5c542','#ff5a5a'],   /* 화이트 블루 → 진한 파랑 */
  ['#4a2418','#22100a','#f3d39a','#ff5a4e'],   /* 아이보리 레드 → 진한 밤색 */
  ['#0f6b58','#05302a','#ffd166','#ff8a5b'],   /* 민트 라이트 → 진한 초록 */
  ['#1d4ed8','#0a1f63','#ffb347','#ff5a5a'],   /* 스카이 오렌지 → 진한 하늘 */
  ['#2f2f35','#101012','#f4f4f5','#ff4d6d']    /* 그레이 모노 → 먹색 */
];
var CN_PAL2=CN2_PAL_RAW.map(function(a,i){ return { n:(CN_PAL[i]||{}).n||('색 '+(i+1)), bg1:a[0], bg2:a[1], gold:a[2], red:a[3], ink:a[1], panel:(i===8?'#fffdf7':'#ffffff') }; });
function cn2Pal(i){ return CN_PAL2[i]||CN_PAL2[1]; }
function cn2PalVars(i){ var p=cn2Pal(i); return '--b1:'+p.bg1+';--b2:'+p.bg2+';--gd:'+p.gold+';--rd:'+p.red+';--ink:'+p.ink+';--pn:'+p.panel+';--wm2:rgba(255,255,255,.09)'; }

/* ── 작은 도구 ── */
function cn2Pad(n){ return (n<10?'0':'')+n; }
function cn2Plain(h){ return String(h==null?'':h).replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&'); }
function cn2Clip(s, n){ s=String(s==null?'':s).trim(); return s.length>n ? (s.slice(0,Math.max(1,n-1))+'…') : s; }
/* 체크 줄은 모두 합쳐 60자 안 — 넘치면 뒤 줄부터 뺀다(한 줄은 남긴다) */
function cn2Fit(arr, max){ max=max||60; var a=(arr||[]).filter(function(x){ return cn2Plain(x).trim(); }).slice(0,3);
  var tot=function(){ return a.reduce(function(s,x){ return s+cn2Plain(x).length; },0); };
  while(a.length>1 && tot()>max) a.pop();
  if(a.length===1 && tot()>max) a[0]=cnEsc(cn2Clip(cn2Plain(a[0]), max));
  return a; }
/* 자료 이름은 종류만 */
function cn2Kind(m){ if(!m) return ''; try{ if(typeof HTS_KIND!=='undefined' && typeof htsGroup==='function') return HTS_KIND[htsGroup(m.kind)].r; }catch(e){}
  return cnMatKind(m)==='교과서' ? '교과서' : '학원 학습지'; }
var CN2_KINDC={ '교과서':'#2fa36b', '학원 학습지':'#4a8dff', '학원 프린트':'#ff9a3d', '매쓰플랫 학습지·교재':'#ff5a5a' };
function cn2Head(d){ var e=d.exam||{}; var gn=String(e.grade||'').replace(/^중/,'').replace(/^고/,''); return (e.school||'')+' '+gn+'학년 · '+(e.semester||'')+'학기 '+(e.term||'')+'고사 분석'; }
var CN2_MATH=['y = f(x)','n ∈ ℕ','∠AOB','△ABC','a² + b²','√2','x → ∞','AB ∥ CD','∫ f(x)dx','π r²','x² − 1','sin θ'];

/* ── 카드 틀 (② · 배경 그림이 있으면 ③) ──
 *   opt = { viz:그래프 칸 HTML, one:그래프 칸 한 칸짜리, pre:제목 아래 HTML, panel:흰 패널 위쪽 HTML, cls:추가 class } */
function cn2Card(no, N, head, ttlHtml, bullets, sloganText, bgUrl, opt){
  opt=opt||{};
  var dim=CN.bgDim, m1=CN2_MATH[(no*2)%CN2_MATH.length], m2=CN2_MATH[(no*2+1)%CN2_MATH.length];
  var h='<div class="cn2'+(bgUrl?' hasbg':'')+(opt.viz?' hasviz':'')+(opt.cls?(' '+opt.cls):'')+'" role="img" aria-label="카드 '+no+' / '+N+'">';
  if(bgUrl) h+='<img class="bgimg" src="'+cnEsc(bgUrl)+'" alt="" crossorigin="anonymous"><div class="bgdim" style="background:linear-gradient(180deg,rgba(0,0,0,'+Math.min(0.95,dim+0.12).toFixed(2)+') 0%,rgba(0,0,0,'+dim.toFixed(2)+') 42%,rgba(0,0,0,'+Math.min(0.95,dim+0.22).toFixed(2)+') 100%)"></div>';
  else h+='<div class="dots"></div><div class="star s1">★</div><div class="star s2">✦</div><div class="math m1">'+cnEsc(m1)+'</div><div class="math m2">'+cnEsc(m2)+'</div><div class="ribbon"></div><div class="ribbon2"></div>';
  /* 글자 칸은 안쪽 틀(.cn2-in)에 — 바깥 틀에 여백이 없어야 cqw 가 «카드 폭의 %» 가 된다 */
  h+='<div class="cn2-in">'
    +'<div class="top"><div class="brand">루멘수학<small>옥길동 관리형 수학학원</small></div><div class="card-no">CARD '+cn2Pad(no)+'</div></div>'
    +'<div class="eyebrow">'+cnEsc(head)+'</div>'
    +'<div class="ttl">'+ttlHtml+'</div>'
    +(opt.pre||'')
    +(opt.viz?('<div class="viz'+(opt.one?' one':'')+'">'+opt.viz+'</div>'):'')
    +'<div class="list">'+(opt.panel||'')+(bullets||[]).map(function(b){ return '<div class="li"><i>✓</i><span>'+b+'</span></div>'; }).join('')+'</div>'
    +'<div class="slogan">'+sloganText+'</div>'
    +'<div class="foot"><span>LUMEN MATH</span><span>AHA NOTE · ULTRA FEEDBACK</span></div></div>'
    +'<div class="wmk" aria-hidden="true">'+Array(13).join('<span>루멘수학</span>')+'</div></div>';
  return h;
}
/* 큰 숫자 하나 + 한 줄 */
function cn2Big(num, sub){ return '<div class="big"><b>'+num+'</b><span>'+sub+'</span></div>'; }
/* 도넛 (SVG 안에는 글자 없음 — 그림으로 내릴 때 글꼴이 안 따라가서) */
function cn2Donut(parts){
  var R=58, C=2*Math.PI*R, tot=parts.reduce(function(a,p){ return a+p.v; },0)||1, off=0, s='<svg viewBox="0 0 160 160" aria-hidden="true">';
  s+='<circle cx="80" cy="80" r="'+R+'" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="28"/>';
  parts.forEach(function(p){ if(!p.v) return; var L=C*p.v/tot; s+='<circle cx="80" cy="80" r="'+R+'" fill="none" stroke="'+p.c+'" stroke-width="28" stroke-dasharray="'+L.toFixed(2)+' '+(C-L).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 80 80)"/>'; off+=L; });
  return s+'</svg>';
}
/* 문항별 난이도 흐름 — 번호(숫자)만 크게 */
function cn2Flow(R, D, P){
  var MX=(D&&D.max)||5, n=R.length||1, W=600, H=250, L=14, B=44, step=(W-L-20)/Math.max(1,n-1);
  var y=function(l){ return 14+(H-B-26)*(MX-Math.max(1,Math.min(MX,l)))/(MX-1); };
  var s='<svg viewBox="0 0 '+W+' '+H+'" aria-hidden="true">';
  [1,Math.round((1+MX)/2),MX].forEach(function(l){ s+='<line x1="'+L+'" x2="'+(W-6)+'" y1="'+y(l)+'" y2="'+y(l)+'" stroke="rgba(255,255,255,.22)" stroke-width="2" stroke-dasharray="6 6"/>'; });
  if(D&&D.hard) s+='<line x1="'+L+'" x2="'+(W-6)+'" y1="'+y(D.hard-0.5)+'" y2="'+y(D.hard-0.5)+'" stroke="'+P.red+'" stroke-width="3" stroke-dasharray="10 6"/>';
  var pts=R.map(function(r,i){ return [L+10+step*i, y(r.level||1)]; });
  s+='<polyline fill="none" stroke="'+P.gold+'" stroke-width="5" stroke-linejoin="round" points="'+pts.map(function(p){ return p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ')+'"/>';
  pts.forEach(function(p,i){ var k=R[i].killer; s+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="'+(k?11:6)+'" fill="'+(k?P.red:'#ffffff')+'" stroke="'+P.bg2+'" stroke-width="3"/>'; });
  R.forEach(function(r,i){ if(i===0||i===n-1||(i+1)%5===0) s+='<text x="'+(L+10+step*i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="32" font-weight="700" fill="#ffffff" font-family="Arial,Helvetica,sans-serif">'+(i+1)+'</text>'; });
  return s+'</svg>';
}
/* 세로 막대 (HTML — 글자는 카드 글꼴 그대로) */
function cn2VBars(rows){ var mx=Math.max.apply(null, rows.map(function(r){ return r.v; }).concat([1]));
  return '<div class="vb">'+rows.map(function(r){ return '<div class="c"><em>'+r.v+'</em><i style="height:'+Math.max(3,Math.round(r.v/mx*58))+'%;background:'+r.c+'"></i><span>'+cnEsc(r.n)+'</span></div>'; }).join('')+'</div>'; }
/* 가로 막대 */
function cn2HBars(rows){ var mx=Math.max.apply(null, rows.map(function(r){ return r.v; }).concat([1]));
  return '<div class="hb">'+rows.map(function(r){ return '<div class="r"><span>'+cnEsc(r.n)+'</span><div class="bar"><i style="width:'+Math.max(4,Math.round(r.v/mx*100))+'%;background:'+r.c+'"></i></div><b>'+r.v+'</b></div>'; }).join('')+'</div>'; }

/* ── 배경 고르기 ── */
function cn2BgItems(){ return ((CN.bgIdx&&CN.bgIdx.items)||[]).filter(function(x){ return x&&x.id&&x.url; }); }
function cn2BgId(c, file){ var b=c.bg||{}; if(Object.prototype.hasOwnProperty.call(b,file)) return b[file]||''; return b['*']||''; }
function cn2BgUrl(c, file){ var id=cn2BgId(c, file); if(!id) return '';
  if(CN.bgIdx){ var it=cn2BgItems().filter(function(x){ return x.id===id; })[0]; return it?it.url:''; }
  return (c.bgUrl||{})[id]||''; }   /* 목록을 아직 안 받았으면 저장해 둔 주소 */

/* ── 카드 (v1 과 같은 순서·같은 파일 이름 · 문단 초안/숫자는 v1 것을 그대로 → 블로그자료.md 는 같다) ── */
function cn2Cards(d){
  var c=cnCfg(d), R=cnRows(d), T=R.length||1, head=cn2Head(d), P=cn2Pal(c.pal);
  var v1=[]; try{ v1=cnCards(d); }catch(err){ v1=[]; }
  var hit=R.filter(function(r){ return r.inB; }).length, cnt={same:0,'var':0,type:0,none:0}; R.forEach(function(r){ var k=r.kind==='text'?'none':r.kind; cnt[k]=(cnt[k]||0)+1; });
  var D=cnDiff(d), bc=D.names.map(function(){ return 0; }); R.forEach(function(r){ bc[r.band]=(bc[r.band]||0)+1; });
  var lvH=R.filter(function(r){ return r.band>=D.hardIdx; }).length, avg=Math.round(R.reduce(function(a,r){ return a+r.level; },0)/T*10)/10;
  var K=R.filter(function(r){ return r.killer; }), essayN=R.filter(function(r){ return r.essay; }).length;
  var ch={}, chs=[]; R.forEach(function(r){ if(!ch[r.chapter]){ ch[r.chapter]=[]; chs.push(r.chapter); } ch[r.chapter].push(r); }); chs.sort(function(a,b){ return ch[b].length-ch[a].length; });
  var rep=R.filter(function(r){ return r.yrs.length; });
  var mk={}, mks=[]; R.forEach(function(r){ if(!r.inB||!r.m) return; var k=cn2Kind(r.m); if(!k) return; if(!mk[k]){ mk[k]=[]; mks.push(k); } mk[k].push(r); }); mks.sort(function(a,b){ return mk[b].length-mk[a].length; });
  var picks=(c.picks||[]).map(function(no){ return R.filter(function(r){ return r.no===no; })[0]; }).filter(Boolean);
  var kw=(c.keywords||[]).filter(function(x){ return String(x||'').trim(); });
  if(!kw.length) kw=[(chs[0]||'')+' 비중 최다', K.length?('변별 '+K.length+'문항'):'고른 난이도', rep.length?('기출 유형 반복 '+rep.length):'새 유형 출제', '서술형 '+essayN+'문항'];
  var pct=Math.round(hit/T*100), N='§N§', out=[], no=0, E=cnEsc;
  function push(file, html){ var o=v1[out.length]; if(!o||o.file!==file) o=v1.filter(function(x){ return x.file===file; })[0]||{}; out.push({ file:file, html:html, para:o.para||'', facts:o.facts||[] }); }
  function card(file, ttl, bl, slogan, opt){ no++; push(file, cn2Card(no, N, head, ttl, cn2Fit(bl), slogan, cn2BgUrl(c, file), opt)); }

  /* 01 표지 — 숫자 네 개 */
  card('01_표지', '이번 시험<br><span class="red">한눈에</span> 보기',
    ['<b>'+T+'문항</b>을 하나씩 뜯어봤습니다', '시험 전에 푼 자료와 <b>한 문항씩 대조</b>'],
    '— 근거로 푸는 수학, 루멘수학 —',
    { one:true, viz:'<div class="tl"><div><b>'+T+'</b><span>총 문항</span></div><div><b class="r">'+K.length+'</b><span>변별 문항</span></div><div><b class="g">'+hit+'</b><span>루멘 적중</span></div><div><b>'+essayN+'</b><span>서술형</span></div></div>' });
  /* 02 난이도 흐름 */
  var k2=K.slice(0,2).map(function(r){ return r.n; });
  card('02_난이도흐름', k2.length?('<span class="red">'+k2.join('·')+'번</span>에서<br>갈렸다'):('난이도<br><span class="gold">흐름</span>'),
    K.length?K.slice(0,2).map(function(r){ return '<b>'+r.n+'번</b> '+E(cn2Clip(r.type,14)); }):['쉬운 문항부터 <b>차례로</b> 배치', '<b>고른 난이도</b>의 시험'],
    '변별 문항을 미리 풀어 본 학생이 유리',
    { viz:'<div class="ch">'+cn2Flow(R,D,P)+'</div>'+(K.length?cn2Big(K.length+'<small>문항</small>','변별 문항 (빨간 점)'):cn2Big(avg+'','평균 난이도 / '+D.max)) });
  /* 03 단원 비율 */
  var cols=['#4a8dff','#ff9a3d','#3ddc97','#a78bfa','#ff5a5a','#4fd1c5']; var parts=chs.map(function(k,i){ return { n:k, v:ch[k].length, c:i===0?P.gold:cols[i%cols.length] }; });
  card('03_단원비율', '단원별<br><span class="gold">출제 비율</span>',
    chs.slice(0,2).map(function(k){ return '<b>'+E(cn2Clip(k,10))+'</b> '+ch[k].length+'문항 ('+Math.round(ch[k].length/T*100)+'%)'; }),
    '한 단원도 버릴 수 없는 출제',
    { viz:'<div class="ch">'+cn2Donut(parts)+'</div>'+cn2Big(Math.round(((ch[chs[0]]||[]).length)/T*100)+'%', E(cn2Clip(chs[0]||'',9))+' 최다') });
  /* 04 난이도 분포 */
  var easy=D.names[Math.max(0,D.hardIdx-1)]||'보통';
  card('04_난이도분포', '난이도별<br><span class="gold">문항 수</span>',
    [K.length?('변별 문항 <b>'+K.slice(0,4).map(function(r){ return r.n; }).join('·')+'번</b>'):('<b>'+E(easy)+'</b> 문항이 중심'), '기준: <b>'+(D.src==='ms'?'기출 DB 난이도':'매쓰플랫 난도')+'</b>'],
    '실수 없이 '+E(easy)+' 문항부터 지키기',
    { viz:'<div class="ch">'+cn2VBars(D.names.map(function(nm,i){ return { n:nm, v:bc[i], c:D.cols[i] }; }))+'</div>'+cn2Big(lvH+'<small>문항</small>','어려움 이상') });
  /* 05 적중 결과 */
  var kp=['same','var','type','none'].map(function(k){ return { v:cnt[k]||0, c:k==='none'?'rgba(255,255,255,.14)':CN_KC[k] }; });
  card('05_적중결과', T+'문항 중<br><span class="gold">'+hit+'문항</span> 적중',
    ['같은 문제 <b>'+cnt.same+'</b> · 숫자변형 <b>'+cnt['var']+'</b> · 유사유형 <b>'+cnt.type+'</b>', '지문만 같은 문제는 <b>적중 아님</b>'],
    '미리 푼 문제가 시험에 나왔다',
    { viz:'<div class="ch">'+cn2Donut(kp)+'</div>'+cn2Big('<small>적중 </small>'+pct+'%', hit+' / '+T+'문항') });
  /* 06 적중 지도 */
  var rows=T<=12?2:(T<=30?3:4), colsN=Math.ceil(T/rows);
  card('06_적중지도', T+'문항<br><span class="gold">적중 지도</span>',
    ['색칠된 칸 = 시험 전에 <b>미리 푼</b> 문제', '빈칸 <b>'+(T-hit)+'문항</b> · 노란 점은 기출 반복'],
    '빈칸까지 채우는 다음 시험 준비',
    { viz:'<div class="ch"><div class="mp" style="grid-template-columns:repeat('+colsN+',minmax(0,1fr))">'+R.map(function(r){ var k=r.inB?r.kind:'none'; return '<b style="background:'+(k==='none'?'rgba(255,255,255,.12)':CN_KC[k])+'">'+r.n+(r.yrs.length?'<i></i>':'')+'</b>'; }).join('')+'</div></div>'+cn2Big(hit+'<small>/'+T+'</small>','색칠된 칸') });
  /* 07 자료 종류 */
  card('07_자료별적중', '어떤 <span class="gold">자료</span>가<br>맞혔을까?',
    [mks.length?('<b>'+E(mks[0])+'</b>에서 '+mk[mks[0]].length+'문항'):'적중한 자료가 없습니다', '자료 이름은 <b>종류만</b> 적었습니다'],
    '수업에서 푼 자료가 시험을 맞혔다',
    { viz:'<div class="ch">'+cn2HBars(mks.slice(0,4).map(function(k){ return { n:k, v:mk[k].length, c:CN2_KINDC[k]||P.gold }; }))+'</div>'+cn2Big(mks.length?(mk[mks[0]].length+'<small>문항</small>'):'0', mks.length?E(cn2Clip(mks[0],10)):'적중 자료') });
  /* 문항별 적중 (원장님이 고른 것) — 흐린 시험 그림을 흰 패널 안에, 번호는 크게 */
  picks.forEach(function(r){
    var file=String(no+1).padStart(2,'0')+'_'+r.n+'번적중';
    var keys=r.top?[r.top.k].concat(r.top.also||[]):[]; var ms=keys.map(function(k){ return (d.mats||{})[k]; }).filter(Boolean);
    var o=0, n=0; ms.forEach(function(m){ Object.keys(m.res||{}).forEach(function(x){ n++; if(m.res[x]==='O') o++; }); });
    var exam=htItemImg(r.it), kname=CN_KN[r.kind]||'', kind=cn2Kind(r.m)||'학원 자료';
    var bl=['유형 <b>'+E(cn2Clip(r.type,14))+'</b>', '<b>'+E(kind)+'</b>에 '+(r.kind==='same'?'같은 문제':(r.kind==='var'?'숫자만 다른 문제':'같은 유형'))];
    if(r.yrs.length) bl.push('<b>'+r.yrs.join('·')+'년</b> 기출에도'); else if(n) bl.push('시험 전 정답 <b>'+o+'/'+n+'명</b>');
    card(file, '<span class="'+(r.killer?'red':'gold')+'">'+r.n+'번</span> 적중<br>'+E(kname), bl.slice(0,2),
      r.kind==='same'?'미리 푼 문제가 그대로 나왔다':(r.kind==='var'?'숫자만 바뀐 채 나왔다':'같은 풀이 방법으로 풀리는 문제'),
      { cls:'pick', panel:'<div class="pk"><div class="no"><b>'+r.n+'</b><span>번'+(r.killer?' · 변별':'')+'</span></div><figure>'+(exam?'<img class="blur" data-blur="1" src="'+E(exam)+'" alt="시험 '+r.n+'번 (흐리게)" crossorigin="anonymous">':'')+'<span class="bl">시험 문항 · 흐리게 처리</span></figure></div>' });
  });
  /* 반복 출제 */
  card(String(no+1).padStart(2,'0')+'_반복출제', '기출은<br><span class="red">반복</span>된다<br><span class="gold">'+rep.length+'문항</span>',
    rep.length?rep.slice(0,3).map(function(r){ return '<b>'+r.n+'번</b> '+E(cn2Clip(r.type,9))+' ('+r.yrs.map(function(y){ return String(y).slice(2); }).join('·')+')'; }):['지난 기출과 겹친 유형이 <b>없습니다</b>', '<b>새 유형</b>이 많이 나온 시험'],
    '같은 학교 · 같은 학년 · 같은 시험과 비교', {});
  /* 총평 — 마지막은 「루멘수학」 */
  var sq=CN.size==='11';   /* 1:1 은 세로가 짧아 키워드 3개 · 대비 2줄 */
  var st=(c.strategy||[]).filter(function(x){ return String(x||'').trim(); }).slice(0,sq?2:3).map(function(x){ return E(cn2Clip(x,20)); });
  card(String(no+1).padStart(2,'0')+'_총평', '이번 시험<br><span class="gold">총평</span>',
    st.length?st:['틀린 문제 <b>같은 유형</b>으로 다시 풀기'],
    E(cn2Clip(c.message||'',40))+' <b>— 루멘수학</b>',
    { cls:'last', pre:'<div class="kw">'+kw.slice(0,sq?3:4).map(function(x){ return '<span>☑ '+E(cn2Clip(x,12))+'</span>'; }).join('')+'<span class="hit">적중 '+hit+'/'+T+'</span></div>' });
  out.forEach(function(x){ x.html=x.html.split('§N§').join(String(out.length)); }); return out;
}

/* ── 카드 목록 (v2) ── */
function cn2WrapCls(c){ return 'cn-wrap cn2-wrap s'+CN.size+(CN.font==='dohyeon'?' f-dh':'')+(c.wm?'':' wmoff'); }
function cn2CardsHtml(d){
  var c=cnCfg(d), cards=cn2Cards(d), items=cn2BgItems().filter(function(x){ return x.pal===c.pal; });
  return '<div class="'+cn2WrapCls(c)+'" style="'+cn2PalVars(c.pal)+'">'+cards.map(function(x,i){
    var cur=cn2BgId(c, x.file), open=CN.bgPick===x.file;
    var lab='<div class="cn2-lab"><span class="ht-sub" style="font-weight:800">'+(i+1)+' · '+cnEsc(x.file)+'.png</span><button class="cn-chip cn2-bgc'+(cur?' on b':'')+'" data-cn2bg="'+cnEsc(x.file)+'" onclick="cn2BgPick(\''+cnEsc(x.file)+'\')">🖼 배경</button></div>';
    if(open) lab+='<div class="cn2-pick" data-cn2pick="'+cnEsc(x.file)+'"><button class="cn-chip'+(cur?'':' on b')+'" data-pk="" onclick="cn2BgSet(\''+cnEsc(x.file)+'\',\'\')">없음</button>'
      +items.map(function(it){ return '<button class="cn2-pk'+(cur===it.id?' on':'')+'" data-pk="'+cnEsc(it.id)+'" title="'+cnEsc(it.note||'')+'" onclick="cn2BgSet(\''+cnEsc(x.file)+'\',\''+cnEsc(it.id)+'\')"><img src="'+cnEsc(it.url)+'" alt="배경"></button>'; }).join('')
      +(items.length?'':'<span class="ht-sub">이 색의 배경 그림이 없습니다 — 위 「🖼 배경함」에서 올리거나 만들어 주세요</span>')
      +(cur?'<button class="cn-chip" data-cn2all="1" onclick="cn2BgAll(\''+cnEsc(cur)+'\')">전체에 같은 배경</button>':'')+'</div>';
    return '<div style="min-width:0">'+lab+x.html+'</div>'; }).join('')+'</div>';
}
cnCardsHtml=(function(o){ return function(d){ cn2EnsureCss(); if(CN.style==='v1') return o(d); if(!CN.bgIdx) cn2BgLoad(); return cn2CardsHtml(d); }; })(cnCardsHtml);

/* ── 설정 칸: 색 칩 옆에 「새 스타일 / 지금 스타일」 · 글꼴 · 크기 · 배경함 ── */
function cn2Chip(on, label, js, attr){ return '<button class="cn-chip'+(on?' on b':'')+'" '+(attr||'')+' onclick="'+js+'">'+label+'</button>'; }
function cn2OptsHtml(){
  var v2=CN.style==='v2';
  var h='<div class="cn2-opts" id="cn2-opts"><span class="ht-sub" style="font-weight:800">카드 모양</span>'
    +cn2Chip(v2,'✨ 새 스타일',"cn2Set('style','v2')",'data-cn2="style:v2"')+cn2Chip(!v2,'지금 스타일',"cn2Set('style','v1')",'data-cn2="style:v1"');
  if(v2) h+='<span class="ht-sub" style="font-weight:800;margin-left:10px">제목 글꼴</span>'
    +cn2Chip(CN.font==='black','<span style="font-family:\'Black Han Sans\',sans-serif">굵은 글꼴</span> (기본)',"cn2Set('font','black')",'data-cn2="font:black"')
    +cn2Chip(CN.font==='dohyeon','<span style="font-family:\'Do Hyeon\',sans-serif">부드러운 글꼴</span>',"cn2Set('font','dohyeon')",'data-cn2="font:dohyeon"')
    +'<span class="ht-sub" style="font-weight:800;margin-left:10px">크기</span>'
    +cn2Chip(CN.size==='45','4:5 (1080×1350)',"cn2Set('size','45')",'data-cn2="size:45"')+cn2Chip(CN.size==='11','1:1 (1080×1080)',"cn2Set('size','11')",'data-cn2="size:11"');
  return h+'</div>';
}
function cn2PalHtml(c){
  return '<div class="cn-pal">'+CN_PAL2.map(function(p,i){ return '<button class="'+(i===c.pal?'on':'')+'" onclick="cnSet(\'pal\','+i+')"><i style="background:linear-gradient(165deg,'+p.bg1+','+p.bg2+')"><b style="position:absolute;left:6px;top:7px;width:30px;height:5px;border-radius:2px;background:'+p.red+'"></b><b style="position:absolute;right:5px;bottom:5px;width:13px;height:13px;border-radius:50%;background:'+p.gold+'"></b></i>'+(i+1)+'. '+cnEsc(p.n)+'</button>'; }).join('')+'</div>';
}
function cn2BgBoxHtml(d){
  var c=cnCfg(d), P=cn2Pal(c.pal), all=cn2BgItems(), mine=all.filter(function(x){ return x.pal===c.pal; });
  var h='<div class="cn2-bgbox" id="cn2-bgbox"><button class="cn2-bgt" onclick="cn2BgToggle()">'+(CN.bgOpen?'▾':'▸')+' 🖼 배경함 <span class="ht-sub">— 「'+cnEsc(P.n)+'」 '+(CN.bgIdx?(mine.length+'장'):(CN.bgLoading?'불러오는 중…':''))+' · 카드마다 「🖼 배경」으로 고릅니다</span></button>';
  if(!CN.bgOpen) return h+'</div>';
  h+='<div class="cn2-bgin"><div class="cn2-row">'
    +'<label class="ht-btn" style="cursor:pointer">＋ 그림 올리기<input type="file" id="cn2-file" accept="image/*" style="display:none" onchange="cn2UpFile(this)"></label>'
    +'<button class="ht-btn" id="cn2-gen" onclick="cn2Gen()"'+(CN.genBusy?' disabled':'')+'>'+(CN.genBusy?'⏳ 만드는 중…':'✨ Gemini 로 만들기')+'</button>'
    +'<label class="ht-sub" style="display:inline-flex;align-items:center;gap:6px;font-weight:800">배경 어둡게 <input type="range" id="cn2-dim" min="0" max="0.8" step="0.05" value="'+CN.bgDim+'" oninput="cn2Dim(this.value)"> <b id="cn2-dimv">'+Math.round(CN.bgDim*100)+'%</b></label>'
    +(CN.bgBusy?'<span class="ht-sub" style="color:#b45309;font-weight:800">⏳ '+cnEsc(CN.bgBusy)+'</span>':'')+'</div>'
    +(CN.bgMsg?'<div class="cn2-msg" id="cn2-msg">'+cnEsc(CN.bgMsg)+'</div>':'')
    +'<div class="ht-sub" style="margin:4px 0 8px">글자 없는 장식 그림만 씁니다(별 · 리본 · 펼친 책 · 수식 기호). 카드 글자는 앱이 위에 올립니다. 그림은 학원앱 카드뉴스에만 쓰고 학생앱·학부모앱에는 보내지 않습니다.</div>';
  if(CN.gen) h+='<div class="cn2-gen" id="cn2-genbox"><img src="'+CN.gen.url+'" alt="만든 배경"><div style="display:grid;gap:6px;align-content:start"><b style="font-size:13px">✨ 새로 만든 배경 — 「'+cnEsc(cn2Pal(CN.gen.pal).n)+'」</b><button class="ht-btn pri" id="cn2-keep" onclick="cn2GenKeep()">보관</button><button class="ht-btn" id="cn2-drop" onclick="cn2GenDrop()">버리기</button></div></div>';
  h+='<div class="cn2-ths">'+(mine.length?mine.map(function(it){ return '<div class="cn2-th" data-bgid="'+cnEsc(it.id)+'"><img src="'+cnEsc(it.url)+'" alt="배경"><span class="src">'+(it.src==='gemini'?'Gemini':'올림')+'</span><div><button class="cn-chip" onclick="cn2BgAll(\''+cnEsc(it.id)+'\')">전체에 같은 배경</button><button class="cn-chip" onclick="cn2BgDel(\''+cnEsc(it.id)+'\')">✕ 삭제</button></div></div>'; }).join(''):'<span class="ht-sub">'+(CN.bgIdx?'이 색에는 아직 배경 그림이 없습니다.':'')+'</span>')+'</div>';
  var other=all.length-mine.length; if(other>0) h+='<div class="ht-sub" style="margin-top:6px">다른 색 배경 '+other+'장 — 위에서 색을 바꾸면 보입니다.</div>';
  return h+'</div></div>';
}
cnPanelHtml=(function(o){ return function(d){
  var h=o(d), c=cnCfg(d);
  var i=h.indexOf('<div class="cn-pal">'), j=h.indexOf('<div style="margin:10px 0">', i);
  if(i>=0 && j>i) h=h.slice(0,i)+cn2OptsHtml()+(CN.style==='v2'?cn2PalHtml(c):h.slice(i,j))+h.slice(j);
  if(CN.style==='v2'){ var k=h.indexOf('<div class="ht-h">📊 난이도 칸</div>'); if(k>=0) h=h.slice(0,k)+cn2BgBoxHtml(d)+h.slice(k); }
  return h; }; })(cnPanelHtml);

window.cn2Set=function(k, v){
  if(k==='style'){ CN.style=v==='v1'?'v1':'v2'; try{ localStorage.setItem('cn_style',CN.style); }catch(e){} }
  else if(k==='font'){ CN.font=v==='dohyeon'?'dohyeon':'black'; try{ localStorage.setItem('cn_font',CN.font); }catch(e){} }
  else if(k==='size'){ CN.size=v==='11'?'11':'45'; try{ localStorage.setItem('cn_size',CN.size); }catch(e){} }
  CN.bgPick=''; render(); };
window.cn2Dim=function(v){ CN.bgDim=Math.max(0,Math.min(0.8,parseFloat(v)||0)); try{ localStorage.setItem('cn_bgdim',String(CN.bgDim)); }catch(e){}
  var b=document.getElementById('cn2-dimv'); if(b) b.textContent=Math.round(CN.bgDim*100)+'%';
  var d=HT.data[HT.cur], pv=document.getElementById('cn-cards'); if(d&&pv) pv.innerHTML=cnCardsHtml(d); };
window.cn2BgToggle=function(){ CN.bgOpen=!CN.bgOpen; if(CN.bgOpen&&!CN.bgIdx) cn2BgLoad(); render(); };
window.cn2BgPick=function(file){ CN.bgPick=CN.bgPick===file?'':file; if(!CN.bgIdx) cn2BgLoad(); var d=HT.data[HT.cur], pv=document.getElementById('cn-cards'); if(d&&pv) pv.innerHTML=cnCardsHtml(d); else render(); };
function cn2Remember(c, id){ if(!id) return; var it=cn2BgItems().filter(function(x){ return x.id===id; })[0]; if(it){ c.bgUrl=c.bgUrl||{}; c.bgUrl[id]=it.url; } }
window.cn2BgSet=function(file, id){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); c.bg=c.bg||{}; c.bg[file]=id||''; cn2Remember(c, id); cnSave(d);
  var pv=document.getElementById('cn-cards'); if(pv) pv.innerHTML=cnCardsHtml(d); else render(); };
window.cn2BgAll=function(id){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d), bg={ '*':id||'' };
  cn2Cards(d).forEach(function(x){ bg[x.file]=id||''; }); c.bg=bg; cn2Remember(c, id); cnSave(d);
  htToast(id?'🖼 모든 카드에 같은 배경을 깔았습니다':'배경을 모두 껐습니다'); render(); };

/* ── 배경함 목록 (lumen_store cn_bg_index) ── */
function cn2BgLoad(force){
  if(CN.bgLoading || (CN.bgIdx && !force)) return Promise.resolve(CN.bgIdx);
  CN.bgLoading=true;
  return htKv('cn_bg_index').then(function(v){ CN.bgLoading=false; CN.bgIdx=(v&&v.items)?v:{ updated:'', items:[] }; if(VIEW==='examhit'&&CN.open) render(); return CN.bgIdx; })
    .catch(function(){ CN.bgLoading=false; CN.bgIdx=CN.bgIdx||{ updated:'', items:[] }; return CN.bgIdx; });
}
/* 저장 직전에 서버 것을 다시 읽어 합친다(다른 PC 에서 올린 것을 덮어쓰지 않게) */
function cn2BgSave(change){
  return htKv('cn_bg_index').then(function(v){ var idx=(v&&v.items)?v:{ updated:'', items:[] }; change(idx); idx.updated=new Date().toISOString();
    return htKvSet('cn_bg_index', idx).then(function(){ CN.bgIdx=idx; return idx; }); }); }
function cn2Sb(){ var sb=htSb(); if(!sb) throw new Error('서버 연결 없음'); return sb; }
/* 그림 → 1080×1350 안으로 줄이기 (사진은 JPEG, PNG 는 PNG) */
function cn2Shrink(src, mime){
  return new Promise(function(res, rej){ var im=new Image(); im.onload=function(){
      var W=im.naturalWidth||1080, H=im.naturalHeight||1350, k=Math.min(1, 1080/W, 1350/H), cw=Math.max(1,Math.round(W*k)), chh=Math.max(1,Math.round(H*k));
      var cv=document.createElement('canvas'); cv.width=cw; cv.height=chh; var g=cv.getContext('2d');
      if(mime==='image/jpeg'){ g.fillStyle='#000'; g.fillRect(0,0,cw,chh); }
      g.drawImage(im,0,0,cw,chh); cv.toBlob(function(b){ if(b) res(b); else rej(new Error('그림 줄이기 실패')); }, mime, 0.9); };
    im.onerror=function(){ rej(new Error('그림을 읽을 수 없습니다')); }; im.src=src; });
}
async function cn2BgStore(blob, mime, pal, src, note){
  var sb=cn2Sb(), id='bg'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), path='cardbg/'+pal+'/'+id+(mime==='image/jpeg'?'.jpg':'.png');
  var up=await sb.storage.from(CN2_BUCKET).upload(path, blob, { contentType:mime, upsert:true, cacheControl:'31536000' });
  if(up&&up.error) throw new Error(up.error.message||String(up.error));
  var url=''; try{ url=sb.storage.from(CN2_BUCKET).getPublicUrl(path).data.publicUrl; }catch(e){}
  if(!url) url=(typeof SUPA_URL!=='undefined'?SUPA_URL:'')+'/storage/v1/object/public/'+CN2_BUCKET+'/'+path;
  var item={ id:id, pal:pal, url:url, path:path, src:src, at:new Date().toISOString(), note:note||'' };
  await cn2BgSave(function(idx){ idx.items.push(item); });
  return item;
}
window.cn2UpFile=async function(inp){
  var f=inp&&inp.files&&inp.files[0]; if(!f) return; var d=HT.data[HT.cur]; if(!d) return; var pal=cnCfg(d).pal;
  if(!/^image\//.test(f.type||'')){ CN.bgMsg='그림 파일(PNG·JPG)만 올릴 수 있습니다'; render(); return; }
  var url=URL.createObjectURL(f);
  try{ CN.bgBusy='올리는 중'; render();
    var mime=f.type==='image/png'?'image/png':'image/jpeg', blob=await cn2Shrink(url, mime);
    await cn2BgStore(blob, mime, pal, 'upload', String(f.name||'').slice(0,60));
    CN.bgMsg='✅ 배경 그림을 배경함에 넣었습니다 — 카드의 「🖼 배경」에서 고르세요'; }
  catch(e){ CN.bgMsg='⚠ 올리기 실패: '+((e&&e.message)||e); }
  finally{ URL.revokeObjectURL(url); CN.bgBusy=''; try{ inp.value=''; }catch(_){} render(); }
};
/* ✨ Gemini 로 만들기 — 글자 없는 장식 배경 1장 */
function cn2GemKey(){ var k=''; try{ if(typeof geminiKey!=='undefined') k=geminiKey||''; }catch(e){} if(!k){ try{ k=localStorage.getItem('or_gemini_key')||''; }catch(e){} } return String(k).trim(); }
function cn2GenPrompt(pal){
  var p=cn2Pal(pal);
  return ['루멘수학 카드뉴스 배경 그림 — 글자 없음, 숫자 없음 (배경만, 글자는 나중에 앱이 올린다).',
    'Create a decorative BACKGROUND illustration for a Korean math academy social-media card, '+(CN.size==='11'?'square 1:1':'portrait 4:5')+'.',
    'ABSOLUTELY NO TEXT: no text, no letters, no numbers, no digits, no words, no logos, no watermarks, no signatures anywhere in the image.',
    'Motifs: a few gold stars, one bold diagonal ribbon, an open book, faint abstract math symbols drawn as thin line art (integral sign, square root, triangle, angle, infinity — symbols only, never letters or digits), a subtle dot grid.',
    'Colour palette: deep dark base from '+p.bg1+' to '+p.bg2+', accents gold '+p.gold+' and red '+p.red+', small white highlights.',
    'Keep the middle and lower half calm, dark and low-detail so white headline text and a white panel can sit on top; put decoration near the edges and corners.',
    'Style: clean flat vector / soft gradient poster art, high quality, no photo of people.'].join('\n');
}
window.cn2Gen=async function(){
  var d=HT.data[HT.cur]; if(!d||CN.genBusy) return; var pal=cnCfg(d).pal, key=cn2GemKey();
  if(!key){ CN.bgMsg='Gemini 키가 없습니다 — 설정 탭에서 Gemini API 키를 먼저 등록해 주세요 (또는 「＋ 그림 올리기」로 직접 올리세요)'; render(); return; }
  CN.genBusy=true; CN.bgMsg='✨ 배경 그림을 만드는 중… (10~40초)'; render();
  try{
    var body={ contents:[{ parts:[{ text:cn2GenPrompt(pal) }] }], generationConfig:{ responseModalities:['IMAGE'], imageConfig:{ aspectRatio:(CN.size==='11'?'1:1':'4:5') } } };
    var r=await fetch(CN2_GEM_URL+'?key='+encodeURIComponent(key), { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    var j={}; try{ j=await r.json(); }catch(e){}
    if(!r.ok||j.error) throw new Error((j.error&&j.error.message)||('HTTP '+r.status));
    var parts=((((j.candidates||[])[0]||{}).content||{}).parts)||[], im=null;
    parts.forEach(function(p){ var x=p&&(p.inlineData||p.inline_data); if(x&&x.data&&!im) im=x; });
    if(!im) throw new Error('그림이 오지 않았습니다 — 한 번 더 눌러 주세요');
    CN.gen={ pal:pal, url:'data:'+(im.mimeType||im.mime_type||'image/png')+';base64,'+im.data };
    CN.bgMsg='마음에 들면 「보관」, 아니면 「버리기」 후 다시 만드세요';
  }catch(e){ CN.bgMsg='⚠ Gemini 그림 만들기 실패: '+((e&&e.message)||e); }
  CN.genBusy=false; render();
};
window.cn2GenKeep=async function(){ var g=CN.gen; if(!g) return;
  try{ CN.bgBusy='보관 중'; render(); var blob=await cn2Shrink(g.url, 'image/png'); await cn2BgStore(blob, 'image/png', g.pal, 'gemini', 'Gemini');
    CN.gen=null; CN.bgMsg='✅ 배경함에 보관했습니다'; }
  catch(e){ CN.bgMsg='⚠ 보관 실패: '+((e&&e.message)||e); }
  CN.bgBusy=''; render(); };
window.cn2GenDrop=function(){ CN.gen=null; CN.bgMsg=''; render(); };
window.cn2BgDel=async function(id){
  var it=cn2BgItems().filter(function(x){ return x.id===id; })[0]; if(!it) return;
  if(!confirm('이 배경 그림을 배경함에서 지울까요? (이 그림을 고른 카드는 배경 없이 그려집니다)')) return;
  try{ CN.bgBusy='지우는 중'; render(); await cn2BgSave(function(idx){ idx.items=idx.items.filter(function(x){ return x.id!==id; }); });
    try{ var sb=htSb(); if(sb&&it.path) sb.storage.from(CN2_BUCKET).remove([it.path]).catch(function(){}); }catch(e){}   /* 파일 지우기는 되는 만큼만 */
    CN.bgMsg='배경 그림을 지웠습니다'; }
  catch(e){ CN.bgMsg='⚠ 지우기 실패: '+((e&&e.message)||e); }
  CN.bgBusy=''; render(); };

/* ── CSS · 글꼴 (한 번만) ── */
function cn2EnsureCss(){
  if(!document.getElementById('cn2-font')){ var l=document.createElement('link'); l.id='cn2-font'; l.rel='stylesheet'; l.href=CN2_FONT_URL; document.head.appendChild(l); }
  if(document.getElementById('cn2-css')) return;
  var st=document.createElement('style'); st.id='cn2-css';
  st.textContent=''
  +'.cn2-wrap{--cn2d:"Black Han Sans","Do Hyeon","Noto Sans KR",sans-serif}.cn2-wrap.f-dh{--cn2d:"Do Hyeon","Black Han Sans","Noto Sans KR",sans-serif}'
  +'.cn2{position:relative;width:100%;aspect-ratio:4/5;box-sizing:border-box;overflow:hidden;border-radius:4px;container-type:inline-size;word-break:keep-all;overflow-wrap:break-word;color:#fff;'
    +'background:radial-gradient(60% 40% at 85% 8%,rgba(255,255,255,.22),transparent 60%),linear-gradient(165deg,var(--b2) 0%,var(--b1) 45%,var(--b2) 100%);font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
  +'.cn2 .cn2-in{position:absolute;inset:0;box-sizing:border-box;padding:6% 6.5% 5%;display:flex;flex-direction:column}'
  +'.cn2-wrap.s11 .cn2{aspect-ratio:1/1}.cn2-wrap.s11 .cn2 .cn2-in{padding:5% 6.5% 4%}'
  +'.cn2 .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.16) 1.1px,transparent 1.4px);background-size:5cqw 5cqw;opacity:.5}'
  +'.cn2 .ribbon{position:absolute;left:-10%;right:-10%;top:52%;height:9cqw;background:var(--rd);transform:rotate(-7deg);opacity:.92}'
  +'.cn2 .ribbon2{position:absolute;left:-10%;right:-10%;top:58%;height:3cqw;background:var(--gd);transform:rotate(-7deg)}'
  +'.cn2 .star{position:absolute;color:var(--gd);line-height:1;text-shadow:0 2cqw 0 rgba(0,0,0,.25)}.cn2 .star.s1{left:-4.5%;top:14%;font-size:10cqw}.cn2 .star.s2{right:-3%;top:31%;font-size:9cqw}'
  +'.cn2 .math{position:absolute;font-family:"Times New Roman",serif;font-style:italic;color:rgba(255,255,255,.32);font-size:5cqw;white-space:nowrap}.cn2 .math.m1{right:8%;top:16%}.cn2 .math.m2{left:8%;top:40%;font-size:4cqw}'
  +'.cn2 .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}.cn2 .bgdim{position:absolute;inset:0}'
  +'.cn2 .wmk{position:absolute;inset:-30%;pointer-events:none;z-index:5;display:grid;grid-template-columns:repeat(3,1fr);align-content:space-around;transform:rotate(-28deg)}'
  +'.cn2 .wmk span{font-size:6.6cqw;font-weight:900;color:var(--wm2);white-space:nowrap;text-align:center;padding:5cqw 0;letter-spacing:.05em}.cn2-wrap.wmoff .cn2 .wmk{display:none}'
  +'.cn2 .top{position:relative;display:flex;justify-content:space-between;align-items:flex-start;gap:2cqw}'
  +'.cn2 .brand{font-family:var(--cn2d);font-weight:400;font-size:6.5cqw;letter-spacing:.02em;line-height:1;text-shadow:0 .6cqw 0 rgba(0,0,0,.35)}.cn2 .brand small{display:block;font-family:"Noto Sans KR",sans-serif;font-size:2.4cqw;font-weight:700;color:var(--gd);letter-spacing:.12em;margin-top:.8cqw;text-shadow:none}'
  +'.cn2 .card-no{font-size:2.6cqw;font-weight:900;letter-spacing:.2em;color:var(--gd);border:.4cqw solid var(--gd);padding:.8cqw 1.6cqw;border-radius:1cqw;white-space:nowrap}'
  +'.cn2 .eyebrow{position:relative;margin-top:7cqw;font-size:3.4cqw;font-weight:900;color:var(--gd);letter-spacing:.04em;text-shadow:0 .4cqw 0 rgba(0,0,0,.45)}'
  +'.cn2.hasviz .eyebrow,.cn2.pick .eyebrow,.cn2.last .eyebrow{margin-top:4.5cqw}'
  +'.cn2 .ttl{position:relative;font-family:var(--cn2d);font-weight:400;font-size:12.5cqw;line-height:1.05;margin-top:1.2cqw;letter-spacing:-.01em;color:#fff;-webkit-text-stroke:.5cqw var(--b2);paint-order:stroke fill;text-shadow:0 1.2cqw 0 var(--b2),0 1.6cqw 2cqw rgba(0,0,0,.35)}'
  +'.cn2 .ttl .red{color:var(--rd)}.cn2 .ttl .gold{color:var(--gd)}'
  +'.cn2 .viz{position:relative;margin-top:3cqw;height:25cqw;flex:0 0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:minmax(0,1fr);gap:3cqw;align-items:center;background:rgba(0,0,0,.34);border:.3cqw solid rgba(255,255,255,.16);border-radius:2cqw;padding:2cqw 3cqw;box-sizing:border-box}'
  +'.cn2 .viz.one{grid-template-columns:minmax(0,1fr)}'
  +'.cn2 .viz .ch{height:100%;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center}.cn2 .viz .ch svg{height:100%;width:auto;max-width:100%;display:block}'
  +'.cn2 .big{text-align:center;min-width:22cqw}.cn2 .big b{display:block;font-family:var(--cn2d);font-weight:400;font-size:13cqw;line-height:1;color:var(--gd);-webkit-text-stroke:.35cqw var(--b2);paint-order:stroke fill;text-shadow:0 .8cqw 0 var(--b2);white-space:nowrap}'
  +'.cn2 .big b small{font-size:5cqw}.cn2 .big span{display:block;font-size:2.8cqw;font-weight:800;color:#fff;margin-top:1.2cqw;white-space:nowrap}'
  +'.cn2 .tl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2cqw;height:100%}.cn2 .tl div{display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(255,255,255,.08);border-radius:1.6cqw;min-width:0}'
  +'.cn2 .tl b{font-family:var(--cn2d);font-weight:400;font-size:10cqw;line-height:1;color:#fff}.cn2 .tl b.g{color:var(--gd)}.cn2 .tl b.r{color:var(--rd)}.cn2 .tl span{font-size:2.6cqw;font-weight:800;color:rgba(255,255,255,.88);margin-top:1.2cqw;white-space:nowrap}'
  +'.cn2 .vb{height:100%;width:100%;display:flex;align-items:flex-end;justify-content:center;gap:2cqw}.cn2 .vb .c{flex:1;max-width:12cqw;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:0}'
  +'.cn2 .vb i{display:block;width:100%;border-radius:1cqw 1cqw 0 0}.cn2 .vb em{font-style:normal;font-size:3.6cqw;font-weight:900;color:#fff;line-height:1.1}.cn2 .vb span{font-size:2.5cqw;font-weight:800;color:rgba(255,255,255,.9);margin-top:.6cqw;text-align:center;line-height:1.1}'
  +'.cn2 .hb{width:100%;display:grid;gap:1.4cqw}.cn2 .hb .r{display:grid;grid-template-columns:auto minmax(6cqw,1fr) auto;gap:1.6cqw;align-items:center;font-size:2.8cqw;font-weight:800;color:#fff}'
  +'.cn2 .hb .bar{height:2.4cqw;background:rgba(255,255,255,.15);border-radius:1cqw;overflow:hidden}.cn2 .hb .bar i{display:block;height:100%}.cn2 .hb b{font-size:3.4cqw}'
  +'.cn2 .mp{height:100%;width:100%;display:grid;gap:.8cqw;grid-auto-rows:minmax(0,1fr)}.cn2 .mp b{display:flex;align-items:center;justify-content:center;border-radius:.8cqw;font-size:3cqw;font-weight:900;color:#fff;position:relative;min-width:0}'
  +'.cn2 .mp b i{position:absolute;top:.6cqw;right:.6cqw;width:1.6cqw;height:1.6cqw;border-radius:50%;background:#ffd34d}'
  +'.cn2 .kw{position:relative;margin-top:3cqw;display:flex;flex-wrap:wrap;gap:1.4cqw}.cn2 .kw span{background:rgba(0,0,0,.3);border:.3cqw solid var(--gd);color:#fff;font-size:3.2cqw;font-weight:900;padding:1cqw 2cqw;border-radius:5cqw;white-space:nowrap}.cn2 .kw span.hit{background:var(--rd);border-color:var(--rd)}'
  +'.cn2 .list{position:relative;margin-top:auto;background:var(--pn);color:var(--ink);border-radius:2cqw;padding:3.2cqw 3.6cqw;display:flex;flex-direction:column;gap:2cqw;transform:rotate(-1.5deg);box-shadow:0 2cqw 4cqw rgba(0,0,0,.3)}'
  +'.cn2.hasviz .viz,.cn2 .kw{margin-bottom:3cqw}'
  +'.cn2.hasviz .ribbon,.cn2.last .ribbon{top:74%}.cn2.hasviz .ribbon2,.cn2.last .ribbon2{top:80%}'   /* 그래프 칸을 가로지르지 않게 흰 패널 뒤로 */
  +'.cn2 .li{display:grid;grid-template-columns:5cqw 1fr;gap:2cqw;align-items:start;font-size:3.6cqw;font-weight:800;line-height:1.3}'
  +'.cn2 .li i{display:inline-block;width:4.4cqw;height:4.4cqw;border-radius:1cqw;background:var(--rd);color:#fff;font-style:normal;font-size:3.2cqw;text-align:center;line-height:4.4cqw;font-weight:900}.cn2 .li b{color:#d81e2c}'
  +'.cn2.pick .list{flex:1 1 auto;min-height:0;margin-top:3cqw}'
  +'.cn2 .pk{display:grid;grid-template-columns:20cqw minmax(0,1fr);gap:2.4cqw;flex:1 1 auto;min-height:0}'
  +'.cn2 .pk .no{display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--rd);color:#fff;border-radius:1.6cqw;padding:1cqw}.cn2 .pk .no b{font-family:var(--cn2d);font-weight:400;font-size:12cqw;line-height:1}.cn2 .pk .no span{font-size:2.6cqw;font-weight:900;margin-top:.8cqw;white-space:nowrap}'
  +'.cn2 .pk figure{margin:0;position:relative;overflow:hidden;border-radius:1.2cqw;background:#eef2f7;min-height:0;display:flex}.cn2 .pk img{width:100%;height:100%;object-fit:contain;object-position:top}.cn2 .pk img.blur{filter:blur(.9cqw) saturate(.6)}'
  +'.cn2 .pk .bl{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(15,23,42,.82);color:#fff;font-size:2.4cqw;font-weight:900;padding:1cqw 1.8cqw;border-radius:1cqw;max-width:86%;text-align:center;line-height:1.3}'
  +'.cn2 .slogan{position:relative;margin-top:3.5cqw;text-align:center;font-size:3.1cqw;font-weight:900;color:var(--ink);background:var(--gd);padding:1.6cqw;border-radius:1cqw;letter-spacing:.02em;line-height:1.3}'
  +'.cn2 .foot{position:relative;display:flex;justify-content:space-between;margin-top:2.4cqw;font-size:2cqw;color:rgba(255,255,255,.62);letter-spacing:.14em}'
  /* 1:1 — 위아래가 짧아서 여백·간격을 줄인다 */
  +'.cn2-wrap.s11 .cn2 .eyebrow{margin-top:2.6cqw}.cn2-wrap.s11 .cn2 .ttl{font-size:12cqw;line-height:1}'
  +'.cn2-wrap.s11 .cn2 .viz{height:17cqw;margin-top:2cqw;padding:1.4cqw 2.4cqw}.cn2-wrap.s11 .cn2 .big b{font-size:10cqw}.cn2-wrap.s11 .cn2 .big span{margin-top:.6cqw}.cn2-wrap.s11 .cn2 .tl b{font-size:7.5cqw}'
  +'.cn2-wrap.s11 .cn2 .hb{gap:.5cqw}.cn2-wrap.s11 .cn2 .hb .r{font-size:2.5cqw;line-height:1.1}.cn2-wrap.s11 .cn2 .hb b{font-size:2.8cqw}.cn2-wrap.s11 .cn2 .hb .bar{height:1.8cqw}'
  +'.cn2-wrap.s11 .cn2 .list{padding:2.2cqw 3.2cqw;gap:1cqw}.cn2-wrap.s11 .cn2 .slogan{margin-top:2.2cqw;padding:1.2cqw}.cn2-wrap.s11 .cn2 .foot{margin-top:1.6cqw}.cn2-wrap.s11 .cn2 .kw{margin-top:2cqw;gap:1cqw}'
  +'.cn2-wrap.s11 .cn2.pick .list{margin-top:2cqw}.cn2-wrap.s11 .cn2 .ribbon{top:48%}.cn2-wrap.s11 .cn2 .ribbon2{top:55%}.cn2-wrap.s11 .cn2.hasviz .ribbon,.cn2-wrap.s11 .cn2.last .ribbon{top:70%}.cn2-wrap.s11 .cn2.hasviz .ribbon2,.cn2-wrap.s11 .cn2.last .ribbon2{top:77%}'
  /* 설정 칸 */
  +'.cn2-opts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 8px}'
  +'.cn2-lab{display:flex;align-items:center;gap:8px;margin-bottom:4px}.cn2-lab .cn-chip{padding:2px 8px;font-size:11.5px}'
  +'.cn2-pick{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 6px;padding:6px;background:#f1f5f9;border-radius:8px}'
  +'.cn2-pk{border:2px solid #e2e8f0;background:#fff;border-radius:6px;padding:2px;cursor:pointer;width:46px;height:56px}.cn2-pk.on{border-color:#1d4ed8;box-shadow:0 0 0 2px #1d4ed8}.cn2-pk img{width:100%;height:100%;object-fit:cover;border-radius:4px;display:block}'
  +'.cn2-bgbox{border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 10px;margin:0 0 10px;background:#fbfcfe}.cn2-bgt{border:none;background:none;font-family:inherit;font-size:13.5px;font-weight:900;color:#0d2240;cursor:pointer;padding:4px 0;text-align:left}'
  +'.cn2-bgin{padding:4px 0 6px}.cn2-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.cn2-msg{margin-top:6px;font-size:12.5px;font-weight:800;color:#0d2240;background:#eef4ff;border-radius:8px;padding:6px 9px}'
  +'.cn2-gen{display:grid;grid-template-columns:150px 1fr;gap:10px;margin:8px 0;padding:8px;background:#fff7e6;border-radius:10px}.cn2-gen img{width:150px;border-radius:6px;display:block}'
  +'.cn2-ths{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}.cn2-th{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:4px;display:grid;gap:4px}'
  +'.cn2-th img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:5px;display:block;background:#0f172a}.cn2-th .src{position:absolute;left:8px;top:8px;background:rgba(15,23,42,.8);color:#fff;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:999px}'
  +'.cn2-th div{display:flex;gap:4px;flex-wrap:wrap}.cn2-th .cn-chip{font-size:11px;padding:2px 7px}';
  document.head.appendChild(st);
}

/* ── 내려받기 (새 스타일): 고른 크기로 PNG + 블로그자료.md → zip ── */
window.cnExport=(function(o){ return function(){ if(CN.style==='v1') return o.apply(this, arguments); return cn2Export(); }; })(window.cnExport);
async function cn2Export(){
  var d=HT.data[HT.cur]; if(!d||CN.busy) return;
  var c=cnCfg(d), W=1080, H=CN.size==='11'?1080:1350;
  try{
    CN.busy='준비 중'; render();
    if(typeof html2canvas==='undefined') await _mrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if(typeof JSZip==='undefined') await _mrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    cn2EnsureCss(); if(!CN.bgIdx) await cn2BgLoad();
    var cards=cn2Cards(d), zip=new JSZip();
    /* 학원앱의 화면 줌이 닿지 않는 따로 된 틀(iframe)에서 1080px 로 그린다 (v19-80 과 같은 방법) */
    var fr=document.createElement('iframe'); fr.setAttribute('aria-hidden','true');
    fr.style.cssText='position:fixed;left:-20000px;top:0;width:'+W+'px;height:'+H+'px;border:0;zoom:1';
    document.documentElement.appendChild(fr);
    var css=((document.getElementById('cn-css')||{}).textContent||'')+((document.getElementById('cn2-css')||{}).textContent||'');
    var fd=fr.contentDocument; fd.open();
    fd.write('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="'+CN2_FONT_URL_ALL+'"><style>html,body{margin:0;padding:0;background:transparent}'+css+'</style></head><body><div id="h" class="'+cn2WrapCls(c)+'" style="display:block;width:'+W+'px;'+cn2PalVars(c.pal)+'"></div></body></html>');
    fd.close();
    await new Promise(function(r){ if(fd.readyState==='complete') r(); else fr.onload=function(){ r(); }; setTimeout(r,4000); });
    var host=fd.getElementById('h');
    for(var i=0;i<cards.length;i++){
      CN.busy='카드 '+(i+1)+'/'+cards.length; var b=document.querySelector('#cn-panel .ht-btn.pri'); if(b) b.textContent='⏳ '+CN.busy;
      host.innerHTML=cards[i].html;
      var imgs=host.querySelectorAll('img');
      for(var j=0;j<imgs.length;j++){ var im=imgs[j]; try{ var du=await cnToDataUrl(im.getAttribute('src')); if(im.getAttribute('data-blur')){ du=await cnMosaic(du); im.classList.remove('blur'); } im.src=du; await new Promise(function(r){ if(im.complete) r(); else { im.onload=r; im.onerror=r; } }); }catch(e){ im.removeAttribute('src'); } }
      /* 글꼴: 제목 글꼴을 확실히 받은 뒤 그린다 (첫 장은 0.3초 더 기다림) */
      try{ if(fd.fonts&&fd.fonts.load){ await Promise.all([fd.fonts.load('400 120px "Black Han Sans"','루멘수학 0123'), fd.fonts.load('400 120px "Do Hyeon"','루멘수학 0123'), fd.fonts.load('900 40px "Noto Sans KR"','루멘수학')]); } }catch(e){}
      try{ if(fd.fonts&&fd.fonts.ready) await fd.fonts.ready; }catch(e){}
      await new Promise(function(r){ setTimeout(r, i===0?300:60); });
      var cv=await html2canvas(host.firstChild, { scale:1, useCORS:true, backgroundColor:null, logging:false, width:W, height:H, windowWidth:W, windowHeight:H });
      var blob=await new Promise(function(r){ cv.toBlob(r,'image/png'); });
      zip.file(cards[i].file+'.png', blob);
    }
    fr.remove();
    var md=cnMd(d, cards), note='> - 카드 스타일: 새 스타일(디자인 2판) · 제목 글꼴 '+(CN.font==='dohyeon'?'부드러운 글꼴(Do Hyeon)':'굵은 글꼴(Black Han Sans)')+' · '+W+'×'+H+' · 색 「'+cn2Pal(c.pal).n+'」';
    var mi=md.indexOf('\n\n## 제목 후보'); md=mi>=0?(md.slice(0,mi)+'\n'+note+md.slice(mi)):(md+'\n'+note);
    zip.file('블로그자료.md', md);
    CN.busy='묶는 중';
    var z=await zip.generateAsync({ type:'blob' }), e=d.exam||{};
    var a=document.createElement('a'); a.href=URL.createObjectURL(z); a.download='카드뉴스_'+e.school+'_'+e.grade+'_'+e.year+'_'+e.semester+'학기'+e.term+(CN.size==='11'?'_정사각':'')+'.zip'; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
    c.exportedAt=new Date().toISOString(); cnSave(d, true);
    CN.busy=''; htToast('🖼 카드 '+cards.length+'장('+W+'×'+H+') + 블로그자료.md 를 내려받았습니다'); render();
  }catch(err){ CN.busy=''; render(); htToast('카드 만들기 실패: '+(err&&err.message||err)); }
}
