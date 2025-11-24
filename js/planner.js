let draggedItem = null;
let furnitureCounter = 0;
let panelOpen = false;
let selectedFurniture = null; // Track currently selected furniture

// Register wall outline component
AFRAME.registerComponent("wall-outline", {
  init: function () {
    const el = this.el;
    const w = parseFloat(el.getAttribute("width"));
    const h = parseFloat(el.getAttribute("height"));
    const d = parseFloat(el.getAttribute("depth"));

    const geometry = new THREE.BoxGeometry(w, h, d);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({ color: 0x000000 });
    const line = new THREE.LineSegments(edges, material);
    line.name = "outline";
    el.object3D.add(line);
  },
});

// Items and prices loaded from Supabase
let ITEMS_DATA = {}; // model_key -> {id, name, category, model_file_path}
let PRICE_LIST = {}; // model_key -> estimated_price
let ITEM_METADATA = {}; // model_key -> {name, model_file_path}
let ITEM_PRICE_SOURCES = {}; // model_key -> [{store, price}]

// Supabase timeout configuration (in milliseconds)
const SUPABASE_TIMEOUT = 10000; // 10 seconds
const MODEL_LOAD_TIMEOUT = 30000; // 30 seconds for model files

const STORAGE_MODEL_FILES = {
  table1: "table1.obj",
  center_table1: "center_table1.obj",
  center_table2: "center_table2.obj",
  wardrobe1: "wardrobe_modern.obj",
  wardrobe2: "wardrobe_traditional.obj",
  wardrobe3: "wardrobe_openframe.obj",
  bed1: "bed1.obj",
  bed2: "bed2.obj",
  chair1: "chair1.obj",
  chair2: "chair2.obj",
  desk1: "desk1.obj",
  desk2: "desk2.obj",
  mirror1: "mirror1.obj",
  mirror2: "mirror2.obj",
  shelf1: "shelf1.obj",
  shelf2: "shelf2.obj",
};

/**
 * Get thumbnail image path for a model key
 * @param {string} modelKey - Model key
 * @returns {string} - Image path
 */
function getThumbnailPath(modelKey) {
  const thumbnailMap = {
    center_table1: "asset/images/thumbnails/center_table1.jpg",
    center_table2: "asset/images/thumbnails/center_table2.jpg",
    wardrobe1: "asset/images/thumbnails/wardrobe1.jpg",
    wardrobe2: "asset/images/thumbnails/wardrobe2.jpg",
    wardrobe3: "asset/images/thumbnails/wardrobe3.jpg",
    bed1: "asset/images/thumbnails/bed1.jpg",
    bed2: "asset/images/thumbnails/bed2.jpg",
    chair1: "asset/images/thumbnails/chair1.jpg",
    chair2: "asset/images/thumbnails/chair2.jpg",
    desk1: "asset/images/thumbnails/desk1.jpg",
    desk2: "asset/images/thumbnails/desk2.jpg",
    mirror1: "asset/images/thumbnails/mirror1.jpg",
    mirror2: "asset/images/thumbnails/mirror2.jpg",
    shelf1: "asset/images/thumbnails/shelf1.jpg",
    shelf2: "asset/images/thumbnails/shelf2.jpg",
    // Category fallbacks
    "center-table": "asset/images/thumbnails/center_table1.jpg",
    "chair": "asset/images/thumbnails/chair1.jpg",
    "bed": "asset/images/thumbnails/bed1.jpg",
    "wardrobe": "asset/images/thumbnails/wardrobe1.jpg",
    "desk": "asset/images/thumbnails/desk1.jpg",
    "mirror": "asset/images/thumbnails/mirror1.jpg",
    "shelf": "asset/images/thumbnails/shelf1.jpg",
  };
  
  return thumbnailMap[modelKey] || "asset/images/thumbnails/default.jpg";
}

const STORAGE_BUCKET_FILES = new Set([
  "wardrobe_modern.obj",
  "wardrobe_traditional.obj",
  "wardrobe_openframe.obj",
  "center_table1.obj",
  "center_table2.obj",
]);

const FALLBACK_ITEM_NAMES = {
  center_table1: "Center Table 1",
  center_table2: "Center Table 2",
  wardrobe1: "Wardrobe Modern",
  wardrobe2: "Wardrobe Traditional",
  wardrobe3: "Wardrobe Open Frame",
  table1: "Center Table",
  bed1: "Bed 1",
  bed2: "Bed 2",
  chair1: "Chair 1",
  chair2: "Chair 2",
  desk1: "Desk 1",
  desk2: "Desk 2",
  mirror1: "Mirror 1",
  mirror2: "Mirror 2",
  shelf1: "Shelf 1",
  shelf2: "Shelf 2",
};

const FALLBACK_ITEM_METADATA = {
  center_table1: {
    name: "Center Table 1",
    model_file_path: "center_table1.obj",
  },
  center_table2: {
    name: "Center Table 2",
    model_file_path: "center_table2.obj",
  },
  bed1: {
    name: "Bed 1",
    model_file_path: "bed1.obj",
  },
  bed2: {
    name: "Bed 2",
    model_file_path: "bed2.obj",
  },
  chair1: {
    name: "Chair 1",
    model_file_path: "chair1.obj",
  },
  chair2: {
    name: "Chair 2",
    model_file_path: "chair2.obj",
  },
  desk1: {
    name: "Desk 1",
    model_file_path: "desk1.obj",
  },
  desk2: {
    name: "Desk 2",
    model_file_path: "desk2.obj",
  },
  mirror1: {
    name: "Mirror 1",
    model_file_path: "mirror1.obj",
  },
  mirror2: {
    name: "Mirror 2",
    model_file_path: "mirror2.obj",
  },
  shelf1: {
    name: "Shelf 1",
    model_file_path: "shelf1.obj",
  },
  shelf2: {
    name: "Shelf 2",
    model_file_path: "shelf2.obj",
  },
};

// Dummy prices for all items (used when Supabase fails or no price available)
const DUMMY_PRICES = {
  // Tables
  table1: {
    estimatedPrice: 8500,
    sources: [
      { store: "Default Store", price: 8500 }
    ]
  },
  center_table1: {
    estimatedPrice: 12000,
    sources: [
      { store: "All-Home", price: 11500 },
      { store: "Wilcon Depot", price: 12500 },
      { store: "Gaisano", price: 12000 }
    ]
  },
  center_table2: {
    estimatedPrice: 15000,
    sources: [
      { store: "All-Home", price: 14500 },
      { store: "Wilcon Depot", price: 15500 },
      { store: "Gaisano", price: 15000 }
    ]
  },
  // Wardrobes
  wardrobe1: {
    estimatedPrice: 11950,
    sources: [
      { store: "All-Home", price: 11500 },
      { store: "Wilcon Depot", price: 12500 },
      { store: "Gaisano", price: 12000 },
      { store: "Local suppliers", price: 11800 }
    ]
  },
  wardrobe2: {
    estimatedPrice: 14950,
    sources: [
      { store: "All-Home", price: 14500 },
      { store: "Wilcon Depot", price: 15500 },
      { store: "Gaisano", price: 15000 },
      { store: "Local suppliers", price: 14800 }
    ]
  },
  wardrobe3: {
    estimatedPrice: 17950,
    sources: [
      { store: "All-Home", price: 17500 },
      { store: "Wilcon Depot", price: 18500 },
      { store: "Gaisano", price: 18000 },
      { store: "Local suppliers", price: 17800 }
    ]
  },
  // Beds
  bed1: {
    estimatedPrice: 25000,
    sources: [
      { store: "All-Home", price: 24000 },
      { store: "Wilcon Depot", price: 26000 },
      { store: "Gaisano", price: 25000 }
    ]
  },
  bed2: {
    estimatedPrice: 30000,
    sources: [
      { store: "All-Home", price: 29000 },
      { store: "Wilcon Depot", price: 31000 },
      { store: "Gaisano", price: 30000 }
    ]
  },
  // Chairs
  chair1: {
    estimatedPrice: 3500,
    sources: [
      { store: "All-Home", price: 3400 },
      { store: "Wilcon Depot", price: 3600 },
      { store: "Gaisano", price: 3500 }
    ]
  },
  chair2: {
    estimatedPrice: 4500,
    sources: [
      { store: "All-Home", price: 4400 },
      { store: "Wilcon Depot", price: 4600 },
      { store: "Gaisano", price: 4500 }
    ]
  },
  // Desks
  desk1: {
    estimatedPrice: 18000,
    sources: [
      { store: "All-Home", price: 17500 },
      { store: "Wilcon Depot", price: 18500 },
      { store: "Gaisano", price: 18000 }
    ]
  },
  desk2: {
    estimatedPrice: 22000,
    sources: [
      { store: "All-Home", price: 21500 },
      { store: "Wilcon Depot", price: 22500 },
      { store: "Gaisano", price: 22000 }
    ]
  },
  // Mirrors
  mirror1: {
    estimatedPrice: 5500,
    sources: [
      { store: "All-Home", price: 5400 },
      { store: "Wilcon Depot", price: 5600 },
      { store: "Gaisano", price: 5500 }
    ]
  },
  mirror2: {
    estimatedPrice: 7500,
    sources: [
      { store: "All-Home", price: 7400 },
      { store: "Wilcon Depot", price: 7600 },
      { store: "Gaisano", price: 7500 }
    ]
  },
  // Shelves
  shelf1: {
    estimatedPrice: 8000,
    sources: [
      { store: "All-Home", price: 7800 },
      { store: "Wilcon Depot", price: 8200 },
      { store: "Gaisano", price: 8000 }
    ]
  },
  shelf2: {
    estimatedPrice: 10000,
    sources: [
      { store: "All-Home", price: 9800 },
      { store: "Wilcon Depot", price: 10200 },
      { store: "Gaisano", price: 10000 }
    ]
  },
};

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects after timeout
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms);
  });
}

/**
 * Fetch with timeout wrapper
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} - Promise with timeout
 */
