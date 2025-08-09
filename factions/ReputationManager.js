/**
 * ReputationManager class for StarForgeFrontier NPC faction system
 * 
 * Handles player reputation system with factions and consequences
 * Manages reputation changes, standing levels, and interaction effects
 */

const { v4: uuidv4 } = require('uuid');

// Reputation actions and their base values
const REPUTATION_ACTIONS = {
  // Positive actions
  TRADE_COMPLETED: { base: 2, description: 'Completed trade transaction' },
  CONTRACT_COMPLETED: { base: 5, description: 'Completed contract successfully' },
  ALLY_ASSISTED: { base: 8, description: 'Assisted faction fleet' },
  ENEMY_DEFEATED: { base: 10, description: 'Defeated faction enemy' },
  RESCUE_PERFORMED: { base: 15, description: 'Rescued faction members' },
  INTEL_PROVIDED: { base: 3, description: 'Provided valuable intelligence' },
  
  // Negative actions
  ATTACK_FACTION: { base: -15, description: 'Attacked faction fleet' },
  KILL_FACTION_MEMBER: { base: -25, description: 'Killed faction member' },
  STEAL_CARGO: { base: -5, description: 'Stole faction cargo' },
  SABOTAGE: { base: -20, description: 'Sabotaged faction assets' },
  CONTRACT_FAILED: { base: -8, description: 'Failed to complete contract' },
  TRESPASSING: { base: -3, description: 'Entered restricted territory' },
  PIRACY: { base: -12, description: 'Committed piracy against faction' },
  
  // Neutral/Special actions
  FIRST_CONTACT: { base: 0, description: 'First contact with faction' },
  PEACEFUL_ENCOUNTER: { base: 1, description: 'Peaceful encounter' },
  IGNORED_WARNING: { base: -2, description: 'Ignored faction warning' },
  SURRENDERED: { base: -5, description: 'Surrendered to faction' }
};

// Reputation standing levels with detailed effects
const REPUTATION_STANDINGS = {
  HOSTILE: {
    threshold: -75,
    name: 'Hostile',
    color: '#FF0000',
    description: 'Kill on sight - actively hunted',
    effects: {
      canTrade: false,
      attackOnSight: true,
      bountyMultiplier: 2.0,
      contractAccess: false,
      territoryAccess: 'BANNED',
      priceMultiplier: 0.0, // No trading allowed
      specialServices: false,
      diplomaticImmunity: false,
      escortAvailable: false
    }
  },
  UNFRIENDLY: {
    threshold: -25,
    name: 'Unfriendly',
    color: '#FF8000',
    description: 'Unwelcome - treated with suspicion',
    effects: {
      canTrade: true,
      attackOnSight: false,
      bountyMultiplier: 1.5,
      contractAccess: false,
      territoryAccess: 'WATCHED',
      priceMultiplier: 1.3, // 30% markup
      specialServices: false,
      diplomaticImmunity: false,
      escortAvailable: false
    }
  },
  NEUTRAL: {
    threshold: 25,
    name: 'Neutral',
    color: '#FFFF00',
    description: 'Unknown - standard treatment',
    effects: {
      canTrade: true,
      attackOnSight: false,
      bountyMultiplier: 1.0,
      contractAccess: true,
      territoryAccess: 'ALLOWED',
      priceMultiplier: 1.0, // Normal prices
      specialServices: false,
      diplomaticImmunity: false,
      escortAvailable: false
    }
  },
  FRIENDLY: {
    threshold: 75,
    name: 'Friendly',
    color: '#80FF00',
    description: 'Welcome - favorable treatment',
    effects: {
      canTrade: true,
      attackOnSight: false,
      bountyMultiplier: 0.5,
      contractAccess: true,
      territoryAccess: 'WELCOMED',
      priceMultiplier: 0.85, // 15% discount
      specialServices: true,
      diplomaticImmunity: false,
      escortAvailable: true
    }
  },
  ALLIED: {
    threshold: 100,
    name: 'Allied',
    color: '#00FF00',
    description: 'Trusted ally - maximum benefits',
    effects: {
      canTrade: true,
      attackOnSight: false,
      bountyMultiplier: 0.0, // No bounties
      contractAccess: true,
      territoryAccess: 'UNRESTRICTED',
      priceMultiplier: 0.7, // 30% discount
      specialServices: true,
      diplomaticImmunity: true,
      escortAvailable: true
    }
  }
};

