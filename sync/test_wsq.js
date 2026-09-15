#!/usr/bin/env node
/**
 * 학습지 채점목록 점검 (mf_wsq_*) — 계약 docs/worksheet_score_contract.md §1
 * ==========================================================================
 * 수집기(`node sync/mathflat_collector.js --wsq-only`)가 저장해 둔
 * lumen_store 'mf_wsq_<학생코드>' 를 읽어 제대로 담겼는지 표로 보여 준다.
 *   · 학생 수 · 학습지 수 · 문항 수
 *   · 객관식 / 주관식 / 서술형 비율
 *   · 자동채점 가능 비율 (self:false = 우리 엔진이 읽는 답)
 *   · 매쓰플랫이 스스로 채점하는 학습지(auto) 비율 · 상태(학습가능·풀이 중·학습완료) 분포
 * 매쓰플랫 로그인은 필요 없다 (Supabase 읽기만).
 *
 * 실행: node sync/test_wsq.js            (요약)
 *       node sync/test_wsq.js --full     (학생별 표 전체 + shape 분포)
 */
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 필요합니다'); process.exit(1); }
const FULL = process.argv.includes('--full');
const sbH = () => ({ apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` });
const pct = (a, b) => (b ? (Math.round(a / b * 1000) / 10).toFixed(1) + '%' : '-');
const pad = (s, n) => { s = String(s == null ? '' : s); let w = 0; for (const ch of s) w += (ch.charCodeAt(0) > 0x1100 ? 2 : 1); return s + ' '.repeat(Math.max(0, n - w)); };
const padL = (s, n) => { s = String(s == null ? '' : s); let w = 0; for (const ch of s) w += (ch.charCodeAt(0) > 0x1100 ? 2 : 1); return ' '.repeat(Math.max(0, n - w)) + s; };

(async () => {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=like.mf_wsq_*&select=key,value&limit=500`, { headers: sbH() });
  if (!r.ok) { console.error('조회 실패', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
  const rows = (await r.json()).filter((x) => /^mf_wsq_/.test(x.key));
  if (!rows.length) { console.log('저장된 mf_wsq_* 가 없습니다 — 먼저 수집기를 --wsq-only 로 돌리세요.'); return; }

  const T = { ws: 0, prob: 0, mc: 0, sa: 0, essay: 0, etc: 0, self: 0, auto: 0, res: {}, st: {}, shape: {}, noAns: 0, img: 0, pimg: 0 };
  const perStu = [];
  for (const row of rows) {
    const v = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) || {};
    const list = v.list || [];
    const s = { code: v.code || row.key.replace(/^mf_wsq_/, ''), name: v.name || '', ws: list.length, prob: 0, mc: 0, sa: 0, essay: 0, self: 0, auto: 0, updated: (v.updated || '').slice(0, 10) };
    for (const w of list) {
      T.ws++; T.st[w.status || '?'] = (T.st[w.status || '?'] || 0) + 1;
      if (w.auto) { T.auto++; s.auto++; }
      for (const p of w.problems || []) {
        T.prob++; s.prob++;
        T.shape[p.shape || '?'] = (T.shape[p.shape || '?'] || 0) + 1;
        T.res[p.result || '-'] = (T.res[p.result || '-'] || 0) + 1;
        if (p.type === 'MULTIPLE_CHOICE' || p.type === 'SINGLE_CHOICE') { T.mc++; s.mc++; }
        else if (p.type === 'ESSAY') { T.essay++; s.essay++; }
        else if (p.type === 'SHORT_ANSWER') { T.sa++; s.sa++; }
        else T.etc++;
        if (p.self) { T.self++; s.self++; }
        if (!String(p.answer || '').trim()) T.noAns++;
        if (p.img) T.img++;
        if (p.pimg) T.pimg++;
      }
    }
    perStu.push(s);
  }
  perStu.sort((a, b) => b.prob - a.prob);

  console.log('═══ 학습지 채점목록 (mf_wsq_*) 점검 ═══');
  console.log(`학생 ${rows.length}명 · 학습지 ${T.ws}장 · 문항 ${T.prob}개`);
  console.log('');
  console.log('┌ 문항 종류 ─────────────────────────────');
  console.log(`│ 객관식 MULTIPLE_CHOICE  ${padL(T.mc, 6)}  ${padL(pct(T.mc, T.prob), 7)}`);
  console.log(`│ 주관식 SHORT_ANSWER     ${padL(T.sa, 6)}  ${padL(pct(T.sa, T.prob), 7)}`);
  console.log(`│ 서술형 ESSAY            ${padL(T.essay, 6)}  ${padL(pct(T.essay, T.prob), 7)}`);
  console.log(`│ 그 밖                   ${padL(T.etc, 6)}  ${padL(pct(T.etc, T.prob), 7)}`);
  console.log('├ 채점 방법 ─────────────────────────────');
  console.log(`│ 자동채점(엔진이 읽음)   ${padL(T.prob - T.self, 6)}  ${padL(pct(T.prob - T.self, T.prob), 7)}`);
  console.log(`│ 자기채점(사진→◯✗)      ${padL(T.self, 6)}  ${padL(pct(T.self, T.prob), 7)}`);
  console.log(`│ 정답 글자 없음          ${padL(T.noAns, 6)}  ${padL(pct(T.noAns, T.prob), 7)}`);
  console.log(`│ 정답 그림 있음          ${padL(T.img, 6)}  ${padL(pct(T.img, T.prob), 7)}`);
  console.log(`│ 문제 그림 있음          ${padL(T.pimg, 6)}  ${padL(pct(T.pimg, T.prob), 7)}`);
  console.log('├ 학습지 ────────────────────────────────');
  console.log(`│ 매쓰플랫 자동채점(auto) ${padL(T.auto, 6)}  ${padL(pct(T.auto, T.ws), 7)}`);
  Object.keys(T.st).sort((a, b) => T.st[b] - T.st[a]).forEach((k) => {
    console.log(`│ 상태 ${pad(k, 18)} ${padL(T.st[k], 6)}  ${padL(pct(T.st[k], T.ws), 7)}`);
  });
  console.log('├ 현재 채점 결과 ────────────────────────');
  Object.keys(T.res).sort((a, b) => T.res[b] - T.res[a]).forEach((k) => {
    const nm = { O: '맞음 O', X: '틀림 X', '?': '모름 ?', '-': '아직 채점 안 함' }[k] || k;
    console.log(`│ ${pad(nm, 23)} ${padL(T.res[k], 6)}  ${padL(pct(T.res[k], T.prob), 7)}`);
  });
  console.log('└────────────────────────────────────────');

  if (FULL) {
    console.log('\n답 모양(shape) 분포');
    Object.keys(T.shape).sort((a, b) => T.shape[b] - T.shape[a]).forEach((k) => {
      console.log(`  ${pad(k, 10)} ${padL(T.shape[k], 6)}  ${padL(pct(T.shape[k], T.prob), 7)}`);
    });
  }

  console.log('\n학생별');
  console.log(`  ${pad('코드', 8)}${pad('이름', 10)}${padL('학습지', 7)}${padL('문항', 7)}${padL('객관식', 7)}${padL('서술형', 7)}${padL('자기채점', 9)}${padL('자동학습지', 11)}  갱신`);
  const show = FULL ? perStu : perStu.slice(0, 15);
  show.forEach((s) => {
    console.log(`  ${pad(s.code, 8)}${pad(s.name, 10)}${padL(s.ws, 7)}${padL(s.prob, 7)}${padL(s.mc, 7)}${padL(s.essay, 7)}${padL(s.self + ' (' + pct(s.self, s.prob) + ')', 9 + 8)}${padL(s.auto, 5)}  ${s.updated}`);
  });
  if (!FULL && perStu.length > show.length) console.log(`  … 그 밖 ${perStu.length - show.length}명 (--full 로 전체 보기)`);

  // 계약 점검 — 빠진 칸 찾기
  const bad = [];
  rows.forEach((row) => {
    const v = (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) || {};
    (v.list || []).forEach((w) => {
      if (!w.swId || !w.status) bad.push(`${row.key} swId/status 없음`);
      (w.problems || []).forEach((p) => {
        if (!p.wpId) bad.push(`${row.key} sw=${w.swId} wpId 없음`);
        else if (!p.shape) bad.push(`${row.key} sw=${w.swId} wpId=${p.wpId} shape 없음`);
        else if (p.self !== true && p.self !== false) bad.push(`${row.key} sw=${w.swId} wpId=${p.wpId} self 없음`);
      });
    });
  });
  console.log('');
  if (bad.length) { console.log(`⚠ 계약 어긋남 ${bad.length}건 (앞 10건)`); bad.slice(0, 10).forEach((b) => console.log('   ' + b)); }
  else console.log('✅ 계약 §1 필수 칸(swId·status·wpId·shape·self) 모두 채워짐');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
