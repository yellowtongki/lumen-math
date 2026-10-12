/* ═══════════════════════════════════════════════════════════════════
 * v19-113: 🏆 플래너 랭킹 화면 합계 = 매일 + 📅 계획 + 📔 순공 · 학생앱 주간 점수 전원 새로 쓰기
 *   원장 결정 2026-10-12 「1,2,3 다 고쳐줘」 (플래너 점수 점검에서 나온 세 가지)
 *   ① 플래너 › 🏆 랭킹 화면(rPlannerRanking)만 «매일 점수»만 더하고 있었다. 입력 표 합계(plrGridTotal)·학생앱 랭킹·
 *      📔 플래너 리그(calcPlannerRankingForMonth)는 매일 + 주간(계획·순공)이라 10월 1·2위가 뒤바뀌어 보였다.
 *      → 이번달: plwMonthWeeks + plwScore + plrSplit (입력 표와 같은 함수) · 주간/기간 지정: 그 기간 안에 «일요일»이 든 발표된 주.
 *        줄마다 「매일 n · 계획 n · 순공 n」. 주간 점수 자료(PWB)가 아직 없으면 불러온 뒤 다시 그린다.
 *        10월 전 기간은 예전 화면 그대로(주간 점수가 없던 때). 월간·레이스 화면은 «매일 점수만»이라고 적는다.
 *   ③ student_planner_<코드>.weekly(학생앱 홈 「주간」 점수)는 그 학생 플래너를 승인할 때만 새로 써서,
 *      plwRepublish()(코드 없이 — 랭킹만 새로 씀) 뒤에 홈 8 · 랭킹 9 처럼 어긋났다.
 *      → plwRepublish() 를 감싸 코드 없이 부르면 학생 전원의 weekly 도 새로 쓴다(서버에서 한 번 읽고, 바뀐 학생만 40명씩 묶어 올림).
 *      → 자동: 플래너 화면을 열 때 «지난 주 발표(일요일 24시) · 지각 마감(월요일 24시)» 뒤 아직 안 했으면 한 번 돌린다(이 기기 localStorage 표시 · 서버로 안 감).
 *   ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 원래 함수는 고치지 않고 감싸거나(window.xxx = …) 같은 이름으로 다시 정의한다.
 * ═══════════════════════════════════════════════════════════════════ */
