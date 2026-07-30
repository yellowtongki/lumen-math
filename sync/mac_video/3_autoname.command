#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 새 이름 자동으로 채우기 (맥미니 전용)
#
#  하는 일: '1_scan.command' 가 만든 CSV의 「새파일명」 빈칸을
#           ① 녹화일시  ② 시간표(timetable.txt)로 알아낸 반 이름
#           을 조합해 자동으로 채워 줍니다.
#
#           예) IMG_9556.MOV  →  2026-07-27_미적분1_01강_IMG_9556.MOV
#
#  ※ 파일 이름을 실제로 바꾸지는 않습니다. CSV만 채웁니다.
#     채워진 내용을 확인/수정한 뒤 '2_rename.command' 를 실행하세요.
# ══════════════════════════════════════════════════════════════
set -u

unescape_path() {
  printf '%s' "$1" \
    | sed -e "s/^[[:space:]]*//" -e "s/[[:space:]]*$//" \
          -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//' \
          -e 's/\\\(.\)/\1/g'
}

HERE=$(cd "$(dirname "$0")" 2>/dev/null && pwd)
TT="$HERE/timetable.txt"

echo ""
echo "════════════════════════════════════════════════"
echo "   루멘수학 · 새 이름 자동으로 채우기"
echo "════════════════════════════════════════════════"
echo ""

if [ -f "$TT" ]; then
  echo " 📅 시간표를 읽었습니다: timetable.txt"
else
  echo " ⚠️  시간표 파일(timetable.txt)이 이 스크립트와 같은 폴더에 없습니다."
  echo "     → 반 이름 없이 날짜·시각만으로 이름을 만듭니다."
  TT=""
fi

echo ""
echo " '_강의영상_목록.csv' 를 창에 끌어다 놓고 엔터."
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

echo ""
echo " 어떤 방식으로 이름을 지을까요?"
echo ""
echo "   1) 날짜 + 반 + 그날 그 반의 순번 + 원본번호"
echo "        예) 2026-07-27_미적분1_01강_IMG_9556"
echo "   2) 날짜 + 반 + 시각 + 원본번호"
echo "        예) 2026-07-27_미적분1_0932_IMG_9556"
echo "   3) 반 이름 없이 · 날짜 + 시각 + 원본번호"
echo "        예) 2026-07-27_0932_IMG_9556"
echo ""
printf " 번호 [1] → "
read -r STYLE
[ -z "${STYLE:-}" ] && STYLE=1
case "$STYLE" in 1|2|3) : ;; *) STYLE=1 ;; esac

