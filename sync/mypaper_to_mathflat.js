#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 수학비서 「내 문제지」 → 매쓰플랫 학습지  v1  (2026-09-13 원장님 지시)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 수학비서에서 만든 교사용 프린트(내 문제지)를 매쓰플랫 학습지로 그대로
 * 옮긴다. 번호는 1:1 그대로, 수학비서에 적힌 정답까지 넣어 준다.
 * 만든 학습지는 매쓰플랫 마이리스트(폴더) 「수학비서」에 담는다.
 *
 *   ★ 학생 배정은 하지 않는다. 원장님이 매쓰플랫에서 직접 배정하신다.
 *
 * ── 하는 일 순서 ──────────────────────────────────────────────────
 *   ① 수학비서 로그인 → 「매쓰플랫 올리기」 폴더의 문제지 목록
 *   ② 문제지마다 문항(cells) + 문항 이미지 내려받기 (CDN 서명 쿠키)
 *   ③ A4 2단 PDF 조립 — 문항마다 번호를 찍고 «상자 좌표»를 기록해 둔다
 *   ④ 매쓰플랫 업로드 → document-processing-flow (쪽 이미지 만들기)
 *   ⑤ analysis-flow 를 «우리 상자 좌표»로 돌린다
 *      (매쓰플랫 AI가 상자를 다시 찾게 두면 문항이 붙거나 갈라져 번호가 어긋난다.
 *       우리가 만든 PDF이므로 좌표를 이미 알고 있다 — 그래서 1:1이 보장된다)
 *   ⑥ POST /v2/papers/by-custom → 「기타 학습자료(나의 DB)」 원본 등록
 *   ⑦ OCR 끝날 때까지 대기 → 수학비서 정답 주입 → 다시 대기
 *   ⑧ copy-to-problem (문제은행으로 복사) 전량 COPIED 대기
 *   ⑨ 학습지 생성 (번호 순서 그대로) → 마이리스트 「수학비서」에 담기
 *   ⑩ 만든 학습지를 다시 읽어 문항 수·정답 수·자동채점 수를 확인
 *
 * ── 함정 (전부 실측으로 얻은 것) ──────────────────────────────────
 *  【10쪽】 document-processing-flow 는 한 job 에 «10쪽»까지만 받는다.
 *     넘으면 작업이 FAILED. 그래서 쪽 수를 세어 보고 넘치면 이미지를 85%로
 *     줄여 다시 맞춰 보고, 그래도 넘치면 150문항 이하로 나눠 학습지 여러 장을
 *     만든다. 나눈 장은 매쓰플랫 번호가 1부터 다시 시작하므로 제목에 원래
 *     번호 범위(「1~150」「151~193」)를 반드시 남긴다.
 *
 *  【복사 재요청】 copy-to-problem 은 요청해도 일부가 COPY_IN_PROGRESS 로
 *     남아 영영 끝나지 않는 일이 있다. 2분 넘게 그대로면 «남은 것만» 다시
 *     요청해야 움직인다. 전량 COPIED 전에 학습지를 만들면
 *     LAMBDA_INVOKE_EXCEPTION 이 난다.
 *
 *  【contentDataKey】 정답 주입(POST /my-db-problems/versions)의
 *     contentDataKey 에는 «그 문항의 원래 ocrRawDataUrl 에서 호스트만 뗀 키»를
 *     넣어야 한다. nextVersionContentDataUploadUrl 로 새 JSON 을 올려서 그 키를
 *     쓰면 매쓰플랫이 editorData 형식으로 읽으려 해서 문제 본문이 깨져 보인다.
 *
 *  【정답 변환】 수학비서 정답이 늘 숫자는 아니다. 객관식은 "4"·"3,5" 로,
 *     주관식 숫자는 그대로, \frac{a}{b} 는 "a/b" 로 바꾸고, 무한대·구간·문장
 *     같은 수식형은 원문 그대로 넣는다. 1차 실측(미적1 150문항)에서 20개(13%)가
 *     이 «원문 그대로» 쪽이었고, 이런 문항은 정답은 보이지만 자동채점은 안 된다
 *     (autoScoredType=IMPOSSIBLE). 자동채점이 되는 것은 사실상 객관식뿐이다.
 *     문제지에 따라 이 비율이 25%까지 올라간다 — 정상이며, 오류가 아니다.
 *
 *  【OCR 실패 문항】 글자를 못 읽은 문항(processingStatus=FAILED)은 contentDataKey 가
 *     없다. 이걸 50개 묶음에 섞어 보내면 «묶음 전체»가 500 으로 죽는다. 빼고 보내고,
 *     그래도 묶음이 실패하면 하나씩 다시 보낸다. 못 넣은 문항은 정답만 빈 채로
 *     학습지에는 그대로 들어간다.
 *
 *  【OCR 실패 = 학습지 자체가 안 만들어진다】 더 나쁜 것은 그 다음이다. OCR 이 실패한
 *     문항은 매쓰플랫이 «문항 이미지»도 만들지 못해, copy-to-problem 이 그 묶음 전체를
 *     MYDB_PROBLEM_IMAGE_NOT_COMPLETED 로 거절한다 — 108문항 중 2개 때문에 한 장이
 *     통째로 못 만들어진다(2026-09-13 「[비상] 중등수학 1-2 중간 (위치,작도)」 78·89번).
 *     그래서 «같은 PDF 를 그대로 한 번 더» 올리는 재시도는 쓸모가 없었다(두 번 다 같은
 *     번호가 실패). 아래 두 단계로 자리를 채운다.
 *
 *  【① 크게 단독 배치】 못 읽은 문항만 «한 쪽에 혼자, 여백 넉넉히, 100% 크기»로 다시
 *     배치해 그 장 전체를 새 job 으로 올린다. (by-custom 은 job 단위라 원래 paper 의
 *     그 문항만 갈아끼울 수 없다 — 장을 통째로 다시 만든다.) 쪽 이미지 해상도가 A4 pt ×
 *     2.08 로 고정이므로, 2단 배치(폭 47%)보다 픽셀이 두 배가 되어 AI가 읽을 확률이 오른다.
 *
 *  【② 자리 표시】 그래도 실패하면 그 칸에 «문제 이미지 대신» 안내 글을 크게 그려 넣는다
 *     (pdf-lib 로 선·글자만. 한글 글꼴은 저장소/시스템에서 찾아 임베드, 없으면 영문).
 *     그림이 없으니 OCR 은 반드시 COMPLETED 가 되고, 문항 번호가 밀리지 않는다.
 *     학생은 종이 프린트를 보고 풀고 답만 입력한다 — 수학비서 정답을 그대로 주입하므로
 *     객관식이면 자동채점까지 된다(주관식·수식형은 선생님이 직접 채점).
 *     자리 표시로 바뀐 번호는 로그와 msecr_mf_state.processed[id].placeholders 에 남는다.
 *     끄려면 --no-placeholder (그러면 옛날처럼 그 장이 실패한다).
 *
 *  【긴 LaTeX 정답은 500】 정답 주입은 답이 길고 복잡한 LaTeX 이면 그 문항 하나 때문에
 *     500 이 난다(실측: 「$\triangle\mathrm{ABC}\equiv…$」 250자. 이것이 50개 묶음을 죽인 범인이다).
 *     하나씩 다시 보내도 그 문항은 계속 500 → 「△ABC≡△QPR SAS합동), …」처럼 «글자로 풀어»
 *     보내면 들어간다. 빈칸으로 두지 말고 풀어서 넣는다(simplifyAnswer).
 *
 *  【까다로운 문항 기억】 어떤 문항이 크게 올려야 읽히는지는 문제지마다 정해져 있다.
 *     그래서 성공한 번호를 msecr_mf_state 의 hard 에 남겨, --force 로 다시 올릴 때는
 *     «질 것이 뻔한 1차 시도»를 건너뛰고 처음부터 크게/자리 표시로 만든다.
 *
 *  【한글 글꼴】 pdf-lib 는 한글을 넣으려면 @pdf-lib/fontkit 과 한글 글꼴 파일이 필요하다.
 *     둘 중 하나라도 없으면 «자동으로 영문 안내»로 바뀐다(No.78 — see printed sheet).
 *     글꼴이 .ttc(글꼴 묶음)면 pdf-lib 가 그대로는 못 읽어, 묶음에서 첫 글꼴만 꺼내 준다.
 *
 *  【학습지 만들기 재시도】 복사가 전부 COPIED 로 보인 직후에 바로 학습지를 만들면
 *     그래도 LAMBDA_INVOKE_EXCEPTION 이 날 때가 있다. 20초 쉬었다 만들고, 나면
 *     필터부터 다시 받아 최대 6번 다시 시도한다.
 *
 *  【토큰 수명】 수학비서 토큰도 십수 분이면 만료된다(문제지 2장 만에 401). 매쓰플랫과
 *     마찬가지로 401 이면 다시 로그인한다. 문항 이미지용 CDN 서명 쿠키도 한 시간 남짓이라
 *     실패하면 cells 를 다시 불러 쿠키를 새로 받는다.
 *
 *  【중복 방지】 한 번 옮긴 문제지는 lumen_store 의 msecr_mf_state 에 적어 두고
 *     다음 실행부터 건너뛴다. 다시 만들려면 --force.
 *
 * ── 사용법 ────────────────────────────────────────────────────────
 *   NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
 *     node sync/mypaper_to_mathflat.js
 *
 *     (옵션 없음)          「매쓰플랫 올리기」 폴더 전체 — 이미 한 것은 건너뜀
 *     --dry                수학비서만 읽고 «계획»만 출력 (매쓰플랫 접속 안 함)
 *     --paper 1977779      그 문제지 하나만
 *     --folder "이름"       수학비서 폴더 이름 (기본 「매쓰플랫 올리기」)
 *     --mylist "이름"       매쓰플랫 마이리스트 폴더 (기본 「수학비서」)
 *     --force              이미 옮긴 문제지도 다시 옮김
 *     --no-placeholder     OCR 이 끝내 실패한 문항을 «자리 표시»로 대체하지 않음
 *                          (기본은 대체함 — 그래야 번호가 1:1로 유지된다)
 *
 * 계정: MATHSECR_ID/PASSWORD, MATHFLAT_ID/PASSWORD (환경변수만, 커밋 금지)
 * 저장: SUPABASE_URL, SUPABASE_SERVICE_KEY (lumen_store)
 * 주의: 매쓰플랫 동시 로그인 시 기존 접속이 끊길 수 있다(원장님 허용 받음).
 */
