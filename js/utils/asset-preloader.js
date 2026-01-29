// asset-preloader.js
// Preloads all frequently used assets (3D models, textures) into memory
// so they appear instantly when dragged into the workspace.

(() => {
  "use strict";

  // BACKGROUND PRELOADING: Models are already cached from index page background preload
  // This preloader populates the THREE.js cache from browser cache (very fast)
  const LAZY_LOADING_MODE = false; // Models are pre-cached, load them all into THREE.js

  // All models - they're already in browser cache from index page background preload
  const PRELOAD_MODELS = [
    "bed1.obj",
    "bed2.obj",
    "center_table1.obj",
    "center_table2.obj",
    "chair1.obj",
    "chair2.obj",
    "desk1.obj",
    "desk2.obj",
    "mirror1.obj",
    "mirror2.obj",
    "shelf1.obj",
    "shelf2.obj",
    "wardrobe_modern.obj",
    "wardrobe_traditional.obj",
    "wardrobe_openframe.obj",
  ];

  // Textures - also pre-cached from index page
  const PRELOAD_TEXTURES = ["asset/textures/wood4k.png"];

  // Configuration: HTML components to preload (for faster UI)
  const PRELOAD_COMPONENTS = [
    "components/side-panel.html",
    "components/resize-panel.html",
    "components/cost-panel.html",
    "components/furniture-controls.html",
    "components/sources-panel.html",
    "components/dialog-modal.html",
  ];

  // Preload state
  const preloadState = {
    isPreloading: false,
    isComplete: false,
    totalAssets: 0,
    loadedAssets: 0,
    errors: [],
    callbacks: [],
    startTime: 0,
  };

  // Component cache for HTML components
  const COMPONENT_CACHE = new Map();

  /**
   * Get the base path for local models
   */
  function getLocalModelBasePath() {
    return "asset/models/";
  }

  /**
   * Preload a single OBJ model using the existing preloadObjModel helper
   * @param {string} modelPath - Path to the OBJ file
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  function preloadModel(modelPath) {
    return new Promise((resolve) => {
      // Use the global preloadObjModel if available (from cached-obj-model.js)
      if (typeof window.preloadObjModel === "function") {
        window
          .preloadObjModel(modelPath)
          .then((result) => {
            resolve(result !== null);
          })
          .catch(() => {
            resolve(false);
          });
      } else if (window.THREE && typeof THREE.OBJLoader === "function") {
        // Fallback: manually load using THREE.OBJLoader
        const loader = new THREE.OBJLoader();
        loader.load(
          modelPath,
          () => resolve(true),
          undefined,
          () => resolve(false),
        );
      } else {
        // No loader available, skip
        console.warn(
          `[AssetPreloader] OBJLoader not available, skipping: ${modelPath}`,
        );
        resolve(false);
      }
    });
  }

  /**
   * Preload a single texture
   * @param {string} texturePath - Path to the texture file
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  function preloadTexture(texturePath) {
    return new Promise((resolve) => {
      // Use the global preloadTexture if available (from textured-model.js)
      if (typeof window.preloadTexture === "function") {
        window
          .preloadTexture(texturePath)
          .then((success) => resolve(success))
          .catch(() => resolve(false));
      } else if (window.THREE && typeof THREE.TextureLoader === "function") {
        const loader = new THREE.TextureLoader();
        loader.load(
          texturePath,
          () => resolve(true),
          undefined,
          () => {
            console.warn(
              `[AssetPreloader] Failed to preload texture: ${texturePath}`,
            );
            resolve(false);
          },
        );
      } else {
        // Fallback: use Image for basic preloading
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => {
          console.warn(
            `[AssetPreloader] Failed to preload texture: ${texturePath}`,
          );
          resolve(false);
        };
        img.src = texturePath;
      }
    });
  }

  /**
   * Preload an HTML component
   * @param {string} componentPath - Path to the HTML component
   * @returns {Promise<boolean>} - True if loaded successfully
   */
  function preloadComponent(componentPath) {
    return new Promise((resolve) => {
      if (COMPONENT_CACHE.has(componentPath)) {
        resolve(true);
        return;
      }

      fetch(componentPath)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((html) => {
          COMPONENT_CACHE.set(componentPath, html);
          resolve(true);
        })
        .catch(() => {
          console.warn(
            `[AssetPreloader] Failed to preload component: ${componentPath}`,
          );
          resolve(false);
        });
    });
  }

  /**
   * Update progress and notify callbacks
   */
  function updateProgress() {
    const progress =
      preloadState.totalAssets > 0
        ? Math.round(
            (preloadState.loadedAssets / preloadState.totalAssets) * 100,
          )
        : 0;

    // Dispatch custom event for UI updates
    window.dispatchEvent(
      new CustomEvent("assetPreloadProgress", {
        detail: {
          loaded: preloadState.loadedAssets,
          total: preloadState.totalAssets,
          progress: progress,
          errors: preloadState.errors.length,
        },
      }),
    );

    // Call registered callbacks
    preloadState.callbacks.forEach((cb) => {
      try {
        cb({
          loaded: preloadState.loadedAssets,
          total: preloadState.totalAssets,
          progress: progress,
        });
      } catch (e) {
        console.warn("[AssetPreloader] Callback error:", e);
      }
    });
  }

  /**
   * Get list of models to preload, including any from Supabase storage
   * @returns {string[]} - Array of model URLs
   */
  function getModelUrlsToPreload() {
    const urls = [];
    const basePath = getLocalModelBasePath();

    // Add local models
    PRELOAD_MODELS.forEach((model) => {
      urls.push(basePath + model);
    });

    // If STORAGE_MODEL_FILES is available, also preload from Supabase
    if (window.STORAGE_MODEL_FILES) {
      Object.values(window.STORAGE_MODEL_FILES).forEach((file) => {
        const fullPath = basePath + file;
        if (!urls.includes(fullPath)) {
          urls.push(fullPath);
        }
      });
    }

    return urls;
  }

  /**
   * Main preload function - preloads all assets
   * @param {Object} options - Configuration options
   * @param {boolean} options.showProgress - Whether to show loading UI
   * @param {Function} options.onProgress - Progress callback
   * @param {Function} options.onComplete - Completion callback
   * @returns {Promise<Object>} - Preload result
   */
  async function preloadAllAssets(options = {}) {
    if (preloadState.isComplete) {
      console.log("[AssetPreloader] Assets already preloaded");
      if (options.onComplete) options.onComplete({ cached: true });
      return { cached: true, success: true };
    }

    if (preloadState.isPreloading) {
      console.log("[AssetPreloader] Preload already in progress");
      return new Promise((resolve) => {
        preloadState.callbacks.push(() => {
          if (preloadState.isComplete) {
            resolve({ success: true, waited: true });
          }
        });
      });
    }

    preloadState.isPreloading = true;
    preloadState.loadedAssets = 0;
    preloadState.errors = [];

    if (options.onProgress) {
      preloadState.callbacks.push(options.onProgress);
    }

    console.log("[AssetPreloader] Starting asset preload...");

    // Collect all assets to preload
    const modelUrls = getModelUrlsToPreload();
    const textureUrls = [...PRELOAD_TEXTURES];

    preloadState.totalAssets = modelUrls.length + textureUrls.length;
    updateProgress();

    // Show loading UI if requested
    if (options.showProgress) {
      showLoadingUI();
    }

    // Preload models (in parallel with concurrency limit)
    const modelPromises = modelUrls.map(async (url) => {
      const success = await preloadModel(url);
      preloadState.loadedAssets++;
      if (!success) {
        preloadState.errors.push({ type: "model", url });
      }
      updateProgress();
      return success;
    });

    // Preload textures (in parallel)
    const texturePromises = textureUrls.map(async (url) => {
      const success = await preloadTexture(url);
      preloadState.loadedAssets++;
      if (!success) {
        preloadState.errors.push({ type: "texture", url });
      }
      updateProgress();
      return success;
    });

    // Wait for all to complete
    await Promise.all([...modelPromises, ...texturePromises]);

    preloadState.isPreloading = false;
    preloadState.isComplete = true;

    // Hide loading UI
    if (options.showProgress) {
      hideLoadingUI();
    }

    const result = {
      success: preloadState.errors.length === 0,
      loaded: preloadState.loadedAssets,
      total: preloadState.totalAssets,
      errors: preloadState.errors,
    };

    console.log(
      `[AssetPreloader] Preload complete: ${result.loaded}/${result.total} assets loaded`,
    );
    if (result.errors.length > 0) {
      console.warn(
        `[AssetPreloader] ${result.errors.length} assets failed to load:`,
        result.errors,
      );
    }

    // Dispatch completion event
    window.dispatchEvent(
      new CustomEvent("assetPreloadComplete", { detail: result }),
    );

    if (options.onComplete) {
      options.onComplete(result);
    }

    return result;
  }

  /**
   * Create and show loading UI overlay
   */
  function showLoadingUI() {
    // Don't create duplicate loading overlays
    if (document.getElementById("asset-preload-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "asset-preload-overlay";
    overlay.innerHTML = `
      <div class="preload-content">
        <div class="preload-spinner"></div>
        <h3 class="preload-title">Loading Assets</h3>
        <p class="preload-status">Preparing furniture models...</p>
        <div class="preload-progress-bar">
          <div class="preload-progress-fill" id="preload-progress-fill"></div>
        </div>
        <p class="preload-percent" id="preload-percent">0%</p>
      </div>
    `;

    // Add styles
    const style = document.createElement("style");
    style.id = "asset-preload-styles";
    style.textContent = `
      #asset-preload-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(10, 10, 10, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        animation: fadeIn 0.3s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .preload-content {
        text-align: center;
        color: white;
        max-width: 400px;
        padding: 40px;
      }

      .preload-spinner {
        width: 60px;
        height: 60px;
        border: 4px solid rgba(255, 255, 255, 0.1);
        border-top-color: #FF8C00;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 24px;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .preload-title {
        font-size: 24px;
        font-weight: 600;
        margin: 0 0 8px;
        color: #fff;
      }

      .preload-status {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin: 0 0 24px;
      }

      .preload-progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }

      .preload-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #FF8C00, #FFA500);
        border-radius: 4px;
        width: 0%;
        transition: width 0.2s ease;
      }

      .preload-percent {
        font-size: 16px;
        font-weight: 500;
        color: #FF8C00;
        margin: 0;
      }

      #asset-preload-overlay.hiding {
        animation: fadeOut 0.3s ease forwards;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Listen for progress updates
    window.addEventListener("assetPreloadProgress", updateLoadingUI);
  }

  /**
   * Update the loading UI progress
   */
  function updateLoadingUI(event) {
    const { loaded, total, progress } = event.detail;

    const progressFill = document.getElementById("preload-progress-fill");
    const percentText = document.getElementById("preload-percent");
    const statusText = document.querySelector(".preload-status");

    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }

    if (percentText) {
      percentText.textContent = `${progress}%`;
    }

    if (statusText) {
      statusText.textContent = `Loading ${loaded} of ${total} assets...`;
    }
  }

  /**
   * Hide and remove the loading UI
   */
  function hideLoadingUI() {
    const overlay = document.getElementById("asset-preload-overlay");
    if (overlay) {
      overlay.classList.add("hiding");
      setTimeout(() => {
        overlay.remove();
        const style = document.getElementById("asset-preload-styles");
        if (style) style.remove();
      }, 300);
    }

    window.removeEventListener("assetPreloadProgress", updateLoadingUI);
  }

  /**
   * Check if preloading is complete
   * @returns {boolean}
   */
  function isPreloadComplete() {
    return preloadState.isComplete;
  }

  /**
   * Get current preload state
   * @returns {Object}
   */
  function getPreloadState() {
    return { ...preloadState };
  }

  /**
   * Add a specific model to preload (for dynamic additions)
   * @param {string} modelUrl - URL of the model to preload
   * @returns {Promise<boolean>}
   */
  async function preloadSingleModel(modelUrl) {
    return preloadModel(modelUrl);
  }

  /**
   * Add a specific texture to preload (for dynamic additions)
   * @param {string} textureUrl - URL of the texture to preload
   * @returns {Promise<boolean>}
   */
  async function preloadSingleTexture(textureUrl) {
    return preloadTexture(textureUrl);
  }

  // Expose public API
  window.AssetPreloader = {
    preloadAll: preloadAllAssets,
    preloadModel: preloadSingleModel,
    preloadTexture: preloadSingleTexture,
    isComplete: isPreloadComplete,
    getState: getPreloadState,
    showLoading: showLoadingUI,
    hideLoading: hideLoadingUI,
  };

  // Auto-preload when DOM is ready (can be disabled by setting window.DISABLE_AUTO_PRELOAD = true)
  // Note: showProgress is false because assets are already preloaded on the index page
  document.addEventListener("DOMContentLoaded", () => {
    // Wait for A-Frame and THREE.js to be ready
    const checkAndPreload = () => {
      if (window.DISABLE_AUTO_PRELOAD) {
        console.log("[AssetPreloader] Auto-preload disabled");
        return;
      }

      // Check if THREE.js and OBJLoader are available
      if (window.THREE && typeof THREE.OBJLoader === "function") {
        // Small delay to ensure scene is initialized
        // Assets are already in browser cache from index preloader, just populate THREE.js cache
        setTimeout(() => {
          preloadAllAssets({ showProgress: false });
        }, 100);
      } else {
        // Wait for A-Frame scene to load THREE.js
        const scene = document.querySelector("a-scene");
        if (scene) {
          if (scene.hasLoaded) {
            setTimeout(() => {
              preloadAllAssets({ showProgress: false });
            }, 100);
          } else {
            scene.addEventListener("loaded", () => {
              preloadAllAssets({ showProgress: false });
            });
          }
        } else {
          // No scene found, try again shortly
          setTimeout(checkAndPreload, 500);
        }
      }
    };

    checkAndPreload();
  });
})();
