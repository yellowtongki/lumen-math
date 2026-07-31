#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 강의영상 이름 바꾸기 (맥미니 전용)
#
#  하는 일: '1_scan.command' 가 만든 CSV의 「새파일명」 칸을 읽어
#           실제 파일 이름을 바꿉니다.
#
#  안전장치
#    · 바꾸기 전에 전체 목록을 먼저 보여주고, 확인해야만 실행합니다
#    · 파일을 지우거나 옮기지 않습니다 (이름만 바꿉니다)
#    · 같은 이름이 이미 있으면 건너뜁니다
#    · 되돌리기 기록을 남겨서, 언제든 원래 이름으로 복구할 수 있습니다
# ══════════════════════════════════════════════════════════════
set -u

# 파인더에서 끌어다 놓은 경로에서 따옴표·역슬래시를 벗겨냅니다
unescape_path() {
  printf '%s' "$1" \
    | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" \
          -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' \
          -e 's/\\\(.\)/\1/g'
}


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

echo ""
echo "════════════════════════════════════════════════"
echo "   루멘수학 · 강의영상 이름 바꾸기"
echo "════════════════════════════════════════════════"
echo ""
echo "   1) 이름 바꾸기  (CSV에 적은 대로)"
echo "   2) 되돌리기      (직전 작업 취소)"
echo ""
printf " 번호를 고르세요 [1] → "
read -r MENU
[ -z "${MENU:-}" ] && MENU=1


# ══════════════════════════════════════════════════════════════
#  2) 되돌리기
# ══════════════════════════════════════════════════════════════
if [ "$MENU" = "2" ]; then
  echo ""
  echo " 되돌리기 기록 파일(_이름변경기록_....tsv)을 창에 끌어다 놓고 엔터."
  echo ""
  printf " 기록파일 → "
  read -r RAWLOG
  LOG=$(unescape_path "$RAWLOG")

  if [ ! -f "$LOG" ]; then
    echo ""
    echo " ⚠️  기록 파일을 찾을 수 없습니다."
    echo ""
    read -r -p " 엔터를 누르면 창이 닫힙니다. " _
    exit 1
  fi

  N=0; FAIL=0
  # 나중에 바꾼 것부터 거꾸로 되돌립니다
  while IFS=$'\t' read -r nowpath oldpath; do
    [ -z "${nowpath:-}" ] && continue
    [ -z "${oldpath:-}" ] && continue
    if [ ! -e "$nowpath" ]; then
      echo "  · 건너뜀(파일 없음): $(basename "$nowpath")"
      FAIL=$((FAIL + 1)); continue
    fi
    if [ -e "$oldpath" ]; then
      echo "  · 건너뜀(원래 이름이 이미 존재): $(basename "$oldpath")"
      FAIL=$((FAIL + 1)); continue
    fi
    if mv -n "$nowpath" "$oldpath" 2>/dev/null; then
      echo "  ↩︎ $(basename "$nowpath")  →  $(basename "$oldpath")"
      N=$((N + 1))
    else
      echo "  · 실패: $(basename "$nowpath")"
      FAIL=$((FAIL + 1))
    fi
  done < <(tail -r "$LOG" 2>/dev/null || tac "$LOG")

  echo ""
  echo " ✅ $N 개를 원래 이름으로 되돌렸습니다. (건너뜀 $FAIL 개)"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 0
fi


# ══════════════════════════════════════════════════════════════
#  1) 이름 바꾸기
# ══════════════════════════════════════════════════════════════
echo ""
echo " 이름을 적어 넣은 CSV 파일(_강의영상_목록.csv)을 창에 끌어다 놓고 엔터."
echo ""
printf " CSV → "
read -r RAWCSV
CSV=$(unescape_path "$RAWCSV")

if [ ! -f "$CSV" ]; then
  echo ""
  echo " ⚠️  CSV 파일을 찾을 수 없습니다: $CSV"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

