#!/usr/bin/env node
/* 학원앱 v19-144 검사 — 💡 IB아하노트 «전부 확정» · 나중에 올린 스스로 해결 (원장 2026-10-21)
 *   가짜 서버(aha_notes 4건 · lumen_store aha_scores) · 외부망 차단 · 가짜 학생(○○○)
 *   ① 머리 단추 「✓ 전부 확정」 · 「8점 이상」 글자 없음 · 하루 단추 「이 날 전부 확정」
 *   ② 초안 뒤에 올린 스스로 해결 → 작업대 열면 초안 path=self · 보너스 +2(학습지 확인 안 됨) · 서버 저장
 *      원장이 손댄 초안(by teacher)·확정본은 그대로
 *   ③ 「✓ 전부 확정」 → 3점·6점·9점 초안 모두 final · 초안 없는 노트는 그대로 · 순위표 자동 발행 시도
 *   ④ 「이 날 전부 확정」도 8점 미만 포함 · 페이지 오류 없음
 *   실행: SP=<폴더> NODE_PATH=/opt/node22/lib/node_modules node sync/appbuild/tests/test_v19144.js lumen_v19-144.html */
const { chromium } = require('playwright');
const path = require('path');
const FILE = path.resolve(process.argv[2] || 'lumen_v19-144.html');
let pass = 0, fail = 0;
const t = (name, ok, info) => { ok ? pass++ : fail++; console.log((ok ? '✅' : '❌') + ' ' + name + (ok ? '' : ('  ← ' + (info || '')))); };
const today = new Date(); const iso = (dd, h) => { const d = new Date(today.getTime() - dd * 86400000); d.setHours(h || 15, 0, 0, 0); return d.toISOString(); };
const STUDENTS = [{ id: 'S1', name: '○○○1', grade: '중학교 2학년', group: 'T5', lumen_rec_code: 'AAA111' }, { id: 'S2', name: '○○○2', grade: '중학교 3학년', group: 'T5', lumen_rec_code: 'BBB222' }];
const base = (id, code, dd, extra) => Object.assign({ id, student_code: code, student_name: '○○○', created_at: iso(dd), status: 'pending', source_type: 'print', source_name: '활동지', problem_no: '1', photo_url: 'about:blank', q_learn: '배움', q_act: '해봄', q_try: '시도', q_stuck: '막힘', kind: 'ask', lamp_ai: { L: 'a', A: 'b', M: 'c', P: 'd' } }, extra || {});
const NOTES = [
  base('n1', 'AAA111', 1, { status: 'self_pending', self_solved: { at: iso(0, 9), how: '혼자 풀었어요' } }),   // 초안 뒤 스스로 해결
  base('n2', 'AAA111', 1),
  base('n3', 'BBB222', 2),
  base('n4', 'BBB222', 2),   // 초안 없음
  base('n5', 'BBB222', 3, { self_solved: { at: iso(0, 9), how: '혼자' } })];   // 원장이 손댄 초안
const sc = (total, extra) => Object.assign({ L: 1, A: 1, M: 1, P: 0, AHA: null, total, status: 'temp', by: 'ai', path: 'none', pathBonus: 0, typeBonus: 0, levelBonus: 0, selfMatch: 0, aiType: 'fact', kind: 'ask', level: 0, best: false, pick: false, coach: { fb: '', ff: '' }, at: iso(1, 16) }, extra || {});
const SCORES = { byId: { n1: sc(9), n2: sc(3), n3: sc(6), n5: sc(5, { by: 'teacher' }) }, updated: iso(1) };

