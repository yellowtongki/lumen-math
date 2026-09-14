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
  function splitTop(s, sep) {
    var out = [], buf = '', d = 0, i, c;
    s = String(s);
    for (i = 0; i < s.length; i++) {
      c = s.charAt(i);
      if (c === '(' || c === '{' || c === '[') d++;
      else if (c === ')' || c === '}' || c === ']') { d--; if (d < 0) d = 0; }
      else if (d === 0 && c === sep) { out.push(buf); buf = ''; continue; }
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
      [/\\(?:cdots|ldots|dots)(?![a-zA-Z])/g, '…']
    ];
    for (var i = 0; i < MAP.length; i++) t = t.replace(MAP[i][0], MAP[i][1]);
    // 전각·비슷한 글자 통일
    t = t.replace(/[＋]/g, '+').replace(/[－−–—ー]/g, '-').replace(/[＝]/g, '=')
         .replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[，、]/g, ',')
         .replace(/[％]/g, '%').replace(/[／]/g, '/').replace(/[：]/g, ':')
         .replace(/[＜]/g, '<').replace(/[＞]/g, '>').replace(/[＊]/g, '*')
         .replace(/[˚º∘⁰]/g, '°').replace(/[·․]/g, '·');
    return trim(t.replace(/\s+/g, ' '));
  }

  /* ── 2. 단위 ──────────────────────────────────────────────────── */
  // 값 뒤에 붙는 단위 글자들. (「각」「도」「형」처럼 낱말 꼬리와 헷갈리는 글자는 뺐다)
  var UNIT_LIST = ['㎠', '㎟', '㎡', '㎢', '㎤', '㎥', '㎣', '㎝', '㎜', '㎞', '㎖', '㎘', '㎏', '㎎', '℃', '°', '%',
    'cm²', 'cm³', 'm²', 'm³', 'cm2', 'cm3',
    'cm', 'mm', 'km', 'kg', 'mg', 'mL', 'ml', 'kL', 'm', 'g', 'L', 't',
    '시간', '분', '초', '일', '주일', '주', '개월', '달', '년', '개', '명', '원', '번', '회', '점', '장', '권', '살',
    '층', '칸', '마리', '송이', '그루', '줄', '바퀴', '배', '가지', '자리', '병', '상자', '판', '쪽', '호', '벌', '켤레'];
  var TAIL_UNIT_RE = new RegExp('^([\\s\\S]*?)\\s*(' + UNIT_LIST.join('|') + ')$');
  var UNIT_CANON = { '㎠': 'cm2', 'cm²': 'cm2', 'cm2': 'cm2', '㎤': 'cm3', 'cm³': 'cm3', 'cm3': 'cm3',
    '㎡': 'm2', 'm²': 'm2', 'm2': 'm2', '㎥': 'm3', 'm³': 'm3', 'm3': 'm3', '㎟': 'mm2', '㎣': 'mm3',
    '㎝': 'cm', '㎜': 'mm', '㎞': 'km', '㎖': 'mL', 'ml': 'mL', '㎘': 'kL', '㎏': 'kg', '㎎': 'mg', '℃': '°C' };
  function canonUnit(u) { u = trim(u); return UNIT_CANON[u] || u; }

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
  function looksGeo(s) {
    return /\\over|\\wideparen|[∠△□≡∽⊥∥]/.test(s) || /^(선분|반직선|직선|호|점|면|변|모서리|꼭짓점)\s*[A-Z]/.test(trim(s));
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
    // 면 ABCD 는 꼭짓점 묶음 — 글자를 정렬해 같은 면으로 본다
    s = s.replace(/면([A-Z]{3,})(?![A-Z])/g, function (_, p) { return '면' + sortLetters(p); });
    s = s.replace(/선분([A-Z]{2})(?![A-Z])/g, function (_, p) { return '선분' + sortLetters(p); });
    s = s.replace(/직선([A-Z]{2})(?![A-Z])/g, function (_, p) { return '직선' + sortLetters(p); });
    s = s.replace(/호([A-Z]{2})(?![A-Z])/g, function (_, p) { return '호' + sortLetters(p); });
    if (!/^[0-9A-Za-zπ∠△□≡∽⊥∥+\-°선분반직호점면변모서리꼭짓]+$/.test(s)) return null;
    return s;
  }

  /* ── 6. 보기 기호(mark) ───────────────────────────────────────── */
  var CIRC_NUM = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮';
  var CIRC_KOR = '㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭';
  var PAREN_KOR = '㈀㈁㈂㈃㈄㈅㈆㈇㈈㈉㈊㈋㈌㈍';
  var KOR_JA = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
  function markTok(t) {
    t = trim(t).replace(/\s+/g, '');
    if (!t) return null;
    if (/^[ㄱ-ㅎ]$/.test(t)) return 'ㄱ' + KOR_JA.indexOf(t);
    if (CIRC_KOR.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + CIRC_KOR.indexOf(t);   // ㉠ = ㄱ
    if (CIRC_NUM.indexOf(t) >= 0 && t.length === 1) return '#' + (CIRC_NUM.indexOf(t) + 1);
    if (PAREN_KOR.indexOf(t) >= 0 && t.length === 1) return 'ㄱ' + PAREN_KOR.indexOf(t);   // ㈀ = ㄱ
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

  /* ── 8. 한 조각(part) 읽기 ───────────────────────────────────── */
  var RANK = { free: 0, essay: 0, geo: 1, alg: 2, ineq: 3, coord: 4, eq: 5, word: 6, mark: 7, num: 8, ox: 9 };
  var SETLIKE = { num: 1, mark: 1, geo: 1 };   // 이 모양만 답 순서를 따지지 않는다

  /* 값 하나를 읽어 { kind, keys[], unit } 로. keys 가 비면 못 읽은 것 */
  function readValue(raw) {
    var s = trim(raw);
    if (!s) return { kind: 'free', keys: [], unit: '' };
    if (s === '.' || s === '…') return { kind: 'essay', keys: [], unit: '' };
    if (isOx(s)) return { kind: 'ox', keys: [normOx(s)], unit: '' };
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
    if (v != null) return { kind: 'num', keys: [v], unit: unit };
    if (looksGeo(core)) { var g = normGeo(core); if (g) return { kind: 'geo', keys: [g], unit: unit }; }
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
    // 이름표:  「교점: 8」 「l: 6π cm」 「(나): \overline{OD}」
    m = s.match(/^([^:\d]{1,10}):\s*([\s\S]+)$/);
    if (m && trim(m[1])) { label = trim(m[1]); s = trim(m[2]); }
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
    else alts = [s];
    var reads = [], keys = [], kind = null, unit = '', i2;
    for (i = 0; i < alts.length; i++) {
      if (!trim(alts[i])) continue;
      var r = readValue(alts[i]);
      reads.push(r);
      if (!r.keys.length) { keys = []; kind = r.kind; unit = r.unit; break; }
      if (kind === null) { kind = r.kind; unit = r.unit; }
      for (var k = 0; k < r.keys.length; k++) keys.push(r.keys[k]);
    }
    if (!reads.length) return { label: label, kind: 'free', keys: [], unit: '', eq: isEq };
    if (kind === 'geo') {   // 「점 D」는 학생이 그냥 「D」라고 쓸 수도 있다 → 둘 다 정답으로 본다
      var extra = [];
      for (i = 0; i < keys.length; i++) {
        var mm = String(keys[i]).match(/^(점|꼭짓점|변|면)([A-Z]+)$/);
        if (mm) { extra.push(mm[2]); var al = normAlg(mm[2]); if (al) extra.push(al); }
      }
      for (i = 0; i < extra.length; i++) keys.push(extra[i]);
    }
    return { label: label, kind: kind || 'free', keys: keys, unit: unit, eq: isEq };
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
  function expandPM(chunk) {
    var m = String(chunk).match(/^\s*([±∓])\s*([\s\S]+)$/);
    if (!m) return [chunk];
    var body = trim(m[2]);
    return [body, '-' + body];
  }
  function analyze(raw) {
    var s0 = trim(raw);
    var res = { parts: [], gradable: false, shape: 'free', unit: '', labeled: false, essay: false };
    if (!s0 || s0 === '.') { res.essay = true; res.shape = 'essay'; return res; }
    var s = unlatex(s0);
    var chunks = splitTop(s, ','), parts = [], i, j;
    for (i = 0; i < chunks.length; i++) {
      var c = trim(chunks[i]);
      if (!c) continue;
      var ex = expandPM(c);
      for (j = 0; j < ex.length; j++) parts.push(analyzePart(ex[j]));
    }
    if (!parts.length) { res.essay = true; res.shape = 'essay'; return res; }
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
    var used = [], k;
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
    var parts = [], i;
    for (i = 0; i < a.parts.length; i++) {
      parts.push({ label: a.parts[i].label || '', kind: a.parts[i].kind, unit: a.parts[i].unit || '' });
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
    return { shape: shape, self: !a.gradable, gradable: a.gradable, unit: a.unit || '', parts: parts };
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
