<!-- 9477370a-b24c-42b9-9c50-a07a4c6a66bd eb328c18-9d06-484f-9014-fce2e9b7f893 -->
# Require Selection Before Dragging and Restore Original Color

## Goal

Items should only be draggable when selected (green), and should return to their original color when deselected or when the control panel is closed.

## Changes Required

### 1. Require Selection for Dragging

**File:** `js/components/draggable-furniture.js`

- Modify `onMouseDown` method (around line 122)
- Check if item has `clickable-furniture` component
- Verify `isSelected === true` before allowing drag to start
- If not selected, return early without setting `isDragging = true`

### 2. Deselect Item When Control Panel is Closed

**File:** `js/planner.js`

- Modify `closeControlPanel` function (around line 1837)
- When X button is clicked, deselect the currently selected item
- Get the furniture element from `selectedFurniture`
- If it has a `clickable-furniture` component, call its `deselect()` method
- This ensures color restoration happens when panel is closed

### 3. Handle Wall-Mounted Items in Deselection

**File:** `js/components/clickable-furniture.js`

- In `deselect()` method (around line 68), add check for wall-mounted items
- If item has `wall-mounted` component, always return to original color (never red)
- Regular items: red if near wall, original color if away from wall

## Expected Behavior After Changes

1. Items must be clicked to select (turn green) before they can be dragged
2. Clicking selected item again deselects it and restores color
3. Clicking X button closes panel AND deselects item, restoring color
4. Wall-mounted items (mirrors/shelves) always return to original color when deselected (no red)
5. Regular items return to original color if away from walls, or red if near walls when deselected

## Files to Modify

- `js/components/draggable-furniture.js` - Add selection check in `onMouseDown`
- `js/planner.js` - Modify `closeControlPanel` to deselect item
- `js/components/clickable-furniture.js` - Ensure wall-mounted items skip red color in `deselect()`