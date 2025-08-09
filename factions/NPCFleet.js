/**
 * NPCFleet.js - Individual NPC fleet management for StarForgeFrontier
 * Handles fleet movement, AI behavior, combat, and mission execution
 */

const { v4: uuidv4 } = require('uuid');

// Fleet mission types and their behaviors
const MISSION_TYPES = {
  PATROL: {
    name: 'Patrol',
    description: 'Patrol assigned sectors for threats',
    movementSpeed: 1.5,
    aggressiveness: 0.6,
    detectionRange: 300,
    engagementRange: 200
  },
  TRADE: {
    name: 'Trade',
    description: 'Transport goods between stations',
    movementSpeed: 2.0,
    aggressiveness: 0.2,
    detectionRange: 200,
    engagementRange: 100
  },
  EXPLORE: {
    name: 'Explore',
    description: 'Scout unknown regions',
    movementSpeed: 2.5,
    aggressiveness: 0.1,
    detectionRange: 400,
    engagementRange: 150
  },
  ATTACK: {
    name: 'Attack',
    description: 'Aggressive assault mission',
    movementSpeed: 2.0,
    aggressiveness: 0.9,
    detectionRange: 350,
    engagementRange: 250
  },
  DEFEND: {
    name: 'Defend',
    description: 'Defensive position holding',
    movementSpeed: 1.0,
    aggressiveness: 0.7,
    detectionRange: 400,
    engagementRange: 300
  },
  EXPAND: {
    name: 'Expand',
    description: 'Territorial expansion mission',
    movementSpeed: 1.8,
    aggressiveness: 0.8,
    detectionRange: 250,
    engagementRange: 200
  }
};

// Equipment levels for NPC ships
const EQUIPMENT_LEVELS = {
  basic: {
    health: 80,
    damage: 15,
    speed: 1.8,
    weaponRange: 150,
    weapons: ['Basic Laser'],
    modules: []
  },
  medium: {
    health: 120,
    damage: 25,
    speed: 2.2,
    weaponRange: 180,
    weapons: ['Pulse Cannon', 'Basic Laser'],
    modules: ['Shield Generator']
  },
  high: {
    health: 180,
    damage: 40,
    speed: 2.5,
    weaponRange: 220,
    weapons: ['Plasma Cannon', 'Pulse Cannon', 'Advanced Laser'],
    modules: ['Shield Generator', 'Advanced Thruster', 'Armor Plating']
  }
};

// Fleet formation patterns
const FORMATIONS = {
  LINE: { name: 'Line Formation', spacing: 100 },
  WEDGE: { name: 'Wedge Formation', spacing: 80 },
  CIRCLE: { name: 'Circle Formation', spacing: 120 },
  SCATTERED: { name: 'Scattered Formation', spacing: 150 }
};

class NPCFleet {
  constructor(id, config) {
    this.id = id || uuidv4();
    this.factionId = config.factionId;
    this.factionType = config.factionType;
    
    // Fleet composition
    this.ships = this.generateShips(config.shipCount, config.equipmentLevel);
    this.flagship = this.ships[0]; // First ship is the flagship
    this.formation = this.selectFormation();
    
    // Mission and movement
    this.mission = config.mission;
    this.missionConfig = MISSION_TYPES[this.mission.type];
    this.currentSector = config.spawnSector || '0,0';
    this.position = this.getSectorCenterPosition(this.currentSector);
    this.destination = null;
    this.waypoints = [];
    this.patrolRoute = [];
    
    // Fleet state
    this.status = 'idle'; // idle, moving, engaged, destroyed, returning
    this.lastUpdate = Date.now();
    this.missionStartTime = Date.now();
    this.missionDuration = config.mission.parameters?.duration || 1800000; // 30 minutes default
    
    // Combat state
    this.target = null;
    this.inCombat = false;
    this.combatCooldown = 0;
    this.lastShotTime = 0;
    this.threatLevel = 0;
    
    // AI state
    this.alertness = 0.5; // 0-1, affects detection and reaction
    this.morale = 1.0; // 0-1, affects combat effectiveness
    this.supplies = 1.0; // 0-1, affects operational capacity
    
    // Statistics
    this.stats = {
      enemiesDestroyed: 0,
      damageDealt: 0,
      damageTaken: 0,
      distanceTraveled: 0,
      timeOnMission: 0,
      engagements: 0
    };
    
    // Initialize mission-specific setup
    this.initializeMission();
    
    console.log(`NPC Fleet created: ${this.id} (${this.factionType}) - ${this.mission.type} with ${this.ships.length} ships`);
  }

