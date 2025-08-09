/**
 * SectorManager.js - Manages galaxy sectors with memory-efficient loading/unloading
 * Handles sector lifecycle, player movement between sectors, and cross-sector operations
 */

const { Sector } = require('./Sector');
const ProceduralGeneration = require('./ProceduralGeneration');

class SectorManager {
  constructor(database) {
    this.db = database;
    this.loadedSectors = new Map(); // Currently loaded sectors
    this.playerSectors = new Map(); // Track which sector each player is in
    this.sectorSeeds = new Map(); // Cached sector seeds
    this.maxLoadedSectors = 25; // Memory limit - max sectors to keep loaded
    this.cleanupInterval = 300000; // 5 minutes between cleanup cycles
    
    // Galaxy configuration
    this.galaxyRadius = 50; // Maximum distance from center (0,0)
    this.proceduralGen = new ProceduralGeneration();
    
    // Start periodic cleanup
    this.startCleanupTimer();
    
    console.log('SectorManager initialized');
  }

  /**
   * Get or load a sector at given coordinates
   */
  async getSector(coordinates) {
    const sectorKey = `${coordinates.x}_${coordinates.y}`;
    
    // Check if sector is already loaded
    if (this.loadedSectors.has(sectorKey)) {
      return this.loadedSectors.get(sectorKey);
    }
    
    // Check if we're at the memory limit
    if (this.loadedSectors.size >= this.maxLoadedSectors) {
      await this.performCleanup();
    }
    
    // Load or create the sector
    const sector = await this.loadSector(coordinates);
    this.loadedSectors.set(sectorKey, sector);
    
    return sector;
  }

  /**
   * Load a sector from database or generate it procedurally
   */
  async loadSector(coordinates) {
    try {
      // Try to load from database first
      const sectorData = await this.db.getSectorData(coordinates.x, coordinates.y);
      
      if (sectorData) {
        // Reconstruct sector from saved data
        const sector = new Sector(coordinates, sectorData.seed, sectorData.biome);
        await this.loadSectorFromDatabase(sector, sectorData);
        return sector;
      } else {
        // Generate new sector
        const seed = this.proceduralGen.generateSectorSeed(coordinates.x, coordinates.y);
        const biome = this.proceduralGen.generateSectorBiome(coordinates, seed);
        
        const sector = new Sector(coordinates, seed, biome);
        await sector.load();
        
        // Save to database
        await this.saveSectorToDatabase(sector);
        
        return sector;
      }
    } catch (error) {
      console.error(`Error loading sector ${coordinates.x}, ${coordinates.y}:`, error);
      
      // Fallback: create basic sector
      const seed = this.proceduralGen.generateSectorSeed(coordinates.x, coordinates.y);
      const sector = new Sector(coordinates, seed);
      await sector.load();
      return sector;
    }
  }

  /**
   * Load sector data from database
   */
  async loadSectorFromDatabase(sector, sectorData) {
    // Load ores
    const ores = await this.db.getSectorOres(sector.coordinates.x, sector.coordinates.y);
    sector.ores = ores.map(ore => ({
      id: ore.id,
      type: ore.ore_type,
      x: ore.x,
      y: ore.y,
      value: ore.value,
      spawnedAt: new Date(ore.spawned_at).getTime(),
      ...sector.constructor.ORE_TYPES?.[ore.ore_type] || {}
    }));
    
    // Load environmental hazards
    const hazards = await this.db.getSectorHazards(sector.coordinates.x, sector.coordinates.y);
    sector.environmentalHazards = hazards;
    
    sector.isLoaded = true;
    sector.lastUpdated = Date.now();
    
    console.log(`Loaded sector ${sector.id} from database with ${sector.ores.length} ores`);
  }

  /**
   * Save sector data to database
   */
  async saveSectorToDatabase(sector) {
    try {
      // Save sector metadata
      await this.db.saveSectorData({
        sector_x: sector.coordinates.x,
        sector_y: sector.coordinates.y,
        seed: sector.seed,
        biome_type: sector.biome.name,
        biome_data: JSON.stringify(sector.biome),
        last_updated: Date.now()
      });
      
      // Save ores
      for (const ore of sector.ores) {
        await this.db.saveSectorOre({
          id: ore.id,
          sector_x: sector.coordinates.x,
          sector_y: sector.coordinates.y,
          ore_type: ore.type,
          x: ore.x,
          y: ore.y,
          value: ore.value,
          spawned_at: ore.spawnedAt
        });
      }
      
      console.log(`Saved sector ${sector.id} to database`);
    } catch (error) {
      console.error(`Error saving sector ${sector.id}:`, error);
    }
  }

