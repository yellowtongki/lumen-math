/* ═══════════════════════════════════════════════════════════════════
 * v19-86: 📔 순공피드백 — 점수 보이기 · «어느 주 종이인가» 바로잡기 (2026-10-07 원장 「순공피드백 점수반영이 안된다」)
 *  원인: 학생은 한 주가 끝난 뒤(월·화) 그 주 종이를 찍어 올리는데, 학생앱(v2-128까지)은 «올린 날의 주»에 넣었다.
 *        → 지난 주 칸은 비어 0점, 이번 주 칸에는 지난 주 종이가 들어가 있었다 (사진 6장 모두 한 주씩 밀림 확인).
 *  고침: 학생앱 v2-129 는 학생이 주를 고른다(월~목은 «지난 주»가 먼저). 학원앱 이 화면에서
 *        ① 주마다 사진·종이 점수 ② 기록을 앞뒤 주로 옮기기 ③ 사진 점수 손 고침 ④ 종이 가져옴(첫 수업 때 받음)
 *  사진 점수 손 고침 = plweek_paper.byCode[코드][주].pov ('ok'|'late'|'none') — 학원앱만 쓰는 키라 학생 제출이 덮어쓰지 않는다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var SGS = { busy:false, kick:0 };
function sgsReady(){
  if(typeof PWB==='undefined'||typeof PW==='undefined') return false;
  if(PWB.loaded) return true;
  if(!PWB.loading&&!SGS.kick){ SGS.kick=1; try{ plwLoad().then(function(){ if(VIEW==='sungong') render(); }); }catch(e){} }
  return false;
}
function sgsStu(code){ return (students||[]).filter(function(s){ return s&&String(s.lumen_rec_code)===String(code); })[0]||null; }
function sgsScore(code, W){ if(!W||W<PW.W0||!sgsReady()) return null; var st=sgsStu(code); if(!st) return null; return plwScore(st, W); }
function sgsLbl(W){ return PW.md(W)+'~'+PW.md(PW.add(W,6)); }
var SGS_PT=PW.PT.photo;   /* v19-91: 사진·종이 각 5 · 지각 2 */

/* 표 칸 아래 작은 점수 줄 — 📸 사진 · 📔 종이 */
function sgsBadge(code, W, e){
  var s=sgsScore(code, W); if(!s) return '';
  var out=[];
  if(s.photo!=='none') out.push('<span title="사진 '+(s.photo==='ok'?'제때':'지각')+(s.photoOv?' · 원장님이 고침':'')+'" style="color:'+(s.photo==='ok'?'#15803d':'#b45309')+'">📸'+SGS_PT[s.photo]+(s.photoOv?'✋':'')+'</span>');
  else if(e&&e.photo&&s.released) out.push('<span title="마감(월요일 24시) 뒤에 올라와 점수 없음" style="color:#b91c1c">📸0</span>');
  else if(s.photoOv) out.push('<span title="원장님이 0점으로 고침" style="color:#b91c1c">📸0✋</span>');
  if(s.paper!=='none') out.push('<span title="종이 '+(s.paper==='ok'?'제때':'지각')+'" style="color:'+(s.paper==='ok'?'#15803d':'#b45309')+'">📔'+SGS_PT[s.paper]+'</span>');
  if(!out.length) return '';
  return '<div style="font-size:10px;font-weight:900;margin-top:3px;white-space:nowrap;display:flex;gap:4px;justify-content:center">'+out.join('')+'</div>';
}
function sgsCell(code, w, e){
  var b=sgsBadge(code, w, e);
  if(e) return '<td onclick="sgOpen(\''+esc2(code)+'\',\''+w+'\')" title="'+sgFmt(sgTotal(e))+' — 눌러서 사진 대조·점수" style="padding:6px 4px;border-bottom:1px solid #f4f6fa;text-align:center;cursor:pointer">'
    +'<span style="display:inline-block;background:#ecfdf5;color:#059669;border-radius:8px;padding:3px 7px;font-size:11.5px;font-weight:900">'+sgFmt(sgTotal(e))+(e.photo?' 🖼':'')+(e.moved?' ↪':'')+'</span>'+b+'</td>';
  if(w>=PW.W0) return '<td onclick="sgOpen(\''+esc2(code)+'\',\''+w+'\')" title="제출 없음 — 눌러서 종이 가져옴·점수" style="padding:6px 4px;border-bottom:1px solid #f4f6fa;text-align:center;cursor:pointer;color:#dbe2ea;font-weight:900">—'+b+'</td>';
  return '<td style="padding:8px 4px;border-bottom:1px solid #f4f6fa;text-align:center;color:#dbe2ea;font-weight:900">—</td>';
}
/* 맨 위 요약 줄 옆 — 지금 점수를 매기는 주 */
function sgsSummaryTile(list){
  if(!sgsReady()) return '<div style="flex:1.4;min-width:220px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:13px;padding:11px 14px;font-size:12px;color:#7c3aed;font-weight:800">⏳ 점수 불러오는 중…</div>';
  var W=plwDefaultW(), nP=0, nPa=0, pts=0;
  list.forEach(function(st){ var s=plwScore(st, W); if(s.photo!=='none') nP++; if(s.paper!=='none') nPa++; pts+=s.photoPt+s.paperPt; });
  return '<div style="flex:1.4;min-width:220px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:13px;padding:11px 14px">'
    +'<div style="font-size:11px;color:#7c3aed;font-weight:800">점수 주 '+sgsLbl(W)+(W===PW.W0?' (시범 주)':'')+'</div>'
    +'<div style="font-size:15px;font-weight:900;color:#5b21b6;margin-top:2px">📸 사진 '+nP+'명 · 📔 종이 '+nPa+'명</div></div>';
}
function sgsBanner(){
  return '<div style="background:#fff7ed;border:1.5px solid #fdba74;border-radius:13px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#9a3412;font-weight:800;line-height:1.7">'
    +'📌 칸은 <b>종이에 적힌 주</b>입니다. 사진 점수: 그 주 일요일 24시까지 📸'+PW.PT.photo.ok+' · 월요일 📸'+PW.PT.photo.late+' · 그 뒤 0 &nbsp;|&nbsp; 종이: 다음 주 첫 수업까지 📔'+PW.PT.paper.ok+' · 그 주 안 📔'+PW.PT.paper.late+'<br>'
    +'학생앱 v2-128까지는 월·화에 올린 지난 주 종이가 <b>이번 주 칸</b>에 들어갔습니다. 칸을 눌러 사진 맨 위 날짜를 보고 「← 한 주 앞으로」를 누르면 바로잡힙니다 (↪ = 옮긴 기록 · ✋ = 원장님이 고친 점수).</div>';
}

