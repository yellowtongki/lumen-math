#!/usr/bin/env node
/* 시험 대비 요약집(부스터북) 생성기 — A4 인쇄용
 *
 * exam_report_gen.js 가 --analysis 로 내보낸 분석 JSON을 읽어
 * 학생에게 나눠 줄 10쪽짜리 A4 요약집(HTML)을 만든다.
 * 브라우저에서 열고 Ctrl+P → "PDF로 저장" 하면 그대로 인쇄본이 된다.
 *
 * 사용법:
 *   node sync/exam_report_gen.js --data ... --out ... --analysis sync/_debug/an_m1.json
 *   node sync/exam_booklet_gen.js --analysis sync/_debug/an_m1.json \
 *     --out 옥길중_중1_요약집.html
 *
 * 구성(10쪽): 표지 / 이번 시험 한눈에 / 필수 이론 ①② / 반복 유형 8개(2개씩 4쪽)
 *             / 서술형·고난도 / 셀프 체크리스트 + 정답
 *
 * ⚠️ 기출 문항 이미지가 들어가므로 학원 수강생 배포용으로만 쓴다(저장소 커밋 금지).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ANALYSIS = arg('analysis');
const OUT = arg('out');
if (!ANALYSIS || !OUT) { console.error('필수 인자: --analysis <분석JSON> --out <파일.html>'); process.exit(1); }

const A = JSON.parse(fs.readFileSync(ANALYSIS, 'utf8'));
const IMG_DIR = path.join(__dirname, '_debug', 'exam_images');
const MAP_FILE = path.join(__dirname, '_debug', 'ms_exam_images_map.json');
const IMGMAP = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8')) : {};

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function imgData(url) {
  if (!url || !IMGMAP[url]) return null;
  const fp = path.join(IMG_DIR, IMGMAP[url]);
  if (!fs.existsSync(fp)) return null;
  const ext = IMGMAP[url].endsWith('webp') ? 'webp' : 'png';
  return `data:image/${ext};base64,${fs.readFileSync(fp).toString('base64')}`;
}

// ── 단원별 필수 이론 ───────────────────────────────────
// 새 학년·단원을 만들 때 여기에 추가한다. (교재로 확인한 내용만 넣을 것)
const UNIT_THEORY = {
  '정비례와 반비례': {
    lead: '이번 시험 배점의 가장 큰 덩어리입니다. 여기서 흔들리면 등급이 흔들립니다.',
    cards: [
      { t: '좌표평면', b: '점 P(a, b)에서 <b>a는 x좌표, b는 y좌표</b>. 사분면의 부호는 제1(+,+) · 제2(−,+) · 제3(−,−) · 제4(+,−). x축 위의 점은 (a, 0), y축 위의 점은 (0, b)이고 <b>축 위의 점은 어느 사분면에도 속하지 않는다.</b>' },
      { t: '정비례 y = ax (a ≠ 0)', b: 'x가 2배·3배가 되면 y도 2배·3배가 된다. 곧 <b>몫 y ÷ x = a 가 항상 일정</b>하다. 그래프가 지나는 점 (p, q)를 대입하면 <b>a = q ÷ p</b>.' },
      { t: '정비례 그래프', b: '<b>원점을 지나는 직선.</b> a &gt; 0이면 제1·3사분면(오른쪽 위로), a &lt; 0이면 제2·4사분면(오른쪽 아래로). |a|가 클수록 y축 쪽으로 가파르다.' },
      { t: '반비례 y = a/x (a ≠ 0)', b: 'x가 2배가 되면 y는 ½배가 된다. 곧 <b>곱 x × y = a 가 항상 일정</b>하다. 지나는 점 (p, q)를 대입하면 <b>a = p × q</b>. — 시험에 가장 많이 나오는 계산이다.' },
      { t: '반비례 그래프', b: '<b>원점에 대하여 대칭인 한 쌍의 매끄러운 곡선.</b> a &gt; 0이면 제1·3사분면, a &lt; 0이면 제2·4사분면. 좌표축에 한없이 가까워지지만 <b>만나지는 않는다.</b>' },
      { t: '옥길중이 자주 내는 세 가지', b: '① <b>정수 좌표의 개수</b> = a의 약수의 개수(음수쌍도 센다) ② <b>두 그래프의 교점</b>은 두 식을 연립 ③ 그래프 위의 점으로 만든 <b>도형의 넓이</b>.' },
    ],
    table: {
      head: ['', '정비례 y = ax', '반비례 y = a/x'],
      rows: [
        ['일정한 값', 'y ÷ x = a', 'x × y = a'],
        ['그래프 모양', '원점을 지나는 직선', '원점 대칭인 곡선 두 개'],
        ['a &gt; 0', '제1 · 3사분면', '제1 · 3사분면'],
        ['a &lt; 0', '제2 · 4사분면', '제2 · 4사분면'],
        ['점 (p, q)로 a 구하기', 'a = q ÷ p', 'a = p × q'],
      ],
    },
  },
  '기본 도형': {
    cards: [
      { t: '점 · 선 · 면', b: '선과 선이 만나면 <b>교점</b>, 면과 면이 만나면 <b>교선</b>. 직선 AB · 반직선 AB · 선분 AB는 서로 다르다 — <b>반직선은 시작점과 방향이 모두 같아야 같은 반직선</b>이다.' },
      { t: '거리와 중점', b: '두 점 사이의 거리 = 선분 AB의 길이. 점 M이 선분 AB의 중점이면 <b>AM = MB = ½ AB</b>. 좌표가 주어지면 거리는 좌표의 차로 구한다.' },
      { t: '각', b: '평각 180°, 직각 90°. <b>맞꼭지각의 크기는 같다.</b> 한 점에서 만나는 각들의 합이 180°(또는 360°)임을 이용해 미지의 각을 구한다.' },
      { t: '수직과 거리', b: '두 직선이 직각으로 만나면 수직(⊥). 선분을 수직으로 이등분하는 직선이 <b>수직이등분선</b>. 점에서 직선에 내린 수선의 발까지의 길이가 <b>점과 직선 사이의 거리</b>이다.' },
    ],
  },
  '위치 관계': {
    cards: [
      { t: '평면에서 두 직선', b: '한 점에서 만난다 / 평행하다 / 일치한다 — 세 가지뿐이다.' },
      { t: '공간에서 두 직선', b: '만난다 / 평행하다 / <b>꼬인 위치</b>. 꼬인 위치란 <b>만나지도 않고 평행하지도 않은</b> 경우로, 두 직선이 한 평면 위에 있지 않다는 뜻이다. — 이 단원의 핵심.' },
      { t: '직선과 평면 / 두 평면', b: '직선이 평면에 <b>포함</b>되거나, 한 점에서 <b>만나거나</b>(수직도 여기 포함), <b>평행</b>하다. 두 평면은 한 직선(교선)에서 만나거나 평행하다.' },
      { t: '평행선의 성질', b: '두 직선이 평행하면 <b>동위각의 크기가 같고 엇각의 크기도 같다.</b> 거꾸로 동위각(또는 엇각)이 같으면 두 직선은 평행하다 — 평행선 작도의 근거가 된다.' },
      { t: '시험 대비 필수 연습', b: '<b>직육면체 그림</b>을 그려 놓고 한 모서리를 기준으로 평행한 모서리 · 수직인 모서리 · 꼬인 위치의 모서리 개수를 정확히 세는 연습. 매년 나온다.' },
    ],
  },
  '작도와 합동': {
    cards: [
      { t: '작도의 규칙', b: '<b>눈금 없는 자와 컴퍼스만</b> 쓴다. 자는 선을 긋는 데만, 컴퍼스는 길이를 옮기고 원을 그리는 데만 사용한다.' },
      { t: '기본 작도 3가지', b: '① 길이가 같은 선분 옮기기 ② <b>크기가 같은 각 옮기기</b> ③ 평행선 작도. ③은 ②를 그대로 쓴 것 — 동위각(엇각)이 같으면 평행하다는 성질을 거꾸로 이용한다.' },
      { t: '삼각형이 되는 조건', b: '<b>(가장 긴 변) &lt; (나머지 두 변의 길이의 합)</b>. 세 변의 길이가 주어졌을 때 먼저 이것부터 확인한다.' },
      { t: '삼각형의 결정조건 (하나로 정해지는 경우)', b: '① 세 변 ② 두 변과 <b>그 끼인각</b> ③ 한 변과 <b>그 양 끝 각</b>. — 세 각만 주면 크기가 정해지지 않고, 끼인각이 <b>아닌</b> 각을 주면 삼각형이 두 개 생길 수 있다.' },
      { t: '삼각형의 합동조건', b: '<b>SSS</b>(세 변) · <b>SAS</b>(두 변과 끼인각) · <b>ASA</b>(한 변과 양 끝 각). 합동을 쓸 때는 대응하는 순서를 맞춰 △ABC ≡ △DEF 로 적고, <b>어느 조건인지 이름을 밝힌다</b>(서술형 채점 요소).' },
    ],
  },
};

// ── 유형별 "풀이 열쇠" 한 줄 ───────────────────────────
const KEYS = {
  '반비례 관계9 (y=ax, y=a/x의 그래프가 만나는 점)': '두 식을 연립한다. ax = b/x → x² = b/a. 교점은 원점에 대해 대칭인 두 점이다.',
  '반비례 관계7 (y=a/x의 그래프 위의 점의 좌표가 정수인 경우)': 'xy = a 이므로 정수 좌표의 개수 = a의 약수의 개수. 음수쌍을 빠뜨리지 말 것.',
  '반비례 관계4 (y=a/x에서 a의 값 구하기)': '지나는 점의 (x좌표) × (y좌표) = a. 점 하나만 알면 끝난다.',
  '두 점 사이의 거리2 (관계식이 주어진 두 점)': '먼저 x값을 대입해 두 점의 좌표부터 구한다. 좌표가 나오면 거리는 좌표의 차이다.',
  '위치 관계6 (직선과 평면)': '직육면체를 그려 놓고 기준 모서리부터 표시한다. 꼬인 위치 = 만나지도, 평행하지도 않다.',
  '삼각형의 결정조건1 (기본 조건)': '① 세 변 ② 두 변과 끼인각 ③ 한 변과 양 끝 각. 이 셋 중 어디에도 안 들어가면 하나로 정해지지 않는다.',
  '간단한 도형의 작도4 (평행선의 작도)': '"크기가 같은 각 옮기기"가 뼈대. 동위각(엇각)이 같으면 평행하다는 성질을 거꾸로 쓴 것이다.',
  '삼각형의 합동의 활용1 (정삼각형)': '정삼각형 → 세 변이 같고 세 각이 60°. 이것으로 SAS 합동을 만든다. 서술형이면 합동조건 이름을 반드시 쓴다.',
};

// ── 조각 ───────────────────────────────────────────────
const bandOf = d => (d == null ? null : d <= 2 ? '하' : d <= 4 ? '중' : d <= 6 ? '상' : '최상');
const pill = (t, cls = '') => `<span class="pill ${cls}">${esc(t)}</span>`;
const gradeNum = (String(A.grade).match(/(\d)/) || [])[1] || '';
const bookTitle = gradeNum ? `${A.school} ${gradeNum}학년 ${A.semester}학기 ${A.term}고사` : A.title;

// 기준 시험(★) — labels/keys/exams 는 모두 같은 순서다
const ANX = Math.max(0, A.exams.findIndex(e => e.label === A.anchorLabel));
const AN = A.exams[ANX], AKEY = A.keys[ANX], ALAB = A.exams[ANX].label;

const pages = [];
const page = (cls, inner) => pages.push({ cls, inner });

// ── 1쪽 · 표지 ─────────────────────────────────────────
page('cover', `
  <div class="cbrand">LUMEN MATH · 루멘수학</div>
  <div class="ctitle">${esc(bookTitle)}</div>
  <div class="cbig">수학 시험대비<br>요약집</div>
  <div class="csub">${esc(A.labels.join(' · '))} 실제 기출 ${A.exams.length}회분 · ${A.totalN}문항을 분석해 만들었습니다</div>
  <div class="cname">
    <div><span>이름</span><i></i></div>
    <div><span>반</span><i></i></div>
  </div>
  <div class="chow">
    <b>이 책 쓰는 법</b>
    <ol>
      <li>2~4쪽 <b>이론</b>을 먼저 소리 내어 읽습니다. 외우려 하지 말고 그림을 떠올리세요.</li>
      <li>5~8쪽 <b>반복 유형</b>은 해설을 보기 전에 문제부터 풀어 봅니다.</li>
      <li>10쪽 <b>체크리스트</b>에 표시하고, "모른다"에 표시한 유형만 다시 봅니다.</li>
    </ol>
  </div>
  <div class="cfoot">루멘수학 내부 제작 자료 · ${esc(A.today)}<br>학원 수강생용입니다. 무단 재배포는 삼가 주세요.</div>
`);

// ── 2쪽 · 이번 시험 한눈에 ─────────────────────────────
{
  const units = A.unitSet.filter(u => A.unitScore[u]).sort((a, b) => A.unitScore[b] - A.unitScore[a]);
  const maxS = Math.max(...units.map(u => A.unitScore[u]), 1);
  const bars = units.map((u, i) => {
    const v = A.unitScore[u], pct = Math.round(v / A.unitScoreTotal * 100);
    return `<div class="brow"><div class="blab">${esc(u)}</div>
      <div class="btrack"><div class="bfill${i === 0 ? ' top' : ''}" style="width:${Math.round(v / maxS * 100)}%"></div></div>
      <div class="bval">${v}점 <em>${pct}%</em></div></div>`;
  }).join('');
  const tiles = A.exams.map(e => `<div class="tile"><b>${esc(e.label)}</b>
    <div class="tv">${e.n}<span>문항</span></div>
    <div class="ts">객관식 ${e.choice} · 서술형 ${e.essay}${e.total ? ` · ${e.total}점 만점` : ''}</div></div>`).join('');
  const bands = ['하', '중', '상', '최상'].filter(b => (A.diffByKey[AKEY] || {})[b]);
  const dif = bands.map(b => `<span><i class="d-${b === '하' ? 'lo' : b === '중' ? 'md' : 'hi'}"></i>${b} ${(A.diffByKey[AKEY] || {})[b]}문항</span>`).join('');
  page('', `
    <h1>이번 시험, 한눈에</h1>
    <p class="lead">${esc(ALAB)} 시험을 기준으로 정리했습니다.</p>
    ${A.scope ? `<div class="scope"><b>시험 범위</b><span>${esc(A.scope)}</span></div>` : ''}
    <div class="tiles">${tiles}</div>
    <h2>단원별 배점 — 어디에 점수가 걸려 있나</h2>
    <div class="bars">${bars}</div>
    <div class="two">
      <div class="box">
        <b>난이도 구성 <span class="mut">(${esc(ALAB)})</span></b>
        <div class="difrow">${dif}</div>
        <p>대부분이 <b>난이도 중</b>입니다. 기본 유형을 빠르고 정확하게 끝내고
        상 난이도 ${A.hard.filter(h => h.label === ALAB).length || A.hard.length}문항에 시간을 남기는 것이 관건입니다.</p>
      </div>
      <div class="box warn">
        <b>시간 관리</b>
        <p>이 시험 ${AN.n}문항의 <b>예상 풀이시간 합계는 ${A.anchorTime}분</b>입니다(넉넉하게 잡은 기준값).
        실제 시험 시간은 이보다 짧으므로, <b>배점 3~4점짜리 기본 문항은 1분 안에</b> 넘기는 연습이 필요합니다.
        서술형은 뒤쪽에 몰려 있으니 <b>끝까지 갈 시간</b>을 반드시 남겨 두세요.</p>
      </div>
    </div>
    <div class="hl3">
      <b>기억할 세 가지</b>
      <ol>
        <li><b>${esc(A.topUnit)}</b> — 배점의 ${A.topShare}%. 가장 먼저, 가장 깊게.</li>
        <li>매년 빠짐없이 나온 <b>반복 유형 ${A.repeated.length}개</b>(5~8쪽). 여기서 ${A.repScoreLatest}점이 나왔습니다.</li>
        <li>서술형은 <b>${esc(A.essayUnits.join(', '))}</b> — 답만 맞혀서는 점수를 못 받습니다.</li>
      </ol>
    </div>
  `);
}

// ── 3~4쪽 · 필수 이론 ──────────────────────────────────
function theoryPage(title, sub, unitNames, no) {
  const blocks = unitNames.map(u => {
    const T = UNIT_THEORY[u];
    if (!T) return '';
    const cards = T.cards.map(c => `<div class="tc"><b>${c.t}</b><p>${c.b}</p></div>`).join('');
    const table = T.table ? `<table class="cmp"><tr>${T.table.head.map(h => `<th>${h}</th>`).join('')}</tr>
      ${T.table.rows.map(r => `<tr>${r.map((c, i) => `<td${i === 0 ? ' class="k"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table>` : '';
    return `<div class="unit"><h2>${esc(u)} ${A.unitScore[u] ? `<span class="uscore">${A.unitScore[u]}점</span>` : ''}</h2>
      ${T.lead ? `<p class="ulead">${T.lead}</p>` : ''}${cards}${table}</div>`;
  }).join('');
  page('', `<h1>필수 이론 ${no}<span class="hsub">${esc(title)}</span></h1>
    <p class="lead">${sub}</p>${blocks}`);
}
theoryPage('정비례와 반비례', '문제를 풀기 전에 이 쪽부터 읽으세요. 여기 없는 내용은 이번 시험에 거의 안 나옵니다.', ['정비례와 반비례'], '①');
theoryPage('도형 — 기본 도형 · 위치 관계 · 작도와 합동', '그림을 직접 그려 보면서 읽어야 머리에 남습니다.', ['기본 도형', '위치 관계', '작도와 합동'], '②');

// ── 5~8쪽 · 반복 유형 (2개씩) ──────────────────────────
const typeCard = (t, i) => {
  const rep = t.rep || {};
  const band = bandOf(rep.diff);
  const item = t.items.find(it => it.label === A.anchorLabel && imgData(it.img)) || t.items.find(it => imgData(it.img));
  const src = item ? imgData(item.img) : null;
  const badges = [
    pill(t.unit),
    rep.score ? pill(`${rep.score}점`) : '',
    band ? pill(`난이도 ${band}`, band === '하' ? 'lo' : band === '중' ? 'md' : 'hi') : '',
    rep.essay ? pill('서술형 출제', 'es') : '',
    pill(`${t.nEx || A.exams.length}개년 출제`, 'nx'),
  ].join('');
  return `<div class="tycard">
    <div class="tyhd"><span class="no">${i}</span><div><div class="tyname">${esc(t.name)}</div><div class="badges">${badges}</div></div></div>
    <div class="tybody">
      <div class="tyleft">
        <div class="lab">핵심 개념</div>
        <p class="con">${esc(t.concept || '')}</p>
        ${KEYS[t.name] ? `<div class="key"><b>풀이 열쇠</b>${esc(KEYS[t.name])}</div>` : ''}
      </div>
      <div class="tyright">
        ${src ? `<div class="pcap">${esc(item.label)} · ${item.no}번${item.score ? ` · ${item.score}점` : ''}</div>
                 <img src="${src}" alt="기출 문제">` : '<div class="noimg">문항 이미지 없음</div>'}
      </div>
    </div>
  </div>`;
};
for (let i = 0; i < A.repeated.length; i += 2) {
  const two = A.repeated.slice(i, i + 2);
  page('', `${i === 0 ? `<h1>매년 나오는 유형<span class="hsub">${A.repeated.length}개 — 여기부터 잡는다</span></h1>
      <p class="lead">${esc(A.labels.join(' · '))} 시험에 <b>빠짐없이</b> 나온 유형입니다. 문제를 먼저 풀어 보고 개념을 읽으세요. 정답은 10쪽에 있습니다.</p>` : ''}
    ${two.map((t, j) => typeCard(t, i + j + 1)).join('')}`);
}

// ── 9쪽 · 서술형 · 고난도 ──────────────────────────────
{
  const eRows = A.essays.map(e => `<tr><td>${esc(e.label)}</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td><td>${e.score ? e.score + '점' : '-'}</td></tr>`).join('');
  const hRows = A.hard.map(e => `<tr><td>${esc(e.label)}</td><td>${e.no}번</td><td>${esc(e.unit)}</td><td>${esc(e.type)}</td></tr>`).join('');
  page('', `
    <h1>서술형과 고난도<span class="hsub">점수가 갈리는 자리</span></h1>
    <h2>서술형은 여기서 나온다</h2>
    <table class="tbl"><tr><th>시험</th><th>번호</th><th>단원</th><th>세부유형</th><th>배점</th></tr>${eRows}</table>
    <div class="box">
      <b>서술형 답안, 이렇게 씁니다 — 채점자는 과정에 점수를 줍니다</b>
      <ol class="rules">
        <li><b>구하려는 것을 먼저 적는다.</b> "△ABC ≡ △DEF 임을 보이면 된다."</li>
        <li><b>근거를 이름으로 밝힌다.</b> "두 변의 길이가 같고 끼인각이 같으므로 <b>SAS 합동</b>" — 조건 이름을 안 쓰면 감점됩니다.</li>
        <li><b>식과 문장을 섞어 쓴다.</b> 숫자만 나열하면 과정 점수를 못 받습니다.</li>
        <li><b>답에 단위와 문장을 붙인다.</b> "따라서 a = 6 이다."로 끝맺습니다.</li>
        <li>시간이 모자라도 <b>아는 데까지는 반드시 씁니다.</b> 부분 점수가 있습니다.</li>
      </ol>
    </div>
    <h2>고난도 문항이 나온 자리</h2>
    <p class="lead">상위권을 노린다면 이 유형을 유사 문제까지 연습하세요.</p>
    <table class="tbl"><tr><th>시험</th><th>번호</th><th>단원</th><th>세부유형</th></tr>${hRows}</table>
  `);
}

// ── 10쪽 · 셀프 체크리스트 + 정답 ──────────────────────
{
  const rows = A.repeated.map((t, i) => `<tr>
    <td class="c">${i + 1}</td><td><b>${esc(t.name)}</b><div class="mut">${esc(t.unit)}</div></td>
    <td class="c"><span class="ck"></span></td><td class="c"><span class="ck"></span></td><td class="c"><span class="ck"></span></td>
    <td></td></tr>`).join('');
  const ans = A.repeated.map((t, i) => {
    const item = t.items.find(it => it.label === A.anchorLabel && imgData(it.img)) || t.items.find(it => imgData(it.img));
    if (!item) return '';
    const a = item.answer ? (item.essay ? '서술형' : String(item.answer)) : '—';
    return `<li><b>${i + 1}</b> ${esc(item.label)} ${item.no}번 <span class="ansv">${esc(a)}</span></li>`;
  }).join('');
  page('', `
    <h1>셀프 체크리스트<span class="hsub">시험 전날, 이 표만 보면 됩니다</span></h1>
    <p class="lead">각 유형을 스스로 평가해 보세요. <b>"모른다"에 표시한 것만</b> 다시 보면 됩니다.</p>
    <table class="tbl chk"><tr><th class="c">#</th><th>유형</th><th class="c">안다</th><th class="c">애매</th><th class="c">모른다</th><th>메모 · 틀린 이유</th></tr>${rows}</table>
    <div class="two">
      <div class="box ans">
        <b>5~8쪽 기출 문제 정답</b>
        <ol class="anslist">${ans}</ol>
      </div>
      <div class="box warn">
        <b>시험 전날 밤 20분 코스</b>
        <ol class="rules">
          <li>2쪽 <b>단원별 배점</b>을 보고 어디가 중요한지 다시 확인 (2분)</li>
          <li>3~4쪽 <b>이론</b>을 소리 내어 읽기 (8분)</li>
          <li>이 표에서 <b>"모른다"</b>에 표시한 유형의 개념만 다시 읽기 (10분)</li>
        </ol>
        <p class="small">새로운 문제를 푸는 것보다, <b>아는 것을 확실히 하는 편</b>이 점수에 훨씬 유리합니다.</p>
      </div>
    </div>
  `);
}

// ── HTML ───────────────────────────────────────────────
const N = pages.length;
const body = pages.map((p, i) => `<section class="page ${p.cls}">${p.inner}
  <div class="pfoot"><span>루멘수학 · ${esc(bookTitle)} 요약집</span><span>${i + 1} / ${N}</span></div>
</section>`).join('\n');

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(bookTitle)} 수학 시험대비 요약집 — 루멘수학</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
:root{--red:#C63D2E;--red2:#A5301F;--navy:#1E3A5C;--gold:#D99A1F;
  --ink:#12161B;--ink2:#454F5B;--mut:#8A929C;--line:#E4DFDA;--soft:#FAF7F4;--w:#fff}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans KR','Malgun Gothic','맑은 고딕',sans-serif;color:var(--ink);
  background:#DDD8D3;line-height:1.62;-webkit-font-smoothing:antialiased}
.bar{position:sticky;top:0;z-index:9;background:var(--navy);color:#fff;padding:9px 16px;font-size:13px;text-align:center}
.bar b{color:#FFD9A0}
.page{width:210mm;min-height:297mm;margin:10mm auto;background:var(--w);
  padding:15mm 14mm 13mm;position:relative;box-shadow:0 3px 14px rgba(0,0,0,.16)}
h1{font-size:23pt;font-weight:900;color:var(--navy);letter-spacing:-.5px;margin-bottom:2mm;line-height:1.25}
h1 .hsub{display:block;font-size:11.5pt;font-weight:700;color:var(--red);margin-top:1.5mm}
h2{font-size:13.5pt;font-weight:900;color:var(--navy);margin:6mm 0 2.5mm;padding-bottom:1.5mm;border-bottom:2px solid var(--line)}
.lead{font-size:9.8pt;color:var(--ink2);margin-bottom:4mm}
.mut{color:var(--mut)}
.small{font-size:8.6pt;color:var(--ink2);margin-top:2mm}
/* 표지 */
.cover{background:var(--red);color:#fff;padding:22mm 16mm}
.cover::after{content:'';position:absolute;right:-30mm;top:-30mm;width:95mm;height:95mm;border-radius:50%;background:var(--red2)}
.cover>*{position:relative;z-index:1}
.cbrand{font-size:10pt;font-weight:900;letter-spacing:3px;color:#F5C7BC}
.ctitle{font-size:19pt;font-weight:900;margin:6mm 0 2mm}
.cbig{font-size:40pt;font-weight:900;line-height:1.15;color:#F2B733;margin-bottom:5mm}
.csub{font-size:10.5pt;color:#F5D9D2;max-width:120mm}
.cname{display:flex;gap:8mm;margin:14mm 0 12mm}
.cname div{display:flex;align-items:flex-end;gap:3mm}
.cname span{font-size:10pt;font-weight:700;color:#F5C7BC}
.cname i{display:block;width:45mm;border-bottom:1.5px solid rgba(255,255,255,.65);height:8mm}
.chow{background:rgba(0,0,0,.16);border-radius:4mm;padding:6mm 7mm}
.chow b{font-size:10.5pt;color:#F2B733}
.chow ol{margin:2mm 0 0 5mm;font-size:9.6pt;color:#FCEBE6}
.chow li{margin:1.6mm 0}
.cfoot{position:absolute;left:16mm;bottom:14mm;font-size:8.2pt;color:#F0BCB0;line-height:1.6}
/* 개요 */
.scope{background:var(--soft);border:1px solid var(--line);border-left:3px solid var(--red);border-radius:2mm;padding:3mm 4mm;margin-bottom:4mm}
.scope b{display:block;font-size:8.6pt;color:var(--mut);font-weight:800}
.scope span{font-size:10.5pt;font-weight:700}
.tiles{display:flex;gap:3mm;margin-bottom:2mm}
.tile{flex:1;background:var(--soft);border:1px solid var(--line);border-radius:2.5mm;padding:3mm 4mm}
.tile b{font-size:9pt;color:var(--navy)}
.tile .tv{font-size:20pt;font-weight:900;color:var(--navy);line-height:1.2}
.tile .tv span{font-size:9pt;font-weight:600;color:var(--ink2);margin-left:1mm}
.tile .ts{font-size:8.4pt;color:var(--ink2)}
.bars{margin-bottom:3mm}
.brow{display:flex;align-items:center;gap:3mm;margin-bottom:2mm}
.blab{width:38mm;font-size:9.4pt;font-weight:700;text-align:right;flex:none}
.btrack{flex:1;height:6mm;background:#EFEBE7;border-radius:1.5mm;overflow:hidden}
.bfill{height:100%;background:var(--navy);border-radius:0 1.5mm 1.5mm 0}
.bfill.top{background:var(--red)}
.bval{width:22mm;font-size:9pt;font-weight:800;flex:none}
.bval em{font-style:normal;color:var(--mut);font-weight:700}
.two{display:flex;gap:4mm;margin-top:4mm}
.two>*{flex:1}
.box{background:var(--soft);border:1px solid var(--line);border-radius:2.5mm;padding:4mm 5mm}
.box.warn{background:#FDF6EC;border-color:#EFDCBC}
.box.ans{background:#F1F5F9;border-color:#D5DEE7}
.box>b{display:block;font-size:10pt;color:var(--navy);margin-bottom:2mm}
.box p{font-size:9.2pt;color:var(--ink2)}
.difrow{display:flex;gap:4mm;margin-bottom:2mm;font-size:9pt;font-weight:700}
.difrow i{display:inline-block;width:3mm;height:3mm;border-radius:1mm;margin-right:1.5mm}
.d-lo{background:#2F6B45}.d-md{background:var(--gold)}.d-hi{background:var(--red)}
.hl3{margin-top:4mm;background:var(--navy);color:#fff;border-radius:2.5mm;padding:4mm 6mm}
.hl3 b{font-size:10pt;color:#F2B733}
.hl3 ol{margin:1.5mm 0 0 5mm;font-size:9.6pt;color:#DCE5EF}
.hl3 li{margin:1.4mm 0}.hl3 b:not(:first-child){color:#fff}
/* 이론 */
.unit{margin-bottom:5mm}
.uscore{font-size:9pt;font-weight:800;color:#fff;background:var(--red);border-radius:9mm;padding:.6mm 2.5mm;vertical-align:1mm}
.ulead{font-size:9pt;color:var(--red);font-weight:700;margin-bottom:2.5mm}
.tc{border-left:2.5px solid var(--gold);background:var(--soft);border-radius:0 2mm 2mm 0;padding:2.5mm 4mm;margin-bottom:2mm;break-inside:avoid}
.tc b{font-size:9.8pt;color:var(--navy)}
.tc p{font-size:9.2pt;color:var(--ink2);margin-top:.8mm}
.cmp{width:100%;border-collapse:collapse;font-size:9pt;margin-top:2mm}
.cmp th{background:var(--navy);color:#fff;padding:1.8mm 2.5mm;font-weight:800;font-size:8.8pt;text-align:left}
.cmp td{border:1px solid var(--line);padding:1.8mm 2.5mm}
.cmp td.k{background:var(--soft);font-weight:800;color:var(--navy)}
/* 유형 카드 */
.tycard{border:1px solid var(--line);border-radius:3mm;overflow:hidden;margin-bottom:4mm;break-inside:avoid}
.tyhd{display:flex;gap:3mm;align-items:flex-start;background:var(--soft);padding:3mm 4mm;border-bottom:1px solid var(--line)}
.tyhd .no{width:7mm;height:7mm;border-radius:50%;background:var(--red);color:#fff;font-weight:900;font-size:11pt;
  display:flex;align-items:center;justify-content:center;flex:none}
.tyname{font-size:11.5pt;font-weight:900;color:var(--navy);line-height:1.3}
.badges{margin-top:1.2mm}
.pill{display:inline-block;font-size:7.8pt;font-weight:800;padding:.4mm 2.2mm;border-radius:9mm;
  background:#EDE9E5;color:var(--ink2);margin-right:1.2mm}
.pill.lo{background:#E9F2EC;color:#2F6B45}.pill.md{background:#FBF0DA;color:#8A6314}
.pill.hi{background:#F6E0DC;color:#9E2B1C}.pill.es{background:#EDEAFD;color:#5747C9}
.pill.nx{background:var(--navy);color:#fff}
.tybody{display:flex;gap:4mm;padding:3.5mm 4mm}
.tyleft{width:44%;flex:none}
.tyright{flex:1;min-width:0}
.lab{font-size:8.4pt;font-weight:900;color:var(--red);letter-spacing:.5px;margin-bottom:1mm}
.con{font-size:8.9pt;color:var(--ink2);line-height:1.6}
.key{margin-top:2.5mm;background:#FDF6EC;border:1px solid #EFDCBC;border-radius:2mm;padding:2.5mm 3mm;font-size:8.8pt;color:#6B4A12}
.key b{display:block;color:#8A6314;font-size:8.4pt;margin-bottom:.6mm}
.pcap{font-size:8.2pt;font-weight:800;color:var(--navy);background:#F1F5F9;border:1px solid #D5DEE7;
  border-bottom:0;border-radius:2mm 2mm 0 0;padding:1.2mm 2.5mm}
.tyright img{display:block;width:100%;max-height:62mm;object-fit:contain;object-position:top;
  border:1px solid #D5DEE7;border-radius:0 0 2mm 2mm;padding:1.5mm;background:#fff}
.noimg{font-size:8.5pt;color:var(--mut);text-align:center;padding:8mm 0;border:1px dashed var(--line);border-radius:2mm}
/* 표 */
.tbl{width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:3mm}
.tbl th{background:var(--navy);color:#fff;padding:1.8mm 2.5mm;font-size:8.6pt;font-weight:800;text-align:left}
.tbl td{border-bottom:1px solid var(--line);padding:1.8mm 2.5mm;vertical-align:top}
.tbl td.c,.tbl th.c{text-align:center}
.chk td{height:9mm}
.ck{display:inline-block;width:4.5mm;height:4.5mm;border:1.4px solid var(--mut);border-radius:1mm}
.rules{margin:1mm 0 0 5mm;font-size:9.2pt;color:var(--ink2)}
.rules li{margin:1.4mm 0}
.anslist{margin:1mm 0 0 5mm;font-size:9.2pt;color:var(--ink2)}
.anslist li{margin:1.2mm 0}
.ansv{font-weight:900;color:var(--red);margin-left:1mm}
/* 쪽 아래 */
.pfoot{position:absolute;left:14mm;right:14mm;bottom:7mm;display:flex;justify-content:space-between;
  font-size:7.6pt;color:var(--mut);border-top:1px solid var(--line);padding-top:1.5mm}
.cover .pfoot{display:none}
@media print{
  @page{size:A4 portrait;margin:0}
  body{background:#fff}
  .bar{display:none}
  .page{width:auto;min-height:auto;height:297mm;margin:0;box-shadow:none;page-break-after:always}
  .page:last-child{page-break-after:auto}
}
</style></head><body>
<div class="bar">📄 <b>Ctrl+P</b>(맥은 ⌘+P) → 대상을 <b>"PDF로 저장"</b> → 배율 <b>기본값</b>, 여백 <b>없음</b>으로 인쇄하세요. 이 안내줄은 인쇄되지 않습니다.</div>
${body}
</body></html>`;

fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, html);
const noKey = A.repeated.filter(t => !KEYS[t.name]).map(t => t.name);
const noTheory = A.unitSet.filter(u => !UNIT_THEORY[u]);
console.log(`요약집 저장: ${OUT}  (${N}쪽)`);
if (noKey.length) console.log(`  ⚠️ 풀이 열쇠 없는 유형 ${noKey.length}개: ${noKey.join(' / ')}`);
if (noTheory.length) console.log(`  ⚠️ 이론 없는 단원: ${noTheory.join(', ')}`);
