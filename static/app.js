// Khana Classifier Frontend JS

let currentImageBlob = null;
let webcamStream = null;
let webcamInterval = null;
let isPredictingFrame = false;
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsInterval = null;

// Multi-camera & External USB Camera Support
let availableCameras = [];
let currentCameraIndex = 0;
let activeDeviceId = null;

// Initialize Lucide icons
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  checkModelStatus();
  setupEventListeners();
  loadAvailableCameras();

  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      loadAvailableCameras();
    });
  }
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
  const photoCanvas = document.getElementById("photo-box-canvas");
  if (photoCanvas) {
    const ctx = photoCanvas.getContext("2d");
    ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
  }
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

// ----------------------------------------------------
// REAL-TIME YOLO BOUNDING BOX DRAWING ENGINE
// ----------------------------------------------------
function drawFoodBoxes(canvas, boxes, w, h) {
  if (!canvas || !w || !h) return;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  if (!boxes || boxes.length === 0) return;

  const colorThemes = [
    { stroke: "#22c55e", glow: "rgba(34, 197, 94, 0.4)", fill: "rgba(34, 197, 94, 0.12)", badge: "#15803d" },  // Cyber Green
    { stroke: "#f97316", glow: "rgba(249, 115, 22, 0.4)", fill: "rgba(249, 115, 22, 0.14)", badge: "#c2410c" },  // Saffron
    { stroke: "#06b6d4", glow: "rgba(6, 182, 212, 0.4)", fill: "rgba(6, 182, 212, 0.12)", badge: "#0e7490" },  // Cyan
    { stroke: "#eab308", glow: "rgba(234, 179, 8, 0.4)", fill: "rgba(234, 179, 8, 0.12)", badge: "#a16207" }   // Amber
  ];

  boxes.forEach((box, i) => {
    const col = colorThemes[i % colorThemes.length];
    const bx = Math.round(box.x * w);
    const by = Math.round(box.y * h);
    const bw = Math.round(box.w * w);
    const bh = Math.round(box.h * h);

    // 1. Semi-transparent box highlight
    ctx.fillStyle = col.fill;
    ctx.fillRect(bx, by, bw, bh);

    // 2. Bounding rectangle with glowing border
    ctx.save();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = col.glow;
    ctx.shadowBlur = 8;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();

    // 3. Cyber Corner Brackets ┌ ┐ └ ┘
    const corner = Math.min(20, Math.floor(bw * 0.22), Math.floor(bh * 0.22));
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    // Top-left
    ctx.beginPath();
    ctx.moveTo(bx, by + corner); ctx.lineTo(bx, by); ctx.lineTo(bx + corner, by);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + corner);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(bx, by + bh - corner); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + corner, by + bh);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(bx + bw - corner, by + bh); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw, by + bh - corner);
    ctx.stroke();

    // 4. Header Badge on top of rectangle
    const labelText = `🍛 ${box.label.toUpperCase()} ${box.confidence}%`;
    ctx.font = "bold 13px system-ui, -apple-system, sans-serif";
    const textMetrics = ctx.measureText(labelText);
    const badgeW = textMetrics.width + 18;
    const badgeH = 26;
    const badgeY = Math.max(0, by - badgeH);

    // Badge Background
    ctx.fillStyle = col.badge;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, badgeY, badgeW, badgeH, [6, 6, 0, 0]);
    } else {
      ctx.rect(bx, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    // Badge Border
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Badge Text
    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, bx + 9, badgeY + 17);
  });
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

  // Draw bounding boxes on photo
  const previewImg = document.getElementById("image-preview");
  const photoCanvas = document.getElementById("photo-box-canvas");
  if (data.boxes && photoCanvas && previewImg) {
    // Wait for image dimensions to be available
    setTimeout(() => {
      drawFoodBoxes(photoCanvas, data.boxes, previewImg.clientWidth, previewImg.clientHeight);
    }, 50);
  }
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
// ----------------------------------------------------
// MULTI-CAMERA & EXTERNAL WEBCAM DETECTOR
// ----------------------------------------------------
async function loadAvailableCameras() {
  const select = document.getElementById("camera-select");
  if (!select) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    select.innerHTML = '<option value="">Camera API not supported</option>';
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    availableCameras = devices.filter(d => d.kind === "videoinput");

    select.innerHTML = "";

    if (availableCameras.length === 0) {
      select.innerHTML = '<option value="">No Camera Detected</option>';
      return;
    }

    const savedId = localStorage.getItem("preferred_camera_id");

    availableCameras.forEach((cam, idx) => {
      const opt = document.createElement("option");
      opt.value = cam.deviceId;
      
      let name = cam.label || `Camera ${idx + 1}`;
      const lower = name.toLowerCase();
      if (lower.includes("usb") || lower.includes("external") || lower.includes("webcam")) {
        name = `📷 ${name} (USB/External)`;
      } else if (lower.includes("integrated") || lower.includes("built-in") || lower.includes("internal")) {
        name = `📷 ${name} (Laptop Built-in)`;
      } else if (idx > 0) {
        name = `📷 ${name} (Camera ${idx + 1})`;
      } else {
        name = `📷 ${name}`;
      }
      
      opt.textContent = name;
      if (savedId && cam.deviceId === savedId) {
        opt.selected = true;
        currentCameraIndex = idx;
      }
      select.appendChild(opt);
    });

    // If external USB webcam is detected and no saved preference yet, auto-select the USB webcam!
    if (!savedId && availableCameras.length > 1) {
      const externalIdx = availableCameras.findIndex(c => {
        const l = (c.label || "").toLowerCase();
        return l.includes("usb") || l.includes("external") || l.includes("webcam");
      });
      if (externalIdx >= 0) {
        select.selectedIndex = externalIdx;
        currentCameraIndex = externalIdx;
      } else {
        // Typically camera index 1 is external when internal is 0
        select.selectedIndex = 1;
        currentCameraIndex = 1;
      }
    }
  } catch (err) {
    console.warn("Error enumerating cameras:", err);
  }
}

