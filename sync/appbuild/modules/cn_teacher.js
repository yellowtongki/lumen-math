/* ═══════════════════════════════════════════════════════════════════
 * v19-80: 📰 적중 분석 카드뉴스 — 블로그 세션에 넘길 카드 그림 + 글 자료 (원장 결정 2026-10-05)
 *  · 색 12가지 중 고르기 · 사선 「루멘수학」 워터마크 켜기/끄기 (다른 학원이 그대로 가져다 쓰지 못하게)
 *  · 킬러 문항 · 문항별 적중 카드는 원장님이 고른다 · 매쓰플랫이 잘못 붙인 단원은 고친다
 *  · 시험 문제 그림은 흐리게(모자이크) · 자료 이름은 종류만(루멘 자체교재·교과서…) · 마지막은 「루멘수학」만
 *  · 「🖼 카드 + 글 자료 내려받기」 → 01_표지.png … + 블로그자료.md 를 zip 하나로
 *  저장: exam_hit_<시험>.card = { pal, wm, killers:[no], picks:[no], unit:{no:단원}, keywords:[4], message, strategy:[5] }
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var CN = { open:false, busy:'', fontsOn:false };
var CN_PAL=[
 {n:'미드나잇 블루',c1:'#1d3a6e',c2:'#13284d',c3:'#0b1a33',ink:'#ffffff',sub:'#c9d5ea',acc:'#4a8dff',acc2:'#ff5a5a',hand:'#e9eef8',foot:'#8ea3c6',bgm:'rgba(160,190,255,.07)',panel:'#f7f9fc',pline:'transparent',tag:'#0b1a33',tagInk:'#ffffff',wm:'rgba(255,255,255,.09)'},
 {n:'숲속 그린',c1:'#1f5a48',c2:'#123d32',c3:'#0a231d',ink:'#ffffff',sub:'#c7e3d8',acc:'#3ddc97',acc2:'#ff8a65',hand:'#e6f6ef',foot:'#87b8a5',bgm:'rgba(160,240,200,.07)',panel:'#f6fbf8',pline:'transparent',tag:'#0f3a2f',tagInk:'#ffffff',wm:'rgba(255,255,255,.09)'},
 {n:'버건디 골드',c1:'#6b1f35',c2:'#45121f',c3:'#260a12',ink:'#ffffff',sub:'#f0d4dc',acc:'#f2c14e',acc2:'#ff8f8f',hand:'#fbeaee',foot:'#c9939f',bgm:'rgba(255,210,170,.07)',panel:'#fdf8f6',pline:'transparent',tag:'#45121f',tagInk:'#f2c14e',wm:'rgba(255,255,255,.09)'},
 {n:'차콜 오렌지',c1:'#3a3a40',c2:'#232327',c3:'#121214',ink:'#ffffff',sub:'#d8d8de',acc:'#ff8a3d',acc2:'#ffd166',hand:'#f1f1f4',foot:'#9a9aa4',bgm:'rgba(255,200,150,.06)',panel:'#f7f7f8',pline:'transparent',tag:'#232327',tagInk:'#ff8a3d',wm:'rgba(255,255,255,.08)'},
 {n:'퍼플 나이트',c1:'#3d2a78',c2:'#271a52',c3:'#140d2e',ink:'#ffffff',sub:'#d9d0f5',acc:'#a78bfa',acc2:'#f472b6',hand:'#efeaff',foot:'#9d8fcc',bgm:'rgba(200,180,255,.07)',panel:'#f9f8fe',pline:'transparent',tag:'#271a52',tagInk:'#ffffff',wm:'rgba(255,255,255,.09)'},
 {n:'딥 틸',c1:'#145a63',c2:'#0d3c42',c3:'#062226',ink:'#ffffff',sub:'#c8e8ea',acc:'#4fd1c5',acc2:'#fbbf24',hand:'#e6f7f8',foot:'#86b9bd',bgm:'rgba(150,240,240,.07)',panel:'#f5fbfb',pline:'transparent',tag:'#0d3c42',tagInk:'#ffffff',wm:'rgba(255,255,255,.09)'},
 {n:'루멘 레드',c1:'#8a1d2a',c2:'#5c111c',c3:'#33080f',ink:'#ffffff',sub:'#f6d3d6',acc:'#ffd166',acc2:'#ffffff',hand:'#fff0f1',foot:'#d39aa1',bgm:'rgba(255,200,200,.07)',panel:'#fffaf9',pline:'transparent',tag:'#5c111c',tagInk:'#ffffff',wm:'rgba(255,255,255,.1)'},
 {n:'화이트 블루',c1:'#ffffff',c2:'#f4f7fc',c3:'#e8eef8',ink:'#14213d',sub:'#4b5b74',acc:'#1f5fbf',acc2:'#d33a3a',hand:'#1f5fbf',foot:'#7c8aa0',bgm:'rgba(31,95,191,.06)',panel:'#ffffff',pline:'#d6dee9',tag:'#1f5fbf',tagInk:'#ffffff',wm:'rgba(31,95,191,.08)'},
 {n:'아이보리 레드',c1:'#fffdf8',c2:'#fbf6ec',c3:'#f3ead9',ink:'#2a1d14',sub:'#6b5a48',acc:'#c8322e',acc2:'#1f5fbf',hand:'#c8322e',foot:'#9a8670',bgm:'rgba(200,50,46,.05)',panel:'#ffffff',pline:'#eadfcb',tag:'#c8322e',tagInk:'#ffffff',wm:'rgba(200,50,46,.08)'},
 {n:'민트 라이트',c1:'#ffffff',c2:'#effaf5',c3:'#ddf3e9',ink:'#0f2e26',sub:'#3f6457',acc:'#0f8f74',acc2:'#e0661b',hand:'#0f8f74',foot:'#6f9284',bgm:'rgba(15,143,116,.06)',panel:'#ffffff',pline:'#cfe9dd',tag:'#0f8f74',tagInk:'#ffffff',wm:'rgba(15,143,116,.08)'},
 {n:'스카이 오렌지',c1:'#ffffff',c2:'#eef6ff',c3:'#dbeafe',ink:'#0f1f3d',sub:'#3e5578',acc:'#2563eb',acc2:'#f97316',hand:'#f97316',foot:'#7088ad',bgm:'rgba(37,99,235,.06)',panel:'#ffffff',pline:'#cfe0f7',tag:'#2563eb',tagInk:'#ffffff',wm:'rgba(37,99,235,.08)'},
 {n:'그레이 모노',c1:'#fafafa',c2:'#f0f0f1',c3:'#e3e3e6',ink:'#111114',sub:'#4b4b55',acc:'#111114',acc2:'#e11d48',hand:'#e11d48',foot:'#8a8a94',bgm:'rgba(0,0,0,.05)',panel:'#ffffff',pline:'#dcdce0',tag:'#111114',tagInk:'#ffffff',wm:'rgba(0,0,0,.07)'}
];
var CN_KC={ same:'#ff5a5a', 'var':'#ff9a3d', type:'#4a8dff', none:'#8a96a8', text:'#8a96a8' };
var CN_KN={ same:'같은 문제', 'var':'숫자변형', type:'유사유형', none:'적중 없음', text:'적중 없음' };
var CN_MATC={'루멘수학 시험대비자료':'#ff5a5a','루멘수학 자체교재':'#ff5a5a','루멘수학 학습지':'#4a8dff','루멘수학 대비자료':'#ff9a3d','루멘수학 기출자료':'#8e5bd6','루멘 자체교재':'#ff5a5a','수업 학습지':'#4a8dff','교과서':'#2fa36b','학원 대비 자료':'#ff9a3d','시중 교재':'#8e5bd6','지난 기출':'#8a96a8','우리 프린트':'#e0661b'};
function cnMatKind(m){ if(!m) return ''; if(m.kind==='upload') return '우리 프린트'; var t=String(m.title||''); if(/교과서/.test(t)) return '교과서'; if(/Lumen|루멘/i.test(t)) return '루멘 자체교재'; if(/원본|기출/.test(t)) return '지난 기출'; if(/쎈|RPM|일품|개념\+유형|라이트|블랙|최상위|체크체크|자이스토리|올림포스|마플/.test(t)) return '시중 교재'; if(/변형|대비|직전|파이널/.test(t)) return '학원 대비 자료'; return '수업 학습지'; }

/* v19-81: 카드뉴스에 나가는 자료 이름 — 교과서 말고는 «루멘수학» 자료 (원장 지시 2026-10-05)
 *   one   = 교과서 / 루멘수학 시험대비자료
 *   split = 교과서 / 루멘수학 자체교재 · 루멘수학 학습지 · 루멘수학 대비자료 · 루멘수학 기출자료 */
