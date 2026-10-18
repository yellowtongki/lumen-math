#!/usr/bin/env node
/**
 * sync/danggeun_draft.js — 당근 비즈프로필 「소식」 임시저장 자동화
 *
 * 글 폴더의 danggeun.md 와 카드 그림을 당근 「소식 작성」 화면에 넣고 **임시 저장**까지 한다.
 * **「다음」과 발행은 절대 누르지 않는다.** 원장님이 보고 직접 올리신다.
 *
 *   node sync/danggeun_draft.js --login            ① 처음 한 번: 당근 로그인 (직접 입력)
 *   node sync/danggeun_draft.js blog/<폴더>         ② 글 넣고 임시 저장
 *   node sync/danggeun_draft.js blog/<폴더> --dry   무엇을 넣을지만 보기 (창 안 염)
 *   node sync/danggeun_draft.js --peek             ③ 막혔을 때: 화면의 칸·단추를 찍어 본다
 *   node sync/danggeun_draft.js blog/<폴더> --no-img  글자만 넣고 사진은 손으로
 *
 * ⚠️ **맥미니·학원 컴퓨터에서만 돌린다.** 클라우드에서 돌리면 막힌다.
 * 🔒 비밀번호는 이 파일도 저장소도 모른다. 원장님이 창에 직접 넣고, 로그인 상태만
 *    `sync/_daangn_profile/` 에 남는다 (gitignore됨). 그 폴더를 지우면 다시 로그인하면 된다.
 *
 * 📄 글 폴더에 **danggeun.md** 가 있어야 한다.
 *    ---
 *    title: 소식 제목
 *    photos: 01_표지.png, 02_stat.png, 06_closing.png     ← cards/ 안의 파일 (최대 10장)
 *    ---
 *    본문 (그냥 글. 당근 소식에는 글 중간에 사진이 안 들어간다 — 사진은 맨 위에 모아 올라간다)
 *
 * 막히면 멈춘다. 창은 열어 둔 채로, 무엇을 손으로 할지 알려준다. Enter 를 치면 이어 간다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const PROFILE = path.join(__dirname, '_daangn_profile');
const HOME = 'https://bizprofile.daangn.com/';

const args = process.argv.slice(2);
const opt = {
  login: args.includes('--login'),
  dry: args.includes('--dry'),
  peek: args.includes('--peek'),
  noImg: args.includes('--no-img'),
  fast: args.includes('--fast'),
  biz: args.includes('--biz') ? String(args[args.indexOf('--biz') + 1] || '') : (process.env.DAANGN_BIZ_ID || ''),
};
const given = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a));

// 글 폴더를 안 적으면 blog/ 에서 danggeun.md 가 있는 가장 최근 글을 고른다.
// 날짜가 같은 폴더가 둘이면 danggeun.md 를 마지막에 고친 쪽이 「방금 쓴 글」이다.
function newestPost() {
  const base = path.join(ROOT, 'blog');
  if (!fs.existsSync(base)) return null;
  const found = fs.readdirSync(base)
    .filter(n => /^\d{4}-\d{2}-\d{2}-/.test(n) && fs.existsSync(path.join(base, n, 'danggeun.md')))
    .map(n => ({ n, day: n.slice(0, 10), at: fs.statSync(path.join(base, n, 'danggeun.md')).mtimeMs }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.at - b.at));
  return found.length ? path.join('blog', found[found.length - 1].n) : null;
}
const folder = given || newestPost();

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(q, a => { rl.close(); res(a); }));
}
async function pause(why, what) {
  log(''); log('⏸  ' + why); log('   👉 ' + what);
  await ask('   다 하셨으면 Enter 를 눌러주세요… ');
}

// ── danggeun.md 읽기 ──────────────────────────────────────────────
function plan(dir) {
  const file = path.join(dir, 'danggeun.md');
  if (!fs.existsSync(file)) throw new Error(`${path.relative(ROOT, file)} 가 없습니다. 당근용 글을 먼저 만들어야 합니다.`);
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('danggeun.md 맨 위에 --- 머리말이 없습니다');
  const meta = {};
  m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
  // 굵은 글씨 같은 마크다운 기호는 당근에서 그대로 보이므로 벗긴다
  const body = m[2].replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/^#+\s*/gm, '').trim();
  const names = (meta.photos || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  const photos = names.map(n => {
    const cand = [path.join(dir, 'cards', n), path.join(dir, n)];
    const found = cand.find(f => fs.existsSync(f));
    return { name: n, file: found || null };
  });
  return { meta, body, photos };
}

