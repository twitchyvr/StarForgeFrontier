/**
 * WarpSystem.js - Handles warp drive mechanics, fuel costs, and travel times
 * Manages inter-sector travel and related gameplay mechanics
 */

class WarpSystem {
  constructor(database, sectorManager) {
    this.db = database;
    this.sectorManager = sectorManager;
    this.activeWarps = new Map(); // Track ongoing warp operations
    this.warpCooldowns = new Map(); // Player warp cooldowns
    
    // Warp system constants
    this.WARP_COOLDOWN = 10000; // 10 seconds between warps
    this.BASE_FUEL_COST_PER_SECTOR = 50;
    this.BASE_TRAVEL_TIME_PER_SECTOR = 10000; // 10 seconds
    this.EMERGENCY_WARP_FUEL_MULTIPLIER = 3;
    this.MAX_WARP_RANGE = 10; // Maximum sectors in single warp
    
    console.log('WarpSystem initialized');
  }

  /**
   * Check if player can initiate warp
   */
  canPlayerWarp(playerId) {
    // Check cooldown
    const lastWarp = this.warpCooldowns.get(playerId) || 0;
    const now = Date.now();
    
    if (now - lastWarp < this.WARP_COOLDOWN) {
      return {
        canWarp: false,
        reason: 'Warp drive cooling down',
        remainingCooldown: this.WARP_COOLDOWN - (now - lastWarp)
      };
    }
    
    // Check if already warping
    if (this.activeWarps.has(playerId)) {
      return {
        canWarp: false,
        reason: 'Already warping'
      };
    }
    
    return { canWarp: true };
  }

  /**
   * Calculate warp requirements between sectors
   */
  calculateWarpRequirements(fromCoords, toCoords, playerData) {
    const distance = Math.sqrt(
      (toCoords.x - fromCoords.x) ** 2 + 
      (toCoords.y - fromCoords.y) ** 2
    );
    
    // Check maximum range
    if (distance > this.MAX_WARP_RANGE) {
      return {
        valid: false,
        reason: `Warp range exceeded. Maximum range: ${this.MAX_WARP_RANGE} sectors`
      };
    }
    
    // Base calculations
    let fuelCost = Math.ceil(distance * this.BASE_FUEL_COST_PER_SECTOR);
    let travelTime = Math.ceil(distance * this.BASE_TRAVEL_TIME_PER_SECTOR);
    
    // Apply ship modifications
    const warpEfficiency = this.calculateWarpEfficiency(playerData);
    fuelCost = Math.ceil(fuelCost * warpEfficiency.fuelMultiplier);
    travelTime = Math.ceil(travelTime * warpEfficiency.timeMultiplier);
    
    // Apply environmental modifiers from origin sector
    const fromSector = this.sectorManager.getPlayerSector(playerData.id);
    if (fromSector) {
      const envModifier = fromSector.getWarpCostModifier();
      fuelCost = Math.ceil(fuelCost * envModifier);
      travelTime = Math.ceil(travelTime * envModifier);
    }
    
    return {
      valid: true,
      fuelCost,
      travelTime,
      distance,
      efficiency: warpEfficiency,
      canAfford: playerData.resources >= fuelCost
    };
  }

  /**
   * Calculate warp efficiency based on ship modules
   */
  calculateWarpEfficiency(playerData) {
    let fuelMultiplier = 1.0;
    let timeMultiplier = 1.0;
    
    if (playerData.modules && playerData.modules.length > 0) {
      // Count warp-related modules
      const engineCount = playerData.modules.filter(m => m.id === 'engine').length;
      
      // More engines = better warp efficiency
      if (engineCount > 0) {
        fuelMultiplier *= Math.max(0.5, 1 - (engineCount * 0.15)); // Up to 50% fuel savings
        timeMultiplier *= Math.max(0.6, 1 - (engineCount * 0.1));  // Up to 40% time savings
      }
      
      // Future: Add dedicated warp drive modules
      const warpDrives = playerData.modules.filter(m => m.id === 'warp_drive').length;
      if (warpDrives > 0) {
        fuelMultiplier *= Math.max(0.3, 1 - (warpDrives * 0.25));
        timeMultiplier *= Math.max(0.4, 1 - (warpDrives * 0.2));
      }
    }
    
    return {
      fuelMultiplier,
      timeMultiplier,
      engineCount: playerData.modules?.filter(m => m.id === 'engine').length || 0
    };
  }

