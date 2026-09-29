# 루멘이사회 → Claude Code 이전 가이드

## 1. 설치 (한 번만)
1. Claude Code 설치 (Max 요금제에 포함). Claude 데스크탑 앱의 Code 탭을 써도 됩니다
2. 이 폴더(lumen-board)를 컴퓨터의 원하는 위치에 압축 해제
3. 터미널에서 폴더로 이동 후 `claude` 실행 → CLAUDE.md를 자동으로 읽습니다

## 2. 학생 데이터 넣기
1. `private/명단.xlsx` 에 실명–코드 대응표 작성 (예: 홍길동 = S01)
2. `students/_example` 폴더를 복사해 `students/S01` 로 이름 변경
3. 수업 끝나면 `수업기록.md` 에 날짜별로 5~6줄 추가 (음성 메모를 받아써도 됨)

## 3. 사용법
- `/board 중등부 숙제 검사 방식 바꿀까` — 이사회 회의
- `/student-review S03` — 학생 한 명 집중 검토
- `/parent-feedback S01 S04 S07` — 오늘 학부모 피드백 초안 일괄 작성

## 4. GitHub에 올릴 때
- 반드시 **Private 저장소**
- `.gitignore` 가 students/, private/, reports/ 와 엑셀·녹음·사진 파일을 막아둡니다
- 올라가는 것: CLAUDE.md, 이사회 멤버, 명령어, decisions/ (학생 정보 없음)
- 첫 커밋 전에 `git status` 로 학생 파일이 목록에 없는지 꼭 확인
- 학생 데이터 백업은 GitHub 말고 외장 드라이브나 암호화된 개인 클라우드로

## 5. 개인정보 체크
- Claude Code가 학생 파일을 읽으면 그 내용이 Anthropic 서버로 전송되어 처리됩니다. 그래서 실명 대신 코드를 씁니다
- 등록 시 받은 개인정보 수집·이용 동의서가 학습 관리 목적의 외부 도구 활용까지 포괄하는지 한 번 확인하세요
- 만 14세 미만 학생은 법정대리인(학부모) 동의가 필요합니다
