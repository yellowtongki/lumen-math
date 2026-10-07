#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 * 🌙 울트라 초안 · 녹음 주제 새벽 작성기  v1   (원장 결정 2026-10-02 「B로 진행」)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * 【왜 만들었나】
 *   매일 새벽 4시 Routine(Claude 세션)이 9/30부터 자동 안전 검사에 막혀
 *   울트라 초안·녹음 주제를 하나도 남기지 못했다. 이 스크립트는 판단 없이
 *   «같은 일을 같은 방식으로» 한다 — GitHub Actions 가 매일 04:50(KST) 돌린다.
 *   (매쓰플랫 수집은 04:00 mathflat-collect, 플래너 채점은 04:25 planner-night 가 맡는다)
 *
 * 【무엇을 하나】  예전 Routine 2단계·2.6단계와 같은 규칙
 *   ① 울트라 초안 — 최근 7일(오늘 제외) 중 «학습지를 풀었는데 초안이 없는 (날짜, 학생)»만 채운다.
 *      · 원장님 설정 프롬프트(or_prompt)가 최우선 지침. 없으면 기본 지침.
 *      · 첫 3줄 고정: 인사 / {호칭}의 {일일테스트|주간테스트} 결과 / {점수}점
 *      · 그 날짜 자료만 쓴다(날짜 섞임 사고 방지). 플래너·숙제 언급 금지(원장 지시 2026-09-12).
 *      · 숙제(HOMEWORK)·입학테스트(ENTRANCE_TEST)·원장님이 🗑로 뺀 학습지는 제외(학원앱 울트라와 같은 규칙).
 *      · 다 쓴 뒤 첫 점수를 실제 점수와 검산해 다르면 한 번 더 쓰고, 그래도 다르면 버린다.
 *      · 저장은 ultra_drafts.byDate 누적(덮어쓰기 금지) · 14일 지난 날짜 정리 · ultra_last 기록.
 *   ② 녹음 주제 — 오늘 수업하는 반의 학년별 주제(byGrade)와, 최근 7일 오답이 있는 학생별 주제(byStudent).
 *      이미 있는 날짜는 건드리지 않는다(원장님이 고친 것일 수 있다). 21일 지난 날짜 정리.
 *
 * 【필요한 비밀값】 SUPABASE_URL · SUPABASE_SERVICE_KEY · ANTHROPIC_API_KEY (GitHub Secrets)
 * 【사용법】
 *   node sync/ultra_night_writer.js              실제 작성
 *   node sync/ultra_night_writer.js --dry        무엇을 쓸지 목록만 (API 안 씀 · 저장 안 함)
 *   node sync/ultra_night_writer.js --days 3 --max 40 --only drafts|topics
 * 【개인정보】 로그에는 날짜·인원수만 남긴다(이름·점수·글 내용 없음). 공개 저장소라 Actions 로그가 공개된다.
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const MODEL = process.env.ULTRA_MODEL || 'claude-sonnet-4-6';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const DAYS = Number(arg('--days', 7));
const MAX = Number(arg('--max', 60));
const ONLY = arg('--only', '');

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const log = (...a) => console.log('[새벽작성]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 서버 ── */
async function kvGet(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  if (!r.ok) throw new Error(key + ' 읽기 실패 ' + r.status);
  const j = await r.json();
  let v = (j[0] && j[0].value); if (v === undefined) return null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { /* 문자열 그대로 (or_prompt) */ } }
  return v;
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(key + ' 저장 실패 ' + r.status);
}
async function sbAll(path) {
  const out = []; const step = 1000;
  for (let from = 0; from < 200000; from += step) {
    const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: { ...sbH(), Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items' } });
    if (!r.ok) throw new Error(path.split('?')[0] + ' 읽기 실패 ' + r.status);
    const j = await r.json(); out.push(...j); if (j.length < step) break;
  }
  return out;
}

/* ── 날짜 (저장된 score_datetime 은 이미 한국시간이다 — 학원앱 울트라와 같은 기준) ── */
const kstToday = () => new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const dot = (d) => d.replace(/-/g, '.');

/* ── 호칭: 성 빼고, 받침 있으면 「이」 ── */
function callName(full) {
  const n = String(full || '').trim(); if (!n) return '';
  const given = n.length >= 3 ? n.slice(1) : (n.length === 2 ? n.slice(1) : n);
  const last = given.charCodeAt(given.length - 1);
  const hasBatchim = last >= 0xAC00 && last <= 0xD7A3 && ((last - 0xAC00) % 28) !== 0;
  return hasBatchim ? given + '이' : given;
}

/* ── Claude ── */
async function askClaude(prompt, maxTokens) {
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1500, temperature: 0.5, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await r.json().catch(() => null);
    if (r.ok && data && !data.error) return ((data.content || [])[0] || {}).text || '';
    lastErr = new Error('Claude ' + r.status + ': ' + ((data && data.error && data.error.message) || r.statusText));
    if ([429, 500, 503, 529].includes(r.status) && attempt < 3) { await sleep(8000 * Math.pow(2, attempt)); continue; }
    break;
  }
  throw lastErr;
}

