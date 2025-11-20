/**
 * three-integration.js
 * Initializes Three.js scene and connects it with existing UI/cost systems
 */

import * as THREE from "three";
import { ThreeRoomScene } from "./ThreeRoomScene.js";
import { ThreeAdapter } from "./ThreeAdapter.js";

let threeScene = null;
let adapter = null;
let placementIndicator = null; // Visual indicator for furniture placement

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  initializeThreeScene();
});

function initializeThreeScene() {
  // Check if room dimensions exist
  const width = localStorage.getItem("roomWidth");
  const length = localStorage.getItem("roomLength");

  if (!width || !length) {
    alert("No room dimensions found. Redirecting to setup...");
    window.location.href = "index.html";
    return;
  }

  console.log(`Initializing Three.js room: ${width}M x ${length}M`);

  // Create container for Three.js canvas
  let container = document.getElementById("three-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "three-container";
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.zIndex = "0";
    document.body.appendChild(container);
  }

  // Initialize Three.js scene
  threeScene = new ThreeRoomScene(container);
  adapter = new ThreeAdapter(threeScene);

  // Make globally accessible for debugging
  window.threeScene = threeScene;
  window.threeAdapter = adapter;

  // Update room info display
  const roomInfo = document.getElementById("room-info");
  if (roomInfo) {
    const height = localStorage.getItem("roomHeight") || "3";
    roomInfo.innerHTML = `<strong>Room:</strong> ${width}M(W) × ${length}M(L) × ${height}M(H)`;
  }

  // Setup click-to-place furniture
  setupFurniturePlacement();

  // Setup furniture controls
  setupFurnitureControls();

  console.log("✓ Three.js scene initialized successfully");
  console.log("✓ Click furniture items to place them in the room");
}

function setupFurniturePlacement() {
  setTimeout(() => {
    const modelItems = document.querySelectorAll(".model-item.enabled");
    console.log(`Found ${modelItems.length} furniture items`);

    modelItems.forEach((item) => {
      // Remove draggable attribute
      item.removeAttribute("draggable");

      // Add click listener - auto-place in center of room
      item.addEventListener("click", (e) => {
        const modelType = item.dataset.model;
        if (!modelType) return;

        console.log("Furniture selected:", modelType);

        // Visual feedback
        document
          .querySelectorAll(".model-item")
          .forEach((i) => i.classList.remove("selected"));
        item.classList.add("selected");

        // Place furniture in center of room automatically
        const id = adapter.placeFurnitureAtCenter(modelType);

        if (id) {
          console.log(`✓ Placed ${modelType} at center with ID: ${id}`);
          // Update cost
          if (window.updateFurnitureCost) {
            window.updateFurnitureCost();
          }
          // Show instruction to drag/rotate
          showPlacementInstruction(
            `✓ ${modelType} placed! Click & drag to move, press R to rotate.`
          );
          // Deselect after brief delay
          setTimeout(() => {
            document
              .querySelectorAll(".model-item")
              .forEach((i) => i.classList.remove("selected"));
          }, 1500);
        } else {
          console.error("Failed to place furniture");
          showPlacementInstruction("❌ Failed to place furniture.");
        }
      });
    });

    console.log("✓ Auto-placement system ready");
  }, 500);
}

// Placement indicator removed - furniture is placed automatically at center

function showPlacementInstruction(message) {
  let instruction = document.getElementById("placement-instruction");
  if (!instruction) {
    instruction = document.createElement("div");
    instruction.id = "placement-instruction";
    document.body.appendChild(instruction);
  }
  instruction.textContent = message;
  instruction.classList.add("show");

  // Auto-hide after 4 seconds if it's not an error message
  if (!message.includes("❌")) {
    setTimeout(() => {
      if (instruction.textContent === message) {
        instruction.classList.remove("show");
      }
    }, 4000);
  }
}

function hidePlacementInstruction() {
  const instruction = document.getElementById("placement-instruction");
  if (instruction) {
    instruction.classList.remove("show");
  }
}

function setupFurnitureControls() {
  const controlPanel = document.getElementById("furniture-control-panel");
  if (!controlPanel) return;

  // Rotate left button
  const rotateLeftBtn = controlPanel.querySelector(".rotate-left");
  if (rotateLeftBtn) {
    rotateLeftBtn.addEventListener("click", () => {
      const id = controlPanel.dataset.furnitureId;
      const furniture = threeScene.furnitureObjects.get(id);
      if (furniture) {
        furniture.rotation.y += Math.PI / 4; // 45 degrees
      }
    });
  }

  // Rotate right button
  const rotateRightBtn = controlPanel.querySelector(".rotate-right");
  if (rotateRightBtn) {
    rotateRightBtn.addEventListener("click", () => {
      const id = controlPanel.dataset.furnitureId;
      const furniture = threeScene.furnitureObjects.get(id);
      if (furniture) {
        furniture.rotation.y -= Math.PI / 4; // 45 degrees
      }
    });
  }

  // Delete button
  const deleteBtn = controlPanel.querySelector(".delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const id = controlPanel.dataset.furnitureId;
      adapter.removeFurniture(id);
      controlPanel.style.display = "none";
    });
  }

  // Close button
  const closeBtn = controlPanel.querySelector(".close-controls");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      controlPanel.style.display = "none";
    });
  }
}

// Update cost calculation to work with Three.js
window.updateFurnitureCost = function () {
  if (!adapter) return;

  const furniture = adapter.getAllFurniture();
  const costList = document.getElementById("cost-list");

  if (!costList) return;

  costList.innerHTML = "";
  let total = 0;

  // Furniture prices (same as before)
  const prices = {
    table1: 5000,
    chair: 1500,
    sofa: 8000,
    desk: 4000,
  };

  // Count furniture by type
  const counts = {};
  furniture.forEach((item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
  });

  // Display costs
  Object.entries(counts).forEach(([type, count]) => {
    const price = prices[type] || 0;
    const itemTotal = price * count;
    total += itemTotal;

    const costItem = document.createElement("div");
    costItem.className = "cost-item";
    costItem.innerHTML = `
      <div>
        <div class="cost-item-name">${type}</div>
        <div class="cost-item-meta">₱${price.toLocaleString()} × ${count}</div>
      </div>
      <div class="cost-item-price">₱${itemTotal.toLocaleString()}</div>
    `;
    costList.appendChild(costItem);
  });

  // Update total
  const totalElement = document.getElementById("total-cost");
  if (totalElement) {
    totalElement.textContent = `₱${total.toLocaleString()}`;
  }
};

// Export for external access
export { threeScene, adapter, initializeThreeScene };
