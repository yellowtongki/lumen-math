#!/usr/bin/env node
/* 매쓰플랫 원본 학습지 채우기 — 원장 지시 2026-09-25 「최근 3개년 우선, 옥길중 → 범박고 → 소사고 → 범박중 순서」
 * 수학비서 기출 시험지 중 매쓰플랫 원본 학습지(다리)가 없는 것을 골라 exam_twin_pipeline(--original-only)로 등록한다.
 * 결과는 워커와 같은 모양으로 twin_done.byMydb 에 남기고, 끝나면 exam_db_collector --bridge-only 가 풀이 그림을 받는다.
 * 사용: node sync/exam_originals_fill.js recent|old   (recent = 2024년 이후, old = 그 전) */
const fs = require('fs'); const path = require('path'); const { execSync } = require('child_process');

const SP = process.cwd();
const MODE = process.argv[2] || 'recent';
const SB = process.env.SUPABASE_URL.replace(/\/$/, ''), K = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: K, authorization: `Bearer ${K}`, 'content-type': 'application/json' };
const log = (...a) => { const s = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`; console.log(s); };
async function kvGet(k) { const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${k}&select=value`, { headers: H }); const j = await r.json(); let v = j[0] && j[0].value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } } return v; }
async function kvSet(k, v) { const r = await fetch(`${SB}/rest/v1/lumen_store?on_conflict=key`, { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ key: k, value: v, updated_at: new Date().toISOString() }]) }); return r.ok; }
/* 고등 교육과정 키 — 기존 등록분(2026-08-28)과 같은 규칙: 고1·고2 시험지는 옛 이름(수학상·수학1…)이라도 «지금 학생이 배우는 22개정 과목»으로 등록한다
 * (공통수학1·2 · 대수 · 미적분1 · 확률과 통계). 그래야 유형 번호가 학생 기록과 같은 교육과정이 된다. 고3은 아직 15개정(미적분·확률과 통계·기하).
 * 키는 sync/mypaper_to_mathflat.js 의 표(2026-09-13 /curriculums/by-key 스캔). 학습지 grade 값은 띄어쓰기까지 매쓰플랫 그대로. */
function highOpts(title, g, sem) {
  const t = String(title);
  if (String(g) === '3') {
    if (/확률과통계|확통/.test(t)) return { trie: '1.2.7.45', gv: '확률과 통계' };
    if (/미적분/.test(t)) return { trie: '1.2.7.46', gv: '미적분' };
    if (/기하/.test(t)) return { trie: '1.2.7.47', gv: '기하' };
    return null;
  }
  if (/공통수학1|수학상|수학\(상\)/.test(t)) return { trie: '1.4.4147.4175', gv: '공통수학1' };
  if (/공통수학2|수학하|수학\(하\)/.test(t)) return { trie: '1.4.4147.4176', gv: '공통수학2' };
  if (/대수|수학1(?!\d)|수학Ⅰ|수학I(?!I)/.test(t)) return { trie: '1.4.4147.4177', gv: '대수' };
  if (/미적분1|미적분Ⅰ|수학2|수학Ⅱ|수학II/.test(t)) return { trie: '1.4.4147.4178', gv: '미적분1' };
  if (/확률과통계|확통/.test(t)) return { trie: '1.4.4147.4179', gv: '확률과 통계' };
  /* 제목에 과목이 없으면(소사고 2023 고2 1학기 중간) 학년·학기로 짐작: 고1 1학기 공통수학1 · 고1 2학기 공통수학2 · 고2 1학기 대수 · 고2 2학기 미적분1 */
  if (sem) { const k = String(g) + '-' + String(sem); const M = { '1-1': ['1.4.4147.4175', '공통수학1'], '1-2': ['1.4.4147.4176', '공통수학2'], '2-1': ['1.4.4147.4177', '대수'], '2-2': ['1.4.4147.4178', '미적분1'] }; if (M[k]) return { trie: M[k][0], gv: M[k][1], guessed: true }; }
  return null;
}
(async () => {
  const bridge = ((await kvGet('ms_exam_bridge')) || {}).byMydb || {};
  const done = (await kvGet('twin_done')) || {}; done.byMydb = done.byMydb || {};
  const order = ['옥길중', '범박고', '소사고', '범박중']; const targets = [];
  for (const s of order) {
    const v = await kvGet('ms_exams_' + s); if (!v || !v.exams) continue;
    const list = v.exams.filter((e) => !bridge[String(e.id)] && !(done.byMydb[String(e.id)] && done.byMydb[String(e.id)].wsOriginal))
      .filter((e) => MODE === 'recent' ? Number(e.year) >= 2024 : Number(e.year) < 2024)
      .sort((a, b) => Number(b.year) - Number(a.year));
    list.forEach((e) => targets.push({ school: s, e }));
  }
  log(`대상 ${targets.length}장 (${MODE})`);
  const { runTwinPipeline } = require('./exam_twin_pipeline.js');
  let ok = 0, fail = 0;
  for (const { school, e } of targets) {
    const isHigh = /고[123]/.test(String(e.grade)); const g = (String(e.grade).match(/(\d)/) || [])[1] || '1';
    const opts = { mydb: e.id, originalOnly: true, mylist: '기출 쌍둥이', log };
    if (isHigh) { const ho = highOpts(e.title, g, e.semester); if (ho && ho.guessed) log(`   (과목 이름이 없어 ${ho.gv}로 짐작)`); if (!ho) { log(`건너뜀(교육과정 키 없음): ${e.id} ${e.title}`); continue; } opts.trie = ho.trie; opts.gradeValue = ho.gv; opts.grade = `고 ${g}-${e.semester}`; }
    log(`── ${school} ${e.year} ${e.grade} ${e.semester}학기 ${e.term} (${e.id})`);
    try {
      const r = await runTwinPipeline(opts);
      done.byMydb[String(e.id)] = { title: r.title, paperId: r.paperId, wsOriginal: r.worksheetOriginal, wsTwin: null, matched: r.matched, matchedTotal: r.matchedTotal, mylist: r.mylist, at: new Date().toISOString() };
      await kvSet('twin_done', done); ok++;
      log(`   ✅ ${r.title} → 원본 학습지 ${r.worksheetOriginal} · 맞춤 ${r.matched}/${r.matchedTotal}`);
    } catch (err) { fail++; log(`   ❌ ${e.id} ${String(err.message || err).slice(0, 200)}`); }
  }
  log(`등록 끝: 성공 ${ok} · 실패 ${fail}`);
  try { log(execSync('node sync/exam_db_collector.js --schools 옥길중,범박중,범박고,소사고 --bridge-only', { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n').slice(-6).join('\n')); } catch (err) { log('다리 수집 실패: ' + String(err.message).slice(0, 200)); }
  log('끝');
})().catch((e) => { console.error('오류', e); process.exit(1); });
