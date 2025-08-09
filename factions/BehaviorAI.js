/**
 * BehaviorAI class for StarForgeFrontier NPC faction system
 * 
 * Handles AI decision-making system for faction behaviors
 * Manages patrol, trade, attack, explore, and other fleet behaviors
 */

const { v4: uuidv4 } = require('uuid');

// Behavior decision weights for different faction types
const BEHAVIOR_WEIGHTS = {
  MILITARY: {
    PATROL: 0.4,
    ATTACK: 0.3,
    DEFEND: 0.2,
    EXPLORE: 0.05,
    TRADE: 0.05
  },
  TRADER: {
    TRADE: 0.5,
    PATROL: 0.2,
    DEFEND: 0.15,
    EXPLORE: 0.1,
    ATTACK: 0.05
  },
  PIRATE: {
    ATTACK: 0.4,
    RAID: 0.3,
    PATROL: 0.2,
    EXPLORE: 0.1,
    TRADE: 0.0
  },
  SCIENTIST: {
    EXPLORE: 0.4,
    RESEARCH: 0.3,
    PATROL: 0.15,
    TRADE: 0.1,
    ATTACK: 0.05
  },
  NEUTRAL: {
    PATROL: 0.3,
    TRADE: 0.25,
    DEFEND: 0.2,
    EXPLORE: 0.15,
    ATTACK: 0.1
  }
};

// Behavior state transitions and priorities
const BEHAVIOR_TRANSITIONS = {
  PATROL: {
    canTransitionTo: ['ATTACK', 'DEFEND', 'INVESTIGATE', 'RETURN_BASE'],
    priority: 1,
    durationRange: [60000, 300000] // 1-5 minutes
  },
  ATTACK: {
    canTransitionTo: ['PURSUE', 'DISENGAGE', 'DEFEND', 'RETURN_BASE'],
    priority: 3,
    durationRange: [30000, 120000] // 30 seconds - 2 minutes
  },
  DEFEND: {
    canTransitionTo: ['ATTACK', 'PATROL', 'ALERT', 'RETURN_BASE'],
    priority: 2,
    durationRange: [120000, 600000] // 2-10 minutes
  },
  TRADE: {
    canTransitionTo: ['DEFEND', 'FLEE', 'PATROL', 'RETURN_BASE'],
    priority: 1,
    durationRange: [300000, 900000] // 5-15 minutes
  },
  EXPLORE: {
    canTransitionTo: ['INVESTIGATE', 'RETURN_BASE', 'PATROL', 'DEFEND'],
    priority: 1,
    durationRange: [240000, 720000] // 4-12 minutes
  },
  INVESTIGATE: {
    canTransitionTo: ['ATTACK', 'PATROL', 'RETURN_BASE', 'ALERT'],
    priority: 2,
    durationRange: [30000, 180000] // 30 seconds - 3 minutes
  }
};

// Situational modifiers that affect behavior decisions
const SITUATION_MODIFIERS = {
  underAttack: { DEFEND: 2.0, ATTACK: 1.5, PATROL: 0.5, TRADE: 0.3, EXPLORE: 0.2 },
  lowHealth: { DEFEND: 1.8, FLEE: 3.0, ATTACK: 0.3, PATROL: 0.7, EXPLORE: 0.4 },
  lowFuel: { RETURN_BASE: 2.5, TRADE: 0.5, EXPLORE: 0.2, ATTACK: 0.6, PATROL: 0.8 },
  lowMorale: { RETURN_BASE: 1.5, DEFEND: 1.3, ATTACK: 0.7, PATROL: 0.8, TRADE: 0.9 },
  enemyDetected: { INVESTIGATE: 2.0, ATTACK: 1.5, ALERT: 2.0, DEFEND: 1.3, TRADE: 0.4 },
  allyNearby: { ATTACK: 1.3, DEFEND: 1.2, PATROL: 1.1, COORDINATE: 2.0 },
  tradeOpportunity: { TRADE: 2.0, PATROL: 0.8, ATTACK: 0.5, EXPLORE: 0.7 },
  hostileTerritory: { ATTACK: 0.6, DEFEND: 1.4, PATROL: 0.7, FLEE: 1.5, EXPLORE: 0.3 }
};

