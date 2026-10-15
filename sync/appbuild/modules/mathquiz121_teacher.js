/* ═══════════════════════════════════════════════════════════════════
 * v19-121: 🧠 루멘 수학퀴즈 (VIEW='mathquiz') — 원장 승인 시안 docs/mockup_char_lesson_teacher.html · docs/mockup_char_lesson_px2.html
 *   (원장이 「캐릭터 수업 · 개념 나들이」 → 「루멘 수학퀴즈」로 이름을 바꿈 · 수업 = «퀴즈» · 낱말 = «🍙 수학 낱말 Day»)
 *   메뉴: 위 기능 탭 「📱 학생앱」 › 「🧠 루멘 수학퀴즈」 (강의실 바로 뒤)
 *   탭 ① ✍️ 만들기 — 3칸: 학년·단원·재료 | 대본 편집 | 학생앱 미리보기(학생앱과 같은 그리기 MQR)
 *        줄: 💬 대사(캐릭터·표정) · 🟩 개념 카드 · ✋ 문제 · 📌 아하 포인트 — ↑↓·끌기 순서, ✕ 지우기
 *        🤖 AI 초안(원장님 열쇠 · callAI · 재료 그림은 Claude 일 때만 같이 보냄) · 📋 대본 붙여넣기(채팅에서 만든 JSON) · 예시 불러오기
 *        임시저장 / 🚀 발행 → lumen_store quiz_<id> + quiz_index (발행된 것만 학생앱에 보임)
 *        재료(사진·PDF) → Storage photos/quiz_mats/<id>/… (학생앱에는 절대 안 보임)
 *   탭 ② 📊 학생 현황 — quizlog_<코드> 를 한 번에 읽어(like) 끝까지 본 학생/대상 · 문제 정답률 · 평균 시간 · 담음 · 중간에 멈춤 · 학생 × 줄 표
 *        + 낱말 «헷갈려요» 순위(wordlog_<코드>) · 「안 본 학생에게 알림」은 학생 알림 길이 아직 없어 꺼 둠(이름 복사만)
 *   탭 ③ 🍙 낱말 Day — quiz_words_<학년> { days:[{n, words:[{w,hanja,hj,mean,say,ex,unit,who?}]}] } 고치기 · JSON 붙여넣기
 *   탭 ④ 🎨 캐릭터 — 루미 · 아하 · 정수쌤 표정 (읽기만 · 최종 그림은 docs/char_px2 PNG 를 바꿔 다시 조립)
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 서버 읽기·쓰기는 적중 분석과 같은 htKv / htKvSet. localStorage 에는 아무것도 안 둔다.
 * ═══════════════════════════════════════════════════════════════════ */
var MQ = { tab:'make', grade:'중1-2', idx:null, idxBusy:false, idxErr:'', cur:null, dirty:false, saving:false, msg:'', aiBusy:false, aiMsg:'',
  prevAns:{}, drag:-1, docs:{}, logs:null, wlogs:null, logsAt:0, logsBusy:false, statQ:'', words:{}, wBusy:{}, wGrade:'중1-2', wDay:0, wDirty:false };
var MQ_GRADES = ['중1-1','중1-2','중2-1','중2-2','중3-1','중3-2','고1-1','고1-2'];
/* 기본 단원 목록 (학교 교과서 순서 — 퀴즈를 만들 때 단원 번호·이름은 바꿀 수 있다) */
var MQ_UNITS = {
  '중1-1':[['Ⅰ-1','소인수분해'],['Ⅰ-2','정수와 유리수'],['Ⅱ-1','문자의 사용과 식의 계산'],['Ⅱ-2','일차방정식'],['Ⅲ-1','좌표평면과 그래프']],
  '중1-2':[['Ⅰ-1','점·선·면·각'],['Ⅰ-2','위치 관계'],['Ⅰ-3','동위각과 엇각'],['Ⅰ-4','작도와 합동'],['Ⅱ-1','다각형'],['Ⅱ-2','원과 부채꼴'],['Ⅲ-1','다면체와 회전체'],['Ⅲ-2','입체도형의 겉넓이와 부피'],['Ⅳ-1','자료의 정리와 해석']],
  '중2-1':[['Ⅰ-1','유리수와 순환소수'],['Ⅰ-2','식의 계산'],['Ⅱ-1','일차부등식'],['Ⅱ-2','연립일차방정식'],['Ⅲ-1','일차함수와 그래프'],['Ⅲ-2','일차함수와 일차방정식']],
  '중2-2':[['Ⅰ-1','삼각형의 성질'],['Ⅰ-2','사각형의 성질'],['Ⅱ-1','도형의 닮음'],['Ⅱ-2','피타고라스 정리'],['Ⅲ-1','경우의 수와 확률']],
  '중3-1':[['Ⅰ-1','제곱근과 실수'],['Ⅱ-1','다항식의 곱셈'],['Ⅱ-2','인수분해'],['Ⅲ-1','이차방정식'],['Ⅳ-1','이차함수와 그래프']],
  '중3-2':[['Ⅰ-1','삼각비'],['Ⅱ-1','원과 직선'],['Ⅱ-2','원주각'],['Ⅲ-1','대푯값과 산포도'],['Ⅲ-2','상관관계']],
  '고1-1':[['Ⅰ-1','다항식의 연산'],['Ⅰ-2','나머지정리와 인수분해'],['Ⅱ-1','복소수와 이차방정식'],['Ⅱ-2','이차방정식과 이차함수'],['Ⅱ-3','여러 가지 방정식과 부등식'],['Ⅲ-1','경우의 수'],['Ⅳ-1','행렬']],
  '고1-2':[['Ⅰ-1','평면좌표'],['Ⅰ-2','직선의 방정식'],['Ⅰ-3','원의 방정식'],['Ⅰ-4','도형의 이동'],['Ⅱ-1','집합'],['Ⅱ-2','명제'],['Ⅲ-1','함수'],['Ⅲ-2','유리함수와 무리함수']]
};

/* ── 메뉴: 「📱 학생앱」 묶음의 「🎬 강의실」 바로 뒤 ── */
(function(){
  try{
    var g=(GROUPS||[]).filter(function(x){ return x.key==='studentapp'; })[0]; if(!g) return;
    if(g.subs.some(function(s){ return s.v==='mathquiz'; })) return;
    var at=g.subs.length; g.subs.forEach(function(s, j){ if(s.v==='vod') at=j+1; });
    g.subs.splice(at, 0, { v:'mathquiz', icon:'🧠', label:'루멘 수학퀴즈', act:function(){ VIEW='mathquiz'; mqKick(); } });
  }catch(e){ try{ console.error('[루멘 수학퀴즈 메뉴]', e); }catch(_){} }
})();

/* 🎛 학생앱 기능 켜고 끄기에 «루멘 수학퀴즈» 칸 (설정이 없으면 켜진 것 · SF_LIST 는 이 부품보다 뒤에 정의되므로 다 읽은 뒤 넣는다) */
setTimeout(function(){ try{ if(typeof SF_LIST!=='undefined' && !SF_LIST.some(function(f){ return f.k==='mathquiz'; }))
  SF_LIST.push({ k:'mathquiz', ic:'🧠', n:'루멘 수학퀴즈', d:'루미·아하·정수쌤 대화 퀴즈와 🍙 수학 낱말 Day. 끄면 홈 카드와 화면이 함께 숨겨집니다.' }); }catch(e){} }, 0);

function mqE(s){ return MQR.esc(s); }
function mqToast(m){ try{ htToast(m); }catch(e){ try{ plToast(m); }catch(_){} } }
function mqNow(){ return new Date().toISOString(); }
function mqStu(){ return (typeof students!=='undefined'&&Array.isArray(students)?students:[]).filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; }); }
function mqStuOf(grade){ var gk=String(grade||'').split('-')[0]; return mqStu().filter(function(s){ return MQR.gradeKey(s.grade)===gk; }); }
function mqNewId(){ return 'q'+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }

/* ── 불러오기 ── */
function mqKick(force){
  if(MQ.idxBusy) return; if(MQ.idx && !force) return;
  MQ.idxBusy=true; MQ.idxErr='';
  htKv('quiz_index').then(function(v){ MQ.idx=(v&&Array.isArray(v.items))?v:{ items:[] }; })
    .catch(function(e){ MQ.idxErr=String((e&&e.message)||e); MQ.idx=MQ.idx||{ items:[] }; })
    .then(function(){ MQ.idxBusy=false; if(VIEW==='mathquiz') render(); });
}
function mqItems(grade){ return ((MQ.idx&&MQ.idx.items)||[]).filter(function(x){ return x && (!grade || x.grade===grade); }); }
function mqItem(id){ return ((MQ.idx&&MQ.idx.items)||[]).filter(function(x){ return x && x.id===id; })[0]||null; }
function mqUnitName(grade, unit){ var u=(MQ_UNITS[grade]||[]).filter(function(x){ return x[0]===unit; })[0]; return u?u[1]:''; }

window.mqTab=function(t){ MQ.tab=t; if(t==='stat') mqLogsLoad(false); if(t==='words') mqWordsLoad(MQ.wGrade); render(); };
window.mqGrade=function(g){ if(MQ.dirty && !confirm('저장하지 않은 고침이 있어요. 그래도 다른 학년으로 갈까요?')) return; MQ.grade=g; render(); };
function mqLeaveOk(){ return !MQ.dirty || confirm('저장하지 않은 고침이 있어요. 버리고 넘어갈까요?'); }
window.mqOpen=function(id){
  if(MQ.cur && MQ.cur.id===id) return; if(!mqLeaveOk()) return;
  var it=mqItem(id); MQ.msg='불러오는 중…'; render();
  htKv('quiz_'+id).then(function(v){
    var d=v||{}, lines=[]; (d.lines||[]).forEach(function(L){ var n=MQR.norm(L); if(n) lines.push(n); });
    MQ.cur={ id:id, title:d.title||(it&&it.title)||'', grade:d.grade||(it&&it.grade)||MQ.grade, unit:d.unit||(it&&it.unit)||'', scope:d.scope||'', notes:d.notes||'', mats:Array.isArray(d.mats)?d.mats:[], lines:lines, status:(it&&it.status)||'draft', pubAt:(it&&it.pubAt)||'' };
    MQ.docs[id]=d; MQ.dirty=false; MQ.prevAns={}; MQ.msg=''; MQ.aiMsg=''; render();
  }).catch(function(e){ MQ.msg='⚠️ 불러오지 못했어요: '+String((e&&e.message)||e); render(); });
};
window.mqNew=function(unit, name){
  if(!mqLeaveOk()) return;
  if(unit==null){
    unit=prompt('단원 번호 (예: Ⅰ-3)', ''); if(unit==null) return;
    name=prompt('퀴즈 제목 (예: 동위각과 엇각)', mqUnitName(MQ.grade, unit)||''); if(name==null) return;
  }
  MQ.cur={ id:mqNewId(), title:String(name||mqUnitName(MQ.grade, unit)||'새 퀴즈').trim(), grade:MQ.grade, unit:String(unit||'').trim(), scope:'', notes:'', mats:[], lines:[], status:'new', pubAt:'' };
  MQ.dirty=true; MQ.prevAns={}; MQ.aiMsg=''; MQ.msg=''; render();
};
window.mqNewEl=function(el){ mqNew(el.getAttribute('data-unit')||'', el.getAttribute('data-name')||''); };
window.mqSample=function(){
  var s=MQR.sample();
  if(MQ.cur && MQ.cur.status==='new' && !MQ.cur.lines.length){ MQ.cur.lines=s.lines; if(!MQ.cur.title) MQ.cur.title=s.title; }
  else { if(!mqLeaveOk()) return; MQ.grade=s.grade; MQ.cur={ id:mqNewId(), title:s.title, grade:s.grade, unit:s.unit, scope:s.scope, notes:'', mats:[], lines:s.lines, status:'new', pubAt:'' }; }
  MQ.dirty=true; MQ.prevAns={}; MQ.aiMsg='📘 예시(동위각과 엇각)를 불러왔어요 — 고친 뒤 저장·발행하면 됩니다'; render();
};

