@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo   [사용법] '1_분석'을 끝낸 그 영상 파일을 이 '2_영상만들기'
  echo            아이콘 위로 마우스로 끌어다 놓으세요.
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

%PY% "%~dp0autocut.py" build "%~1"

echo.
pause
