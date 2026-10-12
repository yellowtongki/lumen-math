/* ═══════════════════════════════════════════════════════════════════
 * v19-116: 📚 교과서 문항도 «우리 자료처럼» 등급으로 적중 확정 · 같은 그림 카드 합치기 · 「공통」으로 한 번만 세기
 * 원장 지적 2026-10-12: 「6번의 경우 교과서 숫자변형인데 아래쪽 교과서 모음에 있어서 숫자변형 체크를 못하게 되었다.」
 *  [까닭] 문항 카드 아래 「📚 출판사 교과서」 줄(pubsrc_teacher.js pbCard)은 «✗ 아님» 단추만 있었다 → 교과서 문항이 시험 문항과
 *         숫자변형이어도 그 문항의 적중으로 확정할 길이 없었다(적중률·도넛·우리 자료별 적중에 안 들어감).
 *  [같은 날 알게 된 것] 매쓰플랫 출판사별 교과서 은행은 여러 출판사가 «같은 문항 그림»을 함께 쓴다(그림의 약 40%가 2~7개 출판사에 같은 imgUrl).
 *         즉 실제 교과서에 인쇄된 문제라기보다 매쓰플랫 자체 문항을 교과서 쪽에 붙여 둔 것이고, 쪽·번호가 실제 책과 다를 수 있다(원장 확인).
 *  [고침]
 *   ① 교과서 카드에도 우리 자료 카드와 같은 등급 단추(같은 문제 · 숫자변형 · 유사유형 · 지문만 · ✗ 아님) — 누르면
 *      it.hit = { k:<그 교과서 문항 k>, kind, ok:true, by:'teacher', pub:true } · d.mats[k] = { kind:'textbook', title:'<출판사> 교과서',
 *      where:'<쪽>쪽 <번호>번', img:imgUrl, store:'', res:{}, pub:true } → 도넛·적중률·「우리 자료별 적중」(📘 교과서)·보고서·.md·카드뉴스에 그대로 든다.
 *      it.pub[i].kind 도 고른 등급으로(교과서 일치 숫자가 따라온다 · AI 처음 판정은 p.ai) · 「↺ 풀기」 · 이미 우리 자료로 확정한 문항이면 바꿀지 물어본다.
 *   ② 한 문항 안에서 imgUrl 이 같은 교과서 후보는 카드 하나로 — 「동아·와이비엠·지학사 공통 문항」 + 출판사마다 쪽·번호 작은 글씨 ·
 *      등급/✗ 는 묶인 것 모두에 · 적중 열쇠는 맨 앞 것(k)
 *   ③ 칸 머리·카드에 「쪽·번호는 매쓰플랫 교과서 기준 — 실제 교과서와 다를 수 있어요」
 *   ④ 교과서 일치 세기(적중 분석 「📚 교과서 일치」 표 · pbStats · 교과서일치도 tbmCalc) — 셈 규칙:
 *      문항마다 살아 있는 교과서 후보(✗ 아님 뺀 것)를 그림(imgUrl)으로 묶는다. 묶음의 출판사가 하나면 그 출판사 몫, 둘 이상이면 「공통」 몫.
 *      출판사(또는 공통)마다 그 문항에서 가장 닮은 등급 하나로 센다 → 출판사 줄 = 그 출판사에만 있는 그림으로 일치한 문항, 공통 줄 = 여러 출판사가
 *      함께 쓰는 그림으로 일치한 문항(한 번만). 「학교 교과서와 일치 / 다른 출판사에서만」은 묶음의 출판사 전부를 본다 — 학교 교과서가 낀 공통 문항은
 *      «학교 교과서에 있음». 「다른 출판사 중 자주 나온 곳」·대비 추천 순서는 그 출판사에만 있는 문항으로만.
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hit · hitsrc · cn · pubsrc · tbmatch · hitfix112)의 함수를 감싸거나 다시 정의한다.
 * ═══════════════════════════════════════════════════════════════════ */