/* ── 고치기 (글을 칠 때는 화면 전체를 다시 그리지 않고 미리보기만) ── */
function mqDirty(){ MQ.dirty=true; var d=document.getElementById('mq-dirty'); if(d){ d.textContent='● 저장 안 됨'; d.className='mqt-dirty on'; } }
window.mqFit=function(el){ try{ el.style.height='auto'; el.style.height=Math.min(400, el.scrollHeight+2)+'px'; }catch(e){} };
function mqFitAll(){ try{ document.querySelectorAll('.mqt-ta').forEach(function(el){ mqFit(el); }); }catch(e){} }
window.mqMeta=function(f, v){ if(!MQ.cur) return; MQ.cur[f]=v; mqDirty(); mqPrevRefresh(); };
window.mqSet=function(i, f, v){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; L[f]=v; mqDirty(); mqPrevRefresh(); };
window.mqWho=function(i, w){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; L.who=w; if(MQR.WHO[w].faces.indexOf(L.face)<0) L.face='base'; mqDirty(); render(); };
window.mqFace=function(i, f){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; L.face=f; mqDirty(); render(); };
window.mqCh=function(i, k, v){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; L.choices[k]=v; mqDirty(); delete MQ.prevAns[i]; mqPrevRefresh(); };
window.mqAns=function(i, k){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; L.answer=k; mqDirty(); delete MQ.prevAns[i]; render(); };
window.mqChAdd=function(i){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L||L.choices.length>=5) return; L.choices.push(''); mqDirty(); render(); };
window.mqChDel=function(i, k){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L||L.choices.length<=2) return; L.choices.splice(k,1); if(L.answer>=L.choices.length) L.answer=0; else if(L.answer>k) L.answer--; mqDirty(); delete MQ.prevAns[i]; render(); };
window.mqSvgDel=function(i){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; delete L.svg; mqDirty(); render(); };
window.mqMove=function(i, d){
  var a=MQ.cur&&MQ.cur.lines, j=i+d; if(!a||j<0||j>=a.length) return;
  var x=a[i]; a[i]=a[j]; a[j]=x; MQ.prevAns={}; mqDirty(); render();
};
window.mqDel=function(i){
  var a=MQ.cur&&MQ.cur.lines; if(!a||!a[i]) return;
  var L=a[i], txt=L.text||L.title||L.q||''; if(String(txt).trim() && !confirm((i+1)+'번 줄을 지울까요?\n\n'+String(txt).slice(0,60))) return;
  a.splice(i,1); MQ.prevAns={}; mqDirty(); render();
};
window.mqAdd=function(t){
  if(!MQ.cur) return; var a=MQ.cur.lines, L;
  if(t==='say'){ var last=''; for(var i=a.length-1;i>=0;i--){ if(a[i].t==='say'){ last=a[i].who; break; } } L={ t:'say', who:last==='lumi'?'aha':'lumi', face:'base', text:'' }; }
  else if(t==='card') L={ t:'card', title:'', body:'' };
  else if(t==='quiz') L={ t:'quiz', q:'', choices:['',''], answer:0, src:'' };
  else L={ t:'point', text:'' };
  a.push(L); mqDirty(); render();
  setTimeout(function(){ var rows=document.querySelectorAll('.mqt-row'); var r=rows[rows.length-1]; if(r){ try{ r.scrollIntoView({ block:'nearest' }); var f=r.querySelector('textarea,input[type=text]'); if(f) f.focus(); }catch(e){} } }, 30);
};
/* 끌어서 옮기기 (PC) — 아이패드는 ↑↓ */
window.mqDragS=function(ev, i){ MQ.drag=i; try{ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain', String(i)); }catch(e){} };
window.mqDragO=function(ev){ if(MQ.drag<0) return; ev.preventDefault(); };
window.mqDrop=function(ev, j){
  ev.preventDefault(); var i=MQ.drag; MQ.drag=-1; var a=MQ.cur&&MQ.cur.lines; if(!a||i<0||i===j||!a[i]) return;
  var x=a.splice(i,1)[0]; a.splice(j,0,x); MQ.prevAns={}; mqDirty(); render();
};

/* ── 미리보기 (학생앱과 같은 MQR 그리기) ── */
function mqPrevBody(){
  var c=MQ.cur; if(!c) return '';
  if(!c.lines.length) return '<div class="mqt-pempty">대사를 넣으면 여기 학생앱 모습으로 보여요</div>';
  return MQR.lines(c.lines, { ans:MQ.prevAns, pick:'mqPrevPick', tts:'mqPrevSpeak', teacher:true,
    point:function(){ return '<div class="mq-pbtns"><button type="button" tabindex="-1">📒 아하노트에 담기</button><button type="button" tabindex="-1" style="background:#e8192c;color:#fff">다음 ›</button></div>'; } });
}
function mqPrevRefresh(){
  var b=document.getElementById('mq-prev'); if(b) b.innerHTML=mqPrevBody();
  var t=document.getElementById('mq-prev-t'); if(t && MQ.cur) t.textContent='💬 '+(MQ.cur.title||'제목 없음');
  var n=document.getElementById('mq-prev-n'); if(n && MQ.cur) n.textContent='학생앱 미리보기 · '+MQ.cur.lines.length+'줄';
}
window.mqPrevPick=function(i, k){ var L=MQ.cur&&MQ.cur.lines[i]; if(!L) return; MQ.prevAns[i]={ pick:k, ok:k===L.answer }; mqPrevRefresh(); };
window.mqPrevReset=function(){ MQ.prevAns={}; mqPrevRefresh(); };
window.mqPrevSpeak=function(i){ var L=MQ.cur&&MQ.cur.lines[i]; if(!MQR.speak(L)) mqToast('이 기기에서는 읽어 주기를 쓸 수 없어요'); };

/* ── 저장 · 발행 ── */
function mqCheck(lines, pub){
  var bad=[];
  lines.forEach(function(L, i){
    if(L.t==='say' && !String(L.text).trim()) bad.push((i+1)+'번 대사가 비었어요');
    if(L.t==='card' && !String(L.title).trim() && !String(L.body).trim()) bad.push((i+1)+'번 개념 카드가 비었어요');
    if(L.t==='point' && !String(L.text).trim()) bad.push((i+1)+'번 아하 포인트가 비었어요');
    if(L.t==='quiz'){
      if(!String(L.q).trim()) bad.push((i+1)+'번 문제 글이 비었어요');
      var full=L.choices.filter(function(c){ return String(c).trim(); }).length;
      if(full<2) bad.push((i+1)+'번 문제 보기가 2개보다 적어요');
      if(!String(L.choices[L.answer]||'').trim()) bad.push((i+1)+'번 문제 정답 보기가 비었어요');
    }
  });
  if(pub && !lines.length) bad.push('대본이 비었어요');
  return bad;
}
/* 저장할 줄 — 빈 보기는 빼고 정답 번호를 맞춘다 */
function mqCleanLines(lines){
  return lines.map(function(L){
    if(L.t!=='quiz') { var o={}; for(var k in L) o[k]=L[k]; return o; }
    var ch=[], ans=0; L.choices.forEach(function(c, k){ if(String(c).trim()){ if(k===L.answer) ans=ch.length; ch.push(String(c)); } });
    return { t:'quiz', q:L.q, choices:ch, answer:ans, src:L.src||'' };
  });
}
window.mqSave=async function(mode){
  var c=MQ.cur; if(!c||MQ.saving) return;
  var pub=(mode==='pub')||(mode!=='unpub'&&c.status==='pub');
  var bad=mqCheck(c.lines, pub);
  if(bad.length && pub){ alert('발행 전에 고쳐 주세요\n\n· '+bad.slice(0,8).join('\n· ')); return; }
  if(!String(c.title).trim()){ alert('퀴즈 제목을 넣어 주세요'); return; }
  if(mode==='pub' && c.status!=='pub' && !confirm('발행하면 학생앱 «🧠 루멘 수학퀴즈»에 바로 보여요.\n'+c.grade+' '+c.unit+' '+c.title+' — 발행할까요?')) return;
  if(mode==='unpub' && !confirm('발행을 내리면 학생앱에서 안 보여요. 내릴까요?')) return;
  var now=mqNow(), st=(mode==='pub')?'pub':(mode==='unpub'?'draft':(c.status==='pub'?'pub':'draft'));
  var lines=mqCleanLines(c.lines);
  var doc={ id:c.id, title:String(c.title).trim(), grade:c.grade, unit:String(c.unit||'').trim(), scope:c.scope||'', notes:c.notes||'', mats:c.mats||[], lines:lines, updatedAt:now };
  MQ.saving=true; render();
  try{
    await htKvSet('quiz_'+c.id, doc);
    /* 목록은 저장 직전 서버 것을 다시 읽어 합친다(다른 기기에서 만든 퀴즈를 덮지 않게) */
    var idx=await htKv('quiz_index'); idx=(idx&&Array.isArray(idx.items))?idx:{ items:[] };
    var it=idx.items.filter(function(x){ return x&&x.id===c.id; })[0];
    if(!it){ it={ id:c.id }; idx.items.push(it); }
    it.title=doc.title; it.grade=doc.grade; it.unit=doc.unit; it.status=st; it.updatedAt=now; it.n=lines.length;
    it.nq=lines.filter(function(L){ return L.t==='quiz'; }).length;
    if(st==='pub' && (mode==='pub' && c.status!=='pub' || !it.pubAt)) it.pubAt=now;
    idx.updatedAt=now;
    await htKvSet('quiz_index', idx);
    MQ.idx=idx; c.status=st; c.pubAt=it.pubAt||''; c.lines=lines; MQ.docs[c.id]=doc; MQ.dirty=false;
    mqToast(mode==='pub'?'🚀 발행했어요 — 학생앱에 보여요':(mode==='unpub'?'발행을 내렸어요':'💾 저장했어요'+(bad.length?' (빈 칸 '+bad.length+'개는 발행 전에 채워 주세요)':'')));
  }catch(e){ alert('저장하지 못했어요: '+String((e&&e.message)||e)); }
  MQ.saving=false; render();
};
window.mqHide=async function(){
  var c=MQ.cur; if(!c||c.status==='new') return;
  if(!confirm('«'+c.title+'» 퀴즈를 목록에서 뺄까요?\n(학생앱에서도 안 보여요. 대본은 서버에 남아요)')) return;
  try{
    var idx=await htKv('quiz_index'); idx=(idx&&Array.isArray(idx.items))?idx:{ items:[] };
    idx.items=idx.items.filter(function(x){ return x&&x.id!==c.id; }); idx.updatedAt=mqNow();
    await htKvSet('quiz_index', idx); MQ.idx=idx; MQ.cur=null; MQ.dirty=false; mqToast('목록에서 뺐어요');
  }catch(e){ alert('빼지 못했어요: '+String((e&&e.message)||e)); }
  render();
};

/* ── 재료 올리기 (사진·PDF → Storage photos/quiz_mats/<퀴즈>/…) — 학생에게는 보이지 않는다 ── */
window.mqUpload=async function(inp){
  var c=MQ.cur, fs=inp&&inp.files?Array.prototype.slice.call(inp.files):[]; if(!c||!fs.length) return;
  var sb=htSb(); if(!sb){ alert('서버 연결이 없어요'); return; }
  MQ.msg='📤 재료 올리는 중… (0/'+fs.length+')'; render(); var ok=0, fail=[];
  for(var i=0;i<fs.length;i++){
    var f=fs[i], kind=/pdf/i.test(f.type||f.name)?'pdf':(/^image\//.test(f.type||'')?'img':'');
    if(!kind){ fail.push(f.name+' (사진·PDF만)'); continue; }
    var safe=String(f.name||'file').replace(/[^\w.\-가-힣]/g,'_').slice(-60), path='quiz_mats/'+c.id+'/'+Date.now().toString(36)+'_'+safe;
    try{
      var up=await sb.storage.from('photos').upload(path, f, { contentType:f.type||(kind==='pdf'?'application/pdf':'image/jpeg'), upsert:true });
      if(up&&up.error) throw up.error;
      var url=''; try{ url=sb.storage.from('photos').getPublicUrl(path).data.publicUrl; }catch(e){}
      c.mats.push({ name:f.name, url:url, kind:kind, path:path, at:mqNow() }); ok++;
    }catch(e){ fail.push(f.name+' ('+String((e&&e.message)||e)+')'); }
    MQ.msg='📤 재료 올리는 중… ('+(i+1)+'/'+fs.length+')';
  }
  try{ inp.value=''; }catch(e){}
  MQ.msg=ok?('📎 재료 '+ok+'개를 올렸어요 — 「임시저장」을 눌러야 퀴즈에 남아요'):''; if(ok) mqDirty();
  if(fail.length) alert('못 올린 파일:\n'+fail.join('\n'));
  render();
};
window.mqMatDel=function(k){ var c=MQ.cur; if(!c||!c.mats[k]) return; if(!confirm('재료 «'+c.mats[k].name+'»를 이 퀴즈에서 뺄까요?')) return; c.mats.splice(k,1); mqDirty(); render(); };

/* ── 🤖 AI 초안 (원장님 열쇠 · 학원앱 callAI — 재료 그림은 Claude 열쇠일 때만 같이 보낸다) ── */
var MQ_RULES = [
  '교재 문제는 그대로 옮기지 말고 숫자만 바꾼 비슷한 문제로 낸다 (quiz 의 src 에 어느 교재 몇 번을 바꿨는지 적는다 — 학생에게는 안 보인다)',
  '아하는 학생들이 자주 하는 실수를 한다 → 루미가 바로잡는다 → 아하가 깨닫는다(face \'aha\', 💡)',
  '대사는 한 번에 1~2문장, 중학생이 읽기 쉬운 반말 대화. 핵심 낱말은 **낱말** 로 감싼다',
  '8~14줄: 대사 위주 + 개념 카드 1~2개 + 문제(quiz) 1~2개(보기 2~4개, answer 는 0부터) + 마지막에 정수쌤 아하 포인트(point) 1개',
  '정확한 수학만 쓴다. 계산·정답을 한 번 더 확인한다'
];
function mqAiPrompt(extra){
  var c=MQ.cur;
  var p='너는 한국 수학학원 «루멘수학»의 «🧠 루멘 수학퀴즈» 대본 작가다. 학생앱에서 캐릭터들이 채팅처럼 한 줄씩 대화하며 개념을 알려 준다.\n'
    +'등장인물: 루미(개념 언니, who:"lumi", face:"base"|"oops"=당황), 아하(실수 대장, who:"aha", face:"base"|"aha"=깨달음💡), 정수쌤(원장, who:"ssam", face:"base", 아하 포인트 담당)\n\n'
    +'학년·학기: '+c.grade+'\n단원: '+(c.unit||'')+' '+(c.title||'')+'\n'
    +(c.scope?('시험 범위: '+c.scope+'\n'):'')
    +(String(c.notes||'').trim()?('원장님 메모(꼭 반영):\n'+String(c.notes).trim()+'\n'):'')
    +'\n규칙:\n'+MQ_RULES.map(function(r){ return '- '+r; }).join('\n')+'\n'
    +'- 그림이 꼭 필요하면 card 에 "svg" 를 넣어도 된다(선택): <svg viewBox="0 0 300 120">…</svg>, 선·글자만(스크립트·그림 파일·링크 금지)\n';
  if(extra) p+='\n지금 대본:\n'+JSON.stringify({ lines:mqCleanLines(c.lines) })+'\n\n고칠 점: '+extra+'\n';
  p+='\nJSON 하나만 출력한다(설명·마크다운 없이):\n'
    +'{"title":"…","lines":[{"t":"say","who":"lumi","face":"base","text":"…"},{"t":"say","who":"aha","face":"base","text":"…(흔한 실수)"},{"t":"say","who":"lumi","face":"oops","text":"…"},'
    +'{"t":"card","title":"…","body":"…"},{"t":"quiz","q":"…","choices":["…","…"],"answer":0,"src":"…"},{"t":"say","who":"aha","face":"aha","text":"💡 …"},{"t":"point","text":"…"}]}';
  return p;
}
function mqB64(blob){ return new Promise(function(res, rej){ var r=new FileReader(); r.onload=function(){ res(String(r.result).split(',')[1]||''); }; r.onerror=function(){ rej(new Error('파일 읽기 실패')); }; r.readAsDataURL(blob); }); }
function mqShrinkImg(blob){
  return new Promise(function(res){ var u=URL.createObjectURL(blob), im=new Image();
    im.onload=function(){ try{ var W=im.naturalWidth, H=im.naturalHeight, k=Math.min(1, 1568/Math.max(W,H)), cv=document.createElement('canvas'); cv.width=Math.max(1,Math.round(W*k)); cv.height=Math.max(1,Math.round(H*k));
        var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(u); res(cv.toDataURL('image/jpeg',0.85).split(',')[1]); }catch(e){ res(''); } };
    im.onerror=function(){ URL.revokeObjectURL(u); res(''); }; im.src=u; });
}
async function mqMatBlocks(){
  var out=[], c=MQ.cur, ni=0, np=0;
  for(var i=0;i<(c.mats||[]).length;i++){
    var m=c.mats[i]; if(!m||!m.url) continue;
    if(m.kind==='img' && ni<4){ try{ var r=await fetch(m.url); if(!r.ok) continue; var b64=await mqShrinkImg(await r.blob()); if(b64){ out.push({ type:'image', source:{ type:'base64', media_type:'image/jpeg', data:b64 } }); ni++; } }catch(e){} }
    else if(m.kind==='pdf' && np<1){ try{ var r2=await fetch(m.url); if(!r2.ok) continue; var bl=await r2.blob(); if(bl.size>4500000) continue; out.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data:await mqB64(bl) } }); np++; }catch(e){} }
  }
  return out;
}
async function mqAiClaude(prompt, blocks){
  var resp=await fetch('https://api.anthropic.com/v1/messages',{ method:'POST',
    headers:{ 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true' },
    body:JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:6000, messages:[{ role:'user', content:blocks.concat([{ type:'text', text:prompt+'\n\n(위 그림·PDF 는 원장님이 올린 이 단원 재료다. 문제는 그대로 옮기지 말고 숫자만 바꿔라.)' }]) }] }) });
  var j=await resp.json(); if(!resp.ok||j.error) throw new Error((j.error&&j.error.message)||('Claude API 오류: HTTP '+resp.status));
  return (j.content||[]).map(function(x){ return x.text||''; }).join('');
}
window.mqAi=async function(extra){
  var c=MQ.cur; if(!c||MQ.aiBusy) return;
  var prov=(typeof aiProvider!=='undefined'&&aiProvider==='gemini'&&typeof geminiKey!=='undefined'&&geminiKey)?'gemini':((typeof apiKey!=='undefined'&&apiKey)?'claude':'');
  if(!prov){ alert('AI 열쇠가 없어요 — ⚙️ 설정에서 Claude 또는 Gemini 열쇠를 넣어 주세요.\n(열쇠 없이도 「📋 대본 붙여넣기」로 채팅에서 만든 대본을 넣을 수 있어요)'); return; }
  if(!extra && c.lines.length && !confirm('지금 대본('+c.lines.length+'줄)을 AI 초안으로 바꿀까요?')) return;
  MQ.aiBusy=true; MQ.aiMsg='🤖 '+(extra?'고치는 중':'대본 초안 만드는 중')+'… (30초쯤 걸려요)'; render();
  try{
    var p=mqAiPrompt(extra), blocks=(prov==='claude'&&!extra)?await mqMatBlocks():[], txt;
    txt=blocks.length?await mqAiClaude(p, blocks):await callAI(p);
    var r=MQR.parse(txt); if(!r.ok) throw new Error(r.err);
    c.lines=r.lines; if(r.meta.title && !String(c.title).trim()) c.title=r.meta.title;
    MQ.prevAns={}; mqDirty();
    var nq=r.lines.filter(function(L){ return L.t==='quiz'; }).length;
    MQ.aiMsg='🤖 '+(extra?'고친 대본':'대본 초안')+' '+r.lines.length+'줄 · 문제 '+nq+'개'+(blocks.length?' · 재료 '+blocks.length+'개 봄':'')+' — 읽어 보고 고친 뒤 저장·발행해 주세요';
  }catch(e){ MQ.aiMsg='⚠️ AI 초안을 만들지 못했어요: '+String((e&&e.message)||e); }
  MQ.aiBusy=false; render();
};

