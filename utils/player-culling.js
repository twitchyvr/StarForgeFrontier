/**
 * Player culling system for distant objects
 * Optimizes performance by only sending relevant game state to each player
 */

class PlayerCullingSystem {
  constructor(options = {}) {
    this.maxViewDistance = options.maxViewDistance || 2000;
    this.updateInterval = options.updateInterval || 1000; // 1 second
    this.cullingSectors = new Map(); // Map<sectorKey, Set<playerIds>>
    this.playerVisibilityMap = new Map(); // Map<playerId, Set<visibleObjectIds>>
    this.objectPositions = new Map(); // Map<objectId, {x, y, type}>
    
    // Performance settings
    this.enableDynamicCulling = options.enableDynamicCulling !== false;
    this.enablePredictiveCulling = options.enablePredictiveCulling || false;
    this.maxObjectsPerPlayer = options.maxObjectsPerPlayer || 500;
    
    // Metrics
    this.metrics = {
      totalCullChecks: 0,
      objectsCulled: 0,
      avgObjectsPerPlayer: 0,
      cullingTime: 0
    };
    
    this.lastUpdate = Date.now();
  }

  /**
   * Update player position for culling calculations
   */
  updatePlayerPosition(playerId, x, y, velocity = null) {
    const sectorKey = this.getSectorKey(x, y);
    
    // Remove player from old sectors
    for (const [key, players] of this.cullingSectors.entries()) {
      if (players.has(playerId) && key !== sectorKey) {
        players.delete(playerId);
        if (players.size === 0) {
          this.cullingSectors.delete(key);
        }
      }
    }
    
    // Add player to new sector
    if (!this.cullingSectors.has(sectorKey)) {
      this.cullingSectors.set(sectorKey, new Set());
    }
    this.cullingSectors.get(sectorKey).add(playerId);
    
    // Store player data
    this.objectPositions.set(playerId, { 
      x, y, 
      type: 'player',
      velocity: velocity || { x: 0, y: 0 },
      lastUpdate: Date.now()
    });
  }

  /**
   * Add or update an object for culling
   */
  updateObject(objectId, x, y, type = 'generic', metadata = {}) {
    this.objectPositions.set(objectId, { 
      x, y, type, 
      metadata,
      lastUpdate: Date.now()
    });
  }

  /**
   * Remove an object from culling
   */
  removeObject(objectId) {
    this.objectPositions.delete(objectId);
    
    // Remove from all visibility maps
    for (const visibleObjects of this.playerVisibilityMap.values()) {
      visibleObjects.delete(objectId);
    }
  }

  /**
   * Get visible objects for a specific player
   */
  getVisibleObjects(playerId, forceUpdate = false) {
    const now = Date.now();
    
    if (!forceUpdate && now - this.lastUpdate < this.updateInterval) {
      return Array.from(this.playerVisibilityMap.get(playerId) || new Set());
    }

    const startTime = Date.now();
    this.updateVisibilityForPlayer(playerId);
    this.metrics.cullingTime += Date.now() - startTime;
    
    return Array.from(this.playerVisibilityMap.get(playerId) || new Set());
  }

