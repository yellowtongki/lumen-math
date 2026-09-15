/* ══════════════════════════════════════════════════════════════════════
 * 교재 채점 엔진 (2판) — 학생앱·수집기 공용
 *   매쓰플랫 교재 정답을 정규화해 학생 입력과 대조한다.
 *
 *   ★ 절대 불변식: 「정답 원문을 그대로 넣으면 반드시 correct:true」 (오채점 0)
 *   ★ 조금이라도 못 읽는 답은 gradable:false(self:true) → 학생 자기채점으로 보낸다.
 *
 *   읽는 답 모양(shape)
 *     num   숫자·분수·비  (2,2,10 / \frac{1}{2} / -0.8 / ±8 / 2:3)
 *     unit  숫자+단위      (20˚ / 8 cm / 24㎤ / 20π㎠ / 25%)
 *     ox    O·X
 *     word  낱말          (약수 / 예 / 정구각형 / 80점 이상 90점 미만)
 *     mark  보기기호      (ㄱ,ㄹ / (1),(3) / ①,③ / ㉠)
 *     labeled 이름표 칸   (교점: 8, 교선: 12 / l: 6π cm, S: 9π ㎠ / a=2,b=4)
 *     eq    식            (x=14 / \frac{360˚}{9}=40˚) — 마지막 = 뒤 값만 본다
 *     geo   도형기호      (\overline{AB} / ∠AOE / △ABD≡△CDB / 점 D)
 *     alg   문자식        (-ab / 2x+3 / 2^4×3^2 / (8π-16))
 *     ineq  부등식        (a≥-4 / -5<c≤6)
 *     coord 좌표          ((3,6) / A(3,6),B(-4,-3))
 *     essay 서술형        (정답 글자가 없음) → 자기채점
 *     free  못 읽음                          → 자기채점
 *
 *   공개 API
 *     HWGrade.isGradable(answerRaw)        정답을 엔진이 읽을 수 있나
 *     HWGrade.grade(correctRaw, studentRaw)  → { gradable, correct }
 *     HWGrade.unitOf(answerRaw)            칸 옆에 보여 줄 단위 ("72 cm³" → "cm³")
 *     HWGrade.shapeOf(problem)             → { shape, self, gradable, unit, parts }
 *     HWGrade.normalize(raw, shape)        정리된 문자열(디버그·표시용)
 *
 *   이 파일은 Node(수집기)와 브라우저(학생앱) 양쪽에서 쓴다.
 *   브라우저에서는 <script>로 인라인 복사해 넣는다(단일 HTML 원칙).
 *   → 그래서 ES5 문법(var·function)만 쓰고 바깥 라이브러리를 쓰지 않는다.
 * ════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ── 0. 자잘한 도우미 ───────────────────────────────────────────── */
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function has(s, sub) { return String(s).indexOf(sub) >= 0; }

  /* 괄호·중괄호 깊이를 지키며 한 글자로 쪼갠다 ("A(3,6),B(1,2)" 는 콤마 2개가 아니라 1개) */
  function splitTop(s, sep) { return splitTopMulti(s, sep); }
  /* 위와 같되 쪼갤 글자를 여러 개 줄 수 있다. 초등 교재는 작은 문제들의 답을
     「3, 5 / 7, 9」 처럼 빗금으로 이어 붙여 놓아서 ',' 와 '/' 를 함께 쪼갠다. */
  function splitTopMulti(s, seps) {
    var out = [], buf = '', d = 0, i, c;
    s = String(s); seps = String(seps);
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '(' || c === '{' || c === '[') d++;
      else if (c === ')' || c === '}' || c === ']') { d--; if (d < 0) d = 0; }
      else if (d === 0 && seps.indexOf(c) >= 0) { out.push(buf); buf = ''; continue; }
      buf += c;
    }
    out.push(buf);
    return out;
  }
  /* 「또는」처럼 낱말을 기준으로 쪼갠다 (괄호 안에 든 「또는」은 건드리지 않는다) */
  function splitTopWord(s, word) {
    var out = [], buf = '', d = 0, i, c;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '(' || c === '{' || c === '[') d++;
      else if (c === ')' || c === '}' || c === ']') { d--; if (d < 0) d = 0; }
      else if (d === 0 && s.substr(i, word.length) === word) {
        out.push(buf); buf = ''; i += word.length - 1; continue;
      }
      buf += c;
    }
    out.push(buf);
    return out;
  }
  /* 문자열 전체를 감싸는 바깥 괄호 한 겹 벗기기 : "(8π-16)" → "8π-16" */
  function peel(s) {
    var t = trim(s), d, i, c;
    while (t.length > 1 && t.charAt(0) === '(' && t.charAt(t.length - 1) === ')') {
      d = 0;
      for (i = 0; i < t.length; i++) {
        c = t.charAt(i);
        if (c === '(') d++; else if (c === ')') { d--; if (d === 0 && i < t.length - 1) return t; }
      }
      if (d !== 0) return t;
      t = trim(t.substring(1, t.length - 1));
    }
    return t;
  }

  /* ── 1. LaTeX·특수문자 정리 ─────────────────────────────────────── */
  function unlatex(s) {
    var t = String(s == null ? '' : s);
    // \text{ cm} \mathrm{...} 속 글자는 살린다 (단위가 들어 있다)
    t = t.replace(/\\(?:text|textrm|mathrm|mathit|mbox|operatorname)\s*\{([^{}]*)\}/g, ' $1 ');
    t = t.replace(/\\(?:left|right|bigl|bigr|big|Big|bigg|Bigg)(?![a-zA-Z])/g, '');
    t = t.replace(/\\[;,!:>]/g, ' ');                 // \; \, \! \: — LaTeX 공백
    t = t.replace(/\\(?:quad|qquad|space|thinspace)(?![a-zA-Z])/g, ' ');
    t = t.replace(/\\ /g, ' ');                        // 역슬래시+공백
    t = t.replace(/\\hspace\s*\{[^{}]*\}/g, ' ');
    t = t.replace(/\\%/g, '%').replace(/\\\$/g, '$').replace(/\$/g, '');
    var MAP = [
      [/\\pm(?![a-zA-Z])/g, '±'], [/\\mp(?![a-zA-Z])/g, '±'],
      [/\\times(?![a-zA-Z])/g, '×'], [/\\cdot(?![a-zA-Z])/g, '×'], [/\\div(?![a-zA-Z])/g, '÷'],
      [/\\leq?(?![a-zA-Z])/g, '≤'], [/\\geq?(?![a-zA-Z])/g, '≥'],
      [/\\neq?(?![a-zA-Z])/g, '≠'], [/\\approx(?![a-zA-Z])/g, '≒'],
      [/\\pi(?![a-zA-Z])/g, 'π'], [/\\angle(?![a-zA-Z])/g, '∠'],
      [/\\triangle(?![a-zA-Z])/g, '△'], [/\\square(?![a-zA-Z])/g, '□'],
      [/\\equiv(?![a-zA-Z])/g, '≡'], [/\\sim(?![a-zA-Z])/g, '∽'],
      [/\\perp(?![a-zA-Z])/g, '⊥'], [/\\parallel(?![a-zA-Z])/g, '∥'],
      [/\\(?:rightarrow|longrightarrow|to)(?![a-zA-Z])/g, '→'],
      [/\\(?:circ|degree)(?![a-zA-Z])/g, '°'],
      [/\\bigcirc(?![a-zA-Z])/g, '○'], [/\\(?:bigstar|star)(?![a-zA-Z])/g, '☆'],
      [/\\(?:Diamond|diamond|lozenge)(?![a-zA-Z])/g, '◇'],
      [/\\(?:cdots|ldots|dots)(?![a-zA-Z])/g, '…']
    ];
    for (var i = 0; i < MAP.length; i++) t = t.replace(MAP[i][0], MAP[i][1]);
    // 각도 위첨자 40^{\circ} · 40^° → 40°  (초등 교재가 이 꼴로 준다)
    t = t.replace(/\^\s*\{\s*°\s*\}/g, '°').replace(/\^\s*°/g, '°');
    // 중괄호로 감싼 표시 글자 {○} → ○
    t = t.replace(/\{\s*([○◯〇△▲□■☆✓×])\s*\}/g, '$1');
    // 「210 \text{ cm}^2」 → 「210 cm^2」 (단위와 제곱 사이가 벌어진 것)
    t = t.replace(/\s+\^/g, '^').replace(/\^\s*\{\s*(\d)\s*\}/g, '^$1');
    // 줄바꿈은 칸 구분으로
    t = t.replace(/[\r\n]+/g, ',');
    // 낱글자 흉내 낸 따옴표 찌꺼기
    t = t.replace(/[｀´]/g, '');
    // 표 모양으로 적은 칸 (\begin{matrix} [~] \ [○] \end{matrix})
    t = t.replace(/\\(?:begin|end)\s*\{\s*[a-zA-Z*]+\s*\}/g, ' ').replace(/\[\s*~\s*\]/g, '[ ]');
    // 전각·비슷한 글자 통일
    t = t.replace(/[＋]/g, '+').replace(/[－−–—ー]/g, '-').replace(/[＝]/g, '=')
         .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[，、]/g, ',')
         .replace(/[％]/g, '%').replace(/[／]/g, '/').replace(/[：]/g, ':')
         .replace(/[；]/g, ',')
         .replace(/[＜]/g, '<').replace(/[＞]/g, '>').replace(/[＊]/g, '*')
         .replace(/[˚º∘⁰]/g, '°').replace(/[·․]/g, '·');
    return trim(t.replace(/\s+/g, ' '));
  }

  /* ── 2. 단위 ──────────────────────────────────────────────────── */
  // 값 뒤에 붙는 단위 글자들. (「각」「도」「형」처럼 낱말 꼬리와 헷갈리는 글자는 뺐다)
  var UNIT_LIST = ['㎠', '㎟', '㎡', '㎢', '㎤', '㎥', '㎣', '㎝', '㎜', '㎞', '㎖', '㎘', '㎏', '㎎', '℃', '°', '%',
    'cm^2', 'cm^3', 'm^2', 'm^3', 'mm^2', 'mm^3', 'km^2',
    'cm²', 'cm³', 'm²', 'm³', 'cm2', 'cm3',
    'cm', 'mm', 'km', 'kg', 'mg', 'mL', 'ml', 'kL', 'm', 'g', 'L', 't',
    '시간', '분', '초', '일', '주일', '주', '개월', '달', '년', '개', '명', '원', '번', '회', '점', '장', '권', '살',
    '층', '칸', '마리', '송이', '그루', '줄', '바퀴', '배', '가지', '자리', '병', '상자', '판', '쪽', '호', '벌', '켤레',
    '컵', '봉지', '통', '대', '그릇', '조각', '도막', '묶음', '자루', '척', '이닝', '모둠', '접시', '인분', '걸음', '알', '포기', '단'];
  var TAIL_UNIT_RE = new RegExp('^([\\s\\S]*?)\\s*(' + UNIT_LIST.join('|') + ')$');
  var UNIT_CANON = { '㎠': 'cm2', 'cm²': 'cm2', 'cm2': 'cm2', 'cm^2': 'cm2',
    '㎤': 'cm3', 'cm³': 'cm3', 'cm3': 'cm3', 'cm^3': 'cm3',
    'm^2': 'm2', 'm^3': 'm3', 'mm^2': 'mm2', 'mm^3': 'mm3', 'km^2': 'km2',
    '㎡': 'm2', 'm²': 'm2', 'm2': 'm2', '㎥': 'm3', 'm³': 'm3', 'm3': 'm3', '㎟': 'mm2', '㎣': 'mm3',
    '㎝': 'cm', '㎜': 'mm', '㎞': 'km', '㎖': 'mL', 'ml': 'mL', '㎘': 'kL', '㎏': 'kg', '㎎': 'mg', '℃': '°C' };
  function canonUnit(u) { u = trim(u); return UNIT_CANON[u] || u; }

  /* 단위 「낱말 자체」가 답인 초등 문항 (값 없이 ㎢ · cm 처럼 단위만 쓴다) */
  var UNIT_ONLY = {};
  (function () {
    var L = ['㎠', '㎟', '㎡', '㎢', '㎤', '㎥', '㎣', '㎝', '㎜', '㎞', '㎖', '㎘', '㎏', '㎎',
      'cm', 'mm', 'km', 'm', 'g', 'kg', 'mg', 't', 'L', 'mL', 'kL', 'cm²', 'cm³', 'm²', 'm³', '℃'];
    for (var i = 0; i < L.length; i++) UNIT_ONLY[L[i]] = 1;
  })();

  /* 같은 종류끼리 바꿔 잴 수 있는 단위표 — [무엇의 단위인가, 가장 작은 단위로 몇 배인가]
     초등은 「3m 20cm」 「1kg 300g」 「3시 20분」 처럼 두 단위를 함께 쓴다.
     둘 다 가장 작은 단위로 바꿔 견주면 「320cm」와 「3m 20cm」를 같은 답으로 본다. */
  var MIX_FAM = {
    '시간': ['TIME', 3600], '시': ['TIME', 3600], '분': ['TIME', 60], '초': ['TIME', 1],
    'km': ['LEN', 1000000], '㎞': ['LEN', 1000000], 'm': ['LEN', 1000],
    'cm': ['LEN', 10], '㎝': ['LEN', 10], 'mm': ['LEN', 1], '㎜': ['LEN', 1],
    't': ['MASS', 1000000], 'kg': ['MASS', 1000], '㎏': ['MASS', 1000],
    'g': ['MASS', 1], 'mg': ['MASS', 0.001], '㎎': ['MASS', 0.001],
    'kL': ['VOL', 1000000], '㎘': ['VOL', 1000000], 'L': ['VOL', 1000],
    'dL': ['VOL', 100], 'mL': ['VOL', 1], '㎖': ['VOL', 1], 'ml': ['VOL', 1]
  };
  var MIX_BASE = { TIME: '초', LEN: 'mm', MASS: 'g', VOL: 'mL' };
  var MIX_RE = new RegExp('(-?\\d+(?:\\.\\d+)?)\\s*(시간|시|분|초|㎞|km|㎝|cm|㎜|mm|㎏|kg|㎎|mg|㎘|kL|dL|㎖|mL|ml|L|t|m|g)', 'g');
  function fixnum(x) { return String(Math.round(x * 1e6) / 1e6); }
  /* 값+단위 하나를 「가장 작은 단위로 바꾼 값」 열쇠로 (없으면 null) */
  function baseKey(valKey, unit) {
    var f = MIX_FAM[trim(unit)];
    if (!f) return null;
    var num = null, m = String(valKey).match(/^(-?\d+)\/(\d+)$/);
    if (m) num = Number(m[1]) / Number(m[2]);
    else if (/^-?\d+(\.\d+)?$/.test(String(valKey))) num = Number(valKey);
    if (num == null || !isFinite(num)) return null;
    return '≈' + fixnum(num * f[1]) + MIX_BASE[f[0]];
  }
  /* 「3m 20cm」 「3시 20분」 처럼 단위가 둘 이상 이어진 답 읽기 */
  function readMix(s0) {
    var s = trim(s0), m, items = [], last = 0, fam = null;
    MIX_RE.lastIndex = 0;
    while ((m = MIX_RE.exec(s))) {
      if (trim(s.substring(last, m.index)) !== '') return null;   // 사이에 딴 글자가 끼어 있다
      last = m.index + m[0].length;
      var f = MIX_FAM[m[2]];
      if (!f) return null;
      if (fam === null) fam = f[0]; else if (fam !== f[0]) return null;
      items.push({ v: Number(m[1]), u: m[2], f: f[1] });
    }
    if (items.length < 2 || trim(s.substring(last)) !== '') return null;
    var tot = 0, i;
    for (i = 0; i < items.length; i++) tot += items[i].v * items[i].f;
    return { fam: fam, key: '≈' + fixnum(tot) + MIX_BASE[fam], unit: items[items.length - 1].u,
      labels: items.map(function (x) { return x.u; }) };
  }

  /* 값 + 단위로 가른다. (단위인지 아닌지는 부르는 쪽에서 「남은 값이 읽히는가」로 다시 확인) */
  function splitUnit(s) {
    var t = trim(s), u = '', m, head, guard = 0;
    while (guard++ < 3) {
      m = t.match(TAIL_UNIT_RE);
      if (!m) break;
      head = trim(m[1]);
      if (!head) break;                                         // 값이 없으면 단위가 아니다
      if (/^[mgLt]$/.test(m[2]) && !/[\d)\s]$/.test(m[1])) break; // 한 글자 단위는 앞이 숫자일 때만
      u = m[2] + (u ? ' ' + u : '');
      t = head;
    }
    return { core: t, unit: u };
  }

  /* ── 3. 숫자(유리수·π·비) ──────────────────────────────────────── */
  function ratOf(n, d) { if (!d) return null; var g = gcd(n, d); var s = (d < 0 ? -1 : 1); return { n: s * n / g, d: Math.abs(d) / g }; }
  function decRat(str) {                    // "0.8" → {n:8,d:10}
    var m = String(str).match(/^(-?)(\d*)(?:\.(\d+))?$/);
    if (!m || (!m[2] && !m[3])) return null;
    var whole = m[2] || '0', dec = m[3] || '';
    var num = Number(whole + dec), den = Math.pow(10, dec.length);
    if (!isFinite(num)) return null;
    var r = ratOf(num, den); if (!r) return null;
    if (m[1] === '-') r.n = -r.n;
    return r;
  }
  function parseRat(s0) {
    var s = String(s0).replace(/\s+/g, ''), sign = 1, m, a, b, w;
    if (!s) return null;
    s = peel(s);
    while (/^[+-]/.test(s)) { if (s.charAt(0) === '-') sign = -sign; s = s.substring(1); }
    if (!s) return null;
    // 대분수 3\frac{1}{2}
    m = s.match(/^(\d+)\\[dt]?frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}$/);
    if (m) {
      w = decRat(m[1]); a = decRat(m[2]); b = decRat(m[3]);
      if (!w || !a || !b || !b.n) return null;
      var fr = ratOf(a.n * b.d, a.d * b.n); if (!fr) return null;
      var sum = ratOf(w.n * fr.d + fr.n * w.d, w.d * fr.d); if (!sum) return null;
      sum.n *= sign; return sum;
    }
    // \frac{a}{b}
    m = s.match(/^\\[dt]?frac\{(-?[\d.]+)\}\{(-?[\d.]+)\}$/) || s.match(/^(-?[\d.]+)\/(-?[\d.]+)$/);
    if (m) {
      a = decRat(m[1]); b = decRat(m[2]);
      if (!a || !b || !b.n) return null;
      var q = ratOf(a.n * b.d, a.d * b.n); if (!q) return null;
      q.n *= sign; return q;
    }
    // 그냥 숫자
    if (/^\.\d+$/.test(s)) s = '0' + s;
    if (/^\d+(\.\d+)?$/.test(s)) { var r = decRat(s); if (!r) return null; r.n *= sign; return r; }
    return null;
  }
  function ratKey(r) { return (r.d === 1 ? String(r.n) : r.n + '/' + r.d); }

  /* 「유리수(×π)」 또는 「a:b 비」만 읽는다. 못 읽으면 null */
  function parseNumeric(s0) {
    var s = String(s0).replace(/\s+/g, '');
    if (!s) return null;
    if (/[±∓]/.test(s)) return null;                 // ± 는 위에서 두 조각으로 펼친다
    if (/^\d+(?::\d+)+$/.test(s)) return s;          // 비 2:3
    var npi = (s.match(/π/g) || []).length, pi = '';
    if (npi > 1) return null;
    if (npi === 1) {
      pi = 'π'; s = s.replace(/π/g, '');
      if (s === '' || s === '+') s = '1'; else if (s === '-') s = '-1';
      s = s.replace(/×$/, '').replace(/^×/, '');
    }
    var r = parseRat(s);
    if (!r) return null;
    return ratKey(r) + pi;
  }

  /* ── 4. 문자식(alg) ───────────────────────────────────────────── */
  function unfrac(s) {
    var prev = null, guard = 0;
    while (prev !== s && guard++ < 20) { prev = s; s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)'); }
    return s;
  }
  function algPrep(s0) {
    var s = String(s0).replace(/\s+/g, '');
    // 분수·근호를 안쪽부터 차례로 푼다 (\frac{\sqrt{3}}{3} 처럼 겹친 경우 대비)
    var pv = null, gd = 0;
    while (pv !== s && gd++ < 20) {
      pv = s;
      s = s.replace(/\\sqrt\[3\]\s*\{([^{}]*)\}/g, '∛($1)');     // 세제곱근
      s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, '√($1)');          // 제곱근 √3
      s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
    }
    s = s.replace(/\^\{([^{}]*)\}/g, '^$1');
    var prev = null, guard = 0;
    while (prev !== s && guard++ < 10) { prev = s; s = s.replace(/\{([^{}]*)\}/g, '$1'); } // {2}^{4} → 2^4
    s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, function (c) { return '^' + '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c); });
    s = s.replace(/[×·*]/g, '*').replace(/÷/g, '/');
    return s;
  }
  /* 인자 하나에 씌워진 괄호 한 겹 벗기기 : "(+3)" → "3", "÷(+a)" → "÷a" */
  function peelTok(t) {
    var pre = '';
    t = String(t);
    if (t.charAt(0) === '÷') { pre = '÷'; t = t.substring(1); }
    var m = t.match(/^\(\+?([0-9A-Za-zπ√∛.]+)\)$/);
    if (m) t = m[1];
    return pre + t;
  }
  function readFactor(s, i) {
    var n = s.length, c = s.charAt(i), tok = '', d, j;
    if (c === '√' || c === '∛') {                      // 근호 — 뒤에 오는 인자를 통째로 묶는다
      var inr = readFactor(s, i + 1);
      if (!inr) return null;
      return { tok: c + peelTok(inr.tok), i: inr.i };                     // √(3) = √3
    }
    if (c === '(') {
      d = 0; j = i;
      for (; j < n; j++) { if (s.charAt(j) === '(') d++; else if (s.charAt(j) === ')') { d--; if (!d) break; } }
      if (j >= n) return null;
      var inner = normExpr(s.substring(i + 1, j));
      if (inner == null) return null;
      tok = '(' + inner + ')'; i = j + 1;
    } else if (/[0-9.]/.test(c)) {
      while (i < n && /[0-9.]/.test(s.charAt(i))) { tok += s.charAt(i); i++; }
    } else if (/[A-Za-zπ]/.test(c)) {
      tok = c; i++;
    } else return null;
    if (i < n && s.charAt(i) === '^') {                 // 지수
      i++;
      var ex = '';
      if (s.charAt(i) === '(') {
        d = 0; j = i;
        for (; j < n; j++) { if (s.charAt(j) === '(') d++; else if (s.charAt(j) === ')') { d--; if (!d) break; } }
        if (j >= n) return null;
        ex = s.substring(i + 1, j); i = j + 1;
      } else { while (i < n && /[0-9.\-]/.test(s.charAt(i))) { ex += s.charAt(i); i++; } }
      if (!ex) return null;
      tok += '^' + ex;
    }
    return { tok: tok, i: i };
  }
  function normTerm(body) {
    var s = body, i = 0, out = [], f;
    if (!s) return null;
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === '*') { i++; continue; }
      if (c === '/') { i++; f = readFactor(s, i); if (!f) return null; out.push('÷' + f.tok); i = f.i; continue; }
      f = readFactor(s, i); if (!f) return null; out.push(f.tok); i = f.i;
    }
    if (!out.length) return null;
    for (var q = 0; q < out.length; q++) out[q] = peelTok(out[q]);
    out = out.filter(function (x) { return x !== '1'; });   // 계수 1은 없는 셈
    if (!out.length) out = ['1'];
    out.sort();
    return out.join('*');
  }
  function normExpr(s0) {
    var s = String(s0), terms = [], sign = '+', buf = '', d = 0, i, c, prev;
    if (!s) return null;
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '(') d++; else if (c === ')') { d--; if (d < 0) return null; }
      prev = i > 0 ? s.charAt(i - 1) : '';
      if (d === 0 && (c === '+' || c === '-') && i > 0 && !/[+\-*/^(]/.test(prev)) {
        terms.push({ s: sign, b: buf }); sign = c; buf = ''; continue;
      }
      if (i === 0 && (c === '+' || c === '-')) { sign = c; continue; }
      buf += c;
    }
    terms.push({ s: sign, b: buf });
    var out = [];
    for (i = 0; i < terms.length; i++) {
      var t = normTerm(terms[i].b);
      if (t == null) return null;
      out.push(terms[i].s + t);
    }
    out.sort();
    return out.join('');
  }
  function normAlg(s0) {
    var s = peel(algPrep(s0));                                // 바깥 괄호 한 겹은 벗긴다 ((8π-16) = 8π-16)
    if (!s) return null;
    if (!/^[0-9A-Za-zπ√∛+\-*/^().]+$/.test(s)) return null;  // 읽을 수 없는 글자가 섞였다
    if (!/[A-Za-zπ0-9]/.test(s)) return null;
    return normExpr(s);
  }

  /* ── 5. 도형기호(geo) ─────────────────────────────────────────── */
  var GEO_WORD = { '선분': 1, '반직선': 1, '직선': 1, '호': 1, '점': 1, '면': 1, '변': 1, '모서리': 1, '각': 1, '꼭짓점': 1 };
  function sortLetters(p) { return String(p).split('').sort().join(''); }
  function rot(a, k) { return a.substring(k) + a.substring(0, k); }
  function minRotPair(a, b) {
    var best = null, k, ra, rb;
    for (k = 0; k < a.length; k++) {
      ra = rot(a, k); rb = b ? rot(b, k) : '';
      if (best === null || ra < best[0]) best = [ra, rb];
    }
    return best;
  }
  /* 점 이름은 중등이 영문 A~Z, 초등이 한글 자모 ㄱ~ㅎ 이다 — 둘 다 같은 규칙으로 본다 */
  function looksGeo(s) {
    return /\\over|\\wideparen|[∠△□≡∽⊥∥]/.test(s)
      || /^(선분|반직선|직선|호|점|면|변|모서리|꼭짓점|각)\s*[A-Zㄱ-ㅎ]/.test(trim(s));
  }
  /* 낱말 없이 점 이름만 적은 초등 답 (「ㄹㄷ」 「ㄷㄹㄱ」)
     - 두 글자·네 글자 이상 : 순서 무관(선분·면)  - 세 글자 : 가운데 글자 고정(각) */
  function jamoGeoKey(p) {
    if (p.length === 3) return (p.charAt(0) < p.charAt(2)) ? p : p.charAt(2) + p.charAt(1) + p.charAt(0);
    return sortLetters(p);
  }
  function normGeo(s0) {
    var s = String(s0).replace(/\s+/g, '');
    s = s.replace(/\\overline\s*\{([^{}]*)\}/g, function (_, p) { return '선분' + sortLetters(p); });
    s = s.replace(/\\overleftrightarrow\s*\{([^{}]*)\}/g, function (_, p) { return '직선' + sortLetters(p); });
    s = s.replace(/\\overrightarrow\s*\{([^{}]*)\}/g, function (_, p) { return '반직선' + p; });
    s = s.replace(/\\overleftarrow\s*\{([^{}]*)\}/g, function (_, p) { return '반직선' + p.split('').reverse().join(''); });
    s = s.replace(/\\(?:overgroup|overarc|overparen|wideparen|widearc)\s*\{([^{}]*)\}/g, function (_, p) { return '호' + sortLetters(p); });
    if (has(s, '\\')) return null;                       // 못 읽은 LaTeX 가 남았다
    // 합동·닮음 쌍은 대응 순서를 지키되 회전만 맞춘다 (△ABD≡△CDB = △BDA≡△DBC)
    s = s.replace(/△([A-Z]{3})([≡∽])△([A-Z]{3})/g, function (_, a, op, b) {
      var p = minRotPair(a, b); return '△' + p[0] + op + '△' + p[1];
    });
    s = s.replace(/△([A-Z]{3})(?![A-Z])/g, function (_, a) { return '△' + minRotPair(a, '')[0]; });
    s = s.replace(//g, '');
    // ∠ABC = ∠CBA (가운데 글자가 같으면 양끝은 바꿔도 된다)
    s = s.replace(/∠([A-Z])([A-Z])([A-Z])(?![A-Z])/g, function (_, a, b, c) { return '∠' + (a < c ? a + b + c : c + b + a); });
    // 각 ㄱㄴㄷ = 각 ㄷㄴㄱ (가운데 글자가 같으면 양끝은 바꿔도 된다) — ∠ 과 같은 규칙
    s = s.replace(/각([A-Zㄱ-ㅎ])([A-Zㄱ-ㅎ])([A-Zㄱ-ㅎ])(?![A-Zㄱ-ㅎ])/g,
      function (_, a, b, c) { return '각' + (a < c ? a + b + c : c + b + a); });
    // 면 ABCD 는 꼭짓점 묶음 — 글자를 정렬해 같은 면으로 본다
    s = s.replace(/면([A-Zㄱ-ㅎ]{3,})(?![A-Zㄱ-ㅎ])/g, function (_, p) { return '면' + sortLetters(p); });
    s = s.replace(/선분([A-Zㄱ-ㅎ]{2})(?![A-Zㄱ-ㅎ])/g, function (_, p) { return '선분' + sortLetters(p); });
    // 「반직선」 속의 「직선」까지 건드리지 않도록 앞 글자를 확인한다 (반직선은 순서 유지)
    s = s.replace(/(^|[^반])직선([A-Zㄱ-ㅎ]{2})(?![A-Zㄱ-ㅎ])/g, function (_, pre, p) { return pre + '직선' + sortLetters(p); });
    s = s.replace(/호([A-Zㄱ-ㅎ]{2})(?![A-Zㄱ-ㅎ])/g, function (_, p) { return '호' + sortLetters(p); });
    s = s.replace(/모서리([A-Zㄱ-ㅎ]{2})(?![A-Zㄱ-ㅎ])/g, function (_, p) { return '모서리' + sortLetters(p); });
    s = s.replace(/변([A-Zㄱ-ㅎ]{2})(?![A-Zㄱ-ㅎ])/g, function (_, p) { return '변' + sortLetters(p); });
    if (!/^[0-9A-Za-zㄱ-ㅎπ∠△□≡∽⊥∥+\-°선분반직호점면변모서리꼭짓각]+$/.test(s)) return null;
    return s;
  }

  /* ── 6. 보기 기호(mark) ───────────────────────────────────────── */
  var CIRC_NUM = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';
  var CIRC_KOR = '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭';
  var PAREN_KOR = '㈀㈁㈂㈃㈄㈅㈆㈇㈈㈉㈊㈋㈌㈍';
  // 초등 교재가 쓰는 원문자·괄호문자 묶음 — ㈎ = ㉮ = ㉠ = ㄱ = 첫째
  var PAREN_SYL = '㈎㈏㈐㈑㈒㈓㈔㈕㈖㈗㈘㈙㈚㈛';
  var CIRC_SYL = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻';
  var KOR_JA = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
  function markTok(t) {
    t = trim(t).replace(/\s+/g, '');
    if (!t) return null;
    if (/^[ㄱ-ㅎ]$/.test(t)) return 'ㄱ' + KOR_JA.indexOf(t);
    if (CIRC_KOR.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + CIRC_KOR.indexOf(t);   // ㉠ = ㄱ
    if (CIRC_NUM.indexOf(t) >= 0 && t.length === 1) return '#' + (CIRC_NUM.indexOf(t) + 1);
    if (PAREN_KOR.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + PAREN_KOR.indexOf(t);   // ㈀ = ㄱ
    if (PAREN_SYL.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + PAREN_SYL.indexOf(t);   // ㈎ = ㄱ
    if (CIRC_SYL.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + CIRC_SYL.indexOf(t);     // ㉮ = ㄱ
    var m = t.match(/^\(\s*(\d{1,2})\s*\)$/);
    if (m) return '#' + Number(m[1]);
    m = t.match(/^\(\s*([ㄱ-ㅎ])\s*\)$/);                      // (ㄱ) = ㄱ
    if (m) return 'ㄱ' + KOR_JA.indexOf(m[1]);
    return null;
  }
  function markSeq(s) {          // "㉢ → ㉠ → ㉡", "ㄱ과 ㄷ" 처럼 이어진 기호들
    var toks = String(s).split(/\s*(?:→|->|과|와|및|,)\s*/), out = [], i, t;
    for (i = 0; i < toks.length; i++) {
      if (!trim(toks[i])) continue;
      t = markTok(toks[i]); if (!t) return null; out.push(t);
    }
    return out.length ? out.join('→') : null;
  }

  /* ── 7. 낱말(word) ───────────────────────────────────────────── */
  var ANGLE_SHORT = { '예': '예', '둔': '둔', '직': '직', '평': '평', '예각': '예', '둔각': '둔', '직각': '직', '평각': '평' };
  function normWord(s0) {
    var s = String(s0).replace(/\s+/g, '').replace(/[.。]+$/, '');
    if (!s) return null;
    if (ANGLE_SHORT[s]) return ANGLE_SHORT[s];
    if (!/^[가-힣A-Za-z0-9%°.,~≒·:()○△□×✓]+$/.test(s)) return null;
    if (s.replace(/[^가-힣A-Za-z]/g, '').length === 0 && !/[가-힣]/.test(s)) return null;
    return s;
  }
  function isOx(s) { return /^[OXox○●◯〇⭕×✕✗ⅹ]$/.test(trim(s)); }
  function normOx(s) { return /^[Oo○●◯〇⭕]$/.test(trim(s)) ? 'O' : 'X'; }

  /* ── 7-b. 초등 전용 답 모양 ──────────────────────────────────── */

  /* ① 「( )( ○ )」 — 빈칸 여러 개 중 ○ 를 그린 자리가 답.
        칸 수(n)와 ○ 자리 번호(1부터)로 정리한다. ○ 가 여럿이면 번호 여러 개(순서 무관). */
  function readPick(s0) {
    var s = String(s0).replace(/\s+/g, '');
    if (!/^(?:\([○◯〇◎×✕✗]?\)|\[[○◯〇◎×✕✗]?\]){1,10}$/.test(s)) return null;
    var boxes = s.match(/\([^()]*\)|\[[^\[\]]*\]/g) || [], idx = [], xs = [], i;
    for (i = 0; i < boxes.length; i++) {
      if (/[○◯〇◎]/.test(boxes[i])) idx.push(i + 1);
      else if (/[×✕✗]/.test(boxes[i])) xs.push(i + 1);
    }
    if (!idx.length && !xs.length) return null;
    if (!idx.length && boxes.length < 2) return null;   // 「(×)」 한 칸은 곱셈 기호지 고르기 칸이 아니다
    return { n: boxes.length, idx: idx,
      key: 'pick:' + idx.join('-') + (xs.length ? '|x' + xs.join('-') : '') };
  }

  /* ② 「십에 ○표」 — 「무엇에 ○표」 꼴에서 무엇을 떼어 낸다 */
  function splitMarkSuffix(s0) {
    var m = trim(s0).match(/^([\s\S]+?)\s*에\s*([○◯〇△▲□■☆✓])\s*표\s*[.]?$/);
    if (!m || !trim(m[1])) return null;
    // 「'높이'에 ○표」 처럼 따옴표로 감싼 낱말은 따옴표를 뗀다
    var body = trim(m[1]).replace(/^['"’‘“”「『｀`]+|['"’‘“”」』´'`]+$/g, '');
    if (!trim(body)) return null;
    return { mark: m[2], body: trim(body) };
  }
  /* 한 답 안에 ○표·△표가 섞여 있으면 어느 쪽을 고른 건지 가를 수 없다 → 자기채점 */
  function mixedMarks(s) {
    var ms = String(s).match(/에\s*[○◯〇△▲□■☆✓]\s*표/g);
    if (!ms || ms.length < 2) return false;
    var seen = {}, n = 0, i, c;
    for (i = 0; i < ms.length; i++) {
      c = ms[i].replace(/[^○◯〇△▲□■☆✓]/g, '');
      if (!seen[c]) { seen[c] = 1; n++; }
    }
    return n > 1;
  }
  /* 「고르기」 낱말의 흔한 짝 — 학생앱이 칩으로 보여 줄 보기 */
  var CHOICE_SETS = [
    ['일', '십', '백', '천', '만', '억', '조'],
    ['이상', '이하'], ['초과', '미만'],
    ['크다', '작다'], ['큽니다', '작습니다'], ['크게', '작게'], ['큰', '작은'], ['커집니다', '작아집니다'],
    ['예', '아니요'], ['있습니다', '없습니다'], ['같습니다', '다릅니다'],
    ['맞습니다', '아닙니다'], ['됩니다', '안됩니다'],
    ['충분합니다', '부족합니다'], ['적절합니다', '적절하지않습니다'],
    ['위쪽', '아래쪽', '왼쪽', '오른쪽'], ['위', '아래', '왼쪽', '오른쪽'],
    ['넓은', '좁은'], ['넓습니다', '좁습니다'], ['넓게', '좁게'],
    ['긴', '짧은'], ['깁니다', '짧습니다'], ['많습니다', '적습니다'], ['많은', '적은'],
    ['예각', '직각', '둔각'], ['홀수', '짝수'], ['참', '거짓'],
    ['올림', '버림', '반올림'], ['늘어납니다', '줄어듭니다']
  ];
  function choiceOptions(word, sameAnswerWords) {
    var i, j, set;
    for (i = 0; i < CHOICE_SETS.length; i++) {
      set = CHOICE_SETS[i];
      for (j = 0; j < set.length; j++) if (set[j] === word) return set.slice(0);
    }
    var out = [word];
    for (i = 0; i < (sameAnswerWords || []).length; i++) {
      if (sameAnswerWords[i] !== word && out.indexOf(sameAnswerWords[i]) < 0) out.push(sameAnswerWords[i]);
    }
    return out;
  }

  /* ⑥ 「학생이 칠 수 없는 답」 가려내기 (오채점 0 원칙)
        - 말로 쓴 식 : 「(원주율)×(반지름)×(반지름)」 처럼 한글 낱말 둘 이상에 연산 기호가 섞인 것
        - 긴 한글    : 한글이 든 답이 18자를 넘는 것 (낱말 답에 이미 있던 기준을 식·이름표 칸에도 똑같이)
        「9개 이상 11개 이하」 「장미 샴푸」 처럼 학생이 칠 수 있는 짧은 낱말 답은 그대로 채점한다. */
  function koWords(s) { return (String(s).match(/[가-힣]{2,}/g) || []).length; }
  function unTypable(s) {
    var t = String(s).replace(/\(\s*또는[^()]*\)/g, ' ');       // 「(또는 아래쪽)」 같은 덧붙임은 빼고 센다
    if (!/[가-힣]/.test(t)) return false;                       // 한글이 없으면 숫자·식이니 상관없다
    if (koWords(t) >= 2 && /[×÷+\-=\/()]/.test(t)) return true;  // 말로 쓴 식
    return t.replace(/\s+/g, '').length > 18;                   // 낱말 답과 같은 18자 기준
  }
  /* 「= 뒤만 보는 식」인데 원문이 긴 한글 문장이면 앞부분을 학생이 쓸 수 없다 → 채점하지 않는다 */
  function longKoSentence(s) {
    var t = String(s);
    if (!/[가-힣]/.test(t)) return false;
    return koWords(t) >= 2 || t.replace(/\s+/g, '').length > 18;
  }

  /* ③ 「×」「÷」처럼 연산 기호 하나가 답인 칸 */
  function readOp(s0) {
    var s = peel(trim(s0)).replace(/\s+/g, '');
    return /^[+\-×÷]$/.test(s) ? s : null;
  }

  /* ④ 「(위에서부터)」 「(왼쪽에서부터)」 「(화살표 방향으로)」 같은 안내문 떼기.
        답 가운데에 다시 나오기도 하므로 모두 찾아 칸 구분(쉼표)으로 바꾼다. */
  function stripGuide(s) {
    return trim(String(s).replace(/\(\s*[^()]{0,30}(?:부터|차례로?|방향으로|순으로)\s*\)/g, ','));
  }
  /* ⑤ 「(예)…」 는 「이렇게 쓰면 된다」는 보기 답이다.
        값·낱말처럼 딱 떨어지는 답이면 그대로 채점하고(sample 표시),
        식처럼 여러 가지로 쓸 수 있는 답이면 자기채점으로 보낸다. */
  function isSample(s) {
    var t = trim(s);
    return /\(\s*예\s*\)/.test(t) || /(^|[,\/(]\s*)예\)/.test(t) || /(^|[,\/]\s*)예\s+\S/.test(t);
  }
  function stripSample(s) {
    var t = String(s).replace(/\(\s*예\s*\)/g, ' ');
    t = t.replace(/(^|[,\/(]\s*)예\)\s*/g, '$1');
    t = t.replace(/(^|[,\/]\s*)예\s+/g, '$1');
    return trim(t.replace(/\s+/g, ' '));
  }
  // 보기 답이라도 그대로 채점해도 되는 모양 (값·낱말·기호처럼 달리 쓸 길이 거의 없는 것)
  var SAMPLE_OK = { num: 1, unit: 1, word: 1, mark: 1, ox: 1, geo: 1, pick: 1, choice: 1, op: 1, coord: 1 };

  /* ── 8. 한 조각(part) 읽기 ───────────────────────────────────── */
  var RANK = { free: 0, essay: 0, geo: 1, alg: 2, ineq: 3, coord: 4, eq: 5, word: 6,
    choice: 7, op: 8, pick: 9, mark: 10, num: 11, ox: 12 };
  var SETLIKE = { num: 1, mark: 1, geo: 1 };   // 이 모양만 답 순서를 따지지 않는다

  /* 값 하나를 읽어 { kind, keys[], unit } 로. keys 가 비면 못 읽은 것 */
  function readValue(raw) {
    var s = trim(raw);
    if (!s) return { kind: 'free', keys: [], unit: '' };
    if (s === '.' || s === '…') return { kind: 'essay', keys: [], unit: '' };
    if (isOx(s)) return { kind: 'ox', keys: [normOx(s)], unit: '' };
    // 초등 ① ○표 자리 고르기 — 낱말로 읽히기 전에 먼저 본다
    var pk = readPick(s);
    if (pk) {
      var pkeys = [pk.key];
      // 학생앱이 「몇째 칸」을 숫자 하나로 보내와도 맞다고 본다 (○ 가 한 칸일 때)
      if (pk.idx.length === 1 && pk.key.indexOf('|') < 0) pkeys.push(String(pk.idx[0]));
      return { kind: 'pick', keys: pkeys, unit: '', n: pk.n };
    }
    // 초등 ② 연산 기호 한 칸
    var op = readOp(s);
    if (op) return { kind: 'op', keys: ['op' + op], unit: '' };
    // 초등 ③ 단위 낱말 자체가 답 (㎢ · cm …)
    if (UNIT_ONLY[s.replace(/\s+/g, '')]) {
      return { kind: 'word', keys: ['단위:' + canonUnit(s.replace(/\s+/g, ''))], unit: '', unitWord: true };
    }
    // 초등 ④ 「3m 20cm」 「3시 20분」 — 단위가 둘 이상 이어진 값
    var mx = readMix(s);
    if (mx) return { kind: 'num', keys: [mx.key], unit: mx.unit, multi: mx.labels };
    var mk = markSeq(s);
    if (mk) return { kind: 'mark', keys: [mk], unit: '' };
    // 좌표 (3,6) / A(3,6)
    var mc = s.replace(/\s+/g, '').match(/^([A-Za-z]?)\(([^()]*,[^()]*)\)$/);
    if (mc) {
      var ins = splitTop(mc[2], ','), ok = true, vs = [], i;
      for (i = 0; i < ins.length; i++) { var pv = parseNumeric(ins[i]); if (pv == null) { ok = false; break; } vs.push(pv); }
      if (ok && vs.length >= 2) return { kind: 'coord', keys: ['(' + vs.join(',') + ')'], unit: '' };
    }
    // 단위 떼어 보기
    var su = splitUnit(s), core = su.core, unit = su.unit;
    var v = parseNumeric(core);
    if (v != null) {
      var ks = [v], bk = unit ? baseKey(v, unit) : null;     // 「20cm」는 「≈200mm」 열쇠도 함께 갖는다
      if (bk) ks.push(bk);
      return { kind: 'num', keys: ks, unit: unit };
    }
    if (looksGeo(core)) { var g = normGeo(core); if (g) return { kind: 'geo', keys: [g], unit: unit }; }
    // 낱말 없이 점 이름만 적은 초등 답 (「ㄹㄷ」 「ㄷㄹㄱ」)
    if (/^[ㄱ-ㅎ]{2,6}$/.test(core.replace(/\s+/g, ''))) {
      return { kind: 'geo', keys: [jamoGeoKey(core.replace(/\s+/g, ''))], unit: '' };
    }
    // 한글 낱자 하나 (모음 ㅏ ㅓ ㅗ … 도 답이 된다 — 「글자를 만드시오」 문항)
    if (/^[ㄱ-ㅣ]$/.test(core.replace(/\s+/g, ''))) {
      return { kind: 'word', keys: ['낱자' + core.replace(/\s+/g, '')], unit: '' };
    }
    // 문자식·계산식 (문자가 있거나 연산기호가 있는 식)
    if (/[A-Za-zπ√∛]/.test(core) || /[+\-*/^×÷()]/.test(core)) {
      var a = normAlg(core);
      if (a) return { kind: 'alg', keys: [a], unit: unit };
    }
    // 단위를 뗀 게 잘못이었다면 되돌린다 (「기호」 같은 낱말)
    if (unit) {
      var w0 = readValue2(s);
      if (w0) return w0;
    }
    return readValue2(core) || readValue2(s) || { kind: 'free', keys: [], unit: '' };
  }
  function readValue2(s) {   // 낱말·도형 낱말 등 마지막 시도
    if (looksGeo(s)) { var g = normGeo(s); if (g) return { kind: 'geo', keys: [g], unit: '' }; }
    var w = normWord(s);
    if (w && w.replace(/\s+/g, '').length <= 18) {
      var keys = [w];
      return { kind: 'word', keys: keys, unit: '' };
    }
    return null;
  }

  /* 한 조각을 「이름표 + 값」으로 읽는다 */
  function analyzePart(raw) {
    var s = trim(raw), label = '', m, i;
    if (!s) return { label: '', kind: 'free', keys: [], unit: '', eq: false };
    s = trim(s.replace(/^약\s+/, ''));                 // 어림한 답 「약 1600」 — 「약」은 떼고 값만 본다
    s = trim(s.replace(/\s*에\s*색칠(하기|합니다)?[.]?$/, ''));   // 「…에 색칠」 — 고른 것만 답이다
    var pickMark = splitMarkSuffix(s);                 // 「십에 ○표」 → 「십」
    if (pickMark) s = trim(pickMark.body);
    if (!s) return { label: '', kind: 'free', keys: [], unit: '', eq: false };
    // 이름표:  「교점: 8」 「l: 6π cm」 「(나): \overline{OD}」
    m = s.match(/^([^:\d]{1,10}):\s*([\s\S]+)$/);
    if (m && trim(m[1])) { label = trim(m[1]) + ':'; s = trim(m[2]); }   // 이름표는 화면에 그대로 쓴다
    else {
      m = s.match(/^(\((?:가|나|다|라|마|바|사|아)\))\s*:?\s*([\s\S]+)$/);
      if (m) { label = m[1]; s = trim(m[2]); }
    }
    // 부등호 한 글자만 답인 문제 (「□ 안에 알맞은 부등호」)
    if (/^[<>≤≥=≠]$/.test(s.replace(/\s+/g, ''))) {
      return { label: label, kind: 'mark', keys: ['부등호' + s.replace(/\s+/g, '')], unit: '', eq: false };
    }
    // 부등식
    if (/[<>≤≥]/.test(s)) {
      var iq = normIneq(s);
      return { label: label, kind: iq ? 'ineq' : 'free', keys: iq ? [iq] : [], unit: '', eq: false };
    }
    // 식 : 마지막 = 뒤 값만 본다. 왼쪽이 짧은 이름이면 이름표로 쓴다
    var full = s;                    // = 로 자르기 전 원문 (학생이 칠 수 있는 답인지 볼 때 쓴다)
    var isEq = false;
    if (has(s, '=')) {
      var segs = splitTop(s, '=');
      if (segs.length >= 2) {
        var lhs = trim(segs[segs.length - 2]), rhs = trim(segs[segs.length - 1]);
        if (!label && /^[∠]?[A-Za-zㄱ-ㅎ가-힣]{1,3}$/.test(lhs)) label = lhs + '=';
        s = rhs; isEq = true;
      }
    }
    // 「(또는 …)」로 여러 답이 허용되는 경우 → 하나만 맞아도 정답
    //   ※ 괄호 안에 든 「또는」만 대안으로 본다. 문장 속 「0 또는 양수」까지 쪼개면 안 되기 때문.
    var alts, mAlt = s.match(/^([\s\S]*?)\(\s*또는\s*([\s\S]*)\)\s*$/);
    if (mAlt && trim(mAlt[1])) alts = [trim(mAlt[1])].concat(String(mAlt[2]).split(/\s*또는\s*/));
    else {
      // 「2\frac{2}{9}(=\frac{20}{9})」 처럼 같은 값을 달리 쓴 것 — 어느 쪽으로 써도 정답
      var mEq2 = s.match(/^([\s\S]*?)\(\s*=\s*([\s\S]*)\)\s*$/);
      if (mEq2 && trim(mEq2[1])) alts = [trim(mEq2[1])].concat(String(mEq2[2]).split(/\s*=\s*/));
      else alts = [s];
    }
    var reads = [], keys = [], kind = null, unit = '';
    for (i = 0; i < alts.length; i++) {
      if (!trim(alts[i])) continue;
      var r = readValue(alts[i]);
      reads.push(r);
      if (!r.keys.length) continue;          // 못 읽은 대안 하나 때문에 답 전체를 버리지는 않는다
      if (unTypable(alts[i])) continue;      // 학생이 칠 수 없는 답(말로 쓴 식·긴 한글)은 세지 않는다
      if (kind === null) { kind = r.kind; unit = r.unit; }
      for (var k = 0; k < r.keys.length; k++) keys.push(r.keys[k]);
    }
    if (!reads.length) return { label: label, kind: 'free', keys: [], unit: '', eq: isEq };
    if (!keys.length) { kind = reads[0].kind; unit = reads[0].unit; }
    // 「= 뒤만 보는 식」인데 원문이 긴 한글 문장이면 앞부분을 학생이 쓸 수 없다 → 자기채점
    if (keys.length && isEq && longKoSentence(full)) {
      return { label: label, kind: 'free', keys: [], unit: '', eq: isEq };
    }
    // 「(수건의 수)+1=(빨래집게의 수)」 「□×5+2=△」 처럼 = 뒤가 기호·말풀이뿐이면
    //   식을 어떻게 쓰든 다 맞다고 하게 된다 → 채점하지 않고 자기채점으로 보낸다
    if (isEq && keys.length) {
      var onlySym = true;
      for (i = 0; i < keys.length; i++) {
        var kk0 = String(keys[i]);
        if (!/^[□△○◯〇◇☆★●▲■]$/.test(kk0) && !/^\([가-힣\s]+\)$/.test(kk0)) { onlySym = false; break; }
      }
      if (onlySym) return { label: label, kind: 'free', keys: [], unit: '', eq: true };
    }
    if (kind === 'geo') {   // 「점 D」는 학생이 그냥 「D」라고 쓸 수도 있다 → 둘 다 정답으로 본다
      var extra = [];
      for (i = 0; i < keys.length; i++) {
        var mm = String(keys[i]).match(/^(점|꼭짓점|변|면|각|모서리|선분|직선|호)([A-Zㄱ-ㅎ]+)$/);
        if (mm) {
          extra.push(mm[2]);
          if (/^[ㄱ-ㅎ]+$/.test(mm[2])) {
            var jj = jamoGeoKey(mm[2]); if (jj !== mm[2]) extra.push(jj);
            if (mm[2].length === 1) { var mt = markTok(mm[2]); if (mt) extra.push(mt); }  // 「점 ㄱ」 ↔ 「ㄱ」
          } else { var al = normAlg(mm[2]); if (al) extra.push(al); }
        }
      }
      for (i = 0; i < extra.length; i++) keys.push(extra[i]);
    }
    var out = { label: label, kind: kind || 'free', keys: keys, unit: unit, eq: isEq, src: s };
    // 「…에 ○표」 이고 답이 낱말이면 「보기 중 고르기」 칸으로 본다 (보기는 analyzeChunks 가 채운다)
    if (pickMark && out.kind === 'word' && keys.length) { out.kind = 'choice'; out.word = keys[0]; }
    for (i = 0; i < reads.length; i++) {
      if (reads[i].n) out.n = reads[i].n;                 // ○표 자리 고르기 칸 수
      if (reads[i].multi) out.multi = reads[i].multi;     // 「3시 20분」 같은 여러 칸
      if (reads[i].unitWord) out.unitWord = true;         // 단위 낱말이 답
    }
    return out;
  }

  function normIneq(s0) {
    var s = String(s0).replace(/\s+/g, '');
    var toks = s.split(/([<>≤≥])/), sides = [], ops = [], i;
    if (toks.length < 3 || toks.length % 2 === 0) return null;
    for (i = 0; i < toks.length; i++) { if (i % 2 === 0) sides.push(toks[i]); else ops.push(toks[i]); }
    var up = 0, dn = 0;
    for (i = 0; i < ops.length; i++) { if (ops[i] === '>' || ops[i] === '≥') up++; else dn++; }
    if (up && dn) return null;                       // 방향이 뒤섞였다 → 못 읽음
    if (up) {                                        // > ≥ 는 뒤집어 < ≤ 로 통일
      sides.reverse(); ops.reverse();
      for (i = 0; i < ops.length; i++) ops[i] = (ops[i] === '>' ? '<' : '≤');
    }
    var out = '';
    for (i = 0; i < sides.length; i++) {
      var su = splitUnit(sides[i]);
      var v = parseNumeric(su.core);
      if (v == null) v = normAlg(su.core);
      if (v == null) return null;
      out += (i ? ops[i - 1] : '') + v + (su.unit ? canonUnit(su.unit) : '');
    }
    return out;
  }

  /* ── 9. 정답/입력 전체 읽기 ──────────────────────────────────── */
  //  ±8 → 8 과 -8 두 답으로 펼친다. 「x=±8」처럼 앞에 이름이 붙어 있어도 같다.
  function expandPM(chunk) {
    var m = String(chunk).match(/^\s*(?:[A-Za-z∠]{1,3}\s*=\s*)?([±∓])\s*([\s\S]+)$/);
    if (!m) return [chunk];
    var body = trim(m[2]);
    return [body, '-' + body];
  }
  /* 답 한 벌을 칸(part) 들로 쪼개 읽는다.
     초등 교재는 작은 문제들의 답을 「3, 5 / 7, 9」 처럼 빗금으로 이어 붙이므로
     쉼표와 함께 빗금(/)도 칸 구분으로 본다. */
  function analyzeChunks(s) {
    var res = { parts: [], gradable: false, shape: 'free', unit: '', labeled: false, essay: false };
    var chunks = splitTopMulti(s, ',/;'), parts = [], i, j;
    for (i = 0; i < chunks.length; i++) {
      var c = trim(chunks[i]);
      if (!c) continue;
      var ex = expandPM(c);
      for (j = 0; j < ex.length; j++) parts.push(analyzePart(ex[j]));
    }
    if (!parts.length) { res.essay = true; res.shape = 'essay'; return res; }
    // 연산 기호를 늘어놓은 답(「×, -, ÷, +」)에서 「×」는 틀림 표시가 아니라 곱셈 기호다
    var nOp = 0;
    for (i = 0; i < parts.length; i++) if (parts[i].kind === 'op') nOp++;
    if (nOp) {
      for (i = 0; i < parts.length; i++) {
        if (parts[i].kind === 'ox' && /^\(?\s*×\s*\)?$/.test(String(parts[i].src || ''))) {
          parts[i].kind = 'op'; parts[i].keys = ['op×'];
        }
      }
    }
    // 「…에 ○표」 칸들의 보기 낱말 채우기 — 같은 답에 나온 낱말끼리 서로 보기가 된다
    var cw = [];
    for (i = 0; i < parts.length; i++) if (parts[i].kind === 'choice' && parts[i].word) cw.push(parts[i].word);
    for (i = 0; i < parts.length; i++) if (parts[i].kind === 'choice') parts[i].options = choiceOptions(parts[i].word, cw);
    res.parts = parts;
    var ok = true, nLabel = 0, nEq = 0, best = null, same = parts[0].kind;
    for (i = 0; i < parts.length; i++) {
      if (!parts[i].keys.length) ok = false;
      if (parts[i].label) nLabel++;
      if (parts[i].eq) nEq++;
      if (parts[i].kind !== same) same = null;
      var rk = RANK[parts[i].kind]; if (rk == null) rk = 0;
      if (best === null || rk < best) best = rk;
    }
    res.unit = parts[0].unit || '';
    var shape;
    if (!ok) shape = 'free';
    else if (nLabel >= 2 && parts.length >= 2) shape = 'labeled';
    else if (nLabel === 1 && parts.length === 1 && nEq === 1) shape = 'eq';
    else if (nLabel >= 1 && parts.length >= 2) shape = 'labeled';
    else if (nEq === parts.length) shape = 'eq';
    else if (same) shape = (same === 'num' && res.unit) ? 'unit' : same;
    else { for (var kk in RANK) { if (RANK[kk] === best) { shape = kk; break; } } }
    if (shape === 'num' && res.unit) shape = 'unit';
    res.labeled = (shape === 'labeled');
    res.shape = shape;
    res.gradable = ok;
    res.same = same;
    return res;
  }

  /* 답 전체 읽기.
     ① ○표·△표가 섞여 어느 쪽을 고른 건지 못 가르는 답은 바로 자기채점으로 보낸다
     ② 안내문 「(위에서부터)」·「[방법1]」·「①②③」 을 칸 구분으로 바꾼다
     ③ 「(예)…」 는 보기로 든 답 — 그대로 채점하되 sample 표시를 남기고,
        ○△□ 를 학생이 마음대로 정하는 답이면 자기채점으로 보낸다
     ④ 「A 또는 B」 는 A·B 를 각각 읽어 어느 쪽으로 써도 맞다고 본다 */
  function analyze(raw) {
    var s0 = trim(raw);
    var res = { parts: [], gradable: false, shape: 'free', unit: '', labeled: false, essay: false };
    if (!s0 || s0 === '.') { res.essay = true; res.shape = 'essay'; return res; }
    var s = unlatex(s0);
    if (mixedMarks(s)) { res.shape = 'free'; return res; }   // ○표·△표가 섞였다 → 자기채점
    var sample = isSample(s);
    if (sample) s = stripSample(s);
    s = stripGuide(s);
    // 「[방법1] … [방법2] …」 처럼 풀이 방법을 나눠 적은 표시는 칸 구분으로 바꾼다
    s = trim(s.replace(/[\[(]\s*방법\s*\d*\s*[\])]/g, ','));
    // 「① 4, 4 ② 4, 5 ③ …」 처럼 작은 문제 번호로 나눠 적은 답도 칸 구분으로 바꾼다
    if ((s.match(/[①-⑮]\s+\S/g) || []).length >= 2) s = trim(s.replace(/[①-⑮]\s+/g, ','));
    // 「변 ㄱㄹ과 변 ㄴㄷ」 처럼 「과·와」로 이은 도형 답은 쉼표로 이은 것과 같이 본다
    s = s.replace(/([A-Zㄱ-ㅎ])\s*(?:과|와)\s*(선분|반직선|직선|호|점|면|변|모서리|꼭짓점|각)\s*([A-Zㄱ-ㅎ])/g, '$1,$2 $3');
    var alts = splitTopWord(s, '또는'), prim = null, primIdx = -1, first = null, i, j, k;
    for (i = 0; i < alts.length; i++) {
      if (!trim(alts[i])) continue;
      var r = analyzeChunks(trim(alts[i]));
      if (!first) first = r;
      if (r.gradable) { prim = r; primIdx = i; break; }
    }
    if (!prim) return first || res;
    // 보기 답(「(예)…」)은 그대로 채점하되, 기호를 학생이 골라 정하는 문제
    //   (「○×9＝□ 또는 □÷9＝○」처럼 ○△□ 를 학생이 마음대로 쓰는 답)는 자기채점으로 보낸다.
    if (sample) {
      if (/[○◯〇△▲□■☆★◇]/.test(s)) { res.shape = 'free'; return res; }
      prim.sample = true;
    }
    if (alts.length > 1) {          // 다른 표현으로 써도 맞도록 열쇠를 더해 둔다
      for (i = 0; i < alts.length; i++) {
        if (i === primIdx || !trim(alts[i])) continue;
        var r2 = analyzeChunks(trim(alts[i]));
        if (!r2.gradable || r2.parts.length !== prim.parts.length) continue;
        for (j = 0; j < prim.parts.length; j++) {
          for (k = 0; k < r2.parts[j].keys.length; k++) prim.parts[j].keys.push(r2.parts[j].keys[k]);
        }
      }
    }
    return prim;
  }

  /* ── 10. 맞춰 보기 ──────────────────────────────────────────── */
  function inter(a, b) {
    for (var i = 0; i < a.length; i++) for (var j = 0; j < b.length; j++) if (a[i] === b[j]) return true;
    return false;
  }
  function unitOk(cu, su) {
    if (!su) return true;                 // 학생은 단위를 안 쳐도 된다 (칸 옆에 보여 준다)
    if (!cu) return false;
    return canonUnit(cu) === canonUnit(su);
  }
  function samePart(cp, sp) { return inter(cp.keys, sp.keys) && unitOk(cp.unit, sp.unit); }

  function grade(correctRaw, studentRaw) {
    var C = analyze(correctRaw);
    if (!C.gradable) return { gradable: false, correct: false };
    if (studentRaw == null || trim(studentRaw) === '') return { gradable: true, correct: false };
    var S = analyze(studentRaw);
    if (!S.parts.length) return { gradable: true, correct: false };
    var cp = C.parts, sp = S.parts, i, j;
    for (i = 0; i < sp.length; i++) if (!sp[i].keys.length) return { gradable: true, correct: false };
    if (cp.length !== sp.length) return { gradable: true, correct: false };
    // ① 이름표가 양쪽에 다 있으면 이름표끼리 맞춘다
    var cLab = 0, sLab = 0;
    for (i = 0; i < cp.length; i++) if (cp[i].label) cLab++;
    for (i = 0; i < sp.length; i++) if (sp[i].label) sLab++;
    var used = [];
    if (cLab === cp.length && sLab === sp.length) {
      for (i = 0; i < cp.length; i++) {
        var found = -1;
        for (j = 0; j < sp.length; j++) {
          if (used[j]) continue;
          if (labelKey(cp[i].label) === labelKey(sp[j].label) && samePart(cp[i], sp[j])) { found = j; break; }
        }
        if (found < 0) return { gradable: true, correct: false };
        used[found] = 1;
      }
      return { gradable: true, correct: true };
    }
    // ② 순서를 안 따지는 모양(숫자·보기기호·도형)이고 종류가 모두 같으면 묶음끼리 맞춘다
    if (C.same && SETLIKE[C.same] && !cLab) {
      for (i = 0; i < cp.length; i++) {
        var f2 = -1;
        for (j = 0; j < sp.length; j++) { if (used[j]) continue; if (samePart(cp[i], sp[j])) { f2 = j; break; } }
        if (f2 < 0) return { gradable: true, correct: false };
        used[f2] = 1;
      }
      return { gradable: true, correct: true };
    }
    // ③ 그 밖에는 순서대로 맞춘다
    for (i = 0; i < cp.length; i++) if (!samePart(cp[i], sp[i])) return { gradable: true, correct: false };
    return { gradable: true, correct: true };
  }
  function labelKey(l) { return String(l || '').replace(/[\s:=]/g, ''); }

  /* ── 11. 공개 함수 ─────────────────────────────────────────── */
  function isGradable(answerRaw) { return analyze(answerRaw).gradable; }

  /* 칸 옆에 표시할 단위 ("72 cm³" → "cm³", 없으면 "") */
  function unitOf(answerRaw) {
    var a = analyze(answerRaw);
    if (!a.parts.length) return '';
    for (var i = 0; i < a.parts.length; i++) if (a.parts[i].unit) return a.parts[i].unit;
    return '';
  }

  /* 정리된 문자열 (디버그·표시용) */
  function normalize(raw, shape) {
    var a = analyze(raw), out = [], i;
    for (i = 0; i < a.parts.length; i++) {
      var p = a.parts[i];
      out.push((p.label ? p.label + ' ' : '') + (p.keys.length ? p.keys[0] : '?') + (p.unit ? ' ' + canonUnit(p.unit) : ''));
    }
    return out.join(', ');
  }

  /* 문항 → 입력칸 설계도. problem = { type, answer, objective, cnt, units } */
  function shapeOf(problem) {
    var p = problem || {};
    var raw = p.answer == null ? '' : String(p.answer);
    var objective = (p.objective === true) || p.type === 'MULTIPLE_CHOICE' || p.type === 'SINGLE_CHOICE';
    if (objective) {
      return { shape: 'num', self: false, gradable: true, unit: '',
        parts: [{ label: '', kind: 'num', unit: '' }] };
    }
    if (p.type === 'ESSAY' || !trim(raw) || trim(raw) === '.') {
      return { shape: 'essay', self: true, gradable: false, unit: '', parts: [] };
    }
    var a = analyze(raw);
    var parts = [], i, q;
    for (i = 0; i < a.parts.length; i++) {
      var ap = a.parts[i];
      // 「3시 20분」 「3m 20cm」 → 이름표 붙은 칸 여러 개로 펼친다 (학생은 숫자만 친다)
      if (ap.multi && ap.multi.length > 1) {
        for (q = 0; q < ap.multi.length; q++) parts.push({ label: ap.multi[q], kind: 'num', unit: '' });
        continue;
      }
      var np = { label: ap.label || '', kind: ap.kind, unit: ap.unit || '' };
      if (ap.kind === 'pick') np.n = ap.n || 2;                 // 빈칸 몇 개를 그릴지
      if (ap.kind === 'choice') np.options = ap.options || [];  // 칩으로 보여 줄 보기 낱말
      if (ap.unitWord) np.unitWord = true;                      // 단위 칩을 보여 준다
      parts.push(np);
    }
    // 매쓰플랫이 준 답칸 이름표(answerUnits)가 있으면 그것을 우선한다.
    //   ※ answerUnits[].index 는 「몇 번째 칸」이 아니라 정답 글자 속 위치라서
    //      칸 번호로 쓰면 안 된다. 위치 순서대로 줄 세워 칸 수가 딱 맞을 때만 갖다 붙인다.
    var us = (p.units || []).slice().sort(function (x, y) {
      return Number(x.i != null ? x.i : x.index || 0) - Number(y.i != null ? y.i : y.index || 0);
    });
    if (us.length === parts.length) {
      for (i = 0; i < us.length; i++) {
        var txt = trim(String(us[i].u != null ? us[i].u : us[i].unit || '')).replace(/^\[|\]$/g, '');
        txt = trim(unlatex(txt));
        if (!txt) continue;
        if (/:$/.test(txt) || /[가-힣]/.test(txt)) { if (!parts[i].label) parts[i].label = txt; }
        else if (!parts[i].unit) parts[i].unit = txt;
      }
    }
    // 답칸 수(cnt)가 더 많으면 빈 칸을 채워 둔다 (학생앱이 칸을 그릴 수 있게)
    var cnt = Number(p.cnt || 0);
    if (cnt > parts.length) {
      var kind0 = parts.length ? parts[parts.length - 1].kind : 'num';
      while (parts.length < cnt && parts.length < 12) parts.push({ label: '', kind: kind0, unit: '' });
    }
    var shape = a.gradable ? a.shape : 'free';
    // sample = 「(예)…」로 적힌 보기 답 (학생이 달리 써도 맞을 수 있다 — 화면에 알려 주면 좋다)
    return { shape: shape, self: !a.gradable, gradable: a.gradable, unit: a.unit || '',
      parts: parts, sample: !!a.sample };
  }

  /* ── 옛 API 호환 (v2-41 학생앱이 쓰던 것) ─────────────────────── */
  function toValue(raw) {
    var r = readValue(unlatex(raw));
    if (!r || !r.keys.length) return null;
    if (r.kind === 'num') { var n = Number(r.keys[0]); if (!isNaN(n)) return { v: n }; }
    return { v: r.keys[0] };
  }
  function valuesOf(str) {
    var a = analyze(str);
    if (!a.gradable) return null;
    var out = [], i;
    for (i = 0; i < a.parts.length; i++) out.push(a.parts[i].keys[0]);
    return out.sort();
  }

  var API = {
    grade: grade, isGradable: isGradable, unitOf: unitOf,
    shapeOf: shapeOf, normalize: normalize,
    toValue: toValue, valuesOf: valuesOf, analyze: analyze, unlatex: unlatex
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.HWGrade = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
