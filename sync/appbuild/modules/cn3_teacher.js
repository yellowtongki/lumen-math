/* ═══════════════════════════════════════════════════════════════════
 * v19-101: 📰 카드뉴스 2판 고침 — 원장 지시 2026-10-11
 *   「매쓰플랫 용어 대신 학원 교재 · 기출문제도 보이게 · 모자이크는 내가 직접」
 *  ① 카드 · 블로그자료.md · 적중 분석 .md · 학부모 보고서에 「매쓰플랫」 낱말을 쓰지 않는다. 자료 종류 이름:
 *     교과서(textbook) · 루멘수학 학습지(ws) · 루멘수학 시험대비 교재(book) · 학원 대비 학습지(ms) · 학원 프린트(upload)
 *     난이도 기준 「매쓰플랫 난도」 → 「문항 난도」
 *  ② 원장님이 고른 문항 카드: 흰 패널 안에 왼쪽 = 시험 문항(기출), 오른쪽 = 우리 자료 문항 — 두 그림을 나란히, 그림마다 작은 이름표.
 *     기본은 선명하게. 카드마다 「선명 / 흐리게」 칩 (시험 설정 exam_hit_<시험>.card.blur[카드파일] = true · 흐리게는 시험 문항만)
 *  ③ 🧩 모자이크: 카드마다 「🧩 모자이크」 → 창에서 «시험 문항 / 우리 자료» 그림에 원장님이 직접 상자를 그린다.
 *     상자 = 그 부분을 작은 그림으로 줄였다가 다시 키워(부드럽게 하지 않음) 네모 칸으로 뭉갠다. 칸 크기 ≈ 그림 폭의 1/40.
 *     저장: exam_hit_<시험>.card.mosaic[카드파일][exam|mat] = [{x,y,w,h}] (0~1 비율)
 *     카드에는 브라우저에서 모자이크한 그림(data:image/png)을 넣는다 → 화면 카드와 내려받기(html2canvas) 모두 같은 그림.
 *     그림 서버가 CORS 를 막으면(그림을 읽을 수 없으면) 원본 그대로 + 창에 경고.
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 이름 · 교재 이름 · 쪽 번호는 넣지 않는다.
 * ═══════════════════════════════════════════════════════════════════ */
var CN3 = { mzCache:{}, mzWait:{}, mz:null };
var CN3_KN = { textbook:'교과서', ws:'루멘수학 학습지', book:'루멘수학 시험대비 교재', ms:'학원 대비 학습지', upload:'학원 프린트' };
var CN3_KORD = ['textbook','ws','book','ms','upload'];
var CN3_NOCORS = '이 그림은 모자이크를 적용할 수 없습니다 (원본 서버 설정)';
function cn3K(m){ return (m && CN3_KN[m.kind]) ? m.kind : 'ws'; }
function cn3Kind(m){ return m ? CN3_KN[cn3K(m)] : ''; }
/* 「매쓰플랫」 낱말 걸러내기 — 카드 · .md · 보고서에 나가는 글 */
function cn3NoMf(s){
  return String(s==null?'':s).replace(/매쓰플랫 난도/g,'문항 난도').replace(/매쓰플랫에서 푼 학습지·교재/g,'학원에서 푼 루멘수학 학습지·교재')
    .replace(/매쓰플랫 학습지·교재/g,'루멘수학 학습지·교재').replace(/매쓰플랫 교재/g,'루멘수학 시험대비 교재').replace(/매쓰플랫 학습지/g,'루멘수학 학습지')
    .replace(/매쓰플랫/g,'학원');
}

