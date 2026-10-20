/* ═══════════════════════════════════════════════════════════════════
 * v19-81: 📋 플래너 점수 기준표 = 실제 채점 (원장 결정 2026-10-05)
 *  · 매일 10 = 제출 4 · 타임테이블 2 · 실천 1 · 구체적 1 · 자기 피드백 2 (A안, 10/1부터 소급)
 *    자기 피드백 2 = 원인 + 내일 바꿀 구체적 행동 / 1 = 돌아보기만 / 0 = 없음·한 단어
 *  · 기준은 lumen_store «planner_rules» 한 곳 — 학원앱 채점 · 새벽 채점기(sync/planner_night_grader.js) · 학생앱 안내가 같이 읽는다
 *    { list:[{ from:'YYYY-MM-DD', sub2, sub1, late, ttH, ttL, prHi, prHiPts, prLo, prLoPts, spec, fbMax }], upd }
 *    날짜마다 «그 날짜 이전에 시작한 가장 늦은 기준»을 쓴다 → 지난 점수는 바뀌지 않는다
 *  · 주간 «계획 실천»: 수학 할 일은 그날 매쓰플랫 채점이나 아하노트 기록이 있어야 실천으로 센다 (plweek_ev)
 *  · 플래너 입력 표: 일요일마다 «주간» 칸 · 합계 = 매일 + 주간
 *  · 플래너 왼쪽 탭: 📅 주간 점수 · 📔 순공피드백 · 🧭 스터디 코디
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var PLR = { DEF: { from:'2026-10-01', sub2:4, sub1:2, late:1, ttH:5, ttL:1, prHi:50, prHiPts:1, prLo:20, prLoPts:0, spec:1, fbMax:2 },
  rules:null, loaded:false, loading:false, draft:null, busy:'', msg:'', ev:{ at:0, running:false } };
(function(){ try{ var c=JSON.parse(localStorage.getItem('planner_rules_cache')||'null'); if(c&&c.list&&c.list.length) PLR.rules=c.list; }catch(e){} })();

function plrKey(d){ var m=String(d||'').match(/(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})/); return m?(m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2)):''; }
function plrList(){ var a=(PLR.rules&&PLR.rules.length)?PLR.rules.slice():[PLR.DEF]; return a.sort(function(x,y){ return x.from<y.from?-1:(x.from>y.from?1:0); }); }
window.plRulesFor=function(d){ var k=plrKey(d); if(!k||k<PLR.DEF.from) return null; var r=null; plrList().forEach(function(x){ if(x.from<=k) r=x; }); return Object.assign({}, PLR.DEF, r||{}); };
window.plRulesMax=function(r){ r=r||PLR.DEF; return (+r.sub2)+2+Math.max(+r.prHiPts||0,+r.prLoPts||0)+(+r.spec)+(+r.fbMax); };
window.plLatePts=function(d){ var r=plRulesFor(d); return r?(+r.late):1; };
window.plSubPts=function(d, n){ var r=plRulesFor(d); if(!r) return null; return n>=2?(+r.sub2):(n===1?(+r.sub1):0); };
window.plFbPts=function(level, r){ level=+level||0; var mx=r?(+r.fbMax):1; if(mx<=0) return 0; return level>=2?mx:(level===1?Math.min(1,mx):0); };

window.plrLoad=function(){
  if(PLR.loading) return; PLR.loading=true;
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb){ PLR.loading=false; PLR.loaded=true; return; }
  sb.from('lumen_store').select('value').eq('key','planner_rules').then(function(r){
    var v=r&&r.data&&r.data[0]?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    if(v&&v.list&&v.list.length){ PLR.rules=v.list; PLR.meta=v; try{ localStorage.setItem('planner_rules_cache', JSON.stringify({ list:v.list })); }catch(e){} }
    PLR.loaded=true; PLR.loading=false; if(VIEW==='planner') render();
  }).catch(function(){ PLR.loaded=true; PLR.loading=false; });
};
async function plrSave(list, extra){
  var sb=getSupaClient(); var v=Object.assign({ list:list, upd:new Date().toISOString(), by:'app' }, PLR.meta&&PLR.meta.recalc?{ recalc:PLR.meta.recalc }:{}, extra||{});
  var w=await sb.from('lumen_store').upsert({ key:'planner_rules', value:v, updated_at:new Date().toISOString() }, { onConflict:'key' });
  if(w&&w.error) throw new Error(w.error.message||w.error);
  PLR.rules=list; PLR.meta=v; try{ localStorage.setItem('planner_rules_cache', JSON.stringify({ list:list })); }catch(e){}
}
setTimeout(function(){ try{ plrLoad(); }catch(e){} }, 1500);

/* ── ① AI 프롬프트: 자기 피드백 0~2 (기존 plV3PromptEdit 위에 덧씌운다) ── */
var PLR_FB_RULE=[
  '④ 자기 피드백 (fbLevel 0~2) — 피드백 칸(잘한점·부족한점·개선할점 등)을 feedbackTranscript 로 옮긴 뒤 아래 기준으로 매기세요',
  '  - fbLevel 2: «왜 그렇게 됐는지(원인)»와 «내일 무엇을 어떻게 바꿀지(구체적 행동 — 시각·분량·방법 중 하나 이상)»가 둘 다 문장으로 있음',
  '      예) "저녁에 폰을 봐서 수학을 2쪽밖에 못 했다. 내일은 학원 가기 전 4시에 쎈 3쪽부터 푼다"',
  '  - fbLevel 1: 돌아본 문장이 2개 이상 있지만 원인이나 구체적 행동이 빠짐',
  '      예) "열심히 했다 / 집중이 잘 안 됐다 / 내일은 더 열심히"',
  '  - fbLevel 0: 피드백이 없거나, 한 문장뿐이거나, 한 단어·기호뿐 (이때 flagLowEffort=true)',
  '  - 「잘한점·부족한점·개선할점」 이름표가 없어도 내용이 기준을 채우면 인정합니다',
  '  - 판독이 안 되면 fbLevel=0 이고 unreadableItems 에 "feedbackScore" 를 넣으세요',
  ''];
