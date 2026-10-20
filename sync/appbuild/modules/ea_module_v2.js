
/* ═══════════════════════════════════════════════════════════════════
 * v19-35·36: 📚 기출 분석 + 🎯 시험 대비 — 기준을 «수학비서 기출 DB»로 (docs/exam_prep_contract.md §8)
 * 원장 결정 2026-09-23: 「단원·유형 기준은 수학비서. 이미지 넣어도 된다. 매쓰플랫 접속은 새벽에만. 옥길중부터」
 *
 *  자료 세 겹
 *   기출  = lumen_store ms_exams_<학교>  (sync/exam_db_collector.js — 수학비서 문항 메타 + Storage exam_images)
 *           chapters = [학기, 대단원, 중단원, 세부유형, 소유형] · score · difficulty(1~9 · 실제 옥길중 자료는 2~6) · answerType · scopes
 *   학생  = 유형 성취도(매쓰플랫 유형 cid) — 그대로
 *   다리  = lumen_store ms_exam_bridge (매쓰플랫이 같은 기출을 원본 학습지로 인식한 결과 — 문항별 conceptId·그림)
 *  해설집(HS)은 풀이 인쇄에 우선 쓰고, 수학비서 자료가 없는 학교에서는 예전처럼 해설집만으로 돈다.
 *
 *  v19-33·34 의 「해설집 단원 이름 맞추기 · 단원 설정 화면」은 없앴다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 기존 함수는 읽기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var EA = { prev:'', cfg:{ ranges:{} }, cfgLoaded:false, kicked:false, ms:{}, bridge:{}, msLoaded:false,
  school:'', grade:'', term:'', openUnit:'', busy:'', err:'', bodies:{}, recs:{}, signed:{},
  stu:'', cls:'', all:false, n:10, last:null, saving:false, tbMap:null, tb:{} };
var LC = { last:null };   /* v19-32 호환 */

function eaEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function eaPainting(){ return VIEW==='examanal' || VIEW==='lastcheck'; }
function eaActive(){ try{ return getSortedStudents().filter(function(s){ return s && s.lumen_rec_code; }); }catch(e){ return []; } }
function eaStuByCode(c){ var a=eaActive(); for(var i=0;i<a.length;i++){ if(String(a[i].lumen_rec_code)===String(c)) return a[i]; } return null; }
/* 「옥길중학교」「옥길중」「범박고등학교」「범박고」 → 같은 학교로 */
function eaSchoolKey(s){ return String(s||'').replace(/\s/g,'').replace(/등학교$|학교$/,'').replace(/고등$/,'고'); }
/* v19-40: 배점 — 고교 시험은 4.3점처럼 소수 배점이라 수학비서 입력에 「4.5 → 45」 같은 오타가 있다(소사고 2023 고2 2학기 중간 4문항).
 * 한 문항이 15점을 넘을 수는 없으니 15 초과는 10으로 나눈다. 표시는 소수 첫째 자리까지 */
function eaPtFix(v){ var x=Number(v)||0; if(x>15) x=x/10; return Math.round(x*10)/10; }
function eaPt(x){ return String(Math.round((Number(x)||0)*10)/10); }
function eaClean(s){ return String(s||'').replace(/^\d+\s*/,'').trim(); }

/* ── 낱말 견주기 ── */
function eaGrams(s){
  var t=String(s||'').replace(/\\\([\s\S]*?\\\)/g,' ').replace(/[()（）·,，、/\\\[\]{}<>+\-=×÷^_"'’“”?!~]/g,' ')
    .replace(/(의|를|을|이|가|와|과|에서|에|는|은)\s/g,' ').replace(/\s+/g,'');
  var g={}, n=0, i; for(i=0;i+1<t.length;i++){ var k=t.slice(i,i+2); if(!g[k]){ g[k]=1; n++; } }
  return { m:g, n:n };
}
function eaDice(a,b){ if(!a.n||!b.n) return 0; var c=0,k; for(k in a.m){ if(b.m[k]) c++; } return (2*c)/(a.n+b.n); }
function eaGradeOf(st){
  var g=String((st&&st.grade)||''); var lv=/고등|고\s*\d/.test(g)?'고':(/초등|초\s*\d/.test(g)?'초':'중');
  var n=(g.match(/(\d)/)||[])[1]||''; return n?(lv+n):'';
}
function eaNormGrade(g){ var m=String(g||'').match(/(초|중|고)\s*(\d)/); return m?(m[1]+m[2]):String(g||'').trim(); }

/* ── 불러오기 ── */
function eaKick(){
  if(EA.kicked) return; EA.kicked=true;
  setTimeout(function(){
    try{ if(typeof hsLoad==='function' && (!HS||!HS.loaded)) hsLoad().then(function(){ if(eaPainting()) render(); }); }catch(e){}
    try{ if(typeof tqLoad==='function') tqLoad().then(function(){ if(eaPainting()) render(); }); }catch(e){}
    try{ if(typeof mtdLoad==='function'){ var p=mtdLoad(); if(p&&p.then) p.then(function(){ if(eaPainting()) render(); }); } }catch(e){}
    eaMsLoad(); eaCfgLoad();
  },0);
}
/* 수학비서 기출 + 매쓰플랫 다리 */
function eaMsLoad(force){
  if(EA.msLoaded && !force) return Promise.resolve();
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb){ EA.msLoaded=true; return Promise.resolve(); }
  return sb.from('lumen_store').select('key,value').or('key.like.ms_exams_%,key.eq.ms_exam_bridge,key.eq.mf_sol_fix').then(function(r){
    (r&&r.data||[]).forEach(function(row){
      var v=row.value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } if(!v) return;
      if(row.key==='ms_exam_bridge') EA.bridge=(v.byMydb)||{};
      if(row.key==='mf_sol_fix') EA.solfix=v||{};   /* v19-60: 수식이 망가진 매쓰플랫 풀이 그림 → 다시 쓴 풀이(fix) · 아직 못 쓴 것(bad) */
      else EA.ms[row.key.replace('ms_exams_','')]=v;
    });
    EA.msLoaded=true; if(eaPainting()) render();
  }).catch(function(e){ EA.msLoaded=true; EA.err='기출 DB를 읽지 못했습니다: '+((e&&e.message)||e); if(eaPainting()) render(); });
}
function eaCfgLoad(force){
  if(EA.cfgLoaded && !force) return Promise.resolve();
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb){ EA.cfgLoaded=true; return Promise.resolve(); }
  return sb.from('lumen_store').select('value').eq('key','exam_prep_cfg').then(function(r){
    var v=(r&&r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    EA.cfg={ ranges:(v&&v.ranges)||{} }; EA.cfgLoaded=true; if(eaPainting()) render();
  }).catch(function(){ EA.cfgLoaded=true; });
}
function eaCfgSave(){
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb){ plToast('오프라인 — 저장 못 함'); return Promise.resolve(false); }
  var now=new Date().toISOString(); EA.saving=true; render();
  return sb.from('lumen_store').upsert({ key:'exam_prep_cfg', value:{ ranges:EA.cfg.ranges, upd:now }, updated_at:now },{ onConflict:'key' })
    .then(function(r){ EA.saving=false; if(r&&r.error){ plToast('저장 실패: '+r.error.message); render(); return false; } plToast('시험 범위를 저장했습니다'); render(); return true; })
    .catch(function(){ EA.saving=false; plToast('저장 실패'); render(); return false; });
}

/* ═══ 기출 시험지 — 한 모양으로 ═══════════════════════════════
 * { src:'ms'|'hs', id, school(키), schoolName, grade:'중1', year:'2025', term:'2학기 중간', title,
 *   scopes, total, noPt, qs:[{ no, unit, mid, type, sub, tags, pt, diff(1~9), essay, short, answer, img, hsCode }] } */
function eaBooksMs(){
  var out=[];
  Object.keys(EA.ms).forEach(function(sk){
    var v=EA.ms[sk]; (v&&v.exams||[]).forEach(function(e){
      if(!e.grade||!e.semester||!e.term) return;
      var qs=(e.cells||[]).map(function(c){
        var ch=c.chapters||[];
        return { no:Number(c.no)||0, unit:eaClean(ch[1])||'기타', mid:eaClean(ch[2]), type:eaClean(ch[3])||eaClean(ch[2])||'', sub:eaClean(ch[4]),
          tags:c.tags||[], pt:eaPtFix(c.score), diff:Number(c.difficulty)||0,
          essay:c.answerType==='long_answer', short:/short|integer|latex/.test(String(c.answerType||'')),
          answer:c.answer||'', img:c.img||null, imgUrl:c.imgUrl||null, sem:eaClean(ch[0]) };
      }).filter(function(q){ return q.no; }).sort(function(a,b){ return a.no-b.no; });
      var tot=0; qs.forEach(function(q){ tot+=q.pt; }); tot=Math.round(tot*10)/10;
      /* 출처 경로: 수집기가 sourcePath 를 넣어 두면 그것, 아니면 수학비서 제목(「내신 2025년 경기 부천시 옥길중 중1 2학기 중간 중등수학1하」) */
      var sp=String(e.sourcePath||e.title||''); var full=(sp.match(/([가-힣]+(?:중학교|고등학교|초등학교))/)||[])[1]||'';
      out.push({ src:'ms', id:String(e.id), school:eaSchoolKey(v.school||sk), schoolName:full||String(v.school||sk), grade:eaNormGrade(e.grade),
        year:String(e.year||'?'), term:e.semester+'학기 '+e.term, title:e.title||'', scopes:e.scopes||null, total:tot, noPt:tot===0, qs:qs,
        srcPath:sp.replace(/\s*>\s*/g,' › ').replace(/^내신\s+/,''), srcName:'루멘수학 기출 자료' });
    });
  });
  return out;
}
/* 해설집(HS)만 있는 학교를 위한 예비 — v19-33 방식 */
function eaBooksHs(){
  var out=[], items=(HS&&HS.cat&&HS.cat.items)||[];
  items.forEach(function(it){
    var termStr=String(it.term||''); var tm=termStr.match(/([12])\s*학기\s*(중간|기말)/); if(!tm) return;
    /* v19-49: 소책자·대비 묶음(예상 문제)은 기출이 아니다 — 코드 _pack, 제목·학기에 「대비·점검·예상」이 있으면 뺀다 (원장 지적 2026-09-27: 「2026 2학기 중간」 열이 생겼다) */
    if(it.pack||/_pack$/.test(String(it.code||''))||/대비|점검|예상/.test(termStr+' '+String(it.title||''))) return;
    var year=(termStr.match(/(20\d{2})/)||[])[1]||((String(it.code).match(/_(20\d{2})_/)||[])[1]||'?');
    /* 아직 오지 않은 연도의 시험도 뺀다 */
    if(/^20\d{2}$/.test(year)&&Number(year)>new Date().getFullYear()) return;
    var qs=(it.qs||[]).map(function(q){
      var kind=String(q.kind||''), badge=String(q.badge||''); var parts=kind.split('·');
      return { no:Number(q.no)||0, unit:String(parts[0]||'').replace(/^서술형\s*/,'').trim()||'기타', mid:'', type:parts.slice(1).join('·').trim(), sub:'', tags:[],
        pt:Number((badge.match(/(\d+(?:\.\d+)?)\s*점/)||[])[1]||0), diff:Number((badge.match(/난이도\s*(\d)/)||[])[1]||0),
        essay:/서술/.test(kind)||/서술/.test(badge), short:false, answer:String(q.ans||''), img:null, hsCode:it.code, title:String(q.title||'') };
    }).filter(function(q){ return q.no; });
    var tot=0; qs.forEach(function(q){ tot+=q.pt; }); tot=Math.round(tot*10)/10;
    out.push({ src:'hs', id:'hs:'+it.code, hsCode:it.code, school:eaSchoolKey(it.school), schoolName:String(it.school||''), grade:eaNormGrade(it.grade),
      year:year, term:tm[1]+'학기 '+tm[2], title:it.title||it.code, scopes:null, total:tot, noPt:tot===0, qs:qs, srcPath:'', srcName:'루멘 기출 해설집' });
  });
  return out;
}
/* 같은 학교·학년·학기·연도에 수학비서 자료가 있으면 해설집은 «풀이용»으로만 쓴다 */
function eaBooks(){
  var ms=eaBooksMs(), hs=eaBooksHs(), key=function(b){ return b.school+'|'+b.grade+'|'+b.term+'|'+b.year; };
  var have={}; ms.forEach(function(b){ have[key(b)]=1; });
  return ms.concat(hs.filter(function(b){ return !have[key(b)]; }));
}
function eaExamKey(school,grade,term){ return school+'|'+grade+'|'+term; }
function eaBooksOf(school,grade,term){
  return eaBooks().filter(function(b){ return b.school===school && b.grade===grade && b.term===term; }).sort(function(a,b){ return String(a.year).localeCompare(String(b.year)); });
}
/* 그 시험·연도의 해설집 (풀이 인쇄용) */
function eaHsFor(book){
  var arr=(HS&&HS.cat&&HS.cat.items)||[];
  for(var i=0;i<arr.length;i++){ var it=arr[i]; var tm=String(it.term||'').match(/([12])\s*학기\s*(중간|기말)/); if(!tm) continue;
    var y=(String(it.term||'').match(/(20\d{2})/)||[])[1]||''; if(eaSchoolKey(it.school)===book.school && eaNormGrade(it.grade)===book.grade && (tm[1]+'학기 '+tm[2])===book.term && y===String(book.year)) return it.code; }
  return book.hsCode||null;
}
/* 다리가 붙여 준 매쓰플랫 유형이 «이 문항의 수학비서 단원»과 어울리는지 본다 (v19-37).
 * 매쓰플랫은 학습지를 «그 학기 유형»에서만 찾아 붙이는지, 2학기 중간 시험지의 1학기 단원(정비례) 문항에
 * 「회전체의 겉넓이」「상대도수」 같은 엉뚱한 유형을 달아 두었다 (옥길중 606문항 중 64건). 규칙:
 *   학기가 같고 이름이 조금이라도 겹치면(0.06) 믿고, 학기가 달라도 이름이 꽤 겹치면(0.18) 믿는다 (곱셈공식·대푯값처럼 교육과정 자리가 다른 것).
 *   유형DB에서 찾을 수 없는 이름은 그대로 둔다. 그림(pimg)은 위치로 맞는 것이라 유형이 틀려도 살린다. */
var EA_TYPEIDX=null;
function eaTypeIdx(){
  if(EA_TYPEIDX) return EA_TYPEIDX; var byType={}, byMid={};
  try{ var A=window.MF_TYPEDB; (A&&A.grades||[]).forEach(function(G){ (G.b||[]).forEach(function(b){ (b.m||[]).forEach(function(m){ (byMid[m.n]=byMid[m.n]||[]).push(G.g);
    (m.s||[]).forEach(function(s){ (s.t||[]).forEach(function(t){ (byType[t]=byType[t]||[]).push({ g:G.g, txt:(b.n||'')+' '+m.n+' '+s.n+' '+t }); }); }); }); }); }); }catch(e){}
  EA_TYPEIDX={ byType:byType, byMid:byMid }; return EA_TYPEIDX;
}
function eaBridgeOk(q, p){
  var X=eaTypeIdx(); var N=(window.MF_TYPE_ACH&&window.MF_TYPE_ACH.names)||{}; var nm=N[String(p.conceptId)]||null;
  var ents=X.byType[p.concept]||[]; if(!ents.length&&nm&&nm.n) ents=X.byType[nm.n]||[];
  if(!ents.length&&nm&&nm.m&&X.byMid[nm.m]) ents=X.byMid[nm.m].map(function(g){ return { g:g, txt:nm.m+' '+(nm.n||'') }; });
  if(!ents.length) return true;
  var msG=String(q.sem||'').replace(/\s/g,''), okG=false, best=0;
  var g=eaGrams([q.unit,q.mid,q.type,q.sub].concat(q.tags||[]).join(' '));
  ents.forEach(function(e){ if(e.g===msG) okG=true; var d=eaDice(g,eaGrams(e.txt+' '+(p.concept||''))); if(d>best) best=d; });
  return (okG&&best>=0.06)||best>=0.18;
}
/* 다리 문항 → 학생 기록: 유형 번호로, 없으면 유형 이름으로 (2025년 시험지는 2015 교육과정 번호라 2026년 중2·중3 기록과 번호가 다르다) */
/* v19-38: 기출 문항 난이도(수학비서 1~9)에 맞는 칸의 정답률 — 하(1~2) 개념 · 중(3~4) 기본 · 상·최상(5~9) 심화.
 * 그 칸에 3문제 미만이면 총 정답률을 그대로 쓴다 (원장 지시 2026-09-23 「수학비서 난이도 1-9 사용」 — 개념/기본/심화 칸과 겹치기) */
function eaBandRate(rec, diff){
  if(!rec||!rec.sub||!diff) return null; var k=diff>=5?'a':(diff>=3?'b':'c'); var v=rec.sub[k]||[0,0]; if(!(v[0]>=3)) return null;
  return { label:(k==='a'?'심화':(k==='b'?'기본':'개념')), n:v[0], o:v[1], rate:Math.round(v[1]/v[0]*100) };
}
function eaBridgeRec(my, p){ if(!p||p.conceptId==null) return null; return my.byCid[String(p.conceptId)] || (p.concept&&my.byName[p.concept]) || null; }
/* v19-45: 다리 문항을 «번호 자리»로만 믿지 않는다 (2026-09-25 인쇄물 검사에서 발견).
 *   ① 매쓰플랫이 시험지를 읽을 때 상자를 더 자르거나(옥길중 2024 중3 2학기 중간: 20문항 → 29상자) 2단 지면 순서를 다르게 읽어 14번부터 다른 문제의 풀이가 붙었다.
 *   ② 매쓰플랫 문제은행의 같은 문제가 «숫자 하나가 다른 판»이거나 정답이 다르게 적혀 있다 (범박고 2025 고1 2학기 중간 4번: 「y=x 대칭」이 매쓰플랫엔 「y=ax」, 정답 ②↔④).
 *      그 풀이를 그대로 붙이면 학생이 틀린 풀이를 보게 된다.
 * 규칙: 객관식 정답(①~⑤ ↔ 1~5)이 같은 자리만 «검증됨(ok)»으로 본다. 자리가 어긋났으면 ±3자리 안에서 정답이 같고 유형 이름이 꽤 겹치는(0.2) 것을 찾는다.
 *       검증 안 된 자리는 유형 번호(내 기록 잇기)에는 쓰되 풀이 그림은 붙이지 않는다. 서술형·단답은 «정답이 하나도 안 어긋난 시험지»에서만 검증됨으로 본다. */
