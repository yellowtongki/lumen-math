/* ═══════════════════════════════════════════════════════════════════
 * v19-94·95: 📝 백지테스트 2판 — «과정·소단원 고르기 · A4 미리보기 · 문항 편집 · 3부 교과서 문항 · 채점용 답지»
 *   원장 결정 2026-10-10: 「1·2단계 추천대로, 3부는 교과서 문항으로. 개념 백지가 중요하다 — 소단원까지로 다시 만들자.
 *   내가 채점할 수 있는 답지도 만들자.」 (시안 docs/mockup_blank_test_v2.html)
 *
 *  [왜] 중3이 공통수학(상)을 나갈 차례인데 단원 목록이 학생 학년(중3)으로만 걸러졌다(btUnitOpts). 유형DB(mf_typedb)에는
 *       공통수학1·2·대수… 까지 대단원→중단원→소단원→유형이 다 있다. 비상교육 공통수학1 교과서 600문항도 은행(mf_textbook_<교재>)에 있다.
 *  [무엇]
 *   · 과정 칩(중1-1 … 공통수학1 … 기하) → 대단원 → 중단원 안의 소단원 칩(여러 개). 학생 학년은 기본값일 뿐.
 *   · AI 에 고른 소단원과 그 유형 이름을 그대로 준다. 문항마다 소단원 표시(s).
 *   · 오른쪽에 A4 미리보기가 늘 떠 있고 글을 고치면 바로 바뀐다. 인쇄는 그 모양 그대로(🖨).
 *   · 문항마다 🔄 이 문항만 다시(AI 1문항) · + AI 로 2개 더 · + 직접 · ▲▼ · ✕.
 *   · 3부 = 교과서 문항(그림): 과정에 맞는 교과서 은행에서 고른 소단원의 문항을 2단으로. 「🔄 다른 문항」으로 바꿈. AI 창작은 선택.
 *   · 🔑 채점용 답지: 1부 모범답 + 3부 교과서 정답(글·그림) 한 장.
 *  [그대로] 2부(틀린 문제 다시 풀기)·보관함·보드 카드·반 전체(1부·3부 같고 2부만 학생마다)·폰 화면.
 *  이 부품은 base 의 rBtMake · rBtDraft · btPrompt · btParse · btGen · btCfg · btAdd · btPrint · btAnswers 를 덮어쓴다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
BT.cfg.course=BT.cfg.course||''; BT.cfg.big=BT.cfg.big||''; BT.cfg.subs=BT.cfg.subs||[]; BT.cfg.p3mode=BT.cfg.p3mode||'tb';
BT.tb=BT.tb||{ bid:'', title:'', bank:null, loading:false, course:'' };
BT.reBusy=BT.reBusy||{};
var BT2_COURSE_ORDER=['중1-1','중1-2','중2-1','중2-2','중3-1','중3-2','공통수학1','공통수학2','대수','미적분Ⅰ','확률과통계','미적분Ⅱ','기하'];

/* ── 유형DB 나무: 과정 → 대단원 → 중단원 → 소단원 → 유형 ── */
function bt2Grades(){ var A=window.MF_TYPEDB; return (A&&Array.isArray(A.grades))?A.grades:[]; }
function bt2Courses(stu){
  var gs=bt2Grades().map(function(G){ return String(G.g||''); }).filter(function(g){ return g; });
  var elem=/초등/.test(String((stu&&stu.grade)||''));
  var out=gs.filter(function(g){ return elem?true:!/^초/.test(g); });
  out.sort(function(a,b){ var ia=BT2_COURSE_ORDER.indexOf(a), ib=BT2_COURSE_ORDER.indexOf(b); if(ia<0) ia=99; if(ib<0) ib=99; return ia-ib||a.localeCompare(b); });
  return out;
}
function bt2DefaultCourse(stu){
  var g=String((stu&&stu.grade)||''); var m=g.match(/(초|중|고)[^0-9]*(\d)/);
  if(!m) return '중1-1';
  if(m[1]==='고') return m[2]==='1'?'공통수학1':'대수';
  if(m[1]==='중'&&m[2]==='3') return '공통수학1';      // ★ v19-95 원장 지시 2026-10-10: 중3 기본은 공통수학1 (중3-1·중3-2 칩은 그대로 옆에 있다)
  var sem=(new Date().getMonth()+1)>=8?'2':'1';
  return m[1]+m[2]+'-'+sem;
}
function bt2Tree(course){ var G=bt2Grades().filter(function(x){ return String(x.g)===String(course); })[0]; return (G&&G.b)||[]; }
function bt2Big(course,big){ var bs=bt2Tree(course); return bs.filter(function(b){ return String(b.n)===String(big); })[0]||bs[0]||null; }
function bt2SubKey(m,s){ return String(m)+'|'+String(s); }
/* 고른 소단원들 → [{m, s, t:[유형…]}] */
function bt2Picked(){
  var B=bt2Big(BT.cfg.course, BT.cfg.big); if(!B) return [];
  var out=[]; (B.m||[]).forEach(function(m){ (m.s||[]).forEach(function(s){ if(BT.cfg.subs.indexOf(bt2SubKey(m.n,s.n))>=0) out.push({ m:String(m.n), s:String(s.n), t:(s.t||[]).map(String) }); }); });
  return out;
}
function bt2EnsureCfg(stu){
  var cs=bt2Courses(stu); if(!cs.length) return false;
  if(cs.indexOf(BT.cfg.course)<0){ var d=bt2DefaultCourse(stu); BT.cfg.course=cs.indexOf(d)>=0?d:cs[0]; BT.cfg.big=''; BT.cfg.subs=[]; }
  var bs=bt2Tree(BT.cfg.course); if(!bs.length) return false;
  if(!bs.some(function(b){ return String(b.n)===BT.cfg.big; })){ BT.cfg.big=String(bs[0].n); BT.cfg.subs=[]; }
  if(!BT.cfg.subs.length){ var B=bt2Big(BT.cfg.course,BT.cfg.big); var m0=B&&B.m&&B.m[0]; if(m0) (m0.s||[]).forEach(function(s){ BT.cfg.subs.push(bt2SubKey(m0.n,s.n)); }); }
  return true;
}
window.bt2Course=function(c){ BT.cfg.course=String(c); BT.cfg.big=''; BT.cfg.subs=[]; BT.draft=null; BT.tb={ bid:'', title:'', bank:null, loading:false, course:'' }; render(); };
/* 과정이 같은데 은행이 비었으면(옛 과정 요청이 겹쳤던 경우) 한 번 더 받는다 */
function bt2TbReady(){ return BT.tb.course===BT.cfg.course&&!BT.tb.loading&&(BT.tb.bank||BT.tb.bid==='-'); }
window.bt2BigSet=function(b){ BT.cfg.big=String(b); BT.cfg.subs=[]; BT.draft=null; render(); };
window.bt2SubTog=function(k){ var i=BT.cfg.subs.indexOf(k); if(i>=0) BT.cfg.subs.splice(i,1); else BT.cfg.subs.push(k); render(); };
window.bt2MidTog=function(mn){
  var B=bt2Big(BT.cfg.course,BT.cfg.big); var m=(B&&B.m||[]).filter(function(x){ return String(x.n)===String(mn); })[0]; if(!m) return;
  var keys=(m.s||[]).map(function(s){ return bt2SubKey(m.n,s.n); }); var all=keys.every(function(k){ return BT.cfg.subs.indexOf(k)>=0; });
  BT.cfg.subs=BT.cfg.subs.filter(function(k){ return keys.indexOf(k)<0; }); if(!all) BT.cfg.subs=BT.cfg.subs.concat(keys); render();
};
function bt2SubsLabel(){ var p=bt2Picked(); return p.map(function(x){ return x.s; }).join(' · '); }
function bt2UnitLabel(){ return BT.cfg.course+' · '+BT.cfg.big; }

