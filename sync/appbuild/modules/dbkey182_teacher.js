/* ═══════════════════════════════════════════════════════════════════
 * v19-182: 🔑 서버 열쇠 칸 · 비밀 값은 이 기기에만 (원장 2026-11-08 「서버 접근 규칙 정비」 1단계)
 *  [1] 비밀 값 목록을 한 곳에 — 서버로 «올리기»(scheduleSync·supaSetItem)와 «받기»(PULL_SKIP_KEYS·safePullSetItem) 모두에서 뺀다.
 *      이름: lumen_db_key · or_api_key · or_gemini_key · or_nb_key · or_mf_id · or_mf_pw · or_gh_token
 *      규칙: 이름 끝이 _key · token · _pw · _pass · password · secret (화면 폭 값 ma_pw 는 예외)
 *      (예전 v19-124 · v19-126 · v18-168 의 따로 막기는 그대로 두고 이 목록이 한 번 더 막는다)
 *  [2] 설정 「🔑 서버 열쇠」: 이 기기 열쇠 상태(지문 6글자) · 새 열쇠 만들기(기기에서 무작위 43자 · 한 번만 보여 줌 · 복사)
 *      · 다른 기기에서 만든 열쇠 붙여넣기 · 서버 등록 한 줄 복사(열쇠가 아니라 sha256 해시만) · 열쇠 시험(시험 줄 넣고 지워 보기)
 *  [3] 주소 뒤 #dbkey= 로 열쇠 넣던 길은 없앤다(build_app.py rep) — 열쇠는 붙여넣기 칸으로만.
 *  ※ 열쇠 값은 화면에 «만들 때 한 번»만 보이고, 콘솔·서버·주소 어디에도 쓰지 않는다.
 *  ※ 문자열 연결로만 HTML.
 * ═══════════════════════════════════════════════════════════════════ */
var LUMEN_SECRET_KEYS = { lumen_db_key:1, or_api_key:1, or_gemini_key:1, or_nb_key:1, or_mf_id:1, or_mf_pw:1, or_gh_token:1 };
var LUMEN_SECRET_EXEMPT = { ma_pw:1 };
function lumenIsSecretKey(k){
  k = String(k || ''); if (!k) return false;
  if (LUMEN_SECRET_KEYS[k]) return true;
  if (LUMEN_SECRET_EXEMPT[k]) return false;
  return /(_key|token|_pw|_pass|password|secret)$/i.test(k);
}
window.lumenIsSecretKey = lumenIsSecretKey;
/* 올리기 막기 */
if (typeof scheduleSync === 'function') scheduleSync = (function(o){ return function(key){ if (key && lumenIsSecretKey(key)) return; return o.apply(this, arguments); }; })(scheduleSync);
if (typeof supaSetItem === 'function') supaSetItem = (function(o){ return async function(key){ if (lumenIsSecretKey(key)) return true; return o.apply(this, arguments); }; })(supaSetItem);
/* 받기 막기 — 서버에 남은 옛 줄이 이 기기 값을 덮지 않게 */
try { if (typeof PULL_SKIP_KEYS !== 'undefined' && Array.isArray(PULL_SKIP_KEYS)) {
  Object.keys(LUMEN_SECRET_KEYS).concat(['mf_token', '_dbk_test']).forEach(function(k){ if (PULL_SKIP_KEYS.indexOf(k) < 0) PULL_SKIP_KEYS.push(k); });
} } catch(e){}
if (typeof safePullSetItem === 'function') safePullSetItem = (function(o){ return function(key){ if (lumenIsSecretKey(key)) return true; return o.apply(this, arguments); }; })(safePullSetItem);

