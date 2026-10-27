/* ═══════════════════════════════════════════════════════════════════
 * v19-150: 💡 IB아하 리그 등급 — 한 번 오른 등급은 시즌 동안 내려가지 않게 (원장 2026-10-22 「예전 등급 유지되게 고쳐줘」)
 *  까닭: iblTierOf 는 설명에 «강등 없음»이라 적혀 있었지만 실제로는 지금 평균으로 매번 다시 셌다.
 *    10/22 밀린 초안 89건을 확정하자 낮은 점수가 평균에 들어가 1위 학생이 탐구자 → 질문자로 내려가 보였다.
 *  고침: lumen_store `aha_tier_best` = { season:'<시즌 시작일>', byCode:{ 코드:'knowledge'… }, updated }
 *    · 등급을 셀 때 «지금 계산» 과 «이번 시즌 가장 높았던 등급» 중 높은 것 (⚙ 리그 설정 «강등 있음»이면 예전처럼 지금 계산만)
 *    · 지금 계산이 더 높으면 기록을 올리고 잠시 뒤 서버에 저장(앱 켤 때 한 번 읽음). 시즌이 바뀌면 새로 시작.
 *  ※ 바탕 함수(iblTierOf)를 감싸기만 한다. 문자열 연결로만 쓴다.
 * ═══════════════════════════════════════════════════════════════════ */
var TK150 = { data:null, loading:false, dirty:false, t:0 };
var TK150_ORDER = { inquirer:0, knowledge:1, thinker:2, reflect:3 };
function tk150Season(cfg){ return String((cfg && cfg.seasonStart) || ''); }
function tk150Load(){
  if(TK150.data || TK150.loading) return;
  var sb=null; try{ sb=getSupaClient(); }catch(e){}
  if(!sb) return;
  TK150.loading=true;
  sb.from('lumen_store').select('key,value').eq('key','aha_tier_best').then(function(r){
    var v=(r && r.data && r.data[0]) ? r.data[0].value : null;
    if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }
    TK150.data=(v && v.byCode) ? v : { season:'', byCode:{} };
    TK150.loading=false;
    try{ if(VIEW==='aha' || VIEW==='league' || VIEW==='lgall') render(); }catch(e){}
  }, function(){ TK150.loading=false; TK150.data={ season:'', byCode:{} }; });
}
window.tk150Load=tk150Load;
function tk150Save(){
  clearTimeout(TK150.t);
  TK150.t=setTimeout(function(){
    if(!TK150.dirty || !TK150.data) return;
    var sb=null; try{ sb=getSupaClient(); }catch(e){}
    if(!sb) return;
    TK150.dirty=false;
    TK150.data.updated=new Date().toISOString();
    sb.from('lumen_store').upsert({ key:'aha_tier_best', value:TK150.data }, { onConflict:'key' }).then(function(){}, function(){ TK150.dirty=true; });
  }, 1500);
}
iblTierOf=(function(o){ return function(row, cfg){
  var now=o.apply(this, arguments);
  try{
    if(cfg && (cfg.demote===true || cfg.demote==='true')) return now;   /* 원장이 «강등 있음»을 고른 경우 */
    if(!TK150.data){ tk150Load(); return now; }
    var code=row && row.code; if(!code) return now;
    var season=tk150Season(cfg);
    if(TK150.data.season!==season){ TK150.data={ season:season, byCode:{} }; TK150.dirty=true; }
    var best=TK150.data.byCode[code];
    if(best && (TK150_ORDER[best]||0) > (TK150_ORDER[now]||0)) return best;
    if(!best || (TK150_ORDER[now]||0) > (TK150_ORDER[best]||0)){
      if(now!=='inquirer' || best){ TK150.data.byCode[code]=now; TK150.dirty=true; tk150Save(); }
    }
  }catch(e){}
  return now;
}; })(iblTierOf);
window.iblTierOf=iblTierOf;
try{ setTimeout(tk150Load, 1200); }catch(e){}