class BehaviorAI {
  constructor(fleet, allowedBehaviors = []) {
    this.fleet = fleet;
    this.allowedBehaviors = allowedBehaviors.length > 0 ? allowedBehaviors : this.getDefaultBehaviors();
    
    // Current behavior state
    this.currentBehavior = null;
    this.behaviorStartTime = 0;
    this.behaviorDuration = 0;
    this.behaviorData = {}; // Behavior-specific data
    
    // Decision making
    this.lastDecisionTime = 0;
    this.decisionInterval = 5000; // Make decisions every 5 seconds
    this.decisionHistory = [];
    this.maxDecisionHistory = 20;
    
    // Perception and awareness
    this.detectedTargets = new Map(); // targetId -> detection data
    this.detectedAllies = new Map();
    this.knownThreats = new Set();
    this.perceptionRadius = 300;
    this.lastPerceptionUpdate = 0;
    
    // Pathfinding and movement
    this.currentPath = [];
    this.pathIndex = 0;
    this.pathfindingCooldown = 0;
    this.stuckCounter = 0;
    this.lastPosition = null;
    
    // Communication and coordination
    this.pendingMessages = [];
    this.lastCommunication = 0;
    this.coordinationPartners = new Set();
    
    // Learning and adaptation
    this.experienceData = {
      successfulAttacks: 0,
      failedAttacks: 0,
      successfulDefenses: 0,
      escapedCombat: 0,
      completedPatrols: 0
    };
    
    // Initialize with default behavior
    this.initializeBehavior();
    
    console.log(`BehaviorAI initialized for fleet ${fleet.id} with behaviors:`, this.allowedBehaviors);
  }

  /**
   * Get default behaviors based on faction type
   */
  getDefaultBehaviors() {
    const defaultBehaviors = {
      MILITARY: ['PATROL', 'ATTACK', 'DEFEND'],
      TRADER: ['TRADE', 'PATROL', 'DEFEND'],
      PIRATE: ['ATTACK', 'RAID', 'PATROL'],
      SCIENTIST: ['EXPLORE', 'RESEARCH', 'PATROL'],
      NEUTRAL: ['PATROL', 'TRADE', 'DEFEND']
    };

    return defaultBehaviors[this.fleet.factionType] || defaultBehaviors.NEUTRAL;
  }

  /**
   * Initialize AI with starting behavior
   */
  initializeBehavior() {
    const weights = BEHAVIOR_WEIGHTS[this.fleet.factionType] || BEHAVIOR_WEIGHTS.NEUTRAL;
    const initialBehavior = this.selectBehaviorWeighted(weights);
    this.transitionToBehavior(initialBehavior);
  }

  /**
   * Main update loop for AI decision making
   */
  update() {
    const now = Date.now();
    
    try {
      // Update perception
      this.updatePerception();
      
      // Check if current behavior should continue
      if (this.shouldContinueCurrentBehavior()) {
        this.executeBehavior();
      } else {
        // Make new behavior decision
        if (now >= this.lastDecisionTime + this.decisionInterval) {
          this.makeDecision();
          this.lastDecisionTime = now;
        }
      }
      
      // Update pathfinding and movement
      this.updateMovement();
      
      // Process pending communications
      this.processCommunications();
      
    } catch (error) {
      console.error(`Error in BehaviorAI update for fleet ${this.fleet.id}:`, error);
    }
  }

  /**
   * Update fleet's perception of surroundings
   */
  updatePerception() {
    // TODO: Integration with game world to detect nearby entities
    // For now, we'll simulate perception updates
    
    // Clear old detections
    const now = Date.now();
    for (const [targetId, detection] of this.detectedTargets.entries()) {
      if (now - detection.lastSeen > 30000) { // 30 seconds
        this.detectedTargets.delete(targetId);
      }
    }
    
    // Simulate random encounters based on faction behavior
    if (Math.random() < 0.1) { // 10% chance per update
      this.simulateEncounter();
    }
  }

  /**
   * Simulate random encounters for AI testing
   */
  simulateEncounter() {
    const encounterTypes = ['PLAYER', 'HOSTILE_FLEET', 'TRADE_OPPORTUNITY', 'ANOMALY'];
    const encounterType = encounterTypes[Math.floor(Math.random() * encounterTypes.length)];
    
    switch (encounterType) {
      case 'PLAYER':
        this.detectPlayer();
        break;
      case 'HOSTILE_FLEET':
        this.detectHostileFleet();
        break;
      case 'TRADE_OPPORTUNITY':
        this.detectTradeOpportunity();
        break;
      case 'ANOMALY':
        this.detectAnomaly();
        break;
    }
  }

