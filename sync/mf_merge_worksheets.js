#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 나뉘어 올라간 매쓰플랫 학습지 → 한 장으로 합치기   (2026-09-17 원장님 지시)
 * ═══════════════════════════════════════════════════════════════════
 * 왜 필요한가
 *   수학비서 문제지를 매쓰플랫으로 옮길 때, 매쓰플랫 AI(document-processing-flow)가
 *   한 번에 «10쪽»까지만 받는다. 그래서 108문항짜리는 PDF가 10쪽을 넘어
 *   54 + 54 두 장으로 나뉘어 올라갔다. 그러면 두 번째 장의 번호가 1부터 다시
 *   시작해 원본 프린트의 번호와 어긋난다. 원장님은 «번호가 그대로» 들어가길 원하신다.
 *
 * 무엇을 하나
 *   이미 올라간 학습지들의 문항은 «이미 문제은행에 복사되어» 있다. 그래서 PDF를
 *   다시 올릴 필요가 없다. 두 학습지의 문항을 순서대로 이어 붙여 «새 학습지 한 장»을
 *   만든다(1~108). 잘 만들어진 것을 확인한 뒤에만 옛 학습지를 지운다.
 *
 * 쓰는 법
 *   node sync/mf_merge_worksheets.js --ws 82224846,82225520 --title "[비상] 중등수학 1-2 중간 (위치,작도)" --dry
 *   node sync/mf_merge_worksheets.js --ws 82224846,82225520 --title "..." --mylist 수학비서 --delete-old
 *
 *   --ws         합칠 학습지 번호들 (순서대로, 쉼표로)
 *   --title      새 학습지 제목 (없으면 첫 학습지 제목에서 「(1/2) 1~54」 꼬리를 뗀다)
 *   --mylist     담을 마이리스트 폴더 이름 (기본 「수학비서」)
 *   --delete-old 확인까지 끝나면 옛 학습지를 지운다 (기본은 그대로 둔다)
 *   --dry        만들지 않고 계획만 보여 준다
 *
 * ※ 계정은 환경변수 MATHFLAT_ID / MATHFLAT_PASSWORD 만 쓴다 (코드·로그에 남기지 않는다)
 * ※ 매쓰플랫은 동시 로그인하면 쓰던 화면이 끊길 수 있다 — 원장님이 안 쓰실 때 돌린다
 * ═══════════════════════════════════════════════════════════════════ */

const MF_API = 'https://api.mathflat.com';
const MF_BASE = 'https://teacher.mathflat.com';
let TOK = '';

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const H = () => ({ 'content-type': 'application/json', 'x-platform': 'TEACHER_WEB',
  'x-freewheelin-host': 'mathflat.com', origin: MF_BASE, referer: MF_BASE + '/',
  ...(TOK ? { authorization: 'Bearer ' + TOK } : {}) });

