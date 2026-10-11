/* ═══════════════════════════════════════════════════════════════════
 * v19-110: 📚 적중 분석 — 「출판사 교과서 출처」 (매쓰플랫에 있는 그 과목 모든 출판사 교과서와 그림 비교)
 * 원장 요청 2026-10-11: 「매쓰플랫에 교과서 출판사별로 여러 가지가 있다. 그 자료와 이번 범박고 1, 2학년 기출 시험지와 비교해서
 *   숫자변형 문제가 어느 출판사에서 나왔는지 찾을 수 있나? 비상교육인데 다른 출판사에서 출제한 것 같다.
 *   비상교육도 포함해서 모든 출판사의 교과서」
 *  [서버] sync/exam_hit_worker.js pubCompare — 시험 과목(공통수학2 · 미적분1 …)의 모든 출판사 교과서 은행(mf_textbook_<bid>,
 *         sync/mf_textbook_bank.js --subject 과목)에서 시험 문항과 유형 번호가 같은 문항을 출판사마다 전부(최대 15개) → 그림 판정
 *         → it.pub = [{ k:'pub:<문항id>', bid, pub, page, no, kind, why, imgUrl }] · stats.pub = { subject, books, by:{출판사:{same,var,text,type,nos}}, items }
 *         우리 자료 적중률 · 지난 기출 비교와 따로 센다. 고등부만.
 *  ① 결과 요약 — 「📚 출판사 교과서 출처」 칸: 출판사별 같은 문제 · 숫자변형 · 지문 겹침 수와 시험 문항 번호, 가장 많은 출판사 강조
 *     + 「📚 출판사 비교만 다시」 단추 → exam_hit_req { only:'pub' } (우리 자료·지난 기출 판정은 그대로)
 *  ② 문항 카드 — 「📚 출판사 교과서」 줄: 같은 문제·숫자변형·지문 겹침 후보 그림(출판사 · 쪽 · 번호) · ✗ 아님
 *  ③ 블로그 자료(.md) — 「## 출판사 교과서 출처」 한 단락 (출판사 이름은 써도 된다 · 「매쓰플랫」 낱말 없음)
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품의 함수를 감싸서 바꾼다. stats.pub 가 없는 결과는 예전 화면 그대로.
 * ═══════════════════════════════════════════════════════════════════ */
var PB_ORDER = { same:4, 'var':3, text:2, type:1 };
function pbHas(d){ return !!(d && d.stats && d.stats.pub); }
function pbLive(it){ return (it.pub||[]).filter(function(p){ return !p.rejected; }).sort(function(a,b){ return (PB_ORDER[b.kind]||0)-(PB_ORDER[a.kind]||0); }); }
/* 화면에서 다시 센다 (✗ 아님 반영) — 출판사마다 그 문항에서 가장 닮은 것 하나 */
function pbStats(d){
  var P=(d.stats&&d.stats.pub)||{}, by={}, items=0;
  (P.books||[]).forEach(function(b){ by[b.pub]={ same:0, 'var':0, text:0, nos:[], n:b.n }; });
  htVisible(d).forEach(function(it){
    var best={}, L=pbLive(it);
    L.forEach(function(x){ if(!best[x.pub] || PB_ORDER[x.kind]>PB_ORDER[best[x.pub]]) best[x.pub]=x.kind; });
    Object.keys(best).forEach(function(pb){ if(!by[pb]) by[pb]={ same:0, 'var':0, text:0, nos:[], n:0 }; if(by[pb][best[pb]]!=null) by[pb][best[pb]]++; if(best[pb]==='same'||best[pb]==='var') by[pb].nos.push(htNumOf(d,it)); });
    if(L[0] && (L[0].kind==='same'||L[0].kind==='var')) items++;
  });
  var rows=Object.keys(by).map(function(pb){ var r=by[pb]; r.pub=pb; r.sv=r.same+r['var']; r.nos.sort(function(a,b){ return a-b; }); return r; });
  rows.sort(function(a,b){ return b.sv-a.sv || b.same-a.same || b.text-a.text || a.pub.localeCompare(b.pub,'ko'); });
  return { rows:rows, items:items, subject:P.subject||'' };
}
function pbWhere(p){ return p ? (p.pub+' '+p.page+'쪽 '+String(p.no||'').replace(/\s*번$/,'')+'번') : ''; }