  /**
   * Check if current behavior should continue
   */
  shouldContinueCurrentBehavior() {
    if (!this.currentBehavior) return false;
    
    const now = Date.now();
    const behaviorAge = now - this.behaviorStartTime;
    
    // Check if behavior duration has been exceeded
    if (behaviorAge > this.behaviorDuration) {
      return false;
    }
    
    // Check for high-priority interruptions
    if (this.hasHighPriorityInterruption()) {
      return false;
    }
    
    // Check behavior-specific continuation conditions
    return this.checkBehaviorContinuation();
  }

  /**
   * Check for high-priority interruptions
   */
  hasHighPriorityInterruption() {
    // Under attack - highest priority
    if (this.fleet.isInCombat && this.currentBehavior !== 'ATTACK' && this.currentBehavior !== 'DEFEND') {
      return true;
    }
    
    // Critical resource levels
    if ((this.fleet.fuel < 15 || this.fleet.supplies < 15) && this.currentBehavior !== 'RETURN_BASE') {
      return true;
    }
    
    // Fleet critically damaged
    const aliveShips = this.fleet.ships.filter(ship => ship.isAlive);
    if (aliveShips.length < this.fleet.ships.length * 0.3 && this.currentBehavior !== 'FLEE') {
      return true;
    }
    
    return false;
  }

  /**
   * Check behavior-specific continuation conditions
   */
  checkBehaviorContinuation() {
    switch (this.currentBehavior) {
      case 'ATTACK':
        // Continue if target is still valid and in range
        return this.fleet.currentTarget && 
               this.fleet.calculateDistanceToTarget(this.fleet.currentTarget) < 500;
               
      case 'DEFEND':
        // Continue if defending position or under threat
        return this.fleet.alertLevel > 0 || 
               this.detectedTargets.size > 0;
               
      case 'TRADE':
        // Continue if trade route is active and safe
        return this.behaviorData.tradeRoute && 
               this.fleet.alertLevel === 0;
               
      case 'EXPLORE':
        // Continue if exploration objectives remain
        return this.behaviorData.unexploredAreas && 
               this.behaviorData.unexploredAreas.length > 0;
               
      case 'PATROL':
        // Continue patrol circuit
        return this.behaviorData.patrolRoute && 
               this.behaviorData.currentPatrolIndex >= 0;
               
      default:
        return true;
    }
  }

  /**
   * Make new behavior decision
   */
  makeDecision() {
    // Analyze current situation
    const situation = this.analyzeSituation();
    
    // Calculate behavior scores
    const behaviorScores = this.calculateBehaviorScores(situation);
    
    // Select best behavior
    const newBehavior = this.selectBestBehavior(behaviorScores);
    
    // Transition to new behavior if different
    if (newBehavior !== this.currentBehavior) {
      this.transitionToBehavior(newBehavior, situation);
    }
    
    // Record decision
    this.recordDecision(newBehavior, situation, behaviorScores);
  }

  /**
   * Analyze current situation for decision making
   */
  analyzeSituation() {
    const aliveShips = this.fleet.ships.filter(ship => ship.isAlive);
    const totalHealth = aliveShips.reduce((sum, ship) => sum + ship.health, 0);
    const maxHealth = aliveShips.reduce((sum, ship) => sum + ship.maxHealth, 0);
    
    return {
      healthPercentage: maxHealth > 0 ? (totalHealth / maxHealth) : 0,
      fuelLevel: this.fleet.fuel,
      supplyLevel: this.fleet.supplies,
      moraleLevel: this.fleet.morale,
      alertLevel: this.fleet.alertLevel,
      isInCombat: this.fleet.isInCombat,
      shipsRemaining: aliveShips.length,
      detectedEnemies: this.detectedTargets.size,
      detectedAllies: this.detectedAllies.size,
      distanceFromHome: this.calculateDistanceFromHome(),
      currentThreat: this.assessThreatLevel(),
      resourceOpportunities: this.assessResourceOpportunities(),
      strategicValue: this.assessStrategicValue()
    };
  }

