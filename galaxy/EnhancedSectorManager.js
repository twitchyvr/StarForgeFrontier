/**
 * EnhancedSectorManager.js - Advanced sector management with comprehensive hazard system integration
 * Extends the existing SectorManager with hazard processing and effects management
 */

const { Sector, BIOME_TYPES, ORE_TYPES } = require('./Sector');
const { HazardSystem } = require('../hazards/HazardSystem');
const { HazardGenerator } = require('../hazards/HazardGenerator');
const { HazardEffects } = require('../hazards/HazardEffects');
const { HazardSkillIntegrator } = require('../hazards/HazardSkillIntegration');

class EnhancedSectorManager {
  constructor(database, skillSystem) {
    this.db = database;
    this.skillSystem = skillSystem;
    
    // Core systems
    this.activeSectors = new Map();
    this.sectorSeeds = new Map();
    this.maxActiveSectors = 25;
    
    // Hazard system components
    this.hazardSystem = new HazardSystem(database);
    this.hazardGenerator = new HazardGenerator(this, database);
    this.hazardEffects = new HazardEffects();
    this.hazardSkillIntegrator = new HazardSkillIntegrator(skillSystem, this.hazardEffects, database);
    
    // Player tracking for hazard processing
    this.playerSectors = new Map(); // playerId -> {sectorX, sectorY, position}
    this.playerHazardEffects = new Map(); // playerId -> active effects
    this.lastHazardUpdate = Date.now();
    this.hazardUpdateInterval = 5000; // 5 seconds
    
    // Performance monitoring
    this.stats = {
      sectorsLoaded: 0,
      sectorsUnloaded: 0,
      hazardsGenerated: 0,
      hazardEffectsProcessed: 0,
      playersInHazards: 0
    };
  }

  /**
   * Initialize the enhanced sector manager
   */
  async initialize() {
    console.log('Initializing Enhanced Sector Manager with Hazard System...');
    
    // Initialize all hazard system components
    await this.hazardSystem.initialize();
    await this.hazardSkillIntegrator.initialize();
    
    // Start hazard processing loop
    this.startHazardProcessingLoop();
    
    console.log('Enhanced Sector Manager initialized successfully');
  }

  /**
   * Get or load a sector with enhanced hazard generation
   */
  async getSector(sectorX, sectorY) {
    const sectorKey = `${sectorX}_${sectorY}`;
    
    if (this.activeSectors.has(sectorKey)) {
      return this.activeSectors.get(sectorKey);
    }

    // Check if we need to unload sectors first
    await this.manageMemoryLimits();

    // Create or load sector
    const sector = await this.loadSectorEnhanced(sectorX, sectorY);
    this.activeSectors.set(sectorKey, sector);
    this.stats.sectorsLoaded++;

    return sector;
  }

  /**
   * Load sector with enhanced hazard generation
   */
  async loadSectorEnhanced(sectorX, sectorY) {
    // Check if sector exists in database
    let sectorData = await this.db.getSectorData(sectorX, sectorY);
    let sector;

    if (sectorData) {
      // Load existing sector
      sector = this.createSectorFromData(sectorData);
    } else {
      // Create new sector
      sector = this.createNewSector(sectorX, sectorY);
      
      // Save new sector to database
      await this.db.saveSectorData({
        sector_x: sectorX,
        sector_y: sectorY,
        seed: sector.seed,
        biome_type: sector.biome.name,
        biome_data: JSON.stringify(sector.biome),
        last_updated: Date.now(),
        player_count: 0,
        is_discovered: 0
      });
    }

    // Load and apply enhanced hazard system
    await this.loadSectorHazards(sector);
    
    // Load existing hazard generation pattern or create new one
    await this.loadHazardGenerationPattern(sector);

    console.log(`Enhanced sector ${sectorX},${sectorY} loaded with ${sector.environmentalHazards.length} hazards`);
    return sector;
  }

  /**
   * Create new sector with enhanced generation
   */
  createNewSector(sectorX, sectorY) {
    const seed = this.generateSectorSeed(sectorX, sectorY);
    const sector = new Sector({x: sectorX, y: sectorY}, seed);
    
    // Enhanced sector loading
    sector.load();
    
    return sector;
  }

