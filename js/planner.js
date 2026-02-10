// Disable auto-preload in asset-preloader.js — we'll call it explicitly
// during the loading screen so everything is cached before the user sees the room.
window.DISABLE_AUTO_PRELOAD = true;

let draggedItem = null;
let furnitureCounter = 0;
let panelOpen = false;
let selectedFurniture = null; // Track currently selected furniture

// ============= LOADING OVERLAY CONTROLLER =============
const LoadingController = {
  overlay: null,
  statusEl: null,
  fillEl: null,
  percentEl: null,
  isHidden: false,
  currentProgress: 0,
  targetProgress: 0,
  animationFrame: null,

  init() {
    this.overlay = document.getElementById("planner-loading-overlay");
    this.statusEl = document.getElementById("planner-loading-status");
    this.fillEl = document.getElementById("planner-loading-progress-fill");
    this.percentEl = document.getElementById("planner-loading-percent");
    this.currentProgress = 0;
    this.targetProgress = 0;
  },

  updateStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  },

  // Smooth animated progress update
  updateProgress(percent) {
    this.targetProgress = percent;
    if (!this.animationFrame) {
      this._animateProgress();
    }
  },

  _animateProgress() {
    const diff = this.targetProgress - this.currentProgress;

    if (Math.abs(diff) < 0.5) {
      this.currentProgress = this.targetProgress;
      this._renderProgress();
      this.animationFrame = null;
      return;
    }

    // Ease towards target (faster when far, slower when close)
    this.currentProgress += diff * 0.15;
    this._renderProgress();

    this.animationFrame = requestAnimationFrame(() => this._animateProgress());
  },

  _renderProgress() {
    const rounded = Math.round(this.currentProgress);
    if (this.fillEl) this.fillEl.style.width = `${this.currentProgress}%`;
    if (this.percentEl) this.percentEl.textContent = `${rounded}%`;
  },

  hide() {
    if (this.isHidden || !this.overlay) return;
    this.isHidden = true;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.updateStatus("Ready!");
    this.currentProgress = 100;
    this._renderProgress();
    this.overlay.classList.add("fade-out");
    setTimeout(() => {
      if (this.overlay) this.overlay.classList.add("hidden");
    }, 500);
  },

  // Fallback timeout
  startFallbackTimer() {
    setTimeout(() => {
      if (!this.isHidden) {
        console.warn(
          "[Planner] Fallback: hiding loading overlay after timeout",
        );
        this.hide();
      }
    }, 120000); // 120s fallback - models may take time to parse on slow connections
  },
};

/**
 * Pre-upload textures to GPU to prevent stutter when they're first used
 * This is the key to avoiding lag - texture upload to VRAM causes frame drops
 */
async function preUploadTexturesToGPU(statusCallback) {
  const scene = document.querySelector("a-scene");
  if (!scene || !scene.renderer) return;

  const renderer = scene.renderer;

  // Get the floor element which has the fast-loading 2K texture
  const floor = document.getElementById("floor");
  if (!floor) return;

  console.log("[GPU] Pre-uploading textures to VRAM...");
  if (statusCallback) statusCallback("Preparing floor texture...");

  // Wait for the floor's material to have a loaded texture
  // The 2K texture (366KB) should load almost instantly since it was preloaded
  let attempts = 0;
  const maxAttempts = 30; // 3 seconds max wait (2K texture is tiny)

  while (attempts < maxAttempts) {
    const mesh = floor.getObject3D("mesh");
    if (mesh && mesh.material && mesh.material.map && mesh.material.map.image) {
      // Texture is loaded!
      const texture = mesh.material.map;

      if (statusCallback) statusCallback("Uploading texture to GPU...");
      console.log("[GPU] Floor texture loaded, uploading to VRAM...");

      // Force texture upload to GPU - this is what causes lag
      // Doing it during loading screen prevents stutter
      try {
        renderer.initTexture(texture);
      } catch (e) {
        // Fallback: render a frame to force upload
        console.log("[GPU] initTexture not available, using render fallback");
      }

      // Force a render to ensure texture is compiled into shader
      const camera = document.querySelector("a-camera");
      if (camera && camera.components.camera) {
        renderer.render(scene.object3D, camera.components.camera.camera);
      }

      console.log("[GPU] Floor texture uploaded to VRAM");
      break;
    }

    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (attempts >= maxAttempts) {
    console.warn("[GPU] Timeout waiting for floor texture to load");
  }

  // Also upload any other textures that might be in the scene
  if (statusCallback) statusCallback("Uploading materials to GPU...");

  scene.object3D.traverse((obj) => {
    if (obj.material) {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      materials.forEach((mat) => {
        try {
          if (mat.map && mat.map.image) {
            renderer.initTexture(mat.map);
          }
          if (mat.normalMap && mat.normalMap.image) {
            renderer.initTexture(mat.normalMap);
          }
          if (mat.roughnessMap && mat.roughnessMap.image) {
            renderer.initTexture(mat.roughnessMap);
          }
        } catch (e) {
          // Ignore - not all textures may be ready
        }
      });
    }
  });

  console.log("[GPU] All available textures uploaded to VRAM");

  // Give GPU time to process the uploads
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

/**
 * SVG icon map for furniture items in subcategory panels.
 * Replaces emojis with clear, recognizable furniture silhouettes (HCI best practice).
 */
const FURNITURE_SVG_ICONS = {
  center_table1: `<svg width="40" height="36" viewBox="0 0 40 36" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="8" width="32" height="4" rx="2" fill="#9ca3af"/><rect x="7" y="12" width="2.5" height="18" rx="1" fill="#6b7280"/><rect x="30.5" y="12" width="2.5" height="18" rx="1" fill="#6b7280"/><rect x="15" y="12" width="2" height="14" rx="1" fill="#6b7280"/><rect x="23" y="12" width="2" height="14" rx="1" fill="#6b7280"/></svg>`,
  center_table2: `<svg width="40" height="36" viewBox="0 0 40 36" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="10" rx="16" ry="3" fill="#9ca3af"/><rect x="7" y="10" width="2.5" height="20" rx="1" fill="#6b7280"/><rect x="30.5" y="10" width="2.5" height="20" rx="1" fill="#6b7280"/><rect x="18.5" y="10" width="3" height="20" rx="1" fill="#6b7280"/></svg>`,
  chair1: `<svg width="36" height="40" viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="4" width="24" height="3" rx="1.5" fill="#9ca3af"/><rect x="7" y="7" width="2.5" height="14" rx="1" fill="#6b7280"/><rect x="26.5" y="7" width="2.5" height="14" rx="1" fill="#6b7280"/><rect x="6" y="20" width="24" height="4" rx="2" fill="#9ca3af"/><rect x="7" y="24" width="2.5" height="12" rx="1" fill="#6b7280"/><rect x="26.5" y="24" width="2.5" height="12" rx="1" fill="#6b7280"/></svg>`,
  chair2: `<svg width="36" height="40" viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg"><path d="M8 4 Q18 0 28 4 L28 7 L8 7 Z" fill="#9ca3af"/><rect x="8" y="7" width="2.5" height="14" rx="1" fill="#6b7280"/><rect x="25.5" y="7" width="2.5" height="14" rx="1" fill="#6b7280"/><rect x="7" y="20" width="22" height="4" rx="2" fill="#9ca3af"/><rect x="8" y="24" width="2.5" height="12" rx="1" fill="#6b7280"/><rect x="25.5" y="24" width="2.5" height="12" rx="1" fill="#6b7280"/></svg>`,
  bed1: `<svg width="42" height="32" viewBox="0 0 42 32" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="14" width="38" height="10" rx="2" fill="#9ca3af"/><rect x="2" y="4" width="10" height="10" rx="2" fill="#d1d5db"/><rect x="3" y="24" width="3" height="6" rx="1" fill="#6b7280"/><rect x="36" y="24" width="3" height="6" rx="1" fill="#6b7280"/><rect x="2" y="2" width="4" height="12" rx="1" fill="#6b7280"/><rect x="36" y="12" width="4" height="4" rx="1" fill="#6b7280"/></svg>`,
  bed2: `<svg width="42" height="32" viewBox="0 0 42 32" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="14" width="38" height="10" rx="2" fill="#7B8EA0"/><rect x="3" y="6" width="8" height="8" rx="2" fill="#d1d5db"/><rect x="13" y="6" width="8" height="8" rx="2" fill="#d1d5db"/><rect x="3" y="24" width="3" height="6" rx="1" fill="#6b7280"/><rect x="36" y="24" width="3" height="6" rx="1" fill="#6b7280"/><rect x="2" y="2" width="38" height="3" rx="1" fill="#6b7280"/></svg>`,
  desk1: `<svg width="40" height="34" viewBox="0 0 40 34" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="8" width="34" height="3" rx="1.5" fill="#9ca3af"/><rect x="5" y="11" width="2.5" height="18" rx="1" fill="#6b7280"/><rect x="32.5" y="11" width="2.5" height="18" rx="1" fill="#6b7280"/><rect x="28" y="11" width="7" height="12" rx="1" fill="#4b5563" opacity="0.5"/><rect x="14" y="2" width="10" height="6" rx="1" fill="#6b7280" opacity="0.4"/><rect x="16" y="3" width="6" height="4" rx="0.5" fill="#9ca3af" opacity="0.6"/></svg>`,
  desk2: `<svg width="40" height="34" viewBox="0 0 40 34" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="8" width="34" height="3" rx="1.5" fill="#9ca3af"/><rect x="5" y="11" width="7" height="16" rx="1" fill="#4b5563" opacity="0.5"/><rect x="28" y="11" width="7" height="16" rx="1" fill="#4b5563" opacity="0.5"/><rect x="5" y="27" width="2.5" height="4" rx="1" fill="#6b7280"/><rect x="32.5" y="27" width="2.5" height="4" rx="1" fill="#6b7280"/></svg>`,
  mirror1: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="3" width="20" height="30" rx="3" fill="none" stroke="#9ca3af" stroke-width="2.5"/><rect x="7" y="6" width="14" height="24" rx="2" fill="#d1d5db" opacity="0.4"/><line x1="9" y1="8" x2="14" y2="28" stroke="white" stroke-width="0.8" opacity="0.3"/></svg>`,
  mirror2: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="14" cy="18" rx="10" ry="14" fill="none" stroke="#9ca3af" stroke-width="2.5"/><ellipse cx="14" cy="18" rx="7" ry="11" fill="#d1d5db" opacity="0.4"/><line x1="10" y1="8" x2="13" y2="28" stroke="white" stroke-width="0.8" opacity="0.3"/></svg>`,
  shelf1: `<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="2" height="32" rx="1" fill="#6b7280"/><rect x="31" y="2" width="2" height="32" rx="1" fill="#6b7280"/><rect x="3" y="6" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="3" y="16" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="3" y="26" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="7" y="2" width="4" height="3.5" rx="0.5" fill="#d1d5db" opacity="0.5"/><rect x="13" y="10" width="5" height="5.5" rx="0.5" fill="#d1d5db" opacity="0.5"/><rect x="22" y="20" width="6" height="5.5" rx="0.5" fill="#d1d5db" opacity="0.5"/></svg>`,
  shelf2: `<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="2" height="32" rx="1" fill="#6b7280"/><rect x="31" y="2" width="2" height="32" rx="1" fill="#6b7280"/><rect x="3" y="6" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="3" y="16" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="3" y="26" width="30" height="2" rx="1" fill="#9ca3af"/><rect x="8" y="10" width="8" height="5.5" rx="0.5" fill="#d1d5db" opacity="0.5"/><rect x="20" y="2" width="5" height="3.5" rx="0.5" fill="#d1d5db" opacity="0.5"/></svg>`,
  wardrobe1: `<svg width="36" height="40" viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="30" height="34" rx="2" fill="#6b7280"/><line x1="18" y1="2" x2="18" y2="36" stroke="#4b5563" stroke-width="1.5"/><circle cx="15" cy="19" r="1.5" fill="#d1d5db"/><circle cx="21" cy="19" r="1.5" fill="#d1d5db"/><rect x="5" y="36" width="3" height="3" rx="1" fill="#4b5563"/><rect x="28" y="36" width="3" height="3" rx="1" fill="#4b5563"/></svg>`,
  wardrobe2: `<svg width="36" height="40" viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="30" height="34" rx="2" fill="#5a6370"/><line x1="18" y1="2" x2="18" y2="36" stroke="#3e4550" stroke-width="1.5"/><rect x="14" y="16" width="2" height="6" rx="1" fill="#d1d5db"/><rect x="20" y="16" width="2" height="6" rx="1" fill="#d1d5db"/><rect x="5" y="36" width="3" height="3" rx="1" fill="#4b5563"/><rect x="28" y="36" width="3" height="3" rx="1" fill="#4b5563"/></svg>`,
  wardrobe3: `<svg width="36" height="40" viewBox="0 0 36 40" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="30" height="34" rx="2" fill="#6b7280"/><line x1="12" y1="2" x2="12" y2="36" stroke="#4b5563" stroke-width="1"/><line x1="24" y1="2" x2="24" y2="36" stroke="#4b5563" stroke-width="1"/><circle cx="10" cy="19" r="1" fill="#d1d5db"/><circle cx="18" cy="19" r="1" fill="#d1d5db"/><circle cx="26" cy="19" r="1" fill="#d1d5db"/><rect x="5" y="36" width="3" height="3" rx="1" fill="#4b5563"/><rect x="28" y="36" width="3" height="3" rx="1" fill="#4b5563"/></svg>`,
};

/**
 * Get the icon HTML for a given model key.
 * Prefers a rendered 3D thumbnail (from furniture-thumbnails.js) for 100% accuracy.
 * Falls back to SVG silhouette if thumbnail isn't ready yet.
 */
function getFurnitureIconHTML(modelKey) {
  // Try 3D-rendered thumbnail first
  if (window.furnitureThumbnails) {
    const url = window.furnitureThumbnails.getURL(modelKey);
    if (url) {
      return `<img src="${url}" alt="${modelKey}" draggable="false">`;
    }
  }
  // Fallback: SVG silhouette
  if (FURNITURE_SVG_ICONS[modelKey]) {
    return FURNITURE_SVG_ICONS[modelKey];
  }
  return `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="24" height="24" rx="3" fill="#6b7280" opacity="0.6"/><rect x="8" y="8" width="16" height="16" rx="2" fill="#9ca3af" opacity="0.4"/></svg>`;
}

/**
 * Realistic furniture scale configuration.
 * OBJ models are authored at different scales, so we normalize them
 * to produce realistic real-world dimensions in the A-Frame scene (meters).
 * These override the data-scale="1 1 1" from the HTML.
 */
const FURNITURE_SCALES = {
  // Beds - should be large (~2m long, ~1.5m wide, ~0.5m mattress height)
  bed1: "2.5 1.5 2.0",
  bed2: "2.5 1.5 2.0",
  // Chairs - standard dining/desk chair (~0.45m wide, ~0.9m tall)
  chair1: "1.2 1.2 1.2",
  chair2: "1.2 1.2 1.2",
  // Center tables - coffee/center table (~1m wide, ~0.45m tall)
  center_table1: "1.5 1.5 1.5",
  center_table2: "1.5 1.5 1.5",
  // Desks - office/study desk (~1.2m wide, ~0.75m tall)
  desk1: "1.5 1.5 1.5",
  desk2: "1.5 1.5 1.5",
  // Mirrors - wall-mounted (~0.5m wide, ~1m tall)
  mirror1: "1 1 1",
  mirror2: "1 1 1",
  // Shelves - bookshelf/display (~0.8m wide, ~1.5m tall)
  shelf1: "1.3 1.3 1.3",
  shelf2: "1.3 1.3 1.3",
  // Wardrobes - large (~1.2m wide, ~2m tall)
  wardrobe1: "1 1 1",
  wardrobe2: "1 1 1",
  wardrobe3: "1 1 1",
};

/**
 * Furniture material configuration - gives each item type a distinct look
 * instead of applying the same generic wood texture to everything.
 */
const FURNITURE_MATERIALS = {
  // Beds – per-vertex coloured: mattress body (color), pillow, frame
  bed1: {
    color: "#A8C4D8",
    pillowColor: "#F0EDE6",
    frameColor: "#5C3A1E",
    roughness: 0.92,
    metalness: 0.0,
    mode: "bed",
  },
  bed2: {
    color: "#C4A882",
    pillowColor: "#FFF8F0",
    frameColor: "#4A2C17",
    roughness: 0.92,
    metalness: 0.0,
    mode: "bed",
  },
  // Chairs - polished wood
  chair1: { color: "#DEB887", roughness: 0.6, metalness: 0.05, mode: "wood" },
  chair2: { color: "#D2691E", roughness: 0.55, metalness: 0.05, mode: "wood" },
  // Center tables - rich wood grain
  center_table1: {
    color: "#8B4513",
    roughness: 0.5,
    metalness: 0.08,
    mode: "wood",
  },
  center_table2: {
    color: "#A0522D",
    roughness: 0.45,
    metalness: 0.1,
    mode: "wood",
  },
  // Desks - modern laminate
  desk1: { color: "#D2B48C", roughness: 0.4, metalness: 0.12, mode: "wood" },
  desk2: { color: "#BC8F8F", roughness: 0.35, metalness: 0.15, mode: "wood" },
  // Mirrors - handled separately via mode: "mirror"
  mirror1: {
    color: "#d9d9d9",
    roughness: 0.08,
    metalness: 0.85,
    mode: "mirror",
  },
  mirror2: {
    color: "#d9d9d9",
    roughness: 0.08,
    metalness: 0.85,
    mode: "mirror",
  },
  // Shelves - light natural wood
  shelf1: { color: "#F5DEB3", roughness: 0.7, metalness: 0.03, mode: "wood" },
  shelf2: { color: "#FAEBD7", roughness: 0.65, metalness: 0.03, mode: "wood" },
  // Wardrobes - darker finish
  wardrobe1: {
    color: "#654321",
    roughness: 0.5,
    metalness: 0.05,
    mode: "wood",
  },
  wardrobe2: {
    color: "#3E2723",
    roughness: 0.55,
    metalness: 0.05,
    mode: "wood",
  },
  wardrobe3: {
    color: "#5D4037",
    roughness: 0.45,
    metalness: 0.08,
    mode: "wood",
  },
};

/**
 * Get the textured-model attribute string for a given model key.
 * Uses per-item colors/materials so each furniture type looks distinct.
 * Wood-type items still get the wood texture for grain detail; others use flat color.
 */
function getFurnitureMaterialAttr(modelKey) {
  const mat = FURNITURE_MATERIALS[modelKey];
  if (!mat) {
    // Fallback for unknown items - warm wood
    return `src: asset/textures/wood2k.jpg; repeat: 2 2; color: #D2B48C; roughness: 0.7; metalness: 0.05`;
  }
  if (mat.mode === "mirror") {
    return `mode: mirror`;
  }
  if (mat.mode === "bed") {
    // Bed items get per-vertex colouring: mattress body, pillow, frame
    return `mode: bed; color: ${mat.color}; pillowColor: ${mat.pillowColor || "#F5F0E8"}; frameColor: ${mat.frameColor || "#6B4226"}; roughness: ${mat.roughness}; metalness: ${mat.metalness}`;
  }
  if (mat.mode === "wood") {
    // Wood items get the texture for grain + tinted color
    return `src: asset/textures/wood2k.jpg; repeat: 2 2; color: ${mat.color}; roughness: ${mat.roughness}; metalness: ${mat.metalness}`;
  }
  // Color-only items - no texture, just material color
  return `color: ${mat.color}; roughness: ${mat.roughness}; metalness: ${mat.metalness}`;
}

/**
 * GPU Warmup - Pre-compile shaders to prevent stutter on first render
 * This runs invisible renders to force WebGL shader compilation
 */
function warmupGPU() {
  const scene = document.querySelector("a-scene");
  if (!scene || !scene.renderer) return Promise.resolve();

  return new Promise((resolve) => {
    const renderer = scene.renderer;
    const threeScene = scene.object3D;
    const camera = document.querySelector("a-camera");
    if (!camera || !camera.components.camera) {
      resolve();
      return;
    }
    const threeCamera = camera.components.camera.camera;

    // Force render passes to compile all shaders
    console.log("[GPU Warmup] Starting shader compilation...");

    let warmupFrames = 0;
    const maxFrames = 5; // Light warmup - enough to compile shaders without causing lag

    function warmupFrame() {
      if (warmupFrames < maxFrames) {
        // Force material updates on all objects
        if (warmupFrames === 0) {
          threeScene.traverse((obj) => {
            if (obj.material) {
              obj.material.needsUpdate = true;
            }
          });
        }

        renderer.render(threeScene, threeCamera);
        warmupFrames++;
        requestAnimationFrame(warmupFrame);
      } else {
        console.log("[GPU Warmup] Shader compilation complete");
        resolve();
      }
    }

    requestAnimationFrame(warmupFrame);
  });
}

// Register wall outline component
AFRAME.registerComponent("wall-outline", {
  init: function () {
    const el = this.el;
    const w = parseFloat(el.getAttribute("width"));
    const h = parseFloat(el.getAttribute("height"));
    const d = parseFloat(el.getAttribute("depth"));

    const geometry = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x8a8580 });
    const line = new THREE.LineSegments(edges, material);
    line.name = "outline";
    el.object3D.add(line);
  },
});

