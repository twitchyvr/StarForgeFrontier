/**
 * ContractSystem.js - Delivery contract and mission system for StarForgeFrontier
 * Generates and manages delivery missions between trading stations
 */

const { v4: uuidv4 } = require('uuid');
const { ORE_TYPES, BIOME_TYPES } = require('../galaxy/Sector');

// Contract difficulty levels
const RISK_LEVELS = {
  1: { 
    name: 'Safe Route', 
    description: 'Low risk cargo delivery through safe sectors',
    rewardMultiplier: 1.0,
    failureChance: 0.02,
    timeMultiplier: 1.0,
    color: '#4CAF50'
  },
  2: { 
    name: 'Standard Route', 
    description: 'Normal delivery with moderate hazards',
    rewardMultiplier: 1.3,
    failureChance: 0.05,
    timeMultiplier: 1.1,
    color: '#FFC107'
  },
  3: { 
    name: 'Dangerous Route', 
    description: 'High risk delivery through hazardous sectors',
    rewardMultiplier: 1.8,
    failureChance: 0.10,
    timeMultiplier: 1.3,
    color: '#FF5722'
  },
  4: { 
    name: 'Extreme Route', 
    description: 'Very dangerous route requiring skilled pilots',
    rewardMultiplier: 2.5,
    failureChance: 0.15,
    timeMultiplier: 1.5,
    color: '#E91E63'
  },
  5: { 
    name: 'Suicide Mission', 
    description: 'Extremely hazardous delivery with massive rewards',
    rewardMultiplier: 4.0,
    failureChance: 0.25,
    timeMultiplier: 2.0,
    color: '#9C27B0'
  }
};

// Contract types
const CONTRACT_TYPES = {
  STANDARD_DELIVERY: {
    name: 'Standard Delivery',
    description: 'Deliver cargo from point A to point B',
    baseReward: 100,
    urgencyBonus: 0.5 // 50% bonus for urgent deliveries
  },
  RUSH_DELIVERY: {
    name: 'Rush Delivery',
    description: 'Time-critical delivery with tight deadline',
    baseReward: 200,
    timeMultiplier: 0.6, // 40% less time
    urgencyBonus: 1.0 // 100% bonus
  },
  BULK_TRANSPORT: {
    name: 'Bulk Transport',
    description: 'Large quantity cargo delivery',
    baseReward: 80,
    quantityMultiplier: 1.5,
    urgencyBonus: 0.3
  },
  RARE_MATERIALS: {
    name: 'Rare Materials',
    description: 'Delivery of high-value rare materials',
    baseReward: 300,
    rarityBonus: 2.0,
    urgencyBonus: 0.8
  },
  RESEARCH_SAMPLE: {
    name: 'Research Sample',
    description: 'Delicate scientific cargo requiring careful handling',
    baseReward: 250,
    careRequired: true,
    urgencyBonus: 1.2
  }
};

// NPC contract givers
const CONTRACT_GIVERS = [
  'Mining Consortium',
  'Research Division',
  'Trade Federation',
  'Logistics Corp',
  'Independent Trader',
  'Station Commander',
  'Corporate Executive',
  'Military Liaison',
  'Science Officer',
  'Merchant Guild'
];

class ContractSystem {
  constructor(database) {
    this.database = database;
    this.activeContracts = new Map();
    this.contractTemplates = new Map();
    
    // System configuration
    this.config = {
      maxActiveContracts: 50,
      contractGenerationRate: 300000, // Generate new contracts every 5 minutes
      contractExpiryHours: 24, // Contracts expire after 24 hours if not accepted
      missionExpiryHours: 72, // Accepted missions expire after 72 hours
      baseDistanceReward: 10, // Resources per sector distance
      cargoSizeReward: 5, // Resources per unit of cargo
      minDistance: 1,
      maxDistance: 20,
      minCargoSize: 10,
      maxCargoSize: 500
    };
    
    // Initialize contract generation
    this.initializeSystem();
  }