  /**
   * Create sector from database data
   */
  createSectorFromData(sectorData) {
    const coordinates = {x: sectorData.sector_x, y: sectorData.sector_y};
    const biomeData = JSON.parse(sectorData.biome_data || '{}');
    
    // Find biome type
    const biomeType = Object.values(BIOME_TYPES).find(b => b.name === sectorData.biome_type);
    const sector = new Sector(coordinates, sectorData.seed, biomeType);
    
    // Load sector data
    sector.load();
    sector.playerCount = sectorData.player_count;
    sector.lastUpdated = sectorData.last_updated;

    return sector;
  }

  /**
   * Load hazards for sector from database and hazard system
   */
  async loadSectorHazards(sector) {
    const sectorX = sector.coordinates.x;
    const sectorY = sector.coordinates.y;
    
    // Load existing hazards from database
    const existingHazards = await this.db.getSectorHazards(sectorX, sectorY);
    
    if (existingHazards.length > 0) {
      // Convert database hazards to sector format
      sector.environmentalHazards = existingHazards.map(hazard => ({
        id: hazard.id,
        type: hazard.type,
        x: hazard.x,
        y: hazard.y,
        properties: hazard.properties,
        magnitude: hazard.properties.magnitude || 1.0,
        createdAt: new Date(hazard.createdAt).getTime(),
        expiresAt: hazard.expiresAt ? new Date(hazard.expiresAt).getTime() : null,
        isActive: true
      }));
    } else {
      // Generate new hazards using the comprehensive system
      sector.environmentalHazards = this.hazardGenerator.generateSectorHazards(sector);
      this.stats.hazardsGenerated += sector.environmentalHazards.length;
      
      // Save generated hazards to database
      for (const hazard of sector.environmentalHazards) {
        await this.db.saveSectorHazard({
          id: hazard.id,
          sector_x: sectorX,
          sector_y: sectorY,
          hazard_type: hazard.type,
          x: hazard.x,
          y: hazard.y,
          properties: hazard.properties,
          expires_at: hazard.expiresAt
        });
      }
    }
    
    // Add hazards to hazard system for processing
    for (const hazard of sector.environmentalHazards) {
      this.hazardSystem.activeHazards.set(`${sectorX}_${sectorY}`, sector.environmentalHazards);
    }
  }

  /**
   * Load or create hazard generation pattern for sector
   */
  async loadHazardGenerationPattern(sector) {
    const sectorX = sector.coordinates.x;
    const sectorY = sector.coordinates.y;
    
    let pattern = await this.db.getSectorHazardPattern(sectorX, sectorY);
    
    if (!pattern) {
      // Create new pattern
      pattern = {
        sector_x: sectorX,
        sector_y: sectorY,
        biome_type: sector.biome.name,
        generation_seed: sector.seed,
        last_generated: Date.now(),
        hazard_count: sector.environmentalHazards.length,
        generation_method: 'enhanced_procedural',
        pattern_data: {
          biomeRules: sector.biome.name,
          placementPattern: 'intelligent',
          specialRules: []
        },
        special_rules: []
      };
      
      await this.db.saveSectorHazardPattern(pattern);
    }
    
    sector.hazardPattern = pattern;
  }

  /**
   * Update player position and process hazard effects
   */
  async updatePlayerPosition(playerId, sectorX, sectorY, x, y) {
    const playerData = {
      sectorX: sectorX,
      sectorY: sectorY,
      position: { x: x, y: y },
      lastUpdate: Date.now()
    };
    
    this.playerSectors.set(playerId, playerData);
    
    // Process hazard effects for this player
    await this.processPlayerHazardEffects(playerId, playerData);
  }

