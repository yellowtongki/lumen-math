/* ═══════════════════════════════════════════════════════════════════
 * v19-192: 📖 기출 해설집 목록 — 학교 › 학년 › 연도 (시안 A)
 *   (원장 2026-11-14 「학교별 학년별 연도별로 구분되게」 → 시안 docs/mockup_haesol_acc2.html 「추천대로 A」)
 *  v19-191(학교 › 연도) 위에 «학년» 단을 더한다.
 *   ① 학교 칸: 🏫 이름 · n권 · 연도 범위 · 학년별 권수(중2 1 · 중3 3) — 눌러서 접기/펴기
 *   ② 학년 칸: [중3] 과목명 · n권 — 눌러서 접기/펴기 (처음엔 펼침)
 *   ③ 학년 안: 연도를 왼쪽 제목으로(2026 · 2025 …, 최근 위 · 접지 않음) · 같은 해 안은 기말 → 중간
 *      여러 해를 묶은 «범위맞춤 대비» 해설집은 맨 아래 «📦 대비»
 *   ④ 학년 칩(중1~고2) 고르면 그 학년만 · 모두 펼침 · 모두 펼치기/접기 · 펼친 상태 기기에 기억(hs_acc191 그대로)
 *  화면만 바꾼다 — 목록 자료·본문·삭제·불러오기는 그대로. ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
(function(){
  try {
    var css = document.createElement('style');
    css.textContent = '.hs192-year{display:grid;grid-template-columns:92px 1fr;gap:10px;padding:8px 0;border-top:1px dashed #e3e9f2}'
      + '.hs192-year:first-child{border-top:none}'
      + '.hs192-ylab{font-weight:900;color:#0d2240;font-size:14px;padding-top:9px}'
      + '.hs192-ylab small{display:block;font-size:11px;color:#94a3b8;font-weight:700}'
      + '@media (max-width:600px){.hs192-year{grid-template-columns:1fr}.hs192-ylab{padding-top:0}}';
    (document.head || document.documentElement).appendChild(css);
  } catch(e){}
})();
var HS192_GORD = ['중1','중2','중3','고1','고2','고3','기타'];
function hs192Q(s){ return hsEsc(s).replace(/'/g, '&#39;'); }
function hs192Row(it){
  var kill = (it.qs || []).filter(function(q){ return q.killer; }).length;
  var warn = (it.qs || []).filter(function(q){ return q.warn; }).length;
  var essay = (it.qs || []).filter(function(q){ return q.ans === '서술'; }).length;
  var code = String(it.code || '').replace(/'/g, '');
  var ts = hs191TermShort(it) || it.title || it.code;
  return '<div class="hs191-card hs192-row" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border:1.5px solid #e8eef6;border-radius:10px;padding:8px 11px">'
    + '<span style="font-weight:900;font-size:14px;color:#0d2240;min-width:88px">' + hsEsc(ts) + '</span>'
    + '<span style="font-size:12px;color:#5b6b82;font-weight:700;flex:1 1 150px;min-width:0">' + hsEsc([it.subject, it.n ? it.n + '문항' : ''].filter(Boolean).join(' · ')) + '</span>'
    + (essay ? '<span style="background:#fef3c7;color:#a16207;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">서술형 ' + essay + '</span>' : '')
    + (kill ? '<span style="background:#f3e8ff;color:#7e22ce;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">최고난도 ' + kill + '</span>' : '')
    + (warn ? '<span style="background:#fee2e2;color:#dc2626;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">⚠️ 문제 확인 ' + warn + '</span>' : '')
    + '<button onclick="hsOpen(\'' + code + '\')" style="padding:6px 13px;background:#1d6fe8;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit">문항 보기</button>'
    + '<button onclick="hsDel(\'' + code + '\')" title="' + hsEsc(String(it.addedAt || '').slice(0, 10)) + ' 등록" style="padding:6px 10px;background:#fff;color:#94a3b8;border:1.5px solid #e3e9f2;border-radius:8px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit">삭제</button>'
    + '</div>';
}
/* 한 학년 안: 연도 제목(왼쪽) + 줄 */
function hs192Years(L){
  var Y = {};
  L.forEach(function(it){ var y = hs191Year(it) || '기타'; (Y[y] = Y[y] || []).push(it); });
  var ys = Object.keys(Y).sort(function(a, b){
    var ra = a === 'pack' ? 1 : (a === '기타' ? 2 : 0), rb = b === 'pack' ? 1 : (b === '기타' ? 2 : 0);
    return (ra - rb) || b.localeCompare(a);
  });
  return ys.map(function(y){
    var R = Y[y].slice().sort(function(a, b){ return (hs191TermRank(b) - hs191TermRank(a)) || String(a.title || '').localeCompare(String(b.title || ''), 'ko'); });
    var lab = y === 'pack' ? '📦 대비<small>범위맞춤 묶음 · ' + R.length + '권</small>' : (y === '기타' ? '연도 미상<small>' + R.length + '권</small>' : y + '<small>학년도 · ' + R.length + '권</small>');
    return '<div class="hs191-year hs192-year"><div class="hs191-yh hs192-ylab">' + lab + '</div><div style="display:flex;flex-direction:column;gap:6px;min-width:0">'
      + R.map(hs192Row).join('') + '</div></div>';
  }).join('');
}
hs191All = function(on){
  HS191.open = {};
  ((HS.cat && HS.cat.items) || []).forEach(function(it){
    var s = hs191School(it); HS191.open['s:' + s] = !!on; HS191.open['g:' + s + '|' + hsGradeOf(it)] = !!on;
  });
  hs191SaveOpen(); render();
};
window.hs191All = hs191All;
rHaesolList = function(){
  var all = (HS.cat.items || []).slice();
  var h = '<div style="padding:14px;max-width:1000px">';
  h += '<div style="background:linear-gradient(135deg,#0d2240,#1d6fe8);border-radius:14px;padding:18px 20px;margin-bottom:12px;color:#fff">'
    + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
    + '<div style="font-size:19px;font-weight:900">📖 기출 해설집</div>'
    + '<div style="font-size:12px;opacity:.85;font-weight:700">학교 › 학년 › 연도별로 모았습니다 — 눌러서 펼치세요</div>'
    + '<button onclick="hsRefresh()" style="margin-left:auto;padding:9px 14px;background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:9px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">🔄 새로고침</button>'
    + '<button onclick="hsPick()" style="padding:9px 16px;background:#fff;color:#0d2240;border:none;border-radius:9px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">＋ 해설집 불러오기</button>'
    + '</div></div>';
  h += '<input type="file" id="hs-file" accept=".html,text/html" style="display:none" onchange="hsFile(this)">';
  if (!all.length) {
    h += '<div style="background:#fff;border-radius:14px;padding:44px;text-align:center;color:#94a3b8;font-size:13px;line-height:1.9">'
      + '아직 목록이 비어 있습니다.'
      + '<div style="margin-top:10px;font-size:12.5px;color:#5b6b82;font-weight:700">해설집은 Claude가 만들면 <b>서버에 자동으로 올라옵니다</b> — <b>🔄 새로고침</b>을 한 번 눌러 보세요.</div>'
      + '<div style="margin-top:8px;font-size:12px;color:#b6c0cf">직접 넣고 싶으시면 <b>＋ 해설집 불러오기</b>로 <b>해설집.html</b> 파일을 고르셔도 됩니다.</div></div>';
    return h + '</div>';
  }
  var gcnt = {};
  all.forEach(function(it){ var g = hsGradeOf(it); gcnt[g] = (gcnt[g] || 0) + 1; });
  var gorder = HS192_GORD.filter(function(g){ return gcnt[g]; });
  if (HS.gfilter !== '전체' && !gcnt[HS.gfilter]) HS.gfilter = '전체';
  h += '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px;align-items:center">';
  [['전체', all.length]].concat(gorder.map(function(g){ return [g, gcnt[g]]; })).forEach(function(p){
    var on = (HS.gfilter === p[0]);
    h += '<span onclick="hsGradeSet(\'' + p[0] + '\')" style="cursor:pointer;user-select:none;border:1.5px solid ' + (on ? '#0d2240' : '#e3e9f2') + ';background:' + (on ? '#0d2240' : '#fff') + ';color:' + (on ? '#fff' : '#5b6b82') + ';border-radius:50px;padding:6px 15px;font-size:12.5px;font-weight:900">'
      + p[0] + ' <span style="font-weight:800;opacity:' + (on ? '.75' : '.55') + '">' + p[1] + '</span></span>';
  });
  h += '<span style="margin-left:auto;display:flex;gap:6px">'
    + '<button onclick="hs191All(true)" style="padding:6px 11px;background:#fff;color:#334155;border:1.5px solid #e3e9f2;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">모두 펼치기</button>'
    + '<button onclick="hs191All(false)" style="padding:6px 11px;background:#fff;color:#334155;border:1.5px solid #e3e9f2;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">모두 접기</button>'
    + '</span></div>';
  var filt = HS.gfilter !== '전체';
  var items = filt ? all.filter(function(it){ return hsGradeOf(it) === HS.gfilter; }) : all;
  var S = {};
  items.forEach(function(it){ var s = hs191School(it); (S[s] = S[s] || []).push(it); });
  var names = Object.keys(S).sort(function(a, b){ return ((hs191IsMid(a) ? 0 : 1) - (hs191IsMid(b) ? 0 : 1)) || a.localeCompare(b, 'ko'); });
  var o = hs191LoadOpen();
  names.forEach(function(s){
    var L = S[s], sk = 's:' + s, sOpen = (sk in o) ? !!o[sk] : filt;
    var G = {}; L.forEach(function(it){ var g = hsGradeOf(it); (G[g] = G[g] || []).push(it); });
    var gs = HS192_GORD.filter(function(g){ return G[g]; });
    var yrs = L.map(hs191Year).filter(function(y){ return /^20\d\d$/.test(y); }).sort();
    var range = yrs.length ? (yrs[0] === yrs[yrs.length - 1] ? yrs[0] : yrs[0] + '~' + yrs[yrs.length - 1]) : '';
    h += '<div class="hs191-school" style="background:#fff;border:1.5px solid ' + (sOpen ? '#bcd0ee' : '#e3e9f2') + ';border-radius:14px;margin-bottom:9px;overflow:hidden">'
      + '<div class="hs191-sh" onclick="hs191Tog(\'' + hs192Q(sk) + '\',' + (filt ? 'true' : 'false') + ')" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 16px;cursor:pointer;user-select:none;background:' + (sOpen ? '#f4f8ff' : '#fff') + '">'
      +   '<span style="font-size:13px;color:#64748b;width:14px;display:inline-block;transform:rotate(' + (sOpen ? 90 : 0) + 'deg)">▶</span>'
      +   '<span style="font-size:16px;font-weight:900;color:#0d2240">🏫 ' + hsEsc(s) + '</span>'
      +   '<span style="background:#dcfce7;color:#16a34a;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:900">' + L.length + '권</span>'
      +   (range ? '<span style="font-size:12px;color:#64748b;font-weight:800">' + range + '</span>' : '')
      +   '<span style="margin-left:auto;display:flex;gap:5px;flex-wrap:wrap">' + gs.map(function(g){ return '<span style="background:#eef4ff;color:#1d6fe8;border-radius:7px;padding:2px 8px;font-size:11.5px;font-weight:900">' + g + ' ' + G[g].length + '</span>'; }).join('') + '</span>'
      + '</div>';
    if (sOpen) {
      h += '<div style="padding:4px 14px 14px;display:flex;flex-direction:column;gap:10px">';
      gs.forEach(function(g){
        var gk = 'g:' + s + '|' + g, gOpen = (gk in o) ? !!o[gk] : true;
        var subs = []; G[g].forEach(function(it){ var x = String(it.subject || '').replace(/\s*\(20\d\d개정\)/, ''); if (x && subs.indexOf(x) < 0) subs.push(x); });
        h += '<div class="hs192-grade" style="border:1px solid #e3e9f2;border-radius:12px;overflow:hidden">'
          + '<div class="hs192-gh" onclick="hs191Tog(\'' + hs192Q(gk) + '\',true)" style="display:flex;align-items:center;gap:9px;padding:10px 12px;cursor:pointer;user-select:none;background:#fff' + (gOpen ? ';border-bottom:1px solid #e3e9f2' : '') + '">'
          +   '<span style="font-size:12px;color:#94a3b8;width:12px;display:inline-block;transform:rotate(' + (gOpen ? 90 : 0) + 'deg)">▶</span>'
          +   '<span style="background:#1d6fe8;color:#fff;border-radius:8px;padding:3px 10px;font-weight:900;font-size:13px">' + hsEsc(g) + '</span>'
          +   '<span style="font-size:12px;color:#5b6b82;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + hsEsc(subs.join(' · ')) + '</span>'
          +   '<span style="font-size:12px;color:#94a3b8;font-weight:800">' + G[g].length + '권</span>'
          + '</div>'
          + (gOpen ? '<div style="padding:6px 12px 10px">' + hs192Years(G[g]) + '</div>' : '')
          + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  return h + '</div>';
};
