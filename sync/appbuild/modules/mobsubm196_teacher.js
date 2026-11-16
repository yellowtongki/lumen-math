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
      var days = {}; (files || []).forEach(function(f){ var m = String(f.name || '').match(/(\d{8})/); if (!m) return; var t = String(f.created_at || f.updated_at || ''); if (!days[m[1]] || t > days[m[1]]) days[m[1]] = t || '1'; });
      MOB.rec.det[code] = { n: today.length, at: last, days: days };   /* v19-197: 날짜별 달력용 */
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
    h += '<div class="m196-row" onclick="m197Open(\'' + String(s.id).replace(/'/g, '') + '\')" style="cursor:pointer;background:#fff;border:1.5px solid ' + (none ? '#fecaca' : both ? '#bbf7d0' : '#e6eaf1') + ';border-radius:13px;padding:10px 12px;display:grid;grid-template-columns:1fr auto;gap:4px 10px;align-items:center">'
      + '<div style="min-width:0"><div style="font-size:15px;font-weight:900;color:#0d2240">' + esc2(s.name) + '</div><div style="font-size:11px;color:#94a3b8;font-weight:700">' + esc2([String(s.grade || '').replace(/학교\s*/, '').replace('학년', ''), s.group].filter(Boolean).join(' · ')) + '</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:3px;font-size:12.5px;text-align:right;white-space:nowrap"><div>🎙 ' + recH + '</div><div>📒 ' + plH + '</div></div></div>';
  });
  if (!shown.length) h += '<div style="background:#fff;border-radius:13px;padding:22px;text-align:center;color:#94a3b8;font-weight:700">해당하는 학생이 없습니다</div>';
  h += '</div><div style="font-size:10.5px;color:#94a3b8;font-weight:600;margin-top:10px;line-height:1.6">플래너는 오늘 03:00 ~ 내일 02:59 에 낸 것(새벽 3시 규칙). 재생·검토·승인은 PC 화면에서. <b>이름을 누르면 날짜별 달력</b>.</div>';
  return h;
}
/* 홈 카드 누르면 학생별 화면 · 'subm' 보기는 홈 함수 자리에서 그린다(mobSync 의 else 갈래) */
mobHome = (function(orig){ return function(){
  if (MOB.view === 'subm') return M196.sel ? mob197Cal() : mob196Subm();
  var h = orig.apply(this, arguments);
  h = h.replace('<div style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:15px 17px;margin-bottom:14px"><div style="font-size:14px;font-weight:900;color:#0d2240;margin-bottom:9px">📥 오늘 제출 현황',
    '<div class="m196-card" onclick="mobGo(\'subm\')" style="background:#fff;border:1px solid #e6eaf1;border-radius:16px;padding:15px 17px;margin-bottom:14px;cursor:pointer"><div style="font-size:14px;font-weight:900;color:#0d2240;margin-bottom:9px">📥 오늘 제출 현황');
  /* 홈 플래너 숫자도 학생별 화면과 같은 새벽 3시 규칙으로 */
  try { if (window._homePlannerDone) { var c = mobRoster().list.filter(function(x){ return m196Planner(x); }).length;
    h = h.replace(/(<div style="font-size:21px;font-weight:900;color:#0d2240">)\d+(<span style="font-size:13px;color:#94a3b8">\/\d+<\/span><\/div><div style="font-size:11px;font-weight:800;color:#64748b;margin-top:2px">📔 플래너 제출)/, '$1' + c + '$2'); } } catch(e){}
  h = h.replace('제출 여부만 표시 — 재생·검토·승인은 PC 화면에서</div>', '<b style="color:#1d6fe8">눌러서 학생별 보기 ›</b> · 재생·검토·승인은 PC 화면에서</div>');
  return h;
}; })(mobHome);

