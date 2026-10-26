/* ═══════════════════════════════════════════════════════════════════
 * v19-162: 📞 학부모 상담 — «학부모 상담 준비»(v18-49 통화 대본) + «📋 상담 리포트»(v19-161 그래프)를 한 화면으로
 *   (원장 10/26 「좌측 학부모상담준비와 통합하고 화면 구성하자」 → 시안 docs/mockup_counsel_merge.html → 「좋다. v19-162로 진행하고 배포해」)
 *   들어가는 곳: 왼쪽 «📞 학부모 상담 준비» 하나 (VIEW 'counsel'). 진도·리포트 탭의 «상담 리포트»는 뺀다.
 *     진도 현황 상세 단추(crOpen)·옛 VIEW 'consult' 는 이 화면 «📊 상담 리포트» 탭으로 온다.
 *   위: 학생 · 상담 종류 · 기간 · 집중 교재 한 줄 → 30초 브리핑(옛 4칸 + 숙제 해 온 수업 · 집중 교재 진도) + 지난 상담 / 지난 계획 대비
 *   탭: 📊 상담 리포트(crReport) · 📞 통화 대본(옛 rCounsel 을 CNS.embed 로 머리·브리핑·기록 칸 없이) · 📝 상담 기록(통화 메모 + 다음 달 계획 → 한 번에 저장)
 *   대본 «꼭 짚을 것»에 리포트 숫자(수업 N번 중 M번 · 빈 기간 · 필요 속도)를 넣는다(cnsScript 감쌈).
 *   ※ 문자열 연결로만 쓴다(중첩 템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var CN2 = { X: null };
if (typeof CNS !== 'undefined' && !CNS.tab) CNS.tab = 'rep';
function cn2Roster(){ return (students || []).filter(function(s){ return s && !s.withdrawn; }); }
function cn2Stu(){ var r = cn2Roster(), st = r.filter(function(x){ return x.id === CNS.id; })[0]; if (!st && r.length){ st = r[0]; CNS.id = st.id; } return st || null; }
/* 리포트 쪽 상태를 학생에 맞춘다 */
function cn2Sync(st){
  var code = String((st && st.lumen_rec_code) || '');
  if (CR.code !== code){ CR.code = code; CR.data = null; CR.focus = ''; CR.plan = null; CR.home = null; CR.err = ''; CR.savedAt = ''; }
  if (code && !CR.data && !CR.loading && !CR.err) setTimeout(crLoad, 0);
  var X = null; try { X = (code && CR.data && !CR.loading) ? crCompute() : null; } catch(e){ console.error(e); }
  CN2.X = X; return X;
}
/* 리포트 자료를 다 읽으면 이 화면도 다시 그린다(v19-161 crLoad 는 옛 화면 이름만 봤다) */
var _crLoad161 = crLoad;
crLoad = async function(){ await _crLoad161(); try { if (VIEW === 'counsel') render(); } catch(e){} };
window.crOpen = function(code){
  var st = (students || []).filter(function(s){ return s && String(s.lumen_rec_code || '') === String(code || ''); })[0];
  if (st) CNS.id = st.id;
  CR.code = ''; CNS.tab = 'rep';
  cnsOpen(st ? st.id : undefined);
};
window.cn2Tab = function(t){ var el = document.getElementById('cns-note'); if (el) CNS.note = el.value; CNS.tab = t; render(); };
/* 대본 «꼭 짚을 것»에 리포트 숫자 */
var _cnsScript161 = cnsScript;
cnsScript = function(g, kind){
  var out = _cnsScript161(g, kind);
  try {
    var X = CN2.X; if (!X || !X.board || !X.board.length || X.bFull * 2 >= X.board.length) return out;
    var s = '<b>' + crE(X.fshort) + '</b> 숙제는 최근 수업 ' + X.board.length + '번 중 <span class="cns-hl">해 온 날이 ' + X.bFull + '번</span>'
      + (X.gaps.length ? '이고, ' + crMD(X.gaps[0].a) + '부터 ' + X.gaps[0].n + '일 동안 거의 비어 있었습니다' : '입니다')
      + (X.other ? '. 같은 기간 ' + crE(crAbbr(X.other)) + '는 꾸준히 풀었어요.' : '.');
    if (X.prog && X.prog.need) s += ' 이 교재를 ' + crMD(X.prog.need.by) + '까지 끝내려면 <span class="cns-hl">주 ' + X.prog.need.wk + '쪽</span>씩 나가야 합니다.';
    var item = { t: '꼭 짚을 것 — ' + X.fshort + ' 숙제 흐름', tm: '40초', say: s, why: '📊 상담 리포트 탭 «숙제 흐름» 그래프를 같이 보여 드리면 좋습니다 (수업일마다 그 수업까지 매쓰플랫에 채점해 올린 문항 수)' };
    var at = -1; out.forEach(function(o, i){ if (/꼭 짚어야|걱정되는 것|물어보신 것|이번 분기|현재 위치/.test(o.t)) at = i; });
    out.splice(at >= 0 ? at + 1 : Math.min(2, out.length), 0, item);
  } catch(e){}
  return out;
};
/* 브리핑 */
function cn2Brief(st, X){
  var g = cnsGather(st), a = g.a;
  var risk = (a.a3 !== null && a.a3 < 60) ? ['🔴 최근 저조', '#fee2e2', '#b91c1c'] : (g.stuckS.length > 2 && g.asked === 0) ? ['🙋 질문 안 함', '#f3e8ff', '#7c3aed'] : (a.delta !== null && a.delta >= 20) ? ['🌱 좋아짐', '#dcfce7', '#15803d'] : ['✅ 안정', '#dbeafe', '#1d4ed8'];
  var tiles = [[a.a3 === null ? '—' : a.a3 + '%', '최근 과제 완성도', a.a3 === null ? '#fff' : (a.a3 >= 80 ? '#a7f3d0' : a.a3 >= 50 ? '#fde68a' : '#fca5a5')],
    [g.test.last === null ? '—' : g.test.last + '점', '최근 테스트' + (g.test.level ? ' (' + g.test.level + '등급)' : ''), '#fff'],
    [g.stuck.length + '개', '안 풀린 문제', g.stuck.length > 2 ? '#fca5a5' : '#a7f3d0'],
    [g.planner.rate === null ? '—' : g.planner.rate + '%', '플래너 제출', '#fff']];
  if (X && X.board.length) tiles.push([X.board.length + '번 중 ' + X.bFull + '번', X.fshort + ' 숙제 해 온 수업', X.bFull * 2 < X.board.length ? '#fca5a5' : '#a7f3d0']);
  if (X && X.prog && X.prog.pct != null) tiles.push([X.prog.pct + '%', X.fshort + ' 진도' + (X.prog.need ? ' · 필요 주 +' + X.prog.need.wk + '쪽' : ''), X.prog.status === 'r' ? '#fca5a5' : (X.prog.status === 'y' ? '#fde68a' : '#a7f3d0')]);
  var h = '<div style="background:linear-gradient(135deg,#0d2240,#1d3a6b);color:#fff;border-radius:16px;padding:14px 18px;margin-bottom:12px">'
    + '<div style="font-size:11px;font-weight:800;opacity:.75">📞 통화 전 30초 브리핑</div>'
    + '<div style="font-size:20px;font-weight:900;margin-top:2px;display:flex;align-items:center;gap:9px;flex-wrap:wrap">' + esc2(st.name)
    + ' <span style="font-size:12px;opacity:.75;font-weight:800">' + esc2(shortGradeC(st.grade)) + ' · ' + esc2(st.group || '미배정') + '반</span>'
    + '<span style="font-size:10.5px;font-weight:900;border-radius:50px;padding:3px 10px;background:' + risk[1] + ';color:' + risk[2] + '">' + risk[0] + '</span></div>'
    + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
  tiles.forEach(function(x){ h += '<div style="flex:1;min-width:110px;background:rgba(255,255,255,.1);border-radius:11px;padding:8px 11px"><b style="display:block;font-size:18px;font-weight:900;line-height:1.15;color:' + x[2] + '">' + x[0] + '</b><span style="font-size:10.5px;font-weight:800;opacity:.75">' + esc2(x[1]) + '</span></div>'; });
  h += '</div>';
  var lines = [];
  lines.push(g.last ? '📌 <b>지난 상담</b> ' + String(g.last.at).slice(5, 10).replace('-', '/') + (g.last.note ? ' — “' + esc2(String(g.last.note).slice(0, 60)) + '”' : '') + ' → 오늘 이 부분의 <b>변화</b>를 먼저 말씀드리세요.'
    : '📌 <b>첫 상담</b>입니다 — 학원 방식(4단계 숙제·아하노트)을 먼저 설명하고, 📊 상담 리포트 탭의 그래프로 지금 모습을 보여 드리세요.');
  var sv = (CR.data && CR.data.saved) || [], lp = sv[sv.length - 1];
  if (lp && lp.nums && lp.nums.need && X && X.prog && String(lp.focus) === String(X.focus))
    lines.push('🎯 <b>지난번 계획</b> ' + crMD(String(lp.at).slice(0, 10)) + ' — ' + esc2(X.fshort) + ' 주 ' + lp.nums.need + '쪽 → <b>지금 주 ' + (X.prog.pace || 0) + '쪽</b>' + ((X.prog.pace || 0) >= lp.nums.need ? ' ✓' : ''));
  h += '<div style="margin-top:10px;background:rgba(255,255,255,.13);border-radius:11px;padding:9px 12px;font-size:12.5px;font-weight:700;line-height:1.7">' + lines.join('<br>') + '</div></div>';
  return h;
}
function cn2Memo(X){
  if (!CR.memo || !X) return '';
  return '<section class="cr-memo" style="margin-top:12px"><b>🔒 원장님만 보는 상담 준비 메모</b> <span style="color:#5f6b80;font-size:12px">— 인쇄·PDF 에는 빠집니다</span><ul>' + X.memo.map(function(m){ return '<li>' + m + '</li>'; }).join('') + '</ul></section>';
}
/* 📝 상담 기록 탭 */
function cn2Log(st, X){
  var code = st.lumen_rec_code || st.id, plan = CR.plan != null ? CR.plan : (X ? X.planDef : ''), home = CR.home != null ? CR.home : (X ? X.homeDef : '');
  var h = '<div class="cr-plan" style="margin-bottom:12px">';
  h += '<section class="cr-card"><h3>통화 메모 · 분위기</h3><textarea id="cns-note" oninput="CNS.note=this.value" placeholder="어머님이 하신 말씀 / 오늘 약속한 것 …">' + esc2(CNS.note || '') + '</textarea><div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
  [['good', '🙂 좋음'], ['ok', '😐 보통'], ['bad', '😟 우려']].forEach(function(m){ var on = (CNS.mood === m[0]);
    h += '<button type="button" onclick="cnsMood(\'' + m[0] + '\')" style="border:1.5px solid ' + (on ? '#15803d' : '#bbf7d0') + ';background:' + (on ? '#15803d' : '#fff') + ';color:' + (on ? '#fff' : '#15803d') + ';border-radius:9px;padding:6px 12px;font-size:12px;font-weight:900;cursor:pointer;font-family:inherit">' + m[1] + '</button>'; });
  h += '</div></section>';
  h += '<section class="cr-card"><h3>다음 달 학원 계획 <span style="font-size:11.5px;color:#5f6b80;font-weight:600">리포트 인쇄에도 이 칸이 나갑니다</span></h3><textarea id="cr-plan" oninput="CR.plan=this.value">' + crE(plan) + '</textarea>'
    + '<h3 style="margin-top:8px">가정에서 도와주실 것</h3><textarea id="cr-home" oninput="CR.home=this.value" style="min-height:80px">' + crE(home) + '</textarea></section></div>';
  h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><button type="button" onclick="cn2Save()" ' + (CNS.saving || CR.saving ? 'disabled ' : '') + 'style="border:none;border-radius:10px;padding:10px 18px;font-size:13.5px;font-weight:900;cursor:pointer;font-family:inherit;background:#15803d;color:#fff">' + (CNS.saving || CR.saving ? '저장 중…' : '💾 상담 기록 저장') + '</button>'
    + '<span style="font-size:12px;color:#5f6b80;font-weight:700">한 번에 통화 메모(다음 대본 머리에 «지난 상담»)와 계획·핵심 숫자(다음 브리핑에 «지난번 계획 → 지금»)가 남습니다</span></div>';
  var hist = cnsHistory(code), sv = ((CR.data && CR.data.saved) || []).slice().reverse();
  h += '<section class="cr-card"><h3>지난 상담</h3>';
  if (!hist.length && !sv.length) h += '<div class="cr-note">아직 기록이 없습니다.</div>';
  hist.slice(0, 6).forEach(function(x){ var mm = { good: '🙂', ok: '😐', bad: '😟' }[x.mood] || '', kk = (CNS_KINDS.find(function(y){ return y.k === x.kind; }) || {}).t || '';
    h += '<div style="background:#f8fafc;border-radius:9px;padding:7px 11px;margin-bottom:5px;font-size:12.5px;font-weight:700;color:#475569;line-height:1.6"><b style="color:#0d2240">📞 ' + String(x.at).slice(0, 10) + '</b> · ' + esc2(kk) + ' ' + mm + (x.note ? '<br>' + esc2(x.note) : '') + '</div>'; });
  sv.slice(0, 4).forEach(function(r, i){ var first = crLines(r.plan)[0] || '';
    var cmp = (i === 0 && r.nums && r.nums.need && X && X.prog && String(r.focus) === String(X.focus)) ? ' · 계획 주 ' + r.nums.need + '쪽 → <b style="color:' + ((X.prog.pace || 0) >= r.nums.need ? '#15803d' : '#c81e1e') + '">지금 주 ' + (X.prog.pace || 0) + '쪽</b>' : '';
    h += '<div style="background:#f8fafc;border-radius:9px;padding:7px 11px;margin-bottom:5px;font-size:12.5px;font-weight:700;color:#475569;line-height:1.6"><b style="color:#0d2240">📋 ' + String(r.at).slice(0, 10) + '</b> 리포트 · ' + crE(crAbbr(r.focus)) + (r.nums && r.nums.board ? ' 수업 ' + r.nums.board + '번 중 ' + r.nums.full + '번' : '') + cmp + (first ? '<br>계획: ' + crE(first) : '') + '</div>'; });
  return h + '</section>';
}
window.cn2Save = function(){
  var st = cn2Stu(); if (!st) return;
  var el = document.getElementById('cns-note'), note = String((el ? el.value : CNS.note) || '').trim();
  var X = null; try { X = CR.data ? crCompute() : null; } catch(e){}
  if (!note && !CNS.mood && !X){ alert('통화 메모를 한 줄이라도 적어 주세요.'); return; }
  var ps = [], code = st.lumen_rec_code || st.id;
  if (note || CNS.mood){ if (!CNS.log) CNS.log = {}; if (!CNS.log[code]) CNS.log[code] = [];
    CNS.log[code].unshift({ at: new Date().toISOString(), kind: CNS.kind, note: note, mood: CNS.mood || '' }); while (CNS.log[code].length > 20) CNS.log[code].pop();
    ps.push(cnsSaveLog()); }
  if (X){ var rec = { at: new Date().toISOString(), from: X.from, to: X.to, focus: X.focus, plan: CR.plan != null ? CR.plan : X.planDef, home: CR.home != null ? CR.home : X.homeDef,
      nums: { board: X.board.length, full: X.bFull, pct: X.prog ? X.prog.pct : null, need: X.prog && X.prog.need ? X.prog.need.wk : null, pace: X.prog ? X.prog.pace : null }, note: note, kind: CNS.kind };
    var key = 'consult_' + CR.data.code, sb = getSupaClient();
    ps.push(Promise.resolve(sb ? sb.from('lumen_store').select('value').eq('key', key) : { data: [] }).then(function(r){
      var v = r && r.data && r.data[0] ? r.data[0].value : null; if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } }
      var list = (v && v.list) || []; list.push(rec); CR.data.saved = list.slice(-24); return supaSetItem(key, { list: list.slice(-24), upd: rec.at }); })); }
  CNS.saving = true; render();
  Promise.all(ps).then(function(){ CNS.saving = false; CNS.note = ''; CNS.mood = ''; CR.savedAt = new Date().toISOString().slice(0, 10); try { ahaToast('📝 상담 기록 저장 — 다음 상담 브리핑·대본에 이어집니다'); } catch(e){} render(); },
    function(e){ CNS.saving = false; alert('저장 실패: ' + ((e && e.message) || e)); render(); });
};
window.cn2Print = function(){ if (CNS.tab === 'script') cnsPrint(); else crPrint(); };
/* 화면 */
var _rCounsel161 = rCounsel;
rCounsel = function(){
  if (!HWC.kicked){ HWC.kicked = true; setTimeout(function(){ hwcLoad().then(function(){ render(); }); }, 0); }
  cnsLoad();
  var st = cn2Stu(); if (!st) return _rCounsel161();
  var X = cn2Sync(st), tab = CNS.tab || 'rep', roster = cn2Roster();
  var sel = 'font-family:inherit;font-size:13.5px;font-weight:800;border:1.5px solid #cbd5e1;border-radius:10px;padding:6px 10px;background:#fff;color:#0d2240';
  var btn = function(t, f, on, pri){ return '<button type="button" onclick="' + f + '" style="font-family:inherit;font-size:12.5px;font-weight:900;border-radius:10px;padding:7px 12px;cursor:pointer;' + (pri ? 'border:none;background:#0d2240;color:#fff' : 'border:1.5px solid ' + (on ? '#0d2240' : '#cbd5e1') + ';background:' + (on ? '#0d2240' : '#fff') + ';color:' + (on ? '#fff' : '#475569')) + '">' + t + '</button>'; };
  var h = '<style>' + CR_CSS + '.cn2-tab{border:none;background:none;font-family:inherit;font-weight:900;font-size:15px;padding:9px 15px;color:#5f6b80;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer}.cn2-tab.on{color:#0d2240;border-bottom-color:#0d2240}.cn2-tab small{font-weight:700;font-size:11px;color:#94a3b8;margin-left:5px}</style>';
  h += '<div style="padding:18px 22px 60px;background:#eef1f5;min-height:100%"><div style="max-width:1240px;margin:0 auto">';
  /* 첫째 줄: 학생 · 상담 종류 */
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px"><span style="font-size:21px;font-weight:900;color:#0d2240;margin-right:4px">📞 학부모 상담</span>';
  h += '<select onchange="cnsPick(this.value)" style="' + sel + ';max-width:280px">' + roster.map(function(x){ var d = cnsDaysSince(x.lumen_rec_code || x.id);
    return '<option value="' + x.id + '"' + (x.id === CNS.id ? ' selected' : '') + '>' + esc2(x.name) + ' (' + esc2(x.group || '미배정') + ')' + (d === null ? ' · 상담 기록 없음' : (d >= CNS_STALE_DAYS ? ' · ' + d + '일 지남' : ' · ' + d + '일 전')) + '</option>'; }).join('') + '</select>';
  CNS_KINDS.forEach(function(k){ var on = CNS.kind === k.k; h += '<button type="button" onclick="cnsKind(\'' + k.k + '\')" title="' + esc2(k.s) + '" style="font-family:inherit;font-size:12.5px;font-weight:900;border-radius:10px;padding:6px 12px;cursor:pointer;border:1.5px solid ' + (on ? '#1d6fe8' : '#e2e8f0') + ';background:' + (on ? '#1d6fe8' : '#fff') + ';color:' + (on ? '#fff' : '#475569') + '">' + k.t + '</button>'; });
  var wait = cnsWaiting().length; if (wait) h += '<span style="font-size:12px;font-weight:900;background:#fff7ed;color:#c2410c;border:1.5px solid #fed7aa;border-radius:50px;padding:4px 12px">상담 대기 ' + wait + '명</span>';
  h += '</div>';
  /* 둘째 줄: 기간 · 집중 교재 · 단추 */
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">';
  h += '<select onchange="crSetMonths(this.value)" style="' + sel + ';font-size:13px">' + [2, 3, 4, 6].map(function(m){ return '<option value="' + m + '"' + (m === CR.months ? ' selected' : '') + '>최근 ' + m + '개월</option>'; }).join('') + '</select>';
  if (X && X.books.length) h += '<select onchange="crSetFocus(this.value)" title="크게 볼 교재" style="' + sel + ';font-size:13px;border-color:#e0670b;color:#9a3412">' + X.books.map(function(b){ return '<option value="' + crE(b) + '"' + (b === X.focus ? ' selected' : '') + '>집중: ' + crE(crBookName(b)) + '</option>'; }).join('') + '</select>';
  h += '<span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">' + (tab === 'script' ? btn('📱 통화 모드', 'cnsBig()', CNS.big) : '') + btn(CR.memo ? '🔒 메모 숨기기' : '🔒 메모 보기', 'crToggleMemo()') + btn('🔄 다시 읽기', 'CR.data=null;CR.err=\'\';render()') + btn('🖨 인쇄 · PDF', 'cn2Print()', false, true) + '</span></div>';
  h += cn2Brief(st, X);
  /* 탭 */
  h += '<div role="tablist" style="display:flex;gap:4px;border-bottom:2px solid #e3e7ee;margin-bottom:12px;flex-wrap:wrap">'
    + [['rep', '📊 상담 리포트', '학부모께 보여 드릴 그래프'], ['script', '📞 통화 대본', '6단락 · 숫자 근거 · 예상 질문'], ['log', '📝 상담 기록', '통화 메모 · 다음 달 계획']].map(function(t){
      return '<button type="button" role="tab" class="cn2-tab' + (tab === t[0] ? ' on' : '') + '" onclick="cn2Tab(\'' + t[0] + '\')">' + t[1] + '<small>' + t[2] + '</small></button>'; }).join('') + '</div>';
  if (tab === 'rep'){
    if (CR.err) h += '<div style="background:#fff;border:1px solid #fecaca;border-radius:12px;padding:18px;color:#b91c1c;font-weight:800">' + crE(CR.err) + '</div>';
    else if (!X) h += '<div style="padding:50px;text-align:center;color:#94a3b8;font-weight:700">📊 진도·시험·숙제 기록을 모으는 중… (학생 한 명 · ' + CR.months + '개월)</div>';
    else h += crReport(X, 'screen');
  } else if (tab === 'script'){
    CNS.embed = true; var s = ''; try { s = _rCounsel161(); } finally { CNS.embed = false; }
    h += s.replace('<div style="padding:18px 22px;max-width:1500px">', '<div>') + cn2Memo(X);
  } else {
    h += cn2Log(st, X) + cn2Memo(X);
  }
  return h + '</div></div>';
};
/* 옛 «상담 리포트» 화면 이름으로 와도 이 화면으로 */
rConsult = function(){ VIEW = 'counsel'; CNS.tab = 'rep'; return rCounsel(); };
