/* ═══════════════════════════════════════════════════════════════════
 * v19-126: 네이버 예약 — ① 네이버 로고 ② «예약 열쇠» (원장 2026-10-17 「네이버로고로 해주고」 · 이름이 안 보여 학생과 못 잇는다)
 *
 *  ① 📅 대신 작은 네이버 로고(초록 #03C75A 둥근 네모 + 흰 굵은 N, 그림 글자 SVG):
 *     메뉴 칸(수업·출결 › 네이버 예약) · 화면 제목 · 홈 「오늘 네이버 예약」 · 리커버리 「예약했지만 명단에 없음」
 *     메뉴는 s.icon 을 innerHTML 로 그리므로(stab .si · lsub-i .ic) SVG 글을 그대로 넣으면 된다 — 그리기 코드는 안 바꾼다.
 *  ② 예약자 이름·전화 상자(naver_bookings_pii)를 «예약 열쇠»로 연다
 *     · 서버 잠금 열쇠(LUMEN_TEACHER_KEY = lumen_db_key)가 공개돼 교체 대기 중 → 수집기는 GitHub 비밀값 NAVER_PII_KEY(원장님이 지은 긴 암호문)를 먼저 쓴다
 *     · 이 기기 열쇠: localStorage or_nb_key 먼저, 없거나 안 맞으면 lumen_db_key (예전 상자)
 *     · 상자의 kid(열쇠 지문 8글자)와 이 기기 열쇠의 지문이 다르면 「열쇠가 달라요」
 *     · 「🔑 예약 열쇠 넣기」 칸 → 이 브라우저 localStorage or_nb_key 에만 (서버로 절대 안 올림 — 아래 scheduleSync 막기 ·
 *       build_app.py v19-126: HTS_LOCAL_ONLY · PULL_SKIP_KEYS · 비상 비우기 KEEP)
 *     · 주소 뒤 #nbkey=… 를 한 번 붙여 열어도 저장(그 뒤 주소에서 지움) — build_app.py v19-126 이 #dbkey 처리 바로 앞에 넣는다
 *  문자열 연결로만 쓴다(템플릿 리터럴 금지). 열쇠 글은 화면·로그 어디에도 찍지 않는다.
 * ═══════════════════════════════════════════════════════════════════ */
var NBK_LOGO = '<svg class="nbk-logo" viewBox="0 0 20 20" width="1em" height="1em" role="img" aria-label="네이버" focusable="false" style="display:inline-block;vertical-align:-0.14em;flex:none">'
  + '<rect width="20" height="20" rx="4.6" fill="#03C75A"/>'
  + '<path d="M5.4 4.9h3.3l2.75 4.25V4.9h3.15v10.2h-3.3L8.55 10.85v4.25H5.4z" fill="#fff"/></svg>';
function nbkLogo(){ return NBK_LOGO; }

/* ── ① 메뉴 칸 아이콘 ── */
(function(){
  try { (GROUPS || []).forEach(function(g){ (g.subs || []).forEach(function(s){ if (s.v === 'naverbk') s.icon = NBK_LOGO; }); }); }
  catch(e){ try { console.error('[네이버 예약 로고]', e); } catch(_){} }
})();
/* 왼쪽 머리(3분할 l3LeftHead)는 화면 이름을 글자로 다룬다(l3Esc) → 이름에서는 로고를 빼고, 머리를 그릴 때만 로고를 붙인다 */
if (typeof l3ViewTitle === 'function') l3ViewTitle = (function(o){
  return function(){
    var r = o.apply(this, arguments);
    try {
      if (r && (String(r.name || '').indexOf(NBK_LOGO) >= 0 || String(r.grp || '').indexOf(NBK_LOGO) >= 0)){
        var c = {}; Object.keys(r).forEach(function(k){ c[k] = r[k]; });
        c.name = String(r.name || '').split(NBK_LOGO).join('').trim();
        c.grp = String(r.grp || '').split(NBK_LOGO).join('').trim();
        r = c;
      }
    } catch(e){}
    return r;
  };
})(l3ViewTitle);
if (typeof window.l3LeftHead === 'function') window.l3LeftHead = (function(o){
  return function(v){
    var h = o.apply(this, arguments);
    return ((v == null ? VIEW : v) === 'naverbk' && h) ? h.replace('<b>네이버 예약</b>', '<b>' + NBK_LOGO + ' 네이버 예약</b>') : h;
  };
})(window.l3LeftHead);

