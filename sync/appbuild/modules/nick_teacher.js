
/* ══════════════════════════════════════════════════════════════════════════
 * v19-72: 🏷 별명 — 학생앱에 이름 모자이크(옥○○) 대신 별명 (원장 결정 2026-10-01 · 학부모 요청 「성이 특정됨」)
 *   · 저장: 학생 기록 st.nick + 서버 nick_<코드> { nick, at, by }. 학생이 학생앱에서 정하면 nick_<코드>가 먼저고, 학원앱이 st.nick 에 비춘다.
 *   · 발행(학생앱으로 나가는 이름)은 전부 별명. 별명이 없으면 「○○○」. 학원앱 화면은 「별명 (이름)」.
 *   · 규칙: 2~8자 · 한글/영문/숫자 · 실명(성 뺀 이름 포함) 금지 · 금지어 · 재원생 안 중복 금지.
 * ══════════════════════════════════════════════════════════════════════════ */
var NICK_FALLBACK = '○○○';
/* 🏷 별명 낱말 기본값 (학원앱 lumen_store 'nick_words' 로 바꿀 수 있다) — 두 앱이 같은 목록을 쓴다 */
var NICK_WORDS_DEF = {
  adj: ['번개','조용한','날쌘','반짝','씩씩한','똑똑한','느긋한','용감한','재빠른','신나는','커다란','작은','황금','은빛','푸른','붉은','초록','보라','하얀','검은','달리는','웃는','꿈꾸는','튼튼한','포근한','비밀','우주','바람','구름','별빛','새벽','한낮','겨울','여름','수수께끼','무적'],
  noun: ['소수','삼각형','원주율','파이','제곱','루트','분수','약수','배수','인수','함수','무한','영점','직각','정수','벡터','미지수','상수','공식','좌표','도형','극한','행렬','집합','확률','등식','변수','여우','사자','고래','펭귄','수달','토끼','호랑이','독수리','돌고래','치타','올빼미','판다','늑대','다람쥐','거북이','코알라','햄스터','고슴도치']
};