/* ── ① 요약 칸 ── */
function pbBlockHtml(d){
  var S=pbStats(d), top=S.rows[0], busy=HT.req && (HT.req.status==='requested'||HT.req.status==='running');
  var h='<div id="pb-block" style="margin-top:12px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px"><div class="ht-h" style="margin:0;flex:1;min-width:220px">📚 출판사 교과서 출처 <span class="ht-sub" style="font-weight:700">— '+htEsc(S.subject)+' 교과서 '+S.rows.length+'종과 문항 그림 비교 · 우리 자료 적중률과 따로 셉니다</span></div>'
    +'<button class="ht-btn no" id="pb-redo" style="padding:4px 8px;font-size:11px"'+(busy?' disabled title="앞의 분석이 진행 중입니다"':'')+' onclick="pbRedo()">📚 출판사 비교만 다시</button></div>';
  if(!S.rows.length) return h+'<div class="ht-sub">비교할 교과서가 없습니다.</div></div>';
  if(top && top.sv) h+='<div style="font-size:12.5px;font-weight:800;color:#166534;margin-bottom:6px">같은 문제·숫자변형이 가장 많은 교과서: <b style="font-size:14px">'+htEsc(top.pub)+'</b> '+top.sv+'문항'+(S.rows[1]&&S.rows[1].sv===top.sv?' (공동)':'')+'</div>';
  else h+='<div class="ht-sub" style="margin-bottom:6px">어느 출판사 교과서에서도 같은 문제·숫자변형을 찾지 못했습니다.</div>';
  h+='<table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:8px;overflow:hidden"><thead><tr style="background:#dcfce7;color:#14532d">'
    +'<th style="text-align:left;padding:5px 8px">출판사</th><th style="padding:5px 6px">같은 문제</th><th style="padding:5px 6px">숫자변형</th><th style="padding:5px 6px">지문 겹침</th><th style="text-align:left;padding:5px 8px">시험 문항 (같은 문제·숫자변형)</th></tr></thead><tbody>';
  S.rows.forEach(function(r, i){
    var hi=i===0 && r.sv>0;
    h+='<tr data-pbpub="'+htEsc(r.pub)+'" style="border-top:1px solid #f0fdf4'+(hi?';background:#f7fee7':'')+'"><td style="padding:5px 8px;font-weight:'+(hi?'900':'700')+';color:#0f172a;white-space:nowrap">'+htEsc(r.pub)+'</td>'
      +'<td style="text-align:center;font-weight:800;color:'+HT_KIND.same.c+'">'+(r.same||'·')+'</td><td style="text-align:center;font-weight:800;color:'+HT_KIND['var'].c+'">'+(r['var']||'·')+'</td>'
      +'<td style="text-align:center;color:#64748b">'+(r.text||'·')+'</td>'
      +'<td style="padding:5px 8px">'+(r.nos.length?r.nos.map(function(n){ return '<a href="javascript:void(0)" onclick="pbGo('+n+')" style="color:#166534;font-weight:800;margin-right:6px">'+n+'번</a>'; }).join(''):'<span class="ht-sub">—</span>')+'</td></tr>';
  });
  h+='</tbody></table>';
  return h+'<div class="ht-sub" style="font-size:11px;margin-top:6px">한 문항이 여러 출판사에 함께 있을 수 있습니다(교과서끼리 비슷한 문제). 출판사마다 그 문항과 가장 닮은 것 하나로 셉니다 · 그림은 문항 카드의 「📚 출판사 교과서」 줄에서</div></div>';
}
htSummaryHtml=(function(o){ return function(d){
  var h=o(d); if(!pbHas(d)) return h;
  var blk=pbBlockHtml(d), i=h.indexOf('id="pc-block"');
  if(i>=0){ /* 지난 기출 칸 바로 뒤 */
    var depth=0, j=h.lastIndexOf('<div', i), re=/<div\b|<\/div>/g; re.lastIndex=j;
    var m; while((m=re.exec(h))){ depth+=m[0]==='</div>'?-1:1; if(depth===0){ var e=m.index+6; return h.slice(0,e)+blk+h.slice(e); } }
  }
  var k=h.indexOf('<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center">');
  return k>=0 ? h.slice(0,k)+blk+h.slice(k) : h+blk;
}; })(htSummaryHtml);
window.pbGo = function(n){
  var it=htVisible(HT.data[HT.cur]).filter(function(x){ return htNumOf(HT.data[HT.cur],x)===n; })[0]; if(!it) return;
  var no=it.no;
  if(HT.view==='table') HT.open[no]=true; else { if(!HT.unfold) HT.unfold={}; HT.unfold[no]=true; HT.onlyOpen=false; }
  render();
  setTimeout(function(){ var el=document.getElementById('pb-it-'+no)||document.getElementById('ht-q-'+no); if(el && el.scrollIntoView) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 30);
};
window.pbRedo = function(){
  var d=HT.data[HT.cur]; if(!d) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다'); return; }
  if(!confirm('우리 자료·지난 기출 판정은 그대로 두고, 모든 출판사 교과서와의 비교만 다시 합니다 (10~20분).')) return;
  var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:d.examId, exam:d.exam, only:'pub' };
  htKvSet('exam_hit_req', req).then(function(){ HT.req=req; htPollMaybe(); htToast('📚 출판사 비교를 요청했습니다'); render(); });
};

