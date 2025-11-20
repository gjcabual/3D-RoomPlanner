// Initialize the room with dimensions from localStorage
function initializeRoom() {
  const width = localStorage.getItem("roomWidth");
  const length = localStorage.getItem("roomLength");

  if (!width || !length) {
    alert("No room dimensions found. Redirecting to setup...");
    window.location.href = "index.html";
    return;
  }

  console.log(
    "Initializing room with dimensions:",
    width + "M x " + length + "M"
  );

  // Convert m to A-Frame units (1:1 ratio)
  const aframeWidth = parseFloat(width);
  const aframeLength = parseFloat(length);

  // Update floor size
  const floor = document.getElementById("floor");
  floor.setAttribute("width", aframeWidth);
  floor.setAttribute("height", aframeLength);

  // Create room walls
  createRoomWalls(aframeWidth, aframeLength);

  // Position cost board INSIDE the room, hugging the right wall with a dynamic margin
  const costBoard = document.getElementById("cost-board");
  if (costBoard) {
    const margin = Math.min(0.12, aframeWidth * 0.08); // adaptive margin for very small rooms
    const boardX = aframeWidth / 2 - margin - 0.01; // keep inside
    const boardY = Math.min(1.5, Math.max(1.1, aframeWidth * 0.6)); // adapt vertical position a bit
    costBoard.setAttribute("position", `${boardX} ${boardY} 0`);
    costBoard.setAttribute("rotation", `0 -90 0`);
    console.log(`Cost board positioned inside room at: ${boardX} ${boardY} 0`);
  }

  // Update room info
  document.getElementById(
    "room-info"
  ).innerHTML = `<strong>Room:</strong> ${width}M × ${length}M`;

  // Position camera for a better overview, looking at the center
  const cameraRig = document.getElementById("cameraRig");
  const maxDim = Math.max(aframeWidth, aframeLength);
  const cameraDistance = maxDim * 1.5; // A bit further back
  const cameraHeight = maxDim * 0.15; // Higher up for a better angle
  cameraRig.setAttribute("position", `0 ${cameraHeight} ${cameraDistance}`);

  // Point the camera to look at the center of the floor
  const camera = cameraRig.querySelector("a-camera");
  camera.setAttribute("look-controls", "enabled", false); // Temporarily disable look-controls
  camera.object3D.lookAt(new THREE.Vector3(0, 0, 0));
  camera.setAttribute("look-controls", "enabled", true); // Re-enable look-controls

  // Wait for scene to be ready, then initialize drag and drop
  const scene = document.querySelector("a-scene");
  if (scene.hasLoaded) {
    initializeDragAndDrop();
  } else {
    scene.addEventListener("loaded", initializeDragAndDrop);
  }

  // Test movement system
  setTimeout(() => {
    console.log(
      "Movement system should be ready. Try WASD keys and Q/E for up/down."
    );
    console.log(
      "If movement doesn't work, check the browser console for error messages."
    );
  }, 1000);
}

