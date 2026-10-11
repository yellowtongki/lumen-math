/* ═══════════════════════════════════════════════════════════════════
 * v19-106: 📝 백지테스트 · 🚑 리커버리를 3분할로 (시안 docs/mockup_layout3.html 백지테스트·리커버리 화면)
 * 원장 결정 2026-10-11 「공용 메뉴 접기 좋다 · 순서 그대로(적중 분석 → 백지테스트·리커버리 → 나머지)」
 *
 *  📝 백지테스트 (VIEW 'blank')
 *    왼쪽 (PC 900px 이상 — perViewLeftNav('blank'))
 *      「학생 고르기」 — ○/✓ 여러 명 고르기(BT.sel 그대로) · 이름을 누르면 그 학생(btPick) · 지금 학생은 파란색
 *                     빠르게 「중3 전부 n」「보이는 학생 전부(반 전부)」「모두 해제」 · 반 고르기
 *      「보관함」 — BT.saved 를 «제목 · 날짜»로 묶어서 (여러 명 같은 시험지는 한 줄 «n명»), 누르면 btOpen
 *      맨 아래 접힌 「▸ 공용 메뉴」 (v19-104)
 *      ※ PC 1280px 이상에서는 가운데의 긴 학생 칩 줄(반 칩 · 학생 칩 · 빠른 고르기)을 숨기고 한 줄 안내만 둔다
 *        (body 의 l3-bt-left). 그보다 좁으면 가운데 칩도 그대로 보인다.
 *    오른쪽 도구 (RIGHT_TOOLS.blank)
 *      「과정 · 범위」 과정 › 대단원 · 단원 트리 개념·주제유형·세부유형 수(BT.cfg.sel) · 「🌳 범위 트리 열기」
 *      「문항 수」 1부 · 2부 · 3부(종류 · 수) · 3부 출처(p3src) — 가운데 칸과 같은 값(btCfg)
 *      「만들기」 ⚡ AI 초안 · 👥 고른 n명에게 같은 시험지 · 🖨 인쇄 · 🔑 답지 · 🖨+🔑 · 💾 보관
 *      초안이 있으면 「💬 채팅으로 고치기」 한 줄 → bt2ChatSend(말)
 *  🚑 리커버리 (VIEW 'recovery')
 *    왼쪽: 「이번 주 호출」 (확정 🚑 · 미정 · 완료 ✅ · 노쇼 ⛔ + 점수·시간) — 누르면 가운데 그 학생 카드로 가서 깜빡
 *          「장부」 이번 달 · 지난달 호출·완료 수 → 운영 장부 · 접힌 공용 메뉴
 *    오른쪽: 「학습지 규칙」 rc_ws_rule (쌍둥이 · 교과서 · 교재 오답 쌍둥이 · 보강 · 이론 · 자동채점 · 기간)
 *            — 저장은 지금 설계 팝업과 같은 길(rcwsSaveRule → lumen_store rc_ws_rule)
 *            「만들기」 ⚡ 확정 전원 학습지 생성 · 📣 학생앱에 알리기 · 📨 학부모 안내문 · 🖨 종이 학습지 인쇄
 *            「🔐 매쓰플랫 계정」 이 PC 에 저장됐는지 · 넣는 칸 열기(가운데 오른쪽 패널의 계정 칸으로)
 *  가운데 화면은 그대로 둔다(같은 단추가 양쪽에 있어도 된다 — 원장 결정). 폰(900px 미만)은 바뀌는 것이 없다.
 *  (리커버리 가운데의 «확정 명단» 칸만 가운데가 좁을 때 300px 로 줄거나 카드 아래로 내려간다 — 단추는 그대로)
 *  render 를 감싸서 가운데를 바꾸면 도구도 다시 그린다(도구 칸 입력 중이면 커서를 돌려준다).
 *  ※ 앞 부품의 함수를 부르기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var L3B = { chatText:'', boxGroups:[], rcFocus:'', prev:{}, tick:0, rcConf:null };

/* 가운데 3부 수 칸은 값이 0 이면 4 로 보여 준다(0||4) — 보이는 수와 실제 수가 같도록 처음 값만 4 로 맞춘다 */
try{ if(typeof BT!=='undefined' && BT.cfg && BT.cfg.p3mode!=='none' && !(Number(BT.cfg.p3)>0)) BT.cfg.p3=4; }catch(e){}

function l3bQ(s){ return l3Esc(s); }
/* 화면 안 어느 칸으로 가서 잠깐 노랗게 (그려질 때까지 잠깐 기다림) */
function l3bFlash(sel, fn){
  var n=0; (function tick(){
    var el=(typeof sel==='function')?sel():document.querySelector(sel);
    if(el){ try{ el.scrollIntoView({ block:'center', behavior:'smooth' }); }catch(e){ try{ el.scrollIntoView(); }catch(_){} }
      el.classList.add('l3-flash'); setTimeout(function(){ el.classList.remove('l3-flash'); }, 1800); if(fn) fn(el); return; }
    if(++n<20) setTimeout(tick, 100); })();
}

/* ═══════════════ 📝 백지테스트 ═══════════════ */

