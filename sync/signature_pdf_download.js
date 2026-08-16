#!/usr/bin/env node
/**
 * 시그니처 교재 PDF 내려받기
 *
 * 매쓰플랫 「수업 준비 → 교재 → 시그니처 교재」에서 학원이 주문·제작한 교재의
 * PDF를 내려받는다. 교재 목록 API가 PDF 주소를 그대로 주기 때문에
 * 브라우저 없이 받을 수 있다.
 *
 *   GET /workbook?type=CUSTOM_SIGNATURE&size=500   ← 학원 자체 제작(주문) 교재
 *   GET /workbook?type=SIGNATURE&size=500          ← 매쓰플랫 기본 시그니처 교재
 *
 * 각 교재 항목의 PDF 주소 필드:
 *   pdfUrl              문제(본책)          ← 보통 이것만 있으면 된다
 *   answerPdfUrl        정답
 *   solutionPdfUrl      해설
 *   defaultPdfUrl       표지 적용 전 기본본
 *   defaultAnswerPdfUrl 기본본 정답
 *
 * 사용법:
 *   node sync/signature_pdf_download.js --list                 목록만 보기(내려받지 않음)
 *   node sync/signature_pdf_download.js --ordered              주문한 교재만 받기(기본)
 *   node sync/signature_pdf_download.js --year 2025            그 해에 주문한 것만
 *   node sync/signature_pdf_download.js --id 10748021,10746574 특정 교재만
 *   node sync/signature_pdf_download.js --all                  주문 여부 상관없이 전부(273권, 매우 큼)
 *   옵션: --kinds pdf,answer,solution (기본 pdf) · --out <폴더>
 *
 * 주의: 내려받은 PDF는 매쓰플랫에서 구입한 상용 교재다.
 *       저장소에 커밋하지 말 것 (기본 저장 위치 sync/_debug/ 는 .gitignore 처리됨).
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.mathflat.com';
const BASE = 'https://teacher.mathflat.com';
const ID = process.env.MATHFLAT_ID, PW = process.env.MATHFLAT_PASSWORD;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const LIST_ONLY = has('--list');
const ALL = has('--all');
const YEAR = opt('--year', null);
const IDS = (opt('--id', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const KINDS = (opt('--kinds', 'pdf') || 'pdf').split(',').map(s => s.trim().toLowerCase());
const OUT_DIR = opt('--out', path.join(__dirname, '_debug', 'signature_pdf'));

const KIND_FIELD = {
  pdf: ['pdfUrl', '문제'],
  answer: ['answerPdfUrl', '정답'],
  solution: ['solutionPdfUrl', '해설'],
  default: ['defaultPdfUrl', '기본본'],
  defaultanswer: ['defaultAnswerPdfUrl', '기본본정답'],
};

let TOKEN = null;
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const H = () => ({
  'content-type': 'application/json', accept: 'application/json, text/plain, */*',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  authorization: `Bearer ${TOKEN}`, 'x-auth-token': TOKEN,
  origin: BASE, referer: BASE + '/',
});

