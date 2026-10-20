#!/usr/bin/env node
/* 루멘 분석기 뼈대 비교 검사 — 네트워크 없이: node sync/lumen_analyzer/test_match.js
 * 기준 예: 소사고 고1 23번(2026-10-18) — 학평 2번(숫자변형) ≈ 0.78, 나머지 셋 ≤ 0.20 (채팅 실험 skel.py 를 옮김) */
'use strict';
const M = require('./match.js');
let fail = 0, pass = 0;
function ok(cond, name, extra) { if (cond) { pass++; console.log('  ✓', name, extra || ''); } else { fail++; console.log('  ✗', name, extra || ''); } }

const T = {
  exam23: '집합 X={x|x는 10 이하의 자연수}가 있다. 다음 조건을 만족시키는 집합 X의 두 부분집합 A, B에 대하여 집합 A-B의 모든 원소의 합의 최댓값은? (가) n(A∩B)=2, n(A-B)=3 (나) p∈A∩B이면 (p+2)/3∈(A-B)이다. (다) q∈A-B이면 q+2∈B ① 11 ② 12 ③ 13 ④ 14 ⑤ 15',
  hp2: '집합 X={1,2,3,4,5,6,7,8,9,10}이 있다. 다음 조건을 만족시키는 집합 X의 두 부분집합 A, B에 대하여 집합 B-A의 모든 원소의 합의 최댓값은? (가) n(A∩B)=2, n(B-A)=3 (나) p∈A∩B이면 (p+2)/3∈B-A이다. (다) q∈B-A이면 q+3∈A이다. ① 8 ② 10 ③ 12 ④ 14 ⑤ 16',
  hp10: '전체집합 U={x|x는 15 이하의 자연수}의 부분집합 P={x|x는 15 이하의 소수}에 대하여 다음 조건을 만족시키는 U의 부분집합 X의 개수를 구하시오. (가) n(X-P)×n(X∪P^C)=11 (나) 집합 X의 모든 원소의 곱이 M일 때, M의 양의 약수의 개수는 16이다.',
  hp15: '1보다 큰 자연수 k에 대하여 전체집합 U={x|x는 k 이하의 자연수}의 두 부분집합 A={x|x는 k 이하의 짝수}, B={x|x는 k의 약수}가 n(A)×n((A∪B)^C)=15를 만족시킨다. 집합 (A∪B)^C의 모든 원소의 곱을 구하시오.',
  bs101: '집합 A={1,2,3,4,5,6,7,8}의 공집합이 아닌 부분집합 X에 대하여 집합 X의 모든 원소의 합을 S(X)라고 하자. 집합 X가 다음 조건을 모두 만족시킬 때, S(X)의 최댓값은? <보기> (가) X∩{3,4,5}={4} (나) S(X)의 값은 홀수이다. ① 19 ② 21 ③ 23 ④ 25 ⑤ 27',
};

console.log('① 소사고 고1 23번 (기준 실험)');
const s2 = M.sim(T.exam23, T.hp2);
ok(s2 >= 0.70 && s2 <= 0.90, '학평 2번 숫자변형 ≈ 0.78', s2.toFixed(3));
for (const k of ['hp10', 'hp15', 'bs101']) { const s = M.sim(T.exam23, T[k]); ok(s <= 0.20, `${k} ≤ 0.20`, s.toFixed(3)); }
const g2 = M.grade({ exam: { text: T.exam23 }, cand: { text: T.hp2 }, unitSame: true, cidSame: false });
ok(g2.kind === 'var', '학평 2번 → 숫자변형(var)', g2.why);
for (const k of ['hp10', 'hp15', 'bs101']) { const g = M.grade({ exam: { text: T.exam23 }, cand: { text: T[k] }, unitSame: true }); ok(g.kind === 'type', `${k} → 같은유형(type), 같은 소단원이라서`, g.why); }
const gNo = M.grade({ exam: { text: T.exam23 }, cand: { text: T.hp15 }, unitSame: false, cidSame: false });
ok(gNo.kind === 'none', '단원도 다르고 뼈대도 다르면 아님(none)', gNo.why);