  /**
   * Initiate warp travel for a player
   */
  async initiateWarp(playerId, playerData, targetCoords, isEmergencyWarp = false) {
    try {
      // Validate warp capability
      const warpCheck = this.canPlayerWarp(playerId);
      if (!warpCheck.canWarp) {
        return { success: false, reason: warpCheck.reason, remainingCooldown: warpCheck.remainingCooldown };
      }
      
      // Get current sector coordinates
      const currentCoords = this.sectorManager.getSectorCoordinatesForPosition(playerData.x, playerData.y);
      
      // Validate target sector
      if (!this.sectorManager.isWithinGalaxyBounds(targetCoords)) {
        return { success: false, reason: 'Target sector is outside galaxy bounds' };
      }
      
      if (targetCoords.x === currentCoords.x && targetCoords.y === currentCoords.y) {
        return { success: false, reason: 'Already in target sector' };
      }
      
      // Calculate requirements
      const requirements = this.calculateWarpRequirements(currentCoords, targetCoords, playerData);
      if (!requirements.valid) {
        return { success: false, reason: requirements.reason };
      }
      
      let { fuelCost, travelTime } = requirements;
      
      // Apply emergency warp multiplier
      if (isEmergencyWarp) {
        fuelCost *= this.EMERGENCY_WARP_FUEL_MULTIPLIER;
        travelTime = Math.ceil(travelTime * 0.5); // Emergency warps are faster
      }
      
      // Check fuel availability
      if (playerData.resources < fuelCost) {
        return { 
          success: false, 
          reason: `Insufficient fuel. Need ${fuelCost} resources, have ${playerData.resources}`,
          fuelCost,
          fuelShortage: fuelCost - playerData.resources
        };
      }
      
      // Consume fuel
      playerData.resources -= fuelCost;
      
      // Create warp operation
      const warpId = require('uuid').v4();
      const warpOperation = {
        id: warpId,
        playerId,
        fromCoords: currentCoords,
        toCoords: targetCoords,
        startTime: Date.now(),
        travelTime,
        fuelCost,
        isEmergencyWarp,
        arrivalTime: Date.now() + travelTime
      };
      
      this.activeWarps.set(playerId, warpOperation);
      this.warpCooldowns.set(playerId, Date.now());
      
      // Record warp in database
      await this.db.recordWarpRoute(
        playerId, 
        currentCoords.x, 
        currentCoords.y, 
        targetCoords.x, 
        targetCoords.y, 
        fuelCost, 
        travelTime
      );
      
      console.log(`Player ${playerId} initiated warp from (${currentCoords.x},${currentCoords.y}) to (${targetCoords.x},${targetCoords.y})`);
      
      return {
        success: true,
        warpId,
        fromCoords: currentCoords,
        toCoords: targetCoords,
        fuelCost,
        travelTime,
        arrivalTime: warpOperation.arrivalTime,
        remainingResources: playerData.resources,
        isEmergencyWarp
      };
      
    } catch (error) {
      console.error('Error initiating warp:', error);
      return { success: false, reason: 'Warp system error' };
    }
  }

  /**
   * Process warp completions
   */
  async processWarpCompletions() {
    const now = Date.now();
    const completedWarps = [];
    
    for (const [playerId, warpOp] of this.activeWarps.entries()) {
      if (now >= warpOp.arrivalTime) {
        completedWarps.push({ playerId, warpOp });
        this.activeWarps.delete(playerId);
      }
    }
    
    return completedWarps;
  }