/* ── ① 자료 종류 이름 (앞 부품의 같은 이름 함수를 덮어쓴다) ── */
function cn2Kind(m){ return cn3Kind(m); }
CN2_KINDC = { '교과서':'#2fa36b', '루멘수학 학습지':'#4a8dff', '루멘수학 시험대비 교재':'#ff5a5a', '학원 대비 학습지':'#a78bfa', '학원 프린트':'#ff9a3d' };
function htsRepKind(m){ return cn3Kind(m); }
try{ HTS_KIND.ms.r='학원 대비 학습지'; HTS_KIND.mf.r='루멘수학 학습지·교재'; }catch(e){}
/* 다섯 종류로 나눠 세기 (교과서 · 루멘수학 학습지 · 루멘수학 시험대비 교재 · 학원 대비 학습지 · 학원 프린트) */
function cn3ByKind(d){
  var b=d.basis||'same+var', g={}, bk=(d.stats&&d.stats.byKind)||null;
  CN3_KORD.forEach(function(k){ g[k]={ hit:0, sure:0, mats:0 }; });
  if(bk) CN3_KORD.forEach(function(k){ g[k].mats=(bk[k]||{}).mats||0; });
  else Object.keys(d.mats||{}).forEach(function(k){ g[cn3K(d.mats[k])].mats++; });
  htVisible(d).forEach(function(it){ var e=htEff(it); if(!htInBasis(e.kind,b)||!e.k) return; var m=(d.mats||{})[e.k]; if(!m) return; var x=g[cn3K(m)]; x.hit++; if(e.sure) x.sure++; });
  return g;
}
function htsByKindLine(d, rep){
  if(rep){ var g5=cn3ByKind(d); return CN3_KORD.map(function(k){ return CN3_KN[k]+' '+g5[k].hit; }).join(' · '); }
  var g=htsByKind(d); return ['tb','ms','pdf','mf'].map(function(k){ return HTS_KIND[k].t+' '+g[k].hit; }).join(' · ');
}
/* 적중 분석 .md — 「대조한 우리 자료」 줄을 새 이름으로 · 「매쓰플랫」 낱말 없음 */
htMd=(function(o){ return function(d){
  var L=String(o(d)).split('\n'), g=cn3ByKind(d);
  for(var i=0;i<L.length;i++){ if(!/^- 대조한 우리 자료: /.test(L[i])) continue;
    var parts=[]; if(g.ws.mats||g.book.mats||!(g.textbook.mats||g.ms.mats||g.upload.mats)) parts.push('이 학교·학년 학생 '+(d.students||[]).length+'명이 '+(d.from||'')+' ~ '+(d.to||'')+' 동안 학원에서 푼 루멘수학 학습지·교재 문항');
    ['textbook','ms','upload'].forEach(function(k){ if(g[k].mats) parts.push(CN3_KN[k]+' '+g[k].mats+'문항'); });
    L[i]='- 대조한 우리 자료: '+parts.join(' + '); }
  return cn3NoMf(L.join('\n')); }; })(htMd);
