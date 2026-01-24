# 3D Room Planner - Complete Documentation

## Overview

The 3D Room Planner is a web-based application that allows users to design and visualize room layouts in 3D space. Users can drag and drop furniture items, view cost estimations, save snapshots of their designs, and manage their saved plans. The application uses A-Frame for 3D rendering, Supabase for backend services (authentication, database, and storage), and vanilla JavaScript for the frontend logic.

## Architecture

### Technology Stack

#### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **HTML5** | - | Document structure and semantic markup |
| **CSS3** | - | Styling with CSS Custom Properties (design tokens) |
| **JavaScript** | ES6+ | Application logic, DOM manipulation, event handling |
| **A-Frame** | 1.5.0 | WebXR/VR framework for 3D rendering (built on Three.js) |
| **Three.js** | (via A-Frame) | 3D math, WebGL abstraction, scene graph management |
| **Tailwind CSS** | 3.x (CDN) | Utility-first CSS framework for rapid UI development |
| **HTML2Canvas** | 1.4.1 | Screenshot/snapshot capture functionality |
| **Supabase JS SDK** | 2.x | Client SDK for Supabase backend services |

#### Backend Technologies (Supabase BaaS)

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend as a Service platform |
| **PostgreSQL** | Relational database for items, prices, users, room plans |
| **Supabase Auth** | Email/password authentication with JWT tokens |
| **Supabase Storage** | Cloud storage for 3D model files (OBJ format) |
| **Row Level Security (RLS)** | Database-level access control policies |

#### Development Tools

| Tool | Purpose |
|------|---------|
| **Vite** | Development server with hot module replacement |
| **Git** | Version control |

#### 3D Asset Formats

| Format | Usage |
|--------|-------|
| **OBJ (Wavefront)** | 3D furniture model geometry |
| **PNG** | Textures (floor wood texture) |
| **JPG** | Thumbnail images for furniture library |

#### CDN Dependencies

```html
<!-- A-Frame 3D Framework -->
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>

<!-- Supabase Client SDK -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Screenshot Capture -->
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>

<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>
```

### Project Structure

```
3D-RoomPlanner/
├── index.html              # Welcome/Setup page (room dimensions)
├── planner.html            # Main 3D planner interface
├── profile.html            # User profile page
├── admin.html              # Admin dashboard
├── database-setup.sql      # PostgreSQL schema for Supabase
├── README-DATABASE-SETUP.md # Database setup instructions
├── tailwind.config.js      # Tailwind CSS configuration
├── DOCUMENTATION.md        # This file - user documentation
├── CODE_ARCHITECTURE.md    # Technical architecture documentation
│
├── css/
│   ├── variables.css      # CSS Custom Properties (design tokens)
│   ├── components.css     # Reusable component classes
│   ├── index.css          # Welcome page styles (dark theme, 3D cube)
│   ├── planner.css        # Main planner styles (panels, cost board)
│   ├── profile.css        # Profile page styles
│   ├── admin.css          # Admin panel styles
│   ├── auth.css           # Authentication modal styles
│   └── dialog.css         # Dialog modal styles
│
├── js/
│   ├── index.js           # Welcome page logic
│   ├── planner.js         # Main planner application logic (~2900 lines)
│   ├── profile.js         # Profile page logic
│   ├── admin.js           # Admin panel logic
│   ├── html-loader.js     # HTML component loader utility
│   ├── auth/
│   │   ├── auth.js        # Authentication functions (Supabase Auth)
│   │   └── auth-ui.js     # Authentication UI management
│   ├── components/        # A-Frame custom components
│   │   ├── index.js       # Component exports
│   │   ├── movement.js    # Camera movement (WASD/QE)
│   │   ├── draggable-furniture.js  # Drag and drop with collision
│   │   ├── clickable-furniture.js  # Selection and interaction
│   │   ├── floor-resize.js         # Dynamic floor resizing
│   │   ├── smart-placement.js      # Intelligent positioning
│   │   ├── wall-mounted.js         # Wall-mounted furniture behavior
│   │   ├── position-debug.js       # Debug visualization
│   │   └── profile-menu.js         # Profile dropdown menu
│   └── utils/
│       ├── supabase.js    # Supabase client initialization
│       ├── snapshot.js    # Screenshot capture (HTML2Canvas)
│       ├── dialog.js      # Custom dialog utilities
│       ├── cost-estimation.js # Cost calculation and persistence
│       ├── workspace-state.js # Workspace state management
│       ├── migrate-data.js    # Data migration utilities
│       ├── model-analyzer.js  # Model file mapping
│       └── debug.js           # Debug utilities
│
├── components/            # HTML component templates
│   ├── auth-modal.html
│   ├── cost-panel.html
│   ├── dialog-modal.html
│   ├── furniture-controls.html
│   ├── instructions.html
│   ├── profile-circle.html
│   ├── resize-panel.html
│   ├── side-panel.html
│   └── sources-panel.html
│
├── asset/
│   ├── models/            # 3D furniture models (OBJ format, 15 files)
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
│   │   └── thumbnails/    # Furniture preview images (JPG)
│   └── textures/
│       └── wood4k.png     # Floor wood texture (4K resolution)
│
├── .vite/                 # Vite development server cache
└── .vscode/               # VS Code workspace settings
```