  /**
   * Process hazard effects for a specific player
   */
  async processPlayerHazardEffects(playerId, playerData) {
    const sector = await this.getSector(playerData.sectorX, playerData.sectorY);
    if (!sector) return;

    const playerPosition = playerData.position;
    const deltaTime = Date.now() - (playerData.lastUpdate || Date.now());

    // Calculate hazard effects from hazard system
    const hazardEffects = this.hazardSystem.processPlayerHazardEffects(
      playerId, 
      playerPosition, 
      { x: playerData.sectorX, y: playerData.sectorY }
    );

    // Apply skill-based resistance
    const resistance = await this.hazardSkillIntegrator.calculateHazardResistance(playerId);
    
    // Process effects through HazardEffects system
    const effectResults = this.hazardEffects.processHazardEffects(
      playerId,
      hazardEffects,
      playerPosition,
      deltaTime
    );

    // Apply resistance bonuses
    this.applyResistanceBonuses(effectResults, resistance);

    // Store results for client updates
    this.playerHazardEffects.set(playerId, {
      effects: effectResults,
      updatedAt: Date.now()
    });

    // Update database with exposure tracking
    await this.trackHazardExposure(playerId, hazardEffects, deltaTime);

    this.stats.hazardEffectsProcessed++;
  }

  /**
   * Apply resistance bonuses to hazard effects
   */
  applyResistanceBonuses(effectResults, resistance) {
    // Reduce damage based on resistance
    Object.entries(effectResults.systemDamage).forEach(([system, damage]) => {
      const avgResistance = Object.values(resistance).reduce(
        (sum, res) => sum + res.damageReduction, 0
      ) / Object.keys(resistance).length;
      
      effectResults.systemDamage[system] = damage * (1 - Math.min(0.8, avgResistance));
    });

    // Modify movement based on resistance
    const navResistance = Object.values(resistance).reduce(
      (sum, res) => sum + res.recoveryBonus, 0
    ) / Object.keys(resistance).length;
    
    effectResults.movementModifier *= (1 + Math.min(0.5, navResistance));
  }

  /**
   * Track hazard exposure for skill progression
   */
  async trackHazardExposure(playerId, hazardEffects, deltaTime) {
    for (const hazardEffect of hazardEffects) {
      // Check if this is a new exposure or continuation
      const exposureHistory = this.hazardEffects.exposureHistory.get(playerId);
      const existingExposure = exposureHistory?.get(hazardEffect.hazardId);

      if (!existingExposure) {
        // Start new exposure tracking
        const exposureId = `${playerId}_${hazardEffect.hazardId}_${Date.now()}`;
        
        await this.db.recordHazardExposure({
          id: exposureId,
          player_id: playerId,
          hazard_id: hazardEffect.hazardId,
          hazard_type: hazardEffect.type,
          sector_x: this.playerSectors.get(playerId).sectorX,
          sector_y: this.playerSectors.get(playerId).sectorY,
          exposure_start: Date.now(),
          max_intensity: hazardEffect.magnitude,
          countermeasures_active: this.hazardEffects.countermeasures.get(playerId) || []
        });
      } else {
        // Update existing exposure
        await this.db.updateHazardExposure(existingExposure.id, {
          total_exposure_time: existingExposure.total_exposure_time + deltaTime,
          max_intensity: Math.max(existingExposure.max_intensity, hazardEffect.magnitude)
        });
      }

      // Award skill experience based on exposure
      if (deltaTime > 1000) { // Only award XP for exposures longer than 1 second
        await this.hazardSkillIntegrator.awardHazardExperience(
          playerId,
          hazardEffect.type,
          deltaTime,
          effectResults.healthEffects?.damage || 0
        );
      }
    }
  }

  /**
   * Start the hazard processing loop
   */
  startHazardProcessingLoop() {
    setInterval(async () => {
      await this.processAllHazards();
    }, this.hazardUpdateInterval);
    
    console.log(`Hazard processing loop started (${this.hazardUpdateInterval}ms interval)`);
  }

  /**
   * Process hazards for all active sectors and players
   */
  async processAllHazards() {
    const now = Date.now();
    const deltaTime = now - this.lastHazardUpdate;
    
    // Update hazard system
    this.hazardSystem.updateHazards();
    
    // Process dynamic events
    await this.processActiveDynamicEvents();
    
    // Process hazards for all players
    const playersInHazards = [];
    for (const [playerId, playerData] of this.playerSectors.entries()) {
      if (now - playerData.lastUpdate < 30000) { // Only process active players (last 30 seconds)
        await this.processPlayerHazardEffects(playerId, playerData);
        playersInHazards.push(playerId);
      }
    }
    
    this.stats.playersInHazards = playersInHazards.length;
    this.lastHazardUpdate = now;
  }

