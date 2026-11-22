/* ═══════════════════════════════════════════════════════════════════
 * v19-202: 🚨 이탈 방지 — 위험 신호 2판 · 📞 상담 전 브리핑 · 🎉 성과 알림
 *   (루멘이사회 2026-11-22 결정 · 인수인계 docs/handoff_churn_guard.md · 시안 docs/mockup_churn_guard.html · 원장 「만들어. 배포」)
 *   원장 전용 화면. 학생앱·학부모앱에는 아무것도 안 간다. 문자는 자동으로 보내지 않는다(복사만). 서버에 새로 쓰는 것 없음.
 *  ① 위험 신호(riskOf 감싸기) — 새 신호
 *     · 🔴 정답률 저하: 최근 2주 묶음(유형 성취도) 15문항 이상 70% 미만 (옛 «60% 미만» 대신)
 *     · 🔴 플래너 끊김: 최근 30일 안에 올린 적 있는데 7일 연속 없음 (옛 사흘은 🟡 그대로)
 *     · 🟡 많이 푸는데 많이 틀림: race_board 같은 학년(4명 이상)에서 푼 문항 ≥ 중앙값 · 정답률 ≤ 하위 25%
 *     · 🟡 주간 점수 0: 이번 달 플래너 순위(planner_ranking_YYYY-MM)의 주간 점수 0 (달이 10일 넘게 지났을 때)
 *     · 성적 기록 없음은 카드마다 띄우지 않고 맨 위 숫자 + 브리핑에만(대부분이 걸려 시끄러움)
 *  ② 화면 위 탭: 🚨 위험 신호 · 🎉 성과 알림 / 학생 카드 이름 옆 «📞 브리핑»
 *  ③ 📞 브리핑(창): 레이스(문항·정답률·학년 순위) · 유형 성취도 2주 · 플래너 4주(제출일·평균) · 주간테스트 최근 3회 · 학교 시험
 *     · 맨 위 «하면 안 되는 말»: 푼 양이 학년 중앙값 이상이면 «공부량이 적다» 금지 + 대신 할 말
 *  ④ 🎉 성과 알림: 학교 성적(school_scores, 수학) 직전보다 오름 · 주간테스트 직전보다 10점 이상 — 기록 뒤 48시간 안
 *     · 축하 문자 쓰기: «다만/하지만 · 부족/아쉽 · 보충/추가 수업/비용» 이 있으면 빨갛게 + 복사 막음
 *  ⑤ 홈 🚨 카드 위 한 줄 «🚨 챙길 학생 n · 🎉 축하할 학생 n»
 *  ※ 문자열 연결로만(템플릿 리터럴 금지). 읽기: race_board · planner_ranking_YYYY-MM (htKv) · 등록부 lumen_planner · schoolScores · WK.
 * ═══════════════════════════════════════════════════════════════════ */
