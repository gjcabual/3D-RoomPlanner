// textured-model.js
// Applies a simple shared texture/material to OBJ-loaded meshes (OBJ models often load as plain white).

(() => {
  if (!window.AFRAME) return;

  const TEXTURE_CACHE = new Map(); // url -> Promise<THREE.Texture>
  const MATERIAL_CACHE = new Map(); // materialKey -> THREE.Material (shared materials to reduce shader compilation)

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

  /**
   * Get or create a shared base material to reduce shader compilation overhead
   * @param {string} mode - 'wood' or 'mirror'
   * @param {THREE.Texture|null} texture - Optional texture
   * @param {Object} options - Material options
   * @returns {THREE.MeshStandardMaterial}
   */
  function getSharedMaterial(mode, texture, options = {}) {
    const key = `${mode}_${texture ? "tex" : "notex"}_${options.roughness}_${options.metalness}`;

    if (MATERIAL_CACHE.has(key)) {
      // Return a clone of the cached material (shares compiled shader)
      return MATERIAL_CACHE.get(key).clone();
    }

    let material;
    if (mode === "mirror") {
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color("#d9d9d9"),
        roughness: 0.08,
        metalness: 0.85,
      });
    } else {
      material = new THREE.MeshStandardMaterial({
        map: texture || null,
        color: new THREE.Color(options.color || "#ffffff"),
        roughness: options.roughness ?? 0.85,
        metalness: options.metalness ?? 0.05,
      });
    }

    MATERIAL_CACHE.set(key, material);
    return material.clone();
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

  /**
   * Apply per-vertex colors to a bed mesh based on each vertex's
   * normalised Y-position inside the mesh bounding box.
   *   top  ~30% → pillow colour (light cream / white)
   *   mid  ~40% → mattress colour (configured body colour)
   *   low  ~30% → frame / base (darker wood-like tone)
   *
   * Because the bed OBJ is a single mesh with no groups we
   * colour vertices directly via a `color` buffer attribute and
   * set `vertexColors = true` on the material.
   */
  function applyBedVertexColors(mesh, mattressColor, pillowColor, frameColor) {
    const geom = mesh.geometry;
    if (!geom || !geom.attributes.position) return;

    // Compute bounding box so we can normalise Y
    geom.computeBoundingBox();
    const bb = geom.boundingBox;
    const minY = bb.min.y;
    const rangeY = bb.max.y - minY || 1;

    const pos = geom.attributes.position;
    const count = pos.count;
    const colors = new Float32Array(count * 3);

    const cPillow = new THREE.Color(pillowColor);
    const cMattress = new THREE.Color(mattressColor);
    const cFrame = new THREE.Color(frameColor);

    for (let i = 0; i < count; i++) {
      const y = pos.getY(i);
      const t = (y - minY) / rangeY; // 0 = bottom, 1 = top

      let c;
      if (t > 0.72) {
        // Upper region → pillow
        c = cPillow;
      } else if (t > 0.3) {
        // Middle region → mattress body
        c = cMattress;
      } else {
        // Lower region → bed frame
        c = cFrame;
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  AFRAME.registerComponent("textured-model", {
    schema: {
      // If src is empty, we still apply a non-white standard material.
      src: { type: "string", default: "" },
      repeat: { type: "vec2", default: { x: 2, y: 2 } },
      color: { type: "color", default: "#ffffff" },
      roughness: { type: "number", default: 0.85 },
      metalness: { type: "number", default: 0.05 },
      mode: { type: "string", default: "wood" }, // 'wood' | 'mirror' | 'bed'
      // Bed-specific: pillow & frame accent colours
      pillowColor: { type: "color", default: "#F5F0E8" },
      frameColor: { type: "color", default: "#6B4226" },
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

      // Count actual meshes before committing
      let meshCount = 0;
      meshRoot.traverse((n) => {
        if (n.isMesh) meshCount++;
      });

      // No meshes yet — model hasn't loaded; leave _applied false so
      // the model-loaded listener can retry.
      if (meshCount === 0) return;

      // Avoid re-applying every tick; allow re-apply if component data changes by resetting _applied.
      if (this._applied) return;
      this._applied = true;

      const mode = (this.data.mode || "wood").toLowerCase();
      const useMirror = mode === "mirror";
      const useBed = mode === "bed";

      let texture = null;
      if (!useMirror && !useBed && this.data.src) {
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

      // ── Bed mode: per-vertex colouring ───────────────────────
      if (useBed) {
        const mattressColor = this.data.color;
        const pillowColor = this.data.pillowColor;
        const frameColor = this.data.frameColor;

        meshRoot.traverse((node) => {
          if (!node.isMesh) return;

          applyBedVertexColors(node, mattressColor, pillowColor, frameColor);

          node.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: this.data.roughness,
            metalness: this.data.metalness,
          });
          node.castShadow = true;
          node.receiveShadow = true;
        });
        return;
      }

      const baseMaterial = getSharedMaterial(mode, texture, {
        color: this.data.color,
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
