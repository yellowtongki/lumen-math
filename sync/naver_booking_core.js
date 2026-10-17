/* ═══════════════════════════════════════════════════════════════════
 * 📅 네이버 예약 — 수집기와 학원앱이 함께 쓰는 순수 함수 (한 곳에서만 고친다)
 *   · 수집기 sync/naver_booking_collect.js 가 require 로 쓰고,
 *   · 학원앱 v19-124 는 조립할 때(build_app.py) 이 파일을 그대로 붙여 넣는다.
 *   → ES5 · 템플릿 리터럴 금지 · 브라우저(window)와 node(module.exports) 둘 다.
 *
 *  ① 상품 종류 나누기 nbKindOf(이름, 상품번호) — 이름 낱말 먼저, 모르면 번호, 그래도 모르면 '기타'
 *  ② 예약 1건 정리 nbNormalize(원본) — 이름·전화·메모·추가 답(form)은 «개인정보 칸(pii)»으로 따로 뺀다
 *  ③ 상태 nbStatusOf — 네이버 코드(RC02·RC03·RC08 …)를 신청/확정/완료/취소/노쇼로 (모르는 코드는 원래 코드 그대로)
 *  ④ 학생 맞추기 nbMatch — 원장님 직접 연결 > 전화번호 > 이름(메모·추가 답에 학생 이름)
 *  ⑤ 개인정보 칸 잠그기 nbSeal / 열기 nbOpen — 원장님 열쇠(학원앱 lumen_db_key = GitHub 비밀값 LUMEN_TEACHER_KEY)로 AES-GCM
 *     (lumen_store 는 앱의 공개 열쇠로 누구나 읽을 수 있어서, 학부모 이름·전화는 잠근 채로만 둔다)
 * ═══════════════════════════════════════════════════════════════════ */