  /**
   * Complete warp operation for a player
   */
  async completeWarp(playerId, warpOp, playerData) {
    try {
      // Calculate arrival position in target sector
      const arrivalPosition = this.calculateArrivalPosition(warpOp.toCoords, warpOp.fromCoords);
      
      // Move player to new sector
      const result = await this.sectorManager.movePlayerToSector(
        playerId, 
        warpOp.toCoords, 
        arrivalPosition
      );
      
      // Update player position
      playerData.x = arrivalPosition.x;
      playerData.y = arrivalPosition.y;
      
      // Update database
      await this.db.updatePlayerPosition(playerId, arrivalPosition.x, arrivalPosition.y);
      await this.db.updatePlayerSectorLocation(playerId, warpOp.toCoords.x, warpOp.toCoords.y, true);
      
      // Record sector discovery if first visit
      await this.db.recordSectorDiscovery(playerId, warpOp.toCoords.x, warpOp.toCoords.y, 0);
      
      console.log(`Player ${playerId} completed warp to sector (${warpOp.toCoords.x},${warpOp.toCoords.y})`);
      
      return {
        success: true,
        newSector: result.sector.getSectorData(),
        newPosition: arrivalPosition,
        warpData: {
          fuelUsed: warpOp.fuelCost,
          travelTime: warpOp.travelTime,
          isEmergencyWarp: warpOp.isEmergencyWarp
        }
      };
      
    } catch (error) {
      console.error('Error completing warp:', error);
      return { success: false, reason: 'Warp completion error' };
    }
  }

  /**
   * Calculate arrival position in target sector
   */
  calculateArrivalPosition(toCoords, fromCoords) {
    // For now, arrive at center of target sector
    // Future enhancement: calculate based on warp trajectory
    return {
      x: toCoords.x * 2000 + (Math.random() - 0.5) * 200, // Add some randomness
      y: toCoords.y * 2000 + (Math.random() - 0.5) * 200
    };
  }

  /**
   * Get available warp destinations for a player
   */
  async getWarpDestinations(playerId, playerData, maxRange = 5) {
    const currentCoords = this.sectorManager.getSectorCoordinatesForPosition(playerData.x, playerData.y);
    const destinations = [];
    
    // Get sectors within range
    for (let x = currentCoords.x - maxRange; x <= currentCoords.x + maxRange; x++) {
      for (let y = currentCoords.y - maxRange; y <= currentCoords.y + maxRange; y++) {
        const targetCoords = { x, y };
        
        // Skip current sector
        if (x === currentCoords.x && y === currentCoords.y) {
          continue;
        }
        
        // Check galaxy bounds
        if (!this.sectorManager.isWithinGalaxyBounds(targetCoords)) {
          continue;
        }
        
        // Calculate warp requirements
        const requirements = this.calculateWarpRequirements(currentCoords, targetCoords, playerData);
        
        if (requirements.valid) {
          // Check if player has discovered this sector
          const discoveries = await this.db.getPlayerDiscoveries(playerId);
          const isDiscovered = discoveries.some(d => d.sector_x === x && d.sector_y === y);
          
          // Generate basic sector info
          const sectorInfo = await this.generateSectorPreview(targetCoords, isDiscovered);
          
          destinations.push({
            coordinates: targetCoords,
            distance: requirements.distance,
            fuelCost: requirements.fuelCost,
            travelTime: requirements.travelTime,
            canAfford: requirements.canAfford,
            isDiscovered,
            ...sectorInfo
          });
        }
      }
    }
    
    // Sort by distance
    destinations.sort((a, b) => a.distance - b.distance);
    
    return destinations;
  }

