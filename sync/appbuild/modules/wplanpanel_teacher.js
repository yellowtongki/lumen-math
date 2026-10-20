/* ═══════════════════════════════════════════════════════════════════
 * v19-114: 📅 주간 점수 화면 오른쪽 칸 = 학생 «주간계획표» (시안 docs/mockup_weekly_plan_panel.html)
 * 원장 2026-10-12 「학생들 주간계획표가 학원앱에 보여야 한다. 우측 탭을 만들고 3분할 화면으로 사용하는 것이 좋을 것 같다」
 *   → 시안 승인 「시안대로 v19-114 만들어 배포해줘」
 *
 *  ① 학생 줄(또는 이름 · 📅)을 누르면 그 학생을 고른다 — 줄 왼쪽 파란 띠. ↑/↓ 키(입력 칸 밖에서)로 다음 학생. 주를 넘겨도 그대로.
 *  ② 오른쪽 칸(RIGHT_TOOLS.plweek, v19-104 틀) — PC 1280px 이상 세 번째 기둥 · 1024~1279 「🛠 도구」 서랍(줄을 누르면 열림)
 *     · 1024px 아래(폰·태블릿)는 표 바로 아래에 같은 칸이 펼쳐진다
 *     a. 「📅 이름 주간계획표」 + 학년 · 지난 주 / 이번 주 / 다음 주 (표가 보는 주 W 기준: W-7 / W / W+7, 처음은 «다음 주» = 그 주에 낸 계획)
 *     b. 월~일 날짜 · 낸 시각과 제때/지각 + 점수(PW.judge · PW.PT — 표의 「다음 주 계획」과 같은 계산) · 스터디 코디에서 가져온 n개
 *     c. 계획 개수 · 실천 체크 수 · 계획 시간(할 일마다 n = 30분 칸 수의 합, n 이 없으면 1시간 — 학원앱 «크게 보기»·학생앱과 같은 셈)
 *     d. 요일별 할 일(시각 · 실천 ✓ · 과목 · 제목 · 출처 학습지/교재/직접…) — 하루 3개가 넘으면 「… n개 더 (펼치기)」
 *        실천 ✓ = PW.chkOf(wplan_chk_ + codi_done_) — 표의 「계획 실천」과 같은 자료. 플래너엔 O 인데 매쓰플랫·아하노트 증거가 없는 수학 할 일은 «?»
 *     e. ⤢ 크게 보기(v19-56 달력 창 plwCal) · 🖨 인쇄(이 주 계획만) · 🧭 스터디 코디에서 고치기(VIEW codi + CD.sel)
 *     f. 📔 이번 주 순공 — 표의 주(W) 사진·종이 판정·점수 + 사진(누르면 크게)
 *     g. 💬 원장님 한마디 → 학생앱 — 이미 배포된 학생앱(v2-134)이 플래너 화면에 보여 주는 「💬 선생님 한마디」 칸
 *        (lumen_store student_planner_<코드>.teacherComment) 을 이 학생 것만 바꿔 쓴다. 학생앱 새 버전 없이 바로 보인다.
 *        기록은 wpmsg_<코드> = { code, upd, last, weeks:{ 'YYYY-MM-DD'(월):{ text, like, at, off? } }, log:[…] }.
 *        한마디는 2주 동안 살아 있다. 그동안 플래너 승인 등으로 student_planner_ 를 다시 써도(publishPlannerDataForStudent)
 *        바로 뒤에 다시 넣는다 — teacherComment 만 고치고 updated_at 은 안 보낸다(그 칸은 «매일 점수를 올린 때», v19-113 과 같은 규칙).
 *  자료: 표가 이미 읽어 둔 PWB(wplan_ · wplan_chk_ · codi_plan_ · codi_done_ · sungong_)를 쓰고,
 *        학생을 고르면 그 학생 키 몇 개만 서버에서 다시 읽어(60초 캐시) 최신으로 맞춘다.
 *  ※ 바탕 코드는 고치지 않고 rPlWeek · render · publishPlannerDataForStudent 를 감싼다. 문자열 연결로만 쓴다(템플릿 리터럴 금지).
 * ═══════════════════════════════════════════════════════════════════ */
var WPP = { sel:null, rel:'next', open:{}, fAt:{}, fBusy:{}, msg:{}, mAt:{}, sp:{}, draft:{}, busy:false, zoomUrl:'', ft:0 };
var WPP_LIVE_MS = 14 * 86400000;   /* 한마디가 학생앱에 남아 있는 기간 */
function wppEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]; }); }
function wppJs(s){ return String(s == null ? '' : s).replace(/[^A-Za-z0-9_\-]/g, ''); }   /* 학생 코드(onclick 안) */
function wppB(){ try { return (typeof l3Bucket === 'function') ? l3Bucket() : 3; } catch(e){ return 3; } }
function wppSb(){ return (typeof getSupaClient === 'function') ? getSupaClient() : null; }
function wppVal(v){ if (typeof v === 'string'){ try { v = JSON.parse(v); } catch(e){ v = null; } } return v; }
function wppStu(code){ return (typeof students !== 'undefined' ? students : []).filter(function(s){ return s && s.lumen_rec_code === code; })[0] || null; }
function wppToast(m){ try { if (typeof plToast === 'function'){ plToast(m); return; } } catch(e){} try { console.log('[주간계획표] ' + m); } catch(e){} }
function wppW(){ return PWB.W || plwDefaultW(); }
function wppP(){ var W = wppW(); return WPP.rel === 'prev' ? PW.add(W, -7) : (WPP.rel === 'this' ? W : PW.add(W, 7)); }
function wppGrade(st){ return String((st && st.grade) || '').replace('학교', '').replace('등', ''); }
function wppHm(mins){ var h = Math.round(mins / 30) / 2; return h + 'h'; }

