/**
 * Spatial indexing system for efficient collision detection
 * Uses a grid-based spatial hash for O(1) lookups
 */

class SpatialIndex {
  constructor(cellSize = 100) {
    this.cellSize = cellSize;
    this.grid = new Map(); // Map<string, Set<object>>
    this.objects = new Map(); // Map<object, {x, y, cellKey}>
  }

  /**
   * Get the grid cell key for given coordinates
   */
  getCellKey(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Add an object to the spatial index
   */
  addObject(object, x, y) {
    const cellKey = this.getCellKey(x, y);
    
    // Remove from previous cell if exists
    this.removeObject(object);
    
    // Add to new cell
    if (!this.grid.has(cellKey)) {
      this.grid.set(cellKey, new Set());
    }
    
    this.grid.get(cellKey).add(object);
    this.objects.set(object, { x, y, cellKey });
  }

  /**
   * Remove an object from the spatial index
   */
  removeObject(object) {
    const objectData = this.objects.get(object);
    if (objectData) {
      const cell = this.grid.get(objectData.cellKey);
      if (cell) {
        cell.delete(object);
        if (cell.size === 0) {
          this.grid.delete(objectData.cellKey);
        }
      }
      this.objects.delete(object);
    }
  }

  /**
   * Update an object's position in the spatial index
   */
  updateObject(object, x, y) {
    const objectData = this.objects.get(object);
    if (objectData) {
      const newCellKey = this.getCellKey(x, y);
      
      // Only update if the object moved to a different cell
      if (objectData.cellKey !== newCellKey) {
        this.addObject(object, x, y);
      } else {
        // Update stored position
        objectData.x = x;
        objectData.y = y;
      }
    } else {
      this.addObject(object, x, y);
    }
  }

  /**
   * Get all objects within a radius of the given position
   */
  getObjectsInRadius(x, y, radius) {
    const objects = new Set();
    const radiusSquared = radius * radius;
    
    // Calculate which cells to check
    const minCellX = Math.floor((x - radius) / this.cellSize);
    const maxCellX = Math.floor((x + radius) / this.cellSize);
    const minCellY = Math.floor((y - radius) / this.cellSize);
    const maxCellY = Math.floor((y + radius) / this.cellSize);
    
    // Check all relevant cells
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cellKey = `${cellX},${cellY}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          cell.forEach(object => {
            const objectData = this.objects.get(object);
            if (objectData) {
              const dx = objectData.x - x;
              const dy = objectData.y - y;
              const distanceSquared = dx * dx + dy * dy;
              
              if (distanceSquared <= radiusSquared) {
                objects.add(object);
              }
            }
          });
        }
      }
    }
    
    return Array.from(objects);
  }

  /**
   * Get all objects in a rectangular area
   */
  getObjectsInRect(x1, y1, x2, y2) {
    const objects = new Set();
    
    // Ensure correct bounds
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    // Calculate which cells to check
    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellY = Math.floor(minY / this.cellSize);
    const maxCellY = Math.floor(maxY / this.cellSize);
    
    // Check all relevant cells
    for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
      for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
        const cellKey = `${cellX},${cellY}`;
        const cell = this.grid.get(cellKey);
        
        if (cell) {
          cell.forEach(object => {
            const objectData = this.objects.get(object);
            if (objectData && 
                objectData.x >= minX && objectData.x <= maxX &&
                objectData.y >= minY && objectData.y <= maxY) {
              objects.add(object);
            }
          });
        }
      }
    }
    
    return Array.from(objects);
  }

  /**
   * Get nearby objects for collision detection
   */
  getNearbyObjects(object, radius) {
    const objectData = this.objects.get(object);
    if (!objectData) {
      return [];
    }
    
    const nearby = this.getObjectsInRadius(objectData.x, objectData.y, radius);
    return nearby.filter(obj => obj !== object);
  }

  /**
   * Clear all objects from the spatial index
   */
  clear() {
    this.grid.clear();
    this.objects.clear();
  }

  /**
   * Get statistics about the spatial index
   */
  getStats() {
    let totalObjects = this.objects.size;
    let totalCells = this.grid.size;
    let maxObjectsPerCell = 0;
    let minObjectsPerCell = totalObjects > 0 ? Infinity : 0;
    
    this.grid.forEach(cell => {
      const size = cell.size;
      maxObjectsPerCell = Math.max(maxObjectsPerCell, size);
      minObjectsPerCell = Math.min(minObjectsPerCell, size);
    });
    
    return {
      totalObjects,
      totalCells,
      maxObjectsPerCell,
      minObjectsPerCell: minObjectsPerCell === Infinity ? 0 : minObjectsPerCell,
      averageObjectsPerCell: totalCells > 0 ? totalObjects / totalCells : 0,
      cellSize: this.cellSize
    };
  }

  /**
   * Optimize the spatial index by cleaning up empty cells
   */
  optimize() {
    // Remove empty cells
    for (const [key, cell] of this.grid.entries()) {
      if (cell.size === 0) {
        this.grid.delete(key);
      }
    }
  }
}

module.exports = SpatialIndex;