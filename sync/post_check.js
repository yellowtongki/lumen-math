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
// 학생 코드는 무조건 막는다
const pii = body.match(/\b[A-Z0-9]{6}\b/g) || [];
// 점수는 「누구의 점수인지」가 붙어 있을 때만 막는다.
// 「200점 이상이면」 같은 제도 기준까지 막으면 쓸 수가 없다 (2026-10-12)
const scorePii = body.match(/(○○|아무개|[가-힣]{2,3}\s?(학생|군|양))[^\n]{0,15}?\d{1,3}점/g) || [];
// 사람이 눈으로 볼 수 있게 점수는 세어만 둔다
const scores = [...new Set(body.match(/\d{1,3}점/g) || [])];
// 2026-09-20 발행본에서 배운 것 (docs/lumen_blog_profile.md 4-5)
// 날짜는 「그날 있었던 일」을 쓰는 글에만 필요하다. 제도·시스템을 설명하는 글은
// 반 년 뒤에 읽어도 유효해야 하므로 날짜를 박으면 오히려 낡아 보인다 (2026-10-31 원장 지적).
// 머리말에 dated: false 를 적으면 이 검사를 건너뛴다.
const needDate = String(meta.dated || '').trim() !== 'false';
const hasDate = /\d{1,2}월\s?\d{1,2}일|\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/.test(body.slice(0, 400));
const hasAddr = /옥길로\s?116/.test(body);
// 지도(장소) 카드 안에 주소가 글자로 들어간다 → 본문에 또 적을 필요가 없다 (2026-10-11 원장 지시)
const hasMap = /\[지도:\s*루멘수학교습소\]/.test(body);
const sq = (body.match(/^■/gm) || []).length;
// 실사진 몇 곳이 필요한가 — 기본 3곳. 카드만 쓰는 홍보·안내 글은 머리말에 photos: 1 처럼 적는다
const photoSlots = (body.match(/\[실사진/g) || []).length;
const needPhotos = meta.photos === undefined ? 3 : (parseInt(meta.photos, 10) || 0);
// 본문의 카드 자리 — naver_draft.js 는 [카드 N: 파일.png] 줄을 보고 그림을 넣는다. 빠지면 카드 없이 올라간다
const slotFiles = [...body.matchAll(/^\[카드 \d+:\s*([^\]]+?)\s*\]$/gm)].map(m => m[1]);
const slotMissing = slotFiles.filter(f => !pngs.includes(f));
const vague = body.match(/오늘 오전|오늘 오후(?!에는 그 앞)|며칠 전|얼마 전/g) || [];
// 진도 레이스와 부딪히는 문장 (2026-10-18 원장 지적) — 프로필 5-1-2
const antiVolume = /많이 푸는 것보다/.test(body);
// 카드에서 「밖으로 나가는 글자」만 모은다 (_메모·파일 이름은 내부용이라 검사에서 뺀다)
// note 는 카드에 찍히는 글자다. 단 external(밖에서 받은 PNG)에서는 내부 메모라 뺀다
const skipKey = (card, k) => k.startsWith('_') || ['type', 'file', 'bg'].includes(k)
  || (card.type === 'external' && k === 'note');
const cardText = (spec.cards || []).flatMap(c => Object.entries(c)
  .filter(([k]) => !skipKey(c, k))
  .map(([, v]) => JSON.stringify(v))).join('\n');
// 학교 기출은 외부 공개 금지 규정이 있다 (2026-10-10 원장 지시) — 본문·카드에 드러내지 않는다
const KICHUL = /기출|지난 시험지|작년 시험지|전년도 문제/g;
const kichul = [...(body.match(KICHUL) || []), ...(cardText.match(KICHUL) || [])];
// 외부 서비스 이름은 글·카드·해시태그에 쓰지 않는다 (2026-10-11 원장 지시)
const VENDORS = ['매쓰플랫', '매스플랫', 'mathflat', '수학비서', '클래스바이', 'classby', '프리윌린'];
const vendorHay = `${body}\n${meta.hashtags || ''}\n${cardText}`;
const vendors = VENDORS.filter(v => new RegExp(v, 'i').test(vendorHay));

