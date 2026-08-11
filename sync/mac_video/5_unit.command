#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 단원·페이지 입력하기 (맥미니 전용)
#
#  하는 일: 영상을 하나씩 보여주면서 「단원」「페이지」를 물어봅니다.
#           넘버스(Numbers)를 쓰지 않아도 되므로
#           "저장했는데 사라졌다" 같은 사고가 없습니다.
#
#  · 그냥 엔터를 치면 그 영상은 건너뜁니다
#  · q 를 입력하면 거기까지 저장하고 끝냅니다 (다음에 이어서 하면 됩니다)
#
#  ※ 파일 이름을 바꾸지 않습니다. CSV의 칸만 채웁니다.
# ══════════════════════════════════════════════════════════════
set -u

unescape_path() {
  printf '%s' "$1" \
    | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" \
          -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' \
          -e 's/\\\(.\)/\1/g'
}

echo ""
echo "════════════════════════════════════════════════"
echo "   루멘수학 · 단원·페이지 입력하기"
echo "════════════════════════════════════════════════"
echo ""
echo " '_강의영상_목록.csv' 를 창에 끌어다 놓고 엔터."
echo ""
TRY=0
while :; do
  printf " CSV → "
  read -r RAWCSV
  CSV=$(unescape_path "$RAWCSV")
  [ -n "$CSV" ] && break
  TRY=$((TRY + 1))
  [ "$TRY" -ge 3 ] && break
  echo " (비어 있습니다. 파일을 이 창 위에 놓은 뒤 엔터를 눌러주세요)"
done

if [ ! -f "$CSV" ]; then
  echo ""
  echo " ⚠️  CSV 파일을 찾을 수 없습니다: $CSV"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

echo ""
echo " 이미 단원이 적혀 있는 영상도 «다시» 물어볼까요?"
echo "   (오타를 고치실 때만 y — 보통은 그냥 엔터)"
echo ""
printf " 다시 물어보기 [n] → "
read -r RAWALL
case "${RAWALL:-}" in y|Y|yes|YES) ASKALL=1 ;; *) ASKALL=0 ;; esac

STAMP=$(date "+%Y%m%d-%H%M%S")
BACKUP="${CSV%.csv}_백업_$STAMP.csv"
cp "$CSV" "$BACKUP"

# ── CSV에서 필요한 칸만 뽑아냅니다 (한 칸씩 줄을 나눠 빈칸에도 안전) ──
DATA=$(awk -v askall="$ASKALL" '
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
  sub(/\r+$/, "", line)
  if (FNR == 1) sub(/^\xef\xbb\xbf/, "", line)
  n = parse_csv(line, a)

  if (FNR == 1) {
    for (i = 1; i <= n; i++) {
      if (index(a[i], "현재파일명") > 0) CUR  = i
      if (index(a[i], "녹화일시")   > 0) WHEN = i
      if (a[i] == "반")                  CLSC = i
      if (a[i] == "단원")                UNIT = i
      if (a[i] == "페이지")              PAGE = i
      if (a[i] == "길이")                DURC = i
    }
    if (UNIT == 0 || PAGE == 0) { print "NOCOL" > "/dev/stderr"; exit 3 }
    next
  }

  u = a[UNIT]
  if (askall != "1" && u != "") next      # 이미 적힌 것은 건너뜁니다

  print FNR
  print (CUR  > 0 ? a[CUR]  : "")
  print (CLSC > 0 ? a[CLSC] : "")
  print u
  print (PAGE > 0 ? a[PAGE] : "")
  print (WHEN > 0 ? a[WHEN] : "")
  print (DURC > 0 ? a[DURC] : "")
}
' "$CSV" 2>/dev/null)

if [ -z "$DATA" ]; then
  echo ""
  echo " 물어볼 영상이 없습니다."
  echo " (단원이 이미 전부 채워져 있거나, CSV 형식이 다릅니다)"
  rm -f "$BACKUP"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 0
fi

TOTAL=$(printf '%s\n' "$DATA" | awk 'END{ print int(NR/7) }')
UPD="${CSV%.csv}_입력_$STAMP.tmp"
: > "$UPD"

echo ""
echo " ── 총 $TOTAL 개를 물어봅니다 ─────────────────────"
echo "    · 건너뛰려면 그냥 엔터"
echo "    · 그만하려면 q  (여기까지 저장됩니다)"
echo ""

