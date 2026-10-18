/* ═════════════════════════════════════════════════════════════════
 * v19-136: 🗺 시청 지도 2판 — 세로 = 영상(단원별) · 가로 = 학생
 *   (원장 2026-10-18 「시청지도가 가로로 쭈욱 되어있어서 보기힘들다.
 *    왼쪽 폴더별로 눌렀을 때 한눈에 볼 수 있는것이 나을까?」 → 시안을 보고 「이대로 v19-136 만들어」)
 *
 *  v19-135 의 지도는 줄 = 학생, 칸 = 영상이라 영상 30개 폴더에서는 옆으로 한없이 길었다.
 *  이번 판은 표를 세워서:
 *   ① 맨 위 «학생 띠» — 학생마다 완료 n / 배정 m 막대 · 다시 봄 r(두 번 이상 본 영상 수) · 마지막 시청 날짜시각.
 *   ② 표 — 줄 = 영상(폴더의 단원 순서대로 묶음, 단원 없는 영상은 맨 끝 「미분류」 — 강의 관리와 같은 묶음),
 *           칸 = 학생(이 화면 영상 중 하나라도 배정된 학생만), 맨 끝 칸 = 그 영상 평균 %.
 *      단원 줄 「▾ 단원명 · N강 … 단원 평균 xx%」 — 누르면 접힘/펼침(이 화면을 연 동안만 기억, 처음엔 모두 펼침).
 *      영상 제목 아래 「📅 내준 날짜」(이 화면 학생 중 가장 먼저 내준 날) · 「⏰ 마감」(지났는데 다 못 본 학생이 있으면 빨간 «지남»).
 *      칸 뜻은 v19-135 그대로 — 색 = 얼마나 봤나, 숫자 = 본 횟수, 빨간 테두리 = 마감 지남·미완료, ↻ = 두 번 이상, · = 배정 안 됨.
 *   ③ 칸을 누르면 오른쪽에 v19-135 회차 창 그대로(좁으면 표 아래로 내려오고 그 자리로 화면이 따라간다).
 *   ④ 묶음 고르기도 그대로 — 묶음을 고르면 그 묶음의 영상(같은 단원 묶음)·학생만.
 *  저장 키·묶음 배정·회차 창은 v19-135(modules/vod135_teacher.js) 것을 그대로 쓰고, 지도 그리는 함수(vod5Map)만 바꾼다.
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═════════════════════════════════════════════════════════════════ */
var VOD6 = { fold:{} };   /* 접힌 단원 {'폴더id|단원id':true} — 저장하지 않음(처음엔 모두 펼침) */

/* 다시 그려도 표·지도 스크롤 자리를 지킨다 (긴 폴더에서 칸을 눌렀을 때 맨 위로 튀지 않게) */
function vod6Rerender(follow){
  var m=document.getElementById('vod5-map'), t=document.getElementById('vod6-tbl');
  var mt=m?m.scrollTop:0, tt=t?t.scrollTop:0, tl=t?t.scrollLeft:0;
  render();
  try{
    m=document.getElementById('vod5-map'); t=document.getElementById('vod6-tbl');
    if(m) m.scrollTop=mt;
    if(t){ t.scrollTop=tt; t.scrollLeft=tl; }
    /* 좁은 화면에서 회차 창이 표 아래로 내려갔으면, 창 윗부분이 화면 40% 자리에 오도록 내려 준다(표도 위에 조금 남게) */
    if(follow && m){
      var d=document.getElementById('vod6-side'), mn=document.getElementById('vod6-main');
      if(d && mn && d.getBoundingClientRect().top>=mn.getBoundingClientRect().bottom-2){
        var mr=m.getBoundingClientRect(), dr=d.getBoundingClientRect(), want=mr.top+mr.height*0.4;
        if(dr.top>mr.top+mr.height*0.55 || dr.top<mr.top) m.scrollTop+= (dr.top-want);
      }
    }
  }catch(e){}
}
function vod6Fold(k){ VOD6.fold[k]=!VOD6.fold[k]; vod6Rerender(false); }
vod5Open=function(vid, code){
  if(VOD5.open && VOD5.open.vid===vid && VOD5.open.code===code) VOD5.open=null;
  else VOD5.open={ vid:vid, code:code };
  vod6Rerender(!!VOD5.open);
};
vod5Close=function(){ VOD5.open=null; vod6Rerender(false); };

