/* ═══════════════════════════════════════════════════════════════════
 * v19-166: 주간 점수 «체크하기» — 지난 수업 날 놓친 종이 체크 · «…» 창 잘림 · 📛 거짓 제출 사진 (원장 2026-10-27)
 *   「내가 깜빡하고 체크를 못 한 것을 다시 체크하려고 할 때 찾지 못한다 — 어제 월수금 체크를 못 하였다」
 *   「(…) 화면에서 잘린다」 · 「플래너 거짓 체크에서 사진이 안 보인다」
 *  ① 📔 순공 종이 카드 위에 «📅 어느 수업 날?» 날짜 칩 — 종이 마감 주(W+7 월요일)부터 오늘까지 수업이 있던 날마다
 *     (그날 반 · 아직 체크 안 한 학생 수). 칩을 누르면 그날 수업 반 학생으로 카드가 바뀐다.
 *     지난 날을 고른 채 «📔 가져옴» = 가져온 날을 «그 수업 날»로 적는다(오늘 적으면 첫 수업 지나 지각 2점이 되므로) · 실제 누른 시각은 chk 에.
 *     «안 가져옴» = miss 를 그 수업 날로. 오늘이 아닌 날에 놓친 학생이 있으면 칩이 빨갛게 + 한 줄 안내.
 *  ② «…» 창: 열 때 둘레 상자 밖으로 나가면 반대쪽(왼쪽 맞춤 · 위로)으로 · 다른 «…» 는 닫는다.
 *  ③ 📛 거짓 제출 카드: 등록부의 사진 주소(urls)가 비어 있으면(서버 등록부는 용량 때문에 비워 둠)
 *     Storage photos/<코드>/ 에서 setId 가 든 파일을 찾아 보여 준다(승인 화면과 같은 방법 · 등록부에는 안 적는다).
 *  ※ 바탕 함수는 감싸기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
WKC.day = ''; WKC.dayOf = '';
function wkcSelDay(){ var t = PW.day(); if (WKC.dayOf !== t){ WKC.day = ''; WKC.dayOf = t; } return WKC.day || t; }
function wkcGroupsOn(d){
  var jd = (PW.dow(d) + 1) % 7, days = PWB.days || {};
  return Object.keys(days).filter(function(g){ return Array.isArray(days[g]) && days[g].indexOf(jd) >= 0; });
}
/* 그날(d) 수업 반 학생 중 종이 체크 안 한 학생 */
function wkcPaperLeftOn(d, W){
  var gs = wkcGroupsOn(d); if (!gs.length) return { gs: gs, left: [] };
  var left = pwlAll().filter(function(st){
    if (gs.indexOf(String(st.group || '')) < 0) return false;
    var r = ((PWB.paper.byCode || {})[st.lumen_rec_code] || {})[W] || {};
    return !r.at && !(r.miss && r.miss >= d);
  });
  return { gs: gs, left: left };
}
/* 종이 마감 주(W 다음 주 월요일)부터 오늘까지 수업 있던 날 */
function wkcPaperDays(W){
  var out = [], d = PW.add(W, 7), t = PW.day();
  for (var i = 0; i < 7 && d <= t; i++, d = PW.add(d, 1)){ var o = wkcPaperLeftOn(d, W); if (o.gs.length) out.push({ d: d, gs: o.gs, n: o.left.length }); }
  return out;
}
window.wkcDay = function(d){ WKC.day = (d === PW.day()) ? '' : d; WKC.dayOf = PW.day(); WKC.todayOnly = true; render(); };

