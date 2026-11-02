/* ═══════════════════════════════════════════════════════════════════
 * v19-171: 📚 숙제 한 바퀴 1판 — 숙제 내주기 · 학습지 자동 숙제 · 2차 확인(거울) · 셀프 체크 XP
 * 계약: docs/hw_dispatch_contract.md (§3 의 1·2·5, §4 거울, §5 XP) · 시안 docs/mockup_hw_dispatch.html 화면 1·3
 *  · 숙제 = 할 일 보드 카드(todo_<코드>.items[]) 에 hw:true. 새 서버 표 없음.
 *  · 내주기: 할 일 보드 탭 칩 「📚 숙제 내주기」 + 학생 상세 머리 단추. 교재(mf_swb_, 없으면 or_books) · 이번 주 7칸 쪽 from~to ·
 *    📄 프린트 · 「보내기」 → 날짜마다 카드 1장(id hw:<날짜>:<bookId|제목>, src 'hw'). 같은 id 는 덮어쓴다(고쳐 보내기).
 *  · 학습지: a:ws:* 카드 중 태그 HOMEWORK 면 자동 hw:true · n · 마감 = 배정일 뒤 첫 수업일(lumen_group_days). 「숙제로 넣기/빼기」는 hwMan:true.
 *  · 2차 확인(숙제체크): 그날 마감 숙제 카드 줄 — 학생 셀프(초록) · 선생님(파랑 ✓/빨강 ✗) 4칸 · 문항 · 맞은 수.
 *    「학생 체크 그대로 ✓」 → thw = 학생 hw · tst 'ok' · 거울 lumen_hw[날짜]={p,c,w} (평균을 0/30/60/100 으로) · lumen_hw_at (hwcSave 길 그대로).
 *  · XP: calcXP 를 감싸 todo_st_<코드> 의 hw 단계 100 하나마다 +5.
 *  · 기능 스위치: stu_features.hw (기본 꺼짐) — 「🎛 기능 켜고 끄기」 화면에 todo 와 같은 모양으로.
 *  ※ 바탕 코드는 고치지 않고 감싼다. 문자열 연결로만 HTML 을 만든다(템플릿 리터럴 금지). 서버 질문은 render 때마다 다시 보내지 않는다.
 * ═══════════════════════════════════════════════════════════════════ */
var HWL = { cls:'', sel:{}, stu:null, book:'', week:null, days:{}, prints:[], pn:{ t:'', n:'', d:'' }, date:null, autoAt:0, busy:false, fold:{} };
var HWL_STEP = [['p','풀이'],['c','채점'],['w','오답'],['a','아하']];
var HWL_DOW = ['일','월','화','수','목','금','토'];
var HWL_TAG = { HOMEWORK:'숙제', WEEKLY_TEST:'주간테스트', TEST:'테스트', DAILY:'일일', ETC:'기타' };