/* 이 화면 영상을 단원별로 묶는다 — 강의 관리(vodGroupedVideos)와 같은 순서 · 미분류 맨 끝 */
function vod6Groups(S){
  var want={}; S.vids.forEach(function(id){ want[id]=1; });
  var fids=[], seen={};
  S.vids.forEach(function(id){ var v=vodVideoById(id); var fid=v?v.folderId:''; if(!seen[fid]){ seen[fid]=1; fids.push(fid); } });
  var multi=fids.length>1, out=[];
  fids.forEach(function(fid){
    var f=vodFolderById(fid);
    vodGroupedVideos(fid).forEach(function(g){
      var vs=g.videos.filter(function(v){ return want[v.id]; }).map(function(v){ return v.id; });
      if(!vs.length) return;
      out.push({ key:fid+'|'+(g.uid||''), uid:g.uid||'', name:(multi&&f?f.name+' › ':'')+g.name, vids:vs });
    });
  });
  return out;
}
/* 영상의 «내준 날짜» = 이 화면 학생 중 가장 먼저 내준 시각 */
function vod6GivenFirst(vid, codes, S){
  var best='', bm=0;
  codes.forEach(function(c){ if(!S.assigned(vid,c)) return; var g=vod5GivenAt(vid,c), t=vod5Ms(g); if(t && (!bm || t<bm)){ bm=t; best=g; } });
  return best;
}
function vod6DateOnly(iso){ var w=vod5When(iso); return w?w.replace(/ \d\d:\d\d$/,''):''; }

/* 지도에 놓을 영상·학생 — 폴더 = 그 폴더 영상 전부(배정 없는 영상도 «·» 줄로) · 묶음 = 그 묶음 영상·학생 */
function vod6Src(){
  var S=vod5Src();
  if(!S.b){
    var fid=vodDefaultFolder();
    S.vids=vodVideosOf(fid).map(function(v){ return v.id; });
  }
  return S;
}

