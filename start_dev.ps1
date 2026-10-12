Write-Host "Starting HR-Core and Calendar-Mgmt Development Servers..." -ForegroundColor Green

# Clean up any leftover processes using dev ports if stuck
$ports = @(8001, 8002)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($conn in $conns) {
            if ($conn.OwningProcess -gt 0) {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

$rootDir = $PSScriptRoot

Start-Process cmd -ArgumentList "/k cd /d `"$rootDir\hr-core\backend`" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload" -WindowStyle Normal
Start-Process cmd -ArgumentList "/k cd /d `"$rootDir\hr-core\frontend`" && npm run dev -- --port 5173" -WindowStyle Normal
Start-Process cmd -ArgumentList "/k cd /d `"$rootDir\calendar-mgmt\backend`" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload" -WindowStyle Normal
Start-Process cmd -ArgumentList "/k cd /d `"$rootDir\calendar-mgmt\frontend`" && npm run dev -- --port 5174" -WindowStyle Normal

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "All 4 services are starting up!" -ForegroundColor Yellow
Write-Host " - HR Core Frontend:     http://localhost:5173"
Write-Host " - HR Core Backend:      http://localhost:8001/docs"
Write-Host " - Calendar Frontend:    http://localhost:5174"
Write-Host " - Calendar Backend:     http://localhost:8002/docs"
Write-Host "========================================================`n" -ForegroundColor Cyan