  /**
   * Initialize the contract system
   */
  async initializeSystem() {
    try {
      // Load existing contracts from database
      await this.loadActiveContracts();
      
      // Start contract generation loop
      this.startContractGeneration();
      
      console.log('Contract system initialized successfully');
    } catch (error) {
      console.error('Error initializing contract system:', error);
    }
  }

  /**
   * Load active contracts from database
   */
  async loadActiveContracts() {
    const contracts = await this.database.getAvailableContracts();
    
    this.activeContracts.clear();
    for (const contract of contracts) {
      this.activeContracts.set(contract.id, {
        id: contract.id,
        contractGiver: contract.contract_giver,
        originStationId: contract.origin_station_id,
        destinationStationId: contract.destination_station_id,
        cargoType: contract.cargo_type,
        cargoQuantity: contract.cargo_quantity,
        baseReward: contract.base_reward,
        bonusReward: contract.bonus_reward,
        distance: contract.distance,
        riskLevel: contract.risk_level,
        deadline: new Date(contract.deadline),
        status: contract.status,
        createdAt: new Date(contract.created_at),
        originName: contract.origin_name,
        destinationName: contract.destination_name,
        originSector: { x: contract.origin_sector_x, y: contract.origin_sector_y },
        destSector: { x: contract.dest_sector_x, y: contract.dest_sector_y }
      });
    }
  }

  /**
   * Start automatic contract generation
   */
  startContractGeneration() {
    setInterval(async () => {
      try {
        await this.generateNewContracts();
        await this.cleanupExpiredContracts();
      } catch (error) {
        console.error('Error in contract generation cycle:', error);
      }
    }, this.config.contractGenerationRate);
  }

  /**
   * Generate new delivery contracts
   */
  async generateNewContracts() {
    // Check if we need more contracts
    const availableCount = Array.from(this.activeContracts.values())
      .filter(c => c.status === 'available').length;
    
    if (availableCount >= this.config.maxActiveContracts) {
      return; // Already have enough contracts
    }
    
    // Get all active trading stations
    const stations = await this.database.all(
      'SELECT * FROM trading_stations WHERE is_active = 1'
    );
    
    if (stations.length < 2) {
      return; // Need at least 2 stations for contracts
    }
    
    const contractsToGenerate = Math.min(
      5, // Generate up to 5 contracts per cycle
      this.config.maxActiveContracts - availableCount
    );
    
    for (let i = 0; i < contractsToGenerate; i++) {
      await this.generateSingleContract(stations);
    }
  }

  /**
   * Generate a single contract
   */
  async generateSingleContract(stations) {
    // Select random origin and destination stations
    const originStation = this.randomChoice(stations);
    let destinationStation;
    
    // Ensure destination is different from origin
    do {
      destinationStation = this.randomChoice(stations);
    } while (destinationStation.id === originStation.id);
    
    // Calculate distance between stations
    const distance = this.calculateDistance(
      { x: originStation.sector_x, y: originStation.sector_y },
      { x: destinationStation.sector_x, y: destinationStation.sector_y }
    );
    
    if (distance < this.config.minDistance || distance > this.config.maxDistance) {
      return; // Skip if distance is outside acceptable range
    }
    
    // Determine cargo type based on origin station's biome
    const cargoType = this.selectCargoType(originStation.biome_type);
    if (!cargoType) return;
    
    // Determine contract type and risk level
    const contractType = this.selectContractType(distance, cargoType);
    const riskLevel = this.calculateRiskLevel(distance, originStation.biome_type, destinationStation.biome_type);
    
    // Calculate cargo quantity
    const cargoQuantity = this.calculateCargoQuantity(contractType, distance);
    
    // Calculate rewards
    const rewards = this.calculateRewards(contractType, cargoType, cargoQuantity, distance, riskLevel);
    
    // Generate deadline
    const deadline = this.generateDeadline(contractType, distance, riskLevel);
    
    // Create contract
    const contractData = {
      id: uuidv4(),
      contract_giver: this.randomChoice(CONTRACT_GIVERS),
      origin_station_id: originStation.id,
      destination_station_id: destinationStation.id,
      cargo_type: cargoType,
      cargo_quantity: cargoQuantity,
      base_reward: rewards.baseReward,
      bonus_reward: rewards.bonusReward,
      distance: distance,
      risk_level: riskLevel,
      deadline: deadline
    };
    
    // Save to database
    await this.database.createDeliveryContract(contractData);
    
    // Add to active contracts
    this.activeContracts.set(contractData.id, {
      ...contractData,
      status: 'available',
      createdAt: new Date(),
      deadline: new Date(deadline),
      originName: originStation.station_name,
      destinationName: destinationStation.station_name,
      originSector: { x: originStation.sector_x, y: originStation.sector_y },
      destSector: { x: destinationStation.sector_x, y: destinationStation.sector_y }
    });
    
    console.log(`Generated contract: ${cargoQuantity} ${cargoType} from ${originStation.station_name} to ${destinationStation.station_name} (${distance} sectors, risk ${riskLevel})`);
  }