// Faction relationship multipliers
const FACTION_RELATIONSHIP_MULTIPLIERS = {
  // Allied factions share some reputation
  ALLIED: {
    positiveMultiplier: 0.3, // 30% of positive rep shared
    negativeMultiplier: 0.1  // 10% of negative rep shared
  },
  
  // Enemy factions have inverse reputation effects
  ENEMY: {
    positiveMultiplier: -0.2, // Positive actions with enemies hurt rep
    negativeMultiplier: 0.5   // Negative actions with enemies boost rep
  },
  
  // Neutral factions have no cross-effects
  NEUTRAL: {
    positiveMultiplier: 0.0,
    negativeMultiplier: 0.0
  }
};

class ReputationManager {
  constructor(database) {
    this.database = database;
    
    // Player reputation tracking
    this.playerReputations = new Map(); // playerId -> Map<factionId, reputation>
    this.reputationHistory = new Map(); // playerId -> Array<reputationEvent>
    
    // Faction relationships
    this.factionRelationships = new Map(); // factionId -> Map<factionId, relationship>
    
    // Standing effects cache
    this.standingEffectsCache = new Map(); // playerId_factionId -> effects
    
    // Reputation events and consequences
    this.pendingConsequences = [];
    this.consequenceHistory = [];
    
    // Configuration
    this.reputationDecayRate = 0.1; // Per day
    this.maxHistoryLength = 100;
    this.saveInterval = 60000; // Save every minute
    
    // Statistics
    this.stats = {
      reputationChanges: 0,
      standingChanges: 0,
      consequencesTriggered: 0,
      tradeBonuses: 0,
      penalties: 0
    };
    
    // Initialize periodic tasks
    this.lastDecayUpdate = Date.now();
    this.lastSave = Date.now();
    
    console.log('ReputationManager initialized');
  }

  /**
   * Initialize reputation data from database
   */
  async initialize() {
    try {
      // Load player reputations
      await this.loadPlayerReputations();
      
      // Load faction relationships
      await this.loadFactionRelationships();
      
      // Build initial effects cache
      this.rebuildEffectsCache();
      
      console.log(`ReputationManager loaded data for ${this.playerReputations.size} players`);
      
    } catch (error) {
      console.error('Error initializing ReputationManager:', error);
      throw error;
    }
  }

  /**
   * Load player reputations from database
   */
  async loadPlayerReputations() {
    try {
      const reputations = await this.database.all(`
        SELECT player_id, faction_id, reputation, last_updated 
        FROM faction_player_reputation
      `);
      
      for (const rep of reputations) {
        if (!this.playerReputations.has(rep.player_id)) {
          this.playerReputations.set(rep.player_id, new Map());
        }
        
        this.playerReputations.get(rep.player_id).set(rep.faction_id, {
          reputation: rep.reputation,
          lastUpdated: new Date(rep.last_updated).getTime()
        });
      }
      
      // Load reputation history
      const history = await this.database.all(`
        SELECT player_id, faction_id, action, reputation_change, reason, timestamp
        FROM faction_reputation_history 
        ORDER BY timestamp DESC 
        LIMIT 1000
      `);
      
      for (const event of history) {
        if (!this.reputationHistory.has(event.player_id)) {
          this.reputationHistory.set(event.player_id, []);
        }
        
        this.reputationHistory.get(event.player_id).push({
          factionId: event.faction_id,
          action: event.action,
          change: event.reputation_change,
          reason: event.reason,
          timestamp: new Date(event.timestamp).getTime()
        });
      }
      
    } catch (error) {
      console.error('Error loading player reputations:', error);
    }
  }

