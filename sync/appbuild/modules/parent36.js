
/* ══ v1-36: 🎙 녹음 숙제 — 그날 주제 · 선생님 확인 · 한마디 (원장 결정 2026-10-23 · 안 A · 계약서 docs/rec_review_contract.md §4)
 *   소리·전문은 지금처럼 어디에도 내보내지 않는다(v1-9 결정 유지). 새로 읽는 서버 칸은 둘뿐:
 *     rec_topics(그날 주제) → P.rtop · rec_review_<코드>(원장이 학원앱 훑어보기에서 ✓ 확인 + 한마디) → P.rrev
 *   다른 학생 전문이 든 rec_read_<날짜> 는 읽지 않는다 — 확인할 때 원장 쪽이 sec·topic 을 rec_review 에 복사해 둔다.
 *   ① 홈 📌 매일 확인 녹음 칸: 오늘 확인됐으면 « · ✓ 선생님 확인» + 아래 «💬 그날 주제»
 *   ② 숙제 탭 🎙️ 하브루타 녹음: 노란 오늘 주제 → 상태(확인/확인 전/미제출) → 파란 선생님 한마디 → 2주 띠 → 비공개 안내
 *   ③ 녹음 제출 기록: 통계(30일 제출 · 연속 · 선생님 확인) + 최근 제출(주제·확인·길이·한마디) + 5주 달력
 *   이 파일의 function 선언은 앞의 같은 이름(p35Box·vRec)을 덮어쓴다. */
function p36Dot(iso){ return String(iso||'').replace(/-/g,'.'); }
function p36Pad(n){ return (n<10?'0':'')+n; }
/* 학년 키 — '중학교 2학년' → '중2' (새벽 스크립트 gradeKey 와 같은 규칙) */
function p36Gk(){
  var s=String((P.st&&P.st.grade)||''), m=s.match(/(\d)\s*학년/);
  if(!m) return '';
  return (/초등/.test(s)?'초':(/고등/.test(s)?'고':'중'))+m[1];
}
/* 원장 확인 칸 — 확인 취소면 칸이 지워지므로 있으면 확인된 것(ok:false 만 빼고) */
function p36Rev(iso){
  var r=P.rrev; if(r&&typeof r==='string'){ try{ r=JSON.parse(r); }catch(e){ r=null; } }
  var b=(r&&r.byDate)||null; var x=b&&b[iso];
  return (x&&typeof x==='object'&&x.ok!==false)?x:null;
}
/* rec_topics 의 날짜 지도에서 그날 또는 7일 안 가장 가까운 지난 날짜 (학생앱 rtBestTopic 과 같은 규칙, 기준만 그날) */
function p36Best(map,iso){
  if(!map||typeof map!=='object') return null;
  for(var i=0;i<7;i++){ var k=p36Dot(p35Add(iso,-i)); if(map[k]&&map[k].t) return map[k]; }
  return null;
}
/* 그날 주제 — 확인된 날은 원장이 확인할 때 복사해 둔 주제 · 아니면 미션 → 개인 → 학년. 없으면 '' */
function p36Topic(iso){
  var rv=p36Rev(iso);
  if(rv&&rv.topic&&typeof rv.topic==='object'){
    if(rv.topic.src==='free') return '';
    if(rv.topic.t) return String(rv.topic.t);
  }
  var st=P.st||{};
  var mi=String(st.lumen_rec_mission||'').trim(); if(mi) return mi;
  var rt=P.rtop; if(rt&&typeof rt==='string'){ try{ rt=JSON.parse(rt); }catch(e){ rt=null; } }
  if(!rt||typeof rt!=='object') return '';
  var p=p36Best((rt.byStudent||{})[st.lumen_rec_code||P.code],iso); if(p) return String(p.t);
  var gk=p36Gk(); var g=gk?p36Best((rt.byGrade||{})[gk],iso):null; if(g) return String(g.t);
  return '';
}
/* 222 → '3분 42초' */
function p36Sec(sec){
  var n=Math.round(Number(sec)); if(!(n>0)) return '';
  var m=Math.floor(n/60), s=n%60;
  return m?(m+'분 '+p36Pad(s)+'초'):(s+'초');
}
/* 확인 시각(ISO) → '10/22 아침' (한국 시각) */
function p36When(at){
  var t=Date.parse(at||''); if(isNaN(t)) return '';
  var k=new Date(t+9*3600000), h=k.getUTCHours();
  return (k.getUTCMonth()+1)+'/'+k.getUTCDate()+' '+(h<12?'아침':(h<18?'오후':'저녁'));
}
/* 보여 줄 한마디 — 오늘 것, 없으면 최근 14일 안 가장 최근 것 */
function p36Say(){
  var today=p35Today();
  for(var i=0;i<14;i++){
    var iso=p35Add(today,-i), rv=p36Rev(iso);
    if(rv&&String(rv.msg||'').trim()) return { iso:iso, msg:String(rv.msg).trim(), at:rv.at||'' };
  }
  return null;
}
/* 녹음 낸 날 목록 — 한국 날짜, 최근 것부터 */
function p36RecKeys(){ return Object.keys(p35RecDays()).sort().reverse(); }

