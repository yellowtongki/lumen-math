/* ═══════════════════════════════════════════════════════════════════
 * v19-128: 🎯 적중 분석 — 원장님 검토를 빠르게 (원장 2026-10-17 「판정은 내가 하나하나 봐야 해서 너무 오래 걸린다」)
 *
 *  ① 🤖 AI 판정 자동 반영 (시험마다 · 기본 켬 · 끄면 exam_hit_<시험>.autoAi = false)
 *     원장님 확정(it.hit)이 없고, AI 1순위 후보(✗ 아님 뺀 맨 앞)가 «같은 문제»·«숫자변형»이면 작은 「AI」 표시와 함께 적중으로 센다.
 *     원장님 ✓/✗ 가 늘 이긴다. 판단은 한 곳 hitEff(it, d) → { kind, by:'teacher'|'ai'|null, cand, k } 에서만 한다.
 *     예전 htEff(it) 가 hitEff 를 부르게 바꿨다 → 적중률·도넛·오른쪽 칸·왼쪽 시험 목록·적중 지도·우리 자료별 적중·학생별·학부모 보고서·
 *     카드뉴스·블로그 .md·요약 복사가 모두 같은 값을 쓴다. htEff 의 sure = 원장 확정 true · AI 자동 'ai'(참 값 — 확정으로 셈) · 후보 false.
 *     끄면 예전과 똑같다(htEff 결과가 v19-127 과 같음 — 검사 test_v19128).
 *  ② ⚡ 빠른 검토 — 결정이 필요한 문항만 한 화면에: 원장님이 아직 안 본 문항 중 후보에 같은 문제·숫자변형이 있는 것
 *     (AI 1순위 · 「후보 2개 이상」 표시). 결과에 AI 확신도 값이 없어 «AI 불확실» 줄은 두지 않았다.
 *     유사유형뿐인 문항은 「유사유형만 n문항 — 접어 둠」 수만 보이고 「포함하기」로 넣는다.
 *     한 줄 = 시험 문항 그림 | 후보 그림(없으면 자료 이름) · 등급 + AI 까닭 · ✓ 같은 문제 / 숫자변형 / 유사유형 / ✗ 아님 · 「다음 후보 ▸」
 *     키: 1·2·3·4 = 네 단추 · Enter/→ 다음 문항 · ← 이전 · ↓ 다음 후보 · Esc 닫기. 진행 「3/9」.
 *     쓰기는 예전 단추와 같은 함수 htSetKind(등급) · htConfirm(✗ 아님)를 그대로 부른다(같은 모양으로 저장). ✗ 로 후보가 하나도 안 남으면 「적중 없음」 확정.
 *  ③ 유사유형 접기 — 분석지에서 원장님이 아직 안 본 문항 중 후보가 모두 유사유형인 것(교과서·지난 기출에도 같은 문제·숫자변형이 없을 때)은
 *     한 줄(번호 · 유사유형 n개 · 펼치기). 「유사유형만 문항도 펼치기」 = 이 기기 기억(localStorage ht_type_open).
 *  ④ 고등부 수학비서 «내 문제지» 기본값 — 요청·다시 판정 화면: 시험이 고등이면 과목(exam.subject · 공수1·공수2·미적1·확통 같은 줄임말 포함)이
 *     제목(없으면 폴더 이름)과 맞는 내 문제지를 자동 체크 + 띠 「📄 과목에 맞는 수학비서 내 문제지 n장을 자동으로 넣었어요」(체크 끄기 가능).
 *     기출·내신·다른 학교 문제지, 시험 뒤에 만든 것, 문항 0개는 뺀다. 다시 판정은 지난 판정에 내 문제지가 하나도 없을 때만 자동으로 더한다.
 *     결과 화면: 고등부인데 src.mp 가 비어 있으면 노란 띠 「수학비서 자료 없이 판정된 결과예요 — 다시 판정을 권해요」 + 다시 판정 화면(자동 체크한 채로).
 *  문서 docs/exam_hit_contract.md §12 · 검사 sync/appbuild/tests/test_v19128.js
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 앞 부품(hit · hitsrc · hitsrc2 · layout3_hit · mstree · msdiff · pastcmp · pubsrc · pubgrade116 · cn*)의 함수를 감싸서 바꾼다.
 * ═══════════════════════════════════════════════════════════════════ */
var HV = { rev:null, typeOpen:{}, typeAll:(function(){ try{ return localStorage.getItem('ht_type_open')==='1'; }catch(e){ return false; } })(),
  mpIdx:null, mpKick:false };
var HV_HIT = { same:1, 'var':1 };
var hvOrigEff = htEff;   /* v19-127 까지의 htEff (검사에서 «끄면 예전과 같다»를 비교) */