const fs = require('fs');
const path = require('path');

let _pdflib = null;
function pdflib() { if (!_pdflib) _pdflib = require(path.join(__dirname, '..', 'node_modules', 'pdf-lib')); return _pdflib; }

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://mathsecr.com';
const MF_API = 'https://api.mathflat.com';
const MF_SAI = 'https://sai.mathflat.com';
const MF_BASE = 'https://teacher.mathflat.com';
const OUT_DIR = path.join(__dirname, '_debug', 'mypaper');

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'content-type': 'application/json' });

const STATE_KEY = 'msecr_mf_state';
const LOG_KEY = 'msecr_mf_log';
const KEEP_RUNS = 14;

/* PDF 한 장(=한 job)에 허용되는 쪽 수, 한 학습지에 담을 최대 문항 수 */
const MAX_PAGES = 10;
const MAX_Q_PER_PART = 150;
/* OCR 이 못 읽은 문항을 «한 쪽에 혼자» 다시 올릴 때 쓰는 여백(pt) */
const SOLO_M = 44;
/* 자리 표시 칸의 높이(pt) — 한 단 폭에 안내 글 네 줄이 넉넉히 들어간다 */
const PH_H = 132;

/* ── 교육과정 키(trieKey) ─────────────────────────────────────────
 * 22개정 중학교: 1.4.4146.<학년>.<학년-학기>
 * 22개정 고등  : 1.4.4147.<과목>     ← 2026-09-13 /curriculums/by-key 스캔으로 확정
 *                (1.4.4147 아래에 공통수학1 4175 · 공통수학2 4176 · 대수 4177 ·
 *                 미적분1 4178 · 확률과 통계 4179 · 미적분2 4180 · 기하 4181)
 *                중학교와 달리 «한 단계 짧다». 1.4.4147.4178.0 같은 5단은 빈 배열이다.
 * 15개정 중학교: 1.2.9.<학년>.<학기> · 15개정 고등: 1.2.7.<과목>            */
const TRIE_22_MID = { '1-1': '1.4.4146.4154.4169', '1-2': '1.4.4146.4154.4170', '2-1': '1.4.4146.4155.4171', '2-2': '1.4.4146.4155.4172', '3-1': '1.4.4146.4156.4173', '3-2': '1.4.4146.4156.4174' };
const TRIE_15_MID = { '1-1': '1.2.9.27.62', '1-2': '1.2.9.27.80', '2-1': '1.2.9.29.64', '2-2': '1.2.9.29.82', '3-1': '1.2.9.31.66', '3-2': '1.2.9.31.84' };
const TRIE_22_HIGH = { '공통수학1': '1.4.4147.4175', '공통수학2': '1.4.4147.4176', '대수': '1.4.4147.4177', '미적분1': '1.4.4147.4178', '확률과통계': '1.4.4147.4179', '미적분2': '1.4.4147.4180', '기하': '1.4.4147.4181' };
const TRIE_15_HIGH = { '고등수학(상)': '1.2.7.41', '고등수학(하)': '1.2.7.42', '수학I': '1.2.7.43', '수학II': '1.2.7.44', '확률과통계': '1.2.7.45', '미적분': '1.2.7.46', '기하': '1.2.7.47' };
/* 매쓰플랫 학습지의 grade 값(고등은 숫자가 아니라 과목명. 띄어쓰기까지 그대로) */
const GRADE_VALUE_22 = { '공통수학1': '공통수학1', '공통수학2': '공통수학2', '대수': '대수', '미적분1': '미적분1', '확률과통계': '확률과 통계', '미적분2': '미적분2', '기하': '기하' };
const GRADE_VALUE_15 = { '고등수학(상)': '고등수학(상)', '고등수학(하)': '고등수학(하)', '수학I': '수학I', '수학II': '수학II', '확률과통계': '확률과 통계', '미적분': '미적분', '기하': '기하' };

/* ── 로그 (Supabase 에도 남긴다) ──────────────────────────────── */
const LINES = [];
const log = (...a) => {
  const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
  LINES.push(`${new Date().toISOString().slice(11, 19)} ${s}`);
  console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── Supabase (lumen_store) ─────────────────────────────────── */
async function kvGet(key) {
  if (!SB_URL || !SB_KEY) return null;
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${key}&select=value`, { headers: sbH() });
    if (!r.ok) return null;
    const j = await r.json();
    let v = (j[0] && j[0].value) || null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    return v;
  } catch (e) { return null; }
}
async function kvSet(key, value) {
  if (!SB_URL || !SB_KEY) { log(`⚠ Supabase 설정이 없어 ${key} 를 저장하지 못했습니다`); return false; }
  try {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
    });
    if (!r.ok) { log(`⚠ 저장 실패 ${key} ${r.status}`); return false; }
    return true;
  } catch (e) { log(`⚠ 저장 실패 ${key} ${e.message.slice(0, 120)}`); return false; }
}

/* ── 수학비서 ─────────────────────────────────────────────────── */
let MS_TOKEN = null, MS_CDN_COOKIE = null;
const msH = () => ({ accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` });
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json();
  MS_TOKEN = j.data ? j.data.accessToken : j.accessToken;
  if (!MS_TOKEN) throw new Error('수학비서 로그인 실패');
}
/* 수학비서 토큰도 십수 분이면 만료된다 (실측: 문제지 2장 만에 401
 * "token has invalid claims: token is expired") → 401이면 다시 로그인하고 한 번 더 */
async function msFetch(url, _retried) {
  const r = await fetch(url, { headers: msH() });
  if (r.status === 401 && !_retried) { log('  수학비서 토큰 만료 → 다시 로그인'); await msLogin(); return msFetch(url, true); }
  return r;
}
async function msGet(p) {
  const r = await msFetch(MS_API + p);
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${t.slice(0, 200)}`);
  return j;
}
/* 폴더 트리에서 이름이 같은 폴더 찾기 (children 이 어떤 이름으로 오든 훑는다) */
function findFolder(nodes, name) {
  let hit = null;
  const walk = (arr) => (arr || []).forEach((n) => {
    if (!n) return;
    if (n.name === name && !hit) hit = n;
    walk(n.children || n.folders);
  });
  walk(Array.isArray(nodes) ? nodes : (nodes && (nodes.folders || nodes.children)));
  return hit;
}
/* cells 응답의 Set-Cookie(Cloud-CDN-Cookie)가 문항 이미지를 여는 열쇠 */
async function msCells(id) {
  const cells = []; let cursor = '';
  for (let i = 0; i < 40; i++) {
    const r = await msFetch(`${MS_API}/bms/api/v1/my-papers/${id}/cells?limit=48${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean);
    const hit = (sc || []).find((c) => c && c.includes('Cloud-CDN-Cookie'));
    if (hit) MS_CDN_COOKIE = hit.split(';')[0];
    const j = await r.json();
    const d = j.data || {};
    (d.cells || []).forEach((c) => cells.push(c));
    (d.pages || []).forEach((pg) => (pg.cells || []).forEach((c) => cells.push(c)));
    cursor = j.pagination && j.pagination.cursor;
    if (!cursor) break;
  }
  return cells.sort((a, b) => a.questionNumber - b.questionNumber);
}

/* ── 이미지 크기 읽기 (PNG IHDR / JPEG SOFn) ──────────────────── */
function pngSize(buf) {
  if (buf.slice(1, 4).toString() === 'PNG') return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png' };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length - 8) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), type: 'jpg' };
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  return { w: 0, h: 0, type: '?' };
}

/* ── 교육과정 판단 ────────────────────────────────────────────────
 * cells[].chapters[].curriculumId 로 개정(2=22개정, 1=15개정)을,
 * chapter[0] (예 "02 중1-2", "10 미적분1") 로 학교급·학년/과목을 정한다.
 * 어느 쪽이든 확실하지 않으면 «추측하지 않고» 그 문제지를 건너뛴다. */