  /**
   * Generate ships for the fleet based on configuration
   */
  generateShips(count, equipmentLevel) {
    const ships = [];
    const equipment = EQUIPMENT_LEVELS[equipmentLevel] || EQUIPMENT_LEVELS.basic;
    
    for (let i = 0; i < count; i++) {
      const ship = {
        id: uuidv4(),
        type: this.generateShipType(i === 0), // First ship is flagship
        health: equipment.health + (Math.random() * 20 - 10), // ±10 variation
        maxHealth: equipment.health,
        damage: equipment.damage + (Math.random() * 6 - 3), // ±3 variation
        speed: equipment.speed + (Math.random() * 0.4 - 0.2), // ±0.2 variation
        weaponRange: equipment.weaponRange,
        weapons: [...equipment.weapons],
        modules: [...equipment.modules],
        position: { x: 0, y: 0 },
        status: 'operational', // operational, damaged, destroyed
        lastShotTime: 0
      };
      
      ships.push(ship);
    }
    
    return ships;
  }

  /**
   * Generate ship type based on faction and role
   */
  generateShipType(isFlagship) {
    const factionShipTypes = {
      MILITARY: isFlagship ? 'Battlecruiser' : ['Frigate', 'Destroyer', 'Corvette'],
      TRADER: isFlagship ? 'Trade Hauler' : ['Cargo Ship', 'Escort Fighter'],
      PIRATE: isFlagship ? 'Raider Flagship' : ['Interceptor', 'Assault Ship'],
      SCIENTIST: isFlagship ? 'Research Vessel' : ['Survey Ship', 'Explorer'],
      NEUTRAL: isFlagship ? 'Defense Platform' : ['Patrol Ship', 'Guard Frigate']
    };
    
    const types = factionShipTypes[this.factionType];
    if (typeof types === 'string') return types;
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Select formation based on faction type and mission
   */
  selectFormation() {
    const factionFormations = {
      MILITARY: ['LINE', 'WEDGE'],
      TRADER: ['LINE', 'CIRCLE'],
      PIRATE: ['SCATTERED', 'WEDGE'],
      SCIENTIST: ['CIRCLE', 'SCATTERED'],
      NEUTRAL: ['LINE', 'CIRCLE']
    };
    
    const preferred = factionFormations[this.factionType] || ['LINE'];
    const formation = preferred[Math.floor(Math.random() * preferred.length)];
    return FORMATIONS[formation];
  }

  /**
   * Initialize mission-specific parameters
   */
  initializeMission() {
    switch (this.mission.type) {
      case 'PATROL':
        this.initializePatrolMission();
        break;
      case 'TRADE':
        this.initializeTradeMission();
        break;
      case 'EXPLORE':
        this.initializeExploreMission();
        break;
      case 'ATTACK':
        this.initializeAttackMission();
        break;
      case 'DEFEND':
        this.initializeDefendMission();
        break;
      case 'EXPAND':
        this.initializeExpandMission();
        break;
    }
  }

  /**
   * Update fleet state and execute AI behavior
   */
  update(gameState, faction) {
    const now = Date.now();
    const deltaTime = now - this.lastUpdate;
    
    try {
      // Update mission timer
      this.stats.timeOnMission += deltaTime;
      
      // Check if mission has expired
      if (this.stats.timeOnMission > this.missionDuration) {
        this.completeMission('expired');
        return;
      }
      
      // Update ship positions in formation
      this.updateFormation();
      
      // Update fleet status based on current situation
      this.updateFleetStatus(gameState);
      
      // Execute AI behavior based on current status
      this.executeAI(gameState, faction);
      
      // Update combat if engaged
      if (this.inCombat) {
        this.updateCombat(gameState, faction);
      }
      
      // Update fleet morale and supplies
      this.updateFleetCondition(deltaTime);
      
      this.lastUpdate = now;
      
    } catch (error) {
      console.error(`Error updating NPC fleet ${this.id}:`, error);
      this.status = 'error';
    }
  }

  /**
   * Update ship positions based on formation
   */
  updateFormation() {
    if (this.ships.length <= 1) return;
    
    const flagshipPos = this.flagship.position;
    const spacing = this.formation.spacing;
    
    for (let i = 1; i < this.ships.length; i++) {
      const ship = this.ships[i];
      const angle = (2 * Math.PI * i) / (this.ships.length - 1);
      
      switch (this.formation.name) {
        case 'Line Formation':
          ship.position.x = flagshipPos.x + (i * spacing);
          ship.position.y = flagshipPos.y;
          break;
          
        case 'Wedge Formation':
          ship.position.x = flagshipPos.x - (i * spacing * 0.5);
          ship.position.y = flagshipPos.y + (i % 2 === 0 ? spacing : -spacing);
          break;
          
        case 'Circle Formation':
          ship.position.x = flagshipPos.x + Math.cos(angle) * spacing;
          ship.position.y = flagshipPos.y + Math.sin(angle) * spacing;
          break;
          
        case 'Scattered Formation':
          const randomOffset = spacing * (Math.random() - 0.5);
          ship.position.x = flagshipPos.x + Math.cos(angle) * spacing + randomOffset;
          ship.position.y = flagshipPos.y + Math.sin(angle) * spacing + randomOffset;
          break;
      }
    }
  }

  /**
   * Update fleet status based on situation
   */
  updateFleetStatus(gameState) {
    // Check for threats in detection range
    const threats = this.detectThreats(gameState);
    this.threatLevel = threats.length;
    
    // Update alertness based on threats
    if (threats.length > 0) {
      this.alertness = Math.min(1.0, this.alertness + 0.1);
    } else {
      this.alertness = Math.max(0.3, this.alertness - 0.01);
    }
    
    // Check if we should engage
    if (threats.length > 0 && this.shouldEngageThreats(threats)) {
      this.engageTarget(threats[0]);
    }
    
    // Update status based on current situation
    if (this.inCombat) {
      this.status = 'engaged';
    } else if (this.destination && this.distanceToDestination() > 50) {
      this.status = 'moving';
    } else {
      this.status = 'idle';
    }
  }

  /**
   * Execute AI behavior based on mission and status
   */
  executeAI(gameState, faction) {
    switch (this.status) {
      case 'idle':
        this.executeIdleBehavior(gameState, faction);
        break;
      case 'moving':
        this.executeMovementBehavior(gameState, faction);
        break;
      case 'engaged':
        // Combat behavior is handled in updateCombat
        break;
      case 'returning':
        this.executeReturnBehavior(gameState, faction);
        break;
    }
  }

  /**
   * Execute idle behavior - determine next action
   */
  executeIdleBehavior(gameState, faction) {
    switch (this.mission.type) {
      case 'PATROL':
        this.executePatrolBehavior(gameState, faction);
        break;
      case 'TRADE':
        this.executeTradeBehavior(gameState, faction);
        break;
      case 'EXPLORE':
        this.executeExploreBehavior(gameState, faction);
        break;
      case 'DEFEND':
        this.executeDefendBehavior(gameState, faction);
        break;
      case 'EXPAND':
        this.executeExpandBehavior(gameState, faction);
        break;
    }
  }

  /**
   * Execute movement toward destination
   */
  executeMovementBehavior(gameState, faction) {
    if (!this.destination) return;
    
    const distance = this.distanceToDestination();
    if (distance < 50) {
      // Arrived at destination
      this.onArrival(gameState, faction);
      return;
    }
    
    // Move toward destination
    this.moveTowardDestination();
  }

  /**
   * Move fleet toward current destination
   */
  moveTowardDestination() {
    if (!this.destination) return;
    
    const dx = this.destination.x - this.position.x;
    const dy = this.destination.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      const speed = this.missionConfig.movementSpeed * this.getFleetSpeed();
      const moveX = (dx / distance) * speed;
      const moveY = (dy / distance) * speed;
      
      this.position.x += moveX;
      this.position.y += moveY;
      
      // Update flagship position
      this.flagship.position.x = this.position.x;
      this.flagship.position.y = this.position.y;
      
      this.stats.distanceTraveled += speed;
    }
  }