/* ── ① 한 곳에서 판단 ── */
function hvAutoOn(d){ return !d || d.autoAi!==false; }
function hvDocOf(it){
  if(!it) return null;
  var ds=HT.data||{}, cur=HT.cur?ds[HT.cur]:null;
  if(cur && Array.isArray(cur.items) && cur.items.indexOf(it)>=0) return cur;
  for(var k in ds){ var d=ds[k]; if(d && Array.isArray(d.items) && d.items.indexOf(it)>=0) return d; }
  return cur||null;
}
function hvLive(it){ return ((it&&it.cands)||[]).filter(function(c){ return c && !c.rejected; }); }
function hvTeacher(it){ var h=it&&it.hit; return !!(h && (h.ok===true || h.ok===false)); }
function hitEff(it, d){
  if(!it) return { kind:'none', by:null, cand:null, k:null };
  var h=it.hit;
  if(h && h.ok===true){ var c=(it.cands||[]).filter(function(x){ return x.k===h.k; })[0]||null; return { kind:h.kind, by:'teacher', cand:c, k:h.k }; }
  if(h && h.ok===false) return { kind:'none', by:'teacher', cand:null, k:null };
  if(d===undefined) d=hvDocOf(it);
  if(hvAutoOn(d)){ var t=hvLive(it)[0]; if(t && HV_HIT[t.kind]) return { kind:t.kind, by:'ai', cand:t, k:t.k }; }
  var c0=(it.cands||[])[0];
  return c0 ? { kind:c0.kind, by:null, cand:c0, k:c0.k } : { kind:'none', by:null, cand:null, k:null };
}
htEff = function(it){ var e=hitEff(it); return { kind:e.kind, k:e.k, sure:e.by==='teacher'?true:(e.by==='ai'?'ai':false), by:e.by }; };
window.hitEff = hitEff;
/* 유사유형뿐인 미확정 문항 (교과서·지난 기출에 같은 문제·숫자변형이 있으면 아님) */
function hvTypeOnly(it){
  if(!it || hvTeacher(it)) return false;
  var L=hvLive(it); if(!L.length) return false;
  if(!L.every(function(c){ return c.kind==='type'; })) return false;
  return !((it.pub||[]).concat(it.past||[]).some(function(p){ return p && !p.rejected && HV_HIT[p.kind]; }));
}
/* AI 로 센 문항 — [{ no, n(화면 번호), kind }] */
function hvAiList(d){
  var out=[]; if(!d || !hvAutoOn(d)) return out;
  htVisible(d).forEach(function(it){ var e=hitEff(it, d); if(e.by==='ai') out.push({ no:it.no, n:htNumOf(d,it), kind:e.kind }); });
  return out;
}
htStats=(function(o){ return function(d){
  var s=o.apply(this, arguments); if(!d) return s;
  var b=d.basis||'same+var'; s.autoAi=hvAutoOn(d); s.aiN=0; s.hitAi=0; s.typeOnly=0;
  htVisible(d).forEach(function(it){ var e=hitEff(it, d); if(e.by==='ai'){ s.aiN++; if(htInBasis(e.kind,b)) s.hitAi++; } if(hvTypeOnly(it)) s.typeOnly++; });
  return s; }; })(htStats);

/* 알약 — AI 로 센 것은 ✓ 대신 작은 「AI」 */
var hvPill0=htPill;
htPill=function(kind, sure){
  if(sure!=='ai') return hvPill0(kind, sure);
  var k=HT_KIND[kind]||HT_KIND.none;
  return '<span class="ht-pill hv-aipill" data-hvai="1" title="원장님 확인 전 — AI 판정을 그대로 적중으로 셉니다" style="color:'+k.c+';background:'+k.bg+'">'+k.t
    +' <b style="font-size:9.5px;padding:0 4px;border-radius:4px;background:#7c3aed;color:#fff;margin-left:1px">AI</b></span>';
};
/* 도넛 — AI 로 센 것이 있으면 원장 확정(진한 빨강) · AI(중간) · 후보(옅게) 세 겹 */
var hvDonut0=htDonut;
htDonut=function(s, size, ink){
  if(!s || !s.hitAi) return hvDonut0.apply(this, arguments);
  var R=38, C=2*Math.PI*R, T=s.total||0, t=T?Math.max(0,s.hitSure-s.hitAi)/T:0, a=T?s.hitAi/T:0, b=T?s.hitCand/T:0;
  var red=ink?'#b91c1c':'#dc2626', mid=ink?'#e08585':'#f87171', soft=ink?'#f3d0d0':'#fecaca', rest=ink?'#e5e5e5':'#e2e8f0';
  var arc=function(f, col){ return f?'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+col+'" stroke-width="14" stroke-dasharray="'+(C*f)+' '+C+'" transform="rotate(-90 50 50)"/>':''; };
  return '<svg viewBox="0 0 100 100" width="'+(size||132)+'" height="'+(size||132)+'" role="img" aria-label="적중률 '+s.pctAll+'%">'
    +'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+rest+'" stroke-width="14"/>'
    +arc(t+a+b, soft)+arc(t+a, mid)+arc(t, red)
    +'<text x="50" y="49" text-anchor="middle" font-size="18" font-weight="900" fill="#0f172a">'+s.pctAll+'%</text>'
    +'<text x="50" y="64" text-anchor="middle" font-size="8.5" font-weight="700" fill="#64748b">'+(s.hitSure+s.hitCand)+' / '+s.total+'문항</text></svg>';
};
window.hvAutoAi = function(on){
  var d=HT.cur?HT.data[HT.cur]:null; if(!d) return;
  if(on===undefined) on=!hvAutoOn(d);
  d.autoAi=!!on; htSave(d);
  htToast(on?'🤖 AI 판정(같은 문제·숫자변형)을 적중에 자동으로 넣습니다 — 원장님 ✓/✗ 가 늘 우선':'🤖 AI 자동 반영을 껐습니다 — 원장님이 확정한 것만 «확정»으로 셉니다');
  render(); if(HV.rev) hvRevDraw();
};
function hvAutoSwitch(d){ return htSwitch(hvAutoOn(d), '🤖 AI 판정 자동 반영', 'hvAutoAi()', '#7c3aed'); }

/* 요약 칸 — 확정 n (AI m) · 스위치 · ⚡ 빠른 검토 · (고등부) 수학비서 없이 판정 띠 */
htSummaryHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments); if(!d) return h;
  var s=htStats(d), n=hvRevList(d, false).length;
  h=h.replace(/(확정 <b style="color:#b91c1c">\d+<\/b>)( · 후보 \d+)/, function(all, x, y){ return x+(s.hitAi?' <span class="hv-aisub" style="color:#7c3aed;font-weight:800">(AI '+s.hitAi+')</span>':'')+y; });
  var mk='<label class="ht-sub" style="display:flex;gap:6px;align-items:center">적중 기준 ', i=h.indexOf(mk);
  var ctl='<span id="hv-ctl" style="display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap">'+hvAutoSwitch(d)
    +'<button class="ht-btn" id="hv-rev-btn" onclick="hvRevOpen()" title="결정이 필요한 문항만 한 화면에서 — 키 1·2·3·4 · Enter" style="background:#fef3c7;border-color:#fcd34d;color:#92400e;font-weight:900">⚡ 빠른 검토 ('+n+')</button></span>';
  if(i>=0) h=h.slice(0,i)+ctl+h.slice(i);
  var j=h.indexOf('확정 안 한 문항이 ');
  if(j>=0 && (s.aiN || s.typeOnly)){ var j2=h.indexOf('</span>', j);
    if(j2>0) h=h.slice(0,j2)+(s.typeOnly?(' (그중 유사유형만 '+s.typeOnly+'문항)'):'')+h.slice(j2); }
  if(s.aiN){ var z=h.indexOf('<span class="ht-sub" style="color:#b91c1c">확정 안 한 문항이 '); if(z<0) z=h.indexOf('<span class="ht-sub" style="color:#15803d">✓ 모두 확정</span>');
    var z2=z>=0?h.indexOf('</span>', z):-1;
    if(z2>0){ z2+='</span>'.length; h=h.slice(0,z2)+'<span class="ht-sub" id="hv-ai-line" style="color:#7c3aed;font-weight:800">🤖 AI 판정 '+s.aiN+'문항을 자동으로 셌습니다 (원장님 확인 전 · 같은 문제·숫자변형)</span>'+h.slice(z2); } }
  var nt=hvMpNotice(d);
  if(nt){ var c0='<div class="ht-card">', q=h.indexOf(c0); if(q>=0){ q+=c0.length; h=h.slice(0,q)+nt+h.slice(q); } else h=nt+h; }
  return h; }; })(htSummaryHtml);
