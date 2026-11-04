/* ══ v1-38: 숙제 체크 보이기 — A안(선생님 확인만) + 📄 학습지 줄 + 📗 이번 숙제 줄
 *   (원장 결정 2026-11-03 · 설계서 docs/hw_dispatch_contract.md §9-4 · 시안 docs/mockup_parent_hwcheck.html A안 ①②③)
 *   ① 「선생님 확인 전」 상태 — 홈 📚 카드가 보여 줄 수업일(오늘이 수업일이면 오늘, 아니면 반 요일표의 다음 수업일)에
 *      lumen_hw 가 없으면 회색 상자 + 4칸 흐리게 + 「지난 수업 m/d (요일) 확인: ✓ ✓ ◐」 한 줄. 요일표가 없으면 지금처럼 마지막 확인 날짜.
 *   ② 📄 학습지 줄 — mf_wsq_<코드>.list 중 태그 「숙제」(HOMEWORK)이고 배정일이 그 수업일 앞 7일 안(지난 수업일 뒤)인 것:
 *      제목 · n문항 · 채점됐으면 「o문항 맞음」 아니면 「○요일까지」(마감 = 그 수업일). 홈 카드 + 숙제 탭 7일 표 「📄 학습지」 줄.
 *      ⚠️ 문제 그림·문항 내용은 절대 안 보인다(시험지 규칙) — 읽을 때 제목·숫자만 남기고 problems 는 버린다.
 *   ③ 📗 이번 숙제 줄 — todo_<코드>.items 중 hw===true 이고 due 가 그 수업일인 카드(학습지 카드는 ②와 겹치니 뺀다): 제목 · 쪽 · 문항. 없으면 줄 자체를 안 그린다.
 *   학생 셀프 체크(hw_self_*)는 읽지도 않는다(A안). 서버 쓰기 없음. 새 키 없음(mf_wsq_·todo_ 는 학원앱·수집기가 이미 쓰는 키).
 *   이 파일의 function 선언은 앞의 같은 이름을 덮어쓴다. */

/* ── 읽은 자료 다듬기 — 학습지 목록은 제목·숫자만 남긴다(그림 주소·문항은 메모리에도 두지 않는다) ── */
function p38TrimWsq(v){
  var list=(v&&Array.isArray(v.list))?v.list:[];
  return list.map(function(w){
    if(!w) return null;
    return { swId:w.swId, wid:w.wid, title:String(w.title||''), date:String(w.date||'').slice(0,10), tag:String(w.tag||'').toUpperCase(),
      status:String(w.status||''), auto:!!w.auto, n:Number(w.n)||0, o:Number(w.o)||0, x:Number(w.x)||0, q:Number(w.q)||0, score:(w.score!=null?Number(w.score):null) };
  }).filter(function(w){ return w&&w.date; });
}
function p38TrimTodo(v){
  var items=(v&&Array.isArray(v.items))?v.items:[];
  return items.map(function(it){
    if(!it||typeof it!=='object') return null;
    return { id:String(it.id||''), kind:String(it.kind||''), src:String(it.src||''), title:String(it.title||''), book:String(it.book||''),
      from:(it.from!=null&&it.from!==''?Number(it.from):null), to:(it.to!=null&&it.to!==''?Number(it.to):null), n:(it.n!=null?Number(it.n):null),
      print:!!it.print, hw:it.hw===true, due:String(it.due||'').slice(0,10), tst:String(it.tst||'') };
  }).filter(function(it){ return it&&it.hw&&it.due; });
}

/* ── 수업일 셈 — 반 요일표(lumen_group_days, 0=일)가 있을 때만. 오늘이 수업일이면 오늘, 아니면 다음 수업일(7일 안). 모르면 null ── */
function p38Session(){
  var cd=p35ClassDays(); if(!cd) return null;
  var iso=p35Today();
  for(var i=0;i<8;i++){ if(cd.indexOf(p35Dow(iso))>=0) return iso; iso=p35Add(iso,1); }
  return null;
}
/* 그 날짜 바로 앞 수업일 — 요일표가 있으면 요일표, 없으면 숙제 기록이 있는 날(최대 7일 앞) */
function p38PrevClass(iso){
  var cd=p35ClassDays(), d=p35Add(iso,-1);
  for(var i=0;i<7;i++){
    if(cd?cd.indexOf(p35Dow(d))>=0:!!hwOf(d)) return d;
    d=p35Add(d,-1);
  }
  return p35Add(iso,-7);
}
/* 그 날짜보다 앞선 마지막 선생님 확인 날 (30일 안) */
function p38LastChecked(before){
  var d=p35Add(before,-1);
  for(var i=0;i<30;i++){ if(hwOf(d)) return d; d=p35Add(d,-1); }
  return null;
}

/* ── ② 학습지 — 그 수업일(iso)까지 마감인 「숙제」 태그 학습지: 배정일 ∈ [지난 수업일, iso) 이고 iso 앞 7일 안 ── */
function p38WsFor(iso,lo){
  var list=P.wsq||[]; if(!iso||!list.length) return [];
  var floor=p35Add(iso,-7); lo=lo||p38PrevClass(iso); if(lo<floor) lo=floor;
  return list.filter(function(w){ return w.tag==='HOMEWORK'&&w.date>=lo&&w.date<iso; })
    .sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); });
}
function p38WsGraded(w){ return (w.o+w.x+w.q)>0||w.status==='학습완료'; }
/* 그 수업일 학습지 모음 → { k:학습지 수, n:문항 합, o:맞은 합, graded:모두 채점됨 } */
function p38WsSum(ws){
  var n=0,o=0,g=0; ws.forEach(function(w){ n+=w.n; o+=w.o; if(p38WsGraded(w)) g++; });
  return { k:ws.length, n:n, o:o, graded:ws.length>0&&g===ws.length };
}
/* 마감 배지 글 — 「오늘까지」 / 「수요일까지」 */
function p38DueTxt(iso){ return iso===p35Today()?'오늘까지':(P35_DOW[p35Dow(iso)]+'요일까지'); }

