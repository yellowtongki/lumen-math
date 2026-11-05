/* ═══════════════════════════════════════════════════════════════════
 * v19-174: 🚑 리커버리 보드 2판 — 명단 한눈에(줄 표) · 반 요일 › 학년부 묶음 · 2분할 · 도구 띠 접기 · 학생 서랍
 * (계약서 docs/recovery_tab_contract.md §9 · 시안 docs/mockup_recovery_compact.html 화면 A·B)
 * 원장 2026-11-05 「추천대로 · 주간테스트 날짜도 표기(매쓰플랫 채점 기준) · 가운데 넓으면 월수금 반 / 화목토 반 2분할」
 *
 *  ① 줄 표 — 학생 한 명 = 한 줄. 칸 = 호출 토글 ✓(rcToggleCall) · 이름 · 학년·반 · 사유 칩(🔥 · 「주간 52점 · 11/1」 · 단원 1개 · 🔁 이월 · 👋 직접)
 *            · 호출 상태 · 시간(HH:MM 네이버 / ✋ 직접 / ⚠ 취소 / 예약 아직) · 학습지(n문항 ✓ / 아직) · 「상세 ›」
 *     묶음 = 반 요일(lumen_group_days: 월·수·금 / 화·목·토 / 그 밖) › 학년부(초·중·고). 완료·노쇼는 묶음 맨 아래 회색.
 *     묶음 토글 3개 · 보기 칩 6개 · 「카드 보기」 → 이 기기 localStorage rc_board_view (서버로 안 감)
 *  ② 2분할 — 가운데(.right-panel) 폭이 980px 이상이면 월·수·금 반 왼쪽 · 화·목·토 반 오른쪽, 「그 밖」은 아래 전체 폭. 좁으면 한 기둥.
 *  ③ 도구 띠(3분할 공용) — #TOOL_PANEL 을 44px 아이콘 띠로 접는다(PC 1280px 이상). 아이콘을 누르면 300px 서랍. 📌 = 늘 펼침(localStorage l3_tools_pin)
 *     리커버리 띠: 👤 📝 🛠 📨 🖨 🔐 · 다른 화면: 🛠 하나. 1024~1279 는 지금 FAB 서랍 그대로.
 *  ④ 학생 서랍 — 줄(또는 「상세 ›」)을 누르면 서랍이 「👤 이름 · 학년 · 반」 칸으로: 사유·🧩 매칭 단원·🗓 시간 칩(rcSetSlot)·📄 학습지·📨 안내문·✅ 완료·노쇼 + 아래 「🛠 전체 도구」
 *  ⑤ 옛 카드 보드(기존 함수)는 그대로 두고 「카드 보기」 칩으로 되돌린다. 왼쪽 기둥·📒 장부·📊 통계·요약 4칸·기준 줄은 바꾸지 않는다.
 *  ※ 자료·저장은 그대로(rc_state·네이버 예약·학습지 규칙). 바탕 함수는 감싸기만 한다. 문자열 연결로만 쓴다(템플릿 리터럴 금지). 학생 실명은 화면에만.
 * ═══════════════════════════════════════════════════════════════════ */
var RB174 = { sel:'', open:false, kind:'', view:null, two:false, rt:null, tools:null };
var RB174_VIEW_DEF = { group:'daygrade', filter:'all', mode:'table' };
var RB174_DAY = { mwf:'월 · 수 · 금 반', tts:'화 · 목 · 토 반', etc:'그 밖' };
var RB174_DAY_ORD = ['mwf', 'tts', 'etc'];
var RB174_GRADE = { e:'초등', m:'중등', h:'고등', x:'기타' };
var RB174_GRADE_ORD = ['e', 'm', 'h', 'x'];

