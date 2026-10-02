@echo off
echo Starting HR-Core and Calendar-Mgmt Development Servers...

start "HR-Core Backend (Port 8001)" cmd /k "cd /d %~dp0\hr-core\backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload"

start "HR-Core Frontend (Port 5173)" cmd /k "cd /d %~dp0\hr-core\frontend && npm run dev -- --port 5173"

start "Calendar Backend (Port 8002)" cmd /k "cd /d %~dp0\calendar-mgmt\backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload"

start "Calendar Frontend (Port 5174)" cmd /k "cd /d %~dp0\calendar-mgmt\frontend && npm run dev -- --port 5174"

echo.
echo ========================================================
echo All 4 services are starting up!
echo - HR Core Frontend:     http://localhost:5173
echo - HR Core Backend:      http://localhost:8001/docs
echo - Calendar Frontend:    http://localhost:5174
echo - Calendar Backend:     http://localhost:8002/docs
echo ========================================================