var PG116_CAP = '쪽·번호는 매쓰플랫 교과서 기준 — 실제 교과서와 다를 수 있어요';
var PG116_COMMON = '공통(여러 출판사)';
function pg116IsPub(k){ return /^pub:/.test(String(k||'')); }
function pg116Key(p){ return p && p.imgUrl ? ('img:'+p.imgUrl) : ('k:'+(p&&p.k)); }
/* 같은 그림끼리 묶기 (list 순서 그대로) — { k:맨 앞 k, ks, ps, pubs, best:살아 있는 것 중 가장 닮은 등급, rejected:모두 ✗ } */
function pg116Groups(list){
  var out=[], at={};
  (list||[]).forEach(function(p){
    if(!p) return; var key=pg116Key(p), g=at[key];
    if(!g){ g=at[key]={ key:key, ps:[], ks:[], pubs:[], best:null }; out.push(g); }
    g.ps.push(p); g.ks.push(p.k); if(g.pubs.indexOf(p.pub)<0) g.pubs.push(p.pub);
    if(!p.rejected && (!g.best || (PB_ORDER[p.kind]||0)>(PB_ORDER[g.best]||0))) g.best=p.kind;
  });
  out.forEach(function(g){ g.k=g.ks[0]; g.rejected=g.ps.every(function(p){ return !!p.rejected; }); if(!g.best) g.best=g.ps[0].kind; });
  return out;
}
function pg116GroupOf(it, k){ return pg116Groups(it.pub||[]).filter(function(g){ return g.ks.indexOf(k)>=0; })[0]||null; }
function pg116Ai(g){ var a=null; g.ps.forEach(function(p){ var x=p.ai||p.kind; if(!a || (PB_ORDER[x]||0)>(PB_ORDER[a]||0)) a=x; }); return a; }
function pg116No(p){ return String((p&&p.no)||'').replace(/\s*번$/,''); }
/* 적중 자료(mats) 한 칸 — 우리 자료와 같은 모양 */
function pg116Mat(d, g){
  var multi=g.pubs.length>1, p=g.ps[0];
  return { kind:'textbook', title:g.pubs.join('·')+' 교과서',
    where:g.ps.map(function(q){ return (multi?(q.pub+' '):'')+q.page+'쪽 '+pg116No(q)+'번'; }).join(' · '),
    img:p.imgUrl||'', store:'', res:{}, pub:true, pubs:g.pubs.slice(), bid:String(p.bid||''), subject:String(((d.stats||{}).pub||{}).subject||'') };
}
/* 교과서로 확정한 적중인데 mats 칸이 없으면(옛 저장 · 서버 다시 판정) 화면에서 다시 만든다 */
function pg116Ensure(d){
  if(!d || !Array.isArray(d.items)) return;
  d.items.forEach(function(it){
    var h=it.hit; if(!h || h.ok!==true || !pg116IsPub(h.k) || (d.mats&&d.mats[h.k])) return;
    var g=pg116GroupOf(it, h.k); if(!g) return; d.mats=d.mats||{}; d.mats[h.k]=pg116Mat(d, g);
  });
}
/* 아무 적중도 가리키지 않는 교과서 mats 칸은 저장 때 지운다 */
function pg116Prune(d){
  if(!d || !d.mats) return; var used={};
  (d.items||[]).forEach(function(it){ if(it.hit && it.hit.k) used[it.hit.k]=1; });
  Object.keys(d.mats).forEach(function(k){ var m=d.mats[k]; if(m && m.pub && pg116IsPub(k) && !used[k]) delete d.mats[k]; });
}
htSave=(function(o){ return function(d){ try{ pg116Prune(d); }catch(e){} return o.apply(this, arguments); }; })(htSave);