async function withTimeout(promise, timeoutMs) {
  return Promise.race([promise, createTimeout(timeoutMs)]);
}

/**
 * Calculate estimated price from prices array using arithmetic mean
 * @param {Array<number>} prices - Array of prices
 * @returns {number} - Estimated price
 */
function calculateEstimatedPrice(prices) {
  if (!prices || prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return Math.round((sum / prices.length) * 100) / 100;
}

/**
 * Load items and prices from Supabase with fallbacks
 */
async function loadItemsAndPrices() {
  let useFallbacks = false;
  
  try {
    ITEMS_DATA = {};
    PRICE_LIST = {};
    ITEM_METADATA = {};
    ITEM_PRICE_SOURCES = {};

    // Fetch all items with timeout
    let items = [];
    let itemsError = null;
    
    try {
      const itemsPromise = supabase.from("items").select("*");
      const result = await withTimeout(itemsPromise, SUPABASE_TIMEOUT);
      items = result.data || [];
      itemsError = result.error;
    } catch (timeoutError) {
      console.warn("Items fetch timed out, using fallbacks:", timeoutError);
      itemsError = timeoutError;
      useFallbacks = true;
    }

    if (itemsError || !items || items.length === 0) {
      console.warn("Error fetching items or no items found, using fallbacks:", itemsError);
      useFallbacks = true;
    } else {
      // Store items by model_key
      items.forEach((item) => {
        ITEMS_DATA[item.model_key] = item;
        ITEM_METADATA[item.model_key] = {
          name: item.name,
          model_file_path:
            item.model_file_path || STORAGE_MODEL_FILES[item.model_key] || null,
        };
      });
    }

    // Apply fallback metadata for all known models
    Object.keys(STORAGE_MODEL_FILES).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = {
          name: FALLBACK_ITEM_NAMES[key] || key,
          model_file_path: STORAGE_MODEL_FILES[key] || null,
        };
      }
    });
    Object.keys(FALLBACK_ITEM_METADATA).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = { ...FALLBACK_ITEM_METADATA[key] };
      }
    });

    // Fetch all prices with timeout
    let prices = [];
    let pricesError = null;
    
    try {
      const pricesPromise = supabase.from("item_prices").select("*, items(model_key)");
      const result = await withTimeout(pricesPromise, SUPABASE_TIMEOUT);
      prices = result.data || [];
      pricesError = result.error;
    } catch (timeoutError) {
      console.warn("Prices fetch timed out, using fallbacks:", timeoutError);
      pricesError = timeoutError;
      useFallbacks = true;
    }

    if (!pricesError && prices && prices.length > 0) {
      // Organize prices by model_key and calculate estimated prices
      const pricesByModel = {};
      prices.forEach((price) => {
        const modelKey =
          price.items?.model_key ||
          (Array.isArray(price.items) && price.items[0]?.model_key) ||
          null;

        if (!modelKey) {
          console.warn("Price record missing model_key:", price);
          return;
        }

        if (!pricesByModel[modelKey]) {
          pricesByModel[modelKey] = [];
        }
        pricesByModel[modelKey].push(price.price);

        if (!ITEM_PRICE_SOURCES[modelKey]) {
          ITEM_PRICE_SOURCES[modelKey] = [];
        }
        ITEM_PRICE_SOURCES[modelKey].push({
          store: price.store_name,
          price: price.price,
        });
      });

      // Calculate estimated prices
      Object.keys(pricesByModel).forEach((modelKey) => {
        PRICE_LIST[modelKey] = calculateEstimatedPrice(pricesByModel[modelKey]);
      });
    }

    // Apply dummy prices for items without prices or if using fallbacks
    Object.keys(ITEM_METADATA).forEach((key) => {
      if (typeof PRICE_LIST[key] === "undefined" || PRICE_LIST[key] === 0 || useFallbacks) {
        // Use dummy price if available, otherwise default to 0
        if (DUMMY_PRICES[key]) {
          PRICE_LIST[key] = DUMMY_PRICES[key].estimatedPrice;
          // Only set sources if we don't have any from database
          if (!ITEM_PRICE_SOURCES[key] || ITEM_PRICE_SOURCES[key].length === 0) {
            ITEM_PRICE_SOURCES[key] = [...DUMMY_PRICES[key].sources];
          }
        } else {
          PRICE_LIST[key] = 0;
        }
      }
      // Ensure sources array exists
      if (!ITEM_PRICE_SOURCES[key]) {
        ITEM_PRICE_SOURCES[key] = [];
      }
    });

    if (useFallbacks) {
      console.info("Using fallback data (dummy prices and metadata) due to Supabase issues");
    }
  } catch (error) {
    console.error("Error loading items and prices, using fallbacks:", error);
    // Apply all fallbacks on error
    Object.keys(STORAGE_MODEL_FILES).forEach((key) => {
      if (!ITEM_METADATA[key]) {
        ITEM_METADATA[key] = {
          name: FALLBACK_ITEM_NAMES[key] || key,
          model_file_path: STORAGE_MODEL_FILES[key] || null,
        };
      }
      if (typeof PRICE_LIST[key] === "undefined" || PRICE_LIST[key] === 0) {
        if (DUMMY_PRICES[key]) {
          PRICE_LIST[key] = DUMMY_PRICES[key].estimatedPrice;
          ITEM_PRICE_SOURCES[key] = [...DUMMY_PRICES[key].sources];
        } else {
          PRICE_LIST[key] = 0;
          ITEM_PRICE_SOURCES[key] = [];
        }
      }
    });
  }
}

/**
 * Get model file URL from Supabase Storage or local path with fallbacks
 * @param {string} modelKey - Model key (e.g., 'wardrobe1', 'table1')
 * @returns {string} - Model file URL
 */
