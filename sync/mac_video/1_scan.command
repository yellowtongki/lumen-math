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
echo " (하위 폴더까지 전부 찾습니다 / 취소하려면 그냥 엔터)"
echo ""
printf " 폴더 → "
read -r RAW

# 파인더에서 끌어다 놓으면 따옴표나 역슬래시가 붙는데, 그걸 벗겨냅니다
ROOT=$(printf '%s' "$RAW" \
  | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" \
        -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' \
        -e 's/\\\(.\)/\1/g')
ROOT="${ROOT%/}"

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
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

OUT="$ROOT/_강의영상_목록.csv"

# CSV 한 칸을 안전하게 감싸기 (쉼표·따옴표가 들어있어도 깨지지 않게)
csvq() { printf '"%s"' "$(printf '%s' "${1:-}" | sed 's/"/""/g')"; }

echo ""
echo " 🔎 찾는 중... (영상이 많으면 잠시 걸립니다)"

# 엑셀/넘버스에서 한글이 깨지지 않도록 BOM을 먼저 씁니다
printf '\xEF\xBB\xBF' > "$OUT"
{
  csvq "현재파일명";           printf ','
  csvq "새파일명(여기에 입력)"; printf ','
  csvq "폴더";                 printf ','
  csvq "크기MB";               printf ','
  csvq "녹화일시";             printf ','
  csvq "맥에추가된날";         printf ','
  csvq "영상메타촬영일";       printf ','
  csvq "길이";                 printf ','
  csvq "전체경로(수정금지)";   printf '\r\n'
} >> "$OUT"

COUNT=0
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

  {
    csvq "$name";   printf ','
    csvq "";        printf ','
    csvq "$rel";    printf ','
    csvq "$sizemb"; printf ','
    csvq "$wdate";  printf ','
    csvq "$cdate";  printf ','
    csvq "$mdate";  printf ','
    csvq "$dur";    printf ','
    csvq "$f";      printf '\r\n'
  } >> "$OUT"

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
  echo " ✅ 영상 $COUNT 개를 찾았습니다."
  echo ""
  echo " 목록 파일: $OUT"
  echo ""
  echo " 다음 순서 (둘 중 하나):"
  echo ""
  echo "   [간편] '3_autoname.command' 를 실행하면 녹화일시로 이름을 자동으로 채워 줍니다"
  echo "          → 확인·수정 후 '2_rename.command'"
  echo ""
  echo "   [직접] 위 CSV를 넘버스(Numbers)나 엑셀로 열어"
  echo "          ' 새파일명(여기에 입력) ' 칸을 채우고 저장 → '2_rename.command'"
  echo "          · 비워두면 그 영상은 이름을 바꾸지 않습니다"
  echo "          · 확장자(.MOV 등)는 안 적어도 알아서 붙습니다"
  echo ""
  open -R "$OUT" 2>/dev/null || true
fi
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