/* 팝업 위쪽 — 주 옮기기 · 사진 점수 · 종이 */
function sgsPopActions(code, mon){
  var w=sgOf(code, mon), btn=function(label, js, on, col){ return '<button onclick="'+js+'" style="border:1.5px solid '+(on?(col||'#7c3aed'):'#e2e8f0')+';background:'+(on?(col||'#7c3aed'):'#fff')+';color:'+(on?'#fff':'#475569')+';font-family:inherit;font-size:12px;font-weight:900;padding:5px 11px;border-radius:8px;cursor:pointer"'+(SGS.busy?' disabled':'')+'>'+label+'</button>'; };
  var h='<div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:10px 12px;margin-bottom:12px;display:flex;flex-direction:column;gap:8px">';
  if(w){
    h+='<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:900;color:#5b21b6">📅 '+sgsLbl(mon)+' 칸</span>'
      +'<span style="font-size:11px;font-weight:700;color:#7c3aed">사진 맨 위 날짜가 다른 주면 →</span>'
      +btn('← 한 주 앞 ('+sgsLbl(PW.add(mon,-7))+')로 옮기기', "sgsMove('"+esc2(code)+"','"+mon+"',-1)")
      +btn('한 주 뒤 ('+sgsLbl(PW.add(mon,7))+')로 →', "sgsMove('"+esc2(code)+"','"+mon+"',1)");
    if(w.moved) h+='<span style="font-size:10.5px;color:#94a3b8;font-weight:800">↪ '+esc2(String(w.moved.from||'').slice(5).replace('-','/'))+' 칸에서 옮김</span>';
    h+='</div>';
  }
  if(mon>=PW.W0){
    if(!sgsReady()){ h+='<div style="font-size:12px;color:#7c3aed;font-weight:800">⏳ 점수 불러오는 중…</div></div>'; return h; }
    var st=sgsStu(code), s=plwScore(st, mon), rec=((PWB.paper.byCode||{})[code]||{})[mon]||{};
    var auto=s.photoAuto, autoTxt=(auto==='ok'?('제때 '+PW.PT.photo.ok+'점'):(auto==='late'?('지각 '+PW.PT.photo.late+'점'):'0점'));
    h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:900;color:#0d2240;min-width:96px">📸 사진 점수 <b style="color:#5b21b6">'+s.photoPt+'</b></span>'
      +btn('규칙대로 ('+autoTxt+')', "sgsPov('"+esc2(code)+"','"+mon+"','')", !rec.pov)
      +btn(PW.PT.photo.ok+'점', "sgsPov('"+esc2(code)+"','"+mon+"','ok')", rec.pov==='ok', '#15803d')
      +btn(PW.PT.photo.late+'점', "sgsPov('"+esc2(code)+"','"+mon+"','late')", rec.pov==='late', '#b45309')
      +btn('0점', "sgsPov('"+esc2(code)+"','"+mon+"','none')", rec.pov==='none', '#b91c1c');
    if(rec.povWhy) h+='<span style="font-size:10.5px;color:#94a3b8;font-weight:800">✋ '+esc2(rec.povWhy)+'</span>';
    h+='</div>';
    var fc=PW.firstClass(PW.add(mon,7), PWB.days[(st&&st.group)||'']||null);
    h+='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:12.5px;font-weight:900;color:#0d2240;min-width:96px">📔 종이 <b style="color:#5b21b6">'+s.paperPt+'</b></span>'
      +'<span style="font-size:11px;font-weight:700;color:#64748b">'+(rec.at?('가져옴 '+String(PW.dayOfIso(rec.at)).slice(5).replace('-','/')+(rec.ov?' (손 고침)':'')):'아직 안 가져옴')+'</span>'
      +btn('첫 수업('+PW.md(fc)+' '+PW.DOW[PW.dow(fc)]+') 때 받음', "sgsPaper('"+esc2(code)+"','"+mon+"','first')", false)
      +btn('오늘 받음', "sgsPaper('"+esc2(code)+"','"+mon+"','today')", false)
      +(rec.at||rec.ov?btn('지우기', "sgsPaper('"+esc2(code)+"','"+mon+"','clear')", false):'')
      +'</div>';
  }
  return h+'</div>';
}

