window.togglePanel = function () {
  panelOpen = !panelOpen;
  const panel = document.getElementById("side-panel");
  const toggle = document.getElementById("panel-toggle");
  const backButton = document.getElementById("back-button");

  if (panelOpen) {
    panel.classList.add("open");
    toggle.innerHTML = "✕";
    toggle.style.left = "310px";
    // Move back button to the right when panel is open
    if (backButton) {
      backButton.style.left = "310px";
    }
  } else {
    panel.classList.remove("open");
    toggle.innerHTML = "📦";
    toggle.style.left = "20px";
    // Move back button back to original position when panel is closed
    if (backButton) {
      backButton.style.left = "20px";
    }
  }
};

window.goBack = function () {
  window.location.href = "index.html";
};

window.toggleInstructions = function () {
  const instructions = document.getElementById("instructions");
  const toggle = document.getElementById("instructions-toggle");

  instructions.classList.toggle("collapsed");

  if (instructions.classList.contains("collapsed")) {
    toggle.textContent = "?";
  } else {
    toggle.textContent = "−";
  }
};

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (e.key === "Tab") {
    e.preventDefault();
    togglePanel();
  }
  if (e.key === "Escape") {
    goBack();
  }
  if (e.key === "g" || e.key === "G") {
    // Toggle grid visibility
    const grid = document.getElementById("grid-helper");
    const isVisible = grid.getAttribute("visible") !== "false";
    grid.setAttribute("visible", !isVisible);
    console.log("Grid", isVisible ? "hidden" : "shown");
  }
  if (e.key === "h" || e.key === "H") {
    // Toggle instructions
    e.preventDefault();
    toggleInstructions();
  }
});

// Sub-category functions
window.showWardrobeSubcategory = function () {
  const subcategory = document.getElementById("wardrobe-subcategory");
  if (subcategory.style.display === "none") {
    subcategory.style.display = "block";
    // Re-initialize drag and drop for new items
    initializeDragAndDrop();
  } else {
    subcategory.style.display = "none";
  }
};