function eaBridgeMap(book){
  var b=EA.bridge[String(book.id)]; if(!b||!b.problems) return null; if(b._map) return b._map;
  var P=b.problems, Q=book.qs||[], map={}, used={}, circ='①②③④⑤';
  function ch(x){ var t=String(x==null?'':x).trim(); var i=circ.indexOf(t); if(i>=0&&t.length===1) return String(i+1); if(/^[1-5]$/.test(t)) return t; return ''; }
  var cmp=0, bad=0; Q.forEach(function(q){ var p=P[q.no-1]; if(!p) return; var a=ch(q.answer), c=ch(p.answer); if(a&&c){ cmp++; if(a!==c) bad++; } });
  var trust=!bad, mostly=!cmp||(bad/cmp)<0.5;
  Q.forEach(function(q){ var a=ch(q.answer), pos=q.no-1;
    if(a){
      if(P[pos]&&!used[pos]&&ch(P[pos].answer)===a){ map[q.no]={ i:pos, ok:1 }; used[pos]=1; return; }
      var g=eaGrams([q.unit,q.mid,q.type,q.sub].concat(q.tags||[]).join(' ')), best=-1, bs=0;
      for(var j=Math.max(0,pos-3); j<Math.min(P.length,pos+4); j++){ if(used[j]||ch(P[j].answer)!==a) continue; var sc=eaDice(g,eaGrams(String(P[j].concept||''))); if(sc>=0.2&&sc>bs){ bs=sc; best=j; } }
      if(best>=0){ map[q.no]={ i:best, ok:1 }; used[best]=1; return; }
      if(mostly&&P[pos]) map[q.no]={ i:pos, ok:0 };
    } else if(P[pos]) map[q.no]={ i:pos, ok:trust?1:0 };
  });
  b._map=map; b._cmp=cmp; b._bad=bad; return map;
}
function eaBridgeQ(book, q){
  if(book.src!=='ms') return null; var b=EA.bridge[String(book.id)]; if(!b||!b.problems) return null;
  var map=eaBridgeMap(book); var m=map?map[q.no]:null; if(!m) return null; var p=b.problems[m.i]; if(!p) return null; p._ansOk=m.ok;
  if(p.conceptId!=null && p._ok==null) p._ok=eaBridgeOk(q,p)?1:0;
  if(p.conceptId!=null && !p._ok) return p.pimg ? { pimg:p.pimg, aimg:p.aimg, simg:p.simg, answer:p.answer, ansOk:m.ok, conceptId:null, concept:'', bad:1 } : null;
  if(!(p.conceptId!=null||p.pimg)) return null; var o={}; for(var k in p) o[k]=p[k]; o.ansOk=m.ok; return o;
}

/* ═══ 시험 범위 ═══
 * 저장된 것 → 수학비서 scopes(「중1-2: 01 기본 도형 - 03 작도와 합동」) → 최근 해 시험에 나온 대단원 */
function eaRangeOf(school,grade,term){
  var key=eaExamKey(school,grade,term); var saved=EA.cfg.ranges[key]; if(Array.isArray(saved)&&saved.length) return saved.slice();
  var books=eaBooksOf(school,grade,term); if(!books.length) return [];
  var latest=books[books.length-1], out=[], seen={};
  var scoped=books.slice().reverse().filter(function(b){ return b.scopes&&b.scopes.length; })[0];
  if(scoped){
    /* 「중1-2: 01 기본 도형 - 03 작도와 합동」 → 그 학기의 01~03 대단원 이름 — 번호는 수학비서 원자료(chapters[1])에서 읽는다 */
    scoped.scopes.forEach(function(sc){
      var m=String(sc).match(/^\s*([^:]+):\s*(\d+)\s*([^-]*?)\s*(?:-\s*(\d+)\s*(.*))?$/); if(!m) return;
      var sem=m[1].trim(), a=Number(m[2]), b=m[4]?Number(m[4]):a;
      Object.keys(EA.ms).forEach(function(sk){ (EA.ms[sk].exams||[]).forEach(function(e){ if(eaNormGrade(e.grade)!==grade) return;
        (e.cells||[]).forEach(function(c){ var ch=c.chapters||[]; if(eaClean(ch[0])!==sem) return; var num=Number((String(ch[1]||'').match(/^(\d+)/)||[])[1]||0);
          if(num>=a && num<=b){ var nm=eaClean(ch[1]); if(!seen[nm]){ seen[nm]=1; out.push(nm); } } }); }); });
    });
  }
  latest.qs.forEach(function(q){ if(!seen[q.unit]){ seen[q.unit]=1; out.push(q.unit); } });
  return out;
}

/* ═══ ② 연도 × 단원 행렬 ═══ */
function eaMatrix(school,grade,term){
  var books=eaBooksOf(school,grade,term), range=eaRangeOf(school,grade,term);
  var rowMap={}, order=[];
  function row(u){ if(!rowMap[u]){ rowMap[u]={ unit:u, cells:{}, w:0 }; order.push(u); } return rowMap[u]; }
  range.forEach(row);
  books.forEach(function(b){ b.qs.forEach(function(q){
    var r=row(q.unit); var c=r.cells[b.year]||(r.cells[b.year]={ pt:0, n:0, essay:0, killer:0, pct:0, types:[] });
    c.pt+=q.pt; c.n++; if(q.essay) c.essay++; if(q.diff>=EA_KILL) c.killer++;
    c.types.push({ no:q.no, type:q.type||q.unit, pt:q.pt, essay:q.essay, diff:q.diff });
  }); });
  books.forEach(function(b){ order.forEach(function(u){ var c=rowMap[u].cells[b.year]; if(!c) return; c.pct=b.noPt?(b.qs.length?c.n/b.qs.length*100:0):(b.total?c.pt/b.total*100:0); }); });
  order.forEach(function(u){ var r=rowMap[u], s=0; books.forEach(function(b){ var c=r.cells[b.year]; if(c) s+=c.pct; }); r.w=books.length?(s/books.length):0; r.inRange=range.indexOf(u)>=0; });
  var nBridge=books.filter(function(b){ return b.src==='ms' && EA.bridge[String(b.id)] && (EA.bridge[String(b.id)].problems||[]).length; }).length;
  return { books:books, years:books.map(function(b){ return { year:b.year, id:b.id, src:b.src, total:b.total, n:b.qs.length, noPt:b.noPt, title:b.title, bridged:!!(b.src==='ms'&&EA.bridge[String(b.id)]&&(EA.bridge[String(b.id)].problems||[]).length) }; }),
    rows:order.map(function(u){ return rowMap[u]; }), range:range, nBridge:nBridge, nMs:books.filter(function(b){ return b.src==='ms'; }).length };
}
/* 매년 반복 출제된 세부유형 — 수학비서 세부유형 이름이 같은 것 (두 해 이상) */
function eaRepeats(M){
  var books=M.books; if(books.length<2) return [];
  var latest=books[books.length-1], out=[];
  var seen={};
  latest.qs.forEach(function(q){
    var t=q.type; if(!t) return;
    if(seen[t]){ seen[t].pt=Math.round((seen[t].pt+q.pt)*10)/10; seen[t].count++; return; }   /* 같은 세부유형이 올해 두 번이면 하나로 묶는다 (v19-40) */
    var hits=[latest.year];
    books.slice(0,-1).forEach(function(b){ var g=eaGrams(t); var ok=b.qs.some(function(p){ return p.type===t || (b.src==='hs' && eaDice(g, eaGrams(p.unit+' '+p.type))>=0.5); }); if(ok) hits.push(b.year); });
    if(hits.length>=2){ var o={ q:q, unit:q.unit, years:hits.sort(), pt:q.pt, count:1 }; seen[t]=o; out.push(o); }
  });
  out.sort(function(a,b){ return b.years.length-a.years.length || b.pt-a.pt; });
  return out;
}

/* ═══ ③ 내 기록 — 유형 성취도를 매쓰플랫 중단원으로 ═══ */
function eaMyRecord(code){
  var out={ units:{}, byCid:{}, byName:{}, weakTypes:[], strong:[], periods:[] };
  var A=window.MF_TYPE_ACH; var S=(typeof tqStu==='function')?tqStu(code):null; if(!A||!S) return out;
  var ps=Object.keys(S).sort(), use=ps.slice(-4); out.periods=use; var byT={};
  use.forEach(function(p){ var per=S[p]||{}; Object.keys(per).forEach(function(cid){ var a=per[cid]||[]; var t=byT[cid]||(byT[cid]={ n:0, o:0, cn:0, co:0, bn:0, bo:0, an:0, ao:0 }); t.n+=(a[0]||0); t.o+=(a[1]||0); t.cn+=(a[2]||0); t.co+=(a[3]||0); t.bn+=(a[4]||0); t.bo+=(a[5]||0); t.an+=(a[6]||0); t.ao+=(a[7]||0); }); });
  Object.keys(byT).forEach(function(cid){
    var t=byT[cid]; if(!t.n) return; var nm=(A.names&&A.names[cid])||{}; var mid=nm.m||'기타', name=nm.n||String(cid);
    var u=out.units[mid]||(out.units[mid]={ n:0, o:0, rate:0, types:[] }); u.n+=t.n; u.o+=t.o;
    var rate=Math.round(t.o/t.n*100); var rec={ cid:String(cid), name:name, mid:mid, n:t.n, o:t.o, rate:rate, g:eaGrams(name), sub:{ c:[t.cn,t.co], b:[t.bn,t.bo], a:[t.an,t.ao] } };
    u.types.push(rec); out.byCid[String(cid)]=rec;
    /* v19-37: 같은 유형명이 교육과정(2015/2022)마다 다른 번호를 갖는다 — 다리 번호가 없을 때 이름으로 잇는다. 이름이 겹치면 문항 수 많은 쪽 */
    if(!out.byName[name] || out.byName[name].n<rec.n) out.byName[name]=rec;
    if(t.n>=3 && rate<75) out.weakTypes.push(rec);
    if(t.n>=8 && rate>=90) out.strong.push(rec);
  });
  Object.keys(out.units).forEach(function(k){ var u=out.units[k]; u.rate=u.n?Math.round(u.o/u.n*100):0; u.types.sort(function(a,b){ return a.rate-b.rate||b.n-a.n; }); });
  out.weakTypes.sort(function(a,b){ return a.rate-b.rate||b.n-a.n; }); out.strong.sort(function(a,b){ return b.n-a.n; });
  return out;
}
/* 수학비서 대단원 이름 → 학생 기록의 매쓰플랫 중단원.
 * 이름이 같으면 바로(22/46 이 그렇다). 아니면 유형DB 에서 그 중단원의 소단원·유형 이름까지 펼쳐 놓고
 * 가장 많이 겹치는 중단원을 고른다 (「여러가지 사각형」→「사각형의 성질」, 「삼각형의 외심과 내심」→「삼각형의 성질」). */
var EA_MIDWORDS=null;
function eaMidWords(){
  if(EA_MIDWORDS) return EA_MIDWORDS; var out={};
  try{ var A=window.MF_TYPEDB; (A&&A.grades||[]).forEach(function(G){ (G.b||[]).forEach(function(b){ (b.m||[]).forEach(function(m){ var w=out[m.n]||(out[m.n]=[]); w.push(m.n); (m.s||[]).forEach(function(s){ w.push(s.n); (s.t||[]).forEach(function(t){ w.push(t); }); }); }); }); }); }catch(e){}
  EA_MIDWORDS=out; return out;
}
function eaMidFor(unit, my){
  var mids=Object.keys(my.units); if(mids.indexOf(unit)>=0) return unit;
  var g=eaGrams(unit), words=eaMidWords(), best='', bs=0;
  mids.forEach(function(m){
    var s=eaDice(g, eaGrams(m))*1.15;
    (words[m]||[]).forEach(function(w){ var d=eaDice(g, eaGrams(w)); if(d>s) s=d; });
    if(s>bs){ bs=s; best=m; }
  });
  return bs>=0.4?best:'';
}

/* ═══ ④ 겹치기 — 예상 실점 ═══ */
function eaAnalyze(code, school, grade, term){
  var M=eaMatrix(school,grade,term), my=eaMyRecord(code), rows=[];
  var sum=0, cnt=0;
  M.rows.forEach(function(r){ if(!r.inRange) return; var mid=eaMidFor(r.unit,my); var u=mid?my.units[mid]:null; if(u&&u.n){ sum+=u.rate*u.n; cnt+=u.n; } });
  var avg=cnt?(sum/cnt):70, totalLoss=0;
  M.rows.forEach(function(r){
    if(!r.inRange) return;
    var mid=eaMidFor(r.unit,my), u=mid?my.units[mid]:null;
    /* 다리로 이어진 이 단원 기출 문항의 유형(cid)들 — 중단원 이름이 안 맞아도 기록을 찾는다 */
    var bn=0, bo=0, bweak=[], seenC={};
    M.books.forEach(function(b){ b.qs.forEach(function(q){ if(q.unit!==r.unit) return; var p=eaBridgeQ(b,q); if(!p||p.conceptId==null) return;
      var rec=eaBridgeRec(my,p); if(!rec||seenC[rec.cid]) return; seenC[rec.cid]=1; bn+=rec.n; bo+=rec.o; if(rec.n>=3&&rec.rate<75) bweak.push(rec); }); });
    var rate, n, noData=false, how;
    if(u&&u.n){ rate=u.rate; n=u.n; how='중단원 「'+mid+'」'; }
    else if(bn){ rate=Math.round(bo/bn*100); n=bn; how='기출 유형 '+Object.keys(seenC).length+'개'; }
    else { rate=avg; n=0; noData=true; how=''; }
    var loss=r.w*(1-rate/100); totalLoss+=loss;
    var weak=(u?u.types.filter(function(t){ return t.n>=3 && t.rate<75; }):[]).slice(0,4);
    bweak.forEach(function(w){ if(!weak.some(function(x){ return x.cid===w.cid; }) && weak.length<5) weak.push(w); });
    rows.push({ unit:r.unit, w:r.w, rate:Math.round(rate), n:n, loss:loss, noData:noData, how:how, weak:weak, mid:mid });
  });
  rows.sort(function(a,b){ return b.loss-a.loss; });
  var maxLoss=rows.length?rows[0].loss:0; rows.forEach(function(r,i){ r.rank=i+1; r.share=maxLoss?(r.loss/maxLoss):0; });
  return { rows:rows, score:Math.max(0,Math.round(100-totalLoss)), avgRate:Math.round(avg), my:my, M:M };
}

/* ═══ ⑤ 문항 고르기 ═══ */
function eaPick(A, n){
  var lossOf={}; A.rows.forEach(function(r){ lossOf[r.unit]=r; });
  var weak=A.my.weakTypes, cands=[];
  A.M.books.forEach(function(b){ b.qs.forEach(function(q){
    var r=lossOf[q.unit]; if(!r) return;
    if(b.src==='hs' && EA.bodies[b.hsCode] && !eaItemHtml(EA.bodies[b.hsCode], q.no)) return;
    if(b.src==='ms' && !q.img && !eaHsFor(b)) return;   /* 그림도 해설도 없으면 인쇄 못 한다 */
    var match=null, sim=0, exact=false;
    var p=eaBridgeQ(b,q);
    var brec=eaBridgeRec(A.my,p);
    if(brec){ match=brec; exact=true; sim=1; }
    else {
      /* 이름으로 맞출 때는 «같은 단원 안의 약한 유형»만 본다 — 「도형의 넓이를 이등분하는 직선」이
       * 「삼각형의 외각의 이등분선」(다른 단원)에 붙던 사고를 막는다. 문턱도 0.16 → 0.25 */
      var pool=weak; if(r.mid) pool=weak.filter(function(w){ return w.mid===r.mid; });
      if(r.weak&&r.weak.length) r.weak.forEach(function(w){ if(pool.indexOf(w)<0) pool=pool.concat([w]); });
      var g=eaGrams(q.type+' '+(q.tags||[]).join(' ')+' '+(q.title||''));
      pool.forEach(function(w){ var s=eaDice(g,w.g); if(s>sim){ sim=s; match=w; } });
      if(sim<0.25) match=null;
    }
    var band=match?eaBandRate(match,q.diff):null; var mr=band?band.rate:(match?match.rate:0), mn=band?band.n:(match?match.n:0);
    var tscore=match?((1-mr/100)*Math.min(1,mn/20))*(exact?1:0.8):0;
    var dscore=Math.max(0,(q.diff||3)-1)*0.02;
    var _so=eaSolOf(b,q); if(_so&&_so.hold) return;   /* v19-60: 문제·정답표가 의심되는 문항(원장 확인 전)은 뽑지 않는다 */
    cands.push({ q:q, book:b, unit:q.unit, match:match, exact:exact, sim:sim, band:band, sol:_so, score:r.share*0.6 + tscore*0.4 + dscore + (q.essay?0.03:0) });
  }); });
  cands.sort(function(a,b){ return b.score-a.score; });
  var totalShare=0; A.rows.forEach(function(r){ totalShare+=r.share; });
  var capU={}; A.rows.forEach(function(r){ capU[r.unit]=Math.max(2, Math.round(n*(totalShare?r.share/totalShare:0))+1); });
  var picked=[], cT={}, cU={};
  /* v19-45: 풀이(해설집·매쓰플랫 풀이 그림)가 있는 문항부터 채우고, 모자랄 때만 풀이 없는 문항을 붙인다 (원장 지시 「해설지가 있어야 한다」) */
  function fill(pool){
    var i;
    if(n>=A.rows.length){ A.rows.forEach(function(r){ if(cU[r.unit]) return; for(var j=0;j<pool.length;j++){ var c0=pool[j]; if(c0.unit!==r.unit) continue; var tk0=c0.match?String(c0.match.cid):''; if(tk0&&(cT[tk0]||0)>=2) continue; picked.push(c0); if(tk0) cT[tk0]=(cT[tk0]||0)+1; cU[c0.unit]=(cU[c0.unit]||0)+1; break; } }); }
    for(i=0;i<pool.length && picked.length<n;i++){
      if(picked.indexOf(pool[i])>=0) continue;
      var c=pool[i], tk=c.match?String(c.match.cid):'', uk=c.unit;
      if(tk && (cT[tk]||0)>=2) continue; if((cU[uk]||0)>=(capU[uk]||2)) continue;
      picked.push(c); if(tk) cT[tk]=(cT[tk]||0)+1; cU[uk]=(cU[uk]||0)+1;
    }
    for(i=0;i<pool.length && picked.length<n;i++){ if(picked.indexOf(pool[i])<0){ var tk2=pool[i].match?String(pool[i].match.cid):''; if(tk2&&(cT[tk2]||0)>=2) continue; picked.push(pool[i]); if(tk2) cT[tk2]=(cT[tk2]||0)+1; cU[pool[i].unit]=(cU[pool[i].unit]||0)+1; } }
  }
  fill(cands.filter(function(c){ return c.sol; })); if(picked.length<n) fill(cands.filter(function(c){ return !c.sol; }));
  var rankOf={}; A.rows.forEach(function(r){ rankOf[r.unit]=r.rank; });
  picked.sort(function(a,b){ return (rankOf[a.unit]||99)-(rankOf[b.unit]||99) || String(b.book.year).localeCompare(String(a.book.year)) || a.q.no-b.q.no; });
  return picked;
}