/* 한 주 계획 — 학생 달력(wplan_) 이 있으면 그것, 없으면 그 주 코디 계획(codi_plan_) — v19-56 달력 창과 같은 규칙 */
function wppPlan(c, P){
  var wk = (PWB.wp[c] && PWB.wp[c].weeks && PWB.wp[c].weeks[P]) || null;
  var items = ((wk && wk.items) || []).filter(function(it){ return it && it.title; }), codiOnly = false, sub = (wk && wk.submittedAt) || null;
  if (!items.length){
    var cp = PWB.cp[c];
    if (cp && cp.week === P && (cp.blocks || []).length){
      codiOnly = true;
      items = cp.blocks.map(function(b){ var it = b.item || {}; return { id: b.id, d: b.d, t: pwcSlotT(b.s), n: b.n, subj: it.subj || '수학', title: it.title || '', src: 'codi', kind: it.kind || '', ref: it.ref || '', part: b.part || '' }; }).filter(function(x){ return x.title; });
      sub = sub || cp.made || cp.upd || null;   /* 점수 계산(PW.fromCodi)과 같은 시각 */
    }
  }
  return { wk: wk, items: items, codiOnly: codiOnly, sub: sub };
}
/* 출처 글자 */
function wppSrc(it){
  var k = String(it.kind || ''), r = String(it.ref || '');
  if (k === 'todo') return /^a:ws:/.test(r) ? '학습지' : '할 일';
  if (k === 'ws') return '학습지';
  if (k === 'book') return '교재';
  if (k === 'wrong') return '오답';
  if (k === 'aha') return '아하노트';
  if (k === 'goal') return '목표';
  return '직접';
}
function wppEv(c, P){ return (((PWB.ev && PWB.ev.byCode) || {})[c] || {})[P] || null; }
function wppChk(c, P){ return PW.chkOf(PWB.chk[c], PWB.cd[c], P); }
/* 한 학생·한 주 요약 (패널 · 인쇄 · 검사가 같이 쓴다) */
window.wppSummary = function(c, P){
  var pl = wppPlan(c, P), chk = wppChk(c, P), ev = wppEv(c, P), mins = 0, ok = 0, codi = 0, days = [[], [], [], [], [], [], []];
  pl.items.forEach(function(it){
    mins += (+it.n || 2) * 30;
    var done = !!(chk[it.id] && chk[it.id].ok), noEv = done && !!ev && ev[it.id] === 0;
    if (done) ok++;
    if (it.src === 'codi') codi++;
    var d = +it.d; if (!(d >= 0 && d <= 6)) d = 0;
    days[d].push({ it: it, done: done, noEv: noEv, src: wppSrc(it) });
  });
  days.forEach(function(arr){ arr.sort(function(a, b){ var x = a.it.t || '99:99', y = b.it.t || '99:99'; return x < y ? -1 : (x > y ? 1 : 0); }); });
  return { P: P, n: pl.items.length, ok: ok, mins: mins, codi: codi, codiOnly: pl.codiOnly, sub: pl.sub, days: days };
};

/* ── 학생을 고르면 그 학생 키만 서버에서 다시 (60초 캐시) ── */
function wppSig(c){ try { return JSON.stringify([PWB.wp[c], PWB.chk[c], PWB.cp[c], PWB.cd[c], PWB.sg[c]]); } catch(e){ return ''; } }
async function wppFetch(c, force){
  if (!c || WPP.fBusy[c]) return;
  if (!force && WPP.fAt[c] && Date.now() - WPP.fAt[c] < 60000) return;
  WPP.fBusy[c] = 1;
  try {
    var sb = wppSb(); if (!sb) throw new Error('no supabase');
    var keys = ['wplan_' + c, 'wplan_chk_' + c, 'codi_plan_' + c, 'codi_done_' + c, 'sungong_' + c, 'wpmsg_' + c, 'student_planner_' + c];
    var r = await sb.from('lumen_store').select('key,value').in('key', keys);
    if (r && r.error) throw r.error;
    var got = {}; ((r && r.data) || []).forEach(function(row){ got[row.key] = wppVal(row.value); });
    if (got['wplan_' + c]) PWB.wp[c] = got['wplan_' + c];
    if (got['wplan_chk_' + c]) PWB.chk[c] = got['wplan_chk_' + c];
    if (got['codi_plan_' + c]) PWB.cp[c] = got['codi_plan_' + c];
    if (got['codi_done_' + c]) PWB.cd[c] = got['codi_done_' + c];
    if (got['sungong_' + c]) PWB.sg[c] = (got['sungong_' + c] && got['sungong_' + c].weeks) || {};
    WPP.msg[c] = got['wpmsg_' + c] || null; WPP.mAt[c] = Date.now();
    var sp = got['student_planner_' + c];
    WPP.sp[c] = sp ? { tc: String(sp.teacherComment || '') } : { none: true };
  } catch(e){ try { console.warn('[주간계획표] 학생 자료 다시 읽기 실패', e); } catch(_){} }
  WPP.fAt[c] = Date.now(); WPP.fBusy[c] = 0;
  if (VIEW === 'plweek' && WPP.sel === c) render();
}
function wppFetchSoon(c){ clearTimeout(WPP.ft); WPP.ft = setTimeout(function(){ wppFetch(c); }, 250); }

