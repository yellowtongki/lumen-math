/* ═══════════════════════════════════════════════════════════════════
 * v19-109: 🔁 적중 분석 — 「지난 기출과 비교」 (같은 학교 지난 시험 문항과 그림으로)
 * 원장 요청 2026-10-11: 「범박고 분석 시 범박고 기출에서 나온 것도 확인할 수 있나? 기능을 추가하자. 소사고 분석 시는 소사고 기출과 비교.」
 *  [예전] «반복 출제»는 같은 학교·학년·학기·중간/기말 지난 시험에 «같은 유형 번호»가 있었는지 세기만 했다(그림 비교 없음).
 *  [이제] 서버(sync/exam_hit_worker.js pastCompare)가 문항마다 같은 학교·학년 지난 시험(기본 최근 4년 · 중간/기말 · 1/2학기 모두)
 *         문항 후보 3개를 골라 우리 자료와 같은 그림 판정(같은 문제 / 숫자변형 / 유사유형 / 지문만)을 한다.
 *         → it.past = [{ k:'past:<시험지id>:<번호>', exam:'2025 2학기 중간', year, sem, term, no, kind, why, img, imgUrl }] · stats.past
 *         우리 자료 적중률에는 들어가지 않는다(따로 센다).
 *  ① 결과 요약 칸 「반복 출제 (지난 기출)」 → 「🔁 <학교> 기출에서 n문항」(같은 문제 + 숫자변형, 작은 글씨로 유사유형 수)
 *  ② 「우리 자료별 적중」 아래 「🔁 <학교> 지난 기출과 비교」 — 문항마다 가장 닮은 지난 기출(연도 · 학기 · 시험 · 번호 · 등급), 누르면 그 문항 카드로
 *  ③ 문항 카드마다 「🔁 지난 기출」 줄 — 후보 3개 그림 + 등급 단추(✓ 확정 · ✗ 아님) → it.pastHit = { k, kind, ok } (서버가 다시 판정해도 남는다)
 *  ④ 요청 화면 · 다시 판정 화면: 「지난 기출 비교: 켜기/끄기 · 최근 n년(2/3/4/5) · 같은 시험만(중간/기말)」 → exam_hit_req.src.past
 *  ⑤ 학부모 보고서 · 블로그 자료(.md) · 카드뉴스 — 반복 출제 자리를 새 숫자로. 카드는 「기출」 낱말 없이 «지난 시험에서 다시 나온 문항»(연도 없음),
 *     .md·보고서는 «학교 기출»(문제 원문·그림 없음, 「수학비서」 낱말 없음)
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품의 함수를 감싸서 바꾼다. stats.past 가 없는 옛 결과는 예전 화면 그대로.
 * ═══════════════════════════════════════════════════════════════════ */
