#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🎯 시험대비 트랙 자동 채우기  v1  (2026-09-01)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【무엇을 하나요?】
 *   학원앱 「시험대비 트랙」(lumen_store exam_track)을 실제 등록부·교재
 *   목록으로 자동 구성합니다. 원장님은 화면에서 날짜와 문항 수만 다듬으면 됩니다.
 *
 *   ① 학교별 디데이 — 옥길중·소사고·범박고 (2026-09-01 원장 지시)
 *      ※ 2학기 중간고사 <b>날짜는 학교 공지로 확인이 필요</b>합니다. 여기서는
 *        통상 시기(10월 중순) 임시값을 넣고 시험명에 「확인 필요」를 붙입니다.
 *        화면에서 큰 숫자를 클릭하면 바로 고칠 수 있습니다.
 *   ② 반별 트랙 — 등록부의 반·학년·학교를 보고 그 학년 시험 범위에 맞는
 *      교재·학습지를 순서대로 배정합니다.
 *
 * 【문항 수】
 *   학습지(어제 이식한 교과서 DB 등)는 매쓰플랫 채점 기록에서 실제 문항 수를
 *   읽어 정확히 넣습니다. 시중 교재는 전체 문항 수를 알 길이 없어
 *   기본값을 넣고 화면에서 고치도록 「확인」 표시를 남깁니다.
 *
 * 【사용법】
 *   node sync/exam_track_seed.js --plan     # 미리보기 (저장 안 함)
 *   node sync/exam_track_seed.js            # 저장 (기존 트랙은 덮어씀)
 *   옵션: --keep-ddays   이미 등록된 디데이는 건드리지 않는다
 *
 * 계정: SUPABASE_URL / SUPABASE_SERVICE_KEY (환경변수만)
 */
const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const args = process.argv.slice(2);
const PLAN = args.includes('--plan');
const KEEP_DDAYS = args.includes('--keep-ddays');
const log = (...a) => console.log(...a);

