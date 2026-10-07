/* ═══════════════════════════════════════════════════════════════════
 * v19-80: 📚 기출 DB에서 찾기 — 적중 분석의 두 번째 입구
 * 원장 요청 2026-10-05 「시험지 올리기와 수학비서에 내가 구매한 db가 있으니 수학비서에서 기출을 찾아서 확인하는 기능도 추가하자」
 *  · 목록 = lumen_store ms_mydb_index (서버가 12시간마다 · 「목록 새로 받기」를 누르면 5분 안에) — 1,500여 장
 *  · 👀 보기 = 이미 받아 둔 기출(ms_exams_<학교>)이면 문항 그림을 바로 펼친다
 *  · 🎯 적중 분석 = exam_hit_req 에 mydb(시험지 번호)를 실어 보낸다 → 서버가 그 시험지를 받아 문항 나누기부터
 *  화면에는 「기출 DB」라고만 쓴다. ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var HTDB = { open:false, idx:null, loading:false, err:'', q:'', school:'', grade:'', year:'', sem:'', term:'', view:'', more:false, reqAt:'' };

function htdbShort(t){ return String(t||'').replace(/^내신\s*/,'').replace(/경기\s*부천시\s*/,'').replace(/\s+/g,' ').trim(); }
function htdbLoad(force){
  if((HTDB.idx && !force) || HTDB.loading) return; HTDB.loading=true; HTDB.err='';
  Promise.all([htKv('ms_mydb_index'), htKv('ms_mydb_index_req')]).then(function(a){
    HTDB.loading=false; HTDB.idx=a[0]||{ items:[] }; var r=a[1];
    HTDB.reqAt=(r && r.status==='requested')?r.at:'';
    if(!HTDB.school) HTDB.school=htdbDefaultSchool();
    if(VIEW==='examhit') render();
  }).catch(function(e){ HTDB.loading=false; HTDB.err=String(e.message||e); if(VIEW==='examhit') render(); });
  try{ if(typeof eaMsLoad==='function') eaMsLoad().then(function(){ if(VIEW==='examhit') render(); }); }catch(e){}
}
/* 우리 학생이 가장 많은 학교부터 */
function htdbDefaultSchool(){ var c=htCohorts(), m={}, best='', n=0; Object.keys(c).forEach(function(k){ var s=k.split('|')[0]; m[s]=(m[s]||0)+c[k]; }); Object.keys(m).forEach(function(s){ if(m[s]>n){ n=m[s]; best=s; } }); return best||'옥길중'; }
window.htdbToggle = function(){ HTDB.open=!HTDB.open; if(HTDB.open){ HT.showForm=false; htdbLoad(); } render(); };
window.htdbSet = function(k, v){ HTDB[k]=v; HTDB.view=''; HTDB.more=false; render(); };
window.htdbSearch = function(v){ HTDB.q=v; HTDB.view=''; HTDB.more=false; clearTimeout(HTDB._t); HTDB._t=setTimeout(function(){ var el=document.getElementById('htdb-q'), pos=el?el.selectionStart:null; render(); var e2=document.getElementById('htdb-q'); if(e2){ e2.focus(); try{ e2.setSelectionRange(pos,pos); }catch(_){} } }, 250); };
window.htdbView = function(id){ HTDB.view=(String(HTDB.view)===String(id))?'':id; render(); };
window.htdbRefresh = function(){
  var req={ status:'requested', at:new Date().toISOString(), by:'app' };
  htKvSet('ms_mydb_index_req', req).then(function(){ HTDB.reqAt=req.at; htToast('🔄 5분 안에 서버가 기출 DB 목록을 새로 받습니다 — 잠시 뒤 「🔄 새로고침」'); render(); })
    .catch(function(e){ htToast('실패: '+(e.message||e)); });
};
function htdbList(){
  var items=(HTDB.idx&&HTDB.idx.items)||[], words=String(HTDB.q||'').trim().split(/\s+/).filter(Boolean);
  return items.filter(function(x){
    if(HTDB.school && x.sc!==HTDB.school) return false;
    if(HTDB.grade && x.g!==HTDB.grade) return false;
    if(HTDB.year && String(x.y)!==String(HTDB.year)) return false;
    if(HTDB.sem && String(x.sem)!==String(HTDB.sem)) return false;
    if(HTDB.term && x.term!==HTDB.term) return false;
    for(var i=0;i<words.length;i++){ if(String(x.t).indexOf(words[i])<0 && String(x.f).indexOf(words[i])<0) return false; }
    return true;
  }).sort(function(a,b){ return String(b.y||'').localeCompare(String(a.y||'')) || String(a.g||'').localeCompare(String(b.g||'')) || String(b.sem||'').localeCompare(String(a.sem||'')) || (a.term==='기말'?1:0)-(b.term==='기말'?1:0) || String(a.t).localeCompare(String(b.t)); });
}
/* 이미 받아 둔 기출(ms_exams_<학교>)에 있나 — 있으면 문항 그림을 바로 볼 수 있다 */
function htdbHave(x){ try{ var v=(EA.ms||{})[x.sc]; var e=((v&&v.exams)||[]).filter(function(e){ return String(e.id)===String(x.id); })[0]; return e||null; }catch(e){ return null; } }
function htdbExam(x){ return { school:x.sc, grade:x.g, year:Number(x.y), semester:String(x.sem||''), term:x.term||'', date:'' }; }
function htdbDone(x){ if(!x.sc||!x.g||!x.y||!x.sem||!x.term) return null; var id=htExamId(htdbExam(x)); var it=((HT.idx&&HT.idx.items)||[]).filter(function(i){ return i.examId===id; })[0]; return it?id:null; }
window.htdbAnalyze = function(id){
  var x=((HTDB.idx&&HTDB.idx.items)||[]).filter(function(i){ return String(i.id)===String(id); })[0]; if(!x) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 눌러 주세요'); return; }
  var exam=htdbExam(x); if(!exam.school||!exam.grade||!exam.year||!exam.semester||!exam.term){ htToast('제목에서 학교·학년·학기·시험을 읽지 못했습니다'); return; }
  var eid=htExamId(exam), n=htCohorts()[exam.school+'|'+exam.grade]||0, done=htdbDone(x);
  var msg='「'+htExamName(exam)+'」('+(x.n||'?')+'문항)를 기출 DB에서 받아 적중 분석합니다.\n\n'
    +'우리 자료: '+exam.school+' '+exam.grade+' 학생 '+n+'명이 그 학기 시작부터 시험 첫날(학원 달력)까지 푼 매쓰플랫 기록.\n'
    +(n?'':'⚠ 이 학교·학년 학생이 지금 없어 대조할 자료가 거의 없습니다 (출제 경향·카드뉴스용으로는 쓸 수 있습니다).\n')
    +(done?'⚠ 이미 분석한 시험입니다 — 문항 나누기부터 다시 하면 원장님이 확정한 ✓/✗ 가 사라질 수 있습니다. (판정만 다시는 그 시험 화면의 「🔄 다시 판정」)\n':'')
    +'\n서버가 5~15분 동안 처리합니다.';
  if(!confirm(msg)) return;
  var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:eid, exam:exam, mydb:x.id, files:[], mats:[] };
  htKvSet('exam_hit_req', req).then(function(){ HT.req=req; HT.cur=eid; HTDB.open=false; htPollMaybe(); htToast('🎯 요청했습니다 — 위 띠에 진행 상황이 보입니다'); render(); })
    .catch(function(e){ htToast('실패: '+(e.message||e)); });
};
window.htdbOpenDone = function(eid){ HTDB.open=false; htPick(eid); };

