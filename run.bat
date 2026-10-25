@echo off
title Khana Indian Food Classifier App
echo ========================================================
echo   Starting Khana Classifier (YOLO11 Indian Food AI)
echo ========================================================
echo.
cd /d "%~dp0"
echo Opening server at http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
python app.py
pause