# CSV를 안전하게 읽어 '현재이름 / 새이름 / 전체경로' 세 칸으로 뽑아냅니다.
# (쉼표가 들어간 파일명, 따옴표, 윈도우 줄바꿈, 엑셀 BOM 모두 처리)
PARSED=$(awk '
function parse_csv(line, arr,    i, n, ch, nx, field, inq) {
  n = 0; field = ""; inq = 0
  for (i = 1; i <= length(line); i++) {
    ch = substr(line, i, 1)
    if (inq) {
      if (ch == "\"") {
        nx = substr(line, i + 1, 1)
        if (nx == "\"") { field = field "\""; i++ } else { inq = 0 }
      } else field = field ch
    } else {
      if (ch == "\"") inq = 1
      else if (ch == ",") { arr[++n] = field; field = "" }
      else field = field ch
    }
  }
  arr[++n] = field
  return n
}
{
  line = $0
  sub(/\r+$/, "", line)   # 윈도우/엑셀에서 저장한 줄바꿈 찌꺼기 제거
  if (NR == 1) sub(/^\xef\xbb\xbf/, "", line)
  n = parse_csv(line, a)

  if (NR == 1) {
    ci = 0; ni = 0; pi = 0
    for (i = 1; i <= n; i++) {
      if (index(a[i], "현재파일명") > 0) ci = i
      if (index(a[i], "새파일명")   > 0) ni = i
      if (index(a[i], "전체경로")   > 0) pi = i
    }
    if (ci == 0) ci = 1
    if (ni == 0) ni = 2
    if (pi == 0) pi = 14
    next
  }

  cur = (ci <= n ? a[ci] : "")
  new = (ni <= n ? a[ni] : "")
  pth = (pi <= n ? a[pi] : "")
  if (pth == "") next
  gsub(/^[ \t]+|[ \t]+$/, "", new)
  # 빈 칸이 있어도 절대 밀리지 않도록 한 칸씩 줄을 나눠 내보냅니다
  print cur
  print new
  print pth
}
' "$CSV")

if [ -z "$PARSED" ]; then
  echo ""
  echo " ⚠️  CSV에서 읽을 내용이 없습니다. 1_scan.command 로 만든 파일이 맞는지 확인해 주세요."
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

SRC_LIST=(); DST_LIST=()
SKIP_BLANK=0; SKIP_SAME=0; SKIP_MISSING=0; SKIP_EXISTS=0; SKIP_RO=0

# ── 파일들이 놓인 디스크 확인 (외장하드 대응) ──
FIRSTDIR=""
while IFS= read -r _c && IFS= read -r _n && IFS= read -r _p; do
  if [ -n "${_p:-}" ] && [ -e "$_p" ]; then FIRSTDIR=$(dirname "$_p"); break; fi
done <<< "$PARSED"

BADCHARS='/:'
if [ -n "$FIRSTDIR" ]; then
  VI=$(vol_info "$FIRSTDIR"); FSTYPE="${VI%%|*}"; VOLRO="${VI##*|}"
  if [ -n "$FSTYPE" ] && [ "$FSTYPE" != "apfs" ] && [ "$FSTYPE" != "hfs" ]; then
    echo ""
    echo " 💽 파일이 «$FSTYPE» 형식의 디스크에 있습니다. (외장하드로 보입니다)"
  fi
  case "$FSTYPE" in
    exfat|msdos|ntfs)
      # 윈도우 계열 디스크는 쓸 수 없는 글자가 더 많습니다
      BADCHARS='/:\*?"<>|'
      echo "    → 이 형식에서 쓸 수 없는 글자( \\ * ? \" < > | )도 - 로 바꿉니다."
      ;;
  esac
  if [ "$VOLRO" = "1" ]; then
    echo ""
    echo " ⚠️  이 디스크는 «읽기 전용» 이라 이름을 바꿀 수 없습니다."
    echo "     윈도우용(NTFS) 외장하드는 맥에서 기본으로 쓰기가 막혀 있습니다."
    echo "     → exFAT 로 다시 포맷하거나, 파일을 맥으로 옮긴 뒤 진행하세요."
    echo ""
    read -r -p " 엔터를 누르면 창이 닫힙니다. " _
    exit 1
  fi
fi

echo ""
echo " ── 바꿀 목록 미리보기 ─────────────────────────"
echo ""