/* ── 고르기 ── */
window.wppPick = function(code, opt){
  opt = opt || {};
  if (!code) return;
  var changed = WPP.sel !== code;
  WPP.sel = code;
  wppFetchSoon(code);
  render();
  if (changed){ var tp = document.getElementById('TOOL_PANEL'); if (tp) tp.scrollTop = 0; }   /* 다른 학생 = 칸 맨 위부터 */
  var b = wppB();
  if (b === 2 && !opt.kbd && typeof l3Drawer === 'function') l3Drawer(true);
  setTimeout(function(){
    var tr = document.querySelector('#CONTENT tr.wpp-sel');
    if (tr && tr.scrollIntoView && opt.kbd) tr.scrollIntoView({ block: 'nearest' });
    if (b < 2 && !opt.kbd){ var ip = document.getElementById('wpp-inline'); if (ip && ip.scrollIntoView) ip.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }, 30);
};
window.wppStep = function(dir){
  var o = PWB.order || []; if (!o.length) return;
  var i = o.indexOf(WPP.sel), n = i < 0 ? (dir > 0 ? 0 : o.length - 1) : Math.max(0, Math.min(o.length - 1, i + dir));
  if (o[n] !== WPP.sel) wppPick(o[n], { kbd: true });
};
window.wppClose = function(){ WPP.sel = null; render(); };
window.wppRel = function(k){ WPP.rel = k; render(); };
window.wppMore = function(key){ WPP.open[key] = !WPP.open[key]; render(); };
window.wppDraft = function(v){ if (WPP.sel) WPP.draft[WPP.sel] = v; };
function wppRowClick(e){
  var t = e && e.target;
  if (t && t.closest && t.closest('button,select,input,textarea,a,label')) return;   /* 「📔 가져옴 ✓」·판정 고치기 칸은 그대로 */
  var c = this.getAttribute('data-wpp'); if (c) wppPick(c);
}
document.addEventListener('keydown', function(e){
  if (typeof VIEW === 'undefined' || VIEW !== 'plweek') return;
  if (e.key === 'Escape'){ var z = document.getElementById('wpp-zoom'); if (z){ z.remove(); return; } }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  if (document.getElementById('plw-cal-ov') || document.getElementById('wpp-zoom')) return;
  var a = document.activeElement, tg = a && a.tagName;
  if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || (a && a.isContentEditable)) return;
  if (!(PWB.order || []).length) return;
  e.preventDefault();
  wppStep(e.key === 'ArrowDown' ? 1 : -1);
});

/* ── 💬 원장님 한마디 → 학생앱 (student_planner_<코드>.teacherComment) ── */
function wppActive(c){
  var v = WPP.msg[c], best = null;
  if (!v || !v.weeks) return null;
  Object.keys(v.weeks).forEach(function(P){ var e = v.weeks[P]; if (!e || e.off || !e.at) return; if (!best || e.at > best.e.at) best = { P: P, e: e }; });
  if (!best) return null;
  var t = Date.parse(best.e.at); if (isNaN(t) || Date.now() - t > WPP_LIVE_MS) return null;
  return best;
}
function wppText(a){
  var rng = PW.md(a.P) + '~' + PW.md(PW.add(a.P, 6));
  if (a.e.like && !a.e.text) return '👍 ' + rng + ' 주간계획 좋아요! — 원장님';
  return '📅 ' + rng + ' 계획: ' + String(a.e.text || '') + ' — 원장님';
}
function wppGlobal(){ try { return (typeof getPlannerTeacherComment === 'function') ? String(getPlannerTeacherComment() || '') : ''; } catch(e){ return ''; } }
function wppCompose(c){ var a = wppActive(c), g = wppGlobal(); if (!a) return g; return wppText(a) + (g ? '  ·  ' + g : ''); }
async function wppMsgFetch(c){
  if (WPP.mAt[c] && Date.now() - WPP.mAt[c] < 60000) return;
  var sb = wppSb(); if (!sb) return;
  var r = await sb.from('lumen_store').select('value').eq('key', 'wpmsg_' + c);
  WPP.msg[c] = wppVal((r && r.data && r.data[0]) ? r.data[0].value : null) || null; WPP.mAt[c] = Date.now();
}
/* 학생앱 줄에 지금 한마디를 넣는다 — 줄이 없으면(아직 승인 이력 없음) 'norow' : 첫 승인 때 publish 감싸기가 넣는다 */
async function wppPushComment(c){
  var sb = wppSb(); if (!sb) return 'nosb';
  var r = await sb.from('lumen_store').select('value').eq('key', 'student_planner_' + c);
  if (r && r.error) throw r.error;
  var v = wppVal((r && r.data && r.data[0]) ? r.data[0].value : null);
  if (!v || typeof v !== 'object'){ WPP.sp[c] = { none: true }; return 'norow'; }
  var tc = wppCompose(c);
  if (String(v.teacherComment || '') === tc){ WPP.sp[c] = { tc: tc }; return 'same'; }
  v.teacherComment = tc;
  /* updated_at 은 일부러 안 보낸다 — «매일 점수를 올린 때»(앱 시작 자가치유 기준) · v19-113 과 같은 규칙 */
  var w = await sb.from('lumen_store').upsert({ key: 'student_planner_' + c, value: v }, { onConflict: 'key' });
  if (w && w.error) throw w.error;
  WPP.sp[c] = { tc: tc };
  return 'ok';
}
async function wppSaveMsg(c, mut){
  var sb = wppSb(); if (!sb) throw new Error('클라우드 연결이 없습니다');
  var r = await sb.from('lumen_store').select('value').eq('key', 'wpmsg_' + c);
  if (r && r.error) throw r.error;
  var v = wppVal((r && r.data && r.data[0]) ? r.data[0].value : null) || {};
  if (!v.weeks || typeof v.weeks !== 'object') v.weeks = {};
  if (!Array.isArray(v.log)) v.log = [];
  var now = new Date().toISOString();
  mut(v, now);
  v.code = c; v.upd = now; if (v.log.length > 40) v.log = v.log.slice(-40);
  var w = await sb.from('lumen_store').upsert({ key: 'wpmsg_' + c, value: v, updated_at: now }, { onConflict: 'key' });
  if (w && w.error) throw w.error;
  WPP.msg[c] = v; WPP.mAt[c] = Date.now();
}
window.wppSend = async function(like){
  var c = WPP.sel; if (!c || !wppStu(c) || WPP.busy) return;
  var ta = document.getElementById('wpp-msg');
  var text = String((ta && ta.value != null) ? ta.value : (WPP.draft[c] || '')).trim().slice(0, 300);
  if (!like && !text){ wppToast('보낼 말을 먼저 써 주세요'); if (ta) ta.focus(); return; }
  var P = wppP(); WPP.busy = true; render();
  try {
    await wppSaveMsg(c, function(v, now){
      var e = { text: like ? '' : text, like: !!like, at: now };
      v.weeks[P] = e; v.last = P; v.log.push({ W: P, text: e.text, like: e.like, at: now });
    });
    var res = await wppPushComment(c);
    if (!like){ WPP.draft[c] = ''; if (ta) ta.value = ''; }
    wppToast(res === 'norow' ? '💬 저장했어요 — 이 학생은 아직 학생앱 플래너 점수 줄이 없어 첫 승인 때 함께 나가요' : (like ? '👍 좋아요를 보냈어요 — 학생앱 플래너 화면 「💬 선생님 한마디」' : '💬 보냈어요 — 학생앱 플래너 화면 「💬 선생님 한마디」에 보여요'));
  } catch(e){ alert('보내지 못했습니다: ' + ((e && e.message) || e)); }
  WPP.busy = false; render();
};
window.wppUnsend = async function(){
  var c = WPP.sel, a = wppActive(c); if (!c || !a || WPP.busy) return;
  WPP.busy = true; render();
  try {
    await wppSaveMsg(c, function(v, now){ if (v.weeks[a.P]) v.weeks[a.P].off = now; v.log.push({ W: a.P, off: true, at: now }); });
    await wppPushComment(c);
    wppToast('학생앱에서 한마디를 내렸어요');
  } catch(e){ alert('내리지 못했습니다: ' + ((e && e.message) || e)); }
  WPP.busy = false; render();
};
/* 플래너 승인 등으로 학생앱 줄을 다시 쓰면(teacherComment = 공용 코멘트) — 살아 있는 한마디를 바로 다시 넣는다 */
if (typeof publishPlannerDataForStudent === 'function'){
  publishPlannerDataForStudent = window.publishPlannerDataForStudent = (function(o){ return async function(student){
    var r = await o.apply(this, arguments);
    try { var c = student && student.lumen_rec_code; if (c){ await wppMsgFetch(c); if (wppActive(c)) await wppPushComment(c); } }
    catch(e){ try { console.warn('[주간계획표] 한마디 다시 넣기 실패', e); } catch(_){} }
    return r; }; })(publishPlannerDataForStudent);
}

