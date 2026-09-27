#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 🌙 플래너 사진 새벽 채점기  v1   (원장 지시 2026-09-27 「새벽 채점 고정 스크립트 만들어라」)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 【왜 만들었나】
 *   지금까지 새벽 채점은 「매일 새벽 4시 Routine」(Claude 세션)의 2.5단계가 맡았다.
 *   세션이 그날그날 판단해 도는 방식이라, 9/27 새벽엔 6분 만에 끝나며 채점을 하나도 남기지 않았다.
 *   이 스크립트는 판단 없이 «같은 일을 같은 방식으로» 한다 — GitHub Actions 가 매일 04:25(KST) 돌린다.
 *
 * 【무엇을 하나】  학원앱 v19-52 의 「AI 분석」(analyzePlannerPhotos)과 «같은 프롬프트·같은 모델·같은 결과 모양»이다.
 *   ① 등록부(or_studentdb)에서 재원생 코드를 얻고, 학생마다 Storage photos/<코드>/ 의 플래너 사진을 세트(YYYYMMDD_HHMM)로 묶는다
 *   ② 최근 N일(기본 7일) 세트 중 «등록부에 분석·승인이 없고, planner_ai_results 에도 없는 것»만 고른다
 *   ③ 사진(당일·내일 순, 최대 2장)을 Claude 에 보내 채점 → planner_ai_results.results["<코드>_<세트>"] = { analysis, at }
 *      analysis.aiProvider='routine' 이라 학원앱이 「🌙 새벽자동」으로 표시하고, 플래너 탭을 열 때 자동으로 가져간다(adoptOvernightPlannerResults)
 *   ④ 그날 스터디 코디 계획이 있으면 대조 줄을 붙이고(codiCheck), 결과로 codi_done_/codi_coach_ 도 적는다 (학원앱 v19-48 과 같음)
 *   ⑤ 14일 지난 결과는 지운다. 한 번에 최대 --max 세트(기본 60). 429/529 는 잠깐 쉬고 다시.
 *
 * 【필요한 비밀값】 SUPABASE_URL · SUPABASE_SERVICE_KEY · ANTHROPIC_API_KEY (GitHub Secrets)
 * 【사용법】
 *   node sync/planner_night_grader.js                 실제 채점
 *   node sync/planner_night_grader.js --dry           누구의 어떤 세트를 채점할지 목록만 (API 안 씀)
 *   node sync/planner_night_grader.js --days 3 --max 20 --code ABC123
 * 【개인정보】 로그에는 학생 코드와 개수만 남긴다 (이름 없음). 사진·전사 내용은 로그에 찍지 않는다.
 */

const SB_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const AI_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '';
const MODEL = process.env.PLANNER_MODEL || 'claude-sonnet-4-6';   // 학원앱과 같은 모델

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const DRY = argv.includes('--dry');
const DAYS = Number(arg('--days', 7));
const MAX = Number(arg('--max', 60));
const ONLY = arg('--code', '');

const sbH = () => ({ apikey: SB_KEY, authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });
const log = (...a) => console.log('[새벽채점]', ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function kvGet(key) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?key=eq.${encodeURIComponent(key)}&select=value`, { headers: sbH() });
  if (!r.ok) throw new Error(key + ' 읽기 실패 ' + r.status);
  const j = await r.json();
  let v = (j[0] && j[0].value); if (v === undefined) return null;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  return v;
}
async function kvSet(key, value) {
  const r = await fetch(`${SB_URL}/rest/v1/lumen_store?on_conflict=key`, {
    method: 'POST', headers: { ...sbH(), Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(key + ' 저장 실패 ' + r.status);
}
async function listPhotos(code) {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/photos`, {
    method: 'POST', headers: sbH(),
    body: JSON.stringify({ prefix: code, limit: 2000, sortBy: { column: 'created_at', order: 'desc' } }),
  });
  if (!r.ok) return [];
  const files = await r.json();
  return Array.isArray(files) ? files.filter((f) => f && f.name && f.name !== '.emptyFolderPlaceholder') : [];
}

/* 학원앱 groupPhotoSets 와 같은 규칙: 파일명의 _YYYYMMDD_HHMM 이 세트, 'planner' 가 든 파일만, 당일→내일 순 */
function groupSets(files) {
  const map = {};
  files.forEach((f) => {
    if (!f.name.includes('planner')) return;
    const m = f.name.match(/_(\d{8}_\d{4})/); if (!m) return;
    (map[m[1]] = map[m[1]] || []).push(f);
  });
  const rank = (n) => n.includes('_today') ? 0 : (n.includes('_tomorrow') ? 1 : (n.includes('_photo1') ? 0 : (n.includes('_photo2') ? 1 : 2)));
  return Object.keys(map).sort().reverse().map((id) => ({
    id, files: map[id].slice().sort((a, b) => (rank(a.name) - rank(b.name)) || a.name.localeCompare(b.name)),
  }));
}

