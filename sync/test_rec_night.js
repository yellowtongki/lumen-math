#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
 * 🧪 녹음 새벽 읽기 검사 — sync/rec_night_reader.js (계약 docs/rec_review_contract.md §2)
 * ══════════════════════════════════════════════════════════════════════════
 * 【무엇을 보나】 진짜 서버·Gemini 를 부르지 않는다. fetch 를 가짜로 바꿔
 *   가짜 Supabase(lumen_store · Storage 목록·내려받기)와 가짜 Gemini 를 흉내 낸다.
 *   날짜 거르기 · 주제 우선순위 · short 규칙 · 합치기 · 손 받아쓰기 건너뛰기 · 재시도 · 모델 바꿈 ·
 *   실패 기록 · 학년 요약 · 다시 돌리면 건너뛰기 · --force · --dry · 등록부에 안 쓰기 · 로그에 이름·코드·전문 없음.
 * 【가짜 학생】 홍길동·박하나 같은 가짜 이름 · AAA111 같은 가짜 코드만 쓴다 (공개 저장소).
 * 【사용법】 node sync/test_rec_night.js   → 전부 ✅ 면 통과 (하나라도 ❌ 면 exit 1)
 */
const R = require('./rec_night_reader.js');

let pass = 0, failN = 0;
function ok(cond, name) { if (cond) { pass++; console.log('✅', name); } else { failN++; console.log('❌', name); } }

const SB = 'https://fake.supabase.test';
const TODAY = '2026-10-23';   // → 기본 날짜 10/22 · 10/21 · 10/20

/* ── 가짜 세계 ── */
function makeWorld(over) {
  over = over || {};
  const store = {
    or_studentdb: [
      { name: '홍길동', grade: '중학교 2학년', lumen_rec_code: 'AAA111' },
      { name: '박하나', grade: '중학교 2학년', lumen_rec_code: 'BBB222' },
      { name: '이순신', grade: '중학교 2학년', lumen_rec_code: 'CCC333', lumen_rec_mission: '일차함수 그래프 / 기울기 뜻 설명' },
      { name: '김유신', grade: '초등학교 6학년', lumen_rec_code: 'DDD444', lumen_recordings: { 'DDD444_20261022_2000.webm': { stt: '손받아쓰기전문 분수의 나눗셈은 역수를 곱하는 것', sttAt: '2026-10-22T12:00:00Z' } } },
      { name: '장보고', grade: '고등학교 1학년', lumen_rec_code: 'EEE555', withdrawn: true },
      { name: '신사임당', grade: '고등학교 1학년', lumen_rec_code: 'FFF666' },
      { name: '강감찬', grade: '고등학교 1학년', lumen_rec_code: 'GGG777' },
      { name: '코드없음', grade: '중학교 1학년' },
    ],
    rec_topics: {
      byStudent: { AAA111: { '2026.10.21': { t: '개인주제 일차함수 기울기 설명해 보기' } }, CCC333: { '2026.10.21': { t: '쓰이면안되는개인주제' } } },
      byGrade: {
        '중2': { '2026.10.18': { t: '학년주제 연립방정식 풀이 설명해 보기', g: '대입법 / 가감법' }, '2026.10.12': { t: '너무옛날주제' } },
        '초6': { '2026.10.10': { t: '8일보다옛날주제' } },
      },
    },
    'submissions_AAA111': [{ id: '20261021_2130', title: '제목기울기설명', type: 'audio' }],
    'rec_read_2026-10-21': {
      date: '2026-10-21', updated: '2026-10-22T20:00:00Z', model: 'gemini-2.5-flash-lite',
      items: { ZZZ999: [{ file: 'ZZZ999_20261021_2000.webm', code: 'ZZZ999', grade: '중3', sec: 100, topic: { t: '', src: 'free' }, title: '', stt: '남의전문', sttSrc: 'gemini', summary: '남의요약', match: 'free', why: '', missing: '', err: '', at: 'x' }] },
      byGrade: { '중3': { n: 1, brief: '' } },
      fail: { BBB222: ['BBB222_20261021_2200.m4a'] },
    },
  };
  const files = {
    AAA111: [
      { name: 'AAA111_20261021_2130.webm', body: 'AUD|AAA111_20261021_2130' },
      { name: 'AAA111_20261019_2000.webm', body: 'AUD|AAA111_20261019_2000' },   // 범위 밖 (4일 전)
      { name: 'AAA111_20261023_0100.webm', body: 'AUD|AAA111_20261023_0100' },   // 오늘 — 범위 밖
      { name: 'AAA111_20261021_2130.jpg', body: 'x' },                            // 녹음 아님
      { name: '.emptyFolderPlaceholder', body: '' },
    ],
    BBB222: [{ name: 'BBB222_20261021_2200.m4a', body: 'AUD|BBB222_20261021_2200' }],
    CCC333: [{ name: 'CCC333_20261021_1900.mp3', body: 'AUD|CCC333_20261021_1900' }],
    DDD444: [{ name: 'DDD444_20261022_2000.webm', body: 'AUD|DDD444_20261022_2000' }],
    EEE555: [{ name: 'EEE555_20261022_2000.webm', body: 'AUD|EEE555_20261022_2000' }],
    FFF666: [
      { name: 'FFF666_20261022_2100.webm', body: 'AUD|FFF666_20261022_2100', missing: true },   // 내려받기 404
      { name: 'FFF666_20261022_2200.ogg', body: 'AUD|FFF666_20261022_2200' },
    ],
    GGG777: [{ name: 'GGG777_20261020_2000.wav', body: 'AUD|GGG777_20261020_2000', size: 25 * 1024 * 1024 }],
  };
  /* 받아쓰기 결과 (파일별) — 전문 · 음성 토큰 */
  const stt = {
    AAA111_20261021_2130: { text: '전문하나 기울기는 x가 1 늘 때 y가 늘어나는 양이고 y절편은 x가 0일 때 y값', audio: 222 * 32 },
    BBB222_20261021_2200: { text: '전문둘 연립방정식은 대입법으로 풀면 되고 가감법은 잘 모르겠어요', audio: 180 * 32 },
    CCC333_20261021_1900: { text: '전문셋 짧게 기울기', audio: 20 * 32 },
    FFF666_20261022_2200: { text: '[녹음 내용 없음]', audio: 95 * 32 },
  };
  const W = { store, files, stt, writes: [], calls: { list: 0, dl: 0, stt: 0, judge: 0, free: 0, brief: 0 }, models: [], fail503: over.fail503 || 0, model404: !!over.model404, sbDown: !!over.sbDown, judgeBodies: [], sttBodies: [] };
  return W;
}

