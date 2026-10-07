/* ═══════════════════════════════════════════════════════════════════
 * v19-74: 🎯 적중 분석 — 시험지 ↔ 우리 자료 직접 대조 (docs/exam_hit_contract.md)
 * 원장 결정 2026-10-04: 시범 옥길중 중1 · 적중 기준은 화면에서 고른다 · 블로그는 .md 자료로 넘긴다
 *
 *  ① 시험지 올리기(사진·PDF) → aha_photos 임시 자리 → exam_hit_req 요청
 *  ② 워커(sync/exam_hit_worker.js, 5분마다)가 매쓰플랫 AI 로 문항을 나누고 우리 자료와 대조 → exam_hit_<시험>
 *  ③ 여기서 원장님이 후보를 ✓/✗ 로 확정 · 기준 고르기 · 보고서 인쇄 · 블로그 자료(.md) 내려받기
 *  학생앱에는 아무것도 보내지 않는다. 화면·인쇄물에 시험 그림은 서명 주소(2시간)로만 연다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var HT = { kicked:false, idx:null, req:null, cur:'', data:{}, loading:'', err:'', form:null, showForm:false, busy:'', signedFor:{},
  open:{}, poll:null, stuOpen:false, prn:'' };
var HT_BASIS = { 'same':{ label:'같은 문제만', kinds:['same'] }, 'same+var':{ label:'같은 문제 + 숫자변형', kinds:['same','var'] }, 'type':{ label:'유사유형까지', kinds:['same','var','type'] } };   /* v19-76: 수학비서 분석지 말로 */
var HT_KIND = { same:{ t:'같은 문제', c:'#b91c1c', bg:'#fee2e2' }, 'var':{ t:'숫자변형', c:'#c2410c', bg:'#ffedd5' }, type:{ t:'유사유형', c:'#1d4ed8', bg:'#dbeafe' }, text:{ t:'지문만 겹침', c:'#475569', bg:'#e2e8f0' }, none:{ t:'적중 없음', c:'#64748b', bg:'#f1f5f9' } };
var HT_SRC = { textbook:'교과서', workbook:'시중 교재', exam:'다른 학교 기출', bank:'문제은행' };

function htEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function htSb(){ try{ return getSupaClient(); }catch(e){ return null; } }
function htKv(key){ var sb=htSb(); if(!sb) return Promise.resolve(null);
  return sb.from('lumen_store').select('value').eq('key',key).then(function(r){ var v=r&&r.data&&r.data[0]?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } return v; }); }
function htKvSet(key, value){ var sb=htSb(); if(!sb) return Promise.reject(new Error('서버 연결 없음'));
  return sb.from('lumen_store').upsert({ key:key, value:value, updated_at:new Date().toISOString() }, { onConflict:'key' }).then(function(r){ if(r&&r.error) throw r.error; return true; }); }
function htToast(m){ try{ plToast(m); }catch(e){ try{ alert(m); }catch(_){} } }

/* ── 학교·학년 ── */
function htSchoolKey(s){ return String(s||'').replace(/\s/g,'').replace(/등학교$|학교$/,'').replace(/고등$/,'고'); }
function htGradeKey(g){ var t=String(g||''); var lv=/고등|고\s*\d/.test(t)?'고':(/초등|초\s*\d/.test(t)?'초':'중'); var n=(t.match(/(\d)/)||[])[1]||''; return n?(lv+n):''; }
function htExamId(e){ return [htSchoolKey(e.school), htGradeKey(e.grade), e.year, e.semester, e.term].join('_'); }
function htExamName(e){ if(!e) return ''; return e.school+' '+e.grade+' · '+e.year+'년 '+e.semester+'학기 '+e.term+'고사'; }
function htActive(){ try{ return getSortedStudents().filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; }); }catch(e){ return []; } }
function htStuByCode(c){ var a=htActive(); for(var i=0;i<a.length;i++){ if(String(a[i].lumen_rec_code)===String(c)) return a[i]; } return null; }
function htStuLabel(c){ var s=htStuByCode(c); if(!s) return '(퇴원·미등록)'; try{ return iblShow(s.name); }catch(e){ return s.name; } }
function htCohorts(){ var m={}; htActive().forEach(function(s){ var sk=htSchoolKey(s.school), gk=htGradeKey(s.grade); if(!sk||!gk) return; var k=sk+'|'+gk; m[k]=(m[k]||0)+1; }); return m; }

/* ── 불러오기 ── */
function htKick(){
  if(HT.kicked) return; HT.kicked=true;
  HT.loading='목록'; Promise.all([htKv('exam_hit_index'), htKv('exam_hit_req')]).then(function(a){
    HT.idx=a[0]||{ items:[] }; HT.req=a[1]||null; HT.loading='';
    if(!HT.cur && HT.idx.items && HT.idx.items.length) HT.cur=HT.idx.items[0].examId;
    if(HT.cur) htLoad(HT.cur); htPollMaybe(); if(VIEW==='examhit') render();
  }).catch(function(e){ HT.loading=''; HT.err=String(e.message||e); if(VIEW==='examhit') render(); });
}
function htLoad(id, force){
  if(!id) return; if(HT.data[id] && !force){ htSignFor(id); return; }
  HT.loading='시험'; htKv('exam_hit_'+id).then(function(v){ HT.loading=''; if(v) HT.data[id]=v; htSignFor(id); if(VIEW==='examhit') render(); })
    .catch(function(e){ HT.loading=''; HT.err=String(e.message||e); if(VIEW==='examhit') render(); });
}
function htSignFor(id){
  var d=HT.data[id]; if(!d || HT.signedFor[id]) return; HT.signedFor[id]=1;
  var paths=[]; (d.items||[]).forEach(function(it){ if(it.img) paths.push(it.img); });
  Object.keys(d.mats||{}).forEach(function(k){ if(d.mats[k].store) paths.push(d.mats[k].store); });
  if(typeof eaSign==='function') eaSign(paths).then(function(){ if(VIEW==='examhit') render(); });
}
function htSigned(p){ try{ return (EA.signed||{})[p]||''; }catch(e){ return ''; } }
function htMatImg(m){ return m ? (m.img || m.storeUrl || (m.store?htSigned(m.store):'')) : ''; }
function htItemImg(it){ return it ? (it.imgUrl || htSigned(it.img)) : ''; }   /* v19-76: 워커가 적어 둔 1년 서명 주소 먼저 */

/* 요청 진행 상황을 15초마다 본다 (요청 중·진행 중일 때만) */
function htPollMaybe(){
  var r=HT.req; var live=r && (r.status==='requested'||r.status==='running');
  if(live && !HT.poll){
    HT.poll=setInterval(function(){
      htKv('exam_hit_req').then(function(v){
        var was=HT.req&&HT.req.status; HT.req=v;
        if(v && v.status==='done' && was!=='done'){ HT.data[v.examId]=null; HT.signedFor[v.examId]=0; HT.cur=v.examId; htKv('exam_hit_index').then(function(x){ HT.idx=x||HT.idx; htLoad(v.examId, true); }); htToast('🎯 적중 분석이 끝났습니다'); }
        if(!v || (v.status!=='requested' && v.status!=='running')){ clearInterval(HT.poll); HT.poll=null; }
        if(VIEW==='examhit') render();
      });
    }, 15000);
  }
}

/* ── 계산 ── */
function htVisible(d){ return (d.items||[]).filter(function(it){ return !it.mergedInto; }); }
function htNumOf(d, it){ var v=htVisible(d); for(var i=0;i<v.length;i++){ if(v[i].no===it.no) return i+1; } return it.no; }
function htEff(it){
  if(it.hit && it.hit.ok===true) return { kind:it.hit.kind, k:it.hit.k, sure:true };
  if(it.hit && it.hit.ok===false) return { kind:'none', k:null, sure:true };
  var c=(it.cands||[])[0]; return c ? { kind:c.kind, k:c.k, sure:false } : { kind:'none', k:null, sure:false };
}
function htInBasis(kind, basis){ return (HT_BASIS[basis]||HT_BASIS['same+var']).kinds.indexOf(kind)>=0; }
function htStats(d){
  var b=d.basis||'same+var', v=htVisible(d), s={ total:v.length, hitSure:0, hitCand:0, open:0, text:0, killers:0, essay:0, levelAvg:0, repeat:0, src:{}, kinds:{ same:0,'var':0,type:0,text:0,none:0 } };
  v.forEach(function(it){
    var e=htEff(it); s.kinds[e.kind]=(s.kinds[e.kind]||0)+1;
    if(htInBasis(e.kind,b)){ if(e.sure) s.hitSure++; else s.hitCand++; }
    if(!e.sure && (it.cands||[]).length) s.open++;
    if(e.kind==='text') s.text++;
    if(it.killer) s.killers++; if(it.essay) s.essay++; if((it.repeat||[]).length) s.repeat++;
    s.levelAvg+=Number(it.level||0); s.src[it.source||'bank']=(s.src[it.source||'bank']||0)+1;
  });
  s.levelAvg=v.length?Math.round(s.levelAvg/v.length*10)/10:0;
  s.pctSure=v.length?Math.round(s.hitSure/v.length*100):0; s.pctAll=v.length?Math.round((s.hitSure+s.hitCand)/v.length*100):0;
  return s;
}
/* 학생 한 명: 적중 문항(기준 안)마다 시험 전에 우리 자료에서 맞혔나 */
function htStudentRow(d, code){
  var b=d.basis||'same+var', out={ code:code, hit:0, O:0, X:0, none:0, xs:[], os:[] };
  htVisible(d).forEach(function(it){
    var e=htEff(it); if(!htInBasis(e.kind,b) || !e.k) return; out.hit++;
    var c=(it.cands||[]).filter(function(x){ return x.k===e.k; })[0]; var keys=[e.k].concat(c&&c.also||[]);
    var r=''; keys.forEach(function(k){ var m=(d.mats||{})[k]; var x=m&&m.res?m.res[code]:''; if(x==='O') r='O'; else if((x==='X'||x==='?') && r!=='O') r='X'; });
    var n=htNumOf(d,it); if(r==='O'){ out.O++; out.os.push(n); } else if(r==='X'){ out.X++; out.xs.push(n); } else out.none++;
  });
  return out;
}