// Items and prices loaded from Supabase
let ITEMS_DATA = {}; // model_key -> {id, name, category, model_file_path}
let PRICE_LIST = {}; // model_key -> estimated_price
let ITEM_METADATA = {}; // model_key -> {name, model_file_path}
let ITEM_PRICE_SOURCES = {}; // model_key -> [{store, price}]

// Supabase timeout configuration (in milliseconds)
const SUPABASE_TIMEOUT = 10000; // 10 seconds
const MODEL_LOAD_TIMEOUT = 30000; // 30 seconds for model files

const STORAGE_MODEL_FILES = {
  table1: "table1.obj",
  center_table1: "center_table1.obj",
  center_table2: "center_table2.obj",
  wardrobe1: "wardrobe_modern.obj",
  wardrobe2: "wardrobe_traditional.obj",
  wardrobe3: "wardrobe_openframe.obj",
  bed1: "bed1.obj",
  bed2: "bed2.obj",
  chair1: "chair1.obj",
  chair2: "chair2.obj",
  desk1: "desk1.obj",
  desk2: "desk2.obj",
  mirror1: "mirror1.obj",
  mirror2: "mirror2.obj",
  shelf1: "shelf1.obj",
  shelf2: "shelf2.obj",
};

const STORAGE_BUCKET_FILES = new Set([
  "wardrobe_modern.obj",
  "wardrobe_traditional.obj",
  "wardrobe_openframe.obj",
  "center_table1.obj",
  "center_table2.obj",
]);

const FALLBACK_ITEM_NAMES = {
  center_table1: "Center Table 1",
  center_table2: "Center Table 2",
  wardrobe1: "Wardrobe Modern",
  wardrobe2: "Wardrobe Traditional",
  wardrobe3: "Wardrobe Open Frame",
  table1: "Center Table",
  bed1: "Bed 1",
  bed2: "Bed 2",
  chair1: "Chair 1",
  chair2: "Chair 2",
  desk1: "Desk 1",
  desk2: "Desk 2",
  mirror1: "Mirror 1",
  mirror2: "Mirror 2",
  shelf1: "Shelf 1",
  shelf2: "Shelf 2",
};

const FALLBACK_ITEM_METADATA = {
  center_table1: {
    name: "Center Table 1",
    model_file_path: "center_table1.obj",
  },
  center_table2: {
    name: "Center Table 2",
    model_file_path: "center_table2.obj",
  },
  bed1: {
    name: "Bed 1",
    model_file_path: "bed1.obj",
  },
  bed2: {
    name: "Bed 2",
    model_file_path: "bed2.obj",
  },
  chair1: {
    name: "Chair 1",
    model_file_path: "chair1.obj",
  },
  chair2: {
    name: "Chair 2",
    model_file_path: "chair2.obj",
  },
  desk1: {
    name: "Desk 1",
    model_file_path: "desk1.obj",
  },
  desk2: {
    name: "Desk 2",
    model_file_path: "desk2.obj",
  },
  mirror1: {
    name: "Mirror 1",
    model_file_path: "mirror1.obj",
  },
  mirror2: {
    name: "Mirror 2",
    model_file_path: "mirror2.obj",
  },
  shelf1: {
    name: "Shelf 1",
    model_file_path: "shelf1.obj",
  },
  shelf2: {
    name: "Shelf 2",
    model_file_path: "shelf2.obj",
  },
};

