# -*- coding: utf-8 -*-
# 학생앱 v2-162 조립 — «v2-161 복사 + rep 고침»
#   원장 2026-11-10 「아하노트 미해결 질문이 아코디언식으로 접혀서 문제집 이름과 문제 번호·페이지 바로 확인 가능하게,
#                    수업 시간에 해결한 문제는 학생앱에서 체크 → 학원앱에도 해결로」 · 시안 docs/mockup_aha_fold.html (원장 「추천대로」)
#   [무엇]
#     ① 💡 IB아하노트 「미해결」 탭 = 접힌 줄 목록. 교재별 묶음(📕 교재 · n개) → 그 안은 페이지·번호 순.
#        줄 = p109 · #20(크게) · 날짜 · 상태 칩(🟡 답변 대기 / 💡 힌트 도착) · 틀린 이유 첫 칸 · 오른쪽 「✓ 수업 중 해결」.
#        줄을 누르면 그 아래에 원래 카드(사진·질문·고치기·삭제·🙋 스스로 풀었어요·힌트·점수·재풀이)가 그대로 펼쳐진다.
#        「전체」·「해결」 탭은 예전 날짜별 카드 그대로.
#     ② 「✓ 수업 중 해결」 → 줄 안에 「p109 #20 — 수업 시간에 해결했나요? [네, 해결했어요] [아니요]」 (confirm 창 안 씀)
#        → aha_notes 그 줄: status 'resolved' · resolved_at 지금 · resolved_note JSON 에
#          {reason:'class', by:'student', at, student:'class', student_at} 를 합쳐 쓴다(계약 docs/aha_backlog_resolve.md §1 —
#          학원앱 v19-5 가 이미 🏫 「수업에서 다룸」 배지로 읽는다). 새 칸·새 표 없음.
#        → 아래 띠 「🏫 p109 #20 수업 중 해결로 옮겼어요 [되돌리기]」 5초.
#     ③ 되돌리기: 5초 띠 · 그리고 «오늘» 내가 체크한 해결 카드에 「↩ 미해결로」(다음 날부터는 선생님만).
#        되돌리면 status 'pending' · resolved_at 비움 · resolved_note 에서 by:'student' 가 넣은 reason·by·at·student·student_at 만 지운다.
#     ④ 기존 「✓ 이제 알아요 — 정리해 주세요」 단추(카드 안)는 같은 「✓ 수업 중 해결했어요」 로 바꾼다(원장 「합침」).
#        「🙋 스스로 풀었어요(재풀이 사진·점수)」는 그대로. 예전에 보낸 「정리 요청함」 배지도 그대로 보인다.
#     ⑤ 해결 카드 중 내가 체크한 것은 「선생님이 확인」 대신 「🏫 수업 중 해결 (내가 체크)」.
#   [안 바꾼 것] 노트 올리기·고치기·삭제·스스로 해결·재풀이·힌트·점수·리그·통계 카드. 고정 주소 student_v1.html 은 원장 지시로만.
#   실행: python3 sync/appbuild/build_student_v2162.py   (저장소 맨 위 폴더에서)
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'student_v2-161.html'); DST = os.path.join(ROOT, 'student_v2-162.html')
s = open(SRC, encoding='utf-8').read()
def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a)); s = s.replace(a, b)

rep("var STU_VER = 'v2-161';", "var STU_VER = 'v2-162';")
rep("/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n",
    "/* ═══════════════ 📒 학생앱 버전 로그 (원장님용) ═══════════════\n"
    " * v2-162 (2026-11-10) 💡 아하노트 «미해결»을 접힌 줄로 · ✓ 수업 중 해결 체크 (원장 2026-11-10 · 시안 docs/mockup_aha_fold.html)\n"
    " *   · 미해결 탭: 교재별로 묶고 페이지·번호 순. 줄마다 p109 · #20 을 크게, 날짜·상태(답변 대기/힌트 도착)·틀린 이유. 누르면 원래 카드가 펼쳐집니다.\n"
    " *   · 줄 오른쪽 「✓ 수업 중 해결」 → 「수업 시간에 해결했나요?」 → 「네」 를 누르면 해결로 옮겨지고, 학원앱에는 🏫 수업에서 다룸(학생 체크)으로 보입니다.\n"
    " *   · 잘못 눌렀으면 5초 안 「되돌리기」, 그날 안에는 해결 카드의 「↩ 미해결로」. 다음 날부터는 선생님만 되돌립니다.\n"
    " *   · 카드 안 「✓ 이제 알아요 — 정리해 주세요」 는 같은 「✓ 수업 중 해결했어요」 로 합쳤습니다. 「🙋 스스로 풀었어요」는 그대로.\n"
    " *\n")