/* ── 📋 대본 붙여넣기 (채팅에서 만든 JSON) ── */
window.mqPasteOpen=function(){
  if(!MQ.cur) return; var old=document.getElementById('mq-paste-ov'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='mq-paste-ov'; ov.className='mqt-ov'; ov.setAttribute('role','dialog'); ov.setAttribute('aria-modal','true'); ov.setAttribute('aria-label','대본 붙여넣기');
  ov.innerHTML='<div class="mqt-box"><h3>📋 대본 붙여넣기</h3>'
    +'<div class="mqt-sub">채팅(Claude)에서 만든 대본 JSON 을 붙여 넣어요. <code>{"lines":[…]}</code> 또는 <code>[…]</code> 모두 됩니다.</div>'
    +'<textarea id="mq-paste-ta" placeholder=\'{"lines":[{"t":"say","who":"lumi","face":"base","text":"…"}]}\'></textarea>'
    +'<div id="mq-paste-st" class="mqt-sub" aria-live="polite"></div>'
    +'<div class="mqt-btns"><button type="button" class="mqt-b" onclick="mqPasteCopy()">📋 채팅용 지시문 복사</button><span style="flex:1"></span>'
    +'<button type="button" class="mqt-b" onclick="mqPasteClose()">취소</button><button type="button" class="mqt-b" id="mq-paste-add" onclick="mqPasteGo(\'add\')">뒤에 붙이기</button><button type="button" class="mqt-b pri" id="mq-paste-go" onclick="mqPasteGo(\'rep\')">대본 바꾸기</button></div></div>';
  ov.onclick=function(e){ if(e.target===ov) mqPasteClose(); };
  document.body.appendChild(ov); setTimeout(function(){ var t=document.getElementById('mq-paste-ta'); if(t) t.focus(); }, 30);
};
window.mqPasteClose=function(){ var ov=document.getElementById('mq-paste-ov'); if(ov) ov.remove(); };
window.mqPasteCopy=function(){ var p=mqAiPrompt(); try{ navigator.clipboard.writeText(p).then(function(){ mqToast('지시문을 복사했어요 — 채팅에 붙여 넣으세요'); }, function(){ prompt('아래 글을 복사하세요', p); }); }catch(e){ prompt('아래 글을 복사하세요', p); } };
window.mqPasteGo=function(mode){
  var ta=document.getElementById('mq-paste-ta'), st=document.getElementById('mq-paste-st'), r=MQR.parse(ta?ta.value:'');
  if(!r.ok){ if(st){ st.textContent='⚠️ '+r.err; st.style.color='#b91c1c'; } return; }
  var c=MQ.cur; if(!c) return;
  if(mode==='add') c.lines=c.lines.concat(r.lines); else c.lines=r.lines;
  if(r.meta.title && !String(c.title).trim()) c.title=r.meta.title;
  if(r.meta.unit && !String(c.unit).trim()) c.unit=r.meta.unit;
  if(r.meta.scope && !String(c.scope).trim()) c.scope=r.meta.scope;
  MQ.prevAns={}; mqDirty(); mqPasteClose();
  MQ.aiMsg='📋 대본 '+r.lines.length+'줄을 '+(mode==='add'?'뒤에 붙였어요':'넣었어요')+(r.skip?' (모르는 줄 '+r.skip+'개는 뺐어요)':'');
  render();
};

/* ── 그리기: 만들기 ── */
function mqStatusTag(st){ return st==='pub'?'<span class="mqt-st pub">발행</span>':(st==='draft'?'<span class="mqt-st dr">초안</span>':(st==='new'?'<span class="mqt-st nw">새로</span>':'<span class="mqt-st">없음</span>')); }
function mqLeftHtml(){
  var g=MQ.grade, items=mqItems(g), h='<div class="mqt-card"><h4>📚 학년 · 단원</h4><div class="mqt-chips">';
  MQ_GRADES.forEach(function(x){ var n=mqItems(x).length; h+='<button type="button" class="mqt-chip'+(x===g?' on':'')+'" onclick="mqGrade(\''+x+'\')">'+x+(n?' <small>'+n+'</small>':'')+'</button>'; });
  h+='</div><div class="mqt-units">';
  var rows=[]; (MQ_UNITS[g]||[]).forEach(function(u){ rows.push({ unit:u[0], name:u[1] }); });
  items.forEach(function(it){ if(!rows.some(function(r){ return r.unit===it.unit; })) rows.push({ unit:it.unit, name:'' }); });
  rows.sort(function(a,b){ return MQR.unitRank(a.unit)-MQR.unitRank(b.unit); });
  var curNew=(MQ.cur&&MQ.cur.status==='new'&&MQ.cur.grade===g)?MQ.cur:null;
  rows.forEach(function(r){
    var qs=items.filter(function(it){ return it.unit===r.unit; });
    if(curNew && curNew.unit===r.unit) qs=qs.concat([{ id:curNew.id, title:curNew.title, unit:curNew.unit, status:'new' }]);
    if(!qs.length){ h+='<button type="button" class="mqt-unit" data-unit="'+mqE(r.unit)+'" data-name="'+mqE(r.name)+'" onclick="mqNewEl(this)"><b>'+mqE(r.unit)+'</b> '+mqE(r.name)+mqStatusTag('')+'</button>'; return; }
    qs.forEach(function(it){ h+='<button type="button" class="mqt-unit'+(MQ.cur&&MQ.cur.id===it.id?' on':'')+'" data-id="'+mqE(it.id)+'" onclick="mqOpen(\''+mqE(it.id)+'\')"><b>'+mqE(it.unit)+'</b> '+mqE(it.title||r.name)+mqStatusTag(it.status)+'</button>'; });
  });
  if(curNew && !rows.some(function(r){ return r.unit===curNew.unit; })) h+='<button type="button" class="mqt-unit on"><b>'+mqE(curNew.unit)+'</b> '+mqE(curNew.title)+mqStatusTag('new')+'</button>';
  h+='</div><div class="mqt-btns"><button type="button" class="mqt-b" onclick="mqNew()">+ 새 퀴즈</button><button type="button" class="mqt-b" id="mq-sample" onclick="mqSample()">📘 예시 불러오기</button></div>'
    +'<div class="mqt-sub">단원을 누르면 그 단원 퀴즈를 열거나 새로 만들어요</div></div>';
  /* 재료 */
  var c=MQ.cur;
  h+='<div class="mqt-card"><h4>📎 재료'+(c?' ('+mqE(c.unit||'')+')':'')+'</h4>';
  if(!c) h+='<div class="mqt-sub">퀴즈를 고르면 교과서·문제집 사진/PDF 를 올릴 수 있어요</div>';
  else {
    (c.mats||[]).forEach(function(m, k){ h+='<div class="mqt-file">'+(m.kind==='pdf'?'📄':'🖼')+' <a href="'+mqE(m.url)+'" target="_blank" rel="noopener">'+mqE(m.name)+'</a><button type="button" class="mqt-x" onclick="mqMatDel('+k+')" aria-label="재료 빼기">✕</button></div>'; });
    h+='<label class="mqt-drop">📤 사진·PDF 올리기<input type="file" id="mq-file" accept="image/*,application/pdf" multiple onchange="mqUpload(this)" style="display:none"><br><b>교재 문제는 숫자를 바꿔</b> 씁니다 · 학생앱에는 안 보여요</label>';
  }
  return h+'</div>';
}
function mqWhoSel(L, i){
  var h='<select class="mqt-sel" aria-label="캐릭터" onchange="mqWho('+i+',this.value)">';
  MQR.ORDER.forEach(function(k){ h+='<option value="'+k+'"'+(L.who===k?' selected':'')+'>'+MQR.WHO[k].nm+'</option>'; });
  h+='</select><select class="mqt-sel" aria-label="표정" onchange="mqFace('+i+',this.value)">';
  MQR.WHO[L.who].faces.forEach(function(f){ h+='<option value="'+f+'"'+(L.face===f?' selected':'')+'>'+MQR.FACE_NM[f]+'</option>'; });
  return h+'</select>';
}
function mqRowHtml(L, i, n){
  var h='<div class="mqt-row k-'+L.t+'" data-i="'+i+'" draggable="true" ondragstart="mqDragS(event,'+i+')" ondragover="mqDragO(event)" ondrop="mqDrop(event,'+i+')">'
    +'<div class="mqt-h"><span class="mqt-n" title="끌어서 옮기기">⋮⋮ '+(i+1)+'</span><button type="button" class="mqt-mv" onclick="mqMove('+i+',-1)"'+(i===0?' disabled':'')+' aria-label="위로">↑</button><button type="button" class="mqt-mv" onclick="mqMove('+i+',1)"'+(i===n-1?' disabled':'')+' aria-label="아래로">↓</button></div>';
  if(L.t==='say'){
    h+='<div class="mqt-who"><span class="mqt-avs" style="background:'+MQR.WHO[L.who].bg+'">'+MQR.img(L.who, L.face, 'head', 40, 33)+'</span><span class="mqt-sels">'+mqWhoSel(L, i)+'</span></div>'
      +'<textarea class="mqt-ta" rows="2" aria-label="'+(i+1)+'번 대사" oninput="mqSet('+i+',\'text\',this.value);mqFit(this)" placeholder="대사 (**낱말** = 주황 강조)">'+mqE(L.text)+'</textarea>';
  } else if(L.t==='card'){
    h+='<div class="mqt-tagc"><span class="mqt-tag t1">🟩 개념 카드</span></div><div class="mqt-fields">'
      +'<input type="text" class="mqt-in" aria-label="카드 제목" value="'+mqE(L.title)+'" oninput="mqSet('+i+',\'title\',this.value)" placeholder="카드 제목">'
      +'<textarea class="mqt-ta" rows="2" aria-label="카드 내용" oninput="mqSet('+i+',\'body\',this.value);mqFit(this)" placeholder="내용 (**낱말** = 강조)">'+mqE(L.body)+'</textarea>'
      +(L.svg?'<div class="mqt-sub">🖼 그림(선·글자) 있음 <button type="button" class="mqt-b sm" onclick="mqSvgDel('+i+')">그림 빼기</button></div>':'')+'</div>';
  } else if(L.t==='quiz'){
    h+='<div class="mqt-tagc"><span class="mqt-tag t2">✋ 문제</span></div><div class="mqt-fields">'
      +'<input type="text" class="mqt-in" aria-label="문제" value="'+mqE(L.q)+'" oninput="mqSet('+i+',\'q\',this.value)" placeholder="문제 (교재 문제는 숫자만 바꿔서)">'
      +'<div class="mqt-chs">';
    L.choices.forEach(function(c, k){
      h+='<div class="mqt-ch'+(k===L.answer?' ans':'')+'"><label class="mqt-rad" title="정답"><input type="radio" name="mq-ans-'+i+'"'+(k===L.answer?' checked':'')+' onchange="mqAns('+i+','+k+')">정답</label>'
        +'<input type="text" class="mqt-in" aria-label="보기 '+(k+1)+'" value="'+mqE(c)+'" oninput="mqCh('+i+','+k+',this.value)" placeholder="보기 '+(k+1)+'">'
        +(L.choices.length>2?'<button type="button" class="mqt-x" onclick="mqChDel('+i+','+k+')" aria-label="보기 빼기">✕</button>':'')+'</div>';
    });
    h+='</div>'+(L.choices.length<5?'<button type="button" class="mqt-b sm" onclick="mqChAdd('+i+')">+ 보기</button>':'')
      +'<input type="text" class="mqt-in src" aria-label="출처" value="'+mqE(L.src)+'" oninput="mqSet('+i+',\'src\',this.value)" placeholder="출처 메모 (예: 쎈 p.19 #4 숫자 바꿈 — 학생에겐 안 보임)"></div>';
  } else {
    h+='<div class="mqt-tagc"><span class="mqt-tag t3">📌 아하 포인트</span></div>'
      +'<textarea class="mqt-ta" rows="2" aria-label="아하 포인트" oninput="mqSet('+i+',\'text\',this.value);mqFit(this)" placeholder="정수쌤의 아하 포인트">'+mqE(L.text)+'</textarea>';
  }
  return h+'<button type="button" class="mqt-x del" onclick="mqDel('+i+')" aria-label="'+(i+1)+'번 줄 지우기">✕</button></div>';
}
function mqCenterHtml(){
  var c=MQ.cur;
  if(!c) return '<div class="mqt-card mqt-empty"><div style="font-size:40px">🧠</div><b>왼쪽에서 단원을 고르거나 「+ 새 퀴즈」</b><div class="mqt-sub">처음이면 「📘 예시 불러오기」로 시안의 «동위각과 엇각» 퀴즈를 열어 보세요.</div>'
    +'<div class="mqt-btns" style="justify-content:center"><button type="button" class="mqt-b pri" onclick="mqSample()">📘 예시 불러오기</button><button type="button" class="mqt-b" onclick="mqNew()">+ 새 퀴즈</button></div></div>';
  var n=mqStuOf(c.grade).length, gk=String(c.grade).split('-')[0];
  var h='<div class="mqt-hd"><div class="mqt-meta">'
    +'<label>제목 <input type="text" class="mqt-in" id="mq-title" value="'+mqE(c.title)+'" oninput="mqMeta(\'title\',this.value)"></label>'
    +'<label class="sm">단원 <input type="text" class="mqt-in" id="mq-unit" value="'+mqE(c.unit)+'" oninput="mqMeta(\'unit\',this.value)"></label>'
    +'<label>시험 범위 메모 <input type="text" class="mqt-in" id="mq-scope" value="'+mqE(c.scope)+'" oninput="mqMeta(\'scope\',this.value)" placeholder="예: 옥길중 2학기 기말"></label></div>'
    +'<div class="mqt-acts"><span class="mqt-grade">'+mqE(c.grade)+'</span>'+mqStatusTag(c.status)
    +'<span id="mq-dirty" class="mqt-dirty'+(MQ.dirty?' on':'')+'">'+(MQ.dirty?'● 저장 안 됨':'✓ 저장됨')+'</span><span style="flex:1"></span>'
    +'<button type="button" class="mqt-b" id="mq-save" onclick="mqSave(\'save\')"'+(MQ.saving?' disabled':'')+'>'+(c.status==='pub'?'💾 고친 것 저장':'💾 임시저장')+'</button>'
    +(c.status==='pub'?'<button type="button" class="mqt-b" onclick="mqSave(\'unpub\')">발행 내리기</button>':'<button type="button" class="mqt-b go" id="mq-pub" onclick="mqSave(\'pub\')"'+(MQ.saving?' disabled':'')+'>🚀 발행 ('+mqE(gk)+' '+n+'명)</button>')
    +(c.status!=='new'?'<button type="button" class="mqt-b sm ghost" onclick="mqHide()" title="목록에서 빼기">🗑</button>':'')
    +'</div></div>';
  h+='<div class="mqt-ai">🤖 <b>대본 만들기</b> — 메모·재료를 보고 AI 가 초안을 써요(원장님 열쇠). 채팅에서 만든 대본은 붙여 넣으세요.'
    +'<textarea class="mqt-ta notes" id="mq-notes" rows="2" oninput="mqMeta(\'notes\',this.value);mqFit(this)" placeholder="메모 (예: 학생들이 평행이 아닌데 동위각을 같다고 봄 38% · 엇각 Z자 강조)">'+mqE(c.notes||'')+'</textarea>'
    +'<div class="mqt-btns"><button type="button" class="mqt-b pri" id="mq-ai" onclick="mqAi()"'+(MQ.aiBusy?' disabled':'')+'>🤖 AI 초안</button>'
    +'<button type="button" class="mqt-b" onclick="mqAi(\'더 쉽게 — 중1도 바로 알아듣게 낱말을 쉽게, 예를 하나 더\')"'+(MQ.aiBusy||!c.lines.length?' disabled':'')+'>더 쉽게</button>'
    +'<button type="button" class="mqt-b" onclick="mqAi(\'더 짧게 — 8줄 안팎으로 줄이고 문제 1개만\')"'+(MQ.aiBusy||!c.lines.length?' disabled':'')+'>더 짧게</button>'
    +'<button type="button" class="mqt-b" id="mq-paste" onclick="mqPasteOpen()">📋 대본 붙여넣기</button></div>'
    +(MQ.aiMsg?'<div class="mqt-aimsg" aria-live="polite">'+mqE(MQ.aiMsg)+'</div>':'')+'</div>';
  h+='<div class="mqt-rows" id="mq-rows">';
  if(!c.lines.length) h+='<div class="mqt-sub" style="padding:14px;text-align:center">아직 줄이 없어요 — 아래 단추로 넣거나 🤖 AI 초안 · 📋 붙여넣기</div>';
  c.lines.forEach(function(L, i){ h+=mqRowHtml(L, i, c.lines.length); });
  h+='</div><div class="mqt-add"><button type="button" onclick="mqAdd(\'say\')">+ 💬 대사</button><button type="button" onclick="mqAdd(\'card\')">+ 🟩 개념 카드</button><button type="button" onclick="mqAdd(\'quiz\')">+ ✋ 문제</button><button type="button" onclick="mqAdd(\'point\')">+ 📌 아하 포인트</button></div>';
  return h;
}
function mqRightHtml(){
  var c=MQ.cur; if(!c) return '<div class="mqt-phone"><div class="mqt-ptop">🧠 루멘 수학퀴즈<small>학생앱 미리보기</small></div><div class="mqt-pbody">'+MQR.cast(70)+'<div class="mqt-pempty">퀴즈를 고르면 학생앱 모습이 여기 보여요</div></div></div>';
  return '<div class="mqt-phone"><div class="mqt-ptop"><span id="mq-prev-t">💬 '+mqE(c.title||'제목 없음')+'</span><small id="mq-prev-n">학생앱 미리보기 · '+c.lines.length+'줄</small></div><div class="mqt-pbody" id="mq-prev">'+mqPrevBody()+'</div></div>'
    +'<div class="mqt-sub" style="margin-top:6px">고치면 바로 여기 반영 · 🔊 기기 음성으로 들어보기 · 보기를 눌러 정답 확인 <button type="button" class="mqt-b sm" onclick="mqPrevReset()">↺ 답 지우기</button><br>학생앱에서는 «다음»을 누를 때마다 한 줄씩 나와요. 교재 그림은 학생에게 안 보여요.</div>';
}
function mqMakeHtml(){
  return '<div class="mqt-make"><div class="mqt-grid"><div class="mqt-l">'+mqLeftHtml()+'</div><div class="mqt-c">'+mqCenterHtml()+'</div><div class="mqt-r">'+mqRightHtml()+'</div></div>'
    +(MQ.msg?'<div class="mqt-msg" aria-live="polite">'+mqE(MQ.msg)+'</div>':'')+'</div>';
}

/* ── 📊 학생 현황 ── */
function mqLogsLoad(force){
  if(MQ.logsBusy) return; if(!force && MQ.logs && Date.now()-MQ.logsAt<60000) return;
  var sb=htSb(); if(!sb) return; MQ.logsBusy=true;
  function grab(pre){ return sb.from('lumen_store').select('key,value').like('key', pre+'%').then(function(r){ if(r&&r.error) throw r.error; var m={}; ((r&&r.data)||[]).forEach(function(row){ var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } if(v) m[String(row.key).slice(pre.length)]=v; }); return m; }); }
  Promise.all([grab('quizlog_'), grab('wordlog_')]).then(function(a){ MQ.logs=a[0]; MQ.wlogs=a[1]; MQ.logsAt=Date.now(); })
    .catch(function(e){ MQ.logs=MQ.logs||{}; MQ.wlogs=MQ.wlogs||{}; MQ.msg='⚠️ 학생 기록을 읽지 못했어요: '+String((e&&e.message)||e); })
    .then(function(){ MQ.logsBusy=false; if(VIEW==='mathquiz') render(); });
}
window.mqStatPick=function(id){ MQ.statQ=id; render(); };
window.mqStatReload=function(){ MQ.docs={}; mqLogsLoad(true); mqKick(true); render(); };
function mqDoc(id){
  if(MQ.docs[id]) return MQ.docs[id];
  if(MQ.docs[id]===undefined){ MQ.docs[id]=null; htKv('quiz_'+id).then(function(v){ MQ.docs[id]=v||{ lines:[] }; if(VIEW==='mathquiz') render(); }).catch(function(){ MQ.docs[id]={ lines:[] }; }); }
  return null;
}
function mqFmtSec(s){ s=Math.round(s); return s>=60?(Math.floor(s/60)+'분 '+(s%60)+'초'):(s+'초'); }
function mqStatHtml(){
  var all=mqItems(''), pubs=all.filter(function(x){ return x.status==='pub'; });
  if(!MQ.statQ || !mqItem(MQ.statQ)){ var p=pubs.filter(function(x){ return x.grade===MQ.grade; })[0]||pubs[0]||all[0]; MQ.statQ=p?p.id:''; }
  var h='<div class="mqt-card"><div class="mqt-chips">';
  all.slice().sort(function(a,b){ return (a.grade>b.grade?1:a.grade<b.grade?-1:0)||(MQR.unitRank(a.unit)-MQR.unitRank(b.unit)); }).forEach(function(it){
    h+='<button type="button" class="mqt-chip'+(it.id===MQ.statQ?' on':'')+'" onclick="mqStatPick(\''+mqE(it.id)+'\')">'+mqE(it.grade+' '+it.unit+' '+(it.title||''))+(it.status==='pub'?'':' <small>초안</small>')+'</button>';
  });
  h+='<button type="button" class="mqt-b sm" onclick="mqStatReload()">↻ 새로 읽기</button></div></div>';
  if(!all.length) return h+'<div class="mqt-card mqt-empty">아직 만든 퀴즈가 없어요 — ✍️ 만들기에서 만들고 발행해 주세요</div>';
  var it=mqItem(MQ.statQ), d=mqDoc(MQ.statQ);
  if(!MQ.logs || !d) return h+'<div class="mqt-card mqt-empty">⏳ 학생 기록을 불러오는 중…</div>';
  var lines=d.lines||[], nL=lines.length, target=mqStuOf(it.grade), logs=MQ.logs||{};
  var codes={}; target.forEach(function(s){ codes[s.lumen_rec_code]=s; });
  Object.keys(logs).forEach(function(cd){ var e=logs[cd]&&logs[cd].byQuiz&&logs[cd].byQuiz[it.id]; if(e && !codes[cd]){ var s=mqStu().filter(function(x){ return x.lumen_rec_code===cd; })[0]; codes[cd]=s||{ name:'('+cd+')', lumen_rec_code:cd }; } });
  var rows=Object.keys(codes).map(function(cd){ var e=(logs[cd]&&logs[cd].byQuiz&&logs[cd].byQuiz[it.id])||null; return { s:codes[cd], e:e }; });
  var done=0, started=0, qOk=0, qAll=0, tSum=0, tN=0, saved=0, stop=0, unseen=[];
  rows.forEach(function(r){ var e=r.e; if(!e){ unseen.push(r.s); return; }
    if(e.done) done++; else { started++; stop++; }
    Object.keys(e.ans||{}).forEach(function(k){ qAll++; if(e.ans[k]&&e.ans[k].ok) qOk++; });
    if(e.saved) saved++;
    if(e.done && e.startAt && e.doneAt){ var sec=(Date.parse(e.doneAt)-Date.parse(e.startAt))/1000; if(sec>0 && sec<7200){ tSum+=sec; tN++; } } });
  var nT=target.length||rows.length;
  h+='<div class="mqt-hd2"><b>📊 '+mqE(it.unit+' '+(it.title||''))+'</b><small>'+(it.pubAt?mqE(String(it.pubAt).slice(5,10).replace('-','/'))+' 발행 · ':'')+mqE(it.grade)+' '+target.length+'명</small><span style="flex:1"></span>'
    +'<button type="button" class="mqt-b sm" disabled title="학생앱으로 알림 보내는 길이 아직 없어요 (다음 판)">💬 안 본 학생 '+unseen.length+'명에게 알림 (준비 중)</button>'
    +(unseen.length?'<button type="button" class="mqt-b sm" onclick="mqCopyNames()">📋 이름 복사</button>':'')+'</div>';
  MQ._unseen=unseen.map(function(s){ return s.name; });
  h+='<div class="mqt-kpi"><div><b id="mq-k-done">'+done+'<small>/'+nT+'</small></b><span>끝까지 봄</span></div>'
    +'<div><b style="color:#15803d" id="mq-k-acc">'+(qAll?Math.round(qOk*100/qAll)+'%':'—')+'</b><span>문제 정답률'+(qAll?' ('+qOk+'/'+qAll+')':'')+'</span></div>'
    +'<div><b id="mq-k-time">'+(tN?mqFmtSec(tSum/tN):'—')+'</b><span>평균 시간</span></div>'
    +'<div><b id="mq-k-saved">'+saved+'</b><span>📒 담음</span></div>'
    +'<div><b style="color:#dc2626" id="mq-k-stop">'+stop+'</b><span>중간에 멈춤</span></div></div>';
  h+='<div class="mqt-two"><div class="mqt-card"><h4>학생별 <small>· 칸 = 줄('+nL+') · ✓ 봄 · O/X 문제 · … 여기서 멈춤</small></h4><div class="mqt-tw"><table class="mqt-tbl" id="mq-stat-tbl"><thead><tr><th class="l">학생</th>';
  lines.forEach(function(L, i){ h+='<th title="'+mqE(MQR.TYPE_NM[L.t]||'')+'">'+(i+1)+(L.t==='quiz'?'<br>✋':(L.t==='point'?'<br>📌':''))+'</th>'; });
  h+='<th>📒</th><th>시간</th></tr></thead><tbody>';
  rows.sort(function(a,b){ var pa=a.e?(a.e.done?1000:(a.e.step||0)):-1, pb=b.e?(b.e.done?1000:(b.e.step||0)):-1; return (pb-pa)||String(a.s.name||'').localeCompare(String(b.s.name||''),'ko'); });
  rows.forEach(function(r){
    var e=r.e; h+='<tr data-code="'+mqE(r.s.lumen_rec_code)+'"><td class="l"><b>'+mqE(r.s.name||'')+'</b> <small>'+mqE(r.s.group||'')+'</small></td>';
    lines.forEach(function(L, i){
      var cell='<span class="mqt-dot d0">·</span>';
      if(e){ var seen=e.done||i<(e.step||0)||(i===(e.step||0)&&L.t==='quiz'&&e.ans&&e.ans[i]);
        if(L.t==='quiz' && e.ans && e.ans[i]) cell=e.ans[i].ok?'<span class="mqt-dot d1">O</span>':'<span class="mqt-dot dx">X</span>';
        else if(seen) cell='<span class="mqt-dot d1">✓</span>';
        else if(i===(e.step||0)) cell='<span class="mqt-dot dh">…</span>'; }
      h+='<td>'+cell+'</td>';
    });
    var tm=''; if(e&&e.done&&e.startAt&&e.doneAt){ var sec=(Date.parse(e.doneAt)-Date.parse(e.startAt))/1000; if(sec>0) tm=mqFmtSec(sec); }
    h+='<td>'+(e&&e.saved?'📒':'')+'</td><td class="tm">'+tm+'</td></tr>';
  });
  h+='</tbody></table></div></div>';
  /* 낱말 헷갈려요 순위 */
  var wg=it.grade, wl=MQ.words[wg]; if(wl===undefined) mqWordsLoad(wg);
  var cnt={}, inList={}; ((wl&&wl.days)||[]).forEach(function(dy){ (dy.words||[]).forEach(function(w){ if(w&&w.w) inList[w.w]=1; }); });
  var tcodes={}; target.forEach(function(s){ tcodes[s.lumen_rec_code]=1; });
  Object.keys(MQ.wlogs||{}).forEach(function(cd){ if(!tcodes[cd]) return; var cf=(MQ.wlogs[cd]&&MQ.wlogs[cd].confused)||{}; Object.keys(cf).forEach(function(w){ if(Object.keys(inList).length && !inList[w]) return; cnt[w]=(cnt[w]||0)+1; }); });
  var top=Object.keys(cnt).sort(function(a,b){ return cnt[b]-cnt[a]||a.localeCompare(b,'ko'); }).slice(0,10), mx=top.length?cnt[top[0]]:1;
  h+='<div class="mqt-card"><h4>🍙 «헷갈려요»가 많은 낱말 <small>· '+mqE(wg)+' 학생</small></h4><div id="mq-wrank">';
  if(!top.length) h+='<div class="mqt-sub">아직 «헷갈려요»를 누른 학생이 없어요</div>';
  top.forEach(function(w){ h+='<div class="mqt-wrd"><span>'+mqE(w)+'</span><span class="mqt-bar"><i style="width:'+Math.round(cnt[w]*100/Math.max(1,target.length||mx))+'%"></i></span><span>'+cnt[w]+'명</span></div>'; });
  h+='<div class="mqt-sub" style="margin-top:8px">많이 헷갈린 낱말은 ✍️ 만들기에서 짧은 보충 퀴즈로 만들어 보세요</div></div></div></div>';
  return h;
}
window.mqCopyNames=function(){ var t=(MQ._unseen||[]).join(', '); try{ navigator.clipboard.writeText(t).then(function(){ mqToast('이름을 복사했어요 ('+(MQ._unseen||[]).length+'명)'); }, function(){ prompt('아래 이름을 복사하세요', t); }); }catch(e){ prompt('아래 이름을 복사하세요', t); } };