// Dummy prices for all items (used when Supabase fails or no price available)
const DUMMY_PRICES = {
  // Tables
  table1: {
    estimatedPrice: 8500,
    sources: [{ store: "Default Store", price: 8500 }],
  },
  center_table1: {
    estimatedPrice: 12000,
    sources: [
      { store: "All-Home", price: 11500 },
      { store: "Wilcon Depot", price: 12500 },
      { store: "Gaisano", price: 12000 },
    ],
  },
  center_table2: {
    estimatedPrice: 15000,
    sources: [
      { store: "All-Home", price: 14500 },
      { store: "Wilcon Depot", price: 15500 },
      { store: "Gaisano", price: 15000 },
    ],
  },
  // Wardrobes
  wardrobe1: {
    estimatedPrice: 11950,
    sources: [
      { store: "All-Home", price: 11500 },
      { store: "Wilcon Depot", price: 12500 },
      { store: "Gaisano", price: 12000 },
      { store: "Local suppliers", price: 11800 },
    ],
  },
  wardrobe2: {
    estimatedPrice: 14950,
    sources: [
      { store: "All-Home", price: 14500 },
      { store: "Wilcon Depot", price: 15500 },
      { store: "Gaisano", price: 15000 },
      { store: "Local suppliers", price: 14800 },
    ],
  },
  wardrobe3: {
    estimatedPrice: 17950,
    sources: [
      { store: "All-Home", price: 17500 },
      { store: "Wilcon Depot", price: 18500 },
      { store: "Gaisano", price: 18000 },
      { store: "Local suppliers", price: 17800 },
    ],
  },
  // Beds
  bed1: {
    estimatedPrice: 25000,
    sources: [
      { store: "All-Home", price: 24000 },
      { store: "Wilcon Depot", price: 26000 },
      { store: "Gaisano", price: 25000 },
    ],
  },
  bed2: {
    estimatedPrice: 30000,
    sources: [
      { store: "All-Home", price: 29000 },
      { store: "Wilcon Depot", price: 31000 },
      { store: "Gaisano", price: 30000 },
    ],
  },
  // Chairs
  chair1: {
    estimatedPrice: 3500,
    sources: [
      { store: "All-Home", price: 3400 },
      { store: "Wilcon Depot", price: 3600 },
      { store: "Gaisano", price: 3500 },
    ],
  },
  chair2: {
    estimatedPrice: 4500,
    sources: [
      { store: "All-Home", price: 4400 },
      { store: "Wilcon Depot", price: 4600 },
      { store: "Gaisano", price: 4500 },
    ],
  },
  // Desks
  desk1: {
    estimatedPrice: 18000,
    sources: [
      { store: "All-Home", price: 17500 },
      { store: "Wilcon Depot", price: 18500 },
      { store: "Gaisano", price: 18000 },
    ],
  },
  desk2: {
    estimatedPrice: 22000,
    sources: [
      { store: "All-Home", price: 21500 },
      { store: "Wilcon Depot", price: 22500 },
      { store: "Gaisano", price: 22000 },
    ],
  },
  // Mirrors
  mirror1: {
    estimatedPrice: 5500,
    sources: [
      { store: "All-Home", price: 5400 },
      { store: "Wilcon Depot", price: 5600 },
      { store: "Gaisano", price: 5500 },
    ],
  },
  mirror2: {
    estimatedPrice: 7500,
    sources: [
      { store: "All-Home", price: 7400 },
      { store: "Wilcon Depot", price: 7600 },
      { store: "Gaisano", price: 7500 },
    ],
  },
  // Shelves
  shelf1: {
    estimatedPrice: 8000,
    sources: [
      { store: "All-Home", price: 7800 },
      { store: "Wilcon Depot", price: 8200 },
      { store: "Gaisano", price: 8000 },
    ],
  },
  shelf2: {
    estimatedPrice: 10000,
    sources: [
      { store: "All-Home", price: 9800 },
      { store: "Wilcon Depot", price: 10200 },
      { store: "Gaisano", price: 10000 },
    ],
  },
};

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects after timeout
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`Operation timed out after ${ms}ms`)),
      ms,
    );
  });
}

/**
 * Fetch with timeout wrapper
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Promise with timeout
 */
async function withTimeout(promise, timeoutMs) {
  return Promise.race([promise, createTimeout(timeoutMs)]);
}

/**
 * Calculate estimated price from prices array using arithmetic mean
 * @param {Array<number>} prices - Array of prices
 * @returns {number} - Estimated price
 */
function calculateEstimatedPrice(prices) {
  if (!prices || prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return Math.round((sum / prices.length) * 100) / 100;
}

/**
 * Load items and prices from Supabase with fallbacks
 */
async function loadItemsAndPrices() {
  let useFallbacks = false;

  try {
    ITEMS_DATA = {};
    PRICE_LIST = {};
    ITEM_METADATA = {};
    ITEM_PRICE_SOURCES = {};

    // Fetch all items with timeout
    let items = [];
    let itemsError = null;

    try {
      const itemsPromise = supabase.from("items").select("*");
      const result = await withTimeout(itemsPromise, SUPABASE_TIMEOUT);
      items = result.data || [];
      itemsError = result.error;
    } catch (timeoutError) {
      console.warn("Items fetch timed out, using fallbacks:", timeoutError);
      itemsError = timeoutError;
      useFallbacks = true;
    }

    if (itemsError || !items || items.length === 0) {
      console.warn(
        "Error fetching items or no items found, using fallbacks:",
        itemsError,
      );
      useFallbacks = true;
    } else {
      // Store items by model_key
      items.forEach((item) => {
        ITEMS_DATA[item.model_key] = item;
        ITEM_METADATA[item.model_key] = {
          name: item.name,
          model_file_path:
            item.model_file_path || STORAGE_MODEL_FILES[item.model_key] || null,
        };
      });
    }

    // Apply fallback metadata for all known models
    Object.keys(STORAGE_MODEL_FILES).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = {
          name: FALLBACK_ITEM_NAMES[key] || key,
          model_file_path: STORAGE_MODEL_FILES[key] || null,
        };
      }
    });
    Object.keys(FALLBACK_ITEM_METADATA).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = { ...FALLBACK_ITEM_METADATA[key] };
      }
    });

    // Fetch all prices with timeout
    let prices = [];
    let pricesError = null;

    try {
      const pricesPromise = supabase
        .from("item_prices")
        .select("*, items(model_key)");
      const result = await withTimeout(pricesPromise, SUPABASE_TIMEOUT);
      prices = result.data || [];
      pricesError = result.error;
    } catch (timeoutError) {
      console.warn("Prices fetch timed out, using fallbacks:", timeoutError);
      pricesError = timeoutError;
      useFallbacks = true;
    }

    if (!pricesError && prices && prices.length > 0) {
      // Organize prices by model_key and calculate estimated prices
      const pricesByModel = {};
      prices.forEach((price) => {
        const modelKey =
          price.items?.model_key ||
          (Array.isArray(price.items) && price.items[0]?.model_key) ||
          null;

        if (!modelKey) {
          console.warn("Price record missing model_key:", price);
          return;
        }

        if (!pricesByModel[modelKey]) {
          pricesByModel[modelKey] = [];
        }
        pricesByModel[modelKey].push(price.price);

        if (!ITEM_PRICE_SOURCES[modelKey]) {
          ITEM_PRICE_SOURCES[modelKey] = [];
        }
        ITEM_PRICE_SOURCES[modelKey].push({
          store: price.store_name,
          price: price.price,
        });
      });

      // Calculate estimated prices
      Object.keys(pricesByModel).forEach((modelKey) => {
        PRICE_LIST[modelKey] = calculateEstimatedPrice(pricesByModel[modelKey]);
      });
    }

    // Apply dummy prices for items without prices or if using fallbacks
    Object.keys(ITEM_METADATA).forEach((key) => {
      if (
        typeof PRICE_LIST[key] === "undefined" ||
        PRICE_LIST[key] === 0 ||
        useFallbacks
      ) {
        // Use dummy price if available, otherwise default to 0
        if (DUMMY_PRICES[key]) {
          PRICE_LIST[key] = DUMMY_PRICES[key].estimatedPrice;
          // Only set sources if we don't have any from database
          if (
            !ITEM_PRICE_SOURCES[key] ||
            ITEM_PRICE_SOURCES[key].length === 0
          ) {
            ITEM_PRICE_SOURCES[key] = [...DUMMY_PRICES[key].sources];
          }
        } else {
          PRICE_LIST[key] = 0;
        }
      }
      // Ensure sources array exists
      if (!ITEM_PRICE_SOURCES[key]) {
        ITEM_PRICE_SOURCES[key] = [];
      }
    });

    if (useFallbacks) {
      console.info(
        "Using fallback data (dummy prices and metadata) due to Supabase issues",
      );
    }
  } catch (error) {
    console.error("Error loading items and prices, using fallbacks:", error);
    // Apply all fallbacks on error
    Object.keys(STORAGE_MODEL_FILES).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = {
          name: FALLBACK_ITEM_NAMES[key] || key,
          model_file_path: STORAGE_MODEL_FILES[key] || null,
        };
      }
      if (typeof PRICE_LIST[key] === "undefined" || PRICE_LIST[key] === 0) {
        if (DUMMY_PRICES[key]) {
          PRICE_LIST[key] = DUMMY_PRICES[key].estimatedPrice;
          ITEM_PRICE_SOURCES[key] = [...DUMMY_PRICES[key].sources];
        } else {
          PRICE_LIST[key] = 0;
          ITEM_PRICE_SOURCES[key] = [];
        }
      }
    });
  }
}

/**
 * Get model file URL from local path (preferred) or Supabase Storage as fallback
 * Models are preloaded locally for instant loading, so we prefer local paths.
 * @param {string} modelKey - Model key (e.g., 'wardrobe1', 'table1')
 * @returns {string} - Model file URL
 */
const MODEL_URL_CACHE = {};

function getModelUrl(modelKey) {
  if (MODEL_URL_CACHE[modelKey]) return MODEL_URL_CACHE[modelKey];

  const metadata = ITEM_METADATA[modelKey];
  const fallbackFile = STORAGE_MODEL_FILES[modelKey];
  const filePath = metadata?.model_file_path || fallbackFile;

  if (!filePath) {
    // Try to get from model analyzer if available
    if (typeof getLocalModelPath === "function") {
      const local = getLocalModelPath(modelKey);
      MODEL_URL_CACHE[modelKey] = local;
      return local;
    }
    // Final fallback
    const fallback = `asset/models/${modelKey}.obj`;
    MODEL_URL_CACHE[modelKey] = fallback;
    return fallback;
  }

  // ALWAYS prefer local path for preloaded models (faster, no network delay)
  // Local models are preloaded by index-preloader.js and cached in browser
  const localPath = `asset/models/${filePath}`;
  MODEL_URL_CACHE[modelKey] = localPath;
  return localPath;
}

/**
 * Get item name from metadata
 * @param {string} modelKey - Model key
 * @returns {string} - Item display name
 */
function getItemName(modelKey) {
  return (
    ITEM_METADATA[modelKey]?.name || FALLBACK_ITEM_NAMES[modelKey] || modelKey
  );
}

const costState = {
  items: {}, // key -> {name, price, qty, unitCost}
  total: 0,
};

// Initialize the room with dimensions from localStorage
function initializeRoom() {
  const width = localStorage.getItem("roomWidth");
  const length = localStorage.getItem("roomLength");
  const height = localStorage.getItem("roomHeight");

  if (!width || !length) {
    // Don't redirect, just show dialog
    showDialog(
      "No room dimensions found. Please set room dimensions using the Resize Dimension button.",
      "Setup Required",
    );
    return;
  }

  // Convert m to A-Frame units (1:1 ratio)
  const aframeWidth = parseFloat(width);
  const aframeLength = parseFloat(length);
  const wallHeight = height ? parseFloat(height) : 3; // Default to 3m if not set

  // Update floor size
  const floor = document.getElementById("floor");
  if (floor) {
    floor.setAttribute("width", aframeWidth);
    floor.setAttribute("depth", aframeLength);
    floor.setAttribute("height", 0.1);
  }

  // Create room walls with height
  createRoomWalls(aframeWidth, aframeLength, wallHeight);

  // Add Blender-like grid
  createBlenderGrid();

  // Update room info badge (bottom center)
  const roomInfo = document.getElementById("room-info");
  if (roomInfo) {
    const w = parseFloat(width);
    const l = parseFloat(length);
    const h = height ? parseFloat(height) : null;
    const wFt = (w * 3.28084).toFixed(1);
    const lFt = (l * 3.28084).toFixed(1);
    const hFt = h ? (h * 3.28084).toFixed(1) : null;
    const hText = h ? ` × ${h}m` : "";
    const hFtText = hFt ? ` × ${hFt} ft` : "";
    roomInfo.textContent = `${w} × ${l}${hText} m  · ${wFt} × ${lFt}${hFtText} ft`;
  }

  // Position camera appropriately
  const cameraRig = document.getElementById("cameraRig");
  if (cameraRig) {
    const cameraDistance = Math.max(aframeWidth, aframeLength) * 0.8;
    cameraRig.setAttribute("position", `0 2.6 ${cameraDistance + 4}`);
  }

  // Wait for scene to be ready, then initialize drag and drop
  const scene = document.querySelector("a-scene");
  if (scene) {
    if (scene.hasLoaded) {
      initializeDragAndDrop();
    } else {
      scene.addEventListener("loaded", initializeDragAndDrop);
    }
  }

  // Show drop indicator initially (only if no furniture has been placed yet)
  setTimeout(() => {
    const furnitureContainer = document.getElementById("furniture-container");
    const hasFurniture =
      furnitureContainer && furnitureContainer.children.length > 0;
    const dropIndicator = document.getElementById("drop-indicator");
    if (!hasFurniture && dropIndicator) {
      dropIndicator.classList.add("show");
    }
    // Note: roomReady event is now dispatched after all async work is complete in window.load handler
  }, 500);
}