/* ── 그리기 ── */
function wppPanel(inline){
  if (!PWB.loaded) return '<div class="l3-tool wpp-card"><b>📅 주간계획표</b><span class="l3-sub">⏳ 주간 점수 자료를 불러오는 중…</span></div>';
  var c = WPP.sel, st = c ? wppStu(c) : null;
  if (!st) return '<div class="l3-tool wpp-card wpp-empty"><b>📅 주간계획표</b><span class="l3-sub">가운데 표에서 학생 줄(또는 📅)을 누르면 그 학생의 주간계획표가 여기에 열립니다. ↑/↓ 키로 다음 학생.</span></div>';
  if (!WPP.fAt[c] && !WPP.fBusy[c]) wppFetchSoon(c);
  var W = wppW(), P = wppP(), S = wppSummary(c, P), today = PW.day(), thisMon = PW.thisMon();
  var seg = function(k, label, w){ return '<button type="button" class="' + (WPP.rel === k ? 'on' : '') + '" aria-pressed="' + (WPP.rel === k) + '" onclick="wppRel(\'' + k + '\')" title="' + PW.md(w) + '~' + PW.md(PW.add(w, 6)) + '">' + label + '</button>'; };
  var h = '<div class="l3-tool wpp-card" id="wpp-panel" data-code="' + wppEsc(c) + '" data-week="' + P + '">';
  h += '<div class="wpp-hd"><h3>📅 ' + wppEsc(st.name) + ' 주간계획표</h3><span class="wpp-g">' + wppEsc(wppGrade(st)) + '</span>'
    + '<span class="wpp-nav"><button type="button" class="wpp-ico" onclick="wppStep(-1)" aria-label="이전 학생" title="이전 학생 (↑)">‹</button><button type="button" class="wpp-ico" onclick="wppStep(1)" aria-label="다음 학생" title="다음 학생 (↓)">›</button>'
    + (inline ? '<button type="button" class="wpp-ico" onclick="wppClose()" aria-label="닫기" title="닫기">✕</button>' : '') + '</span></div>';
  h += '<div class="wpp-seg" role="group" aria-label="어느 주">' + seg('prev', '지난 주', PW.add(W, -7)) + seg('this', '이번 주', W) + seg('next', '다음 주', PW.add(W, 7)) + '</div>';
  /* b. 날짜 · 낸 시각 · 출처 */
  var subTxt;
  if (S.sub){
    var j = PW.judge(S.sub, PW.add(P, -7));
    subTxt = (S.codiOnly ? '코디 계획 ' : '제출 ') + plwTime(S.sub) + ' (' + ({ ok: '제때', late: '지각', none: '마감 뒤' })[j] + ' · ' + PW.PT.plan[j] + '점)';
  } else if (Date.now() < PW.dueMs(PW.add(P, -7))){
    subTxt = (S.n ? '쓰는 중 · 「계획 내기」 전' : '아직 안 냄') + ' · 마감까지 ' + PW.left(PW.dueMs(PW.add(P, -7)));
  } else subTxt = (S.n ? '「계획 내기」 안 함' : '안 냄') + ' · 0점';
  var srcTxt = S.codiOnly ? '🧭 코디가 짠 계획 (학생 달력은 비어 있음)' : (S.codi ? ('스터디 코디에서 가져온 ' + S.codi + '개' + (S.n - S.codi ? ' · 직접 ' + (S.n - S.codi) + '개' : '')) : '');
  h += '<div class="wpp-line">' + PW.md(P) + '(월) ~ ' + PW.md(PW.add(P, 6)) + '(일) · ' + subTxt + (srcTxt ? ' · ' + srcTxt : '') + '</div>';
  /* c. 숫자 칸 */
  h += '<div class="wpp-kpi"><div><b>' + S.n + '</b><span>계획</span></div><div><b style="color:' + (S.ok ? '#15803d' : '#0d2240') + '">' + S.ok + '</b><span>실천 체크</span></div>'
    + '<div title="할 일마다 정한 길이(30분 칸 수)의 합 · 길이가 없는 할 일은 1시간으로"><b>' + wppHm(S.mins) + '</b><span>계획 시간</span></div></div>';
  if (S.n && P <= thisMon){
    var pr = PW.practice(PW.planOf(PWB.wp[c], PWB.cp[c], P), wppChk(c, P), P, wppEv(c, P));
    if (pr.n) h += '<div class="wpp-line">점수로 센 실천 ' + pr.ok + '/' + pr.n + ' · ' + pr.rate + '% → <b>' + pr.pt + '점</b>' + (pr.noEv ? ' · <span style="color:#b45309">증거 없음 ' + pr.noEv + '</span>' : '') + '</div>';
  }
  /* d. 요일별 */
  if (!S.n) h += '<div class="wpp-none">이 주에 쓴 계획이 아직 없어요.</div>';
  else {
    h += '<div class="wpp-days">';
    for (var d = 0; d < 7; d++){
      var arr = S.days[d], dt = PW.add(P, d), key = c + '|' + P + '|' + d, open = !!WPP.open[key];
      h += '<div class="wpp-day' + (dt === today ? ' today' : '') + (arr.length ? '' : ' empty') + '" data-d="' + d + '"><h4>' + PW.DOW[d] + ' ' + PW.md(dt) + (dt === today ? ' · 오늘' : '') + ' <span>' + (arr.length ? arr.length + '개' : '없음') + '</span></h4>';
      arr.forEach(function(x, i){
        if (i >= 3 && !open) return;
        var it = x.it, cc = PWC_COL[it.subj] || PWC_COL['기타'];
        var ck = x.done ? (x.noEv ? '<span class="wpp-ck ev" title="플래너엔 O · 그날 매쓰플랫 채점·아하노트 기록이 없어 점수엔 안 셈">?</span>' : '<span class="wpp-ck on" title="실천 ✓">✓</span>') : '<span class="wpp-ck" title="실천 체크 없음"></span>';
        h += '<div class="wpp-it" data-id="' + wppEsc(it.id) + '"><span class="t">' + wppEsc(it.t || '—') + '</span>' + ck
          + '<span class="ti" title="' + wppEsc((it.subj || '') + ' · ' + it.title + (it.part ? ' ' + it.part : '') + (it.t ? ' · ' + it.t + ' ' + ((+it.n || 2) * 30) + '분' : '')) + '"><span class="wpp-sj" style="background:' + cc[0] + ';color:' + cc[1] + '">' + wppEsc(it.subj || '기타') + '</span>' + wppEsc(it.title) + (it.part ? ' ' + wppEsc(it.part) : '') + '</span>'
          + '<span class="src">' + (it.src === 'codi' ? '🧭' : '') + x.src + '</span></div>';
      });
      if (arr.length > 3) h += '<button type="button" class="wpp-more" onclick="wppMore(\'' + wppJs(c) + '|' + P + '|' + d + '\')">' + (open ? '접기' : '… ' + (arr.length - 3) + '개 더 (펼치기)') + '</button>';
      h += '</div>';
    }
    h += '</div>';
  }
  /* e. 단추 */
  h += '<div class="wpp-btns"><button type="button" class="wpp-btn" onclick="plwCal(\'' + wppJs(c) + '\',\'' + P + '\')">⤢ 크게 보기</button>'
    + '<button type="button" class="wpp-btn" onclick="wppPrint()">🖨 인쇄</button>'
    + '<button type="button" class="wpp-btn" onclick="wppCodi()">🧭 스터디 코디에서 고치기</button></div>';
  h += '</div>';
  /* f. 순공 */
  var s = plwScore(st, W), sg = (PWB.sg[c] || {})[W] || null, url = (sg && sg.photo && typeof sgPhotoUrl === 'function') ? sgPhotoUrl(sg.photo) : null;
  WPP.zoomUrl = url || '';
  var tot = sg ? (sg.total != null ? +sg.total : 0) : 0;
  h += '<div class="l3-tool wpp-card" id="wpp-sg"><b>📔 이번 주 순공 <span class="wpp-g">' + PW.md(W) + '~' + PW.md(PW.add(W, 6)) + ' · 표의 주</span></b>'
    + '<div class="wpp-line">사진 ' + plwTag(s.photo, s.released) + (sg && sg.at ? ' ' + plwTime(sg.at) : '') + ' · ' + s.photoPt + '점' + (s.photoOv ? ' (손 고침)' : '')
    + ' · 종이 ' + (s.paperAt ? plwTag(s.paper, true) + ' ' + plwTime(s.paperAt) + ' · ' + s.paperPt + '점' : '아직 안 가져옴') + (tot ? ' · 순공 ' + Math.floor(tot / 60) + ':' + ('0' + (tot % 60)).slice(-2) : '') + '</div>'
    + '<div class="wpp-ph">' + (url ? '<button type="button" onclick="wppZoom()" aria-label="순공 사진 크게"><img src="' + wppEsc(url) + '" alt="순공 사진" loading="lazy"></button>' : '<div>순공 사진 없음</div>')
    + (s.paperAt ? '<div>📔 종이 가져옴 ✓<br>' + plwTime(s.paperAt) + '</div>' : '<button type="button" onclick="plwPaper(\'' + wppJs(c) + '\')" title="종이를 가져온 것으로 표시 (표의 「📔 가져옴 ✓」과 같음)">📔 종이 가져옴 ✓<br><small>누르면 표시</small></button>') + '</div>'
    + (sg && sg.note ? '<div class="wpp-line">💬 ' + wppEsc(sg.note) + '</div>' : '') + '</div>';
  /* g. 한마디 */
  var a = wppActive(c), sp = WPP.sp[c], draft = WPP.draft[c] || '';
  h += '<div class="l3-tool wpp-card" id="wpp-msgbox"><b>💬 원장님 한마디 → 학생앱</b>'
    + '<textarea id="wpp-msg" aria-label="원장님 한마디" maxlength="300" oninput="wppDraft(this.value)" placeholder="예) 월요일 영어 단어는 학원 오기 전에! 수요일 계획이 비었어요.">' + wppEsc(draft) + '</textarea>'
    + '<div class="wpp-btns"><button type="button" class="wpp-btn pri" onclick="wppSend(false)"' + (WPP.busy ? ' disabled' : '') + '>보내기</button><button type="button" class="wpp-btn" onclick="wppSend(true)"' + (WPP.busy ? ' disabled' : '') + '>👍 좋아요만</button>'
    + (a ? '<button type="button" class="wpp-btn" onclick="wppUnsend()"' + (WPP.busy ? ' disabled' : '') + ' title="학생앱에서 내리기">✕ 내리기</button>' : '') + '</div>'
    + (a ? '<div class="wpp-sent">학생앱에 보이는 중 · ' + plwTime(a.e.at) + ' 보냄<br>«' + wppEsc(wppText(a)) + '»</div>' : '')
    + '<span class="l3-sub">학생앱 «플래너» 화면 「💬 선생님 한마디」 칸에 <b>이 학생에게만</b> 2주 동안 보여요(보낸 주: ' + PW.md(P) + ' 주 계획).'
    + (sp && sp.none ? ' <span style="color:#b45309">이 학생은 아직 학생앱 플래너 점수 줄이 없어 첫 승인 때 함께 나가요.</span>' : '') + '</span></div>';
  return h;
}
RIGHT_TOOLS.plweek = function(){
  if (PWB.loaded && !WPP.sel && (PWB.order || []).length) WPP.sel = PWB.order[0];   /* PC 오른쪽 칸: 처음엔 맨 위 학생 */
  return '<div class="l3-ttl">학생 주간계획표</div>' + wppPanel(false);
};

