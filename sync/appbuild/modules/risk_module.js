/* ═══════════════════════════════════════════════════════════════════
 * v19-43: 💡 아하노트 ↔ 매쓰플랫 정오답 연동 (AHX) + 🚨 위험 신호 한 화면 (RISK)
 * 원장 지시 2026-09-24 「1번(아하노트 ↔ 정오답 연동). 흩어진 위험 신호 세 곳을 한 화면으로 모으는 것도 필요」
 *
 *  AHX — 교재 아하노트(교재·쪽·번호)를 매쓰플랫 «문항 id»로 바꿔 채점 기록과 잇는다
 *    ① lumen_store mf_bookbank_index (sync/mf_textbook_bank.js --assigned) 에서 노트의 교재 이름과 가장 가까운 교재를 찾고
 *    ② 그 교재 은행(mf_textbook_<id>)에서 쪽·번호가 같은 문항 id 를 찾은 뒤
 *    ③ mf_answer_records 에서 그 학생·그 문항의 결과(O/X·날짜)와, 노트 뒤 같은 유형(concept_id)의 결과를 읽는다.
 *    학습지 노트는 이미 n.mf 에 결과가 있어 손대지 않는다. 읽기만 한다 — 아무것도 저장하지 않는다.
 *  RISK — 이미 있는 신호를 한 화면에: 최근 2주 채점 없음·정답률 하락(유형 성취도), 플래너 이틀 미제출(등록부),
 *    진도 경고(진도 현황 bpStudentRow), 주간테스트 급락(_wkHistOf), 질문했던 유형 또 틀림(AHX). 새로 세는 것은 없다.
 *  ※ 문자열 연결만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var AHX={ loading:false, loaded:false, idx:null, banks:{}, byNote:{}, byCode:{}, err:'', nBook:0, nLinked:0, nRec:0 };
/* 교재 이름 맞추기 — 학생앱에서 고른 「RPM 중1-1」과 매쓰플랫의 「RPM - 중등수학1(상)」이 같은 책이다 */
function ahxTitleKey(s){
  return String(s||'').toLowerCase().replace(/교과서_/,'').replace(/\(20\d\d\)/g,'')
    .replace(/중(\d)\s*-\s*1/g,'중등수학$1상').replace(/중(\d)\s*-\s*2/g,'중등수학$1하').replace(/초(\d)\s*-\s*([12])/g,'초등수학$1$2')
    .replace(/중등수학(\d)\(상\)/g,'중등수학$1상').replace(/중등수학(\d)\(하\)/g,'중등수학$1하').replace(/초등수학(\d)-(\d)/g,'초등수학$1$2')
    .replace(/\d+\s*[~\-]\s*\d+\s*p.*$/i,'').replace(/\bp\.?\s*\d+.*$/i,'').replace(/[\s\-–—_·,.:()\[\]~+]/g,'');
}
/* 문항 번호 맞추기: 「9-①」「9.(1)」「9-1」「9(1)」 → 9-1 */
function ahxNoKey(s){
  var t=String(s||'').replace(/[①②③④⑤⑥⑦⑧⑨]/g,function(m){ return '-'+('①②③④⑤⑥⑦⑧⑨'.indexOf(m)+1); })
    .replace(/[\s번문제]/g,'').replace(/[.(]/g,'-').replace(/[)]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'').replace(/^0+(\d)/,'$1');
  return t;
}
function ahxBidFor(name){
  var idx=AHX.idx||{}; var k=ahxTitleKey(name); if(!k) return null; var best=null, bs=0;
  Object.keys(idx).forEach(function(bid){ var t=ahxTitleKey(idx[bid].title); if(!t) return; var s=(t===k)?1:((t.indexOf(k)>=0||k.indexOf(t)>=0)?0.8:eaDice(eaGrams(k),eaGrams(t))); if(s>bs){ bs=s; best=bid; } });
  return bs>=0.45?best:null;
}
function ahxSb(){ try{ return getSupaClient(); }catch(e){ return null; } }
/* 서버가 늦으면 그 학생만 건너뛴다 — 화면이 「확인 중…」에 영영 머물지 않게 */
function ahxRace(p, ms){ return Promise.race([p, new Promise(function(res){ setTimeout(function(){ res({ data:[], timeout:true }); }, ms||20000); })]); }
function ahxVal(v){ if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } return v; }
function ahxLoad(force){
  if(AHX.loading) return Promise.resolve(); if(AHX.loaded&&!force) return Promise.resolve();
  var sb=ahxSb(); if(!sb||!ahaNotes){ return Promise.resolve(); }
  AHX.loading=true;
  var since=new Date(Date.now()-180*86400000).toISOString();
  var notes=(ahaNotes||[]).filter(function(n){ return n.source_type==='book' && !n.mf && n.source_name && n.page && n.problem_no && String(n.created_at||'')>=since; });
  AHX.nBook=notes.length;
  return ahxRace(sb.from('lumen_store').select('value').eq('key','mf_bookbank_index'),30000).then(function(r){
    AHX.idx=ahxVal(r.data&&r.data[0]&&r.data[0].value)||{};
    var need={}; notes.forEach(function(n){ var b=ahxBidFor(n.source_name); if(b){ n._bid=b; need[b]=1; } });
    var bids=Object.keys(need).filter(function(b){ return !AHX.banks[b]; });
    if(!bids.length) return;
    return ahxRace(sb.from('lumen_store').select('key,value').in('key',bids.map(function(b){ return 'mf_textbook_'+b; })),45000).then(function(r2){
      (r2.data||[]).forEach(function(row){ var v=ahxVal(row.value); if(v) AHX.banks[String(row.key).replace('mf_textbook_','')]=v; });
    });
  }).then(function(){
    /* 노트 → 문항 id */
    var byCode={};
    notes.forEach(function(n){ var bank=n._bid?AHX.banks[n._bid]:null; if(!bank) return; var pg=String(n.page).replace(/[^\d]/g,''), nk=ahxNoKey(n.problem_no);
      var hit=(bank.problems||[]).filter(function(p){ return String(p.page)===pg && ahxNoKey(p.no)===nk; })[0];
      if(!hit) return; n._pid=hit.id; n._cid=hit.cid||null; (byCode[n.student_code]=byCode[n.student_code]||[]).push(n); });
    AHX.nLinked=0; Object.keys(byCode).forEach(function(c){ AHX.nLinked+=byCode[c].length; });
    /* 학생별로 두 번 묻는다: ① 그 문항들의 결과 ② 노트 뒤 같은 유형의 결과 */
    var codes=Object.keys(byCode);
    return codes.reduce(function(chain,code){ return chain.then(function(){
      var ns=byCode[code]; var pids=ns.map(function(n){ return n._pid; }); var cids=ns.map(function(n){ return n._cid; }).filter(function(x){ return x; });
      var minDate=ns.map(function(n){ return String(n.created_at).slice(0,10); }).sort()[0];
      return ahxRace(sb.from('mf_answer_records').select('workbook_problem_id,result,score_datetime,concept_id').eq('lumen_rec_code',code).in('workbook_problem_id',pids).limit(500)).then(function(r1){
        if(r1&&r1.timeout){ AHX.byCode[code]={ linked:ns.length, again:[], timeout:true }; return; }
        var recs=(r1.data||[]); var byPid={}; recs.forEach(function(x){ var k=String(x.workbook_problem_id); if(!byPid[k]||String(x.score_datetime)>String(byPid[k].score_datetime)) byPid[k]=x; });
        var q2=cids.length?ahxRace(sb.from('mf_answer_records').select('concept_id,result,score_datetime,workbook_problem_id').eq('lumen_rec_code',code).in('concept_id',cids).gte('score_datetime',minDate).limit(2000)):Promise.resolve({data:[]});
        return q2.then(function(r2){ var later=r2.data||[]; AHX.nRec+=recs.length+later.length;
          var agains=[];
          ns.forEach(function(n){ var rec=byPid[String(n._pid)]||null; var d0=String(n.created_at).slice(0,10);
            var mine=later.filter(function(x){ return String(x.concept_id)===String(n._cid) && String(x.score_datetime).slice(0,10)>d0 && String(x.workbook_problem_id||'')!==String(n._pid); });
            var ln=mine.length, lo=mine.filter(function(x){ return x.result==='O'||x.result==='CORRECT'; }).length;
            var res=rec?((rec.result==='O'||rec.result==='CORRECT')?'O':((rec.result==='X'||rec.result==='WRONG')?'X':'?')):null;
            var again=!!(ln>=1 && (ln-lo)>=1 && (res==='X'||ln>=3&&lo/ln<0.6));
            AHX.byNote[n.id]={ pid:n._pid, cid:n._cid, res:res, when:rec?String(rec.score_datetime).slice(0,10):'', ln:ln, lo:lo, again:again, bid:n._bid };
            if(again) agains.push(n); });
          AHX.byCode[code]={ linked:ns.length, again:agains };
        });
      });
    }); }, Promise.resolve());
  }).then(function(){ AHX.loaded=true; AHX.loading=false; if(VIEW==='aha'||VIEW==='risk') render(); },function(e){ AHX.err=String((e&&e.message)||e); AHX.loaded=true; AHX.loading=false; console.warn('[아하↔정오답]',AHX.err); if(VIEW==='risk') render(); });
}
/* 노트 카드 한 줄 */
function ahxLine(n){
  if(!n||n.source_type!=='book'||n.mf) return '';
  var base='font-size:10.5px;font-weight:700;margin-top:3px;padding:2px 6px;border-radius:5px;display:inline-block;';
  if(!AHX.loaded) return AHX.loading?'<div style="'+base+'color:#94a3b8">매쓰플랫 채점 확인 중…</div>':'';
  var r=AHX.byNote[n.id]; if(!r) return '<div style="'+base+'color:#94a3b8;background:#f8fafc">매쓰플랫: 이 문제의 채점 기록 없음</div>';
  var h='매쓰플랫: 이 문제 '+(r.res==='X'?'<b style="color:#dc2626">✗ 틀림</b>':(r.res==='O'?'<b style="color:#16a34a">✓ 맞음</b>':'<b style="color:#b45309">아직 채점 안 됨</b>'))+(r.when?(' <span style="color:#94a3b8">'+esc2(r.when.slice(5).replace('-','/'))+'</span>'):'');
  if(r.ln) h+=' → 그 뒤 같은 유형 '+r.ln+'문제 중 <b>'+r.lo+'</b> 맞음'+(r.again?' <b style="color:#dc2626">⚠ 또 틀림</b>':' <b style="color:#16a34a">✅</b>');
  else h+=' <span style="color:#94a3b8">· 그 뒤 같은 유형 기록 아직 없음</span>';
  return '<div style="'+base+'color:#334155;background:'+(r.again?'#fef2f2':'#f8fafc')+';border:1px solid '+(r.again?'#fecaca':'#e6eaf1')+'">'+h+'</div>';
}

