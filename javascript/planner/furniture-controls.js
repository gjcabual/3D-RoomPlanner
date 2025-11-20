let selectedFurniture = null; // Track currently selected furniture

// Control panel functions
window.showControlPanel = function (furnitureId) {
  selectedFurniture = furnitureId;
  const panel = document.getElementById("furniture-control-panel");
  const title = document.getElementById("control-panel-title");
  title.textContent = `Controls for ${furnitureId}`;
  panel.style.display = "block";
};

window.closeControlPanel = function () {
  const panel = document.getElementById("furniture-control-panel");
  panel.style.display = "none";
  selectedFurniture = null;
};

window.rotateFurnitureLeft = function () {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) - 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`
      );
      console.log(
        `Rotated ${selectedFurniture} left to ${newRotation} degrees`
      );
    }
  }
};

window.rotateFurnitureRight = function () {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) + 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`
      );
      console.log(
        `Rotated ${selectedFurniture} right to ${newRotation} degrees`
      );
    }
  }
};

window.deleteFurniture = function () {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      // Remove from cost estimator
      const modelKey = furniture
        .getAttribute("obj-model")
        .match(/models\/(\w+)\.obj/)[1];
      if (costState.items[modelKey]) {
        costState.items[modelKey].qty -= 1;
        if (costState.items[modelKey].qty <= 0) {
          delete costState.items[modelKey];
        }
        renderCost();
      }

      // Remove from scene
      furniture.remove();
      console.log(`Deleted ${selectedFurniture}`);
      closeControlPanel();
    }
  }
};