/* ── 🍙 낱말 Day ── */
function mqWordsLoad(g, force){
  if(!g || MQ.wBusy[g]) return; if(MQ.words[g]!==undefined && !force) return;
  MQ.wBusy[g]=true;
  htKv('quiz_words_'+g).then(function(v){ MQ.words[g]=(v&&Array.isArray(v.days))?v:{ days:[] }; })
    .catch(function(){ MQ.words[g]=MQ.words[g]||{ days:[] }; })
    .then(function(){ MQ.wBusy[g]=false; if(VIEW==='mathquiz') render(); });
}
function mqWDirty(){ MQ.wDirty=true; var d=document.getElementById('mq-wdirty'); if(d){ d.textContent='● 저장 안 됨'; d.className='mqt-dirty on'; } }
window.mqWGrade=function(g){ if(MQ.wDirty && !confirm('저장하지 않은 낱말 고침이 있어요. 버리고 넘어갈까요?')) return; if(MQ.wDirty){ delete MQ.words[MQ.wGrade]; MQ.wDirty=false; } MQ.wGrade=g; MQ.wDay=0; mqWordsLoad(g); render(); };
window.mqWDay=function(k){ MQ.wDay=k; render(); };
window.mqWDayAdd=function(){ var W=MQ.words[MQ.wGrade]; if(!W) return; var n=W.days.reduce(function(m,d){ return Math.max(m, Number(d.n)||0); }, 0)+1; W.days.push({ n:n, words:[] }); MQ.wDay=W.days.length-1; mqWDirty(); render(); };
window.mqWDayDel=function(){ var W=MQ.words[MQ.wGrade]; if(!W||!W.days[MQ.wDay]) return; if(!confirm('Day '+W.days[MQ.wDay].n+' (낱말 '+(W.days[MQ.wDay].words||[]).length+'개)를 지울까요?')) return; W.days.splice(MQ.wDay,1); MQ.wDay=Math.max(0, MQ.wDay-1); mqWDirty(); render(); };
window.mqWAdd=function(){ var W=MQ.words[MQ.wGrade], D=W&&W.days[MQ.wDay]; if(!D) return; D.words=D.words||[]; D.words.push({ w:'', hanja:'', hj:'', mean:'', say:'', ex:'', unit:'' }); mqWDirty(); render(); };
window.mqWDel=function(k){ var D=MQ.words[MQ.wGrade]&&MQ.words[MQ.wGrade].days[MQ.wDay]; if(!D||!D.words[k]) return; if(String(D.words[k].w).trim() && !confirm('«'+D.words[k].w+'»를 지울까요?')) return; D.words.splice(k,1); mqWDirty(); render(); };
window.mqWSet=function(k, f, v){ var D=MQ.words[MQ.wGrade]&&MQ.words[MQ.wGrade].days[MQ.wDay]; if(!D||!D.words[k]) return; D.words[k][f]=v; mqWDirty(); };
window.mqWSample=function(){ var W=MQ.words[MQ.wGrade]; if(!W) return; var s=MQR.sampleWords(); W.days=W.days.concat(s.days.map(function(d){ return { n:(W.days.length+1), words:d.words }; })); MQ.wDay=W.days.length-1; mqWDirty(); render(); };
window.mqWPaste=function(){
  var W=MQ.words[MQ.wGrade]; if(!W) return;
  var t=prompt('낱말 JSON 을 붙여 넣으세요\n· {"days":[{"n":1,"words":[…]}]} → Day 들을 바꿈\n· [{"w":"동위각",…}] → 지금 Day 뒤에 붙임'); if(t==null) return;
  var v; try{ v=JSON.parse(String(t).replace(/```json|```/g,'').trim()); }catch(e){ alert('JSON 모양이 아니에요: '+e.message); return; }
  function nw(x){ if(!x||!x.w) return null; var o={}; ['w','hanja','hj','mean','say','ex','unit','who'].forEach(function(k){ if(x[k]!=null && x[k]!=='') o[k]=String(x[k]); }); return o; }
  if(v && Array.isArray(v.days)){ W.days=v.days.map(function(d, i){ return { n:Number(d.n)||(i+1), words:(d.words||[]).map(nw).filter(Boolean) }; }); MQ.wDay=0; }
  else if(Array.isArray(v)){ if(!W.days.length) W.days.push({ n:1, words:[] }); var D=W.days[MQ.wDay]||W.days[0]; D.words=(D.words||[]).concat(v.map(nw).filter(Boolean)); }
  else { alert('days 또는 낱말 목록을 찾지 못했어요'); return; }
  mqWDirty(); render();
};
window.mqWSave=async function(){
  var g=MQ.wGrade, W=MQ.words[g]; if(!W) return;
  var days=W.days.map(function(d){ return { n:Number(d.n)||1, words:(d.words||[]).filter(function(w){ return w&&String(w.w||'').trim(); }).map(function(w){ var o={}; Object.keys(w).forEach(function(k){ if(String(w[k]==null?'':w[k]).trim()) o[k]=String(w[k]).trim(); }); return o; }) }; });
  try{ await htKvSet('quiz_words_'+g, { grade:g, days:days, updatedAt:mqNow() }); W.days=days; MQ.wDirty=false; mqToast('🍙 '+g+' 낱말을 저장했어요 — 학생앱에 바로 보여요'); }
  catch(e){ alert('저장하지 못했어요: '+String((e&&e.message)||e)); }
  render();
};
function mqWordsHtml(){
  var g=MQ.wGrade, W=MQ.words[g]; if(W===undefined) mqWordsLoad(g);
  var h='<div class="mqt-card"><div class="mqt-chips">';
  MQ_GRADES.forEach(function(x){ h+='<button type="button" class="mqt-chip'+(x===g?' on':'')+'" onclick="mqWGrade(\''+x+'\')">'+x+'</button>'; });
  h+='</div></div>';
  if(!W) return h+'<div class="mqt-card mqt-empty">⏳ 불러오는 중…</div>';
  h+='<div class="mqt-hd2"><b>🍙 '+mqE(g)+' 수학 낱말 Day</b><small>하루 10개 안팎 · 학생은 «알아요/헷갈려요» · 헷갈린 낱말은 다음 날 다시 나와요</small><span style="flex:1"></span>'
    +'<span id="mq-wdirty" class="mqt-dirty'+(MQ.wDirty?' on':'')+'">'+(MQ.wDirty?'● 저장 안 됨':'✓ 저장됨')+'</span>'
    +'<button type="button" class="mqt-b sm" onclick="mqWPaste()">📋 JSON 붙여넣기</button><button type="button" class="mqt-b sm" onclick="mqWSample()">📘 예시</button><button type="button" class="mqt-b go" id="mq-wsave" onclick="mqWSave()">💾 저장</button></div>';
  h+='<div class="mqt-card"><div class="mqt-chips">';
  W.days.forEach(function(d, k){ h+='<button type="button" class="mqt-chip'+(k===MQ.wDay?' on':'')+'" onclick="mqWDay('+k+')">Day '+mqE(d.n)+' <small>'+((d.words||[]).length)+'</small></button>'; });
  h+='<button type="button" class="mqt-b sm" id="mq-wday-add" onclick="mqWDayAdd()">+ Day</button>'+(W.days[MQ.wDay]?'<button type="button" class="mqt-b sm ghost" onclick="mqWDayDel()">Day 지우기</button>':'')+'</div>';
  var D=W.days[MQ.wDay];
  if(!D) h+='<div class="mqt-sub">아직 Day 가 없어요 — 「+ Day」 또는 「📋 JSON 붙여넣기」 (채팅에서 만든 낱말)</div>';
  else {
    h+='<div class="mqt-wgrid">';
    (D.words||[]).forEach(function(w, k){
      function f(key, lab, ph, wide){ return '<label class="'+(wide?'wide':'')+'">'+lab+'<input type="text" class="mqt-in" value="'+mqE(w[key]||'')+'" oninput="mqWSet('+k+',\''+key+'\',this.value)" placeholder="'+mqE(ph||'')+'"></label>'; }
      h+='<div class="mqt-wcard" data-k="'+k+'"><div class="mqt-wtop"><b>'+(k+1)+'</b>'+f('w','낱말','동위각')+f('hanja','한자','同位角')+f('unit','단원','Ⅰ-3')+'<button type="button" class="mqt-x" onclick="mqWDel('+k+')" aria-label="낱말 지우기">✕</button></div>'
        +f('hj','한자 풀이','同 같을 동 · 位 자리 위 · 角 뿔 각', 1)+f('mean','뜻','두 직선이 한 직선과 만날 때 같은 위치에 있는 두 각', 1)
        +f('say','캐릭터 한마디','«같은(同) 자리(位)»의 각! 모양은 F자.', 1)+f('ex','예문','«l ∥ m 이면 동위각의 크기는 서로 같다»', 1)+'</div>';
    });
    h+='</div><button type="button" class="mqt-b" id="mq-wadd" onclick="mqWAdd()">+ 낱말</button>';
    if((D.words||[]).length){ h+='<div class="mqt-sub" style="margin:10px 0 4px">학생앱 미리보기</div><div class="mqt-wprev">'; D.words.forEach(function(w, k){ if(String(w.w||'').trim()) h+=MQR.word(w, k); }); h+='</div>'; }
  }
  return h+'</div>';
}

