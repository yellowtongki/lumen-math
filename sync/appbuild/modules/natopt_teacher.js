/* ═══════════════════════════════════════════════════════════════════
 * v19-85: 🌐 전국 등수 — 보고 싶은 학생만 (원장 결정 2026-10-07 「희망하는 학생만 볼 수 있게」)
 *  · 원장님 설정 wk_pub.natMode: 'all' 모두 · 'optin' 신청한 학생만 · (nat:false = 끔)
 *  · 학생 신청 lumen_store natopt_<코드> { on, at, by:'student'|'teacher' } — 학생앱 v2-128 「보기 신청」, 원장님도 여기서 켜고 끈다
 *  · 울트라일일 등수 줄에 「학생앱: 신청함 / 안 함」 표시 — 리포트를 보내도 학생앱에 전국 등수가 보이는지 바로 알 수 있게
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var NOPT = { loaded:false, loading:false, map:{}, pub:null };
function noptLoad(force){
  if(NOPT.loading||(NOPT.loaded&&!force)) return; NOPT.loading=true;
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb){ NOPT.loading=false; return; }
  sb.from('lumen_store').select('key,value').or('key.eq.wk_pub,key.like.natopt_%').then(function(r){
    ((r&&r.data)||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
      if(row.key==='wk_pub'){ NOPT.pub=v||{}; if(typeof HALL!=='undefined'&&!HALL.pub) HALL.pub=v||{}; }
      else NOPT.map[row.key.slice(7)]=v||{}; });
    NOPT.loaded=true; NOPT.loading=false; if(typeof render==='function'&&(VIEW==='ultra'||VIEW==='hall'||VIEW==='weekly')) render();
  }).catch(function(){ NOPT.loading=false; NOPT.loaded=true; });
}
setTimeout(function(){ try{ noptLoad(); }catch(e){} }, 2500);
function noptPub(){ return (typeof HALL!=='undefined'&&HALL.pub)||NOPT.pub||{}; }
function noptMode(){ var p=noptPub(); if(p.nat===false) return 'off'; return p.natMode||'all'; }
function noptOn(code){ var v=NOPT.map[String(code||'')]; return !!(v&&v.on); }
function noptCodeOfName(nm){ try{ var st=(students||[]).filter(function(s){ return s&&s.name===nm&&!s.withdrawn; })[0]; return st?String(st.lumen_rec_code||''):''; }catch(e){ return ''; } }
window.noptSetMode=async function(m){
  var p=Object.assign({}, noptPub());
  if(m==='off') p.nat=false; else { p.nat=true; p.natMode=m; }
  if(typeof HALL!=='undefined') HALL.pub=p; NOPT.pub=p; render();
  var ok=await supaSetItem('wk_pub', p);
  plToast(ok?('🌐 학생앱 전국 등수: '+({all:'모든 학생에게 보임',optin:'신청한 학생만',off:'끔'})[m]):'저장 실패 — 네트워크 확인');
};
window.noptSet=async function(code, on){
  if(!code) return; var v={ on:!!on, at:new Date().toISOString(), by:'teacher' };
  var sb=getSupaClient(); var w=await sb.from('lumen_store').upsert({ key:'natopt_'+code, value:v, updated_at:v.at }, { onConflict:'key' });
  if(w&&w.error){ plToast('저장 실패: '+(w.error.message||w.error)); return; }
  NOPT.map[code]=v; render(); plToast(on?'🌐 전국 등수를 이 학생 학생앱에 보이게 했습니다':'🔒 이 학생 학생앱에서 전국 등수를 숨겼습니다');
};
/* 주간테스트 탭 「학생앱 표시」 아래 — 방식 고르기 + 학생별 신청 현황 */
function noptPanelHtml(){
  if(!NOPT.loaded) noptLoad();
  var m=noptMode(), esc=function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var chip=function(on,label,js){ return '<span onclick="'+js+'" style="cursor:pointer;font-size:12px;font-weight:900;border-radius:50px;padding:6px 13px;user-select:none;'+(on?'background:#0ea5e9;color:#fff':'background:#e2e8f0;color:#64748b')+'">'+label+'</span>'; };
  var h='<div style="margin-top:10px;background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:13px;padding:11px 13px">';
  h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:900;color:#0c4a6e">🌐 학생앱 전국 등수</span>'
    +chip(m==='optin','🙋 신청한 학생만',"noptSetMode('optin')")+chip(m==='all','모든 학생',"noptSetMode('all')")+chip(m==='off','끄기',"noptSetMode('off')")+'</div>';
  if(m!=='optin'){ h+='<div style="font-size:10.5px;color:#64748b;font-weight:700;margin-top:6px">'+(m==='all'?'모든 학생의 「내 기록」·리포트에 전국 등수가 보입니다.':'학생앱 어디에도 전국 등수가 보이지 않습니다.')+'</div></div>'; return h; }
  var list=[]; try{ list=getSortedStudents().filter(function(s){ return s&&s.lumen_rec_code&&!s.withdrawn; }); }catch(e){}
  var onN=list.filter(function(s){ return noptOn(s.lumen_rec_code); }).length;
  h+='<div style="font-size:10.5px;color:#0369a1;font-weight:700;margin:6px 0 8px;line-height:1.6">학생앱 「내 기록」·리포트에 <b>「보기 신청」</b> 단추가 나옵니다. 신청한 학생에게만 자기 전국 등수가 보이고(다른 학생 것은 안 보임), 학생이 언제든 다시 숨길 수 있습니다. 원장님이 아래에서 대신 켜고 끌 수도 있습니다. 1등 발표 카드의 전국 등수도 그 학생이 신청했을 때만 나옵니다.</div>';
  h+='<div style="font-size:11.5px;font-weight:900;color:#0c4a6e;margin-bottom:6px">신청 '+onN+'명 / '+list.length+'명</div><div style="display:flex;gap:5px;flex-wrap:wrap">';
  list.forEach(function(s){ var c=s.lumen_rec_code, on=noptOn(c), v=NOPT.map[c]||{};
    var tip=on?((v.by==='teacher'?'원장님이 켬':'학생이 신청')+' · '+String(v.at||'').slice(5,10).replace('-','/')+' · 누르면 끄기'):'누르면 이 학생에게 보이게';
    h+='<span onclick="noptSet(\''+esc(c)+'\','+(!on)+')" title="'+esc(tip)+'" style="cursor:pointer;font-size:11.5px;font-weight:800;border-radius:50px;padding:4px 10px;'+(on?'background:#0ea5e9;color:#fff':'background:#fff;color:#94a3b8;border:1px solid #e2e8f0')+'">'+(on?'🌐 ':'')+esc(s.name)+'</span>'; });
  return h+'</div></div>';
}
/* 울트라일일 등수 줄 — 이 학생 학생앱에 전국 등수가 보이나 */
function noptBadge(name){
  if(!NOPT.loaded) noptLoad();
  var m=noptMode(), code=noptCodeOfName(name), st='font-size:10.5px;font-weight:800;border-radius:50px;padding:4px 10px;';
  if(m==='off') return '<span style="'+st+'background:#f1f5f9;color:#94a3b8" title="주간테스트 탭에서 학생앱 전국 등수를 껐습니다">📱 학생앱 전국 끔</span>';
  if(m==='all') return '';
  if(!code) return '';
  var on=noptOn(code);
  return '<span onclick="noptSet(\''+code+'\','+(!on)+')" title="'+(on?'학생이 신청해 학생앱에 전국 등수가 보입니다 · 누르면 숨김':'학생이 신청하지 않아 학생앱에는 전국 등수가 안 보입니다 · 누르면 원장님이 켬')+'" style="cursor:pointer;'+st+(on?'background:#e0f2fe;color:#0369a1':'background:#f8fafc;color:#94a3b8;border:1px dashed #cbd5e1')+'">'+(on?'🙋 학생앱 전국 신청함':'🔒 학생앱 전국 미신청')+'</span>';
}