(function(){
  var orig=window.plV3PromptEdit; if(typeof orig!=='function') return;
  window.plV3PromptEdit=function(lines, expectedDate){
    var out=orig(lines, expectedDate);
    if(!(typeof plV2==='function'&&plV2(expectedDate))) return out;
    var res=[], skip=false;
    out.forEach(function(L){ L=String(L);
      if(L.indexOf('④ feedbackScore')===0){ skip=true; PLR_FB_RULE.forEach(function(x){ res.push(x); }); return; }
      if(skip && L.indexOf('━━━')===0) skip=false;
      if(skip) return;
      if(L.indexOf('  - practiceRate 를 정확히 적으세요')===0){ res.push('  - practiceRate 를 정확히 적으세요 (점수는 코드가 매깁니다). practiceScore 는 "0" 으로 두세요'); return; }
      if(L.indexOf('  "feedbackScore":')===0){ res.push('  "fbLevel": 0 또는 1 또는 2,'); res.push('  "feedbackScore": "fbLevel 과 같은 숫자",'); return; }
      if(L.indexOf('- flagLowEffort:')===0){ res.push('- flagLowEffort: 자기 피드백이 한 단어·기호뿐(예: "ㅇ", "-", "굿")이거나 성의 없는 표시면 true'); return; }
      res.push(L);
    });
    return res;
  };
})();

/* ── ② AI가 읽은 숫자 + 기준표로 점수 매기기 (10월판 plV3Apply 를 바꾼다) ──
 *   AI 원래 값은 남긴다: specAi(구체 0/1) · fbLevel(피드백 0~2). fbLevel 이 없는 옛 분석은 fbNeed=true (다시 계산 때 글로 매김) */
window.plV3Apply=function(a, expectedDate){
  if(!a) return a;
  var dk=plDateKey(a.date)||plDateKey(expectedDate); if(!dk||dk<PW.START) return a;
  var r=plRulesFor(dk)||PLR.DEF, ur=Array.isArray(a.unreadableItems)?a.unreadableItems:[];
  var filled=Number(a.ttFilled)||0, life=Number(a.ttLife)||0;
  var tt=(filled>=(+r.ttH)?1:0)+(filled>0&&life>=(+r.ttL)?1:0);
  var rate=parseInt(String(a.practiceRate||'').replace(/[^\d]/g,''),10)||0;
  var pr=rate>=(+r.prHi)?(+r.prHiPts):(rate>=(+r.prLo)?(+r.prLoPts):0); if(ur.indexOf('practiceScore')>=0) pr=0;
  if(a.specAi==null){ var sp0=a.zeroDay&&a.zeroBak?a.zeroBak.sp:a.specificScore; a.specAi=(+sp0>=1)?1:0; }
  var spec=(+a.specAi>=1)?(+r.spec):0;
  var fb;
  if(a.fbLevel!=null&&a.fbLevel!==''){ a.fbLevel=Math.max(0,Math.min(2,parseInt(a.fbLevel,10)||0)); fb=plFbPts(a.fbLevel,r); delete a.fbNeed; }
  else { var f0=a.zeroDay&&a.zeroBak?a.zeroBak.f:a.feedbackScore; fb=Math.min(+f0||0,+r.fbMax); a.fbNeed=true; }
  if(ur.indexOf('feedbackScore')>=0) fb=0;
  if(a.zeroDay&&a.zeroBak){ a.zeroBak.s=String(tt); a.zeroBak.p=String(pr); a.zeroBak.sp=String(spec); a.zeroBak.f=String(fb); }
  else { a.studyScore=String(tt); a.practiceScore=String(pr); a.specificScore=String(spec); a.feedbackScore=String(fb); }
  a.v3={ tt:tt, filled:filled, life:life, rate:rate, minH:+r.ttH, minL:+r.ttL, rules:r.from };
  a.promptVersion='v3.0';
  return a;
};

