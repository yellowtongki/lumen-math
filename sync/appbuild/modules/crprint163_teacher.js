/* ═══════════════════════════════════════════════════════════════════
 * v19-163: 📋 상담 리포트 인쇄 여백 줄이기 (원장 10/26 「상담 리포트를 출력했을 때 여백이 너무 많다」)
 *   [원인] A4 인쇄 폭(약 720px)이 화면용 «820px 아래면 한 줄» 규칙에 걸려 그래프가 모두 한 칸씩 크게 나오고,
 *          큰 카드(숙제 흐름)를 페이지 중간에서 못 자르게 막아 첫 장 대부분이 비었다 → A4 9장.
 *   [고침] 인쇄 창 전용 배치: 두 칸 그리드 유지 · 과정별 시험 세 칸 · 글자·간격·카드 안쪽 여백 줄임 · 위아래 8mm ·
 *          큰 «숙제 흐름» 상자는 페이지에 걸치면 나뉘어도 되게(안의 그래프 하나하나는 안 잘림).
 *   ※ 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var CR_PRINT_CSS = '@page{size:A4;margin:8mm 8mm 9mm}'
  + 'body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
  + '.cr{max-width:none;gap:7px;font-size:11.5px;line-height:1.45}'
  + '.cr-sum,.cr-sum[class]{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px}'
  + '.cr-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px}'
  + '.cr-plan{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px}'
  + '.cr-tps{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px}'
  + '.cr-cls{grid-template-columns:repeat(10,minmax(0,1fr))!important;gap:3px}'
  + '.cr-top{padding:8px 12px;border-radius:7px}.cr-top h1{font-size:18px;margin:0}.cr-top .br{font-size:9.5px}.cr-top .wh{font-size:10.5px}'
  + '.cr-sum div{padding:5px 9px;font-size:11px;border-radius:7px}.cr-sum b{font-size:17px}'
  + '.cr-focus{padding:8px 10px;gap:6px;border-radius:9px}.cr-focus h2{font-size:15px}'
  + '.cr h3{font-size:12.5px;margin:0 0 1px}.cr-take{font-size:10.5px;margin:0 0 2px}'
  + '.cr-card{padding:6px 9px 4px;border-radius:8px}.cr-tp{padding:4px 6px}.cr-tp-h{font-size:10.5px}.cr-tp-h b{font-size:13px}'
  + '.cr-big{gap:10px;margin-bottom:3px}.cr-big b{font-size:20px}.cr-big span{font-size:10.5px}'
  + '.cr-cd{padding:2px 1px;border-width:1.5px;border-radius:6px}.cr-cd .d{font-size:9.5px}.cr-cd .m{font-size:13px;line-height:1.2}.cr-cd .n{font-size:9px;min-height:11px}.cr-cd .rp{font-size:8.5px}'
  + '.cr-legend{font-size:9.5px;gap:8px;margin-top:2px}.cr-legend i{width:9px;height:9px}'
  + '.cr-plan ol,.cr-plan ul{font-size:11.5px;margin:2px 0 0;padding-left:18px}.cr-plan li{margin-bottom:1px}'
  + '.cr-note{font-size:10.5px;padding:3px 0}.cr-foot{font-size:9.5px}'
  + '.cr-card,.cr-tp,.cr-focus>div,.cr-sum,.cr-top{break-inside:avoid}.cr-focus{break-inside:auto}';
window.crPrint = function(){
  var X = null; try { X = crCompute(); } catch(e){} if (!X) return;
  var w = window.open('', '_blank'); if (!w){ try { plToast('⚠ 팝업이 막혔습니다 — 브라우저에서 팝업을 허용해 주세요'); } catch(e){} return; }
  w.document.open();
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + crE(X.st.name) + ' 상담 리포트 ' + crE(X.to) + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap"><style>'
    + CR_CSS + CR_PRINT_CSS + '</style></head><body>' + crReport(X, 'print') + '</body></html>');
  w.document.close(); setTimeout(function(){ try { w.focus(); w.print(); } catch(e){} }, 900);
};
