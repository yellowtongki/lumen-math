#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 * 🎙 녹음 숙제 새벽 읽기  v1   (원장 결정 2026-10-22~23 「안 A로 진행 · 소리는 비공개 유지」)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 【왜 만들었나】
 *   학생들이 밤에 올린 하브루타 녹음을 원장님이 아침에 하나하나 다 들을 수는 없다.
 *   새벽에 미리 받아쓰고(전문) «그날 주제대로 설명했는지»를 한 줄로 판정해 두면,
 *   원장님은 학원앱 녹음관리 › 👀 훑어보기에서 «주제가 다른 것»만 골라 들으면 된다.
 *   GitHub Actions 가 매일 05:10(KST) 돌린다 (울트라 초안 04:50 뒤).
 *   자료 모양은 docs/rec_review_contract.md §1-1 · §2 가 정한다 — 바꾸려면 계약서부터.
 *
 * 【무엇을 하나】
 *   ① 등록부(or_studentdb)에서 재원생(코드 있음 · 퇴원 아님)을 얻는다 — 등록부에는 절대 쓰지 않는다.
 *   ② 학생마다 Storage recordings/<코드>/ 목록 → 파일 이름의 YYYYMMDD(한국 날짜)가 [오늘-N일, 어제] 인 녹음만
 *   ③ 이미 rec_read_<날짜> 에 있는 파일은 건너뛴다 (--force 면 다시)
 *   ④ 내려받아 Gemini 로 받아쓰기 (원장님이 학원앱에서 손으로 받아쓴 글이 있으면 그 글을 쓴다 · sttSrc 'manual')
 *   ⑤ 그날 주제 찾기 — 학생앱과 같은 순서: 원장 수동 미션 → 학생별 주제 → 학년 주제 (7일 안 가장 가까운 지난 날짜) → 없으면 «자유 제출»
 *   ⑥ 판정 (글만 보냄): ok 주제대로 / part 일부 빠짐 / off 다른 내용 / short 30초 미만·말 없음(판정 안 함) / free 주제 없음(요약만)
 *   ⑦ 학생 한 명 끝날 때마다 rec_read_<날짜> 최신본을 읽어 합쳐 저장 — 중간에 끊겨도 한 것은 남는다
 *   ⑧ 날짜·학년마다 2건 이상이면 «여럿이 똑같이 헷갈린 것» 한 줄(brief)
 *   ⑨ rec_read_last 에 언제·몇 건·실패·토큰 합을 적는다 (학원앱 머리줄 「🌙 새벽 읽기 …」)
 *
 * 【필요한 비밀값】 SUPABASE_URL · SUPABASE_SERVICE_KEY · GEMINI_API_KEY (GitHub Secrets)
 *   모델: REC_MODEL (기본 gemini-2.5-flash-lite, 모델 오류면 gemini-2.5-flash 로 한 번 더). Claude 키는 쓰지 않는다.
 * 【사용법】
 *   node sync/rec_night_reader.js                    실제 읽기 (어제부터 3일)
 *   node sync/rec_night_reader.js --dry              무엇을 읽을지 건수만 (Gemini 안 씀 · 저장 안 함)
 *   node sync/rec_night_reader.js --days 7 --max 80
 *   node sync/rec_night_reader.js --date 2026-10-21 --force        그 날만, 이미 읽은 것도 다시
 *   node sync/rec_night_reader.js --codes A,B         그 학생들만
 * 【개인정보】 로그에는 날짜·건수·실패 수·토큰 합만 남긴다 (이름·코드·전문 없음). 공개 저장소라 Actions 로그가 공개된다.
 *   Node 22 내장 fetch 만 쓴다 (npm install 필요 없음).
 */

