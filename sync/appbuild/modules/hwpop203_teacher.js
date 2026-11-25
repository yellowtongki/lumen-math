/* ═════════════════════════════════════════════════════════════════
 * v19-203: 숙제체크 세부 창이 오른쪽에서 잘리던 것 고침 (원장 2026-11-25 「우측 화면이 짤린다」 — 맨 오른쪽 날짜 칸을 누를 때)
 *  바탕 hwcPosPop 은 왼쪽 끝을 «표 전체 폭(scrollWidth)» 안으로만 맞춰서, 표가 옆으로 길면 창이 보이는 영역 밖으로 나갔다.
 *  → 지금 보이는 영역(scrollLeft ~ scrollLeft+clientWidth) 안으로 맞춘다. 창이 보이는 폭보다 넓으면 폭을 줄인다.
 *    칸 아래가 모자라면 위로 뒤집는 것은 그대로(보이는 높이 기준으로 바꿈).
 * ═════════════════════════════════════════════════════════════════ */
hwcPosPop = function(){
  var pop=document.getElementById('hwc-pop'); if(!pop) return;
  var parts=String(HWC.pop||'').split('|');
  var cell=document.getElementById('hwc-c-'+parts[0]+'-'+parts[1]);
  var wrap=document.getElementById('hwc-wrap');
  if(!cell||!wrap){ pop.style.visibility='hidden'; return; }
  var vw=wrap.clientWidth, vh=wrap.clientHeight;
  pop.style.maxWidth=Math.max(240, vw-12)+'px';
  var cr=cell.getBoundingClientRect(), wr=wrap.getBoundingClientRect();
  var pw=pop.offsetWidth, ph=pop.offsetHeight;
  var x0=wrap.scrollLeft, y0=wrap.scrollTop;
  var left=cr.left-wr.left+x0-Math.round(pw/2)+15;
  var minL=x0+6, maxL=x0+vw-pw-6;
  if(left>maxL) left=maxL; if(left<minL) left=minL;
  var top=cr.top-wr.top+y0+36;
  if(top+ph>y0+vh-4 && cr.top-wr.top-ph-6>=0) top=cr.top-wr.top+y0-ph-6;
  if(top+ph>wrap.scrollHeight-4) top=Math.max(4, cr.top-wr.top+y0-ph-6);
  pop.style.left=Math.round(left)+'px'; pop.style.top=Math.round(top)+'px'; pop.style.visibility='visible';
};