/* ══ ① 울트라 초안 ══════════════════════════════════════════════════════ */
const DEFAULT_GUIDE = '~합니다체로 3~4문단, 600~800자. 칭찬 → 보완점 → 지도 계획 순서. 이모지 금지. 보고서체(「~것으로 보입니다」)와 학술어 금지.';

/* 그날 학생별 학습지 묶기 — 학원앱 울트라(udLoad)와 같은 규칙 */
function groupDay(recs, tags, excl) {
  const byStu = {};
  recs.forEach((x) => {
    if (x.mf_student_id == null || !x.worksheet_id) return;
    const tg = tags[x.worksheet_id];
    if ((tg && (tg.tag === 'HOMEWORK' || tg.tag === 'ENTRANCE_TEST')) || x.worksheet_type === 'ENTRANCE') return;
    if (excl[x.mf_student_id + ':' + x.worksheet_id]) return;
    const S = byStu[x.mf_student_id] = byStu[x.mf_student_id] || {};
    const k = x.student_worksheet_id || ('w' + x.worksheet_id);
    const T = S[k] = S[k] || { wid: x.worksheet_id, title: x.worksheet_title || '', type: x.worksheet_type || '', score: null, correct: 0, total: 0, wrong: {}, corr: {}, lastAt: '' };
    T.total++;
    if (x.result === 'O') { T.correct++; if (x.concept_id != null) T.corr[x.concept_id] = 1; }
    else if (x.result === 'X' && x.concept_id != null) T.wrong[x.concept_id] = (T.wrong[x.concept_id] || 0) + 1;
    if (x.score != null) T.score = x.score;
    if ((x.score_datetime || '') > T.lastAt) T.lastAt = x.score_datetime || '';
  });
  /* 같은 학습지가 두 번 수집되면 최신 채점본만 */
  Object.keys(byStu).forEach((sid) => {
    const byWid = {};
    Object.keys(byStu[sid]).forEach((k) => {
      const T = byStu[sid][k], prev = byWid[T.wid];
      if (!prev) { byWid[T.wid] = k; return; }
      const keep = byStu[sid][prev].lastAt >= T.lastAt ? prev : k;
      delete byStu[sid][keep === prev ? k : prev]; byWid[T.wid] = keep;
    });
  });
  const out = {};
  Object.keys(byStu).forEach((sid) => {
    const tests = Object.values(byStu[sid]).sort((a, b) => b.total - a.total);
    tests.forEach((t) => { if (t.score == null && t.total) t.score = Math.round(t.correct / t.total * 100); });
    if (tests.length) out[sid] = tests;
  });
  return out;
}

