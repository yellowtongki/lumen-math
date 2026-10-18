#!/usr/bin/env node
/* 학생앱 v2-141 검사 — 보스 보관함 그림(art) · 학교·학년 가리기(hideSch) · 부 이름(bandNames) ·
 *   학교별 추가 버프 기간(bz) · 점수 들어오는 시각 하루 여섯 번 · <script> 블록 node --check
 * 외부망 차단 · 가짜 Supabase(읽기만 흉내, 실서버에 아무것도 안 씀) · 학생 이름은 가짜(○○)
 * 실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2141.js student_v2-141.html
 *   SP 폴더에 레이드 카드 화면(stu_v2141_raid.png)을 남긴다. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const FILE = path.resolve(process.argv[2] || 'student_v2-141.html');
const SP = process.env.SP || '/tmp';
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

/* ── 0) <script> 블록마다 node --check ── */
(function checkScripts() {
  const html = fs.readFileSync(FILE, 'utf8');
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, bad = 0; const dir = fs.mkdtempSync(path.join(SP, 'v2141_js_'));
  while ((m = re.exec(html))) {
    i++; const f = path.join(dir, 'block' + i + '.js'); fs.writeFileSync(f, m[1]);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
    catch (e) { bad++; console.log(String(e.stderr || e.message).slice(0, 600)); }
  }
  t('<script> 블록 ' + i + '개 node --check', i > 0 && bad === 0, bad + '개 오류');
})();

