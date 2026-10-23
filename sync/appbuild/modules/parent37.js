/* ══ v1-37: 📚 숙제 4단계가 처음부터 보이게 (원장 결정 2026-10-23 · 시안 docs/mockup_parent_hw4.html ①②③)
 *   원장님 지적: 「학원앱은 풀이·채점·오답·아하노트를 각각 체크하는데 학부모앱은 총합만 보여 정보가 떨어진다」
 *   자료는 그대로 — lumen_hw[날짜]={p,c,w}(0/30/60/100) · 아하노트(hwAhaPct · ahaCnt · hwStuckScored). 서버 읽기·쓰기 추가 없음.
 *   눈금(학원앱 숙제체크와 같음): ○ 0 · ◔ 30 · ◐ 60 · ✓ 100   색: 1 풀이 파랑 · 2 채점 주황 · 3 오답 초록 · 4 아하노트 보라
 *   ① 과제 완성도 카드(vHwToday) — 총합 머리 아래 4칸을 항상 펼쳐 보인다(접기 없음). 숙제 탭 위쪽.
 *      홈 📚 카드(p35HwCard)의 4칸도 같은 눈금으로 바꿨다(빌드 rep).
 *   ② 숙제 탭 «단계별 체크 · 최근 수업일 7번» — 날짜 7개 × 4단계 + 종합, 가장 낮은 단계 한 줄 + 집에서 할 것 한 줄
 *   ③ 월 기록(vHwStat) — 맨 위 «단계별 평균 · 수업 n일» 4칸 + 지난달 대비, 막대 아래 달력(칸마다 단계 점 4개)
 *   이 파일의 function 선언은 앞의 같은 이름(vHwToday)을 덮어쓴다. */