function getModelUrl(modelKey) {
  const metadata = ITEM_METADATA[modelKey];
  const fallbackFile = STORAGE_MODEL_FILES[modelKey];
  const filePath = metadata?.model_file_path || fallbackFile;

  if (!filePath) {
    // Try to get from model analyzer if available
    if (typeof getLocalModelPath === 'function') {
      return getLocalModelPath(modelKey);
    }
    // Final fallback
    return `asset/models/${modelKey}.obj`;
  }

  // Check if file is stored in Supabase bucket
  if (STORAGE_BUCKET_FILES.has(filePath)) {
    try {
      // Get public URL from Supabase Storage with timeout
      const { data } = supabase.storage
        .from("wardrobe-models")
        .getPublicUrl(filePath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } catch (error) {
      console.warn(`Failed to get Supabase Storage URL for ${filePath}, using local fallback:`, error);
    }
  }

  // Fallback to local path in asset/models folder
  return `asset/models/${filePath}`;
}

/**
 * Get item name from metadata
 * @param {string} modelKey - Model key
 * @returns {string} - Item display name
 */
function getItemName(modelKey) {
  return (
    ITEM_METADATA[modelKey]?.name || FALLBACK_ITEM_NAMES[modelKey] || modelKey
  );
}

const costState = {
  items: {}, // key -> {name, price, qty, unitCost}
  total: 0,
};

// Initialize the room with dimensions from localStorage
function initializeRoom() {
  const width = localStorage.getItem("roomWidth");
  const length = localStorage.getItem("roomLength");
  const height = localStorage.getItem("roomHeight");

  if (!width || !length) {
    // Don't redirect, just show dialog
    showDialog(
      "No room dimensions found. Please set room dimensions using the Resize Dimension button.",
      "Setup Required"
    );
    return;
  }

  // Convert m to A-Frame units (1:1 ratio)
  const aframeWidth = parseFloat(width);
  const aframeLength = parseFloat(length);
  const wallHeight = height ? parseFloat(height) : 3; // Default to 3m if not set

  // Update floor size
  const floor = document.getElementById("floor");
  if (floor) {
    floor.setAttribute("width", aframeWidth);
    floor.setAttribute("depth", aframeLength);
    floor.setAttribute("height", 0.1);
  }

  // Create room walls with height
  createRoomWalls(aframeWidth, aframeLength, wallHeight);

  // Add Blender-like grid
  createBlenderGrid();

  // Update room info
  const roomInfo = document.getElementById("room-info");
  if (roomInfo) {
    const heightText = height ? ` × ${height}M` : "";
    roomInfo.innerHTML = `<strong>Room:</strong> ${width}M × ${length}M${heightText}`;
  }

  // Position camera appropriately
  const cameraRig = document.getElementById("cameraRig");
  if (cameraRig) {
    const cameraDistance = Math.max(aframeWidth, aframeLength) * 0.8;
    cameraRig.setAttribute("position", `0 2.6 ${cameraDistance + 4}`);
  }

  // Wait for scene to be ready, then initialize drag and drop
  const scene = document.querySelector("a-scene");
  if (scene) {
    if (scene.hasLoaded) {
      initializeDragAndDrop();
    } else {
      scene.addEventListener("loaded", initializeDragAndDrop);
    }
  }

  // Show drop indicator initially (only if no furniture has been placed yet)
  setTimeout(() => {
    const furnitureContainer = document.getElementById("furniture-container");
    const hasFurniture =
      furnitureContainer && furnitureContainer.children.length > 0;
    const dropIndicator = document.getElementById("drop-indicator");
    if (!hasFurniture && dropIndicator) {
      dropIndicator.classList.add("show");
    }
  }, 500);
}

function createRoomWalls(width, length, wallHeight = 3) {
  const wallsContainer = document.getElementById("room-walls");
  if (!wallsContainer) return;

  const wallThickness = 0.1;
  wallsContainer.innerHTML = "";

  // Create walls with better materials
  const walls = [
    {
      pos: `0 ${wallHeight / 2} ${-length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
    },
    {
      pos: `0 ${wallHeight / 2} ${length / 2}`,
      size: `${width} ${wallHeight} ${wallThickness}`,
    },
    {
      pos: `${-width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
    },
    {
      pos: `${width / 2} ${wallHeight / 2} 0`,
      size: `${wallThickness} ${wallHeight} ${length}`,
    },
    // Roof
    {
      pos: `0 ${wallHeight} 0`,
      size: `${width} 0.1 ${length}`,
    },
  ];

  walls.forEach((wall, i) => {
    const wallEl = document.createElement("a-box");
    wallEl.setAttribute("position", wall.pos);
    const [w, h, d] = wall.size.split(" ");
    wallEl.setAttribute("width", w);
    wallEl.setAttribute("height", h);
    wallEl.setAttribute("depth", d);
    // Removed separate color attribute to avoid conflicts
    // Removed transparent: true to fix visual glitches
    wallEl.setAttribute(
      "material",
      "color: #9d9d9d; roughness: 0.1; metalness: 0.5; envMapIntensity: 1.0"
    );
    wallEl.setAttribute("shadow", "cast: true; receive: true");
    wallEl.setAttribute("class", "room-wall");
    wallEl.setAttribute("data-wall-index", i);
    wallEl.setAttribute("wall-outline", "");
    wallsContainer.appendChild(wallEl);
  });

  // Start wall visibility update loop
  startWallVisibilityUpdater();

  // Grid helper removed
}

/**
 * Update wall visibility based on camera position
 * Uses raycasting to hide walls that block the view of the room center
 */
function updateWallVisibility() {
  const cameraRig = document.getElementById("cameraRig");
  const walls = Array.from(document.querySelectorAll(".room-wall"));

  if (!cameraRig || walls.length === 0) return;

  const cameraPos = new THREE.Vector3();
  cameraRig.object3D.getWorldPosition(cameraPos);

  // Target the center of the room (slightly elevated)
  const target = new THREE.Vector3(0, 1.5, 0);

  // Check if camera is inside the room
  const roomWidth = parseFloat(localStorage.getItem("roomWidth")) || 10;
  const roomLength = parseFloat(localStorage.getItem("roomLength")) || 10;

  // Get room height from roof position (index 4) or default to 3
  let roomHeight = 3;
  const roof = walls.find((w) => w.getAttribute("data-wall-index") === "4");
  if (roof) {
    const pos = roof.getAttribute("position");
    if (pos) roomHeight = parseFloat(pos.y);
  }

  const margin = 0.1; // Small margin

  const isInside =
    cameraPos.x >= -roomWidth / 2 + margin &&
    cameraPos.x <= roomWidth / 2 - margin &&
    cameraPos.z >= -roomLength / 2 + margin &&
    cameraPos.z <= roomLength / 2 - margin &&
    cameraPos.y < roomHeight; // Must be below the roof

  if (isInside) {
    // Show all walls if inside, but hide ceiling when inside looking up
    walls.forEach((wall) => {
      const wallIndex = wall.getAttribute("data-wall-index");
      const isRoof = wallIndex === "4"; // Roof/ceiling is at index 4
      
      if (isRoof) {
        // Hide ceiling when inside the room (prevents blocking view when looking up or transitioning from above)
        wall.setAttribute("material", "transparent", true);
        wall.setAttribute("material", "opacity", 0.0);
        const outline = wall.object3D.getObjectByName("outline");
        if (outline) outline.visible = false;
      } else {
        // Show other walls normally
        wall.setAttribute("material", "opacity", 1.0);
      }
    });
    return;
  }

  // Raycast from camera to center
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3()
    .subVectors(target, cameraPos)
    .normalize();
  raycaster.set(cameraPos, direction);

  // Get meshes from a-box entities
  const meshes = walls.map((w) => w.getObject3D("mesh")).filter((m) => m);

  // Intersect
  const intersects = raycaster.intersectObjects(meshes);

  // Identify walls to hide
  // Hide any wall that the ray passes through before reaching the center
  const distToCenter = cameraPos.distanceTo(target);
  const hiddenMeshes = new Set();

  intersects.forEach((hit) => {
    if (hit.distance < distToCenter) {
      hiddenMeshes.add(hit.object);
    }
  });

  // Check if camera is above the room (top view)
  const isAboveRoom = cameraPos.y > roomHeight + 0.5; // Add small margin for top view detection
  
  // Update opacity
  walls.forEach((wall) => {
    const mesh = wall.getObject3D("mesh");
    const outline = wall.object3D.getObjectByName("outline");
    const wallIndex = wall.getAttribute("data-wall-index");
    const isRoof = wallIndex === "4"; // Roof/ceiling is at index 4

    // Always hide ceiling when viewing from above
    if (isRoof && isAboveRoom) {
      wall.setAttribute("material", "transparent", true);
      wall.setAttribute("material", "opacity", 0.0);
      if (outline) outline.visible = false;
      return;
    }

    // If this wall's mesh was hit, hide it. Otherwise show it.
    if (mesh && hiddenMeshes.has(mesh)) {
      // Enable transparency only when hiding to avoid z-sorting glitches when visible
      wall.setAttribute("material", "transparent", true);
      wall.setAttribute("material", "opacity", 0.0);
      if (outline) outline.visible = false;
    } else {
      // Disable transparency when visible for solid rendering
      wall.setAttribute("material", "transparent", false);
      wall.setAttribute("material", "opacity", 1.0);
      if (outline) outline.visible = true;
    }
  });
}

/**
 * Start the wall visibility updater loop
 */
function startWallVisibilityUpdater() {
  // Update wall visibility every frame for smooth transitions
  const scene = document.querySelector("a-scene");
  if (scene) {
    if (scene.hasLoaded) {
      setInterval(updateWallVisibility, 100);
    } else {
      scene.addEventListener("loaded", () => {
        setInterval(updateWallVisibility, 100);
      });
    }
  }
}

function createBlenderGrid() {
  const scene = document.querySelector("a-scene");
  if (!scene || !scene.object3D) return;

  // Remove existing grid if any
  const existingGrid = scene.object3D.getObjectByName("blender-grid");
  if (existingGrid) {
    scene.object3D.remove(existingGrid);
  }

  // Create a large grid
  const size = 200;
  const divisions = 200;
  const colorCenterLine = 0x22ff00;
  const colorGrid = 0xb1b3b1;

  const gridHelper = new THREE.GridHelper(
    size,
    divisions,
    colorCenterLine,
    colorGrid
  );
  gridHelper.name = "blender-grid";
  gridHelper.position.y = -0.1; // Lowered further to prevent z-fighting with floor

  scene.object3D.add(gridHelper);
}

function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById("side-panel");
  const toggle = document.getElementById("panel-toggle");
  const resizePanel = document.getElementById("resize-dimension-panel");

  if (panelOpen) {
    // Close resize panel if open
    if (resizePanel) {
      resizePanel.classList.remove("open");
    }
    // Show main panel
    if (panel) {
      panel.classList.add("open");
    }
    if (toggle) {
      toggle.innerHTML = "✕";
      toggle.style.left = "310px";
    }
  } else {
    if (panel) {
      panel.classList.remove("open");
    }
    if (toggle) {
      toggle.innerHTML = "📦";
      toggle.style.left = "20px";
    }
    // Hide resize panel if open
    if (resizePanel) {
      resizePanel.classList.remove("open");
    }
  }
}

function handleDropIndicatorClick(e) {
  // Prevent click during active drag operations
  if (draggedItem) {
    return;
  }

  // Prevent event propagation to avoid interfering with drag and drop
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  // Open the side panel when drop indicator is clicked
  if (!panelOpen) {
    togglePanel();
  }
  // Hide the drop indicator after clicking (user can see the panel now)
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.classList.remove("show");
  }
}

function showResizeDimensionPanel() {
  const sidePanel = document.getElementById("side-panel");
  const resizePanel = document.getElementById("resize-dimension-panel");

  if (!sidePanel || !resizePanel) return;

  // Store original content if not already stored
  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Hide main side panel
  sidePanel.classList.remove("open");

  // Show resize dimension panel
  resizePanel.classList.add("open");

  // Load current dimensions if available
  const width = localStorage.getItem("roomWidth") || "";
  const length = localStorage.getItem("roomLength") || "";
  const height = localStorage.getItem("roomHeight") || "";

  const widthInput = document.getElementById("room-width-input");
  const lengthInput = document.getElementById("room-length-input");
  const heightInput = document.getElementById("room-height-input");

  if (widthInput) widthInput.value = width;
  if (lengthInput) lengthInput.value = length;
  if (heightInput) heightInput.value = height;
}

function saveRoomDimensions() {
  const widthInput = document.getElementById("room-width-input");
  const lengthInput = document.getElementById("room-length-input");
  const heightInput = document.getElementById("room-height-input");

  const width = parseFloat(widthInput?.value);
  const length = parseFloat(lengthInput?.value);
  const height = parseFloat(heightInput?.value);

  if (!width || !length || width <= 0 || length <= 0) {
    showDialog(
      "Please enter valid width and length values (greater than 0).",
      "Invalid Dimensions"
    );
    return;
  }

  // Save to localStorage
  localStorage.setItem("roomWidth", width.toString());
  localStorage.setItem("roomLength", length.toString());
  if (height && height > 0) {
    localStorage.setItem("roomHeight", height.toString());
  }

  // Update room
  initializeRoom();

  // Check all furniture items against new boundaries
  checkFurnitureBoundaries(width, length);

  // Close resize panel and show main panel
  const resizePanel = document.getElementById("resize-dimension-panel");
  const sidePanel = document.getElementById("side-panel");

  if (resizePanel) resizePanel.classList.remove("open");
  if (sidePanel) sidePanel.classList.add("open");

  showDialog("Room dimensions updated successfully!", "Success");
}

/**
 * Check all furniture items against room boundaries and mark as red if outside
 */
