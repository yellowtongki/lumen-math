/* ═══════════════════════════════════════════════════════════════════
 * v2-137: 🧠 루멘 수학퀴즈 (학생앱) — 원장 승인 시안 docs/mockup_char_lesson_px2.html
 *   (원장이 「캐릭터 수업 · 개념 나들이」 → 「루멘 수학퀴즈」로 이름을 바꿈)
 *   ① 홈 카드 · 📚 공부 탭 줄 → 화면 screen-mq: 캐릭터 셋 · 내 학년 코스(학원앱에서 «발행»한 퀴즈만) · 진행 표시 · 🍙 낱말 Day · 내가 담은 아하 포인트
 *   ② screen-mq-play: 말풍선이 «다음»을 누를 때마다 한 줄씩 · 캐릭터 표정 · **강조** · 🔊(기기 음성 ko-KR) · 개념 카드 · 문제(바로 채점) · 아하 💡 · 아하 포인트 「📒 담기」
 *      한 줄 볼 때마다 lumen_store quizlog_<내 코드> { byQuiz:{ <퀴즈>:{ step, done, startAt, doneAt, ans:{줄:{pick,ok}}, saved } } } — 다시 열면 이어서
 *      「📒 아하노트에 담기」: IB아하노트(aha_notes)는 활동지 사진이 꼭 있어야 하고 리그 점수·선생님 답변 대기로 이어져서 넣지 않는다
 *       → quizlog 에 saved:true(+ 담은 글) 만 남기고 「담았어요」, 목록 화면 「📒 내가 담은 아하 포인트」에서 다시 본다.
 *   ③ screen-mq-words 🍙 수학 낱말 Day: quiz_words_<학년> · 학년 탭 · Day 칩 · 낱말 카드(한자 풀이 · 캐릭터 한마디 · 예문)
 *      «알아요/헷갈려요» → wordlog_<내 코드> { known:{낱말:시각}, confused:{낱말:시각} } · 헷갈린 낱말은 다음 날 「🔁 다시 볼 낱말」로 돌아온다
 *   ※ 교재 문제 그림은 절대 보여 주지 않는다(재료 mats 는 읽지도 그리지도 않음). ES5 · 템플릿 리터럴 금지.
 * ═══════════════════════════════════════════════════════════════════ */
var MQS = { idx:null, idxAt:0, idxBusy:false, log:null, logCode:'', docs:{}, curId:'', cur:null, view:0, fin:false, auto:false, grade:'', saving:false, again:false,
  wGrades:null, wGrade:'', words:{}, wlog:null, wlogCode:'', wDay:-1, fakeNow:null };
function mqsNow(){ return MQS.fakeNow ? new Date(MQS.fakeNow) : new Date(); }
function mqsIso(){ return mqsNow().toISOString(); }
function mqsDay(d){ var x=d?new Date(d):mqsNow(); if(isNaN(x)) return ''; return x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2); }
function mqsCode(){ try{ return (typeof studentInfo!=='undefined'&&studentInfo)?String(studentInfo.lumen_rec_code||''):''; }catch(e){ return ''; } }
function mqsSb(){ try{ if(typeof sb!=='undefined'&&sb) return sb; }catch(e){} return window.sb||null; }
function mqsTest(){ try{ return typeof isTest!=='undefined'&&!!isTest; }catch(e){ return false; } }
function mqsE(s){ return MQR.esc(s); }
function mqsToast(m){
  try{ var el=document.getElementById('mqs-toast'); if(!el){ el=document.createElement('div'); el.id='mqs-toast'; el.className='mqs-toast'; el.setAttribute('role','status'); document.body.appendChild(el); }
    el.textContent=m; el.classList.add('show'); clearTimeout(MQS._tt); MQS._tt=setTimeout(function(){ el.classList.remove('show'); }, 2600); }catch(e){}
}
function mqsKv(k){
  var s=mqsSb(); if(!s) return Promise.resolve(null);
  return Promise.resolve(s.from('lumen_store').select('key,value').eq('key',k)).then(function(r){ var v=(r&&r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } return v; }).catch(function(){ return null; });
}
function mqsKvSet(k, v){
  if(mqsTest()) return Promise.resolve(false);
  var s=mqsSb(); if(!s) return Promise.resolve(false);
  return Promise.resolve(s.from('lumen_store').upsert({ key:k, value:v, updated_at:mqsIso() }, { onConflict:'key' })).then(function(r){ return !(r&&r.error); }).catch(function(){ return false; });
}
function mqsMyGrade(){ try{ return MQR.myGrade(studentInfo&&studentInfo.grade, mqsNow()); }catch(e){ return ''; } }
function mqsOn(){ try{ return !window.sfOn || sfOn('mathquiz'); }catch(e){ return true; } }