async function sbGet(p) {
  const r = await fetch(SB_URL + '/rest/v1' + p, { headers: sbH() });
  if (!r.ok) throw new Error(p + ' → ' + r.status);
  return r.json();
}
async function kvGet(key) {
  const j = await sbGet(`/lumen_store?key=eq.${key}&select=value`);
  let v = (j[0] && j[0].value) || null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
/* 서버가 한 번에 1000행까지만 준다 — 나눠 받는다 */
async function sbPage(pathNoRange, maxPages) {
  let out = [];
  for (let pg = 0; pg < (maxPages || 8); pg++) {
    const r = await sbGet(`${pathNoRange}&limit=1000&offset=${pg * 1000}`);
    out = out.concat(r);
    if (r.length < 1000) break;
  }
  return out;
}
/* 최근 채점 기록 → 반별로 「지금 풀고 있는 교재」를 찾아낸다.
 * 누적 스냅샷이므로 (학생|교재|배정인스턴스)별 <b>최신 행</b>만 본다. */
async function recentBooks(days) {
  const cut = new Date(Date.now() - (days || 30) * 86400000).toISOString();
  const rows = await sbPage(`/mf_study_sessions?update_datetime=gte.${cut}`
    + `&select=mf_student_id,book_id,title,source,correct_count,wrong_count,student_workbook_id,student_book_id,update_datetime`
    + `&order=update_datetime.desc`, 10);
  const last = {};
  rows.forEach((x) => {
    const k = `${x.mf_student_id}|${x.book_id}|${x.student_workbook_id || x.student_book_id || 0}`;
    const at = String(x.update_datetime || '');
    if (!last[k] || at > last[k].at) last[k] = { at, n: (x.correct_count || 0) + (x.wrong_count || 0), sid: x.mf_student_id, book: x.book_id, title: x.title, src: x.source };
  });
  return Object.values(last);
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error('저장 실패 ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

/* ── 학교 이름 줄이기 (옥길중학교 → 옥길중) ── */
const shortSchool = (n) => String(n || '').trim().replace(/(초등학교|중학교|고등학교)$/, (m) => m.charAt(0));
/* 학년 줄이기 (중학교 1학년 → 중1) */
function shortGrade(x) {
  const s = String(x || '');
  let m = s.match(/(초등학교|중학교|고등학교)?\s*(\d)\s*학년/);
  if (m) { const lv = m[1] ? m[1].charAt(0) : (/초/.test(s) ? '초' : (/고/.test(s) ? '고' : '중')); return lv + m[2]; }
  m = s.match(/([초중고])\s*(\d)/); return m ? (m[1] + m[2]) : '';
}

/* ── 트랙 재료 ──────────────────────────────────────────────
 * 고2 미적분1: 2026-08-31 이식한 교과서 DB 학습지 15장 (문항 수 = 실제 매칭 수)
 *   순서는 학습 흐름 — 단원별 수준별(개념 다지기) → 중단원평가 → 대단원평가(마무리) */
const MIJEOK1 = [
  { id: 81310703, title: '미적분1 ① 함수의 극한 · 수준별', total: 38 },
  { id: 81310786, title: '미적분1 ② 함수의 연속성 · 수준별', total: 31 },
  { id: 81310838, title: '미적분1 ③ 미분계수와 도함수 · 수준별', total: 31 },
  { id: 81310897, title: '미적분1 ④ 접선의 방정식 · 수준별', total: 23 },
  { id: 81310982, title: '미적분1 ⑤ 함수의 증가와 감소 · 수준별', total: 29 },
  { id: 81311476, title: '미적분1 ① 함수의 극한 · 중단원평가', total: 24 },
  { id: 81311590, title: '미적분1 ② 함수의 연속성 · 중단원평가', total: 21 },
  { id: 81311741, title: '미적분1 ③ 미분계수와 도함수 · 중단원평가', total: 28 },
  { id: 81311844, title: '미적분1 ④ 접선의 방정식 · 중단원평가', total: 6 },
  { id: 81312065, title: '미적분1 ⑤ 함수의 증가와 감소 · 중단원평가', total: 11 },
  { id: 81311062, title: '미적분1 ① 함수의 극한 · 대단원평가', total: 13 },
  { id: 81311117, title: '미적분1 ② 함수의 연속성 · 대단원평가', total: 10 },
  { id: 81311280, title: '미적분1 ③ 미분계수와 도함수 · 대단원평가', total: 9 },
  { id: 81311343, title: '미적분1 ④ 접선의 방정식 · 대단원평가', total: 5 },
  { id: 81311391, title: '미적분1 ⑤ 함수의 증가와 감소 · 대단원평가', total: 6 },
];
/* 학년(2학기 범위)별로 쓸 교재 — 교재 목록(mf_workbook_pdfs)에서 제목으로 찾는다.
 * total은 시중 교재라 전체 문항 수를 알 수 없어 기본값(원장님이 화면에서 수정). */
const BY_GRADE = {
  '중1': [
    { match: '옥길중 1-2 중간고사대비 #1', total: 120 },
    { match: '옥길중 1-2 중간고사대비 #2', total: 120 },
    { match: '시험대비 교과서 변형', total: 60 },
    { match: 'Lumen Brilliance (R) M1-2', total: 80 },
  ],
  '중2': [
    { match: '개념서 - 중등수학2(하)', total: 120 },
    { match: '심화유형서 중등수학2(하)', total: 100 },
    { match: '내신대비(종합편) - 중등수학2(하)', total: 80 },
  ],
  '중3': [
    { match: 'Lumen Brilliance M3-2', total: 93 },
    { match: 'Lumen School Light', total: 80, gradeHint: '중3-2' },
  ],
  '고1': [
    { match: '소명여자고등학교 중간고사 대비', total: 100 },
  ],
};

function gradeKeyOf(s) {
  const g = String(s.grade || '');
  if (/고등학교\s*1|고1/.test(g)) return '고1';
  if (/고등학교\s*2|고2/.test(g)) return '고2';
  if (/고등학교\s*3|고3/.test(g)) return '고3';
  if (/중학교\s*1|중1/.test(g)) return '중1';
  if (/중학교\s*2|중2/.test(g)) return '중2';
  if (/중학교\s*3|중3/.test(g)) return '중3';
  return '초';
}
/* 반의 대표 학년 — 가장 많은 학년 (초등은 시험대비 대상이 아니라 제외) */
function mainGradeOf(list) {
  const c = {};
  list.forEach((s) => { const k = gradeKeyOf(s); if (k !== '초') c[k] = (c[k] || 0) + 1; });
  const ks = Object.keys(c).sort((a, b) => c[b] - c[a]);
  return ks[0] || null;
}
/* 반의 대표 학교 — 가장 많은 학교 (디데이 매칭용) */
function mainSchoolOf(list) {
  const c = {};
  list.forEach((s) => { const n = String(s.school || '').trim(); if (n) c[n] = (c[n] || 0) + 1; });
  const ks = Object.keys(c).sort((a, b) => c[b] - c[a]);
  if (!ks.length) return '';
  const full = ks[0];
  const hit = SCHOOLS.find((sc) => full.replace(/\s/g, '').indexOf(sc) === 0);
  return hit || full;
}

(async () => {
  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다');
  const roster = (await kvGet('or_studentdb')) || [];
  const active = roster.filter((s) => !s.withdrawn);
  const wb = (await kvGet('mf_workbook_pdfs')) || {};
  const books = wb.books || [];
  log(`재원생 ${active.length}명 · 교재 목록 ${books.length}권`);

  const findBook = (m, hint) => books.find((b) => String(b.title || '').replace(/\s+/g, ' ').indexOf(m) >= 0
    && (!hint || String(b.grade || '') === hint));

  /* ★ 트랙 단위 = 「학교 학년」 (2026-09-01 원장 지시 — 시험은 반이 아니라 학교가 친다) */
  const byGrp = {};
  active.forEach((s) => {
    const sc = shortSchool(s.school), gr = shortGrade(s.grade);
    if (!sc || !gr || gr.charAt(0) === '초') return;   // 초등은 시험대비 대상 아님
    const k = sc + ' ' + gr;
    (byGrp[k] = byGrp[k] || []).push(s);
  });

  const prev = (await kvGet('exam_track')) || {};
  // 매쓰플랫 학생ID ↔ 학생코드, 그리고 최근 학습 기록
  const mfs = await sbGet('/mf_students?select=mf_student_id,lumen_rec_code');
  const codeBySid = {}; mfs.forEach((x) => { if (x.lumen_rec_code) codeBySid[x.mf_student_id] = String(x.lumen_rec_code); });
  const grpByCode = {}; active.forEach((s) => {
    const sc = shortSchool(s.school), gr = shortGrade(s.grade);
    grpByCode[String(s.lumen_rec_code)] = (sc && gr) ? (sc + ' ' + gr) : '';
  });
  const recent = await recentBooks(30);
  log(`최근 30일 학습 인스턴스 ${recent.length}건`);
  /* 반별 교재 사용 현황: 몇 명이 · 최고 몇 문항까지 */
  const useByGrp = {};
  recent.forEach((r) => {
    const code = codeBySid[r.sid]; if (!code) return;
    const g = grpByCode[code]; if (!g) return;
    const m = (useByGrp[g] = useByGrp[g] || {});
    const b = (m[r.book] = m[r.book] || { title: r.title, src: r.src, stus: new Set(), max: 0, last: '' });
    b.stus.add(code); if (r.n > b.max) b.max = r.n; if (r.at > b.last) b.last = r.at;
  });

  const tracks = {};
  const notes = [];
  Object.keys(byGrp).sort().forEach((g) => {
    const list = byGrp[g];
    const school = g.split(' ')[0];
    const gk = g.split(' ')[1];
    const items = [];
    const seen = {};
    /* ① 지금 실제로 풀고 있는 교재 — 반의 절반 이상이 쓰는 것 (최대 3권).
     *    이게 있어야 화면을 열자마자 에너지바가 살아 있다. */
    const used = Object.entries(useByGrp[g] || {})
      .map(([id, b]) => ({ id: Number(id), title: b.title, src: b.src, n: b.stus.size, max: b.max, last: b.last }))
      .filter((x) => x.src === '교재' && x.n >= Math.max(2, Math.ceil(list.length / 2)))
      .sort((a, b) => b.n - a.n || b.max - a.max)
      .slice(0, 3);
    used.forEach((x) => {
      seen[x.id] = 1;
      /* 목표 문항 수: 지금 가장 앞선 학생이 푼 양을 기준으로 잡는다(원장님이 화면에서 수정). */
      items.push({ id: x.id, title: x.title, thumb: '', total: Math.max(20, Math.round(x.max * 1.2 / 10) * 10), kind: '진행 중', needCheck: true });
    });
    /* ② 시험대비 전용 자료 — 고2는 어제 이식한 미적분1 15장, 그 외는 학년별 교재 */
    if (gk === '고2') {
      MIJEOK1.forEach((x) => { if (!seen[x.id]) items.push({ id: x.id, title: x.title, thumb: '', total: x.total, kind: '학습지' }); });
    } else {
      (BY_GRADE[gk] || []).forEach((r) => {
        const b = findBook(r.match, r.gradeHint);
        if (!b) { notes.push(`${g}(${gk}): 「${r.match}」 교재를 찾지 못해 건너뜀`); return; }
        if (seen[b.id]) return;
        seen[b.id] = 1;
        items.push({ id: b.id, title: b.title, thumb: b.thumb || '', total: r.total, kind: b.kind || '', needCheck: true });
      });
    }
    if (!items.length) { notes.push(`${g}(${gk}): 배정할 교재가 없습니다`); return; }
    tracks[g] = { school, items };
    log(`\n  ${g} (${gk} · ${school || '학교 미정'} · ${list.length}명) — ${items.length}권 / ${items.reduce((a, b) => a + b.total, 0)}문항`);
    items.forEach((it, i) => log(`      ${i + 1}. ${it.title} — ${it.total}문항${it.kind === '진행 중' ? '  ← 지금 풀고 있는 교재' : ''}${it.needCheck && it.kind !== '진행 중' ? ' (문항수 확인)' : ''}`));
  });

  /* 디데이 — 교육부 나이스(NEIS) 학사일정에서 그대로 (school-info.yml이 매일 수집) */
  let ddays = [];
  if (KEEP_DDAYS && Array.isArray(prev.ddays) && prev.ddays.length) ddays = prev.ddays;
  else {
    const cal = (await kvGet('school_calendar')) || {};
    const mine = {}; active.forEach((s) => { const n = String(s.school || '').trim(); if (n) mine[n] = 1; });
    (cal.schools || []).forEach((sc) => {
      if (!mine[sc.name]) return;
      const nx = sc.next; if (!nx || !nx.from) return;
      const label = (nx.label || nx.name || '시험')
        + (nx.to && nx.to !== nx.from ? ` (${String(nx.from).slice(5)}~${String(nx.to).slice(5)})` : '');
      ddays.push({ school: shortSchool(sc.name), label, date: nx.from });
    });
    ddays.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!ddays.length) log('⚠ 학사일정(school_calendar)이 비어 있어 디데이를 만들지 못했습니다');
  }

  const value = { ddays, tracks, indiv: (prev.indiv || {}), publish: prev.publish !== false, updated: new Date().toISOString() };
  log(`\n디데이 ${ddays.length}개 (나이스 학사일정):`);
  ddays.forEach((d) => log(`  · ${d.school} — ${d.label} ${d.date}`));
  if (notes.length) { log('\n확인이 필요한 것:'); notes.forEach((n) => log('  · ' + n)); }
  if (PLAN) { log('\n--plan: 저장하지 않았습니다'); return; }
  await kvSet('exam_track', value);
  log('\n✅ exam_track 저장 완료 — 학원앱 「시험대비 트랙」에서 확인하세요');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