/* ── ③ 새 기준으로 다시 계산 (원장님이 누름) ── */
async function plrFbGrade(items){   /* items=[{i, text}] → {i: level} — 원장 기기의 Claude 열쇠, 글만. v19-82: 10개씩 · 빠진 것은 3개씩 한 번 더 */
  var out=await plrFbGrade1(items, 10), miss=items.filter(function(x){ return out[x.i]==null; });
  if(miss.length){ var o2=await plrFbGrade1(miss, 3); Object.keys(o2).forEach(function(k){ out[k]=o2[k]; }); }
  return out;
}
async function plrFbGrade1(items, size){
  var key=''; try{ key=localStorage.getItem('or_api_key')||''; }catch(e){}
  if(!key) throw new Error('Claude 열쇠가 없어 피드백 글을 다시 매기지 못했습니다 (왼쪽 위 Claude 등록)');
  var out={};
  for(var s=0;s<items.length;s+=size){
    var chunk=items.slice(s,s+size);
    var prompt=['학생 플래너의 «자기 피드백» 글을 아래 기준으로 0·1·2 중 하나로 매기세요.'].concat(PLR_FB_RULE.slice(1,7)).concat(['',
      '글 목록 (번호: 글):']).concat(chunk.map(function(x){ return x.i+': '+String(x.text).replace(/\s+/g,' ').slice(0,600); })).concat(['',
      'JSON 하나만 출력하세요. 예: {"12": 2, "13": 0}']).join('\n');
    var models=['claude-sonnet-5-5','claude-sonnet-4-6'], txt='', lastErr=null;
    for(var m=0;m<models.length&&!txt;m++){
      try{
        var resp=await fetch('https://api.anthropic.com/v1/messages',{ method:'POST', headers:{ 'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
          body:JSON.stringify({ model:models[m], max_tokens:800, temperature:0, messages:[{ role:'user', content:prompt }] }) });
        if(!resp.ok){ lastErr=new Error('AI '+resp.status); continue; }
        var j=await resp.json(); txt=(j.content||[]).map(function(c){ return c.text||''; }).join('');
      }catch(e){ lastErr=e; }
    }
    if(!txt){ console.warn('[피드백 다시 매기기]', lastErr); continue; }   /* 이 묶음만 건너뛰고 다음 묶음 — 빠진 것은 다시 시도 */
    var mm=txt.match(/\{[\s\S]*\}/); var obj={}; try{ obj=JSON.parse(mm?mm[0]:'{}'); }catch(e){}
    Object.keys(obj).forEach(function(k){ var kk=String(k).replace(/[^\d]/g,''); if(kk) out[kk]=Math.max(0,Math.min(2,parseInt(obj[k],10)||0)); });
    PLR.busy='피드백 글 매기는 중 '+Math.min(items.length,s+size)+'/'+items.length; plrPaint();
  }
  return out;
}
function plrPaint(){ var el=document.getElementById('plr-busy'); if(el) el.textContent=PLR.busy||''; }
window.plrRecalc=async function(from){
  if(PLR.busy) return; from=plrKey(from)||PLR.DEF.from;
  var sets=[];
  (students||[]).forEach(function(st){ (st.lumen_planner_photos||[]).forEach(function(p){ var a=p&&p.analysis; if(!a) return; var dk=plDateKey(a.date)||''; if(!dk||dk<from) return; sets.push({ st:st, p:p, a:a, dk:dk }); }); });
  if(!sets.length){ alert(from+' 이후 플래너 분석이 없습니다.'); return; }
  var need=sets.filter(function(x){ return x.a.fbLevel==null&&!x.a.editedAt; });
  var gradeQ=[], idx=0;
  need.forEach(function(x){ var t=String(x.a.feedbackTranscript||'').replace(/판독불가/g,'').trim(); x.qi=null; if(t.replace(/[\s\/:·\-]/g,'').length<4){ x.a.fbLevel=0; return; } x.qi=++idx; gradeQ.push({ i:x.qi, text:x.a.feedbackTranscript }); });
  if(!confirm(from+' 이후 플래너 '+sets.length+'세트를 지금 기준표로 다시 계산합니다.\n\n· 실천·타임테이블·구체적·제출 점수는 기준표대로 바로 바뀝니다\n· 자기 피드백은 '+gradeQ.length+'세트의 피드백 글을 AI(원장님 Claude 열쇠)가 새 기준(0~2)으로 다시 매깁니다\n· 원장님이 손으로 고친 세트와 손 점수는 그대로 둡니다\n· 승인된 세트는 점수판·학생앱·랭킹에 다시 올라갑니다')) return;
  PLR.busy='시작'; render();
  try{
    var fbMiss=0; if(gradeQ.length){ var lv=await plrFbGrade(gradeQ); need.forEach(function(x){ if(x.qi==null) return; if(lv[x.qi]!=null) x.a.fbLevel=lv[x.qi]; else fbMiss++; }); }
    var nowIso=new Date().toISOString();
    var changed={}, nSet=0, nKept=0;
    sets.forEach(function(x){
      var a=x.a, p=x.p, st=x.st;
      if(a.editedAt){ var r=plRulesFor(x.dk)||PLR.DEF; var maxP=Math.max(+r.prHiPts||0,+r.prLoPts||0); if(+a.practiceScore>maxP) a.practiceScore=String(maxP); nKept++; }
      else plV3Apply(a, x.dk);
      a.upd=nowIso;   /* v19-82: 여러 기기가 섞여도 «더 최근에 고친 쪽»이 이긴다 */
      try{ a.plannerScore=String(calcPlannerScoreByPlannerDate(a.date, p.setId, plFileCount(p), a.dateNext)); }catch(e){}
      if(!p.reviewed) return;
      var total=plUseManual(p, (+a.plannerScore||0)+(+a.studyScore||0)+(+a.practiceScore||0)+(+a.specificScore||0)+(+a.feedbackScore||0));
      var key=String(a.date||'').replace(/-/g,'.'); var old=(st.lumen_planner||{})[key];
      if(plSetScore(st, key, total, '새 기준 다시 계산')){ if(old!==total){ changed[st.id]=st; nSet++; } }
    });
    saveStudents();
    var list=Object.keys(changed).map(function(k){ return changed[k]; });
    for(var i=0;i<list.length;i++){ PLR.busy='학생앱에 다시 올리는 중 '+(i+1)+'/'+list.length; plrPaint(); try{ await publishPlannerDataForStudent(list[i]); }catch(e){} }
    try{ await plwRepublish(); }catch(e){}
    try{ await plrSave(plrList(), { recalc:{ from:from, at:new Date().toISOString(), sets:sets.length, changed:nSet, fbMiss:fbMiss } }); }catch(e){}
    PLR.busy=''; render();
    alert('✅ 다시 계산 끝\n'+sets.length+'세트 · 점수가 바뀐 날 '+nSet+'칸 · 학생 '+list.length+'명 학생앱 반영'+(fbMiss?('\n⚠ 피드백 글 '+fbMiss+'세트는 AI 응답이 없어 예전 점수로 두었습니다 — 한 번 더 누르면 그것만 다시 매깁니다'):'')+(nKept?('\n(원장님이 손으로 고친 '+nKept+'세트는 실천만 새 최대점으로 맞추고 나머지는 그대로)'):''));
  }catch(e){ PLR.busy=''; render(); alert('다시 계산 실패: '+(e.message||e)); }
};

/* ── ④ 오른쪽 점수 기준표 (편집 → 저장 → 실제 채점) ── */
window.plrSet=function(k, v){ if(!PLR.draft) return; PLR.draft[k]=(k==='from')?String(v):Math.max(0,Math.min(100,parseInt(v,10)||0)); render(); };
window.plrPick=function(from){ var x=plrList().filter(function(r){ return r.from===from; })[0]; if(x) PLR.draft=Object.assign({}, PLR.DEF, x); render(); };
window.plrSaveDraft=async function(){
  var D=PLR.draft; if(!D) return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(D.from)||D.from<PLR.DEF.from){ alert('적용 시작일은 '+PLR.DEF.from+' 이후 날짜로 적어 주세요.'); return; }
  var mx=plRulesMax(D); if(mx!==10&&!confirm('하루 최대가 '+mx+'점입니다 (10점이 아님). 그대로 저장할까요?')) return;
  var list=plrList().filter(function(x){ return x.from!==D.from; }); var nv={}; Object.keys(PLR.DEF).forEach(function(k){ nv[k]=D[k]; }); nv.at=new Date().toISOString(); list.push(nv);
  try{ await plrSave(list); }catch(e){ alert('저장 실패: '+(e.message||e)); return; }
  render();
  if(confirm('💾 저장했습니다 — '+D.from+'부터 이 기준으로 채점합니다.\n\n이미 매긴 '+D.from+' 이후 플래너도 새 기준으로 다시 계산할까요?')) plrRecalc(D.from);
};
function plrPanelHtml(){
  if(!PLR.loaded&&!PLR.loading) plrLoad();
  var cur=plRulesFor(PW.day())||PLR.DEF;
  if(!PLR.draft) PLR.draft=Object.assign({}, cur);
  var D=PLR.draft, mx=plRulesMax(D), list=plrList();
  var inp=function(k){ return '<input type="number" min="0" max="100" value="'+D[k]+'" onchange="plrSet(\''+k+'\',this.value)" style="width:40px;border:1px solid #cbd5e1;border-radius:6px;padding:2px 4px;font-size:12px;font-weight:900;color:#1d6fe8;font-family:inherit;text-align:center">'; };
  var box=function(t, body, pts){ return '<div style="background:#fff;border:1.5px solid #e8edf5;border-radius:10px;padding:8px;margin-bottom:6px"><div style="display:flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;color:#0d2240;margin-bottom:4px">'+t+'<span style="margin-left:auto;font-size:10px;color:#64748b;font-weight:700">'+pts+'</span></div><div style="font-size:10.5px;color:#475569;line-height:1.9">'+body+'</div></div>'; };
  var h='<div style="width:250px;flex-shrink:0;border-left:2px solid #e8edf5;padding:14px;background:#fafbfd;overflow-y:auto">';
  h+='<div style="font-size:12px;font-weight:900;color:#0d2240;margin-bottom:2px">📋 점수 기준 <span style="font-size:10px;color:#059669">· 실제 채점에 쓰임</span></div>';
  h+='<div style="font-size:10px;color:#64748b;margin-bottom:8px">학원앱 채점·새벽 채점·학생앱 안내가 이 표를 같이 씁니다</div>';
  if(list.length>1) h+='<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">'+list.map(function(r){ var on=r.from===D.from; return '<button onclick="plrPick(\''+r.from+'\')" style="border:1px solid '+(on?'#1d6fe8':'#cbd5e1')+';background:'+(on?'#eff6ff':'#fff')+';color:#0d2240;border-radius:999px;padding:2px 8px;font-size:10.5px;font-weight:800;cursor:pointer;font-family:inherit">'+r.from.slice(5).replace('-','/')+'부터'+(r.from===cur.from?' · 지금':'')+'</button>'; }).join('')+'</div>';
  h+='<div style="font-size:11px;font-weight:900;color:#0d2240;margin:4px 0 6px">📒 매일 <span style="color:'+(mx===10?'#059669':'#b91c1c')+'">'+mx+'점</span></div>';
  h+=box('① 제출','2장 '+inp('sub2')+' · 1장 '+inp('sub1')+'<br>지각 '+inp('late'),'최대 '+D.sub2);
  h+=box('② 타임테이블','6~23시 '+inp('ttH')+'칸 이상 칠함 +1<br>생활(학교·밥·잠) '+inp('ttL')+'개 이상 +1','최대 2');
  h+=box('③ 실천 (O·△ 비율)',inp('prHi')+'% 이상 '+inp('prHiPts')+'점<br>'+inp('prLo')+'% 이상 '+inp('prLoPts')+'점','최대 '+Math.max(D.prHiPts,D.prLoPts));
  h+=box('④ 구체적 계획','「쎈 42~45쪽」처럼 '+inp('spec')+'점','최대 '+D.spec);
  h+=box('⑤ 자기 피드백','원인 + 내일 바꿀 행동 = 최대 '+inp('fbMax')+'<br>돌아보기만 = 1 · 없음·한 단어 = 0','최대 '+D.fbMax);
  h+='<label style="display:block;font-size:10.5px;font-weight:800;color:#475569;margin:8px 0 4px">적용 시작일 <input type="date" value="'+D.from+'" onchange="plrSet(\'from\',this.value)" style="font-size:11px;padding:2px 4px;border:1px solid #cbd5e1;border-radius:6px;font-family:inherit"></label>';
  h+='<button onclick="plrSaveDraft()" style="width:100%;padding:7px;background:#0d2240;color:#fff;border:none;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:5px">💾 저장 ('+D.from.slice(5).replace('-','/')+'부터)</button>';
  h+='<button onclick="plrRecalc(\''+D.from+'\')" style="width:100%;padding:7px;background:#eff6ff;color:#1d4ed8;border:1.5px solid #bfdbfe;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit">🔁 '+D.from.slice(5).replace('-','/')+' 이후 다시 계산</button>';
  h+='<div id="plr-busy" style="font-size:10.5px;color:#b45309;font-weight:800;margin-top:4px">'+htEscSafe(PLR.busy)+'</div>';
  var rc=PLR.meta&&PLR.meta.recalc; if(rc) h+='<div style="font-size:10px;color:#94a3b8;margin-top:2px">마지막 다시 계산: '+String(rc.at||'').slice(5,16).replace('T',' ')+' · '+rc.sets+'세트</div>';
  h+='<div style="font-size:11px;font-weight:900;color:#0d2240;margin:12px 0 6px">📅 주간 '+PW.MAX.total+'점 = 주간계획 '+PW.MAX.wp+' + 순공 '+PW.MAX.sg+' <span style="font-size:10px;color:#64748b;font-weight:700">(일요일 밤 발표)</span></div>';
  h+='<div style="background:#fff;border:1.5px solid #e8edf5;border-radius:10px;padding:8px;font-size:10.5px;color:#475569;line-height:1.85"><b style="color:#1d4ed8">📅 주간계획 '+PW.MAX.wp+'</b><br>다음 주 계획 제출 '+PW.PT.plan.ok+' · 지각 '+PW.PT.plan.late+'<br>계획 실천 70%↑ 5 · 40%↑ 3 · 하나라도 1<br><b style="color:#b45309">└ 수학 할 일은 그날 매쓰플랫 채점·아하노트 기록이 있어야 인정</b><br><b style="color:#7c3aed">📔 순공피드백 '+PW.MAX.sg+'</b><br>사진 일요일까지 '+PW.PT.photo.ok+' · 월요일 '+PW.PT.photo.late+'<br>종이(학원) 첫 수업까지 '+PW.PT.paper.ok+' · 그 주 안 '+PW.PT.paper.late+'</div>';
  return h+'</div>';
}
function htEscSafe(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── ⑤ 주간 «계획 실천» 증거 확인 (원장 결정 2026-10-05) ──
 *   수학 할 일(코디가 넣은 칸 · 과목 수학 · 과목이 비면 수학 교재 낱말)이 O 로 확인돼도
 *   그날(다음날 새벽 3시 전까지 포함) 매쓰플랫 채점 기록이나 아하노트가 없으면 실천으로 세지 않는다.
 *   결과 = lumen_store plweek_ev { byCode:{ 코드:{ 월요일:{ 할일id:0 } } }, upd } — 학원앱·학생앱의 PW 가 같이 읽는다
 *   오늘 할 일은 아직 기록이 안 모였을 수 있어 어제까지만 본다. */
function plrIsMath(it){ var s=String(it.subj||''), t=String(it.title||''); if(it.src==='codi') return true; if(s) return /수학|math/i.test(s); return /수학|쎈|RPM|개념원리|개념\+유형|유형|학습지|매쓰|오답|아하|일품|블랙|라이트|교과서 문제/.test(t); }
async function plrEvRun(force){
  if(PLR.ev.running) return; if(!force&&Date.now()-PLR.ev.at<10*60000) return;
  var sb=null; try{ sb=getSupaClient(); }catch(e){} if(!sb||!PWB.loaded) return;
  PLR.ev.running=true;
  try{
    var sts=(students||[]).filter(function(s){ return s&&s.lumen_rec_code&&!s.withdrawn; }), codes=sts.map(function(s){ return s.lumen_rec_code; });
    var today=PW.day(), from=PW.START, mf={}, aha={};
    for(var off=0; off<200000; off+=1000){
      var r=await sb.from('mf_answer_records').select('lumen_rec_code,score_datetime').in('lumen_rec_code',codes).gte('score_datetime',from).order('score_datetime',{ ascending:true }).range(off,off+999);
      var rows=(r&&r.data)||[]; rows.forEach(function(x){ var d=String(x.score_datetime||'').slice(0,10), hh=+String(x.score_datetime||'').slice(11,13); var c=x.lumen_rec_code; mf[c]=mf[c]||{}; mf[c][d]=1; if(hh<3){ mf[c][PW.add(d,-1)]=1; } });
      if(rows.length<1000) break;
    }
    var ra=await sb.from('aha_notes').select('student_code,created_at').in('student_code',codes).gte('created_at',from+'T00:00:00+09:00').limit(5000);
    ((ra&&ra.data)||[]).forEach(function(x){ var d=PW.dayOfIso(x.created_at); if(!d) return; var c=x.student_code; aha[c]=aha[c]||{}; aha[c][d]=1; var hh=new Date(Date.parse(x.created_at)+9*3600000).getUTCHours(); if(hh<3) aha[c][PW.add(d,-1)]=1; });
    var by={};
    sts.forEach(function(st){ var c=st.lumen_rec_code;
      for(var W=PW.W0; W<=PW.thisMon(); W=PW.add(W,7)){
        var plan=PW.planOf(PWB.wp[c], PWB.cp[c], W), chk=PW.chkOf(PWB.chk[c], PWB.cd[c], W);
        ((plan&&plan.items)||[]).forEach(function(it){ var day=PW.add(W,+it.d||0); if(!it.title||day<PW.START||day>=today) return; if(!(chk[it.id]&&chk[it.id].ok)) return; if(!plrIsMath(it)) return;
          if((mf[c]&&mf[c][day])||(aha[c]&&aha[c][day])) return;
          by[c]=by[c]||{}; by[c][W]=by[c][W]||{}; by[c][W][it.id]=0; });
      }
    });
    var nv={ byCode:by };
    if(JSON.stringify(nv.byCode)!==JSON.stringify((PWB.ev&&PWB.ev.byCode)||{})){
      nv.upd=new Date().toISOString();
      await sb.from('lumen_store').upsert({ key:'plweek_ev', value:nv, updated_at:nv.upd }, { onConflict:'key' });
      PWB.ev=nv; if(VIEW==='plweek'||VIEW==='planner') render();
    }
    PLR.ev.at=Date.now();
  }catch(e){ console.warn('[주간 실천 증거]', e); }
  PLR.ev.running=false;
}
(function(){
  var orig=window.plwLoad; if(typeof orig!=='function') return;
  window.plwLoad=async function(force){
    var r=await orig(force);
    try{ var sb=getSupaClient(); var x=await sb.from('lumen_store').select('value').eq('key','plweek_ev'); var v=x&&x.data&&x.data[0]?x.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } PWB.ev=v||{ byCode:{} }; }catch(e){}
    plrEvRun(force).then(function(){ if(force&&typeof plwRepublish==='function') plwRepublish(); });
    return r;
  };
  window.plwScore=function(st, W){
    var c=st.lumen_rec_code;
    return PW.week({ wMon:W, planNext:PW.planOf(PWB.wp[c], PWB.cp[c], PW.add(W,7)), plan:PW.planOf(PWB.wp[c], PWB.cp[c], W),
      chk:PW.chkOf(PWB.chk[c], PWB.cd[c], W), sg:(PWB.sg[c]||{})[W]||null, paper:((PWB.paper.byCode||{})[c]||{})[W]||null,
      days:PWB.days[st.group||'']||null, ev:(((PWB.ev&&PWB.ev.byCode)||{})[c]||{})[W]||null });
  };
})();

