#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════
 * 학교 정보 가져오기 — 되는지 확인만 하는 시험용 코드
 * ═══════════════════════════════════════════════════════════════════
 *
 * 원장님 질문: 「학교알리미에서 학교 정보를 받아와 블로그·학원앱에 쓸 수 있나?」
 *
 * 우리 개발용 컴퓨터는 정부 사이트 접속이 막혀 있어서 확인이 안 된다.
 * 하지만 수집기는 깃허브 서버에서 돌고 거기는 인터넷이 열려 있으므로,
 * 이 파일을 깃허브에서 한 번 돌려 「실제로 되는지」를 눈으로 확인한다.
 *
 * 확인할 것 (인증키 없이):
 *   ① 나이스(NEIS) 학교기본정보 — 옥길중학교를 찾을 수 있나
 *   ② 나이스 학사일정        — 시험일(중간·기말고사)이 나오나  ← 가장 값진 것
 *   ③ 학교알리미(schoolinfo) — 접속 자체가 되나
 *
 * ※ 인증키가 없으면 나이스는 5건만 맛보기로 준다. 그래도 「되는지」는 알 수 있다.
 * ※ 아무것도 저장하지 않는다. 화면에 결과만 찍는다.
 */

const NEIS = 'https://open.neis.go.kr/hub';
const KEY = process.env.NEIS_KEY || '';          // 있으면 쓰고, 없으면 맛보기

const line = (s) => console.log(s);
const head = (s) => { line(''); line('━'.repeat(64)); line(s); line('━'.repeat(64)); };

async function get(url, ms = 20000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { signal: ac.signal, headers: { 'user-agent': 'lumen-math-probe/1' } });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { ok: r.ok, status: r.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, err: e.message };
  } finally { clearTimeout(t); }
}

/* 나이스 응답에서 행 목록 꺼내기 — {키이름:[{head:[...]},{row:[...]}]} 구조 */
function rows(j, name) {
  if (!j) return { rows: [], msg: '응답이 JSON이 아님' };
  if (j.RESULT) return { rows: [], msg: `${j.RESULT.CODE} ${j.RESULT.MESSAGE}` };
  const box = j[name];
  if (!Array.isArray(box)) return { rows: [], msg: '예상과 다른 모양: ' + Object.keys(j).join(',') };
  const h = box.find((x) => x.head), r = box.find((x) => x.row);
  const total = h && h.head && h.head[0] && h.head[0].list_total_count;
  return { rows: (r && r.row) || [], total, msg: '' };
}

(async () => {
  line('학교 정보 가져오기 시험 — ' + new Date().toISOString());
  line('인증키: ' + (KEY ? '있음' : '없음 (맛보기 5건만 옴)'));

  /* ── ① 학교 찾기 ────────────────────────────────────────── */
  head('① 나이스 학교기본정보 — 옥길중학교 찾기');
  const q1 = `${NEIS}/schoolInfo?Type=json&pIndex=1&pSize=20&SCHUL_NM=${encodeURIComponent('옥길중학교')}`
    + (KEY ? `&KEY=${KEY}` : '');
  const r1 = await get(q1);
  line(`요청: ${q1.replace(KEY, '***')}`);
  line(`응답: HTTP ${r1.status}${r1.err ? ' · ' + r1.err : ''}`);
  let school = null;
  if (r1.json) {
    const { rows: rs, msg } = rows(r1.json, 'schoolInfo');
    if (msg) line('메시지: ' + msg);
    rs.forEach((s) => {
      line(`  · ${s.SCHUL_NM} (${s.LCTN_SC_NM} ${s.JU_ORG_NM || ''}) · 코드 ${s.ATPT_OFCDC_SC_CODE}/${s.SD_SCHUL_CODE}`);
      line(`    주소 ${s.ORG_RDNMA || '-'} · 설립 ${s.FOND_SC_NM || '-'} · 개교 ${s.FOAS_MEMRD || '-'}`);
      if (!school && /부천|경기/.test(String(s.LCTN_SC_NM) + String(s.ORG_RDNMA))) school = s;
    });
    if (!school && rs.length) school = rs[0];
  } else { line('본문(앞 300자): ' + String(r1.text || '').slice(0, 300)); }

  /* ── ② 학사일정 = 시험일 ────────────────────────────────
   * 인증키가 없으면 5건만 오므로, 「시험이 있을 법한 구간」으로 잘게 나눠
   * 여러 번 물어본다. 이러면 키 없이도 시험 일정이 등록돼 있는지 확인된다. */
  head('② 나이스 학사일정 — 시험일이 나오나 (가장 값진 것)');
  const found = [];
  if (!school) { line('학교를 못 찾아서 건너뜀'); }
  else {
    const 구간 = [
      ['1학기 중간 즈음', '20260415', '20260510'],
      ['1학기 기말 즈음', '20260620', '20260715'],
      ['2학기 중간 즈음', '20260920', '20261010'],   // ★ 원장님: 시험이 10월 1일에 끝난다
      ['2학기 기말 즈음', '20261120', '20261220'],
    ];
    for (const [나름, from, to] of 구간) {
      const q = `${NEIS}/SchoolSchedule?Type=json&pIndex=1&pSize=100`
        + `&ATPT_OFCDC_SC_CODE=${school.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${school.SD_SCHUL_CODE}`
        + `&AA_FROM_YMD=${from}&AA_TO_YMD=${to}` + (KEY ? `&KEY=${KEY}` : '');
      const r = await get(q);
      const { rows: rs, total, msg } = r.json ? rows(r.json, 'SchoolSchedule') : { rows: [], msg: 'JSON 아님' };
      line(`\n▸ ${나름} (${from}~${to}) — HTTP ${r.status}${total ? ` · 전체 ${total}건 중 ${rs.length}건` : ''}${msg ? ' · ' + msg : ''}`);
      rs.forEach((e) => {
        const 시험 = /고사|시험|평가/.test(String(e.EVENT_NM));
        if (시험) found.push(`${e.AA_YMD} ${e.EVENT_NM}`);
        line(`   ${시험 ? '★' : ' ·'} ${e.AA_YMD} ${e.EVENT_NM}${e.EVENT_CNTNT ? ' — ' + e.EVENT_CNTNT : ''}`);
      });
      await new Promise((z) => setTimeout(z, 300));
    }
    line('');
    line(found.length
      ? `★★ 시험 일정 ${found.length}건 확인 — 시험일 자동 설정 가능\n   ` + found.join('\n   ')
      : '   시험 일정이 안 보임 — 학교가 학사일정에 시험을 안 올렸거나, 5건 제한에 밀렸을 수 있음');
  }

  /* ── ③ 학교알리미 접속 자체 ───────────────────────────── */
  head('③ 학교알리미(schoolinfo.go.kr) — 접속이 되나');
  for (const u of ['https://www.schoolinfo.go.kr/ng/pi/pnngpi_a01_l0.do',
                   'https://www.data.go.kr']) {
    const r = await get(u, 15000);
    line(`  ${u}\n    → HTTP ${r.status}${r.err ? ' · ' + r.err : ''} · 본문 ${(r.text || '').length}바이트`);
  }

  head('끝');
})().catch((e) => { console.error('오류:', e.message); process.exit(1); });