var P37_ST=[
  { k:'p', n:1, nm:'풀이', tbl:'풀이', full:'문제 풀기', col:'#3b82f6', bg:'#eff6ff', bd:'#bfdbfe' },
  { k:'c', n:2, nm:'채점', tbl:'채점', full:'채점하기', col:'#f59e0b', bg:'#fffbeb', bd:'#fde68a' },
  { k:'w', n:3, nm:'오답', tbl:'오답', full:'오답 다시 풀기', col:'#22c55e', bg:'#f0fdf4', bd:'#bbf7d0' },
  { k:'a', n:4, nm:'아하노트', tbl:'아하', full:'아하노트 질문', col:'#a855f7', bg:'#faf5ff', bd:'#e9d5ff' }
];
/* 단계별 집에서 할 것 — 가장 낮은 단계에 맞춰 하나만 */
var P37_HOME={
  p:'📌 이번 주 집에서: 숙제를 시작하기 전에 «오늘 몇 쪽까지»를 같이 정해 주세요 — 1단계(풀기)를 끝까지 해야 다음 단계가 열려요',
  c:'📌 이번 주 집에서: 다 풀었으면 «채점했니?» 한 번만 물어봐 주세요 — 채점까지 해야 틀린 문제가 보여요',
  w:'📌 이번 주 집에서: 틀린 문제를 «답 보기 전에 한 번 더» — 3단계가 올라가면 종합이 100%에 가까워져요',
  a:'📌 이번 주 집에서: 다시 풀어도 모르는 문제는 사진 찍어 아하노트로 — 질문하는 것도 숙제예요'
};
var P37_ALLOK='📌 지금 습관 그대로 — 네 단계를 빠짐없이 지키고 있어요. 칭찬 한마디 부탁드려요';
var P37_TIP='✓ 다 함 · ◐ 절반(60%) · ◔ 조금(30%) · ○ 안 함 — 학원에서 선생님이 직접 확인한 체크예요. 4 아하노트는 막힌 문제가 없던 날 «해당 없음».';
function p37Mark(v){ if(v===null||v===undefined) return '—'; v=Number(v)||0; return v>=100?'✓':(v>=60?'◐':(v>=30?'◔':'○')); }
function p37Cls(v){ if(v===null||v===undefined) return 'na'; v=Number(v)||0; return v>=100?'ok':(v>0?'half':'no'); }
function p37St(k){ for(var i=0;i<P37_ST.length;i++){ if(P37_ST[i].k===k) return P37_ST[i]; } return P37_ST[0]; }
function p37Md(iso){ return (+iso.slice(5,7))+'/'+(+iso.slice(8,10)); }
/* 그날 질문 수 — 막힌 문제 수를 넘지 않게 (hwAhaPct 의 100% 상한과 같은 셈) */
function p37Got(iso){ var m=hwStuckScored(iso).length, g=(P.ahaCnt&&P.ahaCnt[iso])||0; return Math.min(g,m); }
function p37Day(iso){
  var v=hwOf(iso); if(!v) return null;
  return { p:v.p, c:v.c, w:v.w, a:hwAhaPct(iso), n:p37Got(iso), m:hwStuckScored(iso).length, t:hwTotal(iso) };
}
/* 여러 날 평균 — 아하노트는 «질문 합 ÷ 막힘 합» (막힘이 한 번도 없으면 null) */
function p37Agg(isos){
  var k=0,sp=0,sc=0,sw=0,n=0,m=0;
  isos.forEach(function(iso){
    var v=hwOf(iso); if(!v) return;
    k++; sp+=v.p; sc+=v.c; sw+=v.w;
    var mm=hwStuckScored(iso).length; if(mm){ m+=mm; n+=p37Got(iso); }
  });
  if(!k) return null;
  return { k:k, p:Math.round(sp/k), c:Math.round(sc/k), w:Math.round(sw/k), a:m?Math.round(n/m*100):null, n:n, m:m };
}
/* 가장 낮은 단계 — 같으면 앞 단계(순서대로 하는 숙제라 앞에서 멈춘 것) · 모두 100 이면 null */
function p37Low(A){
  if(!A) return null;
  var ks=['p','c','w']; if(A.a!==null) ks.push('a');
  var lo=null; ks.forEach(function(k){ if(lo===null||A[k]<A[lo]) lo=k; });
  return (lo!==null&&A[lo]<100)?lo:null;
}
/* 받침이 있으면 '은', 없으면 '는' */
function p37Eun(w){ var c=String(w).charCodeAt(String(w).length-1); return (c>=0xAC00&&c<=0xD7A3&&(c-0xAC00)%28)?'은':'는'; }
/* 머리 한 줄 — 「풀이·채점은 다 했고, 오답 다시 풀기는 절반 했어요」 */
function p37Desc(iso){
  var d=p37Day(iso); if(!d) return '';
  var ks=['p','c','w']; if(d.a!==null) ks.push('a');
  var done=[], first=null;
  ks.forEach(function(k){ if(d[k]>=100) done.push(p37St(k).nm); else if(first===null) first=k; });
  if(first===null) return d.a===null?'풀이·채점·오답을 모두 마쳤어요 (질문할 문제는 없었어요)':'네 단계를 모두 마쳤어요';
  var v=d[first], f=p37St(first).full;
  var lv=v>=60?'절반 했어요':(v>=30?'조금 했어요':'아직이에요');
  if(first==='a') lv=(d.n?('막힌 '+d.m+'문제 중 '+d.n+'개 질문했어요'):'아직 질문하지 않았어요');
  var tail=f+p37Eun(f)+' '+lv;
  if(!done.length) return tail;
  var dj=done.join('·');
  return dj+p37Eun(dj)+' 다 했고, '+tail;
}
/* 4칸 — 항상 펼침 */
function p37Cells(iso,mini){
  var d=p37Day(iso); if(!d) return '';
  var h='<div class="p37stg'+(mini?' mini':'')+'">';
  P37_ST.forEach(function(s){
    var v=d[s.k], na=(v===null), fg=na?'#94a3b8':s.col;
    var sub=(s.k==='a')?(na?'해당 없음':('질문 '+d.n+'/막힘 '+d.m)):(v+'%');
    h+='<div class="c" data-s="'+s.k+'" style="background:'+(na?'#f8fafc':s.bg)+';border-color:'+(na?'#eef2f7':s.bd)+'">'
      +'<div class="n">'+s.n+' '+s.nm+'</div>'
      +'<div class="m" style="color:'+fg+'">'+p37Mark(v)+'</div>'
      +'<div class="p" style="color:'+fg+'">'+sub+'</div>'
      +((s.k==='a'&&!na)?'<div class="q" style="color:'+fg+'">'+v+'%</div>':'')
      +'</div>';
  });
  return h+'</div>';
}