function normSubject(s) { return String(s).replace(/\s+/g, '').replace(/Ⅰ/g, 'I').replace(/Ⅱ/g, 'II'); }
function decideCurriculum(cells) {
  const curCount = {}, topCount = {};
  cells.forEach((c) => (c.chapters || []).forEach((x) => {
    curCount[x.curriculumId] = (curCount[x.curriculumId] || 0) + 1;
    const t = (x.chapter || [])[0];
    if (t) topCount[t] = (topCount[t] || 0) + 1;
  }));
  const curIds = Object.keys(curCount);
  if (!curIds.length) return { ok: false, why: '문항에 교육과정(chapters) 정보가 없습니다' };
  const curId = curIds.sort((a, b) => curCount[b] - curCount[a])[0];
  const rev = curId === '2' ? 'CURRICULUM_22' : (curId === '1' ? 'CURRICULUM_15' : null);
  if (!rev) return { ok: false, why: `모르는 curriculumId=${curId}` };
  const tops = Object.keys(topCount).sort((a, b) => topCount[b] - topCount[a]);
  if (!tops.length) return { ok: false, why: '문항에 대단원(chapter) 정보가 없습니다' };
  const top = tops[0];
  const mix = tops.map((t) => `${t} ${topCount[t]}`).join(' / ');
  const is22 = rev === 'CURRICULUM_22';

  const m = top.match(/[중고]\s*(\d)\s*-\s*(\d)/);          // "02 중1-2"
  if (m && /중/.test(top)) {
    const key = `${m[1]}-${m[2]}`;
    const trie = (is22 ? TRIE_22_MID : TRIE_15_MID)[key];
    if (!trie) return { ok: false, why: `중학교 ${key} 교육과정 키를 모릅니다 (${rev})` };
    return { ok: true, rev, trie, schoolType: 'MIDDLE', grade: m[1], gradeSemester: `중 ${m[1]}-${m[2]}`, top, mix, tops: tops.length };
  }
  const subj = normSubject(top.replace(/^\d+\s*/, ''));      // "10 미적분1" → "미적분1"
  const trie = (is22 ? TRIE_22_HIGH : TRIE_15_HIGH)[subj];
  if (!trie) return { ok: false, why: `고등 과목 「${subj}」의 교육과정 키를 모릅니다 (${rev})` };
  const gradeValue = (is22 ? GRADE_VALUE_22 : GRADE_VALUE_15)[subj];
  return { ok: true, rev, trie, schoolType: 'HIGH', grade: gradeValue, gradeSemester: '고 1-1', top, mix, tops: tops.length };
}

/* ── 한글 글꼴 찾기 (자리 표시 안내 글에만 쓴다) ───────────────────
 * pdf-lib 기본 글꼴(Helvetica)은 한글이 없다. @pdf-lib/fontkit 과 한글 글꼴 파일이
 * 둘 다 있어야 한글을 넣을 수 있고, 하나라도 없으면 영문 안내로 자동으로 바뀐다.
 * .ttc(글꼴 묶음)는 pdf-lib 가 그대로 못 읽으므로 묶음에서 첫 글꼴만 꺼내 넘긴다. */
