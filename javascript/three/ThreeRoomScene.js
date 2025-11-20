import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

/**
 * ThreeRoomScene - Manages the Three.js 3D room with mouse-only controls
 * Compatible with existing furniture placement and cost estimation systems
 */
export class ThreeRoomScene {
  constructor(containerElement) {
    this.container = containerElement;
    this.furnitureObjects = new Map(); // Track furniture items
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedObject = null;
    this.isDragging = false;

    this.init();
  }

  init() {
    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#9a9a9a");
    this.scene.fog = new THREE.Fog("#9a9a9a", 30, 50);

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      1000
    );
    // Camera position will be set after createRoom()

    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // --- Controls (Mouse only - no WASD) ---
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.minDistance = 5;
    this.controls.maxDistance = 25;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // --- Texture Loader ---
    this.textureLoader = new THREE.TextureLoader();

    // Create room
    this.createRoom();

    // Now set camera position based on actual room dimensions
    this.camera.position.set(0, this.roomHeight * 0.5, this.roomDepth * 0.4);
    this.camera.lookAt(0, 0, 0);
    console.log("Camera positioned at:", this.camera.position);

    this.createLights();
    this.createGrid();

    // Setup interaction
    this.setupInteraction();

    // Start animation
    this.animate();

    // Handle resize
    window.addEventListener("resize", () => this.onWindowResize());
  }

  createRoom() {
    // Get room dimensions from localStorage
    const width = parseFloat(localStorage.getItem("roomWidth")) || 10;
    const depth = parseFloat(localStorage.getItem("roomLength")) || 10;
    const height = parseFloat(localStorage.getItem("roomHeight")) || 3;
    const wallThickness = 0.3;
    const floorThickness = 0.2;

    // Persist thickness for later placement calculations
    this.floorThickness = floorThickness;

    this.roomWidth = width;
    this.roomDepth = depth;
    this.roomHeight = height;

    // --- Floor Material ---
    const floorTexture = this.textureLoader.load(
      "textures/WoodFloor048_8K-PNG_Color.png"
    );
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(width / 2.5, depth / 2.5);
    floorTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.5,
      metalness: 0.2,
    });

    // --- Wall Material ---
    const wallTexture = this.textureLoader.load("textures/foam.png");
    wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(2, 2);

    const wallNormal = this.textureLoader.load("textures/foam_normal.png");
    wallNormal.wrapS = wallNormal.wrapT = THREE.RepeatWrapping;
    wallNormal.repeat.set(2, 2);

    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture,
      normalMap: wallNormal,
      roughness: 0.6,
      metalness: 0.01,
      color: 0xfafafa,
    });

    // --- Environment Map ---
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    const envMap = cubeTextureLoader.load([
      "textures/px.jpg",
      "textures/nx.jpg",
      "textures/py.jpg",
      "textures/ny.jpg",
      "textures/pz.jpg",
      "textures/nz.jpg",
    ]);
    this.scene.environment = envMap;
    wallMaterial.envMap = envMap;
    wallMaterial.envMapIntensity = 0.3;

    // --- Floor ---
    const floorGeo = new THREE.BoxGeometry(width, floorThickness, depth);
    this.floor = new THREE.Mesh(floorGeo, floorMaterial);
    this.floor.position.y = -height / 2 + floorThickness / 2 + 0.001;
    this.floor.receiveShadow = true;
    this.floor.name = "floor";
    this.scene.add(this.floor);

    // --- Create invisible plane for raycasting ---
    const planeGeo = new THREE.PlaneGeometry(width * 3, depth * 3);
    const planeMat = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide,
    });
    this.raycastPlane = new THREE.Mesh(planeGeo, planeMat);
    this.raycastPlane.rotation.x = -Math.PI / 2;
    // Position plane at the TOP of the floor box (floor.y + half floor thickness)
    this.raycastPlane.position.y = this.floor.position.y + floorThickness / 2;
    this.raycastPlane.name = "raycastPlane";
    this.scene.add(this.raycastPlane);
    console.log(
      "✓ Raycast plane at Y:",
      this.raycastPlane.position.y,
      "Floor center at Y:",
      this.floor.position.y
    );

    // --- Ceiling ---
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(width, wallThickness, depth),
      wallMaterial
    );
    ceiling.position.y = height / 2;
    ceiling.receiveShadow = true;
    ceiling.name = "ceiling";
    this.scene.add(ceiling);

    // --- Walls ---
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      wallMaterial
    );
    backWall.position.z = -depth / 2;
    backWall.receiveShadow = true;
    backWall.name = "backWall";
    this.scene.add(backWall);

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, wallThickness),
      wallMaterial
    );
    frontWall.position.z = depth / 2;
    frontWall.receiveShadow = true;
    frontWall.name = "frontWall";
    this.scene.add(frontWall);

    // Remove front wall opacity/transparency (fully opaque)
    // frontWall.material = frontWall.material.clone();
    // frontWall.material.transparent = true;
    // frontWall.material.opacity = 0.2;
    // frontWall.material.depthWrite = true;

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    leftWall.position.x = -width / 2;
    leftWall.receiveShadow = true;
    leftWall.name = "leftWall";
    this.scene.add(leftWall);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, height, depth),
      wallMaterial
    );
    rightWall.position.x = width / 2;
    rightWall.receiveShadow = true;
    rightWall.name = "rightWall";
    this.scene.add(rightWall);

    // Store walls for visibility toggling
    this.walls = {
      ceiling,
      backWall,
      frontWall,
      leftWall,
      rightWall,
    };

    // Add wireframe outlines
    this.addWireframeOutline(backWall);
    this.addWireframeOutline(frontWall);
    this.addWireframeOutline(leftWall);
    this.addWireframeOutline(rightWall);
    this.addWireframeOutline(ceiling);
  }

  addWireframeOutline(mesh) {
    const geo = new THREE.WireframeGeometry(mesh.geometry);
    const positions = geo.attributes.position.array;

    const lineGeo = new LineGeometry();
    lineGeo.setPositions(positions);

    const lineMat = new LineMaterial({
      color: 0x222222,
      linewidth: 0.01,
      depthWrite: false,
    });

    const line = new LineSegments2(lineGeo, lineMat);
    line.computeLineDistances();

    const offset = 0.01;
    const normal = new THREE.Vector3(0, 0, 1);
    normal.applyQuaternion(mesh.quaternion);
    line.position.copy(mesh.position).addScaledVector(normal, offset);
    line.rotation.copy(mesh.rotation);

    line.renderOrder = 999;
    line.name = mesh.name + "_outline";
    this.scene.add(line);

    if (!mesh.userData.outline) {
      mesh.userData.outline = line;
    }
  }

  createLights() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 30;
    this.scene.add(directionalLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(-5, 8, 5);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(0, 5, -5);
    this.scene.add(fillLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xaaaaaa, 0.5);
    this.scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
  }

  createGrid() {
    const gridSize = 150;
    const gridDivisions = 30;
    const gridHelper = new THREE.GridHelper(
      gridSize,
      gridDivisions,
      0x888888,
      0x444444
    );
    gridHelper.position.y = -this.roomHeight / 2 - 0.01;
    this.scene.add(gridHelper);

    const boxSize = 0.1;
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x666666 });

    for (
      let i = -gridSize / 2;
      i <= gridSize / 2;
      i += gridSize / gridDivisions
    ) {
      for (
        let j = -gridSize / 2;
        j <= gridSize / 2;
        j += gridSize / gridDivisions
      ) {
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(i, -this.roomHeight / 2, j);
        this.scene.add(box);
      }
    }
  }

  setupInteraction() {
    this.renderer.domElement.addEventListener("mousedown", (e) =>
      this.onMouseDown(e)
    );
    this.renderer.domElement.addEventListener("mousemove", (e) =>
      this.onMouseMove(e)
    );
    this.renderer.domElement.addEventListener("mouseup", (e) =>
      this.onMouseUp(e)
    );

    // Add keyboard rotation support
    window.addEventListener("keydown", (e) => {
      if (this.selectedObject && (e.key === "r" || e.key === "R")) {
        this.selectedObject.rotation.y += Math.PI / 4; // 45 degrees
        console.log(`Rotated ${this.selectedObject.userData.name} by 45°`);
      }
    });
  }

  onMouseDown(event) {
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const furnitureArray = Array.from(this.furnitureObjects.values());
    const intersects = this.raycaster.intersectObjects(furnitureArray, true);

    if (intersects.length > 0) {
      // Find the top-level furniture object
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.isFurniture) {
        obj = obj.parent;
      }

      if (obj.userData.isFurniture) {
        this.selectedObject = obj;
        this.isDragging = true;
        this.controls.enabled = false;

        // Emit event for cost system
        const event = new CustomEvent("furnitureSelected", {
          detail: { id: obj.userData.id, name: obj.userData.name },
        });
        window.dispatchEvent(event);
      }
    }
  }

  onMouseMove(event) {
    if (!this.isDragging || !this.selectedObject) return;

    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObject(this.floor);
    if (intersects.length > 0) {
      const point = intersects[0].point;

      // Constrain to room boundaries
      const halfWidth = this.roomWidth / 2 - 0.5;
      const halfDepth = this.roomDepth / 2 - 0.5;

      point.x = Math.max(-halfWidth, Math.min(halfWidth, point.x));
      point.z = Math.max(-halfDepth, Math.min(halfDepth, point.z));
      point.y = this.selectedObject.position.y;

      this.selectedObject.position.copy(point);

      // Emit position update
      const event = new CustomEvent("furniturePositionChanged", {
        detail: {
          id: this.selectedObject.userData.id,
          position: { x: point.x, y: point.y, z: point.z },
        },
      });
      window.dispatchEvent(event);
    }
  }

  onMouseUp(event) {
    if (this.isDragging && this.selectedObject) {
      this.isDragging = false;
      this.controls.enabled = true;

      // Emit placement complete
      const event = new CustomEvent("furniturePlaced", {
        detail: {
          id: this.selectedObject.userData.id,
          position: this.selectedObject.position.toArray(),
        },
      });
      window.dispatchEvent(event);

      this.selectedObject = null;
    }
  }

  updateMouse(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Add furniture to the scene
   * @param {string} id - Unique identifier
   * @param {string} modelType - Type of furniture (table1, chair, etc.)
   * @param {object} position - {x, y, z}
   */
  addFurniture(id, modelType, position = { x: 0, y: 0, z: 0 }) {
    // Simple placeholder table box (1.5m x 0.8m x 1.5m)
    const geometry = new THREE.BoxGeometry(1.5, 0.8, 1.5);
    const material = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.7,
      metalness: 0.2,
    });

    const furniture = new THREE.Mesh(geometry, material);
    furniture.castShadow = true;
    furniture.receiveShadow = true;

    // Place on floor: floor top Y + half furniture height
    const floorTopY = this.floor.position.y + (this.floorThickness || 0.2) / 2;
    const furnitureHalfHeight = geometry.parameters.height / 2;
    furniture.position.set(
      position.x,
      floorTopY + furnitureHalfHeight,
      position.z
    );
    furniture.userData.isFurniture = true;
    furniture.userData.id = id;
    furniture.userData.name = modelType;
    furniture.userData.modelType = modelType;

    this.scene.add(furniture);
    this.furnitureObjects.set(id, furniture);

    console.log(`✓ Added ${modelType} ID: ${id}`);
    console.log(
      `  Input position: (${position.x}, ${position.y}, ${position.z})`
    );
    console.log(`  Floor top Y: ${floorTopY.toFixed(2)}`);
    console.log(`  Furniture half height: ${furnitureHalfHeight.toFixed(2)}`);
    console.log(
      `  Final position: (${furniture.position.x.toFixed(
        2
      )}, ${furniture.position.y.toFixed(2)}, ${furniture.position.z.toFixed(
        2
      )})`
    );
    console.log(`  Scene children count: ${this.scene.children.length}`);
    console.log(`  Furniture map size: ${this.furnitureObjects.size}`);

    return furniture;
  }

  _loadAndSwapModel(modelType, placeholderMesh, path) {
    if (!this._objLoader) return;
    if (this._modelCache && this._modelCache.has(path)) {
      const clone = this._modelCache.get(path).clone();
      this._applyModel(clone, placeholderMesh);
      return;
    }
    this._objLoader.load(
      path,
      (loaded) => {
        // Normalize geometry
        loaded.traverse((o) => {
          if (o.isMesh) {
            o.material = new THREE.MeshStandardMaterial({ color: 0xffffff });
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        this._modelCache.set(path, loaded);
        const clone = loaded.clone();
        this._applyModel(clone, placeholderMesh);
        console.log(`✓ Replaced placeholder with model '${modelType}'`);
      },
      undefined,
      (err) => console.warn("Model load failed", path, err)
    );
  }

  _applyModel(modelRoot, placeholderMesh) {
    const pos = placeholderMesh.position.clone();
    const parent = placeholderMesh.parent;
    if (!parent) return;
    parent.remove(placeholderMesh);
    // Center model using bounding box
    const box = new THREE.Box3().setFromObject(modelRoot);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    modelRoot.traverse((o) => {
      if (o.isMesh) {
        o.geometry.computeVertexNormals();
      }
    });
    modelRoot.position.copy(pos.sub(center.multiplyScalar(1)));
    parent.add(modelRoot);
  }

  /**
   * Remove furniture from scene
   */
  removeFurniture(id) {
    const furniture = this.furnitureObjects.get(id);
    if (furniture) {
      this.scene.remove(furniture);
      this.furnitureObjects.delete(id);
    }
  }

  /**
   * Update wall visibility based on camera position
   */
  updateWallVisibility() {
    const cam = this.camera.position;

    // Original behavior: show walls when camera is within bounds;
    // hide a wall only when camera is outside that wall's boundary.

    // Ceiling
    this.walls.ceiling.visible = cam.y < this.roomHeight / 2;
    if (this.walls.ceiling.userData.outline) {
      this.walls.ceiling.userData.outline.visible = this.walls.ceiling.visible;
    }

    // Back wall (negative Z)
    this.walls.backWall.visible = cam.z > -this.roomDepth / 2;
    if (this.walls.backWall.userData.outline) {
      this.walls.backWall.userData.outline.visible =
        this.walls.backWall.visible;
    }

    // Front wall (positive Z)
    this.walls.frontWall.visible = cam.z < this.roomDepth / 2;
    if (this.walls.frontWall.userData.outline) {
      this.walls.frontWall.userData.outline.visible =
        this.walls.frontWall.visible;
    }

    // Left wall (negative X)
    this.walls.leftWall.visible = cam.x > -this.roomWidth / 2;
    if (this.walls.leftWall.userData.outline) {
      this.walls.leftWall.userData.outline.visible =
        this.walls.leftWall.visible;
    }

    // Right wall (positive X)
    this.walls.rightWall.visible = cam.x < this.roomWidth / 2;
    if (this.walls.rightWall.userData.outline) {
      this.walls.rightWall.userData.outline.visible =
        this.walls.rightWall.visible;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.updateWallVisibility();
    this.renderer.render(this.scene, this.camera);
  }

  onWindowResize() {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  }

  dispose() {
    this.controls.dispose();
    this.renderer.dispose();
    window.removeEventListener("resize", () => this.onWindowResize());
  }

  verifyFurniture() {
    const furn = [];
    this.furnitureObjects.forEach((obj) => {
      const p = obj.position;
      furn.push({
        id: obj.userData.id,
        name: obj.userData.name,
        x: p.x,
        y: p.y,
        z: p.z,
        visible: obj.visible,
      });
    });
    console.table(furn);
    console.log("Total furniture objects:", furn.length);
    // Highlight any with negative Y
    furn
      .filter((f) => f.y < 0)
      .forEach((f) => console.warn("Furniture below 0:", f));
  }
}
