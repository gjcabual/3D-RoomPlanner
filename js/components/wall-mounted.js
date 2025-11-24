// Wall-mounted component for furniture that snaps to walls (mirrors, shelves)
AFRAME.registerComponent('wall-mounted', {
  schema: {
    roomWidth: {type: 'number', default: 10},
    roomLength: {type: 'number', default: 10},
    wallThickness: {type: 'number', default: 0.1},
    wallHeight: {type: 'number', default: 3}, // Wall height (ceiling height)
    snapDistance: {type: 'number', default: 0.2} // Distance threshold for wall snapping
  },
  
  init: function() {
    this.currentWall = null; // Track which wall the item is attached to
    this.wallOffset = 0.02; // Small offset to keep item front face at wall surface (2cm)
  },
  
  /**
   * Find the nearest wall to a given position
   * @param {THREE.Vector3} position - Position to check
   * @returns {Object} - {wall: string, distance: number, snapPoint: THREE.Vector3}
   */
  findNearestWall: function(position) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;
    const snapDistance = this.data.snapDistance;
    
    // Calculate wall positions (inner faces)
    const halfWidth = roomWidth / 2;
    const halfLength = roomLength / 2;
    const innerX = halfWidth - wallThickness / 2;
    const innerZ = halfLength - wallThickness / 2;
    
    // Calculate distances to each wall
    const distances = {
      front: Math.abs(position.z - (-innerZ)), // Front wall (negative Z)
      back: Math.abs(position.z - innerZ),     // Back wall (positive Z)
      left: Math.abs(position.x - (-innerX)),  // Left wall (negative X)
      right: Math.abs(position.x - innerX)     // Right wall (positive X)
    };
    
    // Find nearest wall (if within snap distance, use it; otherwise just find closest)
    let nearestWall = null;
    let minDistance = Infinity;
    
    for (const [wall, distance] of Object.entries(distances)) {
      if (distance < minDistance) {
        minDistance = distance;
        nearestWall = wall;
      }
    }
    
    // If not within snap distance, still return the nearest wall (for forced attachment)
    if (!nearestWall) return null;
    
    // Calculate snap point based on wall
    const snapPoint = position.clone();
    
    switch(nearestWall) {
      case 'front':
        snapPoint.z = -innerZ + this.wallOffset;
        break;
      case 'back':
        snapPoint.z = innerZ - this.wallOffset;
        break;
      case 'left':
        snapPoint.x = -innerX + this.wallOffset;
        break;
      case 'right':
        snapPoint.x = innerX - this.wallOffset;
        break;
    }
    
    return {
      wall: nearestWall,
      distance: minDistance,
      snapPoint: snapPoint
    };
  },
  
  /**
   * Constrain position to wall surface and detect wall transitions
   * @param {THREE.Vector3} position - Desired position
   * @param {string} wall - Wall name
   * @returns {Object} - {position: THREE.Vector3, wall: string}
   */
  constrainToWall: function(position, wall) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;
    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    
    const constrained = position.clone();
    let currentWall = wall;
    
    // Get object dimensions for proper edge detection
    const draggableComponent = this.el.components['draggable-furniture'];
    const objectWidth = draggableComponent ? (draggableComponent.actualWidth || draggableComponent.data.objectWidth || 0.5) : 0.5;
    const objectLength = draggableComponent ? (draggableComponent.actualLength || draggableComponent.data.objectLength || 0.5) : 0.5;
    const halfSize = Math.max(objectWidth, objectLength) / 2;
    
    // Calculate object depth (thickness perpendicular to wall)
    // For wall-mounted items, we need to know the depth to position them correctly
    // The depth depends on which wall we're on (X, Y, or Z dimension)
    let objectDepth = 0.08; // Default thin depth (8cm)
    
    if (draggableComponent && draggableComponent.el && draggableComponent.el.object3D) {
      const box = new THREE.Box3();
      draggableComponent.el.object3D.updateMatrixWorld(true);
      let hasGeometry = false;
      
      draggableComponent.el.object3D.traverse(function(child) {
        if (child.isMesh && child.geometry) {
          const worldBox = new THREE.Box3();
          worldBox.setFromObject(child);
          if (!hasGeometry) {
            box.copy(worldBox);
            hasGeometry = true;
          } else {
            box.union(worldBox);
          }
        }
      });
      
      if (hasGeometry && box.min && box.max) {
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Depth is the dimension perpendicular to the wall surface
        // For front/back walls (Z-axis): depth is along Z-axis (size.z)
        // For left/right walls (X-axis): depth is along X-axis (size.x)
        // But we need to account for rotation - when rotated 90/270 degrees, X and Z swap
        // To be safe, use the smallest of X and Z dimensions as depth (depth is always perpendicular to wall)
        // Y is height, so we don't use it for depth calculation
        objectDepth = Math.min(size.x, size.z);
        
        // But ensure it's not too small (minimum 2cm) and not too large (maximum 20cm)
        objectDepth = Math.max(0.02, Math.min(objectDepth, 0.2));
      }
    }
    
    // Adjust offset to account for item depth - position front face at wall surface
    // Position item center at wallOffset + depth/2 from inner wall surface
    // This ensures the front face is at the wall, and back part stays inside
    // Add extra safety margin to prevent any sticking through
    const safetyMargin = 0.02; // 2cm extra safety margin (increased to prevent penetration)
    const adjustedOffset = this.wallOffset + objectDepth / 2 + safetyMargin;
    
    // Snap to wall position and constrain movement along wall
    // Also detect when reaching wall corners and switch to adjacent wall
    // Use a smaller threshold for corner detection to prevent premature switching
    // Only switch when actually at the corner, not just near it
    const cornerThreshold = 0.15; // Distance from corner before switching walls (reduced for less aggressive switching)
    
    switch(wall) {
      case 'front':
        constrained.z = -innerZ + adjustedOffset;
        // Allow placement on entire wall length - only prevent going outside room bounds
        let minX = -innerX + halfSize; // Minimum X to keep item inside room
        let maxX = innerX - halfSize;  // Maximum X to keep item inside room
        
        // Check if reaching left corner - switch to left wall
        // Allow switching when close to corner (follow cursor movement)
        if (position.x <= minX + cornerThreshold) {
          currentWall = 'left';
          constrained.x = -innerX + adjustedOffset;
          // Allow placement anywhere along the left wall (full length)
          constrained.z = Math.max(-innerZ + halfSize, Math.min(innerZ - halfSize, position.z));
        }
        // Check if reaching right corner - switch to right wall
        else if (position.x >= maxX - cornerThreshold) {
          currentWall = 'right';
          constrained.x = innerX - adjustedOffset;
          // Allow placement anywhere along the right wall (full length)
          constrained.z = Math.max(-innerZ + halfSize, Math.min(innerZ - halfSize, position.z));
        }
        // Stay on front wall - allow placement anywhere along wall (full width)
        else {
          // Allow free movement along entire wall width
          constrained.x = Math.max(minX, Math.min(maxX, position.x));
        }
        break;
        
      case 'back':
        constrained.z = innerZ - adjustedOffset;
        minX = -innerX + halfSize;
        maxX = innerX - halfSize;
        
        // Check if reaching left corner - switch to left wall
        // Allow switching when close to corner (follow cursor movement)
        if (position.x <= minX + cornerThreshold) {
          currentWall = 'left';
          constrained.x = -innerX + adjustedOffset;
          // Allow placement anywhere along the left wall (full length)
          constrained.z = Math.max(-innerZ + halfSize, Math.min(innerZ - halfSize, position.z));
        }
        // Check if reaching right corner - switch to right wall
        else if (position.x >= maxX - cornerThreshold) {
          currentWall = 'right';
          constrained.x = innerX - adjustedOffset;
          // Allow placement anywhere along the right wall (full length)
          constrained.z = Math.max(-innerZ + halfSize, Math.min(innerZ - halfSize, position.z));
        }
        // Stay on back wall - allow placement anywhere along wall (full width)
        else {
          constrained.x = Math.max(minX, Math.min(maxX, position.x));
        }
        break;
        
      case 'left':
        constrained.x = -innerX + adjustedOffset;
        // Allow placement on entire wall length - only prevent going outside room bounds
        let minZ = -innerZ + halfSize; // Minimum Z to keep item inside room
        let maxZ = innerZ - halfSize;  // Maximum Z to keep item inside room
        
        // Check if reaching front corner - switch to front wall
        // Allow switching when close to corner (follow cursor movement)
        if (position.z <= minZ + cornerThreshold) {
          currentWall = 'front';
          constrained.z = -innerZ + adjustedOffset;
          // Allow placement anywhere along the front wall (full width)
          constrained.x = Math.max(-innerX + halfSize, Math.min(innerX - halfSize, position.x));
        }
        // Check if reaching back corner - switch to back wall
        else if (position.z >= maxZ - cornerThreshold) {
          currentWall = 'back';
          constrained.z = innerZ - adjustedOffset;
          // Allow placement anywhere along the back wall (full width)
          constrained.x = Math.max(-innerX + halfSize, Math.min(innerX - halfSize, position.x));
        }
        // Stay on left wall - allow placement anywhere along wall (full length)
        else {
          constrained.z = Math.max(minZ, Math.min(maxZ, position.z));
        }
        break;
        
      case 'right':
        constrained.x = innerX - adjustedOffset;
        minZ = -innerZ + halfSize;
        maxZ = innerZ - halfSize;
        
        // Check if reaching front corner - switch to front wall
        // Allow switching when close to corner (follow cursor movement)
        if (position.z <= minZ + cornerThreshold) {
          currentWall = 'front';
          constrained.z = -innerZ + adjustedOffset;
          // Allow placement anywhere along the front wall (full width)
          constrained.x = Math.max(-innerX + halfSize, Math.min(innerX - halfSize, position.x));
        }
        // Check if reaching back corner - switch to back wall
        else if (position.z >= maxZ - cornerThreshold) {
          currentWall = 'back';
          constrained.z = innerZ - adjustedOffset;
          // Allow placement anywhere along the back wall (full width)
          constrained.x = Math.max(-innerX + halfSize, Math.min(innerX - halfSize, position.x));
        }
        // Stay on right wall - allow placement anywhere along wall (full length)
        else {
          constrained.z = Math.max(minZ, Math.min(maxZ, position.z));
        }
        break;
    }
    
    // Get wall height (ceiling height) for Y constraint
    const wallHeight = this.data.wallHeight || 3;
    
    // Calculate object height for proper Y constraint (prevent passing through ceiling)
    let objectHeight = 0.5; // Default height
    if (draggableComponent && draggableComponent.el && draggableComponent.el.object3D) {
      const box = new THREE.Box3();
      draggableComponent.el.object3D.updateMatrixWorld(true);
      let hasGeometry = false;
      
      draggableComponent.el.object3D.traverse(function(child) {
        if (child.isMesh && child.geometry) {
          const worldBox = new THREE.Box3();
          worldBox.setFromObject(child);
          if (!hasGeometry) {
            box.copy(worldBox);
            hasGeometry = true;
          } else {
            box.union(worldBox);
          }
        }
      });
      
      if (hasGeometry && box.min && box.max) {
        const size = new THREE.Vector3();
        box.getSize(size);
        // Use Y dimension as object height
        objectHeight = size.y;
        // Ensure it's reasonable (minimum 0.1m, maximum 2m)
        objectHeight = Math.max(0.1, Math.min(objectHeight, 2.0));
      }
    }
    
    // Constrain Y position within wall boundaries (prevent passing through floor and ceiling)
    // Floor: 0 (with object bottom at floor, center is at objectHeight/2)
    // Ceiling: wallHeight (with object top at ceiling, center is at wallHeight - objectHeight/2)
    const minY = objectHeight / 2 + 0.05; // 5cm above floor (object bottom at 5cm)
    const maxY = wallHeight - objectHeight / 2 - 0.05; // 5cm below ceiling (object top 5cm below ceiling)
    
    // Clamp Y position to valid range
    constrained.y = Math.max(minY, Math.min(maxY, position.y));
    
    // Calculate rotation to face room center (0, 0, 0)
    const rotationY = this.calculateRotationForWall(currentWall);
    
    return {
      position: constrained,
      wall: currentWall,
      rotation: rotationY
    };
  },
  
  /**
   * Calculate rotation angle to face room center for a given wall
   * @param {string} wall - Wall name
   * @returns {number} - Rotation in degrees (Y-axis) to face room center
   */
  calculateRotationForWall: function(wall) {
    // Calculate rotation based on which wall the item is on
    // Items should face perpendicular to the wall, toward the room center (0, 0, 0)
    let targetAngle = 0;
    
    switch(wall) {
      case 'front':
        // Front wall is at negative Z
        // Item should face positive Z (toward room center)
        targetAngle = 0; // Facing +Z direction
        break;
      case 'back':
        // Back wall is at positive Z
        // Item should face negative Z (toward room center)
        targetAngle = 180; // Facing -Z direction
        break;
      case 'left':
        // Left wall is at negative X
        // Item should face positive X (toward room center)
        targetAngle = 90; // Facing +X direction
        break;
      case 'right':
        // Right wall is at positive X
        // Item should face negative X (toward room center)
        targetAngle = -90; // Facing -X direction (or 270 degrees)
        break;
      default:
        targetAngle = 0;
    }
    
    return targetAngle;
  },
  
  /**
   * Check if item should snap to wall based on position
   * Returns constrained position and ensures item stays on walls
   */
  checkWallSnap: function(position) {
    // If already attached to a wall, keep it constrained to that wall
    // This allows smooth movement along the wall and transitions at corners
    if (this.currentWall) {
      const result = this.constrainToWall(position, this.currentWall);
      // Update current wall if it changed (corner transition)
      if (result.wall !== this.currentWall) {
        this.currentWall = result.wall;
      }
      return result.position;
    }
    
    // Not attached to a wall yet - find nearest wall and snap to it
    const wallInfo = this.findNearestWall(position);
    if (wallInfo) {
      this.currentWall = wallInfo.wall;
      const result = this.constrainToWall(wallInfo.snapPoint, wallInfo.wall);
      this.currentWall = result.wall; // Update in case of edge case
      return result.position;
    }
    
    // Force attachment to nearest wall
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;
    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    
    // Find closest wall and snap to it
    const distances = {
      front: Math.abs(position.z - (-innerZ)),
      back: Math.abs(position.z - innerZ),
      left: Math.abs(position.x - (-innerX)),
      right: Math.abs(position.x - innerX)
    };
    
    const closestWall = Object.keys(distances).reduce((a, b) => 
      distances[a] < distances[b] ? a : b
    );
    
    this.currentWall = closestWall;
    const result = this.constrainToWall(position, closestWall);
    this.currentWall = result.wall;
    return result.position;
  }
});

