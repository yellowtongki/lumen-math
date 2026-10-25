/* ═══════════════════════════════════════════════════════════════════
 * v19-152: 🎙 녹음관리 › 👀 훑어보기 — 새벽에 Gemini 가 읽어 둔 녹음을 아침에 한 화면으로 (원장 2026-10-23 「안 A로 진행」)
 *  계약서 docs/rec_review_contract.md §1·§3 · 시안 docs/mockup_rec_review.html «학원앱 새 화면 시안»
 *  읽기: lumen_store «rec_read_<YYYY-MM-DD>»(새벽 스크립트 sync/rec_night_reader.js 가 씀) · «rec_read_last»(머리줄)
 *        · «rec_topics»·«lumen_group_days»(이 기기 사본, 없으면 서버) · 등록부(이름·학년·반·미션)
 *  쓰기: lumen_store «rec_review_<코드>» = { byDate:{ 'YYYY-MM-DD':{ file, ok:true, at, msg, sec, topic } }, updated }
 *        · 쓰기 직전 서버 최신본을 읽어 byDate 를 합친다(다른 기기) · 확인 취소 = 그 날짜 칸 삭제 · 학부모앱 v1-36 이 읽는다
 *  화면: 날짜 ◀ ▶(기본 = 결과가 있는 가장 최근 날짜, 없으면 어제) · 칩 «전체 / 주제 다름만 / 아직 안 본 것»
 *        · 요약 5칸 · 학년 섹션(초→중→고) — 그날 학년 주제 · 🧭 공통 한 줄 · 카드 · 그 학년 미제출(그날 수업인 학생)
 *  그리드 ✅ · 녹음 팝업 «🌙 새벽 읽기» 도 같은 결과를 본다(build_app.py >=152 rep 블록이 rr152Has · rr152PopStt 를 꽂는다).
 *  등록부(or_studentdb)에는 쓰지 않는다. 녹음 소리·전문은 원장 화면에만.
 *  ※ 문자열 연결로만 쓴다(템플릿 리터럴 금지). 바탕 함수는 감싸기만 한다.
 * ═══════════════════════════════════════════════════════════════════ */
var RR152 = { init:false, loading:false, date:'', userDate:false, filter:'all', read:{}, month:{}, monthP:{}, last:null,
  review:{}, reviewLoaded:false, saving:{}, topics:null, gdays:null, cards:[] };
var RR152_WD = ['일','월','화','수','목','금','토'];

/* ── 작은 도구 ── */
function rr152Esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function rr152Two(n){ return (n < 10 ? '0' : '') + n; }
function rr152Ymd(d){ return d.getFullYear() + '-' + rr152Two(d.getMonth()+1) + '-' + rr152Two(d.getDate()); }
function rr152Date(ymd){ var m = String(ymd||'').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2]-1, +m[3]) : null; }
function rr152Add(ymd, n){ var d = rr152Date(ymd); if(!d) return ymd; d.setDate(d.getDate() + n); return rr152Ymd(d); }
function rr152Today(){ return rr152Ymd(new Date()); }
function rr152Yday(){ return rr152Add(rr152Today(), -1); }
function rr152Dot(ymd){ return String(ymd||'').replace(/-/g, '.'); }
function rr152Label(ymd){ var d = rr152Date(ymd); return d ? ((d.getMonth()+1) + '/' + d.getDate() + ' (' + RR152_WD[d.getDay()] + ')') : ''; }
function rr152Hm(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : rr152Two(d.getHours()) + ':' + rr152Two(d.getMinutes()); }
function rr152When(iso){ var d = new Date(iso || ''); return isNaN(d.getTime()) ? '' : (d.getMonth()+1) + '/' + d.getDate() + ' ' + rr152Hm(iso); }
function rr152Len(sec){ if(sec == null || sec === '' || isNaN(+sec)) return ''; sec = Math.max(0, Math.round(+sec)); return Math.floor(sec/60) + '분 ' + rr152Two(sec%60) + '초'; }
function rr152Val(v){ if(typeof v === 'string'){ try{ v = JSON.parse(v); }catch(e){ v = null; } } return v; }
function rr152Sb(){ try{ return getSupaClient(); }catch(e){ return null; } }
function rr152FileDate(name){ var m = String(name||'').match(/_(\d{4})(\d{2})(\d{2})_/); return m ? (m[1] + '-' + m[2] + '-' + m[3]) : ''; }
/* 학년 키 — 등록부 grade('중학교 2학년'·'중2') → '중2' (새벽 스크립트 gradeKey 와 같은 결과) */
function rr152Gk(g){
  var s = String(g || ''), m = s.match(/(초|중|고)[^0-9]*([1-6])/);
  if(m) return m[1] + m[2];
  var n = (s.match(/(\d)\s*학년/) || [])[1]; if(!n) return '';
  return (/초등/.test(s) ? '초' : /고등/.test(s) ? '고' : '중') + n;
}
function rr152GkOrder(gk){ var o = {'초':0,'중':1,'고':2}[String(gk).charAt(0)]; return (o == null ? 9 : o) * 10 + (parseInt(String(gk).slice(1), 10) || 0); }
function rr152Students(){
  var all = []; try{ all = getSortedStudents(); }catch(e){ try{ all = students.slice(); }catch(e2){ all = []; } }
  return all.filter(function(s){ return s && s.lumen_rec_code && !s.withdrawn; });
}