/* ① 홈 매일 확인 칸 — v1-35 원본 그대로 + 녹음 칸에 «✓ 선생님 확인» · «💬 그날 주제» */
function p35Box(kind){
  var o=p35Daily(kind), rec=(kind==='rec');
  var cls='p35box '+o.level;
  var dots=o.dots.map(function(d){ var c=!d.cls?'nc':(d.ok?'ok':(d.today?'td':'no')); return '<i class="'+c+(d.today?' now':'')+'"></i>'; }).join('');
  var sub=o.sub, rv=rec?p36Rev(p35Today()):null, tp=rec?p36Topic(p35Today()):'';   /* v1-36 */
  if(rv) sub=sub.replace(' 연속 제출',' 연속')+' · ✓ 선생님 확인';                    /* v1-36 */
  return '<button class="'+cls+'" onclick="goTab(\''+(rec?'rec':'planner')+'\')">'
    +'<div class="ttl"><span>'+(rec?'🎙️':'📓')+'</span>'+(rec?'녹음 숙제':'플래너 사진')+'</div>'
    +'<div class="big">'+esc(o.big)+'</div>'
    +'<div class="dots">'+dots+'</div>'
    +'<div class="sub'+(rv?' p36w':'')+'">'+esc(sub)+'</div>'
    +(tp?'<div class="p36tp">💬 '+esc(tp)+'</div>':'')
    +'</button>';
}

/* ② 숙제 탭 🎙️ 하브루타 녹음 칸 (vHw 의 «// 녹음» 블록을 떼어 낸 것) */
function p36HwRec(rc){
  var today=p35Today(), days=p35RecDays();
  var done=!!rc||!!days[today];
  var rv=p36Rev(today), tp=p36Topic(today);
  var h='<div class="sec"><div class="st">🎙️ 하브루타 녹음 <button class="more" onclick="goTab(\'rec\')">제출 기록 ›</button></div>';
  if(tp) h+='<div class="p36topic"><small>'+p35Md(today)+' 오늘 주제</small>'+esc(tp)+'</div>';
  if(!done){
    h+='<div class="p36st no"><span class="i">⏰</span><div><div class="t">오늘 녹음이 아직 제출 전이에요</div><div class="s">아이에게 응원 한마디 어떠세요?</div></div></div>';
  } else if(rv){
    var len=p36Sec(rv.sec);
    h+='<div class="p36st ok"><span class="i">✅</span><div><div class="t">제출 완료 · ✓ 선생님이 들었어요</div><div class="s">'+(len?esc(len)+' · ':'')+'오늘도 스스로 설명해 봤어요</div></div></div>';
  } else {
    h+='<div class="p36st wait"><span class="i">✅</span><div><div class="t">제출 완료 · 선생님 확인 전</div><div class="s">선생님이 들으면 한마디가 여기 와요</div></div></div>';
  }
  var say=p36Say();
  if(say){
    var w=p36When(say.at);
    h+='<div class="p36say">💬 '+esc(say.msg)+'<small>— 선생님 한마디'+(w?' · '+esc(w):'')+(say.iso!==today?' ('+esc(p35D(say.iso))+' 녹음)':'')+'</small></div>';
  }
  // 최근 2주 제출 현황 (v1-9 띠 그대로 — 날짜는 한국 날짜)
  var strip='';
  for(var ri=13;ri>=0;ri--){
    var ks=p35Add(today,-ri), on=!!days[ks]||(ri===0&&done), isTd=(ri===0);
    strip+='<div style="flex:1;text-align:center">'
      +'<div style="font-size:7.5px;color:#94a3b8;font-weight:800;margin-bottom:3px">'+(+ks.slice(8,10))+'</div>'
      +'<div style="height:22px;border-radius:6px;background:'+(on?'#059669':'#eef2f7')+';color:#fff;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;'+(isTd?'box-shadow:0 0 0 2px #ffd54a':'')+'">'+(on?'✓':'')+'</div></div>';
  }
  h+='<div style="font-size:10.5px;font-weight:800;color:#0d2240;margin-top:11px">최근 2주 제출 현황</div>'
    +'<div style="display:flex;gap:3px;margin-top:5px">'+strip+'</div>'
    +'<div class="subnote">🔒 녹음 소리는 선생님만 듣습니다 — 아이가 편하게 말할 수 있도록 비공개로 운영하고, 주제와 선생님 한마디만 보여 드려요</div>';
  h+='</div>';
  return h;
}