var CG = { race:null, prank:null, busy:false, tab:'risk', brief:'', msg:{}, msgFor:'' };
function cgKick(){
  if(CG.busy || (CG.race && CG.prank)) return; CG.busy=true;
  var ym=riskKst().slice(0,7);
  Promise.all([ htKv('race_board').catch(function(){ return null; }), htKv('planner_ranking_'+ym).catch(function(){ return null; }) ])
    .then(function(r){ CG.race=r[0]||{}; CG.prank=r[1]||{}; })
    .then(function(){ CG.busy=false; if(VIEW==='risk'||VIEW==='home') render(); });
}
function cgRows(){ var r=CG.race||{}; return [].concat(Array.isArray(r.mid)?r.mid:[], Array.isArray(r.elem)?r.elem:[]); }
function cgRaceOf(code){ return cgRows().filter(function(x){ return x && String(x.code)===String(code); })[0]||null; }
function cgQ(arr, q){ if(!arr.length) return null; var a=arr.slice().sort(function(x,y){ return x-y; }); var i=(a.length-1)*q, lo=Math.floor(i), hi=Math.ceil(i); return a[lo]+(a[hi]-a[lo])*(i-lo); }
/* 같은 학년 비교 — 분량 순위 · 정답률 순위 · 중앙값 · 하위 25% */
function cgGrade(code){
  var me=cgRaceOf(code); if(!me || !me.gr) return null;
  var g=cgRows().filter(function(x){ return x && x.gr===me.gr && (+x.n||0)>0; });
  var ns=g.map(function(x){ return +x.n||0; }), rs=g.map(function(x){ return +x.rate||0; });
  var nRank=1+g.filter(function(x){ return (+x.n||0)>(+me.n||0); }).length, rRank=1+g.filter(function(x){ return (+x.rate||0)>(+me.rate||0); }).length;
  return { me:me, size:g.length, nMed:cgQ(ns,0.5), rQ1:cgQ(rs,0.25), rAvg:rs.length?Math.round(rs.reduce(function(a,b){ return a+b; },0)/rs.length):null, nRank:nRank, rRank:rRank };
}
function cgPlanDays(st, days){ var pl=st.lumen_planner||{}, n=0, sum=0, last=''; for(var i=0;i<days;i++){ var d=riskKst(Date.now()-i*86400000); var v=pl[d]; if(v!==undefined && v!==null){ n++; sum+=(+v||0); if(!last) last=d; } } return { n:n, avg:n?Math.round(sum/n*10)/10:null, last:last }; }
function cgPlanLast(st){ var pl=st.lumen_planner||{}, ks=Object.keys(pl).filter(function(k){ return pl[k]!==null && pl[k]!==undefined; }).sort(); return ks.length?ks[ks.length-1]:''; }
function cgDaysSince(ymd){ return ymd?Math.floor((Date.parse(riskKst()+'T00:00:00+09:00')-Date.parse(ymd+'T00:00:00+09:00'))/86400000):null; }
function cgWeekly(code){ var r=((CG.prank||{}).ranking)||[]; return r.filter(function(x){ return x && String(x.code)===String(code); })[0]||null; }
function cgScores(st){
  var all=[]; try{ all=(schoolScores&&schoolScores[st.id])||[]; }catch(e){}
  return all.map(function(e){ var m=(e.subjects||[]).filter(function(s){ return /수학/.test(s.name||''); })[0]; return { d:String(e.examDate||''), name:((e.semester&&e.semester.term)?e.semester.term+' ':'')+(e.examType||e.examName||'시험'), score:m&&m.score!=null&&m.score!==''?+m.score:null, at:e.createdAt||'' }; })
    .filter(function(x){ return x.score!=null; }).sort(function(a,b){ return a.d<b.d?-1:1; });
}
function cgNoScore(st){ if(!/중|고/.test(String(st.grade||''))) return false; return !cgScores(st).some(function(x){ return x.d>='2026-09-01'; }); }

/* ── ① riskOf 감싸기 ── */
if(typeof riskOf==='function') riskOf=(function(o){ return function(st){
  var out=o.apply(this, arguments)||[];
  try{
    var code=String(st.lumen_rec_code||''), t=(typeof riskTq==='function')?riskTq(code):null;
    out=out.filter(function(x){ return x.k!=='low'; });
    if(t && t.n>=15 && t.rate!=null && t.rate<70 && !out.some(function(x){ return x.k==='drop'; }))
      out.push({ k:'low', sev:2, t:'정답률 저하 '+t.rate+'%', d:'최근 2주 '+t.n+'문항 · 기준 70%', go:'typeach' });
    var last=cgPlanLast(st), ago=cgDaysSince(last);
    if(last && ago!=null && ago>=7 && ago<=30){ out=out.filter(function(x){ return x.k!=='plan'; }); out.push({ k:'plan', sev:2, t:'플래너 끊김 '+ago+'일', d:last.slice(5).replace('-','/')+' 뒤로 없음', go:'lgall' }); }
    var G=cgGrade(code);
    if(G && G.size>=4 && (+G.me.n||0)>=G.nMed && (+G.me.rate||0)<=G.rQ1)
      out.push({ k:'many', sev:1, t:'많이 푸는데 많이 틀림', d:(+G.me.n||0).toLocaleString()+'문항(학년 '+G.size+'명 중 '+G.nRank+'위) · 정답률 '+G.me.rate+'%(학년 '+G.rRank+'위 · 평균 '+G.rAvg+'%)', go:'lgall' });
    var W=cgWeekly(code), dom=+riskKst().slice(8,10);
    if(CG.prank && dom>10 && (!W || (+W.weekly||0)===0) && cgPlanLast(st)) out.push({ k:'wzero', sev:1, t:'주간 점수 0', d:'이번 달('+riskKst().slice(5,7)+'월) 주간계획·순공 점수 없음', go:'lgall' });
  }catch(e){ try{ console.error('[이탈 방지 신호]', e); }catch(_){} }
  return out;
}; })(riskOf);
try{ RISK_NAMES.low='정답률 저하'; RISK_NAMES.many='많이 푸는데 많이 틀림'; RISK_NAMES.wzero='주간 점수 0'; }catch(e){}

