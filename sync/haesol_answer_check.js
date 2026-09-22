#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🔍 해설집 정답 대조기 — 수학비서 기출 DB(원본)와 맞춰 본다
 * ═══════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가 (원장 지시 2026-09-21)
 *   루멘 기출 정밀해설집은 우리가 직접 풀어서 만든 것이라 <b>답이 틀릴 수 있다</b>.
 *   수학비서(mathsecr) 「나만의 DB」의 기출 시험지가 <b>원본</b>이므로, 해설집 정답을
 *   그것과 하나씩 맞춰 본다. 어긋나는 문항만 골라서 보여 준다.
 *
 * 무엇도 저장하지 않는다 — 읽고 견주기만 한다.
 *
 * 사용법
 *   # ① 먼저 수학비서에서 그 학교 기출을 받아 둔다 (sync/_debug/ 에 저장된다)
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/mathsecr_exam_collector.js --school 옥길중
 *
 *   # ② 대조
 *   node sync/haesol_answer_check.js --code okgil_m1_2024_2mid --school 옥길중
 *   node sync/haesol_answer_check.js --all --school 옥길중      # 그 학교 해설집 전부
 *
 * 짝 찾는 법
 *   해설집 키   haesol_body_<코드>  (코드 예: okgil_m1_2024_2mid)
 *   해설집 메타 lumen_haesol_catalog 의 items[] — code · school · grade · term · n
 *   수학비서    sync/_debug/ms_exams_<학교>.json — title 에 연도·학년·학기·중간/기말
 *   → 연도 + 학년 + 학기 + 중간/기말 이 모두 같은 시험지를 짝으로 삼는다.
 *
 * 나오는 것
 *   문항별 「수학비서 | 해설집 | 난도 | 유형」 표와, 맨 끝에 어긋난 문항 목록.
 *   서술형은 기호로 견줄 수 없어 — 로 표시하고 세지 않는다.
 *
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY (읽기만)
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const CODE = arg('code', null);
const SCHOOL = arg('school', null);
const ALL = args.includes('--all');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: KEY, authorization: 'Bearer ' + KEY });
const log = (...a) => console.log(...a);

async function kvGet(k) {
  const r = await fetch(`${SB}/rest/v1/lumen_store?key=eq.${encodeURIComponent(k)}&select=value`, { headers: sbH() });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j[0]) return null;
  return typeof j[0].value === 'string' ? JSON.parse(j[0].value) : j[0].value;
}

/* 해설집 코드에서 연도·학년·학기·중간기말을 뽑는다 — 예: okgil_m1_2024_2mid */
function parseCode(code) {
  const m = String(code || '').match(/^([a-z]+)_([mh])(\d)_(20\d\d)_(\d)(mid|fin)$/);
  if (!m) return null;
  return { school: m[1], band: m[2] === 'm' ? '중' : '고', grade: Number(m[3]),
           year: m[4], semester: m[5], term: m[6] === 'mid' ? '중간' : '기말' };
}

/* 수학비서 제목에서 같은 것들을 뽑는다
 * 예: "내신 2024년 경기 부천시 옥길중 중1공통 2학기중간 중등수학1하" */
function parseMsTitle(t) {
  const s = String(t || '');
  const year = (s.match(/(20\d\d)\s*년/) || [])[1] || '';
  const g = s.match(/([중고])\s*(\d)/);
  const sem = (s.match(/(\d)\s*학기/) || [])[1] || '';
  const term = /중간/.test(s) ? '중간' : (/기말/.test(s) ? '기말' : '');
  return { year, band: g ? g[1] : '', grade: g ? Number(g[2]) : 0, semester: sem, term };
}

const CIR = /[①②③④⑤]/;
function circled(x) { const m = String(x == null ? '' : x).match(/[①②③④⑤]/); return m ? m[0] : ''; }

