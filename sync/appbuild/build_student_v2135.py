# 학생앱 v2-135 조립 — «v2-134 복사 + rep 고침»
#   원장 2026-10-13 「학원앱에서 각 클래스의 시간을 조정하는 기능이 있나? 없으면 만들자.」 · 「학생들이 학원시간을 수정할 수 있게 하자.」
#   ① «루멘수학» 칸(주간계획표 달력 · 스터디 코디)이 반 이름 짐작(T730 → 19:30 · 늘 2시간 · 요일마다 같음) 대신
#      학원앱 v19-119 「⏰ 반 수업 시간」(lumen_store lumen_group_times = {반:{JS요일:{start,min}}})을 요일별로 쓴다. 없으면 예전 짐작.
#   ② 학생이 자기 학원 시간을 고친다: 📅 주간계획표 › 📌 고정 일정 › 「🏫 루멘수학 수업 시간」
#      요일 고르기 + 요일마다 시작·길이 → codi_fixed_<코드>.blocks 안에 { id:'lumen_me…', type:'lumen', label:'루멘수학', days(월0~일6), start, end, own:true }
#      있으면 반 시간 대신 이것(학생앱 · 학원앱 모두) · 「↺ 반 시간으로 되돌리기」 · 반 시간도 함께 보여 준다.
#   ③ 스터디 코디 「내 고정 시간표」는 루멘 시간을 요일별로 보여 주고 「✏️ 학원 시간 고치기」 → 주간계획표의 같은 칸으로.
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-134.html'); DST = os.path.join(ROOT, 'student_v2-135.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-134';", "var STU_VER = 'v2-135';")

