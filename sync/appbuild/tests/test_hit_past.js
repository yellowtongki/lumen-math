#!/usr/bin/env node
/* 적중 분석 워커 «지난 기출 비교» 단위 검사 (2026-10-11) — 서버·매쓰플랫·수학비서에 접속하지 않는다
 *   ① pastCfg / normSrc: src.past 없으면 켬 · 최근 4년 · 중간/기말 모두
 *   ② pastSelect: 같은 학교·학년 · 분석하는 시험보다 앞선 시험만 · 같은 시험지 id 뺌 · 최근 n년 · 같은 시험만 · 같은 교육과정 다른 과목 뺌 · 다리(유형 번호) 없는 시험 뺌
 *   ③ pastCands: 원본 번호 같음 → 같은 유형 번호 → 같은 유형 이름 · 최근 시험부터 3개 · 원장 확정 후보는 맨 앞
 *   실행: node sync/appbuild/tests/test_hit_past.js */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:9';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'x';
const W = require('../../exam_hit_worker.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

t('pastCfg 기본 = 켬 · 4년 · 중간/기말 모두', JSON.stringify(W.pastCfg(null)) === '{"on":true,"years":4,"sameTerm":false}', JSON.stringify(W.pastCfg(null)));
t('pastCfg 요청값 · 이상한 해 수는 4년', JSON.stringify(W.pastCfg({ past: { on: false, years: 2, sameTerm: true } })) === '{"on":false,"years":2,"sameTerm":true}' && W.pastCfg({ past: { years: 99 } }).years === 4);
const ns = W.normSrc({ tb: { on: true, bids: [] }, ms: [], past: { years: 5 } }, { grade: '고1' }), ns0 = W.normSrc(null, { grade: '중1' });
t('normSrc 에 past (요청 없으면 기본 켬)', ns.past.on && ns.past.years === 5 && ns0.past.on && ns0.past.years === 4, JSON.stringify([ns.past, ns0.past]));

const cell = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1, img: 'x/' + (i + 1) + '.png', imgUrl: 'u' + (i + 1), difficulty: 3 }));
const E = (id, year, sem, term, title, n, grade) => ({ id, year: String(year), semester: String(sem), term, grade: grade || '고1', title: '내신 ' + year + '년 경기 부천시 범박고 ' + (grade || '고1') + ' 공통 ' + sem + '학기 ' + term + ' ' + title, cells: cell(n || 3) });
const ms = { exams: [
  E(1, 2025, 2, '중간', '공통수학2'), E(2, 2025, 2, '기말', '공통수학2'), E(3, 2025, 1, '중간', '공통수학1'), E(4, 2024, 2, '중간', '수학하'),
  E(5, 2021, 2, '중간', '수학하'), E(6, 2026, 2, '중간', '공통수학2'), E(7, 2026, 2, '기말', '공통수학2'), E(8, 2025, 2, '중간', '대수', 3, '고2'), E(9, 2023, 1, '기말', '수학상'),
  E(10, 2024, 2, '기말', '수학하') ] };
const pr = (cids, pid) => cids.map((c, i) => ({ no: i + 1, conceptId: c, concept: 'T' + c, problemId: pid && i === 0 ? pid : 1000 + i, pimg: 'https://img/' + c }));
const br = { byMydb: { 1: { problems: pr([501, 502, 503], 800205) }, 2: { problems: pr([501, 504, 505]) }, 3: { problems: pr([501, 502, 503]) }, 4: { problems: pr([502, 509, 510, 511]) },
  5: { problems: pr([501, 502, 503]) }, 6: { problems: pr([501, 502, 503]) }, 7: { problems: pr([501, 502, 503]) }, 8: { problems: pr([501, 502, 503]) }, 9: { problems: pr([601, 602, 603]) } } };
const exam = { school: '범박고', grade: '고1', year: 2026, semester: '2', term: '중간', subject: '공통수학2' };
const S = W.pastSelect(exam, ms, br, W.pastCfg(null), 6);
const ids = S.exams.map((x) => x.mydb).join(',');
t('같은 학년 · 앞선 시험만(2026 2학기 중간 자신·기말 뺌) · 4년 안(2021 뺌) · 다른 학년 뺌 · 같은 교육과정 다른 과목(공통수학1) 뺌 · 다리 없는 10 뺌 · 최근 순',
  ids === '2,1,4,9' && S.skip.course === 1 && S.skip.noBridge === 1, ids + ' ' + JSON.stringify(S.skip));
t('문항 수가 다리와 다른 시험(4: 기출 3 · 다리 4)은 번호 추정(approx) · 그림은 매쓰플랫 그림', S.probs.filter((p) => p.mydb === '4').every((p) => p.approx && /^https:\/\/img\//.test(p.url) && !p.store) && S.probs.filter((p) => p.mydb === '1').every((p) => !p.approx && p.store === 'x/' + p.no + '.png'), JSON.stringify(S.probs.filter((p) => p.mydb === '4')[0]));
const S2 = W.pastSelect(exam, ms, br, { on: true, years: 4, sameTerm: true }, null);
t('같은 시험만(중간) → 1·4 · 최근 1년이면 2025 것만', S2.exams.map((x) => x.mydb).join(',') === '1,4' && W.pastSelect(exam, ms, br, { on: true, years: 1, sameTerm: false }, null).exams.map((x) => x.mydb).join(',') === '2,1', S2.exams.map((x) => x.mydb).join(','));
const it = { no: 1, cid: 501, type: 'T999', src: 'p800205', diff: 3 };
const c1 = W.pastCands(it, S.probs, null).map((c) => c.p.k);
t('후보: 원본 번호 같음(2025 중간 1번) → 같은 유형 번호 최근 순(2025 기말 1번) · 최대 3개', c1[0] === 'past:1:1' && c1[1] === 'past:2:1' && c1.length === 2, JSON.stringify(c1));
const it2 = { no: 2, cid: 777, type: 'T502', src: '', diff: 3 };
const c2 = W.pastCands(it2, S.probs, null).map((c) => c.p.k);
t('유형 번호가 달라도 유형 이름이 같으면 후보 (교육과정이 바뀐 해)', JSON.stringify(c2) === '["past:1:2","past:4:1"]', JSON.stringify(c2));
const c3 = W.pastCands(it, S.probs, 'past:9:3').map((c) => c.p.k);
t('원장님이 확정한 후보는 유형이 달라도 맨 앞에 남김', c3[0] === 'past:9:3' && c3.length === 3, JSON.stringify(c3));
console.log('\n' + pass + ' 통과 / ' + fail + ' 실패'); process.exit(fail ? 1 : 0);