/* 학부모 보고서 — «우리 자료별 적중» 다섯 종류 · 표의 자료 종류 새 이름 · 「매쓰플랫」 낱말 없음 (hitsrc 의 같은 함수를 덮어쓴다) */
function htsReportFix(d, h, code){
  var g=cn3ByKind(d), b=d.basis||'same+var', tot=CN3_KORD.reduce(function(a,k){ return a+g[k].hit; },0), cols=['#111','#b91c1c','#7f1d1d','#555','#888'];
  var blk='<h2>우리 자료별 적중</h2><div>'+HT_BASIS[b].label+' 기준 적중 '+tot+'문항이 나온 학원 자료 — '
    +CN3_KORD.map(function(k){ return CN3_KN[k]+' <b'+(g[k].hit?' class="red"':'')+'>'+g[k].hit+'</b>'; }).join(' · ')+'</div>'
    +'<div style="display:flex;height:9px;margin-top:5px;background:#ddd">'+CN3_KORD.map(function(k,i){ return '<div style="height:100%;width:'+(tot?(g[k].hit/tot*100):0)+'%;background:'+cols[i]+'"></div>'; }).join('')+'</div>';
  var mk='<h2>문항 요약</h2>', i=h.indexOf(mk); if(i>=0) h=h.slice(0,i)+blk+h.slice(i);
  var rows={}; htReportRows(d).forEach(function(r){ rows[r.n]=r; });
  h=h.replace(/<tr><td><b>(\d+)<\/b>[\s\S]*?<\/tr>/g, function(row, n){ var r=rows[Number(n)]; if(!r||!r.inB||!r.m) return row;
    var old='<td>'+htEsc(htsOldRepKind(r.m))+'</td></tr>'; return row.slice(-old.length)===old ? row.slice(0,-old.length)+'<td>'+htEsc(htsRepKind(r.m))+'</td></tr>' : row; });
  if(code){ var stu=htStudentRow(d, code); if(stu.given) h=h.replace(/아직 풀지 않았던 것 (\d+)문항\./, function(all, n){ return '아직 풀지 않았던 것 '+n+'문항, 학원에서 나눠 준 교과서·학습지·프린트로 공부한 것 '+stu.given+'문항.'; }); }
  return cn3NoMf(h);
}
/* 카드(두 스타일)와 블로그자료.md 에서 「매쓰플랫」 걸러내기 */
cnCards=(function(o){ return function(d){ return o(d).map(function(x){ x.html=cn3NoMf(x.html); x.para=cn3NoMf(x.para); x.facts=(x.facts||[]).map(cn3NoMf); return x; }); }; })(cnCards);
cnMd=(function(o){ return function(d, cards){ return cn3NoMf(o(d, cards)); }; })(cnMd);

/* ── ② 문항 카드: 두 그림 나란히 ── */
function cn3Row(d, file, R){ var m=/^\d+_(\d+)번적중$/.exec(String(file||'')); if(!m) return null; var n=Number(m[1]); return (R||cnRows(d)).filter(function(r){ return r.n===n; })[0]||null; }
function cn3Urls(r){ return { exam:r?htItemImg(r.it):'', mat:(r&&r.m)?htMatImg(r.m):'' }; }
function cn3Fig(which, url, cap, rects, blur){
  var E=cnEsc, src=url, key='';
  if(url && rects && rects.length){ key=cn3MzKey(url, rects); var c=CN3.mzCache[key];
    if(c && c!=='busy' && c!=='fail') src=c; else if(!c) cn3MzMake(url, rects); }
  return '<figure class="'+which+'"><figcaption>'+E(cap)+'</figcaption>'
    +(url?('<img'+(blur?' class="blur" data-blur="1"':'')+' data-which="'+which+'"'+(key?(' data-mzk="'+key+'"'):'')+' src="'+E(src)+'" alt="'+E(cap)+'" crossorigin="anonymous">'):'<span class="none">그림 없음</span>')+'</figure>';
}
function cn3PickPanel(d, c, r, file){
  var u=cn3Urls(r), mz=(c.mosaic||{})[file]||{}, blur=!!((c.blur||{})[file]), kname=cn3Kind(r.m)||'학원 자료';
  return '<div class="pk pk2"><div class="no"><b>'+r.n+'</b><span>번'+(r.killer?' · 변별':'')+'</span></div>'
    +cn3Fig('exam', u.exam, '시험 문항 '+r.n+'번', mz.exam, blur)+cn3Fig('mat', u.mat, kname+' 문항', mz.mat, false)+'</div>';
}
cn2Cards=(function(o){ return function(d){
  var out=o(d), c=cnCfg(d), R=cnRows(d), E=cnEsc;
  out.forEach(function(x){
    var r=cn3Row(d, x.file, R);
    if(r){
      x.html=x.html.replace(/<div class="pk">[\s\S]*?<\/figure><\/div>/, function(){ return cn3PickPanel(d, c, r, x.file); });
      var keys=r.top?[r.top.k].concat(r.top.also||[]):[], kinds=[];
      keys.forEach(function(k){ var m=(d.mats||{})[k]; var nm=m?cn3Kind(m):''; if(nm && kinds.indexOf(nm)<0) kinds.push(nm); });
      x.para=r.n+'번은 '+(cn3Kind(r.m)||'학원 자료')+'에 있던 문제와 '+(r.kind==='same'?'똑같은 문제':(r.kind==='var'?'숫자만 다른 문제':'같은 유형'))+'였습니다.'+(r.yrs.length?(' '+r.yrs.join('·')+'년 같은 시험에도 나온 유형입니다.'):'');
      x.facts=(x.facts||[]).map(function(f){ return /^자료: /.test(f) ? ('자료: '+kinds.join(', ')) : f; });
    } else if(x.file==='07_자료별적중'){
      var mk={}, mks=[]; R.forEach(function(rr){ if(!rr.inB||!rr.m) return; var k=cn3Kind(rr.m); if(!mk[k]){ mk[k]=[]; mks.push(k); } mk[k].push(rr); }); mks.sort(function(a,b){ return mk[b].length-mk[a].length; });
      x.para='가장 많이 맞힌 자료는 '+(mks[0]||'')+'로 '+(mks.length?mk[mks[0]].length:0)+'문항입니다.';
      x.facts=mks.map(function(k){ return k+' '+mk[k].length+'문항: '+mk[k].map(function(rr){ return rr.n; }).join(',')+'번'; });
    }
    x.html=cn3NoMf(x.html); x.para=cn3NoMf(x.para); x.facts=(x.facts||[]).map(cn3NoMf);
  });
  return out; }; })(cn2Cards);