/* ── 왼쪽: 학생 고르기 ── */
function l3bStuRows(){
  var list=btActive().filter(function(s){ return !BT.cls || (s.group||'')===BT.cls; });
  var h='';
  if(!list.length) return '<div class="l3-sec" style="font-weight:700;letter-spacing:0">학생이 없습니다</div>';
  list.forEach(function(s){
    var c=String(s.lumen_rec_code), on=!!(BT.sel&&BT.sel[c]), cur=BT.stu===c;
    var sub=String(s.grade||'').replace(/학교|학년/g,'').replace(/\s/g,'')+(s.group?' · '+s.group:'');
    h+='<div class="l3b-stu'+(cur?' on':'')+'" data-l3b-row="'+l3bQ(c)+'">'
      +'<button type="button" class="l3b-ck'+(on?' on':'')+'" data-l3b-sel="'+l3bQ(c)+'" aria-pressed="'+(on?'true':'false')+'" title="여러 명 고르기" onclick="bt2SelTog(this.getAttribute(\'data-l3b-sel\'))">'+(on?'✓':'○')+'</button>'
      +'<button type="button" class="l3b-nm" data-l3b-pick="'+l3bQ(c)+'" aria-current="'+(cur?'true':'false')+'" onclick="btPick(this.getAttribute(\'data-l3b-pick\'))"><span>'+l3bQ(s.name)+'</span><small>'+l3bQ(sub)+'</small></button></div>';
  });
  return h;
}
function l3bQuick(){
  var sel=bt2SelCodes(), grades={};
  btActive().forEach(function(st){ var g=bt2GradeKey(st); if(g) grades[g]=(grades[g]||0)+1; });
  var h='<div class="l3b-qrow">';
  Object.keys(grades).sort().forEach(function(g){ h+='<button type="button" class="l3b-q" data-l3b-grade="'+l3bQ(g)+'" onclick="bt2SelGrade(this.getAttribute(\'data-l3b-grade\'))">'+l3bQ(g)+' 전부 '+grades[g]+'</button>'; });
  h+='<button type="button" class="l3b-q" data-l3b-q="cls" onclick="bt2SelCls()">'+(BT.cls?l3bQ(BT.cls)+' 반 전부':'보이는 학생 전부')+'</button>';
  if(sel.length) h+='<button type="button" class="l3b-q dim" data-l3b-q="clear" onclick="bt2SelClear()">모두 해제</button>';
  return h+'</div>';
}
function l3bClsSel(){
  var seen={}, gs=[]; btActive().forEach(function(s){ var g=s.group||''; if(g&&!seen[g]){ seen[g]=1; gs.push(g); } });
  if(!gs.length) return '';
  var h='<div class="l3b-qrow"><select class="l3b-cls" aria-label="반 고르기" onchange="btCls(this.value)"><option value="">반: 전체</option>';
  gs.forEach(function(g){ h+='<option value="'+l3bQ(g)+'"'+(BT.cls===g?' selected':'')+'>'+l3bQ(g)+'</option>'; });
  return h+'</select></div>';
}
/* ── 왼쪽: 보관함 (제목 · 날짜로 묶음) ── */
function l3bBoxGroups(){
  var G=[], at={};
  (BT.saved||[]).forEach(function(d){
    var day=String(d.savedAt||d.at||'').slice(0,10), k=String(d.title||'')+'|'+day;
    if(at[k]==null){ at[k]=G.length; G.push({ k:k, title:String(d.title||'백지테스트'), day:day, items:[] }); }
    G[at[k]].items.push(d);
  });
  return G;
}
function l3bBox(){
  if(!BT.loaded) return '<div class="l3-sec" style="font-weight:700;letter-spacing:0">불러오는 중…</div>';
  var G=l3bBoxGroups(); L3B.boxGroups=G;
  if(!G.length) return '<div class="l3-sec" style="font-weight:700;letter-spacing:0">아직 보관한 시험지가 없습니다</div>';
  var cur=BT.draft?BT.draft.id:'', h='', MAX=12;
  G.slice(0,MAX).forEach(function(g,i){
    var on=g.items.some(function(x){ return x.id===cur; });
    var who=g.items.length>1?(g.items.length+'명'):(function(){ var s=btStuByCode(g.items[0].code); return s?s.name:''; })();
    var dt=g.day?g.day.slice(5).replace('-','/'):'';
    h+='<button type="button" class="l3-lb'+(on?' on':'')+'" data-l3b-box="'+i+'" onclick="l3bOpenGroup(this.getAttribute(\'data-l3b-box\'))"><span>'+l3bQ(g.title)+'<small>'+l3bQ(who)+(dt?' · '+dt:'')+'</small></span>'+(g.items.length>1?'<span class="n">👥 '+g.items.length+'</span>':'')+'</button>';
  });
  if(G.length>MAX) h+='<button type="button" class="l3-lb" onclick="btTab(\'box\')"><span>보관함 전체 보기<small>'+(BT.saved||[]).length+'장</small></span></button>';
  return h;
}
/* 보관함 한 묶음 열기 — 첫 장을 열고, 여러 명이면 「n명 한꺼번에 인쇄」 를 쓸 수 있게 BT.many 로 */
window.l3bOpenGroup = function(i){
  var g=L3B.boxGroups[Number(i)]; if(!g||!g.items.length) return;
  btOpen(g.items[0].id);
  BT.many=g.items.length>1?g.items.slice():null;
  render();
};
function l3bLeft(){
  try{ btKick(); }catch(e){}
  var n=bt2SelCodes().length;
  var h=l3LeftHead('blank')
    +'<div class="l3-sec">학생 고르기'+(n?' · <span style="color:#93c5fd">✓ '+n+'명</span>':'')+'</div>'
    +l3bClsSel()+l3bQuick()+'<div class="l3b-list">'+l3bStuRows()+'</div>'
    +'<div class="l3-sec">보관함 '+((BT.saved||[]).length||'')+'</div>'+l3bBox();
  return h+l3CommonFold();
}

