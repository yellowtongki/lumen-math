/* ═══════════════════════════════════════════════════════════════════
 * v19-142: 💳 수강료를 3분할로 — 왼쪽 수강료 메뉴 · 가운데 작업 · 오른쪽 통계(접기)
 * 원장 결정 2026-10-20 (시안 https://claude.ai/artifact/4yvqxKg2cLBJLZAPPC9YVY):
 *   「오른쪽 접기 넣고 위쪽 탭 없애서 만들어」
 *
 *  왼쪽 (PC 900px 이상 — perViewLeftNav('tuition'))
 *    「수강료」 칸 일곱(PAY_TABS 그대로 · 점검 건수 배지) → payTab(k)
 *    「기간」 이달 · 지난달 · 최근 3개월 · 올해 → payRangeSet (한 달이면 학생별 납부·점검의 달도 같이 옮겨진다)
 *    「지난달 한눈에」 청구 · 수납(수납률) · 미납 — paySummary(지난달)
 *    「바로 가기」 ↗ 결제선생 열기 · 🔄 다시 불러오기 · 맨 아래 접힌 「▸ 공용 메뉴」 (v19-104)
 *  가운데 — 지금 화면 그대로, 위쪽 가로 칩 줄(payTabBar)만 PC 900px 이상에서 뺀다(왼쪽 메뉴가 대신한다).
 *    폰·태블릿 세로(900px 미만)는 왼쪽 메뉴가 없으니 칩 줄을 그대로 둔다.
 *  오른쪽 도구 (RIGHT_TOOLS.tuition) — 어느 칸에서나 같은 통계
 *    손익(고른 기간 · finRangeStat) 매출 · 고정비 · 변동비 · 손익분기 · 순이익
 *    월별 추세(기간 끝 달까지 6개월 · 매출 막대 + 순이익 선) · 다음 달 예상(finForecast) · 지금 챙길 것(누르면 그 칸으로)
 *    「▸ 접기」 → 52px 띠(순이익만) · 「◂ 통계」로 다시 펼침. 이 PC 에만 기억(tu_right_fold — 서버로 안 올림)
 *    PC 1024~1279 는 v19-104 「🛠 도구」 서랍이라 접기 없이 다 보인다.
 *  ※ 바탕 함수는 부르기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var TU = { foldKey:'tu_right_fold' };
function tuFolded(){ return l3Get(TU.foldKey)==='1'; }
window.tuFold = function(on){ l3Set(TU.foldKey, on?'1':'0'); try{ render(); }catch(e){} };
function tuOn(){ return VIEW==='tuition' && isDesktop(); }
function tuSafe(f, d){ try{ return f(); }catch(e){ try{ console.error('[수강료 3분할]', e); }catch(_){} return d; } }
function tuMan(n){ return tuSafe(function(){ return finMan(n); }, String(n)); }

/* ── 가운데: 위쪽 가로 칩 줄은 PC 에서 뺀다 ── */
payTabBar = (function(o){ return function(){ if(tuOn()) return ''; return o.apply(this, arguments); }; })(payTabBar);