/* 카드 위 칩: 「선명 / 흐리게」 · 「🧩 모자이크」 (문항 카드만) */
function cn3Chips(c, file){
  var bl=!!((c.blur||{})[file]), mz=(c.mosaic||{})[file]||{}, n=(mz.exam||[]).length+(mz.mat||[]).length, f=cnEsc(file);
  return '<span class="cn3-seg"><button class="cn-chip'+(bl?'':' on b')+'" data-cn3blur="'+f+':0" onclick="cn3Blur(\''+f+'\',0)">선명</button>'
    +'<button class="cn-chip'+(bl?' on b':'')+'" data-cn3blur="'+f+':1" onclick="cn3Blur(\''+f+'\',1)">흐리게</button></span>'
    +'<button class="cn-chip'+(n?' on b':'')+'" data-cn3mz="'+f+'" onclick="cn3MzOpen(\''+f+'\')">🧩 모자이크'+(n?(' '+n):'')+'</button>';
}
cn2CardsHtml=(function(o){ return function(d){
  var h=o(d), c=cnCfg(d);
  return h.replace(/(data-cn2bg="(\d+_\d+번적중)"[^>]*>🖼 배경<\/button>)/g, function(all, a, file){ return a+cn3Chips(c, file); }); }; })(cn2CardsHtml);
function cn3Refresh(d){ var pv=document.getElementById('cn-cards'); if(pv) pv.innerHTML=cnCardsHtml(d); else if(typeof render==='function') render(); }
window.cn3Blur=function(file, on){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); c.blur=c.blur||{};
  if(on) c.blur[file]=true; else delete c.blur[file]; cnSave(d); cn3Refresh(d); };