/* 가운데 표: 좁은 화면은 표 바로 아래에 같은 칸 · 안내 글 · 오른쪽 칸이 열리면 표 최소 폭을 줄인다 */
(function(){
  var o = window.rPlWeek; if (typeof o !== 'function') return;
  window.rPlWeek = function(){
    var h = o.apply(this, arguments);
    if (!PWB.loaded) return h;
    h = h.replace('학생 이름(또는 📅)을 누르면 그 학생의 <b>주간계획표 달력</b>이 뜬다. ', '학생 줄(또는 이름 · 📅)을 누르면 <b>그 학생의 주간계획표</b>가 ' + (wppB() >= 2 ? '오른쪽 칸' : '표 아래') + '에 열린다 — ↑/↓ 키로 다음 학생, 「⤢ 크게 보기」는 달력. ');
    var b = wppB();
    if (b >= 3) h = h.replace('min-width:980px', 'min-width:700px');
    if (b < 2 && WPP.sel){
      var i = h.indexOf('</table></div>');
      if (i >= 0){ i += '</table></div>'.length; h = h.slice(0, i) + '<div id="wpp-inline" class="wpp-inline">' + wppPanel(true) + '</div>' + h.slice(i); }
    }
    return h;
  };
})();

/* 줄 꾸미기 — 이름·📅 단추는 «고르기»로, 줄 전체를 누를 수 있게, 고른 줄은 파란 띠 */
function wppDecorate(){
  var CT = document.getElementById('CONTENT'); if (!CT) return;
  var bs = CT.querySelectorAll('button[onclick^="plwCal("]');
  for (var i = 0; i < bs.length; i++){
    var b = bs[i], m = /plwCal\('([^']*)'\)/.exec(b.getAttribute('onclick') || ''); if (!m) continue;
    var code = m[1], tr = b.closest ? b.closest('tr') : null;
    b.setAttribute('onclick', "event.stopPropagation();wppPick('" + wppJs(code) + "')");
    b.setAttribute('title', '주간계획표 열기');
    if (b.getAttribute('aria-label')) b.setAttribute('aria-label', '주간계획표 열기');
    if (!tr) continue;
    if (!tr.classList.contains('wpp-row')){ tr.classList.add('wpp-row'); tr.setAttribute('data-wpp', code); tr.addEventListener('click', wppRowClick); }
    var on = code === WPP.sel;
    tr.classList.toggle('wpp-sel', on); tr.setAttribute('aria-selected', on ? 'true' : 'false');
    if (on && b.textContent === '📅'){ b.textContent = '📅▸'; b.classList.add('wpp-calon'); }
  }
}
render = window.render = (function(o){ return function(){
  var ae = document.activeElement, keep = (ae && ae.id === 'wpp-msg') ? { s: ae.selectionStart, e: ae.selectionEnd } : null;
  var on = (typeof VIEW !== 'undefined' && VIEW === 'plweek');
  try { document.body.classList.toggle('wpp-view', on); } catch(e){}
  var r = o.apply(this, arguments);
  try {
    on = (VIEW === 'plweek'); document.body.classList.toggle('wpp-view', on);
    if (on){
      wppDecorate();
      if (keep){ var t = document.getElementById('wpp-msg'); if (t){ t.focus(); try { t.setSelectionRange(keep.s, keep.e); } catch(_){} } }
    }
  } catch(e){ try { console.error('[주간계획표]', e); } catch(_){} }
  return r; }; })(render);

