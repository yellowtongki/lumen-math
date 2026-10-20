#!/usr/bin/env node
/* 학생앱 v2-132 검사 — 분수 틀 입력 · 엔진 · 리커버리 카드 (외부망 차단, 가짜 Supabase)
 *   실행: SP=<임시폴더> NODE_PATH=node_modules node sync/appbuild/tests/test_v2132.js student_v2-132.html
 *   결과 그림: $SP/v2132_frac.png (분수 틀 입력칸) · $SP/v2132_rcv.png (리커버리 카드) */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-132.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);

  const o = await pg.evaluate(async () => {
    const out = { ver: STU_VER, keys: {} };
    /* 자판에 새 키가 있고 옛 키가 없다 */
    out.keys.num = JSON.stringify(BK_KPAD.num.keys.map((k) => k[1] == null ? k[0] : k[1]));
    out.keys.alg = JSON.stringify(BK_KPAD.alg.keys.map((k) => k[1] == null ? k[0] : k[1]));
    /* 분수 틀 모델 — 키를 순서대로 눌렀을 때 글자·읽기 */
    function run(keys) {
      const fx = bkFxNew();
      keys.forEach((k) => {
        if (k === 'FRAC') bkFxFrac(fx, false); else if (k === 'MIX') bkFxFrac(fx, true);
        else if (k === 'BS') bkFxBack(fx); else if (k === 'NEXT') bkFxNext(fx); else bkFxType(fx, k);
      });
      return { text: bkFxText(fx), read: bkReadKo(bkFxText(fx)), segs: fx.segs.length, cur: fx.cur };
    }
    out.r1 = run(['1', 'FRAC', '6']);                         // 1/6
    out.r2 = run(['6', 'FRAC', '1']);                         // 6/1 (거꾸로) → 읽기 「1분의 6」
    out.r3 = run(['2', 'MIX', '1', 'NEXT', '5']);             // 2 1/5
    out.r4 = run(['MIX', '2', 'NEXT', '1', 'NEXT', '5']);      // 2 1/5 (틀 먼저)
    out.r5 = run(['-', '1', '5', 'FRAC', 'x']);               // -15/x
    out.r6 = run(['(', '2', 'x', '+', '1', ')', 'FRAC', '3']); // (2x+1)/3
    out.r7 = run(['2', 'FRAC', '3', 'NEXT', 'x', '+', '1']);   // 2/3x+1
    out.r8 = run(['1', 'FRAC', '2', ',', '1', 'FRAC', '4']);   // 1/2,1/4 (쉼표는 틀 밖)
    out.r9 = run(['3', 'FRAC', '4', 'BS', 'BS', 'BS']);        // 다 지우면 틀이 없어진다
    out.r10 = run(['7', 'FRAC', 'BS', 'BS']);                  // 분자만 있다 지우기
    /* 엔진 — 틀에서 나온 글자를 실제 정답과 채점 */
    const g = (c, s) => { const r = HWGrade.grade(c, s); return r.gradable ? (r.correct ? 'O' : 'X') : '?'; };
    out.g = [g('\\frac{1}{6}', out.r1.text), g('\\frac{1}{6}', out.r2.text), g('2{1/5}', out.r3.text), g('2\\frac{1}{5}', out.r4.text),
      g('$y=\\,-\\frac{15}{x}\\,$', out.r5.text), g('\\frac{2x+1}{3}', out.r6.text), g('\\frac{2}{3}x+1', out.r7.text),
      g('\\frac{1}{2},\\frac{1}{4}', out.r8.text), g('{43/12}', '43/12'), g('1/4', '4/1'), g('\\frac{28}{x}', '28/x')].join('');
    /* 화면 — 입력칸에 틀을 그려 본다 */
    const fx = bkFxNew(); bkFxType(fx, '-'); bkFxFrac(fx, true); bkFxType(fx, '2'); bkFxNext(fx); bkFxType(fx, '1'); bkFxNext(fx); bkFxType(fx, '5');
    const d = document.createElement('div'); d.style.cssText = 'width:396px;padding:12px;background:#f4f6fb;font-family:sans-serif';
    d.innerHTML = '<div class="bk-fields"><div class="bk-fld foc" id="bkf-T-0">' + bkFxHtml(fx, 0, true) + '</div><span class="bk-unit">cm</span></div>'
      + '<div class="bk-read">' + bkReadKo(bkFxText(fx)) + '</div>';
    document.body.appendChild(d); d.id = 'tdemo';
    out.html = d.innerHTML.length;
    /* 리커버리 카드 — 학원앱이 발행한 rc_calls_pub 을 가짜 서버가 돌려준다 */
    const dt = new Date(); dt.setDate(dt.getDate() + 1);
    const pub = { week: 'w', date: dt.toISOString().slice(0, 10), items: { AAA111: { name: '○○○', slot: '10:00', units: ['다각형', '일차방정식의 활용'] } } };
    studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중1', group: 'T5' }; isTest = false;
    sb = { from() { const b = { select() { return b; }, eq() { return b; }, single() { return Promise.resolve({ data: { value: pub }, error: null }); } }; return b; } };
    await rcvHomeLoad();
    const el = document.getElementById('h3-rcv');
    out.rcv = { shown: el && el.style.display === 'flex', tt: el && el.querySelector('#h3-rcv-tt').textContent, dd: el && el.querySelector('#h3-rcv-dd').textContent };
    /* 홈 화면이 숨어 있으면 그림이 안 찍히므로 카드를 보이는 곳으로 옮긴다 */
    const d2 = document.createElement('div'); d2.id = 'tdemo2'; d2.style.cssText = 'width:396px;padding:12px;background:#f4f6fb;font-family:sans-serif'; d2.appendChild(el); document.body.appendChild(d2);
    return out;
  });
  console.log(JSON.stringify(o, null, 1));
  t('버전 v2-132', o.ver === 'v2-132');
  t('숫자 자판: 분수·대분수 키, 빗금 키 없음', /"FRAC"/.test(o.keys.num) && /"MIX"/.test(o.keys.num) && !/"\/"/.test(o.keys.num), o.keys.num);
  t('문자식 자판: 분수·대분수 키', /"FRAC"/.test(o.keys.alg) && /"MIX"/.test(o.keys.alg) && !/"\/"/.test(o.keys.alg), o.keys.alg);
  t('1 분수 6 → 1/6 · 「6분의 1」', o.r1.text === '1/6' && o.r1.read === '6분의 1', JSON.stringify(o.r1));
  t('6 분수 1 → 6/1 · 「1분의 6」(거꾸로 친 게 보인다)', o.r2.text === '6/1' && o.r2.read === '1분의 6', JSON.stringify(o.r2));
  t('2 대분수 1 다음 5 → 2 1/5', o.r3.text === '2 1/5' && o.r3.read === '2와 5분의 1', JSON.stringify(o.r3));
  t('대분수 먼저 → 2 1/5', o.r4.text === '2 1/5', JSON.stringify(o.r4));
  t('-15 분수 x → -15/x', o.r5.text === '-15/x' && o.r5.read === '마이너스 x분의 15', JSON.stringify(o.r5));
  t('(2x+1) 분수 3 → (2x+1)/3', o.r6.text === '(2x+1)/3', JSON.stringify(o.r6));
  t('2 분수 3 다음 x+1 → 2/3x+1', o.r7.text === '2/3x+1', JSON.stringify(o.r7));
  t('쉼표는 틀 밖으로 → 1/2,1/4', o.r8.text === '1/2,1/4', JSON.stringify(o.r8));
  t('다 지우면 틀 사라짐', o.r9.text === '' && o.r9.segs === 1, JSON.stringify(o.r9));
  t('분자만 지우기', o.r10.text === '' && o.r10.segs === 1, JSON.stringify(o.r10));
  t('엔진: O X O O O O O O O X O', o.g === 'OXOOOOOOOXO', o.g);
  t('리커버리 카드 보임', o.rcv.shown && /리커버리 수업/.test(o.rcv.tt) && /다각형/.test(o.rcv.dd), JSON.stringify(o.rcv));
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 2).join(' | '));
  await pg.locator('#tdemo').screenshot({ path: SP + '/v2132_frac.png' });
  await pg.locator('#tdemo2').screenshot({ path: SP + '/v2132_rcv.png' });
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close();
  process.exit(fail ? 1 : 0);
})();
