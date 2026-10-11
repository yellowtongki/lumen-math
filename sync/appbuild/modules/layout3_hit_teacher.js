/* ═══════════════════════════════════════════════════════════════════
 * v19-105: 🎯 적중 분석을 3분할로 — 왼쪽 «시험 목록 · 새로», 오른쪽 «이 시험의 도구» (시안 docs/mockup_layout3.html 적중 분석 화면)
 * 원장 결정 2026-10-11 「공용 메뉴 접기 좋다 · 순서 그대로(적중 분석 → 백지테스트·리커버리 → 나머지)」
 *
 *  왼쪽 (PC 900px 이상 — perViewLeftNav('examhit'))
 *    「시험」 exam_hit_index 목록(학교 학년 · 연도 학기 시험) — 지금 연 시험은 파란색, 누르면 그 결과
 *            (불러온 시험은 «적중 n% · 확정 끝» 또는 «후보 n · 확정 n»)
 *    「새로」 📚 기출 DB에서 찾기 · 📤 시험지 올리기 · 📄 PDF 자료함 → 지금 있는 입구 그대로
 *    맨 아래 접힌 「▸ 공용 메뉴」 (v19-104)
 *  오른쪽 도구 칸 (RIGHT_TOOLS.examhit — 1280px 이상은 칸, 1024~1279 는 「🛠 도구」 서랍)
 *    결과를 열었을 때: 📂 우리 자료(대조 범위) 요약 + 「🔄 이 구성으로 다시 판정」(v19-103 화면) · 「💾 구성 기억」
 *                      · 적중 기준(가운데 고르기와 같은 값 — 어느 쪽을 바꿔도 둘 다 바뀜)
 *                      · 내보내기 📰 카드뉴스 · 🖨 학부모 보고서 · ⬇ 블로그 폴더 · 📝 블로그 자료 .md
 *                      · 서버 상태(요청 띠 + ⚡ 즉시 처리 / 🐙 GitHub에서 바로 실행)
 *    결과가 없을 때: 「시험을 고르세요」 + 새로 단추
 *  가운데 화면은 그대로 둔다(같은 단추가 양쪽에 있어도 된다 — 원장 결정). 폰(900px 미만)은 바뀌는 것이 없다.
 *  ※ 앞 부품의 함수를 부르기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var L3H = { libN:null, libKick:false, saveCfg:false };

/* ── 왼쪽 ── */
function l3hLive(){ return !!(HT.req && (HT.req.status==='requested'||HT.req.status==='running')); }
function l3hExamLabel(x){ return htEsc(x.school||'')+' '+htEsc(x.grade||'')+' · '+htEsc(x.year||'')+' '+htEsc(x.semester||'')+'학기 '+htEsc(x.term||''); }
function l3hExamSub(x){
  if(l3hLive() && HT.req.examId===x.examId) return '⏳ 분석 중';
  var d=HT.data[x.examId];
  if(d){ var s=htStats(d); if(!s.total) return '문항 없음';
    if(s.open===0) return '적중 '+s.pctSure+'% · 확정 끝';
    return '후보 '+s.open+' · 확정 '+(s.total-s.open); }
  if(x.hitPct!=null) return '적중 '+x.hitPct+'%'+(x.confirmedAt?' · 확정 끝':'');
  return x.total?(x.total+'문항'):'';
}
/* PDF 자료함 장수 — 요청 화면이 받아 둔 것이 있으면 그것, 없으면 한 번만 가볍게 받아 둔다 */
function l3hLibCount(){
  try{ if(HTS.lib) return htsLibItems().length; }catch(e){}
  return L3H.libN;
}
function l3hLibKick(){
  if(L3H.libKick || HTS.lib) return; L3H.libKick=true;
  htKv('exam_lib').then(function(v){ L3H.libN=(((v&&v.items)||[]).filter(function(x){ return x && !x.deleted; })).length; if(VIEW==='examhit') render(); }).catch(function(){});
}
function l3hNewBtns(cls){
  var dbN=(typeof HTDB!=='undefined' && HTDB.idx && HTDB.idx.items)?HTDB.idx.items.length:null, libN=l3hLibCount();
  var b=function(k, t, sm){ return '<button type="button" class="'+cls+'" data-l3h-new="'+k+'" onclick="l3hNew(\''+k+'\')"><span>'+t+'</span>'+(sm!=null&&sm!==''?'<span class="n">'+htEsc(sm)+'</span>':'')+'</button>'; };
  return (typeof htdbToggle==='function'?b('db', '📚 기출 DB에서 찾기', dbN!=null?dbN.toLocaleString()+'장':''):'')
    +b('up', '📤 시험지 올리기', '사진·PDF')
    +b('lib', '📄 PDF 자료함', libN!=null?libN+'장':'');
}
function l3hLeft(){
  try{ htKick(); }catch(e){}
  l3hLibKick();
  var items=(HT.idx&&HT.idx.items)||[];
  var h=l3LeftHead('examhit')+'<div class="l3-sec">시험</div>';
  if(!HT.idx) h+='<div class="l3-sec" style="font-weight:700">불러오는 중…</div>';
  else if(!items.length) h+='<div class="l3-sec" style="font-weight:700;letter-spacing:0">아직 분석한 시험이 없습니다 — 아래 「새로」에서 시작하세요</div>';
  items.forEach(function(x){
    var id=String(x.examId||''), on=id===HT.cur, sub=l3hExamSub(x);
    h+='<button type="button" class="l3-lb'+(on?' on':'')+'" data-l3h-exam="'+htEsc(id)+'" aria-current="'+(on?'true':'false')+'" onclick="l3hPick(this.getAttribute(\'data-l3h-exam\'))"><span>'+l3hExamLabel(x)+(/시범/.test(id)?' · 시범':'')+(sub?'<small>'+htEsc(sub)+'</small>':'')+'</span></button>';
  });
  h+='<div class="l3-sec">새로</div>'+l3hNewBtns('l3-lb');
  return h+l3CommonFold();
}
perViewLeftNav=(function(o){ return function(v){
  if(v==='examhit' && isDesktop()) return l3hLeft();   /* 폰은 지금 그대로 */
  return o.apply(this, arguments); }; })(perViewLeftNav);