var PC_DEF = { on:true, years:4, sameTerm:false };
var PC_ORDER = { same:4, 'var':3, type:2, text:1 };
function pcHas(d){ return !!(d && d.stats && d.stats.past); }
function pcSchool(d){ return htSchoolKey((d && d.exam && d.exam.school) || ''); }
function pcNorm(p){ p=p||{}; var y=Number(p.years); return { on:p.on!==false, years:(y>=1&&y<=10)?Math.round(y):PC_DEF.years, sameTerm:!!p.sameTerm }; }
function pcSorted(it){ return (it.past||[]).filter(function(p){ return !p.rejected; }).sort(function(a,b){ return (PC_ORDER[b.kind]||0)-(PC_ORDER[a.kind]||0); }); }
/* 문항 하나의 «지난 기출» 결론 — 원장 확정 → 자동 1순위 */
function pcEff(it){
  var P=it.past||[], h=it.pastHit;
  if(h && h.ok===true && h.k){ var c=P.filter(function(x){ return x.k===h.k; })[0]; if(c) return { kind:h.kind||c.kind, k:h.k, p:c, sure:true }; }
  if(h && h.ok===false && !h.k) return { kind:'none', k:null, p:null, sure:true };
  var top=pcSorted(it)[0];
  return top ? { kind:top.kind, k:top.k, p:top, sure:false } : { kind:'none', k:null, p:null, sure:false };
}
function pcStats(d){
  var s={ same:0, 'var':0, type:0, text:0, items:0, any:0, sure:0, open:0 };
  htVisible(d).forEach(function(it){
    var e=pcEff(it); if(e.kind!=='none'){ s[e.kind]=(s[e.kind]||0)+1; s.any++; }
    if(e.kind==='same'||e.kind==='var') s.items++;
    if(e.sure) s.sure++; else if((it.past||[]).length) s.open++;
  });
  return s;
}
function pcWhere(p){ return p ? (p.year+' · '+p.sem+'학기 · '+p.term+' · '+(p.approx?'약 ':'')+p.no+'번') : ''; }
function pcShort(p){ return p ? (p.year+' '+p.sem+'학기 '+p.term+' '+(p.approx?'약 ':'')+p.no+'번') : ''; }
function pcImg(p){ return p ? (p.imgUrl || (p.img ? htSigned(p.img) : '')) : ''; }
function pcRange(d){
  var P=(d.stats&&d.stats.past)||{}, L=P.list||[], ys=L.map(function(x){ return Number(x.year); }).filter(function(y){ return y; });
  var y0=ys.length?Math.min.apply(null, ys):0, y1=ys.length?Math.max.apply(null, ys):0;
  return { n:P.exams!=null?P.exams:L.length, y0:y0, y1:y1, years:P.years||PC_DEF.years, sameTerm:!!P.sameTerm,
    txt:(y0?(y0===y1?(y0+'년'):(y0+'~'+y1+'년')):'')+(P.sameTerm?(' · '+((d.exam&&d.exam.term)||'')+'만'):' · 중간·기말') };
}

/* ── 그림 서명 — 서버가 적어 둔 1년 주소가 없으면 기출 DB 그림 경로로 ── */
htSignFor=(function(o){ return function(id){
  var d=HT.data[id], first=d && !HT.signedFor[id]; o(id);
  if(!first || !d || typeof eaSign!=='function') return;
  var paths=[]; (d.items||[]).forEach(function(it){ (it.past||[]).forEach(function(p){ if(p.img && !p.imgUrl) paths.push(p.img); }); });
  if(paths.length) eaSign(paths).then(function(){ if(VIEW==='examhit') render(); });
}; })(htSignFor);