/* ── 앞 부품이 «후보(cands) 안에서» 적중 자료를 찾던 곳 — 교과서 적중이면 잠깐 가짜 후보를 앞에 끼워 같은 길로 찾게 한다 ── */
function pg116Fake(d, it){
  var h=it && it.hit; if(!h || h.ok!==true || !pg116IsPub(h.k)) return null;
  if((it.cands||[]).some(function(c){ return c.k===h.k; })) return null;
  return { k:h.k, kind:h.kind, also:[], why:'', pg116:true };
}
function pg116With(d, items, fn){
  var saved=[];
  try{ pg116Ensure(d); }catch(e){}
  (items||[]).forEach(function(it){ var f=pg116Fake(d, it); if(f){ saved.push([it, Object.prototype.hasOwnProperty.call(it, 'cands'), it.cands]); it.cands=[f].concat(it.cands||[]); } });
  try{ return fn(); } finally { saved.forEach(function(s){ if(s[1]) s[0].cands=s[2]; else delete s[0].cands; }); }
}
htFoldedRow=(function(o){ return function(d, it, n, e){ var self=this, a=arguments; return pg116With(d, [it], function(){ return o.apply(self, a); }); }; })(htFoldedRow);
htReportRows=(function(o){ return function(d){ var self=this, a=arguments; return pg116With(d, htVisible(d), function(){ return o.apply(self, a); }); }; })(htReportRows);
htItemsHtml=(function(o){ return function(d){ var self=this, a=arguments; return pg116With(d, htVisible(d), function(){ return o.apply(self, a); }); }; })(htItemsHtml);
if(typeof cnRows==='function') cnRows=(function(o){ return function(d){ var self=this, a=arguments; return pg116With(d, htVisible(d), function(){ return o.apply(self, a); }); }; })(cnRows);
/* 표 보기에서 펼친 줄 — 가짜 후보는 빼고 그린다 */
htItemDetail=(function(o){ return function(d, it, n){
  var c=it && it.cands;
  if(c && c[0] && c[0].pg116){ it.cands=c.slice(1); try{ return o.apply(this, arguments); } finally { it.cands=c; } }
  return o.apply(this, arguments);
}; })(htItemDetail);
htSummaryHtml=(function(o){ return function(d){ try{ pg116Ensure(d); }catch(e){} return o.apply(this, arguments); }; })(htSummaryHtml);
/* 문항 머리 — 교과서로 확정했으면 알약 */
htItemSheet=(function(o){ return function(d, it, n, e, W, b){
  var h=o.apply(this, arguments), hh=it.hit;
  if(!hh || hh.ok!==true || !pg116IsPub(hh.k)) return h;
  var m=(d.mats||{})[hh.k]||{}, mk='<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">', i=h.indexOf(mk); if(i<0) return h;
  i+=mk.length;
  return h.slice(0, i)+'<span class="ht-pill" data-pg116hit="'+it.no+'" style="background:#cffafe;color:#0e7490">📘 교과서 적중 · '+htEsc(m.title||'교과서')+'</span>'+h.slice(i);
}; })(htItemSheet);

