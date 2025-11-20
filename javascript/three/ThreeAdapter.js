import * as THREE from "three";

/**
 * ThreeAdapter - Bridges Three.js scene with existing cost calculator and UI systems
 */
export class ThreeAdapter {
  constructor(threeScene) {
    this.threeScene = threeScene;
    this.furnitureCounter = 0;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for furniture events from Three.js scene
    window.addEventListener("furnitureSelected", (e) => {
      this.onFurnitureSelected(e.detail);
    });

    window.addEventListener("furniturePlaced", (e) => {
      this.onFurniturePlaced(e.detail);
    });

    window.addEventListener("furniturePositionChanged", (e) => {
      this.onFurniturePositionChanged(e.detail);
    });
  }

  /**
   * Place furniture at center of room (auto-placement)
   */
  placeFurnitureAtCenter(modelType) {
    console.log("=== ThreeAdapter.placeFurnitureAtCenter ===");
    console.log("Model type:", modelType);

    if (!this.threeScene.floor) {
      console.error("Floor object not found!");
      return null;
    }

    // Use a fixed visible Y (0.5) relative to debug cube for reliability
    const position = new THREE.Vector3(0, 0.5, 0);
    console.log(
      `✓ Center position (fixed debug Y): (${position.x.toFixed(
        2
      )}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
    );

    const id = `furniture_${Date.now()}_${this.furnitureCounter++}`;

    // Add to Three.js scene
    this.threeScene.addFurniture(id, modelType, {
      x: position.x,
      y: position.y,
      z: position.z,
    });

    // Update cost calculator (if exists)
    if (window.updateFurnitureCost) {
      window.updateFurnitureCost();
    }

    // Trigger cost update event
    const event = new CustomEvent("furnitureAdded", {
      detail: { id, modelType, position },
    });
    window.dispatchEvent(event);

    console.log(`✓ Added ${modelType} at center with ID: ${id}`);
    return id;
  }

  /**
   * Handle drag-drop from side panel (legacy - kept for compatibility)
   */
  handleDrop(modelType, dropX, dropY) {
    console.log("=== ThreeAdapter.handleDrop ===");
    console.log("Model type:", modelType);
    console.log("Drop coordinates:", dropX, dropY);

    if (!this.threeScene.floor) {
      console.error("Floor object not found!");
      return null;
    }

    const rect = this.threeScene.renderer.domElement.getBoundingClientRect();
    console.log("Canvas rect:", rect);

    // Convert screen coordinates to normalized device coordinates
    const mouse = new THREE.Vector2();
    mouse.x = ((dropX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((dropY - rect.top) / rect.height) * 2 + 1;

    console.log("Mouse NDC:", mouse);

    // ----- Robust multi-pass raycast attempts -----
    const attemptRaycast = (nx, ny, label) => {
      const rc = new THREE.Raycaster();
      const v2 = new THREE.Vector2(nx, ny);
      rc.setFromCamera(v2, this.threeScene.camera);
      console.log(`[Ray ${label}] NDC=`, v2, "dir=", rc.ray.direction);
      let hits = [];
      if (this.threeScene.raycastPlane) {
        hits = rc.intersectObject(this.threeScene.raycastPlane, false);
        console.log(`[Ray ${label}] plane hits:`, hits.length);
      }
      if (hits.length === 0) {
        hits = rc.intersectObject(this.threeScene.floor, true);
        console.log(`[Ray ${label}] floor hits:`, hits.length);
      }
      if (hits.length === 0) {
        hits = rc.intersectObjects(this.threeScene.scene.children, true);
        console.log(`[Ray ${label}] scene hits:`, hits.length);
      }
      return hits;
    };

    // Pass 1: bounding-rect calculation
    let intersects = attemptRaycast(mouse.x, mouse.y, "rect");

    // Pass 2: window-based calculation
    if (intersects.length === 0) {
      const nx = (dropX / window.innerWidth) * 2 - 1;
      const ny = -(dropY / window.innerHeight) * 2 + 1;
      intersects = attemptRaycast(nx, ny, "window");
    }

    // Pass 3: clamped original coords
    if (intersects.length === 0) {
      const nx = THREE.MathUtils.clamp(mouse.x, -1, 1);
      const ny = THREE.MathUtils.clamp(mouse.y, -1, 1);
      intersects = attemptRaycast(nx, ny, "clamped");
    }

    // Pass 4: straight-down ray from camera
    if (intersects.length === 0) {
      console.log("[Ray fallback] straight down");
      const downCaster = new THREE.Raycaster(
        this.threeScene.camera.position.clone(),
        new THREE.Vector3(0, -1, 0)
      );
      intersects = downCaster.intersectObject(
        this.threeScene.raycastPlane || this.threeScene.floor,
        true
      );
      console.log("[Ray fallback] down hits:", intersects.length);
    }

    if (intersects.length > 0) {
      const rawPoint = intersects[0].point.clone();
      console.log("✓ Raw drop position:", rawPoint);

      // Compute floor top Y
      const floorTopY =
        this.threeScene.floor.position.y +
        (this.threeScene.floorThickness || 0.2) / 2;
      // Furniture half-height (matches geometry 0.8)
      const furnitureHalfY = 0.8 / 2;
      const finalY = floorTopY + furnitureHalfY;
      const position = new THREE.Vector3(rawPoint.x, finalY, rawPoint.z);
      console.log(
        `✓ Adjusted position: (${position.x.toFixed(2)}, ${position.y.toFixed(
          2
        )}, ${position.z.toFixed(2)}) floorTopY=${floorTopY.toFixed(2)}`
      );

      const id = `furniture_${Date.now()}_${this.furnitureCounter++}`;

      // Add to Three.js scene
      this.threeScene.addFurniture(id, modelType, {
        x: position.x,
        y: position.y,
        z: position.z,
      });

      // Debug marker (auto-remove after 2s)
      try {
        const markerGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.copy(position);
        marker.position.y += 0.05;
        marker.name = `placement_marker_${id}`;
        this.threeScene.scene.add(marker);
        setTimeout(() => {
          this.threeScene.scene.remove(marker);
        }, 2000);
      } catch (e) {
        console.warn("Marker creation failed", e);
      }

      // Update cost calculator (if exists)
      if (window.updateFurnitureCost) {
        window.updateFurnitureCost();
      }

      // Trigger cost update event
      const event = new CustomEvent("furnitureAdded", {
        detail: { id, modelType, position },
      });
      window.dispatchEvent(event);

      console.log(`✓ Added ${modelType} with ID: ${id}`);
      return id;
    }

    console.error("✗ No intersection with floor found");
    return null;
  }

  /**
   * Remove furniture and update costs
   */
  removeFurniture(id) {
    this.threeScene.removeFurniture(id);

    if (window.updateFurnitureCost) {
      window.updateFurnitureCost();
    }

    const event = new CustomEvent("furnitureRemoved", { detail: { id } });
    window.dispatchEvent(event);
  }

  /**
   * Get all furniture in scene for cost calculation
   */
  getAllFurniture() {
    const furniture = [];
    this.threeScene.furnitureObjects.forEach((obj, id) => {
      furniture.push({
        id,
        type: obj.userData.modelType,
        name: obj.userData.name,
        position: obj.position.toArray(),
      });
    });
    return furniture;
  }

  onFurnitureSelected(data) {
    console.log("Furniture selected:", data);
    // Show furniture controls panel if it exists
    const controlPanel = document.getElementById("furniture-control-panel");
    if (controlPanel) {
      controlPanel.style.display = "block";
      controlPanel.dataset.furnitureId = data.id;
    }
  }

  onFurniturePlaced(data) {
    console.log("Furniture placed:", data);
    if (window.updateFurnitureCost) {
      window.updateFurnitureCost();
    }
  }

  onFurniturePositionChanged(data) {
    // Optional: real-time position feedback
  }
}
