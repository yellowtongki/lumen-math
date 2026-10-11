/* ═══════════════════════════════════════════════════════════════════
 * v19-103: 🎯 적중 분석 — 결과 화면에서 「📂 우리 자료 고르기 → 다시 판정」
 * 원장 지시 2026-10-11 「요청화면 수학비서가 어디에 있나? 잘 안 보인다」
 *   v19-99 의 «우리 자료 3종» 요청 화면은 «새 분석»(시험지 올리기 · 기출 DB → 🎯)을 시작할 때만 떴다.
 *   이미 분석한 시험의 결과 화면에서는 그 화면으로 갈 길이 없었고, 「🔄 다시 판정」은 지난번 자료(src)를 말없이 그대로 썼다.
 *
 *  ① 결과 화면 머리(적중 기준 옆)에 「📂 우리 자료 고르기 → 다시 판정」 — 같은 요청 화면을 «다시 판정» 모드로 연다.
 *     · 시험 = 결과의 d.exam (기출 DB 번호 mydb · 과목 그대로) · 기간 = 지난 판정의 from ~ to
 *     · 자료 = 지난 판정에 쓴 d.src 가 있으면 그것, 없으면 기억한 구성(exam_hit_src_<학교>_<학년>), 둘 다 없으면 기본
 *     · 제목 「🔄 다시 판정 — <시험 이름>」 · 시작 단추 「🔄 이 자료로 다시 판정」 → exam_hit_req { rejudge:true, src } (htsStart 와 같은 모양)
 *     · 「← 결과로 돌아가기」 = 요청 없이 닫기 · 「💾 이 구성 기억」은 그대로
 *  ② 예전 「🔄 다시 판정」 단추도 같은 화면을 연다 (무엇으로 판정할지 원장님이 늘 보고 누르도록)
 *  ③ 요청 화면 — 다른 폴더(예: 공수2 · 미적분1)에서 체크한 학습지가 있으면 그 폴더 칩을 앞쪽에 «✓n» 과 함께 보이고,
 *     「다른 폴더에서 체크한 것」 줄에 폴더 단추를 단다 (예전엔 폴더가 16개를 넘으면 칩이 잘려 안 보일 수 있었다)
 *  ④ 결과 화면 「우리 자료별 적중」 칸에 한 줄 — 「이번 판정에 쓴 자료: 교과서 2권 · 학원 대비 학습지 12장 · 프린트 0장 · 루멘수학 학습지·교재 자동」 + 「바꾸기」
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hitsrc_teacher.js)의 함수를 감싸서 바꾼다.
 * ═══════════════════════════════════════════════════════════════════ */
HTS.rejudge=null; HTS.tbExtra=[]; HTS.fromSrc=false;

/* ── ① 다시 판정 모드로 열기 ── */
function hts2Running(){ return !!(HT.req && (HT.req.status==='requested'||HT.req.status==='running')); }
window.htsRejOpen = function(){
  var d=HT.cur?HT.data[HT.cur]:null; if(!d||!d.exam){ htToast('먼저 분석한 시험을 골라 주세요'); return; }
  var e=JSON.parse(JSON.stringify(d.exam));
  var R={ examId:d.examId||HT.cur, src:d.src?JSON.parse(JSON.stringify(d.src)):null, from:d.from||'', to:d.to||'' };
  htsOpen(e, { mydb:(e.mydb!=null&&e.mydb!=='')?e.mydb:null, title:e.subject||'', rejudge:R,
    warn:hts2Running()?'앞의 분석이 아직 진행 중입니다 — 끝난 뒤 「🔄 이 자료로 다시 판정」을 눌러 주세요.':'' });
};
/* 예전 「🔄 다시 판정」 단추 → 바로 요청하지 않고 같은 화면을 연다 */
window.htRejudge = function(){ htsRejOpen(); };

/* 요청 화면 열기 — 다시 판정 모드 표시만 더한다 (새 분석 입구에서는 늘 꺼진다) */
htsOpen=(function(o){ return function(exam, opt){
  HTS.rejudge=(opt&&opt.rejudge)||null; HTS.tbExtra=[]; HTS.fromSrc=false;
  return o(exam, opt); }; })(htsOpen);
window.htsClose=(function(o){ return function(){ HTS.rejudge=null; return o.apply(this, arguments); }; })(window.htsClose);