async function onCameraSelectChange() {
  const select = document.getElementById("camera-select");
  if (!select || !select.value) return;
  const newId = select.value;
  localStorage.setItem("preferred_camera_id", newId);
  currentCameraIndex = availableCameras.findIndex(c => c.deviceId === newId);
  
  if (webcamStream) {
    stopWebcam();
    await startCameraWithFallback(newId);
  }
}

async function switchCameraNext() {
  if (availableCameras.length <= 1) {
    await loadAvailableCameras();
  }
  if (availableCameras.length <= 1) {
    alert("Ek hi camera detect hua hai. Agar bahar se USB webcam lagaya hai to check karein ki Windows use pehchan raha hai.");
    return;
  }

  currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
  const nextCam = availableCameras[currentCameraIndex];
  const select = document.getElementById("camera-select");
  if (select && nextCam) {
    select.value = nextCam.deviceId;
    localStorage.setItem("preferred_camera_id", nextCam.deviceId);
  }

  if (webcamStream) {
    stopWebcam();
  }
  await startCameraWithFallback(nextCam ? nextCam.deviceId : null);
}

function stopWebcam() {
  const video = document.getElementById("webcam-video");
  const placeholder = document.getElementById("camera-off-placeholder");
  const toggleBtn = document.getElementById("cam-toggle-btn");
  const liveIndicator = document.getElementById("live-indicator");
  const liveHud = document.getElementById("live-hud-banner");
  const snapBtn = document.getElementById("capture-single-btn");

  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  if (webcamInterval) clearInterval(webcamInterval);
  if (fpsInterval) clearInterval(fpsInterval);

  if (video) video.classList.add("hidden");
  const liveBoxCanvas = document.getElementById("live-box-canvas");
  if (liveBoxCanvas) {
    const ctx = liveBoxCanvas.getContext("2d");
    ctx.clearRect(0, 0, liveBoxCanvas.width, liveBoxCanvas.height);
    liveBoxCanvas.classList.add("hidden");
  }
  if (placeholder) placeholder.classList.remove("hidden");
  if (liveIndicator) {
    liveIndicator.classList.add("hidden");
    liveIndicator.classList.remove("flex");
  }
  if (liveHud) liveHud.classList.add("hidden");
  if (snapBtn) snapBtn.disabled = true;

  if (toggleBtn) {
    toggleBtn.innerHTML = `<i data-lucide="power" class="w-3.5 h-3.5"></i> Start Camera`;
    toggleBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow";
    if (window.lucide) lucide.createIcons();
  }
}

