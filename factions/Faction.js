/**
 * Faction.js - Core faction class for StarForgeFrontier NPC factions
 * Manages faction properties, fleets, territory, and AI behavior
 */

const { v4: uuidv4 } = require('uuid');

// Faction types with their behavioral characteristics
const FACTION_TYPES = {
  MILITARY: {
    name: 'Military Coalition',
    description: 'Disciplined forces focused on territorial control and security',
    aggressiveness: 0.7,
    expansiveness: 0.8,
    economicFocus: 0.3,
    diplomaticTendency: 0.4,
    patrolFrequency: 0.9,
    fleetSizePreference: 'large',
    primaryColor: '#8B0000',
    secondaryColor: '#FF4500'
  },
  TRADER: {
    name: 'Trade Federation',
    description: 'Commercial enterprises focused on profitable trade routes',
    aggressiveness: 0.2,
    expansiveness: 0.4,
    economicFocus: 0.9,
    diplomaticTendency: 0.8,
    patrolFrequency: 0.3,
    fleetSizePreference: 'medium',
    primaryColor: '#228B22',
    secondaryColor: '#32CD32'
  },
  PIRATE: {
    name: 'Raider Clans',
    description: 'Opportunistic raiders seeking easy targets and quick profits',
    aggressiveness: 0.9,
    expansiveness: 0.3,
    economicFocus: 0.6,
    diplomaticTendency: 0.1,
    patrolFrequency: 0.6,
    fleetSizePreference: 'small',
    primaryColor: '#8B008B',
    secondaryColor: '#FF1493'
  },
  SCIENTIST: {
    name: 'Research Collective',
    description: 'Scientific organizations pursuing knowledge and exploration',
    aggressiveness: 0.1,
    expansiveness: 0.6,
    economicFocus: 0.5,
    diplomaticTendency: 0.7,
    patrolFrequency: 0.4,
    fleetSizePreference: 'small',
    primaryColor: '#4169E1',
    secondaryColor: '#87CEEB'
  },
  NEUTRAL: {
    name: 'Independent Systems',
    description: 'Balanced factions focused on self-defense and stability',
    aggressiveness: 0.4,
    expansiveness: 0.3,
    economicFocus: 0.6,
    diplomaticTendency: 0.6,
    patrolFrequency: 0.5,
    fleetSizePreference: 'medium',
    primaryColor: '#696969',
    secondaryColor: '#A9A9A9'
  }
};

// Reputation levels and their effects
const REPUTATION_LEVELS = {
  HOSTILE: { min: -100, max: -51, name: 'Hostile', color: '#FF0000' },
  UNFRIENDLY: { min: -50, max: -11, name: 'Unfriendly', color: '#FF8C00' },
  NEUTRAL: { min: -10, max: 10, name: 'Neutral', color: '#FFFF00' },
  FRIENDLY: { min: 11, max: 50, name: 'Friendly', color: '#90EE90' },
  ALLIED: { min: 51, max: 100, name: 'Allied', color: '#00FF00' }
};

class Faction {
  constructor(id, name, type, config = {}) {
    this.id = id || uuidv4();
    this.name = name;
    this.type = type;
    this.typeConfig = FACTION_TYPES[type];
    
    // Core faction properties
    this.config = {
      maxFleets: config.maxFleets || this.getDefaultMaxFleets(),
      fleetSpawnRate: config.fleetSpawnRate || 300000, // 5 minutes
      territoryRadius: config.territoryRadius || 3,
      resourceGenerationRate: config.resourceGenerationRate || 60000, // 1 minute
      aggressionThreshold: config.aggressionThreshold || -30,
      expansionThreshold: config.expansionThreshold || 100000, // resources needed
      ...config
    };
    
    // Faction state
    this.resources = new Map([
      ['credits', 10000],
      ['iron', 500],
      ['titanium', 200],
      ['quantum', 50]
    ]);
    
    this.fleets = new Map(); // Fleet ID -> Fleet instance
    this.territory = new Set(); // Controlled sector IDs
    this.homeBase = null; // Primary base sector
    
    // Diplomatic relations
    this.allies = new Set();
    this.enemies = new Set();
    this.diplomacyState = new Map(); // Faction ID -> relation value (-100 to 100)
    this.playerReputation = new Map(); // Player ID -> reputation value
    
    // AI state
    this.lastUpdate = Date.now();
    this.lastFleetSpawn = Date.now();
    this.lastExpansionAttempt = Date.now();
    this.currentStrategy = this.determineStrategy();
    this.activeEvents = new Map(); // Event ID -> event data
    
    // Statistics
    this.stats = {
      fleetsCreated: 0,
      fleetsDestroyed: 0,
      battlesWon: 0,
      battlesLost: 0,
      territoryClaimed: 0,
      territoryLost: 0,
      tradeVolume: 0,
      resourcesEarned: 0
    };
    
    console.log(`Faction created: ${this.name} (${this.type}) with ${this.config.maxFleets} max fleets`);
  }