# ① 모양
rep(".ahlkd{display:block;margin-top:6px;text-align:center;font-size:11.5px;font-weight:900;\n",
    "/* ★ v2-162: 미해결 접힌 줄(ahf) */\n"
    ".ahf-grp{display:flex;justify-content:space-between;align-items:center;font-size:12px;font-weight:900;color:#475569;margin:14px 2px 7px;}\n"
    ".ahf-grp:first-child{margin-top:4px;}\n"
    ".ahf-row{border:1.5px solid #f6c76b;background:#fffbeb;border-radius:14px;margin-bottom:8px;overflow:hidden;}\n"
    ".ahf-row.hint{border-color:#93c5fd;background:#eff6ff;}\n"
    ".ahf-hd{display:flex;align-items:center;gap:8px;padding:10px 9px 10px 12px;cursor:pointer;}\n"
    ".ahf-hd:focus-visible{outline:2px solid #1d6fe8;outline-offset:-2px;}\n"
    ".ahf-w{flex:1;min-width:0;}\n"
    ".ahf-pn{font-size:18px;font-weight:900;color:#0d2240;letter-spacing:-.01em;font-variant-numeric:tabular-nums;}\n"
    ".ahf-pn small{font-size:11.5px;font-weight:700;color:#64748b;margin-left:6px;}\n"
    ".ahf-ar{display:inline-block;font-size:11px;color:#94a3b8;margin-left:5px;transition:transform .15s;}\n"
    ".ahf-row.open .ahf-ar{transform:rotate(90deg);}\n"
    ".ahf-cs{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;}\n"
    ".ahf-c{font-size:10.5px;font-weight:800;border-radius:7px;padding:2px 7px;background:#f1f5f9;color:#475569;}\n"
    ".ahf-c.w{background:#fde68a;color:#78350f;}\n"
    ".ahf-c.h{background:#dbeafe;color:#1d4ed8;}\n"
    ".ahf-c.k{background:#dcfce7;color:#15803d;}\n"
    ".ahf-ck{flex-shrink:0;border:2px solid #15803d;color:#15803d;background:#fff;border-radius:12px;padding:7px 8px;font-family:inherit;font-size:11.5px;font-weight:900;line-height:1.15;cursor:pointer;min-width:60px;text-align:center;}\n"
    ".ahf-ck:active{background:#dcfce7;}\n"
    ".ahf-ask{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:9px 12px;border-top:1px dashed #86efac;background:#f0fdf4;font-size:12.5px;font-weight:800;color:#14532d;}\n"
    ".ahf-ask span{flex:1 1 100%;}\n"
    ".ahf-yes{border:none;border-radius:9px;background:#15803d;color:#fff;font-family:inherit;font-weight:900;font-size:12.5px;padding:8px 12px;cursor:pointer;}\n"
    ".ahf-no{border:1.5px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;font-family:inherit;font-weight:800;font-size:12.5px;padding:7px 12px;cursor:pointer;}\n"
    ".ahf-bd{padding:0 6px 6px;}\n"
    ".ahf-bd .aha-card{margin-bottom:0;}\n"
    ".ahf-back{display:block;width:100%;margin-top:8px;border:1.5px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:7px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;}\n"
    ".ahf-undo{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:9500;width:calc(100% - 32px);max-width:420px;box-sizing:border-box;background:#0d2240;color:#fff;border-radius:13px;padding:11px 13px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:800;box-shadow:0 8px 24px rgba(13,34,64,.3);}\n"
    ".ahf-undo span{flex:1;min-width:0;}\n"
    ".ahf-undo button{background:none;border:none;color:#93c5fd;font-family:inherit;font-size:13px;font-weight:900;cursor:pointer;padding:2px 4px;}\n"
    "@media (prefers-reduced-motion: reduce){ .ahf-ar{transition:none;} }\n"
    ".ahlkd{display:block;margin-top:6px;text-align:center;font-size:11.5px;font-weight:900;\n")