let _fontkit = undefined, _koFile = undefined;
function fontkitOrNull() {
  if (_fontkit !== undefined) return _fontkit;
  _fontkit = null;
  for (const p of [path.join(__dirname, '..', 'node_modules', '@pdf-lib', 'fontkit'), '@pdf-lib/fontkit', 'fontkit']) {
    try { _fontkit = require(p); break; } catch (e) {}
  }
  return _fontkit;
}
function koreanFontFile() {
  if (_koFile !== undefined) return _koFile;
  _koFile = null;
  const fk = fontkitOrNull();
  if (!fk) return _koFile;
  const cands = [];
  /* ① 저장소 안에 넣어 둔 글꼴이 있으면 그것을 가장 먼저 */
  for (const d of [path.join(__dirname, 'fonts'), path.join(__dirname, '..', 'assets', 'fonts'), path.join(__dirname, '..', 'fonts')]) {
    try { fs.readdirSync(d).forEach((f) => { if (/\.(ttf|otf|ttc)$/i.test(f)) cands.push(path.join(d, f)); }); } catch (e) {}
  }
  /* ② 시스템 글꼴 (나눔 → 노토 → 문천의정흑 → 유니폰트 순으로 예쁜 것부터) */
  cands.push(
    '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
    '/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansKR-Regular.otf',
    '/usr/share/fonts/truetype/noto/NotoSansCJKkr-Regular.otf',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/opentype/unifont/unifont.otf');
  for (const f of cands) {
    try {
      if (!fs.statSync(f).isFile()) continue;
      const parsed = fk.create(fs.readFileSync(f));
      const one = parsed && parsed.fonts ? parsed.fonts[0] : parsed;
      /* 한글(가)과 문장부호가 실제로 있는 글꼴만 쓴다 */
      if (one && one.hasGlyphForCodePoint && one.hasGlyphForCodePoint('가'.codePointAt(0))) { _koFile = f; break; }
    } catch (e) {}
  }
  return _koFile;
}
/* 문서에 한글 글꼴을 넣는다. 실패하면 null → 부르는 쪽이 영문으로 쓴다 */
async function embedKoreanFont(doc) {
  const fk = fontkitOrNull(), file = koreanFontFile();
  if (!fk || !file) return null;
  try {
    /* pdf-lib 는 .ttc 를 모른다 → create() 를 감싸 «묶음의 첫 글꼴»을 돌려준다 */
    doc.registerFontkit({ create: (b) => { const p = fk.create(b); return p && p.fonts ? p.fonts[0] : p; } });
    return await doc.embedFont(fs.readFileSync(file), { subset: true });
  } catch (e) { return null; }
}

/* ── A4 2단 PDF 조립 + 상자 좌표 기록 ─────────────────────────────
 * 1차 프로브와 «같은 치수»를 쓴다 (193문항 → 정확히 10쪽).
 * 반환 boxes 는 PDF pt 좌표(y는 아래가 0). 나중에 쪽 이미지 픽셀로 바꾼다.
 *
 * 문항 하나는 세 가지 모습 중 하나로 들어간다.
 *   보통       — 2단 배치, 이미지를 단 폭에 맞춰 축소(shrink 배)
 *   r.solo     — 매쓰플랫 OCR 이 못 읽은 문항: «한 쪽에 혼자» 여백 넉넉히 100% 크기
 *   r.placeholder — 그래도 못 읽은 문항: 이미지 대신 안내 글을 크게 그린 자리 표시 */
async function buildPdf(recs, shrink) {
  const { PDFDocument, rgb, StandardFonts } = pdflib();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const needKo = recs.some((r) => r.placeholder);
  const ko = needKo ? await embedKoreanFont(doc) : null;
  const A4W = 595.28, A4H = 841.89;
  const M = 24, GAP = 12, COLW = (A4W - M * 2 - GAP) / 2;
  const NUMW = 22, PAD = 4, LEAD = 14;
  let page = null, col = 0, y = 0, pageNo = 0, pageUsed = false, forceNew = false;
  const newPage = () => { page = doc.addPage([A4W, A4H]); pageNo++; col = 0; y = A4H - M; pageUsed = false; };
  newPage();
  const colX = () => M + col * (COLW + GAP);
  const boxes = [];
  /* 글자가 칸을 넘지 않게 크기를 줄여 가며 그린다 */
  const put = (txt, x, yy, size, f, color, maxW) => {
    let s = size;
    while (s > 6 && f.widthOfTextAtSize(txt, s) > maxW) s -= 0.5;
    page.drawText(txt, { x, y: yy, size: s, font: f, color });
  };
  for (const r of recs) {
    /* ── 자리 표시: 문제 이미지 대신 안내 글 (OCR 이 반드시 성공한다) ── */
    if (r.placeholder) {
      const blockH = PH_H + LEAD;
      if (forceNew) { newPage(); forceNew = false; }
      if (y - blockH < M) { if (col === 0) { col = 1; y = A4H - M; } else { newPage(); } }
      const x0 = colX(), yTop = y, yBot = y - blockH + 6, x1 = colX() + COLW;
      page.drawRectangle({ x: x0 + 2, y: yBot + 2, width: COLW - 6, height: yTop - yBot - 6,
        color: rgb(1, 1, 1), borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 1.2 });
      const tx = x0 + 12, maxW = COLW - 26;
      const L = ko
        ? [[`${r.no}번 문항`, 17, ko], ['프린트를 보고 푸세요.', 13, ko],
           ['이 문제는 나눠 드린 종이에', 11, ko], ['있습니다. 답만 입력하세요.', 11, ko],
           ['(선생님 확인 문항)', 10, ko], ['답:', 12, ko]]
        : [[`No.${r.no}`, 17, font], ['See printed sheet', 13, font],
           ['This question is on the', 11, font], ['paper handout. Type the', 11, font],
           ['answer only.', 11, font], ['Answer:', 12, font]];
      let ty = yTop - 22;
      L.forEach(([t, s, f], i) => { put(t, tx, ty, s, f, i === 0 ? rgb(0.05, 0.25, 0.7) : rgb(0.1, 0.1, 0.1), maxW); ty -= s + 5; });
      page.drawLine({ start: { x: tx + 26, y: ty + 12 }, end: { x: x0 + COLW - 14, y: ty + 12 }, thickness: 0.8, color: rgb(0.3, 0.3, 0.3) });
      boxes.push({ no: r.no, pageNo, x0, y0: yBot, x1, y1: yTop });
      y -= blockH; pageUsed = true;
      continue;
    }
    const buf = fs.readFileSync(r.file);
    const img = r.type === 'jpg' ? await doc.embedJpg(buf) : await doc.embedPng(buf);
    /* ── 단독 배치: 한 쪽에 혼자, 여백 넉넉히, 최대 크기(쪽 이미지 픽셀이 두 배가 된다) ── */
    if (r.solo) {
      if (pageUsed) newPage();
      const usableW = A4W - SOLO_M * 2 - NUMW - PAD;
      const usableH = A4H - SOLO_M * 2 - 18;
      const scale = Math.min(1, usableW / img.width, usableH / img.height);
      const w = img.width * scale, h = img.height * scale;
      const top = A4H - SOLO_M;
      page.drawText(String(r.no), { x: SOLO_M, y: top - 16, size: 15, font, color: rgb(0.05, 0.25, 0.7) });
      page.drawImage(img, { x: SOLO_M + NUMW, y: top - 6 - h, width: w, height: h });
      boxes.push({ no: r.no, pageNo,
        x0: Math.max(0, SOLO_M - 10), y0: Math.max(0, top - 6 - h - 14),
        x1: Math.min(A4W, SOLO_M + NUMW + w + 10), y1: Math.min(A4H, top + 10) });
      pageUsed = true; forceNew = true;      /* 다음 문항은 새 쪽부터 */
      continue;
    }
    if (forceNew) { newPage(); forceNew = false; }
    const scale = Math.min(1, (COLW - NUMW - PAD) / img.width) * shrink;
    const w = img.width * scale, h = img.height * scale;
    const blockH = Math.max(h, 18) + LEAD;
    if (y - blockH < M) {
      if (col === 0) { col = 1; y = A4H - M; } else { newPage(); }
    }
    const x0 = colX(), yTop = y, yBot = y - blockH + 6, x1 = colX() + COLW;
    page.drawText(String(r.no), { x: x0 + 2, y: yTop - 13, size: 12, font, color: rgb(0.05, 0.25, 0.7) });
    page.drawImage(img, { x: x0 + NUMW, y: yTop - 2 - h, width: w, height: h });
    boxes.push({ no: r.no, pageNo, x0, y0: yBot, x1, y1: yTop });
    y -= blockH; pageUsed = true;
  }
  return { bytes: await doc.save(), pageCount: doc.getPageCount(), boxes, A4W, A4H, koFont: !!ko };
}
/* PDF pt 좌표 → 쪽 이미지 픽셀 [x, y, w, h] (좌상단 원점) */
function toPixelBoxes(pdf, imgW, imgH) {
  const sx = imgW / pdf.A4W, sy = imgH / pdf.A4H;
  const out = Array.from({ length: pdf.pageCount }, () => []);
  pdf.boxes.forEach((b) => {
    out[b.pageNo - 1].push([
      Math.round(b.x0 * sx), Math.round((pdf.A4H - b.y1) * sy),
      Math.round((b.x1 - b.x0) * sx), Math.round((b.y1 - b.y0) * sy),
    ]);
  });
  return out;
}

/* ── 매쓰플랫 ────────────────────────────────────────────────── */
let MF_TOKEN = null;
const mfH = () => ({ 'content-type': 'application/json', accept: 'application/json, text/plain, */*',
  'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
  authorization: `Bearer ${MF_TOKEN}`, 'x-auth-token': MF_TOKEN, origin: MF_BASE, referer: MF_BASE + '/' });
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: MF_BASE, referer: MF_BASE + '/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
/* 한 문제지에 십수 분이 걸려 도중에 토큰이 만료된다 → 401이면 한 번 다시 로그인 */
async function mf(host, method, p, body, _retried) {
  const r = await fetch(host + p, { method, headers: mfH(), body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  const data = j && j.data !== undefined ? j.data : j;
  if (r.status === 401 && !_retried) { log('  토큰 만료 → 다시 로그인'); await mfLogin(); return mf(host, method, p, body, true); }
  if (!r.ok) { const e = new Error(`${method} ${p} → ${r.status} ${t.slice(0, 300)}`); e.status = r.status; throw e; }
  return { data, raw: t };
}
/* /jobs 는 따옴표 없는 uuid 원문을 돌려준다 */
async function saiJob() {
  const { data, raw } = await mf(MF_SAI, 'POST', '/jobs');
  return (data && (data.jobId || data.id)) || (typeof data === 'string' ? data : null) || (/^[0-9a-f-]{30,}$/.test(raw.trim()) ? raw.trim() : null);
}
async function saiPoll(jobId, timeoutMs, tag) {
  const until = Date.now() + (timeoutMs || 900000);
  let last = '';
  while (Date.now() < until) {
    const { data } = await mf(MF_SAI, 'GET', `/async-jobs/${jobId}`);
    if (data.status !== last) { last = data.status; log(`    ${tag || 'AI'} 상태: ${last}`); }
    if (data.status === 'COMPLETED') return data.returns;
    if (data.status === 'FAILED') throw new Error(`${tag || 'AI'} 작업 실패: ` + JSON.stringify(data).slice(0, 300));
    await sleep(2000);
  }
  throw new Error(`${tag || 'AI'} 작업 시간 초과`);
}

/* ── 수학비서 정답 → 매쓰플랫 정답 ────────────────────────────────
 * mfType 은 매쓰플랫이 OCR로 판정한 유형(latestVersion.type). 객관식이면 그대로 따른다.
 * 객관식 ["4"]→"4" · ["3","5"]→"3,5"(MULTIPLE_CHOICE) · 주관식 숫자는 그대로 ·
 * \frac{a}{b}→"a/b" · 그 밖의 수식·문장은 원문 그대로(자동채점은 안 된다). */
function toMfAnswer(msAnswerArr, mfType) {
  const arr = Array.isArray(msAnswerArr) ? msAnswerArr : [msAnswerArr];
  const clean = (s) => String(s).replace(/^\$|\$$/g, '').replace(/\\[,;:!]/g, '').replace(/\s+/g, '').trim();
  const isChoice = mfType === 'SINGLE_CHOICE' || mfType === 'MULTIPLE_CHOICE';
  const digits = arr.join(',').replace(/\$/g, '').split(/[,\s]+/).map(clean).filter(Boolean);
  if (isChoice) {
    const ch = digits.filter((d) => /^[1-5]$/.test(d));
    if (ch.length === 0) return { ok: false, reason: '객관식인데 답이 1~5가 아님', answer: arr.join(', '), problemType: 'SHORT_ANSWER' };
    return { ok: true, answer: ch.join(','), problemType: ch.length > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE', optionCount: 5 };
  }
  if (arr.length === 1 && digits.length === 1) {
    const v = digits[0];
    if (/^-?\d+(\.\d+)?$/.test(v)) return { ok: true, answer: v, problemType: 'SHORT_ANSWER' };
    const fr = v.match(/^-?\\frac\{(-?\d+)\}\{(\d+)\}$/);
    if (fr) return { ok: true, answer: (v.startsWith('-') ? '-' : '') + fr[1].replace('-', '') + '/' + fr[2], problemType: 'SHORT_ANSWER' };
  }
  return { ok: false, reason: '수식·문장·복수답 — 자동채점 불가', answer: arr.join(', '), problemType: 'SHORT_ANSWER' };
}
/* 긴 LaTeX 정답을 «읽을 수 있는 글»로 풀어 준다 (주입이 500 으로 실패했을 때만 쓴다).
 * 실측(2026-09-13): 250자짜리 $\triangle\mathrm{ABC}\equiv…$ 는 매쓰플랫이 500 으로 거절하지만
 * 「△ABC≡△QPR SAS 합동), …」로 풀어 보내면 그대로 들어간다. 빈칸으로 두는 것보다 낫다. */
function simplifyAnswer(s) {
  if (typeof s !== 'string' || !s) return '';
  return s
    .replace(/\$/g, '')
    .replace(/\\triangle\s*/g, '△').replace(/\\angle\s*/g, '∠').replace(/\\equiv\s*/g, '≡')
    .replace(/\\overline\{([^}]*)\}/g, '$1').replace(/\\mathrm\{([^}]*)\}/g, '$1').replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\degree/g, '°').replace(/\\times/g, '×').replace(/\\div/g, '÷')
    .replace(/\\left\(?|\\right\.?\)?/g, '')
    .replace(/\\[,;:!]/g, '')                       /* \, \; 같은 «간격» 기호는 그냥 없앤다 */
    .replace(/\\[a-zA-Z]+/g, ' ').replace(/[\\~{}]/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .slice(0, 120);
}
/* 수학비서가 적어 둔 문항 유형(answers[].type) → 매쓰플랫 유형.
 * «자리 표시»로 바꾼 문항은 그림에 보기가 없어 매쓰플랫이 객관식인 줄 모르므로,
 * 이 값을 대신 알려 주어야 학생이 번호를 고르고 자동채점이 된다.
 * boolean_choice(O/X)·latex_answer 등은 단답으로 둔다(정답은 글자 그대로 들어간다). */
function msChoiceType(rec) {
  const t = (rec && rec.answerTypes ? rec.answerTypes : []).join(' ');
  if (/multiple_choice/.test(t)) return 'MULTIPLE_CHOICE';
  if (/single_choice/.test(t)) return 'SINGLE_CHOICE';
  return 'SHORT_ANSWER';
}

/* ── 문항 상태(OCR·정답 반영)가 끝날 때까지 ───────────────────── */
async function fetchDetails(detailIds) {
  const rows = [];
  for (let i = 0; i < detailIds.length; i += 50) {
    const { data } = await mf(MF_API, 'POST', '/my-db-problems/details', { detailIds: detailIds.slice(i, i + 50) });
    (data.myDbProblemDetails || []).forEach((d) => rows.push(d));
  }
  return rows.sort((a, b) => a.boxIndex - b.boxIndex);
}
async function waitDetails(detailIds, tag) {
  const t0 = Date.now();
  let rows = [];
  for (let i = 0; i < 90; i++) {
    rows = await fetchDetails(detailIds);
    const st = {}; rows.forEach((d) => { st[d.processingStatus] = (st[d.processingStatus] || 0) + 1; });
    const done = rows.every((d) => ['COMPLETED', 'NOT_REQUIRED', 'FAILED'].includes(d.processingStatus));
    if (i % 3 === 0 || done) log(`    ${tag} ${((Date.now() - t0) / 1000) | 0}초 · ${JSON.stringify(st)}`);
    if (done && rows.length === detailIds.length) return rows;
    await sleep(8000);
  }
  return rows;
}

/* ── 문제은행으로 복사 (남은 것만 재요청하는 것이 핵심) ────────── */
async function copyToProblem(detailIds) {
  let reRequests = 0;
  for (let i = 0; i < 60; i++) {
    try { await mf(MF_API, 'POST', '/my-db-problems/copy-to-problem', { detailIds }); break; }
    catch (e) {
      if (!/NOT_COMPLETED|INTERNAL_SERVER_ERROR|PROCESSING/i.test(e.message)) throw e;
      if (i % 6 === 0) log(`    복사 준비 대기… ${i * 10}초`);
      await sleep(10000);
    }
  }
  const t0 = Date.now();
  let copied = {}, lastNudge = Date.now();
  for (let i = 0; i < 200; i++) {
    const { data } = await mf(MF_API, 'POST', '/my-db-problems/copy-to-problem/status', { detailIds });
    const rows = (data && data.details) || [];
    copied = {}; const stat = {};
    rows.forEach((x) => { stat[x.status] = (stat[x.status] || 0) + 1; if (x.status === 'COPIED') copied[x.myDbProblemDetailId] = x.problemId; });
    if (i % 6 === 0) log(`    복사 ${((Date.now() - t0) / 1000) | 0}초 · ${JSON.stringify(stat)}`);
    if (rows.length && Object.keys(copied).length === rows.length) break;
    /* 2~3분 지나도 진행 중이 남으면 «남은 것만» 다시 요청해야 움직인다 */
    if (Date.now() - lastNudge > 150000) {
      const pending = rows.filter((x) => x.status !== 'COPIED').map((x) => x.myDbProblemDetailId);
      if (pending.length) {
        try { await mf(MF_API, 'POST', '/my-db-problems/copy-to-problem', { detailIds: pending }); reRequests++; log(`    ↻ 남은 ${pending.length}개 복사 재요청 (${reRequests}회째)`); }
        catch (e) { log(`    ↻ 재요청 실패: ${e.message.slice(0, 120)}`); }
      }
      lastNudge = Date.now();
    }
    await sleep(5000);
  }
  return { copied, reRequests, sec: ((Date.now() - t0) / 1000) | 0 };
}

/* ── 마이리스트(폴더)에 담기 ─────────────────────────────────────
 * 담기가 실패해도 학습지는 이미 만들어져 있다 — 여기서 예외를 던지지 않는다.
 * (매쓰플랫 폴더는 20개가 상한. 꽉 차 있으면 만들지 못한다) */
async function putInMylist(name, ids) {
  if (!name || !ids.length) return { ok: false, reason: '폴더 지정 없음' };
  try {
    const { data: lists } = await mf(MF_API, 'GET', '/mylist');
    const all = (lists && lists.myLists) || (Array.isArray(lists) ? lists : []);
    let target = all.find((l) => l.name === name);
    if (!target) {
      const { data: mk } = await mf(MF_API, 'POST', '/mylist', { name });
      target = (mk && mk.myList) || mk;
      log(`  마이리스트 「${name}」 새로 만듦`);
    }
    if (target && target.id) {
      await mf(MF_API, 'POST', `/mylist/${target.id}/element`, { worksheetIds: ids });
      log(`  마이리스트 「${name}」에 학습지 ${ids.length}장 담음`);
      return { ok: true, mylistId: target.id };
    }
    return { ok: false, reason: '폴더를 찾지도 만들지도 못함' };
  } catch (e) {
    const full = /MY_LIST_LIMIT_EXCEEDED/.test(e.message);
    log(full
      ? `  ⚠ 폴더 「${name}」를 만들지 못했습니다 — 매쓰플랫 폴더가 20개로 꽉 찼습니다. 학습지는 정상 생성됐습니다`
      : `  ⚠ 폴더 담기 실패(학습지는 정상): ${e.message.slice(0, 160)}`);
    return { ok: false, reason: e.message.slice(0, 200), limitFull: full };
  }
}

/* ── 실패했을 때 반쪽짜리 지우기 ─────────────────────────────── */
async function cleanup(worksheetIds, paperIds) {
  for (const id of worksheetIds) {
    for (const p of ['/worksheet', '/worksheet/trash/by-worksheet']) {
      try { await mf(MF_API, 'DELETE', p, [id]); } catch (e) { log(`  정리: 학습지 ${id} 삭제 실패 (${p}) ${e.message.slice(0, 120)}`); }
    }
    log(`  정리: 학습지 ${id} 삭제`);
  }
  for (const id of paperIds) {
    try { await mf(MF_API, 'DELETE', `/papers/${id}`); log(`  정리: paper ${id} 삭제`); }
    catch (e) { log(`  정리: paper ${id} 삭제 실패 ${e.message.slice(0, 120)}`); }
  }
}

/* ═══ 한 «장»(part) 을 매쓰플랫에 올린다 ═══════════════════════════ */
async function runPart(part, cur, title, workDir, made) {
  const t0 = Date.now();
  const soloNos = part.recs.filter((r) => r.solo).map((r) => r.no);
  const phNos = part.recs.filter((r) => r.placeholder).map((r) => r.no);
  log(`  ── 「${title}」 ${part.recs.length}문항 · ${part.pdf.pageCount}쪽`
    + (soloNos.length ? ` · 크게 단독 배치 ${soloNos.join(',')}` : '')
    + (phNos.length ? ` · 자리 표시 ${phNos.join(',')}` : ''));
  fs.writeFileSync(path.join(workDir, `${part.tag}${part.attempt > 1 ? `-a${part.attempt}` : ''}.pdf`), part.pdf.bytes);

  // ④ 업로드 + 쪽 이미지 만들기
  const jobId = await saiJob();
  const { data: pres } = await mf(MF_SAI, 'POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: part.pdf.bytes });
  if (!up.ok) throw new Error(`PDF 업로드 실패 ${up.status}`);
  await mf(MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageIndexes: `1~${part.pdf.pageCount}`, pageImageQuality: 'HIGH' },
  });
  const docRet = await saiPoll(jobId, 900000, '쪽 이미지');
  if (!docRet.pageImageUrls || docRet.pageImageUrls.length !== part.pdf.pageCount)
    throw new Error(`쪽 이미지 수가 다릅니다 (${(docRet.pageImageUrls || []).length}/${part.pdf.pageCount})`);

  // 쪽 이미지 픽셀 크기를 재서 우리 좌표를 환산 (A4 pt × 2.0814 로 실측됨)
  const pr = await fetch(docRet.pageImageUrls[0]);
  const sz = pngSize(Buffer.from(await pr.arrayBuffer()));
  if (!sz.w) throw new Error('쪽 이미지 크기를 읽지 못했습니다');
  const boxesOnEachPage = toPixelBoxes(part.pdf, sz.w, sz.h);
  log(`    쪽 이미지 ${sz.w}x${sz.h} · 우리 상자 ${boxesOnEachPage.reduce((a, b) => a + b.length, 0)}개`);

  // ⑤ 우리 상자로 문제은행 매칭
  await mf(MF_SAI, 'POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/analysis-flow',
    parameters: { pageImageUrls: docRet.pageImageUrls, boxesOnEachPage, trieKey: cur.trie },
  });
  const an = await saiPoll(jobId, 900000, '문제 분석');
  const nBox = (an.boxesOnEachPage || []).reduce((a, b) => a + b.length, 0);
  const matched = (an.sourceData || []).filter((x) => x && x.sourceProblemId).length;
  if (nBox !== part.recs.length) throw new Error(`분석 상자 수가 다릅니다 (${nBox}/${part.recs.length})`);
  log(`    문제은행 매칭 ${matched}/${nBox}`);

  // ⑥ 기타 학습자료(나의 DB) 원본 등록 — boxes[].url 은 반드시 있어야 한다
  const pages = an.pageImageUrls.map((url, i) => ({ index: i + 1, url, boundingBoxes: an.boxesOnEachPage[i] }));
  const NULLS = { conceptId: null, topicId: null, subTopicId: null, level: null, mappedProblemId: null, sourceProblemId: null, sourceWorkbookId: null };
  let k = 0; const boxes = [];
  an.boxesOnEachPage.forEach((pb, pi) => pb.forEach(() => {
    if (!an.boxImageUrls || !an.boxImageUrls[k]) throw new Error(`상자 이미지 주소가 없습니다 (${k + 1}번째)`);
    boxes.push({ pageIndex: pi + 1, index: k + 1, url: an.boxImageUrls[k], ...NULLS, ...(an.sourceData[k] || {}) });
    k++;
  }));
  const { data: paper } = await mf(MF_API, 'POST', '/v2/papers/by-custom', {
    jobId, pdfUrl: pres.url, title, gradeSemester: cur.gradeSemester, trieKey: cur.trie,
    pages, boxes, needOriginalProblem: true, saveOriginalProblem: true,
  });
  made.paperIds.push(paper.id);
  const details0 = (paper.myDbProblemDetails || []).slice().sort((a, b) => a.boxIndex - b.boxIndex);
  const detailIds = details0.map((d) => d.id);
  if (detailIds.length !== part.recs.length) throw new Error(`등록 문항 수가 다릅니다 (${detailIds.length}/${part.recs.length})`);
  log(`    원본 등록: paper ${paper.id} · 문항 ${detailIds.length}`);

  // ⑦ OCR 끝나기를 기다린 뒤 정답 주입
  let rows = await waitDetails(detailIds, 'OCR 대기');
  /* OCR 이 FAILED 인 문항(이미지가 어려워 글자를 못 읽은 것)은 contentDataKey 가 없다.
   * 이런 문항을 50개 묶음에 섞어 보내면 묶음 전체가 500 INTERNAL_SERVER_ERROR 로 죽는다
   * (2026-09-13 실측). 그래서 «빼고» 보내고, 그래도 묶음이 실패하면 하나씩 다시 보낸다.
   * 못 넣은 문항은 정답만 비어 있을 뿐 학습지에는 그대로 들어간다. */
  const versions = []; const conv = { ok: 0, raw: 0 }; let skipNoKey = 0;
  rows.forEach((d) => {
    const src = part.recs[d.boxIndex - 1];
    if (!src) return;
    const key = String(d.ocrRawDataUrl || '').replace(/^https?:\/\/[^/]+\//, '');
    if (!key || d.processingStatus === 'FAILED') { skipNoKey++; return; }
    const lv = d.latestVersion || {};
    /* 자리 표시 문항은 그림이 «안내 글»이라 매쓰플랫 OCR 이 객관식인 줄 모른다.
     * 그래서 수학비서가 알고 있는 유형(단답/객관식)을 대신 알려 준다 —
     * 객관식이면 학생이 번호를 골라 자동채점까지 된다. */
    const c = toMfAnswer(src.answer, src.placeholder ? msChoiceType(src) : lv.type);
    if (c.ok) conv.ok++; else conv.raw++;
    /* no 는 «우리»가 로그에 쓰려고 붙인 것 — 보낼 때는 떼고 보낸다 */
    versions.push({ no: src.no, detailId: d.id, contentDataKey: key, answer: c.answer, problemType: c.problemType,
      ...(c.optionCount == null ? {} : { optionCount: c.optionCount }) });
  });
  /* OCR 이 실패한 문항은 매쓰플랫이 «문항 이미지»도 만들지 못한다. 그러면
   * copy-to-problem 이 그 묶음 전체를 MYDB_PROBLEM_IMAGE_NOT_COMPLETED 로 거절해
   * (한 문항이라도 안 되면 전부 안 된다) 이 장은 영영 학습지가 되지 못한다.
   * 10분씩 헛되이 기다리지 말고 여기서 «원 번호»를 밝히며 끝낸다. (부르는 쪽이 한 번 더 시도) */
  const badRows = rows.filter((d) => d.processingStatus === 'FAILED' || !d.ocrRawDataUrl);
  const badNos = badRows.map((d) => (part.recs[d.boxIndex - 1] ? part.recs[d.boxIndex - 1].no : `상자${d.boxIndex}`));
  if (badNos.length) {
    const err = new Error(`매쓰플랫이 글자를 읽지 못한 문항이 있습니다 (원 번호 ${badNos.join(', ')}) — 이 문항은 문제은행으로 복사되지 않아 학습지를 만들 수 없습니다`);
    err.code = 'OCR_FAILED_ITEMS';
    err.badNos = badNos;
    /* 부르는 쪽이 «그 문항만» 크게/자리 표시로 바꿀 수 있도록 자리(index)도 알려 준다 */
    err.badIdx = badRows.map((d) => d.boxIndex - 1).filter((k) => k >= 0 && k < part.recs.length);
    throw err;
  }
  if (skipNoKey) log(`    ⚠ 본문 없음 ${skipNoKey}개`);
  let injected = 0; const injectFailed = [], simplified = [];
  const send = (list) => mf(MF_API, 'POST', '/my-db-problems/versions', { versions: list.map(({ no, ...rest }) => rest) });
  for (let i = 0; i < versions.length; i += 50) {
    const c = versions.slice(i, i + 50);
    try { await send(c); injected += c.length; }
    catch (e) {
      log(`    묶음 주입 실패(${c.length}개) → 하나씩 다시: ${e.message.slice(0, 140)}`);
      for (const v of c) {
        try { await send([v]); injected++; }
        catch (e2) {
          /* 긴 LaTeX 정답은 매쓰플랫이 500 으로 삼키지 못한다(실측: 89번 △ABC≡… 250자).
           * 그러면 «읽을 수 있는 글»로 풀어서 한 번 더 — 빈칸보다 낫다. */
          const simple = simplifyAnswer(v.answer);
          if (simple && simple !== v.answer) {
            try { await send([{ ...v, answer: simple }]); injected++; simplified.push(`${v.no || v.detailId}`); continue; }
            catch (e3) {}
          }
          injectFailed.push(v.detailId);
        }
      }
    }
  }
  if (simplified.length) log(`    ↻ 긴 수식 정답 ${simplified.length}개는 글자로 풀어서 넣었습니다 (원 번호 ${simplified.join(', ')})`);
  if (injectFailed.length) log(`    ⚠ 정답을 넣지 못한 문항 ${injectFailed.length}개`);
  log(`    정답 주입 ${injected}/${versions.length}개 (그대로 바꾼 것 ${conv.ok} · 원문 그대로 ${conv.raw})`);
  await sleep(11000);
  rows = await waitDetails(detailIds, '정답 반영 대기');

  // ⑧ 문제은행 복사 (전량 COPIED 전에 학습지를 만들면 LAMBDA_INVOKE_EXCEPTION)
  const cp = await copyToProblem(detailIds);
  const copiedIds = detailIds.filter((d) => cp.copied[d]);
  log(`    복사 완료 ${copiedIds.length}/${detailIds.length} · ${cp.sec}초 · 재요청 ${cp.reRequests}회`);
  if (copiedIds.length !== detailIds.length) throw new Error(`문제은행 복사가 끝나지 않았습니다 (${copiedIds.length}/${detailIds.length})`);

  // ⑨ 학습지 — 번호 순서(boxIndex) 그대로. 학생 배정은 하지 않는다
  /* 복사가 COPIED 로 보인 «직후»에 만들면 아직 LAMBDA_INVOKE_EXCEPTION 이 난다(실측).
   * 조금 쉬었다가 만들고, 그래도 나면 필터부터 다시 받아 여러 번 시도한다. */
  await sleep(20000);
  let wsRaw = null, lastErr = null;
  for (let i = 0; i < 6; i++) {
    try {
      const { data: flt } = await mf(MF_API, 'POST', '/v2/worksheet/filter/school-test-paper/original', { myDbProblemDetailIds: detailIds });
      const { data } = await mf(MF_API, 'POST', '/worksheet', {
        conceptIdList: [], littleChapterConceptIdList: [],
        assignStudentIdList: [], shareScope: 'ACADEMY', writer: '루멘수학',
        layoutType: 0, layoutColor: 'BLUE', partitionType: 0,
        wrongAnswerNoteFlag: false, conceptNameFlag: true, answerRateFlag: false,
        relationWorkbookFlag: false, includeProblemFlag: false, conceptSortType: 'CHAPTER',
        schoolType: cur.schoolType, revision: cur.rev, grade: cur.grade,
        problemPadding: 60, pdfDateType: 'TODAY', pdfDate: null,
        designTemplateId: null, qrFlag: false, problemTrendFlag: false,
        filterId: flt.filterId || flt,
        problemList: detailIds.map((d, i) => ({ id: cp.copied[d], boxIndex: i + 1 })),
        myDbProblemDetailIds: detailIds,
        title, tag: 'MY_DB_ORIGINAL',
      });
      wsRaw = data; break;
    } catch (e) {
      lastErr = e;
      if (!/LAMBDA_INVOKE_EXCEPTION|INTERNAL_SERVER_ERROR/.test(e.message)) throw e;
      log(`    학습지 만들기 재시도 ${i + 1}/6 — ${e.message.slice(0, 120)}`);
      await sleep(30000);
    }
  }
  if (!wsRaw) throw lastErr;
  const wsId = (wsRaw && wsRaw.id) || wsRaw;
  made.worksheetIds.push(wsId);
  log(`    ✅ 학습지 ${wsId} 「${title}」`);

  // ⑩ 만든 학습지를 다시 읽어 확인
  /* 정답이 문제은행 쪽으로 퍼지는 데 시간이 걸려, 만들자마자 읽으면 아직 덜 채워져 보인다
   * (같은 학습지가 37개 → 54개로 늘어나는 것을 실측). 다 찰 때까지 몇 번 더 읽는다. */
  const expectIds = detailIds.map((d) => cp.copied[d]);
  let probs = [], orderOk = false, withAnswer = 0, autoScored = 0;
  for (let i = 0; i < 6; i++) {
    const { data: got } = await mf(MF_API, 'GET', `/worksheet/${wsId}?ignoredForDeleted=true`);
    const ws = got.worksheet || got;
    probs = got.problems || ws.problems || [];
    orderOk = probs.length === expectIds.length && probs.every((p, k) => (p.id || p.problemId) === expectIds[k]);
    withAnswer = 0; autoScored = 0;
    probs.forEach((p) => {
      if (p.answer != null && String(p.answer).trim() !== '' && String(p.answer).trim() !== '.') withAnswer++;
      if (p.autoScored) autoScored++;
    });
    if (withAnswer >= versions.length || i === 5) break;
    log(`    정답이 아직 ${withAnswer}/${versions.length} — 20초 뒤 다시 확인`);
    await sleep(20000);
  }
  log(`    확인: 문항 ${probs.length}/${part.recs.length} · 번호순서 ${orderOk ? '일치' : '불일치'} · 정답 ${withAnswer} · 자동채점 ${autoScored}`);
  /* 정답이 비어 있는 칸이 있으면 «원 번호»를 알려 준다 — 매쓰플랫이 가끔 몇 개를 흘린다
   * (2026-09-13 실측: 같은 문제지를 두 번 올렸는데 한 번은 54/54, 한 번은 51/54).
   * 원장님이 그 번호만 매쓰플랫에서 직접 채워 넣으시면 된다. */
  const blankNos = probs.map((p, k) => ((p.answer != null && String(p.answer).trim() !== '' && String(p.answer).trim() !== '.')
    ? null : (part.recs[k] ? part.recs[k].no : k + 1))).filter((x) => x != null);
  if (blankNos.length) log(`    ⚠ 정답이 비어 있는 문항 (원 번호) ${blankNos.join(', ')} — 매쓰플랫에서 직접 채워 주세요`);
  /* 자리 표시로 대체된 문항은 그 번호의 정답이 들어갔는지 따로 확인해 둔다 */
  const phCheck = phNos.map((no) => {
    const k = part.recs.findIndex((r) => r.no === no);
    const p = probs[k] || {};
    return { no, mfIndex: k + 1, answer: p.answer == null ? '' : String(p.answer).slice(0, 60), autoScored: !!p.autoScored };
  });
  if (phCheck.length) phCheck.forEach((x) => log(`    자리 표시 ${x.no}번(학습지 ${x.mfIndex}번) 정답 「${x.answer}」 자동채점 ${x.autoScored ? '가능' : '불가'}`));
  return {
    worksheetId: wsId, paperId: paper.id, title, n: part.recs.length,
    range: `${part.recs[0].no}~${part.recs[part.recs.length - 1].no}`,
    pages: part.pdf.pageCount, matched, matchedTotal: nBox,
    problemCount: probs.length, orderOk, withAnswer, autoScored,
    convOk: conv.ok, convRaw: conv.raw, reRequests: cp.reRequests,
    soloNos, placeholders: phNos, placeholderCheck: phCheck, blankNos,
    sec: ((Date.now() - t0) / 1000) | 0,
  };
}

/* ═══ 문제지 하나 ═══════════════════════════════════════════════ */
async function runPaper(paperId, opt) {
  const t0 = Date.now();
  const meta = (await msGet(`/bms/api/v1/my-papers/${paperId}`)).data || {};
  const title = String(meta.title || '').trim();
  log(`\n■ ${paperId} 「${title}」 (수학비서 ${meta.questionCount}문항)`);

  const cells = await msCells(paperId);
  if (!cells.length) throw new Error('문항이 없습니다');
  const nums = cells.map((c) => c.questionNumber);
  const gaps = nums.filter((n, i) => i && n !== nums[i - 1] + 1);
  log(`  문항 ${cells.length}개 · 번호 ${nums[0]}~${nums[nums.length - 1]}${gaps.length ? ` · 번호 불연속 ${gaps.join(',')}` : ''}`);

  const cur = decideCurriculum(cells);
  if (!cur.ok) throw new Error(`교육과정을 정할 수 없습니다 — ${cur.why}`);
  log(`  교육과정: ${cur.rev} · ${cur.schoolType} · 학년값 「${cur.grade}」 · trieKey ${cur.trie}`);
  if (cur.tops > 1) log(`    (대단원이 섞여 있음 → 다수인 「${cur.top}」 기준: ${cur.mix})`);

  // 문항 이미지 내려받기 (한 번 받으면 캐시)
  const workDir = path.join(OUT_DIR, String(paperId));
  const imgDir = path.join(workDir, 'img');
  fs.mkdirSync(imgDir, { recursive: true });
  const recs = [];
  for (const c of cells) {
    const f = path.join(imgDir, `${String(c.questionNumber).padStart(3, '0')}.img`);
    if (!fs.existsSync(f)) {
      const grab = () => fetch(c.imagePath, { headers: { cookie: MS_CDN_COOKIE, origin: MS_ORIGIN, referer: MS_ORIGIN + '/' } });
      let r = await grab();
      /* CDN 서명 쿠키는 한 시간 남짓이면 만료된다 → cells 를 다시 불러 쿠키를 새로 받는다 */
      if (!r.ok) { await msCells(paperId); r = await grab(); }
      if (!r.ok) throw new Error(`문항 ${c.questionNumber} 이미지 ${r.status}`);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    }
    const buf = fs.readFileSync(f);
    recs.push({ no: c.questionNumber, file: f, type: pngSize(buf).type,
      answer: (c.answers || []).map((a) => a.answer).filter((x) => x != null).flat(),
      /* 자리 표시로 바뀔 때 «객관식인지»를 판단하는 근거 (매쓰플랫 OCR 대신 쓴다) */
      answerTypes: (c.answers || []).map((a) => String(a.type || '')) });
    if (recs.length % 50 === 0) log(`  이미지 ${recs.length}/${cells.length}`);
  }

  /* 지난번에 «크게 올려야» 읽혔거나 «자리 표시»로 채운 문항이 있으면 처음부터 그렇게 만든다
   * (--force 로 다시 올릴 때 실패할 것이 뻔한 1차 시도를 건너뛴다) */
  const hint = opt.hint || {};
  const hintSolo = (hint.solo || []).filter((no) => !(hint.placeholder || []).includes(no));
  const hintPh = opt.placeholder ? (hint.placeholder || []) : [];
  hintSolo.forEach((no) => { const r = recs.find((x) => x.no === no); if (r) r.solo = true; });
  hintPh.forEach((no) => { const r = recs.find((x) => x.no === no); if (r) { r.solo = false; r.placeholder = true; } });
  if (hintSolo.length || hintPh.length)
    log(`  지난 기록대로 ${hintSolo.length ? `${hintSolo.join(',')}번은 크게` : ''}${hintSolo.length && hintPh.length ? ' · ' : ''}${hintPh.length ? `${hintPh.join(',')}번은 자리 표시로` : ''} 시작합니다`);

  /* ── 나누기 계획 ──────────────────────────────────────────────
   * ① 통째로 100% → 10쪽 이하면 한 장
   * ② 통째로 85%  → 10쪽 이하면 한 장 (조금 줄여서 맞추기)
   * ③ 그래도 넘으면 150문항 이하로 나누고, 나눈 장도 10쪽을 넘으면 더 잘게 */
  let parts = null;
  for (const shrink of [1, 0.85]) {
    const pdf = await buildPdf(recs, shrink);
    if (pdf.pageCount <= MAX_PAGES) {
      parts = [{ tag: 'p1', recs, pdf, shrink }];
      if (shrink !== 1) log(`  쪽 수를 맞추려 이미지를 85%로 줄였습니다 (${pdf.pageCount}쪽)`);
      break;
    }
    log(`  통째로는 ${pdf.pageCount}쪽 (배율 ${shrink}) — 10쪽 넘음`);
  }
  if (!parts) {
    for (let k = Math.max(2, Math.ceil(recs.length / MAX_Q_PER_PART)); k <= 12; k++) {
      const size = Math.ceil(recs.length / k);
      if (size > MAX_Q_PER_PART) continue;
      const cand = [];
      let ok = true;
      for (let i = 0; i < k; i++) {
        const slice = recs.slice(i * size, (i + 1) * size);
        if (!slice.length) continue;
        const pdf = await buildPdf(slice, 1);
        if (pdf.pageCount > MAX_PAGES) { ok = false; break; }
        cand.push({ tag: `p${i + 1}`, recs: slice, pdf, shrink: 1 });
      }
      if (ok) { parts = cand; break; }
    }
    if (!parts) throw new Error('10쪽 안에 들어가게 나누지 못했습니다');
    log(`  ${parts.length}장으로 나눕니다`);
  }
  const titles = parts.map((p, i) => (parts.length === 1
    ? title
    : `${title} (${i + 1}/${parts.length}) ${p.recs[0].no}~${p.recs[p.recs.length - 1].no}`));
  parts.forEach((p, i) => log(`  · ${titles[i]} — ${p.recs.length}문항 ${p.pdf.pageCount}쪽`));

  if (opt.dry) {
    return { paperId, title, n: recs.length, dry: true, cur,
      parts: parts.map((p, i) => ({ title: titles[i], n: p.recs.length, pages: p.pdf.pageCount })) };
  }

  const made = { worksheetIds: [], paperIds: [] };
  try {
    const results = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      /* ── OCR 이 못 읽은 문항 되살리기 (번호 1:1이 최우선) ──────────────
       *   1차 그대로 → 2차 «그 문항만 한 쪽에 크게» → 3차 «자리 표시로 대체»
       * by-custom 은 job 단위라 문항 하나만 갈아끼울 수 없다 → 그 장을 통째로 다시 만든다. */
      const rebuild = async (why) => {
        for (const sh of [part.shrink || 1, 0.85, 0.72]) {
          const pdf = await buildPdf(part.recs, sh);
          if (pdf.pageCount <= MAX_PAGES) {
            part.pdf = pdf; part.shrink = sh;
            log(`  ↻ ${why} — 다시 만든 PDF ${pdf.pageCount}쪽${sh !== 1 ? ` (다른 문항은 ${Math.round(sh * 100)}%로 줄임)` : ''}`
              + (part.recs.some((r) => r.placeholder) ? (pdf.koFont ? ' · 자리 표시 한글' : ' · 자리 표시 영문(한글 글꼴 없음)') : ''));
            return true;
          }
        }
        log(`  ↻ ${why} — 그러나 10쪽 안에 들어가지 않습니다`);
        return false;
      };
      let r = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const before = made.paperIds.length;
        part.attempt = attempt;
        try { r = await runPart(part, cur, titles[i], workDir, made); break; }
        catch (e) {
          if (e.code !== 'OCR_FAILED_ITEMS' || attempt === 3) throw e;
          log(`  ↻ ${e.message.slice(0, 200)}`);
          await cleanup([], made.paperIds.splice(before));
          const idx = (e.badIdx || []).filter((k) => part.recs[k]);
          if (!idx.length) throw e;
          const nosOf = (a) => a.map((k) => part.recs[k].no).join(', ');
          /* 아직 크게 올려 보지 않은 문항 → ① 크게 / 크게 올렸는데도 실패한 문항 → ② 자리 표시 */
          const fresh = idx.filter((k) => !part.recs[k].solo);
          const stubborn = idx.filter((k) => part.recs[k].solo);
          const why = [];
          if (fresh.length) { fresh.forEach((k) => { part.recs[k].solo = true; }); why.push(`${nosOf(fresh)}번을 한 쪽에 크게 단독 배치`); }
          if (stubborn.length) {
            if (!opt.placeholder) { log('  ↻ --no-placeholder 라서 자리 표시로 대체하지 않습니다'); throw e; }
            stubborn.forEach((k) => { part.recs[k].solo = false; part.recs[k].placeholder = true; });
            why.push(`${nosOf(stubborn)}번을 자리 표시로 대체`);
          }
          let ok = await rebuild(why.join(' · '));
          if (!ok) {
            /* 쪽 수가 넘치면(크게 배치한 쪽이 늘어서) 전부 자리 표시로 — 자리 표시는 작다 */
            if (!opt.placeholder) throw e;
            idx.forEach((k) => { part.recs[k].solo = false; part.recs[k].placeholder = true; });
            ok = await rebuild(`${nosOf(idx)}번을 자리 표시로 대체`);
            if (!ok) throw e;
          }
          const phNow = part.recs.filter((r) => r.placeholder).map((r) => r.no);
          if (phNow.length) log(`  ⚠ ${phNow.join(', ')}번은 자리 표시로 들어갑니다 — 학생은 종이 프린트를 보고 풀고 답만 입력합니다(선생님 확인 문항)`);
        }
      }
      results.push(r);
    }
    const filed = await putInMylist(opt.mylist, made.worksheetIds);
    /* 자리 표시로 대체된 번호 — 기록으로 남겨 원장님이 그 번호만 직접 채점하실 수 있게 */
    const placeholders = [];
    results.forEach((x) => (x.placeholderCheck || []).forEach((c) => placeholders.push({ ...c, worksheetId: x.worksheetId })));
    if (placeholders.length) log(`  ⚠ 자리 표시 ${placeholders.length}문항: ${placeholders.map((c) => `${c.no}번`).join(', ')} — 프린트를 보고 풀고 답만 입력하는 문항입니다`);
    /* 다음 실행이 같은 헛수고를 하지 않도록 «까다로운 문항»을 기억해 둔다 */
    const hard = { solo: [], placeholder: [] };
    results.forEach((x) => { (x.soloNos || []).forEach((n) => hard.solo.push(n)); (x.placeholders || []).forEach((n) => hard.placeholder.push(n)); });
    return { paperId, title, n: recs.length, cur: { rev: cur.rev, trie: cur.trie, schoolType: cur.schoolType, grade: cur.grade },
      parts: results, worksheetIds: made.worksheetIds, paperIds: made.paperIds, filed, placeholders, hard, sec: ((Date.now() - t0) / 1000) | 0 };
  } catch (e) {
    log(`  ❌ 실패: ${e.message.slice(0, 400)}`);
    log('  만들다 만 것을 지웁니다 (반쪽짜리를 남기지 않기 위해)');
    await cleanup(made.worksheetIds, made.paperIds);
    throw e;
  }
}