  /**
   * Get default maximum fleet count based on faction type
   */
  getDefaultMaxFleets() {
    const fleetSizes = {
      small: 3,
      medium: 5,
      large: 8
    };
    
    return fleetSizes[this.typeConfig.fleetSizePreference] || 5;
  }

  /**
   * Update faction state and AI decisions
   */
  update(gameState) {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;
    
    try {
      // Generate resources based on territory and faction type
      this.generateResources(deltaTime);
      
      // Update fleet states
      this.updateFleets(gameState);
      
      // Make strategic decisions
      this.makeStrategicDecisions(gameState);
      
      // Update diplomatic relations
      this.updateDiplomacy(gameState);
      
      // Handle active events
      this.processActiveEvents(gameState);
      
      this.lastUpdate = now;
      
    } catch (error) {
      console.error(`Error updating faction ${this.name}:`, error);
    }
  }

  /**
   * Generate resources based on territory and faction characteristics
   */
  generateResources(deltaTime) {
    const resourcesPerSecond = this.territory.size * (this.typeConfig.economicFocus * 0.1);
    const resourceGain = (resourcesPerSecond * deltaTime) / 1000;
    
    if (resourceGain > 0) {
      // Distribute resources based on faction type
      const credits = resourceGain * 0.6;
      const materials = resourceGain * 0.4;
      
      this.modifyResource('credits', credits);
      this.modifyResource('iron', materials * 0.5);
      this.modifyResource('titanium', materials * 0.3);
      this.modifyResource('quantum', materials * 0.2);
      
      this.stats.resourcesEarned += resourceGain;
    }
  }

  /**
   * Update all faction fleets
   */
  updateFleets(gameState) {
    for (const [fleetId, fleet] of this.fleets.entries()) {
      try {
        fleet.update(gameState, this);
        
        // Remove destroyed fleets
        if (fleet.status === 'destroyed') {
          this.fleets.delete(fleetId);
          this.stats.fleetsDestroyed++;
          console.log(`Faction ${this.name}: Fleet ${fleetId} destroyed`);
        }
      } catch (error) {
        console.error(`Error updating fleet ${fleetId}:`, error);
      }
    }
  }

  /**
   * Make high-level strategic decisions
   */
  makeStrategicDecisions(gameState) {
    const now = Date.now();
    
    // Spawn new fleets if needed and resources allow
    if (now - this.lastFleetSpawn > this.config.fleetSpawnRate) {
      this.considerFleetSpawning(gameState);
      this.lastFleetSpawn = now;
    }
    
    // Consider territorial expansion
    if (now - this.lastExpansionAttempt > 600000) { // Every 10 minutes
      this.considerExpansion(gameState);
      this.lastExpansionAttempt = now;
    }
    
    // Update strategy based on current situation
    this.currentStrategy = this.determineStrategy();
  }

