# 입체 블록 아바타 렌더러 (2026-09-26)

학생앱·학원앱에 쓸 3D 블록 아바타(로블록스 느낌, 우리 그림)를 코드로 조립해 그림 파일로 뽑는다.

- `avatar.html` — three.js 장면. 머리·몸·팔·다리 블록 + 머리카락(short/long/bun) + 옷(축구 유니폼·가운·후드) + 소품(공·청진기·헤드셋·두루마리·검) + 표정(smile/happy/worried) + 보스 골렘
- `render.js` — 헤드리스 크롬으로 `avatar.html`을 열어 `CFG`의 캐릭터를 PNG(900×1100, 투명 배경)로 저장
- 준비: 이 폴더에서 `npm i three@0.160.0` (저장소에는 node_modules 를 넣지 않는다)
- 실행: `node render.js` (전부) 또는 `node render.js soccer_m codi`
- 시안: https://claude.ai/artifact/519c8ZJr1vYb36rgu5yumr 12번 판