/* ── 서버 읽기 ── */
function rr152Rows(q){
  return q.then(function(r){
    var out = {};
    if(r && r.error) throw r.error;
    ((r && r.data) || []).forEach(function(row){ if(row && row.key) out[row.key] = rr152Val(row.value); });
    return out;
  });
}
/* 한 달 치 rec_read_YYYY-MM-* 를 like 로 한 번에 (그리드·훑어보기·팝업이 같이 쓴다) */
function rr152LoadMonthP(ym){
  if(RR152.month[ym]) return Promise.resolve(true);
  if(RR152.monthP[ym]) return RR152.monthP[ym];
  var sb = rr152Sb(); if(!sb) return Promise.resolve(false);
  var p;
  try{
    p = rr152Rows(sb.from('lumen_store').select('key,value').like('key', 'rec_read_' + ym + '-%')).then(function(map){
      Object.keys(map).forEach(function(k){
        var m = k.match(/^rec_read_(\d{4}-\d{2}-\d{2})$/);
        if(m && m[1].slice(0,7) === ym && map[k] && typeof map[k] === 'object') RR152.read[m[1]] = map[k];
      });
      RR152.month[ym] = true; delete RR152.monthP[ym];
      return true;
    }, function(e){ delete RR152.monthP[ym]; console.warn('[녹음 훑어보기] 새벽 읽기 결과를 못 읽음', e); return false; });
  }catch(e){ return Promise.resolve(false); }
  RR152.monthP[ym] = p;
  return p;
}
window.rr152LoadMonthP = rr152LoadMonthP;
function rr152LoadReviews(){
  var sb = rr152Sb(); if(!sb) return Promise.resolve(false);
  try{
    return rr152Rows(sb.from('lumen_store').select('key,value').like('key', 'rec_review_%')).then(function(map){
      Object.keys(map).forEach(function(k){
        var m = k.match(/^rec_review_(.+)$/);
        if(m && map[k] && typeof map[k] === 'object' && !RR152.saving[m[1]]) RR152.review[m[1]] = map[k];
      });
      RR152.reviewLoaded = true; return true;
    }, function(e){ console.warn('[녹음 훑어보기] 확인 기록을 못 읽음', e); return false; });
  }catch(e){ return Promise.resolve(false); }
}
/* rec_topics · lumen_group_days — 이 기기 사본이 있으면 그것, 없으면 서버에서 한 번 */
function rr152LocalTopics(){ var o = null; try{ o = lumenLS('rec_topics', null); }catch(e){} return (o && typeof o === 'object' && (Object.keys(o.byGrade||{}).length || Object.keys(o.byStudent||{}).length)) ? o : null; }
function rr152LocalDays(){
  var o = null;
  try{ if(typeof groupDays !== 'undefined' && groupDays && Object.keys(groupDays).length) o = groupDays; }catch(e){}
  if(!o){ try{ o = lumenLS('lumen_group_days', null); }catch(e){} }
  return (o && typeof o === 'object' && Object.keys(o).length) ? o : null;
}
function rr152Topics(){ return rr152LocalTopics() || RR152.topics || { byGrade:{}, byStudent:{} }; }
function rr152Days(){ return rr152LocalDays() || RR152.gdays || {}; }

function rr152Init(force){
  if(RR152.init && !force) return;
  RR152.init = true; RR152.loading = true;
  var sb = rr152Sb();
  if(!sb){ RR152.loading = false; return; }
  var keys = ['rec_read_last'];
  if(!rr152LocalTopics()) keys.push('rec_topics');
  if(!rr152LocalDays()) keys.push('lumen_group_days');
  var pKeys;
  try{ pKeys = rr152Rows(sb.from('lumen_store').select('key,value').in('key', keys)); }catch(e){ pKeys = Promise.resolve({}); }
  Promise.all([
    pKeys.then(function(m){ return m; }, function(){ return {}; }),
    rr152LoadMonthP(rr152Yday().slice(0,7)),
    rr152LoadReviews()
  ]).then(function(r){
    var map = r[0] || {};
    RR152.last = (map.rec_read_last && typeof map.rec_read_last === 'object') ? map.rec_read_last : null;
    if(map.rec_topics) RR152.topics = { byGrade:map.rec_topics.byGrade || {}, byStudent:map.rec_topics.byStudent || {} };
    if(map.lumen_group_days) RR152.gdays = map.lumen_group_days;
    var best = rr152BestDate();
    if(!RR152.userDate || !RR152.date) RR152.date = best || rr152Yday();
    return rr152LoadMonthP(RR152.date.slice(0,7));
  }).then(function(){ RR152.loading = false; rr152Paint(); }, function(e){ RR152.loading = false; console.warn('[녹음 훑어보기]', e); rr152Paint(); });
}
window.rr152Init = rr152Init;
/* 결과가 있는 가장 최근 날짜 (rec_read_last.dates + 읽어 둔 달) — 오늘보다 뒤는 빼고 */
function rr152BestDate(){
  var today = rr152Today(), c = [];
  ((RR152.last && RR152.last.dates) || []).forEach(function(d){ if(/^\d{4}-\d{2}-\d{2}$/.test(d)) c.push(d); });
  Object.keys(RR152.read).forEach(function(d){ var v = RR152.read[d]; if(v && v.items && Object.keys(v.items).length) c.push(d); });
  c = c.filter(function(d){ return d <= today; }).sort();
  return c.length ? c[c.length-1] : '';
}