var CN_SPLIT={'루멘 자체교재':'루멘수학 자체교재','수업 학습지':'루멘수학 학습지','우리 프린트':'루멘수학 학습지','학원 대비 자료':'루멘수학 대비자료','시중 교재':'루멘수학 대비자료','지난 기출':'루멘수학 기출자료'};
function cnMatLabel(m, mode){ var k=cnMatKind(m); if(!k) return ''; if(k==='교과서') return '교과서'; if(mode==='split') return CN_SPLIT[k]||'루멘수학 대비자료'; return '루멘수학 시험대비자료'; }
/* v19-81: 난이도 칸 — 개수(2~5)와 경계를 원장님이 고른다. 기준은 기출 DB 난이도(1~9, 5 이상 어려움) 또는 매쓰플랫 난도(1~5) */
var CN_BANDN={2:['보통','어려움'],3:['쉬움','보통','어려움'],4:['쉬움','보통','어려움','최고난도'],5:['매우 쉬움','쉬움','보통','어려움','최고난도']};
var CN_BANDC={2:['#3d8ee0','#ff5a5a'],3:['#f2b84b','#3d8ee0','#ff5a5a'],4:['#f2b84b','#3d8ee0','#ff5a5a','#9b1c4a'],5:['#8ccf6a','#f2b84b','#3d8ee0','#ff5a5a','#9b1c4a']};
var CN_CUTS={ ms:{2:[5],3:[3,5],4:[3,5,7],5:[2,3,5,7]}, mf:{2:[4],3:[3,4],4:[2,3,4],5:[2,3,4,5]} };
/* 기출 DB 난이도 — 워커가 적어 둔 d.exam.msLv(문항 번호 순) 또는 이미 받아 둔 기출(ms_exams)에서 같은 학교·학년·연도·학기·시험 */
function cnMsLv(d){
  var e=d.exam||{}; if(e.msLv&&e.msLv.length) return e.msLv;
  try{ var v=(EA.ms||{})[e.school]; var ex=((v&&v.exams)||[]).filter(function(x){ return (e.mydb&&String(x.id)===String(e.mydb)) || (String(x.grade)===String(e.grade)&&String(x.year)===String(e.year)&&String(x.semester)===String(e.semester)&&x.term===e.term); })[0];
    if(ex&&(ex.cells||[]).some(function(c){ return c.difficulty!=null; })){ var a=[]; ex.cells.forEach(function(c){ a[(+c.no||0)-1]=c.difficulty; }); return a; } }catch(err){}
  return null;
}
function cnDiff(d){
  var c=cnCfg(d), ms=cnMsLv(d), df=c.diff||{};
  var src=(df.src==='mf'||!ms)?'mf':'ms', n=Math.max(2,Math.min(5,+df.n||3));
  var cuts=(df.cuts&&df.cuts.length===n-1&&df.src===src)?df.cuts.map(Number):CN_CUTS[src][n].slice();
  return { src:src, n:n, cuts:cuts, max:src==='ms'?9:5, names:CN_BANDN[n], cols:CN_BANDC[n], ms:ms, hasMs:!!ms, hardIdx:CN_BANDN[n].indexOf('어려움'), hard:cuts[CN_BANDN[n].indexOf('어려움')-1] };
}
function cnBand(lv, D){ var b=0; for(var i=0;i<D.cuts.length;i++){ if(lv>=D.cuts[i]) b=i+1; } return b; }
function cnBandTxt(D){ return D.names.map(function(nm,i){ var lo=i===0?1:D.cuts[i-1], hi=i<D.cuts.length?D.cuts[i]-1:D.max; return nm+' '+(lo===hi?lo:(lo+'~'+hi)); }).join(' · '); }
window.cnDiffSet=function(k, v, i){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d), D=cnDiff(d); var df={ src:D.src, n:D.n, cuts:D.cuts.slice() };
  if(k==='src'){ df.src=v; df.cuts=CN_CUTS[v][df.n].slice(); } else if(k==='n'){ df.n=+v; df.cuts=CN_CUTS[df.src][df.n].slice(); } else if(k==='cut'){ df.cuts[i]=Math.max(1,Math.min(D.max,parseInt(v,10)||1)); df.cuts.sort(function(a,b){ return a-b; }); }
  c.diff=df; cnSave(d); render(); };


/* ═══ v19-83: 총평·요약 글 = 카드 숫자로 (원장 지적 2026-10-06 — 블로그 세션이 「서술형 5문항(19~23번) · 고난도 5」와 카드의 「서술형 2 · 어려움 2」가 어긋난다고 알림) ═══
 *   출제 경향 AI 초안은 시험지를 처음 나눌 때(23칸, 합치기 전 · 매쓰플랫 난도) 쓴 글이라 원장님이 고른 것·합친 것이 반영되지 않는다.
 *   → 카드·블로그 자료의 총평은 «카드 숫자로 쓴 글»이 기본. 원장님이 「출제 경향」 칸을 고쳐 쓴 글을 고를 수도 있다(숫자가 다르면 경고). */
function cnNums(a){ return a.map(function(r){ return r.n+'번'; }).join('·'); }
function cnFacts(d){
  var c=cnCfg(d), R=cnRows(d), T=R.length||1, D=cnDiff(d), bc=D.names.map(function(){ return 0; }); R.forEach(function(r){ bc[r.band]=(bc[r.band]||0)+1; });
  var hard=R.filter(function(r){ return r.band>=D.hardIdx; }), essay=R.filter(function(r){ return r.essay; }), K=R.filter(function(r){ return r.killer; }), hit=R.filter(function(r){ return r.inB; }).length;
  var ch={}, chs=[]; R.forEach(function(r){ if(!ch[r.chapter]){ ch[r.chapter]=[]; chs.push(r.chapter); } ch[r.chapter].push(r); }); chs.sort(function(a,b){ return ch[b].length-ch[a].length; });
  var bandSum=D.names.map(function(nm,i){ return nm+' '+bc[i]; }).join(' · '), basisLbl=HT_BASIS[d.basis||'same+var'].label;
  var auto='이번 시험은 '+chs.slice(0,3).join('·')+(chs.length>3?(' 등 '+chs.length+'개 단원'):'')+'에서 '+T+'문항이 출제되었습니다. '
    +(essay.length?('서술형은 '+essay.length+'문항('+cnNums(essay)+')이고, '):'')
    +'난이도는 '+bandSum+'문항이며, '+(hard.length?('어려운 문항 '+hard.length+'개('+cnNums(hard)+')가 변별을 갈랐습니다. '):'전체적으로 무난했습니다. ')
    +'루멘 학생들이 시험 전에 푼 자료와 한 문항씩 대조하면 '+T+'문항 중 '+hit+'문항이 «'+basisLbl+'» 기준으로 적중했습니다.';
  var autoK=K.length?('변별 문항은 '+K.map(function(r){ return r.n+'번('+r.type+')'; }).join(', ')+'입니다.'):'';
  var ed=!!(d.trend&&d.trend.edited&&d.trend.trend), useEd=c.trendSrc==='edited'&&ed;
  return { T:T, D:D, bc:bc, hard:hard, essay:essay, K:K, hit:hit, chs:chs, ch:ch, bandSum:bandSum, basisLbl:basisLbl, auto:auto, autoK:autoK, hasEd:ed,
    src:useEd?'edited':'auto', trend:useEd?d.trend.trend:auto, killer:useEd?(d.trend.killer||autoK):autoK };
}
/* 출제 경향 칸 글(AI 초안이든 원장님 글이든)의 숫자가 카드와 다른 곳 */
window.cnTrendIssues=function(d, F){
  F=F||cnFacts(d); var t=((d.trend&&d.trend.trend)||'')+' \n '+((d.trend&&d.trend.killer)||''), out=[], seen={};
  var add=function(x){ if(!seen[x]){ seen[x]=1; out.push(x); } };
  var m=t.match(/서술형[^0-9.\n]{0,10}(\d+)\s*문항/); if(m&&+m[1]!==F.essay.length) add('서술형 '+m[1]+'문항 → 카드는 '+F.essay.length+'문항'+(F.essay.length?'('+cnNums(F.essay)+')':''));
  var re=/(\d+)\s*[~∼\-]\s*(\d+)\s*번/g, x; while((x=re.exec(t))){ if(+x[2]>F.T) add('「'+x[0]+'」 → 이 시험은 '+F.T+'번까지'); }
  var re1=/(\d+)\s*번/g; while((x=re1.exec(t))){ if(+x[1]>F.T) add('「'+x[0]+'」 → 이 시험은 '+F.T+'번까지'); }
  var m3=t.match(/(고난도|어려운 문항|난도 4~5|킬러|변별)[^0-9.\n]{0,12}(\d+)\s*문항/); if(m3&&+m3[2]!==F.hard.length&&+m3[2]!==F.K.length) add('「'+m3[0]+'」 → 카드는 어려움 '+F.hard.length+' · 변별 '+F.K.length);
  return out;
};
window.htTrendFromCards=function(){ var d=HT.data[HT.cur]; if(!d) return; var F=cnFacts(d), old=d.trend||{};
  if(!confirm('출제 경향 칸을 카드 숫자로 쓴 글로 바꿉니다 (AI 처음 글은 「되돌리기」로 다시 볼 수 있어요).\n\n'+F.auto+(F.autoK?('\n\n'+F.autoK):''))) return;
  d.trend={ trend:F.auto, killer:F.autoK, edited:true, by:'teacher', at:new Date().toISOString(), ai:old.ai||(old.edited?null:{ trend:old.trend||'', killer:old.killer||'' }) };
  cnCfg(d).trendSrc='edited'; cnSave(d); render(); };

/* ── 설정 ── */
function cnCfg(d){
  if(!d.card) d.card={};
  var c=d.card, vis=htVisible(d);
  if(c.pal==null) c.pal=1; if(c.wm==null) c.wm=true;
  if(c.matMode==null) c.matMode='one';
  if(!c.killers){ var _ms=cnMsLv(d); c.killers=vis.filter(function(it){ var n=htNumOf(d,it); return (_ms&&_ms[n-1]!=null)?Number(_ms[n-1])>=5:Number(it.level||0)>=4; }).map(function(it){ return it.no; }); }
  if(!c.picks) c.picks=[]; if(!c.unit) c.unit={};
  if(!c.keywords) c.keywords=['','','',''];
  if(c.message==null) c.message='많이 푸는 것보다, 미리 풀어 본 문제를 다시 맞히는 것.';
  if(!c.strategy) c.strategy=['단원별 핵심 개념 다시 정리','틀린 문제 같은 유형으로 다시 풀기','기출 반복 유형 먼저 연습','서술형 풀이 과정 쓰기','시험 시간에 맞춰 실전 연습'];
  return c;
}
/* v19-82: 고를 때마다 바로 저장 + 「💾 저장」 단추 · 「✅ 저장되었습니다 HH:MM」 표시 (원장 요청 2026-10-06) */
function cnSaveMark(){ var el=document.getElementById('cn-saved'); if(!el) return;
  if(CN.saving){ el.textContent='⏳ 저장 중…'; el.style.color='#b45309'; return; }
  if(CN.saveErr){ el.textContent='⚠ 저장 실패 — 「💾 저장」을 다시 눌러 주세요'; el.style.color='#b91c1c'; return; }
  if(CN.savedAt){ var t=CN.savedAt; el.textContent='✅ 저장되었습니다 '+String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0')+':'+String(t.getSeconds()).padStart(2,'0'); el.style.color='#15803d'; } }
function cnSave(d, noChange){
  if(!noChange){ try{ cnCfg(d).changedAt=new Date().toISOString(); }catch(e){} }
  CN.saving=true; CN.saveErr=''; cnSaveMark(); d.savedAt=new Date().toISOString();
  return htKvSet('exam_hit_'+d.examId, d).then(function(){ CN.saving=false; CN.savedAt=new Date(); cnSaveMark(); return true; })
    .catch(function(e){ CN.saving=false; CN.saveErr=String((e&&e.message)||e); cnSaveMark(); htToast('저장 실패: '+CN.saveErr); return false; });
}
window.cnSaveNow=function(){ var d=HT.data[HT.cur]; if(!d) return; cnCfg(d); cnSave(d, true).then(function(ok){ if(ok) htToast('💾 저장되었습니다 — 고른 문항·색·난이도 칸이 이 시험에 남았습니다'); }); };
window.cnToggle=function(){ CN.open=!CN.open; render(); if(CN.open) setTimeout(function(){ var el=document.getElementById('cn-panel'); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); },30); };
window.cnSet=function(k, v){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); c[k]=v; cnSave(d); render(); };
window.cnToggleNo=function(k, no, max){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); var a=c[k]||[], i=a.indexOf(no);
  if(i>=0) a.splice(i,1); else { if(max && a.length>=max){ htToast('최대 '+max+'개까지 고를 수 있어요'); return; } a.push(no); }
  c[k]=a; cnSave(d); render(); };