/* ── 교과서: 과정에 맞는 은행 ── */
function bt2TbCands(course, code){
  var T=(typeof EA!=='undefined'&&EA.tbMap)||null; if(!T||!T.books) return [];
  var want=String(course||''); var m=want.match(/^(초|중)(\d)-\d$/); var cands=[];
  Object.keys(T.books).forEach(function(b){ var info=T.books[b]; if(!info||info.type!=='SCHOOL') return; var g=String(info.grade||''), ft=String(info.fulltitle||info.title||'');
    var ok=false; if(m){ ok=(g===m[2])&&(new RegExp((m[1]==='초'?'초등수학':'중등수학')+m[2]).test(ft)); } else ok=(g===want)||(ft.indexOf(want)>=0&&!/^\d$/.test(g));
    if(ok) cands.push(String(b)); });
  var st=btStuByCode(code); var sid=null; try{ sid=(typeof bpSidOf==='function')?bpSidOf(st):null; }catch(e){}
  var mine=(sid&&T.byStudent&&T.byStudent[sid]&&T.byStudent[sid].books)||[];
  cands.sort(function(a,b){ return (mine.indexOf(b)>=0?1:0)-(mine.indexOf(a)>=0?1:0); });
  return cands;
}
function bt2TbLoad(code){
  if(BT.tb.loading) return Promise.resolve();
  if(BT.tb.course===BT.cfg.course&&(BT.tb.bank||BT.tb.bid==='-')) return Promise.resolve();
  var course=BT.cfg.course;                       // 과정을 바꾸는 사이에 늦게 끝난 옛 요청이 덮어쓰지 않게 — 과정이 같을 때만 쓴다
  BT.tb.loading=true; BT.tb.course=course;
  var pre=(typeof eaTbLoad==='function')?eaTbLoad():Promise.resolve();
  return pre.then(function(){ if(BT.cfg.course!==course) return null; var c=bt2TbCands(course, code); if(!c.length){ BT.tb.bid='-'; BT.tb.bank=null; BT.tb.title=''; return null; } BT.tb.bid=c[0]; var T=EA.tbMap.books[c[0]]||{}; BT.tb.title=T.fulltitle||T.title||''; return eaTbBank(c[0]); })
    .then(function(bank){ if(BT.cfg.course!==course) return; BT.tb.bank=bank||null; BT.tb.loading=false; if(btPainting()) render(); })
    .catch(function(){ if(BT.cfg.course!==course) return; BT.tb.loading=false; BT.tb.bank=null; if(btPainting()) render(); });
}
/* 고른 소단원의 교과서 문항 — 유형 이름이 맞는 것 먼저, 없으면 쪽 제목이 가까운 것 */
function bt2TbPool(sub){
  var bank=BT.tb.bank; if(!bank||!bank.problems) return [];
  var pageTitle={}; (bank.pages||[]).forEach(function(pg){ pageTitle[String(pg.page)]=String(pg.title||''); });
  var tnames={}; (sub.t||[]).forEach(function(t){ tnames[eaTypeName(t)]=1; });
  var gS=eaGrams(sub.s), gM=eaGrams(sub.m);
  var out=[];
  bank.problems.forEach(function(p){ if(!p||!p.pimg||/탐구|생각|활동/.test(String(p.no||''))) return;
    var score=0; var cn=(p.cid!=null&&typeof tqName==='function')?eaTypeName(tqName(p.cid)):''; if(cn&&tnames[cn]) score=3;
    var pt=pageTitle[String(p.page)]||''; if(pt){ var ds=eaDice(gS,eaGrams(pt)), dm=eaDice(gM,eaGrams(pt)); if(ds>=0.5) score=Math.max(score,2); else if(dm>=0.5||ds>=0.3) score=Math.max(score,1); }
    if(score>0) out.push({ id:p.id, page:p.page, no:String(p.no||''), pimg:p.pimg, aimg:p.aimg||'', answer:String(p.answer||''), cid:p.cid, lv:Number(p.level)||2, type:p.type, s:sub.s, m:sub.m, score:score }); });
  out.sort(function(a,b){ return b.score-a.score||a.lv-b.lv||a.page-b.page; });
  return out;
}
function bt2TbPick(n, used){
  used=used||{}; var subs=bt2Picked(); var out=[]; if(!subs.length||!n) return out;
  var pools=subs.map(function(s){ return bt2TbPool(s).filter(function(p){ return !used[String(p.id)]; }); });
  var k=0, guard=0; while(out.length<n&&guard++<200){ var pl=pools[k%pools.length]; var p=pl.shift(); k++; if(p){ used[String(p.id)]=1; out.push(p); } if(pools.every(function(x){ return !x.length; })) break; }
  return out;
}
function bt2TbRef(x){ return (BT.tb.title?eaTbShort(BT.tb.title):'교과서')+' '+x.page+'쪽 '+x.no+'번'; }
window.bt2TbRe=function(i){ var d=BT.draft; if(!d||!d.p3||!d.p3[i]) return; var used={}; d.p3.forEach(function(x){ used[String(x.id)]=1; });
  var cur=d.p3[i]; var pool=bt2TbPool({ s:cur.s, m:cur.m, t:[] }).filter(function(p){ return !used[String(p.id)]; }); if(!pool.length){ plToast('이 소단원에 더 넣을 교과서 문항이 없습니다'); return; }
  d.p3[i]=pool[0]; render(); };
window.bt2TbMore=function(){ var d=BT.draft; if(!d) return; var used={}; (d.p3||[]).forEach(function(x){ used[String(x.id)]=1; }); var got=bt2TbPick(1,used); if(!got.length){ plToast('더 넣을 교과서 문항이 없습니다'); return; } d.p3=(d.p3||[]).concat(got); render(); };