/* ① 과제 완성도 카드 — 접기 없음 (예전 vHwToday 를 덮어쓴다) */
function vHwToday(){
  if(!P.hwReady) return '';
  var iso=hwLatestIso(); if(!iso) return '';
  var t=hwTotal(iso), co=hwLine(iso);
  var h='<div class="hwcard p37card">';
  h+='<div class="hwhd" style="background:'+hwGrad(t)+';cursor:default">'
    +'<div class="hwtop"><span class="hw1">루멘수학 · 과제 완성도</span>'
    +'<span class="hwdate">'+hwDateBadge(iso)+'</span></div>'
    +'<div class="hw2"><span class="p37desc">'+esc(p37Desc(iso))+'</span><b>'+t+'<span>%</span></b></div>'
    +'<div class="hwbar"><i style="width:'+t+'%"></i></div></div>';
  h+='<div class="hwbd open">';
  h+=p37Cells(iso,false);
  h+='<div class="hwco" style="background:'+co[1]+';color:'+co[2]+'"><span>'+co[0]+'</span><span>'+co[3]+'</span></div>';
  h+='<div class="p37tip">'+P37_TIP+'</div>';
  // 집에서 할 것 (플래너·녹음 통합) — 예전 그대로
  var pl=plannerToday(), rc=recToday();
  h+='<div class="hwsub" style="margin-top:12px"><div class="hwsubt">🏠 집에서 할 것</div>';
  [['📓','오늘 플래너',pl],['🎙️','녹음 숙제',rc]].forEach(function(it){
    h+='<div class="hwitem" style="background:'+(it[2]?'#f0fdf4':'#f8fafc')+';color:'+(it[2]?'#15803d':'#64748b')+'">'
      +'<span>'+it[0]+'</span><span>'+it[1]+'</span>'
      +'<span class="st" style="color:'+(it[2]?'#059669':'#94a3b8')+'">'+(it[2]?'제출 완료 ✓':'아직 안 했어요')+'</span></div>';
  });
  h+='<div class="hwtip">플래너·녹음은 <b>학생이 집에서</b> 올리는 것이라, 저녁에 올리면 이곳이 초록으로 바뀝니다</div>';
  h+='</div>';
  h+='<button class="hwmore" onclick="event.stopPropagation();hwGoStat()">📊 '+Number(iso.slice(5,7))+'월 기록 보기</button>';
  h+='</div></div>';
  h+='<div class="hwfaq"><div class="q">❓ 「모르는 문제」가 뭔가요?</div>'
    +'혼자 다시 풀어봐도 <b>끝내 안 풀린 문제</b>를 사진 찍어 선생님께 올리는 것입니다(아하노트).<br>'
    +'막힌 문제가 없었던 날은 <b>「—(해당 없음)」</b>으로 표시되고 <b>완성도 점수에 들어가지 않습니다.</b></div>';
  return h;
}

/* ② 단계별 체크 · 최근 수업일 7번 (숙제 기록이 있는 날 = 수업일) */
function p37ClassIsos(n){
  var out=[], iso=p35Today();
  for(var i=0;i<150&&out.length<n;i++){ if(hwOf(iso)) out.unshift(iso); iso=p35Add(iso,-1); }
  return out;
}
function p37Steps7(){
  if(!P.hwReady) return '';
  var isos=p37ClassIsos(7); if(!isos.length) return '';
  var days=isos.map(function(iso){ var d=p37Day(iso); d.iso=iso; return d; });
  var h='<div class="sec p37sec"><div class="st">✅ 단계별 체크 <small class="p37sub">최근 수업일 '+days.length+'번</small><button class="more" onclick="hwGoStat()">월 기록 ›</button></div>';
  h+='<table class="p37g"><thead><tr><th class="l"></th>';
  days.forEach(function(d){ h+='<th>'+p37Md(d.iso)+'</th>'; });
  h+='</tr></thead><tbody>';
  P37_ST.forEach(function(s){
    h+='<tr data-s="'+s.k+'"><td class="l"><i style="background:'+s.col+'"></i>'+s.n+' '+s.tbl+'</td>';
    days.forEach(function(d){
      var v=d[s.k];
      if(s.k==='a') h+='<td class="a '+p37Cls(v)+'">'+(v===null?'—':(d.n+'/'+d.m))+'</td>';
      else h+='<td class="'+p37Cls(v)+'">'+p37Mark(v)+'</td>';
    });
    h+='</tr>';
  });
  h+='<tr class="tot"><td class="l">종합</td>';
  days.forEach(function(d){ h+='<td style="color:'+hwCol(d.t)+'">'+d.t+'</td>'; });
  h+='</tr></tbody></table>';
  var A=p37Agg(isos), lo=p37Low(A);
  if(lo){
    var s=p37St(lo);
    h+='<div class="p37msg">한 줄이 한 단계예요. 어느 단계에서 자꾸 멈추는지가 보입니다 — 이 아이는 <b class="p37low" style="color:'+s.col+'">「'+s.n+' '+s.full+'」</b>에서 멈춰요 <span class="p37avgnote">(최근 '+A.k+'번 평균 '+A[lo]+'%)</span></div>';
    h+='<div class="p37home">'+P37_HOME[lo]+'</div>';
  } else {
    h+='<div class="p37msg">한 줄이 한 단계예요. 최근 '+A.k+'번 모두 네 단계를 끝까지 마쳤어요.</div>';
    h+='<div class="p37home">'+P37_ALLOK+'</div>';
  }
  h+='<div class="p37tip" style="margin-bottom:0">✓ 다 함 · ◐ 절반 · ◔ 조금 · ○ 안 함 · 4 아하 = 질문/막힌 문제 (— 는 막힌 문제가 없던 날)</div>';
  return h+'</div>';
}

