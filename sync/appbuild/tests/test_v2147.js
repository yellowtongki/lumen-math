#!/usr/bin/env node
/* 학생앱 v2-147 검사 — 📷 아하노트 사진 찍으면 앱이 꺼지던 문제 (원장 2026-10-20 「사진찍으면 튕긴다 · 제출이 안된다」)
 *   외부망 차단 · 가짜 Supabase(올리기·AI 읽기·저장을 받아 적기만, 실서버에 아무것도 안 씀) · 가짜 학생(○○○)
 *   ① 사진 줄이기: 세로 3024×4032 → 가로 1600·세로 2400 안 · 가로 4032×3024 → 1600×1200 · 미리보기는 blob: 주소(긴 글자 X)
 *   ② 새 노트: 사진 → 올리기 → AI 읽기 → 확인 화면 → 제출 (aha_notes 1줄 · photo_url = 올린 주소) · 이어 쓰기 기록 지움
 *   ③ 앱이 꺼짐 흉내: 올리고 읽은 뒤 페이지를 새로 열기 → 「새 IB아하노트」 → 이어서 쓸까요? [확인]
 *      → 다시 올리지 않고 AI 도 다시 안 부르고 확인 화면 · 읽은 글 그대로 · 제출하면 그 사진 주소로 저장 · 기록 지움
 *   ④ 올리기만 되고 꺼짐(읽은 글 없음) → 이어 쓰기 때 AI 를 한 번 부른다 · [취소]면 기록 지우고 사진 시트
 *   ⑤ 스스로 해결 사진(ahaSelfHandlePhoto)도 같은 줄이기 · 페이지 오류 없음
 *   실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v2147.js student_v2-147.html
 *   SP 폴더에 portrait.jpg(3024×4032)·land.jpg(4032×3024)가 있어야 한다(없으면 python PIL 로 만든다). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'student_v2-147.html'));
const SP = process.env.SP || '/tmp';
const POR = path.join(SP, 'portrait.jpg'), LAND = path.join(SP, 'land.jpg');
if (!fs.existsSync(POR) || !fs.existsSync(LAND)) execFileSync('python3', ['-c', "from PIL import Image;Image.new('RGB',(3024,4032),(250,250,240)).save('" + POR + "');Image.new('RGB',(4032,3024),(240,250,250)).save('" + LAND + "')"]);
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };

const MOCK = () => {
  window.__log = window.__log || [];
  const b0 = (tbl) => { const b = { op: 'select', select() { return b; }, eq() { return b; }, in() { return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, is() { return b; }, not() { return b; }, ilike() { return b; }, like() { return b; }, filter() { return b; }, range() { return b; }, contains() { return b; },
    insert(row) { __log.push({ tbl, op: 'insert', row: JSON.parse(JSON.stringify(row)) }); b.op = 'insert'; return b; }, update() { b.op = 'update'; return b; }, upsert() { return Promise.resolve({ error: null }); }, delete() { return b; },
    single() { return Promise.resolve({ data: null, error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
    then(r, j) { return Promise.resolve({ data: b.op === 'select' ? [] : (b.op === 'insert' ? [{ id: 5 }] : null), error: null }).then(r, j); } }; return b; };
  window.sb = { from: b0, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    storage: { from: () => ({ upload: (n, blob) => { __log.push({ op: 'upload', n, size: blob.size }); return Promise.resolve({ data: {}, error: null }); }, getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/aha_photos/' + p } }) }) },
    functions: { invoke: (n) => { __log.push({ op: 'invoke', n }); return Promise.resolve({ data: { ok: true, book: '루멘수학 LAMP 활동지', L: '배운 것', A: '해 본 것', M: '식 세우기', P: '여기서 왜 이렇게 되나요?', concepts: [], unread: [] }, error: null }); } } };
  window.isTest = false;
  window.studentInfo = { lumen_rec_code: 'AAA111', name: '○○○', grade: '중학교 2학년', school: '테스트중학교', group: 'T5' };
  window.__confirm = true; window.__confirms = [];
  window.confirm = (m) => { __confirms.push(String(m)); return window.__confirm; }; window.alert = () => {};
  window.__toasts = []; const o = window.ahaToast; window.ahaToast = function (m, k) { __toasts.push(k + ':' + m); return o && o.apply(this, arguments); };
};

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message)));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  const boot = async () => { await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(1200); await pg.evaluate(MOCK); };
  const P = (fn, a) => pg.evaluate(fn, a);
  const stage = () => P(() => ({ reading: document.getElementById('aha-reading').style.display, confirm: document.getElementById('aha-confirm').style.display,
    p: document.getElementById('aha-q-stuck').value, url: ahaUploadedUrl, img: (document.querySelector('#aha-photo-slot img') || {}).src || '', log: __log.map((x) => x.op), bs: document.getElementById('aha-photo-bs').classList.contains('show') }));
  const resume = () => P(() => localStorage.getItem('aha_resume_AAA111'));
  const submit = () => P(async () => { ahaDirective = ahaDirective || 'hint'; __log.length = 0; await ahaSubmit(); return { ins: __log.filter((x) => x.op === 'insert').map((x) => x.row), toasts: __toasts.slice(-1) }; });

  await boot();
  t('버전 v2-147', (await P(() => STU_VER)) === 'v2-147');
  t('함수 있음', await P(() => ['ahaCompressImage', 'ahaResumeSave', 'ahaResumeGet', 'ahaResumeClear', 'ahaResumeApply'].every((f) => typeof window[f] === 'function')));

  /* ① 사진 줄이기 */
  const sz = async (f) => { await pg.setInputFiles('#td-file', []); const h = await pg.$('#td-file');
    await h.setInputFiles(f); return P(() => new Promise((res) => { const fi = document.getElementById('td-file').files[0];
      ahaCompressImage(fi).then((c) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight, url: c.dataUrl.slice(0, 5), type: c.blob.type, kb: Math.round(c.blob.size / 1024) }); im.src = c.dataUrl; }, (e) => res({ err: e.message })); })); };
  await P(() => { const i = document.getElementById('td-file'); i.onchange = null; i.removeAttribute('onchange'); });
  const a = await sz(POR), b = await sz(LAND);
  t('세로 3024×4032 → 1200×1600 이하(가로 1600·세로 2400 안)', a.w <= 1600 && a.h <= 2400 && a.w > 0 && Math.abs(a.w / a.h - 0.75) < 0.01, JSON.stringify(a));
  t('가로 4032×3024 → 1600×1200', b.w === 1600 && b.h === 1200, JSON.stringify(b));
  t('미리보기는 blob: 주소 · jpeg', a.url === 'blob:' && a.type === 'image/jpeg', JSON.stringify(a));
  t('작은 사진은 키우지 않음', (await P(() => Math.min(1, 1600 / 800, 2400 / 600))) === 1);

  /* ② 새 노트 끝까지 */
  await P(() => ahaGoAdd()); await pg.waitForTimeout(200);
  t('처음엔 이어 쓰기 질문 없음 · 사진 시트 열림', (await P(() => __confirms.length)) === 0 && (await stage()).bs);
  await pg.setInputFiles('#aha-photo-cam', POR); await pg.waitForTimeout(1500);
  let s1 = await stage();
  t('올리기 → AI 읽기 → 확인 화면', s1.confirm === 'block' && s1.reading === 'none' && s1.log.join() === 'upload,invoke' && s1.p === '여기서 왜 이렇게 되나요?', JSON.stringify(s1));
  const r1 = JSON.parse(await resume() || 'null');
  t('이어 쓰기 기록 = 올린 주소 + 읽은 글', r1 && r1.url === s1.url && r1.ai && r1.ai.P === '여기서 왜 이렇게 되나요?', JSON.stringify(r1));
  const sb1 = await submit();
  t('제출 → aha_notes 1줄 · photo_url = 올린 주소', sb1.ins.length === 1 && sb1.ins[0].photo_url === s1.url && sb1.ins[0].student_code === 'AAA111', JSON.stringify(sb1).slice(0, 300));
  t('제출 뒤 이어 쓰기 기록 지움', (await resume()) === null);

  /* ③ 올리고 읽은 뒤 앱이 꺼짐 */
  await P(() => ahaGoAdd()); await pg.waitForTimeout(150);
  await pg.setInputFiles('#aha-photo-cam', LAND); await pg.waitForTimeout(1500);
  const u3 = (await stage()).url;
  await boot();   // 앱이 꺼졌다 다시 켜짐
  t('다시 켜도 기록 남음', JSON.parse(await resume() || '{}').url === u3);
  await P(() => { __confirm = true; return ahaGoAdd(); }); await pg.waitForTimeout(400);
  const s3 = await stage();
  t('「이어서 쓸까요?」 한 번 물음', (await P(() => __confirms.length)) === 1 && /이어서 쓸까요/.test(await P(() => __confirms[0])));
  t('[확인] → 다시 올리지 않고 AI 도 안 부르고 확인 화면 · 읽은 글 그대로', s3.confirm === 'block' && s3.log.length === 0 && s3.url === u3 && s3.img === u3 && s3.p === '여기서 왜 이렇게 되나요?' && !s3.bs, JSON.stringify(s3));
  const sb3 = await submit();
  t('이어 쓴 노트 제출 → 그 사진 주소로 저장 · 기록 지움', sb3.ins.length === 1 && sb3.ins[0].photo_url === u3 && (await resume()) === null, JSON.stringify(sb3).slice(0, 200));

  /* ④ 올리기만 되고 꺼짐 */
  await P(() => ahaResumeSave({ url: 'https://fake.local/aha_photos/AAA111/only_up.jpg' }));
  await boot();
  await P(() => { __confirm = true; return ahaGoAdd(); }); await pg.waitForTimeout(400);
  const s4 = await stage();
  t('읽은 글이 없으면 이어 쓰기 때 AI 를 한 번 부름 → 확인 화면', s4.confirm === 'block' && s4.log.join() === 'invoke' && s4.url.indexOf('only_up') > 0 && s4.p === '여기서 왜 이렇게 되나요?', JSON.stringify(s4));
  t('읽은 글을 기록에 더함', !!JSON.parse(await resume() || '{}').ai);
  await P(() => { ahaShowStage('photo'); ahaClearConfirm(); __confirm = false; __confirms.length = 0; return ahaGoAdd(); }); await pg.waitForTimeout(300);
  const s5 = await stage();
  t('[취소] → 기록 지우고 사진 시트', (await resume()) === null && s5.bs && (await P(() => __confirms.length)) === 1, JSON.stringify(s5));
  await P(() => ahaResumeSave({ url: 'x', t: 0 })); await P(() => { const o = JSON.parse(localStorage.getItem('aha_resume_AAA111')); o.t = Date.now() - 7 * 3600e3; localStorage.setItem('aha_resume_AAA111', JSON.stringify(o)); });
  t('6시간 지난 기록은 안 물음', (await P(() => ahaResumeGet())) === null);
  await P(() => ahaResumeClear());

  /* ⑤ 스스로 해결 사진 */
  await P(() => { __log.length = 0; });
  await pg.setInputFiles('#aha-self-photo', POR); await pg.waitForTimeout(1500);
  const s6 = await P(() => ({ f: ahaSelfPhotoFile && ahaSelfPhotoFile.size, img: (document.querySelector('#aha-self-slot img') || {}).src || '', log: __log.map((x) => x.op) }));
  t('스스로 해결 사진도 줄여서 올림(blob: 미리보기)', s6.f > 0 && s6.img.indexOf('blob:') === 0 && s6.log[0] === 'upload', JSON.stringify(s6));
  t('부품 글자: readAsDataURL 이 아하 사진 줄이기에서 빠짐', (() => { const h = fs.readFileSync(FILE, 'utf8'); const i = h.indexOf('function ahaCompressImage'); return h.slice(i, h.indexOf('\n}\n', i)).indexOf('readAsDataURL') < 0; })());
  t('페이지 오류 없음', errs.length === 0, errs.join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