/* ── AI 지시: 소단원·유형을 그대로 준다 ── */
function bt2PromptHead(mat, stu){
  var weak=(mat.weak||[]).slice(0,6).map(function(w){ return '· '+w.unit+' › '+w.name+' (정답률 '+w.rate+'%)'; }).join('\n')||'· (유형 기록이 아직 적습니다)';
  var subs=bt2Picked().map(function(x){ return '· ['+x.m+'] '+x.s+(x.t.length?(' — 유형: '+x.t.slice(0,8).join(', ')):''); }).join('\n');
  var grade=String((stu&&stu.grade)||'').replace('학교','');
  return '당신은 한국 중·고등 수학학원의 베테랑 선생님입니다. 아래 학생에게 줄 «백지테스트 1부 — 개념 백지»를 만듭니다.\n\n'
   +'[학생] '+grade+'\n[과정] '+BT.cfg.course+'\n[대단원] '+BT.cfg.big+'\n[이번 시험 범위 — 소단원과 그 유형]\n'+subs+'\n\n[이 학생이 약한 유형 — 실제 채점 기록]\n'+weak+'\n\n'
   +'[백지테스트란] 교재와 노트를 «덮고» 개념을 스스로 떠올려 쓰게 하는 시험입니다. 계산 문제가 아니라 «개념·정의·조건·순서·왜»를 묻습니다.\n';
}
function bt2Rules(n, withS){
  return '[규칙]\n'
   +'1. '+n+'문항을 만듭니다. 위 소단원들에 «고르게» 나누고, 각 소단원 안에서는 그 유형들이 묻는 개념을 짚습니다. 쉬운 것부터 어려운 것 순서로 놓습니다.\n'
   +'2. 종류는 두 가지입니다.\n   - "blank": 한 문장 안의 핵심 낱말·조건·공식을 비우는 빈칸 문제. 빈칸 자리는 반드시 [[  ]] 로 표시합니다.\n   - "write": 두세 줄로 «설명하거나 과정을 쓰는» 서술 문제.\n   blank 와 write 를 섞되 write 가 최소 1개는 들어가게 합니다.\n'
   +'3. 계산해서 «답이 숫자로 나오는» 문제는 내지 않습니다.\n4. 학생이 읽고 바로 이해할 한국어로, 한 문항은 한 줄~두 줄로 짧게 씁니다.\n'
   +'5. "a" 에는 선생님이 채점할 때 볼 «모범답»을 한 줄로 짧게 씁니다. 빈칸이 여럿이면 「/」로 나눠 순서대로 씁니다.\n'
   +(withS?'6. "s" 에는 그 문항이 속한 소단원 이름을 위 목록에 적힌 그대로 씁니다.\n':'');
}
function btPrompt(mat, stu, unit){
  var p=bt2PromptHead(mat, stu)+'\n'+bt2Rules(BT.cfg.p1, true)
   +(BT.cfg.p3mode==='ai'&&BT.cfg.p3>0?('7. 추가로 3부에 «비슷한 유형의 연습문제» '+BT.cfg.p3+'개를 만듭니다. 답이 떨어지는 쉬운 수로 만들고, "a" 에 답을 씁니다.\n'):'')
   +'\n[형식] 다른 말 없이 JSON 만 출력합니다.\n'
   +'{"title":"백지테스트 — '+bt2UnitLabel()+'","p1":[{"type":"blank","q":"문항 글","a":"모범답","s":"소단원"}]'
   +((BT.cfg.p3mode==='ai'&&BT.cfg.p3>0)?',"p3":[{"q":"문제 글","a":"답"}]':'')+'}\n';
  return p;
}
function btParse(txt){
  var t=String(txt||'').trim(); var i=t.indexOf('{'), j=t.lastIndexOf('}');
  if(i<0||j<i) throw new Error('AI 답에서 JSON 을 찾지 못했습니다');
  var o=JSON.parse(t.slice(i,j+1));
  if(!o || !Array.isArray(o.p1)) throw new Error('1부가 비어 있습니다');
  o.p1=o.p1.filter(function(x){ return x&&x.q; }).map(function(x){ return { type:(x.type==='write'?'write':'blank'), q:String(x.q), a:String(x.a||''), s:String(x.s||'') }; });
  o.p3=Array.isArray(o.p3)?o.p3.filter(function(x){ return x&&x.q; }).map(function(x){ return { q:String(x.q), a:String(x.a||'') }; }):[];
  return o;
}
window.btGen=async function(){
  if(BT.gen) return;
  var code=BT.stu; if(!code){ plToast('학생을 먼저 고르세요'); return; }
  var stu=btStuByCode(code); var mat=btMat(code);
  if(!bt2EnsureCfg(stu)||!bt2Picked().length){ plToast('소단원을 하나 이상 고르세요'); return; }
  BT.gen=true; BT.genMsg='재료를 정리하는 중…'; render();
  try{
    if(BT.cfg.p3mode==='tb'){ BT.genMsg='교과서 문항을 고르는 중…'; render(); if(!bt2TbReady()){ BT.tb.loading=false; await bt2TbLoad(code); } }
    BT.genMsg='AI 가 개념 문항을 쓰는 중… (10~20초)'; render();
    var txt=await callAI(btPrompt(mat, stu, bt2UnitLabel()));
    var o=btParse(txt);
    var p3=[]; if(BT.cfg.p3mode==='tb') p3=bt2TbPick(Number(BT.cfg.p3)||0, {}); else if(BT.cfg.p3mode==='ai') p3=(o.p3||[]).slice(0,6);
    BT.draft={ id:'bt:'+Date.now().toString(36), code:code, title:String(o.title||('백지테스트 — '+bt2UnitLabel())),
      unit:bt2UnitLabel(), course:BT.cfg.course, big:BT.cfg.big, subs:bt2Picked().map(function(x){ return x.s; }),
      p3mode:BT.cfg.p3mode, tb:{ bid:BT.tb.bid, title:BT.tb.title },
      at:new Date().toISOString(), p1:o.p1.slice(0,14), p2:btPart2(mat, Number(BT.cfg.p2)||0), p3:p3, note:'' };
    BT.genMsg='';
  }catch(e){ BT.genMsg=''; BT.draft=null; alert('초안을 만들지 못했습니다\n\n'+((e&&e.message)||e)+'\n\nAPI 키가 등록되어 있는지(설정 탭) 확인해 주세요.'); }
  BT.gen=false; render();
};
/* 🔄 이 문항만 다시 — 같은 소단원·같은 종류로, 다른 문항과 겹치지 않게 */
window.bt2Re=async function(i){
  var d=BT.draft; if(!d||!d.p1[i]||BT.reBusy[i]) return;
  var x=d.p1[i]; var stu=btStuByCode(d.code); var mat=btMat(d.code);
  BT.reBusy[i]=true; render();
  try{
    var others=d.p1.filter(function(y,j){ return j!==i; }).map(function(y){ return '· '+y.q; }).join('\n');
    var p=bt2PromptHead(mat, stu)+'\n[할 일] 아래 «한 문항»을 새로 씁니다. 소단원 「'+(x.s||bt2SubsLabel())+'」, 종류 "'+x.type+'" 는 그대로 두고, 묻는 개념이나 문장을 바꿉니다.\n'
      +'[바꿀 문항] '+x.q+'\n[이미 있는 다른 문항 — 겹치지 않게]\n'+others+'\n\n'+bt2Rules(1,true).replace('1. 1문항을 만듭니다. 위 소단원들에 «고르게» 나누고, 각 소단원 안에서는 그 유형들이 묻는 개념을 짚습니다. 쉬운 것부터 어려운 것 순서로 놓습니다.\n','')
      +'\n[형식] 다른 말 없이 JSON 만 출력합니다.\n{"type":"'+x.type+'","q":"문항 글","a":"모범답","s":"'+(x.s||'')+'"}\n';
    var txt=await callAI(p); var t=String(txt||''); var a=t.indexOf('{'), b=t.lastIndexOf('}'); var o=JSON.parse(t.slice(a,b+1));
    if(!o||!o.q) throw new Error('문항을 못 받았습니다');
    d.p1[i]={ type:(o.type==='write'?'write':'blank'), q:String(o.q), a:String(o.a||''), s:String(o.s||x.s||'') };
    plToast('🔄 '+(i+1)+'번을 다시 썼습니다');
  }catch(e){ alert('다시 쓰지 못했습니다: '+((e&&e.message)||e)); }
  delete BT.reBusy[i]; render();
};
/* + AI 로 n개 더 */
window.bt2More=async function(n){
  var d=BT.draft; if(!d||BT.gen) return; n=Number(n)||2;
  var stu=btStuByCode(d.code); var mat=btMat(d.code);
  BT.gen=true; BT.genMsg='AI 가 '+n+'문항을 더 쓰는 중…'; render();
  try{
    var others=d.p1.map(function(y){ return '· '+y.q; }).join('\n');
    var p=bt2PromptHead(mat, stu)+'\n[이미 있는 문항 — 겹치지 않게]\n'+others+'\n\n'+bt2Rules(n,true)+'\n[형식] 다른 말 없이 JSON 만 출력합니다.\n{"p1":[{"type":"blank","q":"문항 글","a":"모범답","s":"소단원"}]}\n';
    var o=btParse(await callAI(p)); d.p1=d.p1.concat(o.p1.slice(0,n)); BT.genMsg='';
  }catch(e){ BT.genMsg=''; alert('더 쓰지 못했습니다: '+((e&&e.message)||e)); }
  BT.gen=false; render();
};
window.bt2Move=function(part,i,dir){ var d=BT.draft; if(!d) return; var arr=d[part]; var j=i+dir; if(!arr||j<0||j>=arr.length) return; var t=arr[i]; arr[i]=arr[j]; arr[j]=t; render(); };
window.btAdd=function(part){ if(!BT.draft) return; if(part==='p1') BT.draft.p1.push({type:'write',q:'',a:'',s:bt2Picked()[0]?bt2Picked()[0].s:''}); else if(part==='p3') BT.draft.p3.push({q:'',a:''}); render();
  setTimeout(function(){ var tas=document.querySelectorAll('#bt2-ed textarea'); if(tas.length) tas[tas.length-1].focus(); },50); };
