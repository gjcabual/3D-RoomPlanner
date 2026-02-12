function startPlanner() {
  const widthInput = document.getElementById("room-width");
  const lengthInput = document.getElementById("room-length");
  const heightInput = document.getElementById("room-height");

  const width = parseFloat(widthInput.value);
  const length = parseFloat(lengthInput.value);
  const height = parseFloat(heightInput.value);

  // Validation
  if (!width || !length || !height) {
    showDialog(
      "Please enter width, length, and height dimensions",
      "Validation Error",
    );
    return;
  }

  if (
    width < 1 ||
    width > 20 ||
    length < 1 ||
    length > 20 ||
    height < 1 ||
    height > 20
  ) {
    showDialog(
      "Please enter dimensions between 1ft and 20ft",
      "Validation Error",
    );
    return;
  }

  // Convert feet to meters for internal storage (planner uses meters)
  const M_PER_FT = 0.3048;
  const widthM = +(width * M_PER_FT).toFixed(2);
  const lengthM = +(length * M_PER_FT).toFixed(2);
  const heightM = +(height * M_PER_FT).toFixed(2);

  localStorage.setItem("roomWidth", widthM);
  localStorage.setItem("roomLength", lengthM);
  localStorage.setItem("roomHeight", heightM);

  // Clear old saved room state so it doesn't override the new dimensions
  localStorage.removeItem("currentRoomState");
  localStorage.removeItem("workspaceState");

  // Navigate directly to planner - loading is handled there
  window.location.href = "planner.html";
}

// Allow Enter key to start planner
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    startPlanner();
  }
});

// Set up input event listeners (focus is handled by preloader after loading completes)
window.addEventListener("load", function () {
  // Add tab navigation between inputs
  const inputs = ["room-width", "room-length", "room-height"];
  inputs.forEach((id, index) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          startPlanner();
        } else if (e.key === "Tab" && !e.shiftKey) {
          // Allow default tab behavior
        }
      });
    }
  });
});
