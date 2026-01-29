// index-preloader.js
// Shows loading screen on first load and preloads ALL assets
// (models, textures, components, scripts) so the planner loads instantly.

(() => {
  "use strict";

  // All models to preload (local paths)
  const ALL_MODELS = [
    "asset/models/bed1.obj",
    "asset/models/bed2.obj",
    "asset/models/center_table1.obj",
    "asset/models/center_table2.obj",
    "asset/models/chair1.obj",
    "asset/models/chair2.obj",
    "asset/models/desk1.obj",
    "asset/models/desk2.obj",
    "asset/models/mirror1.obj",
    "asset/models/mirror2.obj",
    "asset/models/shelf1.obj",
    "asset/models/shelf2.obj",
    "asset/models/wardrobe_modern.obj",
    "asset/models/wardrobe_traditional.obj",
    "asset/models/wardrobe_openframe.obj",
  ];

  // Textures to preload
  const ALL_TEXTURES = ["asset/textures/wood4k.png"];

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
   * Preload a single asset using fetch
   */
  function preloadAsset(url) {
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
   * Preload all assets (models, textures, components, pages, CSS, scripts)
   */
  async function preloadAllAssets() {
    // Combine all assets to preload - external scripts first (heaviest), then local
    const allAssets = [
      ...ALL_EXTERNAL_SCRIPTS,
      ...ALL_TEXTURES,
      ...ALL_MODELS,
      ...ALL_LOCAL_SCRIPTS,
      ...ALL_COMPONENTS,
      ...ALL_PAGES,
      ...ALL_CSS,
    ];
    state.totalAssets = allAssets.length;
    state.loadedAssets = 0;

    console.log(
      `[Preloader] Starting preload of ${state.totalAssets} assets...`,
    );
    console.log(`  - ${ALL_EXTERNAL_SCRIPTS.length} external libraries`);
    console.log(`  - ${ALL_MODELS.length} 3D models`);
    console.log(`  - ${ALL_TEXTURES.length} textures`);
    console.log(`  - ${ALL_LOCAL_SCRIPTS.length} scripts`);
    console.log(`  - ${ALL_COMPONENTS.length} components`);
    console.log(`  - ${ALL_CSS.length} stylesheets`);

    // Load assets with concurrency limit to avoid overwhelming the browser
    const concurrency = 6;
    let index = 0;

    const loadNext = async () => {
      while (index < allAssets.length) {
        const currentIndex = index++;
        const url = allAssets[currentIndex];
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
      `[Preloader] Complete: ${state.loadedAssets}/${state.totalAssets} assets loaded`,
    );
    if (state.errors.length > 0) {
      console.warn(
        `[Preloader] ${state.errors.length} assets failed:`,
        state.errors,
      );
    }

    // Mark as complete
    state.isLoading = false;
    updateProgress(state.totalAssets, state.totalAssets, "Ready!");

    // Small delay before hiding to show 100%
    setTimeout(hideLoadingScreen, 300);
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
  };
})();