window.btCfg=function(k,v){
  if(k==='unit'){ BT.cfg.unit=v; render(); return; }
  if(k==='p3mode'){ BT.cfg.p3mode=String(v); if(BT.draft){ BT.draft.p3=[]; BT.draft.p3mode=BT.cfg.p3mode; } render(); return; }
  BT.cfg[k]=Number(v)||0; if(k==='p2'&&BT.draft) btRe2(); else render();
};
/* 글상자 편집 → 미리보기만 다시 그린다 (화면 전체를 다시 그리면 커서가 날아간다) */
window.bt2Edit=function(part,i,field,v){ btEdit(part,i,field,v); bt2PaintPreview(); };
window.bt2Title=function(v){ btTitle(v); bt2PaintPreview(); };
window.bt2Note=function(v){ btNote(v); bt2PaintPreview(); };
function bt2PaintPreview(){ var el=document.getElementById('bt2-pv'); if(el&&BT.draft) el.innerHTML=bt2SheetHtml(BT.draft, false); }

/* ── 시험지 한 장 (미리보기 · 인쇄 공용) ── */
function bt2Blank(q){ return esc2(q).replace(/\[\[[^\]]*\]\]/g,'<span class="bl"></span>'); }
function bt2SheetHtml(d, forPrint){
  var stu=btStuByCode(d.code); var dt=new Date(d.at||Date.now());
  var ds=dt.getFullYear()+'.'+String(dt.getMonth()+1).padStart(2,'0')+'.'+String(dt.getDate()).padStart(2,'0');
  var h='<div class="bt2-sheet">';
  h+='<div class="hd"><div><b>'+esc2(d.title)+'</b><div class="sub">교재와 노트를 덮고 풀어 보세요</div></div><div class="nm">'+(stu?esc2(stu.name):'')+' · '+(stu?esc2(String(stu.grade||'').replace('학교','')):'')+' · '+ds+'</div></div>';
  if(d.subs&&d.subs.length) h+='<div class="rg">범위 · '+esc2((d.course||'')+' › '+(d.big||'')+' › '+d.subs.join(' · '))+'</div>';
  if(d.p1.length){ h+='<div class="pt">1부. 개념 백지 <i>보지 않고 쓰기 · '+d.p1.length+'문항</i></div>';
    d.p1.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t">'+bt2Blank(x.q)+(x.s?'<em class="s">'+esc2(x.s)+'</em>':'')+'</span></div>'+(x.type==='write'?'<div class="box"></div>':''); }); }
  if(d.p2.length){ h+='<div class="pt">2부. 내가 틀린 문제 다시 풀기 <i>교재를 보고 문제를 옮겨 적은 뒤 푸세요</i></div>';
    d.p2.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t"><b>'+esc2(x.book)+'</b> '+esc2(x.no)+' <em class="s">'+esc2(x.why||'')+'</em></span></div><div class="box"></div>'; }); }
  if((d.p3||[]).length){
    if(d.p3mode==='tb'||d.p3[0].pimg){ h+='<div class="pt">3부. 교과서 문항 <i>'+esc2(d.tb&&d.tb.title?eaTbShort(d.tb.title):'교과서')+' · 정답은 뒷장(답지)에</i></div><div class="tbg">';
      d.p3.forEach(function(x,i){ h+='<div class="pb"><div class="cap">'+(i+1)+' · ['+esc2(x.s||'')+'] '+esc2(bt2TbRef(x))+'</div>'+(x.pimg?'<img src="'+esc2(x.pimg)+'" alt="">':'')+'<div class="ws"></div></div>'; }); h+='</div>'; }
    else { h+='<div class="pt">3부. 연습문제 <i>AI 가 만든 문제</i></div>'; d.p3.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t">'+esc2(x.q)+'</span></div><div class="box"></div>'; }); }
  }
  if(d.note) h+='<div class="note">'+esc2(d.note)+'</div>';
  h+='<div class="ft">루멘수학 · 백지테스트</div></div>';
  return h;
}
var BT2_SHEET_CSS=''
+'.bt2-sheet{background:#fff;color:#111;font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;font-size:12.5px;line-height:1.7;padding:22px 24px;box-sizing:border-box}'
+'.bt2-sheet .hd{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:8px;flex-wrap:wrap}'
+'.bt2-sheet .hd b{font-size:17px;font-weight:900}.bt2-sheet .hd .sub{font-size:10.5px;color:#555}.bt2-sheet .hd .nm{font-size:11px;color:#333}'
+'.bt2-sheet .rg{font-size:10.5px;color:#444;margin-bottom:4px}'
+'.bt2-sheet .pt{font-weight:900;font-size:13px;margin:12px 0 4px;border-bottom:1px solid #999;padding-bottom:2px}.bt2-sheet .pt i{font-style:normal;font-weight:500;color:#666;font-size:10.5px;margin-left:6px}'
+'.bt2-sheet .q{display:flex;gap:7px;margin:5px 0;break-inside:avoid}.bt2-sheet .q .n{font-weight:900;min-width:18px}.bt2-sheet .q .t{flex:1;min-width:0}'
+'.bt2-sheet .q .s{display:block;font-style:normal;font-size:9.5px;color:#888}'
+'.bt2-sheet .bl{display:inline-block;min-width:84px;border-bottom:1.4px solid #111;height:12px;vertical-align:-2px;margin:0 3px}'
+'.bt2-sheet .box{height:46px;border:1px dashed #9aa3ad;border-radius:4px;margin:3px 0 4px 25px;break-inside:avoid}'
+'.bt2-sheet .tbg{display:grid;grid-template-columns:1fr 1fr;gap:9px}.bt2-sheet .pb{border:1px solid #cfd6de;border-radius:4px;padding:5px 7px;break-inside:avoid}'
+'.bt2-sheet .pb .cap{font-size:9.5px;color:#555;font-weight:700;margin-bottom:3px}.bt2-sheet .pb img{width:100%;display:block}.bt2-sheet .pb .ws{height:54px}'
+'.bt2-sheet .note{margin-top:10px;padding:7px 10px;border:1px dashed #bbb;border-radius:4px;color:#444;font-size:11px}'
+'.bt2-sheet .ft{margin-top:12px;font-size:9.5px;color:#999;text-align:right;border-top:1px solid #ddd;padding-top:4px}';
(function(){ try{ if(!document.getElementById('bt2-css')){ var s=document.createElement('style'); s.id='bt2-css'; s.textContent=BT2_SHEET_CSS; document.head.appendChild(s); } }catch(e){} })();

/* 🔑 채점용 답지 — 1부 모범답 + 3부 교과서 정답 */
function bt2KeyHtml(d){
  var h='<div class="bt2-sheet bt2-key"><div class="hd"><div><b>'+esc2(d.title)+' — 채점용 답지</b><div class="sub">원장님만 보는 쪽</div></div></div>';
  if(d.p1.length){ h+='<div class="pt">1부. 개념 백지 모범답</div><table class="kt"><tr><th style="width:28px">번호</th><th>문항</th><th style="width:38%">모범답</th></tr>';
    d.p1.forEach(function(x,i){ h+='<tr><td>'+(i+1)+'</td><td>'+bt2Blank(x.q)+(x.s?'<div class="s">'+esc2(x.s)+'</div>':'')+'</td><td><b>'+esc2(x.a||'')+'</b></td></tr>'; }); h+='</table>'; }
  if(d.p2.length){ h+='<div class="pt">2부. 다시 풀기 — 교재 정답으로 채점</div>'; d.p2.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t">'+esc2(x.book)+' '+esc2(x.no)+' <em class="s">'+esc2(x.why||'')+'</em></span></div>'; }); }
  if((d.p3||[]).length){ h+='<div class="pt">3부. '+((d.p3mode==='tb'||d.p3[0].pimg)?'교과서 정답':'연습문제 답')+'</div><table class="kt"><tr><th style="width:28px">번호</th><th>문항</th><th style="width:44%">정답</th></tr>';
    d.p3.forEach(function(x,i){ h+='<tr><td>'+(i+1)+'</td><td>'+(x.pimg?esc2(bt2TbRef(x))+(x.s?'<div class="s">'+esc2(x.s)+'</div>':''):esc2(x.q||''))+'</td><td>'+(x.answer?'<b>'+esc2(bkCleanAnsSafe(x.answer))+'</b>':'')+(x.aimg?'<img src="'+esc2(x.aimg)+'" alt="" style="max-width:100%;display:block;margin-top:3px">':'')+(!x.answer&&!x.aimg&&x.a?'<b>'+esc2(x.a)+'</b>':'')+'</td></tr>'; }); h+='</table>'; }
  h+='<div class="ft">루멘수학 · 채점용 답지</div></div>';
  return h;
}
function bkCleanAnsSafe(t){ t=String(t==null?'':t); return t.replace(/\$/g,'').replace(/\\,|\\;/g,' ').replace(/\{(\d+)\/(\d+)\}/g,'$1/$2').replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g,'$1/$2').replace(/\[([^\[\]]{1,6})\]/g,' $1'); }
var BT2_KEY_CSS='.bt2-key .kt{border-collapse:collapse;width:100%;font-size:11.5px}.bt2-key .kt th{background:#0d2240;color:#fff;text-align:left;padding:5px 7px;font-size:10.5px}.bt2-key .kt td{border-bottom:1px solid #ddd;padding:5px 7px;vertical-align:top}.bt2-key .kt .s{font-size:9.5px;color:#888}';
function bt2PrintWin(body, title){
  var html='<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>'+esc2(title)+'</title><style>@page{size:A4;margin:14mm}body{margin:0;background:#fff}'+BT2_SHEET_CSS+BT2_KEY_CSS+'.bt2-sheet{padding:0}.pg{page-break-after:always;break-after:page}.pg:last-child{page-break-after:auto}@media print{button{display:none}}</style></head><body>'+body
    +'<script>window.onload=function(){var im=document.images,n=im.length,c=0;function go(){setTimeout(function(){window.print();},250);}if(!n)go();else{for(var i=0;i<n;i++){im[i].onload=im[i].onerror=function(){if(++c>=n)go();};if(im[i].complete){if(++c>=n)go();}}}}<\/script></body></html>';
  var w=window.open('','_blank'); if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
window.btPrint=function(){ var d=BT.draft; if(!d){ plToast('먼저 초안을 만드세요'); return; } bt2PrintWin('<div class="pg">'+bt2SheetHtml(d,true)+'</div>', d.title); };
window.btAnswers=function(){ var d=BT.draft; if(!d) return; bt2PrintWin('<div class="pg">'+bt2KeyHtml(d)+'</div>', d.title+' — 답지'); };
window.bt2PrintBoth=function(){ var d=BT.draft; if(!d) return; bt2PrintWin('<div class="pg">'+bt2SheetHtml(d,true)+'</div><div class="pg">'+bt2KeyHtml(d)+'</div>', d.title); };

/* ── 화면: 만들기 탭 ── */
function rBtMake(){
  var h=btClsChips();
  var list=btActive().filter(function(s){ return !BT.cls || (s.group||'')===BT.cls; });
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px">';
  list.forEach(function(s){ var c=String(s.lumen_rec_code); h+=btChip(esc2(s.name), BT.stu===c, "btPick('"+esc2(c)+"')"); });
  h+='</div>';
  if(!BT.stu) return h+'<div style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:40px 20px;text-align:center;color:#64748b;font-weight:700;line-height:1.8">학생을 고르면 <b style="color:#0d2240">과정·소단원</b>을 고르고 백지테스트를 만들 수 있습니다.<br>틀린 문항·아하노트·약한 유형은 자동으로 재료가 됩니다.</div>';
  var code=BT.stu, stu=btStuByCode(code), mat=btMat(code);
  var kindTxt=function(x){ var k=BT_KIND[x.kind]||BT_KIND.unk; return k[0]+' '+k[1]; };
  h+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:12px">';
  h+=btCard('최근 '+BT.cfg.days+'일 막힌 문제 (매쓰플랫)', mat.stuck.length?('<div style="font-size:12.5px;font-weight:800;color:#0d2240;line-height:1.6">'+mat.stuck.slice(0,5).map(function(x){ return (BT_KIND[x.k]||BT_KIND.unk)[0]+' '+esc2(x.t); }).join('<br>')+'</div>'+(mat.stuck.length>5?'<div style="font-size:11px;color:#94a3b8;font-weight:700;margin-top:4px">…외 '+(mat.stuck.length-5)+'개</div>':'')):'<div style="font-size:12px;color:#94a3b8;font-weight:700">'+(mat.ready?'최근에 막힌 기록이 없습니다':'불러오는 중…')+'</div>');
  h+=btCard('아하노트 미해결', mat.aha.length?('<div style="font-size:12.5px;font-weight:800;color:#0d2240;line-height:1.6">'+mat.aha.slice(0,5).map(function(a){ return esc2(a.src+(a.page?(' '+a.page+'쪽'):'')+(a.no?(' '+a.no+'번'):'')); }).join('<br>')+'</div>'):'<div style="font-size:12px;color:#94a3b8;font-weight:700">없습니다</div>');
  h+=btCard('약한 유형 (정답률 75% 미만)', mat.weak.length?('<div style="font-size:12.5px;font-weight:800;color:#0d2240;line-height:1.6">'+mat.weak.slice(0,5).map(function(w){ return esc2(w.unit)+' › '+esc2(w.name)+' <span style="color:#dc2626">'+w.rate+'%</span>'; }).join('<br>')+'</div>'):'<div style="font-size:12px;color:#94a3b8;font-weight:700">'+(window.MF_TYPE_ACH?'약한 유형이 없습니다 👍':'불러오는 중…')+'</div>');
  h+=btCard('지금 푸는 교재', mat.books.length?('<div style="font-size:12.5px;font-weight:800;color:#0d2240;line-height:1.6">'+mat.books.slice(0,4).map(function(b){ return esc2(b.title)+' <span style="color:#64748b;font-weight:700">'+b.done+'/'+b.pages+'쪽</span>'; }).join('<br>')+'</div>'):'<div style="font-size:12px;color:#94a3b8;font-weight:700">기록 없음</div>');
  h+='</div>';
  /* 과정·단원 */
  h+='<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:13px 15px;margin-bottom:12px">';
  if(window.MF_TYPEDB===null||window.MF_TYPEDB_LOADING){ try{ mtdLoad(); }catch(e){} setTimeout(function(){ if(btPainting()) render(); },900); h+='<div style="font-size:12px;color:#94a3b8;font-weight:800">🔄 유형DB(과정·소단원)를 불러오는 중…</div></div>'; return h; }
  if(!bt2EnsureCfg(stu)){ h+='<div style="font-size:12px;color:#b91c1c;font-weight:800">유형DB가 없어 과정을 고를 수 없습니다 (유형DB 화면에서 새로고침)</div></div>'; return h; }
  var lbl=function(t){ return '<span style="font-size:10.5px;font-weight:900;color:#94a3b8;letter-spacing:.03em;margin-right:4px;white-space:nowrap">'+t+'</span>'; };
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:7px">'+lbl('과정');
  bt2Courses(stu).forEach(function(c){ h+=btChip(esc2(c), BT.cfg.course===c, "bt2Course('"+esc2(c).replace(/'/g,"\\'")+"')"); }); h+='</div>';
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:7px">'+lbl('대단원');
  bt2Tree(BT.cfg.course).forEach(function(b){ h+=btChip(esc2(b.n), BT.cfg.big===String(b.n), "bt2BigSet('"+esc2(String(b.n)).replace(/'/g,"\\'")+"')"); }); h+='</div>';
  var B=bt2Big(BT.cfg.course, BT.cfg.big);
  h+='<div style="display:flex;flex-direction:column;gap:5px;margin-bottom:9px">';
  (B&&B.m||[]).forEach(function(m){ var keys=(m.s||[]).map(function(s){ return bt2SubKey(m.n,s.n); }); var all=keys.length&&keys.every(function(k){ return BT.cfg.subs.indexOf(k)>=0; });
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center"><button onclick="bt2MidTog(\''+esc2(String(m.n)).replace(/'/g,"\\'")+'\')" title="이 중단원 전체 켜고 끄기" style="font-family:inherit;font-size:11px;font-weight:900;border-radius:7px;padding:4px 8px;cursor:pointer;background:'+(all?'#0d2240':'#f1f5f9')+';color:'+(all?'#fff':'#475569')+';border:none;white-space:nowrap">'+esc2(m.n)+'</button>';
    (m.s||[]).forEach(function(s){ var k=bt2SubKey(m.n,s.n); var on=BT.cfg.subs.indexOf(k)>=0; h+='<button onclick="bt2SubTog(\''+esc2(k).replace(/'/g,"\\'")+'\')" title="'+esc2((s.t||[]).slice(0,6).join(' · '))+'" style="font-family:inherit;font-size:11.5px;font-weight:800;border-radius:50px;padding:4px 10px;cursor:pointer;white-space:nowrap;'+(on?'background:#1d6fe8;color:#fff;border:1.5px solid #1d6fe8':'background:#fff;color:#475569;border:1.5px solid #e6eaf1')+'">'+esc2(s.n)+' <span style="opacity:.6;font-size:10px">'+(s.t||[]).length+'</span></button>'; });
    h+='</div>'; });
  h+='</div>';
  var picked=bt2Picked();
  h+='<div style="font-size:11.5px;font-weight:800;color:#64748b;margin-bottom:9px">고른 소단원 <b style="color:#0d2240">'+picked.length+'개</b>'+(picked.length?' — '+esc2(picked.map(function(x){ return x.s; }).join(' · ')):' (하나 이상 고르세요)')+'</div>';
  /* 구성 */
  var inp=function(id,k,v,mn,mx){ return '<label style="font-size:11px;font-weight:800;color:#64748b;display:flex;align-items:center;gap:5px">'+id+'<input type="number" min="'+mn+'" max="'+mx+'" value="'+v+'" onchange="btCfg(\''+k+'\',this.value)" style="width:54px;font-family:inherit;font-size:12.5px;padding:6px 8px;border:1.5px solid #e6eaf1;border-radius:9px"></label>'; };
  h+='<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">'+inp('1부 개념 백지','p1',BT.cfg.p1,3,14)+inp('2부 다시 풀기','p2',BT.cfg.p2,0,10);
  h+='<label style="font-size:11px;font-weight:800;color:#64748b;display:flex;align-items:center;gap:5px">3부 <select onchange="btCfg(\'p3mode\',this.value)" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px;border:1.5px solid #e6eaf1;border-radius:9px;background:#fff">'
    +'<option value="tb"'+(BT.cfg.p3mode==='tb'?' selected':'')+'>교과서 문항 (그림)</option><option value="ai"'+(BT.cfg.p3mode==='ai'?' selected':'')+'>AI 창작</option><option value="none"'+(BT.cfg.p3mode==='none'?' selected':'')+'>없음</option></select></label>';
  if(BT.cfg.p3mode!=='none') h+=inp('','p3',BT.cfg.p3||4,0,10);
  if(BT.cfg.p3mode==='tb'){ if(BT.tb.course!==BT.cfg.course||(!BT.tb.bank&&BT.tb.bid!=='-')){ bt2TbLoad(code); h+='<span style="font-size:11px;color:#94a3b8;font-weight:800">교과서 찾는 중…</span>'; }
    else h+='<span style="font-size:11px;font-weight:800;color:'+(BT.tb.bank?'#0f766e':'#b45309')+'">'+(BT.tb.bank?('📘 '+esc2(BT.tb.title)+' · '+(BT.tb.bank.problems||[]).length+'문항 은행'):'⚠ 이 과정의 교과서 은행이 없어 3부를 못 넣습니다 (AI 창작이나 없음으로)')+'</span>'; }
  h+='</div>';
  if(BT.cfg.p3mode==='ai'&&BT.cfg.p3>0) h+='<div style="margin-top:8px;background:#fffbeb;border:1px solid #fbbf24;border-radius:9px;padding:8px 11px;font-size:11.5px;color:#92400e;font-weight:800">⚠️ 3부 AI 창작 문제는 답이 틀릴 수 있으니 인쇄 전에 원장님이 꼭 풀어 보세요.</div>';
  h+='<div style="display:flex;gap:8px;align-items:center;margin-top:11px;flex-wrap:wrap">';
  h+=btBtn(BT.gen?'⏳ 만드는 중…':'⚡ AI 초안 만들기','btGen()','blue');
  if(BT.draft){ h+=btBtn('🖨️ 시험지 인쇄','btPrint()','pri')+btBtn('🔑 채점용 답지','btAnswers()')+btBtn('🖨️+🔑 둘 다','bt2PrintBoth()')+btBtn('📋 보드에 카드','btToBoard()','gold')+btBtn('💾 보관','btSave()')+btBtn('👥 반 전체로','btBulk()'); }
  if(BT.genMsg) h+='<span style="font-size:11.5px;color:#64748b;font-weight:800">'+esc2(BT.genMsg)+'</span>';
  if(BT.bulk) h+='<span style="font-size:11.5px;color:#1d6fe8;font-weight:900">반 전체 '+BT.bulk.n+'/'+BT.bulk.tot+'명…</span>';
  h+='</div></div>';
  if(!BT.draft) return h+'<div style="background:#fff;border:1px dashed #cbd5e1;border-radius:16px;padding:34px 20px;text-align:center;color:#94a3b8;font-weight:700;line-height:1.8">「⚡ AI 초안 만들기」를 누르면 왼쪽에 편집 칸, 오른쪽에 시험지 미리보기가 나옵니다.<br>AI 는 <b style="color:#64748b">1부 개념 문항</b>만 씁니다 — 2부는 실제 틀린 문항, 3부는 교과서 문항을 앱이 고릅니다.</div>';
  return h+rBtDraft();
}
/* ── 편집(왼쪽) + 미리보기(오른쪽) ── */
function rBtDraft(){
  var d=BT.draft;
  var h='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:12px;align-items:start">';
  h+='<div id="bt2-ed" style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:14px 16px;min-width:0">';
  h+='<input value="'+esc2(d.title)+'" onchange="bt2Title(this.value)" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:15px;font-weight:900;color:#0d2240;border:none;border-bottom:2px solid #eef2f7;padding:4px 0 7px;margin-bottom:8px">';
  var sm=function(l,on,p){ return '<button onclick="'+on+'" title="'+(p||'')+'" style="font-family:inherit;font-size:10.5px;font-weight:900;border-radius:7px;padding:4px 7px;cursor:pointer;background:#fff;color:#0d2240;border:1px solid #e6eaf1;white-space:nowrap">'+l+'</button>'; };
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;border-bottom:1.5px solid #0d2240;padding-bottom:3px;margin-bottom:6px">1부. 개념 백지 <span style="font-size:10.5px;color:#64748b;font-weight:700">'+d.p1.length+'문항 · 빈칸은 [[  ]]</span><span style="display:flex;gap:4px">'+sm(BT.gen?'⏳':'+ AI 로 2개 더','bt2More(2)')+sm('+ 직접 쓰기',"btAdd('p1')")+'</span></div>';
  d.p1.forEach(function(x,i){ var busy=!!BT.reBusy[i];
    h+='<div style="display:grid;grid-template-columns:18px minmax(0,1fr) max-content;gap:6px;align-items:start;padding:6px 0;border-bottom:1px solid #f6f8fc;'+(busy?'opacity:.5':'')+'">'
      +'<span style="font-size:12px;font-weight:900;color:#94a3b8;padding-top:6px">'+(i+1)+'</span><span>'
      +'<div style="display:flex;gap:5px;align-items:center;margin-bottom:3px"><select onchange="bt2Edit(\'p1\','+i+',\'type\',this.value)" style="font-family:inherit;font-size:11px;padding:3px 5px;border:1.5px solid #e6eaf1;border-radius:7px"><option value="blank"'+(x.type==='blank'?' selected':'')+'>빈칸</option><option value="write"'+(x.type==='write'?' selected':'')+'>서술</option></select>'
      +'<span style="font-size:10px;font-weight:900;color:#1d6fe8;background:#e8f1ff;border-radius:5px;padding:1px 6px">'+esc2(x.s||'')+'</span></div>'
      +'<textarea oninput="bt2Edit(\'p1\','+i+',\'q\',this.value)" rows="2" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:12.5px;line-height:1.5;padding:6px 8px;border:1.5px solid #e6eaf1;border-radius:8px;resize:vertical">'+esc2(x.q)+'</textarea>'
      +'<input value="'+esc2(x.a||'')+'" oninput="bt2Edit(\'p1\','+i+',\'a\',this.value)" placeholder="모범답 (답지에만)" style="width:100%;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:11.5px;padding:5px 8px;border:1.5px dashed #cbd5e1;border-radius:8px;color:#475569"></span>'
      +'<span style="display:flex;flex-direction:column;gap:3px">'+sm(busy?'⏳':'🔄 이 문항만 다시','bt2Re('+i+')','AI 가 같은 소단원·같은 종류로 새로 씁니다')+'<span style="display:flex;gap:3px">'+sm('▲',"bt2Move('p1',"+i+",-1)")+sm('▼',"bt2Move('p1',"+i+",1)")+sm('✕',"btDel('p1',"+i+")")+'</span></span></div>';
  });
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;border-bottom:1.5px solid #0d2240;padding-bottom:3px;margin:14px 0 6px">2부. 틀린 문제 다시 풀기 <span style="font-size:10.5px;color:#64748b;font-weight:700">실제 채점 기록에서</span><span>'+sm('🔄 다시 고르기','btRe2()')+'</span></div>';
  if(!d.p2.length) h+='<div style="font-size:11.5px;color:#94a3b8;font-weight:700;padding:4px 0">틀린 기록이 없거나 2부를 0으로 두었습니다.</div>';
  d.p2.forEach(function(x,i){ h+='<div style="display:flex;gap:7px;align-items:center;padding:5px 9px;background:#f6f8fc;border-radius:8px;margin-bottom:4px;font-size:12px"><span style="font-weight:900;color:#94a3b8;width:16px">'+(i+1)+'</span><span style="flex:1;min-width:0;font-weight:800;color:#0d2240">'+esc2(x.label||(x.book+' '+x.no))+'</span><span style="font-size:10.5px;color:#64748b;font-weight:700">'+esc2(x.why||'')+'</span>'+sm('✕',"btDel('p2',"+i+")")+'</div>'; });
  var isTb=(d.p3mode==='tb');
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;border-bottom:1.5px solid #0d2240;padding-bottom:3px;margin:14px 0 6px">3부. '+(isTb?'교과서 문항':(d.p3mode==='ai'?'연습문제 (AI)':'없음'))+' <span style="font-size:10.5px;color:#64748b;font-weight:700">'+(isTb?esc2(d.tb&&d.tb.title?d.tb.title:''):'')+'</span><span style="display:flex;gap:4px">'+(isTb?sm('+ 1문항','bt2TbMore()'):(d.p3mode==='ai'?sm('+ 직접 쓰기',"btAdd('p3')"):''))+'</span></div>';
  (d.p3||[]).forEach(function(x,i){
    if(x.pimg){ h+='<div style="display:grid;grid-template-columns:18px 70px minmax(0,1fr) max-content;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid #f6f8fc;font-size:12px"><span style="font-weight:900;color:#94a3b8">'+(i+1)+'</span><img src="'+esc2(x.pimg)+'" alt="" style="width:70px;height:46px;object-fit:cover;object-position:left top;border:1px solid #e6eaf1;border-radius:5px;cursor:zoom-in" onclick="openPhotoFull('+bkQ2(x.pimg)+')"><span style="min-width:0;overflow:hidden"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc2(bt2TbRef(x))+'</b><div style="font-size:10.5px;color:#64748b;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc2(x.s||'')+(x.answer?' · 정답 '+esc2(bkCleanAnsSafe(x.answer)).slice(0,24):'')+'</div></span><span style="display:flex;flex-direction:column;gap:3px">'+sm('🔄 다른 문항','bt2TbRe('+i+')')+'<span style="display:flex;gap:3px">'+sm('▲',"bt2Move('p3',"+i+",-1)")+sm('▼',"bt2Move('p3',"+i+",1)")+sm('✕',"btDel('p3',"+i+")")+'</span></span></div>'; }
    else { h+='<div style="display:grid;grid-template-columns:18px minmax(0,1fr) max-content;gap:6px;align-items:start;padding:6px 0;border-bottom:1px solid #f6f8fc"><span style="font-size:12px;font-weight:900;color:#94a3b8;padding-top:6px">'+(i+1)+'</span><span><textarea oninput="bt2Edit(\'p3\','+i+',\'q\',this.value)" rows="2" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:12.5px;padding:6px 8px;border:1.5px solid #e6eaf1;border-radius:8px;resize:vertical">'+esc2(x.q||'')+'</textarea><input value="'+esc2(x.a||'')+'" oninput="bt2Edit(\'p3\','+i+',\'a\',this.value)" placeholder="답" style="width:100%;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:11.5px;padding:5px 8px;border:1.5px dashed #cbd5e1;border-radius:8px"></span>'+sm('✕',"btDel('p3',"+i+")")+'</div>'; }
  });
  h+='<div style="margin-top:10px"><label style="font-size:11px;font-weight:800;color:#64748b">아래에 붙일 한마디 (선택)<input value="'+esc2(d.note||'')+'" oninput="bt2Note(this.value)" placeholder="예: 다 쓰고 나서 교과서로 확인해 보세요" style="display:block;width:100%;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:12.5px;padding:7px 9px;border:1.5px solid #e6eaf1;border-radius:9px"></label></div>';
  h+='</div>';
  /* 미리보기 */
  h+='<div style="min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#64748b;margin-bottom:5px"><span>🖨 인쇄 미리보기 (A4) — 고치면 바로 바뀝니다</span>'+sm('🔑 답지 보기','bt2KeyPeek()')+'</div>';
  h+='<div id="bt2-pv" style="border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 8px 24px rgba(13,34,64,.12);overflow:auto;max-height:84vh">'+bt2SheetHtml(d,false)+'</div></div>';
  h+='</div>';
  return h;
}
function bkQ2(v){ return "'"+String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;')+"'"; }
window.bt2KeyPeek=function(){ var d=BT.draft; if(!d) return; var el=document.getElementById('bt2-pv'); if(!el) return; if(el.getAttribute('data-key')==='1'){ el.removeAttribute('data-key'); el.innerHTML=bt2SheetHtml(d,false); } else { el.setAttribute('data-key','1'); el.innerHTML='<style>'+BT2_KEY_CSS+'</style>'+bt2KeyHtml(d); } };