/* ═══ 전체 ═══════════════════════════════════════════════════════ */
async function main() {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const opt = {
    folder: arg('folder', '매쓰플랫 올리기'),
    mylist: arg('mylist', '수학비서'),
    paper: Number(arg('paper', 0)) || 0,
    dry: args.includes('--dry'),
    force: args.includes('--force'),
    /* OCR 이 끝내 못 읽은 문항을 «자리 표시»로 채울지 (기본 켬 — 그래야 번호가 1:1) */
    placeholder: !args.includes('--no-placeholder') && arg('placeholder', 'on') !== 'off',
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  log(`수학비서 → 매쓰플랫${opt.dry ? ' (미리보기)' : ''} · 폴더 「${opt.folder}」 · 마이리스트 「${opt.mylist}」`
    + ` · 자리 표시 ${opt.placeholder ? '켬' : '끔'}`);

  await msLogin();
  log('수학비서 로그인 OK');
  const tree = (await msGet('/bms/api/v1/folders?folderType=mypaper')).data;
  const folder = findFolder(tree, opt.folder);
  if (!folder) throw new Error(`수학비서에 「${opt.folder}」 폴더가 없습니다`);
  const listRaw = (await msGet(`/bms/api/v1/my-papers?folderId=${folder.id}&needPaging=false`)).data;
  const list = Array.isArray(listRaw) ? listRaw : ((listRaw && (listRaw.myPapers || listRaw.content)) || []);
  log(`폴더 ${folder.id} · 문제지 ${list.length}개`);

  if (!opt.dry) { await mfLogin(); log('매쓰플랫 로그인 OK'); }

  const state = (await kvGet(STATE_KEY)) || { processed: {} };
  if (!state.processed) state.processed = {};

  const targets = opt.paper ? list.filter((p) => Number(p.id) === opt.paper) : list;
  if (opt.paper && !targets.length) throw new Error(`폴더에 문제지 ${opt.paper} 가 없습니다`);

  const done = [], failed = [], skipped = [];
  for (const p of targets) {
    const already = state.processed[String(p.id)];
    if (already && !opt.force) {
      log(`\n■ ${p.id} 「${p.title}」 — 이미 옮김(${already.at}, 학습지 ${(already.worksheetIds || []).join(',')}) → 건너뜀 (다시 하려면 --force)`);
      skipped.push({ paperId: p.id, title: p.title, at: already.at, worksheetIds: already.worksheetIds });
      continue;
    }
    try {
      /* 지난 실행에서 까다로웠던 문항 기억 (--force 재실행 때 1차 실패를 건너뛴다) */
      opt.hint = (already && already.hard) || null;
      const r = await runPaper(p.id, opt);
      if (!opt.dry) {
        state.processed[String(p.id)] = {
          at: new Date().toISOString(), title: r.title, n: r.n,
          worksheetIds: r.worksheetIds, paperIds: r.paperIds,
          parts: r.parts.map((x) => ({ title: x.title, n: x.n, range: x.range, worksheetId: x.worksheetId })),
          /* 자리 표시로 대체된 문항 (있을 때만) — 「이 번호는 프린트로 풀고 답만 입력」 */
          ...(r.placeholders && r.placeholders.length ? { placeholders: r.placeholders } : {}),
          /* 매쓰플랫이 잘 못 읽어 «크게/자리 표시»로 넣은 번호 — 다음 실행이 곧장 그렇게 만든다 */
          ...(r.hard && (r.hard.solo.length || r.hard.placeholder.length) ? { hard: r.hard } : {}),
        };
        await kvSet(STATE_KEY, state);
      }
      done.push(r);
    } catch (e) {
      log(`■ ${p.id} 「${p.title}」 실패 — ${e.message.slice(0, 400)}`);
      failed.push({ paperId: p.id, title: p.title, error: e.message.slice(0, 400) });
    }
  }

  log('\n═══ 결과 ═══');
  done.forEach((r) => {
    if (r.dry) { log(`· ${r.paperId} 「${r.title}」 ${r.n}문항 → ${r.parts.map((x) => `「${x.title}」 ${x.n}문항 ${x.pages}쪽`).join(' + ')}`); return; }
    r.parts.forEach((x) => {
      log(`· 학습지 ${x.worksheetId} 「${x.title}」 문항 ${x.problemCount}/${x.n} · 번호순서 ${x.orderOk ? '일치' : '불일치'} · 정답 ${x.withAnswer} · 자동채점 ${x.autoScored} · 매칭 ${x.matched}/${x.matchedTotal} · 재요청 ${x.reRequests}회 · ${x.sec}초`);
      if (x.soloNos && x.soloNos.length) log(`    (${x.soloNos.join(', ')}번은 매쓰플랫이 잘 못 읽어 «한 쪽에 크게» 넣었습니다)`);
      if (x.blankNos && x.blankNos.length) log(`    ⚠ 정답이 빈 문항: ${x.blankNos.join(', ')}번`);
    });
    log(`  (${r.paperId} 「${r.title}」 폴더 담김: ${r.filed && r.filed.ok ? '예' : '아니오'})`);
    if (r.placeholders && r.placeholders.length)
      log(`  ⚠ 자리 표시 문항 ${r.placeholders.length}개 — ${r.placeholders.map((c) => `${c.no}번(학습지 ${c.mfIndex}번, 정답 「${c.answer}」${c.autoScored ? ', 자동채점' : ''})`).join(' · ')}`);
  });
  skipped.forEach((s) => log(`· 건너뜀 ${s.paperId} 「${s.title}」 (이미 ${String(s.at).slice(0, 10)})`));
  failed.forEach((f) => log(`· ❌ ${f.paperId} 「${f.title}」 ${f.error}`));
  log(`성공 ${done.length} · 실패 ${failed.length} · 건너뜀 ${skipped.length}`);

  if (!opt.dry) {
    const lg = (await kvGet(LOG_KEY)) || { runs: [] };
    lg.runs = (lg.runs || []).concat([{ at: new Date().toISOString(), lines: LINES }]).slice(-KEEP_RUNS);
    await kvSet(LOG_KEY, lg);
  }
  return { done, failed, skipped };
}

module.exports = { main, decideCurriculum, toMfAnswer, TRIE_22_MID, TRIE_22_HIGH, TRIE_15_MID, TRIE_15_HIGH };

if (require.main === module) {
  main().catch((e) => { console.error('오류:', e.message); process.exit(1); });
}
