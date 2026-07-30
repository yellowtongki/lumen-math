#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 편집본 이름을 원본에 붙이기 (맥미니 전용)
#
#  하는 일: '강의편집' 폴더의 이름(예: "공수2 부분집합 260727")을 읽어
#           같은 날 녹화된 원본(IMG_9556.MOV)에 짝지어 줍니다.
#           → 원본에도 반·단원 이름이 붙습니다.
#
#  짝짓는 방법: 같은 날짜끼리 모아서 시간 순서대로 1:1로 맞춥니다.
#               (촬영 순서 = 편집 순서 라는 가정)
#               그래서 반드시 확인이 필요합니다. 아래 '확인 방법' 참고.
#
#  ※ 파일 이름을 실제로 바꾸지 않습니다. CSV만 채웁니다.
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
echo "   루멘수학 · 편집본 이름을 원본에 붙이기"
echo "════════════════════════════════════════════════"
echo ""
echo " ① 원본 목록 CSV('_강의영상_목록.csv')를 끌어다 놓고 엔터."
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
echo " ② '강의편집' 폴더를 끌어다 놓고 엔터."
echo "    (예: /Users/강의편집)"
echo ""
printf " 강의편집 폴더 → "
read -r RAWEDIT
EDITDIR=$(unescape_path "$RAWEDIT")
EDITDIR="${EDITDIR%/}"

if [ ! -d "$EDITDIR" ]; then
  echo ""
  echo " ⚠️  폴더를 찾을 수 없습니다: $EDITDIR"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

STAMP=$(date "+%Y%m%d-%H%M%S")
LIST="${CSV%.csv}_편집본목록_$STAMP.tmp"
: > "$LIST"

# ── 강의편집 폴더의 바로 아래 하위 폴더 이름을 모읍니다 ──
#    이름 끝의 6자리(260727)를 날짜로 해석하고, 폴더 수정시각 순으로 정렬합니다
while IFS= read -r d; do
  nm=$(basename "$d")
  case "$nm" in .*) continue ;; esac

  # 이름 끝에서 6자리 숫자(YYMMDD)를 찾습니다
  ymd=$(printf '%s' "$nm" | sed -n 's/.*[^0-9]\([0-9][0-9][0-9][0-9][0-9][0-9]\)[[:space:]]*$/\1/p')
  [ -z "$ymd" ] && ymd=$(printf '%s' "$nm" | sed -n 's/^\([0-9][0-9][0-9][0-9][0-9][0-9]\)[[:space:]]*$/\1/p')
  [ -z "$ymd" ] && continue

  yy=$(printf '%s' "$ymd" | cut -c1-2)
  mm=$(printf '%s' "$ymd" | cut -c3-4)
  dd=$(printf '%s' "$ymd" | cut -c5-6)
  date_full="20$yy-$mm-$dd"

  mt=$(stat -f "%m" "$d" 2>/dev/null || echo 0)
  case "$mt" in ''|*[!0-9]*) mt=0 ;; esac

  printf '%s\t%s\t%s\n' "$date_full" "$mt" "$nm" >> "$LIST"
done < <(find "$EDITDIR" -mindepth 1 -maxdepth 1 -type d -print)

# 날짜 → 폴더수정시각 → 이름 순으로 정렬
SORTED="${LIST}.sorted"
sort -t"$(printf '\t')" -k1,1 -k2,2n -k3,3 "$LIST" > "$SORTED"

NEDIT=$(wc -l < "$SORTED" | tr -d ' ')
if [ "${NEDIT:-0}" -eq 0 ]; then
  echo ""
  echo " ⚠️  '강의편집' 안에서 날짜(260727 같은 6자리)가 붙은 폴더를 찾지 못했습니다."
  rm -f "$LIST" "$SORTED"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi
echo ""
echo " 📁 강의편집에서 $NEDIT 개의 강의 폴더를 읽었습니다."

BACKUP="${CSV%.csv}_백업_$STAMP.csv"
cp "$CSV" "$BACKUP"
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

# ── 첫 번째 파일: 강의편집 폴더 목록 (날짜 \t 수정시각 \t 이름) ──
NR == FNR {
  p1 = index($0, "\t"); if (p1 == 0) next
  d = substr($0, 1, p1 - 1)
  rest = substr($0, p1 + 1)
  p2 = index(rest, "\t"); if (p2 == 0) next
  nm = substr(rest, p2 + 1)
  ecnt[d]++
  ed[d, ecnt[d]] = nm
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
    NCOL1 = ncol[1]
    for (i = 1; i <= NCOL1; i++) {
      if (index(f[i], "현재파일명")   > 0) CUR  = i
      if (index(f[i], "새파일명")     > 0) NEW  = i
      if (index(f[i], "녹화일시")     > 0) WHEN = i
      if (index(f[i], "그날_강의목록") > 0) CAND = i
    }
    if (CUR  == 0) CUR  = 1
    if (NEW  == 0) NEW  = 2
    if (WHEN == 0) WHEN = 8
    # 참고용 후보 칸이 없으면 맨 뒤에 새로 만듭니다
    if (CAND == 0) { CAND = NCOL1 + 1; cell[1, CAND] = "그날_강의목록(참고)"; ncol[1] = CAND }
  }
  last = FNR
}