/* 순공 사진 크게 */
window.wppZoom = function(){
  if (!WPP.zoomUrl) return;
  var ov = document.createElement('div'); ov.id = 'wpp-zoom'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', '순공 사진');
  ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(13,34,64,.78);display:flex;align-items:center;justify-content:center;padding:16px;cursor:zoom-out';
  ov.innerHTML = '<img src="' + wppEsc(WPP.zoomUrl) + '" alt="순공 사진" style="max-width:100%;max-height:100%;border-radius:10px;background:#fff">';
  ov.onclick = function(){ ov.remove(); };
  document.body.appendChild(ov);
};

/* 🖨 인쇄 — 고른 주 계획만 */
window.wppPrint = function(){
  var c = WPP.sel, st = c ? wppStu(c) : null; if (!st) return;
  var P = wppP(), S = wppSummary(c, P), rng = PW.md(P) + '(월) ~ ' + PW.md(PW.add(P, 6)) + '(일)';
  var h = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>' + wppEsc(st.name) + ' 주간계획표 ' + PW.md(P) + '</title><style>'
    + '@page{size:A4 portrait;margin:12mm}body{font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#0f172a;margin:0;font-size:12px}'
    + 'h1{font-size:19px;margin:0 0 4px;color:#0d2240}.sub{color:#475569;font-size:12px;margin-bottom:10px}'
    + 'table{width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:avoid}th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left;vertical-align:top}'
    + 'th{background:#f1f5f9;font-size:11px}td.d{width:62px;font-weight:800;background:#f8fafc}td.t{width:46px;color:#475569}td.k{width:28px;text-align:center;font-size:14px}td.s{width:56px;color:#475569}td.j{width:42px}'
    + '.bar{padding:8px 0}button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid #0d2240;background:#0d2240;color:#fff;font-weight:800}@media print{.bar{display:none}}'
    + '</style></head><body><div class="bar"><button onclick="window.print()">🖨 인쇄</button></div>'
    + '<h1>📅 ' + wppEsc(st.name) + ' 주간계획표</h1><div class="sub">' + wppEsc(wppGrade(st)) + ' · ' + rng + ' · 할 일 ' + S.n + '개 · 계획 시간 ' + wppHm(S.mins) + ' · 실천 체크 ' + S.ok + '</div>';
  if (!S.n) h += '<p>이 주에 쓴 계획이 아직 없어요.</p>';
  else {
    h += '<table><tr><th>요일</th><th>시간</th><th>실천</th><th>과목</th><th>할 일</th><th>출처</th></tr>';
    for (var d = 0; d < 7; d++){
      var arr = S.days[d];
      if (!arr.length){ h += '<tr><td class="d">' + PW.DOW[d] + ' ' + PW.md(PW.add(P, d)) + '</td><td class="t"></td><td class="k"></td><td class="j"></td><td style="color:#94a3b8">—</td><td class="s"></td></tr>'; continue; }
      arr.forEach(function(x, i){
        h += '<tr>' + (i === 0 ? '<td class="d" rowspan="' + arr.length + '">' + PW.DOW[d] + ' ' + PW.md(PW.add(P, d)) + '</td>' : '')
          + '<td class="t">' + wppEsc(x.it.t || '') + '</td><td class="k">' + (x.done ? (x.noEv ? '?' : '☑') : '☐') + '</td><td class="j">' + wppEsc(x.it.subj || '') + '</td>'
          + '<td>' + wppEsc(x.it.title) + (x.it.part ? ' ' + wppEsc(x.it.part) : '') + '</td><td class="s">' + x.src + '</td></tr>';
      });
    }
    h += '</table>';
  }
  h += '<script>setTimeout(function(){window.print()},300)<\/script></body></html>';
  var w = window.open('', '_blank'); if (!w){ alert('팝업이 막혔습니다 — 허용해 주세요'); return; }
  w.document.open(); w.document.write(h); w.document.close();
};