  /**
   * Select cargo type based on biome
   */
  selectCargoType(biomeType) {
    const biomeConfig = BIOME_TYPES[biomeType];
    if (!biomeConfig || !biomeConfig.oreTypes.length) {
      return null;
    }
    
    // 70% chance for biome-specific ore, 30% for any ore
    if (Math.random() < 0.7) {
      return this.randomChoice(biomeConfig.oreTypes);
    } else {
      return this.randomChoice(Object.keys(ORE_TYPES));
    }
  }

  /**
   * Select contract type based on parameters
   */
  selectContractType(distance, cargoType) {
    const oreConfig = ORE_TYPES[cargoType];
    
    // Rare materials get special contract types
    if (oreConfig.rarity < 0.1) {
      return Math.random() < 0.5 ? 'RARE_MATERIALS' : 'RESEARCH_SAMPLE';
    }
    
    // Long distance contracts are more likely to be rush deliveries
    if (distance > 10 && Math.random() < 0.3) {
      return 'RUSH_DELIVERY';
    }
    
    // Random selection with weighted probabilities
    const weights = [
      { type: 'STANDARD_DELIVERY', weight: 40 },
      { type: 'BULK_TRANSPORT', weight: 25 },
      { type: 'RUSH_DELIVERY', weight: 15 },
      { type: 'RARE_MATERIALS', weight: 10 },
      { type: 'RESEARCH_SAMPLE', weight: 10 }
    ];
    
    return this.weightedRandomChoice(weights);
  }

  /**
   * Calculate risk level based on route characteristics
   */
  calculateRiskLevel(distance, originBiome, destBiome) {
    let risk = 1;
    
    // Distance increases risk
    if (distance > 15) risk += 2;
    else if (distance > 10) risk += 1;
    else if (distance > 5) risk += 0;
    
    // Dangerous biomes increase risk
    const dangerousBiomes = ['BLACK_HOLE_REGION', 'STELLAR_NURSERY'];
    if (dangerousBiomes.includes(originBiome)) risk += 1;
    if (dangerousBiomes.includes(destBiome)) risk += 1;
    
    // Add some randomization
    risk += Math.random() > 0.7 ? 1 : 0;
    
    return Math.min(5, Math.max(1, risk));
  }

  /**
   * Calculate cargo quantity
   */
  calculateCargoQuantity(contractType, distance) {
    const typeConfig = CONTRACT_TYPES[contractType];
    let baseQuantity = this.randomInt(this.config.minCargoSize, this.config.maxCargoSize);
    
    // Adjust based on contract type
    if (contractType === 'BULK_TRANSPORT') {
      baseQuantity = Math.floor(baseQuantity * 1.5);
    } else if (contractType === 'RARE_MATERIALS' || contractType === 'RESEARCH_SAMPLE') {
      baseQuantity = Math.floor(baseQuantity * 0.3);
    }
    
    // Adjust based on distance (longer routes = smaller cargo for balance)
    const distanceMultiplier = 1.0 - (distance / 50); // Reduce cargo size for very long routes
    baseQuantity = Math.floor(baseQuantity * Math.max(0.3, distanceMultiplier));
    
    return Math.max(1, baseQuantity);
  }