/* ── 저장·확정 ── */
function htSave(d){ d.savedAt=new Date().toISOString(); return htKvSet('exam_hit_'+d.examId, d).catch(function(e){ htToast('저장 실패: '+(e.message||e)); }); }
function htItem(no){ var d=HT.data[HT.cur]; if(!d) return null; return (d.items||[]).filter(function(x){ return x.no===no; })[0]||null; }
window.htConfirm = function(no, k, ok){
  var d=HT.data[HT.cur], it=htItem(no); if(!d||!it) return;
  if(ok===null){ it.hit=null; }
  else if(ok===false && !k){ it.hit={ k:null, kind:'none', ok:false, by:'teacher', at:new Date().toISOString() }; }
  else { var c=(it.cands||[]).filter(function(x){ return x.k===k; })[0]; if(!c) return; if(!c.ai) c.ai=c.kind;   /* v19-77: AI 원래 판정 */
    if(ok===false){ c.rejected=true; it.cands.sort(function(a,b){ return (a.rejected?1:0)-(b.rejected?1:0); }); it.hit=null; }
    else it.hit={ k:k, kind:(it.hit&&it.hit.k===k&&it.hit.kind)||c.kind, ok:true, by:'teacher', at:new Date().toISOString() }; }
  if(htStats(d).open===0 && !d.confirmedAt) d.confirmedAt=new Date().toISOString();
  if(ok!==null && HT.unfold) HT.unfold[no]=false;   /* v19-77: 확정하면 접힌다 */
  htSave(d); render();
};
window.htSetKind = function(no, k, kind){
  var d=HT.data[HT.cur], it=htItem(no); if(!d||!it) return;
  var c=(it.cands||[]).filter(function(x){ return x.k===k; })[0]; if(!c) return;
  if(!c.ai) c.ai=c.kind; c.kind=kind; it.hit={ k:k, kind:kind, ok:true, by:'teacher', at:new Date().toISOString() };
  if(HT.unfold) HT.unfold[no]=false;   /* v19-77 */
  htSave(d); render();
};
window.htMerge = function(no){
  var d=HT.data[HT.cur]; if(!d) return; var v=htVisible(d); var prev=null;
  for(var i=0;i<v.length;i++){ if(v[i].no===no){ prev=v[i-1]||null; break; } }
  var it=htItem(no); if(!it||!prev){ htToast('앞 문항이 없습니다'); return; }
  it.mergedInto=prev.no; (prev.extra=prev.extra||[]).push(it.no);
  htSave(d); render();
};
window.htUnmerge = function(no){
  var d=HT.data[HT.cur]; if(!d) return; var it=htItem(no); if(!it) return;
  (it.extra||[]).forEach(function(x){ var m=htItem(x); if(m) delete m.mergedInto; }); it.extra=[];
  htSave(d); render();
};
window.htBasis = function(b){ var d=HT.data[HT.cur]; if(!d||!HT_BASIS[b]) return; d.basis=b; htSave(d); render(); };
window.htPick = function(id){ HT.cur=id; HT.showForm=false; htLoad(id); render(); };
window.htToggle = function(no){ HT.open[no]=!HT.open[no]; render(); };
window.htReload = function(){ HT.kicked=false; HT.data={}; HT.signedFor={}; htKick(); render(); };

/* ── ① 시험지 올리기 ── */
function htFormDefault(){
  var c=htCohorts(), best='', n=0; Object.keys(c).forEach(function(k){ if(c[k]>n && /^옥길중\|중1$/.test(k)){ best=k; n=c[k]; } });
  if(!best) Object.keys(c).forEach(function(k){ if(c[k]>n){ best=k; n=c[k]; } });
  var p=(best||'옥길중|중1').split('|'), now=new Date(), mo=now.getMonth()+1;
  return { school:p[0], grade:p[1], year:now.getFullYear(), semester:mo>=7?'2':'1', term:(mo>=11||(mo>=5&&mo<=7))?'기말':'중간', date:'', matTitle:'' };
}
window.htShowForm = function(){ HT.showForm=!HT.showForm; if(HT.showForm && typeof HTDB!=='undefined') HTDB.open=false; if(!HT.form) HT.form=htFormDefault(); render(); };
window.htFormSet = function(k, v){ if(!HT.form) HT.form=htFormDefault(); HT.form[k]=v; };
function htToJpeg(file){
  return new Promise(function(res, rej){
    if(/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)){ res({ blob:file, type:'application/pdf', ext:'pdf' }); return; }
    var url=URL.createObjectURL(file), im=new Image();
    im.onload=function(){ var W=im.naturalWidth, H=im.naturalHeight, s=Math.min(1, 2400/Math.max(W,H)); var cv=document.createElement('canvas'); cv.width=Math.round(W*s); cv.height=Math.round(H*s);
      var g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height); g.drawImage(im,0,0,cv.width,cv.height); URL.revokeObjectURL(url);
      cv.toBlob(function(b){ b?res({ blob:b, type:'image/jpeg', ext:'jpg' }):rej(new Error('그림 변환 실패')); }, 'image/jpeg', 0.88); };
    im.onerror=function(){ URL.revokeObjectURL(url); rej(new Error(file.name+' 을(를) 열 수 없습니다 (한글·워드는 PDF 로 저장해서 올려 주세요)')); };
    im.src=url;
  });
}
function htRand(){ var a='abcdefghijkmnpqrstuvwxyz23456789', s=''; for(var i=0;i<16;i++) s+=a[Math.floor(Math.random()*a.length)]; return s; }
async function htUploadAll(files, prefix){
  var sb=htSb(); if(!sb) throw new Error('서버 연결 없음'); var out=[];
  for(var i=0;i<files.length;i++){
    var f=await htToJpeg(files[i]); var path=prefix+'/'+(i+1)+'.'+f.ext;
    var up=await sb.storage.from('aha_photos').upload(path, f.blob, { contentType:f.type, upsert:true });
    if(up.error) throw new Error('올리기 실패: '+(up.error.message||up.error));
    out.push({ bucket:'aha_photos', path:path });
  }
  return out;
}
window.htSubmit = async function(){
  if(HT.busy) return; var F=HT.form||htFormDefault();
  var ef=document.getElementById('ht-files'), mf=document.getElementById('ht-mats');
  var files=ef&&ef.files?Array.prototype.slice.call(ef.files):[], mats=mf&&mf.files?Array.prototype.slice.call(mf.files):[];
  if(!files.length){ htToast('시험지 사진이나 PDF 를 골라 주세요'); return; }
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다 — 끝난 뒤 올려 주세요'); return; }
  var exam={ school:htSchoolKey(F.school), grade:htGradeKey(F.grade), year:Number(F.year), semester:String(F.semester), term:F.term, date:F.date||'' };
  if(!exam.school||!exam.grade||!exam.year){ htToast('학교·학년·연도를 확인해 주세요'); return; }
  if(!confirm('「'+htExamName(exam)+'」 시험지 '+files.length+'개'+(mats.length?(' + 우리 프린트 '+mats.length+'개'):'')+'를 올립니다.\n\n서버가 5~15분 동안 매쓰플랫 AI 로 문항을 나누고 우리 자료와 대조합니다.')) return;
  HT.busy='올리는 중'; render();
  try{
    var r=htRand();
    var up=await htUploadAll(files, '_exam_hit/'+r+'/exam');
    var um=mats.length?await htUploadAll(mats, '_exam_hit/'+r+'/mat'):[];
    um.forEach(function(m, i){ m.title=(F.matTitle||'우리 프린트')+(um.length>1?(' '+(i+1)):''); });
    var id=htExamId(exam);
    var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:id, exam:exam, files:up, mats:um };
    await htKvSet('exam_hit_req', req); HT.req=req; HT.busy=''; HT.showForm=false; HT.cur=id; htPollMaybe();
    htToast('📤 올렸습니다 — 분석이 시작되면 아래 띠에 진행 상황이 보입니다');
  }catch(e){ HT.busy=''; htToast('실패: '+(e.message||e)); }
  render();
};
window.htRejudge = function(){
  var d=HT.data[HT.cur]; if(!d) return;
  if(HT.req && (HT.req.status==='requested'||HT.req.status==='running')){ htToast('앞의 분석이 아직 진행 중입니다'); return; }
  if(!confirm('문항 나누기는 그대로 두고, 우리 자료를 다시 모아 판정만 다시 합니다 (확정한 ✓/✗ 는 남습니다).')) return;
  var req={ status:'requested', reqAt:new Date().toISOString(), by:'app', examId:d.examId, exam:d.exam, rejudge:true, mydb:d.exam.mydb||null, from:d.from||'', to:d.to||'' };
  htKvSet('exam_hit_req', req).then(function(){ HT.req=req; htPollMaybe(); htToast('🔄 다시 판정을 요청했습니다'); render(); });
};