/* ── 가운데: 긴 학생 칩 줄에 표시만 붙인다 (1280px 이상에서 숨김 — 모양은 아래 CSS) ── */
var L3B_CH=[
  '<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin-bottom:8px">',          // 반 칩 (btClsChips)
  '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;align-items:center">',          // 학생 칩
  '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;align-items:center;font-size:11px;font-weight:800;color:#64748b"><span>○ 를 눌러'   // 빠른 고르기
];
function l3bTag(h, head){ var i=h.indexOf(head); if(i<0) return h; var j=h.indexOf('>', i); return h.slice(0,j)+' class="l3b-chide"'+h.slice(j); }
var _rBtMake106=rBtMake;
rBtMake=function(){
  var h=_rBtMake106.apply(this, arguments);
  L3B_CH.forEach(function(x){ h=l3bTag(h, x); });
  var stu=BT.stu?btStuByCode(BT.stu):null, n=bt2SelCodes().length;
  return '<div class="l3b-cnote">👈 학생은 왼쪽 「학생 고르기」에서 고릅니다'+(stu?' — 지금 <b>'+l3bQ(stu.name)+'</b>':'')+(n?' · ✓ '+n+'명 고름':'')+'</div>'+h;
};

/* ── 오른쪽 도구 ── */
function l3bScopeBox(){
  var h='<div class="l3-tool" id="l3b-scope"><b>과정 · 범위</b>';
  if(!BT.stu) return h+'<span class="l3-sub">왼쪽에서 학생을 고르면 과정·단원이 정해집니다.</span></div>';
  h+='<span class="l3-sub" style="color:#0d2240;font-weight:800" id="l3b-course">'+l3bQ(BT.cfg.course||'—')+(BT.cfg.big?' › '+l3bQ(BT.cfg.big):'')+'</span>';
  var on=false; try{ on=bt2TrOn(); }catch(e){}
  if(on){ var c={ c:0, t:0, u:0 }; try{ c=bt2TrCounts(); }catch(e){}
    h+='<span class="l3-sub" id="l3b-counts">🌳 단원 트리: 개념 <b>'+c.c+'</b> · 주제유형 <b>'+c.t+'</b> · 세부유형 <b>'+Number(c.u).toLocaleString()+'</b></span>'; }
  else if(BT.tree && BT.tree.loading && BT.tree.course===BT.cfg.course) h+='<span class="l3-sub" id="l3b-counts">🌳 단원 트리 불러오는 중…</span>';
  else { var p=[]; try{ p=bt2Picked(); }catch(e){} h+='<span class="l3-sub" id="l3b-counts">소단원 '+p.length+'개'+(p.length?' — '+l3bQ(p.map(function(x){ return x.s; }).join(' · ')):'')+' <span style="color:#94a3b8">(트리 없음 — 소단원 칩)</span></span>'; }
  return h+'<button type="button" class="l3-btn" id="l3b-tree" onclick="l3bTree()">🌳 범위 트리 열기</button></div>';
}
function l3bNum(id, k, v, mn, mx, lab){
  return '<label class="l3b-num">'+lab+'<input type="number" id="'+id+'" min="'+mn+'" max="'+mx+'" value="'+l3bQ(v)+'" onchange="btCfg(\''+k+'\',this.value)"></label>';
}
function l3bCountBox(){
  var c=BT.cfg, m=c.p3mode||'tb', src=c.p3src||'mix';
  var h='<div class="l3-tool" id="l3b-count"><b>문항 수</b>'
    +l3bNum('l3b-p1','p1',c.p1,3,14,'1부 개념 백지')+l3bNum('l3b-p2','p2',c.p2,0,10,'2부 다시 풀기');
  h+='<label class="l3b-num">3부<select id="l3b-p3mode" class="l3-sel" style="width:auto" onchange="btCfg(\'p3mode\',this.value)">'
    +'<option value="tb"'+(m==='tb'?' selected':'')+'>교과서·대표 문항</option><option value="ai"'+(m==='ai'?' selected':'')+'>AI 창작</option><option value="none"'+(m==='none'?' selected':'')+'>없음</option></select>'
    +(m!=='none'?'<input type="number" id="l3b-p3" min="0" max="10" value="'+l3bQ(c.p3)+'" onchange="btCfg(\'p3\',this.value)">':'')+'</label>';
  if(m==='tb'){
    var on=false; try{ on=bt2TrOn(); }catch(e){}
    h+='<label class="l3b-num" style="flex-direction:column;align-items:stretch;gap:3px">3부 출처<select id="l3b-p3src" class="l3-sel" onchange="btCfg(\'p3src\',this.value)">'
      +'<option value="mix"'+(src==='mix'?' selected':'')+'>교과서+대표 문항 섞기 (기본)</option><option value="rep"'+(src==='rep'?' selected':'')+'>세부유형 대표 문항만</option><option value="tb"'+(src==='tb'?' selected':'')+'>교과서만</option></select></label>'
      +(on?'':'<span class="l3-sub">단원 트리가 없는 과정은 교과서 문항만 들어갑니다.</span>');
  }
  if(m==='ai'&&Number(c.p3)>0) h+='<span class="l3-sub" style="color:#92400e">⚠️ AI 창작 문제는 인쇄 전에 꼭 풀어 보세요.</span>';
  return h+'</div>';
}
function l3bMakeBox(){
  var d=BT.draft, n=bt2SelCodes().length;
  var h='<div class="l3-tool" id="l3b-make"><b>만들기</b>';
  if(!BT.stu) h+='<span class="l3-sub">왼쪽에서 학생을 한 명 고르면 초안을 만들 수 있습니다.</span>';
  else h+='<button type="button" class="l3-btn main" id="l3b-gen" onclick="btGen()"'+(BT.gen?' disabled':'')+'>'+(BT.gen?'⏳ 만드는 중…':'⚡ AI 초안 만들기')+'</button>';
  if(BT.gen&&BT.genMsg) h+='<span class="l3-sub">'+l3bQ(BT.genMsg)+'</span>';
  if(n) h+='<button type="button" class="l3-btn pri" id="l3b-many" onclick="bt2MakeMany()">👥 고른 '+n+'명에게 같은 시험지</button>'+(d?'':'<span class="l3-sub">한 학생으로 초안을 먼저 만든 뒤 누르세요.</span>');
  if(BT.bulk) h+='<span class="l3-sub" style="color:#1d6fe8">만드는 중 '+BT.bulk.n+'/'+BT.bulk.tot+'명…</span>';
  if(d){
    h+='<div class="l3b-row2"><button type="button" class="l3-btn" id="l3b-print" onclick="btPrint()">🖨 인쇄</button><button type="button" class="l3-btn" id="l3b-key" onclick="btAnswers()">🔑 답지</button></div>'
      +'<button type="button" class="l3-btn" id="l3b-both" onclick="bt2PrintBoth()">🖨+🔑 시험지·답지 둘 다</button>'
      +'<button type="button" class="l3-btn" id="l3b-save" onclick="btSave()">💾 보관</button>';
  }
  if(BT.many&&BT.many.length) h+='<button type="button" class="l3-btn" id="l3b-pmany" onclick="bt2PrintMany(false)">🖨 '+BT.many.length+'명 한꺼번에 인쇄</button>';
  return h+'</div>';
}
function l3bChatBox(){
  var d=BT.draft; if(!d) return '';
  var C=BT.chat||{ log:[] }, busy=!!C.busy, last=null;
  for(var i=(C.log||[]).length-1;i>=0;i--){ if(C.log[i].r==='ai'){ last=C.log[i].t; break; } }
  var h='<div class="l3-tool" id="l3b-chatbox"><b>💬 채팅으로 고치기</b>'
    +'<div class="l3b-chat"><input id="l3b-chat" value="'+l3bQ(L3B.chatText)+'" placeholder="예: 3번 더 쉽게" aria-label="AI 에게 고칠 것 말하기"'+(busy?' disabled':'')
    +' oninput="L3B.chatText=this.value" onkeydown="if(event.key===\'Enter\'&&!event.isComposing&&event.keyCode!==229){event.preventDefault();l3bChat();}">'
    +'<button type="button" id="l3b-chat-go" onclick="l3bChat()"'+(busy?' disabled':'')+'>'+(busy?'⏳':'보내기')+'</button></div>';
  if(busy) h+='<span class="l3-sub" id="l3b-chat-last">⏳ AI 가 시험지를 보고 고치는 중…</span>';
  else if(last) h+='<span class="l3-sub" id="l3b-chat-last">'+l3bQ(String(last).slice(0,90))+(String(last).length>90?'…':'')+'</span>';
  else h+='<span class="l3-sub" id="l3b-chat-last">가운데 편집 칸 아래 대화 상자와 같은 곳으로 갑니다.</span>';
  return h+'</div>';
}
window.l3bChat = function(){
  var el=document.getElementById('l3b-chat'); var t=String(el?el.value:L3B.chatText||'').trim();
  if(!t||(BT.chat&&BT.chat.busy)) return;
  L3B.chatText=''; if(el) el.value='';
  return bt2ChatSend(t);
};
/* 🌳 범위 트리 열기 — 만들기 탭으로, 고른 대단원을 펼치고 그 칸으로 간다 */
window.l3bTree = function(){
  if(!BT.stu){ plToast('왼쪽에서 학생을 먼저 고르세요'); return; }
  BT.tab='make';
  var on=false; try{ on=bt2TrOn(); }catch(e){}
  if(on && BT.tree && BT.tree.data){
    try{ var S=bt2SelSets(), any=false;
      (BT.tree.data.b||[]).forEach(function(B){ if(bt2TrState('b:'+B.id, S)){ bt2TrOpenBig('b:'+B.id); any=true; } });
      if(!any && BT.tree.data.b && BT.tree.data.b[0]) bt2TrOpenBig('b:'+BT.tree.data.b[0].id);
      BT.tree.scroll=0; }catch(e){}
  }
  render();
  l3bFlash(function(){ var t=document.getElementById('bt2-tree'); if(t) return t.parentElement||t;
    var c=document.querySelector('#CONTENT button[onclick^="bt2Course("]'); return c?c.parentElement:null; });
};
RIGHT_TOOLS.blank = function(){
  if(BT.tab==='box') return '<div class="l3-ttl">시험지 구성</div><div class="l3-tool" id="l3b-boxtab"><b>🗂 보관함 탭</b><span class="l3-sub">보관한 시험지를 열면 여기에 구성·만들기 도구가 나옵니다.</span><button type="button" class="l3-btn" onclick="btTab(\'make\')">📝 만들기 탭으로</button></div>'+l3bMakeBox();
  return '<div class="l3-ttl">시험지 구성</div>'+l3bScopeBox()+l3bCountBox()+l3bMakeBox()+l3bChatBox();
};