/* ── 불러오기 ── */
function mqsLoadIdx(force){
  if(MQS.idx && !force && Date.now()-MQS.idxAt<120000) return Promise.resolve(MQS.idx);
  return mqsKv('quiz_index').then(function(v){ MQS.idx=(v&&Array.isArray(v.items))?v:{ items:[] }; MQS.idxAt=Date.now(); return MQS.idx; });
}
function mqsLoadLog(){
  var c=mqsCode(); if(MQS.log && MQS.logCode===c) return Promise.resolve(MQS.log);
  return mqsKv('quizlog_'+c).then(function(v){ MQS.log=(v&&v.byQuiz)?v:{ byQuiz:{} }; MQS.logCode=c; return MQS.log; });
}
function mqsPubs(grade){ return ((MQS.idx&&MQS.idx.items)||[]).filter(function(x){ return x && x.status==='pub' && (!grade || x.grade===grade); }).sort(function(a,b){ return MQR.unitRank(a.unit)-MQR.unitRank(b.unit) || String(a.pubAt||'').localeCompare(String(b.pubAt||'')); }); }
function mqsEntry(id){ return (MQS.log&&MQS.log.byQuiz&&MQS.log.byQuiz[id])||null; }
function mqsSaveLog(){
  if(!MQS.log) return; var c=mqsCode(); if(!c) return;
  if(MQS.saving){ MQS.again=true; return; }
  MQS.saving=true; MQS.log.upd=mqsIso();
  mqsKvSet('quizlog_'+c, MQS.log).then(function(){ MQS.saving=false; if(MQS.again){ MQS.again=false; mqsSaveLog(); } });
}

/* ── 🏠 홈 카드 ── */
window.mqHomeUpdate=function(){
  var el=document.getElementById('mq-home'); if(!el) return;
  var av=document.getElementById('mq-home-av'); if(av && !av.firstChild) av.innerHTML=MQR.img('lumi','base','head')+MQR.img('aha','aha','head')+MQR.img('ssam','base','head');
  if(!mqsOn()){ el.style.display='none'; return; } el.style.display='';
  var sub=document.getElementById('mq-home-sub');
  Promise.all([mqsLoadIdx(), mqsLoadLog()]).then(function(){
    var g=mqsMyGrade(), ps=mqsPubs(g), left=ps.filter(function(it){ var e=mqsEntry(it.id); return !(e&&e.done); }).length;
    if(sub) sub.textContent=ps.length?(left?('새 퀴즈 '+left+'개 · 대화로 개념 잡기'):('퀴즈 '+ps.length+'개 다 봤어요 ✓ · 🍙 낱말 Day')):'대화로 개념 잡기 · 🍙 수학 낱말 Day';
    var b=document.getElementById('mq-home-n'); if(b){ b.textContent=left?String(left):''; b.style.display=left?'':'none'; }
  });
};

