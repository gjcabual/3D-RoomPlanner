// reflective-ground.js
// Real-time planar reflector — renders the scene from a mirrored camera
// into an offscreen render target, then projects that texture onto a
// ground plane using a custom shader.

(() => {
  if (!window.AFRAME) return;

  AFRAME.registerComponent("reflective-ground", {
    schema: {
      color: { type: "color", default: "#181828" },
      size: { type: "number", default: 200 },
      reflectivity: { type: "number", default: 0.35 },
      resolution: { type: "number", default: 512 },
    },

    init() {
      this._ready = false;
      this._frameCount = 0;

      // Reusable vectors (avoid per-frame allocations)
      this._camPos = new THREE.Vector3();
      this._camDir = new THREE.Vector3();
      this._lookTarget = new THREE.Vector3();
      this._reflectPos = new THREE.Vector3();

      const scene = this.el.sceneEl;
      if (scene.hasLoaded) {
        this._setup();
      } else {
        scene.addEventListener("loaded", () => this._setup(), { once: true });
      }
    },

    _setup() {
      const renderer = this.el.sceneEl.renderer;
      if (!renderer) return;

      const sz = this.data.size;
      const res = this.data.resolution;

      // Ground plane geometry (flat on XZ plane)
      const geometry = new THREE.PlaneGeometry(sz, sz);
      geometry.rotateX(-Math.PI / 2);

      // Render target for the reflection pass
      this._renderTarget = new THREE.WebGLRenderTarget(res, res, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      });

      // Virtual camera for rendering the mirrored view
      this._virtualCamera = new THREE.PerspectiveCamera();

      // Texture matrix for projecting reflection onto ground
      this._textureMatrix = new THREE.Matrix4();

      // The ground Y level
      this._groundY = -0.14;

      // Custom shader — blends base color with projected reflection
      this._material = new THREE.ShaderMaterial({
        uniforms: {
          tReflection: { value: this._renderTarget.texture },
          baseColor: { value: new THREE.Color(this.data.color) },
          reflectivity: { value: this.data.reflectivity },
          textureMatrix: { value: this._textureMatrix },
        },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix;
          varying vec4 vReflectUv;
          varying vec3 vWorldPos;
          void main() {
            vec4 wPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = wPos.xyz;
            vReflectUv = textureMatrix * wPos;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D tReflection;
          uniform vec3 baseColor;
          uniform float reflectivity;
          varying vec4 vReflectUv;
          varying vec3 vWorldPos;
          void main() {
            vec4 refl = texture2DProj(tReflection, vReflectUv);
            // Gentle falloff — keeps reflections visible far from room
            float dist = length(vWorldPos.xz) * 0.006;
            float fade = clamp(1.0 - dist, 0.0, 1.0);
            float r = reflectivity * fade;
            vec3 finalColor = mix(baseColor, refl.rgb, r);
            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        fog: false,
        depthWrite: true,
      });

      this._mesh = new THREE.Mesh(geometry, this._material);
      this._mesh.position.y = this._groundY;
      this._mesh.renderOrder = -1;
      this._mesh.name = "reflective-ground-mesh";
      this.el.object3D.add(this._mesh);

      this._ready = true;
    },

    tick() {
      if (!this._ready) return;

      // Render every 3rd frame for performance
      this._frameCount++;
      if (this._frameCount % 3 !== 0) return;

      const sceneEl = this.el.sceneEl;
      const renderer = sceneEl.renderer;
      const scene3D = sceneEl.object3D;
      const camera = sceneEl.camera;
      if (!renderer || !camera) return;

      const groundY = this._groundY;

      // ---- Get camera world position & direction ----
      camera.getWorldPosition(this._camPos);
      camera.getWorldDirection(this._camDir);

      // ---- Setup virtual camera ----
      const vc = this._virtualCamera;

      // Copy projection from the real camera
      vc.projectionMatrix.copy(camera.projectionMatrix);
      vc.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
      vc.fov = camera.fov;
      vc.aspect = camera.aspect;
      vc.near = camera.near;
      vc.far = camera.far;

      // Mirror camera position across Y = groundY
      this._reflectPos.set(
        this._camPos.x,
        2 * groundY - this._camPos.y,
        this._camPos.z,
      );
      vc.position.copy(this._reflectPos);

      // Mirror the look direction (flip Y component)
      this._lookTarget.set(
        this._reflectPos.x + this._camDir.x,
        this._reflectPos.y - this._camDir.y,
        this._reflectPos.z + this._camDir.z,
      );

      vc.up.set(0, 1, 0);
      vc.lookAt(this._lookTarget);
      vc.updateMatrixWorld(true);
      vc.updateProjectionMatrix();

      // ---- Build texture projection matrix ----
      // bias: clip space [-1,1] → UV [0,1]
      this._textureMatrix.set(
        0.5,
        0.0,
        0.0,
        0.5,
        0.0,
        0.5,
        0.0,
        0.5,
        0.0,
        0.0,
        0.5,
        0.5,
        0.0,
        0.0,
        0.0,
        1.0,
      );
      this._textureMatrix.multiply(vc.projectionMatrix);
      this._textureMatrix.multiply(vc.matrixWorldInverse);

      // ---- Render scene from mirrored viewpoint ----
      this._mesh.visible = false;

      const prevTarget = renderer.getRenderTarget();
      const prevXr = renderer.xr.enabled;
      renderer.xr.enabled = false;

      renderer.setRenderTarget(this._renderTarget);
      renderer.clear();
      renderer.render(scene3D, vc);

      renderer.setRenderTarget(prevTarget);
      renderer.xr.enabled = prevXr;

      this._mesh.visible = true;
    },

    remove() {
      if (this._mesh) {
        this.el.object3D.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._material.dispose();
        this._renderTarget.dispose();
      }
    },
  });
})();