  /**
   * Detect threats in detection range
   */
  detectThreats(gameState) {
    const threats = [];
    const detectionRange = this.missionConfig.detectionRange * this.alertness;
    
    // Check for hostile players
    for (const player of Object.values(gameState.players)) {
      if (this.isPlayerThreat(player, gameState.factions)) {
        const distance = this.distanceToPlayer(player);
        if (distance <= detectionRange) {
          threats.push({
            type: 'player',
            target: player,
            distance: distance,
            threat: this.calculatePlayerThreat(player)
          });
        }
      }
    }
    
    return threats.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Determine if player is a threat
   */
  isPlayerThreat(player, faction) {
    const reputation = faction.getPlayerReputation(player.id);
    return reputation < -20 || (reputation < 0 && this.mission.type === 'ATTACK');
  }

  /**
   * Calculate threat level of a player
   */
  calculatePlayerThreat(player) {
    let threat = 1.0;
    
    // Factor in player level/resources
    threat += Math.min(2.0, player.level * 0.1);
    
    // Factor in player equipment
    const weaponCount = (player.components?.weapon || 0);
    threat += weaponCount * 0.2;
    
    return threat;
  }

  /**
   * Determine if fleet should engage detected threats
   */
  shouldEngageThreats(threats) {
    if (threats.length === 0) return false;
    
    const primaryThreat = threats[0];
    const engagementRange = this.missionConfig.engagementRange;
    
    // Check distance
    if (primaryThreat.distance > engagementRange) return false;
    
    // Check aggressiveness
    const shouldEngage = Math.random() < this.missionConfig.aggressiveness;
    
    // Defensive missions are less likely to leave their posts
    if (this.mission.type === 'DEFEND' && primaryThreat.distance > engagementRange * 0.5) {
      return false;
    }
    
    return shouldEngage;
  }

  /**
   * Engage a target in combat
   */
  engageTarget(threat) {
    this.target = threat.target;
    this.inCombat = true;
    this.status = 'engaged';
    this.stats.engagements++;
    
    console.log(`NPC Fleet ${this.id} engaging ${threat.type} at distance ${Math.round(threat.distance)}`);
  }

  /**
   * Update combat behavior
   */
  updateCombat(gameState, faction) {
    if (!this.target) {
      this.inCombat = false;
      return;
    }
    
    const targetDistance = this.distanceToPlayer(this.target);
    
    // Check if target is still in range
    if (targetDistance > this.missionConfig.engagementRange * 1.5) {
      this.disengageTarget();
      return;
    }
    
    // Move to optimal combat range
    const optimalRange = this.getOptimalCombatRange();
    if (targetDistance > optimalRange) {
      this.moveTowardTarget();
    }
    
    // Fire weapons if in range and cooldown expired
    if (targetDistance <= optimalRange && this.canFireWeapons()) {
      this.fireAtTarget(gameState, faction);
    }
  }

  /**
   * Fire weapons at current target
   */
  fireAtTarget(gameState, faction) {
    const now = Date.now();
    
    for (const ship of this.ships) {
      if (ship.status !== 'operational') continue;
      if (now - ship.lastShotTime < 1000) continue; // 1 second weapon cooldown
      
      // Calculate hit chance based on distance and ship condition
      const distance = this.distanceToPlayer(this.target);
      const accuracy = this.calculateAccuracy(distance, ship);
      
      if (Math.random() < accuracy) {
        // Hit! Apply damage
        const damage = ship.damage * this.morale;
        this.applyDamageToPlayer(this.target, damage, gameState);
        this.stats.damageDealt += damage;
        
        console.log(`NPC Fleet ${this.id} hit player ${this.target.id} for ${Math.round(damage)} damage`);
      }
      
      ship.lastShotTime = now;
    }
    
    this.lastShotTime = now;
  }

  /**
   * Calculate weapon accuracy
   */
  calculateAccuracy(distance, ship) {
    const baseAccuracy = 0.7;
    const distanceFactor = Math.max(0.1, 1.0 - (distance / ship.weaponRange));
    const conditionFactor = ship.health / ship.maxHealth;
    
    return baseAccuracy * distanceFactor * conditionFactor * this.morale;
  }

  /**
   * Apply damage to a player (this would integrate with the main game combat system)
   */
  applyDamageToPlayer(player, damage, gameState) {
    // This is a placeholder - would integrate with main game combat system
    if (player.health) {
      player.health = Math.max(0, player.health - damage);
      
      // If player is destroyed, gain reputation
      if (player.health <= 0) {
        this.onPlayerDestroyed(player);
      }
    }
  }

  /**
   * Handle player destruction
   */
  onPlayerDestroyed(player) {
    this.stats.enemiesDestroyed++;
    this.disengageTarget();
    console.log(`NPC Fleet ${this.id} destroyed player ${player.id}`);
  }

  /**
   * Disengage from current target
   */
  disengageTarget() {
    this.target = null;
    this.inCombat = false;
    this.status = 'idle';
  }

  /**
   * Mission-specific behavior implementations
   */
  executePatrolBehavior(gameState, faction) {
    if (this.patrolRoute.length === 0) {
      this.generatePatrolRoute();
    }
    
    if (this.patrolRoute.length > 0) {
      const nextWaypoint = this.patrolRoute[0];
      this.setDestination(this.getSectorCenterPosition(nextWaypoint));
    }
  }

  executeExploreBehavior(gameState, faction) {
    // Move to unexplored sectors
    const targetSector = this.mission.parameters?.targetSector;
    if (targetSector) {
      this.setDestination(this.getSectorCenterPosition(targetSector));
    }
  }

  executeDefendBehavior(gameState, faction) {
    // Stay in defensive position unless engaging threats
    if (!this.inCombat) {
      const homeSector = this.mission.parameters?.defendSector || this.currentSector;
      this.setDestination(this.getSectorCenterPosition(homeSector));
    }
  }

  /**
   * Utility methods
   */
  distanceToDestination() {
    if (!this.destination) return 0;
    const dx = this.destination.x - this.position.x;
    const dy = this.destination.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToPlayer(player) {
    const dx = player.x - this.position.x;
    const dy = player.y - this.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  setDestination(position) {
    this.destination = { x: position.x, y: position.y };
  }

  getSectorCenterPosition(sectorId) {
    const [x, y] = sectorId.split(',').map(Number);
    return {
      x: x * 2000 + 1000, // Center of 2000x2000 sector
      y: y * 2000 + 1000
    };
  }

  getFleetSpeed() {
    // Average speed of operational ships
    const operationalShips = this.ships.filter(s => s.status === 'operational');
    if (operationalShips.length === 0) return 0;
    
    const totalSpeed = operationalShips.reduce((sum, ship) => sum + ship.speed, 0);
    return totalSpeed / operationalShips.length;
  }

  getOptimalCombatRange() {
    const operationalShips = this.ships.filter(s => s.status === 'operational');
    if (operationalShips.length === 0) return 0;
    
    const totalRange = operationalShips.reduce((sum, ship) => sum + ship.weaponRange, 0);
    return (totalRange / operationalShips.length) * 0.8; // 80% of max range
  }

  canFireWeapons() {
    return Date.now() - this.lastShotTime > 1000; // 1 second fleet-wide cooldown
  }

  updateFleetCondition(deltaTime) {
    // Decrease supplies over time
    this.supplies = Math.max(0, this.supplies - (deltaTime / 3600000)); // 1 hour = full supply consumption
    
    // Update morale based on combat success and losses
    if (this.inCombat) {
      const damageRatio = this.getTotalDamage() / this.getTotalMaxHealth();
      this.morale = Math.max(0.2, 1.0 - damageRatio);
    }
  }

  getTotalDamage() {
    return this.ships.reduce((total, ship) => total + (ship.maxHealth - ship.health), 0);
  }

  getTotalMaxHealth() {
    return this.ships.reduce((total, ship) => total + ship.maxHealth, 0);
  }

  generatePatrolRoute() {
    const targetSectors = this.mission.parameters?.targetSectors || [this.currentSector];
    this.patrolRoute = [...targetSectors];
  }

  onArrival(gameState, faction) {
    switch (this.mission.type) {
      case 'PATROL':
        // Move to next patrol waypoint
        if (this.patrolRoute.length > 0) {
          this.patrolRoute.push(this.patrolRoute.shift()); // Rotate patrol route
        }
        break;
      case 'EXPLORE':
        // Claim territory if possible
        faction.claimTerritory(this.getCurrentSector());
        break;
    }
  }

  getCurrentSector() {
    const sectorX = Math.floor(this.position.x / 2000);
    const sectorY = Math.floor(this.position.y / 2000);
    return `${sectorX},${sectorY}`;
  }

  completeMission(reason = 'completed') {
    this.status = 'returning';
    console.log(`NPC Fleet ${this.id} mission ${reason}`);
  }

  // Mission initialization methods
  initializePatrolMission() { 
    this.generatePatrolRoute(); 
  }
  
  initializeTradeMission() { 
    // Set up trade route
    this.destination = this.mission.parameters?.destination || null;
  }
  
  initializeExploreMission() {
    // Set up exploration target
    this.destination = this.getSectorCenterPosition(this.mission.parameters?.targetSector || '0,0');
  }
  
  initializeAttackMission() { 
    // Set up attack target
    this.alertness = 1.0; // High alertness for attack missions
  }
  
  initializeDefendMission() {
    // Set up defensive position
    const defendSector = this.mission.parameters?.defendSector || this.currentSector;
    this.destination = this.getSectorCenterPosition(defendSector);
  }
  
  initializeExpandMission() { 
    // Set up expansion target
    const targetSector = this.mission.parameters?.targetSector || this.currentSector;
    this.destination = this.getSectorCenterPosition(targetSector);
  }
  
  executeReturnBehavior() { 
    // Return to home base
    if (!this.destination) {
      this.destination = this.getSectorCenterPosition(this.currentSector);
    }
    this.executeMovementBehavior();
  }
  
  executeTradeBehavior() { 
    // Execute trade mission behavior
    if (!this.destination) {
      this.destination = this.getSectorCenterPosition(this.currentSector);
    }
  }
  
  executeExpandBehavior() { 
    // Execute territorial expansion
    if (!this.destination) {
      this.destination = this.getSectorCenterPosition(this.currentSector);
    }
  }
  
  moveTowardTarget() { 
    // Move toward combat target
    if (this.target) {
      const dx = this.target.x - this.position.x;
      const dy = this.target.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const speed = this.missionConfig.movementSpeed * this.getFleetSpeed() * 0.5; // Slower in combat
        this.position.x += (dx / distance) * speed;
        this.position.y += (dy / distance) * speed;
      }
    }
  }

  /**
   * Serialize fleet data for database storage
   */
  serialize() {
    return {
      id: this.id,
      faction_id: this.factionId,
      name: `${this.factionType} ${this.mission.type} Fleet`,
      ships: JSON.stringify(this.ships),
      current_sector: this.currentSector,
      destination: this.destination ? JSON.stringify(this.destination) : null,
      mission: JSON.stringify(this.mission),
      mission_data: JSON.stringify({
        waypoints: this.waypoints,
        patrolRoute: this.patrolRoute,
        alertness: this.alertness,
        morale: this.morale,
        supplies: this.supplies
      }),
      resources: JSON.stringify({}), // Fleets don't carry resources yet
      status: this.status,
      created_at: this.missionStartTime,
      updated_at: Date.now()
    };
  }

  /**
   * Deserialize fleet data from database
   */
  static deserialize(data) {
    const config = {
      factionId: data.faction_id,
      factionType: data.faction_type || 'NEUTRAL',
      mission: JSON.parse(data.mission),
      spawnSector: data.current_sector,
      shipCount: JSON.parse(data.ships).length,
      equipmentLevel: 'medium'
    };
    
    const fleet = new NPCFleet(data.id, config);
    
    fleet.ships = JSON.parse(data.ships);
    fleet.destination = data.destination ? JSON.parse(data.destination) : null;
    fleet.status = data.status;
    
    const missionData = JSON.parse(data.mission_data || '{}');
    fleet.waypoints = missionData.waypoints || [];
    fleet.patrolRoute = missionData.patrolRoute || [];
    fleet.alertness = missionData.alertness || 0.5;
    fleet.morale = missionData.morale || 1.0;
    fleet.supplies = missionData.supplies || 1.0;
    
    return fleet;
  }
}

module.exports = {
  NPCFleet,
  MISSION_TYPES,
  EQUIPMENT_LEVELS
};