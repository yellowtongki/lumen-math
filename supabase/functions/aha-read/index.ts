/* ═══════════════════════════════════════════════════════════════════
 * aha-read — IB아하노트 활동지 사진 읽기 (Supabase Edge Function)
 * ═══════════════════════════════════════════════════════════════════
 *
 * 왜 필요한가
 *   학생앱(student_v2-*.html)은 학생들이 주소만 알면 누구나 여는 공개 파일이라
 *   Claude API 키를 넣을 수 없다(넣으면 키가 그대로 노출된다).
 *   그래서 「사진을 읽는 일」만 이 함수가 대신 한다. 키는 Supabase 금고
 *   (Edge Function Secrets)에만 있고 학생 폰으로는 내려가지 않는다.
 *
 * 하는 일
 *   학생앱이 활동지 사진 주소를 보내면 → Claude Haiku가 손글씨를 읽어
 *   L·A·M·P 네 칸과 교재·쪽·번호·틀린이유를 JSON으로 돌려준다.
 *
 * 배포 방법(원장님용, 클릭만): docs/edge_function_deploy.md
 *
 * 필요한 금고 값(Secrets)
 *   ANTHROPIC_API_KEY  — 학원앱 설정에 넣어 둔 것과 같은 Claude 키
 *
 * 이 함수가 없어도 앱은 돌아간다(사진만 올라가고 선생님이 학원앱에서 읽음).
 * ═══════════════════════════════════════════════════════════════════ */

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_BYTES = 5 * 1024 * 1024; // 사진 5MB 상한 (학생앱이 1600px로 줄여서 보냄)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PROMPT = `사진은 루멘수학 「LAMP 활동지」 또는 학생 공책이다. 연필 손글씨를 읽어 JSON으로만 답한다.
칸: 머리(교재/프린트 이름 book, 쪽 page, 번호 num, 틀린이유 reason: 연산오류|문제잘못읽음|관련개념부족|문제이해못함|틀린이유모름),
L(문제 이해) A(이론·공식) M(풀이 논리) P(막힌 곳과 질문) retry(6단계 재풀이, 있으면) aha(7단계 AHA, 있으면).
규칙: 쓴 그대로 옮긴다(맞춤법 고치지 않음). 식은 x^2, 1/2, √ 처럼 한 줄로. 못 읽는 낱말은 「?」로 두고
빈 칸은 ""로. 읽지 못한 칸 이름을 unread 배열에 넣는다(L·A·M·P 중에서). 활동지가 아니라 공책이면 L·A·M·P 제목을 찾아 같은 규칙으로.
제목이 아예 없는 공책이면 글의 흐름으로 나누되, 확신이 없는 칸은 ""로 두고 unread에 넣는다.
concepts: 다음 영문 키 중 이 문제와 가장 관련 있는 것 최대 3개 —
change, equivalence, generalization, validity, approximation, model, pattern, quantity, representation, simplification, space, system.
출력: {"book":"","page":null,"num":"","reason":"","L":"","A":"","M":"","P":"","retry":"","aha":"","concepts":[],"unread":[]}`;

const RETRY_PROMPT = `사진은 루멘수학 「LAMP 활동지」의 6단계 재풀이 칸 또는 학생이 다시 푼 공책이다.
연필 손글씨를 읽어 JSON으로만 답한다.
retry: 다시 푼 풀이 과정을 쓴 그대로. answer: 마지막에 낸 최종 답만(예: "x=-4, 3"). 없으면 "".
aha: 7단계 AHA 칸(못 떠올린 발상·배운 점·원리 한 문장)이 있으면 쓴 그대로, 없으면 "".
못 읽는 낱말은 「?」로 둔다.
출력: {"retry":"","answer":"","aha":""}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** 사진 주소 → base64 (Claude에 그림으로 넘기기 위해) */
async function fetchImage(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('사진을 불러오지 못했습니다 (' + r.status + ')');
  const type = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) throw new Error('사진 형식이 아닙니다: ' + type);
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) throw new Error('사진이 너무 큽니다');
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)));
  }
  return { media_type: type, data: btoa(bin) };
}

/** 앞뒤에 설명이 붙어 와도 JSON 덩어리만 뽑아낸다 */
function parseJson(text: string) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e <= s) throw new Error('AI가 JSON을 돌려주지 않았습니다');
  return JSON.parse(text.slice(s, e + 1));
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 1200) : '');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST만 받습니다' }, 405);

  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return json({ error: 'ANTHROPIC_API_KEY 금고 값이 없습니다' }, 500);

  let body: { photo_url?: string; mode?: string };
  try { body = await req.json(); } catch { return json({ error: '요청을 읽지 못했습니다' }, 400); }

  const url = String(body.photo_url || '');
  // 우리 Supabase Storage 사진만 읽는다(아무 주소나 대신 받아 오지 않도록)
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//.test(url)) {
    return json({ error: '허용되지 않은 사진 주소입니다' }, 400);
  }
  const isRetry = body.mode === 'retry';

  try {
    const img = await fetchImage(url);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } },
            { type: 'text', text: isRetry ? RETRY_PROMPT : PROMPT },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error('anthropic 오류', resp.status, t.slice(0, 300));
      return json({ error: 'AI 호출 실패 (' + resp.status + ')' }, 502);
    }

    const data = await resp.json();
    const text = (data.content || []).map((c: { text?: string }) => c.text || '').join('');
    const raw = parseJson(text);

    if (isRetry) {
      return json({ ok: true, model: MODEL, at: new Date().toISOString(),
        retry: str(raw.retry), answer: str(raw.answer), aha: str(raw.aha) });
    }

    const CONCEPTS = ['change','equivalence','generalization','validity','approximation','model',
      'pattern','quantity','representation','simplification','space','system'];
    const REASONS = ['연산오류','문제잘못읽음','관련개념부족','문제이해못함','틀린이유모름'];
    const FIELDS = ['L','A','M','P'];

    const out = {
      ok: true,
      model: MODEL,
      at: new Date().toISOString(),
      book: str(raw.book).slice(0, 80),
      page: raw.page == null ? '' : String(raw.page).trim().slice(0, 20),
      num: str(raw.num).slice(0, 20),
      reason: REASONS.indexOf(str(raw.reason)) >= 0 ? str(raw.reason) : '',
      L: str(raw.L), A: str(raw.A), M: str(raw.M), P: str(raw.P),
      retry: str(raw.retry), aha: str(raw.aha),
      concepts: (Array.isArray(raw.concepts) ? raw.concepts : [])
        .map((c: unknown) => String(c)).filter((c: string) => CONCEPTS.indexOf(c) >= 0).slice(0, 3),
      unread: (Array.isArray(raw.unread) ? raw.unread : [])
        .map((c: unknown) => String(c).toUpperCase()).filter((c: string) => FIELDS.indexOf(c) >= 0),
    };
    // AI가 unread에 안 넣었어도 실제로 빈 칸이면 「못 읽음」으로 친다
    FIELDS.forEach((f) => {
      if (!out[f as 'L'] && out.unread.indexOf(f) < 0) out.unread.push(f);
    });

    return json(out);
  } catch (e) {
    console.error('aha-read 오류', e);
    return json({ error: (e as Error).message || '읽기 실패' }, 500);
  }
});