## Core Modules

### 1. Authentication Module (`js/auth/`)

#### `auth.js`

Handles all authentication operations with Supabase:

- **`signUp(email, password, role)`**: Creates a new user account
- **`signIn(email, password)`**: Authenticates existing user
- **`signOut()`**: Signs out the current user
- **`getCurrentUser()`**: Retrieves the currently authenticated user
- **`checkAuth()`**: Checks if a user is currently authenticated
- **`isAdmin()`**: Verifies if the current user has admin privileges
- **`getUserProfile()`**: Fetches user profile data from the database

#### `auth-ui.js`

Manages the authentication UI and state:

- **`showAuthModal(callback)`**: Displays the authentication modal
- **`hideAuthModal()`**: Hides the authentication modal
- **`switchAuthMode()`**: Toggles between sign-in and sign-up modes
- **`handleAuthSubmit()`**: Processes authentication form submission
- **`updateAuthUI()`**: Updates UI elements based on authentication state

### 2. Welcome Page Module (`js/index.js`)

Handles the initial setup page where users enter room dimensions:

- **`startPlanner()`**: Validates and stores room dimensions (width, length, height) to localStorage, then redirects to planner
- **Input validation**: Ensures all three dimensions are between 1M and 20M
- **Keyboard navigation**: Supports Enter key to start planner and Tab navigation between inputs

### 3. Main Planner Module (`js/planner.js`)

The core application logic for the 3D room planner:

#### Key Functions:

- **`loadItemsAndPrices()`**: Fetches furniture items and prices from Supabase with timeout handling and fallbacks
- **`calculateEstimatedPrice(prices)`**: Calculates average price from multiple store prices
- **`getModelUrl(modelKey)`**: Resolves model file URLs with fallback chain (Supabase Storage → local → model analyzer)
- **`getItemName(modelKey)`**: Gets display name for furniture items
- **`initializeRoom()`**: Sets up the 3D room with dimensions from localStorage (width, length, height)
- **`createRoomWalls(width, length, height)`**: Dynamically creates room walls with specified height
- **`showWelcomeDialog()`**: Displays welcome dialog with instructions (one-time only, tracked via localStorage)
- **`handleDragStart(e)`**: Initiates drag operation from furniture library
- **`handleDrop(e)`**: Handles furniture placement in the 3D scene with model loading timeout
- **`renderCost()`**: Updates cost estimation display
- **`toggleCostPanel()`**: Shows/hides the cost panel
- **`deleteFurniture()`**: Removes furniture from the scene
- **`rotateFurnitureLeft()` / `rotateFurnitureRight()`**: Rotates selected furniture
- **`saveWorkspaceState()`**: Saves current room state to localStorage
- **`restoreRoom(roomData)`**: Restores room from saved state
- **`restoreWorkspaceState()`**: Legacy function to restore workspace state
- **`showBedSubcategory()` / `showChairSubcategory()` / `showDeskSubcategory()` / `showMirrorSubcategory()` / `showShelfSubcategory()`**: Display subcategory panels for furniture selection

#### Data Structures:

