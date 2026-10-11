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
  fast: args.includes('--fast'),      // 기본은 사람 타자 속도. 급하면 --fast
  size: args.includes('--size') ? String(args[args.indexOf('--size') + 1] || '') : '24',  // --size 0 이면 건드리지 않음
  peek: args.includes('--peek'),     // 도구줄 단추들을 찍어 본다 (문제 찾을 때만)
};
// 글 폴더를 안 적으면 blog/ 에서 가장 최근 글을 고른다 (폴더 이름이 날짜로 시작하므로 정렬하면 끝이 최신)
function newestPost() {
  const base = path.join(ROOT, 'blog');
  if (!fs.existsSync(base)) return null;
  const found = fs.readdirSync(base)
    .filter(n => /^\d{4}-\d{2}-\d{2}-/.test(n) && fs.existsSync(path.join(base, n, 'post.md')))
    .sort();
  return found.length ? path.join('blog', found[found.length - 1]) : null;
}
const given = args.find(a => !a.startsWith('--'));
const folder = given || newestPost();
if (!given && folder) console.log(`📂 글 폴더를 안 적으셔서 가장 최근 글로 합니다 → ${folder}\n`);
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
  // 네이버 에디터는 ** __ ~~ 를 서식 명령으로 먹는다(굵게·밑줄·취소선). 한 번 켜지면 뒤 문단까지 번진다.
  // 그래서 기호만 떼고 글자는 그대로 넣는다. 굵게는 올린 뒤 원장님이 직접 (문단당 한 곳)
  const stripMd = (t) => t
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
  const flush = () => { const t = stripMd(buf.join('\n').replace(/\n{3,}/g, '\n\n').trim()); if (t) steps.push({ kind: 'text', text: t }); buf = []; };

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
      flush(); steps.push({ kind: 'manual', label: '지도', auto: true, what: '네이버 지도에서 「루멘수학교습소」를 찾아 넣어주세요' });
    } else if (/^\[톡톡:/.test(line)) {
      flush(); steps.push({ kind: 'manual', label: '톡톡', auto: true, what: '톡톡 버튼을 넣어주세요 (https://talk.naver.com/w9d7umc)' });
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
  save:  ['button:has-text("저장")', 'a:has-text("저장")', '[class*="save_btn"]',
          'button.save_btn__bzc5B', '[class*="publish"] button:has-text("저장")'],
  // 장소(지도) 넣기
  placeBtn:   ['button:has-text("장소")', '[data-name="place"]', '[data-log="pst.place"]', 'button[title*="장소"]'],
  placeInput: ['input[placeholder*="장소"]', '.se-place-search-input', 'input[type="text"][class*="search"]'],
  // 네이버는 숨은 input 이 아니라 「사진」 단추를 눌러 파일 선택창을 띄운다
  photoBtn: ['button:has-text("사진")', '[data-name="image"]', '.se-toolbar-item-image button',
             'button[data-log="pst.photo"]', '.se-toolbar-item-image', 'button[title*="사진"]'],
  // 톡톡 버튼 넣기 — 글쓰기 도구줄의 「톡톡」
  talkBtn: ['button:has-text("톡톡")', '[data-name="talktalk"]', '[data-name="talk"]',
            '.se-toolbar-item-talktalk button', '.se-toolbar-item-talktalk',
            'button[data-log="pst.talk"]', 'button[title*="톡톡"]'],
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

// 그림 한 장 넣기 — 「사진」 단추를 눌러 뜨는 파일 선택창에 파일을 건넨다
async function insertImage(page, frame, file) {
  let btn = null;
  for (const sel of SEL.photoBtn) {
    for (const scope of [frame, page]) {
      try {
        const el = scope.locator(sel).first();
        if (await el.isVisible({ timeout: 500 })) { btn = el; break; }
      } catch {}
    }
    if (btn) break;
  }
  if (!btn) throw new Error('「사진」 단추를 못 찾았습니다');

  global.__expectFile = true;
  try {
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20000 }),
      btn.click(),
    ]);
    await chooser.setFiles(file);
  } finally { global.__expectFile = false; }

  // 올라갈 때까지 기다린다 (그림 수가 늘어나는 것으로 확인)
  await sleep(rnd(2500, 4000));
  // 커서를 그림 아래로 보내고 줄을 하나 띄운다
  await page.keyboard.press('ArrowDown').catch(() => {});
  await page.keyboard.press('End').catch(() => {});
  await sleep(400);
}

