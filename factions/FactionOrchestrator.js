/**
 * FactionOrchestrator.js - Central coordinator for all NPC faction systems
 * Manages faction lifecycle, inter-faction relations, and system integration
 */

const { Faction, FACTION_TYPES } = require('./Faction');
const { NPCFleet } = require('./NPCFleet');
const { v4: uuidv4 } = require('uuid');

// Default faction configurations
const DEFAULT_FACTIONS = [
  {
    id: 'military-coalition',
    name: 'Terran Military Coalition',
    type: 'MILITARY',
    homeBase: '2,2',
    initialTerritory: ['2,2', '1,2', '2,1', '3,2', '2,3'],
    config: { maxFleets: 8, aggressionThreshold: -20 }
  },
  {
    id: 'trade-federation',
    name: 'Galactic Trade Federation',
    type: 'TRADER',
    homeBase: '5,5',
    initialTerritory: ['5,5', '4,5', '5,4', '6,5', '5,6'],
    config: { maxFleets: 6, expansionThreshold: 50000 }
  },
  {
    id: 'crimson-raiders',
    name: 'Crimson Raider Clans',
    type: 'PIRATE',
    homeBase: '8,1',
    initialTerritory: ['8,1', '7,1', '8,0'],
    config: { maxFleets: 5, aggressionThreshold: -10 }
  },
  {
    id: 'research-collective',
    name: 'Scientific Research Collective',
    type: 'SCIENTIST',
    homeBase: '1,8',
    initialTerritory: ['1,8', '0,8', '1,7'],
    config: { maxFleets: 4, expansionThreshold: 30000 }
  },
  {
    id: 'independent-systems',
    name: 'Independent Systems Alliance',
    type: 'NEUTRAL',
    homeBase: '4,4',
    initialTerritory: ['4,4', '3,4', '4,3'],
    config: { maxFleets: 5 }
  }
];

class FactionOrchestrator {
  constructor(database) {
    this.database = database;
    this.factions = new Map(); // Faction ID -> Faction instance
    this.allFleets = new Map(); // Fleet ID -> Fleet instance
    this.territoryMap = new Map(); // Sector ID -> Faction ID
    
    // System configuration
    this.config = {
      updateInterval: 5000, // Update factions every 5 seconds
      maxTotalFleets: 50, // Maximum NPC fleets in the galaxy
      diplomacyUpdateInterval: 300000, // Update diplomacy every 5 minutes
      eventProcessingInterval: 60000, // Process events every minute
      performanceThreshold: 100, // ms - performance monitoring
      spatialGridSize: 2000 // Sector size for spatial partitioning
    };
    
    // System state
    this.isRunning = false;
    this.lastUpdate = Date.now();
    this.lastDiplomacyUpdate = Date.now();
    this.lastEventProcessing = Date.now();
    this.updateTimer = null;
    
    // Performance monitoring
    this.performanceStats = {
      updateCount: 0,
      averageUpdateTime: 0,
      maxUpdateTime: 0,
      activeFleets: 0,
      activeFactions: 0
    };
    
    // Event system
    this.events = new Map(); // Event ID -> Event data
    this.eventHandlers = new Map(); // Event type -> Handler function
    
    console.log('Faction Orchestrator initialized');
  }

  /**
   * Initialize the faction system
   */
  async initialize() {
    try {
      console.log('Initializing faction system...');
      
      // Load existing factions from database
      await this.loadFactionsFromDatabase();
      
      // If no factions exist, create default ones
      if (this.factions.size === 0) {
        await this.createDefaultFactions();
      }
      
      // Load existing fleets
      await this.loadFleetsFromDatabase();
      
      // Build territory map
      this.updateTerritoryMap();
      
      // Initialize event handlers
      this.setupEventHandlers();
      
      // Start the main update loop
      this.start();
      
      console.log(`Faction system initialized with ${this.factions.size} factions and ${this.allFleets.size} fleets`);
      
      return true;
      
    } catch (error) {
      console.error('Error initializing faction system:', error);
      return false;
    }
  }

