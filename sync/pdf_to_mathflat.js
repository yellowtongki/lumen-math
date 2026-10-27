#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * PDF(문항 그림) → 매쓰플랫 학습지  v1  (2026-10-22 원장님 지시)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 수학비서를 거치지 않은 시험지(예: 구매한 모의고사 PDF)를 매쓰플랫 학습지로 만든다.
 * 매쓰플랫에 올리는 어려운 부분(10쪽 제한, 우리 상자 좌표로 1:1 번호, OCR 실패 문항
 * 크게/자리 표시, 정답 주입, 문제은행 복사, 학습지 생성, 마이리스트 담기)은
 * sync/mypaper_to_mathflat.js 를 «그대로» 쓴다. 이 파일은 그 앞단만 바꾼다:
 *   수학비서 문제지 정보·문항 그림  →  아래 「목록 파일」의 정보·문항 그림
 *
 * ── 목록 파일(JSON) ────────────────────────────────────────────────
 *   {
 *     "id": "onda_m3_2026_2fin01",          // 작업 폴더·기록 이름 (영문·숫자·_)
 *     "title": "2026 온다 모의고사 중3-2 기말 01회",   // 매쓰플랫 학습지 제목
 *     "curriculumId": "1",                   // 1=15개정, 2=22개정
 *     "top": "04 중3-2",                     // 대단원 이름 — 「중N-M」 또는 고등 과목명
 *     "mylist": "모의고사",                   // 매쓰플랫 마이리스트 폴더 (없으면 「수학비서」)
 *     "assign": ["I2103268"],                // (선택) 만들면서 바로 배정할 매쓰플랫 학생 id
 *     "items": [ { "no": 1, "file": "/abs/q01.png", "answer": ["3"], "type": "single_choice" }, … ]
 *   }
 *   type: single_choice · multiple_choice · short_answer · latex_answer (수학비서와 같은 이름)
 *
 * ── 사용법 ────────────────────────────────────────────────────────
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/pdf_to_mathflat.js 목록.json [--dry]
 *   --dry   PDF 조립·쪽 수 계획만 보여 주고 매쓰플랫에는 접속하지 않음
 *
 * 문항 그림은 저작권 때문에 저장소에 올리지 않는다(작업 폴더 sync/_debug 는 커밋 제외).
 * 만든 결과는 lumen_store 의 pdf_mf_state 에 남긴다(같은 id 를 두 번 올리지 않게).
 * 계정: MATHFLAT_ID/PASSWORD · 저장: SUPABASE_URL, SUPABASE_SERVICE_KEY (환경변수만)
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const SRC = path.join(__dirname, 'mypaper_to_mathflat.js');
let code = fs.readFileSync(SRC, 'utf8');
/* 원래 파일의 «바로 실행» 부분만 떼어 내고, 같은 모듈 안에서 수학비서 함수를 바꿔 끼운다 */
code = code.replace(/\nif \(require\.main === module\)[\s\S]*$/, '\n');
/* 2026-10-24 원장님 지시 — 목록 파일에 "assign" 이 있으면 만들면서 바로 그 학생들에게 배정한다.
 * (매쓰플랫은 학습지를 «만들 때» assignStudentIdList 로 넣어야 배정된다 — exam_twin_pipeline.js 와 같음)
 * 원래 수학비서 → 매쓰플랫 길(mypaper_to_mathflat.js)은 그대로 «배정 없음»이다. */
const nAssign = (code.match(/assignStudentIdList: \[\]/g) || []).length;
if (nAssign < 2) throw new Error('mypaper_to_mathflat.js 의 학습지 만들기 부분이 바뀌었습니다 — 배정 자리를 찾지 못했습니다');
code = code.replace(/assignStudentIdList: \[\]/g, 'assignStudentIdList: __ASSIGN');
code += '\nvar __ASSIGN = [];\n';   /* 맨 앞(#! 줄)에 넣으면 문법 오류 — 뒤에 var 로 둔다 */
code += `
module.exports.__runManifest = async function (man, dry) {
  const ID = String(man.id);
  __ASSIGN = (man.assign || []).map(String);
  if (__ASSIGN.length) log('배정할 학생 ' + __ASSIGN.length + '명 (매쓰플랫 학생 id)');
  /* 수학비서 대신 목록 파일에서 읽는다 */
  msGet = async () => ({ data: { title: man.title, questionCount: man.items.length } });
  msCells = async () => man.items.map((it) => ({
    questionNumber: it.no,
    imagePath: 'file://' + it.file,
    answers: (Array.isArray(it.answer) ? it.answer : [it.answer]).map((a) => ({ answer: [String(a)], type: it.type || 'short_answer' })),
    chapters: [{ curriculumId: String(man.curriculumId || '1'), chapter: [man.top] }],
  }));
  /* 그림은 미리 작업 폴더에 넣어 둔다 → runPaper 가 내려받지 않고 그대로 쓴다 */
  const imgDir = path.join(OUT_DIR, ID, 'img');
  fs.mkdirSync(imgDir, { recursive: true });
  for (const it of man.items) fs.copyFileSync(it.file, path.join(imgDir, String(it.no).padStart(3, '0') + '.img'));
  if (!dry) { await mfLogin(); log('매쓰플랫 로그인 OK'); }
  const r = await runPaper(ID, { dry: !!dry, mylist: man.mylist || '수학비서', placeholder: true, splitWorksheets: false, hint: null });
  if (!dry) {
    const st = (await kvGet('pdf_mf_state')) || { processed: {} };
    st.processed = st.processed || {};
    st.processed[ID] = { at: new Date().toISOString(), title: r.title, n: r.n, worksheetIds: r.worksheetIds, paperIds: r.paperIds,
      parts: (r.parts || []).map((x) => ({ title: x.title, n: x.n, worksheetId: x.worksheetId, withAnswer: x.withAnswer, autoScored: x.autoScored })),
      ...(__ASSIGN.length ? { assigned: __ASSIGN } : {}),
      ...(r.placeholders && r.placeholders.length ? { placeholders: r.placeholders } : {}) };
    await kvSet('pdf_mf_state', st);
  }
  return r;
};
`;
const m = new Module(SRC, module);
m.filename = SRC;
m.paths = Module._nodeModulePaths(__dirname);
m._compile(code, SRC);

(async () => {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error('사용법: node sync/pdf_to_mathflat.js 목록.json [--dry]'); process.exit(1); }
  const man = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!/^[A-Za-z0-9_-]+$/.test(String(man.id || ''))) throw new Error('목록 파일의 id 는 영문·숫자·_ 만 씁니다');
  const r = await m.exports.__runManifest(man, args.includes('--dry'));
  console.log('\n═══ 결과 ═══');
  if (r.dry) { (r.parts || []).forEach((x) => console.log(`· 「${x.title}」 ${x.n}문항 ${x.pages}쪽 (미리보기)`)); return; }
  (r.parts || []).forEach((x) => console.log(`· 학습지 ${x.worksheetId} 「${x.title}」 문항 ${x.problemCount}/${x.n} · 번호순서 ${x.orderOk ? '일치' : '불일치'} · 정답 ${x.withAnswer} · 자동채점 ${x.autoScored}`
    + (x.blankNos && x.blankNos.length ? ` · ⚠ 정답 빈 문항 ${x.blankNos.join(',')}` : '')));
  console.log(`마이리스트 담김: ${r.filed && r.filed.ok ? '예' : '아니오'}`);
  if (r.placeholders && r.placeholders.length) console.log(`⚠ 자리 표시 문항: ${r.placeholders.map((c) => c.no + '번').join(', ')}`);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