/* ── 새벽 결과 찾기 (그리드 ✅ · 팝업) ── */
function rr152Item(code, file){
  var d = rr152FileDate(file); if(!d) return null;
  var rd = RR152.read[d];
  if(!rd){ if(!RR152.month[d.slice(0,7)]) rr152LoadMonthP(d.slice(0,7)); return null; }
  var arr = (rd.items || {})[code] || [];
  for(var i = 0; i < arr.length; i++){ if(arr[i] && arr[i].file === file) return arr[i]; }
  return null;
}
function rr152Stt(code, file){ var it = rr152Item(code, file); return (it && it.stt) ? String(it.stt) : ''; }
window.rr152Stt = rr152Stt;
function rr152Has(code, files){
  try{ for(var i = 0; i < (files||[]).length; i++){ var f = files[i]; if(f && rr152Stt(code, f.name || f)) return true; } }catch(e){}
  return false;
}
window.rr152Has = rr152Has;
/* 그리드: 칸을 칠하기 전에 그 달 결과를 먼저 받아 둔다 (✅ = 손 받아쓰기 또는 새벽 읽기) */
try{
  if(typeof loadRecMgrGrid === 'function'){
    loadRecMgrGrid = (function(o){ return function(){
      var self = this, args = arguments, ym = String(REC_MGR_MONTH || '').replace('.', '-');
      var go = function(){ return o.apply(self, args); };
      var p = /^\d{4}-\d{2}$/.test(ym) ? rr152LoadMonthP(ym) : Promise.resolve();
      return Promise.race([p, new Promise(function(res){ setTimeout(res, 4000); })]).then(go, go);
    }; })(loadRecMgrGrid);
    window.loadRecMgrGrid = loadRecMgrGrid;
  }
}catch(e){}

/* 녹음 팝업 STT 칸 — 손 받아쓰기(등록부)는 예전 그대로, 새벽 읽기가 있으면 «🌙 새벽 읽기» 칸 */
var RR152_BADGE = {
  ok:['b-ok','✅ 주제대로'], part:['b-warn','⚠️ 일부만'], off:['b-bad','❌ 다른 내용'], short:['b-bad','🔇 너무 짧음'],
  free:['b-dim','자유 제출'], fail:['b-dim','⚠ 읽기 실패']
};
var RR152_BCOL = { 'b-ok':['#dcfce7','#15803d'], 'b-warn':['#fef3c7','#b45309'], 'b-bad':['#fee2e2','#b91c1c'], 'b-dim':['#eef2f7','#64748b'] };
function rr152PopStt(savedRec, code, file){
  var h = '', it = null;
  try{ it = rr152Item(code, file); }catch(e){}
  savedRec = savedRec || {};
  if(it){
    var b = RR152_BADGE[it.match] || RR152_BADGE.free, c = RR152_BCOL[b[0]];
    h += '<div class="rr152-pop" style="background:#f8fafc;border-radius:8px;padding:8px;border:1px solid #c7d7f5;margin-bottom:6px">'
      + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px"><span style="font-size:10px;font-weight:800;color:#1d6fe8">🌙 새벽 읽기</span>'
      + '<span style="font-size:10px;font-weight:900;padding:1px 7px;border-radius:20px;background:' + c[0] + ';color:' + c[1] + '">' + b[1] + '</span>'
      + (rr152Len(it.sec) ? '<span style="font-size:10px;color:#64748b">' + rr152Len(it.sec) + '</span>' : '')
      + (it.at ? '<span style="font-size:10px;color:#94a3b8;margin-left:auto">' + rr152When(it.at) + '</span>' : '') + '</div>'
      + (it.topic && it.topic.t ? '<div style="font-size:11px;color:#b45309;font-weight:700;margin-bottom:3px">🎯 ' + rr152Esc(it.topic.t) + '</div>' : '')
      + (it.summary ? '<div style="font-size:12px;color:#17243a;margin-bottom:3px">' + rr152Esc(it.summary) + '</div>' : '')
      + (it.err ? '<div style="font-size:11px;color:#b91c1c;font-weight:700;margin-bottom:3px">개념 오류: ' + rr152Esc(it.err) + '</div>' : '')
      + ((!savedRec.stt && it.stt) ? '<div style="font-size:12px;color:#334155;line-height:1.6;border-top:1px dashed #dfe4ec;padding-top:4px">' + rr152Esc(it.stt) + '</div>' : '')
      + '</div>';
  }
  if(savedRec.stt){
    h += '<div style="background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0;margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:4px">🔤 STT</div><div style="font-size:12px;color:#334155;line-height:1.6">' + savedRec.stt + '</div></div>';
  }
  return h;
}
window.rr152PopStt = rr152PopStt;

