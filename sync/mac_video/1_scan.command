#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 강의영상 목록 만들기 (맥미니 전용)
#
#  하는 일: 지정한 폴더 안의 모든 영상 파일을 찾아
#           "_강의영상_목록.csv" 파일로 정리해 줍니다.
#           (파일을 고치거나 옮기지 않습니다 — 읽기만 합니다)
#
#  사용법: 파인더에서 이 파일을 더블클릭 → 영상 폴더를 창에 끌어다 놓고 엔터
# ══════════════════════════════════════════════════════════════
set -u

echo ""
echo "════════════════════════════════════════════════"
echo "   루멘수학 · 강의영상 목록 만들기"
echo "════════════════════════════════════════════════"
echo ""
echo " 영상이 들어있는 폴더를 이 창에 '끌어다 놓고' 엔터를 누르세요."
echo " (하위 폴더까지 전부 찾습니다 / 취소하려면 아무것도 안 쓰고 엔터를 두 번)"
echo ""

# 드래그가 느려서 엔터가 먼저 눌리는 경우가 있어, 빈 입력이면 다시 물어봅니다
# (최대 3번 — 그래도 비어 있으면 정말 취소하신 것으로 봅니다)
TRY=0
while :; do
  printf " 폴더 → "
  read -r RAW

  # 파인더에서 끌어다 놓으면 따옴표나 역슬래시가 붙는데, 그걸 벗겨냅니다
  ROOT=$(printf '%s' "$RAW" \
    | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" \
          -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' \
          -e 's/\\\(.\)/\1/g')
  ROOT="${ROOT%/}"

  [ -n "$ROOT" ] && break
  TRY=$((TRY + 1))
  [ "$TRY" -ge 3 ] && break
  echo " (비어 있습니다. 폴더를 이 창 위에 놓은 뒤 엔터를 눌러주세요)"
done

if [ -z "$ROOT" ]; then
  echo ""
  echo " 취소했습니다."
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 0
fi

if [ ! -d "$ROOT" ]; then
  echo ""
  echo " ⚠️  폴더를 찾을 수 없습니다: $ROOT"
  echo "     (드래그 대신 경로를 직접 입력하셨다면 철자를 확인해 주세요)"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi


# ── 외장하드 대응: 이 경로가 어떤 디스크에 있는지 알아냅니다 ──
#    결과: "파일시스템종류|읽기전용(1/0)"  (예: "exfat|0", "ntfs|1")
vol_info() {
  dev=$(stat -f "%Sd" "$1" 2>/dev/null)
  if [ -z "${dev:-}" ]; then printf '%s' "|0"; return; fi
  line=$(mount 2>/dev/null | grep "^/dev/$dev on " | head -1)
  fs=$(printf '%s' "$line" | sed -n 's/.*(\([a-zA-Z0-9]*\).*/\1/p')
  case "$line" in *read-only*) ro=1 ;; *) ro=0 ;; esac
  printf '%s|%s' "$fs" "$ro"
}

VI=$(vol_info "$ROOT"); FSTYPE="${VI%%|*}"; VOLRO="${VI##*|}"

if [ -n "$FSTYPE" ] && [ "$FSTYPE" != "apfs" ] && [ "$FSTYPE" != "hfs" ]; then
  echo ""
  echo " 💽 이 폴더는 «$FSTYPE» 형식의 디스크에 있습니다. (외장하드로 보입니다)"
fi
if [ "$VOLRO" = "1" ]; then
  echo ""
  echo " ⚠️  이 디스크는 «읽기 전용» 입니다. 목록은 만들 수 있지만"
  echo "     이름 변경은 되지 않습니다."
  echo "     윈도우용(NTFS) 외장하드는 맥에서 기본으로 쓰기가 막혀 있습니다."
  echo "     → 맥에서도 쓰려면 디스크를 exFAT 로 다시 포맷하거나,"
  echo "       파일을 맥으로 옮긴 뒤 이름을 바꾸셔야 합니다."
fi

# 목록 파일을 그 폴더에 못 쓰면 바탕화면에 대신 저장합니다
OUT="$ROOT/_강의영상_목록.csv"
if ! touch "$ROOT/.lumen_write_test" 2>/dev/null; then
  OUT="$HOME/Desktop/_강의영상_목록.csv"
  echo ""
  echo " ℹ️  그 폴더에 파일을 쓸 수 없어, 목록을 «바탕화면» 에 저장합니다."
