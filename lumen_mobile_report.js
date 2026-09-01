/* ═══════════════════════════════════════════════════════════════════
 * 📱 루멘 모바일 성적표 — 학원앱·학생앱 <b>공용</b> (2026-09-01 원장 지시)
 * ═══════════════════════════════════════════════════════════════════
 * 「학원앱에서 고치면 학생앱도 그대로 바뀌게 한 벌만 쓴다」는 요청에 따라
 * 두 앱이 이 파일 하나를 <script src>로 함께 불러 쓴다.
 * 여기만 고치면 ① 학원앱 카톡용 이미지 ② 학생앱 「내 성적표 보기」가 같이 바뀐다.
 *
 * 쓰는 법:  lumenMobileReport(rec, { per:[...] })  →  HTML 문자열
 *   rec  : 학원앱 _maPreviewRec() / 학생앱 rtRecOf() 가 만드는 성적표 데이터 (두 앱 구조 동일)
 *   opts.per : 문항별 원본 [{seq, r:'O'|'X'|'?', essay}] — 없으면 rec.items로 대신한다
 */
/* ══ 📱 카톡용 모바일 성적표 (v2-59) ═════════════════════════════
 * A4 성적표를 축소해 보여 주던 것을 폰에서 바로 읽히는 세로 성적표로 바꿨다
 * (2026-09-01 원장 지시). 학부모에게 카톡으로 보내는 그 모양 그대로.        */