/* 오늘 대신 «고른 수업 날» 반으로 */
var _wkcClassGroups165 = wkcClassGroups;
window.wkcClassGroups = function(){ var d = wkcSelDay(); return d === PW.day() ? _wkcClassGroups165() : wkcGroupsOn(d); };
var _wkcTasks165 = wkcTasks;
window.wkcTasks = function(){
  var T = _wkcTasks165(), d = wkcSelDay(); if (d === PW.day()) return T;
  /* 지난 날: 그날 반 · 그날 이후 체크 = 끝 */
  var W = T.W, all = pwlAll(), cg = T.cg;
  var scoped = (WKC.todayOnly && cg.length) ? all.filter(function(s){ return cg.indexOf(String(s.group || '')) >= 0; }) : all;
  var paper = { rows: [], left: 0, nAt: 0, nMiss: 0, scope: (WKC.todayOnly && cg.length) ? cg : null };
  scoped.forEach(function(st){
    var c = st.lumen_rec_code, r = ((PWB.paper.byCode || {})[c] || {})[W] || {}, brought = !!r.at, missD = !!(r.miss && r.miss >= d);
    if (!brought && !missD){ paper.rows.push({ st: st, c: c, state: 'left' }); paper.left++; }
    else if ((brought && PW.dayOfIso(r.at) === d) || r.miss === d){ paper.rows.push({ st: st, c: c, state: brought ? 'at' : 'miss' }); if (brought) paper.nAt++; else paper.nMiss++; }
  });
  paper.rows.sort(function(a, b){ return ((a.state === 'left' ? 0 : 1) - (b.state === 'left' ? 0 : 1)) || String(a.st.name || '').localeCompare(String(b.st.name || ''), 'ko'); });
  T.n += paper.left - T.paper.left; T.paper = paper;
  return T;
};
/* 지난 날 «가져옴» / «안 가져옴» = 그 수업 날로 적는다 */
var _plwPaper165 = plwPaper;
window.plwPaper = function(code){
  var d = wkcSelDay(); if (d === PW.day() || VIEW !== 'plweek') return _plwPaper165(code);
  var W = PWB.W || plwDefaultW(); PWB._lastPaperCode = code;
  return plwSavePaper(function(v){
    v.byCode[code] = v.byCode[code] || {};
    var k = v.byCode[code][W] || {}, rec = { at: d + 'T20:00:00+09:00', chk: new Date().toISOString(), back: d };
    if (k.pov){ rec.pov = k.pov; if (k.povWhy) rec.povWhy = k.povWhy; if (k.povAt) rec.povAt = k.povAt; }
    v.byCode[code][W] = rec;
  });
};
var _wkcPaperMiss165 = wkcPaperMiss;
window.wkcPaperMiss = function(code){
  var d = wkcSelDay(); if (d === PW.day()) return _wkcPaperMiss165(code);
  var W = PWB.W || plwDefaultW(); PWB._lastPaperCode = code;
  return plwSavePaper(function(v){
    v.byCode[code] = v.byCode[code] || {};
    var rec = v.byCode[code][W] || {};
    delete rec.at; delete rec.ov; rec.miss = d;
    v.byCode[code][W] = rec;
  });
};
/* 날짜 칩 */
var _wkcCheckHtml165 = wkcCheckHtml;
window.wkcCheckHtml = function(){
  var h = _wkcCheckHtml165(), W = PWB.W || plwDefaultW(), t = PW.day(), sel = wkcSelDay(), ds = wkcPaperDays(W);
  if (!ds.length) return h;
  var DW = ['월','화','수','목','금','토','일'], lab = function(d){ return DW[PW.dow(d)] + ' ' + PW.md(d); };
  var miss = ds.filter(function(x){ return x.d < t && x.n; });
  var c = '<div class="wkc-days" role="group" aria-label="어느 수업 날"><span class="wkc-dl">📅 어느 수업 날?</span>';
  ds.forEach(function(x){
    var on = x.d === sel;
    c += '<button type="button" class="wkc-dc' + (on ? ' on' : '') + (x.d < t && x.n ? ' red' : '') + '" data-day="' + x.d + '" onclick="wkcDay(\'' + x.d + '\')">'
      + lab(x.d) + (x.d === t ? ' (오늘)' : '') + '<small>' + wppEsc(x.gs.join('·')) + ' · ' + (x.n ? '남은 ' + x.n + '명' : '✓') + '</small></button>';
  });
  c += '</div>';
  if (sel === t && miss.length) c += '<div class="wkc-dmiss">⚠ 체크 못 한 날이 있어요 — ' + miss.map(function(x){ return lab(x.d) + ' ' + x.n + '명'; }).join(' · ') + ' · 날짜를 누르면 그날 반이 나와요</div>';
  if (sel !== t) c += '<div class="wkc-dback">⏪ ' + lab(sel) + ' 수업 체크 — «가져옴»은 ' + PW.md(sel) + '에 가져온 것으로 적어요(점수 그날 기준)</div>';
  if (sel !== t) h = h.replace('오늘 수업 반만 (', lab(sel) + ' 수업 반만 (').replace('오늘 수업 반 ', lab(sel) + ' 수업 반 ').split('<em>오늘 수업</em>').join('<em>' + lab(sel) + ' 수업</em>');
  var i = h.indexOf('data-task="paper"'), j = i >= 0 ? h.indexOf('</summary>', i) : -1;
  if (j < 0) return h;
  j += 10;
  return h.slice(0, j) + c + h.slice(j);
};
(function(){
  var css = '.wkc-days{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0 4px}.wkc-dl{font-size:12px;font-weight:900;color:#9a3412}'
    + '.wkc-dc{font:inherit;font-size:12.5px;font-weight:900;border:1.5px solid #fed7aa;background:#fff;color:#9a3412;border-radius:10px;padding:4px 10px;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;line-height:1.3}'
    + '.wkc-dc small{font-size:10.5px;font-weight:700;color:#64748b}.wkc-dc.on{background:#9a3412;border-color:#9a3412;color:#fff}.wkc-dc.on small{color:#ffedd5}'
    + '.wkc-dc.red{border-color:#fca5a5;background:#fef2f2;color:#b91c1c}.wkc-dc.red small{color:#b91c1c}.wkc-dc.red.on{background:#b91c1c;color:#fff}.wkc-dc.red.on small{color:#fee2e2}'
    + '.wkc-dmiss{font-size:12px;font-weight:800;color:#b91c1c;margin:2px 0 4px}.wkc-dback{font-size:12px;font-weight:800;color:#9a3412;background:#fff7ed;border-radius:8px;padding:5px 9px;margin:2px 0 4px}';
  try { var s = document.createElement('style'); s.id = 'wkc166-css'; s.textContent = css; document.head.appendChild(s); } catch(e){}
})();

