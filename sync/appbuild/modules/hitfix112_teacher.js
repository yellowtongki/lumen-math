/* ═══════════════════════════════════════════════════════════════════
 * v19-112: 🎯 적중 분석 안에 «📚 교과서 일치» · 난이도 = 수학비서 1~9 (시험 전체 난이도 exam.msLv 로도)
 * 원장 지적 2026-10-12: 「교과서 일치는 적중분석 내부에 있어야 한다. 잘 보이게 표시하고, 난이도를 수학비서 난이도 9로 하라고 했는데
 *   왜 5인가? 그리고 옥길중에 교과서 일치 여부는 표시가 안 되었다.」
 *  [까닭 1] v19-108 은 문항마다 수학비서 난이도(it.diff)가 절반 이상 있어야 «/9» 로 바꿨다. 옥길중 중1·중3 은 문항에 diff 가 비어 있고
 *           (매쓰플랫이 서술형을 (1)(2) 로 나눠 문항 수 23·22 ≠ 수학비서 20) 시험 전체 난이도 exam.msLv(20개)만 있어 «/5» 로 남았다.
 *  [까닭 2] 「📚 출판사 교과서 출처」 칸이 요약 카드 맨 아래(출제 경향 뒤, 단추 줄 바로 위)에 붙어 있었다 — 지난 기출 칸이 없는
 *           옥길중은 «우리 자료별 적중» · 출제 경향 아래로 밀려 눈에 띄지 않았다. 교과서일치도는 메뉴의 다른 화면이었다.
 *  [고침]
 *   ① 난이도: 문항 diff 가 없으면 exam.msLv(수학비서 시험 전체) 로 평균·킬러(6↑)·어려움(5↑) «/9».
 *      둘 다 없으면(수학비서 DB화 전 — PDF 로 올린 시험) «/5» 그대로 두되 「평균 난도 (매쓰플랫 1~5 · 수학비서 DB화 전)」 로 까닭을 적는다.
 *   ② 요약 숫자 칸 줄에 「📚 교과서 일치」 칸(초록 굵은 테두리) — 같은 문제·숫자변형 문항 수 · 「학교 교과서 a · 다른 출판사만 b」 · 누르면 아래 칸으로
 *   ③ 「📚 교과서 일치 (같은 문제 + 숫자변형)」 칸을 도넛·숫자 칸 바로 아래로(「우리 자료별 적중」·지난 기출보다 위) · 학교 교과서 줄에 「학교 교과서」 표 ·
 *      「학교 교과서엔 없음」 줄(다른 출판사에서만 나온 문항 번호)
 *   ④ 메뉴의 「교과서일치도」 칸을 빼고 적중 분석 머리 단추 「📚 교과서일치도 · 학교 전체 비교」 로 · 교과서일치도 화면 맨 위 「← 적중 분석」
 *   ⑤ 시험 칩(가운데)·왼쪽 시험 목록에 출판사 비교를 마친 시험은 「📚」
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hit · msdiff · pubsrc · tbmatch · layout3)의 함수를 감싸기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var H112 = { booksKick:false, booksDone:false, pubKick:false, pubIdx:null };
var H112_NOMS = '매쓰플랫 1~5 · 수학비서 DB화 전';

/* ── ① 난이도: 문항 diff 가 모자라면 시험 전체 수학비서 난이도(exam.msLv) ── */
function h112MsLv(d){
  var L=d && d.exam && d.exam.msLv; if(!Array.isArray(L)) return null;
  var xs=L.map(function(x){ return (x==null || x==='') ? null : Number(x); }).filter(function(x){ return x!=null && !isNaN(x) && x>0; });
  if(!xs.length) return null;
  var sum=xs.reduce(function(a, b){ return a+b; }, 0);
  return { avg:Math.round(sum/xs.length*10)/10, kill:xs.filter(function(x){ return x>=MSD_KILL; }).length, hard:xs.filter(function(x){ return x>=MSD_HARD; }).length, n:xs.length, src:'msLv' };
}
msdInfo=(function(o){ return function(d){ var m=o(d); return m ? m : h112MsLv(d); }; })(msdInfo);

/* ── 학교 교과서 · 교과서 일치 세기 (교과서일치도 화면과 같은 셈: tbmOwn · tbmCalc) ── */
function h112BooksKick(){
  if(H112.booksKick) return; H112.booksKick=true;
  if(typeof TBM!=='undefined' && TBM.books){ H112.booksDone=true; return; }
  htKv('mf_textbooks').then(function(v){ if(typeof TBM!=='undefined' && !TBM.books) TBM.books=v||{}; H112.booksDone=true; if(VIEW==='examhit') render(); })
    .catch(function(){ H112.booksDone=true; if(VIEW==='examhit') render(); });
}
function h112Calc(d){
  var e=d.exam||{}, P=d.stats.pub||{};
  var x={ id:d.examId, d:d, school:String(e.school||''), grade:String(e.grade||''), subject:String(P.subject||e.subject||'') };
  var c=null; try{ c=tbmCalc(x); }catch(err){ c=null; }
  return c;
}
function h112Info(d){
  var S=pbStats(d), c=h112Calc(d), ready=H112.booksDone || (typeof TBM!=='undefined' && !!TBM.books);
  return { items:S.items, total:htVisible(d).length, c:c, ready:ready, own:(c&&ready)?c.own:[] };
}

