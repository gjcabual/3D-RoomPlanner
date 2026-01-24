# 3D Room Planner - Complete Code Architecture Documentation

## Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack Analysis](#technology-stack-analysis)
3. [Architecture Patterns](#architecture-patterns)
4. [Data Flow](#data-flow)
5. [Core Components Deep Dive](#core-components-deep-dive)
6. [3D Rendering System](#3d-rendering-system)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Error Handling & Fallbacks](#error-handling--fallbacks)
10. [File Structure & Dependencies](#file-structure--dependencies)
11. [Key Algorithms](#key-algorithms)

---

## System Overview

The 3D Room Planner is a client-side web application that combines:

- **3D Rendering**: A-Frame framework for WebGL-based 3D graphics
- **Backend Services**: Supabase for authentication, database, and file storage
- **State Management**: localStorage for client-side persistence
- **UI Framework**: Vanilla JavaScript with custom CSS components and Tailwind CSS

---

## Technology Stack Analysis

### Frontend Technologies

| Technology | Version | Purpose | CDN/Source |
|------------|---------|---------|------------|
| **HTML5** | - | Document structure, semantic markup | Native |
| **CSS3** | - | Styling with Custom Properties (CSS Variables) | Native |
| **JavaScript** | ES6+ | Application logic, DOM manipulation | Native |
| **A-Frame** | 1.5.0 | WebXR/VR framework for 3D rendering | `https://aframe.io/releases/1.5.0/aframe.min.js` |
| **Three.js** | (via A-Frame) | 3D math, WebGL abstraction, scene graph | Bundled with A-Frame |
| **Tailwind CSS** | 3.x | Utility-first CSS framework | `https://cdn.tailwindcss.com` |
| **HTML2Canvas** | 1.4.1 | Screenshot/snapshot capture | `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js` |
| **Supabase JS** | 2.x | Supabase client SDK | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` |

### Backend Technologies (BaaS - Backend as a Service)

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend as a Service platform |
| **PostgreSQL** | Relational database (hosted by Supabase) |
| **Supabase Auth** | Email/password authentication, JWT tokens |
| **Supabase Storage** | File storage for 3D models (OBJ files) |
| **Row Level Security (RLS)** | Database-level access control policies |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Vite** | Development server and build tool (hot module replacement) |
| **Git** | Version control |

### 3D Asset Formats

| Format | Purpose |
|--------|---------|
| **OBJ (Wavefront)** | 3D model geometry files |
| **PNG** | Texture files (e.g., wood4k.png for floor) |
| **JPG** | Thumbnail images for furniture items |

### Technology Stack Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   HTML5     │  │    CSS3     │  │    JavaScript ES6+      │ │
│  │  Structure  │  │   Styling   │  │    Application Logic    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    A-Frame 1.5.0                         │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │              Three.js (WebGL)                    │    │   │
│  │  │  - Scene Graph    - Materials    - Raycasting   │    │   │
│  │  │  - Geometry       - Lighting     - Animation    │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  Custom Components:                                      │   │
│  │  - draggable-furniture  - clickable-furniture           │   │
│  │  - custom-movement      - floor-resize                  │   │
│  │  - wall-mounted         - smart-placement               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Tailwind CSS │  │ HTML2Canvas  │  │   Supabase JS SDK    │  │
│  │   Styling    │  │  Snapshots   │  │   API Client         │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT-SIDE STORAGE                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    localStorage                           │  │
│  │  - Room dimensions (width, length, height)               │  │
│  │  - Workspace state (furniture positions, rotations)      │  │
│  │  - Cost state (items, quantities, totals)                │  │
│  │  - User preferences (welcomeDialogShown)                 │  │
│  │  - Saved cost estimations                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND LAYER (Supabase)                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Supabase  │  │   Supabase  │  │      Supabase           │ │
│  │     Auth    │  │   Database  │  │      Storage            │ │
│  │  (JWT/Email)│  │ (PostgreSQL)│  │   (OBJ Models)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                                                                 │
│  Database Tables:                                               │
│  ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────────┐   │
│  │  users   │ │  items   │ │ item_prices │ │  room_plans  │   │
│  └──────────┘ └──────────┘ └─────────────┘ └──────────────┘   │
│                                                                 │
│  Row Level Security (RLS) Policies:                            │
│  - Users: Read/update own profile only                         │
│  - Items: Public read, admin-only write                        │
│  - Prices: Public read, admin-only write                       │
│  - Plans: Users access own plans only                          │
└─────────────────────────────────────────────────────────────────┘
```

### Why These Technologies?

| Technology | Rationale |
|------------|-----------|
| **A-Frame** | Simplifies WebGL/Three.js development with declarative HTML-like syntax; built-in VR support; Entity-Component-System architecture |
| **Supabase** | Open-source Firebase alternative; PostgreSQL with real-time subscriptions; built-in auth and storage; generous free tier |
| **Tailwind CSS** | Rapid UI development; consistent design tokens; no CSS naming conflicts; tree-shakable |
| **Vanilla JS** | No framework overhead; direct DOM manipulation; full control over application flow |
| **localStorage** | Offline-first capability; instant state persistence; no server round-trips for workspace state |
| **OBJ Format** | Universal 3D format; well-supported by A-Frame/Three.js; human-readable |

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

**Custom A-Frame Components:**

| Component | File | Purpose |
|-----------|------|---------|
| `custom-movement` | `movement.js` | First-person camera controls (WASD + Q/E for vertical) |
| `draggable-furniture` | `draggable-furniture.js` | Drag interactions with wall collision detection |
| `clickable-furniture` | `clickable-furniture.js` | Selection, highlighting, and control panel display |
| `floor-resize` | `floor-resize.js` | Dynamic floor plane resizing based on room dimensions |
| `smart-placement` | `smart-placement.js` | Intelligent furniture positioning with collision avoidance |
| `wall-mounted` | `wall-mounted.js` | Wall-mounted furniture behavior (mirrors, shelves) |
| `wall-outline` | `planner.js` | Renders black edge outlines on room walls |
| `position-debug` | `position-debug.js` | Debug visualization for furniture positions |

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
├── index.html                 # Welcome page (room dimension input)
├── planner.html               # Main 3D room planner interface
├── profile.html               # User profile and saved estimations
├── admin.html                 # Admin dashboard for item/price management
│
├── css/
│   ├── variables.css          # CSS Custom Properties (design tokens)
│   ├── components.css         # Reusable component classes
│   ├── index.css              # Welcome page styles (3D cube, inputs)
│   ├── planner.css            # Planner styles (panels, cost board)
│   ├── profile.css            # Profile page styles
│   ├── admin.css              # Admin dashboard styles
│   ├── auth.css               # Authentication modal styles
│   └── dialog.css             # Dialog/modal styles
│
├── js/
│   ├── index.js               # Welcome page logic (validation, navigation)
│   ├── planner.js             # Main planner logic (~2900 lines)
│   ├── profile.js             # Profile page logic
│   ├── admin.js               # Admin panel logic
│   ├── html-loader.js         # HTML component loader utility
│   │
│   ├── auth/
│   │   ├── auth.js            # Authentication functions (Supabase Auth)
│   │   └── auth-ui.js         # Authentication UI management
│   │
│   ├── components/            # A-Frame custom components
│   │   ├── index.js           # Component exports
│   │   ├── movement.js        # First-person camera movement (WASD/QE)
│   │   ├── draggable-furniture.js  # Drag & drop with collision
│   │   ├── clickable-furniture.js  # Selection and highlighting
│   │   ├── floor-resize.js    # Dynamic floor resizing
│   │   ├── smart-placement.js # Intelligent positioning
│   │   ├── wall-mounted.js    # Wall-mounted furniture behavior
│   │   ├── position-debug.js  # Debug visualization
│   │   └── profile-menu.js    # Profile dropdown menu
│   │
│   └── utils/
│       ├── supabase.js        # Supabase client initialization
│       ├── snapshot.js        # Screenshot capture (HTML2Canvas)
│       ├── dialog.js          # Custom dialog utilities
│       ├── cost-estimation.js # Cost calculation and persistence
│       ├── workspace-state.js # Workspace state management
│       ├── migrate-data.js    # Data migration utilities
│       ├── model-analyzer.js  # Model file mapping
│       └── debug.js           # Debug utilities
│
├── components/                # HTML component templates
│   ├── auth-modal.html        # Authentication modal markup
│   ├── cost-panel.html        # Cost estimator panel markup
│   ├── dialog-modal.html      # Dialog modal markup
│   ├── furniture-controls.html # Furniture control panel markup
│   ├── instructions.html      # Instructions panel markup
│   ├── profile-circle.html    # Profile menu markup
│   ├── resize-panel.html      # Resize dimension panel markup
│   ├── side-panel.html        # Furniture library sidebar markup
│   └── sources-panel.html     # Price sources panel markup
│
├── asset/
│   ├── models/                # 3D furniture models (OBJ format)
│   │   ├── bed1.obj, bed2.obj
│   │   ├── chair1.obj, chair2.obj
│   │   ├── desk1.obj, desk2.obj
│   │   ├── mirror1.obj, mirror2.obj
│   │   ├── shelf1.obj, shelf2.obj
│   │   ├── center_table1.obj, center_table2.obj
│   │   ├── wardrobe_modern.obj
│   │   ├── wardrobe_traditional.obj
│   │   └── wardrobe_openframe.obj
│   ├── images/
│   │   └── thumbnails/        # Furniture thumbnail images (JPG)
│   │       ├── center_table1.jpg, center_table2.jpg
│   │       ├── wardrobe3.jpg
│   │       └── ... (other thumbnails)
│   └── textures/
│       └── wood4k.png         # Floor wood texture (4K)
│
├── .vite/                     # Vite development server cache
│   └── deps/
│
├── .vscode/
│   └── settings.json          # VS Code workspace settings
│
├── .cursor/
│   └── plans/                 # Development plans (Cursor AI)
│
├── tailwind.config.js         # Tailwind CSS configuration
├── database-setup.sql         # PostgreSQL schema for Supabase
├── README-DATABASE-SETUP.md   # Database setup instructions
├── DOCUMENTATION.md           # User-facing documentation
└── CODE_ARCHITECTURE.md       # This file - technical architecture
```

### File Statistics

| Category | Count | Description |
|----------|-------|-------------|
| HTML Pages | 4 | Main application pages |
| CSS Files | 8 | Styling files |
| JavaScript Files | 19 | Application logic |
| HTML Components | 9 | Reusable HTML templates |
| 3D Models | 15 | OBJ furniture models |
| Textures | 1 | PNG floor texture |
| Thumbnails | ~15 | JPG preview images |

### External Dependencies (CDN)

All external libraries are loaded via CDN for simplicity and to avoid build steps:

```html
<!-- A-Frame 1.5.0 - WebXR/VR Framework (includes Three.js) -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>

<!-- Supabase JS SDK v2 - Backend as a Service client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- HTML2Canvas 1.4.1 - Screenshot capture library -->
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>

<!-- Tailwind CSS 3.x - Utility-first CSS framework (JIT CDN) -->
<script src="https://cdn.tailwindcss.com"></script>
```

**Dependency Load Order (planner.html):**

1. CSS files (variables.css, components.css, planner.css, auth.css, profile.css, dialog.css)
2. Tailwind CSS with custom configuration
3. Supabase JS SDK
4. HTML2Canvas
5. A-Frame (must load before custom components)
6. Custom A-Frame components (movement.js, floor-resize.js, etc.)
7. Utility scripts (supabase.js, auth.js, etc.)
8. Main application script (planner.js)

**Why CDN over NPM/Bundling:**

- Zero build step required
- Faster development iteration
- Browser caching benefits
- Simpler deployment (static files only)
- No node_modules overhead

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

The styling system uses a layered approach combining CSS Custom Properties (design tokens), custom component classes, and Tailwind CSS utilities.

**Architecture Layers:**

```
┌─────────────────────────────────────────────────────┐
│          Tailwind CSS Utilities (inline)            │
│   Classes like: flex, items-center, bg-bg-primary   │
├─────────────────────────────────────────────────────┤
│         Page-Specific Styles (css/*.css)            │
│   index.css, planner.css, profile.css, admin.css    │
├─────────────────────────────────────────────────────┤
│         Component Classes (components.css)          │
│   .btn, .card, .panel, .modal, .badge, .tooltip     │
├─────────────────────────────────────────────────────┤
│         Design Tokens (variables.css)               │
│   CSS Custom Properties for colors, spacing, etc.   │
└─────────────────────────────────────────────────────┘
```

**1. Design Tokens (`css/variables.css`)**

Centralized CSS Custom Properties for consistent theming:

```css
:root {
  /* Colors */
  --color-bg-primary: #0a0a0a;
  --color-bg-surface: rgba(15, 15, 15, 0.96);
  --color-text-primary: #ffffff;
  --color-accent-success: #4CAF50;
  --color-accent-error: #f44336;
  --color-accent-orange: #FF8C00;

  /* Spacing (4px base unit) */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-base: 16px;
  --spacing-lg: 20px;

  /* Typography */
  --font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-size-base: 1rem;

  /* Shadows */
  --shadow-md: 0 4px 20px rgba(0, 0, 0, 0.3);
  --shadow-panel: 2px 0 20px rgba(0, 0, 0, 0.5);

  /* Border Radius */
  --radius-md: 8px;
  --radius-lg: 10px;

  /* Z-Index Scale */
  --z-side-panel: 1500;
  --z-dialog: 10001;
}
```

**2. Tailwind CSS Configuration (inline in HTML)**

Each HTML page includes a Tailwind configuration that extends the default theme with custom design tokens:

```javascript
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "bg-primary": "#0a0a0a",
        "bg-surface": "rgba(15, 15, 15, 0.96)",
        "text-primary": "#ffffff",
        "accent-success": "#4CAF50",
        "accent-error": "#f44336",
      },
      spacing: {
        xs: "4px",
        sm: "8px",
        base: "16px",
      },
      boxShadow: {
        md: "0 4px 20px rgba(0, 0, 0, 0.3)",
        panel: "2px 0 20px rgba(0, 0, 0, 0.5)",
      },
      zIndex: {
        "side-panel": "1500",
        dialog: "10001",
      },
    },
  },
};
```

**3. Component Classes (`css/components.css`)**

Reusable component styles that use design tokens:

```css
.btn {
  padding: var(--spacing-sm) var(--spacing-base);
  background: var(--color-bg-surface);
  border-radius: var(--radius-lg);
  transition: var(--transition-base);
}

.btn:hover {
  background: var(--color-bg-hover);
}
```

**4. Page-Specific Styles**

| File | Purpose |
|------|---------|
| `index.css` | Welcome page (3D cube animation, dimension inputs) |
| `planner.css` | Main planner (panels, cost board, furniture library) |
| `profile.css` | User profile page styles |
| `admin.css` | Admin dashboard styles |
| `auth.css` | Authentication modal styles |
| `dialog.css` | Dialog/modal styles (welcome, confirm, prompt) |

**5. Dark Theme Implementation**

- All pages use `class="dark"` on the body element
- Color scheme is dark by default (no light mode)
- Consistent dark palette across all pages (#0a0a0a base)

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

### Technology Summary

This 3D Room Planner is a modern web application built with a carefully chosen technology stack:

| Layer | Technologies |
|-------|--------------|
| **3D Rendering** | A-Frame 1.5.0, Three.js (WebGL) |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript ES6+ |
| **Styling** | Tailwind CSS 3.x, CSS Custom Properties |
| **Backend** | Supabase (PostgreSQL, Auth, Storage) |
| **Utilities** | HTML2Canvas (screenshots) |
| **Development** | Vite (dev server), Git (version control) |

### Architecture Strengths

| Aspect | Implementation |
|--------|----------------|
| **User Experience** | Immediate visual feedback, smooth 3D navigation, intuitive drag-and-drop |
| **Reliability** | Multi-layer fallback system, timeout handling, offline capability |
| **Performance** | CDN-loaded libraries, localStorage caching, lazy model loading |
| **Maintainability** | Modular component architecture, centralized design tokens, clear separation of concerns |
| **Scalability** | Entity-Component-System pattern, database-backed catalog, extensible furniture library |
| **Security** | Row Level Security, JWT authentication, input validation |

### Key Technical Decisions

1. **A-Frame over raw Three.js**: Simplified development with declarative HTML-like syntax
2. **Supabase over custom backend**: Reduced server maintenance, built-in auth/storage
3. **CDN over bundling**: Zero build step, faster iteration, browser caching
4. **localStorage for workspace**: Instant persistence, offline-first experience
5. **CSS Custom Properties + Tailwind**: Consistent theming with rapid utility development

### Future Technical Considerations

- **Performance**: Consider model LOD (Level of Detail) for complex scenes
- **Mobile**: Touch controls and responsive 3D viewport
- **Real-time**: Supabase Realtime for collaborative editing
- **Export**: glTF export for broader 3D software compatibility
- **Testing**: Jest/Playwright for automated testing

---

For user-facing documentation, refer to `DOCUMENTATION.md`.  
For database setup instructions, refer to `README-DATABASE-SETUP.md`.