var RK113 = { wait: 0, all: null, again: false, lastAll: null, autoBusy: 0 };
/* 기간 [sIso, eIso] 안에 일요일이 든 주 중 발표된 주(일요일 24시 지남) — 월요일 날짜 목록 */
window.rkWeeksIn = function(sIso, eIso){
  var out = [], W = PW.W0;
  if (!sIso || !eIso) return out;
  for (var i = 0; i < 200; i++){ var sun = PW.add(W, 6); if (sun > eIso) break; if (sun >= sIso && Date.now() >= PW.dueMs(W)) out.push(W); W = PW.add(W, 7); }
  return out;
};
/* 한 학생의 주간 점수 나눔 — 입력 표 합계(plrGridTotal)와 같은 계산(plwScore → plrSplit) */
window.rkWeekSplit = function(st, weeks){
  var a = 0, b = 0;
  try { if (PWB.loaded && st && st.lumen_rec_code) (weeks || []).forEach(function(W){ var sp = plrSplit(plwScore(st, W)); a += sp.plan; b += sp.sg; }); } catch(e){}
  return { plan: a, sg: b };
};
/* 주간 점수 자료를 불러온 뒤 플래너 화면을 다시 그린다 (한 번만 · 최대 약 20초) */
function rk113Wait(){
  if (RK113.wait) return; RK113.wait = 1; var n = 0;
  (function tick(){
    if (PWB.loaded || ++n > 66){ RK113.wait = 0; if (PWB.loaded && VIEW === 'planner') render(); return; }
    if (!PWB.loading){ try { plwLoad(); } catch(e){} }
    setTimeout(tick, 300);
  })();
}
function rk113Split(r){
  return '<div style="font-size:9.5px;font-weight:700;color:#94a3b8;white-space:nowrap">매일 ' + r.daily + ' · <span style="color:#1d4ed8">계획 ' + r.plan + '</span> · <span style="color:#7c3aed">순공 ' + r.sg + '</span></div>';
}
function rk113Note(weeks){
  var wl = (weeks || []).map(function(W){ return PW.md(W) + '~' + PW.md(PW.add(W, 6)); });
  return '<div class="rk113-note" style="margin-top:10px;font-size:11px;font-weight:700;color:#475569;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:7px 10px;line-height:1.55">'
    + '📒 합계 = 매일 + <span style="color:#1d4ed8">📅 계획</span> + <span style="color:#7c3aed">📔 순공</span> — 입력 표 합계 · 학생앱 랭킹과 같은 점수<br>'
    + '<span style="color:#64748b;font-weight:600">' + (wl.length ? ('주간 점수 넣은 주: ' + wl.join(' · ')) : '이 기간엔 발표된 주간 점수가 아직 없어요') + ' · 주간 점수는 일요일 밤 12시 발표 · 그 주 일요일이 든 기간에 더해요</span></div>';
}
var _rk113Base = window.rPlannerRanking;   /* 원래 랭킹 화면 — 10월 전 기간에 그대로 쓴다 */
window.rPlannerRanking=function(){
  var now=new Date();
  if(!PLANNER_MONTH) PLANNER_MONTH=now.getFullYear()+'.'+(String(now.getMonth()+1).padStart(2,'0'));
  if(typeof window.PLANNER_RANK_MODE==='undefined') window.PLANNER_RANK_MODE='month';
  if(typeof window.PLANNER_WEEK_OFFSET==='undefined') window.PLANNER_WEEK_OFFSET=0;
  if(!window.PLANNER_RANGE) window.PLANNER_RANGE=plRangeDefault();

  var ym=PLANNER_MONTH;
  var yr=parseInt(ym.split('.')[0]);
  var mo=parseInt(ym.split('.')[1]);
  var daysInMonth=new Date(yr,mo,0).getDate();
  var prevMo=mo===1?(yr-1)+'.12':(yr+'.'+String(mo-1).padStart(2,'0'));
  var nextMo=mo===12?(yr+1)+'.01':(yr+'.'+String(mo+1).padStart(2,'0'));

  // 날짜 범위 결정
  var targetDates=[];
  var rangeLabel='';
  var weekRange=getWeekRange(window.PLANNER_WEEK_OFFSET);

  if(window.PLANNER_RANK_MODE==='custom'){
    // v18-13: 원장님이 직접 넣은 기간
    var CR=window.PLANNER_RANGE;
    targetDates=plRangeDates(CR.s,CR.e);
    rangeLabel=CR.s.replace(/-/g,'.')+' ~ '+CR.e.replace(/-/g,'.')+' ('+targetDates.length+'일)';
  } else if(window.PLANNER_RANK_MODE==='week'){
    // 주간: 월 경계를 넘으면 해당 월 1일부터 시작
    var ws=new Date(weekRange.start.replace(/\./g,'-'));
    var we=new Date(weekRange.end.replace(/\./g,'-'));
    // 시작일과 종료일의 월이 다르면 → 종료일 기준 월의 1일로 시작일 조정
    if(ws.getMonth()!==we.getMonth()||ws.getFullYear()!==we.getFullYear()){
      ws=new Date(we.getFullYear(),we.getMonth(),1);
    }
    var adjStart=ws.getFullYear()+'.'
      +String(ws.getMonth()+1).padStart(2,'0')+'.'
      +String(ws.getDate()).padStart(2,'0');
    for(var dt=new Date(ws);dt<=we;dt.setDate(dt.getDate()+1)){
      targetDates.push(dt.getFullYear()+'.'
        +String(dt.getMonth()+1).padStart(2,'0')+'.'
        +String(dt.getDate()).padStart(2,'0'));
    }
    var offLabel=window.PLANNER_WEEK_OFFSET===0?'이번주':
      window.PLANNER_WEEK_OFFSET===-1?'지난주':
      Math.abs(window.PLANNER_WEEK_OFFSET)+'주 전';
    rangeLabel=offLabel+' ('+adjStart.slice(5)+' ~ '+weekRange.end.slice(5)+')';
  } else {
    // 월별: 항상 해당 월 1일~말일
    for(var d2=1;d2<=daysInMonth;d2++) targetDates.push(ym+'.'+String(d2).padStart(2,'0'));
    rangeLabel=yr+'년 '+mo+'월 ('+mo+'.01 ~ '+mo+'.'+String(daysInMonth).padStart(2,'0')+')';
  }

  /* ★ v19-113: 기간의 첫날·끝날 → 그 안에 «일요일»이 든 발표된 주의 주간 점수(📅 계획 · 📔 순공)를 더한다 */
  var rkS=targetDates.length?targetDates[0].replace(/\./g,'-'):'', rkE=targetDates.length?targetDates[targetDates.length-1].replace(/\./g,'-'):'';
  if(!rkE||rkE<PW.START) return _rk113Base();   /* 10월 전 기간 = 주간 점수가 없던 때 — 예전 화면 그대로 */
  if(!PWB.loaded){ rk113Wait(); return '<div style="padding:40px;text-align:center;color:#94a3b8;font-weight:700">⏳ 주간 점수(📅 계획 · 📔 순공) 불러오는 중… 랭킹 합계에 더해요</div>'; }
  var rkWeeks=(window.PLANNER_RANK_MODE==='month')?plwMonthWeeks(ym.replace('.','-')):rkWeeksIn(rkS,rkE);   /* 이번달 = 입력 표·학생앱 랭킹과 같은 함수 */

  // 랭킹 계산 — ★ v19-113: 합계 = 매일 + 계획 + 순공 (입력 표 합계 plrGridTotal · 발행 랭킹 calcPlannerRankingForMonth 와 같은 계산)
  var ranking=students.filter(function(s){return !s.withdrawn;}).map(function(st){
    var pl=st.lumen_planner||{};
    var daily=0; var days=0;
    targetDates.forEach(function(ds){
      var sc=pl[ds];
      if(sc!==undefined&&sc!==null){daily+=sc;days++;}
    });
    var wk=rkWeekSplit(st, rkWeeks);
    return {st:st,total:daily+wk.plan+wk.sg,daily:daily,plan:wk.plan,sg:wk.sg,days:days,avg:days>0?Math.round(daily/days*10)/10:0};
  }).sort(function(a,b){return b.total-a.total;});
  var maxTotal=ranking.length&&ranking[0].total>0?ranking[0].total:1;

  var h='<div style="padding:14px;display:flex;flex-direction:column;gap:12px">';

  // ── 헤더 카드 ──
  h+='<div style="background:white;border:1.5px solid #e8edf5;border-radius:16px;padding:14px">';

  // 이전/다음 + 제목
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
  if(window.PLANNER_RANK_MODE==='month'){
    h+='<button onclick="PLANNER_MONTH=\''+prevMo+'\';render()" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">‹</button>';
    h+='<div style="font-size:15px;font-weight:900;color:#0d2240">🏆 '+rangeLabel+'</div>';
    h+='<button onclick="PLANNER_MONTH=\''+nextMo+'\';render()" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">›</button>';
  } else if(window.PLANNER_RANK_MODE==='custom'){
    // v18-13: ‹ › 는 같은 길이만큼 기간을 통째로 이동 (직전 30일 ↔ 그 앞 30일 비교용)
    h+='<button onclick="plRangeShift(-1)" title="같은 길이만큼 앞 기간" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">‹</button>';
    h+='<div style="text-align:center"><div style="font-size:14px;font-weight:900;color:#0d2240">🏆 '+rangeLabel+'</div></div>';
    h+='<button onclick="plRangeShift(1)" title="같은 길이만큼 뒤 기간" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">›</button>';
  } else {
    h+='<button onclick="window.PLANNER_WEEK_OFFSET--;render()" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">‹</button>';
    h+='<div style="text-align:center"><div style="font-size:13px;font-weight:900;color:#0d2240">🏆 '+rangeLabel+'</div></div>';
    h+='<button onclick="window.PLANNER_WEEK_OFFSET++;render()" style="width:34px;height:34px;border:1.5px solid #e2e8f0;background:white;border-radius:8px;font-size:16px;cursor:pointer">›</button>';
  }
  h+='</div>';

  // 이번달/주간/기간 지정 토글
  h+='<div style="display:flex;background:#f1f5f9;border-radius:10px;padding:3px;gap:3px">'
    +'<button onclick="window.PLANNER_RANK_MODE=\'month\';render()" style="flex:1;padding:7px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;'+(window.PLANNER_RANK_MODE==='month'?'background:white;color:#1d6fe8;box-shadow:0 1px 4px rgba(0,0,0,0.1)':'background:transparent;color:#94a3b8')+'">이번달</button>'
    +'<button onclick="window.PLANNER_RANK_MODE=\'week\';window.PLANNER_WEEK_OFFSET=0;render()" style="flex:1;padding:7px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;'+(window.PLANNER_RANK_MODE==='week'?'background:white;color:#1d6fe8;box-shadow:0 1px 4px rgba(0,0,0,0.1)':'background:transparent;color:#94a3b8')+'">주간</button>'
    +'<button onclick="window.PLANNER_RANK_MODE=\'custom\';render()" style="flex:1;padding:7px;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;'+(window.PLANNER_RANK_MODE==='custom'?'background:white;color:#7c3aed;box-shadow:0 1px 4px rgba(0,0,0,0.1)':'background:transparent;color:#94a3b8')+'">📅 기간 지정</button>'
    +'</div>';

  // v18-13: 기간 직접 입력 패널
  if(window.PLANNER_RANK_MODE==='custom'){
    var CR2=window.PLANNER_RANGE;
    var _din='border:1.5px solid #ddd6fe;background:#faf8ff;border-radius:9px;font-family:inherit;font-size:13px;font-weight:800;color:#0d2240;padding:8px 10px;cursor:pointer';
    h+='<div style="margin-top:10px;background:#f8f5ff;border:1.5px solid #e9d5ff;border-radius:12px;padding:11px 12px">';
    h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">';
    h+='<span style="font-size:12px;font-weight:900;color:#6d28d9">📅 기간</span>';
    h+='<input type="date" value="'+CR2.s+'" onchange="plRangeSet(\'s\',this.value)" style="'+_din+'">';
    h+='<span style="font-size:13px;font-weight:900;color:#94a3b8">~</span>';
    h+='<input type="date" value="'+CR2.e+'" onchange="plRangeSet(\'e\',this.value)" style="'+_din+'">';
    h+='<span style="font-size:11.5px;font-weight:800;color:#7c3aed;background:#ede9fe;border-radius:50px;padding:4px 11px">'+targetDates.length+'일</span>';
    h+='</div>';
    h+='<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:8px">';
    [['최근 7일','plRangeQuick(7)'],['최근 14일','plRangeQuick(14)'],['최근 30일','plRangeQuick(30)'],
     ['최근 3개월','plRangeMonths(3)'],['최근 6개월','plRangeMonths(6)']].forEach(function(q){
      h+='<span onclick="'+q[1]+'" style="cursor:pointer;font-size:11px;font-weight:800;color:#6d28d9;background:#fff;border:1.5px solid #ddd6fe;border-radius:50px;padding:5px 11px;user-select:none">'+q[0]+'</span>';
    });
    h+='</div>';
    if(!targetDates.length) h+='<div style="font-size:11px;font-weight:800;color:#b91c1c;margin-top:7px">시작일이 종료일보다 뒤예요 — 날짜를 확인해 주세요</div>';
    h+='<div style="font-size:10px;color:#94a3b8;font-weight:700;margin-top:7px">방학·시험기간처럼 원하는 구간의 등수를 볼 수 있어요 · ‹ › 로 같은 길이의 앞뒤 기간과 비교</div>';
    h+='</div>';
  }
  h+=rk113Note(rkWeeks);   /* ★ v19-113 */
  h+='</div>';

  // ── 화려한 시상대 (학생 3명 이상이면 항상 표시) ──
  var hasScores=ranking.some(function(r){return r.total>0;});
  if(ranking.length>=3){
    var PODIUM=[
      {rank:2,icon:'🥈',grad:'linear-gradient(135deg,#94a3b8,#cbd5e1)',shadow:'rgba(148,163,184,0.4)',crown:'silver',hPx:80},
      {rank:1,icon:'🥇',grad:'linear-gradient(135deg,#f59e0b,#fbbf24,#f97316)',shadow:'rgba(245,158,11,0.5)',crown:'gold',hPx:110},
      {rank:3,icon:'🥉',grad:'linear-gradient(135deg,#b45309,#d97706)',shadow:'rgba(180,83,9,0.35)',crown:'bronze',hPx:60}
    ];

    h+='<div style="background:linear-gradient(180deg,#0f172a 0%,#1e3a5f 100%);border-radius:20px;padding:20px 16px 0;overflow:hidden;position:relative">';
    // 배경 별빛 효과
    h+='<div style="position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,255,255,0.03) 0%,transparent 60%),radial-gradient(circle at 80% 80%,rgba(255,255,255,0.03) 0%,transparent 60%)"></div>';
    // 제목
    h+='<div style="text-align:center;margin-bottom:16px;position:relative">';
    h+='<div style="font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin-bottom:4px">PLANNER RANKING</div>';
    h+='<div style="font-size:16px;font-weight:900;color:white">'+rangeLabel+'</div>';
    h+='</div>';

    h+='<div style="display:flex;align-items:flex-end;justify-content:center;gap:6px;position:relative">';
    PODIUM.forEach(function(p){
      var r=ranking[p.rank-1];
      if(!r)return;
      var isFirst=p.rank===1;
      var charSz=isFirst?70:56;
      // SVG 캐릭터 생성
      var avatarHtml='';
      if(typeof buildChar==='function'&&r.st){
        var pNoChar=!r.st.lumen_char_job;
        var pJob=JOBS.find(function(j){return j.id===(r.st.lumen_char_job||'soccer');})||JOBS[0];
        var pFem=(r.st.lumen_char_gender||'boy')==='girl';
        avatarHtml=(pNoChar?buildNoChar(80,96):buildChar(pJob,pFem))
          .replace('width="80" height="96"','width="'+charSz+'" height="'+(charSz*1.2)+'"');
      } else {
        avatarHtml='<div style="width:'+charSz+'px;height:'+charSz+'px;border-radius:50%;'
          +'background:'+p.grad+';display:flex;align-items:center;justify-content:center;'
          +'font-size:'+(isFirst?22:18)+'px;font-weight:900;color:white;">'+r.st.name[0]+'</div>';
      }
      h+='<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;max-width:130px">';
      // 왕관 (1위만)
      if(isFirst) h+='<div style="font-size:24px">👑</div>';
      else h+='<div style="height:28px"></div>';
      // SVG 캐릭터 아바타 (그림자 링)
      h+='<div style="border-radius:50%;'
        +'box-shadow:0 0 0 3px '+p.shadow.replace('0.','0.')+',0 6px 20px '+p.shadow+';'
        +'background:rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;'
        +'width:'+(charSz+6)+'px;height:'+(charSz*1.2+6)+'px;'
        +'display:flex;align-items:center;justify-content:center">'
        +avatarHtml+'</div>';
      // 이름 + 점수
      h+='<div style="text-align:center;margin-top:2px">'
        +'<div style="font-size:'+(isFirst?14:12)+'px;font-weight:900;color:white;margin-bottom:2px">'+r.st.name+'</div>'
        +'<div style="font-size:'+(isFirst?20:16)+'px;font-weight:900;background:'+p.grad
        +';-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">'+r.total+'점</div>'
        +'<div style="font-size:9.5px;font-weight:700;color:rgba(255,255,255,0.6);white-space:nowrap">매일 '+r.daily+' · 계획 '+r.plan+' · 순공 '+r.sg+'</div>'   /* ★ v19-113 */
        +'<div style="font-size:10px;color:rgba(255,255,255,0.4)">매일 avg '+r.avg+'</div>'
        +'</div>';
      // 포디엄 블록
      h+='<div style="width:100%;height:'+p.hPx+'px;background:'+p.grad+';border-radius:8px 8px 0 0;'
        +'display:flex;align-items:center;justify-content:center;'
        +'box-shadow:0 -4px 20px '+p.shadow+'">'
        +'<span style="font-size:22px">'+p.icon+'</span>'
        +'</div>';
      h+='</div>';
    });
    h+='</div>';
    h+='</div>';
  }

  // ── 전체 순위 리스트 ──
  h+='<div style="background:white;border:1.5px solid #e8edf5;border-radius:16px;overflow:hidden">';
  ranking.forEach(function(r,idx){
    var rank=idx+1;
    var icon=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank+'위';
    var pct=maxTotal>0?Math.round(r.total/maxTotal*100):0;
    var barGrad=rank===1?'linear-gradient(90deg,#f59e0b,#fbbf24)':rank===2?'linear-gradient(90deg,#94a3b8,#cbd5e1)':rank===3?'linear-gradient(90deg,#b45309,#d97706)':rank<=10?'linear-gradient(90deg,#3b82f6,#60a5fa)':'linear-gradient(90deg,#94a3b8,#cbd5e1)';
    var scoreColor=rank===1?'#f59e0b':rank===2?'#94a3b8':rank===3?'#b45309':rank<=10?'#3b82f6':'#94a3b8';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9;'+(rank<=3?'background:'+(rank===1?'#fffbeb':rank===2?'#f8fafc':'#fef3e2')+';':'background:white;')+'">'
      +'<div style="width:32px;text-align:center;font-size:'+(rank<=3?'17':'12')+'px;font-weight:800;flex-shrink:0">'+icon+'</div>'
      +'<div style="width:52px;font-size:13px;font-weight:700;color:#0d2240;flex-shrink:0">'+r.st.name+'</div>'
      +'<div style="flex:1"><div style="height:10px;background:#f1f5f9;border-radius:99px;overflow:hidden">'
      +'<div style="height:100%;width:'+pct+'%;background:'+barGrad+';border-radius:99px;transition:width 0.5s"></div></div></div>'
      +'<div class="rk113-tot" style="min-width:46px;text-align:right"><div style="font-size:14px;font-weight:900;color:'+scoreColor+'">'+r.total+'점</div>'
      +rk113Split(r)+'</div>'   /* ★ v19-113: 매일 · 계획 · 순공 */
      +'<div style="min-width:36px;text-align:right;font-size:10px;color:#94a3b8" title="매일 점수 평균 (제출한 날 기준)">avg '+r.avg+'</div>'
      // v18-13: 기간 지정일 때는 며칠 제출했는지도 함께 (기간이 길면 제출 일수가 곧 성실도)
      +(window.PLANNER_RANK_MODE==='custom'?'<div style="min-width:52px;text-align:right;font-size:10px;font-weight:800;color:'+(r.days>0?'#7c3aed':'#cbd5e1')+'">'+r.days+'/'+targetDates.length+'일</div>':'')
      +'</div>';
  });
  h+='</div>';

  // 블로그용 안내
  h+='<div style="background:linear-gradient(135deg,#f8fafc,#eff6ff);border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:11px;color:#64748b;text-align:center">'
    +'📸 캡처해서 블로그에 올려보세요!</div>';
  h+='</div>';
  return h;
};