- **`ITEMS_DATA`**: Map of model_key → item data
- **`PRICE_LIST`**: Map of model_key → estimated price
- **`ITEM_METADATA`**: Map of model_key → metadata (name, model_file_path)
- **`ITEM_PRICE_SOURCES`**: Map of model_key → array of {store, price} objects
- **`costState`**: Object tracking furniture costs and totals
- **`furnitureCounter`**: Counter for unique furniture IDs
- **`DUMMY_PRICES`**: Fallback prices for all items when Supabase is unavailable
- **`FALLBACK_ITEM_NAMES`**: Fallback display names for all furniture items
- **`FALLBACK_ITEM_METADATA`**: Fallback metadata for furniture items

### 4. A-Frame Components (`js/components/`)

#### `movement.js`

Custom camera movement component for first-person navigation:

- **WASD controls**: Move forward/backward/left/right
- **Q/E keys**: Move up/down
- **Mouse**: Look around
- **Configurable speed**: Adjustable movement speed

#### `draggable-furniture.js`

Enables dragging furniture within the 3D scene:

- **Drag detection**: Raycasting to detect drag interactions
- **Wall collision**: Prevents furniture from passing through walls
- **Visual feedback**: Color changes during drag (green = valid, red = invalid)
- **Boundary checking**: Ensures furniture stays within room bounds
- **Default color**: Orange (#FF8C00) for furniture objects

#### `clickable-furniture.js`

Handles furniture selection and interaction:

- **Click detection**: Selects furniture on click
- **Visual feedback**: Green highlight for selected items
- **Control panel**: Shows/hides furniture control panel
- **Deselection**: Click outside to deselect

#### `floor-resize.js`

Dynamically resizes the floor plane based on room dimensions:

- **Auto-resize**: Updates floor size when room dimensions change
- **Material properties**: Non-reflective brown material (#8B4513)

#### `smart-placement.js`

Intelligent furniture placement with collision detection:

- **Position adjustment**: Automatically adjusts furniture position
- **Collision detection**: Prevents overlapping furniture
- **Visual feedback**: Orange highlight during adjustment

#### `wall-mounted.js`

Handles wall-mounted furniture behavior (mirrors, shelves):

- **Wall snapping**: Automatically snaps furniture to nearest wall
- **Height constraints**: Constrains Y position within wall height
- **Wall detection**: Identifies which wall (front, back, left, right) furniture is attached to
- **Horizontal movement**: Restricts movement to along the wall surface
- **Configurable parameters**: `roomWidth`, `roomLength`, `wallThickness`, `wallHeight`, `snapDistance`

#### `profile-menu.js`

Manages the profile circle and dropdown menu:

- **`updateProfileMenu(isAuthenticated, user)`**: Updates profile UI
- **`toggleProfileMenu()`**: Shows/hides dropdown menu
- **`getInitials(email)`**: Extracts user initials from email
- **Admin link visibility**: Shows admin dashboard link for admin users

### 5. Utility Modules (`js/utils/`)

#### `supabase.js`

Initializes and exports the Supabase client:

- **Configuration**: Sets up Supabase connection with project URL and anon key
- **Client export**: Provides `supabase` object for use throughout the application

#### `snapshot.js`

Handles screenshot capture and local storage:

- **`capturePlannerScreenshot()`**: Uses html2canvas to capture the 3D scene
- **`downloadDataUrl(dataUrl, filename)`**: Downloads screenshot as PNG file
- **`handleSnapshotClick()`**: Main handler for snapshot button
- **`collectRoomPlanData()`**: Gathers room and furniture data for saving
- **`addLocalRoomPlan(plan)`**: Saves plan to localStorage
- **`getLocalRoomPlans()`**: Retrieves all saved plans from localStorage
- **`deleteLocalRoomPlan(planId)`**: Removes a plan from localStorage
- **`slugifyFileName(name)`**: Converts plan name to safe filename

#### `migrate-data.js`

Data migration utilities (for admin use):

- **`runMigration()`**: Migrates data between database structures

#### `debug.js`

Debug utilities for development:

- **Debug logging**: Enhanced console logging
- **Visual debugging**: Position and collision visualization

#### `dialog.js`

Dialog utility for replacing browser alerts, confirms, and prompts:

- **`showDialog(message, title)`**: Shows a simple dialog with OK button
- **`showConfirm(message, title)`**: Shows confirmation dialog with Yes/No buttons
- **`showPrompt(message, defaultValue, title)`**: Shows input dialog with OK/Cancel buttons
- **Welcome dialog support**: Custom styling for welcome dialog with dark theme

#### `workspace-state.js`

Workspace state management utilities:

- **`goBackToPlanner()`**: Navigates back to planner while preserving workspace state
- Saves state before navigation to ensure items persist

#### `cost-estimation.js`

Cost estimation management:

- **`getSavedCostEstimations()`**: Retrieves saved cost estimations from localStorage
- **`saveCostEstimation(name)`**: Saves current cost estimation with a name
- **`deleteCostEstimation(id)`**: Deletes a saved cost estimation

#### `model-analyzer.js`

Model file mapping and local path resolution:

- **`getModelFilename(modelKey)`**: Gets filename from model key
- **`getModelKeyFromFilename(filename)`**: Gets model key from filename
- **`getAllModelKeys()`**: Returns array of all available model keys
- **`getLocalModelPath(modelKey)`**: Returns local path to model file in `asset/models/`
- **`hasLocalModel(modelKey)`**: Checks if model exists in local mapping
- **`MODEL_FILE_MAP`**: Maps filenames to model keys for all 15 models

### 6. Profile Module (`js/profile.js`)

Manages the user profile page:

- **`loadProfileData()`**: Loads user profile and saved plans
- **`renderPlans(plans)`**: Displays saved room plans
- **`deletePlan(planId)`**: Deletes a saved plan
- **`handleLogout()`**: Signs out the user

### 7. Admin Module (`js/admin.js`)

Admin panel for managing furniture items and prices:

- **`initAdmin()`**: Initializes admin panel (checks admin privileges)
- **`loadAllItems()`**: Loads all items and prices from database
- **`renderItems()`**: Displays items in the admin interface
- **`addNewItem()`**: Creates a new furniture item
- **`addPriceToItem()`**: Adds a price entry for an item
- **`updateItemPrice(itemId, priceId, newPrice)`**: Updates an existing price
- **`deleteItemPrice(itemId, priceId)`**: Deletes a price entry
- **`deleteItem(itemId)`**: Deletes an item and all its prices

## Database Schema

### Tables

#### `users`

Extends Supabase auth.users with additional profile data:

- `id` (UUID, PK, FK → auth.users)
- `email` (TEXT)
- `role` (TEXT, default: 'user')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `items`

Stores furniture item catalog:

- `id` (UUID, PK)
- `model_key` (TEXT, UNIQUE) - Identifier for the 3D model
- `name` (TEXT) - Display name
- `category` (TEXT) - Item category (Tables, Bedroom, etc.)
- `model_file_path` (TEXT) - Path to OBJ file
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `item_prices`

Stores prices from different stores:

- `id` (UUID, PK)
- `item_id` (UUID, FK → items)
- `store_name` (TEXT)
- `price` (NUMERIC(10,2))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- UNIQUE constraint on (item_id, store_name)

#### `room_plans`

Stores user's saved room plans (currently using localStorage instead):

- `id` (UUID, PK)
- `user_id` (UUID, FK → users)
- `name` (TEXT)
- `room_width` (NUMERIC(5,2))
- `room_length` (NUMERIC(5,2))
- `room_height` (NUMERIC(5,2)) - Room height dimension
- `furniture_data` (JSONB) - Array of furniture objects
- `cost_total` (NUMERIC(10,2))
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Row Level Security (RLS)

- **Users**: Can read/update their own profile
- **Items**: Public read, admin-only write
- **Item Prices**: Public read, admin-only write
- **Room Plans**: Users can only access their own plans

## Storage

### Supabase Storage Bucket: `wardrobe-models`

Stores 3D model files (OBJ format):

- `wardrobe_modern.obj`
- `wardrobe_traditional.obj`
- `wardrobe_openframe.obj`

Bucket is set to **Public** for direct access.

## User Flow

### 1. Initial Setup (`index.html`)

- **Modern Dark Theme Interface**:
  - Dark background (#0a0a0a) with subtle grid pattern
  - 3D wireframe cube visualization (isometric projection, animated)
  - Clean, minimalist design inspired by Next.js aesthetic
- **Room Dimension Input**:
  - User enters three dimensions: Width (W), Height (H), and Length (L)
  - Inputs positioned around the 3D cube visualization
  - Real-time validation (1-20M per dimension)
  - Keyboard navigation support (Tab, Enter)
- **Validation & Navigation**:
  - Validates all three dimensions are provided and within range
  - Stores dimensions in localStorage (roomWidth, roomLength, roomHeight)
  - Redirects to planner page on successful validation

### 2. Main Planner (`planner.html`)

- **Welcome Dialog (First Visit Only)**:

  - Automatically displays on first visit after entering dimensions
  - Shows room dimensions and comprehensive instructions
  - Includes controls, furniture, and cost board information
  - One-time display (tracked via localStorage `welcomeDialogShown`)
  - Can be closed via button, backdrop click, or Escape key
  - Users can hover over the "?" button anytime to see instructions again

- **Unauthenticated users**:

  - Can view and use the planner
  - See floating snapshot button (requires sign-in)
  - Cannot save plans

- **Authenticated users**:

  - Profile circle visible (top-right)
  - Cost panel visible (below profile)
  - Can save snapshots (downloads PNG + saves to localStorage)
  - Access to profile page

- **Admin users**:
  - All user features
  - Access to admin dashboard
  - Can manage items and prices

### 3. Profile Page (`profile.html`)

- Displays user information
- Shows saved room plans with:
  - Plan name and creation date
  - Total estimated cost
  - Room dimensions (width × length × height)
  - Furniture count
  - Snapshot filename
- Can delete plans
- Back button preserves workspace state when returning to planner

### 4. Admin Panel (`admin.html`)

- Dark theme matching the application aesthetic
- Next.js-style card-based UI

- Add new furniture items
- Add prices to items
- View and manage all items and prices
- Update or delete prices

## Key Features

### 3D Scene Management

- Dynamic room creation based on user input (width, length, height)
- Room walls created with specified height (defaults to 3M if not provided)
- Real-time furniture placement
- Collision detection with visual feedback (green = valid, red = invalid)
- Wall boundary enforcement
- Furniture rotation (90-degree increments)
- Cost calculation with real-time updates
- Workspace state persistence (auto-saves on page unload and visibility change)
- Model loading with timeout handling (30 seconds) and error recovery
- Placeholder boxes during model loading for immediate visual feedback

### Furniture Library

**Available Categories:**

- **Tables**: Center Table options (2 variants)
- **Seating**: Chairs (2 variants)
- **Bedroom**: Beds (2 variants), Wardrobes (3 variants)
- **Office**: Desks (2 variants)
- **Decor & Storage**: Mirrors (2 variants), Shelves (2 variants)

**Total Items**: 15 furniture items across 5 categories

### Error Handling & Fallbacks

- **Supabase Timeout**: 10-second timeout for database queries
- **Model Loading Timeout**: 30-second timeout per model file
- **Automatic Fallbacks**:
  - If Supabase fails → Uses fallback metadata and dummy prices
  - If model loading fails → Keeps placeholder visible with error indication
  - If storage URL fails → Falls back to local `asset/models/` folder
- **Dummy Prices**: All items have pre-configured dummy prices for offline functionality
- **Graceful Degradation**: Application continues to work even if Supabase is completely unavailable

### Cost Estimation

- Real-time cost calculation as furniture is added
- Displays item quantities and unit costs
- Shows total project cost
- Collapsible cost panel (shows icon when collapsed)
- **Cost panel max-height**: Constrained to viewport (calc(100vh - 100px)) to prevent overflow
- **Price sources**: View prices from multiple stores for each item
- **Dummy prices**: Fallback prices used when database is unavailable
- **Scrollable cost list**: Cost panel body scrolls when content exceeds available space

### Snapshot System

- Captures screenshot of entire 3D scene
- Downloads as PNG file
- Saves plan metadata to localStorage
- Includes room dimensions, furniture data, and total cost

### Welcome Dialog System

- One-time welcome dialog on first visit to planner
- Displays room dimensions and comprehensive instructions
- Dark theme matching the application aesthetic
- Instructions include:
  - Movement controls (W/A/S/D, Q/E, Mouse)
  - Furniture interaction (drag, click, panel)
  - Cost board information
  - Tip about hovering over "?" button for instructions
- Tracked via localStorage to prevent repeated displays
- Users can access instructions anytime via hover on "?" button

### Authentication

- Email/password authentication via Supabase
- Automatic profile creation on signup
- Role-based access control (user/admin)
- Session persistence

## Styling

### Design System

**CSS Architecture:**

- **Design Tokens** (`css/variables.css`): Centralized CSS custom properties for colors, spacing, typography, shadows, borders, transitions, and z-index
- **Component Classes** (`css/components.css`): Reusable component classes (buttons, cards, panels, inputs, badges, tooltips, modals)
- **Tailwind CSS**: Utility-first CSS framework integrated via CDN with custom theme configuration
- **Page-Specific Styles**: Individual CSS files for each page (index, planner, profile, admin)

### Color Scheme

- **Index Page**: Dark theme (#0a0a0a) with subtle grid pattern, white text
- **3D Scene**: Black (#000000) background
- **Floor**: Brown (#8B4513) with wood texture
- **Furniture**: Orange (#FF8C00) by default, Green (#4CAF50) when selected, Red (#FF6B6B) when near walls or outside boundaries
- **UI Panels**: Dark theme (rgba(15, 15, 15, 0.96)) with backdrop blur
- **Profile Circle**: Dark gradient (#343434 to #181818)
- **Welcome Dialog**: Dark theme matching planner interface
- **Scrollbars**: Custom dark-themed scrollbars (rgba(255, 255, 255, 0.2) thumb, rgba(15, 15, 15, 0.5) track)

### Typography

- **Font Family**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif)
- Consistent across all pages (admin, profile, planner, index)
- Modern, clean typography with proper letter-spacing
- Responsive font sizes with media queries for different screen sizes

### Responsive Design

- **Viewport Meta Tag**: Properly configured for mobile devices
- **Flexible Layouts**: Flexbox and CSS Grid for responsive layouts
- **Height-Based Media Queries**: Content scales down on smaller viewport heights
- **Cost Panel**: Max-height constrained to prevent viewport overflow
- **Side Panel**: Scrollable with custom dark-themed scrollbar

### Index Page Design

- **3D Wireframe Cube**:
  - Isometric projection with 6 faces
  - Animated floating effect
  - White wireframe borders with varying opacity
  - Responsive sizing (180px on desktop, scales down on mobile)
- **Input Layout**:
  - Dimension inputs (W, H, L) positioned around the cube
  - Modern underline-style inputs
  - Labels in uppercase bold font
  - Proper spacing to prevent overlap
- **Responsive Design**:
  - Adapts to different screen sizes
  - Mobile-friendly with adjusted cube and input sizes
  - Maintains square aspect ratio for room visualization container

## Configuration

### External Dependencies (CDN)

All external libraries are loaded via CDN from the HTML files:

| Library | Version | CDN URL |
|---------|---------|---------|
| A-Frame | 1.5.0 | `https://aframe.io/releases/1.5.0/aframe.min.js` |
| Supabase JS | 2.x | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` |
| HTML2Canvas | 1.4.1 | `https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js` |
| Tailwind CSS | 3.x | `https://cdn.tailwindcss.com` |

### Supabase Configuration

Set in `js/utils/supabase.js`:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon/public key

### Model Files

- **Local models**: `asset/models/` directory (15 OBJ files)
  - Tables: center_table1.obj, center_table2.obj
  - Wardrobes: wardrobe_modern.obj, wardrobe_traditional.obj, wardrobe_openframe.obj
  - Beds: bed1.obj, bed2.obj
  - Chairs: chair1.obj, chair2.obj
  - Desks: desk1.obj, desk2.obj
  - Mirrors: mirror1.obj, mirror2.obj
  - Shelves: shelf1.obj, shelf2.obj
- **Supabase Storage**: `wardrobe-models` bucket (for specific files)
- **Model mapping**: Defined in `STORAGE_MODEL_FILES` constant in `planner.js`
- **Model analyzer**: `js/utils/model-analyzer.js` provides local path resolution
- **Fallback system**: Automatic fallback to local files if Supabase Storage fails

## Development Notes

### Development Server

The project uses **Vite** as a development server for hot module replacement:

```bash
# Install dependencies (if using npm)
npm install

# Start development server
npm run dev
# or
npx vite
```

The `.vite/` directory contains development server cache files.

### Adding New Furniture Items

1. Add OBJ file to `asset/models/` directory
2. Update `STORAGE_MODEL_FILES` in `planner.js` to map model_key to filename
3. Add fallback name to `FALLBACK_ITEM_NAMES` in `planner.js`
4. Add fallback metadata to `FALLBACK_ITEM_METADATA` in `planner.js`
5. Add dummy price to `DUMMY_PRICES` in `planner.js`
6. Update `MODEL_FILE_MAP` in `js/utils/model-analyzer.js`
7. Add item to furniture library in `planner.html` (create subcategory if needed)
8. (Optional) Add item to database via admin panel or SQL
9. (Optional) Upload OBJ file to Supabase Storage if using cloud storage

### Customizing Colors

- Floor color: `planner.html` line 380
- Furniture default color: `js/components/draggable-furniture.js` line 19
- UI theme colors: CSS files

### Debugging

- Enable debug mode in `js/utils/debug.js`
- Use browser console for detailed logging
- Position debug component available for furniture placement issues

## Browser Compatibility

- Modern browsers with WebGL support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers may have limited functionality

## Recent Updates

### Version Updates

#### Latest Features (2025)

1. **Redesigned Welcome Page**:

   - Modern dark theme with Next.js-inspired aesthetic
   - 3D wireframe cube visualization
   - Added Height (H) dimension input alongside Width and Length
   - Improved responsive design for all screen sizes
   - Better input positioning and spacing

2. **Welcome Dialog System**:

   - One-time welcome dialog on first visit to planner
   - Comprehensive instructions display
   - Dark theme matching application aesthetic
   - Persistent instruction access via "?" button hover

3. **Enhanced Room Dimensions**:

   - Full 3D room support (width × length × height)
   - Room walls created with specified height
   - Height stored in localStorage and used throughout application

4. **Expanded Furniture Library**:

   - **New Categories**: Office, Decor & Storage
   - **New Items**: Beds (2), Chairs (2), Desks (2), Mirrors (2), Shelves (2)
   - **Total Items**: 15 furniture items across 5 categories
   - **Subcategory Navigation**: Click category to see variants
   - **Organized Layout**: Furniture grouped by room type and function

5. **Robust Error Handling & Fallbacks**:

   - **Supabase Timeout**: 10-second timeout with automatic fallback
   - **Model Loading Timeout**: 30-second timeout per model
   - **Dummy Prices**: Pre-configured prices for all 15 items
   - **Local Model Fallback**: Automatic fallback to `asset/models/` folder
   - **Model Analyzer Utility**: Maps model files to model keys
   - **Graceful Degradation**: App works offline with fallback data

6. **Styling System Improvements**:

   - **Tailwind CSS Integration**: Utility-first CSS framework
   - **CSS Variables**: Centralized design tokens
   - **Component Classes**: Reusable component styles
   - **Custom Scrollbars**: Dark-themed scrollbars for all panels
   - **Cost Panel Fix**: Max-height constrained to prevent viewport overflow

7. **Improved User Experience**:
   - Better validation messages
   - Keyboard navigation support
   - Workspace state persistence improvements
   - Enhanced responsive design
   - Visual feedback for model loading states
   - Error indicators for failed model loads

## Future Enhancements

- **Database Integration**: Move from localStorage to Supabase for room plans
- **More Furniture**: Additional categories and items
- **Furniture Customization**: Color, size, material options
- **Export Formats**: OBJ, GLTF, JSON export
- **Sharing**: Share plans with other users
- **Advanced Lighting**: PBR materials, improved shadows
- **VR Mode**: Full VR support with A-Frame VR components
- **Real-time Collaboration**: Multiple users editing same room
- **Mobile Optimization**: Touch controls, improved mobile UI
- **Performance**: Model caching, lazy loading, instancing optimization