function draftPrompt(guide, day, name, tests, cname) {
  const main = tests[0];
  const kind = main.type === 'WEEKLY' ? '주간테스트' : '일일테스트';
  const lines = tests.map((t, i) => {
    const wrong = Object.keys(t.wrong).map((c) => (cname[c] && cname[c].n) || '').filter(Boolean).slice(0, 6);
    const good = Object.keys(t.corr).filter((c) => !t.wrong[c]).map((c) => (cname[c] && cname[c].n) || '').filter(Boolean).slice(0, 6);
    return `${i + 1}. 「${t.title}」(${t.type === 'WEEKLY' ? '전국 주간테스트' : '일일테스트'}) ${t.score}점 · ${t.correct}/${t.total}문항`
      + (wrong.length ? ` · 틀린 유형: ${wrong.join(', ')}` : ' · 틀린 문항 없음')
      + (good.length ? ` · 잘한 유형: ${good.join(', ')}` : '');
  });
  return [
    '당신은 수학학원 「루멘수학」 원장입니다. 학부모께 보낼 그날 시험 피드백 글을 씁니다.',
    '',
    '【원장님 지침 — 최우선으로 그대로 지킬 것】',
    guide,
    '',
    `【이 글의 자료 — ${dot(day)} 하루치만. 다른 날 내용은 절대 쓰지 말 것】`,
    `학생 호칭: ${callName(name)}`,
    ...lines,
    '',
    '【반드시 지킬 형식】',
    '첫 3줄은 각각 한 줄씩:',
    '안녕하세요. 루멘수학입니다.',
    `${callName(name)}의 ${kind} 결과를 말씀드립니다.`,
    `${main.score}점`,
    '그 뒤 본문 문단들은 빈 줄로 구분합니다.',
    `· 셋째 줄 점수는 반드시 ${main.score}점 (가장 문항이 많은 학습지).`,
    '· 「플래너」「숙제」라는 낱말을 쓰지 마세요.',
    '· 학생 이름은 위 호칭만 씁니다. 성을 붙이지 마세요.',
    '· 글만 답하세요. 설명·머리말·따옴표 없이.',
  ].join('\n');
}

function firstScore(text) { const m = String(text || '').match(/\d{1,3}(?=점)/); return m ? Number(m[0]) : null; }
function draftOk(text, score) {
  const t = String(text || '').trim();
  if (!/^안녕하세요\. 루멘수학입니다\./.test(t)) return '인사 줄 없음';
  const f = firstScore(t); if (f == null || Math.abs(f - score) > 2) return '첫 점수 불일치';
  if (/플래너|숙제/.test(t)) return '플래너·숙제 언급';
  if (t.length < 250) return '너무 짧음';
  return '';
}

async function runDrafts(ctx) {
  const cfg = (await kvGet('ultra_config')) || {};
  if (cfg && cfg.auto === false) { log('울트라 자동 초안이 꺼져 있습니다 (ultra_config.auto=false) — 건너뜀'); return { made: 0, skipped: 'off' }; }
  let guide = await kvGet('or_prompt');
  guide = (typeof guide === 'string' ? guide : (guide && (guide.text || guide.prompt)) || '').trim();
  log('설정 프롬프트(or_prompt)', guide ? `적용됨 (${guide.length}자)` : '없음 → 기본 지침');
  if (!guide) guide = DEFAULT_GUIDE;

  const tagsV = (await kvGet('mf_ws_tags')) || {}; const tags = tagsV.tags || {};
  const exV = (await kvGet('ultra_excluded')) || {}; const excl = {}; (exV.keys || []).forEach((k) => { excl[k] = 1; });
  const cname = (await kvGet('mf_concept_names')) || {};
  let drafts = (await kvGet('ultra_drafts')) || {};
  if (!drafts.byDate) { const old = drafts; drafts = { byDate: {} }; if (old && old.date && old.items) drafts.byDate[old.date] = { items: old.items }; }

  const today = kstToday(), from = addDays(today, -DAYS);
  const recs = await sbAll(`mf_answer_records?select=mf_student_id,student_worksheet_id,worksheet_id,worksheet_title,worksheet_type,score,result,concept_id,score_datetime&source=eq.${encodeURIComponent('학습지')}&score_datetime=gte.${from}T00:00:00&score_datetime=lt.${today}T00:00:00`);
  const byDay = {}; recs.forEach((x) => { const d = String(x.score_datetime || '').slice(0, 10); if (d) (byDay[d] = byDay[d] || []).push(x); });

  const jobs = [];
  Object.keys(byDay).sort().reverse().forEach((d) => {
    const g = groupDay(byDay[d], tags, excl); const have = (drafts.byDate[dot(d)] && drafts.byDate[dot(d)].items) || {};
    Object.keys(g).forEach((sid) => { const nm = ctx.mfName[sid]; if (!nm || have[nm]) return; jobs.push({ d, sid, nm, tests: g[sid] }); });
  });
  const todo = jobs.slice(0, MAX);
  log(`최근 ${DAYS}일 학습지 있는 날 ${Object.keys(byDay).length}일 · 채울 초안 ${jobs.length}건 · 이번에 ${todo.length}건` + (jobs.length > MAX ? ` (${jobs.length - MAX}건 이월)` : ''));
  if (DRY) { const per = {}; todo.forEach((j) => { per[j.d] = (per[j.d] || 0) + 1; }); log('  (미리보기) 날짜별', JSON.stringify(per)); return { made: 0, dry: true }; }

  let made = 0, fail = 0, chars = 0; const perDay = {};
  for (const j of todo) {
    const score = j.tests[0].score;
    let text = '', why = '';
    for (let k = 0; k < 2; k++) {
      try { text = String(await askClaude(draftPrompt(guide, j.d, j.nm, j.tests, cname), 1600)).trim(); } catch (e) { why = e.message; text = ''; break; }
      why = draftOk(text, score); if (!why) break;
    }
    if (!text || why) { fail++; log(`  ${dot(j.d)} 1건 실패: ${why || '빈 글'}`); continue; }
    /* 저장 직전 최신본을 다시 읽어 합친다 — 학원앱이 그사이 고쳤을 수 있다 */
    const latest = (await kvGet('ultra_drafts')) || {}; if (latest.byDate) drafts.byDate = Object.assign({}, latest.byDate, drafts.byDate);
    const slot = drafts.byDate[dot(j.d)] = drafts.byDate[dot(j.d)] || { items: {} };
    slot.items = Object.assign({}, (latest.byDate && latest.byDate[dot(j.d)] && latest.byDate[dot(j.d)].items) || {}, slot.items);
    if (slot.items[j.nm]) continue;
    slot.items[j.nm] = text; made++; chars += text.length; perDay[dot(j.d).slice(5)] = (perDay[dot(j.d).slice(5)] || 0) + 1;
    const keys = Object.keys(drafts.byDate).sort(); while (keys.length > 14) delete drafts.byDate[keys.shift()];
    drafts.updated = new Date().toISOString();
    await kvSet('ultra_drafts', drafts);   /* 한 건마다 저장 — 중간에 끊겨도 쓴 것은 남는다 */
  }
  await kvSet('ultra_last', { at: new Date().toISOString(), made, by: 'script' });
  log(`초안 새로 ${made}건 · 실패 ${fail}건 · 날짜별 ${Object.keys(perDay).sort().map((d) => d + ' ' + perDay[d] + '명').join(' · ') || '없음'}` + (made ? ` · 평균 ${Math.round(chars / made)}자` : ''));
  return { made, fail };
}

