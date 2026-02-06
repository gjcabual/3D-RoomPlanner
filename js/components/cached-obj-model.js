// cached-obj-model.js
// Lightweight OBJ loader with in-memory caching + cloning for faster repeated spawns.
// Supports both main-thread OBJLoader (for on-demand loads) and
// pre-parsed worker results (for zero-lag background preloading).

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

  /**
   * Build a THREE.Object3D (Group of Meshes) from pre-parsed buffer data
   * returned by the obj-parser-worker.  This is nearly instant because
   * there is zero string parsing – we just set typed-array attributes.
   *
   * @param {Array<{positions: Float32Array, normals: Float32Array|null, uvs: Float32Array|null}>} meshes
   * @returns {THREE.Group}
   */
  function buildObject3DFromBuffers(meshes) {
    const group = new THREE.Group();

    for (const mesh of meshes) {
      if (!mesh.positions || mesh.positions.length === 0) continue;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(mesh.positions, 3),
      );

      if (mesh.normals && mesh.normals.length > 0) {
        geometry.setAttribute(
          "normal",
          new THREE.BufferAttribute(mesh.normals, 3),
        );
      } else {
        geometry.computeVertexNormals();
      }

      if (mesh.uvs && mesh.uvs.length > 0) {
        geometry.setAttribute("uv", new THREE.BufferAttribute(mesh.uvs, 2));
      }

      const material = new THREE.MeshStandardMaterial();
      const child = new THREE.Mesh(geometry, material);
      group.add(child);
    }

    return group;
  }

  /**
   * Inject a pre-parsed model (from the Web Worker) directly into the cache.
   * Called by asset-preloader so that subsequent loadObj() calls return instantly.
   *
   * @param {string} url
   * @param {Array} meshBuffers – array from the worker message
   */
  function injectWorkerResult(url, meshBuffers) {
    const normalized = normalizeUrl(url);
    if (!normalized || OBJ_CACHE.has(normalized)) return;

    // Validate: never cache empty geometry – let the real OBJLoader handle it
    const hasGeometry =
      meshBuffers &&
      meshBuffers.some((m) => m.positions && m.positions.length > 0);
    if (!hasGeometry) return;

    const obj = buildObject3DFromBuffers(meshBuffers);
    OBJ_CACHE.set(normalized, Promise.resolve(obj));
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

  // Expose worker-result injector for the asset-preloader
  window.injectObjWorkerResult = injectWorkerResult;

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
      this._loadingIndicator = null;
    },

    // Show a spinning loading indicator while model loads
    _showLoadingIndicator() {
      if (this._loadingIndicator) return;

      // Create a simple spinning ring as loading indicator
      const geometry = new THREE.TorusGeometry(0.3, 0.05, 8, 24);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff8c00, // Orange color matching the app theme
        transparent: true,
        opacity: 0.8,
      });
      this._loadingIndicator = new THREE.Mesh(geometry, material);
      this._loadingIndicator.rotation.x = Math.PI / 2;

      // Add animation
      this._animateLoading = () => {
        if (this._loadingIndicator) {
          this._loadingIndicator.rotation.z += 0.05;
          this._loadingAnimationId = requestAnimationFrame(
            this._animateLoading,
          );
        }
      };
      this._animateLoading();

      this.el.object3D.add(this._loadingIndicator);
    },

    _hideLoadingIndicator() {
      if (this._loadingAnimationId) {
        cancelAnimationFrame(this._loadingAnimationId);
        this._loadingAnimationId = null;
      }
      if (this._loadingIndicator) {
        this.el.object3D.remove(this._loadingIndicator);
        this._loadingIndicator.geometry.dispose();
        this._loadingIndicator.material.dispose();
        this._loadingIndicator = null;
      }
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

      // Show loading indicator if model is not cached (lazy loading)
      const isCached = OBJ_CACHE.has(newSrc);
      if (!isCached) {
        this._showLoadingIndicator();
      }

      loadObj(newSrc)
        .then((original) => {
          // If src changed while loading, ignore.
          if (this._currentSrc !== newSrc) return;

          this._hideLoadingIndicator();
          const cloned = cloneWithUniqueMaterials(original);
          this.el.setObject3D("mesh", cloned);
          this.el.emit("model-loaded", { format: "obj", model: cloned });
        })
        .catch((error) => {
          if (this._currentSrc !== newSrc) return;
          this._hideLoadingIndicator();
          this.el.emit("model-error", { format: "obj", src: newSrc, error });
        });
    },

    remove() {
      // Clean up loading indicator
      this._hideLoadingIndicator();
      // Clean up object3D reference on component removal.
      try {
        this.el.removeObject3D("mesh");
      } catch (_) {
        // no-op
      }
    },
  });
})();