console.log('② 같은 문제 · 숫자 가리기');
const g1 = M.grade({ exam: { text: T.exam23 }, cand: { text: T.exam23.replace('① 11 ② 12 ③ 13 ④ 14 ⑤ 15', '① 1 ② 2 ③ 3 ④ 4 ⑤ 5') } });
ok(g1.kind === 'same', '보기만 다른 같은 글 → 같은문제', g1.why);
const t3 = T.exam23.replace('n(A∩B)=2', 'n(A∩B)=4').replace('(p+2)/3', '(p+1)/5');
ok(M.skeleton(t3) === M.skeleton(T.exam23), '숫자만 바꾸면 뼈대가 똑같다');
const g3 = M.grade({ exam: { text: T.exam23 }, cand: { text: t3 } });
ok(g3.kind === 'var', '숫자만 바뀐 글 → 숫자변형(같은문제 아님)', g3.why);
ok(M.skeleton('x^2+3.5x-12=0') === 'v1^#+#v1-#=#', '정수·소수 → #', M.skeleton('x^2+3.5x-12=0'));
ok(!M.numsEqual(T.exam23, t3) && M.numsEqual(T.exam23, T.exam23), 'numsEqual');
ok(M.skeleton('집합 X={1,2,3,…,10}') === M.skeleton('집합 X={x|x는 10 이하의 자연수}'), '{1,2,…,10} = {x|x는 10 이하의 자연수}', M.skeleton('집합 X={1,2,3,…,10}'));
ok(M.skeleton('x²+y²=1') === M.skeleton('x^2+y^2=1'), '위첨자 ² = ^2');

