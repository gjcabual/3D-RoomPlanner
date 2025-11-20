# Three.js Integration Guide

## Files Created

1. **javascript/three/ThreeRoomScene.js** - Main Three.js scene manager with mouse-only controls
2. **javascript/three/ThreeAdapter.js** - Bridges Three.js with your existing cost/UI systems
3. **javascript/three/three-integration.js** - Integration script that connects everything
4. **planner-three.html** - New HTML page using Three.js instead of A-Frame

## How to Use

### Option 1: Test the New Three.js Version

1. Open `planner-three.html` in your browser
2. The Three.js room will load with mouse-only controls:
   - **Left Mouse Drag**: Rotate camera
   - **Right Mouse Drag**: Pan camera
   - **Mouse Wheel**: Zoom in/out
3. Drag furniture from the side panel onto the room floor
4. Click furniture to select and use control panel (rotate, delete)

### Option 2: Replace Old A-Frame Version

To completely switch from A-Frame to Three.js:

1. Backup your current `planner.html`:

   ```bash
   cp planner.html planner-aframe-backup.html
   ```

2. Replace with Three.js version:
   ```bash
   cp planner-three.html planner.html
   ```

## Features Preserved

✅ Drag & drop furniture from side panel
✅ Furniture placement with collision detection
✅ Cost estimation system
✅ Furniture controls (rotate, delete)
✅ UI panels (side panel, cost panel, instructions)
✅ Room dimensions from localStorage
✅ Responsive design

## New Features

✨ Mouse-only camera controls (no WASD needed)
✨ Smooth orbit controls with damping
✨ Better lighting and shadows
✨ Wireframe outlines for architectural feel
✨ Dynamic wall visibility based on camera position
✨ Blender-style grid floor

## Customization

### Change Wall/Floor Textures

Edit `javascript/three/ThreeRoomScene.js`, lines 70-90:

```javascript
const floorTexture = this.textureLoader.load("your-texture.png");
const wallTexture = this.textureLoader.load("your-texture.png");
```

### Adjust Camera Settings

Edit `javascript/three/ThreeRoomScene.js`, lines 40-45:

```javascript
this.controls.minDistance = 5; // Min zoom
this.controls.maxDistance = 25; // Max zoom
this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent going under floor
```

### Furniture Prices

Edit `javascript/three/three-integration.js`, lines 135-140:

```javascript
const prices = {
  table1: 5000,
  chair: 1500,
  // Add more...
};
```

## Development

Run with Vite dev server:

```bash
npm run dev
# or
npx vite
```

Then open: http://localhost:5173/planner-three.html

## Troubleshooting

**Issue**: Textures not loading

- Make sure `/textures/` folder exists with required images
- Check browser console for 404 errors

**Issue**: Furniture not draggable

- Check browser console for JavaScript errors
- Ensure Three.js is loaded (check Network tab)

**Issue**: Cost not updating

- Open browser console and check for `updateFurnitureCost` errors
- Verify furniture objects have correct `userData.modelType`

## Next Steps

1. **Add 3D Models**: Replace placeholder boxes with actual GLTF/GLB models
2. **More Furniture Types**: Add chairs, sofas, desks, etc.
3. **Save/Load**: Implement room state persistence
4. **Export**: Add screenshot or export functionality
5. **Measurements**: Show dimensions and measurements

## File Structure

```
3D-RoomPlanner/
├── planner-three.html          # New Three.js version
├── planner.html                # Old A-Frame version (keep as backup)
├── index.html                  # Room setup page
├── javascript/
│   ├── three/
│   │   ├── ThreeRoomScene.js   # Scene manager
│   │   ├── ThreeAdapter.js     # Integration adapter
│   │   └── three-integration.js # Main integration script
│   ├── planner/                # Existing scripts (still used for UI)
│   │   ├── cost.js
│   │   └── ...
│   └── components/             # A-Frame components (not needed for Three.js version)
├── css/
│   └── planner.css            # UI styles (shared between versions)
└── textures/                  # Texture files (add these!)
    ├── WoodFloor048_8K-PNG_Color.png
    ├── foam.png
    ├── foam_normal.png
    └── px.jpg, nx.jpg, etc. (cube map)
```

## Notes

- The Three.js version is completely independent of A-Frame
- All UI panels and controls work the same way
- Furniture dragging uses Three.js raycasting instead of A-Frame raycaster
- Cost calculator is connected via custom events
- You can run both versions side-by-side for comparison
