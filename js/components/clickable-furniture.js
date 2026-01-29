// Enhanced furniture interaction component with selection and rotation controls
AFRAME.registerComponent("clickable-furniture", {
  init: function () {
    const el = this.el;
    this.isSelected = false;
    this.originalColor = null;
    this.rotationControls = null;
    this.currentRotation = 0; // Track current rotation in degrees
    this.selectionOutline = null; // THREE.js outline helper

    el.addEventListener(
      "click",
      function (evt) {
        console.log("Furniture clicked:", el.id);

        // Only handle selection if not dragging
        if (
          !this.el.components["draggable-furniture"] ||
          !this.el.components["draggable-furniture"].isDragging
        ) {
          // Deselect all other furniture first
          this.deselectAllOtherFurniture();

          // Toggle selection
          this.toggleSelection();
        }
      }.bind(this),
    );

    // Store original material for restoration
    this.storeOriginalMaterial();
  },

  storeOriginalMaterial: function () {
    const material = this.el.getAttribute("material");
    if (material) {
      this.originalColor = material.color || "#ffffff"; // Default neutral
    } else {
      this.originalColor = "#ffffff";
    }
  },

  createOutline: function () {
    // Remove existing outline if any
    this.removeOutline();

    const object3D = this.el.object3D;
    if (!object3D) return;

    // Use BoxHelper which automatically updates with the object
    // Need to get the scene-level representation for accurate bounds
    const box = new THREE.Box3().setFromObject(object3D);
    if (box.isEmpty()) {
      // Model might not be loaded yet, retry after a short delay
      setTimeout(() => {
        if (this.isSelected) this.createOutline();
      }, 100);
      return;
    }

    // Create BoxHelper - it follows the object automatically
    this.selectionOutline = new THREE.BoxHelper(object3D, 0x000000);
    this.selectionOutline.material.linewidth = 2;

    // Add to scene (not to object) so it renders correctly
    const scene = this.el.sceneEl.object3D;
    scene.add(this.selectionOutline);

    // Store reference to update in tick
    this._outlineNeedsUpdate = true;
  },

  removeOutline: function () {
    if (this.selectionOutline) {
      // Remove from scene
      if (this.selectionOutline.parent) {
        this.selectionOutline.parent.remove(this.selectionOutline);
      }
      if (this.selectionOutline.geometry) {
        this.selectionOutline.geometry.dispose();
      }
      if (this.selectionOutline.material) {
        this.selectionOutline.material.dispose();
      }
      this.selectionOutline = null;
    }
    this._outlineNeedsUpdate = false;
  },

  deselectAllOtherFurniture: function () {
    // Find all furniture with clickable-furniture component and deselect them
    const allFurniture = document.querySelectorAll("[clickable-furniture]");
    allFurniture.forEach((furniture) => {
      if (
        furniture !== this.el &&
        furniture.components["clickable-furniture"]
      ) {
        furniture.components["clickable-furniture"].deselect();
      }
    });
  },

  toggleSelection: function () {
    if (this.isSelected) {
      this.deselect();
    } else {
      this.select();
    }
  },

  select: function () {
    this.isSelected = true;

    // Create black outline around the object
    this.createOutline();

    // Show web-based control panel instead of 3D buttons
    if (typeof showControlPanel === "function") {
      showControlPanel(this.el.id);
    }

    // Notify UI (cost panel) about selection
    try {
      const modelKey = this.el.getAttribute("data-model-key") || null;
      window.dispatchEvent(
        new CustomEvent("furnitureSelected", {
          detail: { id: this.el.id, modelKey },
        }),
      );
    } catch (e) {
      // no-op
    }

    console.log("Furniture selected:", this.el.id);
  },

  deselect: function () {
    this.isSelected = false;

    // Remove the selection outline
    this.removeOutline();

    // Check if object is near walls - if so, let draggable-furniture component handle the color
    const draggableComponent = this.el.components["draggable-furniture"];
    if (draggableComponent) {
      const currentPosition = this.el.object3D.position;
      const isNearWall = draggableComponent.isColliding(currentPosition);

      if (isNearWall) {
        // Near wall - emissive red (draggable-furniture tick will maintain this)
        this.el.setAttribute("material", "emissive", "#8B0000");
        this.el.setAttribute("material", "emissiveIntensity", "0.35");
      } else {
        // Away from walls - clear emissive
        this.el.setAttribute("material", "emissive", "#000000");
        this.el.setAttribute("material", "emissiveIntensity", "0");
      }
    } else {
      // No draggable component - clear emissive
      this.el.setAttribute("material", "emissive", "#000000");
      this.el.setAttribute("material", "emissiveIntensity", "0");
    }

    // Hide control panel when deselecting
    if (typeof closeControlPanel === "function") {
      closeControlPanel();
    }

    console.log("Furniture deselected:", this.el.id);

    try {
      const modelKey = this.el.getAttribute("data-model-key") || null;
      window.dispatchEvent(
        new CustomEvent("furnitureDeselected", {
          detail: { id: this.el.id, modelKey },
        }),
      );
    } catch (e) {
      // no-op
    }
  },

  // 3D rotation controls removed - now using web-based control panel

  tick: function (time, deltaTime) {
    // Only update outline if selected and outline exists
    if (!this.isSelected) return;

    // Throttle updates to every 50ms for performance
    if (!this._lastOutlineUpdate) this._lastOutlineUpdate = 0;
    if (time - this._lastOutlineUpdate < 50) return;
    this._lastOutlineUpdate = time;

    // Update BoxHelper to match current object bounds
    if (this.selectionOutline && this.selectionOutline.update) {
      this.selectionOutline.update();
    }
  },

  remove: function () {
    // Clean up when component is removed
    this.removeOutline();
    if (typeof closeControlPanel === "function") {
      closeControlPanel();
    }
  },
});