const MODEL_DEFAULT = 'gemini-2.5-flash-lite';
const MODEL_FALLBACK = 'gemini-2.5-flash';
const MAX_INLINE = 20 * 1024 * 1024;          // Gemini inline_data 한도 — 보내는 base64 크기 기준
const SHORT_SEC = 30;
const NO_SPEECH = '[녹음 내용 없음]';
const AUDIO_TOKENS_PER_SEC = 32;
const RETRY_STATUS = [429, 503, 529];
const MIME = { webm: 'audio/webm', m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mp3', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac' };

const log = (...a) => console.log('[녹음읽기]', ...a);
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 옵션 ── */
function parseArgs(argv) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !/^--/.test(argv[i + 1]) ? argv[i + 1] : d; };
  const date = arg('--date', '');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('--date 는 YYYY-MM-DD 모양이어야 합니다');
  const codes = arg('--codes', '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    dry: argv.includes('--dry'), force: argv.includes('--force'),
    days: Math.max(1, Number(arg('--days', 3)) || 3), max: Math.max(0, Number(arg('--max', 80)) || 0),
    date, codes,
  };
}

/* ── 날짜 (ultra_night_writer.js 와 같은 함수) ── */
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dot = (d) => d.replace(/-/g, '.');

/* 읽을 날짜들 (새 날짜부터): --date 면 그 날만, 아니면 [오늘-days, 어제] */
function datesInRange(today, days, only) {
  if (only) return [only];
  const out = []; for (let i = 1; i <= days; i++) out.push(addDays(today, -i));
  return out;
}

/* 학년 키 — ultra_night_writer.js gradeKey 와 같은 규칙 ('중학교 2학년' → '중2') */
function gradeKey(g) { const s = String(g || ''); const n = (s.match(/(\d)\s*학년/) || [])[1]; if (!n) return ''; return (/초등/.test(s) ? '초' : /고등/.test(s) ? '고' : '중') + n; }

/* 녹음 파일 이름 → { date:'YYYY-MM-DD', id:'YYYYMMDD_HHMM', ext, mime } (녹음이 아니면 null) */
function parseFile(name) {
  const m = String(name || '').match(/_(\d{4})(\d{2})(\d{2})_(\d{4})\.([A-Za-z0-9]+)$/);
  if (!m) return null;
  const ext = m[5].toLowerCase(); if (!MIME[ext]) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, id: `${m[1]}${m[2]}${m[3]}_${m[4]}`, ext, mime: MIME[ext] };
}

/* ── 그날 주제 (학생앱 rtBestTopic · renderHome 과 같은 우선순위) ── */
function bestTopic(map, iso) {
  if (!map) return null;
  for (let i = 0; i < 7; i++) { const k = dot(addDays(iso, -i)); if (map[k] && map[k].t) return map[k]; }
  return null;
}
function pickTopic(st, rt, iso, grade) {
  const mission = String((st && st.lumen_rec_mission) || '').trim();
  if (mission) return { topic: { t: mission, src: 'mission' }, hint: '' };
  rt = rt || {};
  const p = bestTopic((rt.byStudent || {})[st.lumen_rec_code], iso);
  if (p) return { topic: { t: String(p.t).trim(), src: 'student' }, hint: String(p.g || '').trim() };
  const g = grade ? bestTopic((rt.byGrade || {})[grade], iso) : null;
  if (g) return { topic: { t: String(g.t).trim(), src: 'grade' }, hint: String(g.g || '').trim() };
  return { topic: { t: '', src: 'free' }, hint: '' };
}

/* short 규칙: 30초 미만 · 전문이 비었거나 «[녹음 내용 없음]» → 판정 호출 안 함 */
function isShort(sec, stt) {
  const t = String(stt || '').trim();
  if (!t || t.indexOf(NO_SPEECH) >= 0) return true;
  return sec != null && sec < SHORT_SEC;
}