/* 시험마다 출판사 비교를 마쳤나 (칩 📚) — 가벼운 한 번 읽기(stats.pub.subject 만), 안 되면 불러온 시험만 */
function h112PubKick(){
  if(H112.pubKick) return; H112.pubKick=true;
  try{
    var sb=htSb(); if(!sb) return;
    var q=sb.from('lumen_store').select('key,subj:value->stats->pub->>subject'); if(!q || typeof q.like!=='function') return;
    Promise.resolve(q.like('key', 'exam_hit_%')).then(function(r){
      if(!r || r.error || !Array.isArray(r.data)) return;
      var m={}; r.data.forEach(function(x){ if(x && x.key && x.subj) m[String(x.key).replace(/^exam_hit_/, '')]=String(x.subj); });
      H112.pubIdx=m; if(VIEW==='examhit') render();
    }).catch(function(){});
  }catch(e){}
}
function h112HasPub(id){
  var d=HT.data[id]; if(d) return pbHas(d);
  return !!(H112.pubIdx && H112.pubIdx[id]);
}

/* ── ②③ 요약 칸 ── */
function h112Tile(d){
  var I=h112Info(d), c=I.c, sm;
  if(!I.ready) sm='학교 교과서 확인 중…';
  else if(!I.own.length) sm='학교 교과서 모름 · 어느 교과서든 '+I.items;
  else sm='학교 교과서 <strong data-tb112-own="1" style="font-size:12px;font-weight:900">'+c.ownHit+'</strong> · <span style="font-size:inherit;color:#c2410c;font-weight:800">다른 출판사만 <strong data-tb112-only="1" style="font-size:12px;font-weight:900">'+c.only.length+'</strong></span>';   /* .ht-tile b 는 큰 글씨라 strong */
  return '<div class="ht-tile" id="tb112-tile" role="button" tabindex="0" onclick="h112GoPb()" onkeydown="if(event.key===\'Enter\')h112GoPb()" title="아래 「📚 교과서 일치」 칸으로 — 같은 문제 + 숫자변형만 셉니다"'
    +' style="border:2px solid #16a34a;background:#f0fdf4;cursor:pointer;box-shadow:0 1px 0 #bbf7d0">'
    +'<b style="color:#166534" data-tb112-n="1">'+I.items+'<small style="font-size:12px;color:#64748b">/'+I.total+'</small></b><span style="color:#14532d;font-weight:900">📚 교과서 일치</span>'
    +'<small style="display:block;font-size:10.5px;color:#166534;font-weight:700;line-height:1.35">'+sm+'</small></div>';
}
/* 문자열 h 안에서 idAttr 가 붙은 <div …> 의 시작·끝 */
function h112DivRange(h, idAttr){
  var i=h.indexOf(idAttr); if(i<0) return null;
  var j=h.lastIndexOf('<div', i), depth=0, re=/<div\b|<\/div>/g, m; re.lastIndex=j;
  while((m=re.exec(h))){ depth+=m[0]==='</div>'?-1:1; if(depth===0) return [j, m.index+6]; }
  return null;
}
function h112PbDress(blk, d){
  var I=h112Info(d), c=I.c, own=I.own;
  blk=blk.replace('<div id="pb-block" style="margin-top:12px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">',
    '<div id="pb-block" style="margin-top:12px;padding:12px 14px;background:#f0fdf4;border:2px solid #22c55e;border-radius:12px">');
  blk=blk.replace('<div class="ht-h" style="margin:0;flex:1;min-width:220px">📚 출판사 교과서 출처 <span class="ht-sub" style="font-weight:700">— ',
    '<div class="ht-h" id="pb-head" style="margin:0;flex:1;min-width:220px;font-size:15.5px;color:#14532d">📚 교과서 일치 (같은 문제 + 숫자변형) <span class="ht-sub" style="font-weight:700;font-size:11.5px">— ');
  /* 한 줄 요약 — 머리 바로 아래 */
  var line='<div id="pb-sum" style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline;margin:2px 0 8px;font-size:13px;font-weight:800;color:#14532d">';
  if(!I.ready) line+='<span>학교 교과서 확인 중…</span>';
  else if(own.length) line+='<span>학교 교과서(<b style="color:#1d4ed8">'+htEsc(own.join('·'))+'</b>)와 일치 <b style="font-size:16px">'+c.ownHit+'</b>문항</span>'
    +'<span style="color:#c2410c">학교 교과서엔 없고 다른 출판사에서만 <b style="font-size:16px">'+c.only.length+'</b>문항</span>';
  else line+='<span>학교 교과서 <b>모름</b> <small class="ht-sub">(그 학교·학년 학생에게 배정된 교과서가 없습니다)</small></span>';
  line+='<span class="ht-sub">어느 교과서든 '+I.items+' / '+I.total+'문항</span></div>';
  var hi=blk.indexOf('<table'), hk=blk.lastIndexOf('</div>', hi);
  var topEnd=blk.indexOf('</button></div>');   /* 머리 줄(제목 + 「출판사 비교만 다시」) 끝 */
  if(topEnd>=0 && (hi<0 || topEnd<hi)){ topEnd+='</button></div>'.length; blk=blk.slice(0, topEnd)+line+blk.slice(topEnd); }
  else if(hk>=0) blk=blk.slice(0, hk+6)+line+blk.slice(hk+6);
  /* 학교 교과서 줄 표시 */
  own.forEach(function(pb){
    var a='<tr data-pbpub="'+htEsc(pb)+'" style="', i=blk.indexOf(a); if(i<0) return;
    blk=blk.slice(0, i)+'<tr data-pbpub="'+htEsc(pb)+'" data-pbown="1" style="box-shadow:inset 3px 0 0 #2563eb;'+blk.slice(i+a.length);
    var j=blk.indexOf('</td>', i); if(j<0) return;
    blk=blk.slice(0, j)+' <small class="pb-owntag" style="display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:6px;padding:1px 5px;font-size:10.5px;font-weight:800">학교 교과서</small>'+blk.slice(j);
  });
  /* 학교 교과서엔 없음 */
  var only='<div id="pb-only" style="margin-top:8px;padding:7px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;font-size:12px;color:#9a3412;font-weight:700;line-height:1.7">'
    +'<b style="color:#c2410c">🟧 학교 교과서엔 없음</b> ';
  if(!I.ready) only+='<span class="ht-sub">학교 교과서 확인 중…</span>';
  else if(!own.length) only+='<span class="ht-sub">학교 교과서를 몰라 셀 수 없습니다</span>';
  else if(!c.only.length) only+='— 없음 (일치한 문항이 모두 학교 교과서 '+htEsc(own.join('·'))+'에도 있습니다)';
  else only+='— '+c.only.length+'문항: '+c.only.map(function(o){ return '<a href="javascript:void(0)" data-pbonly="'+o.n+'" onclick="pbGo('+o.n+')" style="color:#c2410c;font-weight:900">'+o.n+'번</a>('+htEsc(o.pubs.join('·'))+')'; }).join(' · ');
  only+='</div>';
  var fn=blk.indexOf('<div class="ht-sub" style="font-size:11px;margin-top:6px">한 문항이 여러 출판사');
  if(fn>=0) blk=blk.slice(0, fn)+only+blk.slice(fn);
  else { var e=blk.lastIndexOf('</div>'); blk=blk.slice(0, e)+only+blk.slice(e); }
  return blk;
}
htSummaryHtml=(function(o){ return function(d){
  var h=o(d);
  /* ① 수학비서 난이도가 전혀 없을 때 — 까닭을 적는다 */
  if(!msdInfo(d)){
    h=h.split('<small style="font-size:12px;color:#94a3b8">/5</small></b><span>평균 난도</span>').join('<small style="font-size:12px;color:#94a3b8">/5</small></b><span>평균 난도 ('+H112_NOMS+')</span>')
      .split('☠ 킬러 (난도 4·5)').join('☠ 킬러 (매쓰플랫 난도 4·5 · 수학비서 DB화 전)');
  }
  if(!pbHas(d)) return h;
  h112BooksKick();
  /* ② 숫자 칸 — 총 문항 바로 뒤 */
  var tk='<span>총 문항</span></div>', ti=h.indexOf(tk);
  if(ti>=0){ ti+=tk.length; h=h.slice(0, ti)+h112Tile(d)+h.slice(ti); }
  /* ③ 교과서 일치 칸을 도넛·숫자 칸 바로 아래로 */
  var R=h112DivRange(h, 'id="pb-block"'); if(!R) return h;
  var blk=h112PbDress(h.slice(R[0], R[1]), d); h=h.slice(0, R[0])+h.slice(R[1]);
  var at=h.indexOf('<div id="hts-bykind"');
  if(at<0){ var mk='출처 = 매쓰플랫이 찾은 «가장 닮은 원본»의 종류 (근사치)</div></div></div></div>', mi=h.indexOf(mk); if(mi>=0) at=mi+mk.length; }
  if(at<0){ var pc=h112DivRange(h, 'id="pc-block"'); if(pc) at=pc[0]; }
  if(at<0) at=R[0];
  return h.slice(0, at)+blk+h.slice(at);
}; })(htSummaryHtml);
window.h112GoPb = function(){
  var el=document.getElementById('pb-block'); if(!el || !el.scrollIntoView) return;
  try{ el.scrollIntoView({ behavior:'smooth', block:'start' }); }catch(e){ el.scrollIntoView(); }
  try{ el.style.transition='box-shadow .3s'; el.style.boxShadow='0 0 0 4px #86efac'; setTimeout(function(){ el.style.boxShadow=''; }, 1200); }catch(e){}
};

