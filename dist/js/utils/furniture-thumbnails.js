// furniture-thumbnails.js
// Renders actual 3D model thumbnails using an offscreen THREE.js renderer.
// Each furniture OBJ is loaded from the OBJ_CACHE (already preloaded by
// asset-preloader), cloned, given the correct material from FURNITURE_MATERIALS,
// and rendered from an isometric-style camera angle into a small canvas.
// The resulting data-URL is cached and injected into the side-panel icons.

(() => {
  "use strict";

  const THUMB_SIZE = 96; // px – rendered size (displayed at 64px via CSS)
  const THUMBNAIL_CACHE = {}; // modelKey -> objectURL or dataURL

  // ── Model key → OBJ filename mapping (mirrors STORAGE_MODEL_FILES) ──
  const MODEL_FILES = {
    center_table1: "center_table1.obj",
    center_table2: "center_table2.obj",
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
    wardrobe1: "wardrobe_modern.obj",
    wardrobe2: "wardrobe_traditional.obj",
    wardrobe3: "wardrobe_openframe.obj",
  };

  // ── Material configs (mirrors FURNITURE_MATERIALS in planner.js) ──
  const MATERIALS = {
    bed1: {
      color: "#7B8EA0",
      pillowColor: "#F5F0E8",
      frameColor: "#5C3A1E",
      roughness: 0.92,
      metalness: 0.0,
      mode: "bed",
    },
    bed2: {
      color: "#8B6E5A",
      pillowColor: "#FFFAF0",
      frameColor: "#4A2C17",
      roughness: 0.92,
      metalness: 0.0,
      mode: "bed",
    },
    chair1: { color: "#DEB887", roughness: 0.6, metalness: 0.05, mode: "wood" },
    chair2: {
      color: "#D2691E",
      roughness: 0.55,
      metalness: 0.05,
      mode: "wood",
    },
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
    desk1: { color: "#D2B48C", roughness: 0.4, metalness: 0.12, mode: "wood" },
    desk2: { color: "#BC8F8F", roughness: 0.35, metalness: 0.15, mode: "wood" },
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
    shelf1: { color: "#F5DEB3", roughness: 0.7, metalness: 0.03, mode: "wood" },
    shelf2: {
      color: "#FAEBD7",
      roughness: 0.65,
      metalness: 0.03,
      mode: "wood",
    },
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

  // Shared offscreen renderer (created once, reused)
  let _renderer = null;
  let _scene = null;
  let _camera = null;

  function getRenderer() {
    if (_renderer)
      return { renderer: _renderer, scene: _scene, camera: _camera };

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_SIZE;
    canvas.height = THUMB_SIZE;

    _renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false, // not needed at thumbnail size
      preserveDrawingBuffer: true,
    });
    _renderer.setSize(THUMB_SIZE, THUMB_SIZE);
    _renderer.setPixelRatio(1);
    _renderer.outputColorSpace = THREE.SRGBColorSpace;
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.2;

    _scene = new THREE.Scene();

    // Warm studio lighting to match the cozy room ambience
    const ambient = new THREE.AmbientLight(0xfff5e6, 0.6);
    _scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffecd0, 1.6);
    keyLight.position.set(3, 5, 4);
    _scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd8e0f0, 0.6);
    fillLight.position.set(-3, 2, -2);
    _scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.4);
    rimLight.position.set(0, 1, -4);
    _scene.add(rimLight);

    // Perspective camera (will be repositioned per model)
    _camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);

    return { renderer: _renderer, scene: _scene, camera: _camera };
  }

  /**
   * Clone an Object3D and give each mesh its own unique material instance.
   */
  function cloneModel(original) {
    const clone = original.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => (m ? m.clone() : m));
        } else {
          node.material = node.material.clone();
        }
      }
    });
    return clone;
  }

  /**
   * Apply the correct material/color to every mesh in the model
   * to match how it looks inside the 3D room.
   */
  function applyMaterial(group, modelKey) {
    const mat = MATERIALS[modelKey];
    if (!mat) return;

    if (mat.mode === "bed") {
      applyBedMaterial(group, mat);
    } else if (mat.mode === "mirror") {
      applyMirrorMaterial(group);
    } else {
      // Wood / generic color
      group.traverse((node) => {
        if (node.isMesh) {
          node.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(mat.color),
            roughness: mat.roughness,
            metalness: mat.metalness,
          });
        }
      });
    }
  }

  /**
   * Bed vertex-color scheme: largest mesh = mattress, 2nd = pillow, rest = frame.
   */
  function applyBedMaterial(group, mat) {
    const meshes = [];
    group.traverse((n) => {
      if (n.isMesh) meshes.push(n);
    });
    if (meshes.length === 0) return;

    // Sort by vertex count descending
    meshes.sort((a, b) => {
      const va = a.geometry.attributes.position
        ? a.geometry.attributes.position.count
        : 0;
      const vb = b.geometry.attributes.position
        ? b.geometry.attributes.position.count
        : 0;
      return vb - va;
    });

    meshes.forEach((m, i) => {
      let color;
      if (i === 0)
        color = mat.color; // mattress
      else if (i === 1)
        color = mat.pillowColor; // pillow
      else color = mat.frameColor; // frame / legs
      m.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: mat.roughness,
        metalness: mat.metalness,
      });
    });
  }

  /**
   * Mirror material - reflective silver.
   */
  function applyMirrorMaterial(group) {
    group.traverse((node) => {
      if (node.isMesh) {
        node.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0xd9d9d9),
          roughness: 0.08,
          metalness: 0.85,
        });
      }
    });
  }

  /**
   * Fit camera to look at the model from a nice isometric-ish angle.
   */
  function fitCameraToModel(camera, group) {
    // Compute bounding box
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let dist = maxDim / 2 / Math.tan(fov / 2);
    dist *= 1.6; // pull back a little for padding

    // Isometric-like angle: 30° above horizon, 45° to the right
    const phi = Math.PI / 6; // elevation (30°)
    const theta = Math.PI / 4; // azimuth  (45°)

    camera.position.set(
      center.x + dist * Math.cos(phi) * Math.sin(theta),
      center.y + dist * Math.sin(phi),
      center.z + dist * Math.cos(phi) * Math.cos(theta),
    );
    camera.lookAt(center);
    camera.updateProjectionMatrix();
  }

  /**
   * Render a single model thumbnail and return the data URL.
   */
  async function renderThumbnail(modelKey) {
    const file = MODEL_FILES[modelKey];
    if (!file) return null;

    const url = `asset/models/${file}`;

    // Wait for the model to be in cache (preloadObjModel returns a promise)
    let original;
    try {
      original = await window.preloadObjModel(url);
    } catch (e) {
      console.warn(`[Thumbnails] Could not load ${modelKey}:`, e);
      return null;
    }
    if (!original) return null;

    const { renderer, scene, camera } = getRenderer();

    // Clone so we don't touch the cached original
    const model = cloneModel(original);
    applyMaterial(model, modelKey);

    // Clear previous model from scene (keep lights)
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      if (!child.isLight) {
        scene.remove(child);
      }
    }

    scene.add(model);
    fitCameraToModel(camera, model);

    renderer.render(scene, camera);

    // Use async toBlob + object URL instead of synchronous toDataURL.
    // toDataURL blocks the main thread during PNG encoding; toBlob does
    // the encoding off the main thread so there's no frame-drop.
    const imageURL = await new Promise((res) => {
      renderer.domElement.toBlob((blob) => {
        if (blob) {
          res(URL.createObjectURL(blob));
        } else {
          // Fallback: toDataURL (shouldn't happen but safety net)
          res(renderer.domElement.toDataURL("image/png"));
        }
      }, "image/png");
    });

    // Cleanup: remove model from scene and dispose geometry/material
    scene.remove(model);
    model.traverse((node) => {
      if (node.isMesh) {
        node.geometry.dispose();
        if (Array.isArray(node.material)) {
          node.material.forEach((m) => m.dispose());
        } else if (node.material) {
          node.material.dispose();
        }
      }
    });

    return imageURL;
  }

  /**
   * Generate thumbnails for all furniture models.
   * Uses idle-callback scheduling so the main thread stays responsive.
   * Each thumbnail is injected into the DOM the moment it's ready so
   * users see icons appear progressively instead of all at once.
   */
  function generateAllThumbnails() {
    return new Promise((resolve) => {
      const keys = Object.keys(MODEL_FILES);
      const pending = keys.filter((k) => !THUMBNAIL_CACHE[k]);
      if (pending.length === 0) {
        refreshAllIcons();
        resolve();
        return;
      }

      console.log(`[Thumbnails] Generating ${pending.length} 3D thumbnails...`);
      const startTime = performance.now();
      let idx = 0;

      // Yield one animation frame between each render so the scene keeps
      // running smoothly.  This is the same trick used for the OBJ worker:
      // spread GPU work across frames instead of batching.
      function yieldFrame() {
        return new Promise((r) => requestAnimationFrame(r));
      }

      async function processAll() {
        while (idx < pending.length) {
          const key = pending[idx++];
          try {
            const url = await renderThumbnail(key);
            if (url) {
              THUMBNAIL_CACHE[key] = url;
              injectSingleIcon(key, url);
            }
          } catch (_) {
            /* skip failed renders */
          }
          // Yield to let the scene render a normal frame in between
          await yieldFrame();
        }
        const elapsed = (performance.now() - startTime).toFixed(0);
        console.log(
          `[Thumbnails] All ${pending.length} thumbnails ready in ${elapsed}ms`,
        );
        refreshAllIcons();
        resolve();
      }

      processAll();
    });
  }

  /**
   * Inject a single thumbnail into any matching DOM nodes right away.
   */
  function injectSingleIcon(modelKey, dataURL) {
    // Direct model match (subcategory items)
    document
      .querySelectorAll(`.model-item[data-model="${modelKey}"]`)
      .forEach((item) => {
        const icon = item.querySelector(".model-icon");
        if (icon)
          icon.innerHTML = `<img src="${dataURL}" alt="${modelKey}" draggable="false">`;
      });

    // Category match (main panel items like data-category="chair" → chair1)
    const reverseCategoryMap = {
      center_table1: "center-table",
      chair1: "chair",
      bed1: "bed",
      wardrobe1: "wardrobe",
      desk1: "desk",
      mirror1: "mirror",
      shelf1: "shelf",
    };
    const category = reverseCategoryMap[modelKey];
    if (category) {
      document
        .querySelectorAll(`.model-item[data-category="${category}"]`)
        .forEach((item) => {
          const icon = item.querySelector(".model-icon");
          if (icon)
            icon.innerHTML = `<img src="${dataURL}" alt="${modelKey}" draggable="false">`;
        });
    }
  }

  /**
   * Replace all <span class="model-icon"> that have a data-model-key
   * (or whose parent has data-model / data-category) with <img> thumbnails.
   */
  function refreshAllIcons() {
    // Update enabled items that have a known model key
    document.querySelectorAll(".model-item").forEach((item) => {
      const modelKey =
        item.getAttribute("data-model") || item.getAttribute("data-category");
      if (!modelKey) return;

      // Map category names to a representative model key for the main panel
      const resolvedKey = resolveCategoryKey(modelKey);
      const dataURL = THUMBNAIL_CACHE[resolvedKey];
      if (!dataURL) return;

      const icon = item.querySelector(".model-icon");
      if (icon) {
        icon.innerHTML = `<img src="${dataURL}" alt="${resolvedKey}" draggable="false">`;
      }
    });
  }

  /**
   * Map category/data-model values to model keys.
   * In the main panel, categories use generic names like "center-table",
   * while subcategories use specific keys like "center_table1".
   */
  function resolveCategoryKey(key) {
    const categoryMap = {
      "center-table": "center_table1",
      chair: "chair1",
      bed: "bed1",
      wardrobe: "wardrobe1",
      desk: "desk1",
      mirror: "mirror1",
      shelf: "shelf1",
    };
    return categoryMap[key] || key;
  }

  /**
   * Get the thumbnail data URL for a model key.
   * Used by getFurnitureIconHTML() in planner.js.
   */
  function getThumbnailURL(modelKey) {
    return THUMBNAIL_CACHE[modelKey] || null;
  }

  /**
   * Dispose the offscreen renderer to free GPU memory.
   * Called if you ever need to clean up.
   */
  function dispose() {
    if (_renderer) {
      _renderer.dispose();
      _renderer = null;
      _scene = null;
      _camera = null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────
  window.furnitureThumbnails = {
    generate: generateAllThumbnails,
    refresh: refreshAllIcons,
    getURL: getThumbnailURL,
    dispose: dispose,
  };

  // ── Auto-generate when assets are preloaded ────────────────────────
  // The asset-preloader now calls generate() directly during its
  // pipeline, so thumbnails are ready before assetPreloadComplete fires.
  // This listener is kept as a safety net for cases where the preloader
  // doesn't have access to the thumbnails API (e.g. script load order).
  window.addEventListener("assetPreloadComplete", () => {
    // Only generate if not already done (idempotent)
    const keys = Object.keys(MODEL_FILES);
    const alreadyDone = keys.every((k) => THUMBNAIL_CACHE[k]);
    if (!alreadyDone) {
      generateAllThumbnails().then(() => dispose());
    } else {
      // Thumbnails were pre-generated — just clean up the renderer
      dispose();
    }
  });
})();
