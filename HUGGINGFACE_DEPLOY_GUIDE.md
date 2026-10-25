# 🤗 Hugging Face Spaces Deployment Guide

Aapka model aur frontend Hugging Face Spaces par 24/7 free live chalane ke liye poori tarah ready hai!

---

### Step 1: Hugging Face Par Account & Space Banao (1 minute)
1. Website par jao: **[huggingface.co](https://huggingface.co/)** (Agar account nahi hai to free signup kar lo).
2. Login hone ke baad upar right side me profile icon par click karo aur **"+ New Space"** choose karo:
   - **Space name**: `khana-detector` (ya koi bhi pasand ka naam)
   - **License**: `MIT`
   - **Select the Space SDK**: 👉 **Docker** select karna (Blank template)
   - **Space Hardware**: **CPU basic (Free)**
3. Neeche **"Create Space"** button daba do.

---

### Step 2: Files Upload Karna (2 options)

#### Option A: Direct Web UI se (Sabse Aasan - No Git required)
1. Apne naye bane Space me **"Files"** tab par jao.
2. **"Add file"** -> **"Upload files"** par click karo.
3. Hamare project folder se ye saari files upload kar do:
   - `app.py`
   - `Dockerfile`
   - `requirements.txt`
   - `.dockerignore`
   - `static/` (folder ke andar: `index.html`, `app.js`, `style.css`)
   - `models/best.pt` (jo Colab se download hua hai)
4. Neeche **"Commit changes to main"** par click kar do.

#### Option B: Git se Push Karna (Fastest for big files)
Apne terminal / PowerShell me chalao:
```bash
cd "C:\Users\Anand\.gemini\antigravity\scratch\khana_classifier_app"
git init
git add .
git commit -m "Deploy Khana AI to Hugging Face Spaces"
git remote add origin https://huggingface.co/spaces/<Aapka-Username>/khana-detector
git push -u origin main
```

---

### Step 3: Ho Gaya Live! 🎉
Hugging Face 1–2 minute me Docker container build karega aur upar status **"Running"** dikhega.

Aapko apna live permanent URL mil jayega:
👉 `https://<Aapka-Username>-khana-detector.hf.space`

Ise aap **mobile phone, tablet, laptop** kisi bhi device ke browser me khol kar camera aur photo se live food detection chala sakte ho!
