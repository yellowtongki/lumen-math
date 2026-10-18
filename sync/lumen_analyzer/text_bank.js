#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🔤 루멘 분석기 ① 글자 은행 — 문제 그림을 «한 번만» 글자로 옮겨 적어 두고 계속 쓴다 (docs/lumen_analyzer.md)
 * ═══════════════════════════════════════════════════════════════════
 * 원장 결정 2026-10-18: 서버(GitHub Actions)에서 Claude Sonnet 5.5 로 옮겨 적기 · 범위 = 이번 학기 · 소사고 고1 먼저 검증
 *
 * 저장 (lumen_store, 묶음마다 한 줄 — 수천 줄이 되지 않게)
 *   ptx_exam_<시험>   시험 문항        항목 키 exam:<시험>:<번호>
 *   ptx_mp_<문제지>   수학비서 내 문제지  mp:<문제지>:<번호>
 *   ptx_ms_<학습지>   수학비서 학습지    ms:<학습지>:<번호>
 *   ptx_tb_<교재>     교과서 은행       tb:<문항 id>   (출판사 교과서 pub:<id> 도 같은 문항)
 *   ptx_ws_<학습지>   매쓰플랫 학습지    ws:<문항 id>
 *   ptx_wb_<교재>     매쓰플랫 교재      wb:<문항 id>
 *   값 = { updated, model, items: { '<키>': { text, ask, choices:[…], fig, figNote, nums:[…], ocrAt, pid?, err? } } }
 *   키는 적중 분석 워커(sync/exam_hit_worker.js)의 자료 키와 같다.
 *
 * 실행
 *   node sync/lumen_analyzer/text_bank.js --exam 소사고_고1_2026_2_중간 --dry     몇 장을 옮겨 적을지 세기만 (AI 안 씀)
 *   node sync/lumen_analyzer/text_bank.js --exam 소사고_고1_2026_2_중간 [--limit 300]   빠진 것만 옮겨 적기 (이어 하기 됨)
 *        [--scope exam]   매쓰플랫 학습지·교재도 시험 범위 소단원만 (기본: 교과서만 시험 범위)
 *        [--no-pub]       출판사 교과서(다른 출판사 6~7종)는 빼기
 *        [--retry-err]    전에 실패한 것(err)도 다시
 *   node sync/lumen_analyzer/text_bank.js --semester [--from 2026-07-01] [--dry] [--limit N]
 *        이번 학기 모든 학생이 푼 매쓰플랫 학습지·교재 (밤마다 조금씩 늘려 갈 때)
 *
 * 환경변수: SUPABASE_URL · SUPABASE_SERVICE_KEY · ANTHROPIC_API_KEY · MATHFLAT_ID/PASSWORD (학습지·교재 그림 주소)
 * 규칙: 로그에 학생 이름·문항 글을 남기지 않는다(개수만). 공개 저장소다.
 * ═══════════════════════════════════════════════════════════════════ */
'use strict';
const W = require('../exam_hit_worker.js');
const M = require('./match.js');

const SB = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const OCR_MODELS = [process.env.OCR_MODEL || 'claude-sonnet-5-5', 'claude-sonnet-4-6'];   /* 원장 결정: Sonnet 5.5. 모델 이름이 없다고 나올 때만 다음 것 */
const MAX_IMG = 5 * 1024 * 1024;   // Claude 그림 한 장 한도
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sbH = (x) => Object.assign({ apikey: SK, authorization: 'Bearer ' + SK }, x || {});

