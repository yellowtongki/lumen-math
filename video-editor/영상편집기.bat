@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"

rem 화면(GUI) 버전 실행. 검은 창 없이 프로그램 창만 뜬다.
where pythonw >nul 2>nul && ( start "" pythonw "%~dp0gui.py" & goto :eof )
where python  >nul 2>nul && ( start "" python  "%~dp0gui.py" & goto :eof )

echo.
echo   파이썬^(Python^)이 설치되어 있지 않습니다.
echo   사용법.md 의 '처음 한 번만 설치' 부분을 참고하세요.
echo.
pause