/* ── ④ 메뉴에서 「교과서일치도」 빼기 → 적중 분석 머리 단추 · 교과서일치도 화면 「← 적중 분석」 ── */
(function(){
  try{
    var g=(GROUPS||[]).filter(function(x){ return x.key==='exams'; })[0]; if(!g) return;
    for(var i=g.subs.length-1; i>=0; i--){ if(g.subs[i] && g.subs[i].v==='tbmatch') g.subs.splice(i, 1); }
  }catch(e){ try{ console.error('[v19-112 메뉴]', e); }catch(_){} }
})();
/* 메뉴에 없어도 왼쪽 머리·제목은 「📝 시험·기출 › 📚 교과서일치도」 */
l3ViewTitle=(function(o){ return function(v){
  if(v==='tbmatch'){ var g=null; try{ g=(GROUPS||[]).filter(function(x){ return x.key==='exams'; })[0]||null; }catch(e){}
    return { grp:g?(g.icon+' '+g.label):'', name:'📚 교과서일치도' }; }
  return o.apply(this, arguments); }; })(l3ViewTitle);
window.h112OpenTbm = function(){
  GRP='exams'; try{ GRP_LAST.exams='examhit'; }catch(e){}
  try{ TBM.cur=''; TBM.hl=''; TBM.focus=null; }catch(e){}
  VIEW='tbmatch';
  try{ renderFuncTab(); }catch(e){ render(); }
  try{ var C=document.getElementById('CONTENT'); if(C) C.scrollTop=0; window.scrollTo(0, 0); }catch(e){}
};
window.h112BackToHit = function(){
  var g=(GROUPS||[]).filter(function(x){ return x.key==='exams'; })[0], gi=-1;
  if(g) g.subs.forEach(function(s, j){ if(s.v==='examhit') gi=j; });
  if(gi>=0) subGo('exams', gi); else { VIEW='examhit'; render(); }
  try{ if(HT.cur) htLoad(HT.cur); }catch(e){}
};
rTbMatch=(function(o){ return function(){
  var h=o.apply(this, arguments), mk='<div class="tbm-wrap">', i=h.indexOf(mk); if(i<0) return h;
  i+=mk.length;
  return h.slice(0, i)+'<div style="margin-bottom:10px"><button class="tbm-btn" id="tbm-tohit" onclick="h112BackToHit()">← 적중 분석</button></div>'+h.slice(i);
}; })(rTbMatch);

