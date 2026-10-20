/* ═══════════════════════════════════════════════════════════════════
 * v19-94·95·96: 📝 백지테스트 2판 — «과정·소단원 고르기 · A4 미리보기 · 문항 편집 · 3부 교과서 문항 · 채점용 답지»
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
/* ★ v19-96: 여러 명 고르기 — 같은 시험지를 한꺼번에 (원장 지시 2026-10-10 「오늘 중3은 같은 시험지」) */
function bt2GradeKey(st){ var m=String((st&&st.grade)||'').match(/(초|중|고)[^0-9]*(\d)/); return m?(m[1]+m[2]):''; }
function bt2SelCodes(){ return Object.keys(BT.sel||{}).filter(function(c){ return BT.sel[c]; }); }
window.bt2SelTog=function(c){ BT.sel=BT.sel||{}; c=String(c); if(BT.sel[c]) delete BT.sel[c]; else BT.sel[c]=1; if(!BT.stu) BT.stu=c; render(); };
window.bt2SelGrade=function(g){ BT.sel=BT.sel||{}; btActive().forEach(function(st){ if(bt2GradeKey(st)===g) BT.sel[String(st.lumen_rec_code)]=1; }); if(!BT.stu){ var f=bt2SelCodes()[0]; if(f) BT.stu=f; } render(); };
window.bt2SelCls=function(){ BT.sel=BT.sel||{}; btActive().forEach(function(st){ if(!BT.cls||(st.group||'')===BT.cls) BT.sel[String(st.lumen_rec_code)]=1; }); render(); };
window.bt2SelClear=function(){ BT.sel={}; render(); };
function rBtMake(){
  var h=btClsChips();
  var list=btActive().filter(function(s){ return !BT.cls || (s.group||'')===BT.cls; });
  var sel=bt2SelCodes();
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;align-items:center">';
  list.forEach(function(s){ var c=String(s.lumen_rec_code); var on=!!(BT.sel&&BT.sel[c]);
    h+='<span style="display:inline-flex;align-items:center;border-radius:50px;border:1.5px solid '+(BT.stu===c?'#0d2240':'#e6eaf1')+';background:'+(BT.stu===c?'#0d2240':'#fff')+';overflow:hidden">'
      +'<button onclick="bt2SelTog(\''+esc2(c)+'\')" title="여러 명 고르기" style="border:none;background:'+(on?'#1d6fe8':'transparent')+';color:'+(on?'#fff':(BT.stu===c?'#94a3b8':'#cbd5e1'))+';font-family:inherit;font-size:11px;font-weight:900;padding:6px 7px 6px 10px;cursor:pointer">'+(on?'✓':'○')+'</button>'
      +'<button onclick="btPick(\''+esc2(c)+'\')" style="border:none;background:transparent;color:'+(BT.stu===c?'#fff':'#475569')+';font-family:inherit;font-size:12px;font-weight:800;padding:6px 12px 6px 4px;cursor:pointer;white-space:nowrap">'+esc2(s.name)+'</button></span>'; });
  h+='</div>';
  var grades={}; btActive().forEach(function(st){ var g=bt2GradeKey(st); if(g) grades[g]=(grades[g]||0)+1; });
  h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;align-items:center;font-size:11px;font-weight:800;color:#64748b"><span>○ 를 눌러 여러 명 고르기 · 빠르게:</span>';
  Object.keys(grades).sort().forEach(function(g){ h+='<button onclick="bt2SelGrade(\''+esc2(g)+'\')" style="font-family:inherit;font-size:11px;font-weight:900;border-radius:7px;padding:4px 9px;cursor:pointer;background:#eef2ff;color:#3730a3;border:none">'+esc2(g)+' 전부 '+grades[g]+'</button>'; });
  h+='<button onclick="bt2SelCls()" style="font-family:inherit;font-size:11px;font-weight:900;border-radius:7px;padding:4px 9px;cursor:pointer;background:#f1f5f9;color:#475569;border:none">'+(BT.cls?esc2(BT.cls)+' 반 전부':'보이는 학생 전부')+'</button>';
  if(sel.length) h+='<button onclick="bt2SelClear()" style="font-family:inherit;font-size:11px;font-weight:900;border-radius:7px;padding:4px 9px;cursor:pointer;background:#fff;color:#94a3b8;border:1px solid #e6eaf1">모두 해제</button><span style="color:#1d6fe8">✓ '+sel.length+'명 고름</span>';
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
  if(BT.draft){ h+=btBtn('🖨️ 시험지 인쇄','btPrint()','pri')+btBtn('🔑 채점용 답지','btAnswers()')+btBtn('🖨️+🔑 둘 다','bt2PrintBoth()')+btBtn('📋 보드에 카드','btToBoard()','gold')+btBtn('💾 보관','btSave()');
    var selN=bt2SelCodes().length;
    h+=selN?btBtn('👥 고른 '+selN+'명에게 같은 시험지 만들기','bt2MakeMany()','blue'):btBtn('👥 반 전체로','btBulk()'); }
  if(BT.genMsg) h+='<span style="font-size:11.5px;color:#64748b;font-weight:800">'+esc2(BT.genMsg)+'</span>';
  if(BT.bulk) h+='<span style="font-size:11.5px;color:#1d6fe8;font-weight:900">만드는 중 '+BT.bulk.n+'/'+BT.bulk.tot+'명…</span>';
  if(BT.many&&BT.many.length) h+='<span style="display:inline-flex;gap:6px;align-items:center;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:5px 8px;font-size:11.5px;font-weight:900;color:#166534">✅ '+BT.many.length+'명 보관함에 저장됨 '+btBtn('🖨️ '+BT.many.length+'명 한꺼번에 인쇄','bt2PrintMany(false)','pri')+btBtn('🖨️+🔑 답지까지','bt2PrintMany(true)')+'</span>';
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

/* ★ v19-96: 고른 학생 전원에게 같은 시험지 — 1부·3부는 같고, 2부(틀린 문제)는 2부 수가 0 보다 크면 학생마다 */
window.bt2MakeMany=async function(){
  var d=BT.draft; if(!d){ plToast('먼저 한 학생으로 초안을 만든 뒤 눌러 주세요'); return; }
  var codes=bt2SelCodes(); if(!codes.length){ plToast('학생을 ○ 로 골라 주세요'); return; }
  if(codes.length>40){ plToast('한 번에 40명까지입니다'); return; }
  var p2n=Number(BT.cfg.p2)||0;
  if(!confirm(codes.length+'명에게 이 백지테스트를 만듭니다.\n1부(개념 백지)·3부(교과서 문항)는 같고'+(p2n>0?', 2부(틀린 문제)는 학생마다 다르게 채웁니다.':', 2부는 없습니다.')+'\n보관함에 저장하고 한꺼번에 인쇄할 수 있습니다. 계속할까요?')) return;
  BT.bulk={ n:0, tot:codes.length, fail:[] }; render();
  var made=[];
  for(var i=0;i<codes.length;i++){ var c=codes[i];
    try{ var mat=btMat(c);
      var x=JSON.parse(JSON.stringify(d)); x.id='bt:'+Date.now().toString(36)+i; x.code=c; x.at=new Date().toISOString(); x.savedAt=x.at;
      x.p2=p2n>0?btPart2(mat,p2n):[];
      BT.saved=BT.saved.filter(function(y){ return y.id!==x.id; }); BT.saved.unshift(x); made.push(x);
    }catch(e){ BT.bulk.fail.push(c); }
    BT.bulk.n=i+1; render(); await new Promise(function(r){ setTimeout(r,10); });
  }
  await btSaveAll();
  BT.bulk=null; BT.many=made; render();
  plToast('👥 '+made.length+'장을 보관함에 넣었습니다 — 「🖨️ '+made.length+'명 한꺼번에 인쇄」로 뽑으세요');
};
/* 방금 만든 여러 장을 한 창에 — 학생마다 한 쪽, 맨 뒤에 답지 한 장 */
window.bt2PrintMany=function(withKey){
  var L=BT.many||[]; if(!L.length){ plToast('먼저 「같은 시험지 만들기」를 눌러 주세요'); return; }
  var body=L.map(function(x){ return '<div class="pg">'+bt2SheetHtml(x,true)+'</div>'; }).join('');
  if(withKey) body+='<div class="pg">'+bt2KeyHtml(L[0])+'</div>';
  bt2PrintWin(body, L[0].title+' — '+L.length+'명');
};
window.btPick=function(code){ BT.stu=String(code); BT.draft=null; BT.many=null; render(); };

/* ═══════════════════════════════════════════════════════════════════
 * v19-97: 💬 백지테스트 — «채팅으로 고치기» (편집 칸 맨 아래 대화 상자)
 *   원장 지시 2026-10-10: 「학원앱에서 지금 채팅처럼, 곱셈공식 변형 더 추가해줘」 (시안 docs/mockup_bt_chat.html — 원장 승인)
 *
 *  [왜] 🔄·＋ 단추만으로는 「곱셈공식 변형 2문제 더」「3번 더 쉽게」 같은 말을 바로 시킬 수 없었다.
 *  [무엇]
 *   · 왼쪽 편집 칸 맨 아래(한마디 칸 밑)에 대화 상자. 말 한 줄 → AI 는 «고칠 목록»(추가·바꾸기·삭제·순서·제목·힌트)만 돌려주고 앱이 적용.
 *     시험지 전체를 다시 쓰지 않으니 손본 문항은 그대로 남는다. 새로 들어온 문항은 3초간 노란 바탕.
 *   · 범위: 고른 소단원 밖이어도 «같은 대단원» 안의 소단원·유형이면 써도 된다(원장 결정) — AI 에 대단원 전체 소단원·유형 이름을 준다.
 *   · 「교과서에서 ○○ n개」는 AI 없이 교과서 은행에서 쪽 제목·유형 이름으로 바로 찾아 3부에 넣는다(3부가 교과서일 때).
 *   · 고칠 때마다 전 상태를 쌓아 두고 「↩ 되돌리기」(또는 「취소」라고 말하기)로 돌린다.
 *   · 보관할 때 대화 기록(최근 20줄)도 시험지와 함께 저장한다(chat). 보관함에서 다시 열면 대화가 보인다.
 *  이 부품은 rBtDraft · btGen · btPick · btOpen · btSave · bt2MakeMany 를 감싼다(앞 것을 부르고 덧붙인다).
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
BT.chat=BT.chat||{ log:[], busy:false, undo:[], text:'', fresh:null };
function bt2ChatReset(log){ BT.chat={ log:log||[], busy:false, undo:[], text:'', fresh:null }; }
(function(){ try{ if(!document.getElementById('bt2-chat-css')){ var s=document.createElement('style'); s.id='bt2-chat-css'; s.textContent='.bt2-fresh{background:#fff3c4;border-radius:8px;transition:background .6s}'; document.head.appendChild(s); } }catch(e){} })();
function bt2ChatSay(r,t,sn){ var C=BT.chat; var m={ r:r, t:String(t||'') }; if(r==='ai'&&sn!=null&&sn>=0){ m.undo=true; m.sn=sn; } C.log.push(m); if(C.log.length>60) C.log=C.log.slice(-60); return m; }
function bt2ChatLogSave(){ return (BT.chat.log||[]).slice(-20).map(function(x){ return { r:x.r, t:x.t }; }); }

/* ── 되돌리기 칸: 고치기 전 상태를 쌓아 둔다 (최대 20) ── */
function bt2ChatSnap(){
  var d=BT.draft, C=BT.chat; if(!d) return -1;
  C.undo.push(JSON.stringify({ id:d.id, p1:d.p1, p3:d.p3||[], title:d.title, note:d.note||'' }));
  if(C.undo.length>20){ C.undo.shift(); C.log.forEach(function(x){ if(x.sn!=null){ x.sn--; if(x.sn<0){ x.undo=false; delete x.sn; } } }); }
  return C.undo.length-1;
}
/* idx = 「↩ 되돌리기」를 누른 말풍선 번호 (없으면 마지막 고침) — 그 고침과 그 뒤 고침까지 함께 되돌린다 */
window.bt2ChatUndo=function(idx){
  var C=BT.chat, d=BT.draft; if(!d||C.busy) return false;
  var k=C.undo.length-1;
  if(idx!=null){ var m=C.log[idx]; if(!m||!m.undo||m.sn==null) return false; k=m.sn; }
  var u=(k>=0)?C.undo[k]:null; var o=null; try{ o=u?JSON.parse(u):null; }catch(e){}
  if(!o||o.id!==d.id){ bt2ChatSay('ai','되돌릴 것이 없습니다.'); render(); bt2ChatAfterRender(); return false; }
  var later=C.undo.length-1-k;
  C.undo=C.undo.slice(0,k);
  d.p1=o.p1; d.p3=o.p3; d.title=o.title; d.note=o.note;
  C.log.forEach(function(x){ if(x.sn!=null&&x.sn>=k){ x.undo=false; delete x.sn; } });
  C.fresh=null;
  bt2ChatSay('ai','↩ 되돌렸습니다'+(later>0?(' (그 뒤에 고친 '+later+'번도 함께)'):''));
  render(); bt2ChatAfterRender(); return true;
};

/* ── 새로 들어온 문항 노란 표시 (3초) ── */
function bt2ChatFresh(f){
  var C=BT.chat; f.id=BT.draft&&BT.draft.id; C.fresh=f;
  clearTimeout(window._bt2ChatT);
  window._bt2ChatT=setTimeout(function(){ if(BT.chat.fresh!==f) return; BT.chat.fresh=null; if(btPainting()&&BT.draft&&BT.draft.id===f.id) render(); bt2ChatAfterRender(); },3000);
}
function bt2ChatAfterRender(){
  try{
    var lg=document.getElementById('bt2-chat-log'); if(lg) lg.scrollTop=lg.scrollHeight;
    var ed=document.getElementById('bt2-ed'); var d=BT.draft; if(!ed||!d) return;
    var rows=[].slice.call(ed.children).filter(function(el){ return /grid-template-columns:\s*18px/.test(el.getAttribute('style')||''); });
    var f=BT.chat.fresh; var ok=!!(f&&f.id===d.id); var n1=d.p1.length;
    rows.forEach(function(el,i){ var on=ok&&(i<n1?(f.p1&&f.p1[i]):(f.p3&&f.p3[i-n1])); if(on) el.classList.add('bt2-fresh'); else el.classList.remove('bt2-fresh'); });
  }catch(e){}
}

/* ── 교과서 요청: AI 없이 은행에서 찾는다 ── */
function bt2ChatCount(t){ var m=t.match(/(\d+)\s*(문제|문항|개)/); if(m) return Math.max(1,Math.min(6,Number(m[1]))); if(/한\s*(문제|문항|개)|하나/.test(t)) return 1; if(/두\s*(문제|문항|개)|둘/.test(t)) return 2; if(/세\s*(문제|문항|개)|셋/.test(t)) return 3; return 2; }
function bt2ChatNo(t){ var m=t.match(/(\d+)\s*번/); return m?Number(m[1]):0; }
function bt2Nsp(t){ return String(t==null?'':t).replace(/\s+/g,''); }
function bt2ChatTokens(t){
  var stop=/^(교과서|에서|문제|문항|개|더|추가|해줘|바꿔|다른|걸로|같은|유형|좀|넣어|줘|주세요|해|으로|로|만|것|거|하나|둘|셋|한|두|세|번|으로|대신)$/;
  var out=[];
  String(t||'').replace(/[「」『』"'.,!?~()\[\]·:]/g,' ').split(/\s+/).forEach(function(w){
    w=w.replace(/^교과서(에서|의|에)?/,'').replace(/\d+\s*(번|문제|문항|개)?/g,'');
    w=w.replace(/(추가해\s*주세요|추가해줘|추가해|바꿔\s*주세요|바꿔줘|바꿔|넣어\s*주세요|넣어줘|넣어|해\s*주세요|해줘)$/,'');
    var w2=w.replace(/(으로|에서|을|를|은|는|이|가|의|로|와|과|도)$/,''); if(w2.length>=2) w=w2;
    if(w.length>=2&&!stop.test(w)) out.push(w);
  });
  return out;
}
/* 찾은 문항 목록 (점수 = 낱말마다 «얼마나 잘 맞나»의 합: 유형 이름 3 · 쪽 제목 2 · 비슷한 쪽 1) · 「같은 유형」이거나 낱말이 없으면 null → 고른 소단원에서 */
function bt2ChatTbFind(t, used){
  var bank=BT.tb.bank; if(!bank||!bank.problems) return [];
  var toks=bt2ChatTokens(t);
  if(/같은\s*유형/.test(t)||!toks.length) return null;
  var d=BT.draft||{}; var B=bt2Big(d.course||BT.cfg.course, d.big||BT.cfg.big);
  var subs=[]; (B&&B.m||[]).forEach(function(m){ (m.s||[]).forEach(function(s){ subs.push({ m:String(m.n), s:String(s.n), t:(s.t||[]).map(String) }); }); });
  var pageTitle={}; (bank.pages||[]).forEach(function(pg){ pageTitle[String(pg.page)]=String(pg.title||''); });
  var byId={};
  toks.forEach(function(tk){
    var best={};   // 이 낱말에서 문항마다 가장 높은 점수
    var put=function(p,sc){ var id=String(p.id); if(!best[id]||best[id].sc<sc) best[id]={ p:p, sc:sc }; };
    subs.forEach(function(sb){
      if(bt2Nsp(sb.s).indexOf(tk)<0&&!sb.t.some(function(x){ return bt2Nsp(x).indexOf(tk)>=0; })) return;
      bt2TbPool(sb).forEach(function(p){ put(p, Number(p.score)||1); });
    });
    bank.problems.forEach(function(p){
      if(!p||!p.pimg||/탐구|생각|활동/.test(String(p.no||''))) return;
      var pt=bt2Nsp(pageTitle[String(p.page)]), ti=bt2Nsp(p.title);
      if(!((pt&&pt.indexOf(tk)>=0)||(ti&&ti.indexOf(tk)>=0))) return;
      var cur=best[String(p.id)]; if(cur&&cur.sc>=2) return;
      put({ id:p.id, page:p.page, no:String(p.no||''), pimg:p.pimg, aimg:p.aimg||'', answer:String(p.answer||''), cid:p.cid, lv:Number(p.level)||2, type:p.type, s:(pageTitle[String(p.page)]||String(p.title||'')), m:'' }, 2);
    });
    Object.keys(best).forEach(function(id){ var e=byId[id]; if(!e) e=byId[id]={ p:best[id].p, sc:0 }; else if(!e.p.m&&best[id].p.m) e.p=best[id].p; e.sc+=best[id].sc; });
  });
  return Object.keys(byId).map(function(k){ return byId[k]; }).filter(function(e){ return !used[String(e.p.id)]; })
    .sort(function(a,b){ return b.sc-a.sc||a.p.lv-b.p.lv||a.p.page-b.p.page; }).map(function(e){ return e.p; });
}
function bt2ChatTb(t){
  var d=BT.draft; d.p3=d.p3||[];
  if(!BT.tb.bank) return { t:'교과서 은행이 아직 준비되지 않았습니다. 잠시 뒤 다시 말해 주세요.' };
  var used={}; d.p3.forEach(function(x){ used[String(x.id)]=1; });
  var no=bt2ChatNo(t); var n=no?1:bt2ChatCount(t);
  var found=bt2ChatTbFind(t, used); var label;
  if(found===null){ var u2={}; Object.keys(used).forEach(function(k){ u2[k]=1; }); found=bt2TbPick(n, u2); label='고른 소단원'; }
  else label=bt2ChatTokens(t).join(' ');
  found=found.slice(0,n);
  if(!found.length) return { t:'교과서 은행에서 「'+label+'」 문항을 찾지 못했습니다. 소단원 이름이나 유형 이름으로 말해 주세요.' };
  if(no&&!d.p3[no-1]) return { t:'3부에 '+no+'번이 없습니다 (지금 '+d.p3.length+'문항).' };
  var sn=bt2ChatSnap(); var fresh={ p1:{}, p3:{} };
  if(no){ d.p3[no-1]=found[0]; fresh.p3[no-1]=1; return { t:'3부 '+no+'번을 '+bt2TbRef(found[0])+' 으로 바꿨습니다. (AI 없이 교과서 은행에서 바로)', sn:sn, fresh:fresh }; }
  found.forEach(function(p){ d.p3.push(p); fresh.p3[d.p3.length-1]=1; });
  return { t:'교과서 은행에서 「'+label+'」 '+found.length+'문항을 3부 끝에 넣었습니다: '+found.map(bt2TbRef).join(', ')+' (AI 없이 바로)', sn:sn, fresh:fresh };
}

/* ── AI 요청: 지금 시험지 + 대단원 전체 범위 + 원장님 말 → «고칠 목록»만 ── */
function bt2ChatPrompt(text){
  var d=BT.draft; var stu=btStuByCode(d.code); var mat=btMat(d.code);
  var B=bt2Big(d.course||BT.cfg.course, d.big||BT.cfg.big);
  var all=[]; (B&&B.m||[]).forEach(function(m){ (m.s||[]).forEach(function(s){ var ts=(s.t||[]).map(String).slice(0,10); all.push('· ['+m.n+'] '+s.n+(ts.length?(' — 유형: '+ts.join(', ')):'')); }); });
  var p1=d.p1.map(function(x,i){ return (i+1)+'. ('+x.type+') ['+(x.s||'')+'] '+x.q+'  ‖ 모범답: '+(x.a||''); }).join('\n')||'(없음)';
  var p3=(d.p3||[]).map(function(x,i){ return (i+1)+'. '+(x.pimg?(bt2TbRef(x)+(x.s?(' ['+x.s+']'):'')):(String(x.q||'')+(x.a?('  ‖ 답: '+x.a):''))); }).join('\n')||'(없음)';
  var isAi=(d.p3mode==='ai');
  return bt2PromptHead(mat, stu)
   +'\n[이 대단원 전체의 소단원·유형 — 이 범위 안이면 어느 유형이든 써도 됩니다]\n'+(all.join('\n')||'· (유형DB 없음)')+'\n'
   +'\n[지금 시험지 — 1부]\n'+p1+'\n'
   +'\n[3부 — '+(d.p3mode==='tb'?'교과서 문항(그림 · 앱이 고름)':(isAi?'연습문제':'없음'))+']\n'+p3+'\n'
   +'\n[제목] '+d.title+(d.note?('\n[한마디] '+d.note):'')+'\n'
   +'\n[원장님 지시] '+text+'\n\n'
   +'[할 일] 원장님 지시대로 시험지에서 «고칠 것만» 알려 줍니다. 시험지 전체를 다시 쓰지 않고, 지시에 없는 문항은 건드리지 않습니다.\n'
   +'새로 쓰거나 바꾸는 문항은 아래 규칙을 따릅니다. 범위는 위 «대단원 전체» 안이면 됩니다(고른 소단원 밖이어도 됨).\n'
   +bt2Rules(1,true).replace(/^1\.[^\n]*\n/m,'')
   +'\n[형식] 다른 말 없이 JSON 만 출력합니다. reply 말고는 모두 필요할 때만 씁니다.\n'
   +'{"reply":"한 줄로 무엇을 어떻게 고쳤는지","add":[{"type":"blank","q":"…","a":"…","s":"소단원"}],"replace":[{"n":3,"type":"blank","q":"…","a":"…","s":"…"}],"remove":[4],"order":[1,2,3],"title":"(바꿀 때만)","note":"(바꿀 때만)","hint":false,"hints":[{"n":1,"h":"…"}]'+(isAi?',"p3add":[{"q":"…","a":"…"}]':'')+'}\n'
   +'- add: 1부 끝에 붙일 새 문항. replace: 바꿀 문항(n 은 «지금» 1부 번호, 1부터). remove: 뺄 «지금» 1부 번호들.\n'
   +'- order: 순서를 바꾸라는 지시일 때만. 추가·삭제를 반영한 «고친 뒤» 1부 번호를 새 순서대로 «모두» 씁니다.\n'
   +'- hint: 모범답에 힌트를 붙이라는 지시일 때만 true 로 하고, hints 에 «지금» 1부 번호(n)마다 힌트 한 줄(h)을 씁니다.\n'
   +(isAi?'- p3add: 3부 연습문제를 더 넣으라는 지시일 때만. 답이 떨어지는 쉬운 수로.\n':'- 3부는 앱이 고르는 교과서 문항이라 여기서 고치지 않습니다.\n')
   +'- 1부는 모두 20문항을 넘지 않게 합니다.\n';
}
/* AI 의 «고칠 목록» 적용 — 번호는 «지금» 문항(객체)에 묶어 두고 바꾼다 */
function bt2ChatApply(o){
  var d=BT.draft; var orig=d.p1.slice(); var newObjs=[]; var ch=0; var fresh={ p1:{}, p3:{} };
  var mk=function(x,old){ return { type:(x.type==='write'?'write':'blank'), q:String(x.q), a:String(x.a||''), s:String(x.s||(old&&old.s)||'') }; };
  (Array.isArray(o.replace)?o.replace:[]).forEach(function(x){
    var n=Number(x&&x.n); if(!x||!x.q||!(n>=1&&n<=orig.length)) return;
    var old=orig[n-1]; var k=d.p1.indexOf(old); if(k<0) return;
    var nw=mk(x,old); d.p1[k]=nw; orig[n-1]=nw; newObjs.push(nw); ch++;
  });
  (Array.isArray(o.remove)?o.remove:[]).map(Number).filter(function(n,i,a){ return n>=1&&n<=orig.length&&a.indexOf(n)===i; })
    .sort(function(a,b){ return b-a; }).forEach(function(n){ var k=d.p1.indexOf(orig[n-1]); if(k>=0){ d.p1.splice(k,1); ch++; } });
  (Array.isArray(o.add)?o.add:[]).forEach(function(x){ if(!x||!x.q||d.p1.length>=20) return; var nw=mk(x,null); d.p1.push(nw); newObjs.push(nw); ch++; });
  if(Array.isArray(o.order)&&o.order.length===d.p1.length){
    var ord=o.order.map(Number); var ok=ord.slice().sort(function(a,b){ return a-b; }).every(function(v,i){ return v===i+1; });
    if(ok&&ord.some(function(v,i){ return v!==i+1; })){ var cur=d.p1.slice(); d.p1=ord.map(function(v){ return cur[v-1]; }); ch++; }
  }
  if(typeof o.title==='string'){ var ti=o.title.trim(); if(ti&&!/바꿀 때만/.test(ti)&&ti!==d.title){ d.title=ti; ch++; } }
  if(typeof o.note==='string'){ var nt=o.note.trim(); if(nt&&!/바꿀 때만/.test(nt)&&nt!==(d.note||'')){ d.note=nt; ch++; } }
  if(o.hint!==false&&Array.isArray(o.hints)){
    o.hints.forEach(function(x){ var n=Number(x&&x.n); var h=String((x&&x.h)||'').trim(); if(!h||h==='…'||!(n>=1&&n<=orig.length)) return;
      var it=orig[n-1]; if(d.p1.indexOf(it)<0||/힌트:/.test(it.a||'')) return; it.a=(it.a||'')+'  · 힌트: '+h; ch++; });
  }
  if(d.p3mode==='ai'&&Array.isArray(o.p3add)){ d.p3=d.p3||[];
    o.p3add.forEach(function(x){ if(!x||!x.q||d.p3.length>=6) return; d.p3.push({ q:String(x.q), a:String(x.a||'') }); fresh.p3[d.p3.length-1]=1; ch++; }); }
  newObjs.forEach(function(x){ var k=d.p1.indexOf(x); if(k>=0) fresh.p1[k]=1; });
  return { ch:ch, fresh:fresh };
}

/* ── 보내기 ── */
window.bt2ChatQuick=function(t){ return bt2ChatSend(t); };
window.bt2ChatSend=async function(textOpt){
  var C=BT.chat, d=BT.draft;
  var fromBox=!(textOpt!=null&&String(textOpt).trim());
  if(fromBox){ var el=document.getElementById('bt2-chat-in'); if(el&&el.value!=null) C.text=el.value; }
  var text=String(fromBox?(C.text||''):textOpt).trim();
  if(!text||C.busy||!d) return;
  if(fromBox) C.text='';
  bt2ChatSay('me',text);
  /* 1) 되돌리기 */
  if(/취소|되돌/.test(text)){ bt2ChatUndo(); return; }
  /* 2) 교과서 — AI 없이 */
  if(/교과서/.test(text)&&d.p3mode==='tb'){
    var r=bt2ChatTb(text); bt2ChatSay('ai',r.t,r.sn); if(r.fresh) bt2ChatFresh(r.fresh);
    render(); bt2ChatAfterRender(); return;
  }
  /* 3) AI — 고칠 목록 */
  var did=d.id; var sn=bt2ChatSnap(); var applying=false;
  C.busy=true; render(); bt2ChatAfterRender();
  try{
    var txt=await callAI(bt2ChatPrompt(text));
    if(BT.chat!==C||!BT.draft||BT.draft.id!==did){ C.busy=false; return; }   // 그 사이 다른 학생·다른 시험지로 바뀜
    var t=String(txt||''); var i=t.indexOf('{'), j=t.lastIndexOf('}');
    if(i<0||j<i) throw new Error('AI 답에서 JSON 을 찾지 못했습니다');
    var o=JSON.parse(t.slice(i,j+1)); if(!o||typeof o!=='object') throw new Error('AI 답을 읽지 못했습니다');
    applying=true; var res=bt2ChatApply(o); applying=false;
    var rep=String(o.reply||'고쳤습니다').trim();
    if(!res.ch){ C.undo=C.undo.slice(0,sn); bt2ChatSay('ai',rep+' (바뀐 것은 없습니다)'); }
    else { bt2ChatSay('ai',rep,sn); bt2ChatFresh(res.fresh); }
  }catch(e){
    if(BT.chat===C){
      var u=C.undo[sn]; C.undo=C.undo.slice(0,Math.max(0,sn));
      if(applying&&u&&BT.draft&&BT.draft.id===did){ try{ var b=JSON.parse(u); BT.draft.p1=b.p1; BT.draft.p3=b.p3; BT.draft.title=b.title; BT.draft.note=b.note; }catch(e2){} }
      bt2ChatSay('ai','고치지 못했습니다: '+((e&&e.message)||e));
    }
  }
  C.busy=false; render(); bt2ChatAfterRender();
  setTimeout(function(){ var el=document.getElementById('bt2-chat-in'); if(el&&!BT.chat.busy) try{ el.focus(); }catch(e){} },30);
};

/* ── 화면: 편집 칸 맨 아래 대화 상자 ── */
var BT2_CHAT_QUICK=['곱셈공식 변형 2문제 더','3번 더 쉽게','5번을 서술형으로','교과서에서 같은 유형 2개 더','1부를 8문항으로','답지에 힌트 한 줄씩'];
function bt2ChatBubble(r,inner){
  return r==='me'
    ?'<div style="align-self:flex-end;max-width:85%;background:#0d2240;color:#fff;border-radius:12px 12px 3px 12px;padding:6px 10px;font-size:12px;font-weight:700;line-height:1.5;word-break:break-word">'+inner+'</div>'
    :'<div style="align-self:flex-start;max-width:90%;background:#f1f5fb;color:#0d2240;border:1px solid #e6eaf1;border-radius:12px 12px 12px 3px;padding:6px 10px;font-size:12px;font-weight:700;line-height:1.5;word-break:break-word">'+inner+'</div>';
}
function bt2ChatHtml(){
  var C=BT.chat;
  var h='<div id="bt2-chat" style="margin-top:14px;border:1.5px solid #e6eaf1;border-radius:14px;background:#fff;overflow:hidden">';
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;background:#0d2240;color:#fff;padding:8px 12px"><b style="font-size:12.5px;font-weight:900">💬 AI 에게 말로 고치기</b>'
    +'<span style="font-size:10.5px;font-weight:700;opacity:.75">같은 대단원 안이면 어느 유형이든 · 교과서는 AI 없이 바로 · 「취소」로 되돌리기</span></div>';
  h+='<div id="bt2-chat-log" style="max-height:190px;overflow-y:auto;padding:9px 10px;display:flex;flex-direction:column;gap:6px;background:#fff">';
  if(!C.log.length) h+=bt2ChatBubble('ai','고치고 싶은 것을 말해 주세요. 예: <b>곱셈공식 변형 2문제 더 추가해줘</b> · <b>3번 더 쉽게</b> · <b>4번 삭제</b> · <b>교과서에서 인수분해 2개 더</b>');
  C.log.forEach(function(m,i){
    var inner=esc2(m.t).replace(/\n/g,'<br>');
    if(m.r==='ai'&&m.undo) inner+='<button onclick="bt2ChatUndo('+i+')"'+(C.busy?' disabled':'')+' style="display:block;margin-top:4px;font-family:inherit;font-size:10.5px;font-weight:900;border-radius:7px;padding:3px 8px;cursor:pointer;background:#fff;color:#1d6fe8;border:1px solid #cfe0fb">↩ 되돌리기</button>';
    h+=bt2ChatBubble(m.r==='me'?'me':'ai',inner);
  });
  if(C.busy) h+=bt2ChatBubble('ai','<span style="color:#64748b">⏳ AI 가 시험지를 보고 고치는 중… (10~20초)</span>');
  h+='</div>';
  h+='<div style="display:flex;gap:4px;flex-wrap:wrap;padding:7px 10px 0;border-top:1px solid #e6eaf1">';
  BT2_CHAT_QUICK.forEach(function(q){ h+='<button onclick="bt2ChatQuick('+bkQ2(q)+')"'+(C.busy?' disabled':'')+' style="font-family:inherit;font-size:10.5px;font-weight:800;border-radius:50px;padding:3px 9px;cursor:pointer;background:#fff;color:#1d6fe8;border:1px solid #cfe0fb;white-space:nowrap">'+esc2(q)+'</button>'; });
  h+='</div>';
  h+='<div style="display:flex;gap:6px;padding:8px 10px 10px">'
    +'<input id="bt2-chat-in" value="'+esc2(C.text||'')+'" oninput="BT.chat.text=this.value" onkeydown="if(event.key===\'Enter\'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();bt2ChatSend();}" placeholder="예: 곱셈공식 변형 2문제 더 추가해줘" style="flex:1;min-width:0;font-family:inherit;font-size:12.5px;padding:8px 10px;border:1.5px solid #e6eaf1;border-radius:9px">'
    +'<button onclick="bt2ChatSend()"'+(C.busy?' disabled':'')+' style="font-family:inherit;font-size:12px;font-weight:900;border-radius:9px;padding:7px 14px;cursor:'+(C.busy?'default':'pointer')+';background:'+(C.busy?'#94a3b8':'#1d6fe8')+';color:#fff;border:none;white-space:nowrap">'+(C.busy?'⏳':'보내기')+'</button></div>';
  h+='</div>';
  return h;
}
/* rBtDraft 를 감싼다 — 편집 칸(#bt2-ed)을 닫는 </div> 바로 앞(= 미리보기 칸 시작 바로 앞)에 대화 상자를 끼운다 */
var _rBtDraft96=rBtDraft;
rBtDraft=function(){
  var h=_rBtDraft96.apply(this,arguments);
  if(!BT.draft) return h;
  var k=h.indexOf('<div style="min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;font-size:11px'); if(k<0) return h;
  var e=h.lastIndexOf('</div>',k); if(e<0) return h;
  setTimeout(bt2ChatAfterRender,0);
  return h.slice(0,e)+bt2ChatHtml()+h.slice(e);
};
/* 새 초안 · 다른 학생 · 보관함에서 열기 → 대화 새로 (열 때는 저장된 대화를 보여 준다) */
var _btGen96=window.btGen;
window.btGen=async function(){ var before=BT.draft; var r=await _btGen96.apply(this,arguments); if(BT.draft&&BT.draft!==before){ bt2ChatReset(); render(); } return r; };
var _btPick96=window.btPick;
window.btPick=function(){ bt2ChatReset(); return _btPick96.apply(this,arguments); };
var _btOpen96=window.btOpen;
window.btOpen=function(id){ var d=(BT.saved||[]).filter(function(x){ return x.id===id; })[0];
  bt2ChatReset(d&&Array.isArray(d.chat)?d.chat.map(function(x){ return { r:(x&&x.r==='me')?'me':'ai', t:String((x&&x.t)||'') }; }):[]);
  return _btOpen96.apply(this,arguments); };
/* 보관할 때 대화 기록(최근 20줄)도 함께 */
var _btSave96=window.btSave;
window.btSave=function(){ if(BT.draft) BT.draft.chat=bt2ChatLogSave(); return _btSave96.apply(this,arguments); };
var _bt2MakeMany96=window.bt2MakeMany;
window.bt2MakeMany=function(){ if(BT.draft) BT.draft.chat=bt2ChatLogSave(); return _bt2MakeMany96.apply(this,arguments); };

/* ═══════════════════════════════════════════════════════════════════
 * v19-98: 🌳 백지테스트 범위 — «매쓰플랫 7단계 단원 트리 그대로»
 *   원장 지시 2026-10-10: 「매쓰플랫에서 학습지 만들 때 DB 선택을 이렇게 자세히 할 수 있다. 이것을 그대로 가져와서 만들 수 있게 하자.
 *   백지테스트 내용이 더 풍부해야 한다.」 (시안 docs/mockup_bt_tree.html — 원장 승인: 소단원 칩을 트리로 · 3부 기본 = 교과서+대표 문항 섞기)
 *
 *  [왜] 소단원 칩까지만 고를 수 있어 AI 가 받는 재료가 «소단원 + 개념 이름 몇 개»뿐이었다. 매쓰플랫은 개념 아래
 *       주제유형 → 세부유형(공통수학1 하나에 5천 개 넘게)까지 있고, 세부유형마다 대표 문항 그림이 있다.
 *  [무엇]
 *   · 수집기(sync/mathflat_collector.js --tree-only · 일요일 새벽 4시 회차)가 과정마다 트리를 lumen_store 'mf_tree_22_<과정>' 에 둔다.
 *     학원앱은 고른 과정 것만 받는다(없으면 'mf_tree_15_<과정>'). 아직 없으면 안내 한 줄 + 예전 소단원 칩 그대로.
 *   · 소단원 칩 자리에 트리: 대단원 → 중단원 → 소단원 → 개념 → 주제유형 → 세부유형. 체크는 매쓰플랫과 같다
 *     (위를 체크하면 아래 전부, 아래 하나를 끄면 그것만 빠지고 위는 「–」). 빠르게: 「<대단원> 전부」「이 소단원만」「모두 해제」.
 *   · 고른 것 = BT.cfg.sel = { big, cids:[개념ID…], exT:[뺀 주제유형ID…], exU:[뺀 세부유형ID…] } — 매쓰플랫 학습지 만들기가 받는 값과 같은 모양.
 *     시험지(초안·보관함)에 sel 로 함께 저장되고, 보관함에서 열면 돌아온다. bt2Picked() 는 여기서 소단원 목록을 만들어 예전 코드가 그대로 돈다.
 *   · AI 지시: [이번 시험 범위 — 개념 › 주제유형 › 세부유형] 줄을 준다. 문항마다 "s" 에 어느 세부유형에서 왔는지 쓴다.
 *     채팅으로 고치기에서 세부유형·주제유형 이름을 말하면(「내림차순 정리 1문제 더」) 트리에서 찾아 범위에 넣고 AI 에 준다.
 *   · 3부 출처: 「교과서+대표 문항 섞기(기본) · 대표 문항만 · 교과서만」. 대표 문항 = 고른 세부유형의 매쓰플랫 대표 문항 그림.
 *     한 문항만 정답을 받는 주소가 매쓰플랫에 없어 답지에는 「정답은 매쓰플랫 문제 ID ○○」로 적는다.
 *   · 채팅 빠른 말 「세부유형 대표 문항 2개 더」 — AI 없이 바로 넣는다.
 *  이 부품은 bt2Picked · bt2EnsureCfg · bt2Course · rBtMake · bt2PromptHead · bt2Rules · btPrompt · bt2ChatPrompt · bt2TbRef · bt2TbRe ·
 *  bt2SheetHtml · bt2KeyHtml · btCfg · btGen · btOpen · btSave · bt2ChatSay · bt2ChatHtml · bt2ChatSend 를 감싸거나 다시 쓰고,
 *  v19-97 이 감싼 편집 칸 바탕(_rBtDraft96)을 대표 문항 줄이 들어간 것으로 바꾼다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
BT.cfg.p3src=BT.cfg.p3src||'mix';
if(BT.cfg.sel===undefined) BT.cfg.sel=null;
BT.tree=BT.tree||{ course:'', data:null, loading:false, done:false, err:'', open:{}, scroll:0, focus:'', ix:null };
var BT2_TREE_TOK=0;
var BT2_TREE_CACHE={}, BT2_TREE_CACHE_ORD=[];   // 과정을 오갈 때 다시 받지 않게 — 최근 4과정
(function(){ try{ if(!document.getElementById('bt2-tree-css')){ var s=document.createElement('style'); s.id='bt2-tree-css'; s.textContent=''
  +'#bt2-tree{max-height:420px;overflow:auto;background:#fff}'
  +'.bt2-tn{display:grid;grid-template-columns:16px 18px minmax(0,1fr) auto;gap:5px;align-items:center;padding:4px 8px;border-bottom:1px solid #f1f4f9;font-size:12.5px;cursor:pointer;min-width:0;color:#0d2240}'
  +'.bt2-tn:hover{background:#f3f7ff}.bt2-tn .ar{font-size:9.5px;color:#94a3b8;text-align:center}'
  +'.bt2-tn .cb{width:15px;height:15px;border:1.5px solid #94a3b8;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:900;color:#fff;background:#fff;box-sizing:border-box}'
  +'.bt2-tn .cb.on{background:#1d6fe8;border-color:#1d6fe8}.bt2-tn .cb.half{border-color:#1d6fe8;color:#1d6fe8}'
  +'.bt2-tn .nm{min-width:0;overflow-wrap:anywhere;line-height:1.45}.bt2-tn .d0,.bt2-tn .d1{font-weight:900}.bt2-tn .d2,.bt2-tn .d3{font-weight:800}.bt2-tn .d4{font-weight:700}.bt2-tn .d5{font-weight:500;font-size:12px;color:#334155}'
  +'.bt2-tn .bd{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:5px;background:#eef2f8;color:#64748b;margin-left:4px;white-space:nowrap}'
  +'.bt2-tn .bd.img{background:#e0f2fe;color:#0e7490;cursor:zoom-in}.bt2-tn .lv{display:inline-block;font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;margin-right:4px}'
  +'.bt2-tn .lv.l4{background:#fff7e6;color:#b45309}.bt2-tn .lv.l5{background:#e0f2fe;color:#0e7490}';
  document.head.appendChild(s); } }catch(e){} })();

/* ── 트리 받기: lumen_store 'mf_tree_22_<과정>' (없으면 15개정) ── */
function bt2TrOn(){ return !!(BT.tree&&BT.tree.data&&BT.tree.course===BT.cfg.course); }
function bt2TreeLoad(course){
  course=String(course||'');
  var T=BT.tree;
  if(T&&T.course===course&&(T.loading||T.done)) return Promise.resolve(T.data);
  var tok=++BT2_TREE_TOK;                         // 과정을 바꾸는 사이 늦게 끝난 옛 요청이 덮어쓰지 않게
  BT.tree={ course:course, data:null, loading:true, done:false, err:'', open:{}, scroll:0, focus:'', ix:null };
  if(BT2_TREE_CACHE[course]){ BT.tree.loading=false; BT.tree.done=true; BT.tree.data=BT2_TREE_CACHE[course]; bt2TrIndex(); return Promise.resolve(BT.tree.data); }
  var fin=function(v,err){ if(tok!==BT2_TREE_TOK) return null; BT.tree.loading=false; BT.tree.done=true; BT.tree.data=v||null; BT.tree.err=err||'';
    if(v){ bt2TrIndex(); BT2_TREE_CACHE[course]=v; BT2_TREE_CACHE_ORD=BT2_TREE_CACHE_ORD.filter(function(c){ return c!==course; }).concat([course]); while(BT2_TREE_CACHE_ORD.length>4) delete BT2_TREE_CACHE[BT2_TREE_CACHE_ORD.shift()]; }
    if(btPainting()) render(); return v||null; };
  var sb=null; try{ sb=(typeof getSupaClient==='function')?getSupaClient():null; }catch(e){}
  if(!sb||!course) return Promise.resolve(fin(null,''));
  var get=function(k){
    try{ return Promise.resolve(sb.from('lumen_store').select('value').eq('key',k)).then(function(r){
      var d=r&&r.data; var row=Array.isArray(d)?d[0]:d; var v=row&&row.value;
      if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
      return (v&&Array.isArray(v.b)&&v.b.length)?v:null; }); }
    catch(e){ return Promise.reject(e); }
  };
  return get('mf_tree_22_'+course).then(function(v){ return v||get('mf_tree_15_'+course); })
    .then(function(v){ return fin(v,''); })
    .catch(function(e){ return fin(null,(e&&e.message)||String(e)); });
}
window.bt2TreeReload=function(){ delete BT2_TREE_CACHE[BT.cfg.course]; BT.tree.done=false; BT.tree.loading=false; BT.tree.course=''; bt2TreeLoad(BT.cfg.course); render(); };
/* 찾기 표: 열쇠(b:/m:/s:/c:/t:/u: + ID) → 마디 · 깊이 · 부모 열쇠 · 아이들 열쇠 */
function bt2TrIndex(){
  var D=BT.tree.data; var ix={ N:{}, C:{}, T:{}, U:{}, cons:[] };
  var put=function(k,n,d,p,kids){ ix.N[k]={ k:k, n:n, d:d, p:p, kids:kids }; };
  (D.b||[]).forEach(function(B){ var bk='b:'+B.id; var mk=[];
    (B.m||[]).forEach(function(M){ var mkk='m:'+M.id; mk.push(mkk); var sk=[];
      (M.s||[]).forEach(function(L){ var skk='s:'+L.id; sk.push(skk); var ck=[];
        (L.c||[]).forEach(function(C){ C.t=Array.isArray(C.t)?C.t:[]; var ckk='c:'+C.id; ck.push(ckk); var tk=[];
          ix.C[C.id]={ C:C, L:L, M:M, B:B }; ix.cons.push(C);
          C.t.forEach(function(T){ T.u=Array.isArray(T.u)?T.u:[]; var tkk='t:'+T.id; tk.push(tkk); var uk=[];
            ix.T[T.id]={ T:T, C:C };
            T.u.forEach(function(U){ var ukk='u:'+U.id; uk.push(ukk); ix.U[U.id]={ U:U, T:T, C:C }; put(ukk,U,5,tkk,[]); });
            put(tkk,T,4,ckk,uk); });
          put(ckk,C,3,skk,tk); });
        put(skk,L,2,mkk,ck); });
      put(mkk,M,1,bk,sk); });
    put(bk,B,0,'',mk); });
  BT.tree.ix=ix;
}
/* 이 마디 아래 개념들 */
function bt2TrConsUnder(k){ var ix=BT.tree.ix; var N=ix&&ix.N[k]; if(!N) return []; if(N.d===3) return [N.n]; if(N.d>3) return []; var out=[]; N.kids.forEach(function(c){ out=out.concat(bt2TrConsUnder(c)); }); return out; }
function bt2TrConOf(k){ var ix=BT.tree.ix; var N=ix&&ix.N[k]; while(N&&N.d>3) N=ix.N[N.p]; return (N&&N.d===3)?N.n:null; }
function bt2TrSubOf(k){ var ix=BT.tree.ix; var N=ix&&ix.N[k]; while(N&&N.d>2) N=ix.N[N.p]; return (N&&N.d===2)?N.k:''; }

/* ── 고른 것: 개념 체크 + 뺀 주제유형·세부유형 ── */
function bt2SelEmpty(){ return { big:'', cids:[], exT:[], exU:[] }; }
function bt2SelCopy(){ var s=BT.cfg.sel||bt2SelEmpty(); return { big:String(s.big||''), cids:(s.cids||[]).slice(), exT:(s.exT||[]).slice(), exU:(s.exU||[]).slice() }; }
function bt2SelSets(){ var s=BT.cfg.sel||bt2SelEmpty(); var o={ c:{}, t:{}, u:{} }; (s.cids||[]).forEach(function(x){ o.c[x]=1; }); (s.exT||[]).forEach(function(x){ o.t[x]=1; }); (s.exU||[]).forEach(function(x){ o.u[x]=1; }); return o; }
/* 상태: 0 = 꺼짐 · 1 = 일부(–) · 2 = 전부(✓) */
function bt2StAgg(a){ if(!a.length) return 0; var all=true, any=false; a.forEach(function(v){ if(v!==2) all=false; if(v) any=true; }); return all?2:(any?1:0); }
function bt2StT(C,T,S){ if(!S.c[C.id]||S.t[T.id]) return 0; if(!T.u.length) return 2; var on=0; T.u.forEach(function(U){ if(!S.u[U.id]) on++; }); return on===T.u.length?2:(on?1:0); }
function bt2StC(C,S){ if(!S.c[C.id]) return 0; if(!C.t.length) return 2; return bt2StAgg(C.t.map(function(T){ return bt2StT(C,T,S); })); }
/* 마디 하나의 상태 (세부유형까지) */
function bt2TrState(k,S){
  var ix=BT.tree.ix; var N=ix&&ix.N[k]; if(!N) return 0; S=S||bt2SelSets();
  if(N.d===5){ var e=ix.U[N.n.id]; return (S.c[e.C.id]&&!S.t[e.T.id]&&!S.u[N.n.id])?2:0; }
  if(N.d===4){ var e2=ix.T[N.n.id]; return bt2StT(e2.C,N.n,S); }
  if(N.d===3) return bt2StC(N.n,S);
  return bt2StAgg(N.kids.map(function(c){ return bt2TrState(c,S); }));
}
/* 개념 하나를 «잎마다 켜짐/꺼짐»(f) 으로 다시 적는다 */
function bt2TrEncode(C,f){
  var s=BT.cfg.sel||bt2SelEmpty(); var tids={}, uids={};
  C.t.forEach(function(T){ tids[T.id]=1; T.u.forEach(function(U){ uids[U.id]=1; }); });
  var cids=(s.cids||[]).filter(function(x){ return String(x)!==String(C.id); });
  var exT=(s.exT||[]).filter(function(x){ return !tids[x]; }), exU=(s.exU||[]).filter(function(x){ return !uids[x]; });
  var any=false;
  if(!C.t.length) any=!!f(null,null);
  C.t.forEach(function(T){
    if(!T.u.length){ if(f(T,null)) any=true; else exT.push(T.id); return; }
    var on=T.u.filter(function(U){ return f(T,U); });
    if(!on.length){ exT.push(T.id); return; }
    any=true; T.u.forEach(function(U){ if(!f(T,U)) exU.push(U.id); });
  });
  if(any) cids.push(C.id);
  else { exT=exT.filter(function(x){ return !tids[x]; }); exU=exU.filter(function(x){ return !uids[x]; }); }
  BT.cfg.sel={ big:String(s.big||''), cids:cids, exT:exT, exU:exU };
}
/* 마디 켜기/끄기 — 위는 아래 전부, 아래 하나는 그것만 */
function bt2TrSet(k,on){
  var ix=BT.tree.ix; var N=ix&&ix.N[k]; if(!N) return;
  if(!BT.cfg.sel) BT.cfg.sel=bt2SelEmpty();
  if(N.d<=3){ bt2TrConsUnder(k).forEach(function(C){ bt2TrEncode(C,function(){ return on; }); }); return; }
  var S=bt2SelSets(); var C=bt2TrConOf(k);
  var cur=function(T,U){ return !!(S.c[C.id]&&T&&!S.t[T.id]&&!(U&&S.u[U.id])); };
  if(N.d===4) bt2TrEncode(C,function(T,U){ return (T&&T.id===N.n.id)?on:cur(T,U); });
  else bt2TrEncode(C,function(T,U){ return (U&&U.id===N.n.id)?on:cur(T,U); });
}
/* 고른 것 → BT.cfg.big(첫 개념의 대단원) · BT.cfg.subs(소단원 열쇠) 맞추기 */
function bt2TrSync(){
  var ix=BT.tree.ix; if(!ix||!BT.cfg.sel) return;
  var S=bt2SelSets(); var first=null; var subs=[];
  ix.cons.forEach(function(C){ if(bt2StC(C,S)){ var e=ix.C[C.id]; if(!first) first=e; var k=bt2SubKey(e.M.n,e.L.n); if(subs.indexOf(k)<0) subs.push(k); } });
  if(first){ BT.cfg.big=String(first.B.n); BT.cfg.sel.big=BT.cfg.big; }
  BT.cfg.subs=subs;
}
/* 대단원 하나를 열고 그 아래 중단원·소단원도 연다 (개념은 닫힌 채) */
function bt2TrOpenBig(bk){ var ix=BT.tree.ix; var N=ix&&ix.N[bk]; if(!N) return; BT.tree.open[bk]=true; N.kids.forEach(function(mk){ BT.tree.open[mk]=true; ix.N[mk].kids.forEach(function(sk){ BT.tree.open[sk]=true; }); }); }
/* 트리가 처음 보일 때: 고른 것이 없으면 만든다 (보관함 옛 시험지의 소단원이 있으면 그것으로, 아니면 첫 대단원의 첫 중단원) */
function bt2TrEnsureSel(){
  var ix=BT.tree.ix; if(!ix) return;
  var D=BT.tree.data;
  if(!BT.cfg.sel||!Array.isArray(BT.cfg.sel.cids)){
    var sel=bt2SelEmpty(); var subs=BT.cfg.subs||[];
    if(BT.cfg.selFromSubs&&subs.length){
      var snames=subs.map(function(x){ return String(x).split('|').pop(); });   // 열쇠(중단원|소단원)도 이름도 — 유형DB 와 트리의 중단원 이름이 달라도 소단원 이름으로 맞춘다
      ix.cons.forEach(function(C){ var e=ix.C[C.id]; if(subs.indexOf(bt2SubKey(e.M.n,e.L.n))>=0||snames.indexOf(String(e.L.n))>=0) sel.cids.push(C.id); });
    }
    if(!sel.cids.length){ var B0=(D.b||[])[0]; var M0=B0&&(B0.m||[])[0]; if(M0) (M0.s||[]).forEach(function(L){ (L.c||[]).forEach(function(C){ sel.cids.push(C.id); }); }); }
    BT.cfg.sel=sel; BT.cfg.selFromSubs=false; bt2TrSync();
  }
  if(!Object.keys(BT.tree.open).length){
    var S=bt2SelSets(); var fb=null;
    ix.cons.some(function(C){ if(bt2StC(C,S)){ fb=ix.C[C.id].B; return true; } return false; });
    fb=fb||(D.b||[])[0]; if(fb) bt2TrOpenBig('b:'+fb.id);
  }
}
/* 고른 소단원 [{m, s, t:[체크된 개념 이름…]}] — 교과서 문항 고르기 · 이름표 · 예전 지시문이 이걸 쓴다 */
function bt2TrPicked(){
  var D=BT.tree.data; var S=bt2SelSets(); var out=[];
  (D.b||[]).forEach(function(B){ (B.m||[]).forEach(function(M){ (M.s||[]).forEach(function(L){
    var ts=(L.c||[]).filter(function(C){ return bt2StC(C,S); }).map(function(C){ return String(C.n); });
    if(ts.length) out.push({ m:String(M.n), s:String(L.n), t:ts }); }); }); });
  return out;
}
var _bt2Picked97=bt2Picked;
bt2Picked=function(){ if(bt2TrOn()&&BT.cfg.sel&&Array.isArray(BT.cfg.sel.cids)) return bt2TrPicked(); return _bt2Picked97.apply(this,arguments); };
var _bt2EnsureCfg97=bt2EnsureCfg;
bt2EnsureCfg=function(stu){ var r=_bt2EnsureCfg97.apply(this,arguments); if(r&&bt2TrOn()&&BT.cfg.sel){ var big=BT.cfg.big; bt2TrSync(); if(!BT.cfg.big) BT.cfg.big=big; } return r; };
var _bt2Course97=window.bt2Course;
window.bt2Course=function(c){ BT.cfg.sel=null; BT.cfg.selFromSubs=false; return _bt2Course97.apply(this,arguments); };

/* ── 트리 화면 ── */
window.bt2TreeClick=function(e){
  var t=e&&e.target; if(!t||!t.closest) return;
  var row=t.closest('[data-k]'); if(!row) return;
  var k=row.getAttribute('data-k'); var ix=BT.tree.ix; var N=ix&&ix.N[k]; if(!N) return;
  var im=t.closest('[data-img]');
  if(im){ var u=im.getAttribute('data-img'); try{ if(u&&typeof openPhotoFull==='function') openPhotoFull(u); }catch(e2){} return; }
  var sk=bt2TrSubOf(k); if(sk) BT.tree.focus=sk;
  if(t.closest('[data-cb]')||!N.kids.length){ var st=bt2TrState(k); bt2TrSet(k,st!==2); bt2TrSync(); render(); return; }
  BT.tree.open[k]=!BT.tree.open[k]; render();
};
window.bt2TrQuickBig=function(bid){ var ix=BT.tree.ix; if(!ix) return; BT.cfg.sel=bt2SelEmpty(); bt2TrSet('b:'+bid,true); bt2TrSync(); bt2TrOpenBig('b:'+bid); BT.tree.focus=''; render(); };
window.bt2TrQuickSub=function(){ var ix=BT.tree.ix; var k=BT.tree.focus; if(!ix||!ix.N[k]) return; BT.cfg.sel=bt2SelEmpty(); bt2TrSet(k,true); bt2TrSync(); BT.tree.open[k]=true; var p=ix.N[k].p; if(p){ BT.tree.open[p]=true; if(ix.N[p].p) BT.tree.open[ix.N[p].p]=true; } render(); };
window.bt2TrClear=function(){ BT.cfg.sel=bt2SelEmpty(); bt2TrSync(); render(); };
/* 고른 수 — 개념 · 주제유형 · 세부유형 */
function bt2TrCounts(){
  var ix=BT.tree.ix; var S=bt2SelSets(); var n={ c:0, t:0, u:0 };
  if(ix) ix.cons.forEach(function(C){ var st=bt2StC(C,S); if(!st) return; n.c++;
    if(!C.t.length){ n.t+=Number(C.tc)||0; n.u+=Number(C.sc)||0; return; }
    C.t.forEach(function(T){ if(!bt2StT(C,T,S)) return; n.t++; T.u.forEach(function(U){ if(!S.u[U.id]) n.u++; }); }); });
  return n;
}
function bt2TreeRows(){
  var ix=BT.tree.ix, D=BT.tree.data; var S=bt2SelSets(); var h='';
  var walk=function(k){
    var N=ix.N[k]; var n=N.n; var st=bt2TrState(k,S); var cnt='';
    if(N.d===2) cnt='<span class="bd">개념 '+(n.c||[]).length+'</span>';
    else if(N.d===3){ var tc=n.t.length?n.t.length:(Number(n.tc)||0); var sc=n.t.length?n.t.reduce(function(a,T){ return a+T.u.length; },0):(Number(n.sc)||0);
      cnt='<span class="bd">주제유형 '+tc+'</span><span class="bd">세부유형 '+sc+'</span>'+(n.t.length?'':'<span class="bd">유형 정보 없음</span>'); }
    else if(N.d===5&&n.pid&&n.img) cnt='<span class="bd img" data-img="'+esc2(n.img)+'" title="대표 문항 그림 보기">그림</span>';
    var ar=N.kids.length?(BT.tree.open[k]?'▼':'▶'):'';
    h+='<div class="bt2-tn" data-k="'+k+'" style="padding-left:'+(8+N.d*15)+'px"><span class="ar">'+(ar||'·')+'</span>'
      +'<span class="cb'+(st===2?' on':(st===1?' half':''))+'" data-cb="1">'+(st===2?'✓':(st===1?'–':''))+'</span>'
      +'<span class="nm d'+N.d+'">'+(N.d===4?'<span class="lv l4">주제유형</span>':(N.d===5?'<span class="lv l5">세부유형</span>':''))+esc2(n.n)+'</span><span>'+cnt+'</span></div>';
    if(N.kids.length&&BT.tree.open[k]) N.kids.forEach(walk);
  };
  (D.b||[]).forEach(function(B){ walk('b:'+B.id); });
  return h;
}
function bt2TreeHtml(){
  var D=BT.tree.data, ix=BT.tree.ix; var S=bt2SelSets();
  var qb=function(l,on,fn,ttl){ return '<button onclick="'+fn+'" title="'+(ttl||'')+'" style="font-family:inherit;font-size:11px;font-weight:900;border-radius:50px;padding:4px 10px;cursor:pointer;white-space:nowrap;'+(on?'background:#0d2240;color:#fff;border:1.5px solid #0d2240':'background:#fff;color:#475569;border:1.5px solid #e6eaf1')+'">'+l+'</button>'; };
  var h='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:7px"><span style="font-size:10.5px;font-weight:900;color:#94a3b8;letter-spacing:.03em;margin-right:4px;white-space:nowrap">빠르게</span>';
  var bst=(D.b||[]).map(function(B){ return bt2TrState('b:'+B.id,S); });
  (D.b||[]).forEach(function(B,i){ var only=bst[i]===2&&bst.every(function(v,j){ return j===i||!v; }); h+=qb(esc2(B.n)+' 전부',only,'bt2TrQuickBig('+Number(B.id)+')','이 대단원만 전부 고르기'); });
  var fk=BT.tree.focus; if(fk&&ix.N[fk]) h+=qb('이 소단원만 <span style="opacity:.7">('+esc2(ix.N[fk].n.n)+')</span>',false,'bt2TrQuickSub()','마지막으로 누른 소단원만 고르기');
  h+=qb('모두 해제',false,'bt2TrClear()')+'</div>';
  var n=bt2TrCounts();
  h+='<div style="border:1px solid #e6eaf1;border-radius:12px;overflow:hidden;margin-bottom:8px">'
    +'<div style="background:#f1f5fb;padding:7px 10px;font-size:11px;font-weight:800;color:#64748b;display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><span>🌳 범위 고르기 — 매쓰플랫 단원 트리 ('+esc2(String(D.rev||'22'))+'개정 · '+esc2(D.label||BT.cfg.course)+') · 위를 체크하면 아래 전부, 아래 하나를 끄면 그것만 빠집니다</span>'
    +'<span><span style="display:inline-block;font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;background:#fff7e6;color:#b45309;margin-right:4px">주제유형</span><span style="display:inline-block;font-size:10px;font-weight:900;padding:1px 6px;border-radius:5px;background:#e0f2fe;color:#0e7490">세부유형 · 그림 = 대표 문항</span></span></div>'
    +'<div id="bt2-tree" onclick="bt2TreeClick(event)" onscroll="BT.tree.scroll=this.scrollTop">'+bt2TreeRows()+'</div></div>';
  var picked=bt2Picked();
  h+='<div style="font-size:11.5px;font-weight:800;color:#64748b;margin-bottom:9px">고른 범위 <b style="color:#0d2240">개념 '+n.c+' · 주제유형 '+n.t+' · 세부유형 '+n.u.toLocaleString()+'</b>'
    +(picked.length?' — 소단원 '+esc2(picked.map(function(x){ return x.s; }).join(' · ')):' (하나 이상 고르세요)')+'</div>';
  setTimeout(function(){ var el=document.getElementById('bt2-tree'); if(el&&BT.tree.scroll) el.scrollTop=BT.tree.scroll; },0);
  return h;
}
/* rBtMake 를 감싼다 — 대단원 칩 줄 ~ 「고른 소단원」 줄을 트리로 바꾸고, 3부 출처 고르기를 붙인다 */
var BT2_MK_BIG='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:7px"><span style="font-size:10.5px;font-weight:900;color:#94a3b8;letter-spacing:.03em;margin-right:4px;white-space:nowrap">대단원</span>';
var BT2_MK_PICK='<div style="font-size:11.5px;font-weight:800;color:#64748b;margin-bottom:9px">고른 소단원';
var _rBtMake97=rBtMake;
rBtMake=function(){
  if(bt2TrOn()) bt2TrEnsureSel();
  var h=_rBtMake97.apply(this,arguments);
  if(!BT.stu||!BT.cfg.course) return h;
  if(BT.tree.course!==BT.cfg.course||(!BT.tree.loading&&!BT.tree.done)) bt2TreeLoad(BT.cfg.course);
  var a=h.indexOf(BT2_MK_BIG); if(a<0) return h;
  if(!bt2TrOn()){
    var msg=BT.tree.loading?'🌳 매쓰플랫 단원 트리를 불러오는 중…'
      :(BT.tree.err?('🌳 매쓰플랫 단원 트리를 불러오지 못했습니다 — 아래 소단원 칩으로 고르세요 <button onclick="bt2TreeReload()" style="font-family:inherit;font-size:10.5px;font-weight:900;border-radius:7px;padding:2px 7px;cursor:pointer;background:#fff;color:#1d6fe8;border:1px solid #cfe0fb">다시</button>')
      :'🌳 매쓰플랫 단원 트리를 아직 받지 않았습니다 (새벽 수집 뒤 생깁니다) — 지금은 아래 소단원 칩으로 고르세요');
    return h.slice(0,a)+'<div style="font-size:11px;font-weight:800;color:#94a3b8;margin-bottom:6px">'+msg+'</div>'+h.slice(a);
  }
  var p=h.indexOf(BT2_MK_PICK,a); var e=(p>=0)?h.indexOf('</div>',p):-1; if(e<0) return h;
  h=h.slice(0,a)+bt2TreeHtml()+h.slice(e+6);
  /* 3부 출처 */
  if(BT.cfg.p3mode==='tb'){
    var src=BT.cfg.p3src||'mix';
    var sel='<label style="font-size:11px;font-weight:800;color:#64748b;display:flex;align-items:center;gap:5px">출처 <select onchange="btCfg(\'p3src\',this.value)" style="font-family:inherit;font-size:12px;font-weight:800;padding:6px;border:1.5px solid #e6eaf1;border-radius:9px;background:#fff">'
      +'<option value="mix"'+(src==='mix'?' selected':'')+'>교과서+대표 문항 섞기 (기본)</option><option value="rep"'+(src==='rep'?' selected':'')+'>세부유형 대표 문항만</option><option value="tb"'+(src==='tb'?' selected':'')+'>교과서만</option></select></label>';
    var m='>없음</option></select></label>'; var q=h.indexOf(m); if(q>=0) h=h.slice(0,q+m.length)+sel+h.slice(q+m.length);
    if(src!=='tb') h=h.replace('⚠ 이 과정의 교과서 은행이 없어 3부를 못 넣습니다 (AI 창작이나 없음으로)','⚠ 이 과정의 교과서 은행이 없어 3부는 세부유형 대표 문항으로만 채웁니다');
  }
  return h;
};

/* ── AI 지시: 개념 › 주제유형 › 세부유형 ── */
function bt2TrPromptLines(){
  var ix=BT.tree.ix; var S=bt2SelSets(); var L=[];
  if(!ix) return L;
  ix.cons.forEach(function(C){ var st=bt2StC(C,S); if(!st) return; var e=ix.C[C.id];
    if(!C.t.length){ L.push('· ['+e.L.n+'] '+C.n); return; }
    C.t.forEach(function(T){ var ts=bt2StT(C,T,S); if(!ts) return;
      var head='· ['+e.L.n+' › '+C.n+'] '+T.n;
      if(!T.u.length) L.push(head);
      else if(ts===2) L.push(head+' (세부유형 '+T.u.length+'개 전부)');
      else L.push(head+' — 세부유형: '+T.u.filter(function(U){ return !S.u[U.id]; }).map(function(U){ return U.n; }).join(' / ')); });
  });
  return L;
}
var BT2_PROMPT_CAP=160;
var _bt2PromptHead97=bt2PromptHead;
bt2PromptHead=function(mat, stu){
  var h=_bt2PromptHead97.apply(this,arguments);
  if(!bt2TrOn()||!BT.cfg.sel) return h;
  var a=h.indexOf('[이번 시험 범위 — 소단원과 그 유형]\n'); var b=h.indexOf('\n\n[이 학생이 약한 유형',a); if(a<0||b<0) return h;
  var L=bt2TrPromptLines(); var more=L.length>BT2_PROMPT_CAP?('\n… 외 '+(L.length-BT2_PROMPT_CAP)+'줄'):'';
  return h.slice(0,a)+'[이번 시험 범위 — 개념 › 주제유형 › 세부유형]\n'+(L.slice(0,BT2_PROMPT_CAP).join('\n')||'· (고른 것이 없습니다)')+more+h.slice(b);
};
var _bt2Rules97=bt2Rules;
bt2Rules=function(n, withS){
  var r=_bt2Rules97.apply(this,arguments);
  if(!bt2TrOn()||!BT.cfg.sel) return r;
  return r.replace('6. "s" 에는 그 문항이 속한 소단원 이름을 위 목록에 적힌 그대로 씁니다.\n','6. "s" 에는 그 문항이 나온 세부유형(세부유형 이름이 없으면 주제유형, 그것도 없으면 개념) 이름을 위 범위 목록에 적힌 그대로 씁니다.\n');
};
var _btPrompt97=btPrompt;
btPrompt=function(){ var p=_btPrompt97.apply(this,arguments); return (bt2TrOn()&&BT.cfg.sel)?p.replace('"s":"소단원"}','"s":"세부유형"}'):p; };
var _bt2ChatPrompt97=bt2ChatPrompt;
bt2ChatPrompt=function(){ var p=_bt2ChatPrompt97.apply(this,arguments); return (bt2TrOn()&&BT.cfg.sel)?p.split('"s":"소단원"}').join('"s":"세부유형"}'):p; };

/* ── 3부: 세부유형 대표 문항 ── */
function bt2RepItem(U,T,C){ return { id:'rep:'+U.pid, pid:U.pid, pimg:String(U.img||''), page:'', no:'', s:String(U.n), topic:String(T.n), answer:'', rep:true, uid:U.id, cid:C.id }; }
/* 고른 세부유형 중 그림이 있는 것 — 개념별 (주제유형을 번갈아 섞어 한 개념 안에서도 고르게) */
function bt2RepGroups(){
  var ix=BT.tree.ix; var S=bt2SelSets(); var groups=[]; if(!ix) return groups;
  ix.cons.forEach(function(C){ if(!S.c[C.id]) return;
    var lists=C.t.filter(function(T){ return !S.t[T.id]; }).map(function(T){ return T.u.filter(function(U){ return !S.u[U.id]&&U.pid&&U.img; }).map(function(U){ return bt2RepItem(U,T,C); }); });
    var q=[]; var mx=0; lists.forEach(function(l){ mx=Math.max(mx,l.length); });
    for(var i=0;i<mx;i++) lists.forEach(function(l){ if(l[i]) q.push(l[i]); });
    if(q.length) groups.push(q); });
  return groups;
}
/* n개 고르기 — 고른 개념들에 고르게 퍼지게(처음엔 띄엄띄엄, 모자라면 돌아가며) · usedPid 에 있는 문제는 빼고 */
function bt2RepPick(n, usedPid){
  usedPid=usedPid||{}; var out=[]; n=Number(n)||0; if(n<=0) return out;
  var G=bt2RepGroups().map(function(q){ return q.filter(function(x){ return !usedPid[String(x.pid)]; }); }).filter(function(q){ return q.length; });
  if(!G.length) return out;
  var take=function(q){ while(q.length){ var x=q.shift(); if(!usedPid[String(x.pid)]){ usedPid[String(x.pid)]=1; out.push(x); return true; } } return false; };
  var k=Math.min(n,G.length);
  for(var i=0;i<k&&out.length<n;i++) take(G[Math.floor(i*G.length/k)]);
  var guard=0; while(out.length<n&&guard++<500){ var any=false; for(var j=0;j<G.length&&out.length<n;j++) if(take(G[j])) any=true; if(!any) break; }
  return out;
}
function bt2P3Used(d){ var u={}; ((d&&d.p3)||[]).forEach(function(x){ if(x&&x.pid) u[String(x.pid)]=1; }); return u; }
/* 3부 다시 짜기 (출처에 따라) */
function bt2P3Build(n){
  var src=BT.cfg.p3src||'mix'; n=Number(n)||0;
  if(!bt2TrOn()||src==='tb') return bt2TbPick(n,{});
  if(src==='rep') return bt2RepPick(n,{});
  var tb=bt2TbPick(n,{}); return tb.concat(bt2RepPick(n-tb.length, bt2P3Used({ p3:tb })));
}
var _bt2TbRef97=bt2TbRef;
bt2TbRef=function(x){ if(x&&x.rep) return '매쓰플랫 대표 문항 (문제 ID '+x.pid+')'; return _bt2TbRef97.apply(this,arguments); };
/* 🔄 대표 문항 바꾸기 — 같은 주제유형의 다른 세부유형 → 같은 개념의 다른 주제유형 (고른 것 먼저, 한 번 본 것은 다시 안 나오게) */
window.bt2RepRe=function(i){
  var d=BT.draft; if(!d||!d.p3||!d.p3[i]) return; var x=d.p3[i];
  var ix=BT.tree.ix; if(!bt2TrOn()||!ix){ plToast('매쓰플랫 단원 트리를 불러온 뒤 다시 눌러 주세요'); return; }
  var e=ix.U[x.uid]; var C=(e&&e.C)||(ix.C[x.cid]&&ix.C[x.cid].C); if(!C){ plToast('이 대표 문항의 개념을 트리에서 찾지 못했습니다'); return; }
  var used=bt2P3Used(d); var seen={}; (x.seen||[]).concat([x.pid]).forEach(function(p){ seen[String(p)]=1; });
  var S=bt2SelSets(); var cands=[];
  var add=function(T){ T.u.forEach(function(U){ if(U.pid&&U.img&&!used[String(U.pid)]&&!seen[String(U.pid)]) cands.push({ it:bt2RepItem(U,T,C), on:!S.t[T.id]&&!S.u[U.id]&&!!S.c[C.id] }); }); };
  if(e) add(e.T); C.t.forEach(function(T){ if(!e||T.id!==e.T.id) add(T); });
  var pick=cands.filter(function(c){ return c.on; })[0]||cands[0];
  if(!pick){ if((x.seen||[]).length){ x.seen=[]; return window.bt2RepRe(i); } plToast('이 개념에 더 넣을 대표 문항이 없습니다'); return; }
  var nw=pick.it; nw.seen=(x.seen||[]).concat([x.pid]).slice(-40); d.p3[i]=nw; render();
};
window.bt2RepMore=function(n){ var d=BT.draft; if(!d) return; if(!bt2TrOn()){ plToast('매쓰플랫 단원 트리가 있어야 대표 문항을 넣을 수 있습니다'); return; }
  var got=bt2RepPick(Number(n)||1, bt2P3Used(d)); if(!got.length){ plToast('고른 세부유형에 더 넣을 대표 문항이 없습니다'); return; } d.p3=(d.p3||[]).concat(got); render(); };
var _bt2TbRe97=window.bt2TbRe;
window.bt2TbRe=function(i){ var d=BT.draft; if(d&&d.p3&&d.p3[i]&&d.p3[i].rep) return window.bt2RepRe(i); return _bt2TbRe97.apply(this,arguments); };
var _btCfg97=window.btCfg;
window.btCfg=function(k,v){
  if(k==='p3src'){ BT.cfg.p3src=String(v||'mix'); var d=BT.draft; if(d&&d.p3mode==='tb'){ d.p3=bt2P3Build(Number(BT.cfg.p3)||(d.p3||[]).length||0); d.p3src=BT.cfg.p3src; } render(); return; }
  return _btCfg97.apply(this,arguments);
};

/* ── 시험지 · 답지: 대표 문항 줄 ── */
function bt2P3Head(d){
  var nRep=(d.p3||[]).filter(function(x){ return x&&x.rep; }).length, nTb=(d.p3||[]).filter(function(x){ return x&&x.pimg&&!x.rep; }).length;
  return nRep&&nTb?'교과서 · 유형 대표 문항':(nRep?'유형 대표 문항':'교과서 문항');
}
bt2SheetHtml=function(d, forPrint){
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
    var anyImg=d.p3.some(function(x){ return x&&x.pimg; }); var anyTb=d.p3.some(function(x){ return x&&x.pimg&&!x.rep; });
    if(d.p3mode==='tb'||anyImg){ h+='<div class="pt">3부. '+bt2P3Head(d)+' <i>'+(anyTb?esc2(d.tb&&d.tb.title?eaTbShort(d.tb.title):'교과서')+' · ':'')+'정답은 뒷장(답지)에</i></div><div class="tbg">';
      d.p3.forEach(function(x,i){ var cap=x.rep?((i+1)+' · ['+esc2(x.s||'')+']'):((i+1)+' · ['+esc2(x.s||'')+'] '+esc2(bt2TbRef(x)));
        h+='<div class="pb"><div class="cap">'+cap+'</div>'+(x.pimg?'<img src="'+esc2(x.pimg)+'" alt="">':'')+'<div class="ws"></div></div>'; }); h+='</div>'; }
    else { h+='<div class="pt">3부. 연습문제 <i>AI 가 만든 문제</i></div>'; d.p3.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t">'+esc2(x.q)+'</span></div><div class="box"></div>'; }); }
  }
  if(d.note) h+='<div class="note">'+esc2(d.note)+'</div>';
  h+='<div class="ft">루멘수학 · 백지테스트</div></div>';
  return h;
};
bt2KeyHtml=function(d){
  var h='<div class="bt2-sheet bt2-key"><div class="hd"><div><b>'+esc2(d.title)+' — 채점용 답지</b><div class="sub">원장님만 보는 쪽</div></div></div>';
  if(d.p1.length){ h+='<div class="pt">1부. 개념 백지 모범답</div><table class="kt"><tr><th style="width:28px">번호</th><th>문항</th><th style="width:38%">모범답</th></tr>';
    d.p1.forEach(function(x,i){ h+='<tr><td>'+(i+1)+'</td><td>'+bt2Blank(x.q)+(x.s?'<div class="s">'+esc2(x.s)+'</div>':'')+'</td><td><b>'+esc2(x.a||'')+'</b></td></tr>'; }); h+='</table>'; }
  if(d.p2.length){ h+='<div class="pt">2부. 다시 풀기 — 교재 정답으로 채점</div>'; d.p2.forEach(function(x,i){ h+='<div class="q"><span class="n">'+(i+1)+'.</span><span class="t">'+esc2(x.book)+' '+esc2(x.no)+' <em class="s">'+esc2(x.why||'')+'</em></span></div>'; }); }
  if((d.p3||[]).length){ var img=(d.p3mode==='tb'||d.p3.some(function(x){ return x&&x.pimg; }));
    h+='<div class="pt">3부. '+(img?(d.p3.some(function(x){ return x&&x.rep; })?'정답 (대표 문항은 매쓰플랫에서 확인)':'교과서 정답'):'연습문제 답')+'</div><table class="kt"><tr><th style="width:28px">번호</th><th>문항</th><th style="width:44%">정답</th></tr>';
    d.p3.forEach(function(x,i){
      if(x.rep){ h+='<tr><td>'+(i+1)+'</td><td>매쓰플랫 대표 문항 — '+esc2(x.s||'')+(x.topic?'<div class="s">'+esc2(x.topic)+'</div>':'')+(x.pimg?'<img src="'+esc2(x.pimg)+'" alt="" style="max-width:100%;display:block;margin-top:3px">':'')+'</td><td>(정답은 매쓰플랫 문제 ID <b>'+esc2(String(x.pid))+'</b>)</td></tr>'; return; }
      h+='<tr><td>'+(i+1)+'</td><td>'+(x.pimg?esc2(bt2TbRef(x))+(x.s?'<div class="s">'+esc2(x.s)+'</div>':''):esc2(x.q||''))+'</td><td>'+(x.answer?'<b>'+esc2(bkCleanAnsSafe(x.answer))+'</b>':'')+(x.aimg?'<img src="'+esc2(x.aimg)+'" alt="" style="max-width:100%;display:block;margin-top:3px">':'')+(!x.answer&&!x.aimg&&x.a?'<b>'+esc2(x.a)+'</b>':'')+'</td></tr>'; });
    h+='</table>'; }
  h+='<div class="ft">루멘수학 · 채점용 답지</div></div>';
  return h;
};
/* 편집 칸 바탕 — v19-97 대화 상자가 감싸는 _rBtDraft96 을 대표 문항 줄이 들어간 것으로 바꾼다 */
_rBtDraft96=function(){
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
      +'<span style="display:flex;flex-direction:column;gap:3px">'+sm(busy?'⏳':'🔄 이 문항만 다시','bt2Re('+i+')','AI 가 같은 범위·같은 종류로 새로 씁니다')+'<span style="display:flex;gap:3px">'+sm('▲',"bt2Move('p1',"+i+",-1)")+sm('▼',"bt2Move('p1',"+i+",1)")+sm('✕',"btDel('p1',"+i+")")+'</span></span></div>';
  });
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;border-bottom:1.5px solid #0d2240;padding-bottom:3px;margin:14px 0 6px">2부. 틀린 문제 다시 풀기 <span style="font-size:10.5px;color:#64748b;font-weight:700">실제 채점 기록에서</span><span>'+sm('🔄 다시 고르기','btRe2()')+'</span></div>';
  if(!d.p2.length) h+='<div style="font-size:11.5px;color:#94a3b8;font-weight:700;padding:4px 0">틀린 기록이 없거나 2부를 0으로 두었습니다.</div>';
  d.p2.forEach(function(x,i){ h+='<div style="display:flex;gap:7px;align-items:center;padding:5px 9px;background:#f6f8fc;border-radius:8px;margin-bottom:4px;font-size:12px"><span style="font-weight:900;color:#94a3b8;width:16px">'+(i+1)+'</span><span style="flex:1;min-width:0;font-weight:800;color:#0d2240">'+esc2(x.label||(x.book+' '+x.no))+'</span><span style="font-size:10.5px;color:#64748b;font-weight:700">'+esc2(x.why||'')+'</span>'+sm('✕',"btDel('p2',"+i+")")+'</div>'; });
  var isTb=(d.p3mode==='tb'); var src=d.p3src||'tb'; var canRep=isTb&&src!=='tb';
  var p3t=isTb?(src==='rep'?'세부유형 대표 문항':(src==='mix'?'교과서 + 대표 문항':'교과서 문항')):(d.p3mode==='ai'?'연습문제 (AI)':'없음');
  h+='<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;font-weight:900;color:#0d2240;border-bottom:1.5px solid #0d2240;padding-bottom:3px;margin:14px 0 6px">3부. '+p3t+' <span style="font-size:10.5px;color:#64748b;font-weight:700">'+(isTb&&src!=='rep'?esc2(d.tb&&d.tb.title?d.tb.title:''):'')+'</span><span style="display:flex;gap:4px">'
    +(isTb&&src!=='rep'?sm('+ 교과서 1문항','bt2TbMore()'):'')+(canRep?sm('+ 대표 문항','bt2RepMore(1)','고른 세부유형의 매쓰플랫 대표 문항을 하나 더'):'')+(d.p3mode==='ai'?sm('+ 직접 쓰기',"btAdd('p3')"):'')+'</span></div>';
  (d.p3||[]).forEach(function(x,i){
    var ops='<span style="display:flex;flex-direction:column;gap:3px">'+sm('🔄 다른 문항',(x.rep?'bt2RepRe(':'bt2TbRe(')+i+')',x.rep?'같은 주제유형·같은 개념의 다른 세부유형 대표 문항으로':'')+'<span style="display:flex;gap:3px">'+sm('▲',"bt2Move('p3',"+i+",-1)")+sm('▼',"bt2Move('p3',"+i+",1)")+sm('✕',"btDel('p3',"+i+")")+'</span></span>';
    if(x.pimg){
      var title=x.rep?('매쓰플랫 대표 문항 · '+(x.s||'')):bt2TbRef(x);
      var sub=x.rep?((x.topic?('주제유형 '+x.topic+' · '):'')+'문제 ID '+x.pid):(esc2(x.s||'')+(x.answer?' · 정답 '+esc2(bkCleanAnsSafe(x.answer)).slice(0,24):''));
      h+='<div style="display:grid;grid-template-columns:18px 70px minmax(0,1fr) max-content;gap:7px;align-items:center;padding:5px 0;border-bottom:1px solid #f6f8fc;font-size:12px"><span style="font-weight:900;color:#94a3b8">'+(i+1)+'</span><img src="'+esc2(x.pimg)+'" alt="" style="width:70px;height:46px;object-fit:cover;object-position:left top;border:1px solid '+(x.rep?'#a5f3fc':'#e6eaf1')+';border-radius:5px;cursor:zoom-in" onclick="openPhotoFull('+bkQ2(x.pimg)+')"><span style="min-width:0;overflow:hidden"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'+(x.rep?';color:#0e7490':'')+'" title="'+esc2(title)+'">'+esc2(title)+'</b><div style="font-size:10.5px;color:#64748b;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(x.rep?esc2(sub):sub)+'</div></span>'+ops+'</div>'; }
    else { h+='<div style="display:grid;grid-template-columns:18px minmax(0,1fr) max-content;gap:6px;align-items:start;padding:6px 0;border-bottom:1px solid #f6f8fc"><span style="font-size:12px;font-weight:900;color:#94a3b8;padding-top:6px">'+(i+1)+'</span><span><textarea oninput="bt2Edit(\'p3\','+i+',\'q\',this.value)" rows="2" style="width:100%;box-sizing:border-box;font-family:inherit;font-size:12.5px;padding:6px 8px;border:1.5px solid #e6eaf1;border-radius:8px;resize:vertical">'+esc2(x.q||'')+'</textarea><input value="'+esc2(x.a||'')+'" oninput="bt2Edit(\'p3\','+i+',\'a\',this.value)" placeholder="답" style="width:100%;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:11.5px;padding:5px 8px;border:1.5px dashed #cbd5e1;border-radius:8px"></span>'+sm('✕',"btDel('p3',"+i+")")+'</div>'; }
  });
  h+='<div style="margin-top:10px"><label style="font-size:11px;font-weight:800;color:#64748b">아래에 붙일 한마디 (선택)<input value="'+esc2(d.note||'')+'" oninput="bt2Note(this.value)" placeholder="예: 다 쓰고 나서 교과서로 확인해 보세요" style="display:block;width:100%;box-sizing:border-box;margin-top:3px;font-family:inherit;font-size:12.5px;padding:7px 9px;border:1.5px solid #e6eaf1;border-radius:9px"></label></div>';
  h+='</div>';
  h+='<div style="min-width:0"><div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:#64748b;margin-bottom:5px"><span>🖨 인쇄 미리보기 (A4) — 고치면 바로 바뀝니다</span>'+sm('🔑 답지 보기','bt2KeyPeek()')+'</div>';
  h+='<div id="bt2-pv" style="border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 8px 24px rgba(13,34,64,.12);overflow:auto;max-height:84vh">'+bt2SheetHtml(d,false)+'</div></div>';
  h+='</div>';
  return h;
};