/* ③ 월 기록 — 맨 위 단계별 평균 4칸 + 지난달 대비 */
function p37MonIsos(y,m){
  var out=[], dinm=new Date(y,m,0).getDate();
  for(var d=1;d<=dinm;d++){ var iso=y+'-'+p36Pad(m)+'-'+p36Pad(d); if(hwOf(iso)) out.push(iso); }
  return out;
}
function p37MonthTop(y,m){
  var A=p37Agg(p37MonIsos(y,m)); if(!A) return '';
  var py=m===1?y-1:y, pm=m===1?12:m-1, B=p37Agg(p37MonIsos(py,pm));
  var h='<div class="mchart p37mtop"><div class="mct">단계별 평균 · 수업 '+A.k+'일</div><div class="p37avg">';
  P37_ST.forEach(function(s){
    var v=A[s.k], na=(v===null);
    var val=(s.k==='a')?(na?'—':(A.n+'/'+A.m)):(v+'%');
    h+='<div data-s="'+s.k+'"><div class="v" style="color:'+(na?'#94a3b8':s.col)+'">'+val+'</div><div class="k">'+s.n+' '+(s.k==='a'?'질문/막힘':s.nm)+'</div></div>';
  });
  h+='</div>';
  var cmp;
  if(!B) cmp=pm+'월 기록이 없어 지난달과 비교할 수 없어요.';
  else {
    var up=null, dn=null;
    P37_ST.forEach(function(s){
      if(A[s.k]===null||B[s.k]===null) return;
      var dv=A[s.k]-B[s.k];
      if(dv>0&&(up===null||dv>up.d)) up={ s:s, d:dv };
      if(dv<0&&(dn===null||dv<dn.d)) dn={ s:s, d:dv };
    });
    var parts=[];
    if(up) parts.push('가장 많이 오른 단계 <b style="color:#059669">'+up.s.n+' '+up.s.full+' +'+up.d+'%p</b>');
    if(dn) parts.push('가장 많이 내린 단계 <b style="color:#dc2626">'+dn.s.n+' '+dn.s.full+' −'+(-dn.d)+'%p</b>');
    cmp=parts.length?(pm+'월보다 '+parts.join(' · ')):(pm+'월과 단계별 평균이 같아요.');
  }
  h+='<div class="p37cmp">📈 '+cmp+'</div></div>';
  return h;
}
/* ③ 달력 — 수업한 날 칸마다 단계 점 4개 (진한 점 다 함 · 연한 점 일부 · 회색 안 함/해당 없음) */
function p37Cal(y,m,sel){
  var dinm=new Date(y,m,0).getDate(), first=new Date(y,m-1,1).getDay();
  var h='<div class="mchart p37calbox"><div class="mct">달력 <span style="font-weight:700;color:#94a3b8">— 점 = 풀이·채점·오답·아하</span></div><div class="p37cal">';
  ['일','월','화','수','목','금','토'].forEach(function(w){ h+='<div class="w">'+w+'</div>'; });
  for(var b=0;b<first;b++) h+='<div class="c e"></div>';
  for(var d=1;d<=dinm;d++){
    var iso=y+'-'+p36Pad(m)+'-'+p36Pad(d), x=p37Day(iso);
    if(!x){ h+='<div class="c"><div class="d">'+d+'</div></div>'; continue; }
    h+='<div class="c on'+(iso===sel?' sel':'')+'" data-iso="'+iso+'" onclick="hwSelDay(\''+iso+'\')"><div class="d">'+d+'</div><div class="dots">';
    P37_ST.forEach(function(s){
      var v=x[s.k], c=(v===null)?'x':(v>=100?'f':(v>0?'pt':'z'));
      h+='<i class="'+c+'" data-s="'+s.k+'"'+((c==='f'||c==='pt')?' style="background:'+s.col+'"':'')+'></i>';
    });
    h+='</div></div>';
  }
  h+='</div><div class="p37leg"><span><i style="background:#3b82f6"></i>풀이</span><span><i style="background:#f59e0b"></i>채점</span><span><i style="background:#22c55e"></i>오답</span><span><i style="background:#a855f7"></i>아하</span><span class="t">진한 점 다 함 · 연한 점 일부 · 회색 안 함</span></div></div>';
  return h;
}