  /**
   * Update visibility for a specific player
   */
  updateVisibilityForPlayer(playerId) {
    const playerData = this.objectPositions.get(playerId);
    if (!playerData) return;

    const visibleObjects = new Set();
    const viewDistance = this.getViewDistanceForPlayer(playerId);
    
    this.metrics.totalCullChecks++;

    // Check all objects for visibility
    for (const [objectId, objectData] of this.objectPositions.entries()) {
      if (objectId === playerId) continue; // Skip self
      
      const distance = this.calculateDistance(
        playerData.x, playerData.y,
        objectData.x, objectData.y
      );

      if (this.isObjectVisible(playerId, objectId, distance, viewDistance, objectData)) {
        visibleObjects.add(objectId);
      }
    }

    // Apply object limit if necessary
    if (visibleObjects.size > this.maxObjectsPerPlayer) {
      const sortedObjects = Array.from(visibleObjects)
        .map(objectId => ({
          id: objectId,
          data: this.objectPositions.get(objectId),
          distance: this.calculateDistance(
            playerData.x, playerData.y,
            this.objectPositions.get(objectId).x,
            this.objectPositions.get(objectId).y
          ),
          priority: this.getObjectPriority(objectId, this.objectPositions.get(objectId))
        }))
        .sort((a, b) => {
          // Sort by priority first, then by distance
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return a.distance - b.distance;
        })
        .slice(0, this.maxObjectsPerPlayer);

      visibleObjects.clear();
      sortedObjects.forEach(obj => visibleObjects.add(obj.id));
    }

    this.playerVisibilityMap.set(playerId, visibleObjects);
    this.metrics.objectsCulled += this.objectPositions.size - visibleObjects.size;
    
    // Update average objects per player
    const totalVisible = Array.from(this.playerVisibilityMap.values())
      .reduce((sum, set) => sum + set.size, 0);
    this.metrics.avgObjectsPerPlayer = this.playerVisibilityMap.size > 0 ? 
      totalVisible / this.playerVisibilityMap.size : 0;
  }

  /**
   * Update visibility for all players
   */
  updateAllPlayerVisibility() {
    const startTime = Date.now();
    
    for (const playerId of this.playerVisibilityMap.keys()) {
      this.updateVisibilityForPlayer(playerId);
    }
    
    this.lastUpdate = Date.now();
    this.metrics.cullingTime += Date.now() - startTime;
  }

  /**
   * Get visible objects for broadcast optimization
   */
  getPlayersInRange(centerX, centerY, range) {
    const playersInRange = new Set();
    
    for (const [playerId, data] of this.objectPositions.entries()) {
      if (data.type === 'player') {
        const distance = this.calculateDistance(centerX, centerY, data.x, data.y);
        if (distance <= range) {
          playersInRange.add(playerId);
        }
      }
    }
    
    return Array.from(playersInRange);
  }

  /**
   * Get sector-based player groups for efficient broadcasting
   */
  getSectorPlayerGroups() {
    const groups = new Map();
    
    for (const [sectorKey, playerIds] of this.cullingSectors.entries()) {
      if (playerIds.size > 0) {
        groups.set(sectorKey, Array.from(playerIds));
      }
    }
    
    return groups;
  }

  /**
   * Check if an object should be visible to a player
   */
  isObjectVisible(playerId, objectId, distance, viewDistance, objectData) {
    // Basic distance check
    if (distance > viewDistance) return false;

    // Type-specific visibility rules
    switch (objectData.type) {
      case 'player':
        return true; // Always show other players in range
      
      case 'ore':
        // Show ores based on detection capabilities
        const detectionMultiplier = this.getPlayerDetectionMultiplier(playerId);
        return distance <= (viewDistance * 0.6 * detectionMultiplier);
      
      case 'projectile':
        // Show projectiles to nearby players
        return distance <= Math.min(viewDistance * 0.8, 500);
      
      case 'station':
      case 'structure':
        // Show large structures at greater distances
        return distance <= viewDistance * 1.2;
      
      case 'effect':
      case 'explosion':
        // Show effects for short duration at close range
        const age = Date.now() - (objectData.metadata?.createdAt || 0);
        return distance <= 300 && age < 5000; // 5 seconds
      
      default:
        return distance <= viewDistance * 0.8;
    }
  }

  /**
   * Get view distance for a specific player (can be modified by upgrades)
   */
  getViewDistanceForPlayer(playerId) {
    // Base view distance
    let viewDistance = this.maxViewDistance;
    
    // Apply player-specific modifiers
    const playerData = this.objectPositions.get(playerId);
    if (playerData && playerData.metadata) {
      const sensorMultiplier = playerData.metadata.sensorMultiplier || 1;
      viewDistance *= sensorMultiplier;
    }
    
    return Math.min(viewDistance, this.maxViewDistance * 2); // Cap at 2x base
  }