/* ── 옮겨 적기 규칙 (숫자·기호를 늘 같은 모양으로 — 뼈대 비교가 잘 되게) ── */
const OCR_PROMPT = [
  '이 그림은 한국 중·고등학교 수학 문제 한 개다. 문제를 글자로 정확히 옮겨 적는다.',
  '규칙:',
  '- 원래 한국어 문장과 순서를 그대로 둔다. 고쳐 쓰거나 요약하지 않는다.',
  '- 문제 번호와 배점([4점] 등)은 적지 않는다.',
  '- 수식은 글 속에 그대로 적는다. LaTeX(역슬래시) 를 쓰지 않는다. 수식 안에는 띄어쓰기를 넣지 않는다.',
  '- 거듭제곱은 ^ (예: x^2, 2^(n+1)), 분수는 / 를 쓰고 분자·분모가 식이면 괄호로 감싼다 (예: (p+2)/3, 1/(x-1)).',
  '- 기호는 유니코드로: ∈ ∉ ∩ ∪ ⊂ ⊄ ≤ ≥ ≠ √ π ∞ × ÷ ± °. 여집합은 A^C, 원소의 개수는 n(A).',
  '- 집합은 {1,2,3} 또는 {x|x는 10 이하의 자연수} 처럼 쓴다.',
  '- 조건 (가)(나)(다), <보기> ㄱ.ㄴ.ㄷ. 은 원래 모양대로 본문(text)에 넣는다.',
  '- ask 에는 «무엇을 구하는지» 말하는 문장 하나를 그대로 옮긴다 (예: "집합 A-B의 모든 원소의 합의 최댓값은?").',
  '- choices 에는 ①~⑤ 보기의 내용만 순서대로 넣는다(동그라미 숫자는 빼고). 객관식이 아니면 빈 배열.',
  '- text 에는 보기(①~⑤)를 넣지 않는다.',
  '- 문제를 푸는 데 꼭 필요한 그림·그래프·표가 있으면 fig 를 true 로 하고, figNote 에 그 그림이 무엇인지 한 줄(예: "직각삼각형 ABC, 변 위의 점 D").',
  '- 글씨가 흐려 읽을 수 없는 곳은 ? 로 적는다.',
  '반드시 아래 JSON 하나만 답한다. 다른 글은 쓰지 않는다.',
  '{"text":"…","ask":"…","choices":["…"],"fig":false,"figNote":""}',
].join('\n');