(async () => {
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await br.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Seoul' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e.message))); pg.on('dialog', (d) => d.accept());
  await pg.route(/^https?:\/\//, (r) => r.abort());
  await pg.goto('file://' + FILE, { waitUntil: 'load' }); await pg.waitForTimeout(2500);
  await pg.evaluate(({ STUDENTS, NOTES, SCORES }) => {
    const lo = document.getElementById('login-overlay'); if (lo) lo.style.display = 'none';
    const clone = (v) => JSON.parse(JSON.stringify(v));
    window.T = { store: { aha_scores: clone(SCORES), aha_league_cfg: { seasonStart: '2026-09-07', seasonEnd: '2026-12-31', practiceDays: 0 } }, notes: clone(NOTES), w: [] };
    const mk = (tbl) => { const b = { f: [], one: false, op: 'select',
      select() { return b; }, eq(k, v) { b.f.push((x) => x === v); return b; }, in(k, a) { b.f.push((x) => a.indexOf(x) >= 0); return b; }, like(k, p) { const pre = p.replace(/%$/, ''); b.f.push((x) => x.indexOf(pre) === 0); return b; }, or() { return b; }, order() { return b; }, limit() { return b; }, range() { return b; }, gte() { return b; }, lte() { return b; }, gt() { return b; }, lt() { return b; }, neq() { return b; }, not() { return b; }, filter() { return b; }, is() { return b; },
      single() { b.one = true; return b; }, maybeSingle() { b.one = true; return b; }, update() { b.op = 'update'; return b; }, delete() { b.op = 'delete'; return b; },
      insert() { T.w.push({ tbl, op: 'insert' }); return Promise.resolve({ data: null, error: null }); },
      upsert(row) { (Array.isArray(row) ? row : [row]).forEach((r) => { T.w.push({ tbl, op: 'put', key: r.key }); if (tbl === 'lumen_store') T.store[r.key] = clone(r.value); }); return Promise.resolve({ data: null, error: null }); },
      then(r, j) { if (b.op !== 'select') { T.w.push({ tbl, op: b.op }); return Promise.resolve({ data: null, error: null }).then(r, j); }
        if (tbl === 'aha_notes') return Promise.resolve({ data: clone(T.notes), error: null }).then(r, j);
        if (tbl !== 'lumen_store') return Promise.resolve({ data: b.one ? null : [], error: null }).then(r, j);
        const data = Object.keys(T.store).filter((k) => b.f.every((fn) => fn(k))).map((k) => ({ key: k, value: clone(T.store[k]) }));
        return Promise.resolve({ data: b.one ? (data[0] || null) : data, error: null }).then(r, j); } }; return b; };
    window.getSupaClient = () => ({ from: mk, rpc: () => Promise.resolve({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
      storage: { from: () => ({ upload: () => Promise.resolve({ data: {}, error: null }), getPublicUrl: (p) => ({ data: { publicUrl: 'about:blank#' + p } }), list: () => Promise.resolve({ data: [], error: null }) }) } });
    window.fetch = () => Promise.reject(new Error('외부망 차단'));
    window.__pub = 0; const op = window.lgAutoPublish; window.lgAutoPublish = function () { window.__pub++; };
    students.length = 0; clone(STUDENTS).forEach((s) => students.push(s));
    ahaNotes = null; VIEW = 'aha'; render();
  }, { STUDENTS, NOTES, SCORES });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { try { WB.range = 'all'; } catch (e) {} render(); }); await pg.waitForTimeout(600);
  const P = (fn, a) => pg.evaluate(fn, a);
  t('버전', (await P(() => APP_VER)) === 'v19-144');
  t('노트 읽힘', (await P(() => (ahaNotes || []).length)) === 5, String(await P(() => (ahaNotes || []).length)));
  const html = await P(() => document.body.innerText);
  t('① 머리 「✓ 전부 확정」 · «8점 이상 확정» 글자 없음', /✓ 전부 확정/.test(html) && !/8점 이상 확정/.test(html) && !/8점 이상 일괄확정/.test(html));
  t('① 하루 단추 「이 날 전부 확정」', /이 날 전부 확정 \(/.test(html), (html.match(/이 날[^<]{0,20}확정[^<]{0,10}/g) || []).join('|'));
  const d1 = await P(() => ({ n1: IBQ_SCORES.n1, n5: IBQ_SCORES.n5, saved: T.store.aha_scores.byId.n1 }));
  t('② 나중에 올린 스스로 해결 → 초안 path=self · 보너스 +2', d1.n1.path === 'self' && d1.n1.pathBonus === 2, JSON.stringify(d1.n1));
  t('② 서버에도 저장', d1.saved && d1.saved.path === 'self', JSON.stringify(d1.saved));
  t('② 원장이 손댄 초안은 그대로(path none)', d1.n5.path === 'none', JSON.stringify(d1.n5));
  /* ③ 전부 확정 (왼쪽에서 아무도 안 고름 → 전체) */
  await P(() => { try { ahaSelectStudent && ahaSelectStudent(null); } catch (e) {} });
  await P(() => ibqBulkConfirm()); await pg.waitForTimeout(300);
  const st = await P(() => ({ n1: IBQ_SCORES.n1.status, n2: IBQ_SCORES.n2.status, n3: IBQ_SCORES.n3.status, n4: !!IBQ_SCORES.n4, n5: IBQ_SCORES.n5.status, by: IBQ_SCORES.n2.by, srv: T.store.aha_scores.byId.n2.status, pub: window.__pub }));
  t('③ 3점·6점·9점 초안 모두 확정 · 서버 저장', st.n1 === 'final' && st.n2 === 'final' && st.n3 === 'final' && st.srv === 'final' && st.by === 'teacher-bulk', JSON.stringify(st));
  t('③ 초안 없는 노트는 그대로 · 순위표 발행 부름', st.n4 === false && st.pub >= 1, JSON.stringify(st));
  /* ④ 이 날 전부 확정 — 새 3점 초안 */
  const day = await P(() => { IBQ_SCORES.n4 = JSON.parse(JSON.stringify(IBQ_SCORES.n2)); IBQ_SCORES.n4.status = 'temp'; IBQ_SCORES.n4.total = 2; IBQ_SCORES.n4.by = 'ai'; render(); return iblDay(ahaNotes.find((n) => n.id === 'n4').created_at); });
  await P((d) => wbConfirmDay(d), day); await pg.waitForTimeout(300);
  t('④ 이 날 전부 확정 — 2점 초안도 확정', (await P(() => IBQ_SCORES.n4.status)) === 'final');
  t('페이지 오류 없음', errs.length === 0, errs.slice(0, 3).join(' | '));
  await br.close();
  console.log('\n' + pass + '/' + (pass + fail) + (fail ? ' ❌' : ' ✅'));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