/* ── ⑥ 플래너 입력 표: 일요일마다 «주간» 칸 · 합계 = 매일 + 주간 ── */
function plrGridWeekOf(yr, mo, d){ var ds=yr+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2); if(new Date(Date.UTC(yr,mo-1,d)).getUTCDay()!==0) return null; var W=PW.mon(ds); if(W<PW.W0) return null; return W; }
function plrGridHead(yr, mo, d, row){
  if(!plrGridWeekOf(yr,mo,d)) return '';
  return row===1?'<th style="min-width:30px;padding:2px;text-align:center;border-bottom:1px solid #e8edf5;font-size:9px;font-weight:800;color:#7c3aed;background:#f5f3ff">주</th>'
    :'<th style="min-width:30px;padding:4px 2px;text-align:center;border-bottom:2px solid #e8edf5;font-size:10px;font-weight:800;color:#7c3aed;background:#f5f3ff" title="그 주(월~일) 주간 점수 · 일요일 밤 발표">주간</th>';
}
function plrGridCell(st, yr, mo, d){
  var W=plrGridWeekOf(yr,mo,d); if(!W) return '';
  if(!PWB.loaded){ if(!PWB.loading&&!PLR._gridLoad){ PLR._gridLoad=1; try{ plwLoad().then(function(){ if(VIEW==='planner') render(); }); }catch(e){} } return '<td style="padding:2px;text-align:center;background:#faf8ff"><div style="width:26px;height:24px;margin:auto;font-size:9px;color:#c4b5fd;display:flex;align-items:center;justify-content:center">…</div></td>'; }
  if(!st.lumen_rec_code) return '<td style="background:#faf8ff"></td>';
  var s=plwScore(st, W), rel=s.released;
  var tip='주간 '+PW.md(W)+'~'+PW.md(PW.add(W,6))+(rel?(' · 계획 '+s.planPt+' · 실천 '+s.prac.pt+(s.prac.noEv?(' (증거 없음 '+s.prac.noEv+')'):'')+' · 순공 사진 '+s.photoPt+' · 종이 '+s.paperPt):' · 일요일 밤 발표');
  return '<td style="padding:2px;text-align:center;background:#faf8ff"><div onclick="VIEW=\'plweek\';PWB.W=\''+W+'\';render()" title="'+tip+'" style="width:26px;height:24px;border-radius:5px;margin:auto;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;cursor:pointer;'
    +(rel?('background:'+(s.total>=7?'#7c3aed':(s.total>=4?'#a78bfa':(s.total>0?'#ddd6fe':'#ede9fe')))+';color:'+(s.total>=4?'#fff':'#5b21b6')):'border:1.5px dashed #c4b5fd;color:#a78bfa')+'">'+(rel?s.total:'·')+'</div></td>';
}
function plrGridTotal(st, ym, daily, tColor){
  var wk=0; try{ if(PWB.loaded) wk=plwMonthWeekly(st, ym.replace('.','-')); }catch(e){}
  if(ym<'2026.10') return String(daily);
  return '<div style="line-height:1.1">'+(daily+wk)+'</div><div style="font-size:9px;font-weight:700;color:#94a3b8;white-space:nowrap">매일 '+daily+' · <span style="color:#7c3aed">주간 '+wk+'</span></div>';
}