/* ── 📚 목록 ── */
window.mqsInit=function(){
  if(!mqsOn()){ go('screen-home'); return; }
  mqsCss(); if(!MQS.grade) MQS.grade=mqsMyGrade();
  var body=document.getElementById('mqs-body'); if(body && !MQS.idx) body.innerHTML='<div class="sp3-empty"><div class="e1">⏳</div><div class="e2">불러오는 중...</div></div>';
  Promise.all([mqsLoadIdx(true), mqsLoadLog()]).then(mqsListPaint);
};
window.mqsGrade=function(g){ MQS.grade=g; mqsListPaint(); };
function mqsListPaint(){
  var body=document.getElementById('mqs-body'); if(!body) return;
  var my=mqsMyGrade(), gk=String(my||'').split('-')[0], g=MQS.grade||my, h=MQR.cast(78);
  if(gk){ h+='<div class="mqs-tabs">'; [gk+'-1', gk+'-2'].forEach(function(x){ var n=mqsPubs(x).length; h+='<button type="button" class="'+(x===g?'on':'')+'" onclick="mqsGrade(\''+x+'\')">'+x+(n?' <small>'+n+'</small>':'')+'</button>'; }); h+='</div>'; }
  var ps=mqsPubs(g);
  h+='<div class="mqs-ttl">📚 '+mqsE(g||'우리 학년')+' 퀴즈 코스 <small>· 학교 교과서 단원 순서</small></div>';
  if(!ps.length) h+='<div class="mqs-empty">아직 나온 퀴즈가 없어요.<br>원장님이 곧 올려 주실 거예요! 그동안 🍙 낱말 Day 어때요?</div>';
  ps.forEach(function(it){
    var e=mqsEntry(it.id), n=Number(it.n)||0, st;
    if(e&&e.done){ var qa=0, qo=0; Object.keys(e.ans||{}).forEach(function(k){ qa++; if(e.ans[k].ok) qo++; }); st='<span class="st ok">✓ 끝'+(qa?' · '+qo+'/'+qa:'')+'</span>'; }
    else if(e) st='<span class="st now">'+Math.min(n, (e.step||0)+1)+'/'+n+' 진행 중</span>';
    else st='<span class="st">'+n+'장</span>';
    h+='<button type="button" class="mqs-unit'+(e&&!e.done?' cur':'')+'" data-id="'+mqsE(it.id)+'" onclick="mqsOpen(\''+mqsE(it.id)+'\')"><b>'+mqsE(it.unit||'')+'</b><span class="t">'+mqsE(it.title||'')+'</span>'+st+'</button>';
  });
  h+='<div class="mqs-note">한 퀴즈는 대화 몇 줄 · 문제 1~2개 · 끝까지 보면 ✓</div>';
  h+='<button type="button" class="mqs-wordbtn" onclick="go(\'screen-mq-words\')"><span class="ic">🍙</span><span><b>수학 낱말 Day</b><small>하루 10개 · 한자로 뜻 잡기 · 헷갈린 건 다음 날 다시</small></span><span class="ch">›</span></button>';
  /* 내가 담은 아하 포인트 */
  var sv=[]; Object.keys((MQS.log&&MQS.log.byQuiz)||{}).forEach(function(id){ var e=MQS.log.byQuiz[id]; if(e&&e.saved&&e.savedText) sv.push({ t:e.savedText, at:e.savedAt||'', title:e.title||'' }); });
  if(sv.length){ sv.sort(function(a,b){ return String(b.at).localeCompare(String(a.at)); });
    h+='<div class="mqs-ttl" style="margin-top:14px">📒 내가 담은 아하 포인트</div>';
    sv.forEach(function(x){ h+='<div class="mqs-saved">'+(x.title?'<small>'+mqsE(x.title)+'</small>':'')+MQR.hl(x.t)+'</div>'; }); }
  body.innerHTML=h;
}