  /**
   * Generate sector preview information
   */
  async generateSectorPreview(coordinates, isDiscovered) {
    const seed = this.sectorManager.proceduralGen.generateSectorSeed(coordinates.x, coordinates.y);
    const biome = this.sectorManager.proceduralGen.generateSectorBiome(coordinates, seed);
    const faction = this.sectorManager.proceduralGen.generateFactionTerritory(coordinates);
    
    let preview = {
      biome: {
        name: biome.name,
        color: biome.color
      },
      faction: faction.faction,
      hasUnknown: !isDiscovered
    };
    
    if (isDiscovered) {
      // Show more details for discovered sectors
      const sectorData = await this.db.getSectorData(coordinates.x, coordinates.y);
      if (sectorData) {
        const oreCount = await this.db.getSectorOres(coordinates.x, coordinates.y);
        preview.oreCount = oreCount.length;
        preview.lastVisited = sectorData.last_updated;
        preview.biome.description = biome.description;
      }
    }
    
    return preview;
  }

  /**
   * Cancel an active warp (emergency stop)
   */
  async cancelWarp(playerId, refundPercentage = 0.5) {
    const warpOp = this.activeWarps.get(playerId);
    if (!warpOp) {
      return { success: false, reason: 'No active warp to cancel' };
    }
    
    const elapsedTime = Date.now() - warpOp.startTime;
    const progressPercentage = elapsedTime / warpOp.travelTime;
    
    // Calculate refund (less refund the further into the warp)
    const refundAmount = Math.floor(
      warpOp.fuelCost * refundPercentage * (1 - progressPercentage)
    );
    
    // Remove from active warps
    this.activeWarps.delete(playerId);
    
    console.log(`Warp cancelled for player ${playerId}, refund: ${refundAmount}`);
    
    return {
      success: true,
      fuelRefund: refundAmount,
      progressWhenCancelled: progressPercentage
    };
  }

  /**
   * Get warp status for a player
   */
  getWarpStatus(playerId) {
    const warpOp = this.activeWarps.get(playerId);
    if (!warpOp) {
      return { isWarping: false };
    }
    
    const now = Date.now();
    const elapsed = now - warpOp.startTime;
    const progress = Math.min(1, elapsed / warpOp.travelTime);
    const remaining = Math.max(0, warpOp.arrivalTime - now);
    
    return {
      isWarping: true,
      warpId: warpOp.id,
      fromCoords: warpOp.fromCoords,
      toCoords: warpOp.toCoords,
      progress,
      remainingTime: remaining,
      fuelCost: warpOp.fuelCost,
      isEmergencyWarp: warpOp.isEmergencyWarp
    };
  }

  /**
   * Handle emergency warp (instant but expensive)
   */
  async emergencyWarp(playerId, playerData, targetCoords) {
    const currentCoords = this.sectorManager.getSectorCoordinatesForPosition(playerData.x, playerData.y);
    
    // Find nearest safe sector if target not specified
    if (!targetCoords) {
      targetCoords = this.findNearestSafeSector(currentCoords);
    }
    
    // Emergency warps bypass cooldown but cost more
    const requirements = this.calculateWarpRequirements(currentCoords, targetCoords, playerData);
    if (!requirements.valid) {
      return { success: false, reason: requirements.reason };
    }
    
    const emergencyFuelCost = Math.ceil(requirements.fuelCost * this.EMERGENCY_WARP_FUEL_MULTIPLIER);
    
    if (playerData.resources < emergencyFuelCost) {
      return {
        success: false,
        reason: `Insufficient fuel for emergency warp. Need ${emergencyFuelCost} resources`,
        fuelCost: emergencyFuelCost
      };
    }
    
    // Instant warp - complete immediately
    playerData.resources -= emergencyFuelCost;
    
    const arrivalPosition = this.calculateArrivalPosition(targetCoords, currentCoords);
    const result = await this.sectorManager.movePlayerToSector(playerId, targetCoords, arrivalPosition);
    
    // Update player position and database
    playerData.x = arrivalPosition.x;
    playerData.y = arrivalPosition.y;
    
    await this.db.updatePlayerPosition(playerId, arrivalPosition.x, arrivalPosition.y);
    await this.db.updatePlayerSectorLocation(playerId, targetCoords.x, targetCoords.y, true);
    await this.db.recordWarpRoute(
      playerId, 
      currentCoords.x, 
      currentCoords.y, 
      targetCoords.x, 
      targetCoords.y, 
      emergencyFuelCost, 
      0 // Instant travel
    );
    
    // Set longer cooldown for emergency warps
    this.warpCooldowns.set(playerId, Date.now() + this.WARP_COOLDOWN);
    
    console.log(`Emergency warp completed for player ${playerId}`);
    
    return {
      success: true,
      newSector: result.sector.getSectorData(),
      newPosition: arrivalPosition,
      fuelUsed: emergencyFuelCost,
      isEmergencyWarp: true,
      remainingResources: playerData.resources
    };
  }

