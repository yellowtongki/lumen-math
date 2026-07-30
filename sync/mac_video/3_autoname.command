#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  루멘수학 · 새 이름 자동으로 채우기 (맥미니 전용)
#
#  하는 일: '1_scan.command' 가 만든 CSV의 「새파일명」 빈칸을
#           녹화일시를 이용해 자동으로 채워 줍니다.
#           (IMG_9562.MOV 처럼 이름에 정보가 없는 아이폰 영상용)
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

echo ""
echo "════════════════════════════════════════════════"
echo "   루멘수학 · 새 이름 자동으로 채우기"
echo "════════════════════════════════════════════════"
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
echo "   1) 날짜 + 시각 + 원본번호      예) 2026-07-27_1141_IMG_9562"
echo "   2) 날짜 + 그날 순번 + 원본번호  예) 2026-07-27_01강_IMG_9562"
echo "   3) 날짜 + 시각만               예) 2026-07-27_1141"
echo ""
printf " 번호 [1] → "
read -r STYLE
[ -z "${STYLE:-}" ] && STYLE=1
case "$STYLE" in
  1|2|3) : ;;
  *) STYLE=1 ;;
esac

echo ""
echo " 이름 가운데에 넣을 꼬리표가 있으면 적으세요. (없으면 그냥 엔터)"
echo "   예) 고1미적  →  2026-07-27_1141_고1미적_IMG_9562"
echo ""
printf " 꼬리표 → "
read -r RAWTAG
TAG=$(printf '%s' "${RAWTAG:-}" | tr '/:' '--' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

# 원본을 그대로 백업해 둡니다 (되돌릴 수 있게)
STAMP=$(date "+%Y%m%d-%H%M%S")
BACKUP="${CSV%.csv}_백업_$STAMP.csv"
cp "$CSV" "$BACKUP"

TMP="${CSV%.csv}_임시_$STAMP.csv"

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

{
  line = $0
  sub(/\r+$/, "", line)
  if (NR == 1) sub(/^\xef\xbb\xbf/, "", line)
  ncol[NR] = parse_csv(line, f)
  for (i = 1; i <= ncol[NR]; i++) cell[NR, i] = f[i]

  if (NR == 1) {
    for (i = 1; i <= ncol[1]; i++) {
      if (index(f[i], "현재파일명") > 0) CUR = i
      if (index(f[i], "새파일명")   > 0) NEW = i
      if (index(f[i], "녹화일시")   > 0) WHEN = i
    }
    if (CUR == 0) CUR = 1
    if (NEW == 0) NEW = 2
    if (WHEN == 0) WHEN = 5
  }
  last = NR
}

END {
  if (last < 2) { print "NOROWS" > "/dev/stderr"; exit 3 }

  # ── 2번 방식(그날 순번)을 위해 날짜별 순서를 미리 계산합니다 ──
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
      # 같은 시각이면 줄 순서로 앞뒤를 정합니다
      if (t2 < t || (t2 == t && s < r)) rank++
    }
    seq[r] = rank
  }

  filled = 0; skipped_has = 0; skipped_nodate = 0

  for (r = 2; r <= last; r++) {
    if (cell[r, NEW] != "") { skipped_has++; continue }
    w = cell[r, WHEN]
    if (w == "") { skipped_nodate++; continue }

    d = substr(w, 1, 10)                              # 2026-07-27
    hm = substr(w, 12, 2) substr(w, 15, 2)            # 1141

    # 원본 파일명에서 확장자를 뗀 부분 (IMG_9562)
    base = cell[r, CUR]
    sub(/\.[^.]*$/, "", base)

    if      (style == "1") name = d "_" hm
    else if (style == "2") name = d "_" sprintf("%02d강", seq[r])
    else                   name = d "_" hm

    if (tag != "") name = name "_" tag
    if (style != "3") name = name "_" base

    cell[r, NEW] = name
    filled++
  }

  # ── CSV를 그대로 다시 씁니다 (칸 구조·따옴표 유지) ──
  printf "\xef\xbb\xbf"
  for (r = 1; r <= last; r++) {
    out = ""
    for (i = 1; i <= ncol[r]; i++) {
      if (i > 1) out = out ","
      out = out q(cell[r, i])
    }
    printf "%s\r\n", out
  }

  printf "RESULT\t%d\t%d\t%d\n", filled, skipped_has, skipped_nodate > "/dev/stderr"
}
' "$CSV" > "$TMP" 2> "$TMP.msg"

STATUS=$?
RESULT=$(grep '^RESULT' "$TMP.msg" 2>/dev/null | head -1)

if [ "$STATUS" -ne 0 ] || [ -z "$RESULT" ]; then
  echo ""
  echo " ⚠️  CSV를 읽지 못했습니다. 1_scan.command 로 만든 파일이 맞는지 확인해 주세요."
  rm -f "$TMP" "$TMP.msg" "$BACKUP"
  echo ""
  read -r -p " 엔터를 누르면 창이 닫힙니다. " _
  exit 1
fi

FILLED=$(printf '%s' "$RESULT" | cut -f2)
HAS=$(printf '%s' "$RESULT" | cut -f3)
NODATE=$(printf '%s' "$RESULT" | cut -f4)

mv "$TMP" "$CSV"
rm -f "$TMP.msg"

echo ""
echo " ✅ 새이름 $FILLED 개를 채웠습니다."
[ "${HAS:-0}" -gt 0 ]    && echo "    · 이미 이름을 적어두신 $HAS 개는 그대로 두었습니다."
[ "${NODATE:-0}" -gt 0 ] && echo "    · 녹화일시를 알 수 없는 $NODATE 개는 비워 두었습니다."
echo ""
echo " 원본 백업: $BACKUP"
echo ""
echo " 다음 순서:"
echo "   1) CSV를 열어 채워진 이름을 확인하고, 원하면 손으로 고칩니다"
echo "      (예: 뒤에 _고1_이차함수 처럼 덧붙이기)"
echo "   2) '2_rename.command' 를 실행해 실제로 이름을 바꿉니다"
echo ""
open -R "$CSV" 2>/dev/null || true
echo ""
read -r -p " 엔터를 누르면 창이 닫힙니다. " _