/* ── 그날 주제 (§0 우선순위: 미션 → 개인 → 학년, 날짜 키가 없으면 7일 안 가장 가까운 지난 날짜) ── */
function rr152Near(map, ymd){
  if(!map) return null;
  for(var i = 0; i < 7; i++){ var k = rr152Dot(rr152Add(ymd, -i)); if(map[k] && map[k].t) return map[k]; }
  return null;
}
function rr152GradeTopic(gk, ymd){ var t = rr152Near((rr152Topics().byGrade || {})[gk], ymd); return t ? { t:String(t.t), g:t.g || '', src:'grade' } : null; }
function rr152TopicFor(st, ymd){
  if(!st) return null;
  var ms = String(st.lumen_rec_mission || '').trim(); if(ms) return { t:ms, src:'mission' };
  var p = rr152Near((rr152Topics().byStudent || {})[st.lumen_rec_code], ymd); if(p) return { t:String(p.t), src:'student' };
  return rr152GradeTopic(rr152Gk(st.grade), ymd);
}
function rr152HasClass(st, dow){
  var gd = rr152Days(), days = (st && st.group && gd[st.group]) ? gd[st.group] : null;
  return (Array.isArray(days) && days.length) ? days.map(Number).indexOf(dow) >= 0 : [1,3,5].indexOf(dow) >= 0;
}

/* ── 화면 자료 ── */
function rr152Model(ymd){
  var rd = RR152.read[ymd]; if(!rd) return null;
  var items = rd.items || {}, fail = rd.fail || {};
  var stu = rr152Students(), by = {}, order = {};
  stu.forEach(function(s, i){ by[s.lumen_rec_code] = s; order[s.lumen_rec_code] = i; });
  var dd = rr152Date(ymd), dow = dd ? dd.getDay() : -1;
  var G = {};
  var grp = function(gk){ gk = gk || '기타'; if(!G[gk]) G[gk] = { gk:gk, cards:[], sub:{}, cls:{} }; return G[gk]; };
  Object.keys(items).forEach(function(code){
    (Array.isArray(items[code]) ? items[code] : []).forEach(function(it){
      if(!it) return;
      var st = by[code] || null, g = grp(it.grade || rr152Gk(st && st.grade));
      g.cards.push({ code:code, st:st, it:it }); g.sub[code] = 1;
    });
  });
  Object.keys(fail).forEach(function(code){
    var have = {}; ((items[code] || [])).forEach(function(x){ if(x) have[x.file] = 1; });
    (Array.isArray(fail[code]) ? fail[code] : []).forEach(function(f){
      if(!f || have[f]) return;
      var st = by[code] || null, g = grp(rr152Gk(st && st.grade));
      g.cards.push({ code:code, st:st, it:{ file:f, code:code, match:'fail', sec:null, topic:rr152TopicFor(st, ymd) || { t:'', src:'free' },
        summary:'새벽 읽기에 실패했어요 — ▶ 듣기로 직접 확인해 주세요.', why:'', missing:'', err:'', stt:'' } });
      g.sub[code] = 1;
    });
  });
  stu.forEach(function(st){ if(dow >= 0 && rr152HasClass(st, dow)) grp(rr152Gk(st.grade)).cls[st.lumen_rec_code] = st; });
  var list = Object.keys(G).map(function(k){ return G[k]; }).sort(function(a, b){ return rr152GkOrder(a.gk) - rr152GkOrder(b.gk) || (a.gk < b.gk ? -1 : 1); });
  var S = { n:0, ok:0, part:0, bad:0, free:0, miss:0 };
  list.forEach(function(g){
    g.cards.sort(function(a, b){
      var oa = order[a.code] == null ? 9999 : order[a.code], ob = order[b.code] == null ? 9999 : order[b.code];
      return oa - ob || (String(a.it.file) < String(b.it.file) ? -1 : 1);
    });
    g.missing = Object.keys(g.cls).filter(function(c){ return !g.sub[c]; }).sort(function(a, b){ return order[a] - order[b]; }).map(function(c){ return g.cls[c]; });
    var all = {}; Object.keys(g.cls).forEach(function(c){ all[c] = 1; }); Object.keys(g.sub).forEach(function(c){ all[c] = 1; });
    g.nSub = Object.keys(g.sub).length; g.nAll = Object.keys(all).length;
    g.cards.forEach(function(c){
      var m = c.it.match; S.n++;
      if(m === 'ok') S.ok++; else if(m === 'part') S.part++; else if(m === 'off' || m === 'short') S.bad++; else if(m === 'free') S.free++;
    });
    S.miss += g.missing.length;
  });
  return { rd:rd, groups:list, S:S };
}
function rr152Rev(code, ymd){ var r = RR152.review[code]; return (r && r.byDate && r.byDate[ymd]) || null; }
function rr152Done(c, ymd){ var rv = rr152Rev(c.code, ymd); return !!(rv && rv.ok && rv.file === c.it.file); }

/* 한마디 칩 — 판정별 먼저, 그다음 다른 것, 맨 끝 ✏️ 직접 쓰기 */
function rr152Chips(it){
  var miss = String((it && it.missing) || '').trim();
  var by = {
    ok:['주제대로 잘 설명했어요', '예시까지 들어 좋았어요'],
    part: miss ? ['다음엔 ' + miss + '도 같이', '핵심은 잘 짚었어요, 다음엔 ' + miss + '까지'] : ['다음엔 빠진 부분도 같이', '핵심은 잘 짚었어요, 다음엔 끝까지'],
    off:['오늘 주제로 다시 한 번!'],
    short:['조금 더 길게, 예를 하나 들어 보자'],
    free:['스스로 설명해 본 것 좋아요']
  };
  var m = (it && it.match) || 'free', out = (by[m] || []).slice();
  ['ok','off','short','free'].forEach(function(k){ if(k !== m) by[k].forEach(function(x){ if(out.indexOf(x) < 0) out.push(x); }); });
  return out;
}

