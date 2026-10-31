#!/usr/bin/env node
/* 학생앱 v2-150 검사 — 매쓰플랫식 수식 자판 + 앱이 읽는 답 늘리기 (원장 2026-10-31)
 *   자판을 «실제로 눌러» 칸을 채우고 제출 → 채점 결과를 본다. 외부망 차단 · 가짜 Supabase.
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_stu_v2150.js student_v2-150.html
 *   SP 폴더에 탭별 화면(stu_v2150_<탭>.png)을 남긴다(미리보기). */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'student_v2-150.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);

  const CASES = [
    // [번호, 정답(매쓰플랫 원문), 누를 키들, 기대 결과]
    [201, '0.4\\dot{8}', ['0', '.', '4', '8', 'DOT'], 'O'],
    [202, '0.4\\dot{8}', ['0', '.', '4', '8'], 'X'],
    [203, '\\frac{1}{{a}^{2}}', ['1', 'FRAC', 'a', 'POW', '2'], 'O'],
    [204, '△ABC≡△FED(RHA\\; 합동)', ['△', 'A', 'B', 'C', '≡', '△', 'F', 'E', 'D', 'NEXT', 'R', 'H', 'A'], 'O'],
    [205, '△ABC≡△FED(RHA\\; 합동)', ['△', 'A', 'B', 'C', '≡', '△', 'F', 'E', 'D', 'NEXT', 'R', 'A', 'H'], 'X'],
    [206, '㈎\\; ∠ADE,㈏\\; ∠A,㈐\\; AA', ['∠', 'A', 'D', 'E', 'NEXT', '∠', 'A', 'NEXT', 'A', 'A'], 'O'],
    [207, '7', ['7', '°'], 'O'],
    [208, '\\overline{AB}', ['SEG:선분', 'A', 'B'], 'O'],
    [209, '2\\sqrt{3}', ['2', 'ROOT', '3'], 'O'],
    [210, 'x^{2}+1', ['x', 'POW', '2', 'NEXT', '+', '1'], 'O'],
    [211, '2\\frac{3}{5}', ['2', 'MIX', '3', 'NEXT', '5'], 'O'],
    [212, '\\frac{\\sqrt{3}}{2}', ['FRAC', 'ROOT', '3', 'NEXT', '2'], 'O'],
    [213, '0.\\dot{1}8\\dot{5}', ['0', '.', '1', 'DOT', '8', '5', 'DOT'], 'O'],
    [214, '360˚', ['3', '6', '0'], 'O'],
    [215, 'x^{2}+1', ['x', 'POW', '3', 'NEXT', '+', '1'], 'X']
  ];
  const o = await pg.evaluate(async (CASES) => {
    const out = { ver: STU_VER, res: {}, txt: {} };
    window.idle = async () => { await new Promise((r) => setTimeout(r, 5)); for (let i = 0; i < 200 && BK.busy; i++) await new Promise((r) => setTimeout(r, 10)); await new Promise((r) => setTimeout(r, 5)); };
    const store = {};
    const fakeSb = { from() { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, order() { return b; }, limit() { return b; },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((x) => { if (x && x.key) store[x.key] = JSON.parse(JSON.stringify(x.value)); }); return Promise.resolve({ error: null }); },
      then(r, j) { let keys = Object.keys(store); if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map((k) => ({ key: k, value: store[k] })), error: null }).then(r, j); } }; return b; },
      storage: { from() { return { upload: () => Promise.resolve({ error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }; } } };
    window.sb = fakeSb; window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중2', group: 'T5' };
    window.go = (id) => { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active')); const el = document.getElementById(id); if (el) el.classList.add('active'); };
    window.confirm = () => true; window.alert = () => {}; window.toast = () => {};
    const P = (wpId, num, answer, type) => ({ wpId, num, type: type || 'SHORT_ANSWER', answer, result: '-', userAnswer: '', cnt: 1, self: false, gradable: true, concept: '' });
    const probs = CASES.map((c, i) => P(c[0], String(i + 1), c[1]));
    probs.push(P(299, '99', '(예) 두 변의 길이가 같으므로 이등변삼각형이다.', 'ESSAY'));
    BK.wsq = { list: [{ swId: 9201, wid: 7201, title: '자판 검사 학습지', date: '2026-10-31', status: '학습가능', n: probs.length, auto: true, problems: probs }] };
    BK.scores = {}; BK.loaded = true;
    await bkOpenWs(9201);
    for (const c of CASES) {
      bkFocus(String(c[0]), 0);
      for (const k of c[2]) bkKey(k);
      out.txt[c[0]] = BK.fields.slice();
      bkKey('GO'); await idle();
      const m = BK.scores['ws_9201_' + c[0]];
      out.res[c[0]] = m ? m.r : (BK.soft['ws_9201_' + c[0]] ? 'soft' : 'none');
    }
    out.essayCard = ((document.getElementById('qc-299') || {}).textContent || '').replace(/\s+/g, ' ');
    return out;
  }, CASES);
  t('버전 v2-150', o.ver === 'v2-150', o.ver);
  CASES.forEach((c) => t(`${c[0]} ${c[1]}  ← [${c[2].join(' ')}]  → ${c[3]}`, o.res[c[0]] === c[3], `결과 ${o.res[c[0]]} · 칸 ${JSON.stringify(o.txt[c[0]])}`));
  t('서술형은 사진 찍고 스스로 채점(그대로)', /내 풀이 사진 찍기/.test(o.essayCard) && /사진을 찍으면 정답이 열려요/.test(o.essayCard), o.essayCard.slice(0, 120));

  /* ── 자판 모양 · 예전 키가 다 있는가 · 미리보기 ── */
  const kp = await pg.evaluate(() => {
    const out = { tabs: [], keys: {} };
    bkFocus('210', 0);
    ['num', 'alg', 'geo', 'mark'].forEach((tb) => { bkTab(tb); out.keys[tb] = [...document.querySelectorAll('#bk-kwrap button, #bk-kfn button')].map((b) => b.getAttribute('onclick').replace(/^bkKey\('|'\)$/g, '').replace(/\\'/g, "'")); });
    out.tabs = [...document.querySelectorAll('#bk-kptabs button')].map((b) => b.textContent);
    out.bar = !!document.getElementById('bk-kin') && /제출/.test(document.querySelector('#bk-kpad .kgo').textContent);
    return out;
  });
  t('탭 4개: 기본·문자·도형·보기', kp.tabs.join() === '기본,문자,도형,보기', kp.tabs.join());
  t('답 막대 + «제출 ↑»', kp.bar);
  const all = new Set([].concat(kp.keys.num, kp.keys.alg, kp.keys.geo, kp.keys.mark));
  /* 예전 자판(v2-149)의 키 — 하나도 빠지면 안 된다(학생 제보로 넣은 것들) */
  const OLD = '0 1 2 3 4 5 6 7 8 9 - . , FRAC MIX π : √ ^ | ( ) ° NEXT BS a b c d e f g h i j k l m n o p q r s t u v w x y z + × ÷ = _ < > ≤ ≥ ≠ \' A B C D E F G H I J K L M N O P Q R S T U V W X Y Z △ □ ○ ⊥ ∥ ≡ ∽ ∠ ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ 점 변 면 각 ① ② ③ ④ ⑤ (1) (2) (3) (4) (5) ㈎ ㈏ ㈐ ㈑ ㉥ ㉠ ㉡ ㉢ ㉣ ㉤ ㉮ ㉯ ㉰ ㉱ ㉲'.split(' ');
  const SUB = { '√': 'ROOT', '^': 'POW', '선분': 'SEG:선분', '반직선': 'SEG:반직선', '직선': 'SEG:직선', '호': 'SEG:호' };
  const miss = OLD.concat(['선분', '반직선', '직선', '호']).filter((k) => !all.has(k) && !all.has(SUB[k]));
  t('예전 자판의 키가 모두 있다(√·^·선분은 틀 키로)', miss.length === 0, miss.join(' '));
  t('새 키: 순환점 · ±', all.has('DOT') && all.has('±'));
  t('기본 탭에서 «·»(가운뎃점) 뺌 — «°» 와 헷갈림', kp.keys.num.indexOf('·') < 0);

  for (const [tb, nm, wp, keys] of [['num', '기본', '211', ['2', 'MIX', '3', 'NEXT', '5']], ['alg', '문자', '203', ['1', 'FRAC', 'a', 'POW', '2']], ['geo', '도형', '204', ['△', 'A', 'B', 'C', '≡', '△', 'F', 'E', 'D']], ['mark', '보기', '206', ['∠', 'A', 'D', 'E']]]) {
    await pg.evaluate(([tb, wp, keys]) => { bkFocus(wp, 0); BK.fields = BK.fields.map(() => ''); BK.fx = BK.fx.map(() => bkFxNew()); keys.forEach((k) => bkKey(k)); bkTab(tb); const el = document.getElementById('qc-' + wp); if (el) el.scrollIntoView({ block: 'start' }); }, [tb, wp, keys]);
    await pg.waitForTimeout(250);
    await pg.screenshot({ path: path.join(SP, `stu_v2150_${nm}.png`) });
  }
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅')); await br.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