// 본문 글씨 크기 맞추기 — 되면 좋고, 안 되면 지금 크기로 그냥 간다 (막지 않는다)
async function setFontSize(page, frame, size) {
  if (!size || size === '0') return false;
  const openers = [
    'button.se-toolbar-option-font-size-code-toolbar-button',
    '.se-toolbar-option-font-size-code button',
    'button[data-name="font-size-code"]',
    'button[class*="font-size"]',
  ];
  let btn = null;
  for (const sel of openers) {
    for (const scope of [frame, page]) {
      try { const el = scope.locator(sel).first(); if (await el.isVisible({ timeout: 500 })) { btn = el; break; } } catch {}
    }
    if (btn) break;
  }
  if (!btn) { log(`   (글씨 크기 단추를 못 찾았습니다 — 지금 크기 그대로 갑니다)`); return false; }
  await btn.click();
  await sleep(700);
  const exact = new RegExp(`^\\s*${size}\\s*$`);
  for (const tag of ['button', 'li', 'a', 'span']) {
    try {
      const el = frame.locator(tag).filter({ hasText: exact }).first();
      if (await el.isVisible({ timeout: 500 })) {
        await el.click(); await sleep(500);
        log(`   글씨 크기 ${size} 로 맞췄습니다`);
        return true;
      }
    } catch {}
  }
  await page.keyboard.press('Escape').catch(() => {});
  log(`   (글씨 크기 ${size} 를 못 골랐습니다 — 지금 크기 그대로 갑니다)`);
  return false;
}

// 도구줄에 어떤 단추가 있는지 그대로 찍는다 — 선택자가 안 맞을 때 원인을 찾으려고
async function peekToolbar(frame) {
  const rows = await frame.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button, [role="button"]')) {
      const r = b.getBoundingClientRect();
      if (r.top > 400 || r.width === 0) continue;      // 위쪽 도구줄만
      out.push({
        글자: (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14),
        title: b.getAttribute('title') || '',
        aria: b.getAttribute('aria-label') || '',
        data: b.getAttribute('data-name') || b.getAttribute('data-log') || '',
        pressed: b.getAttribute('aria-pressed') || '',
        class: (b.className || '').toString().slice(0, 70),
      });
    }
    return out;
  }).catch(() => []);
  log(`\n── 도구줄 단추 ${rows.length}개 ──`);
  rows.forEach((r, i) => log(`${String(i).padStart(2)} 「${r.글자}」 title=${r.title} aria=${r.aria} data=${r.data} pressed=${r.pressed}\n     class=${r.class}`));
  log('── 여기까지 ──\n');
}

// 뭔가 못 찾았을 때, 그 순간 화면에 보이는 단추를 찍는다 — 다음 판에 선택자를 정확히 맞추려고
async function dumpButtons(frame, why) {
  const rows = await frame.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button, [role="button"], input')) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      out.push(`「${(b.innerText || b.value || b.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 16)}」 `
        + `${b.tagName.toLowerCase()} class=${(b.className || '').toString().slice(0, 60)}`);
    }
    return out.slice(0, 40);
  }).catch(() => []);
  log(`\n   ── ${why}: 지금 보이는 단추 ${rows.length}개 ──`);
  rows.forEach((r, i) => log(`   ${String(i).padStart(2)} ${r}`));
  log('   ── 여기까지 (이 목록을 보내주시면 다음엔 자동으로 됩니다) ──\n');
}