function createRoomWalls(width, length, wallHeight = 3) {
  const wallsContainer = document.getElementById("room-walls");
  if (!wallsContainer) return;

  const wallThickness = 0.1;
  wallsContainer.innerHTML = "";

  // Create walls with better materials
  const walls = [
    {
      pos: `0 ${wallHeight / 2} ${-length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
    },
    {
      pos: `0 ${wallHeight / 2} ${length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
    },
    {
      pos: `${-width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
    },
    {
      pos: `${width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
    },
    // Roof
    {
      pos: `0 ${wallHeight} 0`,
      size: `${width} 0.1 ${length}`,
    },
  ];

  // Wall material: warm cream plaster for walls, soft warm white for ceiling
  const wallMat = "color: #EDEAE6; roughness: 0.98; metalness: 0.0";
  const ceilingMat = "color: #F5F4F2; roughness: 1.0; metalness: 0.0";

  walls.forEach((wall, i) => {
    const wallEl = document.createElement("a-box");
    wallEl.setAttribute("position", wall.pos);
    const [w, h, d] = wall.size.split(" ");
    wallEl.setAttribute("width", w);
    wallEl.setAttribute("height", h);
    wallEl.setAttribute("depth", d);
    // Index 4 = ceiling, rest are walls
    wallEl.setAttribute("material", i === 4 ? ceilingMat : wallMat);
    wallEl.setAttribute("shadow", "cast: true; receive: true");
    wallEl.setAttribute("class", "room-wall");
    wallEl.setAttribute("data-wall-index", i);
    wallEl.setAttribute("wall-outline", "");
    wallsContainer.appendChild(wallEl);
  });

  // Add subtle baseboard strip along each wall base
  const baseboardDefs = [
    {
      pos: `0 0.04 ${-length / 2 + wallThickness / 2 + 0.01}`,
      w: width,
      d: 0.02,
    },
    {
      pos: `0 0.04 ${length / 2 - wallThickness / 2 - 0.01}`,
      w: width,
      d: 0.02,
    },
    {
      pos: `${-width / 2 + wallThickness / 2 + 0.01} 0.04 0`,
      w: 0.02,
      d: length,
    },
    {
      pos: `${width / 2 - wallThickness / 2 - 0.01} 0.04 0`,
      w: 0.02,
      d: length,
    },
  ];
  baseboardDefs.forEach((bb) => {
    const el = document.createElement("a-box");
    el.setAttribute("position", bb.pos);
    el.setAttribute("width", bb.w);
    el.setAttribute("height", "0.08");
    el.setAttribute("depth", bb.d);
    el.setAttribute(
      "material",
      "color: #DAD6D0; roughness: 0.85; metalness: 0.0",
    );
    el.setAttribute("class", "room-baseboard");
    wallsContainer.appendChild(el);
  });

  // Start wall visibility update loop
  startWallVisibilityUpdater();

  // Grid helper removed
}

/**
 * Update wall visibility based on camera position
 * Uses raycasting to hide walls that block the view of the room center
 */
let _lastCameraPos = null;
let _lastCameraRot = null;

function updateWallVisibility() {
  const cameraRig = document.getElementById("cameraRig");
  const walls = Array.from(document.querySelectorAll(".room-wall"));

  if (!cameraRig || walls.length === 0) return;

  const cameraPos = new THREE.Vector3();
  cameraRig.object3D.getWorldPosition(cameraPos);

  // Check if camera moved significantly - skip update if not
  if (_lastCameraPos) {
    const dist = cameraPos.distanceToSquared(_lastCameraPos);
    if (dist < 0.01) return; // Less than 10cm movement
  }
  _lastCameraPos = cameraPos.clone();

  // Target the center of the room (slightly elevated)
  const target = new THREE.Vector3(0, 1.5, 0);

  // Check if camera is inside the room
  const roomWidth = parseFloat(localStorage.getItem("roomWidth")) || 10;
  const roomLength = parseFloat(localStorage.getItem("roomLength")) || 10;

  // Get room height from roof position (index 4) or default to 3
  let roomHeight = 3;
  const roof = walls.find((w) => w.getAttribute("data-wall-index") === "4");
  if (roof) {
    const pos = roof.getAttribute("position");
    if (pos) roomHeight = parseFloat(pos.y);
  }

  const margin = 0.1; // Small margin

  const isInside =
    cameraPos.x >= -roomWidth / 2 + margin &&
    cameraPos.x <= roomWidth / 2 - margin &&
    cameraPos.z >= -roomLength / 2 + margin &&
    cameraPos.z <= roomLength / 2 - margin &&
    cameraPos.y < roomHeight; // Must be below the roof

  // Track outside-room state for furniture interaction blocking
  window._cameraInsideRoom = isInside;

  if (isInside) {
    // Show all walls if inside
    walls.forEach((wall) => wall.setAttribute("material", "opacity", 1.0));
    return;
  }

  // Raycast from camera to center
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3()
    .subVectors(target, cameraPos)
    .normalize();
  raycaster.set(cameraPos, direction);

  // Get meshes from a-box entities
  const meshes = walls.map((w) => w.getObject3D("mesh")).filter((m) => m);

  // Intersect
  const intersects = raycaster.intersectObjects(meshes);

  // Identify walls to hide
  // Hide any wall that the ray passes through before reaching the center
  const distToCenter = cameraPos.distanceTo(target);
  const hiddenMeshes = new Set();

  intersects.forEach((hit) => {
    if (hit.distance < distToCenter) {
      hiddenMeshes.add(hit.object);
    }
  });

  // Update opacity
  walls.forEach((wall) => {
    const mesh = wall.getObject3D("mesh");
    const outline = wall.object3D.getObjectByName("outline");

    // If this wall's mesh was hit, hide it. Otherwise show it.
    if (mesh && hiddenMeshes.has(mesh)) {
      // Enable transparency only when hiding to avoid z-sorting glitches when visible
      wall.setAttribute("material", "transparent", true);
      wall.setAttribute("material", "opacity", 0.0);
      if (outline) outline.visible = false;
    } else {
      // Disable transparency when visible for solid rendering
      wall.setAttribute("material", "transparent", false);
      wall.setAttribute("material", "opacity", 1.0);
      if (outline) outline.visible = true;
    }
  });
}

/**
 * Start the wall visibility updater loop
 */
let _wallVisibilityInterval = null;
function startWallVisibilityUpdater() {
  // Prevent multiple intervals from stacking
  if (_wallVisibilityInterval) return;

  // Update wall visibility less frequently for better performance
  const scene = document.querySelector("a-scene");
  if (scene) {
    const startUpdater = () => {
      // Delay initial start to let GPU stabilize and shaders compile
      setTimeout(() => {
        _wallVisibilityInterval = setInterval(updateWallVisibility, 500); // 500ms for better initial performance
      }, 2000); // Increased delay from 1000ms to 2000ms
    };

    if (scene.hasLoaded) {
      startUpdater();
    } else {
      scene.addEventListener("loaded", startUpdater);
    }
  }
}

/**
 * Show a smooth slide-up toast notification
 */
let _toastTimeout = null;
function showRoomToast(message) {
  let toast = document.getElementById("room-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "room-toast";
    document.body.appendChild(toast);
  }

  // Clear any existing dismiss timer
  if (_toastTimeout) {
    clearTimeout(_toastTimeout);
    _toastTimeout = null;
  }

  toast.textContent = message;
  // Reset animation by removing class, forcing reflow, then re-adding
  toast.classList.remove("show");
  void toast.offsetWidth;
  toast.classList.add("show");

  // Auto-dismiss after 3.5 seconds
  _toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

/**
 * Teleport camera to the center of the room
 */
function teleportToRoom() {
  const cameraRig = document.getElementById("cameraRig");
  if (!cameraRig) return;

  cameraRig.setAttribute("position", "0 2.6 0");

  // Dismiss toast
  const toast = document.getElementById("room-toast");
  if (toast) toast.classList.remove("show");

  window._cameraInsideRoom = true;
}
// Make teleportToRoom accessible from HTML onclick
window.teleportToRoom = teleportToRoom;
window.showRoomToast = showRoomToast;

// ── Global click interceptor: show toast when clicking furniture from outside ──
// A-Frame click events don't fire reliably from far away, so we catch it at the
// canvas level with a raycast against all furniture meshes.
(function setupOutsideClickInterceptor() {
  function attach() {
    const scene = document.querySelector("a-scene");
    if (!scene) return;

    const doAttach = () => {
      const canvas = scene.canvas;
      if (!canvas) return;

      canvas.addEventListener("mousedown", (e) => {
        if (window._cameraInsideRoom !== false) return;

        // Raycast from click position to see if it hits furniture
        const camEl = document.querySelector("a-camera");
        if (!camEl) return;
        const camera = camEl.getObject3D("camera");
        if (!camera) return;

        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        const container = document.getElementById("furniture-container");
        if (!container || !container.object3D) return;

        const meshes = [];
        container.object3D.traverse((n) => {
          if (n.isMesh) meshes.push(n);
        });
        if (meshes.length === 0) return;

        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          showRoomToast("Move inside the room to interact with furniture!");
        }
      });
    };

    if (scene.hasLoaded) doAttach();
    else scene.addEventListener("loaded", doAttach);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})();

function createBlenderGrid() {
  const scene = document.querySelector("a-scene");
  if (!scene || !scene.object3D) return;

  // Remove existing grid if any
  const existingGrid = scene.object3D.getObjectByName("blender-grid");
  if (existingGrid) {
    scene.object3D.remove(existingGrid);
  }

  // Create a large grid - reduced from 200x200 to 100x100 for better performance
  const size = 100;
  const divisions = 100;
  const colorCenterLine = 0xa09890;
  const colorGrid = 0x908880;

  const gridHelper = new THREE.GridHelper(
    size,
    divisions,
    colorCenterLine,
    colorGrid,
  );
  gridHelper.name = "blender-grid";
  gridHelper.position.y = -0.13; // Sits on reflective ground plane, below room floor

  // Very subtle grid lines for clean studio look
  if (Array.isArray(gridHelper.material)) {
    gridHelper.material.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.25;
      m.depthWrite = false;
    });
  } else {
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.25;
    gridHelper.material.depthWrite = false;
  }

  scene.object3D.add(gridHelper);
}

function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById("side-panel");
  const toggle = document.getElementById("panel-toggle");
  const resizePanel = document.getElementById("resize-dimension-panel");

  if (panelOpen) {
    // Close resize panel if open
    if (resizePanel) {
      resizePanel.classList.remove("open");
    }
    // Show main panel
    if (panel) {
      panel.classList.add("open");
    }
    if (toggle) {
      toggle.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
      toggle.style.left = "310px";
    }
  } else {
    if (panel) {
      panel.classList.remove("open");
    }
    if (toggle) {
      toggle.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="1" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="1" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5"/></svg>';
      toggle.style.left = "20px";
    }
    // Hide resize panel if open
    if (resizePanel) {
      resizePanel.classList.remove("open");
    }
  }
}

function handleDropIndicatorClick(e) {
  // Prevent click during active drag operations
  if (draggedItem) {
    return;
  }

  // Prevent event propagation to avoid interfering with drag and drop
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  // Open the side panel when drop indicator is clicked
  if (!panelOpen) {
    togglePanel();
  }
  // Hide the drop indicator after clicking (user can see the panel now)
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.classList.remove("show");
  }
}

function showResizeDimensionPanel() {
  const sidePanel = document.getElementById("side-panel");
  const resizePanel = document.getElementById("resize-dimension-panel");

  if (!sidePanel || !resizePanel) return;

  // Store original content if not already stored
  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Hide main side panel
  sidePanel.classList.remove("open");

  // Show resize dimension panel
  resizePanel.classList.add("open");

  // Load current dimensions if available (stored in meters, display in feet)
  const FT_PER_M = 3.28084;
  const width = localStorage.getItem("roomWidth") || "";
  const length = localStorage.getItem("roomLength") || "";
  const height = localStorage.getItem("roomHeight") || "";

  const widthInput = document.getElementById("room-width-input");
  const lengthInput = document.getElementById("room-length-input");
  const heightInput = document.getElementById("room-height-input");

  if (widthInput)
    widthInput.value = width ? (parseFloat(width) * FT_PER_M).toFixed(1) : "";
  if (lengthInput)
    lengthInput.value = length
      ? (parseFloat(length) * FT_PER_M).toFixed(1)
      : "";
  if (heightInput)
    heightInput.value = height
      ? (parseFloat(height) * FT_PER_M).toFixed(1)
      : "";
}