/* ── 작은 도움 ── */
function rb174Q(s){ return esc2(s); }
function rb174K(k){ return String(k == null ? '' : k).replace(/'/g, ''); }
function rb174Md(ymd){ var s = String(ymd || ''); var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? (Number(m[2]) + '/' + Number(m[3])) : s; }
function rb174Grade(g){ try { return rn153Grade(g); } catch(e){ return '—'; } }
/* 학년부 — 초 / 중 / 고 / 기타 */
function rb174GradeKey(grade){
  var g = rb174Grade(grade), c = g.charAt(0);
  return c === '초' ? 'e' : (c === '중' ? 'm' : (c === '고' ? 'h' : 'x'));
}
/* 반 요일 — 월·수·금 중 하나라도 있으면 mwf · 화·목·토면 tts · 둘 다/없으면 etc */
function rb174DayKey(group){
  var gd = (typeof groupDays !== 'undefined' && groupDays) ? groupDays : {};
  var ds = (group && gd[group]) ? gd[group] : [];
  var a = false, b = false;
  (ds || []).forEach(function(d){ d = Number(d); if (d === 1 || d === 3 || d === 5) a = true; if (d === 2 || d === 4 || d === 6) b = true; });
  if (a && !b) return 'mwf';
  if (b && !a) return 'tts';
  return 'etc';
}
/* 보기 설정 — 이 기기에만 (서버로 안 감) */
function rb174View(){
  if (RB174.view) return RB174.view;
  var v = null; try { v = JSON.parse(l3Get('rc_board_view') || 'null'); } catch(e){ v = null; }
  RB174.view = Object.assign({}, RB174_VIEW_DEF, v || {});
  if (!/^(daygrade|gradeday|none)$/.test(RB174.view.group)) RB174.view.group = 'daygrade';
  if (!/^(all|fire|conf|pend|nobook|done)$/.test(RB174.view.filter)) RB174.view.filter = 'all';
  if (!/^(table|cards)$/.test(RB174.view.mode)) RB174.view.mode = 'table';
  return RB174.view;
}
function rb174SaveView(){ try { l3Set('rc_board_view', JSON.stringify(RB174.view)); } catch(e){} }
window.rb174Set = function(k, v){ var V = rb174View(); V[k] = v; rb174SaveView(); render(); };
function rb174Pin(){ return l3Get('l3_tools_pin') === '1'; }
window.rb174PinToggle = function(){ l3Set('l3_tools_pin', rb174Pin() ? '0' : '1'); if (rb174Pin()) RB174.open = true; render(); };
function rb174NbkOk(){ try { return rn153NbkOk(); } catch(e){ return false; } }
function rb174Book(k, dt){ try { return rb174NbkOk() ? rn153Book(k, dt) : null; } catch(e){ return null; } }
function rb174Cancel(k, dt){ try { return rb174NbkOk() ? rn153Cancel(k, dt) : null; } catch(e){ return null; } }
function rb174Made(k){ try { return rcwsMadeOf(k); } catch(e){ return null; } }

/* ── 줄 자료 — 자동 선발(rcRows) + 직접 추가한 확정(스냅샷) ── */
function rb174List(wk){
  var W = (RC.state.calls || {})[wk] || {}, rows = [], conf = [];
  try { rows = rcRows(); } catch(e){ rows = []; }
  try { conf = rcConfirmed(); } catch(e){ conf = []; }
  var out = [], seen = {};
  rows.forEach(function(x){
    var e = W[x.stKey] || {};
    seen[x.stKey] = 1;
    out.push({ k:x.stKey, name:x.st.name, grade:x.st.grade || '', group:x.st.group || '', st:x.st, row:x, e:e, manual:false, pri:x.pri });
  });
  conf.forEach(function(c){
    if (seen[c.k] || !c.manual) return;
    var s = (c.e && c.e.snap) || {}, st = null; try { st = rn153Stu(c.k); } catch(e){}
    out.push({ k:c.k, name:c.name, grade:(st && st.grade) || s.grade || '', group:(st && st.group) || c.group || '', st:st, row:null, e:c.e || {}, manual:true, pri:3 });
  });
  out.forEach(function(x){ x.day = rb174DayKey(x.group); x.gk = rb174GradeKey(x.grade); x.done = !!(x.e.done || x.e.noshow); });
  return out;
}
/* 보기 칩 거르기 */
function rb174Pass(x, f, dt){
  var e = x.e || {};
  if (f === 'all') return true;
  if (f === 'fire') return x.pri === 0;
  if (f === 'conf') return !!e.on && !e.done;
  if (f === 'pend') return !e.on && !e.done;
  if (f === 'done') return !!(e.done || e.noshow);
  if (f === 'nobook'){ if (!e.on || e.done) return false; return rb174NbkOk() ? !rb174Book(x.k, dt) : !e.slot; }
  return true;
}
/* 줄 순서 — 살아 있는 줄(🔥 → 점수 낮은 순) 먼저 · 완료·노쇼는 맨 아래 */
function rb174Sort(a, b){
  var r = (a.done ? 1 : 0) - (b.done ? 1 : 0); if (r) return r;
  r = (a.pri - b.pri); if (r) return r;
  var sa = a.row && a.row.testHit ? a.row.testHit.score : 100, sb = b.row && b.row.testHit ? b.row.testHit.score : 100;
  return (sa - sb) || String(a.name).localeCompare(String(b.name), 'ko');
}

/* ── 칸 그리기 ── */
function rb174Pill(cls, txt, title, extra){ return '<span class="rb174-pill' + (cls ? ' ' + cls : '') + '"' + (title ? ' title="' + rb174Q(title) + '"' : '') + (extra || '') + '>' + txt + '</span>'; }
/* 사유 칩 — 🔥 · 「주간 52점 · 11/1」(고등은 테스트 이름) · 단원 1개 · 🔁 이월 · 👋 직접 */
function rb174TestLabel(t){
  if (!t) return '';
  if (!t.ttype || t.ttype === 'WEEKLY') return '주간';
  var s = String(t.title || '').replace(/\s+/g, ' ').trim();
  if (s.length > 14) s = s.slice(0, 14) + '…';
  return s || (t.ttype === 'CHAPTER' ? '단원 TEST' : '테스트');
}
function rb174Why(x, full){
  var h = '', r = x.row, kq = rb174Q(rb174K(x.k));
  if (x.pri === 0) h += rb174Pill('fire', '🔥', '두 기준 모두 — 1순위');
  if (r && r.testHit){
    var t = r.testHit;
    h += rb174Pill('r rb174-score', rb174Q(rb174TestLabel(t)) + ' ' + t.score + '점 · <span class="rb174-sub">' + rb174Q(rb174Md(t.date)) + '</span>', '매쓰플랫 채점일 ' + String(t.date || '') + ' — 누르면 시험지 보기', ' data-rb174-score="' + kq + '" onclick="event.stopPropagation();rcOpenPaper(\'' + kq + '\')"');
  } else if (x.manual) h += rb174Pill('b', '👋 직접', '원장님이 직접 추가');
  if (r && r.unitHits && r.unitHits.length){ var u = r.unitHits[0]; h += rb174Pill('y', '「' + rb174Q(u.n) + '」 ' + u.rate + '%' + (full && r.unitHits.length > 1 ? ' +' + (r.unitHits.length - 1) : ''), (u.book || '') + ' 단원 정답률'); }
  if (r && r.carryHits && r.carryHits.length) h += rb174Pill('p', '🔁 이월', '지난 보충 뒤에도 기준 미만: ' + r.carryHits.map(function(c){ return c.n; }).join(' · '));
  return h;
}
/* 호출 상태 */
function rb174Status(e){
  if (e.done) return rb174Pill('g', '✅ ' + rb174Q(rb174Md(e.done)) + ' 완료');
  if (e.noshow) return rb174Pill('r', '⛔ 노쇼');
  if (e.on) return rb174Pill('r', '호출');
  return rb174Pill('', '미정');
}
/* 시간 — nbkRcBadge 와 같은 뜻을 짧게 */
function rb174Time(x, dt){
  var e = x.e || {};
  if (!e.on && !e.done) return '';
  if (e.done) return e.slot ? '<span class="rb174-dim">' + rb174Q(e.slot) + '</span>' : '';
  var nb = rb174NbkOk(), b = rb174Book(x.k, dt);
  if (b){
    if (e.slot && e.slotSrc === 'manual' && e.slot !== b.start) return rb174Pill('o', '✋ ' + rb174Q(e.slot) + ' ⚠', '직접 고른 시간 — 네이버 예약(' + b.start + ')과 다름');
    if (e.slot && e.slotSrc === 'manual') return rb174Pill('o', rb174Q(e.slot) + ' ✋', '직접 고른 시간(예약과 같음)');
    return rb174Pill('b', rb174Q(e.slot || b.start) + ' 네이버', '네이버 예약 시간');
  }
  if (nb){
    var cx = rb174Cancel(x.k, dt);
    if (cx && e.slot && (e.slotSrc === 'naver' || (!e.slotSrc && e.slot === cx.start))) return rb174Pill('r', '⚠ 취소 ' + rb174Q(e.slot), '네이버 예약이 취소됐어요 — 시간 칸은 그대로');
    if (e.slot) return rb174Pill('o', '✋ ' + rb174Q(e.slot), '직접 고른 시간 · 네이버 예약 아직');
    return rb174Pill('y', '예약 아직', rb174Md(dt) + ' 리커버리 네이버 예약이 아직 없어요');
  }
  return e.slot ? rb174Pill('o', rb174Q(e.slot)) : '<span class="rb174-dim">시간 미정</span>';
}
/* 학습지 */
function rb174Ws(x){
  var e = x.e || {}, m = rb174Made(x.k);
  if (m) return rb174Pill('g', m.n + '문항 ✓', '매쓰플랫 내학습지 #' + m.wsId);
  if (e.ws && e.ws.n) return rb174Pill('g', e.ws.n + '문항 ✓', '매쓰플랫 내학습지 #' + e.ws.wsId);
  if (e.on && !e.done) return rb174Pill('', '아직');
  return '';
}
function rb174Row(x, dt){
  var e = x.e || {}, kq = rb174Q(rb174K(x.k)), sel = RB174.sel === String(x.k);
  var h = '<tr class="rb174-r' + (x.done ? ' rb174-done' : '') + (sel ? ' rb174-sel' : '') + (x.pri === 0 && !x.done ? ' rb174-fire' : '') + '" data-rb174-row="' + rb174Q(x.k) + '" data-rb174-day="' + x.day + '" data-rb174-gk="' + x.gk + '" onclick="rb174Pick(this.getAttribute(\'data-rb174-row\'))">';
  /* 호출 토글 */
  if (e.done) h += '<td><button type="button" class="rb174-tg done" title="완료 — 누르면 되돌리기(↩)" onclick="event.stopPropagation();rcMarkDone(\'' + kq + '\')">✓</button></td>';
  else h += '<td><button type="button" class="rb174-tg' + (e.on ? ' on' : '') + '" data-rb174-tg="' + rb174Q(x.k) + '" aria-pressed="' + (e.on ? 'true' : 'false') + '" title="' + (e.on ? '호출 확정 — 누르면 해제' : '이번 주 호출 확정') + '" onclick="event.stopPropagation();rcToggleCall(\'' + kq + '\')">✓</button></td>';
  h += '<td class="rb174-nm">' + rb174Q(x.name) + (sel ? ' <span class="rb174-dim">◀</span>' : '') + '</td>';
  h += '<td class="rb174-gr">' + rb174Q(rb174Grade(x.grade)) + (x.group ? ' · ' + rb174Q(x.group) : '') + '</td>';
  h += '<td class="rb174-why">' + rb174Why(x, false) + '</td>';
  h += '<td>' + rb174Status(e) + '</td>';
  h += '<td class="rb174-tm">' + rb174Time(x, dt) + '</td>';
  h += '<td class="rb174-ws">' + rb174Ws(x) + '</td>';
  h += '<td class="rb174-detail">' + (x.done ? '' : '<button type="button" class="rb174-more" onclick="event.stopPropagation();rb174Pick(\'' + kq + '\')">상세 ›</button>') + '</td>';
  return h + '</tr>';
}
function rb174Head(){ return '<tr class="rb174-th"><th style="width:26px"></th><th>학생</th><th>학년 · 반</th><th>사유</th><th>호출</th><th>시간</th><th>학습지</th><th class="rb174-detail"></th></tr>'; }
/* 묶음 머리 글 — 「월 · 수 · 금 반 · 8명 · 🔥2 · 확정 5」 */
function rb174GroupStat(list){
  var fire = 0, conf = 0;
  list.forEach(function(x){ if (x.pri === 0 && !x.done) fire++; if (x.e.on) conf++; });   /* 확정 = 호출 켠 학생(완료 포함 — 왼쪽 기둥과 같은 수) */
  return list.length + '명' + (fire ? ' · 🔥' + fire : '') + ' · 확정 ' + conf;
}
/* 한 표 — list 를 (묶음 안에서) 소제목으로 나눠 그린다. subKey = 'gk' | 'day' | '' */
function rb174Table(list, dt, subKey, attr){
  var h = '<table class="rb174-t"' + (attr || '') + '>' + rb174Head();
  if (!list.length) return h + '<tr><td colspan="8" class="rb174-empty">해당 학생이 없습니다</td></tr></table>';
  var ord = subKey === 'gk' ? RB174_GRADE_ORD : (subKey === 'day' ? RB174_DAY_ORD : ['']);
  var names = subKey === 'gk' ? RB174_GRADE : (subKey === 'day' ? RB174_DAY : { '':'' });
  ord.forEach(function(key){
    var sub = subKey ? list.filter(function(x){ return x[subKey] === key; }) : list.slice();
    if (!sub.length) return;
    sub.sort(rb174Sort);
    if (subKey) h += '<tr class="rb174-g2" data-rb174-sub="' + key + '"><td colspan="8">' + names[key] + ' <small>' + sub.length + '</small></td></tr>';
    sub.forEach(function(x){ h += rb174Row(x, dt); });
  });
  return h + '</table>';
}
/* 보기 칩 · 묶음 토글 줄 */
function rb174Chips(all, dt){
  var V = rb174View(), cnt = {};
  ['all', 'fire', 'conf', 'pend', 'nobook', 'done'].forEach(function(f){ cnt[f] = all.filter(function(x){ return rb174Pass(x, f, dt); }).length; });
  var chip = function(k, v, label, n){ var on = V[k] === v; return '<button type="button" class="rb174-chip' + (on ? ' on' : '') + '" data-rb174-' + k + '="' + v + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="rb174Set(\'' + k + '\',\'' + v + '\')">' + label + (n != null ? ' ' + n : '') + '</button>'; };
  var h = '<div class="rb174-chips" data-rb174-chips="1"><span class="rb174-lb">보기</span>'
    + chip('filter', 'all', '전체', cnt.all) + chip('filter', 'fire', '🔥 1순위', cnt.fire) + chip('filter', 'conf', '확정', cnt.conf) + chip('filter', 'pend', '미정', cnt.pend)
    + chip('filter', 'nobook', '예약 아직', cnt.nobook) + chip('filter', 'done', '완료', cnt.done)
    + '<span class="rb174-sep"></span><span class="rb174-lb">묶음</span>'
    + chip('group', 'daygrade', '반 요일 › 학년부') + chip('group', 'gradeday', '학년부 › 반') + chip('group', 'none', '없음')
    + '<span class="rb174-sep"></span>'
    + '<button type="button" class="rb174-chip ghost" data-rb174-mode="cards" onclick="rb174Set(\'mode\',\'cards\')" title="옛 카드 보드로">🗂 카드 보기</button>'
    + '<button type="button" class="rb174-chip ghost" onclick="rcEditSchedule()" title="이번 주 리커버리 날짜 · 시간대">✎ 날짜·시간</button>'
    + '</div>';
  return h;
}
/* 「＋ 학생 직접 추가」 (옛 확정 명단 칸의 것) + 예약했지만 명단에 없음 */
function rb174Foot(all, wk, dt){
  var h = '', inList = {}; all.forEach(function(x){ inList[String(x.k)] = 1; });
  var addable = []; try { addable = getSortedStudents().filter(function(s){ return !inList[String(s.id || s.name)]; }); } catch(e){}
  if (addable.length){
    h += '<select class="rb174-add" onchange="rcManualAdd(this)"><option value="">＋ 학생 직접 추가 (기준 밖이어도 호출)</option>';
    addable.forEach(function(s){ var k = String(s.id || s.name); h += '<option value="' + rb174Q(k) + '">' + rb174Q(s.name) + (s.group ? ' (' + rb174Q(s.group) + ')' : '') + '</option>'; });
    h += '</select>';
  }
  try { if (rb174NbkOk() && typeof nbkRcSide === 'function'){ var conf = rcConfirmed(); h += nbkRcSide(conf, dt) || ''; } } catch(e){}
  return h ? '<div class="rb174-foot">' + h + '</div>' : '';
}
/* 보드 전체 — 칩 줄 + (2분할) 표 */
function rb174Board(){
  var wk = rcWeekKey(), dt = rcRecDate(wk), V = rb174View();
  var all = rb174List(wk), list = all.filter(function(x){ return rb174Pass(x, V.filter, dt); });
  var h = '<div class="rb174-wrap' + (RB174.two ? ' rb174-two' : '') + '" data-rb174-board="1" data-rb174-n="' + all.length + '">';
  h += rb174Chips(all, dt);
  if (!all.length) h += '<div class="rb174-none">🎉 지금 기준으로 선발된 학생이 없습니다</div>';
  var box = function(key, title, lst, subKey, cls){
    return '<div class="rb174-box ' + cls + '" data-rb174-group="' + key + '"><div class="rb174-g1">' + title + ' <small>' + rb174GroupStat(lst) + '</small></div>' + rb174Table(lst, dt, subKey) + '</div>';
  };
  if (V.group === 'daygrade'){
    h += '<div class="rb174-split" data-rb174-split="1">';
    var mwf = list.filter(function(x){ return x.day === 'mwf'; }), tts = list.filter(function(x){ return x.day === 'tts'; }), etc = list.filter(function(x){ return x.day === 'etc'; });
    if (mwf.length || tts.length){ h += box('mwf', RB174_DAY.mwf, mwf, 'gk', 'rb174-mwf'); h += box('tts', RB174_DAY.tts, tts, 'gk', 'rb174-tts'); }
    if (etc.length) h += box('etc', RB174_DAY.etc, etc, 'gk', 'rb174-etc');
    h += '</div>';
  } else if (V.group === 'gradeday'){
    RB174_GRADE_ORD.forEach(function(gk){
      var lst = list.filter(function(x){ return x.gk === gk; }); if (!lst.length) return;
      h += box(gk, RB174_GRADE[gk], lst, 'day', 'rb174-etc');
    });
  } else {
    h += '<div class="rb174-box rb174-etc" data-rb174-group="all">' + rb174Table(list.slice(), dt, '') + '</div>';
  }
  if (all.length && !list.length) h += '<div class="rb174-none">이 보기에 해당하는 학생이 없습니다</div>';
  h += rb174Foot(all, wk, dt);
  h += '<div class="rb174-note">줄을 누르면 오른쪽 서랍에 그 학생의 매칭 단원·시간·학습지가 열립니다. 호출 칸(✓)은 줄에서 바로 켜고 끕니다.</div>';
  return h + '</div>';
}

/* ── rRecovery 감싸기 — 보드 탭의 «카드 | 확정 명단» 자리를 줄 표로 ── */
var RB174_GRID = '<div class="l3r-grid"';
var _rRecovery174 = rRecovery;
rRecovery = function(){
  var h = _rRecovery174.apply(this, arguments);
  try {
    if (!RC.loaded || RC.view !== 'board') return h;
    var i = h.indexOf(RB174_GRID); if (i < 0) return h;
    if (rb174View().mode === 'cards'){
      return h.slice(0, i) + '<div class="rb174-chips" data-rb174-chips="cards"><button type="button" class="rb174-chip on" data-rb174-mode="table" onclick="rb174Set(\'mode\',\'table\')">☰ 줄 표 보기</button><span class="rb174-lb">지금은 옛 카드 보드</span></div>' + h.slice(i);
    }
    /* 그리드(카드 + 확정 명단)는 wrap 의 마지막 내용 — 그 자리에 줄 표를 넣고 wrap 만 닫는다 */
    return h.slice(0, i) + rb174Board() + '</div>';
  } catch(e){ try { console.error('[리커버리 보드 2판]', e); } catch(_){} return h; }
};

/* ── 2분할 — 가운데 폭 980px 이상 ── */
function rb174Measure(){
  var rp = document.querySelector('.app > .right-panel'), w = rp ? rp.clientWidth : 0;
  if (!w) w = (window.innerWidth || 0) - 300;
  var two = w >= 980;
  var el = document.querySelector('[data-rb174-board]');
  if (el) el.classList.toggle('rb174-two', two);
  RB174.two = two;
  return two;
}
window.addEventListener('resize', function(){ clearTimeout(RB174.rt); RB174.rt = setTimeout(function(){ try { if (VIEW === 'recovery') rb174Measure(); } catch(e){} }, 120); });

/* ── 학생 고르기 → 서랍 ── */
window.rb174Pick = function(k){
  if (k == null || k === '') return;
  k = String(k);
  if (RB174.sel === k && RB174.kind === 'stu' && RB174.open){ RB174.sel = ''; RB174.kind = ''; RB174.open = rb174Pin(); render(); return; }
  RB174.sel = k; RB174.kind = 'stu'; RB174.open = true;
  try { if (typeof L3B !== 'undefined') L3B.rcFocus = k; } catch(e){}
  render();
  var bk = l3Bucket();
  if (bk === 2){ try { l3Drawer(true); } catch(e){} }
  else if (bk < 2){ try { rcPopShow(rb174StuPanel(k, true)); } catch(e){} }
};
window.rb174Close = function(){ RB174.open = false; RB174.kind = ''; if (rb174Pin()) l3Set('l3_tools_pin', '0'); render(); };
window.rb174Open = function(kind){
  RB174.kind = kind || 'tools'; RB174.open = true; render();
  var bk = l3Bucket(); if (bk === 2){ try { l3Drawer(true); } catch(e){} }
};
/* 아이콘 띠에서 도구 칸으로 — 서랍을 열고 그 칸으로 깜빡 */
window.rb174Go = function(sel){
  RB174.kind = 'tools'; RB174.open = true; render();
  try { l3bFlash(sel); } catch(e){}
};
/* 왼쪽 기둥(l3rPick)도 줄 표에서는 줄을 고른다 */
if (typeof window.l3rPick === 'function'){
  var _l3rPick174 = window.l3rPick;
  window.l3rPick = function(k){
    if (RC.view === 'board' && rb174View().mode === 'table'){
      RB174.sel = String(k); RB174.kind = 'stu'; RB174.open = true;
      try { L3B.rcFocus = String(k); } catch(e){}
      if (RC.view !== 'board') RC.view = 'board';
      render();
      try { l3bFlash(function(){ return document.querySelector('#CONTENT tr[data-rb174-row="' + String(k).replace(/"/g, '') + '"]'); }); } catch(e){}
      return;
    }
    return _l3rPick174.apply(this, arguments);
  };
}

/* ── 학생 서랍 칸 ── */
function rb174StuPanel(k, pop){
  var wk = rcWeekKey(), dt = rcRecDate(wk), all = rb174List(wk);
  var x = null; for (var i = 0; i < all.length; i++){ if (String(all[i].k) === String(k)){ x = all[i]; break; } }
  var kq = rb174Q(rb174K(k));
  if (!x){
    var st = null; try { st = rn153Stu(k); } catch(e){}
    return '<div class="l3-tool rb174-stu" data-rb174-stu="' + rb174Q(k) + '"><b>👤 ' + rb174Q(st ? st.name : k) + '</b><span class="l3-sub">지금 명단에 없는 학생입니다.</span></div>';
  }
  var e = x.e || {}, r = x.row;
  var h = '<div class="l3-tool rb174-stu" data-rb174-stu="' + rb174Q(k) + '">';
  h += '<div class="rb174-sh"><b>👤 ' + rb174Q(x.name) + '</b><span class="rb174-dim">' + rb174Q(rb174Grade(x.grade)) + (x.group ? ' · ' + rb174Q(x.group) : '') + '</span>'
    + (pop ? '' : '<button type="button" class="rb174-x" title="닫기" onclick="rb174Close()">✕</button>') + '</div>';
  /* 사유 */
  h += '<div class="rb174-sec"><div class="rb174-st">사유</div><div class="rb174-row">' + (rb174Why(x, true) || rb174Status(e))
    + (r && r.testHit ? '<button type="button" class="rb174-sm" onclick="rcOpenPaper(\'' + kq + '\')">📄 시험지 보기</button>' : '') + '</div>';
  if (r && r.testHit && r.testHit.title) h += '<div class="rb174-dim" style="font-size:11px">' + rb174Q(r.testHit.title) + (r.testHit.correct != null && r.testHit.total ? ' · ' + r.testHit.correct + '/' + r.testHit.total : '') + ' · 매쓰플랫 채점 ' + rb174Q(String(r.testHit.date || '').replace(/-/g, '.')) + '</div>';
  h += '</div>';
  /* 🧩 매칭 단원 */
  h += '<div class="rb174-sec" data-rb174-match="' + ((r && r.match) ? r.match.length : 0) + '"><div class="rb174-st">🧩 매칭 단원</div>';
  var any = false;
  if (r && r.match && r.match.length){
    r.match.slice(0, 5).forEach(function(m){
      any = true;
      h += '<div class="rb174-row"><b>' + rb174Q(m.unit) + '</b><span class="rb174-dim">' + m.cnt + '문항 틀림</span>'
        + (m.rate != null ? rb174Pill(m.verdict === 'hole' ? 'r' : 'g', m.rate + '%') : rb174Pill('', '교재 기록 없음'))
        + (m.book ? rb174Pill('', rb174Q(m.book) + (m.minP ? ' p.' + m.minP + '~' + m.maxP : '')) : '')
        + (typeof rcVerdictChip === 'function' ? rcVerdictChip(m) : '') + '</div>';
    });
  }
  if (r && r.carryHits && r.carryHits.length) r.carryHits.slice(0, 3).forEach(function(u){ any = true; h += '<div class="rb174-row"><b>🔁 이월 · ' + rb174Q(u.n) + '</b>' + (u.rate != null ? rb174Pill('p', u.rate + '%') : '') + '<span class="rb174-dim">지난 보충 뒤에도 미만</span></div>'; });
  if (r && r.unitHits && r.unitHits.length) r.unitHits.filter(function(u){ return !(r.match || []).some(function(m){ return m.verdict === 'hole' && (rcNrm(u.n).indexOf(rcNrm(m.unit)) >= 0 || rcNrm(m.unit).indexOf(rcNrm(u.n)) >= 0); }); }).slice(0, 3)
    .forEach(function(u){ any = true; h += '<div class="rb174-row"><b>' + rb174Q(u.n) + '</b>' + rb174Pill('y', u.rate + '%') + (u.book ? rb174Pill('', rb174Q(u.book) + (u.minP ? ' p.' + u.minP + '~' + u.maxP : '')) : '') + '</div>'; });
  if (r && r.testHit && r.testHit.wrong && r.testHit.wrong.length) h += '<div class="rb174-row"><b>주간테스트 오답 유형</b>' + rb174Pill('', r.testHit.wrong.length + '개') + '</div>';
  if (!any) h += '<div class="rb174-dim">' + (x.manual ? '원장님이 직접 추가한 학생 — 매칭 단원 없음' : '매칭된 단원이 없어요') + '</div>';
  if (r && r.rx && r.rx.length) h += '<div class="rb174-rx">📋 ' + r.rx.map(rb174Q).join(' / ') + '</div>';
  h += '</div>';
  /* 🗓 시간 */
  if (e.on && !e.done){
    var T = null; try { T = rn153Times(dt, e.slot ? [e.slot] : []); } catch(err){ T = { list:(RC.cfg.slots || []).slice(), nv:{} }; }
    var b = rb174Book(k, dt);
    h += '<div class="rb174-sec" data-rb174-time="1"><div class="rb174-st">🗓 시간 · ' + rb174Q(rb174Md(dt)) + '</div><div class="rb174-row">';
    (T.list || []).forEach(function(t){
      var on = e.slot === t;
      h += '<button type="button" class="rb174-chip' + (on ? ' on' : '') + (T.nv && T.nv[t] ? ' nv' : '') + '" data-rb174-slot="' + rb174Q(t) + '" aria-pressed="' + (on ? 'true' : 'false') + '" onclick="rcSetSlot(\'' + kq + '\',\'' + rb174Q(t) + '\')">' + rb174Q(t) + (on && e.slotSrc === 'manual' ? ' ✋' : '') + '</button>';
    });
    h += '</div><div class="rb174-dim" style="font-size:11px">';
    if (b) h += '네이버 예약 ' + rb174Q(b.start) + (e.slot && e.slotSrc === 'manual' && e.slot !== b.start ? ' · ✋ 직접 고른 시간과 다름 <button type="button" class="rb174-sm" onclick="rn153UseBook(\'' + kq + '\')">예약 시간으로</button>' : (e.slotSrc === 'manual' ? ' · ✋ 직접' : ' · ⟳ 자동'));
    else h += '네이버 예약 없음' + (e.slot ? ' · 손으로 고른 시간(✋). 예약이 들어오면 ⚠로 알림' : ' · 시간을 고르면 ✋ 직접으로 고정됩니다');
    h += '</div></div>';
  }
  /* 📄 학습지 */
  h += '<div class="rb174-sec" data-rb174-ws="1"><div class="rb174-st">📄 학습지</div><div class="rb174-row">';
  var m = rb174Made(k), can = !!(r && r.testHit && typeof rcWsSchool === 'function' && rcWsSchool(x.st));
  if (m){ var p = m.parts || {}; h += '<b>' + m.n + '문항 만듦</b>' + rb174Pill('g', '매쓰플랫 #' + rb174Q(String(m.wsId))) + '<span class="rb174-dim" style="font-size:10.5px">쌍둥이 ' + (p.twin || 0) + ' · 교과서 ' + (p.tb || 0) + ' · 교재 ' + (p.book || 0) + ' · 보강 ' + (p.boost || 0) + '</span>'; }
  else if (e.ws && e.ws.n) h += '<b>' + e.ws.n + '문항 만듦</b>' + rb174Pill('g', '매쓰플랫 #' + rb174Q(String(e.ws.wsId || '')));
  else h += '<span class="rb174-dim">아직 안 만듦</span>';
  if (can) h += '<button type="button" class="rb174-sm" onclick="rcwsOpen(\'' + kq + '\')">🧩 ' + (m ? '다시 설계' : '학습지 설계') + '</button>';
  else if (!m) h += '<span class="rb174-dim" style="font-size:10.5px">' + (!(r && r.testHit) ? '주간테스트 기록이 없어 설계할 수 없어요' : '고등부는 매쓰플랫에서 직접') + '</span>';
  h += '</div></div>';
  /* 동작 */
  h += '<div class="rb174-sec rb174-acts">';
  if (!e.done){
    if (!e.on) h += '<button type="button" class="l3-btn pri" data-rb174-act="call" onclick="rcToggleCall(\'' + kq + '\')">🚑 이번 주 호출 확정</button>';
    else {
      h += '<button type="button" class="l3-btn" data-rb174-act="sms" onclick="rcOpenSms()">📨 안내문 복사</button>';
      h += '<button type="button" class="l3-btn pri" data-rb174-act="done" onclick="rcMarkDone(\'' + kq + '\')">✅ 완료</button>';
      h += '<button type="button" class="l3-btn' + (e.noshow ? ' rb174-ns' : '') + '" data-rb174-act="noshow" onclick="rcToggleNoshow(\'' + kq + '\')">⛔ ' + (e.noshow ? '노쇼 취소' : '노쇼') + '</button>';
      h += '<button type="button" class="l3-btn" data-rb174-act="off" onclick="rcToggleCall(\'' + kq + '\')">호출 해제</button>';
    }
  } else h += '<button type="button" class="l3-btn" data-rb174-act="undo" onclick="rcMarkDone(\'' + kq + '\')">↩ 완료 되돌리기</button>';
  h += '</div>';
  return h + '</div>';
}

/* ── 도구 띠 (3분할 공용) — l3Tools 를 감싼다 ── */
var RB174_RAIL = {
  recovery: [
    { ic:'👤', t:'학생 도구 — 표에서 학생 줄을 누르세요', act:'rb174Open(\'stu\')', id:'stu' },
    { ic:'📝', t:'학습지 규칙', act:'rb174Go(\'#l3r-rule\')', id:'rule' },
    { ic:'🛠', t:'만들기 · 알리기 · 인쇄', act:'rb174Go(\'#l3r-make\')', id:'make' },
    { ic:'📨', t:'학부모 안내문', act:'rcOpenSms()', id:'sms' },
    { ic:'🖨', t:'종이 학습지 인쇄', act:'rcPrint()', id:'print' },
    { ic:'🔐', t:'매쓰플랫 계정', act:'rb174Go(\'#l3r-acct-box\')', id:'acct' }
  ]
};
function rb174RailIcons(v){
  var L = RB174_RAIL[v] || [{ ic:'🛠', t:'이 화면의 도구', act:'rb174Open(\'tools\')', id:'tools' }], h = '';
  L.forEach(function(it){
    var on = RB174.open && ((it.id === 'stu' && RB174.kind === 'stu') || (it.id !== 'stu' && it.id !== 'sms' && it.id !== 'print' && RB174.kind !== 'stu'));
    h += '<button type="button" class="l3-ric' + (on ? ' on' : '') + '" data-l3-ric="' + it.id + '" title="' + rb174Q(it.t) + '" aria-label="' + rb174Q(it.t) + '" onclick="' + it.act + '">' + it.ic + '</button>';
  });
  return h;
}
function rb174DrawerTitle(){
  if (VIEW === 'recovery' && RB174.kind === 'stu') return '👤 학생';
  var t = '🛠 도구'; try { var n = l3ViewTitle(VIEW); if (n && n.name) t = '🛠 ' + n.name + ' 도구'; } catch(e){}
  return t;
}
function rb174DrawerBody(h){
  if (VIEW === 'recovery' && RB174.kind === 'stu'){
    var stu = RB174.sel ? rb174StuPanel(RB174.sel, false) : '<div class="l3-tool rb174-stu"><b>👤 학생</b><span class="l3-sub">표에서 학생 줄을 누르면 이 칸에 그 학생의 사유·매칭 단원·시간·학습지가 열립니다.</span></div>';
    return stu + '<div class="l3-ttl" style="margin-top:8px">🛠 전체 도구</div>' + String(h || '').replace('<div class="l3-ttl">도구</div>', '');
  }
  return h || '';
}
var _l3Tools174 = l3Tools;
l3Tools = function(){
  var bk = l3Bucket();
  if (bk !== 3){
    var tp0 = document.getElementById('TOOL_PANEL'); if (tp0){ tp0.classList.remove('l3-rail'); tp0.classList.remove('l3-rail-open'); }
    var r0 = _l3Tools174.apply(this, arguments);
    /* PC 1024~1279 의 FAB 서랍에도 고른 학생 칸을 맨 위에 */
    try {
      if (bk === 2 && L3.has && VIEW === 'recovery' && RB174.kind === 'stu' && RB174.sel && tp0){
        var cl = tp0.querySelector('.l3-dclose');
        if (cl && !tp0.querySelector('[data-rb174-stu]')){ var box = document.createElement('div'); box.innerHTML = rb174StuPanel(RB174.sel, false); while (box.firstChild) cl.parentNode.insertBefore(box.firstChild, cl.nextSibling); }
      }
    } catch(e){}
    return r0;
  }
  var tp = l3Panel(); if (!tp) return;
  var h = perViewRightTools(VIEW);
  L3.has = !!h;
  if (!L3.has){
    tp.classList.remove('l3-rail'); tp.classList.remove('l3-rail-open');
    if (tp.innerHTML) tp.innerHTML = ''; tp.classList.add('l3-empty');
    var app0 = document.querySelector('.app'); if (app0) app0.classList.remove('l3-tools');
    try { l3Drawer(false); } catch(e){}
    return;
  }
  var pin = rb174Pin(), open = pin || RB174.open;
  if (pin && !RB174.kind) RB174.kind = 'tools';
  if (open && !RB174.kind) RB174.kind = 'tools';
  var keep = 0; var dr0 = tp.querySelector('.l3-rdrawer'); if (dr0) keep = dr0.scrollTop;
  var out = '<div class="l3-rbar" data-l3-rail="' + (open ? 'open' : 'closed') + '">' + rb174RailIcons(VIEW)
    + '<span class="l3-rlb">도구</span>'
    + '<button type="button" class="l3-ric l3-rpin' + (pin ? ' on' : '') + '" data-l3-pin="' + (pin ? '1' : '0') + '" title="' + (pin ? '늘 펼쳐 둠 — 누르면 접기' : '늘 펼쳐 두기') + '" aria-pressed="' + (pin ? 'true' : 'false') + '" onclick="rb174PinToggle()">📌</button></div>';
  if (open){
    out += '<div class="l3-rdrawer" data-l3-drawer="1"><div class="l3-dclose l3-rhead"><b>' + rb174DrawerTitle() + '</b><span style="display:flex;gap:4px;align-items:center">'
      + '<button type="button" class="l3-rpin2' + (pin ? ' on' : '') + '" title="늘 펼쳐 두기" onclick="rb174PinToggle()">📌</button>'
      + '<button type="button" onclick="rb174Close()">닫기 ✕</button></span></div>' + rb174DrawerBody(h) + '</div>';
  }
  tp.innerHTML = out;
  tp.classList.remove('l3-empty'); tp.classList.add('l3-rail'); tp.classList.toggle('l3-rail-open', open);
  var dr = tp.querySelector('.l3-rdrawer'); if (dr && keep) dr.scrollTop = keep;
  var app = document.querySelector('.app'); if (app) app.classList.add('l3-tools');
  var fb = document.getElementById('L3_FAB'); if (fb) fb.classList.remove('on');
  try { l3Drawer(false); } catch(e){}
};
/* 화면이 바뀌면 학생 서랍은 닫는다(핀이면 도구로) · 보드를 그린 뒤 2분할 폭을 잰다 */
render = window.render = (function(o){ return function(){
  var r = o.apply(this, arguments);
  try {
    if (VIEW !== 'recovery' && RB174.kind === 'stu'){ RB174.kind = rb174Pin() ? 'tools' : ''; RB174.sel = ''; if (!rb174Pin()) RB174.open = false; }
    if (VIEW === 'recovery' && document.querySelector('[data-rb174-board]')){ var was = RB174.two; if (rb174Measure() !== was){ /* 폭이 바뀌면 class 만 바꾼다 */ } }
  } catch(e){ try { console.error('[리커버리 보드 2판 · 그리기]', e); } catch(_){} }
  return r; }; })(render);

/* ── 모양 ── */
(function(){
  if (document.getElementById('rb174-css')) return;
  var st = document.createElement('style'); st.id = 'rb174-css';
  st.textContent = ''
    /* 보드 */
    + '.rb174-wrap{min-width:0}'
    + '.rb174-chips{display:flex;gap:5px;flex-wrap:wrap;align-items:center;margin:0 0 10px}'
    + '.rb174-lb{font-size:10.5px;color:#94a3b8;font-weight:800;margin:0 2px}.rb174-sep{width:1px;height:16px;background:#cbd5e1;margin:0 4px}'
    + '.rb174-chip{border:1.5px solid #cbd5e1;border-radius:20px;padding:3px 10px;font-family:inherit;font-weight:800;font-size:11.5px;background:#fff;color:#64748b;cursor:pointer;line-height:1.4}'
    + '.rb174-chip:hover{background:#f1f5f9}.rb174-chip.on{background:#0d2240;color:#fff;border-color:#0d2240}.rb174-chip.ghost{border-style:dashed}.rb174-chip.nv{border-style:dashed;border-color:#1d6fe8;color:#1d6fe8}.rb174-chip.nv.on{background:#1d6fe8;border-color:#1d6fe8;color:#fff}'
    + '.rb174-chip:focus-visible,.rb174-tg:focus-visible,.rb174-more:focus-visible,.l3-ric:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '.rb174-split{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;align-items:start}'
    + '.rb174-two .rb174-split{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.rb174-two .rb174-split>.rb174-etc{grid-column:1 / -1}'
    + '.rb174-box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;min-width:0;margin-bottom:12px}.rb174-split>.rb174-box{margin-bottom:0}'
    + '.rb174-g1{background:#0d2240;color:#fff;font-weight:900;font-size:13px;padding:7px 12px}.rb174-g1 small{font-weight:700;color:#9fb3c8;margin-left:8px;font-size:11px}'
    + '.rb174-t{border-collapse:separate;border-spacing:0;width:100%;font-size:12px;table-layout:auto}'
    + '.rb174-t th{font-weight:800;color:#7b8694;font-size:10.5px;padding:6px 7px;text-align:left;border-bottom:1px solid #e2e8f0;background:#fafbf9;white-space:nowrap}'
    + '.rb174-t td{padding:6px 7px;border-bottom:1px dashed #e8ecea;vertical-align:middle;white-space:nowrap}'
    + '.rb174-t tr.rb174-g2 td{background:#eef2f0;color:#0d2240;font-weight:900;font-size:11px;padding:4px 10px}.rb174-t tr.rb174-g2 small{font-weight:800;color:#64748b;margin-left:4px}'
    + '.rb174-t tr.rb174-r{cursor:pointer}.rb174-t tr.rb174-r:hover td{background:#f8fafc}'
    + '.rb174-t tr.rb174-sel td{background:#fff7ee!important}.rb174-t tr.rb174-fire td{background:#fffafa}'
    + '.rb174-t tr.rb174-done td{color:#94a3b8;background:#f8fafc}.rb174-t tr.rb174-done .rb174-nm{color:#94a3b8}.rb174-t tr.rb174-done .rb174-pill{opacity:.65}'
    + '.rb174-nm{font-weight:900;color:#0d2240;font-size:12.5px}.rb174-gr{color:#64748b;font-weight:700}.rb174-why{white-space:normal!important;min-width:150px}.rb174-dim{color:#94a3b8;font-weight:700}'
    + '.rb174-pill{display:inline-block;font-size:10.5px;font-weight:900;padding:2px 7px;border-radius:10px;background:#eef1ee;color:#5b6775;white-space:nowrap;margin:1px 3px 1px 0;line-height:1.4}'
    + '.rb174-pill.r{background:#fde3e1;color:#b4433a}.rb174-pill.y{background:#fdf3d7;color:#8a5a12}.rb174-pill.g{background:#e1f2ea;color:#2f7d5b}.rb174-pill.b{background:#e3eef8;color:#2b5f8a}.rb174-pill.p{background:#ede9fe;color:#5b21b6}.rb174-pill.o{background:#fbead8;color:#c8731e}.rb174-pill.fire{background:#7c2d12;color:#fff}'
    + '.rb174-pill.rb174-score{cursor:pointer;border:1px dashed #fca5a5}.rb174-pill .rb174-sub{font-weight:800;opacity:.85}'
    + '.rb174-tg{width:22px;height:22px;border-radius:6px;border:2px solid #cbd5e1;background:#fff;color:transparent;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit;padding:0;line-height:1}'
    + '.rb174-tg.on{background:#dc2626;border-color:#dc2626;color:#fff}.rb174-tg.done{background:#2f7d5b;border-color:#2f7d5b;color:#fff}'
    + '.rb174-more{border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:8px;padding:3px 8px;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer}'
    + '.rb174-empty,.rb174-none{padding:14px;text-align:center;color:#94a3b8;font-weight:700;font-size:12.5px}'
    + '.rb174-foot{display:flex;flex-direction:column;gap:8px;margin-top:8px}'
    + '.rb174-add{width:100%;max-width:420px;border:1.5px dashed #cbd5e1;border-radius:10px;padding:8px 10px;font-family:inherit;font-size:12px;font-weight:800;color:#64748b;background:#fff;cursor:pointer}'
    + '.rb174-note{font-size:11px;color:#94a3b8;font-weight:700;margin-top:8px}'
    /* 가운데가 좁으면(한 기둥) 「상세 ›」 칸은 숨긴다 — 줄 자체를 누르면 된다 */
    + '.rb174-wrap:not(.rb174-two) .rb174-detail{display:none}'
    /* 학생 서랍 */
    + '.rb174-stu{gap:4px}.rb174-sh{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.rb174-sh b{font-size:14px;color:#0d2240}'
    + '.rb174-x{margin-left:auto;border:none;background:#f1f5f9;border-radius:6px;width:24px;height:24px;cursor:pointer;color:#64748b;font-weight:900}'
    + '.rb174-sec{border-top:1px dashed #e2e8f0;padding-top:7px;margin-top:5px;display:flex;flex-direction:column;gap:4px}.rb174-st{font-size:11.5px;font-weight:900;color:#0d2240}'
    + '.rb174-row{display:flex;gap:5px;align-items:center;flex-wrap:wrap;font-size:12px}.rb174-row b{color:#0f172a;font-size:12px}'
    + '.rb174-sm{border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;border-radius:8px;padding:3px 8px;font-family:inherit;font-size:11px;font-weight:900;cursor:pointer}'
    + '.rb174-rx{font-size:11.5px;font-weight:800;color:#0e7490;line-height:1.5}'
    + '.rb174-acts{flex-direction:row;flex-wrap:wrap;gap:5px}.rb174-acts .l3-btn{flex:1 1 auto;text-align:center;padding:7px 9px;font-size:12px}.rb174-acts .rb174-ns{background:#fee2e2;color:#b91c1c}'
    /* 도구 띠 — PC 1280px 이상 */
    + '@media(min-width:1280px){'
    + '.tool-panel.l3-rail{display:flex;flex-direction:row;align-items:stretch;gap:0;width:44px;min-width:44px;padding:0;overflow:visible;background:#fff;border-left:1px solid var(--border,#e2e8f0)}'
    + '.tool-panel.l3-rail.l3-rail-open{width:344px;min-width:344px}'
    + '.l3-rbar{flex:none;width:44px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 0;order:2;background:#fff;border-left:1px solid #e2e8f0}'
    + '.l3-rail-open .l3-rbar{border-left:1px solid #e2e8f0}'
    + '.l3-ric{width:32px;height:32px;border-radius:9px;border:none;background:#f3f5f2;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;padding:0}'
    + '.l3-ric:hover{background:#e2e8f0}.l3-ric.on{background:#0d2240}.l3-ric.on:hover{background:#0d2240}'
    + '.l3-rlb{font-size:8.5px;color:#8b95a3;font-weight:800;writing-mode:vertical-rl;margin-top:4px}'
    + '.l3-rpin{margin-top:auto}.l3-rpin.on{background:#ffd54a}'
    + '.l3-rdrawer{flex:1;min-width:0;width:300px;order:1;display:flex;flex-direction:column;gap:10px;overflow-y:auto;overflow-x:hidden;padding:12px 12px 24px;background:#f6f8fc;box-sizing:border-box}'
    + '.l3-rhead{display:flex!important}.l3-rpin2{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:4px 7px;cursor:pointer;font-family:inherit}.l3-rpin2.on{background:#ffd54a;border-color:#ffd54a}'
    + '}';
  (document.head || document.documentElement).appendChild(st);
})();