/* ── Claude 호출 (적중 분석 워커와 같은 방식: fetch 그대로) ── */
let MODEL_I = 0, NO_EFFORT = false;
const USAGE = { in: 0, out: 0, calls: 0 };
async function ocrImage(buf) {
  const mime = W.mimeOf(buf) || 'image/png';
  if (!/^image\/(png|jpeg|gif|webp)$/.test(mime)) return { err: '그림 형식이 아님 ' + mime };
  if (buf.length > MAX_IMG) return { err: '그림이 너무 큼 ' + Math.round(buf.length / 1024) + 'KB' };
  const content = [{ type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } }, { type: 'text', text: OCR_PROMPT }];
  let last = '';
  for (let attempt = 0; attempt < 7; attempt++) {
    const body = { model: OCR_MODELS[MODEL_I], max_tokens: 1500, messages: [{ role: 'user', content }] };   /* thinking 은 보내지 않는다(기본 adaptive) · temperature 도 보내지 않는다 */
    if (!NO_EFFORT) body.output_config = { effort: 'low' };
    let r, d;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(120000),
        headers: { 'content-type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body) });
      d = await r.json().catch(() => null);
    } catch (e) { last = '연결 ' + String(e.message || e).slice(0, 80); await sleep(4000 * Math.pow(2, attempt)); continue; }
    if (r.ok && d && !d.error) {
      USAGE.calls++; if (d.usage) { USAGE.in += d.usage.input_tokens || 0; USAGE.out += d.usage.output_tokens || 0; }
      if (d.stop_reason === 'refusal') return { err: 'refusal' + (d.stop_details && d.stop_details.category ? ' ' + d.stop_details.category : '') };
      const txt = ((d.content || []).find((c) => c.type === 'text') || {}).text || '';
      const j = parseJson(txt);
      if (!j || typeof j.text !== 'string') { last = d.stop_reason === 'max_tokens' ? '답이 잘림' : '답을 읽지 못함'; if (attempt < 1) continue; return { err: last }; }
      return { ok: j, model: OCR_MODELS[MODEL_I] };
    }
    const msg = String((d && d.error && d.error.message) || (r && r.statusText) || '');
    const typ = String((d && d.error && d.error.type) || '');
    last = `Claude ${r.status} ${typ}`;
    if (r.status === 400 && /output_config|effort/i.test(msg) && !NO_EFFORT) { NO_EFFORT = true; log('effort 설정을 빼고 다시'); continue; }
    if ((r.status === 404 || /model/i.test(msg) && r.status === 400) && MODEL_I < OCR_MODELS.length - 1) { MODEL_I++; log(`모델 바꿈 → ${OCR_MODELS[MODEL_I]}`); continue; }
    if ([408, 429, 500, 502, 503, 504, 529].includes(r.status) || /overloaded|rate_limit/i.test(typ)) {
      const ra = Number(r.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, 5000 * Math.pow(2, attempt))); continue;
    }
    if (r.status === 401 || r.status === 403) throw new Error(last + ' — API 열쇠 확인 필요');
    return { err: last };
  }
  return { err: last || '여러 번 실패' };
}
function parseJson(t) {
  const s = String(t || '').replace(/^```(?:json)?\s*|\s*```$/g, '');
  const m = s.match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]); } catch (e) { try { return JSON.parse(m[0].replace(/\\(?!["\\/bfnrtu])/g, '\\\\')); } catch (e2) { return null; } }
}
function entryOf(res, pid) {
  const now = new Date().toISOString();
  if (!res.ok) return { text: '', ask: '', choices: [], fig: false, figNote: '', nums: [], ocrAt: now, err: String(res.err || '실패').slice(0, 80), ...(pid ? { pid } : {}) };
  const j = res.ok;
  const text = String(j.text || '').slice(0, 4000);
  return { text, ask: String(j.ask || '').slice(0, 400), choices: (Array.isArray(j.choices) ? j.choices : []).map((c) => String(c).slice(0, 200)).slice(0, 8),
    fig: !!j.fig, figNote: String(j.figNote || '').slice(0, 200), nums: M.numsOf(text), ocrAt: now, ...(pid ? { pid } : {}) };
}

/* ── 무엇을 옮겨 적을까 — 그 시험이 비교하는 모든 그림 ── */
let MF_READY = null;
async function mfReady() { if (!MF_READY) MF_READY = W.tw().mfLogin().then(() => true, (e) => { log('매쓰플랫 로그인 실패 — 학습지·교재 그림은 건너뜀'); return false; }); return MF_READY; }
function matTarget(m) {
  /* loadMaterials 의 자료(ws: 학습지 문항 · wb: 교재 문항) → 은행 대상 */
  const isWb = m.kind === 'book';
  const t = { k: m.k, kind: isWb ? 'wb' : 'ws', group: isWb ? 'wb_' + (m.bookId || 'x') : 'ws_' + (m.wsId || 'x'), cid: m.cid || null, level: m.level || null, mat: m,
    ids: isWb ? ['wbp:' + m.wbp] : (m.pid ? ['pid:' + m.pid] : []), pid: m.pid || null };
  t.resolve = async () => { if (!(await mfReady())) return ''; const u = await W.matImage(m); if (u && !t.pid) { t.pid = W.pidOfUrl(u); if (t.pid) t.ids.push('pid:' + t.pid); } return u; };
  t.fetchImage = async () => { const u = await t.resolve(); return u ? W.fetchBuf(u) : null; };
  return t;
}
async function collectTargets(examId, opt) {
  opt = opt || {};
  const d = await W.kvGet('exam_hit_' + examId);
  if (!d || !(d.items || []).length) throw new Error('exam_hit_' + examId + ' 가 없습니다');
  const exam = d.exam || {};
  const src = W.normSrc(d.src || null, exam);
  const out = []; const info = { examId, from: d.from, to: d.to, src, skipped: {} };
  const skip = (why) => { info.skipped[why] = (info.skipped[why] || 0) + 1; };
  /* 시험 문항 */
  d.items.forEach((it) => {
    if (!it.img) return skip('시험 문항 그림 없음');
    out.push({ k: `exam:${examId}:${it.no}`, kind: 'exam', group: 'exam_' + examId, no: it.no, cid: it.cid || null, level: it.level || null, ids: [], fetchImage: () => W.stGet(W.BUCKET, it.img) });
  });
  const U = await W.unitIndex();
  const units = W.examUnits(d.items, U);
  info.units = units.list; info.U = U;
  const inExam = (cid) => W.inScope(cid, U, units);
  /* 수학비서 내 문제지 · 학습지 */
  for (const [kind, ids, pre] of [['mp', src.mp, 'ms_mypaper_'], ['ms', src.ms, 'ms_paper_']]) {
    for (const id of ids) {
      if (kind === 'ms' && exam.mydb && String(id) === String(exam.mydb)) continue;   // 분석하는 시험지 자체
      const p = await W.kvGet(pre + id);
      if (!p || p.status !== 'ready') { skip(`${kind} 문제지 아직 인식 안 됨`); continue; }
      (p.items || []).forEach((it) => {
        if (!it.img) return skip(`${kind} 그림 없음`);
        out.push({ k: `${kind}:${id}:${it.no}`, kind, group: `${kind}_${id}`, paper: String(id), no: it.no, title: p.title || '', cid: it.cid || null, level: it.level || null,
          msChapter: it.msChapter || '', msTags: it.msTags || [], ids: [], fetchImage: () => W.stGet(W.BUCKET, it.img) });
      });
    }
  }
  /* 매쓰플랫 — 그 시험 학생들이 기간 안에 푼 학습지·교재 */
  if (src.mf) {
    const codes = (d.students && d.students.length) ? d.students.map(String) : await W.loadStudents(exam.school, exam.grade);
    const own = new RegExp(`${W.schoolKey(exam.school)}[^\\n]*${exam.year}[^\\n]*${exam.semester}학기[^\\n]*${exam.term}`);
    const mats = await W.loadMaterials(codes, d.from || W.semStart(exam.year, exam.semester), d.to || new Date().toISOString().slice(0, 10), own);
    mats.forEach((m) => {
      if (opt.scope === 'exam' && !inExam(m.cid)) return skip('매쓰플랫 시험 범위 밖');
      out.push(matTarget(m));
    });
    info.students = codes.length;
  }
  /* 교과서 은행 — 그 학교 교과서 + (켜져 있으면) 다른 출판사 교과서. 시험 범위 소단원만 */
  const bids = new Set();
  if (src.tb.on) (src.tb.bids.length ? src.tb.bids : await W.textbookBids(exam)).forEach((b) => bids.add(String(b)));
  const ownTb = new Set(bids);
  if (opt.pub !== false && src.pub && src.pub.on) {
    try { const pb = await W.pubBanks(W.pubSubject(exam), W.pubRev(exam)); pb.banks.forEach((b) => bids.add(String(b.bid))); } catch (e) { log('출판사 교과서 목록 실패:', e.message.slice(0, 80)); }
  }
  const haveWb = new Set(out.filter((t) => t.kind === 'wb').map((t) => t.ids[0]));
  for (const bid of bids) {
    const bank = await W.kvGet('mf_textbook_' + bid);
    if (!bank || !(bank.problems || []).length) { skip('교과서 은행 없음'); continue; }
    bank.problems.forEach((p) => {
      if (!p.pimg) return skip('교과서 문항 그림 없음');
      if (!inExam(p.cid)) return skip('교과서 시험 범위 밖');
      const pid = W.pidOfUrl(p.pimg);
      out.push({ k: 'tb:' + p.id, kind: 'tb', group: 'tb_' + bid, bid: String(bid), pubOnly: !ownTb.has(String(bid)), page: p.page, no: p.no, title: bank.title || '', img: p.pimg,
        cid: p.cid || null, level: p.level || null, pid, ids: ['wbp:' + p.id].concat(pid ? ['pid:' + pid] : []), dupWb: haveWb.has('wbp:' + p.id),
        fetchImage: () => W.fetchBuf(p.pimg) });
    });
  }
  /* 같은 키가 두 번 나오면 하나만 (출판사 은행과 학교 교과서가 같을 때 등) */
  const seen = new Set(); const uniq = out.filter((t) => { if (seen.has(t.k)) return false; seen.add(t.k); return true; });
  return { targets: uniq, info, data: d };
}
/* 이번 학기 모든 학생 (밤마다 늘려 가기) */
async function collectSemesterTargets(from, to) {
  let db = await W.kvGet('or_studentdb'); if (db && !Array.isArray(db)) db = db.students || Object.values(db);
  const codes = (db || []).filter((s) => s && !s.withdrawn && s.lumen_rec_code).map((s) => String(s.lumen_rec_code));
  const mats = await W.loadMaterials(codes, from, to || new Date().toISOString().slice(0, 10), null);
  return { targets: mats.map(matTarget), info: { students: codes.length, from, to } };
}

/* ── 은행 읽기 · 쓰기 ── */
async function loadBank(prefixes) {
  const bank = { groups: {}, byK: new Map(), byId: new Map() };
  for (const pre of prefixes || ['ptx_']) {
    for (let off = 0; off < 100000; off += 50) {
      const r = await fetch(`${SB}/rest/v1/lumen_store?key=like.${encodeURIComponent(pre)}*&select=key,value&order=key.asc&limit=50&offset=${off}`, { headers: sbH() });
      if (!r.ok) throw new Error('글자 은행 읽기 실패 ' + r.status);
      const rows = await r.json();
      rows.forEach((row) => { let v = row.value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } } if (v && v.items) addGroup(bank, row.key.replace(/^ptx_/, ''), v); });
      if (rows.length < 50) break;
    }
  }
  return bank;
}
function addGroup(bank, group, v) {
  bank.groups[group] = v;
  Object.entries(v.items || {}).forEach(([k, e]) => {
    bank.byK.set(k, { e, group });
    if (e && !e.err && e.text != null) { if (e.pid) bank.byId.set('pid:' + e.pid, { e, k }); const m = k.match(/^(?:tb|wb):(\d+)$/); if (m) bank.byId.set('wbp:' + m[1], { e, k }); }
  });
}
function bankGet(bank, t) {
  const h = bank.byK.get(t.k); if (h && !h.e.err) return h.e;
  for (const id of t.ids || []) { const x = bank.byId.get(id); if (x) return x.e; }
  return h ? h.e : null;
}
function putEntry(bank, group, k, e) {
  const g = bank.groups[group] = bank.groups[group] || { updated: '', model: '', items: {} };
  g.items[k] = e; bank.byK.set(k, { e, group });
  if (!e.err) { if (e.pid) bank.byId.set('pid:' + e.pid, { e, k }); const m = k.match(/^(?:tb|wb):(\d+)$/); if (m) bank.byId.set('wbp:' + m[1], { e, k }); }
}
async function saveGroups(bank, groups, dry) {
  for (const g of groups) {
    const v = bank.groups[g]; if (!v) continue;
    v.updated = new Date().toISOString();
    if (dry) continue;
    await W.kvSet('ptx_' + g, v);
  }
}

/* ── 빠진 것만 옮겨 적기 ── */
async function ensureBank(targets, opt) {
  opt = opt || {};
  const conc = opt.concurrency || 4, limit = opt.limit || Infinity, dry = !!opt.dry;
  const bank = opt.bank || await loadBank(['ptx_']);
  const st = { total: targets.length, have: 0, alias: 0, todo: 0, ocr: 0, err: 0, refusal: 0, noImage: 0, byKind: {}, byGroup: {} };
  const kindSt = (k) => (st.byKind[k] = st.byKind[k] || { total: 0, have: 0, alias: 0, todo: 0, done: 0, err: 0 });
  const grpSt = (g) => (st.byGroup[g] = st.byGroup[g] || { total: 0, have: 0, todo: 0 });
  const todo = [];
  for (const t of targets) {
    const ks = kindSt(t.kind), gs = grpSt(t.group); ks.total++; gs.total++;
    const own = bank.byK.get(t.k);
    if (own && (!own.e.err || !opt.retryErr)) { st.have++; ks.have++; gs.have++; continue; }
    const other = (t.ids || []).map((id) => bank.byId.get(id)).find(Boolean);
    if (other) { st.alias++; ks.alias++; gs.have++; if (!dry) putEntry(bank, t.group, t.k, { ...other.e, from: other.k }); continue; }
    todo.push(t); st.todo++; ks.todo++; gs.todo++;
  }
  /* 같은 문항이 두 자리에 있는 것(교과서 = 학생이 푼 교재 문항)은 한 번만 */
  const byId = new Map(); const queue = [];
  todo.forEach((t) => { const id = (t.ids || [])[0]; if (id && byId.has(id)) { byId.get(id).dups.push(t); return; } const q = { t, dups: [] }; if (id) byId.set(id, q); queue.push(q); });
  st.unique = queue.length;
  if (dry) { st.dryUnique = queue.length; return { stats: st, bank }; }
  if (!AI_KEY) throw new Error('ANTHROPIC_API_KEY 가 없습니다 (이 일은 GitHub Actions 에서 돌립니다)');
  const work = queue.slice(0, limit === Infinity ? queue.length : limit);
  st.planned = work.length;
  const dirty = new Set(); let done = 0, i = 0, lastSave = Date.now();
  const inflight = new Map();   // 그림 주소를 안 뒤에 알게 된 같은 문항(교재) 중복 막기
  async function one(q) {
    const t = q.t; let e;
    try {
      if (t.resolve) await t.resolve();
      const dupId = (t.ids || []).find((id) => bank.byId.has(id));
      if (dupId) { const x = bank.byId.get(dupId); e = { ...x.e, from: x.k }; st.alias++; }
      else {
        const pidKey = t.pid ? 'pid:' + t.pid : null;
        if (pidKey && inflight.has(pidKey)) { const x = await inflight.get(pidKey); e = { ...x, from: 'same-pid' }; st.alias++; }
        else {
          const p = (async () => {
            const buf = await t.fetchImage().catch(() => null);
            if (!buf) { st.noImage++; return entryOf({ err: '그림을 받지 못함' }, t.pid); }
            const res = await ocrImage(buf);
            if (res.err) { st.err++; if (/^refusal/.test(res.err)) st.refusal++; kindSt(t.kind).err++; }
            else { st.ocr++; kindSt(t.kind).done++; }
            const en = entryOf(res, t.pid); if (res.model) en.model = res.model; return en;
          })();
          if (pidKey) inflight.set(pidKey, p);
          e = await p;
        }
      }
    } catch (err) { if (/API 열쇠/.test(err.message)) throw err; e = entryOf({ err: String(err.message || err).slice(0, 80) }, t.pid); st.err++; }
    putEntry(bank, t.group, t.k, e); dirty.add(t.group);
    q.dups.forEach((d2) => { putEntry(bank, d2.group, d2.k, { ...e, from: t.k }); dirty.add(d2.group); });
    if (bank.groups[t.group]) bank.groups[t.group].model = e.model || bank.groups[t.group].model || OCR_MODELS[MODEL_I];
    done++;
    if (done % 25 === 0 || Date.now() - lastSave > 90000) {
      const gs = [...dirty]; dirty.clear(); lastSave = Date.now();
      await saveGroups(bank, gs, false);
      log(`옮겨 적기 ${done}/${work.length} · 성공 ${st.ocr} · 실패 ${st.err} · 토큰 입력 ${USAGE.in} 출력 ${USAGE.out}`);
    }
  }
  async function runner() { while (i < work.length) { const q = work[i++]; await one(q); } }
  await Promise.all(Array.from({ length: Math.min(conc, work.length) }, runner));
  /* 대상이 이미 다른 자리 글을 빌려 온(alias) 묶음도 저장 */
  targets.forEach((t) => { const h = bank.byK.get(t.k); if (h && h.e.from && h.group === t.group) dirty.add(t.group); });
  await saveGroups(bank, [...dirty], false);
  st.usage = { ...USAGE, model: OCR_MODELS[MODEL_I], usd: Math.round((USAGE.in * 2 + USAGE.out * 10) / 1e6 * 100) / 100 };
  return { stats: st, bank };
}

function printStats(st, label) {
  log(`${label}: 대상 ${st.total} · 이미 있음 ${st.have} · 같은 문항 글 빌림 ${st.alias} · 새로 옮겨 적을 것 ${st.todo} (서로 다른 그림 ${st.unique})`);
  Object.entries(st.byKind).forEach(([k, v]) => log(`  ${k.padEnd(4)} 대상 ${v.total} · 있음 ${v.have} · 빌림 ${v.alias} · 할 일 ${v.todo}${v.done || v.err ? ` · 끝 ${v.done} · 실패 ${v.err}` : ''}`));
  const gs = Object.entries(st.byGroup).filter(([, v]) => v.todo).sort((a, b) => b[1].todo - a[1].todo);
  log(`  할 일이 있는 묶음 ${gs.length}개 (많은 순 15개): ` + gs.slice(0, 15).map(([g, v]) => `${g.replace(/^exam_.*/, 'exam')} ${v.todo}`).join(' · '));
  if (st.usage) log(`  Claude ${st.usage.model}: 호출 ${st.usage.calls} · 입력 ${st.usage.in} · 출력 ${st.usage.out} 토큰 · 약 $${st.usage.usd}`);
}

module.exports = { OCR_PROMPT, ocrImage, parseJson, entryOf, collectTargets, collectSemesterTargets, loadBank, bankGet, putEntry, saveGroups, ensureBank, matTarget };

if (require.main === module) {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };
  const has = (n) => args.includes('--' + n);
  (async () => {
    const dry = has('dry'), limit = Number(arg('limit', 0)) || Infinity;
    let targets, label;
    if (has('semester')) {
      const r = await collectSemesterTargets(arg('from', '2026-07-01'), arg('to', '')); targets = r.targets; label = `이번 학기 (학생 ${r.info.students}명)`;
    } else {
      const examId = arg('exam', ''); if (!examId) throw new Error('--exam <시험 id> 가 필요합니다');
      const r = await collectTargets(examId, { scope: arg('scope', 'all'), pub: !has('no-pub') }); targets = r.targets; label = `시험 ${examId}`;
      log(`모으기: 학생 ${r.info.students || 0}명 · 시험 범위 소단원 ${r.info.units.length}개 · 뺀 것 ` + Object.entries(r.info.skipped).map(([k, v]) => `${k} ${v}`).join(' · '));
    }
    const { stats } = await ensureBank(targets, { dry, limit, concurrency: Number(arg('concurrency', 4)) || 4, retryErr: has('retry-err') });
    printStats(stats, (dry ? '[dry] ' : '') + label);
    if (dry) {
      const n = stats.unique; const lo = Math.round(n * (1100 * 2 + 150 * 10) / 1e6 * 100) / 100, hi = Math.round(n * (1500 * 2 + 250 * 10) / 1e6 * 100) / 100;
      log(`  예상 비용 (Sonnet 5.5, 그림 400~800 + 규칙 글 약 700 = 입력 1,100~1,500 토큰 · 출력 150~250): 약 $${lo} ~ $${hi}`);
    }
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}