# ── 공용 도우미: 반 시간 · 짐작 · 내가 고친 시간 (코디·주간계획표가 같이 쓴다) ──
LUMT = r"""/* ══ v2-135: ⏰ 루멘수학 수업 시간 — 반 시간(lumen_group_times, 학원앱 v19-119 「⏰ 반 수업 시간」) · 내가 고친 시간(codi_fixed_<코드> 안 type 'lumen')
 *   반 시간: { "<반>": { "<JS요일 0=일..6=토>": { start:'HH:MM', min:150 } } } — 수업 요일은 lumen_group_days. 시간이 없는 요일은 예전처럼 반 이름 짐작(T730 → 19:30 · 2시간)
 *   내가 고친 시간: codi_fixed_<코드>.blocks 안 { id:'lumen_me…', type:'lumen', label:'루멘수학', days:[월0~일6], start, end, own:true } — 있으면 반 시간 대신 이것 */
window.LUMT = (function(){
  var DUR = [[60,'1시간'],[90,'1시간 30분'],[120,'2시간'],[150,'2시간 30분'],[180,'3시간'],[210,'3시간 30분']];
  function hm(m){ m = Math.max(0, Math.min(1440, Math.round(m))); var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; }
  function mins(t){ var p = String(t || '').split(':'); if (p.length < 2) return -1; return Number(p[0]) * 60 + Number(p[1]); }
  function guess(g){ var dg = (String(g || '').match(/(\d+)/) || [])[1] || '', h = 17, mi = '00'; if (dg){ h = Number(dg.length >= 3 ? dg.slice(0, dg.length - 2) : dg); mi = dg.length >= 3 ? dg.slice(-2) : '00'; if (h < 9) h += 12; } return { start: hm(h * 60 + Number(mi)), min: 120 }; }
  function ok(x){ return !!(x && /^\d{1,2}:\d{2}$/.test(String(x.start || '')) && Number(x.min) > 0); }
  /* 반 시간 — 월0~일6 요일별 { start, min, src:'set'|'guess' } */
  function classPerDay(g, daysMap, timesMap){
    var gd = (daysMap || {})[g], out = {}; if (!Array.isArray(gd) || !gd.length) return out;
    var tm = (timesMap || {})[g] || {};
    gd.forEach(function(d){ d = Number(d); var x = tm[d] || tm[String(d)], md = (d + 6) % 7; if (ok(x)) out[md] = { start: x.start, min: Number(x.min), src: 'set' }; else { var q = guess(g); out[md] = { start: q.start, min: q.min, src: 'guess' }; } });
    return out;
  }
  function own(fixed){ return ((fixed && fixed.blocks) || []).filter(function(b){ return b && b.type === 'lumen' && (b.days || []).length && mins(b.end) > mins(b.start); }); }
  function perDayOf(blocks){ var out = {}; (blocks || []).forEach(function(b){ var a = mins(b.start), e = mins(b.end); (b.days || []).forEach(function(d){ out[Number(d)] = { start: b.start, min: e - a, src: 'own' }; }); }); return out; }
  /* 요일별 → 시작·끝이 같은 요일끼리 한 덩어리 */
  function group(per, mk){
    var by = {}, keys = [];
    Object.keys(per).forEach(function(d){ var x = per[d], a = mins(x.start), k = x.start + '|' + hm(a + Number(x.min)); if (!by[k]){ by[k] = { start: x.start, end: hm(a + Number(x.min)), days: [], guess: false }; keys.push(k); } by[k].days.push(Number(d)); if (x.src === 'guess') by[k].guess = true; });
    keys.sort(); return keys.map(function(k, i){ var b = by[k]; b.days.sort(); return mk(b, i); });
  }
  function classBlocks(g, daysMap, timesMap){ return group(classPerDay(g, daysMap, timesMap), function(b, i){ return { id: i ? 'lumen_' + (i + 1) : 'lumen', label: '루멘수학', type: 'lumen', days: b.days, start: b.start, end: b.end, auto: true, guess: b.guess }; }); }
  function ownFromPer(per){ var t = Date.now().toString(36); return group(per, function(b, i){ return { id: 'lumen_me' + t + i, label: '루멘수학', type: 'lumen', days: b.days, start: b.start, end: b.end, own: true }; }); }
  /* 그릴 칸: 내가 고친 시간이 있으면 그것, 없으면 반 시간 */
  function blocks(g, daysMap, timesMap, fixed){ var o = own(fixed); if (o.length) return o.map(function(b){ return { id: b.id, label: '루멘수학', type: 'lumen', days: (b.days || []).slice().sort(), start: b.start, end: b.end, own: true }; }); return classBlocks(g, daysMap, timesMap); }
  function txt(per){ return Object.keys(per).map(Number).sort().map(function(d){ var x = per[d]; return PW.DOW[d] + ' ' + x.start + '~' + hm(mins(x.start) + Number(x.min)); }).join(' · '); }
  return { DUR: DUR, hm: hm, mins: mins, guess: guess, classPerDay: classPerDay, own: own, perDayOf: perDayOf, classBlocks: classBlocks, ownFromPer: ownFromPer, blocks: blocks, txt: txt };
})();
"""
rep(";(function(){\nvar SC={ loaded:false, loading:false,", LUMT + ";(function(){\nvar SC={ loaded:false, loading:false,")

# ── 스터디 코디: 반 시간 읽기 · 루멘 칸 = LUMT ──
rep("var keys=['codi_fixed_'+c,'codi_plan_'+c,'codi_done_'+c,'codi_goals_'+c,'codi_coach_'+c,'lumen_group_days','mf_progress',",
    "var keys=['codi_fixed_'+c,'codi_plan_'+c,'codi_done_'+c,'codi_goals_'+c,'codi_coach_'+c,'lumen_group_days','lumen_group_times','mf_progress',")
