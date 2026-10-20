#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🔤 루멘 분석기 ② 뼈대·단원 비교 + 검증 보고서 (docs/lumen_analyzer.md)
 * ═══════════════════════════════════════════════════════════════════
 * 글자 은행(text_bank.js)에 적힌 글로, 시험 문항마다 우리 자료 중 가장 닮은 6개를 고른다 (AI 없음).
 *   ① 뼈대 비교 — 숫자·문자 이름을 가린 글의 세 글자 묶음 닮음 → 같은문제 / 숫자변형
 *   ② 단원 비교 — 매쓰플랫 유형 번호(cid)·소단원, 수학비서 단원 글자 → 유사문제 / 같은유형
 * 그리고 원장님이 학원앱에서 ✓/✗ 로 확정한 적중과 맞춰 «놓침 · 잘못 찾음 · 일치»를 센다.
 * 통과 기준(원장 2026-10-18): 놓침 0 · 잘못 찾음 2 이하.
 *
 * 실행
 *   node sync/lumen_analyzer/run.js --exam 소사고_고1_2026_2_중간 [--report <폴더>] [--no-save]
 *        → <폴더>/report.json · report.md  +  lumen_store analyzer_report_<시험> (학원앱·채팅에서 읽기)
 *   [--bank-file <json>]  은행 위에 덧씌울 글 { "<키>": { text, ask, … } } (채팅에서 옮겨 적은 것 시험용, 저장 안 함)
 *   [--apply]  분석기 후보를 exam_hit_<시험>.items[].cands 에 넣는다 — ⚠ 원장님 승인 전에는 쓰지 않는다
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const pathMod = require('path');
const W = require('../exam_hit_worker.js');
const M = require('./match.js');
const B = require('./text_bank.js');

const TOP = 6;
const RETRIEVE = 60;        // 뼈대 역색인에서 먼저 뽑는 수
const KIND_KO = { exam: '시험', mp: '학원 문제지', ms: '수학비서 학습지', tb: '교과서', ws: '매쓰플랫 학습지', wb: '매쓰플랫 교재' };
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/* 키 같음 — 출판사 교과서 pub:<id> = tb:<id>, 교재 문항 wb:<id> = tb:<id> (같은 매쓰플랫 교재 문항 번호), 같은 그림(pid) */
function idKeys(k, tmap) {
  const out = new Set([k]);
  const m = String(k || '').match(/^(pub|tb|wb):(\d+)$/); if (m) { out.add('tb:' + m[2]); out.add('wb:' + m[2]); }
  const t = tmap && tmap.get(k.replace(/^pub:/, 'tb:'));
  if (t && t.pid) out.add('pid:' + t.pid);
  return out;
}
function sameMat(a, b, tmap) { if (!a || !b) return false; const A = idKeys(a, tmap); for (const x of idKeys(b, tmap)) if (A.has(x)) return true; return false; }

/* 사람이 읽을 자리 (보고서 파일에는 학습지 제목을 넣지 않는다 — 제목에 학생 이름이 있을 수 있다) */
function placeOf(t, withTitle) {
  if (!t) return '';
  if (t.kind === 'mp' || t.kind === 'ms') return `${KIND_KO[t.kind]} ${t.paper} ${t.no}번` + (withTitle && t.title ? ` (${t.title})` : '');
  if (t.kind === 'tb') return `${t.pubOnly ? '출판사 ' : ''}교과서 ${String(t.title || '').replace(/^교과서_/, '').replace(/\s*-\s*.*$/, '')} ${t.page}쪽 ${t.no}번`;
  if (t.kind === 'ws' || t.kind === 'wb') return withTitle && t.mat ? W.whereOf(t.mat) : `${KIND_KO[t.kind]} ${t.k}`;
  return t.k;
}