/* 자료 목록 받기 — 앞 부품과 같고, 다시 판정 모드면 «지난 판정 기간»과 «지난 판정에 쓴 자료(src)»를 덮는다 */
htsLoad = function(){
  var e=HTS.exam, R=HTS.rejudge; HTS.loading=true;
  return Promise.all([htKv('ms_papers_index'), htKv('exam_lib'), htKv('mf_textbooks'), htKv(htsCfgKey(e)), e.date?Promise.resolve(null):htKv('school_calendar')]).then(function(a){
    if(R!==HTS.rejudge || e!==HTS.exam) return;   /* 그새 다른 시험을 열었다 */
    HTS.idx=a[0]||null; HTS.lib=a[1]||{ items:[] }; HTS.tbMap=a[2]||{}; var cfg=a[3]||null;
    if(!e.date && a[4]){ var d=htsCalDate(a[4], e); if(d){ HTS.to=d; HTS.calDate=d; } }
    if(R){ if(R.from) HTS.from=R.from; if(R.to) HTS.to=R.to; }
    if(!HTS.to) HTS.to=new Date().toISOString().slice(0,10);
    if(cfg) htsApplyCfg(cfg);
    if(R && R.src) hts2ApplySrc(R.src);
    if(!HTS.subject && /^고/.test(htGradeKey(e.grade))){ var bs=htsTbBids(), bk=(HTS.tbMap.books||{}); if(bs.length===1){ var gname=String((bk[bs[0]]||{}).grade||''); if(HTS_COURSES.indexOf(gname)>=0) HTS.subject=gname; } }
    HTS.loading=false; if(VIEW==='examhit') render();
    return htsTbCheck(htsTbBids());
  }).then(function(){ if(VIEW==='examhit') render(); })
    .catch(function(err){ HTS.loading=false; HTS.err=String(err&&err.message||err); if(VIEW==='examhit') render(); });
};
/* 지난 판정의 src 를 화면 상태로 — 자동 체크와 다를 때만 켬/끔을 적는다 (htsMsTog 와 같은 방식) */
function hts2ApplySrc(src){
  var tb=src.tb||{}, bids=htsTbBids(), want={};
  HTS.tbMode=tb.mode==='scope'?'scope':'all'; HTS.tbOff={}; HTS.tbExtra=[];
  (tb.bids||[]).forEach(function(b){ want[String(b)]=1; });
  if(tb.on===false) bids.forEach(function(b){ HTS.tbOff[b]=1; });
  else if((tb.bids||[]).length){
    bids.forEach(function(b){ if(!want[b]) HTS.tbOff[b]=1; });
    HTS.tbExtra=Object.keys(want).filter(function(b){ return bids.indexOf(b)<0; });   /* 지금 지정에서 빠졌어도 지난번에 쓴 교과서는 보인다 */
  }
  var ms={}; (src.ms||[]).forEach(function(id){ ms[String(id)]=1; });
  HTS.msOn={}; HTS.msOff={};
  htsMsItems().forEach(function(x){ if(htsMsSelf(x)) return; var id=String(x.id), w=!!ms[id]; if(htsMsOn(x)!==w){ if(w) HTS.msOn[id]=1; else HTS.msOff[id]=1; } });
  var lib={}; (src.lib||[]).forEach(function(id){ lib[String(id)]=1; });
  HTS.libOn={}; HTS.libOff={};
  htsLibItems().forEach(function(x){ var id=String(x.id), w=!!lib[id]; if(htsLibOn(x)!==w){ if(w) HTS.libOn[id]=1; else HTS.libOff[id]=1; } });
  HTS.mf=src.mf!==false; HTS.fromSrc=true;
}
/* 교과서 목록 — 지정 교과서 + (다시 판정) 지난번에 썼지만 지금 지정에서 빠진 교과서 */
htsTbBids=(function(o){ return function(){
  var a=o(); (HTS.tbExtra||[]).forEach(function(b){ if(a.indexOf(b)<0) a.push(b); }); return a; }; })(htsTbBids);

/* 🔄 이 자료로 다시 판정 — 문항 나누기는 그대로, 고른 자료로 판정만 */
window.htsStart=(function(o){ return async function(){
  var R=HTS.rejudge; if(!R) return o.apply(this, arguments);
  if(HTS.busy) return;
  if(hts2Running()){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 시작해 주세요'); return; }
  var d=HT.data[R.examId]||{}, e=JSON.parse(JSON.stringify(d.exam||HTS.exam)), src=htsSrcValue();
  if(HTS.subject) e.subject=HTS.subject;
  HTS.busy='요청 남기는 중'; render();
  try{
    var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:R.examId, exam:e, rejudge:true,
      mydb:(e.mydb!=null&&e.mydb!=='')?e.mydb:null, from:HTS.from||'', to:HTS.to||'', src:src };
    await htKvSet('exam_hit_req', req); HT.req=req; HT.cur=R.examId; HTS.open=false; HTS.rejudge=null; HTS.busy=''; htPollMaybe();
    htToast('🔄 다시 판정을 요청했습니다 — 위 띠에 진행 상황이 보입니다');
  }catch(err){ HTS.busy=''; htToast('실패: '+(err&&err.message||err)); }
  render();
}; })(window.htsStart);

