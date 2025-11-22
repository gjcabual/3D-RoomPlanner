# 3D Room Planner - Complete Code Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Data Flow](#data-flow)
4. [Core Components Deep Dive](#core-components-deep-dive)
5. [3D Rendering System](#3d-rendering-system)
6. [State Management](#state-management)
7. [API Integration](#api-integration)
8. [Error Handling & Fallbacks](#error-handling--fallbacks)
9. [File Structure & Dependencies](#file-structure--dependencies)
10. [Key Algorithms](#key-algorithms)

---

## System Overview

The 3D Room Planner is a client-side web application that combines:

- **3D Rendering**: A-Frame framework for WebGL-based 3D graphics
- **Backend Services**: Supabase for authentication, database, and file storage
- **State Management**: localStorage for client-side persistence
- **UI Framework**: Vanilla JavaScript with custom CSS components

### Technology Stack

```
Frontend:
├── A-Frame 1.5.0 (3D rendering engine)
├── Three.js (via A-Frame, 3D math and WebGL)
├── HTML2Canvas (screenshot capture)
├── Tailwind CSS (utility-first styling)
└── Vanilla JavaScript ES6+ (application logic)

Backend:
├── Supabase (BaaS platform)
│   ├── PostgreSQL (database)
│   ├── Auth (authentication)
│   └── Storage (file hosting)
└── Row Level Security (RLS) policies
```

---

## Architecture Patterns

### 1. Component-Based Architecture (A-Frame)

A-Frame uses an entity-component-system (ECS) pattern:

```javascript
// Entity: HTML element
<a-entity id="furniture-1">
  <!-- Components: Attributes that add behavior -->
  <a-entity
    obj-model="obj: url(asset/models/table1.obj)"
    draggable-furniture="roomWidth: 10; roomLength: 10"
    clickable-furniture=""
    position="0 0 0"
  ></a-entity>
</a-entity>
```

**Custom Components:**

- `draggable-furniture`: Handles drag interactions and collision detection
- `clickable-furniture`: Manages selection and interaction
- `movement`: First-person camera controls
- `floor-resize`: Dynamic floor plane resizing
- `smart-placement`: Intelligent furniture positioning

### 2. Module Pattern

JavaScript modules are organized by functionality:

```javascript
// Module: js/planner.js
let ITEMS_DATA = {}; // Module-level state
let PRICE_LIST = {}; // Module-level state

function loadItemsAndPrices() {
  /* ... */
} // Public function
function getModelUrl(modelKey) {
  /* ... */
} // Public function
```

### 3. Event-Driven Architecture

The application uses multiple event systems:

1. **DOM Events**: Click, drag, drop, keyboard
2. **A-Frame Events**: `model-loaded`, `raycaster-intersection`
3. **Custom Events**: Workspace state changes, authentication updates

---

## Data Flow

### 1. Application Initialization Flow

```
User Opens Planner
    ↓
1. Load Supabase Client (js/utils/supabase.js)
    ↓
2. Check Authentication State (js/auth/auth.js)
    ↓
3. Load Items & Prices (js/planner.js::loadItemsAndPrices())
    ├── Fetch from Supabase (with 10s timeout)
    ├── Apply fallbacks if Supabase fails
    └── Use dummy prices if no data available
    ↓
4. Initialize A-Frame Scene (planner.html)
    ├── Create camera rig
    ├── Set up lighting
    └── Create floor plane
    ↓
5. Initialize Room (js/planner.js::initializeRoom())
    ├── Read dimensions from localStorage
    ├── Create walls with height
    ├── Create grid helper
    └── Position camera
    ↓
6. Restore Workspace State (if exists)
    ├── Load from localStorage
    ├── Recreate furniture entities
    └── Restore cost state
    ↓
7. Show Welcome Dialog (first visit only)
    ↓
8. Ready for User Interaction
```

### 2. Furniture Placement Flow

```
User Drags Item from Side Panel
    ↓
handleDragStart(e)
    ├── Store draggedItem data
    └── Show drop indicator
    ↓
User Drops on Scene
    ↓
handleDrop(e)
    ├── Calculate drop position
    ├── Create <a-entity> for furniture
    ├── Add placeholder box (immediate visual feedback)
    ├── Set obj-model attribute (triggers A-Frame loader)
    ├── Add draggable-furniture component
    ├── Add clickable-furniture component
    ├── Set data-model-key attribute
    └── Add to cost estimation
    ↓
A-Frame Loads Model
    ├── Fetch OBJ file (from Supabase Storage or local)
    ├── Parse geometry
    ├── Create Three.js mesh
    └── Fire 'model-loaded' event
    ↓
Model Loaded Handler
    ├── Remove placeholder box
    └── Show actual 3D model
    ↓
Save Workspace State
    └── Update localStorage
```

### 3. Cost Calculation Flow

```
Furniture Added/Removed
    ↓
addItemToCost(modelKey, displayName)
    ├── Get price from PRICE_LIST[modelKey]
    ├── Increment quantity
    └── Update costState.items
    ↓
renderCost()
    ├── Clear cost items list
    ├── Iterate costState.items
    ├── Calculate line total (unitCost × qty)
    ├── Sum all line totals
    └── Update DOM
    ↓
User Clicks "Sources" Button
    ↓
showSourcesPanel(modelKey, itemName)
    ├── Get sources from ITEM_PRICE_SOURCES[modelKey]
    ├── Display store names and prices
    └── Show sources panel
```

### 4. Authentication Flow

```
User Action (Sign In/Sign Up)
    ↓
showAuthModal(callback)
    ├── Display auth modal
    └── Set up form handlers
    ↓
handleAuthSubmit()
    ├── Validate form
    ├── Call signIn() or signUp()
    └── Handle Supabase response
    ↓
Supabase Auth Response
    ├── Success: Update UI, call callback
    └── Error: Display error message
    ↓
updateAuthUI()
    ├── Show/hide profile circle
    ├── Update profile menu
    └── Enable/disable features
```

---

## Core Components Deep Dive

### 1. Planner Module (`js/planner.js`)

**Purpose**: Main application orchestrator

**Key Data Structures:**

```javascript
// Global state (module-level)
let ITEMS_DATA = {}; // model_key → {id, name, category, model_file_path}
let PRICE_LIST = {}; // model_key → estimated_price
let ITEM_METADATA = {}; // model_key → {name, model_file_path}
let ITEM_PRICE_SOURCES = {}; // model_key → [{store, price}]
let furnitureCounter = 0; // Unique ID generator

const costState = {
  items: {}, // model_key → {name, price, qty, unitCost}
  total: 0,
};
```

**Critical Functions:**

#### `loadItemsAndPrices()`

```javascript
async function loadItemsAndPrices() {
  // 1. Try to fetch items from Supabase (10s timeout)
  // 2. If timeout/error, use fallback metadata
  // 3. Try to fetch prices from Supabase (10s timeout)
  // 4. If no prices, use DUMMY_PRICES
  // 5. Calculate estimated prices
  // 6. Ensure all known items have entries
}
```

**Fallback Strategy:**

- Supabase timeout: 10 seconds
- If fetch fails → Use `FALLBACK_ITEM_METADATA`
- If no prices → Use `DUMMY_PRICES` constant
- All items guaranteed to have at least dummy price

#### `getModelUrl(modelKey)`

```javascript
function getModelUrl(modelKey) {
  // 1. Get file path from metadata or STORAGE_MODEL_FILES
  // 2. Check if file is in Supabase Storage bucket
  // 3. If yes, get public URL from Supabase Storage
  // 4. If no or error, fallback to local path: asset/models/{filename}
  // 5. Final fallback: asset/models/{modelKey}.obj
}
```

**Model Loading Priority:**

1. Supabase Storage (for specific files in `STORAGE_BUCKET_FILES`)
2. Local `asset/models/` folder
3. Model analyzer utility (if available)
4. Generic fallback path

#### `handleDrop(e)`

```javascript
function handleDrop(e) {
  // 1. Calculate drop position (center with randomization)
  // 2. Create <a-entity> element
  // 3. Add placeholder box (immediate feedback)
  // 4. Append to scene (must be in DOM before setting attributes)
  // 5. Set obj-model attribute (triggers A-Frame loader)
  // 6. Set draggable-furniture component
  // 7. Set clickable-furniture component
  // 8. Set up model loading timeout (30s)
  // 9. Add event listeners for model-loaded and model-error
  // 10. Update cost estimation
  // 11. Save workspace state
}
```

**Model Loading Timeout:**

- 30 seconds per model
- If timeout: Keep placeholder visible, change color to gray
- If error: Change placeholder to red

### 2. Draggable Furniture Component (`js/components/draggable-furniture.js`)

**Purpose**: Enables dragging furniture within 3D scene with collision detection

**How It Works:**

```javascript
AFRAME.registerComponent("draggable-furniture", {
  schema: {
    roomWidth: { type: "number", default: 10 },
    roomLength: { type: "number", default: 10 },
    objectWidth: { type: "number", default: 1.5 },
    objectLength: { type: "number", default: 1.5 },
    wallThickness: { type: "number", default: 0.1 },
  },

  init: function () {
    // 1. Store original color
    // 2. Set up raycaster for drag detection
    // 3. Add event listeners for mousedown, mousemove, mouseup
  },

  handleMouseDown: function (e) {
    // 1. Check if this entity was clicked
    // 2. Start drag operation
    // 3. Store initial position
  },

  handleMouseMove: function (e) {
    // 1. Calculate new position from mouse/raycast
    // 2. Check wall collisions
    // 3. Check boundary limits
    // 4. Update position if valid
    // 5. Change color: green (valid) or red (invalid)
  },

  isColliding: function (position) {
    // 1. Calculate inner room bounds (accounting for wall thickness)
    // 2. Check if position + object dimensions exceed bounds
    // 3. Return true if colliding
  },
});
```

**Collision Detection Algorithm:**

```javascript
// Inner room bounds (accounting for walls)
const innerX = roomWidth / 2 - wallThickness / 2;
const innerZ = roomLength / 2 - wallThickness / 2;

// Safe placement area (accounting for object size)
const safeXMin = -innerX + objectWidth / 2;
const safeXMax = innerX - objectWidth / 2;
const safeZMin = -innerZ + objectLength / 2;
const safeZMax = innerZ - objectLength / 2;

// Check collision
const isColliding =
  position.x < safeXMin ||
  position.x > safeXMax ||
  position.z < safeZMin ||
  position.z > safeZMax;
```

### 3. Clickable Furniture Component (`js/components/clickable-furniture.js`)

**Purpose**: Handles furniture selection and interaction

**How It Works:**

```javascript
AFRAME.registerComponent("clickable-furniture", {
  init: function () {
    // 1. Store original color
    // 2. Add click event listener
    // 3. Set up raycaster intersection
  },

  handleClick: function (e) {
    // 1. Prevent event bubbling
    // 2. Deselect previously selected furniture
    // 3. Select this furniture (change to green)
    // 4. Show control panel
    // 5. Store selected furniture ID
  },
});
```

### 4. Movement Component (`js/components/movement.js`)

**Purpose**: First-person camera movement controls

**How It Works:**

```javascript
AFRAME.registerComponent("custom-movement", {
  schema: {
    speed: { type: "number", default: 0.1 },
  },

  tick: function () {
    // Runs every frame (60fps)
    // 1. Check keyboard state (W/A/S/D/Q/E)
    // 2. Calculate movement direction
    // 3. Apply movement to camera rig
    // 4. Update position
  },
});
```

**Movement Calculations:**

```javascript
// Forward/backward (W/S)
const forward = new THREE.Vector3(0, 0, -1);
forward.applyQuaternion(cameraRig.object3D.quaternion);
forward.multiplyScalar(speed * (wPressed ? 1 : sPressed ? -1 : 0));

// Left/right (A/D)
const right = new THREE.Vector3(1, 0, 0);
right.applyQuaternion(cameraRig.object3D.quaternion);
right.multiplyScalar(speed * (dPressed ? 1 : aPressed ? -1 : 0));

// Up/down (Q/E)
const up = new THREE.Vector3(0, 1, 0);
up.multiplyScalar(speed * (qPressed ? 1 : ePressed ? -1 : 0));

// Apply movement
cameraRig.object3D.position.add(forward);
cameraRig.object3D.position.add(right);
cameraRig.object3D.position.add(up);
```

---

## 3D Rendering System

### A-Frame Scene Structure

```html
<a-scene>
  <!-- Sky/Background -->
  <a-sky color="#333333"></a-sky>

  <!-- Camera Rig (movable) -->
  <a-entity id="cameraRig" custom-movement>
    <a-camera look-controls wasd-controls="enabled: false"></a-camera>
  </a-entity>

  <!-- Lighting -->
  <a-light type="ambient" color="#ffffff" intensity="1.5"></a-light>
  <a-light
    type="directional"
    position="5 10 7"
    intensity="8"
    castShadow
  ></a-light>

  <!-- Floor -->
  <a-box id="floor" floor-resize></a-box>

  <!-- Room Walls Container -->
  <a-entity id="room-walls"></a-entity>

  <!-- Furniture Container -->
  <a-entity id="furniture-container"></a-entity>
</a-scene>
```

### Room Wall Creation

```javascript
function createRoomWalls(width, length, wallHeight) {
  // Creates 4 walls + 1 roof
  const walls = [
    {
      pos: `0 ${wallHeight / 2} ${-length / 2}`,
      size: `${width} ${wallHeight} 0.1`,
    }, // Front
    {
      pos: `0 ${wallHeight / 2} ${length / 2}`,
      size: `${width} ${wallHeight} 0.1`,
    }, // Back
    {
      pos: `${-width / 2} ${wallHeight / 2} 0`,
      size: `0.1 ${wallHeight} ${length}`,
    }, // Left
    {
      pos: `${width / 2} ${wallHeight / 2} 0`,
      size: `0.1 ${wallHeight} ${length}`,
    }, // Right
    { pos: `0 ${wallHeight} 0`, size: `${width} 0.1 ${length}` }, // Roof
  ];

  walls.forEach((wall) => {
    const wallEl = document.createElement("a-box");
    wallEl.setAttribute("position", wall.pos);
    wallEl.setAttribute("width" /* ... */);
    wallEl.setAttribute("height" /* ... */);
    wallEl.setAttribute("depth" /* ... */);
    wallEl.setAttribute("material", "color: #9d9d9d");
    wallEl.setAttribute("wall-outline", ""); // Custom component for wireframe
    wallsContainer.appendChild(wallEl);
  });
}
```

### Wall Visibility System

Walls are dynamically hidden when they block the camera's view:

```javascript
function updateWallVisibility() {
  // 1. Get camera position
  // 2. Check if camera is inside room
  // 3. If inside, show all walls
  // 4. If outside, raycast from camera to room center
  // 5. Hide walls that the ray passes through
  // 6. Update wall opacity (0 = hidden, 1 = visible)
}
```

---

## State Management

### Client-Side State (localStorage)

**Keys Used:**

```javascript
// Room dimensions
localStorage.setItem("roomWidth", "10");
localStorage.setItem("roomLength", "10");
localStorage.setItem("roomHeight", "3");

// Workspace state (auto-saved)
localStorage.setItem(
  "currentRoomState",
  JSON.stringify({
    room_width: 10,
    room_length: 10,
    furniture_data: [
      {
        model_key: "table1",
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    ],
    cost_total: 8500,
    costState: {
      /* ... */
    },
    furnitureCounter: 1,
  })
);

// Legacy format (backward compatibility)
localStorage.setItem(
  "workspaceState",
  JSON.stringify({
    furniture: [
      /* ... */
    ],
    costState: {
      /* ... */
    },
    furnitureCounter: 1,
  })
);

// UI state
localStorage.setItem("welcomeDialogShown", "true");
```

**Auto-Save Triggers:**

1. Page unload (`beforeunload` event)
2. Tab visibility change (`visibilitychange` event)
3. After furniture operations (add, delete, move, rotate)

### Server-Side State (Supabase)

**Tables:**

- `users`: User profiles and roles
- `items`: Furniture catalog
- `item_prices`: Price data from multiple stores
- `room_plans`: Saved room plans (currently using localStorage instead)

---

## API Integration

### Supabase Client Initialization

```javascript
// js/utils/supabase.js
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";

const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseAnonKey = "YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Database Queries

**Fetch Items:**

```javascript
const { data: items, error } = await supabase.from("items").select("*");
```

**Fetch Prices:**

```javascript
const { data: prices, error } = await supabase
  .from("item_prices")
  .select("*, items(model_key)");
```

**Storage URLs:**

```javascript
const { data } = supabase.storage
  .from("wardrobe-models")
  .getPublicUrl("wardrobe_modern.obj");
```

### Authentication

```javascript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: email,
  password: password,
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password,
});

// Sign out
await supabase.auth.signOut();

// Get current user
const {
  data: { user },
} = await supabase.auth.getUser();
```

---

## Error Handling & Fallbacks

### 1. Supabase Timeout Handling

```javascript
const SUPABASE_TIMEOUT = 10000; // 10 seconds

function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
}

async function withTimeout(promise, timeoutMs) {
  return Promise.race([promise, createTimeout(timeoutMs)]);
}

// Usage
try {
  const result = await withTimeout(
    supabase.from("items").select("*"),
    SUPABASE_TIMEOUT
  );
} catch (error) {
  // Use fallback data
  console.warn("Supabase timeout, using fallbacks");
}
```

### 2. Model Loading Fallbacks

```javascript
// Priority order:
// 1. Supabase Storage (if in STORAGE_BUCKET_FILES)
// 2. Local asset/models/ folder
// 3. Model analyzer utility
// 4. Generic fallback path

function getModelUrl(modelKey) {
  // Try Supabase Storage
  if (STORAGE_BUCKET_FILES.has(filePath)) {
    try {
      const { data } = supabase.storage
        .from("wardrobe-models")
        .getPublicUrl(filePath);
      if (data?.publicUrl) return data.publicUrl;
    } catch (error) {
      console.warn("Storage URL failed, using local fallback");
    }
  }

  // Fallback to local
  return `asset/models/${filePath}`;
}
```

### 3. Price Fallbacks

```javascript
// If no price from database, use dummy prices
const DUMMY_PRICES = {
  table1: {
    estimatedPrice: 8500,
    sources: [{ store: "Default Store", price: 8500 }],
  },
  // ... more items
};

// Applied in loadItemsAndPrices()
if (typeof PRICE_LIST[key] === "undefined" || PRICE_LIST[key] === 0) {
  if (DUMMY_PRICES[key]) {
    PRICE_LIST[key] = DUMMY_PRICES[key].estimatedPrice;
    ITEM_PRICE_SOURCES[key] = [...DUMMY_PRICES[key].sources];
  }
}
```

### 4. Model Loading Timeout

```javascript
const MODEL_LOAD_TIMEOUT = 30000; // 30 seconds

// Set timeout when model starts loading
modelLoadTimeout = setTimeout(() => {
  if (!modelLoaded) {
    console.warn("Model load timeout");
    // Keep placeholder visible, change color to gray
    placeholder.setAttribute("color", "#888888");
    placeholder.setAttribute("opacity", "0.5");
  }
}, MODEL_LOAD_TIMEOUT);

// Clear timeout when model loads
furnitureEl.addEventListener("model-loaded", () => {
  clearTimeout(modelLoadTimeout);
  placeholder.remove();
});
```

---

## File Structure & Dependencies

### Complete File Tree

```
3D-RoomPlanner/
├── index.html                 # Welcome page
├── planner.html              # Main 3D planner
├── profile.html              # User profile
├── admin.html                # Admin dashboard
│
├── css/
│   ├── variables.css         # CSS custom properties (design tokens)
│   ├── components.css        # Reusable component classes
│   ├── index.css             # Welcome page styles
│   ├── planner.css           # Planner styles
│   ├── profile.css           # Profile styles
│   ├── admin.css             # Admin styles
│   ├── auth.css              # Auth modal styles
│   └── dialog.css            # Dialog styles
│
├── js/
│   ├── index.js              # Welcome page logic
│   ├── planner.js            # Main planner logic (2500+ lines)
│   ├── profile.js            # Profile page logic
│   ├── admin.js              # Admin panel logic
│   │
│   ├── auth/
│   │   ├── auth.js           # Auth functions (Supabase)
│   │   └── auth-ui.js        # Auth UI management
│   │
│   ├── components/           # A-Frame custom components
│   │   ├── movement.js       # Camera movement
│   │   ├── draggable-furniture.js  # Drag & drop
│   │   ├── clickable-furniture.js  # Selection
│   │   ├── floor-resize.js   # Floor resizing
│   │   ├── smart-placement.js      # Collision detection
│   │   ├── position-debug.js # Debug visualization
│   │   └── profile-menu.js   # Profile dropdown
│   │
│   └── utils/
│       ├── supabase.js       # Supabase client
│       ├── snapshot.js       # Screenshot capture
│       ├── dialog.js         # Dialog utilities
│       ├── cost-estimation.js # Cost management
│       ├── workspace-state.js # State management
│       ├── migrate-data.js   # Data migration
│       ├── model-analyzer.js # Model file mapping
│       └── debug.js          # Debug utilities
│
├── asset/
│   ├── models/               # Local 3D model files
│   │   ├── bed1.obj
│   │   ├── bed2.obj
│   │   ├── chair1.obj
│   │   ├── chair2.obj
│   │   ├── desk1.obj
│   │   ├── desk2.obj
│   │   ├── mirror1.obj
│   │   ├── mirror2.obj
│   │   ├── shelf1.obj
│   │   ├── shelf2.obj
│   │   ├── center_table1.obj
│   │   ├── center_table2.obj
│   │   ├── wardrobe_modern.obj
│   │   ├── wardrobe_traditional.obj
│   │   └── wardrobe_openframe.obj
│   └── textures/
│       └── wood4k.png        # Floor texture
│
├── tailwind.config.js        # Tailwind CSS configuration
├── database-setup.sql        # Database schema
└── DOCUMENTATION.md          # User documentation
```

### External Dependencies (CDN)

```html
<!-- A-Frame -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>

<!-- Supabase -->
<script type="module">
  import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2";
</script>

<!-- HTML2Canvas (for screenshots) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
```

---

## Key Algorithms

### 1. Price Calculation

```javascript
function calculateEstimatedPrice(prices) {
  if (!prices || prices.length === 0) return 0;
  const sum = prices.reduce((acc, price) => acc + price, 0);
  return Math.round((sum / prices.length) * 100) / 100;
}
```

**Algorithm**: Arithmetic mean (average) of all store prices, rounded to 2 decimal places.

### 2. Collision Detection

```javascript
function isFurnitureOutsideBoundaries(
  position,
  roomWidth,
  roomLength,
  objWidth,
  objLength,
  wallThickness
) {
  // Calculate inner room bounds
  const innerX = roomWidth / 2 - wallThickness / 2;
  const innerZ = roomLength / 2 - wallThickness / 2;

  // Calculate safe placement area (object center must be within bounds)
  const safeXMin = -innerX + objWidth / 2;
  const safeXMax = innerX - objWidth / 2;
  const safeZMin = -innerZ + objLength / 2;
  const safeZMax = innerZ - objLength / 2;

  // Check if position is outside safe area
  return (
    position.x < safeXMin ||
    position.x > safeXMax ||
    position.z < safeZMin ||
    position.z > safeZMax
  );
}
```

**Algorithm**: Axis-aligned bounding box (AABB) collision detection.

### 3. Wall Visibility Raycasting

```javascript
function updateWallVisibility() {
  const cameraPos = /* get camera position */;
  const target = new THREE.Vector3(0, 1.5, 0); // Room center

  // Create raycaster
  const raycaster = new THREE.Raycaster();
  const direction = target.clone().sub(cameraPos).normalize();
  raycaster.set(cameraPos, direction);

  // Intersect with walls
  const intersects = raycaster.intersectObjects(wallMeshes);

  // Hide walls between camera and center
  intersects.forEach(hit => {
    if (hit.distance < cameraPos.distanceTo(target)) {
      hit.object.visible = false; // Hide wall
    }
  });
}
```

**Algorithm**: Raycasting from camera to room center, hiding walls that block the view.

### 4. Workspace State Serialization

```javascript
function collectRoomPlanData() {
  const furnitureContainer = document.getElementById("furniture-container");
  const furnitureData = [];

  furnitureContainer.querySelectorAll('[id^="furniture-"]').forEach((item) => {
    const position = item.getAttribute("position");
    const rotation = item.getAttribute("rotation");
    const scale = item.getAttribute("scale");
    const modelKey = item.getAttribute("data-model-key");

    furnitureData.push({
      model_key: modelKey,
      position: parsePosition(position), // "0 0 0" → {x: 0, y: 0, z: 0}
      rotation: parseRotation(rotation),
      scale: parseScale(scale),
    });
  });

  return {
    room_width: parseFloat(localStorage.getItem("roomWidth")),
    room_length: parseFloat(localStorage.getItem("roomLength")),
    furniture_data: furnitureData,
    cost_total: costState.total,
  };
}
```

**Algorithm**: Traverse DOM, extract A-Frame entity attributes, serialize to JSON.

---

## Styling System

### CSS Architecture

**1. Design Tokens (`css/variables.css`)**

```css
:root {
  --color-bg-primary: #0a0a0a;
  --color-bg-surface: rgba(15, 15, 15, 0.96);
  --color-text-primary: #ffffff;
  --spacing-base: 16px;
  --radius-lg: 12px;
  /* ... more tokens */
}
```

**2. Component Classes (`css/components.css`)**

```css
.btn {
  padding: var(--spacing-sm) var(--spacing-base);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  /* ... */
}
```

**3. Page-Specific Styles**

- `index.css`: Welcome page
- `planner.css`: Main planner (panels, cost, furniture library)
- `profile.css`: Profile page
- `admin.css`: Admin dashboard

**4. Tailwind CSS Integration**

- Utility-first classes for rapid development
- Custom theme configuration matching dark theme
- CDN-based (no build step required)

---

## Performance Considerations

### 1. Model Loading

- **Placeholder boxes**: Immediate visual feedback while models load
- **Timeout handling**: Prevents indefinite loading states
- **Error handling**: Graceful degradation if model fails to load

### 2. State Management

- **localStorage**: Fast client-side persistence
- **Auto-save**: Only on significant events (not every frame)
- **State compression**: Only essential data stored

### 3. Rendering

- **Wall visibility**: Dynamic hiding reduces overdraw
- **A-Frame optimization**: Uses Three.js instancing where possible
- **Shadow casting**: Limited to directional light only

### 4. Network

- **Timeout handling**: Prevents long waits on slow connections
- **Fallback data**: App works offline with dummy prices
- **CDN usage**: External libraries loaded from CDN

---

## Security Considerations

### 1. Authentication

- **Supabase Auth**: Secure token-based authentication
- **Session management**: Automatic token refresh
- **Role-based access**: Admin vs user roles

### 2. Database

- **Row Level Security (RLS)**: Enforced at database level
- **Public read**: Items and prices readable by all
- **Admin-only write**: Only admins can modify catalog

### 3. Client-Side

- **Input validation**: All user inputs validated
- **XSS prevention**: No innerHTML with user data (except sanitized)
- **CSRF protection**: Supabase handles CSRF tokens

---

## Testing & Debugging

### Debug Utilities

```javascript
// js/utils/debug.js
function logPosition(entity) {
  const pos = entity.getAttribute("position");
  console.log(`Position: ${pos.x}, ${pos.y}, ${pos.z}`);
}

// Position debug component
AFRAME.registerComponent("position-debug", {
  tick: function () {
    console.log(this.el.getAttribute("position"));
  },
});
```

### Common Issues & Solutions

1. **Models not loading**

   - Check browser console for CORS errors
   - Verify file paths in `getModelUrl()`
   - Check Supabase Storage bucket permissions

2. **Furniture not draggable**

   - Verify `draggable-furniture` component is attached
   - Check room dimensions are set
   - Verify raycaster is working

3. **Cost not updating**
   - Check `PRICE_LIST` is populated
   - Verify `costState.items` structure
   - Check `renderCost()` is being called

---

## Future Enhancements

### Planned Features

1. **Database Integration**: Move from localStorage to Supabase for room plans
2. **Real-time Collaboration**: Multiple users editing same room
3. **VR Mode**: Full VR support with A-Frame VR components
4. **Advanced Materials**: PBR materials, texture support
5. **Furniture Customization**: Color, size, material options
6. **Export Formats**: OBJ, GLTF, JSON export
7. **Mobile Optimization**: Touch controls, responsive UI

### Technical Debt

1. **Code Organization**: Split `planner.js` into smaller modules
2. **Type Safety**: Consider TypeScript migration
3. **Testing**: Add unit tests for core functions
4. **Documentation**: JSDoc comments for all functions
5. **Performance**: Optimize wall visibility updates (throttle)

---

## Conclusion

This 3D Room Planner is a sophisticated web application that combines:

- **3D Graphics**: A-Frame/Three.js for immersive visualization
- **Backend Services**: Supabase for scalable infrastructure
- **Client-Side Logic**: Vanilla JavaScript for flexibility
- **Modern UI**: Tailwind CSS and custom components

The architecture prioritizes:

- **User Experience**: Fast, responsive, intuitive
- **Reliability**: Fallbacks and error handling
- **Maintainability**: Modular, well-organized code
- **Scalability**: Can grow with additional features

For questions or contributions, refer to the main `DOCUMENTATION.md` file for user-facing documentation.
