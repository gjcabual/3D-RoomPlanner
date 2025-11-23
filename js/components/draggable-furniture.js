// Draggable furniture component for moving tables around
AFRAME.registerComponent('draggable-furniture', {
  schema: {
    roomWidth: {type: 'number', default: 10},
    roomLength: {type: 'number', default: 10},
    objectWidth: {type: 'number', default: 1.5},
    objectLength: {type: 'number', default: 1.5},
    wallThickness: {type: 'number', default: 0.1}
  },
  
  init: function() {
    this.isDragging = false;
    this.originalPosition = null;
    this.dragStartPosition = null;
    this.mouseDownPosition = null; // Track mouse position on mousedown
    this.camera = null;
    this.cameraObj = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.defaultColor = '#FF8C00'; // Default orange color
    
    // Actual dimensions from 3D model (will be calculated when model loads)
    this.actualWidth = this.data.objectWidth; // Fallback to schema default
    this.actualLength = this.data.objectLength; // Fallback to schema default
    this.dimensionsCalculated = false;
    this.lastRotationY = undefined; // Track rotation for dimension recalculation
    
    // Bind methods
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.calculateDimensions = this.calculateDimensions.bind(this);
    
    // Add event listeners
    this.el.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mouseup', this.onMouseUp);
    
    // Listen for model to load so we can calculate actual dimensions
    this.el.addEventListener('model-loaded', this.calculateDimensions);
    
    // Try to calculate dimensions immediately if model is already loaded
    setTimeout(() => {
      if (!this.dimensionsCalculated) {
        this.calculateDimensions();
      }
    }, 100);
    
    // Get camera reference
    this.camera = document.querySelector('a-camera');
    if (this.camera) {
      this.cameraObj = this.camera.getObject3D('camera');
    }
  },
  
  calculateDimensions: function() {
    // Get the 3D object from the entity
    const object3D = this.el.object3D;
    if (!object3D) return;
    
    // Update world matrix to ensure transformations are applied
    object3D.updateMatrixWorld(true);
    
    // Create a bounding box helper
    const box = new THREE.Box3();
    
    // Traverse all meshes in the object to calculate combined bounding box
    let hasGeometry = false;
    const self = this;
    object3D.traverse(function(child) {
      if (child.isMesh && child.geometry) {
        // Update bounding box for this mesh's local geometry
        if (child.geometry.boundingBox === null) {
          child.geometry.computeBoundingBox();
        }
        
        // Get local bounding box
        const localBox = child.geometry.boundingBox.clone();
        
        // Transform to world space using the mesh's world matrix
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
      // Calculate dimensions from bounding box in world space
      // This accounts for rotation, scale, and position
      const size = new THREE.Vector3();
      box.getSize(size);
      
      // The bounding box in world space already accounts for all transformations
      // Width is along X-axis, Length is along Z-axis
      this.actualWidth = Math.abs(size.x);
      this.actualLength = Math.abs(size.z);
      this.dimensionsCalculated = true;
      
      console.log(`Calculated dimensions for ${this.el.id}:`, {
        width: this.actualWidth,
        length: this.actualLength,
        boundingBox: {
          min: { x: box.min.x, y: box.min.y, z: box.min.z },
          max: { x: box.max.x, y: box.max.y, z: box.max.z },
          size: { x: size.x, y: size.y, z: size.z }
        }
      });
    } else {
      // Fallback to schema defaults if calculation fails
      console.warn(`Could not calculate dimensions for ${this.el.id}, using defaults`);
      this.actualWidth = this.data.objectWidth;
      this.actualLength = this.data.objectLength;
    }
  },
  
  onMouseDown: function(e) {
    if (e.detail.intersection) {
      // Check if item is selected before allowing drag
      const clickableComponent = this.el.components['clickable-furniture'];
      if (clickableComponent && !clickableComponent.isSelected) {
        // Item is not selected - don't allow dragging
        return;
      }
      
      // Store mouse position to detect if it's a click or drag
      this.mouseDownPosition = { x: e.clientX || 0, y: e.clientY || 0 };
      this.originalPosition = this.el.object3D.position.clone();
      this.dragStartPosition = e.detail.intersection.point;
      
      // Don't start dragging immediately - wait for mouse movement
      // This prevents clicks from triggering drags
      this.isDragging = false;
    }
  },
  
  onMouseMove: function(e) {
    // Check if this is a selection click (not a drag operation)
    const clickableComponent = this.el.components['clickable-furniture'];
    if (clickableComponent && clickableComponent._isSelectionClick) {
      // Don't process movement during selection clicks
      return;
    }
    
    // Check if we should start dragging (mouse moved from mousedown position)
    if (!this.isDragging && this.mouseDownPosition) {
      const mouseMoved = Math.abs((e.clientX || 0) - this.mouseDownPosition.x) > 3 ||
                        Math.abs((e.clientY || 0) - this.mouseDownPosition.y) > 3;
      
      if (mouseMoved) {
        // Mouse has moved - start dragging
        this.isDragging = true;
        // Visual feedback for drag start (green)
        this.el.setAttribute('material', 'color', '#4CAF50');
        this.el.setAttribute('material', 'emissive', '#2E7D32');
        this.el.setAttribute('material', 'emissiveIntensity', '0.3');
        console.log('Started dragging table:', this.el.id);
      } else {
        // Mouse hasn't moved enough - don't start dragging yet
        return;
      }
    }
    
    if (!this.isDragging) return;
    
    if (!this.cameraObj) {
      const camEl = document.querySelector('a-camera');
      if (camEl) this.cameraObj = camEl.getObject3D('camera');
      if (!this.cameraObj) return;
    }
    
    // Update mouse position
    this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    // Check if this is a wall-mounted item
    const wallMountedComponent = this.el.components['wall-mounted'];
    const isWallMounted = wallMountedComponent !== undefined;
    
    // Raycast against an infinite ground plane (y = 0) for all items
    this.raycaster.setFromCamera(this.mouse, this.cameraObj);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    
    if (this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
      // Handle wall-mounted items differently
      if (isWallMounted) {
        // Always find the nearest wall from cursor position
        // This makes items follow the cursor and switch walls when cursor moves to another wall
        const wallInfo = wallMountedComponent.findNearestWall(intersectionPoint);
        let currentWall = wallMountedComponent.currentWall;
        
        if (wallInfo) {
          // Use snap distance to determine if we should switch walls
          // Keep snap distance small to prevent premature switching
          const snapDistance = wallMountedComponent.data.snapDistance || 0.2;
          
          if (!currentWall) {
            // No current wall - use the nearest one
            currentWall = wallInfo.wall;
          } else {
            // Check distance to current wall
            const currentWallDistance = this.getDistanceToWall(intersectionPoint, currentWall, wallMountedComponent);
            
            // Only switch walls if:
            // 1. Cursor is significantly closer to a different wall (at least 0.5 units closer)
            // 2. OR cursor is very close to a different wall (within snap distance) AND closer than current
            if (wallInfo.wall !== currentWall) {
              const distanceDifference = currentWallDistance - wallInfo.distance;
              
              // Only switch if the new wall is significantly closer (prevents premature switching)
              if (distanceDifference > 0.5 || (wallInfo.distance <= snapDistance && distanceDifference > 0.1)) {
                // Cursor is clearly on a different wall - switch to follow cursor
                currentWall = wallInfo.wall;
              }
              // Otherwise keep current wall (don't switch just because it's slightly closer)
            }
          }
        } else if (!currentWall) {
          // Fallback to front wall if nothing found
          currentWall = 'front';
        }
        
        // Update current wall to match cursor position
        wallMountedComponent.currentWall = currentWall;
        
        // Now raycast against the wall plane to get Y position (vertical movement)
        const roomWidth = wallMountedComponent.data.roomWidth || 10;
        const roomLength = wallMountedComponent.data.roomLength || 10;
        const wallThickness = wallMountedComponent.data.wallThickness || 0.1;
        const wallHeight = wallMountedComponent.data.wallHeight || 3; // Get wall height from component data
        const innerX = roomWidth / 2 - wallThickness / 2;
        const innerZ = roomLength / 2 - wallThickness / 2;
        const ceilingHeight = wallHeight; // Use wall height as ceiling height
        
        // Create wall plane based on current wall for vertical movement
        let wallNormal = null;
        let wallPoint = null;
        
        switch(currentWall) {
          case 'front':
            wallNormal = new THREE.Vector3(0, 0, 1); // Normal pointing into room
            wallPoint = new THREE.Vector3(0, wallHeight / 2, -innerZ);
            break;
          case 'back':
            wallNormal = new THREE.Vector3(0, 0, -1);
            wallPoint = new THREE.Vector3(0, wallHeight / 2, innerZ);
            break;
          case 'left':
            wallNormal = new THREE.Vector3(1, 0, 0);
            wallPoint = new THREE.Vector3(-innerX, wallHeight / 2, 0);
            break;
          case 'right':
            wallNormal = new THREE.Vector3(-1, 0, 0);
            wallPoint = new THREE.Vector3(innerX, wallHeight / 2, 0);
            break;
        }
        
        // Raycast against wall plane to get Y position (vertical movement)
        if (wallNormal && wallPoint) {
          const wallPlane = new THREE.Plane();
          wallPlane.setFromNormalAndCoplanarPoint(wallNormal, wallPoint);
          
          this.raycaster.setFromCamera(this.mouse, this.cameraObj);
          const wallIntersection = new THREE.Vector3();
          
          if (this.raycaster.ray.intersectPlane(wallPlane, wallIntersection)) {
            // Use Y position from wall plane intersection (allows vertical movement)
            // Initial constraint will be refined by constrainToWall which uses object height
            intersectionPoint.y = wallIntersection.y;
          } else {
            // Fallback: keep current Y position or use default
            intersectionPoint.y = this.el.object3D.position.y || 1.5;
          }
        } else {
          // Fallback: keep current Y position
          intersectionPoint.y = this.el.object3D.position.y || 1.5;
        }
        
        // Constrain movement along wall with corner detection
        // This handles wall transitions automatically when reaching corners
        // constrainToWall will constrain Y position based on object height and wall height
        const result = wallMountedComponent.constrainToWall(intersectionPoint, currentWall);
        
        // Always use the wall determined by cursor position (for direct following)
        // Corner detection will handle edge cases, but cursor position takes priority
        // Only update wall if corner detection actually changed it (cursor is at corner)
        const wallChanged = result.wall !== currentWall;
        if (wallChanged) {
          // Corner detection changed wall - this means cursor is at corner
          currentWall = result.wall;
        }
        wallMountedComponent.currentWall = currentWall;
        
        // Y position is already constrained by constrainToWall (includes object height calculation)
        
        // Apply position - this follows cursor directly while staying on wall
        this.el.setAttribute('position', `${result.position.x} ${result.position.y} ${result.position.z}`);
        
        // Always ensure facing room center when dragging wall-mounted items
        // If wall changed, update rotation to face room center (0, 0, 0)
        if (result.rotation !== undefined) {
          const currentRot = this.el.getAttribute('rotation');
          const currentX = typeof currentRot === 'object' ? currentRot.x : 
                          (typeof currentRot === 'string' ? parseFloat(currentRot.split(' ')[0]) : 0);
          const currentZ = typeof currentRot === 'object' ? currentRot.z : 
                          (typeof currentRot === 'string' ? parseFloat(currentRot.split(' ')[2]) : 0);
          
          // Update Y rotation to face room center, preserve X and Z rotation
          this.el.setAttribute('rotation', {
            x: currentX,
            y: result.rotation, // Face room center based on current wall
            z: currentZ
          });
        }
        
        // Wall-mounted items are always green (no red feedback)
        this.el.setAttribute('material', 'color', '#4CAF50');
        this.el.setAttribute('material', 'emissive', '#2E7D32');
        this.el.setAttribute('material', 'emissiveIntensity', '0.3');
      } else {
        // Regular items - check boundaries and adjust position
        const newPosition = intersectionPoint;
        const adjustedPosition = this.checkBoundaries(newPosition);
        
        // Keep object on floor height y=0 (or small lift) while dragging
        adjustedPosition.y = 0;
        
        this.el.setAttribute('position', `${adjustedPosition.x} ${adjustedPosition.y} ${adjustedPosition.z}`);
        
        // Check for collisions (walls and ceiling)
        const hasCollision = this.isColliding(adjustedPosition);
        
        // Visual feedback for collision (red when touching walls or ceiling)
        if (hasCollision) {
          // Red when touching/over boundary or ceiling
          this.el.setAttribute('material', 'color', '#FF6B6B');
          this.el.setAttribute('material', 'emissive', '#8B0000');
          this.el.setAttribute('material', 'emissiveIntensity', '0.25');
        } else {
          // Green while dragging inside bounds and below ceiling
          this.el.setAttribute('material', 'color', '#4CAF50');
          this.el.setAttribute('material', 'emissive', '#2E7D32');
          this.el.setAttribute('material', 'emissiveIntensity', '0.3');
        }
      }
    }
  },
  
  onMouseUp: function(e) {
    // Reset mouse down position
    this.mouseDownPosition = null;
    
    if (this.isDragging) {
      this.isDragging = false;
      
      // Check if this is a wall-mounted item
      const wallMountedComponent = this.el.components['wall-mounted'];
      const isWallMounted = wallMountedComponent !== undefined;
      
      if (isWallMounted) {
        // For wall-mounted items, ensure they stay on wall with proper constraints
        const finalPosition = this.el.object3D.position;
        if (wallMountedComponent.currentWall) {
          // constrainToWall handles Y position constraint based on object height and wall height
          const result = wallMountedComponent.constrainToWall(finalPosition, wallMountedComponent.currentWall);
          wallMountedComponent.currentWall = result.wall;
          
          // Y position is already properly constrained by constrainToWall
          // (includes object height calculation to prevent passing through ceiling/floor)
          this.el.setAttribute('position', `${result.position.x} ${result.position.y} ${result.position.z}`);
          
          // Always ensure facing room center when released on wall
          if (result.rotation !== undefined) {
            const currentRot = this.el.getAttribute('rotation');
            const currentX = typeof currentRot === 'object' ? currentRot.x : 
                            (typeof currentRot === 'string' ? parseFloat(currentRot.split(' ')[0]) : 0);
            const currentZ = typeof currentRot === 'object' ? currentRot.z : 
                            (typeof currentRot === 'string' ? parseFloat(currentRot.split(' ')[2]) : 0);
            
            // Update Y rotation to face room center, preserve X and Z rotation
            this.el.setAttribute('rotation', {
              x: currentX,
              y: result.rotation, // Face room center based on current wall
              z: currentZ
            });
          }
        }
      } else {
        // Regular items - final boundary check
        const finalPosition = this.el.object3D.position;
        const adjustedPosition = this.checkBoundaries(finalPosition);
        
        if (!this.positionsEqual(finalPosition, adjustedPosition)) {
          this.el.setAttribute('position', `${adjustedPosition.x} ${adjustedPosition.y} ${adjustedPosition.z}`);
          console.log('Table position adjusted to stay within bounds');
        }
      }
      
      // Don't reset color here - let tick() handle it based on collision state
      // This allows the object to stay red if it's near walls (but not for wall-mounted items)
      
      console.log('Stopped dragging:', this.el.id);
    }
  },
  
  getDistanceToWall: function(position, wall, wallMountedComponent) {
    // Helper function to calculate distance from position to a specific wall
    const roomWidth = wallMountedComponent.data.roomWidth || 10;
    const roomLength = wallMountedComponent.data.roomLength || 10;
    const wallThickness = wallMountedComponent.data.wallThickness || 0.1;
    const innerX = roomWidth / 2 - wallThickness / 2;
    const innerZ = roomLength / 2 - wallThickness / 2;
    
    switch(wall) {
      case 'front':
        return Math.abs(position.z - (-innerZ));
      case 'back':
        return Math.abs(position.z - innerZ);
      case 'left':
        return Math.abs(position.x - (-innerX));
      case 'right':
        return Math.abs(position.x - innerX);
      default:
        return Infinity;
    }
  },
  
  tick: function() {
    // Track rotation to recalculate dimensions when object rotates
    const currentRotation = this.el.getAttribute('rotation');
    if (currentRotation) {
      const rotY = typeof currentRotation === 'object' ? currentRotation.y : 
                   (typeof currentRotation === 'string' ? parseFloat(currentRotation.split(' ')[1]) : 0);
      
      // If rotation changed significantly, recalculate dimensions
      if (this.lastRotationY !== undefined && Math.abs(this.lastRotationY - rotY) > 1) {
        this.calculateDimensions();
      }
      this.lastRotationY = rotY;
    }
    
    // Skip collision checking while dragging (handled in onMouseMove)
    if (this.isDragging) return;
    
    // Check if object is selected (selected objects should stay green)
    const clickableComponent = this.el.components['clickable-furniture'];
    const isSelected = clickableComponent && clickableComponent.isSelected;
    
    // If selected, keep it green (selection takes priority)
    if (isSelected) return;
    
    // Check if this is a wall-mounted item - don't show red color for fixtures
    const wallMountedComponent = this.el.components['wall-mounted'];
    const isWallMounted = wallMountedComponent !== undefined;
    
    // Skip color feedback for wall-mounted items (they stay green)
    if (isWallMounted) {
      return;
    }
    
    // Check current position for wall proximity (only for regular items)
    const currentPosition = this.el.object3D.position;
    const isNearWall = this.isColliding(currentPosition);
    
    // Get current material color
    const material = this.el.getAttribute('material');
    const currentColor = material && material.color ? material.color : this.defaultColor;
    
    // Update color based on wall proximity
    if (isNearWall) {
      // Turn red when near walls
      if (currentColor !== '#FF6B6B') {
        this.el.setAttribute('material', 'color', '#FF6B6B');
        this.el.setAttribute('material', 'emissive', '#8B0000');
        this.el.setAttribute('material', 'emissiveIntensity', '0.25');
      }
    } else {
      // Return to default color when away from walls
      if (currentColor !== this.defaultColor && currentColor !== '#4CAF50') {
        this.el.setAttribute('material', 'color', this.defaultColor);
        this.el.setAttribute('material', 'emissive', '#000000');
        this.el.setAttribute('material', 'emissiveIntensity', '0');
      }
    }
  },
  
  checkBoundaries: function(position) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    // Use actual calculated dimensions from 3D model, fallback to schema defaults
    const objWidth = this.actualWidth || this.data.objectWidth;
    const objLength = this.actualLength || this.data.objectLength;
    const wallThickness = this.data.wallThickness;
    
    // Calculate safe boundaries using INNER wall faces (account for wall thickness)
    const innerX = roomWidth/2 - wallThickness/2;
    const innerZ = roomLength/2 - wallThickness/2;
    let safeXMin = -innerX + objWidth/2;
    let safeXMax = innerX - objWidth/2;
    const safeZMin = -innerZ + objLength/2;
    const safeZMax = innerZ - objLength/2;

    // If cost board exists on right side, clamp to just inside its plane
    const boardEl = document.getElementById('cost-board');
    if (boardEl && boardEl.object3D) {
      const boardX = boardEl.object3D.position.x;
      const proximity = 0.02; // 2cm margin before board
      const boardLimit = boardX - objWidth/2 - proximity;
      if (!isNaN(boardLimit)) {
        safeXMax = Math.min(safeXMax, boardLimit);
      }
    }
    
    let newX = Math.max(safeXMin, Math.min(safeXMax, position.x));
    let newZ = Math.max(safeZMin, Math.min(safeZMax, position.z));
    
    return {
      x: newX,
      y: position.y,
      z: newZ
    };
  },
  
  isColliding: function(position) {
    const roomWidth = this.data.roomWidth;
    const roomLength = this.data.roomLength;
    // Use actual calculated dimensions from 3D model, fallback to schema defaults
    const objWidth = this.actualWidth || this.data.objectWidth;
    const objLength = this.actualLength || this.data.objectLength;
    const wallThickness = this.data.wallThickness;
    const epsilon = 0.1; // Only turn red when very close to walls (almost touching)
    
    const innerX = roomWidth/2 - wallThickness/2;
    const innerZ = roomLength/2 - wallThickness/2;
    const safeXMin = -innerX + objWidth/2;
    const safeXMax = innerX - objWidth/2;
    const safeZMin = -innerZ + objLength/2;
    const safeZMax = innerZ - objLength/2;
    
    // Right-side board plane (if present) overrides right wall proximity
    let rightTouch = position.x >= safeXMax - epsilon;
    const boardEl = document.getElementById('cost-board');
    if (boardEl && boardEl.object3D) {
      const boardX = boardEl.object3D.position.x;
      const proximity = 0.05; // 5cm margin before board
      const boardTouchX = position.x + objWidth/2 >= boardX - proximity;
      rightTouch = boardTouchX; // prefer board proximity for visual feedback
    }
    
    // Check wall collisions
    const wallCollision = (
      position.x <= safeXMin + epsilon ||
      rightTouch ||
      position.z <= safeZMin + epsilon ||
      position.z >= safeZMax - epsilon
    );
    
    // Check ceiling collision
    // Get ceiling height from localStorage or use default
    const savedHeight = localStorage.getItem("roomHeight");
    const ceilingHeight = savedHeight ? parseFloat(savedHeight) : 3;
    
    // Calculate object height
    let objectHeight = 0.5; // Default height
    if (this.el && this.el.object3D) {
      const box = new THREE.Box3();
      this.el.object3D.updateMatrixWorld(true);
      let hasGeometry = false;
      
      this.el.object3D.traverse(function(child) {
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
        objectHeight = size.y;
      }
    }
    
    // Check if item is touching or above ceiling
    // Item center Y + half object height >= ceiling height - epsilon
    const itemTop = position.y + objectHeight / 2;
    const ceilingCollision = itemTop >= ceilingHeight - epsilon;
    
    // Return true if colliding with walls OR ceiling
    return wallCollision || ceilingCollision;
  },
  
  positionsEqual: function(pos1, pos2) {
    return Math.abs(pos1.x - pos2.x) < 0.01 && 
           Math.abs(pos1.z - pos2.z) < 0.01;
  },
  
  remove: function() {
    // Clean up event listeners
    this.el.removeEventListener('mousedown', this.onMouseDown);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
});