const jres = (status, obj) => ({ ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => obj, text: async () => JSON.stringify(obj), arrayBuffer: async () => new ArrayBuffer(0) });

function fakeFetch(W) {
  return async function (url, init) {
    init = init || {};
    const method = init.method || 'GET';
    const u = String(url);
    if (u.startsWith(SB + '/rest/v1/lumen_store')) {
      if (W.sbDown) return jres(500, { message: 'down' });
      if (method === 'GET') {
        const key = decodeURIComponent((u.match(/key=eq\.([^&]+)/) || [])[1] || '');
        return jres(200, key in W.store ? [{ value: JSON.parse(JSON.stringify(W.store[key])) }] : []);
      }
      const rows = JSON.parse(init.body);
      rows.forEach((r) => { W.writes.push(r.key); W.store[r.key] = JSON.parse(JSON.stringify(r.value)); });
      return jres(201, []);
    }
    if (u === SB + '/storage/v1/object/list/recordings') {
      W.calls.list++;
      const b = JSON.parse(init.body); const code = b.prefix.replace(/\/$/, '');
      return jres(200, (W.files[code] || []).map((f) => ({ name: f.name, metadata: { size: f.size || Buffer.byteLength(f.body) } })));
    }
    if (u.startsWith(SB + '/storage/v1/object/recordings/')) {
      W.calls.dl++;
      const [code, name] = u.slice((SB + '/storage/v1/object/recordings/').length).split('/').map(decodeURIComponent);
      const f = (W.files[code] || []).find((x) => x.name === name);
      if (!f || f.missing) return jres(404, { message: 'not found' });
      const buf = Buffer.from(f.body);
      return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')) {
      const model = u.match(/models\/([^:]+):/)[1]; W.models.push(model);
      if (!init.headers || !init.headers['x-goog-api-key']) return jres(403, { error: { message: 'no key' } });
      if (W.model404 && model === 'gemini-2.5-flash-lite') return jres(404, { error: { message: 'models/gemini-2.5-flash-lite is not found' } });
      if (W.fail503 > 0) { W.fail503--; return jres(503, { error: { message: 'overloaded' } }); }
      const body = JSON.parse(init.body); const parts = body.contents[0].parts;
      const inl = parts.find((p) => p.inline_data);
      if (inl) {
        W.calls.stt++; W.sttBodies.push(inl.inline_data.mime_type);
        const id = Buffer.from(inl.inline_data.data, 'base64').toString().split('|')[1];
        const r = W.stt[id] || { text: '', audio: 0 };
        return jres(200, { candidates: [{ content: { parts: [{ text: r.text }] } }], usageMetadata: { promptTokenCount: r.audio + 60, candidatesTokenCount: 40, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 60 }, { modality: 'AUDIO', tokenCount: r.audio }] } });
      }
      const text = parts.map((p) => p.text).join('');
      const use = { promptTokenCount: 300, candidatesTokenCount: 50, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 300 }] };
      if (/\{"brief"/.test(text)) { W.calls.brief++; W.briefText = text; return jres(200, { candidates: [{ content: { parts: [{ text: '{"brief":"가감법을 여럿이 헷갈림"}' }] } }], usageMetadata: use }); }
      if (/정해진 주제 없음/.test(text)) { W.calls.free++; W.judgeBodies.push(text); return jres(200, { candidates: [{ content: { parts: [{ text: '{"summary":"분수의 나눗셈 방법을 설명했습니다.","err":""}' }] } }], usageMetadata: use }); }
      W.calls.judge++; W.judgeBodies.push(text);
      const ans = /가감법은 잘 모르겠/.test(text)
        ? { summary: '연립방정식 풀이 중 대입법을 설명했습니다.', match: 'part', why: '가감법 설명 없음', missing: '가감법', err: '' }
        : { summary: '일차함수의 기울기와 y절편을 설명했습니다.', match: 'ok', why: '핵심 두 가지 설명', missing: '무시돼야함', err: '' };
      return jres(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(ans) }] } }], usageMetadata: use });
    }
    throw new Error('예상 못 한 주소 ' + u);
  };
}

