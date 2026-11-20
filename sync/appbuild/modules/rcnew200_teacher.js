/* ═══════════════════════════════════════════════════════════════════
 * v19-200: 🚑 리커버리 «만들기» 칸 — 따로 추가한 학생만 만들기 (원장 2026-11-20 「내가 따로 추가한 학생의 학습지도 만드는 기능」)
 *  11/19 예약 처리 뒤 명단에 넣은 학생(최○○)이 빠져 있었다. 예약은 원래 «이미 만든 학생은 건너뛰고» 만드는데,
 *  단추가 «확정 전원 (8명 · 예상 375문항)»이라 다시 누르면 모두 새로 만들 것처럼 보였다.
 *  · 이번 주 이미 만든 학생이 있고 아직 안 만든 학생이 있으면 → 「➕ 새로 추가한 n명만 만들기 (예상 m문항)」
 *  · 모두 만들었으면 → 「✅ 확정 n명 모두 만듦」(누를 수 없음)
 *  · 단추 아래 한 줄: «⏳ 아직: 이름 · 이름 | ✅ 만든 학생 n명»
 *  누르는 일은 그대로 rcMakeWsAll(서버 예약 ws_make_req) — 서버 sync/rcws_make.js 가 이미 만든 학생을 건너뛴다.
 *  ※ 서버 읽기·쓰기 추가 없음. 문자열 연결로만 HTML. 앞의 l3rMakeBox 감싸기(v19-123·155·181)를 한 번 더 감싼다.
 * ═══════════════════════════════════════════════════════════════════ */
function rn200State(){
  var conf = []; try { conf = rcConfirmed().filter(function(c){ return !(c.e && c.e.done) && !(c.e && c.e.noshow); }); } catch(e){ return null; }
  var made = [], pend = [];
  conf.forEach(function(c){ var m = null; try { m = rcwsMadeOf(c.k); } catch(e){} (m ? made : pend).push(c); });
  var sum = null;
  try { if (typeof rw155Est === 'function' && RW155 && RW155.bd && RW155.bd.key) { var rule = rcwsRule(); sum = 0; pend.forEach(function(c){ if (c.row) sum += rw155Est(c.row, rule).total; }); } } catch(e){ sum = null; }
  return { made: made, pend: pend, sum: sum };
}
if (typeof l3rMakeBox === 'function') l3rMakeBox = (function(orig){ return function(){
  var h = orig.apply(this, arguments);
  try {
    var S = rn200State(); if (!S || !S.made.length) return h;
    var re = /(<button type="button" class="l3-btn main" id="l3r-all"[^>]*>)⚡ 확정 전원 학습지 생성[^<]*(<\/button>)/;
    if (!re.test(h)) return h;
    var nm = function(c){ return rcwsEsc200(c.name || (c.row && c.row.st && c.row.st.name) || ''); };
    if (S.pend.length) {
      h = h.replace(re, '$1➕ 새로 추가한 ' + S.pend.length + '명만 만들기' + (S.sum ? ' (예상 ' + S.sum + '문항)' : '') + '$2');
    } else {
      h = h.replace(re, function(all, a, b){ return a.replace('<button', '<button disabled') + '✅ 확정 ' + S.made.length + '명 모두 만듦' + b; });
    }
    var line = '<div class="l3-sub" id="rn200-who" style="font-size:12px;font-weight:800;margin:4px 0 2px;line-height:1.6">'
      + (S.pend.length ? '<span style="color:#b45309">⏳ 아직: ' + S.pend.map(nm).join(' · ') + '</span> <span style="color:#cbd5e1">|</span> ' : '')
      + '<span style="color:#15803d">✅ 만든 학생 ' + S.made.length + '명</span></div>';
    var j = h.indexOf('</button>', h.indexOf('id="l3r-all"'));
    if (j > 0) h = h.slice(0, j + 9) + line + h.slice(j + 9);
  } catch(e){ try { console.error('[리커버리 추가 학생 만들기]', e); } catch(_){} }
  return h;
}; })(l3rMakeBox);
function rcwsEsc200(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