/* ── 🔑 서버 열쇠 칸 ── */
var DBK = { fp: null, fpFor: null, msg: '', busy: false };
function dbkQ(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dbkCur(){ try { return localStorage.getItem('lumen_db_key') || ''; } catch(e){ return ''; } }
async function dbkSha(s){
  var b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
}
function dbkB64u(bytes){ var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function dbkValid(k){ return /^[A-Za-z0-9_\-]{32,128}$/.test(String(k || '')); }
/* 열쇠를 바꾸면 서버 연결을 새로 만든다(머리글에 새 열쇠) */
function dbkResetClient(){ try { _supaClient = null; } catch(e){} }
function dbkFill(){
  var k = dbkCur(); var el = document.getElementById('dbk-fp'); if (!el) return;
  if (!k) { el.textContent = '없음'; return; }
  if (DBK.fpFor === k && DBK.fp) { el.textContent = DBK.fp; return; }
  dbkSha(k).then(function(h){ DBK.fp = h.slice(0, 6); DBK.fpFor = k; var e2 = document.getElementById('dbk-fp'); if (e2) e2.textContent = DBK.fp; }, function(){});
}
function dbkBoxHtml(){
  var k = dbkCur(); var ok = !!k; var strong = dbkValid(k) && k.length >= 40;
  setTimeout(dbkFill, 30);
  var h = '<div style="margin-bottom:18px" id="dbk-box"><div class="st" style="color:#0d2240">🔑 서버 열쇠 <span style="font-size:10px;font-weight:600;color:#94a3b8">(원장님 기기에만 · 서버로 안 올라감)</span></div>';
  h += '<div style="background:#f8fafc;border-radius:12px;padding:14px;border:1.5px solid #cbd5e1">';
  h += '<div style="font-size:12.5px;color:#0d2240;margin-bottom:8px">이 기기 열쇠: <b>' + (ok ? '저장됨' : '없음') + '</b>'
     + (ok ? ' · 지문 <code id="dbk-fp" style="background:#e2e8f0;padding:1px 6px;border-radius:6px">…</code>' + (strong ? '' : ' <span style="color:#b45309">(옛 짧은 열쇠)</span>') : '<span id="dbk-fp" style="display:none"></span>')
     + '</div>';
  h += '<div style="font-size:11.5px;color:#64748b;line-height:1.6;margin-bottom:10px">지문 6글자는 열쇠의 «겉모양»입니다. PC·아이패드 지문이 같으면 같은 열쇠예요. 열쇠 자체는 다시 보여 주지 않습니다.</div>';
  h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
  h += '<button type="button" id="dbk-new" onclick="dbkNew()" style="flex:1;min-width:130px;padding:9px;border-radius:10px;border:1.5px solid #0d2240;background:#0d2240;color:#fff;font-weight:800;font-size:12.5px;cursor:pointer;font-family:inherit">✨ 새 열쇠 만들기</button>';
  h += '<button type="button" id="dbk-sql" onclick="dbkCopySql()"' + (ok ? '' : ' disabled') + ' style="flex:1;min-width:130px;padding:9px;border-radius:10px;border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit">📋 서버 등록 한 줄 복사</button>';
  h += '<button type="button" id="dbk-test" onclick="dbkTest()"' + (ok ? '' : ' disabled') + ' style="flex:1;min-width:110px;padding:9px;border-radius:10px;border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit">🧪 열쇠 시험</button>';
  h += '</div>';
  h += '<div style="display:flex;gap:6px;margin-top:8px"><input id="dbk-paste" type="password" autocomplete="off" placeholder="다른 기기에서 만든 열쇠 붙여넣기" style="flex:1;min-width:0;border:1.5px solid #cbd5e1;border-radius:8px;padding:8px 9px;font-family:inherit;font-size:12.5px">'
     + '<button type="button" id="dbk-paste-save" onclick="dbkPaste()" style="padding:8px 12px;border-radius:8px;border:1.5px solid #cbd5e1;background:#fff;font-weight:700;font-size:12.5px;cursor:pointer;font-family:inherit">저장</button></div>';
  h += '<div id="dbk-msg" style="min-height:16px;font-size:12px;margin-top:8px;color:#0d2240">' + dbkQ(DBK.msg) + '</div>';
  h += '</div></div>';
  return h;
}
window.dbkBoxHtml = dbkBoxHtml;
function dbkSay(m){ DBK.msg = m; var el = document.getElementById('dbk-msg'); if (el) el.textContent = m; }
async function dbkCopy(text){
  try { await navigator.clipboard.writeText(text); return true; } catch(e){}
  try { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = document.execCommand('copy'); ta.remove(); return ok; } catch(e){ return false; }
}
/* 새 열쇠 — 기기에서 무작위 32바이트(43글자). 한 번만 보여 준다 */
window.dbkNew = function(){
  var had = !!dbkCur();
  if (had && !confirm('새 열쇠를 만들면 이 기기의 옛 열쇠는 지워집니다.\n서버에 새 열쇠를 등록하기 전까지 이 기기에서 «지우기»가 안 될 수 있어요.\n\n지금 만들까요?')) return;
  var b = new Uint8Array(32); crypto.getRandomValues(b); var k = dbkB64u(b);
  try { localStorage.setItem('lumen_db_key', k); } catch(e){ dbkSay('⚠ 이 기기에 저장하지 못했습니다'); return; }
  dbkResetClient(); DBK.fp = null; DBK.fpFor = null;
  dbkShowOnce(k);
};
function dbkShowOnce(k){
  var old = document.getElementById('dbk-once'); if (old) old.remove();
  var d = document.createElement('div'); d.id = 'dbk-once';
  d.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px';
  d.innerHTML = '<div style="background:#fff;border-radius:16px;max-width:460px;width:100%;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:inherit">'
    + '<div style="font-size:16px;font-weight:900;color:#0d2240;margin-bottom:6px">🔑 새 열쇠 — 지금 한 번만 보여 드립니다</div>'
    + '<div style="font-size:12.5px;color:#475569;line-height:1.6;margin-bottom:10px">① 「열쇠 복사」를 눌러 아이패드 등 다른 기기의 「붙여넣기」 칸에 넣으세요.<br>② 「서버 등록 한 줄 복사」를 눌러 Supabase SQL Editor 에서 실행하세요.<br>카톡·문자·메모 앱에는 남기지 마세요. 잃어버리면 새로 만들면 됩니다.</div>'
    + '<input id="dbk-once-k" readonly value="' + dbkQ(k) + '" style="width:100%;box-sizing:border-box;font-family:ui-monospace,monospace;font-size:12.5px;padding:9px;border:1.5px solid #cbd5e1;border-radius:8px;margin-bottom:10px" onclick="this.select()">'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + '<button type="button" id="dbk-once-copy" style="flex:1;min-width:120px;padding:10px;border-radius:10px;border:none;background:#0d2240;color:#fff;font-weight:800;cursor:pointer;font-family:inherit">📋 열쇠 복사</button>'
    + '<button type="button" id="dbk-once-sql" style="flex:1;min-width:120px;padding:10px;border-radius:10px;border:1.5px solid #cbd5e1;background:#fff;color:#0d2240;font-weight:800;cursor:pointer;font-family:inherit">📋 서버 등록 한 줄</button>'
    + '<button type="button" id="dbk-once-close" style="flex:1;min-width:80px;padding:10px;border-radius:10px;border:1.5px solid #fecaca;background:#fef2f2;color:#b91c1c;font-weight:800;cursor:pointer;font-family:inherit">닫기</button>'
    + '</div><div id="dbk-once-msg" style="min-height:16px;font-size:12px;margin-top:8px;color:#0d2240"></div></div>';
  document.body.appendChild(d);
  var say = function(m){ var e = document.getElementById('dbk-once-msg'); if (e) e.textContent = m; };
  document.getElementById('dbk-once-copy').onclick = async function(){ say((await dbkCopy(k)) ? '✅ 열쇠를 복사했습니다 — 다른 기기 붙여넣기 칸에 넣으세요' : '복사가 막혔어요 — 위 칸을 길게 눌러 복사하세요'); };
  document.getElementById('dbk-once-sql').onclick = async function(){ var line = await dbkSqlLine(k); say((await dbkCopy(line)) ? '✅ 서버 등록 한 줄을 복사했습니다 — SQL Editor 에 붙여 넣어 실행하세요' : '복사가 막혔어요'); };
  document.getElementById('dbk-once-close').onclick = function(){
    if (!confirm('닫으면 열쇠를 다시 볼 수 없습니다. 다른 기기에 넣으셨나요?')) return;
    d.remove(); dbkSay('새 열쇠를 이 기기에 저장했습니다 — 서버 등록 뒤 「🧪 열쇠 시험」을 눌러 보세요'); try { render(); } catch(e){}
  };
}
async function dbkSqlLine(k){
  var h = await dbkSha(k);
  return "insert into private.teacher_key(label, hash) values ('main', '" + h + "') on conflict (label) do update set hash = excluded.hash, created_at = now();";
}
window.dbkCopySql = async function(){
  var k = dbkCur(); if (!k) { dbkSay('이 기기에 열쇠가 없습니다'); return; }
  if (!dbkValid(k)) { dbkSay('⚠ 옛 짧은 열쇠입니다 — 「✨ 새 열쇠 만들기」부터 하세요'); return; }
  var line = await dbkSqlLine(k);
  dbkSay((await dbkCopy(line)) ? '✅ 서버 등록 한 줄을 복사했습니다(열쇠가 아니라 해시) — SQL Editor 에서 실행하세요' : '복사가 막혔어요');
};
window.dbkPaste = function(){
  var el = document.getElementById('dbk-paste'); var v = String((el || {}).value || '').trim();
  if (!dbkValid(v)) { dbkSay('⚠ 열쇠 모양이 아닙니다(32글자 이상 · 영문·숫자·-·_)'); return; }
  try { localStorage.setItem('lumen_db_key', v); } catch(e){ dbkSay('⚠ 저장하지 못했습니다'); return; }
  if (el) el.value = '';
  dbkResetClient(); DBK.fp = null; DBK.fpFor = null;
  dbkSay('✅ 이 기기에 열쇠를 저장했습니다 — 지문이 다른 기기와 같은지 보세요');
  try { render(); } catch(e){}
};
/* 열쇠 시험 — 시험 줄(_dbk_test)을 넣고 지워 본다. 지워지면 서버가 이 기기를 원장으로 알아본다 */
window.dbkTest = async function(){
  if (DBK.busy) return; DBK.busy = true; dbkSay('🧪 시험 중…');
  try {
    dbkResetClient(); var sb = getSupaClient(); if (!sb) throw new Error('서버 연결 없음');
    var w = await sb.from('lumen_store').upsert({ key: '_dbk_test', value: { at: new Date().toISOString() }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (w && w.error) throw new Error('시험 줄 넣기 실패: ' + (w.error.message || ''));
    var d = await sb.from('lumen_store').delete().eq('key', '_dbk_test');
    if (d && d.error) throw new Error('지우기 요청 실패: ' + (d.error.message || ''));
    var r = await sb.from('lumen_store').select('key').eq('key', '_dbk_test');
    var left = r && r.data ? r.data.length : -1;
    if (left === 0) dbkSay('✅ 열쇠가 맞습니다 — 이 기기에서 지우기가 됩니다');
    else if (left > 0) dbkSay('❌ 서버가 이 열쇠를 모릅니다 — 「서버 등록 한 줄」을 실행했는지, 다른 기기와 지문이 같은지 보세요');
    else dbkSay('⚠ 확인하지 못했습니다(인터넷)');
  } catch(e){ dbkSay('⚠ ' + (e && e.message || e)); }
  DBK.busy = false;
};