async function withWorld(W, opts) {
  const origFetch = global.fetch, origLog = console.log;
  const lines = []; const waits = [];
  global.fetch = fakeFetch(W);
  console.log = (...a) => { lines.push(a.join(' ')); };
  let res, err;
  try {
    res = await R.run(Object.assign({ sbUrl: SB, sbKey: 'service-fake', geminiKey: 'gem-fake', today: TODAY, sleep: async (ms) => { waits.push(ms); }, model: '' }, opts || {}));
  } catch (e) { err = e; }
  finally { global.fetch = origFetch; console.log = origLog; }
  return { res, err, lines, waits };
}

(async () => {
  /* ── 작은 함수들 ── */
  ok(JSON.stringify(R.datesInRange(TODAY, 3, '')) === '["2026-10-22","2026-10-21","2026-10-20"]', '날짜 범위: --days 3 = 어제부터 3일 (오늘 제외)');
  ok(JSON.stringify(R.datesInRange(TODAY, 3, '2026-10-15')) === '["2026-10-15"]', '날짜 범위: --date 면 그 날만');
  const pf = R.parseFile('AAA111_20261021_2130.m4a');
  ok(pf && pf.date === '2026-10-21' && pf.id === '20261021_2130' && pf.mime === 'audio/mp4', '파일 이름 → 날짜·id·mime (m4a→audio/mp4)');
  ok(R.parseFile('AAA111_20261021_2130.jpg') === null && R.parseFile('메모.txt') === null, '녹음이 아닌 파일은 거른다');
  ok(R.parseFile('A_20261021_2130.webm').mime === 'audio/webm' && R.parseFile('A_20261021_2130.mp3').mime === 'audio/mp3' && R.parseFile('A_20261021_2130.wav').mime === 'audio/wav' && R.parseFile('A_20261021_2130.ogg').mime === 'audio/ogg', 'mime: webm·mp3·wav·ogg');
  ok(R.gradeKey('중학교 2학년') === '중2' && R.gradeKey('초등학교 6학년') === '초6' && R.gradeKey('고등학교 1학년') === '고1' && R.gradeKey('') === '', '학년 키 (ultra_night_writer 와 같은 규칙)');
  ok(R.isShort(20, '말을 했어요') && R.isShort(200, '[녹음 내용 없음]') && R.isShort(200, '') && !R.isShort(200, '설명') && !R.isShort(null, '설명'), 'short 규칙: 30초 미만 · 빈 글 · [녹음 내용 없음]');
  const us = R.usageOf({ usageMetadata: { promptTokenCount: 7164, candidatesTokenCount: 40, promptTokensDetails: [{ modality: 'TEXT', tokenCount: 60 }, { modality: 'AUDIO', tokenCount: 7104 }] } });
  ok(us.sec === 222 && us.audio === 7104 && us.text === 100, 'sec = AUDIO 토큰 ÷ 32 (반올림)');
  ok(R.usageOf({ usageMetadata: { promptTokenCount: 10 } }).sec === null, 'AUDIO 토큰이 없으면 sec null');
  let bad = false; try { R.parseJudge('{"match":"maybe"}', false); } catch (e) { bad = true; }
  ok(bad && R.parseJudge('{"summary":"a","match":"OK","why":"w","missing":"m","err":""}', false).missing === '', '판정 값 검사 · part 가 아니면 missing 비움');
  const ar = R.parseArgs(['--days', '5', '--max', '10', '--codes', 'AAA111,BBB222', '--dry', '--force']);
  ok(ar.days === 5 && ar.max === 10 && ar.codes.length === 2 && ar.dry && ar.force && R.parseArgs([]).days === 3 && R.parseArgs([]).max === 80, '옵션 읽기 (기본 days 3 · max 80)');

  /* 주제 우선순위 */
  const W0 = makeWorld(); const rt = W0.store.rec_topics; const db = W0.store.or_studentdb;
  const tA = R.pickTopic(db[0], rt, '2026-10-21', '중2'), tB = R.pickTopic(db[1], rt, '2026-10-21', '중2'), tC = R.pickTopic(db[2], rt, '2026-10-21', '중2'), tD = R.pickTopic(db[3], rt, '2026-10-22', '초6');
  ok(tC.topic.src === 'mission' && /일차함수 그래프/.test(tC.topic.t), '주제 ① 원장 수동 미션이 개인 주제보다 먼저');
  ok(tA.topic.src === 'student' && /개인주제/.test(tA.topic.t), '주제 ② 학생별 주제가 학년 주제보다 먼저');
  ok(tB.topic.src === 'grade' && /학년주제/.test(tB.topic.t) && tB.hint === '대입법 / 가감법', '주제 ③ 학년 주제: 그 날짜가 없으면 7일 안 가장 가까운 지난 날짜 (+힌트)');
  ok(tD.topic.src === 'free' && tD.topic.t === '', '주제 없음: 7일보다 옛날 주제는 안 쓴다 → free');

  /* 합치기 */
  const m1 = R.mergeDay({ items: { X: [{ file: 'X_1' }], Y: [{ file: 'Y_1' }] }, byGrade: { '중1': { n: 2, brief: 'b' } }, fail: { X: ['X_2', 'X_3'] } }, '2026-10-21', 'm', 'X', [{ file: 'X_2' }], ['X_4']);
  ok(m1.items.X.length === 2 && m1.items.Y.length === 1 && m1.byGrade['중1'].brief === 'b' && JSON.stringify(m1.fail.X) === '["X_3","X_4"]', '합치기: 다른 학생·학년 요약 보존 · 성공한 파일은 실패 목록에서 뺌');

  /* ── 실제 실행 (가짜 서버) ── */
  const W = makeWorld({ fail503: 1 });
  const r1 = await withWorld(W, {});
  ok(!r1.err, '실행이 오류 없이 끝남' + (r1.err ? ' — ' + r1.err.message : ''));
  const d21 = W.store['rec_read_2026-10-21'], d22 = W.store['rec_read_2026-10-22'], d20 = W.store['rec_read_2026-10-20'];
  ok(!!d21 && !!d22, 'rec_read_<날짜> 가 녹음 날짜별로 저장됨');
  const it = (d, code) => ((d && d.items && d.items[code]) || []);
  ok(it(d21, 'AAA111').length === 1 && it(d21, 'AAA111')[0].file === 'AAA111_20261021_2130.webm', '날짜 거르기: 범위 안 녹음만 (4일 전·오늘·사진은 안 읽음)');
  ok(!Object.keys(W.store).some((k) => /^rec_read_2026-10-(19|23)$/.test(k)), '범위 밖 날짜 키는 만들지 않음');
  ok(it(d22, 'EEE555').length === 0 && W.calls.list === 6, '퇴원생·코드 없는 학생은 건너뜀 (목록 6명)');
  const a = it(d21, 'AAA111')[0];
  ok(a && a.code === 'AAA111' && a.grade === '중2' && a.sec === 222 && a.sttSrc === 'gemini' && /전문하나/.test(a.stt) && a.title === '제목기울기설명' && a.match === 'ok' && a.missing === '' && a.topic.src === 'student' && a.at, '항목 모양: code·grade·sec·topic·title·stt·sttSrc·match·at (계약 §1-1)');
  ok(['file', 'code', 'grade', 'sec', 'topic', 'title', 'stt', 'sttSrc', 'summary', 'match', 'why', 'missing', 'err', 'at'].every((k) => k in a), '항목 칸이 계약서 칸과 같다');
  const b = it(d21, 'BBB222')[0];
  ok(b && b.match === 'part' && b.missing === '가감법' && b.topic.src === 'grade' && b.sec === 180 && b.title === '', 'part 판정 · missing · 학년 주제 · 제목 없으면 빈 글');
  ok(!d21.fail || !d21.fail.BBB222, '전에 실패했던 파일이 이번에 성공하면 fail 에서 빠짐');
  const c = it(d21, 'CCC333')[0];
  ok(c && c.match === 'short' && c.sec === 20 && c.topic.src === 'mission', 'short: 30초 미만은 판정 안 함 (주제는 미션)');
  ok(!W.judgeBodies.some((t) => /전문셋/.test(t)), 'short 는 판정 호출을 하지 않음');
  const f2 = it(d22, 'FFF666');
  ok(f2.length === 1 && f2[0].match === 'short' && f2[0].file === 'FFF666_20261022_2200.ogg', 'short: [녹음 내용 없음] 은 판정 안 함');
  ok(d22.fail && JSON.stringify(d22.fail.FFF666) === '["FFF666_20261022_2100.webm"]', '내려받기 실패는 fail 에 적고 계속');
  ok(d20 && JSON.stringify(d20.fail.GGG777) === '["GGG777_20261020_2000.wav"]' && W.calls.dl === 5, '20MB 넘는 파일은 내려받지 않고 fail 에 적음');
  const dd = it(d22, 'DDD444')[0];
  ok(dd && dd.sttSrc === 'manual' && /손받아쓰기전문/.test(dd.stt) && dd.sec === null && dd.match === 'free' && dd.summary && dd.topic.src === 'free', '손 받아쓰기 있으면 Gemini 받아쓰기 건너뜀 · 주제 없으면 free(요약만)');
  ok(W.calls.stt === 4 && W.calls.judge === 2 && W.calls.free === 1, `Gemini 호출 수: 받아쓰기 4 · 판정 2 · 자유 1 (실제 ${W.calls.stt}·${W.calls.judge}·${W.calls.free})`);
  ok(W.sttBodies.indexOf('audio/mp4') >= 0 && W.sttBodies.indexOf('audio/mp3') >= 0 && W.sttBodies.indexOf('audio/ogg') >= 0, 'inline_data mime 은 확장자로');
  ok(W.judgeBodies.some((t) => /대입법 \/ 가감법/.test(t) && /학년주제/.test(t)), '판정 지시에 주제·힌트가 들어감');
  ok(!W.judgeBodies.some((t) => /홍길동|박하나|김유신/.test(t)), '판정 지시에 학생 이름을 보내지 않음');
  ok(d21.items.ZZZ999 && d21.items.ZZZ999[0].stt === '남의전문' && d21.byGrade['중3'].n === 1, '합치기: 전에 있던 다른 학생 항목·학년 요약이 남아 있음');
  ok(d21.byGrade['중2'] && d21.byGrade['중2'].n === 3 && d21.byGrade['중2'].brief === '가감법을 여럿이 헷갈림' && W.calls.brief === 1, '학년 요약: 중2 3건 → brief 한 번 (short 는 내용에서 뺌)');
  ok(!/전문|홍길동|AAA111/.test(W.briefText || ''), '학년 요약 지시에 이름·코드·전문 없음');
  ok(!d22.byGrade || !d22.byGrade['초6'], '1건뿐인 학년은 요약 안 함');
  ok(d21.date === '2026-10-21' && d21.model === 'gemini-2.5-flash-lite' && d21.updated, 'date·model·updated 기록');
  const last = W.store.rec_read_last;
  ok(last && last.made === 5 && last.fail === 2 && last.tokens.audio === (222 + 180 + 20 + 95) * 32 && last.tokens.text > 0 && last.model === 'gemini-2.5-flash-lite' && last.dates.length === 3 && last.at, `rec_read_last: made 5 · fail 2 · 토큰 합 (실제 made ${last && last.made} fail ${last && last.fail})`);
  ok(JSON.stringify(r1.waits) === '[8000]', '503 은 8초 쉬고 다시 (가짜 sleep)');
  ok(W.writes.indexOf('or_studentdb') < 0 && W.writes.every((k) => /^rec_read_/.test(k)), '저장은 rec_read_* 만 — 등록부(or_studentdb)에는 절대 안 씀');
  const logAll = r1.lines.join('\n');
  ok(!/AAA111|BBB222|CCC333|DDD444|FFF666|GGG777|홍길동|박하나|이순신|김유신|신사임당|강감찬|전문|손받아쓰기/.test(logAll) && /새로 읽음 5건/.test(logAll) && /토큰 합/.test(logAll), '로그: 건수·토큰만 — 이름·코드·전문 없음');

  /* 다시 돌리면 건너뜀 */
  const nStt = W.calls.stt, nJudge = W.calls.judge, nWrites = W.writes.length;
  const r2 = await withWorld(W, {});
  ok(!r2.err && W.calls.stt === nStt + 0 && W.calls.judge === nJudge, '다시 돌리면 이미 읽은 파일은 건너뜀 (실패한 것만 다시 시도)');
  ok(W.calls.brief === 1, '바뀐 것 없으면 학년 요약도 다시 안 부름');
  ok(r2.res.made === 0 && W.writes.length > nWrites, '다시 돌려도 rec_read_last 는 새로 적음');

  /* --force */
  const W2 = makeWorld(); await withWorld(W2, {});
  const s0 = W2.calls.stt;
  const r3 = await withWorld(W2, { force: true, date: '2026-10-21', codes: ['AAA111'] });
  ok(!r3.err && W2.calls.stt === s0 + 1 && W2.store['rec_read_2026-10-21'].items.AAA111.length === 1, '--force --date --codes: 그 학생 그 날만 다시 읽고 같은 파일은 한 칸으로 덮음');

  /* --max */
  const W3 = makeWorld(); const r4 = await withWorld(W3, { max: 2 });
  ok(r4.res.todo === 2 && /이월/.test(r4.lines.join('\n')), '--max 2: 두 건만 하고 나머지는 이월');

  /* --dry */
  const W4 = makeWorld(); const r5 = await withWorld(W4, { dry: true, geminiKey: '' });
  ok(!r5.err && r5.res.dry && W4.writes.length === 0 && W4.models.length === 0 && W4.calls.dl === 0 && r5.res.jobs === 7, '--dry: Gemini·내려받기·저장 없이 대상 건수만 (키 없어도 됨)');

  /* 모델 바꿈 */
  const W5 = makeWorld({ model404: true }); const r6 = await withWorld(W5, { codes: ['AAA111'] });
  ok(!r6.err && W5.store['rec_read_2026-10-21'].model === 'gemini-2.5-flash' && W5.store.rec_read_last.model === 'gemini-2.5-flash' && W5.models.filter((m) => m === 'gemini-2.5-flash-lite').length === 1, '모델 404 → gemini-2.5-flash 로 한 번 바꿔 계속');

  /* 재시도 한도 */
  const W6 = makeWorld({ fail503: 99 }); const r7 = await withWorld(W6, { codes: ['AAA111'] });
  ok(!r7.err && JSON.stringify(r7.waits) === '[8000,16000,24000,32000]' && W6.store['rec_read_2026-10-21'].fail.AAA111.length === 1, '503 계속이면 8·16·24·32초 뒤 4번까지만 → fail 에 적고 계속');

  /* 키 없음 · 서버 못 읽음 */
  const r8 = await withWorld(makeWorld(), { geminiKey: '' });
  ok(r8.err && /GEMINI_API_KEY/.test(r8.err.message), 'GEMINI_API_KEY 없으면 멈춤 (exit 1)');
  const r9 = await withWorld(makeWorld({ sbDown: true }), {});
  ok(r9.err && /읽기 실패/.test(r9.err.message), 'Supabase 를 못 읽으면 멈춤 (exit 1)');
  const r10 = await withWorld(makeWorld(), { sbUrl: '' });
  ok(r10.err && /SUPABASE_URL/.test(r10.err.message), 'SUPABASE_URL 없으면 멈춤');

  console.log(`\n${failN ? '❌' : '✅'} 통과 ${pass} / ${pass + failN}`);
  process.exit(failN ? 1 : 0);
})();
