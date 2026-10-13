/* ═══════════════════════════════════════════════════════════════════
 * v19-118: 📅 주간 점수 «✅ 체크하기» — 반별로 묶고 두 명씩
 * 원장 2026-10-13 「반별로 잘 보게 묶고, 가운데 화면에 체크를 2명씩 보이게 하자.」
 *  · 종이 · 사진 · 손으로 고치기 카드의 학생 줄을 반(st.group)별 묶음으로 — 오늘 수업 반이 먼저, 반 없는 학생은 맨 끝
 *  · 묶음 머리: 「T5 반 · 5명 · 남은 3」 (오늘 수업 반은 «오늘 수업» 표시)
 *  · 한 줄에 두 명(넓은 화면) · 좁은 화면(760px 아래)은 한 명
 *  · 단추·저장 길은 그대로(v19-115 wkcCheckHtml 이 만든 줄을 옮겨 담기만 한다)
 * ═══════════════════════════════════════════════════════════════════ */
wkcCheckHtml = (function(orig){ return function(){
  var h = orig();
  try {
    var tp = document.createElement('template'); tp.innerHTML = h;
    var byCode = {}; pwlAll().forEach(function(s){ byCode[s.lumen_rec_code] = s; });
    var cg = []; try { cg = (wkcClassGroups() || []).map(String); } catch(e){}
    var NONE = '반 없음';
    ['paper', 'photo', 'manual'].forEach(function(key){
      var card = tp.content.querySelector('.wkc-task[data-task="' + key + '"]'); if (!card) return;
      var rows = Array.prototype.slice.call(card.querySelectorAll('.wkc-row[data-code]')); if (!rows.length) return;
      var groups = {}, order = [];
      rows.forEach(function(r){
        var st = byCode[r.getAttribute('data-code')] || {}, g = String(st.group || '').trim() || NONE;
        if (!groups[g]){ groups[g] = []; order.push(g); }
        groups[g].push(r);
      });
      order.sort(function(a, b){
        var ta = cg.indexOf(a), tb = cg.indexOf(b);
        if ((ta >= 0) !== (tb >= 0)) return ta >= 0 ? -1 : 1;
        if (ta >= 0) return ta - tb;
        if ((a === NONE) !== (b === NONE)) return a === NONE ? 1 : -1;
        return a.localeCompare(b, 'ko', { numeric: true });
      });
      var wrap = document.createElement('div'); wrap.className = 'wkg';
      rows[0].parentNode.insertBefore(wrap, rows[0]);
      order.forEach(function(g){
        var list = groups[g], today = cg.indexOf(g) >= 0;
        var left = list.filter(function(r){ return r.getAttribute('data-state') === 'left'; }).length;
        var sec = document.createElement('section'); sec.className = 'wkg-sec' + (today ? ' today' : ''); sec.setAttribute('data-group', g);
        var info = list.length + '명' + (key === 'manual' ? '' : (left ? ' · 남은 ' + left : ' · ✓ 끝'));
        sec.innerHTML = '<div class="wkg-hd"><b>' + wppEsc(g === NONE ? g : g + ' 반') + '</b><span class="wkg-n' + (key !== 'manual' && !left ? ' ok' : '') + '">' + info + '</span>' + (today ? '<em>오늘 수업</em>' : '') + '</div>';
        var grid = document.createElement('div'); grid.className = 'wkg-grid';
        list.forEach(function(r){ grid.appendChild(r); });
        sec.appendChild(grid); wrap.appendChild(sec);
      });
    });
    return tp.innerHTML;
  } catch(e){ try { console.warn('[체크하기 반별 묶기]', e); } catch(_){} return h; }
}; })(wkcCheckHtml);

(function(){
  var st = document.createElement('style'); st.id = 'wkg-css';
  st.textContent = ''
    + '.wkg{display:flex;flex-direction:column;gap:10px;margin-top:4px;min-width:0}'
    + '.wkg-sec{min-width:0}.wkg-hd{display:flex;align-items:center;gap:8px;padding:2px 2px 6px;border-bottom:2px solid #e2e8f0;margin-bottom:6px}'
    + '.wkg-hd b{font-size:15px;font-weight:900;color:#0d2240}.wkg-n{font-size:12px;font-weight:800;color:#b45309}.wkg-n.ok{color:#15803d}'
    + '.wkg-hd em{font-style:normal;font-size:11px;font-weight:900;color:#fff;background:#f97316;border-radius:999px;padding:1px 8px}'
    + '.wkg-sec.today .wkg-hd{border-bottom-color:#fdba74}'
    + '.wkg-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;min-width:0}'
    + '.wkg-grid .wkc-row{border:1.5px solid #e2e8f0;border-radius:12px;padding:7px 10px;background:#fff;grid-template-columns:minmax(0,1fr);gap:5px}'
    + '.wkg-grid .wkc-row .wkc-why2,.wkg-grid .wkc-row .wkc-why2+.wkc-btns{grid-column:1}.wkg-grid .wkc-btns{flex-wrap:nowrap}.wkg-grid .wkc-more{flex:0 0 auto}'
    + '.wkg-grid .wkc-row[data-state="at"],.wkg-grid .wkc-row[data-state="ok"],.wkg-grid .wkc-row[data-state="late"]{background:#f7fef9;border-color:#bbf7d0}'
    + '.wkg-grid .wkc-row[data-state="miss"],.wkg-grid .wkc-row[data-state="none"]{background:#f8fafc}'
    + '.wkg-grid .wkc-tb{min-width:0;flex:1 1 0;padding:0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.wkc-task[data-task="photo"] .wkg-grid .wkc-btns{flex-wrap:wrap}.wkc-task[data-task="photo"] .wkg-grid .wkc-tb{flex:1 1 auto;overflow:visible}'
    + '@media(max-width:760px){.wkg-grid{grid-template-columns:minmax(0,1fr)}}';
  (document.head || document.documentElement).appendChild(st);
})();
