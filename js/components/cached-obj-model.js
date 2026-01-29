// cached-obj-model.js
// Lightweight OBJ loader with in-memory caching + cloning for faster repeated spawns.

(() => {
  if (!window.AFRAME) return;

  const OBJ_CACHE = new Map(); // url -> Promise<THREE.Object3D>

  function normalizeUrl(url) {
    if (!url) return "";
    // Accept A-Frame style url(...) wrappers.
    const trimmed = String(url).trim();
    const match = trimmed.match(/^url\((.*)\)$/i);
    if (match && match[1]) return match[1].trim().replace(/^['"]|['"]$/g, "");
    return trimmed.replace(/^['"]|['"]$/g, "");
  }

  function ensureThreeCacheEnabled() {
    try {
      if (window.THREE && THREE.Cache) {
        THREE.Cache.enabled = true;
      }
    } catch (_) {
      // no-op
    }
  }

  function loadObj(url) {
    const normalized = normalizeUrl(url);
    if (!normalized) return Promise.reject(new Error("Missing OBJ url"));

    if (OBJ_CACHE.has(normalized)) return OBJ_CACHE.get(normalized);

    const promise = new Promise((resolve, reject) => {
      ensureThreeCacheEnabled();

      if (!window.THREE || typeof THREE.OBJLoader !== "function") {
        reject(new Error("THREE.OBJLoader not available"));
        return;
      }

      const loader = new THREE.OBJLoader();
      loader.load(
        normalized,
        (obj) => resolve(obj),
        undefined,
        (err) => reject(err || new Error(`Failed to load OBJ: ${normalized}`)),
      );
    });

    OBJ_CACHE.set(normalized, promise);
    return promise;
  }

  function cloneWithUniqueMaterials(object3d) {
    const clone = object3d.clone(true);
    clone.traverse((node) => {
      if (node.isMesh && node.material) {
        // Avoid cross-instance material mutation (A-Frame may change material props).
        if (Array.isArray(node.material)) {
          node.material = node.material.map((m) => (m ? m.clone() : m));
        } else {
          node.material = node.material.clone();
        }
      }
    });
    return clone;
  }

  // Expose a small preload helper (optional usage from app code).
  window.preloadObjModel = function preloadObjModel(url) {
    return loadObj(url).catch(() => null);
  };

  // Expose cache status for debugging and preloader integration
  window.getObjCacheStatus = function getObjCacheStatus() {
    return {
      size: OBJ_CACHE.size,
      keys: Array.from(OBJ_CACHE.keys()),
    };
  };

  // Check if a model is already cached
  window.isObjModelCached = function isObjModelCached(url) {
    const normalized = normalizeUrl(url);
    return OBJ_CACHE.has(normalized);
  };

  AFRAME.registerComponent("cached-obj-model", {
    schema: {
      src: { type: "string" },
    },

    init() {
      this._currentSrc = "";
    },

    update(oldData) {
      const newSrc = normalizeUrl(this.data.src);
      const oldSrc = normalizeUrl(oldData && oldData.src);
      if (!newSrc || newSrc === oldSrc) return;

      this._currentSrc = newSrc;

      // If OBJLoader isn't present, fall back to built-in obj-model.
      if (!window.THREE || typeof THREE.OBJLoader !== "function") {
        this.el.setAttribute("obj-model", "obj", `url(${newSrc})`);
        return;
      }

      loadObj(newSrc)
        .then((original) => {
          // If src changed while loading, ignore.
          if (this._currentSrc !== newSrc) return;

          const cloned = cloneWithUniqueMaterials(original);
          this.el.setObject3D("mesh", cloned);
          this.el.emit("model-loaded", { format: "obj", model: cloned });
        })
        .catch((error) => {
          if (this._currentSrc !== newSrc) return;
          this.el.emit("model-error", { format: "obj", src: newSrc, error });
        });
    },

    remove() {
      // Clean up object3D reference on component removal.
      try {
        this.el.removeObject3D("mesh");
      } catch (_) {
        // no-op
      }
    },
  });
})();