function saveRoomDimensions() {
  const widthInput = document.getElementById("room-width-input");
  const lengthInput = document.getElementById("room-length-input");
  const heightInput = document.getElementById("room-height-input");

  const widthFt = parseFloat(widthInput?.value);
  const lengthFt = parseFloat(lengthInput?.value);
  const heightFt = parseFloat(heightInput?.value);

  if (!widthFt || !lengthFt || widthFt <= 0 || lengthFt <= 0) {
    showDialog(
      "Please enter valid width and length values (greater than 0).",
      "Invalid Dimensions",
    );
    return;
  }

  // Convert feet to meters for internal storage
  const M_PER_FT = 0.3048;
  const width = +(widthFt * M_PER_FT).toFixed(2);
  const length = +(lengthFt * M_PER_FT).toFixed(2);
  const height =
    heightFt && heightFt > 0 ? +(heightFt * M_PER_FT).toFixed(2) : null;

  // Save to localStorage (in meters)
  localStorage.setItem("roomWidth", width.toString());
  localStorage.setItem("roomLength", length.toString());
  if (height) {
    localStorage.setItem("roomHeight", height.toString());
  }

  // Update room
  initializeRoom();

  // Check all furniture items against new boundaries
  checkFurnitureBoundaries(width, length);

  // Close resize panel and show main panel
  const resizePanel = document.getElementById("resize-dimension-panel");
  const sidePanel = document.getElementById("side-panel");

  if (resizePanel) resizePanel.classList.remove("open");
  if (sidePanel) sidePanel.classList.add("open");

  showDialog("Room dimensions updated successfully!", "Success");
}

/**
 * Check all furniture items against room boundaries and mark as red if outside
 */
function checkFurnitureBoundaries(roomWidth, roomLength) {
  const furnitureContainer = document.getElementById("furniture-container");
  if (!furnitureContainer) return;

  const furnitureItems =
    furnitureContainer.querySelectorAll('[id^="furniture-"]');
  const wallThickness = 0.1;

  furnitureItems.forEach((furniture) => {
    const draggableComponent = furniture.components["draggable-furniture"];
    if (!draggableComponent) return;

    // Update draggable component with new dimensions
    furniture.setAttribute("draggable-furniture", {
      roomWidth: roomWidth,
      roomLength: roomLength,
      objectWidth: draggableComponent.data.objectWidth || 1.5,
      objectLength: draggableComponent.data.objectLength || 1.5,
      wallThickness: wallThickness,
    });

    // Get current position
    const position = furniture.object3D.position;

    // Check if outside boundaries
    const isOutside = isFurnitureOutsideBoundaries(
      position,
      roomWidth,
      roomLength,
      draggableComponent.data.objectWidth || 1.5,
      draggableComponent.data.objectLength || 1.5,
      wallThickness,
    );

    // Update color based on boundary status
    if (isOutside) {
      furniture.setAttribute("material", "color", "#FF6B6B");
      furniture.setAttribute("material", "emissive", "#8B0000");
      furniture.setAttribute("material", "emissiveIntensity", "0.25");
    } else {
      // Check if near walls (using existing collision logic)
      if (
        draggableComponent.isColliding &&
        draggableComponent.isColliding(position)
      ) {
        furniture.setAttribute("material", "color", "#FF6B6B");
        furniture.setAttribute("material", "emissive", "#8B0000");
        furniture.setAttribute("material", "emissiveIntensity", "0.25");
      } else {
        // Restore original color
        const clickableComponent = furniture.components["clickable-furniture"];
        if (clickableComponent && clickableComponent.originalColor) {
          furniture.setAttribute(
            "material",
            "color",
            clickableComponent.originalColor,
          );
        } else {
          furniture.setAttribute("material", "color", "#FF8C00");
        }
        furniture.setAttribute("material", "emissive", "#000000");
        furniture.setAttribute("material", "emissiveIntensity", "0");
      }
    }
  });
}

/**
 * Check if furniture position is outside room boundaries
 */
function isFurnitureOutsideBoundaries(
  position,
  roomWidth,
  roomLength,
  objWidth,
  objLength,
  wallThickness,
) {
  const innerX = roomWidth / 2 - wallThickness / 2;
  const innerZ = roomLength / 2 - wallThickness / 2;
  const safeXMin = -innerX + objWidth / 2;
  const safeXMax = innerX - objWidth / 2;
  const safeZMin = -innerZ + objLength / 2;
  const safeZMax = innerZ - objLength / 2;

  return (
    position.x < safeXMin ||
    position.x > safeXMax ||
    position.z < safeZMin ||
    position.z > safeZMax
  );
}

function toggleCostPanel() {
  const costPanel = document.getElementById("cost-panel");
  if (!costPanel) return;

  costPanel.classList.toggle("collapsed");
}

function initializeDragAndDrop() {
  // Only enable drag for enabled items (table)
  const enabledItems = document.querySelectorAll(".model-item.enabled");
  const scene = document.getElementById("scene");
  const dropIndicator = document.getElementById("drop-indicator");

  enabledItems.forEach((item) => {
    item.addEventListener("dragstart", handleDragStart);
  });

  // Scene drop events
  scene.addEventListener("dragover", handleDragOver);
  scene.addEventListener("drop", handleDrop);
  scene.addEventListener("dragenter", handleDragEnter);
  scene.addEventListener("dragleave", handleDragLeave);

  // Drop indicator drop events (allow dropping on the indicator itself)
  if (dropIndicator) {
    dropIndicator.addEventListener("dragover", handleDragOver);
    dropIndicator.addEventListener("drop", handleDrop);
    dropIndicator.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dropIndicator.classList.add("show");
    });
    dropIndicator.addEventListener("dragleave", function (e) {
      if (!dropIndicator.contains(e.relatedTarget)) {
        dropIndicator.classList.remove("show");
      }
    });
  }
}

function handleDragStart(e) {
  draggedItem = {
    model: e.target.dataset.model,
    scale: e.target.dataset.scale,
    name: e.target.querySelector(".model-name").textContent,
  };
  e.target.classList.add("dragging");

  // Hide the drop indicator when dragging starts
  const dropIndicator = document.getElementById("drop-indicator");
  dropIndicator.classList.remove("show");
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDragEnter(e) {
  e.preventDefault();
  document.getElementById("drop-indicator").classList.add("show");
}

function handleDragLeave(e) {
  if (
    !e.relatedTarget ||
    !document.getElementById("scene").contains(e.relatedTarget)
  ) {
    document.getElementById("drop-indicator").classList.remove("show");
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("drop-indicator").classList.remove("show");

  if (!draggedItem) return;

  // Calculate drop position (center of room with slight randomization)
  const dropX = (Math.random() - 0.5) * 2;
  const dropZ = (Math.random() - 0.5) * 2;

  // Get room dimensions for smart placement
  const roomWidth = parseFloat(localStorage.getItem("roomWidth")); // Already in meters
  const roomLength = parseFloat(localStorage.getItem("roomLength"));
  const wallHeight = parseFloat(localStorage.getItem("roomHeight")) || 3;

  // Create furniture entity
  const furnitureEl = document.createElement("a-entity");
  furnitureEl.id = `furniture-${furnitureCounter++}`;
  // Default position for floor items; mirrors are wall-mounted and will be
  // auto-placed on the wall the camera is facing.
  furnitureEl.setAttribute("position", `${dropX} 0 ${dropZ}`);

  // Models are fully preloaded during the loading screen, so no placeholder
  // is needed.  If somehow a model isn't cached (edge case), the
  // cached-obj-model component will show its own loading spinner.

  // Add to scene FIRST so A-Frame can initialize it immediately
  const furnitureContainer = document.getElementById("furniture-container");
  furnitureContainer.appendChild(furnitureEl);

  // Force A-Frame to flush the entity to DOM immediately
  if (furnitureEl.flushToDOM) {
    furnitureEl.flushToDOM();
  }

  // Now set remaining attributes after entity is in the scene
  // Get model URL from Supabase Storage or local path
  const modelUrl = getModelUrl(draggedItem.model);
  furnitureEl.setAttribute("cached-obj-model", "src", modelUrl);
  furnitureEl.setAttribute(
    "scale",
    FURNITURE_SCALES[draggedItem.model] || draggedItem.scale,
  );
  furnitureEl.setAttribute(
    "draggable-furniture",
    `roomWidth: ${roomWidth}; roomLength: ${roomLength}; wallHeight: ${wallHeight}; objectWidth: 1.5; objectLength: 1.5; wallThickness: 0.1`,
  );
  furnitureEl.setAttribute("clickable-furniture", "");

  // Apply per-item material so each furniture type has a distinct look.
  furnitureEl.setAttribute(
    "textured-model",
    getFurnitureMaterialAttr(draggedItem.model),
  );
  // Store model key as data attribute for easy retrieval during deletion
  furnitureEl.setAttribute("data-model-key", draggedItem.model);

  // Listen for model error (edge case – model wasn't cached)
  furnitureEl.addEventListener("model-error", function (e) {
    console.error(`Model load error for ${draggedItem.model}:`, e.detail);
  });

  // Update cost estimator
  const itemName = getItemName(draggedItem.model);
  addItemToCost(draggedItem.model, itemName);

  // If this is a mirror, attempt to auto-place it on the wall the camera is facing
  if (
    typeof draggedItem.model === "string" &&
    draggedItem.model.startsWith("mirror")
  ) {
    try {
      const camEl = document.querySelector("a-camera");
      let camPos = new THREE.Vector3();
      let camDir = new THREE.Vector3(0, 0, -1);
      if (camEl && camEl.object3D) {
        camEl.object3D.getWorldPosition(camPos);
        camEl.object3D.getWorldDirection(camDir);
      } else {
        // fallback camera at origin
        camPos.set(0, 1.6, 5);
      }

      const ray = new THREE.Ray(camPos, camDir.normalize());
      // Build wall planes similar to draggable-furniture logic
      const roomWidth = parseFloat(localStorage.getItem("roomWidth")) || 10;
      const roomLength = parseFloat(localStorage.getItem("roomLength")) || 10;
      const wallThickness = 0.1;
      const innerX = roomWidth / 2 - wallThickness / 2;
      const innerZ = roomLength / 2 - wallThickness / 2;

      const planes = [
        {
          name: "north",
          point: new THREE.Vector3(0, 0, -innerZ),
          normal: new THREE.Vector3(0, 0, 1),
        },
        {
          name: "south",
          point: new THREE.Vector3(0, 0, innerZ),
          normal: new THREE.Vector3(0, 0, -1),
        },
        {
          name: "west",
          point: new THREE.Vector3(-innerX, 0, 0),
          normal: new THREE.Vector3(1, 0, 0),
        },
        {
          name: "east",
          point: new THREE.Vector3(innerX, 0, 0),
          normal: new THREE.Vector3(-1, 0, 0),
        },
      ];

      const hits = [];
      const ip = new THREE.Vector3();
      planes.forEach((w) => {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          w.normal,
          w.point,
        );
        const hit = ray.intersectPlane(plane, ip);
        if (!hit) return;
        const dist = camPos.distanceTo(ip);
        if (!isFinite(dist) || dist <= 0.001) return;

        // Only accept walls the camera is looking AT.
        const toWall = new THREE.Vector3().subVectors(ip, camPos).normalize();
        if (toWall.dot(camDir) < 0.1) return; // wall is behind or beside camera

        // Only accept hits whose intersection is within the wall bounds
        // (not far outside the room)
        const withinX = ip.x >= -innerX - 0.5 && ip.x <= innerX + 0.5;
        const withinZ = ip.z >= -innerZ - 0.5 && ip.z <= innerZ + 0.5;
        if (!withinX || !withinZ) return;

        hits.push({ wall: w.name, point: ip.clone(), dist });
      });

      // Determine best wall: if camera is outside, prefer the wall
      // closest to the camera rather than the ray hit
      const isOutside =
        camPos.x < -roomWidth / 2 ||
        camPos.x > roomWidth / 2 ||
        camPos.z < -roomLength / 2 ||
        camPos.z > roomLength / 2 ||
        camPos.y > wallHeight;

      let chosenWall = null;

      if (hits.length > 0) {
        hits.sort((a, b) => a.dist - b.dist);
        chosenWall = hits[0];
      }

      // If outside and no good hit (or the hit is the far wall),
      // pick the wall nearest to the camera
      if (isOutside && (!chosenWall || chosenWall.dist > roomWidth)) {
        const wallDistances = [
          { name: "south", dist: Math.abs(camPos.z - innerZ) },
          { name: "north", dist: Math.abs(camPos.z + innerZ) },
          { name: "east", dist: Math.abs(camPos.x - innerX) },
          { name: "west", dist: Math.abs(camPos.x + innerX) },
        ];
        wallDistances.sort((a, b) => a.dist - b.dist);
        const nearest = wallDistances[0].name;
        chosenWall = {
          wall: nearest,
          point: new THREE.Vector3(0, wallHeight / 2, 0),
          dist: wallDistances[0].dist,
        };
      }

      if (chosenWall) {
        const chosen = chosenWall;
        const wallName = chosen.wall || chosen.name;
        // Clamp similarly to draggable-furniture.clampMirrorToWall
        const defaultHalfX = 0.75;
        const defaultHalfZ = 0.75;
        const halfAlongWall =
          wallName === "north" || wallName === "south"
            ? defaultHalfX
            : defaultHalfZ;
        const halfY = 0.5;
        const minY = 0 + halfY;
        const maxY =
          (parseFloat(localStorage.getItem("roomHeight")) || 3) - halfY;
        // Place at mid-height of wall rather than ray intersection Y
        // to avoid mirrors appearing near ceiling/floor
        const targetY = Math.min(wallHeight * 0.45, maxY);
        const clampedY = Math.max(minY, Math.min(maxY, targetY));

        let pos = { x: 0, y: clampedY, z: 0 };
        if (wallName === "north" || wallName === "south") {
          const minX = -innerX + halfAlongWall;
          const maxX = innerX - halfAlongWall;
          const clampedX = Math.max(minX, Math.min(maxX, chosen.point.x));
          const z = wallName === "north" ? -innerZ + 0.02 : innerZ - 0.02;
          pos.x = clampedX;
          pos.z = z;
        } else {
          const minZ = -innerZ + halfAlongWall;
          const maxZ = innerZ - halfAlongWall;
          const clampedZ = Math.max(minZ, Math.min(maxZ, chosen.point.z));
          const x = wallName === "west" ? -innerX + 0.02 : innerX - 0.02;
          pos.x = x;
          pos.z = clampedZ;
        }

        furnitureEl.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
        const rotY =
          wallName === "north"
            ? 0
            : wallName === "south"
              ? 180
              : wallName === "west"
                ? -90
                : 90;
        furnitureEl.setAttribute("rotation", `0 ${rotY} 0`);
      }
    } catch (err) {
      console.warn("Auto-place mirror failed:", err);
    }
  }

  // Expand cost panel when item is dropped
  const costPanel = document.getElementById("cost-panel");
  if (costPanel && costPanel.classList.contains("collapsed")) {
    costPanel.classList.remove("collapsed");
  }

  // Save workspace state
  saveWorkspaceState();

  // Clean up
  document.querySelectorAll(".model-item.dragging").forEach((item) => {
    item.classList.remove("dragging");
  });

  // Remove the drop indicator permanently after first furniture placement
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.style.display = "none";
  }

  draggedItem = null;
}

