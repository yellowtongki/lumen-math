/**
 * 수학비서 → 매쓰플랫 주간테스트 자동 파이프라인 (v1, 2026-08-11)
 * ================================================================
 * 목표: 원장님이 수학비서 「지정폴더」에 시험지를 넣어두면, 새벽에
 *   ① 지정폴더 스캔 → 새 시험지 감지 (안정 단계)
 *   ② 시험지 PDF 확보 → 매쓰플랫 업로드 → AI 문항 인식 (실험 단계, --upload)
 *   ③ 수학비서 원본(문항수·정답)과 자동 대조 → 어긋난 것만 검수 대기로
 * 결과는 전부 Supabase lumen_store에 저장되어 학원앱 「🌙 새벽 자동 등록」 패널이 보여준다.
 *
 * lumen_store 키:
 *   msecr_folders      { updated, tree }                          — 폴더 트리 캐시(학원앱 폴더 선택 UI용)
 *   msecr_weekly_cfg   { folderId, folderName, folderPath }       — 지정폴더 (학원앱에서 변경)
 *   msecr_weekly_state { processed: {mydbId: {...}}, endpoints }  — 처리 이력 + 실측 성공 엔드포인트 기억
 *   msecr_weekly_queue { items: [...] }                           — 검수 대기/완료 큐 (학원앱 표시)
 *   msecr_weekly_log   { runs: [{at, lines}] }                    — 새벽 작업 로그 (최근 14회)
 *
 * 사용법:
 *   node sync/mathsecr_weekly_pipeline.js             # 스캔·큐 갱신만 (수학비서만 접속)
 *   node sync/mathsecr_weekly_pipeline.js --upload    # + 매쓰플랫 업로드·AI 인식 (새벽 전용)
 *
 * 환경변수: MATHSECR_ID/PASSWORD, SUPABASE_URL/SERVICE_KEY, (--upload 시) MATHFLAT_ID/PASSWORD
 * 규칙: 비밀번호·키는 환경변수만. 새벽 실행 권장(매쓰플랫 동시 로그인 시 기존 접속이 끊길 수 있음).
 *
 * [실험 단계 메모] 매쓰플랫 AI 인식 사슬은 프론트 코드에서 추출한 것:
 *   POST /jobs → jobId
 *   POST /matchers/presigned/paper-pdf?jobId= → {presignedUrl,url} → PUT PDF
 *   POST /async-jobs?jobId= {functionName:'/matchers/document-processing-flow', parameters:{paperDocumentUrl,pageImageQuality:'HIGH'}}
 *     → GET /async-jobs/{jobId} 폴링 → pageImageUrls
 *   POST /matchers/object-detection?jobId= {pageImageUrls} → 문항 경계(boxes)
 *   POST /v2/papers/by-custom {...pages, boxes} → 나의 DB 원본 생성
 * 응답 형태가 다를 수 있어 각 단계 원시 응답 일부를 큐 debug에 남긴다(다음 개선용).
 */

const MS_API = 'https://api.mathsecr.com';
const MS_ORIGIN = 'https://www.mathsecr.com';
const MF_API = process.env.MATHFLAT_API_BASE || 'https://api.mathflat.com';

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;
const sbHeaders = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' };

const args = process.argv.slice(2);
let DO_UPLOAD = args.includes('--upload') || process.env.MSECR_UPLOAD === '1';

const LOG_LINES = [];
function log(...a) {
  const t = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${t}]`, ...a);
  LOG_LINES.push(a.join(' '));
}
const snip = (x, n) => { try { return JSON.stringify(x).slice(0, n || 300); } catch (e) { return String(x).slice(0, n || 300); } };

// ── Supabase kv ──────────────────────────────────────────────
async function kvGet(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${key}&select=value`, { headers: sbHeaders });
  if (!r.ok) return null;
  const j = await r.json();
  return (j[0] && j[0].value) || null;
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbHeaders, prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) log(`⚠️ ${key} 저장 실패 ${r.status}`);
  return r.ok;
}

