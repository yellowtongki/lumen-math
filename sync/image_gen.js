#!/usr/bin/env node
/**
 * sync/image_gen.js — 카드 배경 그림 생성기 (GPT 이미지)
 *
 * 카드에 깔 «글자 없는 배경 그림»을 만든다. 글자는 카드 생성기가 HTML로 얹으므로
 * 여기서는 **절대 글자를 넣지 않는다** (생성형 AI는 한글을 깨뜨린다).
 *
 *   node sync/image_gen.js blog/<폴더>              # cards.json 을 읽어 필요한 배경을 만든다
 *   node sync/image_gen.js blog/<폴더> --dry        # 🔑 키 없이: 프롬프트만 출력 → ChatGPT에 붙여넣기
 *   node sync/image_gen.js blog/<폴더> --only 2     # 2번 카드 배경만
 *   node sync/image_gen.js --preset desk --out blog/<폴더>/bg_desk.png "창가 아침 빛"
 *
 * cards.json 에서 쓰는 법 — 카드에 다음 중 하나를 적는다:
 *   "bgPreset": "desk"                     프리셋만
 *   "bgPrompt": "창가에 놓인 노트와 연필"     직접 설명 (한국어로 써도 된다)
 *   "bgPreset": "desk", "bgPrompt": "..."   프리셋 + 추가 설명
 *   → 만들어진 파일 이름이 그 카드의 "bg" 에 자동으로 적힌다
 *
 * 🔑 환경변수: OPENAI_API_KEY (platform.openai.com). 맥미니에서 실행한다.
 *    한 장에 대략 $0.02~0.19 (품질 설정에 따라). --dry 로 프롬프트만 뽑으면 공짜다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEY = process.env.OPENAI_API_KEY || '';
const API = 'https://api.openai.com/v1/images/generations';

const args = process.argv.slice(2);
const opt = {
  dry: args.includes('--dry'),
  only: args.includes('--only') ? parseInt(args[args.indexOf('--only') + 1], 10) : null,
  preset: args.includes('--preset') ? args[args.indexOf('--preset') + 1] : null,
  out: args.includes('--out') ? args[args.indexOf('--out') + 1] : null,
  model: args.includes('--model') ? args[args.indexOf('--model') + 1] : 'gpt-image-1',
  quality: args.includes('--quality') ? args[args.indexOf('--quality') + 1] : 'high',
};
const positional = args.filter((a, i) =>
  !a.startsWith('--') && !['--only', '--preset', '--out', '--model', '--quality'].includes(args[i - 1]));
const log = (...a) => console.error(...a);

// ── 프리셋 ───────────────────────────────────────────────────────
// 학원 «내부»를 지어내지 않는다 (허위 광고). 사람 얼굴도 넣지 않는다.
const PRESETS = {
  desk:    '조용한 책상 위 정물 — 펼쳐진 공책, 연필, 각도기, 얇게 쌓인 문제집. 창가에서 들어오는 부드러운 빛. 사람은 없다',
  night:   '밤 도시의 창가 풍경을 흐리게 담은 배경. 창틀 너머 번지는 도시 불빛, 깊은 남색 하늘. 사람은 없다',
  paper:   '결이 보이는 종이와 노트의 가까운 질감. 연필 선의 흔적, 부드러운 그림자. 글자는 없다',
  desk_night: '밤의 책상 — 스탠드 불빛이 공책 위에 동그랗게 떨어진다. 주변은 어둡고 따뜻하다. 사람은 없다',
  abstract: '기하학적 추상 배경 — 수학적인 격자와 부드러운 곡선, 은은한 빛 번짐. 사물도 사람도 없다',
  gradient: '아주 단순한 그라데이션 배경. 위는 깊은 남색, 아래로 갈수록 밝아진다. 미세한 입자 질감',
  window:  '이른 아침 교실 창가 — 빈 책상 위로 비껴드는 햇빛과 먼지. 사람은 없다',
};

// 모든 프롬프트에 붙는 공통 규칙 (브랜드 + 안전장치)
function build(desc) {
  return [
    `A photographic vertical background image (4:5 portrait) for a Korean math academy's social card.`,
    ``,
    `Scene: ${desc}`,
    ``,
    `Style: cinematic, calm, premium. Deep navy (#0d2240) dominates; warm gold (#b5893a) as a small accent light.`,
    `Soft depth of field, gentle contrast, slightly desaturated. Quiet and studious — never flashy or cartoonish.`,
    ``,
    `Composition: keep the UPPER-LEFT third visually simple and uncluttered — large text will be placed there.`,
    `The strongest detail belongs in the lower-right. Leave breathing room; do not fill the frame edge to edge.`,
    ``,
    `CRITICAL — absolutely NO text, NO letters, NO numbers, NO words, NO signage, NO logos, NO watermarks,`,
    `NO handwriting, NO book titles, NO whiteboard writing of any kind, in any language.`,
    `NO recognizable human faces. NO depiction of a specific real school or academy interior.`,
  ].join('\n');
}

// ── 이미지 생성 ──────────────────────────────────────────────────
async function generate(prompt, outFile) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opt.model, prompt, n: 1,
      size: opt.model === 'dall-e-3' ? '1024x1792' : '1024x1536',
      ...(opt.model === 'gpt-image-1' ? { quality: opt.quality } : {}),
    }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status} — ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const d = (j.data || [])[0] || {};
  let buf;
  if (d.b64_json) buf = Buffer.from(d.b64_json, 'base64');
  else if (d.url) buf = Buffer.from(await (await fetch(d.url)).arrayBuffer());
  else throw new Error('응답에 이미지가 없습니다: ' + JSON.stringify(j).slice(0, 200));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, buf);
  return outFile;
}

// ── 실행 ─────────────────────────────────────────────────────────
(async () => {
  // (가) 한 장만 만들기 — --preset / --out
  if (opt.preset || opt.out) {
    const desc = [PRESETS[opt.preset] || opt.preset, ...positional].filter(Boolean).join('. ');
    const prompt = build(desc);
    const out = path.resolve(ROOT, opt.out || `blog/_sample/bg_${opt.preset || 'custom'}.png`);
    if (opt.dry) { console.log(prompt); return; }
    if (!KEY) { log('❌ OPENAI_API_KEY 가 필요합니다 (--dry 로는 프롬프트만 볼 수 있습니다)'); process.exit(1); }
    log('🎨 만드는 중…');
    log('✅ ' + path.relative(ROOT, await generate(prompt, out)));
    return;
  }

  // (나) 글 폴더의 cards.json 을 읽어 필요한 배경 만들기
  const folder = positional[0];
  if (!folder) { log('사용법: node sync/image_gen.js <글 폴더> [--dry] [--only N]'); process.exit(1); }
  const dir = path.resolve(ROOT, folder);
  const specFile = path.join(dir, 'cards.json');
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  const cards = spec.cards || [];

  const jobs = [];
  cards.forEach((c, i) => {
    const n = i + 1;
    if (opt.only && opt.only !== n) return;
    if (!c.bgPreset && !c.bgPrompt) return;
    if (c.bg && fs.existsSync(path.join(dir, c.bg)) && !opt.only && !opt.dry) {
      log(`⏭  ${n}번 — 배경이 이미 있습니다 (${c.bg}). 다시 만들려면 --only ${n}`);
      return;
    }
    const desc = [PRESETS[c.bgPreset] || c.bgPreset, c.bgPrompt].filter(Boolean).join('. ');
    jobs.push({ n, idx: i, desc, prompt: build(desc), file: `bg_${String(n).padStart(2, '0')}_${c.bgPreset || 'custom'}.png` });
  });

  if (!jobs.length) { log('만들 배경이 없습니다. cards.json 의 카드에 "bgPreset" 또는 "bgPrompt" 를 적어주세요.'); return; }

  if (opt.dry) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('🔑 키 없이 쓰는 법: 아래 프롬프트를 ChatGPT에 붙여넣고, 나온 그림을');
    console.log(`   ${folder}/ 폴더에 적힌 파일 이름으로 저장하세요.`);
    console.log(`${'='.repeat(70)}`);
    for (const j of jobs) {
      console.log(`\n\n━━━ ${j.n}번 카드 → ${j.file} ━━━\n`);
      console.log(j.prompt);
    }
    console.log('\n');
    return;
  }
  if (!KEY) { log('❌ OPENAI_API_KEY 가 필요합니다. --dry 를 붙이면 프롬프트만 뽑아 ChatGPT에 쓸 수 있습니다.'); process.exit(1); }

  for (const j of jobs) {
    log(`🎨 ${j.n}번 카드 배경 만드는 중… (${j.desc.slice(0, 40)}…)`);
    await generate(j.prompt, path.join(dir, j.file));
    cards[j.idx].bg = j.file;                       // cards.json 에 파일 이름을 적어 둔다
    fs.writeFileSync(specFile, JSON.stringify(spec, null, 2) + '\n', 'utf8');
    log(`   ✅ ${j.file}`);
  }
  log(`\n완료 — 이제 카드를 다시 만드세요:  node sync/card_render.js ${folder}`);
})().catch(e => { log('❌', e.message); process.exit(1); });