/* ── 날짜 도우미 (KST 기준의 YYYY-MM-DD) ── */
function hwlToday(){ var d = new Date(Date.now() + 9 * 3600000); return d.toISOString().slice(0, 10); }
function hwlAdd(iso, n){ var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function hwlDow(iso){ return new Date(iso + 'T00:00:00Z').getUTCDay(); }
function hwlMonday(iso){ return hwlAdd(iso, -((hwlDow(iso) + 6) % 7)); }
function hwlMD(iso){ return iso ? (String(iso).slice(5).replace(/^0/, '').replace('-', '/').replace('/0', '/')) : ''; }
function hwlEsc(s){ return (typeof esc2 === 'function') ? esc2(s) : String(s == null ? '' : s).replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
function hwlQ(s){ return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
/* 반 요일표 — 이 기기 사본(groupDays) */
function hwlGroupDays(group){
  var gd = null; try { gd = (typeof groupDays !== 'undefined' && groupDays) ? groupDays : null; } catch(e){}
  if (!gd) { try { gd = JSON.parse(localStorage.getItem('lumen_group_days') || '{}'); } catch(e){ gd = {}; } }
  var d = gd[String(group || '').trim()];
  if (!(Array.isArray(d) && d.length)) { try { if (typeof WT !== 'undefined' && WT && WT.days) d = WT.days[String(group || '').trim()]; } catch(e){} }   /* 기기 사본이 없으면 오답 쌍둥이 부품이 서버에서 읽어 둔 것 */
  return (Array.isArray(d) && d.length) ? d.map(Number) : null;
}
/* 배정일 뒤 첫 수업일 (계약 §2-1·결정 B). 반을 모르면 +3일 */
function hwlNextClass(group, fromIso){
  var days = hwlGroupDays(group);
  if (!days) return hwlAdd(fromIso, 3);
  for (var i = 1; i <= 7; i++) { var d = hwlAdd(fromIso, i); if (days.indexOf(hwlDow(d)) >= 0) return d; }
  return hwlAdd(fromIso, 3);
}
function hwlStu(code){ return (typeof tdStuByCode === 'function') ? tdStuByCode(code) : null; }
function hwlRound(v){ var best = 0, bd = 999; [0, 30, 60, 100].forEach(function(x){ var d = Math.abs(x - v); if (d < bd) { bd = d; best = x; } }); return best; }
function hwlSlug(s){ return String(s || '').replace(/\s+/g, '').replace(/[^0-9A-Za-z가-힣]/g, '').slice(0, 24) || 'book'; }

/* ── 카드 ── */
function hwlItems(code){ return (TD.items && TD.items[code]) || []; }
function hwlCardsDue(code, date){ return hwlItems(code).filter(function(it){ return it && it.hw && it.due === date; }); }
function hwlSelfHw(code, it){ var s = ((TD.st || {})[code] || {})[it.id]; return (s && s.hw && typeof s.hw === 'object') ? s.hw : null; }
function hwlWsOf(code, it){
  var list = (typeof WSG !== 'undefined' && WSG.wsq && WSG.wsq[code]) || [];
  for (var i = 0; i < list.length; i++) { var w = list[i]; if (!w) continue; var wid = String(w.wid != null ? w.wid : ('sw' + w.swId)); if (wid === String(it.wid) || ('a:ws:' + wid) === it.id) return w; }
  return null;
}
/* 교재 카드의 쪽들 (HWB.swb) — bookId 가 있으면 그것, 없으면 제목으로 */
function hwlBookPages(code, it){
  var books = (typeof HWB !== 'undefined' && HWB.swb && HWB.swb[code]) || [];
  var q = String(it.book || it.title || '').replace(/\s+/g, '').toLowerCase();
  var from = Number(it.from), to = (it.to != null) ? Number(it.to) : from;
  var out = [];
  books.forEach(function(b){
    if (it.bookId != null && String(b.bid) !== String(it.bookId)) return;
    if (it.bookId == null) { var nm = String(b.title || '').replace(/\s+/g, '').toLowerCase(); if (!q || (nm.indexOf(q) < 0 && q.indexOf(nm) < 0)) return; }
    (b.pages || []).forEach(function(p){ var pg = parseInt(String(p.page || '').replace(/[^0-9]/g, ''), 10); if (pg >= from && pg <= to) out.push({ bid: b.bid, pid: String(p.pid), wpid: String(p.wpid), page: pg, st: p.st || '' }); });
  });
  return out;
}
/* 쪽별 문항 수 — 정답사전(mf_bookans_<bid>.pages[wpid].problems) 이 있을 때만. 모르면 null */
function hwlBookN(bid, pages){
  var a = (typeof HWB !== 'undefined' && HWB.ans && HWB.ans[bid]) || null; if (!a || !a.pages) return null;
  var n = 0, got = false;
  pages.forEach(function(p){ var pa = a.pages[p.wpid]; if (pa && Array.isArray(pa.problems)) { n += pa.problems.length; got = true; } });
  return got ? n : null;
}
/* 채점(c) 자동 ✓ 와 맞은 수 (계약 §2-2 — 저장하지 않고 화면에서 셈) */
function hwlAutoC(code, it){
  var sc = (typeof WSG !== 'undefined' && WSG.scores && WSG.scores[code]) || ((typeof HWB !== 'undefined' && HWB.scores && HWB.scores[code]) || {});
  var o = 0, tot = 0, auto = false;
  if (it.kind === 'ws') {
    var w = hwlWsOf(code, it);
    if (w) { var done = (w.o + w.x + w.q) > 0 || String(w._st || '').toUpperCase() === 'COMPLETE' || w.status === '학습완료'; if (done) { auto = true; o = Number(w.o) || 0; tot = (Number(w.o) || 0) + (Number(w.x) || 0) + (Number(w.q) || 0); } }
    var pre = 'ws_' + String((w && w.swId) || String(it.wid || '').replace(/^sw/, '')) + '_';
    var o2 = 0, t2 = 0;
    Object.keys(sc).forEach(function(k){ if (k.indexOf(pre) !== 0) return; t2++; if (String((sc[k] || {}).r || '').toUpperCase() === 'O') o2++; });
    if (t2) { auto = true; if (!tot) { o = o2; tot = t2; } }
  } else if (it.kind === 'book' && it.from != null) {
    var pids = {}; hwlBookPages(code, it).forEach(function(p){ pids[p.pid] = 1; });
    Object.keys(sc).forEach(function(k){ var pid = String(k).split('_')[0]; if (!pids[pid] || String(k).indexOf('ws_') === 0) return; tot++; if (String((sc[k] || {}).r || '').toUpperCase() === 'O') o++; });
    if (tot) auto = true;
  }
  return { auto: auto, right: tot ? (o + '/' + tot) : '' };
}
/* 학생 셀프 체크 값(채점 자동 ✓ 포함) */
function hwlSelfEff(code, it){
  var s = hwlSelfHw(code, it) || {}; var out = { p: Number(s.p) || 0, c: Number(s.c) || 0, w: Number(s.w) || 0, a: Number(s.a) || 0 };
  try { if (hwlAutoC(code, it).auto) out.c = 100; } catch(e){}
  return out;
}

/* ═══ 1. 내주기 화면 — 할 일 보드 탭 «📚 숙제 내주기» ═══ */
function hwlSelCodes(){ return Object.keys(HWL.sel).filter(function(c){ return HWL.sel[c] && hwlStu(c); }); }
function hwlEnsureWeek(){ if (!HWL.week) HWL.week = hwlMonday(hwlToday()); return HWL.week; }
/* 고른 학생들의 교재 (매쓰플랫 배정) → [{key, title, bid}] · 없으면 or_books 제목 */
function hwlBookOptions(codes){
  var seen = {}, out = [];
  codes.forEach(function(code){
    ((typeof HWB !== 'undefined' && HWB.swb && HWB.swb[code]) || []).forEach(function(b){ if (!b || b.bid == null) return; var k = 'b:' + b.bid; if (seen[k]) return; seen[k] = 1; out.push({ key: k, title: String(b.title || ('교재 ' + b.bid)), bid: b.bid }); });
  });
  if (!out.length) {
    var bl = []; try { bl = (typeof books !== 'undefined' && Array.isArray(books)) ? books : []; } catch(e){}
    bl.forEach(function(b){ var t = String((b && (b.title || b.name)) || '').trim(); if (!t) return; var k = 't:' + t; if (seen[k]) return; seen[k] = 1; out.push({ key: k, title: t, bid: null }); });
  }
  return out;
}
function hwlBookPick(codes){ var ops = hwlBookOptions(codes); if (!ops.length) return null; for (var i = 0; i < ops.length; i++) if (ops[i].key === HWL.book) return ops[i]; return ops[0]; }
/* 그 교재의 쪽 범위에 든 문항 수 — 고른 학생 중 정답사전이 있는 첫 학생 기준 */
function hwlAutoN(codes, book, from, to){
  if (!book || book.bid == null || !(from > 0)) return null;
  var it = { kind: 'book', bookId: book.bid, from: from, to: (to > 0 ? to : from) };
  for (var i = 0; i < codes.length; i++) { var pg = hwlBookPages(codes[i], it); if (pg.length) { var n = hwlBookN(book.bid, pg); if (n != null) return n; } }
  return null;
}
function hwlIn(label, id, val, extra){
  return '<label style="display:block;font-size:10.5px;font-weight:800;color:#64748b;min-width:0">' + label + '<input id="' + id + '" value="' + hwlEsc(val == null ? '' : val) + '" ' + (extra || '') + ' style="display:block;width:100%;box-sizing:border-box;margin-top:2px;font-family:inherit;font-size:12.5px;padding:6px 7px;border:1.5px solid #e6eaf1;border-radius:8px"></label>';
}
function rHwlDispatch(){
  var codes = hwlSelCodes();
  if (!codes.length && HWL.stu && hwlStu(HWL.stu)) { HWL.sel[HWL.stu] = 1; codes = [HWL.stu]; }
  if (!HWL.stu || codes.indexOf(HWL.stu) < 0) HWL.stu = codes[0] || null;
  var week = hwlEnsureWeek(), today = hwlToday();
  var h = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px">';
  h += '<div style="font-size:12px;color:#475569;font-weight:700;line-height:1.6">학생을 고르고 교재 쪽을 요일마다 적어 「📨 보내기」를 누르면 <b>날짜마다 숙제 카드 1장</b>이 학생앱 「📌 오늘 숙제」에 갑니다. 매쓰플랫 「숙제」 태그 학습지는 자동으로 붙습니다.</div>';
  h += '<span style="margin-left:auto"></span>';
  h += '<button onclick="hwlRefreshOpen()" title="매쓰플랫에서 학습지·교재 목록을 새로 받습니다 (서버 워커 · 1~2분)" style="font-family:inherit;font-size:12px;font-weight:900;border-radius:9px;padding:7px 12px;cursor:pointer;background:#047857;color:#fff;border:1px solid #047857">🔄 학습지·교재 목록 새로고침</button>';
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:minmax(220px,290px) minmax(0,1fr);gap:12px;align-items:start" class="hwl-grid">';
  /* ── 왼쪽: 학생 고르기 ── */
  h += '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:12px 14px;min-width:0">';
  h += '<div style="font-size:13px;font-weight:900;color:#0d2240;margin-bottom:7px">👤 누구에게 <span style="font-size:11px;color:#64748b;font-weight:700">' + codes.length + '명</span></div>';
  h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">' + tdChip('전체', !HWL.cls, "hwlCls('')");
  (typeof tdClsList === 'function' ? tdClsList() : []).forEach(function(c){ h += tdChip(hwlEsc(c.g) + ' <span style="opacity:.6">' + c.n + '</span>', HWL.cls === c.g, "hwlCls('" + hwlQ(c.g) + "')"); });
  h += '</div>';
  var list = (typeof tdActive === 'function' ? tdActive() : []).filter(function(s){ return !HWL.cls || (s.group || '') === HWL.cls; });
  h += '<div style="display:flex;gap:6px;margin-bottom:7px">' + tdBtn((HWL.cls ? hwlEsc(HWL.cls) + ' 반' : '보이는') + ' 전체 ✓', 'hwlSelAll(1)') + tdBtn('해제', 'hwlSelAll(0)') + '</div>';
  h += '<div style="display:flex;flex-direction:column;gap:3px;max-height:420px;overflow:auto">';
  list.forEach(function(s){
    var code = String(s.lumen_rec_code), on = !!HWL.sel[code], n = hwlItems(code).filter(function(it){ return it.hw && it.due >= today && it.tst !== 'ok'; }).length;
    h += '<label class="hwl-stu" style="display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;color:#0d2240;padding:5px 7px;border-radius:8px;cursor:pointer;background:' + (on ? '#eef2ff' : 'transparent') + '">'
      + '<input type="checkbox" ' + (on ? 'checked ' : '') + 'onchange="hwlTog(\'' + hwlQ(code) + '\',this.checked)">' + hwlEsc(s.name)
      + '<span style="font-size:10.5px;color:#94a3b8;font-weight:700">' + hwlEsc(s.group || '') + '</span>'
      + (n ? '<span style="margin-left:auto;font-size:10px;font-weight:900;color:#1d4ed8;background:#dbeafe;border-radius:5px;padding:1px 6px">숙제 ' + n + '</span>' : '') + '</label>';
  });
  if (!list.length) h += '<div style="font-size:12px;color:#94a3b8;font-weight:700">학생앱 코드가 있는 학생이 없습니다</div>';
  h += '</div></div>';
  /* ── 오른쪽: 교재 · 주간 7칸 · 프린트 · 보내기 · 학습지 ── */
  h += '<div style="min-width:0;display:flex;flex-direction:column;gap:12px">';
  h += '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:12px 14px">';
  var ops = hwlBookOptions(codes), bk = hwlBookPick(codes);
  if (bk) HWL.book = bk.key;
  h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:9px"><div style="font-size:13px;font-weight:900;color:#0d2240">📗 어떤 책을</div>';
  if (ops.length) {
    h += '<select id="hwl-book" onchange="hwlBookSel(this.value)" style="font-family:inherit;font-size:12.5px;padding:6px 8px;border:1.5px solid #e6eaf1;border-radius:9px;max-width:420px">';
    ops.forEach(function(o){ h += '<option value="' + hwlEsc(o.key) + '"' + (bk && bk.key === o.key ? ' selected' : '') + '>' + hwlEsc(o.title) + (o.bid != null ? '' : ' (등록부 교재)') + '</option>'; });
    h += '</select>';
    if (bk && bk.bid == null) h += '<span style="font-size:10.5px;color:#b45309;font-weight:800">매쓰플랫에 없는 교재 — 쪽 수만 적습니다(문항 수는 직접)</span>';
  } else h += '<span style="font-size:12px;color:#94a3b8;font-weight:700">' + (codes.length ? '이 학생의 교재 목록이 없습니다 — 「🔄 새로고침」을 눌러 보세요' : '학생을 먼저 골라 주세요') + '</span>';
  h += '</div>';
  h += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px"><button onclick="hwlWeek(-7)" style="width:26px;height:26px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:11px;font-weight:900;color:#64748b;cursor:pointer">◀</button>'
    + '<b style="font-size:12.5px;color:#0d2240">' + hwlMD(week) + ' ~ ' + hwlMD(hwlAdd(week, 6)) + '</b>'
    + '<button onclick="hwlWeek(7)" style="width:26px;height:26px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:11px;font-weight:900;color:#64748b;cursor:pointer">▶</button>'
    + '<span style="font-size:10.5px;color:#94a3b8;font-weight:700">쪽을 적은 날만 카드가 됩니다 · 문항 수는 매쓰플랫 쪽별 문항 수로 자동(없으면 직접)</span></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px" class="hwl-wk">';
  var grp0 = (hwlStu(HWL.stu) || {}).group || '';
  var cdays = hwlGroupDays(grp0);
  for (var i = 0; i < 7; i++) {
    var d = hwlAdd(week, i), dw = hwlDow(d), cls = cdays && cdays.indexOf(dw) >= 0, dv = HWL.days[d] || {};
    var autoN = hwlAutoN(codes, bk, Number(dv.f), Number(dv.t));
    h += '<div style="border:1.5px solid ' + (d === today ? '#fbbf24' : '#e6eaf1') + ';border-radius:10px;padding:6px 6px 7px;background:' + (cls ? '#f1f5f9' : (dw === 0 || dw === 6 ? '#fffbeb' : '#fff')) + ';min-width:0">'
      + '<div style="font-size:11px;font-weight:900;color:' + (dw === 0 ? '#dc2626' : dw === 6 ? '#2563eb' : '#0d2240') + ';display:flex;gap:4px;align-items:baseline">' + HWL_DOW[dw] + '<span style="font-size:9.5px;color:#94a3b8;font-weight:700">' + hwlMD(d) + '</span>' + (cls ? '<span style="font-size:9px;color:#64748b;font-weight:800;margin-left:auto">수업</span>' : '') + '</div>'
      + '<div style="display:flex;gap:3px;align-items:center;margin-top:4px"><input id="hwl-f-' + d + '" value="' + hwlEsc(dv.f || '') + '" placeholder="쪽" inputmode="numeric" oninput="hwlDay(\'' + d + '\',\'f\',this.value)" style="width:100%;min-width:0;font-family:inherit;font-size:12px;padding:5px 4px;border:1.5px solid #e6eaf1;border-radius:7px;text-align:center"><span style="font-size:10px;color:#94a3b8">~</span><input id="hwl-t-' + d + '" value="' + hwlEsc(dv.t || '') + '" placeholder="쪽" inputmode="numeric" oninput="hwlDay(\'' + d + '\',\'t\',this.value)" style="width:100%;min-width:0;font-family:inherit;font-size:12px;padding:5px 4px;border:1.5px solid #e6eaf1;border-radius:7px;text-align:center"></div>'
      + '<input id="hwl-n-' + d + '" value="' + hwlEsc(dv.n || '') + '" placeholder="' + (autoN != null ? ('자동 ' + autoN) : '문항') + '" inputmode="numeric" oninput="hwlDay(\'' + d + '\',\'n\',this.value)" title="문항 수 (비우면 자동)" style="width:100%;box-sizing:border-box;margin-top:4px;font-family:inherit;font-size:11px;padding:4px;border:1.5px dashed #e6eaf1;border-radius:7px;text-align:center;color:#475569">'
      + '</div>';
  }
  h += '</div>';
  /* 프린트 */
  h += '<div style="margin-top:11px;padding-top:10px;border-top:1px dashed #e6eaf1"><div style="font-size:12.5px;font-weight:900;color:#0d2240;margin-bottom:6px">📄 프린트 추가 <span style="font-size:10.5px;color:#64748b;font-weight:700">매쓰플랫 밖 종이 숙제 — 이름·문항·마감</span></div>';
  h += '<div style="display:grid;grid-template-columns:minmax(0,2fr) 80px 140px auto;gap:6px;align-items:end">'
    + hwlIn('이름', 'hwl-pt', HWL.pn.t, 'placeholder="예: 일차함수 서술형 6" oninput="HWL.pn.t=this.value"')
    + hwlIn('문항', 'hwl-pnn', HWL.pn.n, 'inputmode="numeric" oninput="HWL.pn.n=this.value"')
    + hwlIn('마감', 'hwl-pd', HWL.pn.d || hwlNextClass(grp0, today), 'type="date" onchange="HWL.pn.d=this.value"')
    + tdBtn('＋ 추가', 'hwlPrintAdd()') + '</div>';
  if (HWL.prints.length) {
    h += '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:7px">';
    HWL.prints.forEach(function(p, i){ h += '<span style="font-size:11.5px;font-weight:800;color:#7c2d12;background:#fff7ed;border:1px solid #fed7aa;border-radius:50px;padding:4px 10px">📄 ' + hwlEsc(p.t) + (p.n ? ' · ' + p.n + '문항' : '') + ' · 마감 ' + hwlMD(p.d) + ' <span onclick="hwlPrintDel(' + i + ')" style="cursor:pointer;color:#b45309;margin-left:3px">✕</span></span>'; });
    h += '</div>';
  }
  h += '</div>';
  var nDays = Object.keys(HWL.days).filter(function(d){ return d >= week && d <= hwlAdd(week, 6) && Number((HWL.days[d] || {}).f) > 0; }).length;
  h += '<div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">'
    + '<button onclick="hwlSend()" ' + ((HWL.busy || !codes.length || (!nDays && !HWL.prints.length)) ? 'disabled ' : '') + 'style="font-family:inherit;font-size:13px;font-weight:900;border-radius:10px;padding:10px 18px;cursor:pointer;background:#0d2240;color:#fff;border:1px solid #0d2240;' + ((HWL.busy || !codes.length || (!nDays && !HWL.prints.length)) ? 'opacity:.45;cursor:default' : '') + '">' + (HWL.busy ? '⏳ 보내는 중…' : '📨 보내기') + '</button>'
    + '<span style="font-size:11.5px;color:#475569;font-weight:700">' + codes.length + '명 × (교재 ' + nDays + '일' + (HWL.prints.length ? ' + 프린트 ' + HWL.prints.length : '') + ') · 같은 날짜·교재 카드는 덮어씁니다(고쳐 보내기)</span></div>';
  h += '</div>';
  /* 학습지 */
  h += rHwlWsList(HWL.stu);
  h += '</div></div>';
  try { if (typeof SWB !== 'undefined' && SWB.open && typeof swbPanel === 'function' && typeof swbState === 'function') h += swbPanel(swbState()); } catch(e){}
  return h;
}
/* 📄 학습지 목록 — 그 학생의 a:ws:* 카드(최근 30일) */
function rHwlWsList(code){
  var h = '<div style="background:#fff;border:1px solid #e6eaf1;border-radius:14px;padding:12px 14px">';
  var st = hwlStu(code);
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:7px"><div style="font-size:13px;font-weight:900;color:#0d2240">📄 학습지' + (st ? ' <span style="font-size:11.5px;color:#1d4ed8">' + hwlEsc(st.name) + '</span>' : '') + '</div>'
    + '<span style="font-size:10.5px;color:#64748b;font-weight:700">최근 30일 · 매쓰플랫 「숙제」 태그는 ✓ 자동 · 다른 태그는 「숙제로 넣기」</span>';
  if (hwlSelCodes().length > 1) { h += '<select onchange="hwlStuSel(this.value)" style="margin-left:auto;font-family:inherit;font-size:11.5px;padding:4px 6px;border:1.5px solid #e6eaf1;border-radius:8px">'; hwlSelCodes().forEach(function(c){ var s = hwlStu(c); h += '<option value="' + hwlEsc(c) + '"' + (c === code ? ' selected' : '') + '>' + hwlEsc(s ? s.name : c) + '</option>'; }); h += '</select>'; }
  h += '</div>';
  if (!st) return h + '<div style="font-size:12px;color:#94a3b8;font-weight:700">학생을 고르면 학습지가 보입니다</div></div>';
  var lim = hwlAdd(hwlToday(), -30);
  var rows = hwlItems(code).filter(function(it){ if (!it || it.kind !== 'ws' || String(it.id).indexOf('a:ws:') !== 0) return false; var w = hwlWsOf(code, it); var d = (w && w.date) || String(it.at || '').slice(0, 10); return d >= lim; });
  rows.sort(function(a, b){ var wa = hwlWsOf(code, a), wb = hwlWsOf(code, b); return String((wb && wb.date) || b.at || '').localeCompare(String((wa && wa.date) || a.at || '')); });
  if (!rows.length) return h + '<div style="font-size:12px;color:#94a3b8;font-weight:700">최근 30일 학습지 카드가 없습니다 (보드가 매쓰플랫 배정을 읽으면 자동으로 생깁니다)</div></div>';
  h += '<div style="display:flex;flex-direction:column;gap:4px">';
  rows.forEach(function(it){
    var w = hwlWsOf(code, it) || {}; var tag = String(w.tag || ''); var isHw = !!it.hw; var ac = hwlAutoC(code, it);
    h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 9px;border:1px solid ' + (isHw ? '#fed7aa' : '#eef2f7') + ';border-left:3px solid ' + (isHw ? '#f97316' : '#cbd5e1') + ';border-radius:9px;background:' + (isHw ? '#fffaf5' : '#fff') + ';flex-wrap:wrap">'
      + '<span style="font-size:10px;font-weight:900;border-radius:5px;padding:1px 6px;background:' + (tag === 'HOMEWORK' ? '#ffedd5;color:#c2410c' : '#f1f5f9;color:#475569') + '">' + (tag ? hwlEsc(HWL_TAG[tag] || tag) : '태그 없음') + (it.hwMan ? ' · 손' : '') + '</span>'
      + '<div style="min-width:0;flex:1"><div style="font-size:12.5px;font-weight:900;color:#0d2240;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + hwlEsc(it.title || '') + '</div>'
      + '<div style="font-size:10.5px;color:#64748b;font-weight:700">배정 ' + hwlMD(w.date || String(it.at || '').slice(0, 10)) + (it.n || w.n ? ' · ' + (it.n || w.n) + '문항' : '') + (isHw ? ' · <b style="color:#c2410c">마감 ' + hwlMD(it.due) + '</b>' : '') + (ac.right ? ' · 맞은 수 ' + ac.right : '') + (it.tst === 'ok' ? ' · <b style="color:#166534">확인 끝</b>' : '') + '</div></div>'
      + (isHw ? '<span style="font-size:11px;font-weight:900;color:#c2410c">✓ 숙제</span>' : '')
      + tdBtn(isHw ? '빼기' : '숙제로 넣기', "hwlWsToggle('" + hwlQ(code) + "','" + hwlQ(it.id) + "')") + '</div>';
  });
  return h + '</div></div>';
}
window.hwlCls = function(g){ HWL.cls = g; render(); };
window.hwlTog = function(code, on){ if (on) HWL.sel[code] = 1; else delete HWL.sel[code]; if (!HWL.stu || !HWL.sel[HWL.stu]) HWL.stu = hwlSelCodes()[0] || null; render(); };
window.hwlSelAll = function(on){ var list = (typeof tdActive === 'function' ? tdActive() : []).filter(function(s){ return !HWL.cls || (s.group || '') === HWL.cls; }); list.forEach(function(s){ var c = String(s.lumen_rec_code); if (on) HWL.sel[c] = 1; else delete HWL.sel[c]; }); if (!on || !HWL.stu) HWL.stu = hwlSelCodes()[0] || null; render(); };
window.hwlStuSel = function(code){ HWL.stu = code; render(); };
window.hwlBookSel = function(k){ HWL.book = k; render(); };
window.hwlWeek = function(n){ HWL.week = hwlAdd(hwlEnsureWeek(), n); render(); };
window.hwlDay = function(d, k, v){ var o = HWL.days[d] || (HWL.days[d] = {}); o[k] = String(v || '').replace(/[^0-9]/g, ''); if (k !== 'n') { var el = document.getElementById('hwl-n-' + d); if (el && !o.n) { var n = hwlAutoN(hwlSelCodes(), hwlBookPick(hwlSelCodes()), Number(o.f), Number(o.t)); el.placeholder = n != null ? ('자동 ' + n) : '문항'; } } };
window.hwlPrintAdd = function(){
  var t = String((document.getElementById('hwl-pt') || {}).value || '').trim(), n = String((document.getElementById('hwl-pnn') || {}).value || '').replace(/[^0-9]/g, ''), d = String((document.getElementById('hwl-pd') || {}).value || '');
  if (!t) { plToast('프린트 이름을 적어 주세요'); return; } if (!d) { plToast('마감 날짜를 골라 주세요'); return; }
  HWL.prints.push({ t: t, n: n ? Number(n) : null, d: d }); HWL.pn = { t: '', n: '', d: d }; render();
};
window.hwlPrintDel = function(i){ HWL.prints.splice(i, 1); render(); };
window.hwlRefreshOpen = function(){ if (typeof swbOpen === 'function') swbOpen(); else plToast('새로고침 창을 열 수 없습니다 (교재 목록 새로고침 부품 없음)'); };
/* 카드 한 장 만들기/덮어쓰기 — 같은 id 면 범위·문항·제목만 바꾸고 상태(tst·tat·auto·thw)는 둔다 */
function hwlPut(code, card){
  var arr = TD.items[code] || (TD.items[code] = []); var now = tdNow();
  for (var i = 0; i < arr.length; i++) if (arr[i].id === card.id) { var old = arr[i]; Object.keys(card).forEach(function(k){ old[k] = card[k]; }); old.hw = true; old.src = 'hw'; return false; }
  var ord = arr.reduce(function(mx, it){ return Math.max(mx, Number(it.order) || 0); }, 0) + 1;
  arr.push(Object.assign({ tst: 'todo', tat: {}, auto: null, at: now, unit: null, unitTitle: '', order: ord, src: 'hw', hw: true, ref: '' }, card));
  return true;
}
window.hwlSend = function(){
  if (HWL.busy) return;
  var codes = hwlSelCodes(); if (!codes.length) { plToast('학생을 골라 주세요'); return; }
  var week = hwlEnsureWeek(), bk = hwlBookPick(codes), made = 0, upd = 0, changed = [];
  var days = [];
  for (var i = 0; i < 7; i++) { var d = hwlAdd(week, i), dv = HWL.days[d] || {}; var f = Number(dv.f), t = Number(dv.t) || f; if (!(f > 0)) continue; if (t < f) { var x = f; f = t; t = x; } days.push({ d: d, f: f, t: t, n: dv.n ? Number(dv.n) : null }); }
  if (days.length && !bk) { plToast('교재를 골라 주세요'); return; }
  if (!days.length && !HWL.prints.length) { plToast('쪽을 적은 날이나 프린트가 없습니다'); return; }
  codes.forEach(function(code){
    var touched = false;
    days.forEach(function(x){
      var n = x.n; if (n == null) { var pg = hwlBookPages(code, { kind: 'book', bookId: bk.bid, book: bk.title, from: x.f, to: x.t }); n = (bk.bid != null && pg.length) ? hwlBookN(bk.bid, pg) : null; }
      var id = 'hw:' + x.d + ':' + (bk.bid != null ? bk.bid : hwlSlug(bk.title));
      var isNew = hwlPut(code, { id: id, kind: 'book', title: bk.title + ' ' + x.f + (x.t !== x.f ? '~' + x.t : '') + '쪽', book: bk.title, bookId: bk.bid != null ? bk.bid : null, from: x.f, to: x.t, n: n, due: x.d });
      if (isNew) made++; else upd++; touched = true;
    });
    HWL.prints.forEach(function(p){ var id = 'hw:p:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); hwlPut(code, { id: id, kind: 'etc', title: p.t, print: true, n: p.n, due: p.d, book: '', from: null, to: null }); made++; touched = true; });
    if (touched) changed.push(code);
  });
  HWL.busy = true; render();
  tdSaveMany(changed).then(function(){ HWL.busy = false; HWL.prints = []; HWL.days = {}; plToast('📨 숙제 카드 ' + made + '장 만듦' + (upd ? ' · ' + upd + '장 고침' : '') + ' — ' + changed.length + '명'); render(); }, function(){ HWL.busy = false; render(); });
};
/* 「숙제로 넣기」/「빼기」 — hw 토글 + hwMan:true (자동 패스가 다시 건드리지 않게) */
window.hwlWsToggle = function(code, id){
  var arr = hwlItems(code), it = null; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { it = arr[i]; break; } if (!it) return;
  var st = hwlStu(code) || {}; var w = hwlWsOf(code, it) || {};
  it.hw = !it.hw; it.hwMan = true;
  if (it.hw) { if (it.n == null && w.n) it.n = w.n; if (!it.due) it.due = hwlNextClass(st.group || '', w.date || String(it.at || hwlToday()).slice(0, 10)); }
  tdSaveItems(code).then(function(){ render(); }); render();
};

/* ═══ 2. 자동 카드 — 태그 HOMEWORK 학습지 카드에 hw·n·due (계약 §3-2) ═══ */
function hwlAutoWs(force){
  if (typeof TD === 'undefined' || !TD.loaded || typeof WSG === 'undefined' || !WSG.loaded) return [];
  if (!force && Date.now() - HWL.autoAt < 60000) return [];
  HWL.autoAt = Date.now();
  var changed = [];
  (typeof tdActive === 'function' ? tdActive() : []).forEach(function(s){
    var code = String(s.lumen_rec_code); var arr = TD.items[code] || []; var hit = false;
    arr.forEach(function(it){
      if (!it || it.kind !== 'ws' || String(it.id).indexOf('a:ws:') !== 0) return;
      if (it.hw != null || it.hwMan) return;
      var w = hwlWsOf(code, it); if (!w || String(w.tag || '').toUpperCase() !== 'HOMEWORK') return;
      var d = (w.date || String(it.at || hwlToday()).slice(0, 10));
      it.hw = true; if (w.n != null) it.n = w.n; if (!it.due) it.due = hwlNextClass(s.group || '', d); hit = true;
    });
    if (hit) changed.push(code);
  });
  if (changed.length && typeof tdSaveMany === 'function') tdSaveMany(changed).then(function(){ if (typeof tdPainting === 'function' && tdPainting()) render(); });
  return changed;
}
if (typeof tdAutoPass === 'function') tdAutoPass = (function(orig){ return function(){ var r = orig.apply(this, arguments); try { hwlAutoWs(false); } catch(e){ try { console.error('[숙제 자동 카드]', e); } catch(_){} } return r; }; })(tdAutoPass);

/* ═══ 보드 탭 칩 · rTodo · 학생 상세 머리 단추 ═══ */
if (typeof tdHead === 'function') tdHead = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try { var mk = '>👤 학생별</button>'; var i = h.indexOf(mk); if (i >= 0) { i += mk.length; h = h.slice(0, i) + tdChip('📚 숙제 내주기', TD.tab === 'hw', "tdTab('hw')") + h.slice(i); } } catch(e){}
  return h;
}; })(tdHead);
if (typeof rTodo === 'function') rTodo = (function(orig){ return function(){
  if (TD.tab !== 'hw') return orig.apply(this, arguments);
  try { tdKick(); tdAutoKick(); if (TD.loaded) setTimeout(tdAutoPass, 0); } catch(e){}
  var h = '<div style="padding:18px 22px 60px;background:#eef2f8;min-height:100%">' + tdHead();
  if (!TD.loaded) return h + '<div style="padding:60px 0;text-align:center;color:#94a3b8;font-weight:800">🔄 할 일 보드를 불러오는 중…</div></div>';
  try { h += rHwlDispatch(); } catch(e){ h += '<div style="padding:20px;color:#b91c1c;font-weight:800">숙제 내주기 오류: ' + hwlEsc(e && e.message) + '</div>'; }
  return h + '</div>';
}; })(rTodo);
/* 학생 상세에서 「📚 숙제 내주기」 → 그 학생이 골라진 채로 보드 탭 */
window.hwlOpenFor = function(code){ HWL.sel = {}; if (code) { HWL.sel[code] = 1; HWL.stu = code; var s = hwlStu(code); HWL.cls = (s && s.group) || ''; } TD.tab = 'hw'; TD.addOpen = false; VIEW = 'todo'; try { if (typeof MOB !== 'undefined') MOB.view = 'todo'; } catch(e){} render(); };
if (typeof rStudentDetail === 'function') rStudentDetail = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (typeof SELECTED_STUDENT === 'string' && SELECTED_STUDENT) {
      var nm = SELECTED_STUDENT.split('__')[0], gr = SELECTED_STUDENT.split('__')[1] || '';
      var st = (students || []).filter(function(s){ return s && s.name === nm && (!gr || s.grade === gr); })[0] || (students || []).filter(function(s){ return s && s.name === nm; })[0];
      var code = st && st.lumen_rec_code ? String(st.lumen_rec_code) : '';
      var mk = '👤 학생 프로필</span>'; var i = h.indexOf(mk);
      if (i >= 0) { i += mk.length; h = h.slice(0, i) + '<button id="hwl-sd-btn" onclick="hwlOpenFor(\'' + hwlQ(code) + '\')" ' + (code ? '' : 'disabled title="학생앱 코드가 없는 학생"') + ' style="font-size:11px;font-weight:900;color:#fff;background:#0d2240;border:1px solid #0d2240;padding:4px 11px;border-radius:20px;flex-shrink:0;white-space:nowrap;cursor:pointer;font-family:inherit;' + (code ? '' : 'opacity:.4') + '">📚 숙제 내주기</button>' + h.slice(i); }
    }
  } catch(e){}
  return h;
}; })(rStudentDetail);