  /**
   * Load factions from database
   */
  async loadFactionsFromDatabase() {
    try {
      const factionData = await this.database.all('SELECT * FROM factions');
      
      for (const data of factionData) {
        const faction = Faction.deserialize(data);
        this.factions.set(faction.id, faction);
        console.log(`Loaded faction: ${faction.name} (${faction.type})`);
      }
      
    } catch (error) {
      console.error('Error loading factions from database:', error);
      // Database might not have faction tables yet - this is OK during first run
    }
  }

  /**
   * Load fleets from database
   */
  async loadFleetsFromDatabase() {
    try {
      const fleetData = await this.database.all('SELECT * FROM npc_fleets WHERE status != ?', ['destroyed']);
      
      for (const data of fleetData) {
        const fleet = NPCFleet.deserialize(data);
        this.allFleets.set(fleet.id, fleet);
        
        // Associate with faction
        const faction = this.factions.get(fleet.factionId);
        if (faction) {
          faction.fleets.set(fleet.id, fleet);
        }
        
        console.log(`Loaded fleet: ${fleet.id} (${fleet.factionType})`);
      }
      
    } catch (error) {
      console.error('Error loading fleets from database:', error);
      // Database might not have fleet tables yet - this is OK during first run
    }
  }

  /**
   * Create default factions for new game
   */
  async createDefaultFactions() {
    console.log('Creating default factions...');
    
    for (const factionConfig of DEFAULT_FACTIONS) {
      try {
        const faction = new Faction(
          factionConfig.id,
          factionConfig.name,
          factionConfig.type,
          factionConfig.config
        );
        
        // Set home base and initial territory
        faction.homeBase = factionConfig.homeBase;
        for (const sectorId of factionConfig.initialTerritory) {
          faction.claimTerritory(sectorId);
        }
        
        // Save to database
        await this.saveFaction(faction);
        
        // Add to active factions
        this.factions.set(faction.id, faction);
        
        console.log(`Created faction: ${faction.name} with ${faction.territory.size} territories`);
        
      } catch (error) {
        console.error(`Error creating faction ${factionConfig.name}:`, error);
      }
    }
  }

  /**
   * Start the faction system update loop
   */
  start() {
    if (this.isRunning) {
      console.log('Faction system is already running');
      return;
    }
    
    this.isRunning = true;
    this.updateTimer = setInterval(() => {
      this.update();
    }, this.config.updateInterval);
    
    console.log('Faction system started');
  }

