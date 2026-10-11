/* ═══════════════════════════════════════════════════════════════════
 * v19-104: 🧱 학원앱 3분할 틀 — 왼쪽은 기능 따라 · 가운데는 그대로 · 오른쪽은 «지금 화면의 도구»
 * 원장 결정 2026-10-11 (시안 docs/mockup_layout3.html 승인):
 *   「공용 메뉴 접기 좋다 · 순서 그대로(적중 분석 → 백지테스트·리커버리 → 나머지)」
 *
 *  ① 세 번째 칸 .tool-panel (#TOOL_PANEL, 폭 280px) — PC 1280px 이상에서만 보인다.
 *     화면마다 도구를 끼우는 자리: RIGHT_TOOLS[VIEW] = function(VIEW){ return html 또는 null }
 *     (window.perViewRightTools(VIEW) 가 이것을 부른다). 도구가 없는 화면은 칸이 0 으로 접혀 지금 두 칸 그대로.
 *  ② 공용 메뉴 접기 — 홈이 아닌 화면에서 왼쪽이 공용 메뉴(rList)뿐이면,
 *     「화면 이름」 머리 + 「▸ 공용 메뉴 (진도 현황 · 리커버리 · 명예의 전당 …)」 접힘 상자로 바꾼다.
 *     펼침/접힘은 이 PC 에만 기억(l3_common_open — 서버로 안 올림).
 *     홈 · 학생 목록 · 학생 상세 · 리포트 편집 화면은 학생 목록이 필요하므로 지금 그대로 다 보인다.
 *     자기 왼쪽 메뉴가 있는 화면(울트라 · 플래너 · 공지 · 아하노트 · 기록 · 강의실 · 학생관리 · 교재 · 녹음 · 출결 · 유형성취도 …)은 손대지 않는다.
 *  ③ PC 1024~1279px — 도구 칸은 숨기고, 도구가 있는 화면에서만 오른쪽 아래 「🛠 도구」 단추 → 서랍처럼 열림.
 *     폰·태블릿 세로(900px 미만)는 바뀌는 것이 없다.
 *  ※ 바탕 코드는 고치지 않고 render · perViewLeftNav 를 감싼다. 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var L3 = { pvNull:false, drawer:false, has:false, bucket:-1 };
window.RIGHT_TOOLS = window.RIGHT_TOOLS || {};
/* 홈처럼 공용 메뉴(학생 목록 포함)를 다 펼쳐 두는 화면 */
var L3_FULL_LEFT = { home:1, list:1, student_detail:1, form:1, preview:1, share:1 };

/* 화면별 도구 — 없으면 null */
window.perViewRightTools = function(v){
  var f=RIGHT_TOOLS[v]; if(typeof f!=='function') return null;
  try{ var h=f(v); return (h==null||h==='')?null:String(h); }
  catch(e){ try{ console.error('[도구 칸]', e); }catch(_){} return '<div class="l3-tool" style="color:#b91c1c">도구 칸 오류: '+String((e&&e.message)||e).replace(/</g,'&lt;')+'</div>'; }
};

/* ── 이 PC 에만 두는 설정 (서버 동기화 안 함) ── */
function l3Get(k){ try{ return (typeof _origGetItem==='function'?_origGetItem(k):localStorage.getItem(k)); }catch(e){ return null; } }
function l3Set(k, v){ try{ if(typeof _origSetItem==='function') _origSetItem(k, v); else localStorage.setItem(k, v); }catch(e){} }
function l3CommonOpen(){ return l3Get('l3_common_open')==='1'; }
window.l3CommonToggle = function(el){ if(!el) return; l3Set('l3_common_open', el.open?'1':'0'); };

/* 폭 구간: 0 폰·태블릿 세로 · 1 좁은 PC(왼쪽 칸만) · 2 PC 1024~1279(도구 서랍) · 3 PC 1280 이상(도구 칸) */
function l3Bucket(){ var w=window.innerWidth||0; return w<900?0:(w<1024?1:(w<1280?2:3)); }