/* ── ⑦ 플래너 왼쪽 탭에 주간 점수 · 순공피드백 · 스터디 코디 ── */
window.plrNavGo=function(v){
  if(v==='plweek'){ VIEW='plweek'; PWB.W=null; try{ plwLoad(true); }catch(e){} }
  else if(v==='codi'){ VIEW='codi'; try{ CD.sel=null; }catch(e){} }
  else VIEW=v;
  render();
};
/* 수정 창의 점수 고르기 칸 — 기준표의 최대점까지 */
window.plrOpts=function(a, k){ var r=plRulesFor(plDateKey(a&&a.date))||PLR.DEF; var mx=k==='p'?Math.max(+r.prHiPts||0,+r.prLoPts||0):(k==='s'?(+r.spec):(+r.fbMax)); var o=[]; for(var i=Math.max(0,mx);i>=0;i--) o.push(String(i)); return o; };

/* ═══ v19-82: 여러 기기 덮어쓰기 막기 (2026-10-06 — 다시 계산한 10월 점수가 다른 기기·창의 옛 사본에 되돌아간 일) ═══
 *   등록부 병합은 «같은 순위면 이 기기 것»이었다 → 옛 사본을 가진 기기가 저장하면 고친 점수가 되돌아갔다.
 *   이제 ① 플래너 세트: 승인 순위가 같으면 analysis 의 가장 늦은 시각(upd·editedAt·analyzedAt)이 이긴다
 *        ② 날짜별 점수: plSetScore 가 날짜마다 시각(lumen_planner_at)을 남기고, 클라우드 쪽이 더 최근이면 클라우드 값을 둔다 */
window.plMergeStamp=function(x){ var a=(x&&x.analysis)||{}; var t=[a.upd||'',a.editedAt||'',a.analyzedAt||'',x&&x.reviewedAt||''].sort(); return t[t.length-1]; };
(function(){
  if(typeof plSetScore!=='function') return;
  var orig=plSetScore;
  plSetScore=function(st, dateStr, score, why){ var ok=orig(st, dateStr, score, why); if(ok){ st.lumen_planner_at=st.lumen_planner_at||{}; st.lumen_planner_at[dateStr]=new Date().toISOString(); } return ok; };
  window.plSetScore=plSetScore;
})();