window.cnText=function(k, i, v){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); if(i==null) c[k]=v; else { c[k]=c[k]||[]; c[k][i]=v; } cnSave(d); var pv=document.getElementById('cn-cards'); if(pv) pv.innerHTML=cnCardsHtml(d); };
window.cnUnit=function(no, v){ var d=HT.data[HT.cur]; if(!d) return; var c=cnCfg(d); v=String(v||'').trim(); if(v) c.unit[no]=v; else delete c.unit[no]; cnSave(d); render(); };

/* ── 데이터 ── */
function cnRows(d){
  var c=cnCfg(d), b=d.basis||'same+var', D=cnDiff(d);
  return htVisible(d).map(function(it){ var e=htEff(it), top=e.k?(it.cands||[]).filter(function(x){ return x.k===e.k; })[0]:null, m=top?(d.mats||{})[top.k]:null;
    var yrs=[]; (it.repeat||[]).forEach(function(r){ if(yrs.indexOf(r.year)<0) yrs.push(r.year); }); yrs.sort();
    var n=htNumOf(d,it), lv=Number(it.level||0); if(D.src==='ms'&&D.ms&&D.ms[n-1]!=null) lv=Number(D.ms[n-1]);
    return { no:it.no, n:n, it:it, chapter:c.unit[it.no]||it.chapter||'(단원 미확인)', type:it.type||'', level:lv, band:cnBand(lv,D), kind:e.kind, inB:htInBasis(e.kind,b),
      killer:c.killers.indexOf(it.no)>=0, essay:!!it.essay, yrs:yrs, mk:(htInBasis(e.kind,b)&&m)?cnMatLabel(m,c.matMode):'', top:top, m:m, ask:it.ask||'' }; });
}
function cnEsc(s){ return htEsc(s); }
function cnHead(d){ var e=d.exam||{}; var g=String(e.grade||''); var gn=g.replace(/^중/,'').replace(/^고/,''); return e.year+'학년도 '+e.school+(/고$/.test(e.school)?'등학교':'학교')+' '+gn+'학년 수학 · '+e.semester+'학기 '+e.term; }
var CN_BG='y = ax\n∠AOB    △ABC\n  y = a/x   ≡\nAB ∥ CD';
function cnCard(no, N, head, ttl, sub, hand, body, quote, foot){
  return '<div class="cn" role="img" aria-label="카드 '+no+'"><div class="bgm">'+CN_BG+'</div><div class="wmk" aria-hidden="true">'+Array(13).join('<span>루멘수학</span>')+'</div>'
   +'<div class="top"><div class="brand">루멘수학<small>쌤 모르겠어요에서 아하까지</small></div><div class="pg"><i>근거로 푸는 수학, 루멘수학</i><span>'+no+' / '+N+'</span></div></div>'
   +(hand?'<div class="hand">'+hand+'</div>':'')
   +'<div class="eyebrow">'+cnEsc(head)+'</div><div class="ttl">'+ttl+'</div>'+(sub?'<div class="sub">'+sub+'</div>':'')
   +'<div class="body">'+body+'</div>'+(quote?'<div class="quote">'+quote+'</div>':'')
   +'<div class="foot"><span>'+cnEsc(foot)+'</span><span>LUMEN MATH · FOR A CLEARER MIND</span></div></div>';
}
function cnDonut(parts, center, sub){
  var R=60, C=2*Math.PI*R, tot=parts.reduce(function(a,p){ return a+p.v; },0)||1, off=0, s='<svg viewBox="0 0 160 160" width="100%" role="img" aria-label="'+center+'">';
  s+='<circle cx="80" cy="80" r="'+R+'" fill="none" stroke="#e3e9f2" stroke-width="24"/>';
  parts.forEach(function(p){ if(!p.v) return; var L=C*p.v/tot; s+='<circle cx="80" cy="80" r="'+R+'" fill="none" stroke="'+p.c+'" stroke-width="24" stroke-dasharray="'+L+' '+(C-L)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 80 80)"/>'; off+=L; });
  return s+'<text x="80" y="82" text-anchor="middle" font-size="27" font-weight="900" fill="#1b2433">'+center+'</text><text x="80" y="102" text-anchor="middle" font-size="11" fill="#64748b">'+sub+'</text></svg>';
}
function cnFlow(R, h, mini, D){
  var MX=(D&&D.max)||5, n=R.length||1, W=600, H=h||200, L=30, B=26, step=(W-L-12)/Math.max(1,n-1), y=function(l){ return 14+(H-B-(mini?14:40))*(MX-Math.max(1,Math.min(MX,l)))/(MX-1); };
  var a=Math.round(n*0.4), b=Math.round(n*0.75);
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="문항별 난이도 흐름">';
  if(!mini){ s+='<rect x="'+L+'" y="8" width="'+(step*(a-0.5))+'" height="'+(H-B-6)+'" fill="#eef3fb"/><rect x="'+(L+step*(a-0.5))+'" y="8" width="'+(step*(b-a))+'" height="'+(H-B-6)+'" fill="#e4ecf8"/><rect x="'+(L+step*(b-0.5))+'" y="8" width="'+(step*(n-b-0.5)+12)+'" height="'+(H-B-6)+'" fill="#fde8ea"/>';
    s+='<text x="'+(L+step*(a-1)/2)+'" y="'+(H-B-10)+'" text-anchor="middle" font-size="12" fill="#5d6b80" font-weight="700">1~'+a+' 앞</text><text x="'+(L+step*(a+b-1)/2)+'" y="'+(H-B-10)+'" text-anchor="middle" font-size="12" fill="#5d6b80" font-weight="700">'+(a+1)+'~'+b+' 가운데</text><text x="'+(L+step*(b+n-1)/2)+'" y="'+(H-B-10)+'" text-anchor="middle" font-size="12" fill="#d33a3a" font-weight="700">'+(b+1)+'~'+n+' 뒤</text>'; }
  var _mid=Math.round((1+MX)/2), _lb={}; _lb[1]='하'; _lb[_mid]='중'; _lb[MX]='상';
  if(D&&D.hard&&!mini) s+='<line x1="'+L+'" x2="'+W+'" y1="'+y(D.hard-0.5)+'" y2="'+y(D.hard-0.5)+'" stroke="#ff5a5a" stroke-width="1.2" stroke-dasharray="6 4"/><text x="'+(W-4)+'" y="'+(y(D.hard-0.5)-5)+'" text-anchor="end" font-size="11" font-weight="700" fill="#d33a3a">어려움 '+D.hard+' 이상</text>';
  [1,_mid,MX].forEach(function(l){ s+='<text x="'+(L-8)+'" y="'+(y(l)+4)+'" text-anchor="end" font-size="11" fill="#64748b">'+_lb[l]+'</text><line x1="'+L+'" x2="'+W+'" y1="'+y(l)+'" y2="'+y(l)+'" stroke="#d6dee9" stroke-dasharray="3 4"/>'; });
  var pts=R.map(function(r,i){ return [L+step*i+6, y(r.level||1)]; });
  s+='<polyline fill="none" stroke="#ff5a5a" stroke-width="2.5" points="'+pts.map(function(p){ return p.join(','); }).join(' ')+'"/>';
  pts.forEach(function(p,i){ var k=R[i].killer; s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(k?6:4.5)+'" fill="'+(k?'#ff5a5a':'#1b2433')+'"/>'; });
  R.forEach(function(r,i){ if(i===0||i===n-1||(i+1)%5===0) s+='<text x="'+(L+step*i+6)+'" y="'+(H-6)+'" text-anchor="middle" font-size="11" fill="#64748b">'+(i+1)+'</text>'; });
  return s+'</svg>';
}
function cnBars(rows, max){ return '<div style="display:grid;gap:1.4cqw">'+rows.map(function(r){ return '<div style="display:grid;grid-template-columns:22cqw minmax(0,1fr) 10cqw;gap:1.6cqw;align-items:center;font-size:2.1cqw"><b>'+r.n+'</b><div class="bar"><i style="width:'+Math.round(r.v/(max||1)*100)+'%;background:'+r.c+'"></i></div><b style="text-align:right;font-variant-numeric:tabular-nums">'+r.t+'</b></div>'; }).join('')+'</div>'; }

/* ── 카드 12장 (+ 문항별 적중 카드는 원장님이 고른 만큼) ── */
function cnCards(d){
  var c=cnCfg(d), R=cnRows(d), T=R.length||1, head=cnHead(d), e=d.exam||{}, foot=(e.school||'')+' '+String(e.grade||'').replace(/^중/,'')+'학년 · 수학';
  var hit=R.filter(function(r){ return r.inB; }).length, cnt={same:0,'var':0,type:0,none:0}; R.forEach(function(r){ cnt[r.kind==='text'?'none':r.kind]=(cnt[r.kind==='text'?'none':r.kind]||0)+1; });
  var D=cnDiff(d), bc=D.names.map(function(){ return 0; }); R.forEach(function(r){ bc[r.band]=(bc[r.band]||0)+1; });
  var lvH=R.filter(function(r){ return r.band>=D.hardIdx; }).length, srcTxt=(D.src==='ms'?'기출 DB 난이도(1~9)':'매쓰플랫 난도(1~5)');
  var avg=Math.round(R.reduce(function(a,r){ return a+r.level; },0)/T*10)/10;
  var K=R.filter(function(r){ return r.killer; });
  var ch={}, chs=[]; R.forEach(function(r){ if(!ch[r.chapter]){ ch[r.chapter]=[]; chs.push(r.chapter); } ch[r.chapter].push(r); }); chs.sort(function(a,b){ return ch[b].length-ch[a].length; });
  var rep=R.filter(function(r){ return r.yrs.length; });
  var mk={}, mks=[]; R.forEach(function(r){ if(!r.mk) return; if(!mk[r.mk]){ mk[r.mk]=[]; mks.push(r.mk); } mk[r.mk].push(r); }); mks.sort(function(a,b){ return mk[b].length-mk[a].length; });
  var picks=(c.picks||[]).map(function(no){ return R.filter(function(r){ return r.no===no; })[0]; }).filter(Boolean);
  var N='§N§', out=[], basisLbl=HT_BASIS[d.basis||'same+var'].label;
  var F=cnFacts(d), trend=F.trend, killerTxt=F.killer;   /* v19-83: 카드 숫자로 쓴 글 (또는 원장님이 고른 글) */
  var first2=function(t){ var s=String(t||'').replace(/([.다])\s+/g,'$1\u0001').split('\u0001'); return s.slice(0,2).join(' '); };   /* 옛 사파리: 뒤돌아보기 정규식 없이 */
  var kw=(c.keywords||[]).filter(function(x){ return String(x||'').trim(); });
  if(!kw.length) kw=[(chs[0]||'')+' 비중 최다', K.length?('변별 '+K.length+'문항'):'고른 난이도', rep.length?('기출 유형 반복 '+rep.length):'새 유형 출제', '서술형 '+R.filter(function(r){ return r.essay; }).length+'문항'];
  var no=0;
  function push(file, card, para, facts){ out.push({ file:file, html:card, para:para, facts:facts }); }
  /* 01 표지 */
  no++; push('01_표지', cnCard(no,N,head,'이번 시험,<br><em>한눈에</em> 보기', cnEsc((chs.slice(0,2).join('부터 ')||'')+'까지, '+T+'문항을 하나씩 뜯어봤습니다.'),'미리 푼 문제가<br>시험에 나왔다',
    '<div class="grid2" style="grid-template-columns:repeat(4,minmax(0,1fr))"><div class="tile"><b>'+T+'</b><span>총 문항 · 서술형 '+R.filter(function(r){ return r.essay; }).length+'</span></div><div class="tile"><b>'+avg+'<small style="font-size:3cqw">/'+D.max+'</small></b><span>평균 난이도</span></div><div class="tile"><b style="color:#d33a3a">'+K.length+'</b><span>변별 문항</span></div><div class="tile"><b style="color:#1f5fbf">'+hit+'</b><span>루멘 적중 문항</span></div></div>'
    +'<div class="pn" style="margin-top:auto"><h4><b class="no">요약</b> 이번 시험의 핵심</h4><p>'+cnEsc(first2(trend)||(chs[0]+'이(가) '+ch[chs[0]].length+'문항으로 가장 많았습니다.'))+'</p></div>',
    '<em>'+T+'문항</em> 중 <em>'+hit+'문항</em>, 루멘에서 미리 풀었습니다.', foot),
    e.year+'년 '+e.semester+'학기 '+e.term+'고사 '+e.school+' '+e.grade+' 수학을 문항 하나하나 분석했습니다. 시험지를 문항별로 나누고, 루멘 학생들이 시험 전에 푼 교재·학습지와 한 문항씩 대조했습니다.',
    ['총 '+T+'문항 · 평균 난이도 '+avg+'/'+D.max+' ('+srcTxt+') · 변별 문항 '+K.length+' · 루멘 적중 '+hit+' ('+basisLbl+')']);
  /* 02 난이도 흐름 */
  var groups={}; K.forEach(function(r){ (groups[r.chapter]=groups[r.chapter]||[]).push(r); }); var gks=Object.keys(groups).slice(0,3);
  no++; push('02_난이도흐름', cnCard(no,N,head,'왜 <em class="r">어려웠을까?</em>', K.length?cnEsc('변별 문항 '+K.map(function(r){ return r.n+'번'; }).join('·')+'이 시험지 곳곳에 놓였습니다.'):'문항별 난이도 흐름입니다.', K.length?('쉬운 줄 알았는데<br>'+K[0].n+'번에서 멈췄다'):'',
    '<div class="pn" style="padding:2cqw"><h4>문항별 난이도 흐름 <span style="margin-left:auto;font-size:1.8cqw;color:#64748b;font-weight:500">● 변별 문항</span></h4>'+cnFlow(R,270,false,D)+'</div>'
    +(gks.length?'<div class="grid3" style="grid-template-columns:repeat('+gks.length+',minmax(0,1fr))">'+gks.map(function(g,i){ return '<div class="pn"><h4><b class="no">0'+(i+1)+'</b> '+cnEsc(g)+'</h4><p>'+groups[g].map(function(r){ return r.n+'번 — '+cnEsc(r.type); }).join('<br>')+'</p></div>'; }).join('')+'</div>':''),
    '변별 문항을 <em>미리 풀어 본 학생</em>이 유리했습니다.', foot),
    K.length?('어려운 문항은 '+K.map(function(r){ return r.n+'번'; }).join(', ')+'이었습니다. '+cnEsc(first2(killerTxt))):'이번 시험의 난이도 흐름입니다.',
    ['변별 문항(원장님 고름): '+K.map(function(r){ return r.n+'번 '+r.type; }).join(' · ')]);
  /* 03 단원 */
  var cols=['#1f5fbf','#ff9a3d','#2fa36b','#8e5bd6','#d33a3a','#0f8f74']; var parts=chs.map(function(k,i){ return {n:k,v:ch[k].length,c:cols[i%cols.length]}; });
  no++; push('03_단원비율', cnCard(no,N,head,'단원별 <em>출제 비율</em>', cnEsc(chs[0]+'이(가) '+ch[chs[0]].length+'문항으로 가장 많이 나왔습니다.'),'',
    '<div class="pn" style="display:grid;grid-template-columns:34cqw minmax(0,1fr);gap:3cqw;align-items:center">'+cnDonut(parts,String(T),'전체 문항')
    +'<div style="display:grid;gap:1.6cqw">'+parts.map(function(p){ return '<div style="font-size:2.2cqw"><span class="dot" style="background:'+p.c+'"></span><b>'+cnEsc(p.n)+'</b> <span style="color:#64748b">'+p.v+'문항 · '+Math.round(p.v/T*100)+'%</span><div style="font-size:1.8cqw;color:#64748b;margin:.4cqw 0 0 2.6cqw">'+ch[p.n].map(function(r){ return r.n; }).join(', ')+'번</div></div>'; }).join('')+'</div></div>',
    '한 단원도 버릴 수 없는 <em>출제</em>.', foot),
    '단원별로 보면 '+parts.map(function(p){ return p.n+' '+p.v+'문항'; }).join(', ')+'입니다.',
    parts.map(function(p){ return p.n+' '+p.v+'문항('+Math.round(p.v/T*100)+'%): '+ch[p.n].map(function(r){ return r.n; }).join(',')+'번'; }));
  /* 04 난이도 분포 — v19-81: 칸 개수·경계는 원장님이 고른 대로 */
  var mx=Math.max.apply(null,bc.concat([1])), bw=Math.min(100,Math.round(420/D.n)), gap=(480-bw*D.n)/Math.max(1,D.n-1||1);
  var bandSum=D.names.map(function(nm,i){ return nm+' '+bc[i]; }).join(' · ');
  no++; push('04_난이도분포', cnCard(no,N,head,'난이도별<br><em>문항 수</em>',cnEsc(bandSum)+'.','',
    '<div class="pn"><svg viewBox="0 0 520 230" width="100%" role="img" aria-label="난이도 막대">'+D.names.map(function(nm,i){ var x=20+i*(bw+(D.n>1?gap:0)), bh=150*bc[i]/mx, y=190-bh, col=D.cols[i]; return '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+Math.max(2,bh)+'" rx="4" fill="'+col+'"/><text x="'+(x+bw/2)+'" y="'+(y-8)+'" text-anchor="middle" font-size="26" font-weight="900" fill="'+col+'">'+bc[i]+'</text><text x="'+(x+bw/2)+'" y="215" text-anchor="middle" font-size="15" font-weight="700" fill="#1b2433">'+nm+'</text>'; }).join('')+'<line x1="10" x2="510" y1="190" y2="190" stroke="#cbd5e1"/></svg>'
    +'<div style="font-size:1.8cqw;color:#64748b;margin-top:1cqw">'+cnEsc(srcTxt+' 기준 — '+cnBandTxt(D))+'</div></div>'
    +(K.length?'<div class="pn"><h4><b class="no">변별</b> '+K.length+'문항</h4><p>'+K.map(function(r){ return '<b style="color:#d33a3a">'+r.n+'번</b> '+cnEsc(r.type); }).join(' · ')+'</p></div>':''),
    '실수 없이 <em>'+cnEsc(D.names[Math.max(0,D.hardIdx-1)])+' 문항</em>을 지키는 것이 먼저.', foot),
    '난이도로 보면 '+D.names.map(function(nm,i){ return nm+' '+bc[i]+'문항'; }).join(', ')+'입니다. 그중 어려운 문항은 '+lvH+'문항입니다.', [srcTxt+' 기준 — '+cnBandTxt(D)]);
  /* 05 적중 */
  var kp=['same','var','type','none'].map(function(k){ return {n:CN_KN[k],v:cnt[k]||0,c:CN_KC[k]}; });
  no++; push('05_적중결과', cnCard(no,N,head,T+'문항 중 <em>'+hit+'문항</em>,<br>시험 전에 풀었다','루멘 학생들이 시험 전에 푼 교재·학습지와 한 문항씩 대조했습니다.','지문만 같은 건<br>적중 아님!',
    '<div class="pn" style="display:grid;grid-template-columns:34cqw minmax(0,1fr);gap:3cqw;align-items:center">'+cnDonut(kp,Math.round(hit/T*100)+'%',hit+' / '+T+'문항')
    +'<div style="display:grid;gap:1.8cqw">'+kp.map(function(p){ return '<div style="font-size:2.3cqw"><span class="dot" style="background:'+p.c+'"></span><b>'+p.n+'</b> <span style="color:#64748b;float:right">'+p.v+'문항</span></div>'; }).join('')+'</div></div>'
    +'<div class="pn"><h4>기준에 따라 달라지는 적중</h4>'+cnBars([{n:'같은 문제만',v:cnt.same,t:cnt.same+'문항',c:'#ff5a5a'},{n:'+ 숫자변형',v:cnt.same+cnt['var'],t:(cnt.same+cnt['var'])+'문항',c:'#ff9a3d'},{n:'+ 유사유형',v:cnt.same+cnt['var']+cnt.type,t:(cnt.same+cnt['var']+cnt.type)+'문항',c:'#4a8dff'}],T)+'</div>',
    '같은 문제 <em>'+cnt.same+'</em> · 숫자변형 <em>'+cnt['var']+'</em> · 유사유형 <em>'+cnt.type+'</em>', foot),
    '적중은 세 단계로 나눠 셌습니다. 문제를 그대로 낸 «같은 문제», 숫자만 바꾼 «숫자변형», 같은 풀이 유형인 «유사유형». 소재만 비슷하고 묻는 것이 다른 문제는 적중으로 세지 않았습니다.',
    ['고른 기준: '+basisLbl+' → '+hit+'/'+T, '같은 문제 '+cnt.same+' · 숫자변형 '+cnt['var']+' · 유사유형 '+cnt.type+' · 없음 '+cnt.none]);
  /* 06 지도 */
  var cols5=Math.min(5,Math.ceil(Math.sqrt(T))+1);
  no++; push('06_적중지도', cnCard(no,N,head,T+'문항 <em>적중 지도</em>','시험지 번호 순서대로 색을 칠했습니다. 노란 점은 지난 기출과 같은 유형입니다.','',
    '<div class="pn"><div style="display:grid;grid-template-columns:repeat('+cols5+',minmax(0,1fr));gap:1.4cqw">'+R.map(function(r){ var k=r.inB?r.kind:'none'; return '<div style="aspect-ratio:1.15;border-radius:1cqw;background:'+(k==='none'?'#e3e9f2':CN_KC[k])+';color:'+(k==='none'?'#64748b':'#fff')+';display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative"><b style="font-size:4.4cqw;line-height:1">'+r.n+'</b><span style="font-size:1.7cqw;margin-top:.5cqw">'+CN_KN[k]+'</span>'+(r.yrs.length?'<i style="position:absolute;top:.9cqw;right:.9cqw;width:1.6cqw;height:1.6cqw;border-radius:50%;background:#ffd34d;box-shadow:0 0 0 .3cqw #fff"></i>':'')+'</div>'; }).join('')+'</div></div>',
    '빈칸은 <em>'+(T-hit)+'문항</em>.', foot),
    '색이 없는 칸은 '+R.filter(function(r){ return !r.inB; }).map(function(r){ return r.n+'번'; }).join(', ')+'입니다.', []);
  /* 07 자료 종류 */
  no++; push('07_자료별적중', cnCard(no,N,head,'적중 문항은<br><em>어떤 자료</em>에서?','적중 '+hit+'문항을 시험 전에 풀었던 자료 종류별로 나눴습니다.','',
    '<div class="pn"><div style="display:flex;height:5cqw;border-radius:1cqw;overflow:hidden;margin-bottom:2cqw">'+mks.map(function(k){ return '<div style="width:'+(mk[k].length/Math.max(1,hit)*100)+'%;background:'+(CN_MATC[k]||'#8a96a8')+';color:#fff;font-size:2cqw;font-weight:900;display:flex;align-items:center;justify-content:center">'+(mk[k].length>=2?mk[k].length:'')+'</div>'; }).join('')+'</div>'
    +cnBars(mks.map(function(k){ return {n:k,v:mk[k].length,t:mk[k].length+'문항',c:CN_MATC[k]||'#8a96a8'}; }), mks.length?mk[mks[0]].length:1)+'</div>'
    +(mks.length?'<div class="pn"><h4><b class="no">'+cnEsc(mks[0])+'</b> '+mk[mks[0]].length+'문항</h4><p>'+mk[mks[0]].map(function(r){ return r.n+'번'; }).join(' · ')+'</p></div>':''),
    '<em>'+cnEsc(mks[0]||'루멘 자료')+'</em>가 가장 많이 맞혔습니다.', foot),
    '가장 많이 맞힌 자료는 '+(mks[0]||'')+'로 '+(mks.length?mk[mks[0]].length:0)+'문항입니다.', mks.map(function(k){ return k+' '+mk[k].length+'문항: '+mk[k].map(function(r){ return r.n; }).join(',')+'번'; }));
  /* 문항별 적중 (원장님이 고른 것) */
  picks.forEach(function(r){
    no++;
    var keys=r.top?[r.top.k].concat(r.top.also||[]):[]; var ms=keys.map(function(k){ return (d.mats||{})[k]; }).filter(Boolean);
    var rows=ms.map(function(m){ var res=Object.keys(m.res||{}).map(function(x){ return m.res[x]; }); return {n:cnEsc(cnMatLabel(m,c.matMode)), v:res.length?res.filter(function(x){ return x==='O'; }).length/res.length:0, t:res.filter(function(x){ return x==='O'; }).length+'/'+res.length+'명', c:'#ff5a5a'}; });
    var exam=htItemImg(r.it), ours=r.m?htMatImg(r.m):'';
    var kname=CN_KN[r.kind]||'';
    push(String(no).padStart(2,'0')+'_'+r.n+'번적중', cnCard(no,N,head,'<em'+(r.killer?' class="r"':'')+'>'+r.n+'번</em> '+(r.killer?'변별 ':'')+'<em>'+kname+'</em> 적중','','미리 풀어 본<br>그 문제',
      '<div class="pn"><div class="kv"><span>유형</span><b>'+cnEsc(r.type)+'</b><span>적중 등급</span><b><span class="dot" style="background:'+CN_KC[r.kind]+'"></span>'+kname+'</b><span>지난 기출</span><b>'+(r.yrs.length?r.yrs.join(' · ')+'년':'—')+'</b></div></div>'
      +'<div class="pn"><h4>우리 교재 — 맞힌 자료 '+ms.length+'곳 <span style="margin-left:auto;font-size:1.8cqw;color:#64748b;font-weight:500">시험 전 정답 학생 / 푼 학생</span></h4>'+cnBars(rows,1)+'</div>'
      +'<div class="img2" style="flex:1"><figure><figcaption>시험 '+r.n+'번</figcaption>'+(exam?'<img class="blur" data-blur="1" src="'+cnEsc(exam)+'" alt="시험 '+r.n+'번 (흐리게)" crossorigin="anonymous">':'')+'<span class="bl">시험 문항 · 흐리게 처리</span></figure><figure><figcaption>루멘수학 자료</figcaption>'+(ours?'<img src="'+cnEsc(ours)+'" alt="루멘수학 자료" crossorigin="anonymous">':'')+'</figure></div>',
      r.kind==='same'?'미리 푼 문제가 <em>그대로</em> 나왔습니다.':(r.kind==='var'?'<em>숫자만 바뀐 채</em> 나왔습니다.':'같은 <em>풀이 방법</em>으로 풀리는 문제였습니다.'), foot),
      r.n+'번은 '+(cnMatLabel(r.m,c.matMode)||'루멘수학 자료')+'에 있던 문제와 '+(r.kind==='same'?'똑같은 문제':(r.kind==='var'?'숫자만 다른 문제':'같은 유형'))+'였습니다.'+(r.yrs.length?(' '+r.yrs.join('·')+'년 같은 시험에도 나온 유형입니다.'):''),
      ['유형: '+r.type, '등급: '+kname, '자료: '+ms.map(function(m){ return cnMatLabel(m,c.matMode); }).join(', '), '시험 전 정답: '+rows.map(function(x){ return x.t; }).join(' · ')]);
  });
  /* 반복 출제 */
  var yAll=[]; rep.forEach(function(r){ r.yrs.forEach(function(y){ if(yAll.indexOf(y)<0) yAll.push(y); }); }); yAll.sort();
  no++; push(String(no).padStart(2,'0')+'_반복출제', cnCard(no,N,head,'지난 기출에서<br><em>다시 나온 유형</em>','같은 학교·같은 학년·같은 시험의 지난 기출과 비교했습니다.','기출은<br>반복된다',
    '<div class="pn">'+(rep.length?'<table><tr><th>번호</th><th>유형</th>'+yAll.map(function(y){ return '<th style="text-align:center">'+y+'</th>'; }).join('')+'<th style="text-align:center">'+e.year+'</th></tr>'+rep.slice(0,12).map(function(r){ return '<tr><td><b>'+r.n+'</b></td><td>'+cnEsc(r.type)+'</td>'+yAll.map(function(y){ return '<td style="text-align:center">'+(r.yrs.indexOf(y)>=0?'<b style="color:#1f5fbf">●</b>':'<span style="color:#cbd5e1">○</span>')+'</td>'; }).join('')+'<td style="text-align:center"><b style="color:#d33a3a">●</b></td></tr>'; }).join('')+'</table>':'<p>지난 기출과 겹친 유형이 없습니다.</p>')+'</div>',
    T+'문항 중 <em>'+rep.length+'문항</em>이 다시 나왔습니다.', foot),
    T+'문항 중 '+rep.length+'문항이 지난 같은 시험에 나온 유형입니다.', rep.map(function(r){ return r.n+'번 '+r.type+' ('+r.yrs.join('·')+')'; }));
  /* 총평 */
  no++; push(String(no).padStart(2,'0')+'_총평', cnCard(no,N,head,'이번 시험 <em>총평</em>','<span style="display:block;max-width:74%">'+cnEsc(first2(trend)||'')+'</span>','',
    '<div style="position:absolute;right:0;top:-24cqw;background:#fff;color:#1b2433;border-radius:1.4cqw;padding:2cqw 2.4cqw;font-size:2cqw;line-height:1.9;width:34cqw;box-shadow:0 1cqw 3cqw rgba(0,0,0,.25)"><b style="color:#1f5fbf">이번 시험의 핵심 키워드</b><br>'+kw.slice(0,4).map(function(x){ return '☑ '+cnEsc(x); }).join('<br>')+'</div>'
    +'<div class="grid3" style="flex:1">'
    +'<div class="pn"><h4><b class="no">01</b> 전체 난이도</h4><div style="display:grid;grid-template-columns:16cqw minmax(0,1fr);gap:1.2cqw;align-items:center">'+cnDonut(D.names.map(function(nm,i){ return {v:bc[i],c:D.cols[i]}; }).reverse(),cnEsc(D.names[cnBand(avg,D)]),'전체 난이도')+'<p style="font-size:1.7cqw">'+D.names.map(function(nm,i){ return '<span style="color:'+D.cols[i]+'">●</span> '+cnEsc(nm)+' '+bc[i]+'문항'; }).reverse().join('<br>')+'</p></div></div>'
    +'<div class="pn"><h4><b class="no">02</b> 이번 시험의 특징</h4><p>'+kw.slice(0,3).map(function(x,i){ return ['①','②','③'][i]+' '+cnEsc(x); }).join('<br>')+'</p></div>'
    +'<div class="pn"><h4><b class="no">03</b> 대표 변별 문항</h4><p>'+(K.length?K.slice(0,3).map(function(r){ return '<b style="color:#1f5fbf">'+r.n+'번</b> '+cnEsc(r.type); }).join('<br>'):'—')+'</p></div>'
    +'<div class="pn"><h4><b class="no">04</b> 난이도 흐름</h4>'+cnFlow(R,150,true,D)+'</div>'
    +'<div class="pn"><h4><b class="no">05</b> 루멘 적중</h4><p><b style="font-size:4cqw;color:#d33a3a">'+hit+'/'+T+'</b><br>같은 문제 '+cnt.same+' · 숫자변형 '+cnt['var']+' · 유사유형 '+cnt.type+(mks.length?('<br>'+cnEsc(mks[0])+' '+mk[mks[0]].length+'문항'):'')+'</p></div>'
    +'<div class="pn"><h4><b class="no">06</b> 다음 시험 대비</h4><p>'+(c.strategy||[]).filter(function(x){ return String(x||'').trim(); }).slice(0,5).map(function(x,i){ return ['①','②','③','④','⑤'][i]+' '+cnEsc(x); }).join('<br>')+'</p></div>'
    +'</div><div class="pn" style="background:var(--cTag);color:var(--cTagInk);box-shadow:none"><b style="color:var(--cTagInk);opacity:.75;font-size:2cqw">이번 시험이 주는 메시지</b><div style="font-size:3cqw;font-weight:900;margin:.8cqw 0">'+cnEsc(c.message||'')+'</div><div style="font-size:2.2cqw;font-weight:900;text-align:right;letter-spacing:.1em">루멘수학</div></div>','', foot),
    '마지막으로 이번 시험을 한 장에 정리했습니다. 다음 시험도 같은 방식으로 분석하겠습니다.', ['핵심 키워드: '+kw.join(' · '), '메시지: '+(c.message||'')]);
  out.forEach(function(x){ x.html=x.html.split('§N§').join(String(out.length)); }); return out;
}
function cnPalVars(i){ var p=CN_PAL[i]||CN_PAL[1]; return '--c1:'+p.c1+';--c2:'+p.c2+';--c3:'+p.c3+';--cInk:'+p.ink+';--cSub:'+p.sub+';--cAcc:'+p.acc+';--cAcc2:'+p.acc2+';--cHand:'+p.hand+';--cFoot:'+p.foot+';--cBgm:'+p.bgm+';--cPanel:'+p.panel+';--cPanelLine:'+p.pline+';--cTag:'+p.tag+';--cTagInk:'+p.tagInk+';--cWm:'+p.wm; }
function cnCardsHtml(d){
  var c=cnCfg(d), cards=cnCards(d);
  return '<div class="cn-wrap'+(c.wm?'':' wmoff')+'" style="'+cnPalVars(c.pal)+'">'+cards.map(function(x,i){ return '<div style="min-width:0"><div class="ht-sub" style="font-weight:800;margin-bottom:4px">'+(i+1)+' · '+cnEsc(x.file)+'.png</div>'+x.html+'</div>'; }).join('')+'</div>';
}

/* ── CSS · 글꼴 (한 번만) ── */
function cnEnsureCss(){
  if(document.getElementById('cn-css')) return;
  var l=document.createElement('link'); l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Nanum+Pen+Script&display=swap'; document.head.appendChild(l);
  var st=document.createElement('style'); st.id='cn-css';
  st.textContent=''
  +'.cn-wrap{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px}'
  +'.cn{position:relative;width:100%;aspect-ratio:4/5;background:radial-gradient(120% 80% at 80% 0%,var(--c1) 0%,var(--c2) 38%,var(--c3) 100%);color:var(--cInk);border-radius:4px;overflow:hidden;padding:5.5% 6% 4.5%;box-sizing:border-box;display:flex;flex-direction:column;container-type:inline-size;word-break:keep-all;overflow-wrap:break-word;font-family:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}'
  +'.cn .bgm{position:absolute;inset:0;pointer-events:none;font-family:"Times New Roman",serif;font-style:italic;color:var(--cBgm);font-size:9cqw;line-height:1.25;padding:20% 0 0 30%;white-space:pre;transform:rotate(-8deg)}'
  +'.cn .wmk{position:absolute;inset:-30%;pointer-events:none;z-index:5;display:grid;grid-template-columns:repeat(3,1fr);align-content:space-around;transform:rotate(-28deg)}'
  +'.cn .wmk span{font-size:6.6cqw;font-weight:900;color:var(--cWm);white-space:nowrap;text-align:center;padding:5cqw 0;letter-spacing:.05em}'
  +'.wmoff .cn .wmk{display:none}'
  +'.cn .top{display:flex;align-items:flex-start;gap:2cqw;position:relative}'
  +'.cn .brand{font-weight:900;letter-spacing:.04em;font-size:5.2cqw;line-height:1.05}.cn .brand small{display:block;letter-spacing:.02em;font-size:1.9cqw;color:var(--cAcc);font-weight:700;margin-top:.8cqw}'
  +'.cn .pg{margin-left:auto;font-size:2.2cqw;color:var(--cSub);font-variant-numeric:tabular-nums;display:flex;gap:2cqw;align-items:center}.cn .pg i{font-style:normal;font-size:1.6cqw;color:var(--cFoot)}'
  +'.cn .eyebrow{margin-top:4.5cqw;font-size:2.6cqw;font-weight:700;color:var(--cSub);position:relative}'
  +'.cn .ttl{font-size:7.2cqw;font-weight:900;line-height:1.18;margin:1cqw 0 0;letter-spacing:-.02em;position:relative}.cn .ttl em{font-style:normal;color:var(--cAcc)}.cn .ttl em.r{color:var(--cAcc2)}'
  +'.cn .sub{font-size:2.4cqw;color:var(--cSub);line-height:1.6;margin-top:1.6cqw;max-width:70%;position:relative}'
  +'.cn .hand{position:absolute;right:6%;top:9%;font-family:"Nanum Pen Script",cursive;font-size:4cqw;color:var(--cHand);transform:rotate(-6deg);text-align:right;line-height:1.15}'
  +'.cn .body{flex:1;display:flex;flex-direction:column;gap:2cqw;margin-top:3.5cqw;position:relative;min-height:0}'
  +'.cn .pn{background:var(--cPanel);color:#1b2433;border-radius:1.4cqw;padding:2.6cqw 3cqw;min-width:0;border:1px solid var(--cPanelLine)}'
  +'.cn .pn h4{margin:0 0 1.4cqw;font-size:2.5cqw;display:flex;align-items:center;gap:1.4cqw}.cn .pn h4 b.no{background:var(--cTag);color:var(--cTagInk);font-size:2cqw;padding:.3cqw 1.2cqw;border-radius:.6cqw}'
  +'.cn .pn p{margin:0;font-size:2.1cqw;color:#64748b;line-height:1.6}'
  +'.cn .quote{margin-top:auto;padding-top:2.5cqw;text-align:center;font-size:2.7cqw;font-weight:900;position:relative}.cn .quote em{font-style:normal;color:var(--cAcc)}'
  +'.cn .foot{display:flex;justify-content:space-between;margin-top:2.2cqw;font-size:1.6cqw;color:var(--cFoot);letter-spacing:.08em;position:relative}'
  +'.cn .grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1.6cqw}.cn .grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.6cqw}'
  +'.cn .kv{display:grid;grid-template-columns:18cqw minmax(0,1fr);gap:1cqw 2cqw;font-size:2.3cqw;align-items:center}.cn .kv span{color:#64748b;font-size:2cqw}'
  +'.cn .dot{display:inline-block;width:1.6cqw;height:1.6cqw;border-radius:50%;margin-right:1cqw;vertical-align:middle}'
  +'.cn .bar{height:1.3cqw;background:#e3e9f2;border-radius:1cqw;overflow:hidden}.cn .bar i{display:block;height:100%}'
  +'.cn .tile{background:var(--cPanel);color:#1b2433;border-radius:1.4cqw;padding:2.4cqw;border:1px solid var(--cPanelLine)}.cn .tile b{display:block;font-size:7cqw;font-weight:900;line-height:1}.cn .tile span{font-size:2cqw;color:#64748b}'
  +'.cn table{width:100%;border-collapse:collapse;font-size:2cqw}.cn th{text-align:left;color:#1f5fbf;border-bottom:.3cqw solid #1f5fbf;padding:.8cqw 1cqw}.cn td{padding:.8cqw 1cqw;border-bottom:.15cqw solid #e3e9f2}'
  +'.cn .img2{display:grid;grid-template-columns:1fr 1fr;gap:1.6cqw;min-height:0}.cn .img2 figure{margin:0;background:#fff;border-radius:1cqw;padding:1.2cqw;display:flex;flex-direction:column;min-height:0;position:relative;overflow:hidden}'
  +'.cn .img2 figcaption{font-size:1.8cqw;font-weight:900;color:#1f5fbf;margin-bottom:.8cqw}.cn .img2 img{width:100%;flex:1;object-fit:contain;object-position:top;min-height:0}'
  +'.cn .img2 img.blur{filter:blur(.9cqw) saturate(.6)}.cn .img2 .bl{position:absolute;left:50%;top:55%;transform:translate(-50%,-50%);background:rgba(15,23,42,.78);color:#fff;font-size:1.7cqw;font-weight:900;padding:.8cqw 1.6cqw;border-radius:.8cqw;white-space:nowrap}'
  +'.cn-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}'
  +'.cn-pal button{border:2px solid #e2e8f0;background:#fff;border-radius:10px;padding:5px;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:800;text-align:left;display:grid;gap:4px;color:#0f172a}'
  +'.cn-pal button.on{border-color:#0d2240;box-shadow:0 0 0 2px #0d2240}.cn-pal i{display:block;height:28px;border-radius:6px;position:relative;overflow:hidden}'
  +'.cn-chip{padding:4px 9px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;color:#334155;min-width:34px}'
  +'.cn-chip.on{background:#b91c1c;border-color:#b91c1c;color:#fff}.cn-chip.on.b{background:#1d4ed8;border-color:#1d4ed8}'
  +'.cn-in{padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12.5px;font-family:inherit;width:100%;box-sizing:border-box}';
  document.head.appendChild(st);
}

/* ── 설정 칸 ── */
function cnPanelHtml(d){
  cnEnsureCss();
  var c=cnCfg(d), R=cnRows(d), hitR=R.filter(function(r){ return r.inB; });
  var chList=[]; R.forEach(function(r){ if(chList.indexOf(r.it.chapter)<0 && r.it.chapter) chList.push(r.it.chapter); });
  var h='<div class="ht-card" id="cn-panel" style="border:2px solid #0d2240"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:16px;font-weight:900;color:#0d2240;flex:1">📰 블로그 카드뉴스</div>'
    +'<span id="cn-saved" style="font-size:12px;font-weight:800;color:#15803d" aria-live="polite"></span><button class="ht-btn" onclick="cnSaveNow()" style="border-color:#15803d;color:#15803d">💾 저장</button>'
    +'<button class="ht-btn pri" onclick="cnExport()">'+(CN.busy?('⏳ '+htEsc(CN.busy)):'🖼 카드 그림 + 글 자료 내려받기 (.zip)')+'</button><button class="ht-btn" onclick="cnToggle()">닫기</button></div>'
    +'<div class="ht-sub" style="margin-bottom:10px">문항·색·난이도 칸을 고르면 <b>바로 저장</b>되고 아래 카드가 새로 그려집니다(「💾 저장」으로 한 번 더 저장할 수도 있어요). 내려받기를 누르면 지금 고른 대로 카드를 만듭니다. 블로그 세션에 zip 안의 그림과 「블로그자료.md」를 그대로 «파일 추가»하세요.</div>';
  h+='<div class="ht-h">🎨 색 (12가지)</div><div class="cn-pal">'+CN_PAL.map(function(p,i){ return '<button class="'+(i===c.pal?'on':'')+'" onclick="cnSet(\'pal\','+i+')"><i style="background:linear-gradient(135deg,'+p.c1+','+p.c3+');box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)"><b style="position:absolute;right:5px;bottom:5px;width:13px;height:13px;border-radius:50%;background:'+p.acc+'"></b></i>'+(i+1)+'. '+p.n+'</button>'; }).join('')+'</div>';
  h+='<div style="margin:10px 0">'+htSwitch(!!c.wm,'사선 워터마크 「루멘수학」 (다른 학원이 그대로 가져다 쓰지 못하게)','cnSet(\'wm\','+(!c.wm)+')','#b91c1c')+'</div>';
  /* v19-81: 난이도 칸 · 자료 이름 (원장 지시 2026-10-05) */
  var D=cnDiff(d), segB=function(on,label,js,dis){ return '<button class="cn-chip'+(on?' on b':'')+'"'+(dis?' disabled style="opacity:.45;cursor:not-allowed"':'')+' onclick="'+js+'">'+label+'</button>'; };
  h+='<div class="ht-h">📊 난이도 칸</div><div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px"><span class="ht-sub">기준</span>'
    +segB(D.src==='ms','기출 DB 난이도 1~9',"cnDiffSet('src','ms')",!D.hasMs)+segB(D.src==='mf','매쓰플랫 난도 1~5',"cnDiffSet('src','mf')")
    +'<span class="ht-sub" style="margin-left:8px">칸 개수</span>'+[2,3,4,5].map(function(k){ return segB(D.n===k,k+'칸',"cnDiffSet('n',"+k+")"); }).join('')+'</div>'
    +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:4px">'+D.names.map(function(nm,i){ if(i===0) return '<span class="ht-sub"><b style="color:'+D.cols[0]+'">●</b> '+htEsc(nm)+' 1~'+(D.cuts[0]-1)+'</span>'; return '<label class="ht-sub"><b style="color:'+D.cols[i]+'">●</b> '+htEsc(nm)+' <input type="number" min="1" max="'+D.max+'" value="'+D.cuts[i-1]+'" onchange="cnDiffSet(\'cut\',this.value,'+(i-1)+')" style="width:46px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:6px;font-family:inherit"> 이상</label>'; }).join('')+'</div>'
    +'<div class="ht-sub" style="margin-bottom:10px">'+(D.hasMs?'':'이 시험은 기출 DB 난이도가 없어 매쓰플랫 난도로 나눕니다. ')+'지금: '+htEsc(cnBandTxt(D))+'</div>';
  h+='<div class="ht-h">🏷 자료 이름 (카드에 나가는 이름)</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'
    +segB(c.matMode!=='split','교과서 / 루멘수학 시험대비자료',"cnSet('matMode','one')")+segB(c.matMode==='split','교과서 / 루멘수학 학습지 · 자체교재 · 대비자료 · 기출자료',"cnSet('matMode','split')")+'</div>';
  var Fp=cnFacts(d), iss=cnTrendIssues(d,Fp);
  h+='<div class="ht-h">📝 총평 · 요약 글</div><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'
    +segB(Fp.src==='auto','카드 숫자로 자동 (추천)',"cnSet('trendSrc','auto')")+segB(Fp.src==='edited','「출제 경향」 칸의 원장님 글',"cnSet('trendSrc','edited')",!Fp.hasEd)+'</div>'
    +'<div style="font-size:12px;line-height:1.7;background:#f8fafc;border-radius:8px;padding:8px 10px;margin-bottom:6px">'+htEsc(Fp.trend)+(Fp.killer?('<br><b>'+htEsc(Fp.killer)+'</b>'):'')+'</div>'
    +(iss.length?('<div style="font-size:11.5px;color:#b45309;font-weight:800;margin-bottom:10px">⚠ 위 「출제 경향」 칸 글의 숫자가 카드와 다릅니다: '+iss.map(htEsc).join(' · ')+(Fp.src==='edited'?'':' — 카드·블로그 자료에는 카드 숫자로 쓴 글이 나갑니다')+'</div>'):'<div style="margin-bottom:10px"></div>');
  if(c.changedAt&&(!c.exportedAt||c.changedAt>c.exportedAt)) h+='<div class="ht-strip" style="margin-bottom:10px">🔄 '+(c.exportedAt?'마지막으로 내려받은 뒤 고른 것이 바뀌었습니다':'아직 내려받지 않았습니다')+' — 「카드 그림 + 글 자료 내려받기」를 다시 눌러 새 zip 을 블로그 세션에 넘겨 주세요.</div>';
  h+='<div class="ht-h">🔥 킬러(변별) 문항 — 카드 2·4·총평에 나옵니다</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">'+R.map(function(r){ return '<button class="cn-chip'+(r.killer?' on':'')+'" title="'+htEsc(r.type)+' · 난도 '+r.level+'" onclick="cnToggleNo(\'killers\','+r.no+',6)">'+r.n+'<small style="opacity:.7"> ·'+r.level+'</small></button>'; }).join('')+'</div>';
  h+='<div class="ht-h">🎯 문항별 적중 카드 — 고른 문항마다 한 장 (최대 4)</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">'+(hitR.length?hitR.map(function(r){ var on=c.picks.indexOf(r.no)>=0; return '<button class="cn-chip b'+(on?' on':'')+'" title="'+htEsc(r.type)+'" onclick="cnToggleNo(\'picks\','+r.no+',4)">'+r.n+'번 <small style="opacity:.75">'+(CN_KN[r.kind]||'')+'</small></button>'; }).join(''):'<span class="ht-sub">적중 문항이 없습니다</span>')+'</div>';
  h+='<details style="margin-bottom:10px"><summary class="ht-h" style="cursor:pointer">✏️ 단원 이름 고치기 (매쓰플랫이 잘못 붙인 문항)</summary><datalist id="cn-ch">'+chList.map(function(x){ return '<option value="'+htEsc(x)+'">'; }).join('')+'</datalist><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:6px;margin-top:6px">'
    +R.map(function(r){ return '<label class="ht-sub" style="display:grid;grid-template-columns:34px minmax(0,1fr);gap:6px;align-items:center"><b>'+r.n+'번</b><input class="cn-in" list="cn-ch" value="'+htEsc(c.unit[r.no]||'')+'" placeholder="'+htEsc(r.it.chapter||'')+'" onchange="cnUnit('+r.no+',this.value)"></label>'; }).join('')+'</div></details>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-bottom:12px">'
    +'<div><div class="ht-h">핵심 키워드 (총평 · 비우면 자동)</div>'+[0,1,2,3].map(function(i){ return '<input class="cn-in" style="margin-bottom:4px" value="'+htEsc((c.keywords||[])[i]||'')+'" placeholder="키워드 '+(i+1)+'" onchange="cnText(\'keywords\','+i+',this.value)">'; }).join('')+'</div>'
    +'<div><div class="ht-h">다음 시험 대비 (총평)</div>'+[0,1,2,3,4].map(function(i){ return '<input class="cn-in" style="margin-bottom:4px" value="'+htEsc((c.strategy||[])[i]||'')+'" onchange="cnText(\'strategy\','+i+',this.value)">'; }).join('')+'</div>'
    +'<div><div class="ht-h">메시지 (총평 맨 아래)</div><textarea class="cn-in" rows="3" onchange="cnText(\'message\',null,this.value)">'+htEsc(c.message||'')+'</textarea><div class="ht-sub" style="margin-top:6px">출제 경향 · 킬러 설명은 위 「출제 경향」 칸에서 고칩니다.</div></div></div>';
  h+='<div id="cn-cards">'+cnCardsHtml(d)+'</div>';
  setTimeout(cnSaveMark,0);
  return h+'</div>';
}

/* ── 내려받기: 카드 PNG(1080×1350) + 블로그자료.md → zip ── */
function cnToDataUrl(url){
  return fetch(url, { mode:'cors' }).then(function(r){ if(!r.ok) throw new Error('그림 '+r.status); return r.blob(); }).then(function(b){ return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ res(fr.result); }; fr.readAsDataURL(b); }); });
}
/* html2canvas 는 CSS 흐림을 못 그려서, 시험 그림은 미리 모자이크로 흐리게 만든다 */
function cnMosaic(dataUrl){
  return new Promise(function(res){ var im=new Image(); im.onload=function(){ var W=im.naturalWidth, H=im.naturalHeight, f=14, sw=Math.max(8,Math.round(W/f)), sh=Math.max(8,Math.round(H/f));
    var a=document.createElement('canvas'); a.width=sw; a.height=sh; var g=a.getContext('2d'); g.drawImage(im,0,0,sw,sh);
    var b=document.createElement('canvas'); b.width=W; b.height=H; var g2=b.getContext('2d'); g2.imageSmoothingEnabled=true; g2.drawImage(a,0,0,W,H); res(b.toDataURL('image/png')); };
    im.onerror=function(){ res(dataUrl); }; im.src=dataUrl; });
}
function cnMd(d, cards){
  var e=d.exam||{}, L=[];
  L.push('# 블로그 자료 — '+e.school+' '+e.grade+' '+e.year+'년 '+e.semester+'학기 '+e.term+'고사 수학 분석');
  L.push('');
  L.push('> **블로그 작성 세션에게**');
  L.push('> - 같이 넣은 그림 '+cards.length+'장을 아래 «카드» 순서대로 글 사이에 넣는다. 카드 위에 «문단 초안»을 자연스럽게 다듬어 쓴다.');
  L.push('> - 톤: 루멘수학 기존 블로그처럼 데이터 기반이되 딱딱하지 않게, 짧은 문단 · 굵은 강조.');
  L.push('> - 숫자는 이 파일 것만. 학생 이름 · 교재 이름 · 쪽 번호 · 시험 문제 원문은 쓰지 않는다(자료 이름은 «교과서» · «루멘수학 …»처럼 카드에 적힌 그대로).');
  L.push('> - 마지막은 «루멘수학»으로 끝낸다. 전화번호는 넣지 않는다.');
  L.push('');
  L.push('## 제목 후보');
  var hit=htVisible(d).filter(function(it){ return htInBasis(htEff(it).kind, d.basis||'same+var'); }).length, T=htVisible(d).length;
  L.push('- ['+e.school+' '+String(e.grade||'').replace(/^중/,'')+'학년] '+e.year+' '+e.semester+'학기 '+e.term+'고사 수학 분석 — '+T+'문항 중 '+hit+'문항, 루멘에서 미리 풀었습니다');
  L.push('- '+e.school+' '+e.term+'고사 수학, 어디서 나왔을까? 문항별 적중 분석');
  L.push('- 기출은 반복된다 — '+e.school+' '+e.year+' '+e.semester+'학기 '+e.term+' 시험 총정리');
  L.push('');
  var F=cnFacts(d);
  L.push('## 이번 시험 숫자 — 글의 숫자는 이것만 쓴다 (카드와 같음)');
  L.push('- 총 '+F.T+'문항 · 서술형 '+F.essay.length+'문항'+(F.essay.length?(' ('+cnNums(F.essay)+')'):''));
  L.push('- 난이도('+(F.D.src==='ms'?'기출 DB 난이도 1~9':'매쓰플랫 난도 1~5')+' · '+cnBandTxt(F.D)+'): '+F.bandSum+(F.hard.length?(' — 어려움 '+cnNums(F.hard)):''));
  L.push('- 변별 문항(원장님이 고름): '+(F.K.length?F.K.map(function(r){ return r.n+'번 '+r.type; }).join(' · '):'없음'));
  L.push('- 적중: '+F.hit+'/'+F.T+' («'+F.basisLbl+'» 기준)');
  L.push('');
  L.push('## 출제 경향 '+(F.src==='edited'?'(원장님이 고친 글)':'(카드 숫자로 쓴 글)'));
  L.push(F.trend); if(F.killer){ L.push(''); L.push('**변별 문항**: '+F.killer); }
  if(F.src==='edited'&&cnTrendIssues(d,F).length) L.push('', '> ⚠ 이 글의 숫자가 위 «이번 시험 숫자»와 다르면 «이번 시험 숫자»를 따른다.');
  L.push('');
  cards.forEach(function(x,i){ L.push('## 카드 '+String(i+1).padStart(2,'0')+' (그림: '+x.file+'.png)'); L.push('- 문단 초안: '+x.para); (x.facts||[]).forEach(function(f){ L.push('- 숫자: '+f); }); L.push(''); });
  L.push('---'); L.push('자료 생성: 루멘수학 학원앱 「적중 분석 · 카드뉴스」 · '+new Date().toISOString().slice(0,10));
  return L.join('\n');
}
window.cnExport = async function(){
  var d=HT.data[HT.cur]; if(!d||CN.busy) return;
  var c=cnCfg(d);
  try{
    CN.busy='준비 중'; render();
    if(typeof html2canvas==='undefined') await _mrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if(typeof JSZip==='undefined') await _mrLoadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
    var cards=cnCards(d), zip=new JSZip();
    /* 학원앱은 노트북 화면에서 body 를 줌으로 줄인다(0.72~0.9) — html2canvas 가 줌을 몰라 카드가 커지고 잘렸다.
       → 줌·학원앱 CSS 가 닿지 않는 따로 된 틀(iframe, html 바로 아래)에서 1080px 로 그린다 */
    var fr=document.createElement('iframe'); fr.setAttribute('aria-hidden','true');
    fr.style.cssText='position:fixed;left:-20000px;top:0;width:1080px;height:1350px;border:0;zoom:1';
    document.documentElement.appendChild(fr);
    var css=(document.getElementById('cn-css')||{}).textContent||'';
    var fd=fr.contentDocument; fd.open();
    fd.write('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Nanum+Pen+Script&display=swap"><style>html,body{margin:0;padding:0;background:transparent}'+css+'</style></head><body><div id="h" class="cn-wrap'+(c.wm?'':' wmoff')+'" style="display:block;width:1080px;'+cnPalVars(c.pal)+'"></div></body></html>');
    fd.close();
    await new Promise(function(r){ if(fd.readyState==='complete') r(); else fr.onload=function(){ r(); }; setTimeout(r,4000); });
    try{ if(fd.fonts&&fd.fonts.ready) await fd.fonts.ready; }catch(e){}
    var host=fd.getElementById('h');
    for(var i=0;i<cards.length;i++){
      CN.busy='카드 '+(i+1)+'/'+cards.length; var b=document.querySelector('#cn-panel .ht-btn.pri'); if(b) b.textContent='⏳ '+CN.busy;
      host.innerHTML=cards[i].html;
      var imgs=host.querySelectorAll('img');
      for(var j=0;j<imgs.length;j++){ var im=imgs[j]; try{ var du=await cnToDataUrl(im.getAttribute('src')); if(im.getAttribute('data-blur')){ du=await cnMosaic(du); im.classList.remove('blur'); } im.src=du; await new Promise(function(r){ if(im.complete) r(); else { im.onload=r; im.onerror=r; } }); }catch(e){ im.removeAttribute('src'); } }
      try{ if(fd.fonts&&fd.fonts.ready) await fd.fonts.ready; }catch(e){}
      await new Promise(function(r){ setTimeout(r,60); });
      var cv=await html2canvas(host.firstChild, { scale:1, useCORS:true, backgroundColor:null, logging:false, width:1080, height:1350, windowWidth:1080, windowHeight:1350 });
      var blob=await new Promise(function(r){ cv.toBlob(r,'image/png'); });
      zip.file(cards[i].file+'.png', blob);
    }
    fr.remove();
    zip.file('블로그자료.md', cnMd(d, cards));
    CN.busy='묶는 중';
    var z=await zip.generateAsync({ type:'blob' }), e=d.exam||{};
    var a=document.createElement('a'); a.href=URL.createObjectURL(z); a.download='카드뉴스_'+e.school+'_'+e.grade+'_'+e.year+'_'+e.semester+'학기'+e.term+'.zip'; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
    c.exportedAt=new Date().toISOString(); cnSave(d, true);
    CN.busy=''; htToast('🖼 카드 '+cards.length+'장 + 블로그자료.md 를 내려받았습니다'); render();
  }catch(err){ CN.busy=''; render(); htToast('카드 만들기 실패: '+(err&&err.message||err)); }
};
