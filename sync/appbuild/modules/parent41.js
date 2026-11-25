/* ═══════════════════════════════════════════════════════════════════
 * v1-41: 📚 홈 숙제 카드 C안 (원장 2026-11-17 「C안 · 학원앱 표현 그대로 · 만들어 배포」 · 시안 docs/mockup_parent_hwdate_c.html)
 *  ① 선생님이 확인한 «가장 최근» 숙제를 크게 — 수업 없는 날 다음 수업일 «확인 전» 빈 카드가 지난 결과를 가리던 문제 고침
 *  ② 왼쪽 달력 쪽지(월 · 일 · 요일) — 며칠 숙제인지 먼저 보이게
 *  ③ 풀이·채점·오답·아하 각 % + 학원앱 숙제체크(v19-177 HWK_TIER) 이행도 4단 색: 100 진초록 · 60~99 연두 · 30~59 주황 · 0~29 빨강
 *     종합 % = hwTotal (학원앱 hwsTot 와 같은 식) · 아하 없음 = 회색 «해당 없음»
 *  ④ 다음 수업일이 아직 확인 전이면 «⏳ 다음 확인 m/d» 한 줄 · 그날이 오늘이면 위 띠 + 지난 결과 흐리게
 *  서버 읽기·쓰기 추가 없음. ES5 · 문자열 연결. 같은 이름 함수 p35HwCard 를 덮어쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var P41_T = {
  100: { f:'#bbf7d0', s:'#16a34a', c:'#15803d', chip:'#16a34a', w:'다 함',   lb:'🟢 숙제 완료' },
  60:  { f:'#ecfccb', s:'#84cc16', c:'#4d7c0f', chip:'#65a30d', w:'거의 함', lb:'🟡 거의 했어요' },
  30:  { f:'#fed7aa', s:'#f97316', c:'#c2410c', chip:'#ea580c', w:'조금',    lb:'🟠 조금 했어요' },
  0:   { f:'#fecaca', s:'#ef4444', c:'#b91c1c', chip:'#dc2626', w:'안 함',   lb:'🔴 숙제 미흡' }
};
function p41Tier(v){ v=Number(v)||0; return v>=100?100:(v>=60?60:(v>=30?30:0)); }
function p41Last(){ var t=p35Today(); return hwOf(t)?t:p38LastChecked(t); }
function p35HwCard(){
  var today=p35Today(), S=p38Session(), iso=p41Last();
  var pend=(S&&!hwOf(S)&&(!iso||S>iso))?S:null;
  if(!iso){
    if(pend) return p38PendingCard(pend);
    return '<div class="p35card"><div class="p35hd" style="background:linear-gradient(135deg,#64748b,#94a3b8)"><div class="l"><div class="k">📚 숙제 완성도</div><div class="t">아직 기록이 없어요</div></div></div><div class="p35bd"><div class="note">선생님이 수업에서 숙제를 확인하면 이곳에 바로 보입니다.</div></div></div>';
  }
  var d=p37Day(iso), t=d.t, K=P41_T[p41Tier(t)], dim=(pend&&pend===today);
  var h='<div class="p35card p41card'+(dim?' p41dim':'')+'" data-iso="'+iso+'" onclick="hwGoStat()">';
  if(dim) h+='<div class="p41today">⏳ 오늘 <span>'+p35Md(pend)+'</span> 수업에서 선생님이 확인해요</div>';
  h+='<div class="p41row"><div class="p41cal"><div class="m">'+(+iso.slice(5,7))+'월</div><div class="d">'+(+iso.slice(8,10))+'</div><div class="w">'+P35_DOW[p35Dow(iso)]+'요일</div></div>';
  h+='<div class="p41sum"><div class="k">📚 '+(pend?'지난 수업 숙제':'숙제')+' · 선생님 확인</div><div class="t">'+K.lb+'<span class="tot" style="background:'+K.chip+'">'+t+'%</span></div>';
  h+='<div class="bar"><i style="width:'+Math.max(2,Math.min(100,t))+'%;background:'+K.s+'"></i></div></div></div>';
  h+='<div class="p35bd"><div class="p41stg">';
  P37_ST.forEach(function(s){
    var v=d[s.k], nm=s.n+' '+(s.k==='a'?'아하':s.nm);
    if(v===null||v===undefined){ h+='<div class="st na" data-s="'+s.k+'"><div class="n">'+nm+'</div><div class="v">해당 없음</div><div class="s">질문할 문제 없음</div></div>'; return; }
    var k=P41_T[p41Tier(v)];
    h+='<div class="st" data-s="'+s.k+'" style="background:'+k.f+';border-color:'+k.s+'"><div class="n">'+nm+'</div><div class="v" style="color:'+k.c+'">'+v+'<small>%</small></div><div class="s" style="color:'+k.c+'">'+(s.k==='a'?('질문 '+d.n+'/'+d.m):k.w)+'</div></div>';
  });
  h+='</div><div class="p41leg">'+[100,60,30,0].map(function(x){ var k=P41_T[x]; return '<span><i style="background:'+k.f+';border-color:'+k.s+'"></i>'+(x===100?'100':x===60?'60~99':x===30?'30~59':'0~29')+'</span>'; }).join('')+'</div>';
  if(pend) h+='<div class="p41next">⏳ 다음 확인 <b>'+(pend===today?'오늘 ':'')+p35Md(pend)+'</b> · 수업 시간에 선생님이 확인하면 바로 바뀌어요</div>';
  h+=p38Lines(pend||iso);
  var co=hwLine(iso);
  h+='<div class="note" style="background:'+co[1]+';color:'+co[2]+'">'+co[0]+' '+co[3]+'</div>';
  var M=p35Month(iso);
  if(M.n){
    h+='<div class="foot"><b>'+M.m+'월</b><span style="color:'+(M.avg>=80?'#65a30d':M.avg>=p35Cfg().weak?'#d97706':'#dc2626')+'">평균 '+M.avg+'%</span><span class="mdots">'
      +M.days.map(function(x){ return '<i style="background:'+p35DotColor(x.t)+(x.iso===iso?';box-shadow:0 0 0 1.5px #0d2240':'')+'"></i>'; }).join('')+'</span>'
      +'<span class="r">완료 '+M.ok+' · 미흡 '+M.weak+'</span><span class="go">›</span></div>';
  }
  return h+'</div></div>';
}
