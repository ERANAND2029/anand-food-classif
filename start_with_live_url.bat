@echo off
title Khana Classifier App + Live URL
echo ========================================================
echo   Starting Khana Classifier + Generating Live HTTPS URL
echo ========================================================
echo.
cd /d "%~dp0"
echo 1. Starting Python Backend Server...
start "" python app.py
timeout /t 3 /nobreak >nul
echo 2. Generating Live Internet URL (Localtunnel)...
npx --yes localtunnel --port 8000 --subdomain anand-food-ai
pause
