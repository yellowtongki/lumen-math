/* ═══════════════════════════════════════════════════════════════════
 * 🔤 루멘 분석기 — 뼈대 비교 (글자만 보고, AI 없이) · docs/lumen_analyzer.md
 * ═══════════════════════════════════════════════════════════════════
 * 문제 글(글자 은행 text_bank.js 가 만든 것)에서 숫자·문자 이름을 가리고 «뼈대»만 남겨
 * 세 글자씩 겹치는 정도(Jaccard)로 두 문제가 얼마나 닮았는지 잰다.
 *   같은문제(same)  뼈대 ≥ 0.90 이고 숫자까지 같다
 *   숫자변형(var)   뼈대 ≥ 0.60 이고 묻는 것(질문)이 같다
 *   유사문제(sim)   뼈대 0.35~0.60 이고 같은 소단원
 *   같은유형(type)  유형 번호(cid)가 같거나 같은 소단원인데 뼈대는 덜 닮음
 *   아님(none)
 * 네트워크·AI 를 쓰지 않는 순수 함수만 둔다 (test_match.js 로 검사).
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* 기준 숫자 — 소사고 고1 검증(run.js 보고서)을 보고 원장님과 함께 조정한다 */
const TH = {
  SAME: 0.90,        // 같은문제: 뼈대 닮음
  VAR: 0.60,         // 숫자변형: 뼈대 닮음
  VAR_ASK: 0.50,     // 질문 «비슷» 표시 기준 (등급 문턱 아님)
  ASK_LIFT: 0.80,    // 질문이 이만큼 닮으면
  LIFT: 0.05,        //   뼈대에 이만큼 얹어 등급을 정한다
  SIM: 0.35,         // 유사문제: 뼈대 닮음 아래 끝
  SHORT: 12,         // 뼈대가 이보다 짧으면(그림 위주 문항) 글자로 판단하지 않는다
};
const RANK = { same: 5, var: 4, sim: 3, type: 2, none: 1 };
const LABEL = { same: '같은문제', var: '숫자변형', sim: '유사문제', type: '같은유형', none: '아님' };

/* ── 글자 고르기 — 같은 뜻의 다른 글자를 하나로 ── */
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', 'ⁿ': 'n' };
const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
function normalize(text) {
  let t = String(text || '');
  t = t.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));   // 전각 → 반각
  t = t.replace(/　/g, ' ');
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹ⁿ]+/g, (m) => '^' + m.split('').map((c) => SUP[c]).join(''));     // x² → x^2
  t = t.replace(/[−–—‒]/g, '-').replace(/[×✕]/g, '×').replace(/[·∙⋅]/g, '·');
  t = t.replace(/≦/g, '≤').replace(/≧/g, '≥').replace(/[⋯…]|\.{3}/g, '…');
  t = t.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/[ᶜ∁]/g, '^C').replace(/\^\{?c\}?(?![a-zA-Z])/g, '^C').replace(/\^\{C\}/g, '^C');   // 여집합
  t = t.replace(/[\[［]/g, '(').replace(/[\]］]/g, ')');
  t = t.replace(/[㈎㈏㈐㈑㈒]/g, (c) => '(' + '가나다라마'['㈎㈏㈐㈑㈒'.indexOf(c)] + ')');
  t = t.replace(/\\(?:left|right)/g, '').replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\(?:cdot|times)/g, '×').replace(/\\le(?:q)?/g, '≤').replace(/\\ge(?:q)?/g, '≥');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

/* 문제 번호 · 배점 · 보기(①~⑤) 떼기 */
function stripMeta(t) {
  let s = String(t || '');
  s = s.replace(/^\s*(?:\d{1,3}\s*[.)]|\(\s*\d{1,3}\s*\))\s*/, '');                 // 23. / 23) / (23)
  s = s.replace(/[\[(]\s*\d+(?:\.\d+)?\s*점\s*[\])]/g, '');                         // [4.8점] (4점)
  const ci = s.search(new RegExp('[' + CIRCLED + ']'));
  if (ci >= 0) s = s.slice(0, ci);                                                     // 보기부터 끝까지
  return s;
}

