/* ═══════════════════════════════════════════════════════════════════
 * v19-125: 📅 네이버 예약 — «📞 기억» 배지 (원장 2026-10-17 「연결」)
 *   수집기(sync/naver_booking_collect.js)가 원장님이 한 번 직접 연결한 예약의 학부모 전화를 «지문»으로 기억해
 *   같은 전화의 다음 예약을 자동 연결한다(match.how = 'learned'). 학원앱은 그 표시만 더한다:
 *   학생 칸 「👤 이름 반 <small>📞 기억</small> ✎」 (v19-124 의 「전화」·「이름」·「직접」 배지와 같은 자리).
 *   기억표(lumen_store naver_phone_links)는 앱이 읽지 않는다 — 시작 다운로드에서도 뺀다(build_app.py v19-125 PULL_SKIP_KEYS).
 *   v19-124 부품(naverbook124_teacher.js)은 그대로 두고 nbkStuCell 을 감싼다. 문자열 연결로만(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
if (typeof nbkStuCell === 'function') nbkStuCell = (function(o){
  return function(b){
    var h = o.apply(this, arguments);
    try {
      var m = nbkMatch(b);
      if (m && m.st && m.how === 'learned' && !(NBK.edit || {})[b.id] && h.indexOf('<span class="nbk-stu" data-nbk-stu=') === 0){
        var btn = '<button type="button" class="nbk-ed" title="다른 학생으로 바꾸기"';
        var i = h.indexOf(btn);
        if (i > 0) h = h.slice(0, i) + ' <small class="nbk-how" title="예전에 직접 연결한 학부모 전화번호로 자동 연결했어요">📞 기억</small>' + h.slice(i);
      }
    } catch(e){}
    return h;
  };
})(nbkStuCell);