/* ── 예약 열쇠: 이 기기에만 ── */
var NBK_KEY_LS = 'or_nb_key';
if (typeof scheduleSync === 'function') scheduleSync = (function(o){ return function(key){ if (key === NBK_KEY_LS) return; return o.apply(this, arguments); }; })(scheduleSync);
try { if (typeof HTS_LOCAL_ONLY === 'object' && HTS_LOCAL_ONLY) HTS_LOCAL_ONLY[NBK_KEY_LS] = 1; } catch(e){}
function nbkNbKey(){ try { return String((typeof _origGetItem === 'function' ? _origGetItem(NBK_KEY_LS) : localStorage.getItem(NBK_KEY_LS)) || ''); } catch(e){ return ''; } }
function nbkNbKeySet(v){
  try {
    if (v){ if (typeof _origSetItem === 'function') _origSetItem(NBK_KEY_LS, v); else localStorage.setItem(NBK_KEY_LS, v); }
    else { if (typeof _origRemoveItem === 'function') _origRemoveItem(NBK_KEY_LS); else localStorage.removeItem(NBK_KEY_LS); }
    return true;
  } catch(e){ return false; }
}

/* ── 상자 열기: 예약 열쇠 → 서버 잠금 열쇠 (지문이 다르면 열어 보지도 않는다) ── */
nbkUnlock = async function(){
  NBK.pii = null; NBK.piiErr = ''; NBK.piiSrc = ''; NBK.kidMine = '';
  var box = NBK.box;
  if (!box || !box.ct){ NBK.piiErr = (NBK.data && NBK.data.pii && NBK.data.pii.enc) ? 'nobox' : 'nokey-server'; return; }
  var cand = [], nk = nbkNbKey(), dk = '';
  try { dk = lumenDbKey(); } catch(e){}
  if (nk) cand.push({ k: nk, src: 'nb' });
  if (dk && dk !== nk) cand.push({ k: dk, src: 'db' });
  if (!cand.length){ NBK.piiErr = 'nokey-device'; return; }
  for (var i = 0; i < cand.length; i++){
    var kid = '';
    try { kid = await nbKid(cand[i].k); } catch(e){}
    if (cand[i].src === 'nb') NBK.kidMine = kid;
    if (box.kid && kid && kid !== box.kid) continue;
    try { var o = await nbOpen(box, cand[i].k); NBK.pii = (o && o.byId) || {}; NBK.piiSrc = cand[i].src; return; } catch(e){}
  }
  /* 예약 열쇠를 넣었는데 안 맞음 · 예전 상자(서버 잠금 열쇠)인데 그 열쇠가 안 맞음 → 「열쇠가 달라요」
   * 예약 열쇠 상자인데 이 기기엔 서버 잠금 열쇠뿐 → 「예약 열쇠를 넣으면」 */
  NBK.piiErr = (nk || box.kk !== 'pii') ? 'badkey' : 'nokey-device';
};

/* ── 열쇠 넣기 / 지우기 ── */
window.nbkKeySave = async function(){
  var el = document.getElementById('nbkKeyIn');
  var v = String((el && el.value) || '').trim();
  if (v.length < 8){ plToast('🔑 예약 열쇠가 너무 짧아요 — GitHub NAVER_PII_KEY 에 넣은 글을 그대로 넣어 주세요'); return; }
  if (!nbkNbKeySet(v)){ plToast('⚠ 이 브라우저에 저장하지 못했어요'); return; }
  if (el) el.value = '';
  await nbkUnlock();
  render();
  if (NBK.pii) plToast('🔓 예약자 이름·전화를 열었어요');
  else if (NBK.piiErr === 'badkey') plToast('🔑 열쇠가 달라요 — GitHub NAVER_PII_KEY 와 똑같이 넣어 주세요');
  else plToast('🔑 이 브라우저에 예약 열쇠를 저장했어요');
};
window.nbkKeyForget = async function(){
  if (!confirm('이 브라우저에 저장한 예약 열쇠를 지울까요?')) return;
  nbkNbKeySet('');
  await nbkUnlock(); render();
  plToast('🔑 예약 열쇠를 지웠어요');
};
window.nbkKeyShow = function(cb){ var el = document.getElementById('nbkKeyIn'); if (el) el.type = cb && cb.checked ? 'text' : 'password'; };

