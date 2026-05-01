@echo off
setlocal
echo ---------------------------------------------------
echo 🚀 Starting SafeCity-Connect Environment...
echo ---------------------------------------------------

:: Check for Docker
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH.
    echo Please install Docker Desktop to continue.
    pause
    exit /b 1
)

echo 📦 Building and launching containers...
docker-compose up -d --build

if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose failed to start.
    pause
    exit /b 1
)

echo ⏳ Waiting for services to stabilize (10s)...
timeout /t 10 /nobreak >nul

echo.
echo ✅ SafeCity-Connect is UP!
echo ---------------------------------------------------
echo Frontend:      http://localhost:4200
echo Keycloak:      http://localhost:8080
echo Backend API:   http://localhost:8081
echo ---------------------------------------------------
echo Log in as 'citizen1' / 'citizen123' to start reporting.
echo.
pause