function createRoomWalls(width, length) {
  const wallsContainer = document.getElementById("room-walls");
  const wallHeight = 4;
  const wallThickness = 0.15;

  wallsContainer.innerHTML = "";

  // Enhanced wall configurations with improved materials
  const walls = [
    {
      pos: `0 ${wallHeight / 2} ${-length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
      name: "back",
    },
    {
      pos: `0 ${wallHeight / 2} ${length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
      name: "front",
    },
    {
      pos: `${-width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
      name: "left",
    },
    {
      pos: `${width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
      name: "right",
    },
  ];

  // Create main walls with enhanced materials
  walls.forEach((wall, i) => {
    const wallEl = document.createElement("a-box");
    wallEl.setAttribute("position", wall.pos);
    wallEl.setAttribute("class", `room-wall wall-${wall.name}`);
    const [w, h, d] = wall.size.split(" ");
    wallEl.setAttribute("width", w);
    wallEl.setAttribute("height", h);
    wallEl.setAttribute("depth", d);

    // Enhanced wall material with subtle texture simulation
    wallEl.setAttribute(
      "material",
      "color: #5b5959; roughness: 5.; metalness: 0.5; envMapIntensity: 0.4; shader: standard; side: double"
    );
    wallEl.setAttribute("shadow", "cast: false; receive: true");
    wallsContainer.appendChild(wallEl);

    // Safe numeric parsing of wall position (avoid fragile string replace)
    const [px, py, pz] = wall.pos.split(" ").map(Number);

    // Baseboard (thin, always sits at y = baseboardHeight/2)
    const baseboardHeight = 0.12;
    const baseboardThickness = wallThickness + 0.015;
    const baseboard = document.createElement("a-box");
    baseboard.setAttribute("color", "#e9e9e9");
    baseboard.setAttribute(
      "material",
      "roughness: 0.65; metalness: 0.04; shader: standard"
    );
    baseboard.setAttribute("shadow", "receive: true");
    baseboard.setAttribute("class", `baseboard baseboard-${wall.name}`);
    if (wall.name === "back" || wall.name === "front") {
      baseboard.setAttribute("position", `${px} ${baseboardHeight / 2} ${pz}`);
      baseboard.setAttribute("width", w);
      baseboard.setAttribute("height", baseboardHeight);
      baseboard.setAttribute("depth", baseboardThickness);
    } else {
      baseboard.setAttribute("position", `${px} ${baseboardHeight / 2} ${pz}`);
      baseboard.setAttribute("width", baseboardThickness);
      baseboard.setAttribute("height", baseboardHeight);
      baseboard.setAttribute("depth", d);
    }
    wallsContainer.appendChild(baseboard);

    // Crown molding (top trim) placed numerically near ceiling
    const moldingHeight = 0.07;
    const moldingThickness = wallThickness + 0.01;
    const crownY = wallHeight - moldingHeight / 2;
    const crownMolding = document.createElement("a-box");
    crownMolding.setAttribute("color", "#f2f2f2");
    crownMolding.setAttribute(
      "material",
      "roughness: 0.55; metalness: 0.025; shader: standard"
    );
    crownMolding.setAttribute("shadow", "receive: true");
    crownMolding.setAttribute("class", `crown-molding molding-${wall.name}`);
    if (wall.name === "back" || wall.name === "front") {
      crownMolding.setAttribute("position", `${px} ${crownY} ${pz}`);
      crownMolding.setAttribute("width", w);
      crownMolding.setAttribute("height", moldingHeight);
      crownMolding.setAttribute("depth", moldingThickness);
    } else {
      crownMolding.setAttribute("position", `${px} ${crownY} ${pz}`);
      crownMolding.setAttribute("width", moldingThickness);
      crownMolding.setAttribute("height", moldingHeight);
      crownMolding.setAttribute("depth", d);
    }
    wallsContainer.appendChild(crownMolding);
  });

  // Enhanced ceiling with coffered design elements
  const ceiling = document.createElement("a-box");
  ceiling.setAttribute("position", `0 ${wallHeight} 0`);
  ceiling.setAttribute("width", width);
  ceiling.setAttribute("height", wallThickness);
  ceiling.setAttribute("depth", length);
  ceiling.setAttribute("color", "#fafafa");
  ceiling.setAttribute(
    "material",
    "roughness: 0.7; metalness: 0.01; envMapIntensity: 0.5; shader: standard"
  );
  ceiling.setAttribute("shadow", "receive: true");
  ceiling.setAttribute("class", "room-ceiling");
  wallsContainer.appendChild(ceiling);

  // Create Blender-style grid
  createBlenderGrid(width, length);

  console.log(
    "✓ Enhanced room walls and ceiling created with architectural details"
  );
}

// Create a Blender-style grid outside the room for spatial reference
function createBlenderGrid(roomWidth, roomLength) {
  const gridContainer = document.getElementById("blender-grid");
  if (!gridContainer) return;

  gridContainer.innerHTML = "";

  // Make grid slightly larger than the room for better visual context
  const gridSize = Math.max(roomWidth, roomLength) + 150;
  const gridDivisions = Math.floor(gridSize); // 1-meter divisions
  const gridColor = "#444";
  const subGridColor = "#333";
  const floorY = -0.02; // Slightly below floor to avoid z-fighting

  // Main grid lines (1-meter intervals)
  for (let i = -gridSize / 2; i <= gridSize / 2; i++) {
    // Lines parallel to Z axis
    const lineX = document.createElement("a-entity");
    lineX.setAttribute(
      "line",
      `start: ${i} ${floorY} ${-gridSize / 2}; end: ${i} ${floorY} ${
        gridSize / 2
      }; color: ${gridColor}`
    );
    gridContainer.appendChild(lineX);

    // Lines parallel to X axis
    const lineZ = document.createElement("a-entity");
    lineZ.setAttribute(
      "line",
      `start: ${-gridSize / 2} ${floorY} ${i}; end: ${
        gridSize / 2
      } ${floorY} ${i}; color: ${gridColor}`
    );
    gridContainer.appendChild(lineZ);
  }

  // Sub-grid lines (0.5-meter intervals)
  for (let i = -gridSize / 2; i <= gridSize / 2; i += 0.5) {
    // Avoid re-drawing main lines
    if (i % 1 === 0) continue;

    const subLineX = document.createElement("a-entity");
    subLineX.setAttribute(
      "line",
      `start: ${i} ${floorY} ${-gridSize / 2}; end: ${i} ${floorY} ${
        gridSize / 2
      }; color: ${subGridColor}`
    );
    gridContainer.appendChild(subLineX);

    const subLineZ = document.createElement("a-entity");
    subLineZ.setAttribute(
      "line",
      `start: ${-gridSize / 2} ${floorY} ${i}; end: ${
        gridSize / 2
      } ${floorY} ${i}; color: ${subGridColor}`
    );
    gridContainer.appendChild(subLineZ);
  }

  // Add stronger center lines (X and Z axes)
  const centerLineX = document.createElement("a-entity");
  centerLineX.setAttribute(
    "line",
    `start: 0 ${floorY} ${-gridSize / 2}; end: 0 ${floorY} ${
      gridSize / 2
    }; color: #ff5555; opacity: 0.9`
  );
  gridContainer.appendChild(centerLineX);

  const centerLineZ = document.createElement("a-entity");
  centerLineZ.setAttribute(
    "line",
    `start: ${-gridSize / 2} ${floorY} 0; end: ${
      gridSize / 2
    } ${floorY} 0; color: #55ff55; opacity: 0.9`
  );
  gridContainer.appendChild(centerLineZ);

  console.log("✓ Centered and consistent Blender-style grid created");
}

// Create a subtle grid helper for better spatial awareness
function createGridHelper(roomWidth, roomLength) {
  const gridContainer = document.getElementById("grid-helper");
  gridContainer.innerHTML = "";

  const gridSize = 0.5; // 50cm grid squares
  const gridColor = "#e0e0e0";
  const gridOpacity = 0.3;

  // Create grid lines along width
  for (let x = -roomWidth / 2; x <= roomWidth / 2; x += gridSize) {
    const line = document.createElement("a-box");
    line.setAttribute("position", `${x} 0.001 0`);
    line.setAttribute("width", "0.02");
    line.setAttribute("height", "0.001");
    line.setAttribute("depth", roomLength);
    line.setAttribute("color", gridColor);
    line.setAttribute("opacity", gridOpacity);
    gridContainer.appendChild(line);
  }

  // Create grid lines along length
  for (let z = -roomLength / 2; z <= roomLength / 2; z += gridSize) {
    const line = document.createElement("a-box");
    line.setAttribute("position", `0 0.001 ${z}`);
    line.setAttribute("width", roomWidth);
    line.setAttribute("height", "0.001");
    line.setAttribute("depth", "0.02");
    line.setAttribute("color", gridColor);
    line.setAttribute("opacity", gridOpacity);
    gridContainer.appendChild(line);
  }
}