/* ── ④ 성과 알림 ── */
function cgWins(){
  var out=[], now=Date.now();
  getSortedStudents().filter(function(s){ return s && !s.withdrawn; }).forEach(function(s){
    var sc=cgScores(s);
    if(sc.length>=2){ var a=sc[sc.length-1], b=sc[sc.length-2], at=Date.parse(a.at||(a.d+'T12:00:00+09:00'));
      if(a.score>b.score && now-at<=48*3600000) out.push({ st:s, kind:'학교 '+a.name, from:b.score, to:a.score, left:Math.max(0,Math.round((48*3600000-(now-at))/3600000)) }); }
    try{ if(typeof WK!=='undefined' && WK.loaded){ var sid=_wkSidByName()[String(s.name||'').trim()]; var h=(sid!==undefined)?_wkHistOf(sid):[];
      if(h.length>=2 && h[0].score!=null && h[1].score!=null && h[0].score>=h[1].score+10){ var at2=Date.parse(String(h[0].date||'').replace(/\./g,'-')+'T18:00:00+09:00');
        if(!isNaN(at2) && now-at2<=48*3600000) out.push({ st:s, kind:'주간테스트', from:h[1].score, to:h[0].score, left:Math.max(0,Math.round((48*3600000-(now-at2))/3600000)) }); } } }catch(e){}
  });
  return out.sort(function(a,b){ return a.left-b.left; });
}
var CG_BAN=[ [/다만|하지만|그런데|그러나/g,'«다만»류 금지'], [/부족|아쉽|모자라|약하/g,'점수 깎는 표현'], [/보충|추가 ?수업|더 오래|시간을 늘|비용|수강료|등록/g,'같은 주 추가 시간·비용 요구'] ];
function cgBanHits(t){ var hits=[]; CG_BAN.forEach(function(b){ var m=String(t||'').match(b[0]); if(m) hits.push(b[1]+' «'+m[0]+'»'); }); return hits; }
window.cgMsgInput=function(el){ CG.msg[CG.msgFor]=el.value; var hits=cgBanHits(el.value), box=document.getElementById('cg-ban'), btn=document.getElementById('cg-copy');
  if(box) box.innerHTML=hits.length?hits.map(function(x){ return '<span style="color:#b91c1c">✗ '+esc2(x)+'</span>'; }).join(' · '):'<span style="color:#15803d">✓ 축하만 담겼어요</span>';
  if(btn){ btn.disabled=!!hits.length || !String(el.value).trim(); btn.style.opacity=btn.disabled?'.45':'1'; } };
