// Draggable furniture component for moving tables around
AFRAME.registerComponent("draggable-furniture", {
  schema: {
    roomWidth: { type: "number", default: 10 },
    roomLength: { type: "number", default: 10 },
    wallHeight: { type: "number", default: 3 },
    objectWidth: { type: "number", default: 1.5 },
    objectLength: { type: "number", default: 1.5 },
    wallThickness: { type: "number", default: 0.1 },
    // Minimum spacing (in meters) to keep between this item and other items.
    // If within this clearance, item turns red and cannot be dropped there.
    collisionClearance: { type: "number", default: 0.12 },
  },

  init: function () {
    this.isDragging = false;
    this.originalPosition = null;
    this.dragStartPosition = null;
    this.lastValidPosition = null;
    this.isPlacementValid = true;
    this._idleCollisionNextCheckAt = 0;
    this._activeTween = null;
    this._materialSnapshot = new Map();
    this._materialsPrepared = false;

    // Placement state machine:
    // - placed: finalized item (acts as obstacle)
    // - dragging: currently being manipulated (should be ignored as obstacle)
    // - draft: not yet finalized (kept for future extensibility)
    this.placementState = "placed";

    this.camera = null;
    this.cameraObj = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.defaultColor = "#ffffff"; // Keep base color neutral to preserve textures
    this.defaultEmissive = "#000000";
    this.defaultEmissiveIntensity = 0;

    this.modelKey = this.el.getAttribute("data-model-key") || null;
    this.isWallMounted =
      typeof this.modelKey === "string" && this.modelKey.startsWith("mirror");
    this.currentWall = null; // 'north' | 'south' | 'west' | 'east'

    // Actual dimensions from 3D model (will be calculated when model loads)
    this.actualWidth = this.data.objectWidth; // Fallback to schema default
    this.actualLength = this.data.objectLength; // Fallback to schema default
    this.actualHeight = 1; // Fallback
    this.dimensionsCalculated = false;
    this.lastRotationY = undefined; // Track rotation for dimension recalculation

    // Bind methods
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.calculateDimensions = this.calculateDimensions.bind(this);

    // Bind internal helpers
    this._prepareMeshMaterials = this._prepareMeshMaterials.bind(this);

    // Add event listeners
    this.el.addEventListener("mousedown", this.onMouseDown);
    document.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mouseup", this.onMouseUp);

    // Listen for model to load so we can calculate actual dimensions
    this.el.addEventListener("model-loaded", this.calculateDimensions);

    // Prepare per-mesh material clones/snapshots as early as possible.
    // This prevents selection/other components from mutating materials
    // before we capture the "reset" baseline.
    this.el.addEventListener("model-loaded", this._prepareMeshMaterials);

    // Try to calculate dimensions immediately if model is already loaded
    setTimeout(() => {
      if (!this.dimensionsCalculated) {
        this.calculateDimensions();
      }

      // In case the model was already available before the model-loaded event.
      this._prepareMeshMaterials();
    }, 100);

    // Get camera reference
    this.camera = document.querySelector("a-camera");
    if (this.camera) {
      this.cameraObj = this.camera.getObject3D("camera");
    }

    // Default last valid position is the initial position.
    this.lastValidPosition = this.el.object3D.position.clone();

    // Mark initial entities as placed obstacles.
    this._setPlacementState("placed");
  },

  _setPlacementState: function (state) {
    const next = state || "placed";
    this.placementState = next;

    if (this.el) {
      this.el.dataset.placementState = next;
      if (next === "placed") {
        this.el.classList.add("placed-item");
        this.el.dataset.placementLayer = "PlacedItems";
      } else {
        this.el.classList.remove("placed-item");
      }
    }
  },

  finalizePlacement: function () {
    // Restore original materials/textures after a successful drop.
    this._applyFeedbackToMeshes("reset");
    this.el.setAttribute("material", "emissive", this.defaultEmissive);
    this.el.setAttribute(
      "material",
      "emissiveIntensity",
      this.defaultEmissiveIntensity,
    );
    this._setPlacementState("placed");
  },

  _prepareMeshMaterials: function () {
    // A-Frame's material component doesn't reliably override loaded model materials.
    // We clone mesh materials per-instance and store a snapshot so we can tint them
    // for drag/error feedback and restore them on reset.
    if (this._materialsPrepared) return;
    if (!this.el || !this.el.object3D) return;

    let processed = 0;

    this.el.object3D.traverse((child) => {
      if (!child || !child.isMesh || !child.material) return;

      const cloneAndSnapshot = (mat) => {
        if (!mat) return mat;
        const cloned = mat.clone();
        // snapshot original values for restore
        if (!this._materialSnapshot.has(cloned.uuid)) {
          this._materialSnapshot.set(cloned.uuid, {
            color: cloned.color ? cloned.color.clone() : null,
            emissive: cloned.emissive ? cloned.emissive.clone() : null,
            emissiveIntensity:
              typeof cloned.emissiveIntensity === "number"
                ? cloned.emissiveIntensity
                : undefined,
            opacity:
              typeof cloned.opacity === "number" ? cloned.opacity : undefined,
            transparent:
              typeof cloned.transparent === "boolean"
                ? cloned.transparent
                : undefined,
          });
        }
        return cloned;
      };

      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => {
          const cloned = cloneAndSnapshot(m);
          if (cloned) processed += 1;
          return cloned;
        });
      } else {
        const cloned = cloneAndSnapshot(child.material);
        if (cloned) processed += 1;
        child.material = cloned;
      }
    });

    // Only mark prepared once we've actually seen meshes/materials.
    // This prevents an early call (before model-loaded) from permanently
    // disabling snapshots and causing stuck tints.
    if (processed > 0 || this._materialSnapshot.size > 0) {
      this._materialsPrepared = true;
    }
  },

  _applyFeedbackToMeshes: function (kind) {
    this._prepareMeshMaterials();
    if (!this.el || !this.el.object3D) return;

    const applyToMat = (mat) => {
      if (!mat) return;
      const snap = this._materialSnapshot.get(mat.uuid);

      if (kind === "reset") {
        if (snap) {
          if (mat.color && snap.color) mat.color.copy(snap.color);
          if (mat.emissive && snap.emissive) mat.emissive.copy(snap.emissive);
          if (
            typeof snap.emissiveIntensity === "number" &&
            typeof mat.emissiveIntensity === "number"
          ) {
            mat.emissiveIntensity = snap.emissiveIntensity;
          }
          if (
            typeof snap.opacity === "number" &&
            typeof mat.opacity === "number"
          ) {
            mat.opacity = snap.opacity;
          }
          if (
            typeof snap.transparent === "boolean" &&
            typeof mat.transparent === "boolean"
          ) {
            mat.transparent = snap.transparent;
          }
        }
        mat.needsUpdate = true;
        return;
      }

      //to fix
      if (kind === "drag") {
        // Valid placement: green tint + strong emissive.
        // if (mat.color) mat.color.set("#b6ffb6");
        // if (mat.emissive) mat.emissive.set("#00ff00");
        // if (typeof mat.emissiveIntensity === "number")
        mat.emissiveIntensity = 0.9;
        mat.needsUpdate = true;
        return;
      }

      //to fix
      if (kind === "error") {
        // Invalid placement: clearly red even on textured models.
        // if (mat.color) mat.color.set("#ff6b6b");
        // if (mat.emissive) mat.emissive.set("#ff0000");
        // if (typeof mat.emissiveIntensity === "number")
        mat.emissiveIntensity = 1.25;
        mat.needsUpdate = true;
      }
    };

    this.el.object3D.traverse((child) => {
      if (!child || !child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => applyToMat(m));
      } else {
        applyToMat(child.material);
      }
    });
  },

  getPlacedEntities: function () {
    // Treat other draggable furniture entities as "placed".
    const container = document.getElementById("furniture-container");
    if (!container) {
      return Array.from(
        document.querySelectorAll("[draggable-furniture]"),
      ).filter((el) => {
        const comp =
          el && el.components && el.components["draggable-furniture"];
        if (!comp) return true;
        return !comp.isDragging;
      });
    }
    return Array.from(
      container.querySelectorAll("[draggable-furniture]"),
    ).filter((el) => {
      const comp = el && el.components && el.components["draggable-furniture"];
      if (!comp) return true;
      return !comp.isDragging;
    });
  },

  getObstacleEntities: function () {
    // Walls and the right-side board should block floor placement.
    const obstacles = [];
    obstacles.push(...Array.from(document.querySelectorAll(".room-wall")));
    const boardEl = document.getElementById("cost-board");
    if (boardEl) obstacles.push(boardEl);
    return obstacles;
  },

  _getWorldBoxForObject3D: function (object3D) {
    if (!object3D) return null;
    object3D.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object3D);
    if (!box || box.isEmpty()) return null;
    return box;
  },

  _boxesOverlap: function (boxA, boxB, epsilon = 0.01) {
    if (!boxA || !boxB) return false;
    // Treat mere touching as non-overlap by shrinking each box slightly.
    const a = boxA.clone().expandByScalar(-epsilon);
    const b = boxB.clone().expandByScalar(-epsilon);
    if (a.isEmpty() || b.isEmpty()) return false;
    return a.intersectsBox(b);
  },

  _boxesWithinClearance: function (boxA, boxB, clearance = 0.1) {
    if (!boxA || !boxB) return false;
    const c = Math.max(0, clearance);
    if (c === 0) return false;
    // If expanding boxA by clearance intersects boxB, they are too close.
    const a = boxA.clone().expandByScalar(c);
    return a.intersectsBox(boxB);
  },

  computePlacementValidity: function () {
    // Mirrors are wall-mounted: skip wall volume overlap checks to avoid
    // false positives with the wall mesh itself; still prevent overlap with
    // other placed objects.
    const selfBox = this._getWorldBoxForObject3D(this.el.object3D);
    if (!selfBox) {
      return { valid: true, reason: "no-geometry" };
    }

    const clearance =
      typeof this.data.collisionClearance === "number"
        ? this.data.collisionClearance
        : 0.12;

    // Check overlap with other placed objects.
    const placed = this.getPlacedEntities();
    for (const otherEl of placed) {
      if (!otherEl || otherEl === this.el) continue;
      if (!otherEl.object3D) continue;
      const otherBox = this._getWorldBoxForObject3D(otherEl.object3D);
      if (!otherBox) continue;
      if (this._boxesOverlap(selfBox, otherBox, 0.01)) {
        return { valid: false, reason: "overlap-object" };
      }
      if (this._boxesWithinClearance(selfBox, otherBox, clearance)) {
        return { valid: false, reason: "too-close-object" };
      }
    }

    if (!this.isWallMounted) {
      // Wall/board validity should match our boundary clamping logic.
      // Using wall mesh Box3 can produce false positives (walls are large planes).
      const currentPos = this.el.object3D.position;
      const adjusted = this.checkBoundaries(currentPos);
      const boundaryEps = 0.001;
      if (
        Math.abs(currentPos.x - adjusted.x) > boundaryEps ||
        Math.abs(currentPos.z - adjusted.z) > boundaryEps
      ) {
        return { valid: false, reason: "out-of-bounds" };
      }
    }

    return { valid: true, reason: "ok" };
  },

  updatePlacementFeedback: function () {
    const status = this.computePlacementValidity();
    this.isPlacementValid = !!status.valid;

    // Temporary: disable red/green placement tint while dragging.
    // Keep lastValidPosition tracking so invalid drops can still revert.
    if (this.isDragging) {
      if (this.isPlacementValid) {
        this.lastValidPosition = this.el.object3D.position.clone();
      }
      // Ensure we don't get stuck tinted from any prior feedback.
      this.setFeedback("reset");
      return;
    }

    if (this.isPlacementValid) {
      // Last valid position is tracked only while actively dragging.
      if (this.isDragging) {
        this.lastValidPosition = this.el.object3D.position.clone();
        this.setFeedback("drag");
      } else {
        // Valid + not dragging: don't keep the green preview tint.
        this.setFeedback("reset");
      }
      return;
    }
    this.setFeedback("error");
  },

  _cancelActiveTween: function () {
    if (this._activeTween && typeof this._activeTween.cancel === "function") {
      this._activeTween.cancel();
    }
    this._activeTween = null;
    // If a tween was cancelled mid-way (e.g., user re-drags quickly),
    // ensure we don't leave any stale red tint behind.
    this.setFeedback("reset");
  },

  tweenToPosition: function (targetPosition, durationMs = 160) {
    if (!targetPosition) return;
    const start = this.el.object3D.position.clone();
    const target = targetPosition.clone();
    const startTime = performance.now();

    // Cancel any previous tween.
    this._cancelActiveTween();

    let cancelled = false;
    const tweenHandle = {
      cancel: () => {
        cancelled = true;
      },
    };
    this._activeTween = tweenHandle;

    const step = (now) => {
      if (cancelled) return;
      const t = Math.min(1, (now - startTime) / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      const x = start.x + (target.x - start.x) * eased;
      const y = start.y + (target.y - start.y) * eased;
      const z = start.z + (target.z - start.z) * eased;
      this.el.setAttribute("position", `${x} ${y} ${z}`);

      // Avoid running placement feedback during snap-back tweens.
      // It can apply an "error" tint mid-animation and, if the tween is
      // interrupted, leave the object permanently tinted.

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        // End state: reset emissive to neutral.
        this.setFeedback("reset");
        this._activeTween = null;
      }
    };

    requestAnimationFrame(step);
  },

  calculateDimensions: function () {
    // Get the 3D object from the entity
    const object3D = this.el.object3D;
    if (!object3D) return;

    // Update world matrix to ensure transformations are applied
    object3D.updateMatrixWorld(true);

    // Create a bounding box helper
    const box = new THREE.Box3();

    // Traverse all meshes in the object to calculate combined bounding box
    let hasGeometry = false;
    const self = this;
    object3D.traverse(function (child) {
      if (child.isMesh && child.geometry) {
        // Update bounding box for this mesh's local geometry
        if (child.geometry.boundingBox === null) {
          child.geometry.computeBoundingBox();
        }

        // Get local bounding box
        const localBox = child.geometry.boundingBox.clone();

        // Transform to world space using the mesh's world matrix
        const worldBox = new THREE.Box3();
        worldBox.setFromObject(child);

        if (!hasGeometry) {
          box.copy(worldBox);
          hasGeometry = true;
        } else {
          box.union(worldBox);
        }
      }
    });

    if (hasGeometry && box.min && box.max) {
      // Calculate dimensions from bounding box in world space
      // This accounts for rotation, scale, and position
      const size = new THREE.Vector3();
      box.getSize(size);

      // The bounding box in world space already accounts for all transformations
      // Width is along X-axis, Length is along Z-axis
      this.actualWidth = Math.abs(size.x);
      this.actualLength = Math.abs(size.z);
      this.actualHeight = Math.abs(size.y);
      this.dimensionsCalculated = true;

      console.log(`Calculated dimensions for ${this.el.id}:`, {
        width: this.actualWidth,
        length: this.actualLength,
        boundingBox: {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          size: { x: size.x, y: size.y, z: size.z },
        },
      });
    } else {
      // Fallback to schema defaults if calculation fails
      console.warn(
        `Could not calculate dimensions for ${this.el.id}, using defaults`,
      );
      this.actualWidth = this.data.objectWidth;
      this.actualLength = this.data.objectLength;
      this.actualHeight = 1;
    }
  },

  setFeedback: function (kind) {
    // Apply feedback at mesh-material level (works for loaded OBJ/GLTF models).
    // Keep entity-level material attributes too (helps primitives / some setups).
    if (kind === "drag") {
      this.el.setAttribute("material", "emissive", "#00ff00");
      this.el.setAttribute("material", "emissiveIntensity", "0.9");
      this._applyFeedbackToMeshes("drag");
      return;
    }
    if (kind === "error") {
      this.el.setAttribute("material", "emissive", "#ff0000");
      this.el.setAttribute("material", "emissiveIntensity", "1.25");
      this._applyFeedbackToMeshes("error");
      return;
    }
    // reset
    this.el.setAttribute("material", "emissive", this.defaultEmissive);
    this.el.setAttribute(
      "material",
      "emissiveIntensity",
      this.defaultEmissiveIntensity,
    );
    this._applyFeedbackToMeshes("reset");
  },

  getWallPlanes: function () {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;

    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;

    return [
      // Back wall (z = -innerZ), inward normal +Z
      {
        name: "north",
        point: new THREE.Vector3(0, 0, -innerZ),
        normal: new THREE.Vector3(0, 0, 1),
      },
      // Front wall (z = +innerZ), inward normal -Z
      {
        name: "south",
        point: new THREE.Vector3(0, 0, innerZ),
        normal: new THREE.Vector3(0, 0, -1),
      },
      // Left wall (x = -innerX), inward normal +X
      {
        name: "west",
        point: new THREE.Vector3(-innerX, 0, 0),
        normal: new THREE.Vector3(1, 0, 0),
      },
      // Right wall (x = +innerX), inward normal -X
      {
        name: "east",
        point: new THREE.Vector3(innerX, 0, 0),
        normal: new THREE.Vector3(-1, 0, 0),
      },
    ];
  },

  getWallRotationY: function (wallName) {
    // Assumes model "front" faces +Z.
    switch (wallName) {
      case "north":
        return 0;
      case "south":
        return 180;
      case "west":
        return -90;
      case "east":
        return 90;
      default:
        return 0;
    }
  },

  clampMirrorToWall: function (wallName, intersectionPoint) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;
    const wallHeight = this.data.wallHeight;

    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;

    const epsilon = 0.02; // 2cm into the room to avoid z-fighting

    const halfX = (this.actualWidth || this.data.objectWidth) / 2;
    const halfZ = (this.actualLength || this.data.objectLength) / 2;
    const halfY = (this.actualHeight || 1) / 2;

    // For wall-mounted mirrors we treat the "width along wall" as:
    // - north/south walls: X extent
    // - east/west walls: Z extent
    const halfAlongWall =
      wallName === "north" || wallName === "south" ? halfX : halfZ;

    const minY = 0 + halfY;
    const maxY = wallHeight - halfY;
    const clampedY = Math.max(minY, Math.min(maxY, intersectionPoint.y));

    if (wallName === "north" || wallName === "south") {
      const minX = -innerX + halfAlongWall;
      const maxX = innerX - halfAlongWall;
      const clampedX = Math.max(minX, Math.min(maxX, intersectionPoint.x));
      const z = wallName === "north" ? -innerZ + epsilon : innerZ - epsilon;
      return { x: clampedX, y: clampedY, z };
    }

    // east/west
    const minZ = -innerZ + halfAlongWall;
    const maxZ = innerZ - halfAlongWall;
    const clampedZ = Math.max(minZ, Math.min(maxZ, intersectionPoint.z));
    const x = wallName === "west" ? -innerX + epsilon : innerX - epsilon;
    return { x, y: clampedY, z: clampedZ };
  },

  onMouseDown: function (e) {
    if (e.detail.intersection) {
      // If we were auto-snapping back to last valid position, stop that now.
      // This prevents cancelled tweens from leaving stale feedback colors.
      this._cancelActiveTween();

      this.isDragging = true;
      this._setPlacementState("dragging");
      this.originalPosition = this.el.object3D.position.clone();
      // Initialize last valid position at drag start.
      if (!this.lastValidPosition) {
        this.lastValidPosition = this.originalPosition.clone();
      }
      this.dragStartPosition = e.detail.intersection.point;

      // Refresh model key detection (in case attribute was set after init)
      if (!this.modelKey) {
        this.modelKey = this.el.getAttribute("data-model-key") || null;
        this.isWallMounted =
          typeof this.modelKey === "string" &&
          this.modelKey.startsWith("mirror");
      }

      // Visual feedback for drag start
      this.updatePlacementFeedback();

      console.log("Started dragging table:", this.el.id);
    }
  },

  onMouseMove: function (e) {
    if (!this.isDragging) return;
    if (!this.cameraObj) {
      const camEl = document.querySelector("a-camera");
      if (camEl) this.cameraObj = camEl.getObject3D("camera");
      if (!this.cameraObj) return;
    }

    // Update mouse position
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.cameraObj);

    // Mirrors are wall-mounted: raycast against wall planes.
    if (this.isWallMounted) {
      const intersectionPoint = new THREE.Vector3();
      const candidates = [];
      const planes = this.getWallPlanes();

      planes.forEach((w) => {
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
          w.normal,
          w.point,
        );
        const hit = this.raycaster.ray.intersectPlane(plane, intersectionPoint);
        if (!hit) return;

        // Must be in front of the camera ray.
        const dist = this.raycaster.ray.origin.distanceTo(intersectionPoint);
        if (!isFinite(dist) || dist <= 0.001) return;

        candidates.push({
          wall: w.name,
          point: intersectionPoint.clone(),
          dist,
        });
      });

      if (candidates.length === 0) return;
      candidates.sort((a, b) => a.dist - b.dist);

      // Prefer sticking to the current wall while dragging, if available.
      let chosen = candidates[0];
      if (this.currentWall) {
        const sameWall = candidates.find((c) => c.wall === this.currentWall);
        if (sameWall) chosen = sameWall;
      }

      this.currentWall = chosen.wall;
      const adjusted = this.clampMirrorToWall(chosen.wall, chosen.point);

      this.el.setAttribute(
        "position",
        `${adjusted.x} ${adjusted.y} ${adjusted.z}`,
      );
      this.el.setAttribute(
        "rotation",
        `0 ${this.getWallRotationY(chosen.wall)} 0`,
      );

      // Real-time validity: mirrors can still overlap other placed objects.
      this.updatePlacementFeedback();
      return;
    }

    // Default: Raycast against an infinite ground plane (y = 0)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
      const newPosition = intersectionPoint;

      // Check boundaries and adjust if needed
      const adjustedPosition = this.checkBoundaries(newPosition);

      // Keep object on floor height y=0 while dragging
      const yFloor = 0;
      this.el.setAttribute(
        "position",
        `${adjustedPosition.x} ${yFloor} ${adjustedPosition.z}`,
      );

      // Real-time feedback (red/green) based on actual overlaps.
      this.updatePlacementFeedback();
    }
  },

  onMouseUp: function (e) {
    if (this.isDragging) {
      if (this.isWallMounted && this.currentWall) {
        // End drag attempt for wall-mounted items.
        this.isDragging = false;
        const finalPos = this.el.object3D.position;
        const adjusted = this.clampMirrorToWall(this.currentWall, finalPos);
        this.el.setAttribute(
          "position",
          `${adjusted.x} ${adjusted.y} ${adjusted.z}`,
        );
        this.el.setAttribute(
          "rotation",
          `0 ${this.getWallRotationY(this.currentWall)} 0`,
        );
        // If invalid on drop, revert to last valid.
        this.updatePlacementFeedback();
        if (!this.isPlacementValid && this.lastValidPosition) {
          this.tweenToPosition(this.lastValidPosition, 180);
          this._setPlacementState("placed");
        } else {
          this.lastValidPosition = this.el.object3D.position.clone();
          this.finalizePlacement();
        }
        return;
      }

      // End drag attempt for floor items.
      this.isDragging = false;

      // Final boundary check
      const finalPosition = this.el.object3D.position;
      const adjustedPosition = this.checkBoundaries(finalPosition);

      if (!this.positionsEqual(finalPosition, adjustedPosition)) {
        this.el.setAttribute(
          "position",
          `${adjustedPosition.x} ${adjustedPosition.y} ${adjustedPosition.z}`,
        );
        console.log("Table position adjusted to stay within bounds");
      }

      // Decide whether the drop is allowed. If invalid, revert to last valid.
      this.updatePlacementFeedback();
      if (!this.isPlacementValid && this.lastValidPosition) {
        this.tweenToPosition(this.lastValidPosition, 180);
        // Invalid drop: restore original materials (no stuck red/green).
        // User can drag again to retry.
        this._setPlacementState("placed");
      } else {
        // Only commit and update last valid position when drop is green.
        this.lastValidPosition = this.el.object3D.position.clone();
        this.finalizePlacement();
      }

      console.log("Stopped dragging table:", this.el.id);
    }
  },

  tick: function () {
    // Track rotation to recalculate dimensions when object rotates
    const currentRotation = this.el.getAttribute("rotation");
    if (currentRotation) {
      const rotY =
        typeof currentRotation === "object"
          ? currentRotation.y
          : typeof currentRotation === "string"
            ? parseFloat(currentRotation.split(" ")[1])
            : 0;

      // If rotation changed significantly, recalculate dimensions
      if (
        this.lastRotationY !== undefined &&
        Math.abs(this.lastRotationY - rotY) > 1
      ) {
        this.calculateDimensions();
      }
      this.lastRotationY = rotY;
    }

    // Wall-mounted items (mirrors) don't participate in floor collision feedback.
    if (this.isWallMounted) return;

    // Skip collision checking while dragging (handled in onMouseMove)
    if (this.isDragging) return;

    // Check if object is selected (selected objects should stay green)
    const clickableComponent = this.el.components["clickable-furniture"];
    const isSelected = clickableComponent && clickableComponent.isSelected;

    // Throttled invalid-state feedback when idle (e.g., after loads/rotations).
    const now = performance.now();
    if (now < this._idleCollisionNextCheckAt) return;
    this._idleCollisionNextCheckAt = now + 200;

    // Idle objects should not keep red/green preview tints.
    // Only the actively dragged item shows validity feedback.
    // If selected, keep the selection highlight (entity emissive) but DO reset
    // any mesh tint that may have been applied.
    if (isSelected) {
      this._applyFeedbackToMeshes("reset");
      this.el.setAttribute("material", "emissive", "#2E7D32");
      this.el.setAttribute("material", "emissiveIntensity", "0.35");
      return;
    }

    this.setFeedback("reset");
  },

  checkBoundaries: function (position) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    // Use actual calculated dimensions from 3D model, fallback to schema defaults
    const objWidth = this.actualWidth || this.data.objectWidth;
    const objLength = this.actualLength || this.data.objectLength;
    const wallThickness = this.data.wallThickness;

    // Calculate safe boundaries using INNER wall faces (account for wall thickness)
    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    let safeXMin = -innerX + objWidth / 2;
    let safeXMax = innerX - objWidth / 2;
    const safeZMin = -innerZ + objLength / 2;
    const safeZMax = innerZ - objLength / 2;

    // If cost board exists on right side, clamp to just inside its plane
    const boardEl = document.getElementById("cost-board");
    if (boardEl && boardEl.object3D) {
      const boardX = boardEl.object3D.position.x;
      const proximity = 0.02; // 2cm margin before board
      const boardLimit = boardX - objWidth / 2 - proximity;
      if (!isNaN(boardLimit)) {
        safeXMax = Math.min(safeXMax, boardLimit);
      }
    }

    let newX = Math.max(safeXMin, Math.min(safeXMax, position.x));
    let newZ = Math.max(safeZMin, Math.min(safeZMax, position.z));

    return {
      x: newX,
      y: position.y,
      z: newZ,
    };
  },

  isColliding: function (position) {
    if (this.isWallMounted) return false;
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    // Use actual calculated dimensions from 3D model, fallback to schema defaults
    const objWidth = this.actualWidth || this.data.objectWidth;
    const objLength = this.actualLength || this.data.objectLength;
    const wallThickness = this.data.wallThickness;
    const epsilon = 0.1; // Only turn red when very close to walls (almost touching)

    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    const safeXMin = -innerX + objWidth / 2;
    const safeXMax = innerX - objWidth / 2;
    const safeZMin = -innerZ + objLength / 2;
    const safeZMax = innerZ - objLength / 2;

    // Right-side board plane (if present) overrides right wall proximity
    let rightTouch = position.x >= safeXMax - epsilon;
    const boardEl = document.getElementById("cost-board");
    if (boardEl && boardEl.object3D) {
      const boardX = boardEl.object3D.position.x;
      const proximity = 0.05; // 5cm margin before board
      const boardTouchX = position.x + objWidth / 2 >= boardX - proximity;
      rightTouch = boardTouchX; // prefer board proximity for visual feedback
    }

    // Only consider colliding when actually very close to or crossing boundaries
    return (
      position.x <= safeXMin + epsilon ||
      rightTouch ||
      position.z <= safeZMin + epsilon ||
      position.z >= safeZMax - epsilon
    );
  },

  positionsEqual: function (pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) < 0.01 && Math.abs(pos1.z - pos2.z) < 0.01;
  },

  remove: function () {
    // Clean up event listeners
    this.el.removeEventListener("mousedown", this.onMouseDown);
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mouseup", this.onMouseUp);
  },
});