N=0
QUIT=0
while IFS= read -r idx && IFS= read -r cur && IFS= read -r cls \
   && IFS= read -r unit && IFS= read -r pg && IFS= read -r when && IFS= read -r dur; do
  [ "$QUIT" = "1" ] && break
  N=$((N + 1))

  echo ""
  echo " [$N/$TOTAL]  $cur"
  info=""
  [ -n "$cls" ]  && info="반 $cls"
  [ -n "$when" ] && info="${info:+$info   }녹화 $when"
  [ -n "$dur" ]  && info="${info:+$info   }길이 $dur"
  [ -n "$info" ] && echo "        $info"
  [ -n "$unit" ] && echo "        지금 적힌 단원: $unit ${pg:+/ $pg}"

  # 사용자 입력은 터미널에서 직접 읽습니다 (목록은 이미 표준입력을 쓰고 있음)
  printf "   단원 → "
  read -r NEWU < /dev/tty
  case "$NEWU" in q|Q) QUIT=1; break ;; esac

  printf "   페이지 → "
  read -r NEWP < /dev/tty
  case "$NEWP" in q|Q) QUIT=1; break ;; esac

  NEWU=$(printf '%s' "$NEWU" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  NEWP=$(printf '%s' "$NEWP" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

  # 둘 다 비었으면 건너뜁니다 (원래 값 유지)
  if [ -z "$NEWU" ] && [ -z "$NEWP" ]; then
    echo "        (건너뜀)"
    continue
  fi
  [ -z "$NEWU" ] && NEWU="$unit"
  [ -z "$NEWP" ] && NEWP="$pg"

  printf '%s\t%s\t%s\n' "$idx" "$NEWU" "$NEWP" >> "$UPD"
  echo "        ✓ $NEWU ${NEWP:+/ $NEWP}"
done <<< "$DATA"

NUPD=$(wc -l < "$UPD" | tr -d ' ')
if [ "${NUPD:-0}" -eq 0 ]; then
  echo ""
  echo " 입력한 내용이 없어 그대로 두었습니다."
  rm -f "$UPD" "$BACKUP"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 0
fi

# ── CSV에 되돌려 씁니다 ──
TMP="${CSV%.csv}_임시_$STAMP.csv"
awk '
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
function q(s) { gsub(/"/, "\"\"", s); return "\"" s "\"" }

# 첫 번째 파일: 입력 내용 (줄번호 \t 단원 \t 페이지)
NR == FNR {
  p1 = index($0, "\t"); if (p1 == 0) next
  i = substr($0, 1, p1 - 1)
  rest = substr($0, p1 + 1)
  p2 = index(rest, "\t")
  if (p2 == 0) { newu[i] = rest; newp[i] = "" }
  else { newu[i] = substr(rest, 1, p2 - 1); newp[i] = substr(rest, p2 + 1) }
  next
}

# 두 번째 파일: 원본 CSV
{
  line = $0
  sub(/\r+$/, "", line)
  if (FNR == 1) sub(/^\xef\xbb\xbf/, "", line)
  n = parse_csv(line, a)

  if (FNR == 1) {
    for (i = 1; i <= n; i++) {
      if (a[i] == "단원")   UNIT = i
      if (a[i] == "페이지") PAGE = i
    }
    printf "\xef\xbb\xbf"
  } else if (FNR in newu) {
    if (UNIT > 0) a[UNIT] = newu[FNR]
    if (PAGE > 0) a[PAGE] = newp[FNR]
    changed++
  }

  out = ""
  for (i = 1; i <= n; i++) {
    if (i > 1) out = out ","
    out = out q(a[i])
  }
  printf "%s\r\n", out
}
END { printf "CHANGED\t%d\n", changed > "/dev/stderr" }
' "$UPD" "$CSV" > "$TMP" 2> "$TMP.msg"

STATUS=$?
if [ "$STATUS" -ne 0 ] || [ ! -s "$TMP" ]; then
  echo ""
  echo " ⚠️  CSV에 저장하지 못했습니다. 원본은 그대로입니다."
  rm -f "$TMP" "$TMP.msg" "$UPD"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

mv "$TMP" "$CSV"
rm -f "$TMP.msg" "$UPD"

echo ""
echo " ✅ $NUPD 개의 단원·페이지를 CSV에 저장했습니다."
echo ""
echo " 원본 백업: $BACKUP"
echo ""
echo " 다음 순서:"
echo "   1) '3_autoname.command' 실행 → [다시 만들기 y]"
echo "   2) '2_rename.command' 실행 → 실제로 이름 변경"
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