/* ── 그리기 ── */
var RR152_CSS = '<style id="rr152-css">'
  + '.rr152{--bg:#f3f5f9;--card:#ffffff;--fg:#17243a;--mute:#6b7890;--line:#dfe4ec;--navy:#0d2240;--blue:#1d6fe8;--blue-soft:#e8f0fd;'
  + '--ok:#15803d;--ok-bg:#dcfce7;--warn:#b45309;--warn-bg:#fef3c7;--bad:#b91c1c;--bad-bg:#fee2e2;--dim:#64748b;--dim-bg:#eef2f7;'
  + 'color:var(--fg);font-size:14px;line-height:1.6;padding:14px}'
  + '.rr152 *{box-sizing:border-box}'
  + '.rr152 .rr-app{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden}'
  + '.rr152 .rr-appbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--bg)}'
  + '.rr152 .rr-appbar .rr-title{font-weight:900;color:var(--navy);font-size:15px;margin-right:auto}'
  + '.rr152 .rr-night{flex-basis:100%;display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--mute);font-weight:700}'
  + '.rr152 .rr-chip{display:inline-flex;align-items:center;gap:4px;border:1.5px solid var(--line);background:var(--card);border-radius:20px;padding:4px 11px;font-size:12px;font-weight:700;color:var(--mute);cursor:pointer;font-family:inherit;line-height:1.5}'
  + '.rr152 .rr-chip.rr-on{border-color:var(--blue);color:var(--blue);background:var(--blue-soft)}'
  + '.rr152 .rr-chip[disabled]{opacity:.4;cursor:default}'
  + '.rr152 .rr-sum{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px 16px;border-bottom:1px solid var(--line)}'
  + '@media(max-width:700px){.rr152 .rr-sum{grid-template-columns:repeat(3,1fr)}}'
  + '.rr152 .rr-sum>div{background:var(--bg);border-radius:10px;padding:8px 10px;min-width:0}'
  + '.rr152 .rr-sum .rr-n{font-size:20px;font-weight:900;color:var(--navy);font-variant-numeric:tabular-nums}'
  + '.rr152 .rr-sum .rr-l{font-size:11px;color:var(--mute);font-weight:700}'
  + '.rr152 .rr-grade{padding:14px 16px;border-bottom:1px solid var(--line)}'
  + '.rr152 .rr-grade:last-child{border-bottom:0}'
  + '.rr152 .rr-ghead{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;margin-bottom:8px}'
  + '.rr152 .rr-ghead b{font-size:15px;color:var(--navy)}'
  + '.rr152 .rr-ghead .rr-topic{font-size:12.5px;background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:2px 9px;font-weight:700}'
  + '.rr152 .rr-ghead .rr-cnt{font-size:12px;color:var(--mute);font-weight:700}'
  + '.rr152 .rr-brief{font-size:12.5px;color:var(--mute);background:var(--bg);border-left:3px solid var(--blue);padding:6px 10px;border-radius:0 8px 8px 0;margin-bottom:10px}'
  + '.rr152 .rr-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}'
  + '.rr152 .rr-card{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--card);min-width:0;display:flex;flex-direction:column;gap:6px}'
  + '.rr152 .rr-card.rr-bad{border-color:#fca5a5}.rr152 .rr-card.rr-warn{border-color:#fcd34d}'
  + '.rr152 .rr-card.rr-done{opacity:.55}.rr152 .rr-card.rr-done:hover{opacity:1}'
  + '.rr152 .rr-row1{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
  + '.rr152 .rr-row1 .rr-nm{font-weight:900;color:var(--navy);font-size:14px}'
  + '.rr152 .rr-row1 .rr-len{font-size:11.5px;color:var(--mute);font-variant-numeric:tabular-nums}'
  + '.rr152 .rr-badge{font-size:11px;font-weight:900;padding:2px 8px;border-radius:20px;margin-left:auto;white-space:nowrap}'
  + '.rr152 .rr-b-ok{background:var(--ok-bg);color:var(--ok)}.rr152 .rr-b-warn{background:var(--warn-bg);color:var(--warn)}.rr152 .rr-b-bad{background:var(--bad-bg);color:var(--bad)}.rr152 .rr-b-dim{background:var(--dim-bg);color:var(--dim)}'
  + '.rr152 .rr-tp{font-size:11.5px;color:var(--warn);font-weight:700}'
  + '.rr152 .rr-summ{font-size:13px;color:var(--fg)}'
  + '.rr152 .rr-why{font-size:12px;color:var(--mute)}'
  + '.rr152 .rr-why b{color:var(--bad);font-weight:800}'
  + '.rr152 .rr-donel{font-size:12px;color:var(--ok);font-weight:800;display:flex;align-items:center;gap:6px;flex-wrap:wrap}'
  + '.rr152 .rr-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}'
  + '.rr152 .rr-btn{font-size:11.5px;font-weight:800;border:1.5px solid var(--line);background:var(--bg);border-radius:8px;padding:4px 9px;color:var(--navy);cursor:pointer;font-family:inherit}'
  + '.rr152 .rr-btn.rr-p{background:var(--blue);border-color:var(--blue);color:#fff}'
  + '.rr152 .rr-btn.rr-s{padding:2px 8px;font-size:11px}'
  + '.rr152 .rr-msgs{display:flex;gap:5px;flex-wrap:wrap}'
  + '.rr152 .rr-msgs .rr-chip{font-size:11.5px;padding:3px 10px}'
  + '.rr152 .rr-msgs .rr-chip.rr-first{border-color:var(--blue);color:var(--blue)}'
  + '.rr152 .rr-full{font-size:12.5px;color:var(--fg);background:var(--bg);border-radius:8px;padding:8px 10px;line-height:1.7;white-space:pre-wrap}'
  + '.rr152 .rr-aud audio{width:100%;height:34px}'
  + '.rr152 .rr-missing{padding:10px 16px;font-size:12.5px;color:var(--mute);background:var(--bg);margin-top:10px;border-radius:8px}'
  + '.rr152 .rr-missing b{color:var(--bad)}'
  + '.rr152 .rr-empty{padding:36px 16px;text-align:center;color:var(--mute);font-size:13px}'
  + '</style>';