rep("SC.src={ groupDays:got.lumen_group_days||{}, prog:", "SC.src={ groupDays:got.lumen_group_days||{}, groupTimes:got.lumen_group_times||{}, prog:")
rep("""function lumenBlock(){
  var g=myGroup(), gd=SC.src.groupDays[g]; if(!Array.isArray(gd)||!gd.length) return null;
  var dg=(g.match(/(\\d+)/)||[])[1]||'', h=17, mi='00'; if(dg){ h=Number(dg.length>=3?dg.slice(0,dg.length-2):dg); mi=dg.length>=3?dg.slice(-2):'00'; if(h<9) h+=12; }
  var st=h*60+Number(mi), en=st+120;
  return { id:'lumen', label:'루멘수학', type:'lumen', days:gd.map(function(d){ return (d+6)%7; }), start:(h<10?'0':'')+h+':'+mi, end:(Math.floor(en/60)<10?'0':'')+Math.floor(en/60)+':'+(en%60?'30':'00'), auto:true };
}""", """/* v2-135: 루멘 칸은 요일마다 시간이 다를 수 있어 여러 덩어리 — 내가 고친 시간(codi_fixed_ 안 type 'lumen') > 반 시간(lumen_group_times) > 반 이름 짐작 */
function lumenBlocks(){ return LUMT.blocks(myGroup(), SC.src.groupDays||{}, SC.src.groupTimes||{}, SC.fixed); }
function lumenBlock(){ var a=lumenBlocks(); if(!a.length) return null; var ds=[]; a.forEach(function(b){ b.days.forEach(function(d){ if(ds.indexOf(d)<0) ds.push(d); }); }); ds.sort(); return { id:'lumen', label:'루멘수학', type:'lumen', days:ds, start:a[0].start, end:a[0].end, auto:true }; }""")
rep("function fixedAll(){ var f=SC.fixed||fixedDefault(); var arr=(f.blocks||[]).slice(); var lb=lumenBlock(); if(lb) arr.push(lb); return arr; }",
    "function fixedAll(){ var f=SC.fixed||fixedDefault(); var arr=(f.blocks||[]).filter(function(b){ return b&&b.type!=='lumen'; }); return arr.concat(lumenBlocks()); }   /* v2-135 */")
# 코디 「내 고정 시간표」: 루멘 줄 = 요일별 · 고치기는 주간계획표의 같은 칸
rep("""  if(lb) h+='<div class="sc-fx"><b style="color:#b3261e">루멘수학</b> '+lb.days.map(function(d){ return DOW[d]; }).join('·')+' '+lb.start+'~'+lb.end+' <small>자동</small></div>';
  (f.blocks||[]).forEach(function(b,i){ h+='<div class="sc-fx">""",
    """  var lbs=lumenBlocks(); lbs.forEach(function(b){ h+='<div class="sc-fx"><b style="color:#b3261e">루멘수학</b> '+b.days.map(function(d){ return DOW[d]; }).join('·')+' '+b.start+'~'+b.end+' <small>'+(b.own?'내가 고친 시간':'반 시간')+'</small></div>'; });   /* v2-135 */
  if(window.wplLumOpen) h+='<div class="sc-fx"><button onclick="wplLumOpen(\\'screen-codi-fixed\\')" style="margin-left:0">✏️ 학원 시간 고치기</button></div>';
  (f.blocks||[]).forEach(function(b,i){ if(b&&b.type==='lumen') return; h+='<div class="sc-fx">""")
rep("매주 똑같은 시간을 넣어 줘. 루멘수학 수업은 반 배정에서 자동으로 알아.", "매주 똑같은 시간을 넣어 줘. 루멘수학 수업은 반 시간으로 자동으로 알아 — 다르면 「학원 시간 고치기」.")

# ── 주간계획표: 반 시간 읽기 · 루멘 칸 = LUMT ──
rep("var keys = ['wplan_' + c, 'wplan_chk_' + c, 'plweek_paper', 'lumen_group_days', 'sungong_' + c,",
    "var keys = ['wplan_' + c, 'wplan_chk_' + c, 'plweek_paper', 'lumen_group_days', 'lumen_group_times', 'sungong_' + c,")