/* ── 초안 만들기 · 보관 · 열기: 고른 트리(sel)·3부 출처를 함께 ── */
var _btGen97=window.btGen;
window.btGen=async function(){
  var before=BT.draft; var r=await _btGen97.apply(this,arguments); var d=BT.draft;
  if(d&&d!==before){
    d.p3src=BT.cfg.p3src||'mix';
    if(bt2TrOn()&&BT.cfg.sel){ d.sel=bt2SelCopy();
      if(d.p3mode==='tb'&&d.p3src!=='tb'){ var n=Number(BT.cfg.p3)||0;
        if(d.p3src==='rep') d.p3=bt2RepPick(n,{});
        else d.p3=(d.p3||[]).slice(0,n).concat(bt2RepPick(n-Math.min(n,(d.p3||[]).length), bt2P3Used(d)));
        render(); } }
  }
  return r;
};
var _btSave97=window.btSave;
window.btSave=function(){ var d=BT.draft; if(d&&bt2TrOn()&&BT.cfg.sel&&(!d.course||d.course===BT.cfg.course)) d.sel=bt2SelCopy(); return _btSave97.apply(this,arguments); };
var _bt2MakeMany97=window.bt2MakeMany;
window.bt2MakeMany=function(){ var d=BT.draft; if(d&&bt2TrOn()&&BT.cfg.sel&&(!d.course||d.course===BT.cfg.course)) d.sel=bt2SelCopy(); return _bt2MakeMany97.apply(this,arguments); };
var _btOpen97=window.btOpen;
window.btOpen=function(id){
  var d=(BT.saved||[]).filter(function(x){ return x.id===id; })[0];
  if(d){
    if(d.course&&d.course!==BT.cfg.course){ BT.cfg.course=String(d.course); BT.cfg.subs=[]; }
    if(d.big) BT.cfg.big=String(d.big);
    if(d.p3src) BT.cfg.p3src=String(d.p3src);
    if(d.sel&&Array.isArray(d.sel.cids)){ BT.cfg.sel={ big:String(d.sel.big||''), cids:d.sel.cids.slice(), exT:(d.sel.exT||[]).slice(), exU:(d.sel.exU||[]).slice() }; BT.cfg.selFromSubs=false; }
    else if(d.subs&&d.subs.length){   // 트리 전에 만든 시험지 — 소단원 이름으로 (트리가 있으면 그 소단원의 개념 전부)
      var B=bt2Big(BT.cfg.course,BT.cfg.big); var keys=[];
      (B&&B.m||[]).forEach(function(m){ (m.s||[]).forEach(function(s){ if(d.subs.indexOf(String(s.n))>=0) keys.push(bt2SubKey(m.n,s.n)); }); });
      BT.cfg.subs=keys.length?keys:d.subs.slice(); BT.cfg.sel=null; BT.cfg.selFromSubs=true;
    }
    if(BT.tree&&BT.tree.course===BT.cfg.course){ BT.tree.open={}; BT.tree.scroll=0; }
  }
  return _btOpen97.apply(this,arguments);
};