function lumenMobileReport(rec, opts){
  opts=opts||{};
  var esc=function(x){ return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var score=parseFloat(rec.studentScore); if(isNaN(score)) score=null;
  var mean=parseFloat(rec.schoolMean), sd=parseFloat(rec.schoolSd);
  var totalN=parseInt(rec.totalStudents,10);
  var hasDist=!isNaN(mean)&&!isNaN(sd)&&sd>0&&score!=null;
  var z=hasDist?((score-mean)/sd):null;
  var topPct=null, rank=null;
  if(z!=null){
    /* 정규분포 상위 % — 학원앱과 같은 근사식 */
    var t=1/(1+0.2316419*Math.abs(z));
    var d=0.3989423*Math.exp(-z*z/2);
    var p=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));
    var upper=(z>0)?p:(1-p);
    topPct=Math.round(upper*1000)/10;
    if(!isNaN(totalN)&&totalN>0) rank=Math.max(1,Math.round(totalN*upper/100));
  }
  /* 5등급제 — 상위 누적 10/34/66/90% 컷 (두 앱이 쓰는 규칙과 같다) */
  var g5=null;
  if(topPct!=null) g5=(topPct<=10)?1:(topPct<=34)?2:(topPct<=66)?3:(topPct<=90)?4:5;
  var ach=(score==null)?null:(score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'E');
  var isMid=/^중/.test(rec.grade||'');
  var dist=[
    {k:'A',lab:'90점↑',v:parseFloat(rec.distA),c:'#10b981'},
    {k:'B',lab:'80~89',v:parseFloat(rec.distB),c:'#2c5fa8'},
    {k:'C',lab:'70~79',v:parseFloat(rec.distC),c:'#d97706'},
    {k:'D',lab:'60~69',v:parseFloat(rec.distD),c:'#c4703a'},
    {k:'E',lab:'60점↓',v:parseFloat(rec.distE),c:'#dc2626'}
  ].filter(function(x){ return !isNaN(x.v); });
  var myBand=score==null?null:(score>=90?'A':score>=80?'B':score>=70?'C':score>=60?'D':'E');
  var maxD=dist.length?Math.max.apply(null,dist.map(function(x){return x.v;})):0;
  /* 문항별 — 앱마다 원본이 달라 opts.per(원본 per) → rec.items 순으로 받는다 */
  var per=(opts.per&&opts.per.length)?opts.per
        :((rec.items||[]).map(function(x){ return { seq:x.no, r:(x.correct?'O':'X'), essay:false }; }));
  var okN=per.filter(function(p){return p.r==='O';}).length;
  var xN=per.filter(function(p){return p.r==='X'||p.r==='?';}).length;
  var eN=per.filter(function(p){return p.essay;}).length;
  var units=(rec.unitRates||[]).slice(0,6);
  var weak=(rec.weakTypes||[]).slice(0,3);

  var h='<div style="padding:0 0 26px">';
  /* 커버 */
  h+='<div style="background:linear-gradient(160deg,#0d2240,#1d4e89);border-radius:20px;padding:20px 18px;color:#fff;margin-bottom:12px">'
    +'<div style="font-size:10.5px;font-weight:900;letter-spacing:.16em;color:#9fb6d6">LUMEN MATH · 기출 모의</div>'
    +'<div style="font-size:19px;font-weight:900;line-height:1.4;margin-top:5px">'+esc(rec.customTitle||'성적표')+'</div>'
    +'<div style="font-size:11.5px;color:#aebfd8;margin-top:3px">'+esc(rec.school||'')+' '+esc(rec.grade||'')
      +(rec.examDate?' · 응시 '+esc(rec.examDate):'')+'</div>'
    +'<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:16px">'
    +'<div><div style="font-size:16px;font-weight:900">'+esc(rec.studentName||'')+'</div>'
    +'<div style="font-size:11px;color:#aebfd8">'+esc(rec.grade||'')+'</div></div>'
    +'<div style="text-align:right;font-variant-numeric:tabular-nums"><span style="font-size:56px;font-weight:900;line-height:.95">'+(score!=null?score:'-')+'</span>'
    +'<span style="font-size:13px;color:#aebfd8;font-weight:600"> / 100점</span></div></div>';
  if(rec.academyRank) h+='<div style="display:flex;gap:6px;margin-top:14px;flex-wrap:wrap">'
    +'<span style="background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:50px;padding:5px 12px;font-size:11.5px;font-weight:700">🏆 학원 <b>'+esc(rec.academyRank)+'등</b> / '+esc(rec.academyTotal||'')+'명</span>'
    +(rec.academyMean?'<span style="background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);border-radius:50px;padding:5px 12px;font-size:11.5px;font-weight:700">학원 평균 '+esc(rec.academyMean)+'점</span>':'')
    +'</div>';
  h+='</div>';
  /* 3지표 */
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
    +'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:12px 6px;text-align:center">'
    +'<div style="font-size:10.5px;font-weight:800;color:#64748b">학교 추정 등수</div>'
    +'<div style="font-size:19px;font-weight:900;color:#1d4e89;font-variant-numeric:tabular-nums;line-height:1.2">'+(rank?('약 '+rank+'등'):'—')+'</div>'
    +'<div style="font-size:10px;color:#94a3b8">'+(!isNaN(totalN)?totalN+'명 중':'분포 없음')+'</div></div>'
    +'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:12px 6px;text-align:center">'
    +'<div style="font-size:10.5px;font-weight:800;color:#64748b">성취도</div>'
    +'<div style="font-size:19px;font-weight:900;color:#0f8a4e;line-height:1.2">'+(ach||'—')+'</div>'
    +'<div style="font-size:10px;color:#94a3b8">'+(myBand?({A:'90점↑',B:'80~89',C:'70~79',D:'60~69',E:'60점↓'})[myBand]:'')+'</div></div>'
    +'<div style="background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:12px 6px;text-align:center">'
    +'<div style="font-size:10.5px;font-weight:800;color:#64748b">5등급제</div>'
    +'<div style="font-size:19px;font-weight:900;color:#1d4e89;line-height:1.2">'+(g5?g5+'등급':'—')+'</div>'
    +'<div style="font-size:10px;color:#94a3b8">'+(topPct!=null?'상위 '+topPct+'%':'')+'</div></div>'
    +'</div>';
  /* 학교 안에서 어디쯤 */
  if(hasDist){
    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:16px 16px 14px;margin-bottom:12px">'
      +'<div style="font-size:14.5px;font-weight:900;color:#0d2240;margin-bottom:12px">학교 안에서 어디쯤일까</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:#e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:16px">'
      +'<div style="background:#fff;padding:10px 4px;text-align:center"><div style="font-size:10px;font-weight:700;color:#64748b">내 점수</div><div style="font-size:16px;font-weight:900;color:#dc2626;font-variant-numeric:tabular-nums">'+score+'</div></div>'
      +'<div style="background:#fff;padding:10px 4px;text-align:center"><div style="font-size:10px;font-weight:700;color:#64748b">학교 평균</div><div style="font-size:16px;font-weight:900;font-variant-numeric:tabular-nums">'+mean+'</div></div>'
      +'<div style="background:#fff;padding:10px 4px;text-align:center"><div style="font-size:10px;font-weight:700;color:#64748b">표준편차</div><div style="font-size:16px;font-weight:900;font-variant-numeric:tabular-nums">'+sd+'</div></div>'
      +'</div>';
    /* 백분위 바 */
    var pos=Math.max(2,Math.min(98,topPct!=null?topPct:50));
    h+='<div style="display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-bottom:9px">'
      +'<span style="font-size:17px;font-weight:900;color:#1d4e89;font-variant-numeric:tabular-nums">상위 '+(topPct!=null?topPct:'-')+'%</span>'
      +(rank?'<span style="font-size:12px;color:#64748b;font-weight:700">약 '+rank+'등 / '+totalN+'명</span>':'')
      +'<span style="margin-left:auto;font-size:11px;color:#94a3b8;font-weight:700;font-variant-numeric:tabular-nums">Z = '+(z>0?'+':'')+(Math.round(z*100)/100)+'</span></div>'
      +'<div style="position:relative;height:20px;border-radius:50px;background:linear-gradient(90deg,#1D4E9C 0%,#4E86C9 18%,#9FBBD8 38%,#D8CFC0 58%,#E2A46B 78%,#D45A46 100%)">'
      +'<div style="position:absolute;top:-9px;left:'+pos+'%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;z-index:2">'
      +'<span style="background:#0f172a;color:#fff;font-size:10px;font-weight:800;padding:2px 8px;border-radius:6px;white-space:nowrap">'+esc(rec.studentName||'나')+'</span>'
      +'<span style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:6px solid #0f172a"></span>'
      +'<span style="width:12px;height:12px;border-radius:50%;background:#fff;border:3.5px solid #0f172a;margin-top:1px"></span></div></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-top:7px;font-variant-numeric:tabular-nums"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>'
      +'<div style="display:flex;justify-content:space-between;font-size:10.5px;color:#64748b;font-weight:700;margin-top:1px"><span>← 잘함</span><span>노력 필요 →</span></div>';
    /* 5등급제 블록 */
    if(g5){
      var g5b=[{n:1,p:10,c:'#2F9E63'},{n:2,p:24,c:'#2C5FA8'},{n:3,p:32,c:'#B97F1C'},{n:4,p:24,c:'#C4703A'},{n:5,p:10,c:'#D64545'}];
      h+='<div style="display:flex;height:42px;border-radius:12px;overflow:hidden;margin-top:16px">';
      g5b.forEach(function(b){
        h+='<div style="flex:'+b.p+';background:'+b.c+';display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:1px'
          +(b.n===g5?';outline:3px solid #0f172a;outline-offset:-3px':'')+'">'
          +'<span style="font-size:14px;font-weight:900;line-height:1">'+b.n+'</span>'
          +'<span style="font-size:9px;font-weight:700;opacity:.9">'+b.p+'%</span></div>';
      });
      h+='</div><div style="text-align:center;font-size:11.5px;font-weight:800;color:#0d2240;margin-top:8px">고교 내신 5등급제 기준 — <b style="color:#1d4e89">'+g5+'등급</b> 구간</div>';
    }
    h+='</div>';
  }
  /* 학교 성취도 분포 */
  if(dist.length){
    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:16px;margin-bottom:12px">'
      +'<div style="display:flex;align-items:baseline;margin-bottom:11px"><span style="font-size:14.5px;font-weight:900;color:#0d2240">학교 성취도 분포</span>'
      +'<span style="margin-left:auto;font-size:10.5px;color:#94a3b8;font-weight:700">학교알리미 공시</span></div>';
    dist.forEach(function(x){
      var mine=(x.k===myBand);
      h+='<div style="display:grid;grid-template-columns:54px 1fr 44px;align-items:center;gap:9px;padding:'+(mine?'6px 8px':'5px 0')+';'
        +(mine?'background:#f1f5f9;border-radius:10px;margin:2px -8px':'')+'">'
        +'<span style="font-size:12px;font-weight:800">'+x.k+'<span style="display:block;font-size:9.5px;font-weight:600;color:#94a3b8">'+x.lab+'</span></span>'
        +'<span style="height:15px;background:'+(mine?'#fff':'#f1f5f9')+';border-radius:6px;overflow:hidden;display:block">'
        +'<span style="display:flex;align-items:center;justify-content:flex-end;height:100%;width:'+(maxD?Math.max(8,Math.round(x.v/maxD*100)):0)+'%;background:'+x.c+';border-radius:6px;padding-right:6px;font-size:9px;font-weight:800;color:#fff">'+x.v+'%</span></span>'
        +(mine?'<span style="font-size:10.5px;font-weight:900;color:#dc2626;text-align:right">★ 나</span>'
              :'<span style="font-size:11px;font-weight:800;color:#94a3b8;text-align:right;font-variant-numeric:tabular-nums">'+x.v+'%</span>')
        +'</div>';
    });
    h+='</div>';
  }
  /* 단원별 */
  if(units.length){
    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:16px;margin-bottom:12px">'
      +'<div style="font-size:14.5px;font-weight:900;color:#0d2240;margin-bottom:11px">단원별 정답률</div>';
    units.forEach(function(u){
      var r=Math.round(u.rate!=null?u.rate:0);
      h+='<div style="display:grid;grid-template-columns:1fr 90px 42px;align-items:center;gap:9px;padding:5px 0">'
        +'<span style="font-size:12.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(u.name||'')+'</span>'
        +'<span style="height:11px;background:#f1f5f9;border-radius:50px;overflow:hidden;display:block"><span style="display:block;height:100%;width:'+r+'%;background:'+(r>=80?'#10b981':(r>=60?'#d97706':'#dc2626'))+';border-radius:50px"></span></span>'
        +'<span style="font-size:11.5px;font-weight:900;color:#64748b;text-align:right;font-variant-numeric:tabular-nums">'+r+'%</span></div>';
    });
    h+='</div>';
  }
  /* 문항별 O/X */
  if(per.length){
    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:16px;margin-bottom:12px">'
      +'<div style="display:flex;align-items:baseline;margin-bottom:11px"><span style="font-size:14.5px;font-weight:900;color:#0d2240">문항별 결과</span>'
      +'<span style="margin-left:auto;font-size:10.5px;color:#94a3b8;font-weight:700">빨강 = 틀린 문항</span></div>'
      +'<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';
    per.forEach(function(p){
      var bg,fg,lab;
      if(p.essay){ bg='#fef3c7'; fg='#b45309'; lab='✍'; }
      else if(p.r==='O'){ bg='#ecfdf5'; fg='#0f8a4e'; lab='O'; }
      else if(p.r==='X'||p.r==='?'){ bg='#fef2f2'; fg='#dc2626'; lab='X'; }
      else { bg='#f1f5f9'; fg='#94a3b8'; lab='–'; }
      h+='<div style="aspect-ratio:1/1.1;border-radius:11px;background:'+bg+';color:'+fg+';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px'
        +((p.r==='X'||p.r==='?')&&!p.essay?';outline:2px solid #dc2626;outline-offset:-2px':'')+'">'
        +'<span style="font-size:10px;font-weight:700;opacity:.65">'+p.seq+'</span>'
        +'<span style="font-size:17px;font-weight:900;line-height:1">'+lab+'</span></div>';
    });
    h+='</div><div style="display:flex;gap:13px;margin-top:10px;font-size:11px;color:#64748b">'
      +'<span><b style="color:#0f8a4e">O</b> 정답 '+okN+'</span><span><b style="color:#dc2626">X</b> 오답 '+xN+'</span>'
      +(eN?'<span><b style="color:#b45309">✍</b> 서술형 '+eN+'</span>':'')+'</div></div>';
  }
  /* 보완할 유형 */
  if(weak.length){
    h+='<div style="background:#fff;border:1.5px solid #fecaca;border-radius:17px;padding:16px;margin-bottom:12px">'
      +'<div style="font-size:14.5px;font-weight:900;color:#dc2626;margin-bottom:9px">보완할 유형</div>';
    weak.forEach(function(w){
      h+='<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9">'
        +'<span style="flex:1;min-width:0;font-size:12.5px;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(w.name||w)+'</span>'
        +(w.rate!=null?'<span style="font-size:11px;font-weight:900;color:#dc2626;flex:none">'+Math.round(w.rate)+'%</span>':'')+'</div>';
    });
    h+='</div>';
  }
  h+='<div style="text-align:center;font-size:10.5px;color:#94a3b8;line-height:1.8;padding-top:6px">'
    +'<b style="color:#0d2240;font-size:12px">루멘수학</b><br>'
    +'기출 모의 성적 추정 리포트 · 학교(실제) 성적이 아닌 기출 모의 기준 추정치입니다</div>';
  return h+'</div>';
}