while IFS= read -r cur && IFS= read -r new && IFS= read -r pth; do
  [ -z "${pth:-}" ] && continue

  # 새 이름이 비어 있으면 그대로 둡니다
  if [ -z "${new:-}" ]; then
    SKIP_BLANK=$((SKIP_BLANK + 1)); continue
  fi

  if [ ! -e "$pth" ]; then
    echo "  ⚠️  파일 없음: $cur"
    SKIP_MISSING=$((SKIP_MISSING + 1)); continue
  fi

  # 그 디스크에서 파일명에 쓸 수 없는 글자를 - 로 바꿉니다
  new=$(printf '%s' "$new" | tr "$BADCHARS" '-')

  # 확장자를 안 적었으면 원래 확장자를 붙여 줍니다
  oldname=$(basename "$pth")
  case "$oldname" in
    *.*) ext=".${oldname##*.}" ;;
    *)   ext="" ;;
  esac
  case "$new" in
    *.*) : ;;
    *)   new="$new$ext" ;;
  esac

  if [ "$new" = "$oldname" ]; then
    SKIP_SAME=$((SKIP_SAME + 1)); continue
  fi

  dir=$(dirname "$pth")
  dst="$dir/$new"

  # 그 폴더에 쓸 권한이 없으면 바꿀 수 없습니다 (읽기 전용 디스크 등)
  if [ ! -w "$dir" ]; then
    echo "  ⚠️  쓰기 권한 없음(읽기 전용): $oldname"
    SKIP_RO=$((SKIP_RO + 1)); continue
  fi

  if [ -e "$dst" ]; then
    echo "  ⚠️  같은 이름이 이미 있어 건너뜀: $new"
    SKIP_EXISTS=$((SKIP_EXISTS + 1)); continue
  fi

  echo "  · $oldname"
  echo "      →  $new"
  SRC_LIST+=("$pth")
  DST_LIST+=("$dst")
done <<< "$PARSED"

TOTAL=${#SRC_LIST[@]}

echo ""
echo " ───────────────────────────────────────────────"
echo " 바꿀 파일: $TOTAL 개"
echo " 그대로 두는 파일: 새이름 비어있음 $SKIP_BLANK / 이름 같음 $SKIP_SAME / 파일없음 $SKIP_MISSING / 중복 $SKIP_EXISTS / 읽기전용 $SKIP_RO"
echo ""

if [ "$TOTAL" -eq 0 ]; then
  echo " 바꿀 것이 없습니다. CSV의 「새파일명」 칸을 채우고 저장했는지 확인해 주세요."
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 0
fi

printf " 위 내용대로 진행할까요? 진행하려면 y 를 입력하고 엔터 → "
read -r YN
case "${YN:-}" in
  y|Y|yes|YES|ㅛ) : ;;
  *)
    echo ""
    echo " 취소했습니다. 파일은 하나도 바뀌지 않았습니다."
    echo ""
    read -r -p " 엔터를 누르면 창이 닫힙니다. " _
    exit 0
    ;;
esac

STAMP=$(date "+%Y%m%d-%H%M%S")
LOGDIR=$(dirname "$CSV")
LOG="$LOGDIR/_이름변경기록_$STAMP.tsv"
if ! : > "$LOG" 2>/dev/null; then
  # CSV가 있는 곳에 쓸 수 없으면 바탕화면에 기록을 남깁니다
  LOG="$HOME/Desktop/_이름변경기록_$STAMP.tsv"
  : > "$LOG"
  echo " ℹ️  되돌리기 기록을 «바탕화면» 에 저장합니다."
fi

OK=0; NG=0
i=0
while [ "$i" -lt "$TOTAL" ]; do
  s="${SRC_LIST[$i]}"
  d="${DST_LIST[$i]}"
  # -n : 혹시라도 같은 이름이 생겼으면 덮어쓰지 않고 실패시킵니다
  if mv -n "$s" "$d" 2>/dev/null; then
    printf '%s\t%s\n' "$d" "$s" >> "$LOG"
    OK=$((OK + 1))
  else
    echo "  · 실패: $(basename "$s")"
    NG=$((NG + 1))
  fi
  i=$((i + 1))
done

echo ""
echo " ✅ $OK 개의 이름을 바꿨습니다. (실패 $NG 개)"
echo ""
echo " 되돌리기 기록: $LOG"
echo " → 되돌리려면 이 창을 다시 열고 '2번(되돌리기)'을 고른 뒤"
echo "   위 기록 파일을 끌어다 놓으면 됩니다."
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