  /**
   * Stop the faction system
   */
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    console.log('Faction system stopped');
  }

  /**
   * Main update loop for all factions and systems
   */
  async update() {
    const startTime = Date.now();
    
    try {
      // Create game state snapshot for AI decisions
      const gameState = this.createGameState();
      
      // Update all factions
      for (const [factionId, faction] of this.factions.entries()) {
        try {
          faction.update(gameState);
          
          // Save faction state periodically
          if (Math.random() < 0.1) { // 10% chance per update
            await this.saveFaction(faction);
          }
          
        } catch (error) {
          console.error(`Error updating faction ${faction.name}:`, error);
        }
      }
      
      // Update territory map
      this.updateTerritoryMap();
      
      // Process inter-faction diplomacy
      const now = Date.now();
      if (now - this.lastDiplomacyUpdate > this.config.diplomacyUpdateInterval) {
        this.updateDiplomacy();
        this.lastDiplomacyUpdate = now;
      }
      
      // Process faction events
      if (now - this.lastEventProcessing > this.config.eventProcessingInterval) {
        this.processEvents();
        this.lastEventProcessing = now;
      }
      
      // Update performance statistics
      this.updatePerformanceStats(startTime);
      
      this.lastUpdate = now;
      
    } catch (error) {
      console.error('Error in faction system update:', error);
    }
  }

  /**
   * Create game state snapshot for faction AI
   */
  createGameState() {
    return {
      factions: this.factions,
      fleets: this.allFleets,
      territoryMap: this.territoryMap,
      players: global.players || {}, // Access to player data
      timestamp: Date.now()
    };
  }

  /**
   * Update territorial control map
   */
  updateTerritoryMap() {
    this.territoryMap.clear();
    
    for (const [factionId, faction] of this.factions.entries()) {
      for (const sectorId of faction.territory) {
        this.territoryMap.set(sectorId, factionId);
      }
    }
  }

  /**
   * Update inter-faction diplomacy
   */
  updateDiplomacy() {
    const factionList = Array.from(this.factions.values());
    
    for (let i = 0; i < factionList.length; i++) {
      for (let j = i + 1; j < factionList.length; j++) {
        const factionA = factionList[i];
        const factionB = factionList[j];
        
        this.updateFactionRelation(factionA, factionB);
      }
    }
  }

  /**
   * Update relationship between two factions
   */
  updateFactionRelation(factionA, factionB) {
    // Get current relationship
    let relationA = factionA.diplomacyState.get(factionB.id) || 0;
    let relationB = factionB.diplomacyState.get(factionA.id) || 0;
    
    // Calculate natural relationship based on faction types
    const naturalRelation = this.calculateNaturalRelation(factionA.type, factionB.type);
    
    // Slowly drift toward natural relationship
    const drift = 0.5;
    relationA += (naturalRelation - relationA) * drift;
    relationB += (naturalRelation - relationB) * drift;
    
    // Check for territorial conflicts
    const territorialTension = this.calculateTerritorialTension(factionA, factionB);
    relationA -= territorialTension;
    relationB -= territorialTension;
    
    // Update relationships
    factionA.diplomacyState.set(factionB.id, Math.max(-100, Math.min(100, relationA)));
    factionB.diplomacyState.set(factionA.id, Math.max(-100, Math.min(100, relationB)));
    
    // Update ally/enemy sets
    this.updateAllianceStatus(factionA, factionB, relationA);
    this.updateAllianceStatus(factionB, factionA, relationB);
  }

  /**
   * Calculate natural relationship between faction types
   */
  calculateNaturalRelation(typeA, typeB) {
    const relationMatrix = {
      MILITARY: { MILITARY: 10, TRADER: 30, PIRATE: -50, SCIENTIST: 20, NEUTRAL: 10 },
      TRADER: { MILITARY: 30, TRADER: 40, PIRATE: -30, SCIENTIST: 25, NEUTRAL: 35 },
      PIRATE: { MILITARY: -50, TRADER: -30, PIRATE: -10, SCIENTIST: -20, NEUTRAL: -25 },
      SCIENTIST: { MILITARY: 20, TRADER: 25, PIRATE: -20, SCIENTIST: 50, NEUTRAL: 30 },
      NEUTRAL: { MILITARY: 10, TRADER: 35, PIRATE: -25, SCIENTIST: 30, NEUTRAL: 20 }
    };
    
    return relationMatrix[typeA]?.[typeB] || 0;
  }

  /**
   * Calculate territorial tension between factions
   */
  calculateTerritorialTension(factionA, factionB) {
    let tension = 0;
    
    // Check for adjacent territories
    for (const sectorA of factionA.territory) {
      const [x, y] = sectorA.split(',').map(Number);
      
      // Check all adjacent sectors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const adjacentSector = `${x + dx},${y + dy}`;
          if (factionB.territory.has(adjacentSector)) {
            tension += 2; // Territorial border tension
          }
        }
      }
    }
    
    return Math.min(20, tension); // Cap at 20 points
  }

  /**
   * Update alliance status between factions
   */
  updateAllianceStatus(factionA, factionB, relation) {
    if (relation > 50) {
      // Strong positive relationship - alliance
      factionA.allies.add(factionB.id);
      factionA.enemies.delete(factionB.id);
    } else if (relation < -30) {
      // Strong negative relationship - enemies
      factionA.enemies.add(factionB.id);
      factionA.allies.delete(factionB.id);
    } else {
      // Neutral relationship
      factionA.allies.delete(factionB.id);
      factionA.enemies.delete(factionB.id);
    }
  }

  /**
   * Process faction events
   */
  processEvents() {
    const now = Date.now();
    const expiredEvents = [];
    
    for (const [eventId, event] of this.events.entries()) {
      try {
        // Check if event has expired
        if (event.expiresAt && now > event.expiresAt) {
          expiredEvents.push(eventId);
          continue;
        }
        
        // Process event based on type
        const handler = this.eventHandlers.get(event.type);
        if (handler) {
          handler(event);
        }
        
      } catch (error) {
        console.error(`Error processing event ${eventId}:`, error);
        expiredEvents.push(eventId);
      }
    }
    
    // Clean up expired events
    for (const eventId of expiredEvents) {
      this.events.delete(eventId);
    }
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.eventHandlers.set('FACTION_WAR', this.handleWarEvent.bind(this));
    this.eventHandlers.set('TRADE_AGREEMENT', this.handleTradeEvent.bind(this));
    this.eventHandlers.set('TERRITORY_DISPUTE', this.handleTerritoryEvent.bind(this));
    this.eventHandlers.set('PLAYER_REPUTATION_CHANGE', this.handleReputationEvent.bind(this));
  }

  /**
   * Player interaction methods
   */
  getPlayerReputations(playerId) {
    const reputations = {};
    
    for (const [factionId, faction] of this.factions.entries()) {
      const reputation = faction.getPlayerReputation(playerId);
      const level = faction.getReputationLevel(playerId);
      
      reputations[factionId] = {
        factionName: faction.name,
        factionType: faction.type,
        reputation: reputation,
        level: level.level,
        color: level.color
      };
    }
    
    return reputations;
  }

  modifyPlayerReputation(playerId, factionId, change, reason) {
    const faction = this.factions.get(factionId);
    if (!faction) {
      console.error(`Faction not found: ${factionId}`);
      return false;
    }
    
    const newReputation = faction.modifyPlayerReputation(playerId, change, reason);
    
    // Trigger reputation event
    this.triggerEvent({
      type: 'PLAYER_REPUTATION_CHANGE',
      playerId: playerId,
      factionId: factionId,
      change: change,
      newReputation: newReputation,
      reason: reason
    });
    
    return true;
  }

  getFactionsInSector(sectorId) {
    const factionsInSector = [];
    
    for (const [factionId, faction] of this.factions.entries()) {
      if (faction.territory.has(sectorId)) {
        factionsInSector.push({
          id: factionId,
          name: faction.name,
          type: faction.type,
          influence: 100 // Full control
        });
      }
    }
    
    // Check for fleets in the sector
    for (const fleet of this.allFleets.values()) {
      if (fleet.getCurrentSector() === sectorId) {
        const faction = this.factions.get(fleet.factionId);
        if (faction && !factionsInSector.some(f => f.id === faction.id)) {
          factionsInSector.push({
            id: faction.id,
            name: faction.name,
            type: faction.type,
            influence: 25 // Fleet presence
          });
        }
      }
    }
    
    return factionsInSector;
  }

  getFleetsInSector(sectorId) {
    const fleetsInSector = [];
    
    for (const fleet of this.allFleets.values()) {
      if (fleet.getCurrentSector() === sectorId) {
        const faction = this.factions.get(fleet.factionId);
        fleetsInSector.push({
          fleetId: fleet.id,
          factionId: fleet.factionId,
          factionName: faction?.name || 'Unknown',
          factionType: fleet.factionType,
          shipCount: fleet.ships.length,
          mission: fleet.mission.type,
          status: fleet.status,
          position: fleet.position
        });
      }
    }
    
    return fleetsInSector;
  }

  /**
   * Event system methods
   */
  triggerEvent(eventData) {
    const event = {
      id: uuidv4(),
      ...eventData,
      timestamp: Date.now(),
      expiresAt: eventData.duration ? Date.now() + eventData.duration : null
    };
    
    this.events.set(event.id, event);
    
    console.log(`Faction event triggered: ${event.type}`);
    return event.id;
  }

  /**
   * Event handlers
   */
  handleWarEvent(event) {
    // Implement war mechanics
    console.log(`Processing war event: ${event.factionA} vs ${event.factionB}`);
  }

  handleTradeEvent(event) {
    // Implement trade agreement mechanics
    console.log(`Processing trade event between factions`);
  }

  handleTerritoryEvent(event) {
    // Implement territory dispute mechanics
    console.log(`Processing territory dispute in sector ${event.sectorId}`);
  }

  handleReputationEvent(event) {
    // Implement reputation change effects
    const faction = this.factions.get(event.factionId);
    if (faction && Math.abs(event.change) > 10) {
      console.log(`Major reputation change: Player ${event.playerId} with ${faction.name}: ${event.change > 0 ? '+' : ''}${event.change}`);
    }
  }

  /**
   * Database operations
   */
  async saveFaction(faction) {
    try {
      const data = faction.serialize();
      
      await this.database.run(`
        INSERT OR REPLACE INTO factions (
          id, name, type, config, resources, territory, allies, enemies, 
          home_base, current_strategy, stats, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.id, data.name, data.type, data.config, data.resources,
        data.territory, data.allies, data.enemies, data.homeBase,
        data.currentStrategy, data.stats, data.updated_at
      ]);
      
    } catch (error) {
      console.error(`Error saving faction ${faction.name}:`, error);
    }
  }

  async saveFleet(fleet) {
    try {
      const data = fleet.serialize();
      
      await this.database.run(`
        INSERT OR REPLACE INTO npc_fleets (
          id, faction_id, name, ships, current_sector, destination,
          mission, mission_data, resources, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.id, data.faction_id, data.name, data.ships, data.current_sector,
        data.destination, data.mission, data.mission_data, data.resources,
        data.status, data.created_at, data.updated_at
      ]);
      
    } catch (error) {
      console.error(`Error saving fleet ${fleet.id}:`, error);
    }
  }

  /**
   * Performance monitoring
   */
  updatePerformanceStats(startTime) {
    const updateTime = Date.now() - startTime;
    
    this.performanceStats.updateCount++;
    this.performanceStats.averageUpdateTime = 
      (this.performanceStats.averageUpdateTime + updateTime) / 2;
    this.performanceStats.maxUpdateTime = 
      Math.max(this.performanceStats.maxUpdateTime, updateTime);
    this.performanceStats.activeFleets = this.allFleets.size;
    this.performanceStats.activeFactions = this.factions.size;
    
    // Log performance warnings
    if (updateTime > this.config.performanceThreshold) {
      console.warn(`Faction update took ${updateTime}ms (threshold: ${this.config.performanceThreshold}ms)`);
    }
  }

  /**
   * Get system statistics
   */
  getSystemStats() {
    const factionStats = {};
    
    for (const [factionId, faction] of this.factions.entries()) {
      factionStats[factionId] = {
        name: faction.name,
        type: faction.type,
        fleetCount: faction.fleets.size,
        territoryCount: faction.territory.size,
        totalResources: faction.getTotalResourceValue(),
        currentStrategy: faction.currentStrategy,
        stats: faction.stats
      };
    }
    
    return {
      factions: factionStats,
      performance: this.performanceStats,
      totalFleets: this.allFleets.size,
      activeEvents: this.events.size,
      territoryCount: this.territoryMap.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log('Shutting down faction system...');
    
    // Stop update loop
    this.stop();
    
    // Save all faction data
    for (const faction of this.factions.values()) {
      await this.saveFaction(faction);
    }
    
    // Save all fleet data
    for (const fleet of this.allFleets.values()) {
      await this.saveFleet(fleet);
    }
    
    console.log('Faction system shutdown complete');
  }
}

module.exports = {
  FactionOrchestrator,
  DEFAULT_FACTIONS
};