// Enhanced furniture interaction component with selection and rotation controls
AFRAME.registerComponent("clickable-furniture", {
  init: function () {
    const el = this.el;
    this.isSelected = false;
    this.originalColor = null;
    this.rotationControls = null;
    this.currentRotation = 0; // Track current rotation in degrees
<<<<<<< HEAD
    
    el.addEventListener('click', function (evt) {
      console.log('Furniture clicked:', el.id);
      
      // Only handle selection if not dragging
      const draggableComponent = this.el.components['draggable-furniture'];
      if (!draggableComponent || !draggableComponent.isDragging) {
        // Set flag to indicate this is a selection click, not a drag
        // This prevents draggable-furniture from processing movement
        this._isSelectionClick = true;
        
        // If already selected, deselect it (turn back to original color)
        if (this.isSelected) {
          this.deselect();
        } else {
          // Deselect all other furniture first
          this.deselectAllOtherFurniture();
          // Then select this one
          this.select();
        }
        
        // Reset flag after a short delay to allow click to complete
        setTimeout(() => {
          this._isSelectionClick = false;
        }, 100);
      }
    }.bind(this));
    
=======

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
      }.bind(this)
    );

>>>>>>> 9851a8bb1523f880130cc8d3babbcdab39b81051
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
    this.el.setAttribute("material", "emissive", "#2E7D32"); // Add glow effect
    this.el.setAttribute("material", "emissiveIntensity", "0.35");

    // Show web-based control panel instead of 3D buttons
    if (typeof showControlPanel === "function") {
      showControlPanel(this.el.id);
    }

    console.log("Furniture selected:", this.el.id);
  },

  deselect: function () {
    this.isSelected = false;
<<<<<<< HEAD
    
    // Always return to original color when deselected
    // (clicking item again or clicking x on control panel)
    this.el.setAttribute('material', 'color', this.originalColor);
    this.el.setAttribute('material', 'emissive', '#000000');
    this.el.setAttribute('material', 'emissiveIntensity', '0');
    
    // Hide control panel when deselecting (but don't call closeControlPanel if already being closed)
    // The closeControlPanel function will handle deselecting, so we avoid recursion
    // Only hide panel if deselect was called directly (e.g., clicking item again)
    if (typeof closeControlPanel === 'function' && !this._isClosingPanel) {
      // Set flag to prevent recursion
      this._isClosingPanel = true;
      closeControlPanel();
      this._isClosingPanel = false;
    }
    
    console.log('Furniture deselected:', this.el.id);
  },
  
  // 3D rotation controls removed - now using web-based control panel
  
  remove: function() {
    // Clean up when component is removed
    if (typeof closeControlPanel === 'function') {
      closeControlPanel();
    }
  }
});
=======

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
>>>>>>> 9851a8bb1523f880130cc8d3babbcdab39b81051

    // Hide control panel when deselecting
    if (typeof closeControlPanel === "function") {
      closeControlPanel();
    }

    console.log("Furniture deselected:", this.el.id);
  },

  // 3D rotation controls removed - now using web-based control panel

  remove: function () {
    // Clean up when component is removed
    if (typeof closeControlPanel === "function") {
      closeControlPanel();
    }
  },
});