else
  rm -f "$ROOT/.lumen_write_test"
fi


# ══════════════════════════════════════════════════════════════
#  이미 정리된 파일명에서 정보를 «되읽어» 옵니다.
#
#  덕분에 ① 단원명만 고쳐서 다시 이름 짓기 ② 편집본(수정일이 편집시각인
#  파일)도 이름에 적힌 날짜를 그대로 쓰기 가 가능해집니다.
#
#  알아보는 형태
#    공수2 부분집합 p127 260727 IMG_9560     (형식1 + 원본번호)
#    260727 공수2 부분집합 p127              (형식2)
#    2026-07-27_공수2_02강_부분집합_p127      (형식3)
#    IMG_9560                                (아직 안 바꾼 원본)
#  결과: "반|단원|페이지|날짜(YYMMDD)|원본번호"
# ══════════════════════════════════════════════════════════════
parse_name() {
  pn_nm="$1"; pn_cls=""; pn_unit=""; pn_pg=""; pn_ymd=""; pn_img=""

  # ① 원본번호 IMG_9560
  pn_img=$(printf '%s' "$pn_nm" | grep -oE '[Ii][Mm][Gg]_[0-9]+' | head -1)
  pn_rest="$pn_nm"
  if [ -n "$pn_img" ]; then
    pn_rest=$(printf '%s' "$pn_rest" | sed "s/[ _]*$pn_img//")
  fi

  # ② 캡컷이 붙이는 꼬리(-1, -2)를 떼어냅니다.
  #    이게 붙어 있으면 "260727-1" 이 되어 날짜를 못 알아봅니다.
  pn_rest=$(printf '%s' "$pn_rest" | sed 's/-[0-9]\{1,2\}[ ]*$//')

  # ③ 날짜 — 끝의 6자리 / 앞의 6자리 / 2026-07-27 형태
  pn_ymd=$(printf '%s' "$pn_rest" | sed -n 's/.*[^0-9]\([0-9]\{6\}\)[ _]*$/\1/p')
  [ -z "$pn_ymd" ] && pn_ymd=$(printf '%s' "$pn_rest" | sed -n 's/^\([0-9]\{6\}\)$/\1/p')
  [ -z "$pn_ymd" ] && pn_ymd=$(printf '%s' "$pn_rest" | sed -n 's/^\([0-9]\{6\}\)[ _].*/\1/p')
  if [ -z "$pn_ymd" ]; then
    pn_ymd=$(printf '%s' "$pn_rest" | sed -n 's/^[0-9][0-9]\([0-9][0-9]\)-\([0-9][0-9]\)-\([0-9][0-9]\).*/\1\2\3/p')
    [ -n "$pn_ymd" ] && pn_rest=$(printf '%s' "$pn_rest" | sed 's/^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}[ _]*//')
  else
    pn_rest=$(printf '%s' "$pn_rest" | sed -e "s/[ _]*$pn_ymd[ _]*$//" -e "s/^$pn_ymd[ _]*//")
  fi

  # 6자리가 날짜답지 않으면(월이 01~12가 아니면) 버립니다
  if [ -n "$pn_ymd" ]; then
    pn_mm=$(printf '%s' "$pn_ymd" | cut -c3-4)
    case "$pn_mm" in
      0[1-9]|1[0-2]) : ;;
      *) pn_ymd="" ;;
    esac
  fi

  # ④ 페이지 p127
  pn_pg=$(printf '%s' "$pn_rest" | grep -oE '(^|[ _])[Pp][0-9]+([ _]|$)' | head -1 | tr -d ' _')
  if [ -n "$pn_pg" ]; then
    pn_rest=$(printf '%s' "$pn_rest" | sed "s/[ _]*$pn_pg\([ _]\|$\)/ /")
  fi

  # ⑤ 회차 표시(02강) 는 다시 계산되므로 떼어냅니다
  pn_rest=$(printf '%s' "$pn_rest" | sed 's/[ _][0-9][0-9]강//')

  # ⑥ 남은 것 = 「반 단원」
  pn_rest=$(printf '%s' "$pn_rest" | sed -e 's/[ _][ _]*/ /g' -e 's/^ *//' -e 's/ *$//')
  if [ -n "$pn_rest" ]; then
    pn_cls="${pn_rest%% *}"
    pn_unit="${pn_rest#* }"
    [ "$pn_unit" = "$pn_cls" ] && pn_unit=""
  fi
  printf '%s|%s|%s|%s|%s' "$pn_cls" "$pn_unit" "$pn_pg" "$pn_ymd" "$pn_img"
}

