@echo off
cd /d "%~dp0"
REM Install root deps (backend/server.js uses root node_modules when run from here)
call npm install
REM Free port 3080 so the new backend (with GET / -> index.html) is the one that binds
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3080 ^| findstr LISTENING') do taskkill /PID %%a /F 2>nul
timeout /t 1 /nobreak >nul
start /B node backend\server.js
timeout /t 2 /nobreak >nul
start "" http://localhost:3080
echo App and API: http://localhost:3080 (same origin - session works)
