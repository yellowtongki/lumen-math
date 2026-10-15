/* ═══════════════════════════════════════════════════════════════════
 * 🧠 루멘 수학퀴즈 — «함께 쓰는 그리기» (학원앱 v19-121 미리보기 · 학생앱 v2-137 플레이어가 똑같이 쓴다)
 *   원장 승인 시안: docs/mockup_char_lesson_px2.html (학생) · docs/mockup_char_lesson_teacher.html (학원앱)
 *   캐릭터 그림 = window.MQ_PX (조립 때 docs/char_px2/*.png 를 data URI 로 심는다 — 최종 그림은 그 폴더 PNG 만 바꾸고 다시 조립)
 *   대본 한 줄(lines[]):
 *     {t:'say', who:'lumi'|'aha'|'ssam', face:'base'|'oops'|'aha', text}   — 말풍선 (**낱말** = 주황 강조)
 *     {t:'card', title, body, svg?}                                        — 개념 카드 (svg 는 선·글자만, 스크립트·링크 금지)
 *     {t:'quiz', q, choices:[..], answer:번호(0부터), src}                  — 문제 (src 는 원장님만 봄)
 *     {t:'point', text}                                                    — 정수쌤의 아하 포인트
 *   ※ ES5 · 템플릿 리터럴 금지 (학생앱 규칙). 교재 문제 그림은 학생에게 절대 보이지 않는다(그림 칸 자체가 없다).
 * ═══════════════════════════════════════════════════════════════════ */