/* ── ① ② 문항 카드 「📚 출판사 교과서」 줄 — 같은 그림은 카드 하나 · 등급 단추 ── */
function pg116SegRow(it, g){
  var sel=!!(it.hit && it.hit.ok===true && g.ks.indexOf(it.hit.k)>=0), cur=sel&&it.hit.kind?it.hit.kind:g.best, ai=pg116Ai(g), k0=htEsc(g.k);
  var seg=function(kind, label){ var on=sel&&cur===kind, K=HT_KIND[kind];
    return '<button data-pg116seg="'+kind+'" onclick="pg116Grade('+it.no+',\''+k0+'\',\''+kind+'\')" title="이 교과서 문항을 「'+label+'」로 확정 — 이 문항의 적중(📘 교과서)으로 셉니다" style="flex:1;min-width:0;padding:5px 3px;font-size:11px;font-weight:900;font-family:inherit;cursor:pointer;border:1.5px '+(ai===kind&&!on?'dashed':'solid')+' '+(on||ai===kind?K.c:'#e2e8f0')+';background:'+(on?K.c:'#fff')+';color:'+(on?'#fff':K.c)+';border-radius:8px">'+(on?'✓ ':'')+label+(ai===kind&&!sel?' <small style="font-weight:700;opacity:.8">AI</small>':'')+'</button>'; };
  var btn='flex:1;padding:5px 3px;font-size:11px;font-weight:800;font-family:inherit;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:8px';
  return '<div style="display:flex;gap:4px;margin-bottom:4px">'+seg('same','같은 문제')+seg('var','숫자변형')+seg('type','유사유형')+'</div>'
    +'<div style="display:flex;gap:4px">'+seg('text','지문만')
    +'<button class="pg116-rej" data-pbno="'+it.no+'" onclick="pg116Reject('+it.no+',\''+k0+'\')" style="'+btn+'">'+(g.rejected?'↺ 되돌리기':'✗ 아님')+'</button>'
    +(sel?'<button data-pg116undo="'+it.no+'" onclick="pg116Undo('+it.no+')" title="이 문항의 적중 확정을 풉니다" style="'+btn+'">↺ 풀기</button>':'')+'</div>';
}
function pbCard(it, g){
  if(!g || !g.ps) g=pg116Groups([g])[0];
  var p=g.ps[0], multi=g.pubs.length>1, sel=!!(it.hit && it.hit.ok===true && g.ks.indexOf(it.hit.k)>=0), cur=sel&&it.hit.kind?it.hit.kind:g.best, K=HT_KIND[cur]||HT_KIND.none, ai=pg116Ai(g);
  var title=multi?(g.pubs.join('·')+' 공통 문항'):pbWhere(p);
  return '<div class="pb-card'+(multi?' pg116-multi':'')+'" data-pbk="'+htEsc(g.k)+'" data-pbks="'+htEsc(g.ks.join(' '))+'" data-pbn="'+g.ps.length+'" style="border:'+(sel?'2px solid '+K.c:'1px solid #bbf7d0')+';border-radius:12px;background:#fff;overflow:hidden'+(g.rejected?';opacity:.5':'')+'">'
    +'<div style="display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid #dcfce7;background:#f0fdf4"><b style="font-size:12px;color:#166534">'+htEsc(title)+'</b>'
    +'<span style="margin-left:auto;font-size:10.5px;font-weight:900;color:'+K.c+';background:'+K.bg+';padding:3px 8px;border-radius:6px;white-space:nowrap">'+K.t+(sel?' ✓':'')+'</span></div>'
    +(multi?'<div class="pg116-wh" style="padding:5px 10px 0;font-size:10.5px;color:#475569;font-weight:700;line-height:1.5">'+g.ps.map(function(q){ return htEsc(pbWhere(q)); }).join(' · ')+'</div>':'')
    +'<div style="padding:8px">'+(p.imgUrl?'<img src="'+htEsc(p.imgUrl)+'" alt="'+htEsc(title)+' 교과서 문항" onclick="htZoom(this.src)" style="width:100%;display:block;cursor:zoom-in">':'<div class="ht-sub" style="padding:24px 0;text-align:center">그림 없음</div>')+'</div>'
    +'<div class="ht-sub" style="padding:6px 10px;border-top:1px solid #f1f5f9;font-size:11.5px">'+(p.why?('<b style="color:#0f172a">AI</b> '+htEsc(p.why)):'')
    +(ai&&ai!==cur?(' <span style="color:#94a3b8">(AI는 '+(HT_KIND[ai]||{}).t+')</span>'):'')+(g.rejected?' · ✗ 아님으로 표시':'')+'</div>'
    +'<div style="padding:0 10px 4px">'+pg116SegRow(it, g)+'</div>'
    +'<div class="pg116-cap" style="padding:0 10px 8px;font-size:10px;color:#94a3b8;font-weight:600;line-height:1.4">'+PG116_CAP+'</div></div>';
}
function pbSection(d, it, W){
  var hk=(it.hit && it.hit.ok===true)?it.hit.k:null, G=pg116Groups(it.pub||[]);
  G.forEach(function(g, i){ g.i=i; g.sel=!!hk && g.ks.indexOf(hk)>=0; });
  G.sort(function(a,b){ return (b.sel?1:0)-(a.sel?1:0) || (a.rejected?1:0)-(b.rejected?1:0) || (PB_ORDER[b.best]||0)-(PB_ORDER[a.best]||0) || b.pubs.length-a.pubs.length || a.i-b.i; });
  var selG=G.filter(function(g){ return g.sel; })[0];
  var h='<div id="pb-it-'+it.no+'" class="pb-sec" data-pbsec="'+it.no+'" style="margin-top:12px;padding-top:10px;border-top:1.5px dashed #86efac">'
    +'<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:12.5px;color:#166534">📚 출판사 교과서</b>'
    +'<span class="ht-sub" style="font-size:11px">모든 출판사 교과서에서 같은 유형 · 등급을 고르면 이 문항의 적중(📘 교과서)으로 확정</span>'
    +'<span class="pg116-cap" data-pg116cap="1" style="font-size:10.5px;font-weight:700;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:1px 6px">📏 '+PG116_CAP+'</span>'
    +(selG?'<span style="margin-left:auto;display:flex;gap:6px;align-items:center">'+htPill(it.hit.kind, true)+'<button class="ht-btn no" style="padding:4px 8px;font-size:11px" data-pg116undo="'+it.no+'" onclick="pg116Undo('+it.no+')">↺ 풀기</button></span>':'')+'</div>';
  if(!G.length) return h+'<div class="ht-sub" style="font-size:11.5px">어느 출판사 교과서에서도 같은 문제·숫자변형·지문 겹침을 찾지 못했습니다.</div></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax('+Math.min(W||300, 240)+'px,1fr));gap:10px;align-items:start">';
  G.slice(0,6).forEach(function(g){ h+=pbCard(it, g); });
  var rest=G.length-6;
  return h+'</div>'+(rest>0?'<div class="ht-sub" style="font-size:11px;margin-top:4px">그 밖에 '+rest+'개</div>':'')+'</div>';
}