/* ── ③ 모자이크 그리기 ── */
function cn3MzKey(url, rects){ var s=String(url)+'|'+JSON.stringify(rects||[]), h=5381; for(var i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return 'mz'+(h>>>0).toString(36)+s.length.toString(36); }
function cn3LoadImg(url, cors){ return new Promise(function(res, rej){ var im=new Image(); if(cors) im.crossOrigin='anonymous';
  im.onload=function(){ res(im); }; im.onerror=function(){ rej(new Error('그림을 읽을 수 없습니다')); }; im.src=url; }); }
/* 그림을 그리고 상자마다 네모 칸으로 뭉갠다 (칸 ≈ 그림 폭의 1/40) */
function cn3Pixelate(g, im, W, H, rects){
  g.drawImage(im, 0, 0, W, H);
  var blk=Math.max(2, Math.round(W/40));
  (rects||[]).forEach(function(q){
    var x=Math.max(0, Math.round(q.x*W)), y=Math.max(0, Math.round(q.y*H)), w=Math.min(W-x, Math.round(q.w*W)), h=Math.min(H-y, Math.round(q.h*H));
    if(w<1||h<1) return;
    var sw=Math.max(1, Math.ceil(w/blk)), sh=Math.max(1, Math.ceil(h/blk)), t=document.createElement('canvas'); t.width=sw; t.height=sh;
    var tg=t.getContext('2d'); tg.drawImage(im, x*im.naturalWidth/W, y*im.naturalHeight/H, w*im.naturalWidth/W, h*im.naturalHeight/H, 0, 0, sw, sh);
    g.save(); g.imageSmoothingEnabled=false; g.drawImage(t, 0, 0, sw, sh, x, y, w, h); g.restore();
  });
}
/* 카드에 넣을 모자이크 그림(data:image/png) — 한 번 만든 것은 기억 */
function cn3MzMake(url, rects){
  var key=cn3MzKey(url, rects), have=CN3.mzCache[key];
  if(have==='busy') return CN3.mzWait[key]; if(have) return Promise.resolve(have==='fail'?'':have);
  CN3.mzCache[key]='busy';
  var p=cn3LoadImg(url, true).then(function(im){
    var W=im.naturalWidth||1, H=im.naturalHeight||1, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    cn3Pixelate(cv.getContext('2d'), im, W, H, rects);
    var du=cv.toDataURL('image/png');   /* CORS 가 막히면 여기서 오류 → 원본 그대로 */
    CN3.mzCache[key]=du;
    try{ document.querySelectorAll('img[data-mzk="'+key+'"]').forEach(function(el){ el.src=du; }); }catch(e){}
    return du;
  }).catch(function(){ CN3.mzCache[key]='fail'; return ''; });
  CN3.mzWait[key]=p; return p;
}
/* 내려받기 전에 모든 문항 카드의 모자이크 그림을 다 만들어 둔다 */
function cn3MzPrep(d){
  var c=cnCfg(d), all=[];
  Object.keys(c.mosaic||{}).forEach(function(file){ var r=cn3Row(d, file); if(!r) return; var u=cn3Urls(r), mz=c.mosaic[file]||{};
    ['exam','mat'].forEach(function(w){ if(u[w] && (mz[w]||[]).length) all.push(cn3MzMake(u[w], mz[w])); }); });
  return Promise.all(all);
}
window.cnExport=(function(o){ return async function(){
  if(CN.style!=='v1'){ try{ var d=HT.data[HT.cur]; if(d) await cn3MzPrep(d); }catch(e){} }
  return o.apply(this, arguments); }; })(window.cnExport);

/* ── 🧩 모자이크 창 ── */
function cn3MzCur(){ var s=CN3.mz; return s ? (s.rects[s.which]||(s.rects[s.which]=[])) : []; }
window.cn3MzOpen=function(file){
  var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d), r=cn3Row(d, file); if(!r) return;
  var u=cn3Urls(r), saved=(c.mosaic||{})[file]||{};
  CN3.mz={ file:file, n:r.n, urls:u, kname:cn3Kind(r.m)||'우리 자료', which:u.exam?'exam':'mat', rects:{ exam:JSON.parse(JSON.stringify(saved.exam||[])), mat:JSON.parse(JSON.stringify(saved.mat||[])) },
    dirty:false, im:null, taint:false, err:'', drag:null, msg:'', seq:0 };
  cn2EnsureCss(); cn3MzBuild(); cn3MzLoad();
};
function cn3MzBuild(){
  var s=CN3.mz; if(!s) return; var box=document.getElementById('cn3-mz');
  if(!box){ box=document.createElement('div'); box.id='cn3-mz'; box.className='cn3-mz'; document.body.appendChild(box); }
  var n=cn3MzCur().length;
  box.innerHTML='<div class="cn3-mzin" role="dialog" aria-label="모자이크">'
    +'<div class="cn3-mzh"><b>🧩 모자이크 — '+s.n+'번 카드</b><span class="ht-sub">그림 위를 끌어 상자를 그리면 그 부분이 네모 칸으로 가려집니다</span></div>'
    +'<div class="cn3-mzt">'
      +'<button class="cn-chip'+(s.which==='exam'?' on b':'')+'" data-cn3tab="exam" onclick="cn3MzTab(\'exam\')"'+(s.urls.exam?'':' disabled')+'>시험 문항 ('+(s.rects.exam||[]).length+')</button>'
      +'<button class="cn-chip'+(s.which==='mat'?' on b':'')+'" data-cn3tab="mat" onclick="cn3MzTab(\'mat\')"'+(s.urls.mat?'':' disabled')+'>우리 자료 ('+(s.rects.mat||[]).length+')</button>'
      +'<span class="ht-sub" id="cn3-mzn">이 그림 상자 '+n+'개</span></div>'
    +(s.taint?'<div class="cn3-warn" id="cn3-warn">⚠ '+CN3_NOCORS+'</div>':'')
    +(s.err?'<div class="cn3-warn">⚠ '+cnEsc(s.err)+'</div>':'')
    +'<div class="cn3-cvw"><canvas id="cn3-cv"></canvas></div>'
    +'<div class="cn3-mzb">'
      +'<button class="ht-btn" id="cn3-undo" onclick="cn3MzUndo()"'+(n?'':' disabled')+'>되돌리기(마지막 상자)</button>'
      +'<button class="ht-btn" id="cn3-clear" onclick="cn3MzClear()"'+(n?'':' disabled')+'>모두 지우기</button>'
      +'<button class="ht-btn pri" id="cn3-save" onclick="cn3MzSave()">저장</button>'
      +'<button class="ht-btn" id="cn3-close" onclick="cn3MzClose()">닫기</button>'
      +(s.msg?'<span class="ht-sub" id="cn3-mzmsg" style="font-weight:800;color:#15803d">'+cnEsc(s.msg)+'</span>':'')+(s.dirty?'<span class="ht-sub" style="color:#b45309;font-weight:800">저장 안 됨</span>':'')
    +'</div></div>';
  var cv=document.getElementById('cn3-cv');
  cv.addEventListener('pointerdown', cn3MzDown); cv.addEventListener('pointermove', cn3MzMove); cv.addEventListener('pointerup', cn3MzUp); cv.addEventListener('pointercancel', cn3MzUp);
  cn3MzDraw();
}
/* 그림 받기: 먼저 CORS 로, 안 되면 그냥(그때는 모자이크를 카드에 넣을 수 없음) */
function cn3MzLoad(){
  var s=CN3.mz; if(!s) return Promise.resolve(); var url=s.urls[s.which], seq=++s.seq; s.im=null; s.taint=false; s.err='';
  if(!url){ s.err='그림이 없습니다'; cn3MzBuild(); return Promise.resolve(); }
  return cn3LoadImg(url, true).then(function(im){ return { im:im, cors:true }; }, function(){ return cn3LoadImg(url, false).then(function(im){ return { im:im, cors:false }; }); })
    .then(function(x){ if(!CN3.mz||CN3.mz.seq!==seq) return; var taint=!x.cors;
      if(!taint){ try{ var t=document.createElement('canvas'); t.width=1; t.height=1; var g=t.getContext('2d'); g.drawImage(x.im,0,0,1,1); g.getImageData(0,0,1,1); }catch(e){ taint=true; } }
      s.im=x.im; s.taint=taint; cn3MzBuild(); })
    .catch(function(){ if(!CN3.mz||CN3.mz.seq!==seq) return; s.err='그림을 불러오지 못했습니다'; cn3MzBuild(); });
}
function cn3MzDraw(){
  var s=CN3.mz, cv=document.getElementById('cn3-cv'); if(!s||!cv) return;
  var im=s.im; if(!im){ cv.width=320; cv.height=60; var g0=cv.getContext('2d'); g0.fillStyle='#f1f5f9'; g0.fillRect(0,0,320,60); g0.fillStyle='#64748b'; g0.font='14px sans-serif'; g0.fillText(s.err||'그림 불러오는 중…', 12, 36); cv.style.width='320px'; cv.style.height='60px'; return; }
  var W=im.naturalWidth||1, H=im.naturalHeight||1;
  if(cv.width!==W) cv.width=W; if(cv.height!==H) cv.height=H;
  var mw=Math.min(860, (window.innerWidth||1000)-80), mh=Math.max(240, (window.innerHeight||800)*0.62), k=Math.min(1, mw/W, mh/H);
  if(k<0.05) k=Math.min(mw/W, mh/H);
  cv.style.width=Math.round(W*k)+'px'; cv.style.height=Math.round(H*k)+'px';
  var g=cv.getContext('2d'); g.clearRect(0,0,W,H);
  var rs=cn3MzCur().slice(); if(s.drag) rs.push(s.drag.r);
  cn3Pixelate(g, im, W, H, rs);
  g.save(); g.lineWidth=Math.max(2, W/300); g.setLineDash([Math.max(6,W/80), Math.max(4,W/120)]);
  rs.forEach(function(q, i){ g.strokeStyle=(s.drag&&i===rs.length-1)?'#2563eb':'#e11d48'; g.strokeRect(q.x*W, q.y*H, q.w*W, q.h*H); });
  g.restore();
}
function cn3MzPos(e){ var cv=document.getElementById('cn3-cv'), b=cv.getBoundingClientRect(); return { x:Math.max(0,Math.min(1,(e.clientX-b.left)/Math.max(1,b.width))), y:Math.max(0,Math.min(1,(e.clientY-b.top)/Math.max(1,b.height))) }; }
function cn3R4(v){ return Math.round(v*10000)/10000; }
function cn3MzDown(e){ var s=CN3.mz; if(!s||!s.im) return; var p=cn3MzPos(e); s.drag={ x0:p.x, y0:p.y, r:{ x:p.x, y:p.y, w:0, h:0 } }; try{ e.target.setPointerCapture(e.pointerId); }catch(_){} e.preventDefault(); }
function cn3MzMove(e){ var s=CN3.mz; if(!s||!s.drag) return; var p=cn3MzPos(e), a=s.drag; a.r={ x:Math.min(a.x0,p.x), y:Math.min(a.y0,p.y), w:Math.abs(p.x-a.x0), h:Math.abs(p.y-a.y0) }; cn3MzDraw(); }
function cn3MzUp(e){ var s=CN3.mz; if(!s||!s.drag) return; var r=s.drag.r; s.drag=null;
  if(r.w>=0.01 && r.h>=0.01) cn3MzAdd(r.x, r.y, r.w, r.h); else cn3MzDraw(); }