/* ═══ 🚨 위험 신호 ═══ */
var RISK={ kicked:false, filter:'', grp:'' };
function riskKick(){
  if(RISK.kicked) return; RISK.kicked=true;
  try{ tqLoad().then(function(){ if(VIEW==='risk') render(); }); }catch(e){}
  try{ bpLoad().then(function(){ if(VIEW==='risk') render(); }); }catch(e){}
  try{ wkLoad().then(function(){ if(VIEW==='risk') render(); }); }catch(e){}
  try{ if(ahaNotes===null) ahaLoad(); else ahxLoad(); }catch(e){}
}
function riskKst(d){ var t=new Date((d||Date.now())+9*3600000); return t.toISOString().slice(0,10); }
/* 유형 성취도는 2주 단위 묶음이라, 새 기간이 막 시작된 며칠은 거의 비어 있다.
 * 그래서 «최근» = 진행 중인 기간이 14일 미만이면 그 앞 기간까지 합친 것, «직전» = 그 앞. 채점 끊김은 진도 현황(날짜 단위)이 있으면 그것을 먼저 믿는다 */
function riskTq(code){
  var S=(typeof tqStu==='function')?tqStu(code):null; if(!S) return null;
  var periods=((window.MF_TYPE_ACH&&MF_TYPE_ACH.periods)||[]).slice().sort(); var ps=Object.keys(S).sort(); if(!ps.length&&!periods.length) return null;
  var all=periods.length?periods:ps; var cur=all[all.length-1]; var curDays=Math.floor((Date.now()-Date.parse(cur+'T00:00:00+09:00'))/86400000);
  function sum(list){ var n=0,o=0; list.forEach(function(p){ Object.keys(S[p]||{}).forEach(function(c){ var a=S[p][c]||[]; n+=a[0]||0; o+=a[1]||0; }); }); return {n:n,o:o}; }
  var partial=curDays<14; var recentP=partial?all.slice(-2):all.slice(-1); var prevP=partial?all.slice(-3,-2):all.slice(-2,-1);
  var A=sum(recentP), B=sum(prevP); var lastHas=ps[ps.length-1]||'';
  return { recentP:recentP, prevP:prevP, lastHas:lastHas, gapPeriods:all.filter(function(p){ return p>lastHas; }).length, n:A.n, o:A.o, rate:A.n?Math.round(A.o/A.n*100):null, pn:B.n, po:B.o, prate:B.n?Math.round(B.o/B.n*100):null };
}
function riskLastScore(st){
  try{ if(typeof BP==='undefined'||!BP.loaded) return null; var sid=bpSidOf(st); if(sid==null) return null; var books=BP.prog[sid]||{}; var best=null;
    Object.keys(books).forEach(function(b){ var d=books[b]&&books[b].lastDate; if(d&&(!best||String(d)>best)) best=String(d).slice(0,10); }); return best; }catch(e){ return null; }
}
function riskOf(st){
  var code=String(st.lumen_rec_code||''), out=[];
  /* ① 유형 성취도(매쓰플랫 채점 2주 단위) */
  var t=riskTq(code); var lastDay=riskLastScore(st);
  if(lastDay){ var ago=Math.floor((Date.now()-Date.parse(lastDay+'T00:00:00+09:00'))/86400000);
    if(ago>=14) out.push({ k:'stop', sev:2, t:'채점 끊김 '+ago+'일', d:'마지막 채점 '+lastDay.slice(5).replace('-','/'), go:'bookprog' });
    else if(ago>=7) out.push({ k:'stop', sev:1, t:ago+'일째 채점 없음', d:'마지막 채점 '+lastDay.slice(5).replace('-','/'), go:'bookprog' }); }
  else if(t){ if(t.gapPeriods>=1 && t.n===0) out.push({ k:'stop', sev:2, t:'채점 끊김 (2주 넘게)', d:'마지막 기록 기간 '+t.lastHas, go:'bookdash' }); }
  else out.push({ k:'stop', sev:1, t:'매쓰플랫 채점 기록 없음', d:'유형 성취도에 이 학생이 없어요', go:'bookdash' });
  if(t){
    if(t.n>=10&&t.pn>=10&&t.rate!=null&&t.prate!=null&&t.rate<=t.prate-15) out.push({ k:'drop', sev:2, t:'정답률 하락 '+t.prate+'% → '+t.rate+'%', d:'직전 '+t.pn+'문항 → 최근 '+t.n+'문항 (유형 성취도 2주 묶음)', go:'typeach' });
    else if(t.n>=15&&t.rate!=null&&t.rate<60) out.push({ k:'low', sev:1, t:'정답률 '+t.rate+'%', d:'최근 '+t.n+'문항 — 난도가 안 맞을 수 있어요', go:'typeach' });
  }
  /* ② 플래너 이틀 연속 미제출 (어제·그제) */
  try{ var pl=st.lumen_planner||{}; var d1=riskKst(Date.now()-86400000), d2=riskKst(Date.now()-2*86400000), d3=riskKst(Date.now()-3*86400000); var none=[d1,d2,d3].every(function(ds){ var v=pl[ds]; return v===undefined||v===null; });   /* 2026-09-25 원장: 연휴가 끼면 이틀은 흔하다 → 사흘 */ var d14=riskKst(Date.now()-14*86400000); var recent=Object.keys(pl).some(function(ds){ return ds>=d14 && pl[ds]!=null; });
    if(recent&&none) out.push({ k:'plan', sev:1, t:'플래너 사흘 연속 안 올림', d:d3.slice(5)+'~'+d1.slice(5), go:'lgall' }); }catch(e){}
  /* ③ 진도 현황 경고 */
  try{ if(typeof BP!=='undefined'&&BP.loaded){ var row=bpStudentRow(st); if(row&&!row.none&&(row.status==='r'||row.status==='y')) out.push({ k:'prog', sev:row.status==='r'?2:1, t:'진도 · '+row.why, d:(row.md&&row.md.title)?bpShortBook(row.md.title):'', go:'bookprog' }); } }catch(e){}
  /* ④ 주간테스트 급락 */
  try{ if(typeof WK!=='undefined'&&WK.loaded){ var sid=_wkSidByName()[String(st.name||'').trim()]; var hist=(sid!==undefined)?_wkHistOf(sid):[]; if(hist.length>=2&&hist[0].score!=null&&hist[1].score!=null&&hist[0].score<=hist[1].score-20) out.push({ k:'wk', sev:2, t:'주간테스트 급락 '+hist[1].score+' → '+hist[0].score, d:String(hist[0].date||''), go:'wktab' }); } }catch(e){}
  /* ⑤ 질문했던 유형 또 틀림 */
  try{ var ax=AHX.byCode[code]; if(ax&&ax.again.length) out.push({ k:'aha', sev:2, t:'질문했던 유형 또 틀림 '+ax.again.length+'건', d:ax.again.slice(0,2).map(function(n){ return ahaSourceName(n)+' p'+n.page+' #'+n.problem_no; }).join(' · '), go:'aha' }); }catch(e){}
  return out;
}
var RISK_NAMES={ stop:'채점 끊김', drop:'정답률 하락', low:'정답률 낮음', plan:'플래너', prog:'진도', wk:'주간테스트', aha:'질문 후 또 틀림' };
window.riskGo=function(v){ VIEW=v; render(); };
window.riskFilter=function(k){ RISK.filter=(RISK.filter===k?'':k); render(); };
window.riskGrp=function(g){ RISK.grp=(RISK.grp===g?'':g); render(); };
function rRisk(){
  riskKick();
  var stus=getSortedStudents().filter(function(s){ return s&&s.lumen_rec_code&&!s.withdrawn; });
  var rows=stus.map(function(s){ var sig=riskOf(s); var score=0; sig.forEach(function(x){ score+=x.sev; }); return { st:s, sig:sig, score:score }; });
  rows.sort(function(a,b){ return b.score-a.score || a.st.name.localeCompare(b.st.name); });
  var counts={}; rows.forEach(function(r){ r.sig.forEach(function(x){ counts[x.k]=(counts[x.k]||0)+1; }); });
  var groups=[]; stus.forEach(function(s){ var g=s.group||'미배정'; if(groups.indexOf(g)<0) groups.push(g); });
  var shown=rows.filter(function(r){ if(RISK.grp&&(r.st.group||'미배정')!==RISK.grp) return false; if(RISK.filter&&!r.sig.some(function(x){ return x.k===RISK.filter; })) return false; return true; });
  var flagged=shown.filter(function(r){ return r.sig.length; }), clean=shown.filter(function(r){ return !r.sig.length; });
  var loading=[]; if(typeof BP!=='undefined'&&!BP.loaded) loading.push('진도'); if(typeof WK!=='undefined'&&!WK.loaded) loading.push('주간테스트'); if(!(window.MF_TYPE_ACH)) loading.push('유형 성취도'); if(!AHX.loaded) loading.push('아하노트 채점');
  var h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:21px;font-weight:900;color:#0d2240;letter-spacing:-.02em">🚨 위험 신호</div>'
    +'<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:2px">리그 한눈에 · 진도 현황 · 주간테스트 · 시험 대비에 흩어져 있던 신호를 한 화면에 — 새로 세는 것은 없고, 각 신호를 누르면 그 화면으로 갑니다</div></div>'
    +'<div style="margin-left:auto;font-size:11px;color:#94a3b8;font-weight:700">'+(loading.length?('🔄 '+loading.join('·')+' 불러오는 중'):('오늘 '+riskKst().slice(5).replace('-','/')+' 기준'))+'</div></div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">'+Object.keys(RISK_NAMES).map(function(k){ var n=counts[k]||0; var on=RISK.filter===k; return '<button onclick="riskFilter(\''+k+'\')" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px 11px;border-radius:20px;cursor:pointer;border:1.5px solid '+(on?'#0d2240':'#e6eaf1')+';background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':(n?'#0d2240':'#94a3b8'))+'">'+RISK_NAMES[k]+' '+n+'</button>'; }).join('')
    +'<span style="width:1px;background:#dbe2ec;margin:0 4px"></span>'+groups.map(function(g){ var on=RISK.grp===g; return '<button onclick="riskGrp(\''+esc2(g).replace(/'/g,"\\'")+'\')" style="font-family:inherit;font-size:11.5px;font-weight:800;padding:6px 10px;border-radius:20px;cursor:pointer;border:1.5px solid '+(on?'#0d2240':'#e6eaf1')+';background:'+(on?'#0d2240':'#fff')+';color:'+(on?'#fff':'#475569')+'">'+esc2(g)+'</button>'; }).join('')+'</div>';
  if(!flagged.length) h+='<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:24px;text-align:center;color:#16a34a;font-weight:900">✅ 지금 걸리는 학생이 없습니다</div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px">';
  flagged.forEach(function(r){ var s=r.st; var red=r.sig.some(function(x){ return x.sev===2; });
    h+='<div style="background:#fff;border:1.5px solid '+(red?'#fca5a5':'#fde68a')+';border-radius:14px;padding:12px 14px"><div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px"><b style="font-size:15px;color:#0d2240">'+esc2(s.name)+'</b><span style="font-size:11px;color:#64748b;font-weight:700">'+esc2(s.group||'미배정')+' · '+esc2(String(s.grade||'').replace('학교',''))+'</span><span style="margin-left:auto;font-size:11px;font-weight:900;color:'+(red?'#dc2626':'#b45309')+'">'+r.sig.length+'개</span></div>';
    r.sig.sort(function(a,b){ return b.sev-a.sev; }).forEach(function(x){ h+='<div onclick="riskGo(\''+x.go+'\')" style="cursor:pointer;display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:8px;margin:3px 0;background:'+(x.sev===2?'#fef2f2':'#fffbeb')+'"><span style="font-size:12.5px;font-weight:900;color:'+(x.sev===2?'#b91c1c':'#b45309')+';white-space:nowrap">'+(x.sev===2?'🔴':'🟡')+' '+esc2(x.t)+'</span><span style="font-size:11px;color:#64748b;font-weight:700;line-height:1.4">'+esc2(x.d||'')+'</span><span style="margin-left:auto;font-size:10.5px;color:#94a3b8;font-weight:800;white-space:nowrap">'+esc2(RISK_NAMES[x.k])+' ›</span></div>'; });
    h+='</div>'; });
  h+='</div>';
  if(clean.length) h+='<div style="margin-top:14px;font-size:12px;color:#64748b;font-weight:700">✅ 이상 없음 '+clean.length+'명 — '+clean.map(function(r){ return esc2(r.st.name); }).join(' · ')+'</div>';
  h+='<div style="margin-top:12px;font-size:11px;color:#94a3b8;font-weight:700;line-height:1.7">기준 — 채점 끊김: 진도 현황의 마지막 채점일이 14일 이상(7일이면 🟡) · 정답률 하락: 유형 성취도 2주 묶음에서 직전보다 15%p 이상 (둘 다 10문항 이상, 새 기간이 14일 안 됐으면 앞 기간과 합쳐 봄) · 정답률 낮음: 최근 15문항 이상인데 60% 미만 · 플래너: 최근 2주 안에 올린 학생이 사흘 연속 미제출 · 진도: 진도 현황의 🔴🟡 그대로 · 주간테스트: 직전보다 20점 이상 하락 · 질문 후 또 틀림: 교재 아하노트를 매쓰플랫 채점과 이어 그 뒤 같은 유형을 또 틀린 것'
    +(AHX.loaded?(' (교재 노트 '+AHX.nBook+'건 중 '+AHX.nLinked+'건 연결)'):'')+'</div>';
  return h+'</div>';
}