/* Gemini usageMetadata → { sec, audio, text } */
function usageOf(data) {
  const u = (data && data.usageMetadata) || {};
  const det = Array.isArray(u.promptTokensDetails) ? u.promptTokensDetails : [];
  const a = det.find((d) => d && String(d.modality).toUpperCase() === 'AUDIO');
  const audio = a && Number(a.tokenCount) > 0 ? Number(a.tokenCount) : 0;
  const text = Math.max(0, (Number(u.promptTokenCount) || 0) - audio) + (Number(u.candidatesTokenCount) || 0) + (Number(u.thoughtsTokenCount) || 0);
  return { sec: audio ? Math.round(audio / AUDIO_TOKENS_PER_SEC) : null, audio, text };
}

/* 판정 응답 JSON 한 줄 꺼내기 */
function parseJudge(txt, free) {
  const m = String(txt || '').match(/\{[\s\S]*\}/); if (!m) throw new Error('판정 JSON 없음');
  const o = JSON.parse(m[0]);
  const s = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
  if (free) return { summary: s(o.summary, 160), match: 'free', why: '', missing: '', err: s(o.err, 120) };
  const match = String(o.match || '').trim().toLowerCase();
  if (['ok', 'part', 'off'].indexOf(match) < 0) throw new Error('판정 값 이상');
  return { summary: s(o.summary, 160), match, why: s(o.why, 120), missing: match === 'part' ? s(o.missing, 80) : '', err: s(o.err, 120) };
}

/* rec_read_<날짜> 합치기: 최신본(latest) + 이번 학생의 새 항목·실패 */
function mergeDay(latest, date, model, code, newItems, newFails) {
  const v = (latest && typeof latest === 'object') ? latest : {};
  const out = { date, updated: new Date().toISOString(), model, items: Object.assign({}, v.items || {}), byGrade: Object.assign({}, v.byGrade || {}), fail: Object.assign({}, v.fail || {}) };
  if (newItems.length) {
    const byFile = {}; (out.items[code] || []).forEach((it) => { if (it && it.file) byFile[it.file] = it; });
    newItems.forEach((it) => { byFile[it.file] = it; });
    out.items[code] = Object.keys(byFile).sort().map((f) => byFile[f]);
  }
  const done = {}; newItems.forEach((it) => { done[it.file] = 1; });
  const f = (out.fail[code] || []).filter((x) => !done[x]);
  newFails.forEach((x) => { if (f.indexOf(x) < 0) f.push(x); });
  if (f.length) out.fail[code] = f; else delete out.fail[code];
  return out;
}

/* ── 지시문 ── */
const STT_PROMPT = '수학 학생이 개념을 말로 설명한 녹음입니다. 한국어로 들리는 대로 전사하세요. 수식은 글로 쓰세요(예: x의 제곱, 2분의 1). 말이 없거나 2~3마디뿐이면 "[녹음 내용 없음]"이라고만 답하세요. 전사한 글만 답하세요.';