  /**
   * Move player to a different sector
   */
  async movePlayerToSector(playerId, newCoordinates, newPosition = null) {
    const oldSectorKey = this.playerSectors.get(playerId);
    const newSectorKey = `${newCoordinates.x}_${newCoordinates.y}`;
    
    // Remove from old sector
    if (oldSectorKey && this.loadedSectors.has(oldSectorKey)) {
      const oldSector = this.loadedSectors.get(oldSectorKey);
      oldSector.removePlayer(playerId);
    }
    
    // Get or load new sector
    const newSector = await this.getSector(newCoordinates);
    newSector.addPlayer(playerId);
    
    // Update player sector tracking
    this.playerSectors.set(playerId, newSectorKey);
    
    // Set player position in new sector
    if (newPosition) {
      // Position specified (e.g., from warp)
      return {
        sector: newSector,
        position: newPosition
      };
    } else {
      // Calculate border crossing position
      const borderPosition = this.calculateBorderPosition(newCoordinates);
      return {
        sector: newSector,
        position: borderPosition
      };
    }
  }

  /**
   * Calculate position when crossing sector border
   */
  calculateBorderPosition(coordinates) {
    // Place player at opposite edge when crossing borders
    // This creates seamless movement between sectors
    return {
      x: 0, // Center of new sector for now
      y: 0  // Could be enhanced to calculate proper border crossing
    };
  }

  /**
   * Get the sector containing a specific position
   */
  getSectorCoordinatesForPosition(x, y) {
    // Each sector is 2000x2000 units, centered on multiples of 2000
    const sectorX = Math.floor((x + 1000) / 2000);
    const sectorY = Math.floor((y + 1000) / 2000);
    
    return { x: sectorX, y: sectorY };
  }