// ── 수학비서 ─────────────────────────────────────────────────
let MS_TOKEN = null;
function msHeaders() {
  return { accept: 'application/json', 'content-type': 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/', authorization: `Bearer ${MS_TOKEN}` };
}
async function msLogin() {
  const r = await fetch(`${MS_API}/mim/api/v1/identities/members/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json', origin: MS_ORIGIN, referer: MS_ORIGIN + '/' },
    body: JSON.stringify({ email: process.env.MATHSECR_ID.trim(), password: process.env.MATHSECR_PASSWORD.trim() }),
  });
  const j = await r.json().catch(() => null);
  const tok = j && (j.data ? j.data.accessToken : j.accessToken);
  if (!r.ok || !tok) throw new Error(`수학비서 로그인 실패 ${r.status}`);
  MS_TOKEN = tok;
}
async function msGet(p) {
  const r = await fetch(`${MS_API}${p}`, { headers: msHeaders() });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, ok: r.ok, j, t };
}

// 폴더 트리 (id/name/개수만 남겨 슬림하게)
function slimFolder(f) {
  if (!f) return null;
  return { id: f.id, name: f.name, fileCount: f.fileCount || 0, totalFileCount: f.totalFileCount || 0,
    children: (f.children || []).map(slimFolder).filter(Boolean) };
}
function findFolder(tree, pred, path) {
  if (!tree) return null;
  const here = (path || []).concat(tree.name);
  if (pred(tree)) return { node: tree, path: here };
  for (const c of (tree.children || [])) { const hit = findFolder(c, pred, here); if (hit) return hit; }
  return null;
}
function subtreeIds(node) {
  const out = [node.id];
  (node.children || []).forEach((c) => out.push(...subtreeIds(c)));
  return out;
}

// v2 (2026-08-12): 시험지 폴더는 「나의 DB(mydb)」가 아니라 「시험지(mypaper)」다.
//   원장님 확인 — 처음엔 mydb 트리(교육청·고등학교 등 자료 폴더)를 보여줘서 시험지 폴더가 없었다.
//   실측: /bms/api/v1/folders?folderType=mypaper → 작업공간(140개) 아래 「주간테스트」 폴더 존재.
//   시험지 목록: /bms/api/v1/my-papers?folderId=<id>&needPaging=false → [{id,title,category}]
//   시험지 상세: /bms/api/v1/my-papers/<id> → {folders[], title, category, ...}
const MS_FOLDER_TYPE = 'mypaper';
async function msListPapers(folderIds) {
  const out = [];
  for (const fid of folderIds) {
    const r = await msGet(`/bms/api/v1/my-papers?folderId=${fid}&needPaging=false`);
    if (!r.ok || !r.j) continue;
    const arr = r.j.data || r.j;
    if (Array.isArray(arr)) arr.forEach((p) => { if (p && p.id) out.push(Object.assign({ folderId: fid }, p)); });
  }
  return out;
}
async function msPaperDetail(id) {
  const r = await msGet(`/bms/api/v1/my-papers/${id}`);
  if (!r.ok || !r.j) return null;
  return r.j.data || r.j;
}

// 나의 DB 전체 목록 (커서 페이지네이션) — 참고용(문항 대조 재료)
async function msListMydbs() {
  const all = [];
  let cursor = '';
  for (let i = 0; i < 40; i++) {
    const q = `${MS_API}/bms/api/v1/mydbs?limit=100&searchMode=all${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r = await fetch(q, { headers: msHeaders() });
    if (!r.ok) break;
    const j = await r.json().catch(() => null);
    const d = (j && j.data) || j || {};
    const items = d.mydbs || d.content || d.items || (Array.isArray(d) ? d : []);
    all.push(...items);
    cursor = d.pagination && d.pagination.cursor;
    if (!cursor || !items.length) break;
  }
  return all;
}

// 문항 정보(정답·난이도) — 성공 엔드포인트를 state에 기억해 다음부터 바로 사용
async function msQuestions(mydbId, state) {
  const cands = state.endpoints && state.endpoints.questions
    ? [state.endpoints.questions.replace('{id}', mydbId)]
    : [`/bms/api/v1/mydbs/${mydbId}/questions`, `/bms/api/v1/indexes/${mydbId}/question-cells`, `/bms/api/v1/question-cells?indexId=${mydbId}`, `/bms/api/v1/mydbs/${mydbId}/question-cells`];
  for (const p of cands) {
    const r = await msGet(p);
    if (r.ok && r.j) {
      const d = r.j.data || r.j;
      const arr = Array.isArray(d) ? d : (d.questions || d.questionCells || d.cells || d.content || null);
      if (Array.isArray(arr) && arr.length) {
        if (!state.endpoints) state.endpoints = {};
        state.endpoints.questions = p.replace(String(mydbId), '{id}');
        return arr;
      }
    }
  }
  return null;
}

// PDF 확보 — 후보 엔드포인트 순회 (성공 방식 기억)
async function msPdf(mydb, state) {
  const id = mydb.id;
  const cands = state.endpoints && state.endpoints.pdf
    ? [state.endpoints.pdf.replace('{id}', id)]
    : [`/bms/api/v1/mydbs/${id}/file`, `/bms/api/v1/mydbs/${id}/download`, `/bms/api/v1/mydbs/${id}/pdf`, `/bms/api/v1/mydbs/${id}/presigned-url`, `/cms/api/v1/papers/${id}/pdf`];
  for (const p of cands) {
    try {
      const r = await fetch(`${MS_API}${p}`, { headers: msHeaders() });
      const ct = r.headers.get('content-type') || '';
      if (r.ok && ct.includes('pdf')) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length > 1000) { if (!state.endpoints) state.endpoints = {}; state.endpoints.pdf = p.replace(String(id), '{id}'); return { buf, via: p }; }
      }
      if (r.ok && ct.includes('json')) {
        const j = await r.json().catch(() => null);
        const d = (j && j.data) || j || {};
        const u = d.presignedUrl || d.url || d.downloadUrl || d.fileUrl;
        if (u) {
          const r2 = await fetch(u);
          if (r2.ok) {
            const buf = Buffer.from(await r2.arrayBuffer());
            if (buf.length > 1000) { if (!state.endpoints) state.endpoints = {}; state.endpoints.pdf = p.replace(String(id), '{id}'); return { buf, via: p }; }
          }
        }
      }
    } catch (e) {}
  }
  return null;
}