var NICK_BAD = ['시발', '씨발', '병신', '좆', '새끼', '개새', '니미', '지랄', '꺼져', '죽어', '섹스', '야동'];
function nickRaw(code){ try { var v = localStorage.getItem('nick_' + code); if (v){ var o = JSON.parse(v); if (o && o.nick) return String(o.nick).trim(); } } catch(e){} return ''; }
window.nickOf = function(st){ if (!st) return ''; var c = st.lumen_rec_code; return ((c ? nickRaw(c) : '') || String(st.nick || '')).trim(); };
window.nickByCode = function(code){ if (!code) return ''; var st = (students || []).find(function(s){ return s && s.lumen_rec_code === code; }); return st ? nickOf(st) : nickRaw(code); };
window.nickById = function(id){ var st = (students || []).find(function(s){ return s && s.id === id; }); return st ? nickOf(st) : ''; };
window.nickByName = function(name){
  var n = String(name || '').trim(); if (!n) return '';
  var list = (students || []).filter(function(s){ return s && String(s.name || '').trim() === n; });
  var st = list.filter(function(s){ return !s.withdrawn && nickOf(s); })[0] || list.filter(function(s){ return nickOf(s); })[0];
  return st ? nickOf(st) : '';
};
window.nickPub = function(code){ return nickByCode(code) || NICK_FALLBACK; };
window.nickPubByName = function(name){ return nickByName(name) || NICK_FALLBACK; };
/* 학원앱 화면용 — 별명 (이름) */
window.iblShow = function(name, mode){
  if (mode === 'full' || mode === 'hide') return iblMask(name, mode);
  var k = nickByName(name); return (k || NICK_FALLBACK) + ' (' + String(name || '') + ')';
};
/* 검사 — 통과하면 '' · 아니면 까닭 */
window.nickCheck = function(nick, st){
  var n = String(nick || '').trim();
  if (n.replace(/ /g, '').length < 2 || n.replace(/ /g, '').length > 8) return '2~8자로 지어 주세요';
  if (!/^[가-힣A-Za-z0-9]+( [가-힣A-Za-z0-9]+)?$/.test(n)) return '한글·영문·숫자만, 띄어쓰기는 가운데 한 번만 (기호 ×)';
  var nm = String((st && st.name) || '').trim();
  if (nm){ var low = n.toLowerCase(); if (low.indexOf(nm.toLowerCase()) >= 0) return '실명은 쓸 수 없어요'; if (nm.length >= 3 && low.indexOf(nm.slice(1).toLowerCase()) >= 0) return '이름(' + nm.slice(1) + ')이 들어가면 안 돼요'; }
  for (var i = 0; i < NICK_BAD.length; i++) if (n.indexOf(NICK_BAD[i]) >= 0) return '쓸 수 없는 말이 들어 있어요';
  var dup = (students || []).find(function(s){ return s && !s.withdrawn && (!st || s.id !== st.id) && nickOf(s).toLowerCase() === n.toLowerCase(); });
  if (dup) return '다른 학생이 이미 쓰는 별명이에요';
  return '';
};
/* 서버·기기에 올리기 (학원앱에서 고쳤을 때) */
window.nickPush = async function(code, nick){
  var val = { nick: String(nick || '').trim(), at: new Date().toISOString(), by: 'teacher' };
  try { localStorage.setItem('nick_' + code, JSON.stringify(val)); } catch(e){}
  try { var sb = getSupaClient(); if (sb) await sb.from('lumen_store').upsert({ key: 'nick_' + code, value: val, updated_at: val.at }, { onConflict: 'key' }); } catch(e){ console.warn('[별명] 서버 저장 실패', e); }
};
/* 학생이 학생앱에서 정한 별명(nick_<코드>)을 등록부 st.nick 에 비춘다 — 새벽 엔진(race_engine)이 등록부만 읽기 때문 */
window.nickSyncAll = function(){
  var changed = 0;
  (students || []).forEach(function(s){ if (!s || !s.lumen_rec_code) return; var r = nickRaw(s.lumen_rec_code); if (r && r !== String(s.nick || '')){ s.nick = r; changed++; } });
  if (changed){ try { saveStudents(); } catch(e){} try { if (typeof scheduleSync === 'function') scheduleSync('or_studentdb'); } catch(e){} }
  return changed;
};
window.nickMissing = function(){ return (typeof activeStudents === 'function' ? activeStudents() : (students || []).filter(function(s){ return s && !s.withdrawn; })).filter(function(s){ return !nickOf(s); }); };
/* 리그 설정 옆 안내 줄 */
window.nickMissingHtml = function(){
  var m = nickMissing();
  if (!m.length) return '<span style="font-size:11px;color:#15803d;font-weight:800">🏷 재원생 모두 별명 있음</span>';
  return '<span style="font-size:11px;color:#b45309;font-weight:800">🏷 별명 없음 ' + m.length + '명 — 학생앱 순위표엔 「' + NICK_FALLBACK + '」로 나갑니다: ' + m.slice(0, 12).map(function(s){ return esc2(s.name || ''); }).join(' · ') + (m.length > 12 ? ' 외' : '') + ' (학생관리 › 편집 › 🏷 별명, 또는 학생이 학생앱 「나」 탭에서)</span>';
};
setTimeout(function(){ try { nickSyncAll(); } catch(e){} }, 8000);