/* 우리 자료별 적중 — ✓ 숫자에 AI 도 들어간다는 말 */
if(typeof htsByKindHtml==='function') htsByKindHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments); if(!hvAiList(d).length) return h;
  return h.replace('· ✓ = 원장님 확정', '· ✓ = 확정(원장님 + 🤖 AI 자동)'); }; })(htsByKindHtml);

/* 분석지 머리 — 확정 n / N · AI m · ⚡ 빠른 검토 · 유사유형 펼치기 */
htSheetHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments), s=htStats(d), n=hvRevList(d, false).length;
  h=h.replace(/(<b style="font-size:12.5px;color:#0d2240;font-variant-numeric:tabular-nums">확정 \d+ \/ \d+<\/b>)/, function(all){
    return all+(s.aiN?'<span class="ht-sub" id="hv-sheet-ai" style="color:#7c3aed;font-weight:800">🤖 그중 AI '+s.aiN+'</span>':'')
      +'<button class="ht-btn" id="hv-rev-btn3" style="padding:5px 10px;background:#fef3c7;border-color:#fcd34d;color:#92400e" onclick="hvRevOpen()">⚡ 빠른 검토 ('+n+')</button>'; });
  var mk='<span style="margin-left:auto;display:flex;gap:4px;align-items:center" class="ht-sub">카드 크기', i=h.indexOf(mk);
  if(i>=0) h=h.slice(0,i)+htSwitch(HV.typeAll, '유사유형만 문항도 펼치기'+(s.typeOnly?(' ('+s.typeOnly+')'):''), 'hvTypeAll()', '#1d4ed8')+h.slice(i);
  return h; }; })(htSheetHtml);
/* 접힌 줄(확정) — AI 로 센 것은 ✓ 대신 AI */
htFoldedRow=(function(o){ return function(d, it, n, e){
  var h=o.apply(this, arguments);
  if(!e || e.sure!=='ai') return h;
  var tail='<span class="ht-sub" style="font-size:11px">▼ 펼치기</span>', a=hvPill0(e.kind, true)+tail, i=h.lastIndexOf(a);
  return i>=0 ? h.slice(0,i)+htPill(e.kind,'ai')+tail+h.slice(i+a.length) : h; }; })(htFoldedRow);
/* ③ 유사유형뿐인 문항 — 한 줄로 */
function hvTypeRow(d, it, n){
  var L=hvLive(it);
  return '<div id="ht-q-'+it.no+'" class="ht-card hv-typerow" data-hvtype="'+it.no+'" onclick="hvTypeTog('+it.no+')" title="눌러서 펼치기" tabindex="0" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();hvTypeTog('+it.no+')}" style="padding:7px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer;background:#f8fafc;border-style:dashed">'
    +'<b style="font-size:14px;color:#0d2240;min-width:24px;font-variant-numeric:tabular-nums">'+(n<10?'0':'')+n+'</b>'
    +'<span class="ht-sub" style="flex:1;min-width:160px"><b style="color:#0f172a">'+htEsc(it.chapter||'')+'</b> › '+htEsc(it.type||'(유형 미확인)')+'</span>'
    +'<span class="ht-pill" style="color:#1d4ed8;background:#dbeafe">유사유형 '+L.length+'개</span>'
    +'<span class="ht-sub" style="font-size:11px">▼ 펼치기</span></div>';
}
htItemSheet=(function(o){ return function(d, it, n, e, W, b){
  var to=hvTypeOnly(it);
  if(to && !HV.typeAll && !HV.typeOpen[it.no] && !(HT.unfold&&HT.unfold[it.no])) return hvTypeRow(d, it, n);
  var h=o.apply(this, arguments);
  if(to && HV.typeOpen[it.no] && !HV.typeAll){
    var mk='<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">', i=h.indexOf(mk);
    if(i>=0){ i+=mk.length; h=h.slice(0,i)+'<button class="ht-btn no" style="padding:5px 9px" data-hvfold="'+it.no+'" onclick="hvTypeTog('+it.no+')">▲ 유사유형 접기</button>'+h.slice(i); }
  }
  return h; }; })(htItemSheet);
window.hvTypeTog = function(no){ HV.typeOpen[no]=!HV.typeOpen[no]; render(); };
window.hvTypeAll = function(){ HV.typeAll=!HV.typeAll; try{ localStorage.setItem('ht_type_open', HV.typeAll?'1':'0'); }catch(e){} render(); };

/* 오른쪽 칸 — 적중 기준 아래 스위치 · AI 수 · 접어 둔 수 · ⚡ 빠른 검토 / 왼쪽 시험 목록 «AI n» */
if(typeof l3hBasisBox==='function') l3hBasisBox=(function(o){ return function(d){
  var h=o.apply(this, arguments), s=htStats(d), n=hvRevList(d, false).length;
  var add='<span class="l3-sub" id="l3h-ai">'+hvAutoSwitch(d)+'</span>'
    +(s.aiN?'<span class="l3-sub" id="l3h-ai-n" style="color:#7c3aed;font-weight:800">🤖 AI 판정 '+s.aiN+'문항 반영 (원장님 확인 전)</span>':'')
    +(s.typeOnly?'<span class="l3-sub" id="l3h-type-n">유사유형만 '+s.typeOnly+'문항 — 접어 둠</span>':'')
    +'<button type="button" class="l3-btn main" id="l3h-rev" onclick="hvRevOpen()"><span>⚡ 빠른 검토</span><span class="n">'+n+'문항</span></button>';
  var z=h.lastIndexOf('</div>'); return z>=0 ? h.slice(0,z)+add+h.slice(z) : h+add; }; })(l3hBasisBox);