async function startCameraWithFallback(preferredDeviceId = null) {
  const select = document.getElementById("camera-select");
  const video = document.getElementById("webcam-video");
  const placeholder = document.getElementById("camera-off-placeholder");
  const toggleBtn = document.getElementById("cam-toggle-btn");
  const liveIndicator = document.getElementById("live-indicator");
  const snapBtn = document.getElementById("capture-single-btn");

  // Enumerate cameras if not already populated
  if (availableCameras.length === 0) {
    await loadAvailableCameras();
  }

  // Determine candidate cameras to attempt in order
  let candidates = [];
  const targetId = preferredDeviceId || (select && select.value ? select.value : localStorage.getItem("preferred_camera_id"));

  if (targetId) {
    candidates.push(targetId);
  }

  // Add all other cameras as automatic fallback (so broken laptop cam won't block USB webcam!)
  availableCameras.forEach(cam => {
    if (cam.deviceId && !candidates.includes(cam.deviceId)) {
      candidates.push(cam.deviceId);
    }
  });

  // If no specific camera candidate, add null
  if (candidates.length === 0) {
    candidates.push(null);
  }

  let stream = null;
  let workingDeviceId = null;
  let lastError = null;

  for (const devId of candidates) {
    try {
      console.log("[Camera] Trying device:", devId || "default");
      const constraints = devId 
        ? { video: { deviceId: { exact: devId }, width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } } }
        : { video: { width: { ideal: 1280, min: 640 }, height: { ideal: 720, min: 480 } } };

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (strictErr) {
        console.warn("[Camera] Strict constraints failed, trying basic video:", strictErr);
        const fallbackConstraint = devId ? { video: { deviceId: { exact: devId } } } : { video: true };
        stream = await navigator.mediaDevices.getUserMedia(fallbackConstraint);
      }

      if (stream && stream.getVideoTracks().length > 0) {
        workingDeviceId = devId || stream.getVideoTracks()[0].getSettings().deviceId;
        console.log("[Camera] Success on device:", workingDeviceId);
        break;
      }
    } catch (err) {
      console.warn(`[Camera] Device ${devId} failed (might be broken internal camera):`, err.name, err.message);
      lastError = err;
      // Auto-fallback to next candidate camera!
    }
  }

  if (!stream) {
    alert("Camera chalu nahi ho saka! Error: " + (lastError ? (lastError.name + ": " + lastError.message) : "No working camera found") + 
          "\n\nKoshish karein:\n1. Check karein USB camera laptop me theek se laga ho.\n2. Browser address bar me Lock icon par 'Camera: Allow' hona chahiye.\n3. Koi aur app (Zoom, Teams, Camera app) camera to use nahi kar raha.");
    return false;
  }

  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
  }

  webcamStream = stream;
  activeDeviceId = workingDeviceId;

  // Re-enumerate with full labels now that permission is active
  await loadAvailableCameras();

  if (select && workingDeviceId) {
    select.value = workingDeviceId;
    localStorage.setItem("preferred_camera_id", workingDeviceId);
  }

  video.srcObject = webcamStream;
  video.classList.remove("hidden");
  const liveBoxCanvas = document.getElementById("live-box-canvas");
  if (liveBoxCanvas) liveBoxCanvas.classList.remove("hidden");
  placeholder.classList.add("hidden");
  liveIndicator.classList.remove("hidden");
  liveIndicator.classList.add("flex");
  snapBtn.disabled = false;

  toggleBtn.innerHTML = `<i data-lucide="square" class="w-3.5 h-3.5"></i> Stop Camera`;
  toggleBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition flex items-center gap-1.5 shadow";
  if (window.lucide) lucide.createIcons();

  startFpsCounter();

  if (webcamInterval) clearInterval(webcamInterval);
  webcamInterval = setInterval(() => {
    const autoCheck = document.getElementById("auto-predict-toggle");
    if (autoCheck && autoCheck.checked) {
      captureAndClassifyFrame();
    }
  }, 350);

  return true;
}

async function toggleWebcam() {
  if (webcamStream) {
    stopWebcam();
  } else {
    await startCameraWithFallback();
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

  // Draw real-time bounding boxes with tags over the live camera feed
  const video = document.getElementById("webcam-video");
  const liveBoxCanvas = document.getElementById("live-box-canvas");
  if (data.boxes && liveBoxCanvas && video && video.clientWidth) {
    drawFoodBoxes(liveBoxCanvas, data.boxes, video.clientWidth, video.clientHeight);
  }

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