/* ── 유사유형 재료 (학생 기록에서 유형별 실제 문항 자리) ── */
function eaFetchRecs(code, cids){
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  var cache=EA.recs[code]||(EA.recs[code]={}); var need=cids.filter(function(c){ return c && !cache[c]; });
  if(!sb || !need.length) return Promise.resolve(cache);
  return sb.from('mf_answer_records').select('concept_id,worksheet_title,page,number,result,score_datetime,source')
    .eq('lumen_rec_code',String(code)).in('concept_id',need.map(function(c){ return Number(c); })).order('score_datetime',{ascending:false}).limit(600)
    .then(function(r){ need.forEach(function(c){ cache[c]=[]; }); (r&&r.data||[]).forEach(function(x){ var k=String(x.concept_id); if(cache[k]) cache[k].push(x); }); return cache; })
    .catch(function(){ need.forEach(function(c){ cache[c]=[]; }); return cache; });
}
function eaSimilar(code, pick, A){
  var out=[], cache=EA.recs[code]||{}, cids=[];
  if(pick.match) cids.push(String(pick.match.cid));
  var r=null; A.rows.forEach(function(x){ if(x.unit===pick.unit) r=x; });
  if(r) r.weak.forEach(function(w){ if(cids.indexOf(String(w.cid))<0 && cids.length<3) cids.push(String(w.cid)); });
  var seen={}, rows=[];
  cids.forEach(function(c){ (cache[c]||[]).forEach(function(x){ var key=String(x.worksheet_title||'')+'|'+String(x.page||'')+'|'+String(x.number||''); if(seen[key]) return; seen[key]=1; rows.push(x); }); });
  rows.sort(function(a,b){ return (a.result==='X'?0:1)-(b.result==='X'?0:1) || String(b.score_datetime).localeCompare(String(a.score_datetime)); });
  rows.slice(0,3).forEach(function(x){ var t=String(x.worksheet_title||'').replace(/\s+/g,' ').trim();
    out.push({ kind:'book', text:t+(x.page?(' p.'+x.page):'')+(x.number?(' '+x.number+'번'):'')+(x.result==='X'?' ✗ 틀렸던 문제':' ○'), date:String(x.score_datetime||'').slice(0,10) }); });
  /* 쌍둥이 학습지 — 매쓰플랫에 「원본+쌍둥이」가 만들어져 있으면 */
  try{ var d=(typeof TW!=='undefined'&&TW&&TW.done)?TW.done[String(pick.book.id)]:null; if(d&&d.wsTwin) out.push({ kind:'twin', text:'🏭 쌍둥이 학습지 「'+(d.mylist||'기출 쌍둥이')+'」 '+pick.q.no+'번' }); }catch(e){}
  return out;
}

/* ═══ 본문·그림 ═══ */
function eaBodyLoad(code){
  if(!code) return Promise.resolve(null);
  if(EA.bodies[code]) return Promise.resolve(EA.bodies[code]);
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb) return Promise.resolve(null);
  return sb.from('lumen_store').select('value').eq('key','haesol_body_'+code).then(function(r){
    var v=(r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    if(v) EA.bodies[code]=v; return v;
  }).catch(function(){ return null; });
}
function eaItemHtml(body, no){
  var it=(body&&body.items)||{}; var h=it[no]||it[String(no)]; if(typeof h==='string') return h;
  var ks=Object.keys(it); for(var i=0;i<ks.length;i++){ var s=it[ks[i]]; if(typeof s==='string' && new RegExp('class="sol-k">\\s*'+no+'\\b').test(s)) return s; }
  return '';
}
/* v19-45: 이 문항의 «풀이»는 어디서 오나 (원장 지시 2026-09-25 「해설지가 있어야 한다 — 기출 해설집에서, 없으면 해설집을 만들어 붙여라」)
 *   ① 루멘 기출 해설집(haesol_body_*) — 단계별 풀이. 본문을 아직 안 읽었으면(미리 보기) «있다»고만 본다
 *   ② 매쓰플랫 원본 학습지의 풀이 그림(simg) — 기출 쌍둥이 작업 때 매쓰플랫이 문항을 맞춰 두면 생긴다 (옥길중 31장 전부)
 *   ③ 없음 → 정답만 적고 「풀이 준비 중」 */
/* v19-60: 다시 쓴 풀이 글 → html. \( \)·$$ $$ 수식은 lcRenderMath 가 그리고, 나머지 글은 이스케이프 · 빈 줄 = 문단 */
function eaFixHtml(t){
  var out='', re=/(\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\))/g, last=0, m, src=String(t||'');
  while((m=re.exec(src))){ out+=eaEsc(src.slice(last,m.index)).replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>'); out+=lcRenderMath(m[0]); last=re.lastIndex; }
  out+=eaEsc(src.slice(last)).replace(/\n\n+/g,'</p><p>').replace(/\n/g,'<br>');
  return '<p>'+out+'</p>';
}
function eaSolOf(b, q){
  var code=eaHsFor(b);
  if(code){ var body=EA.bodies[code]; if(!body) return { kind:'hs', code:code, html:'' }; var html=eaItemHtml(body,q.no); if(html) return { kind:'hs', code:code, html:html }; }
  var br=eaBridgeQ(b,q); if(br&&br.simg&&br.ansOk){
    /* v19-60 (원장 지적 2026-09-29 「풀이에 이상한 문자」): 매쓰플랫 풀이 그림 중 수식이 망가진 것(₩frac·egin·ight 등)은
     * 우리가 다시 쓴 풀이 글(mf_sol_fix.fix)을 싣고, 아직 못 쓴 것(bad)은 그림을 빼고 정답만 싣는다 */
    var SF=EA.solfix||{}, fx=(SF.fix||{})[br.simg];
    if((SF.hold||{})[br.simg]) return { kind:'mf', simg:'', hold:1, why:SF.hold[br.simg] };
    if(fx&&fx.text) return { kind:'mf', simg:'', fix:fx.text, aimg:br.aimg||'', pimg:br.pimg||'', answer:'' };
    if((SF.bad||{})[br.simg]) return { kind:'mf', simg:'', bad:1, aimg:'', pimg:br.pimg||'', answer:'' };
    return { kind:'mf', simg:br.simg, aimg:br.aimg||'', pimg:br.pimg||'', answer:'' };
  }   /* 정답이 검증된 자리만 (ansOk) · 정답 글은 기출 원본 것을 쓴다 */
  return null;
}
/* Storage exam_images 의 서명 주소 (2시간) — 비공개 버킷이라 공개 주소는 없다 */
function eaSign(paths){
  var need=paths.filter(function(p){ return p && !EA.signed[p]; }); if(!need.length) return Promise.resolve(EA.signed);
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb||!sb.storage) return Promise.resolve(EA.signed);
  return sb.storage.from('exam_images').createSignedUrls(need, 7200).then(function(r){
    (r&&r.data||[]).forEach(function(x){ if(x&&x.signedUrl){ var p=x.path||need[(r.data||[]).indexOf(x)]; EA.signed[p]=x.signedUrl; } });
    return EA.signed;
  }).catch(function(){ return EA.signed; });
}

/*__TEX__*/

/* ═══ 인쇄물 ═══════════════════════════════════════════════════ */
function eaFmtLoss(x){ return (Math.round(x*10)/10).toFixed(1); }
/* 수학비서 난이도는 1~9 (원장 지시 2026-09-23 「1-9로 나누었다. 이를 사용」).
 * 옥길중 39장의 easy/normal/hard 집계와 맞춰 보면: 1~2 하 · 3~4 중 · 5~6 상 · 7~9 최상. 숫자도 같이 보여 준다 */