/* 🧭 스터디 코디에서 고치기 — 코디 화면에서 그 학생을 펼친다 */
window.wppCodi = function(){
  var c = WPP.sel, st = c ? wppStu(c) : null; if (!st) return;
  var inT = true; try { if (typeof cdInTarget === 'function') inT = cdInTarget(st); } catch(e){}
  try { CD.sel = c; CD.filter = ''; CD.edit = false; } catch(e){}
  VIEW = 'codi';
  try { if (typeof cdLoad === 'function') cdLoad(); } catch(e){}
  render();
  if (!inT) wppToast('이 학생은 코디 대상(학교·학년)이 아니라 코디 목록에 없어요 — 코디 화면 「설정 바꾸기」에서 켜면 보여요');
  setTimeout(function(){ var tr = document.querySelector('#CONTENT tr[onclick="cdPick(\'' + wppJs(c) + '\')"]'); if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'center' }); }, 80);
};

/* ── 모양 ── */
(function(){
  if (document.getElementById('wpp-css')) return;
  var st = document.createElement('style'); st.id = 'wpp-css';
  st.textContent = ''
    + '@media(min-width:1280px){body.wpp-view .tool-panel:not(.l3-empty){width:340px;min-width:340px}}'
    + '@media(min-width:1536px){body.wpp-view .tool-panel:not(.l3-empty){width:380px;min-width:380px}}'
    + '#CONTENT tr.wpp-row{cursor:pointer}#CONTENT tr.wpp-row:hover td{background:#f8fbff}'
    + '#CONTENT tr.wpp-sel td,#CONTENT tr.wpp-sel:hover td{background:#eff6ff}#CONTENT tr.wpp-sel td:first-child{box-shadow:inset 4px 0 0 #2563eb}'
    + '.wpp-calon{color:#2563eb!important;border-color:#93c5fd!important;font-weight:900}'
    + '.wpp-card{gap:7px}.wpp-card .wpp-g{font-size:11px;color:#64748b;font-weight:700}'
    + '.wpp-hd{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}.wpp-hd h3{margin:0;font-size:15px;color:#0d2240;font-weight:900;min-width:0;overflow-wrap:anywhere}'
    + '.wpp-nav{margin-left:auto;display:flex;gap:4px}.wpp-ico{border:1px solid #e2e8f0;background:#fff;border-radius:7px;width:26px;height:26px;font:inherit;font-size:13px;font-weight:900;color:#334155;cursor:pointer;padding:0}'
    + '.wpp-seg{display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;align-self:flex-start}.wpp-seg button{border:none;background:#fff;padding:5px 11px;font:inherit;font-size:12px;font-weight:800;color:#475569;cursor:pointer}'
    + '.wpp-seg button+button{border-left:1px solid #e2e8f0}.wpp-seg button.on{background:#0d2240;color:#fff}'
    + '.wpp-line{font-size:11.5px;color:#64748b;font-weight:600;line-height:1.55;overflow-wrap:anywhere}.wpp-line b{color:#0d2240}'
    + '.wpp-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.wpp-kpi div{border:1px solid #e2e8f0;border-radius:10px;padding:6px 4px;text-align:center}'
    + '.wpp-kpi b{display:block;font-size:17px;color:#0d2240;font-weight:900}.wpp-kpi span{font-size:10.5px;color:#64748b;font-weight:700}'
    + '.wpp-none{font-size:12px;color:#64748b;font-weight:700;padding:6px 0}'
    + '.wpp-day{border-top:1px solid #f1f5f9;padding:6px 0 3px}.wpp-day h4{margin:0 0 3px;font-size:12px;color:#334155;display:flex;justify-content:space-between;font-weight:900}'
    + '.wpp-day h4 span{color:#64748b;font-weight:700;font-size:11px}.wpp-day.today h4{color:#ea580c}.wpp-day.empty h4{color:#94a3b8;font-weight:700}'
    + '.wpp-it{display:grid;grid-template-columns:38px 16px minmax(0,1fr) auto;gap:6px;align-items:center;font-size:12px;padding:2px 0}'
    + '.wpp-it .t{color:#64748b;font-variant-numeric:tabular-nums;font-size:11.5px}.wpp-it .ti{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:700;color:#0f172a}'
    + '.wpp-it .src{font-size:10.5px;color:#64748b;font-weight:700;white-space:nowrap}'
    + '.wpp-ck{width:15px;height:15px;border-radius:4px;border:1.5px solid #cbd5e1;display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:900;box-sizing:border-box;line-height:1}'
    + '.wpp-ck.on{background:#15803d;border-color:#15803d}.wpp-ck.ev{background:#fef3c7;border-color:#f59e0b;color:#b45309}'
    + '.wpp-sj{font-size:10px;font-weight:900;border-radius:4px;padding:1px 5px;margin-right:4px}'
    + '.wpp-more{border:none;background:none;color:#1d4ed8;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;padding:2px 0 0 44px;text-align:left}'
    + '.wpp-btns{display:flex;gap:6px;flex-wrap:wrap}.wpp-btn{border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:6px 9px;font:inherit;font-size:12px;font-weight:800;color:#0f172a;cursor:pointer}'
    + '.wpp-btn:hover{background:#f8fafc}.wpp-btn.pri{background:#0d2240;color:#fff;border-color:#0d2240}.wpp-btn[disabled]{opacity:.55;cursor:default}'
    + '.wpp-btn:focus-visible,.wpp-seg button:focus-visible,.wpp-ico:focus-visible,.wpp-more:focus-visible,.wpp-ph button:focus-visible{outline:2px solid #1d6fe8;outline-offset:2px}'
    + '.wpp-ph{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.wpp-ph>*{background:#f1f5f9;border-radius:8px;height:92px;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#64748b;font-size:11px;font-weight:700;border:none;overflow:hidden;padding:0;text-align:center;font-family:inherit;line-height:1.4}'
    + '.wpp-ph button{cursor:pointer}.wpp-ph img{width:100%;height:100%;object-fit:cover;display:block}'
    + '.wpp-card textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font:inherit;font-size:12.5px;min-height:56px;resize:vertical}'
    + '.wpp-card textarea:focus{outline:2px solid #1d6fe8;outline-offset:1px}'
    + '.wpp-sent{font-size:11.5px;font-weight:700;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 8px;overflow-wrap:anywhere}'
    + '.wpp-inline{margin-top:12px;display:flex;flex-direction:column;gap:10px;background:#f6f8fc;border:1.5px solid #bfdbfe;border-radius:14px;padding:10px;min-width:0}';
  (document.head || document.documentElement).appendChild(st);
})();
