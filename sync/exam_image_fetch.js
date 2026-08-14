#!/usr/bin/env node
/* 수학비서 문항 이미지 내려받기
 *
 * 문항 이미지는 구글 클라우드 CDN(cdn.mathsecr.com)의 서명 쿠키로 보호된다.
 *   /bms/api/v1/mydbs/{id}/cells 를 호출하면 응답 헤더에
 *   Set-Cookie: Cloud-CDN-Cookie=...; Path=/data/private/Cells/ 가 실려 온다.
 *   이 쿠키를 붙이면 이미지가 다운로드된다(쿠키는 약 78분 유효).
 *
 * 이 스크립트는 수집된 ms_exams_*.json의 문항 이미지들을 내려받아
 *   sync/_debug/exam_images/<md5>.png 로 저장하고,
 *   원본 imagePath → 로컬 파일 경로 매핑을 ms_exam_images_map.json 에 남긴다.
 *
 * ⚠️ 내려받은 이미지는 sync/_debug(=.gitignore)에만 둔다. 저장소에 직접 커밋하지 않는다.
 *    보고서에 넣을 때는 exam_report_gen.js가 base64로 인라인한다(--embed).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const IMG_DIR = path.join(__dirname, '_debug', 'exam_images');

const args = process.argv.slice(2);
function arg(n, d) { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; }
const DATA = arg('data');
if (!DATA) { console.error('--data sync/_debug/ms_exams_*.json 필요'); process.exit(1); }

function log(m) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`); }

let TOKEN = null;
async function login() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json();
  TOKEN = j.data.accessToken;
}
const H = () => ({ accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${TOKEN}` });

// 시험지 id로 cells를 호출해 CDN 서명 쿠키를 받아온다
async function cookieFor(examId) {
  const r = await fetch(`${MS_API}/bms/api/v1/mydbs/${examId}/cells?curriculumId=2&limit=1`, { headers: H() });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  const cdn = sc.find(c => /Cloud-CDN-Cookie/.test(c));
  return cdn ? cdn.split(';')[0] : null;
}

(async () => {
  const all = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  fs.mkdirSync(IMG_DIR, { recursive: true });
  await login();
  log('로그인 OK');

  const mapFile = path.join(__dirname, '_debug', 'ms_exam_images_map.json');
  const map = fs.existsSync(mapFile) ? JSON.parse(fs.readFileSync(mapFile, 'utf8')) : {};
  let ok = 0, skip = 0, fail = 0;

  for (const ex of all) {
    const imgs = ex.cells.filter(c => c.img).map(c => c.img);
    if (!imgs.length) continue;
    let ck = await cookieFor(ex.id);
    if (!ck) { log(`⚠️ [${ex.id}] 쿠키 없음`); continue; }
    for (const url of imgs) {
      if (map[url] && fs.existsSync(path.join(IMG_DIR, map[url]))) { skip++; continue; }
      try {
        const r = await fetch(url, { headers: { cookie: ck, referer: MS_ORIGIN + '/' } });
        if (!r.ok) { fail++; continue; }
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 200) { fail++; continue; }
        const ext = (r.headers.get('content-type') || '').includes('webp') ? 'webp' : 'png';
        const name = crypto.createHash('md5').update(url).digest('hex') + '.' + ext;
        fs.writeFileSync(path.join(IMG_DIR, name), buf);
        map[url] = name; ok++;
      } catch (e) { fail++; }
    }
    log(`[${ex.id}] ${ex.title.slice(0, 30)} — 받음 ${imgs.length}개`);
  }
  fs.writeFileSync(mapFile, JSON.stringify(map, null, 1));
  log(`완료: 신규 ${ok} · 기존 ${skip} · 실패 ${fail} → ${mapFile}`);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