rep("    WP.days = got['lumen_group_days'] || {};\n", "    WP.days = got['lumen_group_days'] || {};\n    WP.times = got['lumen_group_times'] || {};   /* v2-135: ⏰ 반 수업 시간 */\n")
rep("""function lumenBlk(){
  var g = String((window.studentInfo && studentInfo.group) || ''), gd = (WP.days || {})[g];
  if (!gd || !gd.length) return null;
  var dg = (g.match(/(\\d+)/) || [])[1] || '', h = 17, mi = '00';
  if (dg){ h = Number(dg.length >= 3 ? dg.slice(0, dg.length - 2) : dg); mi = dg.length >= 3 ? dg.slice(-2) : '00'; if (h < 9) h += 12; }
  var st = h * 60 + Number(mi);
  return { id:'lumen', label:'루멘수학', type:'lumen', days: gd.map(function(d){ return (d + 6) % 7; }), start: hm(st), end: hm(st + 120), auto: true };
}
function fixedList(){ var f = WP.fixed || fixedDef(); var arr = (f.blocks || []).slice(); var lb = lumenBlk(); if (lb) arr.push(lb); return arr; }""",
"""/* v2-135: 루멘 칸 = 내가 고친 시간 > 반 시간(lumen_group_times, 요일별) > 반 이름 짐작 — 요일마다 다르면 여러 덩어리 */
function myGroupW(){ return String((window.studentInfo && studentInfo.group) || ''); }
function lumenBlks(){ return LUMT.blocks(myGroupW(), WP.days || {}, WP.times || {}, WP.fixed); }
function lumenBlk(){ var a = lumenBlks(); if (!a.length) return null; var ds = []; a.forEach(function(b){ b.days.forEach(function(d){ if (ds.indexOf(d) < 0) ds.push(d); }); }); ds.sort(); return { id:'lumen', label:'루멘수학', type:'lumen', days: ds, start: a[0].start, end: a[0].end, auto: true }; }
function fixedList(){ var f = WP.fixed || fixedDef(); var arr = (f.blocks || []).filter(function(b){ return b && b.type !== 'lumen'; }); return arr.concat(lumenBlks()); }""")
# 고정 일정 칸: 루멘 줄 → 「🏫 루멘수학 수업 시간」 고치기 칸 · 아래 목록에서는 루멘 칸을 빼고
rep("""  if (lb) h += '<div class="wpf-it"><b style="color:#b3261e">루멘수학</b><span>' + lb.days.map(function(x){ return PW.DOW[x]; }).join('·') + ' ' + lb.start + '~' + lb.end + '</span><small>반 요일로 자동</small></div>';
  (f.blocks || []).forEach(function(b, i){ if (b.type === 'school') return;""",
    """  h += lumPanel();   /* v2-135: 🏫 루멘수학 수업 시간 (반 시간 · 내가 고친 시간) */
  (f.blocks || []).forEach(function(b, i){ if (b.type === 'school' || b.type === 'lumen') return;""")