/* 같은 집합을 다르게 쓴 것 → {N}
 *   {1,2,3,…,10} · {1,2,3,4,5,6,7,8,9,10} · {x|x는 10 이하의 자연수} · {x|1≤x≤10, x는 자연수} · {x|x≤10인 자연수} */
function unifySets(t) {
  let s = t;
  s = s.replace(/\{\s*\d+(?:\s*,\s*\d+)*(?:\s*,\s*…)?(?:\s*,\s*\d+)?\s*\}/g, '{N}');
  s = s.replace(/\{\s*([a-z])\s*\|\s*\1\s*(?:는|은)\s*[0-9a-z]+\s*이하의\s*자연수\s*\}/g, '{N}');
  s = s.replace(/\{\s*([a-z])\s*\|\s*(?:1\s*≤\s*)?\1\s*[≤<]\s*[0-9a-z]+\s*(?:인|,)\s*(?:\1\s*(?:는|은)\s*)?자연수\s*\}/g, '{N}');
  return s;
}

/* 뼈대 — 숫자 #, 대문자 한 글자 V1·V2…, 소문자 한 글자 v1·v2…(나온 순서대로) · n(A) 의 n 은 기호라 그대로 */
/* 같은 뜻 다른 말투 — 「~는?」 = 「~를 구하시오.」, 「만족시키는」 = 「만족하는」 */
const PHRASES = [
  [/만족시키(?=[는ㄴ다])/g, '만족하'], [/만족시킬/g, '만족할'], [/만족시켜/g, '만족해'],
  [/\s*(?:을|를|은|는|이|가)?\s*(?:구하시오|구하여라|구하여 보시오|구하면\s*\?|구한 것은\s*\?)\s*\.?/g, '?'],
  [/\s*(?:은|는)\s*\?/g, '?'],
  [/(?:이)?라고?\s*할\s*때/g, '라 할 때'], [/(?:이)?라고?\s*하자/g, '라 하자'], [/(?:이)?라고?\s*하면/g, '라 하면'],
];
function phrases(t) { let s = t; PHRASES.forEach(([re, to]) => { s = s.replace(re, to); }); return s; }
/* 「두 집합 A={1,5}, B={…}에 대하여 A⊂X⊂B」 와 「{2,4}⊂X⊂{…}」 — 원소를 늘어놓아 정한 집합 이름은 그 뒤에서 {N} 으로 */
function inlineSets(t) {
  const def = new Set();
  const re = /(?<![A-Za-z])([A-Z])\s*=\s*\{N\}/g; let m;
  while ((m = re.exec(t))) def.add(m[1]);
  if (!def.size) return t;
  /* 정의(A={N})는 {N} 으로, 그 뒤에 나오는 이름 A 도 {N} 으로 */
  const parts = t.split(/((?<![A-Za-z])[A-Z]\s*=\s*\{N\})/);
  const seen = new Set();
  return parts.map((pt) => {
    const d = pt.match(/^([A-Z])\s*=\s*\{N\}$/); if (d) { seen.add(d[1]); return '{N}'; }   // 정의는 «{N}» 하나로
    return pt.replace(/(?<![A-Za-z])[A-Z](?![A-Za-z])/g, (c) => (seen.has(c) ? '{N}' : c));
  }).join('');
}
function skeleton(text) {
  let t = normalize(fullText(text));
  t = stripMeta(t);
  t = phrases(t);
  t = unifySets(t);
  t = inlineSets(t);
  t = t.replace(/(^|[(,=\[{:<>≤≥\s])-\s*(?=\d)/g, '$1');            // 음수 부호는 숫자의 일부 — (0,-1) 과 (0,1) 은 같은 뼈대
  t = t.replace(/\^C(?![a-zA-Z])/g, '^ᶜ');                       // 여집합 C 는 이름 바꾸기에서 뺀다
  t = t.replace(/\d+(?:\.\d+)?/g, '#');                          // 숫자 가리기 (소수 포함)
  t = t.replace(/\{N\}/g, '\uE200');                              // {N} 의 N 은 이름이 아니다
  /* 기호 뒤 조사는 기호 읽는 소리에 따라 바뀐다(「{N}이 있다」·「X가 있다」) → 한 가지로 */
  t = t.replace(/(?<=[^가-힣\s])\s?(이|가)(?=[\s.,]|$)/g, '가').replace(/(?<=[^가-힣\s])\s?(은|는)(?=[\s.,]|$)/g, '는')
    .replace(/(?<=[^가-힣\s])\s?(을|를)(?=[\s.,]|$)/g, '를').replace(/(?<=[^가-힣\s])\s?(과|와)(?=[\s.,]|$)/g, '와').replace(/(?<=[^가-힣\s])\s?(으로|로)(?=[\s.,]|$)/g, '로');
  const cap = {}, low = {};
  t = t.replace(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/g, (c, off, all) => {
    if (/[A-Z]/.test(c)) { if (!cap[c]) cap[c] = 'V' + (Object.keys(cap).length + 1); return cap[c]; }
    if (c === 'n' && all[off + 1] === '(') return 'n';
    if (!low[c]) low[c] = 'v' + (Object.keys(low).length + 1); return low[c];
  });
  t = t.replace(/\s+/g, '').replace(/[.,'"·:;!()]/g, '').replace(/\uE200/g, '{N}');   // 괄호도 뺀다: (A-B) 와 A-B 는 같은 뜻
  return t;
}
/* 세 글자 묶음은 V1·v2·{N} 을 한 글자로 친다 (V 와 1 이 따로 세지지 않게) */
function compact(sk) {
  return String(sk || '').replace(/\{N\}/g, '').replace(/V(\d+)/g, (m, d) => String.fromCharCode(0xE000 + Number(d)))
    .replace(/v(\d+)/g, (m, d) => String.fromCharCode(0xE100 + Number(d)));
}
function grams(s, n) { return gramsZ(compact(s), n); }
function gramsZ(z, n) {
  n = n || 3; const g = new Set();
  if (!z) return g;
  if (z.length < n) { g.add(z); return g; }
  for (let i = 0; i + n <= z.length; i++) g.add(z.slice(i, i + n));
  return g;
}
function jaccard(A, B) {
  if (!A.size || !B.size) return 0;
  let inter = 0; const [S, L] = A.size <= B.size ? [A, B] : [B, A];
  S.forEach((x) => { if (L.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}
/* 대문자 이름 두 개를 맞바꾼 뼈대들 — 「A-B」 와 「B-A」 처럼 역할만 바뀐 쌍둥이도 잡는다(이름 6개까지) */
function swapVariants(z) {
  const ids = []; for (const ch of z) { const c = ch.charCodeAt(0); if (c > 0xE000 && c < 0xE100 && ids.indexOf(c) < 0) ids.push(c); }
  const out = []; const top = ids.slice(0, 6);
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
    const a = String.fromCharCode(top[i]), b = String.fromCharCode(top[j]);
    out.push(z.split('').map((ch) => (ch === a ? b : ch === b ? a : ch)).join(''));
  }
  return out;
}
/* 두 글의 뼈대 닮음 (글 그대로 넣어도, 미리 만든 prep() 를 넣어도 된다) — 이름 맞바꾸기 중 가장 높은 값 */
function sim(a, b) { return simP(a && a.g ? a : prep(typeof a === 'string' ? { text: a } : a), b && b.g ? b : prep(typeof b === 'string' ? { text: b } : b)).s; }
function simP(E, C) {
  let best = jaccard(E.g, C.g), swapped = false;
  if (best >= 0.25 && best < 0.98 && C.z) {   /* 아주 다른 글은 이름을 바꿔 봐도 소용없다 — 바꾼 묶음은 한 번만 만들어 둔다 */
    if (!C.sw) C.sw = swapVariants(C.z).map((v) => gramsZ(v));
    for (const g of C.sw) { const j = jaccard(E.g, g); if (j > best + 1e-9) { best = j; swapped = true; } }
  }
  return { s: best, swapped };
}

/* 문제 전체 글 — OCR 이 질문(ask)을 본문에 넣기도 하고 따로 떼기도 한다 → 본문에 질문이 없으면 붙인다 */
function fullText(e) {
  if (typeof e === 'string') return e;
  const t = String((e && e.text) || '').trim(), q = String((e && e.ask) || '').trim();
  if (!q) return t; if (!t) return q;
  const z = (x) => normalize(x).replace(/[\s.,]/g, '');
  const zt = z(t), zq = z(q);
  if (zt.includes(zq)) return t;
  if (zq.includes(zt)) return q;
  /* 본문과 질문이 같은 말로 시작하면(OCR 이 질문 문장을 본문에도 반쯤 적은 것) 긴 쪽 하나만 */
  let n = 0; while (n < zt.length && n < zq.length && zt[n] === zq[n]) n++;
  if (n >= 8 && n >= 0.6 * Math.min(zt.length, zq.length)) return zq.length >= zt.length ? q : t;
  return t + ' ' + q;
}
/* 묻는 것 — OCR 의 ask 가 없으면 글에서 «?» 나 «구하시오» 가 있는 마지막 문장 */
function askOf(entry) {
  if (entry && entry.ask) return entry.ask;
  const t = stripMeta(normalize(typeof entry === 'string' ? entry : (entry && entry.text) || ''));
  const parts = t.split(/(?<=[?？]|구하시오\.?|고르시오\.?|구하여라\.?|것은\?)/).map((x) => x.trim()).filter(Boolean);
  const q = parts.filter((p) => /[?？]|구하시오|고르시오|구하여라/.test(p));
  return q.length ? q[q.length - 1] : (parts[parts.length - 1] || '');
}
function askSim(a, b) {
  const A = grams(skeleton(a), 2), B = grams(skeleton(b), 2);   // 질문은 짧아서 두 글자 묶음
  if (!A.size || !B.size) return null;
  return jaccard(A, B);
}

/* 글 속 숫자(보기 빼고) — 같은문제는 숫자까지 같아야 한다 */
function numsOf(text) {
  const t = unifySets(stripMeta(normalize(text)));
  return (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
}
function numsEqual(a, b) {
  const x = (Array.isArray(a) ? a : numsOf(a)).slice().sort((p, q) => p - q);
  const y = (Array.isArray(b) ? b : numsOf(b)).slice().sort((p, q) => p - q);
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/* 은행 항목 → 비교 준비물 (한 번만 계산) */
function prep(entry) {
  const e = entry || {};
  const text = fullText(e);
  const sk = skeleton(text);
  const ask = askOf(e.ask ? e : { text });
  const z = compact(sk);
  return { text, sk, z, g: gramsZ(z), ask, askG: ask ? grams(skeleton(ask), 2) : new Set(), nums: numsOf(text), fig: !!e.fig, short: sk.length < TH.SHORT, err: e.err || '' };
}

/* 등급 — exam·cand 는 prep() 결과(또는 은행 항목), unitSame·cidSame 은 단원 비교 결과 */
function grade(o) {
  const E = o.exam && o.exam.g ? o.exam : prep(o.exam), C = o.cand && o.cand.g ? o.cand : prep(o.cand);
  const unitSame = !!o.unitSame, cidSame = !!o.cidSame;
  const why = [];
  const unitWhy = () => { if (cidSame) why.push('유형 번호 같음'); else if (unitSame) why.push('같은 소단원'); };
  if (E.short || C.short || !E.text || !C.text) {   /* 그림 위주 · 글자 없음 → 단원으로만 */
    why.push(E.text && C.text ? '그림 위주라 글자 비교 못 함' : '글자 은행에 없음'); unitWhy();
    const kind = cidSame || unitSame ? 'type' : 'none';
    return { kind, score: (cidSame ? 0.08 : 0) + (unitSame ? 0.05 : 0), s: 0, a: null, why: why.join(' · ') };
  }
  const sp = simP(E, C); const s = sp.s;
  const a = E.askG.size && C.askG.size ? jaccard(E.askG, C.askG) : null;
  const ne = numsEqual(E.nums, C.nums);
  why.push('뼈대 ' + s.toFixed(2) + (sp.swapped ? '(이름 바꿈)' : ''));
  if (a != null) why.push(a >= 0.8 ? '질문 같음' : a >= TH.VAR_ASK ? '질문 비슷' : '질문 다름');
  /* 질문 닮음(a)은 «거드는» 신호다 — OCR 이 질문을 떼는 자리가 들쭉날쭉해서 문턱으로 쓰지 않는다(2026-10-18 검증 2회차).
     뼈대(질문까지 붙인 전체 글)가 문턱 바로 아래면 질문이 아주 닮았을 때 한 칸 올려 준다. */
  let kind = 'none';
  const lift = a != null && a >= TH.ASK_LIFT ? TH.LIFT : 0;
  if (s >= TH.SAME && ne) { kind = 'same'; why.push('숫자 같음'); }
  else if (s + lift >= TH.VAR) kind = 'var';
  else if (s + lift >= TH.SIM && (unitSame || cidSame)) kind = 'sim';
  else if (cidSame || unitSame) kind = 'type';
  if (lift && kind !== 'same' && s < TH.VAR && (kind === 'var' || kind === 'sim')) why.push('질문 덕분에 한 칸');
  if (kind !== 'same' && kind !== 'var') unitWhy();
  if (E.fig !== C.fig && (kind === 'same' || kind === 'var')) why.push(E.fig ? '시험만 그림' : '후보만 그림');
  const score = s + 0.15 * (a || 0) + (cidSame ? 0.04 : 0) + (unitSame ? 0.02 : 0);
  return { kind, score: Math.round(score * 1000) / 1000, s: Math.round(s * 1000) / 1000, a: a == null ? null : Math.round(a * 1000) / 1000, why: why.join(' · ') };
}
function better(x, y) { return (RANK[y.kind] - RANK[x.kind]) || (y.score - x.score); }

/* ── 빠른 후보 찾기 — 세 글자 묶음 역색인 ── */
function buildIndex(items) {
  /* items: [{ k, text } 또는 { k, p: prep() }] */
  const docs = items.map((it) => ({ k: it.k, p: it.p || prep(it), meta: it.meta || null }));
  const inv = new Map();
  docs.forEach((d, i) => d.p.g.forEach((g) => { let a = inv.get(g); if (!a) inv.set(g, a = []); a.push(i); }));
  const N = docs.length;
  function topK(query, k, opt) {
    const q = query && query.g ? query : prep(typeof query === 'string' ? { text: query } : query);
    const cnt = new Map(); const maxDf = Math.max(50, Math.floor(N * ((opt && opt.maxDfRatio) || 0.5)));
    q.g.forEach((g) => { const a = inv.get(g); if (!a || a.length > maxDf) return; a.forEach((i) => cnt.set(i, (cnt.get(i) || 0) + 1)); });
    const out = [];
    cnt.forEach((c, i) => { const d = docs[i]; const j = jaccard(q.g, d.p.g); out.push({ k: d.k, i, s: j, meta: d.meta }); });
    out.sort((x, y) => y.s - x.s || (x.k < y.k ? -1 : 1));
    return out.slice(0, k || 10);
  }
  return { docs, size: N, topK, get: (k) => docs.find((d) => d.k === k) || null };
}

/* 단원 글자 비교 — 수학비서 msChapter(「집합의 연산 › … › 원소배치해석 …」) 와 매쓰플랫 소단원 이름 */
function chapterLike(lit, msChapter) {
  const a = String(lit || '').replace(/[^가-힣a-zA-Z0-9]/g, ''); const b = String(msChapter || '').replace(/[^가-힣a-zA-Z0-9›]/g, '');
  if (!a || !b) return false;
  if (b.replace(/›/g, '').includes(a)) return true;
  const segs = b.split('›').filter(Boolean);
  const A = new Set(); for (let i = 0; i + 1 < a.length; i++) A.add(a.slice(i, i + 2));
  return segs.some((sg) => { const B = new Set(); for (let i = 0; i + 1 < sg.length; i++) B.add(sg.slice(i, i + 2)); let n = 0; A.forEach((x) => { if (B.has(x)) n++; }); const m = Math.min(A.size, B.size); return m >= 3 && n / m >= 0.75; });   // 짧은 쪽이 거의 다 들어 있으면 같은 단원
}

module.exports = { TH, RANK, LABEL, fullText, phrases, inlineSets, normalize, stripMeta, unifySets, skeleton, compact, grams, gramsZ, swapVariants, jaccard, sim, simP, askOf, askSim, numsOf, numsEqual, prep, grade, better, buildIndex, chapterLike };