/* ── 그리기 ── */
function htPill(kind, sure){ var k=HT_KIND[kind]||HT_KIND.none; return '<span class="ht-pill" style="color:'+k.c+';background:'+k.bg+(sure?'':';border:1px dashed '+k.c)+'">'+k.t+(sure?' ✓':'')+'</span>'; }
function htDonut(s, size, ink){
  var R=38, C=2*Math.PI*R, a=s.total?s.hitSure/s.total:0, b=s.total?s.hitCand/s.total:0;
  var red=ink?'#b91c1c':'#dc2626', soft=ink?'#f1b5b5':'#fca5a5', rest=ink?'#e5e5e5':'#e2e8f0';
  return '<svg viewBox="0 0 100 100" width="'+(size||132)+'" height="'+(size||132)+'" role="img" aria-label="적중률 '+s.pctAll+'%">'
    +'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+rest+'" stroke-width="14"/>'
    +(b?'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+soft+'" stroke-width="14" stroke-dasharray="'+(C*(a+b))+' '+C+'" transform="rotate(-90 50 50)"/>':'')
    +(a?'<circle cx="50" cy="50" r="'+R+'" fill="none" stroke="'+red+'" stroke-width="14" stroke-dasharray="'+(C*a)+' '+C+'" transform="rotate(-90 50 50)"/>':'')
    +'<text x="50" y="49" text-anchor="middle" font-size="18" font-weight="900" fill="#0f172a">'+s.pctAll+'%</text>'
    +'<text x="50" y="64" text-anchor="middle" font-size="8.5" font-weight="700" fill="#64748b">'+(s.hitSure+s.hitCand)+' / '+s.total+'문항</text></svg>';
}
var HT_CSS = '<style>'
  +'.ht-wrap{max-width:1180px;font-family:inherit;color:#0f172a}'
  +'.ht-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:12px}'
  +'.ht-h{font-size:13px;font-weight:900;color:#0d2240;margin:0 0 8px}'
  +'.ht-sub{font-size:12px;color:#64748b;font-weight:600;line-height:1.55}'
  +'.ht-btn{padding:7px 12px;border-radius:9px;border:1px solid #cbd5e1;background:#fff;color:#0d2240;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit}'
  +'.ht-btn:hover{background:#f1f5f9}.ht-btn:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
  +'.ht-btn.pri{background:#0d2240;color:#fff;border-color:#0d2240}.ht-btn.pri:hover{background:#16325c}'
  +'.ht-btn.ok{background:#fee2e2;color:#b91c1c;border-color:#fecaca}.ht-btn.no{background:#f8fafc;color:#475569}'
  +'.ht-chip{padding:6px 11px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;color:#334155}'
  +'.ht-chip.on{background:#0d2240;color:#fff;border-color:#0d2240}'
  +'.ht-pill{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:900;white-space:nowrap}'
  +'.ht-grid{display:grid;grid-template-columns:200px 1fr;gap:16px;align-items:center}'
  +'.ht-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}'
  +'.ht-tile{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px}.ht-tile b{display:block;font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}.ht-tile span{font-size:11px;color:#64748b;font-weight:700}'
  +'.ht-tbl{width:100%;border-collapse:collapse;font-size:12px}.ht-tbl th{background:#f8fafc;color:#475569;font-weight:800;text-align:left;padding:7px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap}'
  +'.ht-tbl td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}.ht-tbl tr.open td{background:#fafcff}'
  +'.ht-thumb{width:150px;max-height:96px;object-fit:contain;object-position:left top;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:zoom-in}'
  +'.ht-cand{display:flex;gap:10px;align-items:flex-start;padding:8px;border:1px solid #e2e8f0;border-radius:10px;margin-top:6px;background:#fff}'
  +'.ht-cand img{width:260px;max-height:180px;object-fit:contain;object-position:left top;border:1px solid #e2e8f0;border-radius:6px;cursor:zoom-in}'
  +'.ht-bar{height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden}.ht-bar i{display:block;height:100%;background:#0d2240}'
  +'.ht-strip{display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;font-size:12px;font-weight:800;color:#1e3a8a;margin-bottom:12px}'
  +'.ht-strip.err{background:#fef2f2;border-color:#fecaca;color:#991b1b}'
  +'.ht-form{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin:8px 0}'
  +'.ht-form label{font-size:11px;font-weight:800;color:#64748b;display:flex;flex-direction:column;gap:3px}'
  +'.ht-form select,.ht-form input{padding:7px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit}'
  +'@media (max-width:760px){.ht-grid{grid-template-columns:1fr}.ht-thumb{width:96px}.ht-cand{flex-direction:column}.ht-cand img{width:100%}}'
  +'</style>';

window.htZoom = function(src){
  if(!src) return; var o=document.createElement('div');
  o.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
  o.onclick=function(){ o.remove(); };
  o.innerHTML='<img src="'+htEsc(src)+'" style="max-width:96vw;max-height:92vh;background:#fff;border-radius:8px;padding:8px">';
  document.body.appendChild(o);
};

function rExamHit(){
  htKick();
  var h=HT_CSS+'<div class="ht-wrap">';
  h+='<div class="ht-card"><div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1;min-width:260px"><div style="font-size:17px;font-weight:900;color:#0d2240">🎯 적중 분석</div>'
    +'<div class="ht-sub">학교 시험지를 올리면 문항을 나눠, 그 학교·학년 학생들이 시험 전에 매쓰플랫에서 푼 학습지·교재와 하나씩 대조합니다. '
    +'AI 가 고른 후보는 <b>원장님이 ✓/✗ 로 확정</b>해야 적중률에 «확정»으로 들어갑니다. 학생앱에는 보이지 않습니다.</div></div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="ht-btn pri" onclick="htShowForm()">📤 시험지 올리기</button>'+(typeof htdbToggle==='function'?'<button class="ht-btn'+(typeof HTDB!=='undefined'&&HTDB.open?' pri':'')+'" onclick="htdbToggle()">📚 기출 DB에서 찾기</button>':'')+'<button class="ht-btn" onclick="htReload()">🔄 새로고침</button></div></div>';   /* v19-80 */
  /* 시험 고르기 */
  var items=(HT.idx&&HT.idx.items)||[];
  if(items.length){ h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'; items.forEach(function(x){ h+='<button class="ht-chip'+(x.examId===HT.cur?' on':'')+'" onclick="htPick(\''+htEsc(x.examId).replace(/'/g,'')+'\')">'+htEsc(htExamName(x))+(/시범/.test(x.examId)?' · 시범':'')+'</button>'; }); h+='</div>'; }
  h+='</div>';
  /* 진행 띠 */
  var r=HT.req;
  if(HT.busy) h+='<div class="ht-strip">⏳ '+htEsc(HT.busy)+'…</div>';
  else if(r && (r.status==='requested'||r.status==='running')) h+='<div class="ht-strip"><b>⏳ '+htEsc(htExamName(r.exam))+'</b> — '+(r.status==='requested'?'서버가 받기를 기다리는 중 (5분 안)':htEsc(r.step||'진행 중'))+'<div class="ht-bar" style="flex:1;max-width:280px"><i style="width:'+(Number(r.pct)||3)+'%"></i></div><span>'+(Number(r.pct)||0)+'%</span></div>';
  else if(r && r.status==='error' && (Date.now()-new Date(r.doneAt||0).getTime())<86400000) h+='<div class="ht-strip err">⚠ 지난 요청이 멈췄습니다: '+htEsc(r.error||'')+' — 다시 올려 주세요.</div>';
  /* 올리기 폼 */
  if(HT.showForm){
    var F=HT.form||(HT.form=htFormDefault()), co=htCohorts(), schools={}, grades={};
    Object.keys(co).forEach(function(k){ var p=k.split('|'); schools[p[0]]=1; grades[p[1]]=1; });
    var opt=function(list, val){ return list.map(function(x){ return '<option'+(String(x)===String(val)?' selected':'')+'>'+htEsc(x)+'</option>'; }).join(''); };
    var y=new Date().getFullYear(), n=co[htSchoolKey(F.school)+'|'+htGradeKey(F.grade)]||0;
    h+='<div class="ht-card"><div class="ht-h">📤 시험지 올리기</div><div class="ht-form">'
      +'<label>학교<select onchange="htFormSet(\'school\',this.value);render()">'+opt(Object.keys(schools).sort(), F.school)+'</select></label>'
      +'<label>학년<select onchange="htFormSet(\'grade\',this.value);render()">'+opt(Object.keys(grades).sort(), F.grade)+'</select></label>'
      +'<label>연도<select onchange="htFormSet(\'year\',this.value)">'+opt([y,y-1,y-2], F.year)+'</select></label>'
      +'<label>학기<select onchange="htFormSet(\'semester\',this.value)">'+opt(['1','2'], F.semester)+'</select></label>'
      +'<label>시험<select onchange="htFormSet(\'term\',this.value)">'+opt(['중간','기말'], F.term)+'</select></label>'
      +'<label>시험 첫날<input type="date" value="'+htEsc(F.date)+'" onchange="htFormSet(\'date\',this.value)"></label></div>'
      +'<div class="ht-sub" style="margin-bottom:8px">대상 학생 <b>'+n+'명</b>이 이번 학기 초부터 시험 첫날까지 푼 매쓰플랫 기록이 «우리 자료»가 됩니다. '+(n?'':'<b style="color:#b91c1c">이 학교·학년 학생이 없습니다.</b>')+'</div>'
      +'<div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">'
      +'<div style="border:1px dashed #94a3b8;border-radius:10px;padding:10px"><div class="ht-h" style="margin:0 0 4px">① 시험지 <span style="color:#b91c1c">*</span></div><div class="ht-sub">사진 여러 장(쪽 순서대로) 또는 PDF</div><input id="ht-files" type="file" multiple accept="image/*,application/pdf" style="margin-top:6px;font-size:12px"></div>'
      +'<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:10px"><div class="ht-h" style="margin:0 0 4px">② 우리 프린트 (선택)</div><div class="ht-sub">매쓰플랫 밖에서 나눠 준 자료. 한글·워드는 PDF 로 저장해서 올려 주세요.</div><input id="ht-mats" type="file" multiple accept="image/*,application/pdf" style="margin-top:6px;font-size:12px"><input placeholder="자료 이름 (예: 옥길중 직전 대비 프린트)" value="'+htEsc(F.matTitle)+'" onchange="htFormSet(\'matTitle\',this.value)" style="margin-top:6px;width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;font-size:12px;font-family:inherit"></div></div>'
      +'<div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><button class="ht-btn pri" onclick="htSubmit()">📤 올리고 분석 요청</button><span class="ht-sub">결과는 5~15분 뒤 이 화면에 뜹니다.</span></div></div>';
  }
  if(typeof HTDB!=='undefined' && HTDB.open) h+=htdbPanelHtml();   /* v19-80: 📚 기출 DB에서 찾기 */
  if(HT.err) h+='<div class="ht-strip err">'+htEsc(HT.err)+'</div>';
  var d=HT.cur?HT.data[HT.cur]:null;
  if(!d){
    if(HT.loading) h+='<div class="ht-card ht-sub">불러오는 중…</div>';
    else if(!items.length) h+='<div class="ht-card ht-sub">아직 분석한 시험이 없습니다. 「📤 시험지 올리기」나 「📚 기출 DB에서 찾기」로 시작해 주세요.</div>';
    return h+'</div>';
  }
  h+=htSummaryHtml(d)+(typeof CN!=='undefined'&&CN.open?cnPanelHtml(d):'')+htStudentsHtml(d)+htItemsView(d);   /* v19-80: 📰 카드뉴스 */
  return h+'</div>';
}

function htSummaryHtml(d){
  var s=htStats(d), b=d.basis||'same+var', e=d.exam||{};
  var h='<div class="ht-card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><div style="font-size:15px;font-weight:900;color:#0d2240;flex:1;min-width:220px">'+htEsc(htExamName(e))+(/시범/.test(d.examId)?' <span class="ht-pill" style="background:#fef3c7;color:#92400e">시범 — '+htEsc(d.from)+'~'+htEsc(d.to)+' 자료로 대조</span>':'')+'</div>'
    +'<label class="ht-sub" style="display:flex;gap:6px;align-items:center">적중 기준 <select onchange="htBasis(this.value)" style="padding:6px 8px;border:1px solid #0d2240;border-radius:8px;font-size:12px;font-weight:800;font-family:inherit">';
  Object.keys(HT_BASIS).forEach(function(k){ h+='<option value="'+k+'"'+(k===b?' selected':'')+'>'+HT_BASIS[k].label+'</option>'; });
  h+='</select></label></div><div class="ht-grid"><div style="text-align:center">'+htDonut(s)+'<div class="ht-sub">확정 <b style="color:#b91c1c">'+s.hitSure+'</b> · 후보 '+s.hitCand+''+htThreeRates(d)+'</div></div><div>'
    +'<div class="ht-tiles">'
    +'<div class="ht-tile"><b>'+s.total+'</b><span>총 문항</span></div>'
    +'<div class="ht-tile"><b>'+s.levelAvg+'<small style="font-size:12px;color:#94a3b8">/5</small></b><span>평균 난도</span></div>'
    +'<div class="ht-tile"><b>'+s.killers+'</b><span>☠ 킬러 (난도 4·5)</span></div>'
    +'<div class="ht-tile"><b>'+s.essay+'</b><span>서술형</span></div>'
    +'<div class="ht-tile"><b>'+s.repeat+'</b><span>반복 출제 (지난 기출)</span></div>'
    +'<div class="ht-tile"><b>'+s.text+'</b><span>지문만 겹침 (적중 아님)</span></div>'
    +'<div class="ht-tile" style="border-color:'+(s.open?'#fecaca':'#bbf7d0')+'"><b style="color:'+(s.open?'#b91c1c':'#15803d')+'">'+s.open+'</b><span>확정 안 한 문항</span></div></div>'
    +'<div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:10px">';
  ['same','var','type','text','none'].forEach(function(k){ h+='<span class="ht-sub">'+htPill(k,false)+' <b>'+(s.kinds[k]||0)+'</b></span>'; });
  h+='</div><div style="margin-top:10px;display:grid;gap:4px">';
  Object.keys(HT_SRC).forEach(function(k){ var n=s.src[k]||0; if(!n) return; h+='<div style="display:grid;grid-template-columns:110px 1fr 40px;gap:8px;align-items:center" class="ht-sub"><span>'+HT_SRC[k]+'</span><div class="ht-bar"><i style="width:'+Math.round(n/Math.max(1,s.total)*100)+'%"></i></div><b style="font-variant-numeric:tabular-nums">'+n+'</b></div>'; });
  h+='<div class="ht-sub" style="font-size:11px">출처 = 매쓰플랫이 찾은 «가장 닮은 원본»의 종류 (근사치)</div></div></div></div>';
  h+=htTrendHtml(d);   /* v19-79: 원장님이 고칠 수 있는 출제 경향·킬러 문항 */
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;align-items:center">'
    +'<button class="ht-btn pri" onclick="htPrint(\'\')">🖨 학부모 보고서 (전체)</button>'
    +'<select class="ht-btn" onchange="if(this.value){htPrint(this.value);this.value=\'\'}"><option value="">🖨 학생별 보고서…</option>'+(d.students||[]).map(function(c){ return '<option value="'+htEsc(c)+'">'+htEsc(htStuLabel(c))+'</option>'; }).join('')+'</select>'
    +'<button class="ht-btn" onclick="htExportMd()">📝 블로그 자료 (.md)</button>'
    +(typeof cnToggle==='function'?'<button class="ht-btn'+(CN.open?' pri':'')+'" onclick="cnToggle()">📰 카드뉴스</button>':'')   /* v19-80 */
    +'<button class="ht-btn" onclick="htCopy()">📋 요약 글 복사</button>'
    +'<button class="ht-btn" onclick="htRejudge()">🔄 다시 판정</button>'
    +(s.open?'<span class="ht-sub" style="color:#b91c1c">확정 안 한 문항이 '+s.open+'개 — 보고서에 「후보」로 따로 적힙니다</span>':'<span class="ht-sub" style="color:#15803d">✓ 모두 확정</span>')+'</div>';
  return h+'</div>';
}

function htStudentsHtml(d){
  var rows=(d.students||[]).map(function(c){ return htStudentRow(d,c); });
  var h='<div class="ht-card"><div style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="HT.stuOpen=!HT.stuOpen;render()"><div class="ht-h" style="margin:0;flex:1">👥 학생별 — 적중 문항을 시험 전에 우리 자료에서 맞혔나 ('+rows.length+'명)</div><span class="ht-sub">'+(HT.stuOpen?'접기 ▲':'펼치기 ▼')+'</span></div>';
  if(!HT.stuOpen) return h+'</div>';
  h+='<div style="overflow-x:auto;margin-top:8px"><table class="ht-tbl"><tr><th>학생</th><th>적중 문항</th><th>맞힘</th><th>틀림·모름</th><th>안 풀었음</th><th>틀렸던 문항</th></tr>';
  rows.sort(function(a,b){ return b.X-a.X; }).forEach(function(r){
    h+='<tr><td><b>'+htEsc(htStuLabel(r.code))+'</b></td><td>'+r.hit+'</td><td style="color:#15803d;font-weight:800">'+r.O+'</td><td style="color:#b91c1c;font-weight:800">'+r.X+'</td><td>'+r.none+'</td><td>'+(r.xs.length?r.xs.map(function(n){ return n+'번'; }).join(' · '):'—')+'</td></tr>';
  });
  return h+'</table></div><div class="ht-sub" style="margin-top:6px">「맞힘」은 적중한 우리 자료 문항의 가장 최근 채점이 정답인 것. 실제 시험 정오답은 아직 들어 있지 않습니다.</div></div>';
}

function htItemsHtml(d){
  var b=d.basis||'same+var';
  var h='<div class="ht-card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><div class="ht-h" style="margin:0;flex:1">📋 표 보기 — 줄을 누르면 후보 그림과 등급 단추</div>'+htViewChips()+'</div><div style="overflow-x:auto"><table class="ht-tbl"><tr><th>번호</th><th>시험 문항</th><th>단원 · 유형</th><th>난도</th><th>출처</th><th>반복</th><th>적중</th><th>우리 자료</th></tr>';
  htVisible(d).forEach(function(it){
    var n=htNumOf(d,it), e=htEff(it), top=e.k?(it.cands||[]).filter(function(c){ return c.k===e.k; })[0]:null, m=top?(d.mats||{})[top.k]:null, src=htItemImg(it);
    var inB=htInBasis(e.kind,b);
    h+='<tr class="'+(HT.open[it.no]?'open':'')+'" style="cursor:pointer" onclick="htToggle('+it.no+')">'
      +'<td><b style="font-size:14px">'+n+'</b>'+(it.extra&&it.extra.length?'<div class="ht-sub">상자 '+(1+it.extra.length)+'개</div>':'')+'</td>'
      +'<td>'+(src?'<img class="ht-thumb" src="'+htEsc(src)+'" alt="'+n+'번 문항" onclick="event.stopPropagation();htZoom(this.src)">':'<span class="ht-sub">그림 준비 중</span>')+(it.ask?'<div class="ht-sub" style="max-width:150px">'+htEsc(it.ask)+'</div>':'')+'</td>'
      +'<td><b>'+htEsc(it.chapter||'')+'</b><div class="ht-sub">'+htEsc(it.type||'(유형 미확인)')+'</div></td>'
      +'<td style="white-space:nowrap">'+(it.level||'-')+(it.killer?' <span title="킬러">☠</span>':'')+(it.essay?' <span class="ht-pill" style="background:#f1f5f9;color:#334155">서술</span>':'')+'</td>'
      +'<td class="ht-sub">'+(HT_SRC[it.source]||'')+'</td>'
      +'<td class="ht-sub">'+((it.repeat||[]).length?it.repeat.map(function(r){ return r.year+' '+r.no+'번'; }).join('<br>'):'—')+'</td>'
      +'<td>'+htPill(e.kind, e.sure)+(inB?'':'<div class="ht-sub" style="font-size:10px">기준 밖</div>')+'</td>'
      +'<td class="ht-sub" style="max-width:220px">'+(m?htEsc(m.where):'—')+'</td></tr>';
    if(HT.open[it.no]) h+='<tr class="open"><td colspan="8">'+htItemDetail(d,it,n)+'</td></tr>';
  });
  return h+'</table></div></div>';
}
function htItemDetail(d, it, n){
  var h='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:4px">'
    +'<button class="ht-btn no" onclick="htConfirm('+it.no+',null,false)">✗ 적중 없음으로 확정</button>'
    +(it.hit?'<button class="ht-btn no" onclick="htConfirm('+it.no+',null,null)">↺ 확정 풀기</button>':'')
    +(n>1?'<button class="ht-btn no" onclick="htMerge('+it.no+')" title="AI 가 한 문항을 둘로 잘랐을 때">⤴ 앞 문항과 합치기</button>':'')
    +(it.extra&&it.extra.length?'<button class="ht-btn no" onclick="htUnmerge('+it.no+')">⤵ 합친 것 풀기</button>':'')+'</div>';
  (it.extra||[]).forEach(function(x){ var m=htItem(x); if(m&&htItemImg(m)) h+='<img class="ht-thumb" style="width:260px;max-height:none" src="'+htEsc(htItemImg(m))+'" onclick="htZoom(this.src)" alt="합친 상자">'; });
  if(!(it.cands||[]).length) return h+'<div class="ht-sub">같은 유형으로 푼 우리 자료가 없습니다 → 「적중 없음」이 맞습니다.</div>';
  it.cands.forEach(function(c){
    var m=(d.mats||{})[c.k]||{}, img=htMatImg(m), sel=it.hit&&it.hit.k===c.k&&it.hit.ok;
    var solved=Object.keys(m.res||{}).length, wrong=Object.keys(m.res||{}).filter(function(k){ return m.res[k]!=='O'; }).length;
    h+='<div class="ht-cand" style="'+(sel?'border-color:#b91c1c;box-shadow:0 0 0 1px #b91c1c':'')+(c.rejected?';opacity:.55':'')+'">'
      +(img?'<img src="'+htEsc(img)+'" alt="우리 자료 문항" onclick="htZoom(this.src)">':'<div class="ht-sub" style="width:260px">그림 없음</div>')
      +'<div style="flex:1;min-width:0"><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+htPill(c.kind, sel)+(c.idSame?'<span class="ht-pill" style="background:#f1f5f9;color:#334155">원본 번호 같음</span>':'')+(c.rejected?'<span class="ht-sub">✗ 아님으로 표시</span>':'')+'</div>'
      +'<div style="font-size:12.5px;font-weight:800;margin-top:6px">'+htEsc(m.where||c.k)+'</div>'
      +'<div class="ht-sub">'+(c.why?('AI: '+htEsc(c.why)+' · '):'')+'푼 학생 '+solved+'명'+(wrong?(' · 틀림 '+wrong+'명'):'')+((c.also||[]).length?(' · 같은 문제가 다른 자료에도 '+c.also.length+'곳'):'')+'</div>'
      +'<div style="margin-top:8px;max-width:420px">'+htSegRow(it,c)+'</div></div></div>';
  });
  return h;
}

/* ── 보고서 · 블로그 자료 ── */
function htReportRows(d){
  var b=d.basis||'same+var';
  return htVisible(d).map(function(it){ var e=htEff(it), top=e.k?(it.cands||[]).filter(function(c){ return c.k===e.k; })[0]:null, m=top?(d.mats||{})[top.k]:null;
    return { n:htNumOf(d,it), it:it, e:e, inB:htInBasis(e.kind,b), m:m }; });
}
window.htPrint = function(code){
  var d=HT.data[HT.cur]; if(!d) return; var s=htStats(d), e=d.exam||{}, rows=htReportRows(d), b=d.basis||'same+var';
  var w=window.open('', '_blank'); if(!w){ htToast('팝업이 막혔습니다 — 허용해 주세요'); return; }
  var stu=code?htStuRow(d,code):null, st=code?htStuByCode(code):null;
  var css='<style>@page{size:A4 portrait;margin:12mm 11mm}body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#111;margin:0;font-size:11.5px;line-height:1.55}'
    +'h1{font-size:20px;margin:0}h2{font-size:13px;margin:16px 0 6px;padding-bottom:3px;border-bottom:2px solid #111}.red{color:#b91c1c}.mut{color:#555}'
    +'.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #111;padding-bottom:8px}.eb{font-size:10px;letter-spacing:.12em;font-weight:800;color:#b91c1c}'
    +'.nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.nums div{border:1px solid #111;padding:6px 8px}.nums b{font-size:20px;display:block}'
    +'.row{display:grid;grid-template-columns:140px 1fr;gap:14px;align-items:center;margin-top:10px}'
    +'table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{border:1px solid #999;padding:4px 5px;text-align:left;vertical-align:top}th{background:#eee}'
    +'.hit{color:#b91c1c;font-weight:900}.foot{margin-top:14px;font-size:9.5px;color:#555;border-top:1px solid #999;padding-top:6px}</style>';
  var bars=Object.keys(HT_SRC).filter(function(k){ return s.src[k]; }).map(function(k){ return '<div style="display:grid;grid-template-columns:90px 1fr 30px;gap:6px;align-items:center"><span>'+HT_SRC[k]+'</span><div style="height:8px;background:#ddd"><div style="height:100%;width:'+Math.round(s.src[k]/Math.max(1,s.total)*100)+'%;background:#111"></div></div><b>'+s.src[k]+'</b></div>'; }).join('');
  var h='<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>'+htEsc(htExamName(e))+' 시험 분석</title>'+css+'</head><body>'
    +'<div class="top"><div><div class="eb">EXAM ANALYSIS · 루멘수학</div><h1>'+htEsc(e.school+' '+e.grade.replace(/^중/,'중학교 ').replace(/^고/,'고등학교 ')+'학년 · '+e.year+'년 '+e.semester+'학기 '+e.term+'고사')+'</h1></div><div class="mut">'+new Date().toLocaleDateString('ko-KR')+(stu?(' · '+htEsc(st?st.name:'')+' 학생'):'')+'</div></div>'
    +'<div class="nums"><div><b>'+s.total+'</b>총 문항</div><div><b>'+s.levelAvg+'<small>/5</small></b>평균 난도</div><div><b>'+s.killers+'</b>킬러 문항</div><div><b class="red">'+(s.hitSure+s.hitCand)+'</b>적중 문항 ('+HT_BASIS[b].label+')</div></div>'
    +'<div class="row"><div style="text-align:center">'+htDonut(s,130,true)+'</div><div><b>적중 기준 — '+HT_BASIS[b].label+'</b><div class="mut">학원 학생들이 시험 전에 푼 학습지·교재 문항과 시험 문항을 하나씩 대조했습니다. '
    +'같은 문제 '+s.kinds.same+' · 숫자변형 '+s.kinds['var']+' · 유사유형 '+s.kinds.type+'. 소재만 같고 묻는 것이 다른 «지문만 겹침» '+s.text+'문항은 적중으로 세지 않았습니다.'+(s.hitCand?(' (확인 중인 후보 '+s.hitCand+'문항 포함)'):'')+'</div><div style="margin-top:8px">'+bars+'</div></div></div>';
  if(d.trend&&d.trend.trend) h+='<h2>출제 경향</h2><div>'+htEsc(d.trend.trend)+'</div>'+(d.trend.killer?'<h2>킬러 문항</h2><div>'+htEsc(d.trend.killer)+'</div>':'');
  if(stu){
    h+='<h2>'+htEsc(st?st.name:'')+' 학생 — 적중 문항, 시험 전에 풀어 봤나요?</h2><div>적중 '+stu.hit+'문항 중 <b>시험 전 우리 자료에서 맞힌 것 '+stu.O+'문항</b>, 틀렸던 것 <span class="red"><b>'+stu.X+'문항</b></span>'+(stu.xs.length?(' ('+stu.xs.join(', ')+'번)'):'')+', 아직 풀지 않았던 것 '+stu.none+'문항.</div>'
      +(stu.X?'<div class="mut" style="margin-top:4px">틀렸던 문항은 같은 유형으로 다시 복습하도록 지도하겠습니다.</div>':'');
  }
  h+='<h2>문항 요약</h2><table><tr><th>번호</th><th>단원</th><th>유형</th><th>난도</th><th>반복 출제</th><th>적중</th><th>학원 자료</th></tr>';
  rows.forEach(function(r){ var k=HT_KIND[r.e.kind]||HT_KIND.none; h+='<tr><td><b>'+r.n+'</b>'+(r.it.killer?' ☠':'')+'</td><td>'+htEsc(r.it.chapter||'')+'</td><td>'+htEsc(r.it.type||'')+'</td><td>'+(r.it.level||'')+'</td><td>'+((r.it.repeat||[]).length?r.it.repeat.map(function(x){ return x.year; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', '):'')+'</td>'
    +'<td class="'+(r.inB?'hit':'')+'">'+(r.inB?'● ':'')+k.t+(r.e.sure||r.e.kind==='none'?'':' (확인 중)')+'</td><td>'+(r.inB&&r.m?htEsc(r.m.kind==='book'?'교재':(r.m.kind==='upload'?'학원 프린트':'학습지')):'')+'</td></tr>'; });
  h+='</table><div class="foot">적중 = 시험 전 학원에서 푼 문항과 시험 문항이 '+HT_BASIS[b].label.replace('만','')+' 수준으로 겹친 것. 난도는 1~5. 출처는 가장 닮은 원본 문제의 종류(근사치). 시험 문제 원문과 그림은 싣지 않습니다.</div>'
    +'<script>setTimeout(function(){window.print()},400)<\/script></body></html>';
  w.document.open(); w.document.write(h); w.document.close();
};
function htStuRow(d, code){ return htStudentRow(d, code); }

function htMd(d){
  var s=htStats(d), e=d.exam||{}, rows=htReportRows(d), b=d.basis||'same+var', L=[];
  var stuRows=(d.students||[]).map(function(c){ return htStudentRow(d,c); });
  var tot={ hit:0, O:0, X:0 }; stuRows.forEach(function(r){ tot.hit+=r.hit; tot.O+=r.O; tot.X+=r.X; });
  L.push('# 시험 적중 분석 자료 — '+e.school+' '+e.grade+' '+e.year+'년 '+e.semester+'학기 '+e.term+'고사');
  L.push('');
  L.push('> **이 파일을 쓰는 법 (블로그 작성 세션에게)**');
  L.push('> - 이 자료로 루멘수학 블로그 글을 쓴다. 톤은 기존 글(「80점 밑으로 떨어지면, 우리는 압니다」, 「학부모앱, 이렇게 달라졌습니다」)과 같게: 데이터 기반이되 딱딱하지 않게, 소제목 + 짧은 문단 + 굵은 강조.');
  L.push('> - 숫자는 이 파일에 있는 것만 쓴다. 지어내거나 반올림을 바꾸지 않는다.');
  L.push('> - 학생 이름·별명, 시험 문제 원문·그림은 쓰지 않는다(이 파일에도 없다). 다른 학원을 깎아내리지 않는다.');
  L.push('> - 「적중」의 기준을 글에 한 번 밝힌다: '+HT_BASIS[b].label+'. 「지문만 겹침」은 적중이 아니라고 분명히 적는다.');
  L.push('');
  L.push('## 시험 개요');
  L.push('- 학교·학년: '+e.school+' '+e.grade);
  L.push('- 시험: '+e.year+'년 '+e.semester+'학기 '+e.term+'고사'+(e.date?(' ('+e.date+')'):''));
  L.push('- 총 문항: '+s.total+'문항 · 평균 난도 '+s.levelAvg+' / 5 · 킬러(난도 4~5) '+s.killers+'문항 · 서술형 '+s.essay+'문항');
  L.push('- 출처(가장 닮은 원본의 종류, 근사치): '+Object.keys(HT_SRC).filter(function(k){ return s.src[k]; }).map(function(k){ return HT_SRC[k]+' '+s.src[k]; }).join(' · '));
  L.push('- 지난 같은 시험에서 같은 유형이 나온 문항(반복 출제): '+s.repeat+'문항');
  L.push('');
  L.push('## 적중 결과');
  L.push('- 대조한 우리 자료: 이 학교·학년 학생 '+(d.students||[]).length+'명이 '+(d.from||'')+' ~ '+(d.to||'')+' 동안 매쓰플랫에서 푼 학습지·교재 문항'+((d.mats&&Object.keys(d.mats).some(function(k){ return d.mats[k].kind==='upload'; }))?' + 학원 자체 프린트':''));
  L.push('- 원장님이 고른 기준: **'+HT_BASIS[b].label+'**');
  ['same','same+var','type'].forEach(function(k){ var n=rows.filter(function(r){ return htInBasis(r.e.kind,k); }).length; L.push('  - '+HT_BASIS[k].label+': '+n+'문항 / '+s.total+'문항 ('+(s.total?Math.round(n/s.total*100):0)+'%)'+(k===b?'  ← 이 기준으로 발표':'')); });
  L.push('- 등급별: 같은 문제 '+s.kinds.same+' · 숫자변형 '+s.kinds['var']+' · 유사유형 '+s.kinds.type+' · 지문만 겹침(적중 아님) '+s.text+' · 겹침 없음 '+s.kinds.none);
  if(s.open) L.push('- ⚠ 아직 원장님 확인 전인 후보 '+s.open+'문항이 포함되어 있다. 글에는 «확인 중»이라고 쓰거나 확정 문항만 쓴다. 확정 '+s.hitSure+'문항.');
  else L.push('- 모든 문항을 원장님이 직접 확인했다.');
  L.push('');
  L.push('## 적중 문항 목록 ('+HT_BASIS[b].label+')');
  L.push('| 번호 | 단원 | 유형 | 난도 | 등급 | 학원 자료 종류 |');
  L.push('|---|---|---|---|---|---|');
  rows.filter(function(r){ return r.inB; }).forEach(function(r){ L.push('| '+r.n+' | '+(r.it.chapter||'')+' | '+(r.it.type||'')+' | '+(r.it.level||'')+(r.it.killer?' ☠':'')+' | '+(HT_KIND[r.e.kind]||{}).t+(r.e.sure?'':' (확인 중)')+' | '+(r.m?(r.m.kind==='book'?'교재':(r.m.kind==='upload'?'학원 프린트':'학습지')):'')+' |'); });
  L.push('');
  L.push('## 반복 출제 유형');
  var rep=rows.filter(function(r){ return (r.it.repeat||[]).length; });
  if(rep.length) rep.forEach(function(r){ L.push('- '+r.n+'번 '+(r.it.type||r.it.chapter)+' — 지난 기출 '+r.it.repeat.map(function(x){ return x.year; }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(', ')+'년에도'); });
  else L.push('- (지난 기출 자료와 겹친 유형 없음)');
  L.push('');
  if(d.trend&&d.trend.trend){ L.push('## 출제 경향 (요약)'); L.push(d.trend.trend); L.push(''); if(d.trend.killer){ L.push('## 킬러 문항 (요약)'); L.push(d.trend.killer); L.push(''); } }
  L.push('## 학생 집계 (이름 없음)');
  L.push('- 대상 학생 '+stuRows.length+'명. 적중 문항을 시험 전에 우리 자료에서 풀었던 기록: 맞힘 '+tot.O+'건 · 틀림 '+tot.X+'건 (학생×문항 기준, 적중 문항 '+tot.hit+'건 중)');
  L.push('- 틀렸던 적중 문항은 시험 뒤 같은 유형으로 다시 복습시킨다(루멘 복습 방식).');
  L.push('');
  L.push('---');
  L.push('자료 생성: 루멘수학 학원앱 「적중 분석」 · '+new Date().toISOString().slice(0,10));
  return L.join('\n');
}
window.htExportMd = function(){
  var d=HT.data[HT.cur]; if(!d) return; var e=d.exam||{};
  var name='적중분석_'+e.school+'_'+e.grade+'_'+e.year+'_'+e.semester+'학기'+e.term+(/시범/.test(d.examId)?'_시범':'')+'.md';
  var blob=new Blob([htMd(d)], { type:'text/markdown;charset=utf-8' }); var a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  htToast('📝 '+name+' 을 내려받았습니다 — 블로그 세션에 파일로 추가하세요');
};
window.htCopy = function(){
  var d=HT.data[HT.cur]; if(!d) return; var s=htStats(d), e=d.exam||{}, b=d.basis||'same+var';
  var t=htExamName(e)+' — 총 '+s.total+'문항 · 평균 난도 '+s.levelAvg+'/5 · 킬러 '+s.killers+'\n적중('+HT_BASIS[b].label+') '+(s.hitSure+s.hitCand)+'문항 ('+s.pctAll+'%) · 같은 문제 '+s.kinds.same+' · 숫자변형 '+s.kinds['var']+' · 지문만 겹침 '+s.text+'(적중 아님)'+(s.open?('\n확인 중 '+s.open+'문항'):'');
  try{ navigator.clipboard.writeText(t).then(function(){ htToast('📋 복사했습니다'); }); }catch(e){ prompt('복사하세요', t); }
};

/* ═══ v19-76: 📑 분석지 보기 — 수학비서 「내 분석지」처럼 기준문제(시험 원본)를 왼쪽에, 그 옆에 일치하는 우리 자료를 카드로
 * 원장 지시 2026-10-05 「적중분석에서 왼쪽에는 원본이 보여야 한다. 수학비서가 분석지에서 유사문제를 숫자변형·유사유형을
 *   그 기출문제마다 어떤 것과 일치하는지 하나씩 보여주는 보기 방식으로 표현하자」 */
HT.view = (function(){ try{ return localStorage.getItem('ht_view2')||'sheet'; }catch(e){ return 'sheet'; } })();   /* v19-78: 기억 키를 바꿔 모두 분석지로 다시 시작 */
HT.show = { same:true, 'var':true, type:true, text:true };
HT.size = (function(){ try{ return localStorage.getItem('ht_size')||'m'; }catch(e){ return 'm'; } })();
HT.onlyOpen = false;
window.htView = function(v){ HT.view=v; try{ localStorage.setItem('ht_view2', v); }catch(e){} render(); };
window.htShowKind = function(k){ HT.show[k]=!HT.show[k]; render(); };
window.htSize = function(v){ HT.size=v; try{ localStorage.setItem('ht_size', v); }catch(e){} render(); };
window.htOnlyOpen = function(){ HT.onlyOpen=!HT.onlyOpen; render(); };
function htItemsView(d){ return HT.view==='table' ? htItemsHtml(d) : htSheetHtml(d); }
function htSwitch(on, label, onclick, color){
  return '<button onclick="'+onclick+'" style="display:inline-flex;align-items:center;gap:7px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:12.5px;font-weight:800;color:#334155;padding:2px 0">'+label
    +'<span style="position:relative;width:38px;height:22px;border-radius:999px;background:'+(on?(color||'#0d2240'):'#cbd5e1')+';transition:background .15s"><span style="position:absolute;top:3px;'+(on?'left:19px':'left:3px')+';width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s"></span></span></button>';
}
function htSheetHtml(d){
  if(!HT.unfold) HT.unfold={};
  var W={ s:220, m:300, l:420 }[HT.size]||300, b=d.basis||'same+var';
  var vis=htVisible(d), nCard=0, done=0;
  vis.forEach(function(it){ if(htEff(it).sure) done++; (it.cands||[]).forEach(function(c){ if(HT.show[c.kind]) nCard++; }); });
  var ag=htAgree(d);
  var h='<div class="ht-card"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:6px">'
    +'<div class="ht-h" style="margin:0;flex:1;min-width:200px">📑 분석지 — 기준문제 '+vis.length+'개 · 일치 자료 '+nCard+'개</div>'
    +htViewChips()+'</div>'
    /* 확정 진행 */
    +'<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:4px 0 8px"><b style="font-size:12.5px;color:#0d2240;font-variant-numeric:tabular-nums">확정 '+done+' / '+vis.length+'</b>'
    +'<div class="ht-bar" style="flex:1;min-width:120px;max-width:360px"><i style="width:'+(vis.length?Math.round(done/vis.length*100):0)+'%;background:#15803d"></i></div>'
    +(done<vis.length?'<button class="ht-btn pri" style="padding:5px 10px" onclick="htNextOpen()">▶ 다음 확인할 문항</button>':'<span class="ht-sub" style="color:#15803d;font-weight:800">✓ 모두 확정</span>')
    +(ag.n?'<span class="ht-sub" title="원장님이 확정한 등급이 AI 판정과 같았던 비율">🤖 AI 판정과 같음 <b>'+ag.same+'/'+ag.n+'</b></span>':'')+'</div>'
    +'<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:8px 0 4px;border-top:1px solid #f1f5f9">'
    +htSwitch(HT.show.same,'같은 문제','htShowKind(\'same\')','#b91c1c')
    +htSwitch(HT.show['var'],'숫자변형','htShowKind(\'var\')','#c2410c')
    +htSwitch(HT.show.type,'유사유형','htShowKind(\'type\')','#1d4ed8')
    +htSwitch(HT.show.text,'지문만 겹침','htShowKind(\'text\')','#475569')
    +htSwitch(HT.onlyOpen,'확정 안 한 문항만','htOnlyOpen()','#0d2240')
    +'<span style="margin-left:auto;display:flex;gap:4px;align-items:center" class="ht-sub">카드 크기 '+['s','m','l'].map(function(z){ return '<button class="ht-chip'+(HT.size===z?' on':'')+'" style="padding:3px 9px" onclick="htSize(\''+z+'\')">'+({s:'작게',m:'보통',l:'크게'})[z]+'</button>'; }).join('')+'</span></div></div>';
  h+=htMatsRankHtml(d);
  vis.forEach(function(it){
    var e=htEff(it); if(HT.onlyOpen && e.sure) return;
    var n=htNumOf(d,it);
    if(e.sure && !HT.unfold[it.no]){ h+=htFoldedRow(d,it,n,e); return; }
    h+=htItemSheet(d,it,n,e,W,b);
  });
  return h;
}
/* 확정한 문항 — 한 줄로 접힘 */
function htFoldedRow(d, it, n, e){
  var top=e.k?(it.cands||[]).filter(function(c){ return c.k===e.k; })[0]:null, m=top?(d.mats||{})[top.k]:null, src=htItemImg(it), mi=htMatImg(m);
  return '<div id="ht-q-'+it.no+'" class="ht-card" onclick="htUnfold('+it.no+')" title="눌러서 펼치기" style="padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;cursor:pointer;background:#fbfdfb;border-color:#d1fae5">'
    +'<b style="font-size:14px;color:#0d2240;min-width:24px;font-variant-numeric:tabular-nums">'+(n<10?'0':'')+n+'</b>'
    +(src?'<img src="'+htEsc(src)+'" alt="" style="height:44px;max-width:120px;object-fit:contain;object-position:left top;border:1px solid #e2e8f0;border-radius:6px;background:#fff">':'')
    +(mi?'<span style="color:#94a3b8">→</span><img src="'+htEsc(mi)+'" alt="" style="height:44px;max-width:120px;object-fit:contain;object-position:left top;border:1px solid #e2e8f0;border-radius:6px;background:#fff">':'')
    +'<span class="ht-sub" style="flex:1;min-width:160px"><b style="color:#0f172a">'+htEsc(it.chapter||'')+'</b> › '+htEsc(it.type||'')+(m?('<br>📚 '+htEsc(m.where||'')):'')+'</span>'
    +htPill(e.kind, true)+'<span class="ht-sub" style="font-size:11px">▼ 펼치기</span></div>';
}
window.htUnfold = function(no){ if(!HT.unfold) HT.unfold={}; HT.unfold[no]=!HT.unfold[no]; render(); };
window.htNextOpen = function(){
  var d=HT.data[HT.cur]; if(!d) return; var it=htVisible(d).filter(function(x){ return !htEff(x).sure; })[0]; if(!it) return;
  setTimeout(function(){ var el=document.getElementById('ht-q-'+it.no); if(el) el.scrollIntoView({ behavior:'smooth', block:'start' }); }, 30);
};
/* AI 판정과 원장님 확정이 같았나 */
function htAgree(d){
  var n=0, same=0;
  htVisible(d).forEach(function(it){
    if(!it.hit || it.hit.ok==null) return;
    var c0=(it.cands||[])[0]; var aiTop=c0?(c0.ai||c0.kind):'none';
    var aiHit=(aiTop==='same'||aiTop==='var') ? aiTop : 'none';
    var mine=it.hit.ok?it.hit.kind:'none'; var mineHit=(mine==='same'||mine==='var') ? mine : 'none';
    n++; if(aiHit===mineHit) same++;
  });
  return { n:n, same:same };
}
/* 어떤 자료가 맞혔나 — 기준 안 적중(확정 + 후보)을 자료 이름으로 묶는다 */
function htMatsRankHtml(d){
  var b=d.basis||'same+var', by={};
  htVisible(d).forEach(function(it){
    var e=htEff(it); if(!htInBasis(e.kind,b) || !e.k) return;
    var c=(it.cands||[]).filter(function(x){ return x.k===e.k; })[0]; var keys=[e.k].concat(c&&c.also||[]), seen={};
    keys.forEach(function(k){ var m=(d.mats||{})[k]; if(!m) return; var t=m.title||'(이름 없음)'; if(seen[t]) return; seen[t]=1;
      var x=by[t]=by[t]||{ t:t, kind:m.kind, n:0, sure:0, nos:[] }; x.n++; if(e.sure) x.sure++; x.nos.push(htNumOf(d,it)); });
  });
  var arr=Object.keys(by).map(function(k){ return by[k]; }).sort(function(a,b){ return b.n-a.n || b.sure-a.sure; });
  if(!arr.length) return '';
  var max=arr[0].n;
  var h='<div class="ht-card"><div class="ht-h">📚 어떤 자료가 맞혔나 <span class="ht-sub" style="font-weight:700">— '+HT_BASIS[b].label+' 기준 · 한 문항이 여러 자료에 있으면 각각 셈</span></div><div style="display:grid;gap:5px">';
  arr.slice(0,10).forEach(function(x){
    h+='<div style="display:grid;grid-template-columns:minmax(0,1fr) 140px 54px;gap:10px;align-items:center" class="ht-sub">'
      +'<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:#0f172a">'+htEsc(x.t)+'</b> <span style="font-size:10.5px">'+(x.kind==='book'?'교재':(x.kind==='upload'?'프린트':'학습지'))+' · '+x.nos.join(', ')+'번</span></span>'
      +'<div class="ht-bar"><i style="width:'+Math.round(x.n/max*100)+'%;background:#b91c1c"></i></div><b style="text-align:right;font-variant-numeric:tabular-nums;color:#0f172a">'+x.n+(x.sure?('<small style="color:#15803d;font-weight:800"> ✓'+x.sure+'</small>'):'')+'</b></div>';
  });
  if(arr.length>10) h+='<div class="ht-sub" style="font-size:11px">… 그 밖에 '+(arr.length-10)+'개 자료</div>';
  return h+'</div></div>';
}
/* 문항 한 덩어리 (펼친 상태) */
function htItemSheet(d, it, n, e, W, b){
  var inB=htInBasis(e.kind,b);
  var h='<div id="ht-q-'+it.no+'" class="ht-card" style="padding:12px 14px">';
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'
    +'<b style="font-size:16px;color:#0d2240;font-variant-numeric:tabular-nums">'+(n<10?'0':'')+n+'</b>'
    +'<span class="ht-sub" style="font-weight:800;color:#334155">'+(it.essay?'서술형':'객관식·단답')+'</span>'
    +'<span class="ht-sub"><b style="color:#0f172a">'+htEsc(it.chapter||'')+'</b> › '+htEsc(it.type||'(유형 미확인)')+'</span>'
    +'<span class="ht-pill" style="background:#f1f5f9;color:#334155">난도 '+(it.level||'-')+(it.killer?' ☠':'')+'</span>'
    +((it.repeat||[]).length?'<span class="ht-pill" style="background:#fef3c7;color:#92400e">반복 '+it.repeat.map(function(r){ return r.year+' '+r.no+'번'; }).join(' · ')+'</span>':'')
    +'<span style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+htPill(e.kind,e.sure)+(inB?'':'<span class="ht-sub" style="font-size:10.5px">기준 밖</span>')
    +(e.sure?'<button class="ht-btn no" style="padding:5px 9px" onclick="htUnfold('+it.no+')">▲ 접기</button>':'')
    +'<button class="ht-btn no" style="padding:5px 9px" onclick="htConfirm('+it.no+',null,false)">✗ 적중 없음</button>'
    +(it.hit?'<button class="ht-btn no" style="padding:5px 9px" onclick="htConfirm('+it.no+',null,null)">↺ 확정 풀기</button>':'')
    +(n>1?'<button class="ht-btn no" style="padding:5px 9px" title="AI 가 한 문항을 둘로 잘랐을 때" onclick="htMerge('+it.no+')">⤴ 앞 문항과 합치기</button>':'')
    +(it.extra&&it.extra.length?'<button class="ht-btn no" style="padding:5px 9px" onclick="htUnmerge('+it.no+')">⤵ 합친 것 풀기</button>':'')
    +'</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax('+W+'px,1fr));gap:12px;align-items:start">';
  var src=htItemImg(it);
  h+='<div style="border:2px solid #1d4ed8;border-radius:14px;background:#fff;overflow:hidden">'
    +'<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #e2e8f0"><b style="font-size:12.5px;color:#0d2240">'+(n<10?'0':'')+n+' 시험 원본</b><span style="margin-left:auto;font-size:10.5px;font-weight:900;color:#fff;background:#0f172a;padding:3px 8px;border-radius:6px">기준문제</span></div>'
    +'<div style="padding:8px;background:#fff">'+(src?'<img src="'+htEsc(src)+'" alt="'+n+'번 시험 문항" onclick="htZoom(this.src)" style="width:100%;display:block;cursor:zoom-in">':'<div class="ht-sub" style="padding:30px 0;text-align:center">그림을 불러오지 못했습니다</div>');
  (it.extra||[]).forEach(function(x){ var m=htItem(x), u=m?htItemImg(m):''; if(u) h+='<img src="'+htEsc(u)+'" alt="합친 상자" onclick="htZoom(this.src)" style="width:100%;display:block;margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:6px;cursor:zoom-in">'; });
  h+='</div><div class="ht-sub" style="padding:8px 10px;border-top:1px solid #f1f5f9;font-size:11.5px">'+(it.ask?('<b style="color:#0f172a">묻는 것</b> '+htEsc(it.ask)+'<br>'):'')+'<b style="color:#0f172a">닮은 원본</b> '+(HT_SRC[it.source]||'—')+'</div></div>';
  var shown=(it.cands||[]).filter(function(c){ return HT.show[c.kind] || (it.hit&&it.hit.k===c.k); });
  if(!shown.length) h+='<div style="border:1.5px dashed #cbd5e1;border-radius:14px;padding:30px 14px;text-align:center" class="ht-sub">'+((it.cands||[]).length?'켜 둔 종류의 일치 자료가 없습니다':'학생들이 푼 우리 자료에서<br>같은 유형을 찾지 못했습니다')+'</div>';
  shown.forEach(function(c){ h+=htCandCard(d,it,c); });
  return h+'</div></div>';
}
/* 우리 자료 카드 — 등급 단추를 누르면 그 등급으로 바로 확정 */
function htCandCard(d, it, c){
  var m=(d.mats||{})[c.k]||{}, img=htMatImg(m), sel=it.hit&&it.hit.ok&&it.hit.k===c.k, cur=sel&&it.hit.kind?it.hit.kind:c.kind, K=HT_KIND[cur]||HT_KIND.none, ai=c.ai||c.kind;
  var solved=Object.keys(m.res||{}).length, wrong=Object.keys(m.res||{}).filter(function(x){ return m.res[x]!=='O'; }).length;
  return '<div style="border:'+(sel?'2px solid '+K.c:'1px solid #e2e8f0')+';border-radius:14px;background:#fff;overflow:hidden'+(c.rejected?';opacity:.5':'')+'">'
    +'<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #e2e8f0"><b style="font-size:12px;color:#334155">'+htEsc(m.kind==='book'?'교재':(m.kind==='upload'?'우리 프린트':'학습지'))+'</b>'
    +(c.idSame?'<span title="매쓰플랫이 찾은 원본 번호가 같음" style="font-size:10px;font-weight:800;color:#334155;background:#f1f5f9;padding:2px 6px;border-radius:6px">원본 번호 같음</span>':'')
    +'<span style="margin-left:auto;font-size:10.5px;font-weight:900;color:'+K.c+';background:'+K.bg+';padding:3px 8px;border-radius:6px;white-space:nowrap">'+K.t+(sel?' ✓':'')+'</span></div>'
    +'<div style="padding:8px">'+(img?'<img src="'+htEsc(img)+'" alt="우리 자료 문항" onclick="htZoom(this.src)" style="width:100%;display:block;cursor:zoom-in">':'<div class="ht-sub" style="padding:30px 0;text-align:center">그림 없음</div>')+'</div>'
    +'<div style="padding:8px 10px;border-top:1px solid #f1f5f9;font-size:11.5px;line-height:1.55" class="ht-sub">'
    +'<b style="color:#0f172a">자료</b> '+htEsc(m.where||c.k)+'<br>'
    +((c.why||(c.ai&&c.ai!==cur))?('<b style="color:#0f172a">AI</b> '+htEsc(c.why||'')+(c.ai&&c.ai!==cur?(' <span style="color:#94a3b8">(AI는 '+(HT_KIND[c.ai]||{}).t+')</span>'):'')+'<br>'):'')
    +'<b style="color:#0f172a">학생</b> 푼 '+solved+'명'+(wrong?(' · <span style="color:#b91c1c;font-weight:800">틀림 '+wrong+'명</span>'):'')+((c.also||[]).length?(' · 같은 문제 다른 자료 '+c.also.length+'곳'):'')+'</div>'
    +'<div style="padding:0 10px 10px">'+htSegRow(it,c)+'</div></div>';
}

/* v19-78: 등급 단추 — 분석지 카드와 표 보기가 같은 단추를 쓴다 (누르면 그 등급으로 바로 확정) */
function htSegRow(it, c){
  var sel=it.hit&&it.hit.ok&&it.hit.k===c.k, cur=sel&&it.hit.kind?it.hit.kind:c.kind, ai=c.ai||c.kind;
  var seg=function(kind, label){ var on=sel&&cur===kind, k=HT_KIND[kind];
    return '<button onclick="htSetKind('+it.no+',\''+c.k+'\',\''+kind+'\')" title="이 자료를 「'+label+'」로 확정" style="flex:1;min-width:0;padding:6px 4px;font-size:11.5px;font-weight:900;font-family:inherit;cursor:pointer;border:1.5px '+(ai===kind&&!on?'dashed':'solid')+' '+(on||ai===kind?k.c:'#e2e8f0')+';background:'+(on?k.c:'#fff')+';color:'+(on?'#fff':k.c)+';border-radius:8px">'+(on?'✓ ':'')+label+(ai===kind&&!sel?' <small style="font-weight:700;opacity:.8">AI</small>':'')+'</button>'; };
  return '<div style="display:flex;gap:4px;margin-bottom:4px">'+seg('same','같은 문제')+seg('var','숫자변형')+seg('type','유사유형')+'</div>'
    +'<div style="display:flex;gap:4px">'+seg('text','지문만')+'<button onclick="htConfirm('+it.no+',\''+c.k+'\',false)" style="flex:1;padding:6px 4px;font-size:11.5px;font-weight:800;font-family:inherit;cursor:pointer;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:8px">✗ 아님</button></div>';
}
function htViewChips(){ return '<div style="display:flex;gap:4px">'+['sheet','table'].map(function(v){ var on=HT.view===v; return '<button class="ht-chip'+(on?' on':'')+'" onclick="htView(\''+v+'\')">'+(v==='sheet'?'📑 분석지':'📋 표')+'</button>'; }).join('')+'</div>'; }

/* v19-78: 세 기준 적중률을 늘 같이 보여 준다 (원장 질문 「적중 없음이 1개인데 왜 40%?」 — 기준이 「같은 문제 + 숫자변형」이라 유사유형은 안 셌다) */
function htThreeRates(d){
  var v=htVisible(d), n=v.length||1, b=d.basis||'same+var';
  return '<div style="margin-top:6px;display:grid;gap:2px;text-align:left;font-size:11px">'+Object.keys(HT_BASIS).map(function(k){
    var c=v.filter(function(it){ return htInBasis(htEff(it).kind,k); }).length, on=k===b;
    return '<div style="display:flex;justify-content:space-between;gap:8px;'+(on?'font-weight:900;color:#b91c1c':'color:#64748b;font-weight:700')+'"><span>'+(on?'▶ ':'')+HT_BASIS[k].label+'</span><span style="font-variant-numeric:tabular-nums">'+c+'/'+v.length+' · '+Math.round(c/n*100)+'%</span></div>';
  }).join('')+'</div>';
}

/* ═══ v19-79: ✏️ 출제 경향 · 킬러 문항 — 원장님이 고친다 (원장 지시 2026-10-05) ═══
 * d.trend = { trend, killer, edited:true, by:'teacher', at, ai:{trend,killer} }  — ai 는 처음 AI 가 쓴 글(되돌리기용).
 * 워커가 다시 판정해도 edited 글은 그대로 둔다. 보고서·블로그 자료(.md)·요약은 고친 글을 쓴다. */
function htTrendHtml(d){
  var t=d.trend||{}, ed=!!HT.trendEdit;
  var box='margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:10px';
  if(ed){
    var ta='width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.7;font-family:inherit;resize:vertical';
    return '<div style="'+box+';border:1.5px solid #1d6fe8">'
      +'<div class="ht-h" style="margin:0 0 4px">출제 경향</div><textarea id="ht-trend" rows="5" style="'+ta+'">'+htEsc(t.trend||'')+'</textarea>'
      +'<div class="ht-h" style="margin:8px 0 4px">킬러 문항</div><textarea id="ht-killer" rows="4" style="'+ta+'">'+htEsc(t.killer||'')+'</textarea>'
      +'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center"><button class="ht-btn pri" onclick="htTrendSave()">💾 저장</button><button class="ht-btn" onclick="HT.trendEdit=false;render()">취소</button>'
      +((t.ai&&t.edited)?'<button class="ht-btn no" onclick="htTrendRevert()">↺ AI 처음 글로 되돌리기</button>':'')
      +'<span class="ht-sub">학부모 보고서 · 블로그 자료(.md) · 요약에 이 글이 들어갑니다. 다시 판정해도 고친 글은 남습니다.</span></div></div>';
  }
  if(!t.trend && !t.killer) return '<div style="'+box+'" class="ht-sub">출제 경향 글이 아직 없습니다. <button class="ht-btn" style="padding:4px 9px" onclick="HT.trendEdit=true;render()">✏️ 직접 쓰기</button></div>';
  return '<div style="'+box+'"><div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><div class="ht-h" style="margin:0;flex:1">출제 경향 '+(t.edited?'<span class="ht-pill" style="background:#dcfce7;color:#15803d">원장님이 고친 글</span>':'<span class="ht-pill" style="background:#f1f5f9;color:#64748b">AI 초안</span>')+'</div>'
    +'<button class="ht-btn" style="padding:4px 10px" onclick="HT.trendEdit=true;render()">✏️ 고치기</button></div>'
    +'<div style="font-size:12.5px;line-height:1.7;white-space:pre-wrap">'+htEsc(t.trend||'')+'</div>'
    +(t.killer?'<div class="ht-h" style="margin:8px 0 4px">킬러 문항</div><div style="font-size:12.5px;line-height:1.7;white-space:pre-wrap">'+htEsc(t.killer)+'</div>':'')
    +htTrendWarn(d)+'</div>';
}
/* v19-83: 출제 경향 글의 숫자가 확정된 문항(합치기·서술형·난이도)과 다르면 알림 — 학부모 보고서·블로그에 그대로 나가지 않게 */
function htTrendWarn(d){
  if(typeof cnTrendIssues!=='function') return ''; var iss=[]; try{ iss=cnTrendIssues(d); }catch(e){}
  if(!iss.length) return '';
  return '<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;font-size:12px;color:#92400e;font-weight:700">⚠ 이 글의 숫자가 지금 문항과 다릅니다 — '+iss.map(htEsc).join(' · ')
    +' <span style="font-weight:600">(AI 초안은 문항을 합치기 전에 쓴 글입니다)</span> <button class="ht-btn" style="padding:3px 9px;margin-left:4px" onclick="htTrendFromCards()">카드 숫자로 글 바꾸기</button></div>';
}
window.htTrendSave = function(){
  var d=HT.data[HT.cur]; if(!d) return;
  var tr=(document.getElementById('ht-trend')||{}).value||'', kl=(document.getElementById('ht-killer')||{}).value||'';
  var old=d.trend||{}, ai=old.ai||(old.edited?null:{ trend:old.trend||'', killer:old.killer||'' });
  d.trend={ trend:String(tr).trim(), killer:String(kl).trim(), edited:true, by:'teacher', at:new Date().toISOString(), ai:ai };
  HT.trendEdit=false; htSave(d); htToast('✏️ 출제 경향을 저장했습니다'); render();
};
window.htTrendRevert = function(){
  var d=HT.data[HT.cur]; if(!d||!d.trend||!d.trend.ai) return;
  d.trend={ trend:d.trend.ai.trend||'', killer:d.trend.ai.killer||'' };
  HT.trendEdit=false; htSave(d); render();
};