/* ── 🎨 캐릭터 ── */
function mqCharHtml(){
  var h='<div class="mqt-sub" style="margin-bottom:8px">지금 그림은 시안용 도트(전신 72×96 · 얼굴 64×52)입니다. 최종 그림이 오면 <b>docs/char_px2</b> 의 PNG 만 같은 이름으로 바꾸고 다시 조립하면 학원앱·학생앱이 함께 바뀝니다.</div><div class="mqt-chars">';
  MQR.ORDER.forEach(function(k){
    var W=MQR.WHO[k]; h+='<div class="mqt-card mqt-char"><h4>'+mqE(W.nm)+' <small>'+mqE(W.role)+'</small></h4><div class="mqt-faces">';
    W.faces.forEach(function(f){ h+='<div><span class="mqt-cbg" style="background:'+W.bg+'">'+MQR.img(k, f, 'full', 72, 96)+'</span><span class="mqt-cbg" style="background:'+W.bg+'">'+MQR.img(k, f, 'head', 64, 52)+'</span><small>'+MQR.FACE_NM[f]+'</small></div>'; });
    h+='</div></div>';
  });
  return h+'</div><div class="mqt-sub">대본에서 쓰는 이름: who = lumi(루미) · aha(아하) · ssam(정수쌤) · face = base(기본) · oops(루미 당황) · aha(아하 💡). 없는 표정은 기본 얼굴로 보여요.</div>';
}