  /**
   * Process active dynamic hazard events
   */
  async processActiveDynamicEvents() {
    const activeEvents = await this.db.getActiveDynamicEvents();
    
    for (const event of activeEvents) {
      if (Date.now() > event.expires_at) {
        // Expire the event
        await this.db.expireDynamicEvent(event.id);
        
        // Clean up associated hazards
        await this.cleanupEventHazards(event);
      } else {
        // Process ongoing event effects
        await this.processEventEffects(event);
      }
    }
  }

  /**
   * Clean up hazards associated with an expired event
   */
  async cleanupEventHazards(event) {
    // Remove event-specific hazards from affected sectors
    for (const affectedSector of event.affected_sectors) {
      const sectorKey = `${affectedSector.x}_${affectedSector.y}`;
      const sector = this.activeSectors.get(sectorKey);
      
      if (sector) {
        sector.environmentalHazards = sector.environmentalHazards.filter(
          hazard => hazard.properties?.dynamicEvent !== event.id
        );
      }
    }
  }

  /**
   * Process ongoing dynamic event effects
   */
  async processEventEffects(event) {
    // Update event intensity based on time remaining
    const timeRemaining = event.expires_at - Date.now();
    const totalDuration = event.expires_at - event.created_at;
    const timeProgress = 1 - (timeRemaining / totalDuration);
    
    // Some events might intensify over time, others might fade
    let currentIntensity = event.intensity;
    
    switch (event.event_type) {
      case 'solar_storm':
        // Solar storms peak in the middle
        currentIntensity = event.intensity * (1 - Math.pow(timeProgress - 0.5, 2) * 4);
        break;
      case 'void_storm':
        // Void storms build up gradually
        currentIntensity = event.intensity * Math.min(1, timeProgress * 1.5);
        break;
      case 'gravitational_cascade':
        // Gravitational cascades intensify exponentially
        currentIntensity = event.intensity * (1 + timeProgress * 2);
        break;
    }
    
    // Apply intensity changes to affected sectors
    for (const affectedSector of event.affected_sectors) {
      await this.updateEventHazardIntensity(
        affectedSector.x,
        affectedSector.y,
        event.id,
        currentIntensity * affectedSector.intensity
      );
    }
  }

  /**
   * Update hazard intensity for event-based hazards
   */
  async updateEventHazardIntensity(sectorX, sectorY, eventId, newIntensity) {
    const sectorKey = `${sectorX}_${sectorY}`;
    const sector = this.activeSectors.get(sectorKey);
    
    if (sector) {
      sector.environmentalHazards.forEach(hazard => {
        if (hazard.properties?.dynamicEvent === eventId) {
          hazard.magnitude = Math.max(0.1, Math.min(2.0, newIntensity));
        }
      });
    }
  }

  /**
   * Trigger a dynamic hazard event
   */
  async triggerDynamicEvent(eventType, centerSectorX, centerSectorY, intensity = 1.0) {
    console.log(`Triggering dynamic hazard event: ${eventType} at sector ${centerSectorX},${centerSectorY}`);
    
    const eventData = await this.hazardGenerator.triggerDynamicEvent(
      eventType,
      { x: centerSectorX, y: centerSectorY },
      intensity
    );
    
    return eventData;
  }

  /**
   * Get player hazard status
   */
  getPlayerHazardStatus(playerId) {
    const hazardEffects = this.playerHazardEffects.get(playerId);
    const systemHealth = this.hazardEffects.getSystemHealth(playerId);
    const countermeasures = this.hazardEffects.countermeasures.get(playerId) || [];
    const warnings = this.hazardEffects.getWarningMessages(playerId);

    return {
      activeEffects: hazardEffects?.effects || null,
      systemHealth: systemHealth,
      countermeasures: countermeasures,
      warnings: warnings,
      lastUpdate: hazardEffects?.updatedAt || null
    };
  }