// ── 화면에서 칸·단추 찾기 (당근이 화면을 바꿔도 버티게 여러 후보를 둔다) ──
const SEL = {
  title: ['input[placeholder*="소식 제목"]', 'textarea[placeholder*="소식 제목"]',
          'input[placeholder*="제목"]', 'textarea[placeholder*="제목"]',
          'input[name*="title"]', '[data-testid*="title"] input', '[class*="title"] input'],
  body:  ['div[contenteditable="true"]', '.ProseMirror', '[role="textbox"]',
          'textarea[placeholder*="내용"]', 'textarea[placeholder*="소식"]',
          '[data-testid*="content"] textarea', 'textarea'],
  file:  ['input[type="file"]'],
  photoBtn: ['button:has-text("/10")', '[class*="photo"] button', '[class*="image"] button',
             'button[aria-label*="사진"]', 'label[for*="file"]'],
  save:  ['button:has-text("임시 저장")', 'button:has-text("임시저장")',
          '[class*="temp"] button', 'button[class*="temp"]'],
};
async function find(page, list, why) {
  for (const sel of list) {
    try { const el = page.locator(sel).first(); if (await el.isVisible({ timeout: 700 })) return el; } catch {}
  }
  if (why) await dump(page, why);
  return null;
}
// --peek / 막혔을 때: 화면의 칸과 단추를 전부 찍는다. 이 결과를 그대로 보내주시면 고칠 수 있다.
async function dump(page, why) {
  log(`\n🔍 ${why} — 화면에 있는 것들을 적어 둡니다. 이 내용을 그대로 보내주세요.\n`);
  const rows = await page.evaluate(() => {
    const out = [];
    const push = (kind, el) => {
      const t = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
      out.push([kind, el.tagName.toLowerCase(), el.getAttribute('placeholder') || '',
                el.getAttribute('aria-label') || '', (el.className || '').toString().slice(0, 60), t].join(' | '));
    };
    document.querySelectorAll('input,textarea,[contenteditable="true"],[role="textbox"]').forEach(e => push('칸', e));
    document.querySelectorAll('button,[role="button"]').forEach(e => push('단추', e));
    return out.slice(0, 120);
  }).catch(() => []);
  rows.forEach(r => log('   ' + r));
  log('');
}

// ── 사람처럼 치기 ──
async function type(page, el, text) {
  await el.click();
  await sleep(300);
  for (const para of text.split('\n')) {
    if (para.trim()) await page.keyboard.type(para, { delay: opt.fast ? rnd(4, 14) : rnd(25, 70) });
    await page.keyboard.press('Enter');
    await sleep(rnd(120, 300));
  }
}