/* ── ② 문항 카드 — 「📚 출판사 교과서」 줄 ── */
function pbCard(it, p){
  var K=HT_KIND[p.kind]||HT_KIND.none;
  return '<div class="pb-card" data-pbk="'+htEsc(p.k)+'" style="border:1px solid #bbf7d0;border-radius:12px;background:#fff;overflow:hidden'+(p.rejected?';opacity:.5':'')+'">'
    +'<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid #dcfce7;background:#f0fdf4"><b style="font-size:12px;color:#166534">'+htEsc(pbWhere(p))+'</b>'
    +'<span style="margin-left:auto;font-size:10.5px;font-weight:900;color:'+K.c+';background:'+K.bg+';padding:3px 8px;border-radius:6px;white-space:nowrap">'+K.t+'</span></div>'
    +'<div style="padding:8px">'+(p.imgUrl?'<img src="'+htEsc(p.imgUrl)+'" alt="'+htEsc(pbWhere(p))+' 교과서 문항" onclick="htZoom(this.src)" style="width:100%;display:block;cursor:zoom-in">':'<div class="ht-sub" style="padding:24px 0;text-align:center">그림 없음</div>')+'</div>'
    +'<div class="ht-sub" style="display:flex;gap:6px;align-items:center;padding:6px 10px;border-top:1px solid #f1f5f9;font-size:11.5px"><span style="flex:1;min-width:0">'+(p.why?('<b style="color:#0f172a">AI</b> '+htEsc(p.why)):'')+(p.rejected?' · ✗ 아님으로 표시':'')+'</span>'
    +'<button class="ht-btn no" style="padding:3px 7px;font-size:10.5px" data-pbno="'+it.no+'" onclick="pbReject('+it.no+',\''+p.k+'\')">'+(p.rejected?'↺ 되돌리기':'✗ 아님')+'</button></div></div>';
}
function pbSection(d, it, W){
  var P=(it.pub||[]).slice().sort(function(a,b){ return (a.rejected?1:0)-(b.rejected?1:0) || (PB_ORDER[b.kind]||0)-(PB_ORDER[a.kind]||0); });
  var h='<div id="pb-it-'+it.no+'" class="pb-sec" data-pbsec="'+it.no+'" style="margin-top:12px;padding-top:10px;border-top:1.5px dashed #86efac">'
    +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:12.5px;color:#166534">📚 출판사 교과서</b><span class="ht-sub" style="font-size:11px">모든 출판사 교과서에서 같은 유형 · 우리 자료 적중률과 따로</span></div>';
  if(!P.length) return h+'<div class="ht-sub" style="font-size:11.5px">어느 출판사 교과서에서도 같은 문제·숫자변형·지문 겹침을 찾지 못했습니다.</div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax('+Math.min(W||300, 240)+'px,1fr));gap:10px;align-items:start">';
  P.slice(0,6).forEach(function(p){ h+=pbCard(it,p); });
  return h+'</div>'+(P.length>6?'<div class="ht-sub" style="font-size:11px;margin-top:4px">그 밖에 '+(P.length-6)+'개</div>':'')+'</div>';
}
htItemSheet=(function(o){ return function(d, it, n, e, W, b){
  var h=o(d, it, n, e, W, b); if(!pbHas(d)) return h;
  var i=h.lastIndexOf('</div>'); return h.slice(0,i)+pbSection(d, it, W)+h.slice(i);
}; })(htItemSheet);
htItemDetail=(function(o){ return function(d, it, n){ var h=o(d, it, n); return pbHas(d) ? h+pbSection(d, it, 300) : h; }; })(htItemDetail);
htFoldedRow=(function(o){ return function(d, it, n, e){
  var h=o(d, it, n, e); if(!pbHas(d)) return h; var L=pbLive(it).filter(function(x){ return x.kind==='same'||x.kind==='var'; }); if(!L.length) return h;
  var mk='<span class="ht-sub" style="font-size:11px">▼ 펼치기</span>', i=h.lastIndexOf(mk); if(i<0) return h;
  var pubs=[]; L.forEach(function(x){ if(pubs.indexOf(x.pub)<0) pubs.push(x.pub); });
  return h.slice(0,i)+'<span class="ht-pill" data-pbfold="'+it.no+'" style="background:#dcfce7;color:#166534">📚 '+htEsc(pubs.slice(0,3).join('·'))+(pubs.length>3?' 외 '+(pubs.length-3):'')+'</span>'+h.slice(i);
}; })(htFoldedRow);
window.pbReject = function(no, k){
  var it=htItem(no); if(!it) return; var p=(it.pub||[]).filter(function(x){ return x.k===k; })[0]; if(!p) return;
  if(p.rejected) delete p.rejected; else p.rejected=true;
  var d=HT.data[HT.cur]; htKvSet('exam_hit_'+d.examId, d).then(function(){ render(); }).catch(function(e){ htToast('저장 실패: '+(e.message||e)); });
};

/* ── ③ 블로그 자료(.md) ── */
htMd=(function(o){ return function(d){
  var t=o(d); if(!pbHas(d)) return t;
  var S=pbStats(d), R=S.rows.filter(function(r){ return r.sv>0; });
  var L=['', '## 출판사 교과서 출처 ('+S.subject+' 교과서 '+S.rows.length+'종과 비교)',
    R.length ? ('- 같은 문제·숫자만 바뀐 문제가 나온 교과서: '+R.map(function(r){ return r.pub+' '+r.sv+'문항('+r.nos.map(function(n){ return n+'번'; }).join(', ')+')'; }).join(' · '))
      : '- 어느 출판사 교과서에서도 같은 문제·숫자만 바뀐 문제는 찾지 못했다.',
    '- 한 문항이 여러 출판사 교과서에 함께 있을 수 있다. 학교에서 쓰는 교과서가 아닌 다른 출판사 교과서에서 나온 문항이 있으면 그 점을 짚는다.'];
  return t+'\n'+L.join('\n')+'\n';
}; })(htMd);
