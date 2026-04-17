// asset-preloader.js
// Preloads all frequently used assets (3D models, textures) into memory
// so they appear instantly when dragged into the workspace.
//
// PERFORMANCE: OBJ parsing is moved to a Web Worker so it NEVER blocks
// the main thread.  The worker parses the OBJ text into Float32Array
// buffers, transfers them back, and we reconstruct a lightweight
// THREE.Object3D on the main thread (instant, no string parsing).

(() => {
  "use strict";

  // All models to preload in the background
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

  // Textures - compressed JPGs, pre-cached from index page
  const PRELOAD_TEXTURES = ["asset/textures/wood2k.jpg"];

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

  // ── IndexedDB persistent cache ─────────────────────────────────────
  // Stores pre-parsed model geometry (Float32Arrays) so subsequent page
  // loads skip both network fetch AND worker parsing — near-instant.
  const IDB_NAME = "RoomPlannerAssets";
  const IDB_STORE = "models";
  const IDB_VERSION = 1; // Bump to invalidate all cached models
  let _idb = null;

  async function openIDB() {
    if (_idb) return _idb;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const name of db.objectStoreNames) db.deleteObjectStore(name);
          db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => {
          _idb = req.result;
          resolve(_idb);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function getIDBModel(key) {
    try {
      const db = await openIDB();
      if (!db) return null;
      return new Promise((resolve) => {
        const tx = db.transaction(IDB_STORE, "readonly");
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function setIDBModel(key, meshBuffers) {
    try {
      const db = await openIDB();
      if (!db) return;
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(meshBuffers, key);
    } catch {
      /* silent */
    }
  }

  async function clearIDBCache() {
    try {
      const db = await openIDB();
      if (!db) return;
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
      console.log("[AssetPreloader] IndexedDB cache cleared");
    } catch {
      /* silent */
    }
  }

  // ── Web Worker management ──────────────────────────────────────────
  let objWorker = null;
  let workerIdCounter = 0;
  const pendingWorkerJobs = new Map(); // id -> { resolve, reject }

  /**
   * Lazily create / return the OBJ parser Web Worker.
   */
  function getObjWorker() {
    if (objWorker) return objWorker;

    try {
      objWorker = new Worker("js/workers/obj-parser-worker.js");
      objWorker.onmessage = (e) => {
        const { id, url, cacheKey, meshes, error } = e.data;
        const job = pendingWorkerJobs.get(id);
        if (!job) return;
        pendingWorkerJobs.delete(id);

        if (error) {
          console.warn(
            `[AssetPreloader] Worker parse failed for ${url}: ${error}`,
          );
          job.resolve(false);
          return;
        }

        // Validate: only cache if the parser produced real geometry
        const hasGeometry =
          meshes && meshes.some((m) => m.positions && m.positions.length > 0);
        if (!hasGeometry) {
          console.warn(
            `[AssetPreloader] Worker produced empty geometry for ${url}, skipping cache`,
          );
          job.resolve(false);
          return;
        }

        // Inject the pre-parsed geometry into the OBJ cache so that
        // cached-obj-model.js returns it instantly on demand.
        // Use cacheKey (the relative path) so the key matches what
        // cached-obj-model.js will look up when furniture is spawned.
        if (typeof window.injectObjWorkerResult === "function") {
          window.injectObjWorkerResult(cacheKey || url, meshes);
        }

        // Persist to IndexedDB so next page load skips download + parse
        const idbCopy = meshes.map((m) => ({
          positions: m.positions ? new Float32Array(m.positions) : null,
          normals: m.normals ? new Float32Array(m.normals) : null,
          uvs: m.uvs ? new Float32Array(m.uvs) : null,
        }));
        setIDBModel(cacheKey || url, idbCopy);

        job.resolve(true);
      };

      objWorker.onerror = (err) => {
        console.warn("[AssetPreloader] Worker error:", err.message);
        // Reject all pending jobs
        for (const [, job] of pendingWorkerJobs) {
          job.resolve(false);
        }
        pendingWorkerJobs.clear();
      };
    } catch (err) {
      console.warn("[AssetPreloader] Failed to create worker:", err);
      objWorker = null;
    }
    return objWorker;
  }

  /**
   * Terminate the worker when preloading is done to free resources.
   */
  function terminateWorker() {
    if (objWorker) {
      objWorker.terminate();
      objWorker = null;
    }
  }

  // ── Model preloading ───────────────────────────────────────────────

  /**
   * Get the base path for local models
   */
  function getLocalModelBasePath() {
    return "asset/models/";
  }

  /**
   * Convert a potentially-relative URL to absolute so the Web Worker
   * (whose base URL is js/workers/) can fetch it correctly.
   */
  function toAbsoluteUrl(relativeUrl) {
    try {
      return new URL(relativeUrl, window.location.href).href;
    } catch (_) {
      return relativeUrl;
    }
  }

  /**
   * Preload a single OBJ model using the Web Worker (off main thread).
   * If objText is provided, skips the fetch and sends text directly to the worker.
   * Falls back to main-thread OBJLoader if the worker is unavailable.
   */
  function preloadModel(modelPath, objText) {
    // Skip if already in the OBJ cache
    if (
      typeof window.isObjModelCached === "function" &&
      window.isObjModelCached(modelPath)
    ) {
      return Promise.resolve(true);
    }

    const worker = getObjWorker();

    if (worker) {
      return new Promise((resolve) => {
        const id = ++workerIdCounter;
        pendingWorkerJobs.set(id, { resolve });
        const msg = {
          id,
          url: toAbsoluteUrl(modelPath),
          cacheKey: modelPath,
        };
        // If text is provided, pass it to skip the worker's fetch
        if (objText) msg.text = objText;
        worker.postMessage(msg);
      });
    }

    // ── Fallback: main-thread OBJLoader (only if worker failed) ──
    return new Promise((resolve) => {
      if (typeof window.preloadObjModel === "function") {
        window
          .preloadObjModel(modelPath)
          .then((result) => resolve(result !== null))
          .catch(() => resolve(false));
      } else {
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
    const componentUrls = [...PRELOAD_COMPONENTS];

    preloadState.totalAssets =
      modelUrls.length + textureUrls.length + componentUrls.length;
    preloadState.startTime = performance.now();
    updateProgress();

    // Show loading UI if requested
    if (options.showProgress) {
      showLoadingUI();
    }

    // PERFORMANCE: Models are parsed in a Web Worker – zero main-thread blocking.
    // We download ALL models in parallel on the main thread (browser uses
    // 6 concurrent connections), then send each to the worker for parsing
    // as soon as it arrives.  This eliminates the sequential download bottleneck.

    // Load textures + components in parallel (tiny, near-instant)
    const smallAssetPromises = [
      ...textureUrls.map(async (url) => {
        const success = await preloadTexture(url);
        preloadState.loadedAssets++;
        if (!success) preloadState.errors.push({ type: "texture", url });
        updateProgress();
      }),
      ...componentUrls.map(async (url) => {
        const success = await preloadComponent(url);
        preloadState.loadedAssets++;
        if (!success) preloadState.errors.push({ type: "component", url });
        updateProgress();
      }),
    ];

    // Start ALL model downloads simultaneously.
    // The browser will use up to 6 concurrent connections.
    // As each download finishes, we send it to the worker for parsing.
    // On subsequent loads, IndexedDB provides pre-parsed geometry instantly.
    let idbHits = 0;
    const modelPromises = modelUrls.map(async (url) => {
      try {
        // Skip if already in memory cache
        if (
          typeof window.isObjModelCached === "function" &&
          window.isObjModelCached(url)
        ) {
          preloadState.loadedAssets++;
          updateProgress();
          return;
        }

        // Check IndexedDB persistent cache (skips download + parsing)
        const cached = await getIDBModel(url);
        if (cached) {
          if (typeof window.injectObjWorkerResult === "function") {
            window.injectObjWorkerResult(url, cached);
          }
          idbHits++;
          preloadState.loadedAssets++;
          updateProgress();
          return;
        }

        // Not cached — fetch on main thread (parallel downloads)
        const response = await fetch(toAbsoluteUrl(url));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const objText = await response.text();

        // Send to worker for parsing (off main thread)
        const success = await preloadModel(url, objText);
        preloadState.loadedAssets++;
        if (!success) preloadState.errors.push({ type: "model", url });
        updateProgress();
      } catch (e) {
        preloadState.loadedAssets++;
        preloadState.errors.push({ type: "model", url });
        updateProgress();
      }
    });

    // Wait for everything to finish
    await Promise.all([...smallAssetPromises, ...modelPromises]);

    // Worker is no longer needed – free its resources
    terminateWorker();

    // DEFERRED: 3D thumbnails are generated AFTER the loading screen hides.
    // The SVG fallback icons are already clear and usable, so the user
    // can interact immediately while thumbnails render in the background.

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

    const elapsed = Math.round(performance.now() - preloadState.startTime);
    console.log(
      `[AssetPreloader] Preload complete: ${result.loaded}/${result.total} assets loaded in ${elapsed}ms` +
        (idbHits > 0 ? ` (${idbHits} from cache)` : " (first load)"),
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
    clearCache: clearIDBCache,
  };

  // Auto-preload when DOM is ready (can be disabled by setting window.DISABLE_AUTO_PRELOAD = true)
  // PERFORMANCE: OBJ parsing runs in a Web Worker so it never blocks the main
  // thread.  We only need a short delay to let the scene finish initialising.
  document.addEventListener("DOMContentLoaded", () => {
    const startPreload = () => {
      if (window.DISABLE_AUTO_PRELOAD) {
        console.log("[AssetPreloader] Auto-preload disabled");
        return;
      }
      console.log(
        "[AssetPreloader] Starting background preload (Web Worker)...",
      );
      preloadAllAssets({ showProgress: false });
    };

    const schedulePreload = () => {
      // Short delay – just enough for the A-Frame scene to render its first
      // frame.  The worker does all heavy parsing off-thread, so no jank.
      setTimeout(startPreload, 3000);
    };

    // Make sure THREE.js is available (loaded by A-Frame)
    if (window.THREE) {
      schedulePreload();
    } else {
      const scene = document.querySelector("a-scene");
      if (scene) {
        if (scene.hasLoaded) {
          schedulePreload();
        } else {
          scene.addEventListener("loaded", schedulePreload);
        }
      } else {
        // No scene found, try again shortly
        setTimeout(() => {
          const s = document.querySelector("a-scene");
          if (s) {
            if (s.hasLoaded) schedulePreload();
            else s.addEventListener("loaded", schedulePreload);
          }
        }, 500);
      }
    }
  });
})();
