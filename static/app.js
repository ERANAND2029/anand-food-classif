// Khana Classifier Frontend JS

let currentImageBlob = null;
let webcamStream = null;
let webcamInterval = null;
let isPredictingFrame = false;
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsInterval = null;

// Initialize Lucide icons
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  checkModelStatus();
  setupEventListeners();
});

function switchTab(tabId) {
  // Update Tab buttons
  const tabs = ["photo", "live", "model"];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}-btn`);
    const sec = document.getElementById(`${t}-section`);
    if (t === tabId) {
      btn.classList.add("active", "text-white", "bg-orange-600", "shadow");
      btn.classList.remove("text-slate-400");
      sec.classList.remove("hidden");
      sec.classList.add("block");
    } else {
      btn.classList.remove("active", "text-white", "bg-orange-600", "shadow");
      btn.classList.add("text-slate-400");
      sec.classList.add("hidden");
      sec.classList.remove("block");
    }
  });

  // If leaving live camera tab, don't necessarily kill stream, but re-render icons
  if (window.lucide) lucide.createIcons();
}

// ----------------------------------------------------
// MODEL STATUS & BANNER
// ----------------------------------------------------
async function checkModelStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    updateModelUI(data.model);
  } catch (err) {
    console.error("Failed to fetch model status:", err);
  }
}

function updateModelUI(model) {
  const banner = document.getElementById("model-banner");
  const bannerTitle = document.getElementById("banner-title");
  const bannerDesc = document.getElementById("banner-desc");
  const pillBadge = document.getElementById("model-pill-badge");
  const infoModelName = document.getElementById("info-model-name");
  const infoStatus = document.getElementById("info-model-status");
  const infoClasses = document.getElementById("info-total-classes");

  if (model.loaded && model.type === "custom") {
    // Custom trained model is active!
    banner.className = "rounded-xl p-3.5 flex items-center justify-between border bg-emerald-950/40 border-emerald-500/40 text-emerald-200";
    bannerTitle.textContent = "Trained Model Active:";
    bannerTitle.className = "font-semibold text-emerald-300";
    bannerDesc.textContent = ` '${model.name}' loaded successfully with ${model.total_classes} classes! Ready for inference.`;
    pillBadge.className = "w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400";

    infoModelName.textContent = model.name;
    infoStatus.textContent = "Active Custom YOLO11 Model";
    infoStatus.className = "inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/30";
    infoClasses.textContent = `${model.total_classes} Classes`;
  } else {
    // Standby Mode
    banner.className = "rounded-xl p-3.5 flex items-center justify-between border bg-amber-950/40 border-amber-500/30 text-amber-200";
    bannerTitle.textContent = "Model Standby Mode:";
    bannerTitle.className = "font-semibold text-amber-300";
    bannerDesc.textContent = " Colab training chal rahi hai. Model khatam hone ke baad 'best.pt' yahan attach ho jayega. Standby test ready hai!";
    pillBadge.className = "w-2 h-2 rounded-full bg-amber-400 animate-pulse";

    infoModelName.textContent = "Waiting for best.pt";
    infoStatus.textContent = "Standby Demo Mode (80 Khana Classes)";
    infoStatus.className = "inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-500/30";
    infoClasses.textContent = "80 Khana Classes Ready";
  }
}

async function refreshModelStatus() {
  try {
    const res = await fetch("/api/reload-model", { method: "POST" });
    const data = await res.json();
    updateModelUI(data.model_info);
    alert(data.success ? "Model reloaded successfully!" : "No custom best.pt found in models folder yet. Running standby mode.");
  } catch (err) {
    alert("Error reloading model: " + err.message);
  }
}

// ----------------------------------------------------
// PHOTO UPLOAD & INFERENCE
// ----------------------------------------------------
function setupEventListeners() {
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");

  // Drop zone clicks
  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelected(e.target.files[0]);
    }
  });

  // Drag & drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-orange-500", "bg-orange-500/5");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-orange-500", "bg-orange-500/5");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-orange-500", "bg-orange-500/5");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelected(e.dataTransfer.files[0]);
    }
  });

  // Paste image from clipboard
  window.addEventListener("paste", (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const blob = item.getAsFile();
        handleImageSelected(blob);
        switchTab("photo");
        break;
      }
    }
  });

  // Model file upload drag & drop
  setupModelUploadListeners();
}

function handleImageSelected(file) {
  if (!file.type.startsWith("image/")) {
    alert("Kripya ek valid photo chunein (JPG, PNG, WEBP).");
    return;
  }
  currentImageBlob = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById("image-preview");
    preview.src = e.target.result;
    document.getElementById("drop-prompt").classList.add("hidden");
    document.getElementById("preview-container").classList.remove("hidden");
    document.getElementById("predict-btn").disabled = false;
    
    // Auto-predict on selection for smooth UX
    runImagePrediction();
  };
  reader.readAsDataURL(file);
}

function clearPhoto(e) {
  if (e) e.stopPropagation();
  currentImageBlob = null;
  document.getElementById("file-input").value = "";
  document.getElementById("image-preview").src = "";
  document.getElementById("drop-prompt").classList.remove("hidden");
  document.getElementById("preview-container").classList.add("hidden");
  document.getElementById("predict-btn").disabled = true;

  // Reset results panel
  document.getElementById("results-empty").classList.remove("hidden");
  document.getElementById("results-loading").classList.add("hidden");
  document.getElementById("results-display").classList.add("hidden");
  document.getElementById("latency-badge").classList.add("hidden");
}

async function runImagePrediction() {
  if (!currentImageBlob) return;

  const emptyState = document.getElementById("results-empty");
  const loadingState = document.getElementById("results-loading");
  const displayState = document.getElementById("results-display");
  const predictBtn = document.getElementById("predict-btn");

  emptyState.classList.add("hidden");
  displayState.classList.add("hidden");
  loadingState.classList.remove("hidden");
  predictBtn.disabled = true;

  const formData = new FormData();
  formData.append("file", currentImageBlob, "upload.jpg");

  try {
    const res = await fetch("/api/predict-image", {
      method: "POST",
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      renderResults(data);
    } else {
      alert("Prediction error: " + (data.detail || "Unknown error"));
      emptyState.classList.remove("hidden");
    }
  } catch (err) {
    alert("Network error while connecting to server: " + err.message);
    emptyState.classList.remove("hidden");
  } finally {
    loadingState.classList.add("hidden");
    predictBtn.disabled = false;
  }
}

function renderResults(data) {
  const displayState = document.getElementById("results-display");
  const latencyBadge = document.getElementById("latency-badge");
  const latencyVal = document.getElementById("latency-val");

  // Latency
  latencyVal.textContent = data.latency_ms;
  latencyBadge.classList.remove("hidden");

  // Top 1
  document.getElementById("top1-dish-name").textContent = data.top1.dish;
  document.getElementById("top1-class-id").textContent = `class: ${data.top1.raw_class}`;
  document.getElementById("top1-confidence").textContent = `${data.top1.confidence}%`;

  // Top 5
  const top5Container = document.getElementById("top5-list");
  top5Container.innerHTML = "";

  data.predictions.forEach((item, index) => {
    const isTop = index === 0;
    const barWidth = Math.max(item.confidence, 4); // minimum visible width
    const colorClass = isTop ? "bg-orange-500" : (index === 1 ? "bg-amber-500" : "bg-slate-600");

    const row = document.createElement("div");
    row.className = "bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80";
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs mb-1.5">
        <span class="font-medium ${isTop ? 'text-orange-300 font-bold' : 'text-slate-300'} flex items-center gap-1.5">
          <span class="text-[10px] text-slate-500 font-mono">#${index + 1}</span>
          ${item.dish}
        </span>
        <span class="font-mono ${isTop ? 'text-amber-400 font-bold' : 'text-slate-400'}">${item.confidence}%</span>
      </div>
      <div class="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
        <div class="${colorClass} h-2 rounded-full prob-bar" style="width: ${barWidth}%"></div>
      </div>
    `;
    top5Container.appendChild(row);
  });

  displayState.classList.remove("hidden");
}