/* 지금 화면 이름 — 위 기능 탭(GROUPS)에서 찾는다 */
function l3ViewTitle(v){
  var g0=null, s0=null;
  try{ (GROUPS||[]).forEach(function(g){ (g.subs||[]).forEach(function(s){ if(!s0 && s.v===v){ g0=g; s0=s; } }); }); }catch(e){}
  if(s0) return { grp:g0.icon+' '+g0.label, name:s0.icon+' '+s0.label };
  var gk=''; try{ gk=groupOfView(v); }catch(e){}
  var g=null; try{ g=(GROUPS||[]).filter(function(x){ return x.key===gk; })[0]||null; }catch(e){}
  return { grp:g?(g.icon+' '+g.label):'', name:g?(g.icon+' '+g.label):'🏫 루멘수학' };
}
function l3Esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
/* 왼쪽 머리 — 화면 이름 (뒤 부품도 쓴다) */
window.l3LeftHead = function(v){
  var t=l3ViewTitle(v==null?VIEW:v);
  return '<div class="l3-vhead">'+(t.grp&&t.grp!==t.name?'<small>'+l3Esc(t.grp)+'</small>':'')+'<b>'+l3Esc(t.name)+'</b></div>';
};
/* 접힌 공용 메뉴 상자 — inner 를 주면 그것을, 안 주면 rList() 를 넣는다 (뒤 부품의 왼쪽 메뉴 맨 아래에 쓴다) */
function l3CommonSummary(){ return '<summary><span class="l3-c">▸ 공용 메뉴 (진도 현황 · 리커버리 · 명예의 전당 …)</span><span class="l3-o">▾ 공용 메뉴 접기</span></summary>'; }
window.l3CommonFold = function(inner){
  var body=inner; if(body==null){ try{ body=rList(); }catch(e){ body='<div style="padding:10px;color:#fca5a5">공용 메뉴 오류: '+l3Esc(e&&e.message||e)+'</div>'; } }
  return '<details class="common-menu" id="L3_COMMON"'+(l3CommonOpen()?' open':'')+' ontoggle="l3CommonToggle(this)">'+l3CommonSummary()+'<div class="l3-cm-body">'+body+'</div></details>';
};

/* ── 왼쪽: 바탕이 공용 메뉴(rList)를 그렸는지 알아 두기 ── */
perViewLeftNav=(function(o){ return function(v){ var r=o.apply(this, arguments); L3.pvNull=(r==null); return r; }; })(perViewLeftNav);

/* 공용 메뉴를 접는다 — 이미 그려진 rList 의 칸들을 그대로 옮긴다(단추에 붙은 동작이 살아 있게) */
function l3FoldLeft(){
  var LC=document.getElementById('LIST_CONTENT'); if(!LC) return;
  var det=document.createElement('details'); det.className='common-menu'; det.id='L3_COMMON';
  if(l3CommonOpen()) det.open=true;
  det.setAttribute('ontoggle', 'l3CommonToggle(this)');
  det.innerHTML=l3CommonSummary();
  var body=document.createElement('div'); body.className='l3-cm-body';
  while(LC.firstChild) body.appendChild(LC.firstChild);
  det.appendChild(body);
  var head=document.createElement('div'); head.innerHTML=l3LeftHead(VIEW);
  LC.appendChild(head.firstChild); LC.appendChild(det);
}