  /**
   * Find nearest safe sector (no environmental hazards)
   */
  findNearestSafeSector(currentCoords, maxDistance = 5) {
    const safeBiomes = ['ASTEROID_FIELD', 'DEEP_SPACE'];
    
    for (let distance = 1; distance <= maxDistance; distance++) {
      for (let x = currentCoords.x - distance; x <= currentCoords.x + distance; x++) {
        for (let y = currentCoords.y - distance; y <= currentCoords.y + distance; y++) {
          // Skip if not on the current distance ring
          if (Math.abs(x - currentCoords.x) !== distance && Math.abs(y - currentCoords.y) !== distance) {
            continue;
          }
          
          const targetCoords = { x, y };
          
          if (this.sectorManager.isWithinGalaxyBounds(targetCoords)) {
            const seed = this.sectorManager.proceduralGen.generateSectorSeed(x, y);
            const biome = this.sectorManager.proceduralGen.generateSectorBiome(targetCoords, seed);
            
            if (safeBiomes.includes(biome.name.toUpperCase().replace(/ /g, '_'))) {
              return targetCoords;
            }
          }
        }
      }
    }
    
    // Fallback to deep space at distance 1
    return { x: currentCoords.x + 1, y: currentCoords.y };
  }

  /**
   * Get warp drive efficiency rating for player
   */
  getWarpDriveRating(playerData) {
    const efficiency = this.calculateWarpEfficiency(playerData);
    
    let rating = 'Basic';
    if (efficiency.fuelMultiplier <= 0.7) rating = 'Advanced';
    if (efficiency.fuelMultiplier <= 0.5) rating = 'Military Grade';
    if (efficiency.fuelMultiplier <= 0.3) rating = 'Experimental';
    
    return {
      rating,
      fuelEfficiency: Math.round((1 - efficiency.fuelMultiplier) * 100),
      timeEfficiency: Math.round((1 - efficiency.timeMultiplier) * 100),
      maxRange: this.MAX_WARP_RANGE,
      engineCount: efficiency.engineCount
    };
  }