# ② 미해결 탭이면 접힌 줄로
rep("""function renderAhaList() {
  var listEl = document.getElementById('aha-list');
  if (!listEl) return;
""", """function renderAhaList() {
  var listEl = document.getElementById('aha-list');
  if (!listEl) return;
  /* ★ v2-162: 「미해결」 탭 = 교재별 접힌 줄 (노트가 없으면 아래 예전 빈 화면 그대로) */
  if (ahaFilter === 'pending' && window.ahfRender && ahfRender(listEl)) return;
""")

# ③ 카드 안 「이제 알아요」 → 「✓ 수업 중 해결했어요」
rep("""      html += '<button type="button" class="ahlk" data-nid="' + ahaEscape(n.id) + '" onclick="ahaLaterKnow(\\'' + ahaEscape(n.id) + '\\')">✓ 이제 알아요 — 정리해 주세요</button>';""",
    """      html += '<button type="button" class="ahlk" data-nid="' + ahaEscape(n.id) + '" onclick="ahfAsk(\\'' + ahaEscape(n.id) + '\\')">✓ 수업 중 해결했어요</button>';   /* ★ v2-162: 「이제 알아요」 합침 */
      if (window.ahfAskHtml) html += ahfAskHtml(n, true);""")

# ④ 해결 카드: 내가 체크한 것 표시 + 오늘이면 ↩ 미해결로
rep("""    else html += '<span class="aha-card-confirm">선생님이 확인</span>';""",
    """    else html += '<span class="aha-card-confirm">' + ((window.ahfMine && ahfMine(n)) ? '🏫 수업 중 해결 (내가 체크)' : '선생님이 확인') + '</span>';   /* ★ v2-162 */""")