/* ── ①-2 월간·레이스 화면은 «매일 점수만» — 주간까지 더한 합계는 입력 표·랭킹이라고 적는다 (10월부터) ── */
(function(){
  var mo = window.rPlannerMonthly;
  if (typeof mo === 'function') window.rPlannerMonthly = function(){
    var h = mo.apply(this, arguments);
    try {
      if (String(PLANNER_MONTH || '') >= '2026.10'){
        h = h.replace('학생별 주차 누적 점수</div>', '학생별 주차 누적 점수 <span class="rk113-daily" style="font-size:11px;font-weight:700;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:50px;padding:2px 9px;margin-left:6px">매일 점수만 · 주간(📅 계획 · 📔 순공)까지 더한 합계는 📋 입력 표 · 🏆 랭킹</span></div>')
             .replace('>합계</th></tr></thead>', '>매일 합계</th></tr></thead>');
      }
    } catch(e){}
    return h;
  };
  var ra = window.rPlannerRace;
  if (typeof ra === 'function') window.rPlannerRace = function(){
    var h = ra.apply(this, arguments);
    try {
      var late = (window.PLANNER_RANK_MODE === 'week') || String(PLANNER_MONTH || '') >= '2026.10';
      if (late) h = h.replace('PLANNER RACE</div>', 'PLANNER RACE · <span class="rk113-daily">매일 점수만</span></div>');
    } catch(e){}
    return h;
  };
})();