vod5Map=function(){
  var h='<div id="vod5-map" style="flex:1;overflow:auto;padding:14px">';
  if(VOD_LOGS===null) return h+'<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">시청 기록 불러오는 중…</div></div>';
  var fid=vodDefaultFolder(), f=vodFolderById(fid);
  var B=vod5BundlesSorted();
  var S=vod6Src();
  /* 고르기: 폴더 전체 / 묶음 (최근 먼저) — v19-135 그대로 */
  h+='<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">'
    +'<span style="font-size:12px;font-weight:800;color:#64748b">보기</span>'
    +'<select id="vod5-sel" onchange="vod5Pick(this.value)" style="max-width:100%;min-width:0;border:1.5px solid #cbd5e1;border-radius:9px;padding:7px 10px;font-size:12.5px;font-weight:700;font-family:inherit;color:#0d2240;background:#fff">'
    +'<option value=""'+(S.b?'':' selected')+'>📁 '+vodEsc(f?f.name:'폴더')+' — 폴더 전체 (왼쪽에서 폴더 고르기)</option>';
  B.forEach(function(b){
    h+='<option value="'+vodEsc(b.id)+'"'+(S.b&&S.b.id===b.id?' selected':'')+'>📦 '+vodEsc(b.name)+' · '+vodEsc(vod5When(b.at)||'날짜 없음')+' 내줌 · 영상 '+b.vids.length+' · 학생 '+b.codes.length+'</option>';
  });
  h+='</select>';
  if(!B.length) h+='<span style="font-size:10.5px;color:#94a3b8">묶음은 강의 관리 → 영상 체크 → 「📤 일괄 배정」 → 「📦 묶음으로 내주기」로 만듭니다</span>';
  h+='</div>';
  if(S.b){
    var bd=S.b;
    h+='<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;background:#fff;border:1px solid #e2e8f0;border-left:4px solid #10b981;border-radius:10px;padding:9px 13px;margin-bottom:10px;font-size:12px;color:#334155">'
      +'<b style="color:#0d2240;font-size:13px">📦 '+vodEsc(bd.name)+'</b>'
      +'<span>📤 내준 날짜 <b>'+vodEsc(vod5When(bd.at)||'—')+'</b></span>'
      +'<span>🗓 마감 <b>'+(bd.due?vodEsc(vod5Day(bd.due)):'없음')+'</b></span>'
      +'<span>영상 '+bd.vids.length+'개 · 학생 '+bd.codes.length+'명</span></div>';
  }
  /* 학생 = 이 화면 영상 중 하나라도 배정된 학생 (앱의 보통 순서) */
  var all=[]; try{ all=(typeof getSortedStudents==='function')?(getSortedStudents(true)||[]):[]; }catch(e){ all=[]; }
  var stu={}, rank={}; all.forEach(function(s,i){ if(s&&s.lumen_rec_code){ stu[s.lumen_rec_code]=s; rank[s.lumen_rec_code]=i; } });
  var codes=S.codes.filter(function(c){ for(var i=0;i<S.vids.length;i++){ if(S.assigned(S.vids[i],c)) return true; } return false; });
  codes.sort(function(a,b){ var ra=(a in rank)?rank[a]:1e9, rb=(b in rank)?rank[b]:1e9; return ra!==rb?ra-rb:(a<b?-1:(a>b?1:0)); });
  if(!S.vids.length || !codes.length){
    h+='<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">'
      +(S.b?'이 묶음에 남은 영상·학생이 없습니다.':('📁 '+vodEsc(f?f.name:'')+' — 이 폴더에 배정된 영상이 없습니다.<br><span style="font-size:11px">왼쪽에서 다른 폴더를 고르거나 위에서 묶음을 고르세요.</span>'))+'</div></div>';
    return h;
  }
  /* 칸 계산 한 번에 */
  var cell={};
  S.vids.forEach(function(vid){ codes.forEach(function(c){
    if(!S.assigned(vid,c)){ cell[vid+'|'+c]={ na:true, info:vod5Info(vid,c,'') }; return; }
    cell[vid+'|'+c]={ info:vod5Info(vid, c, S.due(vid)) };
  }); });
  var groups=vod6Groups(S);
  /* 학생 띠 숫자 */
  var tot=0, totN=0;
  var strip=codes.map(function(c){
    var asg=0, done=0, re=0, last='', lm=0;
    S.vids.forEach(function(vid){
      var x=cell[vid+'|'+c]; if(x.na) return;
      var i=x.info; asg++; if(i.done) done++; if(i.n>=2) re++;
      tot+=i.pct; totN++;
      var t=vod5Ms(i.last); if(i.last && t>=lm){ lm=t; last=i.last; }
    });
    return { c:c, asg:asg, done:done, re:re, last:last };
  });
  var avgAll=totN?Math.round(tot/totN):0;
  var title=S.b?('📦 '+S.b.name):((f?f.name:'폴더'));
  h+='<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">';
  h+='<div id="vod6-main" style="flex:1 1 360px;min-width:0;max-width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">';
  /* 머리줄 */
  h+='<div id="vod6-head" style="display:flex;align-items:center;justify-content:space-between;gap:6px 12px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #e2e8f0">'
    +'<div style="font-size:14px;font-weight:900;color:#0d2240;min-width:0">'+vodEsc(title)
    +' <span style="font-size:11.5px;font-weight:600;color:#64748b">· 영상 '+S.vids.length+' · 배정 '+codes.length+'명 · 평균 완료율 <b style="color:#0d2240">'+avgAll+'%</b></span></div>'
    +'<span style="font-size:10.5px;color:#94a3b8">단원 이름을 누르면 접힙니다 · 칸을 누르면 회차 기록</span></div>';
  /* ① 학생 띠 */
  h+='<div id="vod6-strip" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px;padding:10px 14px;border-bottom:1px solid #e2e8f0">';
  strip.forEach(function(r){
    var st=stu[r.c]||vodStudentByCode(r.c); var nm=st?st.name:('(미등록 '+r.c+')'); var grp=st?(st.group||'미배정'):'—';
    var w=r.asg?Math.round(r.done/r.asg*100):0;
    h+='<div class="vod6-stu" data-code="'+vodEsc(r.c)+'" data-done="'+r.done+'" data-asg="'+r.asg+'" data-re="'+r.re+'" style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:grid;gap:3px;min-width:0">'
      +'<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b style="color:#0d2240;font-size:13px">'+vodEsc(nm)+'</b> <span style="color:#94a3b8;font-size:10.5px">'+vodEsc(grp)+'</span></div>'
      +'<div style="height:7px;border-radius:4px;background:#e2e8f0;overflow:hidden"><i style="display:block;height:100%;width:'+w+'%;background:#22c55e"></i></div>'
      +'<div style="display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:#64748b"><span class="vod6-dn">완료 <b style="color:#0d2240">'+r.done+'</b> / 배정 '+r.asg+'</span><span class="vod6-re" style="'+(r.re?'color:#6d28d9;font-weight:800':'')+'">다시 봄 '+r.re+'</span></div>'
      +'<div style="display:flex;justify-content:space-between;gap:6px;font-size:10.5px;color:#64748b"><span style="white-space:nowrap">마지막 시청</span><b class="vod6-last" style="color:#0d2240;white-space:nowrap">'+(r.last?vodEsc(vod5When(r.last)):'없음')+'</b></div>'
      +'</div>';
  });
  h+='</div>';
  /* ② 표: 줄 = 영상(단원별) · 칸 = 학생 · 끝 = 평균 */
  var today=vod5Today();
  var TH='position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:7px 6px;font-size:10.5px;color:#94a3b8;font-weight:800;';
  h+='<div id="vod6-tbl" style="overflow:auto;max-height:calc(100vh / var(--fz,1) - 230px);min-height:180px">';
  h+='<table id="vod5-grid" style="border-collapse:separate;border-spacing:0;font-size:11.5px;width:100%">';
  h+='<thead><tr><th style="'+TH+'left:0;z-index:4;text-align:left;padding-left:12px;min-width:150px">영상 · 내준 날짜 / 마감</th>';
  codes.forEach(function(c){
    var st=stu[c]||vodStudentByCode(c); var nm=st?st.name:('(미등록 '+c+')'); var grp=st?(st.group||'미배정'):'—';
    h+='<th class="vod6-colh" data-code="'+vodEsc(c)+'" style="'+TH+'z-index:3;text-align:center;min-width:50px"><b style="display:block;color:#0d2240;font-size:11.5px;white-space:nowrap">'+vodEsc(nm)+'</b><span style="font-weight:600;white-space:nowrap">'+vodEsc(grp)+'</span></th>';
  });
  h+='<th style="'+TH+'z-index:3;text-align:center;min-width:44px">평균</th></tr></thead><tbody>';
  var ncol=codes.length+2;
  groups.forEach(function(g){
    var up=0, un=0;
    g.vids.forEach(function(vid){ codes.forEach(function(c){ var x=cell[vid+'|'+c]; if(!x.na){ up+=x.info.pct; un++; } }); });
    var closed=!!VOD6.fold[g.key], isUn=(g.uid==='');
    h+='<tr class="vod6-unit" data-k="'+vodEsc(g.key)+'" data-avg="'+(un?Math.round(up/un):'')+'" onclick="vod6Fold(this.getAttribute(\'data-k\'))" style="cursor:pointer;user-select:none">'
      +'<td colspan="'+ncol+'" style="background:'+(isUn?'#fff7ed':'#eef2f8')+';padding:7px 12px;border-bottom:1px solid #e2e8f0;font-weight:900;font-size:12.5px;color:'+(isUn?'#9a3412':'#0d2240')+'">'
      +'<div class="vod6-uin" style="display:flex;align-items:center;gap:6px;position:sticky;left:12px;box-sizing:border-box">'
      +'<span style="display:inline-block;width:12px;color:#64748b">'+(closed?'▸':'▾')+'</span>'
      +'<span style="min-width:0">'+vodEsc(g.name)+' <span style="color:#64748b;font-weight:600">· '+g.vids.length+'강</span></span>'
      +'<span class="vod6-uavg" style="margin-left:auto;color:#64748b;font-weight:700;font-size:11px;white-space:nowrap">'+(un?('단원 평균 '+Math.round(up/un)+'%'):'배정 없음')+'</span></div></td></tr>';
    if(closed) return;
    g.vids.forEach(function(vid){
      var v=vodVideoById(vid), due=S.due(vid);
      var given=vod6GivenFirst(vid, codes, S);
      var anyAsg=false, allDone=true, rp=0, rn=0;
      codes.forEach(function(c){ var x=cell[vid+'|'+c]; if(x.na) return; anyAsg=true; if(!x.info.done) allDone=false; rp+=x.info.pct; rn++; });
      var late=!!(due && due<today && anyAsg && !allDone);
      h+='<tr class="vod6-v" data-vid="'+vodEsc(vid)+'">'
        +'<td class="vod6-t" style="position:sticky;left:0;z-index:1;background:#fff;padding:7px 10px 7px 12px;border-bottom:1px solid #f1f5f9;min-width:150px;max-width:300px">'
        +'<div style="font-weight:700;color:#0d2240;word-break:keep-all;overflow-wrap:anywhere">'+vodEsc((v&&v.title)||vid)+'</div>'
        +'<div style="display:flex;gap:4px 10px;flex-wrap:wrap;font-size:10.5px;color:#64748b;margin-top:1px">'
        +'<span class="vod6-given">📅 내준 날짜 '+(given?vodEsc(vod6DateOnly(given)):'<span style="color:#94a3b8">기록 없음</span>')+'</span>'
        +(due?'<span class="vod6-due" style="'+(late?'color:#dc2626;font-weight:800':'')+'">⏰ 마감 '+vodEsc(vod5Day(due))+(late?' 지남':'')+'</span>':'')
        +'</div></td>';
      codes.forEach(function(c){
        var x=cell[vid+'|'+c], i=x.info;
        var st=stu[c]||vodStudentByCode(c); var nm=st?st.name:('(미등록 '+c+')');
        var sel=!!(VOD5.open && VOD5.open.vid===vid && VOD5.open.code===c);
        if(x.na){
          h+='<td style="text-align:center;border-bottom:1px solid #f1f5f9;padding:4px"><div class="vod5-cell vod5-na" data-vid="'+vodEsc(vid)+'" data-code="'+vodEsc(c)+'"'+(i.all?' onclick="vod5Open(\''+vodEsc(vid)+'\',\''+vodEsc(c)+'\')"':'')+' title="'+vodEsc(nm)+' · 배정 안 됨'+(i.all?' (그래도 '+i.n+'회 봄)':'')+'" style="width:36px;height:28px;margin:auto;display:flex;align-items:center;justify-content:center;color:#cbd5e1;font-size:13px;box-sizing:border-box;'+(i.all?'cursor:pointer;border:1px dashed #cbd5e1;border-radius:6px':'')+(sel?';box-shadow:0 0 0 2px #0d2240':'')+'">'+(i.n?i.n:'·')+'</div></td>';
          return;
        }
        var col=vod5Col(i.pct, i.th, i.all>0);
        var gv=vod5GivenAt(vid, c);
        var tip=nm+' · '+((v&&v.title)||'')
          +'\n내준 날짜: '+(gv?vod5When(gv):'기록 없음(v19-135 이전)')
          +'\n마감: '+(due?vod5Day(due):'없음')+(i.late?' (지남)':'')
          +'\n마지막 시청: '+(i.last?vod5When(i.last):'아직 안 봄')
          +'\n진도 '+i.pct+'% · 본 횟수 '+i.n+'회'+(i.all>i.n?' (+잠깐 열어봄 '+(i.all-i.n)+')':'');
        h+='<td style="text-align:center;border-bottom:1px solid #f1f5f9;padding:4px">'
          +'<div class="vod5-cell" data-vid="'+vodEsc(vid)+'" data-code="'+vodEsc(c)+'" data-n="'+i.n+'" data-pct="'+i.pct+'" data-late="'+(i.late?1:0)+'" data-re="'+(i.n>=2?1:0)+'" onclick="vod5Open(\''+vodEsc(vid)+'\',\''+vodEsc(c)+'\')" title="'+vodEsc(tip)+'"'
          +' style="position:relative;width:38px;height:28px;margin:auto;border-radius:6px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:900;font-size:12.5px;background:'+col.bg+';color:'+col.fg+';border:2px solid '+(i.late?'#dc2626':'transparent')+(sel?';box-shadow:0 0 0 2px #0d2240':'')+'">'
          +(i.n?i.n:'')
          +(i.n>=2?'<span class="vod5-re" style="position:absolute;top:-7px;right:-7px;background:#7c3aed;color:#fff;border-radius:50%;width:16px;height:16px;font-size:11px;line-height:16px;text-align:center;font-weight:900">↻</span>':'')
          +'</div></td>';
      });
      var ra=rn?Math.round(rp/rn):-1;
      h+='<td class="vod6-ravg" style="text-align:center;border-bottom:1px solid #f1f5f9;font-weight:800;font-size:11px;color:'+(ra>=90?'#15803d':(ra>=50?'#1d4ed8':'#94a3b8'))+'">'+(rn?ra+'%':'')+'</td></tr>';
    });
  });
  h+='</tbody></table></div>';
  /* 범례 */
  function sw(bg, extra){ return '<span style="display:inline-block;width:14px;height:11px;border-radius:3px;background:'+bg+';vertical-align:-1px;margin-right:4px;'+(extra||'')+'"></span>'; }
  h+='<div id="vod5-legend" style="display:flex;gap:6px 12px;flex-wrap:wrap;padding:9px 12px;border-top:1px solid #e2e8f0;font-size:10.5px;color:#64748b">'
    +'<span>'+sw('#e2e8f0')+'안 봄</span><span>'+sw('#bfdbfe')+'1~49%</span><span>'+sw('#3b82f6')+'50%~</span><span>'+sw('#22c55e')+'완료(폴더 기준 %)</span>'
    +'<span><b style="color:#0d2240">숫자</b> = 본 횟수(회차 · '+VOD_SHORT_SEC+'초 미만은 안 셈)</span>'
    +'<span><span style="display:inline-block;width:12px;height:9px;border:2px solid #dc2626;border-radius:3px;vertical-align:-1px;margin-right:4px"></span>마감 지남 · 미완료</span>'
    +'<span><span style="display:inline-block;background:#7c3aed;color:#fff;border-radius:50%;width:13px;height:13px;font-size:8.5px;line-height:13px;text-align:center;margin-right:4px">↻</span>두 번 이상 봄</span>'
    +'<span>· = 배정 안 됨 · 칸을 누르면 회차별 기록</span></div>';
  h+='</div>';
  /* ③ 회차 창 (v19-135 그대로) */
  if(VOD5.open){
    var od=VOD5.open;
    h+='<div id="vod6-side" style="flex:1 0 290px;max-width:340px;min-width:0;position:sticky;top:0">'+vod5Detail(od.vid, od.code, S.assigned(od.vid,od.code)?S.due(od.vid):vodAssignOf(od.vid).due, stu)+'</div>';
  }
  h+='</div></div>';
  return h;
};

/* 학생이 많아 표가 옆으로 스크롤될 때도 단원 줄의 «단원 평균»이 보이는 칸 오른쪽 끝에 오게 — 그린 뒤 폭을 맞춘다 */
function vod6FitUnits(){
  var t=document.getElementById('vod6-tbl'); if(!t) return;
  var w=t.clientWidth-24; if(w<120) return;
  var us=t.querySelectorAll('.vod6-uin');
  for(var i=0;i<us.length;i++) us[i].style.width=w+'px';
}
if(typeof vodMonitor==='function'){
  vodMonitor=(function(o){ return function(){
    var h=o.apply(this, arguments);
    if(VOD_MON_TAB==='map') setTimeout(function(){ try{ vod6FitUnits(); }catch(e){} }, 0);
    return h;
  }; })(vodMonitor);
}