function checkFurnitureBoundaries(roomWidth, roomLength) {
  const furnitureContainer = document.getElementById("furniture-container");
  if (!furnitureContainer) return;

  const furnitureItems =
    furnitureContainer.querySelectorAll('[id^="furniture-"]');
  const wallThickness = 0.1;

  furnitureItems.forEach((furniture) => {
    const draggableComponent = furniture.components["draggable-furniture"];
    if (!draggableComponent) return;

    // Update draggable component with new dimensions
    furniture.setAttribute("draggable-furniture", {
      roomWidth: roomWidth,
      roomLength: roomLength,
      objectWidth: draggableComponent.data.objectWidth || 1.5,
      objectLength: draggableComponent.data.objectLength || 1.5,
      wallThickness: wallThickness,
    });

    // Get current position
    const position = furniture.object3D.position;

    // Check if outside boundaries
    const isOutside = isFurnitureOutsideBoundaries(
      position,
      roomWidth,
      roomLength,
      draggableComponent.data.objectWidth || 1.5,
      draggableComponent.data.objectLength || 1.5,
      wallThickness
    );

    // Update color based on boundary status
    if (isOutside) {
      furniture.setAttribute("material", "color", "#FF6B6B");
      furniture.setAttribute("material", "emissive", "#8B0000");
      furniture.setAttribute("material", "emissiveIntensity", "0.25");
    } else {
      // Check if near walls (using existing collision logic)
      if (
        draggableComponent.isColliding &&
        draggableComponent.isColliding(position)
      ) {
        furniture.setAttribute("material", "color", "#FF6B6B");
        furniture.setAttribute("material", "emissive", "#8B0000");
        furniture.setAttribute("material", "emissiveIntensity", "0.25");
      } else {
        // Restore original color
        const clickableComponent = furniture.components["clickable-furniture"];
        if (clickableComponent && clickableComponent.originalColor) {
          furniture.setAttribute(
            "material",
            "color",
            clickableComponent.originalColor
          );
        } else {
          furniture.setAttribute("material", "color", "#FF8C00");
        }
        furniture.setAttribute("material", "emissive", "#000000");
        furniture.setAttribute("material", "emissiveIntensity", "0");
      }
    }
  });
}

/**
 * Check if furniture position is outside room boundaries
 */
function isFurnitureOutsideBoundaries(
  position,
  roomWidth,
  roomLength,
  objWidth,
  objLength,
  wallThickness
) {
  const innerX = roomWidth / 2 - wallThickness / 2;
  const innerZ = roomLength / 2 - wallThickness / 2;
  const safeXMin = -innerX + objWidth / 2;
  const safeXMax = innerX - objWidth / 2;
  const safeZMin = -innerZ + objLength / 2;
  const safeZMax = innerZ - objLength / 2;

  return (
    position.x < safeXMin ||
    position.x > safeXMax ||
    position.z < safeZMin ||
    position.z > safeZMax
  );
}

function toggleCostPanel() {
  const costPanel = document.getElementById("cost-panel");
  if (!costPanel) return;

  costPanel.classList.toggle("collapsed");
}

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

  // Drop indicator drop events (allow dropping on the indicator itself)
  if (dropIndicator) {
    dropIndicator.addEventListener("dragover", handleDragOver);
    dropIndicator.addEventListener("drop", handleDrop);
    dropIndicator.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dropIndicator.classList.add("show");
    });
    dropIndicator.addEventListener("dragleave", function (e) {
      if (!dropIndicator.contains(e.relatedTarget)) {
        dropIndicator.classList.remove("show");
      }
    });
  }
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

  // Create placeholder box that shows immediately while model loads
  const placeholderEl = document.createElement("a-box");
  placeholderEl.setAttribute("width", "1.5");
  placeholderEl.setAttribute("height", "0.8");
  placeholderEl.setAttribute("depth", "1.5");
  placeholderEl.setAttribute("color", "#FF8C00");
  placeholderEl.setAttribute("opacity", "0.7");
  placeholderEl.setAttribute("visible", "true");
  placeholderEl.id = `${furnitureEl.id}-placeholder`;
  furnitureEl.appendChild(placeholderEl);

  // Add to scene FIRST so A-Frame can initialize it immediately
  const furnitureContainer = document.getElementById("furniture-container");
  furnitureContainer.appendChild(furnitureEl);

  // Force A-Frame to flush the entity to DOM immediately
  if (furnitureEl.flushToDOM) {
    furnitureEl.flushToDOM();
  }
  
  // Ensure placeholder is visible regardless of camera position
  furnitureEl.setAttribute("visible", "true");

  // Now set remaining attributes after entity is in the scene
  // Get model URL from Supabase Storage or local path
  const modelUrl = getModelUrl(draggedItem.model);
  furnitureEl.setAttribute("obj-model", `obj: url(${modelUrl})`);
  furnitureEl.setAttribute("scale", draggedItem.scale);
  furnitureEl.setAttribute(
    "draggable-furniture",
    `roomWidth: ${roomWidth}; roomLength: ${roomLength}; objectWidth: 1.5; objectLength: 1.5; wallThickness: 0.1`
  );
  
  // Check if item should be wall-mounted (mirrors and shelves)
  const isWallMounted = draggedItem.model.startsWith('mirror') || draggedItem.model.startsWith('shelf');
  if (isWallMounted) {
    // Get wall height from localStorage or use default
    const savedHeight = localStorage.getItem("roomHeight");
    const roomWallHeight = savedHeight ? parseFloat(savedHeight) : 3;
    const initialHeight = 1.5; // Initial placement height on wall
    
    const innerZ = roomLength / 2 - 0.1 / 2;
    const snapZ = -innerZ + 0.05;
    
    // Add slight offset to prevent all items stacking at same position
    const existingItems = document.querySelectorAll('[wall-mounted]');
    const offsetX = existingItems.length * 0.5; // Offset each item by 0.5 units
    
    // Position on front wall with offset
    furnitureEl.setAttribute('position', {
      x: Math.max(-roomWidth/2 + 1, Math.min(roomWidth/2 - 1, offsetX)),
      y: initialHeight,
      z: snapZ
    });
    
    // Add wall-mounted component with wallHeight parameter
    furnitureEl.setAttribute(
      "wall-mounted",
      `roomWidth: ${roomWidth}; roomLength: ${roomLength}; wallThickness: 0.1; wallHeight: ${roomWallHeight}; snapDistance: 0.2`
    );
    
    // Initialize wall-mounted component's current wall after component is added
    setTimeout(() => {
      const wallMountedComp = furnitureEl.components['wall-mounted'];
      if (wallMountedComp) {
        wallMountedComp.currentWall = 'front';
        // Ensure position is properly constrained (including Y based on object height)
        const currentPos = furnitureEl.object3D.position;
        const result = wallMountedComp.constrainToWall(currentPos, 'front');
        furnitureEl.setAttribute('position', result.position);
      }
    }, 150);
  }
  
  furnitureEl.setAttribute("clickable-furniture", "");
  furnitureEl.setAttribute("material", "color: #FF8C00"); // Orange color for table
  // Store model key as data attribute for easy retrieval during deletion
  furnitureEl.setAttribute("data-model-key", draggedItem.model);

  // Set up model loading timeout and error handling
  let modelLoadTimeout;
  let modelLoaded = false;

  // Listen for model-loaded event to hide placeholder
  const onModelLoaded = function () {
    if (modelLoaded) return; // Prevent duplicate calls
    modelLoaded = true;
    clearTimeout(modelLoadTimeout);
    
    const placeholder = furnitureEl.querySelector(
      `#${furnitureEl.id}-placeholder`
    );
    if (placeholder) {
      placeholder.remove();
    }
  };

  furnitureEl.addEventListener("model-loaded", onModelLoaded);

  // Set timeout for model loading
  modelLoadTimeout = setTimeout(() => {
    if (!modelLoaded) {
      console.warn(`Model load timeout for ${draggedItem.model} at ${modelUrl}`);
      // Keep placeholder visible but make it semi-transparent to indicate loading issue
      const placeholder = furnitureEl.querySelector(
        `#${furnitureEl.id}-placeholder`
      );
      if (placeholder) {
        placeholder.setAttribute("opacity", "0.5");
        placeholder.setAttribute("color", "#888888");
        // Optionally show error message
        console.warn(`Model failed to load within ${MODEL_LOAD_TIMEOUT}ms. Using placeholder.`);
      }
    }
  }, MODEL_LOAD_TIMEOUT);

  // Listen for model error
  furnitureEl.addEventListener("model-error", function (e) {
    clearTimeout(modelLoadTimeout);
    console.error(`Model load error for ${draggedItem.model}:`, e.detail);
    const placeholder = furnitureEl.querySelector(
      `#${furnitureEl.id}-placeholder`
    );
    if (placeholder) {
      placeholder.setAttribute("opacity", "0.5");
      placeholder.setAttribute("color", "#FF6B6B");
    }
  });

  // Update cost estimator
  const itemName = getItemName(draggedItem.model);
  addItemToCost(draggedItem.model, itemName);

  // Expand cost panel when item is dropped
  const costPanel = document.getElementById("cost-panel");
  if (costPanel && costPanel.classList.contains("collapsed")) {
    costPanel.classList.remove("collapsed");
  }

  // Save workspace state
  saveWorkspaceState();

  // Clean up
  document.querySelectorAll(".model-item.dragging").forEach((item) => {
    item.classList.remove("dragging");
  });

  // Remove the drop indicator permanently after first furniture placement
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.style.display = "none";
  }

  draggedItem = null;
}

function addItemToCost(modelKey, displayName) {
  const price = PRICE_LIST[modelKey] || 0;

  if (!costState.items[modelKey]) {
    costState.items[modelKey] = {
      name: displayName,
      price: price, // Unit cost (estimated price)
      qty: 0,
      unitCost: price, // Store unit cost for display
    };
  }
  costState.items[modelKey].qty += 1;
  renderCost();
}