/* ── 💬 퀴즈 보기 ── */
window.mqsOpen=function(id){
  var it=((MQS.idx&&MQS.idx.items)||[]).filter(function(x){ return x&&x.id===id; })[0];
  var go2=function(doc){
    var lines=[]; ((doc&&doc.lines)||[]).forEach(function(L){ var n=MQR.norm(L); if(n) lines.push(n); });
    if(!lines.length){ mqsToast('퀴즈를 불러오지 못했어요'); return; }
    MQS.docs[id]=doc; MQS.curId=id; MQS.cur={ id:id, title:doc.title||(it&&it.title)||'', grade:doc.grade||'', unit:doc.unit||'', lines:lines };
    var e=mqsEntry(id);
    if(!e){ e={ step:0, done:false, startAt:mqsIso(), ans:{}, saved:false, title:MQS.cur.title }; MQS.log.byQuiz[id]=e; mqsSaveLog(); }
    MQS.view=e.done?lines.length-1:Math.min(lines.length-1, e.step||0); MQS.fin=!!e.done;
    go('screen-mq-play');
  };
  mqsLoadLog().then(function(){ if(MQS.docs[id]) go2(MQS.docs[id]); else mqsKv('quiz_'+id).then(go2); });
};
window.mqsPlayInit=function(){ mqsCss(); mqsPaint(true); };
function mqsPointBtns(i){
  var e=mqsEntry(MQS.curId);
  return '<div class="mq-pbtns">'+(e&&e.saved?'<button type="button" class="done" disabled>📒 담았어요 ✓</button>':'<button type="button" id="mqs-save" onclick="mqsSavePoint('+i+')">📒 아하노트에 담기</button>')+'</div>';
}
function mqsPaint(scroll){
  var c=MQS.cur; if(!c) return; var e=mqsEntry(c.id)||{ ans:{} }, n=c.lines.length;
  var t=document.getElementById('mqs-ptitle'); if(t) t.textContent='💬 '+c.title;
  var s=document.getElementById('mqs-psub'); if(s) s.textContent=(c.grade?c.grade+' ':'')+(c.unit||'')+' · '+(MQS.view+1)+'/'+n;
  var bar=document.getElementById('mqs-prog'); if(bar) bar.style.width=Math.round((MQS.fin?1:(MQS.view+1)/n)*100)+'%';
  var chat=document.getElementById('mqs-chat'); if(!chat) return;
  var h=MQR.lines(c.lines, { upto:MQS.view, ans:e.ans||{}, pick:'mqsPick', tts:'mqsSpeak', point:mqsPointBtns });
  if(MQS.fin){
    var qa=0, qo=0; Object.keys(e.ans||{}).forEach(function(k){ qa++; if(e.ans[k].ok) qo++; });
    h+='<div class="mqs-fin" id="mqs-fin"><div class="mqs-finimg">'+MQR.img('lumi','base','full',58,77)+MQR.img('aha','aha','full',58,77)+'</div><b>🎉 끝! «'+mqsE(c.title)+'»</b><span>'+(qa?'문제 '+qo+'/'+qa+' 맞혔어요':'끝까지 봤어요')+(e.saved?' · 📒 아하 포인트 담음':'')+'</span></div>';
  }
  chat.innerHTML=h;
  var L=c.lines[MQS.view], need=(L&&L.t==='quiz'&&!(e.ans&&e.ans[MQS.view])), nb=document.getElementById('mqs-next'), au=document.getElementById('mqs-auto');
  if(au){ au.className='mqs-auto'+(MQS.auto?' on':''); au.setAttribute('aria-pressed', MQS.auto?'true':'false'); }
  if(nb){
    if(MQS.fin){ nb.textContent='목록으로'; nb.disabled=false; nb.className='mqs-next'; }
    else if(need){ nb.textContent='보기를 골라 봐요'; nb.disabled=true; nb.className='mqs-next wait'; }
    else if(MQS.view>=n-1){ nb.textContent='끝 🎉'; nb.disabled=false; nb.className='mqs-next end'; }
    else { nb.textContent='다음 ›'; nb.disabled=false; nb.className='mqs-next'; }
  }
  var rb=document.getElementById('mqs-again'); if(rb) rb.style.display=MQS.fin?'':'none';
  if(scroll){ setTimeout(function(){ try{ var last=MQS.fin?document.getElementById('mqs-fin'):chat.querySelector('[data-i="'+MQS.view+'"]'); if(last) last.scrollIntoView({ block:'end', behavior:'smooth' }); }catch(err){} }, 30); }
}
window.mqsNext=function(){
  var c=MQS.cur; if(!c) return; var e=mqsEntry(c.id), n=c.lines.length;
  if(MQS.fin){ go('screen-mq'); return; }
  var L=c.lines[MQS.view]; if(L&&L.t==='quiz'&&!(e.ans&&e.ans[MQS.view])){ mqsToast('보기를 골라 봐요'); return; }
  if(MQS.view>=n-1){
    MQS.fin=true;
    if(!e.done){ e.done=true; e.doneAt=mqsIso(); e.step=n-1; mqsSaveLog(); }
    mqsPaint(true); return;
  }
  MQS.view++;
  if(!e.done && MQS.view>(e.step||0)){ e.step=MQS.view; e.at=mqsIso(); mqsSaveLog(); }
  mqsPaint(true);
  if(MQS.auto) MQR.speak(c.lines[MQS.view]);
};
window.mqsPick=function(i, k){
  var c=MQS.cur, L=c&&c.lines[i], e=mqsEntry(MQS.curId); if(!L||!e) return;
  e.ans=e.ans||{}; if(e.ans[i]) return;
  e.ans[i]={ pick:k, ok:k===L.answer }; e.at=mqsIso(); mqsSaveLog();
  mqsPaint(false);
  try{ if(navigator.vibrate) navigator.vibrate(e.ans[i].ok?30:[40,60,40]); }catch(err){}
};
window.mqsSpeak=function(i){ var c=MQS.cur; if(!c) return; if(!MQR.speak(c.lines[i])) mqsToast('이 기기에서는 읽어 주기를 쓸 수 없어요'); };
window.mqsAutoTog=function(){ MQS.auto=!MQS.auto; try{ localStorage.setItem('mqs_auto', MQS.auto?'1':'0'); }catch(e){} mqsPaint(false); if(MQS.auto&&MQS.cur) MQR.speak(MQS.cur.lines[MQS.view]); else { try{ window.speechSynthesis.cancel(); }catch(e){} } };
window.mqsAgain=function(){ MQS.view=0; MQS.fin=false; mqsPaint(false); var ch=document.getElementById('mqs-chat'); if(ch) ch.scrollTop=0; };
window.mqsBack=function(){ try{ window.speechSynthesis.cancel(); }catch(e){} go('screen-mq'); };
window.mqsSavePoint=function(i){
  var c=MQS.cur, L=c&&c.lines[i], e=mqsEntry(MQS.curId); if(!L||!e) return;
  e.saved=true; e.savedText=String(L.text||''); e.savedAt=mqsIso(); e.title=c.title; mqsSaveLog();
  mqsPaint(false); mqsToast('📒 담았어요 — 퀴즈 목록 «내가 담은 아하 포인트»에서 다시 볼 수 있어요');
};