function rr152View(){
  rr152Init();
  if(!RR152.date) RR152.date = rr152BestDate() || rr152Yday();
  return RR152_CSS + '<div id="rr152-root" class="rr152">' + rr152Inner() + '</div>';
}
window.rr152View = rr152View;
function rr152Paint(){
  var el = document.getElementById('rr152-root');
  if(el){ el.innerHTML = rr152Inner(); return; }
  try{ if(VIEW === 'recmgr' && REC_MGR_VIEW === 'review') render(); }catch(e){}
}
window.rr152Paint = rr152Paint;

function rr152Inner(){
  var d = RR152.date || rr152Yday(), today = rr152Today();
  var F = [['all','전체'], ['diff','주제 다름만'], ['unseen','아직 안 본 것']];
  var h = '<div class="rr-app"><div class="rr-appbar"><div class="rr-title">👀 녹음 훑어보기</div>';
  h += '<button class="rr-chip" id="rr152-prev" onclick="rr152Go(-1)" title="하루 앞">◀</button>'
    + '<span class="rr-chip rr-on" id="rr152-date">' + rr152Label(d) + '</span>'
    + '<button class="rr-chip" id="rr152-next" onclick="rr152Go(1)" title="하루 뒤"' + (d >= today ? ' disabled' : '') + '>▶</button>';
  F.forEach(function(f){ h += '<button class="rr-chip rr152-f' + (RR152.filter === f[0] ? ' rr-on' : '') + '" data-f="' + f[0] + '" onclick="rr152Filter(\'' + f[0] + '\')">' + f[1] + '</button>'; });
  var L = RR152.last, nl = '🌙 새벽 읽기 기록 없음';
  if(L){
    var fl = L.fail; fl = Array.isArray(fl) ? fl.length : (fl && typeof fl === 'object') ? Object.keys(fl).length : (+fl || 0);
    nl = '🌙 새벽 읽기 ' + (rr152When(L.at) || '-') + ' · ' + (+L.made || 0) + '건 · 실패 ' + fl;
  }
  h += '<div class="rr-night"><span id="rr152-night">' + nl + '</span><button class="rr-btn rr-s" onclick="rr152Refresh()" title="서버에서 다시 읽기">⟳ 새로고침</button></div>';
  h += '</div>';
  RR152.cards = [];
  var ym = d.slice(0,7);
  if(!RR152.month[ym] && !RR152.read[d]){
    h += '<div class="rr-empty">' + (RR152.loading || RR152.monthP[ym] ? '🔄 불러오는 중…' : (rr152Sb() ? '🔄 불러오는 중…' : '서버에 연결되지 않았어요')) + '</div></div>';
    if(!RR152.monthP[ym] && rr152Sb()) rr152LoadMonthP(ym).then(rr152Paint);
    return h;
  }
  var M = rr152Model(d);
  if(!M){
    h += '<div class="rr-empty">📭 ' + rr152Label(d) + ' 녹음은 아직 새벽 읽기 결과가 없어요.<br><small>매일 새벽 5시 10분에 어제 올라온 녹음을 읽습니다. 그리드에서 직접 들을 수 있어요.</small></div></div>';
    return h;
  }
  var S = M.S;
  h += '<div class="rr-sum" id="rr152-sum">'
    + '<div><div class="rr-n" data-k="n">' + S.n + '</div><div class="rr-l">제출' + (S.free ? ' (자유 ' + S.free + ')' : '') + '</div></div>'
    + '<div><div class="rr-n" data-k="ok" style="color:var(--ok)">' + S.ok + '</div><div class="rr-l">✅ 주제대로</div></div>'
    + '<div><div class="rr-n" data-k="part" style="color:var(--warn)">' + S.part + '</div><div class="rr-l">⚠️ 일부만</div></div>'
    + '<div><div class="rr-n" data-k="bad" style="color:var(--bad)">' + S.bad + '</div><div class="rr-l">❌ 다른 내용 · 짧음</div></div>'
    + '<div><div class="rr-n" data-k="miss" style="color:var(--dim)">' + S.miss + '</div><div class="rr-l">미제출(수업일)</div></div>'
    + '</div>';
  var bg = (M.rd && M.rd.byGrade) || {}, shown = 0;
  M.groups.forEach(function(g){
    var vis = g.cards.filter(function(c){
      if(RR152.filter === 'diff') return ['part','off','short'].indexOf(c.it.match) >= 0;
      if(RR152.filter === 'unseen') return !rr152Done(c, d);
      return true;
    });
    if(RR152.filter !== 'all' && !vis.length) return;
    shown++;
    var gt = g.gk === '기타' ? null : rr152GradeTopic(g.gk, d);
    if(!gt){ for(var i = 0; i < g.cards.length; i++){ var tp = g.cards[i].it.topic; if(tp && tp.src === 'grade' && tp.t){ gt = tp; break; } } }
    h += '<div class="rr-grade" data-gk="' + rr152Esc(g.gk) + '">';
    h += '<div class="rr-ghead"><b>' + rr152Esc(g.gk) + '</b><span class="rr-topic">오늘 주제: ' + (gt ? rr152Esc(gt.t) : '없음(배정 안 됨)') + '</span>'
      + '<span class="rr-cnt">' + g.nSub + '명 제출 / ' + g.nAll + '명 수업</span></div>';
    var br = bg[g.gk] && bg[g.gk].brief;
    if(br) h += '<div class="rr-brief">🧭 이 학년 공통: ' + rr152Esc(br) + '</div>';
    if(vis.length){ h += '<div class="rr-cards">'; vis.forEach(function(c){ h += rr152Card(c, d); }); h += '</div>'; }
    if(RR152.filter === 'all' && g.missing.length){
      h += '<div class="rr-missing">미제출 <b>' + g.missing.length + '명</b>: ' + g.missing.map(function(s){ return rr152Esc(s.name || s.lumen_rec_code); }).join(' · ')
        + ' &nbsp;<small>(수업일인데 녹음 없음)</small></div>';
    }
    h += '</div>';
  });
  if(!shown) h += '<div class="rr-empty">' + (RR152.filter === 'diff' ? '주제와 다른 녹음이 없어요 👍' : RR152.filter === 'unseen' ? '모두 확인했어요 ✓' : '이 날은 녹음이 없어요') + '</div>';
  h += '</div>';
  return h;
}