function addItemToCost(modelKey, displayName) {
  const price = PRICE_LIST[modelKey] || 0;

  if (!costState.items[modelKey]) {
    costState.items[modelKey] = {
      name: displayName,
      price: price, // Unit cost (estimated price)
      qty: 0,
      unitCost: price, // Store unit cost for display
    };
  }
  costState.items[modelKey].qty += 1;
  renderCost();
}

function peso(n) {
  return `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Some MSDF fonts in a-text may not include the peso glyph.
// Use a 3D-safe fallback for in-scene text.
function peso3D(n) {
  return `PHP ${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// buildSourcesMarkup function removed - now using side panel

function renderCost() {
  // Update cost items list
  const costItemsList = document.getElementById("cost-items-list");
  if (costItemsList) {
    costItemsList.innerHTML = "";
  }

  let total = 0;
  Object.keys(costState.items).forEach((key) => {
    const item = costState.items[key];
    const unitCost = item.unitCost || item.price; // Unit cost (estimated price per unit)
    const lineTotal = unitCost * item.qty; // Total cost for this item (unit cost × quantity)
    total += lineTotal;

    const content = `
      <div class="cost-item-info">
        <div class="cost-item-name">${item.name}</div>
        <div class="cost-item-meta">${item.qty} × ${peso(unitCost)}</div>
      </div>
      <div class="cost-item-right">
        <div class="cost-item-total">${peso(lineTotal)}</div>
        <div class="cost-item-actions">
          <button class="cost-source-toggle" data-model="${key}" data-item-name="${item.name}" title="View Sources"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
          <button class="cost-item-remove" data-model="${key}" title="Remove"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
      </div>
    `;

    if (costItemsList) {
      const row = document.createElement("div");
      row.className = "cost-item";
      row.setAttribute("data-model", key);
      row.style.cursor = "pointer";
      row.innerHTML = content;
      costItemsList.appendChild(row);
    }
  });
  costState.total = total; // Total project cost (sum of all line totals)
  const totalEl = document.getElementById("cost-total");
  if (totalEl) totalEl.textContent = peso(total);
  const totalDisplay = document.getElementById("cost-total-display");
  if (totalDisplay) totalDisplay.textContent = peso(total);
}

// Remove one instance of an item by modelKey (remove last placed instance)
function removeItemInstance(modelKey) {
  if (!modelKey || !costState.items[modelKey]) return;
  // Find last furniture entity with matching model key
  const nodes = Array.from(
    document.querySelectorAll('[data-model-key="' + modelKey + '"]'),
  );
  if (nodes.length > 0) {
    const last = nodes[nodes.length - 1];
    last.remove();
  }

  // Decrement qty and remove the cost entry if qty reaches zero
  costState.items[modelKey].qty = Math.max(
    0,
    costState.items[modelKey].qty - 1,
  );
  if (costState.items[modelKey].qty === 0) {
    delete costState.items[modelKey];
  }
  renderCost();
  saveWorkspaceState();
}

// Listen for clicks within cost panel (delegation)
document.addEventListener("click", function (e) {
  const removeBtn = e.target.closest(".cost-item-remove");
  const sourceBtn = e.target.closest(".cost-source-toggle");
  const costItemRow = e.target.closest(".cost-item");

  // Handle remove button
  if (removeBtn) {
    e.preventDefault();
    e.stopPropagation();
    const model = removeBtn.getAttribute("data-model");
    if (model) removeItemInstance(model);
    return;
  }

  // Handle source button - don't select item
  if (sourceBtn) {
    return; // Let existing source toggle handler work
  }

  // Handle clicking the cost item row itself (select furniture)
  if (costItemRow && !removeBtn && !sourceBtn) {
    const model = costItemRow.getAttribute("data-model");
    if (model) {
      // Select the first matching furniture entity in the scene
      const el = document.querySelector('[data-model-key="' + model + '"]');
      if (el && el.components && el.components["clickable-furniture"]) {
        // Deselect all others first
        document.querySelectorAll("[clickable-furniture]").forEach((f) => {
          if (f !== el && f.components["clickable-furniture"]) {
            f.components["clickable-furniture"].deselect();
          }
        });
        // Select this one
        if (!el.components["clickable-furniture"].isSelected) {
          el.components["clickable-furniture"].select();
        }
      }
    }
    return;
  }
});

// Highlight cost row when furniture is selected in-scene
window.addEventListener("furnitureSelected", function (e) {
  const model = e.detail && e.detail.modelKey;
  // Remove previous highlights
  document
    .querySelectorAll(".cost-item.highlight")
    .forEach((r) => r.classList.remove("highlight"));
  if (!model) return;
  const row = document.querySelector('.cost-item[data-model="' + model + '"]');
  if (row) {
    row.classList.add("highlight");
    // Auto-scroll to the highlighted item
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

window.addEventListener("furnitureDeselected", function (e) {
  const model = e.detail && e.detail.modelKey;
  if (!model) {
    document
      .querySelectorAll(".cost-item.highlight")
      .forEach((r) => r.classList.remove("highlight"));
    return;
  }
  const row = document.querySelector('.cost-item[data-model="' + model + '"]');
  if (row) row.classList.remove("highlight");
});

// Grid functions removed

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (e.key === "Tab") {
    e.preventDefault();
    togglePanel();
  }
  // Escape key handling removed (no back button)
  // Grid toggle removed

  // Save workspace state when furniture is moved (dragged)
  if (
    e.detail &&
    e.detail.target &&
    e.detail.target.id &&
    e.detail.target.id.startsWith("furniture-")
  ) {
    saveWorkspaceState();
  }
});

// Use event delegation for dynamically created source buttons
document.addEventListener("click", function (e) {
  // Check if clicked element is a source toggle button or inside one
  const toggle = e.target.closest(".cost-source-toggle");
  const sourcesPanel = document.getElementById("sources-panel");
  const clickedInsideSources = e.target.closest("#sources-panel");

  if (toggle) {
    e.preventDefault();
    e.stopPropagation();

    const modelKey = toggle.getAttribute("data-model");
    const itemName = toggle.getAttribute("data-item-name");

    if (!modelKey) return;

    // Show sources panel
    showSourcesPanel(modelKey, itemName);
  } else if (
    sourcesPanel &&
    sourcesPanel.classList.contains("open") &&
    !clickedInsideSources
  ) {
    // Close sources panel if clicking outside
    closeSourcesPanel();
  }
});

/**
 * Show sources panel with item sources
 */
function showSourcesPanel(modelKey, itemName) {
  const sourcesPanel = document.getElementById("sources-panel");
  const sourcesTitle = document.getElementById("sources-panel-title");
  const sourcesContent = document.getElementById("sources-panel-content");

  if (!sourcesPanel || !sourcesTitle || !sourcesContent) return;

  // Update title
  sourcesTitle.textContent = itemName
    ? `${itemName} - Sources`
    : "Item Sources";

  // Get sources for this item
  const sources = ITEM_PRICE_SOURCES[modelKey] || [];

  if (sources.length === 0) {
    sourcesContent.innerHTML = `
      <div class="sources-empty">
        <p>No sources available for this item.</p>
      </div>
    `;
  } else {
    // Build sources list
    const sourcesHTML = sources
      .map(
        (src) => `
      <div class="source-item">
        <div class="source-store">${src.store}</div>
        <div class="source-price">${peso(src.price)}</div>
      </div>
    `,
      )
      .join("");

    sourcesContent.innerHTML = `
      <div class="sources-list">
        ${sourcesHTML}
      </div>
    `;
  }

  // Show panel
  sourcesPanel.classList.add("open");
}

/**
 * Close sources panel
 */
function closeSourcesPanel() {
  const sourcesPanel = document.getElementById("sources-panel");
  if (sourcesPanel) {
    sourcesPanel.classList.remove("open");
  }
}

// Sub-category functions
function showCenterTableSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const table1Name = getItemName("center_table1");
  const table2Name = getItemName("center_table2");

  const centerTableContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Center Table Options</h3>
      <small>Choose a center table style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="center_table1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("center_table1")}</span>
          <div class="model-name">${table1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="center_table2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("center_table2")}</span>
          <div class="model-name">${table2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = centerTableContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showWardrobeSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  const mainContent =
    sidePanel.querySelector(".panel-header").nextElementSibling;

  // Store original content
  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Get wardrobe names from metadata
  const wardrobe1Name = getItemName("wardrobe1");
  const wardrobe2Name = getItemName("wardrobe2");
  const wardrobe3Name = getItemName("wardrobe3");

  // Create wardrobe panel content
  const wardrobeContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Wardrobe Options</h3>
      <small>Choose a wardrobe style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("wardrobe1")}</span>
          <div class="model-name">${wardrobe1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("wardrobe2")}</span>
          <div class="model-name">${wardrobe2Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe3"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("wardrobe3")}</span>
          <div class="model-name">${wardrobe3Name}</div>
        </div>
      </div>
    </div>
  `;

  // Replace panel content
  sidePanel.innerHTML = wardrobeContent;

  // Re-initialize drag and drop for new items
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showBedSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const bed1Name = getItemName("bed1");
  const bed2Name = getItemName("bed2");

  const bedContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Bed Options</h3>
      <small>Choose a bed style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="bed1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("bed1")}</span>
          <div class="model-name">${bed1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="bed2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("bed2")}</span>
          <div class="model-name">${bed2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = bedContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showChairSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const chair1Name = getItemName("chair1");
  const chair2Name = getItemName("chair2");

  const chairContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Chair Options</h3>
      <small>Choose a chair style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="chair1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("chair1")}</span>
          <div class="model-name">${chair1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="chair2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("chair2")}</span>
          <div class="model-name">${chair2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = chairContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showDeskSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const desk1Name = getItemName("desk1");
  const desk2Name = getItemName("desk2");

  const deskContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Desk Options</h3>
      <small>Choose a desk style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="desk1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("desk1")}</span>
          <div class="model-name">${desk1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="desk2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("desk2")}</span>
          <div class="model-name">${desk2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = deskContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showMirrorSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const mirror1Name = getItemName("mirror1");
  const mirror2Name = getItemName("mirror2");

  const mirrorContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Mirror Options</h3>
      <small>Choose a mirror style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="mirror1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("mirror1")}</span>
          <div class="model-name">${mirror1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="mirror2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("mirror2")}</span>
          <div class="model-name">${mirror2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = mirrorContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showShelfSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  const shelf1Name = getItemName("shelf1");
  const shelf2Name = getItemName("shelf2");

  const shelfContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>Shelf Options</h3>
      <small>Choose a shelf style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="shelf1"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("shelf1")}</span>
          <div class="model-name">${shelf1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="shelf2"
          data-scale="1 1 1"
        >
          <span class="model-icon">${getFurnitureIconHTML("shelf2")}</span>
          <div class="model-name">${shelf2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = shelfContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function goBackToMainPanel() {
  const sidePanel = document.getElementById("side-panel");
  const resizePanel = document.getElementById("resize-dimension-panel");

  // Hide resize panel
  if (resizePanel) {
    resizePanel.classList.remove("open");
  }

  // Show main side panel
  if (sidePanel) {
    sidePanel.classList.add("open");
    if (sidePanel.dataset.originalContent) {
      sidePanel.innerHTML = sidePanel.dataset.originalContent;
      // Re-initialize drag and drop
      initializeDragAndDrop();
      updateSubcategoryUI();
      // Re-apply 3D thumbnails (original HTML has SVG placeholders)
      if (window.furnitureThumbnails) {
        window.furnitureThumbnails.refresh();
      }
    }
  }
}

// Control panel functions
function showControlPanel(furnitureId) {
  selectedFurniture = furnitureId;
  const panel = document.getElementById("furniture-control-panel");
  const title = document.getElementById("control-panel-title");
  const furniture = document.getElementById(furnitureId);

  // Get item name from furniture element
  let itemName = furnitureId;
  if (furniture) {
    const modelKey = furniture.getAttribute("data-model-key");
    if (modelKey) {
      itemName = getItemName(modelKey);
    }
  }

  title.textContent = itemName;
  panel.style.display = "block";
}

function closeControlPanel() {
  const panel = document.getElementById("furniture-control-panel");
  panel.style.display = "none";
  selectedFurniture = null;
}

function rotateFurnitureLeft() {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) - 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`,
      );
      saveWorkspaceState();
    }
  }
}

function rotateFurnitureRight() {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) + 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`,
      );
      saveWorkspaceState();
    }
  }
}

function deleteFurniture() {
  if (!selectedFurniture) return;

  const furniture = document.getElementById(selectedFurniture);
  if (!furniture) return;

  // Extract model key
  let modelKey = null;
  try {
    modelKey = furniture.getAttribute("data-model-key");

    if (!modelKey) {
      const objModelAttr =
        furniture.getAttribute("cached-obj-model") ||
        furniture.getAttribute("obj-model");
      let objModelString = "";
      if (typeof objModelAttr === "string") {
        objModelString = objModelAttr;
      } else if (objModelAttr && typeof objModelAttr === "object") {
        objModelString = objModelAttr.obj || objModelAttr.src || "";
      }

      const match = objModelString.match(/models\/(\w+)\.obj/);
      if (match && match[1]) {
        modelKey = match[1];
      }
    }

    // Remove from cost estimator if we found the model key
    if (modelKey && costState.items[modelKey]) {
      costState.items[modelKey].qty -= 1;
      if (costState.items[modelKey].qty <= 0) {
        delete costState.items[modelKey];
      }
      renderCost();
    }
  } catch (error) {
    console.error("Error extracting model key:", error);
  }

  // Remove from scene
  furniture.remove();
  saveWorkspaceState();
  closeControlPanel();
}

/**
 * Save workspace state to localStorage
 * Expose globally so it can be called from other pages
 */
function saveWorkspaceState() {
  try {
    // Use collectRoomPlanData for consistent data format
    if (typeof collectRoomPlanData === "function") {
      const roomPlanData = collectRoomPlanData();

      // Convert to format compatible with restoreRoom
      const state = {
        room_width: roomPlanData.room_width,
        room_length: roomPlanData.room_length,
        furniture_data: roomPlanData.furniture_data,
        cost_total: roomPlanData.cost_total,
        costState: costState, // Keep full cost state for compatibility
        furnitureCounter: furnitureCounter,
      };

      // Save to currentRoomState for auto-restore
      localStorage.setItem("currentRoomState", JSON.stringify(state));

      // Also save to workspaceState for backward compatibility
      const furnitureData = roomPlanData.furniture_data.map((item) => ({
        model_key: item.model_key,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
      }));

      const legacyState = {
        furniture: furnitureData,
        costState: costState,
        furnitureCounter: furnitureCounter,
      };
      localStorage.setItem("workspaceState", JSON.stringify(legacyState));

      console.log(
        `Workspace state saved: ${furnitureData.length} furniture items`,
      );
    } else {
      // Fallback to old method if collectRoomPlanData not available
      const furnitureContainer = document.getElementById("furniture-container");
      const furnitureData = [];

      if (furnitureContainer) {
        const furnitureItems =
          furnitureContainer.querySelectorAll('[id^="furniture-"]');
        furnitureItems.forEach((item) => {
          const position = item.getAttribute("position");
          const rotation = item.getAttribute("rotation");
          const scale = item.getAttribute("scale");
          const modelKey = item.getAttribute("data-model-key");

          if (modelKey && position) {
            const [x, y, z] = position.split(" ").map(parseFloat);
            const [rx, ry, rz] = (rotation || "0 0 0")
              .split(" ")
              .map(parseFloat);
            const [sx, sy, sz] = (scale || "1 1 1").split(" ").map(parseFloat);

            furnitureData.push({
              model_key: modelKey,
              position: { x, y, z },
              rotation: { x: rx, y: ry, z: rz },
              scale: { x: sx, y: sy, z: sz },
            });
          }
        });
      }

      const state = {
        furniture: furnitureData,
        costState: costState,
        furnitureCounter: furnitureCounter,
      };

      localStorage.setItem("workspaceState", JSON.stringify(state));
      console.log(
        `Workspace state saved: ${furnitureData.length} furniture items`,
      );
    }
  } catch (error) {
    console.error("Error saving workspace state:", error);
  }
}

/**
 * Restore room from saved room plan data
 * @param {Object} roomData - Room plan data from collectRoomPlanData()
 */
async function restoreRoom(roomData) {
  if (!roomData) {
    console.warn("No room data provided to restoreRoom");
    return;
  }

  try {
    // Restore room dimensions if provided
    if (roomData.room_width && roomData.room_length) {
      localStorage.setItem("roomWidth", roomData.room_width.toString());
      localStorage.setItem("roomLength", roomData.room_length.toString());
      // Reinitialize room with new dimensions
      initializeRoom();
    }

    // Restore furniture items
    const furnitureData = roomData.furniture_data || [];
    if (furnitureData.length === 0) {
      console.log("No furniture items to restore");
      return;
    }

    // Array to track model loading promises
    const modelLoadPromises = [];

    console.log(
      `Restoring ${furnitureData.length} furniture items from saved room state`,
    );

    // Restore furniture counter
    if (
      roomData.furnitureCounter &&
      typeof roomData.furnitureCounter === "number"
    ) {
      furnitureCounter = Math.max(furnitureCounter, roomData.furnitureCounter);
    }

    // Restore furniture items
    const furnitureContainer = document.getElementById("furniture-container");
    if (!furnitureContainer) {
      console.warn("Furniture container not found");
      return;
    }

    const roomWidth =
      roomData.room_width ||
      parseFloat(localStorage.getItem("roomWidth")) ||
      10;
    const roomLength =
      roomData.room_length ||
      parseFloat(localStorage.getItem("roomLength")) ||
      10;
    const wallHeight =
      roomData.room_height ||
      parseFloat(localStorage.getItem("roomHeight")) ||
      3;

    // Clear existing furniture first to avoid duplicates
    const existingFurniture =
      furnitureContainer.querySelectorAll('[id^="furniture-"]');
    if (existingFurniture.length > 0) {
      console.log(
        `Clearing ${existingFurniture.length} existing furniture items before restore`,
      );
      existingFurniture.forEach((item) => item.remove());
    }

    // Batched processing helper
    const processItem = (itemData) => {
      // Validate item data
      if (
        !itemData.model_key ||
        !itemData.position ||
        typeof itemData.position.x !== "number" ||
        typeof itemData.position.y !== "number" ||
        typeof itemData.position.z !== "number"
      ) {
        console.warn("Invalid furniture item data:", itemData);
        return;
      }

      const furnitureEl = document.createElement("a-entity");
      furnitureEl.id = `furniture-${furnitureCounter++}`;
      furnitureEl.setAttribute(
        "position",
        `${itemData.position.x} ${itemData.position.y} ${itemData.position.z}`,
      );

      // Handle rotation
      const rotation = itemData.rotation || { x: 0, y: 0, z: 0 };
      furnitureEl.setAttribute(
        "rotation",
        `${rotation.x} ${rotation.y} ${rotation.z}`,
      );

      // Handle scale – prefer the per-item config so old saves also get corrected sizes
      const configScale = FURNITURE_SCALES[itemData.model_key];
      if (configScale) {
        furnitureEl.setAttribute("scale", configScale);
      } else {
        const scale = itemData.scale || { x: 1, y: 1, z: 1 };
        furnitureEl.setAttribute("scale", `${scale.x} ${scale.y} ${scale.z}`);
      }

      furnitureEl.setAttribute("data-model-key", itemData.model_key);

      // Models are pre-cached during loading screen, no placeholder needed.
      furnitureContainer.appendChild(furnitureEl);

      if (furnitureEl.flushToDOM) {
        furnitureEl.flushToDOM();
      }

      // Load model
      const modelUrl = getModelUrl(itemData.model_key);
      furnitureEl.setAttribute("cached-obj-model", "src", modelUrl);
      furnitureEl.setAttribute(
        "draggable-furniture",
        `roomWidth: ${roomWidth}; roomLength: ${roomLength}; wallHeight: ${wallHeight}; objectWidth: 1.5; objectLength: 1.5; wallThickness: 0.1`,
      );
      furnitureEl.setAttribute("clickable-furniture", "");

      // Apply per-item material so each furniture type has a distinct look.
      furnitureEl.setAttribute(
        "textured-model",
        getFurnitureMaterialAttr(itemData.model_key),
      );

      // Create a promise that resolves when model loads or rejects on error/timeout
      const modelLoadPromise = new Promise((resolve) => {
        let modelLoadTimeout;
        let modelLoaded = false;

        const onModelLoaded = function () {
          if (modelLoaded) return;
          modelLoaded = true;
          clearTimeout(modelLoadTimeout);
          resolve();
        };

        furnitureEl.addEventListener("model-loaded", onModelLoaded, {
          once: true,
        });

        // Set timeout for model loading
        modelLoadTimeout = setTimeout(() => {
          if (!modelLoaded) {
            modelLoaded = true;
            console.warn(
              `Model load timeout for ${itemData.model_key} at ${modelUrl}`,
            );
            resolve();
          }
        }, MODEL_LOAD_TIMEOUT);

        // Listen for model error
        furnitureEl.addEventListener(
          "model-error",
          function (e) {
            if (modelLoaded) return;
            modelLoaded = true;
            clearTimeout(modelLoadTimeout);
            console.error(
              `Model load error for ${itemData.model_key}:`,
              e.detail,
            );
            resolve();
          },
          { once: true },
        );
      });

      modelLoadPromises.push(modelLoadPromise);
    };

    // Execute batch processing
    const BATCH_SIZE = 5;
    for (let i = 0; i < furnitureData.length; i += BATCH_SIZE) {
      const batch = furnitureData.slice(i, i + BATCH_SIZE);
      batch.forEach(processItem);
      // Yield to main thread to prevent UI freeze
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Wait for ALL models to finish loading before continuing
    if (modelLoadPromises.length > 0) {
      console.log(`Waiting for ${modelLoadPromises.length} models to load...`);
      await Promise.all(modelLoadPromises);
      console.log("All models loaded");
    }

    // Restore cost state
    if (
      roomData.costState &&
      roomData.costState.items &&
      typeof roomData.costState.items === "object"
    ) {
      costState.items = roomData.costState.items;
      costState.total =
        typeof roomData.costState.total === "number"
          ? roomData.costState.total
          : 0;
      renderCost();
      console.log("Cost state restored");

      // Expand cost panel if there are items
      const costPanel = document.getElementById("cost-panel");
      if (costPanel && Object.keys(costState.items).length > 0) {
        costPanel.classList.remove("collapsed");
      }
    } else if (roomData.cost_total) {
      // If only cost_total is provided, update it
      costState.total = roomData.cost_total;
      renderCost();
    }

    // Expand cost panel if furniture was restored
    if (furnitureData.length > 0) {
      const costPanel = document.getElementById("cost-panel");
      if (costPanel) {
        costPanel.classList.remove("collapsed");
      }
    }

    console.log("Room restored successfully");
  } catch (error) {
    console.error("Error restoring room:", error);
  }
}

/**
 * Restore workspace state from localStorage (legacy support)
 */
async function restoreWorkspaceState() {
  // First try to restore from currentRoomState (new format)
  try {
    const currentStateJson = localStorage.getItem("currentRoomState");
    if (currentStateJson) {
      const currentState = JSON.parse(currentStateJson);
      restoreRoom(currentState);
      return;
    }
  } catch (error) {
    console.warn(
      "Error restoring from currentRoomState, trying legacy format:",
      error,
    );
  }

  // Fallback to legacy workspaceState format
  try {
    const stateJson = localStorage.getItem("workspaceState");
    if (!stateJson) {
      console.log("No workspace state found in localStorage");
      return;
    }

    let state;
    try {
      state = JSON.parse(stateJson);
    } catch (parseError) {
      console.error(
        "Error parsing workspace state from localStorage:",
        parseError,
      );
      // Clear corrupted data
      localStorage.removeItem("workspaceState");
      return;
    }

    if (!state || !state.furniture || !Array.isArray(state.furniture)) {
      console.warn("Invalid workspace state structure");
      return;
    }

    if (state.furniture.length === 0) {
      console.log("Workspace state has no furniture items to restore");
      return;
    }

    console.log(
      `Restoring ${state.furniture.length} furniture items from legacy saved state`,
    );

    // Convert legacy format to new format
    const roomData = {
      room_width: parseFloat(localStorage.getItem("roomWidth")) || 10,
      room_length: parseFloat(localStorage.getItem("roomLength")) || 10,
      furniture_data: state.furniture,
      costState: state.costState,
      furnitureCounter: state.furnitureCounter,
    };

    restoreRoom(roomData);
  } catch (error) {
    console.error("Error restoring workspace state:", error);
    // Don't clear state on error - might be recoverable
  }
}

/**
 * Show welcome dialog with instructions (one-time only)
 */
function showWelcomeDialog() {
  // Check if welcome dialog has been shown before
  const welcomeShown = localStorage.getItem("welcomeDialogShown");
  if (welcomeShown === "true") {
    return; // Don't show again
  }

  // Get room dimensions for display
  const width = localStorage.getItem("roomWidth") || "?";
  const length = localStorage.getItem("roomLength") || "?";
  const height = localStorage.getItem("roomHeight") || "?";

  const welcomeContent = `
    <div class="welcome-dialog-content">
      <h2 class="welcome-title">Welcome to 3D Room Planner</h2>
      <p class="welcome-subtitle">Your room: ${width}M × ${length}M × ${height}M</p>
      
      <div class="welcome-section">
        <h3>Controls</h3>
        <ul>
          <li><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> — Move around</li>
          <li><kbd>Q</kbd> Move Up &nbsp;|&nbsp; <kbd>E</kbd> Move Down</li>
          <li><kbd>Space</kbd> Fly Up &nbsp;|&nbsp; <kbd>Shift</kbd> Fly Down</li>
          <li><strong>Mouse</strong> — Look around</li>
        </ul>
      </div>

      <div class="welcome-section">
        <h3>Furniture</h3>
        <ul>
          <li>Click the panel button to open the library</li>
          <li>Drag furniture into your room</li>
          <li>Click an item to show more options</li>
        </ul>
      </div>

      <div class="welcome-section">
        <h3>Cost Board</h3>
        <ul>
          <li>View costs and total in the cost panel</li>
          <li>Walk around to view from different angles</li>
        </ul>
      </div>

      <div class="welcome-tip">
        <strong>Tip:</strong> Hover over the <strong>?</strong> button anytime to see these instructions again.
      </div>
    </div>
  `;

  // Create custom welcome dialog
  const modal = document.getElementById("dialog-modal");
  const content = document.getElementById("dialog-content");
  const titleEl = document.getElementById("dialog-title");
  const messageEl = document.getElementById("dialog-message");
  const buttonsEl = document.getElementById("dialog-buttons");

  if (!modal || !content) {
    console.warn("Dialog modal not found");
    return;
  }

  // Hide default title and message, use custom content
  titleEl.style.display = "none";
  messageEl.innerHTML = welcomeContent;
  messageEl.style.margin = "0";
  messageEl.style.padding = "0";

  // Add close button
  buttonsEl.innerHTML =
    '<button id="dialog-ok-btn" class="dialog-btn dialog-btn-primary">Got it!</button>';

  // Show modal
  modal.style.display = "flex";
  content.classList.add("welcome-dialog");

  // Handle close button
  const okBtn = document.getElementById("dialog-ok-btn");
  const closeDialog = () => {
    modal.style.display = "none";
    content.classList.remove("welcome-dialog");
    // Mark as shown
    localStorage.setItem("welcomeDialogShown", "true");
  };

  okBtn.onclick = closeDialog;

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeDialog();
    }
  };

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      closeDialog();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);
}

// Initialize room when page loads
window.addEventListener("load", async function () {
  // Wait for HTML components to load
  if (window.htmlLoader) {
    await window.htmlLoader.ready;
  }

  // Load items and prices from Supabase first
  await loadItemsAndPrices();

  // Initialize auth UI
  if (typeof initAuthUI === "function") {
    initAuthUI();
  }

  // Update subcategory names in UI
  updateSubcategoryUI();

  // Attach click event listener to drop indicator (attach once on load)
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.addEventListener("click", handleDropIndicatorClick);
  }

  // Store original side panel content for wardrobe navigation
  const sidePanel = document.getElementById("side-panel");
  if (sidePanel && !sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Initialize loading controller
  LoadingController.init();
  LoadingController.startFallbackTimer();
  LoadingController.updateStatus("Loading 3D engine...");
  LoadingController.updateProgress(10);

  // Make sure A-Frame scene is ready
  const scene = document.querySelector("a-scene");

  async function onSceneLoaded() {
    LoadingController.updateStatus("Building room...");
    LoadingController.updateProgress(10);

    initializeRoom();

    // ── UNIFIED ASSET PRELOAD ────────────────────────────────────────
    // Load ALL 3D models, textures, and thumbnails DURING the loading
    // screen so every drag-and-drop is instant when the user enters.
    LoadingController.updateStatus("Preparing furniture models...");
    LoadingController.updateProgress(15);

    if (
      window.AssetPreloader &&
      typeof window.AssetPreloader.preloadAll === "function"
    ) {
      console.log(
        "[Planner] Starting unified asset preload during loading screen...",
      );
      let lastLoaded = 0;
      await window.AssetPreloader.preloadAll({
        showProgress: false, // We use our own LoadingController
        onProgress: (info) => {
          // Map asset preload progress to 15-75% of loading bar
          const assetPercent = info.progress || 0;
          const mapped = 15 + Math.round(assetPercent * 0.6); // 15% → 75%
          LoadingController.updateProgress(mapped);
          // Show fast status for cached loads, detailed for first load
          if (info.loaded !== lastLoaded) {
            lastLoaded = info.loaded;
            if (assetPercent > 80 && info.loaded >= info.total - 2) {
              LoadingController.updateStatus("Almost ready...");
            } else {
              LoadingController.updateStatus(
                `Loading furniture models... (${info.loaded}/${info.total})`,
              );
            }
          }
        },
      });
      console.log("[Planner] All assets preloaded successfully.");
    } else {
      console.warn(
        "[Planner] AssetPreloader not available, skipping unified preload.",
      );
    }

    LoadingController.updateStatus("Restoring room...");
    LoadingController.updateProgress(78);

    // Auto-restore room state after room is initialized
    const saved = localStorage.getItem("currentRoomState");
    if (saved) {
      try {
        const roomData = JSON.parse(saved);
        await restoreRoom(roomData);
        console.log("Room state auto-restored from currentRoomState");
      } catch (error) {
        console.error(
          "Error parsing currentRoomState, trying legacy restore:",
          error,
        );
        restoreWorkspaceState();
      }
    } else {
      restoreWorkspaceState();
    }

    // Pre-upload textures to GPU (this is what causes lag - do it during loading screen)
    LoadingController.updateStatus("Uploading textures to GPU...");
    LoadingController.updateProgress(85);
    await preUploadTexturesToGPU((status) =>
      LoadingController.updateStatus(status),
    );

    // GPU Warmup - pre-compile shaders to prevent stutter
    LoadingController.updateStatus("Compiling shaders...");
    LoadingController.updateProgress(95);
    await warmupGPU();

    LoadingController.updateProgress(100);
    LoadingController.updateStatus("Ready!");

    // Single frame wait for GPU to flush
    await new Promise((resolve) => requestAnimationFrame(resolve));

    LoadingController.hide();

    // DEFERRED: Generate 3D thumbnails after loading screen is gone.
    // SVG icons are already visible and clear, thumbnails replace them
    // progressively in the background.
    setTimeout(() => {
      if (
        window.furnitureThumbnails &&
        typeof window.furnitureThumbnails.generate === "function"
      ) {
        window.furnitureThumbnails.generate().catch(() => {});
      }
    }, 1000);

    // Show welcome dialog after loading is complete
    setTimeout(() => {
      showWelcomeDialog();
    }, 600);
  }

  if (scene.hasLoaded) {
    onSceneLoaded();
  } else {
    scene.addEventListener("loaded", onSceneLoaded);
  }

  // Ensure cost panel renders at least once on load
  renderCost();

  // Keep cost panel collapsed on startup if no items
  const costPanel = document.getElementById("cost-panel");
  if (costPanel && Object.keys(costState.items).length === 0) {
    costPanel.classList.add("collapsed");
  }

  // Save state before page unload using collectRoomPlanData
  window.addEventListener("beforeunload", () => {
    if (typeof collectRoomPlanData === "function") {
      const roomPlanData = collectRoomPlanData();
      localStorage.setItem(
        "currentRoomState",
        JSON.stringify({
          ...roomPlanData,
          costState: costState,
          furnitureCounter: furnitureCounter,
        }),
      );
      console.log("Room state auto-saved on page unload");
    } else {
      saveWorkspaceState();
    }
  });

  // Also save on visibility change (when tab becomes hidden)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (typeof collectRoomPlanData === "function") {
        const roomPlanData = collectRoomPlanData();
        localStorage.setItem(
          "currentRoomState",
          JSON.stringify({
            ...roomPlanData,
            costState: costState,
            furnitureCounter: furnitureCounter,
          }),
        );
      } else {
        saveWorkspaceState();
      }
    }
  });
});

/**
 * Update subcategory UI with names from metadata
 */
function updateSubcategoryUI() {
  const selectors = [
    '[data-model^="wardrobe"]',
    '[data-model^="center_table"]',
    '[data-model^="bed"]',
    '[data-model^="chair"]',
    '[data-model^="desk"]',
    '[data-model^="mirror"]',
    '[data-model^="shelf"]',
  ];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((item) => {
      const modelKey = item.getAttribute("data-model");
      const nameEl = item.querySelector(".model-name");
      if (nameEl && modelKey) {
        nameEl.textContent = getItemName(modelKey);
      }
    });
  });
}

/**
 * Handle save estimation button click
 */
async function handleSaveEstimation() {
  const isAuthenticated = await checkAuth();

  if (!isAuthenticated) {
    showAuthModal(async () => {
      await handleSaveEstimation();
    });
    return;
  }

  try {
    const nameInput = await showPrompt(
      "Enter a name for this cost estimation:",
      "",
      "Save Cost Estimation",
    );
    const estimationName =
      (nameInput && nameInput.trim()) ||
      `Cost Estimation ${new Date().toLocaleString()}`;

    if (typeof saveCostEstimation === "function") {
      saveCostEstimation(estimationName);

      // Show notification
      const notification = document.getElementById(
        "save-estimation-notification",
      );
      if (notification) {
        notification.textContent = "saved to profile";
        notification.classList.add("show");

        // Hide notification after 3 seconds
        setTimeout(() => {
          notification.classList.remove("show");
        }, 3000);
      }
    } else {
      await showDialog("Error: Save function not available", "Error");
    }
  } catch (error) {
    console.error("Error saving cost estimation:", error);
    await showDialog(
      "Unable to save cost estimation. Please try again.",
      "Error",
    );
  }
}

// Expose globally for onclick handler
window.handleSaveEstimation = handleSaveEstimation;
window.saveWorkspaceState = saveWorkspaceState;
window.restoreRoom = restoreRoom;
window.showBedSubcategory = showBedSubcategory;
window.showChairSubcategory = showChairSubcategory;
window.showDeskSubcategory = showDeskSubcategory;
window.showMirrorSubcategory = showMirrorSubcategory;
window.showShelfSubcategory = showShelfSubcategory;