/* ── 🍙 수학 낱말 Day ── */
window.mqsWordsInit=function(){
  if(!mqsOn()){ go('screen-home'); return; }
  mqsCss(); var body=document.getElementById('mqs-wbody'); if(body) body.innerHTML='<div class="sp3-empty"><div class="e1">⏳</div><div class="e2">불러오는 중...</div></div>';
  var s=mqsSb(), c=mqsCode();
  var pGrades=s?Promise.resolve(s.from('lumen_store').select('key').like('key','quiz_words_%')).then(function(r){ return ((r&&r.data)||[]).map(function(x){ return String(x.key).slice(11); }).filter(Boolean); }).catch(function(){ return []; }):Promise.resolve([]);
  var pLog=(MQS.wlog&&MQS.wlogCode===c)?Promise.resolve(MQS.wlog):mqsKv('wordlog_'+c).then(function(v){ MQS.wlog={ known:(v&&v.known)||{}, confused:(v&&v.confused)||{} }; MQS.wlogCode=c; return MQS.wlog; });
  Promise.all([pGrades, pLog]).then(function(a){
    var gs=a[0].sort(), my=mqsMyGrade(); MQS.wGrades=gs;
    if(!MQS.wGrade || gs.indexOf(MQS.wGrade)<0) MQS.wGrade=(gs.indexOf(my)>=0)?my:(gs.filter(function(x){ return x.split('-')[0]===String(my).split('-')[0]; })[0]||gs[0]||my);
    MQS.wDay=-1; mqsWordsLoad(MQS.wGrade);
  });
};
function mqsWordsLoad(g){
  if(MQS.words[g]){ mqsWordsPaint(); return; }
  mqsKv('quiz_words_'+g).then(function(v){ MQS.words[g]=(v&&Array.isArray(v.days))?v:{ days:[] }; mqsWordsPaint(); });
}
window.mqsWGrade=function(g){ MQS.wGrade=g; MQS.wDay=-1; mqsWordsLoad(g); };
window.mqsWDay=function(k){ MQS.wDay=k; mqsWordsPaint(); };
function mqsMarked(w){ var L=MQS.wlog||{}; return (L.known&&L.known[w])?'known':((L.confused&&L.confused[w])?'confused':''); }
function mqsDayDone(d){ var ws=(d&&d.words)||[]; return ws.length>0 && ws.every(function(w){ return !!mqsMarked(w.w); }); }
function mqsWBtns(W){
  var m=mqsMarked(W.w);
  return '<div class="mqs-chk"><button type="button" class="'+(m==='known'?'y':'')+'" data-w="'+mqsE(W.w)+'" onclick="mqsMark(this.getAttribute(\'data-w\'),\'known\')">알아요'+(m==='known'?' ✓':'')+'</button>'
    +'<button type="button" class="'+(m==='confused'?'n':'')+'" data-w="'+mqsE(W.w)+'" onclick="mqsMark(this.getAttribute(\'data-w\'),\'confused\')">헷갈려요'+(m==='confused'?' 🔁':'')+'</button></div>';
}
function mqsWordsPaint(){
  var body=document.getElementById('mqs-wbody'); if(!body) return;
  var g=MQS.wGrade, W=MQS.words[g]||{ days:[] }, days=W.days||[], h='';
  if((MQS.wGrades||[]).length){ h+='<div class="mqs-tabs">'; MQS.wGrades.forEach(function(x){ h+='<button type="button" class="'+(x===g?'on':'')+'" onclick="mqsWGrade(\''+mqsE(x)+'\')">'+mqsE(x)+'</button>'; }); h+='</div>'; }
  if(!days.length){ body.innerHTML=h+'<div class="mqs-empty">아직 낱말이 없어요.<br>원장님이 곧 올려 주실 거예요!</div>'; return; }
  if(MQS.wDay<0||MQS.wDay>=days.length){ MQS.wDay=0; for(var k=0;k<days.length;k++){ if(!mqsDayDone(days[k])){ MQS.wDay=k; break; } } }
  h+='<div class="mqs-days">'; days.forEach(function(d, k){ h+='<button type="button" class="'+(k===MQS.wDay?'on':'')+(mqsDayDone(d)?' done':'')+'" onclick="mqsWDay('+k+')">Day '+mqsE(d.n)+'</button>'; }); h+='</div>';
  /* 🔁 어제(또는 그 전에) 헷갈린 낱말 — 다음 날 다시 */
  var today=mqsDay(), cf=(MQS.wlog&&MQS.wlog.confused)||{}, rv=[];
  days.forEach(function(d){ (d.words||[]).forEach(function(w){ if(w&&cf[w.w]&&mqsDay(cf[w.w])<today && rv.every(function(x){ return x.w!==w.w; })) rv.push(w); }); });
  if(rv.length){ h+='<div class="mqs-rv"><div class="mqs-ttl">🔁 다시 볼 낱말 <small>· 전에 «헷갈려요» 한 것</small></div>'; rv.forEach(function(w, i){ h+=MQR.word(w, i, { btns:mqsWBtns }); }); h+='</div>'; }
  var D=days[MQS.wDay], ws=(D&&D.words)||[], nk=ws.filter(function(w){ return !!mqsMarked(w.w); }).length;
  h+='<div class="mqs-ttl">Day '+mqsE(D.n)+' <small>· '+nk+'/'+ws.length+' 확인</small></div><div id="mqs-wlist">';
  ws.forEach(function(w, i){ h+=MQR.word(w, i, { btns:mqsWBtns }); });
  h+='</div>';
  if(ws.length && nk===ws.length) h+='<div class="mqs-fin small"><b>🎉 Day '+mqsE(D.n)+' 끝!</b><span>헷갈린 낱말은 내일 다시 나와요</span></div>';
  body.innerHTML=h;
}
window.mqsMark=function(w, kind){
  if(!w) return; var L=MQS.wlog=MQS.wlog||{ known:{}, confused:{} }; L.known=L.known||{}; L.confused=L.confused||{};
  var now=mqsIso();
  if(kind==='known'){ L.known[w]=now; delete L.confused[w]; } else { L.confused[w]=now; delete L.known[w]; }
  L.upd=now; var c=mqsCode(); if(c) mqsKvSet('wordlog_'+c, L);
  var sc=document.getElementById('screen-mq-words'), y=sc?sc.scrollTop:0, wb=document.getElementById('mqs-wbody'), y2=wb?wb.scrollTop:0;
  mqsWordsPaint(); if(sc) sc.scrollTop=y; if(wb) wb.scrollTop=y2;
};

