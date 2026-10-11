/* ═══════════════════════════════════════════════════════════════════
 * v19-107: 🎯 적중 분석 요청 화면 — 수학비서 «📄 내 문제지» · «🗄 나만의 DB» 두 탭 + 「범위: 전체 / 시험 범위 단원만」
 * 원장 2026-10-11 「수학비서는 DB 와 내 문제지가 다르다. 내 문제지가 내가 만든 것이다. 그리고 수학비서 폴더 형태와 똑같아야 헷갈리지 않는다.」
 *   예전엔 «나만의 DB»(산 자료·기출)만 보였다. 원장님이 학생에게 나눠 준 프린트는 «내 문제지»에 있다.
 *
 *  ① 📂 수학비서 칸에 두 탭 — 「📄 내 문제지」(기본) · 「🗄 나만의 DB」.
 *     둘 다 수학비서와 똑같은 폴더 나무(이름 · 겹침 · 순서 · 펼치기/접기 · 파일 수)로, 폴더 아래에 문제지(제목 · 문항 수 · 만든 날 · 상태).
 *     내 문제지 = ms_mypapers_index { tree, items } (워커 --prep · --mypapers-index) · 나만의 DB = ms_papers_index.tree (없으면 예전 폴더 칩 화면)
 *  ② 내 문제지 자동 체크 — 기간 안에 만든 것 중 폴더가 「교과서 변형」이거나 그 시험 학교 폴더(범박고 등)인 것.
 *     「통합기출」 폴더 · 제목이 「내신」으로 시작하거나 「기출」이 든 것 · 「25년 …」처럼 연도로 시작하는 것(지난 시험) · 다른 과목 · 다른 학교 이름 → 꺼 둠.
 *     누르면 뒤집고(자동과 다를 때만 mpOn/mpOff 에 적는다), 「💾 이 구성 기억」 = exam_hit_src_<학교>_<학년>.mpOn/mpOff → 새벽에 미리 인식.
 *     요청 exam_hit_req.src.mp = [내 문제지 id…] (서버는 «학원 문제지»로 대조 — kind 'ms', 키 mp:<id>:<번호>)
 *  ③ 「범위: 전체 / 시험 범위 단원만」(머리, 기간 옆) — 모든 자료(교과서 · 내 문제지 · 나만의 DB · 프린트 · 매쓰플랫)에서
 *     시험 문항의 소단원(mf_typedb)에 없는 문항을 서버가 뺀다. src.scope='exam' (+ src.tb.mode='scope'), 기억 scope.
 *     시험 단원은 결과의 units(새 워커) 또는 문항 유형(중단원 › 유형 이름 → mf_typedb 소단원)으로 칩으로 보인다(읽기만).
 *     목록에서 인식된 문제지마다 「범위 밖 n문항」 (ms_mypaper_<id> · ms_paper_<id> 문항 유형으로 셈).
 *  ④ 결과 화면 「이번 판정에 쓴 자료」 — 학원 문제지 n장을 따로 센다.
 *  서버: sync/exam_hit_worker.js (buildMsMyPaper · loadMpMats · 시험 범위 거르기) · docs/exam_hit_contract.md §10-6
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hitsrc · hitsrc2 · layout3_hit)의 함수를 감싸서 바꾼다.
 * ═══════════════════════════════════════════════════════════════════ */
HTS.msTab='mp'; HTS.mpIdx=null; HTS.mpOn={}; HTS.mpOff={}; HTS.tOpen={ mp:{}, db:{} }; HTS.tMore={}; HTS.scope='all'; HTS.pcache={}; HTS.unitIx=null; HTS.unitLoading=false;

var MST_SUBJ=[[/공통\s*수학\s*(1|Ⅰ)|공수\s*1/,'공통수학1'],[/공통\s*수학\s*(2|Ⅱ)|공수\s*2/,'공통수학2'],[/대수/,'대수'],[/미적분\s*(2|Ⅱ|II)/,'미적분2'],[/미적분/,'미적분1'],
  [/확률\s*과\s*통계|확통/,'확률과 통계'],[/기하/,'기하'],[/중등|중\s*[1-3]\s*-\s*[12]/,'중등']];