# CSV 한 칸을 안전하게 감싸기 (쉼표·따옴표가 들어있어도 깨지지 않게)
csvq() { printf '"%s"' "$(printf '%s' "${1:-}" | sed 's/"/""/g')"; }

echo ""
echo " 🔎 찾는 중... (영상이 많으면 잠시 걸립니다)"

# 엑셀/넘버스에서 한글이 깨지지 않도록 BOM을 먼저 씁니다
printf '\xEF\xBB\xBF' > "$OUT"
{
  csvq "현재파일명";           printf ','
  csvq "새파일명(자동)";        printf ','
  csvq "반";                   printf ','
  csvq "단원";                 printf ','
  csvq "페이지";               printf ','
  csvq "날짜";                 printf ','
  csvq "원본번호";             printf ','
  csvq "폴더";                 printf ','
  csvq "크기MB";               printf ','
  csvq "녹화일시";             printf ','
  csvq "맥에추가된날";         printf ','
  csvq "영상메타촬영일";       printf ','
  csvq "길이";                 printf ','
  csvq "전체경로(수정금지)";   printf '\r\n'
} >> "$OUT"

COUNT=0
TOTBYTES=0
NDUR=0
NPARSED=0
while IFS= read -r -d '' f; do
  name=$(basename "$f")
  dir=$(dirname "$f")

  # 스캔 시작 폴더 기준의 상대 경로 (보기 좋게)
  rel="${dir#$ROOT}"
  rel="${rel#/}"
  [ -z "$rel" ] && rel="(최상위)"

  bytes=$(stat -f %z "$f" 2>/dev/null || echo 0)
  # 숫자가 아니면 버립니다 (맥이 아닌 곳에서 실행돼도 표가 깨지지 않도록)
  case "$bytes" in
    ''|*[!0-9]*) bytes=0 ;;
  esac
  sizemb=$(printf '%s' "$bytes" | awk '{ printf "%.1f", $1/1048576 }')

  # ★ 녹화일시 = 파일 수정일.
  #   아이폰에서 에어드랍으로 받으면 촬영 시각이 여기 그대로 보존됩니다.
  #   (파인더 목록의 '수정일' 칸과 같은 값 / 우리 시간대 기준)
  wdate=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || echo "")
  case "$wdate" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9][0-9]:[0-9][0-9]) : ;;
    *) wdate="" ;;
  esac

  # 맥에 파일이 생긴 시각 (에어드랍으로 받은 시각 — 촬영 시각이 아닙니다)
  cdate=$(stat -f "%SB" -t "%Y-%m-%d %H:%M" "$f" 2>/dev/null || echo "")
  case "$cdate" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9][0-9]:[0-9][0-9]) : ;;
    *) cdate="" ;;
  esac

  # 영상 안에 기록된 촬영 시각 (참고용 대조 칸).
  # 맥은 이 값을 세계표준시로 주기 때문에 우리 시간대로 바꿔서 적습니다.
  mraw=$(mdls -raw -name kMDItemContentCreationDate "$f" 2>/dev/null || echo "")
  mdate=""
  case "$mraw" in
    ''|'(null)') mdate="" ;;
    *) mdate=$(date -j -f "%Y-%m-%d %H:%M:%S %z" "$mraw" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "") ;;
  esac
  case "$mdate" in
    ''|[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]\ [0-9][0-9]:[0-9][0-9]) : ;;
    *) mdate="" ;;
  esac

  # 재생 길이 (초 → 분:초)
  dsec=$(mdls -raw -name kMDItemDurationSeconds "$f" 2>/dev/null || echo "")
  dur=$(printf '%s' "$dsec" | awk '{ s=int($1+0.5); if(s<=0){ print "" } else { printf "%d:%02d", int(s/60), s%60 } }')
  [ -n "$dur" ] && NDUR=$((NDUR + 1))

  # 이미 정리된 이름이면 반·단원·페이지·날짜·원본번호를 되읽어 옵니다
  base="${name%.*}"
  PN=$(parse_name "$base")
  p_cls=$(printf  '%s' "$PN" | cut -d'|' -f1)
  p_unit=$(printf '%s' "$PN" | cut -d'|' -f2)
  p_pg=$(printf   '%s' "$PN" | cut -d'|' -f3)
  p_ymd=$(printf  '%s' "$PN" | cut -d'|' -f4)
  p_img=$(printf  '%s' "$PN" | cut -d'|' -f5)
  [ -n "$p_unit" ] && NPARSED=$((NPARSED + 1))

  # 이름에 날짜가 없으면 녹화일시(수정일)에서 가져옵니다
  if [ -z "$p_ymd" ] && [ -n "$wdate" ]; then
    p_ymd=$(printf '%s' "$wdate" | sed -n 's/^[0-9][0-9]\([0-9][0-9]\)-\([0-9][0-9]\)-\([0-9][0-9]\).*/\1\2\3/p')
  fi

  {
    csvq "$name";   printf ','
    csvq "";        printf ','   # 새파일명 — 3_autoname 이 채웁니다
    csvq "$p_cls";  printf ','   # 반     — 시간표로 자동, 없으면 직접 입력
    csvq "$p_unit"; printf ','   # 단원   — 직접 입력
    csvq "$p_pg";   printf ','   # 페이지 — 직접 입력
    csvq "$p_ymd";  printf ','   # 날짜   — YYMMDD
    csvq "$p_img";  printf ','   # 원본번호
    csvq "$rel";    printf ','
    csvq "$sizemb"; printf ','
    csvq "$wdate";  printf ','
    csvq "$cdate";  printf ','
    csvq "$mdate";  printf ','
    csvq "$dur";    printf ','
    csvq "$f";      printf '\r\n'
  } >> "$OUT"

  TOTBYTES=$((TOTBYTES + bytes))
  COUNT=$((COUNT + 1))