/* ── 오른쪽: 도구 칸 만들기 (처음 그릴 때 한 번, .right-panel 바로 뒤) ── */
function l3Panel(){
  var tp=document.getElementById('TOOL_PANEL'); if(tp) return tp;
  var rp=document.querySelector('.app > .right-panel'); if(!rp||!rp.parentNode) return null;
  tp=document.createElement('div'); tp.className='tool-panel l3-empty'; tp.id='TOOL_PANEL'; tp.setAttribute('aria-label', '도구');
  rp.parentNode.insertBefore(tp, rp.nextSibling);
  return tp;
}
function l3Fab(){
  var b=document.getElementById('L3_FAB'); if(b) return b;
  b=document.createElement('button'); b.id='L3_FAB'; b.className='l3-fab'; b.type='button'; b.textContent='🛠 도구';
  b.onclick=function(){ l3Drawer(!L3.drawer); };
  document.body.appendChild(b);
  var bk=document.createElement('div'); bk.id='L3_BACK'; bk.className='l3-back'; bk.onclick=function(){ l3Drawer(false); };
  document.body.appendChild(bk);
  return b;
}
window.l3Drawer = function(on){
  L3.drawer=!!on && L3.has;
  var tp=document.getElementById('TOOL_PANEL'), bk=document.getElementById('L3_BACK'), fb=document.getElementById('L3_FAB');
  if(tp) tp.classList.toggle('l3-drawer', L3.drawer);
  if(bk) bk.classList.toggle('on', L3.drawer);
  if(fb) fb.classList.toggle('open', L3.drawer);
};
function l3Tools(){
  var tp=l3Panel(); if(!tp) return;
  var bk=l3Bucket(), h=bk>=2?perViewRightTools(VIEW):null;   /* 1024px 아래에서는 도구를 그리지 않는다 */
  L3.has=!!h;
  if(h){
    var keep=tp.scrollTop;
    tp.innerHTML='<div class="l3-dclose"><b>🛠 도구</b><button type="button" onclick="l3Drawer(false)">닫기 ✕</button></div>'+h;
    tp.classList.remove('l3-empty'); tp.scrollTop=keep;
  } else { if(tp.innerHTML) tp.innerHTML=''; tp.classList.add('l3-empty'); }
  var app=document.querySelector('.app'); if(app) app.classList.toggle('l3-tools', L3.has && bk===3);   /* 가운데가 좁아지면 위 기능 탭 글씨를 줄인다 */
  var fb=document.getElementById('L3_FAB')||(L3.has?l3Fab():null);
  if(fb) fb.classList.toggle('on', L3.has && bk===2);
  if(!L3.has || bk!==2) l3Drawer(false); else l3Drawer(L3.drawer);
}

/* ── render 감싸기: 바탕 그리기 → 왼쪽 공용 메뉴 접기 → 도구 칸 ── */
render = window.render = (function(o){ return function(){
  L3.pvNull=false;
  var r=o.apply(this, arguments);
  try{
    L3.bucket=l3Bucket();
    if(L3.pvNull && L3.bucket>=1 && !L3_FULL_LEFT[VIEW]) l3FoldLeft();
    l3Tools();
  }catch(e){ try{ console.error('[3분할]', e); }catch(_){} }
  return r; }; })(render);

/* 창 폭이 구간을 넘으면 한 번 다시 그린다 (예: PC 창을 줄였다 늘렸을 때) */
window.addEventListener('resize', function(){
  clearTimeout(L3.rt); L3.rt=setTimeout(function(){ if(l3Bucket()!==L3.bucket){ try{ render(); }catch(e){} } }, 200);
});