/* ── 왼쪽 ── */
var TU_RANGES=[ ['m0','이달'], ['m1','지난달'], ['r3','최근 3개월'], ['yr','올해'] ];
function tuLeft(){
  var cur=PAY.tab||'pl', chk=PAY.loaded?tuSafe(function(){ return finChecks(payYm()).total; }, 0):0;
  var upd=(PAY.monthly&&PAY.monthly.updated)?tuSafe(function(){ return payStampLabel(PAY.monthly.updated); }, ''):'';
  var h=l3LeftHead('tuition')
    +'<div class="tu-lsub">결제선생 · 새벽 04:40 자동 수집'+(upd?(' · 마지막 '+l3Esc(upd)):'')+'</div>'
    +'<div class="l3-sec">수강료</div>';
  PAY_TABS.forEach(function(t){
    var on=t.k===cur;
    h+='<button type="button" class="l3-lb'+(on?' on':'')+'" data-tu-tab="'+t.k+'" aria-current="'+(on?'true':'false')+'" onclick="payTab(\''+t.k+'\')">'
      +'<span>'+t.label+'</span>'+((t.k==='chk'&&chk)?('<span class="n tu-bad">'+chk+'</span>'):'')+'</button>';
  });
  var r=PAY.loaded?tuSafe(payRange, null):null, pre=r?(r.preset||''):'';
  h+='<div class="l3-sec">기간</div><div class="tu-chips">';
  TU_RANGES.forEach(function(x){
    h+='<button type="button" class="tu-chip'+(pre===x[0]?' on':'')+'" data-tu-range="'+x[0]+'" onclick="payRangeSet(\''+x[0]+'\')">'+x[1]+'</button>';
  });
  if(pre==='custom') h+='<span class="tu-chip on" style="cursor:default">📅 직접</span>';
  h+='</div>';
  if(r) h+='<div class="tu-lsub" style="padding-top:4px">'+l3Esc(tuSafe(payRangeLabel, ''))+(pre==='custom'?'':' · 직접 고르기는 가운데 「📈 손익」')+'</div>';
  /* 지난달 한눈에 */
  if(PAY.loaded){
    var pm=payRecentMonths(2)[1], s=tuSafe(function(){ return paySummary(pm); }, null);
    if(s){
      h+='<div class="tu-lbox" id="tu-last"><div class="t">지난달 한눈에 ('+l3Esc(pm)+')</div>'
        +'<div class="tu-mini"><span>청구</span><b>'+s.billed.count+'건 · '+tuMan(s.billed.amount)+'</b></div>'
        +'<div class="tu-mini"><span>수납</span><b>'+s.paid.count+'건 · '+s.paid.pct+'%</b></div>'
        +'<div class="tu-mini"><span>미납</span><b'+(s.unpaid.count?' style="color:#fca5a5"':'')+'>'+s.unpaid.count+'건'+(s.unpaid.amount?(' · '+tuMan(s.unpaid.amount)):'')+'</b></div></div>';
    }
  }
  h+='<div class="tu-lbox"><div class="t">바로 가기</div>'
    +'<a class="tu-go" href="https://manager.payssam.kr" target="_blank" rel="noopener" id="tu-open-payssam"><span>↗ 결제선생 열기</span><span>›</span></a>'
    +'<button type="button" class="tu-go" id="tu-reload" onclick="payReload()"><span>🔄 다시 불러오기</span><span>›</span></button></div>';
  return h+l3CommonFold();
}
perViewLeftNav=(function(o){ return function(v){
  if(v==='tuition' && isDesktop()) return tuLeft();   /* 폰은 지금 그대로 */
  return o.apply(this, arguments); }; })(perViewLeftNav);