function judgePrompt(topic, hint, title, stt) {
  return [
    '수학학원 학생이 그날 주제를 말로 설명한 녹음의 받아쓰기입니다. 판정만 JSON 한 줄로 답하세요.',
    '',
    `【그날 주제】 ${topic.t}`,
    hint ? `【말할 힌트】 ${hint}` : '',
    `【학생이 적은 제목】 ${title || '(없음)'}`,
    '【받아쓰기】',
    stt,
    '',
    '【판정 기준】',
    '- ok: 주제의 핵심을 자기 말로 설명했다',
    '- part: 주제를 다루지만 핵심 일부가 빠졌다 → missing 에 빠진 개념을 짧게',
    '- off: 주제와 다른 내용을 말했다',
    '- err: 수학적으로 틀리게 말한 곳만 한 줄. 없으면 빈 글. 말 더듬기·받아쓰기 오타는 틀린 것이 아니다',
    '- why: 판정 근거 한 줄(40자 안)',
    '- summary: 무엇을 설명했는지 학부모도 읽을 수 있는 중립 문장 2줄(합쳐 80자 안). 학생 이름을 쓰지 않는다',
    '답 모양: {"summary":"…","match":"ok|part|off","why":"…","missing":"…","err":"…"}',
  ].filter((x) => x !== '').join('\n');
}
function freePrompt(title, stt) {
  return [
    '수학학원 학생이 스스로 고른 내용을 말로 설명한 녹음의 받아쓰기입니다(정해진 주제 없음). JSON 한 줄로만 답하세요.',
    `【학생이 적은 제목】 ${title || '(없음)'}`,
    '【받아쓰기】',
    stt,
    '',
    '- summary: 무엇을 설명했는지 학부모도 읽을 수 있는 중립 문장 2줄(합쳐 80자 안). 학생 이름을 쓰지 않는다',
    '- err: 수학적으로 틀리게 말한 곳만 한 줄. 없으면 빈 글',
    '답 모양: {"summary":"…","err":"…"}',
  ].join('\n');
}
function briefPrompt(grade, rows) {
  return [
    `수학학원 ${grade} 학생 ${rows.length}명이 같은 날 낸 «개념 설명 녹음»의 판정 요약입니다 (이름 없음).`,
    ...rows.map((r, i) => `${i + 1}. 주제: ${r.topic || '자유'} · 판정 ${r.match}` + (r.missing ? ` · 빠진 것: ${r.missing}` : '') + (r.err ? ` · 틀린 말: ${r.err}` : '') + (r.summary ? ` · 요약: ${r.summary}` : '')),
    '',
    '두 명 이상이 똑같이 헷갈리거나 빠뜨린 개념이 있으면 원장님이 수업에서 짚을 수 있게 한 줄(80자 안)로 쓰세요.',
    '그런 것이 없으면 빈 글. 학생 이름·번호를 쓰지 않는다. JSON 한 줄로만: {"brief":"…"}',
  ].join('\n');
}