/* ── 동작 ── */
window.pg116Grade = function(no, k, kind){
  var d=HT.data[HT.cur], it=htItem(no); if(!d || !it || !HT_KIND[kind] || kind==='none') return;
  var g=pg116GroupOf(it, k); if(!g) return;
  var h=it.hit;
  if(h && h.ok===true && h.k && g.ks.indexOf(h.k)<0 && !pg116IsPub(h.k)){
    var m=(d.mats||{})[h.k]||{};
    if(!confirm('이 문항은 이미 우리 자료('+(m.title||'')+(m.where?(' '+m.where):'')+')로 적중 확정되어 있습니다.\n교과서 문항('+(g.pubs.join('·'))+')「'+HT_KIND[kind].t+'」로 바꿀까요?')) return;
  }
  var now=new Date().toISOString();
  g.ps.forEach(function(p){ if(!p.ai) p.ai=p.kind; p.kind=kind; delete p.rejected; p.by='teacher'; p.at=now; });
  d.mats=d.mats||{}; d.mats[g.k]=pg116Mat(d, g);
  it.hit={ k:g.k, kind:kind, ok:true, by:'teacher', at:now, pub:true };
  if(htStats(d).open===0 && !d.confirmedAt) d.confirmedAt=now;
  if(HT.unfold) HT.unfold[no]=false;   /* 확정하면 접힌다 (우리 자료와 같게) */
  htSave(d); render();
};
window.pg116Undo = function(no){ htConfirm(no, null, null); };
window.pg116Reject = function(no, k){
  var d=HT.data[HT.cur], it=htItem(no); if(!d || !it) return;
  var g=pg116GroupOf(it, k); if(!g) return;
  var undo=g.rejected;
  g.ps.forEach(function(p){ if(undo) delete p.rejected; else p.rejected=true; });
  if(!undo && it.hit && g.ks.indexOf(it.hit.k)>=0) it.hit=null;
  var pr=htSave(d); render();
  if(pr && pr.then) pr.then(function(){ render(); });
};