  /**
   * Add countermeasure to player
   */
  async addPlayerCountermeasure(playerId, countermeasureId) {
    // Check skill requirements
    const canUse = await this.hazardSkillIntegrator.canPlayerUseCountermeasure(playerId, countermeasureId);
    if (!canUse) {
      throw new Error(`Player does not meet skill requirements for countermeasure: ${countermeasureId}`);
    }

    // Add to hazard effects system
    this.hazardEffects.addCountermeasure(playerId, countermeasureId);
    
    // Save to database
    await this.db.addPlayerCountermeasure(playerId, countermeasureId);
    
    console.log(`Added countermeasure ${countermeasureId} to player ${playerId}`);
  }

  /**
   * Manage memory limits by unloading inactive sectors
   */
  async manageMemoryLimits() {
    if (this.activeSectors.size >= this.maxActiveSectors) {
      const sectorsToUnload = [];
      
      for (const [sectorKey, sector] of this.activeSectors.entries()) {
        if (sector.playerCount === 0) {
          sectorsToUnload.push(sectorKey);
        }
      }
      
      // Sort by last updated (oldest first)
      sectorsToUnload.sort((a, b) => {
        const sectorA = this.activeSectors.get(a);
        const sectorB = this.activeSectors.get(b);
        return sectorA.lastUpdated - sectorB.lastUpdated;
      });
      
      // Unload oldest sectors
      const toUnload = sectorsToUnload.slice(0, Math.ceil(this.maxActiveSectors * 0.2));
      for (const sectorKey of toUnload) {
        await this.unloadSector(sectorKey);
      }
    }
  }

  /**
   * Unload a sector and clean up resources
   */
  async unloadSector(sectorKey) {
    const sector = this.activeSectors.get(sectorKey);
    if (!sector) return;

    // Clean up hazard system references
    this.hazardSystem.activeHazards.delete(sectorKey);
    
    // Unload sector data
    sector.unload();
    this.activeSectors.delete(sectorKey);
    this.stats.sectorsUnloaded++;
    
    console.log(`Unloaded sector: ${sectorKey}`);
  }

  /**
   * Generate consistent seed for sector
   */
  generateSectorSeed(x, y) {
    let existingSeed = this.sectorSeeds.get(`${x}_${y}`);
    if (existingSeed) return existingSeed;
    
    // Generate deterministic seed based on coordinates
    const seed = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123) % 1000000;
    this.sectorSeeds.set(`${x}_${y}`, Math.floor(seed));
    
    return Math.floor(seed);
  }

  /**
   * Get enhanced sector manager statistics
   */
  getStats() {
    const hazardSystemStats = this.hazardSystem.getHazardStatistics();
    const hazardEffectsStats = this.hazardEffects.getEffectStatistics();
    
    return {
      sectors: {
        active: this.activeSectors.size,
        loaded: this.stats.sectorsLoaded,
        unloaded: this.stats.sectorsUnloaded
      },
      hazards: {
        ...hazardSystemStats,
        generated: this.stats.hazardsGenerated,
        effectsProcessed: this.stats.hazardEffectsProcessed
      },
      players: {
        tracked: this.playerSectors.size,
        inHazards: this.stats.playersInHazards,
        activeEffects: hazardEffectsStats.activePlayers
      },
      performance: {
        lastUpdate: this.lastHazardUpdate,
        updateInterval: this.hazardUpdateInterval
      }
    };
  }

  /**
   * Clean shutdown
   */
  async shutdown() {
    console.log('Shutting down Enhanced Sector Manager...');
    
    // Save all active sector data
    for (const [sectorKey, sector] of this.activeSectors.entries()) {
      await this.saveSectorState(sector);
    }
    
    console.log('Enhanced Sector Manager shutdown complete');
  }

  /**
   * Save sector state to database
   */
  async saveSectorState(sector) {
    const sectorX = sector.coordinates.x;
    const sectorY = sector.coordinates.y;
    
    // Update sector metadata
    await this.db.updateSectorPlayerCount(sectorX, sectorY, sector.playerCount);
    
    // Save any new or modified hazards
    for (const hazard of sector.environmentalHazards) {
      if (hazard.isModified) {
        await this.db.saveSectorHazard({
          id: hazard.id,
          sector_x: sectorX,
          sector_y: sectorY,
          hazard_type: hazard.type,
          x: hazard.x,
          y: hazard.y,
          properties: hazard.properties,
          expires_at: hazard.expiresAt
        });
      }
    }
  }
}

module.exports = EnhancedSectorManager;