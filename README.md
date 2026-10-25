# 🍲 Khana / Indian Food Classifier Web App

YOLO11s-cls based Indian Food Classification & Live Webcam Recognition App (80 Classes).

## 🚀 Kaise Chalayein (How to Run)

### Option 1: One-Click Run (Windows)
Project folder me `run.bat` par double-click karein:
```cmd
run.bat
```
Browser me automatically `http://127.0.0.1:8000` khul jayega!

### Option 2: Terminal / Command Prompt
```bash
cd "C:\Users\Anand\.gemini\antigravity\scratch\khana_classifier_app"
python app.py
```
Iske baad browser me kholein: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🎯 Features
1. **Photo Upload & Instant Test**:
   - Drag & Drop photo, file select karein ya clipboard se seedha paste (`Ctrl + V`) karein.
   - Top-1 Predicted Dish, Badge, Confidence percentage aur Top-5 probabilities progress bars ke sath dikhti hain.
   - Inference Latency (ms) real-time display.

2. **Live Camera / Webcam Feed**:
   - Live camera switch on karein.
   - Real-time video par Heads-Up Display (HUD) overlay banner chalta hai jo continuous live prediction dikhata hai (~3 FPS).
   - "Snap Single Frame" button se kisi bhi waqt single frame test kar sakte hain.

3. **Seamless Model Attachment (Colab se best.pt)**:
   - **Method A (Web UI)**: Web application ke **"Model Status"** tab par jaakar Colab se downloaded `best.pt` ko seedha drag & drop karke upload kar do. Server restart kiye bina model turant switch ho jayega!
   - **Method B (Direct File)**: `best.pt` ko project ke `models/best.pt` folder me rakh dein aur "Refresh / Check Folder" dabayein.
   - **Standby Mode**: Jab tak Colab training complete nahi hoti, app Standby Demo Mode me chalta rahega taaki aap UI pehle hi test kar sakein.

---

## 📁 Directory Structure
```
khana_classifier_app/
├── app.py                  # FastAPI Backend API & YOLO Inference Engine
├── run.bat                 # One-click startup script for Windows
├── requirements.txt        # Python dependencies
├── README.md               # User guide
├── models/                 # Colab se aane wali best.pt yahan save hogi
└── static/
    ├── index.html          # Responsive Dark/Saffron Food UI
    ├── app.js              # Webcam streaming, frame grabber, API caller
    └── style.css           # Styling & animations
```