/* ── 모양 ── */
(function(){
  if(document.getElementById('l3-css')) return;
  var st=document.createElement('style'); st.id='l3-css';
  st.textContent=''
    /* 도구 칸: 기본은 숨김(폰·좁은 PC) */
    +'.tool-panel{display:none}'
    +'.l3-fab,.l3-back{display:none}'
    +'@media(min-width:1280px){'
    +'.tool-panel{display:flex;flex-direction:column;gap:10px;flex:none;width:280px;min-width:280px;height:100%;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;padding:14px 12px 24px;background:#f6f8fc;border-left:1px solid var(--border,#e2e8f0)}'
    +'.tool-panel.l3-empty{width:0;min-width:0;padding:0;border-left:0;overflow:hidden}'
    /* 도구 칸이 열리면 가운데가 280px 좁아진다 — 위 기능 탭 7개 글씨가 서로 붙지 않게 줄인다 */
    +'.app.l3-tools .ftb{font-size:14px;letter-spacing:-0.5px}.app.l3-tools .ftb span:first-child{font-size:22px}'
    +'.app.l3-tools .ftb span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis}'
    +'}'
    /* PC 1024~1279: 「🛠 도구」 단추 + 서랍 */
    +'@media(min-width:1024px) and (max-width:1279px){'
    +'.l3-fab.on{display:flex;align-items:center;gap:6px;position:fixed;right:22px;bottom:22px;z-index:9001;border:none;border-radius:999px;padding:12px 18px;background:#1d6fe8;color:#fff;font-family:inherit;font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 6px 18px rgba(13,34,64,.28)}'
    +'.l3-fab.on.open{background:#0d2240}'
    +'.l3-back.on{display:block;position:fixed;inset:0;z-index:8999;background:rgba(15,23,42,.35)}'
    +'.tool-panel.l3-drawer{display:flex;flex-direction:column;gap:10px;position:fixed;top:0;right:0;bottom:0;width:320px;z-index:9000;box-sizing:border-box;overflow-y:auto;padding:12px 12px 80px;background:#f6f8fc;border-left:1px solid #e2e8f0;box-shadow:-8px 0 24px rgba(13,34,64,.18)}'
    +'.tool-panel.l3-drawer .l3-dclose{display:flex}'
    +'}'
    +'.l3-dclose{display:none;align-items:center;justify-content:space-between;font-size:14px;color:#0d2240}'
    +'.l3-dclose button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 10px;font-family:inherit;font-weight:800;cursor:pointer}'
    /* 도구 칸 안 공통 모양 (뒤 부품이 쓴다) */
    +'.l3-ttl{font-size:11px;font-weight:900;color:#64748b;letter-spacing:.06em;margin:4px 2px -2px}'
    +'.l3-tool{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 11px;font-size:12.5px;display:flex;flex-direction:column;gap:6px;min-width:0;color:#0f172a}'
    +'.l3-tool>b{font-size:13px;color:#0d2240}'
    +'.l3-tool .l3-sub{font-size:11.5px;color:#64748b;font-weight:600;line-height:1.5}'
    +'.l3-ck{display:flex;gap:7px;align-items:flex-start;font-weight:700;line-height:1.45}'
    +'.l3-ck i{flex:none;width:14px;height:14px;margin-top:2px;border-radius:4px;background:#1d6fe8;color:#fff;font-size:10px;font-style:normal;text-align:center;line-height:14px}'
    +'.l3-ck i.off{background:transparent;border:1.5px solid #94a3b8;width:11px;height:11px}'
    +'.l3-btn{border:none;border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;font-weight:900;cursor:pointer;background:#e8f1ff;color:#1d4ed8;text-align:left;text-decoration:none;display:block}'
    +'.l3-btn:hover{filter:brightness(.97)}.l3-btn:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    +'.l3-btn.main{background:#6d28d9;color:#fff}.l3-btn.pri{background:#0d2240;color:#fff}'
    +'.l3-sel{font-family:inherit;font-size:12.5px;font-weight:800;border:1.5px solid #0d2240;border-radius:8px;padding:6px 8px;background:#fff;color:#0f172a;width:100%}'
    /* 왼쪽 머리 · 목록 (뒤 부품이 쓴다) */
    +'.l3-vhead{padding:14px 16px 8px;color:#fff;display:flex;flex-direction:column;gap:2px}'
    +'.l3-vhead small{font-size:11.5px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.04em}'
    +'.l3-vhead b{font-size:19px;font-weight:900}'
    +'.l3-sec{font-size:11.5px;font-weight:800;color:rgba(255,255,255,.45);letter-spacing:.06em;padding:10px 16px 4px}'
    +'.l3-lb{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:3px 10px;padding:10px 12px;border-radius:11px;background:rgba(255,255,255,.07);color:#e8eef6;font-size:14px;font-weight:800;cursor:pointer;border:none;font-family:inherit;text-align:left;width:calc(100% - 20px);box-sizing:border-box}'
    +'.l3-lb:hover{background:rgba(255,255,255,.13)}.l3-lb.on{background:#1d6fe8;color:#fff}'
    +'.l3-lb small{display:block;font-size:11.5px;font-weight:700;color:rgba(232,238,246,.6);margin-top:2px}.l3-lb.on small{color:#dbe8ff}'
    +'.l3-lb .n{flex:none;background:rgba(255,255,255,.14);border-radius:999px;padding:1px 8px;font-size:11.5px}'
    /* 접힌 공용 메뉴 */
    +'details.common-menu{margin:12px 10px 0;border-top:1px dashed rgba(255,255,255,.2);padding-top:8px}'
    +'details.common-menu>summary{list-style:none;cursor:pointer;padding:10px 12px;border-radius:11px;border:1px solid rgba(255,255,255,.16);color:rgba(255,255,255,.78);font-size:13.5px;font-weight:800}'
    +'details.common-menu>summary::-webkit-details-marker{display:none}'
    +'details.common-menu>summary:hover{background:rgba(255,255,255,.08);color:#fff}'
    +'details.common-menu .l3-o{display:none}details.common-menu[open] .l3-o{display:inline}details.common-menu[open] .l3-c{display:none}'
    +'details.common-menu .l3-cm-body{margin:4px -10px 0}';
  (document.head||document.documentElement).appendChild(st);
})();
