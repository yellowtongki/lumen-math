#!/usr/bin/env node
/**
 * sync/post_check.js — 검사기 (4단계 전 마지막 관문)
 *
 * 글 폴더의 post.md + cards.json + cards/*.png 를 docs/lumen_blog_profile.md 6번 규격대로 검사한다.
 *
 *   node sync/post_check.js blog/2026-09-20-banten
 *
 * post.md 형식 (맨 위 --- 사이가 머리말):
 *   ---
 *   title: 제목
 *   date: 2026-09-20
 *   recruit: false        ← true 면 교습비·등록번호 표기 블록이 있어야 통과
 *   hashtags: #옥길동수학학원 #부천수학학원 …
 *   ---
 *   본문 (마크다운). 사진 자리는 [실사진: 설명], 지도는 [지도: 루멘수학교습소]
 *
 * 하나라도 ❌ 면 종료코드 1 (원장님이 붙여넣기 전에 고친다).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const folder = process.argv[2];
if (!folder) { console.error('사용법: node sync/post_check.js <글 폴더>'); process.exit(1); }
const dir = path.resolve(ROOT, folder);

const raw = fs.readFileSync(path.join(dir, 'post.md'), 'utf8');
const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!m) { console.error('❌ post.md 맨 위에 --- 머리말이 없습니다'); process.exit(1); }
const meta = {}; m[1].split('\n').forEach(l => { const i = l.indexOf(':'); if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
const body = m[2];
const spec = fs.existsSync(path.join(dir, 'cards.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'cards.json'), 'utf8')) : { cards: [] };
const pngs = fs.existsSync(path.join(dir, 'cards')) ? fs.readdirSync(path.join(dir, 'cards')).filter(f => f.endsWith('.png')) : [];

// 글자수: 마크다운 기호·사진/지도 자리·해시태그 제외, 공백 제외
const plain = body.replace(/\[(실사진|지도|톡톡)[^\]]*\]/g, '').replace(/[#*>`|_\-]/g, '').replace(/\s/g, '');
const hashtags = (meta.hashtags || '').split(/\s+/).filter(t => t.startsWith('#'));
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{1F1E6}-\u{1F1FF}]/u;
const questions = (spec.cards || []).filter(c => c.type === 'qa').map(c => c.q);
const region = (body.match(/옥길동[^\n]{0,20}루멘수학/g) || []).length;
const pii = body.match(/\b[A-Z0-9]{6}\b|\d{2,3}점(?!\s*미만|\s*이상)/g) || [];

const checks = [
  ['제목 있음', !!meta.title, meta.title || '(없음)'],
  ['본문 1,050자 이상 (목표 1,500)', plain.length >= 1050, `${plain.length}자`],
  ['카드 6장 (cards.json)', (spec.cards || []).length === 6, `${(spec.cards || []).length}장`],
  ['카드 PNG 6장 생성됨', pngs.length === 6, `${pngs.length}장`],
  ['실사진 자리 3곳 이상', (body.match(/\[실사진/g) || []).length >= 3, `${(body.match(/\[실사진/g) || []).length}곳`],
  ['지도 [지도: 루멘수학교습소]', /\[지도:\s*루멘수학교습소\]/.test(body), ''],
  ['톡톡 연락 버튼 1개', /talk\.naver\.com\/w9d7umc/.test(body), ''],
  ['해시태그 8개 이상', hashtags.length >= 8, `${hashtags.length}개`],
  ['"옥길동 … 루멘수학" 2회 이상', region >= 2, `${region}회`],
  ['카드 질문이 본문에 그대로 있음', questions.every(q => body.includes(q)), questions.filter(q => !body.includes(q)).map(q => `빠짐: "${q}"`).join(' / ') || `${questions.length}개 확인`],
  ['본문에 이모지 없음', !emojiRe.test(body), ''],
  ['학생 코드·개별 점수 없음', pii.length === 0, pii.join(', ')],
  ['모집 글이면 교습비·등록번호 표기', meta.recruit !== 'true' || /교습비 등 표시/.test(body), meta.recruit === 'true' ? '' : '모집 글 아님 → 생략'],
  ['미확정 빈칸(❏) 없음', !/❏/.test(body), ''],
];
let fail = 0;
console.log(`\n📋 ${path.relative(ROOT, dir)} 검사\n`);
for (const [name, ok, note] of checks) { if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${name}${note ? `  — ${note}` : ''}`); }
console.log(fail ? `\n❌ ${fail}개 항목을 고쳐야 합니다\n` : '\n✅ 전부 통과 — 네이버에 붙여넣어도 됩니다\n');
process.exit(fail ? 1 : 0);