LUMPANEL = r"""/* ── v2-135: 🏫 루멘수학 수업 시간 — 반 시간을 보고, 다르면 내가 고친다 (codi_fixed_<코드> 안 type 'lumen' own) ── */
function lumNow(){ var o = LUMT.own(WP.fixed); return o.length ? LUMT.perDayOf(o) : LUMT.classPerDay(myGroupW(), WP.days || {}, WP.times || {}); }
function lumPanel(){
  var cls = LUMT.classPerDay(myGroupW(), WP.days || {}, WP.times || {}), isOwn = LUMT.own(WP.fixed).length > 0;
  if (!WP.lmDraft){ var cur = lumNow(), dr = {}; Object.keys(cur).forEach(function(d){ dr[d] = { start: cur[d].start, min: cur[d].min }; }); WP.lmDraft = dr; }
  var dr2 = WP.lmDraft, guess = Object.keys(cls).some(function(d){ return cls[d].src === 'guess'; });
  var h = '<div class="wpl-lum" id="wpl-lum"><div class="h"><b>🏫 루멘수학 수업 시간</b><small>' + (isOwn ? '✏️ 내가 고친 시간이에요 · 선생님 화면에도 이렇게 보여요' : '반 시간 그대로예요 · 다르면 고쳐요') + '</small></div>';
  h += '<div class="cls">우리 반(' + esc(myGroupW() || '반 없음') + ') 시간: <b>' + (Object.keys(cls).length ? esc(LUMT.txt(cls)) : '반 수업 요일이 아직 없어요') + '</b>' + (guess ? ' <em>반 이름으로 짐작</em>' : '') + '</div>';
  h += '<div class="lab">학원 가는 요일</div><div class="wpl-lum-days">' + PW.DOW.map(function(n, i){ var on = !!dr2[i]; return '<button type="button" class="' + (on ? 'on' : '') + '" aria-pressed="' + on + '" onclick="wplLumDay(' + i + ')">' + n + '</button>'; }).join('') + '</div>';
  var tOpt = function(sel){ var o = '', hit = false; for (var m = 7 * 60; m <= 22 * 60 + 50; m += 10){ var t = LUMT.hm(m); if (t === sel) hit = true; o += '<option' + (t === sel ? ' selected' : '') + '>' + t + '</option>'; } if (sel && !hit) o = '<option selected>' + esc(sel) + '</option>' + o; return o; };
  var dOpt = function(sel){ var o = '', hit = false; LUMT.DUR.forEach(function(x){ if (x[0] === sel) hit = true; o += '<option value="' + x[0] + '"' + (x[0] === sel ? ' selected' : '') + '>' + x[1] + '</option>'; }); if (!hit) o += '<option value="' + sel + '" selected>' + sel + '분</option>'; return o; };
  Object.keys(dr2).map(Number).sort().forEach(function(d){
    var x = dr2[d], end = LUMT.hm(LUMT.mins(x.start) + Number(x.min));
    h += '<div class="wpl-lum-row"><span class="d">' + PW.DOW[d] + '</span><label><small>시작</small><select id="wpl-lum-s-' + d + '" aria-label="' + PW.DOW[d] + '요일 시작" onchange="wplLumSet(' + d + ')">' + tOpt(x.start) + '</select></label><label><small>길이</small><select id="wpl-lum-m-' + d + '" aria-label="' + PW.DOW[d] + '요일 수업 길이" onchange="wplLumSet(' + d + ')">' + dOpt(Number(x.min)) + '</select></label><span class="e" id="wpl-lum-e-' + d + '">~' + end + '</span></div>';
  });
  if (!Object.keys(dr2).length) h += '<div class="none">위에서 학원 가는 요일을 골라 주세요</div>';
  h += '<div class="foot"><button type="button" class="pri" onclick="wplLumSave()">✏️ 내 학원 시간 저장</button>' + (isOwn ? '<button type="button" onclick="wplLumReset()">↺ 반 시간으로 되돌리기</button>' : '') + '</div>';
  h += '<small class="tip">보강·시간 바뀜처럼 반 시간과 다를 때만 고쳐요. 고친 시간은 선생님 화면에 「학생이 고친 학원 시간」으로 보여요.</small></div>';
  return h;
}
function lumPull(){ var dr = WP.lmDraft || {}; Object.keys(dr).forEach(function(d){ var s = document.getElementById('wpl-lum-s-' + d), m = document.getElementById('wpl-lum-m-' + d); if (s && s.value) dr[d].start = s.value; if (m && m.value) dr[d].min = Number(m.value); }); }
window.wplLumSet = function(d){ lumPull(); var x = (WP.lmDraft || {})[d], e = document.getElementById('wpl-lum-e-' + d); if (x && e) e.textContent = '~' + LUMT.hm(LUMT.mins(x.start) + Number(x.min)); };
window.wplLumDay = function(d){
  lumPull(); var dr = WP.lmDraft || (WP.lmDraft = {});
  if (dr[d]) delete dr[d];
  else { var cls = LUMT.classPerDay(myGroupW(), WP.days || {}, WP.times || {}), ks = Object.keys(dr), x = cls[d] || (ks.length ? dr[ks[0]] : LUMT.guess(myGroupW())); dr[d] = { start: x.start, min: x.min }; }
  wplRender();
};
window.wplLumSave = async function(){
  lumPull(); var dr = WP.lmDraft || {}, ks = Object.keys(dr);
  if (!ks.length){ say('학원 가는 요일을 하나 이상 골라 주세요 — 반 시간으로 돌리려면 「↺ 반 시간으로 되돌리기」'); return; }
  for (var i = 0; i < ks.length; i++){ var x = dr[ks[i]]; if (LUMT.mins(x.start) + Number(x.min) > 24 * 60){ say(PW.DOW[ks[i]] + '요일 끝나는 시간이 밤 12시를 넘어요'); return; } }
  var cls = LUMT.classPerDay(myGroupW(), WP.days || {}, WP.times || {}), same = Object.keys(cls).length === ks.length && ks.every(function(d){ return cls[d] && cls[d].start === dr[d].start && Number(cls[d].min) === Number(dr[d].min); });
  WP.fixed = WP.fixed || fixedDef(); if (!WP.fixed.blocks) WP.fixed.blocks = [];
  var others = WP.fixed.blocks.filter(function(b){ return b && b.type !== 'lumen'; });
  WP.fixed.blocks = same ? others : others.concat(LUMT.ownFromPer(dr));
  WP.lmDraft = null; wplRender();
  if (await fxSave()) say(same ? '반 시간과 같아서 반 시간 그대로 둘게요' : '✏️ 내 학원 시간을 저장했어요 — 달력에 바로 칠해져요');
};
window.wplLumReset = async function(){
  if (!confirm('내가 고친 학원 시간을 지우고 반 시간으로 되돌릴까요?')) return;
  WP.fixed = WP.fixed || fixedDef(); WP.fixed.blocks = (WP.fixed.blocks || []).filter(function(b){ return b && b.type !== 'lumen'; });
  WP.lmDraft = null; wplRender();
  if (await fxSave()) say('↺ 반 시간으로 되돌렸어요');
};
/* 코디 「내 고정 시간표」에서: 주간계획표의 이 칸을 열어 준다 */
window.wplLumOpen = function(back){ WP.fxOpen = true; WP.lmDraft = null; WP.lumFocus = true; wplOpen('this', back || 'screen-planner'); };
"""
rep("window.wplRender = function(){\n", LUMPANEL + "window.wplRender = function(){\n")
# 그린 뒤 「루멘 시간 고치기」로 왔으면 그 칸으로 내려간다
rep("""    go2.textContent = subd ? '✅ 냈어요 · 고친 내용 저장' : (nMine ? ('📅 이 계획 내기 (' + nMine + '개)') : '빈칸을 눌러 할 일을 먼저 써요');
  }
};""", """    go2.textContent = subd ? '✅ 냈어요 · 고친 내용 저장' : (nMine ? ('📅 이 계획 내기 (' + nMine + '개)') : '빈칸을 눌러 할 일을 먼저 써요');
  }
  if (WP.lumFocus && WP.loaded){ WP.lumFocus = false; var lm = document.getElementById('wpl-lum'); if (lm && lm.scrollIntoView) try { lm.scrollIntoView({ block: 'start' }); } catch(e){} }   /* v2-135 */
};""")
# 화면을 새로 열면 고치던 것은 버린다(서버 것으로 다시)
rep("  await wplLoad(true);\n  wplRender();\n};", "  await wplLoad(true);\n  WP.lmDraft = null;   /* v2-135 */\n  wplRender();\n};")
rep("window.wplFxToggle = function(){ WP.fxOpen = !WP.fxOpen;", "window.wplFxToggle = function(){ WP.fxOpen = !WP.fxOpen; WP.lmDraft = null;")
# 설명 주석
rep(" *       - 고정 일정은 코디와 같은 codi_fixed_<코드> 하나 (루멘 수업은 반 요일로 자동)",
    " *       - 고정 일정은 코디와 같은 codi_fixed_<코드> 하나 (루멘 수업은 반 요일 · 반 시간(lumen_group_times)으로 자동 — v2-135부터 학생이 고칠 수 있음: type 'lumen' own)")