async function mfLogin() {
  const r = await fetch(`${MF_API}/v2/login`, { method: 'POST', headers: H(),
    body: JSON.stringify({ id: process.env.MATHFLAT_ID.trim(), password: process.env.MATHFLAT_PASSWORD.trim(),
      userType: 'TEACHER', serviceType: 'MATHFLAT' }) });
  const j = await r.json();
  if (!j.accessToken) throw new Error(`매쓰플랫 로그인 실패 ${j.code || r.status}`);
  TOK = j.accessToken;
}
async function mf(method, p, body, _retried) {
  const r = await fetch(MF_API + p, { method, headers: H(), body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  const data = j && j.data !== undefined ? j.data : j;
  if (r.status === 401 && !_retried) { log('  토큰 만료 → 다시 로그인'); await mfLogin(); return mf(method, p, body, true); }
  if (!r.ok) { const e = new Error(`${method} ${p} → ${r.status} ${t.slice(0, 300)}`); e.status = r.status; throw e; }
  return { data, raw: t };
}

/* 학습지 한 장 읽기 → { ws, problems[] } (번호 순서 그대로) */
async function getWorksheet(id) {
  const { data } = await mf('GET', `/worksheet/${id}?ignoredForDeleted=true`);
  const ws = (data && (data.worksheet || data)) || {};
  const problems = (data && (data.problems || ws.problems)) || [];
  return { ws, problems };
}

async function putInMylist(name, ids) {
  if (!name || !ids.length) return { ok: false, reason: '폴더 지정 없음' };
  try {
    const { data: lists } = await mf('GET', '/mylist');
    const all = (lists && lists.myLists) || (Array.isArray(lists) ? lists : []);
    let target = all.find((l) => l.name === name);
    if (!target) {
      const { data: mk } = await mf('POST', '/mylist', { name });
      target = (mk && mk.myList) || mk;
      log(`  마이리스트 「${name}」 새로 만듦`);
    }
    await mf('POST', `/mylist/${target.id}/element`, { worksheetIds: ids });
    log(`  마이리스트 「${name}」에 담았습니다`);
    return { ok: true, id: target.id };
  } catch (e) {
    log(`  ⚠ 폴더 담기 실패(학습지는 정상): ${e.message.slice(0, 160)}`);
    return { ok: false, reason: e.message.slice(0, 200) };
  }
}

async function deleteWorksheet(id) {
  for (const p of ['/worksheet', '/worksheet/trash/by-worksheet']) {
    try { await mf('DELETE', p, [id]); log(`  옛 학습지 ${id} 지움 (${p})`); return true; }
    catch (e) { /* 다음 방법으로 */ }
  }
  log(`  ⚠ 옛 학습지 ${id} 를 지우지 못했습니다 — 매쓰플랫에서 직접 지워 주세요`);
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const ids = String(arg('ws', '')).split(',').map((x) => Number(x.trim())).filter(Boolean);
  const dry = args.includes('--dry');
  const delOld = args.includes('--delete-old');
  const dropDup = args.includes('--drop-dup');
  const mylist = arg('mylist', '수학비서');
  if (ids.length < 2) throw new Error('--ws 82224846,82225520 처럼 합칠 학습지를 두 개 이상 주세요');
  if (!process.env.MATHFLAT_ID || !process.env.MATHFLAT_PASSWORD) throw new Error('MATHFLAT_ID / MATHFLAT_PASSWORD 환경변수가 없습니다');

  await mfLogin();
  log('매쓰플랫 로그인 OK');

  /* ① 합칠 학습지들을 순서대로 읽는다 */
  const parts = [];
  for (const id of ids) {
    const { ws, problems } = await getWorksheet(id);
    if (!problems.length) throw new Error(`학습지 ${id} 에 문항이 없습니다`);
    /* «나의 DB 원본» 번호는 문항마다가 아니라 학습지의 filter 에 모여 있다 (실측 2026-09-17).
     * 화면에 보이는 순서는 problems 배열이 정한다 — 이 순서를 그대로 이어 붙인다. */
    const ftype = (ws.filter && ws.filter.type) || '';
    const det = (ws.filter && ws.filter.myDbProblemDetailIds) || [];
    const cids = (ws.filter && ws.filter.conceptIdList) || [];
    log(`· ${id} 「${ws.title}」 — ${problems.length}문항 · ${ftype === 'CONCEPT' ? `유형 ${cids.length}개` : `원본 ${det.length}개`}`);
    if (ftype === 'MY_DB_ORIGINAL') {
      if (!det.length) throw new Error(`학습지 ${id} 에서 «나의 DB 원본» 번호를 찾지 못했습니다`);
    } else if (ftype === 'CONCEPT') {
      /* 매쓰플랫이 만든 학습지(내신대비 SCHOOL_PREPARE·단원평가 등)는 «유형»으로 골라 놓은 것이다.
       * 문항은 이미 매쓰플랫 문제은행에 있으므로 번호만 순서대로 이어 붙이면 된다 (실측 2026-09-19). */
      if (!cids.length) throw new Error(`학습지 ${id} 에서 «유형» 번호를 찾지 못했습니다`);
    } else {
      throw new Error(`학습지 ${id} 은 합칠 수 없는 종류입니다 (${ftype || '알 수 없음'}) — «나의 DB 원본» 또는 «유형»으로 만든 것만 됩니다`);
    }
    parts.push({ id, ws, problems, det, cids, ftype });
  }

  const kinds = [...new Set(parts.map((p) => p.ftype))];
  if (kinds.length > 1) throw new Error(`종류가 다른 학습지는 섞어 합칠 수 없습니다 (${kinds.join(' + ')})`);
  const KIND = kinds[0];

  const title = arg('title', '') || String(parts[0].ws.title || '')
    .replace(/\s*\(\d+\/\d+\)\s*\d+~\d+\s*$/, '').trim();
  let all = parts.flatMap((p) => p.problems);
  let dup = all.length - new Set(all.map((p) => p.id || p.problemId)).size;
  if (dup && dropDup) {
    const seen = new Set();
    all = all.filter((p) => { const k = p.id || p.problemId; if (seen.has(k)) return false; seen.add(k); return true; });
    log(`  겹치는 문항 ${dup}개를 뺐습니다 (--drop-dup) → ${all.length}문항`);
    dup = 0;
  }
  const problemIds = all.map((p) => p.id || p.problemId);
  const detailIds = parts.flatMap((p) => p.det);
  const conceptIds = [...new Set(parts.flatMap((p) => p.cids))];
  const base = parts[0].ws;
  const withAns = all.filter((p) => p.answer != null && String(p.answer).trim() !== '' && String(p.answer).trim() !== '.').length;
  const autoN = all.filter((p) => p.autoScored).length;

  log(`\n합칠 결과 — 「${title}」 ${all.length}문항 (정답 ${withAns} · 자동채점 ${autoN}${dup ? ` · ⚠ 겹치는 문항 ${dup}개` : ''})`);
  log(`  학년 ${base.school || ''} ${base.grade} · 개정 ${base.revision} · 갈래 ${base.tag}`);
  parts.forEach((p, i) => log(`  ${i + 1}) ${p.id} ${p.problems.length}문항 → 새 번호 ${parts.slice(0, i).reduce((a, x) => a + x.problems.length, 0) + 1}~${parts.slice(0, i + 1).reduce((a, x) => a + x.problems.length, 0)}`));
  if (dup) throw new Error('같은 문항이 두 번 들어갑니다 — 학습지 번호를 확인하시거나, 겹치는 것을 빼고 합치려면 --drop-dup 을 주세요');
  if (dry) { log('\n(미리보기라 만들지 않았습니다)'); return; }

  /* ② 새 학습지 한 장 만들기 — 번호 순서 그대로
   *   «나의 DB 원본» : 원본(paper) 번호 목록으로 필터를 만들고 그 번호를 함께 넘긴다
   *   «유형(CONCEPT)»: 두 학습지의 유형 번호를 합쳐 필터를 만들고, 문항은 번호로 못 박는다
   *                     (매쓰플랫이 만든 내신대비·단원평가 학습지가 이 방식이다) */
  const pdfSet = (base.pdf || {});
  const mkFilter = async () => {
    if (KIND === 'CONCEPT') {
      const bf = base.filter || {};
      const { data } = await mf('POST', '/worksheet/filter/concept', {
        type: 'CONCEPT', conceptIdList: conceptIds, excludedTopicIds: [], excludedSubTopicIds: [],
        problemList: null, problemCount: problemIds.length, level: bf.level || base.level || 3,
        levelWeight: bf.levelWeight || [5, 30, 30, 25, 10],
        problemFilterType: 'ALL', practiceTest: 'INCLUDE', onlyAutoScorable: false,
        excludePrevious: false, previousExclusionScope: null, studentIds: null, excludeOOC: true,
        equalityLevel: null, minRate: 0, maxRate: 100,
        selectedConceptIdList: [], selectedLittleChapterIdList: [],
      });
      return (data && data.filterId) || data;
    }
    const { data } = await mf('POST', '/v2/worksheet/filter/school-test-paper/original', { myDbProblemDetailIds: detailIds });
    return (data && data.filterId) || data;
  };
  const mkBody = (filterId, tag) => {
    const common = {
      filterId, title, tag,
      littleChapterConceptIdList: [], assignStudentIdList: [], shareScope: 'ACADEMY',
      writer: (base.writer && base.writer !== '매쓰플랫' ? base.writer : '루멘수학'),
      conceptSortType: 'CHAPTER', includeProblemFlag: false, wrongAnswerNoteFlag: false,
      schoolType: base.school || base.schoolType, revision: base.revision, grade: base.grade,
      problemPadding: 60, pdfDateType: 'TODAY', pdfDate: null,
    };
    if (KIND === 'CONCEPT') return {
      ...common,
      /* conceptIdList 를 채우면 문제 위에 «이론(개념) 박스»가 인쇄된다 — 비워 둔다 (실측 2026-08-17) */
      conceptIdList: [],
      problemList: all.map((p) => ({ id: p.id || p.problemId, tagTop: p.tagTop || null })),
      layoutType: pdfSet.layoutType != null ? pdfSet.layoutType : 1,
      layoutColor: pdfSet.layoutColor || 'BLUE',
      partitionType: pdfSet.partitionType != null ? pdfSet.partitionType : 0,
      conceptNameFlag: pdfSet.conceptNameFlag != null ? pdfSet.conceptNameFlag : true,
      answerRateFlag: !!pdfSet.answerRateFlag, problemTrendFlag: !!pdfSet.problemTrendFlag,
      relationWorkbookFlag: !!pdfSet.relationWorkbookFlag, qrFlag: !!pdfSet.qrFlag,
      designTemplateId: pdfSet.designTemplateId || null,
    };
    return {
      ...common,
      conceptIdList: [],
      layoutType: 0, layoutColor: 'BLUE', partitionType: 0,
      conceptNameFlag: true, answerRateFlag: false, relationWorkbookFlag: false,
      designTemplateId: null, qrFlag: false, problemTrendFlag: false,
      problemList: problemIds.map((id, k) => ({ id, boxIndex: k + 1 })),
      myDbProblemDetailIds: detailIds,
    };
  };
  /* 갈래(tag): 원본 갈래를 먼저 쓰고, 매쓰플랫이 거절하면 «직접 입력(ETC)»으로 물러난다 */
  const tagTries = KIND === 'CONCEPT'
    ? [...new Set([base.tag, 'ETC'].filter(Boolean))]
    : ['MY_DB_ORIGINAL'];

  let wsRaw = null, lastErr = null;
  for (let i = 0; i < 6 && !wsRaw; i++) {
    try {
      const filterId = await mkFilter();
      for (const tag of tagTries) {
        try {
          const { data } = await mf('POST', '/worksheet', mkBody(filterId, tag));
          wsRaw = data;
          if (tag !== tagTries[0]) log(`  갈래를 「${tag}」로 바꿔 만들었습니다 (원본 갈래는 거절됨)`);
          break;
        } catch (e) {
          if (e.status !== 400 || tag === tagTries[tagTries.length - 1]) throw e;
          log(`  갈래 「${tag}」 거절됨 — 다음 갈래로`);
        }
      }
    } catch (e) {
      lastErr = e;
      if (!/LAMBDA_INVOKE_EXCEPTION|INTERNAL_SERVER_ERROR/.test(e.message)) throw e;
      log(`  학습지 만들기 재시도 ${i + 1}/6 — ${e.message.slice(0, 140)}`);
      await sleep(20000);
    }
  }
  if (!wsRaw) throw lastErr;
  const newId = (wsRaw && wsRaw.id) || wsRaw;
  log(`\n✅ 새 학습지 ${newId} 「${title}」`);

  /* ③ 다시 읽어 확인 — 문항 수·번호 순서·정답 */
  let got = null, orderOk = false, nowAns = 0, nowAuto = 0;
  for (let i = 0; i < 6; i++) {
    got = await getWorksheet(newId);
    const ps = got.problems;
    orderOk = ps.length === problemIds.length && ps.every((p, k) => (p.id || p.problemId) === problemIds[k]);
    nowAns = ps.filter((p) => p.answer != null && String(p.answer).trim() !== '' && String(p.answer).trim() !== '.').length;
    nowAuto = ps.filter((p) => p.autoScored).length;
    if (orderOk && nowAns >= withAns) break;
    log(`  확인 중… 문항 ${ps.length}/${problemIds.length} · 정답 ${nowAns}/${withAns} — 15초 뒤 다시`);
    await sleep(15000);
  }
  log(`  확인: 문항 ${got.problems.length}/${problemIds.length} · 번호순서 ${orderOk ? '일치' : '불일치'} · 정답 ${nowAns}/${withAns} · 자동채점 ${nowAuto}/${autoN}`);
  const good = got.problems.length === problemIds.length && orderOk && nowAns >= withAns;
  if (!good) {
    log('  ⚠ 새 학습지가 기대와 다릅니다 — 옛 학습지는 그대로 두었습니다. 매쓰플랫에서 확인해 주세요');
    return;
  }

  await putInMylist(mylist, [newId]);

  /* ④ 확인까지 끝났을 때만 옛 학습지를 지운다 */
  if (delOld) { for (const p of parts) await deleteWorksheet(p.id); }
  else log(`  (옛 학습지 ${ids.join(', ')} 는 그대로 두었습니다 — 지우려면 --delete-old)`);

  log(`\n═══ 끝 ═══  새 학습지 ${newId} · ${got.problems.length}문항 · ${((Date.now() - t0) / 1000) | 0}초`);
}

main().catch((e) => { console.error('실패:', e && e.message); process.exit(1); });