/* ── 모양 ── */
function mqsCss(){
  mqrCss('mqr-css');
  if(document.getElementById('mqs-css')) return;
  var s=document.createElement('style'); s.id='mqs-css'; s.textContent=''
    +'.mqh{display:flex;align-items:center;gap:10px;width:100%;border:none;border-radius:16px;padding:9px 12px;background:linear-gradient(135deg,#fff7e6,#ffe4c2);box-shadow:0 2px 10px rgba(13,34,64,.06);cursor:pointer;font-family:inherit;text-align:left;color:#0f172a;position:relative}'
    +'.mqh .av3{display:flex;flex:0 0 auto}.mqh .av3 img{width:34px;height:28px;margin-right:-6px;background:#fff;border-radius:8px;border:1.5px solid #fde68a}'
    +'.mqh .tx{flex:1;min-width:0;padding-left:6px}.mqh b{display:block;font-size:14.5px;font-weight:900}.mqh small{display:block;font-size:11.5px;color:#9a3412;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    +'.mqh .n{background:#e8192c;color:#fff;border-radius:999px;font-size:11px;font-weight:900;padding:1px 7px}.mqh .ch{color:#c2410c;font-weight:900;font-size:18px}'
    +'#screen-mq,#screen-mq-play,#screen-mq-words{background:#fffaf2}'
    +'.mqs-body{flex:1;padding:12px 12px 30px;overflow-y:auto;overflow-x:hidden}'
    +'.mqs-tabs{display:flex;gap:6px;margin:0 0 10px;flex-wrap:wrap}.mqs-tabs button{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 12px;font-weight:900;font-size:12.5px;font-family:inherit;color:#334155;cursor:pointer;min-height:36px}'
    +'.mqs-tabs button.on{background:#0f766e;border-color:#0f766e;color:#fff}.mqs-tabs small{opacity:.8;font-size:10.5px}'
    +'.mqs-ttl{font-weight:900;margin:4px 2px 8px;font-size:14px}.mqs-ttl small{color:#64748b;font-weight:700;font-size:11.5px}'
    +'.mqs-unit{display:flex;align-items:center;gap:8px;width:100%;background:#fff;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px;margin-bottom:6px;font-weight:800;font-size:13px;font-family:inherit;color:#0f172a;cursor:pointer;text-align:left;min-height:46px}'
    +'.mqs-unit b{color:#475569;flex:0 0 auto}.mqs-unit .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    +'.mqs-unit .st{flex:0 0 auto;font-size:11px;font-weight:900;border-radius:999px;padding:2px 8px;background:#f1f5f9;color:#64748b}.mqs-unit .st.ok{background:#dcfce7;color:#15803d}.mqs-unit .st.now{background:#fef3c7;color:#b45309}'
    +'.mqs-unit.cur{border-color:#fbbf24;background:#fffbeb}'
    +'.mqs-note{font-size:11.5px;color:#64748b;margin:6px 2px 12px}.mqs-empty{background:#fff;border:1.5px dashed #e2e8f0;border-radius:14px;padding:18px;text-align:center;color:#64748b;font-weight:700;line-height:1.7;margin-bottom:10px}'
    +'.mqs-wordbtn{display:flex;align-items:center;gap:10px;width:100%;border:none;border-radius:16px;padding:12px;background:#0f766e;color:#fff;font-family:inherit;text-align:left;cursor:pointer}'
    +'.mqs-wordbtn .ic{font-size:26px}.mqs-wordbtn b{display:block;font-size:15px}.mqs-wordbtn small{display:block;font-size:11.5px;color:#ccfbf1}.mqs-wordbtn span:nth-child(2){flex:1;min-width:0}.mqs-wordbtn .ch{font-size:20px;font-weight:900}'
    +'.mqs-saved{background:#0d2240;color:#fff;border-radius:14px;padding:10px 12px;margin-bottom:6px;font-size:13px;line-height:1.6}.mqs-saved small{display:block;color:#fbbf24;font-weight:900;font-size:11px}.mqs-saved .mq-hl{color:#fbbf24}'
    +'.mqs-phd{flex-direction:column;align-items:stretch;gap:8px;padding-bottom:0}.mqs-phd .row{display:flex;align-items:center;gap:10px}.mqs-phd .tt{flex:1;min-width:0}'
    +'.mqs-phd .sub-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px}.mqs-phd small{display:block;color:#cbd5e1;font-size:11px;font-weight:700}'
    +'.mqs-prog{height:5px;background:#1e3a5f;margin:0 -20px}.mqs-prog i{display:block;height:100%;width:0;background:#fbbf24;transition:width .3s}'
    +'.mqs-chat{flex:1;padding:12px 12px 16px;overflow-y:auto;overflow-x:hidden}'
    +'.mqs-bar{flex-shrink:0;display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #f1e6d6}'
    +'.mqs-auto{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:0 10px;font-weight:900;font-size:12px;font-family:inherit;color:#64748b;cursor:pointer;min-height:48px}.mqs-auto.on{border-color:#0f766e;color:#0f766e;background:#f0fdfa}'
    +'.mqs-again{border:1.5px solid #e2e8f0;background:#fff;border-radius:12px;padding:0 12px;font-weight:900;font-size:13px;font-family:inherit;color:#0d2240;cursor:pointer;min-height:48px}'
    +'.mqs-next{flex:1;border:none;border-radius:12px;background:#e8192c;color:#fff;font-weight:900;font-size:16px;font-family:inherit;cursor:pointer;min-height:48px}.mqs-next.wait{background:#cbd5e1;color:#475569}.mqs-next.end{background:#16a34a}'
    +'.mqs-fin{display:flex;flex-direction:column;align-items:center;gap:4px;background:#fff;border:2px solid #fde68a;border-radius:18px;padding:14px;text-align:center;margin:4px 0 10px;animation:mqIn .3s ease-out}'
    +'.mqs-fin b{font-size:16px}.mqs-fin span{color:#64748b;font-weight:700;font-size:13px}.mqs-finimg{display:flex;gap:10px}.mqs-fin.small{padding:10px}'
    +'.mqs-days{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}.mqs-days button{font-size:12px;font-weight:800;color:#475569;padding:6px 9px;border-radius:8px;border:none;background:#fff;font-family:inherit;cursor:pointer;min-height:34px}'
    +'.mqs-days button.on{background:#ccfbf1;color:#0f766e}.mqs-days button.done{color:#94a3b8;text-decoration:line-through}.mqs-days button.on.done{color:#0f766e}'
    +'.mqs-chk{display:flex;gap:6px;margin-top:8px}.mqs-chk button{flex:1;border:1.5px solid #e2e8f0;background:#fff;border-radius:9px;padding:8px;font-size:12.5px;font-weight:900;font-family:inherit;color:#475569;cursor:pointer;min-height:40px}'
    +'.mqs-chk button.y{border-color:#86efac;color:#15803d;background:#f0fdf4}.mqs-chk button.n{border-color:#fdba74;color:#c2410c;background:#fff7ed}'
    +'.mqs-rv{background:#fff7ed;border:1.5px solid #fed7aa;border-radius:16px;padding:10px 10px 4px;margin-bottom:12px}'
    +'.mqs-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%) translateY(20px);background:#0f172a;color:#fff;border-radius:12px;padding:10px 14px;font-size:13px;font-weight:800;opacity:0;pointer-events:none;transition:.25s;z-index:9999;max-width:calc(100vw - 32px);text-align:center}'
    +'.mqs-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}';
  document.head.appendChild(s);
}
try{ MQS.auto=localStorage.getItem('mqs_auto')==='1'; }catch(e){}
try{ mqsCss(); }catch(e){}