const kstNow = () => new Date(Date.now() + 9 * 3600000);
const kstDayKey = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

/* ── 스터디 코디 대조 (학원앱 cdPromptLines / cdCoachSave 와 같은 규칙) ── */
const cdAdd = (s, n) => { const t = new Date(s + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const cdDow = (s) => (new Date(s + 'T00:00:00Z').getUTCDay() + 6) % 7;
const cdWeekStart = (s) => cdAdd(s, -cdDow(s));
const cdIso = (s) => { const m = String(s || '').match(/(\d{4})[.\-](\d{2})[.\-](\d{2})/); return m ? (m[1] + '-' + m[2] + '-' + m[3]) : ''; };
const planCache = {};
async function codiBlocksFor(code, day) {
  if (planCache[code] === undefined) { try { planCache[code] = await kvGet('codi_plan_' + code); } catch (e) { planCache[code] = null; } }
  const p = planCache[code];
  if (!p || p.week !== cdWeekStart(day)) return [];
  const d = cdDow(day);
  return (p.blocks || []).filter((b) => b && b.d === d);
}
async function codiPromptLines(code, expectedDate) {
  const day = cdIso(expectedDate); if (!code || !day) return [];
  const bs = await codiBlocksFor(code, day); if (!bs.length) return [];
  const titles = []; bs.forEach((b) => { const t = (b.item || {}).title || ''; if (t && titles.indexOf(t) < 0) titles.push(t); });
  return ['', '━━━━━━━━━━━━━━━━━━━━━━━━━', '【 스터디 코디 계획 대조 (추가) 】', '━━━━━━━━━━━━━━━━━━━━━━━━━', '',
    '이 학생이 이 날(' + day + ') 앱에서 세운 수학 계획은 다음과 같습니다:'].concat(titles.map((t, i) => '  ' + (i + 1) + '. ' + t)).concat(['',
    '당일 플래너의 TASKS 전사와 대조해서, 각 계획 항목이 완료(O 또는 △) 표시된 줄과 «내용이 같거나 비슷하면» done=true, 아니면 false 로 판단하세요.',
    '(예: 계획 "쎈 중1 53~57쪽" ↔ TASKS "[O] 쎈 53-57" 은 같은 것입니다. 쪽수가 조금 달라도 같은 교재면 같은 것으로 봅니다.)',
    '출력 JSON에 다음 키를 «추가»하세요 (계획 항목 이름은 위 목록의 글자 그대로):',
    '  "codiCheck": [' + titles.map((t) => '{"title": "' + t.replace(/"/g, '') + '", "done": true 또는 false}').join(', ') + ']']);
}
async function codiCoachSave(code, analysis, expectedDate) {
  const day = cdIso(analysis.date) || cdIso(expectedDate); if (!day) return;
  const bs = await codiBlocksFor(code, day); if (!bs.length) return;
  const chk = {}; (analysis.codiCheck || []).forEach((x) => { if (x && x.title) chk[String(x.title).replace(/\s/g, '')] = !!x.done; });
  const doneLines = (analysis.tasksTranscript || []).filter((l) => /^\s*\[(O|△|V|✓|✔)\]/i.test(String(l))).map((l) => String(l).replace(/\s/g, ''));
  const items = []; let dn = 0;
  bs.forEach((b) => {
    const t = (b.item || {}).title || ''; const k = t.replace(/\s/g, ''); let ok;
    if (chk[k] !== undefined) ok = chk[k];
    else { const key = k.replace(/^학습지/, '').replace(/^오답.*/, '오답').replace(/^아하노트.*/, '아하').replace(/\d+~\d+쪽.*$/, '').slice(0, 4); ok = !!key && doneLines.some((l) => l.indexOf(key) >= 0); }
    items.push({ id: b.id, title: t, ok: !!ok }); if (ok) dn++;
  });
  const planned = items.length; if (!planned) return;
  const missed = items.filter((x) => !x.ok).map((x) => x.title);
  let msg;
  if (dn === planned) msg = '어제 계획 ' + planned + '개를 플래너에 다 ○로 적었어. 멋져!';
  else if (dn === 0) msg = '어제 계획 ' + planned + '개가 플래너에 ○로 안 보였어. 오늘은 「' + missed[0] + '」 한 칸만이라도 꼭!';
  else msg = '어제 ' + planned + '개 중 ' + dn + '개 했어. 못 한 「' + missed[0] + '」' + (missed.length > 1 ? ' 등 ' + missed.length + '개' : '') + '는 오늘 빈 칸에 다시 해 보자.';
  const now = new Date().toISOString();
  const dv = (await kvGet('codi_done_' + code)) || {}; dv[day] = dv[day] || {};
  items.forEach((x) => { if (x.ok && !dv[day][x.id]) dv[day][x.id] = { at: now, auto: true, src: 'planner' }; }); dv.upd = now;
  await kvSet('codi_done_' + code, dv);
  const cv = (await kvGet('codi_coach_' + code)) || { days: {} }; cv.days = cv.days || {};
  cv.days[day] = { planned, done: dn, items, msg, rate: (analysis.practiceRate || ''), at: now }; cv.upd = now;
  const ks = Object.keys(cv.days).sort(); while (ks.length > 60) delete cv.days[ks.shift()];
  await kvSet('codi_coach_' + code, cv);
  analysis.codiCoach = { planned, done: dn, msg };
}

/* ── 학원앱 v2.1 프롬프트 (analyzePlannerPhotos 와 글자 그대로 같다) ── */
function buildPrompt(expectedDate, practiceRate) {
  return [
    '당신은 수학학원 학생의 플래너 사진을 채점하는 AI입니다.',
    '첫 번째 사진: 당일 실천 플래너(오늘 기록), 두 번째 사진: 다음날 계획 플래너(내일 계획).',
    '',
    '★ 날짜는 두 장 «각각» 읽으세요 (v19-30):',
    '  - date     : 첫 번째 사진(오늘 기록)의 맨 윗줄 날짜',
    '  - dateNext : 두 번째 사진(내일 계획)의 맨 윗줄 날짜',
    '  · 날짜 칸이 비어 있거나 사진에서 잘려 안 보이면 "" (빈 문자열)로 두세요. 추측하지 마세요.',
    '  · 사진이 한 장뿐이면 dateNext 는 "" 입니다.',
    '  · 두 번째 사진이 플래너가 아니면(교재·문제집·책상 사진 등) dateNext 는 "" 이고 flagNotPlanner 를 true 로 두세요.',
    '',
    '※ 참고: 이 플래너는 ' + (expectedDate ? expectedDate + ' 경' : '최근') + '에 제출되었습니다.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '【 0단계: 전사 — 채점 전 필수 】',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '점수를 매기기 전에, 사진에서 보이는 내용을 먼저 그대로 옮겨 적으세요:',
    '- tasksTranscript: 당일 플래너의 TASKS 목록을 항목별로 "[체크상태] 내용" 형식으로 전사',
    '  · 체크상태: O(완료) / △(부분완료) / X(미완료) / 빈칸',
    '  · 예: "[O] 쎈 수학 p.42~45", "[X] 영어 단어 50개"',
    '- feedbackTranscript: 피드백 영역(잘한점/부족한점/개선할점)에 적힌 문장을 보이는 그대로 전사',
    '- 글씨가 흐릿하거나 각도·화질 문제로 읽을 수 없는 부분은 추측하지 말고 "판독불가"로 표기하세요.',
    '- 채점은 반드시 이 전사 내용에 근거해서만 하세요.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '【 채점 항목 (총 4점, 각 0 또는 1) 】',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '① studyScore (학습 시간 기재 · 1점)',
    '  - TOTAL TIME 칸에 값이 있거나 (예: "4H", "4시간 30분")',
    '  - 과목별 시간이 기재되어 있으면 (예: "수학 2시간, 영어 1시간") 1점',
    '  - 시간대만 있고 TOTAL/과목별 기재 없으면 0점',
    '',
    '② practiceScore (계획 대비 실천율 · 1점)',
    '  - TASKS 체크 관례:',
    '    · O, V, ✓, ✔ = 완료',
    '    · △ = 부분 완료 (★완료로 카운트함)',
    '    · ✗, X, 빈칸 = 미완료',
    '  - 실천율 = (완료 + △) 개수 / 전체 TASKS 개수 × 100',
    '  - ' + practiceRate + '% 이상이면 1점',
    '',
    '③ specificScore (학습 내용 구체성 · 1점)',
    '  - TASKS의 과반수 이상이 "과목명 + 추가정보" 형식이면 1점',
    '  - 인정 예: "수학 교과서 풀기", "영어 숙제(1)", "기술 수행"',
    '  - 불인정 예: "수학", "공부하기" 같이 과목명/추상 표현만',
    '',
    '④ feedbackScore (자기 피드백 · 1점)',
    '  - 3종 세트가 모두 있어야 1점:',
    '    · 잘한점',
    '    · 부족한점 (아쉬운점)',
    '    · 개선할점',
    '  - 각 항목이 "문장 수준"의 내용이어야 함',
    '  - 한 단어만 있으면 → feedbackScore=0 + flagLowEffort=true',
    '  - 3종 중 하나라도 없으면 0점',
    '  - 자유 형식(레이블 없음)은 불인정',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '【 추가 플래그 (참고용, 점수 무관) 】',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '- flagDateMismatch: 사진의 날짜와 예상 날짜(' + (expectedDate || '-') + ')가 2일 이상 차이 나면 true',
    '- flagLowEffort: 피드백 3종이 모두 한 단어씩만이거나 성의없는 표시(예: "ㅇ", "-")면 true',
    '- flagEmpty: TASKS, TIMETABLE, MEMO 모두 비어 있거나 매우 빈약하면 true',
    '- flagNotPlanner: 사진 중 하나라도 플래너가 아니면(교재·문제집·책상·빈 종이 등) true',
    '- flagSamePhoto: 두 장이 사실상 같은 사진(같은 쪽을 두 번 찍음)이면 true',
    '- flagUnreadable: 화질·각도·조명 문제로 채점 항목 중 하나라도 신뢰 판독이 불가하면 true',
    '- unreadableItems: 판독불가한 항목의 키 배열 (예: ["practiceScore","feedbackScore"]), 전부 판독 가능하면 []',
    '  · 판독불가 항목의 점수는 0으로 두되, 반드시 이 배열에 명시하세요 (억울한 감점 방지용 — 원장이 사진을 직접 확인합니다)',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '【 출력 형식 — JSON만, 마크다운/설명 금지 】',
    '━━━━━━━━━━━━━━━━━━━━━━━━━',
    '{',
    '  "date": "YYYY.MM.DD",',
    '  "dateNext": "YYYY.MM.DD",',
    '  "totalTime": "X시간 Y분",',
    '  "tasksDone": "완료수/전체수",',
    '  "practiceRate": "X%",',
    '  "tasksTranscript": ["[O] 항목1", "[X] 항목2"],',
    '  "feedbackTranscript": "잘한점: ... / 부족한점: ... / 개선할점: ...",',
    '  "studyScore": "1 또는 0",',
    '  "practiceScore": "1 또는 0",',
    '  "specificScore": "1 또는 0",',
    '  "feedbackScore": "1 또는 0",',
    '  "flagDateMismatch": true 또는 false,',
    '  "flagLowEffort": true 또는 false,',
    '  "flagEmpty": true 또는 false,',
    '  "flagUnreadable": true 또는 false,',
    '  "unreadableItems": [] 또는 ["practiceScore"],',
    '  "comment": "한줄요약 (20자 이내)"',
    '}',
    '',
    '※ plannerScore(인증 시간 점수)는 제외하세요 — 제출 시간으로 자동 계산됩니다.',
  ];
}

async function fetchImage(code, name) {
  const url = `${SB_URL}/storage/v1/object/public/photos/${encodeURIComponent(code)}/${encodeURIComponent(name)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('사진 내려받기 실패 ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 4.8 * 1024 * 1024) throw new Error('사진이 너무 큼 ' + Math.round(buf.length / 1024) + 'KB');
  const mime = (r.headers.get('content-type') || '').split(';')[0] || (/\.png$/i.test(name) ? 'image/png' : 'image/jpeg');
  return { mime: /^image\//.test(mime) ? mime : 'image/jpeg', b64: buf.toString('base64') };
}

/* Claude 호출 — 학원앱과 같은 모델·온도·토큰. 429/529/503 은 8·16·32초 쉬고 다시 */
async function askClaude(images, prompt) {
  const content = images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.mime, data: img.b64 } }));
  content.push({ type: 'text', text: prompt });
  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2000, temperature: 0.2, messages: [{ role: 'user', content }] }),
    });
    const data = await r.json().catch(() => null);
    if (r.ok && data && !data.error) {
      const text = ((data.content || [])[0] || {}).text || '';
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('JSON 추출 실패: ' + text.slice(0, 80));
      return JSON.parse(m[0]);
    }
    lastErr = new Error('Claude ' + r.status + ': ' + ((data && data.error && data.error.message) || r.statusText));
    if ([429, 503, 529, 500].includes(r.status) && attempt < 3) { await sleep(8000 * Math.pow(2, attempt)); continue; }
    break;
  }
  throw lastErr;
}

async function main() {
  if (!SB_URL || !SB_KEY) { console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_KEY 필요'); process.exit(1); }
  if (!AI_KEY && !DRY) { console.error('❌ ANTHROPIC_API_KEY 가 없습니다 — GitHub Secrets 에 넣어 주세요 (--dry 로 목록만 볼 수 있습니다)'); process.exit(1); }

  const db = (await kvGet('or_studentdb')) || [];
  const cfg = Object.assign({ practiceRate: 20 }, (await kvGet('lumen_planner_config')) || {});
  const store = (await kvGet('planner_ai_results')) || { results: {} };
  store.results = store.results || {};
  const cut = kstDayKey(new Date(kstNow().getTime() - DAYS * 864e5));

  const students = db.filter((s) => s && s.lumen_rec_code && !s.withdrawn && (!ONLY || s.lumen_rec_code === ONLY));
  const jobs = [];
  let skipReg = 0, skipDone = 0;
  for (const st of students) {
    const code = st.lumen_rec_code;
    const reg = {}; (st.lumen_planner_photos || []).forEach((p) => { if (p && p.setId) reg[p.setId] = p; });
    let files = [];
    try { files = await listPhotos(code); } catch (e) { log(code, '사진 목록 실패:', e.message); continue; }
    groupSets(files).forEach((set) => {
      if (set.id.slice(0, 8) < cut) return;
      const p = reg[set.id];
      if (p && (p.analysis || p.reviewed)) { skipReg++; return; }
      if (store.results[code + '_' + set.id]) { skipDone++; return; }
      jobs.push({ code, set });
    });
  }
  jobs.sort((a, b) => b.set.id.localeCompare(a.set.id));   // 최신부터
  const todo = jobs.slice(0, MAX);
  log(`재원생 ${students.length}명 · 최근 ${DAYS}일 대상 ${jobs.length}세트 (이미 앱에서 처리 ${skipReg} · 이미 채점 ${skipDone}) · 이번에 ${todo.length}세트${jobs.length > MAX ? ` (${jobs.length - MAX}세트 이월)` : ''}`);
  if (DRY) { todo.forEach((j) => log(`  (미리보기) ${j.code} ${j.set.id} 사진 ${j.set.files.length}장`)); return; }
  if (!todo.length) return;

  let ok = 0, fail = 0;
  for (const j of todo) {
    const { code, set } = j;
    const expectedDate = set.id.slice(0, 4) + '.' + set.id.slice(4, 6) + '.' + set.id.slice(6, 8);
    try {
      const images = [];
      for (const f of set.files.slice(0, 2)) images.push(await fetchImage(code, f.name));
      if (!images.length) throw new Error('사진 없음');
      let lines = buildPrompt(expectedDate, cfg.practiceRate);
      try { lines = lines.concat(await codiPromptLines(code, expectedDate)); } catch (e) {}
      const analysis = await askClaude(images, lines.join('\n'));
      analysis.aiProvider = 'routine';
      analysis.analyzedAt = new Date().toISOString();
      analysis.promptVersion = 'v2.1';
      if (analysis.dateNext === undefined || analysis.dateNext === null) analysis.dateNext = '';
      analysis.fileCount = set.files.length;
      try { await codiCoachSave(code, analysis, expectedDate); } catch (e) { log(code, set.id, '코디 기록 실패(채점은 유지):', e.message); }
      store.results[code + '_' + set.id] = { analysis, at: new Date().toISOString() };
      ok++;
      /* 한 세트마다 저장 — 중간에 끊겨도 한 것은 남는다 */
      store.updated = new Date().toISOString();
      await kvSet('planner_ai_results', store);
    } catch (e) {
      fail++; log(`${code} ${set.id} 실패: ${e.message}`);
    }
  }
  /* 14일 지난 결과 정리 */
  const old = kstDayKey(new Date(kstNow().getTime() - 14 * 864e5));
  let pruned = 0;
  Object.keys(store.results).forEach((k) => { const d = (k.split('_')[1] || '').slice(0, 8); if (d && d < old) { delete store.results[k]; pruned++; } });
  store.updated = new Date().toISOString();
  await kvSet('planner_ai_results', store);
  log(`끝 — 채점 ${ok} · 실패 ${fail} · 14일 지난 결과 정리 ${pruned} · 보관 ${Object.keys(store.results).length}`);
  if (fail && !ok) process.exit(1);
}

module.exports = { main, groupSets, buildPrompt, codiPromptLines, codiCoachSave };
if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1); });
