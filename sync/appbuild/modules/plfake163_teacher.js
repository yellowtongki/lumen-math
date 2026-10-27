/* ═══════════════════════════════════════════════════════════════════
 * v19-163: 📛 플래너 거짓 제출 확인 (원장 10/26 「플래너 거짓 제출을 누르면 확인할 수 있게 링크로 · 플래너 탭에서 거짓 제출을 볼 수 있는 기능」
 *   → 시안 docs/mockup_planner_fake.html → 「좋다. v19-163 으로 진행하고 배포해」)
 *   · 플래너 탭 왼쪽 «📛 거짓 제출» (PLANNER_VIEW 'fake') — 최근 30일, 학생별 건수, 확인 전/전체/같은 날짜/같은 쪽/날짜 문제
 *     카드: 이번에 낸 사진 vs 같다고 본(먼저 낸) 사진 나란히 · 글 같은 정도 · 사진 지문 차이 · AI 가 읽은 할 일 중 겹친 줄
 *     단추: ⛔ 거짓 맞음 — 0점 확정(analysis.zeroOk = 날짜) · ↩ 다른 날 맞음 — 점수 되살리기(기존 plzClear) · 🔍 사진 크게 · 💬 학생에게 보낼 말 복사
 *   · 거짓 = 같은 날짜 또 냄(sameDate)·같은 쪽 다시 냄(dup). 날짜 없음(noDate)·다른 날짜(wrongDate)는 «날짜 문제»로 따로 센다.
 *   · 바로 가기: 🔔 알림 줄 · 🚨 위험 신호 줄(플래너 0점·거짓 제출) · 사진검토 승인 카드 «⛔ 그날 0점» 띠 → 그 학생 카드가 열린 채로
 *   · 학부모 상담 메모(v19-161~162)는 확정 / 확인 전을 나눠 적는다. 학생앱 발행(plzFlags)은 예전 그대로(바꾸지 않음).
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var PF = { stu: '', filter: 'todo', open: {} };
var PF_LIE = { dup: 1, sameDate: 1 }, PF_DATE = { noDate: 1, wrongDate: 1 };
function pfToday(){ return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function pfAddD(s, n){ var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function pfE(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pfMD(s){ s = String(s || ''); return s.length >= 10 ? (+s.slice(5, 7)) + '/' + (+s.slice(8, 10)) : s; }
/* 최근 30일 사건 목록 */
function pfCases(){
  var from = pfAddD(pfToday(), -30), out = [];
  (students || []).forEach(function(st){ if (!st || st.withdrawn) return;
    (st.lumen_planner_photos || []).forEach(function(p){ var a = p && p.analysis; if (!a || a.zeroCleared || !(a.zeroDay || a.zeroWarn)) return;
      var r = a.zeroReason || ''; if (!PF_LIE[r] && !PF_DATE[r]) return;
      var day = plzSetDay(p.setId); if (!day || day < from) return;
      out.push({ st: st, p: p, a: a, r: r, lie: !!PF_LIE[r], day: day, ok: a.zeroOk || '', key: st.id + '|' + p.setId }); }); });
  out.sort(function(x, y){ return x.day < y.day ? 1 : -1; });
  return out;
}
function pfCount(){ try { return pfCases().filter(function(c){ return c.lie && !c.ok; }).length; } catch(e){ return 0; } }
function pfReasonTag(c){ return c.r === 'sameDate' ? '같은 날짜 또 냄' : c.r === 'dup' ? '같은 쪽 다시 냄' : c.r === 'noDate' ? '날짜 없음' : '날짜가 다름'; }
window.pfOpen = function(stId, setId){
  VIEW = 'planner'; PLANNER_VIEW = 'fake'; PF.stu = stId || ''; PF.open = {};
  var cs = pfCases().filter(function(c){ return !stId || c.st.id === stId; });
  PF.filter = cs.some(function(c){ return !c.ok; }) ? 'todo' : 'all';
  var first = setId ? cs.filter(function(c){ return c.p.setId === setId; })[0] : (cs.filter(function(c){ return !c.ok && c.lie; })[0] || cs[0]);
  if (first) PF.open[first.key] = 1;
  try { renderFuncTab(); } catch(e){ render(); }
};
window.pfSet = function(k, v){ PF[k] = v; render(); };
window.pfToggle = function(key){ PF.open[key] = !PF.open[key]; render(); };
window.pfConfirm = function(stId, setId){
  var st = (students || []).find(function(s){ return s && s.id === stId; }); if (!st) return;
  var p = (st.lumen_planner_photos || []).find(function(x){ return x && x.setId === setId; }); if (!p || !p.analysis) return;
  p.analysis.zeroOk = p.analysis.zeroOk ? '' : pfToday();
  if (typeof saveStudents === 'function') saveStudents();
  try { plToast(p.analysis.zeroOk ? '⛔ 0점 확정 — 거짓 제출로 남깁니다' : '↩ 확정 취소 — 다시 «확인 전»'); } catch(e){}
  render();
};
window.pfCopy = function(stId, setId){
  var c = pfCases().filter(function(x){ return x.st.id === stId && x.p.setId === setId; })[0]; if (!c) return;
  var nm = c.st.name, d0 = c.a.zeroDup || {};
  var msg = c.r === 'sameDate' ? (nm + ', ' + pfMD(c.day) + '에 낸 플래너 날짜가 ' + pfMD(d0.day) + '에 이미 낸 날짜와 같아. 그날 쓴 플래너를 다시 찍어서 내 줘.')
    : c.r === 'dup' ? (nm + ', ' + pfMD(c.day) + '에 낸 플래너가 ' + pfMD(d0.day) + '에 낸 것과 같은 쪽이야. 그날 쓴 플래너를 다시 찍어서 내 줘.')
    : (nm + ', ' + pfMD(c.day) + ' 플래너에 날짜가 ' + (c.r === 'noDate' ? '안 보여' : '그날과 달라') + '. 두 장 모두 맨 위에 날짜를 쓰고 다시 내 줘.');
  var done = function(){ try { plToast('💬 복사했습니다 — 카톡에 붙여 넣으세요'); } catch(e){} };
  try { navigator.clipboard.writeText(msg).then(done, function(){ prompt('복사해서 보내세요', msg); }); } catch(e){ prompt('복사해서 보내세요', msg); }
};
function pfPhotos(urls, cap, hot){
  if (!urls || !urls.length) return '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:12px;font-weight:700;background:#f8fafc;border-radius:8px">사진 없음</div>';
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + urls.slice(0, 2).map(function(u){
    return '<a href="' + pfE(u) + '" target="_blank" rel="noopener" title="새 창에서 크게" style="flex:1;min-width:120px"><img src="' + pfE(u) + '" loading="lazy" alt="' + pfE(cap) + '" style="width:100%;max-height:340px;object-fit:contain;background:#fff;border-radius:8px;border:2px solid ' + (hot ? '#fca5a5' : '#e2e8f0') + '"></a>'; }).join('') + '</div>';
}
function pfCard(c){
  var a = c.a, d0 = a.zeroDup || {}, st = c.st, open = !!PF.open[c.key];
  var p2 = d0.setId ? (st.lumen_planner_photos || []).find(function(x){ return x && x.setId === d0.setId; }) : null, a2 = (p2 && p2.analysis) || {};
  var tag = '<span style="font-size:11.5px;font-weight:900;border-radius:6px;padding:1px 8px;background:' + (c.lie ? '#fde8e8;color:#c81e1e' : '#fdf1d8;color:#b45309') + '">' + pfReasonTag(c) + '</span>';
  var stt = c.ok ? '<span style="font-size:11.5px;font-weight:900;border-radius:6px;padding:1px 8px;background:#e5e7eb;color:#475569">⛔ 0점 확정 ' + pfMD(c.ok) + '</span>'
    : (a.zeroWarn && !a.zeroDay ? '<span style="font-size:11.5px;font-weight:900;border-radius:6px;padding:1px 8px;background:#fef9c3;color:#92400e">경고만(점수 그대로)</span>' : '<span style="font-size:11.5px;font-weight:900;border-radius:6px;padding:1px 8px;background:#fdf1d8;color:#b45309">확인 전</span>');
  var h = '<div style="background:#fff;border:1.5px solid ' + (c.ok ? '#e2e8f0' : (c.lie ? '#fca5a5' : '#fde68a')) + ';border-radius:12px;padding:11px 14px;margin-bottom:10px">';
  h += '<div onclick="pfToggle(\'' + pfE(c.key).replace(/'/g, '') + '\')" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;cursor:pointer"><b style="font-size:15px;color:#0d2240">' + pfE(st.name) + ' · ' + pfMD(c.day) + ' 제출</b>' + tag + stt
    + '<span style="font-size:12px;color:#64748b;font-weight:700">' + pfE(plzReasonKo(a)) + '</span><span style="margin-left:auto;color:#94a3b8;font-weight:900">' + (open ? '▲' : '▼') + '</span></div>';
  if (!open) return h + '</div>';
  h += '<div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:10px">';
  h += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:6px;font-size:12px;font-weight:800;margin-bottom:6px"><span>이번에 낸 것 · ' + pfMD(c.day) + ' 제출</span><span style="color:#c81e1e">적힌 날짜 ' + pfE(a.date || '없음') + '</span></div>' + pfPhotos(c.p.urls, '이번 제출', true) + '</div>';
  if (p2) h += '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:8px;background:#f8fafc"><div style="display:flex;justify-content:space-between;gap:6px;font-size:12px;font-weight:800;margin-bottom:6px"><span>' + (c.r === 'sameDate' ? '먼저 낸 것' : '같다고 본 것') + ' · ' + pfMD(plzSetDay(p2.setId)) + ' 제출</span><span>적힌 날짜 ' + pfE(a2.date || '—') + '</span></div>' + pfPhotos(p2.urls, '먼저 낸 것', false) + '</div>';
  else h += '<div style="border:1px dashed #e2e8f0;border-radius:10px;padding:14px;font-size:12.5px;color:#64748b;font-weight:700;line-height:1.7">' + (c.lie ? '비교할 예전 사진을 찾지 못했습니다(지워졌거나 오래됨).' : '날짜 문제 — 비교할 사진 없음.<br>사진 맨 위 날짜 칸을 확인하세요.') + '</div>';
  h += '</div>';
  if (c.lie){
    var ln = [];
    if (d0.sim != null) ln.push('글이 같은 정도 <b>' + d0.sim + '%</b><span style="display:inline-block;width:120px;height:8px;border-radius:4px;background:#e5e7eb;vertical-align:1px;margin-left:6px;overflow:hidden"><i style="display:block;height:100%;width:' + Math.min(100, +d0.sim || 0) + '%;background:#c81e1e"></i></span>');
    if (d0.hd != null && d0.hd < 99) ln.push('사진 지문 차이 <b>' + d0.hd + '</b> <span style="color:#94a3b8">(' + (window.PLZ ? PLZ.HASH_DIST : 8) + ' 이하면 같은 사진으로 봄)</span>');
    if (c.r === 'sameDate') ln.push('적힌 날짜 <b>같음</b>');
    if (ln.length) h += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:#334155">' + ln.join('') + '</div>';
    var t1 = (a.tasksTranscript || []).concat(a.totalTime ? ['TOTAL ' + a.totalTime] : []), t2 = (a2.tasksTranscript || []).concat(a2.totalTime ? ['TOTAL ' + a2.totalTime] : []);
    var norm = function(s){ return String(s).replace(/\s+/g, ''); }, set2 = {}; t2.forEach(function(x){ set2[norm(x)] = 1; });
    if (t1.length) h += '<div style="margin-top:8px;font-size:12.5px;background:#f8fafc;border-radius:8px;padding:7px 10px;line-height:1.85">AI 가 읽은 할 일 — 예전 것과 겹친 줄 빨강: '
      + t1.map(function(x){ return set2[norm(x)] ? '<mark style="background:#fde2e2;color:#c81e1e;border-radius:3px;padding:0 3px">' + pfE(x) + '</mark>' : pfE(x); }).join(' · ') + '</div>';
  }
  var sq = "'" + st.id + "','" + String(c.p.setId).replace(/'/g, '') + "'";
  var b = function(t, f, sty){ return '<button type="button" onclick="' + f + '" style="font-family:inherit;font-size:12.5px;font-weight:900;border-radius:9px;padding:6px 12px;cursor:pointer;' + sty + '">' + t + '</button>'; };
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'
    + (c.ok ? b('↩ 확정 취소', 'pfConfirm(' + sq + ')', 'border:1.5px solid #cbd5e1;background:#fff;color:#475569') : b('⛔ ' + (c.lie ? '거짓 맞음' : '날짜 문제 맞음') + ' — 0점 확정', 'pfConfirm(' + sq + ')', 'border:none;background:#c81e1e;color:#fff'))
    + b('↩ 다른 날 맞음 — 점수 되살리기', 'if(confirm(\'이 세트를 정상으로 되돌리고 원래 점수를 살릴까요?\'))plzClear(' + sq + ')', 'border:1.5px solid #15803d;background:#fff;color:#15803d')
    + b('💬 학생에게 보낼 말 복사', 'pfCopy(' + sq + ')', 'border:1.5px solid #cbd5e1;background:#fff;color:#475569') + '</div>';
  return h + '</div>';
}
function rPlannerFake(){
  var all = pfCases(), byS = {};
  all.forEach(function(c){ var k = c.st.id; (byS[k] = byS[k] || { st: c.st, lie: 0, date: 0, todo: 0 }); if (c.lie) byS[k].lie++; else byS[k].date++; if (!c.ok) byS[k].todo++; });
  var match = function(c){ if (PF.filter === 'todo') return !c.ok; if (PF.filter === 'lie') return c.lie; if (PF.filter === 'date') return !c.lie; return true; };
  var list = all.filter(function(c){ return match(c) && (!PF.stu || c.st.id === PF.stu); });
  var studs = Object.keys(byS).map(function(k){ return byS[k]; }).sort(function(a, b){ return (b.todo - a.todo) || (b.lie - a.lie); });
  var h = '<div style="padding:16px 20px 40px;max-width:1300px">';
  h += '<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px"><b style="font-size:20px;color:#0d2240">📛 플래너 거짓 제출</b><span style="font-size:12px;color:#64748b;font-weight:700">최근 30일 · 같은 날짜 또 냄 · 같은 쪽 다시 냄 (날짜 없음·다른 날짜는 «날짜 문제»로 따로)</span></div>';
  h += '<div style="display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start">';
  /* 왼쪽 */
  var todo = all.filter(function(c){ return !c.ok; }).length;
  h += '<div style="background:#fbfcfe;border:1px solid #e2e8f0;border-radius:12px;padding:10px">';
  h += '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:8px">' + [[todo, '확인 전'], [studs.length, '학생'], [all.length, '30일 전체']].map(function(x){ return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:5px 7px;font-size:11px;color:#64748b;font-weight:700"><b style="display:block;font-size:17px;color:#0d2240">' + x[0] + '</b>' + x[1] + '</div>'; }).join('') + '</div>';
  h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">' + [['todo', '확인 전'], ['all', '전체'], ['lie', '거짓(같은 날짜·쪽)'], ['date', '날짜 문제']].map(function(f){ var on = PF.filter === f[0];
    return '<button type="button" onclick="pfSet(\'filter\',\'' + f[0] + '\')" style="font-family:inherit;font-size:11.5px;font-weight:800;border-radius:14px;padding:2px 9px;cursor:pointer;border:1px solid ' + (on ? '#c81e1e' : '#e2e8f0') + ';background:' + (on ? '#fde8e8' : '#fff') + ';color:' + (on ? '#c81e1e' : '#475569') + '">' + f[1] + '</button>'; }).join('') + '</div>';
  h += '<button type="button" onclick="pfSet(\'stu\',\'\')" style="width:100%;text-align:left;font-family:inherit;font-size:13px;font-weight:800;border-radius:9px;padding:6px 10px;margin-bottom:5px;cursor:pointer;border:1.5px solid ' + (!PF.stu ? '#1d4ed8' : '#e2e8f0') + ';background:#fff">전체 학생</button>';
  studs.forEach(function(s){ var on = PF.stu === s.st.id;
    h += '<button type="button" onclick="pfSet(\'stu\',\'' + s.st.id + '\')" style="width:100%;display:flex;align-items:center;gap:8px;text-align:left;font-family:inherit;border-radius:10px;padding:6px 10px;margin-bottom:5px;cursor:pointer;border:1.5px solid ' + (on ? '#1d4ed8' : '#e2e8f0') + ';background:#fff">'
      + '<span><b style="font-size:14.5px;color:#0d2240">' + pfE(s.st.name) + (s.lie >= 3 ? ' <span title="30일에 거짓 3건 이상" style="color:#c81e1e">●</span>' : '') + '</b><small style="display:block;color:#64748b;font-size:11px;font-weight:700">' + pfE(s.st.group || '') + ' · 거짓 ' + s.lie + ' · 날짜 ' + s.date + '</small></span>'
      + (s.todo ? '<span style="margin-left:auto;font-weight:900;color:#c81e1e">' + s.todo + '</span>' : '<span style="margin-left:auto;color:#15803d;font-weight:900">✓</span>') + '</button>'; });
  if (!studs.length) h += '<div style="font-size:12.5px;color:#15803d;font-weight:800;padding:8px">최근 30일 거짓 제출이 없습니다 🎉</div>';
  h += '<div style="font-size:11px;color:#94a3b8;font-weight:700;line-height:1.6;margin-top:6px">● = 30일에 거짓 3건 이상 · 📞 학부모 상담 메모에 확정/확인 전으로 들어갑니다</div></div>';
  /* 오른쪽 */
  h += '<div>';
  if (!list.length) h += '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:30px;text-align:center;color:#64748b;font-weight:800">' + (PF.filter === 'todo' ? '확인할 것이 없습니다 ✓ — «전체»에서 지난 것을 볼 수 있어요' : '해당하는 제출이 없습니다') + '</div>';
  list.forEach(function(c){ h += pfCard(c); });
  h += '<div style="font-size:11.5px;color:#64748b;font-weight:700;background:#f8fafc;border-radius:8px;padding:8px 11px;line-height:1.7">«⛔ 0점 확정»은 원장님이 사진을 보고 확인했다는 표시입니다(점수는 이미 0점). «↩ 다른 날 맞음»을 누르면 원래 점수로 돌아가고 이 목록에서 빠집니다. 학생앱의 0점 표시는 예전처럼 승인한 세트에만 나갑니다.</div>';
  return h + '</div></div></div>';
}
/* 승인 카드 «⛔ 그날 0점» 띠에 바로 가기 */
var _plzCardHtml162 = window.plzCardHtml;
window.plzCardHtml = function(a, stId, setId){
  var h = _plzCardHtml162(a, stId, setId);
  if (!h || !a || a.zeroCleared || !(a.zeroDay || a.zeroWarn) || !(PF_LIE[a.zeroReason] || PF_DATE[a.zeroReason])) return h;
  return h + '<button type="button" onclick="pfOpen(\'' + stId + '\',\'' + String(setId).replace(/'/g, '') + '\')" style="margin:-2px 0 8px;border:1.5px solid #1d4ed8;background:#fff;color:#1d4ed8;border-radius:8px;padding:4px 11px;font-size:11.5px;font-weight:900;cursor:pointer;font-family:inherit">📛 사진 나란히 확인 ›</button>';
};
/* 🔔 알림 · 🚨 위험 신호 → 그 학생 카드 */
var _alGo160 = window.alGo;
window.alGo = function(i){
  var a = (AL._last || [])[i];
  if (a && (a.k === 'plz' || a.k === 'plzlie')){ try { alPopClose(); } catch(e){} pfOpen(a.st.id); return; }
  return _alGo160(i);
};
var _riskGo = window.riskGo;
window.riskGo = function(v, stId){ if (v === 'planner' && stId){ pfOpen(stId); return; } return _riskGo(v); };
/* 학부모 상담 메모 — 확정 / 확인 전 나눠 적기 */
if (typeof crCompute === 'function'){
  var _crCompute161 = crCompute;
  crCompute = function(){
    var X = _crCompute161(); if (!X || !X.memo) return X;
    try {
      var cs = pfCases().filter(function(c){ return c.st === X.st && c.lie && c.day >= X.from; });
      X.memo = X.memo.filter(function(m){ return m.indexOf('<b>플래너</b>') !== 0; });
      if (cs.length){ var okL = cs.filter(function(c){ return c.ok; }), noL = cs.filter(function(c){ return !c.ok; });
        X.memo.unshift('<b>플래너 거짓 제출</b>: ' + (okL.length ? '확정 ' + okL.map(function(c){ return pfMD(c.day); }).join('·') : '') + (okL.length && noL.length ? ' / ' : '') + (noL.length ? '확인 전 ' + noL.map(function(c){ return pfMD(c.day); }).join('·') : '')
          + ' — <a href="#" onclick="pfOpen(\'' + X.st.id + '\');return false" style="color:#1d4ed8;font-weight:800">사진 나란히 확인 ›</a>'); }
    } catch(e){}
    return X;
  };
}
