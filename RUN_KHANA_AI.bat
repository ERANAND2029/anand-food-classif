@echo off
title Khana AI - YOLO Bounding Box Live Server
color 0B

echo ================================================================
echo      KHANA / INDIAN FOOD CLASSIFIER ^& BOUNDING BOX DETECTOR
echo ================================================================
echo.
echo [*] Loading 80 Indian Food Classes + YOLO Bounding Box Engine...
echo [*] Directory: %~dp0
echo.

cd /d "%~dp0"

:: 1. Start Python Server in background
start "Khana-AI-Backend" python app.py

:: 2. Wait 2 seconds for server initialization
echo [*] Waiting for server to initialize...
timeout /t 2 /nobreak >nul

:: 3. Open Browser to local application
echo [✓] Server Started Successfully!
echo [✓] Opening Web App: http://127.0.0.1:8000
start http://127.0.0.1:8000

echo.
echo ================================================================
echo   Status: RUNNING
echo   Local URL: http://127.0.0.1:8000
echo   Features : Live Camera Bounding Boxes + Photo Detection
echo ================================================================
echo.
echo Press [L] and Enter if you want an instant HTTPS Live URL for your Mobile Camera.
echo Otherwise, keep this window open while using the app.
echo.

set /p user_choice="Enter 'L' for Mobile Live Link (or press Enter to exit this runner): "
if /i "%user_choice%"=="L" (
    echo.
    echo [*] Generating HTTPS Live Mobile Link via Localtunnel...
    npx --yes localtunnel --port 8000 --subdomain anand-food-ai
)

pause