function peso(n) {
  return `₱${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Some MSDF fonts in a-text may not include the peso glyph.
// Use a 3D-safe fallback for in-scene text.
function peso3D(n) {
  return `PHP ${Number(n).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// buildSourcesMarkup function removed - now using side panel

function renderCost() {
  // Update cost items list
  const costItemsList = document.getElementById("cost-items-list");
  if (costItemsList) {
    costItemsList.innerHTML = "";
  }

  let total = 0;
  Object.keys(costState.items).forEach((key) => {
    const item = costState.items[key];
    const unitCost = item.unitCost || item.price; // Unit cost (estimated price per unit)
    const lineTotal = unitCost * item.qty; // Total cost for this item (unit cost × quantity)
    total += lineTotal;

    const content = `
      <div class="cost-item-details">
        <div>
          <div class="cost-item-name">${item.name}</div>
          <div class="cost-item-meta">${item.qty} × ${peso(
      unitCost
    )} (unit cost)</div>
        </div>
        <div class="cost-source-controls">
          <button class="cost-source-toggle" data-model="${key}" data-item-name="${
      item.name
    }">Sources</button>
        </div>
      </div>
      <div class="cost-item-total">${peso(lineTotal)}</div>
    `;

    if (costItemsList) {
      const row = document.createElement("div");
      row.className = "cost-item";
      row.innerHTML = content;
      costItemsList.appendChild(row);
    }
  });
  costState.total = total; // Total project cost (sum of all line totals)
  const totalEl = document.getElementById("cost-total");
  if (totalEl) totalEl.textContent = peso(total);
  const totalDisplay = document.getElementById("cost-total-display");
  if (totalDisplay) totalDisplay.textContent = peso(total);
}

// Grid functions removed

// Keyboard shortcuts
document.addEventListener("keydown", function (e) {
  if (e.key === "Tab") {
    e.preventDefault();
    togglePanel();
  }
  // Escape key handling removed (no back button)
  // Grid toggle removed

  // Save workspace state when furniture is moved (dragged)
  if (
    e.detail &&
    e.detail.target &&
    e.detail.target.id &&
    e.detail.target.id.startsWith("furniture-")
  ) {
    saveWorkspaceState();
  }
});

// Use event delegation for dynamically created source buttons
document.addEventListener("click", function (e) {
  // Check if clicked element is a source toggle button or inside one
  const toggle = e.target.closest(".cost-source-toggle");
  const sourcesPanel = document.getElementById("sources-panel");
  const clickedInsideSources = e.target.closest("#sources-panel");

  if (toggle) {
    e.preventDefault();
    e.stopPropagation();

    const modelKey = toggle.getAttribute("data-model");
    const itemName = toggle.getAttribute("data-item-name");

    if (!modelKey) return;

    // Show sources panel
    showSourcesPanel(modelKey, itemName);
  } else if (
    sourcesPanel &&
    sourcesPanel.classList.contains("open") &&
    !clickedInsideSources
  ) {
    // Close sources panel if clicking outside
    closeSourcesPanel();
  }
});

/**
 * Show sources panel with item sources
 */
function showSourcesPanel(modelKey, itemName) {
  const sourcesPanel = document.getElementById("sources-panel");
  const sourcesTitle = document.getElementById("sources-panel-title");
  const sourcesContent = document.getElementById("sources-panel-content");

  if (!sourcesPanel || !sourcesTitle || !sourcesContent) return;

  // Update title
  sourcesTitle.textContent = itemName
    ? `${itemName} - Sources`
    : "Item Sources";

  // Get sources for this item
  const sources = ITEM_PRICE_SOURCES[modelKey] || [];

  if (sources.length === 0) {
    sourcesContent.innerHTML = `
      <div class="sources-empty">
        <p>No sources available for this item.</p>
      </div>
    `;
  } else {
    // Build sources list
    const sourcesHTML = sources
      .map(
        (src) => `
      <div class="source-item">
        <div class="source-store">${src.store}</div>
        <div class="source-price">${peso(src.price)}</div>
      </div>
    `
      )
      .join("");

    sourcesContent.innerHTML = `
      <div class="sources-list">
        ${sourcesHTML}
      </div>
    `;
  }

  // Show panel
  sourcesPanel.classList.add("open");
}

/**
 * Close sources panel
 */
function closeSourcesPanel() {
  const sourcesPanel = document.getElementById("sources-panel");
  if (sourcesPanel) {
    sourcesPanel.classList.remove("open");
  }
}

// Sub-category functions
function showCenterTableSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const table1Name = getItemName("center_table1");
  const table2Name = getItemName("center_table2");

  const centerTableContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>🍽️ Center Table Options</h3>
      <small>Choose a center table style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="center_table1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('center_table1')}" alt="${table1Name}" onerror="this.parentElement.innerHTML='🍽️';"></span>
          <div class="model-name">${table1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="center_table2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('center_table2')}" alt="${table2Name}" onerror="this.parentElement.innerHTML='🍽️';"></span>
          <div class="model-name">${table2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = centerTableContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showWardrobeSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();
  
  const mainContent =
    sidePanel.querySelector(".panel-header").nextElementSibling;

  // Store original content
  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Get wardrobe names from metadata
  const wardrobe1Name = getItemName("wardrobe1");
  const wardrobe2Name = getItemName("wardrobe2");
  const wardrobe3Name = getItemName("wardrobe3");

  // Create wardrobe panel content
  const wardrobeContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>👔 Wardrobe Options</h3>
      <small>Choose a wardrobe style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe1"
          data-scale="1 1 1"
        >
          <span class="model-icon">👔</span>
          <div class="model-name">${wardrobe1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe2"
          data-scale="1 1 1"
        >
          <span class="model-icon">👔</span>
          <div class="model-name">${wardrobe2Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="wardrobe3"
          data-scale="1 1 1"
        >
          <span class="model-icon">👔</span>
          <div class="model-name">${wardrobe3Name}</div>
        </div>
      </div>
    </div>
  `;

  // Replace panel content
  sidePanel.innerHTML = wardrobeContent;

  // Re-initialize drag and drop for new items
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showBedSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const bed1Name = getItemName("bed1");
  const bed2Name = getItemName("bed2");

  const bedContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>🛏️ Bed Options</h3>
      <small>Choose a bed style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="bed1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('bed1')}" alt="${bed1Name}" onerror="this.parentElement.innerHTML='🛏️';"></span>
          <div class="model-name">${bed1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="bed2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('bed2')}" alt="${bed2Name}" onerror="this.parentElement.innerHTML='🛏️';"></span>
          <div class="model-name">${bed2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = bedContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showChairSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const chair1Name = getItemName("chair1");
  const chair2Name = getItemName("chair2");

  const chairContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>🪑 Chair Options</h3>
      <small>Choose a chair style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="chair1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('chair1')}" alt="${chair1Name}" onerror="this.parentElement.innerHTML='🪑';"></span>
          <div class="model-name">${chair1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="chair2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('chair2')}" alt="${chair2Name}" onerror="this.parentElement.innerHTML='🪑';"></span>
          <div class="model-name">${chair2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = chairContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showDeskSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const desk1Name = getItemName("desk1");
  const desk2Name = getItemName("desk2");

  const deskContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>💻 Desk Options</h3>
      <small>Choose a desk style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="desk1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('desk1')}" alt="${desk1Name}" onerror="this.parentElement.innerHTML='💻';"></span>
          <div class="model-name">${desk1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="desk2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('desk2')}" alt="${desk2Name}" onerror="this.parentElement.innerHTML='💻';"></span>
          <div class="model-name">${desk2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = deskContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showMirrorSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const mirror1Name = getItemName("mirror1");
  const mirror2Name = getItemName("mirror2");

  const mirrorContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>🪞 Mirror Options</h3>
      <small>Choose a mirror style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="mirror1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('mirror1')}" alt="${mirror1Name}" onerror="this.parentElement.innerHTML='🪞';"></span>
          <div class="model-name">${mirror1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="mirror2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('mirror2')}" alt="${mirror2Name}" onerror="this.parentElement.innerHTML='🪞';"></span>
          <div class="model-name">${mirror2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = mirrorContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function showShelfSubcategory() {
  const sidePanel = document.getElementById("side-panel");
  if (!sidePanel) return;

  if (!sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }
  
  // Save current scroll position before navigating to subcategory
  sidePanel.dataset.scrollPosition = sidePanel.scrollTop.toString();

  const shelf1Name = getItemName("shelf1");
  const shelf2Name = getItemName("shelf2");

  const shelfContent = `
    <div class="panel-header">
      <button onclick="goBackToMainPanel()" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #f5f5f5; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-bottom: 10px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">← Back</button>
      <h3>📦 Shelf Options</h3>
      <small>Choose a shelf style</small>
    </div>
    <div class="model-category">
      <div class="model-grid">
        <div
          class="model-item enabled"
          draggable="true"
          data-model="shelf1"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('shelf1')}" alt="${shelf1Name}" onerror="this.parentElement.innerHTML='📦';"></span>
          <div class="model-name">${shelf1Name}</div>
        </div>
        <div
          class="model-item enabled"
          draggable="true"
          data-model="shelf2"
          data-scale="1 1 1"
        >
          <span class="model-icon"><img src="${getThumbnailPath('shelf2')}" alt="${shelf2Name}" onerror="this.parentElement.innerHTML='📦';"></span>
          <div class="model-name">${shelf2Name}</div>
        </div>
      </div>
    </div>
  `;

  sidePanel.innerHTML = shelfContent;
  initializeDragAndDrop();
  updateSubcategoryUI();
}

function goBackToMainPanel() {
  const sidePanel = document.getElementById("side-panel");
  const resizePanel = document.getElementById("resize-dimension-panel");

  // Hide resize panel
  if (resizePanel) {
    resizePanel.classList.remove("open");
  }

  // Show main side panel
  if (sidePanel) {
    sidePanel.classList.add("open");
    if (sidePanel.dataset.originalContent) {
      // Restore the saved scroll position before restoring content
      const savedScrollPosition = sidePanel.dataset.scrollPosition 
        ? parseFloat(sidePanel.dataset.scrollPosition) 
        : 0;
      
      sidePanel.innerHTML = sidePanel.dataset.originalContent;
      
      // Restore scroll position after content is restored
      // Use setTimeout to ensure DOM is updated before scrolling
      setTimeout(() => {
        sidePanel.scrollTop = savedScrollPosition;
      }, 0);
      
      // Re-initialize drag and drop
      initializeDragAndDrop();
      updateSubcategoryUI();
    }
  }
}

// Control panel functions
function showControlPanel(furnitureId) {
  selectedFurniture = furnitureId;
  const panel = document.getElementById("furniture-control-panel");
  const title = document.getElementById("control-panel-title");
  const furniture = document.getElementById(furnitureId);
  const rotateLeftBtn = document.getElementById("rotate-left-btn");
  const rotateRightBtn = document.getElementById("rotate-right-btn");

  // Get item name from furniture element
  let itemName = furnitureId;
  let isWallMounted = false;
  if (furniture) {
    const modelKey = furniture.getAttribute("data-model-key");
    if (modelKey) {
      itemName = getItemName(modelKey);
      // Check if the item is wall-mounted
      isWallMounted = furniture.components['wall-mounted'] !== undefined;
    }
  }

  title.textContent = itemName;
  panel.style.display = "block";

  // Show/hide rotation buttons based on item type
  if (isWallMounted) {
    if (rotateLeftBtn) rotateLeftBtn.style.display = "none";
    if (rotateRightBtn) rotateRightBtn.style.display = "none";
  } else {
    if (rotateLeftBtn) rotateLeftBtn.style.display = "flex";
    if (rotateRightBtn) rotateRightBtn.style.display = "flex";
  }
}

function closeControlPanel() {
  const panel = document.getElementById("furniture-control-panel");
  panel.style.display = "none";
  
  // Deselect the currently selected item when closing panel
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const clickableComponent = furniture.components['clickable-furniture'];
      if (clickableComponent && clickableComponent.isSelected) {
        // Set flag to prevent recursion when deselect calls closeControlPanel
        clickableComponent._isClosingPanel = true;
        // Deselect the item, which will restore its original color
        clickableComponent.deselect();
        clickableComponent._isClosingPanel = false;
      }
    }
  }
  
  selectedFurniture = null;
}

/**
 * Show item details (dimensions, type, price, etc.)
 */
function showItemDetails() {
  if (!selectedFurniture) return;
  
  const furniture = document.getElementById(selectedFurniture);
  if (!furniture) return;
  
  const modelKey = furniture.getAttribute("data-model-key");
  if (!modelKey) return;
  
  // Get item name
  const itemName = getItemName(modelKey);
  
  // Get price
  const price = PRICE_LIST[modelKey] || 0;
  
  // Get dimensions from draggable component if available
  const draggableComponent = furniture.components["draggable-furniture"];
  let dimensions = "Calculating...";
  let width = 0.5;
  let length = 0.5;
  let height = 0.5;
  
  if (draggableComponent && draggableComponent.dimensionsCalculated) {
    // Use calculated dimensions from model (read-only, actual dimensions)
    width = parseFloat(draggableComponent.actualWidth || draggableComponent.data.objectWidth);
    length = parseFloat(draggableComponent.actualLength || draggableComponent.data.objectLength);
    // Try to get height from bounding box
    const object3D = furniture.object3D;
    if (object3D) {
      const box = new THREE.Box3();
      box.setFromObject(object3D);
      if (box.min && box.max) {
        const size = new THREE.Vector3();
        box.getSize(size);
        height = Math.abs(size.y);
      }
    }
    dimensions = `W: ${width.toFixed(2)}m × L: ${length.toFixed(2)}m × H: ${height.toFixed(2)}m`;
  }
  
  // Get category
  let category = "Furniture";
  if (modelKey.includes("table")) category = "Table";
  else if (modelKey.includes("bed")) category = "Bed";
  else if (modelKey.includes("chair")) category = "Seating";
  else if (modelKey.includes("desk")) category = "Desk";
  else if (modelKey.includes("wardrobe")) category = "Storage";
  else if (modelKey.includes("mirror")) category = "Mirror";
  else if (modelKey.includes("shelf")) category = "Shelf";
  
  // Check if wall-mounted (read-only, actual type)
  const isWallMounted = furniture.components["wall-mounted"] !== undefined;
  const mountType = isWallMounted ? "Wall-mounted" : "Floor-standing";
  
  // Build details content (read-only display of actual dimensions and type)
  const detailsContent = `
    <div class="item-details-content">
      <h4 class="item-details-title">${itemName}</h4>
      <div class="item-details-section">
        <div class="item-details-row">
          <span class="item-details-label">Category:</span>
          <span class="item-details-value">${category}</span>
        </div>
        <div class="item-details-row">
          <span class="item-details-label">Type:</span>
          <span class="item-details-value">${mountType}</span>
        </div>
        <div class="item-details-row">
          <span class="item-details-label">Dimensions:</span>
          <span class="item-details-value">W: ${width.toFixed(2)}m × L: ${length.toFixed(2)}m × H: ${height.toFixed(2)}m</span>
        </div>
        <div class="item-details-row">
          <span class="item-details-label">Estimated Price:</span>
          <span class="item-details-value">${peso(price)}</span>
        </div>
        <div class="item-details-row">
          <span class="item-details-label">Model Key:</span>
          <span class="item-details-value">${modelKey}</span>
        </div>
      </div>
    </div>
  `;
  
  // Show in dialog (read-only display)
  showDialog(detailsContent, "Item Details");
}

function rotateFurnitureLeft() {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) - 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`
      );
      saveWorkspaceState();
    }
  }
}

function rotateFurnitureRight() {
  if (selectedFurniture) {
    const furniture = document.getElementById(selectedFurniture);
    if (furniture) {
      const currentRotation = furniture.getAttribute("rotation");
      const newRotation = (parseFloat(currentRotation.y) + 90) % 360;
      furniture.setAttribute(
        "rotation",
        `${currentRotation.x} ${newRotation} ${currentRotation.z}`
      );
      saveWorkspaceState();
    }
  }
}

function deleteFurniture() {
  if (!selectedFurniture) return;

  const furniture = document.getElementById(selectedFurniture);
  if (!furniture) return;

  // Extract model key
  let modelKey = null;
  try {
    modelKey = furniture.getAttribute("data-model-key");

    if (!modelKey) {
      const objModelAttr = furniture.getAttribute("obj-model");
      let objModelString = "";
      if (typeof objModelAttr === "string") {
        objModelString = objModelAttr;
      } else if (objModelAttr && typeof objModelAttr === "object") {
        objModelString = objModelAttr.obj || objModelAttr.src || "";
      }

      const match = objModelString.match(/models\/(\w+)\.obj/);
      if (match && match[1]) {
        modelKey = match[1];
      }
    }

    // Remove from cost estimator if we found the model key
    if (modelKey && costState.items[modelKey]) {
      costState.items[modelKey].qty -= 1;
      if (costState.items[modelKey].qty <= 0) {
        delete costState.items[modelKey];
      }
      renderCost();
    }
  } catch (error) {
    console.error("Error extracting model key:", error);
  }

  // Remove from scene
  furniture.remove();
  saveWorkspaceState();
  closeControlPanel();
}

/**
 * Save workspace state to localStorage
 * Expose globally so it can be called from other pages
 */
function saveWorkspaceState() {
  try {
    // Use collectRoomPlanData for consistent data format
    if (typeof collectRoomPlanData === "function") {
      const roomPlanData = collectRoomPlanData();

      // Convert to format compatible with restoreRoom
      const state = {
        room_width: roomPlanData.room_width,
        room_length: roomPlanData.room_length,
        furniture_data: roomPlanData.furniture_data,
        cost_total: roomPlanData.cost_total,
        costState: costState, // Keep full cost state for compatibility
        furnitureCounter: furnitureCounter,
      };

      // Save to currentRoomState for auto-restore
      localStorage.setItem("currentRoomState", JSON.stringify(state));

      // Also save to workspaceState for backward compatibility
      const furnitureData = roomPlanData.furniture_data.map((item) => ({
        model_key: item.model_key,
        position: item.position,
        rotation: item.rotation,
        scale: item.scale,
      }));

      const legacyState = {
        furniture: furnitureData,
        costState: costState,
        furnitureCounter: furnitureCounter,
      };
      localStorage.setItem("workspaceState", JSON.stringify(legacyState));

      console.log(
        `Workspace state saved: ${furnitureData.length} furniture items`
      );
    } else {
      // Fallback to old method if collectRoomPlanData not available
      const furnitureContainer = document.getElementById("furniture-container");
      const furnitureData = [];

      if (furnitureContainer) {
        const furnitureItems =
          furnitureContainer.querySelectorAll('[id^="furniture-"]');
        furnitureItems.forEach((item) => {
          const position = item.getAttribute("position");
          const rotation = item.getAttribute("rotation");
          const scale = item.getAttribute("scale");
          const modelKey = item.getAttribute("data-model-key");

          if (modelKey && position) {
            const [x, y, z] = position.split(" ").map(parseFloat);
            const [rx, ry, rz] = (rotation || "0 0 0")
              .split(" ")
              .map(parseFloat);
            const [sx, sy, sz] = (scale || "1 1 1").split(" ").map(parseFloat);

            furnitureData.push({
              model_key: modelKey,
              position: { x, y, z },
              rotation: { x: rx, y: ry, z: rz },
              scale: { x: sx, y: sy, z: sz },
            });
          }
        });
      }

      const state = {
        furniture: furnitureData,
        costState: costState,
        furnitureCounter: furnitureCounter,
      };

      localStorage.setItem("workspaceState", JSON.stringify(state));
      console.log(
        `Workspace state saved: ${furnitureData.length} furniture items`
      );
    }
  } catch (error) {
    console.error("Error saving workspace state:", error);
  }
}

/**
 * Restore room from saved room plan data
 * @param {Object} roomData - Room plan data from collectRoomPlanData()
 */
function restoreRoom(roomData) {
  if (!roomData) {
    console.warn("No room data provided to restoreRoom");
    return;
  }

  try {
    // Restore room dimensions if provided
    if (roomData.room_width && roomData.room_length) {
      localStorage.setItem("roomWidth", roomData.room_width.toString());
      localStorage.setItem("roomLength", roomData.room_length.toString());
      // Reinitialize room with new dimensions
      initializeRoom();
    }

    // Restore furniture items
    const furnitureData = roomData.furniture_data || [];
    if (furnitureData.length === 0) {
      console.log("No furniture items to restore");
      return;
    }

    console.log(
      `Restoring ${furnitureData.length} furniture items from saved room state`
    );

    // Restore furniture counter
    if (
      roomData.furnitureCounter &&
      typeof roomData.furnitureCounter === "number"
    ) {
      furnitureCounter = Math.max(furnitureCounter, roomData.furnitureCounter);
    }

    // Restore furniture items
    const furnitureContainer = document.getElementById("furniture-container");
    if (!furnitureContainer) {
      console.warn("Furniture container not found");
      return;
    }

    const roomWidth =
      roomData.room_width ||
      parseFloat(localStorage.getItem("roomWidth")) ||
      10;
    const roomLength =
      roomData.room_length ||
      parseFloat(localStorage.getItem("roomLength")) ||
      10;

    // Clear existing furniture first to avoid duplicates
    const existingFurniture =
      furnitureContainer.querySelectorAll('[id^="furniture-"]');
    if (existingFurniture.length > 0) {
      console.log(
        `Clearing ${existingFurniture.length} existing furniture items before restore`
      );
      existingFurniture.forEach((item) => item.remove());
    }

    for (const itemData of furnitureData) {
      // Validate item data
      if (
        !itemData.model_key ||
        !itemData.position ||
        typeof itemData.position.x !== "number" ||
        typeof itemData.position.y !== "number" ||
        typeof itemData.position.z !== "number"
      ) {
        console.warn("Invalid furniture item data:", itemData);
        continue;
      }

      const furnitureEl = document.createElement("a-entity");
      furnitureEl.id = `furniture-${furnitureCounter++}`;
      furnitureEl.setAttribute(
        "position",
        `${itemData.position.x} ${itemData.position.y} ${itemData.position.z}`
      );

      // Handle rotation
      const rotation = itemData.rotation || { x: 0, y: 0, z: 0 };
      furnitureEl.setAttribute(
        "rotation",
        `${rotation.x} ${rotation.y} ${rotation.z}`
      );

      // Handle scale
      const scale = itemData.scale || { x: 1, y: 1, z: 1 };
      furnitureEl.setAttribute("scale", `${scale.x} ${scale.y} ${scale.z}`);

      furnitureEl.setAttribute("data-model-key", itemData.model_key);

      // Create placeholder
      const placeholderEl = document.createElement("a-box");
      placeholderEl.setAttribute("width", "1.5");
      placeholderEl.setAttribute("height", "0.8");
      placeholderEl.setAttribute("depth", "1.5");
      placeholderEl.setAttribute("color", "#FF8C00");
      placeholderEl.setAttribute("opacity", "0.7");
      placeholderEl.setAttribute("visible", "true");
      placeholderEl.id = `${furnitureEl.id}-placeholder`;
      furnitureEl.appendChild(placeholderEl);

      furnitureContainer.appendChild(furnitureEl);
      
      // Ensure furniture is visible regardless of camera position
      furnitureEl.setAttribute("visible", "true");

      if (furnitureEl.flushToDOM) {
        furnitureEl.flushToDOM();
      }

      // Load model
      const modelUrl = getModelUrl(itemData.model_key);
      furnitureEl.setAttribute("obj-model", `obj: url(${modelUrl})`);
      furnitureEl.setAttribute(
        "draggable-furniture",
        `roomWidth: ${roomWidth}; roomLength: ${roomLength}; objectWidth: 1.5; objectLength: 1.5; wallThickness: 0.1`
      );
      
      // Check if item should be wall-mounted (mirrors and shelves)
      const isWallMounted = itemData.model_key.startsWith('mirror') || itemData.model_key.startsWith('shelf');
      if (isWallMounted) {
        // Get wall height from localStorage or use default
        const savedHeight = localStorage.getItem("roomHeight");
        const roomWallHeight = savedHeight ? parseFloat(savedHeight) : 3;
        
        furnitureEl.setAttribute(
          "wall-mounted",
          `roomWidth: ${roomWidth}; roomLength: ${roomLength}; wallThickness: 0.1; wallHeight: ${roomWallHeight}; snapDistance: 0.2`
        );
        
        // Ensure restored wall-mounted items snap to nearest wall
        setTimeout(() => {
          const wallMountedComp = furnitureEl.components['wall-mounted'];
          if (wallMountedComp) {
            const currentPos = furnitureEl.object3D.position;
            const wallInfo = wallMountedComp.findNearestWall(currentPos);
            if (wallInfo) {
              wallMountedComp.currentWall = wallInfo.wall;
              const result = wallMountedComp.constrainToWall(currentPos, wallInfo.wall);
              wallMountedComp.currentWall = result.wall;
              
              // Position is already constrained by constrainToWall (including Y based on object height)
              furnitureEl.setAttribute('position', result.position);
            } else {
              // Fallback to front wall
              wallMountedComp.currentWall = 'front';
              const innerZ = roomLength / 2 - 0.1 / 2;
              const result = wallMountedComp.constrainToWall(currentPos, 'front');
              furnitureEl.setAttribute('position', result.position);
            }
          }
        }, 200);
      }
      
      furnitureEl.setAttribute("clickable-furniture", "");
      furnitureEl.setAttribute("material", "color: #FF8C00");

      // Set up model loading timeout and error handling for restored items
      let modelLoadTimeout;
      let modelLoaded = false;

      const onModelLoaded = function () {
        if (modelLoaded) return;
        modelLoaded = true;
        clearTimeout(modelLoadTimeout);
        
        const placeholder = furnitureEl.querySelector(
          `#${furnitureEl.id}-placeholder`
        );
        if (placeholder) {
          placeholder.remove();
        }
      };

      furnitureEl.addEventListener("model-loaded", onModelLoaded, { once: true });

      // Set timeout for model loading
      modelLoadTimeout = setTimeout(() => {
        if (!modelLoaded) {
          console.warn(`Model load timeout for ${itemData.model_key} at ${modelUrl}`);
          const placeholder = furnitureEl.querySelector(
            `#${furnitureEl.id}-placeholder`
          );
          if (placeholder) {
            placeholder.setAttribute("opacity", "0.5");
            placeholder.setAttribute("color", "#888888");
          }
        }
      }, MODEL_LOAD_TIMEOUT);

      // Listen for model error
      furnitureEl.addEventListener("model-error", function (e) {
        clearTimeout(modelLoadTimeout);
        console.error(`Model load error for ${itemData.model_key}:`, e.detail);
        const placeholder = furnitureEl.querySelector(
          `#${furnitureEl.id}-placeholder`
        );
        if (placeholder) {
          placeholder.setAttribute("opacity", "0.5");
          placeholder.setAttribute("color", "#FF6B6B");
        }
      }, { once: true });
    }

    // Restore cost state
    if (
      roomData.costState &&
      roomData.costState.items &&
      typeof roomData.costState.items === "object"
    ) {
      costState.items = roomData.costState.items;
      costState.total =
        typeof roomData.costState.total === "number"
          ? roomData.costState.total
          : 0;
      renderCost();
      console.log("Cost state restored");

      // Expand cost panel if there are items
      const costPanel = document.getElementById("cost-panel");
      if (costPanel && Object.keys(costState.items).length > 0) {
        costPanel.classList.remove("collapsed");
      }
    } else if (roomData.cost_total) {
      // If only cost_total is provided, update it
      costState.total = roomData.cost_total;
      renderCost();
    }

    // Expand cost panel if furniture was restored
    if (furnitureData.length > 0) {
      const costPanel = document.getElementById("cost-panel");
      if (costPanel) {
        costPanel.classList.remove("collapsed");
      }
    }

    console.log("Room restored successfully");
  } catch (error) {
    console.error("Error restoring room:", error);
  }
}

/**
 * Restore workspace state from localStorage (legacy support)
 */
async function restoreWorkspaceState() {
  // First try to restore from currentRoomState (new format)
  try {
    const currentStateJson = localStorage.getItem("currentRoomState");
    if (currentStateJson) {
      const currentState = JSON.parse(currentStateJson);
      restoreRoom(currentState);
      return;
    }
  } catch (error) {
    console.warn(
      "Error restoring from currentRoomState, trying legacy format:",
      error
    );
  }

  // Fallback to legacy workspaceState format
  try {
    const stateJson = localStorage.getItem("workspaceState");
    if (!stateJson) {
      console.log("No workspace state found in localStorage");
      return;
    }

    let state;
    try {
      state = JSON.parse(stateJson);
    } catch (parseError) {
      console.error(
        "Error parsing workspace state from localStorage:",
        parseError
      );
      // Clear corrupted data
      localStorage.removeItem("workspaceState");
      return;
    }

    if (!state || !state.furniture || !Array.isArray(state.furniture)) {
      console.warn("Invalid workspace state structure");
      return;
    }

    if (state.furniture.length === 0) {
      console.log("Workspace state has no furniture items to restore");
      return;
    }

    console.log(
      `Restoring ${state.furniture.length} furniture items from legacy saved state`
    );

    // Convert legacy format to new format
    const roomData = {
      room_width: parseFloat(localStorage.getItem("roomWidth")) || 10,
      room_length: parseFloat(localStorage.getItem("roomLength")) || 10,
      furniture_data: state.furniture,
      costState: state.costState,
      furnitureCounter: state.furnitureCounter,
    };

    restoreRoom(roomData);
  } catch (error) {
    console.error("Error restoring workspace state:", error);
    // Don't clear state on error - might be recoverable
  }
}

/**
 * Show welcome dialog with instructions (one-time only)
 */
function showWelcomeDialog() {
  // Check if welcome dialog has been shown before
  const welcomeShown = localStorage.getItem("welcomeDialogShown");
  if (welcomeShown === "true") {
    return; // Don't show again
  }

  // Get room dimensions for display
  const width = localStorage.getItem("roomWidth") || "?";
  const length = localStorage.getItem("roomLength") || "?";
  const height = localStorage.getItem("roomHeight") || "?";

  const welcomeContent = `
    <div class="welcome-dialog-content">
      <h2 class="welcome-title">Welcome to 3D Room Planner! 🎉</h2>
      <p class="welcome-subtitle">Your room: ${width}M × ${length}M × ${height}M</p>
      
      <div class="welcome-section">
        <h3>🎮 Controls</h3>
        <ul>
          <li><strong>W/A/S/D</strong> → Move around</li>
          <li><strong>Q</strong> → Move Up | <strong>E</strong> → Move Down</li>
          <li><strong>Mouse</strong> → Look around</li>
        </ul>
      </div>

      <div class="welcome-section">
        <h3>🍽️ Furniture</h3>
        <ul>
          <li><strong>📦</strong> Click panel button to open library</li>
          <li><strong>🖱️</strong> Drag furniture into your room</li>
          <li><strong>🖱️</strong> Click an item to show more options</li>
        </ul>
      </div>

      <div class="welcome-section">
        <h3>📊 Cost Board</h3>
        <ul>
          <li><strong>💰</strong> View costs and total in the cost panel</li>
          <li><strong>👀</strong> Walk around to view from different angles</li>
        </ul>
      </div>

      <div class="welcome-tip">
        💡 <strong>Tip:</strong> Hover over the <strong>❔</strong> button anytime to see these instructions again!
      </div>
    </div>
  `;

  // Create custom welcome dialog
  const modal = document.getElementById("dialog-modal");
  const content = document.getElementById("dialog-content");
  const titleEl = document.getElementById("dialog-title");
  const messageEl = document.getElementById("dialog-message");
  const buttonsEl = document.getElementById("dialog-buttons");

  if (!modal || !content) {
    console.warn("Dialog modal not found");
    return;
  }

  // Hide default title and message, use custom content
  titleEl.style.display = "none";
  messageEl.innerHTML = welcomeContent;
  messageEl.style.margin = "0";
  messageEl.style.padding = "0";

  // Add close button
  buttonsEl.innerHTML =
    '<button id="dialog-ok-btn" class="dialog-btn dialog-btn-primary">Got it!</button>';

  // Show modal
  modal.style.display = "flex";
  content.classList.add("welcome-dialog");

  // Handle close button
  const okBtn = document.getElementById("dialog-ok-btn");
  const closeDialog = () => {
    modal.style.display = "none";
    content.classList.remove("welcome-dialog");
    // Mark as shown
    localStorage.setItem("welcomeDialogShown", "true");
  };

  okBtn.onclick = closeDialog;

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      closeDialog();
    }
  };

  // Close on Escape key
  const escapeHandler = (e) => {
    if (e.key === "Escape") {
      closeDialog();
      document.removeEventListener("keydown", escapeHandler);
    }
  };
  document.addEventListener("keydown", escapeHandler);
}

