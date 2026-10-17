/* ═══ v19-131: 📰 카드뉴스 — ① 자동 선택은 «원장님 확정» 문항 먼저 ② «지금 스타일»(옛 카드)에서도 🧩 모자이크 ═══
 *  원장 2026-10-17 「확정한 문항을 먼저 고르게 바꿔 · 모자이크처리를 지금 스타일도 가능하게 하자」
 *
 *  ① 자동 선택(v19-130 cnp130Auto, card.picks 가 비었을 때 상위 4개):
 *     원장님 ✓ 확정(htEff sure===true) → AI 판정/후보 순. 같은 묶음 안에서는 같은 문제 → 숫자변형 → 서술 → 유사유형 → 번호.
 *  ② 옛 카드(cn_teacher cnCards, CN.style==='v1')의 문항 카드(NN_N번적중)에
 *     · 카드 이름 옆 칩 「선명 / 흐리게」 · 「🧩 모자이크」 (새 스타일과 같은 창 cn3MzOpen 을 그대로 쓴다)
 *     · 시험 그림·우리 자료 그림에 모자이크 상자를 넣은 그림(data:png)을 끼운다 (cn3 의 만들기·기억 CN3.mzCache 를 같이 씀)
 *     · 흐리게: 원장님이 고른 값(card.blur[file] true/false). 고른 적 없으면 — 시험 그림에 모자이크를 그렸으면 선명, 아니면 예전처럼 흐리게
 *     · 내려받기(.zip) 전에 모자이크 그림을 다 만들어 둔다 (cn3 는 새 스타일만 해 줬다)
 *  ③ 두 카드 모양은 파일 이름 번호가 다를 수 있다(옛 07_17번적중 ↔ 새 08_17번적중) → 모자이크·흐리게는 «문항 번호»로 이어 쓴다.
 *     저장할 때 같은 번호의 다른 이름 칸은 지운다(하나만 남게).
 *  ④ v19-130 의 빨간 안내(«지금 스타일이라 모자이크가 안 보입니다»)는 이제 맞지 않으므로 보통 안내 줄로 바꾼다.
 *  저장 모양은 그대로: exam_hit_<시험>.card.mosaic[file] = { exam:[{x,y,w,h}], mat:[…] } · card.blur[file] = true|false
 */
var CN131_ORD = { same:0, var:1, text:2, type:3 };

/* ① 자동 선택: 확정 먼저 */
cnp130Auto = function(d){
  if(!d) return [];
  var R=[]; try{ R=cnRows(d); }catch(e){ return []; }
  var sure=function(r){ try{ return htEff(r.it).sure===true ? 0 : 1; }catch(e){ return 1; } };
  return R.filter(function(r){ return r.inB; }).sort(function(a, b){
    var ka=CN131_ORD.hasOwnProperty(a.kind)?CN131_ORD[a.kind]:9, kb=CN131_ORD.hasOwnProperty(b.kind)?CN131_ORD[b.kind]:9;
    return (sure(a)-sure(b)) || (ka-kb) || ((+a.n||0)-(+b.n||0)); }).slice(0, CNP130_MAX).map(function(r){ return r.no; });
};

/* ③ 같은 문항 번호의 다른 파일 이름 칸 찾기 */
function cn131Num(file){ var m=/^\d+_(\d+)번적중$/.exec(String(file||'')); return m ? Number(m[1]) : null; }
function cn131Same(obj, file){
  var n=cn131Num(file); if(n==null || !obj) return null;
  if(obj.hasOwnProperty(file)) return file;
  var ks=Object.keys(obj); for(var i=0;i<ks.length;i++){ if(cn131Num(ks[i])===n) return ks[i]; } return null;
}
/* 이 파일 이름으로 보이게(메모리에서만 이어 붙임) */
function cn131Alias(c, file){
  if(!c) return;
  ['mosaic','blur'].forEach(function(f){ var o=c[f]; if(!o) return; var k=cn131Same(o, file); if(k && k!==file) o[file]=o[k]; });
}
/* 저장 전: 같은 번호의 다른 이름 칸을 지운다 */
function cn131Prune(c, file){
  var n=cn131Num(file); if(n==null || !c) return;
  ['mosaic','blur'].forEach(function(f){ var o=c[f]; if(!o) return; Object.keys(o).forEach(function(k){ if(k!==file && cn131Num(k)===n) delete o[k]; }); });
}
if(typeof cn3Chips==='function') cn3Chips=(function(o){ return function(c, file){ cn131Alias(c, file); return o.apply(this, arguments); }; })(cn3Chips);
if(typeof cn3PickPanel==='function') cn3PickPanel=(function(o){ return function(d, c, r, file){ cn131Alias(c, file); return o.apply(this, arguments); }; })(cn3PickPanel);
if(typeof window.cn3MzOpen==='function') window.cn3MzOpen=(function(o){ return function(file){
  var d=HT.data[HT.cur]; if(d) cn131Alias(cnCfg(d), file); return o.apply(this, arguments); }; })(window.cn3MzOpen);
if(typeof window.cn3MzSave==='function') window.cn3MzSave=(function(o){ return function(){
  var s=CN3.mz, d=HT.data[HT.cur]; if(s && d){ var c=cnCfg(d); cn131Alias(c, s.file); cn131Prune(c, s.file); }   /* 흐리게 값도 이 이름으로 옮기고 옛 이름 칸은 지움 */
  return o.apply(this, arguments); }; })(window.cn3MzSave);