/* ══ ② 녹음 주제 ════════════════════════════════════════════════════════ */
function gradeKey(g) { const s = String(g || ''); const n = (s.match(/(\d)\s*학년/) || [])[1]; if (!n) return ''; return (/초등/.test(s) ? '초' : /고등/.test(s) ? '고' : '중') + n; }

async function runTopics(ctx) {
  const today = kstToday(), dow = new Date(today + 'T00:00:00Z').getUTCDay(), key = dot(today);
  const gd = (await kvGet('lumen_group_days')) || {};
  const st = (ctx.db || []).filter((s) => s && s.lumen_rec_code && !s.withdrawn);
  const todays = st.filter((s) => { const days = gd[s.group]; return Array.isArray(days) && days.length ? days.indexOf(dow) >= 0 : [1, 3, 5].indexOf(dow) >= 0; });
  if (!todays.length) { log('녹음 주제 — 오늘 수업하는 반 없음'); return { grades: 0, students: 0 }; }
  const topics = (await kvGet('rec_topics')) || {}; topics.byGrade = topics.byGrade || {}; topics.byStudent = topics.byStudent || {};
  const cname = (await kvGet('mf_concept_names')) || {};
  const from = addDays(today, -7);
  const recs = await sbAll(`mf_answer_records?select=mf_student_id,result,concept_id,worksheet_title,score_datetime&score_datetime=gte.${from}T00:00:00&score_datetime=lt.${today}T00:00:00`);
  const wrongBy = {}, titleBy = {};
  recs.forEach((x) => {
    const code = ctx.sid2code[x.mf_student_id]; if (!code) return;
    if (x.result === 'X' && x.concept_id != null) { const n = (cname[x.concept_id] && cname[x.concept_id].n) || ''; if (n) { const w = wrongBy[code] = wrongBy[code] || {}; w[n] = (w[n] || 0) + 1; } }
    if (x.worksheet_title) titleBy[code] = x.worksheet_title;
  });
  const grades = {}; todays.forEach((s) => { const g = gradeKey(s.grade); if (g) (grades[g] = grades[g] || []).push(s.lumen_rec_code); });
  let gMade = 0, sMade = 0;
  for (const g of Object.keys(grades)) {
    const byDay = topics.byGrade[g] = topics.byGrade[g] || {};
    if (byDay[key]) continue;
    const cnt = {}; grades[g].forEach((c) => Object.entries(wrongBy[c] || {}).forEach(([n, k]) => { cnt[n] = (cnt[n] || 0) + k; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
    const recent = Object.keys(byDay).sort().slice(-7).map((d) => byDay[d] && byDay[d].t).filter(Boolean);
    const basis = top.length ? `최근 7일 이 학년이 많이 틀린 유형: ${top.join(', ')}` : `최근 학습지: ${grades[g].map((c) => titleBy[c]).filter(Boolean).slice(0, 3).join(', ') || '(자료 없음)'}`;
    if (DRY) { log(`  (미리보기) ${g} 학년 주제 만들 예정`); continue; }
    try {
      const txt = await askClaude([
        `수학학원 ${g} 학생이 3~5분 동안 말로 설명하는 「하브루타 녹음」 주제를 하나 만드세요.`,
        basis,
        recent.length ? `최근에 낸 주제(겹치지 않게): ${recent.join(' / ')}` : '',
        'JSON 한 줄로만 답하세요: {"t":"…설명해 보기 로 끝나는 주제 한 문장","g":"말할 힌트1 / 힌트2 / 힌트3"}',
      ].filter(Boolean).join('\n'), 400);
      const m = txt.match(/\{[\s\S]*\}/); const o = m ? JSON.parse(m[0]) : null;
      if (o && o.t) { byDay[key] = { t: String(o.t).trim(), g: String(o.g || '').trim(), src: 'ai' }; gMade++; }
    } catch (e) { log(`  ${g} 학년 주제 실패: ${e.message}`); }
  }
  todays.forEach((s) => {
    const c = s.lumen_rec_code, w = wrongBy[c]; if (!w) return;
    const mine = topics.byStudent[c] = topics.byStudent[c] || {}; if (mine[key]) return;
    const n = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
    if (!DRY) { mine[key] = { t: `이번 주에 틀린 「${n}」 문제를 다시 풀면서 어디서 막혔는지 설명해 보기`, src: 'ai' }; sMade++; }
  });
  const cut = dot(addDays(today, -21));
  [topics.byGrade, topics.byStudent].forEach((root) => Object.keys(root).forEach((k) => { Object.keys(root[k]).forEach((d) => { if (d < cut) delete root[k][d]; }); }));
  if (!DRY) { topics.updated = new Date().toISOString(); await kvSet('rec_topics', topics); }
  log(`녹음 주제 — 오늘 수업 ${todays.length}명 · 학년 주제 ${gMade}개 · 개인 주제 ${sMade}개`);
  return { grades: gMade, students: sMade };
}

/* ══ 본체 ══ */
async function main() {
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  if (!AI_KEY && !DRY) { console.error('❌ ANTHROPIC_API_KEY 가 없습니다 — GitHub › Settings › Secrets and variables › Actions 에 넣어 주세요 (--dry 로 목록만 볼 수 있습니다)'); process.exit(1); }
  const db = (await kvGet('or_studentdb')) || [];
  const mfs = await sbAll('mf_students?select=mf_student_id,name,lumen_rec_code');
  const byName = {}, dup = {};
  db.forEach((s) => { if (!s || !s.name || s.withdrawn || !s.lumen_rec_code) return; const n = String(s.name).trim(); if (byName[n]) dup[n] = 1; else byName[n] = String(s.lumen_rec_code); });
  const mfName = {}, sid2code = {};
  mfs.forEach((m) => { const n = String(m.name || '').trim(); if (!n) return; mfName[m.mf_student_id] = n; const c = m.lumen_rec_code || (!dup[n] && byName[n]); if (c) sid2code[m.mf_student_id] = String(c); });
  const ctx = { db, mfName, sid2code };
  let bad = 0;
  if (ONLY !== 'topics') { try { await runDrafts(ctx); } catch (e) { bad++; log('❌ 초안 단계 실패:', e.message); } }
  if (ONLY !== 'drafts') { try { await runTopics(ctx); } catch (e) { bad++; log('❌ 녹음 주제 단계 실패:', e.message); } }
  if (bad === 2) process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
module.exports = { groupDay, callName, draftOk, firstScore, gradeKey };