/* ── ③ 학생앱 주간 점수(student_planner_<코드>.weekly)를 학생 전원 새로 쓰기 ──
 *   서버의 student_planner_ 줄을 한 번에 읽고, weekly 만 plwStudentWeeks(학생) 로 바꿔 «바뀐 학생만» 40명씩 묶어 올린다.
 *   다른 칸(scores·flags·teacherComment)과 updated_at 은 서버에 있던 그대로(weeklyAt 에 고친 시각). 줄이 아직 없는 학생(주간 점수가 있는데 승인 이력이 없음)은
 *   원래 발행 함수(publishPlannerDataForStudent)로 한 명씩. 같은 때 여러 번 불리면 하나로 합친다. */
function rk113SameWeeks(a, b){
  a = a || {}; b = b || {}; var ks = {}, k, f = ['t', 'plan', 'prac', 'photo', 'paper'];
  for (k in a) ks[k] = 1; for (k in b) ks[k] = 1;
  for (k in ks){ var x = a[k] || {}, y = b[k] || {}; if (!a[k] || !b[k]) return false; for (var i = 0; i < f.length; i++){ if ((Number(x[f[i]]) || 0) !== (Number(y[f[i]]) || 0)) return false; } }
  return true;
}
window.plwRefreshAllWeekly = async function(){
  if (RK113.all){ RK113.again = true; return RK113.all; }
  RK113.all = (async function(){
    var res = { ok: false, checked: 0, changed: 0, created: 0, err: null };
    try {
      var sb = plSb(); if (!sb) return res;
      if (!PWB.loaded){ try { await plwLoad(); } catch(e){} }
      if (!PWB.loaded) return res;
      /* 불러오기가 실패해도 PWB.loaded 는 true 가 된다(plwLoad 의 catch) — 그때 계산하면 전원 0점이라 학생앱 주간 점수를 0 으로 덮는다.
       * 주간 자료(주간계획·순공·코디 계획)가 하나도 없으면 쓰지 않고 다음에 다시(ok=false → 자동 표시도 안 남김). */
      if (!Object.keys(PWB.wp || {}).length && !Object.keys(PWB.sg || {}).length && !Object.keys(PWB.cp || {}).length){ res.skip = 'no-data'; return res; }
      var list = (typeof students !== 'undefined' ? students : []).filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; });
      if (!list.length) return res;
      var r = await sb.from('lumen_store').select('key,value').like('key', 'student_planner_%');
      if (r && r.error) throw r.error;
      var cur = {};
      ((r && r.data) || []).forEach(function(row){ var v = row.value; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } cur[String(row.key).slice(16)] = v; });
      var now = new Date().toISOString(), rows = [], miss = [];
      list.forEach(function(st){
        var c = st.lumen_rec_code, wk = plwStudentWeeks(st), v = cur[c];
        res.checked++;
        if (!v || typeof v !== 'object'){ if (Object.keys(wk).some(function(W){ return (Number((wk[W] || {}).t) || 0) > 0; })) miss.push(st); return; }
        if (rk113SameWeeks(v.weekly, wk)) return;
        v.weekly = wk; v.weeklyAt = now;
        /* updated_at 은 일부러 안 보낸다 — 그 칸은 «매일 점수를 올린 때»라서, 앱 시작 때 자가치유(republishStalePlannerData)가
         * 매일 점수가 밀린 학생을 찾는 기준이다. weekly 만 바꾸면서 그 날짜를 당기면 자가치유가 그 학생을 못 찾는다. */
        rows.push({ key: 'student_planner_' + c, value: v });
      });
      for (var i = 0; i < rows.length; i += 40){
        var w = await sb.from('lumen_store').upsert(rows.slice(i, i + 40), { onConflict: 'key' });
        if (w && w.error) throw w.error;
        res.changed += Math.min(40, rows.length - i);
      }
      for (var j = 0; j < miss.length; j++){ try { await publishPlannerDataForStudent(miss[j]); res.created++; } catch(e){} }
      res.ok = true;
      if (res.changed + res.created > 0){ try { plToast('🔄 학생앱 주간 점수 ' + (res.changed + res.created) + '명 새로 반영'); } catch(e){} }
    } catch(e){ res.err = String((e && e.message) || e); console.warn('[주간 점수 → 학생앱 전원] 실패', e); }
    return res;
  })();
  var out;
  try { out = await RK113.all; } finally { RK113.all = null; }
  RK113.lastAll = out;
  if (RK113.again){ RK113.again = false; return window.plwRefreshAllWeekly(); }
  return out;
};
(function(){
  var orig = window.plwRepublish; if (typeof orig !== 'function') return;
  window.plwRepublish = async function(code){
    var r = await orig.apply(this, arguments);
    if (!code){ try { await window.plwRefreshAllWeekly(); } catch(e){} }   /* 코드 없이 = 랭킹만 새로 쓰던 길 → 학생 전원 weekly 도 */
    return r;
  };
})();