  /**
   * Get detection multiplier for a player (affects ore/hidden object visibility)
   */
  getPlayerDetectionMultiplier(playerId) {
    const playerData = this.objectPositions.get(playerId);
    if (playerData && playerData.metadata) {
      return playerData.metadata.detectionMultiplier || 1;
    }
    return 1;
  }

  /**
   * Get priority for object visibility (higher priority objects are kept when culling)
   */
  getObjectPriority(objectId, objectData) {
    switch (objectData.type) {
      case 'player': return 100;
      case 'projectile': return 90;
      case 'station': return 80;
      case 'ore': return 60;
      case 'effect': return 40;
      case 'structure': return 70;
      default: return 50;
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get sector key for spatial partitioning
   */
  getSectorKey(x, y, sectorSize = 1000) {
    const sectorX = Math.floor(x / sectorSize);
    const sectorY = Math.floor(y / sectorSize);
    return `${sectorX},${sectorY}`;
  }

  /**
   * Get nearby sectors for broader visibility checks
   */
  getNearbySectors(x, y, radius = 1) {
    const centerSectorX = Math.floor(x / 1000);
    const centerSectorY = Math.floor(y / 1000);
    const sectors = [];
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        sectors.push(`${centerSectorX + dx},${centerSectorY + dy}`);
      }
    }
    
    return sectors;
  }

  /**
   * Cleanup old/inactive objects
   */
  cleanup(maxAge = 300000) { // 5 minutes
    const now = Date.now();
    const objectsToRemove = [];
    
    for (const [objectId, data] of this.objectPositions.entries()) {
      if (data.type !== 'player' && (now - data.lastUpdate) > maxAge) {
        objectsToRemove.push(objectId);
      }
    }
    
    objectsToRemove.forEach(objectId => {
      this.removeObject(objectId);
    });
    
    return objectsToRemove.length;
  }

  /**
   * Get culling statistics
   */
  getStats() {
    return {
      ...this.metrics,
      totalObjects: this.objectPositions.size,
      totalPlayers: Array.from(this.objectPositions.values())
        .filter(data => data.type === 'player').length,
      totalSectors: this.cullingSectors.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage() {
    const objectsSize = this.objectPositions.size * 100; // rough estimate
    const visibilitySize = Array.from(this.playerVisibilityMap.values())
      .reduce((sum, set) => sum + set.size, 0) * 8;
    const sectorsSize = this.cullingSectors.size * 50;
    
    return {
      estimatedBytes: objectsSize + visibilitySize + sectorsSize,
      estimatedKB: Math.round((objectsSize + visibilitySize + sectorsSize) / 1024 * 100) / 100
    };
  }

  /**
   * Configure culling parameters at runtime
   */
  configure(options) {
    if (options.maxViewDistance !== undefined) {
      this.maxViewDistance = options.maxViewDistance;
    }
    if (options.updateInterval !== undefined) {
      this.updateInterval = options.updateInterval;
    }
    if (options.maxObjectsPerPlayer !== undefined) {
      this.maxObjectsPerPlayer = options.maxObjectsPerPlayer;
    }
    if (options.enableDynamicCulling !== undefined) {
      this.enableDynamicCulling = options.enableDynamicCulling;
    }
    if (options.enablePredictiveCulling !== undefined) {
      this.enablePredictiveCulling = options.enablePredictiveCulling;
    }
  }

  /**
   * Reset all culling data
   */
  reset() {
    this.cullingSectors.clear();
    this.playerVisibilityMap.clear();
    this.objectPositions.clear();
    this.metrics = {
      totalCullChecks: 0,
      objectsCulled: 0,
      avgObjectsPerPlayer: 0,
      cullingTime: 0
    };
  }
}

module.exports = PlayerCullingSystem;