import os,re,sys
# 저장소 안에서 돌린다: python3 sync/appbuild/build_app.py v19-92  (저장소 맨 위 폴더에서)
#   modules/ = 기능별 부품(.js) · memos/memo_19NN.txt = 버전 메모 · 바탕 = lumen_v19-42.html
HERE=os.path.dirname(os.path.abspath(__file__))
SP=os.environ.get('SP') or os.path.join(HERE,'modules'); MEMO=os.environ.get('MEMO') or os.path.join(HERE,'memos'); ver=sys.argv[1]; base='lumen_v19-42.html'; out='lumen_'+ver+'.html'
s=open(base).read()
# EA 모듈
mod=open(SP+'/ea_module_v2.js').read()
m0=re.search(r'/\* ═+\n \* v19-35[~·0-9]*: 📚 기출 분석', s); start=m0.start(); end=s.index('/* v19-29 — 🔥 추가 버프 설정 칸'); old=s[start:end]
ti=old.index('/* ═══ 수식을 «인터넷 없이» 그리기'); tj=old.index("+'.lx-ubs{", ti); tj=old.index('\n', tj); tex=old[ti:tj]
ci=old.index("var LC_CSS=''"); cj=old.index("+'@page{size:A4 portrait;margin:10mm 9mm}';", ci)+len("+'@page{size:A4 portrait;margin:10mm 9mm}';"); css=old[ci:cj]
eacss=open(SP+'/_keep_css.js').read(); win=re.sub(r"EA_CSS\s*\+\s*'</style>", "EA_CSS+EA_CSS2+'</style>", open(SP+'/_keep_win.js').read()); chips=open(SP+'/_keep_chips.js').read()
mod=mod.replace(' * v19-35·36: 📚 기출 분석',' * v19-35~'+ver.replace('v19-','')+': 📚 기출 분석',1)
new=mod.replace('/*__TEX__*/',tex).replace('/*__CSS__*/',css).replace('/*__EACSS__*/',eacss).replace('/*__WIN__*/',win).replace('/*__CHIPS__*/',chips); assert '/*__' not in new
risk=open(SP+'/risk_module.js').read()
cal=open(SP+'/cal_teacher.js').read() if int(ver.replace('v19-',''))>=46 else ''
xp=open(SP+'/xp_publish.js').read() if int(ver.replace('v19-',''))>=47 else ''
codi=open(SP+'/codi_teacher.js').read() if int(ver.replace('v19-',''))>=48 else ''
ahs=open(SP+'/aha_teacher.js').read() if int(ver.replace('v19-',''))>=51 else ''
guard=open(SP+'/studb_guard.js').read() if int(ver.replace('v19-',''))>=52 else ''
plsc=(open(SP+'/plweek_core.js').read()+'\n'+open(SP+'/plscore_teacher.js').read()) if int(ver.replace('v19-',''))>=54 else ''
plz=open(SP+'/plzero_teacher.js').read() if int(ver.replace('v19-',''))>=66 else ''
pls=open(SP+'/plsept_teacher.js').read() if int(ver.replace('v19-',''))>=67 else ''
sea=open(SP+'/season_teacher.js').read() if int(ver.replace('v19-',''))>=69 else ''
nkt=open(SP+'/nick_teacher.js').read() if int(ver.replace('v19-',''))>=72 else ''
hit=open(SP+'/hit_teacher.js').read() if int(ver.replace('v19-',''))>=74 else ''
nfo=open(SP+'/notice_fold.js').read() if int(ver.replace('v19-',''))>=75 else ''
cn=(open(SP+'/cn_teacher.js').read()+'\n'+open(SP+'/htdb_teacher.js').read()) if int(ver.replace('v19-',''))>=80 else ''
plr=open(SP+'/plrules_teacher.js').read() if int(ver.replace('v19-',''))>=81 else ''
nopt=open(SP+'/natopt_teacher.js').read() if int(ver.replace('v19-',''))>=85 else ''
sgs=open(SP+'/sgscore_teacher.js').read() if int(ver.replace('v19-',''))>=86 else ''
sds=open(SP+'/studb_sync.js').read() if int(ver.replace('v19-',''))>=87 else ''
wks=open(SP+'/wksplit_teacher.js').read() if int(ver.replace('v19-',''))>=88 else ''
sgv=open(SP+'/sgview_teacher.js').read() if int(ver.replace('v19-',''))>=89 else ''
rcw=open(SP+'/rcws_teacher.js').read() if int(ver.replace('v19-',''))>=92 else ''   # v19-92: 리커버리 학습지 설계 → 매쓰플랫 즉시 생성
bt2=open(SP+'/bt2_teacher.js').read() if int(ver.replace('v19-',''))>=94 else ''   # v19-98: 매쓰플랫 단원 트리   # v19-97: 채팅으로 고치기   # v19-95: 중3 기본 과정 공통수학1   # v19-94: 백지테스트 2판 (과정·소단원 · 미리보기·편집 · 교과서 문항 · 답지)
hsr=open(SP+'/hitsrc_teacher.js').read() if int(ver.replace('v19-',''))>=99 else ''   # v19-99: 적중 분석 «우리 자료 3종»(교과서·수학비서 학습지·PDF 자료함) + ⚡ 즉시 처리
cn2=open(SP+'/cn2_teacher.js').read() if int(ver.replace('v19-',''))>=100 else ''   # v19-100: 카드뉴스 디자인 2판(새 스타일 · 글꼴 · 1:1) + 🖼 배경함(올리기 · Gemini)
cn3=open(SP+'/cn3_teacher.js').read() if int(ver.replace('v19-',''))>=101 else ''   # v19-101: 카드뉴스 「매쓰플랫」 낱말 빼기(학원 자료 이름) · 문항 카드 두 그림(시험+우리 자료) · 선명/흐리게 · 🧩 모자이크
# v19-102: 카드뉴스를 블로그 브랜드와 통일 + 「⬇ 블로그 폴더로 내려받기」
#   브랜드 색·로고는 sync/card_templates/_base.css 한 곳에서 읽어 앱에 심는다(그 파일을 고치고 다시 조립하면 앱도 바뀐다).
#   블로그 초안 규칙은 docs/lumen_blog_profile.md 의 말투·금지·형식 칸을 그대로 옮겨 심는다.
def brand_js():
    import json
    root=os.path.normpath(os.path.join(HERE,'..','..'))
    cp=os.path.join(root,'sync','card_templates','_base.css'); pp=os.path.join(root,'docs','lumen_blog_profile.md')
    def die(msg): sys.exit('❌ v19-102 조립 멈춤: '+msg)
    try: bcss=open(cp,encoding='utf-8').read()
    except Exception as e: die('브랜드 CSS 를 열 수 없습니다 ('+cp+'): '+str(e))
    m=re.search(r':root\s*\{([^}]*)\}', bcss)
    if not m: die('_base.css 에서 :root{…} 색 묶음을 찾지 못했습니다')
    toks=dict(re.findall(r'--([a-z\-]+)\s*:\s*(#[0-9a-fA-F]{3,8})', m.group(1)))
    names={'red':'red','red-deep':'redDeep','yellow':'yellow','navy':'navy','bg':'bg','white':'white','text':'text','muted':'muted','line':'line'}
    miss=[k for k in names if k not in toks]
    if miss: die('_base.css :root 에 색이 빠졌습니다: '+', '.join('--'+k for k in miss))
    lm=re.search(r"\.footer \.dot\{[^}]*?url\(['\"]?(data:image/png;base64,[A-Za-z0-9+/=]+)['\"]?\)", bcss)
    if not lm: die('_base.css 의 .footer .dot 에서 로고 그림(data:image/png;base64,…)을 찾지 못했습니다')
    brand={'tokens':{names[k]:toks[k].lower() for k in names},'logo':lm.group(1),'font':'Pretendard'}
    try: prof=open(pp,encoding='utf-8').read()
    except Exception as e: die('블로그 프로필을 열 수 없습니다 ('+pp+'): '+str(e))
    def cut(a,b):
        i=prof.find(a); j=prof.find(b,i+1) if i>=0 else -1
        if i<0 or j<0: die('lumen_blog_profile.md 에서 「'+a+'」~「'+b+'」 칸을 찾지 못했습니다')
        return prof[i:j].strip()
    rules='\n\n'.join([cut('### 4-2.','### 4-4.'), cut('## 5. 쓰지 않는 말','### 브랜드 색'), cut('## 7. 해시태그','## 8.')])
    js=lambda v: json.dumps(v,ensure_ascii=False).replace('</','<\\/')
    return ('/* ★ v19-102: 조립할 때 sync/card_templates/_base.css 에서 읽은 브랜드 색·로고 (손으로 고치지 말 것 — _base.css 를 고치고 다시 조립) */\n'
        +'window.CN_BRAND = '+js(brand)+';\n'
        +'/* ★ v19-102: 조립할 때 docs/lumen_blog_profile.md 에서 옮긴 블로그 규칙(4-2 말투 · 4-3 뼈대 · 4-5 원장님 고침 · 5 쓰지 않는 말 · 6 규격 · 7 해시태그) */\n'
        +'window.CN_BLOG_RULES = '+js(rules)+';\n')
cn4=(brand_js()+open(SP+'/cn4_teacher.js').read()) if int(ver.replace('v19-',''))>=102 else ''   # v19-102: 카드뉴스 브랜드 통일(_base.css 한 곳) · 「⬇ 블로그 폴더로 내려받기」
hs2=open(SP+'/hitsrc2_teacher.js').read() if int(ver.replace('v19-',''))>=103 else ''   # v19-103: 적중 분석 결과 화면에서 「📂 우리 자료 고르기 → 다시 판정」 (요청 화면을 다시 판정 모드로)
l3=open(SP+'/layout3_teacher.js').read() if int(ver.replace('v19-',''))>=104 else ''   # v19-104: 3분할 틀 — 오른쪽 도구 칸(RIGHT_TOOLS) · 홈 아닌 화면은 공용 메뉴 접기 · 1024~1279 「🛠 도구」 서랍
l3h=open(SP+'/layout3_hit_teacher.js').read() if int(ver.replace('v19-',''))>=105 else ''   # v19-105: 적중 분석을 3분할로 — 왼쪽 시험 목록·새로 · 오른쪽 우리 자료·기준·내보내기·서버 상태
l3b=open(SP+'/layout3_bt_rc_teacher.js').read() if int(ver.replace('v19-',''))>=106 else ''   # v19-106: 백지테스트·리커버리를 3분할로 — 왼쪽 학생 고르기·보관함 / 이번 주 호출·장부 · 오른쪽 구성·만들기·채팅 / 규칙·만들기·계정
mst=open(SP+'/mstree_teacher.js').read() if int(ver.replace('v19-',''))>=107 else ''   # v19-107: 적중 분석 요청 — 수학비서 «📄 내 문제지»·«🗄 나만의 DB» 두 탭(수학비서와 같은 폴더 나무) + 「범위: 전체 / 시험 범위 단원만」(모든 자료)
msd=open(SP+'/msdiff_teacher.js').read() if int(ver.replace('v19-',''))>=108 else ''   # v19-108: 적중 분석 난이도 = 수학비서 1~9 (평균·킬러·보고서·블로그 자료)
pcm=open(SP+'/pastcmp_teacher.js').read() if int(ver.replace('v19-',''))>=109 else ''   # v19-109: 적중 분석 «🔁 지난 기출과 비교» — 같은 학교 지난 시험 문항과 그림 비교(우리 자료 적중률과 따로) · 요청 칩 src.past
pbs=open(SP+'/pubsrc_teacher.js').read() if int(ver.replace('v19-',''))>=110 else ''   # v19-110: 적중 분석 «📚 출판사 교과서 출처» — 모든 출판사 교과서와 그림 비교(stats.pub) · 출판사 비교만 다시
tbm=open(SP+'/tbmatch_teacher.js').read() if int(ver.replace('v19-',''))>=111 else ''   # v19-111: 📚 교과서일치도 — 시험 × 출판사 지도 · 학교 교과서에 없던 문항 · 다음 시험 대비 추천 (시안 docs/mockup_textbook_match.html)
h12=open(SP+'/hitfix112_teacher.js').read() if int(ver.replace('v19-',''))>=112 else ''   # v19-112: 적중 분석 안에 «📚 교과서 일치»(숫자 칸 · 도넛 바로 아래 칸 · 학교 교과서 표) · 난이도 /9 를 시험 전체 수학비서 난이도(exam.msLv)로도 · 교과서일치도는 적중 분석 머리 단추로
sev=open(SP+'/schoolev_teacher.js').read() if int(ver.replace('v19-',''))>=112 else ''   # v19-112: 학원 달력에 «학교 일정»(학교알리미·나이스 — school_calendar.schools[].events)
rkf=open(SP+'/rankfix113_teacher.js').read() if int(ver.replace('v19-',''))>=113 else ''   # v19-113: 🏆 플래너 랭킹 화면 합계 = 매일 + 계획 + 순공 (입력 표·학생앱 랭킹과 같게) · plwRepublish() 때 학생 전원 student_planner_.weekly 도 새로 · 발표 뒤 플래너 화면 열면 자동 한 번
wpp=open(SP+'/wplanpanel_teacher.js').read() if int(ver.replace('v19-',''))>=114 else ''   # v19-114: 📅 주간 점수 오른쪽 칸 = 학생 주간계획표(요일별 할 일·실천 ✓·순공 사진·💬 원장님 한마디 → 학생앱 플래너 「선생님 한마디」) · 줄 고르기 ↑/↓ · 좁은 화면은 표 아래 (시안 docs/mockup_weekly_plan_panel.html)
pwl=(open(SP+'/plwall_teacher.js').read()+'\n'+open(SP+'/wkcheck_teacher.js').read()) if int(ver.replace('v19-',''))>=115 else ''   # v19-115: 🗓 주간계획 모아보기(6명 3×2 미니 달력 · 코디/직접/고정 구분 · 💬 모아서 알림 · 🖨 한 장) + 📅 주간 점수 «✅ 체크하기 | 📊 점수 보기» (시안 docs/mockup_plan_wall.html · docs/mockup_week_check_score.html)
pg6=open(SP+'/pubgrade116_teacher.js').read() if int(ver.replace('v19-',''))>=116 else ''   # v19-116: 📚 교과서 문항도 등급 단추로 적중 확정(it.hit · mats kind textbook) · 같은 그림(imgUrl) 카드 합치기 · 교과서 일치 「공통」 한 번만 · 쪽·번호 안내 (원장 「6번 교과서 숫자변형 체크를 못하게 되었다」)
wkg=open(SP+'/wkgroup118_teacher.js').read() if int(ver.replace('v19-',''))>=118 else ''   # v19-118: 📅 주간 점수 «체크하기» 반별로 묶고 한 줄에 두 명 (원장 「반별로 잘 보게 묶고, 가운데 화면에 체크를 2명씩」)
g19=open(SP+'/grptime119_teacher.js').read() if int(ver.replace('v19-',''))>=119 else ''   # v19-119: ⏰ 반 수업 시간(lumen_group_times · 요일별 시작·길이) — 주간계획 모아보기·큰 달력의 «루멘 수업» 칸 · 학생이 고친 학원 시간(codi_fixed_ 안 type 'lumen') 먼저 · 「✏️ 학생이 고친 학원 시간」
# v19-121: 🧠 루멘 수학퀴즈 — 캐릭터 도트(docs/char_px2) + 학생앱과 같은 그리기(mathquiz_render.js) + 만들기·현황·낱말·캐릭터 (시안 docs/mockup_char_lesson_teacher.html)
if int(ver.replace('v19-',''))>=121:
    sys.dont_write_bytecode=True; sys.path.insert(0, HERE); from mq_assets import mq_bundle
    mqz=mq_bundle(os.path.normpath(os.path.join(HERE,'..','..')), SP)+open(SP+'/mathquiz121_teacher.js').read()