  /**
   * Calculate behavior scores based on situation
   */
  calculateBehaviorScores(situation) {
    const baseWeights = BEHAVIOR_WEIGHTS[this.fleet.factionType] || BEHAVIOR_WEIGHTS.NEUTRAL;
    const scores = {};
    
    // Start with base weights
    for (const behavior of this.allowedBehaviors) {
      scores[behavior] = baseWeights[behavior] || 0.1;
    }
    
    // Apply situational modifiers
    this.applySituationalModifiers(scores, situation);
    
    // Apply experience-based learning
    this.applyExperienceModifiers(scores);
    
    // Apply faction-specific logic
    this.applyFactionModifiers(scores, situation);
    
    return scores;
  }

  /**
   * Apply situational modifiers to behavior scores
   */
  applySituationalModifiers(scores, situation) {
    // Health-based modifiers
    if (situation.healthPercentage < 0.3) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.lowHealth);
    }
    
    // Resource-based modifiers
    if (situation.fuelLevel < 25 || situation.supplyLevel < 25) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.lowFuel);
    }
    
    // Morale-based modifiers
    if (situation.moraleLevel < 40) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.lowMorale);
    }
    
    // Combat-based modifiers
    if (situation.isInCombat) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.underAttack);
    }
    
    // Detection-based modifiers
    if (situation.detectedEnemies > 0) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.enemyDetected);
    }
    
    if (situation.detectedAllies > 0) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.allyNearby);
    }
    
    // Distance from home modifier
    if (situation.distanceFromHome > 1000) {
      this.applyModifiers(scores, SITUATION_MODIFIERS.hostileTerritory);
    }
  }

  /**
   * Apply experience-based learning modifiers
   */
  applyExperienceModifiers(scores) {
    const exp = this.experienceData;
    
    // Successful behaviors get small bonuses
    if (exp.successfulAttacks > exp.failedAttacks && scores.ATTACK) {
      scores.ATTACK *= 1.1;
    }
    
    if (exp.successfulDefenses > 5 && scores.DEFEND) {
      scores.DEFEND *= 1.05;
    }
    
    if (exp.completedPatrols > 10 && scores.PATROL) {
      scores.PATROL *= 1.03;
    }
    
    // Failed behaviors get small penalties
    if (exp.failedAttacks > exp.successfulAttacks && scores.ATTACK) {
      scores.ATTACK *= 0.9;
    }
  }

  /**
   * Apply faction-specific behavior modifiers
   */
  applyFactionModifiers(scores, situation) {
    switch (this.fleet.factionType) {
      case 'MILITARY':
        // Military prefers aggressive responses to threats
        if (situation.detectedEnemies > 0 && scores.ATTACK) {
          scores.ATTACK *= 1.3;
        }
        break;
        
      case 'TRADER':
        // Traders avoid combat when possible
        if (situation.isInCombat && scores.FLEE) {
          scores.FLEE *= 1.5;
        }
        if (situation.resourceOpportunities > 0 && scores.TRADE) {
          scores.TRADE *= 1.4;
        }
        break;
        
      case 'PIRATE':
        // Pirates are opportunistic
        if (situation.currentThreat < 0.5 && situation.detectedEnemies > 0 && scores.ATTACK) {
          scores.ATTACK *= 1.2;
        }
        break;
        
      case 'SCIENTIST':
        // Scientists prefer exploration and research
        if (situation.strategicValue > 0.7 && scores.EXPLORE) {
          scores.EXPLORE *= 1.3;
        }
        break;
    }
  }

  /**
   * Apply behavior modifiers helper
   */
  applyModifiers(scores, modifiers) {
    for (const [behavior, modifier] of Object.entries(modifiers)) {
      if (scores[behavior] !== undefined) {
        scores[behavior] *= modifier;
      }
    }
  }

  /**
   * Select best behavior based on scores
   */
  selectBestBehavior(scores) {
    // Add some randomness to prevent completely predictable behavior
    const randomizedScores = {};
    for (const [behavior, score] of Object.entries(scores)) {
      randomizedScores[behavior] = score * (0.8 + Math.random() * 0.4);
    }
    
    // Find highest scoring behavior
    let bestBehavior = null;
    let bestScore = -1;
    
    for (const [behavior, score] of Object.entries(randomizedScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestBehavior = behavior;
      }
    }
    
    return bestBehavior || 'PATROL';
  }

  /**
   * Select behavior using weighted random selection
   */
  selectBehaviorWeighted(weights) {
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const [behavior, weight] of Object.entries(weights)) {
      if (this.allowedBehaviors.includes(behavior)) {
        random -= weight;
        if (random <= 0) {
          return behavior;
        }
      }
    }
    
    return this.allowedBehaviors[0] || 'PATROL';
  }

  /**
   * Transition to new behavior
   */
  transitionToBehavior(newBehavior, situation = null) {
    const oldBehavior = this.currentBehavior;
    
    // Clean up old behavior
    this.cleanupBehavior();
    
    // Set new behavior
    this.currentBehavior = newBehavior;
    this.behaviorStartTime = Date.now();
    this.behaviorData = {};
    
    // Set behavior duration
    const transitions = BEHAVIOR_TRANSITIONS[newBehavior] || BEHAVIOR_TRANSITIONS.PATROL;
    const [minDuration, maxDuration] = transitions.durationRange;
    this.behaviorDuration = minDuration + Math.random() * (maxDuration - minDuration);
    
    // Initialize new behavior
    this.initializeBehavior(newBehavior, situation);
    
    console.log(`Fleet ${this.fleet.id} transitioning from ${oldBehavior || 'NONE'} to ${newBehavior}`);
  }

  /**
   * Initialize specific behavior
   */
  initializeBehavior(behavior, situation = null) {
    switch (behavior) {
      case 'PATROL':
        this.initializePatrolBehavior();
        break;
      case 'ATTACK':
        this.initializeAttackBehavior(situation);
        break;
      case 'DEFEND':
        this.initializeDefendBehavior();
        break;
      case 'TRADE':
        this.initializeTradeBehavior();
        break;
      case 'EXPLORE':
        this.initializeExploreBehavior();
        break;
      case 'INVESTIGATE':
        this.initializeInvestigateBehavior(situation);
        break;
      default:
        this.initializeDefaultBehavior();
    }
  }

  /**
   * Execute current behavior
   */
  executeBehavior() {
    switch (this.currentBehavior) {
      case 'PATROL':
        this.executePatrolBehavior();
        break;
      case 'ATTACK':
        this.executeAttackBehavior();
        break;
      case 'DEFEND':
        this.executeDefendBehavior();
        break;
      case 'TRADE':
        this.executeTradeBehavior();
        break;
      case 'EXPLORE':
        this.executeExploreBehavior();
        break;
      case 'INVESTIGATE':
        this.executeInvestigateBehavior();
        break;
      default:
        this.executeDefaultBehavior();
    }
  }

  /**
   * Patrol behavior implementation
   */
  initializePatrolBehavior() {
    // Set up patrol route
    const patrolPoints = this.generatePatrolRoute();
    this.behaviorData.patrolRoute = patrolPoints;
    this.behaviorData.currentPatrolIndex = 0;
    this.fleet.setPatrolPoints(patrolPoints);
  }

  executePatrolBehavior() {
    const route = this.behaviorData.patrolRoute;
    if (!route || route.length === 0) return;
    
    const currentIndex = this.behaviorData.currentPatrolIndex;
    const currentWaypoint = route[currentIndex];
    
    // Move to current waypoint
    if (currentWaypoint && !this.fleet.targetPosition) {
      this.fleet.setTargetPosition(currentWaypoint);
    }
    
    // Check if reached waypoint
    if (this.isAtPosition(currentWaypoint, 30)) {
      // Move to next waypoint
      this.behaviorData.currentPatrolIndex = (currentIndex + 1) % route.length;
    }
  }

  /**
   * Attack behavior implementation
   */
  initializeAttackBehavior(situation) {
    // Find and engage target
    const target = this.selectAttackTarget(situation);
    if (target) {
      this.fleet.engageTarget(target);
      this.behaviorData.primaryTarget = target;
    }
  }

  executeAttackBehavior() {
    const target = this.behaviorData.primaryTarget || this.fleet.currentTarget;
    
    if (!target) {
      // No target, search for one
      const newTarget = this.findNearestEnemy();
      if (newTarget) {
        this.fleet.engageTarget(newTarget);
        this.behaviorData.primaryTarget = newTarget;
      } else {
        // No enemies found, transition to patrol
        this.transitionToBehavior('PATROL');
      }
      return;
    }
    
    // Update attack position
    if (target.position) {
      this.fleet.setTargetPosition(target.position);
    }
    
    // Check engagement distance
    const distance = this.fleet.calculateDistanceToTarget(target);
    if (distance > this.fleet.behaviorConfig.engagementRange * 3) {
      // Target too far, give up
      this.fleet.disengageTarget();
      this.transitionToBehavior('PATROL');
    }
  }

  /**
   * Defense behavior implementation
   */
  initializeDefendBehavior() {
    // Set defensive position
    const defendPosition = this.behaviorData.defendPosition || this.fleet.homeBase || this.fleet.position;
    this.fleet.setTargetPosition(defendPosition);
    this.behaviorData.defendPosition = defendPosition;
    this.behaviorData.defensiveRadius = 150;
  }

  executeDefendBehavior() {
    const defendPos = this.behaviorData.defendPosition;
    const radius = this.behaviorData.defensiveRadius;
    
    // Stay within defensive radius
    const distance = Math.sqrt(
      Math.pow(this.fleet.position.x - defendPos.x, 2) +
      Math.pow(this.fleet.position.y - defendPos.y, 2)
    );
    
    if (distance > radius) {
      this.fleet.setTargetPosition(defendPos);
    }
    
    // Engage nearby threats
    const nearbyThreat = this.findNearestEnemyInRadius(radius * 2);
    if (nearbyThreat) {
      this.fleet.engageTarget(nearbyThreat);
    }
  }

  /**
   * Trade behavior implementation
   */
  initializeTradeBehavior() {
    // Set up trade route
    const tradeRoute = this.generateTradeRoute();
    this.behaviorData.tradeRoute = tradeRoute;
    this.behaviorData.currentTradeIndex = 0;
    this.fleet.setTradeRoute(tradeRoute);
  }

  executeTradeBehavior() {
    const route = this.behaviorData.tradeRoute;
    if (!route || route.length === 0) return;
    
    const currentIndex = this.behaviorData.currentTradeIndex;
    const currentStation = route[currentIndex];
    
    // Move to trading station
    if (currentStation && !this.fleet.targetPosition) {
      this.fleet.setTargetPosition(currentStation);
    }
    
    // Check if reached station
    if (this.isAtPosition(currentStation, 50)) {
      // Simulate trading
      this.performTrade(currentStation);
      
      // Move to next station
      this.behaviorData.currentTradeIndex = (currentIndex + 1) % route.length;
    }
  }

  /**
   * Exploration behavior implementation
   */
  initializeExploreBehavior() {
    // Generate exploration targets
    const explorationTargets = this.generateExplorationTargets();
    this.behaviorData.explorationTargets = explorationTargets;
    this.behaviorData.currentExplorationIndex = 0;
  }

  executeExploreBehavior() {
    const targets = this.behaviorData.explorationTargets;
    if (!targets || targets.length === 0) {
      this.generateNewExplorationTargets();
      return;
    }
    
    const currentIndex = this.behaviorData.currentExplorationIndex;
    const currentTarget = targets[currentIndex];
    
    // Move to exploration target
    if (currentTarget && !this.fleet.targetPosition) {
      this.fleet.setTargetPosition(currentTarget);
    }
    
    // Check if reached target
    if (this.isAtPosition(currentTarget, 40)) {
      // Exploration complete for this target
      this.behaviorData.currentExplorationIndex++;
      
      if (this.behaviorData.currentExplorationIndex >= targets.length) {
        // All targets explored, generate new ones
        this.generateNewExplorationTargets();
      }
    }
  }

  /**
   * Investigation behavior implementation
   */
  initializeInvestigateBehavior(situation) {
    // Find investigation target
    const target = this.selectInvestigationTarget(situation);
    if (target) {
      this.behaviorData.investigationTarget = target;
      this.fleet.setTargetPosition(target.position || target);
    }
  }

  executeInvestigateBehavior() {
    const target = this.behaviorData.investigationTarget;
    if (!target) {
      this.transitionToBehavior('PATROL');
      return;
    }
    
    // Move to investigation site
    if (target.position && !this.isAtPosition(target.position, 50)) {
      this.fleet.setTargetPosition(target.position);
    } else {
      // Investigation complete
      this.completeInvestigation(target);
      this.transitionToBehavior('PATROL');
    }
  }

  /**
   * Default behavior implementation
   */
  initializeDefaultBehavior() {
    this.initializePatrolBehavior();
  }

  executeDefaultBehavior() {
    this.executePatrolBehavior();
  }

  /**
   * Helper methods for behavior implementations
   */
  generatePatrolRoute() {
    const center = this.fleet.homeBase || this.fleet.position;
    const points = [];
    const numPoints = 3 + Math.floor(Math.random() * 3); // 3-5 points
    const radius = 200 + Math.random() * 300; // 200-500 unit radius
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = radius * (0.7 + Math.random() * 0.6); // Vary radius
      points.push({
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r
      });
    }
    
    return points;
  }

  generateTradeRoute() {
    // For now, generate simple trade route
    // TODO: Integration with trading station system
    return [
      { x: this.fleet.position.x + 500, y: this.fleet.position.y },
      { x: this.fleet.position.x - 500, y: this.fleet.position.y },
      { x: this.fleet.position.x, y: this.fleet.position.y + 500 },
      { x: this.fleet.position.x, y: this.fleet.position.y - 500 }
    ];
  }

  generateExplorationTargets() {
    const targets = [];
    const center = this.fleet.position;
    const numTargets = 2 + Math.floor(Math.random() * 3); // 2-4 targets
    
    for (let i = 0; i < numTargets; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 400 + Math.random() * 800; // 400-1200 units away
      targets.push({
        x: center.x + Math.cos(angle) * distance,
        y: center.y + Math.sin(angle) * distance
      });
    }
    
    return targets;
  }

  generateNewExplorationTargets() {
    this.behaviorData.explorationTargets = this.generateExplorationTargets();
    this.behaviorData.currentExplorationIndex = 0;
  }

  selectAttackTarget(situation) {
    // Prioritize detected enemies
    if (this.detectedTargets.size > 0) {
      return Array.from(this.detectedTargets.values())[0].target;
    }
    
    // TODO: Integration with game world to find actual targets
    return null;
  }

  selectInvestigationTarget(situation) {
    // Find most interesting detection
    let bestTarget = null;
    let bestPriority = 0;
    
    for (const detection of this.detectedTargets.values()) {
      if (detection.priority > bestPriority) {
        bestPriority = detection.priority;
        bestTarget = detection;
      }
    }
    
    return bestTarget?.target;
  }

  findNearestEnemy() {
    // TODO: Integration with game world
    return null;
  }

  findNearestEnemyInRadius(radius) {
    // TODO: Integration with game world
    return null;
  }

  performTrade(station) {
    // TODO: Integration with trading system
    console.log(`Fleet ${this.fleet.id} performing trade at station`);
  }

  completeInvestigation(target) {
    // TODO: Process investigation results
    console.log(`Fleet ${this.fleet.id} completed investigation`);
  }

  /**
   * Utility methods
   */
  calculateDistanceFromHome() {
    const home = this.fleet.homeBase || { x: 0, y: 0 };
    const dx = this.fleet.position.x - home.x;
    const dy = this.fleet.position.y - home.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  assessThreatLevel() {
    let threat = 0;
    
    // Factor in detected enemies
    threat += this.detectedTargets.size * 0.3;
    
    // Factor in fleet health
    const aliveShips = this.fleet.ships.filter(ship => ship.isAlive);
    const healthRatio = aliveShips.length / this.fleet.ships.length;
    threat += (1 - healthRatio) * 0.5;
    
    // Factor in current combat
    if (this.fleet.isInCombat) {
      threat += 0.3;
    }
    
    return Math.min(1, threat);
  }

  assessResourceOpportunities() {
    // TODO: Integration with trading and resource systems
    return Math.random(); // Placeholder
  }

  assessStrategicValue() {
    // TODO: Assess strategic value of current location
    return Math.random(); // Placeholder
  }

  isAtPosition(position, threshold = 30) {
    if (!position) return false;
    
    const dx = this.fleet.position.x - position.x;
    const dy = this.fleet.position.y - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= threshold;
  }

  /**
   * Update movement and pathfinding
   */
  updateMovement() {
    // Check if fleet is stuck
    if (this.lastPosition) {
      const dx = this.fleet.position.x - this.lastPosition.x;
      const dy = this.fleet.position.y - this.lastPosition.y;
      const moved = Math.sqrt(dx * dx + dy * dy);
      
      if (moved < 5) {
        this.stuckCounter++;
        if (this.stuckCounter > 10) {
          // Fleet is stuck, try to unstuck
          this.handleStuckFleet();
        }
      } else {
        this.stuckCounter = 0;
      }
    }
    
    this.lastPosition = { ...this.fleet.position };
  }

  handleStuckFleet() {
    // Generate random movement to unstuck
    const randomOffset = {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100
    };
    
    this.fleet.setTargetPosition({
      x: this.fleet.position.x + randomOffset.x,
      y: this.fleet.position.y + randomOffset.y
    });
    
    this.stuckCounter = 0;
  }

  /**
   * Process communications
   */
  processCommunications() {
    // TODO: Implement fleet-to-fleet communication
  }

  /**
   * Clean up behavior state
   */
  cleanupBehavior() {
    // Clear any behavior-specific timers or state
    this.behaviorData = {};
  }

  /**
   * Record decision for analysis
   */
  recordDecision(behavior, situation, scores) {
    const decision = {
      id: uuidv4(),
      timestamp: Date.now(),
      behavior,
      situation: { ...situation },
      scores: { ...scores },
      previousBehavior: this.currentBehavior
    };
    
    this.decisionHistory.push(decision);
    
    // Maintain decision history size
    if (this.decisionHistory.length > this.maxDecisionHistory) {
      this.decisionHistory = this.decisionHistory.slice(-this.maxDecisionHistory);
    }
  }

  /**
   * Simulated detection methods
   */
  detectPlayer() {
    const playerId = `player_${Math.floor(Math.random() * 100)}`;
    this.detectedTargets.set(playerId, {
      target: {
        id: playerId,
        type: 'PLAYER',
        position: {
          x: this.fleet.position.x + (Math.random() - 0.5) * 400,
          y: this.fleet.position.y + (Math.random() - 0.5) * 400
        }
      },
      detectedAt: Date.now(),
      lastSeen: Date.now(),
      priority: 0.7,
      threatLevel: 0.5
    });
  }

  detectHostileFleet() {
    const fleetId = `hostile_${uuidv4()}`;
    this.detectedTargets.set(fleetId, {
      target: {
        id: fleetId,
        type: 'HOSTILE_FLEET',
        position: {
          x: this.fleet.position.x + (Math.random() - 0.5) * 600,
          y: this.fleet.position.y + (Math.random() - 0.5) * 600
        }
      },
      detectedAt: Date.now(),
      lastSeen: Date.now(),
      priority: 0.9,
      threatLevel: 0.8
    });
  }

  detectTradeOpportunity() {
    this.behaviorData.tradeOpportunityDetected = true;
    console.log(`Fleet ${this.fleet.id} detected trade opportunity`);
  }

  detectAnomaly() {
    this.behaviorData.anomalyDetected = {
      position: {
        x: this.fleet.position.x + (Math.random() - 0.5) * 300,
        y: this.fleet.position.y + (Math.random() - 0.5) * 300
      },
      type: 'UNKNOWN',
      detectedAt: Date.now()
    };
  }

  /**
   * Get AI status for debugging and monitoring
   */
  getStatus() {
    return {
      fleetId: this.fleet.id,
      currentBehavior: this.currentBehavior,
      behaviorStartTime: this.behaviorStartTime,
      behaviorDuration: this.behaviorDuration,
      behaviorProgress: this.behaviorStartTime > 0 ? 
        (Date.now() - this.behaviorStartTime) / this.behaviorDuration : 0,
      detectedTargets: this.detectedTargets.size,
      detectedAllies: this.detectedAllies.size,
      stuckCounter: this.stuckCounter,
      decisionHistory: this.decisionHistory.slice(-5), // Last 5 decisions
      experienceData: { ...this.experienceData },
      behaviorData: Object.keys(this.behaviorData)
    };
  }
}

module.exports = BehaviorAI;