/* ── 채팅: 「세부유형 대표 문항 n개 더」(AI 없이) · 세부유형 이름을 말하면 범위에 넣기 ── */
var BT2_CHAT_PRE='';
var _bt2ChatSay97=bt2ChatSay;
bt2ChatSay=function(r,t,sn){ if(r==='ai'&&BT2_CHAT_PRE){ t=BT2_CHAT_PRE+String(t||''); BT2_CHAT_PRE=''; } return _bt2ChatSay97.apply(this,[r,t,sn]); };
var BT2_CHAT_REP='세부유형 대표 문항 2개 더';
var _bt2ChatHtml97=bt2ChatHtml;
bt2ChatHtml=function(){ var q=BT2_CHAT_QUICK; var d=BT.draft;
  if(bt2TrOn()&&d&&d.p3mode==='tb'&&q.indexOf(BT2_CHAT_REP)<0) BT2_CHAT_QUICK=q.concat([BT2_CHAT_REP]);
  try{ return _bt2ChatHtml97.apply(this,arguments); } finally{ BT2_CHAT_QUICK=q; } };
var BT2_CHAT_STOP=/^(서술형|서술|빈칸|쉽게|어렵게|쉬운|어려운|삭제|순서|제목|힌트|답지|대표|세부유형|주제유형|개념|그림|매쓰플랫|다시|한마디|뒤로|앞으로|모범답|한줄씩|줄씩|1부|2부|3부|문항으로|넣고|바꾸고|빼|빼줘|빼고)$/;
function bt2ChatTreeToks(t){ return bt2ChatTokens(t).filter(function(w){ return !BT2_CHAT_STOP.test(w)&&!/^\d/.test(w); }); }
/* 말 속 낱말이 «모두» 들어간 주제유형(먼저) · 세부유형을 트리에서 찾는다 — 지금 대단원 먼저 */
function bt2ChatTreeFind(t){
  var ix=BT.tree.ix; var toks=bt2ChatTreeToks(t); var res={ T:[], U:[] }; if(!ix||!toks.length) return res;
  var hit=function(n){ var s=bt2Nsp(n); return toks.every(function(w){ return s.indexOf(w)>=0; }); };
  var cons=ix.cons.slice(); var big=BT.cfg.big;
  cons.sort(function(a,b){ return (String(ix.C[a.id].B.n)===big?0:1)-(String(ix.C[b.id].B.n)===big?0:1); });
  cons.forEach(function(C){ C.t.forEach(function(T){ if(hit(T.n)) res.T.push({ T:T, C:C }); T.u.forEach(function(U){ if(hit(U.n)) res.U.push({ U:U, T:T, C:C }); }); }); });
  return res;
}
/* 찾은 것을 범위에 넣는다 → 넣은 이름들 (이미 들어 있으면 넣지 않는다 · 너무 넓으면 넣지 않는다) */
function bt2ChatTreeScope(t){
  if(!bt2TrOn()||!BT.cfg.sel) return [];
  var f=bt2ChatTreeFind(t); var names=[]; var S=bt2SelSets();
  if(f.T.length&&f.T.length<=10){
    f.T.slice(0,3).forEach(function(e){ if(bt2StT(e.C,e.T,S)===2) return; bt2TrSet('t:'+e.T.id,true); S=bt2SelSets(); names.push(String(e.T.n)); });
  } else if(!f.T.length&&f.U.length&&f.U.length<=30){
    f.U.slice(0,6).forEach(function(e){ if(S.c[e.C.id]&&!S.t[e.T.id]&&!S.u[e.U.id]) return; bt2TrSet('u:'+e.U.id,true); S=bt2SelSets(); names.push(String(e.U.n)); });
  }
  if(names.length){ bt2TrSync(); if(BT.draft) BT.draft.sel=bt2SelCopy(); }
  return names;
}
/* 대표 문항 n개 — 말에 세부유형 이름이 있으면 그것에서, 없으면 고른 범위에서 */
function bt2ChatRep(t){
  var d=BT.draft; d.p3=d.p3||[];
  if(!bt2TrOn()) return { t:'매쓰플랫 단원 트리가 아직 없어 대표 문항을 넣을 수 없습니다. 교과서에서 고르려면 「교과서에서 ○○ 2개 더」라고 말해 주세요.' };
  var n=bt2ChatCount(t); var used=bt2P3Used(d); var got=[]; var label='고른 세부유형';
  var f=bt2ChatTreeFind(t);
  if(f.U.length||f.T.length){
    var pool=[]; f.U.forEach(function(e){ pool.push(e); }); f.T.forEach(function(e){ e.T.u.forEach(function(U){ pool.push({ U:U, T:e.T, C:e.C }); }); });
    pool.forEach(function(e){ if(got.length>=n||!e.U.pid||!e.U.img||used[String(e.U.pid)]) return; used[String(e.U.pid)]=1; got.push(bt2RepItem(e.U,e.T,e.C)); });
    label=bt2ChatTreeToks(t).join(' ');
  }
  if(!got.length) got=bt2RepPick(n,used);
  if(!got.length) return { t:'「'+label+'」에서 더 넣을 대표 문항을 찾지 못했습니다. 트리에서 세부유형을 더 골라 주세요.' };
  var sn=bt2ChatSnap(); var fresh={ p1:{}, p3:{} };
  got.forEach(function(x){ d.p3.push(x); fresh.p3[d.p3.length-1]=1; });
  return { t:'매쓰플랫 대표 문항 '+got.length+'개를 3부 끝에 넣었습니다: '+got.map(function(x){ return x.s; }).join(' / ')+' (AI 없이 바로)', sn:sn, fresh:fresh };
}
var _bt2ChatSend97=window.bt2ChatSend;
window.bt2ChatSend=async function(textOpt){
  var C=BT.chat, d=BT.draft;
  var fromBox=!(textOpt!=null&&String(textOpt).trim());
  var text=fromBox?String((function(){ var el=document.getElementById('bt2-chat-in'); return (el&&el.value!=null)?el.value:(C.text||''); })()):String(textOpt);
  text=text.trim();
  if(!text||C.busy||!d||/취소|되돌/.test(text)) return _bt2ChatSend97.apply(this,arguments);
  /* 대표 문항 — AI 없이 */
  if(/대표\s*문항/.test(text)&&d.p3mode==='tb'){
    if(fromBox) C.text='';
    bt2ChatSay('me',text);
    var r=bt2ChatRep(text); bt2ChatSay('ai',r.t,r.sn); if(r.fresh) bt2ChatFresh(r.fresh);
    render(); bt2ChatAfterRender(); return;
  }
  /* AI 로 가는 말이면 — 말 속 세부유형·주제유형을 범위에 넣고 첫 답 앞에 알린다 */
  BT2_CHAT_PRE='';
  if(!(/교과서/.test(text)&&d.p3mode==='tb')){
    var added=bt2ChatTreeScope(text);
    if(added.length) BT2_CHAT_PRE='범위에 '+added.map(function(x){ return '‹'+x+'›'; }).join(', ')+' 을 넣었습니다. ';
  }
  try{ return await _bt2ChatSend97.apply(this,arguments); } finally{ BT2_CHAT_PRE=''; }
};