window.cgMsgPick=function(id){ CG.msgFor=id; render(); };
window.cgMsgCopy=function(){ var t=CG.msg[CG.msgFor]||''; if(cgBanHits(t).length) return; try{ navigator.clipboard.writeText(t).then(function(){ try{ plToast('📋 복사했어요 — 문자는 원장님이 직접 보내세요'); }catch(e){} }); }catch(e){ prompt('복사해서 쓰세요', t); } };
function cgWinsPage(){
  var W=cgWins(), h='<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:14px 16px">';
  h+='<div style="font-size:12px;color:#64748b;font-weight:700;margin-bottom:8px">성적이 직전보다 오른 학생 · 기록 뒤 48시간 안 — 축하 문자는 원장님이 직접 보내요(자동 발송 없음)</div>';
  if(!W.length) return h+'<div style="padding:20px;text-align:center;color:#94a3b8;font-weight:800">지금 축하할 학생이 없어요 · 학교 성적을 넣거나 주간테스트가 오르면 여기에 떠요</div></div>';
  if(!CG.msgFor || !W.some(function(w){ return w.st.id===CG.msgFor; })) CG.msgFor=W[0].st.id;
  h+='<div style="display:flex;gap:14px;flex-wrap:wrap"><table style="flex:1 1 320px;border-collapse:collapse"><tr>'+['학생','시험','변화','남은 시간'].map(function(x){ return '<th style="font-size:11.5px;color:#64748b;text-align:left;padding:6px 8px;border-bottom:1.5px solid #e2e8f0">'+x+'</th>'; }).join('')+'</tr>';
  W.forEach(function(w){ var on=w.st.id===CG.msgFor; h+='<tr class="cg-win" onclick="cgMsgPick(\''+esc2(w.st.id)+'\')" style="cursor:pointer;'+(on?'background:#fffbeb':'')+'"><td style="padding:7px 8px"><b>'+esc2(w.st.name)+'</b></td><td style="padding:7px 8px">'+esc2(w.kind)+'</td><td style="padding:7px 8px;color:#15803d;font-weight:900">'+w.from+' → '+w.to+' (+'+(Math.round((w.to-w.from)*10)/10)+')</td><td style="padding:7px 8px">'+w.left+'시간</td></tr>'; });
  h+='</table>';
  var cur=W.filter(function(w){ return w.st.id===CG.msgFor; })[0], nm=String(cur.st.name||'').replace(/^.(.+)$/,'$1');
  if(CG.msg[CG.msgFor]==null) CG.msg[CG.msgFor]=nm+'이(가) '+cur.kind+' '+cur.to+'점, 지난번보다 '+(Math.round((cur.to-cur.from)*10)/10)+'점이나 올랐어요! 그동안 꾸준히 해 온 덕분이에요. 함께 축하해 주세요 😊';
  var hits=cgBanHits(CG.msg[CG.msgFor]);
  h+='<div style="flex:1 1 340px"><b>✉️ '+esc2(cur.st.name)+' 축하 문자</b><textarea id="cg-msg" oninput="cgMsgInput(this)" style="display:block;width:100%;min-height:110px;margin-top:6px;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px;font-family:inherit;font-size:13px;line-height:1.6">'+esc2(CG.msg[CG.msgFor])+'</textarea>'
    +'<div id="cg-ban" style="font-size:12px;font-weight:800;margin-top:6px">'+(hits.length?hits.map(function(x){ return '<span style="color:#b91c1c">✗ '+esc2(x)+'</span>'; }).join(' · '):'<span style="color:#15803d">✓ 축하만 담겼어요</span>')+'</div>'
    +'<div style="font-size:11px;color:#64748b;margin-top:4px">규칙(이사회 결정): «다만» 금지 · 점수 깎는 표현 금지 · 같은 주에 추가 시간·비용 요구 금지</div>'
    +'<button id="cg-copy" type="button" onclick="cgMsgCopy()" '+(hits.length?'disabled ':'')+'style="margin-top:8px;border:0;border-radius:10px;padding:9px 14px;font-weight:900;background:#0d2240;color:#fff;cursor:pointer;font-family:inherit;opacity:'+(hits.length?'.45':'1')+'">📋 복사</button></div></div>';
  return h+'</div>';
}

