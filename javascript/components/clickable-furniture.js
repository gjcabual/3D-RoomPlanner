// Enhanced furniture interaction component with selection and rotation controls
AFRAME.registerComponent("clickable-furniture", {
  init: function () {
    const el = this.el;
    this.isSelected = false;
    this.originalColor = null;
    this.rotationControls = null;
    this.currentRotation = 0; // Track current rotation in degrees

    el.addEventListener(
      "click",
      function (evt) {
        console.log("Furniture clicked:", el.id);

        // Deselect all other furniture first
        this.deselectAllOtherFurniture();

        // Toggle selection
        this.toggleSelection();
      }.bind(this)
    );

    // Store original material for restoration
    this.storeOriginalMaterial();
  },

  storeOriginalMaterial: function () {
    const material = this.el.getAttribute("material");
    if (material) {
      this.originalColor = material.color || "#8B4513"; // Default brown
    } else {
      this.originalColor = "#8B4513";
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
    this.el.setAttribute("material", "color", "#4CAF50"); // Green for selected
    this.el.setAttribute("material", "emissive", "#2E7D32"); // Add glow effect
    this.el.setAttribute("material", "emissiveIntensity", "0.3");

    // Show web-based control panel instead of 3D buttons
    if (typeof showControlPanel === "function") {
      showControlPanel(this.el.id);
    }

    console.log("Furniture selected:", this.el.id);
  },

  deselect: function () {
    this.isSelected = false;
    this.el.setAttribute("material", "color", this.originalColor);
    this.el.setAttribute("material", "emissive", "#000000");
    this.el.setAttribute("material", "emissiveIntensity", "0");

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