# 모양
rep(".wps-school{background:#f8fafc;", """.wpl-lum{background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
.wpl-lum .h b{font-size:13px;font-weight:900;color:#b3261e;display:block}.wpl-lum .h small{font-size:11px;color:#64748b;font-weight:700}
.wpl-lum .cls{font-size:12px;color:#475569;font-weight:700;line-height:1.5}.wpl-lum .cls b{color:#0d2240}.wpl-lum .cls em{font-style:normal;font-size:10.5px;background:#fff7ed;color:#9a3412;border-radius:5px;padding:1px 5px;white-space:nowrap}
.wpl-lum .lab{font-size:11.5px;font-weight:900;color:#0d2240}
.wpl-lum-days{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.wpl-lum-days button{min-height:38px;border:1.5px solid #e2e8f0;background:#fff;color:#94a3b8;border-radius:10px;font-size:13px;font-weight:900;font-family:inherit;cursor:pointer}.wpl-lum-days button.on{background:#b3261e;border-color:#b3261e;color:#fff}
.wpl-lum-row{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1.3fr) 46px;gap:5px;align-items:end}
.wpl-lum-row .d{font-size:14px;font-weight:900;color:#b3261e;text-align:center;padding-bottom:9px}
.wpl-lum-row label{display:flex;flex-direction:column;gap:2px;min-width:0}.wpl-lum-row label small{font-size:10.5px;color:#64748b;font-weight:800}
.wpl-lum-row select{width:100%;min-height:40px;border:1.5px solid #cbd5e1;border-radius:9px;padding:6px 2px;font-size:13.5px;font-family:inherit;background:#fff;color:#0d2240;font-weight:800}
.wpl-lum-row .e{font-size:12.5px;font-weight:900;color:#0d2240;padding-bottom:10px;white-space:nowrap}
.wpl-lum .none{font-size:12px;color:#94a3b8;font-weight:700}
.wpl-lum .foot{display:flex;gap:6px;flex-wrap:wrap}.wpl-lum .foot button{min-height:40px;border:1.5px solid #e2e8f0;background:#fff;color:#475569;border-radius:10px;padding:8px 12px;font-size:12.5px;font-weight:900;font-family:inherit;cursor:pointer}
.wpl-lum .foot .pri{background:#0d2240;border-color:#0d2240;color:#fff}
.wpl-lum .tip{font-size:10.5px;color:#94a3b8;font-weight:700;line-height:1.5}
.wps-school{background:#f8fafc;""")