  /**
   * Calculate contract rewards
   */
  calculateRewards(contractType, cargoType, cargoQuantity, distance, riskLevel) {
    const typeConfig = CONTRACT_TYPES[contractType];
    const oreConfig = ORE_TYPES[cargoType];
    const riskConfig = RISK_LEVELS[riskLevel];
    
    // Base reward calculation
    let baseReward = typeConfig.baseReward;
    baseReward += distance * this.config.baseDistanceReward;
    baseReward += cargoQuantity * this.config.cargoSizeReward;
    baseReward = Math.floor(baseReward * (oreConfig.value / 100)); // Adjust for ore value
    baseReward = Math.floor(baseReward * riskConfig.rewardMultiplier);
    
    // Bonus reward (for early completion or perfect delivery)
    let bonusReward = Math.floor(baseReward * typeConfig.urgencyBonus);
    
    // Rare materials get extra bonuses
    if (oreConfig.rarity < 0.1) {
      bonusReward = Math.floor(bonusReward * (typeConfig.rarityBonus || 1.0));
    }
    
    return {
      baseReward: Math.max(50, baseReward),
      bonusReward: Math.max(10, bonusReward)
    };
  }

  /**
   * Generate contract deadline
   */
  generateDeadline(contractType, distance, riskLevel) {
    const typeConfig = CONTRACT_TYPES[contractType];
    const riskConfig = RISK_LEVELS[riskLevel];
    
    // Base time: 1 hour per sector + risk time modifier
    let baseHours = distance * riskConfig.timeMultiplier + 4; // 4 hour minimum
    
    // Contract type modifiers
    if (typeConfig.timeMultiplier) {
      baseHours *= typeConfig.timeMultiplier;
    }
    
    // Add some randomization
    baseHours += (Math.random() - 0.5) * baseHours * 0.3; // ±30% variation
    
    baseHours = Math.max(2, baseHours); // Minimum 2 hours
    
    return new Date(Date.now() + baseHours * 3600000);
  }

  /**
   * Accept a contract
   */
  async acceptContract(contractId, playerId) {
    const contract = this.activeContracts.get(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }
    
    if (contract.status !== 'available') {
      throw new Error('Contract is no longer available');
    }
    
    if (new Date() > contract.deadline) {
      throw new Error('Contract has expired');
    }
    
    // Check if player already has too many active contracts
    const playerContracts = await this.database.getPlayerContracts(playerId, 'accepted');
    if (playerContracts.length >= 5) { // Maximum 5 active contracts per player
      throw new Error('You already have the maximum number of active contracts');
    }
    
    // Update contract in database
    await this.database.acceptDeliveryContract(contractId, playerId);
    
    // Update local state
    contract.status = 'accepted';
    contract.playerId = playerId;
    contract.acceptedAt = new Date();
    
    return contract;
  }

  /**
   * Complete a contract
   */
  async completeContract(contractId, playerId) {
    const contract = this.activeContracts.get(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }
    
    if (contract.playerId !== playerId) {
      throw new Error('Contract not assigned to this player');
    }
    
    if (contract.status !== 'accepted') {
      throw new Error('Contract is not in progress');
    }
    
    // Check if deadline was met for bonus reward
    const completedOnTime = new Date() <= contract.deadline;
    const reward = contract.baseReward + (completedOnTime ? contract.bonusReward : 0);
    
    // Update contract status
    await this.database.updateContractStatus(contractId, 'completed');
    
    // Update player resources
    await this.database.run(
      'UPDATE player_stats SET resources = resources + ? WHERE player_id = ?',
      [reward, playerId]
    );
    
    // Update local state
    contract.status = 'completed';
    contract.completedAt = new Date();
    
    // Remove from active contracts
    this.activeContracts.delete(contractId);
    
    return {
      contract,
      reward,
      bonusEarned: completedOnTime,
      message: completedOnTime ? 
        `Contract completed on time! Earned ${reward} resources (${contract.bonusReward} bonus)` :
        `Contract completed. Earned ${contract.baseReward} resources (no bonus for late delivery)`
    };
  }

