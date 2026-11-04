#!/usr/bin/env node
/**
 * 🌙 밤 9시 50분 «오늘 채점 가져오기» 요청 남기기 (원장 2026-11-04 「수업이 밤 10시에 끝난다 — 9시 50분에 읽어 와 10시부터 울트라 일일」)
 *   학원앱 울트라일일 「🔄 지금 가져오기」 단추와 똑같은 요청(lumen_store 'mf_collect_req')을 남긴다.
 *   그다음 mathflat-ondemand.yml 을 «바로 실행»(workflow_dispatch) 해야 한다 — GitHub 의 5분마다 예약은 자주 몇 시간씩 밀린다
 *   (11/4 실측: 하루에 3번만 돌았다 · 정기 수집 16·18·20·22시 모두 안 돌았다). 바로 실행하면 수 초 안에 시작하고, 학생 기록은 약 5분 뒤 들어온다.
 *   이미 요청이 대기·진행 중이면 새로 쓰지 않는다(그 요청을 그대로 처리하게).
 * 사용: node sync/night_collect_kick.js      (SUPABASE_URL · SUPABASE_SERVICE_KEY)
 */
const W = require('./wrongtwin_make.js');
(async () => {
  const r = await W.q('lumen_store?select=value&key=eq.mf_collect_req');
  let v = r[0] && r[0].value; if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
  const kst = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  if (v && (v.status === 'requested' || v.status === 'running')) {
    const age = (Date.now() - Date.parse(v.startedAt || v.reqAt || 0)) / 60000;
    if (v.status === 'requested' || age < 60) { console.log('이미 요청이 있음 —', v.status, v.reqAt, '→ 그대로 둔다 (바로 실행만 하면 된다)'); return; }
  }
  const req = { by: 'night_2150', date: kst, reqAt: new Date().toISOString(), status: 'requested' };
  await W.setItem('mf_collect_req', req);
  console.log('요청 남김', JSON.stringify(req));
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