  /**
   * Load faction relationships from database
   */
  async loadFactionRelationships() {
    try {
      const relationships = await this.database.all(`
        SELECT faction_id, target_faction_id, relationship_type, relationship_strength
        FROM faction_relationships
      `);
      
      for (const rel of relationships) {
        if (!this.factionRelationships.has(rel.faction_id)) {
          this.factionRelationships.set(rel.faction_id, new Map());
        }
        
        this.factionRelationships.get(rel.faction_id).set(rel.target_faction_id, {
          type: rel.relationship_type,
          strength: rel.relationship_strength
        });
      }
      
    } catch (error) {
      console.error('Error loading faction relationships:', error);
    }
  }

  /**
   * Update player reputation with a faction
   */
  async updatePlayerReputation(playerId, factionId, action, context = {}) {
    try {
      const actionData = REPUTATION_ACTIONS[action];
      if (!actionData) {
        console.error(`Unknown reputation action: ${action}`);
        return null;
      }

      // Calculate reputation change
      const change = this.calculateReputationChange(playerId, factionId, action, context);
      
      // Get current reputation
      const currentRep = this.getPlayerReputation(playerId, factionId);
      const oldStanding = this.getPlayerStanding(playerId, factionId);
      
      // Apply reputation change
      const newRep = Math.max(-100, Math.min(100, currentRep + change));
      
      // Update reputation
      if (!this.playerReputations.has(playerId)) {
        this.playerReputations.set(playerId, new Map());
      }
      
      this.playerReputations.get(playerId).set(factionId, {
        reputation: newRep,
        lastUpdated: Date.now()
      });
      
      // Check for standing change
      const newStanding = this.getPlayerStanding(playerId, factionId);
      const standingChanged = oldStanding.level !== newStanding.level;
      
      // Record reputation event
      await this.recordReputationEvent(playerId, factionId, action, change, context);
      
      // Apply cross-faction effects
      await this.applyCrossFactionEffects(playerId, factionId, change, action);
      
      // Update effects cache
      this.updatePlayerEffectsCache(playerId, factionId);
      
      // Trigger consequences for standing changes
      if (standingChanged) {
        await this.triggerStandingChangeConsequences(playerId, factionId, oldStanding, newStanding);
      }
      
      // Update statistics
      this.stats.reputationChanges++;
      if (standingChanged) {
        this.stats.standingChanges++;
      }
      
      const result = {
        playerId,
        factionId,
        action,
        change,
        oldReputation: currentRep,
        newReputation: newRep,
        oldStanding: oldStanding.level,
        newStanding: newStanding.level,
        standingChanged,
        consequences: []
      };

      console.log(`Player ${playerId} reputation with faction ${factionId}: ${currentRep} -> ${newRep} (${action}: ${change > 0 ? '+' : ''}${change})`);
      
      return result;
      
    } catch (error) {
      console.error(`Error updating reputation for player ${playerId} with faction ${factionId}:`, error);
      return null;
    }
  }

  /**
   * Calculate reputation change based on context
   */
  calculateReputationChange(playerId, factionId, action, context) {
    const actionData = REPUTATION_ACTIONS[action];
    let change = actionData.base;
    
    // Apply context modifiers
    if (context.multiplier) {
      change *= context.multiplier;
    }
    
    // Scale based on current reputation (harder to gain extreme reputation)
    const currentRep = this.getPlayerReputation(playerId, factionId);
    if (change > 0 && currentRep > 50) {
      change *= (100 - currentRep) / 50; // Diminishing returns for positive rep
    } else if (change < 0 && currentRep < -50) {
      change *= (100 + currentRep) / 50; // Diminishing returns for negative rep
    }
    
    // Apply faction-specific modifiers
    if (context.factionModifier) {
      change *= context.factionModifier;
    }
    
    // Apply value-based scaling
    if (context.value) {
      const valueScale = Math.log10(Math.max(1, context.value / 100)); // Scale based on trade value, etc.
      change *= (1 + valueScale * 0.2);
    }
    
    // Round to nearest 0.1
    return Math.round(change * 10) / 10;
  }

