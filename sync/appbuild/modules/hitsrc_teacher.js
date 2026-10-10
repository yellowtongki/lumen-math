/* ═══════════════════════════════════════════════════════════════════
 * v19-99: 🎯 적중 분석 — «우리 자료 3종» (교과서 · 수학비서 학습지 · PDF 자료함) + ⚡ 즉시 처리
 * 원장 결정 2026-10-10 (시안 docs/mockup_exam_hit_sources.html 승인):
 *   「학년 폴더 기본 · 교과서 전체 포함(기본) · PDF 자료함 둠 · 다른 학교 기출 시험지는 기본 꺼 둠 · 교과서 은행 없는 책은 새벽 자동 생성」
 *   범박고 고1 분석이 «우리 자료 0개»였다(고등부는 매쓰플랫 채점 기록이 없음) → 요청할 때 우리 자료를 네 곳에서 고른다.
 *
 *  ① 요청 화면 — 「📤 시험지 올리기」·「📚 기출 DB → 🎯 적중 분석」의 confirm() 자리에 뜬다.
 *     📘 교과서(mf_textbooks.bySchoolGrade → mf_textbook_<bid> 있으면 「준비됨」, 없으면 「새벽 자동」)
 *     📂 수학비서 학습지(ms_papers_index — 학년 폴더 기본, 기간 안에 올린 것 자동 체크, 기출은 꺼 둠)
 *     📄 PDF 자료함(exam_lib — 한 번 올리면 남는다) · 🧮 매쓰플랫(자동)
 *     → exam_hit_req.src = { tb:{on,mode,bids}, ms:[id…], lib:[id…], mf } · 「💾 이 구성 기억」 = exam_hit_src_<학교>_<학년>
 *  ② 결과 화면 — 「우리 자료별 적중」 막대(교과서 · 수학비서 학습지 · 프린트 · 매쓰플랫), 후보 카드에 자료 종류,
 *     학생별 칸은 매쓰플랫 자료만 맞힘·틀림, 나머지는 «나눠 줌». 학부모 보고서·블로그 .md 에도 같은 줄(자료 이름은 종류만).
 *  ③ ⚡ 즉시 처리 — 설정의 「GitHub 토큰 (선택)」(이 PC localStorage or_gh_token 에만 · 서버로 안 올림)이 있으면
 *     exam_hit_req · ms_mydb_index_req · mf_collect_req 요청을 쓸 때 mathflat-ondemand.yml 을 바로 깨운다.
 *     토큰이 없으면 요청 띠에 「🐙 GitHub에서 바로 실행」 링크.
 *  서버 쪽: sync/exam_hit_worker.js (--prep 새벽 준비 · 요청 처리) · docs/exam_hit_contract.md §10
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 뒤에 붙는 부품이라 같은 이름 함수를 다시 정의하거나 감싸서 바꾼다.
 * ═══════════════════════════════════════════════════════════════════ */
var HTS = { open:false, exam:null, mydb:null, title:'', files:[], mats:[], matTitle:'', from:'', to:'', periodEdited:false, editPeriod:false, warnDone:'',
  loading:false, err:'', idx:null, lib:null, tbMap:null, tbHas:{}, tbN:{}, cfg:null, cfgAt:'',
  tbMode:'all', tbOff:{}, folder:'', folders:[], msOn:{}, msOff:{}, libOn:{}, libOff:{}, libOthers:false, mf:true, more:false, busy:'' };
var HTS_KIND = { tb:{ t:'교과서', c:'#0e7490', r:'교과서' }, ms:{ t:'수학비서 학습지', c:'#6d28d9', r:'학원 학습지' }, pdf:{ t:'프린트', c:'#b45309', r:'학원 프린트' }, mf:{ t:'매쓰플랫', c:'#1d6fe8', r:'매쓰플랫 학습지·교재' } };
var HTS_GH_URL = 'https://api.github.com/repos/yellowtongki/lumen-math/actions/workflows/mathflat-ondemand.yml/dispatches';
var HTS_GH_PAGE = 'https://github.com/yellowtongki/lumen-math/actions/workflows/mathflat-ondemand.yml';
/* 고등부 과목 — 서버가 매쓰플랫 AI 문항 인식에 과목별 교육과정 키를 쓴다 (모르면 예전 키) */
var HTS_COURSES = ['공통수학1','공통수학2','대수','미적분1','확률과 통계','미적분2','기하'];
window.htsSubject = function(v){ HTS.subject=v||''; render(); };
var HTS_WAKE_KEYS = { exam_hit_req:1, ms_mydb_index_req:1, mf_collect_req:1 };
var HTS_LOCAL_ONLY = { or_gh_token:1, or_mf_id:1, or_mf_pw:1 };   /* 이 PC 에만 두는 열쇠 — 서버 동기화(scheduleSync)에 절대 안 올린다 */

function htsGroup(kind){ return kind==='textbook'?'tb':(kind==='ms'?'ms':(kind==='upload'?'pdf':'mf')); }
function htsKindLabel(m){ if(!m) return ''; if(m.kind==='textbook') return '📘 교과서'; if(m.kind==='ms') return '📂 수학비서 학습지'; if(m.kind==='upload') return m.lib?'📄 자료함 프린트':'📄 우리 프린트'; if(m.kind==='book') return '🧮 매쓰플랫 교재'; return '🧮 매쓰플랫 학습지'; }
function htsMd(iso){ var s=String(iso||'').slice(0,10); if(!/^\d{4}-\d\d-\d\d$/.test(s)) return ''; return Number(s.slice(5,7))+'/'+Number(s.slice(8,10)); }
function htsSemStart(year, sem){ return String(sem)==='1' ? (year+'-01-01') : (year+'-07-01'); }   /* 워커 semStart 와 같다 */
function htsCfgKey(e){ return 'exam_hit_src_'+htSchoolKey(e.school)+'_'+htGradeKey(e.grade); }