/* ═══ 5. 2차 확인 — 숙제체크 화면 (계약 §3-5 · §4 거울) ═══ */
function hwlDueMap(date){
  var out = [];
  (typeof tdActive === 'function' ? tdActive() : []).forEach(function(s){ var code = String(s.lumen_rec_code); var cards = hwlCardsDue(code, date); if (cards.length) out.push({ st: s, code: code, cards: cards }); });
  out.sort(function(a, b){ return String(a.st.group || '').localeCompare(String(b.st.group || ''), 'ko') || String(a.st.name || '').localeCompare(String(b.st.name || ''), 'ko'); });
  return out;
}
function hwlCell(v, who){
  /* who 's' 학생(초록) · 't' 선생님(파랑 ✓ / 빨강 ✗ / 회색 아직) */
  var on = Number(v) >= 100, none = (v == null);
  var bg = who === 's' ? (on ? '#22c55e' : '#e2e8f0') : (none ? '#f1f5f9' : (on ? '#2563eb' : '#ef4444'));
  var col = who === 's' ? (on ? '#fff' : '#94a3b8') : (none ? '#cbd5e1' : '#fff');
  return '<span style="display:inline-flex;width:20px;height:20px;border-radius:6px;align-items:center;justify-content:center;font-size:11px;font-weight:900;background:' + bg + ';color:' + col + '">' + (who === 's' ? (on ? '✓' : '·') : (none ? '·' : (on ? '✓' : '✗'))) + '</span>';
}
function hwlCardRow(code, it, compact){
  var self = hwlSelfEff(code, it), thw = it.thw || null, ac = hwlAutoC(code, it);
  var h = '<div class="hwl-card" data-id="' + hwlEsc(it.id) + '" style="display:flex;align-items:center;gap:' + (compact ? '6px' : '10px') + ';padding:6px 8px;border:1px solid #eef2f7;border-radius:9px;background:#fff;flex-wrap:wrap">';
  h += '<div style="min-width:0;flex:1 1 140px"><div style="font-size:' + (compact ? '11.5px' : '12.5px') + ';font-weight:900;color:#0d2240;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (it.kind === 'ws' ? '📄' : it.print ? '📄' : '📗') + ' ' + hwlEsc(it.title || '') + '</div>'
    + '<div style="font-size:10px;color:#64748b;font-weight:700">' + (it.n != null ? it.n + '문항' : '문항 수 모름') + (ac.right ? ' · <b style="color:#15803d">맞은 수 ' + ac.right + '</b>' : '') + (ac.auto ? ' · 채점 자동 ✓' : '') + (it.tst === 'ok' ? ' · <b style="color:#1d4ed8">확인 끝</b>' + (it.thwAt ? ' ' + hwlMD(String(it.thwAt).slice(0, 10)) : '') : '') + '</div></div>';
  h += '<div style="display:grid;grid-template-columns:repeat(4,auto);gap:3px 6px;align-items:center">';
  HWL_STEP.forEach(function(s){ h += '<div style="display:flex;flex-direction:column;align-items:center;gap:2px"><span style="font-size:9px;font-weight:800;color:#94a3b8">' + s[1] + '</span><span style="display:flex;gap:2px">' + hwlCell(self[s[0]], 's') + '<span onclick="hwlT(\'' + hwlQ(code) + '\',\'' + hwlQ(it.id) + '\',\'' + s[0] + '\')" title="누르면 ✓/✗ 바뀜" style="cursor:pointer">' + hwlCell(thw ? thw[s[0]] : null, 't') + '</span></span></div>'; });
  h += '</div>';
  h += tdBtn('학생 체크 그대로 ✓', "hwlAccept('" + hwlQ(code) + "','" + hwlQ(it.due) + "','" + hwlQ(it.id) + "')", it.tst === 'ok' ? '' : 'blue');
  return h + '</div>';
}
function hwlCheckPanel(){
  var date = HWL.date || (HWL.date = hwlToday());
  var rows = hwlDueMap(date);
  var h = '<div id="hwl-check" style="margin-top:14px;background:#fff;border-radius:16px;border:1px solid #e8eef8;padding:12px 14px">';
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div style="font-size:14px;font-weight:900;color:#0d2240">📚 숙제 카드 2차 확인</div>'
    + '<button onclick="hwlDate(-1)" style="width:26px;height:26px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:11px;font-weight:900;color:#64748b;cursor:pointer">◀</button>'
    + '<b style="font-size:12.5px;color:#0d2240">' + hwlMD(date) + '(' + HWL_DOW[hwlDow(date)] + ') 마감</b>'
    + '<button onclick="hwlDate(1)" style="width:26px;height:26px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:11px;font-weight:900;color:#64748b;cursor:pointer">▶</button>'
    + (date !== hwlToday() ? tdBtn('오늘', 'hwlDate(0)') : '')
    + '<span style="font-size:10.5px;color:#64748b;font-weight:700">왼쪽 초록 = 학생 셀프 체크 · 오른쪽 파랑 ✓/빨강 ✗ = 선생님(눌러서 바꿈) · 확인하면 위 그리드 칸(평균)도 같이 적힙니다</span>';
  if (rows.length) h += '<span style="margin-left:auto"></span>' + tdBtn('학생 체크 그대로 ✓ (보이는 전부 ' + rows.length + '명)', "hwlAcceptAll('" + date + "')", 'blue');
  h += '</div>';
  if (!TD.loaded) h += '<div style="font-size:12px;color:#94a3b8;font-weight:700">🔄 할 일 보드(숙제 카드)를 불러오는 중…</div>';
  else if (!rows.length) h += '<div style="font-size:12px;color:#94a3b8;font-weight:700">이 날 마감인 숙제 카드가 없습니다 — 「할 일 보드 › 📚 숙제 내주기」에서 보내면 여기 나옵니다</div>';
  rows.forEach(function(r){
    h += '<div style="display:flex;align-items:center;gap:8px;margin:8px 0 3px"><b style="font-size:12.5px;color:#0d2240">' + hwlEsc(r.st.name) + '</b><span style="font-size:10.5px;color:#94a3b8;font-weight:700">' + hwlEsc(r.st.group || '') + ' · 카드 ' + r.cards.length + '</span>'
      + tdBtn('이 학생 그대로 ✓', "hwlAccept('" + hwlQ(r.code) + "','" + date + "')") + '</div>';
    h += '<div style="display:flex;flex-direction:column;gap:4px">'; r.cards.forEach(function(it){ h += hwlCardRow(r.code, it, false); }); h += '</div>';
  });
  return h + '</div>';
}
window.hwlDate = function(n){ HWL.date = n ? hwlAdd(HWL.date || hwlToday(), n) : hwlToday(); render(); };
/* 거울 — 그날 마감 카드들의 thw 평균 → lumen_hw[날짜] (hwcSave 길 그대로 → lumen_hw_at · 리포트 경고등) */
function hwlMirror(code, date){
  var st = hwlStu(code); if (!st) return null;
  var cards = hwlCardsDue(code, date).filter(function(it){ return it.thw; }); if (!cards.length) return null;
  var sum = { p: 0, c: 0, w: 0 }; cards.forEach(function(it){ ['p', 'c', 'w'].forEach(function(k){ sum[k] += Number(it.thw[k]) || 0; }); });
  var v = { p: hwlRound(sum.p / cards.length), c: hwlRound(sum.c / cards.length), w: hwlRound(sum.w / cards.length) };
  if (typeof hwcSave === 'function') hwcSave(st, date, v);
  else { st.lumen_hw = st.lumen_hw || {}; st.lumen_hw[date] = v; st.lumen_hw_at = st.lumen_hw_at || {}; st.lumen_hw_at[date] = new Date().toISOString(); if (typeof saveStudents === 'function') saveStudents(); }
  return v;
}
function hwlConfirm(code, it, thw){
  it.thw = { p: Number(thw.p) || 0, c: Number(thw.c) || 0, w: Number(thw.w) || 0, a: Number(thw.a) || 0 };
  it.thwAt = tdNow();
  if (typeof tdSetT === 'function') tdSetT(code, it.id, 'ok'); else { it.tst = 'ok'; it.tat = it.tat || {}; it.tat.ok = it.thwAt; }
}
/* 「학생 체크 그대로 ✓」 — 한 명(id 를 주면 그 카드만) */
window.hwlAccept = function(code, date, id){
  var cards = hwlCardsDue(code, date).filter(function(it){ return !id || it.id === id; }); if (!cards.length) return;
  cards.forEach(function(it){ hwlConfirm(code, it, hwlSelfEff(code, it)); });
  hwlMirror(code, date);
  tdSaveItems(code).then(function(){ render(); });
  plToast('✓ ' + ((hwlStu(code) || {}).name || code) + ' 숙제 ' + cards.length + '장 확인'); render();
};
window.hwlAcceptAll = function(date){
  var rows = hwlDueMap(date), n = 0;
  rows.forEach(function(r){ r.cards.forEach(function(it){ hwlConfirm(r.code, it, hwlSelfEff(r.code, it)); n++; }); hwlMirror(r.code, date); });
  if (!n) { plToast('확인할 숙제 카드가 없습니다'); return; }
  tdSaveMany(rows.map(function(r){ return r.code; })).then(function(){ render(); });
  plToast('✓ ' + rows.length + '명 · 카드 ' + n + '장 확인'); render();
};
/* 선생님 칸 누르기 — 아직(없음) → ✓ → ✗ → ✓ … (다른 칸은 학생 값으로 채움) */
window.hwlT = function(code, id, k){
  var arr = hwlItems(code), it = null; for (var i = 0; i < arr.length; i++) if (arr[i].id === id) { it = arr[i]; break; } if (!it) return;
  var base = it.thw ? { p: it.thw.p, c: it.thw.c, w: it.thw.w, a: it.thw.a } : hwlSelfEff(code, it);
  base[k] = (it.thw && Number(it.thw[k]) >= 100) ? 0 : 100;
  hwlConfirm(code, it, base);
  if (it.due) hwlMirror(code, it.due);
  tdSaveItems(code).then(function(){ render(); }); render();
};
/* 숙제체크 그리드 아래 칸 + 세부 창 안 카드 줄 */
if (typeof rHwCheck === 'function') rHwCheck = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    if (HWC_CM || HWC_VIEW !== 'grid') return h;
    try { if (typeof tdKick === 'function') tdKick(); if (typeof WSG !== 'undefined' && !WSG.loaded && !WSG.busy && typeof wsgLoad === 'function') wsgLoad().then(function(){ if (VIEW === 'hwcheck') render(); }); } catch(e){}
    try { if (TD.loaded && typeof WSG !== 'undefined' && WSG.loaded) setTimeout(function(){ hwlAutoWs(false); }, 0); } catch(e){}   /* 보드를 안 열었어도 숙제 태그 학습지가 2차 확인에 나오게 (60초에 한 번) */
    var panel = hwlCheckPanel();
    var i = h.lastIndexOf('</div>'); h = (i >= 0) ? (h.slice(0, i) + panel + h.slice(i)) : (h + panel);
  } catch(e){ try { console.error('[숙제 2차 확인]', e); } catch(_){} }
  return h;
}; })(rHwCheck);
if (typeof hwcPopHtml === 'function') hwcPopHtml = (function(orig){ return function(){
  var h = orig.apply(this, arguments); if (!h) return h;
  try {
    var parts = String(HWC.pop || '').split('|'), stId = parts[0], iso = parts[1];
    var st = (students || []).filter(function(x){ return x && x.id === stId; })[0]; var code = st && st.lumen_rec_code ? String(st.lumen_rec_code) : '';
    var cards = code ? hwlCardsDue(code, iso) : []; if (!cards.length) return h;
    var sec = '<div style="margin-top:9px;border-top:1px dashed #e2e8f0;padding-top:8px"><div style="font-size:11px;font-weight:900;color:#0d2240;margin-bottom:5px">📚 이 날 마감 숙제 카드 ' + cards.length + ' <span style="font-size:9.5px;color:#94a3b8;font-weight:700">초록=학생 · 파랑/빨강=선생님</span></div><div style="display:flex;flex-direction:column;gap:4px">';
    cards.forEach(function(it){ sec += hwlCardRow(code, it, true); }); sec += '</div></div>';
    var tail = '</div></div>'; if (h.slice(-tail.length) === tail) h = h.slice(0, -tail.length) + sec + tail; else h += sec;
  } catch(e){}
  return h;
}; })(hwcPopHtml);