function nbkKeyForm(){
  var has = !!nbkNbKey();
  return '<div class="nbk-key" data-nbk-key="1"><input type="password" id="nbkKeyIn" class="nbk-kin" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="예약 열쇠 (GitHub NAVER_PII_KEY 와 같은 글)" aria-label="예약 열쇠"'
    + ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();nbkKeySave();}">'
    + '<label class="nbk-kshow"><input type="checkbox" onchange="nbkKeyShow(this)"> 보기</label>'
    + '<button type="button" class="nbk-btn nbk-ksave" onclick="nbkKeySave()">저장</button>'
    + (has ? '<button type="button" class="nbk-btn nbk-kdel" onclick="nbkKeyForget()">지우기</button>' : '')
    + '</div><div class="nbk-knote">이 브라우저에만 저장돼요 · 서버로 올라가지 않아요' + (has ? ' · <b>지금 저장된 열쇠 있음 ✓</b>' : '') + '</div>';
}
function nbkKeyHowTo(){
  return '<ol>'
    + '<li>긴 암호문을 하나 지어요 — <b>20글자 이상</b> (예: 띄어쓰기를 섞은 나만 아는 문장). 학원 다른 비밀번호와 다르게.</li>'
    + '<li>맥에서 GitHub 저장소 <b>lumen-math</b> → <b>Settings</b> → <b>Secrets and variables</b> → <b>Actions</b> → <b>New repository secret</b></li>'
    + '<li>Name 에 <code>NAVER_PII_KEY</code> · Secret 에 그 암호문 → <b>Add secret</b></li>'
    + '<li>아래 칸에 <b>같은 암호문</b>을 넣고 <b>저장</b> (이 브라우저에만 저장)</li>'
    + '<li>위의 <b>⚡ 지금 받기</b> (또는 15분 기다리기) → 이름·전화가 보여요</li></ol>';
}
/* ── 이름·전화 띠 (v19-124 의 같은 자리 띠를 바꾼다) ── */
function nbkKeyBanner(){
  if (!NBK.data) return '';
  var pe = NBK.piiErr, box = NBK.box || {};
  if (!pe) return '';
  var viaTeacher = box.kk === 'teacher' || (!box.kk && box.ct);   /* 예전 상자(서버 잠금 열쇠로 잠금) */
  if (pe === 'nokey-server'){
    return '<div class="nbk-ban grey" data-nbk-ban="pii" data-nbk-pii="nokey-server"><b>🔒 예약자 이름·전화는 아직 저장되지 않아요</b>'
      + '<span>GitHub 비밀값 <b>NAVER_PII_KEY</b>(«예약 열쇠»)를 넣으면 다음 수집부터 보여요. 서버 잠금 열쇠(LUMEN_TEACHER_KEY)는 교체 중이라 쓰지 않아요. 시간·상품·학생 연결은 그대로 보여요.</span>'
      + nbkKeyHowTo() + nbkKeyForm() + '</div>';
  }
  if (pe === 'badkey'){
    return '<div class="nbk-ban amber" data-nbk-ban="pii" data-nbk-pii="badkey"><b>🔑 열쇠가 달라요</b>'
      + '<span>이 기기의 열쇠로 이름·전화를 못 열었어요. '
      + (viaTeacher ? '지금 상자는 서버 잠금 열쇠(LUMEN_TEACHER_KEY)로 잠겨 있어요 — GitHub 에 NAVER_PII_KEY 를 넣으면 다음 수집부터 예약 열쇠로 잠겨요.'
                    : 'GitHub <b>NAVER_PII_KEY</b> 에 넣은 암호문과 <b>똑같이</b>(띄어쓰기·대소문자까지) 다시 넣어 주세요.')
      + '</span>' + nbkKeyForm() + '</div>';
  }
  if (pe === 'nokey-device'){
    return '<div class="nbk-ban grey" data-nbk-ban="pii" data-nbk-pii="nokey-device"><b>🔑 예약 열쇠를 넣으면 이름·전화가 보여요</b>'
      + '<span>' + (viaTeacher ? '지금 상자는 서버 잠금 열쇠(LUMEN_TEACHER_KEY)로 잠겨 있어요. ' : '') + 'GitHub <b>NAVER_PII_KEY</b> 에 넣은 암호문을 아래에 넣어 주세요.</span>'
      + nbkKeyForm() + '</div>';
  }
  if (pe === 'nobox') return '<div class="nbk-ban grey" data-nbk-ban="pii" data-nbk-pii="nobox"><b>🔒 이름·전화 칸을 받지 못했어요</b><span>🔄 새로고침 해 보세요.</span></div>';
  return '';
}
nbkBanners = (function(o){
  return function(){
    var pe = NBK.piiErr, h;
    NBK.piiErr = '';   /* 옛 이름·전화 띠는 빼고 그린 뒤 새 띠를 붙인다 */
    try { h = o.apply(this, arguments); } finally { NBK.piiErr = pe; }
    return h + nbkKeyBanner();
  };
})(nbkBanners);