rep("""  // v2-10: 다시 푼 풀이 제출 (재풀이) — ★ v2-78: 안내 상자·큰 단추로 바꿈
  html += ahaRetryBox(n);

  html += '</div></div>';
  return html;
}""", """  // v2-10: 다시 푼 풀이 제출 (재풀이) — ★ v2-78: 안내 상자·큰 단추로 바꿈
  html += ahaRetryBox(n);

  /* ★ v2-162: 오늘 내가 「수업 중 해결」로 체크한 카드 → ↩ 미해결로 */
  if (n.status === 'resolved' && window.ahfMine && ahfMine(n) && ahfToday(n)) {
    html += '<button type="button" class="ahf-back" onclick="ahfBack(\\'' + ahaEscape(n.id) + '\\')">↩ 잘못 눌렀어요 — 미해결로</button>';
  }

  html += '</div></div>';
  return html;
}

/* ═══════════ ★ v2-162: 💡 미해결 접힌 줄 · ✓ 수업 중 해결 (시안 docs/mockup_aha_fold.html) ═══════════
 * 저장: aha_notes 그 줄의 status·resolved_at·resolved_note(JSON) — 계약 docs/aha_backlog_resolve.md §1.
 *   {reason:'class', by:'student', at, student:'class', student_at} 를 기존 JSON 에 합친다. 학원앱 v19-5 가 🏫 배지로 읽는다. */
var AHF = { open: {}, ask: null, busy: false, undoT: null };
function ahfFind(id) {
  for (var i = 0; i < ahaNotes.length; i++) { if (String(ahaNotes[i].id) === String(id)) return ahaNotes[i]; }
  return null;
}
function ahfBook(n) { return n.source_type === 'book' ? String(n.source_name || '교재') : ('📝 ' + String(n.source_name || '프린트')); }
function ahfNum(v) { var x = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isNaN(x) ? 1e9 : x; }
function ahfPN(n) { return n.source_type === 'book' ? ('p' + (n.page != null && n.page !== '' ? n.page : '?') + ' · #' + (n.problem_no != null ? n.problem_no : '?')) : ('#' + (n.problem_no != null ? n.problem_no : '?')); }
function ahfMD(iso) { var d = new Date(iso); if (isNaN(d)) return ''; return (d.getMonth() + 1) + '/' + d.getDate(); }
function ahfDay(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
/* 내가(학생앱) 「수업 중 해결」로 해결한 노트인가 */
function ahfMine(n) { var o = ahaRNote(n); return n && n.status === 'resolved' && o.reason === 'class' && o.by === 'student'; }
/* 오늘 해결한 것인가 (그날 안에만 학생이 되돌린다) */
function ahfToday(n) { var o = ahaRNote(n); var t = o.at || n.resolved_at; if (!t) return false; var d = new Date(t); return !isNaN(d) && ahfDay(d) === ahfDay(new Date()); }
window.ahfMine = ahfMine; window.ahfToday = ahfToday;
function ahfWhy(n) {
  var e = n.error_types; if (typeof e === 'string') { try { e = JSON.parse(e); } catch (x) { e = [e]; } }
  if (Array.isArray(e) && e.length) return String(e[0]);
  return '';
}
/* 「수업 시간에 해결했나요?」 줄 — inCard: 카드 안(전체 탭)에서 부를 때 */
function ahfAskHtml(n, inCard) {
  if (!n || String(AHF.ask) !== String(n.id)) return '';
  if (inCard && AHF.inFold) return '';
  var id = ahaEscape(n.id);
  return '<div class="ahf-ask"' + (inCard ? ' style="border-radius:10px;border:1px dashed #86efac;margin-top:8px"' : '') + '><span>' + ahaEscape(ahfPN(n)) + ' — 수업 시간에 해결했나요?</span>' +
    '<button type="button" class="ahf-yes" onclick="ahfYes(\\'' + id + '\\')">네, 해결했어요</button>' +
    '<button type="button" class="ahf-no" onclick="ahfNo()">아니요</button></div>';
}
window.ahfAskHtml = ahfAskHtml;
/* 미해결 탭 그리기 — 그렸으면 true (미해결 노트가 없으면 false → 예전 빈 화면) */
function ahfRender(listEl) {
  var L = ahaNotes.filter(function(n) { return n.status === 'pending'; });
  if (!L.length) return false;
  L.sort(function(a, b) {
    var ba = ahfBook(a), bb = ahfBook(b);
    if (ba !== bb) return ba < bb ? -1 : 1;
    var d = ahfNum(a.page) - ahfNum(b.page); if (d) return d;
    d = ahfNum(a.problem_no) - ahfNum(b.problem_no); if (d) return d;
    return String(a.created_at) < String(b.created_at) ? -1 : 1;
  });
  var cnt = {}; L.forEach(function(n) { var k = ahfBook(n); cnt[k] = (cnt[k] || 0) + 1; });
  var h = '', g = null;
  AHF.inFold = true;
  L.forEach(function(n) {
    var bk = ahfBook(n), id = ahaEscape(n.id), op = !!AHF.open[n.id];
    if (bk !== g) { g = bk; h += '<div class="ahf-grp"><span>' + (n.source_type === 'book' ? '📕 ' : '') + ahaEscape(bk) + '</span><span>' + cnt[bk] + '개</span></div>'; }
    var hint = !!(ahaHintMap && ahaHintMap[n.id]);
    var lk = !!ahaRNote(n).student;
    h += '<div class="ahf-row' + (hint ? ' hint' : '') + (op ? ' open' : '') + '" data-ahf="' + id + '">';
    h += '<div class="ahf-hd" role="button" tabindex="0" aria-expanded="' + (op ? 'true' : 'false') + '" onclick="ahfToggle(\\'' + id + '\\')" onkeydown="if(event.key===\\'Enter\\'||event.key===\\' \\'){event.preventDefault();ahfToggle(\\'' + id + '\\')}">';
    h += '<div class="ahf-w"><div class="ahf-pn">' + ahaEscape(ahfPN(n)) + '<small>' + ahfMD(n.created_at) + '</small><span class="ahf-ar">▶</span></div><div class="ahf-cs">';
    h += hint ? '<span class="ahf-c h">💡 힌트 도착</span>' : '<span class="ahf-c w">🟡 답변 대기</span>';
    if (lk) h += '<span class="ahf-c k">✓ 정리 요청함</span>';
    var w = ahfWhy(n); if (w) h += '<span class="ahf-c">' + ahaEscape(w) + '</span>';
    h += '</div></div>';
    h += '<button type="button" class="ahf-ck" onclick="event.stopPropagation();ahfAsk(\\'' + id + '\\')">✓<br>수업 중<br>해결</button>';
    h += '</div>';
    h += ahfAskHtml(n, false);
    if (op) h += '<div class="ahf-bd">' + renderAhaCard(n) + '</div>';
    h += '</div>';
  });
  AHF.inFold = false;
  listEl.innerHTML = h;
  if (window.hnWatch) { try { hnWatch(); } catch (e) {} }
  return true;
}
window.ahfRender = ahfRender;
window.ahfToggle = function(id) { AHF.open[id] = !AHF.open[id]; renderAhaList(); };
window.ahfAsk = function(id) {
  if (isTest) { ahaToast('테스트 모드에서는 체크할 수 없어요', 'error'); return; }
  AHF.ask = (String(AHF.ask) === String(id)) ? null : id; renderAhaList();
};
window.ahfNo = function() { AHF.ask = null; renderAhaList(); };
/* 서버에 쓰기 — 성공하면 화면 값도 바꾼다 */
function ahfSave(n, upd, done) {
  if (!sb) { ahaToast('로그인 상태를 확인해주세요', 'error'); return; }
  if (AHF.busy) return; AHF.busy = true;
  sb.from('aha_notes').update(upd).eq('id', n.id).then(function(r) {
    AHF.busy = false;
    if (r && r.error) { ahaToast('저장 실패: ' + (r.error.message || ''), 'error'); renderAhaList(); return; }
    for (var k in upd) { if (Object.prototype.hasOwnProperty.call(upd, k)) n[k] = upd[k]; }
    try { renderAhaStats(); } catch (e) {}
    renderAhaList();
    if (done) done();
  }, function(e) { AHF.busy = false; ahaToast('저장 실패: ' + ((e && e.message) || ''), 'error'); renderAhaList(); });
}
window.ahfYes = function(id) {
  var n = ahfFind(id); if (!n || n.status !== 'pending') { AHF.ask = null; renderAhaList(); return; }
  var now = new Date().toISOString();
  var o = ahaRNote(n); o.reason = 'class'; o.by = 'student'; o.at = now; o.student = 'class'; o.student_at = now;
  AHF.ask = null; AHF.open[n.id] = false;
  ahfSave(n, { status: 'resolved', resolved_at: now, resolved_note: JSON.stringify(o) }, function() { ahfUndoBar(n); });
};
/* 되돌리기 — 학생이 넣은 표시만 지운다 */
function ahfUnmark(n) {
  var o = ahaRNote(n);
  if (o.by === 'student') { delete o.reason; delete o.by; delete o.at; }
  if (o.student === 'class') { delete o.student; delete o.student_at; }
  var txt = JSON.stringify(o); if (txt === '{}') txt = null;
  return { status: 'pending', resolved_at: null, resolved_note: txt };
}
window.ahfBack = function(id) {
  var n = ahfFind(id); if (!n || !ahfMine(n) || !ahfToday(n)) return;
  ahfSave(n, ahfUnmark(n), function() { ahfHideUndo(); ahaToast('미해결로 되돌렸어요'); });
};
function ahfHideUndo() { var b = document.getElementById('ahf-undo'); if (b) b.remove(); if (AHF.undoT) { clearTimeout(AHF.undoT); AHF.undoT = null; } }
function ahfUndoBar(n) {
  ahfHideUndo();
  var b = document.createElement('div'); b.id = 'ahf-undo'; b.className = 'ahf-undo';
  b.innerHTML = '<span>🏫 ' + ahaEscape(ahfPN(n)) + ' 수업 중 해결로 옮겼어요</span><button type="button" id="ahf-undo-btn">되돌리기</button>';
  document.body.appendChild(b);
  document.getElementById('ahf-undo-btn').onclick = function() { ahfBack(n.id); };
  AHF.undoT = setTimeout(ahfHideUndo, 5000);
}""")

open(DST, 'w', encoding='utf-8').write(s)
print(DST, len(s))
