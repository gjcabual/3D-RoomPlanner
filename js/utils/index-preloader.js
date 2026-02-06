// index-preloader.js
// Shows loading screen on first load and preloads ALL assets
// (models, textures, components, scripts) so the planner loads instantly.

(() => {
  "use strict";

  // TWO-PHASE LOADING STRATEGY:
  // Phase 1: Load essential assets fast (scripts, CSS, components) - show page quickly
  // Phase 2: Background preload 3D models while user reads/interacts - ready when needed

  // All 3D models to background-preload (loaded AFTER page is shown)
  const ALL_MODELS = [
    "asset/models/desk1.obj", // 12.59 MB - smallest, load first
    "asset/models/wardrobe_modern.obj", // 19.51 MB
    "asset/models/shelf2.obj", // 29.22 MB
    "asset/models/wardrobe_openframe.obj", // 31.62 MB
    "asset/models/desk2.obj", // 35.35 MB
    "asset/models/center_table2.obj", // 39.99 MB
    "asset/models/wardrobe_traditional.obj", // 41.49 MB
    "asset/models/shelf1.obj", // 41.79 MB
    "asset/models/center_table1.obj", // 43.59 MB
    "asset/models/mirror1.obj", // 48.55 MB
    "asset/models/bed2.obj", // 50.13 MB
    "asset/models/chair2.obj", // 50.13 MB
    "asset/models/bed1.obj", // 50.25 MB
    "asset/models/chair1.obj", // 50.72 MB
    "asset/models/mirror2.obj", // 51.69 MB
  ];

  // Textures to preload (compressed JPG - only 366KB)
  const ALL_TEXTURES = ["asset/textures/wood2k.jpg"];

  // HTML components to preload (for faster planner UI)
  const ALL_COMPONENTS = [
    "components/side-panel.html",
    "components/resize-panel.html",
    "components/cost-panel.html",
    "components/furniture-controls.html",
    "components/sources-panel.html",
    "components/dialog-modal.html",
    "components/instructions.html",
    "components/profile-circle.html",
  ];

  // Planner page to prefetch
  const ALL_PAGES = ["planner.html"];

  // CSS files to prefetch
  const ALL_CSS = ["css/planner.css", "css/components.css", "css/dialog.css"];

  // External libraries to prefetch (these are heavy and cause lag)
  const ALL_EXTERNAL_SCRIPTS = [
    "https://aframe.io/releases/1.5.0/aframe.min.js",
    "https://cdn.tailwindcss.com",
    "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
    "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  ];

  // Local JS files to prefetch
  const ALL_LOCAL_SCRIPTS = [
    "js/components/movement.js",
    "js/components/floor-resize.js",
    "js/components/smart-placement.js",
    "js/components/textured-model.js",
    "js/components/cached-obj-model.js",
    "js/components/draggable-furniture.js",
    "js/components/clickable-furniture.js",
    "js/components/position-debug.js",
    "js/utils/debug.js",
    "js/utils/supabase.js",
    "js/utils/model-analyzer.js",
    "js/auth/auth.js",
    "js/auth/auth-ui.js",
    "js/utils/cost-estimation.js",
    "js/utils/migrate-data.js",
    "js/utils/dialog.js",
    "js/utils/snapshot.js",
    "js/utils/workspace-state.js",
    "js/utils/asset-preloader.js",
    "js/components/profile-menu.js",
    "js/html-loader.js",
    "js/planner.js",
  ];

  // Preload state
  const state = {
    isLoading: true,
    totalAssets: 0,
    loadedAssets: 0,
    errors: [],
    // Phase 2: Background preloading state
    backgroundPreloading: false,
    backgroundComplete: false,
    backgroundTotal: 0,
    backgroundLoaded: 0,
  };

  /**
   * Create and show the initial loading screen
   */
  function createLoadingScreen() {
    const overlay = document.createElement("div");
    overlay.id = "initial-loading-overlay";
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-logo">
          <span class="logo-3d">3D<br></span>
          <span class="logo-room">ROOM PLANNER</span>
        </div>
        
        <!-- Animated 3D Cube -->
        <div class="loading-cube-container">
          <div class="loading-cube">
            <div class="cube-face cube-front"></div>
            <div class="cube-face cube-back"></div>
            <div class="cube-face cube-right"></div>
            <div class="cube-face cube-left"></div>
            <div class="cube-face cube-top"></div>
            <div class="cube-face cube-bottom"></div>
          </div>
        </div>
        
        <p class="loading-status" id="loading-status">Loading furniture models...</p>
        <div class="loading-progress-bar">
          <div class="loading-progress-fill" id="loading-progress-fill"></div>
        </div>
        <p class="loading-percent" id="loading-percent">0%</p>
      </div>
    `;

    const style = document.createElement("style");
    style.id = "initial-loading-styles";
    style.textContent = `
      #initial-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        transition: opacity 0.5s ease;
      }

      /* Grid background pattern */
      #initial-loading-overlay::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 50px 50px;
        pointer-events: none;
        opacity: 0.5;
      }

      #initial-loading-overlay.fade-out {
        opacity: 0;
        pointer-events: none;
      }

      .loading-content {
        position: relative;
        z-index: 1;
        text-align: center;
        color: white;
        max-width: 400px;
        padding: 40px;
      }

      .loading-logo {
        margin-bottom: 30px;
      }

      .logo-3d {
        font-size: 48px;
        font-weight: 800;
        background: linear-gradient(135deg, #FF8C00, #FFA500);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-right: 10px;
      }

      .logo-room {
        font-size: 36px;
        font-weight: 300;
        color: #fff;
        letter-spacing: 4px;
      }

      /* 3D Cube Container */
      .loading-cube-container {
        width: 200px;
        height: 200px;
        margin: 0 auto 30px;
        perspective: 800px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Animated 3D Cube - matches main page wireframe cube */
      .loading-cube {
        position: relative;
        width: 150px;
        height: 150px;
        transform-style: preserve-3d;
        animation: cubeJumpSpin 2s ease-in-out infinite;
      }

      @keyframes cubeJumpSpin {
        0% {
          transform: rotateX(-20deg) rotateY(0deg) translateY(0);
        }
        25% {
          transform: rotateX(-30deg) rotateY(90deg) translateY(-20px);
        }
        50% {
          transform: rotateX(-20deg) rotateY(180deg) translateY(0);
        }
        75% {
          transform: rotateX(-10deg) rotateY(270deg) translateY(-20px);
        }
        100% {
          transform: rotateX(-20deg) rotateY(360deg) translateY(0);
        }
      }

      .loading-cube .cube-face {
        position: absolute;
        width: 150px;
        height: 150px;
        border: 2.5px solid #ffffff;
        background: transparent;
        opacity: 0.9;
      }

      .loading-cube .cube-front {
        transform: translateZ(75px);
        border-color: #ffffff;
      }

      .loading-cube .cube-back {
        transform: translateZ(-75px) rotateY(180deg);
        border-color: rgba(255, 255, 255, 0.6);
      }

      .loading-cube .cube-right {
        transform: rotateY(90deg) translateZ(75px);
        border-color: rgba(255, 255, 255, 0.8);
      }

      .loading-cube .cube-left {
        transform: rotateY(-90deg) translateZ(75px);
        border-color: rgba(255, 255, 255, 0.8);
      }

      .loading-cube .cube-top {
        transform: rotateX(90deg) translateZ(75px);
        border-color: rgba(255, 255, 255, 0.7);
      }

      .loading-cube .cube-bottom {
        transform: rotateX(-90deg) translateZ(75px);
        border-color: rgba(255, 255, 255, 0.5);
      }

      /* Stabilizing - matches main page wireframe cube exactly */
      .loading-cube.stabilizing {
        transform: rotateX(-20deg) rotateY(45deg);
        animation: cubeStabilize 1s ease-out forwards;
      }

      @keyframes cubeStabilize {
        0% {
          transform: rotateX(-20deg) rotateY(0deg) translateY(0);
        }
        100% {
          transform: rotateX(-20deg) rotateY(45deg) translateY(0);
        }
      }

      /* After stabilizing - EXACT copy of main page float animation */
      .loading-cube.floating {
        transform: rotateX(-20deg) rotateY(45deg);
        animation: float 6s ease-in-out infinite;
      }

      @keyframes float {
        0%, 100% {
          transform: rotateX(-20deg) rotateY(45deg) translateY(0);
        }
        50% {
          transform: rotateX(-20deg) rotateY(45deg) translateY(-10px);
        }
      }

      /* Fade out text elements during transition */
      .loading-content.transitioning .loading-logo,
      .loading-content.transitioning .loading-status,
      .loading-content.transitioning .loading-progress-bar,
      .loading-content.transitioning .loading-percent {
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      /* Cube container grows during transition */
      .loading-cube-container.transitioning {
        width: 320px;
        height: 320px;
        transition: all 0.8s ease-out;
      }

      .loading-status {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0 0 20px;
      }

      .loading-progress-bar {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .loading-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #FF8C00, #FFA500);
        border-radius: 3px;
        width: 0%;
        transition: width 0.3s ease;
      }

      .loading-percent {
        font-size: 14px;
        font-weight: 500;
        color: #FF8C00;
        margin: 0;
      }

      /* Hide intro container until loading is complete */
      body.is-loading .intro-container {
        visibility: hidden;
        opacity: 0;
      }

      .intro-container {
        transition: opacity 0.3s ease;
      }
    `;

    document.head.appendChild(style);
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.classList.add("is-loading");
  }

  /**
   * Update loading progress UI
   */
  function updateProgress(loaded, total, status) {
    const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

    const progressFill = document.getElementById("loading-progress-fill");
    const percentText = document.getElementById("loading-percent");
    const statusText = document.getElementById("loading-status");

    if (progressFill) progressFill.style.width = `${progress}%`;
    if (percentText) percentText.textContent = `${progress}%`;
    if (statusText && status) statusText.textContent = status;
  }

  /**
   * Hide loading screen - simple fade out while cube keeps spinning
   */
  function hideLoadingScreen() {
    const overlay = document.getElementById("initial-loading-overlay");

    if (!overlay) {
      document.body.classList.remove("is-loading");
      return;
    }

    // Just fade out the overlay (cube keeps spinning during fade)
    overlay.classList.add("fade-out");
    document.body.classList.remove("is-loading");

    // Clean up after fade
    setTimeout(() => {
      overlay.remove();
      const style = document.getElementById("initial-loading-styles");
      if (style) style.remove();

      // Focus on first input
      const widthInput = document.getElementById("room-width");
      if (widthInput) widthInput.focus();
    }, 500);
  }

  /**
   * Preload a single asset using fetch (or Image for textures)
   * Textures use Image() to ensure browser caches the decoded image,
   * not just raw bytes - this makes THREE.js TextureLoader pick it up instantly.
   */
  function preloadAsset(url) {
    // Use Image preloading for image files - this ensures the browser
    // caches a decoded image that THREE.js TextureLoader will reuse
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(url)) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Force decode so it's ready in GPU-friendly format
          if (img.decode) {
            img
              .decode()
              .then(() => resolve(true))
              .catch(() => resolve(true));
          } else {
            resolve(true);
          }
        };
        img.onerror = () => {
          console.warn(`[Preloader] Failed to load image: ${url}`);
          resolve(false);
        };
        img.crossOrigin = "anonymous";
        img.src = url;
      });
    }

    // Use fetch for non-image assets (scripts, HTML, CSS, models)
    return fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer(); // Force full download into memory
      })
      .then(() => true)
      .catch((err) => {
        console.warn(`[Preloader] Failed to load: ${url}`, err);
        return false;
      });
  }

  /**
   * Get asset type label for progress display
   */
  function getAssetTypeLabel(url) {
    if (url.endsWith(".obj")) return "model";
    if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg"))
      return "texture";
    if (url.endsWith(".html")) return "component";
    if (url.endsWith(".css")) return "style";
    if (url.endsWith(".js")) return "script";
    if (url.includes("aframe")) return "A-Frame";
    if (url.includes("tailwind")) return "Tailwind";
    if (url.includes("supabase")) return "Supabase";
    if (url.includes("html2canvas")) return "html2canvas";
    return "asset";
  }

  /**
   * PHASE 1: Preload essential assets (scripts, CSS, components, textures) - fast!
   * Textures are now compressed JPGs (366KB + 1.5MB) so they load in Phase 1.
   * Only heavy 3D models are deferred to Phase 2 (background).
   */
  async function preloadAllAssets() {
    // Phase 1: Essential assets INCLUDING textures (small JPGs now)
    const essentialAssets = [
      ...ALL_TEXTURES, // Textures first! (366KB + 1.5MB = fast)
      ...ALL_EXTERNAL_SCRIPTS,
      ...ALL_LOCAL_SCRIPTS,
      ...ALL_COMPONENTS,
      ...ALL_PAGES,
      ...ALL_CSS,
    ];
    state.totalAssets = essentialAssets.length;
    state.loadedAssets = 0;

    console.log(
      `[Preloader] Phase 1: Loading ${state.totalAssets} essential assets...`,
    );
    console.log(
      `  - ${ALL_TEXTURES.length} textures (compressed JPGs - fast!)`,
    );
    console.log(`  - ${ALL_EXTERNAL_SCRIPTS.length} external libraries`);
    console.log(`  - ${ALL_LOCAL_SCRIPTS.length} scripts`);
    console.log(`  - ${ALL_COMPONENTS.length} components`);
    console.log(`  - ${ALL_CSS.length} stylesheets`);
    console.log(
      `  - 3D models (${ALL_MODELS.length}) will load in background after page shows`,
    );

    // Load assets with concurrency limit to avoid overwhelming the browser
    const concurrency = 6;
    let index = 0;

    const loadNext = async () => {
      while (index < essentialAssets.length) {
        const currentIndex = index++;
        const url = essentialAssets[currentIndex];
        const success = await preloadAsset(url);

        state.loadedAssets++;
        if (!success) state.errors.push(url);

        const assetName = url.split("/").pop();
        const assetType = getAssetTypeLabel(url);
        updateProgress(
          state.loadedAssets,
          state.totalAssets,
          `Loading ${assetType}: ${assetName}`,
        );
      }
    };

    // Start concurrent loaders
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(loadNext());
    }

    await Promise.all(workers);

    console.log(
      `[Preloader] Phase 1 Complete: ${state.loadedAssets}/${state.totalAssets} essential assets loaded`,
    );
    if (state.errors.length > 0) {
      console.warn(
        `[Preloader] ${state.errors.length} assets failed:`,
        state.errors,
      );
    }

    // Mark Phase 1 as complete - show page immediately!
    state.isLoading = false;
    updateProgress(state.totalAssets, state.totalAssets, "Ready!");

    // Small delay before hiding to show 100%
    setTimeout(() => {
      hideLoadingScreen();
      // Start Phase 2: Background preload 3D models while user interacts
      startBackgroundPreload();
    }, 300);
  }

  /**
   * PHASE 2: Background preload 3D models only
   * Textures are already loaded in Phase 1 (compressed JPGs).
   * Runs quietly after page is shown - user can interact while this happens.
   */
  async function startBackgroundPreload() {
    const heavyAssets = [...ALL_MODELS]; // Only models - textures done in Phase 1
    if (heavyAssets.length === 0) return;

    state.backgroundPreloading = true;
    state.backgroundTotal = heavyAssets.length;
    state.backgroundLoaded = 0;

    console.log(
      `[Preloader] Phase 2: Background loading ${heavyAssets.length} 3D assets...`,
    );

    // Show subtle background loading indicator
    showBackgroundLoadingIndicator();

    // Load with lower concurrency to not slow down user interaction
    const concurrency = 2; // Lower than phase 1 to be less intrusive
    let index = 0;

    const loadNext = async () => {
      while (index < heavyAssets.length) {
        const currentIndex = index++;
        const url = heavyAssets[currentIndex];
        const success = await preloadAsset(url);

        state.backgroundLoaded++;
        if (!success) state.errors.push(url);

        // Update background progress indicator
        updateBackgroundProgress();

        const assetName = url.split("/").pop();
        console.log(
          `[Preloader] Background: ${state.backgroundLoaded}/${state.backgroundTotal} - ${assetName}`,
        );

        // Small delay between loads to prevent frame drops
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    };

    // Start concurrent loaders
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(loadNext());
    }

    await Promise.all(workers);

    state.backgroundPreloading = false;
    state.backgroundComplete = true;
    hideBackgroundLoadingIndicator();

    console.log(
      `[Preloader] Phase 2 Complete: All ${state.backgroundTotal} 3D assets cached!`,
    );
    console.log(`[Preloader] Furniture will now load instantly when dragged.`);
  }

  /**
   * Show a subtle progress indicator for background loading
   */
  function showBackgroundLoadingIndicator() {
    // Create a subtle bottom bar that shows background loading progress
    const indicator = document.createElement("div");
    indicator.id = "background-preload-indicator";
    indicator.innerHTML = `
      <div class="bg-preload-text">
        <span class="bg-preload-icon">📦</span>
        <span class="bg-preload-label">Loading furniture models...</span>
        <span class="bg-preload-count" id="bg-preload-count">0/${state.backgroundTotal}</span>
      </div>
      <div class="bg-preload-bar">
        <div class="bg-preload-fill" id="bg-preload-fill"></div>
      </div>
    `;

    const style = document.createElement("style");
    style.id = "background-preload-styles";
    style.textContent = `
      #background-preload-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(10, 10, 10, 0.9);
        border: 1px solid rgba(255, 140, 0, 0.3);
        border-radius: 12px;
        padding: 12px 16px;
        z-index: 9999;
        font-family: system-ui, -apple-system, sans-serif;
        min-width: 220px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
      }
      
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100px); opacity: 0; }
      }
      
      .bg-preload-text {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        color: #fff;
        font-size: 13px;
      }
      
      .bg-preload-icon {
        font-size: 16px;
      }
      
      .bg-preload-label {
        flex: 1;
        color: rgba(255, 255, 255, 0.8);
      }
      
      .bg-preload-count {
        color: #FF8C00;
        font-weight: 600;
        font-size: 12px;
      }
      
      .bg-preload-bar {
        height: 4px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }
      
      .bg-preload-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #FF8C00, #FFA500);
        border-radius: 2px;
        transition: width 0.3s ease;
      }
      
      #background-preload-indicator.complete {
        border-color: rgba(34, 197, 94, 0.5);
      }
      
      #background-preload-indicator.complete .bg-preload-fill {
        background: linear-gradient(90deg, #22c55e, #4ade80);
      }
      
      #background-preload-indicator.hiding {
        animation: slideOut 0.3s ease forwards;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(indicator);
  }

  /**
   * Update background loading progress
   */
  function updateBackgroundProgress() {
    const fill = document.getElementById("bg-preload-fill");
    const count = document.getElementById("bg-preload-count");
    const indicator = document.getElementById("background-preload-indicator");

    if (fill && count) {
      const percent = (state.backgroundLoaded / state.backgroundTotal) * 100;
      fill.style.width = `${percent}%`;
      count.textContent = `${state.backgroundLoaded}/${state.backgroundTotal}`;

      // Show complete state
      if (state.backgroundLoaded >= state.backgroundTotal && indicator) {
        indicator.classList.add("complete");
        const label = indicator.querySelector(".bg-preload-label");
        if (label) label.textContent = "All furniture ready!";
      }
    }
  }

  /**
   * Hide background loading indicator
   */
  function hideBackgroundLoadingIndicator() {
    const indicator = document.getElementById("background-preload-indicator");
    if (indicator) {
      // Show complete state for a moment
      setTimeout(() => {
        indicator.classList.add("hiding");
        setTimeout(() => {
          indicator.remove();
          const style = document.getElementById("background-preload-styles");
          if (style) style.remove();
        }, 300);
      }, 2000); // Show "complete" for 2 seconds before hiding
    }
  }

  /**
   * Initialize preloader
   */
  function init() {
    // Create loading screen immediately
    createLoadingScreen();

    // Start preloading
    preloadAllAssets();
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Expose for debugging
  window.IndexPreloader = {
    getState: () => ({ ...state }),
    isComplete: () => !state.isLoading,
    isBackgroundComplete: () => state.backgroundComplete,
    getBackgroundProgress: () => ({
      loading: state.backgroundPreloading,
      complete: state.backgroundComplete,
      loaded: state.backgroundLoaded,
      total: state.backgroundTotal,
      percent:
        state.backgroundTotal > 0
          ? Math.round((state.backgroundLoaded / state.backgroundTotal) * 100)
          : 0,
    }),
  };
})();