async function analyze(examId, opt) {
  opt = opt || {};
  const { targets, info, data } = await B.collectTargets(examId, { scope: opt.scope || 'all', pub: opt.pub !== false });
  const bank = await B.loadBank(['ptx_']);
  if (opt.bankFile) {
    const extra = JSON.parse(fs.readFileSync(opt.bankFile, 'utf8')); let n = 0;
    const byK = new Map(targets.map((t) => [t.k, t]));
    Object.entries(extra).forEach(([k, e]) => { const t = byK.get(k); B.putEntry(bank, t ? t.group : 'local', k, { nums: M.numsOf(e.text || ''), ...e }); n++; });
    log(`덧씌운 글 ${n}개 (--bank-file)`);
  }
  const U = info.U;
  const tmap = new Map(targets.map((t) => [t.k, t]));
  const examT = targets.filter((t) => t.kind === 'exam');
  const cands = targets.filter((t) => t.kind !== 'exam' && !t.dupWb);   /* 학생이 푼 교재 문항과 같은 교과서 문항은 기록 쪽(wb)만 */
  /* 비교 준비 — 글 상태: text 본문 있음 · askOnly 질문 칸에만 글(합쳐 씀) · empty 빈 글 · err 실패 · none 은행에 아직 없음 */
  const stateOf = (e) => (!e ? 'none' : e.err ? 'err' : (e.text ? 'text' : (e.ask ? 'askOnly' : 'empty')));
  const cov = { examItems: examT.length, examText: 0, cands: cands.length, candText: 0, byKind: {}, errs: {}, emptyFig: 0 };
  cands.forEach((t) => {
    const e = B.bankGet(bank, t); t.e = e; t.p = M.prep(e || {}); t.state = stateOf(e);
    const u = t.cid ? U.of(t.cid) : null; t.lit = (u && u.lit) || ''; t.mid = (u && u.mid) || '';
    const b = cov.byKind[t.kind] = cov.byKind[t.kind] || { n: 0, text: 0, askOnly: 0, empty: 0, err: 0, none: 0 };
    b.n++; b[t.state]++; if (t.p.text) cov.candText++;
    if (t.state === 'err') { const m = `${KIND_KO[t.kind]} · ${e.err}`; cov.errs[m] = (cov.errs[m] || 0) + 1; }
    if (t.state === 'empty' && e.fig) cov.emptyFig++;
  });
  const idx = M.buildIndex(cands.filter((t) => !t.p.short).map((t) => ({ k: t.k, p: t.p })));
  const byCid = new Map(), byLit = new Map();
  cands.forEach((t) => { if (t.cid) { const a = byCid.get(String(t.cid)) || []; a.push(t); byCid.set(String(t.cid), a); } if (t.lit) { const a = byLit.get(t.lit) || []; a.push(t); byLit.set(t.lit, a); } });
  const cmap = new Map(cands.map((t) => [t.k, t]));
  /* 원장 확정 키 → 비교 대상 (pub:<id> = tb:<id> = wb:<id>) · 없으면 왜 없는지 */
  function findT(k) {
    const m = String(k || '').match(/^(pub|tb|wb):(\d+)$/);
    const tries = m ? ['tb:' + m[2], 'wb:' + m[2]] : [k];
    for (const x of tries) if (cmap.has(x)) return { t: cmap.get(x) };
    for (const x of tries) if (info.skippedKeys[x]) return { t: null, why: info.skippedKeys[x] };
    return { t: null, why: '이 시험의 비교 자료에 없음 (학생 기록·문제지 구성 밖)' };
  }

  const rows = [];
  for (const it of data.items) {
    const et = examT.find((t) => t.no === it.no);
    const ee = et ? B.bankGet(bank, et) : null;
    const E = M.prep(ee || {}); if (E.text) cov.examText++;
    const u = it.cid ? U.of(it.cid) : null; const lit = (u && u.lit) || '';
    const gradeT = (t) => {
      const cidSame = !!(it.cid && t.cid && String(it.cid) === String(t.cid));
      const unitSame = !!(lit && (t.lit === lit || (t.msChapter && M.chapterLike(lit, t.msChapter))));
      return M.grade({ exam: E, cand: t.p, unitSame, cidSame });
    };
    const pool = new Map();
    if (!E.short) idx.topK(E, RETRIEVE).forEach((x) => pool.set(x.k, tmap.get(x.k)));
    (byCid.get(String(it.cid)) || []).forEach((t) => pool.set(t.k, t));
    if (lit) (byLit.get(lit) || []).forEach((t) => pool.set(t.k, t));
    if (lit) cands.forEach((t) => { if (!t.lit && t.msChapter && M.chapterLike(lit, t.msChapter)) pool.set(t.k, t); });
    const graded = [];
    pool.forEach((t) => { if (!t) return; const g = gradeT(t); if (g.kind === 'none') return; graded.push({ t, ...g }); });
    graded.sort(M.better);
    /* 같은 그림(같은 매쓰플랫 문항)은 하나로 — 나머지는 also */
    const top = []; const seenId = new Map();
    for (const g of graded) {
      const ids = [...idKeys(g.t.k, tmap)].filter((x) => /^(pid|tb|wb):/.test(x));
      const dup = ids.map((x) => seenId.get(x)).find(Boolean);
      if (dup) { dup.also.push(g.t.k); continue; }
      if (top.length >= TOP) continue;
      const row = { k: g.t.k, kind: g.kind, score: g.score, s: g.s, a: g.a, why: g.why, also: [], src: g.t.kind, pubOnly: !!g.t.pubOnly, t: g.t };
      top.push(row); ids.forEach((x) => seenId.set(x, row));
    }
    rows.push({ it, E, examText: !!E.text, examFig: !!(ee && ee.fig), top, graded, gradeT, pool: pool.size });
  }
  return { examId, data, targets, tmap, rows, cov, info, findT };
}