/* ── 오른쪽: 월별 추세 작은 그림 (매출 막대 + 순이익 선) ── */
function tuTrendMonths(){
  var ms=tuSafe(payRangeMonths, [payYm()]), end=ms[ms.length-1]||payYm(), out=[], i;
  for(i=5;i>=0;i--) out.push(lgPlShiftMonth(end,-i));
  return out;
}
function tuTrendSvg(ms){
  var W=256, H=132, L=6, R=6, T=16, B=18, iw=W-L-R, ih=H-T-B;
  var data=ms.map(function(m){ return finMonth(m); }), hi=0, lo=0;
  data.forEach(function(d){ hi=Math.max(hi, d.sales, d.net); lo=Math.min(lo, d.net); });
  if(hi<=0) hi=1;
  var span=(hi-lo)||1, yOf=function(v){ return T+(hi-v)/span*ih; }, slot=iw/ms.length, bw=Math.min(24, slot-12), y0=yOf(0);
  var maxI=0; data.forEach(function(d,i){ if(d.sales>data[maxI].sales) maxI=i; });
  var s='<svg id="tu-trend" viewBox="0 0 '+W+' '+H+'" width="100%" role="img" aria-label="월별 매출과 순이익" style="display:block">';
  s+='<line x1="'+L+'" y1="'+y0.toFixed(1)+'" x2="'+(W-R)+'" y2="'+y0.toFixed(1)+'" stroke="#e2e8f0"/>';
  var pts=[];
  data.forEach(function(d,i){
    var c=L+slot*(i+0.5), ys=yOf(Math.max(0,d.sales));
    s+='<rect class="tu-bar" data-ym="'+d.ym+'" x="'+(c-bw/2).toFixed(1)+'" y="'+ys.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(0.5,y0-ys).toFixed(1)+'" rx="3" fill="'+FIN_C.sales+'" opacity="'+(i===data.length-1?'1':'.55')+'"><title>'+d.ym+' 매출 '+Number(d.sales).toLocaleString()+'원 · 순이익 '+Number(d.net).toLocaleString()+'원</title></rect>';
    pts.push(c.toFixed(1)+','+yOf(d.net).toFixed(1));
    if((i===data.length-1 || i===maxI) && d.sales>0) s+='<text x="'+c.toFixed(1)+'" y="'+Math.max(10, ys-4).toFixed(1)+'" font-size="9.5" font-weight="800" fill="#0d2240" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">'+tuMan(d.sales)+'</text>';
    s+='<text x="'+c.toFixed(1)+'" y="'+(H-4)+'" font-size="10" fill="#64748b" text-anchor="middle">'+Number(String(d.ym).slice(5,7))+'월</text>';
  });
  s+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+FIN_C.net+'" stroke-width="2"/>';
  if(pts.length){ var lp=pts[pts.length-1].split(','); s+='<circle cx="'+lp[0]+'" cy="'+lp[1]+'" r="3.5" fill="'+FIN_C.net+'"/>'; }
  return s+'</svg>';
}
/* 지금 챙길 것 — [글, 이동할 칸, 나쁨?] */
function tuTodo(){
  var out=[], ym=payYm();
  var s=tuSafe(function(){ return paySummary(ym); }, null);
  if(s && s.unpaid.count) out.push([ym+' 미납 '+s.unpaid.count+'건 · '+tuMan(s.unpaid.amount), 'stu', true]);
  var ck=tuSafe(function(){ return finChecks(ym); }, null);
  if(ck && ck.total) out.push(['점검 '+ck.total+'건 (청구 누락 '+ck.miss.length+' · 금액 다름 '+ck.diff.length+' · 연체 습관 '+ck.late.length+')', 'chk', true]);
  var cfg=tuSafe(finCfg, {}), fixed=tuSafe(function(){ return finFixedSum(ym); }, 0);
  if(!(fixed>0)) out.push(['고정비가 0원입니다 — 월세·관리비 등을 적어 주세요', 'cost', false]);
  if(!(Number(cfg.ownerPay)>0)) out.push(['원장님 인건비 미입력', 'cost', false]);
  return out;
}
function tuStats(){
  if(!PAY.loaded) return '<div class="l3-tool"><b>📊 통계</b><span class="l3-sub">결제선생 자료를 불러오는 중…</span></div>';
  var st=finRangeStat(), ms=st.months, per=finPaidPerStudent(ms), be=finBreakeven(st.cost, per.avg), fold=L3.bucket===3;
  var h='<div class="tu-rhead"><b>📊 손익</b><small>'+l3Esc(payRangeLabel())+'</small>'
    +(fold?'<button type="button" class="tu-fold-btn" id="tu-fold" onclick="tuFold(true)" title="통계 칸 접기 (이 PC 에만 기억)">접기 ▸</button>':'')+'</div>';
  h+='<div class="tu-kpis" id="tu-kpis">'
    +'<div class="tu-kpi"><span>매출 (승인−취소)</span><b style="color:'+FIN_C.sales+'">'+tuMan(st.sales)+'</b></div>'
    +'<div class="tu-kpi"><span>고정비</span><b>'+tuMan(st.fixed)+'</b></div>'
    +'<div class="tu-kpi"><span>변동비</span><b style="color:'+FIN_C.cost+'">'+tuMan(st.vari)+'</b></div>'
    +'<div class="tu-kpi"><span>손익분기 학생</span><b style="color:#6d28d9">'+(be?(be+'명'):'—')+'</b></div>'
    +'<div class="tu-kpi main" id="tu-net"><span>순이익 · 매출의 '+((st.sales>0)?Math.round(st.net/st.sales*100):0)+'%</span><b>'+tuMan(st.net)+'</b></div></div>';
  var tm=tuTrendMonths();
  h+='<div class="l3-tool" id="tu-trend-box"><b>월별 추세 <small class="tu-sm">'+Number(tm[0].slice(5,7))+'~'+Number(tm[5].slice(5,7))+'월 · <i style="color:'+FIN_C.sales+'">■</i> 매출 <i style="color:'+FIN_C.net+'">●</i> 순이익</small></b>'+tuTrendSvg(tm)+'</div>';
  var fc=finForecast();
  h+='<div class="l3-tool" id="tu-fc"><b>다음 달 예상 <small class="tu-sm">'+l3Esc(fc.next)+'</small></b>'
    +'<div class="tu-row"><span>예상 청구 (명단 × 규칙)</span><b>'+tuMan(fc.bill)+'</b></div>'
    +'<div class="tu-row"><span>최근 3개월 수납률 '+fc.rate+'%</span><b>'+tuMan(fc.expect)+'</b></div>'
    +'<div class="tu-row"><span>고정비 + 변동비</span><b style="color:'+FIN_C.cost+'">−'+tuMan(fc.cost)+'</b></div>'
    +'<div class="tu-row tot"><span>예상 순이익</span><b id="tu-fc-net" style="color:'+FIN_C.net+'">'+tuMan(fc.net)+'</b></div></div>';
  var td=tuTodo();
  h+='<div class="l3-tool" id="tu-todo"><b>지금 챙길 것</b>';
  if(!td.length) h+='<span class="l3-sub">✓ 지금 챙길 것이 없습니다</span>';
  td.forEach(function(x){
    h+='<button type="button" class="tu-todo'+(x[2]?' bad':'')+'" data-tu-go="'+x[1]+'" onclick="payTab(\''+x[1]+'\')"><span>'+l3Esc(x[0])+'</span><span class="go">'
      +({stu:'학생별 납부',chk:'점검',cost:'고정비'}[x[1]]||'')+' ›</span></button>';
  });
  return h+'</div>';
}
/* 접힌 띠 — 순이익만 */
function tuFoldStrip(){
  var net=PAY.loaded?tuSafe(function(){ return tuMan(finRangeStat().net); }, ''):'';
  return '<button type="button" class="tu-unfold" id="tu-unfold" onclick="tuFold(false)" title="통계 칸 펼치기"><span>◂</span><span class="v">통계</span>'
    +(net?('<span class="v sm">순이익 '+l3Esc(net)+'</span>'):'')+'</button>';
}
RIGHT_TOOLS.tuition = function(){
  if(L3.bucket===3 && tuFolded()) return tuFoldStrip();
  return tuSafe(tuStats, '<div class="l3-tool" style="color:#b91c1c">통계를 그리지 못했습니다</div>');
};