// Initialize room when page loads
window.addEventListener("load", async function () {
  // Load items and prices from Supabase first
  await loadItemsAndPrices();

  // Initialize auth UI
  if (typeof initAuthUI === "function") {
    initAuthUI();
  }

  // Update subcategory names in UI
  updateSubcategoryUI();

  // Attach click event listener to drop indicator (attach once on load)
  const dropIndicator = document.getElementById("drop-indicator");
  if (dropIndicator) {
    dropIndicator.addEventListener("click", handleDropIndicatorClick);
  }

  // Store original side panel content for wardrobe navigation
  const sidePanel = document.getElementById("side-panel");
  if (sidePanel && !sidePanel.dataset.originalContent) {
    sidePanel.dataset.originalContent = sidePanel.innerHTML;
  }

  // Make sure A-Frame scene is ready
  const scene = document.querySelector("a-scene");
  if (scene.hasLoaded) {
    initializeRoom();
    // Auto-restore room state after room is initialized
    // Use longer timeout to ensure scene is fully ready
    setTimeout(() => {
      // Try to restore from currentRoomState first (auto-restore)
      const saved = localStorage.getItem("currentRoomState");
      if (saved) {
        try {
          const roomData = JSON.parse(saved);
          restoreRoom(roomData);
          console.log("Room state auto-restored from currentRoomState");
        } catch (error) {
          console.error(
            "Error parsing currentRoomState, trying legacy restore:",
            error
          );
          restoreWorkspaceState();
        }
      } else {
        // Fallback to legacy restore
        restoreWorkspaceState();
      }

      // Show welcome dialog after room is initialized (one-time only)
      setTimeout(() => {
        showWelcomeDialog();
      }, 1000);
    }, 800);
  } else {
    scene.addEventListener("loaded", function () {
      initializeRoom();
      // Auto-restore room state after room is initialized
      // Use longer timeout to ensure scene is fully ready
      setTimeout(() => {
        // Try to restore from currentRoomState first (auto-restore)
        const saved = localStorage.getItem("currentRoomState");
        if (saved) {
          try {
            const roomData = JSON.parse(saved);
            restoreRoom(roomData);
            console.log("Room state auto-restored from currentRoomState");
          } catch (error) {
            console.error(
              "Error parsing currentRoomState, trying legacy restore:",
              error
            );
            restoreWorkspaceState();
          }
        } else {
          // Fallback to legacy restore
          restoreWorkspaceState();
        }

        // Show welcome dialog after room is initialized (one-time only)
        setTimeout(() => {
          showWelcomeDialog();
        }, 1000);
      }, 800);
    });
  }

  // Ensure cost panel renders at least once on load
  renderCost();

  // Keep cost panel collapsed on startup if no items
  const costPanel = document.getElementById("cost-panel");
  if (costPanel && Object.keys(costState.items).length === 0) {
    costPanel.classList.add("collapsed");
  }

  // Save state before page unload using collectRoomPlanData
  window.addEventListener("beforeunload", () => {
    if (typeof collectRoomPlanData === "function") {
      const roomPlanData = collectRoomPlanData();
      localStorage.setItem(
        "currentRoomState",
        JSON.stringify({
          ...roomPlanData,
          costState: costState,
          furnitureCounter: furnitureCounter,
        })
      );
      console.log("Room state auto-saved on page unload");
    } else {
      saveWorkspaceState();
    }
  });

  // Also save on visibility change (when tab becomes hidden)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (typeof collectRoomPlanData === "function") {
        const roomPlanData = collectRoomPlanData();
        localStorage.setItem(
          "currentRoomState",
          JSON.stringify({
            ...roomPlanData,
            costState: costState,
            furnitureCounter: furnitureCounter,
          })
        );
      } else {
        saveWorkspaceState();
      }
    }
  });
});