/* ── ④ 교과서 일치 세기 — 같은 그림은 「공통」 한 번 ── */
function pg116Credit(g){ return g.pubs.length>1 ? PG116_COMMON : g.pubs[0]; }
function pbStats(d){
  var P=(d.stats&&d.stats.pub)||{}, by={}, items=0, mk=function(){ return { same:0, 'var':0, text:0, nos:[], n:0 }; };
  (P.books||[]).forEach(function(b){ by[b.pub]=mk(); by[b.pub].n=b.n; });
  htVisible(d).forEach(function(it){
    var best={}, L=pbLive(it);
    pg116Groups(L).forEach(function(g){ var key=pg116Credit(g); if(!best[key] || (PB_ORDER[g.best]||0)>(PB_ORDER[best[key]]||0)) best[key]=g.best; });
    Object.keys(best).forEach(function(pb){ if(!by[pb]) by[pb]=mk(); if(by[pb][best[pb]]!=null) by[pb][best[pb]]++; if(best[pb]==='same'||best[pb]==='var') by[pb].nos.push(htNumOf(d,it)); });
    if(L[0] && (L[0].kind==='same'||L[0].kind==='var')) items++;
  });
  var all=Object.keys(by).map(function(pb){ var r=by[pb]; r.pub=pb; r.common=(pb===PG116_COMMON); r.sv=r.same+r['var']; r.nos.sort(function(a,b){ return a-b; }); return r; });
  var rows=all.filter(function(r){ return !r.common; }), cm=all.filter(function(r){ return r.common && (r.sv+r.text)>0; })[0]||null;
  rows.sort(function(a,b){ return b.sv-a.sv || b.same-a.same || b.text-a.text || a.pub.localeCompare(b.pub,'ko'); });
  return { rows:rows, items:items, subject:P.subject||'', common:cm };   /* rows = 출판사(교과서)만 · common = 「공통」 줄(없으면 null) */
}
function pg116CmRow(r){
  return '<tr data-pbpub="'+htEsc(PG116_COMMON)+'" data-pbcommon="1" style="border-top:1px solid #f0fdf4;background:#f8fafc"><td style="padding:5px 8px;font-weight:800;color:#0f172a;white-space:nowrap">🔗 공통 <small style="font-size:10.5px;color:#64748b;font-weight:700">여러 출판사 같은 그림 · 한 번만</small></td>'
    +'<td style="text-align:center;font-weight:800;color:'+HT_KIND.same.c+'">'+(r.same||'·')+'</td><td style="text-align:center;font-weight:800;color:'+HT_KIND['var'].c+'">'+(r['var']||'·')+'</td>'
    +'<td style="text-align:center;color:#64748b">'+(r.text||'·')+'</td>'
    +'<td style="padding:5px 8px">'+(r.nos.length?r.nos.map(function(n){ return '<a href="javascript:void(0)" onclick="pbGo('+n+')" style="color:#166534;font-weight:800;margin-right:6px">'+n+'번</a>'; }).join(''):'<span class="ht-sub">—</span>')+'</td></tr>';
}
pbBlockHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments), S=pbStats(d), cm=S.common, top=S.rows[0];
  h=h.replace(' · 우리 자료 적중률과 따로 셉니다</span>', ' · 문항 카드에서 등급을 고르면 적중(📘 교과서)으로도 셉니다</span>');
  var head=h.indexOf('</button></div>');
  if(head>=0){ head+='</button></div>'.length; h=h.slice(0, head)+'<div class="pg116-cap" data-pg116cap="1" style="font-size:10.5px;color:#64748b;font-weight:700;margin:-2px 0 6px">📏 '+PG116_CAP+'</div>'+h.slice(head); }
  if(cm){
    var e=h.indexOf('</tbody></table>'); if(e>=0) h=h.slice(0, e)+pg116CmRow(cm)+h.slice(e);
    if(cm.sv && !(top && top.sv)) h=h.replace('<div class="ht-sub" style="margin-bottom:6px">어느 출판사 교과서에서도 같은 문제·숫자변형을 찾지 못했습니다.</div>',
      '<div style="font-size:12.5px;font-weight:800;color:#166534;margin-bottom:6px">여러 출판사가 함께 쓰는 같은 그림(🔗 공통)에서 같은 문제·숫자변형 <b style="font-size:14px">'+cm.sv+'</b>문항 <span class="ht-sub">— 한 출판사에만 있는 것은 없습니다</span></div>');
  }
  h=h.replace('한 문항이 여러 출판사에 함께 있을 수 있습니다(교과서끼리 비슷한 문제). 출판사마다 그 문항과 가장 닮은 것 하나로 셉니다',
    '한 문항이 여러 출판사에 함께 있을 수 있습니다 — 매쓰플랫 교과서 은행은 여러 출판사가 <b>같은 문항 그림</b>을 함께 씁니다. 같은 그림이 두 곳 이상이면 「🔗 공통」 줄에 <b>한 번만</b> 세고, 출판사 줄은 <b>그 출판사에만 있는</b> 그림으로 일치한 문항만 셉니다(학교 교과서가 낀 공통 문항은 «학교 교과서에 있음»)');
  return h;
}; })(pbBlockHtml);
/* 블로그 자료(.md) — 공통 문항 한 줄 */
htMd=(function(o){ return function(d){
  var t=o.apply(this, arguments); if(!pbHas(d)) return t;
  var cm=pbStats(d).common; if(!cm || !cm.sv) return t;
  var add='여러 출판사 공통(같은 그림) '+cm.sv+'문항('+cm.nos.map(function(n){ return n+'번'; }).join(', ')+')';
  return t.split('\n').map(function(line){
    if(/^- 같은 문제·숫자만 바뀐 문제가 나온 교과서: /.test(line)) return line+' · '+add+' — 출판사 숫자는 그 출판사 교과서에만 있는 문항';
    if(line==='- 어느 출판사 교과서에서도 같은 문제·숫자만 바뀐 문제는 찾지 못했다.') return '- 같은 문제·숫자만 바뀐 문제가 나온 교과서: '+add+' — 한 출판사에만 있는 것은 없다';
    return line;
  }).join('\n');
}; })(htMd);