/* ══ 실행 ══════════════════════════════════════════════════════════════ */
async function run(opts) {
  opts = Object.assign({ dry: false, force: false, days: 3, max: 80, date: '', codes: [] }, opts || {});
  const SB_URL = (opts.sbUrl != null ? opts.sbUrl : (process.env.SUPABASE_URL || '')).replace(/\/$/, '');
  const SB_KEY = opts.sbKey != null ? opts.sbKey : (process.env.SUPABASE_SERVICE_KEY || '');
  const GKEY = opts.geminiKey != null ? opts.geminiKey : (process.env.GEMINI_API_KEY || '');
  const sleep = opts.sleep || realSleep;
  let MODEL = opts.model || process.env.REC_MODEL || MODEL_DEFAULT;
  let switched = false;

  if (!SB_URL || !SB_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY 가 필요합니다');
  if (!GKEY && !opts.dry) throw new Error('GEMINI_API_KEY 가 없습니다 — GitHub › Settings › Secrets and variables › Actions 에 넣어 주세요 (--dry 로 건수만 볼 수 있습니다)');

  const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });

  /* ── 서버 (ultra_night_writer.js 와 같은 kvGet/kvSet) ── */
  async function kvGet(key) {
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
    if (!r.ok) throw new Error('lumen_store 읽기 실패 ' + r.status);
    const j = await r.json();
    let v = (j[0] && j[0].value); if (v === undefined) return null;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* 문자열 그대로 */ } }
    return v;
  }
  async function kvSet(key, value) {
    if (key === 'or_studentdb') throw new Error('등록부에는 쓰지 않는다');
    const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
      method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
    });
    if (!r.ok) throw new Error('lumen_store 저장 실패 ' + r.status);
  }
  async function listRecs(code) {
    const r = await fetch(`${SB_URL}/storage/v1/object/list/recordings`, {
      method: 'POST', headers: sbH(),
      body: JSON.stringify({ prefix: code + '/', limit: 200, sortBy: { column: 'name', order: 'desc' } }),
    });
    if (!r.ok) throw new Error('목록 실패 ' + r.status);
    const j = await r.json();
    return Array.isArray(j) ? j.filter((f) => f && f.name && f.name !== '.emptyFolderPlaceholder') : [];
  }
  async function download(code, name) {
    const r = await fetch(`${SB_URL}/storage/v1/object/recordings/${encodeURIComponent(code)}/${encodeURIComponent(name)}`, { headers: { apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY } });
    if (!r.ok) throw new Error('내려받기 실패 ' + r.status);
    return Buffer.from(await r.arrayBuffer());
  }

  /* ── Gemini (학원앱 transcribeWithGemini 모양 — v1beta · 재시도 8·16·24·32초) ── */
  const tok = { audio: 0, text: 0, out: 0 };
  async function gemini(parts, cfg) {
    let lastErr = null;
    for (let attempt = 0; attempt <= 4; attempt++) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GKEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: Object.assign({ temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } }, cfg || {}) }),
      });
      const data = await r.json().catch(() => null);
      if (r.ok && data && !data.error) {
        const u = usageOf(data); tok.audio += u.audio; tok.text += u.text;
        tok.out += Number((data.usageMetadata || {}).candidatesTokenCount) || 0;
        const c = ((data.candidates || [])[0] || {}).content;
        return { text: c ? (c.parts || []).map((p) => p.text || '').join('').trim() : '', usage: u };
      }
      const msg = String((data && data.error && data.error.message) || r.statusText || '');
      lastErr = new Error('Gemini ' + r.status);
      if ((r.status === 404 || (r.status === 400 && /model/i.test(msg))) && !switched && MODEL !== MODEL_FALLBACK) {
        log('모델 바꿈 → ' + MODEL_FALLBACK); MODEL = MODEL_FALLBACK; switched = true; attempt--; continue;
      }
      if (RETRY_STATUS.indexOf(r.status) >= 0 && attempt < 4) { await sleep(8000 * (attempt + 1)); continue; }
      break;
    }
    throw lastErr;
  }

  /* ① 등록부 · 주제 · 수업 요일 */
  const today = opts.today || kstToday();
  const dates = datesInRange(today, opts.days, opts.date);
  const dbRaw = await kvGet('or_studentdb');
  const db = Array.isArray(dbRaw) ? dbRaw : [];
  const want = {}; opts.codes.forEach((c) => { want[c] = 1; });
  const students = db.filter((s) => s && s.lumen_rec_code && !s.withdrawn && (!opts.codes.length || want[String(s.lumen_rec_code)]));
  const rt = (await kvGet('rec_topics')) || {};

  /* 이미 읽은 것 */
  const have = {};
  for (const d of dates) have[d] = (await kvGet('rec_read_' + d)) || {};
  const inDates = {}; dates.forEach((d) => { inDates[d] = 1; });

  /* ② ③ 대상 고르기 */
  const jobs = []; let listErr = 0, skipped = 0;
  for (const s of students) {
    const code = String(s.lumen_rec_code);
    let files;
    try { files = await listRecs(code); } catch (e) { listErr++; continue; }
    files.forEach((f) => {
      const p = parseFile(f.name); if (!p || !inDates[p.date]) return;
      const done = ((have[p.date].items || {})[code] || []).some((it) => it && it.file === f.name);
      if (done && !opts.force) { skipped++; return; }
      jobs.push({ st: s, code, name: f.name, size: Number((f.metadata || {}).size) || 0, ...p });
    });
  }
  if (students.length && listErr === students.length) throw new Error('Storage 녹음 목록을 하나도 읽지 못했습니다');
  jobs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0) || (a.name < b.name ? -1 : 1));
  const todo = jobs.slice(0, opts.max);
  const perDate = {}; todo.forEach((j) => { perDate[j.date] = (perDate[j.date] || 0) + 1; });
  log(`재원생 ${students.length}명 · 날짜 ${dates.map((d) => d.slice(5)).join(',')} · 새 녹음 ${jobs.length}건 (이미 읽음 ${skipped}) · 이번에 ${todo.length}건`
    + (jobs.length > todo.length ? ` (${jobs.length - todo.length}건 이월)` : '') + (listErr ? ` · 목록 실패 ${listErr}명` : ''));
  if (opts.dry) {
    const manual = todo.filter((j) => ((j.st.lumen_recordings || {})[j.name] || {}).stt).length;
    log('  (미리보기) 날짜별', Object.keys(perDate).sort().map((d) => d.slice(5) + ' ' + perDate[d] + '건').join(' · ') || '없음', `· 손 받아쓰기 있음 ${manual}건`);
    return { dry: true, jobs: jobs.length, todo: todo.length, perDate, made: 0, fail: 0 };
  }

  /* ④~⑧ 학생마다 처리하고 바로 저장 */
  const byStu = {}; todo.forEach((j) => { (byStu[j.code] = byStu[j.code] || []).push(j); });
  let made = 0, failN = 0; const why = {}; const madeDate = {}; const touched = {};
  for (const code of Object.keys(byStu)) {
    const newBy = {}, failBy = {};
    const sub = (await kvGet('submissions_' + code).catch(() => null)) || [];
    for (const j of byStu[code]) {
      const grade = gradeKey(j.st.grade);
      const { topic, hint } = pickTopic(j.st, rt, j.date, grade);
      const manual = String(((j.st.lumen_recordings || {})[j.name] || {}).stt || '').trim();
      const subItem = Array.isArray(sub) ? sub.find((x) => x && x.id === j.id) : null;
      const title = String((subItem && subItem.title) || '').trim();
      const fail = (k) => { (failBy[j.date] = failBy[j.date] || []).push(j.name); failN++; why[k] = (why[k] || 0) + 1; };
      let stt = '', sec = null, sttSrc = 'gemini';
      if (manual) { stt = manual; sttSrc = 'manual'; }
      else {
        if (j.size && Math.ceil(j.size / 3) * 4 > MAX_INLINE) { fail('큰 파일'); continue; }
        let buf;
        try { buf = await download(code, j.name); } catch (e) { fail('내려받기'); continue; }
        const b64 = buf.toString('base64');
        if (b64.length > MAX_INLINE) { fail('큰 파일'); continue; }
        try {
          const g = await gemini([{ inline_data: { mime_type: j.mime, data: b64 } }, { text: STT_PROMPT }], { temperature: 0 });
          stt = g.text; sec = g.usage.sec;
        } catch (e) { fail('받아쓰기'); continue; }
      }
      const item = { file: j.name, code, grade, sec, topic, title, stt, sttSrc, summary: '', match: '', why: '', missing: '', err: '', at: new Date().toISOString() };
      if (isShort(sec, stt)) {
        Object.assign(item, { match: 'short', summary: '녹음이 짧거나 말소리가 거의 없습니다.', why: (sec != null && sec < SHORT_SEC) ? `${sec}초 녹음` : '말소리가 거의 없음' });
      } else {
        const free = topic.src === 'free';
        try {
          const g = await gemini([{ text: free ? freePrompt(title, stt) : judgePrompt(topic, hint, title, stt) }], { responseMimeType: 'application/json' });
          Object.assign(item, parseJudge(g.text, free));
        } catch (e) { fail('판정'); continue; }
      }
      (newBy[j.date] = newBy[j.date] || []).push(item); made++;
      madeDate[j.date] = (madeDate[j.date] || 0) + 1;
      (touched[j.date] = touched[j.date] || {})[grade] = 1;
    }
    /* 저장 직전 최신본을 다시 읽어 합친다 — 학원앱·다른 실행이 그사이 고쳤을 수 있다 */
    for (const d of Object.keys(Object.assign({}, newBy, failBy))) {
      const latest = await kvGet('rec_read_' + d);
      have[d] = mergeDay(latest, d, MODEL, code, newBy[d] || [], failBy[d] || []);
      await kvSet('rec_read_' + d, have[d]);
    }
  }

  /* ⑨ 날짜·학년 brief (그 학년에 새 항목이 생겼거나 --force · 아직 없을 때) */
  let briefs = 0;
  for (const d of dates) {
    const v = have[d]; if (!v || !v.items) continue;
    const rows = {};
    Object.keys(v.items).forEach((c) => (v.items[c] || []).forEach((it) => { if (it && it.grade) (rows[it.grade] = rows[it.grade] || []).push(it); }));
    const upd = {};
    for (const g of Object.keys(rows)) {
      const n = rows[g].length; const old = (v.byGrade || {})[g];
      if (n < 2) continue;
      if (old && old.n === n && !(touched[d] && touched[d][g]) && !opts.force) continue;
      const use = rows[g].filter((it) => it.match !== 'short').map((it) => ({ topic: it.topic && it.topic.t, match: it.match, missing: it.missing, err: it.err, summary: it.summary }));
      let brief = '';
      if (use.length >= 2) {
        try { const o = JSON.parse((String((await gemini([{ text: briefPrompt(g, use) }], { responseMimeType: 'application/json' })).text).match(/\{[\s\S]*\}/) || ['{}'])[0]); brief = String(o.brief || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
        catch (e) { why['brief'] = (why['brief'] || 0) + 1; continue; }
      }
      upd[g] = { n, brief }; briefs++;
    }
    if (Object.keys(upd).length) {
      const latest = (await kvGet('rec_read_' + d)) || v;
      latest.byGrade = Object.assign({}, latest.byGrade || {}, upd); latest.updated = new Date().toISOString();
      have[d] = latest; await kvSet('rec_read_' + d, latest);
    }
  }

  await kvSet('rec_read_last', { at: new Date().toISOString(), dates, made, fail: failN, tokens: { audio: tok.audio, text: tok.text }, model: MODEL });

  /* 로그 — 날짜·건수·실패·토큰만 */
  const usd = MODEL === MODEL_FALLBACK ? (tok.audio * 1.0 + (tok.text - tok.out) * 0.3 + tok.out * 2.5) / 1e6 : (tok.audio * 0.3 + (tok.text - tok.out) * 0.1 + tok.out * 0.4) / 1e6;
  log(`새로 읽음 ${made}건 · 실패 ${failN}건` + (failN ? ` (${Object.keys(why).filter((k) => k !== 'brief').map((k) => k + ' ' + why[k]).join(' · ')})` : '')
    + ` · 날짜별 ${Object.keys(madeDate).sort().map((d) => d.slice(5) + ' ' + madeDate[d] + '건').join(' · ') || '없음'} · 학년 요약 ${briefs}개` + (why.brief ? ` (요약 실패 ${why.brief})` : ''));
  log(`토큰 합 — 음성 ${tok.audio} · 글 ${tok.text} · 모델 ${MODEL} · 어림 ${Math.round(usd * 1400)}원`);
  return { made, fail: failN, why, briefs, tokens: tok, model: MODEL, jobs: jobs.length, todo: todo.length };
}

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error('❌', e.message); process.exit(1); }
  const res = await run(opts);
  /* 한 건도 못 읽었고 «큰 파일» 말고 다른 실패가 있으면 Actions 가 빨간불로 알리게 */
  if (!res.dry && res.made === 0 && res.fail - ((res.why || {})['큰 파일'] || 0) > 0) { console.error('❌ 한 건도 읽지 못했습니다 (실패 ' + res.fail + '건)'); process.exit(1); }
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { run, parseArgs, parseFile, datesInRange, bestTopic, pickTopic, isShort, usageOf, parseJudge, mergeDay, gradeKey, kstToday, addDays, dot };
