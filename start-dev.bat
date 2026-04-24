@echo off
title RETRO Dev

echo ==========================================
echo  RETRO — Starting Development Environment
echo ==========================================
echo.

REM Check Python gateway dependencies
echo [1/3] Checking Python gateway...
cd /d %~dp0
python -c "import fastapi, uvicorn" 2>nul
if errorlevel 1 (
    echo Installing gateway dependencies...
    pip install fastapi uvicorn[standard] --quiet
)

REM Start Python gateway in new window
echo [2/3] Starting Python Gateway on port 8000...
start "RETRO Gateway :8000" cmd /k "cd /d %~dp0 && python -m uvicorn services.gateway.main:app --port 8000 --reload"

REM Wait for gateway to start
echo     Waiting for gateway...
timeout /t 4 /nobreak >nul

REM Check if gateway is up
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo     Gateway might still be starting, continuing...
) else (
    echo     Gateway OK!
)

REM Start TypeScript backend in new window
echo [3/3] Starting TypeScript Backend on port 3001...
start "RETRO Backend :3001" cmd /k "cd /d %~dp0\backend && npm run dev"

REM Wait for backend to start
timeout /t 3 /nobreak >nul

REM Start React+Vite frontend in new window
echo [4/4] Starting Frontend on port 5173...
start "RETRO Frontend :5173" cmd /k "cd /d %~dp0\frontend && npm run dev"

REM Start Docs server
echo [5/5] Starting Docs on port 1234...
start "RETRO Docs :1234" cmd /k "cd /d %~dp0\docs && python -m http.server 1234"

echo.
echo ==========================================
echo  All services started:
echo    Python Gateway  -^> http://localhost:8000
echo    TS Backend      -^> http://localhost:3001
echo    Frontend        -^> http://localhost:5173
echo    Docs            -^> http://localhost:1234
echo ==========================================
echo.
pause