function rr152Card(c, d){
  var it = c.it, i = RR152.cards.length, chips = rr152Chips(it);
  RR152.cards.push({ code:c.code, date:d, it:it, chips:chips });
  var b = RR152_BADGE[it.match] || RR152_BADGE.free;
  var cls = it.match === 'part' ? ' rr-warn' : (it.match === 'off' || it.match === 'short') ? ' rr-bad' : '';
  var done = rr152Done(c, d), rv = rr152Rev(c.code, d);
  var name = (c.st && c.st.name) || c.code;
  var h = '<div class="rr-card' + cls + (done ? ' rr-done' : '') + '" id="rr152c' + i + '" data-code="' + rr152Esc(c.code) + '" data-match="' + rr152Esc(it.match || '') + '">';
  h += '<div class="rr-row1"><span class="rr-nm">' + rr152Esc(name) + '</span><span class="rr-len">' + rr152Len(it.sec) + '</span><span class="rr-badge rr-' + b[0] + '">' + b[1] + '</span></div>';
  if(it.topic && it.topic.t && (it.topic.src === 'mission' || it.topic.src === 'student')){
    h += '<div class="rr-tp">🎯 ' + (it.topic.src === 'mission' ? '미션' : '개인 주제') + ': ' + rr152Esc(it.topic.t) + '</div>';
  }
  if(it.summary) h += '<div class="rr-summ">' + rr152Esc(it.summary) + '</div>';
  var w = [];
  if(it.why) w.push(rr152Esc(it.why));
  if(it.missing) w.push('빠진 것: <b>' + rr152Esc(it.missing) + '</b>');
  if(it.err) w.push('개념 오류: <b>' + rr152Esc(it.err) + '</b>');
  if(it.match === 'short' && !it.why) w.push('다시 내게 할지 원장님 판단');
  if(w.length) h += '<div class="rr-why">' + w.join(' · ') + '</div>';
  if(done){
    h += '<div class="rr-donel">✓ 확인 ' + rr152Hm(rv.at) + (rv.msg ? ' · 💬 ' + rr152Esc(rv.msg) : '')
      + '<button class="rr-btn rr-s" onclick="rr152Undo(' + i + ')">확인 취소</button></div>';
  } else if(rv && rv.file && rv.file !== it.file){
    h += '<div class="rr-why">같은 날 다른 녹음을 확인했어요(' + rr152Hm(rv.at) + ')</div>';
  }
  h += '<div class="rr-acts"><button class="rr-btn" onclick="rr152Play(' + i + ')">▶ 듣기</button>'
    + (it.stt ? '<button class="rr-btn" onclick="rr152Full(' + i + ')">📄 전문</button>' : '')
    + (done ? '' : '<button class="rr-btn rr-p" onclick="rr152Ok(' + i + ')">✓ 확인</button>')
    + '<button class="rr-btn" onclick="rr152MsgOpen(' + i + ')">💬 한마디</button></div>';
  h += '<div class="rr-msgs" id="rr152m' + i + '" style="display:none">';
  chips.forEach(function(t, j){ h += '<button class="rr-chip' + (j < 2 ? ' rr-first' : '') + '" onclick="rr152Msg(' + i + ',' + j + ')">' + rr152Esc(t) + '</button>'; });
  h += '<button class="rr-chip" onclick="rr152Msg(' + i + ',-1)">✏️ 직접 쓰기</button></div>';
  h += '<div class="rr-aud" id="rr152a' + i + '" style="display:none"></div>';
  if(it.stt) h += '<div class="rr-full" id="rr152f' + i + '" style="display:none">' + (it.title ? '<b>✏️ 제출 제목:</b> ' + rr152Esc(it.title) + '\n' : '') + rr152Esc(it.stt) + '</div>';
  h += '</div>';
  return h;
}