// ── 매쓰플랫 (실험 단계) ─────────────────────────────────────
let MF_TOKEN = null;
function mfHeaders() {
  return { 'content-type': 'application/json', accept: 'application/json, text/plain, */*',
    'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com',
    authorization: `Bearer ${MF_TOKEN}`, 'x-auth-token': MF_TOKEN,
    origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' };
}
async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB', 'x-freewheelin-host': 'mathflat.com', origin: 'https://teacher.mathflat.com', referer: 'https://teacher.mathflat.com/' },
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(), userType: 'TEACHER', serviceType: 'MATHFLAT' }),
  });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  MF_TOKEN = j.accessToken;
}
async function mfCall(method, p, body) {
  const r = await fetch(`${MF_API}${p}`, { method, headers: mfHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { status: r.status, ok: r.ok, j: j && j.data !== undefined ? j.data : j, raw: t };
}
async function mfPollJob(jobId, timeoutMs) {
  const until = Date.now() + (timeoutMs || 180000);
  while (Date.now() < until) {
    const r = await mfCall('GET', `/async-jobs/${jobId}`);
    const d = r.j || {};
    const st = d.status || d.state || '';
    if (/DONE|SUCCESS|COMPLETE/i.test(st)) return d;
    if (/FAIL|ERROR/i.test(st)) throw new Error(`async-job 실패: ${snip(d)}`);
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error('async-job 시간 초과');
}

// 매쓰플랫 업로드 + AI 인식 (실험) — 실패 시 어느 단계인지와 원시 응답을 남긴다
async function mfUploadAndRecognize(pdfBuf, title, item) {
  const dbg = item.debug = item.debug || {};
  // 1) jobId
  let r = await mfCall('POST', '/jobs');
  const jobId = (r.j && (r.j.jobId || r.j.id)) || (typeof r.j === 'string' ? r.j : null);
  dbg.job = snip(r.j, 160);
  if (!jobId) throw new Error(`1단계(jobId) 실패: ${snip(r.raw, 200)}`);
  // 2) presigned
  r = await mfCall('POST', `/matchers/presigned/paper-pdf?jobId=${encodeURIComponent(jobId)}`);
  const pres = r.j || {};
  dbg.presigned = snip(pres, 200);
  if (!pres.presignedUrl) throw new Error(`2단계(presigned) 실패: ${snip(r.raw, 200)}`);
  // 3) PDF PUT (인증 헤더 없이)
  const up = await fetch(pres.presignedUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdfBuf });
  if (!up.ok) throw new Error(`3단계(PDF 업로드) 실패: ${up.status}`);
  // 4) 페이지 이미지 생성 (async-jobs)
  r = await mfCall('POST', `/async-jobs?jobId=${encodeURIComponent(jobId)}`, {
    functionName: '/matchers/document-processing-flow',
    parameters: { paperDocumentUrl: pres.url, pageImageQuality: 'HIGH' },
  });
  dbg.docproc = snip(r.j, 200);
  if (!r.ok) throw new Error(`4단계(문서 처리 요청) 실패: ${snip(r.raw, 200)}`);
  const done = await mfPollJob(jobId);
  const pageImageUrls = done.pageImageUrls || (done.result && done.result.pageImageUrls) || null;
  dbg.docdone = snip(done, 300);
  if (!pageImageUrls || !pageImageUrls.length) throw new Error(`4단계(페이지 이미지) 실패: ${snip(done, 250)}`);
  // 5) 문항 경계 인식
  r = await mfCall('POST', `/matchers/object-detection?jobId=${encodeURIComponent(jobId)}`, { pageImageUrls });
  const det = r.j || {};
  dbg.detect = snip(det, 300);
  const boxesOnEachPage = det.boxes || det.boxesOnEachPage || (det.result && det.result.boxes) || null;
  if (!boxesOnEachPage) throw new Error(`5단계(문항 인식) 실패: ${snip(r.raw, 250)}`);
  const boxCount = [].concat(...boxesOnEachPage.map((p) => (Array.isArray(p) ? p : (p.boxes || [])))).length;
  return { jobId, pageImageUrls, boxesOnEachPage, boxCount, paperDocumentUrl: pres.url };
}

// ── 메인 ─────────────────────────────────────────────────────
async function runPipeline(opts) {
  if (opts && opts.upload) DO_UPLOAD = true;
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  if (!process.env.MATHSECR_ID || !process.env.MATHSECR_PASSWORD) { console.error('❌ MATHSECR_ID / MATHSECR_PASSWORD 필요'); process.exit(1); }

  log('🌙 수학비서 주간테스트 파이프라인 시작' + (DO_UPLOAD ? ' (업로드 포함)' : ' (스캔만)'));
  await msLogin();
  log('수학비서 로그인 성공');

  // 1) 폴더 트리 캐시
  const fr = await msGet(`/bms/api/v1/folders?folderType=${MS_FOLDER_TYPE}`);
  const tree = fr.j && (fr.j.data || fr.j);
  if (tree && tree.id) {
    await kvSet('msecr_folders', { updated: new Date().toISOString(), tree: slimFolder(tree) });
    log(`폴더 트리 캐시 갱신 (최상위: ${tree.name}, 총 ${tree.totalFileCount || '?'}개)`);
  }

  // 2) 지정폴더 결정
  let cfg = await kvGet('msecr_weekly_cfg');
  // v2: 저장된 지정폴더가 지금 트리(시험지)에 없으면 버리고 다시 찾는다.
  //   («나의 DB» 트리에서 고른 옛 폴더 id가 남아 시험지가 0개로 잡히던 문제)
  if (cfg && cfg.folderId && tree) {
    const still = findFolder(tree, (f) => f.id === cfg.folderId);
    if (!still) {
      log(`지정폴더(id ${cfg.folderId} · ${cfg.folderName || ''})가 시험지 폴더에 없습니다 → 다시 찾습니다`);
      cfg = null;
    }
  }
  if ((!cfg || !cfg.folderId) && tree) {
    const hit = findFolder(tree, (f) => /주간테스트/.test(f.name || ''));
    if (hit) {
      cfg = { folderId: hit.node.id, folderName: hit.node.name, folderPath: hit.path.join(' › ') };
      await kvSet('msecr_weekly_cfg', cfg);
      log(`지정폴더 자동 설정: ${cfg.folderPath}`);
    }
  }
  if (!cfg || !cfg.folderId) {
    log('⚠️ 지정폴더가 없습니다 — 수학비서 「시험지」에 「주간테스트」 폴더를 만들어 주세요. (또는 학원앱에서 폴더 선택)');
    await flushLog();
    return;
  }
  log(`지정폴더: ${cfg.folderPath || cfg.folderName} (id ${cfg.folderId})`);

  // 3) 지정폴더(하위 포함)의 시험지 스캔
  const state = (await kvGet('msecr_weekly_state')) || { processed: {} };
  const queueDoc = (await kvGet('msecr_weekly_queue')) || { items: [] };
  const folderNode = tree ? findFolder(tree, (f) => f.id === cfg.folderId) : null;
  const idSet = new Set(folderNode ? subtreeIds(folderNode.node) : [cfg.folderId]);
  const inFolder = await msListPapers(Array.from(idSet));
  const fresh = inFolder.filter((m) => !state.processed[m.id]);
  log(`폴더 내 시험지 ${inFolder.length}개 · 새 시험지 ${fresh.length}개`);

  for (const m of fresh) {
    const det = await msPaperDetail(m.id) || {};
    const item = {
      mydbId: m.id, title: m.title || det.title || '', qCount: det.questionCount || m.questionCount || null,
      category: m.category || det.category || null,
      difficultyCount: det.difficultyCount || null, scopes: det.scopes || [],
      hasAnswer: !!(det.isAnswer || det.hasAnswer), detectedAt: new Date().toISOString(),
      status: 'new', mismatches: [], debug: {},
    };
    log(`새 시험지: 「${item.title}」 (${item.qCount || '?'}문항)`);

    // 원본 문항 정보(정답 등)
    try {
      const qs = await msQuestions(m.id, state);
      if (qs) {
        item.answers = qs.slice(0, 200).map((q, i) => ({
          no: q.number || q.questionNumber || q.seq || (i + 1),
          answer: q.answer || q.answerValue || (q.answerData && q.answerData.value) || null,
          difficulty: q.difficulty || null,
        }));
        log(`원본 문항 정보 ${qs.length}개 확보`);
      } else log('원본 문항 정보 조회 실패(치명적 아님) — 문항수 대조만 수행');
    } catch (e) { log('문항 정보 오류:', e.message); }

    if (DO_UPLOAD) {
      try {
        if (!process.env.MATHFLAT_ID) throw new Error('MATHFLAT_ID 없음');
        if (!MF_TOKEN) { await mfLogin(); log('매쓰플랫 로그인 성공'); }
        const pdf = await msPdf(m, state);
        if (!pdf) { item.status = 'error'; item.error = 'PDF 확보 실패 — 다운로드 엔드포인트 후보 전부 실패 (다음 개선 예정)'; }
        else {
          log(`PDF 확보 (${Math.round(pdf.buf.length / 1024)}KB, ${pdf.via})`);
          const rec = await mfUploadAndRecognize(pdf.buf, m.title, item);
          item.mfJobId = rec.jobId;
          item.recognized = { pages: rec.pageImageUrls.length, boxes: rec.boxCount };
          log(`AI 인식: ${rec.pageImageUrls.length}쪽 · 문항 후보 ${rec.boxCount}개`);
          // 대조 1차: 문항 수
          if (item.qCount && rec.boxCount !== item.qCount) {
            item.mismatches.push({ kind: 'count', msg: `문항 수 불일치 — AI 인식 ${rec.boxCount}개 vs 원본 ${item.qCount}개` });
          }
          item.status = item.mismatches.length ? 'needs-review' : 'recognized';
          // 학습지 생성(by-custom)은 pages/boxes 상세 스키마 확인 후 다음 단계에서 —
          // 우선 인식 결과와 jobId를 남겨 아침 검수 화면에서 확인 가능하게 한다.
        }
      } catch (e) {
        item.status = 'error';
        item.error = String(e.message || e).slice(0, 300);
        log(`업로드/인식 실패: ${item.error}`);
      }
    }

    state.processed[m.id] = { status: item.status, at: item.detectedAt, title: m.title };
    queueDoc.items.unshift(item);
  }

  // 큐 정리 (최근 30건, debug는 실패 항목만 유지)
  queueDoc.items = queueDoc.items.slice(0, 30);
  queueDoc.items.forEach((it) => { if (it.status !== 'error' && it.debug) delete it.debug; if (it.answers && it.answers.length > 60) it.answers = it.answers.slice(0, 60); });
  queueDoc.updated = new Date().toISOString();
  await kvSet('msecr_weekly_queue', queueDoc);
  await kvSet('msecr_weekly_state', state);
  log(`완료 — 큐 ${queueDoc.items.length}건 저장`);
  await flushLog();
}

async function flushLog() {
  try {
    const doc = (await kvGet('msecr_weekly_log')) || { runs: [] };
    doc.runs.unshift({ at: new Date().toISOString(), upload: DO_UPLOAD, lines: LOG_LINES.slice(0, 60) });
    doc.runs = doc.runs.slice(0, 14);
    await kvSet('msecr_weekly_log', doc);
  } catch (e) {}
}

if (require.main === module) {
  runPipeline().catch(async (e) => { log('❌ 파이프라인 오류:', e.message); await flushLog(); process.exit(1); });
}
module.exports = { runPipeline };
