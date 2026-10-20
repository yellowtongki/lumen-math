/* 인쇄 창 — 팝업 차단을 피하려고 «먼저» 열고 나중에 채운다 */
function eaOpenWin(){
  var w=window.open('','_blank');
  if(!w){ alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도해 주세요.'); return null; }
  w.document.open(); w.document.write('<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>만드는 중…</title></head><body style="font-family:sans-serif;padding:40px;color:#333">🎯 시험 대비 분석을 만드는 중입니다… (해설집 본문과 교재 기록을 읽습니다)</body></html>'); w.document.close();
  return w;
}
function eaFillWin(w, list, meta){
  var body='', names=[];
  list.forEach(function(x){ var m2={}; for(var k in meta) m2[k]=meta[k]; m2.tbTitle=x.tbTitle||''; body+=eaBooklet(x.stu, x.A, x.picked, m2); names.push(String((x.stu&&x.stu.name)||'')); });
  var styles='';
  try{ var anyBody=null; Object.keys(EA.bodies).forEach(function(k){ if(!anyBody) anyBody=EA.bodies[k]; }); styles=((anyBody&&anyBody.head)||'').match(/<style[\s\S]*?<\/style>/g); styles=styles?styles.join('\n'):''; }catch(e){ styles=''; }
  /* data-theme="light" — 해설집 CSS 는 어두운 화면 설정이면 색을 뒤집는다. 종이는 흰색으로 못 박는다 */
  var html='<!DOCTYPE html><html lang="ko" data-theme="light"><head><meta charset="UTF-8">'
    +'<title>🎯 시험 대비 — '+eaEsc(names.join(', ')).slice(0,80)+'</title>'
    +styles+'<style>'+LC_CSS+LC_TEX_CSS+EA_CSS+'</style><script>'+EA_FIT_JS+'<\/script></head><body>'
    +'<div class="bar"><b>🎯 시험 대비 · '+list.length+'명</b><span>'+eaEsc(names.join(' · '))+'</span><button onclick="window.print()">🖨️ 인쇄</button></div>'
    +body+'</body></html>';
  w.document.open(); w.document.write(html); w.document.close();
}