(async () => {
  if (!opt.login && !opt.peek && !folder) {
    log('당근용 글(danggeun.md)이 있는 폴더가 없습니다.');
    log('사용법: node sync/danggeun_draft.js blog/<폴더>   (처음이면 --login 먼저)');
    process.exit(1);
  }

  if (opt.dry) {
    const { meta, body, photos } = plan(path.resolve(ROOT, folder));
    log(`\n📂 ${folder}`);
    log(`제목: ${meta.title}`);
    log(`사진 ${photos.length}장:`);
    photos.forEach(p => log(`   ${p.file ? '✅' : '❌ 없음'}  ${p.name}`));
    log(`본문 ${body.replace(/\s/g, '').length}자 (줄 ${body.split('\n').filter(Boolean).length}개)\n`);
    log(body.split('\n').slice(0, 6).map(l => '   ' + l).join('\n'));
    log('   …\n');
    return;
  }

  const { chromium } = require('playwright');
  fs.mkdirSync(PROFILE, { recursive: true });
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: { width: 1440, height: 980 },
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  global.__expectFile = false;
  page.on('filechooser', (fc) => { if (!global.__expectFile) fc.setFiles([]).catch(() => {}); });

  try {
    // ── ① 로그인 ──
    if (opt.login) {
      log('\n🔑 당근 비즈니스 창을 엽니다.');
      log('   로그인을 **직접** 해주세요. 이 프로그램은 비밀번호를 보지 않습니다.\n');
      await page.goto(HOME);
      await pause('로그인을 기다리는 중입니다.', '창에서 로그인한 뒤 비즈프로필 「루멘수학」 을 눌러 관리자 홈까지 들어가 주세요.');
      log('✅ 로그인 상태를 저장했습니다.');
      log('   이제 글을 넣을 수 있습니다 → node sync/danggeun_draft.js blog/<폴더>\n');
      await ctx.close(); return;
    }

    // ── ② 내 비즈프로필 번호 찾기 ──
    let biz = opt.biz;
    if (!biz) {
      await page.goto(HOME, { waitUntil: 'domcontentloaded' });
      await sleep(2500);
      let m = page.url().match(/biz_accounts\/(\d+)/);
      if (!m) {
        // 계정 고르는 화면(business.daangn.com/profile/login)에 떨어졌다 — 가게 이름을 눌러 들어간다
        const name = process.env.DAANGN_BIZ_NAME || '루멘수학';
        log(`   계정 고르는 화면입니다 — 「${name}」 을 누릅니다.`);
        for (const sel of [`a:has-text("${name}")`, `[role="button"]:has-text("${name}")`,
                           `div:has-text("${name}") >> nth=-1`, `text=${name}`]) {
          try {
            const el = page.locator(sel).first();
            if (await el.isVisible({ timeout: 1200 })) { await el.click(); await sleep(3500); break; }
          } catch {}
        }
        m = page.url().match(/biz_accounts\/(\d+)/);
      }
      if (m) biz = m[1];
    }
    if (!biz) {
      await pause('비즈프로필 번호를 못 찾았습니다.', '창에서 「루멘수학」 관리자 홈으로 들어가 주세요.');
      const m2 = page.url().match(/biz_accounts\/(\d+)/);
      biz = m2 ? m2[1] : '';
      if (!biz) throw new Error('관리자 홈 주소에서 번호를 못 읽었습니다. --biz 3014868 처럼 적어주세요.');
    }
    log(`🏠 비즈프로필 ${biz}`);

    if (opt.peek) {
      await page.goto(`${HOME}biz_accounts/${biz}/manager/posts/new/`, { waitUntil: 'domcontentloaded' });
      await sleep(3000);
      await dump(page, '소식 작성 화면');
      await pause('화면을 그대로 두었습니다.', '위 내용을 복사해서 보내주세요.');
      await ctx.close(); return;
    }

    const { meta, body, photos } = plan(path.resolve(ROOT, folder));
    log(`📂 ${folder}\n   제목: ${meta.title}\n   사진 ${photos.filter(p => p.file).length}장 · 본문 ${body.replace(/\s/g, '').length}자\n`);

    // ── ③ 소식 작성 화면 열기 ──
    await page.goto(`${HOME}biz_accounts/${biz}/manager/posts/new/?entry=business_profile.home.manager`,
                    { waitUntil: 'domcontentloaded' });
    await sleep(3000);

    // ── ④ 사진 (맨 위에 모아 올라간다) ──
    const files = photos.filter(p => p.file).map(p => p.file);
    if (!opt.noImg && files.length) {
      let done = false;
      const fin = await find(page, SEL.file);          // 숨어 있는 파일칸에 바로 넣는 쪽이 제일 튼튼하다
      if (fin) { try { await fin.setInputFiles(files); done = true; } catch {} }
      if (!done) {                                      // 안 되면 사진 단추를 눌러 창을 띄운다
        const btn = await find(page, SEL.photoBtn);
        if (btn) {
          global.__expectFile = true;
          const [fc] = await Promise.all([page.waitForEvent('filechooser', { timeout: 8000 }).catch(() => null), btn.click()]);
          if (fc) { await fc.setFiles(files); done = true; }
          global.__expectFile = false;
        }
      }
      if (done) { log(`🖼  사진 ${files.length}장 올리는 중…`); await sleep(2000 + files.length * 1500); }
      else {
        await dump(page, '사진 넣는 칸을 못 찾음');
        await pause('사진을 자동으로 못 넣었습니다.', `창에서 직접 올려주세요 — ${files.map(f => path.basename(f)).join(', ')}`);
      }
    }

    // ── ⑤ 제목 ──
    const tEl = await find(page, SEL.title, '제목 칸을 못 찾음');
    if (tEl) { await tEl.click(); await page.keyboard.type(meta.title, { delay: rnd(30, 80) }); log('✍️  제목 넣음'); }
    else await pause('제목을 자동으로 못 넣었습니다.', `창에 직접 넣어주세요 — ${meta.title}`);
    await sleep(600);

    // ── ⑥ 본문 ──
    const bEl = await find(page, SEL.body, '본문 칸을 못 찾음');
    if (bEl) { await type(page, bEl, body); log('✍️  본문 넣음'); }
    else await pause('본문을 자동으로 못 넣었습니다.', '창에 직접 붙여넣어 주세요 (danggeun.md 의 내용).');
    await sleep(1000);

    // ── ⑦ 임시 저장 (여기까지만. 「다음」·발행은 안 누른다) ──
    const sEl = await find(page, SEL.save, '「임시 저장」 단추를 못 찾음');
    if (sEl) { await sEl.click(); await sleep(2500); log('💾 임시 저장을 눌렀습니다.'); }
    else log('⚠️  「임시 저장」을 못 눌렀습니다 — 창에서 직접 눌러주세요.');

    log('\n────────────────────────────────────');
    log('✅ 여기까지입니다. 「다음」과 발행은 원장님이 직접 하십니다.');
    log('   창을 그대로 두었습니다. 글을 보시고 고치신 뒤 올려주세요.');
    log('────────────────────────────────────\n');
    await pause('창을 열어 두었습니다.', '다 보셨으면 Enter 를 눌러주세요 (창이 닫힙니다).');
  } catch (e) {
    log(`\n❌ ${e.message}`);
    log('   창은 열어 두었습니다. 직접 마저 하셔도 되고, --peek 로 화면을 찍어 보내주시면 고치겠습니다.\n');
    await ask('   Enter 를 누르면 창을 닫습니다… ');
  }
  await ctx.close();
})();