/* ③ 녹음 제출 기록 — 날짜만 있던 목록에 주제 · 선생님 확인 · 길이 · 한마디 */
function vRec(){
  // v1-9: 녹음 재생은 제공하지 않음 (학생 프라이버시) — v1-36: 주제와 선생님 한마디만 보여 준다
  var h='<div class="pagehd"><button class="bk" onclick="goTab(\'hw\')">←</button>🎙️ 하브루타 녹음 <small>제출 기록</small></div>';
  h+='<div class="p36lock">🔒 <b>녹음 소리는 공개하지 않습니다</b><br>'
    +'하브루타는 아이가 <b>틀려도 편하게</b> 소리 내어 설명해 보는 연습입니다. 선생님이 듣고 남긴 한마디와 그날 주제만 보여 드려요.</div>';
  var keys=p36RecKeys();
  if(!keys.length){ h+='<div class="empty">아직 제출된 녹음이 없어요</div>'; return h; }
  var today=p35Today(), from30=p35Add(today,-30);
  var cnt30=0, ok30=0;
  keys.forEach(function(k){ if(k>=from30&&k<=today) cnt30++; });
  var rr=P.rrev; if(rr&&typeof rr==='string'){ try{ rr=JSON.parse(rr); }catch(e){ rr=null; } }
  Object.keys((rr&&rr.byDate)||{}).forEach(function(k){ if(k>=from30&&k<=today&&p36Rev(k)) ok30++; });
  var streak=0; try{ streak=p35Daily('rec').run||0; }catch(e){}
  function stat(k,v,u,col){ return '<div><div class="k">'+k+'</div><div class="v" style="color:'+col+'">'+v+'<span>'+u+'</span></div></div>'; }
  h+='<div class="p36stats">'
    +stat('최근 30일 제출',cnt30,'회','#0d2240')
    +stat('연속 제출',(streak>0?'🔥'+streak:'-'),(streak>0?'회':''),(streak>0?'#ea580c':'#94a3b8'))
    +stat('선생님 확인',ok30,'회',(ok30?'#059669':'#94a3b8'))
    +'</div>';
  // 최근 제출 — 날짜 · 확인 · 주제 · 길이 · 한마디
  h+='<div class="sec" style="margin-top:0"><div class="st">최근 제출</div>';
  keys.slice(0,10).forEach(function(k){
    var rv=p36Rev(k), tp=p36Topic(k), len=rv?p36Sec(rv.sec):'';
    var ttl=String((rv&&rv.title)||'').trim();
    var line=tp?tp:('자유 제출'+(ttl?' · 「'+ttl+'」':''));
    h+='<div class="p36item"><div class="r1">✅ '+esc(p36Dot(k))+' ('+P35_DOW[p35Dow(k)]+')'
      +(rv?'<span class="chk">✓ 선생님 확인</span>':'<span class="chk w">확인 전</span>')+'</div>'
      +'<div class="r2">'+esc(line)+(len?' · '+esc(len):'')+'</div>'
      +(rv&&String(rv.msg||'').trim()?'<div class="r3">💬 '+esc(String(rv.msg).trim())+'</div>':'')
      +'</div>';
  });
  h+='</div>';
  // 최근 5주 달력 (v1-9 그대로 — 날짜는 한국 날짜)
  var days=p35RecDays();
  h+='<div class="sec"><div class="st" style="margin-bottom:8px">최근 5주 제출 달력</div>'
    +'<div style="display:flex;gap:3px;margin-bottom:4px">';
  ['월','화','수','목','금','토','일'].forEach(function(w){ h+='<div style="flex:1;text-align:center;font-size:8.5px;color:#94a3b8;font-weight:800">'+w+'</div>'; });
  h+='</div>';
  var dow=(p35Dow(today)+6)%7, sun=p35Add(today,6-dow);   // 이번 주 일요일
  for(var w2=0;w2<5;w2++){
    h+='<div style="display:flex;gap:3px;margin-bottom:3px">';
    for(var c2=0;c2<7;c2++){
      var ks3=p35Add(sun,-(34-(w2*7+c2)));
      var future=ks3>today, on3=!!days[ks3], isTd3=(ks3===today);
      h+='<div style="flex:1;aspect-ratio:1/1;border-radius:7px;display:flex;flex-direction:column;align-items:center;justify-content:center;'
        +'background:'+(future?'#fbfcfe':(on3?'#059669':'#f1f5f9'))+';'
        +(isTd3?'box-shadow:0 0 0 2px #ffd54a;':'')+'">'
        +'<div style="font-size:8px;font-weight:800;color:'+(on3?'rgba(255,255,255,0.8)':'#cbd5e1')+'">'+(+ks3.slice(8,10))+'</div>'
        +(on3?'<div style="font-size:11px;color:#fff;font-weight:900;line-height:1">✓</div>':'')
        +'</div>';
    }
    h+='</div>';
  }
  h+='<div style="display:flex;gap:12px;margin-top:8px;font-size:9.5px;color:#94a3b8;font-weight:700">'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#059669;vertical-align:-1px;margin-right:3px"></span>제출</span>'
    +'<span><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f1f5f9;vertical-align:-1px;margin-right:3px"></span>미제출</span></div>';
  h+='</div>';
  return h;
}
