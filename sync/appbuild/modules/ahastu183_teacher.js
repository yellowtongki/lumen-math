/* ═══════════════════════════════════════════════════════════════════
 * v19-183: 💡 아하노트 — 학생이 «수업 중 해결»로 체크한 것을 따로 보이게 (원장 2026-11-10 「학원앱도 학생 체크 보이게」)
 *  학생앱 v2-162 「✓ 수업 중 해결」은 aha_notes.resolved_note JSON 에 {reason:'class', by:'student', at, student:'class'} 를 남긴다
 *  (계약 docs/aha_backlog_resolve.md §1). 예전 배지(ahaReasonBadge)는 by 를 보지 않아 원장님이 정리한 「🏫 수업에서 다룸」과 같아 보였다.
 *  → by:'student' 이면 「🏫 수업 중 해결 · 학생 체크」(파란 테두리) + 마우스를 올리면 체크한 시각.
 *  되돌리기는 예전 그대로(줄의 해결 단추를 다시 누르면 미해결).  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
if (typeof ahaReasonBadge === 'function') ahaReasonBadge = (function(orig){ return function(n, small){
  try {
    if (n && !ahaIsPending(n)) {
      var o = ahaRNote(n);
      if (o.reason === 'class' && o.by === 'student') {
        var t = ''; try { var d = new Date(o.at || n.resolved_at); if (!isNaN(d)) t = (d.getMonth()+1) + '/' + d.getDate() + ' ' + ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2); } catch(e){}
        return '<span class="aha-stu-badge" title="학생이 학생앱에서 「✓ 수업 중 해결」을 눌렀습니다' + (t ? ' (' + t + ')' : '') + '" style="display:inline-block;font-size:' + (small ? '9.5px' : '11px') + ';font-weight:800;background:#eff6ff;color:#1d4ed8;border:1px solid #93c5fd;border-radius:7px;padding:0 7px;margin-left:5px;white-space:nowrap">🏫 수업 중 해결 · 학생 체크</span>';
      }
    }
  } catch(e){}
  return orig.apply(this, arguments);
}; })(ahaReasonBadge);