/* ── ① 요약 칸 · ② 비교 칸 ── */
function pcTile(d){
  var s=pcStats(d), sc=pcSchool(d);
  return '<div class="ht-tile" id="pc-tile" style="border-color:#fcd34d;background:#fffbeb" title="같은 학교 지난 시험 문항과 그림으로 비교 — 같은 문제 + 숫자변형 (우리 자료 적중률과 따로)"><b style="color:#92400e">'+s.items+'</b>'
    +'<span>🔁 '+htEsc(sc)+' 기출에서 '+s.items+'문항</span><small style="display:block;font-size:10.5px;color:#a16207;font-weight:700" data-pctype="'+s.type+'">유사유형 '+s.type+'</small></div>';
}
function pcBlockHtml(d){
  var s=pcStats(d), sc=pcSchool(d), R=pcRange(d);
  var h='<div id="pc-block" style="margin-top:12px;padding:10px 12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><div class="ht-h" style="margin:0;flex:1;min-width:220px">🔁 '+htEsc(sc)+' 지난 기출과 비교 <span class="ht-sub" style="font-weight:700">— 같은 학교 지난 시험 '+R.n+'장'+(R.txt?(' ('+htEsc(R.txt)+')'):'')+'과 문항 그림 비교 · 우리 자료 적중률과 따로 셉니다</span></div>'
    +(typeof htsRejOpen==='function'?'<a href="javascript:void(0)" id="pc-range" onclick="htsRejOpen()" style="color:#92400e;font-size:11.5px;font-weight:900;text-decoration:underline">비교 범위 바꾸기</a>':'')+'</div>';
  if(!R.n) return h+'<div class="ht-sub">비교할 '+htEsc(sc)+' 지난 시험이 없습니다 — 기출 DB 에 이 학교·학년 지난 시험지가 없거나, 아직 유형 번호가 붙지 않았습니다.</div></div>';
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:6px" class="ht-sub">'
    +['same','var','type','text'].map(function(k){ return '<span>'+htPill(k,false)+' <b data-pck="'+k+'">'+(s[k]||0)+'</b></span>'; }).join('')
    +'<span>확정 <b style="color:#15803d">'+s.sure+'</b>'+(s.open?(' · 확인 안 한 것 <b style="color:#b45309">'+s.open+'</b>'):'')+'</span></div>';
  var rows=htVisible(d).map(function(it){ return { it:it, n:htNumOf(d,it), e:pcEff(it) }; }).filter(function(r){ return r.e.kind!=='none'; });
  rows.sort(function(a,b){ return (PC_ORDER[b.e.kind]||0)-(PC_ORDER[a.e.kind]||0) || a.n-b.n; });
  if(!rows.length) h+='<div class="ht-sub">이번 시험 문항 중 '+htEsc(sc)+' 지난 기출과 겹친 것이 없습니다.</div>';
  else {
    h+='<div style="display:grid;gap:4px">';
    rows.forEach(function(r){
      h+='<div class="pc-li" data-pcno="'+r.it.no+'" role="button" tabindex="0" onclick="pcGo('+r.it.no+')" onkeydown="if(event.key===\'Enter\')pcGo('+r.it.no+')" title="눌러서 '+r.n+'번 문항 카드로" style="display:grid;grid-template-columns:44px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;background:#fff;border:1px solid #fde68a;cursor:pointer;font-size:12px">'
        +'<b style="color:#0d2240;font-variant-numeric:tabular-nums">'+r.n+'번</b>'
        +'<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569;font-weight:700">'+htEsc(r.it.type||r.it.chapter||'')+'</span>'
        +'<span style="color:#92400e;font-weight:800;white-space:nowrap">'+htEsc(pcWhere(r.e.p))+'</span>'+htPill(r.e.kind, r.e.sure)+'</div>';
    });
    h+='</div>';
  }
  var none=htVisible(d).length-rows.length;
  return h+'<div class="ht-sub" style="font-size:11px;margin-top:6px">겹친 지난 기출 없음 '+none+'문항 · 「같은 문제 + 숫자변형」만 «'+htEsc(sc)+' 기출에서 다시 나온 문항»으로 셉니다 · 등급은 문항 카드의 「🔁 지난 기출」 줄에서 확정</div></div>';
}
htSummaryHtml=(function(o){ return function(d){
  var h=o(d); if(!pcHas(d)) return h;
  h=h.replace(/<div class="ht-tile"><b>\d+<\/b><span>반복 출제 \(지난 기출\)<\/span><\/div>/, pcTile(d));
  var blk=pcBlockHtml(d), i=h.indexOf('id="hts-bykind"'), mk='원장님 확정</div></div>';
  if(i>=0){ var j=h.indexOf(mk, i); if(j>=0){ j+=mk.length; return h.slice(0,j)+blk+h.slice(j); } }
  var k=h.indexOf('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center">');
  return k>=0 ? h.slice(0,k)+blk+h.slice(k) : h+blk;
}; })(htSummaryHtml);
/* 목록 줄을 누르면 그 문항 카드를 펼치고 「지난 기출」 줄로 */
window.pcGo = function(no){
  if(HT.view==='table') HT.open[no]=true; else { if(!HT.unfold) HT.unfold={}; HT.unfold[no]=true; HT.onlyOpen=false; }
  render();
  setTimeout(function(){ var el=document.getElementById('pc-it-'+no)||document.getElementById('ht-q-'+no); if(el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 30);
};

/* ── ③ 문항 카드 — 「🔁 지난 기출」 줄 ── */
function pcSegRow(it, p){
  var sel=it.pastHit&&it.pastHit.ok&&it.pastHit.k===p.k, cur=sel&&it.pastHit.kind?it.pastHit.kind:p.kind, ai=p.ai||p.kind;
  var seg=function(kind, label){ var on=sel&&cur===kind, k=HT_KIND[kind];
    return '<button data-pcseg="'+kind+'" onclick="pcSet('+it.no+',\''+p.k+'\',\''+kind+'\')" title="이 지난 기출을 「'+label+'」로 확정" style="flex:1;min-width:0;padding:5px 3px;font-size:11px;font-weight:900;font-family:inherit;cursor:pointer;border:1.5px '+(ai===kind&&!on?'dashed':'solid')+' '+(on||ai===kind?k.c:'#e2e8f0')+';background:'+(on?k.c:'#fff')+';color:'+(on?'#fff':k.c)+';border-radius:8px">'+(on?'✓ ':'')+label+(ai===kind&&!sel?' <small style="font-weight:700;opacity:.8">AI</small>':'')+'</button>'; };
  return '<div style="display:flex;gap:4px;margin-bottom:4px">'+seg('same','같은 문제')+seg('var','숫자변형')+seg('type','유사유형')+'</div>'
    +'<div style="display:flex;gap:4px">'+seg('text','지문만')+'<button data-pcseg="no" onclick="pcReject('+it.no+',\''+p.k+'\')" style="flex:1;padding:5px 3px;font-size:11px;font-weight:800;font-family:inherit;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:8px">✗ 아님</button></div>';
}
function pcCard(it, p){
  var sel=it.pastHit&&it.pastHit.ok&&it.pastHit.k===p.k, cur=sel&&it.pastHit.kind?it.pastHit.kind:p.kind, K=HT_KIND[cur]||HT_KIND.none, img=pcImg(p);
  return '<div class="pc-card" data-pck="'+htEsc(p.k)+'" style="border:'+(sel?'2px solid '+K.c:'1px solid #fde68a')+';border-radius:12px;background:#fff;overflow:hidden'+(p.rejected?';opacity:.5':'')+'">'
    +'<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid #fef3c7;background:#fffbeb"><b style="font-size:12px;color:#92400e">'+htEsc(pcWhere(p))+'</b>'
    +(p.idSame?'<span title="두 문항의 «가장 닮은 원본» 번호가 같음" style="font-size:10px;font-weight:800;color:#334155;background:#f1f5f9;padding:2px 6px;border-radius:6px">원본 번호 같음</span>':'')
    +'<span style="margin-left:auto;font-size:10.5px;font-weight:900;color:'+K.c+';background:'+K.bg+';padding:3px 8px;border-radius:6px;white-space:nowrap">'+K.t+(sel?' ✓':'')+'</span></div>'
    +'<div style="padding:8px">'+(img?'<img src="'+htEsc(img)+'" alt="'+htEsc(pcShort(p))+' 지난 기출 문항" onclick="htZoom(this.src)" style="width:100%;display:block;cursor:zoom-in">':'<div class="ht-sub" style="padding:24px 0;text-align:center">그림 없음</div>')+'</div>'
    +'<div class="ht-sub" style="padding:6px 10px;border-top:1px solid #f1f5f9;font-size:11.5px">'+(p.why?('<b style="color:#0f172a">AI</b> '+htEsc(p.why)):'')+(p.ai&&p.ai!==cur?(' <span style="color:#94a3b8">(AI는 '+(HT_KIND[p.ai]||{}).t+')</span>'):'')+(p.approx?' · <span title="기출 DB 문항 수와 유형 자료 문항 수가 달라 번호가 어긋날 수 있음">번호 추정</span>':'')+(p.rejected?' · ✗ 아님으로 표시':'')+'</div>'
    +'<div style="padding:0 10px 10px">'+pcSegRow(it,p)+'</div></div>';
}
function pcSection(d, it, W){
  var P=it.past||[], e=pcEff(it), sc=pcSchool(d);
  var h='<div id="pc-it-'+it.no+'" class="pc-sec" data-pcsec="'+it.no+'" style="margin-top:12px;padding-top:10px;border-top:1.5px dashed #fcd34d">'
    +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:12.5px;color:#92400e">🔁 지난 기출 ('+htEsc(sc)+')</b>'
    +'<span class="ht-sub" style="font-size:11px">우리 자료 적중률과 따로 셉니다</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
    +(e.kind!=='none'||e.sure?htPill(e.kind, e.sure):'')
    +(P.length?'<button class="ht-btn no" style="padding:4px 8px;font-size:11px" data-pcnone="'+it.no+'" onclick="pcNone('+it.no+')">✗ 겹침 없음</button>':'')
    +((it.pastHit||P.some(function(p){ return p.rejected; }))?'<button class="ht-btn no" style="padding:4px 8px;font-size:11px" data-pcundo="'+it.no+'" onclick="pcUndo('+it.no+')">↺ 풀기</button>':'')+'</span></div>';
  if(!P.length) return h+'<div class="ht-sub" style="font-size:11.5px">같은 유형의 '+htEsc(sc)+' 지난 기출이 없습니다.</div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax('+Math.min(W||300, 260)+'px,1fr));gap:10px;align-items:start">';
  P.slice(0,3).forEach(function(p){ h+=pcCard(it,p); });
  return h+'</div></div>';
}
htItemSheet=(function(o){ return function(d, it, n, e, W, b){
  var h=o(d, it, n, e, W, b); if(!pcHas(d)) return h;
  var pe=pcEff(it);
  h=h.replace(/<span class="ht-pill" style="background:#fef3c7;color:#92400e">반복 [^<]*<\/span>/, pe.kind!=='none'?('<span class="ht-pill" data-pcpill="'+it.no+'" style="background:#fef3c7;color:#92400e">🔁 '+htEsc(pcShort(pe.p))+' · '+(HT_KIND[pe.kind]||{}).t+'</span>'):'');
  var i=h.lastIndexOf('</div>'); return h.slice(0,i)+pcSection(d, it, W)+h.slice(i);
}; })(htItemSheet);
htItemDetail=(function(o){ return function(d, it, n){ var h=o(d, it, n); return pcHas(d) ? h+pcSection(d, it, 300) : h; }; })(htItemDetail);
htFoldedRow=(function(o){ return function(d, it, n, e){
  var h=o(d, it, n, e); if(!pcHas(d)) return h; var pe=pcEff(it); if(pe.kind==='none') return h;
  var mk='<span class="ht-sub" style="font-size:11px">▼ 펼치기</span>', i=h.lastIndexOf(mk); if(i<0) return h;
  return h.slice(0,i)+'<span class="ht-pill" data-pcfold="'+it.no+'" style="background:#fef3c7;color:#92400e">🔁 '+htEsc(pcShort(pe.p))+' · '+(HT_KIND[pe.kind]||{}).t+(pe.sure?' ✓':'')+'</span>'+h.slice(i);
}; })(htFoldedRow);

/* 확정 — 우리 자료 확정(htConfirm·htSetKind)과 같은 방식으로 저장 */
function pcFind(no, k){ var it=htItem(no); if(!it) return null; var p=(it.past||[]).filter(function(x){ return x.k===k; })[0]; return p ? { it:it, p:p } : null; }
window.pcSet = function(no, k, kind){
  var d=HT.data[HT.cur], f=pcFind(no, k); if(!d||!f||!HT_KIND[kind]) return;
  if(!f.p.ai) f.p.ai=f.p.kind; delete f.p.rejected;
  f.it.pastHit={ k:k, kind:kind, ok:true, by:'teacher', at:new Date().toISOString() };
  htSave(d); render();
};
window.pcReject = function(no, k){
  var d=HT.data[HT.cur], f=pcFind(no, k); if(!d||!f) return;
  if(!f.p.ai) f.p.ai=f.p.kind; f.p.rejected=true;
  if(f.it.pastHit && f.it.pastHit.k===k) delete f.it.pastHit;
  f.it.past.sort(function(a,b){ return (a.rejected?1:0)-(b.rejected?1:0); });
  htSave(d); render();
};
window.pcNone = function(no){
  var d=HT.data[HT.cur], it=htItem(no); if(!d||!it) return;
  it.pastHit={ k:null, kind:'none', ok:false, by:'teacher', at:new Date().toISOString() };
  htSave(d); render();
};
window.pcUndo = function(no){
  var d=HT.data[HT.cur], it=htItem(no); if(!d||!it) return;
  delete it.pastHit; (it.past||[]).forEach(function(p){ delete p.rejected; });
  htSave(d); render();
};

/* ── ④ 요청 화면 · 다시 판정 화면 — 「지난 기출 비교」 칩 → src.past ── */
htsOpen=(function(o){ return function(exam, opt){ HTS.past=pcNorm(PC_DEF); return o(exam, opt); }; })(htsOpen);
htsApplyCfg=(function(o){ return function(c){ o(c); if(c && c.past) HTS.past=pcNorm(c.past); }; })(htsApplyCfg);
hts2ApplySrc=(function(o){ return function(src){ o(src); if(src && src.past) HTS.past=pcNorm(src.past); }; })(hts2ApplySrc);
htsSrcValue=(function(o){ return function(){ var v=o(); v.past=pcNorm(HTS.past); return v; }; })(htsSrcValue);
htsCfgValue=(function(o){ return function(){ var v=o(); v.past=pcNorm(HTS.past); return v; }; })(htsCfgValue);
window.pcReq = function(k, v){
  var p=HTS.past=pcNorm(HTS.past);
  if(k==='on') p.on=!!v; else if(k==='years'){ p.years=pcNorm({ years:v }).years; p.on=true; } else if(k==='sameTerm'){ p.sameTerm=!p.sameTerm; p.on=true; }
  render();
};
function pcReqRow(){
  var p=HTS.past=pcNorm(HTS.past), e=HTS.exam||{}, sc=htSchoolKey(e.school||''), dim=p.on?'':';opacity:.45';
  return '<div class="ht-sub" id="pc-req" style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">🔁 지난 기출 비교 '
    +'<span class="hts-seg"><button id="pc-on" class="'+(p.on?'on':'')+'" onclick="pcReq(\'on\',1)">켜기</button><button id="pc-off" class="'+(p.on?'':'on')+'" onclick="pcReq(\'on\',0)">끄기</button></span>'
    +'<span style="display:inline-flex;gap:6px;align-items:center'+dim+'">· 최근 <span class="hts-seg">'+[2,3,4,5].map(function(y){ return '<button data-pcy="'+y+'" class="'+(p.years===y?'on':'')+'" onclick="pcReq(\'years\','+y+')">'+y+'년</button>'; }).join('')+'</span>'
    +'· <span class="hts-seg"><button id="pc-same" class="'+(p.sameTerm?'on':'')+'" onclick="pcReq(\'sameTerm\')">같은 시험만('+htEsc(e.term||'중간/기말')+')</button></span></span>'
    +'<span style="font-size:11px">'+(p.on?(htEsc(sc)+' 지난 시험 문항과 그림으로 비교 · 우리 자료 적중률과 따로 셉니다'):'지난 기출과 비교하지 않습니다 (예전 «반복 출제»만)')+'</span></div>';
}
htsPanelHtml=(function(o){ return function(){
  var h=o.apply(this, arguments); if(HTS.loading) return h;
  var mk='<div class="hts-panels">', i=h.indexOf(mk); if(i<0) return h;
  var j=h.lastIndexOf('<div class="ht-strip" id="hts-rej-info"', i); if(j>=0 && j<i) i=j;   /* 다시 판정 안내 띠 위에 */
  return h.slice(0,i)+pcReqRow()+h.slice(i); }; })(htsPanelHtml);

/* ── ⑤ 밖으로 나가는 글 — 블로그 자료(.md) · 학부모 보고서 · 카드뉴스 ── */
function pcRowsOut(d){
  return htVisible(d).map(function(it){ return { it:it, n:htNumOf(d,it), e:pcEff(it) }; }).filter(function(r){ return r.e.kind!=='none'; })
    .sort(function(a,b){ return (PC_ORDER[b.e.kind]||0)-(PC_ORDER[a.e.kind]||0) || a.n-b.n; });
}
var PC_OUT = { same:'똑같이', 'var':'숫자만 바뀌어', type:'같은 유형으로', text:'소재만 같게' };
htMd=(function(o){ return function(d){
  var t=o(d); if(!pcHas(d)) return t;
  var s=pcStats(d), sc=pcSchool(d), R=pcRange(d), L=t.split('\n'), rows=pcRowsOut(d);
  for(var i=0;i<L.length;i++){
    if(/^- 지난 같은 시험에서 같은 유형이 나온 문항\(반복 출제\): /.test(L[i])){
      L[i]='- '+sc+' 기출에서 다시 나온 문항: '+s.items+'문항 (똑같은 문제 '+s.same+' · 숫자만 바뀐 문제 '+s['var']+') · 같은 유형 '+s.type+'문항 — '+sc+' 지난 시험 '+R.n+'장('+R.txt+')과 문항을 하나씩 비교, 우리 자료 적중과 따로 셈'+(s.open?(' (확인 중 '+s.open+'문항 포함)'):'');
    } else if(/^## 반복 출제 유형/.test(L[i])){
      var j=i+1; while(j<L.length && L[j]!=='') j++;
      var body=rows.length ? rows.map(function(r){ return '- '+r.n+'번 '+(r.it.type||r.it.chapter||'')+' — '+sc+' '+r.e.p.year+'년 '+r.e.p.sem+'학기 '+r.e.p.term+'고사 '+(r.e.p.approx?'약 ':'')+r.e.p.no+'번과 '+(HT_KIND[r.e.kind]||{}).t+(r.e.sure?'':' (확인 중)'); })
        : ['- ('+sc+' 지난 시험과 겹친 문항 없음)'];
      L.splice.apply(L, [i, j-i, '## '+sc+' 기출과 비교 (지난 시험 '+R.n+'장 · '+R.txt+')', '- '+sc+' 기출에서 숫자만 바뀌어(또는 그대로) 다시 나온 문항 '+s.items+'개 · 같은 유형 '+s.type+'개. 우리 자료 적중률과는 다른 숫자이니 섞지 않는다.'].concat(body));
      break;
    }
  }
  t=L.join('\n');
  return t.replace('> - 「적중」의 기준을 글에 한 번 밝힌다:', '> - 「'+sc+' 기출에서 다시 나온 문항」은 우리 자료 적중과 다른 숫자다. 섞지 않는다.\n> - 「적중」의 기준을 글에 한 번 밝힌다:');
}; })(htMd);
function pcReportFix(d, h){
  if(!pcHas(d)) return h;
  var s=pcStats(d), sc=pcSchool(d), R=pcRange(d), rows=pcRowsOut(d), by={};
  rows.forEach(function(r){ by[r.n]=r; });
  var blk='<h2>'+htEsc(sc)+' 기출과 비교</h2><div>'+htEsc(sc)+' 지난 시험 '+R.n+'장('+htEsc(R.txt)+')의 문항과 이번 시험 문항을 하나씩 비교했습니다. '
    +'<b class="red">'+htEsc(sc)+' 기출에서 숫자만 바뀌어(또는 그대로) 다시 나온 문항 '+s.items+'개</b> (똑같은 문제 '+s.same+' · 숫자만 바뀐 문제 '+s['var']+') · 같은 유형 '+s.type+'개.'
    +(s.open?(' <span class="mut">(확인 중 '+s.open+'문항 포함)</span>'):'')+' <span class="mut">학원 자료 적중과는 따로 셉니다.</span></div>';
  var mk='<h2>문항 요약</h2>', i=h.indexOf(mk); if(i>=0) h=h.slice(0,i)+blk+h.slice(i);
  h=h.replace('<th>반복 출제</th>', '<th>'+htEsc(sc)+' 기출</th>');
  h=h.replace(/<tr><td><b>(\d+)<\/b>[\s\S]*?<\/tr>/g, function(row, n){
    var parts=row.split('</td>'); if(parts.length<6) return row; var r=by[Number(n)];
    parts[4]='<td>'+(r?htEsc(pcShort(r.e.p)+' · '+(HT_KIND[r.e.kind]||{}).t+(r.e.sure?'':' (확인 중)')):'');
    return parts.join('</td>'); });
  return h;
}
window.htPrint=(function(o){ return function(code){
  var d=HT.data[HT.cur], ow=window.open;
  window.open=function(){ var w=ow.apply(window, arguments); if(w && d){ try{ var doc=w.document, wr=doc.write.bind(doc); doc.write=function(x){ return wr(pcReportFix(d, String(x))); }; }catch(e){} } return w; };
  try{ return o(code); } finally { window.open=ow; } }; })(window.htPrint);
/* 카드뉴스 — 반복 출제 카드를 «지난 시험에서 다시 나온 문항»으로 (카드에는 「기출」 낱말 · 연도 없음) */
function pcCardPara(d){
  var s=pcStats(d), T=htVisible(d).length;
  return T+'문항 중 '+s.items+'문항이 지난 시험 문제와 같거나 숫자만 바뀌어 다시 나왔습니다'+(s.items?(' (똑같은 문제 '+s.same+' · 숫자만 바뀐 문제 '+s['var']+')'):'')+'. 같은 유형으로 다시 나온 문항은 '+s.type+'개입니다.';
}
function pcCardFacts(d){ return pcRowsOut(d).filter(function(r){ return r.e.kind!=='text'; }).map(function(r){ return r.n+'번 '+(r.it.type||'')+' — '+(PC_OUT[r.e.kind]||'')+' 다시 나옴'; }); }
if(typeof cnCards==='function') cnCards=(function(o){ return function(d){
  var out=o(d); if(!pcHas(d)) return out;
  var s=pcStats(d), T=htVisible(d).length, rows=pcRowsOut(d).filter(function(r){ return r.e.kind!=='text'; }), e=d.exam||{};
  out.forEach(function(x, i){
    if(!/_반복출제$/.test(x.file)) return;
    var foot=(e.school||'')+' '+String(e.grade||'').replace(/^[중고]/,'')+'학년 · 수학';
    var body='<div class="pn">'+(rows.length?'<table><tr><th>번호</th><th>유형</th><th style="text-align:center">다시 나온 모양</th></tr>'+rows.slice(0,12).map(function(r){ return '<tr><td><b>'+r.n+'</b></td><td>'+cnEsc(r.it.type||'')+'</td><td style="text-align:center"><b style="color:'+(r.e.kind==='type'?'#1f5fbf':'#d33a3a')+'">'+(HT_KIND[r.e.kind]||{}).t+'</b></td></tr>'; }).join('')+'</table>':'<p>지난 시험과 겹친 문항이 없습니다.</p>')+'</div>';
    x.html=cnCard(i+1, out.length, cnHead(d), '지난 시험에서<br><em>다시 나온 문항</em>', '같은 학교 지난 시험 문제와 하나씩 비교했습니다.', '시험은<br>반복된다', body,
      T+'문항 중 <em>'+s.items+'문항</em>이 다시 나왔습니다.', foot);
    x.para=pcCardPara(d); x.facts=pcCardFacts(d);
  });
  return out; }; })(cnCards);
if(typeof cn2Cards==='function') cn2Cards=(function(o){ return function(d){
  var out=o(d); if(!pcHas(d)) return out;
  var s=pcStats(d), rows=pcRowsOut(d).filter(function(r){ return r.e.kind!=='text'; }), E=cnEsc;
  out.forEach(function(x){
    if(!/_반복출제$/.test(x.file)) return;
    var bl=rows.length ? cn2Fit(rows.slice(0,3).map(function(r){ return '<b>'+r.n+'번</b> '+E(cn2Clip(r.it.type||'',12))+' · '+(HT_KIND[r.e.kind]||{}).t; }))
      : ['지난 시험과 겹친 문항이 <b>없습니다</b>', '<b>새 문제</b>가 많이 나온 시험'];
    var h=x.html;
    h=h.replace(/<div class="ttl">[\s\S]*?<\/div>/, '<div class="ttl">지난 시험에서<br><span class="red">다시</span> 나온 문항<br><span class="gold">'+s.items+'문항</span></div>');
    h=h.replace(/<div class="list">[\s\S]*?<\/div><div class="slogan">[\s\S]*?<\/div>/, function(){ return '<div class="list">'+bl.map(function(b){ return '<div class="li"><i>✓</i><span>'+b+'</span></div>'; }).join('')+'</div><div class="slogan">같은 학교 지난 시험 문제와 하나씩 비교</div>'; });
    x.html=(typeof cn4NoGc==='function')?cn4NoGc(h):h;
    x.para=pcCardPara(d); x.facts=pcCardFacts(d);
  });
  return out; }; })(cn2Cards);