/* ── ⚡ 즉시 처리 — GitHub 토큰은 이 PC 에만 ── */
function htsGhToken(){ try{ return (typeof _origGetItem==='function'?_origGetItem('or_gh_token'):localStorage.getItem('or_gh_token'))||''; }catch(e){ return ''; } }
function htsGhSet(v){ try{ if(v){ if(typeof _origSetItem==='function') _origSetItem('or_gh_token', v); else localStorage.setItem('or_gh_token', v); } else { if(typeof _origRemoveItem==='function') _origRemoveItem('or_gh_token'); else localStorage.removeItem('or_gh_token'); } }catch(e){} }
window.htsWake = function(why){
  var tok=htsGhToken(); if(!tok) return Promise.resolve(false);
  try{
    return fetch(HTS_GH_URL, { method:'POST', headers:{ 'Authorization':'Bearer '+tok, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json' }, body:JSON.stringify({ ref:'main' }) })
      .then(function(r){
        if(r.status===204){ htToast('⚡ 서버 작업을 깨웠습니다 (1분 안 시작)'); return true; }
        return (r.text?r.text():Promise.resolve('')).then(function(t){ var m=''; try{ m=(JSON.parse(t)||{}).message||''; }catch(e){ m=String(t||'').slice(0,80); }
          htToast('⚡ 서버 깨우기 실패 ('+r.status+(m?(' · '+m):'')+') — 토큰 권한(Actions: Read and write)을 확인해 주세요'); return false; });
      }).catch(function(e){ htToast('⚡ 서버 깨우기 실패 — '+(e&&e.message||e)); return false; });
  }catch(e){ htToast('⚡ 서버 깨우기 실패 — '+(e&&e.message||e)); return Promise.resolve(false); }
};
/* 요청 키를 쓰면(상태 requested) 바로 깨운다 — 적중 분석 · 기출 DB 목록 새로 받기는 htKvSet, 울트라일일 「지금 가져오기」는 supaSetItem */
if(typeof htKvSet==='function') htKvSet=(function(o){ return function(key, value){
  var p=o(key, value);
  if(HTS_WAKE_KEYS[key] && value && value.status==='requested' && htsGhToken()) p.then(function(){ htsWake(key); }, function(){});
  return p; }; })(htKvSet);
if(typeof supaSetItem==='function') supaSetItem=(function(o){ return function(key, value){
  var p=Promise.resolve(o(key, value));
  if(HTS_WAKE_KEYS[key] && value && value.status==='requested' && htsGhToken()) p.then(function(ok){ if(ok) htsWake(key); }, function(){});
  return p; }; })(supaSetItem);
/* 이 PC 에만 두는 열쇠는 서버 동기화에서 뺀다 (or_api_key 가 skipKeys 로 빠지는 것과 같은 뜻) */
if(typeof scheduleSync==='function') scheduleSync=(function(o){ return function(key){ if(key && HTS_LOCAL_ONLY[key]) return; return o.apply(this, arguments); }; })(scheduleSync);

/* 설정 탭 — 「GitHub 토큰 (선택)」 칸 */
window.htsGhSave = function(){ var el=document.getElementById('hts-gh-token'); var v=el?String(el.value||'').trim():''; htsGhSet(v); htToast(v?'⚡ GitHub 토큰을 이 PC 에 저장했습니다 (서버로는 안 올라갑니다)':'GitHub 토큰을 지웠습니다'); try{ render(); }catch(e){} };
window.htsGhClear = function(){ if(!confirm('이 PC 에 저장된 GitHub 토큰을 지울까요?')) return; htsGhSet(''); try{ render(); }catch(e){} };
function htsGhBox(){
  var has=!!htsGhToken();
  return '<div style="margin-bottom:18px" id="hts-gh-box"><div class="st" style="color:#0d2240">⚡ GitHub 토큰 (선택) — 서버 작업 즉시 시작</div>'
    +'<div class="ibox">적중 분석 · 「지금 가져오기」 · 기출 DB 목록 새로 받기는 GitHub 서버가 «예약»으로 처리하는데, 예약이 몇 시간씩 늦을 때가 있습니다. '
    +'여기에 GitHub fine-grained 토큰(저장소 lumen-math · <b>Actions: Read and write</b>)을 넣으면 요청을 남기는 순간 서버를 깨워 <b>1분 안에</b> 시작합니다. '
    +'토큰은 <b>이 PC 브라우저에만</b> 저장되고 서버·다른 기기로는 올라가지 않습니다. 없으면 요청 띠의 「🐙 GitHub에서 바로 실행」을 눌러 Run workflow 를 누르면 됩니다.</div>'
    +'<div style="background:#f8fafc;border-radius:12px;padding:12px;border:1.5px solid #e2e8f0">'
    +'<div class="f"><label>GitHub 토큰 '+(has?'<b style="color:#15803d">· 저장됨</b>':'<span style="color:#94a3b8">· 없음</span>')+'</label><input id="hts-gh-token" type="password" autocomplete="off" placeholder="github_pat_..." value=""></div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button onclick="htsGhSave()" style="flex:1;min-width:120px;padding:10px;background:#0d2240;color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">💾 이 PC 에 저장</button>'
    +(has?'<button onclick="htsWake(\'test\')" style="padding:10px 12px;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">⚡ 지금 한 번 깨워 보기</button>'
      +'<button onclick="htsGhClear()" style="padding:10px 12px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">지우기</button>':'')+'</div></div></div>';
}
if(typeof rSettings==='function') rSettings=(function(o){ return function(){
  var h=o.apply(this, arguments); var box=htsGhBox();
  var mk='<div class="st" style="color:#0d2240">💬 플래너 선생님 코멘트';
  var i=String(h).indexOf(mk); if(i<0) return h+box;
  var j=h.lastIndexOf('<div style="margin-bottom:18px">', i); if(j<0) j=i;
  return h.slice(0,j)+box+h.slice(j); }; })(rSettings);

/* ── ① 요청 화면 열기 (시험지 올리기 · 기출 DB 두 입구) ── */
window.htSubmit = function(){
  if(HT.busy) return; var F=HT.form||htFormDefault();
  var ef=document.getElementById('ht-files'), mf=document.getElementById('ht-mats');
  var files=ef&&ef.files?Array.prototype.slice.call(ef.files):[], mats=mf&&mf.files?Array.prototype.slice.call(mf.files):[];
  if(!files.length){ htToast('시험지 사진이나 PDF 를 골라 주세요'); return; }
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 올려 주세요'); return; }
  var exam={ school:htSchoolKey(F.school), grade:htGradeKey(F.grade), year:Number(F.year), semester:String(F.semester), term:F.term, date:F.date||'' };
  if(!exam.school||!exam.grade||!exam.year){ htToast('학교·학년·연도를 확인해 주세요'); return; }
  htsOpen(exam, { files:files, mats:mats, matTitle:F.matTitle||'' });
};
window.htdbAnalyze = function(id){
  var x=((HTDB.idx&&HTDB.idx.items)||[]).filter(function(i){ return String(i.id)===String(id); })[0]; if(!x) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 눌러 주세요'); return; }
  var exam=htdbExam(x); if(!exam.school||!exam.grade||!exam.year||!exam.semester||!exam.term){ htToast('제목에서 학교·학년·학기·시험을 읽지 못했습니다'); return; }
  var done=htdbDone(x), sub=(String(x.t||'').match(/(공통수학[12]|미적분[12]?|대수|확률과\s*통계|기하|중등수학\d[상하]?)\s*$/)||[])[1]||'';
  if(sub) exam.subject=sub;
  htsOpen(exam, { mydb:x.id, title:sub, n:x.n||null,
    warn:done?'이미 분석한 시험입니다 — 문항 나누기부터 다시 하면 원장님이 확정한 ✓/✗ 가 사라질 수 있습니다 (판정만 다시는 그 시험 화면의 「🔄 다시 판정」).':'' });
};
function htsOpen(exam, o){
  o=o||{};
  HTS.open=true; HTS.exam=exam; HTS.mydb=o.mydb||null; HTS.title=o.title||''; HTS.files=o.files||[]; HTS.mats=o.mats||[]; HTS.matTitle=o.matTitle||''; HTS.warnDone=o.warn||''; HTS.examN=o.n||null;
  HTS.from=htsSemStart(exam.year, exam.semester); HTS.to=exam.date||''; HTS.periodEdited=false; HTS.editPeriod=false;
  HTS.tbMode='all'; HTS.tbOff={}; HTS.folder=exam.grade; HTS.folders=[exam.grade]; HTS.msOn={}; HTS.msOff={}; HTS.libOn={}; HTS.libOff={}; HTS.libOthers=false; HTS.mf=true; HTS.more=false;
  HTS.cfg=null; HTS.err=''; HTS.busy=''; HTS.subject=exam.subject||'';
  HT.showForm=false; if(typeof HTDB!=='undefined') HTDB.open=false;
  htsLoad(); try{ render(); }catch(e){}
  setTimeout(function(){ try{ var el=document.getElementById('hts-req'); if(el&&el.scrollIntoView) el.scrollIntoView({ block:'start' }); }catch(e){} }, 30);
}
window.htsClose = function(){ HTS.open=false; render(); };
/* 자료 목록을 한꺼번에 받는다 — 수학비서 목록 · 자료함 · 교과서 지정 · 기억한 구성 · 학원 달력(시험 첫날) */
function htsLoad(){
  var e=HTS.exam; HTS.loading=true;
  return Promise.all([htKv('ms_papers_index'), htKv('exam_lib'), htKv('mf_textbooks'), htKv(htsCfgKey(e)), e.date?Promise.resolve(null):htKv('school_calendar')]).then(function(a){
    HTS.idx=a[0]||null; HTS.lib=a[1]||{ items:[] }; HTS.tbMap=a[2]||{}; var cfg=a[3]||null;
    if(!e.date && a[4]){ var d=htsCalDate(a[4], e); if(d){ HTS.to=d; HTS.calDate=d; } }
    if(!HTS.to) HTS.to=new Date().toISOString().slice(0,10);
    if(cfg) htsApplyCfg(cfg);
    if(!HTS.subject && /^고/.test(htGradeKey(e.grade))){ var bs=htsTbBids(), bk=(HTS.tbMap.books||{}); if(bs.length===1){ var gname=String((bk[bs[0]]||{}).grade||''); if(HTS_COURSES.indexOf(gname)>=0) HTS.subject=gname; } }
    HTS.loading=false; if(VIEW==='examhit') render();
    return htsTbCheck(htsTbBids());
  }).then(function(){ if(VIEW==='examhit') render(); })
    .catch(function(err){ HTS.loading=false; HTS.err=String(err&&err.message||err); if(VIEW==='examhit') render(); });
}
function htsCalDate(cal, e){   /* 워커 examDateFromCalendar 와 같은 규칙 */
  try{ var s=((cal&&cal.schools)||[]).filter(function(x){ return htSchoolKey(x.name)===htSchoolKey(e.school); })[0]; if(!s) return '';
    var re=new RegExp(e.semester+'학기\\s*'+e.term); var x=(s.exams||[]).filter(function(z){ return re.test(String(z.label||'')) && String(z.from||'').slice(0,4)===String(e.year); })[0];
    return (x&&x.from)||''; }catch(err){ return ''; }
}
function htsApplyCfg(c){
  HTS.cfg=c; HTS.cfgAt=c.updated||'';
  if(c.tbMode==='scope'||c.tbMode==='all') HTS.tbMode=c.tbMode;
  if(c.tbOff) HTS.tbOff=JSON.parse(JSON.stringify(c.tbOff));
  if(Array.isArray(c.folders)&&c.folders.length){ HTS.folders=c.folders.slice(); if(HTS.folders.indexOf(HTS.exam.grade)<0) HTS.folders.unshift(HTS.exam.grade); }
  HTS.msOn=JSON.parse(JSON.stringify(c.msOn||{})); HTS.msOff=JSON.parse(JSON.stringify(c.msOff||{}));
  HTS.libOn={}; (c.libOn||[]).forEach(function(id){ HTS.libOn[id]=1; }); HTS.libCfg=true;
  if(c.mf===false) HTS.mf=false;
}
/* 교과서 은행이 있나 — 가벼운 key 만 읽기, 있는 책은 문항 수를 센다 */
function htsTbCheck(bids){
  var sb=htSb(); if(!sb||!bids.length) return Promise.resolve();
  return sb.from('lumen_store').select('key').in('key', bids.map(function(b){ return 'mf_textbook_'+b; })).then(function(r){
    var have={}; ((r&&r.data)||[]).forEach(function(x){ have[x.key]=1; });
    bids.forEach(function(b){ HTS.tbHas[b]=!!have['mf_textbook_'+b]; });
    return Promise.all(bids.filter(function(b){ return HTS.tbHas[b] && HTS.tbN[b]==null; }).map(function(b){
      return htKv('mf_textbook_'+b).then(function(v){ HTS.tbN[b]=((v&&v.problems)||[]).length; }).catch(function(){ HTS.tbN[b]=0; }); }));
  });
}
function htsTbBids(){
  var e=HTS.exam, m=HTS.tbMap||{}, g=(m.bySchoolGrade||{})[htSchoolKey(e.school)+'|'+htGradeKey(e.grade)];
  return Object.keys((g&&g.books)||{}).filter(function(b){ var bk=(m.books||{})[b]; return !bk||!bk.type||bk.type==='SCHOOL'; });
}
function htsTbOn(b){ return !HTS.tbOff[b]; }
/* 수학비서 목록 */
function htsMsItems(){ return ((HTS.idx&&HTS.idx.items)||[]); }
function htsInPeriod(x){ var d=String(x.uploadedAt||'').slice(0,10); return !!d && d>=HTS.from && d<=HTS.to; }
function htsMsSelf(x){ return HTS.mydb!=null && String(x.id)===String(HTS.mydb); }
function htsMsOn(x){
  var id=String(x.id); if(htsMsSelf(x)) return false;
  if(HTS.msOff[id]) return false; if(HTS.msOn[id]) return true;
  return !x.exam && htsInPeriod(x) && HTS.folders.indexOf(x.folder)>=0;   /* 학년 폴더(기본) · 기억한 폴더의 기간 안 학습지만 자동 체크 */
}
function htsFolderList(){
  var cnt={}, g=HTS.exam.grade, GR=['고1','고2','고3','중1','중2','중3'];
  htsMsItems().forEach(function(x){ if(!x.folder) return; var c=cnt[x.folder]=cnt[x.folder]||{ n:0, ws:0 }; c.n++; if(!x.exam) c.ws++; });
  var rest=Object.keys(cnt).filter(function(f){ return f!==g && HTS.folders.indexOf(f)<0; });
  rest.sort(function(a,b){ return (GR.indexOf(a)>=0?1:0)-(GR.indexOf(b)>=0?1:0) || cnt[b].ws-cnt[a].ws || cnt[b].n-cnt[a].n || a.localeCompare(b); });
  return [g].concat(HTS.folders.filter(function(f){ return f!==g; })).concat(rest).map(function(f){ return { f:f, c:cnt[f]||{ n:0, ws:0 } }; });
}
/* 자료함 */
function htsLibItems(){ return (((HTS.lib&&HTS.lib.items)||[]).filter(function(x){ return x && !x.deleted; })); }
function htsLibMine(x){ var e=HTS.exam; return htSchoolKey(x.school)===htSchoolKey(e.school) && htGradeKey(x.grade)===htGradeKey(e.grade); }
function htsLibOn(x){
  var id=String(x.id); if(HTS.libOff[id]) return false; if(HTS.libOn[id]) return true;
  if(x.status==='error') return false;
  if(HTS.libCfg) return htsLibMine(x) && String(x.uploadedAt||'')>String(HTS.cfgAt||'');   /* 기억한 구성 뒤에 새로 올린 이 학년 자료는 켬 */
  return htsLibMine(x);
}
/* 합계 — 자료 n종 · 문항 · 인식 완료 · 새벽 처리 */
function htsCounts(){
  var c={ tb:0, ms:0, pdf:0, mf:0, ok:0, wait:0, waitN:0, waitTb:0, kinds:0, tbBooks:0, msN:0, libN:0 };
  htsTbBids().forEach(function(b){ if(!htsTbOn(b)) return; c.tbBooks++; if(HTS.tbHas[b]){ var n=HTS.tbN[b]||0; c.tb+=n; c.ok+=n; } else if(HTS.tbHas[b]===false){ c.waitN++; c.waitTb++; } });
  htsMsItems().forEach(function(x){ if(!htsMsOn(x)) return; c.msN++; var n=Number(x.n)||0; c.ms+=n; if(x.status==='ready') c.ok+=n; else { c.wait+=n; c.waitN++; } });
  htsLibItems().forEach(function(x){ if(!htsLibOn(x)) return; c.libN++; var n=Number(x.n)||0; c.pdf+=n; if(x.status==='ready') c.ok+=n; else { c.wait+=n; c.waitN++; } });
  c.pdf+=0; c.kinds=(c.tbBooks?1:0)+(c.msN?1:0)+(c.libN?1:0);
  c.all=c.tb+c.ms+c.pdf;
  return c;
}

/* ── 고르기 ── */
window.htsTbTog = function(b){ if(HTS.tbOff[b]) delete HTS.tbOff[b]; else HTS.tbOff[b]=1; render(); };
window.htsTbMode = function(m){ HTS.tbMode=m==='scope'?'scope':'all'; render(); };
window.htsFolder = function(f){ HTS.folder=f; HTS.more=false; render(); };
window.htsFolderAuto = function(f){ var i=HTS.folders.indexOf(f); if(i>=0){ if(f!==HTS.exam.grade) HTS.folders.splice(i,1); } else HTS.folders.push(f); render(); };
/* 누르면 뒤집는다 — 자동 체크와 다를 때만 msOn/msOff(libOn/libOff)에 적어 «기억할 것»을 작게 */
window.htsMsTog = function(id){
  var x=htsMsItems().filter(function(i){ return String(i.id)===String(id); })[0]; if(!x||htsMsSelf(x)) return;
  id=String(id); var want=!htsMsOn(x); delete HTS.msOn[id]; delete HTS.msOff[id];
  if(htsMsOn(x)!==want){ if(want) HTS.msOn[id]=1; else HTS.msOff[id]=1; }
  render();
};
window.htsLibTog = function(id){
  var x=htsLibItems().filter(function(i){ return String(i.id)===String(id); })[0]; if(!x) return;
  id=String(id); var want=!htsLibOn(x); delete HTS.libOn[id]; delete HTS.libOff[id];
  if(htsLibOn(x)!==want){ if(want) HTS.libOn[id]=1; else HTS.libOff[id]=1; }
  render();
};
window.htsMfTog = function(){ HTS.mf=!HTS.mf; render(); };
window.htsPeriod = function(k, v){ if(k==='from'||k==='to'){ HTS[k]=v; HTS.periodEdited=true; } render(); };
/* PDF 자료함에 올리기 — 시험지 올리기와 같은 임시 자리(aha_photos/_exam_hit/…)로, 서버가 exam_images/lib 로 옮겨 인식한다 */
window.htsLibUpload = async function(inp){
  var files=inp&&inp.files?Array.prototype.slice.call(inp.files):[]; if(!files.length) return;
  var e=HTS.exam; HTS.busy='PDF 자료함에 올리는 중'; render();
  try{
    var added=[];
    for(var i=0;i<files.length;i++){
      var id='L'+Date.now().toString(36)+htRand().slice(0,4);
      var up=await htUploadAll([files[i]], '_exam_hit/lib_'+id);
      added.push({ id:id, title:String(files[i].name||'프린트').replace(/\.[a-z0-9]+$/i,''), school:htSchoolKey(e.school), grade:htGradeKey(e.grade), sem:String(e.semester), year:Number(e.year),
        uploadedAt:new Date().toISOString(), src:'aha_photos/'+up[0].path, path:'', n:null, status:'pending', items:[] });
    }
    var cur=(await htKv('exam_lib'))||{ items:[] }; cur.items=(cur.items||[]).concat(added); cur.updated=new Date().toISOString();   /* 쓰기 직전에 다시 읽어 합친다(서버도 같은 키에 쓴다) */
    await htKvSet('exam_lib', cur); HTS.lib=cur; added.forEach(function(x){ HTS.libOn[x.id]=1; });
    htToast('📄 자료함에 '+added.length+'개 올렸습니다 — 새벽 또는 분석 때 문항을 나눕니다');
  }catch(err){ htToast('올리기 실패: '+(err&&err.message||err)); }
  HTS.busy=''; render();
};
window.htsLibDel = async function(id){
  var x=htsLibItems().filter(function(i){ return String(i.id)===String(id); })[0]; if(!x) return;
  if(!confirm('자료함에서 「'+(x.title||'')+'」을(를) 지울까요?\n(다음 분석부터 안 쓰입니다. 이미 끝난 분석 결과는 그대로)')) return;
  try{ var cur=(await htKv('exam_lib'))||{ items:[] }; (cur.items||[]).forEach(function(i){ if(String(i.id)===String(id)){ i.deleted=true; i.deletedAt=new Date().toISOString(); } }); cur.updated=new Date().toISOString();
    await htKvSet('exam_lib', cur); HTS.lib=cur; }catch(err){ htToast('지우기 실패: '+(err&&err.message||err)); }
  render();
};
/* 💾 이 구성 기억 — 학교·학년마다 */
function htsCfgValue(){
  var libOn=htsLibItems().filter(htsLibOn).map(function(x){ return String(x.id); });
  return { folders:HTS.folders.slice(), tbMode:HTS.tbMode, tbOff:JSON.parse(JSON.stringify(HTS.tbOff)), msOff:JSON.parse(JSON.stringify(HTS.msOff)), msOn:JSON.parse(JSON.stringify(HTS.msOn)), libOn:libOn, mf:HTS.mf, updated:new Date().toISOString() };
}
window.htsSaveCfg = function(){
  var v=htsCfgValue(), k=htsCfgKey(HTS.exam);
  return htKvSet(k, v).then(function(){ htsApplyCfg(JSON.parse(JSON.stringify(v))); htToast('💾 '+HTS.exam.school+' '+HTS.exam.grade+' 자료 구성을 기억했습니다 — 다음 요청 때 그대로 열립니다'); render(); })
    .catch(function(err){ htToast('저장 실패: '+(err&&err.message||err)); });
};
/* 🎯 적중 분석 시작 */
function htsSrcValue(){
  var bids=htsTbBids().filter(htsTbOn);
  return { tb:{ on:bids.length>0, mode:HTS.tbMode, bids:bids }, ms:htsMsItems().filter(htsMsOn).map(function(x){ return String(x.id); }),
    lib:htsLibItems().filter(htsLibOn).map(function(x){ return String(x.id); }), mf:HTS.mf };
}
window.htsStart = async function(){
  if(HTS.busy) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 시작해 주세요'); return; }
  var e=HTS.exam, src=htsSrcValue();
  HTS.busy=HTS.files.length?'시험지 올리는 중':'요청 남기는 중'; render();
  try{
    var r=htRand(), up=[], um=[];
    if(HTS.files.length){ up=await htUploadAll(HTS.files, '_exam_hit/'+r+'/exam'); um=HTS.mats.length?await htUploadAll(HTS.mats, '_exam_hit/'+r+'/mat'):[]; um.forEach(function(m, i){ m.title=(HTS.matTitle||'우리 프린트')+(um.length>1?(' '+(i+1)):''); }); }
    var id=htExamId(e);
    var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:id, exam:e, files:up, mats:um, src:src };
    if(HTS.mydb!=null) req.mydb=HTS.mydb;
    if(HTS.subject){ req.exam=JSON.parse(JSON.stringify(e)); req.exam.subject=HTS.subject; }
    if(HTS.periodEdited){ req.from=HTS.from; req.to=HTS.to; }
    await htKvSet('exam_hit_req', req); HT.req=req; HT.cur=id; HTS.open=false; HTS.busy=''; htPollMaybe();
    htToast('🎯 요청했습니다 — 위 띠에 진행 상황이 보입니다');
  }catch(err){ HTS.busy=''; htToast('실패: '+(err&&err.message||err)); }
  render();
};

/* ── 요청 화면 그리기 (시안 그대로: 머리 · 네 칸 · 합계 띠) ── */
var HTS_CSS = '<style>'
  +'.hts-panels{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;margin-top:10px}'
  +'.hts-pn{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px;min-width:0;background:#fff}'
  +'.hts-pn h3{font-size:13px;font-weight:900;margin:0;display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;color:#0d2240}'
  +'.hts-cnt{font-size:11px;color:#64748b;font-weight:700}.hts-dot{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}'
  +'.hts-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;cursor:pointer;background:#fff}'
  +'.hts-row:hover{background:#eff6ff}.hts-row.dim{opacity:.6}.hts-row:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
  +'.hts-cb{width:16px;height:16px;border:1.5px solid #94a3b8;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;box-sizing:border-box}'
  +'.hts-cb.on{background:#1d6fe8;border-color:#1d6fe8}'
  +'.hts-t{min-width:0;overflow-wrap:anywhere}.hts-t b{display:block;font-weight:800;color:#0f172a}.hts-t small{color:#64748b;font-weight:700;font-size:11px}'
  +'.hts-st{font-size:10px;font-weight:900;padding:2px 7px;border-radius:5px;white-space:nowrap}'
  +'.hts-st.ok{background:#dcfce7;color:#15803d}.hts-st.wait{background:#fff7e6;color:#b45309}.hts-st.no{background:#fee2e2;color:#b91c1c}.hts-st.auto{background:#e0f2fe;color:#0e7490}'
  +'.hts-seg{display:inline-flex;border:1.5px solid #e2e8f0;border-radius:8px;overflow:hidden;vertical-align:middle}'
  +'.hts-seg button{border:none;background:#fff;color:#64748b;font-family:inherit;font-size:11px;font-weight:900;padding:4px 9px;cursor:pointer}.hts-seg button.on{background:#0d2240;color:#fff}'
  +'.hts-drop{display:block;border:2px dashed #cbd5e1;border-radius:10px;padding:10px;text-align:center;font-size:11.5px;color:#64748b;font-weight:800;cursor:pointer}.hts-drop:hover{background:#f8fafc}'
  +'.hts-sum{border:2px solid #1d6fe8;border-radius:12px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#eff6ff;margin-top:10px}'
  +'.hts-bar{display:flex;height:12px;border-radius:6px;overflow:hidden;width:100%;max-width:420px;background:#e2e8f0;margin:5px 0}.hts-bar i{display:block;height:100%}'
  +'.hts-nums{font-size:12px;font-weight:800;display:flex;gap:10px;flex-wrap:wrap;color:#0f172a}.hts-nums b{font-variant-numeric:tabular-nums}'
  +'.hts-leg{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;font-weight:800;color:#64748b}'
  +'.hts-kb{display:grid;grid-template-columns:120px minmax(0,1fr) 64px;gap:8px;align-items:center;font-size:12px;font-weight:700;color:#475569}'
  +'</style>';
function htsCb(on){ return '<span class="hts-cb'+(on?' on':'')+'">'+(on?'✓':'')+'</span>'; }
function htsDot(g){ return '<i class="hts-dot" style="background:'+HTS_KIND[g].c+'"></i>'; }
function htsPanelHtml(){
  var e=HTS.exam, co=htCohorts(), nStu=co[htSchoolKey(e.school)+'|'+htGradeKey(e.grade)]||0, c=htsCounts();
  var h='<div class="ht-card" id="hts-req"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div style="min-width:0;flex:1">'
    +'<div style="font-size:15px;font-weight:900;color:#0d2240">🎯 적중 분석 요청 — '+htEsc(e.school+' '+e.grade+' · '+e.year+'년 '+e.semester+'학기 '+e.term+'고사')+(HTS.title?(' ('+htEsc(HTS.title)+')'):'')+'</div>'
    +'<div class="ht-sub">시험 첫날 '+(e.date?htsMd(e.date):(HTS.calDate?(htsMd(HTS.calDate)+' (학원 달력)'):'모름 — 오늘까지'))+' · 우리 자료 기간 <b style="color:#0f172a">'+htEsc(HTS.from)+' ~ '+htEsc(String(HTS.to).slice(5))+'</b> (학기 시작 ~ 시험 첫날) · 이 학교·학년 학생 '+nStu+'명'
    +(HTS.mydb!=null?(' · 기출 DB 시험지'+(HTS.examN?(' '+HTS.examN+'문항'):'')):'')+(HTS.files.length?(' · 올릴 시험지 '+HTS.files.length+'개'+(HTS.mats.length?(' + 이번에만 쓸 프린트 '+HTS.mats.length+'개'):'')):'')+'</div></div>'
    +'<div style="display:flex;gap:6px"><button class="ht-btn" onclick="HTS.editPeriod=!HTS.editPeriod;render()">기간 바꾸기</button><button class="ht-btn no" onclick="htsClose()">← 돌아가기</button></div></div>';
  if(/^고/.test(htGradeKey(e.grade))){
    var subs=HTS_COURSES.slice(); if(HTS.subject && subs.indexOf(HTS.subject)<0) subs.unshift(HTS.subject);
    h+='<div class="ht-sub" style="margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">과목 <select id="hts-subject" onchange="htsSubject(this.value)" style="padding:4px 6px;border:1px solid '+(HTS.subject?'#cbd5e1':'#f59e0b')+';border-radius:7px;font-size:12px;font-weight:800;font-family:inherit"><option value="">(모름)</option>'
      +subs.map(function(x){ return '<option'+(x===HTS.subject?' selected':'')+'>'+htEsc(x)+'</option>'; }).join('')+'</select><span style="font-size:11px">고등부는 매쓰플랫 AI 가 이 과목 기준으로 문항을 읽습니다'+(HTS.subject?'':' — <b style="color:#b45309">골라 주세요</b>')+'</span></div>';
  }
  if(HTS.editPeriod) h+='<div class="ht-form" style="max-width:420px"><label>부터<input type="date" value="'+htEsc(HTS.from)+'" onchange="htsPeriod(\'from\',this.value)"></label><label>까지<input type="date" value="'+htEsc(HTS.to)+'" onchange="htsPeriod(\'to\',this.value)"></label></div>';
  if(HTS.warnDone) h+='<div class="ht-strip err" style="margin:8px 0 0">⚠ '+htEsc(HTS.warnDone)+'</div>';
  if(HTS.busy) h+='<div class="ht-strip" style="margin:8px 0 0">⏳ '+htEsc(HTS.busy)+'…</div>';
  if(HTS.err) h+='<div class="ht-strip err" style="margin:8px 0 0">'+htEsc(HTS.err)+'</div>';
  if(HTS.loading) return HTS_CSS+h+'<div class="ht-sub" style="margin-top:10px">자료 목록 불러오는 중…</div></div>';
  h+='<div class="hts-panels">'+htsTbPanel()+htsMsPanel()+htsLibPanel()+htsMfPanel(nStu)+'</div>';
  /* 합계 띠 */
  var seg=[['tb',c.tb],['ms',c.ms],['pdf',c.pdf],['mf',0]];
  h+='<div class="hts-sum" id="hts-sum"><div style="min-width:0;flex:1"><div class="hts-nums"><span>자료 <b id="hts-nSrc">'+c.kinds+'</b>종</span><span>문항 <b id="hts-nAll">'+c.all.toLocaleString()+'</b>개</span><span>인식 완료 <b id="hts-nOk">'+c.ok.toLocaleString()+'</b></span><span>새벽 처리 <b id="hts-nWait">'+c.waitN+'</b>건</span>'+(HTS.mf?'<span>+ 매쓰플랫 기록 자동</span>':'')+'</div>'
    +'<div class="hts-bar">'+seg.map(function(s){ return '<i style="width:'+(c.all?(s[1]/c.all*100):0)+'%;background:'+HTS_KIND[s[0]].c+'"></i>'; }).join('')+'</div>'
    +'<div class="hts-leg">'+['tb','ms','pdf','mf'].map(function(g){ return '<span>'+htsDot(g)+HTS_KIND[g].t+'</span>'; }).join('')+'</div></div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="ht-btn pri" id="hts-start" onclick="htsStart()">🎯 적중 분석 시작</button><button class="ht-btn" id="hts-save" onclick="htsSaveCfg()">💾 이 구성 기억</button></div></div>';
  h+='<p class="ht-sub" id="hts-wait" style="margin:8px 0 0">'+(c.waitN
    ?('⏳ 아직 인식 안 된 자료 <b>'+c.waitN+'건</b>'+(c.wait?('('+c.wait.toLocaleString()+'문항)'):'')+'은 새벽 4시에 처리됩니다. 지금 시작하면 수학비서 학습지·자료함 PDF 는 <b>분석 때 바로 인식</b>합니다(장당 2~5분 더)'
      +(c.waitTb?(' · 은행이 없는 교과서 '+c.waitTb+'권은 새벽에 만든 뒤 결과 화면의 「🔄 다시 판정」으로 들어갑니다'):'')+'.')
    :'모든 자료가 인식되어 있어 바로 판정합니다 (5~10분).')
    +(HTS.cfg?' · <span style="color:#15803d">💾 기억한 구성으로 열었습니다</span>':'')+'</p>';
  return HTS_CSS+h+'</div>';
}
function htsTbPanel(){
  var e=HTS.exam, bids=htsTbBids(), books=(HTS.tbMap&&HTS.tbMap.books)||{}, on=bids.filter(htsTbOn), n=0;
  on.forEach(function(b){ n+=HTS.tbN[b]||0; });
  var h='<div class="hts-pn" id="hts-tb"><h3><span>'+htsDot('tb')+'📘 교과서</span><span class="hts-cnt">기본 포함 · '+on.length+'권'+(n?(' · '+n+'문항'):'')+'</span></h3>'
    +'<div class="ht-sub">'+htEsc(e.school+' '+e.grade)+' 지정 교과서 (학생별 교과서 지정에서) · <span class="hts-seg"><button class="'+(HTS.tbMode==='all'?'on':'')+'" onclick="htsTbMode(\'all\')">전체 문항</button><button class="'+(HTS.tbMode==='scope'?'on':'')+'" onclick="htsTbMode(\'scope\')">시험 범위 단원만</button></span></div>';
  if(!bids.length) return h+'<div class="ht-sub">이 학교·학년에 지정된 교과서가 없습니다 (매쓰플랫 학생별 교과서 지정이 생기면 자동으로 나옵니다).</div></div>';
  bids.forEach(function(b){
    var bk=books[b]||{}, has=HTS.tbHas[b], ok=htsTbOn(b), t=bk.fulltitle||bk.title||('교과서 '+b);
    h+='<div class="hts-row'+(ok?'':' dim')+'" data-hts="tb:'+htEsc(b)+'" tabindex="0" onclick="htsTbTog(\''+htEsc(b)+'\')">'+htsCb(ok)+'<span class="hts-t"><b>'+htEsc(t)+'</b><small>'
      +(has===true?('은행 있음 · '+(HTS.tbN[b]!=null?HTS.tbN[b]:'…')+'문항 · 유형 번호 100%'):(has===false?'은행 없음 → 새벽에 자동으로 만듦 (매쓰플랫 교과서 은행, 10분쯤)':'확인 중…'))+'</small></span>'
      +(has===true?'<span class="hts-st ok">준비됨</span>':(has===false?'<span class="hts-st auto">새벽 자동</span>':'<span class="hts-st wait">확인 중</span>'))+'</div>';
  });
  if(HTS.tbMode==='scope') h+='<div class="ht-sub" style="font-size:11px">「시험 범위 단원만」은 서버가 시험지에서 읽은 단원(유형)이 나오는 소단원 쪽만 씁니다. 맞는 쪽이 없으면 전체를 씁니다.</div>';
  return h+'</div>';
}
function htsMsPanel(){
  var items=htsMsItems(), onAll=items.filter(htsMsOn), nOn=0; onAll.forEach(function(x){ nOn+=Number(x.n)||0; });
  var h='<div class="hts-pn" id="hts-ms"><h3><span>'+htsDot('ms')+'📂 수학비서 학습지</span><span class="hts-cnt" id="hts-msCnt">체크 '+onAll.length+'장 · '+nOn+'문항</span></h3>';
  if(!HTS.idx) return h+'<div class="ht-sub">아직 학습지 목록이 없습니다 — 새벽 준비(매일 4시)가 한 번 돌면 생깁니다.</div></div>';
  var fl=htsFolderList();
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><span class="ht-sub" style="font-size:10.5px">폴더</span>'+fl.slice(0,16).map(function(x){
    return '<button class="ht-chip'+(x.f===HTS.folder?' on':'')+'" style="padding:4px 10px;font-size:11.5px" data-htsf="'+htEsc(x.f)+'" onclick="htsFolder(\''+htEsc(x.f).replace(/'/g,'')+'\')">'+htEsc(x.f)+(x.f===HTS.exam.grade?' (기본)':'')+'</button>'; }).join('')+'</div>';
  h+='<div class="ht-sub" style="font-size:11.5px">기간 안('+htsMd(HTS.from)+'~'+htsMd(HTS.to)+')에 올린 것은 자동 체크 · 그 전 것과 다른 학교 기출 시험지는 꺼 둠 (학생에게 나눠 준 것이면 켜세요)'
    +(HTS.folder!==HTS.exam.grade?(' · <button class="ht-btn" style="padding:2px 8px;font-size:11px" onclick="htsFolderAuto(\''+htEsc(HTS.folder).replace(/'/g,'')+'\')">'+(HTS.folders.indexOf(HTS.folder)>=0?'✓ 이 폴더도 기간 안 자동 체크 (끄기)':'이 폴더도 기간 안 자동 체크')+'</button>'):'')+'</div>';
  var list=items.filter(function(x){ return x.folder===HTS.folder; }).sort(function(a,b){ return (htsMsOn(b)?1:0)-(htsMsOn(a)?1:0) || (a.exam?1:0)-(b.exam?1:0) || String(b.uploadedAt||'').localeCompare(String(a.uploadedAt||'')); });
  if(!list.length) h+='<div class="ht-sub">이 폴더에 학습지가 없습니다.</div>';
  var shown=HTS.more?list.slice(0,300):list.slice(0,12);
  shown.forEach(function(x){
    var on=htsMsOn(x), self=htsMsSelf(x), gf=['고1','고2','고3','중1','중2','중3'].indexOf(x.folder)>=0;
    var st=x.status==='ready'?'<span class="hts-st ok">인식됨</span>':(x.status==='error'?'<span class="hts-st no">인식 실패</span>':(x.exam?'':(gf?'<span class="hts-st wait">새벽 인식</span>':'<span class="hts-st wait">분석 때 인식</span>')));
    h+='<div class="hts-row'+(on?'':' dim')+'" data-hts="ms:'+htEsc(x.id)+'" tabindex="0" onclick="htsMsTog(\''+htEsc(x.id)+'\')">'+htsCb(on)+'<span class="hts-t"><b>'+htEsc(x.title)+'</b><small>'
      +(x.exam?'다른 학교·지난 기출 · ':'')+(self?'분석 대상 시험지 자체 — 자료로는 안 씀 · ':'')+(x.sub?(htEsc(x.sub)+' · '):'')+(x.uploadedAt?('올린 날 '+htsMd(x.uploadedAt)+' · '):'')+(x.n?(x.n+'문항'):'문항 수 모름')+(x.err?(' · '+htEsc(x.err)):'')+'</small></span>'+st+'</div>';
  });
  if(list.length>shown.length) h+='<button class="ht-btn" style="padding:4px 10px;font-size:11px" onclick="HTS.more=true;render()">더 보기 ('+(list.length-shown.length)+'장 더)</button>';
  var other=onAll.filter(function(x){ return x.folder!==HTS.folder; }).length;
  if(other) h+='<div class="ht-sub" style="font-size:11px">다른 폴더에서 체크한 것 '+other+'장 포함</div>';
  return h+'</div>';
}
function htsLibRow(x){
  var on=htsLibOn(x), st=x.status==='ready'?'<span class="hts-st ok">인식됨</span>':(x.status==='error'?'<span class="hts-st no">인식 실패</span>':'<span class="hts-st wait">새벽 인식</span>');
  return '<div class="hts-row'+(on?'':' dim')+'" data-hts="lib:'+htEsc(x.id)+'" tabindex="0" onclick="htsLibTog(\''+htEsc(x.id)+'\')">'+htsCb(on)+'<span class="hts-t"><b>'+htEsc(x.title||'프린트')+'</b><small>'
    +htEsc([x.school, x.grade, (x.year&&x.sem)?(x.year+'-'+x.sem):''].filter(Boolean).join(' · '))+(x.uploadedAt?(' · 올린 날 '+htsMd(x.uploadedAt)):'')+(x.n?(' · '+x.n+'문항'):'')+(htsLibMine(x)?'':' · 다른 학년')+(x.err?(' · '+htEsc(x.err)):'')+'</small></span>'
    +'<span style="display:flex;gap:4px;align-items:center">'+st+'<button class="ht-btn no" title="자료함에서 지우기" style="padding:1px 6px;font-size:11px" onclick="event.stopPropagation();htsLibDel(\''+htEsc(x.id)+'\')">✕</button></span></div>';
}
function htsLibPanel(){
  var all=htsLibItems(), mine=all.filter(htsLibMine), others=all.filter(function(x){ return !htsLibMine(x); }), on=all.filter(htsLibOn), n=0;
  on.forEach(function(x){ n+=Number(x.n)||0; });
  var h='<div class="hts-pn" id="hts-lib"><h3><span>'+htsDot('pdf')+'📄 PDF 자료함</span><span class="hts-cnt" id="hts-libCnt">체크 '+on.length+'장 · '+n+'문항</span></h3>'
    +'<div class="ht-sub" style="font-size:11.5px">한 번 올리면 남아서 다음 시험에도 씁니다 · 꼬리표: 학교 · 학년 · 학기</div>';
  if(!mine.length) h+='<div class="ht-sub">'+htEsc(HTS.exam.school+' '+HTS.exam.grade)+' 자료가 아직 없습니다.</div>';
  mine.forEach(function(x){ h+=htsLibRow(x); });
  if(others.length){
    h+='<button class="ht-btn no" style="padding:4px 10px;font-size:11px" onclick="HTS.libOthers=!HTS.libOthers;render()">'+(HTS.libOthers?'다른 학년 접기 ▲':'다른 학년 보기 ('+others.length+') ▼')+'</button>';
    if(HTS.libOthers) others.forEach(function(x){ h+=htsLibRow(x); });
  }
  h+='<label class="hts-drop">＋ PDF 올리기 (한글·워드는 PDF 로) — 올리면 「인식 대기」로 자료함에 들어가고, 새벽 또는 분석 때 매쓰플랫 AI 가 문항을 나눕니다'
    +'<input type="file" multiple accept="application/pdf,image/*" onchange="htsLibUpload(this)" style="display:none"></label>';
  return h+'</div>';
}
function htsMfPanel(nStu){
  var hs=/^고/.test(htGradeKey(HTS.exam.grade));
  return '<div class="hts-pn" id="hts-mf"><h3><span>'+htsDot('mf')+'🧮 매쓰플랫 학습지·교재</span><span class="hts-cnt">자동</span></h3>'
    +'<div class="ht-sub" style="font-size:11.5px">이 학교·학년 학생 '+nStu+'명이 기간 안에 매쓰플랫에서 채점한 문항</div>'
    +'<div class="hts-row'+(HTS.mf?'':' dim')+'" data-hts="mf" tabindex="0" onclick="htsMfTog()">'+htsCb(HTS.mf)+'<span class="hts-t"><b>채점 기록 자동</b><small>'
    +(hs?'고등부는 매쓰플랫 과제가 거의 없어 비어 있을 수 있음':'중등부에서는 여기가 주 재료 · 학생별 «시험 전에 맞혔나»도 이 기록으로')+'</small></span><span class="hts-st auto">자동</span></div></div>';
}
/* 적중 분석 화면 — 요청 화면이 열려 있으면 그것만, 아니면 원래 화면 + 요청 띠에 즉시 처리 단추 */
rExamHit=(function(o){ return function(){
  if(HTS.open){ htKick(); return HT_CSS+'<div class="ht-wrap">'+htsPanelHtml()+'</div>'; }
  var h=o.apply(this, arguments), r=HT.req;
  if(r && (r.status==='requested'||r.status==='running')){
    var i=h.indexOf('<div class="ht-strip"><b>⏳ '), j=i>=0?h.indexOf('%</span></div>', i):-1;
    if(j>0){ j+='%</span>'.length;
      var add=htsGhToken()?'<button class="ht-btn" style="padding:4px 10px;font-size:11px" onclick="htsWake(\'manual\')" title="GitHub 서버 작업을 지금 깨웁니다">⚡ 다시 깨우기</button>'
        :'<span style="display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap"><a class="ht-btn" id="hts-gh-link" style="padding:4px 10px;font-size:11px;text-decoration:none" href="'+HTS_GH_PAGE+'" target="_blank" rel="noopener">🐙 GitHub에서 바로 실행</a><span class="ht-sub" style="font-size:11px">Run workflow 를 누르면 1분 안에 시작됩니다</span></span>';
      h=h.slice(0,j)+add+h.slice(j); h=h.replace('<div class="ht-strip"><b>⏳ ', '<div class="ht-strip" style="flex-wrap:wrap"><b>⏳ ');
    }
  }
  return h; }; })(rExamHit);

/* ── ② 결과 화면 — 우리 자료별 적중 ── */
function htsByKind(d){
  var b=d.basis||'same+var', g={ tb:{ hit:0, sure:0, mats:0 }, ms:{ hit:0, sure:0, mats:0 }, pdf:{ hit:0, sure:0, mats:0 }, mf:{ hit:0, sure:0, mats:0 } }, bk=(d.stats&&d.stats.byKind)||null;
  if(bk){ g.tb.mats=(bk.textbook||{}).mats||0; g.ms.mats=(bk.ms||{}).mats||0; g.pdf.mats=(bk.upload||{}).mats||0; g.mf.mats=((bk.ws||{}).mats||0)+((bk.book||{}).mats||0); }
  else Object.keys(d.mats||{}).forEach(function(k){ g[htsGroup(d.mats[k].kind)].mats++; });
  htVisible(d).forEach(function(it){ var e=htEff(it); if(!htInBasis(e.kind,b)||!e.k) return; var m=(d.mats||{})[e.k]; if(!m) return; var x=g[htsGroup(m.kind)]; x.hit++; if(e.sure) x.sure++; });
  g.byWorker=!!bk; return g;
}
function htsByKindLine(d, rep){ var g=htsByKind(d); return ['tb','ms','pdf','mf'].map(function(k){ return (rep?HTS_KIND[k].r:HTS_KIND[k].t)+' '+g[k].hit; }).join(' · '); }
function htsByKindHtml(d){
  var g=htsByKind(d), b=d.basis||'same+var', tot=g.tb.hit+g.ms.hit+g.pdf.hit+g.mf.hit, max=Math.max(1, g.tb.hit, g.ms.hit, g.pdf.hit, g.mf.hit);
  var h='<div id="hts-bykind" style="margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:10px"><div class="ht-h" style="margin:0 0 6px">📚 우리 자료별 적중 <span class="ht-sub" style="font-weight:700">— '+HT_BASIS[b].label+' 기준 · 적중 '+tot+'문항이 어느 자료에서 나왔나</span></div>'
    +'<div class="hts-bar" style="max-width:none;height:14px">'+['tb','ms','pdf','mf'].map(function(k){ return '<i style="width:'+(tot?(g[k].hit/tot*100):0)+'%;background:'+HTS_KIND[k].c+'"></i>'; }).join('')+'</div><div style="display:grid;gap:4px;margin-top:6px">';
  ['tb','ms','pdf','mf'].forEach(function(k){
    h+='<div class="hts-kb"><span>'+htsDot(k)+HTS_KIND[k].t+'</span><div class="ht-bar"><i style="width:'+Math.round(g[k].hit/max*100)+'%;background:'+HTS_KIND[k].c+'"></i></div><b style="text-align:right;color:#0f172a;font-variant-numeric:tabular-nums" data-htsk="'+k+'">'+g[k].hit+(g[k].sure?('<small style="color:#15803d"> ✓'+g[k].sure+'</small>'):'')+'</b></div>';
  });
  h+='</div><div class="ht-sub" style="font-size:11px;margin-top:4px">대조한 자료 문항'+(g.byWorker?'':' (후보에 쓰인 것)')+': 교과서 '+g.tb.mats.toLocaleString()+' · 수학비서 학습지 '+g.ms.mats.toLocaleString()+' · 프린트 '+g.pdf.mats.toLocaleString()+' · 매쓰플랫 '+g.mf.mats.toLocaleString()+' · 한 문항은 맨 앞 적중 자료 하나로 셈 · ✓ = 원장님 확정</div></div>';
  return h;
}
htSummaryHtml=(function(o){ return function(d){
  var h=o(d), mk='출처 = 매쓰플랫이 찾은 «가장 닮은 원본»의 종류 (근사치)</div></div></div></div>', i=h.indexOf(mk);
  if(i<0) return h; i+=mk.length; return h.slice(0,i)+htsByKindHtml(d)+h.slice(i); }; })(htSummaryHtml);
/* 후보 카드 — 자료 종류 표시 · 채점 기록이 없는 자료는 «나눠 줌» */
htCandCard=(function(o){ return function(d, it, c){
  var h=o(d, it, c), m=(d.mats||{})[c.k]||{}, g=htsGroup(m.kind);
  var old='<b style="font-size:12px;color:#334155">'+htEsc(m.kind==='book'?'교재':(m.kind==='upload'?'우리 프린트':'학습지'))+'</b>';
  h=h.replace(old, '<b style="font-size:12px;color:'+HTS_KIND[g].c+'">'+htsKindLabel(m)+'</b>');
  if(g!=='mf') h=h.replace(/<b style="color:#0f172a">학생<\/b> 푼 \d+명/, '<b style="color:#0f172a">학생</b> 나눠 줌 (채점 기록 없음)');
  return h; }; })(htCandCard);
/* 학생 한 명 — 매쓰플랫 자료만 맞힘·틀림, 교과서·수학비서·프린트는 «나눠 줌» */
function htStudentRow(d, code){
  var b=d.basis||'same+var', out={ code:code, hit:0, O:0, X:0, none:0, given:0, xs:[], os:[] };
  htVisible(d).forEach(function(it){
    var e=htEff(it); if(!htInBasis(e.kind,b) || !e.k) return; out.hit++;
    var c=(it.cands||[]).filter(function(x){ return x.k===e.k; })[0]; var keys=[e.k].concat(c&&c.also||[]);
    var r='', gv=false; keys.forEach(function(k){ var m=(d.mats||{})[k]; if(m && htsGroup(m.kind)!=='mf') gv=true; var x=m&&m.res?m.res[code]:''; if(x==='O') r='O'; else if((x==='X'||x==='?') && r!=='O') r='X'; });
    var n=htNumOf(d,it); if(r==='O'){ out.O++; out.os.push(n); } else if(r==='X'){ out.X++; out.xs.push(n); } else if(gv) out.given++; else out.none++;
  });
  return out;
}
function htStudentsHtml(d){
  var rows=(d.students||[]).map(function(c){ return htStudentRow(d,c); });
  var h='<div class="ht-card"><div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="HT.stuOpen=!HT.stuOpen;render()"><div class="ht-h" style="margin:0;flex:1">👥 학생별 — 적중 문항을 시험 전에 우리 자료에서 맞혔나 ('+rows.length+'명)</div><span class="ht-sub">'+(HT.stuOpen?'접기 ▲':'펼치기 ▼')+'</span></div>';
  if(!HT.stuOpen) return h+'</div>';
  h+='<div style="overflow-x:auto;margin-top:8px"><table class="ht-tbl"><tr><th>학생</th><th>적중 문항</th><th>맞힘</th><th>틀림·모름</th><th>안 풀었음</th><th>나눠 줌</th><th>틀렸던 문항</th></tr>';
  rows.sort(function(a,b){ return b.X-a.X; }).forEach(function(r){
    h+='<tr><td><b>'+htEsc(htStuLabel(r.code))+'</b></td><td>'+r.hit+'</td><td style="color:#15803d;font-weight:800">'+r.O+'</td><td style="color:#b91c1c;font-weight:800">'+r.X+'</td><td>'+r.none+'</td><td style="color:#6d28d9;font-weight:800">'+r.given+'</td><td>'+(r.xs.length?r.xs.map(function(n){ return n+'번'; }).join(' · '):'—')+'</td></tr>';
  });
  return h+'</table></div><div class="ht-sub" style="margin-top:6px">「맞힘」은 적중한 우리 자료 문항의 가장 최근 채점이 정답인 것 — <b>매쓰플랫 자료만</b> 채점 기록이 있습니다. 교과서·수학비서 학습지·프린트로 적중한 문항은 채점 기록이 없어 «나눠 줌»으로 셉니다. 실제 시험 정오답은 아직 들어 있지 않습니다.</div></div>';
}
/* 어떤 자료가 맞혔나 — 자료 종류 이름을 새 종류로 */
function htMatsRankHtml(d){
  var b=d.basis||'same+var', by={};
  htVisible(d).forEach(function(it){
    var e=htEff(it); if(!htInBasis(e.kind,b) || !e.k) return;
    var c=(it.cands||[]).filter(function(x){ return x.k===e.k; })[0]; var keys=[e.k].concat(c&&c.also||[]), seen={};
    keys.forEach(function(k){ var m=(d.mats||{})[k]; if(!m) return; var t=m.title||'(이름 없음)'; if(seen[t]) return; seen[t]=1;
      var x=by[t]=by[t]||{ t:t, m:m, n:0, sure:0, nos:[] }; x.n++; if(e.sure) x.sure++; x.nos.push(htNumOf(d,it)); });
  });
  var arr=Object.keys(by).map(function(k){ return by[k]; }).sort(function(a,b){ return b.n-a.n || b.sure-a.sure; });
  if(!arr.length) return '';
  var max=arr[0].n;
  var h='<div class="ht-card"><div class="ht-h">📚 어떤 자료가 맞혔나 <span class="ht-sub" style="font-weight:700">— '+HT_BASIS[b].label+' 기준 · 한 문항이 여러 자료에 있으면 각각 셈</span></div><div style="display:grid;gap:5px">';
  arr.slice(0,10).forEach(function(x){
    h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 140px 54px;gap:10px;align-items:center" class="ht-sub">'
      +'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:#0f172a">'+htEsc(x.t)+'</b> <span style="font-size:10.5px">'+htsKindLabel(x.m)+' · '+x.nos.join(', ')+'번</span></span>'
      +'<div class="ht-bar"><i style="width:'+Math.round(x.n/max*100)+'%;background:'+HTS_KIND[htsGroup(x.m.kind)].c+'"></i></div><b style="text-align:right;font-variant-numeric:tabular-nums;color:#0f172a">'+x.n+(x.sure?('<small style="color:#15803d;font-weight:800"> ✓'+x.sure+'</small>'):'')+'</b></div>';
  });
  if(arr.length>10) h+='<div class="ht-sub" style="font-size:11px">… 그 밖에 '+(arr.length-10)+'개 자료</div>';
  return h+'</div></div>';
}
/* 학부모 보고서·블로그 자료에 쓰는 자료 종류 이름 (「수학비서」 낱말은 밖으로 안 나간다) */
function htsRepKind(m){ if(!m) return ''; var g=htsGroup(m.kind); if(g==='mf') return m.kind==='book'?'교재':'학습지'; return HTS_KIND[g].r; }
function htsOldRepKind(m){ return m?(m.kind==='book'?'교재':(m.kind==='upload'?'학원 프린트':'학습지')):''; }
htMd=(function(o){ return function(d){
  var t=o(d), s=htStats(d), b=d.basis||'same+var', g=htsByKind(d), rows=htReportRows(d), L=t.split('\n');
  for(var i=0;i<L.length;i++){
    if(/^- 등급별: /.test(L[i])){ L.splice(i+1, 0, '- 우리 자료별 적중 ('+HT_BASIS[b].label+'): '+htsByKindLine(d, true)+' (한 문항은 맨 앞 적중 자료 하나로 셈 · 자료 이름은 종류만)'); i++; }
    else if(/^- 대조한 우리 자료: /.test(L[i])){
      var parts=[]; if(g.mf.mats||!(g.tb.mats||g.ms.mats||g.pdf.mats)) parts.push('이 학교·학년 학생 '+(d.students||[]).length+'명이 '+(d.from||'')+' ~ '+(d.to||'')+' 동안 매쓰플랫에서 푼 학습지·교재 문항');
      if(g.tb.mats) parts.push('교과서 '+g.tb.mats+'문항'); if(g.ms.mats) parts.push('학원 학습지 '+g.ms.mats+'문항'); if(g.pdf.mats) parts.push('학원 프린트 '+g.pdf.mats+'문항');
      L[i]='- 대조한 우리 자료: '+parts.join(' + ');
    }
  }
  t=L.join('\n');
  rows.filter(function(r){ return r.inB; }).forEach(function(r){
    var head='| '+r.n+' | '+(r.it.chapter||'')+' | '+(r.it.type||'')+' | '+(r.it.level||'')+(r.it.killer?' ☠':'')+' | '+(HT_KIND[r.e.kind]||{}).t+(r.e.sure?'':' (확인 중)')+' | ';
    if(r.m) t=t.replace(head+htsOldRepKind(r.m)+' |', head+htsRepKind(r.m)+' |');
  });
  return t; }; })(htMd);
/* 학부모 보고서 — 인쇄 창에 쓰는 글에 «우리 자료별 적중» 줄을 넣고 자료 종류 이름을 고친다 */
function htsReportFix(d, h, code){
  var g=htsByKind(d), b=d.basis||'same+var', tot=g.tb.hit+g.ms.hit+g.pdf.hit+g.mf.hit;
  var blk='<h2>우리 자료별 적중</h2><div>'+HT_BASIS[b].label+' 기준 적중 '+tot+'문항이 나온 학원 자료 — '
    +['tb','ms','pdf','mf'].map(function(k){ return HTS_KIND[k].r+' <b'+(g[k].hit?' class="red"':'')+'>'+g[k].hit+'</b>'; }).join(' · ')+'</div>'
    +'<div style="display:flex;height:9px;margin-top:5px;background:#ddd">'+['tb','ms','pdf','mf'].map(function(k,i){ return '<div style="height:100%;width:'+(tot?(g[k].hit/tot*100):0)+'%;background:'+['#111','#555','#888','#b91c1c'][i]+'"></div>'; }).join('')+'</div>';
  var mk='<h2>문항 요약</h2>', i=h.indexOf(mk); if(i>=0) h=h.slice(0,i)+blk+h.slice(i);
  var rows={}; htReportRows(d).forEach(function(r){ rows[r.n]=r; });
  h=h.replace(/<tr><td><b>(\d+)<\/b>[\s\S]*?<\/tr>/g, function(row, n){ var r=rows[Number(n)]; if(!r||!r.inB||!r.m) return row;
    var old='<td>'+htEsc(htsOldRepKind(r.m))+'</td></tr>'; return row.slice(-old.length)===old ? row.slice(0,-old.length)+'<td>'+htEsc(htsRepKind(r.m))+'</td></tr>' : row; });
  if(code){ var stu=htStudentRow(d, code); if(stu.given) h=h.replace(/아직 풀지 않았던 것 (\d+)문항\./, function(all, n){ return '아직 풀지 않았던 것 '+n+'문항, 학원에서 나눠 준 교과서·학습지·프린트로 공부한 것 '+stu.given+'문항.'; }); }
  return h;
}
window.htPrint=(function(o){ return function(code){
  var d=HT.data[HT.cur], ow=window.open;
  window.open=function(){ var w=ow.apply(window, arguments); if(w && d){ try{ var doc=w.document, wr=doc.write.bind(doc); doc.write=function(x){ return wr(htsReportFix(d, String(x), code)); }; }catch(e){} } return w; };
  try{ return o(code); } finally { window.open=ow; } }; })(window.htPrint);
/* 다시 판정 — 처음 요청한 자료 구성(src)을 그대로 */
window.htRejudge = function(){
  var d=HT.data[HT.cur]; if(!d) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다'); return; }
  if(!confirm('문항 나누기는 그대로 두고, 우리 자료를 다시 모아 판정만 다시 합니다 (확정한 ✓/✗ 는 남습니다).')) return;
  var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:d.examId, exam:d.exam, rejudge:true, mydb:d.exam.mydb||null, from:d.from||'', to:d.to||'' };
  if(d.src) req.src=d.src;
  htKvSet('exam_hit_req', req).then(function(){ HT.req=req; htPollMaybe(); htToast('🔄 다시 판정을 요청했습니다'); render(); });
};
/* 카드뉴스 자료 이름 — 교과서 은행 문항은 «교과서», 수학비서 학습지는 학원 대비 자료 쪽으로 */
if(typeof cnMatKind==='function') cnMatKind=(function(o){ return function(m){
  if(m && m.kind==='textbook') return '교과서';
  var k=o(m); if(m && m.kind==='ms' && (k==='교과서'||k==='수업 학습지')) return '학원 대비 자료';
  return k; }; })(cnMatKind);