/* ═══ XP — 학생 셀프 체크 단계 100 하나당 +5 (계약 §5) ═══ */
function hwlSelfXP(code){
  var stm = (typeof TD !== 'undefined' && TD.st && TD.st[code]) || null; if (!stm) return { xp: 0, month: 0 };
  var n = 0, m = 0, ym = hwlToday().slice(0, 7);
  Object.keys(stm).forEach(function(id){ var s = stm[id]; if (!s || !s.hw || typeof s.hw !== 'object') return; var k = 0; ['p', 'c', 'w', 'a'].forEach(function(f){ if (Number(s.hw[f]) >= 100) k++; }); n += k; if (String(s.hat || s.at || '').slice(0, 7) === ym) m += k; });
  return { xp: n * 5, month: m * 5 };
}
if (typeof calcXP === 'function') calcXP = (function(orig){ return function(stInfo, reports){
  var x = orig.apply(this, arguments);
  try {
    var code = stInfo && stInfo.lumen_rec_code != null ? String(stInfo.lumen_rec_code) : '';
    try { if (typeof TD !== 'undefined' && !TD.loaded && !TD.kicked && typeof tdKick === 'function') tdKick(); } catch(e){}   /* 보드(todo_st_) 가 아직 안 읽혔으면 읽기 시작 — 이번 계산은 0, 다음(레벨 탭·한 시간 뒤 게시)부터 들어간다 */
    if (code && x && typeof x.total === 'number') { var add = hwlSelfXP(code); if (add.xp) { x.total += add.xp; if (typeof x.thisMonth === 'number') x.thisMonth += add.month; x.breakdown = x.breakdown || {}; x.breakdown.hwself = (x.breakdown.hwself || 0) + add.xp; } }
  } catch(e){}
  return x;
}; })(calcXP);

