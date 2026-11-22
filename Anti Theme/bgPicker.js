// ============================================================================
// WallpaperGlass — bgPicker.js (Spicetify Background Customizer Extension)
// ============================================================================
// Features:
//   - Adds a clean "Background" menu item to Spotify's profile dropdown menu
//     (right next to "Home config" and "Experimental features").
//   - File picker for local images (PNG, JPG, WebP, GIF) auto-downscaled via
//     HTML5 Canvas to max 1920px wide and stored safely in IndexedDB.
//   - URL input with direct load and error handling.
//   - Live interactive sliders:
//       * Blur (0px to 80px)
//       * Dim / Overlay Darkness (0% to 100%)
//       * Brightness (20% to 150%)
//   - Live preview thumbnail displaying real-time glassmorphism.
//   - "Reset to default" restoring original theme wallpaper and filters.
//   - Zero-flash startup: restores saved wallpaper & slider values before
//     the Spotify UI visibly renders.
// ============================================================================

(function BackgroundPickerExtension() {
  // --------------------------------------------------------------------------
  // 1. Configurable Defaults & Storage Keys
  // --------------------------------------------------------------------------
  const DEFAULTS = {
    blur: 2,           // px (0 to 80)
    dim: 0.22,         // 0.0 to 1.0 (0% to 100%)
    brightness: 0.75,  // 0.2 to 1.5 (20% to 150%)
    type: "default",   // "default" | "local" | "url"
    url: "",
  };

  const MAX_IMAGE_WIDTH = 1920;
  const JPEG_QUALITY = 0.85;

  const DB_NAME = "WallpaperGlass_BgDB";
  const DB_STORE = "wallpaper_store";
  const DB_KEY = "current_custom_wallpaper";

  const STORAGE = {
    TYPE: "bgPicker:type",
    URL: "bgPicker:url",
    BLUR: "bgPicker:blur",
    DIM: "bgPicker:dim",
    BRIGHTNESS: "bgPicker:brightness",
  };

  // --------------------------------------------------------------------------
  // 2. IndexedDB Storage (Bypasses localStorage 5MB quota)
  // --------------------------------------------------------------------------
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveWallpaperToDb(dataUrl) {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        const req = store.put(dataUrl, DB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.error("[bgPicker] IndexedDB write error:", err);
      return false;
    }
  }

  async function getWallpaperFromDb() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readonly");
        const store = tx.objectStore(DB_STORE);
        const req = store.get(DB_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn("[bgPicker] IndexedDB read error:", err);
      return null;
    }
  }

  async function clearWallpaperFromDb() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        const store = tx.objectStore(DB_STORE);
        const req = store.delete(DB_KEY);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 3. Settings Helpers
  // --------------------------------------------------------------------------
  function getSetting(key, fallback) {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setSetting(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (_) {}
  }

  function removeSetting(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {}
  }

  function getLoadedConfig() {
    const rawBlur = parseFloat(getSetting(STORAGE.BLUR, DEFAULTS.blur));
    const rawDim = parseFloat(getSetting(STORAGE.DIM, DEFAULTS.dim));
    const rawBright = parseFloat(getSetting(STORAGE.BRIGHTNESS, DEFAULTS.brightness));
    return {
      type: getSetting(STORAGE.TYPE, DEFAULTS.type),
      url: getSetting(STORAGE.URL, DEFAULTS.url),
      blur: isNaN(rawBlur) ? DEFAULTS.blur : rawBlur,
      dim: isNaN(rawDim) ? DEFAULTS.dim : rawDim,
      brightness: isNaN(rawBright) ? DEFAULTS.brightness : rawBright,
    };
  }

  // --------------------------------------------------------------------------
  // 4. Live CSS Variable Application
  // --------------------------------------------------------------------------
  function applyLiveStyles(opts) {
    const root = document.documentElement;
    if (opts.blur !== undefined) {
      root.style.setProperty("--custom-bg-blur", `${opts.blur}px`);
    }
    if (opts.dim !== undefined) {
      root.style.setProperty("--custom-bg-dim", String(opts.dim));
    }
    if (opts.brightness !== undefined) {
      root.style.setProperty("--custom-bg-brightness", String(opts.brightness));
    }
    if (opts.image !== undefined) {
      if (opts.image && opts.image !== "default") {
        root.style.setProperty("--custom-bg-image", `url("${opts.image}")`);
      } else {
        root.style.removeProperty("--custom-bg-image");
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5. Zero-Flash Startup Initialization
  // --------------------------------------------------------------------------
  async function initStartupWallpaper() {
    const config = getLoadedConfig();

    // 1. Synchronously apply sliders immediately (0ms delay)
    applyLiveStyles({
      blur: config.blur,
      dim: config.dim,
      brightness: config.brightness,
    });

    // 2. Apply background source
    if (config.type === "url" && config.url) {
      applyLiveStyles({ image: config.url });
    } else if (config.type === "local") {
      try {
        const dataUrl = await getWallpaperFromDb();
        if (dataUrl) {
          applyLiveStyles({ image: dataUrl });
        } else {
          applyLiveStyles({ image: "default" });
        }
      } catch (_) {
        applyLiveStyles({ image: "default" });
      }
    } else {
      applyLiveStyles({ image: "default" });
    }
  }

  // Run instantly on script evaluation
  initStartupWallpaper();

  // --------------------------------------------------------------------------
  // 6. Image Downscaling with HTML5 Canvas
  // --------------------------------------------------------------------------
  function processLocalImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawData = event.target.result;
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > MAX_IMAGE_WIDTH) {
            const ratio = MAX_IMAGE_WIDTH / width;
            width = MAX_IMAGE_WIDTH;
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          let optimized = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          resolve(optimized);
        };
        img.onerror = () => reject(new Error("Corrupt or invalid image file."));
        img.src = rawData;
      };
      reader.onerror = () => reject(new Error("Failed to read file."));
      reader.readAsDataURL(file);
    });
  }

  function validateImageUrl(url) {
    return new Promise((resolve) => {
      if (!url || !url.trim()) return resolve(false);
      const img = new Image();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        resolve(false);
      }, 7000);

      img.onload = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(true);
        }
      };
      img.onerror = () => {
        if (!timedOut) {
          clearTimeout(timer);
          resolve(false);
        }
      };
      img.src = url.trim();
    });
  }

  // --------------------------------------------------------------------------
  // 7. Theme-Matched Settings Modal
  // --------------------------------------------------------------------------
  async function openBackgroundSettingsModal() {
    const config = getLoadedConfig();
    let currentImage = "default";

    if (config.type === "url" && config.url) {
      currentImage = config.url;
    } else if (config.type === "local") {
      const dbImg = await getWallpaperFromDb();
      if (dbImg) currentImage = dbImg;
    }

    let stagedConfig = {
      type: config.type,
      url: config.url,
      blur: config.blur,
      dim: config.dim,
      brightness: config.brightness,
      image: currentImage,
    };

    // Modal DOM Structure
    const container = document.createElement("div");
    container.className = "bg-picker-modal-root";
    container.innerHTML = `
      <style>
        .bg-picker-modal-root {
          font-family: var(--font-family, system-ui, -apple-system, sans-serif);
          color: #f5f5fa;
          padding: 8px 4px 16px 4px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          user-select: none;
        }
        .bg-picker-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .bg-picker-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #c7c9d6;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .bg-picker-dropzone {
          border: 2px dashed rgba(232, 74, 127, 0.35);
          background: rgba(14, 14, 22, 0.45);
          border-radius: 12px;
          padding: 20px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .bg-picker-dropzone:hover, .bg-picker-dropzone.dragover {
          border-color: #ff6ea0;
          background: rgba(232, 74, 127, 0.12);
          transform: translateY(-1px);
        }
        .bg-picker-dropzone-icon {
          font-size: 1.8rem;
          line-height: 1;
        }
        .bg-picker-dropzone-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
        }
        .bg-picker-dropzone-sub {
          font-size: 0.78rem;
          color: #a0a2b2;
        }
        .bg-picker-url-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .bg-picker-input {
          flex: 1;
          background: rgba(22, 22, 34, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f5f5fa;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .bg-picker-input:focus {
          border-color: #e84a7f;
          box-shadow: 0 0 0 2px rgba(232, 74, 127, 0.25);
        }
        .bg-picker-btn {
          background: #e84a7f;
          color: #0b0b10;
          font-weight: 700;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 0.88rem;
          cursor: pointer;
          transition: all 0.18s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .bg-picker-btn:hover {
          background: #ff6ea0;
          transform: scale(1.02);
        }
        .bg-picker-btn-secondary {
          background: rgba(255, 255, 255, 0.08);
          color: #f5f5fa;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .bg-picker-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
          transform: scale(1.02);
        }
        .bg-picker-btn-reset {
          background: transparent;
          color: #ff6ea0;
          border: 1px solid rgba(232, 74, 127, 0.4);
        }
        .bg-picker-btn-reset:hover {
          background: rgba(232, 74, 127, 0.15);
          border-color: #ff6ea0;
        }
        .bg-picker-slider-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bg-picker-slider-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .bg-picker-slider-val {
          color: #ff6ea0;
          font-variant-numeric: tabular-nums;
        }
        .bg-picker-range {
          -webkit-appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.12);
          outline: none;
          cursor: pointer;
          margin: 6px 0;
        }
        .bg-picker-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ff6ea0;
          box-shadow: 0 0 8px rgba(232, 74, 127, 0.6);
          cursor: pointer;
          transition: transform 0.1s;
        }
        .bg-picker-range::-webkit-slider-thumb:hover {
          transform: scale(1.18);
        }
        .bg-picker-preview-box {
          height: 140px;
          border-radius: 12px;
          position: relative;
          overflow: hidden;
          background-size: cover;
          background-position: center center;
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .bg-picker-preview-filter {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center;
          transition: filter 0.05s linear;
        }
        .bg-picker-preview-dimmer {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 40%, rgba(8, 8, 14, 0.8) 100%), rgba(0, 0, 0, 0.3);
          pointer-events: none;
        }
        .bg-picker-preview-card {
          position: relative;
          z-index: 2;
          background: rgba(14, 14, 22, 0.45);
          backdrop-filter: blur(12px) saturate(130%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .bg-picker-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }
      </style>

      <!-- Section: Wallpaper Source -->
      <div class="bg-picker-section">
        <div class="bg-picker-section-title">1. Wallpaper Image</div>
        
        <!-- Drag & Drop Zone -->
        <div class="bg-picker-dropzone" id="bg-dropzone">
          <div class="bg-picker-dropzone-icon">🖼️</div>
          <div class="bg-picker-dropzone-title">Choose image file (PNG, JPG, WebP, GIF)</div>
          <div class="bg-picker-dropzone-sub">Click to browse or drag & drop (auto-optimized & saved locally)</div>
          <input type="file" id="bg-file-input" accept="image/png, image/jpeg, image/webp, image/gif" style="display: none;">
        </div>

        <!-- URL Input Row -->
        <div style="font-size: 0.8rem; color: #a0a2b2; margin-top: 4px;">Or paste an image web link:</div>
        <div class="bg-picker-url-row">
          <input type="text" id="bg-url-input" class="bg-picker-input" placeholder="https://images.unsplash.com/photo-..." value="${stagedConfig.type === 'url' ? stagedConfig.url : ''}">
          <button id="bg-url-apply-btn" class="bg-picker-btn bg-picker-btn-secondary" style="padding: 10px 14px;">Load URL</button>
        </div>
      </div>

      <!-- Section: Live Sliders -->
      <div class="bg-picker-section">
        <div class="bg-picker-section-title">2. Wallpaper Filter Tuning</div>
        
        <!-- Blur Slider -->
        <div class="bg-picker-slider-row">
          <div class="bg-picker-slider-header">
            <span>Background Blur</span>
            <span class="bg-picker-slider-val" id="bg-val-blur">${Math.round(stagedConfig.blur)}px</span>
          </div>
          <input type="range" id="bg-range-blur" class="bg-picker-range" min="0" max="80" step="1" value="${stagedConfig.blur}">
        </div>

        <!-- Dim / Darkness Slider -->
        <div class="bg-picker-slider-row">
          <div class="bg-picker-slider-header">
            <span>Dim & Darkness Overlay</span>
            <span class="bg-picker-slider-val" id="bg-val-dim">${Math.round(stagedConfig.dim * 100)}%</span>
          </div>
          <input type="range" id="bg-range-dim" class="bg-picker-range" min="0" max="1" step="0.01" value="${stagedConfig.dim}">
        </div>

        <!-- Brightness Slider -->
        <div class="bg-picker-slider-row">
          <div class="bg-picker-slider-header">
            <span>Brightness</span>
            <span class="bg-picker-slider-val" id="bg-val-bright">${Math.round(stagedConfig.brightness * 100)}%</span>
          </div>
          <input type="range" id="bg-range-bright" class="bg-picker-range" min="0.2" max="1.5" step="0.01" value="${stagedConfig.brightness}">
        </div>
      </div>

      <!-- Section: Live Preview -->
      <div class="bg-picker-section">
        <div class="bg-picker-section-title">3. Live Glass Preview</div>
        <div class="bg-picker-preview-box" id="bg-preview-box">
          <div class="bg-picker-preview-filter" id="bg-preview-filter"></div>
          <div class="bg-picker-preview-dimmer" id="bg-preview-dimmer"></div>
          <div class="bg-picker-preview-card">
            <span style="font-size: 1.3rem;">🎵</span>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">Antigravity Theme</div>
              <div style="font-size: 0.75rem; color: #c7c9d6;">Real-time glassmorphism preview</div>
            </div>
            <div style="width: 26px; height: 26px; border-radius: 50%; background: #e84a7f; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #0b0b10; font-weight: 900;">▶</div>
          </div>
        </div>
      </div>

      <!-- Section: Actions Footer -->
      <div class="bg-picker-footer">
        <button id="bg-btn-reset" class="bg-picker-btn bg-picker-btn-reset">
          ↺ Reset to Default
        </button>
        <button id="bg-btn-close" class="bg-picker-btn" style="padding: 10px 28px;">
          Done
        </button>
      </div>
    `;

    // Elements
    const dropzone = container.querySelector("#bg-dropzone");
    const fileInput = container.querySelector("#bg-file-input");
    const urlInput = container.querySelector("#bg-url-input");
    const urlApplyBtn = container.querySelector("#bg-url-apply-btn");

    const rangeBlur = container.querySelector("#bg-range-blur");
    const rangeDim = container.querySelector("#bg-range-dim");
    const rangeBright = container.querySelector("#bg-range-bright");

    const valBlur = container.querySelector("#bg-val-blur");
    const valDim = container.querySelector("#bg-val-dim");
    const valBright = container.querySelector("#bg-val-bright");

    const previewFilter = container.querySelector("#bg-preview-filter");
    const previewDimmer = container.querySelector("#bg-preview-dimmer");

    const btnReset = container.querySelector("#bg-btn-reset");
    const btnClose = container.querySelector("#bg-btn-close");

    // Live Preview update
    function refreshPreview() {
      // 1. Preview background image
      const bgImg = stagedConfig.image && stagedConfig.image !== "default"
        ? `url("${stagedConfig.image}")`
        : "var(--wp-default-wallpaper, var(--wp-image))";
      
      previewFilter.style.backgroundImage = bgImg;
      previewFilter.style.filter = `blur(${stagedConfig.blur * 0.4}px) brightness(${stagedConfig.brightness}) saturate(1.15) contrast(1.05)`;
      previewDimmer.style.background = `radial-gradient(ellipse at center, transparent 40%, rgba(8, 8, 14, ${Math.min(1, stagedConfig.dim * 1.5)}) 100%), rgba(0, 0, 0, ${stagedConfig.dim * 0.5})`;

      // 2. Apply directly to Spotify DOM in real time!
      applyLiveStyles({
        blur: stagedConfig.blur,
        dim: stagedConfig.dim,
        brightness: stagedConfig.brightness,
        image: stagedConfig.image,
      });
    }

    refreshPreview();

    // 1. File Upload Handler
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", async (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelection(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileSelection(e.target.files[0]);
      }
    });

    async function handleFileSelection(file) {
      try {
        if (window.Spicetify && Spicetify.showNotification) {
          Spicetify.showNotification("Optimizing and saving image...");
        }
        const dataUrl = await processLocalImage(file);
        await saveWallpaperToDb(dataUrl);

        stagedConfig.type = "local";
        stagedConfig.image = dataUrl;
        stagedConfig.url = "";
        urlInput.value = "";

        setSetting(STORAGE.TYPE, "local");
        removeSetting(STORAGE.URL);

        refreshPreview();

        if (window.Spicetify && Spicetify.showNotification) {
          Spicetify.showNotification("Local wallpaper saved and applied!");
        }
      } catch (err) {
        console.error("[bgPicker] File load error:", err);
        if (window.Spicetify && Spicetify.showNotification) {
          Spicetify.showNotification("Error: Invalid or unreadable image file.");
        }
      }
    }

    // 2. URL Input Handler
    async function handleUrlApply() {
      const url = urlInput.value.trim();
      if (!url) return;

      if (window.Spicetify && Spicetify.showNotification) {
        Spicetify.showNotification("Verifying image URL...");
      }

      const isValid = await validateImageUrl(url);
      if (!isValid) {
        if (window.Spicetify && Spicetify.showNotification) {
          Spicetify.showNotification("Could not load image from URL. Please check the link.");
        }
        return;
      }

      stagedConfig.type = "url";
      stagedConfig.url = url;
      stagedConfig.image = url;

      setSetting(STORAGE.TYPE, "url");
      setSetting(STORAGE.URL, url);
      await clearWallpaperFromDb();

      refreshPreview();

      if (window.Spicetify && Spicetify.showNotification) {
        Spicetify.showNotification("Wallpaper URL applied!");
      }
    }

    urlApplyBtn.addEventListener("click", handleUrlApply);
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleUrlApply();
    });

    // 3. Slider Handlers (Live Dragging)
    rangeBlur.addEventListener("input", (e) => {
      stagedConfig.blur = parseFloat(e.target.value);
      valBlur.textContent = `${Math.round(stagedConfig.blur)}px`;
      setSetting(STORAGE.BLUR, stagedConfig.blur);
      refreshPreview();
    });

    rangeDim.addEventListener("input", (e) => {
      stagedConfig.dim = parseFloat(e.target.value);
      valDim.textContent = `${Math.round(stagedConfig.dim * 100)}%`;
      setSetting(STORAGE.DIM, stagedConfig.dim);
      refreshPreview();
    });

    rangeBright.addEventListener("input", (e) => {
      stagedConfig.brightness = parseFloat(e.target.value);
      valBright.textContent = `${Math.round(stagedConfig.brightness * 100)}%`;
      setSetting(STORAGE.BRIGHTNESS, stagedConfig.brightness);
      refreshPreview();
    });

    // 4. Reset Button Handler
    btnReset.addEventListener("click", async () => {
      stagedConfig.type = DEFAULTS.type;
      stagedConfig.url = DEFAULTS.url;
      stagedConfig.blur = DEFAULTS.blur;
      stagedConfig.dim = DEFAULTS.dim;
      stagedConfig.brightness = DEFAULTS.brightness;
      stagedConfig.image = "default";

      rangeBlur.value = DEFAULTS.blur;
      valBlur.textContent = `${DEFAULTS.blur}px`;

      rangeDim.value = DEFAULTS.dim;
      valDim.textContent = `${Math.round(DEFAULTS.dim * 100)}%`;

      rangeBright.value = DEFAULTS.brightness;
      valBright.textContent = `${Math.round(DEFAULTS.brightness * 100)}%`;

      urlInput.value = "";

      removeSetting(STORAGE.TYPE);
      removeSetting(STORAGE.URL);
      removeSetting(STORAGE.BLUR);
      removeSetting(STORAGE.DIM);
      removeSetting(STORAGE.BRIGHTNESS);

      await clearWallpaperFromDb();
      refreshPreview();

      if (window.Spicetify && Spicetify.showNotification) {
        Spicetify.showNotification("Restored default theme wallpaper & filters.");
      }
    });

    // 5. Close Button Handler
    btnClose.addEventListener("click", () => {
      if (window.Spicetify && Spicetify.PopupModal && typeof Spicetify.PopupModal.hide === "function") {
        Spicetify.PopupModal.hide();
      }
      const overlay = document.getElementById("bg-picker-standalone-modal");
      if (overlay) overlay.remove();
    });

    // 6. Display via Spicetify.PopupModal (or standalone glass fallback)
    if (window.Spicetify && Spicetify.PopupModal && typeof Spicetify.PopupModal.display === "function") {
      Spicetify.PopupModal.display({
        title: "Background Settings",
        content: container,
        isLarge: true,
      });
    } else {
      // Standalone glass dialog fallback
      const overlay = document.createElement("div");
      overlay.id = "bg-picker-standalone-modal";
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(14px);
        display: flex; align-items: center; justify-content: center;
      `;
      const card = document.createElement("div");
      card.style.cssText = `
        background: rgba(18, 18, 28, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 14px;
        width: 540px; max-width: 92vw; max-height: 88vh;
        overflow-y: auto; padding: 24px; box-shadow: 0 16px 40px rgba(0,0,0,0.5);
      `;
      const head = document.createElement("div");
      head.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;";
      head.innerHTML = `
        <h2 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #fff;">Background Settings</h2>
        <button style="background: none; border: none; color: #c7c9d6; font-size: 1.4rem; cursor: pointer;">✕</button>
      `;
      head.querySelector("button").onclick = () => overlay.remove();
      card.appendChild(head);
      card.appendChild(container);
      overlay.appendChild(card);
      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
      };
      document.body.appendChild(overlay);
    }
  }

  // --------------------------------------------------------------------------
  // 8. Register Profile Dropdown "Background" Menu Item
  // --------------------------------------------------------------------------
  function registerMenuItem() {
    let menuRegistered = false;

    // A. Native Spicetify.Menu.Item API
    function trySpicetifyMenu() {
      if (menuRegistered) return;
      if (window.Spicetify && Spicetify.Menu && Spicetify.Menu.Item) {
        try {
          const bgItem = new Spicetify.Menu.Item(
            "Background",
            false,
            () => openBackgroundSettingsModal(),
            "edit"
          );

          // Support all Spotify profile widget trigger variations
          const origShouldAdd = bgItem.shouldAdd;
          bgItem.shouldAdd = (props, trigger, target) => {
            if (origShouldAdd && origShouldAdd(props, trigger, target)) return true;
            if (trigger === "click") {
              return !!target?.closest?.(
                '[data-testid="user-widget-link"], [data-testid*="user-widget"], [data-testid="username-button"], .main-userWidget-box, .main-userWidget-boxCondensed, button[aria-label*="profile" i]'
              );
            }
            return false;
          };

          bgItem.register();
          menuRegistered = true;
          console.log("[bgPicker] Registered 'Background' via Spicetify.Menu.Item");
        } catch (err) {
          console.warn("[bgPicker] Spicetify.Menu registration notice:", err);
        }
      }
    }

    trySpicetifyMenu();

    // B. ContextMenu DOM Fallback Observer
    // Ensures the "Background" menu item appears right next to "Home config"
    // across all Spotify versions and client DOM updates.
    const menuObserver = new MutationObserver(() => {
      const menu = document.querySelector('[role="menu"], .main-contextMenu-menu');
      if (!menu) return;

      const isProfileMenu =
        menu.querySelector('a[href*="spotify.com/account"]') ||
        menu.querySelector('a[href*="account.spotify.com"]') ||
        menu.querySelector('[data-testid="user-widget-menu"]') ||
        Array.from(menu.querySelectorAll("button, a, span")).some((el) => {
          const t = (el.textContent || "").trim().toLowerCase();
          return t === "home config" || t === "experimental features" || t === "account" || t === "profile";
        });

      if (isProfileMenu && !menu.querySelector("#bg-picker-profile-menu-item")) {
        const itemLi = document.createElement("li");
        itemLi.id = "bg-picker-profile-menu-item";
        itemLi.setAttribute("role", "presentation");

        const btn = document.createElement("button");
        btn.className = "main-contextMenu-menuItemButton";
        btn.setAttribute("role", "menuitem");
        btn.style.cssText = "display: flex; align-items: center; width: 100%; gap: 10px;";
        btn.innerHTML = `
          <span style="display: flex; align-items: center; color: var(--wp-accent, #e84a7f); font-size: 1rem;">🖼️</span>
          <span class="main-contextMenu-menuItemLabel">Background</span>
        `;

        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Close context menu safely
          const menuBackdrop = document.querySelector("#context-menu, [data-tippy-root]");
          if (menuBackdrop) menuBackdrop.remove();
          openBackgroundSettingsModal();
        };

        itemLi.appendChild(btn);

        // Find "Home config" or "Experimental features" and insert right next to it
        const homeConfigItem = Array.from(menu.querySelectorAll("li, button, a")).find((el) => {
          return (el.textContent || "").toLowerCase().includes("home config");
        });

        if (homeConfigItem) {
          const parentLi = homeConfigItem.closest("li") || homeConfigItem;
          parentLi.parentNode.insertBefore(itemLi, parentLi.nextSibling);
        } else {
          // Prepend as top item
          menu.insertBefore(itemLi, menu.firstChild);
        }
      }
    });

    menuObserver.observe(document.body, { childList: true, subtree: true });
  }

  // --------------------------------------------------------------------------
  // 9. Startup Poller for Spicetify APIs
  // --------------------------------------------------------------------------
  function init() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (window.Spicetify && Spicetify.Menu && Spicetify.PopupModal) {
        clearInterval(interval);
        registerMenuItem();
      } else if (attempts > 60) {
        clearInterval(interval);
        registerMenuItem(); // fallback DOM observer
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