/* 시험 고르기 — 요청 화면이 열려 있으면 닫고 그 시험 결과로 */
window.l3hPick = function(id){
  if(!id) return;
  if(HTS.open){ HTS.open=false; HTS.rejudge=null; }
  htPick(id);
};
/* 화면 안 어느 칸으로 스크롤 (그려질 때까지 잠깐 기다림) */
function l3hScroll(sel){
  var n=0; (function tick(){ var el=document.querySelector(sel); if(el && el.scrollIntoView){ try{ el.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(e){ el.scrollIntoView(); } return; }
    if(++n<20) setTimeout(tick, 100); })();
}
/* 새로 — 지금 있는 입구를 그대로 부른다 */
window.l3hNew = function(k){
  if(HTS.open){ HTS.open=false; HTS.rejudge=null; }
  if(k==='db'){
    if(typeof htdbToggle!=='function') return;
    if(!HTDB.open) htdbToggle(); else render();
    l3hScroll('#htdb');
  } else if(k==='up'){
    if(!HT.showForm) htShowForm(); else render();
    l3hScroll('#ht-files');
  } else if(k==='lib'){
    var d=HT.cur?HT.data[HT.cur]:null;
    if(d && d.exam && typeof htsRejOpen==='function'){ htsRejOpen(); l3hScroll('#hts-lib'); }
    else { if(!HT.showForm) htShowForm(); else render(); l3hScroll('#ht-files');
      htToast('📄 PDF 자료함은 시험을 고른 뒤 「우리 자료」 화면에서 고르고 올립니다 — 먼저 시험을 고르거나 시험지를 올려 주세요'); }
  }
};

/* ── 오른쪽 도구 ── */
function l3hCk(on, txt, k){ return '<span class="l3-ck" data-l3h-src="'+k+'"><i class="'+(on?'':'off')+'">'+(on?'✓':'')+'</i><span>'+txt+'</span></span>'; }
function l3hSrcBox(d){
  var s=d.src, bk=(d.stats&&d.stats.byKind)||{}, n=function(k){ return (bk[k]||{}).mats||0; }, mfN=n('ws')+n('book');
  var q=function(c){ return c?(' <small style="color:#64748b;font-weight:700">('+c.toLocaleString()+'문항)</small>'):''; };
  var h='<div class="l3-tool" id="l3h-src"><b>📂 우리 자료 (대조 범위)</b>';
  if(!s){
    h+=l3hCk(n('textbook')>0, '교과서'+q(n('textbook')), 'tb')+l3hCk(n('ms')>0, '학원 대비 학습지'+q(n('ms')), 'ms')+l3hCk(n('upload')>0, 'PDF'+q(n('upload')), 'pdf')
      +l3hCk(true, '루멘수학 학습지·교재 자동'+q(mfN), 'mf')
      +'<span class="l3-sub">자료를 고르기 전 방식으로 판정한 시험입니다 — 아래에서 골라 다시 판정할 수 있습니다.</span>';
  } else {
    var tb=s.tb||{}, nb=(tb.bids||[]).length, ms=(s.ms||[]).length, lib=(s.lib||[]).length;
    h+=l3hCk(tb.on!==false, '교과서 '+(tb.on===false?'0권':(nb?(nb+'권'):'지정 전체'))+(tb.mode==='scope'?' · 시험 범위 단원만':'')+q(n('textbook')), 'tb')
      +l3hCk(ms>0, '학원 대비 학습지 '+ms+'장'+q(n('ms')), 'ms')
      +l3hCk(lib>0, 'PDF '+lib+'장'+q(n('upload')), 'pdf')
      +l3hCk(s.mf!==false, '루멘수학 학습지·교재 '+(s.mf===false?'끔':'자동')+q(mfN), 'mf');
  }
  return h+'<button type="button" class="l3-btn main" id="l3h-rej" onclick="htsRejOpen()">🔄 이 구성으로 다시 판정</button>'
    +'<button type="button" class="l3-btn" id="l3h-cfg" onclick="l3hSaveCfg()" title="이 학교·학년의 다음 분석 때 이 자료 구성으로 열립니다">💾 구성 기억</button></div>';
}
function l3hBasisBox(d){
  var b=d.basis||'same+var', s=htStats(d);
  var h='<div class="l3-tool" id="l3h-basis-box"><b>적중 기준</b><select class="l3-sel" id="l3h-basis" onchange="htBasis(this.value)" aria-label="적중 기준">';
  Object.keys(HT_BASIS).forEach(function(k){ h+='<option value="'+k+'"'+(k===b?' selected':'')+'>'+HT_BASIS[k].label+'</option>'; });
  return h+'</select><span class="l3-sub">적중 <b style="color:#b91c1c">'+s.pctAll+'%</b> ('+(s.hitSure+s.hitCand)+'/'+s.total+'문항) · '+(s.open?('확정 안 한 문항 '+s.open):'✓ 모두 확정')+'</span></div>';
}
function l3hExportBox(){
  return '<div class="l3-tool" id="l3h-export"><b>내보내기</b>'
    +(typeof cnToggle==='function'?'<button type="button" class="l3-btn pri" data-l3h-x="card" onclick="l3hCard()">📰 카드뉴스</button>':'')
    +'<button type="button" class="l3-btn" data-l3h-x="print" onclick="htPrint(\'\')">🖨 학부모 보고서</button>'
    +(typeof cn4BlogExport==='function'?'<button type="button" class="l3-btn" data-l3h-x="blog" onclick="cn4BlogExport()">⬇ 블로그 폴더로 내려받기</button>':'')
    +'<button type="button" class="l3-btn" data-l3h-x="md" onclick="htExportMd()">📝 블로그 자료 .md</button></div>';
}
function l3hServerBox(){
  var r=HT.req, live=l3hLive(), line;
  if(HT.busy) line='⏳ '+htEsc(HT.busy)+'…';
  else if(live) line='⏳ <b>'+htEsc(htExamName(r.exam))+'</b> — '+(r.status==='requested'?'서버가 받기를 기다리는 중':htEsc(r.step||'진행 중'))+' · '+(Number(r.pct)||0)+'%';
  else if(r && r.status==='error' && (Date.now()-new Date(r.doneAt||0).getTime())<86400000) line='<span style="color:#b91c1c">⚠ 지난 요청이 멈췄습니다: '+htEsc(r.error||'')+'</span>';
  else line='✓ 요청 대기 없음';
  var tok=false; try{ tok=!!htsGhToken(); }catch(e){}
  var h='<div class="l3-tool" id="l3h-server"><b>서버 상태</b><span class="l3-sub" id="l3h-req">'+line+'</span>';
  if(tok) h+='<span class="l3-sub" id="l3h-tok">⚡ 즉시 처리 켜짐 (이 PC 에 GitHub 토큰)</span>'+(live?'<button type="button" class="l3-btn" onclick="htsWake(\'manual\')">⚡ 다시 깨우기</button>':'');
  else h+='<span class="l3-sub" id="l3h-tok">⚡ 즉시 처리 꺼짐 — 설정 탭에서 GitHub 토큰을 넣으면 1분 안에 시작합니다</span>'
    +'<a class="l3-btn" id="l3h-gh" href="'+HTS_GH_PAGE+'" target="_blank" rel="noopener">🐙 GitHub에서 바로 실행</a>';
  return h+'</div>';
}
RIGHT_TOOLS.examhit = function(){
  var d=HT.cur?HT.data[HT.cur]:null;
  if(!d){
    return '<div class="l3-ttl">이 화면의 도구</div><div class="l3-tool" id="l3h-none"><b>시험을 고르세요</b><span class="l3-sub">'+(HT.loading?'불러오는 중…':'왼쪽 「시험」에서 고르거나 새로 시작하세요.')+'</span>'
      +l3hNewBtns('l3-btn')+'</div>'+l3hServerBox();
  }
  return '<div class="l3-ttl">이 시험의 도구</div>'
    +'<div class="l3-sub" style="font-size:12px;font-weight:800;color:#0d2240;margin:0 2px">'+htEsc(htExamName(d.exam||{}))+'</div>'
    +l3hSrcBox(d)+l3hBasisBox(d)+l3hExportBox()+l3hServerBox();
};

/* 📰 카드뉴스 — 닫혀 있으면 열고, 이미 열려 있으면 그 칸으로 */
window.l3hCard = function(){
  if(typeof CN!=='undefined' && CN.open){ l3hScroll('#cn-panel'); return; }
  cnToggle();
};
/* 💾 구성 기억 — 지난 판정에 쓴 자료(d.src)를 «다시 판정» 화면 상태로 읽은 뒤 그대로 기억하고 결과로 돌아온다 */
window.l3hSaveCfg = function(){
  var d=HT.cur?HT.data[HT.cur]:null; if(!d||!d.exam){ htToast('먼저 분석한 시험을 골라 주세요'); return; }
  if(HTS.open && HTS.rejudge && !HTS.loading) return htsSaveCfg();
  L3H.saveCfg=true; htsRejOpen();
};
htsLoad=(function(o){ return function(){
  var p=o.apply(this, arguments);
  if(L3H.saveCfg){ L3H.saveCfg=false; var R=HTS.rejudge;
    Promise.resolve(p).then(function(){
      if(!HTS.open || !R || HTS.rejudge!==R || HTS.err) return;
      return Promise.resolve(htsSaveCfg()).then(function(){ if(HTS.open && HTS.rejudge===R) window.htsClose(); });
    }).catch(function(){});
  }
  return p; }; })(htsLoad);

/* ── 모양 (v19-104 의 도구 칸 모양에 더함) ── */
(function(){
  if(document.getElementById('l3h-css')) return;
  var st=document.createElement('style'); st.id='l3h-css';
  st.textContent='.l3-btn{display:flex;justify-content:space-between;align-items:center;gap:6px}.l3-btn .n{flex:none;font-size:11px;font-weight:700;opacity:.75}'
    +'.l3-lb>span:first-child{min-width:0}'
    +'#l3h-src .l3-ck small{white-space:nowrap}';
  (document.head||document.documentElement).appendChild(st);
})();