echo ""
echo " 이름 끝에 넣을 꼬리표가 있으면 적으세요. (없으면 그냥 엔터)"
echo "   예) 집합  →  2026-07-27_공수2_01강_집합_IMG_9560"
echo ""
printf " 꼬리표 → "
read -r RAWTAG
TAG=$(printf '%s' "${RAWTAG:-}" | tr '/:' '--' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

STAMP=$(date "+%Y%m%d-%H%M%S")
BACKUP="${CSV%.csv}_백업_$STAMP.csv"
cp "$CSV" "$BACKUP"
TMP="${CSV%.csv}_임시_$STAMP.csv"

# 시간표가 없으면 빈 파일을 넘겨 줍니다 (awk가 두 파일을 받도록)
EMPTY=""
if [ -z "$TT" ]; then
  EMPTY="${CSV%.csv}_빈시간표_$STAMP.tmp"
  : > "$EMPTY"
  TT="$EMPTY"
fi

awk -v style="$STYLE" -v tag="$TAG" '
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

# 날짜(YYYY-MM-DD) → 요일. 0=토 1=일 2=월 3=화 4=수 5=목 6=금
function dow(y, m, d,    k, j, h) {
  if (m < 3) { m += 12; y-- }
  k = y % 100; j = int(y / 100)
  h = (d + int(13 * (m + 1) / 5) + k + int(k / 4) + int(j / 4) + 5 * j) % 7
  return h
}
function minutes(hhmm) { return substr(hhmm,1,2) * 60 + substr(hhmm,4,2) }

# ── 첫 번째 파일: 시간표 ──
NR == FNR {
  line = $0
  sub(/\r+$/, "", line)
  sub(/#.*$/, "", line)                       # 주석 제거
  gsub(/^[ \t]+|[ \t]+$/, "", line)
  if (line == "") next
  # 요일  시작-끝  반이름
  # 시각 부분을 먼저 찾아서 앞=요일, 뒤=반이름 으로 자릅니다
  # (한글 글자 수를 세지 않으므로 어떤 환경에서도 안전합니다)
  if (match(line, /[0-9][0-9]:[0-9][0-9]-[0-9][0-9]:[0-9][0-9]/) == 0) { badtt++; next }
  span = substr(line, RSTART, RLENGTH)
  day  = substr(line, 1, RSTART - 1)
  nm   = substr(line, RSTART + RLENGTH)
  gsub(/^[ \t]+|[ \t]+$/, "", day)
  gsub(/^[ \t]+|[ \t]+$/, "", nm)
  if (day == "" || nm == "") { badtt++; next }
  ttn++
  ttday[ttn]  = day
  # 앞부분이 2026-07-23 형태면 그 날짜에만 적용하는 규칙입니다
  ttisdate[ttn] = (day ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/) ? 1 : 0
  if (ttisdate[ttn]) ndate++; else nweek++
  ttfrom[ttn] = minutes(substr(span, 1, 5))     # span은 09:30-11:00 형태(ASCII)
  ttto[ttn]   = minutes(substr(span, 7, 5))
  ttname[ttn] = nm
  next
}

# ── 두 번째 파일: 원본 목록 CSV ──
{
  line = $0
  sub(/\r+$/, "", line)
  if (FNR == 1) sub(/^\xef\xbb\xbf/, "", line)
  ncol[FNR] = parse_csv(line, f)
  for (i = 1; i <= ncol[FNR]; i++) cell[FNR, i] = f[i]

  if (FNR == 1) {
    for (i = 1; i <= ncol[1]; i++) {
      if (index(f[i], "현재파일명") > 0) CUR  = i
      if (index(f[i], "새파일명")   > 0) NEW  = i
      if (index(f[i], "녹화일시")   > 0) WHEN = i
    }
    if (CUR == 0) CUR = 1
    if (NEW == 0) NEW = 2
    if (WHEN == 0) WHEN = 5
  }
  last = FNR
}

END {
  if (last < 2) { print "NOROWS" > "/dev/stderr"; exit 3 }

  split("토 일 월 화 수 목 금", DAYNAME, " ")

  # ── 각 영상이 어느 반 시간인지 찾습니다 ──
  for (r = 2; r <= last; r++) {
    w = cell[r, WHEN]
    if (w == "") continue
    y = substr(w, 1, 4) + 0
    mo = substr(w, 6, 2) + 0
    dd = substr(w, 9, 2) + 0
    mi = minutes(substr(w, 12, 5))
    dn = DAYNAME[dow(y, mo, dd) + 1]

    # ① 날짜로 지정한 규칙을 먼저 봅니다 (그 날만의 시간표가 이깁니다)
    cls[r] = ""
    d10 = substr(w, 1, 10)
    for (k = 1; k <= ttn; k++) {
      if (!ttisdate[k] || ttday[k] != d10) continue
      if (mi >= ttfrom[k] && mi < ttto[k]) { cls[r] = ttname[k]; bydate++; break }
    }
    # ② 없으면 요일 반복 규칙을 봅니다
    if (cls[r] == "") {
      for (k = 1; k <= ttn; k++) {
        if (ttisdate[k] || ttday[k] != dn) continue
        if (mi >= ttfrom[k] && mi < ttto[k]) { cls[r] = ttname[k]; byweek++; break }
      }
    }
    if (cls[r] == "") noclass++
  }

  # ── 같은 날 · 같은 반 안에서 시간순 순번을 매깁니다 ──
  for (r = 2; r <= last; r++) {
    w = cell[r, WHEN]
    if (w == "") continue
    d = substr(w, 1, 10); t = substr(w, 12, 5)
    rank = 1
    for (s = 2; s <= last; s++) {
      if (s == r) continue
      w2 = cell[s, WHEN]
      if (w2 == "") continue
      if (substr(w2, 1, 10) != d) continue
      if (style != "3" && cls[s] != cls[r]) continue
      t2 = substr(w2, 12, 5)
      if (t2 < t || (t2 == t && s < r)) rank++
    }
    seq[r] = rank
  }

  filled = 0; skipped_has = 0; skipped_nodate = 0
  for (r = 2; r <= last; r++) {
    if (cell[r, NEW] != "") { skipped_has++; continue }
    w = cell[r, WHEN]
    if (w == "") { skipped_nodate++; continue }

    d = substr(w, 1, 10)
    hm = substr(w, 12, 2) substr(w, 15, 2)

    base = cell[r, CUR]
    sub(/\.[^.]*$/, "", base)

    name = d
    if (style != "3" && cls[r] != "") name = name "_" cls[r]

    if (style == "1" && cls[r] != "") name = name "_" sprintf("%02d강", seq[r])
    else                              name = name "_" hm

    if (tag != "") name = name "_" tag
    name = name "_" base

    cell[r, NEW] = name
    filled++
  }

  printf "\xef\xbb\xbf"
  for (r = 1; r <= last; r++) {
    out = ""
    for (i = 1; i <= ncol[r]; i++) {
      if (i > 1) out = out ","
      out = out q(cell[r, i])
    }
    printf "%s\r\n", out
  }

  printf "RESULT\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\t%d\n", \
         filled, skipped_has, skipped_nodate, noclass, ttn, badtt, \
         ndate, nweek, bydate, byweek > "/dev/stderr"
}
' "$TT" "$CSV" > "$TMP" 2> "$TMP.msg"

STATUS=$?
RESULT=$(grep '^RESULT' "$TMP.msg" 2>/dev/null | head -1)
[ -n "$EMPTY" ] && rm -f "$EMPTY"

if [ "$STATUS" -ne 0 ] || [ -z "$RESULT" ]; then
  echo ""
  echo " ⚠️  CSV를 읽지 못했습니다. 1_scan.command 로 만든 파일이 맞는지 확인해 주세요."
  rm -f "$TMP" "$TMP.msg" "$BACKUP"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

FILLED=$(printf   '%s' "$RESULT" | cut -f2)
HAS=$(printf      '%s' "$RESULT" | cut -f3)
NODATE=$(printf   '%s' "$RESULT" | cut -f4)
NOCLASS=$(printf  '%s' "$RESULT" | cut -f5)
TTN=$(printf      '%s' "$RESULT" | cut -f6)
BADTT=$(printf    '%s' "$RESULT" | cut -f7)
NDATE=$(printf    '%s' "$RESULT" | cut -f8)
NWEEK=$(printf    '%s' "$RESULT" | cut -f9)
BYDATE=$(printf   '%s' "$RESULT" | cut -f10)
BYWEEK=$(printf   '%s' "$RESULT" | cut -f11)

mv "$TMP" "$CSV"
rm -f "$TMP.msg"

echo ""
echo " ✅ 새이름 $FILLED 개를 채웠습니다."
[ "${TTN:-0}" -gt 0 ]     && echo "    · 시간표 $TTN 줄 (날짜지정 ${NDATE:-0} / 요일반복 ${NWEEK:-0})"
[ "${BYDATE:-0}" -gt 0 ]  && echo "    · 날짜지정으로 판정한 영상 ${BYDATE} 개"
[ "${BYWEEK:-0}" -gt 0 ]  && echo "    · 요일반복으로 판정한 영상 ${BYWEEK} 개"
[ "${BADTT:-0}" -gt 0 ]   && echo "    ⚠️  시간표에서 형식이 맞지 않아 무시한 줄이 $BADTT 개 있습니다."
[ "${NOCLASS:-0}" -gt 0 ] && echo "    ⚠️  $NOCLASS 개는 시간표에 없는 시각이라 반 이름 없이 지었습니다."
[ "${HAS:-0}" -gt 0 ]     && echo "    · 이미 이름을 적어두신 $HAS 개는 그대로 두었습니다."
[ "${NODATE:-0}" -gt 0 ]  && echo "    · 녹화일시를 알 수 없는 $NODATE 개는 비워 두었습니다."
echo ""
echo " 원본 백업: $BACKUP"
echo ""
echo " 다음 순서:"
echo "   1) CSV를 열어 채워진 이름을 확인하고, 단원명 등을 덧붙입니다"
echo "      (또는 '4_matchedit.command' 로 강의편집 폴더 이름을 가져옵니다)"
echo "   2) '2_rename.command' 를 실행해 실제로 이름을 바꿉니다"
echo ""
open -R "$CSV" 2>/dev/null || true
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