/* 상자 하나 더하기 (0~1 비율) — 끌기 · 검사에서 같이 쓴다 */
window.cn3MzAdd=function(x, y, w, h){ var s=CN3.mz; if(!s) return;
  x=Math.max(0,Math.min(1,+x||0)); y=Math.max(0,Math.min(1,+y||0)); w=Math.max(0,Math.min(1-x,+w||0)); h=Math.max(0,Math.min(1-y,+h||0)); if(w<=0||h<=0) return;
  cn3MzCur().push({ x:cn3R4(x), y:cn3R4(y), w:cn3R4(w), h:cn3R4(h) }); s.dirty=true; s.msg=''; cn3MzBuild(); };
window.cn3MzTab=function(w){ var s=CN3.mz; if(!s||!s.urls[w]||s.which===w) return; s.which=w; s.drag=null; cn3MzBuild(); return cn3MzLoad(); };
window.cn3MzUndo=function(){ var s=CN3.mz; if(!s) return; var a=cn3MzCur(); if(!a.length) return; a.pop(); s.dirty=true; s.msg=''; cn3MzBuild(); };
window.cn3MzClear=function(){ var s=CN3.mz; if(!s) return; s.rects[s.which]=[]; s.dirty=true; s.msg=''; cn3MzBuild(); };
window.cn3MzSave=function(){
  var s=CN3.mz, d=HT.data[HT.cur]; if(!s||!d) return Promise.resolve(false); var c=cnCfg(d), o={};
  ['exam','mat'].forEach(function(w){ if((s.rects[w]||[]).length) o[w]=JSON.parse(JSON.stringify(s.rects[w])); });
  c.mosaic=c.mosaic||{}; if(o.exam||o.mat) c.mosaic[s.file]=o; else delete c.mosaic[s.file];
  s.dirty=false; s.msg='✅ 저장했습니다 — 카드에 바로 들어갑니다';
  cn3Refresh(d); cn3MzBuild();
  return Promise.all([cnSave(d), cn3MzPrep(d)]).then(function(){ return true; });
};
window.cn3MzClose=function(){ var s=CN3.mz; if(s&&s.dirty&&!confirm('저장하지 않은 상자가 있습니다. 그냥 닫을까요?')) return;
  CN3.mz=null; var box=document.getElementById('cn3-mz'); if(box) box.remove(); };

