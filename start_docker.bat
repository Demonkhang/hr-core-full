@echo off
chcp 65001 >nul
echo ===================================================
echo   KHOI DONG HE THONG QUAN LY NHAN SU ^& LICH (DOCKER)
echo ===================================================
echo.
echo [Buoc 1/3] Kiem tra Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Docker Desktop chua duoc bat! Vui long mo Docker Desktop va doi bieu tuong ca voi xanh la cay.
    pause
    exit /b 1
)

echo [Buoc 2/3] Dang build va khoi chay 6 container (HR Core 5173 ^& Calendar 5174)...
set DOCKER_BUILDKIT=1
set COMPOSE_DOCKER_CLI_BUILD=1
docker compose up -d --build --force-recreate

if %errorlevel% neq 0 (
    echo [LOI] Qua trinh build Docker gap su co. Vui long kiem tra thong bao loi phia tren.
    pause
    exit /b 1
)

echo.
echo [Buoc 3/3] Kiem tra trang thai cac container:
docker compose ps

echo.
echo ===================================================
echo   HOAN TAT! HE THONG DA SAN SANG TAI:
echo   1. Phan mem Quan ly Nhan su (HR Core):     http://localhost:5173
echo   2. Phan mem Quan ly Lich truc (Calendar):  http://localhost:5174
echo   3. Tai khoan dang nhap mac dinh:           admin / admin123
echo ===================================================
pause

