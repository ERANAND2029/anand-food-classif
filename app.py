import os
import io
import time
import base64
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np

# Try importing ultralytics
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app = FastAPI(title="Khana / Indian Food Classifier", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state
current_model = None
model_source_info = {
    "loaded": False,
    "path": None,
    "name": "None",
    "type": "none",
    "total_classes": 0,
    "classes": []
}

# 80 Common Indian Food / Khana categories for standby/mock fallback preview
MOCK_80_KHANA_CLASSES = [
    "aloo_gobi", "aloo_matar", "aloo_methi", "aloo_paratha", "aloo_shimla_mirch", "aloo_tikki",
    "anarsa", "bandar_laddu", "basundi", "bhatura", "bhindi_masala", "biryani", "boondi",
    "butter_chicken", "chak_hao_kheer", "cham_cham", "chana_masala", "chapati", "chhena_gaja",
    "chhena_poda", "chicken_razala", "chicken_tikka", "chicken_tikka_masala", "chikki", "daal_baati_churma",
    "daal_puri", "dal_makhani", "dal_tadka", "dharwad_pedha", "dhokla", "dosa", "double_ka_meetha",
    "dum_aloo", "gajar_ka_halwa", "ghevar", "gulab_jamun", "imarti", "jalebi", "kachori",
    "kadai_paneer", "kalakand", "karela_bhaji", "kathi_roll", "kheer", "khichdi", "kaju_katli",
    "kofta", "kuzhi_paniyaram", "lassi", "ledikeni", "malapua", "makki_di_roti_sarson_da_saag",
    "modak", "mysore_pak", "naan", "navratan_korma", "palak_paneer", "paneer_butter_masala",
    "paneer_tikka", "pani_puri", "papadum", "pav_bhaji", "peda", "phirni", "poha", "poori",
    "rabri", "rasgulla", "rasmalai", "rogan_josh", "samosa", "sandesh", "sev_tameta", "sheera",
    "shrikhand", "sohan_halwa", "sohan_papdi", "upma", "vada_pav", "unni_appam"
]

def find_best_model_path() -> Optional[str]:
    candidate_paths = [
        os.path.join(MODELS_DIR, "best.pt"),
        os.path.join(BASE_DIR, "best.pt"),
        os.path.join(MODELS_DIR, "yolo11s-cls.pt"),
        os.path.join(BASE_DIR, "yolo11s-cls.pt")
    ]
    for path in candidate_paths:
        if os.path.isfile(path):
            return path
    return None

def load_food_model(custom_path: Optional[str] = None):
    global current_model, model_source_info
    target_path = custom_path or find_best_model_path()

    if target_path and os.path.isfile(target_path) and ULTRALYTICS_AVAILABLE:
        try:
            print(f"[*] Loading model from {target_path}...")
            model = YOLO(target_path)
            names = getattr(model, "names", {})
            class_list = list(names.values()) if isinstance(names, dict) else list(names)
            current_model = model
            model_source_info = {
                "loaded": True,
                "path": target_path,
                "name": os.path.basename(target_path),
                "type": "custom" if "best" in os.path.basename(target_path).lower() else "pretrained",
                "total_classes": len(class_list),
                "classes": class_list[:10]  # preview
            }
            print(f"[✓] Model loaded successfully: {model_source_info['name']} ({len(class_list)} classes)")
            return True
        except Exception as e:
            print(f"[!] Error loading YOLO model from {target_path}: {e}")

    # Fallback/Standby mode
    current_model = None
    model_source_info = {
        "loaded": False,
        "path": None,
        "name": "Standby Mode (Waiting for best.pt)",
        "type": "standby",
        "total_classes": len(MOCK_80_KHANA_CLASSES),
        "classes": MOCK_80_KHANA_CLASSES[:10]
    }
    print("[i] Model running in Standby Mode until trained best.pt is provided.")
    return False

# Initialize model at startup
load_food_model()

def format_dish_name(name: str) -> str:
    cleaned = name.replace("_", " ").replace("-", " ")
    return " ".join(word.capitalize() for word in cleaned.split())

def predict_on_pil_image(image: Image.Image) -> Dict[str, Any]:
    start_time = time.time()
    
    # If custom YOLO model is loaded
    if current_model is not None:
        # Convert PIL Image to RGB
        if image.mode != "RGB":
            image = image.convert("RGB")
        
        results = current_model(image, verbose=False)
        first_res = results[0]
        probs = first_res.probs

        # Top 1
        top1_idx = int(probs.top1)
        top1_conf = float(probs.top1conf)
        top1_raw_name = first_res.names[top1_idx]

        # Top 5
        predictions = []
        top5_indices = probs.top5 if hasattr(probs, 'top5') else [top1_idx]
        top5_confs = probs.top5conf if hasattr(probs, 'top5conf') else [top1_conf]

        for idx, conf in zip(top5_indices, top5_confs):
            raw_name = first_res.names[int(idx)]
            predictions.append({
                "dish": format_dish_name(raw_name),
                "raw_class": raw_name,
                "confidence": round(float(conf) * 100, 2),
                "score": float(conf)
            })

        latency = round((time.time() - start_time) * 1000, 1)
        return {
            "top1": {
                "dish": format_dish_name(top1_raw_name),
                "raw_class": top1_raw_name,
                "confidence": round(top1_conf * 100, 2)
            },
            "predictions": predictions,
            "latency_ms": latency,
            "is_standby": False,
            "model_name": model_source_info["name"]
        }

    # Standby / Demo prediction when model is still training
    latency = round((time.time() - start_time) * 1000, 1)
    
    # Generate deterministic pseudo predictions based on image color/hash for smooth testing
    img_arr = np.array(image.resize((32, 32)))
    seed_val = int(img_arr.mean() * 1000) % len(MOCK_80_KHANA_CLASSES)
    
    selected_indices = [(seed_val + i * 7) % len(MOCK_80_KHANA_CLASSES) for i in range(5)]
    mock_confs = [0.84, 0.08, 0.04, 0.02, 0.01]
    
    predictions = []
    for i, idx in enumerate(selected_indices):
        raw_name = MOCK_80_KHANA_CLASSES[idx]
        conf = mock_confs[i]
        predictions.append({
            "dish": format_dish_name(raw_name),
            "raw_class": raw_name,
            "confidence": round(conf * 100, 2),
            "score": conf
        })

    return {
        "top1": predictions[0],
        "predictions": predictions,
        "latency_ms": latency,
        "is_standby": True,
        "model_name": "Standby Demo Mode (Attach best.pt to use your trained weights)"
    }

@app.get("/api/status")
def get_status():
    return {
        "status": "ready",
        "model": model_source_info,
        "ultralytics_available": ULTRALYTICS_AVAILABLE
    }

@app.post("/api/predict-image")
async def predict_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        output = predict_on_pil_image(image)
        return JSONResponse(content={"success": True, **output})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Image prediction failed: {str(e)}")

@app.post("/api/predict-frame")
async def predict_frame(data: Dict[str, str]):
    """Receives base64 encoded video frame from webcam"""
    try:
        image_data = data.get("image", "")
        if "," in image_data:
            image_data = image_data.split(",")[1]
        decoded = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(decoded))
        output = predict_on_pil_image(image)
        return JSONResponse(content={"success": True, **output})
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Frame prediction failed: {str(e)}")

@app.post("/api/upload-model")
async def upload_model(file: UploadFile = File(...)):
    """Allows uploading best.pt directly from web UI without touching files"""
    try:
        dest_path = os.path.join(MODELS_DIR, file.filename)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        
        # If uploaded file is best.pt or ends with .pt, reload model
        success = load_food_model(dest_path)
        return {
            "success": success,
            "filename": file.filename,
            "message": "Model loaded successfully!" if success else "File saved, but failed to initialize YOLO.",
            "model_info": model_source_info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model upload failed: {str(e)}")

@app.post("/api/reload-model")
def reload_model_endpoint():
    success = load_food_model()
    return {
        "success": success,
        "model_info": model_source_info
    }

# Mount static folder
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