/* ── ③ 교재·프린트 숙제 카드 — hw:true · due = 그 수업일 · 학습지 카드(kind 'ws' / a:ws:*)는 뺀다 ── */
function p38BooksFor(iso){
  var items=P.todo||[]; if(!iso) return [];
  return items.filter(function(it){
    if(it.due!==iso) return false;
    if(it.kind==='ws'||it.src==='auto:ws'||it.id.indexOf('a:ws:')===0) return false;
    return true;
  });
}
function p38BookName(it){ return (it.book||String(it.title||'').replace(/^(📄|📗|📺|✏️|🖨️)\s*/,'')).trim()||'숙제'; }
function p38Pages(it){
  if(!(it.from>0)) return '';
  var to=(it.to>0&&it.to!==it.from)?('~'+it.to):'';
  return 'p.'+it.from+to;
}

/* ── 홈 카드 안 두 줄(📄 학습지 · 📗 이번 숙제) — 제목·숫자만 ── */
function p38Lines(iso){
  var ws=p38WsFor(iso), bk=p38BooksFor(iso);
  if(!ws.length&&!bk.length) return '';
  var h='<div class="p38ws" onclick="event.stopPropagation()">';
  ws.forEach(function(w){
    var g=p38WsGraded(w);
    h+='<div class="r" data-sw="'+esc(w.swId)+'"><span class="ic">📄</span><b title="'+esc(w.title)+'">'+esc(w.title)+'</b>'
      +'<span class="pl b">'+w.n+'문항</span>'
      +(g?'<span class="pl g">'+w.o+'문항 맞음</span>':'<span class="pl">'+p38DueTxt(iso)+'</span>')+'</div>';
  });
  bk.forEach(function(it){
    var pg=p38Pages(it);
    h+='<div class="r" data-id="'+esc(it.id)+'"><span class="ic">'+(it.print?'🖨️':'📗')+'</span><b title="'+esc(p38BookName(it))+'">'+esc(p38BookName(it))+'</b>'
      +(pg?'<span class="pl b">'+pg+'</span>':'')
      +(it.n>0?'<span class="pl">'+it.n+'문항</span>':'')+'</div>';
  });
  return h+'</div>';
}

/* ── ① 「선생님 확인 전」 카드 (홈) ── */
function p38PendingCard(iso){
  var today=p35Today(), isToday=(iso===today);
  var when=(isToday?'오늘 · ':'')+p35Md(iso)+' 수업';
  var dayWord=isToday?'오늘':(P35_DOW[p35Dow(iso)]+'요일');
  var h='<div class="p35card p38pendcard" onclick="goTab(\'hw\')">';
  h+='<div class="p38pend"><div class="t">루멘수학 · 숙제 · '+esc(when)+'</div><div class="b">선생님 확인 전</div><div class="d">'+dayWord+' 수업 시간에 선생님이 직접 확인하면 바로 바뀌어요</div></div>';
  h+='<div class="p35bd">';
  h+='<div class="p37stg mini p38dim">';
  P37_ST.forEach(function(s){
    h+='<div class="c" data-s="'+s.k+'" style="background:'+s.bg+';border-color:'+s.bd+'"><div class="n">'+s.n+' '+s.nm+'</div><div class="m" style="color:#cbd5e1">·</div><div class="p" style="color:#94a3b8">확인 전</div></div>';
  });
  h+='</div>';
  h+=p38Lines(iso);
  var last=p38LastChecked(iso);
  if(last){
    var v=hwOf(last), ap=hwAhaPct(last);
    var marks=p37Mark(v.p)+' '+p37Mark(v.c)+' '+p37Mark(v.w)+(ap===null?'':' '+p37Mark(ap));
    h+='<div class="p38last" data-iso="'+last+'">지난 수업 <b>'+p35Md(last)+'</b> 확인: <b class="mk">'+marks+'</b> <span>— 숙제 탭에서 지난 기록을 볼 수 있어요</span></div>';
  } else {
    h+='<div class="p38last">아직 선생님 확인 기록이 없어요 <span>— 수업에서 확인하면 이곳에 바로 보입니다</span></div>';
  }
  h+='</div></div>';
  return h;
}

/* ── ② 숙제 탭 7일 표 「📄 학습지」 줄 — 열마다 그 수업일까지 마감인 학습지 맞은 수(「9/12」) · 다 맞으면 ✓ · 채점 전 ○ · 없으면 — ── */
function p38WsRow(isos){
  if(!P.wsq||!P.wsq.length) return '';
  var h='<tr class="p38wsrow" data-s="ws"><td class="l">📄학습지</td>';
  isos.forEach(function(iso,i){
    var ws=p38WsFor(iso, i>0?isos[i-1]:null), S=p38WsSum(ws);
    if(!S.k){ h+='<td class="na">—</td>'; return; }
    if(!S.graded){ h+='<td class="no" title="채점 전">○</td>'; return; }
    if(S.o>=S.n&&S.n>0){ h+='<td class="ok">✓</td>'; return; }
    h+='<td class="a '+(S.o>0?'half':'no')+'">'+S.o+'/'+S.n+'</td>';
  });
  return h+'</tr>';
}