function compare(hs, ms) {
  const byNo = {};
  (ms.cells || []).forEach((c) => { byNo[c.no] = c; });
  let ok = 0; const bad = []; const skip = [];
  log('');
  log(`  번호 │ 수학비서 │ 해설집 │ 난도 │ 수학비서가 말하는 유형`);
  log(`  ─────┼──────────┼────────┼──────┼──────────────────────────────`);
  (hs.qs || []).forEach((q) => {
    const c = byNo[q.no];
    if (!c) { skip.push(q.no); log(`  ${String(q.no).padStart(4)} │ (없음)   │ ${circled(q.ans) || '서술'}      │      │`); return; }
    const a = circled(c.answer), b = circled(q.ans);
    const cmp = (a && b) ? (a === b) : null;
    if (cmp === true) ok++; else if (cmp === false) bad.push(q.no); else skip.push(q.no);
    const kind = (c.chapters || []).slice(-1)[0] || '';
    log(`  ${String(q.no).padStart(4)} │    ${(a || '서술').padEnd(5)} │   ${(b || '서술').padEnd(4)} │  ${String(c.difficulty || '-').padStart(2)}  │ ${cmp === false ? '❌ ' : ''}${kind}`);
  });
  log('');
  log(`  객관식 일치 ${ok}개 · 어긋남 ${bad.length}개${bad.length ? ' → ' + bad.join(', ') + '번' : ''} · 서술형·대조불가 ${skip.length}개`);
  if (bad.length) {
    log('');
    log('  ⚠️ 어긋난 문항은 <b>수학비서 쪽이 원본</b>입니다. 해설집을 고쳐야 합니다.');
    bad.forEach((no) => {
      const q = (hs.qs || []).find((x) => x.no === no);
      const c = byNo[no];
      log(`     ${no}번 — 해설집 ${circled(q.ans)} → 원본 ${circled(c.answer)}` +
          (q.warn ? '  (해설집에 「정답 오류?」로 이미 표시돼 있던 문항)' : ''));
      log(`        해설집 제목: ${String(q.title || '').slice(0, 60)}`);
      log(`        원본 유형  : ${(c.chapters || []).slice(-1)[0] || ''}`);
    });
  }
  return { ok, bad, skip };
}

(async () => {
  if (!SB || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 환경변수가 없습니다');
  if (!CODE && !ALL) throw new Error('--code <해설집코드> 또는 --all 을 지정하세요');
  if (!SCHOOL) throw new Error('--school <학교> 를 지정하세요 (수학비서 수집 파일을 찾는 데 씁니다)');

  const msFile = path.join(__dirname, '_debug', `ms_exams_${SCHOOL}.json`);
  if (!fs.existsSync(msFile)) {
    throw new Error(`수학비서 수집 파일이 없습니다: ${msFile}\n` +
      `  먼저 실행하세요: node sync/mathsecr_exam_collector.js --school ${SCHOOL}`);
  }
  const msAll = JSON.parse(fs.readFileSync(msFile, 'utf8'));
  log(`수학비서 기출 ${msAll.length}개 읽음 (${SCHOOL})`);

  const cat = await kvGet('lumen_haesol_catalog');
  const items = (cat && cat.items) || [];
  const targets = CODE ? items.filter((x) => x.code === CODE) : items;
  if (!targets.length) throw new Error(`해설집을 못 찾았습니다: ${CODE || '(전체)'}`);

  let totBad = 0, done = 0;
  for (const hs of targets) {
    const p = parseCode(hs.code);
    if (!p) { log(`\n⏭  ${hs.code} — 코드 모양을 못 읽어 건너뜁니다`); continue; }
    /* ⚠️ 학교를 꼭 본다 — 안 보면 범박중 해설집이 옥길중 시험지와 짝지어진다 (2026-09-21에 실제로 그랬다).
     * 해설집 메타의 school(예 「범박중학교」)에서 「학교/중/고」를 떼고 수학비서 제목에 들어 있는지 본다. */
    const hsSchool = String(hs.school || '').replace(/(초등학교|중학교|고등학교|학교)$/, '');
    const ms = msAll.find((m) => {
      const t = parseMsTitle(m.title);
      if (hsSchool && String(m.title || '').indexOf(hsSchool) < 0) return false;
      return t.year === p.year && t.band === p.band && t.grade === p.grade
          && t.semester === p.semester && t.term === p.term;
    });
    log('');
    log('═'.repeat(64));
    log(`📘 해설집 : ${hs.title || hs.code}  (${(hs.qs || []).length}문항)`);
    if (!ms) {
      log(`❌ 수학비서에 같은 시험지가 없습니다 — ${hsSchool || p.school} ${p.year}년 ${p.band}${p.grade} ${p.semester}학기 ${p.term}`);
      if (hsSchool && SCHOOL && hsSchool.indexOf(SCHOOL.replace(/(중|고)$/, '')) < 0)
        log(`   (이 해설집은 「${hsSchool}」 것입니다 — node sync/mathsecr_exam_collector.js --school ${hsSchool} 로 따로 받으세요)`);
      continue;
    }
    log(`📗 원본   : ${ms.title}  (${(ms.cells || []).length}문항)`);
    const r = compare(hs, ms);
    totBad += r.bad.length; done++;
  }
  log('');
  log('═'.repeat(64));
  log(`대조 끝 — 해설집 ${done}권 · 어긋난 문항 모두 ${totBad}개`);
  log('저장한 것은 없습니다 (읽기 전용).');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