/* ═══ v19-197: 학생 이름 누르면 날짜별 제출 달력 (원장 2026-11-16 「학생 이름 누르면 날짜별 제출하는 것 체크 표시로 며칠 날 내고 며칠 날 내지 않았는지」)
 *   한 달 달력(월~일) · 칸마다 🎙 녹음 · 📒 플래너 ✓ / 수업일인데 안 냈으면 ✗ · 수업일은 옅은 파랑 · 미래 칸은 비움
 *   수업 요일 = 등록부 반 요일(groupDays) · 없으면 반 이름 M → 월수금, T → 화목토
 *   녹음 = recordings 파일 이름의 날짜 · 플래너 = setId 날짜(새벽 3시 규칙) — 학원앱에 이미 있는 기록 그대로 */
M196.sel = null; M196.ym = null;
window.m197Open = function(id){ M196.sel = String(id); var n = new Date(); M196.ym = [n.getFullYear(), n.getMonth()]; var ov = document.getElementById('MOB_OV'); if (ov) ov.scrollTop = 0; render(); };
window.m197Back = function(){ M196.sel = null; render(); };
window.m197Mon = function(d){ var y = M196.ym[0], m = M196.ym[1] + d; if (m < 0){ m = 11; y--; } if (m > 11){ m = 0; y++; } M196.ym = [y, m]; render(); };
function m197Days(s){
  var g = String(s.group || ''), gd = (typeof groupDays !== 'undefined' && groupDays && groupDays[g]) || null;
  if (Array.isArray(gd) && gd.length) return gd.map(Number);
  if (/^m/i.test(g)) return [1, 3, 5]; if (/^t/i.test(g)) return [2, 4, 6]; return [];
}
function m197Ymd(d){ return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
/* 플래너: 날짜(YYYYMMDD) → {hm, pages, reviewed} · 새벽 3시 전 제출은 전날 */
function m197PlMap(s){
  var M = {};
  (s.lumen_planner_photos || []).forEach(function(p){
    var id = String((p && p.setId) || ''), m = /^(\d{4})(\d{2})(\d{2})(?:_(\d{2})(\d{2}))?/.exec(id); if (!m) return;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), hm = m[4] ? Number(m[4]) * 100 + Number(m[5]) : 1200;
    if (hm < 300) d.setDate(d.getDate() - 1);
    var k = m197Ymd(d), o = M[k] || (M[k] = { hm: '', pages: 0, reviewed: false });
    o.hm = m[4] ? m[4] + ':' + m[5] : o.hm; o.pages += (p.urls || []).length; if (p.reviewed) o.reviewed = true;
  });
  return M;
}
function mob197Cal(){
  var s = (students || []).find(function(x){ return String(x.id) === M196.sel; });
  if (!s){ M196.sel = null; return mob196Subm(); }
  var y = M196.ym[0], mo = M196.ym[1], cls = m197Days(s), pl = m197PlMap(s);
  var code = s.lumen_rec_code ? String(s.lumen_rec_code) : '', rd = code ? ((MOB.rec.det || {})[code] || null) : null, rdays = (rd && rd.days) || {};
  var todayK = m197Ymd(new Date());
  var first = new Date(y, mo, 1), last = new Date(y, mo + 1, 0), lead = (first.getDay() + 6) % 7;   /* 월요일 시작 */
  var nCls = 0, nRec = 0, nPl = 0, missR = [], missP = [];
  var cells = '';
  for (var i = 0; i < lead; i++) cells += '<div></div>';
  for (var dd = 1; dd <= last.getDate(); dd++){
    var d = new Date(y, mo, dd), k = m197Ymd(d), isCls = cls.indexOf(d.getDay()) >= 0, fut = k > todayK;
    var r = !!rdays[k], p = !!pl[k];
    var isToday = k === todayK;   /* 오늘은 마감 전(녹음 오늘 안 · 플래너 새벽 3시까지) — 안 냈어도 ✗ 대신 ⏳ */
    if (isCls && !fut){ nCls++; if (r) nRec++; else if (!isToday) missR.push(dd); if (p) nPl++; else if (!isToday) missP.push(dd); }
    var mk = function(ok, ic){ return fut ? '<span style="opacity:.25">' + ic + '</span>' : ok ? '<span style="color:#15803d">' + ic + '✓</span>' : (isCls ? (isToday ? '<span style="color:#94a3b8">' + ic + '⏳</span>' : '<span style="color:#dc2626">' + ic + '✗</span>') : '<span style="color:#cbd5e1">' + ic + '·</span>'); };
    cells += '<div class="m197-day" data-d="' + k + '" style="border-radius:9px;padding:4px 2px;min-height:58px;background:' + (k === todayK ? '#fef9c3' : isCls ? '#eef4ff' : '#fff') + ';border:1px solid ' + (isCls ? '#cfe0fb' : '#eef2f7') + ';display:flex;flex-direction:column;align-items:center;gap:1px">'
      + '<b style="font-size:12.5px;color:' + (d.getDay() === 0 ? '#dc2626' : '#0d2240') + '">' + dd + '</b>'
      + '<span style="font-size:10.5px;font-weight:900;white-space:nowrap">' + mk(r, '🎙') + '</span>'
      + '<span style="font-size:10.5px;font-weight:900;white-space:nowrap">' + mk(p, '📒') + '</span></div>';
  }
  var h = '';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><button onclick="m197Back()" style="border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:7px 12px;font-family:inherit;font-weight:800;font-size:12.5px;color:#0d2240;cursor:pointer">‹ 제출 현황</button>'
    + '<div style="min-width:0"><div style="font-size:17px;font-weight:900;color:#0d2240">' + esc2(s.name) + '</div><div style="font-size:11px;color:#94a3b8;font-weight:700">' + esc2([String(s.grade || '').replace(/학교\s*/, '').replace('학년', ''), s.group, cls.length ? '수업 ' + cls.map(function(x){ return '일월화수목금토'[x]; }).join('') : ''].filter(Boolean).join(' · ')) + '</div></div></div>';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #e6eaf1;border-radius:13px;padding:8px 10px;margin-bottom:8px">'
    + '<button onclick="m197Mon(-1)" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px 12px;font-family:inherit;font-weight:900;cursor:pointer">‹</button>'
    + '<b style="font-size:15px;color:#0d2240">' + y + '년 ' + (mo + 1) + '월</b>'
    + '<button onclick="m197Mon(1)" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px 12px;font-family:inherit;font-weight:900;cursor:pointer">›</button></div>';
  h += '<div class="m197-sum" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">'
    + '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:12px;padding:9px;text-align:center"><div style="font-size:19px;font-weight:900;color:#0d2240">' + (code ? (MOB.rec.done || rd ? nRec : '…') : '—') + '<span style="font-size:12px;color:#94a3b8">/' + nCls + '</span></div><div style="font-size:11px;font-weight:800;color:#64748b">🎙 수업일 녹음</div></div>'
    + '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:12px;padding:9px;text-align:center"><div style="font-size:19px;font-weight:900;color:#0d2240">' + nPl + '<span style="font-size:12px;color:#94a3b8">/' + nCls + '</span></div><div style="font-size:11px;font-weight:800;color:#64748b">📒 수업일 플래너</div></div></div>';
  h += '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:8px">'
    + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:11px;font-weight:900;color:#64748b;margin-bottom:4px"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span style="color:#dc2626">일</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' + cells + '</div></div>';
  var miss = function(L, ic){ return L.length ? '<div style="font-size:12px;color:#b91c1c;font-weight:800;margin-top:6px">' + ic + ' 안 낸 수업일: ' + L.map(function(x){ return (mo + 1) + '/' + x; }).join(' · ') + '</div>' : ''; };
  h += (code ? miss(missR, '🎙') : '<div style="font-size:12px;color:#94a3b8;font-weight:700;margin-top:6px">🎙 학생 코드가 없어 녹음을 확인할 수 없어요</div>') + miss(missP, '📒');
  h += '<div style="font-size:10.5px;color:#94a3b8;font-weight:600;margin-top:8px;line-height:1.6">파란 칸 = 수업일 · ✓ 냄 · ✗ 수업일인데 안 냄 · ⏳ 오늘(아직 마감 전) · · 수업일 아님. 플래너는 새벽 3시 전 제출을 전날로 셉니다.</div>';
  return h;
}