/* ═══ v19-85: 「↩ 다른 날 맞음」으로 되살린 날의 점수가 0으로 남던 것 (2026-10-07 확인 — 10/5 한 칸) ═══
 *   plzClear 는 분석 칸만 되돌리고, 이미 승인된 세트의 그날 점수는 다시 넣지 않았다(9월 소급분만 넣었다). */
(function(){
  var orig=window.plzClear; if(typeof orig!=='function') return;
  window.plzClear=function(stId, setId){
    orig(stId, setId);
    try{ var st=(students||[]).filter(function(s){ return s&&s.id===stId; })[0]; var p=st&&(st.lumen_planner_photos||[]).filter(function(x){ return x&&x.setId===setId; })[0];
      if(p&&plzRestoreScore(st,p)){ saveStudents(); if(typeof publishPlannerDataForStudent==='function') publishPlannerDataForStudent(st); render(); } }catch(e){ console.warn('[되살리기 점수]', e); }
  };
})();
function plzRestoreScore(st, p){
  var a=p&&p.analysis; if(!a||!p.reviewed||a.zeroDay) return false;
  var key=String(a.date||''); if(!/^\d{4}\.\d{2}\.\d{2}$/.test(key)) return false;
  var total=plUseManual(p, (+a.plannerScore||0)+(+a.studyScore||0)+(+a.practiceScore||0)+(+a.specificScore||0)+(+a.feedbackScore||0));
  if(((st.lumen_planner||{})[key])===total) return false;
  return plSetScore(st, key, total, '되살린 날 점수');
}
/* 이미 그렇게 남은 칸 고치기 — 플래너 화면을 열 때 한 번 (되살렸는데 그날 점수가 0) */
function plzHealCleared(){
  if(PLR._healed) return; PLR._healed=1; var fixed=[];
  (students||[]).forEach(function(st){ if(!st||st.withdrawn) return; var ch=false;
    (st.lumen_planner_photos||[]).forEach(function(p){ var a=p&&p.analysis; if(!a||!a.zeroCleared) return; var key=String(a.date||''); if(Number((st.lumen_planner||{})[key])!==0) return;
      if(plzRestoreScore(st,p)){ ch=true; fixed.push(st.name+' '+key); } });
    if(ch&&typeof publishPlannerDataForStudent==='function') publishPlannerDataForStudent(st); });
  if(fixed.length){ saveStudents(); try{ plToast('🩹 되살린 날 점수 다시 넣음: '+fixed.join(', ')); }catch(e){} }
}