if(typeof l3hExamSub==='function') l3hExamSub=(function(o){ return function(x){
  var t=o.apply(this, arguments), d=x&&HT.data[x.examId];
  if(!d || !t || /분석 중|문항 없음/.test(t)) return t;
  var s=htStats(d); return s.aiN ? (t+' · AI '+s.aiN) : t; }; })(l3hExamSub);

/* 학부모 보고서 · 블로그 .md · 요약 복사 · 카드뉴스 — AI 로 센 문항에 표시 */
function hvPrintFix(d, h){
  var A=hvAiList(d); if(!A.length) return h;
  var by={}; A.forEach(function(a){ by[a.n]=a; });
  h=h.replace(/<tr><td><b>(\d+)<\/b>[\s\S]*?<\/tr>/g, function(row, n){ var a=by[Number(n)]; if(!a) return row;
    var lab='● '+(HT_KIND[a.kind]||{}).t+'</td>'; var i=row.indexOf(lab); if(i<0) return row;
    return row.slice(0,i)+'● '+(HT_KIND[a.kind]||{}).t+' <small style="font-weight:800">(AI)</small></td>'+row.slice(i+lab.length); });
  var mk='문항은 적중으로 세지 않았습니다.', j=h.indexOf(mk);
  if(j>=0){ j+=mk.length; h=h.slice(0,j)+' (AI) 표시 '+A.length+'문항은 원장님 확인 전 AI 판정(같은 문제·숫자변형)을 그대로 셌습니다.'+h.slice(j); }
  return h;
}
window.htPrint=(function(o){ return function(code){
  var d=HT.data[HT.cur], ow=window.open;
  if(!d || !hvAiList(d).length) return o.apply(this, arguments);
  window.open=function(){ var w=ow.apply(window, arguments); if(w){ try{ var doc=w.document, wr=doc.write.bind(doc); doc.write=function(x){ return wr(hvPrintFix(d, String(x))); }; }catch(e){} } return w; };
  try{ return o.apply(this, arguments); } finally { window.open=ow; } }; })(window.htPrint);
htMd=(function(o){ return function(d){
  var t=o.apply(this, arguments), A=hvAiList(d); if(!A.length) return t;
  var L=String(t).split('\n'), h0=-1;
  for(var i=0;i<L.length;i++){ if(/^\| 번호 \| 단원 \| 유형 \| 난도 \| 등급 \|/.test(L[i])){ h0=i; break; } }
  if(h0>=0) A.forEach(function(a){ var lab=' | '+(HT_KIND[a.kind]||{}).t+' | ';
    for(var j=h0+1;j<L.length && /^\|/.test(L[j]);j++){ if(L[j].indexOf('| '+a.n+' | ')===0 && L[j].indexOf(lab)>0){ L[j]=L[j].replace(lab, ' | '+(HT_KIND[a.kind]||{}).t+' (AI 판정) | '); break; } } });
  var nos=A.map(function(a){ return a.n; }).join(', ');
  var line='- 🤖 AI 판정 '+A.length+'문항('+nos+'번)은 원장님 확인 전 AI 판정(같은 문제·숫자변형)을 그대로 적중으로 셌다. 글에는 «AI 판정 포함»이라고 밝히거나, 원장님 확인 뒤에 쓴다.';
  var k=L.indexOf('- 모든 문항을 원장님이 직접 확인했다.');
  if(k>=0) L.splice(k, 1, '- 원장님이 직접 확인한 문항에 AI 판정 문항을 더해 셌다.', line);
  else { var w=-1; for(var m=0;m<L.length;m++){ if(/^- ⚠ 아직 원장님 확인 전인 후보/.test(L[m])){ w=m; break; } }
    if(w<0) for(var q=0;q<L.length;q++){ if(/^- 등급별: /.test(L[q])){ w=q; break; } }
    if(w>=0) L.splice(w+1, 0, line); else L.push(line); }
  return L.join('\n'); }; })(htMd);
window.htCopy=(function(o){ return function(){
  var d=HT.data[HT.cur], A=d?hvAiList(d):[], cw=navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText.bind(navigator.clipboard) : null;
  if(!A.length || !cw) return o.apply(this, arguments);
  try{ navigator.clipboard.writeText=function(t){ return cw(String(t)+'\n🤖 AI 판정 '+A.length+'문항 포함 ('+A.map(function(a){ return a.n; }).join(', ')+'번 · 원장님 확인 전)'); }; }catch(e){}
  try{ return o.apply(this, arguments); } finally { try{ navigator.clipboard.writeText=cw; }catch(e){} } }; })(window.htCopy);
if(typeof cnMd==='function') cnMd=(function(o){ return function(d, cards){
  var t=o.apply(this, arguments), A=hvAiList(d); if(!A.length) return t;
  var L=String(t).split('\n'), line='> - 🤖 적중 문항 중 '+A.length+'문항('+A.map(function(a){ return a.n; }).join(', ')+'번)은 원장님 확인 전 AI 판정(같은 문제·숫자변형)이다. 글에는 «AI 판정 포함»이라고 밝히거나 원장님 확인 뒤에 쓴다.';
  var i=-1; for(var j=0;j<L.length;j++){ if(/^> - 마지막은/.test(L[j])){ i=j; break; } }
  if(i>=0) L.splice(i+1, 0, line); else L.push(line);
  return L.join('\n'); }; })(cnMd);
