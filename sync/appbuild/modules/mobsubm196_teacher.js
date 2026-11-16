/* ═══════════════════════════════════════════════════════════════════
 * v19-196: 📱 모바일 학원앱 «오늘 제출 현황» → 학생별 녹음·플래너 제출 목록
 *   (원장 2026-11-16 「모바일 학원앱에서 플래너와 녹음 제출현황을 자세히 확인 가능해야 한다 · 월수금반 학생별 제출현황」)
 *  ① 홈의 «📥 오늘 제출 현황» 카드를 누르면 학생별 화면(MOB.view 'subm')
 *  ② 학생 한 줄 = 이름 · 학년·반 · 🎙 녹음(✓ 시각 · n개 / ✗) · 📒 플래너(✓ 시각 · n장 · 확인함 / ✗)
 *     위 칩: 전체 · 녹음 안 냄 · 플래너 안 냄 · 둘 다 냄 / 맨 위 숫자 요약
 *  ③ 플래너 «오늘 것» = 새벽 3시 규칙(v19-185) — 오늘 03:00 ~ 내일 02:59 에 낸 것
 *  ④ 녹음은 학생마다 recordings 버킷 목록에서 오늘 날짜 파일(이름의 YYYYMMDD)과 올린 시각(created_at)
 *  보기만 한다(재생·검토·승인은 PC 화면). ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var M196 = { f: 'all' };
/* 녹음: 개수·마지막 시각까지 기억하도록 다시 정의 (홈 숫자 MOB.rec.map 은 그대로 채운다) */
mobRecLoad = async function(){
  if (MOB.rec.started) return; MOB.rec.started = true; MOB.rec.det = MOB.rec.det || {};
  var ymd = mobToday().replace(/\./g, '');
  var ro = mobRoster().list.filter(function(s){ return s.lumen_rec_code; });
  for (var i = 0; i < ro.length; i++){
    var code = String(ro[i].lumen_rec_code);
    try {
      var files = await fetchRecordings(code);
      var today = (files || []).filter(function(f){ var m = String(f.name || '').match(/(\d{8})/); return m && m[1] === ymd; });
      MOB.rec.map[code] = today.length > 0;
      var last = ''; today.forEach(function(f){ var t = String(f.created_at || f.updated_at || ''); if (t > last) last = t; });
      MOB.rec.det[code] = { n: today.length, at: last };
    } catch(e){}
    if (mobActive() && MOB.view === 'subm' && i % 4 === 3) render();
  }
  MOB.rec.done = true;
  if (mobActive() && (MOB.view === 'home' || MOB.view === 'subm')) render();
};
window.mobRecLoad = mobRecLoad;
function m196Hm(iso){ if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) return ''; return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
/* 오늘 낸 플래너 — setId «YYYYMMDD_HHMM…» · 03:00 전이면 전날 것 */
function m196Planner(s){
  var n = new Date(), y = n.getFullYear(), mo = n.getMonth(), d = n.getDate();
  var today = '' + y + String(mo + 1).padStart(2, '0') + String(d).padStart(2, '0');
  var tm = new Date(y, mo, d + 1), tmr = '' + tm.getFullYear() + String(tm.getMonth() + 1).padStart(2, '0') + String(tm.getDate()).padStart(2, '0');
  var L = (s.lumen_planner_photos || []).filter(function(p){
    var id = String((p && p.setId) || ''); var m = /^(\d{8})(?:_(\d{2})(\d{2}))?/.exec(id); if (!m) return false;
    var hm = m[2] ? Number(m[2]) * 100 + Number(m[3]) : 1200;
    return (m[1] === today && hm >= 300) || (m[1] === tmr && hm < 300);
  });
  if (!L.length) return null;
  var last = L[L.length - 1], id = String(last.setId), hm = /^\d{8}_(\d{2})(\d{2})/.exec(id);
  var pages = 0; L.forEach(function(p){ pages += (p.urls || []).length; });
  return { n: L.length, pages: pages, hm: hm ? hm[1] + ':' + hm[2] : '', late: /^\d{8}_(0[0-2])/.test(id) && id.slice(0, 8) === tmr, reviewed: L.some(function(p){ return p.reviewed; }) };
}
window.m196F = function(f){ M196.f = f; render(); };
function mob196Subm(){
  var ro = mobRoster(), WD = ['일','월','화','수','목','금','토'], n = new Date();
  var plReady = !!window._homePlannerDone, recReady = !!MOB.rec.done;
  var rows = ro.list.map(function(s){
    var code = s.lumen_rec_code ? String(s.lumen_rec_code) : '';
    var rd = code ? ((MOB.rec.det || {})[code] || (MOB.rec.map[code] ? { n: 1, at: '' } : null)) : null;
    var recOk = !!(rd && rd.n), pl = m196Planner(s);
    return { s: s, code: code, rec: rd, recOk: recOk, recKnown: !code || recReady || (MOB.rec.det && code in MOB.rec.det), pl: pl };
  });
  var cRec = rows.filter(function(r){ return r.recOk; }).length, cPl = rows.filter(function(r){ return r.pl; }).length;
  var cBoth = rows.filter(function(r){ return r.recOk && r.pl; }).length;
  var cNoRec = rows.filter(function(r){ return !r.recOk; }).length, cNoPl = rows.filter(function(r){ return !r.pl; }).length;
  var F = M196.f;
  var shown = rows.filter(function(r){ return F === 'all' ? true : F === 'norec' ? !r.recOk : F === 'nopl' ? !r.pl : (r.recOk && r.pl); });
  /* 안 낸 학생이 위로 */
  shown.sort(function(a, b){ var sa = (a.recOk ? 1 : 0) + (a.pl ? 1 : 0), sb = (b.recOk ? 1 : 0) + (b.pl ? 1 : 0); return (sa - sb) || String(a.s.name).localeCompare(String(b.s.name), 'ko'); });
  var h = '';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button onclick="mobGo(\'home\')" style="border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 12px;font-family:inherit;font-weight:800;font-size:12.5px;color:#0d2240;cursor:pointer">‹ 홈</button>'
    + '<div style="font-size:17px;font-weight:900;color:#0d2240">📥 오늘 제출 현황</div></div>';
  h += '<div style="font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:10px">' + (n.getMonth() + 1) + '월 ' + n.getDate() + '일 ' + WD[n.getDay()] + '요일 · ' + (ro.key === '전체' ? '수업 요일 아님' : esc2(ro.key) + ' ' + ro.list.length + '명') + '</div>';
  if (!ro.list.length) return h + '<div style="background:#fff;border-radius:14px;padding:30px;text-align:center;color:#94a3b8;font-weight:700">오늘은 수업이 없습니다.</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    + '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:11px;text-align:center"><div style="font-size:22px;font-weight:900;color:#0d2240">' + (recReady ? cRec : '…') + '<span style="font-size:13px;color:#94a3b8">/' + rows.filter(function(r){ return r.code; }).length + '</span></div><div style="font-size:11.5px;font-weight:800;color:#64748b">🎙 녹음 제출</div></div>'
    + '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:11px;text-align:center"><div style="font-size:22px;font-weight:900;color:#0d2240">' + (plReady ? cPl : '…') + '<span style="font-size:13px;color:#94a3b8">/' + ro.list.length + '</span></div><div style="font-size:11.5px;font-weight:800;color:#64748b">📒 플래너 제출</div></div></div>';
  var chip = function(k, t, c){ var on = F === k; return '<span onclick="m196F(\'' + k + '\')" style="cursor:pointer;user-select:none;border:1.5px solid ' + (on ? '#0d2240' : '#e3e9f2') + ';background:' + (on ? '#0d2240' : '#fff') + ';color:' + (on ? '#fff' : '#5b6b82') + ';border-radius:50px;padding:6px 12px;font-size:12px;font-weight:900;white-space:nowrap">' + t + ' <span style="opacity:.6">' + c + '</span></span>'; };
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + chip('all', '전체', ro.list.length) + chip('norec', '🎙 녹음 안 냄', cNoRec) + chip('nopl', '📒 플래너 안 냄', cNoPl) + chip('both', '✓ 둘 다 냄', cBoth) + '</div>';
  h += '<div style="display:flex;flex-direction:column;gap:7px">';
  shown.forEach(function(r){
    var s = r.s;
    var recH = !r.code ? '<span style="color:#94a3b8">코드 없음</span>'
      : !r.recKnown ? '<span style="color:#cbd5e1">확인 중…</span>'
      : r.recOk ? '<b style="color:#15803d">✓ ' + (m196Hm(r.rec.at) || '제출') + '</b>' + (r.rec.n > 1 ? ' <span style="color:#64748b">· ' + r.rec.n + '개</span>' : '')
      : '<b style="color:#dc2626">✗ 안 냄</b>';
    var plH = !plReady ? '<span style="color:#cbd5e1">확인 중…</span>'
      : r.pl ? '<b style="color:#15803d">✓ ' + (r.pl.hm || '제출') + '</b>' + (r.pl.late ? ' <span style="color:#b45309">새벽</span>' : '') + (r.pl.pages ? ' <span style="color:#64748b">· ' + r.pl.pages + '장</span>' : '') + (r.pl.reviewed ? ' <span style="color:#1d6fe8">· 확인함</span>' : '')
      : '<b style="color:#dc2626">✗ 안 냄</b>';
    var both = r.recOk && r.pl, none = !r.recOk && !r.pl && r.recKnown && plReady;
    h += '<div class="m196-row" style="background:#fff;border:1.5px solid ' + (none ? '#fecaca' : both ? '#bbf7d0' : '#e6eaf1') + ';border-radius:13px;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center">'
      + '<div style="min-width:0"><div style="font-size:15px;font-weight:900;color:#0d2240">' + esc2(s.name) + '</div><div style="font-size:11px;color:#94a3b8;font-weight:700">' + esc2([String(s.grade || '').replace(/학교\s*/, '').replace('학년', ''), s.group].filter(Boolean).join(' · ')) + '</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:3px;font-size:12.5px;text-align:right;white-space:nowrap"><div>🎙 ' + recH + '</div><div>📒 ' + plH + '</div></div></div>';
  });
  if (!shown.length) h += '<div style="background:#fff;border-radius:13px;padding:22px;text-align:center;color:#94a3b8;font-weight:700">해당하는 학생이 없습니다</div>';
  h += '</div><div style="font-size:10.5px;color:#94a3b8;font-weight:600;margin-top:10px;line-height:1.6">플래너는 오늘 03:00 ~ 내일 02:59 에 낸 것(새벽 3시 규칙). 재생·검토·승인은 PC 화면에서.</div>';
  return h;
}
/* 홈 카드 누르면 학생별 화면 · 'subm' 보기는 홈 함수 자리에서 그린다(mobSync 의 else 갈래) */
mobHome = (function(orig){ return function(){
  if (MOB.view === 'subm') return mob196Subm();
  var h = orig.apply(this, arguments);
  h = h.replace('<div style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:15px 17px;margin-bottom:14px"><div style="font-size:14px;font-weight:900;color:#0d2240;margin-bottom:9px">📥 오늘 제출 현황',
    '<div class="m196-card" onclick="mobGo(\'subm\')" style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:15px 17px;margin-bottom:14px;cursor:pointer"><div style="font-size:14px;font-weight:900;color:#0d2240;margin-bottom:9px">📥 오늘 제출 현황');
  /* 홈 플래너 숫자도 학생별 화면과 같은 새벽 3시 규칙으로 */
  try { if (window._homePlannerDone) { var c = mobRoster().list.filter(function(x){ return m196Planner(x); }).length;
    h = h.replace(/(<div style="font-size:21px;font-weight:900;color:#0d2240">)\d+(<span style="font-size:13px;color:#94a3b8">\/\d+<\/span><\/div><div style="font-size:11px;font-weight:800;color:#64748b;margin-top:2px">📔 플래너 제출)/, '$1' + c + '$2'); } } catch(e){}
  h = h.replace('제출 여부만 표시 — 재생·검토·승인은 PC 화면에서</div>', '<b style="color:#1d6fe8">눌러서 학생별 보기 ›</b> · 재생·검토·승인은 PC 화면에서</div>');
  return h;
}; })(mobHome);
