/* ═══════════════════════════════════════════════════════════════════
 * v19-87: 🔄 여러 기기 등록부 맞추기 (2026-10-07 원장 「테블릿과 연동이 안된다」 — 숙제체크)
 *  [원인] 등록부(or_studentdb)는 «앱을 켤 때 한 번» 서버 것을 받아 합치고, 그 뒤로는 이 기기 것을 «통째로» 올렸다.
 *         → ① 켜 둔 PC 화면에는 태블릿에서 찍은 체크가 새로고침 전까지 안 보이고
 *           ② 켜 둔 PC가 무엇이든 저장하면 태블릿 체크가 없는 옛 사본이 서버를 덮어 체크가 사라졌다.
 *  [고침] ① 올리기 직전에 서버 것을 먼저 받아 합친다(서버가 그대로면 받지 않음 — 시각만 확인)
 *         ② 화면으로 돌아올 때 · 30초마다(숙제체크 화면 · v19-90) 서버가 바뀌었으면 받아 합친다
 *         ③ 숙제체크 칸마다 고친 시각(lumen_hw_at) — 지운 칸도 «더 최근 쪽»이 이겨 되살아나지 않는다
 *         ④ 앱을 켜고 받은 뒤, 이 기기에만 있는 체크가 있으면 한 번 올린다(태블릿에 남아 있던 체크 살리기)
 *  합치는 규칙은 applyCloudStudentDbMerge 그대로(이 기기 우선 · 날짜 칸은 합집합). 합친 결과는
 *  «달라진 칸만» 지금 쓰는 학생 객체에 넣어, 진행 중인 작업(AI 분석 등)이 잡고 있는 객체를 바꾸지 않는다.
 *  ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var SDS = { cloudAt:null, busy:null, lastPull:0, gotHw:0 };
function sdsJ(x){ try { return JSON.stringify(x); } catch(e){ return ''; } }
function sdsSameAt(a, b){ if(!a||!b) return false; var x=Date.parse(a), y=Date.parse(b); return !isNaN(x) && x===y; }
/* 합친 등록부를 지금 쓰는 students 에 «달라진 칸만» 넣는다 */
function sdsAdopt(merged){
  var byName = {}, n = 0, hw = 0;
  (students || []).forEach(function(s){ if(s && s.name) byName[String(s.name).trim()] = s; });
  (merged || []).forEach(function(ms){
    if(!ms || !ms.name) return;
    var st = byName[String(ms.name).trim()];
    if(!st){
      var add = ms; try { add = migrateStudentLumen(migrateStudentDb(JSON.parse(JSON.stringify(ms)))); } catch(e){}
      students.push(add); n++; return;
    }
    Object.keys(ms).forEach(function(k){
      var a = st[k], b = ms[k];
      if(sdsJ(a) === sdsJ(b)) return;
      if(k === 'lumen_hw'){ var ka = a || {}, kb = b || {}; Object.keys(kb).forEach(function(d){ if(sdsJ(ka[d]) !== sdsJ(kb[d])) hw++; }); }
      if(k === 'lumen_planner_photos' && Array.isArray(a) && Array.isArray(b)){
        /* 세트 배열은 그대로 두고 칸만 바꾼다 — 같은 세트가 같으면 원래 객체를 쓴다 */
        var old = {}; a.forEach(function(p){ if(p && p.setId) old[p.setId] = p; });
        var next = b.map(function(p){ var o = p && old[p.setId]; return (o && sdsJ(o) === sdsJ(p)) ? o : p; });
        a.length = 0; next.forEach(function(p){ a.push(p); }); n++; return;
      }
      st[k] = b; n++;
    });
  });
  if(hw) SDS.gotHw += hw;
  return { n:n, hw:hw };
}
/* 서버 등록부가 바뀌었으면 받아 합친다. force = 시각이 같아도 받는다 */
async function sdsSync(force){
  if(SDS.busy) return SDS.busy;
  SDS.busy = (async function(){
    var sb = null; try { sb = getSupaClient(); } catch(e){}
    if(!sb) return null;
    var h = await sb.from('lumen_store').select('updated_at').eq('key','or_studentdb');
    var at = h && h.data && h.data[0] && h.data[0].updated_at;
    if(!at) return null;
    SDS.lastPull = Date.now();
    if(!force && sdsSameAt(at, SDS.cloudAt)) return { n:0, hw:0, same:true };
    var r = await sb.from('lumen_store').select('value,updated_at').eq('key','or_studentdb');
    var cv = r && r.data && r.data[0] && r.data[0].value;
    if(typeof cv === 'string'){ try { cv = JSON.parse(cv); } catch(e){ cv = null; } }
    if(!Array.isArray(cv) || cv.length < 5) return null;
    try { _memStore['or_studentdb'] = JSON.stringify(students); } catch(e){}   /* 아직 저장 안 한 화면 변경도 합치기에 넣는다 */
    var merged = applyCloudStudentDbMerge(cv);
    var res = sdsAdopt(merged);
    SDS.cloudAt = r.data[0].updated_at || at;
    /* 이 기기에만 있는 숙제체크가 있나 — 있으면 올려야 한다 */
    var cloudHw = {}; cv.forEach(function(s){ if(s && s.name) cloudHw[String(s.name).trim()] = s.lumen_hw || {}; });
    res.mine = 0;
    (students || []).forEach(function(s){ if(!s || !s.name) return; var c = cloudHw[String(s.name).trim()] || {}; Object.keys(s.lumen_hw || {}).forEach(function(d){ if(s.lumen_hw[d] && sdsJ(c[d]) !== sdsJ(s.lumen_hw[d])) res.mine++; }); });
    return res;
  })();
  var mine = SDS.busy;
  /* 느린 네트워크에서 한 번이 멈춰도 다음 저장·받기를 막지 않게 15초에서 끊는다 */
  var cap = new Promise(function(res){ setTimeout(function(){ res(null); }, 15000); });
  try { return await Promise.race([mine, cap]); } catch(e){ console.warn('[등록부 맞추기]', e); return null; } finally { if(SDS.busy === mine) SDS.busy = null; }
}
window.sdsSync = sdsSync;
/* 받아서 화면에 반영 — 숙제체크 화면이면 다시 그리고 알려 준다 */
async function sdsPullShow(force){
  if(!window._studbPulled) return;
  var r = await sdsSync(force);
  if(!r || r.same) return;
  if(r.mine) { try { scheduleSync('or_studentdb'); } catch(e){} }
  if(!r.n) return;
  try { if(typeof VIEW !== 'undefined' && (VIEW === 'hwcheck' || VIEW === 'attend' || VIEW === 'planner')) render(); } catch(e){}
  if(r.hw && typeof VIEW !== 'undefined' && VIEW === 'hwcheck'){ try { plToast('☁️ 다른 기기에서 고친 숙제체크 ' + r.hw + '칸을 받아왔어요'); } catch(e){} }
}
window.sdsPullShow = sdsPullShow;
/* 숙제체크 칸마다 고친 시각 */
(function(){
  if(typeof hwcSave !== 'function') return;
  var orig = hwcSave;
  hwcSave = function(st, iso, obj){ if(st && iso){ st.lumen_hw_at = st.lumen_hw_at || {}; st.lumen_hw_at[iso] = new Date().toISOString(); } return orig(st, iso, obj); };
  window.hwcSave = hwcSave;
})();
/* 언제 받나: 화면으로 돌아올 때 · 1분 30초마다(화면이 보일 때) · 숙제체크 화면에 들어올 때 */
try { document.addEventListener('visibilitychange', function(){ if(!document.hidden) setTimeout(function(){ sdsPullShow(false); }, 1200); }); } catch(e){}
/* v19-90: 숙제체크 화면에서는 30초마다(서버 시각만 보는 가벼운 확인) */
setInterval(function(){ try { if(!document.hidden && typeof VIEW !== 'undefined' && VIEW === 'hwcheck') sdsPullShow(false); } catch(e){} }, 30000);
/* v19-90: 「☁️ 지금 받아오기」 — 원장님이 눌러 바로 확인 */
window.sdsManual = async function(){
  if(!window._studbPulled){ try { plToast('⏳ 아직 서버 등록부를 받는 중이에요 — 잠시 뒤 다시 눌러 주세요'); } catch(e){} return; }
  SDS.manual = true; try { render(); } catch(e){}
  var r = await sdsSync(true); SDS.manual = false;
  if(r && r.mine) { try { scheduleSync('or_studentdb'); } catch(e){} }
  try { render(); } catch(e){}
  try { plToast(!r ? '⚠️ 서버에 닿지 못했어요 — 인터넷 연결을 확인해 주세요' : (r.hw ? ('☁️ 다른 기기에서 고친 숙제체크 ' + r.hw + '칸을 받아왔어요') : ('✅ 서버와 같아요 — 새로 받을 체크가 없어요' + (r.mine ? ' (이 기기 체크 ' + r.mine + '칸은 서버로 올립니다)' : '')))); } catch(e){}
};
function sdsChip(){
  var t = SDS.lastPull ? new Date(SDS.lastPull) : null, hh = t ? (String(t.getHours()).padStart(2,'0') + ':' + String(t.getMinutes()).padStart(2,'0') + ':' + String(t.getSeconds()).padStart(2,'0')) : '아직';
  return '<div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:8px 24px 0;font-size:11.5px;font-weight:800;color:#64748b">'
    + '<span>☁️ 다른 기기(아이패드·PC) 체크 확인 ' + hh + ' · 30초마다 자동</span>'
    + '<button onclick="sdsManual()" style="border:1.5px solid #0369a1;background:' + (SDS.manual ? '#e0f2fe' : '#fff') + ';color:#0369a1;font-family:inherit;font-size:12px;font-weight:900;padding:4px 12px;border-radius:9px;cursor:pointer">' + (SDS.manual ? '⏳ 받는 중…' : '☁️ 지금 받아오기') + '</button></div>';
}
(function(){
  var orig = window.rHwCheck || (typeof rHwCheck === 'function' ? rHwCheck : null); if(!orig) return;
  rHwCheck = function(){ if(Date.now() - SDS.lastPull > 20000){ SDS.lastPull = Date.now(); setTimeout(function(){ sdsPullShow(false); }, 300); } return sdsChip() + orig.apply(this, arguments); };
  window.rHwCheck = rHwCheck;
})();
/* 앱을 켜고 서버 등록부를 받은 뒤 한 번 — 이 기기에만 남아 있던 체크를 올린다 */
(function(){
  var tries = 0;
  var t = setInterval(function(){
    tries++; if(tries > 120){ clearInterval(t); return; }
    if(!window._studbPulled) return;
    clearInterval(t);
    setTimeout(function(){ sdsPullShow(true); }, 4000);
  }, 1000);
})();