  /**
   * Get all adjacent sector coordinates
   */
  getAdjacentSectorCoordinates(coordinates) {
    const adjacent = [];
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue; // Skip current sector
        
        const adjCoords = {
          x: coordinates.x + dx,
          y: coordinates.y + dy
        };
        
        // Check if within galaxy bounds
        if (this.isWithinGalaxyBounds(adjCoords)) {
          adjacent.push(adjCoords);
        }
      }
    }
    
    return adjacent;
  }

  /**
   * Check if coordinates are within galaxy bounds
   */
  isWithinGalaxyBounds(coordinates) {
    const distance = Math.sqrt(coordinates.x ** 2 + coordinates.y ** 2);
    return distance <= this.galaxyRadius;
  }

  /**
   * Get sectors that need to be loaded around active players
   */
  async preloadSectorsAroundPlayers() {
    const sectorsToLoad = new Set();
    
    // Get all active player sectors
    for (const sectorKey of this.playerSectors.values()) {
      const [x, y] = sectorKey.split('_').map(Number);
      const coordinates = { x, y };
      
      // Add current sector
      sectorsToLoad.add(sectorKey);
      
      // Add adjacent sectors for seamless movement
      const adjacent = this.getAdjacentSectorCoordinates(coordinates);
      for (const adjCoords of adjacent) {
        sectorsToLoad.add(`${adjCoords.x}_${adjCoords.y}`);
      }
    }
    
    // Load sectors that aren't already loaded
    const loadPromises = [];
    for (const sectorKey of sectorsToLoad) {
      if (!this.loadedSectors.has(sectorKey)) {
        const [x, y] = sectorKey.split('_').map(Number);
        loadPromises.push(this.getSector({ x, y }));
      }
    }
    
    await Promise.all(loadPromises);
  }

  /**
   * Perform memory cleanup by unloading unused sectors
   */
  async performCleanup() {
    const sectorsToUnload = [];
    const activeSectorKeys = new Set(this.playerSectors.values());
    
    // Find sectors without players that can be unloaded
    for (const [sectorKey, sector] of this.loadedSectors.entries()) {
      if (!activeSectorKeys.has(sectorKey) && sector.playerCount === 0) {
        sectorsToUnload.push(sectorKey);
      }
    }
    
    // Sort by last updated time (oldest first)
    sectorsToUnload.sort((a, b) => {
      const sectorA = this.loadedSectors.get(a);
      const sectorB = this.loadedSectors.get(b);
      return sectorA.lastUpdated - sectorB.lastUpdated;
    });
    
    // Unload oldest sectors until we're under the limit
    const unloadCount = Math.max(0, this.loadedSectors.size - this.maxLoadedSectors + 5);
    
    for (let i = 0; i < Math.min(unloadCount, sectorsToUnload.length); i++) {
      const sectorKey = sectorsToUnload[i];
      const sector = this.loadedSectors.get(sectorKey);
      
      // Save sector data before unloading
      await this.saveSectorToDatabase(sector);
      
      if (sector.unload()) {
        this.loadedSectors.delete(sectorKey);
        console.log(`Unloaded sector ${sector.id} during cleanup`);
      }
    }
  }

  /**
   * Start the periodic cleanup timer
   */
  startCleanupTimer() {
    setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Error during sector cleanup:', error);
      }
    }, this.cleanupInterval);
  }

  /**
   * Update all loaded sectors
   */
  updateAllSectors() {
    const allTriggeredEvents = [];
    
    for (const sector of this.loadedSectors.values()) {
      if (sector.isLoaded) {
        const events = sector.update();
        if (events.length > 0) {
          allTriggeredEvents.push(...events.map(event => ({
            ...event,
            sectorCoordinates: sector.coordinates
          })));
        }
      }
    }
    
    return allTriggeredEvents;
  }

  /**
   * Get player's current sector
   */
  getPlayerSector(playerId) {
    const sectorKey = this.playerSectors.get(playerId);
    if (sectorKey && this.loadedSectors.has(sectorKey)) {
      return this.loadedSectors.get(sectorKey);
    }
    return null;
  }

  /**
   * Remove player from sector tracking
   */
  removePlayer(playerId) {
    const sectorKey = this.playerSectors.get(playerId);
    if (sectorKey && this.loadedSectors.has(sectorKey)) {
      const sector = this.loadedSectors.get(sectorKey);
      sector.removePlayer(playerId);
    }
    this.playerSectors.delete(playerId);
  }

  /**
   * Get galaxy map data for a region around coordinates
   */
  getGalaxyMapData(centerCoords, radius = 5) {
    const mapData = [];
    
    for (let x = centerCoords.x - radius; x <= centerCoords.x + radius; x++) {
      for (let y = centerCoords.y - radius; y <= centerCoords.y + radius; y++) {
        const coords = { x, y };
        
        if (!this.isWithinGalaxyBounds(coords)) {
          continue;
        }
        
        const sectorKey = `${x}_${y}`;
        let sectorInfo = {
          coordinates: coords,
          isLoaded: this.loadedSectors.has(sectorKey),
          playerCount: 0,
          biome: null
        };
        
        if (this.loadedSectors.has(sectorKey)) {
          const sector = this.loadedSectors.get(sectorKey);
          sectorInfo.playerCount = sector.playerCount;
          sectorInfo.biome = {
            name: sector.biome.name,
            color: sector.biome.color
          };
        } else {
          // Generate basic biome info without loading full sector
          const seed = this.proceduralGen.generateSectorSeed(x, y);
          const biome = this.proceduralGen.generateSectorBiome(coords, seed);
          sectorInfo.biome = {
            name: biome.name,
            color: biome.color
          };
        }
        
        mapData.push(sectorInfo);
      }
    }
    
    return mapData;
  }

  /**
   * Calculate warp requirements between sectors
   */
  calculateWarpRequirements(fromCoords, toCoords) {
    const distance = Math.sqrt(
      (toCoords.x - fromCoords.x) ** 2 + 
      (toCoords.y - fromCoords.y) ** 2
    );
    
    // Base fuel cost and time based on distance
    const baseFuelCost = Math.ceil(distance * 50); // 50 fuel per sector distance
    const baseTravelTime = Math.ceil(distance * 10000); // 10 seconds per sector distance
    
    // Apply environmental modifiers from origin sector
    let fuelMultiplier = 1.0;
    const fromSectorKey = `${fromCoords.x}_${fromCoords.y}`;
    
    if (this.loadedSectors.has(fromSectorKey)) {
      const fromSector = this.loadedSectors.get(fromSectorKey);
      fuelMultiplier = fromSector.getWarpCostModifier();
    }
    
    return {
      fuelCost: Math.ceil(baseFuelCost * fuelMultiplier),
      travelTime: Math.ceil(baseTravelTime * fuelMultiplier),
      distance: distance
    };
  }

  /**
   * Attempt to warp player to target sector
   */
  async warpPlayer(playerId, playerData, targetCoords) {
    const currentCoords = this.getSectorCoordinatesForPosition(playerData.x, playerData.y);
    
    // Check if warp is valid
    if (targetCoords.x === currentCoords.x && targetCoords.y === currentCoords.y) {
      return { success: false, reason: 'Already in target sector' };
    }
    
    if (!this.isWithinGalaxyBounds(targetCoords)) {
      return { success: false, reason: 'Target sector is outside galaxy bounds' };
    }
    
    // Calculate warp requirements
    const warpReq = this.calculateWarpRequirements(currentCoords, targetCoords);
    
    // Check if player has required fuel (using resources as fuel)
    if (playerData.resources < warpReq.fuelCost) {
      return { 
        success: false, 
        reason: `Insufficient fuel. Need ${warpReq.fuelCost} resources, have ${playerData.resources}`,
        requirements: warpReq
      };
    }
    
    // Consume fuel
    playerData.resources -= warpReq.fuelCost;
    
    // Calculate arrival position (center of target sector for now)
    const arrivalPosition = {
      x: targetCoords.x * 2000, // Each sector is 2000 units wide
      y: targetCoords.y * 2000
    };
    
    // Move player to new sector
    const result = await this.movePlayerToSector(playerId, targetCoords, arrivalPosition);
    
    return {
      success: true,
      newSector: result.sector.getSectorData(),
      newPosition: result.position,
      fuelUsed: warpReq.fuelCost,
      travelTime: warpReq.travelTime,
      remainingResources: playerData.resources
    };
  }

  /**
   * Get sectors within warp range of a position
   */
  getWarpTargets(currentCoords, maxRange = 5) {
    const targets = [];
    
    for (let x = currentCoords.x - maxRange; x <= currentCoords.x + maxRange; x++) {
      for (let y = currentCoords.y - maxRange; y <= currentCoords.y + maxRange; y++) {
        const targetCoords = { x, y };
        
        // Skip current sector
        if (x === currentCoords.x && y === currentCoords.y) {
          continue;
        }
        
        // Check galaxy bounds
        if (!this.isWithinGalaxyBounds(targetCoords)) {
          continue;
        }
        
        const warpReq = this.calculateWarpRequirements(currentCoords, targetCoords);
        
        // Generate basic sector info
        const seed = this.proceduralGen.generateSectorSeed(x, y);
        const biome = this.proceduralGen.generateSectorBiome(targetCoords, seed);
        
        targets.push({
          coordinates: targetCoords,
          biome: {
            name: biome.name,
            description: biome.description,
            color: biome.color
          },
          warpRequirements: warpReq,
          isExplored: this.loadedSectors.has(`${x}_${y}`)
        });
      }
    }
    
    // Sort by distance
    targets.sort((a, b) => a.warpRequirements.distance - b.warpRequirements.distance);
    
    return targets;
  }

  /**
   * Handle player leaving a sector
   */
  async handlePlayerLeave(playerId) {
    const sectorKey = this.playerSectors.get(playerId);
    if (sectorKey && this.loadedSectors.has(sectorKey)) {
      const sector = this.loadedSectors.get(sectorKey);
      sector.removePlayer(playerId);
      
      // Save sector state when last player leaves
      if (sector.playerCount === 0) {
        await this.saveSectorToDatabase(sector);
      }
    }
    
    this.playerSectors.delete(playerId);
  }

  /**
   * Get current sector for a player based on their position
   */
  getCurrentSectorForPlayer(playerId, position) {
    const sectorCoords = this.getSectorCoordinatesForPosition(position.x, position.y);
    const sectorKey = `${sectorCoords.x}_${sectorCoords.y}`;
    
    // Check if player changed sectors
    const currentSectorKey = this.playerSectors.get(playerId);
    if (currentSectorKey !== sectorKey) {
      // Player moved to new sector
      return null; // Signal that sector change is needed
    }
    
    return this.loadedSectors.get(sectorKey);
  }

  /**
   * Get summary statistics for the galaxy
   */
  getGalaxyStats() {
    let totalOres = 0;
    let totalPlayers = 0;
    const biomeDistribution = {};
    
    for (const sector of this.loadedSectors.values()) {
      totalOres += sector.ores.length;
      totalPlayers += sector.playerCount;
      
      const biomeName = sector.biome.name;
      biomeDistribution[biomeName] = (biomeDistribution[biomeName] || 0) + 1;
    }
    
    return {
      loadedSectors: this.loadedSectors.size,
      totalOres,
      totalPlayers,
      biomeDistribution,
      maxLoadedSectors: this.maxLoadedSectors
    };
  }

  /**
   * Save all loaded sector data (for graceful shutdown)
   */
  async saveAllSectors() {
    const savePromises = [];
    
    for (const sector of this.loadedSectors.values()) {
      if (sector.isLoaded) {
        savePromises.push(this.saveSectorToDatabase(sector));
      }
    }
    
    await Promise.all(savePromises);
    console.log(`Saved ${savePromises.length} sectors to database`);
  }

  /**
   * Emergency sector generation (fallback for corrupted data)
   */
  async generateEmergencySector(coordinates) {
    console.warn(`Generating emergency sector for ${coordinates.x}, ${coordinates.y}`);
    
    const seed = Date.now() + coordinates.x * 1000 + coordinates.y;
    const sector = new Sector(coordinates, seed);
    await sector.load();
    
    return sector;
  }
}

module.exports = SectorManager;