const checks = [
  ['제목 있음', !!meta.title, meta.title || '(없음)'],
  // 하한 1,000자: 클래스바이 기준은 1,050자였으나 원장님 발행본(2026-09-20)이 1,047자라 현실에 맞춤.
  // 1,400자 미만은 통과시키되 경고 — 길수록 검색에 유리하다는 건 일반적으로 맞다.
  ['본문 1,000자 이상 (목표 1,500)', plain.length >= 1000, `${plain.length}자`,
    plain.length < 1400 ? '통과하지만 1,500자에 가까울수록 좋습니다' : ''],
  // 6장은 하한이다. 학원앱 「적중 분석」 도구가 만든 카드뉴스는 12장이 나온다.
  ['카드 6장 이상 (cards.json)', (spec.cards || []).length >= 6, `${(spec.cards || []).length}장`],
  ['카드 PNG 6장 이상', pngs.length >= 6, `${pngs.length}장`],
  ['본문에 카드 자리가 카드 수만큼 있음', slotFiles.length === pngs.length,
    slotFiles.length === pngs.length ? `${slotFiles.length}곳`
      : `본문 ${slotFiles.length}곳 / 카드 ${pngs.length}장 — 「[카드 1: 01_cover.png]」 처럼 본문에 적어야 올라갑니다`],
  ['카드 자리의 파일이 모두 있음', slotMissing.length === 0, slotMissing.join(', ')],
  ['cards.json 과 PNG 수 일치', (spec.cards || []).length === pngs.length, `${(spec.cards || []).length} / ${pngs.length}`],
  [`실사진 자리 ${needPhotos}곳 이상`, photoSlots >= needPhotos,
    `${photoSlots}곳${meta.photos !== undefined ? ` (머리말 photos: ${meta.photos})` : ''}`],
  ['지도 [지도: 루멘수학교습소]', /\[지도:\s*루멘수학교습소\]/.test(body), ''],
  ['톡톡 연락 버튼 1개', /talk\.naver\.com\/w9d7umc/.test(body), ''],
  ['해시태그 8개 이상', hashtags.length >= 8, `${hashtags.length}개`],
  ['"옥길동 … 루멘수학" 2회 이상', region >= 2, `${region}회`],
  ['카드 질문이 본문에 그대로 있음', questions.every(q => body.includes(q)), questions.filter(q => !body.includes(q)).map(q => `빠짐: "${q}"`).join(' / ') || `${questions.length}개 확인`],
  ['본문에 이모지 없음', !emojiRe.test(body.replace(/❏/g, '')), ''],   // ❏ 는 전용 항목이 따로 본다
  ['학생 코드 없음', pii.length === 0, pii.join(', ')],
  ['개별 학생 점수 없음', scorePii.length === 0, scorePii.join(', '),
    scores.length ? `점수 ${scores.join(' ')} — 제도 기준이면 괜찮습니다. 특정 아이 점수가 아닌지 눈으로 보세요` : ''],
  ['모집 글이면 교습비·등록번호 표기', meta.recruit !== 'true' || /교습비 등 표시/.test(body), meta.recruit === 'true' ? '' : '모집 글 아님 → 생략'],
  ['미확정 빈칸(❏) 없음', !/❏/.test(body), ''],
  ['도입에 날짜가 있음', !needDate || hasDate,
    needDate ? (hasDate ? '' : '「9월 20일 일요일」처럼 날짜·요일을 적으세요')
             : '제도·시스템 글이라 건너뜀 (머리말 dated: false)'],
  ['주소 — 지도나 주소 한 줄 중 하나', hasMap || hasAddr,
    hasMap ? '지도 카드에 주소가 들어감' : (hasAddr ? '본문 끝 주소 한 줄' : '지도를 넣거나 맨 끝에 주소를 적으세요')],
  ['■ 기호는 첫 소제목 하나만', sq <= 1, `${sq}개`],
  ['「많이 푸는 것보다」를 쓰지 않음', true,
    antiVolume ? '⚠️ 찾았습니다' : '',
    antiVolume ? '진도 레이스와 부딪힙니다. 「푼 문제를 다시 맞힐 수 있을 때, 많이 푼 것이 점수가 됩니다」로 바꾸세요 (프로필 5-1-2)' : ''],
  ['외부 서비스 이름 없음', vendors.length === 0,
    vendors.length ? `「${vendors.join('」 「')}」 — 외부 서비스 이름은 쓰지 않습니다. 「루멘수학 시험대비자료」·「학원 학습 기록」 처럼 바꾸세요` : ''],
  ['학교 기출을 드러내지 않음', kichul.length === 0,
    kichul.length ? `「${[...new Set(kichul)].join('」 「')}」 — 학교 기출은 외부 공개 금지. 「시험대비자료」 같은 말로 바꾸세요 (본문·카드 문구 둘 다 봅니다)` : ''],
];
let fail = 0, warn = 0;
console.log(`\n📋 ${path.relative(ROOT, dir)} 검사\n`);
for (const [name, ok, note, warning] of checks) {
  if (!ok) fail++;
  const w = ok && warning;
  if (w) warn++;
  console.log(`${ok ? (w ? '⚠️ ' : '✅') : '❌'} ${name}${note ? `  — ${note}` : ''}${w ? `\n     ↳ ${warning}` : ''}`);
}
console.log(fail ? `\n❌ ${fail}개 항목을 고쳐야 합니다\n`
  : `\n✅ 전부 통과 — 네이버에 붙여넣어도 됩니다${warn ? ` (참고할 것 ${warn}개)` : ''}\n`);
process.exit(fail ? 1 : 0);