/* ── ③ 상담 전 브리핑 ── */
window.cgBrief=function(id){ CG.brief=id||''; render(); };
function cgBriefHtml(st){
  var code=String(st.lumen_rec_code||''), G=cgGrade(code), t=(typeof riskTq==='function')?riskTq(code):null, P=cgPlanDays(st,28), sc=cgScores(st);
  var wk=[]; try{ if(typeof WK!=='undefined'&&WK.loaded){ var sid=_wkSidByName()[String(st.name||'').trim()]; wk=(sid!==undefined)?_wkHistOf(sid).slice(0,3):[]; } }catch(e){}
  function tile(ttl, body){ return '<div style="background:#f8fafc;border-radius:12px;padding:10px 12px"><div style="font-size:12.5px;font-weight:900;color:#334155;margin-bottom:5px">'+ttl+'</div>'+body+'</div>'; }
  var sub='font-size:11.5px;color:#64748b;font-weight:700';
  var h='<div onclick="if(event.target===this)cgBrief(\'\')" style="position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto">'
    +'<div id="cg-brief" style="background:#fff;border-radius:18px;max-width:760px;width:100%;padding:16px 18px;box-shadow:0 20px 50px rgba(0,0,0,.25)">';
  h+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:18px">📞 '+esc2(st.name)+'</b><span style="'+sub+'">'+esc2([String(st.grade||'').replace('학교 ',''), st.school||'', st.group||''].filter(Boolean).join(' · '))+' · 상담 전 브리핑 · 원장님만</span>'
    +'<button type="button" onclick="window.print()" style="margin-left:auto;border:0;border-radius:9px;padding:6px 10px;font-weight:900;background:#e2e8f0;cursor:pointer;font-family:inherit">🖨 인쇄</button><button type="button" onclick="cgBrief(\'\')" style="border:0;background:transparent;font-size:18px;cursor:pointer">✕</button></div>';
  if(G && (+G.me.n||0)>=G.nMed){
    h+='<div class="cg-dont" style="background:#fff1f2;border:2px solid #fda4af;border-radius:12px;padding:10px 13px;margin:6px 0 10px;color:#9f1239;font-weight:800;line-height:1.6">⚠ «공부량이 적다»고 말하지 마세요 — 레이스 '+(+G.me.n||0).toLocaleString()+'문항, 학년 '+G.size+'명 중 '+G.nRank+'위(중앙값 이상)입니다.'
      +((+G.me.rate||0)<75?'<br>✅ 대신: «양은 충분해요. 정답률이 '+G.me.rate+'%라 <b>푸는 방법</b>(오답 다시 풀기 · 아하노트)을 같이 바꿔 볼게요»':'')+'</div>';
  } else if(G){
    h+='<div style="background:#f0f9ff;border:1.5px solid #bae6fd;border-radius:12px;padding:9px 12px;margin:6px 0 10px;color:#075985;font-weight:800;line-height:1.6">ℹ 푼 양은 학년 '+G.size+'명 중 '+G.nRank+'위예요(중앙값 아래). 분량 이야기를 할 때도 숫자로 말해 주세요.</div>';
  }
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">';
  h+=tile('📝 레이스 (매쓰플랫)', G?('<b style="font-size:20px">'+(+G.me.n||0).toLocaleString()+'문항</b> <span style="'+sub+'">학년 '+G.size+'명 중 '+G.nRank+'위</span><br><b style="font-size:20px;color:'+((+G.me.rate||0)<70?'#b91c1c':'#0f172a')+'">'+G.me.rate+'%</b> <span style="'+sub+'">정답률 · 학년 '+G.rRank+'위 · 평균 '+G.rAvg+'%</span><div style="'+sub+'">'+esc2((CG.race&&CG.race.from)||'')+' 부터 · '+(+G.me.days||0)+'일 참여</div>'):'<span style="'+sub+'">레이스 기록 없음</span>');
  h+=tile('📊 최근 2주 정답률 (유형 성취도)', t&&t.rate!=null?('<b style="font-size:20px">'+t.rate+'%</b> <span style="'+sub+'">'+t.n+'문항</span>'+(t.prate!=null?'<div style="'+sub+'">직전 2주 '+t.prate+'% ('+t.pn+'문항)</div>':'')):'<span style="'+sub+'">기록 없음</span>');
  h+=tile('📓 플래너 (최근 4주)', '<b style="font-size:20px">'+P.n+'일</b> <span style="'+sub+'">/ 28일 제출</span><br><b style="font-size:20px">'+(P.avg!=null?P.avg+'점':'—')+'</b> <span style="'+sub+'">평균 · 마지막 '+(cgPlanLast(st)?cgPlanLast(st).slice(5).replace('-','/'):'없음')+'</span>');
  h+=tile('🏫 학교 시험 (수학)', sc.length?sc.slice(-3).reverse().map(function(x,i){ return '<div>'+esc2(x.d.slice(0,7).replace('-','.'))+' '+esc2(x.name)+' <b>'+x.score+'점</b>'+(i===0&&sc.length>=2?(' <span style="color:'+(x.score>=sc[sc.length-2].score?'#15803d':'#b91c1c')+';font-weight:900">'+(x.score>=sc[sc.length-2].score?'+':'')+(Math.round((x.score-sc[sc.length-2].score)*10)/10)+'</span>'):'')+'</div>'; }).join('')+(cgNoScore(st)?'<div style="color:#b45309;font-weight:800;margin-top:4px">2학기 시험 기록 없음</div>':''):'<span style="color:#b45309;font-weight:800">학교 성적 기록 없음</span><div style="'+sub+'">시험 › 학교 성적에서 넣어 주세요</div>');
  h+=tile('📝 주간테스트 최근 3회', wk.length?wk.map(function(x){ return '<div>'+esc2(x.date)+' <b>'+x.score+'점</b></div>'; }).join(''):'<span style="'+sub+'">기록 없음</span>');
  var sig=[]; try{ sig=riskOf(st)||[]; }catch(e){}
  h+=tile('🚨 지금 걸린 신호', sig.length?sig.map(function(x){ return '<div style="color:'+(x.sev===2?'#b91c1c':'#b45309')+';font-weight:800">'+(x.sev===2?'🔴 ':'🟡 ')+esc2(x.t)+'</div>'; }).join(''):'<span style="color:#15803d;font-weight:800">없음</span>');
  h+='</div><div style="'+sub+';margin-top:10px">학생·학부모에게는 보이지 않는 화면이에요. 문자는 자동으로 보내지 않아요.</div>';
  return h+'</div></div>';
}