  /**
   * Get player reputation with a faction
   */
  getPlayerReputation(playerId, factionId) {
    const playerReps = this.playerReputations.get(playerId);
    if (!playerReps) return 0;
    
    const repData = playerReps.get(factionId);
    return repData ? repData.reputation : 0;
  }

  /**
   * Get player standing with a faction
   */
  getPlayerStanding(playerId, factionId) {
    const reputation = this.getPlayerReputation(playerId, factionId);
    
    // Find appropriate standing level
    const standings = Object.entries(REPUTATION_STANDINGS).reverse(); // Highest to lowest
    for (const [level, config] of standings) {
      if (reputation >= config.threshold) {
        return {
          level,
          config,
          reputation,
          effects: this.calculateStandingEffects(playerId, factionId, config.effects)
        };
      }
    }
    
    // Default to hostile if somehow below all thresholds
    return {
      level: 'HOSTILE',
      config: REPUTATION_STANDINGS.HOSTILE,
      reputation,
      effects: this.calculateStandingEffects(playerId, factionId, REPUTATION_STANDINGS.HOSTILE.effects)
    };
  }

  /**
   * Calculate effective standing effects including bonuses/penalties
   */
  calculateStandingEffects(playerId, factionId, baseEffects) {
    const effects = { ...baseEffects };
    
    // Apply player-specific bonuses (e.g., from achievements, items)
    // TODO: Implement player bonus system
    
    // Apply faction-specific modifiers
    // TODO: Implement faction-specific effect modifiers
    
    return effects;
  }

  /**
   * Check if player can perform action with faction
   */
  canPlayerInteract(playerId, factionId, interactionType) {
    const standing = this.getPlayerStanding(playerId, factionId);
    const effects = standing.effects;
    
    switch (interactionType) {
      case 'TRADE':
        return effects.canTrade;
      case 'CONTRACTS':
        return effects.contractAccess;
      case 'ENTER_TERRITORY':
        return effects.territoryAccess !== 'BANNED';
      case 'SPECIAL_SERVICES':
        return effects.specialServices;
      case 'REQUEST_ESCORT':
        return effects.escortAvailable;
      default:
        return true;
    }
  }

  /**
   * Get trade price modifier for player with faction
   */
  getTradePriceModifier(playerId, factionId) {
    const standing = this.getPlayerStanding(playerId, factionId);
    return standing.effects.priceMultiplier;
  }

  /**
   * Get bounty multiplier for player with faction
   */
  getBountyMultiplier(playerId, factionId) {
    const standing = this.getPlayerStanding(playerId, factionId);
    return standing.effects.bountyMultiplier;
  }

  /**
   * Check if faction should attack player on sight
   */
  shouldAttackOnSight(playerId, factionId) {
    const standing = this.getPlayerStanding(playerId, factionId);
    return standing.effects.attackOnSight;
  }

