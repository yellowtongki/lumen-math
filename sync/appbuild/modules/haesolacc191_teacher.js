/* ═══════════════════════════════════════════════════════════════════
 * v19-191: 📖 기출 해설집 목록 — 학교 › 연도 아코디언
 *   (원장 2026-11-13 「기출해설집 학교별 연도별로 구분하는 아코디언식 형태로 하자」)
 *  [전] 등록 순서대로 카드가 한 줄로 길게 늘어서 있었다(35권 넘음) — 학년 칩만 있었다.
 *  [후] ① 학교 묶음(🏫 이름 · n권 · 연도 범위 · 학년) — 눌러서 펼치기/접기
 *       ② 그 안에 연도 묶음(2026학년도 · 2025학년도 …, 최근 연도가 위) — 학교를 펼치면 가장 최근 연도만 열려 있다
 *          «중간 대비 · 23·24년 기출»처럼 여러 해를 묶은 해설집은 «📦 범위맞춤 대비 묶음» 칸으로
 *       ③ 연도 안은 학년 → 기말·중간(늦은 시험이 위) 순서의 한 줄 카드
 *       ④ 학년 칩은 그대로(고르면 그 학년만 · 학교는 모두 펼친 채로) · «모두 펼치기 / 모두 접기»
 *       ⑤ 펼친 상태는 이 기기에 기억(문항 보기 → 목록으로 돌아와도 그대로)
 *  화면만 바꾼다 — 목록 자료(lumen_haesol_catalog)·본문·삭제·불러오기는 그대로.
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var HS191 = { open: null };
function hs191LoadOpen(){
  if (HS191.open) return HS191.open;
  var o = {}; try { o = JSON.parse(localStorage.getItem('hs_acc191') || '{}') || {}; } catch(e){ o = {}; }
  HS191.open = o; return o;
}
function hs191SaveOpen(){ try { localStorage.setItem('hs_acc191', JSON.stringify(HS191.open || {})); } catch(e){} }
/* 학교 이름 — 카탈로그 school 칸, 없으면 제목 첫 낱말 */
function hs191School(it){
  var s = String(it.school || '').trim();
  if (!s) s = String(it.title || '').trim().split(/\s+/)[0] || '';
  return s || '학교 미상';
}
/* 연도 — 'pack'(여러 해 묶음) · '2025' · '' */
function hs191Year(it){
  var term = String(it.term || ''), title = String(it.title || ''), code = String(it.code || '');
  if (/대비|범위맞춤/.test(term + ' ' + title) || /_pack$/.test(code)) return 'pack';
  var m = term.match(/(20\d\d)/) || title.match(/(20\d\d)\s*학년도/) || code.match(/_(20\d\d)_/) || title.match(/(20\d\d)/);
  return m ? m[1] : '';
}
/* 학기 순위 — 늦은 시험이 위로 (2학기 기말 > 2학기 중간 > 1학기 기말 > 1학기 중간) */
function hs191TermRank(it){
  var t = String(it.term || '') + ' ' + String(it.title || '');
  var sem = /2\s*학기/.test(t) ? 2 : (/1\s*학기/.test(t) ? 1 : 0);
  var fin = /기말/.test(t) ? 2 : (/중간/.test(t) ? 1 : 0);
  return sem * 10 + fin;
}
function hs191GradeRank(it){
  var g = hsGradeOf(it), L = ['중1','중2','중3','고1','고2','고3'];
  var i = L.indexOf(g); return i < 0 ? 9 : i;
}
/* 학기만 짧게 — «2025 · 2학기 기말» → «2학기 기말» */
function hs191TermShort(it){
  var t = String(it.term || '').replace(/^\s*20\d\d\s*[·.\-]?\s*/, '').trim();
  return t || '';
}
function hs191IsMid(name){ return /중학교$|중$/.test(name); }
window.hs191Tog = function(k, def){
  var o = hs191LoadOpen(); var cur = (k in o) ? !!o[k] : !!def;
  o[k] = !cur; hs191SaveOpen(); render();
};
window.hs191All = function(on){
  var o = hs191LoadOpen(); HS191.open = {};
  var items = (HS.cat && HS.cat.items) || [];
  items.forEach(function(it){
    var s = hs191School(it), y = hs191Year(it) || '기타';
    HS191.open['s:' + s] = !!on; HS191.open['y:' + s + '|' + y] = !!on;
  });
  hs191SaveOpen(); render();
};
function hs191Card(it){
  var kill = (it.qs || []).filter(function(q){ return q.killer; }).length;
  var warn = (it.qs || []).filter(function(q){ return q.warn; }).length;
  var essay = (it.qs || []).filter(function(q){ return q.ans === '서술'; }).length;
  var g = hsGradeOf(it), ts = hs191TermShort(it);
  var code = String(it.code || '').replace(/'/g, '');
  return '<div class="hs191-card" style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;background:#fff;border:1.5px solid #e8eef6;border-radius:12px;padding:10px 13px;margin-top:7px">'
    + '<span style="background:#eef4ff;color:#1d4ed8;border-radius:8px;padding:3px 9px;font-size:12px;font-weight:900;white-space:nowrap">' + hsEsc(g === '기타' ? (it.grade || '—') : g) + '</span>'
    + '<div style="min-width:0;flex:1 1 220px">'
    +   '<div style="font-size:14px;font-weight:900;color:#0d2240">' + hsEsc(ts || it.title || it.code) + '</div>'
    +   '<div style="font-size:11.5px;color:#5b6b82;font-weight:700;margin-top:2px">' + hsEsc([it.subject, it.n ? it.n + '문항' : ''].filter(Boolean).join(' · ')) + '</div>'
    + '</div>'
    + (essay ? '<span style="background:#fef3c7;color:#a16207;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">서술형 ' + essay + '</span>' : '')
    + (kill ? '<span style="background:#f3e8ff;color:#7e22ce;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">최고난도 ' + kill + '</span>' : '')
    + (warn ? '<span style="background:#fee2e2;color:#dc2626;border-radius:50px;padding:3px 9px;font-size:10.5px;font-weight:900">⚠️ 문제 확인 ' + warn + '</span>' : '')
    + '<button onclick="hsOpen(\'' + code + '\')" style="padding:7px 14px;background:#1d6fe8;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:900;cursor:pointer;font-family:inherit">문항 보기</button>'
    + '<button onclick="hsDel(\'' + code + '\')" title="' + hsEsc(String(it.addedAt || '').slice(0, 10)) + ' 등록" style="padding:7px 11px;background:#fff;color:#94a3b8;border:1.5px solid #e3e9f2;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">삭제</button>'
    + '</div>';
}
rHaesolList = function(){
  var all = (HS.cat.items || []).slice();
  var h = '<div style="padding:14px;max-width:1000px">';
  h += '<div style="background:linear-gradient(135deg,#0d2240,#1d6fe8);border-radius:14px;padding:18px 20px;margin-bottom:12px;color:#fff">'
    + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
    + '<div style="font-size:19px;font-weight:900">📖 기출 해설집</div>'
    + '<div style="font-size:12px;opacity:.85;font-weight:700">학교 › 연도별로 모았습니다 — 눌러서 펼치세요</div>'
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
  /* 학년 칩 (v18-124 그대로) + 모두 펼치기/접기 */
  var gcnt = {};
  all.forEach(function(it){ var g = hsGradeOf(it); gcnt[g] = (gcnt[g] || 0) + 1; });
  var gorder = ['중1','중2','중3','고1','고2','고3','기타'].filter(function(g){ return gcnt[g]; });
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
  var items = (HS.gfilter === '전체') ? all : all.filter(function(it){ return hsGradeOf(it) === HS.gfilter; });
  var filt = HS.gfilter !== '전체';
  /* 학교 › 연도 묶기 */
  var S = {};
  items.forEach(function(it){
    var s = hs191School(it), y = hs191Year(it) || '기타';
    var sg = S[s] || (S[s] = { name: s, n: 0, years: {}, grades: {} });
    sg.n++; sg.grades[hsGradeOf(it)] = 1;
    (sg.years[y] = sg.years[y] || []).push(it);
  });
  var schools = Object.keys(S).map(function(k){ return S[k]; }).sort(function(a, b){
    var ma = hs191IsMid(a.name) ? 0 : 1, mb = hs191IsMid(b.name) ? 0 : 1;
    if (ma !== mb) return ma - mb;
    return a.name.localeCompare(b.name, 'ko');
  });
  var o = hs191LoadOpen();
  schools.forEach(function(sg){
    var sk = 's:' + sg.name, sOpen = (sk in o) ? !!o[sk] : filt;
    var ys = Object.keys(sg.years).sort(function(a, b){
      var ra = a === 'pack' ? 1 : (a === '기타' ? 2 : 0), rb = b === 'pack' ? 1 : (b === '기타' ? 2 : 0);
      if (ra !== rb) return ra - rb;
      return b.localeCompare(a);
    });
    var nums = ys.filter(function(y){ return /^20\d\d$/.test(y); });
    var range = nums.length ? (nums.length > 1 ? nums[nums.length - 1] + '~' + nums[0] : nums[0]) : '';
    var gl = ['중1','중2','중3','고1','고2','고3'].filter(function(g){ return sg.grades[g]; }).join(' · ');
    var esk = hsEsc(sk).replace(/'/g, '&#39;');
    h += '<div class="hs191-school" style="background:#fff;border:1.5px solid ' + (sOpen ? '#bcd0ee' : '#e3e9f2') + ';border-radius:14px;margin-bottom:9px;overflow:hidden">'
      + '<div class="hs191-sh" onclick="hs191Tog(\'' + esk + '\',' + (filt ? 'true' : 'false') + ')" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 16px;cursor:pointer;user-select:none;background:' + (sOpen ? '#f4f8ff' : '#fff') + '">'
      +   '<span style="font-size:13px;color:#64748b;width:14px;display:inline-block;transition:transform .15s;transform:rotate(' + (sOpen ? 90 : 0) + 'deg)">▶</span>'
      +   '<span style="font-size:16px;font-weight:900;color:#0d2240">🏫 ' + hsEsc(sg.name) + '</span>'
      +   '<span style="background:#dcfce7;color:#16a34a;border-radius:50px;padding:3px 10px;font-size:11px;font-weight:900">' + sg.n + '권</span>'
      +   (range ? '<span style="font-size:12px;color:#64748b;font-weight:800">' + range + '</span>' : '')
      +   (gl ? '<span style="margin-left:auto;font-size:11.5px;color:#94a3b8;font-weight:800">' + gl + '</span>' : '')
      + '</div>';
    if (sOpen) {
      h += '<div style="padding:2px 14px 12px">';
      ys.forEach(function(y, i){
        var yk = 'y:' + sg.name + '|' + y, yOpen = (yk in o) ? !!o[yk] : (filt || i === 0);
        var L = sg.years[y].slice().sort(function(a, b){
          var g = hs191GradeRank(a) - hs191GradeRank(b); if (g) return g;
          var t = hs191TermRank(b) - hs191TermRank(a); if (t) return t;
          return String(a.title || '').localeCompare(String(b.title || ''), 'ko');
        });
        var lab = y === 'pack' ? '📦 범위맞춤 대비 묶음' : (y === '기타' ? '연도 미상' : y + '학년도');
        var eyk = hsEsc(yk).replace(/'/g, '&#39;');
        h += '<div class="hs191-year" style="border-top:1px dashed #e3e9f2;padding-top:8px;margin-top:8px">'
          + '<div class="hs191-yh" onclick="hs191Tog(\'' + eyk + '\',' + ((filt || i === 0) ? 'true' : 'false') + ')" style="display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;padding:3px 2px">'
          +   '<span style="font-size:11px;color:#94a3b8;width:12px;display:inline-block;transform:rotate(' + (yOpen ? 90 : 0) + 'deg)">▶</span>'
          +   '<span style="font-size:14px;font-weight:900;color:#1e3a5f">' + lab + '</span>'
          +   '<span style="font-size:11.5px;color:#94a3b8;font-weight:800">' + L.length + '권</span>'
          +   (yOpen ? '' : '<span style="font-size:11.5px;color:#94a3b8;font-weight:700;margin-left:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1">' + hsEsc(L.map(function(it){ var g = hsGradeOf(it); return (g === '기타' ? '' : g + ' ') + hs191TermShort(it); }).join(' · ')) + '</span>')
          + '</div>';
        if (yOpen) L.forEach(function(it){ h += hs191Card(it); });
        h += '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
  });
  return h + '</div>';
};