/* ── 화면 ── */
function rMathQuiz(){
  mqrCss('mqr-css'); mqCss(); mqKick();
  var tabs=[['make','✍️ 만들기'],['stat','📊 학생 현황'],['words','🍙 낱말 Day'],['char','🎨 캐릭터']];
  var h='<div class="mqt"><div class="mqt-top"><b>🧠 루멘 수학퀴즈</b><small>루미 · 아하 · 정수쌤이 대화로 알려 주는 개념 퀴즈 · 학생앱 «🧠 루멘 수학퀴즈»</small></div><div class="mqt-tabs" role="tablist">';
  tabs.forEach(function(t){ h+='<button type="button" role="tab" class="mqt-tab'+(MQ.tab===t[0]?' on':'')+'" data-tab="'+t[0]+'" aria-selected="'+(MQ.tab===t[0])+'" onclick="mqTab(\''+t[0]+'\')">'+t[1]+'</button>'; });
  h+='</div>';
  if(MQ.idxErr) h+='<div class="mqt-msg">⚠️ 퀴즈 목록을 읽지 못했어요: '+mqE(MQ.idxErr)+'</div>';
  if(MQ.tab==='make') h+=(MQ.idx?mqMakeHtml():'<div class="mqt-card mqt-empty">⏳ 퀴즈 목록 불러오는 중…</div>');
  else if(MQ.tab==='stat'){ mqLogsLoad(false); h+=(MQ.idx?mqStatHtml():'<div class="mqt-card mqt-empty">⏳ 불러오는 중…</div>'); }
  else if(MQ.tab==='words') h+=mqWordsHtml();
  else h+=mqCharHtml();
  setTimeout(mqFitAll, 0);
  return h+'</div>';
}
function mqCss(){
  if(document.getElementById('mqt-css')) return;
  var s=document.createElement('style'); s.id='mqt-css'; s.textContent=''
    +'.mqt{padding:4px 2px 30px;color:#0f172a;font-size:13px;max-width:100%;min-width:0}'
    +'.mqt *{box-sizing:border-box}'
    +'.mqt-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 8px}.mqt-top b{font-size:18px}.mqt-top small{color:#64748b;font-weight:700}'
    +'.mqt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.mqt-tab{background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:8px 14px;font-weight:800;color:#475569;cursor:pointer;font-family:inherit;font-size:13px;min-height:38px}'
    +'.mqt-tab.on{background:#0d2240;color:#fff;border-color:#0d2240}'
    +'.mqt-make{container-type:inline-size}'
    +'.mqt-grid{display:grid;grid-template-columns:230px minmax(0,1fr) 330px;gap:12px;align-items:start}'
    +'.mqt-l,.mqt-c,.mqt-r{min-width:0}.mqt-r{position:sticky;top:8px}'
    +'.mqt-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:11px;margin-bottom:10px;min-width:0}'
    +'.mqt-card h4{margin:0 0 8px;font-size:13.5px}.mqt-card h4 small{color:#64748b;font-weight:700;font-size:11.5px}'
    +'.mqt-empty{text-align:center;padding:26px 12px;color:#334155;line-height:1.7}'
    +'.mqt-sub{font-size:11.5px;color:#64748b;line-height:1.6;margin-top:4px}.mqt-sub code{background:#f1f5f9;border-radius:4px;padding:0 4px}'
    +'.mqt-chips{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;align-items:center}'
    +'.mqt-chip{border:1.5px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 10px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;color:#334155;min-height:34px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    +'.mqt-chip.on{background:#0f766e;border-color:#0f766e;color:#fff}.mqt-chip small{font-size:10.5px;opacity:.8}'
    +'.mqt-units{max-height:420px;overflow:auto;margin:4px 0 6px}'
    +'.mqt-unit{display:flex;align-items:center;gap:6px;width:100%;text-align:left;padding:8px;border-radius:9px;font-weight:800;font-size:12.5px;border:1.5px solid transparent;background:none;cursor:pointer;font-family:inherit;color:#0f172a;margin-bottom:2px;min-height:38px}'
    +'.mqt-unit:hover{background:#f8fafc}.mqt-unit.on{background:#fffbeb;border-color:#fbbf24}.mqt-unit b{color:#475569;flex:0 0 auto}'
    +'.mqt-st{margin-left:auto;font-size:10.5px;font-weight:900;border-radius:999px;padding:1px 7px;background:#f1f5f9;color:#64748b;flex:0 0 auto;white-space:nowrap}.mqt-st.pub{background:#dcfce7;color:#15803d}.mqt-st.dr{background:#fef3c7;color:#b45309}.mqt-st.nw{background:#e0e7ff;color:#3730a3}'
    +'.mqt-btns{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center}'
    +'.mqt-b{border:1px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:9px;padding:7px 11px;font-weight:900;font-size:12.5px;cursor:pointer;font-family:inherit;min-height:36px}'
    +'.mqt-b:disabled{opacity:.5;cursor:default}.mqt-b.pri{background:#0d2240;color:#fff;border-color:#0d2240}.mqt-b.go{background:#16a34a;color:#fff;border-color:#16a34a}.mqt-b.sm{padding:4px 9px;font-size:11.5px;min-height:30px}.mqt-b.ghost{border-color:transparent;color:#64748b}'
    +'.mqt-file{display:flex;gap:6px;align-items:center;font-size:12px;background:#f8fafc;border-radius:8px;padding:5px 8px;margin-top:5px;font-weight:700;min-width:0}.mqt-file a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0d2240}'
    +'.mqt-drop{display:block;border:2px dashed #cbd5e1;border-radius:12px;padding:12px;text-align:center;color:#64748b;font-weight:700;margin-top:8px;line-height:1.6;cursor:pointer}.mqt-drop b{color:#0d2240}'
    +'.mqt-x{border:none;background:none;color:#94a3b8;font-weight:900;cursor:pointer;font-size:14px;padding:4px 6px;min-width:30px;min-height:30px}.mqt-x:hover{color:#dc2626}'
    +'.mqt-hd{background:#0d2240;color:#fff;border-radius:14px;padding:10px 12px;margin-bottom:8px}'
    +'.mqt-meta{display:flex;gap:8px;flex-wrap:wrap}.mqt-meta label{display:flex;flex-direction:column;gap:2px;font-size:10.5px;font-weight:800;color:#cbd5e1;flex:1 1 160px;min-width:0}.mqt-meta label.sm{flex:0 1 80px}'
    +'.mqt-meta .mqt-in{background:#fff}'
    +'.mqt-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.mqt-grade{font-weight:900;background:rgba(255,255,255,.14);border-radius:6px;padding:2px 8px}'
    +'.mqt-dirty{font-size:11px;font-weight:800;color:#86efac}.mqt-dirty.on{color:#fbbf24}'
    +'.mqt-in{font:inherit;font-size:13px;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;width:100%;min-width:0;color:#0f172a;background:#fff}'
    +'.mqt-ta{font:inherit;font-size:13px;line-height:1.55;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;width:100%;min-width:0;resize:vertical;color:#0f172a;background:#fff;min-height:38px}'
    +'.mqt-ta:focus,.mqt-in:focus{outline:2px solid #93c5fd;border-color:#93c5fd}'
    +'.mqt-ai{background:#faf5ff;border:1.5px solid #e9d5ff;border-radius:12px;padding:9px 10px;margin-bottom:8px;font-size:12px;line-height:1.6}.mqt-ai b{color:#6b21a8}.mqt-ai .notes{margin-top:6px;background:#fff}'
    +'.mqt-aimsg{margin-top:6px;font-weight:800;color:#6b21a8}'
    +'.mqt-row{display:grid;grid-template-columns:52px 104px minmax(0,1fr) 30px;gap:8px;align-items:start;border:1.5px solid #e2e8f0;border-radius:12px;padding:7px 8px;margin-bottom:7px;background:#fff}'
    +'.mqt-row.k-card{background:#f0fdf4;border-color:#86efac;border-style:dashed}.mqt-row.k-quiz{background:#fffbeb;border-color:#fcd34d;border-style:dashed}.mqt-row.k-point{background:#eef2ff;border-color:#a5b4fc;border-style:dashed}'
    +'.mqt-h{display:flex;flex-direction:column;align-items:center;gap:2px}.mqt-n{font-size:10.5px;font-weight:900;color:#94a3b8;cursor:grab;white-space:nowrap}'
    +'.mqt-mv{border:1px solid #e2e8f0;background:#fff;border-radius:6px;width:30px;height:24px;font-weight:900;color:#475569;cursor:pointer;font-size:12px;padding:0}.mqt-mv:disabled{opacity:.3}'
    +'.mqt-who{display:flex;flex-direction:column;align-items:flex-start;gap:3px}.mqt-avs{display:inline-flex;border-radius:8px;padding:1px 3px}.mqt-sels{display:flex;gap:3px;flex-wrap:wrap}'
    +'.mqt-sel{font:inherit;font-size:11.5px;font-weight:800;border:1px solid #e2e8f0;border-radius:6px;padding:3px 2px;background:#f8fafc;max-width:100px}'
    +'.mqt-tagc{padding-top:4px}.mqt-tag{display:inline-block;font-size:10.5px;font-weight:900;border-radius:5px;padding:2px 6px}.t1{background:#dcfce7;color:#15803d}.t2{background:#fef3c7;color:#b45309}.t3{background:#e0e7ff;color:#3730a3}'
    +'.mqt-fields{display:flex;flex-direction:column;gap:5px;min-width:0}.mqt-chs{display:flex;flex-direction:column;gap:4px}'
    +'.mqt-ch{display:flex;gap:5px;align-items:center;min-width:0}.mqt-ch.ans .mqt-in{border-color:#22c55e;background:#f0fdf4}'
    +'.mqt-rad{display:flex;align-items:center;gap:2px;font-size:10.5px;font-weight:800;color:#64748b;flex:0 0 auto;white-space:nowrap}.mqt-in.src{font-size:11.5px;color:#64748b}'
    +'.mqt-add{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}.mqt-add button{border:1.5px dashed #cbd5e1;background:#fff;border-radius:9px;padding:7px 10px;font-weight:800;font-size:12px;color:#475569;cursor:pointer;font-family:inherit;min-height:36px}'
    +'@container (max-width:520px){.mqt-row{grid-template-columns:40px minmax(0,1fr) 30px}.mqt-row .mqt-who,.mqt-row .mqt-tagc{grid-column:2}.mqt-row .mqt-ta,.mqt-row .mqt-fields{grid-column:1/-1}.mqt-row .del{grid-column:3;grid-row:1}.mqt-who{flex-direction:row;align-items:center}}'
    +'.mqt-phone{background:#fffaf2;border:7px solid #0f172a;border-radius:24px;overflow:hidden;max-width:360px;margin:0 auto}'
    +'.mqt-ptop{background:#0d2240;color:#fff;padding:9px 11px;font-weight:900;font-size:13px;display:flex;gap:6px;align-items:center}.mqt-ptop span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mqt-ptop small{margin-left:auto;color:#cbd5e1;font-weight:700;font-size:10.5px;white-space:nowrap}'
    +'.mqt-pbody{padding:10px;max-height:640px;overflow:auto}.mqt-pempty{color:#94a3b8;text-align:center;padding:24px 8px;font-weight:700}'
    +'.mqt-msg{margin:8px 0;background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;font-weight:800;color:#713f12}'
    +'.mqt-hd2{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#0d2240;color:#fff;border-radius:14px;padding:10px 12px;margin-bottom:10px}.mqt-hd2 b{font-size:15px}.mqt-hd2 small{color:#cbd5e1}'
    +'.mqt-hd2 .mqt-b{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.25)}.mqt-hd2 .mqt-b.go{background:#16a34a;border-color:#16a34a}'
    +'.mqt-kpi{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-bottom:10px}.mqt-kpi div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:9px 4px;text-align:center;min-width:0}'
    +'.mqt-kpi b{display:block;font-size:20px}.mqt-kpi b small{font-size:12px;color:#64748b}.mqt-kpi span{font-size:11px;color:#64748b;font-weight:700}'
    +'.mqt-two{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:12px}'
    +'@media (max-width:760px){.mqt-two{grid-template-columns:minmax(0,1fr)}.mqt-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}}'
    +'.mqt-tw{overflow-x:auto;max-width:100%}.mqt-tbl{border-collapse:collapse;width:100%;font-size:12px}.mqt-tbl th{background:#f8fafc;color:#475569;font-size:10.5px;padding:5px 3px;text-align:center;border-bottom:1px solid #e2e8f0;line-height:1.2}'
    +'.mqt-tbl td{padding:5px 3px;text-align:center;border-bottom:1px solid #f1f5f9;white-space:nowrap}.mqt-tbl .l{text-align:left}.mqt-tbl .tm{font-size:11px;color:#64748b}'
    +'.mqt-dot{display:inline-block;width:18px;height:18px;border-radius:5px;line-height:18px;font-size:10px;font-weight:900}.d1{background:#dcfce7;color:#15803d}.d0{background:#f1f5f9;color:#cbd5e1}.dx{background:#fee2e2;color:#dc2626}.dh{background:#fef3c7;color:#b45309}'
    +'.mqt-wrd{display:grid;grid-template-columns:80px minmax(0,1fr) 40px;gap:8px;align-items:center;padding:5px 0;border-bottom:1px solid #f1f5f9;font-weight:800}'
    +'.mqt-bar{height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden}.mqt-bar i{display:block;height:100%;background:#f97316}'
    +'.mqt-wgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:8px;margin:6px 0}'
    +'@media (max-width:520px){.mqt-wgrid{grid-template-columns:minmax(0,1fr)}}'
    +'.mqt-wcard{border:1.5px solid #e2e8f0;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:4px;min-width:0}.mqt-wcard label{display:flex;flex-direction:column;font-size:10.5px;font-weight:800;color:#64748b;gap:1px;min-width:0;flex:0 0 auto}.mqt-wtop label{flex:1 1 70px}'
    +'.mqt-wtop{display:flex;gap:5px;align-items:flex-end;min-width:0}.mqt-wtop>b{color:#94a3b8;padding-bottom:8px}'
    +'.mqt-wprev{max-width:380px;background:#fffaf2;border-radius:14px;padding:8px}'
    +'.mqt-chars{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}.mqt-faces{display:flex;gap:12px;flex-wrap:wrap}.mqt-faces>div{display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;color:#475569}'
    +'.mqt-cbg{display:inline-flex;border-radius:12px;padding:4px}'
    +'.mqt-ov{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px}'
    +'.mqt-box{background:#fff;border-radius:16px;padding:16px;width:min(640px,100%);max-height:90vh;overflow:auto}.mqt-box h3{margin:0 0 6px}.mqt-box textarea{width:100%;min-height:220px;font:12px/1.5 ui-monospace,Menlo,monospace;border:1px solid #cbd5e1;border-radius:10px;padding:8px;margin-top:8px}'
    +'@container (max-width:1060px){.mqt-grid{grid-template-columns:minmax(0,1fr) 310px}.mqt-l{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:10px}.mqt-l .mqt-card{margin:0}'
    +'.mqt-units{display:flex;flex-wrap:wrap;gap:4px;max-height:none}.mqt-unit{width:auto;max-width:100%;padding:4px 8px;min-height:34px;border-color:#e2e8f0;margin:0}.mqt-unit .mqt-st{margin-left:4px}}'
    +'@container (max-width:700px){.mqt-grid{grid-template-columns:minmax(0,1fr)}.mqt-l{display:block}.mqt-l .mqt-card{margin-bottom:10px}.mqt-r{position:static}}';
  document.head.appendChild(s);
}