/* ── 제목 · 홈 · 리커버리: 📅 → 로고 ── */
rNaverBk = (function(o){
  return function(){
    var h = o.apply(this, arguments);
    return h.replace('<div class="nbk-ttl">📅 네이버 예약</div>', '<div class="nbk-ttl">' + NBK_LOGO + ' 네이버 예약</div>')
            .replace('<div class="nbk-empty">📅 네이버 예약 불러오는 중…</div>', '<div class="nbk-empty">' + NBK_LOGO + ' 네이버 예약 불러오는 중…</div>');
  };
})(rNaverBk);
window.rNaverBk = rNaverBk;
window.nbkHomeCard = (function(o){
  return function(){
    var h = o.apply(this, arguments);
    return h ? h.replace('<b>📅 오늘 네이버 예약 ', '<b>' + NBK_LOGO + ' 오늘 네이버 예약 ') : h;
  };
})(window.nbkHomeCard);
if (typeof nbkRcSide === 'function') nbkRcSide = (function(o){
  return function(){ var h = o.apply(this, arguments); return h ? h.replace('<b>📅 예약했지만 명단에 없음', '<b>' + NBK_LOGO + ' 예약했지만 명단에 없음') : h; };
})(nbkRcSide);

/* ── 모양 ── */
(function(){
  if (document.getElementById('nbk126-css')) return;
  var st = document.createElement('style'); st.id = 'nbk126-css';
  st.textContent = ''
    + '.nbk-ttl{display:flex;align-items:center;gap:7px}.nbk-hh b{display:inline-flex;align-items:center;gap:5px}'
    + '.nbk-key{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:8px}'
    + '.nbk-kin{flex:1;min-width:0;max-width:380px;font-family:inherit;font-size:13px;font-weight:700;border:1.5px solid #cbd5e1;border-radius:9px;padding:7px 10px;background:#fff;color:#0f172a}'
    + '.nbk-kin:focus{outline:none;border-color:#03C75A}.nbk-kshow{font-size:11.5px;font-weight:800;color:#64748b;display:inline-flex;align-items:center;gap:3px;cursor:pointer}'
    + '.nbk-btn.nbk-ksave{background:#03C75A;border-color:#03C75A;color:#fff}.nbk-knote{font-size:11px;font-weight:700;color:#94a3b8;margin-top:3px}.nbk-knote b{color:#15803d}';
  (document.head || document.documentElement).appendChild(st);
})();