/* 요청 화면 머리·단추 — 다시 판정 모드 글자 */
htsPanelHtml=(function(o){ return function(){
  var h=o.apply(this, arguments), R=HTS.rejudge; if(!R) return h;
  h=h.replace('🎯 적중 분석 요청 — ', '🔄 다시 판정 — ')
    .replace('<button class="ht-btn no" onclick="htsClose()">← 돌아가기</button>', '<button class="ht-btn no" id="hts-back" onclick="htsClose()">← 결과로 돌아가기</button>')
    .replace('onclick="htsStart()">🎯 적중 분석 시작</button>', 'onclick="htsStart()">🔄 이 자료로 다시 판정</button>')
    .replace('<span style="color:#15803d">💾 기억한 구성으로 열었습니다</span>', HTS.fromSrc?'<span style="color:#15803d">📂 지난 판정에 쓴 자료로 열었습니다</span>':'<span style="color:#15803d">💾 기억한 구성으로 열었습니다</span>');
  if(HTS.fromSrc && h.indexOf('지난 판정에 쓴 자료로 열었습니다')<0){ var q=h.lastIndexOf('</p>'); if(q>0) h=h.slice(0,q)+' · <span style="color:#15803d">📂 지난 판정에 쓴 자료로 열었습니다</span>'+h.slice(q); }
  var info='<div class="ht-strip" id="hts-rej-info" style="display:block;margin:8px 0 0;background:#f5f3ff;border-color:#ddd6fe;color:#4c1d95">🔄 <b>다시 판정</b> — 문항 나누기는 그대로 두고, 아래에서 체크한 자료로 판정만 다시 합니다 (원장님이 확정한 ✓/✗ 는 남습니다). '
    +'📘 교과서 · 📂 수학비서 학습지 · 📄 PDF 자료함 · 🧮 매쓰플랫 네 칸에서 켜고 끈 뒤 「🔄 이 자료로 다시 판정」을 누르세요.</div>';
  var mk='<div class="hts-panels">', i=h.indexOf(mk), j=h.indexOf('자료 목록 불러오는 중…');
  if(i>=0) h=h.slice(0,i)+info+h.slice(i); else if(j>=0){ j=h.lastIndexOf('<div', j); h=h.slice(0,j)+info+h.slice(j); }
  return h; }; })(htsPanelHtml);