/* ── 단추 ── */
function rr152Go(n){
  var d = rr152Add(RR152.date || rr152Yday(), n);
  if(d > rr152Today()) return;
  RR152.date = d; RR152.userDate = true;
  var ym = d.slice(0,7);
  if(!RR152.month[ym]) rr152LoadMonthP(ym).then(rr152Paint);
  rr152Paint();
}
function rr152Filter(f){ RR152.filter = f; rr152Paint(); }
function rr152Refresh(){
  RR152.read = {}; RR152.month = {}; RR152.monthP = {}; RR152.last = null; RR152.review = {}; RR152.topics = null; RR152.gdays = null;
  if(!RR152.userDate) RR152.date = '';
  rr152Init(true); rr152Paint();
}
function rr152Toggle(id){ var el = document.getElementById(id); if(!el) return null; el.style.display = (el.style.display === 'none') ? '' : 'none'; return el; }
function rr152Play(i){
  var c = RR152.cards[i]; if(!c) return;
  var el = document.getElementById('rr152a' + i); if(!el) return;
  if(!el.firstChild){
    var url = ''; try{ url = getRecordingUrl(c.code, c.it.file); }catch(e){}
    if(!url){ alert('녹음 주소를 만들지 못했어요 (서버 연결 확인)'); return; }
    el.innerHTML = '<audio controls preload="none" src="' + rr152Esc(url) + '"></audio>';
    el.style.display = '';
    try{ var a = el.querySelector('audio'); var p = a.play(); if(p && p.catch) p.catch(function(){}); }catch(e){}
    return;
  }
  rr152Toggle('rr152a' + i);
}
function rr152Full(i){ rr152Toggle('rr152f' + i); }
function rr152MsgOpen(i){ rr152Toggle('rr152m' + i); }
function rr152Ok(i){ var c = RR152.cards[i]; if(!c) return; return rr152Save(c, ''); }
function rr152Msg(i, j){
  var c = RR152.cards[i]; if(!c) return;
  var t;
  if(j < 0){
    var rv = rr152Rev(c.code, c.date);
    t = prompt('💬 한마디 (학부모앱에 «선생님 한마디»로 보입니다)', (rv && rv.msg) || '');
    if(t == null) return;
    t = String(t).trim();
  } else t = c.chips[j] || '';
  return rr152Save(c, t);
}
function rr152Undo(i){ var c = RR152.cards[i]; if(!c) return; return rr152Write(c.code, c.date, null); }
function rr152Save(c, msg){
  var it = c.it, tp = it.topic && typeof it.topic === 'object' ? { t:String(it.topic.t || ''), src:String(it.topic.src || (it.topic.t ? 'grade' : 'free')) } : { t:'', src:'free' };
  return rr152Write(c.code, c.date, { file:it.file, ok:true, at:new Date().toISOString(), msg:String(msg || ''), sec:(it.sec == null ? null : it.sec), topic:tp });
}
window.rr152Go = rr152Go; window.rr152Filter = rr152Filter; window.rr152Refresh = rr152Refresh; window.rr152Play = rr152Play; window.rr152Full = rr152Full;
window.rr152MsgOpen = rr152MsgOpen; window.rr152Ok = rr152Ok; window.rr152Msg = rr152Msg; window.rr152Undo = rr152Undo;

/* 저장 — 화면은 바로 바꾸고, 서버는 «최신본 읽기 → 이 날짜 칸만 바꾸기 → 올리기» (다른 기기에서 확인한 날짜를 지우지 않게) */
function rr152Apply(obj, ymd, entry){
  obj = (obj && typeof obj === 'object') ? JSON.parse(JSON.stringify(obj)) : {};
  if(!obj.byDate || typeof obj.byDate !== 'object') obj.byDate = {};
  if(entry) obj.byDate[ymd] = entry; else delete obj.byDate[ymd];
  obj.updated = new Date().toISOString();
  return obj;
}
function rr152Write(code, ymd, entry){
  var key = 'rec_review_' + code;
  var before = RR152.review[code];
  RR152.review[code] = rr152Apply(before, ymd, entry);
  RR152.saving[code] = (RR152.saving[code] || 0) + 1;
  rr152Paint();
  var sb = rr152Sb();
  var fin = function(){ RR152.saving[code]--; if(RR152.saving[code] <= 0) delete RR152.saving[code]; };
  if(!sb){ fin(); RR152.review[code] = before; rr152Paint(); alert('서버에 연결되지 않아 저장하지 못했어요.'); return Promise.resolve(false); }
  return rr152Rows(sb.from('lumen_store').select('key,value').eq('key', key)).then(function(map){
    var val = rr152Apply(map[key], ymd, entry);
    return sb.from('lumen_store').upsert({ key:key, value:val }, { onConflict:'key' }).then(function(r){
      if(r && r.error) throw r.error;
      fin(); RR152.review[code] = val; rr152Paint(); return true;
    });
  }).then(null, function(e){
    fin(); console.warn('[녹음 훑어보기] 저장 실패', e);
    RR152.review[code] = before; rr152Paint();
    alert('확인 기록을 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.\n' + ((e && e.message) || ''));
    return false;
  });
}
window.rr152Write = rr152Write;