/* ── 검증: 원장님 확정과 맞추기 (2026-10-18 2회차 기준) ──
 *   일치     원장 확정 자료가 분석기 위 6개 안에 있다 (등급은 따로 «원장 등급 / 분석기 등급» 으로 본다)
 *   동급     위 6개 밖이지만, 그 자료의 뼈대 점수(ownerScore)가 분석기 6위 점수 이하 — 분석기가 그만큼 닮은 것을 6개 찾았다
 *   놓침     글이 있고 6위보다 점수가 높은데 안 나옴(순위 고르기 잘못) · 또는 6개가 다 차지 않았는데 빠짐
 *   확인 불가 원장 확정 자료의 글이 없다(은행 실패 · 그림 없음 · 비교 범위 밖)
 *   잘못 찾음 분석기 1순위가 같은문제·숫자변형인데 원장님이 바로 그 자료를 ✗(아님) 표시했다
 *            ✗ 가 남는 자리: hit {k, ok:false} · cands[].rejected · pub[].rejected (학원앱 hit_teacher · pubgrade116) */
function validate(A) {
  const SV = (k) => k === 'same' || k === 'var';
  const out = { items: [], miss: 0, same6: 0, unknown: 0, wrong: 0, agree: 0, kindAgree: 0, ownerSV: 0, ownerType: 0, typeIn6: 0, noHitSV: 0, newFound: 0, unconfirmed: 0, workerAgree: 0, rejectedSeen: 0 };
  A.rows.forEach((r) => {
    const it = r.it, hit = it.hit || null;
    const wTop = (it.cands || [])[0] || null;
    const aTop = r.top[0] || null;
    const seen = (k) => (it.cands || []).some((c) => sameMat(c.k, k, A.tmap) || (c.also || []).some((x) => sameMat(x, k, A.tmap)));
    const inTop = (k) => r.top.findIndex((c) => sameMat(c.k, k, A.tmap) || c.also.some((x) => sameMat(x, k, A.tmap)));
    const rejectedKeys = [].concat(hit && hit.ok === false && hit.k ? [hit.k] : [], (it.cands || []).filter((c) => c.rejected).map((c) => c.k), (it.pub || []).filter((p) => p.rejected).map((p) => p.k));
    out.rejectedSeen += rejectedKeys.length;
    const v = { no: it.no, owner: hit ? { k: hit.k || null, kind: hit.kind || null, ok: hit.ok } : null, worker: wTop ? { k: wTop.k, kind: wTop.kind } : null,
      analyzer: r.top.map((c) => ({ k: c.k, kind: c.kind, s: c.s, a: c.a, why: c.why, also: c.also, src: c.src })),
      status: '', note: '', ownerScore: null, ownerRank: null, ownerKindByAnalyzer: null, sixth: r.top[TOP - 1] ? r.top[TOP - 1].s : null, top1: aTop ? aTop.s : null, examText: r.examText };
    const flags = [];
    if (hit && hit.ok === true && hit.k) {
      const isSV = SV(hit.kind); if (isSV) out.ownerSV++; else out.ownerType++;
      const f = A.findT(hit.k);
      if (f.t) {
        const g = r.gradeT(f.t);
        v.ownerScore = g.s; v.ownerKindByAnalyzer = g.kind; v.ownerWhy = g.why;
        v.ownerRank = 1 + r.graded.filter((x) => !sameMat(x.t.k, f.t.k, A.tmap) && M.better(x, g) < 0).length;
      }
      const pos = inTop(hit.k);
      let st;
      if (pos >= 0) { st = '일치'; v.ownerRank = pos + 1; v.ownerKindByAnalyzer = r.top[pos].kind; if (isSV && r.top[pos].kind === hit.kind) out.kindAgree++; }
      else if (!r.examText) { st = '확인 불가'; v.note = '시험 문항 글이 없음'; }
      else if (!f.t || !f.t.p.text) { st = '확인 불가'; v.note = !f.t ? f.why : (f.t.state === 'err' ? '은행 실패: ' + f.t.e.err : f.t.state === 'none' ? '글자 은행에 아직 없음' : '옮겨 적은 글이 비어 있음(그림만)'); }
      else if (r.top.length >= TOP && v.ownerScore <= v.sixth) st = '동급';
      else { st = '놓침'; v.note = r.top.length < TOP ? `6개가 다 차지 않았는데 빠짐 (분석기 등급 ${M.LABEL[v.ownerKindByAnalyzer] || v.ownerKindByAnalyzer})` : `6위(${v.sixth}) 보다 높은 ${v.ownerScore} 인데 안 나옴`; }
      if (isSV) { if (st === '일치') out.agree++; else if (st === '동급') out.same6++; else if (st === '놓침') out.miss++; else out.unknown++; }
      else if (st === '일치') out.typeIn6++;
      flags.push(isSV ? st : `유형 확정 · ${st}`);
    }
    /* 잘못 찾음 — 1순위만 본다 */
    if (aTop && SV(aTop.kind) && rejectedKeys.some((k) => sameMat(k, aTop.k, A.tmap))) { out.wrong++; flags.push('잘못 찾음'); v.note = (v.note ? v.note + ' · ' : '') + `원장 ✗ 한 ${aTop.k} 를 1순위 ${M.LABEL[aTop.kind]}로 봄`; }
    if (hit && hit.ok === false && !hit.k && aTop && SV(aTop.kind)) { out.noHitSV++; flags.push('참고: 원장 «적중 없음»'); v.note = (v.note ? v.note + ' · ' : '') + `원장 «적중 없음»인데 1순위 ${M.LABEL[aTop.kind]} ${aTop.k}${seen(aTop.k) ? '' : ' (원장님이 못 본 자료)'}`; }
    r.top.filter((c) => SV(c.kind)).forEach((c) => { if (!(hit && hit.k && sameMat(hit.k, c.k, A.tmap)) && !seen(c.k) && !(hit && hit.ok === false && !hit.k)) { out.newFound++; flags.push('새로 찾음'); } });
    if (!hit || hit.ok == null) { out.unconfirmed++; flags.push('원장 확정 없음'); }
    if (wTop && aTop && sameMat(wTop.k, aTop.k, A.tmap)) out.workerAgree++;
    v.status = [...new Set(flags)].join(' · ') || '—';
    out.items.push(v);
  });
  out.pass = out.miss === 0 && out.wrong <= 2;
  return out;
}