/* ── CSS: 카드 CSS(cn2-css) 뒤에 붙인다 → 내려받기 틀(iframe)에도 같이 들어간다 ── */
var CN3_CSS=''
  +'.cn2 .pk.pk2{grid-template-columns:15cqw minmax(0,1fr) minmax(0,1fr);gap:1.8cqw}.cn2 .pk2 .no b{font-size:10.5cqw}'
  +'.cn2 .pk2 figure{flex-direction:column;background:#ffffff;border:.3cqw solid #e2e8f0}'
  +'.cn2 .pk2 figcaption{flex:0 0 auto;font-size:2.4cqw;font-weight:900;color:#fff;background:#0f172a;padding:.7cqw 1.2cqw;line-height:1.2;text-align:center}'
  +'.cn2 .pk2 figure.mat figcaption{background:#1d4ed8}'
  +'.cn2 .pk2 img{flex:1 1 0;min-height:0;width:100%;height:auto;object-fit:contain;object-position:top;display:block;background:#fff}'
  +'.cn2 .pk2 img.blur{filter:blur(.9cqw) saturate(.6)}'
  +'.cn2 .pk2 .none{flex:1 1 auto;display:flex;align-items:center;justify-content:center;font-size:2.4cqw;font-weight:800;color:#94a3b8}'
  +'.cn2-wrap.s11 .cn2 .pk.pk2{grid-template-columns:12cqw minmax(0,1fr) minmax(0,1fr);gap:1.4cqw}.cn2-wrap.s11 .cn2 .pk2 .no b{font-size:9cqw}.cn2-wrap.s11 .cn2 .pk2 figcaption{padding:.4cqw 1cqw}'
  +'.cn3-seg{display:inline-flex;gap:2px}'
  +'.cn3-mz{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}'
  +'.cn3-mzin{background:#fff;border-radius:12px;padding:12px 14px;max-width:min(920px,100%);box-shadow:0 20px 50px rgba(0,0,0,.35);display:grid;gap:8px}'
  +'.cn3-mzh{display:flex;flex-direction:column;gap:2px}.cn3-mzh b{font-size:15px;color:#0d2240}'
  +'.cn3-mzt,.cn3-mzb{display:flex;gap:6px;flex-wrap:wrap;align-items:center}'
  +'.cn3-warn{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:8px;padding:6px 9px;font-size:12.5px;font-weight:800}'
  +'.cn3-cvw{background:#f1f5f9;border-radius:8px;padding:6px;display:flex;justify-content:center}.cn3-cvw canvas{display:block;cursor:crosshair;touch-action:none;background:#fff}';
cn2EnsureCss=(function(o){ return function(){ o(); var st=document.getElementById('cn2-css'); if(st && !st.getAttribute('data-cn3')){ st.textContent+=CN3_CSS; st.setAttribute('data-cn3','1'); } }; })(cn2EnsureCss);