  /**
   * Consider spawning new fleets
   */
  considerFleetSpawning(gameState) {
    if (this.fleets.size >= this.config.maxFleets) {
      return; // Already at fleet capacity
    }
    
    const fleetCost = this.calculateFleetCost();
    if (this.getResource('credits') < fleetCost) {
      return; // Not enough resources
    }
    
    // Determine fleet mission based on faction type and current situation
    const mission = this.determineBestFleetMission(gameState);
    if (!mission) {
      return; // No suitable mission available
    }
    
    // Create and deploy fleet
    const fleet = this.createFleet(mission, gameState);
    if (fleet) {
      this.modifyResource('credits', -fleetCost);
      this.stats.fleetsCreated++;
      console.log(`Faction ${this.name}: Created new ${mission.type} fleet`);
    }
  }

  /**
   * Create a new fleet with specified mission
   */
  createFleet(mission, gameState) {
    const { NPCFleet } = require('./NPCFleet');
    
    const fleetConfig = {
      factionId: this.id,
      factionType: this.type,
      mission: mission,
      spawnSector: this.homeBase || this.getRandomControlledSector(),
      shipCount: this.determineFleetSize(mission),
      equipmentLevel: this.determineEquipmentLevel()
    };
    
    const fleet = new NPCFleet(uuidv4(), fleetConfig);
    this.fleets.set(fleet.id, fleet);
    
    return fleet;
  }

  /**
   * Determine best mission for new fleet
   */
  determineBestFleetMission(gameState) {
    const missionPriorities = this.calculateMissionPriorities(gameState);
    
    // Select highest priority mission
    const sortedMissions = Object.entries(missionPriorities)
      .sort((a, b) => b[1] - a[1])
      .filter(([mission, priority]) => priority > 0);
    
    if (sortedMissions.length === 0) {
      return null;
    }
    
    const [missionType, priority] = sortedMissions[0];
    return {
      type: missionType,
      priority: priority,
      parameters: this.getMissionParameters(missionType, gameState)
    };
  }

  /**
   * Calculate mission priorities based on faction type and situation
   */
  calculateMissionPriorities(gameState) {
    const priorities = {
      PATROL: this.typeConfig.patrolFrequency * 50,
      TRADE: this.typeConfig.economicFocus * 40,
      EXPLORE: this.typeConfig.expansiveness * 30,
      ATTACK: 0,
      DEFEND: 0
    };
    
    // Adjust based on current threats
    const threatLevel = this.assessThreatLevel(gameState);
    if (threatLevel > 0.5) {
      priorities.DEFEND += threatLevel * 60;
      priorities.PATROL += threatLevel * 30;
    }
    
    // Adjust based on reputation with players
    const averagePlayerReputation = this.getAveragePlayerReputation();
    if (averagePlayerReputation < -20) {
      priorities.ATTACK += Math.abs(averagePlayerReputation) * this.typeConfig.aggressiveness;
    }
    
    return priorities;
  }

  /**
   * Get mission parameters for specific mission type
   */
  getMissionParameters(missionType, gameState) {
    switch (missionType) {
      case 'PATROL':
        return {
          targetSectors: Array.from(this.territory),
          duration: 1800000 // 30 minutes
        };
      
      case 'TRADE':
        return {
          origin: this.homeBase,
          destination: this.findBestTradeDestination(gameState),
          cargoType: this.selectTradeGood(),
          duration: 3600000 // 1 hour
        };
      
      case 'EXPLORE':
        return {
          targetSector: this.findExplorationTarget(gameState),
          maxDistance: 5,
          duration: 2400000 // 40 minutes
        };
      
      default:
        return {};
    }
  }

  /**
   * Assess threat level in faction territory
   */
  assessThreatLevel(gameState) {
    let threatLevel = 0;
    
    // Check for hostile players in territory
    for (const player of Object.values(gameState.players)) {
      const playerSector = this.getPlayerSector(player);
      if (this.territory.has(playerSector)) {
        const reputation = this.getPlayerReputation(player.id);
        if (reputation < -20) {
          threatLevel += 0.3;
        }
      }
    }
    
    // Check for enemy faction fleets
    // This would be implemented with full faction system
    
    return Math.min(1.0, threatLevel);
  }

