#!/usr/bin/env node
/* 적중 분석 워커 단위 검사 (2026-10-11) — 서버·매쓰플랫·수학비서에 접속하지 않는다
 *   ① 「시험 범위 단원만」 거르기(examUnits · inScope): 소단원이 시험에 없으면 뺀다 · 유형이 없거나 단원을 모르면 남긴다 · 소단원을 모르면 중단원으로
 *   ② normSrc: src.mp · src.scope (scope exam 이면 교과서도 시험 범위)
 *   ③ 큰 자료 나눠 인식(packCells): 한 PDF 10쪽 이하 · 문항 순서·개수 그대로 (매쓰플랫 문서 인식 10쪽 제한)
 *   ④ 지문 붙이기(stackPng) · PNG 읽고 쓰기 · 폴더 나무 줄이기(compactTree) · 내 문제지 과목(mpCurriculum)
 *   실행: NODE_PATH=node_modules node sync/appbuild/tests/test_hit_scope.js */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:9';   /* 워커가 환경변수 없으면 멈추므로 가짜 값 (접속은 하지 않는다) */
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'x';
const W = require('../../exam_hit_worker.js');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

(async () => {
  /* ① 시험 범위 */
  const UNIT = { 1: { mid: '평면좌표', lit: '두 점 사이의 거리' }, 2: { mid: '원의 방정식', lit: '원과 직선' }, 3: { mid: '다항식', lit: '다항식의 연산' },
    4: { mid: '원의 방정식', lit: '원의 방정식' }, 5: { mid: '평면좌표', lit: '' }, 6: { mid: '집합', lit: '' } };
  const U = { of: (cid) => UNIT[cid] || null };
  const X = W.examUnits([{ cid: 1 }, { cid: 2 }, { cid: null }, { cid: 99 }], U);
  t('시험 단원 = 문항 유형의 소단원 2개 · 중단원 2개 (유형 없거나 모르는 문항은 무시)', X.lits.size === 2 && X.mids.size === 2 && X.list.length === 2, JSON.stringify(X.list));
  const mats = [{ k: 'a', cid: 1 }, { k: 'b', cid: 3 }, { k: 'c', cid: 4 }, { k: 'd', cid: null }, { k: 'e', cid: 99 }, { k: 'f', cid: 2 }];
  const kept = mats.filter((m) => W.inScope(m.cid, U, X)).map((m) => m.k).join('');
  t('범위 안(같은 소단원) 남김 · 다른 소단원(같은 중단원이어도) 뺌 · 유형 없음/모름 남김', kept === 'adef', kept);
  const X2 = W.examUnits([{ cid: 5 }], U);   /* 소단원을 모르는 시험 → 중단원으로 */
  t('시험 소단원을 모르면 중단원으로 거른다', W.inScope(1, U, X2) === true && W.inScope(2, U, X2) === false && W.inScope(6, U, X2) === false, JSON.stringify([...X2.mids]));

  /* ② normSrc */
  const ex = { grade: '고1' };
  const a = W.normSrc({ tb: { on: true, mode: 'all', bids: ['1'] }, ms: [1], mp: [2061686, '2032273'], lib: [], mf: true, scope: 'exam' }, ex);
  const b = W.normSrc({ tb: { on: true }, ms: [] }, ex), c = W.normSrc(null, ex);
  t('src.mp 를 글자로 · scope exam 이면 교과서 mode scope', JSON.stringify(a.mp) === '["2061686","2032273"]' && a.scope === 'exam' && a.tb.mode === 'scope', JSON.stringify(a));
  t('mp·scope 가 없던 옛 요청은 mp [] · scope all', JSON.stringify(b.mp) === '[]' && b.scope === 'all' && b.tb.mode === 'all' && JSON.stringify(c.mp) === '[]' && c.scope === 'all', JSON.stringify([b, c]));

  /* ④ PNG 읽고 쓰기 · 지문 붙이기 */
  const mk = (w, h, rgb) => { const px = Buffer.alloc(w * h * 4); for (let i = 0; i < w * h; i++) { px[i * 4] = rgb[0]; px[i * 4 + 1] = rgb[1]; px[i * 4 + 2] = rgb[2]; px[i * 4 + 3] = 255; } return W.pngEncode(w, h, px); };
  const top = mk(300, 40, [255, 0, 0]), q = mk(513, 120, [0, 0, 255]);
  const d = W.pngDecode(q);
  t('PNG 쓰고 다시 읽기 (513×120 · 파랑)', d.w === 513 && d.h === 120 && d.rgba[2] === 255 && d.rgba[0] === 0, JSON.stringify([d.w, d.h]));
  const s = W.pngDecode(W.stackPng(top, q));
  t('지문(위) + 문항(아래) 한 장: 폭 = 넓은 쪽 · 높이 = 둘 + 틈 12 · 위는 빨강 · 아래는 파랑', s.w === 513 && s.h === 40 + 12 + 120 && s.rgba[0] === 255 && s.rgba[((40 + 12 + 5) * 513 + 5) * 4 + 2] === 255, JSON.stringify([s.w, s.h]));
  t('못 읽는 그림이면 문항 그림만', W.stackPng(Buffer.from('nope'), q) === q);

  /* ③ 나눠 인식 — 문항 300개(긴 것 섞임) → PDF 여러 개, 각각 10쪽 이하 */
  let pdfOk = true; try { require('pdf-lib'); } catch (e) { pdfOk = false; }
  if (pdfOk) {
    const tall = mk(513, 1900, [10, 10, 10]);
    const cells = Array.from({ length: 300 }, (_, i) => ({ no: i + 1, buf: i % 37 === 5 ? tall : q }));
    const parts = await W.packCells(cells);
    const all = [].concat(...parts.map((p) => p.cells.map((c) => c.no)));
    t('300문항 → ' + parts.length + '개 PDF · 모두 10쪽 이하', parts.length > 1 && parts.every((p) => p.pageCount <= 10), JSON.stringify(parts.map((p) => p.pageCount)));
    t('문항 순서·개수 그대로 (1~300) · 상자 수 = 문항 수', all.length === 300 && all.every((n, i) => n === i + 1) && parts.every((p) => p.boxes.length === p.cells.length), all.length);
    t('상자는 쪽 안에 (아주 긴 문항도 줄여서 한 쪽에)', parts.every((p) => p.boxes.every((bx) => bx.y0 >= 0 && bx.y1 <= p.A4H && bx.pageNo >= 1 && bx.pageNo <= p.pageCount)));
  } else console.log('(pdf-lib 없음 — 나눠 인식 검사는 건너뜀 · NODE_PATH=node_modules 로 실행)');

  /* ④ 폴더 나무 · 과목 */
  const ct = W.compactTree({ id: 1, name: '작업공간', fileCount: 2, totalFileCount: 5, parentId: null, seq: 0, children: [{ id: 2, name: '교과서 변형', fileCount: 3, totalFileCount: 3, children: [] }] });
  t('폴더 나무 줄이기 {id, n, fc, tc, c} · 순서 그대로', JSON.stringify(ct) === JSON.stringify({ id: 1, n: '작업공간', fc: 2, tc: 5, c: [{ id: 2, n: '교과서 변형', fc: 3, tc: 3, c: [] }] }), JSON.stringify(ct));
  const cur = W.mpCurriculum([{ chapters: [{ curriculumId: 2, chapter: ['08 공통수학2', '02 직선의 방정식'] }] }, { chapters: [{ curriculumId: 2, chapter: ['08 공통수학2', '03 원의 방정식'] }] }], '비상 공수2 중간', '2026-09-16');
  t('내 문제지 과목 = 문항 단원 맨 앞 「08 공통수학2」 → 공통수학2 · 고1 · 1.4.4147.4176', cur.subject === '공통수학2' && cur.grade === '고1' && cur.trie === '1.4.4147.4176', JSON.stringify(cur));
  console.log('\n' + pass + ' 통과 / ' + fail + ' 실패');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('❌', e); process.exit(1); });