log = """ * v2-135 (2026-10-13) ⏰ 루멘수학 수업 시간 — 반 시간대로 · 내가 고칠 수 있게 (원장 「학생들이 학원시간을 수정할 수 있게 하자.」)
 *   · 주간계획표 달력과 스터디 코디의 «루멘수학» 칸이 반 이름 짐작(T730 → 19:30 · 늘 2시간) 대신
 *     학원앱 v19-119 「⏰ 반 수업 시간」에서 원장님이 정한 <b>요일별 시간</b>으로 칠해집니다(예: 화·목 19:30 · 토 10:30). 안 정한 반은 예전처럼 짐작.
 *   · 📅 주간계획표 › 📌 고정 일정 › 「🏫 루멘수학 수업 시간」: 우리 반 시간을 보여 주고, 보강·시간 바뀜처럼 다르면
 *     요일과 시작·길이를 골라 <b>내 학원 시간</b>으로 저장합니다. 「↺ 반 시간으로 되돌리기」로 돌아갑니다.
 *     선생님 화면(주간계획 모아보기)에는 「✏️ 학생이 고친 학원 시간」으로 보입니다.
 *   · 스터디 코디 「내 고정 시간표」도 요일별 시간을 보여 주고 「✏️ 학원 시간 고치기」로 같은 칸을 엽니다.
 *
"""
first = re.search(r"\n \* v2-\d+ \(", s); assert first
s = s[:first.start()+1] + log + s[first.start()+1:]
open(DST, 'w', encoding='utf-8').write(s); print('ok →', DST, len(s))