function htdbPanelHtml(){
  var h='<div class="ht-card" id="htdb"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="ht-h" style="margin:0">📚 기출 DB에서 찾기</div>'
    +'<span class="ht-sub">원장님이 구입한 기출 DB에서 시험지를 찾아 그림을 확인하고, 그대로 적중 분석을 맡깁니다. 사진을 찍어 올릴 필요가 없습니다.</span></div>';
  if(HTDB.err) return h+'<div class="ht-strip err" style="margin-top:8px">'+htEsc(HTDB.err)+'</div></div>';
  if(!HTDB.idx) return h+'<div class="ht-sub" style="margin-top:8px">목록 불러오는 중…</div></div>';
  var all=HTDB.idx.items||[];
  var up=HTDB.idx.updated?new Date(HTDB.idx.updated):null;
  h+='<div class="ht-sub" style="margin:6px 0 2px">목록 '+all.length+'장'+(up?(' · '+(up.getMonth()+1)+'/'+up.getDate()+' '+String(up.getHours()).padStart(2,'0')+':'+String(up.getMinutes()).padStart(2,'0')+' 기준'):'')+' · 서버가 12시간마다 새로 받습니다 '
    +(HTDB.reqAt?'<b style="color:#1d4ed8">· 새로 받기 요청함 (5분 안)</b>':'<button class="ht-btn" style="padding:3px 8px;font-size:11px" onclick="htdbRefresh()">🔄 목록 새로 받기</button>')+'</div>';
  if(!all.length) return h+'<div class="ht-sub" style="margin-top:8px">아직 목록이 없습니다. 「🔄 목록 새로 받기」를 눌러 주세요.</div></div>';
  /* 거르기 */
  var cnt=function(f, pre){ var m={}; all.forEach(function(x){ if(pre && !pre(x)) return; var v=f(x); if(v) m[v]=(m[v]||0)+1; }); return m; };
  var co=htCohorts(), ours={}; Object.keys(co).forEach(function(k){ ours[k.split('|')[0]]=1; });
  var sc=cnt(function(x){ return x.sc; });
  var schools=Object.keys(sc).sort(function(a,b){ return (ours[b]?1:0)-(ours[a]?1:0) || sc[b]-sc[a]; });
  var inSc=function(x){ return !HTDB.school || x.sc===HTDB.school; };
  var gr=cnt(function(x){ return x.g; }, inSc), yr=cnt(function(x){ return x.y; }, inSc);
  var sel=function(k, list, label, fmt){ return '<label>'+label+'<select onchange="htdbSet(\''+k+'\',this.value)"><option value="">전체</option>'+list.map(function(v){ return '<option value="'+htEsc(v)+'"'+(String(HTDB[k])===String(v)?' selected':'')+'>'+htEsc(fmt?fmt(v):v)+'</option>'; }).join('')+'</select></label>'; };
  h+='<div class="ht-form">'
    +sel('school', schools, '학교', function(v){ return (ours[v]?'★ ':'')+v+' ('+sc[v]+')'; })
    +sel('grade', Object.keys(gr).sort(), '학년', function(v){ return v+' ('+gr[v]+')'; })
    +sel('year', Object.keys(yr).sort().reverse(), '연도', function(v){ return v+'년 ('+yr[v]+')'; })
    +sel('sem', ['1','2'], '학기', function(v){ return v+'학기'; })
    +sel('term', ['중간','기말'], '시험')
    +'<label>제목에 든 말<input id="htdb-q" value="'+htEsc(HTDB.q)+'" placeholder="예: 중등수학1하" oninput="htdbSearch(this.value)"></label></div>';
  var list=htdbList(), shown=HTDB.more?list.slice(0,300):list.slice(0,40);
  h+='<div class="ht-sub" style="margin-bottom:6px">'+list.length+'장 찾음 · ★ = 우리 학생이 다니는 학교</div>';
  if(!list.length) return h+'<div class="ht-sub">조건에 맞는 시험지가 없습니다. 거르기를 줄이거나 「🔄 목록 새로 받기」(방금 기출 DB에 넣은 시험지라면)를 눌러 주세요.</div></div>';
  h+='<div style="overflow-x:auto"><table class="ht-tbl"><thead><tr><th>시험지</th><th style="text-align:right">문항</th><th>상태</th><th></th></tr></thead><tbody>';
  shown.forEach(function(x){
    var have=htdbHave(x), done=htdbDone(x), isV=String(HTDB.view)===String(x.id);
    var st=x.ok?'<span class="ht-pill" style="color:#166534;background:#dcfce7">DB 완료</span>':'<span class="ht-pill" style="color:#92400e;background:#fef3c7" title="기출 DB 쪽에서 단원·유형을 아직 붙이는 중 — 그림은 받을 수 있어 적중 분석은 됩니다">DB 처리 중</span>';
    if(done) st+=' <span class="ht-pill" style="color:#b91c1c;background:#fee2e2">적중 분석함</span>';
    h+='<tr'+(isV?' class="open"':'')+'><td><b>'+htEsc(htdbShort(x.t))+'</b>'+(x.f?'<div class="ht-sub" style="font-size:11px">폴더 '+htEsc(x.f)+'</div>':'')+'</td>'
      +'<td style="text-align:right;font-variant-numeric:tabular-nums">'+(x.n||'')+'</td><td style="white-space:nowrap">'+st+'</td>'
      +'<td style="white-space:nowrap;text-align:right">'
      +(have?'<button class="ht-btn" onclick="htdbView(\''+x.id+'\')">'+(isV?'접기':'👀 보기')+'</button> ':'<span class="ht-sub" style="font-size:11px;margin-right:6px" title="그림은 적중 분석을 맡기면 서버가 받아 옵니다">그림은 분석 뒤</span>')
      +(done?'<button class="ht-btn" onclick="htdbOpenDone(\''+htEsc(done).replace(/'/g,'')+'\')">결과 열기</button> ':'')
      +'<button class="ht-btn pri" onclick="htdbAnalyze(\''+x.id+'\')">🎯 적중 분석</button></td></tr>';
    if(isV && have){
      var cells=(have.cells||[]);
      h+='<tr class="open"><td colspan="4"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px">'
        +cells.map(function(c){ var u=c.imgUrl||(c.img?htSigned(c.img):''); return '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:6px;background:#fff"><div style="font-size:11px;font-weight:900;color:#0d2240;margin-bottom:4px">'+htEsc(c.no)+'번'+(c.score!=null?(' · '+htEsc(c.score)+'점'):'')+(c.difficulty!=null?(' · 난이도 '+htEsc(c.difficulty)):'')+'</div>'
          +(u?'<img src="'+htEsc(u)+'" loading="lazy" alt="'+htEsc(c.no)+'번 문항" onclick="htZoom(this.src)" style="width:100%;max-height:150px;object-fit:contain;object-position:left top;cursor:zoom-in">':'<div class="ht-sub">그림 없음</div>')
          +((c.chapters||[]).length?'<div class="ht-sub" style="font-size:10.5px;margin-top:3px">'+htEsc((c.chapters||[]).slice(-2).map(function(z){ return z&&z.name?z.name:z; }).join(' › '))+'</div>':'')+'</div>'; }).join('')
        +'</div></td></tr>';
    }
  });
  h+='</tbody></table></div>';
  if(list.length>shown.length) h+='<div style="margin-top:8px"><button class="ht-btn" onclick="HTDB.more=true;render()">더 보기 ('+(list.length-shown.length)+'장 더)</button></div>';
  return h+'</div>';
}