/* ── ② 화면 감싸기 ── */
window.cgTab=function(k){ CG.tab=k; render(); };
if(typeof rRisk==='function') rRisk=(function(o){ return function(){
  cgKick();
  var wins=[]; try{ wins=cgWins(); }catch(e){}
  var noSc=0; try{ noSc=getSortedStudents().filter(function(s){ return s&&!s.withdrawn&&cgNoScore(s); }).length; }catch(e){}
  var tabs='<div class="cg-tabs" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px">'
    +['risk','win'].map(function(k){ var on=CG.tab===k; return '<button type="button" onclick="cgTab(\''+k+'\')" style="border:0;border-radius:10px;padding:8px 14px;font-weight:900;font-family:inherit;cursor:pointer;background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':'#64748b')+'">'+(k==='risk'?'🚨 위험 신호':'🎉 성과 알림 '+wins.length)+'</button>'; }).join('')
    +'<span style="font-size:12px;color:#64748b;font-weight:800;margin-left:6px">🏫 2학기 학교 성적 기록 없는 중·고생 <b style="color:#b45309">'+noSc+'명</b></span>'
    +'<span style="margin-left:auto;font-size:11px;color:#94a3b8;font-weight:700">원장님 전용 · 자동 문자 없음'+(CG.busy?' · 🔄 레이스·플래너 순위 불러오는 중':'')+'</span></div>';
  var h;
  if(CG.tab==='win') h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%"><div style="font-size:21px;font-weight:900;color:#0d2240;margin-bottom:10px">🎉 성과 알림</div>'+tabs+cgWinsPage()+'</div>';
  else {
    h=o.apply(this, arguments);
    var a='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
    if(h.indexOf(a)===0){ var e=h.indexOf('</div></div>', a.length); if(e>0) h=h.slice(0,e+12)+tabs+h.slice(e+12); else h=a+tabs+h.slice(a.length); }
    /* 학생 카드 이름 뒤 📞 브리핑 */
    getSortedStudents().forEach(function(s){ if(!s||!s.name) return; var k='<b style="font-size:15px;color:#0d2240">'+esc2(s.name)+'</b>'; if(h.indexOf(k)>=0) h=h.split(k).join(k+'<button type="button" class="cg-bb" onclick="event.stopPropagation();cgBrief(\''+esc2(s.id)+'\')" style="border:0;border-radius:8px;padding:3px 8px;margin-left:4px;font-size:11px;font-weight:900;background:#0d2240;color:#fff;cursor:pointer;font-family:inherit">📞 브리핑</button>'); });
    h=h.replace('기준 — 채점 끊김','기준 — 🆕 정답률 저하: 최근 2주 15문항 이상 70% 미만(🔴) · 🆕 플래너 끊김: 7일 넘게 없음(🔴) · 🆕 많이 푸는데 많이 틀림: 레이스 같은 학년 4명 이상에서 푼 문항 중앙값 이상 · 정답률 하위 25% · 🆕 주간 점수 0: 이번 달 주간계획·순공 0점 · 채점 끊김');
  }
  if(CG.brief){ var st=getSortedStudents().filter(function(s){ return s&&s.id===CG.brief; })[0]; if(st){ try{ h+=cgBriefHtml(st); }catch(e){ console.error(e); } } else CG.brief=''; }
  return h;
}; })(rRisk);

/* ── ⑤ 홈 한 줄 ── */
if(typeof rHomeRisk==='function') rHomeRisk=(function(o){ return function(){
  var h=o.apply(this, arguments);
  try{
    cgKick();
    var n=getSortedStudents().filter(function(s){ return s&&s.lumen_rec_code&&!s.withdrawn; }).filter(function(s){ return (riskOf(s)||[]).some(function(x){ return x.sev===2; }); }).length, w=cgWins().length;
    h='<div class="cg-home" onclick="VIEW=\'risk\';CG.tab=\'risk\';render()" style="cursor:pointer;margin-top:16px;background:#0d2240;color:#fff;border-radius:14px;padding:11px 16px;display:flex;gap:14px;align-items:center;font-weight:900;flex-wrap:wrap">🚨 이번 주 챙길 학생 <span style="color:#fca5a5;font-size:18px">'+n+'</span><span onclick="event.stopPropagation();VIEW=\'risk\';CG.tab=\'win\';render()">🎉 축하할 학생 <span style="color:#facc15;font-size:18px">'+w+'</span></span><span style="margin-left:auto;font-size:11px;opacity:.7">원장님만 보는 화면 ›</span></div>'+h;
  }catch(e){}
  return h;
}; })(rHomeRisk);