/* 흐리게: 새 스타일은 그대로(꺼짐 = 칸 지움 → 선명). 옛 카드는 «선명»을 false 로 남겨야 예전 기본(흐리게)으로 돌아가지 않는다 */
function cn131BlurOn(c, file){
  cn131Alias(c, file);
  var b=(c.blur||{})[file]; if(b===true) return true; if(b===false) return false;
  var mz=(c.mosaic||{})[file]||{}; return !((mz.exam||[]).length);   /* 고른 적 없음: 모자이크를 그렸으면 선명, 아니면 예전처럼 흐리게 */
}
if(typeof window.cn3Blur==='function') window.cn3Blur=(function(o){ return function(file, on){
  if(typeof CN==='undefined' || CN.style!=='v1') return o.apply(this, arguments);
  var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); c.blur=c.blur||{}; cn131Prune(c, file);
  c.blur[file]=!!on; cnSave(d); cn3Refresh(d); }; })(window.cn3Blur);

/* ② 옛 카드: 그림 칸 바꿔 끼우기 */
function cn131Img(which, url, rects, blur, alt){
  var E=cnEsc, src=url, key='';
  if(url && rects && rects.length){ key=cn3MzKey(url, rects); var m=CN3.mzCache[key];
    if(m && m!=='busy' && m!=='fail') src=m; else if(!m) cn3MzMake(url, rects); }
  return url ? ('<img'+(blur?' class="blur" data-blur="1"':'')+' data-which="'+which+'"'+(key?(' data-mzk="'+key+'"'):'')+' src="'+E(src)+'" alt="'+E(alt)+'" crossorigin="anonymous">') : '';
}
function cn131Img2(d, c, r, file){
  var u=cn3Urls(r), mz=(c.mosaic||{})[file]||{}, bl=cn131BlurOn(c, file);
  return '<div class="img2" style="flex:1"><figure><figcaption>시험 '+r.n+'번</figcaption>'
    +cn131Img('exam', u.exam, mz.exam, bl, '시험 '+r.n+'번'+(bl?' (흐리게)':''))
    +(bl?'<span class="bl">시험 문항 · 흐리게 처리</span>':'')+'</figure>'
    +'<figure><figcaption>루멘수학 자료</figcaption>'+cn131Img('mat', u.mat, mz.mat, false, '루멘수학 자료')+'</figure></div>';
}
if(typeof cnCards==='function') cnCards=(function(o){ return function(d){
  var out=o.apply(this, arguments);
  if(typeof CN==='undefined' || CN.style!=='v1' || !d || !Array.isArray(out)) return out;   /* 새 스타일(cn2Cards 가 이걸 부른다)은 손대지 않는다 */
  var c=cnCfg(d), R=null;
  out.forEach(function(x){
    if(cn131Num(x.file)==null) return;
    if(!R) R=cnRows(d);
    var r=cn3Row(d, x.file, R); if(!r) return;
    x.html=String(x.html).replace(/<div class="img2" style="flex:1">[\s\S]*?<\/figure><\/div>/, function(){ return cn131Img2(d, c, r, x.file); });
  });
  return out; }; })(cnCards);

/* 옛 카드 목록: 카드 이름 옆 칩 */
function cn131Chips(c, file){
  var bl=cn131BlurOn(c, file), mz=(c.mosaic||{})[file]||{}, n=(mz.exam||[]).length+(mz.mat||[]).length, f=cnEsc(file);
  return '<span class="cn3-seg"><button class="cn-chip'+(bl?'':' on b')+'" data-cn3blur="'+f+':0" onclick="cn3Blur(\''+f+'\',0)">선명</button>'
    +'<button class="cn-chip'+(bl?' on b':'')+'" data-cn3blur="'+f+':1" onclick="cn3Blur(\''+f+'\',1)">흐리게</button></span>'
    +'<button class="cn-chip'+(n?' on b':'')+'" data-cn3mz="'+f+'" onclick="cn3MzOpen(\''+f+'\')">🧩 모자이크'+(n?(' '+n):'')+'</button>';
}
if(typeof cnCardsHtml==='function') cnCardsHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments);
  if(typeof CN==='undefined' || CN.style!=='v1' || !d) return h;
  var c=cnCfg(d);
  return String(h).replace(/<div class="ht-sub" style="font-weight:800;margin-bottom:4px">(\d+ · (\d+_\d+번적중)\.png)<\/div>/g, function(all, lab, file){
    return '<div class="ht-sub cn131-lab" style="font-weight:800;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
      +'<span>'+lab+'</span>'+cn131Chips(c, file)+'</div>'; }); }; })(cnCardsHtml);

/* 옛 카드 내려받기 전에 모자이크 그림을 다 만들어 둔다 */
if(typeof window.cnExport==='function') window.cnExport=(function(o){ return async function(){
  if(typeof CN!=='undefined' && CN.style==='v1'){ try{ var d=HT.data[HT.cur]; if(d) await cn3MzPrep(d); }catch(e){} }
  return o.apply(this, arguments); }; })(window.cnExport);

/* ④ v19-130 빨간 안내 → 보통 안내 */
if(typeof cnPanelHtml==='function') cnPanelHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments);
  return String(h).replace(/<div class="ht-sub" id="cnp130-v1"[\s\S]*?<\/button><\/div>/,
    '<div class="ht-sub" id="cnp130-hint" style="margin-bottom:12px">문항 카드마다 🧩 모자이크 칩이 붙습니다 (지금 스타일·새 스타일 모두) — 아래 카드 목록에서 «N · NN_N번적중.png» 이름 옆 「🧩 모자이크」를 누르면 그림 위에 상자를 그려 가릴 수 있어요</div>'); }; })(cnPanelHtml);