// Quick Sample Generator for Instant Testing
function loadSampleImage(dishType) {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");

  // Draw simulated dish graphic on canvas
  const gradients = {
    biryani: ["#ca8a04", "#ea580c", "Biryani 🍚"],
    samosa: ["#d97706", "#78350f", "Samosa 🥟"],
    paneer: ["#f97316", "#991b1b", "Paneer Tikka 🧀"],
    gulab_jamun: ["#451a03", "#78350f", "Gulab Jamun 🟤"]
  };

  const [c1, c2, label] = gradients[dishType] || ["#ea580c", "#7c2d12", "Indian Dish"];
  const grad = ctx.createRadialGradient(200, 200, 50, 200, 200, 200);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 400);

  // Decorative plate circle
  ctx.beginPath();
  ctx.arc(200, 200, 150, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(label, 200, 205);

  canvas.toBlob((blob) => {
    handleImageSelected(blob);
  }, "image/jpeg");
}

// ----------------------------------------------------
// LIVE CAMERA / WEBCAM LOGIC
// ----------------------------------------------------
async function toggleWebcam() {
  const video = document.getElementById("webcam-video");
  const placeholder = document.getElementById("camera-off-placeholder");
  const toggleBtn = document.getElementById("cam-toggle-btn");
  const liveIndicator = document.getElementById("live-indicator");
  const liveHud = document.getElementById("live-hud-banner");
  const snapBtn = document.getElementById("capture-single-btn");

  if (webcamStream) {
    // Stop camera
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
    if (webcamInterval) clearInterval(webcamInterval);
    if (fpsInterval) clearInterval(fpsInterval);

    video.classList.add("hidden");
    placeholder.classList.remove("hidden");
    liveIndicator.classList.add("hidden");
    liveIndicator.classList.remove("flex");
    liveHud.classList.add("hidden");
    snapBtn.disabled = true;

    toggleBtn.innerHTML = `<i data-lucide="power" class="w-3.5 h-3.5"></i> Start Camera`;
    toggleBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow";
    if (window.lucide) lucide.createIcons();
  } else {
    // Start camera
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "environment" }
      });
      video.srcObject = webcamStream;
      video.classList.remove("hidden");
      placeholder.classList.add("hidden");
      liveIndicator.classList.remove("hidden");
      liveIndicator.classList.add("flex");
      liveHud.classList.remove("hidden");
      snapBtn.disabled = false;

      toggleBtn.innerHTML = `<i data-lucide="square" class="w-3.5 h-3.5"></i> Stop Camera`;
      toggleBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 shadow";
      if (window.lucide) lucide.createIcons();

      // Start FPS counter
      startFpsCounter();

      // Start periodic prediction if auto-toggle checked
      webcamInterval = setInterval(() => {
        const autoCheck = document.getElementById("auto-predict-toggle");
        if (autoCheck && autoCheck.checked) {
          captureAndClassifyFrame();
        }
      }, 350); // ~3 FPS

    } catch (err) {
      alert("Camera access denied ya camera nahi mila: " + err.message);
    }
  }
}

