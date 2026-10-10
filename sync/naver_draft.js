#!/usr/bin/env node
/**
 * sync/naver_draft.js — 네이버 블로그 임시저장 자동화
 *
 * 글 폴더의 post.md 와 카드·사진을 네이버 블로그 글쓰기 화면에 넣고 **임시저장**까지 한다.
 * **발행 버튼은 절대 누르지 않는다.** 원장님이 임시저장함에서 확인하고 직접 발행하신다.
 *
 *   node sync/naver_draft.js --login              ① 처음 한 번: 네이버 로그인 (직접 입력)
 *   node sync/naver_draft.js blog/<폴더>           ② 글 넣고 임시저장
 *   node sync/naver_draft.js blog/<폴더> --dry     무엇을 할지 순서만 보기 (브라우저 안 염)
 *   node sync/naver_draft.js blog/<폴더> --no-img  글자만 넣고 그림은 손으로
 *
 * ⚠️ **맥미니·학원 컴퓨터에서만 돌린다.** 클라우드에서 돌리면 데이터센터 IP로 잡혀 캡차가 뜬다.
 * 🔒 비밀번호는 이 파일도 저장소도 모른다. 원장님이 브라우저 창에 직접 넣고, 로그인 상태(쿠키)만
 *    `sync/_naver_profile/` 에 남는다 (gitignore됨). 그 폴더를 지우면 다시 로그인하면 된다.
 *
 * 막히면 멈춘다: 화면이 바뀌어 못 찾는 단계가 나오면 **그 자리에서 멈추고** 무엇을 손으로 할지
 * 알려준다. 창은 열린 채로 둔다. 조치 후 터미널에서 Enter 를 치면 이어서 간다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const PROFILE = path.join(__dirname, '_naver_profile');
const args = process.argv.slice(2);
const opt = {
  login: args.includes('--login'),
  dry: args.includes('--dry'),
  noImg: args.includes('--no-img'),
  slow: args.includes('--slow'),
};
const folder = args.find(a => !a.startsWith('--'));
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}
async function pause(why, what) {
  log('');
  log('⏸  ' + why);
  log('   👉 ' + what);
  await ask('   다 하셨으면 Enter 를 눌러주세요… ');
}

// ── post.md 를 «글자 덩어리»와 «그림» 순서로 쪼갠다 ──────────────
function plan(dir) {
  const raw = fs.readFileSync(path.join(dir, 'post.md'), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('post.md 맨 위에 --- 머리말이 없습니다');
  const meta = {};
  m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });

  const steps = [];
  let buf = [];
  const flush = () => { const t = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim(); if (t) steps.push({ kind: 'text', text: t }); buf = []; };

  for (const line of m[2].split('\n')) {
    let mm;
    if ((mm = line.match(/^\[카드 \d+:\s*([^\]]+?)\s*\]$/))) {
      flush();
      const f = path.join(dir, 'cards', mm[1]);
      steps.push({ kind: 'image', file: f, label: '카드 ' + mm[1], exists: fs.existsSync(f) });
    } else if ((mm = line.match(/^\[실사진 (\d):\s*([^\]]*)\]$/))) {
      flush();
      // 실사진은 파일 이름이 글에 안 적혀 있을 수 있다 — photo_ 로 시작하는 파일을 순서대로 집는다
      const photos = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^photo_/i.test(f)).sort() : [];
      const f = photos[Number(mm[1]) - 1] ? path.join(dir, photos[Number(mm[1]) - 1]) : null;
      steps.push({ kind: 'image', file: f, label: `실사진 ${mm[1]} (${mm[2]})`, exists: !!f && fs.existsSync(f), optional: true });
    } else if (/^\[지도:/.test(line)) {
      flush(); steps.push({ kind: 'manual', label: '지도', what: '네이버 지도에서 「루멘수학교습소」를 찾아 넣어주세요' });
    } else if (/^\[톡톡:/.test(line)) {
      flush(); steps.push({ kind: 'manual', label: '톡톡', what: '톡톡 버튼을 넣어주세요 (https://talk.naver.com/w9d7umc)' });
    } else {
      buf.push(line);
    }
  }
  flush();
  return { meta, steps };
}

// ── 네이버 화면 다루기 ───────────────────────────────────────────
// 클래스 이름이 수시로 바뀌므로 여러 후보를 차례로 시도한다.
const SEL = {
  title: ['.se-documentTitle .se-text-paragraph', '.se-documentTitle', 'span.se-placeholder.__se_placeholder', '.se-title-text'],
  body:  ['.se-component.se-text .se-text-paragraph', '.se-main-container .se-text-paragraph', '.se-content'],
  save:  ['button.save_btn__bzc5B', 'button[class*="save_btn"]', '.header button:has-text("저장")'],
  file:  ['input[type="file"]'],
  popupCancel: ['button.se-popup-button-cancel', '.se-popup-button-cancel', 'button:has-text("취소")'],
};
async function firstVisible(frame, list, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    for (const s of list) {
      try { const el = frame.locator(s).first(); if (await el.isVisible({ timeout: 300 })) return el; } catch {}
    }
    await sleep(300);
  }
  return null;
}

(async () => {
  if (!opt.login && !folder) { log('사용법: node sync/naver_draft.js <글 폴더>   (처음이면 --login 먼저)'); process.exit(1); }

  // ── 미리보기 ──
  if (opt.dry) {
    const { meta, steps } = plan(path.resolve(ROOT, folder));
    log(`\n제목: ${meta.title}\n`);
    log('넣을 순서:');
    steps.forEach((s, i) => {
      const n = String(i + 1).padStart(2);
      if (s.kind === 'text') log(`  ${n}. 글  ${s.text.length}자  「${s.text.slice(0, 28).replace(/\n/g, ' ')}…」`);
      if (s.kind === 'image') log(`  ${n}. 그림 ${s.exists ? '✅' : '❌ 파일 없음 — 손으로'}  ${s.label}`);
      if (s.kind === 'manual') log(`  ${n}. 손으로 ⏸  ${s.label}`);
    });
    log(`\n해시태그: ${meta.hashtags}\n`);
    return;
  }

  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,                      // 보이는 창으로 — 원장님이 보고 개입할 수 있게
    viewport: { width: 1440, height: 980 },
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // ── ① 로그인 ──
  if (opt.login) {
    log('\n🔑 네이버 로그인 창을 엽니다.');
    log('   아이디·비밀번호를 **직접** 넣어주세요. 이 프로그램은 비밀번호를 보지 않습니다.');
    log('   「로그인 상태 유지」를 켜두시면 다음부터 안 물어봅니다.\n');
    await page.goto('https://nid.naver.com/nidlogin.login');
    await pause('로그인을 기다리는 중입니다.', '창에서 로그인을 끝내주세요.');
    await page.goto('https://blog.naver.com/' + (process.env.NAVER_BLOG_ID || 'lumen-math'));
    log('✅ 로그인 상태를 저장했습니다. 이제 글 넣기를 할 수 있습니다.');
    log('   node sync/naver_draft.js blog/<폴더>');
    await ctx.close();
    return;
  }

  // ── ② 글 넣기 ──
  const dir = path.resolve(ROOT, folder);
  const { meta, steps } = plan(dir);
  const blogId = process.env.NAVER_BLOG_ID || 'lumen-math';

  log(`\n📝 ${meta.title}\n`);
  log('글쓰기 화면을 엽니다…');
  await page.goto(`https://blog.naver.com/${blogId}?Redirect=Write&`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);

  // 에디터는 iframe 안에 있다
  let f = page;
  for (const name of ['mainFrame', 'papermain']) {
    const fr = page.frame({ name });
    if (fr) { f = fr; break; }
  }

  // 「작성 중인 글이 있습니다」 창 → 새로 쓰기
  const cancel = await firstVisible(f, SEL.popupCancel, 4000);
  if (cancel) { await cancel.click().catch(() => {}); await sleep(1200); log('   (이전 글 불러오기 창을 닫았습니다)'); }

  // 제목
  const title = await firstVisible(f, SEL.title, 12000);
  if (!title) {
    await pause('제목 칸을 못 찾았습니다. 네이버 화면이 바뀐 것 같습니다.',
      '제목 칸을 클릭해 커서를 두고 Enter 를 눌러주세요. 제목은 제가 넣겠습니다.');
  } else { await title.click(); await sleep(600); }
  await page.keyboard.type(meta.title, { delay: rnd(45, 95) });
  await sleep(900);

  // 본문으로 이동
  const body = await firstVisible(f, SEL.body, 6000);
  if (body) { await body.click(); } else { await page.keyboard.press('Tab'); }
  await sleep(800);

  // 순서대로 넣기
  let n = 0;
  for (const s of steps) {
    n++;
    if (s.kind === 'text') {
      log(`  ${n}/${steps.length} 글 ${s.text.length}자…`);
      for (const para of s.text.split('\n')) {
        if (para.trim()) await page.keyboard.type(para, { delay: opt.slow ? rnd(25, 70) : rnd(4, 14) });
        await page.keyboard.press('Enter');
        await sleep(rnd(120, 320));
      }
    } else if (s.kind === 'image') {
      if (opt.noImg || !s.exists) {
        log(`  ${n}/${steps.length} 그림 건너뜀 — ${s.label}${s.exists ? '' : ' (파일 없음)'}`);
        if (!s.optional && !opt.noImg) await pause(`그림을 못 넣었습니다: ${s.label}`, '이 자리에 그림을 직접 넣어주세요.');
        continue;
      }
      log(`  ${n}/${steps.length} 그림 ${s.label}…`);
      const input = await firstVisible(f, SEL.file, 3000)
        || f.locator('input[type="file"]').first();
      try {
        await input.setInputFiles(s.file, { timeout: 8000 });
        await sleep(rnd(2500, 4000));              // 업로드 기다림
      } catch (e) {
        await pause(`그림 올리기가 막혔습니다: ${s.label}\n   (${e.message.slice(0, 80)})`,
          `이 자리에 ${path.basename(s.file)} 을 직접 넣어주세요.`);
      }
    } else if (s.kind === 'manual') {
      await pause(`${s.label}은 직접 넣으셔야 합니다.`, s.what);
    }
  }

  // 해시태그
  if (meta.hashtags) {
    log('  해시태그…');
    await page.keyboard.press('Enter');
    await page.keyboard.type(meta.hashtags, { delay: rnd(20, 50) });
  }

  // 임시저장 — 발행은 절대 안 누른다
  await sleep(1500);
  const save = await firstVisible(page, SEL.save, 5000) || await firstVisible(f, SEL.save, 3000);
  if (save) {
    await save.click();
    await sleep(2500);
    log('\n✅ 임시저장했습니다.');
  } else {
    await pause('임시저장 버튼을 못 찾았습니다.', '화면 위쪽 「저장」을 눌러주세요.');
  }

  log('\n🚫 발행은 하지 않았습니다. 임시저장함에서 확인하고 직접 발행해주세요.');
  log('   창은 열어 둡니다. 다 되면 닫으시면 됩니다.');
  await ask('   끝내려면 Enter… ');
  await ctx.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
