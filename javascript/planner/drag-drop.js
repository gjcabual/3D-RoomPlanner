let draggedItem = null;

function initializeDragAndDrop() {
  // Only enable drag for enabled items (table)
  const enabledItems = document.querySelectorAll(".model-item.enabled");
  const scene = document.getElementById("scene");
  const dropIndicator = document.getElementById("drop-indicator");

  enabledItems.forEach((item) => {
    item.addEventListener("dragstart", handleDragStart);
  });

  // Scene drop events
  scene.addEventListener("dragover", handleDragOver);
  scene.addEventListener("drop", handleDrop);
  scene.addEventListener("dragenter", handleDragEnter);
  scene.addEventListener("dragleave", handleDragLeave);
}

function handleDragStart(e) {
  draggedItem = {
    model: e.target.dataset.model,
    scale: e.target.dataset.scale,
    name: e.target.querySelector(".model-name").textContent,
  };
  e.target.classList.add("dragging");

  // Hide the drop indicator when dragging starts
  const dropIndicator = document.getElementById("drop-indicator");
  dropIndicator.classList.remove("show");
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDragEnter(e) {
  e.preventDefault();
  document.getElementById("drop-indicator").classList.add("show");
}

function handleDragLeave(e) {
  if (
    !e.relatedTarget ||
    !document.getElementById("scene").contains(e.relatedTarget)
  ) {
    document.getElementById("drop-indicator").classList.remove("show");
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById("drop-indicator").classList.remove("show");

  if (!draggedItem) return;

  // Calculate drop position (center of room with slight randomization)
  const dropX = (Math.random() - 0.5) * 2;
  const dropZ = (Math.random() - 0.5) * 2;

  // Get room dimensions for smart placement
  const roomWidth = parseFloat(localStorage.getItem("roomWidth")); // Already in meters
  const roomLength = parseFloat(localStorage.getItem("roomLength"));

  // Create furniture entity
  const furnitureEl = document.createElement("a-entity");
  furnitureEl.id = `furniture-${furnitureCounter++}`;
  furnitureEl.setAttribute("position", `${dropX} 0 ${dropZ}`);
  furnitureEl.setAttribute(
    "obj-model",
    `obj: url(models/${draggedItem.model}.obj)`
  );
  furnitureEl.setAttribute("scale", draggedItem.scale);
  furnitureEl.setAttribute(
    "draggable-furniture",
    `roomWidth: ${roomWidth}; roomLength: ${roomLength}; objectWidth: 1.5; objectLength: 1.5; wallThickness: 0.1`
  );
  furnitureEl.setAttribute("clickable-furniture", "");
  // Enhanced PBR material for realistic look
  furnitureEl.setAttribute(
    "material",
    "color: #8B4513; roughness: 0.5; metalness: 0.2; shader: standard; envMapIntensity: 0.3"
  );
  furnitureEl.setAttribute("shadow", "cast: true; receive: true");

  // Add to scene
  document.getElementById("furniture-container").appendChild(furnitureEl);

  // Update cost estimator
  addItemToCost(draggedItem.model, draggedItem.name);

  // Clean up
  document.querySelectorAll(".model-item.dragging").forEach((item) => {
    item.classList.remove("dragging");
  });

  // Remove the drop indicator permanently after first furniture placement
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.style.display = "none";
  }

  console.log(
    `Added ${draggedItem.name} to room at position ${dropX}, ${dropZ}`
  );
  draggedItem = null;
}