else: mqz=''
rnx=open(SP+'/racenext122_teacher.js').read() if int(ver.replace('v19-',''))>=122 else ''   # v19-122: 🏁 진도 레이스 «🆕 다음 시즌 (원장님만 보기 🔒)» — race_season_draft · 서버가 race_board_draft 계산 · 「📣 학생앱에 공개」 때만 race_season/race_board 교체
r123=open(SP+'/rcws123_teacher.js').read() if int(ver.replace('v19-',''))>=123 else ''   # v19-123: 🧩 리커버리 학습지 새 규칙 — 주간테스트 고르기(중3 기본 이번 주+지난 주) · 오답 1배수 · 교재 오답 빼기 · 단원 오답(매쓰플랫 교재 단원표) · 만들 때 보드 점수 갱신 · 구성 한 줄
nbk=(open(os.path.join(HERE,'..','naver_booking_core.js'),encoding='utf-8').read()+'\n'+open(SP+'/naverbook124_teacher.js',encoding='utf-8').read()) if int(ver.replace('v19-',''))>=124 else ''   # v19-124: 📅 네이버 예약 (수집기 sync/naver_booking_collect.js · 공용 함수 sync/naver_booking_core.js 를 그대로 붙임) — 수업·출결 「네이버 예약」 · 리커버리 보드 배지·시간 넣기 · 홈 「오늘 네이버 예약」
nb5=open(SP+'/naverbook125_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=125 else ''   # v19-125: 📅 네이버 예약 «📞 기억» 배지 — 수집기가 직접 연결한 학부모 전화(지문)를 기억해 다음 예약 자동 연결(how 'learned')
nb6=open(SP+'/naverbook126_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=126 else ''   # v19-126: 네이버 예약 — 📅 대신 네이버 로고(SVG) · «예약 열쇠»(or_nb_key, 이 기기에만) 로 이름·전화 상자 열기 · 「🔑 예약 열쇠 넣기」 · #nbkey=
nb7=open(SP+'/naverstats127_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=127 else ''   # v19-127: 📊 예약 통계 — 네이버 예약 보관(naver_bookings_archive)으로 통계 · 학생별 월간 참여 → 학부모 카톡 글 · 텐투텐 주말 체크(중·고등 필수) · 홈 「이번 주말 텐투텐 미예약 n명」(금·토)
hv8=open(SP+'/hitreview128_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=128 else ''   # v19-128: 🎯 적중 분석 검토 빠르게 — 🤖 AI 판정 자동 반영(hitEff 한 곳 · 시험마다 autoAi) · ⚡ 빠른 검토(키 1~4) · 유사유형만 문항 접기 · 고등부 수학비서 내 문제지 과목 자동 체크 + «수학비서 자료 없이 판정» 띠
sw9=open(SP+'/swbreq129_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=129 else ''   # v19-129: 📗 교재 목록 새로고침 — 울트라일일 «지금 가져오기» 옆 단추 → mf_swb_req → 서버 워커가 수집기 --swb-only (학생앱 숙제 교재 목록만 1~2분에 갱신)
cp0=open(SP+'/cnpick130_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=130 else ''   # v19-130: 🎯 문항별 적중 카드 자동 선택(비어 있으면 적중 상위 4개 · 저장 안 함 · 칩 누르면 그때부터 직접) + 그 칸을 카드뉴스 설정 맨 위로 (🧩 모자이크 칩이 바로 보이게)
mz1=open(SP+'/cnmz131_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=131 else ''   # v19-131: 📰 카드뉴스 자동 선택은 원장 확정 문항 먼저 · «지금 스타일»(옛 카드)에도 🧩 모자이크·선명/흐리게 칩 (문항 번호로 두 모양 이어 씀)
mz2=open(SP+'/cnmz132_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=132 else ''   # v19-132: 🧩 모자이크 창 — 오른쪽 참고 그림(시험↔우리 자료) · 🤖 자동 상자 숫자만/식/둘 다 (글자 덩어리는 브라우저가 찾고 Claude 는 번호만 고름)
ft3=open(SP+'/cnfit133_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=133 else ''   # v19-133: 📰 카드뉴스 내려받기 그림 늘어남 고침 — html2canvas 가 object-fit 을 몰라서, 그리기 직전 칸 비율 그림으로 다시 그려 끼움
gh4=open(SP+'/ghtext134_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=134 else ''   # v19-134: 적중 분석 «서버 기다리는 중» 안내 사실대로(자동 순번은 몇 시간 간격) · GitHub 단추 «적중 분석 포함»
vd5=open(SP+'/vod135_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=135 else ''   # v19-135: 🎬 강의실 묶음 배정 · 시청 지도 · 회차별 시청 기록
vm6=open(SP+'/vodmap136_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=136 else ''   # v19-136: 🗺 시청 지도 2판 — 세로 영상(단원별) × 가로 학생
rd7=open(SP+'/raid137_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=137 else ''   # v19-137: ⚔️ 다음 시즌 보스 레이드 설정·미리보기 · 🔥 학교별 시험 2주 전 버프 · 🗃 보스 보관함(꾸미기) · 공개 때 raid_board_draft → raid_board (docs/raid_s2_contract.md §5)
rd8=open(SP+'/raid138_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=138 else ''   # v19-138: ⚔️ 보스 고르면 미리보기 바로 바뀜(설정 기준 그림·「저장 안 함」/「서버 다시 세기 전」 칩) · 💾 저장 단추 가까이·저장 안 함 띠 · 🏞 보스 배경(레이드마다 고르기·보관함 배경 칸·보스 기본 배경 바꾸기) · 공개 때 설정 다시 입힘 (docs/raid_s2_contract.md §7)
xt9=open(SP+'/xtnext139_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=139 else ''   # v19-139: 🎯 시험대비 트랙 — 학사일정 보고 다음 시험 트랙 자동(지난 트랙 보관·되돌리기) · 디데이 자동 · 트랙마다 🔒 비공개/👁 공개 · 「＋ 시험 트랙 만들기」 · 서버 다시 읽고 바꾼 칸만 저장
pw0=open(SP+'/plweek140_core.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=140 else ''   # v19-140: 주간 점수 마감 새벽 3시 유예 · 10/12 주 «다음 주 계획» 면제(코디 점검)
st1=open(SP+'/store141_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=141 else ''   # v19-141: PC 저장 공간 줄이기 — 분석기 글자 은행·적중 분석·단원 트리 시작 다운로드 제외 · 3달 넘은 리포트 서랍은 메모리 전용
tu2=open(SP+'/tuition142_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=142 else ''   # v19-142: 💳 수강료 3분할 — 왼쪽 수강료 메뉴(칸 일곱·기간·지난달·바로 가기) · 위쪽 칩 줄 없앰(PC) · 오른쪽 통계(손익·추세·다음 달·챙길 것) 접기
a44=open(SP+'/aha144_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=144 else ''   # v19-144: 💡 아하노트 «전부 확정»(8점 기준 없앰) · 학생이 나중에 올린 스스로 해결을 AI 초안 경로에 맞춤
r45=((open(SP+'/rcsms148_teacher.js',encoding='utf-8').read()+'\n') if int(ver.replace('v19-',''))>=148 else '')+((open(SP+'/rcsms147_teacher.js',encoding='utf-8').read()+'\n') if int(ver.replace('v19-',''))>=147 else '')+((open(SP+'/rcsms146_teacher.js',encoding='utf-8').read()+'\n') if int(ver.replace('v19-',''))>=146 else '')+open(SP+'/rcsms145_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=145 else ''   # v19-146: 안내문에서 시간 빼기(R145_TIME=false 를 145 앞에)   # v19-145: 🚑 리커버리 학부모 안내문 — 주간테스트 점수 + 네이버 예약 부탁(예약 있으면 확인) · 예약 주소 · 학생별 복사
tk0=open(SP+'/tierkeep150_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=150 else ''   # v19-150: 💡 아하 리그 등급 — 시즌 동안 한 번 오른 등급 유지(aha_tier_best)
ls1=open(SP+'/lampstrip_core.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=151 else ''   # v19-151: 📝 아하 사진 읽기에서 인쇄된 LAMP 칸 이름 빼기(학생앱 v2-148 · 엣지 함수와 같은 글)
rr2=open(SP+'/recreview152_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=152 else ''   # v19-152: 🎙 녹음관리 › 👀 훑어보기 — 새벽 읽기 결과(rec_read_*) 학년별 카드 · ✓ 확인/💬 한마디(rec_review_<코드>) · 그리드 ✅·팝업 «🌙 새벽 읽기» (docs/rec_review_contract.md §3)
rn3=open(SP+'/rcnaver153_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=153 else ''   # v19-153: 🚑 리커버리 — 네이버 예약 시간 자동 연동(slotSrc naver/manual) · 전용 왼쪽 기둥 · 📊 통계 탭 · 홈 «예약 아직» (docs/recovery_tab_contract.md)
rr4=open(SP+'/rcrefresh154_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=154 else ''   # v19-154: 🚑 리커버리 「🔄 채점 새로고침」(mf_collect_req · 토큰 있으면 즉시) + ↻ 다시 읽기(주간테스트·진도·네이버 예약까지)
rw5=open(SP+'/rcws155_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=155 else ''   # v19-155: 🚑 리커버리 학습지 3판 — «아직 틀린 문제»(최근 28일) · 유형마다 1개 · 문항 30~40 · 빼는 유형 · 보드 «🕘» 한 줄 (docs/recovery_recent_contract.md)
mu7=open(SP+'/mfunlink157_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=157 else ''   # v19-157: 👤 학생관리 «🔗 매쓰플랫과 연결 안 된 학생» 띠 · 데이터 재연결 나눠 읽기
op8=open(SP+'/opscal158_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=158 else ''   # v19-158: 📅 운영 달력 — 운영·마케팅·학교·돈·지표 층 + 월 달력 아래 체크리스트 (docs/opscal_contract.md)
oh9=open(SP+'/ophome159_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=159 else ''   # v19-159: 🏠 홈 «📅 오늘 운영 할 일» 카드
pa0=open(SP+'/progalert160_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=160 else ''   # v19-160: 📚 진도 기준(중등 2~2.5개월·고등 학기 중 숙제) + 🔔 알림
cr1=open(SP+'/consult161_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=161 else ''   # v19-161: 📋 상담 리포트
cs2=open(SP+'/counsel162_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=162 else ''   # v19-162: 📞 학부모 상담 통합
pf3=open(SP+'/plfake163_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=163 else ''   # v19-163: 📛 플래너 거짓 제출 확인
cp3=open(SP+'/crprint163_teacher.js',encoding='utf-8').read() if int(ver.replace('v19-',''))>=163 else ''   # v19-163: 📋 상담 리포트 인쇄 여백
s=s[:start]+risk+'\n'+cal+'\n'+xp+'\n'+codi+'\n'+ahs+'\n'+guard+'\n'+plsc+'\n'+plz+'\n'+pls+'\n'+sea+'\n'+nkt+'\n'+hit+'\n'+nfo+'\n'+cn+'\n'+plr+'\n'+nopt+'\n'+sgs+'\n'+sds+'\n'+wks+'\n'+sgv+'\n'+rcw+'\n'+bt2+'\n'+hsr+'\n'+(cn2+'\n' if cn2 else '')+(cn3+'\n' if cn3 else '')+(cn4+'\n' if cn4 else '')+(hs2+'\n' if hs2 else '')+(l3+'\n' if l3 else '')+(l3h+'\n' if l3h else '')+(l3b+'\n' if l3b else '')+(mst+'\n' if mst else '')+(msd+'\n' if msd else '')+(pcm+'\n' if pcm else '')+(pbs+'\n' if pbs else '')+(tbm+'\n' if tbm else '')+(h12+'\n' if h12 else '')+(sev+'\n' if sev else '')+(rkf+'\n' if rkf else '')+(wpp+'\n' if wpp else '')+(pwl+'\n' if pwl else '')+(pg6+'\n' if pg6 else '')+(wkg+'\n' if wkg else '')+(g19+'\n' if g19 else '')+(mqz+'\n' if mqz else '')+(rnx+'\n' if rnx else '')+(r123+'\n' if r123 else '')+(nbk+'\n' if nbk else '')+(nb5+'\n' if nb5 else '')+(nb6+'\n' if nb6 else '')+(nb7+'\n' if nb7 else '')+(hv8+'\n' if hv8 else '')+(sw9+'\n' if sw9 else '')+(cp0+'\n' if cp0 else '')+(mz1+'\n' if mz1 else '')+(mz2+'\n' if mz2 else '')+(ft3+'\n' if ft3 else '')+(gh4+'\n' if gh4 else '')+(vd5+'\n' if vd5 else '')+(vm6+'\n' if vm6 else '')+(rd7+'\n' if rd7 else '')+(rd8+'\n' if rd8 else '')+(xt9+'\n' if xt9 else '')+(pw0+'\n' if pw0 else '')+(st1+'\n' if st1 else '')+(tu2+'\n' if tu2 else '')+(a44+'\n' if a44 else '')+(r45+'\n' if r45 else '')+(tk0+'\n' if tk0 else '')+(ls1+'\n' if ls1 else '')+(rr2+'\n' if rr2 else '')+(rn3+'\n' if rn3 else '')+(rr4+'\n' if rr4 else '')+(rw5+'\n' if rw5 else '')+(mu7+'\n' if mu7 else '')+(op8+'\n' if op8 else '')+(oh9+'\n' if oh9 else '')+(pa0+'\n' if pa0 else '')+(cr1+'\n' if cr1 else '')+(cs2+'\n' if cs2 else '')+(pf3+'\n' if pf3 else '')+(cp3+'\n' if cp3 else '')+new.lstrip('\n')+'\n\n'+s[end:]
def rep(a,b,n=1):
    global s
    assert s.count(a)==n,(a[:70],s.count(a)); s=s.replace(a,b)
rep("    {v:'lgall', icon:'🏆', label:'리그 한눈에', act:function(){ VIEW='lgall'; }},",
    "    {v:'lgall', icon:'🏆', label:'리그 한눈에', act:function(){ VIEW='lgall'; }},\n    /* ★ v19-43: 🚨 위험 신호 — 흩어진 신호를 한 화면에 (원장 지시 2026-09-24) */\n    {v:'risk', icon:'🚨', label:'위험 신호', act:function(){ VIEW='risk'; }},")
a="    else if(VIEW==='examanal'){ try{ C.innerHTML=rExamAnal(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight"
i=s.find(a); line_end=s.find('\n',i); line=s[i:line_end]; assert s.count(line)==2
s=s.replace(line, line+"\n    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">위험 신호 오류: '+esc2(e.message)+'</div>'; } }")
rep("const titles={home:'🏠 홈',typeach:'📊 유형 성취도',","const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',typeach:'📊 유형 성취도',")
if cal:
    rep("    {v:'attend', icon:'📅', label:'출결·보충', act:function(){ VIEW='attend'; }},",
        "    {v:'attend', icon:'📅', label:'출결·보충', act:function(){ VIEW='attend'; }},\n    /* ★ v19-46: 📅 학원 달력 — 학교별 시험 D-day · 월 보기 · 학원 일정 입력 */\n    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},")
    b="    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }"
    assert s.count(b)==2
    s=s.replace(b, "    else if(VIEW==='cal'){ try{ C.innerHTML=rCal(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">학원 달력 오류: '+esc2(e.message)+'</div>'; } }\n"+b)
rep("""    AHA_LOADING=false;
    if(VIEW==='aha'||VIEW==='home'||VIEW==='bookdash') render();
  },function(err){""","""    AHA_LOADING=false;
    if(VIEW==='aha'||VIEW==='home'||VIEW==='bookdash') render();
    try{ ahxLoad(true); }catch(e){}   /* v19-43: 교재 노트를 매쓰플랫 채점과 잇는다 */
  },function(err){""")
rep("""(rt?' <span class="qr">🔁재풀이</span>':'')+'<span class="ans">답변 ☐</span></div>';""",
    """(rt?' <span class="qr">🔁재풀이</span>':'')+'<span class="ans">답변 ☐</span></div>';
      blocks+=ahxLine(n);""")
rep("""  return '<span style="font-size:11px;font-weight:700;color:#475569">'+ahaEsc(ahaSourceName(n))+' <b style="color:#1d6fe8">'+detail+'</b></span>';""",
    """  return '<span style="font-size:11px;font-weight:700;color:#475569">'+ahaEsc(ahaSourceName(n))+' <b style="color:#1d6fe8">'+detail+'</b></span>'+ahxLine(n);""")
if xp:
    rep("  rankData.sort(function(a,b){return b.xpData.total - a.xpData.total;});",
        "  rankData.sort(function(a,b){return b.xpData.total - a.xpData.total;});\n  try{ lvPublishAll(true); }catch(e){}   /* v19-47: 학생앱용 xp_board 게시 */")
if codi:
    rep("    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},",
        "    {v:'cal', icon:'🗓', label:'학원 달력', act:function(){ VIEW='cal'; CT.edit=null; }},\n    /* ★ v19-48: 🧭 스터디 코디 — 학생별 계획·실천 현황판 + 대상·학부모 공개 설정 */\n    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},")
    c="    else if(VIEW==='cal'){ try{ C.innerHTML=rCal(); }"
    assert s.count(c)==2
    s=s.replace(c, "    else if(VIEW==='codi'){ try{ C.innerHTML=rCodi(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">스터디 코디 오류: '+esc2(e.message)+'</div>'; } }\n"+c)
    rep("const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',","const titles={home:'🏠 홈',risk:'🚨 위험 신호',cal:'📅 학원 달력',codi:'🧭 스터디 코디',")
    rep("    var promptText = promptLines.join('\\n');\n",
        "    /* ★ v19-48: 그날 스터디 코디 계획이 있으면 「계획 대비 실천」 대조 줄을 붙인다 */\n    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n    var promptText = promptLines.join('\\n');\n")
    rep("    analysis.promptVersion = 'v2.1';   /* ★ v19-30: 내일 쪽 날짜(dateNext)를 읽는 판 */\n",
        "    analysis.promptVersion = 'v2.1';   /* ★ v19-30: 내일 쪽 날짜(dateNext)를 읽는 판 */\n    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n")

if ahs:
    # A. 부터~까지 범위
    rep("  } else if(WB.range!=='all'){",
        "  } else if(WB.range==='custom'){   /* ★ v19-51: 📅 부터~까지 */\n    var _f=WB.from||'', _t=WB.to||'9999-12-31';\n    arr=arr.filter(function(n){ var d=iblDay(n.created_at); return d>=_f && d<=_t; });\n  } else if(WB.range!=='all'){")
    # 초안 대상: 날짜 골랐으면 그 날만
    rep("  var t=wbDraftTargets(wbNotes());", "  var t=wbDraftTargets(wbDraftPool());   /* ★ v19-51: 날짜를 골랐으면 그 날만 */")
    rep("  var rangeKo=(WB.range==='y'?'어제':(WB.range==='all'?'전체':'최근 7일'));", "  var rangeKo=wbRangeKo();   /* ★ v19-51 */")
    rep("  var dn=wbDraftTargets(notes).length;", "  var _day=wbDayPicked(); var dn=wbDraftTargets(_day?wbCurList():notes).length;   /* ★ v19-51 */")
    rep("'🤖 이 범위 AI 초안 ('+dn+'건)'", "'🤖 '+(_day?(wbDayShort(_day)+' AI 초안'):'이 범위 AI 초안')+' ('+dn+'건)'")
    rep("    +draftBtn\n    +rb('y','어제')+rb('7d','7일')+rb('all','전체')",
        "    +draftBtn+(_day?wbDayClearBtn():'')\n    +rb('y','어제')+rb('7d','7일')+rb('all','전체')+wbDateHtml()")
    # 읽음·🙋 배지 (줄·카드) + 읽음 기록 로드 + 모아 보기
    rep("  unBadge+=ahaStudentMarkBadge(n);", "  unBadge+=ahaStudentMarkBadge(n);\n  unBadge+=ahsBadge(n);   /* ★ v19-51: 👀 읽음 · 💡 아직 안 봄 · 🙋 아직 모르겠어요 */")
    rep("⚠ 탐구 조건 미달</span>':'')\n    +'</div>';", "⚠ 탐구 조건 미달</span>':'')\n    +ahsBadge(n)\n    +'</div>';")
    rep("function wbMain(){\n  var notes=wbNotes();", "function wbMain(){\n  try{ ahsLoad(); }catch(e){}   /* ★ v19-51: 힌트 읽음 기록 */\n  var notes=wbNotes();")
    rep("  var raw=[ {key:'x_retry'", "  var help=notes.filter(function(n){ return ahsHelp(n); });   /* ★ v19-51 */\n  var raw=[ {key:'x_help', label:'🙋 아직 모르겠어요', chip:'🙋 모르겠어요', list:help},\n            {key:'x_retry'")
    # 힌트 발송 → 즉시 푸시 요청, 취소 → 요청 삭제
    rep("hntHintsSave().then(function(){ ahaToast('💡 힌트 발송 완료 — 학생앱에 표시됩니다'); hntRender(); try{ render(); }catch(e){} });",
        "rec.code=n?String(n.student_code||''):undefined;   /* ★ v19-51: 밤 묶음 알림이 학생을 바로 찾게 */\n  hntHintsSave().then(function(){ ahaToast('💡 힌트 발송 완료 — 학생앱에 표시됩니다'); try{ ahsQueuePush(n); }catch(e){} hntRender(); try{ render(); }catch(e){} });")
    rep("    hand:(ast.hand&&ast.hand.img)||undefined\n  };", "    hand:(ast.hand&&ast.hand.img)||undefined,\n    code:String(n.student_code||'')   /* ★ v19-51 */\n  };")
    rep("ahaToast('♻️ 저장된 힌트 발송 완료');", "ahaToast('♻️ 저장된 힌트 발송 완료'); try{ ahsQueuePush(n); }catch(e){}")
    rep("hntHintsSave().then(function(){ ahaToast('발송 취소됨 — 학생앱에서 제거'); hntRender(); try{ render(); }catch(e){} });",
        "hntHintsSave().then(function(){ ahaToast('발송 취소됨 — 학생앱에서 제거'); try{ ahsQueueCancel(HNT.id); }catch(e){} hntRender(); try{ render(); }catch(e){} });")

if guard:
    # ① 앱이 읽기만 하는 큰 서버 자료는 기기(localStorage)에 쓰지 않는다
    rep("  return /^(mf_|msecr_|planner_review_|typeach_stu_|submissions_|student_planner_|bookprog_|goal_|pub_reports_|stu_reports_)/.test(k)",
        "  /* ★ v19-52: 수학비서 기출 DB·다리(ms_exam*)·해설집 본문·교재 채점 기록·코디·아바타·힌트 읽음 — 앱은 서버에서 직접 읽는다 (합계 5MB+) */\n  return /^(mf_|msecr_|planner_review_|typeach_stu_|submissions_|student_planner_|bookprog_|goal_|pub_reports_|stu_reports_|ms_exam|haesol_body_|hw_scores_|hw_sync|codi_|avatar_|aha_hint_seen_|push_inbox_|push_hint_)/.test(k)")
    rep("    || k==='weekly_pub' || k==='univ_marks';", "    || k==='weekly_pub' || k==='univ_marks' || k==='exam_ws_map' || k==='book_dash' || k==='push_hint_queue';")
    # ② 등록부는 클라우드 병합 전엔 올리지 않는다 (리포트의 _reportsFullyLoaded 보호와 같게)
    rep("      } else if (k === 'lumen_comments') {",
        "      } else if (k === 'or_studentdb') {\n        /* ★ v19-52: 클라우드 등록부를 메모리에 병합하기 전에는 push 금지 — 기기의 슬림본(사진 세트 14일·분석 5일)이\n         *   클라우드 전체본을 덮어 플래너 승인·분석 기록이 사라진 사고(2026-09-27 18:26) 재발 차단. 병합되면 그때 올린다. */\n        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }\n        val = window._fullStudentDb;\n      } else if (k === 'lumen_comments') {")
    rep("  window._fullStudentDb = arr;\n  var okDisk = safePullSetItem",
        "  window._fullStudentDb = arr;\n  window._studbPulled = true;   /* ★ v19-52: 이제부터 등록부 push 허용 */\n  if (window._studbPushLater) { window._studbPushLater = false; setTimeout(function(){ try { scheduleSync('or_studentdb'); } catch(e) {} }, 0); }\n  var okDisk = safePullSetItem")
    # ③ 슬림본이 메모리 전체본을 덮지 못하게
    rep("      _memStore[key] = String(value);   // 최후: 이 세션 동안 메모리로 동작 (클라우드에 원본 유지)",
        "      if (key !== 'or_studentdb' || _memStore[key] === undefined) _memStore[key] = String(value);   // 최후: 메모리로 동작 (★ v19-52: 등록부 슬림본은 전체본을 덮지 않는다)")
    # ④ 유령 세트 치유 — 플래너 탭 진입(새벽 결과 반영 뒤) + 사진 목록 읽은 뒤
    rep("  adoptOvernightPlannerResults().then(function(n) {\n    if (n > 0) {",
        "  adoptOvernightPlannerResults().then(function(n) {\n    var _hn = 0; try { _hn = plHealGhostSets(); } catch(e) {}   /* ★ v19-52: 승인 기록이 사라진 세트 되살리기 */\n    if (_hn > 0 && !(n > 0)) { try { plToast('🛡️ 승인 기록이 사라졌던 플래너 세트 ' + _hn + '개를 되살렸어요'); } catch(e) {} render(); }\n    if (n > 0) {")
    rep("  if (changed) {\n    saveStudents();\n    updatePlannerCardBadges();\n  }\n  // ★ v15-6: 자동승인 ON이면 메타 로드 후 무플래그 세트 자동 승인",
        "  try { if (plHealGhostSets()) changed = true; } catch(e) {}   /* ★ v19-52 */\n  if (changed) {\n    saveStudents();\n    updatePlannerCardBadges();\n  }\n  // ★ v15-6: 자동승인 ON이면 메타 로드 후 무플래그 세트 자동 승인")

if int(ver.replace('v19-',''))>=53:
    # 범위 전체 묶음: 날짜 모드에서 날짜를 안 눌렀으면 범위 전체
    rep("function wbCurBucket(all){\n  var i;\n  for(i=0;i<all.length;i++){ if(all[i].key===WB.grp) return all[i]; }",
        "function wbCurBucket(all){\n  var i;\n  if(WB.mode==='day' && !WB.grp) return wbRangeBucket(all);   /* ★ v19-53: 7일·전체를 고르면 범위 전체 */\n  for(i=0;i<all.length;i++){ if(all[i].key===WB.grp) return all[i]; }")
    rep("  var h=wbSeg();\n  var wait=buckets.filter(function(b){ return b.pend; });",
        "  var h=wbSeg();\n  if(WB.mode==='day') h+=wbNavItem(wbRangeBucket(buckets), cur);   /* ★ v19-53 */\n  var wait=buckets.filter(function(b){ return b.pend; });")
    rep("  var h=wbSeg(true)+'<div style=\"display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap\">';\n  all.forEach(function(b){",
        "  var h=wbSeg(true)+'<div style=\"display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap\">';\n  if(WB.mode==='day') all=[wbRangeBucket(all)].concat(all);   /* ★ v19-53 */\n  all.forEach(function(b){")
    # 머리띠 날짜 칸은 실제 범위를 보여 준다 · 초안 단추 이름을 또렷이
    rep("  var f=WB.from||wbYesterday(), t=WB.to||wbToday();", "  var _er=wbEffRange(), f=_er[0], t=_er[1];")
    rep("'🤖 '+(_day?(wbDayShort(_day)+' AI 초안'):'이 범위 AI 초안')+' ('+dn+'건)'", "'🤖 '+(_day?(wbDayShort(_day)+' 초안 없는 '):'이 범위 초안 없는 ')+dn+'건 AI 초안'")

if plsc:
    # 제출 점수 — 10월 1일부터 4·2·1
    rep("    if (fileCount >= 2) return cfg.score2photos;\n    if (fileCount === 1) return cfg.score1photo;",
        "    var _pd = new Date(yr, mo, dy - (hh < 3 ? 1 : 0)), _v2t = plV2(_pd.getFullYear() + '-' + String(_pd.getMonth() + 1).padStart(2, '0') + '-' + String(_pd.getDate()).padStart(2, '0'));   /* ★ v19-54: 10월부터 4·2 (새벽 3시 전은 전날 플래너) */\n    if (fileCount >= 2) return _v2t ? 4 : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? 2 : cfg.score1photo;")
    rep("    if (fileCount >= 2) return plPairVerdict(plannerDateStr, nextDateStr).ok ? cfg.score2photos : cfg.score1photo;\n    if (fileCount === 1) return cfg.score1photo;",
        "    var _v2p = plV2(plannerDateStr), _s2 = _v2p ? 4 : cfg.score2photos, _s1 = _v2p ? 2 : cfg.score1photo;   /* ★ v19-54: 10월부터 4·2 */\n    if (fileCount >= 2) return plPairVerdict(plannerDateStr, nextDateStr).ok ? _s2 : _s1;\n    if (fileCount === 1) return _s1;")
    # 프롬프트 v3 + 주간계획 대조
    rep("    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n",
        "    try{ var _cdL=await cdPromptLines(stInfo, expectedDate); if(_cdL.length) promptLines=promptLines.concat(_cdL); }catch(e){}\n    try{ promptLines=plV3PromptEdit(promptLines, expectedDate); var _wpL=await plPlanPromptLines(stInfo, expectedDate); if(_wpL.length) promptLines=promptLines.concat(_wpL); }catch(e){ console.warn('[v19-54 프롬프트]', e); }   /* ★ v19-54: 10월판 + 주간계획 대조 */\n")
    rep("    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n",
        "    try{ cdCoachSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-48: 코디 실천 ✓ + 아침 코칭 문장 */\n    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n")
    # 새벽 Routine 이 예전 프롬프트로 채점한 10월 세트는 가져오지 않는다
    rep("        if (!res || !res.analysis) return;\n", "        if (!res || !res.analysis) return;\n        if (setId.slice(0, 8) >= '20261001' && res.analysis.promptVersion !== 'v3.0') return;   /* ★ v19-54 */\n")
    # 편집 칸·판독불가 이름
    rep("    { key:'studyScore',   label:'순공시간 점수', val: _nv(analysis.studyScore),  type:'select', options:['1','0'] },\n    { key:'practiceScore',label:'실천율 점수',   val: _nv(analysis.practiceScore),type:'select', options:['1','0'] },",
        "    { key:'studyScore',   label:(analysis.promptVersion==='v3.0'?'타임테이블 점수':'순공시간 점수'), val: _nv(analysis.studyScore),  type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },   /* ★ v19-54 */\n    { key:'practiceScore',label:'실천율 점수',   val: _nv(analysis.practiceScore),type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },")
    rep("    var _uiKo = { studyScore:'순공시간',", "    var _uiKo = { studyScore:(analysis.promptVersion==='v3.0'?'타임테이블':'순공시간'),")
    # 메뉴·화면
    rep("    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},",
        "    {v:'codi', icon:'🧭', label:'스터디 코디', act:function(){ VIEW='codi'; CD.sel=null; }},\n    /* ★ v19-54: 📅 주간 점수 — 다음 주 계획·실천·순공 사진·종이 (10월 1일부터) */\n    {v:'plweek', icon:'📅', label:'주간 점수', act:function(){ VIEW='plweek'; PWB.W=null; try{ plwLoad(true); }catch(e){} }},")
    c2="    else if(VIEW==='codi'){ try{ C.innerHTML=rCodi(); }"
    assert s.count(c2)==2
    s=s.replace(c2, "    else if(VIEW==='plweek'){ try{ C.innerHTML=rPlWeek(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">주간 점수 오류: '+esc2(e.message)+'</div>'; } }\n"+c2)
    rep("codi:'🧭 스터디 코디',", "codi:'🧭 스터디 코디',plweek:'📅 주간 점수',")
    if int(ver.replace('v19-',''))>=62:
        # v19-62: 월 랭킹 = 매일 합 + 주간 합 (원장 결정 2026-09-29)
        rep("    var r = sumPlannerScoresForMonth(s, ym);\n    return {", "    var r = sumPlannerScoresForMonth(s, ym);\n    var _wk = (typeof plwMonthWeekly === 'function') ? plwMonthWeekly(s, ym) : 0;   /* ★ v19-62: 주간 점수 더하기 */\n    return {")
        rep("      total: r.total,\n      days: r.days,", "      total: r.total + _wk, daily: r.total, weekly: _wk,\n      days: r.days,")
        rep("    ranked.push({ id: r.id, code: r.code, maskedName: r.maskedName, total: r.total, days: r.days, max: r.max, rank: lastRank });",
            "    ranked.push({ id: r.id, code: r.code, maskedName: r.maskedName, total: r.total, daily: r.daily, weekly: r.weekly, days: r.days, max: r.max, rank: lastRank });")
        rep("    var sb2 = getSupaClient();\n    if (!sb2) return;\n\n    // 1) 내 점수 요약", "    var sb2 = getSupaClient();\n    if (!sb2) return;\n    try { if (typeof plwLoad === 'function') await plwLoad(); } catch(eW) {}   /* ★ v19-62: 주간 점수 자료 */\n\n    // 1) 내 점수 요약")
        rep("      scores: myScores, // { \"2026.04.20\": 10, ... }", "      scores: myScores, // { \"2026.04.20\": 10, ... }\n      weekly: (typeof plwStudentWeeks === 'function') ? plwStudentWeeks(student) : {},   /* ★ v19-62: 발표된 주의 주간 점수 {월요일:{t,plan,prac,photo,paper}} */")
if int(ver.replace('v19-',''))>=63:
    # v19-63: 공지 「🏠 홈에 보이기」 — 학생앱(v2-116) 홈 맨 위 공지 카드에 뜨는 공지 하나를 고른다 (원장 지시 2026-09-29)
    rep("async function noticeTogglePin(id){\n",
        "/* ★ v19-63: 🏠 홈에 보이기 — 한 개만. 학생앱 v2-116 홈 공지 카드가 home:true 공지를 먼저 보여 준다 */\nasync function noticeToggleHome(id){\n  var n = NOTICE_INDEX.find(function(x){ return x.id===id; }); if(!n) return;\n  var on = !n.home; var now = new Date().toISOString();\n  NOTICE_INDEX.forEach(function(x){ if(x.home){ x.home=false; x.updatedAt=now; } });\n  if(on){ n.home = true; n.updatedAt = now; }\n  var ok = await noticeSaveIndex(); if(ok) render();\n}\nasync function noticeTogglePin(id){\n")
    rep("  if(n.pinned) h += '<span style=\"font-size:11px\">📌</span>';\n  h += '<span style=\"font-size:10.5px;font-weight:700;color:' + st.c",
        "  if(n.pinned) h += '<span style=\"font-size:11px\">📌</span>';\n  if(n.home) h += '<span style=\"font-size:10.5px;font-weight:800;color:#fff;background:#0d2240;padding:2px 8px;border-radius:9px\">🏠 학생앱 홈</span>';   /* ★ v19-63 */\n  h += '<span style=\"font-size:10.5px;font-weight:700;color:' + st.c")
    rep("' + (n.pinned?'📌 고정 해제':'📌 고정') + '</button>';\n",
        "' + (n.pinned?'📌 고정 해제':'📌 고정') + '</button>';\n  h += '<button onclick=\"noticeToggleHome(\\'' + n.id + '\\')\" title=\"학생앱 홈 맨 위 공지 카드에 이 공지를 보여 줍니다 (한 개만)\" style=\"font-size:12px;font-weight:700;border:1px solid ' + (n.home?'#0d2240':'#e7e9ef') + ';background:' + (n.home?'#0d2240':'#fff') + ';color:' + (n.home?'#fff':'#475569') + ';border-radius:8px;padding:6px 11px;cursor:pointer;font-family:inherit\">' + (n.home?'🏠 홈에서 내리기':'🏠 홈에 보이기') + '</button>';   /* ★ v19-63 */\n")
if int(ver.replace('v19-',''))>=64:
    # v19-64: 학부모앱 v1-35 짝 — 미흡 기준·미제출 경고 일수 설정(hw_parent_cfg) + 위험 신호 「어제 숙제체크 안 찍음」
    rep("// ── 값 읽기/쓰기 ──\nfunction hwcNorm(v){",
        "/* ★ v19-64: 학부모앱 기준 — lumen_store hw_parent_cfg { weakBelow:60, missWarnDays:2 } (학부모앱 v1-35가 읽는다) */\nvar HWC_CFG={ loaded:false, busy:false, v:{ weakBelow:60, missWarnDays:2 } };\nfunction hwcCfgLoad(){\n  if(HWC_CFG.loaded||HWC_CFG.busy) return; HWC_CFG.busy=true;\n  var sb=null; try{ sb=getSupaClient(); }catch(e){}\n  if(!sb){ HWC_CFG.loaded=true; HWC_CFG.busy=false; return; }\n  sb.from('lumen_store').select('value').eq('key','hw_parent_cfg').then(function(r){\n    var v=(r&&r.data&&r.data[0]&&r.data[0].value)||null; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){ v=null; } }\n    if(v&&typeof v==='object'){ HWC_CFG.v.weakBelow=Number(v.weakBelow)||60; HWC_CFG.v.missWarnDays=Number(v.missWarnDays)||2; }\n    HWC_CFG.loaded=true; HWC_CFG.busy=false; if(VIEW==='hwcheck') render();\n  },function(){ HWC_CFG.loaded=true; HWC_CFG.busy=false; });\n}\nwindow.hwcCfgSet=function(k,v){ HWC_CFG.v[k]=Number(v)||HWC_CFG.v[k]; try{ supaSetItem('hw_parent_cfg', HWC_CFG.v); }catch(e){} render(); };\nfunction hwcCfgChip(){\n  hwcCfgLoad(); var c=HWC_CFG.v;\n  function sel(k,opts,unit){ return '<select onchange=\"hwcCfgSet(\\''+k+'\\',this.value)\" style=\"font-family:inherit;font-size:11px;font-weight:900;border:1px solid #cbd5e1;border-radius:7px;padding:2px 4px;background:#fff;color:#0d2240\">'+opts.map(function(o){ return '<option value=\"'+o+'\"'+(o===c[k]?' selected':'')+'>'+o+unit+'</option>'; }).join('')+'</select>'; }\n  return '<span title=\"학부모앱 홈의 🔴 미흡 · ⚠️ 미제출 표시 기준 (lumen_store hw_parent_cfg)\" style=\"display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#0d2240;background:#eef2f8;border-radius:50px;padding:3px 12px\">📱 학부모앱 기준 · 미흡 = 종합 '+sel('weakBelow',[40,50,60,70,80],'%')+' 미만 · 미제출 경고 '+sel('missWarnDays',[1,2,3],'일')+'째부터'+(HWC_CFG.loaded?'':' <i style=\"color:#94a3b8\">불러오는 중</i>')+'</span>';\n}\n// ── 값 읽기/쓰기 ──\nfunction hwcNorm(v){")
    rep("  h+='<span style=\"font-size:11px;font-weight:800;color:#7c3aed;background:#f3e8ff;border-radius:50px;padding:4px 12px\">💡 아하노트는 자동 계산 — 누를 필요 없음</span>';\n",
        "  h+='<span style=\"font-size:11px;font-weight:800;color:#7c3aed;background:#f3e8ff;border-radius:50px;padding:4px 12px\">💡 아하노트는 자동 계산 — 누를 필요 없음</span>';\n  h+=hwcCfgChip();   /* ★ v19-64 */\n")
    rep("  return out;\n}\nvar RISK_NAMES={ stop:'채점 끊김',",
        "  /* ⑥ v19-64: 어제 수업일인데 숙제체크가 없음 — 학부모앱에 「확인 전」으로 남는다 */\n  try{ var yd=riskKst(Date.now()-86400000); var ydow=new Date(yd+'T12:00:00+09:00').getDay(); var gd=(st.group&&typeof groupDays!=='undefined'&&groupDays[st.group])||[];\n    if(gd.indexOf(ydow)>=0 && !((st.lumen_hw||{})[yd])) out.push({ k:'hwc', sev:1, t:'어제 숙제체크 안 찍음', d:yd.slice(5).replace('-','/')+' 수업일 — 학부모앱에 「확인 전」으로 보여요', go:'hwcheck' }); }catch(e){}\n  return out;\n}\nvar RISK_NAMES={ hwc:'숙제체크 빠짐', stop:'채점 끊김',")
if int(ver.replace('v19-',''))>=65:
    # v19-65: IB아하 리그 점검 (원장 제보 2026-09-30 「김○○ 점수가 반영 안 됨」)
    #   ① 버그: 연습 주간 안에 확정된 노트가 «확정 때 저장한 리그 점수»를 그대로 써서 0점이 아니었다 → 순위표에서 다시 0으로
    #   ② 0점인 까닭(질문력 5 미만 · 연습 주간)과 «미확정 대기» 수를 표에 보인다
    rep("      picked:0, best:0, capped:0, tier:'inquirer',\n",
        "      picked:0, best:0, capped:0, tier:'inquirer',\n      zeroLow:0, zeroPrac:0, pending:0,   /* ★ v19-65: 0점 까닭 · 미확정 대기 */\n")
    rep("    if(sc.status!=='final' && !wantTemp) return;      // 확정만 (미리보기면 임시도)\n",
        "    if(sc.status!=='final'){ if(!(lampOnly && ibqIsOldNote(n))) row.pending++; }   /* ★ v19-65 */\n    if(sc.status!=='final' && !wantTemp) return;      // 확정만 (미리보기면 임시도)\n")
    rep("    if(q<minQ) lp=0;                                   // 질문력이 낮으면 리그 0점\n",
        "    if(q<minQ) lp=0;                                   // 질문력이 낮으면 리그 0점\n    /* ★ v19-65: 연습 주간 노트는 저장된 리그 점수가 있어도 0 — 연습 일수를 나중에 늘렸거나 규칙 전에 확정한 노트가 점수를 갖고 있었다 */\n    if(ibqIsPractice(n)) lp=0;\n    if(q<minQ) row.zeroLow++; else if(ibqIsPractice(n)) row.zeroPrac++;\n")
    rep("+'<td style=\"padding:9px 6px;border-top:1px solid #f1f5f9;text-align:right\"><b>'+r.league+'</b>'\n",
        "+'<td style=\"padding:9px 6px;border-top:1px solid #f1f5f9;text-align:right\"><b>'+r.league+'</b>'\n        +((r.league===0&&(r.zeroLow||r.zeroPrac))?('<div style=\"font-size:9.5px;color:#94a3b8;font-weight:700;white-space:nowrap\">'+(r.zeroLow?('질문력 '+Number(cfg.minQ==null?5:cfg.minQ)+' 미만 '+r.zeroLow+'건'):'')+(r.zeroLow&&r.zeroPrac?' · ':'')+(r.zeroPrac?('연습 주간 '+r.zeroPrac+'건'):'')+'</div>'):'')   /* ★ v19-65 */\n")
    rep("text-align:right\">'+r.qcnt+'</td>'", "text-align:right\">'+r.qcnt+(r.pending?'<div style=\"font-size:9.5px;color:#f59e0b;font-weight:800;white-space:nowrap\">대기 '+r.pending+'</div>':'')+'</td>'")
if int(ver.replace('v19-',''))>=66:
    # v19-66: 플래너 날짜 필수 · 같은 쪽 다시 내기 = 그날 0점 (모듈 plzero_teacher.js)
    rep("    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n",
        "    try{ plV3Apply(analysis, expectedDate); plPlanCheckSave(stInfo, analysis, expectedDate); }catch(e){}   /* ★ v19-54: 10월판 점수 · 주간계획 실천 */\n    try{ await plzCheck(stInfo, analysis, setId, imgData); }catch(e){}   /* ★ v19-66: 날짜 없음·다른 날짜·같은 쪽 다시 내기 → 그날 0점 */\n")
    rep("      || a.flagUnreadable===true||a.flagUnreadable==='true';\n}",
        "      || a.flagUnreadable===true||a.flagUnreadable==='true'\n      || a.zeroDay===true || a.zeroWarn===true;   /* ★ v19-66: 0점·경고 세트는 원장이 본다 (자동 승인 안 함) */\n}")
    rep("function plUseManual(entry, computed) {\n  var m = plManualOf(entry);\n  return (m === null) ? computed : m;\n}",
        "function plUseManual(entry, computed) {\n  var m = plManualOf(entry);\n  if (m === null && typeof plzApplyTotal === 'function') computed = plzApplyTotal(entry, computed);   /* ★ v19-66: 그날 0점 (손 점수가 있으면 그것) */\n  return (m === null) ? computed : m;\n}")
    rep("  h += '<div style=\"font-size:9px;color:#94a3b8;font-weight:600\">📅 날짜 기준 자동</div>';\n  h += '</div>';\n",
        "  h += '<div style=\"font-size:9px;color:#94a3b8;font-weight:600\">📅 날짜 기준 자동</div>';\n  h += '</div>';\n  try { h += plzCardHtml(analysis, stId, setId); } catch(e) {}   /* ★ v19-66 */\n")
    rep("      scores: myScores, // { \"2026.04.20\": 10, ... }\n",
        "      scores: myScores, // { \"2026.04.20\": 10, ... }\n      flags: (typeof plzFlags === 'function') ? plzFlags(student) : {},   /* ★ v19-66: 0점 날의 까닭 { 날짜: noDate|wrongDate|dup } */\n")
    rep("  return out;\n}\nvar RISK_NAMES={ hwc:'숙제체크 빠짐',",
        "  /* ⑦ v19-66: 플래너 날짜 없음·같은 쪽 다시 냄 (최근 7일) */\n  try{ var zf=riskKst(Date.now()-7*86400000); var zall=(st.lumen_planner_photos||[]).filter(function(p){ var a=p&&p.analysis; return a&&!a.zeroCleared&&(a.zeroDay||a.zeroWarn)&&plzSetDay(p.setId)>=zf; });\n    var zs=zall.filter(function(p){ return p.analysis.zeroDay; }), zw=zall.filter(function(p){ return !p.analysis.zeroDay; }); var zl=zs.length?zs:zw;\n    if(zl.length){ out.push({ k:'plz', sev:zs.length?2:1, t:'플래너 '+(zs.length?'0점 ':'경고 ')+zl.length+'건 — 날짜 없음·같은 날짜·같은 쪽', d:plzReasonKo(zl[zl.length-1].analysis), go:'planner' }); } }catch(e){}\n  /* ⑧ v19-68: 거짓 제출 — 같은 날짜 또 냄·같은 쪽 다시 냄 (최근 30일 · 되살린 것 제외) */\n  try{ var lf=riskKst(Date.now()-30*86400000); var ls=(st.lumen_planner_photos||[]).filter(function(p){ var a=p&&p.analysis; return a&&!a.zeroCleared&&(a.zeroReason==='sameDate'||a.zeroReason==='dup')&&plzSetDay(p.setId)>=lf; });\n    if(ls.length){ out.push({ k:'plzlie', sev:2, t:'📛 플래너 거짓 제출 '+ls.length+'건 (30일) — 같은 날짜 또 냄·같은 쪽 다시 냄', d:plzReasonKo(ls[ls.length-1].analysis), go:'planner' }); } }catch(e){}\n  return out;\n}\nvar RISK_NAMES={ plz:'플래너 0점', plzlie:'플래너 거짓 제출', hwc:'숙제체크 빠짐',")
if int(ver.replace('v19-',''))>=67:
    # v19-67: 9월 플래너 날짜 검사 → 날짜 없는 세트 0점 (모듈 plsept_teacher.js) — 플래너 사진검토 도구줄 단추
    rep("style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#0d2240,#1d6fe8);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📥 AI대로 전체 승인</button>';\n",
        "style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#0d2240,#1d6fe8);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📥 AI대로 전체 승인</button>';\n  h += '<button onclick=\"pls9Open()\" title=\"9월 세트의 날짜를 검사해 두 장 모두 날짜가 없는 세트를 그날 0점으로 (원장 지시 2026-09-30)\" style=\"flex:1;min-width:110px;padding:11px;background:linear-gradient(135deg,#b91c1c,#ef4444);color:white;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit\">📅 9월 날짜 검사 → 0점</button>';   /* ★ v19-67 */\n")
if int(ver.replace('v19-',''))>=69:
    # v19-69: 🏁 시즌 마무리 카드 · 🔜 다음 시즌 예고 · 지난 시즌 접기 (모듈 season_teacher.js)
    rep("  if(RACE.edit) h+=raceSetup();\n\n  /* v18-140:",
        "  h+=(typeof seaCardHtml==='function')?seaCardHtml():'';   /* ★ v19-69: 시즌 마무리 · 다음 시즌 예고 */\n  if(typeof seaFolded==='function' && seaFolded()) return h+seaFoldBtn()+'</div>';   /* ★ v19-69: 지난 시즌은 접어 둔다 */\n  if(RACE.edit) h+=raceSetup();\n\n  /* v18-140:")
    rep("    inChampion:(c.inChampion!==false),\n    last:lgPlannerLast(),",
        "    inChampion:(c.inChampion!==false),\n    champDays:Number(c.champDays==null?14:c.champDays),   /* ★ v19-69: 챔피언 카드 보이는 날수 */\n    last:lgPlannerLast(),")
    rep("  return { month:ym, winners:(rec.winners||[]).map(function(w){",
        "  return { month:ym, at:rec.at||'', winners:(rec.winners||[]).map(function(w){   /* ★ v19-69: 확정 시각도 보낸다 */")
if int(ver.replace('v19-',''))>=70:
    # v19-70: 학년별 시험일 (옥길중3·범박중3 기말이 다르다 — 원장 확인 2026-10-01)
    rep("function xtSchoolOfKey(k){ return String(k||'').split(' ')[0]; }\n",
        "function xtSchoolOfKey(k){ return String(k||'').split(' ')[0]; }\nfunction xtGradeOfKey(k){ return String(k||'').split(' ')[1]||''; }   /* ★ v19-70: 「옥길중 중3」 → 「중3」 */\n")
    rep("""function xtFindDday(ddays, school){
  var n=String(school||'').replace(/\\s/g,''); if(!n) return null;
  return (ddays||[]).filter(function(x){
    var s=String(x.school||'').replace(/\\s/g,'');
    return s&&(s===n||s.indexOf(n)===0||n.indexOf(s)===0);
  })[0]||null;
}""","""function xtFindDday(ddays, school, grade){
  var n=String(school||'').replace(/\\s/g,''); if(!n) return null;
  var list=(ddays||[]).filter(function(x){
    var s=String(x.school||'').replace(/\\s/g,'');
    return s&&(s===n||s.indexOf(n)===0||n.indexOf(s)===0);
  });
  /* ★ v19-70: 학년이 주어지면 그 학년 것(학년 표기 없는 것 포함) 중 아직 안 지난 가장 가까운 시험 */
  var gN=Number(String(grade||'').replace(/\\D/g,''))||0;
  if(gN){ list=list.filter(function(x){ return !(x.grades&&x.grades.length)||x.grades.indexOf(gN)>=0; }); }
  var today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  var up=list.filter(function(x){ return String(x.date||'')>=today; });
  return up[0]||list[list.length-1]||null;
}""")
    rep("  var dd=scName?xtFindDday(d.ddays, scName):null;\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"max-width:none\">';",
        "  var dd=scName?xtFindDday(d.ddays, scName, xtGradeOfKey(XT.grp)):null;   /* ★ v19-70 */\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"max-width:none\">';")
    rep("  var dd=xtFindDday(xtD().ddays, xtSchoolOfKey(XT.grp));\n","  var dd=xtFindDday(xtD().ddays, xtSchoolOfKey(XT.grp), xtGradeOfKey(XT.grp));   /* ★ v19-70 */\n")
    rep("  var dd=scName?xtFindDday(d.ddays,scName):null;\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"display:grid;grid-template-columns:270px",
        "  var dd=scName?xtFindDday(d.ddays,scName,xtGradeOfKey(XT.grp)):null;   /* ★ v19-70 */\n  var dn=dd?xtDday(dd.date):null;\n  var h='<div style=\"display:grid;grid-template-columns:270px")
    rep("    var dd2=xtFindDday(d.ddays,sc); var dn2=dd2?xtDday(dd2.date):null;","    var dd2=xtFindDday(d.ddays,sc,xtGradeOfKey(g)); var dn2=dd2?xtDday(dd2.date):null;   /* ★ v19-70 */")
    rep("""      var nx=sc.next; if(!nx||!nx.from) return;
      var short=xtSchoolShort(sc.name);   // 나이스의 short는 「범박고등」처럼 어색해서 이름에서 직접 줄인다
      var label=(nx.label||nx.name||'시험')+(nx.to&&nx.to!==nx.from?(' ('+String(nx.from).slice(5)+'~'+String(nx.to).slice(5)+')'):'');
      var cur=xtFindDday(d.ddays, short);
      if(cur){ if(cur.date!==nx.from||cur.label!==label){ cur.date=nx.from; cur.label=label; cur.school=short; upd++; } }
      else { d.ddays.push({ school:short, label:label, date:nx.from }); add++; }
      lines.push('· '+short+' — '+label+' '+nx.from);""",
"""      var short=xtSchoolShort(sc.name);   // 나이스의 short는 「범박고등」처럼 어색해서 이름에서 직접 줄인다
      /* ★ v19-70: 학년마다 다음 시험이 다르면(옥길중3·범박중3 기말) 학년별로 따로 넣는다 */
      var today0=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
      var up=(sc.exams||[]).filter(function(e){ return e.from&&(e.to||e.from)>=today0; }).sort(function(a,b){ return a.from<b.from?-1:1; });
      var picks=[], seen={};
      up.forEach(function(e){ var sig=(e.grades&&e.grades.length)?e.grades.join('·'):''; if(seen[sig]) return; seen[sig]=1; picks.push(e); });
      if(!picks.length && sc.next&&sc.next.from) picks.push(sc.next);
      if(!picks.length) return;
      var before=JSON.stringify(d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')===short.replace(/\\s/g,''); }));
      d.ddays=d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')!==short.replace(/\\s/g,''); });
      picks.forEach(function(e){
        var label=(e.label||e.name||'시험')+(e.grades&&e.grades.length?(' · '+e.grades.join('·')+'학년'):'')+(e.to&&e.to!==e.from?(' ('+String(e.from).slice(5)+'~'+String(e.to).slice(5)+')'):'');
        d.ddays.push({ school:short, label:label, date:e.from, grades:(e.grades&&e.grades.length)?e.grades.slice():null });
        lines.push('· '+short+' — '+label+' '+e.from);
      });
      var after=JSON.stringify(d.ddays.filter(function(x){ return String(x.school||'').replace(/\\s/g,'')===short.replace(/\\s/g,''); }));
      if(before==='[]') add+=picks.length; else if(before!==after) upd+=picks.length;""")
    rep("(s.exams||[]).forEach(function(e){ if(e.from) out.push({ school:sh, n:mine[sh], from:e.from, to:e.to||e.from, label:e.label||e.name||'시험' }); }); });",
        "(s.exams||[]).forEach(function(e){ if(e.from) out.push({ school:sh, n:mine[sh], from:e.from, to:e.to||e.from, label:(e.label||e.name||'시험')+(e.grades&&e.grades.length?(' · '+e.grades.join('·')+'학년'):''), grades:(e.grades&&e.grades.length)?e.grades:null }); }); });   /* ★ v19-70: 학년 표기 */")
    rep("  var ex=ctExams(), next={}; ex.forEach(function(e){ if(e.to>=today&&!next[e.school]) next[e.school]=e; });",
        "  var ex=ctExams(), next={}; ex.forEach(function(e){ var k=e.school+(e.grades?(' '+e.grades.join('·')+'학년'):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 */")
    rep("  ks.forEach(function(k){ var e=next[k], dn=ctDiff(today,e.from), on=today>=e.from&&today<=e.to, c=ctColor(k);",
        "  ks.forEach(function(k){ var e=next[k], dn=ctDiff(today,e.from), on=today>=e.from&&today<=e.to, c=ctColor(e.school);")
if int(ver.replace('v19-',''))>=71:
    # v19-71: 🎯 시험대비 트랙을 「시험·기출」 그룹으로 · 디데이 이름을 「옥길중3」「옥길중1,2」로 (원장 지시 2026-10-01)
    rep("    {v:'examtrack', icon:'🎯', label:'시험대비 트랙', act:function(){ VIEW='examtrack'; }},   // v18-126\n","")
    rep("    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n",
        "    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n    {v:'examtrack', icon:'🎯', label:'시험대비 트랙', act:function(){ VIEW='examtrack'; }},   // v18-126 · ★ v19-71: 진도·리포트 → 시험·기출로 옮김\n")
    rep("      +'<span style=\"min-width:0\"><span style=\"display:block;font-size:12.5px;font-weight:800;line-height:1.2\">'+esc2(x.school)+'</span>'\n      +'<span style=\"display:block;font-size:9.5px;font-weight:600;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+esc2(String(x.date).slice(5))",
        "      +'<span style=\"min-width:0\"><span style=\"display:block;font-size:12.5px;font-weight:800;line-height:1.2\">'+esc2(x.school)+(x.grades&&x.grades.length?('<b style=\"color:#f59e0b\">'+esc2(x.grades.join(','))+'</b>'):'')+'</span>'\n      +'<span style=\"display:block;font-size:9.5px;font-weight:600;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\">'+esc2(String(x.date).slice(5))")
    rep("var k=e.school+(e.grades?(' '+e.grades.join('·')+'학년'):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 */",
        "var k=e.school+(e.grades?e.grades.join(','):''); if(e.to>=today&&!next[k]) next[k]=e; });   /* ★ v19-70: 학년별 카드 · v19-71: 「옥길중3」「옥길중1,2」 */")
if int(ver.replace('v19-',''))>=72:
    # v19-72: 🏷 별명 — 학생앱으로 나가는 이름은 전부 별명 (모듈 nick_teacher.js)
    rep("function iblMask(name, mode){\n  var s=String(name||'');\n",
        "function iblMask(name, mode){\n  var s=String(name||'');\n  if(mode!=='full'&&mode!=='hide'&&typeof nickPubByName==='function') return nickPubByName(s);   /* ★ v19-72: 「성+○○」 자리는 이제 별명 */\n")
    rep("ahaEsc(iblMask(r.name, cfg.nameMode))","ahaEsc(iblShow(r.name, cfg.nameMode))")
    rep("lgEsc(iblMask(lead.name,cfg.nameMode))","lgEsc(iblShow(lead.name,cfg.nameMode))")
    rep("lgEsc(iblMask(x.name, board.cfg.nameMode))","lgEsc(iblShow(x.name, board.cfg.nameMode))",2)
    rep("lgEsc(iblMask(r.name,nameMode))","lgEsc(iblShow(r.name,nameMode))")
    rep("lgEsc(iblMask(cands.top.name, board.cfg.nameMode))","lgEsc(iblShow(cands.top.name, board.cfg.nameMode))")
    rep("lgEsc(iblMask(cands.growth.name, board.cfg.nameMode))","lgEsc(iblShow(cands.growth.name, board.cfg.nameMode))")
    rep("lgEsc(iblMask(cands.reflect.name, board.cfg.nameMode))","lgEsc(iblShow(cands.reflect.name, board.cfg.nameMode))")
    rep("      nm:nm.slice(0,1)+'○○',\n","      nm:(typeof nickOf==='function'&&nickOf(s))||'○○○',   /* ★ v19-72: 별명 */\n")
    rep("      return { r:x.r, code:x.code, nm:iblMask(r.nm||''), w:Number(x.w)||0 };","      return { r:x.r, code:x.code, nm:(typeof nickPub==='function')?nickPub(x.code):iblMask(r.nm||''), w:Number(x.w)||0 };   /* ★ v19-72 */")
    rep("      maskedName: masks[s.id] || s.name,\n","      maskedName: (typeof nickOf==='function')?(nickOf(s)||'○○○'):(masks[s.id] || s.name),   /* ★ v19-72: 별명 */\n")
    rep("first:{ masked:top.map(function(s){ return hallMask(WK.names[s.sid]||''); }).join(' · '),","first:{ masked:top.map(function(s){ return (typeof nickById==='function'&&nickById(s.sid))||'○○○'; }).join(' · '),   /* ★ v19-72 */")
    rep("     +ibqOptBtn('nameMode','masked',c.nameMode,'성+○○')+ibqOptBtn('nameMode','full',c.nameMode,'실명')\n     +ibqOptBtn('nameMode','hide',c.nameMode,'가림'));",
        "     +ibqOptBtn('nameMode','masked',c.nameMode,'🏷 별명 (기본)')+ibqOptBtn('nameMode','full',c.nameMode,'실명')\n     +ibqOptBtn('nameMode','hide',c.nameMode,'가림')+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>');")
    rep("""          <input id="edit-parent-phone" type="tel" placeholder="010-0000-0000" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""",
        """          <input id="edit-parent-phone" type="tel" placeholder="010-0000-0000" style="width:100%;border:1.5px solid #e2e8f0;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">
          <div style="margin-top:10px;font-size:12px;font-weight:800;color:#0d2240">🏷 학생앱 별명 <span style="font-weight:700;color:#94a3b8">— 순위표·시상에 이름 대신 (2~8자 · 실명 ×)</span></div>
          <input id="edit-nick" maxlength="8" placeholder="예) 수학천재 · 학생이 학생앱 「나」 탭에서 정할 수도" style="width:100%;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""")
    rep("  document.getElementById('edit-parent-phone').value=st.parentPhone||'';\n","  document.getElementById('edit-parent-phone').value=st.parentPhone||'';\n  var _nkEl=document.getElementById('edit-nick'); if(_nkEl) _nkEl.value=(typeof nickOf==='function')?nickOf(st):(st.nick||'');   /* ★ v19-72 */\n")
    rep("  var schoolEl=document.getElementById('edit-school');\n  const data={\n    name,\n",
        "  var schoolEl=document.getElementById('edit-school');\n  var _nk=((document.getElementById('edit-nick')||{}).value||'').trim();   /* ★ v19-72: 별명 검사 */\n  if(_nk && typeof nickCheck==='function'){ var _ne=nickCheck(_nk, {id:id, name:name}); if(_ne){ alert('🏷 별명: '+_ne); return; } }\n  const data={\n    name,\n    nick:_nk,\n")
    rep("    const old=students.find(s=>s.id===id);\n    const nameChanged=old&&old.name!==name;",
        "    const old=students.find(s=>s.id===id);\n    try{ if(old&&old.lumen_rec_code&&typeof nickPush==='function'&&String(old.nick||'')!==data.nick){ nickPush(old.lumen_rec_code, data.nick); } }catch(e){}   /* ★ v19-72 */\n    const nameChanged=old&&old.name!==name;")
if int(ver.replace('v19-',''))>=73:
    # v19-73: 🎲 별명 고르기 방식 — 편집 폼 「뽑기」 단추 · 리그 설정 낱말 편집
    rep("""          <input id="edit-nick" maxlength="8" placeholder="예) 수학천재 · 학생이 학생앱 「나」 탭에서 정할 수도" style="width:100%;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none">""",
        """          <div style="display:flex;gap:6px"><input id="edit-nick" maxlength="9" placeholder="예) 번개 여우 · 학생이 학생앱 「나」 탭에서 고를 수도" style="flex:1;border:1.5px solid #fde68a;border-radius:10px;padding:10px 12px;font-size:14px;font-family:inherit;outline:none"><button type="button" onclick="nickRoll()" title="낱말 조합에서 하나 뽑기" style="padding:0 12px;background:#fef3c7;color:#92400e;border:1.5px solid #fde68a;border-radius:10px;font-size:13px;font-weight:900;cursor:pointer;font-family:inherit">🎲 뽑기</button></div>""")
    rep("+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>');",
        "+'<div style=\"margin-top:4px\">'+(typeof nickMissingHtml==='function'?nickMissingHtml():'')+'</div>'+(typeof nickWordsHtml==='function'?nickWordsHtml():''));")
if int(ver.replace('v19-',''))>=74:
    # v19-74: 🎯 적중 분석 탭 (모듈 hit_teacher.js · docs/exam_hit_contract.md)
    rep("    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n",
        "    {v:'lastcheck', icon:'🎯', label:'시험 대비', act:function(){ VIEW='lastcheck'; EA.last=null; }},\n    /* ★ v19-74: 🎯 적중 분석 — 시험지 ↔ 우리 자료 직접 대조 (원장 결정 2026-10-04) */\n    {v:'examhit', icon:'🎯', label:'적중 분석', act:function(){ VIEW='examhit'; }},\n")
    a2="    else if(VIEW==='examanal'){ try{ C.innerHTML=rExamAnal(); }"
    assert s.count(a2)==2
    s=s.replace(a2, "    else if(VIEW==='examhit'){ try{ C.innerHTML=rExamHit(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">적중 분석 오류: '+esc2(e.message)+'</div>'; } }\n"+a2)
    rep("lastcheck:'🎯 시험 대비',examanal:'📚 기출 분석'","lastcheck:'🎯 시험 대비',examanal:'📚 기출 분석',examhit:'🎯 적중 분석'")
if int(ver.replace('v19-',''))>=75:
    # v19-75: 📋 발행한 공지 — 접어서 한 줄 · 학생앱 순서/최신순 · 찾기 (모듈 notice_fold.js)
    rep("  h += '<div style=\"columns:480px;column-gap:14px\">' + noticeListInner() + '</div>';",
        "  h += noticeToolbarHtml() + '<div id=\"notice-list\">' + noticeListInner2() + '</div>';   /* ★ v19-75 */")
if int(ver.replace('v19-',''))>=81:
    # v19-81: 📋 플래너 점수 기준표 = 실제 채점 · A안(10/1 소급) · 주간 칸 · 왼쪽 탭 (모듈 plrules_teacher.js)
    rep("    if (!isOnTime) return fileCount >= 1 ? 1 : 0; // 지각: 장수 무관 1점 (제출 자체는 한 경우)",
        "    if (!isOnTime) return fileCount >= 1 ? (typeof plLatePts==='function' ? plLatePts(yr+'-'+(mo+1)+'-'+dy) : 1) : 0; // 지각 (v19-81: 기준표)")
    rep("    if (fileCount >= 2) return _v2t ? 4 : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? 2 : cfg.score1photo;",
        "    var _pdk = _pd.getFullYear() + '-' + (_pd.getMonth() + 1) + '-' + _pd.getDate();   /* v19-81: 제출 점수는 기준표 */\n    if (fileCount >= 2) return _v2t ? plSubPts(_pdk, 2) : cfg.score2photos;\n    if (fileCount === 1) return _v2t ? plSubPts(_pdk, 1) : cfg.score1photo;")
    rep("    if (!isOnTime) return fileCount >= 1 ? 1 : 0; // 지각: 장수 무관 1점\n",
        "    if (!isOnTime) return fileCount >= 1 ? (typeof plLatePts==='function' ? plLatePts(plannerDateStr) : 1) : 0; // 지각 (v19-81: 기준표)\n")
    rep("var _v2p = plV2(plannerDateStr), _s2 = _v2p ? 4 : cfg.score2photos, _s1 = _v2p ? 2 : cfg.score1photo;",
        "var _v2p = plV2(plannerDateStr), _s2 = _v2p ? plSubPts(plannerDateStr, 2) : cfg.score2photos, _s1 = _v2p ? plSubPts(plannerDateStr, 1) : cfg.score1photo;")
    rep("type:'select', options:(analysis.promptVersion==='v3.0'?['2','1','0']:['1','0']) },\n    { key:'specificScore'",
        "type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'p'):['1','0']) },\n    { key:'specificScore'")
    rep("    { key:'specificScore',label:'구체적 페이지', val: _nv(analysis.specificScore),type:'select', options:['1','0'] },\n    { key:'feedbackScore',label:'피드백 점수',   val: _nv(analysis.feedbackScore),type:'select', options:['1','0'] },",
        "    { key:'specificScore',label:'구체적 페이지', val: _nv(analysis.specificScore),type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'s'):['1','0']) },\n    { key:'feedbackScore',label:'피드백 점수',   val: _nv(analysis.feedbackScore),type:'select', options:(analysis.promptVersion==='v3.0'?plrOpts(analysis,'f'):['1','0']) },")
    # 입력 표 — 하루 최대 · 주간 칸 · 합계 · 오른쪽 기준표
    fi=s.index('function rPlannerInput(){'); fj=s.index('\n// ── 플래너 드래그 범위 선택 ──', fi); F=s[fi:fj]
    def frep(a,b):
        global F
        assert F.count(a)==1,(a[:70],F.count(a)); F=F.replace(a,b)
    frep("    return s+Math.max.apply(null,nums.map(Number));\n  },0);\n",
         "    return s+Math.max.apply(null,nums.map(Number));\n  },0);\n  if(ym>='2026.10'&&typeof plRulesFor==='function'){ var _plr=plRulesFor(ym.replace('.','-')+'-01'); if(_plr) totalMax=plRulesMax(_plr); }   /* v19-81 */\n")
    frep("+getDayLabel(dow)+'</th>';\n  }", "+getDayLabel(dow)+'</th>';\n    h+=plrGridHead(yr,mo,d,1);   /* v19-81: 주간 칸 */\n  }")
    frep("      +d+'</th>';\n  }", "      +d+'</th>';\n    h+=plrGridHead(yr,mo,d,2);\n  }")
    frep("        +'</div></td>';\n    }\n", "        +'</div></td>';\n      h+=plrGridCell(st,yr,mo,d2);   /* v19-81 */\n    }\n")
    frep(";font-size:13px\">'+total+'</td>';", ";font-size:13px\">'+plrGridTotal(st,ym,total,tColor)+'</td>';")
    ri=F.index('  // ── 오른쪽: 점수 기준표 ──'); rj=F.index("  h+='</div>'; // 오른쪽 끝", ri)+len("  h+='</div>'; // 오른쪽 끝")
    F=F[:ri]+"  // ── 오른쪽: 점수 기준표 — v19-81: 실제 채점에 쓰이는 기준표 (plrules_teacher.js) ──\n  h+=plrPanelHtml();"+F[rj:]
    s=s[:fi]+F+s[fj:]
    # 왼쪽 탭
    rep("    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n  ];",
        "    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n    /* ★ v19-81: 플래너와 이어진 화면 (원장 지시 2026-10-05) */\n    {sep:'📅 주간 · 순공 · 코디'},\n    {id:'@plweek',   icon:'📅', label:'주간 점수(주간계획)', red:false},\n    {id:'@sungong',  icon:'📔', label:'순공피드백', red:false},\n    {id:'@codi',     icon:'🧭', label:'스터디 코디', red:false},\n  ];")
    rep("  VIEWS.forEach(function(v) {\n    var on = PLANNER_VIEW === v.id;",
        "  VIEWS.forEach(function(v) {\n    if (v.sep) { h += '<div style=\"font-size:10px;font-weight:700;color:#94a3b8;letter-spacing:1px;padding:12px 8px 4px;border-top:1px solid #eef2f7;margin-top:8px\">' + v.sep + '</div>'; return; }\n    var on = v.id.charAt(0) === '@' ? (VIEW === v.id.slice(1)) : (VIEW === 'planner' && PLANNER_VIEW === v.id);")
    rep("      b.onclick = function() { PLANNER_VIEW = this.getAttribute('data-planview'); render(); };",
        "      b.onclick = function() { var id = this.getAttribute('data-planview'); if (id.charAt(0) === '@') { plrNavGo(id.slice(1)); return; } VIEW = 'planner'; PLANNER_VIEW = id; render(); };")
    rep("  if(v==='planner') return rPlannerLeftNav();", "  if(v==='planner'||v==='plweek'||v==='sungong'||v==='codi') return rPlannerLeftNav();   /* v19-81 */")
if int(ver.replace('v19-',''))>=82:
    # v19-82: 여러 기기 덮어쓰기 막기 — 같은 순위면 더 최근에 고친 쪽 (plrules_teacher.js plMergeStamp · lumen_planner_at)
    rep("            Object.keys(_sPl).forEach(function(dk){ if(_sPl[dk]!==undefined && _sPl[dk]!==null) _pl[dk] = _sPl[dk]; });\n            if(Object.keys(_pl).length>0) m.lumen_planner = _pl;",
        "            var _cAt = prev.lumen_planner_at||{}, _sAt = s.lumen_planner_at||{};   /* ★ v19-82: 날짜마다 더 최근에 매긴 쪽 */\n            Object.keys(_sPl).forEach(function(dk){ if(_sPl[dk]===undefined || _sPl[dk]===null) return; if(_cAt[dk] && String(_cAt[dk]) > String(_sAt[dk]||'') && (prev.lumen_planner||{})[dk]!==undefined) return; _pl[dk] = _sPl[dk]; });\n            if(Object.keys(_pl).length>0) m.lumen_planner = _pl;\n            var _mAt = Object.assign({}, _cAt); Object.keys(_sAt).forEach(function(dk){ if(!_mAt[dk] || String(_sAt[dk]) > String(_mAt[dk])) _mAt[dk] = _sAt[dk]; }); if(Object.keys(_mAt).length>0) m.lumen_planner_at = _mAt;")
    rep("              _pPhotos[p.setId] = (_pRank(ex) > _pRank(p)) ? ex : p;",
        "              var _rx = _pRank(ex), _rp = _pRank(p);   /* ★ v19-82: 같은 순위면 analysis 를 더 최근에 고친 쪽 */\n              _pPhotos[p.setId] = (_rx > _rp) ? ex : ((_rp > _rx) ? p : ((typeof plMergeStamp === 'function' && String(plMergeStamp(ex)) > String(plMergeStamp(p))) ? ex : p));")
if int(ver.replace('v19-',''))>=84:
    # v19-84: 매쓰플랫 동시 접속 가능 (원장 확인 2026-10-07) — 「접속이 끊길 수 있어요」 경고 삭제
    rep("    +'⚠️ 수집하는 몇 분 동안 원장님 매쓰플랫 접속이 끊길 수 있어요.\\n'\n    +'지금 매쓰플랫으로 수업·채점 중이면 끝낸 뒤 눌러주세요.\\n\\n'\n", "    +'\\n'\n")
    rep("  msg+='\\n· 매쓰플랫 동시 접속 시 원장님 접속이 끊길 수 있어요';\n", "")
if int(ver.replace('v19-',''))>=85:
    # v19-85: 🌐 전국 등수 — 신청한 학생만 (natopt_teacher.js) · 되살린 날 점수
    rep("  h+=pill(natOn,'nat','🌐 전국 등수');\n", "")
    rep("  h+=wkPubPanel();   // v18-14: 학생앱 「내 기록」 등수 표시 설정", "  h+=wkPubPanel()+noptPanelHtml();   // v18-14: 학생앱 「내 기록」 등수 표시 설정 · v19-85: 전국 등수 신청")
    rep("      C+='</span></div>';\n    }\n    /* ★ v18-172", "      C+=noptBadge(sel.name)+'</span></div>';   /* v19-85 */\n    }\n    /* ★ v18-172")
    rep("function rPlannerInput(){\n", "function rPlannerInput(){\n  try{ if(typeof plzHealCleared==='function') plzHealCleared(); }catch(e){}   /* v19-85 */\n")
if int(ver.replace('v19-',''))>=86:
    # v19-86: 📔 순공피드백 — 점수 보이기 · 주 옮기기 · 사진 점수 손 고침 (sgscore_teacher.js)
    rep("      if(e) h+='<td onclick=\"sgOpen(\\''+esc2(code)+'\\',\\''+w+'\\')\" title=\"'+sgFmt(sgTotal(e))+' — 눌러서 사진 대조\" style=\"padding:8px 4px;border-bottom:1px solid #f4f6fa;text-align:center;cursor:pointer\">'\n             +'<span style=\"display:inline-block;background:#ecfdf5;color:#059669;border-radius:8px;padding:3px 7px;font-size:11.5px;font-weight:900\">'+sgFmt(sgTotal(e))+(e.photo?' 🖼':'')+'</span></td>';\n      else h+='<td style=\"padding:8px 4px;border-bottom:1px solid #f4f6fa;text-align:center;color:#dbe2ea;font-weight:900\">—</td>';",
        "      h+=sgsCell(code,w,e);   /* v19-86: 사진·종이 점수 */")
    rep("학생이 매주 종이에 쓴 순공시간을 학생앱으로 올린 것 · 칸을 누르면 종이 사진과 입력값을 나란히 대조합니다</div>';\n",
        "학생이 매주 종이에 쓴 순공시간을 학생앱으로 올린 것 · 칸을 누르면 종이 사진과 입력값을 나란히 대조하고, 주 옮기기·점수 고치기를 합니다</div>';\n  h+=sgsBanner();   /* v19-86 */\n")
    rep("      +'<div style=\"font-size:20px;font-weight:900;color:'+k[2]+'\">'+k[1]+'</div></div>';\n  });\n  h+='</div>';\n",
        "      +'<div style=\"font-size:20px;font-weight:900;color:'+k[2]+'\">'+k[1]+'</div></div>';\n  });\n  h+=sgsSummaryTile(list);   /* v19-86 */\n  h+='</div>';\n")
    rep("+w.slice(5).replace('-','/')+(isCur?'<br><span style=\"font-size:9px\">이번 주</span>':'')+'</th>';",
        "+w.slice(5).replace('-','/')+(isCur?'<br><span style=\"font-size:9px\">이번 주</span>':'')+((typeof PWB!=='undefined'&&PWB.loaded&&w===plwDefaultW())?'<br><span style=\"font-size:9px;color:#7c3aed;font-weight:900\">점수 주</span>':'')+'</th>';")
    rep("✕ 닫기</button></div>';\n  if(!w){", "✕ 닫기</button></div>';\n  h+=sgsPopActions(code,mon);   /* v19-86 */\n  if(!w){")
    rep("사진은 선택이라 숫자만 올릴 수도 있습니다.<br>'", "사진이 있어야 제출됩니다(학생앱 v2-111부터). 칸은 <b>종이에 적힌 주</b>이고, 학생앱 v2-129부터 학생이 주를 고릅니다.<br>'")
    rep("if (!ov) delete v.byCode[code][W]; else {", "if (!ov){ var _k = v.byCode[code][W]; if (_k && _k.pov) v.byCode[code][W] = { pov: _k.pov, povWhy: _k.povWhy, povAt: _k.povAt }; else delete v.byCode[code][W]; } else {   /* v19-86: 사진 점수 손 고침(pov)은 남긴다 */")
if int(ver.replace('v19-',''))>=87:
    # v19-87: 여러 기기 등록부 맞추기 (studb_sync.js) — 숙제체크 칸 시각 · 올리기 전 받아 합치기
    rep("""            var _hwc = Object.assign({}, prev.lumen_hw||{});
            var _sHwc = s.lumen_hw||{};
            Object.keys(_sHwc).forEach(function(dk){ if(_sHwc[dk]) _hwc[dk] = _sHwc[dk]; });
            if(Object.keys(_hwc).length>0) m.lumen_hw = _hwc;""",
"""            var _hwc = Object.assign({}, prev.lumen_hw||{});
            var _sHwc = s.lumen_hw||{};
            var _hcAt = prev.lumen_hw_at||{}, _hsAt = s.lumen_hw_at||{};   /* ★ v19-87: 칸마다 더 최근에 고친 쪽 (지운 칸 포함) */
            Object.keys(_sHwc).forEach(function(dk){ if(!_sHwc[dk]) return; if(_hcAt[dk] && String(_hcAt[dk]) > String(_hsAt[dk]||'')) return; _hwc[dk] = _sHwc[dk]; });
            Object.keys(_hsAt).forEach(function(dk){ if(_sHwc[dk]===undefined && String(_hsAt[dk]) > String(_hcAt[dk]||'')) delete _hwc[dk]; });
            m.lumen_hw = _hwc;
            var _hmAt = Object.assign({}, _hcAt); Object.keys(_hsAt).forEach(function(dk){ if(!_hmAt[dk] || String(_hsAt[dk]) > String(_hmAt[dk])) _hmAt[dk] = _hsAt[dk]; }); if(Object.keys(_hmAt).length>0) m.lumen_hw_at = _hmAt;""")
    rep("""        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }
        val = window._fullStudentDb;""",
"""        if (!window._studbPulled || !Array.isArray(window._fullStudentDb)) {
          /* ★ v19-87: 아직 못 받았으면 지금 받아 합친 뒤 올린다(태블릿이 받기에 실패해 체크가 영영 안 올라가던 것) */
          var _fr = null; try { if (typeof sdsSync === 'function') _fr = await sdsSync(true); } catch(e) {}
          if (!_fr || !window._studbPulled || !Array.isArray(window._fullStudentDb)) { window._studbPushLater = true; continue; }
        } else {
          /* ★ v19-87: 올리기 직전 서버 것을 먼저 합친다 — 다른 기기에서 고친 것을 옛 사본으로 덮지 않게 (서버가 그대로면 시각만 확인) */
          try { if (typeof sdsSync === 'function') await sdsSync(false); } catch(e) {}
        }
        val = window._fullStudentDb;""")
    rep("""    var result = await sb.from('lumen_store').upsert(payload, { onConflict: 'key' });
    return !result.error;
  } catch(e) { return false; }""",
"""    var result = await sb.from('lumen_store').upsert(payload, { onConflict: 'key' });
    if (key === 'or_studentdb' && !result.error && typeof SDS !== 'undefined') SDS.cloudAt = payload.updated_at;   /* ★ v19-87 */
    return !result.error;
  } catch(e) { return false; }""")
if int(ver.replace('v19-',''))>=88:
    # v19-88: 주간 점수 = 📅 주간계획 6 + 📔 순공피드백 4 — 보이는 칸 나누기 (wksplit_teacher.js)
    rep("label:'주간 점수(주간계획)'", "label:'주간 점수(계획·순공)'")
    rep("'순공 종이 (학원)', '주간', '매일 합'", "'순공 종이 (학원)', '주간 합 (계획 6 + 순공 4)', '매일 합'")
if int(ver.replace('v19-',''))>=91:
    # v19-91: 주간 점수 20 = 주간계획 10 + 순공 10 (plweek_core PW.PT/PW.MAX) · 앱 시작 다운로드 줄이기
    rep("'주간 합 (계획 6 + 순공 4)'", "'주간 합 (계획 10 + 순공 10)'")
    rep("""      if (_skip.length) _q = _q.not('key', 'in', '(' + _skip.join(',') + ')');""",
"""      if (_skip.length) _q = _q.not('key', 'in', '(' + _skip.join(',') + ')');
      /* ★ v19-91: 앱이 «서버에서 바로 읽는» 큰 자료는 시작 때 받지 않는다 — 69MB → 약 10MB (원장 지시 2026-10-07 「76MB 줄이기」)
       *   교재 정답·학습지 문항·교과서 은행·쪽 목록·기출 DB·해설집·채점 기록·학생별 성취도·학생앱 발행본 등.
       *   이 키들은 화면이 필요할 때 lumen_store 에서 직접 받는다(로컬 사본을 읽는 코드 없음 · 올리기 목록에도 없음). */
      PULL_SKIP_PREFIX.forEach(function(p){ _q = _q.not('key', 'like', p + '%'); });
      _q = _q.not('key', 'in', '(' + PULL_SKIP_KEYS.map(function(k){ return '"' + k + '"'; }).join(',') + ')');""")
    rep("""async function supaFullPull(onlyKeys) {""", """var PULL_SKIP_PREFIX = ['mf_bookans_', 'mf_wsq_', 'mf_textbook_', 'mf_swb_', 'mf_ws_recent_', 'mf_wsans_', 'ms_exam', 'haesol_body_', 'hw_synced_', 'hw_scores_', 'typeach_stu_', 'stu_reports_', 'pub_reports_', 'submissions_', 'or_students_archive_'];
var PULL_SKIP_KEYS = ['mf_type_ach', 'mf_sol_fix', 'mf_bookpages', 'ms_mydb_index', 'mf_ws_behaviors', 'mf_weekly', 'mf_progress', 'mf_books', 'mf_stuck'];
async function supaFullPull(onlyKeys) {""")
if int(ver.replace('v19-',''))>=92:
    # 리커버리 우측 패널: 「확정 전원」 단추 위에 매쓰플랫 계정 칸 (rcws_teacher.js 가 rcMakeWsAll·rcWsBtn 을 새 길로 덮어쓴다)
    rep("""  h+='<button onclick="rcMakeWsAll()" style="border:1.5px solid #bfdbfe;""", """  h+=rcwsAcctBox();   /* ★ v19-92: 매쓰플랫 계정 (이 PC 에만) */
  h+='<button onclick="rcMakeWsAll()" style="border:1.5px solid #bfdbfe;""")
if int(ver.replace('v19-',''))>=99:
    # v19-99: 적중 분석 우리 자료 — 앱이 서버에서 바로 읽는 새 키(수학비서 학습지 인식 ms_paper_<id>·목록 ms_papers_index 160KB · PDF 자료함 exam_lib)는 시작 때 받지 않는다
    rep("'submissions_', 'or_students_archive_'];", "'submissions_', 'or_students_archive_', 'ms_paper'];")
    rep("'mf_books', 'mf_stuck'];", "'mf_books', 'mf_stuck', 'exam_lib'];")
if int(ver.replace('v19-',''))>=102:
    # v19-102: 카드뉴스 브랜드 글꼴 Pretendard (블로그 카드와 같은 글꼴)
    rep('<link rel="icon" type="image/png" href="lumen_icon_teacher.png">', '<link rel="icon" type="image/png" href="lumen_icon_teacher.png">\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><!-- v19-102: 카드뉴스 브랜드 글꼴 -->')
if int(ver.replace('v19-',''))>=107:
    # v19-107: 수학비서 «내 문제지» 인식(ms_mypaper_<id>)·목록(ms_mypapers_index)은 앱이 필요할 때 서버에서 바로 읽는다 — 시작 때 받지 않는다
    rep("'or_students_archive_', 'ms_paper'];", "'or_students_archive_', 'ms_paper', 'ms_mypaper'];")
if int(ver.replace('v19-',''))>=111:
    # v19-111: 📚 교과서일치도 화면 (메뉴 칸은 tbmatch_teacher.js 가 GROUPS 에 끼운다) — 가운데 그리기 · 오른쪽 제목
    a3="    else if(VIEW==='examhit'){ try{ C.innerHTML=rExamHit(); }"
    assert s.count(a3)==2
    s=s.replace(a3, "    else if(VIEW==='tbmatch'){ try{ C.innerHTML=rTbMatch(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">교과서일치도 오류: '+esc2(e.message)+'</div>'; } }\n"+a3)
    rep("examhit:'🎯 적중 분석'","examhit:'🎯 적중 분석',tbmatch:'📚 교과서일치도'")
if int(ver.replace('v19-',''))>=115:
    # v19-115: 🗓 주간계획 모아보기 (메뉴 칸 = 위 기능 탭은 plwall_teacher.js 가 GROUPS 에 · 왼쪽 플래너 묶음은 여기서) — 가운데 그리기 · 제목
    rep("    {id:'@plweek',   icon:'📅', label:'주간 점수(계획·순공)', red:false},\n",
        "    {id:'@plweek',   icon:'📅', label:'주간 점수(계획·순공)', red:false},\n    {id:'@plwall',   icon:'🗓', label:'주간계획 모아보기', red:false},   /* ★ v19-115 */\n")
    a4="    else if(VIEW==='plweek'){ try{ C.innerHTML=rPlWeek(); }"
    assert s.count(a4)==2
    s=s.replace(a4, "    else if(VIEW==='plwall'){ try{ C.innerHTML=rPlWall(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">주간계획 모아보기 오류: '+esc2(e.message)+'</div>'; } }\n"+a4)
    rep("plweek:'📅 주간 점수',", "plweek:'📅 주간 점수',plwall:'🗓 주간계획 모아보기',")
if int(ver.replace('v19-',''))>=117:
    # v19-117: 아이패드·아이폰(사파리) 저장 보호 장치 — localStorage.setItem = function 은 크롬에선 걸리지만
    #   사파리에선 «setItem 이라는 이름의 값»을 저장할 뿐 진짜 저장 함수는 그대로였다(오류 줄 setItem@[native code]).
    #   그래서 등록부 슬림본·서버 전용 키 메모리 보관·한도 초과 대비가 아이패드에서 하나도 작동하지 않았다.
    #   → 세 함수를 Storage.prototype 에서 감싼다(localStorage 일 때만). 켜질 때 서버 전용 키의 디스크 사본은 메모리로 옮기고 비운다.
    rep("localStorage.getItem = function(key) {", "var _lsHookGet = function(key) {")
    rep("localStorage.removeItem = function(key) {", "var _lsHookRemove = function(key) {")
    rep("localStorage.setItem = function(key, value) {", "var _lsHookSet = function(key, value) {")
    rep("    scheduleSync(key);\n  }\n};\nfunction _quotaWarn(){",
        "    scheduleSync(key);\n  }\n};\n" + open(SP+'/lshook117_teacher.js').read() + "\nfunction _quotaWarn(){")
if int(ver.replace('v19-',''))>=119:
    # v19-119: ⏰ 반 수업 시간 (grptime119_teacher.js) — 기기 ↔ 서버 동기화 · 주간 점수판 자료에 lumen_group_times · 모아보기 머리 단추 · 카드 꼬리표 · 설정 칸
    rep("'lumen_exams', 'lumen_group_days', 'lumen_rec_submit',", "'lumen_exams', 'lumen_group_days', 'lumen_group_times', 'lumen_rec_submit',")
    rep("key.eq.plweek_paper,key.eq.lumen_group_days,key.like.codi_plan_%", "key.eq.plweek_paper,key.eq.lumen_group_days,key.eq.lumen_group_times,key.like.codi_plan_%")
    rep("var wp = {}, chk = {}, sg = {}, cp = {}, cd = {}, fx = {}, paper = { byCode: {} }, days = {};", "var wp = {}, chk = {}, sg = {}, cp = {}, cd = {}, fx = {}, paper = { byCode: {} }, days = {}, gt = {};")
    rep("      else if (k === 'lumen_group_days') days = v || {};\n", "      else if (k === 'lumen_group_days') days = v || {};\n      else if (k === 'lumen_group_times') gt = (v && typeof v === 'object') ? v : {};   /* v19-119: ⏰ 반 수업 시간 */\n")
    rep("PWB.paper = paper; PWB.days = days; PWB.loaded = true;", "PWB.paper = paper; PWB.days = days; PWB.gt = gt; PWB.loaded = true;")
    rep("<b class=\"pwl-ttl\">🗓 주간계획 모아보기</b>'", "<b class=\"pwl-ttl\">🗓 주간계획 모아보기</b><button type=\"button\" class=\"pwl-c pwl-lgt\" onclick=\"lgtOpen()\">⏰ 반 수업 시간</button>'")
    rep("  if (!R.fx.mine) tags += '<span class=\"pwl-fxtag\">📌 고정 일정 안 넣음(학교 기본)</span>';\n",
        "  if (!R.fx.mine) tags += '<span class=\"pwl-fxtag\">📌 고정 일정 안 넣음(학교 기본)</span>';\n  if (R.fx.lumen === 'own') tags += '<span class=\"pwl-owntag\" title=\"학생이 학생앱에서 자기 학원 시간을 고쳤어요 — 반 시간 대신 이 시간으로 그렸어요\">✏️ 학생이 고친 학원 시간</span>';   /* v19-119 */\n")
    rep("    + (fx.mine ? '' : tag('고정 일정 안 넣음 — 학교 기본값', '#fff7ed', '#9a3412')) + '</div>';",
        "    + (fx.mine ? '' : tag('고정 일정 안 넣음 — 학교 기본값', '#fff7ed', '#9a3412')) + (fx.lumen === 'own' ? tag('✏️ 학생이 고친 학원 시간', '#fef3c7', '#92400e') : '') + '</div>';   /* v19-119 */")
    rep("""            <div style="display:flex;gap:4px">${btns}</div>
          </div>`;
        }).join('')}
      </div>""", """            <div style="display:flex;gap:4px">${btns}</div>${lgtSummary(g)}
          </div>`;
        }).join('')}
        <button type="button" class="lgt-open" onclick="lgtOpen()">⏰ 반 수업 시간 (요일별 시작·길이)</button>
      </div>""")
if int(ver.replace('v19-',''))>=120:
    # v19-120: 학생앱 v2-136 코디가 영어·국어·과학·사회 칸도 넣는다 — 실천 증거 검사(plrIsMath)는 과목을 먼저 본다(예전엔 코디 칸 = 무조건 수학)
    rep("if(it.src==='codi') return true; if(s) return /수학|math/i.test(s);", "if(s) return /수학|math/i.test(s); if(it.src==='codi') return true;")
    rep("  if (k === 'goal') return '목표';\n", "  if (k === 'goal') return '목표';\n  if (k === 'fill') return '코디';   /* v19-120: 학생앱 v2-136 다른 과목 채우기 */\n  if (k === 'exam') return '시험대비';\n")
if int(ver.replace('v19-',''))>=121:
    # v19-121: 🧠 루멘 수학퀴즈 (메뉴 칸은 mathquiz121_teacher.js 가 GROUPS 「학생앱」에 끼운다) — 가운데 그리기 · 제목 · 큰 키는 시작 때 받지 않음
    a5="    else if(VIEW==='plwall'){ try{ C.innerHTML=rPlWall(); }"
    assert s.count(a5)==2
    s=s.replace(a5, "    else if(VIEW==='mathquiz'){ try{ C.innerHTML=rMathQuiz(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">루멘 수학퀴즈 오류: '+esc2(e.message)+'</div>'; } }\n"+a5)
    rep("tbmatch:'📚 교과서일치도'", "tbmatch:'📚 교과서일치도',mathquiz:'🧠 루멘 수학퀴즈'")
    #   quiz_index · quiz_<id> · quiz_words_<학년> · quizlog_<코드> · wordlog_<코드> — 화면이 서버에서 바로 읽는다(이 기기 사본 없음)
    rep("'or_students_archive_', 'ms_paper', 'ms_mypaper'];", "'or_students_archive_', 'ms_paper', 'ms_mypaper', 'quiz', 'wordlog_'];")
if int(ver.replace('v19-',''))>=122:
    # v19-122: 진도 레이스 화면 «시즌 마무리» 카드 바로 아래에 «🆕 다음 시즌» 카드 (지난 시즌이 접혀 있어도 보인다)
    rep("  h+=(typeof seaCardHtml==='function')?seaCardHtml():'';   /* ★ v19-69: 시즌 마무리 · 다음 시즌 예고 */",
        "  h+=(typeof seaCardHtml==='function')?seaCardHtml():'';   /* ★ v19-69: 시즌 마무리 · 다음 시즌 예고 */\n  h+=(typeof rnxCardHtml==='function')?rnxCardHtml():'';   /* ★ v19-122: 🆕 다음 시즌 (원장님만 보기) */")
    #   중고등부(leagues.combined) 시즌을 공개하면 board.bandNames.mid = '중고등부' — 학원앱 순위표 제목도 그 이름으로
    rep("    var title=(band==='mid'?'중등부':band==='high'?'고등부':'초등부');",
        "    var title=((b.bandNames||{})[band])||(band==='mid'?'중등부':band==='high'?'고등부':'초등부');   /* ★ v19-122 */")
    #   다음 시즌 키는 화면이 서버에서 바로 읽는다 — 시작 때 이 기기에 받지 않는다(옛 사본이 남지 않게)
    rep("'mf_stuck', 'exam_lib'];", "'mf_stuck', 'exam_lib', 'race_season_draft', 'race_board_draft', 'race_watch_draft', 'race_recount_req'];")
if int(ver.replace('v19-',''))>=124:
    # v19-124: 📅 네이버 예약 (메뉴 칸은 naverbook124_teacher.js 가 GROUPS 「수업·출결」에 끼운다) — 가운데 그리기 · 제목 · 시작 다운로드 제외 · 홈 작은 칸
    a6="    else if(VIEW==='mathquiz'){ try{ C.innerHTML=rMathQuiz(); }"
    assert s.count(a6)==2
    s=s.replace(a6, "    else if(VIEW==='naverbk'){ try{ C.innerHTML=rNaverBk(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">네이버 예약 오류: '+esc2(e.message)+'</div>'; } }\n"+a6)
    rep("mathquiz:'🧠 루멘 수학퀴즈'", "mathquiz:'🧠 루멘 수학퀴즈',naverbk:'📅 네이버 예약'")
    #   naver_bookings · naver_bookings_pii(잠근 상자) · naver_bookings_status · naver_booking_links — 화면이 서버에서 바로 읽는다(이 기기 사본 없음)
    rep("'ms_paper', 'ms_mypaper', 'quiz', 'wordlog_'];", "'ms_paper', 'ms_mypaper', 'quiz', 'wordlog_', 'naver_book'];")
    #   서버 잠금 열쇠(lumen_db_key)는 기기에만 둔다 — 서버에 사본이 있어도(2026-10-17 확인) 받아서 이 기기 열쇠를 덮지 않는다(올리기는 부품이 막음)
    rep("'race_watch_draft', 'race_recount_req'];", "'race_watch_draft', 'race_recount_req', 'lumen_db_key'];")
    rep("  if(typeof attHomeTodayWidget==='function') h+=attHomeTodayWidget();\n",
        "  if(typeof attHomeTodayWidget==='function') h+=attHomeTodayWidget();\n  if(typeof nbkHomeCard==='function') h+=nbkHomeCard();   /* ★ v19-124: 📅 오늘 네이버 예약 */\n")
if int(ver.replace('v19-',''))>=125:
    # v19-125: 기억한 전화 지문표(naver_phone_links)는 수집기만 쓴다 — 앱은 받지 않는다
    rep("'race_recount_req', 'lumen_db_key'];", "'race_recount_req', 'lumen_db_key', 'naver_phone_links'];")
if int(ver.replace('v19-',''))>=126:
    # v19-126: 네이버 예약 — 로고는 부품(naverbook126_teacher.js)이 메뉴 칸·화면 제목·홈 칸에 넣는다 (titles 표의 RIGHT_TITLE 칸은 화면에 없어 그대로)
    #   «예약 열쇠»(or_nb_key)는 이 기기에만 — 서버로 안 올림(HTS_LOCAL_ONLY · 부품의 scheduleSync 막기) · 시작 다운로드 제외 · 비상 비우기에서도 남김
    rep("var HTS_LOCAL_ONLY = { or_gh_token:1, or_mf_id:1, or_mf_pw:1 };", "var HTS_LOCAL_ONLY = { or_gh_token:1, or_mf_id:1, or_mf_pw:1, or_nb_key:1 };")
    rep("'race_recount_req', 'lumen_db_key', 'naver_phone_links'];", "'race_recount_req', 'lumen_db_key', 'naver_phone_links', 'or_nb_key'];")
    rep("                 lumen_db_key:1, lumen_fz:1, lumen_wb_rw:1, lumen_wb_lw:1 };", "                 lumen_db_key:1, or_nb_key:1, lumen_fz:1, lumen_wb_rw:1, lumen_wb_lw:1 };")
    #   주소 뒤 #nbkey=… (한 번) → 이 기기 localStorage or_nb_key · 주소에서 그 부분만 지운다. #dbkey 처리보다 먼저(그쪽은 주소 뒤를 통째로 지움)
    rep("/* ★ v19-18: 서버 «지우기» 잠금 열쇠 (docs/rls_lock.sql).",
        "/* ★ v19-126: 네이버 예약 «예약 열쇠» — 주소 뒤 #nbkey=… 를 한 번 붙여 열면 이 기기에만 저장(서버로 안 올림), 주소에서는 지운다 */\n"
        "(function(){\n"
        "  try{\n"
        "    var h=String(location.hash||''), m=h.match(/(?:^#|[#&])nbkey=([^&]*)/);\n"
        "    if(!m) return;\n"
        "    var v=''; try{ v=decodeURIComponent(m[1]); }catch(e){ v=m[1]; }\n"
        "    v=String(v).trim();\n"
        "    var rest=h.replace(/^#/,'').split('&').filter(function(x){ return x && x.indexOf('nbkey=')!==0; }).join('&');\n"
        "    try{ history.replaceState(null,'',location.pathname+location.search+(rest?'#'+rest:'')); }catch(e){ location.hash=rest; }\n"
        "    if(v.length>=8){ localStorage.setItem('or_nb_key', v); setTimeout(function(){ try{ alert('🔑 네이버 예약 열쇠를 이 기기에 저장했습니다.\\n이제 「네이버 예약」에서 예약자 이름·전화가 보입니다.'); }catch(e){} }, 700); }\n"
        "  }catch(e){}\n"
        "})();\n"
        "/* ★ v19-18: 서버 «지우기» 잠금 열쇠 (docs/rls_lock.sql).")
if int(ver.replace('v19-',''))>=127:
    # v19-127: 📊 예약 통계 (메뉴 칸은 naverstats127_teacher.js 가 「수업·출결」 네이버 예약 바로 뒤에 끼운다) — 가운데 그리기 · 제목
    a7="    else if(VIEW==='naverbk'){ try{ C.innerHTML=rNaverBk(); }"
    assert s.count(a7)==2
    s=s.replace(a7, "    else if(VIEW==='naverstats'){ try{ C.innerHTML=rNaverStats(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">예약 통계 오류: '+esc2(e.message)+'</div>'; } }\n"+a7)
    rep("naverbk:'📅 네이버 예약'", "naverbk:'📅 네이버 예약',naverstats:'📊 예약 통계'")
    #   보관(naver_bookings_archive, 약 130KB) · 카톡 글 틀(naver_msg_tpl) · 텐투텐 필수 아님(tenten_optional) — 화면이 서버에서 바로 읽고 쓴다(이 기기 사본 없음)
    rep("'naver_phone_links', 'or_nb_key'];", "'naver_phone_links', 'or_nb_key', 'naver_bookings_archive', 'naver_msg_tpl', 'tenten_optional'];")
if int(ver.replace('v19-',''))>=137:
    # v19-137: 다음 시즌 레이드 순위판·보스 보관함은 화면이 서버에서 바로 읽고 쓴다 — 시작 다운로드에서 뺀다(옛 사본이 남지 않게)
    rep("'or_nb_key', 'naver_bookings_archive', 'naver_msg_tpl', 'tenten_optional'];", "'or_nb_key', 'naver_bookings_archive', 'naver_msg_tpl', 'tenten_optional', 'raid_board_draft', 'raid_boss_lib'];")
    #   다음 시즌 ✏️ 고치기 칸의 옛 안내(추가 버프는 꺼 둠) → 아래 «🔥 추가 버프 기간» 칸에서 정한다
    rep("추가 버프(boost)는 꺼 둡니다 — 공개 뒤 ⚙️ 시즌 설정에서 켤 수 있어요", "추가 버프(시험 2주 전)는 아래 «🔥 추가 버프 기간» 칸에서 정합니다")
    #   지금 시즌 ⚔️ 보스 레이드 칸 머리에 🗃 보스 보관함 단추
    rep("""    +'<button onclick="raidPeek()" style="border:none;border-radius:8px;padding:6px 13px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#6d28d9;color:#fff">👁 학생 눈으로</button>'""",
        """    +'<button onclick="raidPeek()" style="border:none;border-radius:8px;padding:6px 13px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#6d28d9;color:#fff">👁 학생 눈으로</button>'
    +'<button id="raid-lib-open" onclick="rxLibOpen()" style="border:none;border-radius:8px;padding:6px 13px;font-size:11.5px;font-weight:800;cursor:pointer;font-family:inherit;background:#0d0a1d;color:#fff">🗃 보스 보관함</button>'""")
if int(ver.replace('v19-',''))>=151:
    # v19-151: 학원앱 「🤖 사진 읽기」 결과에서도 인쇄된 칸 이름을 뗀다 (원장 10/22 「칸 이름은 빼도록 고쳐줘」)
    rep("  // 마지막 물음표 문장을 질문으로 떼어 낸다 (학생앱 ahaSplitP와 같은 규칙)\n  var P=String(out.P||'').trim()",
        "  try{ out=lampStripAi(out)||out; }catch(e){}   /* ★ v19-151: 인쇄된 칸 이름 빼기 */\n  // 마지막 물음표 문장을 질문으로 떼어 낸다 (학생앱 ahaSplitP와 같은 규칙)\n  var P=String(out.P||'').trim()")
if int(ver.replace('v19-',''))>=156:
    # v19-156: 출결·보충 — 결석한 그 날 보충도 지정 가능 (원장 10/24 「같은날 보충도 가능하게 수정」)
    #   예전(v17-19)엔 보충 칸 m[보충일]={planned} 이 결석 칸 m[결석일] 을 덮어써 기록이 깨져서 막아 두었다.
    #   같은 날이면 보충 칸을 따로 만들지 않고 결석 칸 안에만 적는다(makeupDate=결석일 · makeupSame:true) — 결석은 그대로 남고 보충 예정/완료만 바뀐다.
    rep("  if(dp===absKey){alert('보충 날짜는 결석일('+attMd(absKey)+')과 다른 날짜로 선택해주세요.');return;}",
        "  if(dp===absKey){ m[absKey].makeupDate=dp; m[absKey].makeupTime=tp||''; m[absKey].makeupSame=true; attSave(); render(); return; }   /* ★ v19-156: 같은 날 보충 — 결석 칸 안에만 적는다 */")
    rep("if(mk&&m[mk])delete m[mk];delete m[absKey]", "if(mk&&mk!==absKey&&m[mk])delete m[mk];delete m[absKey].makeupSame;delete m[absKey]")
    rep("var mk=m[absKey].makeupDate;if(mk&&m[mk])m[mk].status='done';", "var mk=m[absKey].makeupDate;if(mk&&mk!==absKey&&m[mk])m[mk].status='done';")
    rep("if(mk&&m[mk])m[mk].status='planned';m[absKey].makeupDone=false;", "if(mk&&mk!==absKey&&m[mk])m[mk].status='planned';m[absKey].makeupDone=false;")
    rep("if(ad.makeupDone)info='✓ '+attMd(ad.makeupDate)+' 보충';else if(ad.makeupDate)info='→ '+attMd(ad.makeupDate)+' '+(ad.makeupTime||'');",
        "if(ad.makeupDone)info=(ad.makeupSame?'✓ 같은 날 보충':'✓ '+attMd(ad.makeupDate)+' 보충');else if(ad.makeupDate)info=(ad.makeupSame?'→ 같은 날 '+(ad.makeupTime||'')+' 보충':'→ '+attMd(ad.makeupDate)+' '+(ad.makeupTime||''));")
if int(ver.replace('v19-',''))>=152:
    # v19-152: 🎙 녹음관리 › 👀 훑어보기 (원장 10/23 「안 A로 진행」 · docs/rec_review_contract.md §3 · 부품 recreview152_teacher.js)
    #   ① 왼쪽 메뉴 맨 위에 «👀 훑어보기» ② 가운데 그리기 가지 ③ 녹음관리 들어가면 훑어보기부터
    rep("    {id:'grid',    icon:'📅', label:'그리드'},", "    {id:'review',  icon:'👀', label:'훑어보기'},   /* ★ v19-152 */\n    {id:'grid',    icon:'📅', label:'그리드'},")
    rep("  if (REC_MGR_VIEW === 'grid')         body = rRecMgrGrid();", "  if (REC_MGR_VIEW === 'review')       body = rr152View();   /* ★ v19-152 */\n  else if (REC_MGR_VIEW === 'grid')    body = rRecMgrGrid();")
    rep("REC_MGR_VIEW='grid'; }},", "REC_MGR_VIEW='review'; }},")
    #   ④ 그리드 ✅ = 손 받아쓰기 또는 새벽 읽기 · 팝업 STT 칸에 «🌙 새벽 읽기»(판정·요약·전문) — 손 받아쓰기 칸은 예전 그대로
    rep("var hasStt = !!savedRec.stt;", "var hasStt = !!savedRec.stt || rr152Has(code, dayFiles);   /* ★ v19-152: 새벽 읽기도 ✅ */")
    rep("""    if (savedRec.stt) {
      html += '<div style="background:white;border-radius:8px;padding:8px;border:1px solid #e2e8f0;margin-bottom:6px"><div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:4px">🔤 STT</div><div style="font-size:12px;color:#334155;line-height:1.6">' + savedRec.stt + '</div></div>';
    }""", """    html += rr152PopStt(savedRec, stCode, file.name);   /* ★ v19-152: 🌙 새벽 읽기 + 🔤 STT(손 받아쓰기, 예전 그대로) */""")
    #   ⑤ 새벽 읽기 결과·확인 기록은 화면이 서버에서 바로 읽는다 — 시작 다운로드에서 뺀다
    rep("'naver_book'];", "'naver_book', 'rec_read_', 'rec_review_'];")
if int(ver.replace('v19-',''))>=149:
    # v19-149: 리커버리 — 고등부는 모든 테스트(수집기가 type HIGH_TEST 로 내보냄 · 단원 TEST 도) (원장 10/22 「우선은 체계가 잡히기 전에 고등부는 모든 테스트를 하자」)
    rep("""    var stKey=String(st.id||st.name);
    // ① 시험 기준
    var testHit=null;
    (WK.tests||[]).forEach(function(t){
      if(t.type!=='WEEKLY') return;""", """    var stKey=String(st.id||st.name);
    // ① 시험 기준
    var testHit=null;
    var _hiStu=/고/.test(String(st.grade||''));   /* ★ v19-149: 고등부는 HIGH_TEST(일일·내신대비·모의고사…)·단원 TEST 도 */
    (WK.tests||[]).forEach(function(t){
      if(t.type!=='WEEKLY' && !(_hiStu && (t.type==='HIGH_TEST'||t.type==='CHAPTER'))) return;""")
    rep("if(!testHit||String(tookOn)>String(testHit.date)) testHit={ date:tookOn, title:t.title,", "if(!testHit||String(tookOn)>String(testHit.date)) testHit={ ttype:t.type, date:tookOn, title:t.title,")
    rep("""    if(t.type!=='WEEKLY') return;
    var me=(t.students||[]).find(function(s){ return String(s.sid)===String(sid)&&s.score!=null; }); if(!me) return;""", """    if(t.type!=='WEEKLY' && t.type!=='HIGH_TEST') return;   /* ★ v19-149: 고등부 테스트도 리커버리 학습지 재료로 */
    var me=(t.students||[]).find(function(s){ return String(s.sid)===String(sid)&&s.score!=null; }); if(!me) return;""")
    #   🏆 주간 리포트(발행 화면)에는 고등부 테스트(HIGH_TEST)를 늘어놓지 않는다 — 리커버리 전용
    rep("  WK.tests.forEach(function(t, ti){\n    var isOpen = WK.open.hasOwnProperty(t.key)", "  WK.tests.filter(function(t){ return t.type!=='HIGH_TEST'; }).forEach(function(t, ti){   /* ★ v19-149 */\n    var isOpen = WK.open.hasOwnProperty(t.key)")
    #   학생 칸 «최근 시험 2개» 이름 — HIGH_TEST 는 «테스트»
    rep("+(t.type==='WEEKLY'?'주간테스트':'단원테스트')+", "+(t.type==='WEEKLY'?'주간테스트':(t.type==='HIGH_TEST'?'테스트':'단원테스트'))+")
if int(ver.replace('v19-',''))>=144:
    # v19-144: 아하노트 일괄 확정에서 «8점 이상» 기준을 없앤다 — AI 초안이 있으면 점수와 상관없이 전부 확정 (원장 10/21 「8점이상 확정말고 전부 확정하자」)
    rep("s.status==='temp' && (s.total||0)>=8", "s.status==='temp'", 4)
    rep("✓ 이 날 8점 이상 확정 (", "✓ 이 날 전부 확정 (", 2)
    rep("' · 8점 이상 '", "' · 확정 대기 '")
    rep("var min=8;", "var min=0;   /* ★ v19-144: 점수 기준 없음 — 전부 확정 */")
    rep('title="AI 초안이 있고 질문력 8점 이상인 노트를 그대로 확정합니다"', 'title="AI 초안이 있는 노트를 점수와 상관없이 모두 그대로 확정합니다 (왼쪽에서 학생을 고르면 그 학생만)"')
    rep(">✓ 8점 이상 확정</button>", ">✓ 전부 확정</button>")
    rep("「✓ 8점 이상 일괄확정」", "「✓ 전부 확정」", 2)
    rep("(AI 초안이 있고 질문력 8점 이상)", "(AI 초안이 있는 노트 — 초안이 없으면 먼저 🤖 AI 초안)")
    rep("(AI 초안이 있고 질문력 '+min+'점 이상인 노트)", "(AI 초안이 있는 노트 — 초안이 없으면 먼저 🤖 AI 초안 일괄)")
    rep("+targets.length+'건을 AI 초안 그대로 확정할까요? (질문력 '+min+'점 이상)')", "+targets.length+'건을 AI 초안 그대로 확정할까요? (점수와 상관없이 전부)')")
if int(ver.replace('v19-',''))>=143:
    # v19-143: 홈 위 빨간 띠 — 「퇴원 → 재원 (되살아남)」만 있으면 «로그인 코드가 바뀌어 못 들어갑니다»가 아니라
    #   «퇴원했던 학생이 재원으로 바뀌었습니다 — 일부러 복귀시키셨으면 그대로 두세요»(주황, 한 번만)로. 원장 10/20 「퇴원생 오류」(유○○ 복귀)
    #   × 로 닫으면 위 여백도 되돌린다.
    rep("""      d.innerHTML='<span style="font-size:17px">⚠️</span>'
        +'<span style="flex:1;min-width:200px">학생 <b>로그인 코드가 바뀌었습니다</b> — 이 학생들은 학생앱에 못 들어갑니다.'
        +'<span style="display:block;font-weight:700;opacity:.9;margin-top:3px;font-size:12.5px">'+ch.map(esc2).join('<br>')+'</span></span>'
        +'<button onclick="document.getElementById(\\'lm-code-warn\\').remove()" style=""",
        """      /* ★ v19-143: 코드가 바뀐 줄과 «퇴원 → 재원» 줄을 나눠 말한다 — 복귀만 있으면 주황 안내(사고 아님) */
      var _rv=ch.filter(function(x){ return /퇴원 → 재원/.test(x); }), _cd=ch.filter(function(x){ return !/퇴원 → 재원/.test(x); });
      if(!_cd.length) d.style.background='linear-gradient(135deg,#b45309,#d97706)';
      d.innerHTML='<span style="font-size:17px">'+(_cd.length?'⚠️':'ℹ️')+'</span>'
        +'<span style="flex:1;min-width:200px">'
        +(_cd.length?('학생 <b>로그인 코드가 바뀌었습니다</b> — 이 학생들은 학생앱에 못 들어갑니다.'
          +'<span style="display:block;font-weight:700;opacity:.9;margin-top:3px;font-size:12.5px">'+_cd.map(esc2).join('<br>')+'</span>'):'')
        +(_rv.length?('<span style="display:block'+(_cd.length?';margin-top:7px':'')+'"><b>퇴원했던 학생이 재원으로 바뀌었습니다</b> — 학생관리에서 일부러 복귀시키셨으면 그대로 두시면 됩니다(이 알림은 한 번만 나옵니다). 모르는 일이면 학생관리에서 🚪 퇴원을 다시 눌러 주세요.</span>'
          +'<span style="display:block;font-weight:700;opacity:.9;margin-top:3px;font-size:12.5px">'+_rv.map(function(x){ return esc2(x.replace(' (되살아남)',' (복귀)')); }).join('<br>')+'</span>'):'')
        +'</span>'
        +'<button onclick="document.getElementById(\\'lm-code-warn\\').remove();document.body.style.paddingTop=\\'\\'" style=""")
if int(ver.replace('v19-',''))>=157:
    # v19-157: ① 👤 학생관리 «🔗 매쓰플랫과 연결 안 된 학생» 띠 (원장 10/26 「매쓰플랫 학생이 연결이 안 되었다」 — 학원앱 등록부에 없던 신규생 2명)
    rep("    <!-- 필터 바 -->", "    ${typeof mfuHtml==='function'?mfuHtml():''}\n    <!-- 필터 바 -->")
    #   ② 🔗 데이터 재연결 — lumen_store 전체 읽기가 statement timeout → 필요한 키만 100줄씩
    rep("    var res=await sb.from('lumen_store').select('key,value');\n    if(res.error){ throw res.error; }\n    allRows=res.data||[];",
        "    allRows=await mfuRelinkRows(sb);   /* ★ v19-157: 필요한 키만 나눠 읽기 (전체 읽기는 시간 초과) */")
    #   ③ 📔 플래너 입력 표 — 감싼 틀이 overflow:hidden 이라 오른쪽 «합계»(sticky)가 27~31일을 덮었다 (원장 10/26 「말일에 짤린다」)
    #      → 가로로 밀어 볼 수 있게 + 칸을 조금 줄여 대부분 화면에서 말일까지 한 번에 보이게
    rep("""  h+='<div style="background:white;border:1.5px solid #e8edf5;border-radius:14px;overflow:hidden">';
  h+='<table style="border-collapse:collapse;width:100%;font-size:11px">';""",
        """  h+='<style>#plGridWrap th{min-width:22px!important;padding-left:1px!important;padding-right:1px!important}#plGridWrap td{padding:1px!important}#plGridWrap .planner-cell{width:21px!important;height:22px!important;font-size:9.5px!important}#plGridWrap td>div[onclick^="VIEW="]{width:22px!important;height:22px!important;font-size:9.5px!important}#plGridWrap td:first-child,#plGridWrap th:first-child{padding:4px 8px!important}</style>';   /* ★ v19-157 */
  h+='<div id="plGridWrap" style="background:white;border:1.5px solid #e8edf5;border-radius:14px;overflow-x:auto">';
  h+='<table style="border-collapse:collapse;width:100%;font-size:11px">';""")
if int(ver.replace('v19-',''))>=158:
    # v19-158: 📅 운영 달력 (원장 10/26 「오른쪽 칸 없애고 v19-158 진행해」 · 부품 opscal158_teacher.js · docs/opscal_contract.md)
    #   ① 🏠 홈 탭에 «📅 운영 달력» ② 그리기 가지 ③ 제목 ④ 시작 다운로드에서 ops_plan·ops_checks 빼기 ⑤ 학원 달력 머리에 «📅 운영 달력» 단추
    rep("    {v:'home', icon:'🏠', label:'대시보드', act:function(){ VIEW='home'; }}\n  ]},",
        "    {v:'home', icon:'🏠', label:'대시보드', act:function(){ VIEW='home'; }},\n    {v:'opscal', icon:'📅', label:'운영 달력', act:function(){ VIEW='opscal'; OPS.man=''; }}   /* ★ v19-158 */\n  ]},")
    b="    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }"
    assert s.count(b)==2
    s=s.replace(b, "    else if(VIEW==='opscal'){ try{ C.innerHTML=rOpsCal(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">운영 달력 오류: '+esc2(e.message)+'</div>'; } }\n"+b)
    rep("cal:'📅 학원 달력',", "cal:'📅 학원 달력',opscal:'📅 운영 달력',")
    rep("'tenten_optional', 'raid_board_draft', 'raid_boss_lib'];", "'tenten_optional', 'raid_board_draft', 'raid_boss_lib', 'ops_plan', 'ops_checks'];")
    rep("eaBtn('＋ 일정 넣기','ctNew()','pri')+eaBtn('🔄 새로고침','ctLoad(true)')", "eaBtn('📅 운영 달력',\"VIEW='opscal';render()\")+eaBtn('＋ 일정 넣기','ctNew()','pri')+eaBtn('🔄 새로고침','ctLoad(true)')")
if int(ver.replace('v19-',''))>=159:
    # v19-159: ① 📅 운영 달력을 위쪽 탭으로 (원장 10/26 「홈화면에 운영달력 안 보인다» — 홈 탭은 누르면 바로 대시보드라 v19-158 의 안쪽 줄이 안 보였다)
    rep("    {v:'home', icon:'🏠', label:'대시보드', act:function(){ VIEW='home'; }},\n    {v:'opscal', icon:'📅', label:'운영 달력', act:function(){ VIEW='opscal'; OPS.man=''; }}   /* ★ v19-158 */\n  ]},",
        "    {v:'home', icon:'🏠', label:'대시보드', act:function(){ VIEW='home'; }}\n  ]},\n  /* ★ v19-159: 📅 운영 달력 — 위쪽 탭 */\n  {key:'opscal', icon:'📅', label:'운영 달력', memo:'계획', subs:[\n    {v:'opscal', icon:'📅', label:'운영 달력', act:function(){ VIEW='opscal'; OPS.man=''; }}\n  ]},")
    #   ② 홈 «📅 오늘 운영 할 일» 카드 (빠른 실행 바로 아래) + «오늘 챙길 것» 개수에 더하기
    rep("  // ── 오늘 결석·지각 예정(출결) ──\n  if(typeof attHomeTodayWidget==='function') h+=attHomeTodayWidget();",
        "  if(typeof opsHomeCard==='function') h+=opsHomeCard();   /* ★ v19-159: 📅 오늘 운영 할 일 */\n  // ── 오늘 결석·지각 예정(출결) ──\n  if(typeof attHomeTodayWidget==='function') h+=attHomeTodayWidget();")
    rep("(hallPend===null?0:hallPend), (pcPend===null?0:pcPend)];", "(hallPend===null?0:hallPend), (pcPend===null?0:pcPend), (typeof opsHomeCount==='function'?opsHomeCount():0)];   /* ★ v19-159: 운영 할 일 */")
    rep("  try { if (VIEW === 'opscal') render(); } catch(e){}", "  try { if (VIEW === 'opscal' || VIEW === 'home') render(); } catch(e){}   /* ★ v19-159: 홈 카드도 */")
    #   위쪽 탭 단추는 HTML 에 따로 적혀 있다 — 홈 다음에 «📅 운영 달력»
    rep("""      <button class="ftb" id="grp-home" onclick="selGroup('home')"><span>🏠</span><span>홈</span></button>""",
        """      <button class="ftb" id="grp-home" onclick="selGroup('home')"><span>🏠</span><span>홈</span></button>
      <button class="ftb" id="grp-opscal" onclick="selGroup('opscal')"><span>📅</span><span>운영 달력</span></button>""")
    #   «밀린 일»은 계획을 넣은 날(ops_plan.upd) 1주 전부터만 센다 — 계획이 없던 10월 초 일이 빨갛게 쌓이지 않게
    rep("it.d < opsToday() && !opsDone(it) && it.d >= '2026-10-01'; }", "it.d < opsToday() && !opsDone(it) && it.d >= opsStart(); }   /* ★ v19-159 */")
    #   ③ 📔 플래너 사진 AI 일괄 분석 — 한 세트씩 → 세 세트씩 함께 (원장 10/26 「플래너 검토가 오래 걸린다」)
    #      같은 학생 세트는 겹쳐 돌리지 않는다 · 429(요청 과다)가 한 번이라도 나면 한 줄로 돌아가 10초 간격(예전 그대로) · 중단 단추 존중
    rep("""  window._plannerAdaptiveGap = 0;
  for (var k = 0; k < jobs.length; k++) {
    var job = jobs[k];
    var result = await _analyzeWithRetry(job.stId, job.si, job.setId, 2);
    if (!result.ok) failed++;
    if (result.rateLimited) window._plannerAdaptiveGap = 10; // 한 번이라도 429면 이후 10초 간격
    done++;
    if (statusEl) statusEl.innerHTML = renderProgress(done, total, failed);
    if (k < jobs.length - 1 && window._plannerAdaptiveGap > 0) {
      for (var s = window._plannerAdaptiveGap; s > 0; s--) {
        if (statusEl) statusEl.innerHTML = renderProgress(done, total, failed, '다음 분석까지 ' + s + '초 대기');
        await new Promise(function(r) { setTimeout(r, 1000); });
      }
    }
  }""", """  window._plannerAdaptiveGap = 0;
  /* ★ v19-159: 세 세트씩 함께 — 같은 학생은 겹치지 않게, 429 가 나면 한 줄 + 10초 간격 */
  var _pool = jobs.slice(), _busy = {}, _conc = 3;
  var _take = function(){ for (var q = 0; q < _pool.length; q++){ if (!_busy[_pool[q].stId]) return _pool.splice(q, 1)[0]; } return null; };
  var _worker = async function(wid){
    while (_pool.length){
      if (window.PL_STOP || wid >= _conc) return;
      var job = _take();
      if (!job){ await new Promise(function(r){ setTimeout(r, 300); }); continue; }
      _busy[job.stId] = 1;
      var result = await _analyzeWithRetry(job.stId, job.si, job.setId, 2);
      delete _busy[job.stId];
      if (!result.ok) failed++;
      if (result.rateLimited){ window._plannerAdaptiveGap = 10; _conc = 1; } // 한 번이라도 429면 한 줄로 · 10초 간격
      done++;
      if (statusEl) statusEl.innerHTML = renderProgress(done, total, failed);
      if (_pool.length && window._plannerAdaptiveGap > 0){
        for (var s = window._plannerAdaptiveGap; s > 0; s--){
          if (statusEl) statusEl.innerHTML = renderProgress(done, total, failed, '다음 분석까지 ' + s + '초 대기');
          await new Promise(function(r){ setTimeout(r, 1000); });
        }
      }
    }
  };
  var _ws = []; for (var _w = 0; _w < Math.min(3, jobs.length); _w++) _ws.push(_worker(_w));
  await Promise.all(_ws);""")
if int(ver.replace('v19-',''))>=160:
    # v19-160: 📚 진도 기준 + 🔔 알림 (원장 10/26 「모두 적용 배포」 · 부품 progalert160_teacher.js · 시안 https://claude.ai/artifact/Hzu1pWgMr91xSTqTdW1tth)
    #   ① bp_config 에 hiSem(고등 학기 중 숙제 진도로) 읽기·저장
    rep("rep:v.rep||{}, done:v.done||{}, starts:v.starts||{} }; }", "rep:v.rep||{}, done:v.done||{}, starts:v.starts||{}, hiSem:v.hiSem!==false }; }   /* ★ v19-160 */")
    rep("starts:BP.cfg.starts||{}, updated:new Date().toISOString() }); plToast('💾 진도 기준 저장'); }", "starts:BP.cfg.starts||{}, hiSem:BP.cfg.hiSem!==false, updated:new Date().toISOString() }); plToast('💾 진도 기준 저장'); }")
    #   ② ✎ 기준 입력 — 중등 교재는 비우면 2.5개월(목표 2개월). 직접 적은 적이 없으면 빈칸으로 연다(그냥 확인을 눌러 고정되지 않게)
    rep("var v=prompt('이 교재의 기준 기간(개월)을 입력하세요.\\n(비우면 기본 '+(BP.cfg.def||3)+'개월)',cur);",
        "var v=prompt('이 교재의 기준 기간(개월)을 입력하세요.\\n'+(bpLvlOf(bid)==='mid'?'(비우면 중등 교재 기본 — 목표 2개월 · 한계 2.5개월)':'(비우면 기본 '+(BP.cfg.def||3)+'개월)'),(Number(BP.cfg.months[bid])>0?cur:''));   /* ★ v19-160 */")
    rep("  if(x.status==='r'&&x.lastAgo>=14) return (x.pct!=null?x.pct+'%':'')+'·끊김';\n",
        "  if(x.status==='r'&&x.lastAgo>=14) return (x.pct!=null?x.pct+'%':'')+'·끊김';\n  if(x.tag) return (x.pct!=null?x.pct+'%':'')+'·'+x.tag;   /* ★ v19-160: 중등 급함·주의 */\n")
    rep("기준 '+bpMonthsOf(e.bid)+'개월 ✎</button>';", "'+(bpMidStd(e.bid)?'목표 2 · 한계 2.5개월':'기준 '+bpMonthsOf(e.bid)+'개월')+' ✎</button>';")
    #   ③ 진도 현황 화면 — 기준 막대 · 고등부 학기 중은 따로(숙제 진도) · 개수 칩
    rep("  var rows=all.main.filter(function(x){ return BP.filter==='all'||x.st.group===BP.filter; });\n  var c={r:0,y:0,g:0};",
        "  var hsRows=all.main.concat(all.rest).filter(function(x){ return x.hs&&(BP.filter==='all'||x.st.group===BP.filter); });   /* ★ v19-160: 고등 학기 중 */\n  var rows=all.main.filter(function(x){ return !x.hs&&(BP.filter==='all'||x.st.group===BP.filter); });\n  all.rest=all.rest.filter(function(x){ return !x.hs; });\n  var c={r:0,y:0,g:0};")
    rep("  if(BP.pagesOpen) h+=bpPagesPanel();\n", "  h+=bpStdBar();   /* ★ v19-160 */\n  if(BP.pagesOpen) h+=bpPagesPanel();\n")
    rep("color:#dc2626\">🔴 늦음 '+c.r+'</span>';", "color:#dc2626\">🔴 급함·늦음 '+c.r+'</span>';")
    rep("color:#15803d\">🟢 정상 '+c.g+'</span>';\n",
        "color:#15803d\">🟢 정상 '+c.g+'</span>';\n  if(hsRows.length) h+='<span style=\"font-size:11.5px;font-weight:900;border-radius:50px;padding:5px 12px;background:#f5f3ff;color:#6d28d9\">🎓 고등 숙제 미흡 '+hsRows.filter(function(x){ return x.hwStat&&x.hwStat.s>=1; }).length+'/'+hsRows.length+'</span>';   /* ★ v19-160 */\n")
    rep("  var sel=rows.find(function(x){ return (x.stKey||String(x.st.id||x.st.name))===BP.sel; })", "  var sel=rows.concat(hsRows).find(function(x){ return (x.stKey||String(x.st.id||x.st.name))===BP.sel; })")
    rep("  if(all.rest.length){\n    h+='<div style=\"font-size:10px;color:#94a3b8;font-weight:700;padding:6px 4px\">▪ 기록 없음/미연결</div>';",
        "  h+=bpHsList(hsRows,selKey);   /* ★ v19-160 */\n  if(all.rest.length){\n    h+='<div style=\"font-size:10px;color:#94a3b8;font-weight:700;padding:6px 4px\">▪ 기록 없음/미연결</div>';")
    #   ④ 🚨 위험 신호에 «고등 숙제 진도»
    rep("  return out;\n}\nvar RISK_NAMES={ plz:'플래너 0점',", "  try{ if(typeof bpHwSig==='function'){ var hwp=bpHwSig(st); if(hwp) out.push(hwp); } }catch(e){}   /* ★ v19-160 */\n  return out;\n}\nvar RISK_NAMES={ hwp:'고등 숙제 진도', plz:'플래너 0점',")
    rep(" · 진도: 진도 현황의 🔴🟡 그대로", " · 진도: 진도 현황의 🔴🟡 그대로(중등 교재 목표 2개월·한계 2.5개월) · 고등 숙제 진도: 학기 중 고등학생, 최근 2주 수업일 숙제체크에서 풀이 100%가 아니거나 안 찍은 날이 2번 이상")
    #   ⑤ 🏠 홈 «🔔 이번 주 경고» 카드(운영 할 일 위) · 위쪽 줄 🔔 단추 · 시작 다운로드에서 alert_state 빼기
    rep("  if(typeof opsHomeCard==='function') h+=opsHomeCard();", "  if(typeof alHomeCard==='function') h+=alHomeCard();   /* ★ v19-160: 🔔 이번 주 경고 */\n  if(typeof opsHomeCard==='function') h+=opsHomeCard();")
    rep("'raid_boss_lib', 'ops_plan', 'ops_checks'];", "'raid_boss_lib', 'ops_plan', 'ops_checks', 'alert_state'];")
    rep("""      <button class="ftb" id="grp-ops" onclick="selGroup('ops')"><span>🏫</span><span>운영</span></button>""",
        """      <button class="ftb" id="grp-ops" onclick="selGroup('ops')"><span>🏫</span><span>운영</span></button>
      <button class="ftb" id="al-bell" onclick="alBell()" title="원장님 알림 — 진도 급함·숙제·채점 끊김·플래너·주간테스트" style="flex:0 0 84px;position:relative"><span>🔔</span><span>알림</span><em id="al-bell-n" style="display:none;position:absolute;top:8px;right:12px;font-style:normal;background:#ef4444;color:#fff;border-radius:10px;padding:0 6px;font-size:12px;font-weight:900;line-height:19px"></em></button>""")
if int(ver.replace('v19-',''))>=161:
    # v19-161: 📋 상담 리포트 (원장 10/26 「학원앱에 상담 리포트 v19-161 로」 · 부품 consult161_teacher.js · 설계 docs/consult_report_design.md)
    #   ① 진도·리포트 탭 안 «📋 상담 리포트» ② 그리기 가지 ③ 제목 ④ 시작 다운로드에서 consult_<코드> 빼기
    rep("    {v:'risk', icon:'🚨', label:'위험 신호', act:function(){ VIEW='risk'; }},\n",
        "    {v:'risk', icon:'🚨', label:'위험 신호', act:function(){ VIEW='risk'; }},\n    {v:'consult', icon:'📋', label:'상담 리포트', act:function(){ VIEW='consult'; }},   /* ★ v19-161 */\n")
    b="    else if(VIEW==='risk'){ try{ C.innerHTML=rRisk(); }"
    assert s.count(b)==2
    s=s.replace(b, "    else if(VIEW==='consult'){ try{ C.innerHTML=rConsult(); }catch(e){ console.error(e); C.innerHTML='<div style=\"padding:20px;color:#b91c1c;font-weight:800\">상담 리포트 오류: '+esc2(e.message)+'</div>'; } }\n"+b)
    rep("opscal:'📅 운영 달력',", "opscal:'📅 운영 달력',consult:'📋 상담 리포트',")
    rep("var PULL_SKIP_PREFIX = ['mf_bookans_', ", "var PULL_SKIP_PREFIX = ['consult_', 'mf_bookans_', ")
if int(ver.replace('v19-',''))>=162:
    # v19-162: 📞 학부모 상담 = 학부모 상담 준비(통화 대본) + 상담 리포트 한 화면 (원장 10/26 · 부품 counsel162_teacher.js · 시안 docs/mockup_counsel_merge.html)
    #   ① 진도·리포트 탭의 «상담 리포트» 빼기(들어가는 곳 = 왼쪽 «📞 학부모 상담 준비» 하나)
    rep("    {v:'consult', icon:'📋', label:'상담 리포트', act:function(){ VIEW='consult'; }},   /* ★ v19-161 */\n", "")
    #   ② 옛 통화 대본 화면을 «📞 통화 대본» 탭 안에 넣을 수 있게 — CNS.embed 이면 머리줄·브리핑·통화 후 기록 칸을 건너뛴다
    rep("  // 헤더\n  h+='<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:13px;flex-wrap:wrap\">';",
        "  // 헤더\n  if(!CNS.embed){   /* ★ v19-162 */\n  h+='<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:13px;flex-wrap:wrap\">';")
    rep("  h+='</div>';\n\n  var g=cnsGather(st);", "  h+='</div>';\n  }   /* ★ v19-162 */\n\n  var g=cnsGather(st);")
    rep("  h+='<div id=\"cns-print\">';\n", "  h+='<div id=\"cns-print\">';\n  if(!CNS.embed){   /* ★ v19-162 */\n")
    rep("  h+='</div>';\n\n  h+='<div style=\"display:grid;grid-template-columns:'+(big?", "  h+='</div>';\n  }   /* ★ v19-162 */\n\n  h+='<div style=\"display:grid;grid-template-columns:'+(big?")
    rep("  // 통화 후 기록\n", "  if(!CNS.embed){   /* ★ v19-162 */\n  // 통화 후 기록\n")
    rep("    });\n  }\n  h+='</div>';\n  h+='</div>';\n  // 오른쪽 — 근거 + 예상 질문", "    });\n  }\n  h+='</div>';\n  }   /* ★ v19-162 */\n  h+='</div>';\n  // 오른쪽 — 근거 + 예상 질문")
if int(ver.replace('v19-',''))>=163:
    # v19-163: 📛 플래너 거짓 제출 확인 (원장 10/26 · 부품 plfake163_teacher.js · 시안 docs/mockup_planner_fake.html)
    rep("    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n",
        "    {id:'race',      icon:'🎮', label:'레이스',   red:false},\n    {id:'fake',      icon:'📛', label:'거짓 제출'+(typeof pfCount==='function'&&pfCount()?' ('+pfCount()+')':''), red:false},   /* ★ v19-163 */\n")
    rep("           : PLANNER_VIEW==='race'       ? rPlannerRace()\n", "           : PLANNER_VIEW==='race'       ? rPlannerRace()\n           : PLANNER_VIEW==='fake'       ? rPlannerFake()   /* ★ v19-163 */\n")
    #   🚨 위험 신호 줄을 누르면 그 학생으로 (플래너 0점·거짓 제출은 거짓 제출 카드가 열린 채로)
    rep("h+='<div onclick=\"riskGo(\\''+x.go+'\\')\"", "h+='<div onclick=\"riskGo(\\''+x.go+'\\',\\''+s.id+'\\')\"")
rep("var APP_VER = 'v19-42';","var APP_VER = '"+ver+"';")
anchor="      {ver:'v19-42',date:'2026-09-24',stability:'ok',memo:'📘"; i=s.index(anchor)
memos=''
for f in sorted(os.listdir(MEMO)):
    if re.match(r'memo_19(4[3-9]|[5-9]\d|[1-9]\d\d)\.txt$', f): pass   # v19-100 부터 세 자리 (memo_19100)
for n in range(max(99,int(ver.replace('v19-',''))),42,-1):   # 숫자 순서(새 버전이 위)
    f=MEMO+'/memo_19%d.txt'%n
    if os.path.exists(f) and n<=int(ver.replace('v19-','')): memos+=open(f).read()
s=s[:i]+memos+s[i:]; open(out,'w').write(s); print(out,'조립 · 메모', memos.count("{ver:'"))