// 글자 서식(굵게·기울임·밑줄·취소선)이 켜져 있으면 끈다.
// 어디선가 한 번 켜지면 뒤 문단까지 줄이 번진다. 원인을 몰라도 「켜져 있으면 끈다」로 막는다.
// 무엇이 켜져 있었는지 로그에 남기므로, 다음에 이 줄을 보면 언제 켜지는지 알 수 있다
const FMT = [
  ['굵게',   ['button[data-name="bold"]', '.se-toolbar-option-bold-button', '.se-toolbar-item-bold button', 'button[title*="굵게"]', 'button[aria-label*="굵게"]']],
  ['기울임', ['button[data-name="italic"]', '.se-toolbar-option-italic-button', '.se-toolbar-item-italic button', 'button[title*="기울"]', 'button[aria-label*="기울"]']],
  ['밑줄',   ['button[data-name="underline"]', '.se-toolbar-option-underline-button', '.se-toolbar-item-underline button', 'button[title*="밑줄"]', 'button[aria-label*="밑줄"]']],
  ['취소선', ['button[data-name="strikethrough"]', '.se-toolbar-option-strikethrough-button', '.se-toolbar-item-strikethrough button', 'button[title*="취소선"]', 'button[aria-label*="취소선"]']],
];
// 켜짐 판정 — 클래스 「낱말 전체」로만 본다.
// 네이버 단추 클래스가 se-text-icon-toolbar-button 이라서, 그냥 「on 이 들어가면」으로 보면
// 모든 단추가 켜진 것처럼 보여 오히려 전부 눌러 켜게 된다 (2026-10-11에 실제로 그랬다)
const ON_WORD = /^(se-is-on|se-is-selected|se-is-active|is-active|active|selected|on)$/i;
async function isOn(el) {
  const cls = ((await el.getAttribute('class').catch(() => '')) || '').split(/\s+/);
  const pressed = (await el.getAttribute('aria-pressed').catch(() => '')) || '';
  return pressed === 'true' || cls.some(t => ON_WORD.test(t));
}
async function clearFormatting(page, frame) {
  const turned = [], found = [];
  for (const [name, sels] of FMT) {
    let done = false;
    for (const sel of sels) {
      if (done) break;
      for (const scope of [frame, page]) {
        try {
          const el = scope.locator(sel).first();
          if (!(await el.isVisible({ timeout: 200 }))) continue;
          found.push(name);
          done = true;
          if (await isOn(el)) {
            await el.click();           // 켜져 있으면 눌러서 끈다
            await sleep(250);
            if (await isOn(el)) {       // 그래도 켜져 있으면 내가 잘못 본 것 — 되돌린다
              await el.click(); await sleep(200);
              log(`   ⚠️ ${name} 을 못 껐습니다 (원래대로 되돌렸습니다)`);
            } else turned.push(name);
          }
          break;                        // 이 서식의 단추는 찾았다 — 다음 서식으로
        } catch {}
      }
    }
  }
  if (turned.length) log(`   ⚠️ 켜져 있던 서식을 껐습니다: ${turned.join(', ')}`);
  if (found.length < FMT.length) log(`   ⚠️ 서식 단추를 못 찾았습니다: ${FMT.map(f => f[0]).filter(n => !found.includes(n)).join(', ')} (--peek 로 도구줄을 찍어 보세요)`);
  return turned;
}

// 커서를 본문 맨 끝으로 돌려놓는다.
// 지도를 넣거나 원장님이 손으로 뭔가 한 뒤에는 커서가 본문 밖에 있다 — 그 상태로 글자를 치면 아무 데도 안 들어간다
async function focusBodyEnd(page, frame) {
  try {
    const paras = frame.locator('.se-main-container .se-text-paragraph');
    const n = await paras.count();
    if (!n) return false;
    await paras.nth(n - 1).click();
    await sleep(400);
    await page.keyboard.press('End').catch(() => {});
    await sleep(250);
    return true;
  } catch { return false; }
}

// 「저장 13」의 숫자를 읽는다. 이 수가 늘면 진짜로 임시저장된 것이다 (알림 띄우는 것보다 확실하다)
async function saveCount(page, frame) {
  const sels = ['[class*="save_count_btn"]', '[aria-label*="임시저장된"]', '[title*="임시저장된"]'];
  for (const sel of sels) {
    for (const scope of [page, frame]) {
      try {
        const t = await scope.locator(sel).first().innerText({ timeout: 400 });
        const m = String(t).match(/\d+/);
        if (m) return parseInt(m[0], 10);
      } catch {}
    }
  }
  return null;
}