if(typeof cnPanelHtml==='function') cnPanelHtml=(function(o){ return function(d){
  var h=o.apply(this, arguments), A=hvAiList(d); if(!A.length) return h;
  var by={}; A.forEach(function(a){ by[a.no]=1; });
  h=h.replace(/(cnToggleNo\('picks',(\d+),4\)">[^<]*<small[^>]*>[^<]*<\/small>)/g, function(all, x, no){ return by[Number(no)] ? (x+' <b data-hvai="1" style="font-size:9.5px;padding:0 4px;border-radius:4px;background:#7c3aed;color:#fff">AI</b>') : all; });
  var mk='<div class="ht-h">🎯 문항별 적중 카드', i=h.indexOf(mk);
  if(i>=0) h=h.slice(0,i)+'<div class="ht-sub" id="hv-cn-ai" style="color:#7c3aed;font-weight:800;margin-bottom:4px">🤖 적중에 AI 판정 '+A.length+'문항('+A.map(function(a){ return a.n; }).join(', ')+'번)이 들어 있어요 — 카드 그림에는 표시하지 않고, 블로그자료.md 에 적어 둡니다</div>'+h.slice(i);
  return h; }; })(cnPanelHtml);

/* ── ② ⚡ 빠른 검토 ── */
/* 결정이 필요한 문항: 원장님이 아직 안 본 것 중 후보에 같은 문제·숫자변형이 있는 것 (+ 「포함하기」면 유사유형뿐인 것) */
function hvRevList(d, incType){
  var out=[]; if(!d) return out;
  htVisible(d).forEach(function(it){
    if(hvTeacher(it)) return;
    var L=hvLive(it), sv=L.filter(function(c){ return HV_HIT[c.kind]; });
    if(sv.length) out.push({ no:it.no, why:sv.length>=2?'multi':'top', top:!!(L[0] && HV_HIT[L[0].kind]) });
    else if(incType && hvTypeOnly(it)) out.push({ no:it.no, why:'type', top:false });
  });
  return out;
}
window.hvRevOpen = function(){
  var d=HT.cur?HT.data[HT.cur]:null; if(!d){ htToast('먼저 분석한 시험을 골라 주세요'); return; }
  var L=hvRevList(d, false);
  HV.rev={ examId:HT.cur, inc:false, list:L, i:0, ci:{}, done:{} };
  hvRevDraw();
  try{ var bx=document.querySelector('#hv-rev .hv-box'); if(bx) bx.focus(); }catch(e){}
};
window.hvRevClose = function(){ HV.rev=null; var el=document.getElementById('hv-rev'); if(el) el.remove(); try{ render(); }catch(e){} };
window.hvRevInc = function(){
  var R=HV.rev, d=R?HT.data[R.examId]:null; if(!d) return;
  var cur=R.list[R.i]?R.list[R.i].no:null; R.inc=!R.inc;
  var keep={}; R.list.forEach(function(x){ if(R.done[x.no]) keep[x.no]=x; });
  var L=hvRevList(d, R.inc), seen={}; L.forEach(function(x){ seen[x.no]=1; });
  Object.keys(keep).forEach(function(no){ if(!seen[no]) L.push(keep[no]); });
  L.sort(function(a,b){ return htNumOf(d, htItem(a.no)||{ no:a.no })-htNumOf(d, htItem(b.no)||{ no:b.no }); });
  R.list=L; R.i=0; for(var i=0;i<L.length;i++){ if(L[i].no===cur){ R.i=i; break; } }
  hvRevDraw();
};
function hvRevItem(){ var R=HV.rev; if(!R || !R.list.length) return null; var x=R.list[R.i]; return x?htItem(x.no):null; }
function hvRevCands(it){ var L=hvLive(it); if(!L.length && it && it.hit && it.hit.k) L=(it.cands||[]).filter(function(c){ return c.k===it.hit.k; }); return L; }
function hvRevCand(it){
  var R=HV.rev, L=hvRevCands(it); if(!L.length) return null;
  if(it.hit && it.hit.ok===true && R.ci[it.no]==null){ for(var i=0;i<L.length;i++){ if(L[i].k===it.hit.k) return L[i]; } }
  var j=(R.ci[it.no]||0)%L.length; return L[j];
}
window.hvRevGo = function(step){
  var R=HV.rev; if(!R || !R.list.length) return;
  R.i=Math.max(0, Math.min(R.list.length-1, R.i+step)); hvRevDraw();
};
window.hvRevJump = function(i){ var R=HV.rev; if(!R) return; R.i=Math.max(0, Math.min(R.list.length-1, Number(i)||0)); hvRevDraw(); };
window.hvRevCandNext = function(){
  var R=HV.rev, it=hvRevItem(); if(!R || !it) return; var L=hvRevCands(it); if(L.length<2) return;
  var cur=hvRevCand(it), at=0; for(var i=0;i<L.length;i++){ if(cur && L[i].k===cur.k){ at=i; break; } }
  R.ci[it.no]=(at+1)%L.length; hvRevDraw();
};
/* 1 같은 문제 · 2 숫자변형 · 3 유사유형 · 4 ✗ 아님 — 예전 단추와 같은 함수로 쓴다 */
window.hvRevAct = function(kind){
  var R=HV.rev, it=hvRevItem(); if(!R || !it) return; if(HT.cur!==R.examId){ htToast('다른 시험이 열려 있습니다 — 빠른 검토를 다시 열어 주세요'); return; }
  var c=hvRevCand(it); if(!c){ htToast('이 문항에는 남은 후보가 없습니다'); return; }
  var no=it.no;
  if(kind==='no'){
    htConfirm(no, c.k, false);
    var left=hvLive(it);
    if(!left.length){ htConfirm(no, null, false); R.done[no]='none'; }
    else if(left.some(function(x){ return HV_HIT[x.kind]; })){ R.ci[no]=0; hvRevDraw(); return; }   /* 같은 문제·숫자변형 후보가 더 있으면 그 문항에 머문다 */
    else R.done[no]='skip';
  } else { htSetKind(no, c.k, kind); R.done[no]=kind; R.ci[no]=null; }
  if(R.i<R.list.length-1) R.i++;
  hvRevDraw();
};
function hvImgBox(src, alt, fallback){
  return src ? '<img src="'+htEsc(src)+'" alt="'+htEsc(alt)+'" onclick="htZoom(this.src)" style="width:100%;max-height:min(46vh,520px);object-fit:contain;object-position:left top;display:block;cursor:zoom-in;background:#fff">'
    : '<div class="ht-sub" style="padding:26px 12px;text-align:center;line-height:1.6">'+fallback+'</div>';
}
function hvRevDraw(){
  var R=HV.rev, el=document.getElementById('hv-rev');
  if(!R){ if(el) el.remove(); return; }
  var d=HT.data[R.examId];
  if(!el){ el=document.createElement('div'); el.id='hv-rev'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-label','빠른 검토');
    el.style.cssText='position:fixed;inset:0;z-index:99990;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto;box-sizing:border-box';
    document.body.appendChild(el); }
  var typeN=0; if(d) htVisible(d).forEach(function(it){ if(hvTypeOnly(it)) typeN++; });
  var doneN=0; R.list.forEach(function(x){ if(R.done[x.no]) doneN++; });
  var h='<div class="hv-box" tabindex="-1" style="background:#fff;border-radius:16px;max-width:1120px;width:100%;padding:14px 16px;box-sizing:border-box;box-shadow:0 20px 50px rgba(15,23,42,.35);outline:none;font-family:inherit;color:#0f172a">';
  h+='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:16px;color:#0d2240">⚡ 빠른 검토</b>'
    +(d?'<span class="ht-sub">'+htEsc(htExamName(d.exam||{}))+'</span>':'')
    +'<b id="hv-prog" style="font-size:14px;color:#92400e;background:#fef3c7;border-radius:8px;padding:2px 9px;font-variant-numeric:tabular-nums">'+(R.list.length?(R.i+1)+'/'+R.list.length:'0/0')+'</b>'
    +'<span class="ht-sub" id="hv-done">결정 '+doneN+'</span>'
    +(typeN||R.inc?'<span class="ht-sub" id="hv-type" style="display:inline-flex;gap:6px;align-items:center">'+(R.inc?('유사유형만 '+typeN+'문항 포함'):('유사유형만 '+typeN+'문항 — 접어 둠'))
      +'<button class="ht-btn" id="hv-type-btn" style="padding:3px 9px;font-size:11px" onclick="hvRevInc()">'+(R.inc?'다시 접기':'포함하기')+'</button></span>':'')
    +(d?'<span style="display:inline-flex">'+hvAutoSwitch(d)+'</span>':'')
    +'<button class="ht-btn" id="hv-close" style="margin-left:auto" onclick="hvRevClose()" aria-label="닫기">✕ 닫기</button></div>';
  if(!d){ el.innerHTML=h+'<div class="ht-sub">시험을 불러오지 못했습니다.</div></div>'; return; }
  if(!R.list.length){
    el.innerHTML=h+'<div style="padding:30px 10px;text-align:center"><div style="font-size:15px;font-weight:900;color:#15803d">✓ 결정이 필요한 문항이 없습니다</div><div class="ht-sub" style="margin-top:6px">같은 문제·숫자변형 후보는 모두 원장님이 확인했습니다.'+(typeN?(' 유사유형뿐인 문항 '+typeN+'개는 「포함하기」로 볼 수 있어요.'):'')+'</div></div></div>';
    return;
  }
  /* 번호 줄 */
  h+='<div id="hv-chips" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px">'+R.list.map(function(x, i){
    var it=htItem(x.no), n=it?htNumOf(d,it):x.no, dn=R.done[x.no], on=i===R.i;
    var bg=on?'#0d2240':(dn?(dn==='none'||dn==='skip'?'#e2e8f0':'#dcfce7'):'#fff'), co=on?'#fff':(dn?(dn==='none'||dn==='skip'?'#475569':'#15803d'):'#334155');
    return '<button class="ht-chip" data-hvchip="'+x.no+'" aria-current="'+(on?'true':'false')+'" onclick="hvRevJump('+i+')" style="padding:3px 9px;background:'+bg+';color:'+co+';border-color:'+(on?'#0d2240':'#cbd5e1')+'">'+n+'번'+(dn&&dn!=='skip'?' ✓':'')+(x.why==='type'?' <small>유사</small>':'')+'</button>'; }).join('')+'</div>';
  var x=R.list[R.i], it=htItem(x.no);
  if(!it){ el.innerHTML=h+'</div>'; return; }
  var n=htNumOf(d,it), L=hvRevCands(it), c=hvRevCand(it), ci=0; for(var q=0;q<L.length;q++){ if(c && L[q].k===c.k){ ci=q; break; } }
  var m=c?((d.mats||{})[c.k]||{}):{}, e=hitEff(it, d), sel=!!(c && it.hit && it.hit.ok===true && it.hit.k===c.k), cur=sel?it.hit.kind:null, K=c?(HT_KIND[c.kind]||HT_KIND.none):HT_KIND.none;
  var state=e.by==='teacher'?('<span class="ht-pill" style="background:#dcfce7;color:#15803d">원장님 확정 · '+(HT_KIND[e.kind]||HT_KIND.none).t+'</span>'):(e.by==='ai'?htPill(e.kind,'ai'):'<span class="ht-pill" style="background:#f1f5f9;color:#475569">미확정</span>');
  h+='<div class="hv-row" data-hvno="'+it.no+'" style="border:2px solid #0d2240;border-radius:14px;padding:10px 12px">'
    +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:17px;color:#0d2240;font-variant-numeric:tabular-nums">'+(n<10?'0':'')+n+'번</b>'
    +'<span class="ht-sub"><b style="color:#0f172a">'+htEsc(it.chapter||'')+'</b> › '+htEsc(it.type||'(유형 미확인)')+'</span>'
    +(x.why==='multi'?'<span class="ht-pill" id="hv-multi" style="background:#ffedd5;color:#c2410c">후보 2개 이상 — 확인</span>':'')
    +(x.why==='type'?'<span class="ht-pill" style="background:#dbeafe;color:#1d4ed8">유사유형만</span>':'')
    +'<span style="margin-left:auto">'+state+'</span></div>';
  var src=htItemImg(it), mi=htMatImg(m);
  h+='<div class="hv-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:10px;align-items:start">'
    +'<div style="border:2px solid #1d4ed8;border-radius:12px;overflow:hidden"><div style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;font-weight:900;color:#0d2240">시험 원본</div>'+hvImgBox(src, n+'번 시험 문항', '그림을 불러오지 못했습니다')+'</div>'
    +'<div style="border:2px solid '+(c?K.c:'#e2e8f0')+';border-radius:12px;overflow:hidden"><div style="padding:6px 10px;border-bottom:1px solid #e2e8f0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:12px;font-weight:900;color:#334155">'
    +'<span>'+(c?htEsc((typeof htsKindLabel==='function'?htsKindLabel(m):'')||'우리 자료'):'후보 없음')+'</span>'
    +(c?'<span id="hv-kind" style="font-size:10.5px;font-weight:900;color:'+K.c+';background:'+K.bg+';padding:2px 7px;border-radius:6px">AI: '+K.t+'</span>':'')
    +(c&&c.idSame?'<span style="font-size:10px;font-weight:800;background:#f1f5f9;padding:2px 6px;border-radius:6px">원본 번호 같음</span>':'')
    +'<span id="hv-cpos" style="margin-left:auto;font-size:11px;color:#64748b">후보 '+(L.length?(ci+1)+'/'+L.length:'0')+'</span></div>'
    +(c?hvImgBox(mi, '우리 자료 문항', '<b style="color:#0f172a">'+htEsc(m.title||'')+'</b><br>'+htEsc(m.where||c.k)+(c.why?('<br>AI: '+htEsc(c.why)):'')):'<div class="ht-sub" style="padding:26px 12px;text-align:center">남은 후보가 없습니다</div>')
    +'</div></div>';
  if(c) h+='<div class="ht-sub" id="hv-why" style="margin-top:8px;font-size:12.5px;line-height:1.6"><b style="color:#0f172a">자료</b> '+htEsc(m.where||c.k)+(m.title?(' · '+htEsc(m.title)):'')+(c.why?(' · <b style="color:#0f172a">AI</b> '+htEsc(c.why)):'')+'</div>';
  var bt=function(key, kind, label){ var on=sel&&cur===kind, KK=HT_KIND[kind];
    return '<button class="ht-btn" data-hvact="'+kind+'" onclick="hvRevAct(\''+kind+'\')" '+(c?'':'disabled ')+'style="flex:1;min-width:120px;padding:9px 6px;font-size:13px;font-weight:900;border:1.5px solid '+KK.c+';background:'+(on?KK.c:'#fff')+';color:'+(on?'#fff':KK.c)+'"><small style="opacity:.7">'+key+'</small> '+(on?'✓ ':'')+label+'</button>'; };
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'+bt('1','same','✓ 같은 문제')+bt('2','var','숫자변형')+bt('3','type','유사유형')
    +'<button class="ht-btn" data-hvact="no" onclick="hvRevAct(\'no\')" '+(c?'':'disabled ')+'style="flex:1;min-width:120px;padding:9px 6px;font-size:13px;font-weight:900;border:1.5px solid #94a3b8;background:#fff;color:#475569"><small style="opacity:.7">4</small> ✗ 아님</button>'
    +'<button class="ht-btn" id="hv-next-cand" onclick="hvRevCandNext()" '+(L.length>1?'':'disabled ')+'style="padding:9px 12px;font-size:13px">다음 후보 ▸</button></div>';
  h+='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px"><button class="ht-btn" id="hv-prev" onclick="hvRevGo(-1)" '+(R.i>0?'':'disabled ')+'>◀ 이전</button>'
    +'<button class="ht-btn pri" id="hv-next" onclick="hvRevGo(1)" '+(R.i<R.list.length-1?'':'disabled ')+'>다음 문항 ▶</button>'
    +(doneN===R.list.length?'<span class="ht-sub" style="color:#15803d;font-weight:900">✓ 목록을 다 봤습니다</span>':'')
    +'<span class="ht-sub" style="margin-left:auto;font-size:11px">키: 1 같은 문제 · 2 숫자변형 · 3 유사유형 · 4 ✗ 아님 · Enter/→ 다음 · ← 이전 · ↓ 다음 후보 · Esc 닫기</span></div>';
  h+='</div></div>';
  el.innerHTML=h;
}
function hvKey(ev){
  if(!HV.rev || !document.getElementById('hv-rev')) return;
  var t=ev.target, tg=t&&t.tagName; if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||(t&&t.isContentEditable)) return;
  if(ev.ctrlKey||ev.metaKey||ev.altKey) return;
  var k=ev.key, m={ '1':'same', '2':'var', '3':'type', '4':'no' };
  if(m[k]){ ev.preventDefault(); hvRevAct(m[k]); }
  else if((k==='Enter' && tg!=='BUTTON') || k==='ArrowRight'){ ev.preventDefault(); hvRevGo(1); }
  else if(k==='ArrowLeft'){ ev.preventDefault(); hvRevGo(-1); }
  else if(k==='ArrowDown'){ ev.preventDefault(); hvRevCandNext(); }
  else if(k==='Escape'){ ev.preventDefault(); hvRevClose(); }
}
try{ document.addEventListener('keydown', hvKey, true); }catch(e){}

/* ── ④ 고등부 수학비서 «내 문제지» 기본값 ── */
var HV_SUBJ=[[/공통\s*수학\s*(2|Ⅱ|II)|공수\s*2/,'공통수학2'],[/공통\s*수학\s*(1|Ⅰ|I)|공수\s*1/,'공통수학1'],[/대수/,'대수'],
  [/미적분\s*(2|Ⅱ|II)|미적\s*2/,'미적분2'],[/미적분|미적\s*1/,'미적분1'],[/확률\s*과\s*통계|확통/,'확률과통계'],[/기하/,'기하']];
function hvSubjOf(t){ t=String(t||''); for(var i=0;i<HV_SUBJ.length;i++){ if(HV_SUBJ[i][0].test(t)) return HV_SUBJ[i][1]; } return ''; }
function hvSubjNorm(s){ return hvSubjOf(s) || String(s||'').replace(/\s/g,''); }
function hvIsHigh(e){ return /^고/.test(htGradeKey(e && e.grade)); }
function hvNz(t){ return String(t||'').replace(/\s/g,''); }
function hvSchoolsIn(idx){ var out=[]; (function walk(fs){ (fs||[]).forEach(function(f){ if(/^[가-힣]{1,5}[중고]$/.test(hvNz(f.n))) out.push(hvNz(f.n)); walk(f.c); }); })((idx&&idx.tree)||[]); return out; }
/* ctx = { sub, to, school, idx } — 과목이 맞는 내 문제지인가 */
function hvMpMatch(x, ctx){
  if(!x || !ctx || !ctx.sub) return false;
  if(!(Number(x.n)>0)) return false;
  var t=String(x.title||'');
  if(/통합기출/.test(String(x.folderPath||'')) || /^\s*내신/.test(t) || /기출/.test(t) || /^\s*\[?\s*(\d{2}|20\d\d)\s*(-\s*\d{2})?\s*년/.test(t)) return false;   /* 다른 학교·지난 시험 기출 (mstMpExam 과 같은 규칙) */
  var me=htSchoolKey(ctx.school), sc=hvSchoolsIn(ctx.idx);
  for(var i=0;i<sc.length;i++){ if(sc[i]!==me && hvNz(t).indexOf(sc[i])>=0) return false; }
  var ts=hvSubjOf(t);
  if(ts){ if(ts!==ctx.sub) return false; }
  else { var segs=String(x.folderPath||'').split(' › ').map(hvSubjOf).filter(Boolean); if(segs.indexOf(ctx.sub)<0) return false; }
  var c=String(x.createdAt||'').slice(0,10); if(c && ctx.to && c>ctx.to) return false;   /* 시험 뒤에 만든 것은 뺀다 */
  return true;
}
function hvMpCtx(){
  if(!HTS.exam || !hvIsHigh(HTS.exam)) return null;
  var sub=hvSubjNorm(HTS.subject||HTS.exam.subject||''); if(!sub) return null;
  return { sub:sub, to:HTS.to||'', school:HTS.exam.school, idx:HTS.mpIdx };
}
function hvMpSubjAuto(x){ var c=hvMpCtx(); return !!c && hvMpMatch(x, c); }
if(typeof mstMpAuto==='function') mstMpAuto=(function(o){ return function(x){ return o.apply(this, arguments) || hvMpSubjAuto(x); }; })(mstMpAuto);
/* 다시 판정 — 지난 판정에 내 문제지가 하나도 없었으면 과목에 맞는 것을 넣은 채로 연다 */
if(typeof hts2ApplySrc==='function') hts2ApplySrc=(function(o){ return function(src){
  var r=o.apply(this, arguments);
  if(HTS.exam && hvIsHigh(HTS.exam) && !(((src||{}).mp)||[]).length && typeof mstMpItems==='function')
    mstMpItems().forEach(function(x){ if(hvMpSubjAuto(x)) delete HTS.mpOff[String(x.id)]; });
  return r; }; })(hts2ApplySrc);
/* 요청 화면 띠 */
function hvMpBanner(){
  if(!HTS.open || HTS.loading || !HTS.exam || !hvIsHigh(HTS.exam) || !HTS.mpIdx || typeof mstMpItems!=='function') return '';
  var c=hvMpCtx();
  if(!c) return '<div class="ht-strip" id="hv-mp-auto" style="display:block;margin:8px 0 0;background:#f8fafc;border-color:#e2e8f0;color:#475569">📄 고등부는 <b>과목</b>을 고르면 과목에 맞는 수학비서 내 문제지를 자동으로 넣어요.</div>';
  var list=mstMpItems().filter(function(x){ return hvMpMatch(x, c); }); if(!list.length) return '';
  var on=list.filter(mstMpOn).length;
  var h='<div class="ht-strip" id="hv-mp-auto" style="display:block;margin:8px 0 0;background:#ecfeff;border-color:#a5f3fc;color:#155e75">📄 과목에 맞는 수학비서 내 문제지 <b id="hv-mp-n">'+on+'장</b>을 자동으로 넣었어요 <span style="font-weight:700">('+htEsc(c.sub)+' · 빼려면 체크를 끄세요)</span>'
    +'<div style="display:flex;flex-direction:column;gap:3px;margin-top:6px;max-height:220px;overflow:auto">';
  list.forEach(function(x){ var o=mstMpOn(x);
    h+='<label class="hv-mp-row" data-hvmp="'+htEsc(x.id)+'" style="display:flex;gap:8px;align-items:center;font-size:12px;font-weight:700;color:#0f172a;cursor:pointer"><input type="checkbox"'+(o?' checked':'')+' onchange="mstMpTog(\''+htEsc(x.id)+'\')">'
      +'<span style="min-width:0;overflow-wrap:anywhere">'+htEsc(x.title||'(제목 없음)')+' <small style="color:#64748b;font-weight:700">'+(Number(x.n)||0)+'문항'+(x.createdAt?(' · '+htsMd(x.createdAt)):'')+' · '+(x.status==='ready'?'인식됨':'분석 때 인식')+(x.folderPath?(' · '+htEsc(x.folderPath)):'')+'</small></span></label>'; });
  return h+'</div></div>';
}
if(typeof htsPanelHtml==='function') htsPanelHtml=(function(o){ return function(){
  var h=o.apply(this, arguments), b=hvMpBanner(); if(!b) return h;
  var mk='<div class="hts-panels">', i=h.indexOf(mk);
  return i>=0 ? h.slice(0,i)+b+h.slice(i) : h+b; }; })(htsPanelHtml);
/* 결과 화면 — 고등부인데 내 문제지 없이 판정 */
function hvMpKick(){
  if(HV.mpKick) return; HV.mpKick=true;
  htKv('ms_mypapers_index').then(function(v){ HV.mpIdx=(v&&v.items)?v:null; if(VIEW==='examhit') render(); }).catch(function(){});
}
function hvMpNotice(d){
  if(!d || !d.exam || !hvIsHigh(d.exam)) return '';
  if(d.src && (d.src.mp||[]).length) return '';
  hvMpKick();
  var sub=hvSubjNorm(d.exam.subject||(((d.stats||{}).pub||{}).subject)||''), n=0;
  if(sub && HV.mpIdx){ var ctx={ sub:sub, to:d.to||d.exam.date||'', school:d.exam.school, idx:HV.mpIdx }; (HV.mpIdx.items||[]).forEach(function(x){ if(hvMpMatch(x, ctx)) n++; }); }
  return '<div class="ht-strip" id="hv-mp-notice" style="background:#fefce8;border-color:#fde047;color:#854d0e;flex-wrap:wrap;margin:0 0 10px">⚠ <b>수학비서 자료 없이 판정된 결과예요 — 다시 판정을 권해요</b>'
    +(n?('<span style="font-weight:700">· '+htEsc(sub)+' 에 맞는 내 문제지 '+n+'장이 있어요</span>'):'')
    +'<button class="ht-btn" id="hv-mp-rej" onclick="hvRejWithMp()" style="margin-left:auto;background:#fde047;border-color:#facc15;color:#713f12;font-weight:900">🔄 내 문제지 넣고 다시 판정</button></div>';
}
window.hvRejWithMp = function(){ htsRejOpen(); };
