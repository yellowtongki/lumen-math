#!/usr/bin/env node
/**
 * sync/blog_topics.js — 블로그 글감 생성기 (2단계)
 *
 * 학원앱 데이터(Supabase)를 집계해서 "이번 주 쓸 만한 글감"을 docs/blog_topics_latest.md 로 뽑는다.
 *
 *   node sync/blog_topics.js                 # 최근 7일 집계 → docs/blog_topics_latest.md
 *   node sync/blog_topics.js --days 14       # 기간 변경
 *   node sync/blog_topics.js --dry           # 파일에 쓰지 않고 화면에만
 *   node sync/blog_topics.js --topic "오늘 반텐, 시험대비" --topic "서울 세미나"   # 원장님 글감 추가
 *
 * 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY (다른 sync 스크립트와 같다)
 *
 * ⚠️ 개인정보 원칙
 *   - 학생 이름·코드·개별 점수는 절대 출력하지 않는다. 집계 수치만.
 *   - 표본이 작은 묶음(문항 20개 미만, 학생 3명 미만)은 아예 표에서 뺀다.
 *   - 결과 파일은 공개 저장소에 커밋된다는 전제로 쓴다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });

const args = process.argv.slice(2);
const opt = { days: 7, dry: false, out: 'docs/blog_topics_latest.md', topics: [] };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--days') opt.days = parseInt(args[++i], 10) || 7;
  else if (args[i] === '--dry') opt.dry = true;
  else if (args[i] === '--out') opt.out = args[++i];
  else if (args[i] === '--topic') opt.topics.push(args[++i]);
}

const MIN_PROBLEMS = 20;   // 이보다 적은 문항 수의 유형은 표에 안 올린다
const MIN_STUDENTS = 3;    // 이보다 적은 학생이 푼 유형도 안 올린다

const log = (...a) => console.error(...a);
const pct = (n, d) => d ? Math.round(n / d * 100) : 0;

// ── Supabase 읽기 (1000행씩 페이지) ──────────────────────────────
async function sbAll(pathWithQuery) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SB_URL}/rest/v1/${pathWithQuery}`, { headers: { ...sbH(), range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const rows = await r.json();
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}
async function sbStore(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].value : null;
}

// ── ① 매쓰플랫 정오답 → 유형별 오답 집계 ─────────────────────────
async function collectWrongTypes(sinceIso) {
  const rows = await sbAll(
    `mf_answer_records?select=mf_student_id,concept_id,chapter,result,level,worksheet_title,source` +
    `&score_datetime=gte.${sinceIso}&result=in.(O,X,?)`);
  const names = (await sbStore('mf_concept_names')) || {};

  const byType = new Map();   // key: 중단원(m) → {n, x, students:Set, subs:Map}
  const students = new Set();
  let total = 0, wrong = 0;
  for (const r of rows) {
    total++; students.add(r.mf_student_id);
    const isWrong = r.result !== 'O';
    if (isWrong) wrong++;
    const nm = names[String(r.concept_id)];
    const key = nm ? nm.m : (r.chapter || '(단원 미상)');
    const sub = nm ? nm.n : null;
    let t = byType.get(key);
    if (!t) { t = { name: key, n: 0, x: 0, students: new Set(), subs: new Map() }; byType.set(key, t); }
    t.n++; if (isWrong) t.x++; t.students.add(r.mf_student_id);
    if (sub) { const s = t.subs.get(sub) || { n: 0, x: 0 }; s.n++; if (isWrong) s.x++; t.subs.set(sub, s); }
  }
  const types = [...byType.values()]
    .filter(t => t.n >= MIN_PROBLEMS && t.students.size >= MIN_STUDENTS)
    .map(t => ({
      name: t.name, n: t.n, x: t.x, rate: pct(t.x, t.n), students: t.students.size,
      worstSub: [...t.subs.entries()].filter(([, s]) => s.n >= 8).sort((a, b) => pct(b[1].x, b[1].n) - pct(a[1].x, a[1].n))[0] || null,
    }));
  return {
    total, wrong, students: students.size,
    byCount: [...types].sort((a, b) => b.x - a.x).slice(0, 5),
    byRate: [...types].filter(t => t.n >= 40).sort((a, b) => b.rate - a.rate).slice(0, 5),
  };
}

// ── ② 아하노트 → 질문 통계 ───────────────────────────────────────
async function collectAha(sinceIso) {
  const rows = await sbAll(
    `aha_notes?select=student_code,student_grade,source_name,error_types,status,kind&created_at=gte.${sinceIso}`);
  const students = new Set(rows.map(r => r.student_code));
  const cnt = (arr) => { const m = new Map(); for (const k of arr) if (k) m.set(k, (m.get(k) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const errs = cnt(rows.flatMap(r => Array.isArray(r.error_types) ? r.error_types : []));
  const books = cnt(rows.map(r => r.source_name));
  const grades = cnt(rows.map(r => r.student_grade));
  const resolved = rows.filter(r => r.status && r.status !== 'pending').length;
  return { total: rows.length, students: students.size, resolved, errs: errs.slice(0, 5), books: books.slice(0, 5), grades: grades.slice(0, 5) };
}

// ── 글감 제안 만들기 ──────────────────────────────────────────────
function suggest(mf, aha, days) {
  const s = [];
  if (mf.byCount[0]) {
    const t = mf.byCount.slice(0, 3).map(t => `「${t.name}」`).join(' · ');
    s.push({ title: `이번 주 아이들이 가장 많이 틀린 단원 TOP3 — ${t}`, src: '매쓰플랫 정오답', angle: '수치 카드 3장 + 왜 여기서 틀리는지 원장 관찰' });
  }
  if (mf.byRate[0]) {
    const t = mf.byRate[0];
    s.push({ title: `「${t.name}」 오답률 ${t.rate}% — 개념은 아는데 왜 틀릴까`, src: '매쓰플랫 정오답', angle: t.worstSub ? `세부 유형 「${t.worstSub[0]}」이 특히 약함 (오답률 ${pct(t.worstSub[1].x, t.worstSub[1].n)}%)` : '세부 유형 분석' });
  }
  if (aha.errs[0]) {
    s.push({ title: `아하노트 ${days}일 — 학생들이 고른 "틀린 이유" 1위는 「${aha.errs[0][0]}」`, src: '아하노트', angle: '틀린 이유를 스스로 고르게 하는 이유 · 메타인지' });
  }
  if (aha.books[0]) {
    s.push({ title: `요즘 질문이 가장 많이 나오는 교재 — ${aha.books[0][0]}`, src: '아하노트', angle: '교재 진도와 시험 범위를 잇는 이야기' });
  }
  s.push({ title: '시험 전 주말, 반텐(반 텐투텐) 운영 기록', src: '현장', angle: '실사진 + 운영 원칙 (휴대폰 없이 4시간)' });
  return s;
}

function render({ mf, aha, sugg, days, since, until, topics }) {
  const L = [];
  L.push(`# 블로그 글감 — 최근 ${days}일 (${since} ~ ${until})`);
  L.push('');
  L.push(`**생성**: ${until} · \`node sync/blog_topics.js --days ${days}\` · 원본 규칙: \`docs/lumen_blog_profile.md\``);
  L.push('');
  L.push('> 이 파일은 **집계·익명 수치만** 담는다. 학생 이름·코드·개별 점수는 넣지 않는다 (공개 저장소).');
  L.push(`> 문항 ${MIN_PROBLEMS}개 미만 · 학생 ${MIN_STUDENTS}명 미만인 묶음은 표에서 뺐다.`);
  L.push('');
  if (topics.length) {
    L.push('## 0. 원장님 글감 (이번 주 우선)');
    L.push('');
    topics.forEach((t, i) => L.push(`${i + 1}. ${t}`));
    L.push('');
  }
  L.push('## 1. 매쓰플랫 정오답 — 가장 많이 틀린 단원');
  L.push('');
  L.push(`채점 문항 **${mf.total.toLocaleString()}개** · 오답 **${mf.wrong.toLocaleString()}개** (오답률 ${pct(mf.wrong, mf.total)}%) · 활동 학생 ${mf.students}명`);
  L.push('');
  if (mf.byCount.length) {
    L.push('| 순위 | 단원(유형) | 문항 수 | 오답 | 오답률 | 푼 학생 | 가장 약한 세부 유형 |');
    L.push('|---|---|---|---|---|---|---|');
    mf.byCount.forEach((t, i) => L.push(`| ${i + 1} | ${t.name} | ${t.n} | ${t.x} | ${t.rate}% | ${t.students}명 | ${t.worstSub ? `${t.worstSub[0]} (${pct(t.worstSub[1].x, t.worstSub[1].n)}%)` : '—'} |`));
  } else L.push('(표본 부족)');
  L.push('');
  L.push('**오답률이 높은 순** (문항 40개 이상)');
  L.push('');
  if (mf.byRate.length) {
    L.push('| 단원(유형) | 오답률 | 문항 수 |');
    L.push('|---|---|---|');
    mf.byRate.forEach(t => L.push(`| ${t.name} | ${t.rate}% | ${t.n} |`));
  } else L.push('(표본 부족)');
  L.push('');
  L.push('## 2. 아하노트 — 학생 질문 통계');
  L.push('');
  L.push(`기록 **${aha.total}건** · 남긴 학생 ${aha.students}명 · 해결 처리 ${aha.resolved}건`);
  L.push('');
  const pair = (arr) => arr.length ? arr.map(([k, v]) => `${k} ${v}건`).join(' · ') : '(없음)';
  L.push(`- 학생이 고른 "틀린 이유": ${pair(aha.errs)}`);
  L.push(`- 질문이 나온 교재: ${pair(aha.books)}`);
  L.push(`- 학년 분포: ${pair(aha.grades)}`);
  L.push('');
  L.push('## 3. 글감 제안');
  L.push('');
  L.push('| # | 제목 후보 | 출처 | 각도 |');
  L.push('|---|---|---|---|');
  sugg.forEach((s, i) => L.push(`| ${i + 1} | ${s.title} | ${s.src} | ${s.angle} |`));
  L.push('');
  L.push('## 다음 할 일');
  L.push('');
  L.push('1. 위에서 하나 고른다 (또는 0번 원장님 글감)');
  L.push('2. Claude가 `docs/lumen_blog_profile.md` 말투로 본문 + `cards.json` 작성 → `blog/<날짜-주제>/`');
  L.push('3. `node sync/card_render.js blog/<폴더>` → 카드 PNG 6장');
  L.push('4. `node sync/post_check.js blog/<폴더>` → 통과 확인');
  L.push('');
  return L.join('\n');
}

(async () => {
  if (!SB_URL || !SB_KEY) { log('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다'); process.exit(1); }
  const until = new Date();
  const since = new Date(until.getTime() - opt.days * 86400000);
  const sinceIso = since.toISOString();
  const d = (x) => x.toISOString().slice(0, 10);
  log(`📊 최근 ${opt.days}일 집계 중 (${d(since)} ~ ${d(until)})…`);
  const [mf, aha] = await Promise.all([collectWrongTypes(sinceIso), collectAha(sinceIso)]);
  log(`   매쓰플랫 ${mf.total}문항 / 아하노트 ${aha.total}건`);
  const md = render({ mf, aha, sugg: suggest(mf, aha, opt.days), days: opt.days, since: d(since), until: d(until), topics: opt.topics });
  if (opt.dry) { console.log(md); return; }
  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  fs.writeFileSync(opt.out, md, 'utf8');
  log(`✅ ${opt.out} 저장`);
})().catch(e => { log('❌', e.message); process.exit(1); });