/* ── ⑤ 적중 분석 머리 단추 · 시험 칩 📚 ── */
rExamHit=(function(o){ return function(){
  var h=o.apply(this, arguments);
  h112PubKick();
  var rb='<button class="ht-btn" onclick="htReload()">🔄 새로고침</button>', i=h.indexOf(rb);
  if(i>=0){ i+=rb.length;
    h=h.slice(0, i)+'<button class="ht-btn" id="tb112-open" onclick="h112OpenTbm()" title="출판사 비교를 마친 모든 시험 — 시험 × 출판사 지도 · 학교 교과서에 없던 문항 · 다음 시험 대비 추천" style="background:#f0fdf4;border-color:#86efac;color:#166534;font-weight:900">📚 교과서일치도 · 학교 전체 비교</button>'+h.slice(i); }
  return h.replace(/(<button class="ht-chip[^"]*" onclick="htPick\('([^']*)'\)">)([\s\S]*?)(<\/button>)/g, function(all, a, id, txt, z){
    return h112HasPub(id) ? (a+txt+' <span class="tb112-mk" title="교과서 일치(출판사 비교) 있음" style="font-size:11px">📚</span>'+z) : all;
  });
}; })(rExamHit);
l3hExamLabel=(function(o){ return function(x){
  var h=o.apply(this, arguments), id=String((x&&x.examId)||'');
  return (id && h112HasPub(id)) ? h+' <span class="tb112-mk" title="교과서 일치(출판사 비교) 있음">📚</span>' : h;
}; })(l3hExamLabel);