async function login() {
  if (!ID || !PW) throw new Error('환경변수 MATHFLAT_ID / MATHFLAT_PASSWORD 가 필요합니다');
  const r = await fetch(`${API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: BASE, referer: BASE + '/' },
    body: JSON.stringify({ id: ID.trim(), password: PW.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error(`로그인 실패: ${j.code || r.status}`);
  TOKEN = j.accessToken;
  return j.academyId;
}

async function listWorkbooks(type) {
  const r = await fetch(`${API}/workbook?type=${type}&size=500`, { headers: H() });
  if (!r.ok) { log(`목록 실패 ${type}: ${r.status}`); return []; }
  const j = await r.json();
  const d = j.data !== undefined ? j.data : j;
  return Array.isArray(d) ? d : (d.content || []);
}

/* 파일 이름에 쓸 수 없는 글자 정리 */
const safe = (s) => String(s || '')
  .replace(/[\/\\?%*:|"<>]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 90);

/* 같은 이름의 교재가 여러 권 있다(예: 「Lumen Glow」가 중1-1·중1-2 두 권).
 * 학년을 붙여 구분하지 않으면 한 파일이 다른 교재를 덮어쓰거나 건너뛰어진다. */
const SCHOOL = { ELEMENTARY: '초', MIDDLE: '중', HIGH: '고' };
function gradeTag(w) {
  const s = SCHOOL[w.schoolType] || w.schoolType || '';
  if (!s) return '';
  const g = w.grade != null ? w.grade : '';
  const sem = w.semester != null ? `-${w.semester}` : '';
  return `(${s}${g}${sem})`;
}
function fileBase(w) {
  const title = safe(w.fulltitle || w.title);
  const tag = gradeTag(w);
  // 제목에 이미 학년 표기(M1-2 등)가 있어도, 서로 다른 교재가 겹치지 않도록 항상 붙인다
  return tag ? `${title} ${tag}` : title;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.slice(0, 4).toString() !== '%PDF') throw new Error('PDF가 아님(주소 만료 가능)');
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const MB = (n) => (n / 1048576).toFixed(1) + 'MB';

(async () => {
  const academy = await login();
  log(`로그인 성공 · 학원 ${academy}`);

  const custom = await listWorkbooks('CUSTOM_SIGNATURE');
  const stock = await listWorkbooks('SIGNATURE');
  log(`시그니처 교재: 자체제작 ${custom.length}권 · 매쓰플랫 기본 ${stock.length}권`);

  // ── 대상 고르기 ──
  let targets;
  if (IDS.length) {
    const pool = [...custom, ...stock];
    targets = pool.filter(w => IDS.includes(String(w.id)));
  } else if (ALL) {
    targets = custom;
  } else {
    // 기본: 실제로 주문(구입)한 교재
    targets = custom.filter(w => w.orderDatetime);
    if (YEAR) targets = targets.filter(w => String(w.orderDatetime).startsWith(YEAR));
  }
  targets.sort((a, b) => String(b.orderDatetime || '').localeCompare(String(a.orderDatetime || '')));

  // ── 목록 출력 ──
  console.log(`\n대상 ${targets.length}권${YEAR ? ` (${YEAR}년 주문분)` : ''}\n`);
  console.log('  주문일        쪽수   교재명                                          받을 수 있는 것');
  console.log('  ' + '─'.repeat(96));
  targets.forEach(w => {
    const kinds = Object.entries(KIND_FIELD)
      .filter(([, [f]]) => w[f]).map(([, [, label]]) => label).join(', ');
    console.log(`  ${String(w.orderDatetime || '-').slice(0, 10).padEnd(12)} ${String(w.page || '-').padStart(4)}쪽  ${safe(w.fulltitle || w.title).padEnd(46)} ${kinds}`);
  });

  if (LIST_ONLY) { console.log('\n(--list 이므로 내려받지 않았습니다)'); return; }

  // ── 내려받기 ──
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n저장 위치: ${OUT_DIR}\n`);
  let ok = 0, fail = 0, bytes = 0;
  const index = [];

  for (const w of targets) {
    const title = fileBase(w);
    for (const k of KINDS) {
      const spec = KIND_FIELD[k];
      if (!spec) { log(`알 수 없는 종류: ${k}`); continue; }
      const [field, label] = spec;
      const url = w[field];
      if (!url) continue;
      const suffix = k === 'pdf' ? '' : `_${label}`;
      const name = `${title}${suffix}.pdf`;
      const dest = path.join(OUT_DIR, name);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        log(`건너뜀(이미 있음) ${name}`);
        index.push({ id: w.id, title, kind: label, file: name, size: fs.statSync(dest).size });
        ok++; continue;
      }
      try {
        const n = await download(url, dest);
        bytes += n; ok++;
        index.push({ id: w.id, title, kind: label, file: name, size: n, orderDatetime: w.orderDatetime, page: w.page });
        log(`받음 ${name} (${MB(n)})`);
      } catch (e) {
        fail++;
        log(`실패 ${name} — ${e.message}`);
      }
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, '_목록.json'), JSON.stringify(index, null, 1));
  console.log(`\n완료: ${ok}개 성공 · ${fail}개 실패 · 합계 ${MB(bytes)}`);
  console.log(`목록 파일: ${path.join(OUT_DIR, '_목록.json')}`);
})().catch(e => { console.error('오류:', e.message); process.exit(1); });