/* ── 보고서 ── */
function reportMd(A, V, withTitle) {
  const d = A.data, e = d.exam || {};
  const L = [];
  const pl = (k) => { const f = A.findT(k); return f.t ? placeOf(f.t, withTitle) : (placeOf(A.tmap.get(String(k || '').replace(/^pub:/, 'tb:')), withTitle) || k || ''); };
  const kd = (x) => (x === 'sim' ? '유사문제' : M.LABEL[x] || ({ text: '지문만' })[x] || x || '');
  L.push(`# 🔤 루멘 분석기 검증 — ${e.school || ''} ${e.grade || ''} ${e.year || ''}년 ${e.semester || ''}학기 ${e.term || ''}`);
  L.push('');
  L.push(`만든 때 ${new Date().toISOString().slice(0, 16).replace('T', ' ')} (UTC) · 시험 ${A.rows.length}문항 · 비교한 자료 ${A.cov.cands}개`);
  L.push('');
  L.push(`## 결과: ${V.pass ? '✅ 통과' : '❌ 아직'} (기준: 놓침 0 · 잘못 찾음 2 이하 — 원장님이 «같은문제·숫자변형»으로 확정한 ${V.ownerSV}문항 기준)`);
  L.push('');
  L.push('| 일치 | 동급 | 놓침 | 확인 불가 | 잘못 찾음 | 일치 중 등급도 같음 | 유형 확정 중 6개 안 | 새로 찾음 | 원장 확정 없는 문항 | 1순위가 지금 워커와 같음 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  L.push(`| ${V.agree} | ${V.same6} | ${V.miss} | ${V.unknown} | ${V.wrong} | ${V.kindAgree} | ${V.typeIn6}/${V.ownerType} | ${V.newFound} | ${V.unconfirmed} | ${V.workerAgree} |`);
  L.push('');
  L.push('- **일치** = 원장님이 확정한 자료가 분석기 위 6개 안에 있다(등급이 달라도). 등급 비교는 표의 «원장/분석기 등급».');
  L.push('- **동급** = 6개 밖이지만, 분석기가 그 자료보다 뼈대가 같거나 더 닮은 자료 6개를 찾았다(흔한 문제의 쌍둥이가 여럿일 때). 통과 계산에서 빼고 목록으로만 보인다.');
  L.push('- **놓침** = 원장 확정 자료가 글도 있고 6위보다 더 닮았는데 안 나왔다 · 또는 6개가 다 차지 않았는데 빠졌다.');
  L.push('- **확인 불가** = 원장 확정 자료의 글이 없다(아래 «글자 은행 채움»).');
  L.push(`- **잘못 찾음** = 분석기 1순위(같은문제·숫자변형)를 원장님이 ✗ 표시했다. 지금 저장된 ✗ 표시: ${V.rejectedSeen}개 (✗ 는 hit · 후보 rejected · 출판사 rejected 에 남는다. 워커가 다시 판정하면 후보의 rejected 는 지워진다).`);
  if (V.noHitSV) L.push(`- 참고: 원장님이 «적중 없음»으로 확정한 문항 중 ${V.noHitSV}개에서 분석기 1순위가 같은문제·숫자변형 — 아래 표에서 확인해 주세요.`);
  L.push('- **새로 찾음** = 학원앱 후보에 없던 자료를 분석기가 같은문제·숫자변형이라 함 → 맞는지 봐 주세요.');
  L.push('');
  L.push('## 글자 은행 채움');
  L.push('');
  L.push(`- 시험 문항 글: ${A.cov.examText}/${A.cov.examItems}`);
  L.push(`- 자료 글: ${A.cov.candText}/${A.cov.cands} (질문 칸에만 글이 있던 것은 본문과 합쳐 씀)`);
  L.push('');
  L.push('| 자료 | 전체 | 본문 있음 | 질문 칸에만 | 빈 글 | 실패 | 은행에 없음 |');
  L.push('|---|---|---|---|---|---|---|');
  Object.entries(A.cov.byKind).forEach(([k, b]) => L.push(`| ${KIND_KO[k] || k} | ${b.n} | ${b.text} | ${b.askOnly} | ${b.empty} | ${b.err} | ${b.none} |`));
  L.push('');
  L.push(`- **질문 칸에만**: OCR 이 문제 전체를 ask 칸에 넣고 text 를 비운 것 — 합쳐 쓰므로 비교에 문제없다.`);
  L.push(`- **빈 글**: 글자가 거의 없는 그림 문항(그림 있음 ${A.cov.emptyFig}개) → 단원으로만 비교.`);
  Object.entries(A.cov.errs).forEach(([m, n]) => L.push(`- **실패** ${m}: ${n}개` + (/그림을 받지 못함|그림 없음/.test(m) ? ' — 매쓰플랫에 문제 그림이 없는 교과서 문항(준비학습·개념 탐구처럼 답만 있는 것). 다시 해도 그림이 없다.' : '')));
  L.push(`- **은행에 없음**: 글자 은행을 채운 뒤 새로 들어온 자료이거나 범위를 다르게 돌린 것 → mode=bank 로 다시.`);
  const skipped = Object.entries(A.info.skipped || {}); if (skipped.length) L.push(`- 모을 때 뺀 것(비교 안 함): ` + skipped.map(([k, n]) => `${k} ${n}`).join(' · '));
  L.push('');
  L.push('## 문항별');
  L.push('');
  L.push('| 번호 | 상태 | 원장 확정 | 원장/분석기 등급 · 점수 · 순위 | 지금 워커 1순위 | 분석기 1순위 | 분석기 2~3순위 |');
  L.push('|---|---|---|---|---|---|---|');
  V.items.forEach((v, i) => {
    const r = A.rows[i];
    const own = v.owner ? (v.owner.ok === false && !v.owner.k ? '적중 없음' : `${v.owner.ok ? '✓' : '✗'} ${kd(v.owner.kind)} ${pl(v.owner.k)}`) : '—';
    const cmp = v.owner && v.owner.k && v.owner.ok ? `${kd(v.owner.kind)} / ${kd(v.ownerKindByAnalyzer) || '—'} · 뼈대 ${v.ownerScore == null ? '—' : v.ownerScore} · ${v.ownerRank ? v.ownerRank + '위' : '—'} (1위 ${v.top1 == null ? '—' : v.top1} · 6위 ${v.sixth == null ? '—' : v.sixth})` : '';
    const wk = v.worker ? `${kd(v.worker.kind)} ${pl(v.worker.k)}` : '—';
    const a1 = r.top[0] ? `**${kd(r.top[0].kind)}** ${pl(r.top[0].k)}<br>${r.top[0].why}` : '—';
    const a23 = r.top.slice(1, 3).map((c) => `${kd(c.kind)} ${pl(c.k)} (${c.why})`).join('<br>') || '—';
    L.push(`| ${v.no}${r.examText ? '' : ' ⚠글 없음'} | ${v.status}${v.note ? '<br>' + v.note : ''} | ${own} | ${cmp} | ${wk} | ${a1} | ${a23} |`);
  });
  L.push('');
  L.push(`기준 숫자: 같은문제 뼈대 ≥ ${M.TH.SAME} + 숫자 같음 · 숫자변형 뼈대 ≥ ${M.TH.VAR} · 유사문제 뼈대 ${M.TH.SIM}~${M.TH.VAR} + 같은 소단원(또는 유형 번호) · 같은유형 = 유형 번호 또는 소단원만 같음 · 질문이 ${M.TH.ASK_LIFT} 이상 닮으면 뼈대 +${M.TH.LIFT} (sync/lumen_analyzer/match.js TH). 뼈대는 본문+질문 전체 글.`);
  return L.join('\n') + '\n';
}
function reportJson(A, V, withTitle) {
  return { examId: A.examId, at: new Date().toISOString(), th: M.TH, pass: V.pass,
    counts: { agree: V.agree, same6: V.same6, miss: V.miss, unknown: V.unknown, wrong: V.wrong, kindAgree: V.kindAgree, ownerSV: V.ownerSV, ownerType: V.ownerType, typeIn6: V.typeIn6, noHitSV: V.noHitSV, newFound: V.newFound, unconfirmed: V.unconfirmed, workerAgree: V.workerAgree, rejectedSeen: V.rejectedSeen },
    coverage: A.cov,
    items: V.items.map((v, i) => ({ ...v, pool: A.rows[i].pool,
      analyzer: v.analyzer.map((c) => ({ ...c, where: placeOf(A.tmap.get(c.k), withTitle) })) })) };
}

/* ── --apply: 분석기 후보를 결과에 넣기 (chat_judge_apply_cands.py 와 같은 통계 다시 세기) ── */
async function applyToExam(A) {
  const d = A.data; const mats = d.mats = d.mats || {};
  const MAP = { same: 'same', var: 'var', sim: 'type', type: 'type' };   /* 학원앱 등급에는 «유사문제»가 없어 같은유형으로 — why 에 «유사» */
  const RANK = { same: 4, var: 3, text: 2, type: 1 };
  for (const r of A.rows) {
    const it = r.it;
    let cands = r.top.filter((c) => !c.pubOnly).map((c) => ({ k: c.k, kind: MAP[c.kind], why: ((c.kind === 'sim' ? '유사 · ' : '') + c.why).slice(0, 40), also: c.also, idSame: false, by: 'analyzer' }));
    const h = it.hit;
    if (h && h.ok === true && h.k && !/^pub:/.test(h.k)) {   /* 원장 확정은 맨 앞에 고정 */
      const i = cands.findIndex((c) => sameMat(c.k, h.k, A.tmap));
      let pin;
      if (i >= 0) { const c0 = cands.splice(i, 1)[0]; pin = { ...c0, k: h.k, kind: h.kind || c0.kind }; }
      else pin = { k: h.k, kind: h.kind || 'type', why: '원장 확정', also: [], idSame: false, by: 'teacher' };
      cands.sort((a, b) => RANK[b.kind] - RANK[a.kind]); cands = [pin].concat(cands);
    } else cands.sort((a, b) => RANK[b.kind] - RANK[a.kind]);
    it.cands = cands;
    for (const c of cands) {
      for (const k of [c.k].concat(c.also || [])) {
        if (mats[k]) continue; const t = A.tmap.get(k); if (!t) continue;
        if (t.kind === 'ws' || t.kind === 'wb') { const m = t.mat; if (!m.img && t.resolve) await t.resolve().catch(() => ''); mats[k] = { kind: m.kind, title: m.title, where: W.whereOf(m), cid: m.cid, level: m.level, img: m.img || '', store: '', storeUrl: '', res: m.res || {} }; }
        else if (t.kind === 'tb') mats[k] = { kind: 'textbook', title: String(t.title || '').replace(/^교과서_/, '교과서 '), where: placeOf(t, true), cid: t.cid, level: t.level, img: t.img || '', store: '', storeUrl: '', res: {} };
        else if (t.kind === 'mp' || t.kind === 'ms') { const p = await W.kvGet((t.kind === 'mp' ? 'ms_mypaper_' : 'ms_paper_') + t.paper); const x = ((p && p.items) || []).find((y) => y.no === t.no) || {};
          mats[k] = { kind: 'ms', title: t.title, where: `${t.title} ${t.no}번`, cid: t.cid, level: t.level, img: '', store: x.img || '', storeUrl: x.img ? await W.stSign(x.img) : '', res: {}, ...(t.kind === 'mp' ? { mp: true, msChapter: t.msChapter || '' } : {}) }; }
      }
    }
  }
  /* 통계 — chat_judge_apply_cands.py 와 같은 식 */
  const st = d.stats = d.stats || {};
  ['same', 'var', 'text', 'type'].forEach((k) => { st[k] = 0; });
  d.items.forEach((x) => { const t = (x.cands || [])[0]; if (t && st[t.kind] != null) st[t.kind]++; });
  const inB = { same: ['same'], 'same+var': ['same', 'var'], type: ['same', 'var', 'type'] }[d.basis || 'same+var'] || ['same', 'var'];
  Object.values(st.byKind || {}).forEach((v) => { v.hit = 0; if (v.mp && typeof v.mp === 'object') v.mp.hit = 0; });
  d.items.forEach((x) => { const t = (x.cands || [])[0]; if (!t || !inB.includes(t.kind)) return; const m = mats[t.k];
    if (m && st.byKind && st.byKind[m.kind]) st.byKind[m.kind].hit++;
    if (/^mp:/.test(t.k) && st.byKind && st.byKind.ms && st.byKind.ms.mp) st.byKind.ms.mp.hit++; });
  st.judgedBy = 'analyzer'; d.analyzerAt = new Date().toISOString();
  await W.kvSet('exam_hit_' + A.examId, d);
  const idx = (await W.kvGet('exam_hit_index')) || { items: [] };
  (idx.items || []).forEach((x) => { if (x.examId === A.examId) x.auto = { same: st.same, var: st.var, type: st.type, text: st.text }; });
  await W.kvSet('exam_hit_index', idx);
  log(`--apply 저장: exam_hit_${A.examId} · 1순위 같은문제 ${st.same} · 숫자변형 ${st.var} · 유형 ${st.type}`);
}

module.exports = { analyze, validate, reportMd, reportJson, sameMat, idKeys };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
  const has = (n) => args.includes('--' + n);
  (async () => {
    const examId = arg('exam', ''); if (!examId) throw new Error('--exam <시험 id> 가 필요합니다');
    const A = await analyze(examId, { scope: arg('scope', 'all'), pub: !has('no-pub'), bankFile: arg('bank-file', '') });
    const V = validate(A);
    const dir = arg('report', pathMod.join(process.cwd(), 'analyzer_report'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(pathMod.join(dir, 'report.md'), reportMd(A, V, false));
    fs.writeFileSync(pathMod.join(dir, 'report.json'), JSON.stringify(reportJson(A, V, false), null, 1));
    log(`보고서: ${dir}/report.md · report.json`);
    log(`글자 은행: 시험 ${A.cov.examText}/${A.cov.examItems} · 자료 ${A.cov.candText}/${A.cov.cands}`);
    log(`검증 (같은문제·숫자변형 확정 ${V.ownerSV}): 일치 ${V.agree} · 동급 ${V.same6} · 놓침 ${V.miss} · 확인 불가 ${V.unknown} · 잘못 찾음 ${V.wrong} · 등급도 같음 ${V.kindAgree} · 유형 확정 6개 안 ${V.typeIn6}/${V.ownerType} · 새로 찾음 ${V.newFound} · 원장 확정 없음 ${V.unconfirmed} → ${V.pass ? '통과' : '아직'}`);
    if (!has('no-save')) {
      const j = reportJson(A, V, true); j.md = reportMd(A, V, true);
      await W.kvSet('analyzer_report_' + examId, j);
      log(`저장: lumen_store analyzer_report_${examId}`);
    }
    if (has('apply')) await applyToExam(A);
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
