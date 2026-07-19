@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo   [사용법] 편집할 영상 파일을 이 '1_분석' 아이콘 위로
  echo            마우스로 끌어다 놓으세요 ^(드래그 앤 드롭^).
  echo.
  pause
  exit /b
)

where py >nul 2>nul && (set PY=py) || (set PY=python)
%PY% --version >nul 2>nul || (
  echo.
  echo   [알림] 파이썬^(Python^)이 설치되어 있지 않습니다.
  echo          사용법.md 의 '처음 한 번만 설치' 부분을 참고하세요.
  echo.
  pause
  exit /b
)

%PY% "%~dp0autocut.py" analyze "%~1"

rem 자를 목록 파일을 자동으로 열어 확인
if exist "%~dpn1_컷목록.txt" start "" notepad "%~dpn1_컷목록.txt"

echo.
echo   목록을 확인/수정한 뒤 저장하고, 이 영상을 '2_영상만들기' 위로 끌어다 놓으세요.
echo.
pause