// 정말 저장됐는지 확인한다 — 「저장되었습니다」 알림이 뜨는지 본다. 확인 못 하면 성공이라고 말하지 않는다
async function savedOk(page, frame) {
  const marks = ['text=저장되었습니다', 'text=임시저장되었습니다', 'text=저장했습니다', '.se-toast', '[class*="toast"]'];
  const t0 = Date.now();
  while (Date.now() - t0 < 9000) {
    for (const sel of marks) {
      for (const scope of [frame, page]) {
        try { if (await scope.locator(sel).first().isVisible({ timeout: 250 })) return true; } catch {}
      }
    }
    await sleep(400);
  }
  return false;
}

// 톡톡 버튼 넣기 — 도구줄 「톡톡」을 누르면 내 톡톡이 뜬다. 확인만 누르면 본문에 버튼이 들어간다
async function insertTalk(page, frame) {
  let btn = null;
  for (const sel of SEL.talkBtn) {
    for (const scope of [frame, page]) {
      try { const el = scope.locator(sel).first(); if (await el.isVisible({ timeout: 400 })) { btn = el; break; } } catch {}
    }
    if (btn) break;
  }
  if (!btn) throw new Error('「톡톡」 단추를 못 찾았습니다');
  await btn.click();
  await sleep(2000);

  // 창이 떴으면 확인/등록/삽입 중 하나를 누른다. 창 없이 바로 들어가는 경우도 있다
  for (const sel of ['button:has-text("확인")', 'button:has-text("등록")', 'button:has-text("삽입")',
                     'button:has-text("적용")', '.se-popup-button-confirm', 'button[class*="confirm"]']) {
    for (const scope of [frame, page]) {
      try {
        const el = scope.locator(sel).first();
        if (await el.isVisible({ timeout: 600 })) { await el.click(); await sleep(1800); return true; }
      } catch {}
    }
  }
  // 확인 단추가 없다 — 버튼이 이미 들어갔는지 본문에서 확인한다
  for (const sel of ['[class*="talktalk"]', '[class*="se-oglink"]', 'a[href*="talk.naver.com"]']) {
    try { if (await frame.locator(sel).first().isVisible({ timeout: 800 })) { await sleep(800); return true; } } catch {}
  }
  throw new Error('톡톡 창에서 확인 단추를 못 찾았습니다');
}

// 장소(루멘수학교습소) 넣기 — 되면 좋고, 안 되면 손으로 안내한다
async function insertPlace(page, frame, keyword) {
  let btn = null;
  for (const sel of SEL.placeBtn) {
    for (const scope of [frame, page]) {
      try { const el = scope.locator(sel).first(); if (await el.isVisible({ timeout: 400 })) { btn = el; break; } } catch {}
    }
    if (btn) break;
  }
  if (!btn) throw new Error('「장소」 단추를 못 찾았습니다');
  await btn.click();
  await sleep(1800);

  let input = null;
  for (const sel of SEL.placeInput) {
    for (const scope of [frame, page]) {
      try { const el = scope.locator(sel).first(); if (await el.isVisible({ timeout: 500 })) { input = el; break; } } catch {}
    }
    if (input) break;
  }
  if (!input) throw new Error('장소 검색칸을 못 찾았습니다');
  await input.click();
  await page.keyboard.type(keyword, { delay: rnd(60, 120) });
  await page.keyboard.press('Enter');
  await sleep(2500);

  // 검색 결과 첫 줄 고르기
  const itemSel = ['li[class*="place"]', '.se-place-search-result-item', '[class*="searchResult"] li',
                   '[class*="result"] li', 'ul[class*="list"] li'];
  let picked = false;
  for (const sel of itemSel) {
    for (const scope of [frame, page]) {
      try {
        const el = scope.locator(sel).first();
        if (await el.isVisible({ timeout: 600 })) { await el.click(); picked = true; break; }
      } catch {}
    }
    if (picked) break;
  }
  if (!picked) throw new Error('검색 결과를 못 찾았습니다');
  await sleep(1200);

  // 「확인」 누르기
  const okSel = ['button.se-popup-button-confirm', '.se-popup-button-confirm',
                 'button.se-place-confirm', '[class*="popup"] button[class*="confirm"]',
                 'button[class*="confirm"]', '[class*="confirm"] button',
                 'button:has-text("확인")', 'button:has-text("추가")', 'button:has-text("완료")',
                 'button:has-text("적용")', 'button:has-text("삽입")'];
  for (const sel of okSel) {
    for (const scope of [frame, page]) {
      try {
        const el = scope.locator(sel).first();
        if (await el.isVisible({ timeout: 500 })) { await el.click(); await sleep(1800); return true; }
      } catch {}
    }
  }
  await dumpButtons(frame, '장소 확인 단추를 못 찾음');
  throw new Error('「확인」 단추를 못 찾았습니다 (장소는 골라졌습니다)');
}

