#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🗂 루멘 문제 DB ② 문항 상자 찾기 — 책 PDF 쪽 → 매쓰플랫 AI 문항 인식 → 상자 좌표
 *
 * 원장 결정 2026-10-27: 문항 경계는 매쓰플랫 AI(적중 분석과 같은 document-processing-flow)로 찾고,
 *   그림·목록은 맥미니에 둔다. 매쓰플랫에는 «고른 쪽만» 올라가고, 매쓰플랫 학습자료로 등록하지 않는다.
 *   (analysis-flow 는 --match 를 줄 때만 — 상자마다 매쓰플랫 유형 번호를 받아 번호 맞추기 검산에 쓴다)
 * 서버(Supabase)에 아무것도 쓰지 않는다. 환경변수: MATHFLAT_ID, MATHFLAT_PASSWORD · 부품: pdf-lib (npm install)
 *
 * 쓰는 법
 *   node sync/bank_detect.js 책.pdf --pdf-pages 85-105 --out boxes.json [--match 1.4.4146]
 *   --pdf-pages 는 «PDF 파일의 쪽 번호»(1부터). 책에 찍힌 쪽 번호와 다를 수 있다 — bank_build.py 가 맞춘다
 * 결과 boxes.json
 *   { pdf, pages:[{ pdf_page, w, h, boxes:[{ x, y, w, h, cid?, level? }] }] }   좌표는 쪽 크기에 대한 비율(0~1)
 * ═══════════════════════════════════════════════════════════════════ */
/* sync/.env.local 이 있으면 읽는다 (맥미니용 · 깃에 안 올라감 — MATHFLAT_ID=… 한 줄씩) */
(function loadLocalEnv() {
  try {
    const p = require('path').join(__dirname, '.env.local');
    if (!require('fs').existsSync(p)) return;
    require('fs').readFileSync(p, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) {}
})();
const fs = require('fs');
const T = require('./exam_twin_pipeline.js');
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
T.setLog(log);
const CHUNK = 10;   // 매쓰플랫 문서 인식은 한 번에 10쪽까지 (exam_hit_worker.js 2026-10-11)

/* PNG·JPEG 머리에서 가로·세로만 읽는다 (그림 전체를 풀지 않는다) */
function imgSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1], len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
    const f = b.slice(12, 16).toString();
    if (f === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (f === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
    if (f === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  throw new Error('쪽 그림 크기를 읽지 못했습니다');
}

async function recognize(bytes, n, trie) {
  const jobId = await T.saiJob();
  const { data: pres } = await T.mf(T.MF_SAI, 'POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes });
  if (!up.ok) throw new Error(`PDF 업로드 실패 ${up.status}`);
  await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageIndexes: `1~${n}`, pageImageQuality: 'HIGH' } });
  const doc = await T.saiPoll(jobId, 300000);
  let src = null;
  if (trie) {
    await T.mf(T.MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
      functionName: '/matchers/analysis-flow',
      parameters: { pageImageUrls: doc.pageImageUrls, boxesOnEachPage: doc.boxesOnEachPage, trieKey: trie } });
    src = (await T.saiPoll(jobId, 420000)).sourceData || [];
  }
  const pages = []; let t = 0;
  for (let i = 0; i < doc.pageImageUrls.length; i++) {
    const r = await fetch(doc.pageImageUrls[i]);
    const { w, h } = imgSize(Buffer.from(await r.arrayBuffer()));
    const boxes = (doc.boxesOnEachPage[i] || []).map(([x, y, bw, bh]) => {
      const s = src ? (src[t] || {}) : {}; t++;
      const b = { x: +(x / w).toFixed(5), y: +(y / h).toFixed(5), w: +(bw / w).toFixed(5), h: +(bh / h).toFixed(5) };
      if (s.conceptId) b.cid = s.conceptId;
      if (s.level) b.level = s.level;
      return b;
    });
    pages.push({ w, h, boxes });
  }
  return pages;
}

(async () => {
  const pdfPath = argv.find((a) => /\.pdf$/i.test(a));
  const out = val('--out', '');
  const [a, b] = val('--pdf-pages', '').split('-').map(Number);
  if (!pdfPath || !out || !a) { console.error('사용법: node sync/bank_detect.js 책.pdf --pdf-pages 85-105 --out boxes.json'); process.exit(1); }
  const { PDFDocument } = require('pdf-lib');
  const src = await PDFDocument.load(fs.readFileSync(pdfPath), { ignoreEncryption: true });
  const last = Math.min(b || a, src.getPageCount());
  await T.mfLogin();
  const result = { pdf: require('path').basename(pdfPath), made: new Date().toISOString(), pages: [] };
  for (let s = a; s <= last; s += CHUNK) {
    const e = Math.min(last, s + CHUNK - 1);
    const part = await PDFDocument.create();
    const idx = []; for (let i = s; i <= e; i++) idx.push(i - 1);
    (await part.copyPages(src, idx)).forEach((pg) => part.addPage(pg));
    const bytes = Buffer.from(await part.save());
    log(`인식 ${s}~${e}쪽 (${(bytes.length / 1e6).toFixed(1)}MB)`);
    const pages = await recognize(bytes, idx.length, val('--match', ''));
    pages.forEach((p, k) => { result.pages.push({ pdf_page: s + k, ...p }); log(`  ${s + k}쪽: 상자 ${p.boxes.length}개`); });
    fs.writeFileSync(out, JSON.stringify(result, null, 1));   // 중간에 끊겨도 받은 데까지 남긴다
  }
  log(`끝 → ${out} · ${result.pages.length}쪽 · 상자 ${result.pages.reduce((n, p) => n + p.boxes.length, 0)}개`);
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