/* ── ③-2 자동: 플래너 화면을 열 때, 지난 주 발표 뒤(월요일) · 지각 마감 뒤(화요일부터) 이 기기에서 아직 안 했으면 한 번 ── */
/* 이 기기 표시는 원래 localStorage 로만 — 앱의 setItem 은 키를 서버로 동기화하므로(scheduleSync) 거치지 않는다 (layout3 l3Set 과 같은 방식) */
function rk113LsGet(k){ try { return (typeof _origGetItem === 'function' ? _origGetItem(k) : localStorage.getItem(k)); } catch(e){ return null; } }
function rk113LsSet(k, v){ try { if (typeof _origSetItem === 'function') _origSetItem(k, v); else localStorage.setItem(k, v); } catch(e){} }
function rk113Stamp(){
  var last = PW.add(PW.thisMon(), -7);
  if (last < PW.W0 || Date.now() < PW.dueMs(last)) return '';
  return last + (Date.now() >= PW.lateMs(last) ? 'L' : '');
}
function rk113AutoCheck(){
  if (RK113.autoBusy) return;
  var stamp = rk113Stamp(); if (!stamp) return;
  var key = 'lumen_plw_pub_stamp', last = '';
  try { last = rk113LsGet(key) || ''; } catch(e){}
  if (last === stamp) return;
  if (typeof students === 'undefined' || !students.length) return;
  RK113.autoBusy = 1;
  setTimeout(async function(){
    try {
      try { await plwLoad(); } catch(e){}
      if (!PWB.loaded) return;
      await plwRepublish();   /* 랭킹 + (위에서 감싼) 학생 전원 weekly */
      var res = RK113.lastAll;
      if (res && res.ok){ try { rk113LsSet(key, stamp); } catch(e){} }
    } catch(e){ console.warn('[주간 점수 자동 반영]', e); }
    finally { RK113.autoBusy = 0; }
  }, 1500);
}
(function(){
  var rp = window.rPlanner; if (typeof rp !== 'function') return;
  window.rPlanner = function(){ var h = rp.apply(this, arguments); try { rk113AutoCheck(); } catch(e){} return h; };
})();
