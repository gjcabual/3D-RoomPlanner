// Draggable furniture component for moving tables around
AFRAME.registerComponent("draggable-furniture", {
  schema: {
    roomWidth: { type: "number", default: 10 },
    roomLength: { type: "number", default: 10 },
    objectWidth: { type: "number", default: 1.5 },
    objectLength: { type: "number", default: 1.5 },
    wallThickness: { type: "number", default: 0.1 },
    clearance: { type: "number", default: 0.5 }, // desired visual gap from walls (meters)
  },

  init: function () {
    this.isDragging = false;
    this.originalPosition = null;
    this.dragStartPosition = null;
    this.camera = null;
    this.cameraObj = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Bind methods
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    // Add event listener for mousedown only. We'll attach mousemove/mouseup
    // dynamically when dragging starts to avoid many global handlers.
    this.el.addEventListener("mousedown", this.onMouseDown);

    // Reusable objects to avoid allocations every mouse event
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._intersectionPoint = new THREE.Vector3();
    this._rafPending = false;
    this._lastMouseEvent = null;

    // Track last applied material state to avoid redundant writes
    this._lastMaterialState = {
      color: null,
      emissive: null,
      emissiveIntensity: null,
    };

    // Helper to apply material changes directly to the underlying mesh when possible
    this._applyMaterial = function (color, emissive, emissiveIntensity) {
      try {
        const mesh = this.el.getObject3D("mesh");
        if (mesh && mesh.material) {
          // mesh.material may be an array for multi-material models
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          mats.forEach((m) => {
            if (
              m &&
              m.color &&
              color &&
              this._lastMaterialState.color !== color
            ) {
              m.color.set(color);
              this._lastMaterialState.color = color;
            }
            if (
              m &&
              "emissive" in m &&
              emissive &&
              this._lastMaterialState.emissive !== emissive
            ) {
              m.emissive.set(emissive);
              this._lastMaterialState.emissive = emissive;
            }
            if (
              typeof m.emissiveIntensity !== "undefined" &&
              typeof emissiveIntensity !== "undefined" &&
              this._lastMaterialState.emissiveIntensity !== emissiveIntensity
            ) {
              m.emissiveIntensity = emissiveIntensity;
              this._lastMaterialState.emissiveIntensity = emissiveIntensity;
            }
          });
          return true;
        }
      } catch (err) {
        // If direct mesh manipulation fails, fall back to setAttribute below
        console.warn(
          "Direct material update failed, falling back to setAttribute",
          err
        );
      }
      return false;
    }.bind(this);

    // Get camera reference
    this.camera = document.querySelector("a-camera");
    if (this.camera) {
      this.cameraObj = this.camera.getObject3D("camera");
    }

    // Cache cost-board element to avoid repeated DOM queries during drag
    this._costBoardEl = null;
    this._costBoardX = null;

    // Cache boundary calculations (will be updated if room changes)
    this._cachedBoundaries = null;

    // Track collision state to avoid redundant material updates
    this._lastCollisionState = false;

    // Cache last adjusted position to skip redundant work
    this._lastAdjustedPos = { x: 0, z: 0 };

    // Throttle mousemove to 60fps max (16ms)
    this._lastMoveTime = 0;
    this._moveThrottle = 16;

    // Shadow state for performance
    this._shadowsEnabled = true;

    // Default color for furniture
    this.defaultColor = "#8B4513";

    // Optimize raycaster performance
    this.raycaster.near = 0;
    this.raycaster.far = 50;
    this.raycaster.firstHitOnly = true;

    // Track last safe (non-colliding) position during drag
    this._lastSafePosition = null;

    // Dynamically derive object footprint after model loads instead of fixed schema defaults
    this.el.addEventListener("model-loaded", () => {
      const mesh = this.el.getObject3D("mesh");
      if (!mesh) return;
      const box = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Use X and Z dimensions as true footprint (avoid exaggerated 1.5m default)
      // Clamp to small positive to avoid zero causing boundary collapse
      this.data.objectWidth = Math.max(size.x, 0.05);
      this.data.objectLength = Math.max(size.z, 0.05);
      // Invalidate cached boundaries so new tighter margins apply immediately
      this._cachedBoundaries = null;
      console.log("✓ Updated furniture footprint from model bounding box", {
        width: this.data.objectWidth,
        length: this.data.objectLength,
      });
    });

    // Invalidate cached bounds when rotation or scale changes (affects footprint against walls)
    this.el.addEventListener("componentchanged", (e) => {
      if (!e || !e.detail) return;
      if (e.detail.name === "rotation" || e.detail.name === "scale") {
        this._cachedBoundaries = null;
      }
    });
  },

  onMouseDown: function (e) {
    if (e.detail && e.detail.intersection) {
      this.isDragging = true;
      this.originalPosition = this.el.object3D.position.clone();
      this.dragStartPosition = e.detail.intersection.point;

      // Reset cached boundaries on drag start (in case room changed)
      this._cachedBoundaries = null;
      this._lastCollisionState = false;

      // Attach the mousemove/mouseup listeners only while dragging (passive for better performance)
      document.addEventListener("mousemove", this.onMouseMove, {
        passive: true,
      });
      document.addEventListener("mouseup", this.onMouseUp);

      // Temporarily disable shadows during drag for GPU performance
      if (this.el.object3D.traverse) {
        this.el.object3D.traverse((node) => {
          if (node.material) {
            this._shadowsEnabled = node.castShadow;
            node.castShadow = false;
            node.receiveShadow = false;
          }
        });
      }

      // Visual feedback for drag start (green) - prefer fast path
      if (!this._applyMaterial("#4CAF50", "#2E7D32", 0.3)) {
        if (this._lastMaterialState.color !== "#4CAF50") {
          this.el.setAttribute("material", "color", "#4CAF50");
          this._lastMaterialState.color = "#4CAF50";
        }
        if (this._lastMaterialState.emissive !== "#2E7D32") {
          this.el.setAttribute("material", "emissive", "#2E7D32");
          this._lastMaterialState.emissive = "#2E7D32";
        }
        if (this._lastMaterialState.emissiveIntensity !== 0.3) {
          this.el.setAttribute("material", "emissiveIntensity", "0.3");
          this._lastMaterialState.emissiveIntensity = 0.3;
        }
      }

      console.log("Started dragging table:", this.el.id);
    }
  },

  onMouseMove: function (e) {
    // Only respond while dragging
    if (!this.isDragging) return;

    // Ensure camera object available
    if (!this.cameraObj) {
      const camEl = document.querySelector("a-camera");
      if (camEl) this.cameraObj = camEl.getObject3D("camera");
      if (!this.cameraObj) return;
    }

    // Time-based throttling: cap at 60fps (16ms) regardless of mouse poll rate
    const now = performance.now();
    if (now - this._lastMoveTime < this._moveThrottle) return;

    // Throttle with requestAnimationFrame: store latest event and do work in rAF
    this._lastMouseEvent = e;
    if (this._rafPending) return;
    this._rafPending = true;
    this._lastMoveTime = now;

    requestAnimationFrame(() => {
      this._rafPending = false;
      const evt = this._lastMouseEvent;

      // Update mouse normalized coords
      this.mouse.x = (evt.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(evt.clientY / window.innerHeight) * 2 + 1;

      // Raycast against a reusable ground plane and intersection point
      this.raycaster.setFromCamera(this.mouse, this.cameraObj);
      if (
        this.raycaster.ray.intersectPlane(
          this._groundPlane,
          this._intersectionPoint
        )
      ) {
        const newPos = this._intersectionPoint;
        const objPos = this.el.object3D.position;

        // Skip if mouse barely moved (reduce redundant calculations)
        const moved =
          Math.abs(newPos.x - this._lastAdjustedPos.x) +
          Math.abs(newPos.z - this._lastAdjustedPos.z);
        if (moved < 0.005) return; // Less than 5mm movement

        // Check boundaries and collision together (better cache locality)
        const adjustedPosition = this.checkBoundaries(newPos);
        const isCurrentlyColliding = this.isColliding(adjustedPosition);

        // Cache for next frame comparison
        this._lastAdjustedPos.x = adjustedPosition.x;
        this._lastAdjustedPos.z = adjustedPosition.z;

        // Update position directly
        objPos.set(adjustedPosition.x, 0, adjustedPosition.z);

        // Only update material when collision state changes
        if (isCurrentlyColliding !== this._lastCollisionState) {
          this._lastCollisionState = isCurrentlyColliding;
          this._applyMaterial(
            isCurrentlyColliding ? "#FF6B6B" : "#4CAF50",
            isCurrentlyColliding ? "#8B0000" : "#2E7D32",
            isCurrentlyColliding ? 0.25 : 0.3
          );
        }

        // Remember the last position that was not colliding for safe drop
        if (!isCurrentlyColliding) {
          if (!this._lastSafePosition)
            this._lastSafePosition = new THREE.Vector3();
          this._lastSafePosition.set(adjustedPosition.x, 0, adjustedPosition.z);
        }
      }
    });
  },

  onMouseUp: function (e) {
    if (this.isDragging) {
      this.isDragging = false;

      // Remove the temporary listeners attached during drag
      document.removeEventListener("mousemove", this.onMouseMove);
      document.removeEventListener("mouseup", this.onMouseUp);

      // Re-enable shadows after drag
      if (this._shadowsEnabled && this.el.object3D.traverse) {
        this.el.object3D.traverse((node) => {
          if (node.material) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
      }

      // Final placement policy
      const finalPosition = this.el.object3D.position;
      if (this._lastCollisionState) {
        // If still colliding when released: snap back to last safe position or original
        const fallback =
          this._lastSafePosition || this.originalPosition || finalPosition;
        const safe = this.checkBoundaries(fallback);
        finalPosition.set(safe.x, 0, safe.z);
        console.log(
          "Drop blocked near boundary; snapped to last safe position"
        );
      } else {
        // Ensure we end up within bounds (nudged if needed)
        const adjustedPosition = this.checkBoundaries(finalPosition);
        if (!this.positionsEqual(finalPosition, adjustedPosition)) {
          finalPosition.set(adjustedPosition.x, 0, adjustedPosition.z);
          console.log("Table position adjusted to stay within bounds");
        }
      }

      // Reset visual feedback to default brown after drag stops - prefer fast path
      if (!this._applyMaterial(this.defaultColor, "#000000", 0)) {
        if (this._lastMaterialState.color !== this.defaultColor) {
          this.el.setAttribute("material", "color", this.defaultColor);
          this._lastMaterialState.color = this.defaultColor;
        }
        if (this._lastMaterialState.emissive !== "#000000") {
          this.el.setAttribute("material", "emissive", "#000000");
          this._lastMaterialState.emissive = "#000000";
        }
        if (this._lastMaterialState.emissiveIntensity !== 0) {
          this.el.setAttribute("material", "emissiveIntensity", "0");
          this._lastMaterialState.emissiveIntensity = 0;
        }
      }

      console.log("Stopped dragging table:", this.el.id);
    }
  },

  checkBoundaries: function (position) {
    // Use cached boundaries if available, otherwise calculate once
    if (!this._cachedBoundaries) {
      const roomWidth = this.data.roomWidth;
      const roomLength = this.data.roomLength;
      // Derive current footprint from mesh AABB in world space for current rotation/scale
      let objWidth = this.data.objectWidth;
      let objLength = this.data.objectLength;
      const mesh = this.el.getObject3D("mesh");
      if (mesh) {
        const boxNow = new THREE.Box3().setFromObject(mesh);
        const sz = new THREE.Vector3();
        boxNow.getSize(sz);
        objWidth = Math.max(sz.x, 0.05);
        objLength = Math.max(sz.z, 0.05);
      }
      const wallThickness = this.data.wallThickness;
      // Clearance from wall we actually want (allow near-flush placement)
      const clearance = 0.02; // 2cm visual gap to avoid z-fighting

      // Calculate safe boundaries using INNER wall faces (account for wall thickness)
      const innerX = roomWidth / 2 - wallThickness / 2;
      const innerZ = roomLength / 2 - wallThickness / 2;
      // Apply user-configurable clearance symmetrically. No artificial expansion.
      const halfX = objWidth / 2;
      const halfZ = objLength / 2;
      let safeXMin = -innerX + halfX + this.data.clearance;
      let safeXMax = innerX - halfX - this.data.clearance;
      const safeZMin = -innerZ + halfZ + this.data.clearance;
      const safeZMax = innerZ - halfZ - this.data.clearance;

      // Cache cost board element and position once (not every frame)
      if (this._costBoardEl === null) {
        this._costBoardEl = document.getElementById("cost-board");
        if (this._costBoardEl && this._costBoardEl.object3D) {
          this._costBoardX = this._costBoardEl.object3D.position.x;
          const proximity = this.data.clearance; // reuse same clearance
          const boardLimit = this._costBoardX - halfX - proximity;
          // Only constrain if board is actually inset away from wall more than clearance
          if (!isNaN(boardLimit) && boardLimit < safeXMax) {
            safeXMax = Math.min(safeXMax, boardLimit);
          }
        }
      }

      // Cache the calculated boundaries
      this._cachedBoundaries = { safeXMin, safeXMax, safeZMin, safeZMax };
    }

    const bounds = this._cachedBoundaries;
    let newX = Math.max(bounds.safeXMin, Math.min(bounds.safeXMax, position.x));
    let newZ = Math.max(bounds.safeZMin, Math.min(bounds.safeZMax, position.z));

    return {
      x: newX,
      y: position.y,
      z: newZ,
    };
  },

  isColliding: function (position) {
    // Use cached boundaries if available
    if (!this._cachedBoundaries) {
      this.checkBoundaries(position); // This will populate the cache
    }

    const epsilon = 0.04; // Tightened tolerance; only red when almost touching
    const bounds = this._cachedBoundaries;

    // Check basic wall collisions using cached boundaries
    let rightTouch = position.x >= bounds.safeXMax - epsilon;

    // Only consider colliding when actually very close to or crossing boundaries
    return (
      position.x <= bounds.safeXMin + epsilon ||
      rightTouch ||
      position.z <= bounds.safeZMin + epsilon ||
      position.z >= bounds.safeZMax - epsilon
    );
  },

  positionsEqual: function (pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) < 0.01 && Math.abs(pos1.z - pos2.z) < 0.01;
  },

  remove: function () {
    // Clean up event listeners
    this.el.removeEventListener("mousedown", this.onMouseDown);
    // Ensure any temporary listeners are removed
    document.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mouseup", this.onMouseUp);
  },
});