done < <(find "$ROOT" -type f \( \
      -iname '*.mp4'  -o -iname '*.mov'  -o -iname '*.m4v'  -o -iname '*.avi' \
   -o -iname '*.mkv'  -o -iname '*.wmv'  -o -iname '*.flv'  -o -iname '*.webm' \
   -o -iname '*.mpg'  -o -iname '*.mpeg' -o -iname '*.ts'   -o -iname '*.mts'  \
   -o -iname '*.m2ts' \) ! -name '._*' -print0 | sort -z)

echo ""
if [ "$COUNT" -eq 0 ]; then
  echo " 영상 파일을 찾지 못했습니다. 폴더를 다시 확인해 주세요."
  rm -f "$OUT"
else
  TOTGB=$(printf '%s' "$TOTBYTES" | awk '{ printf "%.1f", $1/1073741824 }')
  echo " ✅ 영상 $COUNT 개 · 합계 ${TOTGB} GB 를 찾았습니다."
  echo ""
  if [ "$NDUR" -eq 0 ]; then
    echo " ℹ️  재생 길이를 읽지 못했습니다. (이 디스크는 스포트라이트 색인이 꺼진 듯합니다)"
    echo "    이름을 짓는 데 꼭 필요한 «녹화일시» 는 정상이니 그대로 진행하셔도 됩니다."
    echo ""
  fi
  if [ "$NPARSED" -gt 0 ]; then
    echo " 🔁 이미 정리된 이름 $NPARSED 개에서 반·단원·페이지·날짜를 되읽었습니다."
    echo "    → 단원명만 고쳐서 다시 이름을 지을 수 있습니다."
    echo ""
  fi
  echo " 목록 파일: $OUT"
  echo ""
  echo " 다음 순서 (둘 중 하나):"
  echo ""
  echo "   1) '3_autoname.command' — 날짜·시간표로 반과 순번을 자동으로 채웁니다"
  echo "   2) CSV를 열어 「단원」「페이지」 칸을 적습니다 (반이 비었으면 반도)"
  echo "   3) '3_autoname.command' 다시 실행 → [다시 만들기 y] 로 이름 완성"
  echo "   4) '2_rename.command' — 실제로 이름을 바꿉니다"
  echo ""
  echo "          · 새파일명을 비워두면 그 영상은 이름을 바꾸지 않습니다"
  echo "          · 확장자(.MOV 등)는 안 적어도 알아서 붙습니다"
  echo ""
  open -R "$OUT" 2>/dev/null || true
fi
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