(async () => {
  if (!opt.login && !folder) { log('blog/ 에 글이 없습니다. 사용법: node sync/naver_draft.js [글 폴더]   (처음이면 --login 먼저)'); process.exit(1); }

  // ── 미리보기 ──
  if (opt.dry) {
    const { meta, steps } = plan(path.resolve(ROOT, folder));
    log(`\n제목: ${meta.title}\n`);
    log('넣을 순서:');
    steps.forEach((s, i) => {
      const n = String(i + 1).padStart(2);
      if (s.kind === 'text') log(`  ${n}. 글  ${s.text.length}자  「${s.text.slice(0, 28).replace(/\n/g, ' ')}…」`);
      if (s.kind === 'image') log(`  ${n}. 그림 ${s.exists ? '✅' : '❌ 파일 없음 — 손으로'}  ${s.label}`);
      if (s.kind === 'manual') log(`  ${n}. ${s.label === '지도' || s.auto ? '자동 🔁' : '손으로 ⏸'}  ${s.label}`);
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
  // 그림 넣을 때가 아닌데 파일 선택창이 뜨면 맥 창이 떠서 작업이 멈춘다 — 조용히 닫는다
  global.__expectFile = false;
  page.on('filechooser', (fc) => { if (!global.__expectFile) fc.setFiles([]).catch(() => {}); });

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
  if (opt.peek) await peekToolbar(f);
  await setFontSize(page, f, opt.size);
  await clearFormatting(page, f);

  // 순서대로 넣기
  let n = 0;
  for (const s of steps) {
    n++;
    if (s.kind === 'text') {
      log(`  ${n}/${steps.length} 글 ${s.text.length}자…`);
      await clearFormatting(page, f);   // 앞 단계에서 서식이 켜졌을 수 있다
      for (const para of s.text.split('\n')) {
        // 기본은 사람 타자 속도(한 글자 25~70ms). 모니터에 띄워 두고 보기 좋은 속도다
        if (para.trim()) await page.keyboard.type(para, { delay: opt.fast ? rnd(4, 14) : rnd(25, 70) });
        await page.keyboard.press('Enter');
        await sleep(opt.fast ? rnd(120, 320) : rnd(350, 800));
      }
    } else if (s.kind === 'image') {
      if (opt.noImg || !s.exists) {
        log(`  ${n}/${steps.length} 그림 건너뜀 — ${s.label}${s.exists ? '' : ' (파일 없음)'}`);
        if (!s.optional && !opt.noImg) await pause(`그림을 못 넣었습니다: ${s.label}`, '이 자리에 그림을 직접 넣어주세요.');
        continue;
      }
      log(`  ${n}/${steps.length} 그림 ${s.label}…`);
      try {
        await insertImage(page, f, s.file);
      } catch (e) {
        await pause(`그림 올리기가 막혔습니다: ${s.label}\n   (${e.message.slice(0, 90)})`,
          `위쪽 「사진」 단추를 눌러 ${path.basename(s.file)} 을 직접 넣어주세요.\n      파일 위치: ${s.file}`);
      }
    } else if (s.kind === 'manual') {
      if (s.label === '지도') {
        log(`  ${n}/${steps.length} 장소 「루멘수학교습소」 검색…`);
        try {
          await insertPlace(page, f, '루멘수학교습소');
          log('     ✅ 장소를 넣었습니다 (본문 끝 주소와 맞는지 나중에 확인해 주세요)');
          await focusBodyEnd(page, f);   // 지도를 넣으면 커서가 본문 밖으로 나간다
        } catch (e) {
          await pause(`장소 넣기가 막혔습니다 (${e.message})`,
            '위쪽 「장소」 단추를 눌러 「루멘수학교습소」를 찾아 넣어주세요.');
          await focusBodyEnd(page, f);
        }
      } else if (s.label === '톡톡') {
        log(`  ${n}/${steps.length} 톡톡 버튼 넣기…`);
        try {
          await insertTalk(page, f);
          log('     ✅ 톡톡 버튼을 넣었습니다');
        } catch (e) {
          await pause(`톡톡 넣기가 막혔습니다 (${e.message})`, s.what);
        }
        await focusBodyEnd(page, f);
      } else {
        await pause(`${s.label}은 직접 넣으셔야 합니다.`, s.what);
        await focusBodyEnd(page, f);   // 원장님이 손으로 만진 뒤에는 커서가 어디 있을지 모른다
      }
    }
  }

  // 해시태그 — 본문 맨 끝에 #낱말 로 적으면 네이버가 발행할 때 태그로 잡는다.
  // (2026-10-11: 「발행 창의 태그 칸」으로 바꿨다가 되돌렸다. 원장님이 쭉 쓰시던 방식이 맞다.
  //  지난번에 안 들어간 것은 자리가 틀려서가 아니라 커서가 본문 밖에 있었기 때문이다)
  if (meta.hashtags) {
    log('  해시태그…');
    await focusBodyEnd(page, f);
    await clearFormatting(page, f);
    await page.keyboard.press('Enter');
    await page.keyboard.type(meta.hashtags, { delay: rnd(20, 50) });
    await sleep(900);
    const firstTag = meta.hashtags.split(/\s+/).find(t => t.startsWith('#')) || '';
    let inBody = false;
    try { inBody = (await f.evaluate(() => document.body.innerText || '')).includes(firstTag); } catch {}
    if (inBody) log('     ✅ 본문 끝에 넣었습니다 (발행할 때 태그로 잡힙니다)');
    else {
      try { require('child_process').execSync('pbcopy', { input: meta.hashtags }); log('     📋 클립보드에 복사해 뒀습니다'); } catch {}
      await pause('해시태그가 본문에 안 들어간 것 같습니다.',
        `본문 맨 끝을 클릭하고 붙여넣기(⌘V) 하세요:\n      ${meta.hashtags}`);
    }
  }

  // 임시저장 — 발행은 절대 안 누른다
  await sleep(1500);
  let save = await firstVisible(f, SEL.save, 4000) || await firstVisible(page, SEL.save, 4000);
  if (save) {
    const label = ((await save.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
    if (/발행/.test(label)) {            // 혹시라도 발행 단추를 잡았으면 누르지 않는다
      log(`   ⚠️ 「${label}」 단추를 잡았습니다 — 발행일 수 있어 누르지 않습니다.`);
      save = null;
    } else {
      const before = await saveCount(page, f);
      log(`   「${label || '저장'}」 누릅니다…${before === null ? '' : ` (지금 저장함 ${before}개)`}`);
      await save.click();
      // 저장함 숫자가 늘었는지로 본다. 숫자를 못 읽으면 알림으로 본다
      let ok = false;
      if (before !== null) {
        const t0 = Date.now();
        while (Date.now() - t0 < 9000) {
          const now = await saveCount(page, f);
          if (now !== null && now > before) { ok = true; break; }
          await sleep(600);
        }
      }
      if (!ok) ok = await savedOk(page, f);
      if (ok) {
        log(`\n✅ 임시저장했습니다.${before === null ? '' : ` (저장함 ${before} → ${await saveCount(page, f)})`}`);
      } else {
        await pause('「저장」을 눌렀는데 저장됐다는 알림이 안 보입니다.',
          '화면 오른쪽 위 「저장」을 직접 눌러주세요. (「발행」 말고 「저장」입니다)');
      }
    }
  }
  if (!save) {
    await pause('임시저장 단추를 못 찾았습니다.',
      '화면 오른쪽 위 「저장」을 눌러주세요. (「발행」 말고 「저장」입니다)');
  }

  log('\n🚫 발행은 하지 않았습니다. 임시저장함에서 확인하고 직접 발행해주세요.');
  log('   창은 열어 둡니다. 다 되면 닫으시면 됩니다.');
  await ask('   끝내려면 Enter… ');
  await ctx.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