/* ═══ 기능 스위치 stu_features.hw — 기본 꺼짐 (todo 와 같은 모양) ═══ */
if (typeof SF_LIST !== 'undefined' && Array.isArray(SF_LIST) && !SF_LIST.some(function(f){ return f.k === 'hw'; })) {
  SF_LIST.push({ k: 'hw', ic: '📚', n: '오늘 숙제 (숙제 카드)',
    d: '원장님이 내준 숙제 카드와 매쓰플랫 「숙제」 학습지를 학생 홈 「📌 오늘 숙제」에 보여 주고 풀이·채점·오답·아하노트 셀프 체크를 받는 화면. 기본은 꺼져 있습니다 — 켜면 학생 홈에 나옵니다(학생이 앱을 다시 열어야 보입니다).' });
}
if (typeof rStuFeat === 'function') rStuFeat = (function(orig){ return function(){
  try { if (SFA && SFA.loaded) { if (!SFA.cfg) SFA.cfg = {}; if (!SFA.cfg.hw) SFA.cfg.hw = { on: false, off: [] }; } } catch(e){}
  return orig.apply(this, arguments);
}; })(rStuFeat);

/* ═══ 모양 ═══ */
(function(){
  var st = document.createElement('style'); st.id = 'hwl-css';
  st.textContent = '@media(max-width:900px){.hwl-grid{grid-template-columns:minmax(0,1fr)!important}.hwl-wk{grid-template-columns:repeat(4,minmax(0,1fr))!important}}'
    + '.hwl-stu:hover{background:#f6f8fc!important}.hwl-card:hover{border-color:#c7d2fe!important}';
  (document.head || document.documentElement).appendChild(st);
})();