console.log('③ 문자 이름 바꾸기');
const sw = T.exam23.replace(/A/g, '#TMP#').replace(/B/g, 'A').replace(/#TMP#/g, 'B');
const sSw = M.sim(T.exam23, sw);
ok(sSw >= 0.6, 'A↔B 를 맞바꾼 글도 ≥ 0.6', sSw.toFixed(3));
ok(M.grade({ exam: { text: T.exam23 }, cand: { text: sw } }).kind !== 'none', 'A↔B 바꾼 글 → 아님이 아니다');
const re = T.exam23.replace(/X/g, 'S').replace(/p/g, 'a').replace(/q/g, 'b');
ok(M.sim(T.exam23, re) >= 0.95, '이름만 다른 글(X→S, p→a, q→b)은 거의 1', M.sim(T.exam23, re).toFixed(3));
ok(M.skeleton('n(A)=3') === 'nV1=#', 'n(A) 의 n 은 기호로 남는다', M.skeleton('n(A)=3'));
ok(M.skeleton('A^C∩B') === 'V1^ᶜ∩V2', '여집합 C 는 이름이 아니다', M.skeleton('A^C∩B'));

console.log('④ 보기 · 번호 · 배점 떼기');
ok(!/[①-⑤]/.test(M.skeleton(T.exam23)) && !/11/.test(M.stripMeta(T.exam23)), '보기(①~⑤)를 뺀다');
ok(M.skeleton('23. [4.8점] 다음 값은?') === M.skeleton('다음 값은?'), '문제 번호·배점을 뺀다');
ok(M.askOf({ text: T.exam23 }).includes('최댓값은?'), '질문 문장 찾기', M.askOf({ text: T.exam23 }).slice(-20));
ok(M.askSim('집합 A-B의 모든 원소의 합의 최댓값은?', '집합 B-A의 모든 원소의 합의 최댓값은?') >= 0.99, '질문은 이름 순서대로 바꿔 비교 → 같음');

console.log('④-2 본문+질문 합치기 · 말투 (2026-10-18 검증 2회차)');
ok(M.fullText({ text: '두 집합 A={1,2}, B={2} 에 대하여 A-B 의', ask: '원소의 합은?' }) === '두 집합 A={1,2}, B={2} 에 대하여 A-B 의 원소의 합은?', '본문에 질문이 없으면 붙인다');
ok(M.fullText({ text: '두 점 A(1,2), B(3,4) 사이의 거리는?', ask: '두 점 A(1,2), B(3,4) 사이의 거리는?' }) === '두 점 A(1,2), B(3,4) 사이의 거리는?', '본문에 질문이 이미 있으면 한 번만');
ok(M.fullText({ text: '', ask: '중심이 x축 위에 있는 원의 반지름은?' }) === '중심이 x축 위에 있는 원의 반지름은?', '질문 칸에만 글이 있어도 쓴다');
ok(M.fullText({ text: '중심이 x축 위에 있고 두 점 (3,2),(-1,-2)를 지나는 원이 있다.', ask: '중심이 x축 위에 있고 두 점 (3,2),(-1,-2)를 지나는 원의 반지름의 길이는?' }).length < 60, '같은 말로 시작하면 긴 쪽 하나만');
ok(M.skeleton('두 점 A(3,2), B(0,-1) 사이의 거리는?') === M.skeleton('두 점 P(5,7), Q(1,3) 사이의 거리를 구하시오.'), '「~는?」 = 「~를 구하시오.」 · 음수 부호 · 이름', M.skeleton('두 점 A(3,2), B(0,-1) 사이의 거리는?'));
ok(M.skeleton('A⊂X⊂B를 만족시키는 집합 X') === M.skeleton('A⊂X⊂B를 만족하는 집합 X'), '만족시키는 = 만족하는');
const s12 = M.sim({ text: '두 집합 A={1,5}, B={1,2,4,5,10,20} 에 대하여 A⊂X⊂B를 만족시키는 집합 X의 개수는?' }, { text: '{2,4}⊂X⊂{2,4,6,8,10,12,14,16}을 만족하는', ask: '집합 X의 개수를 구하시오.' });
ok(s12 >= 0.6, '원소를 늘어놓은 집합 이름 A·B 와 {…} 를 바로 쓴 것 (12번)', s12.toFixed(3));
const gSoft = M.grade({ exam: { text: '점 (1,2)를 지나고 직선 2x+3y+5=0과 평행한 직선의', ask: 'x 절편은?' }, cand: { text: '점 (2,3)을 지나고 직선 3x+2y-5=0과 평행한 직선의 y절편은?' } });
ok(gSoft.kind === 'var', '질문 떼는 자리가 달라도 숫자변형(질문은 거드는 신호)', gSoft.why);

console.log('⑤ 그림 위주 문항');
const fig = { text: '그림과 같이', fig: true, figNote: '좌표평면 위의 원' };
const gf = M.grade({ exam: fig, cand: { text: T.hp2 }, cidSame: true });
ok(gf.kind === 'type' && /그림 위주/.test(gf.why), '글이 짧으면 글자로 판단하지 않고 단원으로만', gf.why);
ok(M.grade({ exam: fig, cand: { text: T.hp2 } }).kind === 'none', '그림 위주 + 단원 다름 → 아님');
ok(M.grade({ exam: {}, cand: { text: T.hp2 }, unitSame: true }).why.includes('글자 은행에 없음'), '글이 없으면 «글자 은행에 없음»');

console.log('⑥ 역색인 topK');
const items = Object.entries(T).filter(([k]) => k !== 'exam23').map(([k, text]) => ({ k, text }));
for (let i = 0; i < 300; i++) items.push({ k: 'noise' + i, text: `함수 f(x)=x^2-${i}x+${i + 1}의 최솟값을 구하시오. 단, ${i}≤x≤${i + 5}` });
items.push({ k: 'dup', text: T.exam23.replace('q+2', 'q+5') });
const ix = M.buildIndex(items);
const top = ix.topK(M.prep({ text: T.exam23 }), 3);
ok(top[0].k === 'dup' && top[1].k === 'hp2', 'topK 1·2순위 = 숫자만 바뀐 글 · 학평 2번', top.map((x) => x.k + ' ' + x.s.toFixed(2)).join(', '));
ok(ix.size === items.length, '색인 크기');
ok(ix.topK('완전히 다른 English only text zzz', 5).length === 0 || ix.topK('완전히 다른 English only text zzz', 5)[0].s < 0.1, '관계없는 글은 거의 안 걸림');

console.log('⑦ 단원 글자');
ok(M.chapterLike('집합의 연산과 벤 다이어그램', '집합의 연산 › 집합의 연산의 해석과 활용 › 원소배치해석') === true, '수학비서 단원 «집합의 연산» ≈ 소단원 «집합의 연산과 벤 다이어그램»');
ok(M.chapterLike('명제의 역과 대우', '집합의 연산 › 원소배치해석') === false, '다른 단원은 아님');

console.log(`\n${fail ? '❌' : '✅'} 통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
