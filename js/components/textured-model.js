// textured-model.js
// Applies a simple shared texture/material to OBJ-loaded meshes (OBJ models often load as plain white).

(() => {
  if (!window.AFRAME) return;

  const TEXTURE_CACHE = new Map(); // url -> Promise<THREE.Texture>

  function loadTexture(url) {
    if (!url) return Promise.resolve(null);
    const normalized = String(url).trim();
    if (TEXTURE_CACHE.has(normalized)) return TEXTURE_CACHE.get(normalized);

    const promise = new Promise((resolve) => {
      if (!window.THREE || typeof THREE.TextureLoader !== "function") {
        resolve(null);
        return;
      }

      const loader = new THREE.TextureLoader();
      loader.load(
        normalized,
        (tex) => resolve(tex),
        undefined,
        () => resolve(null),
      );
    });

    TEXTURE_CACHE.set(normalized, promise);
    return promise;
  }

  function toRepeat(dataRepeat) {
    if (!dataRepeat) return { x: 1, y: 1 };
    if (typeof dataRepeat === "object")
      return { x: dataRepeat.x ?? 1, y: dataRepeat.y ?? 1 };
    const parts = String(dataRepeat).split(/\s+/).map(parseFloat);
    return { x: parts[0] || 1, y: parts[1] || 1 };
  }

  // Expose texture preload helper for asset-preloader.js
  window.preloadTexture = function preloadTexture(url) {
    return loadTexture(url).then((tex) => tex !== null);
  };

  // Expose cache status for debugging
  window.getTextureCacheStatus = function getTextureCacheStatus() {
    return {
      size: TEXTURE_CACHE.size,
      keys: Array.from(TEXTURE_CACHE.keys()),
    };
  };

  AFRAME.registerComponent("textured-model", {
    schema: {
      // If src is empty, we still apply a non-white standard material.
      src: { type: "string", default: "" },
      repeat: { type: "vec2", default: { x: 2, y: 2 } },
      color: { type: "color", default: "#ffffff" },
      roughness: { type: "number", default: 0.85 },
      metalness: { type: "number", default: 0.05 },
      mode: { type: "string", default: "wood" }, // 'wood' | 'mirror'
    },

    init() {
      this._applied = false;
      this._onLoaded = this.apply.bind(this);
      this.el.addEventListener("model-loaded", this._onLoaded);

      // Try once in case model already exists.
      setTimeout(() => this.apply(), 50);
    },

    async apply() {
      if (!this.el || !this.el.object3D) return;

      const meshRoot = this.el.getObject3D("mesh") || this.el.object3D;
      if (!meshRoot) return;

      // Avoid re-applying every tick; allow re-apply if component data changes by resetting _applied.
      if (this._applied) return;
      this._applied = true;

      const mode = (this.data.mode || "wood").toLowerCase();
      const useMirror = mode === "mirror";

      let texture = null;
      if (!useMirror && this.data.src) {
        texture = await loadTexture(this.data.src);
        if (texture) {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          const rep = toRepeat(this.data.repeat);
          texture.repeat.set(rep.x, rep.y);
          texture.anisotropy = 4;
          texture.needsUpdate = true;
        }
      }

      const baseMaterial = useMirror
        ? new THREE.MeshStandardMaterial({
            color: new THREE.Color("#d9d9d9"),
            roughness: 0.08,
            metalness: 0.85,
          })
        : new THREE.MeshStandardMaterial({
            map: texture || null,
            color: new THREE.Color(this.data.color || "#ffffff"),
            roughness: this.data.roughness,
            metalness: this.data.metalness,
          });

      meshRoot.traverse((node) => {
        if (!node.isMesh) return;
        node.material = baseMaterial.clone();
        node.castShadow = true;
        node.receiveShadow = true;
      });
    },

    update() {
      // Allow reapply when props change.
      this._applied = false;
      this.apply();
    },

    remove() {
      this.el.removeEventListener("model-loaded", this._onLoaded);
    },
  });
})();
