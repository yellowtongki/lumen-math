#!/usr/bin/env node
/**
 * sync/keyword_volume.js — 검색량 조사기
 *
 * 네이버 검색광고 API(공식·무료)로 검색어의 월간 검색수를 가져온다.
 * 블랙위키 같은 사이트가 보여주는 그 숫자의 «원본»이다. 긁지 않고 정식으로 받아온다.
 *
 *   node sync/keyword_volume.js                    # 기본 검색어들 조사 → docs/keyword_volume.md
 *   node sync/keyword_volume.js 옥길중 반텐 아하노트   # 특정 낱말만
 *   node sync/keyword_volume.js --related          # 연관 검색어까지 넓게 (기본은 우리 목록만)
 *
 * 🔑 준비 (한 번만, 무료):
 *   1) searchad.naver.com 가입 (광고를 집행하지 않아도 계정은 만들 수 있다)
 *   2) 도구 → API 사용 관리 → 라이선스 발급
 *   3) 아래 3개를 환경변수에 넣는다
 *        NAVER_AD_CUSTOMER_ID, NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY
 *
 * ⚠️ 이 클라우드에서는 네이버가 막혀 있어 맥미니·학원 컴퓨터에서 돌린다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const CUSTOMER = process.env.NAVER_AD_CUSTOMER_ID || '';
const KEY = process.env.NAVER_AD_API_KEY || '';
const SECRET = process.env.NAVER_AD_SECRET_KEY || '';
const BASE = 'https://api.searchad.naver.com';
const OUT = path.join(ROOT, 'docs/keyword_volume.md');

const args = process.argv.slice(2);
const wantRelated = args.includes('--related');
const given = args.filter(a => !a.startsWith('--'));
const log = (...a) => console.error(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 조사할 기본 낱말 — 검색 점검기와 같은 목록 + 해시태그 후보
function defaultSeeds() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'serp_keywords.json'), 'utf8'));
  return [...new Set([
    ...cfg.keywords.map(k => k.q),
    '옥길동 학원', '부천 수학과외', '옥길중 시험범위', '범박고 내신',
    '관리형 학원', '자기주도학습 학원', '수학 오답노트', '중등 수학 내신',
    '텐투텐', '반텐', '아하노트',
  ])];
}

// 네이버 검색광고 API 서명 (HMAC-SHA256)
function headers(method, uri) {
  const ts = Date.now().toString();
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${method}.${uri}`).digest('base64');
  return { 'X-Timestamp': ts, 'X-API-KEY': KEY, 'X-Customer': CUSTOMER, 'X-Signature': sig, 'Content-Type': 'application/json' };
}

const num = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  if (s.startsWith('<')) return 5;          // "< 10" → 대략 5로 본다
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

async function fetchVolumes(keywords) {
  const out = new Map();
  // 한 번에 5개까지. 띄어쓰기를 빼야 인식이 잘 된다 (API 규칙)
  for (let i = 0; i < keywords.length; i += 5) {
    const chunk = keywords.slice(i, i + 5);
    const uri = '/keywordstool';
    const qs = `?hintKeywords=${encodeURIComponent(chunk.map(k => k.replace(/\s+/g, '')).join(','))}&showDetail=1`;
    log(`🔎 ${i + 1}~${i + chunk.length} / ${keywords.length}`);
    const r = await fetch(BASE + uri + qs, { headers: headers('GET', uri) });
    if (!r.ok) throw new Error(`검색광고 API ${r.status} — ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    for (const k of (j.keywordList || [])) {
      const pc = num(k.monthlyPcQcCnt), mo = num(k.monthlyMobileQcCnt);
      out.set(k.relKeyword, {
        kw: k.relKeyword, pc, mobile: mo, total: (pc || 0) + (mo || 0),
        comp: k.compIdx || '', ads: num(k.plAvgDepth),
        asked: chunk.some(c => c.replace(/\s+/g, '') === k.relKeyword),
      });
    }
    await sleep(400);
  }
  return [...out.values()];
}

function render(rows, seeds) {
  const asked = rows.filter(r => r.asked).sort((a, b) => b.total - a.total);
  const extra = rows.filter(r => !r.asked).sort((a, b) => b.total - a.total).slice(0, 25);
  const band = (t) => t >= 5000 ? '경쟁 셈' : t >= 500 ? '노려볼 만함' : t >= 50 ? '작지만 확실' : '거의 안 찾음';
  const row = (r) => `| ${r.kw} | ${r.total.toLocaleString()} | ${(r.mobile ?? 0).toLocaleString()} | ${(r.pc ?? 0).toLocaleString()} | ${r.comp || '—'} | ${band(r.total)} |`;
  const L = [];
  L.push('# 검색어 월간 검색수 — 루멘수학');
  L.push('');
  L.push(`**조사일**: ${new Date().toISOString().slice(0, 10)} · 출처: **네이버 검색광고 API**(공식) · \`node sync/keyword_volume.js\``);
  L.push('');
  L.push('> 네이버에서 지난 한 달간 그 낱말을 검색한 횟수다. 블랙위키 같은 사이트가 보여주는 숫자와 같은 원본이다.');
  L.push('> `< 10` 은 너무 적어 네이버가 숨긴 값이라 **5로 적었다**. 광고 경쟁도는 그 낱말로 광고하려는 업체가 많은지를 뜻한다.');
  L.push('');
  L.push('## 우리가 쓰는 낱말');
  L.push('');
  L.push('| 검색어 | 월간 검색수 | 휴대폰 | PC | 광고 경쟁 | 판단 |');
  L.push('|---|---:|---:|---:|---|---|');
  asked.forEach(r => L.push(row(r)));
  L.push('');
  const dead = asked.filter(r => r.total < 50);
  if (dead.length) {
    L.push('### ⚠️ 거의 아무도 안 찾는 낱말');
    L.push('');
    L.push(dead.map(r => `\`${r.kw}\``).join(' · ') + ' — 해시태그로는 남겨도 되지만 **제목·소제목에 넣을 값어치는 없다.**');
    L.push('');
  }
  if (extra.length) {
    L.push('## 네이버가 같이 알려준 연관 검색어 (우리가 안 쓰던 말)');
    L.push('');
    L.push('여기 있는 말 중 검색수가 있고 우리가 쓸 수 있는 주제라면 **다음 글감**이다.');
    L.push('');
    L.push('| 검색어 | 월간 검색수 | 휴대폰 | PC | 광고 경쟁 | 판단 |');
    L.push('|---|---:|---:|---:|---|---|');
    extra.forEach(r => L.push(row(r)));
    L.push('');
  }
  L.push('## 해시태그 후보 (검색수 순)');
  L.push('');
  const tags = [...asked, ...extra].filter(r => r.total >= 50).slice(0, 15)
    .map(r => '#' + r.kw.replace(/\s+/g, ''));
  L.push(tags.join(' ') || '(검색수가 있는 낱말이 없습니다)');
  L.push('');
  L.push('> 해시태그는 검색수만 보고 고르지 않는다. **글 내용과 맞는 것**만 쓴다.');
  L.push('> 검색수가 큰 낱말(#중등수학 같은)은 경쟁이 세서 우리 글이 묻힌다. **지역이 붙은 낱말이 우리에게 유리하다.**');
  L.push('');
  return L.join('\n');
}

(async () => {
  if (!CUSTOMER || !KEY || !SECRET) {
    log('❌ 환경변수가 필요합니다: NAVER_AD_CUSTOMER_ID, NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY');
    log('   searchad.naver.com → 도구 → API 사용 관리 에서 무료로 발급받습니다.');
    process.exit(1);
  }
  const seeds = given.length ? given : defaultSeeds();
  let rows = await fetchVolumes(seeds);
  if (!wantRelated) rows = rows.filter(r => r.asked || r.total >= 100);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, render(rows, seeds), 'utf8');
  log(`✅ ${path.relative(ROOT, OUT)} — 낱말 ${rows.length}개`);
})().catch(e => { log('❌', e.message); process.exit(1); });