  /**
   * Fail a contract
   */
  async failContract(contractId, playerId, reason = 'Failed to deliver') {
    const contract = this.activeContracts.get(contractId);
    if (!contract) {
      throw new Error('Contract not found');
    }
    
    if (contract.playerId !== playerId) {
      throw new Error('Contract not assigned to this player');
    }
    
    // Update contract status
    await this.database.updateContractStatus(contractId, 'failed');
    
    // Update local state
    contract.status = 'failed';
    contract.failureReason = reason;
    
    // Remove from active contracts
    this.activeContracts.delete(contractId);
    
    return contract;
  }

  /**
   * Get available contracts
   */
  getAvailableContracts(limit = 20) {
    return Array.from(this.activeContracts.values())
      .filter(c => c.status === 'available' && new Date() <= c.deadline)
      .sort((a, b) => b.baseReward - a.baseReward) // Sort by reward descending
      .slice(0, limit)
      .map(contract => ({
        id: contract.id,
        contractGiver: contract.contractGiver,
        originName: contract.originName,
        destinationName: contract.destinationName,
        originSector: contract.originSector,
        destSector: contract.destSector,
        cargoType: contract.cargoType,
        cargoQuantity: contract.cargoQuantity,
        baseReward: contract.baseReward,
        bonusReward: contract.bonusReward,
        totalReward: contract.baseReward + contract.bonusReward,
        distance: contract.distance,
        riskLevel: contract.riskLevel,
        riskName: RISK_LEVELS[contract.riskLevel].name,
        deadline: contract.deadline,
        timeRemaining: contract.deadline.getTime() - Date.now(),
        description: this.generateContractDescription(contract)
      }));
  }

  /**
   * Generate contract description
   */
  generateContractDescription(contract) {
    const riskInfo = RISK_LEVELS[contract.riskLevel];
    const oreInfo = ORE_TYPES[contract.cargoType];
    
    return `Deliver ${contract.cargoQuantity} units of ${oreInfo.name} from ${contract.originName} to ${contract.destinationName}. ` +
           `Distance: ${contract.distance} sectors. Risk Level: ${riskInfo.name}. ` +
           `Base reward: ${contract.baseReward} resources, bonus: ${contract.bonusReward} resources for on-time delivery.`;
  }

  /**
   * Clean up expired contracts
   */
  async cleanupExpiredContracts() {
    const now = new Date();
    const expiredContracts = [];
    
    for (const [contractId, contract] of this.activeContracts.entries()) {
      if (contract.status === 'available' && now > contract.deadline) {
        expiredContracts.push(contractId);
      }
    }
    
    for (const contractId of expiredContracts) {
      await this.database.updateContractStatus(contractId, 'expired');
      this.activeContracts.delete(contractId);
    }
    
    if (expiredContracts.length > 0) {
      console.log(`Cleaned up ${expiredContracts.length} expired contracts`);
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(point1, point2) {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.ceil(Math.sqrt(dx * dx + dy * dy));
  }

  /**
   * Get random choice from array
   */
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Weighted random choice
   */
  weightedRandomChoice(choices) {
    const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const choice of choices) {
      random -= choice.weight;
      if (random <= 0) {
        return choice.type;
      }
    }
    
    return choices[choices.length - 1].type;
  }

  /**
   * Random integer between min and max (inclusive)
   */
  randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get contract statistics
   */
  async getContractStats() {
    const stats = await this.database.all(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(base_reward) as avg_reward,
        AVG(distance) as avg_distance,
        AVG(risk_level) as avg_risk
      FROM delivery_contracts 
      WHERE created_at > datetime('now', '-7 days')
      GROUP BY status
    `);
    
    const totalActive = Array.from(this.activeContracts.values()).length;
    const availableCount = Array.from(this.activeContracts.values())
      .filter(c => c.status === 'available').length;
    
    return {
      weeklyStats: stats,
      currentActive: totalActive,
      currentAvailable: availableCount,
      totalValue: Array.from(this.activeContracts.values())
        .reduce((sum, contract) => sum + contract.baseReward + contract.bonusReward, 0)
    };
  }
}

module.exports = {
  ContractSystem,
  RISK_LEVELS,
  CONTRACT_TYPES
};