  /**
   * Get recommended warp targets based on player goals
   */
  async getRecommendedTargets(playerId, playerData, criteria = 'resources') {
    const currentCoords = this.sectorManager.getSectorCoordinatesForPosition(playerData.x, playerData.y);
    const destinations = await this.getWarpDestinations(playerId, playerData);
    
    let recommendations = [];
    
    switch (criteria) {
      case 'resources':
        // Recommend sectors with good ore availability
        recommendations = destinations.filter(dest => 
          dest.biome.name.includes('Asteroid') || dest.biome.name.includes('Nursery')
        );
        break;
        
      case 'exploration':
        // Recommend undiscovered sectors
        recommendations = destinations.filter(dest => !dest.isDiscovered);
        break;
        
      case 'safety':
        // Recommend safe biomes
        recommendations = destinations.filter(dest => 
          dest.biome.name.includes('Asteroid') || dest.biome.name.includes('Deep Space')
        );
        break;
        
      case 'rare_materials':
        // Recommend sectors with rare materials
        recommendations = destinations.filter(dest => 
          dest.biome.name.includes('Ancient') || dest.biome.name.includes('Black Hole')
        );
        break;
    }
    
    // Sort by fuel efficiency and distance
    recommendations.sort((a, b) => {
      const costEfficiencyA = a.distance / a.fuelCost;
      const costEfficiencyB = b.distance / b.fuelCost;
      return costEfficiencyB - costEfficiencyA;
    });
    
    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Get player's warp statistics
   */
  async getPlayerWarpStats(playerId) {
    const locationData = await this.db.getPlayerSectorLocation(playerId);
    const warpHistory = await this.db.getPlayerWarpHistory(playerId);
    const discoveries = await this.db.getPlayerDiscoveries(playerId);
    
    let totalDistance = 0;
    let averageFuelCost = 0;
    
    if (warpHistory.length > 0) {
      totalDistance = warpHistory.reduce((sum, warp) => {
        const dist = Math.sqrt(
          (warp.to_sector_x - warp.from_sector_x) ** 2 + 
          (warp.to_sector_y - warp.from_sector_y) ** 2
        );
        return sum + dist;
      }, 0);
      
      averageFuelCost = warpHistory.reduce((sum, warp) => sum + warp.fuel_cost, 0) / warpHistory.length;
    }
    
    return {
      currentSector: locationData ? { x: locationData.current_sector_x, y: locationData.current_sector_y } : { x: 0, y: 0 },
      totalWarps: locationData?.total_warps || 0,
      totalFuelConsumed: locationData?.total_fuel_consumed || 0,
      totalDistanceTraveled: Math.round(totalDistance * 100) / 100,
      averageFuelCost: Math.round(averageFuelCost),
      sectorsDiscovered: discoveries.length,
      lastWarp: locationData?.last_warp_at,
      recentWarps: warpHistory.slice(0, 5)
    };
  }

  /**
   * Clean up expired warp operations
   */
  cleanupExpiredWarps() {
    const now = Date.now();
    const expiredWarps = [];
    
    for (const [playerId, warpOp] of this.activeWarps.entries()) {
      // Remove warps that are significantly overdue (error recovery)
      if (now > warpOp.arrivalTime + 30000) { // 30 seconds grace period
        expiredWarps.push(playerId);
      }
    }
    
    for (const playerId of expiredWarps) {
      console.warn(`Removing expired warp for player ${playerId}`);
      this.activeWarps.delete(playerId);
    }
    
    return expiredWarps.length;
  }

  /**
   * Calculate fuel efficiency for route planning
   */
  calculateRouteEfficiency(waypoints, playerData) {
    let totalFuelCost = 0;
    let totalTravelTime = 0;
    
    for (let i = 0; i < waypoints.length - 1; i++) {
      const fromCoords = waypoints[i];
      const toCoords = waypoints[i + 1];
      
      const requirements = this.calculateWarpRequirements(fromCoords, toCoords, playerData);
      if (requirements.valid) {
        totalFuelCost += requirements.fuelCost;
        totalTravelTime += requirements.travelTime;
      }
    }
    
    return {
      totalFuelCost,
      totalTravelTime,
      averageFuelPerSector: totalFuelCost / Math.max(1, waypoints.length - 1),
      estimatedArrival: Date.now() + totalTravelTime
    };
  }

  /**
   * Get warp system status and diagnostics
   */
  getSystemStatus() {
    return {
      activeWarps: this.activeWarps.size,
      playersOnCooldown: this.warpCooldowns.size,
      maxWarpRange: this.MAX_WARP_RANGE,
      baseFuelCost: this.BASE_FUEL_COST_PER_SECTOR,
      baseTravelTime: this.BASE_TRAVEL_TIME_PER_SECTOR,
      emergencyMultiplier: this.EMERGENCY_WARP_FUEL_MULTIPLIER
    };
  }
}

module.exports = WarpSystem;