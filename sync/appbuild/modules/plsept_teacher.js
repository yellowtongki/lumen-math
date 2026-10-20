
/* ══════════════════════════════════════════════════════════════════════════
 * v19-67: 📅 9월 플래너 날짜 검사 → 날짜 없는 세트 그날 0점
 *   원장 지시 2026-09-30 「9월 플래너 날짜 없는 거 전부 영 점 처리」
 *   · 9/27 사고로 9/23 이전 세트의 AI 분석이 사라져 «날짜 없음»을 다시 판정해야 한다.
 *     ① 앱에 남은 분석(analysis.date) → ② 새벽 채점 결과(planner_ai_results) → ③ 없으면 사진을 AI로 «날짜만» 읽는다.
 *   · 날짜 없음 = 두 장 모두 맨 윗줄에 날짜가 없음. 그 세트의 점수(세트 날짜 · 없으면 전날)를 0으로.
 *   · 되돌리기: 카드의 「↩ 점수 되살리기」(plzClear) 가 zeroBak.total 로 원점수를 되돌린다. 검사 결과는 기기에 남아(lumen_pls9_scan) 다시 열어도 AI를 다시 부르지 않는다.
 * ══════════════════════════════════════════════════════════════════════════ */
window.PLS9 = { ym: '2026-09', from: '20260901', to: '20260931', rows: [], running: false, stop: false, night: null, model: 'claude-sonnet-4-6' };
function pls9Day(id){ return /^\d{8}/.test(String(id || '')) ? (String(id).slice(0, 4) + '.' + String(id).slice(4, 6) + '.' + String(id).slice(6, 8)) : ''; }
function pls9Prev(d){ var x = new Date(d.slice(0, 4), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)) - 1); return x.getFullYear() + '.' + String(x.getMonth() + 1).padStart(2, '0') + '.' + String(x.getDate()).padStart(2, '0'); }
function pls9Key(s){ var m = String(s || '').match(/(\d{4})[.\-\/]?(\d{1,2})[.\-\/]?(\d{1,2})/); return m ? (m[1] + '.' + String(m[2]).padStart(2, '0') + '.' + String(m[3]).padStart(2, '0')) : ''; }
function pls9Load(){ try { var v = JSON.parse(localStorage.getItem('lumen_pls9_scan') || 'null'); if (v && v.rows) PLS9.rows = v.rows; } catch(e){} }
function pls9Save(){ try { localStorage.setItem('lumen_pls9_scan', JSON.stringify({ rows: PLS9.rows, at: new Date().toISOString() })); } catch(e){} }
/* 지금 상태 — 세트 기록으로 본다 (되살리면 «0점 처리됨»이 풀린다) */
function pls9Entry(r){ var st = (students || []).find(function(s){ return s && s.lumen_rec_code === r.code; }); return st ? ((st.lumen_planner_photos || []).find(function(x){ return x && x.setId === r.setId; }) || null) : null; }
function pls9Done(r){ var e = pls9Entry(r); return !!(e && e.analysis && e.analysis.zeroSept); }
function pls9Cleared(r){ var e = pls9Entry(r); return !!(e && e.analysis && e.analysis.zeroCleared); }
/* 세트의 점수 열쇠: 세트 날짜에 점수가 있으면 그것, 없으면 전날(밤 12시 넘겨 낸 것) */
function pls9ScoreKey(st, setId){
  var d = pls9Day(setId), p = pls9Prev(d), pl = (st && st.lumen_planner) || {};
  if (pl[d] !== undefined && pl[d] !== null) return d;
  if (pl[p] !== undefined && pl[p] !== null) return p;
  return '';
}
/* 판정: 두 장 다 날짜 없음 → noDate · 있는데 세트 날짜(전날 포함)와 다름 → wrongDate · 그 외 ok */
function pls9Verdict(date, dateNext, setId){
  var d = pls9Key(date), n = pls9Key(dateNext), sd = pls9Day(setId);
  if (!d && !n) return 'noDate';
  var ref = d || n; if (ref === sd || ref === pls9Prev(sd)) return 'ok';
  if (!d && n) return 'ok';   /* 내일 계획 장만 날짜가 있으면 (내일 날짜) 그대로 인정 */
  return ref > sd ? 'future' : 'late';   /* v19-68: 과거 날짜 = 지각 제출(0점 아님) · 미래 = 확인 */
}
/* AI로 날짜만 읽기 — 학원앱 설정의 엔진(Claude/Gemini)·열쇠 그대로 · 1024px 로 줄여 보낸다 */
window.pls9AskDate = async function(imgs){
  var useGemini = (typeof plannerAiProvider !== 'undefined' && plannerAiProvider === 'gemini');
  var prompt = ['학생 플래너 사진입니다. 각 사진 «맨 윗줄의 날짜 칸»만 읽으세요. 채점은 하지 않습니다.',
    '- date: 첫 번째 사진의 날짜, dateNext: 두 번째 사진의 날짜 (사진이 한 장이면 "").',
    '- 형식은 YYYY.MM.DD (연도가 안 적혀 있으면 2026). "9/15", "9월 15일", "9.15" 모두 2026.09.15 로.',
    '- 날짜 칸이 비어 있거나, 잘려서 안 보이거나, 읽을 수 없으면 "" 로 두세요. 절대 추측하지 마세요.',
    '- 요일만 있고 날짜가 없으면 "" 입니다.',
    'JSON 만 답하세요: {"date":"","dateNext":""}'].join('\n');
  var text = '';
  if (useGemini){
    var parts = [{ text: prompt }]; imgs.forEach(function(im){ parts.push({ inline_data: { mime_type: im.mime, data: im.b64 } }); });
    var g = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + geminiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: parts }], generationConfig: { temperature: 0, maxOutputTokens: 200 } }) });
    if (!g.ok) throw new Error('Gemini ' + g.status);
    var gj = await g.json(); text = (((gj.candidates || [])[0] || {}).content || {}).parts ? gj.candidates[0].content.parts.map(function(p){ return p.text || ''; }).join('') : '';
  } else {
    var content = imgs.map(function(im){ return { type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } }; }); content.push({ type: 'text', text: prompt });
    var r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: PLS9.model, max_tokens: 200, temperature: 0, messages: [{ role: 'user', content: content }] }) });
    if (!r.ok) throw new Error('Claude ' + r.status);
    var j = await r.json(); text = ((j.content || [])[0] || {}).text || '';
  }
  var m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('답 형식 이상');
  var o = JSON.parse(m[0]); return { date: String(o.date || ''), dateNext: String(o.dateNext || '') };
};
/* 세트 사진 → base64 (최대 2장) */
async function pls9Images(sb, code, files){
  var out = [];
  for (var i = 0; i < Math.min(2, files.length); i++){
    var u = sb.storage.from('photos').getPublicUrl(code + '/' + files[i].name).data.publicUrl;
    var resp = await fetch(u); var blob = await resp.blob();
    out.push(await resizeImageForAI(blob, 1024, 0.8));
  }
  return out;
}
/* ── 1) 검사 ── */
window.pls9Scan = async function(){
  if (PLS9.running) return; PLS9.running = true; PLS9.stop = false;
  var sb = getSupaClient(); if (!sb){ PLS9.running = false; alert('서버 연결이 없습니다'); return; }
  var useGemini = (typeof plannerAiProvider !== 'undefined' && plannerAiProvider === 'gemini');
  if (useGemini ? !geminiKey : !apiKey){ PLS9.running = false; alert('AI 열쇠가 없습니다 — 설정 탭에서 입력해 주세요'); return; }
  pls9Load();
  var done = {}; PLS9.rows.forEach(function(r){ if (r.verdict !== 'fail') done[r.code + '_' + r.setId] = r; });
  if (!PLS9.night){ try { var nr = await sb.from('lumen_store').select('value').eq('key', 'planner_ai_results').single(); PLS9.night = (nr.data && nr.data.value && nr.data.value.results) || {}; } catch(e){ PLS9.night = {}; } }
  var list = (students || []).filter(function(s){ return s && !s.withdrawn && s.lumen_rec_code; });
  var jobs = [];
  for (var i = 0; i < list.length; i++){
    var st = list[i], code = st.lumen_rec_code, files = [];
    try { var r = await sb.storage.from('photos').list(code, { limit: 2000 }); files = (r.data || []).filter(function(f){ return f.name && f.name.indexOf('planner') >= 0; }); } catch(e){}
    var sets = groupPhotoSets(files, code).filter(function(x){ return x.id >= PLS9.from && x.id <= PLS9.to; });
    var seen = {}; sets.forEach(function(x){ seen[x.id] = true; });
    (st.lumen_planner_photos || []).forEach(function(p){ if (p && p.setId && p.setId >= PLS9.from && p.setId <= PLS9.to && !seen[p.setId]) sets.push({ id: p.setId, files: [] }); });
    sets.forEach(function(x){ jobs.push({ st: st, set: x }); });
  }
  PLS9.total = jobs.length; PLS9.n = 0; PLS9.ai = 0; pls9Paint();
  for (var k = 0; k < jobs.length && !PLS9.stop; k++){
    var jb = jobs[k], st2 = jb.st, code2 = st2.lumen_rec_code, id = jb.set.id, key = code2 + '_' + id;
    PLS9.n = k + 1;
    if (done[key]){ pls9Paint(); continue; }
    var entry = (st2.lumen_planner_photos || []).find(function(p){ return p && p.setId === id; }) || null;
    var a = entry && entry.analysis, src = '', date = '', dateNext = '';
    if (a && pls9Key(a.date)){ src = '앱 분석'; date = a.date; dateNext = a.dateNext || ''; }
    else if (PLS9.night[key] && PLS9.night[key].analysis && pls9Key(PLS9.night[key].analysis.date)){ src = '새벽 채점'; date = PLS9.night[key].analysis.date; dateNext = PLS9.night[key].analysis.dateNext || ''; }
    else if (a && a.zeroCleared){ src = '원장 확인'; date = pls9Day(id); }
    else {
      src = 'AI 날짜 읽기';
      try {
        if (!jb.set.files.length) throw new Error('사진 없음');
        var res = await pls9AskDate(await pls9Images(sb, code2, jb.set.files)); PLS9.ai++;
        date = res.date; dateNext = res.dateNext;
      } catch(e){
        PLS9.rows = PLS9.rows.filter(function(r){ return r.code + '_' + r.setId !== key; });
        PLS9.rows.push({ code: code2, name: st2.name, setId: id, src: src, date: '', dateNext: '', verdict: 'fail', err: String(e.message || e), key: pls9ScoreKey(st2, id) });
        pls9Save(); pls9Paint(); continue;
      }
    }
    var sk = pls9ScoreKey(st2, id);
    var row = { code: code2, name: st2.name, setId: id, src: src, date: date, dateNext: dateNext, verdict: pls9Verdict(date, dateNext, id), key: sk, score: sk ? st2.lumen_planner[sk] : null, done: !!(a && a.zeroSept) };
    PLS9.rows = PLS9.rows.filter(function(r){ return r.code + '_' + r.setId !== key; }); PLS9.rows.push(row);
    if (k % 5 === 0) pls9Save(); pls9Paint();
  }
  pls9Save(); PLS9.running = false; pls9Paint();
};
/* v19-68: 같은 날짜를 «다른 날» 또 낸 학생 — 거짓 제출 후보. [{code,name,date,sets:[setId…]}] */
window.pls9SameDate = function(){
  var g = {};
  PLS9.rows.forEach(function(r){ var d = pls9Key(r.date); if (!d || r.verdict === 'noDate' || r.verdict === 'fail') return; var k = r.code + '|' + d; (g[k] = g[k] || { code: r.code, name: r.name, date: d, sets: [], days: {} }); g[k].sets.push(r.setId); g[k].days[pls9Day(r.setId)] = 1; });
  return Object.keys(g).map(function(k){ return g[k]; }).filter(function(x){ return Object.keys(x.days).length >= 2; }).sort(function(a, b){ return a.name < b.name ? -1 : (a.name > b.name ? 1 : (a.date < b.date ? -1 : 1)); });
};
/* ── 2) 0점 처리 (날짜 없음 · 아직 안 한 것) ── */
window.pls9Apply = async function(){
  var targets = PLS9.rows.filter(function(r){ return r.verdict === 'noDate' && !pls9Done(r) && !pls9Cleared(r); });
  if (!targets.length){ alert('0점 처리할 세트가 없습니다'); return; }
  var withScore = targets.filter(function(r){ return r.key && Number(r.score) > 0; }).length;
  if (!confirm('날짜 없는 9월 세트 ' + targets.length + '건을 0점 처리합니다 (점수가 있던 것 ' + withScore + '건).\n\n각 세트 카드의 「↩ 점수 되살리기」로 되돌릴 수 있습니다. 진행할까요?')) return;
  var touched = {}, n = 0;
  targets.forEach(function(r){
    var st = (students || []).find(function(s){ return s && s.lumen_rec_code === r.code; }); if (!st) return;
    if (!st.lumen_planner_photos) st.lumen_planner_photos = [];
    var p = st.lumen_planner_photos.find(function(x){ return x && x.setId === r.setId; });
    if (!p){ p = { setId: r.setId, urls: [], reviewed: true, analyzing: false }; st.lumen_planner_photos.push(p); }
    var a = p.analysis = p.analysis || { studyScore: '0', practiceScore: '0', specificScore: '0', feedbackScore: '0', tasksTranscript: [], feedbackTranscript: '' };
    var key = r.key || pls9Day(r.setId), prev = (st.lumen_planner || {})[key];
    a.zeroBak = a.zeroBak || { s: a.studyScore, p: a.practiceScore, sp: a.specificScore, f: a.feedbackScore, total: (prev === undefined ? null : prev), key: key };
    a.studyScore = '0'; a.practiceScore = '0'; a.specificScore = '0'; a.feedbackScore = '0';
    a.zeroReason = 'noDate'; a.zeroDay = true; a.zeroWarn = false; a.zeroCleared = false; a.zeroSept = true;
    if (!pls9Key(a.date)){ a.date = key; a.dateGuess = true; }
    p.reviewed = true;
    if (typeof plSetScore === 'function') plSetScore(st, key, 0, '9월 날짜 없음'); else { st.lumen_planner = st.lumen_planner || {}; st.lumen_planner[key] = 0; }
    r.done = true; r.score = 0; r.key = key; touched[r.code] = st; n++;
  });
  pls9Save();
  try { saveStudents(); } catch(e){}
  try { if (typeof scheduleSync === 'function') scheduleSync('or_studentdb'); } catch(e){}
  var codes = Object.keys(touched); PLS9.pub = 0; PLS9.pubTotal = codes.length; pls9Paint();
  for (var i = 0; i < codes.length; i++){ try { await publishPlannerDataForStudent(touched[codes[i]]); } catch(e){ console.warn('[9월 0점] 발행 실패', codes[i], e); } PLS9.pub = i + 1; pls9Paint(); }
  try { if (typeof lgPlannerPublish === 'function') await lgPlannerPublish(); } catch(e){}
  try { if (typeof render === 'function') render(); } catch(e){}
  try { plToast('📅 9월 날짜 없는 세트 ' + n + '건 0점 처리 · 학생 ' + codes.length + '명 점수표 다시 올림'); } catch(e){}
  pls9Paint();
};
/* ── 화면 ── */
window.pls9Open = function(){
  pls9Load();
  var el = document.getElementById('pls9-modal');
  if (!el){ el = document.createElement('div'); el.id = 'pls9-modal'; el.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px'; el.addEventListener('click', function(ev){ if (ev.target === el) pls9Close(); }); document.body.appendChild(el); }
  el.style.display = 'flex'; pls9Paint();
};
window.pls9Close = function(){ var el = document.getElementById('pls9-modal'); if (el) el.style.display = 'none'; };
window.pls9Paint = function(){
  var el = document.getElementById('pls9-modal'); if (!el || el.style.display === 'none') return;
  var rows = PLS9.rows.slice().sort(function(a, b){ return a.setId < b.setId ? -1 : (a.setId > b.setId ? 1 : 0); });
  var c = { noDate: 0, late: 0, future: 0, ok: 0, fail: 0, done: 0 }; rows.forEach(function(r){ c[r.verdict] = (c[r.verdict] || 0) + 1; if (pls9Done(r)) c.done++; });
  var pending = rows.filter(function(r){ return r.verdict === 'noDate' && !pls9Done(r) && !pls9Cleared(r); }).length;
  var h = '<div style="background:#fff;border-radius:16px;max-width:900px;width:100%;max-height:92vh;display:flex;flex-direction:column;font-family:inherit">';
  h += '<div style="padding:16px 18px 10px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px"><div style="font-size:16px;font-weight:900;color:#0f172a">📅 9월 플래너 날짜 검사 → 날짜 없는 세트 0점</div><div style="flex:1"></div><button onclick="pls9Close()" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer">닫기</button></div>';
  h += '<div style="padding:12px 18px;font-size:12.5px;color:#475569;line-height:1.7">앱에 남은 분석과 새벽 채점 결과에서 날짜를 먼저 찾고, 없는 세트만 사진을 AI로 <b>날짜만</b> 읽습니다(채점 아님 · 세트당 사진 2장). <b>두 장 모두 날짜가 없으면 «날짜 없음»</b>이고, 0점 처리하면 그 세트 점수(세트 날짜, 없으면 전날)가 0이 되고 학생앱 점수표·9월 랭킹이 다시 올라갑니다. 되돌리기는 각 세트 카드의 「↩ 점수 되살리기」.</div>';
  h += '<div style="padding:0 18px 12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
  h += '<button onclick="pls9Scan()" ' + (PLS9.running ? 'disabled' : '') + ' style="padding:10px 14px;background:linear-gradient(135deg,#7c3aed,#8b5cf6);color:#fff;border:none;border-radius:10px;font-weight:800;cursor:pointer">' + (PLS9.running ? '🔄 검사 중…' : (rows.length ? '🔍 검사 이어서 하기' : '🔍 1) 날짜 검사 시작')) + '</button>';
  if (PLS9.running) h += '<button onclick="PLS9.stop=true" style="padding:10px 14px;background:#f1f5f9;border:none;border-radius:10px;font-weight:800;cursor:pointer">⏹ 멈춤</button>';
  h += '<button onclick="pls9Apply()" ' + (PLS9.running || !pending ? 'disabled' : '') + ' style="padding:10px 14px;background:' + (pending ? 'linear-gradient(135deg,#dc2626,#ef4444)' : '#cbd5e1') + ';color:#fff;border:none;border-radius:10px;font-weight:800;cursor:pointer">⛔ 2) 날짜 없는 ' + pending + '건 0점 처리</button>';
  if (PLS9.total) h += '<span style="font-size:12px;color:#64748b;font-weight:700">진행 ' + (PLS9.n || 0) + '/' + PLS9.total + ' · AI 읽기 ' + (PLS9.ai || 0) + '건</span>';
  if (PLS9.pubTotal) h += '<span style="font-size:12px;color:#64748b;font-weight:700">점수표 올림 ' + PLS9.pub + '/' + PLS9.pubTotal + '</span>';
  h += '</div>';
  h += '<div style="padding:0 18px 10px;display:flex;gap:6px;flex-wrap:wrap;font-size:12px;font-weight:800">' +
    '<span style="background:#fee2e2;color:#b91c1c;border-radius:8px;padding:3px 9px">날짜 없음 ' + c.noDate + '</span>' +
    '<span style="background:#dbeafe;color:#1e40af;border-radius:8px;padding:3px 9px">지각 제출 ' + c.late + '</span>' +
    '<span style="background:#ffedd5;color:#c2410c;border-radius:8px;padding:3px 9px">미래 날짜 ' + c.future + '</span>' +
    '<span style="background:#dcfce7;color:#15803d;border-radius:8px;padding:3px 9px">정상 ' + c.ok + '</span>' +
    '<span style="background:#f1f5f9;color:#475569;border-radius:8px;padding:3px 9px">실패 ' + c.fail + '</span>' +
    '<span style="background:#e0e7ff;color:#3730a3;border-radius:8px;padding:3px 9px">0점 처리됨 ' + c.done + '</span></div>';
  h += '<div style="overflow:auto;padding:0 18px 16px;font-size:12px">';
  /* v19-68: 같은 날짜를 다른 날 또 낸 학생 */
  var same = pls9SameDate();
  h += '<div style="margin:0 18px 10px;padding:10px 12px;background:#fff1f2;border:1.5px solid #fecdd3;border-radius:10px">';
  h += '<div style="font-size:13px;font-weight:900;color:#be123c">📛 같은 날짜를 다른 날 또 낸 학생 ' + same.length + '건' + (same.length ? '' : ' — 없음') + '</div>';
  if (same.length){ h += '<div style="font-size:11px;color:#9f1239;font-weight:700;margin:3px 0 6px">같은 날짜 플래너를 날을 바꿔 다시 낸 것 — 거짓 제출일 수 있어 원장님이 확인합니다 (같은 날에 다시 올린 것은 제외 · 여기선 0점 처리하지 않음)</div>';
    same.forEach(function(x){ h += '<div style="font-size:12px;padding:3px 0;border-top:1px solid #fecdd3"><b>' + (x.name || x.code) + '</b> · 플래너 날짜 <b>' + x.date.slice(5) + '</b> → 제출 ' + x.sets.map(function(id){ return pls9Day(id).slice(5) + ' ' + String(id).slice(9, 11) + ':' + String(id).slice(11, 13); }).join(' · ') + ' (' + x.sets.length + '번)</div>'; }); }
  h += '</div>';
  var show = rows.filter(function(r){ return r.verdict !== 'ok'; });
  if (!show.length) h += '<div style="color:#94a3b8;padding:12px;text-align:center">' + (rows.length ? '날짜 없는 세트가 없습니다' : '아직 검사하지 않았습니다') + '</div>';
  else {
    h += '<table style="width:100%;border-collapse:collapse"><tr style="color:#64748b;font-weight:800"><td style="padding:4px 6px">세트</td><td>학생</td><td>판정</td><td>읽은 날짜</td><td>어디서</td><td>점수</td></tr>';
    show.forEach(function(r){
      var vk = r.verdict === 'noDate' ? '<b style="color:#b91c1c">날짜 없음</b>' : (r.verdict === 'late' ? '<b style="color:#1e40af">⏰ 지각 제출</b>' : (r.verdict === 'future' ? '<b style="color:#c2410c">미래 날짜</b>' : '<span style="color:#94a3b8">실패 ' + (r.err || '') + '</span>'));
      h += '<tr style="border-top:1px solid #f1f5f9"><td style="padding:4px 6px;font-weight:700">' + pls9Day(r.setId).slice(5) + ' ' + String(r.setId).slice(9, 11) + ':' + String(r.setId).slice(11, 13) + '</td><td>' + (r.name || r.code) + '</td><td>' + vk + '</td><td>' + (r.date || '—') + (r.dateNext ? ' / ' + r.dateNext : '') + '</td><td style="color:#64748b">' + r.src + '</td><td>' + (r.key ? r.key.slice(5) + ' = <b>' + r.score + '</b>' : '<span style="color:#94a3b8">점수 없음</span>') + (pls9Done(r) ? ' <span style="color:#3730a3;font-weight:800">0점 처리됨</span>' : (pls9Cleared(r) ? ' <span style="color:#15803d;font-weight:800">되살림</span>' : '')) + '</td></tr>';
    });
    h += '</table>';
  }
  h += '</div></div>';
  el.innerHTML = h;
};