END {
  if (last < 2) { print "NOROWS" > "/dev/stderr"; exit 3 }

  # ── 날짜별로 원본을 시간순 정렬해 순번을 매깁니다 ──
  for (r = 2; r <= last; r++) {
    w = cell[r, WHEN]
    if (w == "") continue
    d = substr(w, 1, 10)
    t = substr(w, 12, 5)
    rank = 1
    for (s = 2; s <= last; s++) {
      if (s == r) continue
      w2 = cell[s, WHEN]
      if (w2 == "") continue
      if (substr(w2, 1, 10) != d) continue
      t2 = substr(w2, 12, 5)
      if (t2 < t || (t2 == t && s < r)) rank++
    }
    seq[r] = rank
    rawcnt[d]++
  }

  matched = 0; nocand = 0; hasname = 0; mismatch = 0
  for (r = 2; r <= last; r++) {
    w = cell[r, WHEN]
    if (w == "") continue
    d = substr(w, 1, 10)

    # 그날의 강의 목록을 참고 칸에 적어 둡니다 (원장님이 눈으로 대조하시라고)
    cl = ""
    for (k = 1; k <= ecnt[d]; k++) cl = cl (k > 1 ? "  |  " : "") k ") " ed[d, k]
    cell[r, CAND] = cl

    if (ecnt[d] == 0) { nocand++; continue }
    if (cell[r, NEW] != "") { hasname++; continue }

    # 개수가 다르면 자동으로 채우지 않습니다 (잘못 붙는 것을 막기 위해)
    if (ecnt[d] != rawcnt[d]) { mismatch++; continue }

    nm = ed[d, seq[r]]
    if (nm == "") continue

    base = cell[r, CUR]
    sub(/\.[^.]*$/, "", base)
    cell[r, NEW] = nm "_" base
    matched++
  }

  printf "\xef\xbb\xbf"
  for (r = 1; r <= last; r++) {
    nc = (r == 1 ? ncol[1] : (ncol[r] > CAND ? ncol[r] : CAND))
    out = ""
    for (i = 1; i <= nc; i++) {
      if (i > 1) out = out ","
      out = out q(cell[r, i])
    }
    printf "%s\r\n", out
  }

  printf "RESULT\t%d\t%d\t%d\t%d\n", matched, mismatch, nocand, hasname > "/dev/stderr"
}
' "$SORTED" "$CSV" > "$TMP" 2> "$TMP.msg"

STATUS=$?
RESULT=$(grep '^RESULT' "$TMP.msg" 2>/dev/null | head -1)

if [ "$STATUS" -ne 0 ] || [ -z "$RESULT" ]; then
  echo ""
  echo " ⚠️  CSV를 읽지 못했습니다. 1_scan.command 로 만든 파일이 맞는지 확인해 주세요."
  rm -f "$TMP" "$TMP.msg" "$BACKUP" "$LIST" "$SORTED"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

MATCHED=$(printf '%s' "$RESULT" | cut -f2)
MISMATCH=$(printf '%s' "$RESULT" | cut -f3)
NOCAND=$(printf '%s' "$RESULT" | cut -f4)
HASNAME=$(printf '%s' "$RESULT" | cut -f5)

mv "$TMP" "$CSV"
rm -f "$TMP.msg" "$LIST" "$SORTED"

echo ""
echo " ✅ $MATCHED 개에 편집본 이름을 붙였습니다."
[ "${MISMATCH:-0}" -gt 0 ] && echo "    ⚠️  $MISMATCH 개는 그날 원본 수와 강의 폴더 수가 달라 비워 두었습니다."
[ "${NOCAND:-0}" -gt 0 ]   && echo "    · $NOCAND 개는 그날짜 강의 폴더가 없어 비워 두었습니다."
[ "${HASNAME:-0}" -gt 0 ]  && echo "    · $HASNAME 개는 이미 이름이 적혀 있어 그대로 두었습니다."
echo ""
echo " 원본 백업: $BACKUP"
echo ""
echo " ── 반드시 확인하세요 ─────────────────────────"
echo "  CSV를 열면 맨 오른쪽에 '그날_강의목록(참고)' 칸이 있습니다."
echo "  그날 찍은 강의 이름이 순서대로 적혀 있으니,"
echo "  「길이」 칸(영상 재생시간)과 견주어 짝이 맞는지 확인하고"
echo "  다르면 '새파일명' 칸을 직접 고치세요."
echo ""
echo "  확인이 끝나면 '2_rename.command' 를 실행합니다."
echo ""
open -R "$CSV" 2>/dev/null || true
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