/* 기록 옮기기 — sungong_<코드> 를 새로 읽어 고친다 (학생이 쓰는 키라 읽고 바로 쓴다) */
window.sgsMove=async function(code, mon, d){
  if(SGS.busy) return; var to=PW.add(mon, 7*d), sb=getSupaClient(); if(!sb){ alert('클라우드 연결이 없습니다.'); return; }
  SGS.busy=true; render();
  try{
    var r=await sb.from('lumen_store').select('value').eq('key','sungong_'+code);
    var v=(r&&r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    if(!v||!v.weeks||!v.weeks[mon]){ alert('서버에 이 주 기록이 없습니다. 새로고침 후 다시 해 주세요.'); SGS.busy=false; render(); return; }
    var a=v.weeks[mon], b=v.weeks[to], now=new Date().toISOString();
    if(b&&!confirm(sgsLbl(to)+' 칸에도 기록이 있습니다. 두 기록을 서로 바꿀까요?')){ SGS.busy=false; render(); return; }
    a.moved={ from:mon, at:now, by:'teacher' }; v.weeks[to]=a;
    if(b){ b.moved={ from:to, at:now, by:'teacher' }; v.weeks[mon]=b; } else delete v.weeks[mon];
    var w=await sb.from('lumen_store').upsert({ key:'sungong_'+code, value:v, updated_at:now }, { onConflict:'key' });
    if(w&&w.error) throw w.error;
    SG.data[code]=v; if(typeof PWB!=='undefined'&&PWB.sg) PWB.sg[code]=v.weeks; SG.pop={ code:code, mon:to };
    if(typeof plwRepublish==='function') plwRepublish(code);
    plToast('📅 '+sgsLbl(to)+' 칸으로 옮겼습니다');
  }catch(e){ alert('옮기지 못했습니다: '+((e&&e.message)||e)); }
  SGS.busy=false; render();
};
async function sgsPaperMut(code, W, fn){
  var sb=getSupaClient(); if(!sb){ alert('클라우드 연결이 없습니다.'); return; }
  SGS.busy=true; render();
  try{
    var r=await sb.from('lumen_store').select('value').eq('key','plweek_paper');
    var v=(r&&r.data&&r.data[0])?r.data[0].value:null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    v=v||{ byCode:{} }; if(!v.byCode) v.byCode={}; v.byCode[code]=v.byCode[code]||{};
    var rec=Object.assign({}, v.byCode[code][W]||{}); fn(rec);
    if(Object.keys(rec).length) v.byCode[code][W]=rec; else delete v.byCode[code][W];
    v.upd=new Date().toISOString();
    var w=await sb.from('lumen_store').upsert({ key:'plweek_paper', value:v, updated_at:v.upd }, { onConflict:'key' });
    if(w&&w.error) throw w.error;
    PWB.paper=v; if(typeof plwRepublish==='function') plwRepublish(code);
  }catch(e){ alert('저장하지 못했습니다: '+((e&&e.message)||e)); }
  SGS.busy=false; render();
}
window.sgsPov=function(code, W, val){
  return sgsPaperMut(code, W, function(rec){ if(!val){ delete rec.pov; delete rec.povWhy; delete rec.povAt; } else { rec.pov=val; rec.povWhy='원장님이 고침'; rec.povAt=new Date().toISOString(); } });
};
window.sgsPaper=function(code, W, how){
  var st=sgsStu(code), fc=PW.firstClass(PW.add(W,7), PWB.days[(st&&st.group)||'']||null), now=new Date().toISOString();
  return sgsPaperMut(code, W, function(rec){
    delete rec.ov;
    if(how==='clear'){ delete rec.at; return; }
    if(how==='first'){ var t=Date.parse(fc+'T12:00:00+09:00'); rec.at=(t<Date.now()?new Date(t).toISOString():now); return; }
    rec.at=now;
  });
};