  /**
   * Consider territorial expansion
   */
  considerExpansion(gameState) {
    if (this.getResource('credits') < this.config.expansionThreshold) {
      return; // Not enough resources for expansion
    }
    
    const expansionTargets = this.findExpansionTargets(gameState);
    if (expansionTargets.length === 0) {
      return; // No suitable expansion targets
    }
    
    // Select best expansion target
    const target = expansionTargets[0];
    
    // Create expansion fleet
    const mission = {
      type: 'EXPAND',
      priority: 80,
      parameters: {
        targetSector: target.sectorId,
        requiredForce: target.difficulty
      }
    };
    
    const fleet = this.createFleet(mission, gameState);
    if (fleet) {
      console.log(`Faction ${this.name}: Expanding to sector ${target.sectorId}`);
    }
  }

  /**
   * Find suitable sectors for expansion
   */
  findExpansionTargets(gameState) {
    const targets = [];
    const maxDistance = this.config.territoryRadius;
    
    // Check sectors adjacent to current territory
    for (const controlledSector of this.territory) {
      const [x, y] = controlledSector.split(',').map(Number);
      
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          
          const targetSector = `${x + dx},${y + dy}`;
          if (this.territory.has(targetSector)) continue;
          
          const difficulty = this.assessExpansionDifficulty(targetSector, gameState);
          if (difficulty < this.typeConfig.aggressiveness * 100) {
            targets.push({
              sectorId: targetSector,
              difficulty: difficulty,
              priority: this.calculateExpansionPriority(targetSector, gameState)
            });
          }
        }
      }
    }
    
    return targets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Player reputation management
   */
  getPlayerReputation(playerId) {
    return this.playerReputation.get(playerId) || 0;
  }

  modifyPlayerReputation(playerId, change, reason = '') {
    const currentRep = this.getPlayerReputation(playerId);
    const newRep = Math.max(-100, Math.min(100, currentRep + change));
    
    this.playerReputation.set(playerId, newRep);
    
    console.log(`Faction ${this.name}: Player ${playerId} reputation changed by ${change} (${reason}). New: ${newRep}`);
    
    // Trigger reputation events if crossing thresholds
    this.checkReputationThresholds(playerId, currentRep, newRep);
    
    return newRep;
  }

  getReputationLevel(playerId) {
    const reputation = this.getPlayerReputation(playerId);
    
    for (const [level, config] of Object.entries(REPUTATION_LEVELS)) {
      if (reputation >= config.min && reputation <= config.max) {
        return { level, ...config };
      }
    }
    
    return REPUTATION_LEVELS.NEUTRAL;
  }

  checkReputationThresholds(playerId, oldRep, newRep) {
    const oldLevel = this.getReputationLevelFromValue(oldRep);
    const newLevel = this.getReputationLevelFromValue(newRep);
    
    if (oldLevel !== newLevel) {
      this.triggerReputationEvent(playerId, oldLevel, newLevel);
    }
  }

  getReputationLevelFromValue(reputation) {
    for (const [level, config] of Object.entries(REPUTATION_LEVELS)) {
      if (reputation >= config.min && reputation <= config.max) {
        return level;
      }
    }
    return 'NEUTRAL';
  }

  /**
   * Resource management
   */
  getResource(type) {
    return this.resources.get(type) || 0;
  }

  modifyResource(type, amount) {
    const current = this.getResource(type);
    const newAmount = Math.max(0, current + amount);
    this.resources.set(type, newAmount);
    return newAmount;
  }

  hasResources(requirements) {
    for (const [type, amount] of Object.entries(requirements)) {
      if (this.getResource(type) < amount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Territory management
   */
  claimTerritory(sectorId) {
    if (!this.territory.has(sectorId)) {
      this.territory.add(sectorId);
      this.stats.territoryClaimed++;
      console.log(`Faction ${this.name}: Claimed territory ${sectorId}`);
      return true;
    }
    return false;
  }

  loseTerritory(sectorId) {
    if (this.territory.has(sectorId)) {
      this.territory.delete(sectorId);
      this.stats.territoryLost++;
      console.log(`Faction ${this.name}: Lost territory ${sectorId}`);
      return true;
    }
    return false;
  }

  /**
   * Utility methods
   */
  determineStrategy() {
    const resourceLevel = this.getTotalResourceValue();
    const threatLevel = this.getAveragePlayerReputation() < -30 ? 'HIGH' : 'LOW';
    const territorySize = this.territory.size;
    
    if (territorySize < 3) {
      return 'EXPANSION';
    } else if (threatLevel === 'HIGH') {
      return 'DEFENSIVE';
    } else if (this.typeConfig.economicFocus > 0.7) {
      return 'ECONOMIC';
    } else {
      return 'BALANCED';
    }
  }

  getTotalResourceValue() {
    let total = 0;
    for (const [type, amount] of this.resources.entries()) {
      total += amount * this.getResourceValue(type);
    }
    return total;
  }

  getResourceValue(type) {
    const values = { credits: 1, iron: 2, titanium: 5, quantum: 15 };
    return values[type] || 1;
  }

  calculateFleetCost() {
    return Math.floor(1000 + (this.fleets.size * 500));
  }

  determineFleetSize(mission) {
    const baseSizes = { small: 1, medium: 2, large: 3 };
    const baseSize = baseSizes[this.typeConfig.fleetSizePreference];
    
    // Adjust based on mission type
    const missionMultipliers = {
      PATROL: 0.8,
      TRADE: 0.6,
      EXPLORE: 0.7,
      ATTACK: 1.2,
      DEFEND: 1.0,
      EXPAND: 1.1
    };
    
    return Math.max(1, Math.floor(baseSize * (missionMultipliers[mission.type] || 1.0)));
  }

  determineEquipmentLevel() {
    const resourceLevel = this.getTotalResourceValue();
    
    if (resourceLevel > 50000) return 'high';
    if (resourceLevel > 20000) return 'medium';
    return 'basic';
  }

  getAveragePlayerReputation() {
    if (this.playerReputation.size === 0) return 0;
    
    let total = 0;
    for (const reputation of this.playerReputation.values()) {
      total += reputation;
    }
    
    return total / this.playerReputation.size;
  }

  getRandomControlledSector() {
    const sectors = Array.from(this.territory);
    return sectors[Math.floor(Math.random() * sectors.length)];
  }

  getPlayerSector(player) {
    // This would calculate which sector the player is in based on position
    const sectorX = Math.floor(player.x / 2000);
    const sectorY = Math.floor(player.y / 2000);
    return `${sectorX},${sectorY}`;
  }

  // Placeholder methods for full implementation
  updateDiplomacy(gameState) { /* Implement diplomatic updates */ }
  processActiveEvents(gameState) { /* Process faction events */ }
  findBestTradeDestination(gameState) { return this.homeBase; }
  selectTradeGood() { return 'iron'; }
  findExplorationTarget(gameState) { return `0,0`; }
  assessExpansionDifficulty(sectorId, gameState) { return Math.random() * 50; }
  calculateExpansionPriority(sectorId, gameState) { return Math.random() * 100; }
  triggerReputationEvent(playerId, oldLevel, newLevel) { /* Implement reputation events */ }

  /**
   * Serialize faction data for database storage
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      config: JSON.stringify(this.config),
      resources: JSON.stringify(Object.fromEntries(this.resources)),
      territory: JSON.stringify(Array.from(this.territory)),
      allies: JSON.stringify(Array.from(this.allies)),
      enemies: JSON.stringify(Array.from(this.enemies)),
      homeBase: this.homeBase,
      currentStrategy: this.currentStrategy,
      stats: JSON.stringify(this.stats),
      updated_at: Date.now()
    };
  }

  /**
   * Deserialize faction data from database
   */
  static deserialize(data) {
    const faction = new Faction(data.id, data.name, data.type, JSON.parse(data.config));
    
    faction.resources = new Map(Object.entries(JSON.parse(data.resources)));
    faction.territory = new Set(JSON.parse(data.territory));
    faction.allies = new Set(JSON.parse(data.allies));
    faction.enemies = new Set(JSON.parse(data.enemies));
    faction.homeBase = data.homeBase;
    faction.currentStrategy = data.currentStrategy;
    faction.stats = JSON.parse(data.stats);
    
    return faction;
  }
}

module.exports = {
  Faction,
  FACTION_TYPES,
  REPUTATION_LEVELS
};