(function(root){
  'use strict';

  /* ── ① 상품 종류 ── */
  var NB_KINDS = [
    { k:'recovery', label:'리커버리',  short:'리커버리', color:'#dc2626', bg:'#fee2e2' },
    { k:'tenten',   label:'텐투텐',    short:'텐투텐',   color:'#7c3aed', bg:'#ede9fe' },
    { k:'counsel',  label:'상담/테스트', short:'상담',   color:'#0369a1', bg:'#e0f2fe' },
    { k:'tlp',      label:'TLP',       short:'TLP',      color:'#047857', bg:'#d1fae5' },
    { k:'kmm',      label:'KMM',       short:'KMM',      color:'#b45309', bg:'#fef3c7' },
    { k:'consult',  label:'컨설팅',    short:'컨설팅',   color:'#be185d', bg:'#fce7f3' },
    { k:'etc',      label:'기타',      short:'기타',     color:'#475569', bg:'#f1f5f9' }
  ];
  /* 2026-10-17 업체 1419039 의 상품 6개 (이름이 바뀌어도 번호로 찾는다) */
  var NB_ITEM_KIND = { '6773412':'counsel', '7401437':'tlp', '7170543':'tenten', '7380213':'recovery', '7280930':'kmm', '7397966':'consult' };
  function nbKindOf(name, id){
    var n = String(name == null ? '' : name);
    if (/리커버리|recovery/i.test(n)) return 'recovery';
    if (/텐투텐|10\s*to\s*10|ten\s*to\s*ten/i.test(n)) return 'tenten';
    if (/TLP|학습\s*심리|학습\s*검사/i.test(n)) return 'tlp';
    if (/KMM|경시/i.test(n)) return 'kmm';
    if (/컨설팅/.test(n)) return 'consult';
    if (/테스트|상담/.test(n)) return 'counsel';
    var byId = NB_ITEM_KIND[String(id == null ? '' : id)];
    return byId || 'etc';
  }
  function nbKindInfo(k){ for (var i = 0; i < NB_KINDS.length; i++) if (NB_KINDS[i].k === k) return NB_KINDS[i]; return NB_KINDS[NB_KINDS.length - 1]; }

  /* ── 시간: UTC → 한국 시간 ── */
  function nbKst(iso){
    if (!iso) return null;
    var s = String(iso);
    if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?(\.\d+)?$/.test(s)) s += 'Z';   /* 시간대 표시가 없으면 UTC 로 본다(snapshotJson 은 Z 가 붙어 온다) */
    var t = Date.parse(s); if (isNaN(t)) return null;
    var d = new Date(t + 9 * 3600000);
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
  }
  function nbTodayKst(now){ return new Date((now == null ? Date.now() : now) + 9 * 3600000).toISOString().slice(0, 10); }
  function nbAddDays(ymd, n){ var t = Date.parse(ymd + 'T00:00:00Z'); return new Date(t + n * 86400000).toISOString().slice(0, 10); }

  /* ── ③ 상태 ── */
  var NB_ST_LABEL = { requested:'신청(확정 대기)', confirmed:'확정', completed:'이용 완료', cancelled:'취소', noshow:'노쇼', unknown:'' };
  function nbStatusOf(b){
    b = b || {};
    var code = String(b.bookingStatusCode || ''), admin = String(b.adminBookingStatusCode || '');
    var k = 'unknown';
    if (b.cancelledDateTime || b.cancelDateTime || code === 'RC04' || /CANCEL/i.test(admin)) k = 'cancelled';
    else if (b.isNoShow || b.noShow || b.noShowDateTime || /NOSHOW|NO_SHOW/i.test(code + ' ' + admin)) k = 'noshow';
    else if (b.isCompleted || b.completedDateTime || code === 'RC08') k = 'completed';
    else if (code === 'RC03' || b.confirmedDateTime) k = 'confirmed';
    else if (code === 'RC01' || code === 'RC02') k = 'requested';
    return { k: k, code: code, admin: admin, label: NB_ST_LABEL[k] || ('상태 ' + (code || '?')) };
  }

  /* ── 추가 답(customFormInputJson) — 모양이 정해지지 않아 흔한 이름들을 차례로 본다 ── */
  function nbParse(v){ if (typeof v === 'string'){ try { return JSON.parse(v); } catch (e) { return null; } } return v; }
  function nbFormOf(snap){
    var raw = nbParse(snap && (snap.customFormInputJson || snap.customFormInput));
    if (!raw) return [];
    if (!Array.isArray(raw)) raw = (typeof raw === 'object') ? (raw.items || raw.list || raw.inputs || Object.keys(raw).map(function(k){ return { title: k, value: raw[k] }; })) : [];
    var out = [];
    (raw || []).forEach(function(x){
      if (x == null) return;
      if (typeof x !== 'object'){ out.push({ q: '', a: String(x) }); return; }
      var q = x.title || x.name || x.question || x.label || x.formTitle || x.key || '';
      var a = x.value; if (a == null) a = x.answer; if (a == null) a = x.inputValue; if (a == null) a = x.text; if (a == null) a = x.selectedValue; if (a == null) a = x.values; if (a == null) a = x.options;
      if (Array.isArray(a)) a = a.map(function(y){ return (y && typeof y === 'object') ? (y.value || y.name || y.title || '') : y; }).filter(function(y){ return y != null && y !== ''; }).join(', ');
      else if (a && typeof a === 'object') a = a.value || a.name || a.title || '';
      a = (a == null) ? '' : String(a);
      if (!String(q).trim() && !a.trim()) return;
      out.push({ q: String(q).slice(0, 80), a: a.slice(0, 300) });
    });
    return out.slice(0, 12);
  }

  /* ── 전화번호 ── */
  function nbDigits(p){
    var d = String(p == null ? '' : p).replace(/[^0-9]/g, '');
    if (d.indexOf('82') === 0 && d.length >= 11) d = '0' + d.slice(2);
    return d;
  }
  /* 한 칸에 번호가 둘 이상 적혀 있을 수 있어(「010-… / 010-…」) 숫자 묶음을 다 꺼낸다 */
  function nbPhonesIn(s){
    var out = [], t = String(s == null ? '' : s), re = /(?:\+?82[-\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}/g, m;
    while ((m = re.exec(t))){ var d = nbDigits(m[0]); if (d.length === 10 && d.charAt(0) === '1') d = '0' + d; if (d.length >= 9 && out.indexOf(d) < 0) out.push(d); }
    return out;
  }
  function nbFmtPhone(p){
    var d = nbDigits(p);
    if (d.length === 11) return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7);
    if (d.length === 10) return d.slice(0, 3) + '-' + d.slice(3, 6) + '-' + d.slice(6);
    return String(p == null ? '' : p);
  }

  /* ── ② 예약 1건 정리 → { pub: 공개해도 되는 칸, pii: 잠글 칸 } ── */
  function nbNormalize(b, items){
    b = b || {};
    var snap = nbParse(b.snapshotJson) || {};
    var itemId = String(b.bizItemId == null ? '' : b.bizItemId);
    var itemName = b.bizItemName || '';
    if (!itemName && items){ for (var i = 0; i < items.length; i++) if (String(items[i].bizItemId) === itemId){ itemName = items[i].name || ''; break; } }
    var st = nbStatusOf(b);
    var s0 = nbKst(snap.startDateTime || b.startDateTime), e0 = nbKst(snap.endDateTime || b.endDateTime);
    var date = (s0 && s0.date) || String(b.startDate || '').slice(0, 10);
    var cancelled = b.cancelledDateTime || b.cancelDateTime || (st.k === 'cancelled' ? (b.updatedDateTime || '') : '') || '';
    var pub = {
      id: String(b.bookingId == null ? '' : b.bookingId),
      item: { id: itemId, name: String(itemName), kind: nbKindOf(itemName, itemId) },
      status: { code: st.code, admin: st.admin, k: st.k, label: st.label },
      date: date,
      start: (s0 && s0.time) || '',
      end: (e0 && e0.time) || '',
      endDate: (e0 && e0.date) || String(b.endDate || '').slice(0, 10),
      count: Number(b.bookingCount) || 1,
      reg: b.regDateTime || '', confirmed: b.confirmedDateTime || '', completed: b.completedDateTime || '', cancelled: cancelled || ''
    };
    var pii = {
      booker: String(b.name || b.bookerName || b.userName || ''),
      phone: nbFmtPhone(b.phone || b.phoneNumber || b.bookerPhone || ''),
      msg: String(b.requestMessage || b.request || '').slice(0, 500),
      form: nbFormOf(snap)
    };
    return { pub: pub, pii: pii };
  }
  /* 기간 안인지 — 이용일이 오늘-30일 ~ 오늘+90일, 또는 최근 14일 안에 신청·확정·취소·완료된 것 */
  function nbInWindow(pub, today, back, ahead, recentDays){
    back = back == null ? 30 : back; ahead = ahead == null ? 90 : ahead; recentDays = recentDays == null ? 14 : recentDays;
    var lo = nbAddDays(today, -back), hi = nbAddDays(today, ahead);
    if (pub.date && pub.date >= lo && pub.date <= hi) return true;
    var rlo = nbAddDays(today, -recentDays);
    return [pub.reg, pub.confirmed, pub.cancelled, pub.completed].some(function(x){ var k = nbKst(x); return k && k.date >= rlo; });
  }

  /* ── ④ 학생 맞추기 ──
   *  students = 학원앱 등록부(or_studentdb) · 학생 키 = String(id || name) (리커버리 보드 rc_state 와 같은 키)
   *  links = 원장님이 앱에서 고른 것 { 예약번호: 학생 키 } — 학생 키가 '' 이면 「명단에 없음(새 가족)」으로 고정 */
  function nbStKey(s){ return String((s && (s.id || s.name)) || ''); }
  function nbStuPhones(s){
    var out = [];
    Object.keys(s || {}).forEach(function(k){
      if (!/phone|tel|연락/i.test(k)) return;
      var v = s[k]; if (v == null || typeof v === 'object') return;
      nbPhonesIn(v).forEach(function(d){ if (out.indexOf(d) < 0) out.push(d); });
    });
    return out;
  }
  function nbNameKey(n){ return String(n == null ? '' : n).replace(/\s+/g, ''); }
  function nbMatch(pub, pii, students, links){
    var id = pub && pub.id;
    var act = (students || []).filter(function(s){ return s && s.name && !s.withdrawn; });
    if (links && Object.prototype.hasOwnProperty.call(links, id)){
      var lk = links[id];
      if (lk === '' || lk == null) return { stKey: '', code: '', how: 'none' };
      var hit = (students || []).filter(function(s){ return nbStKey(s) === String(lk); })[0];
      if (hit) return { stKey: nbStKey(hit), code: String(hit.lumen_rec_code || ''), how: 'manual' };
    }
    pii = pii || {};
    var text = [pii.msg || ''].concat((pii.form || []).map(function(f){ return (f.q || '') + ' ' + (f.a || ''); })).join(' ');
    var tkey = nbNameKey(text);
    var byName = function(arr){ return arr.filter(function(s){ var nk = nbNameKey(s.name); return nk.length >= 2 && tkey.indexOf(nk) >= 0; }); };
    var ph = nbDigits(pii.phone);
    if (ph.length >= 9){
      var byPh = act.filter(function(s){ return nbStuPhones(s).indexOf(ph) >= 0; });
      if (byPh.length === 1) return { stKey: nbStKey(byPh[0]), code: String(byPh[0].lumen_rec_code || ''), how: 'phone' };
      if (byPh.length > 1){   /* 형제 — 메모에 이름이 있으면 그 아이 */
        var nb = byName(byPh);
        if (nb.length === 1) return { stKey: nbStKey(nb[0]), code: String(nb[0].lumen_rec_code || ''), how: 'phone' };
        return { stKey: '', code: '', how: 'ambiguous', cands: byPh.map(nbStKey) };
      }
    }
    if (tkey){
      var bn = byName(act);
      if (bn.length > 1){   /* 「김민준」 안에 「민준」 같은 짧은 이름이 겹치면 긴 이름만 */
        bn = bn.filter(function(s){ return !bn.some(function(o){ return o !== s && nbNameKey(o.name).length > nbNameKey(s.name).length && nbNameKey(o.name).indexOf(nbNameKey(s.name)) >= 0; }); });
      }
      if (bn.length === 1) return { stKey: nbStKey(bn[0]), code: String(bn[0].lumen_rec_code || ''), how: 'name' };
      if (bn.length > 1) return { stKey: '', code: '', how: 'ambiguous', cands: bn.map(nbStKey) };
    }
    return null;
  }

  /* ── ⑤ 개인정보 칸 잠그기 / 열기 (AES-GCM 256 · 열쇠 = SHA-256('lumen-naver-booking-v1|' + 원장님 열쇠)) ── */
  function nbSubtle(){ var c = (typeof crypto !== 'undefined') ? crypto : (root && root.crypto); return c && c.subtle ? c : null; }
  function nbB64(u8){
    if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
    var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s);
  }
  function nbUnB64(s){
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(s), 'base64'));
    var b = atob(String(s)), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u;
  }
  function nbHex(buf){ var u = new Uint8Array(buf), s = ''; for (var i = 0; i < u.length; i++) s += (u[i] < 16 ? '0' : '') + u[i].toString(16); return s; }
  function nbKeyOf(teacherKey){
    var C = nbSubtle(); if (!C) return Promise.reject(new Error('이 브라우저는 암호 기능(crypto.subtle)이 없습니다'));
    var enc = new TextEncoder();
    return C.subtle.digest('SHA-256', enc.encode('lumen-naver-booking-v1|' + String(teacherKey))).then(function(raw){
      return C.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    });
  }
  /* 열쇠 지문(앞 8글자) — 열쇠가 다른지 알아보는 용도. 열쇠 자체는 알 수 없다 */
  function nbKid(teacherKey){
    var C = nbSubtle(); if (!C) return Promise.resolve('');
    return C.subtle.digest('SHA-256', new TextEncoder().encode('lumen-naver-kid|' + String(teacherKey))).then(function(h){ return nbHex(h).slice(0, 8); });
  }
  function nbSeal(obj, teacherKey){
    var C = nbSubtle(); if (!C) return Promise.reject(new Error('crypto.subtle 없음'));
    var iv = C.getRandomValues(new Uint8Array(12));
    return Promise.all([nbKeyOf(teacherKey), nbKid(teacherKey)]).then(function(r){
      return C.subtle.encrypt({ name: 'AES-GCM', iv: iv }, r[0], new TextEncoder().encode(JSON.stringify(obj))).then(function(ct){
        return { v: 1, alg: 'A256GCM', kid: r[1], iv: nbB64(iv), ct: nbB64(new Uint8Array(ct)) };
      });
    });
  }
  function nbOpen(box, teacherKey){
    if (!box || !box.ct || !box.iv) return Promise.reject(new Error('잠긴 칸이 없습니다'));
    var C = nbSubtle(); if (!C) return Promise.reject(new Error('crypto.subtle 없음'));
    return nbKeyOf(teacherKey).then(function(k){
      return C.subtle.decrypt({ name: 'AES-GCM', iv: nbUnB64(box.iv) }, k, nbUnB64(box.ct));
    }).then(function(pt){ return JSON.parse(new TextDecoder().decode(pt)); });
  }

  var API = { NB_KINDS: NB_KINDS, NB_ITEM_KIND: NB_ITEM_KIND, nbKindOf: nbKindOf, nbKindInfo: nbKindInfo, nbKst: nbKst, nbTodayKst: nbTodayKst, nbAddDays: nbAddDays,
    nbStatusOf: nbStatusOf, nbFormOf: nbFormOf, nbDigits: nbDigits, nbPhonesIn: nbPhonesIn, nbFmtPhone: nbFmtPhone, nbNormalize: nbNormalize, nbInWindow: nbInWindow,
    nbStKey: nbStKey, nbStuPhones: nbStuPhones, nbMatch: nbMatch, nbSeal: nbSeal, nbOpen: nbOpen, nbKid: nbKid };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else Object.keys(API).forEach(function(k){ root[k] = API[k]; });
})(typeof window !== 'undefined' ? window : this);