  /**
   * Apply cross-faction reputation effects
   */
  async applyCrossFactionEffects(playerId, factionId, change, action) {
    try {
      const relationships = this.factionRelationships.get(factionId);
      if (!relationships) return;
      
      for (const [targetFactionId, relationship] of relationships.entries()) {
        const multipliers = FACTION_RELATIONSHIP_MULTIPLIERS[relationship.type];
        if (!multipliers) continue;
        
        let crossChange = 0;
        if (change > 0) {
          crossChange = change * multipliers.positiveMultiplier * relationship.strength;
        } else {
          crossChange = change * multipliers.negativeMultiplier * relationship.strength;
        }
        
        if (Math.abs(crossChange) >= 0.1) {
          // Apply cross-faction reputation change
          const currentRep = this.getPlayerReputation(playerId, targetFactionId);
          const newRep = Math.max(-100, Math.min(100, currentRep + crossChange));
          
          if (!this.playerReputations.has(playerId)) {
            this.playerReputations.set(playerId, new Map());
          }
          
          this.playerReputations.get(playerId).set(targetFactionId, {
            reputation: newRep,
            lastUpdated: Date.now()
          });
          
          // Record cross-faction event
          await this.recordReputationEvent(playerId, targetFactionId, `CROSS_FACTION_${action}`, crossChange, {
            sourceFaction: factionId,
            relationship: relationship.type
          });
          
          console.log(`Cross-faction reputation: Player ${playerId} with faction ${targetFactionId}: ${Math.round(crossChange * 10) / 10} (${relationship.type})`);
        }
      }
      
    } catch (error) {
      console.error(`Error applying cross-faction effects for player ${playerId}:`, error);
    }
  }