/* ── v19-73: 🎲 낱말 조합 뽑기 (④ 고르기 방식 · 원장 결정 2026-10-01) ── */
window.nickWords = function(){ try { var v = JSON.parse(localStorage.getItem('nick_words') || 'null'); if (v && Array.isArray(v.adj) && v.adj.length && Array.isArray(v.noun) && v.noun.length) return v; } catch(e){} return NICK_WORDS_DEF; };
window.nickUsedSet = function(){ var u = {}; (students || []).forEach(function(s){ var k = nickOf(s); if (k) u[k.replace(/ /g, '').toLowerCase()] = 1; }); return u; };
window.nickPick = function(n, st){
  var w = nickWords(), used = nickUsedSet(), out = [], seen = {}, tries = 0, mine = st ? nickOf(st).replace(/ /g, '').toLowerCase() : '';
  while (out.length < (n || 3) && tries++ < 200){
    var a = w.adj[Math.floor(Math.random() * w.adj.length)], b = w.noun[Math.floor(Math.random() * w.noun.length)], k = a + ' ' + b, key = (a + b).toLowerCase();
    if (seen[key] || (used[key] && key !== mine) || (a + b).length > 8) continue;
    if (nickCheck(k, st)) continue;
    seen[key] = 1; out.push(k);
  }
  return out;
};
window.nickRoll = function(){ var el = document.getElementById('edit-nick'); if (!el) return; var id = (document.getElementById('edit-student-id') || {}).value; var st = (students || []).find(function(s){ return s && s.id === id; }) || null; var p = nickPick(1, st); if (p.length) el.value = p[0]; };
/* 낱말 목록 편집 (리그 설정) — lumen_store nick_words */
window.nickWordsHtml = function(){
  var w = nickWords(), cnt = w.adj.length * w.noun.length;
  return '<div style="margin-top:8px;padding:10px 12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">'
    + '<div style="font-size:12px;font-weight:900;color:#0d2240;margin-bottom:6px">🎲 별명 낱말 <span style="font-weight:700;color:#94a3b8">— 학생은 「꾸밈말 + 낱말」 조합에서 고르기만 합니다 (조합 ' + cnt + '가지 · 한 달에 한 번 바꿀 수 있음)</span></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div style="font-size:11px;font-weight:800;color:#64748b">꾸밈말 ' + w.adj.length + '개 (쉼표로)</div><textarea id="nkw-adj" rows="3" style="width:100%;box-sizing:border-box;font-size:12px;font-family:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:6px">' + esc2(w.adj.join(', ')) + '</textarea></div>'
    + '<div><div style="font-size:11px;font-weight:800;color:#64748b">낱말(수학·동물) ' + w.noun.length + '개</div><textarea id="nkw-noun" rows="3" style="width:100%;box-sizing:border-box;font-size:12px;font-family:inherit;border:1px solid #cbd5e1;border-radius:8px;padding:6px">' + esc2(w.noun.join(', ')) + '</textarea></div></div>'
    + '<div style="display:flex;gap:8px;align-items:center;margin-top:6px"><button onclick="nickWordsSave()" style="padding:6px 12px;background:#0d2240;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">💾 낱말 저장 → 학생앱</button><button onclick="nickWordsReset()" style="padding:6px 12px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">기본값으로</button><span style="font-size:11px;color:#94a3b8;font-weight:700">보기: ' + esc2(nickPick(3, null).join(' · ')) + '</span></div></div>';
};
function nickWordsParse(id){ var el = document.getElementById(id); return el ? String(el.value || '').split(/[,\n]/).map(function(x){ return x.trim(); }).filter(function(x){ return x && /^[가-힣A-Za-z0-9]{1,6}$/.test(x); }) : []; }
window.nickWordsSave = async function(){
  var v = { adj: nickWordsParse('nkw-adj'), noun: nickWordsParse('nkw-noun'), at: new Date().toISOString() };
  if (v.adj.length < 5 || v.noun.length < 5){ plToast('꾸밈말·낱말을 5개 이상 적어 주세요'); return; }
  try { localStorage.setItem('nick_words', JSON.stringify(v)); var sb = getSupaClient(); if (sb) await sb.from('lumen_store').upsert({ key: 'nick_words', value: v, updated_at: v.at }, { onConflict: 'key' }); plToast('낱말 ' + v.adj.length + '+' + v.noun.length + '개 저장 — 학생앱에 바로 반영'); } catch(e){ plToast('저장 실패: ' + (e.message || e)); }
  render();
};
window.nickWordsReset = async function(){ try { localStorage.removeItem('nick_words'); var sb = getSupaClient(); if (sb) await sb.from('lumen_store').upsert({ key: 'nick_words', value: null, updated_at: new Date().toISOString() }, { onConflict: 'key' }); } catch(e){} render(); };