/* ② «…» 창 — 둘레 상자 밖으로 나가면 반대쪽으로 · 하나만 열기 */
function wkcClipBox(el){
  var b = { l: -1e9, r: 1e9, t: -1e9, b: 1e9 }, p = el.parentElement;
  while (p && p !== document.documentElement){
    var cs = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)){
      var r = p.getBoundingClientRect(); b.l = Math.max(b.l, r.left); b.r = Math.min(b.r, r.right); b.t = Math.max(b.t, r.top); b.b = Math.min(b.b, r.bottom);
    }
    p = p.parentElement;
  }
  return b;
}
window.wkcFitPop = function(det){
  var pop = det && det.querySelector('.wkc-pop'); if (!pop) return;
  pop.style.left = ''; pop.style.right = ''; pop.style.top = ''; pop.style.bottom = '';
  var b = wkcClipBox(det), r = pop.getBoundingClientRect();
  if (r.left < b.l + 4){ pop.style.right = 'auto'; pop.style.left = '0'; r = pop.getBoundingClientRect();
    if (r.right > b.r - 4){ var sr = det.getBoundingClientRect(), z = (sr.width / (det.offsetWidth || sr.width)) || 1; pop.style.left = Math.round((b.l + 4 - sr.left) / z) + 'px'; } }
  r = pop.getBoundingClientRect();
  if (r.bottom > b.b - 4 && det.getBoundingClientRect().top - r.height - 8 > b.t){ pop.style.top = 'auto'; pop.style.bottom = 'calc(100% + 4px)'; }
};
document.addEventListener('toggle', function(e){
  var d = e.target; if (!d || !d.classList || !d.classList.contains('wkc-more') || !d.open) return;
  try { document.querySelectorAll('details.wkc-more[open]').forEach(function(o){ if (o !== d) o.open = false; }); } catch(_){}
  try { wkcFitPop(d); } catch(_){}
}, true);

/* ③ 📛 거짓 제출 — 사진 주소를 Storage 에서 */
PF.ph = PF.ph || {};
function pfFiles(code){
  var o = PF.ph[code]; if (o) return o.files || null;
  o = PF.ph[code] = { files: null };
  (async function(){
    try {
      var sb = getSupaClient(); if (!sb) throw new Error('no client');
      var r = await sb.storage.from('photos').list(code, { limit: 2000, sortBy: { column: 'created_at', order: 'desc' } });
      o.files = ((r && r.data) || []).map(function(f){ return f && f.name; }).filter(function(n){ return n && n !== '.emptyFolderPlaceholder'; });
    } catch(e){ o.files = []; o.err = String(e && e.message || e); }
    if (VIEW === 'planner' && typeof PLANNER_VIEW !== 'undefined' && PLANNER_VIEW === 'fake') render();
  })();
  return null;
}
function pfUrlsOf(code, setId){
  var fs = pfFiles(code); if (!fs) return null;
  var rk = function(n){ return /_today/.test(n) || /_photo1/.test(n) ? 0 : (/_tomorrow/.test(n) || /_photo2/.test(n) ? 1 : 2); };
  var sb = null; try { sb = getSupaClient(); } catch(e){}
  return fs.filter(function(n){ return n.indexOf(setId) >= 0; }).sort(function(a, b){ return (rk(a) - rk(b)) || a.localeCompare(b); })
    .map(function(n){ try { return sb.storage.from('photos').getPublicUrl(code + '/' + n).data.publicUrl; } catch(e){ return ''; } }).filter(Boolean);
}
var _pfCard163 = pfCard;
pfCard = function(c){
  if (!PF.open[c.key]) return _pfCard163(c);
  var st = c.st, code = st.lumen_rec_code, d0 = (c.a && c.a.zeroDup) || {}, wait = false;
  var fill = function(p){ if (!p || (p.urls && p.urls.length) || !code) return p; var u = pfUrlsOf(code, p.setId); if (u === null){ wait = true; return p; } return Object.assign({}, p, { urls: u }); };
  var p1 = fill(c.p), list = (st.lumen_planner_photos || []).map(function(x){ return (x && d0.setId && x.setId === d0.setId) ? fill(x) : x; });
  var st2 = Object.create(st); st2.lumen_planner_photos = list;
  var h = _pfCard163(Object.assign({}, c, { p: p1, st: st2 }));
  if (wait) h = h.replace(/>사진 없음</g, '>📷 사진 불러오는 중…<');
  return h;
};
