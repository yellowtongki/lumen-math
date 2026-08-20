/* ══════════════════════════════════════════════════════════════════════
 * 교재 채점 엔진 (v18-74) — 학생앱·수집기 공용
 *   매쓰플랫 교재 정답을 정규화해 학생 입력과 대조한다.
 *   불변식: 정답 원본을 그대로 넣으면 반드시 correct (오채점 0).
 *   못 읽는 답(도형·문자식·서술)은 gradable:false → 선생님 수기채점.
 *
 *   이 파일은 Node(수집기)와 브라우저(학생앱) 양쪽에서 쓴다.
 *   브라우저에서는 <script>로 인라인 복사해 넣는다(단일 HTML 원칙).
 * ════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a || 1; }
  function frac(n, d) { if (d === 0) return null; var g = gcd(n, d); var s = (d < 0) ? -1 : 1; return { v: (n / d), num: s * n / g, den: Math.abs(d) / g }; }

  /* 답 한 조각 → 값. 읽으면 {v, num?, den?}, 못 읽으면 null */
  function toValue(raw) {
    if (raw == null) return null;
    var s = String(raw).trim();
    if (!s) return null;
    // LaTeX 꾸밈·공백 제거
    s = s.replace(/\\text\s*\{[^}]*\}/g, '')     // \text{ cm}
         .replace(/\\mathrm\s*\{[^}]*\}/g, '')
         .replace(/\\left|\\right/g, '')
         .replace(/\\;|\\,|\\!|\\ |\s+/g, '')
         .replace(/\$/g, '');
    // 끝의 단위 문자(cm, 층, 개, 원 …) 제거 — 숫자/기호가 아닌 꼬리
    s = s.replace(/[a-zA-Z가-힣]+$/,'');
    s = s.replace(/°|℃|²|³|\^\{?2\}?|\^\{?3\}?/g, '');
    if (!s) return null;
    // 분수 \frac{a}{b}, \dfrac, \tfrac
    var m = s.match(/^(-?)\\[dt]?frac\{(-?\d+)\}\{(-?\d+)\}$/);
    if (m) { var f = frac(Number(m[2]), Number(m[3])); if (f && m[1] === '-') { f.v = -f.v; f.num = -f.num; } return f; }
    // 대분수 3\frac{1}{2}
    m = s.match(/^(-?\d+)\\[dt]?frac\{(\d+)\}\{(\d+)\}$/);
    if (m) { var w = Number(m[1]); var whole = Math.abs(w), fr = frac(whole * Number(m[3]) + Number(m[2]), Number(m[3])); if (!fr) return null; if (w < 0) { fr.v = -fr.v; fr.num = -fr.num; } return fr; }
    // a/b
    m = s.match(/^(-?\d+)\/(-?\d+)$/);
    if (m) { var f2 = frac(Number(m[1]), Number(m[2])); return f2; }
    // 순수 숫자 (앞 0 보정: .5 → 0.5)
    if (/^-?\.\d+$/.test(s)) s = s.replace(/^(-?)\./, '$10.');
    if (/^-?\d+(\.\d+)?$/.test(s)) return { v: Number(s) };
    // ± 는 두 답(±x)이므로 여기서는 못 읽음 처리(복수답으로 분해는 grade에서)
    return null;
  }

  /* "±8" → ["8","-8"], "64,64,±8" 는 grade에서 콤마 분리 후 처리 */
  function expandPM(piece) {
    var s = String(piece).trim();
    var m = s.match(/^±\s*(.+)$/) || s.match(/^\\pm\s*(.+)$/);
    if (m) { return ['\\;' + m[1], '-' + m[1].replace(/^\\;/, '') ]; }
    return [s];
  }

  function splitAnswer(a) {
    // 콤마로 나누고 각 조각의 ± 를 두 값으로 펼침
    var parts = String(a).split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
    var out = [];
    parts.forEach(function (p) { expandPM(p).forEach(function (q) { out.push(q); }); });
    return out;
  }

  /* 이 정답을 엔진이 채점할 수 있나? (전부 숫자계열이어야 gradable) */
  function isGradable(answerRaw) {
    var pieces = splitAnswer(answerRaw);
    if (!pieces.length) return false;
    for (var i = 0; i < pieces.length; i++) { if (toValue(pieces[i]) == null) return false; }
    return true;
  }

  function valuesOf(str) {
    var pieces = splitAnswer(str);
    var vals = [];
    for (var i = 0; i < pieces.length; i++) { var v = toValue(pieces[i]); if (v == null) return null; vals.push(v.v); }
    return vals.sort(function (a, b) { return a - b; });
  }

  /* 채점: correct 정답 vs student 학생입력.
   * 반환: { gradable, correct } — gradable:false면 수기채점으로. */
  function grade(correctRaw, studentRaw) {
    if (!isGradable(correctRaw)) return { gradable: false, correct: false };
    var cv = valuesOf(correctRaw);
    if (cv == null) return { gradable: false, correct: false };
    if (studentRaw == null || String(studentRaw).trim() === '') return { gradable: true, correct: false };
    var sv = valuesOf(studentRaw);
    if (sv == null) return { gradable: true, correct: false };   // 학생이 이상하게 입력
    if (cv.length !== sv.length) return { gradable: true, correct: false };
    var eps = 1e-9;
    for (var i = 0; i < cv.length; i++) { if (Math.abs(cv[i] - sv[i]) > eps) return { gradable: true, correct: false }; }
    return { gradable: true, correct: true };
  }

  /* 입력칸 옆에 표시할 단위 라벨 추출 ("72 cm³" → "cm³", 없으면 "") */
  function unitOf(answerRaw) {
    var s = String(answerRaw || '');
    var m = s.match(/\\text\s*\{([^}]*)\}/);
    if (m) return m[1].trim();
    m = s.match(/([a-zA-Z가-힣]+)\s*$/);      // 끝 단위 문자
    if (m && !/frac|text|mathrm|left|right|pm/.test(m[1])) return m[1];
    if (/㎠|㎡|㎤|㎥|°|℃/.test(s)) return (s.match(/㎠|㎡|㎤|㎥|°|℃/) || [''])[0];
    return '';
  }

  var API = { toValue: toValue, grade: grade, isGradable: isGradable, unitOf: unitOf, valuesOf: valuesOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.HWGrade = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