function mstNz(t){ return String(t||'').replace(/\s/g,''); }
function mstSubjOf(t){ t=String(t||''); for(var i=0;i<MST_SUBJ.length;i++){ if(MST_SUBJ[i][0].test(t)) return MST_SUBJ[i][1]; } return ''; }

/* ── 내 문제지 — 자동 체크 규칙 ── */
function mstMpItems(){ return (HTS.mpIdx&&HTS.mpIdx.items)||[]; }
function mstSegs(x){ return String(x.folderPath||'').split(' › ').map(function(s){ return s.trim(); }); }
function mstMpExam(x){   /* 다른 학교·지난 시험 기출 */
  var t=String(x.title||'');
  return /통합기출/.test(String(x.folderPath||'')) || /^\s*내신/.test(t) || /기출/.test(t) || /^\s*\[?\s*(\d{2}|20\d\d)\s*(-\s*\d{2})?\s*년/.test(t);
}
function mstSchools(){   /* 폴더 이름 중 학교 이름(…중 · …고) */
  var out=[]; (function walk(fs){ (fs||[]).forEach(function(f){ if(/^[가-힣]{1,5}[중고]$/.test(mstNz(f.n))) out.push(mstNz(f.n)); walk(f.c); }); })((HTS.mpIdx&&HTS.mpIdx.tree)||[]);
  return out;
}
function mstMpOther(x){   /* 다른 과목 · 다른 학교 → 꺼 둠 (이유 글) */
  var t=String(x.title||''), s=mstSubjOf(t), sub=String(HTS.subject||'');
  if(sub && s && s!==sub && !(s==='중등' && /^중/.test(htGradeKey(HTS.exam.grade)))) return '다른 과목';
  var me=htSchoolKey(HTS.exam.school), sc=mstSchools();
  for(var i=0;i<sc.length;i++){ if(sc[i]!==me && mstNz(t).indexOf(sc[i])>=0) return '다른 학교'; }
  return '';
}
function mstMpFolderOk(x){ var s=mstSegs(x); return s[s.length-1]==='교과서 변형' || s.indexOf(htSchoolKey(HTS.exam.school))>=0; }
function mstMpIn(x){ var d=String(x.createdAt||'').slice(0,10); return !!d && d>=HTS.from && d<=HTS.to; }
function mstMpAuto(x){ return (Number(x.n)||0)>0 && mstMpIn(x) && mstMpFolderOk(x) && !mstMpExam(x) && !mstMpOther(x); }
function mstMpOn(x){ var id=String(x.id); if(HTS.mpOff[id]) return false; if(HTS.mpOn[id]) return true; return mstMpAuto(x); }
window.mstMpTog = function(id){
  var x=mstMpItems().filter(function(i){ return String(i.id)===String(id); })[0]; if(!x) return;
  id=String(id); var want=!mstMpOn(x); delete HTS.mpOn[id]; delete HTS.mpOff[id];
  if(mstMpAuto(x)!==want){ if(want) HTS.mpOn[id]=1; else HTS.mpOff[id]=1; }
  render();
};
window.mstTab = function(t){ HTS.msTab=t==='db'?'db':'mp'; render(); };
window.mstFold = function(tab, id, open){ HTS.tOpen[tab][String(id)]=!!open; render(); };
window.mstMore = function(k){ HTS.tMore[k]=true; render(); };

/* ── 열기 · 불러오기 · 기억 ── */
htsOpen=(function(o){ return function(exam, opt){
  HTS.mpOn={}; HTS.mpOff={}; HTS.tOpen={ mp:{}, db:{} }; HTS.tMore={}; HTS.scope='all'; HTS.pcache={}; HTS.msTab='mp';
  return o(exam, opt); }; })(htsOpen);
htsLoad=(function(o){ return function(){
  var e=HTS.exam, self=this, args=arguments; HTS.loading=true;
  return htKv('ms_mypapers_index').catch(function(){ return null; }).then(function(v){
    if(e!==HTS.exam) return;
    HTS.mpIdx=(v&&v.items)?v:null; HTS.msTab=HTS.mpIdx?'mp':'db';   /* 목록이 아직 없으면(새벽 준비 전) 예전처럼 나만의 DB */
    return o.apply(self, args);
  }).then(function(r){ if(HTS.open && (HTS.scope==='exam' || HTS.rejudge)) mstLoadUnits(); return r; });
}; })(htsLoad);
htsApplyCfg=(function(o){ return function(c){
  o(c); HTS.mpOn=JSON.parse(JSON.stringify(c.mpOn||{})); HTS.mpOff=JSON.parse(JSON.stringify(c.mpOff||{}));
  if(c.scope==='exam'){ HTS.scope='exam'; HTS.tbMode='scope'; } else if(c.scope==='all') HTS.scope='all';
}; })(htsApplyCfg);
/* 다시 판정 — 지난 판정에 쓴 내 문제지 · 범위 */
hts2ApplySrc=(function(o){ return function(src){
  o(src);
  var mp={}; (src.mp||[]).forEach(function(id){ mp[String(id)]=1; });
  HTS.mpOn={}; HTS.mpOff={};
  mstMpItems().forEach(function(x){ var id=String(x.id), w=!!mp[id]; if(mstMpAuto(x)!==w){ if(w) HTS.mpOn[id]=1; else HTS.mpOff[id]=1; } });
  HTS.scope=src.scope==='exam'?'exam':'all'; if(HTS.scope==='exam') HTS.tbMode='scope';
}; })(hts2ApplySrc);
htsCfgValue=(function(o){ return function(){
  var v=o(); v.mpOn=JSON.parse(JSON.stringify(HTS.mpOn)); v.mpOff=JSON.parse(JSON.stringify(HTS.mpOff)); v.scope=HTS.scope==='exam'?'exam':'all'; return v; }; })(htsCfgValue);
htsSrcValue=(function(o){ return function(){
  var v=o(); v.mp=mstMpItems().filter(mstMpOn).map(function(x){ return String(x.id); });
  v.scope=HTS.scope==='exam'?'exam':'all'; if(v.scope==='exam' && v.tb) v.tb.mode='scope';
  return v; }; })(htsSrcValue);
htsCounts=(function(o){ return function(){
  var c=o(); c.mp=0; c.mpN=0;
  mstMpItems().forEach(function(x){ if(!mstMpOn(x)) return; c.mpN++; var n=Number(x.n)||0; c.mp+=n; c.ms+=n; if(x.status==='ready') c.ok+=n; else { c.wait+=n; c.waitN++; } });
  if(c.mpN && !c.msN) c.kinds++;
  c.all=c.tb+c.ms+c.pdf;
  return c; }; })(htsCounts);
window.htsTbMode=(function(o){ return function(m){ if(m!=='scope' && HTS.scope==='exam') HTS.scope='all'; return o(m); }; })(window.htsTbMode);

/* ── 시험 범위 단원 ── */
window.mstScope = function(v){ HTS.scope=v==='exam'?'exam':'all'; HTS.tbMode=HTS.scope==='exam'?'scope':'all'; if(HTS.scope==='exam') mstLoadUnits(); render(); };
function mstLoadUnits(){
  if(HTS.unitIx||HTS.unitLoading) return Promise.resolve();
  HTS.unitLoading=true;
  return Promise.all([htKv('mf_typedb'), htKv('mf_concept_names')]).then(function(a){
    var litOf={}, t=a[0]||{};
    (t.grades||[]).forEach(function(g){ (g.b||[]).forEach(function(b){ (b.m||[]).forEach(function(m){ (m.s||[]).forEach(function(l){ (l.t||[]).forEach(function(ty){
      var k=mstNz(m.n)+'|'+mstNz(ty); if(!litOf[k]) litOf[k]=l.n; }); }); }); }); });
    HTS.unitIx={ litOf:litOf, names:a[1]||{} }; HTS.unitLoading=false; if(HTS.open && VIEW==='examhit') render();
  }).catch(function(){ HTS.unitLoading=false; HTS.unitIx={ litOf:{}, names:{} }; });
}
function mstUnitOfName(mid, type){ var U=HTS.unitIx; if(!U||!mid) return null; return { mid:mid, lit:U.litOf[mstNz(mid)+'|'+mstNz(type)]||'' }; }
function mstUnitOfCid(cid){ var U=HTS.unitIx; if(!U||!cid) return null; var n=U.names[cid]; if(!n) return null; return mstUnitOfName(n.m||'', n.n||''); }
/* 시험 단원 — 결과의 units(새 워커) → 없으면 문항의 중단원·유형 이름으로 */
function mstExamUnits(){
  var R=HTS.rejudge, d=R?HT.data[R.examId]:null; if(!d) return null;
  var list=[];
  if(Array.isArray(d.units) && d.units.length) list=d.units.slice();
  else { if(!HTS.unitIx) return { list:[], lits:{}, mids:{}, wait:true }; var seen={};
    (d.items||[]).forEach(function(it){ var u=it.chapter?mstUnitOfName(it.chapter, it.type):mstUnitOfCid(it.cid); if(!u) return; var k=u.mid+'|'+u.lit; if(!seen[k]){ seen[k]=1; list.push(u); } }); }
  var lits={}, mids={}, nl=0, nm=0; list.forEach(function(u){ if(u.lit&&!lits[u.lit]){ lits[u.lit]=1; nl++; } if(u.mid&&!mids[u.mid]){ mids[u.mid]=1; nm++; } });
  return { list:list, lits:lits, mids:mids, nl:nl, nm:nm };
}
function mstInScope(cid, X){   /* 워커 inScope 와 같은 규칙 — 유형이 없거나 단원을 모르면 남긴다 */
  if(!cid) return true; var u=mstUnitOfCid(cid); if(!u) return true;
  if(u.lit && X.nl) return !!X.lits[u.lit];
  if(u.mid && X.nm) return !!X.mids[u.mid];
  return true;
}
/* 인식된 문제지의 범위 밖 문항 수 (문항은 필요할 때 한 번만 받는다) */
function mstOutN(kind, id){
  if(HTS.scope!=='exam' || !HTS.unitIx) return null;
  var X=mstExamUnits(); if(!X || !(X.nl||X.nm)) return null;
  var k=kind+':'+id, p=HTS.pcache[k];
  if(p===undefined){ HTS.pcache[k]=null; htKv((kind==='mp'?'ms_mypaper_':'ms_paper_')+id).then(function(v){ HTS.pcache[k]=v||false; if(HTS.open) render(); }).catch(function(){ HTS.pcache[k]=false; }); return null; }
  if(!p || p.status!=='ready') return null;
  var n=0; (p.items||[]).forEach(function(it){ if(!mstInScope(it.cid, X)) n++; }); return n;
}
function mstScopeRow(){
  var on=HTS.scope==='exam', X=mstExamUnits();
  var h='<div class="ht-sub" id="mst-scope" style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">범위 <span class="hts-seg"><button id="mst-scope-all" class="'+(on?'':'on')+'" onclick="mstScope(\'all\')">전체</button><button id="mst-scope-exam" class="'+(on?'on':'')+'" onclick="mstScope(\'exam\')">시험 범위 단원만</button></span>';
  if(!X) h+='<span style="font-size:11px">'+(on?'서버가 시험지를 인식한 뒤 그 문항의 소단원에 없는 자료 문항을 모든 자료에서 뺍니다':'모든 자료(교과서 · 내 문제지 · 나만의 DB · 프린트 · 매쓰플랫)에 같이 걸립니다')+'</span>';
  else if(X.wait) h+='<span style="font-size:11px">시험 단원 불러오는 중…</span>';
  else if(!X.list.length) h+='<span style="font-size:11px">시험 문항의 단원을 몰라 전체를 씁니다</span>';
  else {
    var byMid={}, order=[]; X.list.forEach(function(u){ var m=u.mid||'(단원)'; if(!byMid[m]){ byMid[m]=[]; order.push(m); } if(u.lit && byMid[m].indexOf(u.lit)<0) byMid[m].push(u.lit); });
    h+='<span style="font-size:11px">시험 단원</span>'+order.map(function(m){
      return '<span class="mst-u" data-mstu="'+htEsc(m)+'" title="소단원: '+htEsc(byMid[m].join(', '))+'" style="display:inline-block;padding:2px 8px;border-radius:999px;background:'+(on?'#ede9fe':'#f1f5f9')+';color:'+(on?'#5b21b6':'#475569')+';font-size:11px;font-weight:800">'+htEsc(m)+(byMid[m].length?(' <small style="font-weight:700">('+byMid[m].length+')</small>'):'')+'</span>'; }).join(' · ');
  }
  return h+'</div>';
}

/* ── 폴더 나무 (수학비서와 같은 이름 · 겹침 · 순서) ── */
function mstPapersBy(tab){
  var by={};
  if(tab==='mp') mstMpItems().forEach(function(x){ (by[x.folderId]=by[x.folderId]||[]).push(x); });
  else htsMsItems().forEach(function(x){ if(x.fid!=null) (by[x.fid]=by[x.fid]||[]).push(x); });
  return by;
}
function mstMpRow(x, pad){
  var on=mstMpOn(x), ex=mstMpExam(x), oth=mstMpOther(x), out=x.status==='ready'?mstOutN('mp', x.id):null, cfgOn=HTS.cfg&&HTS.cfg.mpOn&&HTS.cfg.mpOn[String(x.id)];
  var st=x.status==='ready'?'<span class="hts-st ok">인식됨</span>':(x.status==='error'?'<span class="hts-st no">인식 실패</span>':(on?(cfgOn?'<span class="hts-st wait">새벽 인식</span>':'<span class="hts-st wait">분석 때 인식</span>'):''));
  return '<div class="hts-row'+(on?'':' dim')+'" data-hts="mp:'+htEsc(x.id)+'" tabindex="0" style="margin-left:'+pad+'px" onclick="mstMpTog(\''+htEsc(x.id)+'\')">'+htsCb(on)+'<span class="hts-t"><b>'+htEsc(x.title||'(제목 없음)')+'</b><small>'
    +(x.n?(x.n+'문항'):'문항 0')+(x.createdAt?(' · 만든 날 '+htsMd(x.createdAt)):'')+(x.progress==='editing'?' · 만드는 중':'')
    +(ex?' · 다른 학교·지난 기출':'')+(oth?(' · '+oth):'')+(!ex&&!oth&&!mstMpIn(x)?' · 기간 밖':'')
    +(out!=null?(' · <b class="mst-out" data-mstout="'+out+'" style="display:inline;color:'+(out?'#b45309':'#15803d')+'">범위 밖 '+out+'문항</b>'):'')+'</small></span>'+st+'</div>';
}
function mstDbRow(x, pad){
  var on=htsMsOn(x), self=htsMsSelf(x), out=x.status==='ready'?mstOutN('ms', x.id):null, gf=['고1','고2','고3','중1','중2','중3'].indexOf(x.folder)>=0;
  var st=x.status==='ready'?'<span class="hts-st ok">인식됨</span>':(x.status==='error'?'<span class="hts-st no">인식 실패</span>':(x.exam?'':(gf?'<span class="hts-st wait">새벽 인식</span>':'<span class="hts-st wait">분석 때 인식</span>')));
  return '<div class="hts-row'+(on?'':' dim')+'" data-hts="ms:'+htEsc(x.id)+'" tabindex="0" style="margin-left:'+pad+'px" onclick="htsMsTog(\''+htEsc(x.id)+'\')">'+htsCb(on)+'<span class="hts-t"><b>'+htEsc(x.title)+'</b><small>'
    +(x.exam?'다른 학교·지난 기출 · ':'')+(self?'분석 대상 시험지 자체 — 자료로는 안 씀 · ':'')+(x.uploadedAt?('올린 날 '+htsMd(x.uploadedAt)+' · '):'')+(x.n?(x.n+'문항'):'문항 수 모름')
    +(out!=null?(' · <b class="mst-out" data-mstout="'+out+'" style="display:inline;color:'+(out?'#b45309':'#15803d')+'">범위 밖 '+out+'문항</b>'):'')+'</small></span>'+st+'</div>';
}
function mstTreeHtml(tab){
  var tree=tab==='mp'?((HTS.mpIdx&&HTS.mpIdx.tree)||[]):((HTS.idx&&HTS.idx.tree)||[]), by=mstPapersBy(tab), onF=tab==='mp'?mstMpOn:htsMsOn;
  /* 폴더마다 체크 수(아래 폴더 포함) — 체크가 있는 폴더는 처음부터 펼친다 */
  var onN={}; (function cnt(fs){ (fs||[]).forEach(function(f){ var n=(by[f.id]||[]).filter(onF).length; cnt(f.c); (f.c||[]).forEach(function(ch){ n+=onN[ch.id]||0; }); onN[f.id]=n; }); })(tree);
  var h='';
  (function walk(fs, depth){
    (fs||[]).forEach(function(f){
      var st=HTS.tOpen[tab][String(f.id)], open=st===undefined?(depth===0||onN[f.id]>0):st, kids=(f.c||[]).length, papers=by[f.id]||[];
      h+='<div class="mst-f" data-mstf="'+tab+':'+htEsc(f.id)+'" data-depth="'+depth+'" tabindex="0" onclick="mstFold(\''+tab+'\',\''+htEsc(f.id)+'\','+(open?'false':'true')+')" style="display:flex;gap:6px;align-items:center;padding:4px 6px;margin-left:'+(depth*14)+'px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:800;color:#0f172a;background:'+(open?'#f8fafc':'#fff')+'">'
        +'<span style="width:12px;color:#64748b">'+((kids||papers.length)?(open?'▾':'▸'):'·')+'</span><span>📁</span><span class="mst-fn" style="min-width:0;overflow-wrap:anywhere">'+htEsc(f.n)+'</span>'
        +'<small class="mst-fc" style="color:#64748b;font-weight:700">'+(f.tc!=null?f.tc:papers.length)+'</small>'+(onN[f.id]?('<b style="color:#6d28d9;font-size:11px">✓'+onN[f.id]+'</b>'):'')+'</div>';
      if(!open) return;
      walk(f.c, depth+1);
      var k=tab+':'+f.id, lim=HTS.tMore[k]?400:12, pad=depth*14+18;
      papers.slice(0,lim).forEach(function(x){ h+=tab==='mp'?mstMpRow(x, pad):mstDbRow(x, pad); });
      if(papers.length>lim) h+='<button class="ht-btn" style="padding:2px 8px;font-size:11px;margin-left:'+pad+'px" onclick="mstMore(\''+htEsc(k)+'\')">더 보기 ('+(papers.length-lim)+'장 더)</button>';
    });
  })(tree, 0);
  return '<div class="mst-tree" data-msttree="'+tab+'" style="display:flex;flex-direction:column;gap:3px;max-height:560px;overflow:auto">'+h+'</div>';
}
/* 📂 수학비서 칸 — 두 탭. 내 문제지 목록이 없거나 나만의 DB 에 나무가 없으면 그 탭은 예전 화면 */
htsMsPanel=(function(o){ return function(){
  if(!HTS.mpIdx) return o.apply(this, arguments);
  var mpAll=mstMpItems().filter(mstMpOn), dbAll=htsMsItems().filter(htsMsOn), nq=0;
  mpAll.forEach(function(x){ nq+=Number(x.n)||0; }); dbAll.forEach(function(x){ nq+=Number(x.n)||0; });
  var tab=HTS.msTab==='db'?'db':'mp';
  var h='<div class="hts-pn" id="hts-ms"><h3><span>'+htsDot('ms')+'📂 수학비서</span><span class="hts-cnt" id="hts-msCnt">내 문제지 '+mpAll.length+'장 · 나만의 DB '+dbAll.length+'장 · '+nq+'문항</span></h3>'
    +'<div class="hts-seg" id="mst-tabs" style="align-self:flex-start"><button data-msttab="mp" class="'+(tab==='mp'?'on':'')+'" onclick="mstTab(\'mp\')">📄 내 문제지 ('+mpAll.length+')</button><button data-msttab="db" class="'+(tab==='db'?'on':'')+'" onclick="mstTab(\'db\')">🗄 나만의 DB ('+dbAll.length+')</button></div>';
  if(tab==='mp'){
    h+='<div class="ht-sub" style="font-size:11.5px">원장님이 만든 프린트 · 기간 안('+htsMd(HTS.from)+'~'+htsMd(HTS.to)+')에 만든 「교과서 변형」 · 「'+htEsc(htSchoolKey(HTS.exam.school))+'」 폴더 문제지는 자동 체크 · 통합기출·다른 학교 기출·다른 과목은 꺼 둠 (나눠 준 것이면 켜세요)</div>';
    return h+mstTreeHtml('mp')+'</div>';
  }
  if(!(HTS.idx && (HTS.idx.tree||[]).length && htsMsItems().some(function(x){ return x.fid!=null; }))){   /* 나무가 아직 없는 옛 목록 → 예전 폴더 칩 화면을 탭 안에 */
    var old=o.apply(this, arguments), i=old.indexOf('</h3>');
    return i>=0 ? h+old.slice(i+5) : old;
  }
  h+='<div class="ht-sub" style="font-size:11.5px">산 자료·기출 DB · 학년 폴더('+htEsc(HTS.exam.grade)+')의 기간 안 학습지는 자동 체크 · 다른 학교 기출은 꺼 둠</div>';
  return h+mstTreeHtml('db')+'</div>';
}; })(htsMsPanel);
/* 요청 화면 머리 — 기간 옆에 「범위」 줄 */
htsPanelHtml=(function(o){ return function(){
  var h=o.apply(this, arguments); if(HTS.loading) return h;
  var i=h.indexOf('onclick="htsClose()"'), j=i>=0?h.indexOf('</div></div>', i):-1;
  if(j<0) return h; j+='</div></div>'.length;
  return h.slice(0,j)+mstScopeRow()+h.slice(j); }; })(htsPanelHtml);
/* 교과서 칸 — 범위가 «시험 범위 단원만»이면 그 뜻을 한 줄 */
htsTbPanel=(function(o){ return function(){
  var h=o.apply(this, arguments); if(HTS.scope!=='exam') return h;
  return h.replace(/<\/div>$/, '<div class="ht-sub" style="font-size:11px;color:#5b21b6">위 「범위: 시험 범위 단원만」이 모든 자료에 걸려 있습니다.</div></div>'); }; })(htsTbPanel);

/* ── 결과 화면 — 학원 문제지를 따로 센다 ── */
htsKindLabel=(function(o){ return function(m){ if(m && m.mp) return '📄 학원 문제지'; return o(m); }; })(htsKindLabel);
hts2UsedLine=(function(o){ return function(d){
  var s=d.src, bk=(d.stats&&d.stats.byKind)||{}, mp=((bk.ms||{}).mp)||null;
  if(!s || (!(s.mp||[]).length && !mp && s.scope!=='exam')) return o(d);
  var tot=(bk.ms||{}).mats||0, mpN=mp?(mp.mats||0):0, msN=Math.max(0, tot-mpN), q=function(n){ return n?('('+n.toLocaleString()+'문항)'):''; };
  var mfN=((bk.ws||{}).mats||0)+((bk.book||{}).mats||0), tb=s.tb||{}, nb=(tb.bids||[]).length;
  var tbT=tb.on===false?'교과서 0권':((nb?('교과서 '+nb+'권'):'교과서 지정 전체')+q((bk.textbook||{}).mats||0));
  var p=[tbT, '학원 문제지 '+(s.mp||[]).length+'장'+q(mpN), '학원 대비 학습지 '+(s.ms||[]).length+'장'+q(msN), '프린트 '+(s.lib||[]).length+'장'+q((bk.upload||{}).mats||0),
    '루멘수학 학습지·교재 '+(s.mf===false?'끔':('자동'+q(mfN)))];
  if(s.scope==='exam'){ var dr=0; Object.keys(bk).forEach(function(k){ dr+=(bk[k]||{}).scopeDropped||0; }); p.push('시험 범위 단원만'+(dr?(' (범위 밖 '+dr.toLocaleString()+'문항 뺌)'):'')); }
  return p.join(' · ');
}; })(hts2UsedLine);
if(typeof l3hSrcBox==='function') l3hSrcBox=(function(o){ return function(d){
  var h=o(d), s=d.src, mp=(((d.stats||{}).byKind||{}).ms||{}).mp; if(!s || !(s.mp||[]).length) return h;
  var n=mp?(mp.mats||0):0, add=l3hCk(true, '학원 문제지 '+s.mp.length+'장'+(n?(' <small style="color:#64748b;font-weight:700">('+n.toLocaleString()+'문항)</small>'):''), 'mp');
  var i=h.indexOf('<span class="l3-ck" data-l3h-src="ms">'); return i>=0 ? h.slice(0,i)+add+h.slice(i) : h; }; })(l3hSrcBox);
