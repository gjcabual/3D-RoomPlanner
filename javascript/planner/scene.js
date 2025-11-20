// Wall visibility: hide only the wall the camera is most outside of (one at a time)
// Smooth fade speed (lower = slower)
const FADE_SPEED = 0.08;

// Wall visibility: hide only the wall the camera is most outside of (one at a time)
function setupWallVisibility() {
  const cameraRig = document.getElementById("cameraRig");
  if (!cameraRig) return;

  const roomWidth = parseFloat(localStorage.getItem("roomWidth")) || 10;
  const roomLength = parseFloat(localStorage.getItem("roomLength")) || 10;
  const roomHeight = 3;

  const margin = 0.4;
  const THRESHOLD = 0.15; // prevents tiny angle bugs

  function update() {
    const camPos = cameraRig.object3D.position;

    const backWall = document.querySelector(".wall-back");
    const frontWall = document.querySelector(".wall-front");
    const leftWall = document.querySelector(".wall-left");
    const rightWall = document.querySelector(".wall-right");
    const ceiling = document.querySelector(".room-ceiling");

    if (!backWall || !frontWall || !leftWall || !rightWall || !ceiling) {
      requestAnimationFrame(update);
      return;
    }

    // Calculate camera "outside position" for every wall
    const outs = [
      { wall: rightWall, val: camPos.x - roomWidth / 2 - margin },
      { wall: leftWall, val: -roomWidth / 2 - margin - camPos.x },
      { wall: frontWall, val: camPos.z - roomLength / 2 - margin },
      { wall: backWall, val: -roomLength / 2 - margin - camPos.z },
      { wall: ceiling, val: camPos.y - roomHeight - margin },
    ];

    // Reset all walls to visible
    [backWall, frontWall, leftWall, rightWall, ceiling].forEach(
      (w) => (w.object3D.visible = true)
    );

    // Filter only walls that camera is OUTSIDE of by a meaningful amount
    const valid = outs.filter((o) => o.val > THRESHOLD);

    if (valid.length === 0) {
      // Camera is inside → show everything
      requestAnimationFrame(update);
      return;
    }

    // Pick the ONE wall with the highest value (most outside)
    valid.sort((a, b) => b.val - a.val);
    const wallToHide = valid[0].wall;

    // Hide only that one
    wallToHide.object3D.visible = false;

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
  console.log("✓ Improved wall occlusion with angle-bug fix enabled");
}

// Initialize room when page loads
window.addEventListener("load", function () {
  // Enhanced graphics configuration
  const scene = document.querySelector("a-scene");

  scene.addEventListener("loaded", function () {
    console.log("A-Frame scene loaded, applying enhanced graphics...");

    // Get Three.js renderer for advanced configuration
    const renderer = scene.renderer;
    if (renderer) {
      // Enable high-quality shadows
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Enable physically correct lighting
      renderer.physicallyCorrectLights = true;

      // Better tone mapping for realistic lighting
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      // Enable high-quality antialiasing
      renderer.antialias = true;

      // Better color output
      renderer.outputEncoding = THREE.sRGBEncoding;

      console.log("✓ Enhanced graphics applied:");
      console.log("  - Soft shadows (PCF)");
      console.log("  - Physically correct lighting");
      console.log("  - ACES Filmic tone mapping");
      console.log("  - sRGB color encoding");
    }

    // Initialize room after graphics are configured
    initializeRoom();

    // Add dynamic wall visibility system
    setupWallVisibility();
  });

  // Performance monitoring (optional - can be disabled in production)
  let frameCount = 0;
  let lastTime = performance.now();

  setInterval(() => {
    const now = performance.now();
    const fps = Math.round((frameCount * 1000) / (now - lastTime));
    frameCount = 0;
    lastTime = now;

    // Log FPS when dragging (for debugging)
    const dragging = document.querySelector("[draggable-furniture]");
    if (
      dragging &&
      dragging.components["draggable-furniture"] &&
      dragging.components["draggable-furniture"].isDragging
    ) {
      console.log(`FPS during drag: ${fps}`);
    }
  }, 1000);

  // Count frames
  scene.addEventListener("renderstart", () => frameCount++);

  // Make sure A-Frame scene is ready
  if (scene.hasLoaded) {
    initializeRoom();
  }
});