function startFpsCounter() {
  const fpsDisplay = document.getElementById("live-fps");
  frameCount = 0;
  fpsInterval = setInterval(() => {
    fpsDisplay.textContent = `${frameCount * 2} FPS`;
    frameCount = 0;
  }, 500);
}

async function captureAndClassifyFrame() {
  if (!webcamStream || isPredictingFrame) return;

  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("capture-canvas");
  if (!video.videoWidth) return;

  isPredictingFrame = true;
  canvas.width = 256; // scaled for rapid networking
  canvas.height = 256 * (video.videoHeight / video.videoWidth);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const base64Data = canvas.toDataURL("image/jpeg", 0.7);

  try {
    const res = await fetch("/api/predict-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Data })
    });
    const data = await res.json();
    if (data.success) {
      frameCount++;
      updateLiveHUD(data);
    }
  } catch (err) {
    console.error("Frame inference error:", err);
  } finally {
    isPredictingFrame = false;
  }
}

function updateLiveHUD(data) {
  const hudDish = document.getElementById("hud-dish-name");
  const hudConf = document.getElementById("hud-confidence");

  hudDish.textContent = data.top1.dish;
  hudConf.textContent = `${data.top1.confidence}%`;

  // Update Live Top 5 sidebar
  const liveList = document.getElementById("live-top5-list");
  liveList.innerHTML = "";

  data.predictions.forEach((item, index) => {
    const isTop = index === 0;
    const barWidth = Math.max(item.confidence, 4);
    const colorClass = isTop ? "bg-orange-500" : (index === 1 ? "bg-amber-500" : "bg-slate-600");

    const row = document.createElement("div");
    row.className = "bg-slate-950/50 p-2 rounded-xl border border-slate-800/80";
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="font-medium ${isTop ? 'text-orange-300 font-bold' : 'text-slate-300'}">
          ${item.dish}
        </span>
        <span class="font-mono text-xs ${isTop ? 'text-amber-400 font-bold' : 'text-slate-400'}">${item.confidence}%</span>
      </div>
      <div class="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
        <div class="${colorClass} h-1.5 rounded-full prob-bar" style="width: ${barWidth}%"></div>
      </div>
    `;
    liveList.appendChild(row);
  });
}

// ----------------------------------------------------
// MODEL ATTACH & DRAG-AND-DROP UPLOAD
// ----------------------------------------------------
function setupModelUploadListeners() {
  const dropZone = document.getElementById("model-drop-zone");
  const fileInput = document.getElementById("model-file-input");

  dropZone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      uploadModelFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("border-orange-500", "bg-orange-500/5");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("border-orange-500", "bg-orange-500/5");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("border-orange-500", "bg-orange-500/5");
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadModelFile(e.dataTransfer.files[0]);
    }
  });
}

function uploadModelFile(file) {
  if (!file.name.endsWith(".pt")) {
    alert("Kripya PyTorch model (.pt) file chunein (jaise best.pt).");
    return;
  }

  const container = document.getElementById("upload-progress-container");
  const progressBar = document.getElementById("upload-progress-bar");
  const percentText = document.getElementById("upload-percent");
  const statusText = document.getElementById("upload-status-text");

  container.classList.remove("hidden");
  progressBar.style.width = "0%";
  percentText.textContent = "0%";
  statusText.textContent = `Uploading ${file.name}...`;

  const formData = new FormData();
  formData.append("file", file, file.name);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload-model", true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      progressBar.style.width = percent + "%";
      percentText.textContent = percent + "%";
    }
  };

  xhr.onload = () => {
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      statusText.textContent = "✓ Model uploaded and activated successfully!";
      progressBar.className = "bg-emerald-500 h-2 rounded-full";
      updateModelUI(data.model_info);
      setTimeout(() => {
        alert("🎉 Badhai ho! Aapka trained model successfully attach ho gaya hai!");
        switchTab("photo");
      }, 500);
    } else {
      statusText.textContent = "Upload failed: " + xhr.statusText;
      progressBar.className = "bg-red-500 h-2 rounded-full";
    }
  };

  xhr.onerror = () => {
    statusText.textContent = "Network error during upload.";
    progressBar.className = "bg-red-500 h-2 rounded-full";
  };

  xhr.send(formData);
}