var MQR = (function(){
  var WHO = {
    lumi: { nm:'루미',   role:'개념 언니',   faces:['base','oops'], bg:'#fff7d6', bd:'#fde68a', pitch:1.15, rate:1.0 },
    aha:  { nm:'아하',   role:'실수 대장',   faces:['base','aha'],  bg:'#ffedd5', bd:'#fed7aa', pitch:0.95, rate:1.05 },
    ssam: { nm:'정수쌤', role:'아하 포인트', faces:['base'],        bg:'#e0e7ff', bd:'#c7d2fe', pitch:0.85, rate:0.95 }
  };
  var ORDER = ['lumi','aha','ssam'];
  var FACE_NM = { base:'기본', oops:'당황', aha:'아하💡' };
  var TYPE_NM = { say:'💬 대사', card:'🟩 개념 카드', quiz:'✋ 문제', point:'📌 아하 포인트' };

  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  /* **낱말** → 주황 강조 · 줄바꿈 */
  function hl(s){ return esc(s).replace(/\*\*([^*]+?)\*\*/g,'<span class="mq-hl">$1</span>').replace(/\n/g,'<br>'); }
  function px(who, face, kind){
    var P = window.MQ_PX || {}, w = WHO[who] ? who : 'lumi', k = kind || 'head';
    var f = (face && face !== 'base' && WHO[w].faces.indexOf(face) >= 0) ? '_' + face : '';
    return P[w + f + '_' + k] || P[w + '_' + k] || '';
  }
  function img(who, face, kind, w, h, cls){
    var W = WHO[who] || WHO.lumi;
    return '<img class="mq-px' + (cls ? ' ' + cls : '') + '" alt="' + esc(W.nm) + '" src="' + px(who, face, kind) + '"' + (w ? ' width="' + w + '"' : '') + (h ? ' height="' + h + '"' : '') + '>';
  }
  /* 그림(svg) — 선·글자만 허용 */
  function cleanSvg(v){
    var s = String(v || '').trim();
    if (!s || s.length > 20000) return '';
    if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return '';
    if (/<script|<foreignobject|<iframe|<image|<use|\bon[a-z]+\s*=|javascript:|href\s*=|<style|url\s*\(/i.test(s)) return '';
    return s;
  }
  /* 한 줄 다듬기 (붙여넣기·AI·서버에서 읽을 때) — 모르는 줄은 null */
  function norm(L){
    if (!L || typeof L !== 'object') return null;
    var t = String(L.t || L.type || (L.who ? 'say' : '')).toLowerCase();
    if (t === 'say' || t === 'line' || t === 'talk'){
      var w = WHO[L.who] ? L.who : 'lumi', f = String(L.face || 'base');
      if (WHO[w].faces.indexOf(f) < 0) f = 'base';
      return { t:'say', who:w, face:f, text:String(L.text == null ? '' : L.text) };
    }
    if (t === 'card'){
      var c = { t:'card', title:String(L.title == null ? '' : L.title), body:String(L.body == null ? '' : L.body) }, sv = cleanSvg(L.svg);
      if (sv) c.svg = sv; return c;
    }
    if (t === 'quiz' || t === 'q'){
      var ch = (Array.isArray(L.choices) ? L.choices : []).map(function(x){ return String(x == null ? '' : x); }).slice(0, 5);
      while (ch.length < 2) ch.push('');
      var a = Number(L.answer); if (!(a >= 0 && a < ch.length)) a = 0;
      return { t:'quiz', q:String(L.q == null ? (L.text || '') : L.q), choices:ch, answer:Math.floor(a), src:String(L.src == null ? '' : L.src) };
    }
    if (t === 'point') return { t:'point', text:String(L.text == null ? '' : L.text) };
    return null;
  }
  /* 붙여넣은 글 → { ok, lines, meta, err } — [..] 또는 {lines:[..], title, unit, grade, scope} · ```json 울타리도 됨 */
  function parse(text){
    var s = String(text || '').replace(/```json|```/g, '').trim(), v = null;
    if (!s) return { ok:false, err:'붙여 넣은 글이 없어요' };
    try { v = JSON.parse(s); } catch(e){
      var a = s.indexOf('{'), b = s.lastIndexOf('}'), c = s.indexOf('['), d = s.lastIndexOf(']');
      try { if (c >= 0 && (a < 0 || c < a)) v = JSON.parse(s.slice(c, d + 1)); else if (a >= 0) v = JSON.parse(s.slice(a, b + 1)); } catch(e2){ return { ok:false, err:'JSON 모양이 아니에요: ' + e2.message }; }
    }
    var arr = Array.isArray(v) ? v : (v && Array.isArray(v.lines) ? v.lines : null);
    if (!arr) return { ok:false, err:'lines 목록을 찾지 못했어요' };
    var out = [], skip = 0;
    arr.forEach(function(L){ var n = norm(L); if (n) out.push(n); else skip++; });
    if (!out.length) return { ok:false, err:'쓸 수 있는 줄이 없어요' };
    var meta = {};
    if (v && !Array.isArray(v)) ['title','unit','grade','scope'].forEach(function(k){ if (v[k]) meta[k] = String(v[k]); });
    return { ok:true, lines:out, meta:meta, skip:skip };
  }
  /* 읽어 주기용 글 — 기호를 말로 */
  function plain(s){
    return String(s || '').replace(/\*\*/g, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, ' ').replace(/[☀-➿️]/g, ' ')
      .replace(/∠/g, '각 ').replace(/∥/g, ' 평행 ').replace(/°/g, '도').replace(/≡/g, ' 합동 ').replace(/△/g, '삼각형 ').replace(/×/g, ' 곱하기 ').replace(/÷/g, ' 나누기 ')
      .replace(/≠/g, ' 같지 않다 ').replace(/≤/g, ' 작거나 같다 ').replace(/≥/g, ' 크거나 같다 ').replace(/→/g, ', ').replace(/[«»「」·]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lineSpeech(L){
    if (!L) return '';
    if (L.t === 'say') return plain(L.text);
    if (L.t === 'card') return plain(L.title + '. ' + L.body);
    if (L.t === 'quiz') return plain(L.q);
    if (L.t === 'point') return plain('정수쌤의 아하 포인트. ' + L.text);
    return '';
  }
  /* 🔊 기기 음성 (ko-KR) — 캐릭터마다 목소리 높이만 조금 다르게 */
  function speak(L){
    try {
      var ss = window.speechSynthesis; if (!ss || typeof SpeechSynthesisUtterance === 'undefined') return false;
      var txt = lineSpeech(L); if (!txt) return false;
      ss.cancel();
      var u = new SpeechSynthesisUtterance(txt), W = (L && L.t === 'say' && WHO[L.who]) ? WHO[L.who] : (L && L.t === 'point' ? WHO.ssam : WHO.lumi);
      u.lang = 'ko-KR'; u.pitch = W.pitch; u.rate = W.rate;
      try { var vs = ss.getVoices() || [], ko = vs.filter(function(v){ return /^ko/i.test(v.lang || ''); }); if (ko.length) u.voice = ko[0]; } catch(e){}
      ss.speak(u); return true;
    } catch(e){ return false; }
  }

  /* ── 한 줄 그리기 ──
   *  o.ans   : { 줄번호: {pick, ok} } (문제 답)
   *  o.pick  : 보기를 누르면 부를 함수 이름 (예 'mqsPick') — 없으면 누를 수 없음
   *  o.tts   : 🔊 단추가 부를 함수 이름 (예 'mqsSpeak')
   *  o.point : function(i) → 아하 포인트 아래 단추 html
   *  o.teacher : 원장님 미리보기 (문제 출처 보임) */
  function line(L, i, o){
    o = o || {}; if (!L) return '';
    var ttsB = o.tts ? '<button type="button" class="mq-tts" onclick="' + o.tts + '(' + i + ')" aria-label="읽어 주기">🔊</button>' : '';
    if (L.t === 'say'){
      var W = WHO[L.who] || WHO.lumi, fx = (L.who === 'aha' && L.face === 'aha'), tx = hl(L.text);
      if (fx && !/^\s*💡/.test(L.text || '')) tx = '💡 ' + tx;
      return '<div class="mq-msg mq-w-' + esc(L.who) + (fx ? ' mq-ahafx' : '') + '" data-i="' + i + '">'
        + '<div class="mq-av" style="background:' + W.bg + ';border-color:' + W.bd + '">' + img(L.who, L.face, 'head') + '</div>'
        + '<div class="mq-bub"><span class="mq-nm">' + esc(W.nm) + '</span>' + ttsB + tx + '</div></div>';
    }
    if (L.t === 'card'){
      var sv = cleanSvg(L.svg);
      return '<div class="mq-card" data-i="' + i + '">' + ttsB + '<h4>' + hl(L.title) + '</h4>' + (sv ? '<div class="mq-svg">' + sv + '</div>' : '') + (L.body ? '<div class="mq-cbody">' + hl(L.body) + '</div>' : '') + '</div>';
    }
    if (L.t === 'quiz'){
      var a = (o.ans || {})[i], ch = (L.choices || []).filter(function(x){ return String(x).trim() !== ''; }), h = '';
      ch.forEach(function(c, k){
        var cls = 'mq-opt';
        if (a){ if (k === L.answer) cls += ' ok'; else if (k === a.pick) cls += ' no'; else cls += ' dim'; }
        var on = (!a && o.pick) ? ' onclick="' + o.pick + '(' + i + ',' + k + ')"' : '';
        h += '<button type="button" class="' + cls + '"' + on + (a || !o.pick ? ' tabindex="-1"' : '') + '>' + hl(c) + (a && k === L.answer ? ' ✓' : '') + '</button>';
      });
      var fb = '';
      if (a) fb = a.ok ? '<div class="mq-fb ok">정답! 👏 잘했어요</div>' : '<div class="mq-fb no">아쉬워요 — 정답은 <b>' + hl(ch[L.answer] || '') + '</b></div>';
      var srcN = o.teacher ? (L.src ? '<small class="mq-src">출처(원장님만): ' + esc(L.src) + '</small>' : '') : (L.src ? '<small class="mq-src">(교재 예제 숫자만 바꿈)</small>' : '');
      return '<div class="mq-quiz' + (a ? ' done' : '') + '" data-i="' + i + '">' + ttsB + '<h4>✋ 직접 해 볼래? ' + srcN + '</h4><div class="mq-q">' + hl(L.q) + '</div><div class="mq-opts' + (ch.length > 2 ? ' n' + ch.length : '') + '">' + h + '</div>' + fb + '</div>';
    }
    if (L.t === 'point'){
      return '<div class="mq-point" data-i="' + i + '">' + ttsB + '<div class="mq-ph">' + img('ssam', 'base', 'head', 34, 28) + '📌 <b>정수쌤의 아하 포인트</b></div><div class="mq-pt">' + hl(L.text) + '</div>' + (typeof o.point === 'function' ? o.point(i) : '') + '</div>';
    }
    return '';
  }
  function lines(arr, o){
    o = o || {}; var h = '', n = (arr || []).length, up = (o.upto == null) ? n - 1 : Math.min(n - 1, o.upto);
    for (var i = 0; i <= up; i++) h += line(arr[i], i, o);
    return h;
  }
  /* 등장인물 세 명 (전신) */
  function cast(sz){
    var w = sz || 84, h = Math.round(w * 96 / 72), out = '<div class="mq-cast">';
    ORDER.forEach(function(k){ var W = WHO[k]; out += '<div>' + img(k, k === 'aha' ? 'aha' : 'base', 'full', w, h) + '<b>' + esc(W.nm) + '</b><small>' + esc(W.role) + '</small></div>'; });
    return out + '</div>';
  }

  /* ── 학년 ── 「중학교 1학년」·「중1」 → '중1' · 학기: 3~7월 1학기, 8~2월 2학기 */
  function gradeKey(g){ var t = String(g || ''); var lv = /고/.test(t) ? '고' : (/초/.test(t) ? '초' : '중'); var n = (t.match(/(\d)/) || [])[1] || ''; return n ? lv + n : ''; }
  function semNow(d){ var m = (d || new Date()).getMonth() + 1; return (m >= 3 && m <= 7) ? 1 : 2; }
  function myGrade(g, d){ var k = gradeKey(g); return k ? k + '-' + semNow(d) : ''; }
  /* 단원 순서 (Ⅰ-3 < Ⅱ-1 · 로마 숫자 · 아라비아 숫자) */
  function unitRank(u){
    var R = { 'Ⅰ':1,'Ⅱ':2,'Ⅲ':3,'Ⅳ':4,'Ⅴ':5,'Ⅵ':6,'Ⅶ':7,'Ⅷ':8,'Ⅸ':9,'Ⅹ':10, 'I':1,'II':2,'III':3,'IV':4,'V':5,'VI':6 };
    var s = String(u || ''), m = s.match(/^\s*([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]|[IV]+|\d+)\s*[-.]?\s*(\d+)?/), a = 99, b = 0;
    if (m){ a = R[m[1]] || Number(m[1]) || 99; b = Number(m[2] || 0); }
    return a * 100 + b;
  }

  /* ── 예시 (시안 그대로: Ⅰ-3 동위각과 엇각) ── */
  var SVG_FZ = '<svg viewBox="0 0 300 112" xmlns="http://www.w3.org/2000/svg">'
    + '<g><line x1="8" y1="28" x2="132" y2="28" stroke="#0f172a" stroke-width="2"/><line x1="8" y1="70" x2="132" y2="70" stroke="#0f172a" stroke-width="2"/><line x1="44" y1="92" x2="96" y2="4" stroke="#0f172a" stroke-width="2"/>'
    + '<path d="M89,28 A13,13 0 0 0 82,17" stroke="#f97316" stroke-width="3" fill="none"/><path d="M64,70 A13,13 0 0 0 57,59" stroke="#f97316" stroke-width="3" fill="none"/>'
    + '<text x="120" y="24" font-size="11" font-weight="700">l</text><text x="120" y="66" font-size="11" font-weight="700">m</text><text x="96" y="22" font-size="10" fill="#c2410c" font-weight="800">70°</text><text x="70" y="64" font-size="10" fill="#c2410c" font-weight="800">70°</text>'
    + '<text x="70" y="108" font-size="11" font-weight="800" text-anchor="middle" fill="#15803d">l ∥ m → 같다 ✓</text></g>'
    + '<g transform="translate(160,0)"><line x1="8" y1="28" x2="132" y2="20" stroke="#0f172a" stroke-width="2"/><line x1="8" y1="70" x2="132" y2="82" stroke="#0f172a" stroke-width="2"/><line x1="44" y1="92" x2="96" y2="4" stroke="#0f172a" stroke-width="2"/>'
    + '<path d="M89,24 A13,13 0 0 0 82,16" stroke="#f97316" stroke-width="3" fill="none"/><path d="M64,72 A13,13 0 0 0 57,61" stroke="#94a3b8" stroke-width="3" fill="none"/>'
    + '<text x="96" y="18" font-size="10" fill="#c2410c" font-weight="800">70°</text><text x="70" y="66" font-size="10" fill="#64748b" font-weight="800">?</text>'
    + '<text x="70" y="108" font-size="11" font-weight="800" text-anchor="middle" fill="#dc2626">평행 ✕ → 다를 수 있다</text></g></svg>';
  function sample(){
    return { title:'동위각과 엇각', grade:'중1-2', unit:'Ⅰ-3', scope:'옥길중 2학기 기말', mats:[], lines:[
      { t:'say', who:'lumi', face:'base', text:'두 직선이 다른 한 직선과 만나면 각이 8개 생겨. 그중 **같은 자리**에 있는 각이 **동위각**(同位角)이야.' },
      { t:'say', who:'aha', face:'base', text:'알아! 동위각은 크기가 같잖아. 그러니까 ∠a = 70°면 ∠b도 무조건 70°!' },
      { t:'say', who:'lumi', face:'oops', text:'앗, 시험 단골 함정! 크기가 같은 건 **두 직선이 평행할 때만**이야.' },
      { t:'say', who:'lumi', face:'base', text:'서로 엇갈린 자리에 있는 각은 **엇각**이야. 동위각은 **F자**, 엇각은 **Z자** 모양으로 찾으면 쉬워.' },
      { t:'card', title:'① 동위각 = F자 · 엇각 = Z자 — 평행일 때만 같다', body:'l ∥ m 이면 동위각·엇각의 크기가 **같다**. 평행이 아니면 **다를 수 있다**.', svg:SVG_FZ },
      { t:'quiz', q:'l ∥ m, 엇각 하나가 65°일 때 ∠x = ?', choices:['65°','115°'], answer:0, src:'쎈 중1-2 p.19 #4 숫자 바꿈' },
      { t:'say', who:'aha', face:'aha', text:'💡 **아하!** 평행 표시(∥)부터 봐야 하는구나. 엇각은 Z자!' },
      { t:'point', text:'동위각 **F자**, 엇각 **Z자**. 그림에 **∥ 표시**가 있는지 먼저! 시험엔 평행이 아닌 그림이 함정으로 나와요.' }
    ] };
  }
  function sampleWords(){
    return { days:[ { n:1, words:[
      { w:'동위각', hanja:'同位角', hj:'同 같을 동 · 位 자리 위 · 角 뿔 각', mean:'두 직선이 한 직선과 만날 때 같은 위치에 있는 두 각', say:'«같은(同) 자리(位)»의 각! 모양은 F자.', ex:'«l ∥ m 이면 동위각의 크기는 서로 같다»', unit:'Ⅰ-3', who:'lumi' },
      { w:'합동', hanja:'合同', hj:'合 합할 합 · 同 한가지 동', mean:'모양과 크기가 같아 완전히 포개어지는 두 도형', say:'합쳐(合) 보면 똑같다(同)! 기호는 ≡', ex:'«△ABC ≡ △DEF 이면 대응변의 길이가 같다»', unit:'Ⅰ-4', who:'aha' },
      { w:'현', hanja:'弦', hj:'弦 활시위 현', mean:'원 위의 두 점을 이은 선분', say:'호(弧)가 «활», 현(弦)은 «활시위». 같이 외우면 안 헷갈려요.', ex:'«원에서 길이가 가장 긴 현은 지름이다»', unit:'Ⅱ-2', who:'ssam' }
    ] } ] };
  }
  /* 낱말 카드 (학생앱·학원앱 공용) — o.btns = function(w) → html */
  function word(W, idx, o){
    o = o || {}; var who = WHO[W.who] ? W.who : ORDER[idx % 3];
    return '<div class="mq-word" data-w="' + esc(W.w) + '"><div class="mq-wt"><b>' + esc(W.w) + '</b>' + (W.hanja ? '<span class="hj">' + esc(W.hanja) + '</span>' : '') + (W.hj ? '<span class="hjs">' + esc(W.hj) + '</span>' : '') + (W.unit ? '<span class="tag">' + esc(W.unit) + '</span>' : '') + '</div>'
      + (W.mean ? '<div class="mq-wm">' + hl(W.mean) + '</div>' : '')
      + (W.say ? '<div class="mq-wc">' + img(who, 'base', 'head', 28, 23) + '<span>' + hl(W.say) + '</span></div>' : '')
      + (W.ex ? '<div class="mq-wx">' + hl(W.ex) + '</div>' : '')
      + (typeof o.btns === 'function' ? o.btns(W) : '') + '</div>';
  }

  var CSS = ''
    + '.mq-px{image-rendering:pixelated;image-rendering:crisp-edges;display:block;flex:0 0 auto}'
    + '.mq-hl{color:#c2410c;font-weight:900}'
    + '.mq-msg{display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;animation:mqIn .25s ease-out}'
    + '.mq-av{width:52px;height:46px;border-radius:13px;border:2px solid #e2e8f0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;flex:0 0 auto}'
    + '.mq-av .mq-px{width:48px;height:39px}'
    + '.mq-bub{position:relative;flex:1;min-width:0;background:#fff;border:1.5px solid #e2e8f0;border-radius:4px 16px 16px 16px;padding:8px 32px 9px 11px;line-height:1.6;font-size:14px;color:#0f172a;word-break:keep-all;overflow-wrap:anywhere}'
    + '.mq-nm{display:block;font-size:11px;font-weight:900;color:#64748b;margin-bottom:1px}'
    + '.mq-tts{position:absolute;right:6px;top:5px;border:none;background:none;font-size:13px;opacity:.65;cursor:pointer;padding:2px 3px;line-height:1}'
    + '.mq-ahafx .mq-bub{background:#fffbeb;border-color:#fcd34d;box-shadow:0 0 0 3px rgba(252,211,77,.25)}'
    + '.mq-card{position:relative;background:#ecfdf5;border:1.5px solid #a7f3d0;border-radius:16px;padding:10px 12px;margin:0 0 10px 30px;animation:mqIn .25s ease-out}'
    + '.mq-card h4{margin:0 0 6px;font-size:13.5px;color:#047857;padding-right:22px;line-height:1.45}'
    + '.mq-svg{background:#fff;border-radius:12px;padding:6px;margin-bottom:6px}.mq-svg svg{display:block;width:100%;height:auto}'
    + '.mq-cbody{font-size:13px;line-height:1.6;color:#064e3b}'
    + '.mq-quiz{position:relative;background:#fff;border:2px solid #fde68a;border-radius:16px;padding:10px 12px;margin:0 0 10px;animation:mqIn .25s ease-out}'
    + '.mq-quiz h4{margin:0 0 4px;font-size:13.5px;padding-right:22px}.mq-src{color:#64748b;font-weight:700;font-size:11px}'
    + '.mq-q{font-family:"Times New Roman",serif;font-size:17px;font-weight:900;text-align:center;margin:6px 0 9px;line-height:1.5;overflow-wrap:anywhere}'
    + '.mq-opts{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mq-opts.n3{grid-template-columns:1fr 1fr 1fr}'
    + '.mq-opt{border:2px solid #e2e8f0;border-radius:11px;padding:10px 6px;text-align:center;font-weight:900;font-family:"Times New Roman",serif;font-size:15px;background:#fff;color:#0f172a;cursor:pointer;min-height:44px;overflow-wrap:anywhere}'
    + '.mq-opt.ok{border-color:#22c55e;background:#dcfce7;color:#15803d}.mq-opt.no{border-color:#fecaca;color:#94a3b8;text-decoration:line-through}.mq-opt.dim{color:#94a3b8}'
    + '.mq-fb{margin-top:8px;font-weight:900;font-size:13px;text-align:center}.mq-fb.ok{color:#15803d}.mq-fb.no{color:#dc2626}'
    + '.mq-point{position:relative;background:#0d2240;color:#fff;border-radius:16px;padding:10px 13px;margin:0 0 10px;line-height:1.6;animation:mqIn .25s ease-out}'
    + '.mq-point .mq-ph{display:flex;align-items:center;gap:6px;font-size:13px}.mq-point .mq-ph .mq-px{background:#e0e7ff;border-radius:8px}'
    + '.mq-point b{color:#fbbf24}.mq-point .mq-hl{color:#fbbf24}.mq-point .mq-pt{font-size:13.5px;margin-top:4px}.mq-point .mq-tts{color:#fff}'
    + '.mq-pbtns{display:flex;gap:6px;margin-top:9px}.mq-pbtns button{flex:1;border:none;border-radius:10px;padding:9px;font-weight:900;font-size:12.5px;background:#fff;color:#0d2240;cursor:pointer;font-family:inherit}.mq-pbtns button.done{background:#dcfce7;color:#15803d}'
    + '.mq-cast{display:flex;justify-content:space-around;align-items:flex-end;background:linear-gradient(180deg,#fff7e6,#ffe9cc);border-radius:18px;padding:10px 4px 6px;margin-bottom:10px}'
    + '.mq-cast>div{display:flex;flex-direction:column;align-items:center;text-align:center;white-space:nowrap;font-size:12.5px}.mq-cast small{display:block;color:#64748b;font-weight:700;font-size:10.5px}'
    + '.mq-word{background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;padding:10px 12px;margin-bottom:8px}'
    + '.mq-wt{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}.mq-wt b{font-size:17px}.mq-wt .hj{font-size:14px;color:#334155;font-weight:700}.mq-wt .hjs{font-size:11px;color:#64748b}'
    + '.mq-wt .tag{font-size:10.5px;font-weight:900;background:#f1f5f9;border-radius:5px;padding:1px 6px;color:#475569;margin-left:auto}'
    + '.mq-wm{font-weight:800;margin:3px 0;font-size:13.5px}.mq-wc{display:flex;gap:6px;align-items:center;font-size:12.5px;color:#0f766e;font-weight:700}'
    + '.mq-wx{font-size:12px;color:#64748b;margin-top:3px}'
    + '@keyframes mqIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}';

  return { WHO:WHO, ORDER:ORDER, FACE_NM:FACE_NM, TYPE_NM:TYPE_NM, esc:esc, hl:hl, px:px, img:img, cleanSvg:cleanSvg, norm:norm, parse:parse,
    plain:plain, lineSpeech:lineSpeech, speak:speak, line:line, lines:lines, cast:cast, word:word,
    gradeKey:gradeKey, semNow:semNow, myGrade:myGrade, unitRank:unitRank, sample:sample, sampleWords:sampleWords, CSS:CSS };
})();
window.MQR = MQR;
function mqrCss(id){ try { if (document.getElementById(id || 'mqr-css')) return; var s = document.createElement('style'); s.id = id || 'mqr-css'; s.textContent = MQR.CSS; document.head.appendChild(s); } catch(e){} }