var EA_KILL=6;   /* ☠ 표시 = 난이도 6 이상 (상의 윗단·최상) */
function eaDiffBand(d){ return d>=7?'최상':(d>=5?'상':(d>=3?'중':(d?'하':''))); }
function eaDiffWord(d){ return d?(d+'/9 '+eaDiffBand(d)):''; }
/* v19-39: 「어느 학교 어느 시험 몇 번」을 문항마다 또렷이 (원장 지시 2026-09-23 「옥길중 기출이라는 출제가 어디에서 되었는지 보여주는 것이 중요하다」) */
function eaOrigin(b, q){
  var sch=b.schoolName||b.school||''; if(sch&&!/학교$/.test(sch)) sch+=(/고$/.test(sch)?'등학교':(/중$/.test(sch)?'학교':''));
  return sch+' '+b.year+'학년도 '+(b.term||'').replace(/(중간|기말)$/,'$1고사')+' '+q.no+'번';
}
function eaOriginLine(b, q){
  var h='<div class="src">📌 <b>출제 '+eaEsc(eaOrigin(b,q))+'</b>';
  if(b.srcPath) h+=' <span class="tiny">— '+eaEsc(b.srcName||'')+' · '+eaEsc(b.srcPath)+'</span>'; else if(b.srcName) h+=' <span class="tiny">— '+eaEsc(b.srcName)+'</span>';
  var path=[q.sem,q.unit,q.mid,q.type,q.sub].filter(function(x){ return x; }).join(' › '); if(path) h+='<br>유형 자리: '+eaEsc(path);
  return h+'</div>';
}
function eaNo2(n){ return n<10?('0'+n):String(n); }
/* 정답 글 — 수학비서 정답은 $…$ 수식일 때가 있다(「$y=2(x-2)^{2}-4$」). 파일 안 수식 그리기로 넘긴다 */
function eaAnsHtml(a){ var t=String(a==null?'':a); if(!/[$\\]/.test(t)) return eaEsc(t); try{ return lcRenderMath(eaEsc(t).replace(/\$\$([\s\S]*?)\$\$/g,'\\($1\\)').replace(/\$([^$]+)\$/g,'\\($1\\)')); }catch(e){ return eaEsc(t); } }
/* 교과서 문항 정답 한 줄 — 서술형은 정답 그림, 아니면 글(수식은 평문으로), 없으면 정답 그림 */
function eaTbAnsHtml(t){
  if(t.type==='ESSAY'&&t.aimg) return '<span class="tiny">서술형</span><br><img src="'+eaEsc(t.aimg)+'" alt="정답" style="max-width:100%;max-height:40mm">';
  if(t.answer) return '<span class="tbans">'+eaEsc((typeof lcTexPlain==='function')?lcTexPlain(t.answer):t.answer)+'</span>';
  if(t.aimg) return '<img src="'+eaEsc(t.aimg)+'" alt="정답" style="max-height:22mm;vertical-align:middle">';
  return '<span class="tiny">정답 자료 없음 (선생님께 확인)</span>';
}
function eaBooklet(stu, A, picked, meta){
  var name=eaEsc(stu?stu.name:''), grade=eaEsc(String((stu&&stu.grade)||'').replace('학교',''));
  var today=new Date(Date.now()+9*3600000); var dstr=today.getFullYear()+'. '+(today.getMonth()+1)+'. '+today.getDate();
  var M=A.M, nq=picked.length;
  /* v19-50: 학생마다 쪽 번호 — 표지 1, 문항 2~, 마지막 장. 한 장 = 한 쪽으로 못 박아서(인쇄 CSS) 번호가 맞는다 (원장 지적 2026-09-27: 전체 100쪽으로만 나온다) */
  var NP=nq+2; var pf=function(p){ return '<div class="pfoot"><span>'+name+' · '+grade+'</span><span>'+eaEsc(meta.grade+' '+meta.term)+' 시험 대비</span><span class="pn">'+p+' / '+NP+'</span></div>'; };
  /* 해설집(글) 문항은 두 쪽을 넘기도 해서 자연스럽게 흐르게 두고(flow), 그림 문항·표지·마지막 장은 한 쪽에 고정(one). 쪽 번호는 인쇄 창의 eaPaginate 가 실제 높이로 다시 센다 */
  var h='<div class="bk">';
  h+='<div class="sheet cover one">'
    +'<div class="ctop"><div class="brand">LUMEN MATH</div><div class="cday">'+dstr+'</div></div>'
    +'<div class="ctitle">🎯 시험 대비 분석</div>'
    +'<div class="cwho"><b>'+name+'</b> <span>'+grade+' · '+eaEsc(meta.schoolName)+'</span></div>'
    +'<div class="cband">'+eaEsc(meta.grade+' '+meta.term)+(meta.date?(' · '+eaEsc(meta.date)):'')+' · 기출 '+M.years.length+'개년'+(M.range.length?(' · 범위 '+eaEsc(M.range.join(' · '))):'')+'</div>';
  h+='<div class="sec"><div class="sh">1부 · 이 시험은 — 연도 × 단원 배점</div>';
  h+='<table class="mx"><tr><th>단원</th>'+M.years.map(function(y){ return '<th class="num">'+eaEsc(y.year)+'<br><span class="tiny">'+(y.noPt?(y.n+'문항'):(eaPt(y.total)+'점'))+'</span></th>'; }).join('')+'<th class="num">비중</th></tr>';
  M.rows.filter(function(r){ return r.inRange; }).sort(function(a,b){ return b.w-a.w; }).forEach(function(r){
    h+='<tr><td><b>'+eaEsc(r.unit)+'</b></td>';
    M.years.forEach(function(y){ var c=r.cells[y.year]; h+='<td class="num">'+(c?((y.noPt?(c.n+'문항'):(eaPt(c.pt)+'점'))+(c.essay?'<span class="tiny"> ✍'+c.essay+'</span>':'')):'<span class="tiny">—</span>')+'</td>'; });
    h+='<td class="num"><span class="wbar" style="width:'+Math.round(r.w*1.4)+'px"></span>'+Math.round(r.w)+'%</td></tr>';
  });
  h+='</table>';
  var top=M.rows.filter(function(r){ return r.inRange; }).sort(function(a,b){ return b.w-a.w; })[0];
  var rep=eaRepeats(M);
  if(top) h+='<div class="line">기출에서 가장 큰 단원은 <b>'+eaEsc(top.unit)+'</b>('+Math.round(top.w)+'%)입니다.'+(rep.length?(' 두 해 이상 반복된 유형 <b>'+rep.length+'개</b>: '+rep.slice(0,5).map(function(x){ return eaEsc(x.q.type); }).join(' · ')+(rep.length>5?' …':'')):'')+' <span class="tiny">✍ 서술형 문항 수</span></div>';
  h+='</div>';
  h+='<div class="sec"><div class="sh">2부 · 나는 지금 — 최근 8주 내가 푼 문제</div><div class="bars">';
  A.rows.slice().sort(function(a,b){ return b.w-a.w; }).forEach(function(r){
    h+='<span class="nm">'+eaEsc(r.unit)+'</span><span class="tr"><i class="'+(r.rate<50?'r':'')+'" style="width:'+Math.max(2,r.rate)+'%"></i></span><span class="v">'+(r.noData?'기록 없음':(r.rate+'% · '+r.n+'문항'))+'</span>';
    if(r.weak.length) h+='<span class="sub">약한 유형: '+r.weak.map(function(t){ return (t.rate<50?'<b class="red">':'<b>')+eaEsc(t.name)+' '+t.rate+'%</b>'; }).join(' · ')+'</span>';
  });
  h+='</div><div class="risk">';
  A.rows.forEach(function(r){ h+='<span class="rk'+(r.rank===1?' red':'')+'">'+r.rank+'</span><span><b>'+eaEsc(r.unit)+'</b><span class="why"> 기출 비중 '+Math.round(r.w)+'% × 오답률 '+(100-r.rate)+'%'+(r.noData?' (기록 없어 평균으로)':'')+'</span></span><span class="loss'+(r.rank===1?' red':'')+'">−'+eaFmtLoss(r.loss)+'<small>점 예상</small></span>'; });
  h+='</div>';
  h+='<div class="line"><b>한 줄 진단</b> — 지금 실력이면 이 시험 100점 만점에 <b>약 '+A.score+'점</b>. '+(A.rows[0]?('<b>'+eaEsc(A.rows[0].unit)+'</b>부터 다지면 <b class="red">+'+eaFmtLoss(A.rows[0].loss)+'점</b>이 가장 크게 움직입니다.'):'')+' <span class="tiny">(예상 실점 = 기출 비중 × 내 오답률, 근사치)</span></div>';
  if(A.my.strong.length) h+='<div class="good"><b>✅ 여기는 다시 안 봐도 됩니다</b> — '+A.my.strong.slice(0,3).map(function(t){ return eaEsc(t.name)+' '+t.rate+'%('+t.n+')'; }).join(' · ')+'</div>';
  h+='</div>';
  h+='<div class="chow"><b>이렇게 쓰세요</b> — ① 3부는 위험한 단원부터입니다. 문제 아래에 풀이가 바로 있으니 <b>종이로 가리고</b> 먼저 풉니다 ② 막히면 풀이를 보고, 「교과서」 꼬리표가 붙은 같은 유형을 이어서 풉니다 ③ 「유사유형」은 교재에서 같은 유형을 한 번 더 — ✗ 표시는 예전에 틀렸던 문제입니다 ④ 시험 전날 마지막 장만 다시 봅니다</div>';
  h+='<div class="cfoot">루멘수학 · 이 자료는 '+name+' 학생 한 사람을 위해 만들어졌습니다</div>'+pf(1)+'</div>';

  /* v19-45 (원장 지시 2026-09-25): 문항마다 «기출 / 교과서» 꼬리표를 매쓰플랫 학습지처럼 문제 바로 위에 또렷이 ·
   * 문제와 풀이를 한 쪽에 · 내 풀이 칸은 없앤다 · 교과서 문항의 정답도 바로 아래 (따로 정답 쪽을 만들지 않는다) */
  picked.forEach(function(p,ix){
    var q=p.q, b=p.book, r=null; A.rows.forEach(function(x){ if(x.unit===p.unit) r=x; });
    var sol=eaSolOf(b,q); if(sol&&sol.kind==='hs'&&!sol.html) sol=null; var num=eaNo2(ix+1);
    /* v19-58 (원장 지적 2026-09-29 「풀이 글씨가 너무 작다 · 다음 장으로 넘어가도 된다」): 풀이 그림이 있는 장도 흐르는 장 — 풀이를 칸 너비 그대로(약 10pt) 싣고, 길면 다음 쪽으로 잘라 잇는다(eaPaginate) */
    h+='<div class="sheet item '+((sol&&(sol.kind==='hs'||sol.simg||sol.aimg||sol.fix))?'flow':'one')+'"><div class="ihead"><span class="ino">'+num+'</span>'
      +'<span class="isrc">'+eaEsc(p.unit)+(r?(' · 위험 '+r.rank+'위'):'')+(q.pt?(' · '+q.pt+'점'):'')+(q.diff?(' · 난이도 '+eaDiffWord(q.diff)):'')+(q.essay?' · ✍ 서술형':'')+'</span></div>';
    var path=[q.sem,q.unit,q.mid,q.type,q.sub].filter(function(x){ return x; }).join(' › ');
    h+='<div class="srcl"><b class="tagx">기출</b>'+eaEsc(eaOrigin(b,q))+'</div>'
      +'<div class="srcl sub">'+eaEsc(b.srcName||'루멘수학 기출 자료')+(b.srcPath?(' · '+eaEsc(b.srcPath)):'')+(path?(' · '+eaEsc(path)):'')+'</div>';
    if(p.match){ var m=p.match; h+='<div class="why '+(m.rate<50?'bad':(m.rate<75?'mid':'ok'))+'"><b>내 기록</b> '+eaEsc(m.name)+' — '+m.n+'문제 중 <b>'+m.rate+'%</b>'+(p.band?(' · 이 난이도('+p.band.label+') '+p.band.n+'문제 중 <b>'+p.band.rate+'%</b>'):'')+((p.band?p.band.rate:m.rate)<50?' · 절반 넘게 틀린 유형이에요':' · 조금 더 다지면 됩니다')+(p.exact?'':' <span class="tiny">(이름으로 맞춤)</span>')+'</div>'; }
    else if(r) h+='<div class="why mid"><b>내 기록</b> '+eaEsc(r.unit)+' 단원 '+r.rate+'% — 이 유형은 아직 기록이 없어 단원 위험도로 골랐습니다</div>';
    if(sol&&sol.kind==='hs') h+='<div class="hs">'+lcRenderMath(sol.html.replace(/\s*loading="lazy"/g,''))+'</div>';
    else {
      /* v19-44: 수집기가 미리 서명해 둔 주소(imgUrl)를 먼저 쓴다 — 공개 열쇠로는 서명이 안 돼 그림이 빠지던 것 (원장 제보 2026-09-25) */
      var brq=eaBridgeQ(b,q); var img=q.imgUrl||(q.img?EA.signed[q.img]:'')||(brq&&brq.pimg)||'';   /* 기출 원본 그림 → 없으면 매쓰플랫이 맞춰 둔 같은 문제 그림 */
      /* v19-50: 한 쪽을 반으로 — 왼쪽 문제, 오른쪽 풀이. 풀이 그림은 칸 너비에 맞춰 키운다 (원장 지적 2026-09-27: 문제는 크고 해설은 안 보인다) */
      h+='<div class="two"><div class="col q"><div class="hs"><div class="qt tiny">'+eaEsc(q.type||q.unit)+(q.sub?(' · '+eaEsc(q.sub)):'')+'</div>';
      h+=img?('<div class="qimg"><img src="'+eaEsc(img)+'" alt="'+q.no+'번 문제"></div>'):'<div class="tiny">(문제 그림을 아직 못 받았습니다)</div>';
      h+='</div></div><div class="col s"><div class="solb"><div class="solh">정답 '+eaAnsHtml(q.answer||(sol&&sol.answer)||'—')+(sol?' · 풀이':'')+'</div>';
      if(sol&&sol.fix) h+='<div class="soltx">'+eaFixHtml(sol.fix)+'</div>';   /* v19-60: 다시 쓴 풀이 */
      else if(sol&&sol.bad) h+='<div class="tiny">매쓰플랫 풀이 그림의 수식이 깨져 있어 싣지 않았습니다 — 정답을 확인하고, 막히면 선생님께 물어보세요</div>';
      else if(sol&&sol.simg) h+='<div class="qimg sol"><img src="'+eaEsc(sol.simg)+'" alt="풀이"></div>';
      else if(sol&&sol.aimg) h+='<div class="qimg sol"><img src="'+eaEsc(sol.aimg)+'" alt="정답"></div>';
      else h+='<div class="tiny">풀이는 아직 준비 중입니다 — 막히면 선생님께 물어보세요</div>';
      h+='</div></div></div>';
    }
    if(p.tb&&p.tb.length){ var tbs=eaTbShort(meta.tbTitle); h+='<div class="tbk"><div class="tbh">교과서에서 같은 유형 — '+eaEsc(tbs)+' '+p.tb.map(function(t){ return t.page+'쪽'; }).join(' · ')+'</div><div class="tbg">';
      p.tb.forEach(function(t,ti){
        h+='<div class="tbq"><div class="srcl"><b class="tagx tb">교과서</b>'+eaEsc(tbs)+' '+t.page+'쪽 '+eaEsc(t.no)+'번'+(t.title?(' · '+eaEsc(t.title)):'')+(t.level?(' · 난이도 '+t.level):'')+(t.byName?' <span class="tiny">(같은 소단원에서)</span>':'')+'</div>'
          +'<div class="tbno">'+num+'-'+(ti+1)+'</div><div class="qimg"><img src="'+eaEsc(t.pimg)+'" alt=""></div>';
        (t.twins||[]).slice(0,1).forEach(function(w){ if(w.pimg) h+='<div class="srcl"><b class="tagx tb">쌍둥이</b>숫자만 다른 문제</div><div class="qimg"><img src="'+eaEsc(w.pimg)+'" alt=""></div>'; });
        h+='<div class="solb small"><b>정답</b> '+eaTbAnsHtml(t)+'</div></div>'; });
      h+='</div></div>'; }
    else if(p.match&&meta.tbTitle) h+='<div class="sim tiny">교과서: 「'+eaEsc(p.match.name)+'」 유형(매쓰플랫 번호)의 문항이 '+eaEsc(eaTbShort(meta.tbTitle))+'에는 없습니다.</div>';
    var sims=eaSimilar(stu?String(stu.lumen_rec_code):'', p, A);
    if(sims.length) h+='<div class="sim"><b>🔁 유사유형</b> — 같은 유형을 한 번 더<ul>'+sims.map(function(s){ return '<li>'+eaEsc(s.text)+(s.date?' <span class="tiny">'+eaEsc(s.date)+'</span>':'')+'</li>'; }).join('')+'</ul></div>';
    else h+='<div class="sim tiny">유사유형: 이 유형은 아직 교재에서 푼 기록이 없습니다 — 매쓰플랫에서 「'+eaEsc(p.match?p.match.name:(q.type||p.unit))+'」 유형 학습지를 배정해 주세요.</div>';
    h+=pf(ix+2)+'</div>';
  });
  h+='<div class="sheet last one"><div class="ihead"><span class="ino">시험 전날</span><span class="isrc">'+name+' · '+grade+'</span></div><div class="lh">✍️ 이 '+nq+'가지만 다시 확인하고 자면 됩니다</div><ol class="chk">';
  picked.forEach(function(p){ h+='<li><b>'+eaEsc(p.unit)+' · '+eaEsc((p.q.type||'').slice(0,34))+'</b><span>'+eaEsc(String(p.book.year)+' 기출 '+p.q.no+'번'+(p.q.title?' — '+String(p.q.title).replace(/\\\(([\s\S]*?)\\\)/g,function(m,t){ return lcTexPlain(t); }).slice(0,50):''))+'</span></li>'; });
  h+='</ol><div class="lnote">틀렸던 문제를 다시 틀리는 것이 가장 아깝습니다. 위 목록에서 <b>아직 손이 안 가는 것</b>에 동그라미를 치고, 그것부터 보세요.</div><div class="cfoot">루멘수학 · '+dstr+'</div>'+pf(NP)+'</div>';
  return h+'</div>';
}

/*__CSS__*/
/*__EACSS__*/
var EA_CSS2=''
+'.tbk{margin:8px 0 4px;border:1px solid #bbb;padding:6px 8px 2px}.tbh{font-size:11.5px;font-weight:900;margin-bottom:4px}.tbq{margin:2px 0 8px}.tbl{font-size:10.5px;color:#333;font-weight:700;margin:2px 0}.tbq .qimg img{max-height:75mm}.tba{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;font-size:12px}.tbar{padding:5px 0;border-bottom:1px solid #ddd}.tbans{font-weight:900}'
+'.src{font-size:10.5px;color:#222;border:1px solid #bbb;border-left:4px solid #000;padding:5px 8px;margin:0 0 8px;line-height:1.55}.src b{font-size:11.5px}.src .tiny{color:#555;font-weight:600}'
+'.qt{margin-bottom:4px}'
+'.ino{font-size:22px;font-weight:900;color:#555;letter-spacing:-.02em;line-height:1}'
+'.srcl{font-size:10.5px;color:#333;font-weight:600;line-height:1.6}.srcl.sub{color:#666;font-weight:500;margin-bottom:7px}'
+'.tagx{display:inline-block;border:1.5px solid #000;padding:0 6px;font-size:10px;font-weight:900;color:#000;margin-right:6px;line-height:1.6;vertical-align:1px;letter-spacing:.04em}.tagx.tb{background:#000;color:#fff}'
+'.solb{margin-top:9px;border-top:1.5px solid #000;padding-top:6px}.solh{font-size:12px;font-weight:900;margin-bottom:4px}.solb.small{border-top:1px solid #999;margin-top:5px;padding-top:4px;font-size:11.5px}.solb .qimg img{max-height:110mm}'
+'.tbno{font-size:15px;font-weight:900;color:#555;margin:2px 0}.tbq{margin:6px 0 12px}'
+'';
/* v19-50: 인쇄 창에서 한 쪽을 넘치는 장은 그 장만 줄여서(zoom) 한 쪽에 맞춘다 — 잘리지 않고, 쪽 번호도 맞는다. 그림이 다 뜬 뒤(load)와 인쇄 직전(beforeprint)에 돈다 */
function eaPaginate(){
  /* v19-58: 긴 풀이 그림을 쪽 크기로 자른다. 인쇄에서 칸 너비 = (190mm-9mm)/2 - 9mm ≈ 81.5mm 로 보고,
   * 첫 조각은 그 쪽 남은 높이, 다음 조각부터는 새 쪽(break-before) 한 쪽씩. 조각끼리 6mm 겹쳐 줄이 반쯤 잘려도 다음 쪽에 온전히 나온다.
   * 조각 높이는 aspect-ratio 로 적어 화면·인쇄 어디서나 같은 부분을 보인다. */
  function cut(){
    var MM=96/25.4, PAGE=277, SAFE=12, COLW=81.5, OV=6;
    var imgs=document.querySelectorAll('.sheet.flow .qimg.sol > img:not([data-cut])');
    for(var k=0;k<imgs.length;k++){ var img=imgs[k]; if(!img.complete||!img.naturalWidth) continue; img.setAttribute('data-cut','1');
      var nw=img.naturalWidth, nh=img.naturalHeight, mmPerPx=COLW/nw, hMM=nh*mmPerPx;
      var box=img.parentNode, sheet=box.closest('.sheet'); if(!sheet) continue;
      var topMM=(box.getBoundingClientRect().top-sheet.getBoundingClientRect().top)/MM-14;   /* 화면 장의 위 여백 14mm 빼기 */
      var first=PAGE-SAFE-Math.max(0,topMM);
      if(hMM<=first) continue;
      if(first<45) first=0;                                    /* 남은 자리가 너무 좁으면 다음 쪽부터 */
      var parts=[], y=0, step=PAGE-SAFE-8;
      if(first>0){ parts.push([0, Math.min(nh, first/mmPerPx)]); y=parts[0][1]-OV/mmPerPx; }
      while(y<nh-2){ var y1=Math.min(nh, y+step/mmPerPx); parts.push([y,y1]); if(y1>=nh) break; y=y1-OV/mmPerPx; }
      var src=img.getAttribute('src'), alt=img.getAttribute('alt')||'', h='';
      parts.forEach(function(pt,i){ var ph=pt[1]-pt[0];
        if(i>0||first===0) h+='<div class="solcont">▲ '+(i>0?'앞 쪽 풀이에서 이어집니다':'풀이')+'</div>';   /* 새 쪽의 첫 줄 — 여기서 쪽을 넘긴다 */
        h+='<div class="solcut" style="aspect-ratio:'+nw+' / '+Math.round(ph)+'"><img data-cut="1" src="'+src+'" alt="'+alt+'" style="top:'+(-pt[0]/ph*100).toFixed(4)+'%"></div>'
          +(i<parts.length-1?'<div class="solmore">▼ 풀이가 다음 쪽에 이어집니다</div>':''); });
      var wrap=document.createElement('div'); wrap.className='solcuts'; wrap.innerHTML=h; box.replaceChild(wrap, img);
      sheet.setAttribute('data-pages', String(parts.length+(first===0?1:0)));
    }
  }
  /* 학생(.bk)마다: 한 쪽 고정 장(.one)은 넘치면 그 장만 줄이고(zoom), 흐르는 장(.flow)은 높이로 쪽수를 세어 「n / N」을 다시 적는다 */
  function run(){ try{ cut(); }catch(e){ console.warn('[풀이 자르기]', e); } var H=272*96/25.4; var bks=document.querySelectorAll('.bk');
    for(var b=0;b<bks.length;b++){ var sheets=bks[b].querySelectorAll('.sheet'); var pages=[], total=0, i;
      for(i=0;i<sheets.length;i++){ var s=sheets[i]; s.style.zoom=''; var n=1;
        if(s.getAttribute('data-pages')){ n=+s.getAttribute('data-pages'); }   /* v19-58: 풀이 그림을 자른 장은 조각 수가 쪽 수 */
        else if(s.classList.contains('flow')){ n=Math.max(1,Math.ceil((s.scrollHeight-6)/H)); }
        else { var need=s.scrollHeight; if(need>H+2) s.style.zoom=String(Math.max(0.6, Math.floor(H/need*985)/1000)); }
        pages.push(n); total+=n; }
      var p=1; for(i=0;i<sheets.length;i++){ var pn=sheets[i].querySelector('.pfoot .pn'); if(pn) pn.textContent=(pages[i]>1?(p+'–'+(p+pages[i]-1)):String(p))+' / '+total; p+=pages[i]; } } }
  if(document.readyState==='complete') run(); else window.addEventListener('load',run);
  window.addEventListener('beforeprint',run); window.eaFit=run;
}
var EA_FIT_JS='('+eaPaginate.toString()+')();';
var EA_CSS3=''
/* v19-50 (원장 지적 2026-09-27): ① 문항 쪽을 왼쪽 문제 · 오른쪽 풀이로 반씩 — 풀이 그림을 칸 너비로 키운다 ② 학생마다 새 장에서 시작(두 학생이 한 장에 안 섞임) ③ 한 장 = 한 쪽으로 못 박고 학생별 쪽 번호(pfoot) ④ 맨 위 검은 이름 띠는 인쇄 안 함 */
+'.two{display:grid;grid-template-columns:1fr 1fr;gap:0 9mm;align-items:start;margin-top:4px}.two .col.s{border-left:1px solid #000;padding-left:9mm;min-width:0}.two .col.q{min-width:0}'
+'.two .qimg img{max-height:130mm;max-width:100%}.two .solb{margin-top:0;border-top:none;padding-top:0}.two .solb .qimg.sol img{width:100%;max-width:100%;max-height:none;height:auto}'
/* v19-58: 풀이 그림은 칸 너비 그대로(높이 제한 없음) · 길면 조각(.solcut)으로 잘라 다음 쪽에 잇는다 */
+'.soltx{font-size:12.5px;line-height:1.75;color:#111}.soltx p{margin:0 0 7px}.soltx .lx-blk{text-align:left;margin:4px 0 4px 8px;line-height:2.2}'
+'.qimg.sol img{max-height:none!important}.solcuts{display:block}.solcut{position:relative;width:100%;overflow:hidden;overflow:clip}.solcut img{position:absolute;left:0;width:100%!important;height:auto!important;max-height:none!important;display:block}'
+'.solmore{font-size:10px;color:#555;font-weight:800;text-align:right;margin:2px 0 0}.solcont{font-size:10px;color:#555;font-weight:800;margin:0 0 3px;break-before:page;page-break-before:always}'
+'.tbg{display:grid;grid-template-columns:1fr 1fr;gap:0 8mm;align-items:start}.tbg .tbq{min-width:0}.tbg .tbq .qimg img{max-height:55mm;max-width:100%}'
+'.pfoot{position:absolute;left:13mm;right:13mm;bottom:6mm;display:flex;justify-content:space-between;font-size:9.5px;color:#666;border-top:1px solid #ccc;padding-top:3px}'
+'.sheet{position:relative;box-sizing:border-box;padding-bottom:16mm}'
+'@media print{.sheet{width:190mm;margin:0 auto;border:none;page-break-after:always;break-after:page}.sheet.one{height:272mm;min-height:272mm;max-height:272mm;overflow:hidden;page-break-inside:avoid}.sheet.flow{height:auto;min-height:272mm;overflow:visible}'
+'.bk{page-break-before:always;break-before:page}.bk:first-of-type{page-break-before:auto;break-before:auto}.bar{display:none!important}}'
+'.qimg{margin:6px 0}.qimg img{max-width:100%;max-height:120mm;height:auto;display:block;filter:grayscale(100%)}'
+'.ans{margin-top:8px;border:1px dashed #999;padding:6px 10px}'
+'.ans summary{cursor:pointer;font-size:11.5px;font-weight:800}'
+'.ansb{font-size:12.5px;margin-top:4px}'
+'@media print{.ans{border:1px solid #999}.ans summary{display:none}.ans .ansb,.ans .qimg{display:block}}';
EA_CSS2+=EA_CSS3;   /* 인쇄 창은 EA_CSS+EA_CSS2 를 쓴다 */
/*__WIN__*/
/* 학생 여러 명 → 분석·문항·유사유형·그림 주소를 다 모아 {list, meta} */
/* ═══ 📘 교과서 문제 은행 (v19-41) — 원장 결정 2026-09-24 「기출 1 + 교과서 원문항 2 (+ 쌍둥이 1) · 옥길중 1·2·3 부터」
 * mf_textbooks = 매쓰플랫의 학생별 배정 교과서(sync/mf_textbook_map.js) · mf_textbook_<교재id> = 그 교과서의 쪽별 문항(sync/mf_textbook_bank.js)
 * 학생 기록의 유형 번호(cid)와 교과서 문항의 유형 번호가 같은 것을 고른다 — 이름 맞추기가 필요 없다.
 * 쌍둥이(twins)는 은행에 들어오면 자동으로 붙는다(매쓰플랫 요청 모양을 아직 못 알아냄 — 2026-09-24). */