perViewLeftNav=(function(o){ return function(v){
  if(v==='blank' && isDesktop()) return l3bLeft();          /* 폰은 지금 그대로 */
  if(v==='recovery' && isDesktop()) return l3rLeft();
  return o.apply(this, arguments); }; })(perViewLeftNav);

/* ═══════════════ 🚑 리커버리 ═══════════════ */

function l3rKeyQ(k){ return String(k==null?'':k).replace(/'/g,''); }   /* 가운데 단추 onclick 의 학생 키와 같은 모양 */
/* 이번 주 명단 — 확정(🚑) · 미정(자동 선발만) · 완료 · 노쇼 */
function l3rList(){
  var wk=rcWeekKey(), W=(RC.state.calls||{})[wk]||{}, rows=[], conf=[];
  try{ rows=rcRows(); }catch(e){ rows=[]; }
  try{ conf=rcConfirmed(); }catch(e){ conf=[]; }
  L3B.rcConf={ tick:L3B.tick, conf:conf };          /* 같은 그리기 안에서 도구 칸이 다시 세지 않게 */
  var seen={}, out=[];
  conf.forEach(function(c){ seen[c.k]=1; out.push({ k:c.k, name:c.name, row:c.row, e:c.e||{}, manual:!!c.manual, score:c.score }); });
  rows.forEach(function(x){ if(seen[x.stKey]) return; var e=W[x.stKey]||{}; out.push({ k:x.stKey, name:x.st.name, row:x, e:e, manual:false, score:x.testHit?x.testHit.score:null }); });
  var rank=function(x){ return x.e.done?2:(x.e.on?0:1); };
  out.sort(function(a,b){ return rank(a)-rank(b); });
  return out;
}
function l3rSub(x){
  var e=x.e||{}, r=x.row, bits=[];
  if(r&&r.testHit){ var t=r.testHit; bits.push('주간 '+((t.correct!=null&&t.total)?(t.correct+'/'+t.total):(t.score+'점'))); }
  else if(x.score!=null) bits.push('주간 '+x.score+'점');
  else if(r&&r.unitHits&&r.unitHits.length) bits.push('단원 '+r.unitHits[0].rate+'%');
  if(x.manual) bits.push('👋 직접');
  if(e.done) bits.push('✅ '+String(e.done).slice(5).replace('-','.')+' 완료');
  else if(e.noshow) bits.push('⛔ 노쇼');
  else if(e.on) bits.push('확정'+(e.slot?' · '+e.slot:''));
  else bits.push('미정');
  return bits.join(' · ');
}
function l3rLedgerBox(){
  var D=null; try{ D=rcLedgerData(); }catch(e){ D=null; }
  var now=new Date(), ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var pm=new Date(now.getFullYear(), now.getMonth()-1, 1), ym2=pm.getFullYear()+'-'+String(pm.getMonth()+1).padStart(2,'0');
  var cnt=function(m){ var c=0, d=0; ((D&&D.weekRows)||[]).forEach(function(w){ var day=String(rcRecDate(w.wk)||w.wk); if(day.slice(0,7)!==m) return; c+=w.called.length; d+=w.doneN; }); return { c:c, d:d }; };
  var a=cnt(ym), b=cnt(ym2);
  var row=function(id, m, o){ return '<button type="button" class="l3-lb'+(RC.view==='ledger'&&id==='this'?' on':'')+'" data-l3r-ledger="'+id+'" onclick="rcSetView(\'ledger\')"><span>'+Number(m.slice(5))+'월 호출 '+o.c+'명<small>완료 '+o.d+(o.c?' · '+Math.round(o.d/o.c*100)+'%':'')+'</small></span><span class="n">📒</span></button>'; };
  return row('this', ym, a)+row('last', ym2, b)
    +(RC.view==='ledger'?'<button type="button" class="l3-lb" onclick="rcSetView(\'board\')"><span>🚑 이번 주 보드로</span></button>':'');
}
function l3rLeft(){
  var h=l3LeftHead('recovery');
  if(!RC.loaded){ try{ rcLoad().then(function(){ if(VIEW==='recovery') render(); }); }catch(e){}
    return h+'<div class="l3-sec" style="font-weight:700">불러오는 중…</div>'+l3CommonFold(); }
  var wk=rcWeekKey(), dt=rcRecDate(wk), d=new Date(dt);
  var L=l3rList(), nOn=L.filter(function(x){ return x.e.on&&!x.e.done; }).length;
  h+='<div class="l3-sec">이번 주 호출 ('+(isNaN(d)?'':(d.getMonth()+1)+'/'+d.getDate()+' '+rcDayLabel(dt))+') · 🚑 '+nOn+'</div>';
  if(!L.length) h+='<div class="l3-sec" style="font-weight:700;letter-spacing:0">지금 기준으로 선발·호출된 학생이 없습니다</div>';
  var mi=false;
  L.forEach(function(x){
    if(!x.e.on&&!x.e.done&&!mi){ mi=true; h+='<div class="l3-sec" style="padding-top:6px">예상 명단 · 미정</div>'; }
    var on=L3B.rcFocus===x.k, badge=x.e.done?'✅':(x.e.noshow?'⛔':(x.e.on?'🚑':''));
    h+='<button type="button" class="l3-lb'+(on?' on':'')+(x.e.on||x.e.done?'':' l3r-dim')+'" data-l3r-stu="'+l3bQ(x.k)+'" onclick="l3rPick(this.getAttribute(\'data-l3r-stu\'))"><span>'+l3bQ(x.name)+'<small>'+l3bQ(l3rSub(x))+'</small></span>'+(badge?'<span class="n">'+badge+'</span>':'')+'</button>';
  });
  h+='<div class="l3-sec">장부</div>'+l3rLedgerBox();
  return h+l3CommonFold();
}
/* 왼쪽 학생 → 가운데 그 학생 카드(없으면 오른쪽 확정 명단 줄)로 가서 깜빡 */
function l3rFind(k){
  var q="('"+l3rKeyQ(k)+"'", C=document.getElementById('CONTENT'); if(!C) return null;
  var els=C.querySelectorAll('[onclick]'), card=null, side=null;
  for(var i=0;i<els.length;i++){ var oc=els[i].getAttribute('onclick')||''; if(oc.indexOf(q)<0) continue;
    if(/^(rcToggleCall|rcMarkDone|rcOpenPaper|rcwsOpen)\(/.test(oc)){ card=els[i].closest('div[style*="padding:13px 16px"]'); if(card) break; }
    if(!side && /^(rcSetSlot|rcToggleNoshow|rcManualRemove)\(/.test(oc)) side=els[i].closest('div[style*="padding:9px 10px"]'); }
  return card||side;
}
window.l3rPick = function(k){
  if(k==null) return;
  L3B.rcFocus=String(k);
  if(RC.view!=='board') RC.view='board';
  render();
  l3bFlash(function(){ return l3rFind(L3B.rcFocus); });
};

/* 가운데 보드는 «카드 | 확정 명단 400px» 두 칸이라, 도구 칸이 열려 가운데가 좁아지면 카드가 손가락 폭이 된다.
 * 가운데 폭을 보고(컨테이너 쿼리) 1000px 아래면 확정 명단을 300px 로, 760px 아래면 카드 아래로 내린다 — 단추·칸은 그대로. PC(900px 이상)만. */
var _rRecovery106=rRecovery;
rRecovery=function(){
  var h=_rRecovery106.apply(this, arguments);
  var a='<div style="padding:18px 22px 40px;max-width:1560px">', g='<div style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:16px;align-items:start">';
  if(h.indexOf(a)===0) h='<div class="l3r-wrap" style="padding:18px 22px 40px;max-width:1560px">'+h.slice(a.length);
  var i=h.indexOf(g); if(i>=0) h=h.slice(0,i)+'<div class="l3r-grid" style="display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:16px;align-items:start">'+h.slice(i+g.length);
  return h;
};

/* ── 오른쪽 도구 ── */
var L3R_NUM={ twinPer:3, tbPer:2, bookTwin:2 };
window.l3rRule = function(k, v){
  if(!RCWS.loaded) return;
  var r=rcwsRule(); delete r.updated;
  if(L3R_NUM[k]){
    if(v===true){ r[k]=L3B.prev[k]||RCWS_RULE_DEFAULT[k]||1; }
    else if(v===false){ if(r[k]) L3B.prev[k]=r[k]; r[k]=0; }
    else r[k]=Math.max(1, Math.min(L3R_NUM[k], Number(v)||1));
  } else if(k==='days') r.days=Math.max(7, Math.min(120, Number(v)||28));
  else r[k]=!!v;
  var p=rcwsSaveRule(r);           /* 설계 팝업 「이 규칙을 기본으로」와 같은 저장 (lumen_store rc_ws_rule) */
  render();
  return p;
};
function l3rCk(k, on, inner, title){
  return '<label class="l3r-ck" data-l3r-rule="'+k+'"'+(title?' title="'+l3bQ(title)+'"':'')+'><input type="checkbox" id="l3r-'+k+'"'+(on?' checked':'')+' onchange="l3rRule(\''+k+'\',this.checked)"><span>'+inner+'</span></label>';
}
function l3rNsel(k, val){
  var s='<select id="l3r-'+k+'-n" aria-label="문항 수"'+(val?'':' disabled')+' onchange="l3rRule(\''+k+'\',this.value)">';
  for(var i=1;i<=L3R_NUM[k];i++) s+='<option value="'+i+'"'+(i===(val||L3B.prev[k]||RCWS_RULE_DEFAULT[k])?' selected':'')+'>'+i+'</option>';
  return s+'</select>';
}
function l3rRuleBox(){
  var h='<div class="l3-tool" id="l3r-rule"><b>학습지 규칙</b>';
  if(!RCWS.loaded){ try{ rcwsLoad().then(function(){ if(VIEW==='recovery') render(); }); }catch(e){}
    return h+'<span class="l3-sub">규칙 불러오는 중…</span></div>'; }
  var r=rcwsRule();
  h+=l3rCk('twinPer', r.twinPer>0, '시험 오답 쌍둥이 '+l3rNsel('twinPer', r.twinPer)+'문제씩')
    +l3rCk('tbPer', r.tbPer>0, '교과서 같은 유형 '+l3rNsel('tbPer', r.tbPer)+'문제')
    +l3rCk('bookTwin', r.bookTwin>0, '범위 안 교재 오답 쌍둥이 '+l3rNsel('bookTwin', r.bookTwin))
    +l3rCk('boost', !!r.boost, '보강 — 두 번 이상 틀린 유형')
    +l3rCk('auto', !!r.auto, '자동채점 문항만', '서술형을 빼고 정답 글자가 있는 문항만 — 단답은 학생앱이 채점')
    +l3rCk('theory', !!r.theory, '이론 박스')
    +'<label class="l3b-num">교재 오답 최근<input type="number" id="l3r-days" min="7" max="120" value="'+l3bQ(r.days)+'" onchange="l3rRule(\'days\',this.value)">일</label>'
    +'<span class="l3-sub">「확정 전원 생성」과 학생별 설계 팝업이 이 규칙으로 시작합니다.</span>';
  return h+'</div>';
}
function l3rMakeBox(){
  var conf=[], live=[], can=0, made=0;
  try{ conf=(L3B.rcConf&&L3B.rcConf.tick===L3B.tick)?L3B.rcConf.conf:rcConfirmed(); live=conf.filter(function(c){ return !(c.e&&c.e.done); });
    live.forEach(function(c){ if(c.row&&rcwsMadeOf(c.k)) made++; else if(c.row&&c.row.testHit&&rcWsSchool(c.row.st)) can++; }); }catch(e){}
  return '<div class="l3-tool" id="l3r-make"><b>만들기</b>'
    +'<button type="button" class="l3-btn main" id="l3r-all" onclick="rcMakeWsAll()"'+(RCWS.busy?' disabled':'')+'>'+(RCWS.busy?'⏳ 만드는 중…':'⚡ 확정 전원 학습지 생성'+(can?' ('+can+'명)':''))+'</button>'
    +(made?'<span class="l3-sub">이번 주 만든 학습지 '+made+'명</span>':'')
    +'<button type="button" class="l3-btn pri" id="l3r-pub" onclick="rcPublishCalls()">📣 학생앱에 알리기'+(live.length?' ('+live.length+'명)':'')+'</button>'
    +'<button type="button" class="l3-btn" id="l3r-sms" onclick="rcOpenSms()">📨 학부모 안내문 확인</button>'
    +'<button type="button" class="l3-btn" id="l3r-print" onclick="rcPrint()">🖨 종이 학습지 인쇄'+(live.length?' (확정 '+live.length+'명)':' (선발 전원)')+'</button></div>';
}
function l3rAcctBox(){
  var a={ id:'', pw:'' }; try{ a=rcwsAcct(); }catch(e){}
  var ok=!!(a.id&&a.pw);
  return '<div class="l3-tool" id="l3r-acct-box"><b>🔐 매쓰플랫 계정</b>'
    +'<span class="l3-sub" id="l3r-acct">'+(ok?'✓ 이 PC 에 저장됨 ('+l3bQ(a.id.slice(0,3))+'***) · 즉시 생성 가능':'이 PC 에 저장 안 됨 — 넣어야 학습지가 바로 만들어집니다 (이 PC 에만 저장)')+'</span>'
    +(ok?'<button type="button" class="l3-btn" id="l3r-acct-clear" onclick="rcwsClearAcct()">지우기</button>'
        :'<button type="button" class="l3-btn" id="l3r-acct-open" onclick="l3rAcctOpen()">🔐 계정 넣는 칸 열기</button>')+'</div>';
}
/* 계정 넣는 칸 — 가운데 오른쪽 «확정 명단» 패널의 계정 칸(rcwsAcctBox)으로 가서 아이디 칸에 커서 */
window.l3rAcctOpen = function(){
  if(RC.view!=='board'){ RC.view='board'; render(); }
  l3bFlash(function(){ var i=document.getElementById('rcws-id'); return i?(i.parentElement&&i.parentElement.parentElement)||i:null; },
    function(){ var i=document.getElementById('rcws-id'); if(i) try{ i.focus({ preventScroll:true }); }catch(e){ i.focus(); } });
};
RIGHT_TOOLS.recovery = function(){
  if(!RC.loaded) return '<div class="l3-ttl">도구</div><div class="l3-tool"><b>🚑 리커버리</b><span class="l3-sub">불러오는 중…</span></div>';
  return '<div class="l3-ttl">도구</div>'+l3rRuleBox()+l3rMakeBox()+l3rAcctBox();
};

/* ── render 감싸기: 1280px 이상 백지테스트 가운데 칩 숨김 표시 · 도구 칸 입력 커서 돌려주기 ── */
render = window.render = (function(o){ return function(){
  var ae=document.activeElement, fid=(ae&&ae.id&&/^l3[br]-/.test(ae.id)&&ae.closest&&ae.closest('#TOOL_PANEL'))?ae.id:'';
  L3B.tick++;
  var r=o.apply(this, arguments);
  L3B.rcConf=null;
  try{
    if(document.body) document.body.classList.toggle('l3-bt-left', VIEW==='blank' && isDesktop());
    if(VIEW!=='recovery') L3B.rcFocus='';
    if(fid){ var el=document.getElementById(fid); if(el && !el.disabled && document.activeElement!==el){ try{ el.focus({ preventScroll:true }); }catch(e){ el.focus(); }
      if(el.tagName==='INPUT'&&el.type==='text'){ try{ var n=String(el.value||'').length; el.setSelectionRange(n, n); }catch(e){} } } }
  }catch(e){ try{ console.error('[3분할 백지·리커버리]', e); }catch(_){} }
  return r; }; })(render);

/* ── 모양 (v19-104·105 의 모양에 더함) ── */
(function(){
  if(document.getElementById('l3b-css')) return;
  var st=document.createElement('style'); st.id='l3b-css';
  st.textContent=''
    /* 왼쪽 학생 줄 */
    +'.l3b-list{display:flex;flex-direction:column;gap:3px;padding:0 10px}'
    +'.l3b-stu{display:flex;align-items:stretch;border-radius:10px;background:rgba(255,255,255,.07);overflow:hidden}'
    +'.l3b-stu:hover{background:rgba(255,255,255,.12)}.l3b-stu.on{background:#1d6fe8}'
    +'.l3b-ck{flex:none;width:34px;border:none;background:transparent;color:rgba(255,255,255,.45);font-family:inherit;font-size:14px;font-weight:900;cursor:pointer}'
    +'.l3b-ck.on{background:#22c55e;color:#fff}.l3b-stu.on .l3b-ck:not(.on){color:rgba(255,255,255,.75)}'
    +'.l3b-nm{flex:1;min-width:0;display:flex;justify-content:space-between;align-items:center;gap:6px;border:none;background:transparent;color:#e8eef6;font-family:inherit;font-size:13.5px;font-weight:800;text-align:left;padding:8px 10px 8px 6px;cursor:pointer}'
    +'.l3b-nm span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.l3b-nm small{flex:none;font-size:11px;font-weight:700;color:rgba(232,238,246,.6)}.l3b-stu.on .l3b-nm{color:#fff}.l3b-stu.on .l3b-nm small{color:#dbe8ff}'
    +'.l3b-ck:focus-visible,.l3b-nm:focus-visible,.l3b-q:focus-visible{outline:2px solid #fbbf24;outline-offset:-2px}'
    +'.l3b-qrow{display:flex;flex-wrap:wrap;gap:5px;padding:2px 12px 8px}'
    +'.l3b-q{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#e8eef6;border-radius:8px;padding:5px 9px;font-family:inherit;font-size:11.5px;font-weight:800;cursor:pointer}'
    +'.l3b-q:hover{background:rgba(255,255,255,.16)}.l3b-q.dim{color:rgba(232,238,246,.6)}'
    +'.l3b-cls{font-family:inherit;font-size:12px;font-weight:800;border-radius:8px;border:1px solid rgba(255,255,255,.25);padding:5px 8px;background:#fff;color:#0f172a;max-width:100%}'
    +'.l3-lb.l3r-dim{opacity:.72}'
    /* 가운데 — 1280px 이상에서 왼쪽에 학생 목록이 있으면 긴 칩 줄 숨김 */
    +'.l3b-cnote{display:none}'
    +'@media(min-width:1280px){body.l3-bt-left .l3b-chide{display:none!important}'
    +'body.l3-bt-left .l3b-cnote{display:block;font-size:12px;font-weight:800;color:#475569;background:#fff;border:1px dashed #cbd5e1;border-radius:10px;padding:7px 11px;margin-bottom:10px}}'
    /* 도구 칸 */
    +'.l3b-num{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;font-weight:800;color:#334155}'
    +'.l3b-num input{width:58px;box-sizing:border-box;font-family:inherit;font-size:12.5px;font-weight:800;border:1.5px solid #cbd5e1;border-radius:8px;padding:5px 7px}'
    +'.l3b-num input:focus,.l3b-chat input:focus{outline:2px solid #1d6fe8;outline-offset:1px}'
    +'.l3b-row2{display:grid;grid-template-columns:1fr 1fr;gap:6px}'
    +'.l3-btn[disabled]{opacity:.6;cursor:default}'
    +'.l3b-chat{display:flex;gap:5px}.l3b-chat input{flex:1;min-width:0;font-family:inherit;font-size:12.5px;border:1.5px solid #cbd5e1;border-radius:8px;padding:7px 8px}'
    +'.l3b-chat button{flex:none;border:none;border-radius:8px;padding:6px 10px;background:#1d6fe8;color:#fff;font-family:inherit;font-size:12px;font-weight:900;cursor:pointer}.l3b-chat button[disabled]{background:#94a3b8;cursor:default}'
    +'.l3r-ck{display:flex;gap:7px;align-items:center;font-weight:700;line-height:1.45;cursor:pointer}'
    +'.l3r-ck input{flex:none;width:15px;height:15px;margin:0;accent-color:#1d6fe8}'
    +'.l3r-ck select{font-family:inherit;font-size:12px;font-weight:800;border:1.5px solid #cbd5e1;border-radius:6px;padding:1px 3px;margin:0 2px}'
    +'.l3-flash{outline:3px solid #f59e0b!important;outline-offset:2px;border-radius:12px}'
    /* 리커버리 가운데 — 좁아지면 확정 명단을 줄이거나 아래로 */
    +'@media(min-width:900px){.l3r-wrap{container:l3rc / inline-size}'
    +'@container l3rc (max-width:1000px){.l3r-grid{grid-template-columns:minmax(0,1fr) 300px!important;gap:12px!important}}'
    +'@container l3rc (max-width:760px){.l3r-grid{grid-template-columns:minmax(0,1fr)!important}.l3r-grid>div[style*="sticky"]{position:static!important}}}';
  (document.head||document.documentElement).appendChild(st);
})();
