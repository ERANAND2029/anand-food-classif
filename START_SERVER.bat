@echo off
title Khana AI Server - Indian Food Classifier
color 0A

echo ================================================================
echo          KHANA / INDIAN FOOD CLASSIFIER (YOLO11 AI)
echo ================================================================
echo.
echo [*] Starting Python Backend with trained best.pt model...
echo.

cd /d "%~dp0"

:: 1. Start Python Backend in background window
start "Khana AI Server Backend" python app.py

:: Wait 2 seconds for server to be ready
timeout /t 2 /nobreak >nul

:: 2. Automatically launch browser
echo [✓] Opening Web App in Browser...
start http://127.0.0.1:8000

echo.
echo ================================================================
echo   [✓] Server is LIVE on: http://127.0.0.1:8000
echo   [✓] Photo Upload & Live Camera ready!
echo ================================================================
echo.
echo Is window ko khula rehne dein jab tak server chalana ho.
echo Server band karne ke liye is window ko close kar dein.
pause