function eaTbLoad(){
  if(EA.tbMap) return Promise.resolve(); var empty={ books:{}, bySchoolGrade:{}, byStudent:{} };
  if(typeof sb==='undefined'||!sb){ EA.tbMap=empty; return Promise.resolve(); }
  return sb.from('lumen_store').select('value').eq('key','mf_textbooks').then(function(r){ var v=r.data&&r.data[0]&&r.data[0].value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } EA.tbMap=v||empty; }).catch(function(){ EA.tbMap=empty; });
}
/* 그 학교·학년 학생들에게 배정된 교과서 후보 전부 (고2는 대수·미적분Ⅰ처럼 두 권 이상일 수 있다) */
function eaTbCands(school,grade){
  var T=EA.tbMap; if(!T||!T.bySchoolGrade) return []; var g=T.bySchoolGrade[eaSchoolKey(school)+'|'+grade]; if(!g||!g.books) return [];
  return Object.keys(g.books).sort(function(a,b){ return g.books[b]-g.books[a]; });
}
function eaTbBidFor(school,grade){ return eaTbCands(school,grade)[0]||null; }
/* 학생 한 명의 고른 문항들에 «유형 번호가 가장 많이 겹치는» 교과서 — 2학기 중간(미분)이면 대수가 아니라 미적분Ⅰ이 골라진다 */
function eaTbBest(bids, picked){
  var best=null, bn=-1; bids.forEach(function(b){ var bank=EA.tb[b]; if(!bank||!bank.problems) return; var have={}; bank.problems.forEach(function(q){ if(q.cid&&q.pimg) have[String(q.cid)]=1; });
    var n=0; picked.forEach(function(p){ if(p.match&&have[String(p.match.cid)]) n++; }); if(n>bn){ bn=n; best=b; } });
  return best;
}
/* 유형 번호로 못 찾을 때 — 기출 문항의 수학비서 중단원·세부유형 이름과 교과서 «쪽 제목(소단원)»을 견주어 가장 가까운 쪽의 문항을 고른다 */
function eaTbPickByName(bank, q, n, used){
  if(!bank||!bank.pages||!bank.pages.length) return []; var g=eaGrams((q.mid||'')+' '+(q.type||'')+' '+(q.unit||''));
  var scored=bank.pages.map(function(pg){ return { page:pg.page, s:eaDice(g,eaGrams(pg.title||'')) }; }).filter(function(x){ return x.s>=0.3; }).sort(function(a,b){ return b.s-a.s; });
  if(!scored.length) return []; var top=scored.slice(0,4).map(function(x){ return x.page; });
  var pool=(bank.problems||[]).filter(function(p){ return p.pimg && !used[p.id] && top.indexOf(p.page)>=0 && !/탐구|생각/.test(p.no||''); });
  var want=q.diff>=5?3:(q.diff>=3?2:1); pool.sort(function(a,b){ return Math.abs((a.level||2)-want)-Math.abs((b.level||2)-want) || top.indexOf(a.page)-top.indexOf(b.page); });
  var out=[]; pool.forEach(function(p){ if(out.length<n && !(out.length>=1 && pool.length>n && out.some(function(o){ return o.page===p.page; }))) out.push(p); });
  if(out.length<n) pool.forEach(function(p){ if(out.length<n && out.indexOf(p)<0) out.push(p); });
  out.forEach(function(p){ used[p.id]=1; }); return out.map(function(p){ var c={}; for(var k in p) c[k]=p[k]; c.byName=true; return c; });
}
function eaTbBank(bid){
  if(!bid) return Promise.resolve(null); if(EA.tb[bid]) return Promise.resolve(EA.tb[bid]);
  return sb.from('lumen_store').select('value').eq('key','mf_textbook_'+bid).then(function(r){ var v=r.data&&r.data[0]&&r.data[0].value; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } } EA.tb[bid]=v||{ problems:[] }; return EA.tb[bid]; }).catch(function(){ EA.tb[bid]={ problems:[] }; return EA.tb[bid]; });
}
function eaTbShort(title){ var m=String(title||'').match(/교과서_([^\s-]+)/); return m?(m[1]+' 교과서'):(title?String(title):'교과서'); }
/* 같은 유형 번호의 교과서 문항 n개 — 쉬운 것 하나 + 다른 쪽의 어려운 것 하나 (그림 있는 것만, 한 문제집 안에서 같은 문항 두 번 안 씀) */
function eaTbPick(bank, cid, n, used){
  if(!bank||!cid) return []; var c=String(cid);
  var pool=(bank.problems||[]).filter(function(p){ return String(p.cid)===c && p.pimg && !used[p.id]; });
  pool.sort(function(a,b){ return (a.level||0)-(b.level||0) || a.page-b.page; });
  var out=[]; if(pool.length){ out.push(pool[0]); for(var i=pool.length-1;i>0&&out.length<n;i--){ if(pool[i].page!==pool[0].page){ out.push(pool[i]); break; } } for(var j=1;j<pool.length&&out.length<n;j++){ if(out.indexOf(pool[j])<0) out.push(pool[j]); } }
  out.forEach(function(p){ used[p.id]=1; }); return out;
}
/* 학생 한 명: 가장 맞는 교과서를 고르고, 문항마다 교과서 원문항 2개를 붙인다 (번호로 → 안 되면 소단원 이름으로) */
function eaTbAttach(x, bids){
  var bid=eaTbBest(bids, x.picked); var bank=bid?EA.tb[bid]:null; var used={};
  x.tbTitle=bank?(bank.title||''):''; x.tbBid=bid||'';
  x.picked.forEach(function(p){ p.tb=[]; if(!bank) return; if(p.match) p.tb=eaTbPick(bank,p.match.cid,2,used); if(!p.tb.length) p.tb=eaTbPickByName(bank,p.q,2,used); });
}
function eaBuild(codes){
  var school=EA.school, grade=EA.grade, term=EA.term;
  var books=eaBooksOf(school,grade,term); if(!books.length) return Promise.reject(new Error('이 시험의 기출 자료가 없습니다'));
  var n=Math.max(3,Math.min(20,Number(EA.n)||10));
  var date=''; try{ date=eaExamDate(school); }catch(e){}
  var hsCodes={}; books.forEach(function(b){ var c=eaHsFor(b); if(c) hsCodes[c]=1; });
  return Promise.all(Object.keys(hsCodes).map(eaBodyLoad)).then(function(){
    var list=[];
    codes.forEach(function(c){ var stu=eaStuByCode(c); if(!stu) return; var A=eaAnalyze(c,school,grade,term); var picked=eaPick(A,n); list.push({ stu:stu, code:String(c), A:A, picked:picked }); });
    var imgs={}; list.forEach(function(x){ x.picked.forEach(function(p){ if(p.q.img) imgs[p.q.img]=1; }); });
    var pr=list.map(function(x){ var cids={}; x.picked.forEach(function(p){ if(p.match) cids[String(p.match.cid)]=1; var r=null; x.A.rows.forEach(function(y){ if(y.unit===p.unit) r=y; }); if(r) r.weak.slice(0,2).forEach(function(w){ cids[String(w.cid)]=1; }); }); return eaFetchRecs(x.code, Object.keys(cids)); });
    return Promise.all(pr.concat([eaSign(Object.keys(imgs))])).then(function(){ return eaTbLoad().then(function(){ return Promise.all(eaTbCands(school,grade).map(eaTbBank)); }); }).then(function(){
      var bids=eaTbCands(school,grade);
      list.forEach(function(x){ eaTbAttach(x, bids); });
      return { list:list, meta:{ school:school, schoolName:(books[0]&&books[0].schoolName)||school, grade:grade, term:term, date:date } }; });
  });
}
function eaExamDate(school){
  try{ var xt=(typeof XT!=='undefined'&&XT&&XT.data)?XT.data:null; var dd=(xt&&xt.ddays)||[]; var k=eaSchoolKey(school);
    var hit=dd.filter(function(d){ return eaSchoolKey(d.school)===k; }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
    var today=new Date(Date.now()+9*3600000).toISOString().slice(0,10); var nx=hit.filter(function(d){ return String(d.date)>=today; })[0];
    return nx?(String(nx.date).slice(5).replace('-','/')+(nx.label?(' '+nx.label):'')):''; }catch(e){ return ''; }
}

/* ═══ 학생용 기출 분석 인쇄물 — A안 「한 장 요약」 · B안 「연도 히트맵」 (v19-41)
 * 원장 결정 2026-09-24: 시안 https://claude.ai/artifact/8wVBEEk7XWZPiMH3GNfsuu 의 A·B 둘 다 쓴다.
 * 검정 + 붉은 강조만 (흑백 인쇄 그대로). 숫자는 📚 기출 분석 화면과 같은 eaMatrix/eaRepeats 에서 나온다. */
var EA_CSS3=''
+'@page{size:A4 portrait;margin:10mm 9mm}'
+'body{margin:0;background:#e9e9e9;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;color:#141414;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
+'.sbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #ccc;padding:8px 14px;display:flex;gap:10px;align-items:center;font-size:13px;z-index:5}.sbar button{margin-left:auto;font-size:13px;font-weight:800;padding:6px 14px;border:1px solid #333;border-radius:6px;background:#fff;cursor:pointer}'
+'.ss{width:192mm;min-height:277mm;box-sizing:border-box;margin:10px auto;padding:9mm 10mm 8mm;background:#fff;display:flex;flex-direction:column;gap:12px;page-break-after:always;break-after:page}'
+'.ss:last-child{page-break-after:auto;break-after:auto}'
+'.sh{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #141414;padding-bottom:8px}'
+'.sh .k{font-size:10.5px;font-weight:700;letter-spacing:.08em;color:#666}.sh .t{font-size:22px;font-weight:900;line-height:1.15;letter-spacing:-.02em}.sh .r{font-size:10px;color:#666;text-align:right;line-height:1.5}'
+'.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.tile{padding:10px 12px;border:1px solid #dcdcdc;border-radius:6px}.tile.red{border-color:#b3261e}'
+'.tile .k{font-size:10px;font-weight:700;color:#666}.tile.red .k{color:#b3261e}.tile .v{font-size:28px;font-weight:900;line-height:1.05;margin:2px 0}.tile.red .v{color:#b3261e}.tile .v small{font-size:13px;font-weight:700;margin-left:3px;color:#141414}.tile .d{font-size:10px;color:#666}'
+'.sec{display:flex;flex-direction:column;gap:6px}.sec .st{display:flex;align-items:baseline;gap:8px}.sec .st b{font-size:13.5px;font-weight:900}.sec .st span{font-size:10px;color:#666}'
+'.bar{display:flex;align-items:center;gap:8px}.bar .n{width:118px;font-size:11.5px;font-weight:700;text-align:right}.bar .tr{flex-grow:1;height:12px;background:#f2f2f2;border-radius:0 4px 4px 0}.bar .fl{height:12px;background:#4a4a4a;border-radius:0 4px 4px 0}.bar.red .fl{background:#b3261e}.bar .p{width:40px;font-size:11.5px;font-weight:700;font-variant-numeric:tabular-nums}.bar.red .p{color:#b3261e;font-weight:900}.bar.out .n,.bar.out .p{color:#8a8a8a;font-weight:500}.bar.out .fl{background:#b8b8b8}'
+'.reps{display:grid;grid-template-columns:1fr auto auto;gap:5px 14px;align-items:center;font-size:11.5px}.reps .nm{font-weight:700}.reps .nm span{font-weight:500;color:#666}.reps .dots{display:flex;gap:4px}.reps .dots i{width:10px;height:10px;border-radius:50%;background:#141414;display:block}.reps .dots i.o{background:#fff;border:1.5px solid #b8b8b8;box-sizing:border-box}.reps .yr{font-weight:700;white-space:nowrap}.reps .yr.red{color:#b3261e;font-weight:900}'
+'.map{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px}.map .c{display:flex;flex-direction:column;align-items:center;gap:1px;padding:5px 0 4px;border:1.5px solid transparent;border-radius:4px;background:#f2f2f2}.map .c b{font-size:13px;font-weight:900}.map .c s{text-decoration:none;font-size:8px;color:#444}'
+'.map .c.m{background:#d6d6d6;border-color:#d6d6d6}.map .c.l{border-color:#f2f2f2}.map .c.h{background:#8a8a8a;color:#fff;border-color:#b3261e}.map .c.h s{color:#fff}.map .c.x{background:#3a3a3a;color:#fff;border-color:#b3261e}.map .c.x s{color:#fff}.map .c.xx{background:#141414;color:#fff;border-color:#b3261e}.map .c.xx s{color:#fff}'
+'.leg{display:flex;gap:12px;align-items:center;font-size:10px;color:#444;flex-wrap:wrap}.leg i{display:inline-block;width:11px;height:11px;border-radius:2px;vertical-align:-2px;margin-right:4px}.leg .ml{margin-left:auto;font-weight:700}'
+'.box{margin-top:auto;padding:11px 14px;border-left:4px solid #b3261e;background:#faf7f6}.box b{font-size:12.5px;font-weight:900;display:block;margin-bottom:3px}.box p{margin:0;font-size:11.5px;line-height:1.55}'
+'.hm{display:grid;gap:3px;font-size:11.5px;font-variant-numeric:tabular-nums}.hm .hh{padding:5px 3px;font-size:10px;font-weight:700;color:#666;text-align:center}.hm .hh.l{text-align:left}.hm .hh.red{color:#b3261e}.hm .hu{padding:8px 3px;font-weight:700}.hm .hu.out{font-weight:500;color:#8a8a8a}'
+'.hm .hc{padding:8px 0;text-align:center;border-radius:3px}.hm .hc.z{border:1px solid #e6e6e6;color:#b8b8b8}.hm .hc.s1{background:#f2f2f2}.hm .hc.s2{background:#d9d9d9}.hm .hc.s3{background:#a9a9a9}.hm .hc.s4{background:#5c5c5c;color:#fff;font-weight:700}.hm .ha{padding:8px 0;text-align:center;font-weight:900}.hm .ha.red{color:#b3261e}'
+'.dy{display:flex;align-items:center;gap:8px;font-size:11px;font-variant-numeric:tabular-nums}.dy .y{width:36px;font-weight:700;color:#666}.dy .y.red{color:#b3261e;font-weight:900}.dy .st{flex-grow:1;display:flex;gap:2px;height:14px}.dy .st i{display:block;height:14px}.dy .st i.l{background:#f2f2f2}.dy .st i.m{background:#d0d0d0}.dy .st i.h{background:#8a8a8a}.dy .st i.x{background:#2b2b2b}.dy .cnt{width:46px;font-weight:700}.dy .cnt.red{color:#b3261e;font-weight:900}'
+'.chips{display:flex;flex-wrap:wrap;gap:5px;font-size:11px}.chips span{padding:5px 9px;border-radius:20px;border:1px solid #dcdcdc;color:#444}.chips span em{font-style:normal;color:#8a8a8a}.chips span.mid{border-color:#b8b8b8;font-weight:500;color:#141414}.chips span.mid em{color:#666}.chips span.hi{background:#141414;color:#fff;border-color:#141414;font-weight:700}.chips span.hi em{color:#ccc}'
+'.foot{display:flex;justify-content:space-between;font-size:10px;color:#666;border-top:1px solid #dcdcdc;padding-top:8px}'
+'@media print{body{background:#fff}.sbar{display:none}.ss{margin:0;width:auto;min-height:0;padding:0}}';

/* 세부유형 이름에서 번호와 괄호를 뗀다: 「사잇값 정리1 (기본)」 → 「사잇값 정리」 */
/* 받침에 따라 조사: eaJosa('삼각비','은','는') → 삼각비는 */
function eaJosa(w,a,b){ var c=String(w||'').replace(/[^가-힣]+$/,''); if(!c) return a; var code=c.charCodeAt(c.length-1)-0xAC00; return (code%28)?a:b; }
function eaTypeName(t){ return String(t||'').replace(/\s*\(.*$/,'').replace(/\d+$/,'').trim(); }
function eaAbbr(u){ return String(u||'').split(/\s+/).map(function(w){ return w.replace(/(의|와|과)$/,'').slice(0,2); }).slice(0,2).join(''); }
function eaBandCls(d){ return d>=7?'xx':(d>=6?'x':(d>=5?'h':(d>=3?'m':'l'))); }
function eaPct(r,y){ var c=r.cells[y.year]; return c?Math.round(c.pct):0; }
/* 시험 이름 한 줄: 「소사고 2학년 2학기 중간고사 · 수학Ⅱ」 */
function eaExamTitle(M, meta){
  var g=String(meta.grade||'').replace(/^(초|중|고)(\d)$/,'$2학년'); var subj='';
  var latest=M.books[M.books.length-1]; if(latest&&latest.title){ var m=String(latest.title).match(/(중등수학\d[상하]?|공통수학\d|수학[ⅠⅡ12상하]?|대수|미적분\d?|확률과통계|기하)\s*$/); if(m) subj=m[1]; }
  return eaEsc(meta.schoolName||meta.school)+' '+g+' '+eaEsc((meta.term||'').replace(/(중간|기말)$/,'$1고사'))+(subj?(' · '+eaEsc(subj)):'');
}
function eaSheetHead(M, meta, kicker){
  var yrs=M.years.map(function(y){ return y.year; }); var nq=0; M.books.forEach(function(b){ nq+=b.qs.length; });
  return '<div class="sh"><div><div class="k">'+eaEsc(kicker)+' · '+eaEsc(yrs[0])+'~'+eaEsc(yrs[yrs.length-1])+' · '+yrs.length+'개년 '+nq+'문항</div><div class="t">'+eaExamTitle(M,meta)+'</div></div><div class="r">루멘수학<br>기출 자료</div></div>';
}
/* A안 — 한 장 요약 */
function eaSheetA(M, meta){
  var rows=M.rows.filter(function(r){ return r.inRange; }).sort(function(a,b){ return b.w-a.w; });
  var outRows=M.rows.filter(function(r){ return !r.inRange && r.w>=1; }).sort(function(a,b){ return b.w-a.w; });
  var latest=M.books[M.books.length-1], first=M.books[0]; var rep=eaRepeats(M);
  var hardN=latest.qs.filter(function(q){ return q.diff>=5; }).length, hardFirst=first.qs.filter(function(q){ return q.diff>=5; }).length;
  var repPt=0; rep.forEach(function(r){ repPt+=r.pt; }); repPt=Math.round(repPt);
  var maxW=rows.length?rows[0].w:1;
  var h='<div class="ss">'+eaSheetHead(M,meta,'기출 한 장');
  h+='<div class="tiles"><div class="tile"><div class="k">시험 범위</div><div class="v">'+rows.length+'<small>단원</small></div><div class="d">'+eaEsc(rows.length?(rows[0].unit+(rows.length>1?'부터 '+rows[rows.length-1].unit+'까지':'')):'')+'</div></div>'
    +'<div class="tile"><div class="k">해마다 다시 나온 유형</div><div class="v">'+rep.length+'<small>개</small></div><div class="d">'+(latest.noPt?('올해 '+rep.length+'문항어치'):('올해 배점으로 '+repPt+'점어치'))+'</div></div>'
    +'<div class="tile red"><div class="k">'+eaEsc(latest.year)+'년 상 난이도</div><div class="v">'+hardN+'<small>/ '+latest.qs.length+'문항</small></div><div class="d">'+(M.books.length>1?(eaEsc(first.year)+'년엔 '+hardFirst+'문항 → '+(hardN>hardFirst?'해마다 늘어난다':(hardN<hardFirst?'줄었다':'비슷하다'))):'난이도 5 이상')+'</div></div></div>';
  h+='<div class="sec"><div class="st"><b>1 · 어느 단원이 무거운가</b><span>'+M.years.length+'년 평균 배점 비중 · 붉은색 = 가장 무거운 두 단원</span></div>';
  rows.forEach(function(r,i){ h+='<div class="bar'+(i<2?' red':'')+'"><div class="n">'+eaEsc(r.unit)+'</div><div class="tr"><div class="fl" style="width:'+Math.round(r.w/maxW*100)+'%"></div></div><div class="p">'+Math.round(r.w)+'%</div></div>'; });
  outRows.slice(0,1).forEach(function(r){ h+='<div class="bar out"><div class="n">'+eaEsc(r.unit)+'</div><div class="tr"><div class="fl" style="width:'+Math.max(2,Math.round(r.w/maxW*100))+'%"></div></div><div class="p">'+Math.round(r.w)+'%</div></div>'; });
  h+='</div>';
  h+='<div class="sec"><div class="st"><b>2 · 해마다 다시 나오는 유형</b><span>검은 점 = 그 해에 나옴 · '+eaEsc(M.years[0].year)+' → '+eaEsc(latest.year)+'</span></div><div class="reps">';
  var top=rep.slice(0,6), topPt=0;
  top.forEach(function(r){ topPt+=r.pt; var all=r.years.length===M.years.length;
    h+='<div class="nm">'+eaEsc(r.q.type)+' <span>· '+eaEsc(r.unit)+(r.count>1?(' · 올해 '+r.count+'문항'):'')+'</span></div><div class="dots">'+M.years.map(function(y){ return '<i'+(r.years.indexOf(y.year)>=0?'':' class="o"')+'></i>'; }).join('')+'</div><div class="yr'+(all?' red':'')+'">'+(all?(M.years.length>=3?(M.years.length+'년 연속'):'두 해 모두'):(r.years.length+'년'))+'</div>'; });
  h+='</div>'+(rep.length>6?('<div style="font-size:10px;color:#666">나머지 '+(rep.length-6)+'개 유형은 뒷장 표에 있습니다. 여기 '+top.length+'개만 확실히 잡아도 올해 배점 '+Math.round(topPt)+'점입니다.</div>'):'')+'</div>';
  var qs=latest.qs.slice().sort(function(a,b){ return a.no-b.no; }); var n=qs.length, from=0;
  /* 「N번부터 어렵다」: 그 번호부터 끝까지 상(5 이상)이 70% 넘는 첫 자리 (뒤 3문항 이상) */
  for(var k=1;k<n;k++){ var rest=qs.slice(k); var hard=rest.filter(function(q){ return q.diff>=5; }).length; if(rest.length>=3 && hard/rest.length>=0.7){ from=k; break; } }
  var tailHard=0, tailPt=0; qs.slice(from).forEach(function(q){ if(q.diff>=5) tailHard++; tailPt+=q.pt; });
  h+='<div class="sec"><div class="st"><b>3 · '+eaEsc(latest.year)+'년 시험지는 이렇게 생겼다</b><span>번호 순서 · 칸 색 = 난이도 · 붉은 테두리 = 상(5 이상)</span></div><div class="map">';
  qs.forEach(function(q){ h+='<div class="c '+eaBandCls(q.diff)+'"><b>'+q.no+'</b><s>'+eaEsc(eaAbbr(q.unit))+'</s></div>'; });
  h+='</div><div class="leg"><span><i style="background:#f2f2f2"></i>하 1~2</span><span><i style="background:#d6d6d6"></i>중 3~4</span><span><i style="background:#8a8a8a"></i>상 5</span><span><i style="background:#3a3a3a"></i>상 6</span><span><i style="background:#141414"></i>최상 7~9</span>'
    +(from>0&&tailHard>=2?('<span class="ml">'+qs[from].no+'번부터 어렵다 · 뒤 '+(n-from)+'문항 중 '+tailHard+'문항이 상'+(latest.noPt?'':(', '+eaPt(tailPt)+'점'))+'</span>'):(hardN?('<span class="ml">상 난이도 '+hardN+'문항이 고르게 섞여 있다</span>'):''))+'</div></div>';
  var easyFirst=qs.filter(function(q,i){ return i<Math.max(3,Math.floor(n/4)) && q.diff<=4; }).length;
  var top2=rows.slice(0,2); var share2=Math.round(top2.reduce(function(s,r){ return s+r.w; },0));
  var advice=(top2.length?(top2.map(function(r){ return r.unit; }).join(' · ')+(top2.length>1?', 두 단원이':' 단원이')+' 시험의 '+(share2>=45?'절반':share2+'%')+'이다. '):'')
    +(top.length?(top.slice(0,2).map(function(r){ var nm=eaTypeName(r.q.type); return nm+eaJosa(nm,'은','는')+' '+(r.years.length===M.years.length?(M.years.length>=3?(M.years.length+'년 연속'):'두 해 모두'):(M.years.length+'년 중 '+r.years.length+'번')); }).join(', ')+' 나왔으니 눈 감고 풀 만큼 익힌다. '):'')
    +(easyFirst>=3?('1~'+qs[easyFirst-1].no+'번은 '+Math.round(easyFirst*1.5)+'분 안에 끝내고, '):'')+(from>0&&tailHard>=2?('남는 시간을 '+qs[from].no+'번 뒤의 상 문항에 쓴다.'):'남는 시간을 상 문항에 쓴다.');
  h+='<div class="box"><b>그래서 이렇게 준비한다</b><p>'+eaEsc(advice)+'</p></div></div>';
  return h;
}
/* B안 — 연도 히트맵 */
function eaSheetB(M, meta){
  var rows=M.rows.slice().sort(function(a,b){ return (b.inRange?1:0)-(a.inRange?1:0) || b.w-a.w; }).filter(function(r){ return r.inRange || r.w>=1; });
  var latest=M.books[M.books.length-1], rep=eaRepeats(M), Y=M.years;
  var h='<div class="ss">'+eaSheetHead(M,meta,Y.length+'년을 한 표에');
  h+='<div class="sec"><div class="st"><b>1 · 단원 × 연도 — 배점 비중 (%)</b><span>진할수록 그 해에 무거웠던 단원'+(Y.some(function(y){ return y.noPt; })?' · 배점 없는 해는 문항 수 비율':'')+'</span></div>';
  h+='<div class="hm" style="grid-template-columns:140px repeat('+Y.length+',minmax(0,1fr)) 60px"><div class="hh l">단원</div>'+Y.map(function(y,i){ return '<div class="hh'+(i===Y.length-1?' red':'')+'">'+eaEsc(y.year)+'</div>'; }).join('')+'<div class="hh">'+Y.length+'년 평균</div>';
  var top2={}; rows.filter(function(r){ return r.inRange; }).slice(0,2).forEach(function(r){ top2[r.unit]=1; });
  rows.forEach(function(r){ h+='<div class="hu'+(r.inRange?'':' out')+'">'+eaEsc(r.unit)+(r.inRange?'':' <span style="font-size:9px">(범위 밖)</span>')+'</div>';
    Y.forEach(function(y,i){ var v=eaPct(r,y); var cls=v<=0?'z':(v<10?'s1':(v<20?'s2':(v<30?'s3':'s4'))); h+='<div class="hc '+cls+'"'+(i===Y.length-1&&v>0?' style="font-weight:700"':'')+'>'+(v>0?v:'—')+'</div>'; });
    h+='<div class="ha'+(top2[r.unit]?' red':'')+'">'+Math.round(r.w)+'%</div>'; });
  h+='</div><div class="leg"><span>비중</span><span><i style="background:#f2f2f2"></i>1~9</span><span><i style="background:#d9d9d9"></i>10~19</span><span><i style="background:#a9a9a9"></i>20~29</span><span><i style="background:#5c5c5c"></i>30 이상</span>'
    +(rows.length>1?('<span class="ml">위 두 줄이 늘 어둡다 = '+eaEsc(eaAbbr(rows[0].unit))+'·'+eaEsc(eaAbbr(rows[1].unit))+'이 매년 무겁다</span>'):'')+'</div></div>';
  h+='<div class="sec"><div class="st"><b>2 · 난이도 구성 — 해마다 어떻게 변했나</b><span>한 줄 = 그 해 문항 전부 · 오른쪽 = 상 이상 문항 수</span></div>';
  var bands=M.books.map(function(b){ var c={l:0,m:0,h:0,x:0}; b.qs.forEach(function(q){ var d=q.diff||0; if(d>=7) c.x++; else if(d>=5) c.h++; else if(d>=3) c.m++; else c.l++; }); return { year:b.year, n:b.qs.length, c:c }; });
  bands.forEach(function(b,i){ var last=i===bands.length-1; var seg=function(k){ return b.c[k]?('<i class="'+k+'" style="width:'+(b.c[k]/b.n*100)+'%"></i>'):''; };
    h+='<div class="dy"><div class="y'+(last?' red':'')+'">'+eaEsc(b.year)+'</div><div class="st">'+seg('l')+seg('m')+seg('h')+seg('x')+'</div><div class="cnt'+(last?' red':'')+'">'+(b.c.h+b.c.x)+'문항</div></div>'; });
  h+='<div class="leg"><span><i style="background:#f2f2f2"></i>하 1~2</span><span><i style="background:#d0d0d0"></i>중 3~4</span><span><i style="background:#8a8a8a"></i>상 5~6</span><span><i style="background:#2b2b2b"></i>최상 7~9</span></div></div>';
  h+='<div class="sec"><div class="st"><b>3 · 다시 나온 유형 '+rep.length+'개</b><span>숫자 = '+Y.length+'년 중 나온 해 · 진한 칸 = 4년 이상</span></div><div class="chips">';
  rep.forEach(function(r){ var k=r.years.length>=4?'hi':(r.years.length>=3?'mid':''); h+='<span class="'+k+'">'+eaEsc(eaTypeName(r.q.type))+' <em>'+r.years.length+'년'+(r.count>1?(' · 올해 '+r.count+'문항'):'')+'</em></span>'; });
  h+='</div></div>';
  var inR=rows.filter(function(r){ return r.inRange; }); var say='';
  if(inR.length){ var t=inR[0]; var mn=Math.min.apply(null,Y.map(function(y){ return eaPct(t,y); })); if(mn>=10) say+=eaEsc(t.unit)+eaJosa(t.unit,'은','는')+' 어느 해에도 '+mn+'% 아래로 내려간 적이 없다. '; else say+=eaEsc(t.unit)+eaJosa(t.unit,'이','가')+' '+Y.length+'년 평균으로 가장 무겁다('+Math.round(t.w)+'%). ';
    var vol=null, vv=0; inR.forEach(function(r){ var vs=Y.map(function(y){ return eaPct(r,y); }); var d=Math.max.apply(null,vs)-Math.min.apply(null,vs); if(d>vv){ vv=d; vol=r; } });
    if(vol&&vv>=15){ var vs2=Y.map(function(y){ return eaPct(vol,y); }); say+=eaEsc(vol.unit)+eaJosa(vol.unit,'은','는')+' 해에 따라 '+Math.min.apply(null,vs2)+'%에서 '+Math.max.apply(null,vs2)+'%까지 흔들리니 범위 공지를 꼭 확인한다. '; } }
  if(bands.length>1){ var f=bands[0], l=bands[bands.length-1]; say+='상 난이도는 '+eaEsc(f.year)+'년 '+(f.c.h+f.c.x)+'문항에서 '+eaEsc(l.year)+'년 '+(l.c.h+l.c.x)+'문항으로 '+((l.c.h+l.c.x)>(f.c.h+f.c.x)?'늘었다':((l.c.h+l.c.x)<(f.c.h+f.c.x)?'줄었다':'같다'))+'.'; }
  h+='<div class="box"><b>표가 말하는 것</b><p>'+say+'</p></div></div>';
  return h;
}
/* 학생용 인쇄물 한 벌(HTML 문서) — 화면 미리보기(iframe)와 새 창이 같은 것을 쓴다 */
function eaSheetDoc(kind){
  var M=eaMatrix(EA.school,EA.grade,EA.term); if(!M.books.length) return '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:30px;color:#555">이 시험의 기출 자료가 없습니다</body></html>';
  var meta={ school:EA.school, schoolName:(M.books[0]&&M.books[0].schoolName)||EA.school, grade:EA.grade, term:EA.term };
  var body=''; if(kind!=='B') body+=eaSheetA(M,meta); if(kind!=='A') body+=eaSheetB(M,meta);
  var title=eaExamTitle(M,meta).replace(/<[^>]+>/g,'');
  return '<!DOCTYPE html><html lang="ko" data-theme="light"><head><meta charset="UTF-8"><title>기출 한 장 — '+eaEsc(title)+'</title><style>'+EA_CSS3+'</style></head><body>'
    +'<div class="sbar"><b>학생용 기출 분석</b><span>'+eaEsc(title)+' · '+(kind==='AB'?'A 한 장 요약 + B 연도 히트맵':(kind==='A'?'A 한 장 요약':'B 연도 히트맵'))+'</span><button onclick="window.print()">🖨️ 인쇄</button></div>'+body+'</body></html>';
}
window.eaPrintStudent=function(kind){
  var M=eaMatrix(EA.school,EA.grade,EA.term); if(!M.books.length){ alert('이 시험의 기출 자료가 없습니다'); return; }
  var w=eaOpenWin(); if(!w) return; var html=eaSheetDoc(kind||'AB');
  w.document.open(); w.document.write(html); w.document.close();
};
window.eaPrev=function(kind){ EA.prev=(EA.prev===kind?'':kind); render(); };
window.eaPrevPrint=function(){ var f=document.getElementById('eaPrevFrame'); if(!f||!f.contentWindow){ plToast('먼저 미리보기를 여세요'); return; } try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){ eaPrintStudent(EA.prev||'AB'); } };

/*__CHIPS__*/
/* ① 학교·학년·시험 고르기 — 두 화면이 같이 쓴다 */
function eaExamPicker(){
  var books=eaBooks(); var schools=[], grades=[], terms=[];
  books.forEach(function(b){ if(schools.indexOf(b.school)<0) schools.push(b.school); });
  if(schools.indexOf(EA.school)<0) EA.school=schools[0]||'';
  books.filter(function(b){ return b.school===EA.school; }).forEach(function(b){ if(grades.indexOf(b.grade)<0) grades.push(b.grade); }); grades.sort();
  if(grades.indexOf(EA.grade)<0) EA.grade=grades[0]||'';
  books.filter(function(b){ return b.school===EA.school && b.grade===EA.grade; }).forEach(function(b){ if(terms.indexOf(b.term)<0) terms.push(b.term); }); terms.sort();
  if(terms.indexOf(EA.term)<0) EA.term=terms[0]||'';
  var h='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">① 어느 시험 <span style="font-weight:700;color:#94a3b8">— 기출 자료(주 1회 새벽 갱신) + 해설집</span></div>';
  if(!books.length) return h+'<div style="font-size:12px;color:#94a3b8;font-weight:700">'+(EA.msLoaded?'아직 받은 기출이 없습니다. GitHub 「기출 DB 수집」을 한 번 돌려 주세요.':'불러오는 중…')+'</div></div>';
  h+='<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">';
  schools.forEach(function(s){ h+=eaChip(eaEsc(s), EA.school===s, "eaSet('school','"+eaEsc(s).replace(/'/g,"\\'")+"')"); });
  h+='<span style="width:10px"></span>'; grades.forEach(function(g){ h+=eaChip(eaEsc(g), EA.grade===g, "eaSet('grade','"+eaEsc(g)+"')"); });
  h+='<span style="width:10px"></span>'; terms.forEach(function(t){ h+=eaChip(eaEsc(t), EA.term===t, "eaSet('term','"+eaEsc(t)+"')"); });
  h+='</div>';
  var mine=eaBooksOf(EA.school,EA.grade,EA.term);
  h+='<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:8px">기출 '+mine.length+'개년: '+mine.map(function(b){ return eaEsc(b.year)+'('+b.qs.length+'문항'+(b.src==='hs'?' 해설집':'')+(b.src==='ms'&&EA.bridge[String(b.id)]&&(EA.bridge[String(b.id)].problems||[]).length?' 🔗':'')+')'; }).join(' · ')
    +'<span style="color:#94a3b8"> · 🔗 = 매쓰플랫 유형 다리 연결됨</span></div>';
  return h+'</div>';
}
window.eaSet=function(k,v){ EA[k]=v; if(k==='school'){ EA.grade=''; EA.term=''; } if(k==='grade') EA.term=''; EA.stu=''; EA.last=null; EA.openUnit=''; render(); };

/* ═══ 화면 A · 📚 기출 분석 ═══ */
function rExamAnal(){
  eaKick();
  var h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:21px;font-weight:900;color:#0d2240;letter-spacing:-.02em">📚 기출 분석</div>'
    +'<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:2px">기출 자료로 «연도 × 단원 × 배점» · 반복 유형 · 난이도 · 서술형 자리 — 시험 범위는 여기서 확인합니다</div></div>'
    +'<div style="margin-left:auto"></div>'+eaBtn('🔄 새로고침','EA.kicked=false;HS.loaded=false;EA.msLoaded=false;EA.cfgLoaded=false;eaKick();render()')+'</div>';
  if(EA.err) h+='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 13px;color:#b91c1c;font-size:12px;font-weight:800;margin-bottom:10px">'+eaEsc(EA.err)+'</div>';
  h+=eaExamPicker();
  if(!EA.school||!EA.grade||!EA.term) return h+'</div>';
  var M=eaMatrix(EA.school,EA.grade,EA.term);
  var scoped=M.books.slice().reverse().filter(function(b){ return b.scopes&&b.scopes.length; })[0];
  /* v19-45: 시험 범위를 맨 위로 (원장 지시 2026-09-25 「범위는 맨 위에 올라가서 보기 편하게」) */
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">② 시험 범위 <span style="font-weight:700;color:#94a3b8">— 이번 시험에 드는 단원만 켜 두세요. 아래 표와 시험 대비는 켜진 단원만 셉니다</span></div><div style="display:flex;gap:6px;flex-wrap:wrap">';
  M.rows.forEach(function(r){ h+=eaChip((r.inRange?'☑ ':'☐ ')+eaEsc(r.unit), r.inRange, "eaRange('"+eaEsc(r.unit).replace(/'/g,"\\'")+"')"); });
  h+='</div><div style="display:flex;gap:8px;align-items:center;margin-top:11px">'+eaBtn(EA.saving?'⏳ 저장 중…':'💾 범위 저장','eaCfgSave()','pri')+'<span style="font-size:11.5px;color:#94a3b8;font-weight:700">저장하면 다음에도 그대로 씁니다</span></div></div>';
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">③ 연도 × 단원 배점 <span style="font-weight:700;color:#94a3b8">— 단원을 누르면 그 해 문항 · 비중 = 100점 기준 평균</span></div>';
  h+='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px"><tr style="background:#f7f9fc"><th style="text-align:left;padding:7px 8px;color:#64748b;font-size:10.5px">단원</th><th style="text-align:left;padding:7px 8px;color:#64748b;font-size:10.5px">범위</th>';
  M.years.forEach(function(y){ h+='<th style="text-align:right;padding:7px 8px;color:#64748b;font-size:10.5px;white-space:nowrap">'+eaEsc(y.year)+(y.bridged?' 🔗':'')+'<br><span style="font-weight:700">'+(y.noPt?(y.n+'문항'):(eaPt(y.total)+'점'))+'</span></th>'; });
  h+='<th style="text-align:right;padding:7px 8px;color:#64748b;font-size:10.5px">비중</th><th style="text-align:left;padding:7px 8px;color:#64748b;font-size:10.5px">서술·최상</th></tr>';
  var maxW=0; M.rows.forEach(function(r){ if(r.w>maxW) maxW=r.w; });
  M.rows.slice().sort(function(a,b){ return (b.inRange?1:0)-(a.inRange?1:0) || b.w-a.w; }).forEach(function(r){
    var es=0, ki=0; M.years.forEach(function(y){ var c=r.cells[y.year]; if(c){ es+=c.essay; ki+=c.killer; } }); var open=EA.openUnit===r.unit;
    h+='<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;'+(r.inRange?'':'color:#94a3b8')+'" onclick="eaOpen(\''+eaEsc(r.unit).replace(/'/g,"\\'")+'\')"><td style="padding:7px 8px;font-weight:900;white-space:nowrap">'+(open?'▾ ':'▸ ')+eaEsc(r.unit)+'</td>'
      +'<td style="padding:7px 8px;font-size:11px;font-weight:800;color:'+(r.inRange?'#0f8a4e':'#94a3b8')+'">'+(r.inRange?'범위':'밖')+'</td>';
    M.years.forEach(function(y){ var c=r.cells[y.year]; h+='<td style="padding:7px 8px;text-align:right;white-space:nowrap;font-weight:800">'+(c?((y.noPt?(c.n+'문항'):(eaPt(c.pt)+'점'))+'<span style="color:#94a3b8;font-weight:700;font-size:10.5px"> '+c.n+'</span>'):'<span style="color:#cbd5e1">—</span>')+'</td>'; });
    h+='<td style="padding:7px 8px;text-align:right;white-space:nowrap"><span style="display:inline-block;height:9px;width:'+Math.round(maxW?r.w/maxW*70:0)+'px;background:#0d2240;vertical-align:middle;margin-right:6px"></span><b>'+Math.round(r.w)+'%</b></td><td style="padding:7px 8px;font-size:11.5px;font-weight:700;color:#64748b">'+(es?('✍ '+es+' '):'')+(ki?('☠ '+ki):'')+'</td></tr>';
    if(open){ h+='<tr><td colspan="'+(4+M.years.length)+'" style="padding:4px 8px 10px 26px;background:#fbfcfe">'; M.years.forEach(function(y){ var c=r.cells[y.year]; if(!c) return; h+='<div style="font-size:12px;margin:3px 0"><b style="color:#0d2240">'+eaEsc(y.year)+'</b> — '+c.types.sort(function(a,b){ return a.no-b.no; }).map(function(t){ return t.no+'번 '+eaEsc(t.type)+(t.pt?'('+eaPt(t.pt)+')':'')+(t.essay?' ✍':'')+(t.diff>=EA_KILL?' ☠':''); }).join(' · ')+'</div>'; }); h+='</td></tr>'; }
  });
  h+='</table></div>';
  h+='<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:8px">'+(scoped?('시험 범위 ('+eaEsc(scoped.year)+'): '+scoped.scopes.map(eaEsc).join(' · ')):'수학비서에 시험 범위 표기가 없어 최근 해 시험에 나온 단원을 범위로 봅니다')
    +' · 매쓰플랫 다리 '+M.nBridge+'/'+M.nMs+'개년'+(M.nMs&&M.nBridge<M.nMs?' <span style="color:#b45309">— 다리 없는 해는 3부 문항에서 「이름으로 맞춤」이 됩니다 (새벽 수집이 채웁니다)</span>':'')+'</div></div>';
  h+=eaExtraSections(M);
  return h+'</div>';
}
function eaExtraSections(M){
  var h='', rep=eaRepeats(M);
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">매년 반복 출제된 세부유형 <span style="font-weight:700;color:#94a3b8">— 두 해 이상 같은 유형 · 올해도 나올 가능성이 가장 높은 목록</span></div>';
  if(M.books.length<2) h+='<div style="font-size:12px;color:#94a3b8;font-weight:700">기출이 한 해뿐이라 아직 «반복»을 셀 수 없습니다.</div>';
  else if(!rep.length) h+='<div style="font-size:12px;color:#94a3b8;font-weight:700">두 해 모두 나온 유형을 찾지 못했습니다.</div>';
  else { var sumPt=0; rep.forEach(function(r){ sumPt+=r.pt; }); sumPt=Math.round(sumPt*10)/10;
    h+='<div style="font-size:12px;color:#0d2240;font-weight:800;margin-bottom:6px">반복 유형 '+rep.length+'개 — 최근 해 배점 합 <b>'+sumPt+'점</b>. 여기부터 잡으면 가장 효율이 좋습니다.</div><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f7f9fc"><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">#</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">세부유형</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">단원</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">나온 해</th><th style="text-align:right;padding:6px 7px;color:#64748b;font-size:10.5px">배점</th></tr>';
    rep.forEach(function(r,i){ h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 7px;color:#94a3b8;font-weight:800">'+(i+1)+'</td><td style="padding:6px 7px;font-weight:800">'+eaEsc(r.q.type)+(r.count>1?' <span style="color:#64748b">×'+r.count+'</span>':'')+(r.q.essay?' <span style="color:#b91c1c">✍ 서술</span>':'')+'</td><td style="padding:6px 7px;color:#475569">'+eaEsc(r.unit)+'</td><td style="padding:6px 7px;color:#475569">'+r.years.map(eaEsc).join(' · ')+'</td><td style="padding:6px 7px;text-align:right;font-weight:800">'+(r.pt?(eaPt(r.pt)+'점'):'-')+'</td></tr>'; });
    h+='</table>'; }
  h+='</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1.4fr;gap:12px">';
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">난이도 분포 <span style="font-weight:700;color:#94a3b8">— 난이도 1~9</span></div><table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f7f9fc"><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">난이도</th>'+M.years.map(function(y){ return '<th style="text-align:right;padding:6px 7px;color:#64748b;font-size:10.5px">'+eaEsc(y.year)+'</th>'; }).join('')+'</tr>';
  [['하 (1~2)',function(d){ return d>=1&&d<=2; }],['중 (3~4)',function(d){ return d>=3&&d<=4; }],['상 (5~6)',function(d){ return d>=5&&d<=6; }],['최상 (7~9)',function(d){ return d>=7; }]].forEach(function(b){ var any=false,row=''; M.books.forEach(function(bk){ var n=bk.qs.filter(function(q){ return b[1](q.diff); }).length; if(n) any=true; row+='<td style="padding:6px 7px;text-align:right;font-weight:800">'+(n||'<span style="color:#cbd5e1">·</span>')+'</td>'; }); if(any) h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 7px;font-weight:800">'+b[0]+'</td>'+row+'</tr>'; });
  h+='</table></div>';
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">고난도 · 서술형 자리 <span style="font-weight:700;color:#94a3b8">— 상·최상 난이도 · 서술형</span></div>';
  var hard=[]; M.books.forEach(function(b){ b.qs.forEach(function(q){ if(q.diff>=5||q.essay) hard.push({ b:b, q:q }); }); });
  if(!hard.length) h+='<div style="font-size:12px;color:#94a3b8;font-weight:700">표시된 문항이 없습니다.</div>';
  else { h+='<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f7f9fc"><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">연도</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">번호</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">단원 · 세부유형</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">표시</th></tr>';
    hard.forEach(function(x){ var tags=[]; if(x.q.essay) tags.push('✍ 서술'); if(x.q.diff>=EA_KILL) tags.push('☠ '+x.q.diff+'/9'); else if(x.q.diff>=5) tags.push('상 '+x.q.diff+'/9');
      h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 7px;color:#475569">'+eaEsc(x.b.year)+'</td><td style="padding:6px 7px;font-weight:900">'+x.q.no+'번'+(x.q.pt?(' <span style="color:#94a3b8;font-weight:700">'+x.q.pt+'점</span>'):'')+'</td><td style="padding:6px 7px">'+eaEsc(x.q.unit)+' <span style="color:#64748b">· '+eaEsc(x.q.type||'')+'</span></td><td style="padding:6px 7px;font-weight:800">'+tags.join(' ')+'</td></tr>'; });
    h+='</table>'; }
  h+='</div></div>';
  /* v19-45: 학생용 인쇄물을 화면 안에서 미리 보고 바로 인쇄 (원장 지시 2026-09-25 「미리보기 화면과 인쇄 버튼을 추가」) */
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">학생용 인쇄물 <span style="font-weight:700;color:#94a3b8">— 미리 보고 인쇄합니다 · 새 창으로도 열 수 있습니다</span></div>';
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'+eaChip('👁 A 한 장 요약', EA.prev==='A', "eaPrev('A')")+eaChip('👁 B 연도 히트맵', EA.prev==='B', "eaPrev('B')")+eaChip('👁 A+B 같이', EA.prev==='AB', "eaPrev('AB')")
    +'<span style="width:6px"></span>'+(EA.prev?eaBtn('🖨 인쇄','eaPrevPrint()','pri'):'')+eaBtn('↗ 새 창',"eaPrintStudent(EA.prev||'AB')")+eaBtn('📋 분석 글 복사 (PPT 재료)','eaCopyPpt()')+eaBtn('⬇ 글 파일로 저장','eaSavePpt()')+'</div>';
  if(EA.prev) h+='<iframe id="eaPrevFrame" title="학생용 인쇄물 미리보기" style="display:block;width:100%;height:1180px;border:1px solid #dbe2ee;border-radius:10px;margin-top:10px;background:#e9e9e9" srcdoc="'+eaEsc(eaSheetDoc(EA.prev))+'"></iframe>';
  h+='<div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:8px">「분석 글」은 이 화면의 숫자를 글로 정리해 줍니다. PPT·분석집은 앱 안에서 만들지 않고 이 글을 Claude 채팅에 붙여 만듭니다.</div></div>';
  return h;
}
function eaPptText(M){
  var L=[]; var title=EA.school+' '+EA.grade+' '+EA.term;
  L.push('# '+title+' 수학 출제경향 — 루멘수학'); L.push('근거: 루멘수학 기출 자료 '+M.years.map(function(y){ return y.year+'('+y.n+'문항'+(y.noPt?'':'·'+eaPt(y.total)+'점')+')'; }).join(', ')+' · '+new Date(Date.now()+9*3600000).toISOString().slice(0,10));
  L.push(''); L.push('## 시험 범위'); L.push(M.range.join(' · '));
  L.push(''); L.push('## 연도 × 단원 배점 (비중 = 100점 기준 평균)'); L.push('| 단원 | '+M.years.map(function(y){ return y.year; }).join(' | ')+' | 비중 |'); L.push('|---|'+M.years.map(function(){ return '---:|'; }).join('')+'---:|');
  M.rows.slice().sort(function(a,b){ return b.w-a.w; }).forEach(function(r){ L.push('| '+r.unit+(r.inRange?'':' (범위 밖)')+' | '+M.years.map(function(y){ var c=r.cells[y.year]; return c?((y.noPt?(c.n+'문항'):(eaPt(c.pt)+'점'))+(c.essay?' ✍'+c.essay:'')):'—'; }).join(' | ')+' | '+Math.round(r.w)+'% |'); });
  var rep=eaRepeats(M); L.push(''); L.push('## 매년 반복 출제된 세부유형 ('+rep.length+'개)');
  rep.forEach(function(r,i){ L.push((i+1)+'. '+r.q.type+' — '+r.unit+' · '+r.years.join('·')+(r.pt?(' · '+eaPt(r.pt)+'점'+(r.count>1?' ×'+r.count:'')):'')+(r.q.essay?' · 서술형':'')); });
  L.push(''); L.push('## 고난도 · 서술형 자리');
  M.books.forEach(function(b){ b.qs.forEach(function(q){ if(q.diff>=5||q.essay) L.push('- '+b.year+' '+q.no+'번 '+q.unit+' · '+q.type+(q.pt?(' · '+q.pt+'점'):'')+(q.essay?' · 서술형':'')+(q.diff?(' · 난이도 '+eaDiffWord(q.diff)):'')); }); });
  L.push(''); L.push('## 문항 목록');
  M.books.forEach(function(b){ L.push('### '+b.year+' ('+b.qs.length+'문항'+(b.noPt?'':' · '+eaPt(b.total)+'점')+')'); b.qs.forEach(function(q){ L.push('- '+q.no+'번 · '+q.unit+' › '+(q.mid||'')+' › '+q.type+(q.sub?(' › '+q.sub):'')+(q.pt?(' · '+q.pt+'점'):'')+(q.diff?(' · '+eaDiffWord(q.diff)):'')+(q.essay?' · 서술형':'')+(q.answer?(' · 정답 '+q.answer):'')); }); });
  return L.join('\n');
}
window.eaCopyPpt=function(){
  var txt=eaPptText(eaMatrix(EA.school,EA.grade,EA.term));
  function fb(){ var ta=document.createElement('textarea'); ta.value=txt; ta.style.cssText='position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); plToast('복사했습니다'); }catch(e){ prompt('아래 글을 복사하세요', txt.slice(0,2000)); } ta.remove(); }
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ plToast('복사했습니다 — 채팅에 붙여 넣으세요'); }).catch(fb); else fb();
};
window.eaSavePpt=function(){ var txt=eaPptText(eaMatrix(EA.school,EA.grade,EA.term)); var a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/markdown;charset=utf-8'})); a.download='기출분석_'+EA.school+'_'+EA.grade+'_'+EA.term.replace(/\s/g,'')+'.md'; document.body.appendChild(a); a.click(); a.remove(); };
window.eaOpen=function(u){ EA.openUnit=(EA.openUnit===u?'':u); render(); };
window.eaRange=function(u){ var key=eaExamKey(EA.school,EA.grade,EA.term); var cur=eaRangeOf(EA.school,EA.grade,EA.term); var i=cur.indexOf(u); if(i>=0) cur.splice(i,1); else cur.push(u); EA.cfg.ranges[key]=cur; EA.last=null; render(); };

/* ═══ 화면 B · 🎯 시험 대비 ═══ */
function eaFits(st){ return eaGradeOf(st)===EA.grade && (!EA.school || eaSchoolKey(st.school)===EA.school); }
function eaStuList(){ return eaActive().filter(function(s){ if(EA.cls && (s.group||'')!==EA.cls) return false; if(!EA.all && !eaFits(s)) return false; return true; }); }
function rLastCheck(){
  eaKick();
  var h='<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">';
  h+='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px"><div><div style="font-size:21px;font-weight:900;color:#0d2240;letter-spacing:-.02em">🎯 시험 대비</div>'
    +'<div style="font-size:11.5px;color:#64748b;font-weight:700;margin-top:2px">시험을 고르면 학생이 따라옵니다 — 내 기록 → 기출과 겹치기 → 위험 문항(그림·풀이) + 유사유형을 한 벌로 인쇄 (검정 + 붉은 강조)</div></div>'
    +'<div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">'+eaBtn('📚 기출 분석·범위',"VIEW='examanal';render()")+eaBtn('🔄 새로고침','EA.kicked=false;HS.loaded=false;EA.msLoaded=false;EA.cfgLoaded=false;eaKick();render()')+'</div></div>';
  if(EA.err) h+='<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:10px 13px;color:#b91c1c;font-size:12px;font-weight:800;margin-bottom:10px">'+eaEsc(EA.err)+'</div>';
  if(EA.busy) h+='<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:10px 13px;color:#1d4ed8;font-size:12px;font-weight:800;margin-bottom:10px">'+eaEsc(EA.busy)+'</div>';
  h+=eaExamPicker();
  if(!EA.school||!EA.grade||!EA.term) return h+'</div>';
  var range=eaRangeOf(EA.school,EA.grade,EA.term);
  h+='<div style="font-size:11.5px;color:#64748b;font-weight:700;margin:-6px 0 12px 4px">시험 범위: '+(range.length?range.map(eaEsc).join(' · '):'(최근 해 시험에 나온 단원)')+' — 바꾸려면 「📚 기출 분석·범위」</div>';
  var act=eaActive(), seen={}, gs=[]; act.forEach(function(s){ var g=s.group||''; if(g&&!seen[g]){ seen[g]=1; gs.push(g); } });
  var list=eaStuList(); var hidden=act.filter(function(s){ return (!EA.cls || (s.group||'')===EA.cls) && !eaFits(s); }).length;
  h+='<div style="'+eaCard()+'"><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:7px">② 학생 <span style="font-weight:700;color:#94a3b8">— '+eaEsc(EA.school)+' '+eaEsc(EA.grade)+' 학생이 자동으로 옵니다</span></div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">'+eaChip('전체 반', !EA.cls, "eaCls('')"); gs.forEach(function(g){ h+=eaChip(eaEsc(g), EA.cls===g, "eaCls('"+eaEsc(g).replace(/'/g,"\\'")+"')"); });
  h+='</div><div style="display:flex;gap:5px;flex-wrap:wrap">'; list.forEach(function(s){ var c=String(s.lumen_rec_code); h+=eaChip(eaEsc(s.name), EA.stu===c, "eaStu('"+eaEsc(c)+"')"); }); h+='</div>';
  if(hidden) h+='<div style="margin-top:9px;font-size:11.5px;color:#64748b;font-weight:700;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span>학교·학년이 다른 '+hidden+'명은 숨겼습니다.</span>'+eaChip(EA.all?'맞는 학생만 보기':'그래도 전원 보기', EA.all, 'eaAll()')+'</div>';
  if(!list.length) h+='<div style="margin-top:9px;font-size:12px;color:#b45309;font-weight:800">이 학교·학년 학생이 없습니다.</div>';
  h+='</div>';
  var per=(Number(EA.n)||10)*2+3;
  h+='<div style="'+eaCard()+'"><div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap"><label style="font-size:11px;font-weight:800;color:#64748b">③ 문항 수<input type="number" min="3" max="20" value="'+(EA.n)+'" onchange="eaN(this.value)" style="display:block;width:96px;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:12.5px;padding:7px 9px;border:1.5px solid #e6eaf1;border-radius:9px"></label><div style="display:flex;gap:7px;flex-wrap:wrap">';
  if(EA.stu) h+=eaBtn('🔎 미리 보기','eaPreview()')+eaBtn('🖨️ 이 학생 인쇄','eaPrintOne()','pri');
  if(list.length) h+=eaBtn('👥 '+(EA.cls||'전체')+' 이어서 인쇄 ('+list.length+'명 · 약 '+(per*list.length)+'쪽)','eaPrintClass()','blue');
  h+='</div></div><div style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-top:9px;line-height:1.7">내 기록은 <b>유형 성취도</b>(매쓰플랫 채점, 최근 8주) · 기출 문항은 <b>매쓰플랫 다리(🔗)</b>가 있으면 유형 번호로 정확히, 없으면 이름으로 맞춥니다 · 문항 그림은 기출 원본(해설집이 있으면 해설집 풀이)</div></div>';
  if(EA.last && EA.last.code===EA.stu){
    var x=EA.last, A=x.A;
    h+='<div style="'+eaCard()+'"><div style="font-size:15px;font-weight:900;color:#0d2240">'+eaEsc(x.stu.name)+' — 예상 <b style="font-size:19px">'+A.score+'점</b> <span style="font-size:11.5px;color:#64748b;font-weight:700">(100점 기준 · 기출 비중 × 내 오답률 · 근사치)</span></div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px"><div><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:6px">내가 푼 문제 — 범위 단원</div>';
    A.rows.slice().sort(function(a,b){ return b.w-a.w; }).forEach(function(r){
      h+='<div style="display:grid;grid-template-columns:120px 1fr auto;gap:8px;align-items:center;font-size:12px;margin:3px 0"><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+eaEsc(r.how)+'">'+eaEsc(r.unit)+'</b><span style="height:10px;background:#eef2f7;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:'+Math.max(2,r.rate)+'%;background:'+(r.rate<50?'#b91c1c':'#0d2240')+'"></i></span><span style="white-space:nowrap;font-weight:700;color:#475569">'+(r.noData?'기록 없음':(r.rate+'% · '+r.n))+'</span></div>';
      if(r.weak.length) h+='<div style="font-size:11px;color:#64748b;margin:0 0 4px 6px">약한 유형: '+r.weak.map(function(t){ return '<b style="color:'+(t.rate<50?'#b91c1c':'#b45309')+'">'+eaEsc(t.name)+' '+t.rate+'%</b>'; }).join(' · ')+'</div>';
    });
    h+='</div><div><div style="font-size:11px;font-weight:900;color:#64748b;margin-bottom:6px">기출과 겹치기 — 예상 실점</div>';
    A.rows.forEach(function(r){ h+='<div style="display:flex;gap:9px;align-items:baseline;font-size:12.5px;margin:4px 0;padding:6px 9px;background:'+(r.rank===1?'#fef2f2':'#f8fafc')+';border-radius:9px"><b style="font-size:17px;color:'+(r.rank===1?'#b91c1c':'#0d2240')+'">'+r.rank+'</b><span style="flex:1"><b>'+eaEsc(r.unit)+'</b><span style="color:#64748b;font-size:11px"> 비중 '+Math.round(r.w)+'% × 오답 '+(100-r.rate)+'%'+(r.how?(' · '+eaEsc(r.how)):'')+'</span></span><b style="white-space:nowrap">−'+eaFmtLoss(r.loss)+'점</b></div>'; });
    h+='</div></div>';
    var nm=0, ne=0; x.picked.forEach(function(p){ if(p.match) nm++; if(p.exact) ne++; });
    h+='<div style="font-size:11px;font-weight:900;color:#64748b;margin:12px 0 6px">위험 순서로 고른 '+x.picked.length+'문항 <span style="font-weight:700;color:#94a3b8">— 약한 유형과 맞은 문항 '+nm+'개 (유형 번호로 정확히 '+ne+') · 풀이 있는 문항 '+x.picked.filter(function(p){ return p.sol; }).length+'개를 먼저 골랐습니다 · 유사유형·교과서 문항은 인쇄물에 붙습니다</span></div>';
    h+='<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f7f9fc"><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">#</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">기출</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">단원 · 세부유형</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">왜</th><th style="text-align:left;padding:6px 7px;color:#64748b;font-size:10.5px">풀이</th><th style="text-align:right;padding:6px 7px;color:#64748b;font-size:10.5px">배점</th></tr>';
    x.picked.forEach(function(p,i){ var m=p.match; h+='<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 7px;color:#94a3b8;font-weight:800">'+(i+1)+'</td><td style="padding:6px 7px;font-weight:900;color:#0d2240;white-space:nowrap">'+eaEsc(p.book.year)+' '+p.q.no+'번'+(p.q.essay?' ✍':'')+(p.q.diff>=EA_KILL?' ☠':'')+'</td><td style="padding:6px 7px;font-weight:700">'+eaEsc(p.unit)+' <span style="color:#64748b">· '+eaEsc((p.q.type||'').slice(0,36))+'</span></td><td style="padding:6px 7px;font-weight:700;color:'+(m?(m.rate<50?'#b91c1c':'#b45309'):'#94a3b8')+'">'+(m?(eaEsc(m.name)+' '+m.rate+'%'+(p.band?(' <span style="color:#64748b">· '+p.band.label+' '+p.band.rate+'%</span>'):'')+(p.exact?' 🔗':'')):'단원 위험도')+'</td><td style="padding:6px 7px;font-weight:700;color:'+(p.sol?'#0f8a4e':'#b45309')+'">'+(p.sol?(p.sol.kind==='hs'?'✓ 해설집':'✓ 매쓰플랫 풀이'):'정답만')+'</td><td style="padding:6px 7px;text-align:right;font-weight:800">'+(p.q.pt?(p.q.pt+'점'):'-')+'</td></tr>'; });
    h+='</table></div>';
  }
  return h+'</div>';
}
window.eaCls=function(g){ EA.cls=g; EA.stu=''; EA.last=null; render(); };
window.eaAll=function(){ EA.all=!EA.all; EA.stu=''; EA.last=null; render(); };
window.eaStu=function(c){ EA.stu=(EA.stu===c?'':c); EA.last=null; render(); };
window.eaN=function(v){ EA.n=Math.max(3,Math.min(20,Number(v)||10)); EA.last=null; render(); };
window.eaPreview=function(){ if(!EA.stu) return; var A=eaAnalyze(EA.stu,EA.school,EA.grade,EA.term); var picked=eaPick(A,Math.max(3,Math.min(20,Number(EA.n)||10))); EA.last={ code:EA.stu, stu:eaStuByCode(EA.stu), A:A, picked:picked }; render(); };
window.eaPrintOne=function(){
  if(!EA.stu){ plToast('학생을 먼저 고르세요'); return; } var w=eaOpenWin(); if(!w) return;
  EA.busy='인쇄물을 만드는 중… (해설·그림·교재 기록을 읽습니다)'; render();
  eaBuild([EA.stu]).then(function(b){ EA.busy=''; render(); eaFillWin(w,b.list,b.meta); }).catch(function(e){ EA.busy=''; render(); try{ w.close(); }catch(x){} alert('만들지 못했습니다: '+((e&&e.message)||e)); });
};
window.eaPrintClass=function(){
  var list=eaStuList(); if(!list.length){ plToast('학생이 없습니다'); return; } var per=(Number(EA.n)||10)*2+3;
  if(!confirm(list.length+'명 것을 이어서 뽑습니다.\n\n한 사람당 약 '+(Number(EA.n)||10)+'문항 · '+per+'쪽\n모두 합쳐 약 '+(per*list.length)+'쪽 (양면 '+Math.ceil(per*list.length/2)+'장)\n\n계속할까요?')) return;
  var w=eaOpenWin(); if(!w) return; EA.busy=list.length+'명 인쇄물을 만드는 중…'; render();
  eaBuild(list.map(function(s){ return String(s.lumen_rec_code); })).then(function(b){ EA.busy=''; render(); eaFillWin(w,b.list,b.meta); }).catch(function(e){ EA.busy=''; render(); try{ w.close(); }catch(x){} alert('만들지 못했습니다: '+((e&&e.message)||e)); });
};

/* v19-60: 인터넷 없는 수식 그리기(lcTex*)에 기호 더하기 — 다시 쓴 풀이(mf_sol_fix)에 나오는 것들 */
(function(){
  if(typeof LC_SYM==='undefined') return;
  var add={ in:'∈', notin:'∉', ni:'∋', cup:'∪', cap:'∩', subset:'⊂', subseteq:'⊆', supset:'⊃', emptyset:'∅', varnothing:'∅',
    Delta:'Δ', delta:'δ', lambda:'λ', mu:'μ', sigma:'σ', Sigma:'Σ', phi:'φ', varphi:'φ', epsilon:'ε', varepsilon:'ε', rho:'ρ', tau:'τ',
    sum:'∑', int:'∫', prod:'∏', partial:'∂', nabla:'∇', forall:'∀', exists:'∃', because:'∵', neg:'¬', land:'∧', lor:'∨',
    leftarrow:'←', Leftarrow:'⇐', mapsto:'↦', ll:'≪', gg:'≫', sim:'∼', simeq:'≃', cong:'≅', propto:'∝', star:'⋆', bullet:'•',
    vert:'|', mid:'|', lbrace:'{', rbrace:'}', langle:'⟨', rangle:'⟩', ldots:'…', vdots:'⋮', ddots:'⋱', circledcirc:'⊚' };
  for(var k in add) if(LC_SYM[k]===undefined) LC_SYM[k]=add[k];
  ['ln','sec','csc','cot','exp','log','sin','cos','tan'].forEach(function(f){ if(LC_FN.indexOf(f)<0) LC_FN.push(f); });
  ['displaystyle','textstyle','limits','nolimits','scriptstyle'].forEach(function(n){ LC_SPACE[n]=''; });
  if(LC_REL.indexOf('∈')<0) LC_REL+='∈∉⊂⊆∼≃≅';
  if(typeof lcTexCmd==='function' && !lcTexCmd._v60){
    var base=lcTexCmd;
    lcTexCmd=function(s, i, name, upright){
      if(name==='boxed'){ var a=lcTexOne(s,i,upright); return { html:'<span style="border:1px solid #000;padding:0 3px">'+a.html+'</span>', i:a.i }; }
      return base(s, i, name, upright);
    };
    lcTexCmd._v60=true;
  }
})();
