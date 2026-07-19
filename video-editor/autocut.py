#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
루멘수학 수업영상 자동 편집기 (autocut)

말이 없는 '조용한 구간'을 자동으로 찾아 잘라내는 도구.
2단계로 나뉜다.

  1) 분석(analyze): 영상에서 무음 구간을 찾아 '컷목록.txt'를 만든다.
                    (자를 곳 목록을 사람이 먼저 눈으로 확인/수정하기 위함)
  2) 만들기(build): 컷목록.txt를 읽어 그 구간을 잘라낸 완성 영상을 만든다.

사용 예:
    python autocut.py analyze "수업.mp4"
    python autocut.py build   "수업.mp4"

의존성: ffmpeg / ffprobe 만 있으면 된다 (파이썬 기본 라이브러리만 사용).
"""

import sys
import os
import re
import subprocess
import shutil

# ─────────────────────────────────────────────────────────────
# 조절 가능한 기본값 (원하면 여기 숫자만 바꾸면 됩니다)
# ─────────────────────────────────────────────────────────────
NOISE_DB = -30          # 이 크기보다 조용하면 '무음'으로 봄 (숫자가 작을수록=더 조용해야 무음 처리. -35, -25 등으로 조절)
MIN_SILENCE = 1.5       # 이 시간(초)보다 긴 무음만 자를 후보로 봄 (짧은 자연스러운 쉼은 안 자름)
KEEP_PADDING = 0.35     # 무음 구간 양쪽으로 이만큼(초)은 남긴다 (말이 잘리지 않게 여유)
MIN_CUT = 0.6           # 여유를 뺀 실제 자를 길이가 이보다 짧으면 자르지 않음
# 완성 영상 화질/인코딩 설정
VIDEO_CRF = 22          # 화질 (숫자 작을수록 고화질/큰용량. 18~24 권장)
VIDEO_PRESET = "veryfast"


# ─────────────────────────────────────────────────────────────
# 시간 표시 도우미
# ─────────────────────────────────────────────────────────────
def fmt(sec):
    """초 -> 00:00:00.0 형태 문자열"""
    if sec < 0:
        sec = 0
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h:02d}:{m:02d}:{s:04.1f}"


def parse_time(text):
    """'00:01:23.4' 또는 '83.4' -> 초(float)"""
    text = text.strip()
    if ":" in text:
        parts = text.split(":")
        parts = [float(p) for p in parts]
        while len(parts) < 3:
            parts.insert(0, 0.0)
        h, m, s = parts[-3], parts[-2], parts[-1]
        return h * 3600 + m * 60 + s
    return float(text)


# ─────────────────────────────────────────────────────────────
# ffmpeg / ffprobe 확인
# ─────────────────────────────────────────────────────────────
def check_tools():
    missing = [t for t in ("ffmpeg", "ffprobe") if shutil.which(t) is None]
    if missing:
        print("⚠ 필요한 프로그램이 없습니다: " + ", ".join(missing))
        print("  ffmpeg 설치가 필요합니다. (사용법.md의 '설치' 부분 참고)")
        sys.exit(1)


def get_duration(video):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nokey=1:noprint_wrappers=1", video],
        capture_output=True, text=True,
    )
    try:
        return float(out.stdout.strip())
    except ValueError:
        print("⚠ 영상 길이를 읽지 못했습니다. 파일이 올바른 영상인지 확인해 주세요.")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────
# 1) 분석: 무음 구간 찾기
# ─────────────────────────────────────────────────────────────
def detect_silences(video):
    """ffmpeg silencedetect 로 무음 구간 [(start, end), ...] 반환"""
    proc = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", video,
         "-af", f"silencedetect=noise={NOISE_DB}dB:d={MIN_SILENCE}",
         "-f", "null", "-"],
        capture_output=True, text=True,
    )
    log = proc.stderr
    silences = []
    cur_start = None
    for line in log.splitlines():
        m = re.search(r"silence_start:\s*(-?[\d.]+)", line)
        if m:
            cur_start = float(m.group(1))
            continue
        m = re.search(r"silence_end:\s*(-?[\d.]+)", line)
        if m and cur_start is not None:
            silences.append((max(0.0, cur_start), float(m.group(1))))
            cur_start = None
    return silences


def silences_to_cuts(silences, duration):
    """무음 구간 -> 실제로 자를 구간 (양쪽 여유 남기고, 너무 짧은 건 제외)"""
    cuts = []
    for s, e in silences:
        cs = s + KEEP_PADDING
        ce = e - KEEP_PADDING
        ce = min(ce, duration)
        if ce - cs >= MIN_CUT:
            cuts.append((cs, ce))
    return cuts


def cutlist_path(video):
    base = os.path.splitext(video)[0]
    return base + "_컷목록.txt"


def write_cutlist(video, cuts, duration):
    path = cutlist_path(video)
    total_cut = sum(e - s for s, e in cuts)
    with open(path, "w", encoding="utf-8") as f:
        f.write("# ─────────────────────────────────────────────\n")
        f.write("#  루멘수학 자동편집 — 자를 구간 목록\n")
        f.write("# ─────────────────────────────────────────────\n")
        f.write(f"#  원본 파일 : {os.path.basename(video)}\n")
        f.write(f"#  원본 길이 : {fmt(duration)}\n")
        f.write(f"#  자를 구간 : {len(cuts)} 곳  (합계 {fmt(total_cut)})\n")
        f.write(f"#  예상 완성 길이 : {fmt(duration - total_cut)}\n")
        f.write("#\n")
        f.write("#  [확인/수정 방법]\n")
        f.write("#   - 아래 각 줄은 '잘라낼(삭제할) 구간' 입니다.\n")
        f.write("#   - 이 부분은 자르지 말고 남기고 싶다  ->  그 줄 맨 앞에 #  을 붙이거나 줄을 지우세요.\n")
        f.write("#   - 자를 시간을 조금 바꾸고 싶다        ->  숫자를 직접 고치세요 (형식: 시:분:초.소수).\n")
        f.write("#   - 다 확인했으면 저장하고 '2_영상만들기'를 실행하세요.\n")
        f.write("#\n")
        f.write("#  형식:  시작 - 끝    (설명)\n")
        f.write("# ─────────────────────────────────────────────\n\n")
        if not cuts:
            f.write("# (자를 만한 조용한 구간을 찾지 못했습니다.)\n")
        for i, (s, e) in enumerate(cuts, 1):
            f.write(f"{fmt(s)} - {fmt(e)}    (#{i} 무음 {e - s:.1f}초)\n")
    return path, total_cut


def read_cutlist(video):
    path = cutlist_path(video)
    if not os.path.exists(path):
        print(f"⚠ 컷목록 파일이 없습니다: {os.path.basename(path)}")
        print("  먼저 '1_분석'을 실행해서 컷목록을 만들어 주세요.")
        sys.exit(1)
    cuts = []
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            m = re.match(r"([\d:.]+)\s*-\s*([\d:.]+)", line)
            if m:
                s = parse_time(m.group(1))
                e = parse_time(m.group(2))
                if e > s:
                    cuts.append((s, e))
    cuts.sort()
    return cuts


# ─────────────────────────────────────────────────────────────
# 2) 만들기: 자를 구간을 뺀 '남길 구간'만 이어붙이기
# ─────────────────────────────────────────────────────────────
def cuts_to_keeps(cuts, duration):
    """자를 구간의 여집합 = 남길 구간"""
    keeps = []
    pos = 0.0
    for s, e in cuts:
        s = max(0.0, s)
        e = min(duration, e)
        if s > pos:
            keeps.append((pos, s))
        pos = max(pos, e)
    if pos < duration:
        keeps.append((pos, duration))
    # 아주 짧은 조각은 버림
    return [(s, e) for s, e in keeps if e - s > 0.05]


def build(video):
    duration = get_duration(video)
    cuts = read_cutlist(video)
    keeps = cuts_to_keeps(cuts, duration)

    base, ext = os.path.splitext(video)
    out = base + "_편집완성.mp4"

    if not cuts:
        print("자를 구간이 없어 원본을 그대로 내보냅니다.")

    # select 필터용 표현식: 남길 구간들을 OR 로 연결
    expr = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in keeps)
    if not expr:
        expr = "1"  # 안전장치: 전체 통과

    vf = f"select='{expr}',setpts=N/FRAME_RATE/TB"
    af = f"aselect='{expr}',asetpts=N/SR/TB"

    total_keep = sum(e - s for s, e in keeps)
    print(f"완성 예상 길이: {fmt(total_keep)}  (원본 {fmt(duration)})")
    print("영상을 만드는 중입니다... (길이에 따라 몇 분 걸릴 수 있어요)")

    cmd = [
        "ffmpeg", "-hide_banner", "-y", "-i", video,
        "-vf", vf, "-af", af,
        "-c:v", "libx264", "-preset", VIDEO_PRESET, "-crf", str(VIDEO_CRF),
        "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart",
        out,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print("⚠ 영상 만들기에 실패했습니다. 아래 메시지를 확인해 주세요:")
        print(proc.stderr[-1500:])
        sys.exit(1)
    print(f"\n✅ 완성! -> {os.path.basename(out)}")


# ─────────────────────────────────────────────────────────────
# 진입점
# ─────────────────────────────────────────────────────────────
def analyze(video):
    duration = get_duration(video)
    print(f"영상 길이: {fmt(duration)} — 조용한 구간을 찾는 중입니다...")
    silences = detect_silences(video)
    cuts = silences_to_cuts(silences, duration)
    path, total_cut = write_cutlist(video, cuts, duration)
    print(f"\n찾은 무음 구간: {len(cuts)} 곳  (합계 {fmt(total_cut)} 잘림 예정)")
    print(f"예상 완성 길이: {fmt(duration - total_cut)}")
    print(f"\n📄 자를 목록을 만들었습니다 -> {os.path.basename(path)}")
    print("   이 파일을 열어 확인/수정한 뒤 '2_영상만들기'를 실행하세요.")
    return path


def main():
    if len(sys.argv) < 3:
        print("사용법: python autocut.py [analyze|build] \"영상파일.mp4\"")
        sys.exit(1)
    mode = sys.argv[1].lower()
    video = sys.argv[2]
    if not os.path.exists(video):
        print(f"⚠ 영상 파일을 찾을 수 없습니다: {video}")
        sys.exit(1)
    check_tools()

    if mode == "analyze":
        analyze(video)
    elif mode == "build":
        build(video)
    else:
        print(f"⚠ 알 수 없는 명령: {mode} (analyze 또는 build 만 됩니다)")
        sys.exit(1)


if __name__ == "__main__":
    main()