/* 교과서일치도 — tbmatch_teacher.js tbmCalc 를 같은 셈 규칙으로 (c.common = 공통 줄) */
function tbmCalc(x){
  if(x.c) return x.c;
  var d=x.d, own=tbmOwn(x), by={}, pubs=[], CK='\u0000공통';
  var add=function(pb){ if(!by[pb]){ by[pb]={ pub:pb, same:0, 'var':0, text:0, sv:0, nos:[], only:0, n:0, own:own.indexOf(pb)>=0, cmp:false }; pubs.push(pb); } return by[pb]; };
  var common={ pub:'공통', same:0, 'var':0, text:0, sv:0, nos:[], only:0, n:0, own:false, cmp:true, common:true };
  (d.stats.pub.books||[]).forEach(function(b){ var r=add(b.pub); r.n+=Number(b.n)||0; r.cmp=true; });
  var items=htVisible(d), ownHit=0, any=0, only=[], onlyNo={};
  items.forEach(function(it){
    var n=htNumOf(d,it), best={}, svPubs=[], svRows=[];
    pg116Groups(pbLive(it)).forEach(function(g){
      g.pubs.forEach(function(pb){ add(pb).cmp=true; });
      var key=g.pubs.length>1?CK:g.pubs[0]; if(!best[key] || (PB_ORDER[g.best]||0)>(PB_ORDER[best[key]]||0)) best[key]=g.best;
      if(g.best==='same'||g.best==='var') g.pubs.forEach(function(pb){ if(svPubs.indexOf(pb)<0) svPubs.push(pb); });
    });
    Object.keys(best).forEach(function(key){ var r=key===CK?common:by[key], k=best[key];
      if(k==='same'||k==='var'){ r[k]++; r.sv++; r.nos.push({ n:n, no:it.no }); svRows.push(r); } else if(k==='text') r.text++; });
    if(svPubs.length) any++;
    if(svPubs.some(function(pb){ return own.indexOf(pb)>=0; })) ownHit++;
    else if(svPubs.length && own.length){
      only.push({ it:it, n:n, pubs:svPubs, credit:svRows.map(function(r){ return r.common?'공통':r.pub; }) }); onlyNo[it.no]=1;
      svRows.forEach(function(r){ r.only++; });
    }
  });
  pubs.forEach(function(pb){ by[pb].nos.sort(function(a,b){ return a.n-b.n; }); }); common.nos.sort(function(a,b){ return a.n-b.n; });
  var others=pubs.filter(function(pb){ return own.indexOf(pb)<0 && by[pb].sv>0; })
    .sort(function(a,b){ return by[b].only-by[a].only || by[b].sv-by[a].sv || a.localeCompare(b,'ko'); });
  x.c={ own:own, by:by, pubs:pubs, total:items.length, ownHit:ownHit, any:any, only:only, onlyNo:onlyNo, others:others, common:common };
  return x.c;
}
function pg116CmTd(r){ return '<td class="tbm-c tbm-cm '+tbmHeat(r.sv)+'" data-tbm-common="1" title="여러 출판사 교과서가 같은 그림으로 함께 쓰는 문항 — 같은 문제 '+r.same+' · 숫자변형 '+r['var']+' (출판사마다 세지 않고 한 번만)">'+(r.sv||'·')+'</td>'; }
tbmOverview=(function(o){ return function(L){
  var h=o.apply(this, arguments);
  /* 「다른 출판사 중 자주 나온 곳」 — 그 출판사에만 있는 문항으로만 */
  var oc={};
  L.forEach(function(x){ var c=tbmCalc(x); if(!c.own.length) return; c.only.forEach(function(oo){ (oo.credit||[]).forEach(function(pb){ if(pb!=='공통') oc[pb]=(oc[pb]||0)+1; }); }); });
  var top=Object.keys(oc).sort(function(a,b){ return oc[b]-oc[a] || a.localeCompare(b,'ko'); }).slice(0,2);
  h=h.replace(/(<b style="color:#0f172a;font-size:15px;line-height:1\.9">)[\s\S]*?(<\/b><span>다른 출판사 중 자주 나온 곳)/, function(all, a, z){ return a+(top.length?htEsc(top.join(' · ')):'—')+z; });
  /* 지도 — 과목마다 공통 칸 (공통 문항이 있는 과목만) */
  var mark='<div class="tbm-subj" data-tbm-subj="', parts=h.split(mark);
  for(var i=1;i<parts.length;i++){
    var sk=parts[i].slice(0, parts[i].indexOf('"'));
    var X=L.filter(function(x){ return htEsc(x.subject||'과목 모름')===sk; });
    if(!X.some(function(x){ var cm=tbmCalc(x).common; return cm.sv+cm.text>0; })) continue;
    var seg=parts[i].replace('<th>다른 곳에서만</th>', '<th class="tbm-cmh" title="여러 출판사 교과서가 같은 그림으로 함께 쓰는 문항 (한 번만 셈)">🔗 공통</th><th>다른 곳에서만</th>');
    X.forEach(function(x){
      var a='<tr data-tbm-row="'+htEsc(x.id)+'">', j=seg.indexOf(a); if(j<0) return;
      var z=seg.indexOf('<td data-tbm-onlycell="1">', j); if(z<0) return;
      seg=seg.slice(0, z)+pg116CmTd(tbmCalc(x).common)+seg.slice(z);
    });
    parts[i]=seg;
  }
  h=parts.join(mark);
  return h.replace('· 칸을 누르면 그 시험으로</div>', '· 칸을 누르면 그 시험으로 · <b>🔗 공통</b> = 여러 출판사 교과서가 같은 그림으로 함께 쓰는 문항(출판사 칸에는 그 출판사에만 있는 문항만) · '+PG116_CAP+'</div>');
}; })(tbmOverview);
tbmExamView=(function(o){ return function(x){
  var h=o.apply(this, arguments), c=tbmCalc(x), cm=c.common;
  var tb='<div class="tbm-scroll"><table class="tbm-t" id="tbm-pubt">', i=h.indexOf(tb);
  if(i>=0) h=h.slice(0, i)+'<div class="tbm-note" id="pg116-rule" style="margin:0 0 6px">출판사 줄 = <b>그 출판사에만 있는</b> 그림으로 일치한 문항 · 여러 출판사에 <b>같은 그림</b>으로 있는 문항은 「🔗 공통」 한 줄에 한 번만 · '+PG116_CAP+'</div>'+h.slice(i);
  if(!(cm.sv+cm.text>0)) return h;
  var j=h.indexOf('id="tbm-pubt"'), e=j>=0?h.indexOf('</tbody></table>', j):-1; if(e<0) return h;
  var row='<tr data-tbm-pub="공통" data-tbm-common="1"><td class="l"><b>🔗 공통</b> <small class="tbm-note">여러 출판사 같은 그림 · 한 번만</small></td>'
    +'<td class="tbm-c '+tbmHeat(cm.sv)+'">'+(cm.sv||'·')+'</td><td>'+(cm.same||'·')+'</td><td>'+(cm['var']||'·')+'</td><td class="tbm-mut">'+(cm.text||'·')+'</td><td class="l">';
  if(cm.nos.length) cm.nos.forEach(function(oo){ row+='<button class="tbm-no'+(c.onlyNo[oo.no]?' o':'')+'" data-no="'+htEsc(oo.no)+'" onclick="tbmFocus(this.getAttribute(\'data-no\'))">'+oo.n+'번</button>'; });
  else row+='<span class="tbm-note">—</span>';
  row+='</td></tr>';
  return h.slice(0, e)+row+h.slice(e);
}; })(tbmExamView);
tbmMd=(function(o){ return function(){
  var t=o.apply(this, arguments), L=tbmExams(), S=TBM.cur?L.filter(function(x){ return x.id===TBM.cur; }):L, i=0;
  return t.split('\n').map(function(line){
    if(!/^- 출판사별 일치 문항: /.test(line)) return line;
    var x=S[i++]; if(!x) return line; var cm=tbmCalc(x).common;
    return cm.sv ? (line+' · 여러 출판사 공통(같은 그림) '+cm.sv+' — 출판사 숫자는 그 출판사에만 있는 문항') : line;
  }).join('\n');
}; })(tbmMd);
/* 교과서일치도 「✗ 아님」 — 같은 그림(여러 출판사)은 함께 */
window.tbmAct=(function(o){ return function(el, act){
  if(act==='rej'){
    try{
      var q=el && el.closest ? el.closest('.tbm-q') : null, id=q&&q.getAttribute('data-id'), no=q&&q.getAttribute('data-no'), k=q&&q.getAttribute('data-k'), d=id?HT.data[id]:null;
      var it=d?(d.items||[]).filter(function(x){ return String(x.no)===String(no); })[0]:null, p=it?(it.pub||[]).filter(function(x){ return x.k===k; })[0]:null;
      if(p && p.imgUrl) (it.pub||[]).forEach(function(x){ if(x!==p && x.imgUrl===p.imgUrl) x.rejected=true; });
      if(p && it.hit && it.hit.ok===true && pg116IsPub(it.hit.k)){ var g=pg116GroupOf(it, it.hit.k); if(g && g.ks.indexOf(k)>=0) it.hit=null; }
    }catch(e){}
  }
  return o.apply(this, arguments);
}; })(window.tbmAct);