/* 보관함 그림 — 테두리(0) 두른 초록 몸통(1) */
function artBox(name, w, h, body) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) r += (y === 0 || y === h - 1 || x === 0 || x === w - 1) ? '0' : '1';
    rows.push(r);
  }
  rows[0] = '.' + rows[0].slice(1);                     /* 투명 칸 하나 */
  return { name, w, h, pal: ['#120e22', body], rows };
}

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const pg = await (await br.newContext({ viewport: { width: 400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1500);

  const kst = (d) => new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10);
  const D = { today: kst(0), from: kst(-17), to: kst(40), bzFrom: kst(5), bzTo: kst(20), inFrom: kst(-2), inTo: kst(6) };
  const ART = artBox('초록 거인', 64, 56, '#00ff00');
  const ART_BIG = artBox('큰 거인', 130, 80, '#ff00ff');
  const ART_E6 = artBox('별빛 슬라임', 20, 14, '#ffaa00');

  const o = await pg.evaluate(async ({ D, ART, ART_BIG, ART_E6 }) => {
    const out = { ver: STU_VER };
    const store = {};
    const rowsMid = [
      { code: 'AAA111', nm: '나', sch: '테스트중', gr: '중2', pts: 500, n: 40, rank: 1, tier: 'gold', base: 400, bonus: 100, bz: { from: D.bzFrom, to: D.bzTo } },
      { code: 'BBB222', nm: '김○○', sch: '', gr: '', pts: 300, n: 20, rank: 2, tier: 'silver' },
      { code: 'DDD444', nm: '박○○', sch: '테스트고', gr: '고1', pts: 200, n: 15, rank: 3, tier: 'bronze' },
    ];
    store.race_board = {
      at: new Date().toISOString(), name: '테스트 레이스', from: D.from, to: D.to, open: true, showTop: 5,
      tiers: [{ k: 'bronze', n: '브론즈', at: 0 }, { k: 'silver', n: '실버', at: 300 }], demoBands: ['elem'],
      combined: true, bandNames: { elem: '초등부', mid: '중고등부' },
      mid: rowsMid, elem: [{ code: 'CCC333', nm: '이○○', sch: '테스트초', gr: '초6', pts: 90, n: 9, rank: 1, tier: 'bronze' }],
      compare: { elem: { top: 10, n: 9 }, mid: { top: 40, n: 40 } },
      buff: { on: true, max: 0.4, boost: { on: true, flat: 1.3, max: 1, from: D.inFrom, to: D.to,
        windows: [{ sch: '테스트중', grs: ['중2'], from: D.bzFrom, to: D.bzTo }, { sch: '', grs: ['초6'], from: D.inFrom, to: D.inTo }] } },
    };
    store.raid_board = { on: true, at: new Date().toISOString(), list: [
      { id: 'mh', name: '중고등부 레이드', boss: 't_test_1', art: ART, hideSch: true, hp: 1000, dealt: 100, pct: 10, left: 900, yesterday: 5,
        dday: 30, from: D.from, to: D.to, front: ['AAA111', 'BBB222'],
        rows: [{ code: 'AAA111', nm: '나', sch: '테스트중', gr: '중2', dealt: 60, week: 10, job: 'mage' },
               { code: 'BBB222', nm: '김○○', sch: '테스트고', gr: '고1', dealt: 40, week: 4 },
               { code: 'DDD444', nm: '박○○', sch: '', gr: '', dealt: 0, week: 0 }] },
      { id: 'e6', name: '초6 레이드', boss: 'k_new_1', art: ART_E6, hp: 500, dealt: 150, pct: 30, left: 350, dday: 30, from: D.from, to: D.to,
        front: ['CCC333'], rows: [{ code: 'CCC333', nm: '이○○', sch: '', gr: '', dealt: 150 }] },
    ] };
    const rowOf = (k) => (k in store ? { key: k, value: JSON.parse(JSON.stringify(store[k])) } : null);
    const fakeSb = { from(tbl) { const b = { f: {}, select() { return b; }, eq(k, v) { b.f.eq = v; return b; }, in(k, v) { b.f.in = v; return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, is() { return b; }, like() { return b; }, ilike() { return b; }, contains() { return b; }, range() { return b; }, order() { return b; }, limit() { return b; }, update() { return b; }, delete() { return b; },
      maybeSingle() { return Promise.resolve({ data: tbl === 'lumen_store' && b.f.eq ? rowOf(b.f.eq) : null, error: null }); },
      single() { return b.maybeSingle(); },
      insert() { return Promise.resolve({ data: null, error: null }); },
      upsert() { return Promise.resolve({ error: null }); },               /* 아무 데도 안 쓴다 */
      then(r, j) { let keys = tbl === 'lumen_store' ? Object.keys(store) : []; if (b.f.in) keys = keys.filter((k) => b.f.in.indexOf(k) >= 0); if (b.f.eq) keys = keys.filter((k) => k === b.f.eq); return Promise.resolve({ data: keys.map(rowOf), error: null }).then(r, j); } }; return b; } };
    window.sb = fakeSb; window.isTest = false;
    window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5' };
    window.confirm = () => true; window.alert = () => {};

    /* ── 진도 레이스 화면 (레이드 카드가 맨 위) ── */
    const host = document.createElement('div'); host.id = 't-race';
    host.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:900px;overflow:auto;z-index:99999;background:#fff';
    document.body.appendChild(host);
    await rcInit('t-race');
    await new Promise((r) => setTimeout(r, 300));
    const cv = document.getElementById('rd-cv');
    out.cv = cv ? [cv.width, cv.height] : null;
    const px = (x, y) => { const d = cv.getContext('2d').getImageData(x, y, 1, 1).data; return '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''); };
    const g = rdArtGrid(RD.mine.art);
    out.grid = g ? [g[0].length, g.length, g[0][0], g[1][1], g[0][1]] : null;
    out.boss64 = cv ? [px(165, 100), px(165, 150), px(72, 120)] : null;      /* 몸통 가운데 · 아래쪽 · 왼쪽 테두리 근처 */
    out.raidText = (document.querySelector('#t-race .rd') || {}).textContent || '';
    out.namesText = (document.getElementById('rd-names') || {}).textContent || '';
    out.othText = (document.querySelector('#t-race .rd-oth') || {}).textContent || '';
    out.rowsHidden = RD.mine.rows.map((r) => r.sch + '|' + r.gr).join(',');
    out.raceText = host.textContent.replace(/\s+/g, ' ');
    out.tabs = Array.prototype.map.call(host.querySelectorAll('.rc-tabs .rt'), (e) => e.textContent).join(',');
    out.scLines = Array.prototype.map.call(host.querySelectorAll('.rc-row .sc'), (e) => e.textContent);
    /* 큰 그림(130 x 80)은 한 칸을 줄여 통째로 */
    RD.mine.art = ART_BIG; RD.anim = 0; rdPaint();
    out.bossBig = [px(165, 130), px(40, 130), px(290, 130)];
    /* 그림이 없으면 예전 보스(드래곤) */
    RD.mine.art = null; RD.mine.boss = 'dragon'; rdPaint();
    out.bossNoArt = px(165, 100);
    RD.mine.art = ART; rdPaint();

    /* ── 리그 머리 부 이름 ── */
    try { LG.tab = 'race'; const lb = document.getElementById('lg-band'); if (lb) { lgPaint(); out.lgBand = lb.textContent; } } catch (e) { out.lgBandErr = String(e); }

    /* ── 추가 버프 띠 — 내 기간 전 / 안 / 내 기간 없음 / windows 없음(예전) ── */
    await bfLoad();
    const banner = () => (document.getElementById('bz-banner') || {}).textContent || '';
    out.bzMe = BF.me ? BF.me.code : null;
    out.bzBefore = banner();
    BF.me.bz = { from: D.inFrom, to: D.inTo }; bzRender(); out.bzInside = banner();
    BF.me.bz = undefined; bzRender(); out.bzNone = banner();
    BF.me.bz = { from: kst2(-10), to: kst2(-1) }; bzRender(); out.bzPast = banner();
    function kst2(d) { return new Date(Date.now() + 9 * 3600000 + d * 86400000).toISOString().slice(0, 10); }
    const keep = BF.boost;
    BF.boost = { on: true, flat: 1.3, max: 1, from: D.inFrom, dday: 3 }; bzRender(); out.bzLegacy = banner();
    BF.boost = keep;

    /* ── 달력 「추가 버프 시작」 ── */
    const season = { name: '테스트 레이스', from: D.from, to: D.to, buff: { on: true, boost: { on: true, flat: 1.3, max: 1,
      windows: [{ sch: '테스트중', grs: ['중1', '중3'], from: '2099-01-01', to: '2099-01-10' }, { sch: '테스트중', grs: ['중2'], from: D.bzFrom, to: D.bzTo }] } } };
    const day = (B, d) => ((B.byDay[d] || []).filter((x) => x.t === '추가 버프 시작').length);
    BF.me.bz = { from: D.inFrom, to: D.inTo };
    let B = calBuild({ race_season: season }, studentInfo); out.calOwn = [day(B, D.inFrom), day(B, D.bzFrom)];
    const keepMe = BF.me, keepRC = RC.board; BF.me = null; RC.board = null;      /* 순위판을 아직 못 읽었을 때 → 규칙으로 찾기 */
    B = calBuild({ race_season: season }, studentInfo); out.calRule = [day(B, D.bzFrom), day(B, '2099-01-01')];
    B = calBuild({ race_season: season }, { school: '다른중학교', grade: '중학교 2학년' }); out.calNoWin = Object.keys(B.byDay).filter((d) => day(B, d)).length;
    BF.me = keepMe; RC.board = keepRC;
    const legacy = { name: '옛 시즌', from: D.from, to: D.to, buff: { on: true, boost: { on: true, flat: 1.3, max: 1, from: D.inFrom } } };
    B = calBuild({ race_season: legacy }, studentInfo); out.calLegacy = day(B, D.inFrom);
    host.scrollTop = 0;
    return out;
  }, { D, ART, ART_BIG, ART_E6 });

  await pg.waitForTimeout(200);
  const rdEl = await pg.$('#t-race .rd'); if (rdEl) await rdEl.screenshot({ path: path.join(SP, 'stu_v2141_raid.png') });
  const tmEl = await pg.evaluateHandle(() => Array.prototype.filter.call(document.querySelectorAll('#t-race .rc-card'), (e) => /하루 여섯 번/.test(e.textContent))[0] || null);
  if (tmEl && tmEl.asElement()) await tmEl.asElement().screenshot({ path: path.join(SP, 'stu_v2141_times.png') });
  await pg.evaluate(() => { const h = document.getElementById('t-race'); const bz = document.getElementById('bz-banner'); BF.me.bz = { from: '2099-11-25', to: '2099-12-10' }; bzRender(); h.insertAdjacentHTML('afterbegin', '<div id="t-bz" style="padding:12px">' + bz.innerHTML + '</div>'); h.scrollTop = 0; });
  const bzEl = await pg.$('#t-bz'); if (bzEl) await bzEl.screenshot({ path: path.join(SP, 'stu_v2141_bzsoon.png') });

  console.log(JSON.stringify({ grid: o.grid, boss64: o.boss64, bossBig: o.bossBig, bossNoArt: o.bossNoArt, tabs: o.tabs, sc: o.scLines, lgBand: o.lgBand, lgBandErr: o.lgBandErr, bzMe: o.bzMe, cal: [o.calOwn, o.calRule, o.calNoWin, o.calLegacy] }, null, 0));
  t('버전 v2-141', o.ver === 'v2-141', o.ver);
  /* 1) 보스 그림 */
  t('art → 격자 64 x 56 · 투명(.)·테두리·몸통 색', o.grid && o.grid[0] === 64 && o.grid[1] === 56 && o.grid[2] === null && o.grid[3] === '#00ff00' && o.grid[4] === '#120e22', JSON.stringify(o.grid));
  t('레이드 캔버스 330 x 360 그대로', o.cv && o.cv[0] === 330 && o.cv[1] === 360, JSON.stringify(o.cv));
  t('64 x 56 보스를 art 색(#00ff00)으로 그림', o.boss64 && o.boss64[0] === '#00ff00' && o.boss64[1] === '#00ff00', JSON.stringify(o.boss64));
  t('130 x 80 큰 보스도 줄여서 통째로(가운데·양끝 #ff00ff)', o.bossBig.every((c) => c === '#ff00ff'), JSON.stringify(o.bossBig));
  t('art 없으면 예전 보스(초록 아님)', o.bossNoArt !== '#00ff00' && o.bossNoArt !== '#0d0a1d', o.bossNoArt);
  t('다른 학년 줄: 보관함 보스 이름(art.name) 「별빛 슬라임」', /별빛 슬라임/.test(o.othText) && /초6 레이드/.test(o.othText), o.othText);
  /* 2) 학교·학년 가리기 */
  t('hideSch → 레이드 줄 학교·학년 비움', o.rowsHidden === '||,||,||' || o.rowsHidden.split(',').every((x) => x === '|'), o.rowsHidden);
  t('hideSch → 레이드 카드에 학교·학년 글자 없음 · 군더더기 없음', !/테스트중|테스트고|중2|고1/.test(o.raidText) && !/ · \)|\(\)| · ·/.test(o.raidText), o.raidText.slice(0, 300));
  t('앞줄 이름줄: 나 · 김○○ (학교 없음)', /나/.test(o.namesText) && /김○○/.test(o.namesText) && !/테스트/.test(o.namesText), o.namesText);
  t('순위 줄: 학교·학년이 빈 줄은 « · » 로 시작하지 않음', o.scLines.length >= 2 && o.scLines.every((x) => !/^\s*·/.test(x)) && o.scLines[0].indexOf('중2 테스트중 · ') === 0, JSON.stringify(o.scLines));
  /* 3) 부 이름 */
  t('부 탭: 초등부 · 중고등부', /중고등부/.test(o.tabs) && /초등부/.test(o.tabs), o.tabs);
  t('순위표 머리 「중고등부 순위」 · 「중등부」 글자 없음', /중고등부 순위/.test(o.raceText) && !/중등부/.test(o.raceText), (o.raceText.match(/.{20}중등부.{20}/) || [''])[0]);
  t('리그 머리 부 이름 「중고등부」', o.lgBand === '중고등부', o.lgBand + ' ' + (o.lgBandErr || ''));
  /* 4) 추가 버프 */
  t('버프: 내 줄(BF.me) 찾음', o.bzMe === 'AAA111', o.bzMe);
  const md = (d) => Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8, 10)) + '일';
  t('버프 기간 전 → 「🔥 ○월 ○일부터 시험 대비 버프!」', o.bzBefore.indexOf('🔥 ' + md(D.bzFrom) + '부터 시험 대비 버프!') === 0 && /×1\.3/.test(o.bzBefore) && !/추가 버프 발동/.test(o.bzBefore), o.bzBefore);
  t('버프 기간 안 → 띠 · 남은 날은 내 기간 끝(bz.to)까지 = 7일', /추가 버프 발동 · 남은 7일/.test(o.bzInside), o.bzInside.slice(0, 120));
  t('내 기간 없음 → 띠 없음', o.bzNone === '', o.bzNone);
  t('내 기간 지남 → 띠 없음', o.bzPast === '', o.bzPast);
  t('windows 없으면 예전 그대로(dday 3 → 남은 4일)', /추가 버프 발동 · 남은 4일/.test(o.bzLegacy), o.bzLegacy.slice(0, 120));
  t('달력: 내 bz.from 에 「추가 버프 시작」 (windows 첫날 아님)', o.calOwn[0] === 1 && o.calOwn[1] === 0, JSON.stringify(o.calOwn));
  t('달력: 순위판 없을 때 규칙(학교·학년 첫 줄)으로 내 시작일', o.calRule[0] === 1 && o.calRule[1] === 0, JSON.stringify(o.calRule));
  t('달력: 맞는 기간 없는 학생은 표시 없음', o.calNoWin === 0, o.calNoWin);
  t('달력: windows 없는 예전 시즌은 boost.from', o.calLegacy === 1, o.calLegacy);
  /* 5) 하루 여섯 번 */
  t('「점수는 하루 여섯 번 들어와요」 · 세 번 문구 없음', /점수는 하루 여섯 번 들어와요/.test(o.raceText) && !/하루 세 번/.test(o.raceText), '');
  t('시각 6칸: 새벽 4시 · 오후 4시 · 저녁 6시 · 저녁 8시 · 밤 10시 · 밤 12시(자정)', /새벽\s*4시/.test(o.raceText) && /오후\s*4시/.test(o.raceText) && /저녁\s*6시/.test(o.raceText) && /저녁\s*8시/.test(o.raceText) && /밤\s*10시/.test(o.raceText) && /12시\(자정\)/.test(o.raceText), '');
  t('조금 늦을 수 있다는 안내', /조금 늦게 들어올 때도 있어요/.test(o.raceText), '');
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log('\n스크린샷: ' + ['stu_v2141_raid.png', 'stu_v2141_times.png', 'stu_v2141_bzsoon.png'].map((f) => path.join(SP, f)).join(' · '));
  console.log(`\n${pass} 통과 / ${fail} 실패`);
  await br.close(); process.exit(fail ? 1 : 0);
})();