/**
 * Update subcategory UI with names from metadata
 */
function updateSubcategoryUI() {
  const selectors = [
    '[data-model^="wardrobe"]',
    '[data-model^="center_table"]',
    '[data-model^="bed"]',
    '[data-model^="chair"]',
    '[data-model^="desk"]',
    '[data-model^="mirror"]',
    '[data-model^="shelf"]',
  ];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((item) => {
      const modelKey = item.getAttribute("data-model");
      const nameEl = item.querySelector(".model-name");
      if (nameEl && modelKey) {
        nameEl.textContent = getItemName(modelKey);
      }
    });
  });
}

/**
 * Handle save estimation button click
 */
async function handleSaveEstimation() {
  const isAuthenticated = await checkAuth();

  if (!isAuthenticated) {
    showAuthModal(async () => {
      await handleSaveEstimation();
    });
    return;
  }

  try {
    // Show warning dialog first
    const proceed = await showConfirm(
      "⚠️ Reminder: The saved cost estimation only contains details (cost breakdown, room size, etc.) and does NOT include the visual 3D plan.\n\n📸 Please take a screenshot of your room plan before saving if you want to keep a visual record.\n\nDo you want to continue saving the cost estimation?",
      "Save Cost Estimation - Important Reminder"
    );
    
    if (!proceed) {
      return; // User cancelled
    }

    const nameInput = await showPrompt(
      "Enter a name for this cost estimation:",
      "",
      "Save Cost Estimation"
    );
    
    // If user cancelled the name input, cancel the entire save operation
    if (nameInput === null) {
      return;
    }
    
    const estimationName =
      (nameInput && nameInput.trim()) ||
      `Cost Estimation ${new Date().toLocaleString()}`;

    if (typeof saveCostEstimation === "function") {
      try {
        await saveCostEstimation(estimationName);

        // Show notification with reminder
        const notification = document.getElementById(
          "save-estimation-notification"
        );
        if (notification) {
          notification.textContent = "saved to profile (remember to screenshot your plan!)";
          notification.classList.add("show");

          // Hide notification after 5 seconds (longer to read the reminder)
          setTimeout(() => {
            notification.classList.remove("show");
          }, 5000);
        }
      } catch (error) {
        console.error("Error saving cost estimation:", error);
        await showDialog(
          `Error saving cost estimation: ${error.message}`,
          "Error"
        );
      }
    } else {
      await showDialog("Error: Save function not available", "Error");
    }
  } catch (error) {
    console.error("Error saving cost estimation:", error);
    await showDialog(
      "Unable to save cost estimation. Please try again.",
      "Error"
    );
  }
}

// Expose globally for onclick handler
window.handleSaveEstimation = handleSaveEstimation;
window.saveWorkspaceState = saveWorkspaceState;
window.restoreRoom = restoreRoom;
window.showBedSubcategory = showBedSubcategory;
window.showChairSubcategory = showChairSubcategory;
window.showDeskSubcategory = showDeskSubcategory;
window.showMirrorSubcategory = showMirrorSubcategory;
window.showShelfSubcategory = showShelfSubcategory;
window.showItemDetails = showItemDetails;
