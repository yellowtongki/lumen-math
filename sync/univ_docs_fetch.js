#!/usr/bin/env node
// 대학 입시자료 자동 받기 → 구글 드라이브 「대입자료」 폴더
// 네이버 EDU(edu.naver.com) 대학 페이지의 「대입자료 바로가기」 표에서
// 업데이트 날짜가 바뀐 자료만 내려받는다. 맥미니(구글 드라이브 데스크톱 설치)에서 실행.
//
//   node sync/univ_docs_fetch.js              모든 대학 받기
//   node sync/univ_docs_fetch.js --only 서울대  한 곳만
//   node sync/univ_docs_fetch.js --dry        받지 않고 목록만 보기
//   node sync/univ_docs_fetch.js --show       브라우저 창을 띄워서 (문제 확인용)
//   node sync/univ_docs_fetch.js --out <폴더>   저장 위치 직접 지정
//
// 대학 주소(네이버 EDU 고유번호)는 처음에 네이버 검색으로 찾아서
// 「대입자료/_대학주소.json」에 적어 둔다. 틀리면 그 파일을 고치면 된다.
// 사이트 부담을 줄이려고 요청 사이 3초 이상 쉰다.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { chromium } = require('playwright');

const UNIVS = [
  ['서울대', '서울대학교'], ['연세대', '연세대학교'], ['고려대', '고려대학교'],
  ['서강대', '서강대학교'], ['성균관대', '성균관대학교'], ['한양대', '한양대학교'],
  ['중앙대', '중앙대학교'], ['경희대', '경희대학교'], ['한국외대', '한국외국어대학교'],
  ['서울시립대', '서울시립대학교'],
];
const KNOWN = { '서울대': 'H4HRD6183S' }; // 원장님 화면에서 확인한 것
const GAP = 3000;

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry');
const SHOW = args.includes('--show');
const ONLY = opt('--only');

function findDriveRoot() {
  if (opt('--out')) return opt('--out');
  const cs = path.join(os.homedir(), 'Library', 'CloudStorage');
  if (fs.existsSync(cs)) {
    for (const d of fs.readdirSync(cs).filter((n) => n.startsWith('GoogleDrive'))) {
      for (const my of ['내 드라이브', 'My Drive']) {
        const p = path.join(cs, d, my);
        if (fs.existsSync(p)) return path.join(p, '대입자료');
      }
    }
  }
  console.error('❌ 구글 드라이브 폴더를 못 찾았어요. 드라이브 데스크톱 로그인 확인, 또는 --out <폴더> 로 지정하세요.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s) => s.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2));

async function findId(page, full) {
  const q = encodeURIComponent(`${full} 입시정보`);
  await page.goto(`https://search.naver.com/search.naver?query=${q}`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const hrefs = await page.$$eval('a[href*="edu.naver.com/universities/"]', (as) => as.map((a) => a.href));
  for (const h of hrefs) { const m = h.match(/universities\/([A-Za-z0-9]+)/); if (m) return m[1]; }
  return null;
}

async function main() {
  const root = findDriveRoot();
  fs.mkdirSync(root, { recursive: true });
  const idFile = path.join(root, '_대학주소.json');
  const doneFile = path.join(root, '_받은목록.json');
  const ids = { ...KNOWN, ...readJson(idFile, {}) };
  const done = readJson(doneFile, {});
  const news = [];

  console.log(`📁 저장 위치: ${root}${DRY ? '  (미리보기)' : ''}`);
  const browser = await chromium.launch({ headless: !SHOW });
  const ctx = await browser.newContext({ acceptDownloads: true, locale: 'ko-KR' });
  const page = await ctx.newPage();

  for (const [short, full] of UNIVS) {
    if (ONLY && ONLY !== short) continue;
    if (!ids[short]) {
      ids[short] = await findId(page, full);
      await sleep(GAP);
      if (!ids[short]) { console.log(`⚠️ ${short}: 네이버 EDU 주소를 못 찾음 → _대학주소.json 에 직접 적어 주세요`); continue; }
      writeJson(idFile, ids);
    }
    const url = `https://edu.naver.com/universities/${ids[short]}#documents`;
    console.log(`\n🏫 ${short}  ${url}`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) { console.log(`  ❌ 열기 실패: ${e.message}`); continue; }
    await sleep(1500);

    // 「다운로드」 버튼이 있는 줄만 모은다 (구분 · 자료명 · 업데이트)
    const rows = await page.$$eval('tr, li', (els) => els
      .map((el, i) => {
        const btn = [...el.querySelectorAll('a,button')].find((b) => b.textContent.trim() === '다운로드');
        if (!btn) return null;
        const cells = [...el.querySelectorAll('td,th,span,div')].map((c) => c.textContent.trim()).filter(Boolean);
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        const date = (text.match(/20\d\d\.\d\d\.\d\d/) || [''])[0];
        return { i, text, date, cat: cells[0] || '', tag: el.tagName };
      }).filter(Boolean));

    if (!rows.length) { console.log('  ⚠️ 다운로드 표를 못 찾음 (화면 구조가 바뀌었을 수 있음 → --show 로 확인)'); continue; }
    const dir = path.join(root, short);
    fs.mkdirSync(dir, { recursive: true });

    for (const r of rows) {
      const name = clean(r.text.replace(/다운로드/g, '').replace(r.date, '').replace(/^(공통|수시|정시)\s*/, ''));
      const key = `${short}|${r.cat}|${name}`;
      if (done[key] === r.date) { console.log(`  · 그대로  ${r.cat} ${name}`); continue; }
      console.log(`  ⬇ 새 자료 ${r.cat} ${name} (${r.date})`);
      if (DRY) continue;
      try {
        const el = (await page.$$(r.tag))[r.i];
        const btn = await el.$('text=다운로드');
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), btn.click()]);
        const ext = path.extname(dl.suggestedFilename()) || '.pdf';
        const file = path.join(dir, clean(`${r.date.replace(/\./g, '-')}_${r.cat}_${name}`) + ext);
        await dl.saveAs(file);
        done[key] = r.date; writeJson(doneFile, done);
        news.push(`${short} · ${r.cat} ${name} (${r.date})`);
      } catch (e) { console.log(`    ❌ 받기 실패: ${e.message.split('\n')[0]}`); }
      await sleep(GAP);
    }
    await sleep(GAP);
  }
  await browser.close();

  const stamp = new Date().toISOString().slice(0, 10);
  const log = `## ${stamp} 새로 받은 자료 ${news.length}건\n${news.map((n) => `- ${n}`).join('\n')}\n\n`;
  if (!DRY) fs.appendFileSync(path.join(root, '_새자료_기록.md'), log);
  console.log(`\n✅ 끝 — 새로 받은 자료 ${news.length}건`);
}

main().catch((e) => { console.error(e); process.exit(1); });