/* ── ③ 폴더 칩 — 체크한 학습지가 있는 폴더는 앞쪽에, «✓n» 표시 ── */
function hts2OnByFolder(){ var on={}; htsMsItems().forEach(function(x){ if(x.folder && htsMsOn(x)) on[x.folder]=(on[x.folder]||0)+1; }); return on; }
htsFolderList = function(){
  var cnt={}, g=HTS.exam.grade, GR=['고1','고2','고3','중1','중2','중3'], on=hts2OnByFolder();
  htsMsItems().forEach(function(x){ if(!x.folder) return; var c=cnt[x.folder]=cnt[x.folder]||{ n:0, ws:0 }; c.n++; if(!x.exam) c.ws++; });
  var head=[g].concat(HTS.folders.filter(function(f){ return f!==g; }));
  var chk=Object.keys(on).filter(function(f){ return head.indexOf(f)<0; }).sort(function(a,b){ return on[b]-on[a] || a.localeCompare(b); });
  var rest=Object.keys(cnt).filter(function(f){ return head.indexOf(f)<0 && chk.indexOf(f)<0; });
  rest.sort(function(a,b){ return (GR.indexOf(a)>=0?1:0)-(GR.indexOf(b)>=0?1:0) || cnt[b].ws-cnt[a].ws || cnt[b].n-cnt[a].n || a.localeCompare(b); });
  return head.concat(chk).concat(rest).map(function(f){ return { f:f, c:cnt[f]||{ n:0, ws:0 }, on:on[f]||0 }; });
};
htsMsPanel=(function(o){ return function(){
  var h=o.apply(this, arguments); if(!HTS.idx) return h;
  var on=hts2OnByFolder();
  h=h.replace(/(<button class="ht-chip[^"]*"[^>]*data-htsf="([^"]*)"[^>]*>)([^<]*)(<\/button>)/g, function(all, a, f, t, c){
    var n=on[f]||0; for(var k in on){ if(htEsc(k)===f){ n=on[k]; break; } }
    return n?(a+t+' <b style="color:#6d28d9" data-htsn="'+n+'">✓'+n+'</b>'+c):all; });
  var others=Object.keys(on).filter(function(f){ return f!==HTS.folder; });
  if(others.length){
    var btns=others.map(function(f){ return '<button class="ht-btn" style="padding:2px 8px;font-size:11px" data-htsgo="'+htEsc(f)+'" onclick="htsFolder(\''+htEsc(f).replace(/'/g,'')+'\')">'+htEsc(f)+' '+on[f]+'장</button>'; }).join(' ');
    h=h.replace(/<div class="ht-sub" style="font-size:11px">다른 폴더에서 체크한 것 (\d+)장 포함<\/div>/, function(all, n){
      return '<div class="ht-sub" style="font-size:11px;display:flex;gap:5px;flex-wrap:wrap;align-items:center" id="hts-other">다른 폴더에서 체크한 것 '+n+'장 포함 — '+btns+'</div>'; });
  }
  return h; }; })(htsMsPanel);

/* ── ①④ 결과 화면 — 머리 단추 · 이번 판정에 쓴 자료 한 줄 ── */
function hts2UsedLine(d){
  var s=d.src, bk=(d.stats&&d.stats.byKind)||{}, mt=function(k){ var n=(bk[k]||{}).mats||0; return n?('('+n.toLocaleString()+'문항)'):''; };
  var mfN=((bk.ws||{}).mats||0)+((bk.book||{}).mats||0), mfT=mfN?('('+mfN.toLocaleString()+'문항)'):'';
  if(!s){
    var p=[], n=function(k){ return ((bk[k]||{}).mats||0).toLocaleString()+'문항'; };
    if((bk.textbook||{}).mats) p.push('교과서 '+n('textbook')); if((bk.ms||{}).mats) p.push('학원 대비 학습지 '+n('ms')); if((bk.upload||{}).mats) p.push('프린트 '+n('upload'));
    p.push('루멘수학 학습지·교재 자동'+mfT);
    return p.join(' · ')+' <span style="color:#94a3b8">(자료를 고르기 전 방식으로 판정한 시험)</span>';
  }
  var tb=s.tb||{}, nb=(tb.bids||[]).length;
  var tbT=tb.on===false?'교과서 0권':(nb?('교과서 '+nb+'권'):'교과서 지정 전체')+(tb.mode==='scope'?' (시험 범위 단원만)':'')+mt('textbook');
  return [tbT, '학원 대비 학습지 '+(s.ms||[]).length+'장'+mt('ms'), '프린트 '+(s.lib||[]).length+'장'+mt('upload'),
    '루멘수학 학습지·교재 '+(s.mf===false?'끔':('자동'+mfT))].join(' · ');
}
htsByKindHtml=(function(o){ return function(d){
  var h=o(d), mk='<div class="hts-bar"', i=h.indexOf(mk); if(i<0) return h;
  var line='<div class="ht-sub" id="hts-used" style="font-size:11.5px;margin:0 0 6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span>이번 판정에 쓴 자료: <b style="color:#0f172a">'+hts2UsedLine(d)+'</b></span>'
    +'<a href="javascript:void(0)" id="hts-used-edit" onclick="htsRejOpen()" style="color:#6d28d9;font-weight:900;text-decoration:underline">바꾸기</a></div>';
  return h.slice(0,i)+line+h.slice(i); }; })(htsByKindHtml);
htSummaryHtml=(function(o){ return function(d){
  var h=o(d), mk='<label class="ht-sub" style="display:flex;gap:6px;align-items:center">적중 기준 ', i=h.indexOf(mk); if(i<0) return h;
  var btn='<button class="ht-btn" id="hts-rej-btn" onclick="htsRejOpen()" title="교과서 · 수학비서 학습지 · PDF 자료함 · 매쓰플랫 중 무엇으로 판정할지 고른 뒤 다시 판정합니다" style="background:#6d28d9;color:#fff;border-color:#6d28d9;font-weight:900">📂 우리 자료 고르기 → 다시 판정</button>';
  return h.slice(0,i)+btn+h.slice(i); }; })(htSummaryHtml);
