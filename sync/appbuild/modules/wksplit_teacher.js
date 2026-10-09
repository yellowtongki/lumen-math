/* ═══════════════════════════════════════════════════════════════════
 * v19-88: 주간 점수를 «📅 주간계획 · 📔 순공피드백» 두 칸으로 (2026-10-07 원장 「순공피드백이 점수이다. 지금 주간계획표에 점수가 들어간 것 같다」)
 *   주간 점수 10 = 주간계획(다음 주 계획 3 + 실천 3) 6 + 순공피드백(사진 2 + 종이 2) 4.
 *   v19-81 입력 표는 한 칸 «주간»에 합계만 보여, 9/28 주 순공 점수(사진·종이)가 주간계획 점수처럼 보였다.
 *   점수 계산은 그대로이고 보이는 칸만 나눈다. (같은 이름의 함수를 다시 정의 — 뒤에 온 것이 쓰인다)
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
function plrSplit(s){ return { plan:(+s.planPt||0)+(+((s.prac||{}).pt)||0), sg:(+s.photoPt||0)+(+s.paperPt||0) }; }
function plrGridHead(yr, mo, d, row){
  if(!plrGridWeekOf(yr,mo,d)) return '';
  if(row===1) return '<th colspan="2" style="padding:2px;text-align:center;border-bottom:1px solid #e8edf5;font-size:9px;font-weight:800;color:#7c3aed;background:#f5f3ff">주간</th>';
  var th=function(t, tip, col){ return '<th style="min-width:30px;padding:4px 2px;text-align:center;border-bottom:2px solid #e8edf5;font-size:9.5px;font-weight:800;color:'+col+';background:#f5f3ff;white-space:nowrap" title="'+tip+'">'+t+'</th>'; };
  return th('계획','📅 주간계획 — 다음 주 계획 '+PW.MAX.plan+' + 계획 실천 '+PW.MAX.prac+' ('+PW.MAX.wp+'점) · 일요일 밤 발표','#1d4ed8')+th('순공','📔 순공피드백 — 사진 '+PW.MAX.photo+' + 종이 '+PW.MAX.paper+' ('+PW.MAX.sg+'점) · 일요일 밤 발표','#7c3aed');
}
function plrGridCell(st, yr, mo, d){
  var W=plrGridWeekOf(yr,mo,d); if(!W) return '';
  var empty='<td style="padding:2px;text-align:center;background:#faf8ff"></td>';
  if(!PWB.loaded){ if(!PWB.loading&&!PLR._gridLoad){ PLR._gridLoad=1; try{ plwLoad().then(function(){ if(VIEW==='planner') render(); }); }catch(e){} }
    var dots='<td style="padding:2px;text-align:center;background:#faf8ff"><div style="width:26px;height:24px;margin:auto;font-size:9px;color:#c4b5fd;display:flex;align-items:center;justify-content:center">…</div></td>'; return dots+dots; }
  if(!st.lumen_rec_code) return empty+empty;
  var s=plwScore(st, W), rel=s.released, sp=plrSplit(s), wk=PW.md(W)+'~'+PW.md(PW.add(W,6));
  var go='VIEW=\'plweek\';PWB.W=\''+W+'\';render()';
  var box=function(v, mx, tip, c1, c2, c3){
    return '<td style="padding:2px;text-align:center;background:#faf8ff"><div onclick="'+go+'" title="'+tip+'" style="width:26px;height:24px;border-radius:5px;margin:auto;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;cursor:pointer;'
      +(rel?('background:'+(v>=mx*0.7?c1:(v>0?c2:c3))+';color:'+(v>=mx*0.7?'#fff':(v>0?'#fff':'#94a3b8'))):'border:1.5px dashed #c4b5fd;color:#a78bfa')+'">'+(rel?v:'·')+'</div></td>';
  };
  var t1='📅 주간계획 '+wk+(rel?(' · 다음 주 계획 '+s.planPt+' · 실천 '+s.prac.pt+(s.prac.noEv?(' (증거 없음 '+s.prac.noEv+')'):'')+' = '+sp.plan+'/'+PW.MAX.wp):' · 일요일 밤 발표');
  var t2='📔 순공피드백 '+wk+(rel?(' · 사진 '+s.photoPt+(s.photoOv?' (원장님이 고침)':'')+' · 종이 '+s.paperPt+' = '+sp.sg+'/'+PW.MAX.sg):' · 일요일 밤 발표');
  return box(sp.plan, PW.MAX.wp, t1, '#1d4ed8', '#60a5fa', '#eff6ff')+box(sp.sg, PW.MAX.sg, t2, '#7c3aed', '#a78bfa', '#ede9fe');
}
function plrGridTotal(st, ym, daily, tColor){
  if(ym<'2026.10') return String(daily);
  var a=0, b=0;
  try{ if(PWB.loaded&&st&&st.lumen_rec_code) plwMonthWeeks(ym.replace('.','-')).forEach(function(W){ var sp=plrSplit(plwScore(st, W)); a+=sp.plan; b+=sp.sg; }); }catch(e){}
  return '<div style="line-height:1.1">'+(daily+a+b)+'</div><div style="font-size:9px;font-weight:700;color:#94a3b8;white-space:nowrap">매일 '+daily+' · <span style="color:#1d4ed8">계획 '+a+'</span> · <span style="color:#7c3aed">순공 '+b+'</span></div>';
}
