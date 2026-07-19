#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
루멘수학 수업영상 편집기 — 화면(GUI) 버전

캡컷 없이, 영상을 열고 → 무음 구간을 자동으로 찾아 → 각 구간의 '장면 사진'을
보며 남길지/자를지 체크 → 완성 영상을 만드는 프로그램.

파이썬 기본 기능(tkinter)만 사용 → 파이썬 외 추가 설치 불필요.
편집 엔진은 같은 폴더의 autocut.py 를 그대로 사용한다.
"""

import os
import sys
import threading
import tempfile
import traceback

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import autocut  # noqa: E402


BG = "#f4f6fb"
ACCENT = "#3b6fe0"
CARD = "#ffffff"


class App:
    def __init__(self, root):
        self.root = root
        self.video = None
        self.duration = 0.0
        self.rows = []          # [{var, start, end, img}]
        self._imgs = []         # PhotoImage 참조 유지 (GC 방지)
        self.tmpdir = tempfile.mkdtemp(prefix="lumen_thumb_")
        self.busy = False

        root.title("루멘수학 영상 편집기")
        root.configure(bg=BG)
        root.geometry("760x680")
        root.minsize(680, 560)

        self._build_ui()

    # ── 화면 구성 ───────────────────────────────────────────
    def _build_ui(self):
        pad = dict(padx=14, pady=8)

        # 상단: 영상 열기
        top = tk.Frame(self.root, bg=BG)
        top.pack(fill="x", **pad)
        tk.Button(top, text="📂  영상 열기", command=self.open_video,
                  font=("맑은 고딕", 12, "bold"), bg=ACCENT, fg="white",
                  relief="flat", padx=16, pady=8, cursor="hand2").pack(side="left")
        self.file_lbl = tk.Label(top, text="열린 영상 없음", bg=BG,
                                  fg="#555", font=("맑은 고딕", 10))
        self.file_lbl.pack(side="left", padx=12)

        # 설정: 민감도
        opt = tk.LabelFrame(self.root, text="  자동 감지 설정  ", bg=BG,
                            fg="#333", font=("맑은 고딕", 10, "bold"))
        opt.pack(fill="x", padx=14, pady=4)
        r1 = tk.Frame(opt, bg=BG); r1.pack(fill="x", padx=10, pady=6)
        tk.Label(r1, text="이만큼(초) 넘게 조용하면 자를 후보:", bg=BG,
                 font=("맑은 고딕", 10)).pack(side="left")
        self.min_sil = tk.DoubleVar(value=autocut.MIN_SILENCE)
        tk.Scale(r1, from_=0.8, to=4.0, resolution=0.1, orient="horizontal",
                 variable=self.min_sil, length=200, bg=BG,
                 highlightthickness=0).pack(side="left", padx=8)
        tk.Label(r1, text="(값을 키우면 확실히 긴 정적만 자릅니다)", bg=BG,
                 fg="#888", font=("맑은 고딕", 9)).pack(side="left")

        analyze_row = tk.Frame(self.root, bg=BG)
        analyze_row.pack(fill="x", padx=14, pady=4)
        self.analyze_btn = tk.Button(analyze_row, text="🔍  무음 분석하기",
                                     command=self.analyze,
                                     font=("맑은 고딕", 11, "bold"),
                                     bg="#eaf0ff", fg=ACCENT, relief="flat",
                                     padx=14, pady=6, cursor="hand2",
                                     state="disabled")
        self.analyze_btn.pack(side="left")
        self.summary_lbl = tk.Label(analyze_row, text="", bg=BG, fg="#333",
                                    font=("맑은 고딕", 10, "bold"))
        self.summary_lbl.pack(side="left", padx=14)

        # 중앙: 스크롤 가능한 컷 목록
        mid = tk.Frame(self.root, bg=BG)
        mid.pack(fill="both", expand=True, padx=14, pady=6)
        self.canvas = tk.Canvas(mid, bg=BG, highlightthickness=0)
        sb = ttk.Scrollbar(mid, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.list_frame = tk.Frame(self.canvas, bg=BG)
        self.canvas_win = self.canvas.create_window((0, 0), window=self.list_frame,
                                                    anchor="nw")
        self.list_frame.bind("<Configure>", lambda e: self.canvas.configure(
            scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(
            self.canvas_win, width=e.width))
        # 마우스 휠 스크롤
        self.canvas.bind_all("<MouseWheel>", self._on_wheel)

        self._hint = tk.Label(self.list_frame,
                              text="\n영상을 열고 '무음 분석하기'를 누르면\n"
                                   "자를 구간이 장면 사진과 함께 여기에 표시됩니다.\n",
                              bg=BG, fg="#999", font=("맑은 고딕", 11))
        self._hint.pack(pady=40)

        # 하단: 완성 만들기 + 진행 바
        bottom = tk.Frame(self.root, bg=BG)
        bottom.pack(fill="x", padx=14, pady=10)
        self.make_btn = tk.Button(bottom, text="🎬  완성 영상 만들기",
                                  command=self.make_video,
                                  font=("맑은 고딕", 12, "bold"), bg="#1eaa5c",
                                  fg="white", relief="flat", padx=18, pady=9,
                                  cursor="hand2", state="disabled")
        self.make_btn.pack(side="left")
        self.progress = ttk.Progressbar(bottom, mode="determinate",
                                        maximum=100, length=280)
        self.progress.pack(side="left", padx=14, fill="x", expand=True)
        self.status_lbl = tk.Label(bottom, text="", bg=BG, fg="#555",
                                   font=("맑은 고딕", 10))
        self.status_lbl.pack(side="left")

    def _on_wheel(self, e):
        self.canvas.yview_scroll(int(-1 * (e.delta / 120)), "units")

    # ── 영상 열기 ───────────────────────────────────────────
    def open_video(self):
        if self.busy:
            return
        path = filedialog.askopenfilename(
            title="편집할 영상을 고르세요",
            filetypes=[("영상 파일", "*.mp4 *.mov *.mkv *.avi *.m4v *.MOV *.MP4"),
                       ("모든 파일", "*.*")])
        if not path:
            return
        self.video = path
        try:
            self.duration = autocut.get_duration(path)
        except SystemExit:
            messagebox.showerror("오류", "영상 길이를 읽지 못했습니다. 올바른 영상 파일인지 확인해 주세요.")
            self.video = None
            return
        self.file_lbl.config(text=f"{os.path.basename(path)}  (길이 {autocut.fmt(self.duration)})")
        self.analyze_btn.config(state="normal")
        self.make_btn.config(state="disabled")
        self._clear_rows()
        self.summary_lbl.config(text="'무음 분석하기'를 눌러 주세요 →")

    # ── 분석 (백그라운드 실행) ──────────────────────────────
    def analyze(self):
        if self.busy or not self.video:
            return
        self._set_busy(True)
        self.summary_lbl.config(text="분석 중입니다...")
        self._clear_rows()
        threading.Thread(target=self._analyze_worker, daemon=True).start()

    def _analyze_worker(self):
        try:
            sil = autocut.detect_silences(self.video,
                                          min_silence=self.min_sil.get())
            cuts = autocut.silences_to_cuts(sil, self.duration)
            data = []
            for i, (s, e) in enumerate(cuts):
                self.root.after(0, self.summary_lbl.config,
                                {"text": f"미리보기 만드는 중... {i+1}/{len(cuts)}"})
                png = os.path.join(self.tmpdir, f"cut_{i}.png")
                mid = (s + e) / 2
                autocut.extract_thumbnail(self.video, mid, png, width=220)
                data.append((s, e, png if os.path.exists(png) else None))
            self.root.after(0, self._show_rows, data)
        except Exception:
            err = traceback.format_exc()
            self.root.after(0, self._analyze_failed, err)

    def _analyze_failed(self, err):
        self._set_busy(False)
        self.summary_lbl.config(text="분석 실패")
        messagebox.showerror("분석 오류", "무음 분석 중 문제가 생겼습니다.\n\n" + err[-800:])

    def _show_rows(self, data):
        self._clear_rows()
        if not data:
            self.summary_lbl.config(text="자를 만한 조용한 구간을 찾지 못했습니다.")
            tk.Label(self.list_frame, text="\n조용한 구간이 없습니다.\n감도를 올리거나(초를 낮추거나) 다른 영상을 열어 보세요.\n",
                     bg=BG, fg="#999", font=("맑은 고딕", 11)).pack(pady=30)
            self._set_busy(False)
            return
        for i, (s, e, png) in enumerate(data, 1):
            self._add_row(i, s, e, png)
        self._set_busy(False)
        self.make_btn.config(state="normal")
        self._update_summary()

    def _add_row(self, idx, s, e, png):
        var = tk.IntVar(value=1)  # 1 = 자른다(기본)
        card = tk.Frame(self.list_frame, bg=CARD, bd=1, relief="solid",
                        highlightbackground="#e2e6ef")
        card.pack(fill="x", pady=4, padx=2)

        cb = tk.Checkbutton(card, variable=var, bg=CARD, activebackground=CARD,
                            command=self._update_summary)
        cb.pack(side="left", padx=(8, 4))

        if png:
            try:
                img = tk.PhotoImage(file=png)
                self._imgs.append(img)
                tk.Label(card, image=img, bg=CARD).pack(side="left", padx=6, pady=6)
            except Exception:
                tk.Label(card, text="(사진 없음)", bg=CARD, fg="#aaa",
                         width=26, height=6).pack(side="left", padx=6)
        else:
            tk.Label(card, text="(사진 없음)", bg=CARD, fg="#aaa",
                     width=26, height=6).pack(side="left", padx=6)

        info = tk.Frame(card, bg=CARD)
        info.pack(side="left", fill="both", expand=True, padx=10)
        tk.Label(info, text=f"#{idx}  {autocut.fmt(s)} ~ {autocut.fmt(e)}",
                 bg=CARD, fg="#222", font=("맑은 고딕", 12, "bold"),
                 anchor="w").pack(anchor="w", pady=(10, 2))
        tk.Label(info, text=f"무음 {e - s:.1f}초 구간 · 체크 = 잘라냄 / 체크 해제 = 남김",
                 bg=CARD, fg="#888", font=("맑은 고딕", 10),
                 anchor="w").pack(anchor="w")

        self.rows.append({"var": var, "start": s, "end": e})

    def _clear_rows(self):
        for w in self.list_frame.winfo_children():
            w.destroy()
        self.rows = []
        self._imgs = []

    def _update_summary(self):
        cuts = [(r["start"], r["end"]) for r in self.rows if r["var"].get()]
        total_cut = sum(e - s for s, e in cuts)
        self.summary_lbl.config(
            text=f"자를 곳 {len(cuts)}곳 · 예상 완성 길이 "
                 f"{autocut.fmt(self.duration - total_cut)}  (원본 {autocut.fmt(self.duration)})")

    # ── 완성 만들기 (백그라운드 실행) ──────────────────────
    def make_video(self):
        if self.busy or not self.video:
            return
        cuts = [(r["start"], r["end"]) for r in self.rows if r["var"].get()]
        base, _ = os.path.splitext(self.video)
        out = base + "_편집완성.mp4"
        if os.path.exists(out):
            if not messagebox.askyesno("확인", f"이미 있는 완성본을 다시 만들까요?\n{os.path.basename(out)}"):
                return
        self._set_busy(True)
        self.progress["value"] = 0
        self.status_lbl.config(text="만드는 중...")
        threading.Thread(target=self._make_worker, args=(cuts, out), daemon=True).start()

    def _make_worker(self, cuts, out):
        def prog(frac):
            self.root.after(0, self._set_progress, frac)
        try:
            out_path, dur, keep = autocut.build_from_cuts(
                self.video, cuts, out=out, duration=self.duration, progress=prog)
            self.root.after(0, self._make_done, out_path, keep)
        except Exception as ex:
            err = str(ex) if isinstance(ex, RuntimeError) else traceback.format_exc()
            self.root.after(0, self._make_failed, err)

    def _set_progress(self, frac):
        self.progress["value"] = frac * 100
        self.status_lbl.config(text=f"{int(frac * 100)}%")

    def _make_done(self, out_path, keep):
        self._set_busy(False)
        self.progress["value"] = 100
        self.status_lbl.config(text="완료!")
        if messagebox.askyesno("완성!",
                               f"완성 영상을 만들었습니다.\n\n{os.path.basename(out_path)}\n"
                               f"(완성 길이 {autocut.fmt(keep)})\n\n지금 폴더를 열어 확인할까요?"):
            self._open_folder(out_path)

    def _make_failed(self, err):
        self._set_busy(False)
        self.status_lbl.config(text="실패")
        messagebox.showerror("만들기 오류", "영상 만들기 중 문제가 생겼습니다.\n\n" + err[-800:])

    def _open_folder(self, path):
        folder = os.path.dirname(os.path.abspath(path))
        try:
            if sys.platform.startswith("win"):
                os.startfile(folder)  # noqa
            elif sys.platform == "darwin":
                import subprocess; subprocess.run(["open", folder])
            else:
                import subprocess; subprocess.run(["xdg-open", folder])
        except Exception:
            pass

    def _set_busy(self, busy):
        self.busy = busy
        state = "disabled" if busy else "normal"
        self.analyze_btn.config(state=state if self.video else "disabled")
        self.make_btn.config(state="disabled" if busy or not self.rows else "normal")


def _check_ffmpeg(root):
    import shutil
    missing = [t for t in ("ffmpeg", "ffprobe") if shutil.which(t) is None]
    if missing:
        messagebox.showerror(
            "설치 필요",
            "이 프로그램을 쓰려면 ffmpeg 가 필요합니다.\n"
            "설치 방법은 '사용법.md' 를 참고하세요.\n\n없는 항목: " + ", ".join(missing))
        root.destroy()
        return False
    return True


def main():
    root = tk.Tk()
    # 오류가 조용히 사라지지 않도록 처리
    def report_exc(exc, val, tb):
        messagebox.showerror("오류", "예상치 못한 문제가 생겼습니다.\n\n" +
                             "".join(traceback.format_exception(exc, val, tb))[-900:])
    root.report_callback_exception = report_exc

    if not _check_ffmpeg(root):
        return
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