/* render 뒤 — 접혔으면 도구 칸을 좁은 띠로 */
render = window.render = (function(o){ return function(){
  var r=o.apply(this, arguments);
  try{
    var tp=document.getElementById('TOOL_PANEL');
    if(tp) tp.classList.toggle('tu-folded', VIEW==='tuition' && L3.bucket===3 && tuFolded() && L3.has);
  }catch(e){}
  return r; }; })(render);

/* ── 모양 ── */
(function(){
  if(document.getElementById('tu142-css')) return;
  var st=document.createElement('style'); st.id='tu142-css';
  st.textContent=''
    +'.tu-lsub{padding:0 16px 4px;font-size:11.5px;font-weight:600;color:rgba(255,255,255,.5);line-height:1.5}'
    +'.l3-lb .n.tu-bad{background:#dc2626;color:#fff}'
    +'.tu-chips{display:flex;flex-wrap:wrap;gap:6px;padding:2px 14px 0}'
    +'.tu-chip{border:none;font-family:inherit;font-size:12.5px;font-weight:800;padding:6px 11px;border-radius:999px;background:rgba(255,255,255,.09);color:#e8eef6;cursor:pointer}'
    +'.tu-chip:hover{background:rgba(255,255,255,.16)}.tu-chip.on{background:#fff;color:#0d2240}'
    +'.tu-chip:focus-visible,.tu-go:focus-visible,.tu-todo:focus-visible,.tu-unfold:focus-visible,.tu-fold-btn:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}'
    +'.tu-lbox{margin:10px 10px 0;background:rgba(255,255,255,.06);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px}'
    +'.tu-lbox .t{font-size:11.5px;font-weight:800;color:rgba(255,255,255,.5)}'
    +'.tu-mini{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#cbd5e1}.tu-mini b{color:#fff;white-space:nowrap}'
    +'.tu-go{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:#e8eef6;padding:2px 0}.tu-go:hover{color:#fff;text-decoration:underline}'
    /* 오른쪽 */
    +'.tu-rhead{display:flex;align-items:baseline;gap:7px;margin:2px 2px 0}.tu-rhead b{font-size:14px;color:#0d2240}.tu-rhead small{font-size:11px;font-weight:700;color:#64748b;min-width:0}'
    +'.tu-fold-btn{margin-left:auto;flex:none;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:4px 9px;font-family:inherit;font-size:11.5px;font-weight:800;color:#0d2240;cursor:pointer}'
    +'.tu-kpis{display:grid;grid-template-columns:1fr 1fr;gap:7px}'
    +'.tu-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:11px;padding:8px 10px;display:flex;flex-direction:column;gap:1px;min-width:0}'
    +'.tu-kpi span{font-size:11px;font-weight:700;color:#64748b}.tu-kpi b{font-size:18px;font-weight:900;color:#0d2240;font-variant-numeric:tabular-nums}'
    +'.tu-kpi.main{grid-column:1 / -1;background:linear-gradient(135deg,#1d6fe8,#0d2240);border-color:#0d2240}.tu-kpi.main span{color:rgba(255,255,255,.82)}.tu-kpi.main b{color:#fff;font-size:23px}'
    +'.tu-sm{font-size:11px;font-weight:700;color:#94a3b8}.tu-sm i{font-style:normal}'
    +'.tu-row{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#475569}.tu-row b{color:#0d2240;white-space:nowrap;font-variant-numeric:tabular-nums}'
    +'.tu-row.tot{border-top:2px solid #e6eaf1;padding-top:5px;font-weight:900;color:#0d2240}'
    +'.tu-todo{all:unset;box-sizing:border-box;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;font-size:12px;font-weight:700;color:#334155;padding:7px 9px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0;line-height:1.45}'
    +'.tu-todo.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}.tu-todo:hover{filter:brightness(.97)}'
    +'.tu-todo .go{flex:none;font-size:10.5px;font-weight:800;color:#1d4ed8;background:#e8f1ff;border-radius:6px;padding:1px 6px}'
    /* 접힌 띠 (PC 1280 이상) */
    +'.tu-unfold{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%;padding:10px 0;border-radius:10px;background:#fff;border:1px solid #e2e8f0;color:#0d2240;font-weight:900;font-size:13px}'
    +'.tu-unfold:hover{background:#e8f1ff}.tu-unfold .v{writing-mode:vertical-rl;letter-spacing:.08em}.tu-unfold .v.sm{font-size:11.5px;color:#0f9d8a}'
    +'@media(min-width:1280px){.app>.tool-panel.tu-folded:not(.l3-empty){width:52px;min-width:52px;max-width:52px;padding:12px 6px}}';   /* 앞 부품의 넓은 칸 규칙(:not(.l3-empty))보다 세게 */
  (document.head||document.documentElement).appendChild(st);
})();
