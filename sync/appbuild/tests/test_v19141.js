/* v19-141 저장 공간 줄이기 검사: node test_v19141.js lumen_v19-141.html */
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const file = path.resolve(process.argv[2] || 'lumen_v19-141.html');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext(); await ctx.route(/^https?:\/\//, (r) => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const big = 'x'.repeat(20000);
  await p.addInitScript((big) => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('ptx_wb_1', big); localStorage.setItem('analyzer_report_A', big); localStorage.setItem('exam_hit_A', big); localStorage.setItem('mf_tree_22_X', big);
    localStorage.setItem('or_students_2026-03', '[{"id":"r1"}]'); localStorage.setItem('lumen_comments_2026-04', '{"r1":"a"}');
    localStorage.setItem('or_students_2026-10', '[{"id":"r2"}]'); localStorage.setItem('or_students_2026-09', '[{"id":"r3"}]'); localStorage.setItem('keep_me', '1'); }, big);
  await p.goto('file://' + file); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({
    disk: Object.keys(localStorage).filter((k) => /^(ptx_|analyzer_report_|exam_hit_|mf_tree_|or_students_20|lumen_comments_20|keep_me)/.test(k)).sort(),
    oldViaGet: localStorage.getItem('or_students_2026-03'), skipViaGet: localStorage.getItem('ptx_wb_1'),
    skip: PULL_SKIP_PREFIX.filter((x) => /^(ptx_|analyzer_report_|exam_hit_|mf_tree_|backup_)$/.test(x)).length,
    mem: [isMemOnlyKey('ptx_x'), isMemOnlyKey('or_students_2026-03'), isMemOnlyKey('or_students_2026-10'), isMemOnlyKey('or_studentdb'), isMemOnlyKey('mf_x')],
    info: window.__store141 }));
  let ok = 0, bad = 0; const t = (c, m) => { if (c) { ok++; console.log('✅', m); } else { bad++; console.log('❌', m, JSON.stringify(r)); } };
  t(JSON.stringify(r.disk) === JSON.stringify(['keep_me', 'or_students_2026-09', 'or_students_2026-10']), '디스크: 받지 않는 키·3달 넘은 서랍 지움, 최근 서랍·다른 키 남음');
  t(r.oldViaGet === '[{"id":"r1"}]', '옛 서랍은 메모리에서 그대로 읽힘');
  t(r.skipViaGet === null, '받지 않는 키(분석기 글자 은행)는 버림');
  t(r.skip === 5, '시작 다운로드 제외 5개 추가');
  t(JSON.stringify(r.mem) === '[true,true,false,false,true]', 'isMemOnlyKey 규칙');
  t(r.info && r.info.keys >= 5, '정리한 키 5개 이상 (mf_tree_ 는 예전 규칙(mf_)으로 먼저 정리됨)');
  t(!errs.length, '페이지 오류 없음 ' + errs.slice(0, 2).join(' | '));
  console.log(`\n${ok} 통과 · ${bad} 실패`); await b.close(); process.exit(bad ? 1 : 0);
})();
