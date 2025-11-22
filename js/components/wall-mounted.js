// Wall-mounted component for furniture that snaps to walls (mirrors, shelves)
AFRAME.registerComponent('wall-mounted', {
  schema: {
    roomWidth: {type: 'number', default: 10},
    roomLength: {type: 'number', default: 10},
    wallThickness: {type: 'number', default: 0.1},
    snapDistance: {type: 'number', default: 0.2} // Distance threshold for wall snapping
  },
  
  init: function() {
    this.currentWall = null; // Track which wall the item is attached to
    this.wallOffset = 0.05; // Small offset to keep item slightly away from wall surface
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
    
    // Find nearest wall
    let nearestWall = null;
    let minDistance = Infinity;
    
    for (const [wall, distance] of Object.entries(distances)) {
      if (distance < minDistance && distance <= snapDistance) {
        minDistance = distance;
        nearestWall = wall;
      }
    }
    
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
   * Constrain position to wall surface
   * @param {THREE.Vector3} position - Desired position
   * @param {string} wall - Wall name
   * @returns {THREE.Vector3} - Constrained position
   */
  constrainToWall: function(position, wall) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    const wallThickness = this.data.wallThickness;
    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    
    const constrained = position.clone();
    
    // Snap to wall position and constrain movement along wall
    switch(wall) {
      case 'front':
        constrained.z = -innerZ + this.wallOffset;
        // Constrain X movement within room bounds
        constrained.x = Math.max(-innerX + 0.3, Math.min(innerX - 0.3, position.x));
        break;
      case 'back':
        constrained.z = innerZ - this.wallOffset;
        constrained.x = Math.max(-innerX + 0.3, Math.min(innerX - 0.3, position.x));
        break;
      case 'left':
        constrained.x = -innerX + this.wallOffset;
        // Constrain Z movement within room bounds
        constrained.z = Math.max(-innerZ + 0.3, Math.min(innerZ - 0.3, position.z));
        break;
      case 'right':
        constrained.x = innerX - this.wallOffset;
        constrained.z = Math.max(-innerZ + 0.3, Math.min(innerZ - 0.3, position.z));
        break;
    }
    
    // Keep Y position (height)
    constrained.y = position.y;
    
    return constrained;
  },
  
  /**
   * Check if item should snap to wall based on position
   */
  checkWallSnap: function(position) {
    const wallInfo = this.findNearestWall(position);
    if (wallInfo) {
      this.currentWall = wallInfo.wall;
      return wallInfo.snapPoint;
    }
    
    // If already attached to a wall, keep it constrained to that wall
    if (this.currentWall) {
      return this.constrainToWall(position, this.currentWall);
    }
    
    // Not near any wall - try to attach to nearest one anyway
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
    return this.constrainToWall(position, closestWall);
  }
});

