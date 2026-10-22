#!/usr/bin/env node
/* 학원앱 v19-151 + 학생앱 v2-148 검사 — 📝 아하 사진 읽기에서 인쇄된 LAMP 칸 이름 빼기 (원장 2026-10-22 「칸 이름은 빼도록 고쳐줘」)
 *   외부망 차단 · AI 답은 흉내(실제 학생 노트에서 본 모양 그대로: 제목만 · 제목 + «- 글» · 손글씨만)
 *   ① 학원앱 「🤖 사진 읽기」(ibqReadPhoto): L 제목만 → 빈칸 · unread 에 L · P «제목 - 모르겠다» → «모르겠다» · M 손글씨 그대로 · 서버에 쓴 값도 같음
 *   ② 학생앱: 사진 → 읽기 → 확인 화면 칸 = 제목 빠진 글 · 빈 칸은 «못 읽은 칸»(unread) 노란 테두리
 *   ③ 규칙 글이 세 곳(학원앱·학생앱·엣지 함수)에 같은 정규식으로 들어 있음
 *   실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19151.js lumen_v19-151.html student_v2-148.html */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const TF = path.resolve(process.argv[2] || path.join(ROOT, 'lumen_v19-151.html'));
const SF = path.resolve(process.argv[3] || path.join(ROOT, 'student_v2-148.html'));
const SP = process.env.SP || '/tmp';
const IMG = path.join(SP, 'land.jpg');
if (!fs.existsSync(IMG)) execFileSync('python3', ['-c', "from PIL import Image;Image.new('RGB',(1200,900),(240,250,250)).save('" + IMG + "')"]);
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const AI = { L: 'Learn the question (문제를 정확히 이해하기)', A: 'Activate Knowledge (관련 이론, 공식 떠올리기)\n근의 공식', M: '4/i = 4/(a^2/i) = 0', P: 'Pinpoint your confusion (막힌 부분을 정확한 질문으로 정리하기) - 어떻게 푼 건지 모르겠다', aha: '', unread: [] };
(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  /* ① 학원앱 */
  const pg = await (await br.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push('T ' + e.message));
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + TF, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  const r1 = await pg.evaluate(async (AI) => {
    window.__upd = null;
    window.getSupaClient = () => ({ from: () => { const b = { update(v) { window.__upd = JSON.parse(JSON.stringify(v)); return b; }, eq() { return Promise.resolve({ error: null }); } }; return b; } });
    apiKey = 'sk-test';
    window.ahaAiFetchB64 = async () => ({ media_type: 'image/jpeg', data: 'AAAA' });
    window.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: JSON.stringify(AI) }] }) });
    ahaNotes = [{ id: 'n1', student_code: 'AAA111', photo_url: 'https://x/a.jpg', created_at: new Date().toISOString() }];
    const out = await ibqReadPhoto('n1');
    return { out, upd: window.__upd };
  }, AI);
  t('버전 학원앱', (await pg.evaluate(() => APP_VER)) === 'v19-151');
  const u = r1.upd || {};
  t('① L 제목만 → 빈칸 · unread 에 L', !u.q_learn && u.lamp_ai && u.lamp_ai.L === '' && u.lamp_ai.unread.indexOf('L') >= 0, JSON.stringify(u));
  t('① A «제목\\n근의 공식» → «근의 공식»', u.q_act === '근의 공식', u.q_act);
  t('① P «제목 - …» → «어떻게 푼 건지 모르겠다»', u.q_stuck === '어떻게 푼 건지 모르겠다' && u.lamp_ai.P === '어떻게 푼 건지 모르겠다', JSON.stringify([u.q_stuck, u.q_ask]));
  t('① M 손글씨 그대로', u.q_try === '4/i = 4/(a^2/i) = 0', u.q_try);
  /* ② 학생앱 */
  const sp = await (await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  sp.on('pageerror', (e) => errs.push('S ' + e.message));
  await sp.route(/^https?:\/\//, (r) => r.abort());
  await sp.goto('file://' + SF, { waitUntil: 'load' }); await sp.waitForTimeout(1200);
  await sp.evaluate((AI) => {
    const b0 = () => { const b = { select() { return b; }, eq() { return b; }, in() { return b; }, or() { return b; }, gte() { return b; }, lte() { return b; }, order() { return b; }, limit() { return b; }, neq() { return b; }, is() { return b; }, not() { return b; }, ilike() { return b; }, like() { return b; }, filter() { return b; }, range() { return b; }, contains() { return b; }, insert() { return b; }, update() { return b; }, upsert() { return Promise.resolve({ error: null }); }, delete() { return b; }, single() { return Promise.resolve({ data: null, error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, then(r, j) { return Promise.resolve({ data: [], error: null }).then(r, j); } }; return b; };
    window.sb = { from: b0, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'https://fake.local/' + p } }) }) },
      functions: { invoke: () => Promise.resolve({ data: Object.assign({ ok: true }, JSON.parse(JSON.stringify(AI))), error: null }) } };
    window.isTest = false; window.studentInfo = { lumen_rec_code: 'AAA111', name: '홍길동', grade: '중학교 2학년' };
    window.confirm = () => false; window.alert = () => {};
    try { localStorage.removeItem('aha_resume_AAA111'); } catch (e) {}
    return ahaGoAdd();
  }, AI);
  await sp.waitForTimeout(300);
  await sp.setInputFiles('#aha-photo-cam', IMG); await sp.waitForTimeout(1500);
  const r2 = await sp.evaluate(() => ({ ver: STU_VER, L: document.getElementById('aha-q-learn').value, A: document.getElementById('aha-q-act').value, M: document.getElementById('aha-q-try').value, P: document.getElementById('aha-q-stuck').value,
    unL: document.getElementById('aha-box-L').classList.contains('unread'), unM: document.getElementById('aha-box-M').classList.contains('unread'), conf: document.getElementById('aha-confirm').style.display }));
  t('버전 학생앱', r2.ver === 'v2-148', r2.ver);
  t('② 확인 화면: L 빈칸 · A «근의 공식» · P 제목 빠짐 · M 그대로', r2.conf === 'block' && r2.L === '' && r2.A === '근의 공식' && /^어떻게 푼 건지 모르겠다/.test(r2.P) && r2.M === '4/i = 4/(a^2/i) = 0', JSON.stringify(r2));
  t('② L 칸 «못 읽은 칸» 표시 · M 칸은 아님', r2.unL && !r2.unM, JSON.stringify(r2));
  /* ③ 세 곳 같은 규칙 */
  const core = fs.readFileSync(path.join(ROOT, 'sync/appbuild/modules/lampstrip_core.js'), 'utf8').match(/var LAMP_HEAD_RE = (\/.*\/i);/)[1];
  const edge = fs.readFileSync(path.join(ROOT, 'supabase/functions/aha-read/index.ts'), 'utf8').match(/const LAMP_HEAD_RE = (\/.*\/i);/)[1];
  t('③ 학원앱·학생앱·엣지 함수 정규식 같음', fs.readFileSync(TF, 'utf8').indexOf(core) >= 0 && fs.readFileSync(SF, 'utf8').indexOf(core) >= 0 && edge === core, edge === core ? '' : 'edge 다름');
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
