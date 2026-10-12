/* ═══════════════════════════════════════════════════════════════════
 * v19-112: 🏫 학원 달력에 «학교 일정» (학교알리미·나이스 학사일정)
 * 원장 요청 2026-10-12: 「학교알리미에서 학교 일정을 읽고 학원 달력에 넣자.」
 *  [서버] sync/school_info.js(매일 03:30 school-info.yml)가 school_calendar.schools[].events 에
 *         시험 말고 학교 일정도 담는다 — { from, to, days, name, kind:'vac'|'trip'|'mock'|'ceremony'|'event', off, grades }
 *         (토요휴업일·공휴일은 뺀다 — 공휴일은 달력에 이미 있다)
 *  [화면] 학원 달력 칸마다 우리 학생이 있는 학교의 일정을 연한 색 띠로 («옥길중 체육한마당», 학년 행사는 «2학년»).
 *         학교 칩으로 거르면 그 학교 것만 · 「학원 일정만」이면 숨김 · 누르면 그 날 상세(학교 일정은 고치지 않는다 — 원본은 나이스)
 *         학교 휴업·방학은 학원 휴원이 아니므로 날짜를 빨갛게 하지 않는다.
 *  ※ 문자열 연결만. 바탕 함수(ctEventsOn · ctTargetText · rCal)는 감싸기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
CT_KIND.sch = ['학교 일정', '#f1f5f9', '#475569'];
var SE_ICON = { vac:'🏖', trip:'🚌', mock:'📝', ceremony:'🎓', event:'🏫' };
function seList(day){
  if(!CT.sc || !CT.sc.schools || CT.filter==='_ev') return [];
  var mine=ctMySchools(), out=[];
  CT.sc.schools.forEach(function(s){
    var sh=ctShort(s.name); if(!mine[sh]) return; if(CT.filter && CT.filter!==sh) return;
    (s.events||[]).forEach(function(e, i){
      if(!e || !e.from || day<e.from || day>(e.to||e.from)) return;
      var g=(e.grades&&e.grades.length)?(' ('+e.grades.join('·')+'학년)'):'';
      out.push({ id:'', kind:'sch', school:sh, title:(SE_ICON[e.kind]||'🏫')+' '+sh+' '+e.name+g, from:e.from, to:e.to||e.from, pub:true, target:{ schools:[sh], grades:[], groups:[] }, _sch:true });
    });
  });
  return out;
}
ctEventsOn = (function(o){ return function(day){ return o(day).concat(seList(day)); }; })(ctEventsOn);
/* 학교 일정 띠는 «고치기»가 없다 — ctEdit('') 는 아무것도 하지 않는다(찾는 일정이 없음). 범례 한 줄 추가 */
rCal = (function(o){ return function(){
  var h=o(); var mk='행사·주간테스트 · 점선 = 학생앱 비공개</span>';
  var have=CT.sc&&(CT.sc.schools||[]).some(function(s){ return (s.events||[]).length; });
  return have ? h.split(mk).join(mk+'<span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#f1f5f9;border:1px solid #cbd5e1;vertical-align:-1px;margin-right:3px"></i>학교 일정(학교알리미 · 매일 새벽) 🏖방학·휴업 🚌체험·여행 📝모의 🎓식 🏫행사</span>') : h;
}; })(rCal);