  /**
   * Record reputation event in history and database
   */
  async recordReputationEvent(playerId, factionId, action, change, context) {
    try {
      const event = {
        playerId,
        factionId,
        action,
        change,
        reason: context.reason || REPUTATION_ACTIONS[action]?.description || 'Unknown',
        timestamp: Date.now(),
        context: { ...context }
      };
      
      // Add to history
      if (!this.reputationHistory.has(playerId)) {
        this.reputationHistory.set(playerId, []);
      }
      
      const history = this.reputationHistory.get(playerId);
      history.unshift(event);
      
      // Maintain history length
      if (history.length > this.maxHistoryLength) {
        this.reputationHistory.set(playerId, history.slice(0, this.maxHistoryLength));
      }
      
      // Save to database
      await this.database.run(`
        INSERT INTO faction_reputation_history 
        (player_id, faction_id, action, reputation_change, reason, timestamp)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [playerId, factionId, action, change, event.reason]);
      
      // Update player reputation in database
      await this.database.run(`
        INSERT OR REPLACE INTO faction_player_reputation 
        (player_id, faction_id, reputation, last_updated)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `, [playerId, factionId, this.getPlayerReputation(playerId, factionId)]);
      
    } catch (error) {
      console.error(`Error recording reputation event for player ${playerId}:`, error);
    }
  }

  /**
   * Trigger consequences for standing changes
   */
  async triggerStandingChangeConsequences(playerId, factionId, oldStanding, newStanding) {
    try {
      const consequences = [];
      
      // Standing improvement consequences
      if (this.getStandingRank(newStanding.level) > this.getStandingRank(oldStanding.level)) {
        consequences.push(...this.getStandingImprovementConsequences(playerId, factionId, newStanding));
      }
      
      // Standing degradation consequences
      if (this.getStandingRank(newStanding.level) < this.getStandingRank(oldStanding.level)) {
        consequences.push(...this.getStandingDegradationConsequences(playerId, factionId, oldStanding, newStanding));
      }
      
      // Execute consequences
      for (const consequence of consequences) {
        await this.executeConsequence(consequence);
      }
      
      this.stats.consequencesTriggered += consequences.length;
      
    } catch (error) {
      console.error(`Error triggering standing change consequences for player ${playerId}:`, error);
    }
  }

  /**
   * Get numerical rank for standing comparison
   */
  getStandingRank(standingLevel) {
    const ranks = {
      HOSTILE: 0,
      UNFRIENDLY: 1,
      NEUTRAL: 2,
      FRIENDLY: 3,
      ALLIED: 4
    };
    return ranks[standingLevel] || 0;
  }

  /**
   * Get consequences for standing improvement
   */
  getStandingImprovementConsequences(playerId, factionId, newStanding) {
    const consequences = [];
    
    switch (newStanding.level) {
      case 'FRIENDLY':
        consequences.push({
          type: 'UNLOCK_SPECIAL_SERVICES',
          playerId,
          factionId,
          message: `You now have access to special services with ${factionId}`
        });
        break;
        
      case 'ALLIED':
        consequences.push({
          type: 'DIPLOMATIC_IMMUNITY',
          playerId,
          factionId,
          message: `You have gained diplomatic immunity with ${factionId}`
        });
        consequences.push({
          type: 'MAXIMUM_TRADE_DISCOUNT',
          playerId,
          factionId,
          message: `You now receive maximum trade discounts with ${factionId}`
        });
        break;
    }
    
    return consequences;
  }

  /**
   * Get consequences for standing degradation
   */
  getStandingDegradationConsequences(playerId, factionId, oldStanding, newStanding) {
    const consequences = [];
    
    if (newStanding.level === 'HOSTILE' && oldStanding.level !== 'HOSTILE') {
      consequences.push({
        type: 'DECLARE_HOSTILE',
        playerId,
        factionId,
        message: `${factionId} has declared you hostile - they will attack on sight!`
      });
    }
    
    if (newStanding.level === 'UNFRIENDLY' && this.getStandingRank(oldStanding.level) >= 2) {
      consequences.push({
        type: 'REVOKE_TRADE_PRIVILEGES',
        playerId,
        factionId,
        message: `Your trade privileges with ${factionId} have been restricted`
      });
    }
    
    return consequences;
  }

  /**
   * Execute a consequence
   */
  async executeConsequence(consequence) {
    try {
      switch (consequence.type) {
        case 'UNLOCK_SPECIAL_SERVICES':
          await this.unlockSpecialServices(consequence);
          break;
        case 'DECLARE_HOSTILE':
          await this.declareHostile(consequence);
          break;
        case 'REVOKE_TRADE_PRIVILEGES':
          await this.revokeTradePrivileges(consequence);
          break;
        default:
          console.log(`Consequence: ${consequence.message}`);
      }
      
      // Record consequence
      this.consequenceHistory.push({
        ...consequence,
        executedAt: Date.now()
      });
      
    } catch (error) {
      console.error(`Error executing consequence:`, error);
    }
  }

  /**
   * Update player effects cache
   */
  updatePlayerEffectsCache(playerId, factionId) {
    const cacheKey = `${playerId}_${factionId}`;
    const standing = this.getPlayerStanding(playerId, factionId);
    this.standingEffectsCache.set(cacheKey, standing.effects);
  }

  /**
   * Rebuild entire effects cache
   */
  rebuildEffectsCache() {
    this.standingEffectsCache.clear();
    
    for (const [playerId, factionReps] of this.playerReputations.entries()) {
      for (const factionId of factionReps.keys()) {
        this.updatePlayerEffectsCache(playerId, factionId);
      }
    }
  }

  /**
   * Update reputation system (called periodically)
   */
  async update() {
    const now = Date.now();
    
    try {
      // Apply reputation decay
      if (now - this.lastDecayUpdate > 86400000) { // Once per day
        await this.applyReputationDecay();
        this.lastDecayUpdate = now;
      }
      
      // Save data periodically
      if (now - this.lastSave > this.saveInterval) {
        await this.saveReputationData();
        this.lastSave = now;
      }
      
    } catch (error) {
      console.error('Error updating reputation system:', error);
    }
  }

  /**
   * Apply gradual reputation decay toward neutral
   */
  async applyReputationDecay() {
    try {
      for (const [playerId, factionReps] of this.playerReputations.entries()) {
        for (const [factionId, repData] of factionReps.entries()) {
          const currentRep = repData.reputation;
          
          // Don't decay if reputation changed recently (within 7 days)
          if (Date.now() - repData.lastUpdated < 604800000) {
            continue;
          }
          
          // Calculate decay
          let decay = 0;
          if (currentRep > 0) {
            decay = -Math.min(this.reputationDecayRate, currentRep * 0.01);
          } else if (currentRep < 0) {
            decay = Math.min(this.reputationDecayRate, Math.abs(currentRep) * 0.01);
          }
          
          if (Math.abs(decay) >= 0.1) {
            const newRep = currentRep + decay;
            
            // Update reputation
            factionReps.set(factionId, {
              reputation: newRep,
              lastUpdated: repData.lastUpdated
            });
            
            // Record decay event
            await this.recordReputationEvent(playerId, factionId, 'REPUTATION_DECAY', decay, {
              reason: 'Natural reputation decay over time'
            });
          }
        }
      }
      
      console.log('Applied daily reputation decay');
      
    } catch (error) {
      console.error('Error applying reputation decay:', error);
    }
  }

  /**
   * Save reputation data to database
   */
  async saveReputationData() {
    try {
      for (const [playerId, factionReps] of this.playerReputations.entries()) {
        for (const [factionId, repData] of factionReps.entries()) {
          await this.database.run(`
            INSERT OR REPLACE INTO faction_player_reputation 
            (player_id, faction_id, reputation, last_updated)
            VALUES (?, ?, ?, ?)
          `, [playerId, factionId, repData.reputation, new Date(repData.lastUpdated).toISOString()]);
        }
      }
      
    } catch (error) {
      console.error('Error saving reputation data:', error);
    }
  }

  /**
   * Get player reputation summary
   */
  getPlayerReputationSummary(playerId) {
    const playerReps = this.playerReputations.get(playerId);
    if (!playerReps) return {};
    
    const summary = {};
    
    for (const [factionId, repData] of playerReps.entries()) {
      const standing = this.getPlayerStanding(playerId, factionId);
      summary[factionId] = {
        reputation: repData.reputation,
        standing: standing.level,
        standingName: standing.config.name,
        color: standing.config.color,
        description: standing.config.description,
        canTrade: standing.effects.canTrade,
        attackOnSight: standing.effects.attackOnSight,
        priceMultiplier: standing.effects.priceMultiplier,
        lastUpdated: repData.lastUpdated
      };
    }
    
    return summary;
  }

  /**
   * Get player reputation history
   */
  getPlayerReputationHistory(playerId, limit = 20) {
    const history = this.reputationHistory.get(playerId);
    if (!history) return [];
    
    return history.slice(0, limit);
  }

  /**
   * Get reputation statistics
   */
  getReputationStats() {
    return {
      ...this.stats,
      totalPlayers: this.playerReputations.size,
      totalReputationEntries: Array.from(this.playerReputations.values()).reduce((sum, factionMap) => sum + factionMap.size, 0),
      factionRelationships: this.factionRelationships.size,
      cacheSize: this.standingEffectsCache.size,
      lastDecayUpdate: this.lastDecayUpdate,
      lastSave: this.lastSave
    };
  }

  /**
   * Set faction relationship
   */
  setFactionRelationship(factionId, targetFactionId, relationshipType, strength = 1.0) {
    if (!this.factionRelationships.has(factionId)) {
      this.factionRelationships.set(factionId, new Map());
    }
    
    this.factionRelationships.get(factionId).set(targetFactionId, {
      type: relationshipType,
      strength: Math.max(0, Math.min(1, strength))
    });
  }

  /**
   * Consequence execution methods
   */
  async unlockSpecialServices(consequence) {
    // TODO: Implement special services unlock
    console.log(`Unlocked special services for player ${consequence.playerId} with faction ${consequence.factionId}`);
  }

  async declareHostile(consequence) {
    // TODO: Implement hostile declaration effects
    console.log(`Player ${consequence.playerId} declared hostile by faction ${consequence.factionId}`);
  }

  async revokeTradePrivileges(consequence) {
    // TODO: Implement trade privilege revocation
    console.log(`Trade privileges revoked for player ${consequence.playerId} with faction ${consequence.factionId}`);
  }
}

module.exports = { ReputationManager, REPUTATION_ACTIONS, REPUTATION_STANDINGS };