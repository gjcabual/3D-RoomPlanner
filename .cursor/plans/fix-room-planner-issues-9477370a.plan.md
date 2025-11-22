<!-- 9477370a-b24c-42b9-9c50-a07a4c6a66bd e10be916-7603-42e2-bef6-0e6c8ccabcc6 -->
# Fix Room Planner Issues

## Overview

This plan addresses six main issues in the 3D Room Planner application: dragging visibility, icon replacement, wall-snapping behavior, UI enhancements, theme consistency, and authentication security.

## Tasks

### 1. Fix Dragging Item Visibility When Camera is Outside Room

**Files:** `js/components/draggable-furniture.js`, `js/planner.js`

- Issue: Items dragged while camera is outside room are not visible until camera enters room or after loading
- Solution: 
- Ensure placeholder box is always visible regardless of camera position
- Add explicit `visible="true"` attribute to placeholder elements during drag
- Force A-Frame to update entity visibility immediately when dropped
- Ensure material opacity is set correctly for placeholders

### 2. Replace Emoji/Icons with Actual Item Images

**Files:** `planner.html`, `js/planner.js`, `css/planner.css`

- Issue: Furniture items in side panel show emojis instead of actual product images
- Solution:
- Create thumbnail images for each furniture item or use 3D model previews
- Store images in `asset/images/thumbnails/` directory
- Update `planner.html` to use `<img>` tags instead of emoji spans in `.model-icon` elements
- Update all subcategory functions (showBedSubcategory, showChairSubcategory, etc.) to use images
- Add CSS for `.model-icon img` styling
- Map each model key to corresponding thumbnail image path

### 3. Implement Wall-Snapping for Mirrors and Shelves

**Files:** `js/components/draggable-furniture.js`, `js/planner.js`, new file: `js/components/wall-mounted.js`

- Issue: Mirrors and shelves should attach to walls and not float like other items
- Solution:
- Create new `wall-mounted` component for furniture that snaps to walls
- Modify `draggable-furniture` to check if item has `wall-mounted` attribute
- When dragging wall-mounted items:
- Calculate nearest wall on drag
- Snap item to wall surface (align position based on wall orientation)
- Constrain movement along wall surface only
- Prevent placement away from walls (force wall attachment)
- Update `handleDrop` to add `wall-mounted` attribute for mirror1, mirror2, shelf1, shelf2
- Adjust positioning logic to place items flush against wall surface

### 4. Add Item Details Button and Fix Rotation Icons

**Files:** `planner.html`, `js/planner.js`, `css/planner.css`

- Issue: Missing details button for selected items, rotation buttons show wrong icons
- Solution:
- Add "Details" button to furniture control panel in `planner.html`
- Create `showItemDetails()` function that displays:
- Item name/type
- Dimensions (width, length, height from model bounds)
- Category
- Estimated price
- Model key
- Update rotation button SVGs to show left/right circular arrows instead of up/down arrows
- Display details in modal or expandable panel section
- Fetch dimension data from calculated bounding boxes in draggable-furniture component

### 5. Match Login Page to System Theme

**Files:** `css/auth.css`, `planner.html` (auth modal)

- Issue: Auth modal uses light theme instead of dark theme matching system
- Solution:
- Update `css/auth.css` to use dark theme colors matching planner theme:
- Background: `rgba(15, 15, 15, 0.96)` (bg-surface)
- Text: `#f5f5f5` (text-secondary)
- Borders: `rgba(255, 255, 255, 0.15)` (border-hover)
- Buttons: Match accent-success colors
- Update input fields to dark theme styling
- Ensure backdrop matches system overlay color
- Update all color values to match Tailwind config theme tokens

### 6. Add Regex Validation for Authentication Security

**Files:** `js/auth/auth-ui.js`, `js/auth/auth.js`

- Issue: Missing input validation for email and password fields
- Solution:
- Add email regex validation: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Add password regex validation:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- Optional: special character requirement
- Update `handleAuthSubmit()` function to validate before API calls
- Display specific error messages for each validation failure
- Add real-time validation feedback on input fields

## Implementation Notes

- Thumbnail images: Will need to be created or provided. Placeholder path structure: `asset/images/thumbnails/{model_key}.jpg`
- Wall snapping: Will use room dimension data and wall positions to calculate snap points
- Item details: Will extract dimensions from Three.js bounding boxes calculated in draggable-furniture component
- Theme consistency: All colors should reference Tailwind config tokens for maintainability