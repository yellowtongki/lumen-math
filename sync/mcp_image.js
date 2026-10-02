#!/usr/bin/env node
/**
 * sync/mcp_image.js — 루멘 카드 배경 그림 MCP 서버 (GPT 연계)
 *
 * Claude가 «도구»처럼 직접 불러 쓰는 서버. 그림을 만들고 **그 결과를 Claude에게 그대로 돌려주어
 * Claude가 보고 판단**할 수 있게 한다. 이게 스크립트(sync/image_gen.js)와 다른 점이다.
 *
 *   스크립트 → 파일로만 나옴. Claude는 못 봄. 여러 장 한 번에 만들 때 좋다
 *   MCP     → Claude가 보고 "왼쪽 위가 복잡해 제목이 안 읽히겠다" → 바로 다시. 질을 높일 때 좋다
 *
 * 루멘 규칙이 서버 안에 박혀 있다 — 브랜드 색, 「왼쪽 위 비우기」 구도, 글자 전면 금지,
 * 학원 내부·사람 얼굴 금지. 그래서 Claude가 매번 안 적어도 지켜진다.
 *
 * 🔑 OPENAI_API_KEY 필요 · 맥미니에서 돈다 (클라우드는 OpenAI 차단)
 * 등록: 저장소 루트 `.mcp.json` 에 이미 적혀 있다. Claude Code 를 저장소 폴더에서 열면 자동으로 붙는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

const ROOT = path.resolve(__dirname, '..');
const API = 'https://api.openai.com/v1/images/generations';

const PRESETS = {
  desk:       '조용한 책상 위 정물 — 펼쳐진 공책, 연필, 각도기, 얇게 쌓인 문제집. 창가에서 들어오는 부드러운 빛. 사람은 없다',
  desk_night: '밤의 책상 — 스탠드 불빛이 공책 위에 동그랗게 떨어진다. 주변은 어둡고 따뜻하다. 사람은 없다',
  night:      '밤 도시의 창가 풍경을 흐리게 담은 배경. 창틀 너머 번지는 도시 불빛, 깊은 남색 하늘. 사람은 없다',
  paper:      '결이 보이는 종이와 노트의 가까운 질감. 연필 선의 흔적, 부드러운 그림자. 글자는 없다',
  window:     '이른 아침 교실 창가 — 빈 책상 위로 비껴드는 햇빛과 먼지. 사람은 없다',
  abstract:   '기하학적 추상 배경 — 수학적인 격자와 부드러운 곡선, 은은한 빛 번짐. 사물도 사람도 없다',
  gradient:   '아주 단순한 그라데이션 배경. 위는 깊은 남색, 아래로 갈수록 밝아진다. 미세한 입자 질감',
};

// 루멘 규칙 — 여기 박혀 있어서 매번 지켜진다
function buildPrompt(desc, textArea) {
  const area = { upper_left: 'UPPER-LEFT', upper: 'UPPER', center: 'CENTER', lower: 'LOWER' }[textArea] || 'UPPER-LEFT';
  return [
    `A photographic vertical background image (4:5 portrait) for a Korean math academy's social card.`,
    ``,
    `Scene: ${desc}`,
    ``,
    `Style: cinematic, calm, premium. Warm deep red (#c03f3f) and dark warm tones dominate; golden-yellow (#fdc108) as a small accent light.`,
    `Soft depth of field, gentle contrast, slightly desaturated. Quiet and studious — never flashy or cartoonish.`,
    ``,
    `Composition: keep the ${area} third visually simple and uncluttered — large text will be placed there.`,
    `Put the strongest detail away from that area. Leave breathing room; do not fill the frame edge to edge.`,
    ``,
    `CRITICAL — absolutely NO text, NO letters, NO numbers, NO words, NO signage, NO logos, NO watermarks,`,
    `NO handwriting, NO book titles, NO whiteboard writing of any kind, in any language.`,
    `NO recognizable human faces. NO depiction of a specific real school or academy interior.`,
  ].join('\n');
}

async function callOpenAI(prompt, quality) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 가 없습니다. 맥미니 환경변수에 넣어주세요.');
  const r = await fetch(API, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1536', quality: quality || 'high' }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status} — ${(await r.text()).slice(0, 300)}`);
  const d = ((await r.json()).data || [])[0] || {};
  if (d.b64_json) return d.b64_json;
  if (d.url) return Buffer.from(await (await fetch(d.url)).arrayBuffer()).toString('base64');
  throw new Error('응답에 이미지가 없습니다');
}

const server = new Server({ name: 'lumen-image', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'make_card_background',
    description:
      '루멘수학 카드(1080×1350)에 깔 배경 그림을 GPT로 만든다. 브랜드 색·구도·글자 금지 규칙이 ' +
      '서버에 박혀 있으므로 장면 설명만 주면 된다. 만든 그림을 그대로 돌려주니 보고 판단한 뒤 ' +
      '마음에 안 들면 설명을 바꿔 다시 부르면 된다. 글자·수식은 카드 생성기가 HTML로 얹으므로 ' +
      '여기서 글자를 넣으라고 요청하지 말 것(한글이 깨진다).',
    inputSchema: {
      type: 'object',
      properties: {
        scene: { type: 'string', description: '장면 설명 (한국어로 써도 된다). 예: "시험을 앞둔 늦은 밤, 문제집 위에 놓인 연필"' },
        preset: { type: 'string', enum: Object.keys(PRESETS), description: '바탕이 될 프리셋 (선택). scene 과 함께 쓰면 합쳐진다' },
        text_area: { type: 'string', enum: ['upper_left', 'upper', 'center', 'lower'], description: '카드 제목이 놓일 자리 — 그곳을 비워 둔다 (기본 upper_left)' },
        save_to: { type: 'string', description: '저장 경로 (저장소 기준). 예: "blog/2026-10-02-exam/bg_01.png". 비우면 저장하지 않고 보여주기만 한다' },
        quality: { type: 'string', enum: ['low', 'medium', 'high'], description: '기본 high. 시안을 여러 장 볼 때는 low 로 (싸다)' },
      },
      required: [],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'make_card_background') throw new Error('모르는 도구: ' + req.params.name);
  const a = req.params.arguments || {};
  const desc = [PRESETS[a.preset], a.scene].filter(Boolean).join('. ');
  if (!desc) throw new Error('scene 또는 preset 중 하나는 필요합니다');
  const prompt = buildPrompt(desc, a.text_area);

  let b64;
  try {
    b64 = await callOpenAI(prompt, a.quality);
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `❌ ${e.message}` }] };
  }

  let saved = '';
  if (a.save_to) {
    const out = path.resolve(ROOT, a.save_to);
    if (!out.startsWith(ROOT + path.sep)) throw new Error('저장 경로는 저장소 안이어야 합니다');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    saved = `\n저장: ${path.relative(ROOT, out)}  →  cards.json 의 "bg" 에 파일 이름을 적으세요.`;
  }
  return {
    content: [
      { type: 'text', text: `장면: ${desc}\n제목 자리: ${a.text_area || 'upper_left'} (비워 둠)${saved}` },
      { type: 'image', data: b64, mimeType: 'image/png' },
    ],
  };
});

(async () => {
  await server.connect(new StdioServerTransport());
  process.stderr.write('lumen-image MCP 서버 시작\n');
})().catch(e => { process.stderr.write('❌ ' + e.message + '\n'); process.exit(1); });
